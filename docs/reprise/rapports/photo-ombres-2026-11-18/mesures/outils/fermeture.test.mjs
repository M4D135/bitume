// FERRO 0.3.11 : option de création ombresPhoto. Contact analytique des voitures (fx.contacts), carte lointaine
// précalculée (precalculerOmbre), tuile de la voiture filmée (fx.ombreProche) et pénombre selon la distance et la
// météo (fx.penombre). Le contexte WebGL est un double instrumenté : il enregistre chaque appel sans simuler les
// shaders ni l'image. Ce qui est vérifié : sans l'option, les mêmes sources de shader et la même suite d'appels GL
// qu'en 0.3.10 (empreintes ci-dessous), pour les réglages de création de chacun des quatre jeux et d'autres jeux
// d'options, même quand le jeu passe les nouveaux champs ; avec elle, le contrat des ressources (rien n'est créé en
// course), la répartition des pièces entre les passes, la variante sans PCSS (ombresPhoto.pcss: false), la sphère
// des contacts, et la répartition de la tuile sans allocation à l'image (échantillonneur du tas de V8, témoin compris).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import inspector from 'node:inspector';
import vm from 'node:vm';

const SOURCE=readFileSync('/Users/david/Projects/ferro-wt/photo/src/ferro/renderer.js','utf8');
const MODULE=nom=>readFileSync('/Users/david/Projects/ferro-wt/photo/src/ferro/'+nom+'.js','utf8');
// Empreintes SHA-256 de FERRO 0.3.10 (39eafee) pour scene() ci-dessous : sources des shaders compilés, puis suite des
// appels GL de trois images, pour chaque jeu d'options de CREATIONS. Elles se recalculent avec `node
// tests/ferro/renderer-ombres-photo.test.mjs --empreintes <renderer.js>` ; une différence voulue du chemin par défaut
// doit les remplacer, avec sa raison dans le message.
const EMPREINTES_0310={
  'bitume':{shaders:'d2d7472d18ad32fb19cad500eb150ba460e7e0133102052b1902a7b1b0b7a059',appels:'d7d36b9824392b3a10df726b8cd3f4a3b88706645b43c22ee743379e06ea6a5c'},
  'defaut':{shaders:'d2d7472d18ad32fb19cad500eb150ba460e7e0133102052b1902a7b1b0b7a059',appels:'fe73b32ea56c6041f727150ac4a250583cb87880475a5b9f4ff402da6b503ed4'},
  'emprise':{shaders:'2059d821bc0177b9b2c69c2625dff77685641abe13cadaac8eaef33b6ee17239',appels:'7f2df0a0b7702fadbadf7c4880de264accadd3d27a6e8e137a1cbb75c1fc4467'},
  'point-de-rupture':{shaders:'0221e1667224a592290f1409192ce3a00677f7d721b3a6640471826e25f4ebdf',appels:'cc9f7b0783dd6f285ec5c13d78365c810e5501097cd141e784cb52bf8289e1c2'},
  'metal':{shaders:'1f8d021d6cc5b02565a42a9cb70cf774ccfd45c48155a0717f2f0e617c2e0c9c',appels:'7745921c207df38ccbef7bd0528d93267300094b6a893653e8b840a617847ef5'},
  'composition':{shaders:'eb38652a983dd37938b2321c59bfcdb893e6298b568e99b20ecb7019569dd6d5',appels:'f8e51511eed6a41529cf7570c70811746641441ead83b59213b518b6b7cb388b'},
  'reflets-scene':{shaders:'f8819776b4e95aa7eb80c609b461022ce4ff307dae5a3811c72fd44d2a01712b',appels:'047a611deacc95fa47052bf510c3c1fd61b9329274f1455e3afb7639a32b2ca9'},
  'divers':{shaders:'d2d7472d18ad32fb19cad500eb150ba460e7e0133102052b1902a7b1b0b7a059',appels:'7c49a3e21b77624d58dff91b88a0c390ef3d5ff07d098e1766fd408b8ec1b330'}
};

function fixture(source,options={}){
  const state={serial:0,constant:256,unit:0,boundDraw:null,boundRead:null,boundFramebuffer:null,boundArray:null,program:null,trace:null,lost:false};
  const live=new Map(),draws=[],listeners=new Map(),bindings=new Map(),constants=new Map(),samplers=new Map(),shaders=[];
  const canvas={width:640,height:360,clientWidth:640,clientHeight:360,getContext:()=>gl,
    addEventListener:(name,f)=>listeners.set(name,f),removeEventListener:name=>listeners.delete(name)};
  const make=kind=>{const h={kind,id:++state.serial};live.set(h.id,h);return h;};
  const remove=h=>{if(h)live.delete(h.id);};
  const raw={
    createFramebuffer:()=>make('Framebuffer'),deleteFramebuffer:remove,createTexture:()=>make('Texture'),deleteTexture:remove,
    createRenderbuffer:()=>make('Renderbuffer'),deleteRenderbuffer:remove,createBuffer:()=>make('Buffer'),deleteBuffer:remove,
    createSampler:()=>make('Sampler'),deleteSampler:remove,bindSampler:(unit,h)=>samplers.set(unit,h),
    createShader:type=>{const h=make('Shader');h.type=type;shaders.push(h);return h;},deleteShader:remove,shaderSource:(h,code)=>{h.code=code;},
    compileShader:()=>{},createProgram:()=>make('Program'),deleteProgram:remove,
    attachShader:(p,s)=>{(p.shaders||(p.shaders=[])).push(s);},linkProgram:()=>{},
    getShaderParameter:()=>true,getProgramParameter:()=>true,getShaderInfoLog:()=>'',getProgramInfoLog:()=>'',
    createVertexArray:()=>make('VertexArray'),deleteVertexArray:remove,
    activeTexture:u=>{state.unit=u;},bindTexture:(target,h)=>bindings.set(state.unit-gl.TEXTURE0,h),
    texImage2D(target,level,format,width,height){const h=bindings.get(state.unit-gl.TEXTURE0);if(h)h.storage={width,height,format};},
    texStorage3D(target,levels,format,width,height){const h=bindings.get(state.unit-gl.TEXTURE0);if(h)h.storage={width,height,format};},
    bindRenderbuffer:()=>{},renderbufferStorage(){},renderbufferStorageMultisample(){},
    bindFramebuffer:(target,h)=>{if(target!==gl.DRAW_FRAMEBUFFER)state.boundRead=h;if(target!==gl.READ_FRAMEBUFFER)state.boundDraw=h;state.boundFramebuffer=h;},
    framebufferTexture2D(target,attachment,texTarget,h){if(state.boundFramebuffer)state.boundFramebuffer[attachment]=h;},
    framebufferRenderbuffer(target,attachment,rbTarget,h){if(state.boundFramebuffer)state.boundFramebuffer[attachment]=h;},
    checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,
    bindBuffer:(target,h)=>{if(target===gl.ARRAY_BUFFER)state.boundArray=h;},
    useProgram:p=>{state.program=p;},
    drawElementsInstanced:(mode,count,type,offset,instances)=>draws.push({kind:'instanced',program:state.program,buffer:state.boundArray,target:state.boundDraw,count,offset,instances}),
    drawElements:(mode,count,type,offset)=>draws.push({kind:'elements',program:state.program,target:state.boundDraw,count,offset}),
    getParameter(p){if(p===gl.MAX_SAMPLES)return 4;if(p===gl.MAX_TEXTURE_SIZE||p===gl.MAX_RENDERBUFFER_SIZE)return 8192;if(p===gl.SCISSOR_BOX)return new Int32Array([0,0,640,360]);return 0;},
    isEnabled:()=>false,getExtension:()=>null,getUniformLocation:(program,name)=>({program,name}),
    fenceSync:()=>({id:++state.serial}),clientWaitSync:()=>gl.ALREADY_SIGNALED,deleteSync:()=>{},flush:()=>{},finish:()=>{},
    get drawingBufferWidth(){return canvas.width;},get drawingBufferHeight(){return canvas.height;}
  };
  const uniforms=new Map();
  const norm=v=>v===null||v===undefined?String(v):typeof v==='number'?+v.toFixed(5):typeof v!=='object'?v
    :ArrayBuffer.isView(v)?Array.from(v,x=>+(+x).toFixed(5)):Array.isArray(v)?Array.from(v,norm):v.kind?v.kind+'#'+v.id:v.program?'U'+v.program.id+':'+v.name:'objet';
  const gl=new Proxy(raw,{get(target,key){
    if(typeof key!=='string')return target[key];
    if(key in target){const value=target[key];if(typeof value!=='function')return value;return (...args)=>{
      const sent=key==='bufferData'&&args[4]!==undefined?[args[0],args[1].subarray(args[3],args[3]+args[4]),args[2]]:args;
      state.trace?.push([key,...sent.map(norm)]);return value(...args);};}
    if(/^[A-Z][A-Z_0-9]+$/.test(key)){if(!constants.has(key))constants.set(key,++state.constant);return constants.get(key);}
    return (...args)=>{
      // uniformes : dernière valeur par nom (uniform4fv(loc, data, srcOffset, srcLength) garde la tranche envoyée)
      if(/^uniform/.test(key)&&args[0]&&args[0].name){const a=args.slice(1);uniforms.set(args[0].name,key==='uniform4fv'&&a.length>=3?Array.from(a[0].subarray(a[1],a[1]+a[2])):a.map(x=>ArrayBuffer.isView(x)?Array.from(x):x));}
      state.trace?.push([key,...args.map(norm)]);};
  }});
  state.unit=gl.TEXTURE0;
  const context=vm.createContext({window:{devicePixelRatio:1,setTimeout,clearTimeout,...options.window}});
  // Modules facultatifs (ciel physique, reflets de scène, surface native) : chargés avant le moteur, comme une page.
  for(const nom of options.modules||[])vm.runInContext(MODULE(nom),context,{filename:nom+'.js'});
  vm.runInContext(source,context,{filename:options.filename||'renderer.js'});
  const renderer=context.FRender.create(canvas,options.creation||{});
  const resources=kind=>Array.from(live.values()).filter(h=>h.kind===kind);
  const depth=format=>resources('Texture').filter(h=>h.storage?.format===format);
  return {renderer,canvas,gl,state,live,draws,uniforms,samplers,bindings,shaders,resources,depth,listeners,
    lose(){state.lost=true;listeners.get('webglcontextlost')({preventDefault(){}});},restore(){state.lost=false;listeners.get('webglcontextrestored')();}};
}

const box=(p,s=[1,1,1],extra={})=>({shape:'box',p,s,mat:3,...extra});
function nappe(z){
  const v=[[-30,0,z-30],[30,0,z-30],[30,0,z+30],[-30,0,z+30]],sommets=new Float32Array(52);
  v.forEach((p,i)=>sommets.set([...p,0,1,0,0,0,0,4,.3,.3,.3],i*13));
  return {sommets,indices:new Uint32Array([0,1,2,0,2,3]),centre:[0,0,z],rayon:45};
}
const ATMOSPHERE={sunDirection:[.52,.58,.40],sunColor:[1.2,1.1,1],ambient:[.3,.35,.4],fog:[.6,.7,.8],fogDensity:.002,skyTop:[.3,.5,.8],skyBottom:[.6,.7,.8]};
// Voiture : caisse et quatre roues (ordinaires), une pièce d'habitacle (overlay) et un effet translucide.
function voiture(x,z,overlay=false){
  const o=overlay?{overlay:true,surface:'object'}:{};
  return [box([x,.4,z],[1.3,.7,4.2],o),{...box([x-.8,.3,z+1.3],[.3,.6,.6],o),shape:'cylinder'},{...box([x+.8,.3,z+1.3],[.3,.6,.6],o),shape:'cylinder'},
    {...box([x-.8,.33,z-1.3],[.45,.67,.67],o),shape:'cylinder'},{...box([x+.8,.33,z-1.3],[.45,.67,.67],o),shape:'cylinder'}];
}
function contacts(n){
  const boites=new Float32Array(6*24);
  for(let i=0;i<n;i++)boites.set([i*3,.42,-8,1, 0,0,-1,2.1, 0,1,0,.33, .65,.42,-.1,-.1, .29,.85,.14,0, .335,.81,.23,0],i*24);
  return {nombre:n,boites};
}
const camera={pos:[0,1.6,4],yaw:0,pitch:-.1,fov:60,far:400,sun:{center:[0,0,-20],extent:100,depth:286}};
const BITUME={msaa:4,shadowMapScale:2,reflections:true,sea:false,overlayLighting:'world'};
// Réglages de création des jeux (BITUME, VOILE : BITUME ; EMPRISE : src/game.js ; Point de rupture : REGLAGES_MOTEUR de
// Jeu/src/jeu.js ; METAL : src/game.js, sans la résolution native ni le rappel de budget), puis d'autres options.
const CREATIONS=[['bitume',BITUME],['defaut',{}],
  ['emprise',{msaa:4,shadowMapScale:1,vignette:.9,bloomThreshold:[.9,.99],indexPrimitives:true,preferWebGL2OnSafari:true}],
  ['point-de-rupture',{sea:false,reflections:false,msaa:4,shadowMapScale:2,vignette:.84,bloomThreshold:[.86,.98]}],
  ['metal',{sceneReflections:true,advancedSky:true,composition:true,dither:true,resolution:'native',renderScale:1},['skies','reflections','surface']],
  ['composition',{composition:true,msaa:4,shadowMapScale:2}],
  ['reflets-scene',{sceneReflections:true,reflections:true,vignette:.4,exactSpecular:true,dither:true,advancedSky:true},['skies','reflections']],
  ['divers',{renderScale:.8,allShapes:true,overlayLighting:'world',cullMargin:2,msaa:4}]];
function fxImage(t,extra={}){
  return {time:t,msaa:true,shadowMapScale:2,shadows:true,bloom:true,brightness:1,lights:[],torch:false,sunOnly:true,adaptive:false,frameMs:16,damage:0,flash:0,photo:1,reflections:false,windStrength:1,...extra};
}
// Scène commune : nappes, lots (dont une prairie et un lot « ombre: false »), voitures, trois images.
function scene(f,extra={}){
  f.renderer.resize(1);f.renderer.setWorld([],[],ATMOSPHERE);
  f.renderer.setNappes([nappe(-20),nappe(-90)]);
  const lots=[
    {centre:[8,0,-30],rayon:6,objets:[box([8,2,-30],[2,4,2]),{...box([10,3,-31]),shape:'sphere'}],loin:[box([8,2,-30],[2,4,2])]},
    {centre:[-6,0,-40],rayon:6,ombre:false,objets:[box([-6,0,-40],[4,.02,4])],loin:[box([-6,0,-40],[4,.02,4])]},
    {centre:[0,0,-140],rayon:8,objets:[box([0,4,-140],[3,8,3])],loin:[box([0,4,-140],[3,8,3])]}];
  f.renderer.setLots(lots);
  const dynamic=[...voiture(0,-8),...voiture(3,-14),...voiture(0,-1,true),{shape:'sphere',p:[1,1,-6],s:[.3,.3,.3],fx:true,alpha:.4,color:[.5,.5,.5]}];
  const images=[];
  for(let k=0;k<3;k++){f.state.trace=[];f.renderer.draw(camera,dynamic,fxImage(1+k/60,extra));images.push(f.state.trace);f.state.trace=null;}
  return {dynamic,images,lots};
}
const sha=text=>createHash('sha256').update(text).digest('hex');
const empreintes=(source,creation,extra,modules)=>{
  const f=fixture(source,{creation,modules});const {images}=scene(f,extra);
  return {f,shaders:sha(f.shaders.map(h=>h.code).join('\n/* --- */\n')),appels:sha(JSON.stringify(images))};
};
const NOUVEAUX={contacts:contacts(2),ombreProche:{centre:[0,.4,-8],etendue:3.5,debut:0,fin:5},penombre:'pcss',ombreLoin:true};

if(process.argv.includes('--empreintes')){
  const source=readFileSync(process.argv[process.argv.indexOf('--empreintes')+1],'utf8'),table={};
  for(const [nom,creation,modules] of CREATIONS){const e=empreintes(source,creation,undefined,modules);table[nom]={shaders:e.shaders,appels:e.appels};}
  console.log(JSON.stringify(table,null,1));
  process.exit(0);
}

test.skip('without ombresPhoto, shader sources and the full GL call sequence equal FERRO 0.3.10 for every host and option set, even with the new fx fields',()=>{
  assert.deepEqual(Object.keys(EMPREINTES_0310),CREATIONS.map(c=>c[0]));
  for(const [nom,creation,modules] of CREATIONS){
    const sans=empreintes(SOURCE,creation,undefined,modules),avec=empreintes(SOURCE,creation,NOUVEAUX,modules);
    assert.equal(sans.shaders,EMPREINTES_0310[nom].shaders,nom+' : sources des shaders');
    assert.equal(sans.appels,EMPREINTES_0310[nom].appels,nom+' : appels GL');
    assert.equal(avec.shaders,sans.shaders,nom+' : nouveaux champs ignorés (shaders)');
    assert.equal(avec.appels,sans.appels,nom+' : nouveaux champs ignorés (appels GL)');
    assert.equal(sans.f.renderer.stats.ombresPhoto,undefined);assert.equal(sans.f.renderer.precalculerOmbre({centre:[0,0,0],etendue:100}),null);
    assert.equal(sans.f.resources('Sampler').length,0,'aucun échantillonneur sans l\'option');
  }
});

test.skip('with ombresPhoto, the world shader gains the four effects once each and the original shadow() stays intact',()=>{
  const sans=fixture(SOURCE,{creation:BITUME}),avec=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:true}});
  const monde=f=>f.shaders.find(h=>h.code.includes('uniform vec3 uSunColor;')&&h.code.includes('float shadow(vec3 n,vec3 l,int slot)')).code;
  const a=monde(sans),b=monde(avec);
  for(const nom of ['photoContact','photoSoleil','uContact','uOmbreTuile','uOmbreLoin','uOmbreComparee','uPenombre'])assert(!a.includes(nom),nom);
  for(const piece of ['float photoContact(vec3 p,vec3 n)','float photoSoleil(vec3 n,vec3 l)','uniform highp sampler2DShadow uOmbreLoin;','light*=1.-uContactReglages.x*contactOcc;',
    'float sunlight=outdoors>.5?photoSoleil(geometricNormal,uSunDirection):0.;','environmentReflection*=1.-uContactReglages.x*contactOcc;'])
    assert.equal(b.split(piece).length-1,1,piece);
  const debut=a.indexOf('  float shadow(vec3 n,vec3 l,int slot)'),fin=a.indexOf('  void main() {');
  assert(b.includes(a.slice(debut,fin)),'shadow() inchangée (lampes, torche)');
  assert(!b.includes('float sunlight=outdoors>.5?shadow('));
  // Les autres programmes (profondeur, post, ciel, effets, réflexions d'écran) ne changent pas.
  const autres=f=>f.shaders.map(h=>h.code).filter(code=>code!==monde(f)).join('\n');
  assert.equal(autres(avec),autres(sans));
  assert.equal(avec.renderer.stats.ombresPhoto.penombre,'off');
  sans.renderer.dispose();avec.renderer.dispose();
});

test.skip('the shadow tile and comparison resources are created with the context, never while drawing',()=>{
  const f=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:true}});
  const d16=f.depth(f.gl.DEPTH_COMPONENT16);
  assert.deepEqual(d16.map(h=>h.storage.width).sort((x,y)=>x-y),[1,1024],'profondeur 1 × 1 et tuile 1024²');
  assert.equal(f.resources('Sampler').length,1);
  assert.equal(f.samplers.get(8)?.kind,'Sampler');assert.equal(f.samplers.get(10)?.kind,'Sampler');assert.equal(f.samplers.get(9),undefined);
  const g=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:{tuile:512}}});
  assert.deepEqual(g.depth(g.gl.DEPTH_COMPONENT16).map(h=>h.storage.width).sort((x,y)=>x-y),[1,512]);
  // Après une première image (cibles du jeu), les images avec tous les effets ne créent rien.
  const {dynamic}=scene(f,NOUVEAUX);f.renderer.resetStats();
  f.renderer.precalculerOmbre({centre:[0,0,-40],etendue:300,taille:2048,hauteur:900});
  for(let k=0;k<5;k++)f.renderer.draw(camera,dynamic,fxImage(2+k/60,NOUVEAUX));
  assert.equal(f.renderer.stats.creations,0,'aucune création en course');
  assert.deepEqual({...f.renderer.stats.ombresPhoto},{contacts:2,tuile:true,loin:true,penombre:'pcss',loinTaille:2048});
  f.renderer.dispose();
  for(const kind of ['Sampler','Framebuffer'])assert.equal(f.resources(kind).length,0,kind+' libérés');
  assert.equal(f.depth(f.gl.DEPTH_COMPONENT16).length,0,'textures de profondeur 16 bits libérées');
});

test.skip('fx.ombreProche moves the filmed car out of the sun pass and into the tile; the colour pass keeps every piece and the same calls',()=>{
  const f=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:true}});
  const {dynamic}=scene(f);
  const tile=f.depth(f.gl.DEPTH_COMPONENT16).find(h=>h.storage.width===1024);
  const cible=d=>d.target&&d.target[f.gl.DEPTH_ATTACHMENT];
  const passe=(fx)=>{f.draws.length=0;f.renderer.draw(camera,dynamic,fxImage(2,fx));return f.draws.filter(d=>d.kind==='instanced');};
  const somme=list=>list.reduce((s,d)=>s+d.instances,0);
  const base=passe({}),avec=passe({ombreProche:{centre:[0,.4,-8],etendue:3.5,debut:0,fin:5}});
  const soleil=list=>list.filter(d=>cible(d)&&cible(d)!==tile&&cible(d).storage?.format===f.gl.DEPTH_COMPONENT24);
  const tuile=list=>list.filter(d=>cible(d)===tile);
  const couleur=list=>list.filter(d=>!d.target||!d.target[f.gl.DEPTH_ATTACHMENT]||d.target[f.gl.COLOR_ATTACHMENT0]);
  const dynamicBuffer=base.filter(d=>d.instances===2&&d.count===36)[0]?.buffer;
  // Passe du soleil : les cinq pièces de la voiture filmée en moins ; tuile : ces cinq pièces et les cinq de l'habitacle.
  assert.equal(somme(soleil(base).filter(d=>d.buffer===dynamicBuffer))-somme(soleil(avec).filter(d=>d.buffer===dynamicBuffer)),5);
  assert.equal(somme(tuile(base)),0);assert.equal(somme(tuile(avec)),10);
  assert.equal(somme(couleur(avec)),somme(couleur(base)),'passe couleur : toutes les pièces');
  assert.equal(couleur(avec).length,couleur(base).length,'passe couleur : autant d\'appels');
  assert.equal(f.uniforms.get('uOmbreTuileReglages')[0],1);
  // Sans ombres (Légère), ni tuile ni partage : le contact seul reste.
  const leger=passe({shadows:false,ombreProche:{centre:[0,.4,-8],etendue:3.5,debut:0,fin:5},contacts:contacts(1)});
  assert.equal(somme(tuile(leger)),0);assert.equal(f.uniforms.get('uOmbreTuileReglages')[0],0);
  assert.deepEqual({...f.renderer.stats.ombresPhoto,loinTaille:0},{contacts:1,tuile:false,loin:false,penombre:'off',loinTaille:0});
  f.renderer.dispose();
});

test.skip('fx.contacts sends at most six cars of 24 floats with their settings; zero cars switch the term off',()=>{
  const f=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:true}});
  const {dynamic}=scene(f);
  const c=contacts(6);c.nombre=9;c.ambiance=.7;c.soleil=.9;c.exposant=2;c.marge=1.2;
  f.renderer.draw(camera,dynamic,fxImage(2,{contacts:c}));
  assert.equal(f.uniforms.get('uContactCount')[0],6);assert.equal(f.uniforms.get('uContact').length,144);
  assert.deepEqual(f.uniforms.get('uContactReglages').map(v=>+v.toFixed(4)),[.7,.9,2,1.2]);
  const deux=contacts(2);deux.boites=deux.boites.subarray(0,30);deux.nombre=2;
  f.renderer.draw(camera,dynamic,fxImage(2,{contacts:deux}));assert.equal(f.uniforms.get('uContactCount')[0],1,'borné par la taille du tableau');
  f.renderer.draw(camera,dynamic,fxImage(2,{contacts:{nombre:0,boites:new Float32Array(24)}}));
  assert.equal(f.uniforms.get('uContactCount')[0],0);assert.deepEqual(f.uniforms.get('uContactReglages').slice(0,2),[0,0]);
  f.renderer.dispose();
});

test.skip('ombresPhoto.pcss false compiles the world shader without the PCSS block; fx.penombre pcss then gives the weather floor',()=>{
  const monde=f=>f.shaders.find(h=>h.code.includes('uniform vec3 uSunColor;')&&h.code.includes('float shadow(vec3 n,vec3 l,int slot)')).code;
  const avec=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:{tuile:512}}}),sans=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:{tuile:512,pcss:false}}});
  const a=monde(avec),b=monde(sans);
  assert.equal(a.split('float photoPcss(').length-1,1);assert.equal(a.split('uniform highp sampler2DShadow uOmbreComparee;').length-1,1);
  for(const nom of ['photoPcss','uOmbreComparee','zb','nb>0.'])assert(!b.includes(nom),nom);
  for(const piece of ['float photoSoleil(vec3 n,vec3 l)','float photoContact(vec3 p,vec3 n)','uniform highp sampler2DShadow uOmbreLoin;','v+=wx[x]*wy[y]*step(z+dot(slope,tap-uv),texture(uShadowMap,tap).r);'])
    assert.equal(b.split(piece).length-1,1,piece);
  // Seul le bloc PCSS sépare les deux shaders : sans lui, le reste du texte est le même.
  const sansBloc=a.replace(/\n  \/\/ PCSS allégé[\s\S]*?\n  }\n  \/\/ Soleil avec l'option/,"\n  // Soleil avec l'option").replace('\n  uniform highp sampler2DShadow uOmbreComparee;','')
    .replace('\n      if(uPenombre.x>1.5&&full)v=photoPcss(uv,centre,wx,wy,z,slope,texel,p.z,n);\n      else','');
  assert.equal(sansBloc,b);
  const {dynamic}=scene(sans);
  sans.renderer.draw(camera,dynamic,fxImage(2,{penombre:'pcss'}));
  assert.equal(sans.uniforms.get('uPenombre')[0],1);assert.equal(sans.renderer.stats.ombresPhoto.penombre,'meteo');
  sans.renderer.draw(camera,dynamic,fxImage(2,{penombre:'meteo'}));assert.equal(sans.uniforms.get('uPenombre')[0],1);
  avec.renderer.dispose();sans.renderer.dispose();
});

test.skip('fx.contacts sends one sphere that holds the reach of every car, so the shader skips the loop outside it',()=>{
  const f=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:true}});
  const monde=f.shaders.find(h=>h.code.includes('float photoContact(vec3 p,vec3 n)')).code;
  assert.equal(monde.split('if(dot(e,e)>=uContactSphere.w*uContactSphere.w)return 0.;').length-1,1);
  const {dynamic}=scene(f);
  const c=contacts(6);c.marge=1.2;
  for(let i=0;i<6;i++){c.boites[i*24]=[-30,4,9,0,12,-7][i];c.boites[i*24+2]=[-8,15,-3,40,-22,1][i];c.boites[i*24+7]=1.5+i*.3;}
  f.renderer.draw(camera,dynamic,fxImage(2,{contacts:c}));
  const S=f.uniforms.get('uContactSphere');
  for(let i=0;i<6;i++){
    const o=i*24,d=Math.hypot(c.boites[o]-S[0],c.boites[o+1]-S[1],c.boites[o+2]-S[2]);
    assert(d+c.boites[o+7]+1.2<=S[3],'voiture '+i+' : '+(d+c.boites[o+7]+1.2)+' > '+S[3]);
  }
  assert(S[3]<60,'sphère bornée : '+S[3]);
  f.renderer.draw(camera,dynamic,fxImage(2,{contacts:{nombre:0,boites:new Float32Array(24)}}));
  assert.deepEqual(f.uniforms.get('uContactSphere'),[0,0,0,0]);
  f.renderer.dispose();
});

// Octets alloués à l'image par chaque fonction du moteur (renderer.js), mesurés par l'échantillonneur du tas de V8
// (un relevé tous les 16 octets en moyenne, objets ramassés compris) pendant 1000 images, après 1000 images de
// chauffe (code optimisé), avec 300 pièces dynamiques de plus que la scène commune.
async function allocations(source){
  const f=fixture(source,{creation:{...BITUME,ombresPhoto:{tuile:512}}});
  const commune=scene(f).dynamic,dynamic=[...commune];
  for(let i=0;i<60;i++)dynamic.push(...voiture(i%10*3-15,-20-Math.floor(i/10)*6));
  f.renderer.precalculerOmbre({taille:256,marge:20,dessous:300});
  const fx=fxImage(2,{contacts:contacts(3),ombreProche:{centre:[0,.4,-8],etendue:3.5,debut:0,fin:5},penombre:'meteo',ombreLoin:true});
  for(let i=0;i<1000;i++){fx.time=2+i/60;f.renderer.draw(camera,dynamic,fx);}
  const session=new inspector.Session();session.connect();
  const post=(m,p={})=>new Promise((ok,ko)=>session.post(m,p,(e,r)=>e?ko(e):ok(r)));
  await post('HeapProfiler.enable');
  await post('HeapProfiler.startSampling',{samplingInterval:16,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
  for(let i=0;i<1000;i++){fx.time=60+i/60;f.renderer.draw(camera,dynamic,fx);}
  const {profile}=await post('HeapProfiler.stopSampling');session.disconnect();
  const octets={};const visiter=n=>{const nom=n.callFrame.functionName||'(anonyme)';if(n.callFrame.url==='renderer.js')octets[nom]=(octets[nom]||0)+n.selfSize/1000;for(const k of n.children)visiter(k);};
  visiter(profile.head);f.renderer.dispose();
  return octets;
}
test('diag fermeture',async()=>{
  const ancre='function photoBind(fx,tuile,full){\n      const u=photoUniforms,c=fx.contacts;';
  const a=await allocations(SOURCE),b=await allocations(SOURCE.replace(ancre,ancre.slice(0,-1)+',photoNum=(v,d)=>Number.isFinite(v)?v:d;'));
  console.log('# photoBind sans fermeture '+(a.photoBind||0).toFixed(1)+' o/image, avec la fermeture de 0.3.11 '+(b.photoBind||0).toFixed(1)+' o/image');
  console.log('# total renderer.js sans '+Object.values(a).reduce((x,y)=>x+y,0).toFixed(0)+' avec '+Object.values(b).reduce((x,y)=>x+y,0).toFixed(0));
});
test.skip('fx.penombre: PCSS in full-atlas sun only, the weather floor alone in meteo, nothing without shadows',()=>{
  const f=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:true}});
  const {dynamic}=scene(f);
  const mode=fx=>{f.renderer.draw(camera,dynamic,fxImage(2,fx));return f.uniforms.get('uPenombre');};
  const pcss=mode({penombre:'pcss'});assert.equal(pcss[0],2);assert.equal(pcss[2],4);
  // rayon en texels par unité de profondeur : portée 285 m × 0,02 / (200 m / 2048)
  assert(Math.abs(pcss[1]-285*.02/(200/2048))<1e-3,String(pcss[1]));
  assert.equal(mode({penombre:{mode:'pcss',k:.04,rayonMax:3}})[2],3);
  assert.equal(mode({penombre:'meteo'})[0],1);
  assert.equal(mode({penombre:'pcss',sunOnly:false})[0],1,'atlas partagé : la météo seule');
  assert.equal(mode({penombre:'pcss',shadows:false})[0],0);
  assert.equal(mode({})[0],0);
  f.renderer.dispose();
});

test.skip('precalculerOmbre draws shadow-casting lots once (far versions), reuses its target, and is invalidated or replayed',()=>{
  const f=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:true}});
  const {dynamic}=scene(f);
  f.draws.length=0;
  const r=f.renderer.precalculerOmbre({centre:[0,0,-60],etendue:400,taille:2048,hauteur:1200});
  const far=f.depth(f.gl.DEPTH_COMPONENT16).find(h=>h.storage.width===2048);assert(far,'carte 2048²');
  assert.equal(r.taille,2048);assert.equal(r.octets,2048*2048*2);assert(Math.abs(r.texel-800/2048)<1e-9);
  // Deux lots projettent (le lot « ombre: false » non), chacun dans sa version lointaine ; aucune nappe.
  assert.equal(r.instances,2);assert.equal(f.draws.filter(d=>d.kind==='elements').length,0);
  assert.equal(f.draws.filter(d=>d.kind==='instanced').length,r.appels);
  assert(f.draws.every(d=>d.target&&d.target[f.gl.DEPTH_ATTACHMENT]===far));
  const textures=f.resources('Texture').length;
  f.renderer.precalculerOmbre({centre:[0,0,-60],etendue:400,taille:2048,hauteur:1200});
  assert.equal(f.resources('Texture').length,textures,'même taille : cible reprise');
  f.renderer.draw(camera,dynamic,fxImage(2));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],1);
  f.renderer.draw(camera,dynamic,fxImage(2,{ombreLoin:false}));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],0,'coupure par image');
  // Nouveaux lots : la carte n'est plus valable jusqu'au prochain précalcul.
  f.renderer.setLots([{centre:[8,0,-30],rayon:6,objets:[box([8,2,-30],[2,4,2])],loin:[box([8,2,-30],[2,4,2])]}]);
  f.renderer.draw(camera,dynamic,fxImage(2));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],0);
  f.renderer.precalculerOmbre({centre:[0,0,-60],etendue:400,taille:2048,hauteur:1200});
  f.renderer.draw(camera,dynamic,fxImage(2));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],1);
  // Autre soleil : invalide aussi.
  f.renderer.setWorld([],[],{...ATMOSPHERE,sunDirection:[-.4,.6,.3]});
  f.renderer.draw(camera,dynamic,fxImage(2));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],0);
  f.renderer.setWorld([],[],ATMOSPHERE);
  // Perte puis restauration du contexte : la carte est refaite sans appel du jeu.
  f.lose();f.restore();
  f.renderer.draw(camera,dynamic,fxImage(2));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],1);
  assert.equal(f.depth(f.gl.DEPTH_COMPONENT16).filter(h=>h.storage.width===2048).length>=1,true);
  // null libère la carte.
  f.renderer.precalculerOmbre(null);f.renderer.draw(camera,dynamic,fxImage(2));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],0);
  assert.throws(()=>f.renderer.precalculerOmbre({centre:[0,0],etendue:10}),/centre et etendue/);
  f.renderer.dispose();
});

test.skip('prewarm renders the shadow tile with a witness piece, and the race then creates nothing',async()=>{
  const f=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:true}});
  f.renderer.resize(1);f.renderer.setWorld([],[],ATMOSPHERE);f.renderer.setNappes([nappe(-20)]);
  f.renderer.setLots([{centre:[8,0,-30],rayon:6,objets:[box([8,2,-30],[2,4,2])],loin:[box([8,2,-30],[2,4,2])]}]);
  const tile=f.depth(f.gl.DEPTH_COMPONENT16).find(h=>h.storage.width===1024);
  f.draws.length=0;
  const report=await f.renderer.prewarm(camera,[],fxImage(1,{contacts:contacts(2),penombre:'pcss'}));
  assert.equal(report.fallback,false);
  assert(f.draws.some(d=>d.kind==='instanced'&&d.target&&d.target[f.gl.DEPTH_ATTACHMENT]===tile),'la tuile est tracée au préchauffage');
  const dynamic=[...voiture(0,-8),...voiture(0,-1,true)];
  for(let k=0;k<4;k++)f.renderer.draw(camera,dynamic,fxImage(2+k/60,NOUVEAUX));
  assert.equal(f.renderer.stats.creations,0);
  f.renderer.dispose();
});

test.skip('precalculerOmbre without a centre fits the shadow-casting lots in the sun frame; the same lot objects keep the map',()=>{
  const f=fixture(SOURCE,{creation:{...BITUME,ombresPhoto:true}});
  const {dynamic,lots}=scene(f);
  const r=f.renderer.precalculerOmbre({taille:1024,marge:20,dessous:300});
  assert.equal(r.taille,1024);assert.equal(r.instances,2);
  f.renderer.draw(camera,dynamic,fxImage(2));
  const M=f.uniforms.get('uOmbreLoinMatrice')[1],clip=c=>[0,1,2].map(i=>M[i]*c[0]+M[4+i]*c[1]+M[8+i]*c[2]+M[12+i]);
  // Chaque sphère de lot qui projette tient dans le carré, en profondeur aussi ; l'emprise est serrée à la marge près.
  let bord=0;
  for(const l of lots.filter(l=>l.ombre!==false)){
    const [x,y,z]=clip(l.centre),k=l.rayon/r.etendue;
    assert(Math.abs(x)+k<=1+1e-6&&Math.abs(y)+k<=1+1e-6,'lot dans le carré');
    assert(z-2*l.rayon/r.profondeur>=-1-1e-6&&z+2*l.rayon/r.profondeur<=1+1e-6,'lot dans la profondeur');
    bord=Math.max(bord,Math.abs(x)+k,Math.abs(y)+k);
  }
  assert(Math.abs(bord-(1-20/r.etendue))<1e-6,String(bord));
  assert(Math.abs(r.texel-2*r.etendue/1024)<1e-9);
  // setLots avec les mêmes objets (même tableau ou copie) garde la carte ; d'autres objets l'invalident.
  f.renderer.setLots(lots);f.renderer.draw(camera,dynamic,fxImage(2));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],1);
  f.renderer.setLots(lots.slice());f.renderer.draw(camera,dynamic,fxImage(2));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],1);
  f.renderer.setLots(lots.slice(0,2));f.renderer.draw(camera,dynamic,fxImage(2));assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],0);
  // Rejouée après restauration avec la même emprise automatique.
  f.renderer.setLots(lots);f.renderer.precalculerOmbre({taille:1024,marge:20,dessous:300});
  f.lose();f.restore();f.renderer.draw(camera,dynamic,fxImage(2));
  assert.equal(f.uniforms.get('uOmbreLoinReglages')[0],1);assert.deepEqual(f.uniforms.get('uOmbreLoinMatrice')[1],M);
  // Le lot « ombre: false » n'entre pas dans l'emprise : sans lui, la même.
  f.renderer.setLots([lots[0],lots[2]]);const sans=f.renderer.precalculerOmbre({taille:1024,marge:20,dessous:300});
  assert.equal(sans.etendue,r.etendue);assert.deepEqual(sans.centre,r.centre);assert.equal(sans.profondeur,r.profondeur);
  // Sans lot qui projette, pas de carte.
  f.renderer.setLots([lots[1]]);assert.equal(f.renderer.precalculerOmbre({taille:1024}),null);
  f.renderer.dispose();
});
