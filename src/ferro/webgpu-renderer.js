/* FERRO native WebGPU backend. Shared procedural geometry, independent GPU resources.
 * The WebGL2 renderer remains the fallback; this file never obtains a GL context. */
(function(G){'use strict';
const ALIGN=256,align=n=>Math.ceil(n/ALIGN)*ALIGN;
// Sélection vide partagée (index spatial vide) : figée, aucun appelant ne la remplit.
const NONE=Object.freeze([]);
const GEOMETRY=[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]},{arrayStride:64,stepMode:'instance',attributes:[{shaderLocation:2,offset:0,format:'float32x4'},{shaderLocation:3,offset:16,format:'float32x4'},{shaderLocation:4,offset:32,format:'float32x4'},{shaderLocation:5,offset:48,format:'float32x4'}]}];
const RIGID_TERRAIN=[{arrayStride:40,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x4'}]},
 {arrayStride:48,stepMode:'instance',attributes:[{shaderLocation:3,offset:0,format:'float32x4'},{shaderLocation:4,offset:16,format:'float32x4'},{shaderLocation:5,offset:32,format:'float32x4'}]}];
const FULLSCREEN=`struct V { @builtin(position) p:vec4f, @location(0) uv:vec2f }; @vertex fn vs(@builtin(vertex_index) i:u32)->V { let p=vec2f(f32((i<<1u)&2u),f32(i&2u)); var o:V;o.p=vec4f(p*2.-1.,0.,1.);o.uv=vec2f(p.x,1.-p.y);return o; }`;
const COPY=FULLSCREEN+`@group(0) @binding(0) var t:texture_2d<f32>;@group(0) @binding(1) var s:sampler;@fragment fn fs(v:V)->@location(0) vec4f{return textureSample(t,s,v.uv);}`;
// LOT 0.3 (0.3.39) : tonemaps de post.wgsl et exposition qui rend au gris moyen (0,18) sa valeur affichée de 0.3.38
// (0,4718). Le halo additionne quatre niveaux Dual-Kawase ; sa force est divisée par leur nombre.
const TONEMAPS=Object.freeze({ferro:0,agx:1,aces:2}),TONE_EXPOSURE=Object.freeze({ferro:1,agx:.870119,aces:1.532848}),BLOOM_LEVELS=4;
// Fond de la scène (intérieurs, vide) : la couleur affichée de 0.3.38 (0,035 ; 0,06 ; 0,073) ramenée en radiance par l'inverse de
// la courbe historique ; le tonemap ferro la redonne au centre de l'image, AgX et ACES l'assombrissent comme tout noir profond.
const CLEAR_LINEAR=Object.freeze([...[.035,.06,.073].map(d=>{const x=Math.pow(d,2.2);return .76*x/(1-x);}),1]);
// LOT 0.4 (0.3.40) : cuisson d'amorçage de boot_bake.wgsl, en un seul passage compute, sans image ni canvas :
// - les 16 motifs-mères 128×128 et leurs 8 niveaux ;
// - la LUT de BRDF 64×64 ;
// - pour une banque de FMaterials (recette ferro-pbr-1), ses deux couches PBR 256×256 et leurs 9 niveaux.
// Les octets de ces couches égalent ceux des canvas de materials.js à un pas près.
const PBR_RECIPE='ferro-pbr-1',SLOPE_GAIN=4;
const BAKE=Object.freeze({motifs:16,motifSize:128,motifLevels:8,lutSize:64,pbrSize:256,pbrLayers:2,pbrLevels:9});
const bakeBytes=(size,levels,layers,texel)=>{let n=0;for(let m=0;m<levels;m++)n+=Math.max(1,size>>m)**2;return n*layers*texel;};
async function bootBake(device,{pbr=false,timestamps=false,label='FERRO'}={}){
 const program=G.FRenderWebGPUShaders?.programs?.bootBake;
 if(!program?.compute)throw Error('boot_bake.wgsl absent du manifeste WebGPU');
 if(typeof device.createComputePipelineAsync!=='function')throw Error('compute WebGPU indisponible');
 const module=device.createShaderModule({label:label+' boot_bake',code:program.compute});
 const entries=['motif_base','brdf_lut','mip_average',...(pbr?['material_base','mip_srgb']:[])];
 const pipelines=Object.fromEntries(await Promise.all(entries.map(async entryPoint=>[entryPoint,await device.createComputePipelineAsync({label:label+' '+entryPoint,layout:'auto',compute:{module,entryPoint}})])));
 const made=[],usage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_SRC;
 const make=(name,size,layers,format,levels,viewFormats)=>{const t=device.createTexture({label:label+' '+name,size:{width:size,height:size,depthOrArrayLayers:layers},format,mipLevelCount:levels,usage,...(viewFormats?{viewFormats}:{})});made.push(t);return t;};
 let query=null,resolve=null,read=null;const release=()=>{query?.destroy();resolve?.destroy();read?.destroy();};
 try{
  const motifs=make('motifs-mères',BAKE.motifSize,BAKE.motifs,'rgba8unorm',BAKE.motifLevels),lut=make('LUT BRDF',BAKE.lutSize,1,'rgba16float',1);
  // Le stockage n'accepte pas rgba8unorm-srgb, et une vue sRGB d'une texture de stockage demande une restriction d'usage
  // que tous les navigateurs n'ont pas : diff est cuit en rgba8unorm, mips compris, puis copié octet pour octet dans sa
  // texture sRGB finale, sans usage de stockage.
  const layers=pbr?[make('PBR diff (cuisson)',BAKE.pbrSize,BAKE.pbrLayers,'rgba8unorm',BAKE.pbrLevels),make('PBR nor_gl',BAKE.pbrSize,BAKE.pbrLayers,'rgba8unorm',BAKE.pbrLevels),make('PBR rough',BAKE.pbrSize,BAKE.pbrLayers,'rgba8unorm',BAKE.pbrLevels)]:null;
  const albedo=pbr?device.createTexture({label:label+' PBR diff',size:{width:BAKE.pbrSize,height:BAKE.pbrSize,depthOrArrayLayers:BAKE.pbrLayers},format:'rgba8unorm-srgb',mipLevelCount:BAKE.pbrLevels,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC}):null;if(albedo)made.push(albedo);
  const level=(t,mip)=>t.createView({dimension:'2d-array',baseMipLevel:mip,mipLevelCount:1}),steps=[];
  // Répartition déduite du groupe de travail de chaque point d'entrée, lu dans le manifeste : (⌈s/x⌉, ⌈s/y⌉, ⌈couches/z⌉).
  const workgroups=Object.fromEntries(program.entryPoints.map(e=>[e.name,e.workgroupSize]));
  const groups=(entry,size,count)=>{const [x,y,z]=workgroups[entry];return [Math.ceil(size/x),Math.ceil(size/y),Math.ceil(count/z)];};
  if(layers)steps.push(['material_base',layers.map((t,i)=>({binding:i+1,resource:level(t,0)})),groups('material_base',BAKE.pbrSize,BAKE.pbrLayers)]);
  steps.push(['motif_base',[{binding:0,resource:level(motifs,0)}],groups('motif_base',BAKE.motifSize,BAKE.motifs)],['brdf_lut',[{binding:6,resource:lut.createView({dimension:'2d'})}],groups('brdf_lut',BAKE.lutSize,1)]);
  // Chaque niveau lit le précédent : diff se moyenne en linéaire, comme le rendu sRGB des mips d'avant 0.3.40.
  const chain=(t,entry,size,levels,count)=>{for(let mip=1;mip<levels;mip++)steps.push([entry,[{binding:4,resource:level(t,mip-1)},{binding:5,resource:level(t,mip)}],groups(entry,Math.max(1,size>>mip),count)]);};
  if(layers){chain(layers[0],'mip_srgb',BAKE.pbrSize,BAKE.pbrLevels,BAKE.pbrLayers);for(const t of layers.slice(1))chain(t,'mip_average',BAKE.pbrSize,BAKE.pbrLevels,BAKE.pbrLayers);}
  chain(motifs,'mip_average',BAKE.motifSize,BAKE.motifLevels,BAKE.motifs);
  if(timestamps){query=device.createQuerySet({label:label+' boot_bake timestamps',type:'timestamp',count:2});resolve=device.createBuffer({label:label+' boot_bake resolve',size:16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});read=device.createBuffer({label:label+' boot_bake readback',size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});}
  const encoder=device.createCommandEncoder({label:label+' boot_bake'});
  const pass=encoder.beginComputePass({label:label+' boot_bake',...(query?{timestampWrites:{querySet:query,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}}:{})});
  for(const [entry,bindings,[x,y,z]] of steps){pass.setPipeline(pipelines[entry]);pass.setBindGroup(0,device.createBindGroup({label:label+' '+entry,layout:pipelines[entry].getBindGroupLayout(0),entries:bindings}));pass.dispatchWorkgroups(x,y,z);}
  pass.end();
  if(albedo)for(let mip=0;mip<BAKE.pbrLevels;mip++){const s=Math.max(1,BAKE.pbrSize>>mip);encoder.copyTextureToTexture({texture:layers[0],mipLevel:mip},{texture:albedo,mipLevel:mip},[s,s,BAKE.pbrLayers]);}
  if(query){encoder.resolveQuerySet(query,0,2,resolve,0);encoder.copyBufferToBuffer(resolve,0,read,0,16);}
  device.queue.submit([encoder.finish()]);
  // La texture de cuisson de diff n'a servi qu'à cette soumission ; la détruire n'affecte pas le travail déjà soumis.
  if(albedo){layers[0].destroy();made.splice(made.indexOf(layers[0]),1);}
  const gpuMs=read?read.mapAsync(GPUMapMode.READ).then(()=>{const [begin,end]=new BigUint64Array(read.getMappedRange());read.unmap();release();return end>begin?Number(end-begin)/1e6:null;},()=>{release();return null;}):Promise.resolve(null);
  return {motifs,lut,pbr:layers&&[albedo,layers[1],layers[2]],textures:made,dispatches:steps.length,entryPoints:entries,gpuMs,bytes:{motifs:bakeBytes(BAKE.motifSize,BAKE.motifLevels,BAKE.motifs,4),lut:bakeBytes(BAKE.lutSize,1,1,8),pbr:layers?3*bakeBytes(BAKE.pbrSize,BAKE.pbrLevels,BAKE.pbrLayers,4):0}};
 }catch(error){for(const t of made)t.destroy();release();throw error;}
}
const RESOLVE_DEPTH=`@group(0) @binding(0) var t:texture_depth_multisampled_2d;@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f{let p=vec2f(f32((i<<1u)&2u),f32(i&2u));return vec4f(p*2.-1.,0.,1.);}@fragment fn fs(@builtin(position) p:vec4f)->@builtin(frag_depth) f32{let q=vec2i(p.xy);return min(min(textureLoad(t,q,0),textureLoad(t,q,1)),min(textureLoad(t,q,2),textureLoad(t,q,3)));}`;
// The shader manifest specifies every std140 offset; arrays and integers never
// rely on JavaScript object order or WGSL's implicit padding.
function writeUniforms(target,fields,values){
 const floats=new Float32Array(target),ints=new Int32Array(target),uints=new Uint32Array(target);floats.fill(0);
 const list=Array.isArray(fields)?fields:Object.entries(fields||{}).map(([name,f])=>({name,...f}));
 for(const field of list){const value=values[field.name];if(value===undefined||value===null)continue;
  const type=field.type||'float',count=field.count||1,components=type==='mat4'?16:/[234]$/.test(type)?Number(type.slice(-1)):1,valuesArray=typeof value==='number'||typeof value==='boolean'?[Number(value)]:value;
  const arrayStride=(field.arrayStride||field.stride||components*4)/4,dst=(field.offset||0)/4,view=/^(i|int)/.test(type)?ints:/^(u|uint)/.test(type)?uints:floats;
  for(let item=0;item<count;item++)for(let k=0;k<components;k++)view[dst+item*arrayStride+k]=Number(valuesArray[item*components+k])||0;
 }
 return target;
}
// The manifest and the backing store are fixed for the lifetime of a program slot.
function uniformWriter(target, fields){
 const floats=new Float32Array(target),ints=new Int32Array(target),uints=new Uint32Array(target);
 const list=Array.isArray(fields)?fields:Object.entries(fields||{}).map(([name,f])=>({name,...f}));
 const layout=list.map(field=>{
  const type=field.type||'float',components=type==='mat4'?16:/[234]$/.test(type)?Number(type.slice(-1)):1;
  return {name:field.name,view:type.startsWith('i')?ints:type.startsWith('u')?uints:floats,
   offset:(field.offset||0)/4,stride:(field.arrayStride||field.stride||components*4)/4,count:field.count||1,components};
 });
 return values=>{
  floats.fill(0);
  for(const field of layout){
   const value=values[field.name];
   if(value==null)continue;
   if(typeof value==='number'||typeof value==='boolean'){
    field.view[field.offset]=Number(value)||0;
    continue;
   }
   for(let item=0;item<field.count;item++){
    const from=item*field.components,to=field.offset+item*field.stride;
    for(let k=0;k<field.components;k++)field.view[to+k]=Number(value[from+k])||0;
   }
  }
  return target;
 };
}
// Les scopes de validation sont empilés sur le GPUDevice, y compris entre deux moteurs.
const initializing=new WeakMap(), lossObservers=new WeakMap();
// Only hosts opting in promise that the list, material attributes and source
// arrays remain immutable. Visibility and projection still belong to each view.
const terrainDevices=new WeakMap();
function observeLoss(device,callback){
 let state=lossObservers.get(device);
 if(!state){
  state={observers:new Set(),info:null};lossObservers.set(device,state);
  device.lost.then(info=>{
   state.info=info;
   for(const observer of state.observers)observer(info);
   state.observers.clear();
  });
 }
 if(state.info){callback(state.info);return ()=>{};}
 state.observers.add(callback);
 return ()=>state.observers.delete(callback);
}
async function create(canvas,options={}){
 if(!G.navigator?.gpu)throw Error('WebGPU indisponible');
 const S=G.FRender?.shared,shaderSet=G.FRenderWebGPUShaders?.programs;if(!S||!shaderSet)throw Error('FERRO WebGPU modules incomplets');
 const shared=options.sharedGpu;
 if(shared&&(!shared.device||!shared.adapter))throw Error('FERRO WebGPU : périphérique partagé incomplet');
 const adapter=shared?shared.adapter:await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
 if(!adapter)throw Error('Aucun adaptateur WebGPU');
 const requested=['timestamp-query','float32-filterable','rg11b10ufloat-renderable'].filter(f=>adapter.features.has(f));
 const device=shared?shared.device:await adapter.requestDevice({requiredFeatures:requested});
 const features=requested.filter(f=>device.features.has(f));
 const previous=initializing.get(device);let unlock;
 const current=new Promise(resolve=>{unlock=resolve;});initializing.set(device,current);
 if(previous)await previous;
 let context,scope=false,removeObservers=()=>{},released=false,baking=null;
 function releaseDevice(){if(released)return;released=true;removeObservers();if(!shared)device.destroy();}
 let initializeCleanup=releaseDevice;
 try{
 if(lossObservers.get(device)?.info)throw Error('FERRO WebGPU : périphérique perdu');
 context=canvas.getContext('webgpu');if(!context)throw Error('Canvas WebGPU indisponible');
 device.pushErrorScope('validation');scope=true;
 // LOT 0.4 : la cuisson d'amorçage part dès l'ouverture de la portée d'erreurs et n'est attendue qu'en fin de création,
 // après la demande des pipelines de rendu : sa première compilation, avant le cache de Metal, chevauche la leur.
 const bank=options.materials||G.RADE?.materials,proceduralPbr=bank?.procedural===PBR_RECIPE;
 baking=bootBake(device,{pbr:proceduralPbr,timestamps:features.includes('timestamp-query')}).then(bake=>({bake}),error=>({error}));
 // LOT 0.3 : la scène est une radiance linéaire HDR ; seul post.wgsl écrit des valeurs affichées. Les reflets d'écran lisent
 // leur poids dans l'alpha de la scène : rgba16float avec reflets, sinon rg11b10ufloat (4 octets) quand le GPU sait y rendre.
 const canvasFormat=navigator.gpu.getPreferredCanvasFormat(),config=S.settings(options),format=!config.reflections&&features.includes('rg11b10ufloat-renderable')?'rg11b10ufloat':'rgba16float',depthFormat='depth32float',source=S.geometry(),governor=S.resolutionGovernor();
 const stats={backend:'webgpu',webglVersion:0,webgpu:true,contextLost:false,deviceLost:false,drawCalls:0,maskedDrawCalls:0,triangles:0,instances:0,uploadBytes:0,errorEvents:[],gpuTimingAvailable:features.includes('timestamp-query'),creations:0,sceneFormat:format,tonemap:config.tonemap,exposure:TONE_EXPOSURE[config.tonemap]*config.exposure,bloomLevels:0};
 let disposed=false,quality='auto',autoScale=1,runtimeMsaa=true,environment=null,world=[],lights=[],worldRevision=0,partitionState=null,worldIndex=S.spatialIndex([]),backgroundIndex=S.spatialIndex([]),chunks=new Map(),targets=null,shadowTarget=null,shadowLight=null,actorLightPlan=null;
 const buffers=new Set(),textures=new Set(),pipelines=new Map(),programs=new Map(),bindings=new Map(),samplers=new Map();
 initializeCleanup=()=>{disposed=true;try{context.unconfigure();}catch{}for(const b of buffers)b.destroy();for(const t of textures)t.destroy();buffers.clear();textures.clear();releaseDevice();};
 const view=new Float32Array(16),projection=new Float32Array(16),vp=new Float32Array(16),overlayProjection=new Float32Array(16),overlayVP=new Float32Array(16),relativeView=new Float32Array(16),shadowMatrices=new Float32Array(48),shadowViewMatrix=new Float32Array(16),shadowProjection=new Float32Array(16),shadowMatrix=new Float32Array(16);
 const lightPositions=new Float32Array(36),lightColors=new Float32Array(36),lightRanges=new Float32Array(12),lightDirections=new Float32Array(36),lightCones=new Float32Array(24);
 const foveaWorld=new Float32Array(4),foveaSsr=new Float32Array(4);
 const staticCaches=Array.from({length:5},()=>({entries:[],batch:S.pack([]),buffer:null,capacity:0})),dynamicSlot={},overlaySlot={},fxSlot={},overlayFxSlot={},crowdSlot={},pdrSlots=[];
 const overlayView=options.cullRigidOverlay?S.rigidOverlayView(source):null;
 const packDynamic=S.instancePacker(),packOverlay=S.instancePacker(),packFx=S.effectsPacker(),packOverlayFx=S.effectsPacker();
 const localWind=S.localWindState(),windFrame=localWind.frame,lotView=S.lotViewState(),colourRadii={horizontal:0,vertical:0},terrainView=S.terrainViewState(),vegetation=S.vegetationFrame(),vegetationState=vegetation.frame;
 const ordinary=[],overlay=[],particles=[],overlayParticles=[];
 let nappes=[],lots=[],lampCasters=[];const chunkCategories=new WeakMap(),chunkState={index:null,epoch:0};
 const gpu={device,adapter,context,format,canvasFormat,depthFormat,samples:config.msaa?4:1,generation:1,shadowView:null,config,vignette:config.vignette,lineaire:true};
 const onError=event=>{const message=event.error?.message||String(event.error);stats.errorEvents.push(message);if(stats.errorEvents.length>32)stats.errorEvents.shift();options.onError?.(event.error);};
 device.addEventListener('uncapturederror',onError);
 const stopLoss=observeLoss(device,info=>{stats.contextLost=stats.deviceLost=true;if(!disposed)options.onDeviceLost?.(info);});
 removeObservers=()=>{device.removeEventListener?.('uncapturederror',onError);stopLoss();};
 // stats.creations : tampons, textures et pipelines créés pendant draw (le préchauffage compte à part, warm.creations).
 let counting=false,retained=false,warm=null;
 function created(n){if(counting)stats.creations+=n;else if(warm)warm.creations+=n;}
 function buffer(data,usage,label){const size=Math.max(4,align(typeof data==='number'?data:data.byteLength)),b=device.createBuffer({label,size,usage:usage|GPUBufferUsage.COPY_DST});buffers.add(b);created(1);if(typeof data!=='number'&&data.byteLength)device.queue.writeBuffer(b,0,data);return b;}
 function freeBuffer(b){if(b){buffers.delete(b);b.destroy();}}
 function texture(width,height,texFormat=format,sampleCount=1,layers=1,mipLevelCount=1,label='FERRO texture'){
  const t=device.createTexture({label,size:{width,height,depthOrArrayLayers:layers},format:texFormat,sampleCount,mipLevelCount,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|(sampleCount===1?GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST:0)});textures.add(t);created(1);return {texture:t,view:t.createView({dimension:layers>1?'2d-array':'2d'}),width,height,format:texFormat,sampleCount,layers,mipLevelCount};
 }
 function freeTexture(t){if(t){textures.delete(t.texture);t.texture.destroy();}}
 function sampler(kind='linear'){if(!samplers.has(kind))samplers.set(kind,device.createSampler(kind==='comparison'?{compare:'less-equal',magFilter:'linear',minFilter:'linear'}:kind==='pbr'?{addressModeU:'repeat',addressModeV:'repeat',magFilter:'linear',minFilter:'linear',mipmapFilter:'linear',maxAnisotropy:8}:kind==='nearest'?{magFilter:'nearest',minFilter:'nearest',mipmapFilter:'nearest'}:{magFilter:'linear',minFilter:'linear',mipmapFilter:'linear'}));return samplers.get(kind);}
 const registeredIndexing=options.indexRegisteredShapes===true;
 const primitiveIndexing=options.indexPrimitives===true||registeredIndexing?S.indexPrimitiveVertices(source,registeredIndexing):null;
 stats.primitiveIndexing=!!primitiveIndexing;stats.primitiveIndexStats=primitiveIndexing?.stats||null;
 const groundIndex=S.groundCoverGeometry(source,primitiveIndexing?.indices||source.indices);stats.groundCoverIndex=groundIndex.stats;
 const vbo=buffer(source.vertices,GPUBufferUsage.VERTEX,'FERRO geometry'),ibo=buffer(groundIndex.indices,GPUBufferUsage.INDEX,'FERRO indices');
 const white=texture(1,1,'rgba8unorm'),whiteDepth=texture(1,1,depthFormat);device.queue.writeTexture({texture:white.texture},new Uint8Array([255,255,255,255]),{},[1,1]);
 gpu.shadowView=whiteDepth.view;
 const clear=device.createCommandEncoder();clear.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:whiteDepth.view,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}}).end();device.queue.submit([clear.finish()]);
 const copyModule=device.createShaderModule({label:'FERRO texture copy/mipmap',code:COPY}),depthResolveModule=device.createShaderModule({label:'FERRO MSAA depth resolve',code:RESOLVE_DEPTH});
 const copyLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}}]}),copyPipelineLayout=device.createPipelineLayout({bindGroupLayouts:[copyLayout]});
 const copyPipelines=new Map(),copyBindings=new WeakMap();
 function copyPipeline(targetFormat){if(!copyPipelines.has(targetFormat)){copyPipelines.set(targetFormat,device.createRenderPipeline({label:'FERRO copy '+targetFormat,layout:copyPipelineLayout,vertex:{module:copyModule,entryPoint:'vs'},fragment:{module:copyModule,entryPoint:'fs',targets:[{format:targetFormat}]},primitive:{topology:'triangle-list'}}));created(1);}return copyPipelines.get(targetFormat);}
 function copyBind(view){let group=copyBindings.get(view);if(!group){group=device.createBindGroup({layout:copyLayout,entries:[{binding:0,resource:view},{binding:1,resource:sampler()}]});copyBindings.set(view,group);}return group;}
 const depthResolvePipeline=device.createRenderPipeline({label:'FERRO MSAA depth resolve',layout:'auto',vertex:{module:depthResolveModule,entryPoint:'vs'},fragment:{module:depthResolveModule,entryPoint:'fs',targets:[]},primitive:{topology:'triangle-list'},depthStencil:{format:depthFormat,depthWriteEnabled:true,depthCompare:'always'}});
 async function loadProgram(name){const d=shaderSet[name==='world'&&options.ombresPhoto?'worldPhoto':name];if(!d)throw Error('Shader WebGPU absent : '+name);const vertex=device.createShaderModule({label:'FERRO '+name+(d.fragment===d.vertex?'':' vertex'),code:d.vertex}),fragment=d.fragment===d.vertex?vertex:d.fragment?device.createShaderModule({label:'FERRO '+name+' fragment',code:d.fragment}):null,fragmentMasked=d.fragmentMasked?device.createShaderModule({label:'FERRO '+name+' masked fragment',code:d.fragmentMasked}):null;
  for(const module of new Set([vertex,fragment,fragmentMasked].filter(Boolean))){const info=await module.getCompilationInfo();const errors=info.messages.filter(x=>x.type==='error');if(errors.length)throw Error(name+': '+errors.map(x=>x.lineNum+':'+x.message).join('\n'));}
  const entries=[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform',minBindingSize:d.uniforms.byteLength}}];
  for(const t of d.textures||[]){entries.push({binding:t.binding,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:t.sampleType||'float',viewDimension:t.dimension||'2d',multisampled:false}});if(t.samplerBinding!==undefined)entries.push({binding:t.samplerBinding,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:t.samplerType|| (t.sampleType==='depth'?'non-filtering':'filtering')}});}
  const layout=device.createBindGroupLayout({label:'FERRO '+name+' bindings',entries}),pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});const p={name,descriptor:d,vertex,fragment,fragmentMasked,layout,pipelineLayout};programs.set(name,p);return p;
 }
 const loaded=await Promise.allSettled(['world','depth','sky','fx','post','ssr'].map(loadProgram));
 for(const result of loaded)if(result.status==='rejected')throw result.reason;
 function pipeline(name,{samples=gpu.samples,background=false,overlay=false,nappe=false,front=false,target=format,masked=false}={}){
  const key=[name,samples,background,overlay,nappe,front,target,masked].join(':');if(pipelines.has(key))return pipelines.get(key);const p=programs.get(name),mesh=name==='world'||name==='depth'||name==='fx',depth=name==='depth',blend=name==='fx'?{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'}}:undefined;
  const descriptor={label:'FERRO '+key,layout:p.pipelineLayout,vertex:{module:p.vertex,entryPoint:p.descriptor.vertexEntryPoint||'main',buffers:mesh?(nappe==='rigid'?RIGID_TERRAIN:nappe?[GEOMETRY[0],{...GEOMETRY[1],stepMode:'vertex'}]:GEOMETRY):[]},primitive:{topology:'triangle-list',frontFace:'ccw',cullMode:front?'front':(mesh&&!nappe)?'back':'none'},multisample:{count:samples}};
  // LOT 0.2 : le fragment opaque du monde n'a aucun discard ; la profondeur opaque n'a pas d'étage fragment.
  const fragment=masked&&p.fragmentMasked?p.fragmentMasked:p.fragment;
  if(fragment)descriptor.fragment={module:fragment,entryPoint:p.descriptor.fragmentEntryPoint||'main',targets:depth?[]:[{format:target,...(blend?{blend}:{})}]};
  if(mesh||name==='sky')descriptor.depthStencil={format:depthFormat,depthWriteEnabled:mesh&&name!=='fx'&&!background,depthCompare:background||name==='sky'?'always':'less-equal',...(depth?{depthBias:2,depthBiasSlopeScale:1.1}:{})};
  const result=device.createRenderPipeline(descriptor);created(1);pipelines.set(key,result);return result;
 }
 // Élargissement du halo : le niveau inférieur s'ajoute au niveau courant ; l'alpha (tuiles de reflet) est conservé.
 let additivePost=null;
 function postAdditive(){
  if(!additivePost){const p=programs.get('post');additivePost=device.createRenderPipeline({label:'FERRO post additive '+format,layout:p.pipelineLayout,vertex:{module:p.vertex,entryPoint:p.descriptor.vertexEntryPoint||'main'},fragment:{module:p.fragment,entryPoint:p.descriptor.fragmentEntryPoint||'main',targets:[{format,blend:{color:{srcFactor:'one',dstFactor:'one',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}]},primitive:{topology:'triangle-list'}});created(1);}
  return additivePost;
 }
 // Seuils historiques du halo (valeurs affichées) ramenés en radiance exposée par l'inverse exact de la courbe de 0.3.38.
 const bloomKnee=config.bloom.map(d=>{const x=Math.pow(Math.min(d,.999),2.2);return .76*x/(1-x);});
 function toneSettings(fx){const name=Object.hasOwn(TONEMAPS,fx.tonemap)?fx.tonemap:config.tonemap,user=Number.isFinite(fx.exposure)&&fx.exposure>0?Math.min(16,fx.exposure):config.exposure;return {name,index:TONEMAPS[name],exposure:TONE_EXPOSURE[name]*user};}
 function bind(name,slot,values,textureValues={}){
  if(name==='world'||name==='depth'){values.uWindStrength=vegetationState.strength;values.uGroundCoverEye=vegetationState.eye;values.uGroundCoverDensity=vegetationState.density;values.uGroundCoverRange=vegetationState.range;}
  const p=programs.get(name),d=p.descriptor,key=name+':'+slot;let b=bindings.get(key);
  if(!b){
   const data=new ArrayBuffer(d.uniforms.byteLength),uniform=buffer(data,GPUBufferUsage.UNIFORM,key);
   const entries=[{binding:0,resource:{buffer:uniform,size:d.uniforms.byteLength}}];
   const textures=(d.textures||NONE).map(t=>{
    const view={binding:t.binding,resource:null};entries.push(view);
    const sampling=t.samplerBinding===undefined?null:{binding:t.samplerBinding,resource:null};
    if(sampling)entries.push(sampling);
    const fallback=sampling&&sampler(t.samplerType==='comparison'?'comparison':t.samplerType==='non-filtering'||t.sampleType==='depth'?'nearest':t.name.startsWith('uPbr')?'pbr':'linear');
    return {name:t.name,view,sampling,fallback,texture:t.sampleType==='depth'?whiteDepth:white};
   });
   b={data,uniform,write:uniformWriter(data,d.uniforms.fields),entries,textures,group:null};bindings.set(key,b);
  }
  b.write(values);device.queue.writeBuffer(b.uniform,0,b.data);stats.uniformUploadBytes=(stats.uniformUploadBytes||0)+b.data.byteLength;
  let changed=!b.group;
  for(const t of b.textures){
   const value=textureValues[t.name]||t.texture,view=value.view||value;
   if(t.view.resource!==view){t.view.resource=view;changed=true;}
   if(t.sampling){const s=value.sampler||t.fallback;if(t.sampling.resource!==s){t.sampling.resource=s;changed=true;}}
  }
  if(changed)b.group=device.createBindGroup({label:key,layout:p.layout,entries:b.entries});
  return b.group;
 }
 // LOT 0.4 : cuisson d'amorçage (motifs-mères, LUT de BRDF). Une banque de FMaterials n'est plus dessinée dans des canvas :
 // boot_bake.wgsl écrit ses couches PBR et leurs mips ; une banque d'hôte garde le chemin des images. Sans compute (faux
 // périphériques des essais), la cuisson s'efface et la banque de FMaterials est chargée puis envoyée comme en 0.3.39.
 // Seul draw lit pbr et pbrReady : settleMaterials les remplit à la fin de create.
 const pbr=[];let pbrReady=0;
 stats.bootBake={pbr:'none',motifs:0,motifSize:BAKE.motifSize,motifLevels:BAKE.motifLevels,slopeGain:SLOPE_GAIN,lutSize:BAKE.lutSize,dispatches:0,bytes:null,gpuMs:null,error:null};
 async function settleMaterials(){
 const {bake=null,error}=await baking;if(error)stats.bootBake.error=String(error?.message||error).slice(0,200);
 if(bake){
  for(const t of bake.textures)textures.add(t);created(bake.textures.length);
  Object.assign(stats.bootBake,{motifs:BAKE.motifs,dispatches:bake.dispatches,bytes:bake.bytes});bake.gpuMs.then(ms=>{stats.bootBake.gpuMs=ms;});
  gpu.motifs={texture:bake.motifs,view:bake.motifs.createView({dimension:'2d-array'}),layers:BAKE.motifs,size:BAKE.motifSize,levels:BAKE.motifLevels,format:'rgba8unorm',slopeGain:SLOPE_GAIN};
  gpu.brdfLut={texture:bake.lut,view:bake.lut.createView({dimension:'2d'}),size:BAKE.lutSize,format:'rgba16float'};
 }
 if(bake?.pbr){
  for(const t of bake.pbr)pbr.push({texture:t,view:t.createView({dimension:'2d-array'}),width:BAKE.pbrSize,height:BAKE.pbrSize,format:t.format,sampleCount:1,layers:BAKE.pbrLayers,mipLevelCount:BAKE.pbrLevels});
  pbrReady=1;stats.pbrLayers=BAKE.pbrLayers;stats.bootBake.pbr='gpu';
 }else{
 if(proceduralPbr&&!bank.layers.length)await bank.load();
 // Same mathematically generated texture layers as WebGL, including all mip levels.
 const layers=options.materials?.layers||G.RADE?.materials?.layers||[],pbrSize=layers[0]?.diff.width||1;
 for(const [index,kind]of ['diff','nor_gl','rough'].entries()){
  const levels=Math.floor(Math.log2(pbrSize))+1,t=texture(pbrSize,pbrSize,index===0?'rgba8unorm-srgb':'rgba8unorm',1,Math.max(1,layers.length),levels,'FERRO procedural PBR '+kind);t.view=t.texture.createView({dimension:'2d-array'});pbr.push(t);
  if(layers.length){for(let layer=0;layer<layers.length;layer++)device.queue.copyExternalImageToTexture({source:layers[layer][kind]},{texture:t.texture,origin:[0,0,layer]},[pbrSize,pbrSize]);const enc=device.createCommandEncoder();for(let layer=0;layer<layers.length;layer++)for(let mip=1;mip<levels;mip++){const src=t.texture.createView({dimension:'2d',baseArrayLayer:layer,arrayLayerCount:1,baseMipLevel:mip-1,mipLevelCount:1}),dst=t.texture.createView({dimension:'2d',baseArrayLayer:layer,arrayLayerCount:1,baseMipLevel:mip,mipLevelCount:1});const pass=enc.beginRenderPass({colorAttachments:[{view:dst,loadOp:'clear',clearValue:[0,0,0,1],storeOp:'store'}]});pass.setPipeline(copyPipeline(t.format));pass.setBindGroup(0,copyBind(src));pass.draw(3);pass.end();}device.queue.submit([enc.finish()]);}
  else device.queue.writeTexture({texture:t.texture},new Uint8Array([128,128,255,255]),{},[1,1]);
 }
 pbrReady=layers.length?1:0;stats.pbrLayers=layers.length;stats.bootBake.pbr=layers.length?'images':'none';
 }
 }
 // Un flux qui grandit double sa capacité : pas de nouveau tampon à chaque image où le nombre d'instances monte.
 // LOT 0.2 de FERRO 0.4 : le pipeline opaque du monde n'a aucun discard (test de profondeur anticipé et élimination
 // des surfaces cachées). Un groupe d'instances passe au pipeline masqué si l'une d'elles peut rejeter des fragments,
 // selon les mêmes règles que les nuanceurs : prairie (drapeau 16), fondu d'opacité (marqueur hors de [0,1]), plan de
 // mer troué (matières 11,5 à 12,1) ; en profondeur, la mer animée (12,1 à 12,4) au lieu des plans troués. Le
 // classement est fait à l'envoi des instances et rangé dans l'emplacement ; les groupes de l'hôte ne sont pas modifiés.
 function classifyMasks(slot,batch){
  const groups=batch.groups||NONE,values=batch.values,n=groups.length;
  if(!slot.maskColor||slot.maskColor.length<n){slot.maskColor=new Uint8Array(Math.max(8,n));slot.maskDepth=new Uint8Array(slot.maskColor.length);}
  let any=0;
  for(let i=0;i<n;i++){
   const g=groups[i],first=g.offset>>2,end=first+g.count*16;let color=0,depth=0;
   for(let at=first;at<end;at+=16){
    const flags=values[at+11],marker=values[at+15],m=values[at+3];
    if(marker>1||marker<0||(flags&16)){color=depth=1;break;}
    if(m>=11.5&&m<12.1)color=1;else if(m>12.1&&m<12.4)depth=1;
    if(color&&depth)break;
   }
   slot.maskColor[i]=color;slot.maskDepth[i]=depth;any|=color|depth;
  }
  slot.maskBatch=batch;slot.masked=any;
 }
 // Phase opaque : les groupes masqués sont différés dans une file réutilisée ; flushMasked les trace ensuite seuls sur
 // le pipeline masqué de la même passe. Hors phase, tout se trace sur le pipeline courant, comme avant 0.3.38.
 let maskPhase=false,maskDrawing=false,maskCount=0;const maskPool=[];
 function deferMasked(kind,a,b,c,d){const r=maskPool[maskCount]||(maskPool[maskCount]={kind:0,a:null,b:null,c:null,d:null});r.kind=kind;r.a=a;r.b=b;r.c=c;r.d=d;maskCount++;}
 function beginOpaque(){maskPhase=true;maskCount=0;}
 function flushMasked(pass,name,variant){
  maskPhase=false;if(!maskCount)return;
  const main=pipeline(name,{...variant,masked:true}),before=stats.drawCalls;maskDrawing=true;pass.setPipeline(main);
  try{
   for(let i=0;i<maskCount;i++){
    const r=maskPool[i];
    if(r.kind===0)renderBatch(pass,r.a,r.b,r.c,r.d);
    else if(r.kind===1)renderGroundCover(pass,r.a,r.b,r.c,r.d);
    else if(r.kind===2){pass.setPipeline(pipeline(name,{...variant,nappe:r.a.rigid?'rigid':true,masked:true}));drawNappe(pass,r.a);pass.setPipeline(main);}
    else warmCoverSubsets(pass,r.a,r.b);
    r.a=r.b=r.c=r.d=null;
   }
  }finally{maskDrawing=false;maskCount=0;stats.maskedDrawCalls+=stats.drawCalls-before;}
 }
 function ensureSlot(slot,batch,update=true){const required=Math.max(4,batch.values.byteLength);if(!slot.buffer||slot.capacity<required){const size=slot.buffer?Math.max(required,slot.capacity*2):required;freeBuffer(slot.buffer);slot.buffer=buffer(size,GPUBufferUsage.VERTEX,'FERRO instances');slot.capacity=align(size);update=true;}if(update&&batch.values.byteLength){device.queue.writeBuffer(slot.buffer,0,batch.values);stats.uploadBytes+=batch.values.byteLength;}if(update||slot.maskBatch!==batch)classifyMasks(slot,batch);slot.batch=batch;return slot;}
 function renderBatch(pass,batch,storage,shadow=false,excludeNear=false){
  if(!batch?.groups?.length)return;
  if(storage.maskBatch!==batch)classifyMasks(storage,batch);
  const masks=shadow?storage.maskDepth:storage.maskColor;let deferred=false;
  pass.setVertexBuffer(0,vbo);pass.setIndexBuffer(ibo,'uint32');
  for(let i=0;i<batch.groups.length;i++){
   const group=batch.groups[i],count=group.count-(excludeNear?(group.near||0):0);if(!count)continue;
   if(maskDrawing){if(!masks[i])continue;}else if(maskPhase&&masks[i]){deferred=true;continue;}
   const shape=source.ranges[group.name];if(!shape)throw Error('Forme WebGPU inconnue : '+group.name);
   pass.setVertexBuffer(1,storage.buffer,group.offset,count*64);pass.drawIndexed(shape.count,count,shape.offset/4,0,0);
   stats.drawCalls++;stats.triangles+=shape.count/3*count;if(!shadow)stats.instances+=count;
  }
  if(deferred)deferMasked(0,batch,storage,shadow,excludeNear);
 }
 // Les prairies rejettent leurs brins éteints : elles passent toujours au pipeline masqué.
 function renderGroundCover(pass,plan,near,far,shadow){if(maskPhase&&!maskDrawing){deferMasked(1,plan,near,far,shadow);return;}pass.setVertexBuffer(0,vbo);pass.setIndexBuffer(ibo,'uint32');for(let i=0;i<plan.count;i++){const at=i*4,group=plan.groups[plan.runs[at]],mode=plan.runs[at+1],first=plan.runs[at+2],count=plan.runs[at+3],shape=mode?group.nearIndex.ranges[mode-1]:source.ranges[group.far.name],slot=mode?near:far;if(!shape.count)continue;pass.setVertexBuffer(1,slot.buffer,first*64,count*64);pass.drawIndexed(shape.count,count,shape.offset/4,0,0);stats.drawCalls++;stats.triangles+=shape.count/3*count;if(!shadow)stats.instances+=count;}}
 function renderStatic(pass,entries,slot,shadow=false){const cache=staticCaches[slot],same=cache.entries.length===entries.length&&entries.every((e,i)=>e===cache.entries[i]);if(!same){cache.entries=entries;cache.batch=S.packIndexed(entries);}ensureSlot(cache,cache.batch,!same);renderBatch(pass,cache.batch,cache,shadow);}
 function rebuildChunks(){const next=S.planChunks(worldIndex,chunks,chunkCategories,chunkState);
  let uploads=0;for(const [key,g]of next){if(!g.nextEntries&&g.nextCount===g.entries.length)continue;const c={range:g.range,entries:g.nextEntries||g.entries.slice(0,g.nextCount),min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const e of c.entries)for(let k=0;k<3;k++){c.min[k]=Math.min(c.min[k],e.p[k]-e.radius);c.max[k]=Math.max(c.max[k],e.p[k]+e.radius);}c.p=c.min.map((v,k)=>(v+c.max[k])/2);c.radius=Math.hypot(...c.max.map((v,k)=>(v-c.min[k])/2));c.batch=S.packIndexed(c.entries);ensureSlot(c,c.batch);uploads+=c.batch.values.byteLength;next.set(key,c);}for(const [key,c]of chunks)if(next.get(key)!==c)freeBuffer(c.buffer);chunks=next;stats.chunks=chunks.size;stats.chunkBuildBytes=uploads;stats.chunkUpdateIncremental=chunkState.incremental;stats.chunkEntriesVisited=chunkState.entriesVisited;
 }
 function drawChunks(pass,accept,shadow=false){let objects=0,count=0;for(const c of chunks.values())if(accept(c)){renderBatch(pass,c.batch,c,shadow);objects+=c.entries.length;count++;}if(shadow){stats.shadowChunks=count;stats.shadowStatic=objects;}else{stats.visibleChunks=count;stats.staticVisible=objects;stats.staticCulled=world.length-objects;}return count;}
 function setWorld(meshes,points,atmosphere,setOptions){localWind.reset();const partition=partitionState=S.partitionWorld(meshes);environment=S.environmentInfo(atmosphere);world=partition.world;worldIndex=S.spatialIndex(world,environment,undefined,setOptions);backgroundIndex=S.spatialIndex(partition.background,environment,undefined,setOptions);lights=points||[];shadowLight=null;actorLightPlan=null;worldRevision=0;stats.worldRevision=0;stats.staticTotal=world.length+backgroundIndex.entries.length;stats.biome=environment?.biome||null;rebuildChunks();lampCasters=[];for(const cache of staticCaches){cache.entries=[];cache.batch=S.pack([]);}ordinary.length=overlay.length=particles.length=overlayParticles.length=0;packFx([],null,[0,0,0]);packOverlayFx([],null,[0,0,0]);for(const slot of pdrSlots)if(slot){slot.lot=null;slot.batch=null;slot.version=NaN;}governor.reset();autoScale=1;}
 function updateWorld(meshes,revision,points,updateOptions){if(disposed||revision===worldRevision)return false;if(Array.isArray(points)&&(points.length!==lights.length||points.some((l,i)=>l!==lights[i]))){lights=points;if(!lights.includes(shadowLight))shadowLight=null;}const partition=partitionState=S.partitionWorld(meshes,partitionState,updateOptions),indexOptions=partition.meshDelta?{...updateOptions,meshDelta:partition.meshDelta}:updateOptions;world=partition.world;worldIndex=S.spatialIndex(world,environment,worldIndex,indexOptions);if(!partition.meshDelta)backgroundIndex=S.spatialIndex(partition.background,environment,backgroundIndex,updateOptions);stats.meshDeltaApplied=!!worldIndex.delta.fast;rebuildChunks();lampCasters=[];actorLightPlan=null;for(const cache of staticCaches.slice(0,4)){cache.entries=[];cache.batch=S.pack([]);}worldRevision=revision===undefined?worldRevision+1:revision;stats.worldRevision=worldRevision;stats.staticTotal=world.length+backgroundIndex.entries.length;return true;}
 function uploadShapeIndices(offset,indices){device.queue.writeBuffer(ibo,offset,indices);}
 function updateShape(name,vertices){
  const range=source.ranges[name];
  if(!range||vertices.length!==range.count*6)throw Error('Shape vertex count changed: '+name);
  const restored=primitiveIndexing?.restore(name);
  groundIndex.invalidate(name,restored,stats.primitiveIndexing&&!stats.contextLost?uploadShapeIndices:null);
  const start=source.indices[range.offset/4]*6;source.vertices.set(vertices,start);overlayView?.invalidate(name);
  if(!stats.contextLost)device.queue.writeBuffer(vbo,start*4,vertices);
 }
 // Diagnostic A/B on the same poses, uniforms and GPU resources. A primitive
 // changed by updateShape stays expanded even when indexing is re-enabled.
 function setPrimitiveIndexing(enabled){enabled=enabled===true;if(disposed||stats.contextLost||enabled===stats.primitiveIndexing)return stats.primitiveIndexing;const base=enabled?primitiveIndexing.indices:source.indices;device.queue.writeBuffer(ibo,0,registeredIndexing?groundIndex.select(base):base);stats.primitiveIndexing=enabled;return enabled;}
 const terrainConstants=[];
 function terrainConstant(tint,constants,allocate){
  if(!constants[tint])constants[tint]=allocate(new Float32Array([1,1,1,0,0,0,0,tint?98:66,0,0,0,1]),GPUBufferUsage.VERTEX,'FERRO terrain constants');
  return constants[tint];
 }
 let terrainLease=null;
 function releaseTerrain(){
  if(terrainLease){
   const t=terrainLease;terrainLease=null;
   if(--t.views===0){t.cache.delete(t.list);for(const b of t.owned)b.destroy();}
  }else for(const n of nappes){freeBuffer(n.vertex);freeBuffer(n.instance);freeBuffer(n.index);}
  nappes=[];
 }
 function setNappes(list,options){
  releaseTerrain();let triangles=0;
  stats.nappeSharedBytes=0;
  const share=options?.immutable===true && Array.isArray(list);
  if(share){
   let cache=terrainDevices.get(device);if(!cache){cache=new WeakMap();terrainDevices.set(device,cache);}
   const t=cache.get(list);
   if(t){terrainLease=t;t.views++;nappes=t.nappes;terrainView.reset(nappes,options?.staticBounds===true);stats.nappeTriangles=t.triangles;stats.nappeSharedBytes=t.bytes;return;}
   terrainLease={cache,list,views:1,owned:[],bytes:0,nappes,triangles:0};
  }
  const allocate=(data,usage,label)=>{
   const b=buffer(data,usage,label);
   if(share){terrainLease.owned.push(b);terrainLease.bytes+=align(data.byteLength);buffers.delete(b);}
   return b;
  };
  const constants=share?[]:terrainConstants;
  try{
  let listIndex=-1;
  for(const n of list||[]){
   listIndex++;
   if(!n?.sommets||!n.indices?.length)continue;
   const data=n.sommets,count=data.length/13,rigid=S.rigidTerrainVertices(data),smooth=n.vertexTint==='smooth';
   const vertices=new Float32Array(count*(rigid?10:6));
   let instance=null,constant=null;
   if(rigid){
    S.writeRigidTerrain(vertices,0,data);constant=terrainConstant(smooth?1:0,constants,allocate);
   }else{
    const instances=new Float32Array(count*16);
    for(let i=0;i<count;i++){
     const src=i*13,vertex=i*6,row=i*16;
     for(let k=0;k<6;k++)vertices[vertex+k]=data[src+k];
     for(let k=0;k<4;k++)instances[row+k]=data[src+6+k];
     instances[row+4]=instances[row+5]=instances[row+6]=1;
     instances[row+11]=smooth?34:2;
     instances[row+12]=data[src+10];instances[row+13]=data[src+11];instances[row+14]=data[src+12];instances[row+15]=1;
    }
    instance=allocate(instances,GPUBufferUsage.VERTEX,'FERRO terrain materials');
   }
   const index=n.indices instanceof Uint32Array?n.indices:new Uint32Array(n.indices);
   let masked=false;if(!rigid)for(let i=9;i<data.length;i+=13)if(data[i]>=11.5&&data[i]<12.1){masked=true;break;}
   nappes.push({...n,sourceIndex:listIndex,rigid,masked,vertex:allocate(vertices,GPUBufferUsage.VERTEX,'FERRO terrain vertices'),constant,instance,index:allocate(index,GPUBufferUsage.INDEX,'FERRO terrain indices')});
   triangles+=index.length/3;
  }
  terrainView.reset(nappes,options?.staticBounds===true);stats.nappeTriangles=triangles;
  if(share){terrainLease.triangles=triangles;terrainLease.cache.set(list,terrainLease);}
  }catch(e){releaseTerrain();terrainView.reset();throw e;}
 }
 // The spatial index uses the source bounds. Buffers, plans and their lifetime belong to this device.
 let lotSlots=[],lotInputSlots=[],progressiveLots=false,lotCursor=0,lotEnvironment=null;
 function releaseLot(slot){
  freeBuffer(slot.near?.buffer);
  freeBuffer(slot.far?.buffer);
  slot.near=slot.far=slot.groundPlan=null;
  slot.ready=false;
 }
 function releaseLots(){
  for(const slot of lotSlots)releaseLot(slot);
  lots=[];lotSlots=[];lotInputSlots=[];lotCursor=0;lotEnvironment=null;
  lotView.reset();
 }
 function uploadLot(slot,farOnly=false){
  if(slot.ready||disposed||stats.contextLost)return false;
  const source=slot.source;
  if(farOnly&&!source.groundCover&&(source.loin?.length||source.detailLointain)){
   if(slot.far)return false;
   const objects=source.preparerLoin?.()||source.loin;
   if(objects.length){
    const far=S.pack(objects,lotEnvironment);
    slot.far=ensureSlot({},far);
    return true;
   }
  }
  const detail=source.preparerDetail?.(),lot=detail?.objets?detail:source;
  let near=lot.paquet;
  if(lot.objets)near=!progressiveLots||lot.objets.length?S.pack(lot.objets,lotEnvironment):null;
  const far=slot.far?.batch||(lot.loin?.length?S.pack(lot.loin,lotEnvironment):lot.paquetLoin);
  try{
   if(near&&(!progressiveLots||near.values.byteLength)){slot.near={};ensureSlot(slot.near,near);}
   if(!slot.far&&far&&(!progressiveLots||far.values.byteLength)){slot.far={};ensureSlot(slot.far,far);}
   slot.groundPlan=S.groundCoverPlan(source,near,far,groundIndex);
  }catch(error){
   releaseLot(slot);
   throw error;
  }
  slot.ready=true;slot.used=lotView.frame;
  return !!(slot.near||slot.far);
 }
 function preparerLot(index,farOnly=false){
  if(!Number.isInteger(index)||index<0||disposed||stats.contextLost)return false;
  const slot=lotInputSlots[index];
  if(!slot)return false;
  slot.used=lotView.frame;
  return uploadLot(slot,farOnly);
 }
 function setLots(list,options){
  if(disposed)return;
  if(photo?.far&&(!list||list.length!==photo.far.lots.length||list.some((l,i)=>l!==photo.far.lots[i])))precalculerOmbre(null);
  releaseLots();
  progressiveLots=options?.progressif===true;
  lotEnvironment=environment;
  const input=list||[];
  for(let i=0;i<input.length;i++){
   const l=input[i];
   if(!l?.objets&&!l?.paquet?.values&&typeof l?.preparerDetail!=='function')continue;
   const slot={source:l,inputIndex:i,ready:false,near:null,far:null,groundPlan:null,used:0};
   // The eager view keeps its original snapshot of descriptor properties.
   lots.push(progressiveLots?l:{...l});lotSlots.push(slot);lotInputSlots[i]=slot;
   if(!progressiveLots)uploadLot(slot);
  }
  lotView.reset(lots,options?.staticBounds===true);stats.lots=lots.length;
 }
 function evictIdleLots(){
  if(!progressiveLots||warm)return;
  const count=Math.min(12,lotSlots.length),now=lotView.frame;
  for(let i=0;i<count;i++){
   const slot=lotSlots[lotCursor++];
   if(lotCursor===lotSlots.length)lotCursor=0;
   if((slot.near||slot.far)&&now-slot.used>300)releaseLot(slot);
  }
 }
 function renderLots(pass,eye,axes,h,v,far,accept,radii,masqueLots){
  let count=0;
  for(const entry of lotView.candidates(accept,axes,h,v,far,radii)){
   const l=entry.lot,slot=lotSlots[entry.index];
   if(!accept&&masqueLots&&masqueLots[slot.inputIndex]){stats.lotsOccultes++;continue;}
   if(entry.cover&&entry.distance>entry.range)continue;
   if(accept?l.ombre===false||!accept(entry.bounds):entry.distance>Math.min(far,entry.range)||!S.visible(entry.bounds,eye,axes,h,v,far,radii))continue;
   if(l.detailProcheSeul&&!entry.near)continue;
   if(!slot.ready)uploadLot(slot,!entry.near);
   const plan=entry.cover&&slot.groundPlan,fresh=plan&&plan.frame!==lotView.frame;
   if(plan&&S.prepareGroundCover(plan,entry,lotView.frame,vegetationState.eye,vegetationState)){
    if(fresh)stats.lotInstanceTests+=plan.tested;
    if(plan.count){renderGroundCover(pass,plan,slot.near,slot.far,!!accept);slot.used=lotView.frame;count++;}
    continue;
   }
   const model=!slot.far||entry.near?slot.near:slot.far;
   if(model){renderBatch(pass,model.batch,model,!!accept);slot.used=lotView.frame;count++;}
  }
  stats.lotDistanceTests=lotView.distanceTests;return count;
 }
 function freeTargets(){
  if(!targets)return;
  for(const t of Object.values(targets))if(t?.texture)freeTexture(t);
  targets=null;
  for(const entry of bindings.values()){
   entry.group=null;
   for(const t of entry.textures)t.view.resource=null;
  }
 }
 const nativeSurface=options.resolution==='native'&&G.FSurface
  ? G.FSurface.create(canvas,{limit:(device.limits?.maxTextureDimension2D||8192),maxPixels:options.maxPixels,scale:options.renderScale}):null;
 if(nativeSurface)stats.native=nativeSurface.stats;
 const surfaceBudget=nativeSurface?G.FSurface.budget({target:60,onBudget:options.onBudget}):null;
 let runtimeShadowScale=config.shadowMapScale,runtimeMaxPixels=options.maxPixels>0?options.maxPixels:0;
 const bloomEnabled=fx=>quality!=='low'&&fx.bloom!==false;
 const shadowsEnabled=fx=>fx.shadows!==false&&(quality!=='low'||fx.shadows===true);
 const msaaEnabled=fx=>config.msaa&&fx.msaa!==false&&(bloomEnabled(fx)||fx.msaa===true);
 function resize(next){
  if(next!==undefined&&next!==quality){quality=next;governor.reset();autoScale=1;}
  const pixelRatio=G.devicePixelRatio||1,cssWidth=canvas.clientWidth||G.innerWidth||800,cssHeight=canvas.clientHeight||G.innerHeight||600;
  let ratio,width,height;
  if(nativeSurface){({width,height,ratio}=nativeSurface.size());nativeSurface.record(width,height);}
  else{
   ratio=typeof quality==='number'?quality:quality==='low'?.8:quality==='high'?Math.min(pixelRatio,2):Math.min(pixelRatio,1.5);
   ratio=Math.max(.5,Math.min(2,ratio));
   if(quality==='auto')ratio=Math.min(ratio,Math.sqrt(1800000/(cssWidth*cssHeight)))*autoScale;
   if(runtimeMaxPixels>0)ratio=Math.min(ratio,Math.sqrt(runtimeMaxPixels/(cssWidth*cssHeight)));
   const limit=(device.limits?.maxTextureDimension2D||8192);
   ratio=Math.min(ratio,limit/cssWidth,limit/cssHeight);
   width=Math.max(1,Math.round(cssWidth*ratio));height=Math.max(1,Math.round(cssHeight*ratio));
  }
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  stats.renderScale=nativeSurface?nativeSurface.stats.scale:autoScale;stats.pixelRatio=ratio;stats.width=width;stats.height=height;
  const samples=config.msaa&&runtimeMsaa?4:1;
  if(!targets||targets.width!==width||targets.height!==height){
   freeTargets();
   context.configure({device,format:canvasFormat,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
   targets={width,height};
  }else if(samples!==gpu.samples){
   // Only the scene attachments used for multisampling depend on the sample count.
   for(const key of ['depth','overlayDepth','msaa']){freeTexture(targets[key]);targets[key]=null;}
   freeTexture(targets.resolvedDepth);targets.resolvedDepth=null;
   targets.depthResolveBind=null;
  }
  gpu.samples=samples;
  stats.msaa=samples>1?samples:0;return {width,height,ratio};
 }
 function prepareFrameTargets(overlay,bloom,reflections,shadows){
  const {width,height}=targets,samples=gpu.samples;
  targets.scene??=texture(width,height);
  targets.depth??=texture(width,height,depthFormat,samples);
  if(samples>1)targets.msaa??=texture(width,height,format,samples);
  if(overlay)targets.overlayDepth??=texture(width,height,depthFormat,samples);
  if(overlay&&reflections)targets.pre??=texture(width,height);
  // Halo Dual-Kawase : 1/4 (préfiltre ; alpha = tuiles de reflet), 1/8, 1/16 et 1/32 de la résolution.
  if(bloom&&!targets.a){
   const level=d=>texture(Math.ceil(width/d),Math.ceil(height/d));
   targets.a=level(4);targets.halo8=level(8);targets.halo16=level(16);targets.halo32=level(32);
  }
  if(reflections){
   targets.reflection??=texture(Math.ceil(width/2),Math.ceil(height/2));
   if(samples>1){
    targets.resolvedDepth??=texture(width,height,depthFormat);
    targets.depthResolveBind??=device.createBindGroup({layout:depthResolvePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:targets.depth.view}]});
   }
  }
  const size=(quality==='high'?1024:512)*runtimeShadowScale;
  if(shadowTarget&&size!==shadowTarget.size){freeTexture(shadowTarget);shadowTarget=null;gpu.shadowView=whiteDepth.view;}
  if(shadows&&!shadowTarget){shadowTarget=texture(size*2,size*2,depthFormat);shadowTarget.size=size;gpu.shadowView=shadowTarget.view;}
 }
 function lightPlan(eye){const distanceTo=l=>(l.p[0]-eye[0])**2+(l.p[1]-eye[1])**2+(l.p[2]-eye[2])**2,sorted=lights.map(light=>({light,d:distanceTo(light)})).sort((a,b)=>a.d-b.d),candidate=sorted.find(e=>e.light.p[1]>=2.5&&(e.light.power||1)>=7)||sorted.find(e=>e.light.p[1]>=2.5);let chosen=shadowLight;if(candidate&&(!chosen||distanceTo(chosen)>candidate.d*1.35+5))chosen=candidate.light;if(!candidate)chosen=null;const second=sorted.find(e=>e.light!==chosen&&e.light.p[1]>=2.5);return {sorted,distanceTo,chosen,shadowLights:chosen?[chosen,...(second&&!environment?[second.light]:[])]:[]};}
 function actorFilter(camera,fx={}){stats.actorsConsidered=stats.actorsCulled=0;actorLightPlan=null;if(disposed||stats.contextLost){stats.actorFilterMode='inactive';return ()=>true;}const t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0],axes=S.cameraAxes(camera),eye=[p[0]+Math.sin(t*57)*shake*.025,p[1]+Math.sin(t*71)*shake*.015,p[2]],cssWidth=canvas.clientWidth||G.innerWidth||800,cssHeight=canvas.clientHeight||G.innerHeight||600,aspect=Math.max(canvas.width/Math.max(1,canvas.height),cssWidth/cssHeight)+(1+cssWidth/cssHeight)/Math.max(1,cssHeight*.3),tangent=Math.tan(Math.max(10,Math.min(110,camera.fov||75))*Math.PI/360),views=[{eye,axes,h:aspect*tangent,v:tangent,far:camera.far||180}],shadows=shadowsEnabled(fx);let sunVolume=null;if(shadows){const plan=lightPlan(eye);actorLightPlan={eye:eye.slice(),previous:shadowLight,plan};if(!fx.sunOnly){for(const l of plan.shadowLights)views.push({eye:l.p,axes:{right:[1,0,0],up:[0,0,-1],forward:[0,-1,0]},h:Math.tan(138*Math.PI/360),v:Math.tan(138*Math.PI/360),far:32});const torch=eye.map((v,i)=>v+axes.right[i]*.16-axes.up[i]*.08),tan=Math.tan(108*Math.PI/360);views.push({eye:torch,axes,h:tan,v:tan,far:32});}if(environment){const sun=environment.sunDirection,fw=sun.map(x=>-x),length=Math.hypot(fw[0],fw[2]),right=length>.0001?[-fw[2]/length,0,fw[0]/length]:[1,0,0],up=[right[1]*fw[2]-right[2]*fw[1],right[2]*fw[0]-right[0]*fw[2],right[0]*fw[1]-right[1]*fw[0]],a=camera.sun;sunVolume=a?{center:a.center,right,up,forward:fw,extent:a.extent+1,lift:a.depth*.5,depth:a.depth}:{center:[eye[0]+axes.forward[0]*8,eye[1]+1.4,eye[2]+axes.forward[2]*8],right,up,forward:fw,extent:(quality==='high'?36:28)+.25,lift:55,depth:115};}}
  stats.actorFilterMode=shadows?'camera-and-shadow-frusta':'camera-frustum';stats.actorFilterVolumes=views.length+(sunVolume?1:0);return (x,y,z,radius)=>{stats.actorsConsidered++;if(![x,y,z,radius].every(Number.isFinite)||radius<0)return true;const e={p:[x,y,z],radius:radius+.002};for(const v of views)if(S.visible(e,v.eye,v.axes,v.h,v.v,v.far))return true;if(sunVolume){const q=sunVolume,dx=x-q.center[0],dy=y-q.center[1],dz=z-q.center[2],dot=a=>dx*a[0]+dy*a[1]+dz*a[2],depth=q.lift+dot(q.forward);if(Math.abs(dot(q.right))<=q.extent+e.radius&&Math.abs(dot(q.up))<=q.extent+e.radius&&depth+e.radius>=1&&depth-e.radius<=q.depth)return true;}stats.actorsCulled++;return false;};
 }
 const crowdSunMatrix=new Float32Array(16);
 const crowdView={vp,vue:view,projection,ombre:{matrice:crowdSunMatrix,textureView:null,active:false,plein:false,texel:1},lumieres:{positions:lightPositions,couleurs:lightColors,portees:lightRanges,directions:lightDirections,cones:lightCones,nombre:0}};
 function countCrowd(result,shadow=false){if(!result)return;stats.drawCalls+=result.appels||0;stats.triangles+=result.triangles||0;if(!shadow)stats.instances+=result.instances||0;}
 function shadowPass(pass,light,dynamicBatch,slot,torchAxes,time){
  const p=light.p,axes=torchAxes||{right:[1,0,0],up:[0,0,-1],forward:[0,-1,0]},{right:r,up:u,forward:fw}=axes;
  shadowViewMatrix.set([r[0],u[0],-fw[0],0,r[1],u[1],-fw[1],0,r[2],u[2],-fw[2],0,-(r[0]*p[0]+r[1]*p[1]+r[2]*p[2]),-(u[0]*p[0]+u[1]*p[1]+u[2]*p[2]),fw[0]*p[0]+fw[1]*p[1]+fw[2]*p[2],1]);
  const f=1/Math.tan((torchAxes?108:138)*Math.PI/360),near=torchAxes?.08:.15,far=32;
  shadowProjection.fill(0);shadowProjection[0]=shadowProjection[5]=f;shadowProjection[10]=(far+near)/(near-far);shadowProjection[11]=-1;shadowProjection[14]=2*far*near/(near-far);
  S.multiply(shadowProjection,shadowViewMatrix,shadowMatrix);shadowMatrices.set(shadowMatrix,slot*16);
  const size=shadowTarget.size;pass.setViewport(slot%2*size,2*size-(Math.floor(slot/2)+1)*size,size,size,0,1);
  pass.setPipeline(pipeline('depth',{samples:1}));pass.setBindGroup(0,bind('depth','lamp'+slot,{uViewProjection:shadowMatrix,uWindTime:[weatherFrame.wind,time],uLocalWindCount:windFrame.count,uLocalWindPosition:windFrame.positions,uLocalWindMotion:windFrame.motions}));
  const previous=lampCasters[slot],stable=!torchAxes&&previous&&previous.light===light&&previous.p.every((v,k)=>v===p[k]);
  const casters=stable?previous.entries:!worldIndex.entries.length?NONE:worldIndex.query(p,[32,18,0]).filter(e=>S.visible(e,p,axes,1/f,1/f,32));
  if(!torchAxes&&!stable)lampCasters[slot]={light,p:p.slice(),entries:casters};
  beginOpaque();renderStatic(pass,casters,slot+1,true);renderBatch(pass,dynamicBatch,dynamicSlot,true);flushMasked(pass,'depth',{samples:1});
 }
 function sunShadowPass(pass,eye,axes,dynamicBatch,time,camera,fx,crowd,pdrLots){
  const sun=environment.sunDirection,fw=sun.map(v=>-v),length=Math.hypot(fw[0],fw[2]),r=length>.0001?[-fw[2]/length,0,fw[0]/length]:[1,0,0],u=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]];
  const area=camera.sun,full=!!fx.sunOnly,tile=full?shadowTarget.size*2:shadowTarget.size,extent=area?area.extent:quality==='high'?36:28,texel=extent*2/tile;
  const center=area?area.center.slice():[eye[0]+axes.forward[0]*8,eye[1]+1.4,eye[2]+axes.forward[2]*8],dot=a=>a[0]*center[0]+a[1]*center[1]+a[2]*center[2],dx=Math.round(dot(r)/texel)*texel-dot(r),dy=Math.round(dot(u)/texel)*texel-dot(u);
  for(let k=0;k<3;k++)center[k]+=r[k]*dx+u[k]*dy;
  const lift=area?area.depth*.5:55,p=center.map((v,k)=>v+sun[k]*lift),near=1,far=area?area.depth:115;
  shadowViewMatrix.set([r[0],u[0],-fw[0],0,r[1],u[1],-fw[1],0,r[2],u[2],-fw[2],0,-(r[0]*p[0]+r[1]*p[1]+r[2]*p[2]),-(u[0]*p[0]+u[1]*p[1]+u[2]*p[2]),fw[0]*p[0]+fw[1]*p[1]+fw[2]*p[2],1]);
  shadowProjection.fill(0);shadowProjection[0]=shadowProjection[5]=1/extent;shadowProjection[10]=-2/(far-near);shadowProjection[14]=-(far+near)/(far-near);shadowProjection[15]=1;
  S.multiply(shadowProjection,shadowViewMatrix,shadowMatrix);shadowMatrices.set(shadowMatrix,16);crowdSunMatrix.set(shadowMatrix);if(photo)photo.sunScale=(far-near)/texel;
  pass.setViewport(full?0:shadowTarget.size,full?0:shadowTarget.size,tile,tile,0,1);pass.setPipeline(pipeline('depth',{samples:1}));pass.setBindGroup(0,bind('depth','sun',{uViewProjection:shadowMatrix,uWindTime:[weatherFrame.wind,time],uLocalWindCount:windFrame.count,uLocalWindPosition:windFrame.positions,uLocalWindMotion:windFrame.motions}));
  const inside=e=>{const x=e.p[0]-p[0],y=e.p[1]-p[1],d=e.p[2]-p[2],z=x*fw[0]+y*fw[1]+d*fw[2];return Math.abs(x*r[0]+y*r[1]+d*r[2])<extent+e.radius&&Math.abs(x*u[0]+y*u[1]+d*u[2])<extent+e.radius&&z+e.radius>near&&z-e.radius<far;};
  const casters=camera.chunked||!worldIndex.entries.length?NONE:camera.allStatic?worldIndex.entries:worldIndex.query(center,[extent+24,26,0]).filter(inside);
  beginOpaque();renderStatic(pass,casters,2,true);if(camera.chunked)drawChunks(pass,inside,true);
  const viewTangent=Math.tan(Math.max(10,Math.min(110,camera.fov||75))*Math.PI/360);
  if(warm)renderLotsWarm(pass,true);else renderLots(pass,eye,axes,0,viewTangent,0,inside);renderBatch(pass,dynamicBatch,dynamicSlot,true,true);if(crowd)renderBatch(pass,crowd,crowdSlot,true);
  for(const entry of pdrLots)renderBatch(pass,entry.batch,entry,true);
  flushMasked(pass,'depth',{samples:1});
  if(typeof fx.foule?.gpuShadow==='function')countCrowd(fx.foule.gpuShadow(pass,{matrice:crowdSunMatrix,direction:sun,texel,plein:full,viewport:[full?0:shadowTarget.size,full?0:shadowTarget.size,tile,tile],centre:center,etendue:extent,profondeur:far}),true);
 }
 // The optional racing profile uses the canonical photo fragment. Resource owners are per device.
 const photo=options.ombresPhoto?{
  tile:texture(options.ombresPhoto.tuile===512?512:1024,options.ombresPhoto.tuile===512?512:1024,depthFormat),
  tileMatrix:new Float32Array(16),farMatrix:new Float32Array(16),sunScale:1,far:null,
  nearMeshes:[],splitPack:S.splitPacker(),tileMeshes:[],tilePack:S.instancePacker(),tileSlot:{},contactSphere:new Float32Array(4),
  state:{contacts:0,tuile:false,loin:false,penombre:'off',loinTaille:0}
 }:null;
 if(photo)stats.ombresPhoto=photo.state;
 function precalculerOmbre(request){
  if(!photo||disposed||stats.contextLost)return null;
  if(photo.far){freeTexture(photo.far);photo.far=null;photo.state.loin=false;photo.state.loinTaille=0;}
  if(!request||!environment)return null;
  let zone;
  if(request.centre==null)zone=S.sunBounds(environment.sunDirection,lots,Math.max(0,request.marge??20),Math.max(0,request.dessous??300));
  else{
   const c=request.centre,e=Number(request.etendue),h=Number(request.hauteur)||Math.max(400,e*3);
   if(!c||![c[0],c[1],c[2],e,h].every(Number.isFinite)||e<=0||h<=0)throw Error('precalculerOmbre : centre et etendue requis');
   zone={centre:c,etendue:e,lift:h*.5,profondeur:h};
  }
  if(!zone)return null;
  const start=clock(),size=Math.max(256,Math.min((device.limits?.maxTextureDimension2D||8192),Math.floor(request.taille)||2048));
  const map=texture(size,size,depthFormat,1,1,1,'FERRO static sun depth');photo.far=map;
  const texel=S.orthographicSun(environment.sunDirection,shadowProjection,shadowViewMatrix,photo.farMatrix,zone.centre,zone.etendue,size,zone.lift,0,zone.profondeur,null,false);
  Object.assign(map,{sun:environment.sunDirection.slice(),lots:lotSlots.map(s=>s.source),bias:Math.min(.02,.6/zone.profondeur),normal:Math.min(2,texel)});
  const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({label:'FERRO static sun casters',colorAttachments:[],depthStencilAttachment:{view:map.view,depthLoadOp:'clear',depthClearValue:1,depthStoreOp:'store'}});
  pass.setPipeline(pipeline('depth',{samples:1}));pass.setBindGroup(0,bind('depth','static-photo',{uViewProjection:photo.farMatrix}));beginOpaque();
  const calls=stats.drawCalls,triangles=stats.triangles,masked=stats.maskedDrawCalls;let instances=0;const cold=[];
  for(const slot of lotSlots){
   const lot=slot.source;if(lot.ombre===false||lot.groundCover||lot.detailProcheSeul)continue;
   const resident=slot.far||slot.near;
   if(resident){renderBatch(pass,resident.batch,resident,true);instances+=resident.batch.values.length/16;}
   else{
    const objects=lot.objetsOmbreLointaine?.()||(lot.loin?.length?lot.loin:lot.objets);
    if(objects)for(const mesh of objects)cold.push(mesh);
   }
  }
  for(const entry of worldIndex.entries)cold.push(entry.mesh);
  let stream=null;
  if(cold.length){const batch=S.pack(cold,environment);stream=ensureSlot({},batch);renderBatch(pass,batch,stream,true);instances+=batch.values.length/16;}
  flushMasked(pass,'depth',{samples:1});pass.end();device.queue.submit([encoder.finish()]);if(stream)freeBuffer(stream.buffer);
  const report={taille:size,texel,etendue:zone.etendue,profondeur:zone.profondeur,centre:zone.centre,octets:size*size*4,appels:stats.drawCalls-calls,instances,ms:clock()-start};
  stats.drawCalls=calls;stats.triangles=triangles;stats.maskedDrawCalls=masked;photo.state.loinTaille=size;
  return report;
 }
 function preparePhoto(encoder,dynamic,fx,values,textures){
  const c=fx.contacts,b=c?.boites;
  const n=b&&Number.isFinite(c.nombre)?Math.max(0,Math.min(6,Math.floor(c.nombre),Math.floor(b.length/24))):0;
  const margin=Math.max(0,c?.marge??1.6),sphere=photo.contactSphere;sphere.fill(0);
  if(n){
   for(let k=0;k<3;k++)sphere[k]=b[k];
   for(let i=0;i<n;i++){const o=i*24;sphere[3]=Math.max(sphere[3],Math.hypot(b[o]-sphere[0],b[o+1]-sphere[1],b[o+2]-sphere[2])+b[o+7]+margin+.01);}
  }
  const tile=stats.shadows&&environment&&fx.ombreProche,tileOn=!!(tile&&tile.centre&&[tile.centre[0],tile.centre[1],tile.centre[2]].every(Number.isFinite));
  const e=tileOn&&tile.etendue>.5?tile.etendue:3.5,edge=photo.tile.width;
  if(tileOn){
   const axe=tile.axe?.every(Number.isFinite)?tile.axe:null;
   S.orthographicSun(environment.sunDirection,shadowProjection,shadowViewMatrix,photo.tileMatrix,tile.centre,e,edge,8,.5,16,axe,!axe);
   const models=photo.tileMeshes;models.length=0;
   for(let i=0;i<(dynamic?.length||0);i++){const mesh=dynamic[i];if(!mesh.fx&&(mesh.overlay||i>=tile.debut&&i<tile.fin))models.push(mesh);}
   const batch=photo.tilePack(models,environment,true,tile.centre),matrix=photo.tileRelative||(photo.tileRelative=new Float32Array(16));
   matrix.set(photo.tileMatrix);
   for(let row=0;row<4;row++)matrix[12+row]+=matrix[row]*tile.centre[0]+matrix[4+row]*tile.centre[1]+matrix[8+row]*tile.centre[2];
   const p=encoder.beginRenderPass({label:'FERRO vehicle shadow detail',colorAttachments:[],depthStencilAttachment:{view:photo.tile.view,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
   p.setPipeline(pipeline('depth',{samples:1,front:true}));p.setBindGroup(0,bind('depth','tile-photo',{uViewProjection:matrix}));
   if(batch.groups.length){ensureSlot(photo.tileSlot,batch);beginOpaque();renderBatch(p,batch,photo.tileSlot,true);flushMasked(p,'depth',{samples:1,front:true});}p.end();
  }
  const far=photo.far,farOn=!!(far&&stats.shadows&&fx.ombreLoin!==false&&environment&&far.sun.every((v,k)=>v===environment.sunDirection[k]));
  const pen=fx.penombre,mode=typeof pen==='string'?pen:pen?.mode,pcss=stats.shadows&&mode==='pcss'&&fx.sunOnly&&options.ombresPhoto.pcss!==false;
  Object.assign(values,{uContact:b,uContactCount:n,uContactReglages:[n?(c.ambiance??.85):0,n?(c.soleil??.6):0,Math.max(.5,c?.exposant??4),margin],uContactSphere:sphere,
   uOmbreTuileMatrice:photo.tileMatrix,uOmbreTuileReglages:[+tileOn,1/edge,.3/(2*e),2*e/edge],uPhotoTileSphere:[0,0,0,-1],
   uOmbreLoinMatrice:photo.farMatrix,uOmbreLoinReglages:farOn?[1,1/far.width,far.bias,far.normal]:[0,1,0,0],
   uPenombre:[pcss?2:stats.shadows&&(mode==='meteo'||mode==='pcss')?1:0,photo.sunScale*(pen?.k??.02),Math.max(1,Math.min(6,pen?.rayonMax??4)),0]});
  Object.assign(textures,{uOmbreTuile:tileOn?photo.tile:whiteDepth,uOmbreLoin:farOn?far:whiteDepth,uOmbreComparee:pcss?shadowTarget:whiteDepth});
  Object.assign(photo.state,{contacts:n,tuile:tileOn,loin:farOn,penombre:pcss?'pcss':values.uPenombre[0]?'meteo':'off'});
 }
 function renderEffects(pass,meshes,eye,time,clip=vp,overlay=false,origin){
  const batch=(overlay?packOverlayFx:packFx)(meshes,environment,eye,origin);stats.fxInstances+=batch.values.length/16;if(!batch.groups.length)return;
  const storage=overlay?overlayFxSlot:fxSlot;ensureSlot(storage,batch);
  pass.setPipeline(pipeline('fx'));pass.setBindGroup(0,bind('fx',overlay?'overlay':'world',{uViewProjection:clip,uDrawOrigin:origin,uWindTime:[0,time],uSkyTop:environment?.skyTop||[.2,.3,.4],uSkyBottom:environment?.skyBottom||[.5,.6,.6],uEye:eye,uAmbient:environment?.ambient||[.12,.15,.16],uFogColor:environment?.fog||[.009,.018,.024],uEnvironment:[environment?1:0,environment?.fogDensity??.018],uTime:time,uSunDirection:environment?.sunDirection||[.4,.8,.3],uSunColor:weatherFrame?.sunColor||environment?.sunColor||[1,.95,.85]}));renderBatch(pass,batch,storage);
 }
 function renderNappes(pass,eye,axes,horizontal,vertical,far,uniforms,radii,masqueNappes){
  const count=warm?nappes.length:terrainView.select(eye,axes,horizontal,vertical,far,radii);
  if(!count)return 0;
  if(warm)warm.nappes+=count;
  let mode=null,drawn=0;
  pass.setBindGroup(0,uniforms);
  for(let i=0;i<count;i++){
   const n=nappes[warm?i:terrainView.indices[i]];
   if(!warm&&masqueNappes&&masqueNappes[n.sourceIndex]){stats.nappesOccultees++;continue;}
   if(n.masked&&maskPhase){deferMasked(2,n,null,null,null);drawn++;continue;}
   if(mode!==n.rigid){mode=n.rigid;pass.setPipeline(pipeline('world',{nappe:mode?'rigid':true}));}
   drawNappe(pass,n);drawn++;
  }
  pass.setPipeline(pipeline('world'));pass.setBindGroup(0,uniforms);return drawn;
 }
 function drawNappe(pass,n){pass.setVertexBuffer(0,n.vertex);pass.setVertexBuffer(1,n.constant||n.instance);pass.setIndexBuffer(n.index,'uint32');pass.drawIndexed(n.indices.length);stats.drawCalls++;stats.triangles+=n.indices.length/3;}
 // Préchauffage : chaque lot, proche ET lointain, sans test de champ ni de portée, puis chaque sous-ensemble d'indices
 // des prairies une fois par passe. En passe d'ombre, les lots « ombre: false » restent exclus, comme en jeu.
 function renderLotsWarm(pass,shadow){
  let count=0;const seen=new Set();
  for(const l of lotSlots){
   // Prewarming exercises resident buffers and never materializes an unseen lot.
   if(!l.ready||shadow&&l.source.ombre===false)continue;
   if(l.near){renderBatch(pass,l.near.batch,l.near,shadow);count++;}
   if(l.far){renderBatch(pass,l.far.batch,l.far,shadow);count++;}
   const plan=l.groundPlan;if(!plan||!plan.valid||!l.near)continue;
   if(maskPhase)deferMasked(3,l,seen,null,null);else warmCoverSubsets(pass,l,seen);
  }
  warm.lots+=count;return count;
 }
 function warmCoverSubsets(pass,l,seen){
  for(const group of l.groundPlan.groups){const record=group.nearIndex,full=source.ranges[record.name];if(!record.active||seen.has(record))continue;seen.add(record);
   pass.setVertexBuffer(0,vbo);pass.setIndexBuffer(ibo,'uint32');pass.setVertexBuffer(1,l.near.buffer,group.near.offset,64);
   for(const range of record.ranges){if(!range.count||range.count===full.count&&range.offset===full.offset)continue;pass.drawIndexed(range.count,1,range.offset/4,0,0);stats.drawCalls++;stats.triangles+=range.count/3;warm.subsets++;}
  }
 }
 // A bounded ring records real GPU timestamps. Mapping is asynchronous; the game
 // never waits for submitted GPU work. Only explicit benchmark stop drains it.
 let profiling=false,timing=null,timingSamples=[],timingDropped=0;
 function makeTiming(){
  if(timing||!stats.gpuTimingAvailable)return;const query=device.createQuerySet({type:'timestamp',count:6}),resolve=buffer(768,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC,'FERRO timestamp resolve');
  timing={query,resolve,slots:Array.from({length:3},(_,index)=>({index,pending:false,promise:null,buffer:buffer(16,GPUBufferUsage.MAP_READ,'FERRO timestamp readback')}))};
 }
 async function setProfiling(enabled){
  if(enabled){if(timing)await Promise.all(timing.slots.map(s=>s.promise).filter(Boolean));timingSamples=[];timingDropped=0;makeTiming();profiling=!!timing;}
  else{profiling=false;if(timing)await Promise.all(timing.slots.map(s=>s.promise).filter(Boolean));}
  return {available:stats.gpuTimingAvailable,enabled:profiling,samples:timingSamples.slice(),dropped:timingDropped};
 }
 function startTiming(){if(!profiling||!timing)return null;const slot=timing.slots.find(s=>!s.pending);if(!slot){timingDropped++;return null;}slot.pending=true;return slot;}
 function finishTiming(encoder,slot){if(!slot)return;encoder.resolveQuerySet(timing.query,slot.index*2,2,timing.resolve,slot.index*256);encoder.copyBufferToBuffer(timing.resolve,slot.index*256,slot.buffer,0,16);}
 function readTiming(slot){if(!slot)return;slot.promise=slot.buffer.mapAsync(GPUMapMode.READ,0,16).then(()=>{const data=new BigUint64Array(slot.buffer.getMappedRange(0,16)),ms=Number(data[1]-data[0])/1e6;slot.buffer.unmap();if(Number.isFinite(ms)&&ms>=0){stats.gpuTimeMs=ms;if(timingSamples.length<4096)timingSamples.push(ms);}}).catch(error=>{if(!disposed&&!stats.contextLost)stats.gpuTimingError=error.message;}).finally(()=>{slot.pending=false;slot.promise=null;});}
 let weatherFrame;
 // Corps de draw. En préchauffage (warm) : ni gouverneur, ni vent local, ni chronomètre GPU ; chaque passe sous un
 // ciseau d'un pixel (l'effacement d'une passe WebGPU ignore le ciseau : les cibles de l'image sont réécrites).
 // Un effet de surface peut encoder ses propres fragments dans la passe couleur et le tampon
 // de profondeur des opaques. La matrice FERRO est en clip −w..w ; convertir z en WGSL.
 function renderSurface(pass,surface,clip,origin,eye,weather,overlay,sceneCouleur=null){
  const count=surface.dessiner(pass,{vp:clip,origine:origin||null,oeil:eye,soleil:environment?.sunDirection||[.4,.8,.3],
   couleurSoleil:weather.sunColor,ciel:weather.skyTop,horizon:weather.skyBottom,ambiance:weather.ambient,
   brouillard:weather.fog,densite:weather.fogDensity,format,lineaire:true,depthFormat,samples:gpu.samples,largeur:canvas.width,hauteur:canvas.height,sceneCouleur},overlay);
  if(count){stats.drawCalls+=count.drawCalls||0;stats.triangles+=count.triangles||0;stats.instances+=count.instances||0;stats.fxInstances+=count.instances||0;}
 }
 function render(camera,dynamic,fx){
  if(disposed||stats.contextLost)return;fx=fx||{};if(!warm)autoScale=governor.update(fx,quality);runtimeMsaa=msaaEnabled(fx);runtimeShadowScale=fx.shadowMapScale===1?1:config.shadowMapScale;if(!warm)surfaceBudget?.update(fx.frameMs);resize();
  const t=fx.time||0,weather=weatherFrame=S.bitumeWeather(environment,fx.weather,t,weatherFrame),shake=fx.shake||0,p=camera.pos||[0,1.6,0],axes=S.cameraAxes(camera),{right,up,forward}=axes,eye=[p[0]+Math.sin(t*57)*shake*.025,p[1]+Math.sin(t*71)*shake*.015,p[2]];
  if(!warm)localWind.update(fx.windSources,t);localWind.select(eye);stats.windSources=windFrame.count;stats.windCandidates=windFrame.candidates;stats.windUpdates=windFrame.updates;
  view.set([right[0],up[0],-forward[0],0,right[1],up[1],-forward[1],0,right[2],up[2],-forward[2],0,-(right[0]*eye[0]+right[1]*eye[1]+right[2]*eye[2]),-(up[0]*eye[0]+up[1]*eye[1]+up[2]*eye[2]),forward[0]*eye[0]+forward[1]*eye[1]+forward[2]*eye[2],1]);
  const fov=Math.max(10,Math.min(110,camera.fov||75))*Math.PI/180,f=1/Math.tan(fov*.5),near=camera.near||.045,far=camera.far||180,horizontal=canvas.width/canvas.height/f;
  S.setFrustumRadii(colourRadii,horizontal,1/f);
  vegetation.update(fx,eye,1/f,canvas.height);stats.windStrength=vegetationState.strength;stats.groundCover=vegetationState.enabled;lotView.prepare(lots,eye,1/f,canvas.height,vegetationState);stats.lotDistanceTests=lotView.distanceTests;stats.lotInstanceTests=0;
  projection.fill(0);projection[0]=f/(canvas.width/canvas.height);projection[5]=f;projection[10]=(far+near)/(near-far);projection[11]=-1;projection[14]=2*far*near/(near-far);S.multiply(projection,view,vp);
  const ranges=S.detailRanges(quality);ranges[0]=S.extendedDistance(ranges[0],environment,eye);stats.viewDistance=ranges[0];
  const shown=camera.chunked||!worldIndex.entries.length?NONE:camera.allStatic?worldIndex.entries:worldIndex.query(eye,ranges).filter(e=>S.visible(e,eye,axes,horizontal,1/f,ranges[0],colourRadii));stats.staticVisible=shown.length;stats.staticCulled=world.length-shown.length;
  const planned=actorLightPlan&&actorLightPlan.previous===shadowLight&&eye.every((v,k)=>v===actorLightPlan.eye[k])?actorLightPlan.plan:lightPlan(eye);actorLightPlan=null;
  const {sorted,distanceTo,chosen}=planned,shadowLights=fx.headlight?[fx.headlight]:planned.shadowLights;shadowLight=chosen;
  const transient=S.transientLights(fx.lights,eye,quality==='low'?4:8);stats.dynamicLights=transient.length;
  const selected=shadowLights.map(light=>({light,d:distanceTo(light)})).concat(transient.map(light=>({light,d:distanceTo(light)})),sorted.filter(e=>!shadowLights.includes(e.light)).slice(0,Math.max(0,(quality==='low'?6:12)-shadowLights.length-transient.length))).slice(0,12);
  const blackout=S.horrorLights(fx.horror,lights);stats.blackoutLights=blackout?.size||0;lightPositions.fill(0);lightColors.fill(0);lightRanges.fill(0);lightDirections.fill(0);lightCones.fill(0);
  selected.forEach(({light},i)=>{if(light.dir){lightDirections.set(light.dir,i*3);lightCones.set(light.cone||[.75,.94],i*2);}lightPositions.set(light.p,i*3);lightRanges[i]=light.range||0;const color=light.color||[1,1,1],power=(light.power===undefined?1:light.power)*(blackout?.get(light)??1);lightColors.set(color.map(c=>c*power),i*3);});
  const tileCandidate=photo&&fx.ombreProche&&environment&&shadowsEnabled(fx)?fx.ombreProche:null;
  const detail=tileCandidate?.centre&&[tileCandidate.centre[0],tileCandidate.centre[1],tileCandidate.centre[2]].every(Number.isFinite)?tileCandidate:null;
  if(photo)photo.nearMeshes.length=0;
  ordinary.length=overlay.length=particles.length=overlayParticles.length=0;
  const surface=typeof fx.surfaceGPU?.dessiner==='function'&&typeof fx.surfaceGPU.collecter==='function'?fx.surfaceGPU:null;
  let worldSurface=false,overlaySurface=false;
  for(let i=0;i<(dynamic?.length||0);i++){
   const mesh=dynamic[i];
   if(mesh.fx&&surface&&surface.collecter(mesh)){
    if(mesh.overlay)overlaySurface=true;else worldSurface=true;
    continue;
   }
   (mesh.overlay?(mesh.fx?overlayParticles:overlay):mesh.fx?particles:detail&&i>=detail.debut&&i<detail.fin?photo.nearMeshes:ordinary).push(mesh);
  }
  if(warm)for(const mesh of warm.extra)(mesh.overlay?(mesh.fx?overlayParticles:overlay):mesh.fx?particles:ordinary).push(mesh);
  const colourOverlay=overlayView?overlayView.select(overlay,eye,axes,horizontal,1/f,colourRadii,warm):overlay;
  stats.overlayCulled=overlay.length-colourOverlay.length;
  const dynamicBatch=detail?photo.splitPack(ordinary,photo.nearMeshes,environment):packDynamic(ordinary,environment,true),torchPosition=eye.map((v,i)=>v+right[i]*.16-up[i]*.08),sunOnly=!!fx.sunOnly,hasOverlay=colourOverlay.length>0||overlayParticles.length>0||overlaySurface;
  stats.drawCalls=stats.maskedDrawCalls=stats.triangles=stats.instances=stats.uploadBytes=stats.uniformUploadBytes=stats.fxInstances=stats.lotsOccultes=stats.nappesOccultees=0;maskPhase=false;maskCount=0;stats.bloom=bloomEnabled(fx);stats.shadows=shadowsEnabled(fx);
  stats.reflections=config.reflections&&stats.bloom&&fx.reflections!==false&&fx.reflections!=='off';stats.reflectionSteps=stats.reflections?18:0;
  prepareFrameTargets(hasOverlay,stats.bloom,stats.reflections,stats.shadows);
  const shadowTexel=stats.shadows?1/(2*shadowTarget.size):1;
  stats.shadowTileSize=stats.shadows?shadowTarget.size:0;stats.shadowMapSize=2*stats.shadowTileSize;stats.shadowMode=environment?'sun-atlas':'atlas';stats.shadowMaps=stats.shadows?(sunOnly?0:shadowLights.length+(fx.torch!==false?1:0))+(environment?1:0):0;
  ensureSlot(dynamicSlot,dynamicBatch);const crowd=fx.instances?.groups?.length?fx.instances:null;stats.crowdInstances=crowd?crowd.values.length/16:0;if(crowd)ensureSlot(crowdSlot,crowd);
  const pdrLots=[];stats.pdrLotInstances=0;if(Array.isArray(fx.lots))for(let i=0;i<fx.lots.length;i++){const lot=fx.lots[i];if(!lot?.values||!lot?.groups?.length)continue;const slot=pdrSlots[i]||(pdrSlots[i]={lot:null,version:NaN});ensureSlot(slot,lot,slot.lot!==lot||slot.version!==lot.version);slot.lot=lot;slot.version=lot.version;pdrLots.push(slot);stats.pdrLotInstances+=lot.values.length/16;}
  // Slot count follows the active stream rather than growing with every world.
  const activeLots=Array.isArray(fx.lots)?fx.lots.length:0;for(let i=activeLots;i<pdrSlots.length;i++)freeBuffer(pdrSlots[i]?.buffer);pdrSlots.length=activeLots;
  const encoder=device.createCommandEncoder({label:'FERRO frame'}),timed=warm?null:startTiming();let firstPass=true;
  const begin=(descriptor,last=false)=>{if(timed&&(firstPass||last))descriptor.timestampWrites={querySet:timing.query,...(firstPass?{beginningOfPassWriteIndex:timed.index*2}:{}),...(last?{endOfPassWriteIndex:timed.index*2+1}:{})};firstPass=false;const pass=encoder.beginRenderPass(descriptor);if(warm)pass.setScissorRect(0,0,1,1);return pass;};
  if(stats.shadows){const pass=begin({label:'FERRO shadow atlas',colorAttachments:[],depthStencilAttachment:{view:shadowTarget.view,depthLoadOp:'clear',depthClearValue:1,depthStoreOp:'store'}});if(!sunOnly)shadowLights.forEach((light,i)=>{const fw=light.dir,lightAxes=fw?{forward:fw,right:[-fw[2],0,fw[0]],up:[0,1,0]}:null;shadowPass(pass,light,dynamicBatch,i,lightAxes,t);});if(environment)sunShadowPass(pass,eye,axes,dynamicBatch,t,camera,fx,crowd,pdrLots);if(!sunOnly&&fx.torch!==false)shadowPass(pass,{p:torchPosition},dynamicBatch,2,axes,t);pass.end();}
  const voile=fx.voile&&fx.voile.force>0&&(fx.voile.textureView||fx.voile.texture?.createView)?fx.voile:null;
  if(voile&&!voile.textureView)voile.textureView=voile.texture.createView();
  if(fx.fovea&&fx.fovea[3]>fx.fovea[2]){foveaWorld[0]=fx.fovea[0];foveaWorld[1]=1-fx.fovea[1];foveaWorld[2]=fx.fovea[2];foveaWorld[3]=fx.fovea[3];foveaSsr[0]=fx.fovea[0];foveaSsr[1]=fx.fovea[1];foveaSsr[2]=fx.fovea[2];foveaSsr[3]=fx.fovea[3];}
  else{foveaWorld.fill(0);foveaSsr.fill(0);}
  const worldTextures={uPbrAlbedo:pbr[0],uPbrNormal:pbr[1],uPbrRough:pbr[2],uShadowMap:stats.shadows?shadowTarget:whiteDepth,uVoile:voile?{view:voile.textureView}:white};
  const worldValues={uOverlayMode:options.overlayLighting==='world'?1:0,uSeaMode:options.sea===false?0:1,uPhoto:fx.photo||0,uFovea:foveaWorld,uSeaOrigin:fx.sea?.origin||[0,0,0,0],uSeaMotion:fx.sea?.motion||[0,0,-1.25,0],uViewProjection:vp,uEye:eye,uForward:forward,uCloudOffset:fx.cloudOffset||weather.cloudOffset,uWindTime:[weather.wind,t],uLocalWindCount:windFrame.count,uLocalWindPosition:windFrame.positions,uLocalWindMotion:windFrame.motions,uSunDirection:environment?.sunDirection||[.4,.8,.3],uSunColor:weather.sunColor,uAmbient:weather.ambient,uFogColor:weather.fog,uEnvironment:[environment?1:0,weather.fogDensity],uNightHour:[environment?.night||0,environment?.hour??14],uSkyTop:weather.skyTop,uSkyBottom:weather.skyBottom,uWeather:weather.values,uLightDirection:lightDirections,uLightCone:lightCones,uLightPosition:lightPositions,uLightColor:lightColors,uLightRange:lightRanges,uLightCount:selected.length,uResolution:[canvas.width,canvas.height],uEffects:[t,fx.flash||0,fx.damage||0,Math.max(0,Math.min(1,fx.pulse||0))],uShadowMatrix:shadowMatrices,uShadowSettings:[stats.shadows&&!sunOnly?shadowLights.length:0,shadowTexel,stats.shadows&&!sunOnly&&fx.torch!==false?1:0,stats.shadows&&environment?(sunOnly?2:1):0],uTorchPosition:fx.torch===false?[0,-1e5,0]:torchPosition,uVoileZone:voile?[voile.origine[0],voile.origine[1],1/Math.max(.001,voile.taille[0]),1/Math.max(.001,voile.taille[1])]:[0,0,0,0],uVoileForce:voile?Math.min(1,voile.force):0,uPbrReady:pbrReady,uVignette:config.vignette};
  if(photo)preparePhoto(encoder,dynamic,fx,worldValues,worldTextures);
  const mainUniforms=bind('world','main',worldValues,worldTextures);
  // Only SSR needs the world colour before the cockpit. Otherwise both passes share one attachment.
  const keepWorld=hasOverlay&&stats.reflections,sceneBeforeOverlay=keepWorld?targets.pre:targets.scene;
  const mainColor=targets.msaa?targets.msaa.view:sceneBeforeOverlay.view;
  const pass=begin({label:'FERRO scene',colorAttachments:[{view:mainColor,...(targets.msaa&&(!hasOverlay||keepWorld)?{resolveTarget:sceneBeforeOverlay.view}:{}),loadOp:'clear',clearValue:CLEAR_LINEAR,storeOp:targets.msaa&&!hasOverlay?'discard':'store'}],depthStencilAttachment:{view:targets.depth.view,depthLoadOp:'clear',depthClearValue:1,depthStoreOp:stats.reflections?'store':'discard'}});
  if(environment){pass.setPipeline(pipeline('sky'));pass.setBindGroup(0,bind('sky','main',{uSkyRight:right,uSkyUp:up,uSkyForward:forward,uSkyTop:weather.skyTop,uSkyBottom:weather.skyBottom,uSkyFog:weather.fog,uSunDirection:environment.sunDirection,uSunColor:weather.sunColor,uSkyFov:[horizontal,1/f],uWeather:weather.values,uSkyMotion:[t,weather.wind],uCloudOffset:fx.cloudOffset||weather.cloudOffset,uSkyNight:environment.night}));pass.draw(3);stats.drawCalls++;}
  stats.backgroundWater=backgroundIndex.entries.length;stats.backgroundDrawCalls=0;
  if(backgroundIndex.entries.length){const before=stats.drawCalls;pass.setPipeline(pipeline('world',{background:true,masked:true}));pass.setBindGroup(0,mainUniforms);renderStatic(pass,backgroundIndex.entries,4);stats.backgroundDrawCalls=stats.drawCalls-before;}
  pass.setPipeline(pipeline('world'));pass.setBindGroup(0,mainUniforms);beginOpaque();renderStatic(pass,shown,0);if(camera.chunked)drawChunks(pass,c=>S.visible(c,eye,axes,horizontal,1/f,Math.min(far,c.range),colourRadii));
  renderNappes(pass,eye,axes,horizontal,1/f,far,mainUniforms,colourRadii,fx.masqueNappes);stats.lotsVisibles=warm?renderLotsWarm(pass,false):renderLots(pass,eye,axes,horizontal,1/f,far,null,colourRadii,fx.masqueLots);renderBatch(pass,dynamicBatch,dynamicSlot);if(crowd)renderBatch(pass,crowd,crowdSlot);for(const entry of pdrLots)renderBatch(pass,entry.batch,entry);
  flushMasked(pass,'world');
  if(typeof fx.foule?.gpuColor==='function'){
   const env=environment||S.indoor;Object.assign(crowdView,{oeil:eye,avant:forward,droite:right,haut:up,fov,tangente:1/f,focale:canvas.height*f*.5,largeur:canvas.width,hauteur:canvas.height,near,far,temps:t,qualite:quality,msaa:gpu.samples>1?gpu.samples:0,soleil:env.sunDirection,couleurSoleil:env.sunColor,ambiance:env.ambient,brouillard:env.fog,densiteBrouillard:env.fogDensity,cielHaut:env.skyTop,cielBas:env.skyBottom});
   Object.assign(crowdView.ombre,{textureView:stats.shadows?shadowTarget.view:whiteDepth.view,active:!!(stats.shadows&&environment),plein:sunOnly,texel:shadowTexel});crowdView.lumieres.nombre=selected.length;countCrowd(fx.foule.gpuColor(pass,crowdView));
  }
  if(particles.length)renderEffects(pass,particles,eye,t);
  if(worldSurface)renderSurface(pass,surface,vp,null,eye,weather,false);
  pass.end();
  if(stats.reflections&&targets.msaa){const depthPass=begin({label:'FERRO SSR depth resolve',colorAttachments:[],depthStencilAttachment:{view:targets.resolvedDepth.view,depthLoadOp:'clear',depthClearValue:1,depthStoreOp:'store'}});depthPass.setPipeline(depthResolvePipeline);depthPass.setBindGroup(0,targets.depthResolveBind);depthPass.draw(3);depthPass.end();stats.drawCalls++;}
  if(hasOverlay){
   if(keepWorld&&!targets.msaa)encoder.copyTextureToTexture({texture:targets.pre.texture},{texture:targets.scene.texture},[canvas.width,canvas.height]);
   const overlayPass=begin({label:'FERRO close weapon',colorAttachments:[{view:targets.msaa?targets.msaa.view:targets.scene.view,...(targets.msaa?{resolveTarget:targets.scene.view}:{}),loadOp:'load',storeOp:targets.msaa?'discard':'store'}],depthStencilAttachment:{view:targets.overlayDepth.view,depthLoadOp:'clear',depthClearValue:1,depthStoreOp:'discard'}});
   const origin=options.cameraRelativeOverlay===true?eye:undefined;
   const overlayNear=Math.min(near,Math.max(.005,Number(camera.overlayNear)||near));let clip=vp;
   if(overlayNear!==near||origin){
    overlayProjection.set(projection);overlayProjection[10]=(far+overlayNear)/(overlayNear-far);overlayProjection[14]=2*far*overlayNear/(overlayNear-far);
    if(origin){relativeView.set(view);relativeView[12]=relativeView[13]=relativeView[14]=0;}
    S.multiply(overlayProjection,origin?relativeView:view,overlayVP);clip=overlayVP;
   }
   if(blackout)selected.forEach(({light},i)=>{const c=light.color||[1,1,1],power=light.power===undefined?1:light.power;lightColors.set(c.map(v=>v*power),i*3);});
   if(colourOverlay.length){const batch=packOverlay(colourOverlay,environment,true,origin);ensureSlot(overlaySlot,batch);overlayPass.setPipeline(pipeline('world',{overlay:true}));overlayPass.setBindGroup(0,bind('world','overlay',{...worldValues,uViewProjection:clip,uDrawOrigin:origin},worldTextures));beginOpaque();renderBatch(overlayPass,batch,overlaySlot);flushMasked(overlayPass,'world',{overlay:true});}
   if(overlayParticles.length)renderEffects(overlayPass,overlayParticles,eye,t,clip,true,origin);
   if(overlaySurface)renderSurface(overlayPass,surface,clip,origin,eye,weather,true,keepWorld?targets.pre.view:null);
   overlayPass.end();
  }
  const output=context.getCurrentTexture().createView(),brightness=Number.isFinite(fx.brightness)?Math.max(.5,Math.min(2,fx.brightness)):1;
  // LOT 0.3 : préfiltre, réflexions d'écran, réduction et élargissement Dual-Kawase, puis une composition unique vers le canvas.
  const tone=toneSettings(fx);stats.tonemap=tone.name;stats.exposure=tone.exposure;stats.bloomLevels=stats.bloom?BLOOM_LEVELS:0;
  const postPass=(view,slot,values,inputs,label,additive=false,last=false)=>{
   const postPassEncoder=begin({label,colorAttachments:[{view,loadOp:additive?'load':'clear',clearValue:[0,0,0,1],storeOp:'store'}]},last);
   postPassEncoder.setPipeline(additive?postAdditive():pipeline('post',{samples:1,target:last?canvasFormat:format}));
   postPassEncoder.setBindGroup(0,bind('post',slot,values,inputs));postPassEncoder.draw(3);postPassEncoder.end();stats.drawCalls++;
  };
  if(stats.bloom){
   postPass(targets.a.view,'prefilter',{uPass:0,uTexel:[1/canvas.width,1/canvas.height],uBloomKnee:bloomKnee,uExposure:tone.exposure},{uScene:targets.scene},'FERRO bloom prefilter');
   if(stats.reflections){
    const reflectionPass=begin({label:'FERRO screen space reflections',colorAttachments:[{view:targets.reflection.view,loadOp:'clear',clearValue:[0,0,0,0],storeOp:'store'}]});
    reflectionPass.setPipeline(pipeline('ssr',{samples:1}));
    const mask=hasOverlay&&canvas.width%4===0&&canvas.height%4===0;
    reflectionPass.setBindGroup(0,bind('ssr','main',{uProjection:[1/projection[0],1/projection[5],projection[10],projection[14]],uPixel:[1/canvas.width,1/canvas.height],uReceiverMask:mask?1:0,uFovea:foveaSsr},{uColor:sceneBeforeOverlay,uDepth:gpu.samples>1?targets.resolvedDepth:targets.depth,uReceiverTiles:targets.a}));
    reflectionPass.draw(3);reflectionPass.end();stats.drawCalls++;
   }
   const chain=[targets.a,targets.halo8,targets.halo16,targets.halo32];
   for(let i=1;i<chain.length;i++)postPass(chain[i].view,'down'+i,{uPass:1,uTexel:[1/chain[i-1].width,1/chain[i-1].height]},{uBloom:chain[i-1]},'FERRO bloom down '+i);
   for(let i=chain.length-1;i>0;i--)postPass(chain[i-1].view,'up'+i,{uPass:2,uTexel:[1/chain[i].width,1/chain[i].height]},{uBloom:chain[i]},'FERRO bloom up '+i,true);
  }
  postPass(output,'composite',{uPass:3,uBloomTexel:stats.bloom?[1/targets.a.width,1/targets.a.height]:[0,0],uBloomStrength:stats.bloom?config.bloomStrength/BLOOM_LEVELS:0,uExposure:tone.exposure,uTonemap:tone.index,uReflections:stats.reflections?1:0,uVignette:config.vignette,uScreenEffects:[fx.damage||0,Math.max(0,Math.min(1,fx.pulse||0)),brightness,config.dither?1:0],uResolution:[canvas.width,canvas.height]},{uScene:targets.scene,uBloom:stats.bloom?targets.a:white,uReflection:stats.reflections?targets.reflection:white},'FERRO present',false,true);
  finishTiming(encoder,timed);device.queue.submit([encoder.finish()]);readTiming(timed);evictIdleLots();stats.gpuBuffers=buffers.size;stats.gpuTextures=textures.size;stats.pipelineCount=pipelines.size;stats.uniformSlots=bindings.size;
 }
 function draw(camera,dynamic,fx){counting=true;try{render(camera,dynamic,fx);}finally{counting=false;}}
 // Préchauffage, mêmes signatures que WebGL 2. Les cibles des effets naissent à leur premier rendu. prewarm rend chaque variante une fois pour créer ce qui
 // naît au premier usage (tampons d'uniformes par passe, groupes de liaison, flux d'instances) et attend la file GPU.
 // Limite : le nombre d'échantillons fait partie de la clé des cibles ; basculer msaa ou halo les réalloue.
 const clock=()=>G.performance?.now?.()??Date.now();
 function effectiveKey(fx){const bloom=bloomEnabled(fx),samples=msaaEnabled(fx)?4:1,shadows=shadowsEnabled(fx),ssr=config.reflections&&bloom&&fx.reflections!==false&&fx.reflections!=='off';return 'halo:'+(bloom?1:0)+' msaa:'+(samples>1?1:0)+' ombres:'+(shadows?(fx.shadowMapScale===1?1:config.shadowMapScale):0)+' reflets:'+(ssr?1:0);}
 function prewarmVariants(fx,list){
  if(Array.isArray(list))return [...list.filter(v=>v&&typeof v==='object'),{}];
  // Comme en WebGL 2 : chaque fonction prend la valeur du jeu ou « coupé », jamais « forcé » (options.variants pour le reste).
  const seen=new Set([effectiveKey(fx)]),out=[],valeurs=v=>v===false?[false]:[false,v];
  for(const msaa of valeurs(fx.msaa))for(const bloom of valeurs(fx.bloom))for(const shadows of valeurs(fx.shadows))for(const reflections of valeurs(fx.reflections)){const variant={msaa,bloom,shadows,reflections},key=effectiveKey({...fx,...variant});if(!seen.has(key)){seen.add(key);out.push(variant);}}
  out.push({});return out;
 }
 function prewarmExtras(camera,allShapes){
  const p=camera.pos||[0,1.6,0],f=S.cameraAxes(camera).forward,at=[p[0]+f[0]*4,p[1]+f[1]*4,p[2]+f[2]*4],s=[.05,.05,.05],r=[0,0,0],c=[.5,.5,.5];
  const solid=allShapes?Object.keys(source.ranges):['box'],glow=allShapes?solid:['sphere'],out=[];
  for(const shape of solid)out.push({shape,p:at,s,r,mat:0},{shape,p:at,s,r,mat:0,overlay:true});
  for(const shape of glow)out.push({shape,p:at,s,r,mat:0,fx:true,alpha:.5,color:c},{shape,p:at,s,r,mat:0,overlay:true,fx:true,alpha:.5,color:c});
  return out;
 }
 function reserveSlot(slot,bytes){if(!(bytes>0)||slot.buffer&&slot.capacity>=bytes)return;freeBuffer(slot.buffer);slot.buffer=buffer(bytes,GPUBufferUsage.VERTEX,'FERRO instances');slot.capacity=align(bytes);slot.batch=null;}
 // Mémoire nominale des cibles (tous les formats employés font 4 octets par échantillon) et de l'atlas d'ombres.
 function targetBytes(){let bytes=0;if(targets)for(const t of Object.values(targets))if(t?.texture)bytes+=t.width*t.height*4*(t.sampleCount||1);if(shadowTarget)bytes+=shadowTarget.width*shadowTarget.height*4;return bytes;}
 function prewarm(camera,dynamic,fx,options){
  camera=camera||{};fx=fx||{};options=options||{};
  const start=clock(),timeoutMs=Number.isFinite(options.timeoutMs)&&options.timeoutMs>=0?options.timeoutMs:4000;
  const report={variants:0,draws:0,drawCalls:0,triangles:0,lots:0,nappes:0,subsets:0,creations:0,bytes:0,keys:[],ms:0,submitMs:0,waitMs:0,fallback:false};
  if(disposed||stats.contextLost||warm){report.fallback=warm?'busy':'lost';report.ms=clock()-start;return Promise.resolve(report);}
  retained=true;
  const list=prewarmVariants(fx,options.variants),snapshot=Object.assign({},stats);
  const savedLight=shadowLight,savedPlan=actorLightPlan,savedCasters=lampCasters.slice(),savedCaches=staticCaches.map(c=>({entries:c.entries,batch:c.batch}));
  warm={extra:prewarmExtras(camera,options.allShapes===true),creations:0,lots:0,nappes:0,subsets:0};let failure=null;
  try{
   report.variants=list.length;
   for(const variant of list){if(stats.contextLost)break;const merged={...fx,...variant,adaptive:false};render(camera,dynamic,merged);report.draws++;report.drawCalls+=stats.drawCalls;report.triangles+=stats.triangles;report.keys.push(effectiveKey(merged));}
   const reserve=options.reserve||{},instances=v=>Number.isFinite(v)&&v>0?Math.ceil(v)*64:0;
   if(!stats.contextLost){reserveSlot(dynamicSlot,instances(reserve.dynamic));reserveSlot(overlaySlot,instances(reserve.overlay));reserveSlot(fxSlot,instances(reserve.effects));reserveSlot(overlayFxSlot,instances(reserve.effects));}
  }catch(error){failure=error;}finally{
   report.creations=warm.creations;report.lots=warm.lots;report.nappes=warm.nappes;report.subsets=warm.subsets;warm=null;
   shadowLight=savedLight;actorLightPlan=savedPlan;lampCasters=savedCasters;
   if(!stats.contextLost)for(let i=0;i<staticCaches.length;i++){const c=staticCaches[i],k=savedCaches[i];if(c.entries===k.entries&&c.batch===k.batch)continue;c.entries=k.entries;c.batch=k.batch;if(k.batch.groups.length)ensureSlot(c,k.batch,true);}
   const lost=stats.contextLost,deviceLost=stats.deviceLost;Object.assign(stats,snapshot);stats.contextLost=lost;stats.deviceLost=deviceLost;stats.creations=0;
  }
  if(failure)return Promise.reject(failure);
  report.bytes=targetBytes();report.submitMs=clock()-start;
  // Pas de gl.finish en WebGPU : au-delà de timeoutMs, la promesse se résout (fallback « timeout ») et le travail continue.
  return new Promise(resolve=>{
   const begin=clock();let done=false,timer=null;
   const finish=fallback=>{if(done)return;done=true;if(timer!==null&&typeof G.clearTimeout==='function')G.clearTimeout(timer);report.waitMs=clock()-begin;report.ms=clock()-start;report.fallback=fallback;resolve(report);};
   if(typeof device.queue.onSubmittedWorkDone!=='function'){finish('unsupported');return;}
   if(typeof G.setTimeout==='function')timer=G.setTimeout(()=>finish('timeout'),timeoutMs);
   device.queue.onSubmittedWorkDone().then(()=>finish(stats.contextLost?'lost':false),()=>finish('failed'));
  });
 }
 // WebGPU ne libère aucune cible à l'inactivité : retain ne fait que mémoriser l'état demandé.
 function retain(value){if(value===undefined)return retained;retained=!!value;return retained;}
 function resetStats(){stats.creations=0;return stats;}
 // La copie doit être demandée dans la même tâche que draw(), avant la présentation implicite
 // de la source. Elle conserve les texels après post-traitement, sans transfert au processeur.
 const presentations=new Map();
 function createPresentation(target){
  if(disposed||stats.deviceLost||!target||target===canvas)throw Error('FERRO WebGPU : toile de présentation invalide');
  if(presentations.has(target))return presentations.get(target);
  const surface=target.getContext('webgpu');
  if(!surface)throw Error('FERRO WebGPU : présentation secondaire indisponible');
  surface.configure({device,format:canvasFormat,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC});
  let active=true;
  const presentation={
   present(){
    if(!active||disposed||stats.deviceLost)return false;
    const source=context.getCurrentTexture();
    if(target.width!==source.width)target.width=source.width;
    if(target.height!==source.height)target.height=source.height;
    const destination=surface.getCurrentTexture(),encoder=device.createCommandEncoder({label:'FERRO present to canvas'});
    encoder.copyTextureToTexture({texture:source},{texture:destination},[source.width,source.height]);
    device.queue.submit([encoder.finish()]);return true;
   },
   dispose(){if(!active)return;active=false;presentations.delete(target);surface.unconfigure();}
  };
  presentations.set(target,presentation);return presentation;
 }
 function dispose(){if(disposed)return;disposed=true;for(const surface of presentations.values())surface.dispose();profiling=false;nativeSurface?.dispose();localWind.reset();terrainView.reset();releaseTerrain();releaseLots();try{context.unconfigure();}catch{}for(const b of buffers)b.destroy();for(const t of textures)t.destroy();buffers.clear();textures.clear();timing?.query.destroy();bindings.clear();pipelines.clear();copyPipelines.clear();chunks.clear();programs.clear();releaseDevice();}
 initializeCleanup=dispose;
 // Resolve expensive shader/pipeline compilation before the title screen or a
 // measured gameplay frame. Validation errors fail creation and permit fallback.
 for(const samples of config.msaa?[1,4]:[1]){pipeline('world',{samples});pipeline('world',{samples,masked:true});pipeline('world',{samples,background:true,masked:true});pipeline('world',{samples,overlay:true});pipeline('world',{samples,overlay:true,masked:true});pipeline('world',{samples,nappe:true});pipeline('world',{samples,nappe:true,masked:true});pipeline('world',{samples,nappe:'rigid'});pipeline('fx',{samples});pipeline('sky',{samples});}
 pipeline('depth',{samples:1});pipeline('depth',{samples:1,masked:true});pipeline('ssr',{samples:1});pipeline('post',{samples:1});postAdditive();pipeline('post',{samples:1,target:canvasFormat});
 await settleMaterials();
 resize();const validationPromise=device.popErrorScope();scope=false;const validation=await validationPromise;if(validation)throw Error('WebGPU initialization: '+validation.message);if(stats.deviceLost)throw Error('FERRO WebGPU : périphérique perdu');
 return {setEnvironment(value){environment=S.environmentInfo(value);},setWorld,updateWorld,draw,resize,dispose,createPresentation,stats,actorFilter,setNappes,setLots,preparerLot,updateShape,gpu,prewarm,retain,resetStats,setRenderScale:value=>nativeSurface?.setScale(value),setMaxPixels(value){runtimeMaxPixels=Number.isFinite(value)&&value>0?value:0;nativeSurface?.setMaxPixels?.(runtimeMaxPixels);return resize();},setBudgetTarget:value=>surfaceBudget?.setTarget(value),precalculerOmbre,...(primitiveIndexing?{setPrimitiveIndexing}:{}),setProfiling,getProfiling(){return {available:stats.gpuTimingAvailable,enabled:profiling,samples:timingSamples.slice(),dropped:timingDropped};}};
 }catch(error){if(scope)await device.popErrorScope().catch(()=>{});
  // Une cuisson lancée puis abandonnée rend ses textures (les détruire deux fois est sans effet).
  const late=baking&&await baking;for(const t of late?.bake?.textures||[])t.destroy();initializeCleanup();throw error;}
 finally{unlock();if(initializing.get(device)===current)initializing.delete(device);}
}
G.FRenderWebGPU={create,writeUniforms,uniformWriter,bootBake,bake:BAKE,pbrRecipe:PBR_RECIPE};
})(globalThis);
