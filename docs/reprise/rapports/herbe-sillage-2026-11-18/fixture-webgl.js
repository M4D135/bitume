// Derived from FERRO renderer-targets fixture; inert WebGL, never compiles or executes shaders.
function fixture(options={}){
  const bufferBindings=new Map();
  const live=new Map(),created=[],deleted=[],listeners=new Map(),bindings=new Map(),windUniforms=[],blits=[],draws=[],parameterReads=new Map();
  let serial=0,constant=256,unit=0,boundFramebuffer=null,boundRead=null,boundDraw=null,boundRenderbuffer=null,contextCalls=0;
  const canvas={width:640,height:360,clientWidth:640,clientHeight:360,
    getContext(type){assert.equal(type,'webgl2');contextCalls++;return gl;},
    addEventListener:(name,f)=>listeners.set(name,f),removeEventListener:name=>listeners.delete(name)};
  const make=kind=>{const h={kind,id:++serial};live.set(h.id,h);created.push(h);return h;};
  const remove=(kind,h)=>{if(!h)return;assert.equal(h.kind,kind);assert.ok(live.delete(h.id),'resource is deleted exactly once: '+kind+' '+h.id);deleted.push(h);};
  const constants=new Map();
  const raw={
    bindBuffer:(target,buffer)=>bufferBindings.set(target,buffer),
    bufferData(target,data){const h=bufferBindings.get(target);assert.ok(h);h.byteLength=typeof data==='number'?data:data.byteLength;},
    bufferSubData(target,offset,data){const h=bufferBindings.get(target);assert.ok(h);assert.ok(offset+data.byteLength<=h.byteLength);},
    drawElements:(mode,count,type,offset)=>draws.push({kind:'world',target:boundDraw,count,instances:1,mode}),
    drawArraysInstanced:(mode,first,count,instances)=>draws.push({kind:'world',target:boundDraw,count,instances,mode}),
    createFramebuffer:()=>make('Framebuffer'),deleteFramebuffer:h=>remove('Framebuffer',h),
    createTexture:()=>make('Texture'),deleteTexture:h=>remove('Texture',h),
    createRenderbuffer:()=>make('Renderbuffer'),deleteRenderbuffer:h=>remove('Renderbuffer',h),
    createBuffer:()=>make('Buffer'),deleteBuffer:h=>remove('Buffer',h),
    createShader:()=>make('Shader'),deleteShader:h=>remove('Shader',h),
    createProgram:()=>make('Program'),deleteProgram:h=>remove('Program',h),
    createVertexArray:()=>make('VertexArray'),deleteVertexArray:h=>remove('VertexArray',h),
    activeTexture:u=>{unit=u;},bindTexture:(target,h)=>bindings.set(unit+':'+target,h),
    texImage2D(target,level,format,width,height){const h=bindings.get(unit+':'+target);assert.ok(h);h.storage={width,height,format,samples:1};},
    texStorage3D(target,levels,format,width,height){const h=bindings.get(unit+':'+target);assert.ok(h);h.storage={width,height,format,samples:1};},
    bindRenderbuffer:(target,h)=>{boundRenderbuffer=h;},
    renderbufferStorage(target,format,width,height){assert.ok(boundRenderbuffer);boundRenderbuffer.storage={width,height,format,samples:1};},
    renderbufferStorageMultisample(target,samples,format,width,height){assert.ok(boundRenderbuffer);boundRenderbuffer.storage={width,height,format,samples};},
    bindFramebuffer:(target,h)=>{boundFramebuffer=h;if(target!==gl.DRAW_FRAMEBUFFER)boundRead=h;if(target!==gl.READ_FRAMEBUFFER)boundDraw=h;},
    blitFramebuffer:(...args)=>blits.push({read:boundRead,draw:boundDraw,args}),
    drawElementsInstanced:(mode,count,type,offset,instances)=>draws.push({kind:'world',target:boundDraw,count,instances,mode}),
    drawArrays:(mode,first,count)=>draws.push({kind:'fullscreen',target:boundDraw,count,instances:1,mode}),
    framebufferTexture2D(target,attachment,texTarget,h){assert.ok(boundFramebuffer);boundFramebuffer[attachment]=h;},
    framebufferRenderbuffer(target,attachment,rbTarget,h){assert.ok(boundFramebuffer);boundFramebuffer[attachment]=h;},
    checkFramebufferStatus(){
      const color=boundFramebuffer?.[gl.COLOR_ATTACHMENT0],depth=boundFramebuffer?.[gl.DEPTH_ATTACHMENT];
      if(options.failMsaa&&color?.storage.samples>1)return -1;
      if(options.failSource&&depth?.kind==='Texture'&&color)return -1;
      if(options.failReflection&&color?.storage.width===Math.ceil(canvas.width/2)&&color.storage.height===Math.ceil(canvas.height/2))return -1;
      if(options.failShadow&&!color&&depth?.kind==='Texture')return -1;
      return gl.FRAMEBUFFER_COMPLETE;
    },
    getParameter(p){parameterReads.set(p,(parameterReads.get(p)||0)+1);if(p===gl.MAX_SAMPLES)return options.samples??4;if(p===gl.MAX_TEXTURE_SIZE||p===gl.MAX_RENDERBUFFER_SIZE)return options.maxTextureSize??4096;return 0;},
    getShaderParameter:()=>true,getProgramParameter:()=>true,getExtension:()=>null,getUniformLocation:(program,name)=>({program,name}),
    uniform2f(location,wind,time){if(location?.name==='uWindTime')windUniforms.push({program:location.program.id,wind,time});},
    get drawingBufferWidth(){return canvas.width;},get drawingBufferHeight(){return canvas.height;}
  };
  const gl=new Proxy(raw,{get(target,key){
    if(key in target)return target[key];
    if(/^[A-Z][A-Z_0-9]+$/.test(key)){if(!constants.has(key))constants.set(key,++constant);return constants.get(key);}
    return ()=>{};
  }});
  // WebGL starts on TEXTURE0, before the renderer makes an explicit selection.
  unit=gl.TEXTURE0;
  const context=vm.createContext({window:{devicePixelRatio:1}});
  vm.runInContext(source,context);
  for(const [name,triangles] of registry)context.FRender.forme(name,triangles);
  const renderer=context.FRender.create(canvas,{msaa:4,reflections:true,shadowMapScale:2,...options.creation});
  renderer.setWorld([{shape:'box',p:[0,0,-8],s:[1,1,1],mat:3}],[],null);
  const camera={pos:[0,1,0],yaw:0,pitch:0,fov:60,far:100};
  const draw=fx=>renderer.draw(camera,[],{adaptive:false,shadows:false,bloom:true,msaa:true,reflections:true,...fx});
  const resources=kind=>Array.from(live.values()).filter(h=>h.kind===kind);
  const msaa=()=>resources('Renderbuffer').filter(h=>h.storage?.samples>1);
  const ssr=()=>resources('Texture').filter(h=>h.storage?.format===gl.DEPTH_COMPONENT24&&h.storage.width===canvas.width&&h.storage.height===canvas.height);
  return {renderer,canvas,gl,live,created,deleted,draw,resources,msaa,ssr,listeners,windUniforms,blits,draws,parameterReads,
    get contextCalls(){return contextCalls;},
    lose(){listeners.get('webglcontextlost')({preventDefault(){}});live.clear();},
    restore(){listeners.get('webglcontextrestored')();}};
}
