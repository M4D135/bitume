import assert from 'node:assert/strict';
// Le double enregistre le contenu du tampon réellement envoyé et la vie des ressources privées.
// La compilation, les pixels de réfraction et la perte d'appareil sont vérifiés en navigateur.
globalThis.GPUTextureUsage={COPY_SRC:1,COPY_DST:2,TEXTURE_BINDING:4,RENDER_ATTACHMENT:16};
globalThis.GPUBufferUsage={COPY_DST:8,UNIFORM:64};
export function toileWebGPU(support=true){
  const appels={dessins:0,copies:0,copiesGPU:0,textures:0,tampons:0,groupes:0,liberes:0,uniformes:{},contextes:[]};
  function ressource(){let libere=false;return {destroy(){assert(!libere);libere=true;appels.liberes++;}};}
  const device={lost:new Promise(r=>{appels.perdre=r;}),createShaderModule:()=>({}),createSampler:()=>({}),
    createRenderPipeline:d=>({entree:d.fragment.entryPoint,getBindGroupLayout:()=>({})}),
    createBindGroup:()=>{appels.groupes++;return {};},createBuffer:()=>{appels.tampons++;return ressource();},
    createTexture:d=>{appels.textures++;return {...ressource(),createView:()=>({}),format:d.format,width:d.size[0],height:d.size[1]};},
    createCommandEncoder:()=>({copyTextureToTexture(){appels.copiesGPU++;},beginRenderPass:()=>({setPipeline(){},setBindGroup(){},draw(){appels.dessins++;},end(){}}),finish:()=>({})}),
    queue:{submit(){},copyExternalImageToTexture(){if(appels.echouerCopie)throw Error('source refusée');appels.copies++;},writeBuffer(b,o,m){
      const mots=new Uint32Array(m.buffer),f=(i,n)=>Array.from(m.subarray(i,i+n));
      appels.uniformes={uVue:f(8,4),uFlux:f(12,4),uGravite:f(16,4),uTransport:f(24,48),uHistoire:f(72,48),uPhase:f(120,12),
        uGouttes:f(132,128),uTrajets:f(260,128),uImpacts:f(388,128),uTuilesGouttes:Array.from(mots.subarray(516,660)),uNbGouttes:mots[672],uAvecScene:!!m[23]};
    }}};
  const contexte={configure(){},unconfigure(){},getCurrentTexture(){return {createView:()=>({})};}};
  const canvas={style:{},ownerDocument:{},width:1,height:1,clientWidth:1280,clientHeight:720,getBoundingClientRect:()=>({width:1280,height:720}),
    getContext(n){appels.contextes.push(n);assert(['2d','webgpu'].includes(n));return n==='webgpu'?(support?contexte:null):{};}};
  const gpu={device,canvasFormat:'bgra8unorm'};
  return {canvas,appels,gpu};
}
