/* FERRO PhysX 5.12.0 — rigid bodies, CCD, sweeps. Requires physx-runtime.js pre-loaded.
   Offline CPU backend. Fixed steps retain their fractional remainder; backlog
   beyond maxSubSteps is dropped. No cross-platform bitwise determinism guarantee. */
(function(G){'use strict';
var P=null,_foundation=null,_initP=null,_ready=false,_ver='0.0.0',_worlds=new Set(),_qc=0,_allocator=null,_errors=null,_physics=null;
var _viewOwners=new WeakMap();

async function init(){
  if(_initP)return _initP;
  _initP=(async()=>{
    if(!G.FPhysXFactory)throw new Error('FPhysX: runtime absent');
    P=await G.FPhysXFactory({wasmBinary:G.FPhysXFactory.decodeWasm()});
    var v=P.PHYSICS_VERSION;
    _ver=((v>>24)&0xff)+'.'+((v>>16)&0xff)+'.'+((v>>8)&0xff);
    _allocator=new P.PxDefaultAllocator();_errors=new P.PxDefaultErrorCallback();_foundation=P.CreateFoundation(v,_allocator,_errors);
    const scale=new P.PxTolerancesScale();_physics=P.CreatePhysics(v,_foundation,scale);P.destroy(scale);
    _ready=true;return P;
  })();return _initP;
}
function isReady(){return _ready}
function status(){return{ready:_ready,version:_ver,worlds:_worlds.size,queryCount:_qc}}

function _v3(x,y,z){return new P.PxVec3(x||0,y||0,z||0)}
function _q(x,y,z,w){return x===undefined?new P.PxQuat(P.PxIDENTITYEnum.PxIdentity):new P.PxQuat(x,y,z,w)}
function _pose(px,py,pz,qx,qy,qz,qw){
  var p=_v3(px,py,pz),q=qx===undefined?_q():_q(qx,qy,qz,qw);
  var t=new P.PxTransform(p,q);P.destroy(p);P.destroy(q);return t;
}
function _rotZ(rad){
  var ax=_v3(0,0,1),q=new P.PxQuat(rad,ax);P.destroy(ax);
  var p=_v3(0,0,0),t=new P.PxTransform(p,q);P.destroy(p);P.destroy(q);return t;
}
function _vf(a,n,size=3){if(!(Array.isArray(a)||ArrayBuffer.isView(a))||!Number.isInteger(a.length)||a.length!==size)throw new TypeError(n+' array');for(var i=0;i<a.length;i++)if(!Number.isFinite(a[i]))throw new RangeError(n+'['+i+']');}
function _unit(q,n='quaternion'){_vf(q,n,4);if(Math.abs(Math.hypot(...q)-1)>1e-5)throw new RangeError(n+' unit quaternion');}
function _set(v,a){v.set_x(a[0]);v.set_y(a[1]);v.set_z(a[2]);return v;}
function _uint(value,name){if(!Number.isInteger(value)||value<0||value>0xFFFFFFFF)throw new RangeError(name);}

// WebIDL caches wrappers by native address. Releasing native memory does not
// evict those JS wrappers. Borrowed views must never be destroyed: keep their
// cache entries only while a live world uses them. Some getters share one
// native scratch address across worlds, so their owners are reference-counted.
function _forget(view){
  if(!view?.ptr||!view.__class__||_viewOwners.get(view)?.size)return;
  const cache=P.getCache(view.__class__);if(cache[view.ptr]===view)delete cache[view.ptr];
}
function _view(w,view){
  if(!view?.ptr||w._views.has(view))return view;
  w._views.add(view);let at=w._viewPointers.get(view.ptr);if(!at)w._viewPointers.set(view.ptr,at=new Set());at.add(view);
  let owners=_viewOwners.get(view);if(!owners)_viewOwners.set(view,owners=new Set());owners.add(w);return view;
}
function _releaseViews(w,pointer){
  const views=pointer===undefined?w._views:w._viewPointers.get(pointer);if(!views)return;
  for(const view of views){
    _viewOwners.get(view)?.delete(w);w._views.delete(view);_forget(view);
  }
  if(pointer===undefined)w._viewPointers.clear();else w._viewPointers.delete(pointer);
}
function _release(value){value.release();_forget(value);}
function _alive(w){if(w._disposed)throw new Error('FPhysX: disposed world');}
function _options(o={}){
  if(!['static','dynamic','kinematic'].includes(o.type??'dynamic'))throw new TypeError('body type');
  for(const [key,value,min,max] of [['mass',o.mass??1,Number.MIN_VALUE,Infinity],['friction',o.friction??.6,0,Infinity],['restitution',o.restitution??0,0,1]])if(!Number.isFinite(value)||value<min||value>max)throw new RangeError(key);
  for(const key of ['group','mask','queryGroup'])if(o[key]!==undefined)_uint(o[key],key);
  if(o.quaternion!==undefined)_unit(o.quaternion);
  if(o.centerOfMass!==undefined)_vf(o.centerOfMass,'centerOfMass');
  if(o.inertia!==undefined){_vf(o.inertia,'inertia');if(o.inertia.some(v=>v<=0))throw new RangeError('inertia>0');}
  for(const key of ['linearDamping','angularDamping'])if(o[key]!==undefined&&(!Number.isFinite(o[key])||o[key]<0))throw new RangeError(key);
  if(o.solverIterations!==undefined){_vf(o.solverIterations,'solverIterations',2);if(o.solverIterations.some(v=>!Number.isInteger(v)||v<1||v>255))throw new RangeError('solverIterations 1..255');}
  if(o.ccd&&o.type==='kinematic')throw new TypeError('CCD is for dynamic bodies; sweep kinematic targets');
  return o;
}
function _box(ob){
  if(!ob)throw new TypeError('box');
  const center=ob.center??[(ob.minX+ob.maxX)/2,(ob.minY+ob.maxY)/2,(ob.minZ+ob.maxZ)/2],half=ob.half??[(ob.maxX-ob.minX)/2,(ob.maxY-ob.minY)/2,(ob.maxZ-ob.minZ)/2];
  _vf(center,'center');_vf(half,'half');if(half.some(v=>v<=0))throw new RangeError('half>0');return {center,half};
}
function dispose(){
  if(_worlds.size)throw new Error('FPhysX: dispose worlds first');
  if(!_ready)return;
  _release(_physics);_release(_foundation);P.destroy(_allocator);P.destroy(_errors);
  _physics=_foundation=_allocator=_errors=P=null;_ready=false;_initP=null;_viewOwners=new WeakMap();
}

function _shader(contacts=false){
  var s=new P.PassThroughFilterShaderImpl();
  var flags=P.PxPairFlagEnum.eCONTACT_DEFAULT|P.PxPairFlagEnum.eDETECT_CCD_CONTACT;
  if(contacts)flags|=P.PxPairFlagEnum.eNOTIFY_TOUCH_FOUND|P.PxPairFlagEnum.eNOTIFY_TOUCH_PERSISTS|P.PxPairFlagEnum.eNOTIFY_TOUCH_CCD|P.PxPairFlagEnum.eNOTIFY_CONTACT_POINTS;
  s.filterShader=function(a0,w0,w1,w2,w3,a1,u0,u1,u2,u3){
    s.set_outputPairFlags(flags);
    if(!(w0&u1)||!(u0&w1))return P.PxFilterFlagEnum.eKILL;
    return P.PxFilterFlagEnum.eDEFAULT;
  };
  s.set_outputPairFlags(flags);
  return s;
}

function _mass(w,actor,o){
  var com=o.centerOfMass?_v3(...o.centerOfMass):null;
  try{var ok=com?P.PxRigidBodyExt.prototype.setMassAndUpdateInertia(actor,o.mass??1,com):P.PxRigidBodyExt.prototype.setMassAndUpdateInertia(actor,o.mass??1);if(!ok)throw new Error('FPhysX: mass/inertia configuration failed');}
  finally{if(com)P.destroy(com);}
  if(o.inertia){
    // An explicit diagonal is expressed in chassis-local axes about the COM,
    // not the principal-axis rotation inferred from asymmetric collision shapes.
    var p=_view(w,_view(w,actor.getCMassLocalPose()).get_p()),frame=_pose(p.get_x(),p.get_y(),p.get_z()),inertia=_v3(...o.inertia);
    try{actor.setCMassLocalPose(frame);actor.setMassSpaceInertiaTensor(inertia);}finally{P.destroy(inertia);P.destroy(frame);}
  }
}
function _convexPart(vertices){
  const owned=[],views=[];let mesh=null,geometry=null;
  try{
    const points=new P.PxArray_PxVec3(vertices.length/3);owned.push(points);const v=_v3(0,0,0);owned.push(v);
    for(let i=0;i<vertices.length;i+=3){v.set_x(vertices[i]);v.set_y(vertices[i+1]);v.set_z(vertices[i+2]);points.set(i/3,v);}
    const desc=new P.PxConvexMeshDesc();owned.push(desc);const data=desc.get_points(),begin=points.begin();views.push(data,begin);data.set_count(vertices.length/3);data.set_stride(12);data.set_data(begin);
    const flags=new P.PxConvexFlags(P.PxConvexFlagEnum.eCOMPUTE_CONVEX);owned.push(flags);desc.set_flags(flags);
    const scale=new P.PxTolerancesScale();owned.push(scale);const params=new P.PxCookingParams(scale);owned.push(params);
    mesh=P.PxTopLevelFunctions.prototype.CreateConvexMesh(params,desc);
    if(!mesh?.ptr)throw new Error('FPhysX: convex mesh cooking failed');
    geometry=new P.PxConvexMeshGeometry(mesh);return {geometry,mesh};
  }finally{if(!geometry&&mesh?.ptr)_release(mesh);for(let i=owned.length-1;i>=0;i--)P.destroy(owned[i]);for(const view of views)_forget(view);}
}
function _releaseParts(parts){for(const part of parts){P.destroy(part.geometry);if(part.mesh)_release(part.mesh);}}
function _addShapes(w,pos,parts,o){
  var type=o.type??'dynamic',pose=null,actor=null,shapes=[];
  try{
    pose=o.quaternion?_pose(...pos,...o.quaternion):_pose(...pos);
    actor=type==='static'?w._physics.createRigidStatic(pose):w._physics.createRigidDynamic(pose);
    if(!actor?.ptr)throw new Error('FPhysX: actor creation failed');
    if(type==='kinematic')actor.setRigidBodyFlag(P.PxRigidBodyFlagEnum.eKINEMATIC,true);
    if(o.ccd&&type!=='static')actor.setRigidBodyFlag(P.PxRigidBodyFlagEnum.eENABLE_CCD,true);
    for(const part of parts){
      const options=part.options||o,fr=options.friction??.6,re=options.restitution??0;
      var mat=w._physics.createMaterial(fr,fr,re),sf=null,shape=null;
      try{sf=new P.PxShapeFlags(P.PxShapeFlagEnum.eSIMULATION_SHAPE|P.PxShapeFlagEnum.eSCENE_QUERY_SHAPE);shape=w._physics.createShape(part.geometry,mat,true,sf);}
      finally{if(sf)P.destroy(sf);_release(mat);}
      if(!shape?.ptr)throw new Error('FPhysX: shape creation failed');shapes.push(shape);
      const fd=new P.PxFilterData(options.group??0xFFFFFFFF,options.mask??0xFFFFFFFF,0,0);
      try{shape.setSimulationFilterData(fd);fd.set_word0(options.queryGroup??options.group??0xFFFFFFFF);fd.set_word1(0);shape.setQueryFilterData(fd);}finally{P.destroy(fd);}
      if(part.pose){const local=_pose(...part.pose);try{shape.setLocalPose(local);}finally{P.destroy(local);}}
      if(actor.attachShape(shape)===false)throw new Error('FPhysX: shape attachment failed');
    }
    if(type==='dynamic')_mass(w,actor,o);
    if(type!=='static'){
      if(o.linearDamping!==undefined)actor.setLinearDamping(o.linearDamping);
      if(o.angularDamping!==undefined)actor.setAngularDamping(o.angularDamping);
      if(o.solverIterations)actor.setSolverIterationCounts(...o.solverIterations);
    }
    w._scene.addActor(actor);var id=w._nextId++;
    w._bodies.set(id,{actor,shape:shapes[0],shapes,type});w._actorIds.set(actor.ptr,id);return id;
  }catch(error){if(actor?.ptr){_releaseViews(w,actor.ptr);_release(actor);}for(const shape of shapes)_release(shape);throw error;}
  finally{if(pose)P.destroy(pose);_releaseParts(parts);}
}
function _addBody(w,pos,geom,o){return _addShapes(w,pos,[{geometry:geom}],o);}

function _contacts(w,capacity){
  const state=w.contacts={enabled:true,count:0,dropped:0,error:null,points:Array.from({length:capacity},()=>({a:0,b:0,x:0,y:0,z:0,nx:0,ny:0,nz:0,ix:0,iy:0,iz:0,separation:0}))};
  const buffer=new P.PxArray_PxContactPairPoint(capacity),callback=new P.PxSimulationEventCallbackImpl();
  w._contactBuffer=buffer;w._contactCallback=callback;
  for(const name of ['onConstraintBreak','onWake','onSleep','onTrigger'])callback[name]=()=>{};
  callback.onContact=(header,pairs,count)=>{
    try{
      // Callback arguments and getters are borrowed native views. Copy scalars
      // immediately; never destroy these views or retain their pointers.
      const h=_view(w,typeof header==='number'?P.wrapPointer(header,P.PxContactPairHeader):header);
      const p=_view(w,typeof pairs==='number'?P.wrapPointer(pairs,P.PxContactPair):pairs);
      const a=w._actorIds.get(_view(w,h.get_actors(0)).ptr)||0,b=w._actorIds.get(_view(w,h.get_actors(1)).ptr)||0;
      for(let i=0;i<count;i++){
        const pair=_view(w,P.NativeArrayHelpers.prototype.getContactPairAt(p,i)),remaining=capacity-state.count;
        if(remaining<=0){state.dropped+=pair.get_contactCount();continue;}
        const n=pair.extractContacts(_view(w,buffer.begin()),remaining);state.dropped+=Math.max(0,pair.get_contactCount()-n);
        for(let k=0;k<n;k++){
          const contact=_view(w,buffer.get(k)),at=_view(w,contact.get_position()),normal=_view(w,contact.get_normal()),imp=_view(w,contact.get_impulse()),out=state.points[state.count++];
          out.a=a;out.b=b;out.x=at.get_x();out.y=at.get_y();out.z=at.get_z();out.nx=normal.get_x();out.ny=normal.get_y();out.nz=normal.get_z();
          out.ix=imp.get_x();out.iy=imp.get_y();out.iz=imp.get_z();out.separation=contact.get_separation();
        }
      }
    }catch(error){state.error=String(error?.message||error);}
  };
  w._scene.setSimulationEventCallback(callback);
}

function createWorld(opts){
  if(!_ready)throw new Error('FPhysX: init() first');
  opts=opts||{};
  var grav=opts.gravity??[0,-9.81,0],fs=opts.fixedStep??1/60,ccdP=opts.ccdMaxPasses??8,maxSub=opts.maxSubSteps??4;
  _vf(grav,'gravity');if(!Number.isFinite(fs)||fs<=0||!Number.isInteger(maxSub)||maxSub<1||!Number.isInteger(ccdP)||ccdP<1)throw new RangeError('fixedStep / maxSubSteps / ccdMaxPasses');
  var contactCapacity=opts.maxContactPoints??128;
  if(!Number.isInteger(contactCapacity)||contactCapacity<1||contactCapacity>4096)throw new RangeError('maxContactPoints 1..4096');
  var scale=new P.PxTolerancesScale();
  var physics=_physics;
  var sd=new P.PxSceneDesc(scale);
  var gv=_v3(grav[0],grav[1],grav[2]);sd.set_gravity(gv);P.destroy(gv);
  var dispatcher=P.DefaultCpuDispatcherCreate(0);sd.set_cpuDispatcher(dispatcher);
  var sceneFlags=sd.get_flags();sceneFlags.raise(P.PxSceneFlagEnum.eENABLE_CCD);sd.set_flags(sceneFlags);
  sd.set_ccdMaxPasses(ccdP);
  var sh=_shader(opts.contacts===true);P.setupPassThroughFilterShader(sd,sh);
  var scene=physics.createScene(sd);P.destroy(sd);P.destroy(scale);_forget(sceneFlags);
  var w={_physics:physics,_scene:scene,_shader:sh,_dispatcher:dispatcher,_bodies:new Map(),_actorIds:new Map(),_views:new Set(),_viewPointers:new Map(),_statics:[],_nextId:1,
    _fixedStep:fs,_maxSub:maxSub,_acc:0,_disposed:false,
    contacts:{enabled:false,count:0,dropped:0,error:null,points:[]},
    addBox:function(pos,half,o){_alive(this);o=_options(o);_vf(pos,'pos');_vf(half,'half');
      if(half[0]<=0||half[1]<=0||half[2]<=0)throw new RangeError('half>0');
      return _addBody(this,pos,new P.PxBoxGeometry(half[0],half[1],half[2]),o||{});},
    addSphere:function(pos,r,o){_alive(this);o=_options(o);_vf(pos,'pos');if(!Number.isFinite(r)||r<=0)throw new RangeError('r>0');
      return _addBody(this,pos,new P.PxSphereGeometry(r),o||{});},
    addCapsule:function(pos,r,th,o){_alive(this);o=_options(o);_vf(pos,'pos');
      if(!Number.isFinite(r)||r<=0)throw new RangeError('r>0');
      if(!Number.isFinite(th)||th<=2*r)throw new RangeError('th>2r');
      var hh=(th-2*r)/2,id=_addBody(this,pos,new P.PxCapsuleGeometry(r,hh),o||{});
      var lp=_rotZ(Math.PI/2);this._bodies.get(id).shape.setLocalPose(lp);P.destroy(lp);var e=this._bodies.get(id);if(e.type==='dynamic')_mass(this,e.actor,o);return id;},
    addCompound:function(pos,shapes,o){
      _alive(this);o=_options(o);_vf(pos,'pos');if(!Array.isArray(shapes)||!shapes.length)throw new TypeError('compound shapes');
      const specs=shapes.map(s=>{
        if(!s||!['box','sphere','convex'].includes(s.type))throw new TypeError('compound shape type');
        if(s.type==='box'){_vf(s.half,'half');if(s.half.some(v=>v<=0))throw new RangeError('half>0');}
        else if(s.type==='sphere'){if(!Number.isFinite(s.radius)||s.radius<=0)throw new RangeError('radius>0');}
        else {if(!s.vertices||!Number.isInteger(s.vertices.length)||s.vertices.length<12||s.vertices.length%3)throw new RangeError('convex vertices xyz');_vf(s.vertices,'vertices',s.vertices.length);}
        if(s.pose){_vf(s.pose,'shape pose',7);_unit(s.pose.slice(3),'shape quaternion');}
        return {s,options:_options({...o,...s,type:o.type??'dynamic'})};
      });
      const parts=[];let transferred=false;
      try{
        for(const {s,options} of specs){const part=s.type==='convex'?_convexPart(s.vertices):{geometry:s.type==='box'?new P.PxBoxGeometry(...s.half):new P.PxSphereGeometry(s.radius)};part.pose=s.pose;part.options=options;parts.push(part);}
        transferred=true;return _addShapes(this,pos,parts,o);
      }finally{if(!transferred)_releaseParts(parts);}
    },
    addTriangleMesh:function(vertices,indices,o={}){
      _alive(this);if(o.type!==undefined&&o.type!=='static')throw new TypeError('triangle mesh must be static');
      o=_options({...o,type:'static'});const pos=o.pos??[0,0,0];_vf(pos,'pos');
      if(!vertices||!Number.isInteger(vertices.length)||vertices.length<9||vertices.length%3)throw new RangeError('triangle vertices xyz');_vf(vertices,'vertices',vertices.length);
      if(!(Array.isArray(indices)||ArrayBuffer.isView(indices))||!Number.isInteger(indices.length)||indices.length<3||indices.length%3)throw new RangeError('triangle indices');
      for(const i of indices)if(!Number.isInteger(i)||i<0||i>=vertices.length/3)throw new RangeError('triangle index');
      const owned=[],views=[];let mesh=null;
      try{
        const points=new P.PxArray_PxVec3(vertices.length/3);owned.push(points);const triangles=new P.PxArray_PxU32(indices.length);owned.push(triangles);
        const v=_v3(0,0,0);owned.push(v);
        for(let i=0;i<vertices.length;i+=3){v.set_x(vertices[i]);v.set_y(vertices[i+1]);v.set_z(vertices[i+2]);points.set(i/3,v);}
        for(let i=0;i<indices.length;i++)triangles.set(i,indices[i]);
        const desc=new P.PxTriangleMeshDesc();owned.push(desc);
        const pointData=desc.get_points(),triangleData=desc.get_triangles(),pointBegin=points.begin(),triangleBegin=triangles.begin();views.push(pointData,triangleData,pointBegin,triangleBegin);
        pointData.set_count(vertices.length/3);pointData.set_stride(12);pointData.set_data(pointBegin);
        triangleData.set_count(indices.length/3);triangleData.set_stride(12);triangleData.set_data(triangleBegin);
        if(!desc.isValid())throw new Error('FPhysX: invalid triangle mesh description');
        const scale=new P.PxTolerancesScale();owned.push(scale);const params=new P.PxCookingParams(scale);owned.push(params);params.set_suppressTriangleMeshRemapTable(false);
        mesh=P.PxTopLevelFunctions.prototype.CreateTriangleMesh(params,desc);
        if(!mesh?.ptr)throw new Error('FPhysX: triangle mesh cooking failed');
        // Cooking can reorder or discard triangles. Hosts attach surface data
        // to their input faces, so queries must return those original indices.
        const mapping=mesh.getTrianglesRemap(),faceRemap=new Uint32Array(mesh.getNbTriangles());views.push(mapping);
        for(let i=0;i<faceRemap.length;i++)faceRemap[i]=mapping?.ptr?P.NativeArrayHelpers.prototype.getU32At(mapping,i):i;
        const id=_addBody(this,pos,new P.PxTriangleMeshGeometry(mesh),o);this._bodies.get(id).faceRemap=faceRemap;return id;
      }finally{if(mesh?.ptr)_release(mesh);for(let i=owned.length-1;i>=0;i--)P.destroy(owned[i]);for(const view of views)_forget(view);}
    },
    remove:function(id){var e=this._bodies.get(id);if(!e)return;
      this._actorIds.delete(e.actor.ptr);this._scene.removeActor(e.actor,true);_releaseViews(this,e.actor.ptr);_release(e.actor);for(const shape of e.shapes)_release(shape);this._bodies.delete(id);},
    step:function(dt){if(this._disposed)throw new Error('FPhysX: disposed world');
      if(!Number.isFinite(dt)||dt<0)throw new RangeError('dt>=0');if(dt===0)return false;
      this._acc+=dt;var n=0,ok=false;
      if(this._acc>=this._fixedStep){this.contacts.count=0;this.contacts.dropped=0;this.contacts.error=null;}
      while(this._acc>=this._fixedStep&&n<this._maxSub){
        this._scene.simulate(this._fixedStep);this._scene.fetchResults(true);
        this._acc-=this._fixedStep;ok=true;n++;if(this.contacts.error)throw new Error('FPhysX contact callback: '+this.contacts.error);}
      if(n>=this._maxSub)this._acc%=this._fixedStep;return ok;},
    readPose:function(id,out=[]){_alive(this);var e=this._bodies.get(id);if(!e)return null;
      var t=_view(this,e.actor.getGlobalPose()),p=_view(this,t.get_p()),q=_view(this,t.get_q());
      out[0]=p.get_x();out[1]=p.get_y();out[2]=p.get_z();out[3]=q.get_x();out[4]=q.get_y();out[5]=q.get_z();out[6]=q.get_w();return out;},
    readVelocity:function(id,out=[]){_alive(this);var e=this._bodies.get(id);if(!e||e.type==='static')return null;
      var v=_view(this,e.actor.getLinearVelocity());out[0]=v.get_x();out[1]=v.get_y();out[2]=v.get_z();return out;},
    readAngularVelocity:function(id,out=[]){_alive(this);var e=this._bodies.get(id);if(!e||e.type==='static')return null;
      var v=_view(this,e.actor.getAngularVelocity());out[0]=v.get_x();out[1]=v.get_y();out[2]=v.get_z();return out;},
    force:function(id,force,point){_alive(this);var e=this._bodies.get(id);if(!e||e.type!=='dynamic')return;
      _vf(force,'force');if(point!==undefined)_vf(point,'force point');const v=_set(this._scratch.vector,force);
      if(point===undefined)e.actor.addForce(v,P.PxForceModeEnum.eFORCE,true);
      else P.PxRigidBodyExt.prototype.addForceAtPos(e.actor,v,_set(this._scratch.point,point),P.PxForceModeEnum.eFORCE,true);},
    torque:function(id,torque){_alive(this);var e=this._bodies.get(id);if(!e||e.type!=='dynamic')return;
      _vf(torque,'torque');e.actor.addTorque(_set(this._scratch.vector,torque),P.PxForceModeEnum.eFORCE,true);},
    impulse:function(id,imp){_alive(this);var e=this._bodies.get(id);if(!e||e.type!=='dynamic')return;
      _vf(imp,'imp');e.actor.addForce(_set(this._scratch.vector,imp),P.PxForceModeEnum.eIMPULSE,true);},
    setVelocity:function(id,vel){_alive(this);var e=this._bodies.get(id);if(!e||e.type!=='dynamic')return;
      _vf(vel,'vel');e.actor.setLinearVelocity(_set(this._scratch.vector,vel),true);},
    setAngularVelocity:function(id,vel){_alive(this);var e=this._bodies.get(id);if(!e||e.type!=='dynamic')return;
      _vf(vel,'angular velocity');e.actor.setAngularVelocity(_set(this._scratch.vector,vel),true);},
    setPose:function(id,pose){_alive(this);var e=this._bodies.get(id);if(!e)return;
      _vf(pose,'pose',7);_unit(pose.slice(3));const t=_pose(...pose);try{e.actor.setGlobalPose(t,true);}finally{P.destroy(t);}},
    setShapePose:function(id,index,pose){_alive(this);var e=this._bodies.get(id);if(!e)return;
      if(!Number.isInteger(index)||index<0||index>=e.shapes.length)throw new RangeError('shape index');
      _vf(pose,'shape pose',7);_unit(pose.slice(3));const t=_pose(...pose);try{e.shapes[index].setLocalPose(t);}finally{P.destroy(t);}},
    raycast:function(from,direction,distance,options={},out={}){
      _alive(this);_vf(from,'ray origin');_vf(direction,'ray direction');if(!Number.isFinite(distance)||distance<=0)throw new RangeError('ray distance>0');
      const mask=options.mask??0xFFFFFFFF;_uint(mask,'ray mask');const length=Math.hypot(...direction);if(length<1e-12)throw new RangeError('ray direction nonzero');
      out.hit=false;out.distance=Infinity;out.fraction=1;out.x=out.y=out.z=out.nx=out.ny=out.nz=0;out.body=0;out.faceIndex=-1;if(mask===0)return out;
      const s=this._scratch;_set(s.rayOrigin,from);s.rayDirection.set_x(direction[0]/length);s.rayDirection.set_y(direction[1]/length);s.rayDirection.set_z(direction[2]/length);
      _view(this,s.rayFilter.get_data()).set_word0(mask);s.rayFilter.set_flags(options.staticOnly===false?s.queryAll:s.queryStatic);s.rayResult.clear();
      this._scene.raycast(s.rayOrigin,s.rayDirection,distance,s.rayResult,s.hitFlags,s.rayFilter);_qc++;
      // The binding reports touches, even without a custom callback. Its growing
      // result retains capacity; choose the nearest from ALL hits, never 10 only.
      const count=s.rayResult.getNbAnyHits();
      for(let i=0;i<count;i++){
        const hit=_view(this,s.rayResult.getAnyHit(i)),d=hit.get_distance();if(d>=out.distance)continue;
        out.hit=true;out.distance=d;out.fraction=d/distance;const p=_view(this,hit.get_position());out.x=p.get_x();out.y=p.get_y();out.z=p.get_z();
        const n=_view(this,hit.get_normal());out.nx=n.get_x();out.ny=n.get_y();out.nz=n.get_z();out.body=this._actorIds.get(_view(this,hit.get_actor()).ptr)||0;
        const face=hit.get_faceIndex(),map=this._bodies.get(out.body)?.faceRemap;out.faceIndex=face===0xFFFFFFFF?-1:map?map[face]:face;
      }
      return out;
    },
    setKinematicTarget:function(id,pose){_alive(this);var e=this._bodies.get(id);if(!e||e.type!=='kinematic')return;
      _vf(pose,'pose',7);if(Math.abs(Math.hypot(...pose.slice(3))-1)>1e-5)throw new RangeError('unit quaternion');var t=_pose(pose[0],pose[1],pose[2],pose[3],pose[4],pose[5],pose[6]);
      e.actor.setKinematicTarget(t);P.destroy(t);},
    setStatics:function(list){_alive(this);if(!Array.isArray(list))throw new TypeError('statics array');list=list.map(_box);
      for(var i=0;i<this._statics.length;i++){this._scene.removeActor(this._statics[i],true);_releaseViews(this,this._statics[i].ptr);_release(this._statics[i]);}
      this._statics=[];if(!list||!list.length)return;
      for(var j=0;j<list.length;j++){var s=list[j];_vf(s.center,'sc');_vf(s.half,'sh');
        if(s.half[0]<=0||s.half[1]<=0||s.half[2]<=0)throw new RangeError('sh>0');
        var g=new P.PxBoxGeometry(s.half[0],s.half[1],s.half[2]);
        var m=this._physics.createMaterial(0.5,0.5,0);
        var sf=new P.PxShapeFlags(P.PxShapeFlagEnum.eSIMULATION_SHAPE|P.PxShapeFlagEnum.eSCENE_QUERY_SHAPE);
        var shp=this._physics.createShape(g,m,true,sf);P.destroy(sf);P.destroy(g);_release(m);
        var fd=new P.PxFilterData(0xFFFFFFFF,0xFFFFFFFF,0,0);shp.setSimulationFilterData(fd);fd.set_word1(0);shp.setQueryFilterData(fd);P.destroy(fd);
        var po=_pose(s.center[0],s.center[1],s.center[2]);
        var ac=this._physics.createRigidStatic(po);P.destroy(po);
        ac.attachShape(shp);_release(shp);this._scene.addActor(ac);this._statics.push(ac);}},
    dispose:function(){if(this._disposed)return;this._disposed=true;
      var ids=Array.from(this._bodies.keys());for(var i=0;i<ids.length;i++)this.remove(ids[i]);
      this._bodies.clear();
      for(var j=0;j<this._statics.length;j++){this._scene.removeActor(this._statics[j],true);_releaseViews(this,this._statics[j].ptr);_release(this._statics[j]);}
      this._statics=[];_release(this._scene);
      if(this._contactCallback)P.destroy(this._contactCallback);if(this._contactBuffer)P.destroy(this._contactBuffer);
      if(this._scratch)for(const value of Object.values(this._scratch))P.destroy(value);
      _releaseViews(this);this._actorIds.clear();P.destroy(this._dispatcher);P.destroy(this._shader);_worlds.delete(this);}
  };
  const queryStatic=new P.PxQueryFlags(P.PxQueryFlagEnum.eSTATIC),queryAll=new P.PxQueryFlags(P.PxQueryFlagEnum.eSTATIC|P.PxQueryFlagEnum.eDYNAMIC);
  const filter=new P.PxFilterData(0xFFFFFFFF,0,0,0),rayFilter=new P.PxQueryFilterData(filter,queryStatic);P.destroy(filter);
  w._scratch={vector:_v3(0,0,0),point:_v3(0,0,0),rayOrigin:_v3(0,0,0),rayDirection:_v3(0,-1,0),rayResult:new P.PxRaycastResult(),hitFlags:new P.PxHitFlags(P.PxHitFlagEnum.eDEFAULT),queryStatic,queryAll,rayFilter};
  if(opts.contacts===true)_contacts(w,contactCapacity);
  _worlds.add(w);return w;
}

function sweepBox(from,half,delta,obstacles,out){
  out=out||{};out.hit=false;out.distance=Infinity;out.fraction=1;out.nx=0;out.ny=0;out.nz=0;
  if(!_ready)throw new Error('FPhysX: init()');
  _vf(from,'from');_vf(half,'half');_vf(delta,'delta');
  if(half[0]<=0||half[1]<=0||half[2]<=0)throw new RangeError('half>0');
  var dx=delta[0],dy=delta[1],dz=delta[2],d=Math.sqrt(dx*dx+dy*dy+dz*dz);
  if(d<1e-9)return out;
  if(!Array.isArray(obstacles))obstacles=[obstacles];obstacles=obstacles.map(_box);if(!obstacles.length)return out;
  var dir=_v3(dx/d,dy/d,dz/d),gA=new P.PxBoxGeometry(half[0],half[1],half[2]);
  var pA=_pose(from[0],from[1],from[2]);
  var fl=new P.PxHitFlags(P.PxHitFlagEnum.eDEFAULT|P.PxHitFlagEnum.ePRECISE_SWEEP);
  var bd=Infinity,bnx=0,bny=0,bnz=0;
  for(var i=0;i<obstacles.length;i++){var ob=obstacles[i];
    _vf(ob.center,'oc');_vf(ob.half,'oh');
    var gB=new P.PxBoxGeometry(ob.half[0],ob.half[1],ob.half[2]);
    var pB=_pose(ob.center[0],ob.center[1],ob.center[2]);
    var hit=new P.PxSweepHit();
    var r=P.PxGeometryQuery.prototype.sweep(dir,d,gA,pA,gB,pB,hit,fl,0);_qc++;
    if(r){var hd=hit.get_distance();
      if(hit.hadInitialOverlap()){bd=0;bnx=0;bny=0;bnz=0;P.destroy(hit);P.destroy(gB);P.destroy(pB);break;}
      if(hd<bd){bd=hd;var n=hit.get_normal();bnx=n.get_x();bny=n.get_y();bnz=n.get_z();}}
    P.destroy(hit);P.destroy(gB);P.destroy(pB);}
  P.destroy(dir);P.destroy(gA);P.destroy(pA);P.destroy(fl);
  if(bd<Infinity){out.hit=true;out.distance=bd;out.fraction=bd/d;out.nx=bnx;out.ny=bny;out.nz=bnz;}
  return out;
}

function overlapBox(center,half,obstacles){
  if(!_ready)throw new Error('FPhysX: init()');
  _vf(center,'c');_vf(half,'h');
  if(half[0]<=0||half[1]<=0||half[2]<=0)throw new RangeError('half>0');
  if(!Array.isArray(obstacles))obstacles=[obstacles];obstacles=obstacles.map(_box);if(!obstacles.length)return false;
  var gA=new P.PxBoxGeometry(half[0],half[1],half[2]),pA=_pose(center[0],center[1],center[2]),f=false;
  for(var i=0;i<obstacles.length&&!f;i++){var ob=obstacles[i];
    var gB=new P.PxBoxGeometry(ob.half[0],ob.half[1],ob.half[2]);
    var pB=_pose(ob.center[0],ob.center[1],ob.center[2]);
    f=P.PxGeometryQuery.prototype.overlap(gA,pA,gB,pB);_qc++;
    P.destroy(gB);P.destroy(pB);}
  P.destroy(gA);P.destroy(pA);return f;
}

G.FPhysX=Object.freeze({init,isReady,status,createWorld,sweepBox,overlapBox,dispose,
  get queryCount(){return _qc}});
})(globalThis);
