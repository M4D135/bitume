/* BITUME : backend WebGL2 FERRO repris du snapshot EMPRISE du 16/11/2026.
   Source renderer SHA-256 c268957562dba93843a4f017be5ae46210136161bd307c8fd0bb8a6a284a2e00.
   Adaptations course, météo, cockpit et index GPU : voir src/moteur/PROVENANCE.md. */
/* RADE FERRO 0.1 — base PDR, formes libres BITUME; voir docs/INTEGRATION.md. */
/* FERRO — original WebGL2 renderer. All surfaces and meshes are mathematical. */
/* PDR (origine) : copie de FERRO 0.2 pour Point de rupture (github.com/M4D135/FERRO, étiquette v0.2, commit 248043a).
   Chaque retouche du jeu commence par « PDR » et son nom entre parenthèses ; Jeu/src/moteur/PROVENANCE.md la décrit sous
   ce nom. Tout le reste est le fichier de FERRO, y compris ses lignes « PDR : » ou « BITUME : », reprises des jeux. */
(function () {
  'use strict';
  // BITUME : champ de vision admis de 10 à 110° (FERRO : 40 à 110°), pour la caméra de télévision au téléobjectif.
  const FOV_MIN = 10;
  // Optional surface recipes. Existing material IDs keep their original appearance;
  // hosts opt in per mesh (or terrain vertex), without another draw pass or texture.
  const MATERIALS = Object.freeze({weatheredAsphalt:21,weatheredConcrete:22,weatheredStone:23,weatheredPaint:24,
    organicSoil:25,fibrousBark:26,botanicalFoliage:27,fineLeather:28,wovenFabric:29});
  function materialFamily(value){
    const recipe=Math.floor(value+.5);
    return recipe===21?14:recipe===22?3:recipe===23?9:recipe===24?16:recipe===25?8:recipe===26?10:recipe===27?11:recipe===28?7:recipe===29?18:value;
  }

  // A lot may describe the FOV and viewport at which its near/far threshold was
  // chosen. Keep its projected detail size stable in a telephoto or split view.
  // No camera state is cached: colour, mirrors and shadows use the current view.
  function lotDetailDistance(lot,verticalTangent,viewportHeight){
    let distance=lot.bascule||240;
    const lens=lotFovScale(lot.lodReferenceFov,verticalTangent),height=lotHeightScale(lot.lodReferenceHeight,viewportHeight);
    if(lens!==undefined)distance*=lens;
    if(height!==undefined)distance*=height;
    return distance;
  }
  function lotFovScale(fov,verticalTangent){
    return Number.isFinite(fov)&&fov>0&&fov<180&&Number.isFinite(verticalTangent)&&verticalTangent>0
      ? Math.tan(fov*Math.PI/360)/verticalTangent : undefined;
  }
  function lotHeightScale(height,viewportHeight){
    return Number.isFinite(height)&&height>0&&Number.isFinite(viewportHeight)&&viewportHeight>0 ? viewportHeight/height : undefined;
  }

  // Each sphere encloses the complete input spheres, also when a very large lot sits off-centre.
  // Partition by the longest spread of centres. Hosts opt into this hierarchy for fixed bounds.
  function buildLotTree(entries){
    const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
    for(const entry of entries)for(let k=0;k<3;k++){
      const n=entry.bounds.p[k];
      low[k]=Math.min(low[k],n);high[k]=Math.max(high[k],n);
    }
    const p=low.map((v,k)=>v*.5+high[k]*.5);
    let radius=0;
    for(const entry of entries){
      const b=entry.bounds;
      radius=Math.max(radius,Math.hypot(p[0]-b.p[0],p[1]-b.p[1],p[2]-b.p[2])+b.radius);
    }
    // Only the broad phase is padded. Leaves still use the host's exact volume and inequalities.
    radius+=1e-7+16*Number.EPSILON*Math.max(1,radius,...p.map(Math.abs));
    const bounds=Number.isFinite(radius)?{p,radius}:null;
    if(entries.length<=8)return {bounds,entries};
    let axis=0;
    for(let k=1;k<3;k++)if(high[k]-low[k]>high[axis]-low[axis])axis=k;
    entries.sort((a,b)=>a.bounds.p[axis]-b.bounds.p[axis]||a.index-b.index);
    const middle=entries.length>>>1;
    return {bounds,left:buildLotTree(entries.slice(0,middle)),right:buildLotTree(entries.slice(middle))};
  }

  // Static terrain shares its spatial partition across frames. Draw indices keep their
  // original order so adjacent GPU ranges can still merge and coplanar layers stay ordered.
  function terrainViewState(){
    let tiles=[],tree=null,unbounded=[],bits=null;
    let eye,axes,horizontal,vertical,far,radii;
    const scratch={p:null,radius:0};
    const state={indices:new Uint32Array(0),reset,select};

    function reset(source=[],fixed=false){
      tiles=source;
      state.indices=new Uint32Array(tiles.length);
      tree=null;bits=null;unbounded=[];
      if(!fixed||tiles.length<32)return;
      const entries=[];
      for(let index=0;index<tiles.length;index++){
        const {centre:p,rayon:radius}=tiles[index];
        if(p&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Number.isFinite(p[2])&&Number.isFinite(radius)&&radius>=0){
          entries.push({index,bounds:{p,radius}});
        }else unbounded.push(index);
      }
      if(entries.length<32)return;
      tree=buildLotTree(entries);
      bits=new Uint32Array(Math.ceil(tiles.length/32));
    }
    function inView(bounds){
      return visible(bounds,eye,axes,horizontal,vertical,far,radii);
    }
    function tileVisible(tile){
      scratch.p=tile.centre;scratch.radius=tile.rayon;
      return !scratch.p||inView(scratch);
    }
    function mark(index){bits[index>>>5]|=1<<(index&31);}
    function visit(node){
      if(node.bounds&&!inView(node.bounds))return;
      if(node.entries){
        for(const entry of node.entries)if(inView(entry.bounds))mark(entry.index);
      }else{
        visit(node.left);visit(node.right);
      }
    }
    function select(origin,basis,h,v,limit,planes){
      eye=origin;axes=basis;horizontal=h;vertical=v;far=limit;radii=planes;
      const indices=state.indices;
      let count=0;
      if(!tree){
        for(let i=0;i<tiles.length;i++)if(tileVisible(tiles[i]))indices[count++]=i;
        return count;
      }
      visit(tree);
      for(const i of unbounded)if(tileVisible(tiles[i]))mark(i);
      for(let word=0;word<bits.length;word++){
        let flags=bits[word];
        if(!flags)continue;
        bits[word]=0;
        while(flags){
          indices[count++]=(word<<5)+31-Math.clz32(flags&-flags);
          flags&=flags-1;
        }
      }
      return count;
    }
    return state;
  }

  function lotViewState(){
    const records=[],selected=[],unbounded=[],words=[];
    let source=null,tree=null,bits=null,frame=0,distanceTests=0;
    let eye,vertical,height,cover,lastFov,lastHeight,fovScale,heightScale;

    function reset(lots=null,staticBounds=false){
      records.length=selected.length=unbounded.length=words.length=0;
      tree=null;bits=null;source=lots;
      if(!lots)return;
      for(const lot of lots)records.push({index:records.length,lot,bounds:{p:lot.centre,radius:lot.rayon},distance:0,near:true,view:-1});
      if(!staticBounds||lots.length<32)return;
      const bounded=[];
      for(const entry of records){
        const {p,radius}=entry.bounds;
        if(p&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Number.isFinite(p[2])&&Number.isFinite(radius)&&radius>=0)bounded.push(entry);
        else unbounded.push(entry);
      }
      if(bounded.length<32)return;
      tree=buildLotTree(bounded);
      bits=new Uint32Array(Math.ceil(records.length/32));
    }
    function resolve(entry){
      if(entry.view===frame)return;
      const l=entry.lot,dx=l.centre[0]-eye[0],dy=l.centre[1]-eye[1],dz=l.centre[2]-eye[2];
      entry.bounds.p=l.centre;entry.bounds.radius=l.rayon;
      entry.distance=Math.sqrt(dx*dx+dy*dy+dz*dz)-l.rayon;
      const active=l.groundCover===true&&cover?.enabled;
      entry.range=active&&cover.range[1]>0?cover.range[1]:(l.portee||Infinity);
      const fov=l.lodReferenceFov,referenceHeight=l.lodReferenceHeight;
      if(fov!==lastFov){fovScale=lotFovScale(fov,vertical)??1;lastFov=fov;}
      if(referenceHeight!==lastHeight){heightScale=lotHeightScale(referenceHeight,height)??1;lastHeight=referenceHeight;}
      entry.near=entry.distance<Math.max((l.bascule||240)*fovScale*heightScale,active?cover.density[1]:0);
      entry.cover=active;entry.view=frame;distanceTests++;
    }
    function mark(entry){
      const word=entry.index>>>5;
      if(bits[word]===0)words.push(word);
      bits[word]|=1<<(entry.index&31);
    }
    function visit(node,accept){
      if(node.bounds&&!accept(node.bounds))return;
      if(node.entries){for(const entry of node.entries)mark(entry);return;}
      visit(node.left,accept);visit(node.right,accept);
    }
    function candidates(accept,axes,h,v,far,radii,castersOnly=false){
      if(!tree)return records;
      // Colour, mirror and orthographic sun passes each supply their own volume.
      // Ground cover density and LOD still use the camera of this view, including off-screen casters.
      const intersects=accept||((bounds)=>visible(bounds,eye,axes,h,v,far,radii));
      visit(tree,intersects);
      for(const entry of unbounded)mark(entry);
      // Restore the exact previous submission order, even when spatial leaves interleave in the input.
      // Sort only occupied blocks of 32 original entries. No scan through empty regions of the circuit.
      words.sort((a,b)=>a-b);
      selected.length=0;
      for(const word of words){
        let flags=bits[word];
        while(flags){
          const bit=31-Math.clz32(flags&-flags),entry=records[word*32+bit];
          if(!castersOnly||entry.lot.ombre!==false){resolve(entry);selected.push(entry);}
          flags=(flags&(flags-1))>>>0;
        }
        bits[word]=0;
      }
      words.length=0;
      return selected;
    }
    return {records,candidates,reset,get frame(){return frame;},get distanceTests(){return distanceTests;},
      prepare(lots,viewEye,viewVertical,viewHeight,viewCover){
        if(source!==lots)reset(lots);
        frame++;distanceTests=0;
        eye=viewEye;vertical=viewVertical;height=viewHeight;cover=viewCover;
        lastFov=undefined;lastHeight=undefined;fovScale=1;heightScale=1;
        if(!tree)for(const entry of records)resolve(entry);
        return records;
      }};
  }

  // Optional vegetation controls are per view; storage is renderer-owned and
  // reused by every shadow/colour pass. Metre thresholds use the same projected
  // size reference as lots (60 degrees, 1080 px), including split/telephoto views.
  function vegetationFrame(){
    const frame={strength:1,enabled:false,eye:new Float32Array(3),density:new Float32Array(4),range:new Float32Array(2)};
    return {frame,update(fx,eye,vertical,height){
      frame.strength=Number.isFinite(fx.windStrength)?Math.max(0,Math.min(2,fx.windStrength)):1;
      frame.eye.set(eye);frame.density.fill(0);frame.density[2]=1;frame.range.fill(0);
      const config=fx.groundCover,d=config?.density,r=config?.distance,scale=(vertical>0?Math.tan(Math.PI/6)/vertical:1)*(height>0?height/1080:1);
      const density=d&&Number.isFinite(d[0])&&Number.isFinite(d[1])&&d[0]>=0&&d[1]>d[0],range=r&&Number.isFinite(r[0])&&Number.isFinite(r[1])&&r[0]>=0&&r[1]>r[0];
      frame.enabled=!!(density||range);frame.density[3]=frame.enabled?1:0;
      if(density){frame.density[0]=d[0]*scale;frame.density[1]=d[1]*scale;frame.density[2]=Number.isFinite(d[2])?Math.max(1,Math.min(8,Math.round(d[2]*8)))/8:1/8;}
      if(range){frame.range[0]=r[0]*scale;frame.range[1]=r[1]*scale;}
      return frame;
    }};
  }

  // Shared with procedural producers: each blade stays inside one of these
  // local 32x32 cells, and the far mesh retains exactly ranks < keep*8.
  function groundCoverRank(x,z){const rank=(Math.floor((x+.5)*32)*13+Math.floor((z+.5)*32)*7)%8;return rank<0?rank+8:rank;}

  const GROUND_COVER_FRAGMENT=`
  in float vGroundCoverage;
  void groundCoverDiscard(){
    if(vGroundCoverage>=1.)return;
    if(vGroundCoverage<=0.)discard;
    vec3 cell=floor(vWorld*64.);
    float grain=fract(52.9829189*fract(dot(cell.xz,vec2(.06711056,.00583715))+cell.y*.0137));
    if(grain>=vGroundCoverage)discard;
  }`;

  // Optional opaque coverage is anchored to the mesh, not the screen or time.
  // Colour and shadow depth discard exactly the same local surface cells; the
  // surviving fragments retain the ordinary material, lighting and depth path.
  const OPAQUE_OPACITY_FRAGMENT=`
  flat in float vOpacity;
  void opaqueOpacityDiscard(){
    if(vOpacity>=1.)return;
    if(vOpacity<=0.)discard;
    vec3 cell=floor(vLocal*max(vDimensions,vec3(.001))*64.);
    float grain=fract(52.9829189*fract(dot(cell.xz,vec2(.06711056,.00583715))+cell.y*.0137));
    if(grain>=vOpacity)discard;
  }`;

  // Local wind is an opt-in instance flag, independent of material and surface
  // mapping. Track emitters, never blades: 32 bounded CPU records, four GPU
  // sources, and stable arrays reused by every colour/depth/camera pass.
  function localWindState(){
    const records=Array.from({length:32},()=>({key:null,seen:false,x:0,y:0,z:0,fx:0,fz:0,radius:5,wake:12,targetX:0,targetZ:0,viewFade:0,priority:1}));
    const indices=new Int32Array(5),scores=new Float64Array(5),positions=new Float32Array(16),motions=new Float32Array(16);
    const frame={count:0,candidates:0,updates:0,positions,motions};let lastTime=null;
    const unit=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    function reset(){for(const r of records){r.key=null;r.fx=r.fz=0;r.seen=false;}lastTime=null;positions.fill(0);motions.fill(0);frame.count=frame.candidates=frame.updates=0;}
    function update(sources,time){
      time=Number.isFinite(time)?time:0;if(time===lastTime)return;
      if(lastTime!==null&&time<lastTime)reset();
      const dt=lastTime===null?1/60:Math.min(.25,time-lastTime);lastTime=time;frame.updates++;
      for(const r of records){r.seen=false;r.targetX=r.targetZ=0;}
      const length=Array.isArray(sources)?Math.min(32,sources.length):0;
      for(let i=0;i<length;i++){
        const source=sources[i],p=source?.p,v=source?.velocity;
        if(!p||!v||!Number.isFinite(p[0])||!Number.isFinite(p[1])||!Number.isFinite(p[2])||!Number.isFinite(v[0])||!Number.isFinite(v[1])||!Number.isFinite(v[2]))continue;
        const key=source.id??source;let record=null,free=null;
        for(const r of records){if(r.key===key){record=r;break;}if(r.key===null&&!free)free=r;}
        if(!record){
          record=free;if(!record)continue;record.key=key;record.fx=record.fz=0;
          // A bounded, stable tie-break keeps symmetric formations active.
          // It changes ranking by at most 8%, never the source's force.
          let hash=typeof key==='number'?key|0:2166136261;
          if(typeof key==='string')for(let k=0;k<Math.min(key.length,64);k++)hash=Math.imul(hash^key.charCodeAt(k),16777619);
          else if(typeof key!=='number')hash=i+1;
          hash=Math.imul(hash^(hash>>>16),0x45d9f3b);hash=Math.imul(hash^(hash>>>16),0x45d9f3b);hash^=hash>>>16;
          record.priority=1+(hash>>>0)/4294967296*.08;
        }
        if(record.seen)continue;record.seen=true;record.x=p[0];record.y=p[1];record.z=p[2];
        const horizontalSpeed=Math.hypot(v[0],v[2]),speed=Math.min(120,horizontalSpeed),strength=Number.isFinite(source.strength)?Math.max(0,Math.min(3,source.strength)):1;
        const gain=strength*speed*speed/(speed*speed+324),length=horizontalSpeed||1;
        record.targetX=v[0]/length*gain;record.targetZ=v[2]/length*gain;
        record.radius=Number.isFinite(source.radius)?Math.max(.25,Math.min(24,source.radius)):5;
        record.wake=Number.isFinite(source.wake)?Math.max(0,Math.min(48,source.wake)):Math.min(48,4+speed*.45);
      }
      frame.candidates=0;
      for(const r of records){
        if(r.key===null)continue;
        const rising=r.targetX*r.targetX+r.targetZ*r.targetZ>r.fx*r.fx+r.fz*r.fz,blend=1-Math.exp(-dt/(rising?.09:.42));
        r.fx+=(r.targetX-r.fx)*blend;r.fz+=(r.targetZ-r.fz)*blend;
        if(!r.seen&&r.fx*r.fx+r.fz*r.fz<1e-10){r.key=null;r.fx=r.fz=0;}else if(r.fx*r.fx+r.fz*r.fz>1e-10)frame.candidates++;
      }
    }
    function select(eye){
      indices.fill(-1);scores.fill(0);positions.fill(0);motions.fill(0);frame.count=0;
      for(let i=0;i<records.length;i++){
        const r=records[i],power=Math.hypot(r.fx,r.fz);if(r.key===null||power<1e-5)continue;
        const vx=r.fx/power,vz=r.fz/power,dx=eye[0]-r.x,dz=eye[2]-r.z,along=Math.max(-r.wake,Math.min(0,dx*vx+dz*vz));
        const x=dx-vx*along,z=dz-vz*along,y=eye[1]-r.y,distance=Math.max(0,Math.hypot(x,y,z)-r.radius);
        // The wake distance alone becomes identical for several cars queued
        // along the same road. Keep a smooth body-distance term so the closest
        // passing vehicles retain priority even inside overlapping wakes.
        r.viewFade=unit((160-distance)/40);const score=power*r.viewFade*r.priority/(1+distance*distance*.0025+(dx*dx+dz*dz)*.003);if(score<=scores[4])continue;
        let at=4;while(at>0&&score>scores[at-1]){scores[at]=scores[at-1];indices[at]=indices[at-1];at--;}scores[at]=score;indices[at]=i;
      }
      for(let i=0;i<4&&indices[i]>=0;i++){
        const r=records[indices[i]],power=Math.hypot(r.fx,r.fz),fade=scores[4]>0?unit((scores[i]-scores[4])/(scores[i]*.25)):1,at=frame.count*4;
        if(fade<1e-5)continue;
        positions[at]=r.x;positions[at+1]=r.y;positions[at+2]=r.z;positions[at+3]=r.radius;
        motions[at]=r.fx/power;motions[at+1]=r.fz/power;motions[at+2]=power*fade*r.viewFade;motions[at+3]=r.wake;frame.count++;
      }
      return frame;
    }
    return {frame,update,select,reset};
  }

  const LOCAL_WIND_GLSL=`
  uniform int uLocalWindCount;
  uniform vec4 uLocalWindPosition[4];
  uniform vec4 uLocalWindMotion[4];
  vec2 localVegetationWind(vec3 world,float root,float height){
    vec2 force=vec2(0.);
    for(int i=0;i<4;i++){
      if(i>=uLocalWindCount)break;
      vec4 source=uLocalWindPosition[i],motion=uLocalWindMotion[i];
      vec2 delta=world.xz-source.xz,side=vec2(-motion.y,motion.x);
      // Most ground cover lies outside every source. Reject with cheap bounds
      // before normalization, square roots, smoothsteps or trigonometry.
      float reach=source.w*1.35+motion.w;
      if(max(abs(delta.x),abs(delta.y))>reach||abs(world.y-source.y)>=source.w)continue;
      float along=dot(delta,motion.xy),across=dot(delta,side);
      if(along>source.w||along<-max(motion.w,source.w)||abs(across)>source.w*1.35)continue;
      float trail=clamp(-along/max(motion.w,.001),0.,1.);
      float radius=source.w*(1.+trail*.35);
      float lateral=1.-smoothstep(radius*.2,radius,abs(across));
      float ahead=1.-smoothstep(0.,source.w,along);
      float behind=smoothstep(-max(motion.w,.001),-max(motion.w,.001)*.25,along);
      float vertical=1.-smoothstep(source.w*.25,source.w,abs(world.y-source.y));
      float body=1.-smoothstep(source.w*.15,source.w,length(delta));
      float envelope=max(body*.85,lateral*ahead*behind)*vertical*motion.z;
      float flutter=sin(uWindTime.y*6.2+along*1.9+across*.8)*(.08+trail*.12);
      vec2 flow=motion.xy*.75+side*(clamp(across/source.w,-1.,1.)*.55+flutter);
      force+=flow*envelope;
    }
    return force/(1.+length(force)*.45)*root*root*min(height,2.)*.62;
  }`;

  // Same wave field as RADE.marine.seaHeight. Only the local navigation grid
  // is displaced; a 16 m edge band meets the distant flat sea without a seam.
  const SEA_GLSL = `
  uniform float uSeaMode;uniform vec4 uSeaOrigin;
  uniform vec4 uSeaMotion;
  vec3 seaField(vec2 p) {
    float co=cos(uSeaMotion.y),si=sin(uSeaMotion.y),u=p.x*co+p.y*si,v=-p.x*si+p.y*co,t=uSeaMotion.x;
    float a=.24*u-1.10*t,b=.41*u+.17*v-1.55*t+1.7,c=.63*v-.83*t+.4;
    float amplitude=.035+.10*clamp(uSeaOrigin.w,0.,2.);
    float h=amplitude*(.60*sin(a)+.27*sin(b)+.13*sin(c));
    float du=amplitude*(.60*.24*cos(a)+.27*.41*cos(b));
    float dv=amplitude*(.27*.17*cos(b)+.13*.63*cos(c));
    vec2 grad=vec2(du*co-dv*si,du*si+dv*co),q=p-uSeaOrigin.xy;
    float edge=max(abs(q.x),abs(q.y)),r=uSeaOrigin.z;
    float f=clamp((r-edge)/16.,0.,1.),fade=f*f*(3.-2.*f);
    float slope=f>0.&&f<1.?-6.*f*(1.-f)/16.:0.;
    vec2 de=abs(q.x)>abs(q.y)?vec2(sign(q.x),0.):vec2(0.,sign(q.y));
    return vec3(h*fade,grad*fade+h*slope*de);
  }
  `;

  const VERT = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormal;
  layout(location=2) in vec4 iPosition;
  layout(location=3) in vec4 iScale;
  layout(location=4) in vec4 iRotation;
  layout(location=5) in vec4 iColor;
  uniform mat4 uViewProjection;
  #ifdef CAMERA_RELATIVE_OVERLAY
  #define WORLD_POINT(p) ((p)+uDrawOrigin)
  float drawHeight(float worldHeight){return worldHeight-uDrawOrigin.y;}
  #else
  #define WORLD_POINT(p) (p)
  float drawHeight(float worldHeight){return worldHeight;}
  #endif
  uniform vec2 uWindTime;
  uniform float uWindStrength;
  uniform vec3 uGroundCoverEye;
  uniform vec4 uGroundCoverDensity;
  uniform vec2 uGroundCoverRange;
  ${LOCAL_WIND_GLSL}
  ${SEA_GLSL}
  out vec3 vWorld;
  out vec3 vNormal;
  out vec3 vSurface;
  out vec3 vLocal;
  out vec3 vFaceNormal;flat out vec3 vDimensions;
  out vec3 vSurfaceNormal;
  flat out vec3 vAnchor;
  flat out float vMaterial;
  flat out float vEmission;
  flat out float vOverlay;
  flat out float vOutdoor;
  flat out float vObject;
  flat out vec4 vColor;
  flat out float vOpacity;
  out float vGroundCoverage;
  void main() {
    // Rigid world terrain: position and normal are already in world space.
    // The last four vertex floats are exactly the material ID and the RGB tint.
    if(iRotation.w==66.||iRotation.w==98.){
      bool smoothTint=iRotation.w==98.;
      vWorld=aPosition;vSurface=aPosition;vLocal=aPosition;vNormal=normalize(aNormal);
      vFaceNormal=aNormal;vDimensions=vec3(1.);vSurfaceNormal=smoothTint?iPosition.yzw:vNormal;
      vAnchor=vec3(0.);vMaterial=iPosition.x;vEmission=0.;vOverlay=0.;vOutdoor=1.;vObject=0.;
      vColor=vec4(iPosition.yzw,smoothTint?2.:1.);vOpacity=1.;vGroundCoverage=1.;
      gl_Position=uViewProjection*vec4(vWorld,1.);return;
    }
    // 0/1 retain the historical no-colour/colour markers, including all FX
    // alpha values in [0,1]. Opaque opacity uses disjoint ranges without a
    // larger instance stride: [2,3) with a tint, [-2,-1] without one.
    vOpacity=iColor.w>1.?clamp(iColor.w-2.,0.,1.):iColor.w<0.?clamp(-iColor.w-1.,0.,1.):1.;
    vec3 anchor=WORLD_POINT(iPosition.xyz);
    bool groundCover=mod(floor(iRotation.w*.0625),2.)>.5;
    vGroundCoverage=1.;
    if(groundCover&&uGroundCoverDensity.w>.5){
      float distanceToEye=length(anchor-uGroundCoverEye);
      if(uGroundCoverRange.y>uGroundCoverRange.x)vGroundCoverage=1.-smoothstep(uGroundCoverRange.x,uGroundCoverRange.y,distanceToEye);
      if(uGroundCoverDensity.y>uGroundCoverDensity.x&&uGroundCoverDensity.z<1.){
        vec2 cell=floor((aPosition.xz+.5)*32.);
        float rank=mod(cell.x*13.+cell.y*7.,8.),keep=uGroundCoverDensity.z*8.;
        if(rank>=keep){
          float progress=smoothstep(uGroundCoverDensity.x,uGroundCoverDensity.y,distanceToEye);
          float end=(8.-rank)/(8.-keep);
          vGroundCoverage*=1.-smoothstep(max(0.,end-.22),end,progress);
        }
      }
      // All vertices of a blade share its cell/rank. An extinguished blade
      // clips before rotation, weather, local sources or material work.
      if(vGroundCoverage<=0.){gl_Position=vec4(2.,2.,2.,1.);return;}
    }
    vec3 c=cos(iRotation.xyz), s=sin(iRotation.xyz);
    mat3 rx=mat3(1.,0.,0., 0.,c.x,s.x, 0.,-s.x,c.x);
    mat3 ry=mat3(c.y,0.,-s.y, 0.,1.,0., s.y,0.,c.y);
    mat3 rz=mat3(c.z,s.z,0., -s.z,c.z,0., 0.,0.,1.);
    mat3 rotation=rz*ry*rx;
    vec3 localPosition=aPosition*iScale.xyz;
    if(groundCover)localPosition.x+=aPosition.z*iScale.w;
    vWorld=rotation*localPosition+iPosition.xyz;
    vec3 windPosition=WORLD_POINT(vWorld);
    bool windResponsive=mod(floor(iRotation.w*.125),2.)>.5;
    if(windResponsive){
      // A minimum breeze keeps opted-in short vegetation alive in calm
      // weather. Four sine bands cover gust, sway, cross-flow and tip flutter.
      float root=clamp(aPosition.y+.5,0.,1.),height=min(abs(iScale.y),2.);
      vec2 cell=floor((aPosition.xz+.5)*32.);
      float variation=fract(dot(cell,vec2(.75487767,.56984029)));
      float time=uWindTime.y,strength=uWindStrength*(.45+clamp(uWindTime.x,0.,2.)*.55);
      float gust=sin(time*1.35-dot(windPosition.xz,vec2(.23,.17)));
      float sway=sin(time*(1.7+variation*.6)+windPosition.x*.67+windPosition.z*.51);
      float crossFlow=sin(time*2.65+windPosition.x*1.13-windPosition.z*.81+variation*6.2831853);
      float flutter=sin(time*(7.6+variation*3.2)+windPosition.x*6.3-windPosition.z*4.7+root*2.4);
      vec2 movement=vec2(.8*sway+.45*gust,.55*crossFlow+.28*gust)*root*root*.20;
      movement+=vec2(.75,-.65)*flutter*root*root*root*.035;
      vWorld.xz+=movement*height*strength;
    }else if(iPosition.w>10.5&&iPosition.w<11.5){
      float phase=uWindTime.y*.85+anchor.x*.37+anchor.z*.21;
      float bend=(aPosition.y+.5)*uWindTime.x*.055;
      vWorld.x+=sin(phase)*bend;vWorld.z+=cos(phase*.73)*bend*.6;
    }else if(iPosition.w>26.5&&iPosition.w<27.5){
      // The same vertex program drives colour and shadow depth. Roots stay fixed,
      // broad gusts move the stem and a smaller phase moves its free tip.
      float root=clamp(aPosition.y+.5,0.,1.);
      vec2 phasePosition=windResponsive?windPosition.xz:anchor.xz;
      float phase=uWindTime.y*.85+phasePosition.x*.37+phasePosition.y*.21;
      float bend=root*root*uWindTime.x*.075*clamp(abs(iScale.y),.25,4.);
      float tip=sin(uWindTime.y*2.1+anchor.x*1.9+anchor.z*.43+root*4.5)
        *root*root*root*uWindTime.x*.015*min(abs(iScale.y),2.);
      vWorld.x+=sin(phase)*bend+tip;vWorld.z+=cos(phase*.73)*bend*.65-tip*.4;
    }
    if(windResponsive&&uLocalWindCount>0)vWorld.xz+=localVegetationWind(windPosition,clamp(aPosition.y+.5,0.,1.),abs(iScale.y));
    vec3 localNormal=aNormal/max(abs(iScale.xyz),vec3(.0001));
    if(groundCover)localNormal.z-=iScale.w*aNormal.x/max(abs(iScale.x*iScale.z),.0001);
    vNormal=normalize(rotation*localNormal);
        if(uSeaMode>.5&&iPosition.w>11.5&&iPosition.w<12.5&&anchor.y<0.) {
      if(iPosition.w>12.1&&uSeaMotion.w>.5){vec3 w=seaField(WORLD_POINT(vWorld).xz);vWorld.y=drawHeight(uSeaMotion.z+w.x);vNormal=normalize(vec3(-w.y,1.,-w.z));}
      else vWorld.y=drawHeight(-1.25+(aPosition.y-.5)*abs(iScale.y));
    }

    vAnchor=anchor;vMaterial=iPosition.w;
    vEmission=groundCover?0.:iScale.w;
    vOverlay=mod(iRotation.w,2.);
    vOutdoor=mod(floor(iRotation.w*.5),2.);
    vObject=mod(floor(iRotation.w*.25),2.);
    // Project in draw space; lighting, fog and shadows still receive world coordinates.
    gl_Position=uViewProjection*vec4(vWorld,1.);
    vWorld=WORLD_POINT(vWorld);
    vSurface=vObject>.5?localPosition:vWorld;
    vLocal=aPosition;vFaceNormal=aNormal;vDimensions=abs(iScale.xyz);
    // World-mapped terrain already carries the same normal in vNormal. Its
    // opt-in colour can use this interpolated vec3 without adding a varying.
    bool smoothTerrainTint=iRotation.w==34.;
    vSurfaceNormal=smoothTerrainTint?iColor.rgb:vObject>.5?normalize(localNormal):vNormal;
    vColor=vec4(iColor.rgb,smoothTerrainTint?2.:iColor.w>1.?1.:iColor.w<0.?0.:iColor.w);
  }`;

  const FRAG = `#version 300 es
  precision highp float;
  in vec3 vWorld;
  in vec3 vNormal;
  in vec3 vSurface;
  in vec3 vLocal;
  in vec3 vFaceNormal;flat in vec3 vDimensions;
  in vec3 vSurfaceNormal;
  flat in vec3 vAnchor;
  flat in float vMaterial;
  flat in float vEmission;
  flat in float vOverlay;
  flat in float vOutdoor;
  flat in float vObject;
  flat in vec4 vColor;
  ${GROUND_COVER_FRAGMENT}
  ${OPAQUE_OPACITY_FRAGMENT}
  uniform vec3 uEye;
  uniform vec4 uWeather;uniform vec2 uCloudOffset;
  uniform highp sampler2DArray uPbrAlbedo;uniform highp sampler2DArray uPbrNormal;uniform highp sampler2DArray uPbrRough;uniform float uPbrReady;
  uniform vec3 uLightDirection[12];
  uniform vec2 uLightCone[12];
  uniform vec3 uForward;
  uniform vec3 uLightPosition[12];
  uniform vec3 uLightColor[12];
  uniform float uLightRange[12];
  uniform int uLightCount;
  uniform vec2 uResolution;
  uniform vec4 uEffects;
  uniform vec2 uWindTime;
  ${SEA_GLSL}
  // Explicit sampler precision keeps 24-bit depth from being quantized into bands.
  uniform highp sampler2D uShadowMap;
  uniform mat4 uShadowMatrix[3];
  uniform vec4 uShadowSettings;
  uniform vec3 uTorchPosition;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform vec3 uFogColor;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyBottom;
  uniform vec2 uEnvironment;uniform vec2 uNightHour;
  uniform float uOverlayMode;
  uniform float uPhoto; // BITUME : qualité des reflets analytiques et peinture satinée.
  uniform vec4 uFovea; // Rendu fovéal [fx, fy, rInterne, rExterne] ; zéro par défaut (neutre).
  // PDR (voile) : voile du brouillard de guerre (fx.voile) : visibilité R8, zone (x0, z0, 1/largeur, 1/profondeur) en mètres, force 0..1.
  uniform sampler2D uVoile;
  uniform vec4 uVoileZone;
  uniform float uVoileForce;
  out vec4 fragColor;
  float hash(vec2 p) {
    vec3 p3=fract(vec3(p.xyx)*.1031);
    p3+=dot(p3,p3.yzx+33.33);
    return fract((p3.x+p3.y)*p3.z);
  }
  float noise(vec2 p) {
    vec2 a=floor(p), b=fract(p); b=b*b*(3.-2.*b);
    return mix(mix(hash(a),hash(a+vec2(1,0)),b.x),
      mix(hash(a+vec2(0,1)),hash(a+vec2(1,1)),b.x),b.y);
  }
  // Integrate grain towards its mean before it becomes smaller than a pixel.
  // Frequencies are in world/object metres, independently of display resolution.
  float surfaceNoise(vec2 uv,float frequency,float pixelSpan){
    float detail=1.-smoothstep(.35,.90,pixelSpan*frequency);
    return .5+(noise(uv*frequency)-.5)*detail;
  }
  vec3 soilSeed(vec2 cell){
    vec3 p=fract(vec3(cell.xyx)*vec3(.1031,.1030,.0973));
    p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yzz)*p.zyx);
  }
  vec2 soilBladeCell(vec2 p,float aa){
    vec2 cell=floor(p);vec3 seed=soilSeed(cell);
    // A .34-cell margin contains the entire blade AND its widest AA support
    // (.17 + .034 + .104 < .34). No neighbour loop or cell-edge seam is needed.
    vec2 centre=cell+.34+seed.xy*.32;
    float angle=seed.z*6.2831853;vec2 axis=vec2(cos(angle),sin(angle));
    float extent=.22+.12*seed.x,along=clamp(dot(p-centre,axis)/extent+.5,0.,1.);
    float width=(.018+.016*seed.y)*(1.-along*.72);
    float distanceToBlade=length(p-centre-axis*((along-.5)*extent));
    float blade=1.-smoothstep(max(0.,width-aa),width+aa,distanceToBlade);
    float ridge=blade*(1.-along)*max(0.,1.-distanceToBlade/max(width,.001));
    return vec2(blade,ridge);
  }
  vec2 soilBlades(vec2 uv,float pixelSpan){
    float detail=1.-smoothstep(.006,.026,pixelSpan);
    if(detail<=0.)return vec2(.018,0.);
    // Two independently shifted/rotated fields break rows without extra
    // geometry, textures or nine neighbouring roots per shaded fragment.
    float aa=max(pixelSpan*4.7*.85,.001);
    vec2 a=soilBladeCell(uv*4.7,aa);
    vec2 b=soilBladeCell(mat2(.8,.6,-.6,.8)*uv*4.7+vec2(17.3,9.7),aa);
    float cover=1.-(1.-a.x)*(1.-b.x);
    return vec2(mix(.018,cover,detail),max(a.y,b.y)*detail);
  }
  float grid(vec2 uv,float width) {
    vec2 distanceToEdge=min(fract(uv),1.-fract(uv));
    vec2 aa=max(fwidth(uv),vec2(.0001));
    vec2 line=1.-smoothstep(vec2(width),vec2(width)+aa,distanceToEdge);
    return max(line.x,line.y);
  }
  vec3 reliefNormal(vec3 n,float height) {
    vec3 dpdx=dFdx(vWorld), dpdy=dFdy(vWorld);
    vec3 r1=cross(dpdy,n),r2=cross(n,dpdx);
    float determinant=dot(dpdx,r1);
    vec3 gradient=sign(determinant)*(dFdx(height)*r1+dFdy(height)*r2);
    float scale=max(abs(determinant),.000001);
    gradient*=min(1.,scale*.35/max(length(gradient),.000001));
    return normalize(scale*n-gradient);
  }
  vec3 microReliefNormal(vec3 n,float height) {
    // The historical relief helper has a metre-scale determinant floor. Small
    // objects need its scale-invariant equivalent; old materials keep that path.
    vec3 dx=dFdx(vWorld),dy=dFdy(vWorld),r1=cross(dy,n),r2=cross(n,dx);
    float det=dot(dx,r1);
    vec3 gradient=sign(det)*(dFdx(height)*r1+dFdy(height)*r2)/max(abs(det),1e-14);
    gradient*=min(1.,.35/max(length(gradient),1e-7));
    return normalize(n-gradient);
  }
  vec3 fresnelSchlick(float cosine,vec3 f0){
    float q=1.-clamp(cosine,0.,1.),q2=q*q;
    return f0+(1.-f0)*q2*q2*q;
  }
  vec3 metalHighlight(vec3 n,vec3 view,vec3 l,float roughness,vec3 f0){
    vec3 h=normalize(view+l);
    float nv=max(dot(n,view),.001),nl=max(dot(n,l),0.),nh=max(dot(n,h),0.);
    float a=max(.055,roughness*roughness),a2=a*a,d=nh*nh*(a2-1.)+1.;
    float distribution=a2/max(3.141593*d*d,.00001);
    float k=(roughness+1.)*(roughness+1.)*.125;
    float visibility=1./max(4.*(nv*(1.-k)+k)*(nl*(1.-k)+k),.001);
    return fresnelSchlick(max(dot(view,h),0.),f0)*min(distribution*visibility,12.)*nl;
  }
  float depthSample(vec2 uv,vec2 offset,float depth,vec2 slope) {
    float texel=uShadowSettings.y;
    vec2 tap=uv+offset*texel;
    // The nearest depth texel represents a different point on a sloping surface.
    // Compare against that point on the receiver plane, not the centre depth.
    vec2 centre=(floor(tap/texel)+.5)*texel;
    return step(depth+dot(slope,centre-uv),texture(uShadowMap,tap).r);
  }
  float foveaEccentricity() {
    if(uFovea.w<=uFovea.z)return 0.;
    vec2 screenUV=gl_FragCoord.xy/max(uResolution,vec2(1.));
    vec2 delta=(screenUV-uFovea.xy)*vec2(uResolution.x/max(uResolution.y,1.),1.);
    return smoothstep(uFovea.z,uFovea.w,length(delta));
  }
  float shadow(vec3 n,vec3 l,int slot) {
    // BITUME : le cockpit reçoit les ombres à sa position réelle.
    if((vOverlay>.5&&uOverlayMode<.5)||(slot==0&&uShadowSettings.x<.5)||(slot==1&&uShadowSettings.x<1.5&&uShadowSettings.w<.5)||(slot==2&&uShadowSettings.z<.5))return 1.;
    vec4 projected=uShadowMatrix[slot]*vec4(vWorld+n*.014,1.);
    vec3 p=projected.xyz/projected.w*.5+.5;
    vec3 dx=dFdx(p),dy=dFdy(p);
    float determinant=dx.x*dy.y-dx.y*dy.x;
    vec2 slope=abs(determinant)>.00000000001?vec2(dx.z*dy.y-dy.z*dx.y,dy.z*dx.x-dx.z*dy.x)/determinant:vec2(0.);
    // Derivatives above use projection UVs; PCF offsets use atlas UVs. A half-size
    // tile needs twice the slope, while the full-atlas sun must keep it unchanged.
    slope*=slot==1&&uShadowSettings.w>1.5?1.:2.;
    if(projected.w<=0.||p.z<=0.||p.z>=1.||min(p.x,p.y)<=.001||max(p.x,p.y)>=.999)return 1.;
    float bias=slot==1&&uShadowSettings.w>.5?.00014+.00024*(1.-max(dot(n,l),0.)):.00005+.00014*(1.-max(dot(n,l),0.));
    vec2 tile=slot==1?vec2(.5,0.):slot==2?vec2(0.,.5):vec2(0.);
    // PDR : en vue RTS, le soleil occupe tout l'atlas (réglage w = 2).
    vec2 uv=slot==1&&uShadowSettings.w>1.5?p.xy:p.xy*.5+tile;
    float visibility=0.;
    if(slot==1&&uShadowSettings.w>.5){
      // Quadratic B-spline PCF: nine comparisons, continuous sub-texel weights.
      // Peripheral vision switches smoothly beyond fovea>.42 to a single slope-safe sample.
      float fovea=foveaEccentricity();
      if(fovea>.42){
        visibility=step(p.z-bias,texture(uShadowMap,uv).r);
      }else{
        float texel=uShadowSettings.y;
        vec2 cell=uv/texel,f=fract(cell)-.5,centre=(floor(cell)+.5)*texel;
        vec3 wx=vec3(.5*(.5-f.x)*(.5-f.x),.75-f.x*f.x,.5*(.5+f.x)*(.5+f.x));
        vec3 wy=vec3(.5*(.5-f.y)*(.5-f.y),.75-f.y*f.y,.5*(.5+f.y)*(.5+f.y));
        for(int y=0;y<3;y++)for(int x=0;x<3;x++){
          vec2 tap=centre+vec2(float(x-1),float(y-1))*texel;
          visibility+=wx[x]*wy[y]*step(p.z-bias+dot(slope,tap-uv),texture(uShadowMap,tap).r);
        }
      }
    }else{
      visibility+=depthSample(uv,vec2(-.65,-.65),p.z-bias,slope);
      visibility+=depthSample(uv,vec2(.65,-.65),p.z-bias,slope);
      visibility+=depthSample(uv,vec2(-.65,.65),p.z-bias,slope);
      visibility+=depthSample(uv,vec2(.65,.65),p.z-bias,slope);visibility*=.25;
    }
    float edge=min(min(p.x,p.y),min(1.-p.x,1.-p.y));
    float blend=smoothstep(.012,.085,edge)*(slot==1&&uShadowSettings.w>.5?1.:1.-smoothstep(24.,31.,projected.w));
    return mix(1.,mix(.055,1.,visibility),blend);
  }
  void main() {
    groundCoverDiscard();
    bool smoothTerrainTint=vColor.w>1.5;
    vec3 tintRGB=smoothTerrainTint?vSurfaceNormal:vColor.rgb;
    vec3 geometricNormal=normalize(vNormal), n=geometricNormal;
    vec3 an=abs(smoothTerrainTint?geometricNormal:normalize(vSurfaceNormal));
    // Smooth landscape and track pigments use one world projection across adjoining slopes.
    // Fractional variants are opt-in for ground nappes only. Existing materials keep their PBR layers.
    bool lightSoil=smoothTerrainTint&&vMaterial==8.125;
    bool roadGrain=smoothTerrainTint&&vMaterial==14.125,roadPaint=smoothTerrainTint&&vMaterial==14.25;
    bool terrainUV=smoothTerrainTint&&(lightSoil||roadGrain||roadPaint||vMaterial==25.125||vMaterial==21.125);
    vec2 uv=terrainUV?vWorld.xz:(an.y>.65?vSurface.xz:(an.x>an.z?vSurface.zy:vSurface.xy));
    float recipe=vMaterial>20.5&&vMaterial<29.5?floor(vMaterial+.5)-20.:0.;
    float m=recipe==1.?14.:recipe==2.?3.:recipe==3.?9.:recipe==4.?16.:recipe==5.?8.:recipe==6.?10.:recipe==7.?11.:recipe==8.?7.:recipe==9.?18.:vMaterial, emission=vEmission;
    vec3 base=vec3(.105,.135,.15),windowGlow=vec3(0.);
    float night=clamp(uNightHour.x,0.,1.)*vOutdoor;float lateHour=uNightHour.y<12.?uNightHour.y+24.:uNightHour.y;float evening=1.-smoothstep(23.,26.,lateHour);
    float roughness=.47,metalness=.65,organicHeight=0.,urbanHeight=0.,pbrWeight=0.,pbrLayer=1.,recipeHeight=0.;
    float cavity=1.,leafTransmission=0.,soilSnow=0.;
    float pixelSpan=max(fwidth(uv).x,fwidth(uv).y);
    float fovea=foveaEccentricity();
    float foveaSpan=pixelSpan*(1.+fovea*2.6);
    float fineDetail=(1.-smoothstep(.015,.10,foveaSpan))*(1.-fovea*.82);
    float grain=noise(uv*23.)*.5+mix(.5,noise(uv*71.),fineDetail)*.2;
    float broad=noise(uv*.7);
    // Architectural joints belong to the building, not to moving armour or the weapon.
    float architectural=1.-clamp(vObject,0.,1.);
    float panel=m<7.5&&recipe<.5?grid(uv*.55,.007)*architectural:0.;
    if(recipe>.5){
      // Original, bounded recipes: broad ageing, medium surface structure and
      // filtered grain share the same coordinates and seedless world field.
      float patches=surfaceNoise(uv+vec2(17.3,8.1),.17,foveaSpan);
      float structure=surfaceNoise(uv+vec2(3.7,11.9),2.6,foveaSpan);
      float aggregate=fovea<.65?surfaceNoise(uv,83.,foveaSpan):.5;
      vec3 tint=vColor.w>.5?tintRGB:vec3(.5);
      if(recipe<1.5){
        if(vColor.w<.5)tint=vec3(.18,.18,.19);
        float repair=smoothstep(.48,.69,patches);
        base=tint*(.91+.16*(structure-.5)+.16*(aggregate-.5))*(1.-repair*.12);
        roughness=.88+.08*(structure-.5)+.04*(aggregate-.5);metalness=0.;
        recipeHeight=(aggregate-.5)*.0022+(structure-.5)*.0012;
      }else if(recipe<2.5){
        if(vColor.w<.5)tint=vec3(.54,.55,.52);
        float run=surfaceNoise(vec2(uv.x*3.,uv.y*.14)+19.,1.,pixelSpan*3.);
        float foot=(1.-smoothstep(.05,1.25,(vLocal.y+.5)*vDimensions.y))*(1.-abs(geometricNormal.y));
        float stain=smoothstep(.48,.72,run)*(.07+.15*foot);
        base=tint*(.84+.20*patches+.10*(aggregate-.5))*(1.-stain);
        base=mix(base,base*vec3(.80,.82,.73),foot*structure*.12);
        roughness=.88+.08*(structure-.5);metalness=0.;
        recipeHeight=(structure-.5)*.005+(aggregate-.5)*.0014;
      }else if(recipe<3.5){
        if(vColor.w<.5)tint=vec3(.37,.36,.31);
        float strataPhase=vWorld.y*2.1+patches*5.5;
        float strata=.5+.5*sin(strataPhase)*(1.-smoothstep(.6,2.4,fwidth(strataPhase)));
        float lichen=smoothstep(.60,.78,patches+.12*structure)*max(geometricNormal.y,0.)*clamp(vOutdoor,0.,1.);
        base=tint*(.77+.28*patches+.12*strata+.10*(aggregate-.5));
        base=mix(base,base*vec3(.76,.89,.62),lichen*.42);
        roughness=.87+.10*structure;metalness=0.;
        recipeHeight=(structure-.5)*.016+(aggregate-.5)*.003;
      }else if(recipe<4.5){
        vec2 localUV=an.y>.65?vLocal.xz:(an.x>an.z?vLocal.zy:vLocal.xy);
        float edgeDistance=.5-max(abs(localUV.x),abs(localUV.y));
        float edge=1.-smoothstep(.010,.035+fwidth(edgeDistance),edgeDistance);
        float chip=smoothstep(.65,.82,structure+.14*patches)*(.10+.55*edge);
        base=tint*(.95+.08*(aggregate-.5))*(.94+.08*patches);
        base=mix(base,vec3(.23,.25,.25)*(.8+.25*patches),chip);
        roughness=mix(.34+.08*patches,.62,chip);metalness=mix(.08,.72,chip);
        recipeHeight=(aggregate-.5)*.0007-chip*.0015;
      }else if(recipe<5.5){
        // Preserve the host's biome/season pigment. Bright neutral snow keeps
        // its supplied white; sand and volcanic ground do not acquire green.
        if(vColor.w<.5)tint=vec3(.24,.30,.13);
        float darkest=min(tint.r,min(tint.g,tint.b)),chroma=max(tint.r,max(tint.g,tint.b))-darkest;
        soilSnow=smoothstep(.58,.84,darkest)*(1.-smoothstep(.045,.18,chroma));
        float vegetation=clamp((tint.g-max(tint.r*.90,tint.b*1.10))/max(tint.g,.04)*2.7,0.,1.)*(1.-soilSnow);
        float growth=vegetation*(.35+.65*smoothstep(.30,.70,patches+.20*(structure-.5)))*smoothstep(.12,.78,geometricNormal.y);
        vec2 soilUV=mat2(.8,.6,-.6,.8)*uv;
        if(fovea<.48){
          vec2 warp=vec2(surfaceNoise(uv+37.2,2.1,foveaSpan),surfaceNoise(uv+69.7,1.7,foveaSpan))-.5;
          soilUV+=warp*.14*(1.-smoothstep(.28,.48,fovea));
        }
        float clods=surfaceNoise(soilUV+vec2(31.2,6.4),8.5,foveaSpan*1.7);
        float crumbs=fovea<.72?surfaceNoise(soilUV+vec2(8.3,23.7),34.,foveaSpan*1.7):.5;
        float pits=pow(max(0.,.5-crumbs)*2.,2.)*(1.-smoothstep(.015,.045,foveaSpan));
        float mineral=smoothstep(.65,.82,crumbs)*(1.-smoothstep(.010,.035,foveaSpan));
        vec2 blades=vec2(.018,0.);if(vegetation>0.&&fovea<.42)blades=soilBlades(uv,foveaSpan);
        float relief=1.-soilSnow*.78;
        // Broad pigment varies smoothly; relief belongs to the smaller grains.
        // Low-frequency value-noise normals would expose their lattice as paving.
        float tone=.92+(patches-.5)*.13+(clods-.5)*.04+(crumbs-.5)*.24+(aggregate-.5)*.16;
        base=tint*mix(tone,1.+(crumbs-.5)*.10,soilSnow);
        base*=1.+relief*(mineral*.11-pits*.06+growth*(blades.x-.018)*.32);
        roughness=mix(.93+.04*(clods-.5),.90,soilSnow);metalness=0.;
        recipeHeight=relief*((crumbs-.5)*.0045+(aggregate-.5)*.002-pits*.0015+growth*blades.y*.018);
        cavity=1.-relief*(pits*.11+growth*(1.-blades.x)*.035);
      }else if(recipe<6.5){
        // Object-space fibres follow the trunk's axis, including a tilted trunk.
        // A 3-D transverse field avoids a cylindrical UV seam.
        if(vColor.w<.5)tint=vec3(.24,.15,.08);
        vec3 wood=vLocal*vDimensions;
        float woodSpan=max(max(fwidth(wood).x,fwidth(wood).y),fwidth(wood).z);
        float warp=surfaceNoise(wood.xz+vec2(wood.y*.035),1.4,woodSpan);
        vec2 fibresUV=vec2((wood.x+wood.z*.73)*6.+warp*.65,wood.y*.22);
        float fibres=surfaceNoise(fibresUV,1.,woodSpan*6.);
        float split=1.-smoothstep(.26,.47,fibres);
        float fine=surfaceNoise(vec2((wood.x-wood.z*.61)*43.,wood.y*1.7),1.,woodSpan*43.);
        float collar=1.-smoothstep(.03,.24,clamp(vLocal.y+.5,0.,1.));
        base=tint*(.70+.46*fibres+.12*(fine-.5))*(1.-split*.20);
        base=mix(base,base*vec3(.76,.91,.59),collar*patches*.22);
        roughness=.93+.04*structure;metalness=0.;
        recipeHeight=(fibres-.5)*.018+(fine-.5)*.003;
        cavity=1.-split*.16-collar*.06;
      }else if(recipe<7.5){
        // Veins and wax follow the plant, rather than sliding through it in wind.
        // Broad variations remain when distant fine detail has been integrated.
        if(vColor.w<.5)tint=vec3(.20,.34,.09);
        vec3 plant=vLocal*vDimensions;
        vec2 leafUV=an.y>.65?plant.xz:(an.x>an.z?plant.zy:plant.xy);
        float leafSpan=max(fwidth(leafUV).x,fwidth(leafUV).y);
        float pigment=surfaceNoise(leafUV+vAnchor.xz*.13,3.2,leafSpan);
        float tissue=surfaceNoise(leafUV+vec2(4.8,19.1),28.,leafSpan);
        float veinPhase=leafUV.y*58.+abs(leafUV.x)*92.;
        float veinFilter=1.-smoothstep(.8,2.8,fwidth(veinPhase));
        float veins=pow(.5+.5*cos(veinPhase),8.)*veinFilter;
        float top=smoothstep(.0,.9,clamp(vLocal.y+.5,0.,1.));
        base=tint*mix(vec3(.72,.85,.61),vec3(1.10,1.07,.77),pigment)*(.83+.17*top);
        base*=1.+(tissue-.5)*.14+veins*.055;
        roughness=.67+.13*structure;metalness=0.;
        recipeHeight=(tissue-.5)*.0012+veins*.0005;
        cavity=.79+.21*top;
        leafTransmission=(.26+.16*pigment)*(.65+.35*top);
      }else{
        // Upholstery is measured in object metres, even on a static mesh which
        // did not opt into surface:'object'. Translation/rotation never resample
        // its grain. Only the normal changes: silhouettes and depth stay exact.
        vec3 local=vLocal*vDimensions;
        vec3 localNormal=abs(normalize(vFaceNormal/max(vDimensions,vec3(.0001))));
        vec2 clothUV=localNormal.y>.65?local.xz:(localNormal.x>localNormal.z?local.zy:local.xy);
        float span=max(fwidth(clothUV).x,fwidth(clothUV).y);
        if(vColor.w<.5)tint=recipe<8.5?vec3(.07,.06,.05):vec3(.42,.44,.46);
        // A colour-derived seed is stable on animated parts: unlike world
        // position or their changing length, it cannot make the grain swim.
        float seed=hash(tint.rg*vec2(71.3,93.1)+tint.bb*37.4);
        vec2 oriented=mat2(.819152,-.573576,.573576,.819152)*clothUV+seed*17.;
        vec2 warp=vec2(surfaceNoise(oriented+5.1,57.,span),surfaceNoise(oriented+19.7,83.,span))-.5;
        vec2 grainUV=oriented+warp*.0011;
        float grainSpan=max(fwidth(grainUV).x,fwidth(grainUV).y);
        metalness=0.;
        if(recipe<8.5){
          // Rounded pebble pores, micro-creases and subdued broad folds, no regular tile or seam.
          float folds=surfaceNoise(oriented*vec2(1.,.55)+17.,35.,span);
          float pebble=surfaceNoise(grainUV+11.3,190.,grainSpan);
          float pores=surfaceNoise(grainUV+3.7,430.,grainSpan);
          float fine=surfaceNoise(grainUV+23.1,1050.,grainSpan);
          float valleys=(1.-pores)*(1.-pores);
          base=tint*(.94+(pores-.5)*.09+(pebble-.5)*.045+(folds-.5)*.04);
          roughness=.63+(pores-.5)*.09+(pebble-.5)*.04+(fine-.5)*.03;
          recipeHeight=(pebble-.5)*.00022+(pores-.5)*.00034+(fine-.5)*.00005+(folds-.5)*.00016;
          cavity=1.-valleys*.055;
        }else{
          // Smooth periodic Nomex twill & warp/weft yarns cross over/under; frequencies
          // tend to their analytic mean before Nyquist. No unfiltered checkerboard.
          vec2 phase=grainUV*780.;
          vec2 detail=vec2(1.)-smoothstep(vec2(.30),vec2(.80),fwidth(phase));
          vec2 yarn=cos(phase*6.2831853)*detail;
          float crossing=.5+.5*sin(phase.x*3.14159265)*sin(phase.y*3.14159265)*detail.x*detail.y;
          float twillPhase=(grainUV.x+grainUV.y*.5)*520.;
          float twill=cos(twillPhase*6.2831853)*(1.-smoothstep(.30,.80,fwidth(twillPhase)));
          float weave=mix(yarn.x,yarn.y,crossing);
          float fibre=surfaceNoise(grainUV+29.4,1550.,grainSpan);
          base=tint*(.95+weave*.032+twill*.018+(fibre-.5)*.036);
          roughness=.90-weave*.030-twill*.015+(fibre-.5)*.040;
          recipeHeight=weave*.000046+twill*.000026+(fibre-.5)*.000018;
          cavity=.978+weave*.014+twill*.008;
        }
      }
    } else if (m<.5) {
      base*=.82+grain*.27+broad*.17;
      base*=1.-panel*.38;
      vec2 panelUV=fract(uv*.55);
      float screw=1.-smoothstep(.019,.031,length(panelUV-vec2(.065)));
      screw+=1.-smoothstep(.019,.031,length(panelUV-vec2(.935,.065)));
      base+=screw*.16*architectural;
      float ribs=1.-smoothstep(.02,.03,abs(fract(uv.y*4.)-.5));
      base*=1.-ribs*.085*architectural;
      // Integrate the brushed finish once it becomes smaller than a pixel;
      // distant armour must not turn into bands of bright parallel lines.
      float brushPhase=uv.y*980.+broad*4.;
      float brushFilter=1.-smoothstep(.65,2.8,fwidth(brushPhase));
      float brushing=.5+.5*sin(brushPhase)*brushFilter*fineDetail;
      roughness=.32+.12*brushing+.12*broad;
      float scratch=(1.-smoothstep(.008,.025,abs(fract(uv.y*4.3+noise(vec2(uv.x*1.1,0.))*.4)-.5)))*step(.62,noise(uv*vec2(2.,.25)))*fineDetail;
      base+=vec3(.035,.045,.05)*scratch;
    } else if (m<1.5) {
      base=mix(vec3(.19,.075,.025),vec3(.47,.235,.08),broad*.8+.15);
      base*=.8+grain*.43;
      base*=1.-panel*.43;
      roughness=.37+.34*broad;
      metalness=.82;
    } else if (m<2.5) {
      float tiles=grid(uv*.5,.007)*architectural;
      float variation=mix(broad,hash(floor(uv*.5)),architectural);
      base=mix(vec3(.095,.12,.135),vec3(.17,.19,.20),variation*.6);
      base*=1.-tiles*.43;
      base*=.9+grain*.3;
      vec2 diamond=fract(mat2(.707,-.707,.707,.707)*uv*12.);
      float tread=step(.68,diamond.x)*step(.65,diamond.y);
      base+=tread*.016;
      roughness=.26+.24*broad;
      float oil=smoothstep(.57,.80,noise(uv*.47+19.));
      base*=1.-oil*.24;roughness=mix(roughness,.19,oil);
      float wornEdge=max(0.,grid(uv*.5,.04)*architectural-tiles);
      base+=vec3(.025,.029,.03)*wornEdge*noise(uv*17.);
      metalness=.55;
    } else if (m<3.5) {
      base=vec3(.57,.58,.54)*(.78+grain*.3+broad*.13);
      base*=1.-panel*.22;
      roughness=.85;
      base*=.79+.21*noise(uv*vec2(6.,.19));
      metalness=0.;
    } else if (m<4.5) {
      base=vec3(.025,.74,.77);
      emission+=.72;
      roughness=.2;
      metalness=.3;
    } else if (m<5.5) {
      base=vec3(1.,.42,.06);
      emission+=.68;
      roughness=.28;
      metalness=.3;
    } else if (m<6.5) {
      base=vec3(.68,.055,.025);
      emission+=.18;
      roughness=.4;
      metalness=.4;
    } else if(m<7.5) {
      base=vec3(.065,.075,.085)*(.82+grain*.4);
      roughness=.86;
      metalness=0.;
    } else if(m<8.5) {
      if(lightSoil){
        // Neutral, filtered grain preserves the host's vegetation, mineral and snow colours.
        base=tintRGB*(.96+.11*(broad-.5)+.095*(grain-.35));roughness=.94;metalness=0.;
      }else{
        float soil=noise(uv*.6)*.6+noise(uv*3.7)*.4;
        base=mix(vec3(.13,.105,.057),vec3(.16,.24,.075),smoothstep(.3,.7,soil));
        base*=.75+grain*.5;roughness=.95;metalness=0.;
      }
    } else if(m<9.5) {
      float strata=.5+.5*sin(vWorld.y*4.+noise(uv*.9)*8.);
      base=mix(vec3(.23,.24,.22),vec3(.42,.40,.33),broad)*(.8+strata*.17+grain*.15);
      roughness=.91;metalness=0.;
    } else if(m<10.5) {
      vec2 barkUV=vec2(uv.x+sin(uv.y*.8)*.055,uv.y);
      float bark=noise(barkUV*vec2(7.,.72));
      float fibres=noise(barkUV*vec2(39.,1.5));
      vec2 knotCell=floor(barkUV*vec2(1.2,.45)),knot=fract(barkUV*vec2(1.2,.45))-.5;
      knot.x+=.17*sin(knot.y*3.+hash(knotCell)*6.);
      float knotRadius=length(knot*vec2(2.5,1.3));
      float knotMask=(1.-smoothstep(.12,.48,knotRadius))*step(.76,hash(knotCell+4.));
      float knotRings=.5+.5*sin(knotRadius*48.);
      float crevice=smoothstep(.28,.43,bark);
      base=mix(vec3(.045,.025,.013),vec3(.25,.145,.06),bark)*(.60+.40*crevice);
      base*=1.+(fibres-.5)*.30*fineDetail-knotMask*(.16+knotRings*.20)*fineDetail;
      organicHeight=bark*.022+(fibres-.5)*.005*fineDetail-knotMask*.012;
      roughness=.97;metalness=0.;
    } else if(m<11.5) {
      float clump=noise(uv*2.8),leaves=noise(uv*8.)*.7+noise(uv*19.)*.3;
      vec2 leafUV=uv*13.+vec2(clump,noise(uv*2.8+7.))*1.3;
      vec2 leaf=fract(leafUV)-.5;float angle=hash(floor(leafUV))*6.283185;
      leaf=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*leaf;
      float leafShape=1.-smoothstep(.20,.51,length(leaf*vec2(1.1,2.25)));
      float vein=(1.-smoothstep(.012,.045,abs(leaf.y)))*leafShape;
      base=mix(vec3(.025,.075,.022),vec3(.19,.31,.075),leaves)*(.78+clump*.32);
      base*=1.+(leafShape-.4)*.32*fineDetail+vein*.10*fineDetail;
      organicHeight=clump*.014+leafShape*.007*fineDetail;
      roughness=.88;metalness=0.;
    } else if(m<12.5) {
      // The distant ocean and the original 8 km port plane share a datum.
      // Keep exactly one surface where they overlap, including away from a boat.
      if(m>12.04&&m<12.06&&max(abs(vWorld.x),abs(vWorld.z))<=4000.)discard;
      if(vAnchor.y<0.&&uSeaMotion.w>.5){
        vec2 seaOffset=abs(vWorld.xz-uSeaOrigin.xy);
        if(m<12.1&&max(seaOffset.x,seaOffset.y)<uSeaOrigin.z)discard;
        if(m>12.1){vec3 w=seaField(vWorld.xz);n=normalize(vec3(-w.y,1.,-w.z));}
      }
      base=vec3(.035,.12,.15)*(.9+sin(uv.x*9.+uEffects.x)*sin(uv.y*7.-uEffects.x*.7)*.1);
      roughness=.13;metalness=.35;
    } else if(m<13.5) {
      // PDR : façade d'immeuble. Étages, fenêtres en retrait, vitrines du rez-de-chaussée et toit de gravier ;
      // la fraction de la matière (12,55 à 13,45) choisit le rythme des baies.
      float style=clamp((m-12.55)/.9,0.,1.);
      vec3 enduit=vColor.w>.5?tintRGB:vec3(.72,.67,.6);
      roughness=.86;metalness=0.;
      if(an.y>.65){
        base=mix(vec3(.15,.15,.155),enduit*.55,.3)*(.82+grain*.26+broad*.14)*(.93+noise(uv*3.1)*.12);
        roughness=.95;
      }else{
        float etage=3.05+.55*fract(style*7.31),pas=2.25+1.35*fract(style*3.17);
        float largeur=.34+.30*fract(style*5.73),hauteur=.42+.22*fract(style*9.11);
        bool sideX=abs(vFaceNormal.x)>abs(vFaceNormal.z);float faceW=sideX?vDimensions.z:vDimensions.x;
        float faceX=(sideX?vLocal.z:vLocal.x)*faceW+faceW*.5,margin=min(.8,faceW*.2),span=max(.01,faceW-2.*margin),columns=max(1.,floor(span/pas)),stepX=span/columns;
        float edge=step(margin,faceX)*step(faceX,faceW-margin)*step(1.7,faceW);
        vec2 g=vec2((faceX-margin)/stepX,uv.y/etage),cellule=floor(g),f=fract(g),aa=max(fwidth(g),vec2(.0001));
        float haut=step(4.3,uv.y),rez=1.-haut;
        float fenetre=(1.-smoothstep(largeur*.5-aa.x,largeur*.5+aa.x,abs(f.x-.5)))*(1.-smoothstep(hauteur*.5-aa.y,hauteur*.5+aa.y,abs(f.y-.56)))*haut;
        float facadeTop=vWorld.y+(.5-vLocal.y)*vDimensions.y;
        fenetre*=step((cellule.y+.56+hauteur*.5)*etage,facadeTop-.30);
        float bays=max(1.,floor(span/5.4)),bayX=(faceX-margin)/span*bays,baie=fract(bayX),ab=max(fwidth(bayX),.0001);
        float vitrine=(1.-smoothstep(.40-ab,.40+ab,abs(baie-.5)))*smoothstep(.5,.62,uv.y)*(1.-smoothstep(3.2,3.3,uv.y))*rez;
        float bandeau=smoothstep(3.5,3.58,uv.y)*(1.-smoothstep(4.05,4.12,uv.y));
        float corniche=(1.-smoothstep(0.,.06+aa.y,f.y))*haut;
        float h=hash(cellule+floor(style*97.));
        vec3 vitre=mix(vec3(.10,.13,.16),vec3(.33,.41,.49),h*.8+.1);
        vitre=mix(vitre,vec3(.60,.49,.33),step(.94,h)*.55);
        vec3 mur=enduit*(.84+grain*.2+broad*.10);
        mur=mix(mur,mur*1.09,corniche);
        mur=mix(mur,enduit*.5,bandeau);
        float lointain=smoothstep(.3,.75,max(aa.x,aa.y));
        float verre=mix(max(fenetre,vitrine),mix(largeur*hauteur,.32,rez),lointain);
        verre*=edge;base=mix(mur,vitre,verre);
        roughness=mix(.86,.12,verre);metalness=mix(0.,.45,verre);
        urbanHeight=-verre*.035;pbrWeight=1.-verre;
        // Fixed dwelling occupancy, smoothly fading at dusk and after midnight.
        // Runs in the existing facade pass: no new triangles or per-window lights.
        float home=hash(cellule+floor(vAnchor.xz*.31)+style*31.);
        float occupied=smoothstep(home-.025,home+.025,mix(.16,.49,evening));
        float shop=step(.18,hash(vec2(floor(bayX),floor(vAnchor.x+vAnchor.z))))*mix(.18,.84,evening);
        float curtain=.78+.22*smoothstep(.12,.22,abs(f.x-.5));
        vec3 lamp=mix(vec3(1.,.58,.25),vec3(.92,.87,.66),step(.78,home));
        float frame=(1.-smoothstep(.010,.025+aa.x,abs(f.x-.5)))*fenetre;
        frame=max(frame,(1.-smoothstep(.008,.021+aa.y,abs(f.y-.53)))*fenetre);
        frame*=1.-lointain;
        base=mix(base,enduit*.45,frame*.82);
        float blinds=mix(1.,.58+.42*smoothstep(.10,.28,abs(f.x-.5)),step(.64,home));
        windowGlow=lamp*night*edge*mix(fenetre*occupied*curtain*blinds*(.80+.65*home),vitrine*shop*1.10,rez)*(1.-lointain*.65)*(1.-frame*.92);

      }
    } else if(m<14.5) {
      if(roadGrain||roadPaint){
        float aggregate=mix(.5,noise(uv*67.),fineDetail);
        base=tintRGB*(.97+.08*(aggregate-.5)+.045*(broad-.5));
        roughness=roadPaint?.80:.91;metalness=0.;urbanHeight=(aggregate-.5)*.002;
      }else{
        // PDR : asphalte, granulat fin, reprises et fissures.
        vec3 teinte=vColor.w>.5?tintRGB:vec3(.2,.2,.21);
        float granulat=mix(.5,noise(uv*95.),fineDetail);
        float reprise=smoothstep(.55,.75,noise(uv*.18+3.));
        float fissure=(1.-smoothstep(0.,.035,abs(noise(uv*.9)-.5)))*step(.55,noise(uv*.23+9.))*fineDetail;
        base=teinte*(.82+granulat*.22+broad*.12)*(1.-reprise*.12)*(1.-fissure*.35);
        roughness=.9;metalness=0.;urbanHeight=granulat*.006-fissure*.01;
      }
    } else if(m<15.5) {
      // PDR : dallage de pierre, appareil à joints décalés.
      vec3 teinte=vColor.w>.5?tintRGB:vec3(.7,.67,.6);
      vec2 d=uv*1.3,rang=vec2(d.x+.5*mod(floor(d.y),2.),d.y);
      float joint=grid(rang,.035),pierre=hash(floor(rang));
      base=teinte*(.86+pierre*.16+grain*.12)*(1.-joint*.3);
      roughness=.82;metalness=0.;
      urbanHeight=(1.-joint)*.006;
    } else if(m<16.5) {
      // PDR : peinture laquée des véhicules et des boucliers.
      base=(vColor.w>.5?tintRGB:vec3(.5))*(.94+grain*.06);
      roughness=.22;metalness=.35;
    } else if(m<17.5) {
      // BITUME : peinture satinée 17, couleur conservée sous le ciel en incidence rasante.
      base=(vColor.w>.5?tintRGB:vec3(.5))*(.95+grain*.05);
      roughness=mix(.46,.3,uPhoto);metalness=.04;
    } else {
      // PDR : tissu et peau des figurines.
      base=(vColor.w>.5?tintRGB:vec3(.5))*(.9+grain*.14);
      roughness=.92;metalness=0.;
    }
    if(m>19.05&&m<19.15){
      // Individually modeled glass on the nearby Marseille facades.
      float home=hash(floor(vAnchor.xz*7.)+floor(vAnchor.y*3.));
      float occupied=smoothstep(home-.025,home+.025,mix(.16,.49,evening));
      roughness=.13;metalness=.35;
      windowGlow=mix(vec3(1.,.58,.25),vec3(.92,.87,.66),step(.78,home))*night*occupied*1.7;
    }
    if(recipe<.5&&!lightSoil&&vColor.w>.5&&m<12.5&&!(m>11.5&&vAnchor.y<0.)){
      vec3 tint=tintRGB*(.88+grain*.2)*(1.-panel*.12)*(m<3.5?.65:1.);
      base=m>7.5?base*.35+tint*.65:tint;
    }
    if(vObject>.5&&m<2.5){
      // Local edge wear survives instance tinting and follows the moving plate.
      // It cannot bring the architecture's world-space panel grid onto a gun.
      vec2 localUV=an.y>.65?vLocal.xz:(an.x>an.z?vLocal.zy:vLocal.xy);
      float edgeDistance=.5-max(abs(localUV.x),abs(localUV.y));
      float wear=(1.-smoothstep(.008,.025+fwidth(edgeDistance),edgeDistance))*(.52+.48*broad);
      float scuff=(1.-smoothstep(.015,.055,abs(sin(uv.y*173.+grain*11.))))*smoothstep(.52,.74,broad)*fineDetail;
      base*=.82+.24*broad+.14*grain;
      base=mix(base,base*1.28+vec3(.055,.065,.07),wear*.7);
      base+=vec3(.04,.045,.048)*scuff;
      roughness=mix(roughness,.21,wear*.82);
    }
    if(m>18.5&&m<19.5){base=tintRGB;roughness=.08;metalness=.48;}
    float height=(1.-panel)*.012+grain*.003*fineDetail;
    if(m>1.5&&m<2.5){
      vec2 treadUV=mat2(.707,-.707,.707,.707)*uv*12.;
      float tread=(1.-smoothstep(.26,.34,abs(fract(treadUV.x)-.5)))*(1.-smoothstep(.08,.16,abs(fract(treadUV.y)-.5)));
      height=(1.-grid(uv*.5,.007)*architectural)*.006+tread*.0018*fineDetail;
    }
    if(recipe>7.5)n=microReliefNormal(n,recipeHeight);
    else if(recipe>.5)n=reliefNormal(n,recipeHeight);
    else{
      if(m<3.5)n=reliefNormal(n,height);
      if(m>7.5&&m<9.5)n=reliefNormal(n,(noise(uv*7.)-.5)*.009*fineDetail);
      if(m>9.5&&m<11.5)n=reliefNormal(n,organicHeight*fineDetail);
      if(m>12.5&&m<15.5)n=reliefNormal(n,urbanHeight*fineDetail);
    }
    if(m>2.5&&m<3.5)pbrWeight=1.;
    if(m>13.5&&m<14.5&&!roadGrain&&!roadPaint){pbrWeight=1.;pbrLayer=0.;}
    if(recipe<.5&&uPbrReady>.5&&pbrWeight>0.){
      vec2 texUV=uv/(pbrLayer<.5?3.:2.);vec3 coord=vec3(texUV,pbrLayer);
      vec3 albedo=texture(uPbrAlbedo,coord).rgb;
      if(pbrLayer>.5)albedo*=vColor.w>.5?tintRGB*1.9:vec3(1.25);
      base=mix(base,albedo,pbrWeight*.92);roughness=mix(roughness,clamp(texture(uPbrRough,coord).r,.35,.98),pbrWeight);
      vec3 mapN=texture(uPbrNormal,coord).xyz*2.-1.;mapN.xy*=.50;
      vec3 dp1=dFdx(vWorld),dp2=dFdy(vWorld);vec2 duv1=dFdx(texUV),duv2=dFdy(texUV);
      vec3 t=cross(dp2,geometricNormal)*duv1.x+cross(geometricNormal,dp1)*duv2.x;
      vec3 b=cross(dp2,geometricNormal)*duv1.y+cross(geometricNormal,dp1)*duv2.y;
      float inv=inversesqrt(max(max(dot(t,t),dot(b,b)),1e-10));
      vec3 mapped=normalize(mat3(t*inv,b*inv,geometricNormal)*mapN);n=normalize(mix(n,mapped,pbrWeight));metalness=0.;
    }
    if(m>19.5&&m<20.5){base=tintRGB*(.96+noise(uv*210.)*.04);roughness=.53;metalness=0.;}
    // Pixel-scale normal variation broadens highlights instead of shimmering.
    vec3 ndx=dFdx(n),ndy=dFdy(n);
    roughness=min(.98,sqrt(roughness*roughness+min(.16,max(dot(ndx,ndx),dot(ndy,ndy))*.28)));
    float puddle=0.;
    if(recipe>.5&&recipe<4.5){
      // Rain only reaches exposed surfaces. A single persistent mask controls
      // darkening, gloss and normal flattening; wet asphalt remains dielectric.
      float upward=clamp(geometricNormal.y,0.,1.);
      float exposure=clamp(vOutdoor,0.,1.)*uEnvironment.x;
      float wet=clamp(uWeather.x,0.,1.)*exposure*(.18+.82*upward);
      float pool=smoothstep(.45,.72,noise(vWorld.xz*.23+vec2(5.7,13.1)))*upward;
      float film=wet*(.30+.70*pool);
      puddle=wet*pool;
      base*=1.-wet*(recipe<1.5?.32:.22);
      roughness=mix(roughness,recipe<1.5?.12:.18,film);
      n=normalize(mix(n,geometricNormal,film*.82));
    }else if(recipe>4.5&&recipe<7.5){
      // Natural surfaces darken when exposed, retaining a dielectric, mostly
      // rough finish. Bark and leaves do not acquire asphalt puddles.
      float exposed=clamp(vOutdoor,0.,1.)*uEnvironment.x;
      float wet=clamp(uWeather.x,0.,1.)*exposed*(.24+.76*max(geometricNormal.y,0.));
      base*=1.-wet*(recipe<5.5?.26*(1.-soilSnow*.85):recipe<6.5?.21:.12);
      roughness=mix(roughness,recipe<5.5?mix(.49,.84,soilSnow):recipe<6.5?.54:.32,wet*.78);
      n=normalize(mix(n,geometricNormal,wet*.30));
    }else if(recipe>7.5){
      // Leather and fireproof woven fabric darken subtly in rain without turning
      // into glossy wet plastic; woven Nomex retains its matte micro-weave.
      float exposed=clamp(vOutdoor,0.,1.)*uEnvironment.x;
      float wet=clamp(uWeather.x,0.,1.)*exposed*(.20+.80*max(geometricNormal.y,0.));
      base*=1.-wet*(recipe<8.5?.11:.16);
      roughness=mix(roughness,recipe<8.5?.54:.85,wet*(recipe<8.5?.45:.35));
      n=normalize(mix(n,geometricNormal,wet*(recipe<8.5?.18:.08)));
    }else{
      float wet=uWeather.x*clamp(n.y,0.,1.)*step(13.5,m)*step(m,15.5);
      puddle=smoothstep(.48,.72,noise(vWorld.xz*.29))*wet;
      base*=1.-wet*.22;roughness=mix(roughness,.105,puddle);metalness=mix(metalness,.24,puddle);
    }
    vec3 view=normalize(uEye-vWorld);
    float distanceToEye=length(uEye-vWorld);
    vec3 light=vec3(.075,.10,.12)*(.72+.28*n.y);
    light+=vec3(.075,.09,.09)*max(dot(n,normalize(vec3(-.45,.85,.35))),0.);
    light*=1.-panel*.18;
    float outdoors=clamp(vOutdoor,0.,1.)*uEnvironment.x;
    light=mix(light,uAmbient*(.72+.28*max(n.y,0.)),outdoors);
    if(recipe>4.5)light*=cavity;
    vec3 f0=mix(vec3(.04),clamp(base,vec3(.025),vec3(.92)),metalness);
    vec3 specular=vec3(0.);
    for(int i=0;i<12;i++) {
      if(i>=uLightCount) break;
      vec3 toLight=uLightPosition[i]-vWorld;
      float d=length(toLight);
      vec3 l=toLight/max(d,.001);
      float attenuation=(i<2?.27:.13)/(1.+d*d*.26);
      if(uLightRange[i]>0.)attenuation*=1.-smoothstep(uLightRange[i]*.35,uLightRange[i],d);
      if(uLightCone[i].x>0.)attenuation*=smoothstep(uLightCone[i].x,uLightCone[i].y,dot(-l,uLightDirection[i]));
      float diffuse=max(dot(n,l),0.);
      float visibility=i==0?shadow(geometricNormal,l,0):i==1&&uEnvironment.x<.5?shadow(geometricNormal,l,1):1.;
      light+=uLightColor[i]*attenuation*(diffuse*visibility+.035);
      specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;
    }
    float sunlight=outdoors>.5?shadow(geometricNormal,uSunDirection,1):0.;
    float leafBack=m>10.5&&m<11.5&&recipe<6.5?max(dot(-n,uSunDirection),0.)*.24:0.;
    light+=uSunColor*(max(dot(n,uSunDirection),0.)+leafBack)*sunlight;
    if(recipe>6.5){
      // Thin leaf transmission is shadow-aware, coloured by chlorophyll and
      // strongest toward the sun. It never becomes an unlit emissive outline.
      float back=max(dot(-n,uSunDirection),0.);
      float forward=pow(max(dot(-view,uSunDirection),0.),4.);
      light+=uSunColor*vec3(.65,1.,.38)*leafTransmission*back*(.55+.45*forward)*sunlight;
    }
    specular+=uSunColor*sunlight*metalHighlight(n,view,uSunDirection,roughness,f0);
    if(uTorchPosition.y>-90000.){
      vec3 torchVector=uTorchPosition-vWorld;
      float torchDistance=length(torchVector);
      vec3 torchDirection=normalize(torchVector);
      float cone=smoothstep(.59,.96,dot(-torchDirection,uForward));
      float torch=cone/(1.+torchDistance*torchDistance*.045)*shadow(geometricNormal,torchDirection,2);
      light+=vec3(.44,.52,.56)*torch*max(dot(n,torchDirection),0.);
      specular+=vec3(.44,.52,.56)*torch*metalHighlight(n,view,torchDirection,roughness,f0)*1.5;
    }
    if(uEffects.y>0.){
      vec3 muzzleVector=uTorchPosition+uForward*.8-vWorld;
      float muzzleDistance=length(muzzleVector),muzzlePower=uEffects.y*2.2/(1.+muzzleDistance*muzzleDistance*.14);
      vec3 muzzleDirection=muzzleVector/max(muzzleDistance,.001);
      light+=vec3(1.,.48,.12)*muzzlePower*(.22+.78*max(dot(n,muzzleDirection),0.));
      specular+=vec3(1.,.48,.12)*muzzlePower*metalHighlight(n,view,muzzleDirection,roughness,f0);
    }
    if(vOverlay>.5&&uOverlayMode<.5)light+=vec3(.18,.22,.25);
    vec3 color=base*light+specular;
    // Analytic environment reflection: the biome's sky/ground hemisphere and
    // a soft indoor ceiling. This is intentionally not a scene-mirror pass.
    vec3 reflected=reflect(-view,n);
    vec3 sky=mix(uSkyBottom,uSkyTop,smoothstep(0.,1.,reflected.y));
    if(outdoors>.5&&roughness<.65&&metalness>.25){
      vec2 cloudUV=reflected.xz/max(.13,reflected.y+.18)*1.8+uCloudOffset;
      // One broad procedural lobe, filtered by roughness; no cubemap pass.
      float field=noise(cloudUV)*.8+.2;
      float cloud=smoothstep(.49-roughness*.08,.73+roughness*.08,field)*smoothstep(-.01,.24,reflected.y);
      float sun=max(0.,dot(reflected,uSunDirection));
      float skyLight=clamp(max(max(uSkyBottom.r,uSkyBottom.g),uSkyBottom.b)*1.5,.025,1.);
      vec3 cloudColor=mix(uSkyBottom,vec3(1.12,1.10,1.01)*skyLight,.62)+uSunColor*pow(sun,6.)*.12;
      sky=mix(sky,cloudColor,cloud*.66);
      sky+=uSunColor*pow(sun,mix(48.,10.,roughness))*.16;
    }
    vec3 outside=mix(uAmbient*.20,sky,smoothstep(-.16,.18,reflected.y));
    vec3 inside=mix(vec3(.02,.03,.035),vec3(.18,.24,.27),smoothstep(-.45,.75,reflected.y));
    vec3 environmentReflection=mix(inside,outside,outdoors);
    environmentReflection=mix(environmentReflection,uAmbient*.85,roughness*roughness*.8);
    float nv=max(dot(n,view),0.),grazing=pow(1.-nv,5.);
    vec3 environmentFresnel=f0+(max(vec3(1.-roughness),f0)-f0)*grazing;
    color+=environmentReflection*environmentFresnel*(.18+1.3*(1.-roughness)*(1.-roughness))*(.5+metalness*2.5);
    // BITUME : boost « photoréaliste » en qualité Fine — reflet net du soleil, renvoi chaud du sol et reflet
    // d'environnement renforcé sur les surfaces lisses. Réservé à uPhoto>0 ; la qualité Légère reste identique.
    if(uPhoto>.5){
      vec3 sunDir=normalize(uSunDirection);
      vec3 halfV=normalize(view+sunDir);
      float glint=pow(max(dot(n,halfV),0.),mix(240.,28.,roughness))*mix(1.,.12,roughness);
      if(recipe>7.5)glint*=recipe>8.5?.06:.32;
      color+=uSunColor*glint*sunlight*1.5;
      if(recipe>8.5)color+=base*(uAmbient*.42+uSunColor*sunlight*.16)*pow(1.-nv,3.6)*.22;
      vec3 groundBounce=mix(vec3(.10,.085,.06),uAmbient*.5,.5);
      color+=groundBounce*environmentFresnel*(1.-smoothstep(-.4,.12,reflected.y))*(.3+.7*(1.-roughness));
      color+=environmentReflection*environmentFresnel*(1.-roughness)*(1.-roughness)*(recipe>8.5?.12:.5);
    }
    float pulse=.94+.06*sin(uEffects.x*2.2+vWorld.y*3.);
    color+=base*emission*pulse*1.55+windowGlow;
    vec3 fogColor=mix(vec3(.009,.018,.024),uFogColor,outdoors);
    float fog=1.-exp(-distanceToEye*mix(.014+.008*exp(-max(vWorld.y,0.)*.7),uEnvironment.y,outdoors));
    if(vOverlay>.5) fog=0.;
    color=mix(color,fogColor,min(fog,.86));
    color=color/(color+vec3(.76));
    color=pow(max(color,vec3(0.)),vec3(.4545));
    // PDR (voile) : hors de la vue du joueur, le dehors s'assombrit et perd ses couleurs ; à force 0, rien ne change.
    if(uVoileForce>0.&&outdoors>.5){
      float seen=texture(uVoile,(vWorld.xz-uVoileZone.xy)*uVoileZone.zw).r;
      vec3 dull=vec3(dot(color,vec3(.299,.587,.114)))*vec3(.93,.97,1.04);
      color=mix(color,mix(color,dull,.6)*.42,uVoileForce*(1.-seen));
    }
    vec2 screen=gl_FragCoord.xy/uResolution;
    float vignette=pow(max(0.,16.*screen.x*screen.y*(1.-screen.x)*(1.-screen.y)),.13);
    color*=mix(.59,1.,vignette);
    float hurt=uEffects.z*(1.-vignette*.65);
    color=mix(color,vec3(.64,.035,.015),clamp(hurt*.68,0.,.6));
    float waveRadius=(1.-clamp(uEffects.w,0.,1.))*.8;
    float wave=exp(-abs(length((screen-.5)*vec2(uResolution.x/uResolution.y,1.))-waveRadius)*85.)*uEffects.w;
    color+=vec3(.03,.27,.23)*wave;
    float reflection=(vOverlay>.5||emission>.5)?0.:clamp((1.-roughness)*(.13+metalness*.6)+puddle*.30,0.,.75);
    // Keep derivative-based surface normals and filtering identical for every
    // surviving fragment. Coverage rejects only after the opaque shading work.
    opaqueOpacityDiscard();
    fragColor=vec4(color,reflection);
  }`;

  // A separate translucent pass keeps smoke/steam out of depth atlases and
  // leaves the established opaque material shader unchanged.
  // Each edit of VERT must find its target exactly once: before 0.3.37 both edits had lost their target and FX_VERT
  // stayed VERT in silence (no ring deformation, no grain bound on large effects).
  function exactReplace(source,target,replacement){
    const at=source.indexOf(target);
    if(at<0||source.indexOf(target,at+1)>=0)throw new Error('FERRO FX_VERT : cible '+(at<0?'absente':'multiple')+' dans VERT : '+target);
    return source.slice(0,at)+replacement+source.slice(at+target.length);
  }
  const FX_VERT=[
    ['vWorld=rotation*localPosition+iPosition.xyz;',`
    vec3 particlePosition=aPosition;
    if(iPosition.w>=20.){
      float radial=length(aPosition.xz);
      float side=clamp((radial-.37)/.13,0.,1.);
      float inner=clamp(iPosition.w-20.,0.,.999);
      particlePosition.xz*=mix(inner*.5,.5,side)/max(radial,.0001);
    }
    vWorld=rotation*(particlePosition*iScale.xyz)+iPosition.xyz;`],
    // PDR (grain) : le grain des fumées et des flammes est pris à l'échelle d'une particule de 2,6 m au plus ; au-delà
    // (colonnes de fumée, nuages de gaz vus de 300 à 900 m), il ne tombe plus sous le pixel en semis de points.
    ['vSurface=vObject>.5?localPosition:vWorld;','vSurface=(vObject>.5?localPosition:vWorld)*min(1.,2.6/max(max(abs(iScale.x),abs(iScale.y)),max(abs(iScale.z),.001)));\n    vFogWeight=1.-mod(floor(iRotation.w/128.),256.)/255.;'],
    // Poids de brouillard par instance (mesh.fog, 1 par défaut) : bits 7 à 14 des drapeaux des effets.
    ['flat out vec4 vColor;','flat out vec4 vColor;\n  flat out float vFogWeight;']
  ].reduce((source,[target,replacement])=>exactReplace(source,target,replacement),VERT);
  const FX_FRAG=`#version 300 es
  precision highp float;
  in vec3 vWorld;
  in vec3 vNormal;
  in vec3 vSurface;
  in vec3 vLocal;
  in vec3 vFaceNormal;flat in vec3 vDimensions;
  flat in float vMaterial;
  flat in float vEmission;
  flat in float vOutdoor;
  flat in vec4 vColor;
  flat in float vFogWeight;
  uniform vec3 uEye;
  uniform vec3 uAmbient;uniform vec3 uSkyTop;uniform vec3 uSkyBottom;
  uniform vec3 uFogColor;
  uniform vec2 uEnvironment;
  uniform float uTime;
  out vec4 fragColor;
  float noise(vec3 p){
    return .5+.18*sin(p.x*3.7+p.y*2.1+uTime*.65)+.16*sin(p.y*4.9-p.z*3.1-uTime*.41)+.12*sin(p.z*7.1+p.x*4.3);
  }
  void main(){
    vec3 toEye=uEye-vWorld;
    float distanceToEye=max(length(toEye),.001);
    // Ground telegraphs must stay readable at grazing player-eye angles.
    // Only cosmetic volumes soften toward their silhouette.
    float edge=vMaterial>=15.5?1.:pow(max(dot(normalize(vNormal),toEye/distanceToEye),0.),.65);
    float grain=clamp(noise(vSurface),.1,1.);
    bool fire=vMaterial>13.5&&vMaterial<14.5,smoke=vMaterial>14.5&&vMaterial<15.5,spark=vMaterial>16.5&&vMaterial<17.5;
    float heat=fire?smoothstep(.22,.83,noise(vSurface*vec3(1.65,.72,1.65)-vec3(0.,uTime*2.7,0.))):0.;
    float alpha=clamp(vColor.a*edge*(.58+grain*.42)*(fire?mix(.28,1.,heat):1.),0.,.94);
    if(smoke){
      vec3 flow=vSurface*vec3(.91,.65,.91)-vec3(0.,uTime*.30,0.);
      float billow=noise(flow)*.66+noise(flow*2.1+vec3(7.,3.,11.))*.34;
      alpha*=smoothstep(.16,.76,billow);
    }
    if(spark)alpha*=.30+.70*smoothstep(-.5,.18,vLocal.y);
    bool glass=vMaterial>17.5&&vMaterial<18.5;if(glass)alpha=mix(vColor.a,.70,pow(1.-abs(dot(normalize(vNormal),toEye/distanceToEye)),3.));
    if(alpha<.004)discard;
    vec3 color=vColor.rgb*(uAmbient*.65+vec3(.34)+max(vEmission,0.)*1.25);
    if(glass){vec3 r=reflect(-toEye/distanceToEye,normalize(vNormal));color=mix(color,mix(uSkyBottom,uSkyTop,smoothstep(0.,1.,r.y)),.68);}
    if(fire){
      vec3 temperature=mix(vec3(.72,.025,.002),vec3(1.8,.23,.008),smoothstep(.10,.65,heat));
      temperature=mix(temperature,vec3(2.7,1.45,.23),smoothstep(.60,1.,heat));
      color=temperature*(.55+max(vEmission,0.)*.45)*(.7+grain*.3);
    }
    if(smoke)color*=.74+.40*grain;
    if(spark)color=mix(vec3(1.3,.10,.005),vec3(2.6,1.7,.52),smoothstep(-.25,.42,vLocal.y))*(.5+vEmission*.45);
    float fog=(1.-exp(-distanceToEye*mix(.018,uEnvironment.y,clamp(vOutdoor,0.,1.))))*vFogWeight;
    color=mix(color,uFogColor,min(.86,fog));
    color=pow(max(color/(color+vec3(.76)),vec3(0.)),vec3(.4545));
    fragColor=vec4(color,alpha);
  }`;

  const DEPTH_FRAG=`#version 300 es
  precision highp float;
  flat in float vMaterial;in vec3 vWorld;in vec3 vLocal;flat in vec3 vDimensions;
  ${GROUND_COVER_FRAGMENT}
  ${OPAQUE_OPACITY_FRAGMENT}
  void main() {groundCoverDiscard();opaqueOpacityDiscard();if(vMaterial>12.1&&vMaterial<12.4)discard;}`;
  const POST_VERT=`#version 300 es
  precision highp float;
  out vec2 vUV;
  void main(){
    vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
    vUV=p;gl_Position=vec4(p*2.-1.,0.,1.);
  }`;
  const SKY_FRAG=`#version 300 es
  precision highp float;
  in vec2 vUV;
  uniform vec3 uSkyRight;
  uniform vec3 uSkyUp;
  uniform vec3 uSkyForward;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyBottom;
  uniform vec3 uSkyFog;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform vec2 uSkyFov;
  uniform vec2 uSkyMotion;uniform vec4 uWeather;uniform vec2 uCloudOffset;uniform float uSkyNight;
  out vec4 fragColor;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 a=floor(p),b=fract(p);b=b*b*(3.-2.*b);
    return mix(mix(hash(a),hash(a+vec2(1.,0.)),b.x),mix(hash(a+vec2(0.,1.)),hash(a+vec2(1.)),b.x),b.y);
  }
  float cloud(vec2 p){return noise(p)*.52+noise(p*2.03+11.)*.28+noise(p*4.17)*.14+noise(p*8.1)*.06;}
  void main(){
    vec2 uv=vUV*2.-1.;
    vec3 ray=normalize(uSkyForward+uSkyRight*uv.x*uSkyFov.x+uSkyUp*uv.y*uSkyFov.y);
    float elevation=clamp(ray.y,0.,1.);
    vec3 color=mix(uSkyBottom,uSkyTop,pow(elevation,.55));
    float sun=max(0.,dot(ray,uSunDirection));
    color+=uSunColor*(pow(sun,48.)*.20+pow(sun,650.)*.65+smoothstep(.99925,.99965,sun)*2.8)*(1.-uSkyNight);
    vec2 cloudUV=ray.xz/max(.13,ray.y+.18)*1.8+uCloudOffset;
    float clouds=smoothstep(.68-uWeather.y*.49,.88-uWeather.y*.41,cloud(cloudUV))*smoothstep(-.03,.16,ray.y);
    float skyLight=clamp(max(max(uSkyBottom.r,uSkyBottom.g),uSkyBottom.b)*1.5,.025,1.);
      vec3 cloudColor=mix(uSkyBottom,vec3(1.12,1.10,1.01)*skyLight,.62)+uSunColor*pow(sun,6.)*.12;
    cloudColor=mix(cloudColor,vec3(.075,.09,.12)*skyLight,uWeather.z*.84);color=mix(color,cloudColor,clouds*.92);color+=vec3(.65,.72,.90)*uWeather.w;
    // The geographic coastline supplies real silhouettes; keep the open sea horizon clear.
    float night=max(uSkyNight,1.-smoothstep(.025,.16,max(max(uSkyBottom.r,uSkyBottom.g),uSkyBottom.b)));
    vec2 stars=ray.xz/max(.08,ray.y)*310.;vec2 starCell=floor(stars);float starSeed=hash(starCell);
    float sparkle=step(.997,starSeed)*exp(-dot(fract(stars)-.5,fract(stars)-.5)*90.);
    color+=vec3(.35,.42,.55)*sparkle*night*(1.-clouds)*smoothstep(.08,.3,ray.y);
    // One existing sky pass: the lighting direction also locates the moon.
    // Explicit night=0 leaves the historical daylight and automatic stars intact.
    if(uSkyNight>0.){
      float moon=smoothstep(.99988,.99996,sun),halo=pow(sun,1300.)*.085;
      color+=vec3(.42,.55,.78)*(moon+halo)*uSkyNight*(1.-clouds)*smoothstep(0.,.10,ray.y);
    }
    color=color/(color+vec3(.76));color=pow(max(color,vec3(0.)),vec3(.4545));
    float vignette=pow(max(0.,16.*vUV.x*vUV.y*(1.-vUV.x)*(1.-vUV.y)),.13);
    fragColor=vec4(color*mix(.76,1.,vignette),0.);
  }`;
  // Screen-space ray tracing of the current opaque scene; analytic sky remains the fallback.
  const SSR_FRAG=`#version 300 es
  precision highp float;
  in vec2 vUV;uniform sampler2D uColor;uniform highp sampler2D uDepth;
  uniform sampler2D uReceiverTiles;uniform int uReceiverMask;
  uniform vec4 uProjection;uniform vec2 uPixel;uniform vec4 uFovea;out vec4 fragColor;
  float distanceZ(float depth){return uProjection.w/(depth*2.-1.+uProjection.z);}
  // Depth needs highp even when float already is highp: a low precision sampler
  // quantizes the road into rows before the normal and reflected ray are built.
  vec2 pixelCenter(vec2 uv){return (floor(uv/uPixel)+.5)*uPixel;}
  vec3 position(vec2 uv){uv=pixelCenter(uv);float z=distanceZ(texture(uDepth,uv).r);return vec3((uv*2.-1.)*uProjection.xy*z,-z);}
  vec2 project(vec3 p){return .5+.5*p.xy/(-p.z*uProjection.xy);}
  vec3 rayPoint(vec3 a,vec3 b,float ka,float kb,float t){return mix(a,b,t)/mix(ka,kb,t);}
  void main(){
    fragColor=vec4(0.);
    float foveaWeight=1.;
    if(uFovea.w>uFovea.z){
      vec2 fd=(vUV-uFovea.xy)*vec2(uPixel.y/max(uPixel.x,1e-6),1.);
      foveaWeight=1.-smoothstep(uFovea.w*.82,uFovea.w*1.22,length(fd));
      if(foveaWeight<=.01)return;
    }
    // The four filtered bits cover every final-scene pixel that can consume this half-size texel.
    if(uReceiverMask!=0&&texture(uReceiverTiles,vUV).a<.01)return;
    vec2 receiver=pixelCenter(vUV);vec4 original=texture(uColor,receiver);
    if(original.a<.06)return;
    float depth=texture(uDepth,receiver).r,zp=distanceZ(depth);
    if(depth>=.999999||zp>200.||zp<.12)return;
    vec3 p=vec3((receiver*2.-1.)*uProjection.xy*zp,-zp);
    // One-sided differences stay on the receiver at object silhouettes. Always
    // reconstruct at the depth texel centre, including this half-size pass.
    vec3 l=p-position(vUV-vec2(uPixel.x*2.,0.)),rr=position(vUV+vec2(uPixel.x*2.,0.))-p;
    vec3 b=p-position(vUV-vec2(0.,uPixel.y*2.)),t=position(vUV+vec2(0.,uPixel.y*2.))-p;
    vec3 dx=abs(l.z)<abs(rr.z)?l:rr,dy=abs(b.z)<abs(t.z)?b:t,n=cross(dx,dy);
    if(dot(n,n)<1e-12)return;n=normalize(n);
    vec3 eye=normalize(-p);if(dot(n,eye)<0.)n=-n;vec3 r=reflect(-eye,n),origin=p+n*.055;
    float reach=r.z>0.?min(115.,(-.08-origin.z)/r.z):115.;if(reach<=.1)return;
    vec3 end=origin+r*reach;float ka=1./(-origin.z),kb=1./(-end.z);vec3 a=origin*ka,z=end*kb;
    vec2 start=project(origin),span=project(end)-start;
    vec2 limit=(mix(vec2(.012),vec2(.988),step(vec2(0.),span))-start)/(span+vec2(1e-8));
    float clipped=clamp(min(1.,min(limit.x,limit.y)),0.,1.);
    z=mix(a,z,clipped);kb=mix(ka,kb,clipped);span*=clipped;
    float pixels=max(abs(span.x)/uPixel.x,abs(span.y)/uPixel.y);if(pixels<1.)return;
    float previous=0.,oldT=0.,curPx=0.,stepPx=clamp(2./(512.*uPixel.y),1.,4.),weight=0.;vec2 hit=vec2(0.);int candidates=0;
    // Perspective-correct exponential raycast: 18 adaptive steps + 5-step binary refinement.
    for(int i=1;i<=18;i++){
      curPx+=stepPx;stepPx*=1.24;
      float atT=min(1.,curPx/pixels);vec2 uv=start+span*atT;
      float sampled=texture(uDepth,uv).r,sceneZ=distanceZ(sampled),delta=1./mix(ka,kb,atT)-sceneZ;
      if(sampled<.999999&&delta>0.&&previous<=0.){
        candidates++;float lo=oldT,hi=atT,hitDepth=sampled;
        for(int j=0;j<5;j++){
          float mid=(lo+hi)*.5,midDepth=texture(uDepth,start+span*mid).r;
          if(1./mix(ka,kb,mid)-distanceZ(midDepth)>0.){hi=mid;hitDepth=midDepth;}else lo=mid;
        }
        hit=start+span*hi;vec3 point=rayPoint(a,z,ka,kb,hi);
        float difference=-point.z-distanceZ(hitDepth),thickness=clamp(sceneZ*.005,.025,.24);
        if(hitDepth<.999999&&difference>=0.&&difference<thickness){
          float edge=min(min(hit.x,hit.y),min(1.-hit.x,1.-hit.y)),travel=length(point-origin);
          weight=foveaWeight*smoothstep(.01,.12,edge)*(1.-smoothstep(70.,115.,travel))*(1.-smoothstep(15.,18.,float(i)));
          break;
        }
        if(candidates>=2)break;
      }
      previous=sampled>=.999999?-1.:delta;oldT=atT;if(atT>=1.)break;
    }
    if(weight>0.){float fresnel=.35+.65*pow(1.-max(dot(n,eye),0.),3.),alpha=weight*original.a*fresnel;fragColor=vec4(texture(uColor,hit).rgb*alpha,alpha);}
  }`;
  const POST_FRAG=`#version 300 es
  precision highp float;
  in vec2 vUV;
  uniform sampler2D uScene;
  uniform sampler2D uBloom;uniform sampler2D uReflection;uniform int uReflections;
  uniform vec2 uTexel;
  uniform int uPass;
  out vec4 fragColor;
  vec4 bright(vec2 uv){
    vec4 c=texture(uScene,uv);
    return vec4(c.rgb*smoothstep(.56,.86,max(max(c.r,c.g),c.b)),c.a);
  }
  void main(){
    if(uPass==0){
      vec4 a=bright(vUV+uTexel*vec2(-1,-1)),b=bright(vUV+uTexel*vec2(1,-1));
      vec4 c=bright(vUV+uTexel*vec2(-1,1)),d=bright(vUV+uTexel*vec2(1,1));
      // At exact 4:1 reduction, a receiver passing .025 in the final pass contributes
      // at least .025/4 to one bilinear tap. Keep even faintly reflective edges.
      float occupied=step(.001,max(max(a.a,b.a),max(c.a,d.a)));
      fragColor=vec4(((a.rgb+b.rgb)+(c.rgb+d.rgb))*.25,occupied);return;
    }
    vec2 axis=uPass==1?vec2(uTexel.x,0.):vec2(0.,uTexel.y);
    vec3 c=texture(uBloom,vUV).rgb*.227027;
    c+=texture(uBloom,vUV+axis*1.384615).rgb*.316216;
    c+=texture(uBloom,vUV-axis*1.384615).rgb*.316216;
    c+=texture(uBloom,vUV+axis*3.230769).rgb*.070270;
    c+=texture(uBloom,vUV-axis*3.230769).rgb*.070270;
    if(uPass==2){vec4 scene=texture(uScene,vUV),reflection=texture(uReflection,vUV);c=scene.rgb+c*.28;if(uReflections==1)c=mix(c,reflection.rgb/max(reflection.a,1e-5),min(.70,reflection.a)*step(.025,scene.a));}
    fragColor=vec4(c,1.);
  }`;

  // PDR (éclairage) : bibliothèque d'éclairage pour les shaders du jeu (la foule sur le GPU). Ce sont les formules du shader
  // du monde, pour une surface du dehors : ambiance, soleil et son ombre (même atlas, même noyau, même biais), lampes de
  // passage, reflet du ciel, émission, puis brouillard, tonemap, gamma et vignettage. Le shader du monde n'en dépend pas :
  // son code reste celui de FERRO. À insérer après « precision highp float; ». Uniformes posées par renderer.pdr.lier.
  // Deux apports de METAL 0.8 au shader du monde n'y sont pas, pour que la foule garde son image et son coût : la rugosité
  // élargie là où la normale varie d'un pixel à l'autre, et le reflet des nuages sur les surfaces lisses. Le vignettage
  // (0,59 ici, comme dans FRAG) suit le réglage de création : create le remplace comme worldFragment (pdrGlsl).
  const PDR_GLSL=`
  uniform highp sampler2D uPdrOmbre;
  uniform mat4 uPdrMatriceOmbre;
  uniform vec4 uPdrOmbreReglages;
  uniform vec3 uPdrOeil;
  uniform vec3 uPdrSoleil;
  uniform vec3 uPdrCouleurSoleil;
  uniform vec3 uPdrAmbiance;
  uniform vec3 uPdrBrouillard;
  uniform vec3 uPdrCielHaut;
  uniform vec3 uPdrCielBas;
  uniform vec4 uPdrEnvironnement;
  uniform vec2 uPdrResolution;
  uniform vec3 uPdrLumierePosition[12];
  uniform vec3 uPdrLumiereCouleur[12];
  uniform float uPdrLumierePortee[12];uniform vec3 uPdrLumiereDirection[12];uniform vec2 uPdrLumiereCone[12];
  uniform int uPdrLumieres;
  float pdrEchantillon(vec2 uv,vec2 decalage,float profondeur,vec2 pente){
    float texel=uPdrOmbreReglages.y;
    vec2 tap=uv+decalage*texel,centre=(floor(tap/texel)+.5)*texel;
    return step(profondeur+dot(pente,centre-uv),texture(uPdrOmbre,tap).r);
  }
  float pdrOmbreSoleil(vec3 monde,vec3 n){
    if(uPdrOmbreReglages.x<.5)return 1.;
    vec4 projete=uPdrMatriceOmbre*vec4(monde+n*.014,1.);
    vec3 p=projete.xyz/projete.w*.5+.5;
    vec3 dx=dFdx(p),dy=dFdy(p);
    float determinant=dx.x*dy.y-dx.y*dy.x;
    vec2 pente=abs(determinant)>.00000000001?vec2(dx.z*dy.y-dy.z*dx.y,dy.z*dx.x-dx.z*dy.x)/determinant:vec2(0.);
    if(projete.w<=0.||p.z<=0.||p.z>=1.||min(p.x,p.y)<=.001||max(p.x,p.y)>=.999)return 1.;
    float biais=.00014+.00024*(1.-max(dot(n,uPdrSoleil),0.)),z=p.z-biais;
    vec2 uv=uPdrOmbreReglages.z>.5?p.xy:p.xy*.5+vec2(.5,0.);
    // Full-atlas sun uses projection UVs directly; a quarter-atlas tile has
    // half-sized UVs, hence twice the receiver-plane gradient.
    pente*=uPdrOmbreReglages.z>.5?1.:2.;
    float texel=uPdrOmbreReglages.y;
    vec2 cell=uv/texel,f=fract(cell)-.5,centre=(floor(cell)+.5)*texel;
    vec3 wx=vec3(.5*(.5-f.x)*(.5-f.x),.75-f.x*f.x,.5*(.5+f.x)*(.5+f.x));
    vec3 wy=vec3(.5*(.5-f.y)*(.5-f.y),.75-f.y*f.y,.5*(.5+f.y)*(.5+f.y));
    float v=0.;
    for(int y=0;y<3;y++)for(int x=0;x<3;x++){
      vec2 tap=centre+vec2(float(x-1),float(y-1))*texel;
      v+=wx[x]*wy[y]*step(z+dot(pente,tap-uv),texture(uPdrOmbre,tap).r);
    }
    float bord=min(min(p.x,p.y),min(1.-p.x,1.-p.y));
    return mix(1.,mix(.055,1.,v),smoothstep(.012,.085,bord));
  }
  vec3 pdrFresnel(float c,vec3 f0){float q=1.-clamp(c,0.,1.),q2=q*q;return f0+(1.-f0)*q2*q2*q;}
  vec3 pdrReflet(vec3 n,vec3 vue,vec3 l,float rugosite,vec3 f0){
    vec3 h=normalize(vue+l);
    float nv=max(dot(n,vue),.001),nl=max(dot(n,l),0.),nh=max(dot(n,h),0.);
    float a=max(.055,rugosite*rugosite),a2=a*a,d=nh*nh*(a2-1.)+1.;
    float k=(rugosite+1.)*(rugosite+1.)*.125;
    return pdrFresnel(max(dot(vue,h),0.),f0)*min(a2/max(3.141593*d*d,.00001)/max(4.*(nv*(1.-k)+k)*(nl*(1.-k)+k),.001),12.)*nl;
  }
  /** Couleur linéaire, avant brouillard et tonemap, d'une surface du dehors ; ombre : visibilité du soleil (pdrOmbreSoleil). */
  vec3 pdrEclairer(vec3 base,vec3 n,vec3 monde,float rugosite,float metal,float emission,float ombre){
    vec3 vue=normalize(uPdrOeil-monde),f0=mix(vec3(.04),clamp(base,vec3(.025),vec3(.92)),metal);
    vec3 lumiere=uPdrAmbiance*(.72+.28*max(n.y,0.)),reflet=vec3(0.);
    for(int i=0;i<12;i++){
      if(i>=uPdrLumieres)break;
      vec3 versLumiere=uPdrLumierePosition[i]-monde;
      float d=length(versLumiere);
      vec3 l=versLumiere/max(d,.001);
      float attenuation=(i<2?.27:.13)/(1.+d*d*.26);
      if(uPdrLumierePortee[i]>0.)attenuation*=1.-smoothstep(uPdrLumierePortee[i]*.35,uPdrLumierePortee[i],d);
      if(uPdrLumiereCone[i].x>0.)attenuation*=smoothstep(uPdrLumiereCone[i].x,uPdrLumiereCone[i].y,dot(-l,uPdrLumiereDirection[i]));
      lumiere+=uPdrLumiereCouleur[i]*attenuation*(max(dot(n,l),0.)+.035);
      reflet+=uPdrLumiereCouleur[i]*attenuation*pdrReflet(n,vue,l,rugosite,f0)*2.4;
    }
    lumiere+=uPdrCouleurSoleil*max(dot(n,uPdrSoleil),0.)*ombre;
    reflet+=uPdrCouleurSoleil*ombre*pdrReflet(n,vue,uPdrSoleil,rugosite,f0);
    vec3 couleur=base*lumiere+reflet;
    vec3 r=reflect(-vue,n),ciel=mix(uPdrCielBas,uPdrCielHaut,smoothstep(0.,1.,r.y));
    vec3 milieu=mix(mix(uPdrAmbiance*.20,ciel,smoothstep(-.16,.18,r.y)),uPdrAmbiance*.85,rugosite*rugosite*.8);
    float rasant=pow(1.-max(dot(n,vue),0.),5.);
    couleur+=milieu*(f0+(max(vec3(1.-rugosite),f0)-f0)*rasant)*(.18+1.3*(1.-rugosite)*(1.-rugosite))*(.5+metal*2.5);
    return couleur+base*emission*(.94+.06*sin(uPdrEnvironnement.z*2.2+monde.y*3.))*1.55;
  }
  /** Brouillard, tonemap, gamma et vignettage du monde : la sortie est celle de la cible de scène (RGBA8, avant le halo). */
  vec3 pdrFinir(vec3 couleur,vec3 monde){
    float brume=1.-exp(-length(uPdrOeil-monde)*uPdrEnvironnement.y);
    couleur=mix(couleur,uPdrBrouillard,min(brume,.86));
    couleur=pow(max(couleur/(couleur+vec3(.76)),vec3(0.)),vec3(.4545));
    vec2 ecran=gl_FragCoord.xy/uPdrResolution;
    return couleur*mix(.59,1.,pow(max(0.,16.*ecran.x*ecran.y*(1.-ecran.x)*(1.-ecran.y)),.13));
  }`;
  // Les valeurs que le shader du monde prend sans atmosphère (setWorld sans environnement).
  const PDR_INDOOR=Object.freeze({sunDirection:[.4,.8,.3],sunColor:[0,0,0],ambient:[.075,.10,.12],fog:[.009,.018,.024],fogDensity:.014,skyTop:[.05,.08,.10],skyBottom:[.16,.20,.22]});
  // Uniformes de la bibliothèque, dans l'ordre où renderer.pdr.lier les pose. uPdrEnvironnement : x dehors (toujours 1),
  // y densité du brouillard, z temps (s), w inutilisé.
  const PDR_UNIFORMS=['uPdrOmbre','uPdrMatriceOmbre','uPdrOmbreReglages','uPdrOeil','uPdrSoleil','uPdrCouleurSoleil','uPdrAmbiance',
    'uPdrBrouillard','uPdrCielHaut','uPdrCielBas','uPdrEnvironnement','uPdrResolution','uPdrLumierePosition','uPdrLumiereCouleur',
    'uPdrLumierePortee','uPdrLumiereDirection','uPdrLumiereCone','uPdrLumieres'];

  // A closed, asymmetric crown shared with collision raycasts. Its canonical
  // 72 triangles are smaller than the old GPU sphere and remain identical in
  // every quality mode: a visual hollow never turns into a hidden solid box.
  const FOLIAGE=(()=>{
    const points=[[.018,.5,-.012]],faces=[],sides=12;
    for(let j=1;j<4;j++)for(let i=0;i<sides;i++){
      const u=i*Math.PI*2/sides,v=j*Math.PI/4;
      const radius=.5*Math.pow(Math.sin(v),.88)*(.79+.16*Math.cos(u*3)+.055*Math.sin(u*5+.7));
      const angle=u+.045*Math.sin(u*2+1);
      // Parallel, irregular rings keep the connecting quadrilaterals planar.
      // Canvas can merge each triangle pair without changing a single pixel
      // of silhouette or the canonical geometry used by rays and GPU shadows.
      points.push([Math.cos(angle)*radius+.024*Math.cos(v),.5*Math.cos(v),Math.sin(angle)*radius-.018*Math.cos(v)]);
    }
    points.push([-.025,-.5,.015]);
    // Keep exactly the existing p/s/r envelope, without widening the trunk's
    // physical footprint or the spatial index bounds of a replaced canopy.
    for(let axis=0;axis<3;axis++){
      const lo=Math.min(...points.map(p=>p[axis])),hi=Math.max(...points.map(p=>p[axis]));
      for(const p of points)p[axis]=(p[axis]-lo)/(hi-lo)-.5;
    }
    const ring=(j,i)=>1+j*sides+(i+sides)%sides;
    for(let i=0;i<sides;i++){
      faces.push([0,ring(0,i+1),ring(0,i)]);
      for(let j=0;j<2;j++)faces.push([ring(j,i),ring(j,i+1),ring(j+1,i+1)],[ring(j,i),ring(j+1,i+1),ring(j+1,i)]);
      faces.push([points.length-1,ring(2,i),ring(2,i+1)]);
    }
    const normals=points.map(()=>[0,0,0]);
    for(const face of faces){
      const [a,b,c]=face.map(i=>points[i]),ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]);
      let n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      if(n.reduce((sum,v,k)=>sum+v*(a[k]+b[k]+c[k]),0)<0){[face[1],face[2]]=[face[2],face[1]];n=n.map(v=>-v);}
      for(const i of face)for(let k=0;k<3;k++)normals[i][k]+=n[k];
    }
    for(const n of normals){const length=Math.hypot(...n)||1;for(let k=0;k<3;k++)n[k]/=length;Object.freeze(n);}
    points.forEach(Object.freeze);faces.forEach(Object.freeze);
    const triangles=Object.freeze(faces.map(face=>Object.freeze(face.map(i=>points[i]))));
    return Object.freeze({points:Object.freeze(points),faces:Object.freeze(faces),normals:Object.freeze(normals),triangles});
  })();
  function foliageTriangles(){return FOLIAGE.triangles;}
  const names = ['box','sphere','cylinder','octa','ring','bevel','foliage','wedge']; // BITUME : 'wedge'
  const shapeIndices=new Map(names.map((name,i)=>[name,i]));
  // BITUME : formes libres (carènes, mains). Une forme libre est une liste de triangles [p0, p1, p2, n0, n1, n2] tenue
  // dans le cube unité (−0,5 à 0,5) ; l'instance porte sa vraie taille dans s. Les normales sont celles du cube : le
  // nuanceur les divise par s, ce qui rend la normale du volume à sa vraie taille. Enregistrer avant FRender.create.
  const FORMES_LIBRES=new Map();
  function forme(nom,triangles){
    if(typeof nom!=='string'||!Array.isArray(triangles))throw new TypeError('forme(nom, triangles)');
    if(!FORMES_LIBRES.has(nom)&&shapeIndices.has(nom))throw new Error('forme déjà définie par le moteur : '+nom);
    if(!shapeIndices.has(nom)){shapeIndices.set(nom,names.length);names.push(nom);}
    FORMES_LIBRES.set(nom,triangles);
  }
  const INDEX_OCTETS=4; // BITUME : index sur 32 bits, les formes libres dépassent les 65 536 sommets
  function geometry(low) {
    const data=[], indices=[], ranges={};
    function vertex(p,n) {const i=data.length/6;data.push(...p,...n);return i;}
    function triangle(p0,p1,p2,n0,n1,n2) {
      const a=[p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]],b=[p2[0]-p0[0],p2[1]-p0[1],p2[2]-p0[2]];
      const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const len=Math.hypot(...cross)||1;
      n0=n0||cross.map(v=>v/len);n1=n1||n0;n2=n2||n0;
      if(cross[0]*n0[0]+cross[1]*n0[1]+cross[2]*n0[2]<0) {const t=p1;p1=p2;p2=t;const n=n1;n1=n2;n2=n;}
      indices.push(vertex(p0,n0),vertex(p1,n1),vertex(p2,n2));
    }
    function begin(name){ranges[name]={offset:indices.length*INDEX_OCTETS,count:0};}
    function end(name){ranges[name].count=indices.length-ranges[name].offset/INDEX_OCTETS;}
    begin('box');
    for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) {
      const n=[0,0,0];n[axis]=sign;
      const a=(axis+1)%3,b=(axis+2)%3;
      const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>{const p=[0,0,0];p[axis]=sign*.5;p[a]=q[0]*.5;p[b]=q[1]*.5;return p;});
      triangle(points[0],points[1],points[2],n);triangle(points[0],points[2],points[3],n);
    }
    end('box');
    begin('sphere');
    const sphere=(u,v)=>[Math.sin(v)*Math.cos(u)*.5,Math.cos(v)*.5,Math.sin(v)*Math.sin(u)*.5];
    const longitude=low===2?6:low?8:16,latitude=low===2?4:low?6:10;
    for(let j=0;j<latitude;j++) for(let i=0;i<longitude;i++) {
      const p=[sphere(i*Math.PI*2/longitude,j*Math.PI/latitude),sphere((i+1)*Math.PI*2/longitude,j*Math.PI/latitude),sphere((i+1)*Math.PI*2/longitude,(j+1)*Math.PI/latitude),sphere(i*Math.PI*2/longitude,(j+1)*Math.PI/latitude)];
      if(j>0) triangle(p[0],p[1],p[2],p[0].map(v=>v*2),p[1].map(v=>v*2),p[2].map(v=>v*2));
      if(j<latitude-1) triangle(p[0],p[2],p[3],p[0].map(v=>v*2),p[2].map(v=>v*2),p[3].map(v=>v*2));
    }
    end('sphere');
    begin('foliage');
    for(const [a,b,c] of FOLIAGE.faces)triangle(FOLIAGE.points[a],FOLIAGE.points[b],FOLIAGE.points[c],FOLIAGE.normals[a],FOLIAGE.normals[b],FOLIAGE.normals[c]);
    end('foliage');
    begin('cylinder');
    const cylinderSides=low===2?6:low?8:16;
    for(let i=0;i<cylinderSides;i++) {
      const a=i*Math.PI*2/cylinderSides,b=(i+1)*Math.PI*2/cylinderSides;
      const na=[Math.cos(a),0,Math.sin(a)],nb=[Math.cos(b),0,Math.sin(b)];
      const p0=[na[0]*.5,-.5,na[2]*.5],p1=[nb[0]*.5,-.5,nb[2]*.5],p2=[nb[0]*.5,.5,nb[2]*.5],p3=[na[0]*.5,.5,na[2]*.5];
      triangle(p0,p1,p2,na,nb,nb);triangle(p0,p2,p3,na,nb,na);
      triangle([0,-.5,0],p1,p0,[0,-1,0]);triangle([0,.5,0],p3,p2,[0,1,0]);
    }
    end('cylinder');
    begin('octa');
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2,b=(i+1)*Math.PI/2;
      const p0=[Math.cos(a)*.5,0,Math.sin(a)*.5],p1=[Math.cos(b)*.5,0,Math.sin(b)*.5];
      triangle([0,.5,0],p1,p0);triangle([0,-.5,0],p0,p1);
    }
    end('octa');
    begin('ring');
    const torus=(u,v)=>[(.435+.065*Math.cos(v))*Math.cos(u),.065*Math.sin(v),(.435+.065*Math.cos(v))*Math.sin(u)];
    const torusNormal=(u,v)=>[Math.cos(v)*Math.cos(u),Math.sin(v),Math.cos(v)*Math.sin(u)];
    const ringSides=low===2?8:low?12:24,ringTube=low?4:6;
    for(let i=0;i<ringSides;i++) for(let j=0;j<ringTube;j++) {
      const a=i*Math.PI*2/ringSides,b=(i+1)*Math.PI*2/ringSides,c=j*Math.PI*2/ringTube,d=(j+1)*Math.PI*2/ringTube;
      const p=[torus(a,c),torus(b,c),torus(b,d),torus(a,d)],n=[torusNormal(a,c),torusNormal(b,c),torusNormal(b,d),torusNormal(a,d)];
      triangle(p[0],p[1],p[2],n[0],n[1],n[2]);triangle(p[0],p[2],p[3],n[0],n[2],n[3]);
    }
    end('ring');
    // Close armour and weapon plates catch light on real, flat chamfers. The
    // coarse Canvas primitive uses the existing box; silhouettes retain scale.
    if(low===2)ranges.bevel=ranges.box;
    else{
      begin('bevel');const inner=.42,outer=.5;
      for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
        const n=[0,0,0];n[axis]=sign;const a=(axis+1)%3,b=(axis+2)%3;
        const p=[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>{const v=[0,0,0];v[axis]=sign*outer;v[a]=q[0]*inner;v[b]=q[1]*inner;return v;});
        triangle(p[0],p[1],p[2],n);triangle(p[0],p[2],p[3],n);
      }
      for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)for(const sa of [-1,1])for(const sb of [-1,1]){
        const c=3-a-b,n=[0,0,0];n[a]=sa/Math.SQRT2;n[b]=sb/Math.SQRT2;
        const p=[[outer,inner,-inner],[inner,outer,-inner],[inner,outer,inner],[outer,inner,inner]].map(q=>{const v=[0,0,0];v[a]=q[0]*sa;v[b]=q[1]*sb;v[c]=q[2];return v;});
        triangle(p[0],p[1],p[2],n);triangle(p[0],p[2],p[3],n);
      }
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
        const n=[x,y,z].map(v=>v/Math.sqrt(3));
        triangle([x*outer,y*inner,z*inner],[x*inner,y*outer,z*inner],[x*inner,y*inner,z*outer],n);
      }
      end('bevel');
    }
    // BITUME : coin (prisme droit à base triangulaire) pour les nez, pontons et capots en pente des monoplaces.
    // Dessous en y=-.5, dos en x=-.5 sur toute la hauteur, pente du haut du dos (x=-.5, y=.5) au bas de l'avant.
    begin('wedge');
    {
      const A=[-.5,-.5,-.5],B=[.5,-.5,-.5],C=[.5,-.5,.5],D=[-.5,-.5,.5],E=[-.5,.5,-.5],F=[-.5,.5,.5],n=[Math.SQRT1_2,Math.SQRT1_2,0];
      triangle(A,B,C,[0,-1,0]);triangle(A,C,D,[0,-1,0]);
      triangle(A,E,F,[-1,0,0]);triangle(A,F,D,[-1,0,0]);
      triangle(B,E,F,n);triangle(B,F,C,n);
      triangle(A,B,E,[0,0,-1]);triangle(D,F,C,[0,0,1]);
    }
    end('wedge');
    // BITUME : formes libres, mêmes triangles aux trois niveaux de détail
    for(const [nom,triangles] of FORMES_LIBRES){
      begin(nom);
      // BITUME : ordre du registre, déjà juste en vraie grandeur ; triangle() réorienterait à tort dans le cube
      // (l'échelle de normaliser() ne conserve pas les angles : 90 faces fines étaient retournées puis éliminées par CULL_FACE)
      for(const t of triangles)indices.push(vertex(t[0],t[3]),vertex(t[1],t[4]),vertex(t[2],t[5]));
      end(nom);
    }
    // BITUME : index sur 32 bits (retouche 10, UNSIGNED_INT) — les formes libres dépassent 65 535 sommets
    return {vertices:new Float32Array(data),indices:new Uint32Array(indices),ranges};
  }

  // The host ABI stays at 13 floats. A single translated or wind/sea-driven vertex
  // keeps the entire section on the ordinary path, including every triangle boundary.
  function rigidTerrainVertices(vertices){
    if(vertices.length%13)return false;
    for(let i=0;i<vertices.length;i+=13){
      if(vertices[i+6]!==0||vertices[i+7]!==0||vertices[i+8]!==0)return false;
      const material=Math.fround(vertices[i+9]);
      if((material>10.5&&material<12.5)||(material>26.5&&material<27.5))return false;
    }
    return true;
  }
  function writeRigidTerrain(target,at,source){
    for(let i=0;i<source.length;i+=13){
      for(let j=0;j<6;j++)target[at++]=source[i+j];
      for(let j=9;j<13;j++)target[at++]=source[i+j];
    }
  }

  // Opaque cockpit geometry can be outside the colour view and still cast a shadow.
  // Read the actual registered vertices, including off-centre shapes and edits by updateShape.
  function rigidOverlayView(source){
    const bounds=new Map(),pending=new Map(),shown=[],hidden=[];
    function halfExtents(name,budget){
      let bound=bounds.get(name);
      if(bound)return bound;
      const range=source.ranges[name];
      if(!range)return null;
      const end=range.offset/4+range.count,part=pending.get(name);
      const first=part?part.next:range.offset/4,stop=budget?Math.min(end,first+budget.vertices):end;
      if(budget&&stop===first&&stop<end)return null;
      let x=part?part.x:0,y=part?part.y:0,z=part?part.z:0;
      for(let i=first;i<stop;i++){
        const at=source.indices[i]*6,v=source.vertices;
        x=Math.max(x,Math.abs(v[at]));y=Math.max(y,Math.abs(v[at+1]));z=Math.max(z,Math.abs(v[at+2]));
      }
      if(budget)budget.vertices-=stop-first;
      if(stop<end){
        const next=part||{};next.next=stop;next.x=x;next.y=y;next.z=z;
        if(!part)pending.set(name,next);
        return null;
      }
      if(part)pending.delete(name);
      bound=[x,y,z];bounds.set(name,bound);return bound;
    }
    function select(meshes,eye,axes,h,v,radii,warming){
      const fw=axes.forward,right=axes.right,up=axes.up;
      const pad=.002+.000002*(1+Math.abs(eye[0])+Math.abs(eye[1])+Math.abs(eye[2]));
      let count=0,rejected=0;
      for(const mesh of meshes){
        // Water, grass and foliage can leave the rigid bounds in the vertex program.
        const m=mesh.mat||0,b=halfExtents(mesh.shape||'box'),p=mesh.p,scale=mesh.s;
        let outside=false;
        if(!warming&&b&&p&&scale&&!mesh.groundCover&&!mesh.windResponsive&&!(m>10.5&&m<12.5)&&!(m>26.5&&m<27.5)){
          const sx=b[0]*scale[0],sy=b[1]*scale[1],sz=b[2]*scale[2];
          const dx=p[0]-eye[0],dy=p[1]-eye[1],dz=p[2]-eye[2],depth=dx*fw[0]+dy*fw[1]+dz*fw[2];
          const radius=Math.sqrt(sx*sx+sy*sy+sz*sz)*1.00001+pad;
          // The overlay can have a near plane as close as 5 mm. Only the side planes are needed.
          outside=Math.abs(dx*right[0]+dy*right[1]+dz*right[2])>depth*h+radius*radii.horizontal||
                  Math.abs(dx*up[0]+dy*up[1]+dz*up[2])>depth*v+radius*radii.vertical;
        }
        if(outside)hidden[rejected++]=mesh;
        else shown[count++]=mesh;
      }
      shown.length=count;hidden.length=rejected;
      return shown;
    }
    return {select,hidden,halfExtents,invalidate(name){bounds.delete(name);pending.delete(name);}};
  }

  // Reuse only bit-identical primitive vertices. Keep expanded vertex storage,
  // triangle order and public geometry snapshots intact: updateShape() can
  // restore a primitive's original index range before editing any occurrence.
  // Keep the editable vertex stream expanded. A bounded direct-mapped cache
  // finds recent equal rows without allocating a string or a record per vertex.
  function indexRegisteredShapes(source, indices, words, byName){
    const slots=new Int32Array(1024),last=new Int32Array(1024);
    const stats={shapes:0,references:0,reused:0};
    for(const name of FORMES_LIBRES.keys()){
      const range=source.ranges[name];if(!range?.count)continue;
      const first=range.offset/INDEX_OCTETS,end=first+range.count;
      let reused=0;
      for(let i=first;i<end;i++){
        const vertex=source.indices[i],at=vertex*6;
        let hash=words[at];
        for(let k=1;k<6;k++)hash=Math.imul(hash^words[at+k],0x01000193);
        hash=Math.imul(hash^(hash>>>16),0x85ebca6b);
        const slot=(hash^(hash>>>13))&1023,prior=slots[slot],p=prior*6;
        // last stores i+1. A previous shape can never provide a reference.
        if(last[slot]>first && i-last[slot]<128 &&
          words[p]===words[at] && words[p+1]===words[at+1] && words[p+2]===words[at+2] &&
          words[p+3]===words[at+3] && words[p+4]===words[at+4] && words[p+5]===words[at+5]){
          indices[i]=prior;reused++;
        }else slots[slot]=vertex;
        last[slot]=i+1;
      }
      if(reused){
        byName.set(name,{offset:range.offset,indices:source.indices.subarray(first,end),active:true});
        stats.shapes++;stats.reused+=reused;
      }
      stats.references+=range.count;
    }
    return stats;
  }

  function indexPrimitiveVertices(source,registered=false){
    const indices=new Uint32Array(source.indices),words=new Uint32Array(source.vertices.buffer,source.vertices.byteOffset,source.vertices.length),ranges=new Map(),byName=new Map();
    const stats={shapes:0,references:0,vertices:0,restored:0};
    for(const name of ['box','sphere','foliage','cylinder','octa','ring','bevel','wedge']){
      const range=source.ranges[name];if(!range||FORMES_LIBRES.has(name))continue;
      const key=range.offset+':'+range.count;let record=ranges.get(key);
      if(record){byName.set(name,record);continue;}
      const first=range.offset/INDEX_OCTETS,original=source.indices.slice(first,first+range.count),seen=new Map();let changed=false;
      for(let i=0;i<original.length;i++){
        const vertex=original[i],at=vertex*6,key=words[at]+','+words[at+1]+','+words[at+2]+','+words[at+3]+','+words[at+4]+','+words[at+5];
        let prior=seen.get(key);if(prior===undefined){prior=vertex;seen.set(key,vertex);}indices[first+i]=prior;if(prior!==vertex)changed=true;
      }
      record={offset:range.offset,indices:original,active:changed};ranges.set(key,record);byName.set(name,record);
      stats.shapes+=changed?1:0;stats.references+=original.length;stats.vertices+=seen.size;
    }
    if(registered)stats.registered=indexRegisteredShapes(source,indices,words,byName);
    return {indices,stats,restore(name){const record=byName.get(name);if(!record?.active)return null;record.active=false;indices.set(record.indices,record.offset/INDEX_OCTETS);stats.restored++;return record;}};
  }

  // Immutable index subsets remove only ranks whose existing shader coverage
  // is already zero. Preserve the order and all six attributes of every kept
  // vertex; the ordinary index ranges and mutable vertex storage stay intact.
  function groundCoverGeometry(source,baseIndices=source.indices){
    const records=new Map(),pending=[];let additional=0;
    for(const name of FORMES_LIBRES.keys()){
      const shape=source.ranges[name];if(!shape?.count)continue;
      const first=shape.offset/INDEX_OCTETS,ranks=new Uint8Array(shape.count/3),counts=new Uint32Array(8);let valid=true,mask=0;
      for(let t=0;t<ranks.length&&valid;t++){
        let cx=0,cz=0;
        for(let j=0;j<3;j++){
          const at=source.indices[first+t*3+j]*6,x=Math.floor(Math.fround(source.vertices[at]+.5)*32),z=Math.floor(Math.fround(source.vertices[at+2]+.5)*32);
          if(x<0||x>=32||z<0||z>=32||!Number.isFinite(x)||!Number.isFinite(z)||j&&(x!==cx||z!==cz)){valid=false;break;}cx=x;cz=z;
        }
        if(valid){const rank=((cx*13+cz*7)%8+8)%8;ranks[t]=rank;counts[rank]+=3;mask|=1<<rank;}
      }
      if(!valid)continue;
      const ranges=[];let count=0;
      for(let k=0;k<8;k++){count+=counts[k];ranges.push({count,offset:shape.offset});if(count&&count!==shape.count)additional+=count;}
      const record={name,active:true,mask,ranges};records.set(name,record);pending.push({shape,first,ranks,record});
    }
    const indices=additional?new Uint32Array(baseIndices.length+additional):baseIndices;
    if(additional)indices.set(baseIndices);let offset=baseIndices.length;
    for(const {shape,first,ranks,record} of pending)for(let k=0;k<8;k++){
      const range=record.ranges[k];if(!range.count||range.count===shape.count)continue;
      range.offset=offset*INDEX_OCTETS;
      for(let t=0;t<ranks.length;t++)if(ranks[t]<=k)for(let j=0;j<3;j++)indices[offset++]=baseIndices[first+t*3+j];
    }
    function rewriteSubsets(record,base,upload){
      const shape=source.ranges[record.name], first=shape.offset/INDEX_OCTETS;
      // The subset layout belongs to the original shape. Read the cells before
      // any mutable vertex is written. Inactive ranges have already been restored.
      for(let k=0;k<8;k++){
        const range=record.ranges[k];
        if(!range.count||range.count===shape.count)continue;
        let out=range.offset/INDEX_OCTETS;
        for(let i=first;i<first+shape.count;i+=3){
          const p=source.indices[i]*6,x=Math.floor(Math.fround(source.vertices[p]+.5)*32);
          const z=Math.floor(Math.fround(source.vertices[p+2]+.5)*32);
          if(((x*13+z*7)%8+8)%8<=k){indices[out++]=base[i];indices[out++]=base[i+1];indices[out++]=base[i+2];}
        }
        if(upload)upload(range.offset,indices.subarray(range.offset/INDEX_OCTETS,out));
      }
    }
    return {indices,records,stats:{shapes:records.size,indexBytes:indices.byteLength,additionalIndexBytes:additional*INDEX_OCTETS},
      select(base){
        if(!additional)return base;
        indices.set(base);
        for(const record of records.values())if(record.active)rewriteSubsets(record,base);
        return indices;
      },
      invalidate(name,restored,upload){
        const record=records.get(name);
        if(restored){
          if(indices!==baseIndices)indices.set(restored.indices,restored.offset/INDEX_OCTETS);
          if(upload)upload(restored.offset,restored.indices);
          if(record?.active)rewriteSubsets(record,source.indices,upload);
        }
        if(record)record.active=false;
      }};
  }

  // Pair only static, identical instance rows, with matching near/far groups.
  // Unrecognised custom lots retain the historical whole-lot path. One fixed
  // run buffer per lot replaces per-frame arrays, objects and instance uploads.
  function groundCoverPlan(lot,near,far,index){
    if(lot.groundCover!==true||!near?.values.length||!far||near.values.length!==far.values.length||near.groups.length!==far.groups.length)return null;
    const a=new Uint32Array(near.values.buffer,near.values.byteOffset,near.values.length),b=new Uint32Array(far.values.buffer,far.values.byteOffset,far.values.length);
    for(let i=0;i<a.length;i++)if(a[i]!==b[i])return null;
    const groups=[];
    for(let i=0;i<near.groups.length;i++){
      const n=near.groups[i],f=far.groups[i],nr=index.records.get(n.name),fr=index.records.get(f.name);
      if(n.count!==f.count||n.offset!==f.offset||!nr?.active||!fr?.active)return null;
      groups.push({near:n,far:f,nearIndex:nr,farIndex:fr});
    }
    const length=near.values.length/16,points=new Float32Array(length*3),runs=new Uint32Array(length*4);
    for(let i=0;i<length;i++){
      const at=i*16,p=i*3,v=near.values,flags=v[at+11];if((flags&16)===0)return null;
      points[p]=v[at];points[p+1]=v[at+1];points[p+2]=v[at+2];
      if(!Number.isFinite(points[p]+points[p+1]+points[p+2]))return null;
    }
    return {groups,points,runs,length,count:0,frame:-1,tested:0,valid:true,supported:true};
  }
  function prepareGroundCover(plan,entry,viewFrame,eye,cover){
    if(!plan.valid)return false;
    if(plan.frame===viewFrame)return plan.supported;
    plan.frame=viewFrame;plan.count=plan.tested=0;plan.supported=true;
    for(const group of plan.groups)if(!group.nearIndex.active||!group.farIndex.active){plan.valid=false;return false;}
    const density=cover.density,start=density[0],end=density[1],keep=density[2]*8,range=cover.range[1],fading=end>start&&keep<8;
    const run=plan.runs,points=plan.points,min=entry.distance,max=min+2*entry.bounds.radius;
    const allNear=fading&&max<start&&(range<=0||max<range),allFar=!entry.near&&(range<=0||max<range-.02);
    for(let g=0;g<plan.groups.length;g++){
      const group=plan.groups[g],first=group.near.offset/64,last=first+group.near.count;
      // The far subset must contain every requested retained rank.
      const canFar=group.farIndex.mask===(1<<keep)-1;
      if(!canFar){plan.supported=false;return false;}
      if(allNear||allFar&&canFar){const at=plan.count++*4;run[at]=g;run[at+1]=allNear?8:0;run[at+2]=first;run[at+3]=last-first;continue;}
      let previous=-2,begin=first;
      for(let i=first;i<last;i+=4){
        let mode=-1;
        // Four adjacent rows share the most detailed required subset. This
        // bounds draw-call fragmentation without ever removing a live rank.
        for(let j=i,stop=Math.min(last,i+4);j<stop;j++){
          const p=j*3,dx=points[p]-eye[0],dy=points[p+1]-eye[1],dz=points[p+2]-eye[2],distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
          const margin=.01+distance*.000001,conservative=distance-margin;let required=8;plan.tested++;
          if(range>0&&conservative>=range)required=-1;
          // Keep the exact existing near/far decision: only invisible work is
          // omitted, with no change to curvature, shading or LOD transitions.
          else if(canFar&&!entry.near)required=0;
          else if(fading&&conservative>start){
            const t=Math.max(0,Math.min(1,(conservative-start)/(end-start))),progress=t*t*(3-2*t);
            required=progress>=1?keep:Math.min(8,Math.ceil(8-progress*(8-keep)+.00001));
            if(required>keep)required=required<=4?4:8;
          }
          if(required>mode)mode=required;
        }
        if(mode!==previous){
          if(previous>=0){const at=plan.count++*4;run[at]=g;run[at+1]=previous;run[at+2]=begin;run[at+3]=i-begin;}
          previous=mode;begin=i;
        }
      }
      if(previous>=0){const at=plan.count++*4;run[at]=g;run[at+1]=previous;run[at+2]=begin;run[at+3]=last-begin;}
    }
    return true;
  }

  function environmentInfo(value){
    if(!value)return null;
    const color=(v,fallback)=>Array.isArray(v)&&v.length>=3?v.slice(0,3).map((x,i)=>Number.isFinite(x)?Math.max(0,x):fallback[i]):fallback;
    // A direction can contain negative horizontal coordinates; colours cannot.
    const sun=Array.isArray(value.sunDirection)&&value.sunDirection.length>=3?value.sunDirection.slice(0,3).map((x,i)=>Number.isFinite(x)?x:[.4,.8,.3][i]):[.4,.8,.3];
    sun[1]=Math.max(.12,sun[1]);const sunLength=Math.hypot(...sun)||1;
    return {...value,skyTop:color(value.skyTop,[.22,.39,.51]),skyBottom:color(value.skyBottom,[.65,.72,.66]),fog:color(value.fog,[.35,.43,.42]),sunDirection:sun.map(x=>x/sunLength),sunColor:color(value.sunColor,[1,.86,.62]),ambient:color(value.ambient,[.24,.29,.27]),wind:Number.isFinite(value.wind)?Math.max(0,Math.min(2,value.wind)):.6,night:Number.isFinite(value.night)?Math.max(0,Math.min(1,value.night)):0,fogDensity:Number.isFinite(value.fogDensity)?Math.max(.0001,value.fogDensity):.011,outdoorZones:value.outdoorZones||[]};
  }
  function outdoorAt(p,environment){
    return !!environment&&environment.outdoorZones.some(zone=>Math.abs(p[0]-zone.x)<=zone.w*.5+.08&&Math.abs(p[2]-zone.z)<=zone.d*.5+.08);
  }
  function transientLights(value,eye,limit){
    if(!Array.isArray(value))return [];
    const valid=[];
    for(const source of value.slice(0,16)){
      if(!source||!Array.isArray(source.p)||source.p.length!==3||!source.p.every(Number.isFinite)||!Number.isFinite(source.power)||source.power<0||!Number.isFinite(source.range)||source.range<=0)continue;
      // A flashing emitter may reserve its rank using a nominal peak power.
      // Its actual emitted power still reaches the shader unchanged (including
      // zero), so a beacon cannot switch unrelated steady lamps on and off.
      const selectionPower=Number.isFinite(source.selectionPower)&&source.selectionPower>0?Math.min(64,source.selectionPower):0;
      if(source.power===0&&!selectionPower)continue;
      const range=Math.min(48,source.range),power=Math.min(64,source.power),p=source.p;
      const distance=(p[0]-eye[0])**2+(p[1]-eye[1])**2+(p[2]-eye[2])**2;
      if(distance>(180+range)**2)continue;
      const color=Array.isArray(source.color)&&source.color.length===3?source.color.map(v=>Number.isFinite(v)?Math.max(0,Math.min(3,v)):0):[1,.42,.09];
      if(!color.some(v=>v>0))continue;
      valid.push({p,color,power,range,dir:source.dir,cone:source.cone,score:Math.max(power,selectionPower)/(1+distance*.1)});
    }
    return valid.sort((a,b)=>b.score-a.score).slice(0,limit);
  }
  function outdoorMesh(mesh,environment){
    return !!environment&&(mesh.outdoor===undefined?(materialFamily(mesh.mat||0)>=8||outdoorAt(mesh.p||[0,0,0],environment)):!!mesh.outdoor);
  }
  function surfaceFlags(mesh,environment,objects=false){
    const object=mesh.overlay||mesh.surface==='object'||objects&&mesh.surface!=='architecture';
    return (mesh.overlay?1:0)+(outdoorMesh(mesh,environment)?2:0)+(object?4:0)+(mesh.windResponsive===true?8:0)+(mesh.groundCover===true?16:0);
  }
  // Effects only: bits 7-14 carry the fog reduction (mesh.fog, weight 1 by default leaves the flags unchanged), bit 15
  // the sun lighting of a bulged implicit sphere (mesh.lit, WebGPU). Both stay above the bits read by VERT.
  function effectFlags(mesh,environment){
    const fog=Number.isFinite(mesh.fog)?Math.max(0,Math.min(1,mesh.fog)):1;
    return surfaceFlags(mesh,environment,true)+128*Math.round((1-fog)*255)+(mesh.lit===true?32768:0);
  }
  function instanceDataW(mesh){return mesh.groundCover===true?(Number.isFinite(mesh.groundShear)?mesh.groundShear:0):(mesh.emissive||0);}
  function opaqueOpacity(mesh){return Number.isFinite(mesh.opacity)?Math.max(0,Math.min(1,mesh.opacity)):1;}
  function opaqueColorMarker(mesh){const opacity=opaqueOpacity(mesh);return opacity===1?(mesh.color?1:0):mesh.color?2+opacity:-1-opacity;}
  function pack(meshes,environment,objects=false) {
    const grouped=names.map(()=>[]);
    for(const mesh of meshes||[]) {
      const i=shapeIndices.get(mesh.shape||'box');
      if(i!==undefined) grouped[i].push(mesh);
    }
    const count=grouped.reduce((n,g)=>n+g.length,0),values=new Float32Array(count*16),groups=[];
    let offset=0;
    for(let i=0;i<names.length;i++) {
      const list=grouped[i];
      if(list.length) groups.push({name:names[i],offset:offset*4,count:list.length});
      for(const mesh of list) {
        const p=mesh.p||[0,0,0],s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=mesh.color||[0,0,0];
        values[offset]=p[0];values[offset+1]=p[1];values[offset+2]=p[2];values[offset+3]=mesh.mat||0;values[offset+4]=s[0];values[offset+5]=s[1];values[offset+6]=s[2];values[offset+7]=instanceDataW(mesh);values[offset+8]=r[0];values[offset+9]=r[1];values[offset+10]=r[2];values[offset+11]=surfaceFlags(mesh,environment,objects);values[offset+12]=c[0];values[offset+13]=c[1];values[offset+14]=c[2];values[offset+15]=opaqueColorMarker(mesh);
        offset+=16;
      }
    }
    return {values,groups};
  }
  // A renderer owns each workspace. Returned batches remain valid until its
  // next call; the public pack() above still returns independent storage.
  // batch.storage et batch.length (en flottants) servent le téléversement WebGL sans sous-vue ;
  // batch.values reste une vue exacte, créée seulement quand un appelant la lit après un changement de taille.
  function instancePacker(){
    let counts=new Uint32Array(0),next=new Uint32Array(0),storage=new Float32Array(0),active=new Float32Array(0),required=0;
    const groups=[],records=[],zero=[0,0,0],one=[1,1,1];
    const batch={groups,storage,length:0,get values(){if(active.buffer!==storage.buffer||active.length!==required)active=storage.subarray(0,required);return active;}};
    return (meshes,environment,objects=false,origin=zero)=>{
      if(counts.length<names.length){counts=new Uint32Array(names.length);next=new Uint32Array(names.length);}
      else counts.fill(0);
      let total=0;for(const mesh of meshes||[]){const i=shapeIndices.get(mesh.shape||'box');if(i!==undefined){counts[i]++;total++;}}
      required=total*16;if(storage.length<required)storage=new Float32Array(Math.max(required,storage.length*2,256));
      batch.storage=storage;batch.length=required;groups.length=0;const out=storage;
      let offset=0;for(let i=0;i<names.length;i++){next[i]=offset;if(counts[i]){const group=records[i]||(records[i]={name:names[i],offset:0,count:0});group.offset=offset*4;group.count=counts[i];groups.push(group);offset+=counts[i]*16;}}
      for(const mesh of meshes||[]){const i=shapeIndices.get(mesh.shape||'box');if(i===undefined)continue;const at=next[i];next[i]+=16;
        const p=mesh.p||zero,s=mesh.s||one,r=mesh.r||zero,c=mesh.color||zero;
        out[at]=p[0]-origin[0];out[at+1]=p[1]-origin[1];out[at+2]=p[2]-origin[2];out[at+3]=mesh.mat||0;out[at+4]=s[0];out[at+5]=s[1];out[at+6]=s[2];out[at+7]=instanceDataW(mesh);out[at+8]=r[0];out[at+9]=r[1];out[at+10]=r[2];out[at+11]=surfaceFlags(mesh,environment,objects);out[at+12]=c[0];out[at+13]=c[1];out[at+14]=c[2];out[at+15]=opaqueColorMarker(mesh);
      }return batch;
    };
  }

  // FERRO 0.3.11 (ombresPhoto) : packer à deux listes. Dans chaque groupe de forme, les instances de `near` suivent
  // celles de `meshes` et group.near en garde le nombre : la passe couleur trace les groupes entiers (mêmes appels), la
  // passe du soleil leurs seules premières instances, la tuile de la voiture filmée les seules dernières. Aucune
  // allocation tant que la capacité suffit.
  function splitPacker(){
    let counts=new Uint32Array(0),nears=new Uint32Array(0),next=new Uint32Array(0),storage=new Float32Array(0),active=new Float32Array(0),required=0;
    const groups=[],records=[],zero=[0,0,0],one=[1,1,1];
    const batch={groups,storage,length:0,nearTotal:0,get values(){if(active.buffer!==storage.buffer||active.length!==required)active=storage.subarray(0,required);return active;}};
    const write=(mesh,environment,origin)=>{const i=shapeIndices.get(mesh.shape||'box');if(i===undefined)return;const at=next[i],out=storage;next[i]+=16;
      const p=mesh.p||zero,s=mesh.s||one,r=mesh.r||zero,c=mesh.color||zero;
      out[at]=p[0]-origin[0];out[at+1]=p[1]-origin[1];out[at+2]=p[2]-origin[2];out[at+3]=mesh.mat||0;out[at+4]=s[0];out[at+5]=s[1];out[at+6]=s[2];out[at+7]=instanceDataW(mesh);out[at+8]=r[0];out[at+9]=r[1];out[at+10]=r[2];out[at+11]=surfaceFlags(mesh,environment,true);out[at+12]=c[0];out[at+13]=c[1];out[at+14]=c[2];out[at+15]=opaqueColorMarker(mesh);};
    return (meshes,near,environment,origin=zero)=>{
      if(counts.length<names.length){counts=new Uint32Array(names.length);nears=new Uint32Array(names.length);next=new Uint32Array(names.length);}
      else{counts.fill(0);nears.fill(0);}
      let total=0,nearTotal=0;
      for(const mesh of meshes){const i=shapeIndices.get(mesh.shape||'box');if(i!==undefined){counts[i]++;total++;}}
      for(const mesh of near){const i=shapeIndices.get(mesh.shape||'box');if(i!==undefined){counts[i]++;nears[i]++;total++;nearTotal++;}}
      required=total*16;if(storage.length<required)storage=new Float32Array(Math.max(required,storage.length*2,256));
      batch.storage=storage;batch.length=required;batch.nearTotal=nearTotal;
      // Groupes écrits par indice (length=0 puis push rendrait leur stockage et en allouerait un neuf à chaque image).
      let offset=0,g=0;for(let i=0;i<names.length;i++){next[i]=offset;if(counts[i]){const group=records[i]||(records[i]={name:names[i],offset:0,count:0,near:0});group.offset=offset*4;group.count=counts[i];group.near=nears[i];groups[g++]=group;offset+=counts[i]*16;}}
      groups.length=g;
      for(const mesh of meshes)write(mesh,environment,origin);
      for(const mesh of near)write(mesh,environment,origin);
      return batch;
    };
  }
  function packEffects(meshes,environment,eye){
    const distance=m=>(m.p[0]-eye[0])**2+(m.p[1]-eye[1])**2+(m.p[2]-eye[2])**2;
    const list=meshes.filter(m=>shapeIndices.has(m.shape||'sphere')&&m.alpha>.003).sort((a,b)=>distance(b)-distance(a));
    const values=new Float32Array(list.length*16),groups=[];let offset=0;
    for(const mesh of list){
      const name=mesh.shape||'sphere',last=groups[groups.length-1];
      if(last&&last.name===name)last.count++;else groups.push({name,offset:offset*4,count:1});
      const p=mesh.p,s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=mesh.color||[.5,.5,.5];
      const material=mesh.window?18:mesh.shape==='ring'&&Number.isFinite(mesh.innerRatio)?20+Math.min(.999,Math.max(0,mesh.innerRatio)):mesh.fxPriority==='hazard'?16:mesh.fxFire?14:mesh.fxSmoke?15:mesh.fxSpark?17:7;
      values[offset]=p[0];values[offset+1]=p[1];values[offset+2]=p[2];values[offset+3]=material;values[offset+4]=s[0];values[offset+5]=s[1];values[offset+6]=s[2];values[offset+7]=mesh.emissive||0;values[offset+8]=r[0];values[offset+9]=r[1];values[offset+10]=r[2];values[offset+11]=effectFlags(mesh,environment);values[offset+12]=c[0];values[offset+13]=c[1];values[offset+14]=c[2];values[offset+15]=Math.min(1,Math.max(0,mesh.alpha));offset+=16;
    }
    return {values,groups};
  }
  function effectsPacker(){
    const order=[],records=[],groups=[],groupRecords=[],zero=[0,0,0],one=[1,1,1],gray=[.5,.5,.5];
    let storage=new Float32Array(0),active=new Float32Array(0),previous=0,required=0;
    const batch={groups,storage,length:0,get values(){if(active.buffer!==storage.buffer||active.length!==required)active=storage.subarray(0,required);return active;}};
    return (meshes,environment,eye,origin=zero)=>{
      order.length=0;let count=0;
      for(const mesh of meshes){if(!shapeIndices.has(mesh.shape||'sphere')||!(mesh.alpha>.003))continue;
        const record=records[count]||(records[count]={mesh:null,distance:0,index:0});record.mesh=mesh;record.distance=(mesh.p[0]-eye[0])**2+(mesh.p[1]-eye[1])**2+(mesh.p[2]-eye[2])**2;record.index=count++;order.push(record);
      }
      for(let i=count;i<previous;i++)records[i].mesh=null;previous=count;
      // The tie break preserves the input order of the original stable sort.
      order.sort((a,b)=>(b.distance-a.distance)||a.index-b.index);
      required=count*16;if(storage.length<required)storage=new Float32Array(Math.max(required,storage.length*2,256));
      batch.storage=storage;batch.length=required;groups.length=0;let offset=0;const out=storage;
      for(const record of order){const mesh=record.mesh,name=mesh.shape||'sphere',last=groups[groups.length-1];
        if(last&&last.name===name)last.count++;else{const group=groupRecords[groups.length]||(groupRecords[groups.length]={name:'',offset:0,count:0});group.name=name;group.offset=offset*4;group.count=1;groups.push(group);}
        const p=mesh.p,s=mesh.s||one,r=mesh.r||zero,c=mesh.color||gray,material=mesh.window?18:mesh.shape==='ring'&&Number.isFinite(mesh.innerRatio)?20+Math.min(.999,Math.max(0,mesh.innerRatio)):mesh.fxPriority==='hazard'?16:mesh.fxFire?14:mesh.fxSmoke?15:mesh.fxSpark?17:7;
        out[offset]=p[0]-origin[0];out[offset+1]=p[1]-origin[1];out[offset+2]=p[2]-origin[2];out[offset+3]=material;out[offset+4]=s[0];out[offset+5]=s[1];out[offset+6]=s[2];out[offset+7]=mesh.emissive||0;out[offset+8]=r[0];out[offset+9]=r[1];out[offset+10]=r[2];out[offset+11]=effectFlags(mesh,environment);out[offset+12]=c[0];out[offset+13]=c[1];out[offset+14]=c[2];out[offset+15]=Math.min(1,Math.max(0,mesh.alpha));offset+=16;
      }return batch;
    };
  }

  function multiply(a,b,out) {
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return out;
  }

  function cameraAxes(camera){
    const yaw=camera.yaw||0,pitch=camera.pitch||0,roll=camera.roll||0;
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
    const r=[cy,0,sy],u=[-sy*sp,cp,cy*sp];
    return {right:r.map((v,i)=>v*cr+u[i]*sr),up:u.map((v,i)=>v*cr-r[i]*sr),forward:[sy*cp,sp,-cy*cp]};
  }
  function detailRanges(quality,software=false){
    return software?(quality==='low'?[26,16,0]:quality==='high'?[42,30,12]:[34,23,8]):(quality==='low'?[48,20,0]:quality==='high'?[82,42,19]:[64,32,13]);
  }
  function extendedDistance(range,environment,eye){
    for(const zone of environment?.longViewZones||[]){
      const dx=Math.max(0,Math.abs(eye[0]-zone.x)-zone.w*.5),dz=Math.max(0,Math.abs(eye[2]-zone.z)-zone.d*.5),distance=Math.hypot(dx,dz);
      const t=Math.max(0,Math.min(1,(35-distance)/20)),blend=t*t*(3-2*t),target=Math.max(range,Math.min(140,Number(zone.range)||100));
      range=Math.max(range,range+(target-range)*blend);
    }
    return range;
  }
  function softwareDistance(quality,environment,eye){
    return extendedDistance(environment?(quality==='low'?30:quality==='high'?50:38):(quality==='low'?26:quality==='high'?42:34),environment,eye);
  }
  function horrorLights(director,lights){
    if(director?.eventType!=='blackout'||!(director.eventAge>=0&&director.eventAge<1.2))return null;
    const p=[director.eventX,director.eventY,director.eventZ];if(!p.every(Number.isFinite))return null;
    const age=director.eventAge,smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    const strength=.78*Math.max(0,Math.min(1,Number.isFinite(director.eventIntensity)?director.eventIntensity:1))*smooth(age/.08)*(1-smooth((age-.72)/.48));
    if(strength<.0001)return null;
    const local=lights.map(light=>({light,d:Math.hypot(...light.p.map((v,k)=>v-p[k]))})).filter(e=>e.d<10).sort((a,b)=>a.d-b.d).slice(0,3),plan=new Map();
    for(const {light,d} of local)plan.set(light,1-strength*(1-smooth((d-4)/6)));
    return plan.size?plan:null;
  }
  function resolutionGovernor(){
    let scale=1,mean=0,slow=0,fast=0,cooldown=1;
    return {
      reset(){scale=1;mean=slow=fast=0;cooldown=1;},
      update(fx,quality){
        if(quality!=='auto'||fx.adaptive!==true){mean=slow=fast=0;return scale;}
        const raw=Number(fx.frameMs);if(!(raw>0&&raw<500))return scale;
        // One loading spike cannot lower quality; sustained slow frames still count.
        const dt=Math.min(.25,raw/1000),sample=Math.min(150,raw);
        mean=mean?mean+(sample-mean)*(1-Math.exp(-dt/.65)):sample;
        cooldown=Math.max(0,cooldown-dt);
        if(cooldown>0){slow=fast=0;return scale;}
        slow=mean>25?slow+dt:0;fast=mean<18.5?fast+dt:0;
        if(slow>1.3&&scale>.65){scale=Math.max(.65,Math.round((scale-.1)*100)/100);cooldown=2;slow=fast=0;}
        else if(fast>5&&scale<1){scale=Math.min(1,Math.round((scale+.05)*100)/100);cooldown=2;slow=fast=0;}
        return scale;
      }
    };
  }
  function meshState(mesh,env){return [...(mesh.p||[0,0,0]),...(mesh.s||[1,1,1]),...(mesh.r||[0,0,0]),...(mesh.color||[0,0,0]),mesh.mat||0,instanceDataW(mesh),opaqueColorMarker(mesh),surfaceFlags(mesh,env),mesh.detail||0,mesh.shape||'box',mesh.ground,mesh.terrain,mesh.region];}
  function metadata(mesh){
    const scale=mesh.s||[1,1,1],height=Math.abs(scale[1]),localHeight=Math.min(height,2);
    const windMargin=mesh.windResponsive===true?2.3*localHeight:0,shear=mesh.groundCover===true&&Number.isFinite(mesh.groundShear)?Math.abs(mesh.groundShear):0;
    return {mesh,renderRevision:mesh.renderRevision||0,p:(mesh.p||[0,0,0]).slice(),radius:Math.hypot(Math.abs(scale[0])+shear,scale[1],scale[2])*.5+windMargin,detail:Math.max(0,Math.min(2,Math.floor(mesh.detail||0))),software:null,softwareCoarse:null};
  }
  function validatedMeshSplices(delta,before,after){
    if(!delta||delta.full||!Array.isArray(before)||!Array.isArray(after)||delta.before!==before||delta.after!==after||!Array.isArray(delta.splices))return null;
    let end=0,shift=0,changed=0;
    for(const q of delta.splices){
      if(!q||!Number.isInteger(q.start)||!Number.isInteger(q.deleteCount)||q.start<end||q.deleteCount<0||q.start+q.deleteCount>before.length||!Array.isArray(q.items))return null;
      for(let i=0;i<q.items.length;i++)if(!q.items[i]||typeof q.items[i]!=='object'||after[q.start+shift+i]!==q.items[i])return null;
      end=q.start+q.deleteCount;shift+=q.items.length-q.deleteCount;changed+=q.items.length+q.deleteCount;
    }
    return before.length+shift===after.length&&changed<=Math.max(64,after.length/4)?delta.splices:null;
  }
  function spliceReferences(before,splices,length){
    // Preserve snapshot arrays, but let the native array copier move retained
    // city ranges instead of visiting every object in JavaScript twice.
    const ranges=[];let read=0;
    for(const q of splices){if(read<q.start)ranges.push(before.slice(read,q.start));if(q.items.length)ranges.push(q.items[Symbol.isConcatSpreadable]===false?Array.from(q.items):q.items);read=q.start+q.deleteCount;}
    if(read<before.length)ranges.push(before.slice(read));
    if(ranges.length<4096)return [].concat(...ranges);
    const after=new Array(length);let write=0;for(const range of ranges)for(const item of range)after[write++]=item;return after;
  }
  function partitionWorld(meshes,previous,options){
    const source=meshes||[],splices=options?.revisionedMeshes===true&&previous?.dense&&validatedMeshSplices(options.meshDelta,previous.source,source);
    if(splices){
      const foreground=[],positions=previous.backgroundPositions;let bg=0,shift=0,valid=true;
      for(const q of splices){
        while(bg<positions.length&&positions[bg]<q.start)bg++;
        if((bg<positions.length&&positions[bg]<q.start+q.deleteCount)||q.items.some(m=>m.backgroundWater)){valid=false;break;}
        foreground.push({start:q.start-bg,deleteCount:q.deleteCount,items:q.items});shift+=q.items.length-q.deleteCount;
      }
      if(valid){
        const world=foreground.length?spliceReferences(previous.world,foreground,previous.world.length+shift):previous.world,backgroundPositions=[];let at=0,offset=0;
        for(const position of positions){while(at<splices.length&&splices[at].start<=position){offset+=splices[at].items.length-splices[at].deleteCount;at++;}backgroundPositions.push(position+offset);}
        return {source,world,background:previous.background,backgroundPositions,dense:true,meshDelta:{before:previous.world,after:world,full:false,splices:foreground}};
      }
    }
    const world=[],background=[],backgroundPositions=[];
    for(let i=0;i<source.length;i++){const mesh=source[i];if(mesh===undefined&&!(i in source))continue;if(mesh.backgroundWater){background.push(mesh);backgroundPositions.push(i);}else world.push(mesh);}
    return {source,world,background,backgroundPositions,dense:world.length+background.length===source.length,meshDelta:null};
  }
  function sameChunkCategory(c,e){const m=e.mesh,p=e.p,s=m.s;return s.length===3&&c.x===p[0]&&c.y===p[1]&&c.z===p[2]&&c.sx===s[0]&&c.sy===s[1]&&c.sz===s[2]&&c.detail===m.detail&&c.ground===(m.ground===true)&&c.radius===e.radius;}
  function planChunks(index,chunks,categories,state){
    const categoryFor=e=>{let c=categories.get(e);if(!c||!sameChunkCategory(c,e)){
      const m=e.mesh,p=e.p,s=m.s,size=Math.max(...s),ground=m.ground===true||(s[1]<.15&&p[1]+s[1]/2<.24),range=m.detail===2?65:m.detail===1?130:ground||size>4?6000:size<.65?75:180,cell=range<6000?32:128;
      c={key:Math.floor(p[0]/cell)+','+Math.floor(p[2]/cell)+','+range+','+(e.radius>40?'large':'small'),range,x:p[0],y:p[1],z:p[2],sx:s[0],sy:s[1],sz:s[2],detail:m.detail,ground:m.ground===true,radius:e.radius};categories.set(e,c);
    }e.chunkCategory=c;return c;};
    const delta=index.delta,incremental=chunks.size&&delta&&!delta.full&&state.index===index&&state.epoch===delta.fromEpoch;
    state.index=index;state.epoch=delta?.epoch;state.incremental=!!incremental;state.entriesVisited=0;
    if(incremental){
      const erased=new Set([...delta.removed,...delta.changed]),keys=new Set(),additions=new Map();
      for(const e of erased){const c=categories.get(e);if(c)keys.add(c.key);}
      for(const e of [...delta.added,...delta.changed]){const c=categoryFor(e);keys.add(c.key);let list=additions.get(c.key);if(!list){list=[];additions.set(c.key,list);}list.push(e);}
      const edited=[];
      for(const key of keys){
        const old=chunks.get(key),added=additions.get(key)||[],retained=(old?.entries||[]).filter(e=>!erased.has(e));
        // Retained occurrences are already ordered. Sort only the few new
        // entries and merge them without sorting an entire facade chunk.
        added.sort((a,b)=>a.ordinal-b.ordinal);const entries=[];let ai=0;
        for(const e of retained){while(ai<added.length&&added[ai].ordinal<e.ordinal)entries.push(added[ai++]);entries.push(e);}while(ai<added.length)entries.push(added[ai++]);
        state.entriesVisited+=(old?.entries.length||0)+added.length;if(!entries.length)continue;
        const c=old||{range:categoryFor(entries[0]).range,entries:[]};c.nextCount=entries.length;c.nextEntries=c.entries.length===entries.length&&entries.every((e,i)=>e===c.entries[i])?null:entries;edited.push([key,c,entries[0].ordinal]);
      }
      edited.sort((a,b)=>a[2]-b[2]);const next=new Map();let at=0;
      // Unchanged chunks retain relative order. Merge only the affected chunks
      // at their new first occurrence; even depth ties keep the original order.
      for(const [key,c] of chunks){if(keys.has(key))continue;const ordinal=c.entries[0].ordinal;while(at<edited.length&&edited[at][2]<ordinal){next.set(edited[at][0],edited[at][1]);at++;}c.nextEntries=null;c.nextCount=c.entries.length;next.set(key,c);}
      while(at<edited.length){next.set(edited[at][0],edited[at][1]);at++;}return next;
    }
    const next=new Map();for(const e of index.entries){state.entriesVisited++;const category=categoryFor(e);let c=next.get(category.key);
      if(!c){c=chunks.get(category.key)||{range:category.range,entries:[]};c.nextEntries=null;c.nextCount=0;next.set(category.key,c);}
      if(c.nextEntries)c.nextEntries.push(e);else if(c.entries[c.nextCount]!==e){c.nextEntries=c.entries.slice(0,c.nextCount);c.nextEntries.push(e);}c.nextCount++;
    }return next;
  }
  // Résultat partagé d'une requête sur un index vide : figé, car aucun appelant ne doit le remplir.
  const EMPTY_ENTRIES=Object.freeze([]);
  // Valeurs par défaut lues à chaque image (uniformes, lampes) : constantes, mêmes valeurs que les littéraux d'origine.
  const WHITE=Object.freeze([1,1,1]),DEFAULT_CONE=Object.freeze([.75,.94]),SEA_ORIGIN=new Float32Array(4),SEA_MOTION=new Float32Array([0,0,-1.25,0]),TORCH_OFF=new Float32Array([0,-1e5,0]),ZERO4=new Float32Array(4);
  function spatialIndex(meshes,environment,previous,options){
    if(previous?.reconcile)return previous.reconcile(meshes,environment,options);
    const levels=[new Map(),new Map(),new Map()],large=[0,1,2].map(level=>({entries:[],epoch:0,count:0,next:null,level,key:null})),maxRadius=[0,0,0],byMesh=new WeakMap();let epoch=0;
    const index={entries:[],query,byMesh,reconcile};let sourceMeshes=null,revisionedSource=false;
    function append(bucket,e){
      if(bucket.epoch!==epoch){bucket.epoch=epoch;bucket.count=0;bucket.next=null;}
      if(bucket.next)bucket.next.push(e);
      else if(bucket.entries[bucket.count]!==e){bucket.next=bucket.entries.slice(0,bucket.count);bucket.next.push(e);}
      bucket.count++;
    }
    function finish(bucket){
      if(bucket.epoch!==epoch){bucket.entries=[];return false;}
      if(bucket.next)bucket.entries=bucket.next;
      else if(bucket.count!==bucket.entries.length)bucket.entries=bucket.entries.slice(0,bucket.count);
      bucket.next=null;return true;
    }
    function applyMeshDelta(list,env,options){
      const splices=options?.revisionedMeshes===true&&!index.duplicates&&sourceMeshes?.length===index.entries.length&&validatedMeshSplices(options.meshDelta,sourceMeshes,list);
      if(!splices)return false;
      // Existing identities in insertions may be moves, revisions or duplicate
      // occurrences. Preserve their general reconciliation semantics instead.
      const unique=new Set();for(const q of splices)for(const mesh of q.items){if(byMesh.has(mesh)||unique.has(mesh))return false;unique.add(mesh);}
      // A valid delta also permits opting in after a strict initial load.
      // Release its old snapshots without reading any retained mesh fields.
      if(!revisionedSource){for(const e of index.entries)e.sourceState=null;revisionedSource=true;}
      if(!splices.length){sourceMeshes=list;index.delta={fromEpoch:epoch,epoch,added:[],removed:[],changed:[],full:false,fast:true};return true;}
      const priorEpoch=epoch++,removed=[],added=[],entrySplices=[],dirty=new Set(),insertions=new Map();
      for(const q of splices){
        for(let i=q.start;i<q.start+q.deleteCount;i++){const e=index.entries[i];removed.push(e);dirty.add(e.indexBucket);byMesh.delete(e.mesh);}
        const items=[];for(const mesh of q.items){
          const e=metadata(mesh),p=e.p,s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=mesh.color||[0,0,0];
          e.sourceState=null;e.row=new Float32Array([p[0],p[1],p[2],mesh.mat||0,s[0],s[1],s[2],instanceDataW(mesh),r[0],r[1],r[2],surfaceFlags(mesh,env),c[0],c[1],c[2],opaqueColorMarker(mesh)]);
          let bucket;if(e.radius>32)bucket=large[e.detail];else{const key=Math.floor(p[0]/8)+','+Math.floor(p[2]/8),map=levels[e.detail];bucket=map.get(key);if(!bucket){bucket={entries:[],epoch:0,count:0,next:null,level:e.detail,key};map.set(key,bucket);}maxRadius[e.detail]=Math.max(maxRadius[e.detail],e.radius);}
          e.indexBucket=bucket;e.indexPX=p[0];e.indexPZ=p[2];e.indexRadius=e.radius;e.indexDetail=e.detail;dirty.add(bucket);let group=insertions.get(bucket);if(!group){group=[];insertions.set(bucket,group);}group.push(e);byMesh.set(mesh,e);items.push(e);added.push(e);
        }entrySplices.push({start:q.start,deleteCount:q.deleteCount,items});
      }
      const entries=spliceReferences(index.entries,entrySplices,list.length);for(let i=0;i<entries.length;i++){const e=entries[i];e.indexEpoch=epoch;e.ordinal=i;}
      for(const bucket of dirty){const next=bucket.entries.filter(e=>e.indexEpoch===epoch),add=insertions.get(bucket);if(add?.length){for(const e of add)next.push(e);next.sort((a,b)=>a.ordinal-b.ordinal);}bucket.entries=next;bucket.epoch=epoch;bucket.count=next.length;bucket.next=null;if(!next.length&&bucket.key!==null)levels[bucket.level].delete(bucket.key);}
      sourceMeshes=list;index.entries=entries;index.duplicates=false;index.delta={fromEpoch:priorEpoch,epoch,added,removed,changed:[],full:false,fast:true};return true;
    }
    function reconcile(list,env,options){
      if(applyMeshDelta(list,env,options))return index;
      // Opt-in producer contract: retained identity + renderRevision guarantees
      // every render/spatial property (including p/s/r/color array contents)
      // is unchanged. A revised mesh always receives complete new metadata.
      // These producers need no per-mesh value snapshot. Returning to strict
      // mode rebuilds metadata once because the missing snapshot cannot prove
      // equality; subsequent strict updates retain their original checks.
      const revisionedMeshes=options?.revisionedMeshes===true;
      const priorEpoch=epoch++,priorDuplicates=index.duplicates,priorEntries=index.entries,entries=[],added=[],removed=[],changed=[],removalCandidates=[],dirtyBuckets=new Set(),bucketInsertions=new Map();let lastOrdinal=-1,cursor=0,reordered=false,duplicates=false;
      const considerRemoval=e=>{if(e.removalEpoch!==epoch){e.removalEpoch=epoch;removalCandidates.push(e);}};
      for(const mesh of list||[]){
        // Stable scene order permits a direct reference read. Gaps in that
        // cursor identify the possible removals without rescanning every entry.
        const candidate=priorDuplicates?null:priorEntries[cursor],prior=candidate?.mesh===mesh&&candidate.indexEpoch===priorEpoch?candidate:byMesh.get(mesh);
        if(prior?.indexEpoch===priorEpoch&&prior.ordinal>=cursor){if(!priorDuplicates)for(let i=cursor;i<prior.ordinal;i++)considerRemoval(priorEntries[i]);cursor=prior.ordinal+1;}
        const duplicate=prior?.indexEpoch===epoch,retained=prior&&(prior.indexEpoch===priorEpoch||prior.retainedEpoch===epoch)&&prior.renderRevision===(mesh.renderRevision||0)&&(revisionedMeshes||prior.sourceState&&meshState(mesh,env).every((v,k)=>v===prior.sourceState[k]))?prior:null,e=retained||metadata(mesh);
        if(duplicate)duplicates=true;
        if(retained){
          if(!duplicate){if(e.ordinal<=lastOrdinal)reordered=true;lastOrdinal=e.ordinal;}
          if(revisionedMeshes)e.sourceState=null;
          e.retainedEpoch=epoch;if(!revisionedMeshes&&e.chunkCategory&&!sameChunkCategory(e.chunkCategory,e))changed.push(e);
        }
        else{
          if(!priorDuplicates&&prior?.indexEpoch===priorEpoch)considerRemoval(prior);
          const p=e.p,s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=mesh.color||[0,0,0];
          e.sourceState=revisionedMeshes?null:meshState(mesh,env);e.row=new Float32Array([p[0],p[1],p[2],mesh.mat||0,s[0],s[1],s[2],instanceDataW(mesh),r[0],r[1],r[2],surfaceFlags(mesh,env),c[0],c[1],c[2],opaqueColorMarker(mesh)]);
          byMesh.set(mesh,e);
          if(priorEpoch)added.push(e);
        }
        const oldBucket=e.indexBucket;
        if(!oldBucket||(!revisionedMeshes&&(e.indexPX!==e.p[0]||e.indexPZ!==e.p[2]||e.indexRadius!==e.radius||e.indexDetail!==e.detail))){
          if(e.radius>32)e.indexBucket=large[e.detail];
          else{const key=Math.floor(e.p[0]/8)+','+Math.floor(e.p[2]/8),map=levels[e.detail];let bucket=map.get(key);if(!bucket){bucket={entries:[],epoch:0,count:0,next:null,level:e.detail,key};map.set(key,bucket);}e.indexBucket=bucket;maxRadius[e.detail]=Math.max(maxRadius[e.detail],e.radius);}
          e.indexPX=e.p[0];e.indexPZ=e.p[2];e.indexRadius=e.radius;e.indexDetail=e.detail;
        }
        if(priorEpoch&&!priorDuplicates&&e.indexBucket!==oldBucket){if(oldBucket)dirtyBuckets.add(oldBucket);dirtyBuckets.add(e.indexBucket);let list=bucketInsertions.get(e.indexBucket);if(!list){list=[];bucketInsertions.set(e.indexBucket,list);}list.push(e);}
        e.indexEpoch=epoch;e.ordinal=entries.length;entries.push(e);
      }
      const threshold=Math.max(64,entries.length/4),scanAll=!priorEpoch||priorDuplicates||duplicates||reordered||added.length>threshold||removalCandidates.length+priorEntries.length-cursor>threshold;
      if(!scanAll)for(let i=cursor;i<priorEntries.length;i++)considerRemoval(priorEntries[i]);
      for(const e of scanAll?priorEntries:removalCandidates)if(e.indexEpoch!==epoch){removed.push(e);dirtyBuckets.add(e.indexBucket);if(byMesh.get(e.mesh)===e)byMesh.delete(e.mesh);}
      const full=!priorEpoch||reordered||duplicates||priorDuplicates||added.length+removed.length>threshold;
      if(full){
        // Duplicates and order changes require the exact original traversal.
        for(const e of entries)append(e.indexBucket,e);
        for(let level=0;level<3;level++){finish(large[level]);for(const [key,bucket] of levels[level])if(!finish(bucket))levels[level].delete(key);}
      }else for(const bucket of dirtyBuckets){
        const next=bucket.entries.filter(e=>e.indexEpoch===epoch&&e.indexBucket===bucket),insertions=bucketInsertions.get(bucket);
        if(insertions?.length){for(const e of insertions)next.push(e);next.sort((a,b)=>a.ordinal-b.ordinal);}
        bucket.entries=next;bucket.epoch=epoch;bucket.count=next.length;bucket.next=null;
        if(!next.length&&bucket.key!==null)levels[bucket.level].delete(bucket.key);
      }
      sourceMeshes=list;revisionedSource=revisionedMeshes;index.entries=entries;index.duplicates=duplicates;index.delta={fromEpoch:priorEpoch,epoch,added,removed,changed,full,fast:false};return index;
    }
    function query(eye,ranges,out,frustum){
      // Un index vide (BITUME pose setWorld([], [])) n'a aucun seau : ni clé de cellule ni tableau à construire.
      if(!index.entries.length){if(out)out.length=0;return out||EMPTY_ENTRIES;}
      const result=out||[];result.length=0;
      for(let level=0;level<3;level++){
        const range=ranges[level];if(!(range>0))continue;
        for(const e of large[level].entries){const d=(e.p[0]-eye[0])**2+(e.p[1]-eye[1])**2+(e.p[2]-eye[2])**2;if(d<=(range+e.radius)**2)result.push(e);}
        // Keeping the largest previous radius is conservative: the exact same
        // distance test below rejects any extra buckets visited after removals.
        const radius=range+maxRadius[level];
        for(let x=Math.floor((eye[0]-radius)/8);x<=Math.floor((eye[0]+radius)/8);x++)for(let z=Math.floor((eye[2]-radius)/8);z<=Math.floor((eye[2]+radius)/8);z++){
          const bucket=levels[level].get(x+','+z);if(!bucket)continue;
          for(const e of bucket.entries){const d=(e.p[0]-eye[0])**2+(e.p[1]-eye[1])**2+(e.p[2]-eye[2])**2;if(d<=(range+e.radius)**2)result.push(e);}
        }
      }
      if(frustum){let n=0;for(const e of result)if(visible(e,eye,frustum.axes,frustum.horizontal,frustum.vertical,frustum.far))result[n++]=e;result.length=n;}return result;
    }
    return reconcile(meshes,environment,options);
  }
  function changedSelection(index,origin,ranges){const d=index.delta;if(!d||d.full||d.changed.length)return true;for(const e of [...d.added,...d.removed]){const r=ranges[e.detail]+e.radius;if(Math.abs(e.p[0]-origin[0])<=r&&Math.abs(e.p[1]-origin[1])<=r&&Math.abs(e.p[2]-origin[2])<=r)return true;}return false;}
  // Scale a sphere radius along the two sloping clipping planes. These factors
  // depend only on the projection, so colour passes share them across all bounds.
  function setFrustumRadii(out,horizontal,vertical){
    out.horizontal=Math.sqrt(1+horizontal*horizontal);
    out.vertical=Math.sqrt(1+vertical*vertical);
  }
  function visible(e,eye,axes,horizontal,vertical,far,radii){
    const x=e.p[0]-eye[0],y=e.p[1]-eye[1],d=e.p[2]-eye[2],f=axes.forward,right=axes.right,up=axes.up;
    const z=x*f[0]+y*f[1]+d*f[2],r=e.radius;
    return z+r>.04&&z-r<far&&
      Math.abs(x*right[0]+y*right[1]+d*right[2])<=z*horizontal+r*(radii?radii.horizontal:Math.sqrt(1+horizontal*horizontal))&&
      Math.abs(x*up[0]+y*up[1]+d*up[2])<=z*vertical+r*(radii?radii.vertical:Math.sqrt(1+vertical*vertical));
  }
  function packIndexed(entries){
    const buckets=names.map(()=>[]);for(const e of entries){const i=shapeIndices.get(e.mesh.shape||'box');if(i!==undefined)buckets[i].push(e);}
    const values=new Float32Array(entries.length*16),groups=[];let offset=0;
    for(let i=0;i<names.length;i++)if(buckets[i].length){groups.push({name:names[i],offset:offset*4,count:buckets[i].length});for(const e of buckets[i]){values.set(e.row,offset);offset+=16;}}
    return {values,groups};
  }

  function orthographicSun(sun,photoProjection,photoMatrix,out,c,e,size,lift,near,far,axe,snap){
    // Math.sqrt plutôt que Math.hypot : appelée à chaque image (tuile), hypot recevrait ses arguments en nombres alloués.
    const sl=Math.sqrt(sun[0]*sun[0]+sun[1]*sun[1]+sun[2]*sun[2])||1;
    const fx=-sun[0]/sl,fy=-sun[1]/sl,fz=-sun[2]/sl;
    let rx,ry,rz;
    if(axe){rx=axe[0];ry=axe[1];rz=axe[2];}else{const h=Math.sqrt(fx*fx+fz*fz);if(h>.0001){rx=-fz/h;ry=0;rz=fx/h;}else{rx=1;ry=0;rz=0;}}
    const k=rx*fx+ry*fy+rz*fz;rx-=k*fx;ry-=k*fy;rz-=k*fz;let rl=Math.sqrt(rx*rx+ry*ry+rz*rz);
    if(rl<.0001){rx=1-fx*fx;ry=-fx*fy;rz=-fx*fz;rl=Math.sqrt(rx*rx+ry*ry+rz*rz)||1;}
    rx/=rl;ry/=rl;rz/=rl;
    const ux=ry*fz-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy-ry*fx,texel=e*2/size;
    let cx=c[0],cy=c[1],cz=c[2];
    if(snap){const a=rx*cx+ry*cy+rz*cz,b=ux*cx+uy*cy+uz*cz,da=Math.round(a/texel)*texel-a,db=Math.round(b/texel)*texel-b;cx+=rx*da+ux*db;cy+=ry*da+uy*db;cz+=rz*da+uz*db;}
    const px=cx-fx*lift,py=cy-fy*lift,pz=cz-fz*lift;
    photoMatrix[0]=rx;photoMatrix[1]=ux;photoMatrix[2]=-fx;photoMatrix[3]=0;photoMatrix[4]=ry;photoMatrix[5]=uy;photoMatrix[6]=-fy;photoMatrix[7]=0;
    photoMatrix[8]=rz;photoMatrix[9]=uz;photoMatrix[10]=-fz;photoMatrix[11]=0;
    photoMatrix[12]=-(rx*px+ry*py+rz*pz);photoMatrix[13]=-(ux*px+uy*py+uz*pz);photoMatrix[14]=fx*px+fy*py+fz*pz;photoMatrix[15]=1;
    photoProjection.fill(0);photoProjection[0]=photoProjection[5]=1/e;photoProjection[10]=-2/(far-near);photoProjection[14]=-(far+near)/(far-near);photoProjection[15]=1;
    multiply(photoProjection,photoMatrix,out);
    return texel;
  }
  function sunBounds(sun,lots,m,dessous){
    const sl=Math.hypot(sun[0],sun[1],sun[2])||1,fx=-sun[0]/sl,fy=-sun[1]/sl,fz=-sun[2]/sl,h=Math.hypot(fx,fz);
    const rx=h>.0001?-fz/h:1,rz=h>.0001?fx/h:0,ux=-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy;
    let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity,d0=Infinity,d1=-Infinity;
    for(const l of lots){
      const c=l.centre,r=Math.max(0,Number(l.rayon)||0);
      if(l.ombre===false||l.groundCover||l.detailProcheSeul||!c||!Number.isFinite(c[0])||!Number.isFinite(c[1])||!Number.isFinite(c[2]))continue;
      const a=rx*c[0]+rz*c[2],b=ux*c[0]+uy*c[1]+uz*c[2],d=fx*c[0]+fy*c[1]+fz*c[2];
      a0=Math.min(a0,a-r);a1=Math.max(a1,a+r);b0=Math.min(b0,b-r);b1=Math.max(b1,b+r);d0=Math.min(d0,d-r);d1=Math.max(d1,d+r);
    }
    if(!(a1>=a0))return null;
    const a=(a0+a1)/2,b=(b0+b1)/2,d=(d0+d1)/2;
    return {centre:[rx*a+ux*b+fx*d,uy*b+fy*d,rz*a+uz*b+fz*d],etendue:Math.max(a1-a0,b1-b0)/2+m,lift:d-d0+m,profondeur:d1-d0+m+dessous};
  }
  function skyColor(values,scale=1){return 'rgb('+values.map(v=>Math.round(Math.pow(Math.max(0,v*scale)/(Math.max(0,v*scale)+.76),.4545)*255)).join(',')+')';}
  function softwareSky(ctx,width,height,axes,tan,environment,time){
    const {right,up,forward}=axes,focal=height/(2*tan),span=Math.hypot(right[1],up[1])||1;
    const ux=right[1]/span,uy=-up[1]/span,offset=-forward[1]*focal/span;
    const hx=width*.5+ux*offset,hy=height*.5+uy*offset;
    const gradient=ctx.createLinearGradient(hx+ux*height,hy+uy*height,hx-ux*height*.15,hy-uy*height*.15);
    gradient.addColorStop(0,skyColor(environment.skyTop));gradient.addColorStop(.84,skyColor(environment.skyBottom));gradient.addColorStop(1,skyColor(environment.fog,.85));
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    const projectDirection=d=>{const z=d[0]*forward[0]+d[1]*forward[1]+d[2]*forward[2];return z>.03?[width*.5+(d[0]*right[0]+d[1]*right[1]+d[2]*right[2])*focal/z,height*.5-(d[0]*up[0]+d[1]*up[1]+d[2]*up[2])*focal/z,z]:null;};
    const sun=projectDirection(environment.sunDirection);
    if(sun){
      const radius=Math.max(4,focal*.022/sun[2]),glow=ctx.createRadialGradient(sun[0],sun[1],radius*.2,sun[0],sun[1],radius*7);
      glow.addColorStop(0,'rgba(255,233,179,.70)');glow.addColorStop(1,'rgba(255,232,182,0)');
      ctx.fillStyle=glow;ctx.fillRect(sun[0]-radius*7,sun[1]-radius*7,radius*14,radius*14);
      ctx.beginPath();ctx.arc(sun[0],sun[1],radius,0,Math.PI*2);ctx.fillStyle=skyColor(environment.sunColor,5);ctx.fill();
    }
    // Clouds occupy stable directions in the sky; walking never drags them with the camera.
    for(let i=0;i<20;i++){
      const angle=i*2.399963+time*.0008*environment.wind,elevation=.16+(.5+.5*Math.sin(i*5.17))*.52;
      const d=[Math.sin(angle),elevation,-Math.cos(angle)],cloud=projectDirection(d);if(!cloud)continue;
      const size=focal*(.075+(.5+.5*Math.sin(i*3.1))*.08)/cloud[2];
      if(cloud[0]<-size*3||cloud[0]>width+size*3||cloud[1]<-size||cloud[1]>height+size)continue;
      ctx.save();ctx.translate(cloud[0],cloud[1]);ctx.rotate(Math.atan2(right[1],up[1]));ctx.scale(2.6,1);
      const haze=ctx.createRadialGradient(0,0,0,0,0,size);haze.addColorStop(0,'rgba(247,249,234,.27)');haze.addColorStop(.5,'rgba(247,249,234,.19)');haze.addColorStop(1,'rgba(247,249,234,0)');
      ctx.fillStyle=haze;ctx.fillRect(-size,-size,size*2,size*2);ctx.restore();
    }
    // A yaw-stable panorama continues behind the actual trees, cliffs and buildings.
    for(let layer=0;layer<2;layer++){
      const points=[];
      for(let x=-width*.25;x<=width*1.25;x+=width/48){
        const lateral=(x-width*.5)/focal,dx=forward[0]+right[0]*lateral,dz=forward[2]+right[2]*lateral,angle=Math.atan2(dx,-dz);
        const ridge=(layer?-.018:.026)+(.5+.5*Math.sin(angle*7.3+layer*5))*.035+(.5+.5*Math.sin(angle*17.1+2))*.022;
        const point=projectDirection([Math.sin(angle),ridge,-Math.cos(angle)]);if(point)points.push(point);
      }
      if(points.length>1){ctx.beginPath();ctx.moveTo(points[0][0],height*3);for(const p of points)ctx.lineTo(p[0],p[1]);ctx.lineTo(points[points.length-1][0],height*3);ctx.closePath();ctx.fillStyle=skyColor(environment.fog,layer?.8:1.12);ctx.fill();}
    }
  }

  // CPU fallback: actual transformed polygons, perspective projection and near clipping.
  // It intentionally has fewer facets and a shorter draw distance than the GPU renderer.
  function createSoftware(canvas,options={}) {
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx) throw new Error('Le rendu graphique est indisponible dans ce navigateur.');
    const base={},coarseBase={},palette=[[.105,.135,.15],[.36,.18,.065],[.13,.16,.17],[.57,.58,.54],[.025,.74,.77],[1,.42,.06],[.68,.055,.025],[.065,.075,.085],[.16,.21,.075],[.32,.31,.27],[.18,.10,.04],[.105,.255,.055],[.035,.12,.15]];
    const stats={backend:'canvas2d',webglVersion:0,drawCalls:0,triangles:0,instances:0,contextLost:false,bloom:false,shadows:false,creations:0};
    const surface=options.resolution==='native'&&window.FSurface?window.FSurface.create(canvas,{scale:options.renderScale}):null;if(surface)stats.native=surface.stats;
    let world=spatialIndex([]),lights=[],environment=null,quality='auto',disposed=false,vignette=null,shadowGeometry=new WeakMap(),explicitGround=false,staticCasterPlan=null,worldRevision=0,environmentRevision=0;
    const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
    const same=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])<.00001;
    function normal(v) {
      const a=subtract(v[1],v[0]),b=subtract(v[2],v[0]);
      const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n)||1;
      return n.map(x=>x/length);
    }
    function merge(a,b) {
      if(dot(normal(a),normal(b))<.99999) return null;
      const edges=[];
      for(const v of [a,b]) for(let j=0;j<3;j++) edges.push([v[j],v[(j+1)%3]]);
      const boundary=edges.filter(e=>!edges.some(f=>e!==f&&same(e[0],f[1])&&same(e[1],f[0])));
      if(boundary.length!==4)return null;
      const v=[boundary[0][0]];let tip=boundary[0][1];
      for(let j=0;j<3;j++){v.push(tip);const next=boundary.find(e=>same(e[0],tip));if(!next)return null;tip=next[1];}
      return same(tip,v[0])?v:null;
    }
    for(const [source,shapes] of [[geometry(true),base],[geometry(2),coarseBase]]){
      for(const shape of names) {
        const range=source.ranges[shape],triangles=[];
        for(let j=range.offset/source.indices.BYTES_PER_ELEMENT;j<range.offset/source.indices.BYTES_PER_ELEMENT+range.count;j+=3){
          const v=[];for(let k=0;k<3;k++){const at=source.indices[j+k]*6;v.push(Array.from(source.vertices.subarray(at,at+3)));}triangles.push(v);
        }
        shapes[shape]=[];
        for(let j=0;j<triangles.length;j++){
          const quad=j+1<triangles.length?merge(triangles[j],triangles[j+1]):null;
          shapes[shape].push(quad||triangles[j]);if(quad)j++;
        }
        if(shape==='cylinder'){
          // A planar cap is one polygon, not a fan of separately shaded triangles.
          for(const sign of [-1,1]){
            const vertices=[];for(const face of shapes[shape])if(normal(face)[1]*sign>.999)for(const p of face)if(Math.hypot(p[0],p[2])>.49&&!vertices.some(v=>same(v,p)))vertices.push(p);
            vertices.sort((a,b)=>Math.atan2(a[2],a[0])-Math.atan2(b[2],b[0]));if(normal(vertices)[1]*sign<0)vertices.reverse();
            shapes[shape]=shapes[shape].filter(face=>normal(face)[1]*sign<.999);shapes[shape].push(vertices);
          }
        }
        // Weld the mathematical primitive once. Moving actors reuse topology
        // instead of rebuilding string-keyed vertex maps for every mesh/frame.
        const faces=shapes[shape],vertices=[],keys=new Map(),indices=faces.map(face=>face.map(p=>{
          const key=p.map(v=>Math.round(v*100000)).join(',');
          if(!keys.has(key)){keys.set(key,vertices.length);vertices.push(p);}return keys.get(key);
        }));
        shapes[shape]={faces,vertices,indices};
      }
    }
    function cache(mesh,staticLighting=false,coarse=false,objects=false) {
      const p=mesh.p||[0,0,0],s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=r.map(Math.cos),sn=r.map(Math.sin);
      function transform(v){
        let x=v[0]*s[0],y=v[1]*s[1],z=v[2]*s[2];
        if(mesh.groundCover===true&&Number.isFinite(mesh.groundShear))x+=v[2]*mesh.groundShear;
        if(mesh.fx&&mesh.shape==='ring'&&Number.isFinite(mesh.innerRatio)){
          const radial=Math.hypot(v[0],v[2]),side=Math.max(0,Math.min(1,(radial-.37)/.13)),inner=Math.max(0,Math.min(.999,mesh.innerRatio)),scale=(inner*.5+(.5-inner*.5)*side)/Math.max(radial,.0001);x*=scale;z*=scale;
        }
        [y,z]=[c[0]*y-sn[0]*z,sn[0]*y+c[0]*z];
        [x,z]=[c[1]*x+sn[1]*z,-sn[1]*x+c[1]*z];
        return [c[2]*x-sn[2]*y+p[0],sn[2]*x+c[2]*y+p[1],z+p[2]];
      }
      const recipe=mesh.mat||0,mat=Math.max(0,Math.min(12,Math.floor(recipe>27.5&&recipe<29.5?7:recipe>24.5&&recipe<27.5?materialFamily(recipe):recipe))),outdoor=outdoorMesh(mesh,environment),color=mesh.color?(mat<4?mesh.color.map(v=>v*.65):mat>=8?mesh.color.map((v,k)=>v*.65+palette[mat][k]*.35):mesh.color):palette[mat],shape=mesh.shape||'box';
      const object=(surfaceFlags(mesh,environment,objects)&4)!==0;
      const emission=(mesh.groundCover===true?0:mesh.emissive||0)+(mat===4?.72:mat===5?.68:mat===6?.18:0);
      const shapeSet=coarse?coarseBase:base,template=shapeSet[shape]||shapeSet.box,vertices=template.vertices.map(transform),faces=template.faces.map((v,index)=>{
        const indices=template.indices[index],points=indices.map(i=>vertices[i]),n=normal(points),center=[0,0,0];
        for(const q of points)for(let k=0;k<3;k++)center[k]+=q[k]/points.length;
        const surface=object?[0,0,0]:center;
        if(object)for(const q of v)for(let k=0;k<3;k++)surface[k]+=q[k]*s[k]/v.length;
        const grain=.9+Math.abs(Math.sin(surface[0]*91.17+surface[1]*17.3+surface[2]*51.79))*.13;
        // Explicit receivers include terraces, ramps and moving lift decks. Keep
        // the original zero-level inference for older, unmarked scene fixtures.
        const lines=[],ground=!object&&(mesh.ground===true?n[1]>.55:!explicitGround&&mesh.ground!==false&&n[1]>.98&&(mat===2||mat===8||mat===9||mat===12)&&Math.abs(center[1])<.08),plane=dot(n,center);
        if(!object&&shape==='box'&&points.length===4&&mat<4){
          if(ground){
            // Intersect world-aligned seams with the face edges: interpolation
            // keeps every endpoint on sloping and rotated floor polygons.
            for(const axis of [0,2]){
              const coords=points.map(v=>v[axis]),lo=Math.min(...coords),hi=Math.max(...coords);
              for(let value=Math.ceil(lo/2)*2;value<hi;value+=2){
                const hits=[];
                for(let i=0;i<points.length;i++){
                  const a=points[i],b=points[(i+1)%points.length];
                  if((a[axis]<=value)!==(b[axis]<=value)){const t=(value-a[axis])/(b[axis]-a[axis]);hits.push(a.map((x,k)=>x+(b[k]-x)*t));}
                }
                if(hits.length===2)lines.push(hits);
              }
            }
          }else{
            const a=subtract(points[1],points[0]),b=subtract(points[3],points[0]);
            const na=Math.min(12,Math.floor(Math.hypot(...a)/2)),nb=Math.min(12,Math.floor(Math.hypot(...b)/2));
            for(let i=1;i<na;i++)lines.push([points[0].map((x,k)=>x+a[k]*i/na),points[3].map((x,k)=>x+a[k]*i/na)]);
            for(let i=1;i<nb;i++)lines.push([points[0].map((x,k)=>x+b[k]*i/nb),points[1].map((x,k)=>x+b[k]*i/nb)]);
          }
        }
        let fixedLight=null,fixedLampParts=null;
        if(staticLighting){
          fixedLampParts=[];
          fixedLight=(outdoor?environment.ambient:[.10,.13,.15]).map(v=>v*(.72+.28*Math.max(outdoor?0:-1,n[1])));
          const sun=outdoor?Math.max(0,dot(n,environment.sunDirection)):Math.max(0,(-.45*n[0]+.85*n[1]+.35*n[2])/1.022)*.13;
          for(let k=0;k<3;k++)fixedLight[k]+=sun*(outdoor?environment.sunColor[k]:1);
          const nearby=lights.map(light=>({light,d:(light.p[0]-center[0])**2+(light.p[1]-center[1])**2+(light.p[2]-center[2])**2})).sort((a,b)=>a.d-b.d).slice(0,4);
          for(const {light,d} of nearby){const vector=subtract(light.p,center),power=(light.power===undefined?1:light.power)*.24/(1+d*.26)*(Math.max(0,dot(n,vector)/(Math.sqrt(d)||.001))+.035),c=light.color||[1,1,1];for(let k=0;k<3;k++)fixedLight[k]+=power*c[k];fixedLampParts.push(light,power);}
        }
        return {points,indices,n,center,plane,grain,lines,color,emission,mat,ground,fixedLight,fixedLampParts,outdoor,region:mesh.region,overlay:!!mesh.overlay,fx:!!mesh.fx,fxFire:!!mesh.fxFire,fxHazard:mesh.fxPriority==='hazard',opacity:opaqueOpacity(mesh),alpha:mesh.fx?Math.min(1,Math.max(0,mesh.alpha||0)):1};
      });
      return {p,radius:metadata(mesh).radius,faces,vertices,sway:mat===11,s,mesh,environmentRevision};
    }
    function setWorld(meshes,points,atmosphere,setOptions){
      environment=environmentInfo(atmosphere);world=spatialIndex(meshes||[],environment,undefined,setOptions);lights=points||[];
      explicitGround=(meshes||[]).some(mesh=>mesh.ground===true);
      shadowGeometry=new WeakMap();staticCasterPlan=null;for(const e of world.entries)shadowGeometry.set(e.mesh,null);
      worldRevision=0;stats.worldRevision=0;stats.staticTotal=world.entries.length;stats.biome=environment?environment.biome:null;
    }
    function updateWorld(meshes,revision,points,updateOptions){
      if(disposed||revision===worldRevision&&!updateOptions?.full)return false;
      const changedLights=Array.isArray(points)&&(points.length!==lights.length||points.some((light,i)=>light!==lights[i]));
      if(changedLights)lights=points;
      const next=meshes||[],ground=next.some(mesh=>mesh.ground===true);world=spatialIndex(next,environment,world,updateOptions);
      // Legacy scenes infer the floor. Switching that rule invalidates their
      // receiver classification, even for otherwise unchanged surfaces.
      if(ground!==explicitGround||changedLights)for(const e of world.entries)e.software=e.softwareCoarse=null;
      for(const e of [...world.delta.changed,...world.delta.added]){e.software=e.softwareCoarse=null;shadowGeometry.delete(e.mesh);}
      explicitGround=ground;staticCasterPlan=null;
      for(const e of world.entries)if(!shadowGeometry.has(e.mesh))shadowGeometry.set(e.mesh,null);
      worldRevision=revision===undefined?worldRevision+1:revision;stats.worldRevision=worldRevision;stats.staticTotal=world.entries.length;
      return true;
    }
    function resize(next){
      if(next!==undefined)quality=next;
      const cssWidth=canvas.clientWidth||window.innerWidth||800,cssHeight=canvas.clientHeight||window.innerHeight||600;
      if(surface)surface.measure();
      const requested=surface?surface.size().ratio:typeof quality==='number'?Math.max(.5,Math.min(1.5,quality)):quality==='low'?.8:quality==='high'?1.25:1;
      const limit=quality==='low'?[720,480]:quality==='high'?[1280,900]:[1024,720];
      const ratio=Math.min(requested,limit[0]/cssWidth,limit[1]/cssHeight);
      const width=Math.max(1,Math.round(cssWidth*ratio)),height=Math.max(1,Math.round(cssHeight*ratio));
      if(canvas.width!==width||canvas.height!==height||!vignette){
        canvas.width=width;canvas.height=height;
        vignette=ctx.createRadialGradient(width*.5,height*.47,height*.15,width*.5,height*.5,Math.hypot(width,height)*.58);
        vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,5,12,.47)');
      }
      if(surface){surface.record(width,height);surface.stats.capped='software';surface.stats.scale=ratio/(window.devicePixelRatio||1);}
      stats.renderScale=1;stats.pixelRatio=ratio;stats.width=width;stats.height=height;
      return {width,height,ratio};
    }
    function clip(points,depth,greater){
      const result=[];let previous=points[points.length-1],prevInside=greater?previous[2]>=depth:previous[2]<=depth;
      for(const p of points){
        const inside=greater?p[2]>=depth:p[2]<=depth;
        if(inside!==prevInside){const t=(depth-previous[2])/(p[2]-previous[2]);result.push([previous[0]+(p[0]-previous[0])*t,previous[1]+(p[1]-previous[1])*t,depth]);}
        if(inside)result.push(p);previous=p;prevInside=inside;
      }
      return result;
    }
    function screenBounds(points){
      const b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of points){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;
    }
    const overlap=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
    function clipScreenLine(points,a,b,c){
      const side=p=>a*p[0]+b*p[1]+c,result=[];let previous=points[points.length-1],before=side(previous);
      for(const p of points){const after=side(p);if((before>=0)!==(after>=0)){const t=before/(before-after);result.push([previous[0]+(p[0]-previous[0])*t,previous[1]+(p[1]-previous[1])*t]);}if(after>=0)result.push(p);previous=p;before=after;}
      return result;
    }
    function draw(camera,dynamic,fx){
      if(disposed)return;resize();fx=fx||{};
      const width=canvas.width,height=canvas.height,t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0];
      const eye=[p[0]+Math.sin(t*57)*shake*.025,p[1]+Math.sin(t*71)*shake*.015,p[2]];
      const axes=cameraAxes(camera),{right,up,forward}=axes;
      const fov=Math.max(FOV_MIN,Math.min(110,camera.fov||75))*Math.PI/180,tan=Math.tan(fov*.5),focal=height/(2*tan),horizontal=tan*width/height;
      const near=.065,far=softwareDistance(quality,environment,eye);stats.viewDistance=far;
      const toCamera=v=>{const x=v[0]-eye[0],y=v[1]-eye[1],z=v[2]-eye[2];return [x*right[0]+y*right[1]+z*right[2],x*up[0]+y*up[1]+z*up[2],x*forward[0]+y*forward[1]+z*forward[2]];};
      const project=v=>[width*.5+v[0]*focal/v[2],height*.5-v[1]*focal/v[2]];
      function projectPolygon(points){
        let transformed=points.map(toCamera);if(transformed.length<3||transformed.every(v=>v[2]<near)||transformed.every(v=>v[2]>far))return [];
        if(transformed.some(v=>v[2]<near))transformed=clip(transformed,near,true);
        if(transformed.length&&transformed.some(v=>v[2]>far))transformed=clip(transformed,far,false);
        return transformed.length>2?transformed.map(project):[];
      }
      const nearest=lights.map(light=>({light,d:dot(subtract(light.p,eye),subtract(light.p,eye))})).sort((a,b)=>a.d-b.d).slice(0,quality==='low'?4:6).map(entry=>entry.light);
      const transient=transientLights(fx.lights,eye,quality==='low'?1:2);stats.dynamicLights=transient.length;
      const blackout=horrorLights(fx.horror,lights);stats.blackoutLights=blackout?.size||0;
      const faces=[],overlays=[],grounds=[];
      stats.drawCalls=0;stats.triangles=0;stats.instances=0;
      function inView(position,r){
        const center=toCamera(position);
        return !(center[2]+r<near||center[2]-r>far||Math.abs(center[0])>center[2]*horizontal+r*(1+horizontal)||Math.abs(center[1])>center[2]*tan+r*(1+tan));
      }
      function collect(object){
        if(!inView(object.p,object.radius)||(!object.mesh.fx&&opaqueOpacity(object.mesh)===0))return;
        // Lighting changes invalidate only cached illumination, never geometry.
        // Reuse the original lamp coefficients and update lazily for visible faces.
        if(object.environmentRevision!==environmentRevision){
          const outdoor=outdoorMesh(object.mesh,environment);
          for(const face of object.faces){
            face.outdoor=outdoor;if(!face.fixedLight)continue;
            const n=face.n,ambient=outdoor?environment.ambient:[.10,.13,.15];
            const sun=outdoor?Math.max(0,dot(n,environment.sunDirection)):Math.max(0,(-.45*n[0]+.85*n[1]+.35*n[2])/1.022)*.13;
            for(let k=0;k<3;k++)face.fixedLight[k]=ambient[k]*(.72+.28*Math.max(outdoor?0:-1,n[1]))+sun*(outdoor?environment.sunColor[k]:1);
            for(let i=0;i<face.fixedLampParts.length;i+=2){const light=face.fixedLampParts[i],power=face.fixedLampParts[i+1],color=light.color||[1,1,1];for(let k=0;k<3;k++)face.fixedLight[k]+=power*color[k];}
          }
          object.environmentRevision=environmentRevision;
        }
        stats.instances++;
        const phase=t*.85+object.p[0]*.37+object.p[2]*.21,bend=object.sway&&environment?environment.wind*.055:0;
        const vertices=object.vertices.map(v=>{if(!bend)return toCamera(v);const weight=Math.max(0,Math.min(1,(v[1]-object.p[1])/Math.max(.01,object.s[1])+.5));return toCamera([v[0]+Math.sin(phase)*bend*weight,v[1],v[2]+Math.cos(phase*.73)*bend*.6*weight]);});
        const projected=vertices.map(v=>v[2]>=near&&v[2]<=far?project(v):null);
        for(const face of object.faces){
          if(dot(face.n,subtract(eye,face.center))<=.00001)continue;
          let points=face.indices.map(i=>vertices[i]),clipped=false;
          if(points.every(v=>v[2]<near)||points.every(v=>v[2]>far))continue;
          if(points.some(v=>v[2]<near)){points=clip(points,near,true);clipped=true;}
          if(points.length<3)continue;
          if(points.some(v=>v[2]>far)){points=clip(points,far,false);clipped=true;}
          if(points.length<3)continue;
          const screen=clipped?points.map(project):face.indices.map(i=>projected[i]);
          if(screen.every(v=>v[0]<-2)||screen.every(v=>v[0]>width+2)||screen.every(v=>v[1]<-2)||screen.every(v=>v[1]>height+2))continue;
          const depth=points.reduce((sum,v)=>sum+v[2],0)/points.length;
          (face.overlay?overlays:face.ground?grounds:faces).push({face,screen,depth,bounds:screenBounds(screen)});
        }
      }
      const ranges=detailRanges(quality,true),tiers=[[],[],[]];if(environment)ranges[0]=far;let staticVisible=0;
      for(const e of world.query(eye,ranges))if(visible(e,eye,axes,horizontal,tan,far)){
        const delta=subtract(e.p,eye),distance=Math.hypot(...delta),pixelRadius=e.radius*focal/Math.max(.2,dot(delta,forward));
        if(e.detail>0&&pixelRadius<(e.detail===2?2.1:1.0))continue;
        tiers[e.detail].push({e,pixelRadius,score:distance/(1+Math.min(e.radius,3)*.32)});
      }
      const budget=quality==='low'?[Infinity,80,0]:quality==='high'?[Infinity,360,120]:[Infinity,170,45];
      for(let level=0;level<3;level++){
        if(level)tiers[level].sort((a,b)=>a.score-b.score);
        for(const {e,pixelRadius} of tiers[level].slice(0,budget[level])){
          const key=quality!=='high'&&(quality==='low'||pixelRadius<75)?'softwareCoarse':'software';
          if(!e[key])e[key]=cache(e.mesh,true,key==='softwareCoarse');collect(e[key]);staticVisible++;
        }
      }
      stats.staticVisible=staticVisible;stats.staticCulled=world.entries.length-staticVisible;
      for(const mesh of dynamic||[]){
        const p=mesh.p||[0,0,0],radius=Math.hypot(...(mesh.s||[1,1,1]))*.5;
        if(inView(p,radius)){const pixelRadius=radius*focal/Math.max(.2,dot(subtract(p,eye),forward)),coarse=!mesh.overlay&&quality!=='high'&&(quality==='low'||pixelRadius<28);collect(cache(mesh,false,coarse,true));}
      }
      const receivers=new Map(),regionPlanes=new Map();
      for(const item of grounds){
        const {face,bounds}=item,key=face.n.map(v=>Math.round(v*10000)).join(',')+','+Math.round(face.plane*10000)+','+face.outdoor;
        let receiver=receivers.get(key);
        if(!receiver){receiver={n:face.n,plane:face.plane,outdoor:face.outdoor,items:[],shadows:[],bounds:bounds.slice(),regions:new Set()};receivers.set(key,receiver);}
        receiver.items.push(item);item.receiver=receiver;
        if(face.region){
          receiver.regions.add(face.region);if(!regionPlanes.has(face.region))regionPlanes.set(face.region,new Set());
          regionPlanes.get(face.region).add(face.n.map(v=>Math.round(v*1000)).join(',')+','+Math.round(face.plane*10));
        }
        for(let i=0;i<4;i++)receiver.bounds[i]=i<2?Math.min(receiver.bounds[i],bounds[i]):Math.max(receiver.bounds[i],bounds[i]);
      }
      if(receivers.size&&(nearest.length||environment)&&quality!=='low'&&fx.shadows!==false){
        const candidates=staticCasters(eye).concat((dynamic||[]).filter(m=>!m.overlay&&shadowCaster(m)))
          .sort((a,b)=>Math.hypot(a.p[0]-eye[0],a.p[2]-eye[2])-Math.hypot(b.p[0]-eye[0],b.p[2]-eye[2])).slice(0,environment?28:18);
        const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
        const casters=[];
        for(const m of candidates){
          const outdoor=outdoorMesh(m,environment),vertices=[];
          // Only setWorld geometry is immutable; reused dynamic meshes may have moved.
          let object=shadowGeometry.get(m);if(!object){object=cache(m,false,true);if(shadowGeometry.has(m))shadowGeometry.set(m,object);}
          const phase=t*.85+object.p[0]*.37+object.p[2]*.21,bend=object.sway&&environment?environment.wind*.055:0;
          for(const [x,py,z] of object.vertices){
            const weight=Math.max(0,Math.min(1,(py-object.p[1])/Math.max(.01,object.s[1])+.5)),px=x+Math.sin(phase)*bend*weight,pz=z+Math.cos(phase*.73)*bend*.6*weight;
            vertices.push([px,py,pz]);
          }
          casters.push({outdoor,vertices,opacity:opaqueOpacity(m),heightLimit:m.actorScale>1?44:16});
        }
        for(const receiver of receivers.values()){
          const {n,plane,outdoor}=receiver,sun=environment&&environment.sunDirection,lamp=outdoor?null:nearest.find(light=>dot(n,light.p)-plane>1.2),sunHeight=sun?dot(n,sun):0;
          if(outdoor?sunHeight<=.05:!lamp)continue;
          const sourceHeight=lamp?dot(n,lamp.p)-plane:0;
          for(const caster of casters){
            if(caster.outdoor!==outdoor)continue;
            const heights=caster.vertices.map(v=>dot(n,v)-plane),top=Math.max(...heights);
            if(top<.025||(outdoor?top>caster.heightLimit:top>=sourceHeight-.15))continue;
            const vertices=[];
            for(let i=0;i<caster.vertices.length;i++){
              if(heights[i]<-.025)continue;
              const v=caster.vertices[i],height=heights[i];
              if(outdoor){const amount=height/sunHeight;vertices.push(v.map((x,k)=>x-sun[k]*amount));}
              else{const amount=sourceHeight/(sourceHeight-height);if(amount<=7)vertices.push(v.map((x,k)=>lamp.p[k]+(x-lamp.p[k])*amount));}
            }
            if(vertices.length<3)continue;
            vertices.sort((a,b)=>a[0]-b[0]||a[2]-b[2]);const hull=[];
            for(const v of vertices){while(hull.length>1&&cross(hull[hull.length-2],hull[hull.length-1],v)<=0)hull.pop();hull.push(v);}
            const lower=hull.length;for(let i=vertices.length-2;i>=0;i--){const v=vertices[i];while(hull.length>lower&&cross(hull[hull.length-2],hull[hull.length-1],v)<=0)hull.pop();hull.push(v);}hull.pop();
            const polygon=projectPolygon(hull);if(polygon.length>2){const bounds=screenBounds(polygon);if(overlap(bounds,receiver.bounds))receiver.shadows.push({polygon,bounds,opacity:caster.opacity});}
          }
        }
      }
      stats.shadows=Array.from(receivers.values()).some(receiver=>receiver.shadows.length);stats.shadowMode='projected';
      ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle='#14252e';ctx.fillRect(0,0,width,height);
      if(environment)softwareSky(ctx,width,height,axes,tan,environment,t);
      function shade(face){
        const n=face.n,toEye=subtract(eye,face.center),distance=Math.hypot(...toEye)||.001;
        const lit=face.fixedLight?face.fixedLight.slice():(face.outdoor?environment.ambient:[.10,.13,.15]).map(c=>c*(.72+.28*Math.max(face.outdoor?0:-1,n[1])));
        // Dim real local lamp contributions, never a painted dark patch or the
        // sky/torch/emergency emission. Cached light components stay reusable.
        if(blackout&&face.fixedLampParts&&!face.overlay&&!face.fxHazard)for(let i=0;i<face.fixedLampParts.length;i+=2){
          const light=face.fixedLampParts[i],drop=1-(blackout.get(light)??1),color=light.color||[1,1,1];
          if(drop)for(let k=0;k<3;k++)lit[k]-=face.fixedLampParts[i+1]*color[k]*drop;
        }
        const sun=face.outdoor?Math.max(0,dot(n,environment.sunDirection)):Math.max(0,(-.45*n[0]+.85*n[1]+.35*n[2])/1.022)*.13;
        const head=Math.max(0,dot(n,toEye)/distance)*.35/(1+distance*distance*.035);
        for(let k=0;k<3;k++)lit[k]+=(face.fixedLight?0:sun*(face.outdoor?environment.sunColor[k]:1))+head*(k===0?.8:1)+(face.overlay?.2:0)+(fx.flash||0)*.65/(1+distance*distance*.14);
        for(const light of face.fixedLight?[]:nearest){
          const l=subtract(light.p,face.center),d2=dot(l,l),d=Math.sqrt(d2)||.001;
          const factor=!face.overlay&&!face.fxHazard?blackout?.get(light)??1:1;
          const power=(light.power===undefined?1:light.power)*factor*.24/(1+d2*.26)*(Math.max(0,dot(n,l)/d)+.065),color=light.color||[1,1,1];
          for(let k=0;k<3;k++)lit[k]+=power*color[k];
        }
        for(const light of transient){
          const dx=light.p[0]-face.center[0],dy=light.p[1]-face.center[1],dz=light.p[2]-face.center[2],d2=dx*dx+dy*dy+dz*dz;
          if(d2>=light.range*light.range)continue;
          const d=Math.sqrt(d2)||.001,q=Math.max(0,Math.min(1,(d/light.range-.35)/.65)),falloff=1-q*q*(3-2*q);
          const power=light.power*.24*falloff/(1+d2*.26)*(Math.max(0,(n[0]*dx+n[1]*dy+n[2]*dz)/d)+.035);
          for(let k=0;k<3;k++)lit[k]+=power*light.color[k];
        }
        let reflection=null;
        if(face.mat<3||face.mat===12){
          const nv=Math.max(0,dot(n,toEye)/distance),ry=-toEye[1]/distance+2*nv*n[1],roughness=[.48,.60,.35][face.mat]||.13;
          const skyMix=Math.max(0,Math.min(1,ry)),hemisphere=Math.max(0,Math.min(1,(ry+.45)/1.2));
          const strength=(.04+.35*(1-nv)**5)*(.45+.8*(1-roughness));
          reflection=[0,1,2].map(k=>{
            const sky=face.outdoor?environment.skyBottom[k]*(1-skyMix)+environment.skyTop[k]*skyMix:[.18,.24,.27][k];
            const ground=face.outdoor?environment.ambient[k]*.2:[.02,.03,.035][k];
            return (ground*(1-hemisphere)+sky*hemisphere)*strength;
          });
        }
        const fog=face.overlay?0:Math.min(.9,1-Math.exp(-distance*(face.outdoor?environment.fogDensity:.027))),fogColor=face.outdoor?environment.fog:[.009,.018,.024];
        const rgb=lit.map((value,k)=>{
          let color=face.color[k]*(value*face.grain+face.emission*1.55*(.94+.06*Math.sin(t*2.2+face.center[1]*3)));
          if(reflection)color+=reflection[k];
          if(face.fxFire)color*=.72+.28*Math.sin(face.center[0]*5.3+face.center[1]*7.1-face.center[2]*3.7-t*11.);
          color=color*(1-fog)+fogColor[k]*fog;
          return Math.round(Math.pow(Math.max(0,color)/(Math.max(0,color)+.76),.4545)*255);
        });
        return 'rgb('+rgb.join(',')+')';
      }
      function line(a,b){
        let va=toCamera(a),vb=toCamera(b);
        if((va[2]<near&&vb[2]<near)||(va[2]>far&&vb[2]>far))return;
        for(const depth of [near,far]){
          const aInside=depth===near?va[2]>=depth:va[2]<=depth,bInside=depth===near?vb[2]>=depth:vb[2]<=depth;
          if(aInside!==bInside){const fraction=(depth-va[2])/(vb[2]-va[2]),hit=va.map((x,k)=>x+(vb[k]-x)*fraction);if(!aInside)va=hit;else vb=hit;}
        }
        const a2=project(va),b2=project(vb);ctx.moveTo(...a2);ctx.lineTo(...b2);
      }
      function polygonPath(points){ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();}
      function maskGround(item){
        let saved=false;
        // Large ground polygons must still be painted first (their mean depth
        // can lie in front of a nearby actor). Mask only the part of a later
        // face behind a visible receiver plane, within that finite floor. This
        // gives terraces/ramps real occlusion without inverting the base floor.
        for(const receiver of receivers.values()){
          if(receiver===item.receiver||!overlap(item.bounds,receiver.bounds))continue;
          // Dressing built onto one floor already shares its elevation. Avoid
          // hundreds of clips for embedded roots/stone and thin trail inlays.
          // Multi-level regions (lift shafts) keep full plane occlusion.
          if(item.face.fixedLight&&item.face.region&&regionPlanes.get(item.face.region)?.size===1&&receiver.regions.has(item.face.region))continue;
          const distances=item.face.points.map(p=>dot(receiver.n,p)-receiver.plane);
          if(Math.min(...distances)>=-.002)continue;
          const crossing=Math.max(...distances)>-.002,eyeFloor=dot(receiver.n,eye)-receiver.plane,eyeFace=dot(item.face.n,eye)-item.face.plane;
          // On this face, the intersection of the two 3D planes is a screen
          // line. Extend that line across the receiver instead of clipping at
          // actor edges, where antialiased clip boundaries would leave a halo.
          const separator=crossing?item.face.n.map((v,k)=>v*eyeFloor-receiver.n[k]*eyeFace):null;
          const a=crossing?dot(separator,right)/focal:0,b=crossing?-dot(separator,up)/focal:0,c=crossing?dot(separator,forward)-a*width*.5-b*height*.5:0;
          for(const ground of receiver.items){
            if(!overlap(item.bounds,ground.bounds))continue;
            const hidden=crossing?clipScreenLine(ground.screen,a,b,c):ground.screen;if(hidden.length<3)continue;
            if(!saved){ctx.save();saved=true;}
            ctx.beginPath();ctx.rect(0,0,width,height);polygonPath(hidden);ctx.clip('evenodd');
          }
        }
        return saved;
      }
      function paint(list){
        list.sort((a,b)=>a.face.ground&&b.face.ground&&dot(a.face.n,b.face.n)>.99999&&Math.abs(a.face.plane-b.face.plane)<.05?a.face.plane-b.face.plane:b.depth-a.depth);
        for(const item of list){
          const {face,screen,depth}=item,masked=!face.overlay&&maskGround(item);ctx.beginPath();polygonPath(screen);
          if(face.fx){const v=subtract(eye,face.center);ctx.globalAlpha=face.alpha*(face.fxHazard?1:Math.pow(Math.max(0,dot(face.n,v)/(Math.hypot(...v)||1)),.65));}else ctx.globalAlpha=face.opacity;
          ctx.fillStyle=shade(face);ctx.fill();if(face.fx)ctx.globalAlpha=1;stats.drawCalls++;stats.triangles+=screen.length-2;
          if(item.receiver&&item.receiver.shadows.length){
            ctx.save();ctx.clip();ctx.fillStyle=face.outdoor?'rgba(5,18,23,.27)':'rgba(0,7,11,.24)';
            for(const {polygon,bounds,opacity} of item.receiver.shadows)if(overlap(bounds,item.bounds)){ctx.globalAlpha=face.opacity*opacity;ctx.beginPath();polygonPath(polygon);ctx.fill();}ctx.restore();
          }
          // The seams are projected from positions on the actual face, not screen-space stripes.
          // Do not outline individual mesh faces: that reveals triangulation instead of material detail.
          if(face.mat<4&&face.lines.length&&depth<18){
            ctx.beginPath();for(const segment of face.lines)line(segment[0],segment[1]);ctx.strokeStyle=face.ground?'rgba(2,7,10,.22)':'rgba(2,7,10,.32)';ctx.lineWidth=face.ground?.65:1.0;ctx.stroke();
            if(!face.ground&&quality!=='low'&&depth<10){ctx.strokeStyle='rgba(128,180,176,.14)';ctx.lineWidth=.35;ctx.stroke();}
          }
          ctx.globalAlpha=1;if(masked)ctx.restore();
        }
      }
      paint(grounds);paint(faces);paint(overlays);
      ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
      if(fx.damage>0){ctx.fillStyle='rgba(190,12,2,'+Math.min(.3,fx.damage*.22)+')';ctx.fillRect(0,0,width,height);}
      if(fx.pulse>0){
        const strength=Math.min(1,fx.pulse),radius=(1-strength)*height*.8;
        ctx.beginPath();ctx.arc(width*.5,height*.5,Math.max(1,radius),0,Math.PI*2);ctx.strokeStyle='rgba(82,248,216,'+(strength*.35)+')';ctx.lineWidth=height*.018;ctx.stroke();
      }
    }
    function shadowCaster(m){
      if(opaqueOpacity(m)===0)return false;
      const s=m.s||[1,1,1],mat=m.mat||0,limit=m.actorPart&&m.actorScale>1?44:10;
      // RADE / BITUME : les carènes libres et le coin projettent des ombres.
      if(FORMES_LIBRES.has(m.shape)||m.shape==='wedge')return !m.fx&&Math.max(s[0],s[2])>.45&&s[1]>.2;
      return !m.fx&&(m.shape==='box'||m.shape==='bevel'||m.shape==='cylinder'||m.shape==='sphere'||m.shape==='foliage'||m.shape==='octa')&&s[0]>.45&&s[2]>.45&&s[1]>.4&&s[0]<limit&&s[2]<limit&&(mat<4||mat>7);
    }
    function staticCasters(eye){
      if(staticCasterPlan&&eye.every((v,k)=>v===staticCasterPlan.eye[k]))return staticCasterPlan.meshes;
      const meshes=world.query(eye,[environment?25:13,13,0]).map(e=>e.mesh).filter(shadowCaster)
        .sort((a,b)=>Math.hypot(a.p[0]-eye[0],a.p[2]-eye[2])-Math.hypot(b.p[0]-eye[0],b.p[2]-eye[2])).slice(0,environment?28:18);
      staticCasterPlan={eye:eye.slice(),meshes};return meshes;
    }
    // Dynamic casters can only lower the last selected static caster's distance.
    // Reject an offscreen actor only when its ENTIRE sphere is beyond that
    // bound; the exact original 18/28-caster set and stable ordering survive.
    // Sparse scenes retain every actor that might enter that shadow ranking.
    function actorFilter(camera,fx={}){
      stats.actorsConsidered=stats.actorsCulled=0;
      if(disposed)return ()=>true;
      const t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0],axes=cameraAxes(camera);
      const eye=[p[0]+Math.sin(t*57)*shake*.025,p[1]+Math.sin(t*71)*shake*.015,p[2]];
      const cssWidth=canvas.clientWidth||window.innerWidth||800,cssHeight=canvas.clientHeight||window.innerHeight||600;
      const aspect=Math.max(canvas.width/Math.max(1,canvas.height),cssWidth/cssHeight)+(1+cssWidth/cssHeight)/Math.max(1,cssHeight*.3);
      const tangent=Math.tan(Math.max(FOV_MIN,Math.min(110,camera.fov||75))*Math.PI/360),horizontal=aspect*tangent;
      const far=softwareDistance(quality,environment,eye);
      const shadows=quality!=='low'&&fx.shadows!==false&&(lights.length||environment),casters=shadows?staticCasters(eye):[];
      const cutoff=!shadows?-Infinity:casters.length<(environment?28:18)?Infinity:Math.hypot(casters[casters.length-1].p[0]-eye[0],casters[casters.length-1].p[2]-eye[2]);
      stats.actorFilterMode=shadows?'camera-and-ranked-casters':'camera-frustum';stats.actorCasterDistance=cutoff;
      return (x,y,z,radius)=>{
        stats.actorsConsidered++;
        if(![x,y,z,radius].every(Number.isFinite)||radius<0)return true;
        const dx=x-eye[0],dy=y-eye[1],dz=z-eye[2],r=radius+.002,along=a=>dx*a[0]+dy*a[1]+dz*a[2],depth=along(axes.forward);
        const inView=!(depth+r<.065||depth-r>far||Math.abs(along(axes.right))>depth*horizontal+r*(1+horizontal)||Math.abs(along(axes.up))>depth*tangent+r*(1+tangent));
        if(inView||Math.hypot(dx,dz)-r<=cutoff+.002)return true;
        stats.actorsCulled++;return false;
      };
    }
    function dispose(){surface?.dispose();disposed=true;world=spatialIndex([]);lights=[];vignette=null;shadowGeometry=new WeakMap();staticCasterPlan=null;}
    // Rendu logiciel : aucun pipeline ni cible GPU à préparer ; mêmes signatures que WebGL 2, réponse immédiate.
    const prewarm=()=>Promise.resolve({variants:0,draws:0,drawCalls:0,triangles:0,lots:0,nappes:0,subsets:0,creations:0,bytes:0,keys:[],ms:0,submitMs:0,waitMs:0,fallback:'unsupported'});
    let retained=false;const retain=value=>value===undefined?retained:(retained=!!value);
    return {setEnvironment(value){environment=environmentInfo(value);environmentRevision++;},setWorld,updateWorld,draw,resize,dispose,stats,actorFilter,prewarm,retain,resetStats(){stats.creations=0;return stats;},precalculerOmbre:()=>null,setRenderScale:value=>surface?.setScale(value)};
  }

  // FERRO 0.2 : réglages de création, tous facultatifs. Sans eux, l'image et les commandes GPU sont celles de FERRO 0.1.
  // msaa: 4 ouvre l'anticrénelage (si le GPU l'offre) ; shadowMapScale: 2 autorise l'atlas d'ombre doublé ;
  // draw({msaa:true}) fonctionne aussi sans bloom et en qualité basse ; sans valeur explicite, le lien historique
  // au bloom est conservé. draw({shadows,shadowMapScale:1|2}) règle les ombres à chaud dans les capacités ouvertes.
  // vignette (0 à 1, FERRO 0,59) éclaircit les bords quand elle monte ; bloomThreshold [début, fin] (FERRO [0,56, 0,86]).
  // Le rendu logiciel (Canvas 2D) les ignore.
  // BITUME : adapter le contrat météo historique au vec4 EMPRISE [humidité, nuages, pluie, éclair].
  // Les tableaux restent stables : ni allocation par couleur, ni mutation de l’environnement de base.
  const weatherUnit=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0; // BITUME : borne partagée sans fermeture par image.
  function bitumeWeather(env,value,time,out){
    const base=env||PDR_INDOOR,w=value??[0,.4,0,0],unit=weatherUnit;
    out=out||{values:new Float32Array(4),skyTop:new Float32Array(3),skyBottom:new Float32Array(3),fog:new Float32Array(3),sunColor:new Float32Array(3),ambient:new Float32Array(3),cloudOffset:new Float32Array(2)};
    const vector=Array.isArray(w)||ArrayBuffer.isView(w),rain=unit(vector?w[2]:w.pluie),cloud=unit(vector?w[1]:w.nuage),flash=unit(vector?w[3]:w.eclair),wet=unit(vector?w[0]:(w.mouille??rain));
    out.values[0]=wet;out.values[1]=cloud;out.values[2]=rain;out.values[3]=flash;
    const shadeCloud=vector?0:cloud,shadeRain=vector?0:rain,shadeFlash=vector?0:flash,dim=1-shadeCloud*.42-shadeRain*.20;
    for(let i=0;i<3;i++){
      out.skyTop[i]=base.skyTop[i]*dim+shadeFlash*.20;out.skyBottom[i]=base.skyBottom[i]*(dim*.8+.2)+shadeFlash*.30;
      out.fog[i]=base.fog[i]*(1+shadeRain*.25)+shadeFlash*.15;
      out.sunColor[i]=base.sunColor[i]*(1-shadeCloud*.85)*(1-shadeRain*.4);out.ambient[i]=base.ambient[i]*(1-shadeCloud*.25)+shadeFlash*.40;
    }
    out.fogDensity=base.fogDensity*(1+shadeRain*.9+shadeCloud*.2);
    const vx=Number.isFinite(w.ventX)?w.ventX:0,vz=Number.isFinite(w.ventZ)?w.ventZ:0;
    out.wind=Math.min(2,(base.wind||0)*(1+shadeRain*.8)+Math.hypot(vx,vz)*.08);
    out.cloudOffset[0]=time*(.0018+vx*.00015);out.cloudOffset[1]=vector?0:time*(.0005+vz*.00015);
    return out;
  }
  function settings(options){
    const o=options||{},unit=(v,d)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):d;
    const bloom=Array.isArray(o.bloomThreshold)?[unit(o.bloomThreshold[0],.56),unit(o.bloomThreshold[1],.86)]:[.56,.86];
    // WebGPU 0.3.39 (LOT 0.3) : tonemap unique de post.wgsl (agx par défaut, aces, ou ferro = courbe de 0.3.38),
    // exposition relative à son calibrage, force du halo linéaire et tramage de sortie. WebGL2 ne lit pas ces réglages.
    const tonemap=['ferro','agx','aces'].includes(o.tonemap)?o.tonemap:'agx';
    return {reflections:o.reflections!==false,msaa:o.msaa===4, // BITUME : SSR optionnel ; aucune cible miroir par défaut.
      shadowMapScale:o.shadowMapScale===2?2:1,vignette:unit(o.vignette,.59),bloom:bloom[1]>bloom[0]?bloom:[.56,.86],
      tonemap,exposure:Number.isFinite(o.exposure)&&o.exposure>0?Math.min(16,o.exposure):1,
      bloomStrength:Number.isFinite(o.bloomStrength)?Math.max(0,Math.min(4,o.bloomStrength)):1,dither:o.dither!==false};
  }

  // FERRO 0.3.11 : shader du monde avec l'option ombresPhoto. Chaque ancre existe une seule fois dans FRAG ; sans
  // l'option, create garde FRAG tel quel (mêmes sources, même image : tests/ferro/renderer-ombres-photo.test.mjs).
  // Le bloc de la pénombre variable (PCSS) n'est compilé que si l'hôte le garde (ombresPhoto.pcss !== false) : sans
  // lui, le shader est plus court et fx.penombre 'pcss' vaut 'meteo'. Le reste ne calcule que ce qu'un effet allumé
  // demande : la tuile n'est projetée que si elle sert, le contact passe par une sphère qui englobe les voitures.
  function photoGlsl(pcss){
    return `
  // FERRO 0.3.11, option de création ombresPhoto (absente du shader par défaut) : contact analytique des voitures
  // (fx.contacts), carte lointaine précalculée (precalculerOmbre), tuile de la voiture filmée (fx.ombreProche) et
  // pénombre selon la distance et la météo (fx.penombre).
  uniform vec4 uContact[36];
  uniform int uContactCount;
  uniform vec4 uContactReglages;
  uniform vec4 uContactSphere;
  uniform highp sampler2D uOmbreTuile;
  uniform mat4 uOmbreTuileMatrice;
  uniform vec4 uOmbreTuileReglages;
  uniform vec4 uPhotoTileSphere;
  uniform highp sampler2DShadow uOmbreLoin;
  uniform mat4 uOmbreLoinMatrice;
  uniform vec4 uOmbreLoinReglages;${pcss?`
  uniform highp sampler2DShadow uOmbreComparee;`:''}
  uniform vec4 uPenombre;
  // Dans l'espace de la sphère unité, q est le point relatif au centre et m la normale transformée.
  float photoEllipsoideQ(vec3 q,vec3 m){
    float l2=dot(q,q),l=sqrt(l2);
    return clamp(max(dot(m,-q),0.)/(max(l2,1.)*max(l,.0001)),0.,1.);
  }
  // Voitures proches : six vec4 chacune (centre et force ; axe avant et demi-longueur ; axe haut et demi-hauteur ;
  // demi-largeur, hauteur du centre au-dessus du sol, essieux avant et arrière ; rayon, demi-voie et demi-largeur des
  // roues avant ; idem arrière). Caisse et quatre appuis, combinés en produit des parts de ciel libres. Hors de la
  // sphère qui englobe les portées de toutes les voitures (uContactSphere), le terme est nul : un seul test.
  float photoContact(vec3 p,vec3 n){
    vec3 e=p-uContactSphere.xyz;
    if(dot(e,e)>=uContactSphere.w*uContactSphere.w)return 0.;
    float libre=1.;
    for(int i=0;i<6;i++){
      if(i>=uContactCount)break;
      vec4 c0=uContact[i*6],c1=uContact[i*6+1];
      vec3 d=p-c0.xyz;float portee=c1.w+uContactReglages.w,d2=dot(d,d);
      if(d2>=portee*portee||c0.w<=0.)continue;
      vec4 c2=uContact[i*6+2],c3=uContact[i*6+3],c4=uContact[i*6+4],c5=uContact[i*6+5];
      vec3 ax=c1.xyz,ay=c2.xyz,az=cross(ax,ay);
      vec3 pointLocal=vec3(dot(d,ax),dot(d,ay),dot(d,az));
      vec3 normaleLocale=vec3(dot(n,ax),dot(n,ay),dot(n,az));
      vec3 caisse=vec3(c1.w,c2.w,c3.x);
      float reste=1.-photoEllipsoideQ(pointLocal/caisse,normalize(normaleLocale*caisse));
      // az est perpendiculaire aux deux axes fournis, qui peuvent avoir des longueurs et un angle quelconques.
      float xy=dot(ax,ay),zz=dot(az,az);
      vec2 axeAvant=vec2(dot(ax,ax),xy),axeHaut=vec2(xy,dot(ay,ay));
      for(int essieu=0;essieu<2;essieu++){
        vec4 roue=essieu==0?c4:c5;
        float recul=essieu==0?c3.z:c3.w;
        vec2 centre=(pointLocal.xy-recul*axeAvant+(c3.y-roue.x)*axeHaut)/roue.x;
        vec3 normalePneu=normalize(normaleLocale*roue.xxz);
        float voie=roue.y*zz;
        reste*=1.-photoEllipsoideQ(vec3(centre,(pointLocal.z+voie)/roue.z),normalePneu);
        reste*=1.-photoEllipsoideQ(vec3(centre,(pointLocal.z-voie)/roue.z),normalePneu);
      }
      libre*=1.-(1.-reste)*c0.w*(1.-smoothstep(portee*.7,portee,sqrt(d2)));
    }
    return 1.-libre;
  }
  vec2 photoPente(vec3 p){
    vec3 dx=dFdx(p),dy=dFdy(p);
    float determinant=dx.x*dy.y-dx.y*dy.x;
    return abs(determinant)>.00000000001?vec2(dx.z*dy.y-dy.z*dx.y,dy.z*dx.x-dx.z*dy.x)/determinant:vec2(0.);
  }
  // B-spline quadratique à neuf comparaisons, comme shadow() (plan du récepteur compris).
  float photoBspline(highp sampler2D carte,vec2 uv,float z,vec2 slope,float texel){
    vec2 cell=uv/texel,f=fract(cell)-.5,centre=(floor(cell)+.5)*texel;
    vec3 wx=vec3(.5*(.5-f.x)*(.5-f.x),.75-f.x*f.x,.5*(.5+f.x)*(.5+f.x));
    vec3 wy=vec3(.5*(.5-f.y)*(.5-f.y),.75-f.y*f.y,.5*(.5+f.y)*(.5+f.y));
    float v=0.;
    for(int y=0;y<3;y++)for(int x=0;x<3;x++){
      vec2 tap=centre+vec2(float(x-1),float(y-1))*texel;
      v+=wx[x]*wy[y]*step(z+dot(slope,tap-uv),texture(carte,tap).r);
    }
    return v;
  }${pcss?`
  // PCSS allégé : les neuf lectures fines de la B-spline donnent aussi la moyenne des bloqueurs (pesée comme elle,
  // continue d'un texel à l'autre) ; quatre lectures de recherche au rayon maximal, motif fixe (aucun bruit, rien ne
  // varie d'une image à l'autre) ; puis la même B-spline sur une grille de pas égal au rayon de pénombre, en
  // comparaisons filtrées par le matériel. Fondu avec le filtre fin entre 1,25 et 2 texels de rayon. La grille large
  // est accrochée au monde (repère du soleil, en texels), pas à l'origine de l'atlas qui suit la caméra : quand le
  // carré avance d'un texel, chaque lecture garde sa place autour du point reçu. Les quatre lectures de recherche
  // partent de uvS, le point reçu sans le bruit de calcul de la matrice du carré (décalage entier de texels arrondi),
  // qui ne change plus de texel d'une image à l'autre.
  float photoPcss(vec2 uv,vec2 centre,vec3 wx,vec3 wy,float z,vec2 slope,float texel,float pz,vec3 n){
    float v=0.,zb=0.,nb=0.;
    for(int y=0;y<3;y++)for(int x=0;x<3;x++){
      vec2 tap=centre+vec2(float(x-1),float(y-1))*texel;
      float ref=z+dot(slope,tap-uv),d=texture(uShadowMap,tap).r,w=wx[x]*wy[y];
      v+=w*step(ref,d);
      if(d<ref){zb+=w*d;nb+=w;}
    }
    float r=uPenombre.z*texel*.7071;
    vec2 g=(mat3(uShadowMatrix[1])*(vWorld+n*.014)).xy*(.5/texel),uvS=(g+floor(uv/texel-g+.5))*texel;
    for(int k=0;k<4;k++){
      vec2 o=vec2(k==0||k==3?r:-r,k<2?r:-r);
      float ref=z+dot(slope,o),d=texture(uShadowMap,uvS+o).r;
      if(d<ref){zb+=.25*d;nb+=.25;}
    }
    if(nb>0.){
      float rayon=clamp((pz-zb/nb)*uPenombre.y*(1.+2.*clamp(uWeather.y,0.,1.)),1.,uPenombre.z);
      if(rayon>1.25){
        float large=0.,marge=.00006*rayon;
        vec2 vc=g/rayon,vf=fract(vc)-.5,vcentre=(floor(vc)+.5)*rayon;
        vec3 ux=vec3(.5*(.5-vf.x)*(.5-vf.x),.75-vf.x*vf.x,.5*(.5+vf.x)*(.5+vf.x));
        vec3 uy=vec3(.5*(.5-vf.y)*(.5-vf.y),.75-vf.y*vf.y,.5*(.5+vf.y)*(.5+vf.y));
        for(int y=0;y<3;y++)for(int x=0;x<3;x++){
          vec2 tap=uvS+(vcentre+vec2(float(x-1),float(y-1))*rayon-g)*texel;
          large+=ux[x]*uy[y]*texture(uOmbreComparee,vec3(tap,z-marge+dot(slope,tap-uv)));
        }
        v=mix(v,large,smoothstep(1.25,2.,rayon));
      }
    }
    return v;
  }`:''}
  // Soleil avec l'option : carré proche (B-spline de shadow, élargi par PCSS en Fine), carte lointaine hors du carré
  // et dans sa bande de bord, tuile de la voiture filmée, plancher selon la couverture nuageuse.
  float photoSoleil(vec3 n,vec3 l){
    if(vOverlay>.5&&uOverlayMode<.5)return 1.;
    // Sans soleil dans l'atlas (w = 0 : ombres coupées ou sans environnement), shadow() d'origine, à l'identique.
    if(uShadowSettings.w<.5)return shadow(n,l,1);
    float nl=max(dot(n,l),0.);
    // Projection et pente avant tout branchement non uniforme : les dérivées y restent définies.
    vec4 projected=uShadowMatrix[1]*vec4(vWorld+n*.014,1.);
    vec3 p=projected.xyz/projected.w*.5+.5;
    vec2 slope=photoPente(p)*(uShadowSettings.w>1.5?1.:2.);
    float proche=1.,poids=0.;
    if(!(projected.w<=0.||p.z<=0.||p.z>=1.||min(p.x,p.y)<=.001||max(p.x,p.y)>=.999)){
      bool full=uShadowSettings.w>1.5;
      float texel=uShadowSettings.y,z=p.z-(.00014+.00024*(1.-nl));
      vec2 uv=full?p.xy:p.xy*.5+vec2(.5,0.);
      vec2 cell=uv/texel,f=fract(cell)-.5,centre=(floor(cell)+.5)*texel;
      vec3 wx=vec3(.5*(.5-f.x)*(.5-f.x),.75-f.x*f.x,.5*(.5+f.x)*(.5+f.x));
      vec3 wy=vec3(.5*(.5-f.y)*(.5-f.y),.75-f.y*f.y,.5*(.5+f.y)*(.5+f.y));
      float fovea=foveaEccentricity();
      float v=0.;
      if(fovea>.42){
        v=step(z,texture(uShadowMap,uv).r);
      }else{${pcss?`
      if(uPenombre.x>1.5&&full)v=photoPcss(uv,centre,wx,wy,z,slope,texel,p.z,n);
      else`:''}
        for(int y=0;y<3;y++)for(int x=0;x<3;x++){
          vec2 tap=centre+vec2(float(x-1),float(y-1))*texel;
          v+=wx[x]*wy[y]*step(z+dot(slope,tap-uv),texture(uShadowMap,tap).r);
        }
      }
      float edge=min(min(p.x,p.y),min(1.-p.x,1.-p.y));
      proche=v;poids=smoothstep(.012,.085,edge);
    }
    float loin=1.;
    if(uOmbreLoinReglages.x>.5&&poids<.999){
      vec3 q=(uOmbreLoinMatrice*vec4(vWorld+n*uOmbreLoinReglages.w,1.)).xyz*.5+.5;
      if(q.z<1.&&min(q.x,q.y)>0.&&max(q.x,q.y)<1.){
        float tl=uOmbreLoinReglages.y*.5,zl=q.z-uOmbreLoinReglages.z*(1.+(1.-nl));
        float foveaLoin=foveaEccentricity();
        float a=foveaLoin>.65?texture(uOmbreLoin,vec3(q.xy,zl))*4.:texture(uOmbreLoin,vec3(q.xy+vec2(-tl,-tl),zl))+texture(uOmbreLoin,vec3(q.xy+vec2(tl,-tl),zl))
          +texture(uOmbreLoin,vec3(q.xy+vec2(-tl,tl),zl))+texture(uOmbreLoin,vec3(q.xy+vec2(tl,tl),zl));
        float bord=min(min(q.x,q.y),min(1.-q.x,1.-q.y));
        loin=mix(1.,a*.25,smoothstep(0.,.02,bord));
      }
    }
    float v=mix(loin,proche,poids);
    if(uOmbreTuileReglages.x>.5 && v>0.){
      vec3 receiver=vWorld+n*uOmbreTuileReglages.w;
      vec3 deltaTile=receiver-uPhotoTileSphere.xyz;
      if(uPhotoTileSphere.w<0. || dot(deltaTile,deltaTile)<=uPhotoTileSphere.w){
        vec3 t=(uOmbreTuileMatrice*vec4(receiver,1.)).xyz*.5+.5;
        if(t.z>0.&&t.z<1.&&min(t.x,t.y)>0.&&max(t.x,t.y)<1.){
          // Tuile tracée par les faces arrière : une face éclairée est loin de la profondeur gardée, un biais constant
          // suffit ; sans plan du récepteur, dont les dérivées s'affolent sur les petites pièces courbes de l'habitacle.
          float vt=photoBspline(uOmbreTuile,t.xy,t.z-(.0005+.0012*(1.-nl)),vec2(0.),uOmbreTuileReglages.y);
          float bord=min(min(t.x,t.y),min(1.-t.x,1.-t.y));
          v*=mix(1.,vt,smoothstep(0.,uOmbreTuileReglages.z,bord));
        }
      }
    }
    float plancher=uPenombre.x>.5?mix(.055,.45,smoothstep(.25,.9,clamp(uWeather.y,0.,1.))):.055;
    return mix(plancher,1.,v);
  }
`;
  }
  // Nombre fini ou valeur par défaut : défini une fois pour le module, aucune fermeture créée à l'image (photoBind).
  const photoNum=(v,d)=>Number.isFinite(v)?v:d;
  function photoFragment(source,pcss){
    const once=(text,anchor,replacement)=>{
      const at=text.indexOf(anchor);if(at<0||text.indexOf(anchor,at+anchor.length)>=0)throw new Error('ombresPhoto : ancre introuvable ou double : '+anchor);
      return text.slice(0,at)+replacement+text.slice(at+anchor.length);
    };
    source=once(source,'  void main() {\n    groundCoverDiscard();',photoGlsl(pcss)+'  void main() {\n    groundCoverDiscard();');
    source=once(source,'    if(recipe>4.5)light*=cavity;\n','    if(recipe>4.5)light*=cavity;\n    float contactOcc=uContactCount>0&&vObject<.5&&vOverlay<.5?photoContact(vWorld,geometricNormal):0.;\n    light*=1.-uContactReglages.x*contactOcc;\n');
    source=once(source,'    float sunlight=outdoors>.5?shadow(geometricNormal,uSunDirection,1):0.;\n','    float sunlight=outdoors>.5?photoSoleil(geometricNormal,uSunDirection):0.;\n    if(contactOcc>0.)sunlight*=1.-uContactReglages.y*pow(contactOcc,uContactReglages.z);\n');
    source=once(source,'    environmentReflection=mix(environmentReflection,uAmbient*.85,roughness*roughness*.8);\n','    environmentReflection=mix(environmentReflection,uAmbient*.85,roughness*roughness*.8);\n    environmentReflection*=1.-uContactReglages.x*contactOcc;\n');
    return source;
  }
  const glslFloat=v=>v.toFixed(4);
  function worldFragment(config){
    return config.vignette===.59?FRAG:FRAG.replace('color*=mix(.59,1.,vignette);',`color*=mix(${glslFloat(config.vignette)},1.,vignette);`);
  }
  function postFragment(config){
    const [a,b]=config.bloom;
    return a===.56&&b===.86?POST_FRAG:POST_FRAG.replace('smoothstep(.56,.86,max(max(c.r,c.g),c.b))',`smoothstep(${glslFloat(a)},${glslFloat(b)},max(max(c.r,c.g),c.b))`);
  }
  function create(canvas,options={}) {
    options=options||{};
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'});
    if(!gl) return createSoftware(canvas,options);
    // BITUME : garder MSAA 4 et l’atlas solaire 4096/2048 du jeu ; options explicites prioritaires.
    // Marges du cache de vue : 'auto' (défaut) suit la vitesse, un objet {distance,angle}
    // les fixe (en mètres et en radians), 0 force un culling exact reconstruit à chaque image.
    const marginOption=options.cullMargin===undefined?'auto':options.cullMargin;
    const exactMargin=marginOption===0,fixedMargin=marginOption&&typeof marginOption==='object'?marginOption:null;
    const motion={time:null,x:0,y:0,z:0,fx:0,fy:0,fz:0,speed:0,turn:0};
    function trackMotion(eye,forward,time){
      const dt=motion.time===null?0:Math.max(0,Math.min(.1,time-motion.time));
      motion.time=time;
      if(dt>0){
        const speed=Math.hypot(eye[0]-motion.x,eye[1]-motion.y,eye[2]-motion.z)/dt;
        const cosine=Math.max(-1,Math.min(1,forward[0]*motion.fx+forward[1]*motion.fy+forward[2]*motion.fz));
        const turn=Math.acos(cosine)/dt,blend=1-Math.exp(-dt/.25);
        motion.speed+=(speed-motion.speed)*blend;motion.turn+=(turn-motion.turn)*blend;
      }
      motion.x=eye[0];motion.y=eye[1];motion.z=eye[2];motion.fx=forward[0];motion.fy=forward[1];motion.fz=forward[2];
    }
    // out est réécrit sur place (marge de la vue courante ou du préchauffage) : aucun objet par image.
    function margins(demiDiag,out){
      if(exactMargin){out.distance=0;out.tilt=0;return out;}
      if(fixedMargin){out.distance=Number.isFinite(fixedMargin.distance)?fixedMargin.distance:VIEW_MARGIN;out.tilt=Number.isFinite(fixedMargin.angle)?fixedMargin.angle:VIEW_TILT;return out;}
      const distance=Math.max(1,Math.min(16,motion.speed*.15)),tilt=Math.min(demiDiag*.5,Math.max(4*Math.PI/180,Math.min(12*Math.PI/180,motion.turn*.1)));
      out.distance=distance;out.tilt=tilt;return out;
    }
    const config=settings(options.sceneReflections?{...options,msaa:0}:options),worldFrag=options.ombresPhoto?photoFragment(worldFragment(config),options.ombresPhoto.pcss!==false):worldFragment(config),postFrag=postFragment(config);
    const source=geometry(),primitiveIndex=indexPrimitiveVertices(source,options.indexRegisteredShapes===true),groundIndex=groundCoverGeometry(source,primitiveIndex.indices),view=new Float32Array(16),projection=new Float32Array(16),vp=new Float32Array(16),overlayProjection=new Float32Array(16),overlayVP=new Float32Array(16);
    const shadowView=new Float32Array(16),shadowProjection=new Float32Array(16),shadowMatrix=new Float32Array(16),shadowMatrices=new Float32Array(48);
    const lightPositions=new Float32Array(36),lightColors=new Float32Array(36),lightRanges=new Float32Array(12),lightDirections=new Float32Array(36),lightCones=new Float32Array(24);
    // BITUME : l’indexation EMPRISE est aussi utilisée sur WebGL2 ; formes libres inchangées.
    const stats={drawCalls:0,triangles:0,instances:0,contextLost:false,webglVersion:2,backend:'webgl2',engine:'ferro-reference',bloom:false,shadows:false,shadowMapSize:0,shadowTileSize:0,msaa:0,reflections:false,primitiveIndex:primitiveIndex.stats,groundCoverIndex:groundIndex.stats,creations:0};
    // Preuve d'une course sans allocation : stats.creations cumule les objets GL (cibles, tampons, programmes)
    // et les agrandissements de flux d'instances faits pendant draw. Le préchauffage compte à part (warm.creations).
    // retained suspend la libération des cibles optionnelles après 120 rendus sans usage (retain, prewarm).
    let counting=false,retained=false,warm=null;
    function created(n){if(counting)stats.creations+=n;else if(warm)warm.creations+=n;}
    let program,depthProgram,postProgram,skyProgram,fxProgram,vao,postVao,vbo,ibo,worldBuffer,dynamicBuffer,overlayBuffer,fxBuffer,crowdBuffer,uniforms,postUniforms,skyUniforms,fxUniforms,depthMatrix,depthWind,depthLocalWind,ssrProgram,ssrUniforms;
    let post=null,msaaBuffer,msaaIdle=0,shadowTarget=null,shadowIdle=0,maxShadowTileSize=1024,whiteTexture=null,pbrTextures=[],targetKey='',shadowKey='',shadowLight=null;
    let world=[],worldIndex=spatialIndex([]),backgroundIndex=spatialIndex([]),lights=[],environment=null,worldBatch=pack([]),quality='auto',disposed=false,worldRevision=0,partitionState=null;
    let staticCaches=[],lampCasters=[],actorLightPlan=null,dynamicStream=null,overlayStream=null,fxStream=null;
    const cameraRelativeOverlay=options.cameraRelativeOverlay===true;
    const relativeView=new Float32Array(16),relativeTile=new Float32Array(16);
    const overlayVertex=src=>cameraRelativeOverlay?src.replace('precision highp float;','precision highp float;\n#define CAMERA_RELATIVE_OVERLAY\nuniform vec3 uDrawOrigin;'):src;
    const packDynamic=instancePacker(),packOverlay=instancePacker(),packFx=effectsPacker();

    // FERRO 0.3.11 (ombresPhoto) : rien de ceci ne fait d'appel GL sans l'option. photoTile : tuile de la voiture filmée
    // (créée à l'initialisation, jamais en course) ; photoFar : carte lointaine (precalculerOmbre, au chargement) ;
    // photoDepth : profondeur 1 × 1 liée aux échantillonneurs de comparaison inactifs ; photoSampler : comparaison filtrée.
    const photo=!!options.ombresPhoto,photoTileSize=photo&&options.ombresPhoto.tuile===512?512:photo?1024:0,photoPcssOn=photo&&options.ombresPhoto.pcss!==false;
    let depthDrawOrigin=null,photoUniforms=null,photoSampler=null,photoDepth=null,photoTile=null,photoFar=null,photoFarRequest=null,photoSplit=false,photoOverlay=null;
    let photoSunRange=1,photoSunTexel=1,photoTileExtent=3.5;
    const photoTileSphere=new Float32Array(4);
    const photoTileMatrix=new Float32Array(16),photoFarMatrix=new Float32Array(16),photoMatrix=new Float32Array(16),photoProjection=new Float32Array(16);
    const cullSun=options.cullRigidSunCasters===true;
    const rigidShapes=cullSun||options.cullRigidOverlay?rigidOverlayView(source):null,overlayView=options.cullRigidOverlay?rigidShapes:null;
    const sunCasters={groups:[]},sunCasterRecords=[];
    const packSplitOverlay=photo&&overlayView?splitPacker():null;
    const packSplit=photo?splitPacker():null,nearOrdinary=[],photoWarmTile={centre:[0,0,0],etendue:3.5,debut:0,fin:0};
    const photoState={contacts:0,tuile:false,loin:false,penombre:'off',loinTaille:0};
    // Textures que photoBind a liées aux unités 8, 9 et 10 pour l'image en cours (reprises après fx.foule.couleur).
    const photoLies=[null,null,null];
    if(photo)stats.ombresPhoto=photoState;
    const ordinary=[],overlay=[],particles=[],overlayParticles=[];
    const native=options.resolution==='native',maxSize=native?Math.min(Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))||16384,Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))||16384):16384;
    const surface=native?window.FSurface.create(canvas,{limit:maxSize,maxPixels:options.maxPixels,scale:options.renderScale}):null;
    const watch=native?window.FSurface.budget({target:60,onBudget:options.onBudget}):null;
    let runtimeMaxPixels=options.maxPixels>0?options.maxPixels:0;
    if(surface){stats.native=surface.stats;stats.budget=watch.stats;stats.budgetLog=watch.log;}
    let drawing=false,profiler=null,profileOptions=null,reflections=null,probeBuffer=null,probeBatch=null,probeKey='';
    const probeView=new Float32Array(16),probeProjection=new Float32Array(16),probeVP=new Float32Array(16);
    const screenCaches=new Map(),screenValues=new Float32Array(4);let composeScreen=false;
    let fskyProgram=null,fskyBound=null,fskyCache={},skyFrame={},fogCaches=new Map();
    const skyCamera={right:null,up:null,forward:null,fov:[0,0],height:0,time:0,vignette:options.composition?1:.76,dither:options.composition?0:1,mask:0,layers:[1,1,1,1]};
    const weather=bitumeWeather(null,null,0); // BITUME : stockage météo réutilisé.
    const localWind=localWindState(),windFrame=localWind.frame,vegetation=vegetationFrame(),vegetationState=vegetation.frame;
    function bindLocalWind(locations){
      gl.uniform1f(locations.uWindStrength,vegetationState.strength);
      if(vegetationState.enabled||locations.groundCoverActive){
        gl.uniform3fv(locations.uGroundCoverEye,vegetationState.eye);gl.uniform4fv(locations.uGroundCoverDensity,vegetationState.density);gl.uniform2fv(locations.uGroundCoverRange,vegetationState.range);
        locations.groundCoverActive=vegetationState.enabled;
      }
      if(!windFrame.count&&!locations.localWindActive)return;
      gl.uniform1i(locations.uLocalWindCount,windFrame.count);locations.localWindActive=windFrame.count>0;
      if(windFrame.count){gl.uniform4fv(locations.uLocalWindPosition,windFrame.positions);gl.uniform4fv(locations.uLocalWindMotion,windFrame.motions);}
    }
    // BITUME : nappes (chaussée, accotements, terrain : triangles continus, matière et couleur par sommet) et lots
    // de décor (instances statiques groupées par portion de circuit, chacune avec sa version lointaine allégée).
    let multiDrawNappes=null;
    let nappes=[],nappesCompactes=new Uint8Array(0),nappeVao=null,nappeVaoCompact=null,nappeVbo=null,nappeIbo=null,lots=[],groundPlans=new WeakMap();
    const lotView=lotViewState(),colourRadii={horizontal:0,vertical:0};
    let viewCache=null,torchCache=null,sunCache=null,indexRevision=0,selectionGen=0,selectionRebuilt=false;
    const emptyGuard={revision:-1,origin:[0,0,0],forward:[0,0,0],horizontal:0,vertical:0,far:0,ranges:[0,0,0],margin:0,tilt:0,entries:EMPTY_ENTRIES};
    // Les marges arrondies sont lues à la demande : plus de chaîne (toFixed) construite à chaque image,
    // pour la même valeur que l'ancienne affectation faite à chaque vue.
    const cacheStats={viewFrames:0,viewRebuilds:0,torchRebuilds:0,sunRebuilds:0,get marginDistance(){return +guardMargin.distance.toFixed(2);},get marginAngle(){return +(guardMargin.tilt*180/Math.PI).toFixed(2);}};
    let guardMargin={distance:1,tilt:8*Math.PI/180};
    // Sélections couleur alternées : le cache statique garde l'une pendant que l'autre se remplit (aucun tableau par image).
    const shownA=[],shownB=[],warmMargin={distance:0,tilt:0};
    const VIEW_MARGIN=1,VIEW_TILT=8*Math.PI/180;
    const governor=resolutionGovernor();let autoScale=1;
    // PDR (voile) : vrai tant que le voile du jeu occupe l'unité 4 ; draw le retire à la première image sans fx.voile.
    let pdrVoilePose=false,foveaPose=false,foveaSsrPose=false;
    // PDR (lots) : décor du jeu déjà empaqueté (fx.lots). pdrSlots : un tampon GPU par lot, renvoyé seulement quand le lot
    // change ; pdrLots : les lots de l'image en cours. FERRO a setLots pour le même besoin : à unifier (PROVENANCE.md).
    let pdrSlots=[];const pdrLots=[];
    // PDR (foule) : points d'accroche de la foule sur le GPU. pdrLumiere et pdrVue sont remplis à chaque image, sans
    // allocation, et passés à fx.foule.ombre et fx.foule.couleur. pdrGeneration change à chaque (ré)initialisation du
    // contexte. pdrGlsl : la bibliothèque d'éclairage, au vignettage du réglage de création, comme le shader du monde.
    let pdrGeneration=0;
    const pdrGlsl=config.vignette===.59?PDR_GLSL:PDR_GLSL.replace('couleur*mix(.59,1.,',`couleur*mix(${glslFloat(config.vignette)},1.,`);
    const pdrMatriceSoleil=new Float32Array(16);
    const pdrLumiere={matrice:pdrMatriceSoleil,direction:[.4,.8,.3],texel:1,plein:false,viewport:[0,0,1,1],centre:[0,0,0],etendue:1,profondeur:1};
    const pdrVue={gl,glsl:pdrGlsl,vp,vue:view,projection,oeil:[0,0,0],avant:[0,0,-1],droite:[1,0,0],haut:[0,1,0],fov:1,tangente:1,focale:1,
      largeur:1,hauteur:1,near:.045,far:180,temps:0,qualite:'auto',msaa:0,soleil:[.4,.8,.3],couleurSoleil:[0,0,0],ambiance:[.075,.10,.12],
      brouillard:[.009,.018,.024],densiteBrouillard:.014,cielHaut:[.05,.08,.10],cielBas:[.16,.20,.22],
      ombre:{texture:null,unite:2,matrice:pdrMatriceSoleil,texel:1,plein:false,active:false},
      lumieres:{positions:lightPositions,couleurs:lightColors,portees:lightRanges,directions:lightDirections,cones:lightCones,nombre:0},
      sortie:'Couleur finale de la cible de scène (RGBA8) : pdrFinir applique brouillard, tonemap c/(c+0,76), gamma 1/2,2 et vignettage, comme le monde.'};

    function compile(type,code) {
      const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error('Compilation 3D : '+message);}
      return shader;
    }
    function link(vertex,fragment){
      const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();created(1);
      gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error('Initialisation 3D : '+message);}
      return p;
    }
    // Compilation groupée : toutes les compilations et tous les liens partent avant la lecture du premier statut,
    // pour que le pilote les mène en parallèle ; un source identique (VERT, POST_VERT) n'est compilé qu'une fois.
    // En cas d'échec, le message et son ordre restent ceux de link : compilation du sommet, du fragment, puis lien.
    function linkAll(pairs){
      const shaders=new Map(),entries=[];
      const shader=(type,code)=>{const key=(type===gl.VERTEX_SHADER?'v':'f')+code;let s=shaders.get(key);if(!s){s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);shaders.set(key,s);}return s;};
      for(const [vertex,fragment] of pairs){const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);entries.push({p,vs,fs});}
      let failure=null;
      for(const {p,vs,fs} of entries){
        if(gl.getProgramParameter(p,gl.LINK_STATUS))continue;
        for(const s of [vs,fs])if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){failure='Compilation 3D : '+gl.getShaderInfoLog(s);break;}
        failure=failure||'Initialisation 3D : '+gl.getProgramInfoLog(p);break;
      }
      for(const s of shaders.values())gl.deleteShader(s);
      if(failure){for(const {p} of entries)gl.deleteProgram(p);throw new Error(failure);}
      return entries.map(entry=>entry.p);
    }
    function texture(width,height,depth=false){
      const t=gl.createTexture();created(1);gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,depth?gl.DEPTH_COMPONENT24:gl.RGBA8,width,height,0,depth?gl.DEPTH_COMPONENT:gl.RGBA,depth?gl.UNSIGNED_INT:gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,depth?gl.NEAREST:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,depth?gl.NEAREST:gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      return t;
    }
    function deleteTarget(target){
      if(!target)return;gl.deleteFramebuffer(target.framebuffer);gl.deleteTexture(target.texture);if(target.depth)gl.deleteRenderbuffer(target.depth);if(target.depthTexture)gl.deleteTexture(target.depthTexture);
    }
    function colorTarget(width,height,depth){
      const target={framebuffer:gl.createFramebuffer(),texture:texture(width,height),width,height,depth:null};created(1);
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.texture,0);
      if(depth==='texture'){target.depthTexture=texture(width,height,true);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,target.depthTexture,0);}
      else if(depth){target.depth=gl.createRenderbuffer();created(1);gl.bindRenderbuffer(gl.RENDERBUFFER,target.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,target.depth);}
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){deleteTarget(target);return null;}
      return target;
    }
    // PDR : anticrénelage MSAA de la scène avant le bloom ; les lignes fines d'une ville vue de haut l'exigent.
    function deleteMsaa(target){if(!target)return;gl.deleteFramebuffer(target.framebuffer);gl.deleteRenderbuffer(target.color);gl.deleteRenderbuffer(target.depth);}
    function msaaTarget(width,height){
      const samples=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0);if(samples<2)return null;
      const target={framebuffer:gl.createFramebuffer(),color:gl.createRenderbuffer(),depth:gl.createRenderbuffer(),samples};created(3);
      gl.bindRenderbuffer(gl.RENDERBUFFER,target.color);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.RGBA8,width,height);
      gl.bindRenderbuffer(gl.RENDERBUFFER,target.depth);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.DEPTH_COMPONENT24,width,height);
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,target.color);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,target.depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){deleteMsaa(target);return null;}
      return target;
    }
    function freePost(){if(post){deleteTarget(post.scene);deleteTarget(post.a);deleteTarget(post.b);deleteTarget(post.reflectSource);deleteTarget(post.reflection);post=null;}deleteMsaa(msaaBuffer);msaaBuffer=undefined;msaaIdle=0;stats.msaa=0;stats.reflections=false;}
    function ensureTargets(){
      const key=canvas.width+'x'+canvas.height+':'+quality;if(key===targetKey)return;targetKey=key;
      freePost();
      if(quality==='low'){deleteTarget(shadowTarget);shadowTarget=null;shadowKey='';shadowIdle=0;stats.bloom=stats.shadows=false;stats.shadowMapSize=stats.shadowTileSize=0;return;}
      const width=canvas.width,height=canvas.height,bw=Math.max(1,Math.ceil(width/4)),bh=Math.max(1,Math.ceil(height/4));
      const scene=colorTarget(width,height,true),a=colorTarget(bw,bh,false),b=colorTarget(bw,bh,false);
      if(scene&&a&&b)post={scene,a,b};else{deleteTarget(scene);deleteTarget(a);deleteTarget(b);}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
      stats.bloom=!!post;
    }
    const shadowsEnabled=fx=>fx.shadows!==false&&(quality!=='low'||fx.shadows===true);
    function ensureShadowTarget(fx){
      if(!shadowsEnabled(fx)){
        // Une vue sans ombres ne fait pas détruire l'atlas de la vue suivante. Une désactivation durable le libère.
        if(shadowTarget&&!retained&&++shadowIdle>=120){deleteTarget(shadowTarget);shadowTarget=null;shadowKey='';shadowIdle=0;}
        stats.shadowMapSize=stats.shadowTileSize=0;return;
      }
      shadowIdle=0;
      // Tuile d'ombre de 512 en auto, 1 024 en haute qualité. Avec shadowMapScale: 2 (repris de Point de rupture, où un
      // seul soleil couvre tout le sol visible), elle double. Le choix par image reste borné par la capacité de
      // création et MAX_TEXTURE_SIZE ; changer seulement cette taille ne recrée ni le contexte ni les cibles couleur.
      const scale=fx.shadowMapScale===1||fx.shadowMapScale===2?Math.min(config.shadowMapScale,fx.shadowMapScale):config.shadowMapScale;
      const base=quality==='high'?1024:512,size=Math.min(base*scale,maxShadowTileSize);
      // Pixel resolution may adapt; a depth atlas of the same size remains valid.
      if(shadowKey!==String(size)){
        deleteTarget(shadowTarget);shadowTarget=null;shadowKey=String(size);
        const target={framebuffer:gl.createFramebuffer(),texture:texture(size*2,size*2,true),size};created(1);
        gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,target.texture,0);
        gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE)shadowTarget=target;else deleteTarget(target);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
      stats.shadowTileSize=shadowTarget?size:0;stats.shadowMapSize=stats.shadowTileSize*2;
    }
    // Les options de création ouvrent une capacité, sans réserver sa mémoire. Les
    // cibles coûteuses naissent au premier draw qui s'en sert. Une qualité ou taille
    // différente les libère via freePost ; sinon 120 rendus consécutifs sans usage
    // libèrent le cache, sans churn entre les vues ni à chaque transition météo.
    function ensureOptionalTargets(fx,reflectionMode){
      const bloom=!!post&&fx.bloom!==false,wantMsaa=config.msaa&&fx.msaa!==false&&(bloom||fx.msaa===true);
      const wantReflections=config.reflections&&bloom&&reflectionMode==='off'&&fx.reflections!==false&&fx.reflections!=='off';
      let changed=false;
      if(wantMsaa){
        msaaIdle=0;
        // null mémorise un échec jusqu'au prochain changement de taille/qualité.
        if(msaaBuffer===undefined){msaaBuffer=msaaTarget(canvas.width,canvas.height);changed=true;}
      }else if(msaaBuffer&&!retained&&++msaaIdle>=120){
        deleteMsaa(msaaBuffer);msaaBuffer=undefined;msaaIdle=0;changed=true;
      }
      if(wantReflections){
        post.reflectionIdle=0;
        if(post.reflectSource===undefined){
          const source=colorTarget(canvas.width,canvas.height,'texture');
          const reflected=source?colorTarget(Math.ceil(canvas.width/2),Math.ceil(canvas.height/2),false):null;
          if(source&&reflected){post.reflectSource=source;post.reflection=reflected;}
          else{deleteTarget(source);deleteTarget(reflected);post.reflectSource=post.reflection=null;}
          changed=true;
        }
      }else if(!retained&&post&&post.reflectSource&&(post.reflectionIdle=(post.reflectionIdle||0)+1)>=120){
        deleteTarget(post.reflectSource);deleteTarget(post.reflection);
        post.reflectSource=post.reflection=undefined;post.reflectionIdle=0;changed=true;
      }
      stats.msaa=wantMsaa&&msaaBuffer?msaaBuffer.samples:0;
      if(changed){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);}
    }
    const screenGLSL=`
      uniform vec4 uScreen;
      uniform vec2 uScreenSize;
      uniform float uCompose;
      uniform float uScreenDither;
      vec3 applyScreen(vec3 color,vec2 screen){
        float vignette=pow(max(0.,16.*screen.x*screen.y*(1.-screen.x)*(1.-screen.y)),.13);
        color*=mix(1.,mix(.59,1.,vignette),uScreen.w);
        float hurt=uScreen.x*(1.-vignette*.65);
        color=mix(color,vec3(.64,.035,.015),clamp(hurt*.68,0.,.6));
        float radius=(1.-clamp(uScreen.y,0.,1.))*.8;
        float wave=exp(-abs(length((screen-.5)*vec2(uScreenSize.x/uScreenSize.y,1.))-radius)*85.)*uScreen.y;
        float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
        return (color+vec3(.03,.27,.23)*wave)*uScreen.z+vec3(dither/255.*uScreenDither);
      }
    `;
    function screenShader(kind,source){
      if(!options.composition)return source;
      source=source.replace('out vec4 fragColor;',screenGLSL+'out vec4 fragColor;');
      if(kind==='world'){
        const start=source.indexOf('    vec2 screen=gl_FragCoord.xy/uResolution;'),end=source.indexOf('    float reflection=',start);
        source=source.slice(0,start)+'    if(uCompose<.5)color=applyScreen(color,gl_FragCoord.xy/uScreenSize);\n'+source.slice(end);
      }else if(kind==='sky')source=source.replace('fragColor=vec4(color*mix(.76,1.,vignette),0.);','fragColor=vec4(uCompose<.5?applyScreen(color,gl_FragCoord.xy/uScreenSize):color,0.);');
      else if(kind==='fsky')source=source.replace('fragColor=vec4(col,mix(1.,mask,uFskyPost.z));','fragColor=vec4(uCompose<.5?applyScreen(col,gl_FragCoord.xy/uScreenSize):col,mix(1.,mask,uFskyPost.z));');
      else if(kind==='fx')source=source.replace('fragColor=vec4(color,alpha);','fragColor=vec4(uCompose<.5?applyScreen(color,gl_FragCoord.xy/uScreenSize):color,alpha);');
      else if(kind==='post')source=source.replace('void main(){','void main(){if(uPass==3){fragColor=vec4(applyScreen(texture(uScene,vUV).rgb,vUV),1.);return;}')
        .replace('fragColor=vec4(c,1.);','fragColor=vec4(uPass==2?applyScreen(c,vUV):c,1.);');
      return source;
    }
    function bindScreen(target){
      if(!options.composition)return;
      let u=screenCaches.get(target);if(!u){u={screen:gl.getUniformLocation(target,'uScreen'),size:gl.getUniformLocation(target,'uScreenSize'),compose:gl.getUniformLocation(target,'uCompose'),dither:gl.getUniformLocation(target,'uScreenDither')};screenCaches.set(target,u);}
      gl.uniform4fv(u.screen,screenValues);gl.uniform2f(u.size,canvas.width,canvas.height);gl.uniform1f(u.compose,composeScreen?1:0);gl.uniform1f(u.dither,options.dither?1:0);
    }
    function specularShader(source){return options.exactSpecular!==true?source.replace('if(diffuse>0.)','').replace('if(sunlight>0.&&dot(n,uSunDirection)>0.)','').replace('if(torch>0.&&dot(n,torchDirection)>0.)',''):source;}
    function profile(value){
      if(value===undefined)return profiler?.stats||null;
      if(value===false){profiler?.dispose();profiler=null;profileOptions=null;return null;}
      if(!window.FGPUProfile)return null;
      profileOptions=value===true?{}:value;
      if(profiler)profiler.configure(profileOptions);else profiler=window.FGPUProfile.create(gl,profileOptions);
      return profiler.stats;
    }
    function skyFogShader(source){
      if(!fskyProgram)return source;
      source=source.replace('  out vec4 fragColor;',window.FSky.FOG_GLSL+'uniform float uFskyEnabled;\n  out vec4 fragColor;');
      return source.replace('vec3 fogColor=mix(vec3(.009,.018,.024),uFogColor,outdoors);',
        'vec3 fogColor=mix(vec3(.009,.018,.024),uFogColor,outdoors);if(uFskyEnabled>.5&&outdoors>0.)fogColor=mix(vec3(.009,.018,.024),fskyFog(-view),outdoors);')
        .replace('color=mix(color,uFogColor,min(.86,fog));',
        'vec3 fogColor=uFogColor;if(uFskyEnabled>.5&&vOutdoor>0.)fogColor=mix(uFogColor,fskyFog(-toEye/distanceToEye),clamp(vOutdoor,0.,1.));color=mix(color,fogColor,min(.86,fog));');
    }
    function bindSkyFog(target){
      if(!fskyProgram)return;
      let cache=fogCaches.get(target);if(!cache){cache={locations:{},bound:null,enabled:gl.getUniformLocation(target,'uFskyEnabled')};fogCaches.set(target,cache);}
      const sky=environment?.sky;gl.uniform1f(cache.enabled,sky?1:0);
      if(sky&&cache.bound!==sky){window.FSky.bind(gl,target,sky.uniforms,cache.locations);cache.bound=sky;}
    }
    const reflectionShader=source=>options.sceneReflections&&window.FSceneReflections?window.FSceneReflections.shader(source):source;
    function initialize() {
      // Limite stable pendant la vie du contexte : aucune requête synchrone au GPU par vue ou par image.
      // Une restauration peut changer d'adaptateur ; relire alors sa capacité avant toute nouvelle allocation.
      multiDrawNappes=gl.getExtension('WEBGL_multi_draw');
      maxShadowTileSize=Math.max(1,Math.floor((Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))||2048)/2));
      if(profiler){profiler.dispose();profiler=window.FGPUProfile.create(gl,profileOptions);}
      fskyProgram=null;fskyBound=null;fskyCache={};skyFrame={};fogCaches.clear();screenCaches.clear();
      // skyFogShader lit fskyProgram : le marquer avant de composer les sources ; le programme réel sort du lien groupé.
      // FX_VERT diffère de VERT depuis 0.3.37 (anneaux, grain borné, poids de brouillard) : monde et profondeur
      // partagent un shader de sommets compilé, les effets ont le leur.
      const advanced=!!(options.advancedSky&&window.FSky);fskyProgram=advanced;
      try{
        const pairs=[[POST_VERT,SSR_FRAG],[overlayVertex(VERT),reflectionShader(screenShader('world',skyFogShader(worldFrag)))],[overlayVertex(VERT),DEPTH_FRAG],[POST_VERT,screenShader('post',postFrag)],[POST_VERT,screenShader('sky',SKY_FRAG)],[overlayVertex(FX_VERT),screenShader('fx',skyFogShader(FX_FRAG))]];
        if(advanced)pairs.unshift([window.FSky.VERT,screenShader('fsky',window.FSky.FRAG)]);
        const linked=linkAll(pairs);fskyProgram=advanced?linked.shift():null;
        [ssrProgram,program,depthProgram,postProgram,skyProgram,fxProgram]=linked;
      }catch(error){fskyProgram=null;throw error;}
      ssrUniforms={};for(const name of ['uColor','uDepth','uReceiverTiles','uReceiverMask','uProjection','uPixel','uFovea'])ssrUniforms[name]=gl.getUniformLocation(ssrProgram,name);
      uniforms={};for(const name of ['uViewProjection','uWindTime','uWindStrength','uGroundCoverEye','uGroundCoverDensity','uGroundCoverRange','uLocalWindCount','uLocalWindPosition','uLocalWindMotion','uSeaOrigin','uSeaMotion','uEye','uForward','uLightPosition','uLightColor','uLightRange','uLightDirection','uLightCone','uWeather','uCloudOffset','uPbrAlbedo','uPbrNormal','uPbrRough','uPbrReady','uLightCount','uResolution','uEffects','uShadowMap','uShadowMatrix','uShadowSettings','uTorchPosition','uSunDirection','uSunColor','uAmbient','uFogColor','uSkyTop','uSkyBottom','uEnvironment','uNightHour','uPhoto','uFovea','uOverlayMode','uSeaMode','uSceneProbe','uProbeReady','uProbeOrigin']) uniforms[name]=gl.getUniformLocation(program,name);
      postUniforms={};for(const name of ['uScene','uBloom','uReflection','uReflections','uTexel','uPass'])postUniforms[name]=gl.getUniformLocation(postProgram,name);
      skyUniforms={};for(const name of ['uSkyRight','uSkyUp','uSkyForward','uSkyTop','uSkyBottom','uSkyFog','uSunDirection','uSunColor','uSkyFov','uSkyMotion','uWeather','uCloudOffset','uSkyNight'])skyUniforms[name]=gl.getUniformLocation(skyProgram,name);
      fxUniforms={};for(const name of ['uViewProjection','uWindTime','uEye','uAmbient','uSkyTop','uSkyBottom','uFogColor','uEnvironment','uTime'])fxUniforms[name]=gl.getUniformLocation(fxProgram,name);
      if(cameraRelativeOverlay){
        uniforms.uDrawOrigin=gl.getUniformLocation(program,'uDrawOrigin');
        fxUniforms.uDrawOrigin=gl.getUniformLocation(fxProgram,'uDrawOrigin');
        depthDrawOrigin=gl.getUniformLocation(depthProgram,'uDrawOrigin');
      }
      depthMatrix=gl.getUniformLocation(depthProgram,'uViewProjection');depthWind=gl.getUniformLocation(depthProgram,'uWindTime');
      depthLocalWind={};for(const name of ['uWindStrength','uGroundCoverEye','uGroundCoverDensity','uGroundCoverRange','uLocalWindCount','uLocalWindPosition','uLocalWindMotion'])depthLocalWind[name]=gl.getUniformLocation(depthProgram,name);
      vao=gl.createVertexArray();gl.bindVertexArray(vao);
      vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,source.vertices,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
      gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
      ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,groundIndex.indices,gl.STATIC_DRAW);
      for(let i=2;i<6;i++) {gl.enableVertexAttribArray(i);gl.vertexAttribDivisor(i,1);}
      reflections?.dispose();reflections=options.sceneReflections&&window.FSceneReflections?window.FSceneReflections.create(gl,link):null;stats.sceneReflections=reflections?.stats;probeBuffer=gl.createBuffer();probeBatch=null;probeKey='';
      worldBuffer=gl.createBuffer();dynamicBuffer=gl.createBuffer();overlayBuffer=gl.createBuffer();fxBuffer=gl.createBuffer();
      dynamicStream={buffer:dynamicBuffer,capacity:0};overlayStream={buffer:overlayBuffer,capacity:0};fxStream={buffer:fxBuffer,capacity:0};
      // PDR : foule déjà empaquetée par le jeu (fx.instances), partagée par l'ombre du soleil et la passe couleur.
      // Son tampon naît au premier usage : un jeu sans foule ne crée rien de plus.
      crowdBuffer=null;
      // Main colour, three shadow views and distant water keep independent instance buffers.
      staticCaches=[worldBuffer,gl.createBuffer(),gl.createBuffer(),gl.createBuffer(),gl.createBuffer()].map(buffer=>({buffer,entries:[],batch:pack([])}));
      lampCasters=[];
      gl.bindBuffer(gl.ARRAY_BUFFER,worldBuffer);gl.bufferData(gl.ARRAY_BUFFER,worldBatch.values,gl.STATIC_DRAW);
      postVao=gl.createVertexArray();
      whiteTexture=texture(1,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
      pbrTextures=[];const layers=options?.materials?.layers||globalThis.RADE?.materials?.layers||[],size=layers[0]?.diff.width||1;
      for(const [k,kind] of ['diff','nor_gl','rough'].entries()){
        const tex=gl.createTexture();pbrTextures.push(tex);gl.activeTexture(gl.TEXTURE5+k);gl.bindTexture(gl.TEXTURE_2D_ARRAY,tex);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY,Math.floor(Math.log2(size))+1,k===0?gl.SRGB8_ALPHA8:gl.RGBA8,size,size,Math.max(1,layers.length));
        for(let j=0;j<layers.length;j++)gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,j,size,size,1,gl.RGBA,gl.UNSIGNED_BYTE,layers[j][kind]);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
        const aniso=gl.getExtension('EXT_texture_filter_anisotropic');if(aniso)gl.texParameterf(gl.TEXTURE_2D_ARRAY,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      }gl.useProgram(program);gl.uniform1i(uniforms.uPbrAlbedo,5);gl.uniform1i(uniforms.uPbrNormal,6);gl.uniform1i(uniforms.uPbrRough,7);gl.uniform1f(uniforms.uPbrReady,layers.length?1:0);stats.pbrLayers=layers.length;
      // PDR (voile) : ses uniformes. L'échantillonneur reste sur l'unité 4, que rien d'autre n'emploie (texture blanche,
      // force nulle) : tant qu'aucun voile n'est passé à draw, le moteur n'ajoute aucune commande par image.
      for(const name of ['uVoile','uVoileZone','uVoileForce'])uniforms[name]=gl.getUniformLocation(program,name);
      gl.useProgram(program);gl.uniform1i(uniforms.uVoile,4);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,whiteTexture);gl.activeTexture(gl.TEXTURE0);pdrVoilePose=false;
      // PDR (lots) : leurs tampons sont à recréer avec le contexte. PDR (foule) : la génération le dit au jeu.
      pdrSlots=[];pdrLots.length=0;pdrGeneration++;
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
      gl.clearColor(.035,.06,.073,1);
      if(photo)photoInitialize();
      post=null;msaaBuffer=undefined;msaaIdle=0;shadowTarget=null;shadowIdle=0;targetKey=shadowKey='';shadowLight=null;
      stats.msaa=0;stats.reflections=false;stats.shadowMapSize=stats.shadowTileSize=0;
      governor.reset();autoScale=1;
      stats.contextLost=false;
    }
    initialize();

    // One vertex buffer with a 10-float section and a 13-float section. The index
    // stream stays in submission order, including multi-draw and its contiguous fallback.
    function vaoTerrain(compact,offset){
      const terrain=gl.createVertexArray(),stride=compact?40:52;
      gl.bindVertexArray(terrain);gl.bindBuffer(gl.ARRAY_BUFFER,nappeVbo);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,nappeIbo);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,offset);
      gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,offset+12);
      gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,stride,offset+24);
      if(!compact){gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,3,gl.FLOAT,false,stride,offset+40);}
      return terrain;
    }
    function chargerNappes(){
      if(nappeVbo)gl.deleteBuffer(nappeVbo);if(nappeIbo)gl.deleteBuffer(nappeIbo);
      if(nappeVao)gl.deleteVertexArray(nappeVao);if(nappeVaoCompact)gl.deleteVertexArray(nappeVaoCompact);
      nappeVao=nappeVaoCompact=nappeVbo=nappeIbo=null;
      if(!nappes.length||stats.contextLost||disposed)return;
      nappesCompactes=new Uint8Array(nappes.length);
      let compact=0,complet=0,indices=0;
      for(let i=0;i<nappes.length;i++){
        const n=nappes[i],count=n.sommets.length/13;
        if(rigidTerrainVertices(n.sommets)){nappesCompactes[i]=1;compact+=count;}else complet+=count;
        indices+=n.indices.length;
      }
      const debutComplet=compact*10,donnees=new Float32Array(debutComplet+complet*13),index=new Uint32Array(indices);
      let vc=0,vl=0,is=0;
      for(let i=0;i<nappes.length;i++){
        const n=nappes[i],count=n.sommets.length/13;
        let base;
        if(nappesCompactes[i]){base=vc;writeRigidTerrain(donnees,vc*10,n.sommets);vc+=count;}
        else{base=vl;donnees.set(n.sommets,debutComplet+vl*13);vl+=count;}
        for(let k=0;k<n.indices.length;k++)index[is+k]=n.indices[k]+base;
        n.debut=is*4;n.compte=n.indices.length;is+=n.indices.length;
      }
      gl.bindVertexArray(null);
      nappeVbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nappeVbo);gl.bufferData(gl.ARRAY_BUFFER,donnees,gl.STATIC_DRAW);
      nappeIbo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,nappeIbo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,index,gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,null);
      if(compact)nappeVaoCompact=vaoTerrain(true,0);
      if(complet)nappeVao=vaoTerrain(false,debutComplet*4);
      gl.bindVertexArray(vao);stats.nappeTriangles=indices/3;
    }
    function flagsNappe(i){
      return (nappesCompactes[i]?66:2)+(nappes[i].vertexTint==='smooth'?32:0);
    }
    function lierNappe(flags){
      gl.bindVertexArray(flags>=66?nappeVaoCompact:nappeVao);
      gl.vertexAttrib4f(3,1,1,1,0);gl.vertexAttrib4f(4,0,0,0,flags);
    }
    const terrainView=terrainViewState();
    const msaaAttachments=[gl.COLOR_ATTACHMENT0,gl.DEPTH_ATTACHMENT];
    let comptesNappes=new Int32Array(0), debutsNappes=new Int32Array(0), indicesSourceNappes=new Int32Array(0);
    function setNappes(liste,options){
      nappes=[];const sources=[];
      const entree=liste||[];
      for(let i=0;i<entree.length;i++){const n=entree[i];if(n&&n.sommets&&n.indices&&n.indices.length){nappes.push(n);sources.push(i);}}
      indicesSourceNappes=Int32Array.from(sources);
      terrainView.reset(nappes,options?.staticBounds===true);
      comptesNappes=new Int32Array(nappes.length);
      debutsNappes=new Int32Array(nappes.length);
      chargerNappes();
    }
    function envoyerNappes(nombre){
      if(nombre>1 && typeof multiDrawNappes?.multiDrawElementsWEBGL==='function'){
        multiDrawNappes.multiDrawElementsWEBGL(gl.TRIANGLES,comptesNappes,0,gl.UNSIGNED_INT,debutsNappes,0,nombre);
        stats.drawCalls++;
      }else{
        for(let i=0;i<nombre;i++)gl.drawElements(gl.TRIANGLES,comptesNappes[i],gl.UNSIGNED_INT,debutsNappes[i]);
        stats.drawCalls+=nombre;
      }
    }
    function dessinerNappes(eye,axes,horizontal,vertical,far,radii,masqueNappes){
      if(!nappeIbo)return;
      const count=terrainView.select(eye,axes,horizontal,vertical,far,radii);
      if(!count)return;
      let flags=0,nombre=0;
      for(let i=0;i<count;i++){
        const id=terrainView.indices[i];
        if(masqueNappes&&masqueNappes[indicesSourceNappes[id]]){stats.nappesOccultees=(stats.nappesOccultees||0)+1;continue;}
        const n=nappes[id],suivant=flagsNappe(id);
        if(flags!==suivant){
          envoyerNappes(nombre);nombre=0;lierNappe(suivant);flags=suivant;
        }
        stats.triangles+=n.compte/3;
        // L'extension prend des offsets signés 32 bits, drawElements accepte un GLintptr.
        if(n.debut>0x7fffffff){
          envoyerNappes(nombre);nombre=0;
          gl.drawElements(gl.TRIANGLES,n.compte,gl.UNSIGNED_INT,n.debut);stats.drawCalls++;
          continue;
        }
        // Fusion contiguë également disponible en WebGL2 de base. Une fin de primitive
        // incomplète doit rester la fin de son propre dessin.
        const precedent=nombre-1;
        if(nombre && comptesNappes[precedent]%3===0 && comptesNappes[precedent]+n.compte<=0x7fffffff
          && debutsNappes[precedent]+comptesNappes[precedent]*4===n.debut){
          comptesNappes[precedent]+=n.compte;
        }else{
          debutsNappes[nombre]=n.debut;comptesNappes[nombre]=n.compte;nombre++;
        }
      }
      envoyerNappes(nombre);
      if(flags!==2)gl.vertexAttrib4f(4,0,0,0,2);
      gl.bindVertexArray(vao);
    }
    // Préchauffage : chaque nappe, sans test de champ. Les nappes ne projettent pas d'ombre (aucune passe d'ombre
    // ne les trace) : les tracer dans l'atlas ferait compiler une variante que le jeu n'utilise jamais. Une cible
    // déjà balayée (voir prechaufferLots) ne reçoit qu'une nappe, assez pour la variante d'état de cette image.
    function prechaufferNappes(){
      if(!nappeIbo)return;
      const cle=warm.cible+' nappes',seule=warm.balayes.has(cle);warm.balayes.add(cle);
      let flags=0;
      for(let i=0;i<nappes.length;i++){
        const n=nappes[i],suivant=flagsNappe(i);
        if(flags!==suivant){lierNappe(suivant);flags=suivant;}
        gl.drawElements(gl.TRIANGLES,n.compte,gl.UNSIGNED_INT,n.debut);stats.drawCalls++;stats.triangles+=n.compte/3;warm.nappes++;if(seule)break;
      }
      if(flags!==2)gl.vertexAttrib4f(4,0,0,0,2);
      gl.bindVertexArray(vao);
    }
    // BITUME : les bornes vivent pendant toute la séance. Chaque contexte possède
    // ses propres tampons, créés à l'approche ou dès la première passe qui en a besoin.
    let lotsProgressifs=false,dernierUsage=null,curseurLots=0,indicesLots=[],indicesSourceLots=[],ambianceLots=null;
    // Un VAO retient les tampons et les quatre décalages de la rangée d'instances.
    // Les programmes de profondeur et de couleur utilisent le même layout explicite 0..5.
    // Les objets mobiles et le VAO de travail restent indépendants de ce cache par contexte.
    let cacheLignesLots=false,dispositions=new WeakMap(),curseurDisposition=0,budgetDispositions=0;
    // CPU-only index of the immutable packed rows, private to this WebGL context and LOD.
    // Cold or invalidated pages remain drawable while their bounds are computed over successive views.
    let sunLotPlans=new WeakMap();
    const sunPageSize=8,sunIndexBudget={rows:0,vertices:0},sunLotSelection={groups:[]},sunLotRecords=[],sunPlaneAbs=new Float64Array(12);
    const casesDisposition=[],casesLibres=[],MAX_DISPOSITIONS=768;
    const etatDispositions={residentes:0,reutilisations:0,replis:0};
    stats.lotVertexArrays=etatDispositions;

    function oublierDispositions(buffer){
      const table=buffer&&dispositions.get(buffer);
      if(!table)return;
      for(const entree of table.values()){
        gl.deleteVertexArray(entree.vao);
        casesDisposition[entree.case]=null;casesLibres.push(entree.case);
        etatDispositions.residentes--;
      }
      dispositions.delete(buffer);
    }
    function pointeursLot(offset){
      for(let i=2;i<6;i++)gl.vertexAttribPointer(i,4,gl.FLOAT,false,64,offset+(i-2)*16);
    }
    function lierLignesLot(buffer,offset,dejaEnRepli=false){
      let table=dispositions.get(buffer),entree=table?.get(offset);
      if(entree){
        entree.vue=lotView.frame;gl.bindVertexArray(entree.vao);
        etatDispositions.reutilisations++;return false;
      }
      // Au plus douze préparations par vue. Garder les dispositions chaudes si le
      // village remplit le cache ; une rangée non retenue reste dessinée immédiatement.
      if(budgetDispositions>0){
        if(casesLibres.length||casesDisposition.length<MAX_DISPOSITIONS){
          const nouveau=gl.createVertexArray();
          if(nouveau){
            const index=casesLibres.length?casesLibres.pop():casesDisposition.length;
            entree={vao:nouveau,case:index,table:null,offset:0,vue:0};casesDisposition[index]=entree;
            created(1);etatDispositions.residentes++;
            gl.bindVertexArray(nouveau);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
            gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
            gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);
            for(let i=2;i<6;i++){gl.enableVertexAttribArray(i);gl.vertexAttribDivisor(i,1);}
          }else budgetDispositions=0;
        }else{
          for(let n=0;n<4;n++){
            const candidat=casesDisposition[curseurDisposition++];
            if(curseurDisposition===MAX_DISPOSITIONS)curseurDisposition=0;
            if(lotView.frame-candidat.vue<=3)continue;
            candidat.table.delete(candidat.offset);entree=candidat;
            gl.bindVertexArray(entree.vao);break;
          }
        }
        if(entree){
          if(!table){table=new Map();dispositions.set(buffer,table);}
          entree.table=table;entree.offset=offset;entree.vue=lotView.frame;table.set(offset,entree);
          budgetDispositions--;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);pointeursLot(offset);return false;
        }
      }
      if(!dejaEnRepli){gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);}
      pointeursLot(offset);etatDispositions.replis++;return true;
    }
    function viderLot(l){
      sunLotPlans.delete(l.paquet);sunLotPlans.delete(l.paquetLoin);
      oublierDispositions(l.tampon);oublierDispositions(l.tamponLoin);
      if(l.tampon)gl.deleteBuffer(l.tampon);
      if(l.tamponLoin)gl.deleteBuffer(l.tamponLoin);
      l.tampon=l.tamponLoin=l.paquet=l.paquetLoin=null;
      groundPlans.delete(l);
    }
    function tamponInstances(batch){
      const buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,batch.values,gl.STATIC_DRAW);
      return buffer;
    }
    function chargerLot(index,loinSeul=false){
      const l=lots[index];
      if(!l||stats.contextLost||disposed)return false;
      if(dernierUsage)dernierUsage[index]=lotView.frame;
      if(loinSeul&&!l.groundCover&&(l.loin?.length||l.detailLointain)){
        if(l.tamponLoin)return false;
        const loin=l.preparerLoin?.()||l.loin;
        if(loin.length){
          l.paquetLoin=pack(loin,ambianceLots);
          l.tamponLoin=tamponInstances(l.paquetLoin);
          return true;
        }
      }
      if(l.tampon)return false;
      const detail=l.preparerDetail?.(),sourceLot=detail?.objets?detail:l;
      l.paquet=pack(sourceLot.objets,ambianceLots);
      l.tampon=tamponInstances(l.paquet);
      if(!l.tamponLoin&&sourceLot.loin?.length){
        l.paquetLoin=pack(sourceLot.loin,ambianceLots);
        l.tamponLoin=tamponInstances(l.paquetLoin);
      }
      groundPlans.set(l,groundCoverPlan(l,l.paquet,l.paquetLoin,groundIndex));
      return true;
    }
    function preparerLot(index,loinSeul=false){
      return Number.isInteger(index)&&indicesLots[index]!==undefined&&chargerLot(indicesLots[index],loinSeul);
    }
    function libererLotsInactifs(){
      if(!lotsProgressifs||warm)return;
      const compte=Math.min(12,lots.length);
      for(let j=0;j<compte;j++){
        const i=curseurLots++;
        if(curseurLots===lots.length)curseurLots=0;
        if((lots[i].tampon||lots[i].tamponLoin)&&lotView.frame-dernierUsage[i]>300)viderLot(lots[i]);
      }
    }
    function chargerLots(){
      for(let i=0;i<lots.length;i++){
        viderLot(lots[i]);
        if(!lotsProgressifs)chargerLot(i);
      }
    }
    function setLots(liste,options){
      for(const l of lots)viderLot(l);
      groundPlans=new WeakMap();sunLotPlans=new WeakMap();lots=[];indicesLots=[];indicesSourceLots=[];ambianceLots=environment;
      if(liste)for(let i=0;i<liste.length;i++){
        if(!liste[i]?.objets)continue;
        indicesLots[i]=lots.length;indicesSourceLots.push(i);lots.push(liste[i]);
      }
      lotsProgressifs=options?.progressif===true;cacheLignesLots=options?.staticBounds===true;
      dernierUsage=lotsProgressifs?new Float64Array(lots.length):null;curseurLots=0;
      lotView.reset(lots,options?.staticBounds===true);chargerLots();stats.lots=lots.length;
    }
    function sunLotPlan(batch){
      let plan=sunLotPlans.get(batch);
      if(!plan){
        if(sunIndexBudget.rows<sunPageSize||sunIndexBudget.vertices<=0)return null;
        const starts=new Uint32Array(batch.groups.length+1);
        for(let i=0;i<batch.groups.length;i++)starts[i+1]=starts[i]+Math.ceil(batch.groups[i].count/sunPageSize);
        plan={starts,boxes:new Float64Array(starts[batch.groups.length]*6),ready:0,group:0};
        sunLotPlans.set(batch,plan);
      }
      const {starts,boxes}=plan,rows=batch.values;
      while(plan.group<batch.groups.length&&sunIndexBudget.rows>=sunPageSize){
        const g=plan.group,group=batch.groups[g],page=plan.ready;
        const half=rigidShapes.halfExtents(group.name,sunIndexBudget);
        if(!half)break; // A complex registered shape may span several frames.
        const first=(page-starts[g])*sunPageSize,count=Math.min(sunPageSize,group.count-first);
        let xmin=Infinity,ymin=Infinity,zmin=Infinity,xmax=-Infinity,ymax=-Infinity,zmax=-Infinity,unbounded=false;
        for(let i=0,at=group.offset/4+first*16;i<count;i++,at+=16){
          const x=rows[at],y=rows[at+1],z=rows[at+2],material=rows[at+3];
          // Sheared cover, local wind and water can move independently of the rigid instance.
          if((rows[at+11]&24)||(material>11.5&&material<12.5)){unbounded=true;break;}
          const sx=half[0]*rows[at+4],sy=half[1]*rows[at+5],sz=half[2]*rows[at+6];
          // The depth vertex program caps wind at 2. Foliage bends by (.5+y)*wind*.055
          // in X and at most .6 of that in Z. Material 27 adds at most .66 m and .414 m.
          const wind=material>10.5&&material<11.5 ? .14*(half[1]+.5) : material>26.5&&material<27.5 ? .80 : 0;
          const r=Math.sqrt(sx*sx+sy*sy+sz*sz)*1.00001+wind+.003+.000002*(1+Math.abs(x)+Math.abs(y)+Math.abs(z));
          if(!Number.isFinite(r+x+y+z)){unbounded=true;break;}
          xmin=Math.min(xmin,x-r);xmax=Math.max(xmax,x+r);ymin=Math.min(ymin,y-r);ymax=Math.max(ymax,y+r);zmin=Math.min(zmin,z-r);zmax=Math.max(zmax,z+r);
        }
        const k=page*6;
        if(unbounded)boxes[k+3]=Infinity;
        else{
          boxes[k]=(xmin+xmax)*.5;boxes[k+1]=(ymin+ymax)*.5;boxes[k+2]=(zmin+zmax)*.5;
          boxes[k+3]=(xmax-xmin)*.5;boxes[k+4]=(ymax-ymin)*.5;boxes[k+5]=(zmax-zmin)*.5;
        }
        sunIndexBudget.rows-=count;plan.ready++;
        if(plan.ready===starts[g+1])plan.group++;
      }
      return plan;
    }
    function outsideSunPage(plan,page){
      if(page>=plan.ready)return false;
      const b=plan.boxes,k=page*6,x=b[k],y=b[k+1],z=b[k+2],rx=b[k+3],ry=b[k+4],rz=b[k+5],m=shadowMatrix;
      if(rx===Infinity)return false;
      for(let j=0;j<3;j++){
        const a=m[j],c=m[j+4],d=m[j+8];
        if(Math.abs(a*x+c*y+d*z+m[j+12])>1.000002+sunPlaneAbs[j]*rx+sunPlaneAbs[j+4]*ry+sunPlaneAbs[j+8]*rz)return true;
      }
      return false;
    }
    function selectSunLot(batch){
      const plan=sunLotPlan(batch),out=sunLotSelection.groups;
      if(!plan?.ready)return batch;
      let written=0;
      for(let g=0;g<batch.groups.length;g++){
        const group=batch.groups[g],base=plan.starts[g],last=plan.starts[g+1];
        let first=base,end=last;
        while(first<end&&outsideSunPage(plan,first))first++;
        while(end-first>1&&outsideSunPage(plan,end-1))end--;
        const skip=Math.min(group.count,(first-base)*sunPageSize),count=Math.min(group.count,(end-base)*sunPageSize)-skip;
        stats.sunLotInstancesCulled+=group.count-count;
        if(!count)continue;
        if(count===group.count){out[written++]=group;continue;}
        const rec=sunLotRecords[written]||(sunLotRecords[written]={name:'',count:0,offset:0});
        rec.name=group.name;rec.count=count;rec.offset=group.offset+skip*64;out[written++]=rec;
      }
      out.length=written;return sunLotSelection;
    }
    function dessinerLots(eye,axes,horizontal,vertical,far,accepte,radii,masqueLots){
      let dessines=0;
      for(const entry of lotView.candidates(accepte,axes,horizontal,vertical,far,radii,!!accepte&&cullSun)){const l=entry.lot;
        if(l.detailProcheSeul&&!entry.near)continue;
        if(entry.cover&&entry.distance>entry.range)continue;
        // lot.ombre === false : le lot ne projette pas d'ombre du soleil (herbe courte, marquages au sol).
        let clipped=false;
        if(accepte){
          if(l.ombre===false)continue;
          const classify=cullSun&&cacheLignesLots&&!entry.cover,classification=accepte(entry.bounds,classify);
          if(!classification)continue;
          clipped=classify&&classification===1;
        }
        else{
          if(masqueLots&&masqueLots[indicesSourceLots[entry.index]]){stats.lotsOccultes=(stats.lotsOccultes||0)+1;continue;}
          if(entry.distance>Math.min(far,entry.range))continue;if(!visible(entry.bounds,eye,axes,horizontal,vertical,far,radii))continue;
        }
        if(lotsProgressifs)chargerLot(entry.index,!entry.near);
        if(!l.tampon&&!l.tamponLoin)continue;
        const plan=entry.cover&&groundPlans.get(l),fresh=plan&&plan.frame!==lotView.frame;
        if(plan&&prepareGroundCover(plan,entry,lotView.frame,vegetationState.eye,vegetationState)){
          if(fresh)stats.lotInstanceTests+=plan.tested;
          if(plan.count){renderGroundCover(plan,l.tampon,l.tamponLoin,!!accepte);dessines++;}continue;
        }
        const proche=!l.paquetLoin||entry.near;
        const batch=proche?l.paquet:l.paquetLoin;
        renderBatch(clipped?selectSunLot(batch):batch,proche?l.tampon:l.tamponLoin,false,!!accepte,cacheLignesLots);dessines++;
      }
      if(cacheLignesLots)gl.bindVertexArray(vao);
      stats.lotDistanceTests=lotView.distanceTests;
      return dessines;
    }
    // Préchauffage : chaque tampon de lot, proche ET lointain, sans test de champ ni de portée, puis une fois chaque
    // sous-ensemble d'indices des prairies (le pilote valide et met en cache chaque intervalle d'indices du tampon
    // partagé). En passe d'ombre, les lots « ombre: false » restent exclus, comme en jeu.
    // Ce balayage complet n'a lieu qu'une fois par cible (warm.cible : passe, format, échantillons). Un tampon et un
    // intervalle d'indices ne se valident qu'une fois, et un pipeline dépend du programme et de la cible, pas du tampon :
    // refaire le balayage dans chaque variante soumettait des centaines de milliers d'appels pour rien. Les variantes
    // suivantes d'une même cible tracent un lot et un sous-ensemble, assez pour l'état qu'elles apportent (uniformes,
    // textures liées, mélange).
    function prechaufferLots(ombre){
      const cle=warm.cible+' lots',complet=!warm.balayes.has(cle);warm.balayes.add(cle);
      let dessines=0,sousEnsemble=false;const formes=new Set();
      for(const l of lots){
        if(ombre&&l.ombre===false)continue;
        if(!complet&&dessines&&sousEnsemble)break;
        if(l.tampon&&(complet||!dessines)){renderBatch(l.paquet,l.tampon,false,ombre,cacheLignesLots);dessines++;}
        if(complet&&l.tamponLoin&&l.paquetLoin){renderBatch(l.paquetLoin,l.tamponLoin,false,ombre,cacheLignesLots);dessines++;}
        const plan=l.tampon&&groundPlans.get(l);if(!plan||!plan.valid||!complet&&sousEnsemble)continue;
        for(const group of plan.groups){
          const record=group.nearIndex,full=source.ranges[record.name];if(!record.active||formes.has(record))continue;formes.add(record);
          if(cacheLignesLots)lierLignesLot(l.tampon,group.near.offset);
          else{gl.bindBuffer(gl.ARRAY_BUFFER,l.tampon);pointeursLot(group.near.offset);}
          for(const range of record.ranges){
            if(!range.count||range.count===full.count&&range.offset===full.offset)continue;
            gl.drawElementsInstanced(gl.TRIANGLES,range.count,gl.UNSIGNED_INT,range.offset,1);stats.drawCalls++;stats.triangles+=range.count/3;warm.subsets++;
            sousEnsemble=true;if(!complet)break;
          }
          if(!complet&&sousEnsemble)break;
        }
      }
      if(cacheLignesLots)gl.bindVertexArray(vao);
      warm.lots+=dessines;return dessines;
    }

    // BITUME : désindexer seulement la primitive modifiée ; les anciennes occurrences restent indépendantes.
    function updateShape(name,vertices){
      const range=source.ranges[name];if(!range||vertices.length!==range.count*6)throw new Error('Shape vertex count changed: '+name);
      const restored=primitiveIndex.restore(name), start=source.indices[range.offset/INDEX_OCTETS]*6;
      if(restored&&!stats.contextLost){gl.bindVertexArray(vao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);}
      groundIndex.invalidate(name,restored,stats.contextLost?null:uploadShapeIndices);
      source.vertices.set(vertices,start);rigidShapes?.invalidate(name);sunLotPlans=new WeakMap();
      if(!stats.contextLost){gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferSubData(gl.ARRAY_BUFFER,start*4,vertices);}
    }
    function uploadShapeIndices(offset,indices){
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER,offset,indices);
    }
    let chunks=new Map();const chunkCategories=new WeakMap(),chunkState={index:null,epoch:0};
    function rebuildChunks(){
      const next=planChunks(worldIndex,chunks,chunkCategories,chunkState);
      let uploads=0;
      for(const [key,group] of next){if(!group.nextEntries&&group.nextCount===group.entries.length)continue;
        // Only changed chunks need fresh bounds and GPU data. The final object
        // has no link to the previous chunk, so replaced generations can die.
        const c={range:group.range,entries:group.nextEntries||group.entries.slice(0,group.nextCount),min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
        for(const e of c.entries)for(let k=0;k<3;k++){c.min[k]=Math.min(c.min[k],e.p[k]-e.radius);c.max[k]=Math.max(c.max[k],e.p[k]+e.radius);}
        c.p=c.min.map((v,k)=>(v+c.max[k])/2);c.radius=Math.hypot(...c.max.map((v,k)=>(v-c.min[k])/2));c.batch=packIndexed(c.entries);c.buffer=gl.createBuffer();created(1);gl.bindBuffer(gl.ARRAY_BUFFER,c.buffer);gl.bufferData(gl.ARRAY_BUFFER,c.batch.values,gl.STATIC_DRAW);uploads+=c.batch.values.byteLength;next.set(key,c);
      }
      for(const [key,c] of chunks)if(next.get(key)!==c)gl.deleteBuffer(c.buffer);chunks=next;stats.chunks=chunks.size;stats.chunkBuildBytes=uploads;stats.chunkUpdateIncremental=chunkState.incremental;stats.chunkEntriesVisited=chunkState.entriesVisited;
    }
    function drawChunks(accept,shadow=false){let objects=0,count=0;for(const c of chunks.values())if(accept(c)){renderBatch(c.batch,c.buffer,false,shadow);objects+=c.entries.length;count++;}if(shadow){stats.shadowChunks=count;stats.shadowStatic=objects;}else{stats.visibleChunks=count;stats.staticVisible=objects;stats.staticCulled=world.length-objects;}return count;}
    function setWorld(meshes,points,atmosphere,setOptions) {
      localWind.reset();
      const partition=partitionState=partitionWorld(meshes);environment=environmentInfo(atmosphere);world=partition.world;worldIndex=spatialIndex(world,environment,undefined,setOptions);backgroundIndex=spatialIndex(partition.background,environment,undefined,setOptions);lights=points||[];worldBatch=pack([]);shadowLight=null;actorLightPlan=null;stats.staticTotal=world.length+backgroundIndex.entries.length;stats.biome=environment?environment.biome:null;
      worldRevision=0;stats.worldRevision=0;indexRevision++;viewCache=torchCache=sunCache=null;for(const c of chunks.values())gl.deleteBuffer(c.buffer);chunks.clear();chunkState.index=null;chunkState.epoch=0;
      lampCasters=[];for(const cache of staticCaches){cache.entries=[];cache.batch=pack([]);}
      // A scene can be detached during loading without another draw. Release
      // last-frame mesh references while retaining compiled GPU resources.
      ordinary.length=overlay.length=particles.length=overlayParticles.length=0;packFx([],null,[0,0,0]);
      pdrLots.length=0;for(const slot of pdrSlots)if(slot){slot.lot=null;slot.version=NaN;}probeBatch=null;probeKey='';
      governor.reset();autoScale=1;
      if(stats.contextLost||disposed) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,worldBuffer);gl.bufferData(gl.ARRAY_BUFFER,worldBatch.values,gl.STATIC_DRAW);
    }
    function updateWorld(meshes,revision,points,updateOptions){
      if(disposed||revision===worldRevision&&!updateOptions?.full)return false;
      if(Array.isArray(points)&&(points.length!==lights.length||points.some((light,i)=>light!==lights[i]))){lights=points;if(!lights.includes(shadowLight))shadowLight=null;}
      const partition=partitionState=partitionWorld(meshes,partitionState,updateOptions),indexOptions=partition.meshDelta?{...updateOptions,meshDelta:partition.meshDelta}:updateOptions;world=partition.world;worldIndex=spatialIndex(world,environment,worldIndex,indexOptions);if(!partition.meshDelta)backgroundIndex=spatialIndex(partition.background,environment,backgroundIndex,updateOptions);stats.meshDeltaApplied=!!worldIndex.delta.fast;worldBatch=pack([]);if(chunks.size)rebuildChunks();indexRevision++;for(const cache of [viewCache,torchCache,sunCache])if(cache&&!changedSelection(worldIndex,cache.origin,cache.ranges))cache.revision=indexRevision;
      // Every depth view must stop referencing removed walls immediately. GPU
      // storage is reused; only the affected instance lists upload next draw.
      actorLightPlan=null;lampCasters=lampCasters.map(c=>c&&!changedSelection(worldIndex,c.p,[32,18,0])?c:null);const changed=new Set([...worldIndex.delta.removed,...worldIndex.delta.changed]);for(const cache of staticCaches)if(updateOptions?.full||cache.entries.some(e=>changed.has(e))){cache.entries=[];cache.batch=pack([]);}
      worldRevision=revision===undefined?worldRevision+1:revision;stats.worldRevision=worldRevision;stats.staticTotal=world.length+backgroundIndex.entries.length;
      return true;
    }
    function resize(next) {
      if(next!==undefined&&next!==quality){quality=next;governor.reset();autoScale=1;}
      if(surface){
        if(next!==undefined)surface.measure();const size=surface.size(),{width,height,ratio}=size;
        if(!drawing)return size;
        if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
        const actualWidth=Number(gl.drawingBufferWidth)||width,actualHeight=Number(gl.drawingBufferHeight)||height;
        surface.record(actualWidth,actualHeight);if(actualWidth!==width||actualHeight!==height)surface.stats.capped='gpu';
        stats.renderScale=surface.stats.scale;stats.pixelRatio=ratio;stats.width=actualWidth;stats.height=actualHeight;
        ensureTargets();gl.viewport(0,0,actualWidth,actualHeight);return size;
      }
      const pixelRatio=window.devicePixelRatio||1;
      let ratio=typeof quality==='number'?quality:quality==='low'?.8:quality==='high'?Math.min(pixelRatio,2):Math.min(pixelRatio,1.5);
      const cssWidth=canvas.clientWidth||window.innerWidth||800,cssHeight=canvas.clientHeight||window.innerHeight||600;
      ratio=Math.max(.5,Math.min(2,ratio));
      if(quality==='auto')ratio=Math.min(ratio,Math.sqrt(1800000/(cssWidth*cssHeight)))*autoScale;
      if(runtimeMaxPixels>0)ratio=Math.min(ratio,Math.sqrt(runtimeMaxPixels/(cssWidth*cssHeight)));
      const width=Math.max(1,Math.round(cssWidth*ratio)),height=Math.max(1,Math.round(cssHeight*ratio));
      if(canvas.width!==width||canvas.height!==height) {canvas.width=width;canvas.height=height;}
      stats.renderScale=autoScale;stats.pixelRatio=ratio;stats.width=width;stats.height=height;
      ensureTargets();
      gl.viewport(0,0,width,height);
      return {width,height,ratio};
    }
    function renderBatch(batch,buffer,upload,shadowPass=false,lignesStables=false) {
      if(!batch.groups.length) return;
      if(!lignesStables||upload)gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      if(upload){gl.bufferData(gl.ARRAY_BUFFER,batch.values,gl.DYNAMIC_DRAW);stats.uploadBytes+=batch.values.byteLength;}
      let enRepli=false;
      for(const group of batch.groups) {
        if(lignesStables)enRepli=lierLignesLot(buffer,group.offset,enRepli);
        else for(let i=2;i<6;i++)gl.vertexAttribPointer(i,4,gl.FLOAT,false,64,group.offset+(i-2)*16);
        const shape=source.ranges[group.name];
        gl.drawElementsInstanced(gl.TRIANGLES,shape.count,gl.UNSIGNED_INT,shape.offset,group.count);
        stats.drawCalls++;stats.triangles+=shape.count/3*group.count;if(!shadowPass)stats.instances+=group.count;
      }
    }
    // FERRO 0.3.11 (ombresPhoto) : part 1, les instances de chaque groupe hors de la tuile ; part 2, celles de la tuile.
    function renderPart(batch,buffer,part,colour=false){
      if(!batch.groups.length)return;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(const group of batch.groups){
        const near=group.near||0,count=part===2?near:group.count-near;if(!count)continue;
        const start=group.offset+(part===2?(group.count-near)*64:0);
        for(let i=2;i<6;i++)gl.vertexAttribPointer(i,4,gl.FLOAT,false,64,start+(i-2)*16);
        const shape=source.ranges[group.name];
        gl.drawElementsInstanced(gl.TRIANGLES,shape.count,gl.UNSIGNED_INT,shape.offset,count);
        stats.drawCalls++;stats.triangles+=shape.count/3*count;if(colour)stats.instances+=count;
      }
    }
    // Flux d'instances de chaque image (objets, effets, habitacle) : chaque envoi re-spécifie le stockage à sa taille
    // utile, données comprises (bufferData avec srcOffset et longueur, depuis l'espace de travail du packer, sans
    // sous-vue). C'est l'orphelinage de 0.3.9 : l'ancien stockage revient au pilote sans attendre le GPU, et rien n'est
    // mis à zéro. Un stockage à la capacité sans données, puis bufferSubData, faisait effacer toute la capacité à
    // chaque appel (WebGL initialise un stockage vide), jusqu'à trois fois par image pour les effets. capacity retient
    // la plus grande taille envoyée : la dépasser compte une création ; prewarm peut la relever (options.reserve). Le
    // coût réel côté pilote n'est pas mesuré ici.
    function streamUpload(stream,batch){
      // Une longueur nulle signifierait « jusqu'au bout » : un flux vide n'envoie rien.
      const floats=batch.length,bytes=floats*4;if(!floats)return;
      if(stream.capacity<bytes){stream.capacity=Math.max(bytes,stream.capacity*2,16384);created(1);}
      gl.bindBuffer(gl.ARRAY_BUFFER,stream.buffer);gl.bufferData(gl.ARRAY_BUFFER,batch.storage,gl.DYNAMIC_DRAW,0,floats);
      stats.uploadBytes+=bytes;
    }
    // Réserve de prewarm : relève la taille retenue, sans appel GL ; une course qui reste dessous ne compte aucune création.
    function reserveStream(stream,bytes){
      if(bytes>stream.capacity)stream.capacity=Math.ceil(bytes/16384)*16384;
    }
    function renderGroundCover(plan,near,far,shadowPass){
      let bound=null;
      for(let i=0;i<plan.count;i++){
        const at=i*4,group=plan.groups[plan.runs[at]],mode=plan.runs[at+1],first=plan.runs[at+2],count=plan.runs[at+3];
        const shape=mode?group.nearIndex.ranges[mode-1]:source.ranges[group.far.name],buffer=mode?near:far;if(!shape.count)continue;
        if(cacheLignesLots)bound=lierLignesLot(buffer,first*64,bound===buffer)?buffer:null;
        else{
          if(bound!==buffer){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);bound=buffer;}
          for(let k=2;k<6;k++)gl.vertexAttribPointer(k,4,gl.FLOAT,false,64,first*64+(k-2)*16);
        }
        gl.drawElementsInstanced(gl.TRIANGLES,shape.count,gl.UNSIGNED_INT,shape.offset,count);
        stats.drawCalls++;stats.triangles+=shape.count/3*count;if(!shadowPass)stats.instances+=count;
      }
    }
    function cached(e,origin,forward,demiDiag,k,margin,tilt,near,far){
      const dx=e.p[0]-origin[0],dy=e.p[1]-origin[1],dz=e.p[2]-origin[2],r=e.radius+margin,dist=Math.hypot(dx,dy,dz);
      if(dist>r+far)return false;
      if(dist<r+near+margin)return true;
      const c=(dx*forward[0]+dy*forward[1]+dz*forward[2])/dist;
      return c>=Math.cos(demiDiag+tilt+Math.asin(Math.min(1,r*k/dist)));
    }
    // Sélection de garde : un sur-ensemble reconstruit seulement quand la caméra sort de la
    // marge (D mètres, θ radians) ou quand le monde, le cadrage ou la portée changent.
    function selectionCache(previous,revision,origin,axes,horizontal,vertical,far,ranges,near,margin,tilt){
      if(previous&&previous.revision===revision&&previous.horizontal===horizontal&&previous.vertical===vertical&&previous.far>=far
        &&previous.ranges[0]>=ranges[0]&&previous.ranges[1]>=ranges[1]&&previous.ranges[2]>=ranges[2]
        &&Math.hypot(origin[0]-previous.origin[0],origin[1]-previous.origin[1],origin[2]-previous.origin[2])<=previous.margin
        &&axes.forward[0]*previous.forward[0]+axes.forward[1]*previous.forward[1]+axes.forward[2]*previous.forward[2]>=Math.cos(previous.tilt))return previous;
      selectionRebuilt=true;
      if(!worldIndex.entries.length){
        // Index vide (BITUME) : une garde unique, mise à jour sur place, sans tableau ni requête de cellules.
        const g=emptyGuard;g.revision=revision;g.horizontal=horizontal;g.vertical=vertical;g.far=far;g.margin=margin;g.tilt=tilt;
        for(let i=0;i<3;i++){g.origin[i]=origin[i];g.forward[i]=axes.forward[i];g.ranges[i]=ranges[i]>0?ranges[i]+margin:0;}
        return g;
      }
      const demiDiag=Math.atan(Math.hypot(horizontal,vertical)),k=Math.hypot(1,horizontal,vertical);
      // Un niveau à portée nulle doit rester exclu : ajouter la marge le ferait revenir dans la requête.
      // Pas de plafond sur la taille du sur-ensemble : le réduire ferait disparaître des objets
      // visibles. Le sur-ensemble reste côté processeur, le GPU ne reçoit que la sélection exacte.
      const query0=[ranges[0]>0?ranges[0]+margin:0,ranges[1]>0?ranges[1]+margin:0,ranges[2]>0?ranges[2]+margin:0],candidates=worldIndex.query(origin,query0),entries=[];
      for(let i=0;i<candidates.length;i++){const e=candidates[i];if(cached(e,origin,axes.forward,demiDiag,k,margin,tilt,near,far))entries.push(e);}
      // Pas de tri par index ici : le balayage de l'index spatial est deja deterministe et
      // stable tant que le cache est valide. Trier les casters d'ombre changerait l'ordre
      // d'emission et quelques pixels sur les faces coplanaires (preuve Chrome : ecart
      // 16/255 sur 30 pixels des scenarios camp17-a, camp17-b, camp6-a, legacy0-b).
      entries.gen=++selectionGen;
      return {revision,origin:[origin[0],origin[1],origin[2]],forward:[axes.forward[0],axes.forward[1],axes.forward[2]],horizontal,vertical,far,ranges:query0,margin,tilt,entries};
    }
    function renderStatic(entries,slot,shadow=false){
      const cache=staticCaches[slot],prior=cache.entries;
      let same=prior.length===entries.length;for(let i=0;same&&i<entries.length;i++)if(entries[i]!==prior[i])same=false;
      if(!same){cache.entries=entries;cache.batch=packIndexed(entries);}
      renderBatch(cache.batch,cache.buffer,!same,shadow);
    }
    function renderEffects(meshes,eye,time,clip=vp,origin){
      const batch=packFx(meshes,environment,eye,origin);stats.fxInstances+=batch.length/16;if(!batch.groups.length)return;
      gl.useProgram(fxProgram);
      if(origin)gl.uniform3fv(fxUniforms.uDrawOrigin,origin);
      gl.uniformMatrix4fv(fxUniforms.uViewProjection,false,clip);gl.uniform2f(fxUniforms.uWindTime,0,time);
      gl.uniform3fv(fxUniforms.uSkyTop,environment?.skyTop||[.2,.3,.4]);gl.uniform3fv(fxUniforms.uSkyBottom,environment?.skyBottom||[.5,.6,.6]);gl.uniform3fv(fxUniforms.uEye,eye);gl.uniform3fv(fxUniforms.uAmbient,environment?environment.ambient:[.12,.15,.16]);
      gl.uniform3fv(fxUniforms.uFogColor,environment?environment.fog:[.009,.018,.024]);gl.uniform2f(fxUniforms.uEnvironment,environment?1:0,environment?environment.fogDensity:.018);gl.uniform1f(fxUniforms.uTime,time);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      streamUpload(fxStream,batch);renderBatch(batch,fxBuffer,false);gl.depthMask(true);gl.disable(gl.BLEND);
      if(origin)gl.uniform3f(fxUniforms.uDrawOrigin,0,0,0);
      gl.useProgram(program);
    }
    function shadowPass(light,dynamicBatch,slot,torchAxes,time){
      const p=light.p,shadowAxes=torchAxes||{right:[1,0,0],up:[0,0,-1],forward:[0,-1,0]};
      const {right:r,up:u,forward:fw}=shadowAxes;
      shadowView.set([r[0],u[0],-fw[0],0,r[1],u[1],-fw[1],0,r[2],u[2],-fw[2],0,-(r[0]*p[0]+r[1]*p[1]+r[2]*p[2]),-(u[0]*p[0]+u[1]*p[1]+u[2]*p[2]),fw[0]*p[0]+fw[1]*p[1]+fw[2]*p[2],1]);
      const f=1/Math.tan((torchAxes?108:138)*Math.PI/360),near=torchAxes?.08:.15,far=32;
      shadowProjection.fill(0);shadowProjection[0]=shadowProjection[5]=f;shadowProjection[10]=(far+near)/(near-far);shadowProjection[11]=-1;shadowProjection[14]=2*far*near/(near-far);
      multiply(shadowProjection,shadowView,shadowMatrix);
      shadowMatrices.set(shadowMatrix,slot*16);
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);gl.viewport((slot%2)*shadowTarget.size,Math.floor(slot/2)*shadowTarget.size,shadowTarget.size,shadowTarget.size);
      gl.useProgram(depthProgram);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.1,2.0);gl.uniformMatrix4fv(depthMatrix,false,shadowMatrix);gl.uniform2f(depthWind,weather.wind,time);
      bindLocalWind(depthLocalWind);
      const tangent=1/f;
      const previous=lampCasters[slot];
      const stable=!torchAxes&&previous&&previous.light===light&&previous.p.every((v,k)=>v===p[k]);
      const casters=stable?previous.entries:!worldIndex.entries.length?EMPTY_ENTRIES:worldIndex.query(p,[32,18,0]).filter(e=>visible(e,p,shadowAxes,tangent,tangent,32));
      if(!torchAxes&&!stable)lampCasters[slot]={light,p:p.slice(),entries:casters};
      renderStatic(casters,slot+1,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    // Clip only the ends of each instanced range. The colour buffer, instance order
    // and offsets of the car's separate Photo tile stay intact, with at most one draw per shape.
    function selectSunCasters(batch,matrix){
      const rows=batch.storage,groups=sunCasters.groups;
      const nx=Math.hypot(matrix[0],matrix[4],matrix[8]),ny=Math.hypot(matrix[1],matrix[5],matrix[9]),nz=Math.hypot(matrix[2],matrix[6],matrix[10]);
      let written=0,culled=0,bounds=null,name;
      function outside(at){
        const x=rows[at],y=rows[at+1],z=rows[at+2];
        const dx=Math.abs(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])-1;
        const dy=Math.abs(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])-1;
        const dz=Math.abs(matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14])-1;
        if(dx<=0&&dy<=0&&dz<=0)return false;
        const material=rows[at+3],flags=rows[at+11];
        if((flags&24)||(material>10.5&&material<12.5)||(material>26.5&&material<27.5))return false;
        if(!bounds)bounds=rigidShapes.halfExtents(name);
        if(!bounds)return false;
        // The L1 radius encloses the scaled mesh under every rotation. Expand for float32
        // world/clip arithmetic; use the actual matrix sent to the depth shader, including snapping.
        const radius=(bounds[0]*Math.abs(rows[at+4])+bounds[1]*Math.abs(rows[at+5])+bounds[2]*Math.abs(rows[at+6]))*1.00001
          +.002+.000002*(1+Math.abs(x)+Math.abs(y)+Math.abs(z));
        return dx>nx*radius||dy>ny*radius||dz>nz*radius;
      }
      for(const group of batch.groups){
        name=group.name;bounds=null;
        const eligible=group.count-(group.near||0),start=group.offset/4;
        let first=start,end=start+eligible*16;
        while(first<end&&outside(first))first+=16;
        // first survived the first loop. Do not query that instance a second time.
        while(end-first>16&&outside(end-16))end-=16;
        const count=(end-first)/16;culled+=eligible-count;
        if(!count)continue;
        if(count===group.count){groups[written++]=group;continue;}
        const record=sunCasterRecords[written]||(sunCasterRecords[written]={name:'',count:0,offset:0});
        record.name=name;record.count=count;record.offset=first*4;groups[written++]=record;
      }
      groups.length=written;stats.sunCastersCulled=culled;
      return sunCasters;
    }
    function sunShadowPass(eye,axes,dynamicBatch,time,camera={},fx={},crowd=null){
      const sun=environment.sunDirection,fw=sun.map(v=>-v),length=Math.hypot(fw[0],fw[2]);
      const r=length>.0001?[-fw[2]/length,0,fw[0]/length]:[1,0,0],u=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]];
      // PDR : la vue RTS donne l'emprise visible au sol (camera.sun) ; avec fx.sunOnly, le soleil prend tout l'atlas.
      const area=camera.sun,full=!!fx.sunOnly,tile=full?shadowTarget.size*2:shadowTarget.size;
      const extent=area?area.extent:quality==='high'?36:28,texel=extent*2/tile;
      const center=area?area.center.slice():[eye[0]+axes.forward[0]*8,eye[1]+1.4,eye[2]+axes.forward[2]*8],dot=a=>a[0]*center[0]+a[1]*center[1]+a[2]*center[2];
      const xSnap=Math.round(dot(r)/texel)*texel-dot(r),ySnap=Math.round(dot(u)/texel)*texel-dot(u);
      for(let k=0;k<3;k++)center[k]+=r[k]*xSnap+u[k]*ySnap;
      const lift=area?area.depth*.5:55,p=center.map((v,k)=>v+sun[k]*lift);
      shadowView.set([r[0],u[0],-fw[0],0,r[1],u[1],-fw[1],0,r[2],u[2],-fw[2],0,-(r[0]*p[0]+r[1]*p[1]+r[2]*p[2]),-(u[0]*p[0]+u[1]*p[1]+u[2]*p[2]),fw[0]*p[0]+fw[1]*p[1]+fw[2]*p[2],1]);
      const near=1,far=area?area.depth:115;shadowProjection.fill(0);shadowProjection[0]=shadowProjection[5]=1/extent;shadowProjection[10]=-2/(far-near);shadowProjection[14]=-(far+near)/(far-near);shadowProjection[15]=1;
      if(photo){photoSunRange=far-near;photoSunTexel=texel;}
      multiply(shadowProjection,shadowView,shadowMatrix);shadowMatrices.set(shadowMatrix,16);
      if(cullSun&&cacheLignesLots)for(let i=0;i<12;i++)sunPlaneAbs[i]=Math.abs(shadowMatrix[i]);
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);
      if(full)gl.viewport(0,0,tile,tile);else gl.viewport(shadowTarget.size,0,shadowTarget.size,shadowTarget.size);
      gl.useProgram(depthProgram);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.1,2);
      gl.uniformMatrix4fv(depthMatrix,false,shadowMatrix);gl.uniform2f(depthWind,weather.wind,time);
      bindLocalWind(depthLocalWind);
      const inside=(e,classify)=>{
        const x=e.p[0]-p[0],y=e.p[1]-p[1],d=e.p[2]-p[2],radius=e.radius,limit=extent+radius;
        const hor=Math.abs(x*r[0]+y*r[1]+d*r[2]);if(!(hor<limit))return false;
        const vert=Math.abs(x*u[0]+y*u[1]+d*u[2]);if(!(vert<limit))return false;
        const z=x*fw[0]+y*fw[1]+d*fw[2];if(!(z+radius>near&&z-radius<far))return false;
        if(classify!==true)return true;
        // An entirely contained lot takes the original draw path without looking at its pages.
        return hor+radius<=extent&&vert+radius<=extent&&z-radius>=near&&z+radius<=far?2:1;
      };
      // Index vide (BITUME) : ni requête, ni filtre, ni tableau de projeteurs.
      const casters=camera.chunked||!worldIndex.entries.length?EMPTY_ENTRIES:camera.allStatic?worldIndex.entries:worldIndex.query(center,[extent+24,26,0]).filter(inside);
      renderStatic(casters,2,true);if(camera.chunked)drawChunks(inside,true);
      // BITUME : les lots dont la sphère touche le volume du soleil projettent leur ombre (version proche ou lointaine).
      const viewTangent=Math.tan(Math.max(FOV_MIN,Math.min(110,camera.fov||75))*Math.PI/360);
      if(warm){warm.cible='ombre';prechaufferLots(true);}else dessinerLots(eye,axes,0,viewTangent,0,inside);
      if(cullSun&&!warm)renderBatch(selectSunCasters(dynamicBatch,shadowMatrix),dynamicBuffer,false,true);
      else if(photoSplit)renderPart(dynamicBatch,dynamicBuffer,1);
      else renderBatch(dynamicBatch,dynamicBuffer,false,true);
      if(crowd)renderBatch(crowd,crowdBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);
      // PDR (lots) : les lots du jeu (fx.lots) entrent dans la même vue du soleil, au même biais, rétabli pour eux.
      // PDR (foule) : la foule sur le GPU aussi (fx.foule.ombre) ; au retour, le moteur reprend son état GL.
      const pdrOmbre=fx.foule&&typeof fx.foule.ombre==='function';
      if(pdrLots.length||pdrOmbre){
        gl.enable(gl.POLYGON_OFFSET_FILL);
        for(const entry of pdrLots)renderBatch(entry.lot,entry.buffer,false,true);
        if(pdrOmbre){
          pdrMatriceSoleil.set(shadowMatrix);pdrLumiere.direction=sun;pdrLumiere.texel=texel;pdrLumiere.plein=full;
          pdrLumiere.viewport[0]=full?0:shadowTarget.size;pdrLumiere.viewport[1]=0;pdrLumiere.viewport[2]=pdrLumiere.viewport[3]=tile;
          pdrLumiere.centre=center;pdrLumiere.etendue=extent;pdrLumiere.profondeur=far;
          if(photo)photoQuitte();
          pdrCompter(fx.foule.ombre(gl,pdrLumiere),true);
          if(photo)photoReprend(false);
          gl.useProgram(depthProgram);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.depthMask(true);gl.disable(gl.BLEND);
        }
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
    }
    // PDR (foule) : ce que rend un point d'accroche ({ appels, triangles, instances }) entre dans les statistiques du moteur.
    function pdrCompter(r,shadow){
      if(!r)return;stats.drawCalls+=r.appels||0;stats.triangles+=r.triangles||0;if(!shadow)stats.instances+=r.instances||0;
    }
    function skyPass(axes,f,time,weather,cloudOffset,probeSize=0){
      if(fskyProgram&&environment.sky){const sky=environment.sky;gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(fskyProgram);bindScreen(fskyProgram);skyCamera.mask=composeScreen?1:0;if(fskyBound!==sky){window.FSky.bind(gl,fskyProgram,sky.uniforms,fskyCache);fskyBound=sky;}Object.assign(skyCamera,{right:axes.right,up:axes.up,forward:axes.forward,height:probeSize||canvas.height,time});skyCamera.fov[0]=(probeSize?1:canvas.width/canvas.height)/f;skyCamera.fov[1]=1/f;window.FSky.bind(gl,fskyProgram,window.FSky.frameUniforms(skyCamera,skyFrame),fskyCache);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls++;stats.sky=sky.id;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);return;}
      const sky=weather; // BITUME : ciel et monde partagent la même ambiance météo.
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(skyProgram);bindScreen(skyProgram);
      gl.uniform3fv(skyUniforms.uSkyRight,axes.right);gl.uniform3fv(skyUniforms.uSkyUp,axes.up);gl.uniform3fv(skyUniforms.uSkyForward,axes.forward);
      gl.uniform3fv(skyUniforms.uSkyTop,sky.skyTop);gl.uniform3fv(skyUniforms.uSkyBottom,sky.skyBottom);gl.uniform3fv(skyUniforms.uSkyFog,sky.fog);
      gl.uniform3fv(skyUniforms.uSunDirection,environment.sunDirection);gl.uniform3fv(skyUniforms.uSunColor,sky.sunColor);
      gl.uniform1f(skyUniforms.uSkyNight,environment.night);
      gl.uniform2f(skyUniforms.uSkyFov,(probeSize?1:canvas.width/canvas.height)/f,1/f);gl.uniform4fv(skyUniforms.uWeather,sky.values);gl.uniform2f(skyUniforms.uSkyMotion,time,sky.wind);gl.uniform2fv(skyUniforms.uCloudOffset,cloudOffset);gl.drawArrays(gl.TRIANGLES,0,3);
      stats.drawCalls++;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
    }
    function reflectionsPass(useMask,fovea){
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(ssrProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,post.reflection.framebuffer);gl.viewport(0,0,post.reflection.width,post.reflection.height);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,post.reflectSource.texture);gl.uniform1i(ssrUniforms.uColor,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,post.reflectSource.depthTexture);gl.uniform1i(ssrUniforms.uDepth,1);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,useMask?post.a.texture:whiteTexture);
      gl.uniform1i(ssrUniforms.uReceiverTiles,2);gl.uniform1i(ssrUniforms.uReceiverMask,useMask?1:0);
      if(fovea||foveaSsrPose){if(fovea)gl.uniform4fv(ssrUniforms.uFovea,fovea);else gl.uniform4f(ssrUniforms.uFovea,0,0,0,0);foveaSsrPose=!!fovea;}
      gl.uniform4f(ssrUniforms.uProjection,1/projection[0],1/projection[5],projection[10],projection[14]);gl.uniform2f(ssrUniforms.uPixel,1/canvas.width,1/canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls++;
    }
    function postPass(sceneTexture,hasOverlay,fovea){
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(postProgram);bindScreen(postProgram);
      gl.uniform1i(postUniforms.uScene,0);gl.uniform1i(postUniforms.uBloom,1);gl.uniform1i(postUniforms.uReflection,3);gl.uniform1i(postUniforms.uReflections,stats.reflections?1:0);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,post.reflection?.texture||whiteTexture);
      if(composeScreen&&!stats.bloom){
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneTexture);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
        gl.uniform1i(postUniforms.uPass,3);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls++;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);return;
      }
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneTexture);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);
      gl.bindFramebuffer(gl.FRAMEBUFFER,post.a.framebuffer);gl.viewport(0,0,post.a.width,post.a.height);
      gl.uniform1i(postUniforms.uPass,0);gl.uniform2f(postUniforms.uTexel,1/canvas.width,1/canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);
      if(stats.reflections){
        reflectionsPass(hasOverlay&&canvas.width%4===0&&canvas.height%4===0,fovea);
        gl.useProgram(postProgram);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneTexture);
        gl.activeTexture(gl.TEXTURE1);gl.viewport(0,0,post.b.width,post.b.height);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,post.b.framebuffer);gl.bindTexture(gl.TEXTURE_2D,post.a.texture);
      gl.uniform1i(postUniforms.uPass,1);gl.uniform2f(postUniforms.uTexel,1/post.a.width,1/post.a.height);gl.drawArrays(gl.TRIANGLES,0,3);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);
      gl.uniform1i(postUniforms.uPass,2);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls+=3;
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.activeTexture(gl.TEXTURE0);
    }
    function lightPlan(eye){
      const distanceTo=light=>(light.p[0]-eye[0])**2+(light.p[1]-eye[1])**2+(light.p[2]-eye[2])**2;
      const sorted=lights.map(light=>({light,d:distanceTo(light)})).sort((a,b)=>a.d-b.d);
      const candidate=sorted.find(entry=>entry.light.p[1]>=2.5&&(entry.light.power||1)>=7)||sorted.find(entry=>entry.light.p[1]>=2.5);
      let chosen=shadowLight;
      if(candidate&&(!chosen||distanceTo(chosen)>candidate.d*1.35+5))chosen=candidate.light;
      if(!candidate)chosen=null;
      const second=sorted.find(entry=>entry.light!==chosen&&entry.light.p[1]>=2.5);
      return {sorted,distanceTo,chosen,shadowLights:chosen?[chosen,...(second&&!environment?[second.light]:[])]:[]};
    }
    // Called once before model construction. A rejected enclosing sphere cannot
    // reach the camera OR any GPU shadow pass, including offscreen sun casters.
    // This changes neither geometry nor shadow resolution/order for kept actors.
    function actorFilter(camera,fx={}){
      stats.actorsConsidered=stats.actorsCulled=0;actorLightPlan=null;if(options.sceneReflections&&['probe','screen'].includes(fx.reflections)){stats.actorFilterMode='reflection';return ()=>true;}
      if(disposed||stats.contextLost){stats.actorFilterMode='inactive';return ()=>true;}
      const t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0],axes=cameraAxes(camera);
      const eye=[p[0]+Math.sin(t*57)*shake*.025,p[1]+Math.sin(t*71)*shake*.015,p[2]];
      const cssWidth=canvas.clientWidth||window.innerWidth||800,cssHeight=canvas.clientHeight||window.innerHeight||600;
      // resize may round/adapt resolution during draw. Enclose every allowed
      // rounded aspect instead of relying on the previous backing-store size.
      const aspect=Math.max(canvas.width/Math.max(1,canvas.height),cssWidth/cssHeight)+(1+cssWidth/cssHeight)/Math.max(1,cssHeight*.3);
      const tangent=Math.tan(Math.max(FOV_MIN,Math.min(110,camera.fov||75))*Math.PI/360),views=[{eye,axes,h:aspect*tangent,v:tangent,far:camera.far||180}];
      const shadows=shadowsEnabled(fx);
      let sunVolume=null;
      if(shadows){
        const plan=lightPlan(eye);actorLightPlan={eye:eye.slice(),previous:shadowLight,plan};
        const {shadowLights}=plan,down={right:[1,0,0],up:[0,0,-1],forward:[0,-1,0]},lampTangent=Math.tan(138*Math.PI/360);
        if(!fx.sunOnly){
          for(const light of shadowLights)views.push({eye:light.p,axes:down,h:lampTangent,v:lampTangent,far:32});
          const torch=eye.map((v,i)=>v+axes.right[i]*.16-axes.up[i]*.08),torchTangent=Math.tan(108*Math.PI/360);
          views.push({eye:torch,axes,h:torchTangent,v:torchTangent,far:32});
        }
        if(environment){
          const sun=environment.sunDirection,fw=sun.map(v=>-v),length=Math.hypot(fw[0],fw[2]);
          const right=length>.0001?[-fw[2]/length,0,fw[0]/length]:[1,0,0],up=[right[1]*fw[2]-right[2]*fw[1],right[2]*fw[0]-right[0]*fw[2],right[0]*fw[1]-right[1]*fw[0]];
          // The real pass snaps this centre by <=.071 m. A quarter metre guard
          // includes the entire snap and PCF border at both atlas resolutions.
          const area=camera.sun;
          sunVolume=area?{center:area.center,right,up,forward:fw,extent:area.extent+1,lift:area.depth*.5,depth:area.depth}
            :{center:[eye[0]+axes.forward[0]*8,eye[1]+1.4,eye[2]+axes.forward[2]*8],right,up,forward:fw,extent:(quality==='high'?36:28)+.25,lift:55,depth:115};
        }
      }
      stats.actorFilterMode=shadows?'camera-and-shadow-frusta':'camera-frustum';stats.actorFilterVolumes=views.length+(sunVolume?1:0);
      return (x,y,z,radius)=>{
        stats.actorsConsidered++;
        if(![x,y,z,radius].every(Number.isFinite)||radius<0)return true;
        const e={p:[x,y,z],radius:radius+.002};
        for(const v of views)if(visible(e,v.eye,v.axes,v.h,v.v,v.far))return true;
        if(sunVolume){
          const q=sunVolume,dx=x-q.center[0],dy=y-q.center[1],dz=z-q.center[2],dot=a=>dx*a[0]+dy*a[1]+dz*a[2],depth=q.lift+dot(q.forward);
          if(Math.abs(dot(q.right))<=q.extent+e.radius&&Math.abs(dot(q.up))<=q.extent+e.radius&&depth+e.radius>=1&&depth-e.radius<=q.depth)return true;
        }
        stats.actorsCulled++;return false;
      };
    }
    // Le corps de draw. En préchauffage (warm), les états temporels du jeu ne bougent pas : gouverneur de
    // résolution, budget natif, vent local, mouvement de caméra, caches de vue et chronomètre GPU. Les nappes et
    // les lots sont tous tracés (proche et lointain), sous un ciseau d'un pixel posé avant le premier effacement.
    function render(camera,dynamic,fx) {
      if(disposed||stats.contextLost) return;
      const prof=warm?null:profiler;
      prof?.start();fx=fx||{};if(!warm){if(native){autoScale=1;if(fx.adaptive===true)watch.update(fx.frameMs);}else autoScale=governor.update(fx,quality);}drawing=true;try{resize();}finally{drawing=false;}
      if(warm){gl.enable(gl.SCISSOR_TEST);gl.scissor(0,0,1,1);}
      const reflectionMode=reflections&&['probe','screen'].includes(fx.reflections)?fx.reflections:'off';
      // Captures temporelles de FSceneReflections (sonde, écran) : jamais avancées par le préchauffage.
      // En qualité sans cible de scène, la sonde reste disponible sans les deux sorties MRT.
      const sceneMode=warm?'off':reflectionMode==='screen'&&!post?'probe':reflectionMode;
      ensureShadowTarget(fx);ensureOptionalTargets(fx,reflectionMode);composeScreen=!!post&&!!options.composition;stats.composition=composeScreen;
      screenValues[0]=Math.max(0,Math.min(1,fx.damage||0));screenValues[1]=Math.max(0,Math.min(1,fx.pulse||0));screenValues[2]=Number.isFinite(fx.brightness)?Math.max(.5,Math.min(2,fx.brightness)):1;screenValues[3]=fx.vignette===false?0:1;

      const t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0];
      // Resolve weather once, before depth passes: foliage and its shadows must
      // bend with the same current gusts and rain, including alternating views.
      bitumeWeather(environment,fx.weather,t,weather);
      const axes=cameraAxes(camera),{right,up,forward}=axes;
      const eye=[p[0]+Math.sin(t*57.)*shake*.025,p[1]+Math.sin(t*71.)*shake*.015,p[2]];
      if(!warm)localWind.update(fx.windSources,t);localWind.select(eye);stats.windSources=windFrame.count;stats.windCandidates=windFrame.candidates;stats.windUpdates=windFrame.updates;
      view.set([right[0],up[0],-forward[0],0,right[1],up[1],-forward[1],0,right[2],up[2],-forward[2],0,
        -(right[0]*eye[0]+right[1]*eye[1]+right[2]*eye[2]),-(up[0]*eye[0]+up[1]*eye[1]+up[2]*eye[2]),forward[0]*eye[0]+forward[1]*eye[1]+forward[2]*eye[2],1]);
      const fov=Math.max(FOV_MIN,Math.min(110,camera.fov||75))*Math.PI/180,f=1/Math.tan(fov*.5),near=camera.near||.045,far=camera.far||180;
      vegetation.update(fx,eye,1/f,canvas.height);stats.windStrength=vegetationState.strength;stats.groundCover=vegetationState.enabled;
      budgetDispositions=12;etatDispositions.reutilisations=etatDispositions.replis=0;
      sunIndexBudget.rows=512;sunIndexBudget.vertices=4096;stats.sunLotInstancesCulled=0;
      lotView.prepare(lots,eye,1/f,canvas.height,vegetationState);libererLotsInactifs();stats.lotDistanceTests=lotView.distanceTests;stats.lotInstanceTests=0;
      projection.fill(0);projection[0]=f/(canvas.width/canvas.height);projection[5]=f;projection[10]=(far+near)/(near-far);projection[11]=-1;projection[14]=2*far*near/(near-far);
      multiply(projection,view,vp);
      if(camera.chunked&&!chunks.size)rebuildChunks();
      const ranges=detailRanges(quality);ranges[0]=extendedDistance(ranges[0],environment,eye);stats.viewDistance=ranges[0];
      // PDR : vue de haut, tout le décor part au GPU en un seul lot stable : ni tri ni nouvel envoi quand la caméra bouge,
      // le découpage au champ se fait au clip. Sans camera.allStatic, le tri par portée de FERRO reste inchangé.
      const horizontal=canvas.width/canvas.height/f,vertical=1/f,empty=!worldIndex.entries.length;
      setFrustumRadii(colourRadii,horizontal,vertical);
      if(!warm){cacheStats.viewFrames++;trackMotion(eye,axes.forward,t);stats.cache=cacheStats;}
      const margin=margins(Math.atan(Math.hypot(horizontal,vertical)),warm?warmMargin:guardMargin);
      let guard=null;
      if(!camera.chunked&&!camera.allStatic){
        // Le préchauffage construit sa propre garde sans toucher au cache de vue du jeu ; sur un index vide, aucune.
        if(warm)guard=empty?emptyGuard:selectionCache(null,indexRevision,eye,axes,horizontal,vertical,ranges[0],ranges,near,margin.distance,margin.tilt);
        else{selectionRebuilt=false;guard=viewCache=selectionCache(viewCache,indexRevision,eye,axes,horizontal,vertical,ranges[0],ranges,near,margin.distance,margin.tilt);if(selectionRebuilt)cacheStats.viewRebuilds++;}
      }
      let shown;
      if(camera.chunked||empty)shown=EMPTY_ENTRIES;
      else if(camera.allStatic)shown=worldIndex.entries;
      else{
        // Jeu : celle des deux sélections que le cache statique ne référence pas. Préchauffage : un tableau propre,
        // pour que les tableaux du jeu (restaurés ensuite dans le cache) ne soient jamais réécrits.
        const list=guard.entries;shown=warm?[]:staticCaches[0].entries===shownA?shownB:shownA;shown.length=0;
        for(let i=0;i<list.length;i++){const e=list[i],q=e.p,d=q.length===3?Math.hypot(q[0]-eye[0],q[1]-eye[1],q[2]-eye[2]):Math.hypot(...q.map((v,k)=>v-eye[k]));
          if(d<=ranges[e.detail]+e.radius&&visible(e,eye,axes,horizontal,vertical,ranges[0],colourRadii))shown.push(e);}
      }
      stats.staticSuperset=guard?.entries.length||shown.length;
      stats.staticVisible=shown.length;stats.staticCulled=world.length-shown.length;
      const planned=actorLightPlan&&actorLightPlan.previous===shadowLight&&eye.every((v,k)=>v===actorLightPlan.eye[k])?actorLightPlan.plan:lightPlan(eye);actorLightPlan=null;
      const {sorted,distanceTo,chosen}=planned,shadowLights=fx.headlight?[fx.headlight]:planned.shadowLights;shadowLight=chosen;
      // PDR (lampes) : huit lampes passagères (quatre en qualité basse) au lieu de trois : les huit foyers les plus proches
      // de la visée éclairent façades et foule (decor.js) ; la ville n'a pas de lampe fixe, les douze places restent assez.
      const transient=transientLights(fx.lights,eye,quality==='low'?4:8);stats.dynamicLights=transient.length;
      const selected=shadowLights.map(light=>({light,d:distanceTo(light)})).concat(transient.map(light=>({light,d:distanceTo(light)})),sorted.filter(entry=>!shadowLights.includes(entry.light)).slice(0,(quality==='low'?6:12)-shadowLights.length-transient.length));
      const blackout=horrorLights(fx.horror,lights);stats.blackoutLights=blackout?.size||0;
      lightPositions.fill(0);lightColors.fill(0);lightRanges.fill(0);lightDirections.fill(0);lightCones.fill(0);
      for(let i=0;i<selected.length;i++){const light=selected[i].light;if(light.dir){lightDirections.set(light.dir,i*3);lightCones.set(light.cone||DEFAULT_CONE,i*2);}lightPositions.set(light.p,i*3);lightRanges[i]=light.range||0;const c=light.color||WHITE,power=(light.power===undefined?1:light.power)*(blackout?.get(light)??1);lightColors[i*3]=c[0]*power;lightColors[i*3+1]=c[1]*power;lightColors[i*3+2]=c[2]*power;}
      const tuile=photo?photoTuile(fx,camera):null;photoSplit=!!tuile;photoOverlay=null;
      const drawOrigin=cameraRelativeOverlay?eye:undefined;
      partitionDynamic(dynamic,tuile);
      const colourOverlay=overlayView?overlayView.select(overlay,eye,axes,horizontal,vertical,colourRadii,warm):overlay;
      stats.overlayCulled=overlay.length-colourOverlay.length;
      const dynamicBatch=tuile?packSplit(ordinary,nearOrdinary,environment):packDynamic(ordinary,environment,true);
      const torchPosition=eye.map((v,i)=>v+right[i]*.16-up[i]*.08);
      stats.drawCalls=0;stats.triangles=0;stats.instances=0;stats.bloom=!!post&&fx.bloom!==false;stats.shadows=!!shadowTarget&&shadowsEnabled(fx);stats.shadowMaps=stats.shadows?shadowLights.length+1+(environment?1:0):0;stats.shadowMode=environment?'sun-atlas':'atlas';
      stats.uploadBytes=0;stats.fxInstances=0;stats.sunCastersCulled=0;
      // Animated instances are shared unchanged by every depth and colour pass.
      streamUpload(dynamicStream,dynamicBatch);
      const crowd=fx.instances&&fx.instances.groups&&fx.instances.groups.length?fx.instances:null,sunOnly=!!fx.sunOnly;
      stats.crowdInstances=crowd?crowd.values.length/16:0;stats.shadowMaps=stats.shadows?(sunOnly?0:shadowLights.length+(fx.torch!==false?1:0))+(environment?1:0):0;
      if(crowd){if(!crowdBuffer){crowdBuffer=gl.createBuffer();created(1);}gl.bindBuffer(gl.ARRAY_BUFFER,crowdBuffer);gl.bufferData(gl.ARRAY_BUFFER,crowd.values,gl.DYNAMIC_DRAW);stats.uploadBytes+=crowd.values.byteLength;}
      // PDR (lots) : lots déjà empaquetés par le jeu (fx.lots : le décor), au format de pack. Un lot ne repart au GPU que si
      // l'objet ou sa version (lot.version) change ; il sert ensuite à l'ombre du soleil et à la passe couleur.
      pdrLots.length=0;stats.pdrLotInstances=0;
      if(Array.isArray(fx.lots))for(let i=0;i<fx.lots.length;i++){
        const lot=fx.lots[i];if(!lot||!lot.values||!lot.groups||!lot.groups.length)continue;
        let slot=pdrSlots[i];if(!slot){slot=pdrSlots[i]={buffer:gl.createBuffer(),lot:null,version:NaN};created(1);}
        if(slot.lot!==lot||slot.version!==lot.version){
          gl.bindBuffer(gl.ARRAY_BUFFER,slot.buffer);gl.bufferData(gl.ARRAY_BUFFER,lot.values,gl.DYNAMIC_DRAW);stats.uploadBytes+=lot.values.byteLength;
          slot.lot=lot;slot.version=lot.version;
        }
        pdrLots.push(slot);stats.pdrLotInstances+=lot.values.length/16;
      }
      prof?.begin('shadows');
      if(stats.shadows){
        gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);gl.clear(gl.DEPTH_BUFFER_BIT);
        if(!sunOnly)shadowLights.forEach((light,i)=>{const fw=light.dir,axes=fw?{forward:fw,right:[-fw[2],0,fw[0]],up:[0,1,0]}:null;shadowPass(light,dynamicBatch,i,axes,t);});
        if(environment)sunShadowPass(eye,axes,dynamicBatch,t,camera,fx,crowd);
        if(!sunOnly&&fx.torch!==false)shadowPass({p:torchPosition},dynamicBatch,2,axes,t);
        if(tuile)photoTilePass(tuile,dynamicBatch,colourOverlay,t,drawOrigin);
      }
      prof?.end();
      stats.reflections=reflectionMode==='off'&&!!(stats.bloom&&post.reflectSource&&post.reflection&&fx.reflections!==false&&fx.reflections!=='off');stats.reflectionSteps=stats.reflections?18:0;stats.lotsOccultes=0;stats.nappesOccultees=0;
      const avecOverlay=colourOverlay.length>0||overlayParticles.length>0;
      // Sans habitacle superposé, la couleur finale et l'entrée du SSR historique sont la même image.
      // Avec habitacle, conserver séparément le monde et sa profondeur avant le clear de l'overlay.
      const refletDirect=stats.reflections&&!avecOverlay;
      const couleurFinale=refletDirect?post.reflectSource:post?.scene;
      const presenterEcran=sceneMode==='screen'&&!stats.bloom&&!composeScreen;
      const cibleFinale=(stats.bloom||composeScreen||presenterEcran)?couleurFinale.framebuffer:null;
      if(!warm)reflections?.beginScreen(post?.scene,sceneMode);if(sceneMode==='screen'){gl.clearBufferfv(gl.COLOR,1,ZERO4);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);}
      // Le MSAA explicite possède sa cible : un profil sans halo peut lisser l'image sans allumer le post-traitement.
      const msaa=stats.msaa?msaaBuffer:null, cibleMonde=msaa?msaa.framebuffer:cibleFinale;
      gl.bindFramebuffer(gl.FRAMEBUFFER,cibleMonde);gl.viewport(0,0,canvas.width,canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(environment)skyPass(axes,f,t,weather,fx.cloudOffset||weather.cloudOffset);gl.useProgram(program);gl.bindVertexArray(vao);
      bindScreen(program);bindSkyFog(program);gl.uniformMatrix4fv(uniforms.uViewProjection,false,vp);gl.uniform3fv(uniforms.uEye,eye);gl.uniform3fv(uniforms.uForward,forward);
      gl.uniform4fv(uniforms.uSeaOrigin,fx.sea?.origin||SEA_ORIGIN);gl.uniform4fv(uniforms.uSeaMotion,fx.sea?.motion||SEA_MOTION);
      gl.uniform2fv(uniforms.uCloudOffset,fx.cloudOffset||weather.cloudOffset);gl.uniform2f(uniforms.uWindTime,weather.wind,t);gl.uniform3fv(uniforms.uSunDirection,environment?environment.sunDirection:[.4,.8,.3]);gl.uniform3fv(uniforms.uSunColor,weather.sunColor);
      bindLocalWind(uniforms);
      gl.uniform3fv(uniforms.uAmbient,weather.ambient);gl.uniform3fv(uniforms.uFogColor,weather.fog);gl.uniform2f(uniforms.uEnvironment,environment?1:0,weather.fogDensity);
      gl.uniform2f(uniforms.uNightHour,environment?.night||0,environment?.hour??14);
      gl.uniform3fv(uniforms.uSkyTop,weather.skyTop);gl.uniform3fv(uniforms.uSkyBottom,weather.skyBottom);
      for(let k=0;k<pbrTextures.length;k++){gl.activeTexture(gl.TEXTURE5+k);gl.bindTexture(gl.TEXTURE_2D_ARRAY,pbrTextures[k]);}
      gl.uniform1f(uniforms.uOverlayMode,options?.overlayLighting==='world'?1:0);gl.uniform1f(uniforms.uSeaMode,options?.sea===false?0:1);gl.uniform1f(uniforms.uPhoto,fx.photo||0);if(fx.fovea||foveaPose){if(fx.fovea)gl.uniform4fv(uniforms.uFovea,fx.fovea);else gl.uniform4f(uniforms.uFovea,0,0,0,0);foveaPose=!!fx.fovea;}gl.uniform4fv(uniforms.uWeather,weather.values);gl.uniform3fv(uniforms.uLightDirection,lightDirections);gl.uniform2fv(uniforms.uLightCone,lightCones);gl.uniform3fv(uniforms.uLightPosition,lightPositions);gl.uniform3fv(uniforms.uLightColor,lightColors);gl.uniform1fv(uniforms.uLightRange,lightRanges);gl.uniform1i(uniforms.uLightCount,selected.length);
      gl.uniform2f(uniforms.uResolution,canvas.width,canvas.height);gl.uniform4f(uniforms.uEffects,t,fx.flash||0,fx.damage||0,Math.max(0,Math.min(1,fx.pulse||0)));
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,stats.shadows?shadowTarget.texture:whiteTexture);gl.uniform1i(uniforms.uShadowMap,2);
      gl.uniformMatrix4fv(uniforms.uShadowMatrix,false,shadowMatrices);gl.uniform4f(uniforms.uShadowSettings,stats.shadows&&!sunOnly?shadowLights.length:0,shadowTarget?1/(shadowTarget.size*2):1,stats.shadows&&!sunOnly&&fx.torch!==false?1:0,stats.shadows&&environment?(sunOnly?2:1):0);
      if(photo)photoBind(fx,tuile,sunOnly);
      // PDR : sans lampe torche (fx.torch === false), sa source est renvoyée assez loin pour ne plus rien éclairer.
      gl.uniform3fv(uniforms.uTorchPosition,fx.torch===false?TORCH_OFF:torchPosition);
      // PDR (voile) : fx.voile = { texture R8, origine [x0, z0], taille [largeur, profondeur], force } sur l'unité 4. Sans
      // voile, rien n'est posé ; à la première image sans lui, la texture blanche reprend l'unité et la force revient à 0.
      const voile=fx.voile&&fx.voile.texture&&fx.voile.force>0?fx.voile:null;
      if(voile||pdrVoilePose){
        gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,voile?voile.texture:whiteTexture);
        if(voile)gl.uniform4f(uniforms.uVoileZone,voile.origine[0],voile.origine[1],1/Math.max(.001,voile.taille[0]),1/Math.max(.001,voile.taille[1]));
        gl.uniform1f(uniforms.uVoileForce,voile?Math.min(1,voile.force):0);gl.activeTexture(gl.TEXTURE2);pdrVoilePose=!!voile;
      }
      if(reflections){
        if(!warm&&(!prof||prof.begin('reflection-probe'))){reflections.update(sceneMode,eye,dynamic||[],worldRevision,t,(origin,face,size)=>{
          gl.clearColor(...(environment?.skyBottom||[.12,.16,.18]),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(environment)skyPass(face,1,t,weather,weather.cloudOffset,size);
          gl.useProgram(program);gl.bindVertexArray(vao);bindSkyFog(program);bindScreen(program);reflections.bind(uniforms,false);
          const {right:r,up:u,forward:f}=face;probeView.set([r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-(r[0]*origin[0]+r[1]*origin[1]+r[2]*origin[2]),-(u[0]*origin[0]+u[1]*origin[1]+u[2]*origin[2]),f[0]*origin[0]+f[1]*origin[1]+f[2]*origin[2],1]);probeProjection.fill(0);probeProjection[0]=probeProjection[5]=1;probeProjection[10]=(48+.045)/(.045-48);probeProjection[11]=-1;probeProjection[14]=2*48*.045/(.045-48);multiply(probeProjection,probeView,probeVP);
          gl.uniformMatrix4fv(uniforms.uViewProjection,false,probeVP);gl.uniform3fv(uniforms.uEye,origin);gl.uniform3fv(uniforms.uForward,forward);gl.uniform2f(uniforms.uResolution,size,size);gl.uniform4f(uniforms.uShadowSettings,0,1,0,0);gl.uniform4f(uniforms.uEffects,t,fx.flash||0,0,0);
          const key=worldRevision+':'+origin.join(',');if(probeKey!==key){probeKey=key;probeBatch=pack(worldIndex.query(origin,[48,48,48]).map(e=>e.mesh),environment);gl.bindBuffer(gl.ARRAY_BUFFER,probeBuffer);gl.bufferData(gl.ARRAY_BUFFER,probeBatch.values,gl.DYNAMIC_DRAW);}
          renderBatch(probeBatch,probeBuffer,false);renderBatch(dynamicBatch,dynamicBuffer,false);if(particles.length)renderEffects(particles,origin,t);
        });prof?.end();}
        gl.bindFramebuffer(gl.FRAMEBUFFER,cibleMonde);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.035,.06,.073,1);gl.useProgram(program);gl.bindVertexArray(vao);reflections.bind(uniforms,sceneMode!=='off');gl.uniformMatrix4fv(uniforms.uViewProjection,false,vp);gl.uniform3fv(uniforms.uEye,eye);gl.uniform3fv(uniforms.uForward,forward);gl.uniform2f(uniforms.uResolution,canvas.width,canvas.height);gl.uniform4f(uniforms.uEffects,t,fx.flash||0,fx.damage||0,Math.max(0,Math.min(1,fx.pulse||0)));gl.uniform4f(uniforms.uShadowSettings,stats.shadows&&!sunOnly?shadowLights.length:0,shadowTarget?1/(shadowTarget.size*2):1,stats.shadows&&!sunOnly&&fx.torch!==false?1:0,stats.shadows&&environment?(sunOnly?2:1):0);
      }
      if(sceneMode==='screen')gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
      prof?.begin('world');
      // The distant sea is a sky-like backdrop: it must not compete with land
      // only centimetres above it at kilometre distances. Local water retains depth/SSR.
      stats.backgroundWater=backgroundIndex.entries.length;stats.backgroundDrawCalls=0;
      if(backgroundIndex.entries.length){const before=stats.drawCalls;gl.depthMask(false);renderStatic(backgroundIndex.entries,4);gl.depthMask(true);stats.backgroundDrawCalls=stats.drawCalls-before;}
      renderStatic(shown,0);if(camera.chunked)drawChunks(c=>visible(c,eye,axes,horizontal,vertical,Math.min(far,c.range),colourRadii));
      // BITUME : chaussée et terrain, puis décor par lots, découpés au champ et à la portée de chaque lot.
      if(warm){warm.cible='couleur '+(msaa?'msaa'+msaa.samples:(stats.bloom||composeScreen)?'scene':'ecran');prechaufferNappes();stats.lotsVisibles=prechaufferLots(false);}
      else{dessinerNappes(eye,axes,horizontal,vertical,far,colourRadii,fx.masqueNappes);stats.lotsVisibles=dessinerLots(eye,axes,horizontal,vertical,far,null,colourRadii,fx.masqueLots);}
      renderBatch(dynamicBatch,dynamicBuffer,false);
      if(crowd)renderBatch(crowd,crowdBuffer,false);
      // PDR (lots) : les lots du jeu, dans la cible de la scène (MSAA), avant les effets translucides.
      for(const entry of pdrLots)renderBatch(entry.lot,entry.buffer,false);
      if(sceneMode==='screen')gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      // PDR (foule) : puis la foule sur le GPU (fx.foule.couleur), dans la même cible ; au retour, le moteur reprend son état GL.
      if(fx.foule&&typeof fx.foule.couleur==='function'){
        const v=pdrVue,ombre=v.ombre;
        v.oeil=eye;v.avant=forward;v.droite=right;v.haut=up;v.fov=fov;v.tangente=1/f;v.focale=canvas.height*f*.5;v.largeur=canvas.width;v.hauteur=canvas.height;
        v.near=near;v.far=far;v.temps=t;v.qualite=quality;v.msaa=msaa?msaa.samples:0;
        const env=environment||PDR_INDOOR;
        v.soleil=env.sunDirection;v.couleurSoleil=env.sunColor;v.ambiance=env.ambient;v.brouillard=env.fog;
        v.densiteBrouillard=env.fogDensity;v.cielHaut=env.skyTop;v.cielBas=env.skyBottom;
        ombre.texture=stats.shadows?shadowTarget.texture:whiteTexture;ombre.active=!!(stats.shadows&&environment);ombre.plein=sunOnly;
        ombre.texel=shadowTarget?1/(shadowTarget.size*2):1;if(ombre.active)for(let k=0;k<16;k++)pdrMatriceSoleil[k]=shadowMatrices[16+k];
        v.lumieres.nombre=selected.length;
        if(photo)photoQuitte();
        pdrCompter(fx.foule.couleur(gl,v),false);
        if(photo)photoReprend(true);
        gl.useProgram(program);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
        gl.depthMask(true);gl.disable(gl.BLEND);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,ombre.texture);
      }
      prof?.end();prof?.begin('effects');
      if(particles.length)renderEffects(particles,eye,t);prof?.end();
      if(sceneMode==='screen'&&post){gl.drawBuffers([gl.COLOR_ATTACHMENT0]);reflections.resolve(post.scene,reflectionMode,{pos:eye},axes,projection,view,t,worldRevision,reflections.key);gl.useProgram(program);gl.bindVertexArray(vao);reflections.bind(uniforms);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,stats.shadows?shadowTarget.texture:whiteTexture);gl.activeTexture(gl.TEXTURE0);}
      if(stats.reflections&&avecOverlay){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,cibleMonde);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,post.reflectSource.framebuffer);gl.blitFramebuffer(0,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,cibleMonde);}
      if(avecOverlay) {
        // EMPRISE: weapon/muzzle meshes already render after a depth clear.
        // Keep their close clipping plane independent from world depth precision.
        // World projection and its depth texture stay unchanged for SSR and crowds.
        const overlayNear=Math.min(near,Math.max(.005,Number(camera.overlayNear)||near));
        let overlayClip=vp;
        if(overlayNear!==near||drawOrigin){
          overlayProjection.set(projection);
          overlayProjection[10]=(far+overlayNear)/(overlayNear-far);overlayProjection[14]=2*far*overlayNear/(overlayNear-far);
          if(drawOrigin){
            relativeView.set(view);relativeView[12]=relativeView[13]=relativeView[14]=0;
            gl.uniform3fv(uniforms.uDrawOrigin,drawOrigin);
          }
          overlayClip=multiply(overlayProjection,drawOrigin?relativeView:view,overlayVP);
          gl.uniformMatrix4fv(uniforms.uViewProjection,false,overlayClip);
        }
        if(blackout){for(let i=0;i<selected.length;i++){const light=selected[i].light,c=light.color||WHITE,power=light.power===undefined?1:light.power;lightColors[i*3]=c[0]*power;lightColors[i*3+1]=c[1]*power;lightColors[i*3+2]=c[2]*power;}gl.uniform3fv(uniforms.uLightColor,lightColors);}
        gl.clear(gl.DEPTH_BUFFER_BIT);
        if(colourOverlay.length){
          const cockpit=photoOverlay||packOverlay(colourOverlay,environment,true,drawOrigin);
          if(!photoOverlay)streamUpload(overlayStream,cockpit);
          if(cockpit.nearTotal)renderPart(cockpit,overlayBuffer,1,true);
          else renderBatch(cockpit,overlayBuffer,false);
        }
        if(overlayParticles.length)renderEffects(overlayParticles,eye,t,overlayClip,drawOrigin);
        if(drawOrigin)gl.uniform3f(uniforms.uDrawOrigin,0,0,0);
        if(overlayClip!==vp)gl.uniformMatrix4fv(uniforms.uViewProjection,false,vp);
      }
      if(msaa){
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER,msaa.framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,cibleFinale);
        const masque=refletDirect?gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT:gl.COLOR_BUFFER_BIT;
        gl.blitFramebuffer(0,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height,masque,gl.NEAREST);
        // Both multisample attachments are cleared before their next use.
        gl.invalidateFramebuffer(gl.READ_FRAMEBUFFER,msaaAttachments);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      }
      prof?.begin('post');
      if(stats.bloom||composeScreen)postPass(couleurFinale.texture,avecOverlay,fx.fovea);
      else if(presenterEcran){
        // FScene a composé sa couleur dans post.scene. Elle arrive telle quelle sur le canvas.
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER,cibleFinale);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
        gl.blitFramebuffer(0,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      }
      prof?.end();
    }

    // ------------------------------------------------------------------ FERRO 0.3.11 : option ombresPhoto
    function photoDepthTexture(size){
      const t=gl.createTexture();created(1);gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT16,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_SHORT,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      return t;
    }
    function photoDepthTarget(size){
      const target={framebuffer:gl.createFramebuffer(),texture:photoDepthTexture(size),size};created(1);
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,target.texture,0);
      gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
      const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      if(!ok){deleteTarget(target);return null;}
      return target;
    }
    // Créé avec le contexte (et après sa restauration) : la course ne crée jamais ces objets.
    function photoInitialize(){
      photoUniforms={};for(const name of ['uContact','uContactCount','uContactReglages','uContactSphere','uOmbreTuile','uOmbreTuileMatrice','uOmbreTuileReglages','uPhotoTileSphere','uOmbreLoin','uOmbreLoinMatrice','uOmbreLoinReglages','uOmbreComparee','uPenombre'])photoUniforms[name]=gl.getUniformLocation(program,name);
      photoSampler=gl.createSampler();
      gl.samplerParameteri(photoSampler,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.samplerParameteri(photoSampler,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
      gl.samplerParameteri(photoSampler,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.samplerParameteri(photoSampler,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.samplerParameteri(photoSampler,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.samplerParameteri(photoSampler,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      // Les textures naissent sur l'unité 9, réservée à l'option : les unités du moteur gardent leurs liaisons.
      gl.activeTexture(gl.TEXTURE9);photoDepth=photoDepthTexture(1);photoTile=photoDepthTarget(photoTileSize);photoFar=null;
      gl.useProgram(program);gl.uniform1i(photoUniforms.uOmbreComparee,8);gl.uniform1i(photoUniforms.uOmbreTuile,9);gl.uniform1i(photoUniforms.uOmbreLoin,10);
      gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,photoDepth);gl.bindSampler(8,photoSampler);
      gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,whiteTexture);
      gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_2D,photoDepth);gl.bindSampler(10,photoSampler);
      gl.activeTexture(gl.TEXTURE0);
      photoState.contacts=0;photoState.tuile=photoState.loin=false;photoState.penombre='off';photoState.loinTaille=0;
    }
    function photoDispose(){
      if(photoTile)deleteTarget(photoTile);if(photoFar)deleteTarget(photoFar);if(photoDepth)gl.deleteTexture(photoDepth);if(photoSampler)gl.deleteSampler(photoSampler);
      photoTile=photoFar=photoDepth=photoSampler=null;photoLies.fill(null);
    }
    // Foule de l'hôte (fx.foule) : ses programmes lisent leurs propres textures, aussi sur les unités 8 à 10 (BITUME :
    // public.js ; FERRO : crowd.js). Pendant l'appel, l'échantillonneur de comparaison quitte les unités 8 et 10 (il
    // rendrait leurs textures de couleur incomplètes) ; au retour, il y revient, et après la passe couleur, les textures
    // de l'option aussi (un sampler2D de la tuile devant une texture entière de l'hôte ferait échouer les dessins).
    function photoQuitte(){gl.bindSampler(8,null);gl.bindSampler(10,null);}
    function photoReprend(textures){
      if(textures){
        gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,photoLies[0]);
        gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,photoLies[1]);
        gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_2D,photoLies[2]);
      }
      gl.bindSampler(8,photoSampler);gl.bindSampler(10,photoSampler);
    }
    // Vue orthographique selon le soleil : centre c, demi-côté e, axe x suivant `axe` projeté (sinon l'horizontale du
    // soleil), oeil relevé de lift, profondeur de near à far. Écrit dans out ; rend le pas de grille (m par texel).
    function photoSunMatrix(out,c,e,size,lift,near,far,axe,snap){
      return orthographicSun(environment.sunDirection,photoProjection,photoMatrix,out,c,e,size,lift,near,far,axe,snap);
    }
    // Tuile de l'image : fx.ombreProche = { centre, etendue, debut, fin, axe } (debut et fin : indices de dynamic). Les
    // pièces ordinaires de cet intervalle passent dans nearOrdinary ; le préchauffage en prend une pièce témoin.
    function photoTuile(fx,camera){
      let o=fx.ombreProche;
      if(!o&&warm){const p=camera.pos||[0,1.6,0];photoWarmTile.centre[0]=p[0];photoWarmTile.centre[1]=p[1];photoWarmTile.centre[2]=p[2];o=photoWarmTile;}
      if(!o||!photoTile||!environment||!shadowTarget||!shadowsEnabled(fx))return null;
      const c=o.centre;if(!c||!Number.isFinite(c[0])||!Number.isFinite(c[1])||!Number.isFinite(c[2]))return null;
      return o;
    }
    // Scan the dynamic list once. The Photo interval is expressed in indices of the
    // original list, including its translucent effects and cockpit meshes.
    function partitionDynamic(dynamic,tile){
      const list=Array.isArray(dynamic)?dynamic:dynamic?Array.from(dynamic):EMPTY_ENTRIES;
      const begin=tile?Math.max(0,Math.floor(tile.debut)||0):0,end=tile?Math.floor(tile.fin)||0:0;
      let nWorld=0,nNear=0,nOverlay=0,nFX=0,nOverlayFX=0;
      for(let index=0;index<list.length;index++){
        const mesh=list[index];
        if(mesh.overlay){if(mesh.fx)overlayParticles[nOverlayFX++]=mesh;else overlay[nOverlay++]=mesh;}
        else if(mesh.fx)particles[nFX++]=mesh;
        else if(index<end&&index>=begin)nearOrdinary[nNear++]=mesh;
        else ordinary[nWorld++]=mesh;
      }
      if(warm){
        let tileExample=!!tile;
        for(const mesh of warm.extra){
          if(mesh.overlay){if(mesh.fx)overlayParticles[nOverlayFX++]=mesh;else overlay[nOverlay++]=mesh;}
          else if(mesh.fx)particles[nFX++]=mesh;
          else if(tileExample){nearOrdinary[nNear++]=mesh;tileExample=false;}
          else ordinary[nWorld++]=mesh;
        }
      }
      ordinary.length=nWorld;nearOrdinary.length=nNear;overlay.length=nOverlay;particles.length=nFX;overlayParticles.length=nOverlayFX;
    }
    // Profondeur de la voiture filmée : ses pièces ordinaires (part 2 du lot dynamique) et l'habitacle (overlay, empaqueté
    // ici une fois, repris par la passe de l'habitacle). Grille liée à la voiture quand l'axe est donné, sinon au monde.
    function photoTilePass(tuile,dynamicBatch,overlayList,time,drawOrigin){
      const e=Number.isFinite(tuile.etendue)&&tuile.etendue>.5?tuile.etendue:3.5;photoTileExtent=e;
      const axe=tuile.axe&&Number.isFinite(tuile.axe[0])&&Number.isFinite(tuile.axe[1])&&Number.isFinite(tuile.axe[2])?tuile.axe:null;
      photoSunMatrix(photoTileMatrix,tuile.centre,e,photoTile.size,8,.5,16,axe,!axe);
      photoTileSphere[0]=tuile.centre[0]; photoTileSphere[1]=tuile.centre[1]; photoTileSphere[2]=tuile.centre[2];
      // The tile spans [-7.5,8] about its tracking point in light depth. Include the
      // optional half-texel snap on each transverse axis and float32 world-coordinate rounding.
      const padded=e+e/photoTile.size, m=photoTileMatrix;
      const slack=.02+4e-6*Math.max(Math.abs(tuile.centre[0]),Math.abs(tuile.centre[1]),Math.abs(tuile.centre[2]),e);
      const radius=Math.sqrt(2*padded*padded+64)+slack;
      photoTileSphere[3]=Math.hypot(m[0],m[4],m[8])*e>.999 && Math.hypot(m[1],m[5],m[9])*e>.999
        ? radius*radius : -1;
      if(overlayView?.hidden.length){
        // One upload: visible instances first within each shape. The complete batch casts its shadow.
        photoOverlay=packSplitOverlay(overlayList,overlayView.hidden,environment,drawOrigin);
      }else if(overlayList.length)photoOverlay=packOverlay(overlayList,environment,true,drawOrigin);
      if(photoOverlay)streamUpload(overlayStream,photoOverlay);
      gl.bindFramebuffer(gl.FRAMEBUFFER,photoTile.framebuffer);gl.viewport(0,0,photoTile.size,photoTile.size);gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(depthProgram);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.1,2);
      // Faces arrière seules : les pièces de la voiture sont des solides fermés ; la profondeur gardée est celle de leur
      // face cachée, et une face éclairée ne s'ombre plus elle-même (points d'acné des surfaces rasantes à 7 mm).
      gl.cullFace(gl.FRONT);
      gl.uniformMatrix4fv(depthMatrix,false,photoTileMatrix);gl.uniform2f(depthWind,weather.wind,time);bindLocalWind(depthLocalWind);
      if(warm)warm.cible='tuile';
      renderPart(dynamicBatch,dynamicBuffer,2);
      if(photoOverlay){
        if(drawOrigin){
          // The same uploaded cockpit instances cast into the absolute world tile.
          relativeTile.set(m);
          for(let row=0;row<4;row++)relativeTile[12+row]=m[row]*drawOrigin[0]+m[4+row]*drawOrigin[1]+m[8+row]*drawOrigin[2]+m[12+row];
          gl.uniformMatrix4fv(depthMatrix,false,relativeTile);gl.uniform3fv(depthDrawOrigin,drawOrigin);
        }
        renderBatch(photoOverlay,overlayBuffer,false,true);
        if(drawOrigin)gl.uniform3f(depthDrawOrigin,0,0,0);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);gl.cullFace(gl.BACK);
    }
    const PHOTO_PENOMBRE={off:0,meteo:1,pcss:2};
    // Uniformes de la passe couleur. Unités : 8 l'atlas du soleil en comparaison, 9 la tuile, 10 la carte lointaine.
    function photoBind(fx,tuile,full){
      const u=photoUniforms,c=fx.contacts;
      const n=c&&c.boites&&c.boites.length>=24&&Number.isFinite(c.nombre)?Math.max(0,Math.min(6,Math.floor(c.nombre),Math.floor(c.boites.length/24))):0;
      gl.uniform1i(u.uContactCount,n);if(n)gl.uniform4fv(u.uContact,c.boites,0,n*24);
      const marge=Math.max(0,photoNum(c&&c.marge,1.6));
      gl.uniform4f(u.uContactReglages,n?photoNum(c.ambiance,.85):0,n?photoNum(c.soleil,.6):0,Math.max(.5,photoNum(c&&c.exposant,4)),marge);
      // Sphère qui contient les portées de toutes les voitures (centre de leur boîte englobante, rayon jusqu'à la plus
      // lointaine, plus 1 cm) : hors d'elle, photoContact rend 0 sans parcourir les voitures. Scalaires seulement.
      if(n){
        const b=c.boites;let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
        for(let i=0;i<n;i++){const o=i*24,r=b[o+7]+marge;x0=Math.min(x0,b[o]-r);x1=Math.max(x1,b[o]+r);y0=Math.min(y0,b[o+1]-r);y1=Math.max(y1,b[o+1]+r);z0=Math.min(z0,b[o+2]-r);z1=Math.max(z1,b[o+2]+r);}
        const sx=(x0+x1)/2,sy=(y0+y1)/2,sz=(z0+z1)/2;let rs=0;
        for(let i=0;i<n;i++){const o=i*24,dx=b[o]-sx,dy=b[o+1]-sy,dz=b[o+2]-sz;rs=Math.max(rs,Math.sqrt(dx*dx+dy*dy+dz*dz)+b[o+7]+marge);}
        gl.uniform4f(u.uContactSphere,sx,sy,sz,Number.isFinite(rs)?rs+.01:1e9);
      }else gl.uniform4f(u.uContactSphere,0,0,0,0);
      const tileOn=!!(tuile&&stats.shadows&&photoTile);
      gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,photoLies[1]=tileOn?photoTile.texture:whiteTexture);
      gl.uniformMatrix4fv(u.uOmbreTuileMatrice,false,photoTileMatrix);
      if(tileOn)gl.uniform4fv(u.uPhotoTileSphere,photoTileSphere);
      const tileTexel=photoTile?1/photoTile.size:1;
      gl.uniform4f(u.uOmbreTuileReglages,tileOn?1:0,tileTexel,.3/(2*photoTileExtent),photoTileExtent*2*tileTexel);
      const sun=environment&&environment.sunDirection,far=photoFar;
      const farOn=!!(far&&stats.shadows&&fx.ombreLoin!==false&&sun&&sun[0]===far.sun[0]&&sun[1]===far.sun[1]&&sun[2]===far.sun[2]&&photoMemesLots(far));
      gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_2D,photoLies[2]=farOn?far.texture:photoDepth);
      if(farOn){gl.uniformMatrix4fv(u.uOmbreLoinMatrice,false,photoFarMatrix);gl.uniform4f(u.uOmbreLoinReglages,1,1/far.size,far.bias,far.normal);}
      else gl.uniform4f(u.uOmbreLoinReglages,0,1,0,0);
      const p=fx.penombre,mode=stats.shadows?PHOTO_PENOMBRE[typeof p==='string'?p:p&&p.mode]||0:0,pcss=mode===2&&full&&photoPcssOn;
      const k=p&&typeof p==='object'&&Number.isFinite(p.k)?p.k:.02,rayon=p&&typeof p==='object'&&Number.isFinite(p.rayonMax)?Math.max(1,Math.min(6,p.rayonMax)):4;
      gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,photoLies[0]=pcss?shadowTarget.texture:photoDepth);
      gl.uniform4f(u.uPenombre,pcss?2:mode?1:0,photoSunRange*k/Math.max(.0001,photoSunTexel),rayon,0);
      gl.activeTexture(gl.TEXTURE2);
      photoState.contacts=n;photoState.tuile=tileOn;photoState.loin=farOn;photoState.penombre=pcss?'pcss':mode?'meteo':'off';
    }
    // Carte lointaine, dessinée une fois au chargement (jamais pendant draw) : lots statiques dans leur version lointaine
    // (ni prairies ni lots « ombre: false »), vus du soleil, au repos (sans vent). Les nappes n'y entrent pas, comme
    // dans le carré proche. Invalide si setLots reçoit d'autres lots ou si la direction du soleil change ; refaite après
    // une perte de contexte. demande = { taille (texels, 2048), marge (m, 20), dessous (m, 300) } : emprise calculée sur les lots ;
    // ou { centre, etendue (demi-côté, m), taille, hauteur (profondeur du volume, m) } : emprise imposée. null la
    // libère. Rend { taille, texel, etendue, profondeur, centre, octets, appels, instances, ms } ou null.
    // La carte vaut pour ces lots-là : mêmes objets dans le même ordre (setLots refiltre un tableau neuf à chaque appel,
    // même pour le décor déjà chargé). Comparés une fois par nouvel appel à setLots, pas à chaque image.
    function photoMemesLots(far){
      if(far.lots===lots)return true;
      const a=far.liste;if(a.length!==lots.length)return false;
      for(let i=0;i<a.length;i++)if(a[i]!==lots[i])return false;
      far.lots=lots;return true;
    }
    // Emprise automatique dans le repère du soleil (axes de photoSunMatrix sans axe imposé) : sphères des lots qui
    // projettent, marge latérale m ; en profondeur, de m devant le lot le plus proche du soleil à `dessous` au-delà du
    // plus lointain (le sol qui reçoit). Les récepteurs partagent les coordonnées de leurs bloqueurs : le carré des
    // lots suffit, quelle que soit la hauteur du soleil.
    function precalculerOmbre(demande){
      if(!photo)return null;
      if(!demande){photoFarRequest=null;if(photoFar){deleteTarget(photoFar);photoFar=null;}photoState.loin=false;photoState.loinTaille=0;return null;}
      const c=demande.centre,auto=c===undefined||c===null;
      const size=Math.max(256,Math.min(Math.floor(Number(demande.taille)||2048),maxShadowTileSize*2));
      if(auto){
        const m=Number.isFinite(demande.marge)?Math.max(0,demande.marge):20,dessous=Number.isFinite(demande.dessous)?Math.max(0,demande.dessous):300;
        photoFarRequest={taille:size,marge:m,dessous};
      }else{
        const e=Number(demande.etendue),h=Number(demande.hauteur)||Math.max(400,e*3);
        if(!c||![c[0],c[1],c[2],e,h].every(Number.isFinite)||e<=0||h<=0)throw new Error('precalculerOmbre : centre et etendue requis');
        photoFarRequest={centre:[c[0],c[1],c[2]],etendue:e,taille:size,hauteur:h};
      }
      if(disposed||stats.contextLost||!environment)return null;
      const r=photoFarRequest,zone=auto?sunBounds(environment.sunDirection,lots,r.marge,r.dessous):{centre:r.centre,etendue:r.etendue,lift:r.hauteur*.5,profondeur:r.hauteur};
      if(!zone){if(photoFar){deleteTarget(photoFar);photoFar=null;}photoState.loin=false;photoState.loinTaille=0;return null;}
      const start=clock(),e=zone.etendue,h=zone.profondeur;
      gl.activeTexture(gl.TEXTURE10);if(!photoFar||photoFar.size!==size){if(photoFar)deleteTarget(photoFar);photoFar=photoDepthTarget(size);}
      gl.bindTexture(gl.TEXTURE_2D,photoDepth);gl.activeTexture(gl.TEXTURE0);
      if(!photoFar)return null;
      const texel=photoSunMatrix(photoFarMatrix,zone.centre,e,size,zone.lift,0,h,null,false);
      const sun=environment.sunDirection;photoFar.sun=[sun[0],sun[1],sun[2]];photoFar.lots=lots;photoFar.liste=lots.slice();
      photoFar.bias=Math.min(.02,.6/h);photoFar.normal=Math.min(2,texel);
      const before=stats.drawCalls,beforeTriangles=stats.triangles;let instances=0;
      gl.bindFramebuffer(gl.FRAMEBUFFER,photoFar.framebuffer);gl.viewport(0,0,size,size);gl.disable(gl.SCISSOR_TEST);gl.depthMask(true);gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(depthProgram);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.1,2);
      gl.uniformMatrix4fv(depthMatrix,false,photoFarMatrix);gl.uniform2f(depthWind,0,0);
      gl.uniform1f(depthLocalWind.uWindStrength,0);gl.uniform1i(depthLocalWind.uLocalWindCount,0);depthLocalWind.localWindActive=true;
      // La carte globale ne demande que les silhouettes. Un seul tampon temporaire
      // suffit pour les lots froids, sans retenir leurs couleurs ni leurs LOD proches.
      let silhouette=null,packSilhouette=null;
      for(const l of lots){
        if(l.ombre===false||l.groundCover||l.detailProcheSeul)continue;
        let batch=l.paquetLoin||l.paquet,buffer=l.tamponLoin||l.tampon;
        if(!buffer){
          if(!lotsProgressifs)continue;
          const source=l.objetsOmbreLointaine?.()||(l.loin?.length?l.loin:l.objets);
          if(!source?.length)continue;
          if(!packSilhouette)packSilhouette=instancePacker();
          batch=packSilhouette(source,environment);
          if(!silhouette)silhouette=gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER,silhouette);
          if(batch.length)gl.bufferData(gl.ARRAY_BUFFER,batch.storage,gl.STREAM_DRAW,0,batch.length);
          buffer=silhouette;
        }
        renderBatch(batch,buffer,false,true);
        for(const g of batch.groups)instances+=g.count;
      }
      if(silhouette)gl.deleteBuffer(silhouette);
      if(worldIndex.entries.length){
        const batch=pack(worldIndex.entries.map(entry=>entry.mesh),environment),buffer=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,batch.values,gl.STATIC_DRAW);renderBatch(batch,buffer,false,true);gl.deleteBuffer(buffer);
        for(const g of batch.groups)instances+=g.count;
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
      const report={taille:size,texel,etendue:e,profondeur:h,centre:zone.centre,octets:size*size*2,appels:stats.drawCalls-before,instances,ms:clock()-start};
      stats.drawCalls=before;stats.triangles=beforeTriangles;photoState.loinTaille=size;
      return report;
    }
    // Rendu du jeu : seules ses créations d'objets GL entrent dans stats.creations.
    function draw(camera,dynamic,fx){counting=true;try{render(camera,dynamic,fx);}finally{counting=false;}}
    function lost(event){event.preventDefault();stats.contextLost=true;}
    function restored(){if(!disposed){
      // BITUME : les anciens objets GL appartiennent au contexte perdu ; oublier leurs poignées avant recharge.
      dispositions=new WeakMap();casesDisposition.length=casesLibres.length=curseurDisposition=0;etatDispositions.residentes=0;
      nappeVao=nappeVaoCompact=nappeVbo=nappeIbo=null;for(const l of lots)l.tampon=l.tamponLoin=null;
      chunks.clear();initialize();chargerNappes();chargerLots();rebuildChunks();
      if(photo&&photoFarRequest)precalculerOmbre(photoFarRequest);
    }}
    canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
    function dispose() {
      if(disposed) return;disposed=true;profiler?.dispose();surface?.dispose();reflections?.dispose();if(probeBuffer)gl.deleteBuffer(probeBuffer);if(fskyProgram)gl.deleteProgram(fskyProgram);
      localWind.reset();lotView.reset();groundPlans=new WeakMap();
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
      for(const c of chunks.values())gl.deleteBuffer(c.buffer);chunks.clear();
      for(const buffer of [vbo,ibo,worldBuffer,dynamicBuffer,overlayBuffer,fxBuffer]) gl.deleteBuffer(buffer);if(crowdBuffer)gl.deleteBuffer(crowdBuffer);
      for(const cache of staticCaches.slice(1))gl.deleteBuffer(cache.buffer);
      // BITUME : tampons des nappes et des lots.
      terrainView.reset();nappes=[];
      if(nappeVbo)gl.deleteBuffer(nappeVbo);if(nappeIbo)gl.deleteBuffer(nappeIbo);if(nappeVao)gl.deleteVertexArray(nappeVao);if(nappeVaoCompact)gl.deleteVertexArray(nappeVaoCompact);
      for(const l of lots)viderLot(l);
      lots=[];indicesLots=[];dernierUsage=ambianceLots=null;
      // PDR (lots) : tampons des lots du jeu.
      for(const slot of pdrSlots)if(slot)gl.deleteBuffer(slot.buffer);pdrSlots=[];pdrLots.length=0;
      freePost();deleteTarget(shadowTarget);if(photo)photoDispose();gl.deleteTexture(whiteTexture);for(const tex of pbrTextures)gl.deleteTexture(tex);pbrTextures=[];
      gl.deleteVertexArray(vao);gl.deleteVertexArray(postVao);gl.deleteProgram(program);gl.deleteProgram(depthProgram);gl.deleteProgram(postProgram);gl.deleteProgram(skyProgram);gl.deleteProgram(fxProgram);gl.deleteProgram(ssrProgram);
    }
    async function calibrate(camera,dynamic,fx={},frames=30){
      const times=[],gaps=[],pixel=new Uint8Array(4),now=()=>window.performance?.now?.()??Date.now();let previous=0;
      for(let i=0;i<frames+5;i++){
        if(disposed||stats.contextLost)return null;
        const stamp=await new Promise(resolve=>window.requestAnimationFrame?window.requestAnimationFrame(resolve):resolve(now()));
        const t=now();draw(camera,dynamic,{...fx,adaptive:false});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        if(i>=5){times.push(now()-t);if(previous)gaps.push(stamp-previous);}previous=stamp;
      }
      times.sort((a,b)=>a-b);gaps.sort((a,b)=>a-b);
      const result={p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],refreshMs:gaps[Math.floor(gaps.length*.5)]||0,frames:times.length,buffer:[canvas.width,canvas.height]};stats.calibration=result;return result;
    }
    // Préchauffage d'un niveau. Le pilote compile ses variantes de pipeline (programme × format de cible × mélange ×
    // échantillons × disposition des sommets) et valide chaque tampon et chaque intervalle d'indices au premier tracé
    // qui s'en sert : prewarm fait ces premiers tracés pendant le chargement, sous un ciseau d'un pixel, puis attend le
    // GPU sans bloquer le fil principal (barrière interrogée à chaque image).
    const clock=()=>window.performance?.now?.()??Date.now();
    // Ce que la combinaison d'options allume réellement (mêmes règles que ensureOptionalTargets et ensureShadowTarget) :
    // deux variantes de même clé tracent les mêmes pipelines dans les mêmes cibles.
    function effectiveKey(fx){
      const mode=reflections&&['probe','screen'].includes(fx.reflections)?fx.reflections:'off';
      const bloom=quality!=='low'&&fx.bloom!==false,msaa=!!config.msaa&&fx.msaa!==false&&(bloom||fx.msaa===true);
      const scale=fx.shadowMapScale===1||fx.shadowMapScale===2?Math.min(config.shadowMapScale,fx.shadowMapScale):config.shadowMapScale;
      const ssr=!!config.reflections&&bloom&&mode==='off'&&fx.reflections!==false&&fx.reflections!=='off';
      return 'halo:'+(bloom?1:0)+' msaa:'+(msaa?1:0)+' ombres:'+(shadowsEnabled(fx)?scale:0)+' reflets:'+(ssr?1:0)+(mode==='off'?'':' scene:'+mode);
    }
    // Variantes par défaut : chaque fonction (MSAA, halo, ombres, reflets) prend la valeur du jeu (fx) ou « coupé »,
    // jamais « forcé ». true force une fonction que la qualité coupe (fx.shadows === true allume les ombres en qualité
    // basse, fx.msaa === true le MSAA sans halo) : forcer créerait puis retiendrait l'atlas, le MSAA ou les reflets d'un
    // profil qui les coupe, sur les machines qui ont le moins de mémoire. Un jeu qui allume une fonction en cours de
    // partie le déclare dans options.variants, rendues telles quelles. Sans doublon de clé effective ; la variante du
    // jeu (fx) vient en dernier.
    function prewarmVariants(fx,list){
      if(Array.isArray(list))return [...list.filter(v=>v&&typeof v==='object'),{}];
      const seen=new Set([effectiveKey(fx)]),out=[],valeurs=v=>v===false?[false]:[false,v];
      for(const msaa of valeurs(fx.msaa))for(const bloom of valeurs(fx.bloom))
        for(const shadows of valeurs(fx.shadows))for(const reflections of valeurs(fx.reflections)){
          const variant={msaa,bloom,shadows,reflections},key=effectiveKey({...fx,...variant});
          if(!seen.has(key)){seen.add(key);out.push(variant);}
        }
      out.push({});return out;
    }
    // Pièces témoins posées devant la caméra : une par passe dynamique (objet opaque, effet translucide, pièce
    // d'habitacle, effet d'habitacle) ; avec allShapes, une de chaque par forme enregistrée.
    function prewarmExtras(camera,allShapes){
      const p=camera.pos||[0,1.6,0],f=cameraAxes(camera).forward,at=[p[0]+f[0]*4,p[1]+f[1]*4,p[2]+f[2]*4],s=[.05,.05,.05],r=[0,0,0],c=[.5,.5,.5];
      const solid=allShapes?names.filter(name=>source.ranges[name]):['box'],glow=allShapes?solid:['sphere'],out=[];
      for(const shape of solid)out.push({shape,p:at,s,r,mat:0},{shape,p:at,s,r,mat:0,overlay:true});
      for(const shape of glow)out.push({shape,p:at,s,r,mat:0,fx:true,alpha:.5,color:c},{shape,p:at,s,r,mat:0,overlay:true,fx:true,alpha:.5,color:c});
      return out;
    }
    // Mémoire nominale des cibles tenues (octets) : scène RGBA8 + D24, halo, MSAA par échantillon, reflets, atlas D24.
    function targetBytes(){
      let bytes=0;
      if(post){bytes+=post.scene.width*post.scene.height*8+(post.a.width*post.a.height+post.b.width*post.b.height)*4;
        if(post.reflectSource)bytes+=post.reflectSource.width*post.reflectSource.height*8+post.reflection.width*post.reflection.height*4;}
      if(msaaBuffer)bytes+=canvas.width*canvas.height*8*msaaBuffer.samples;
      if(shadowTarget)bytes+=(shadowTarget.size*2)**2*4;
      return bytes;
    }
    // Attente du GPU sans blocage : barrière, puis clientWaitSync(sync, 0, 0) à chaque requestAnimationFrame (une minuterie
    // de 16 ms si la page est cachée). Sans barrière ni minuterie, après timeoutMs ou sur WAIT_FAILED : gl.finish().
    function waitForGpu(report,timeoutMs,start,done){
      const begin=clock();let sync=null,finished=false,deadline=null;
      const finish=fallback=>{
        if(finished)return;finished=true;
        if(deadline!==null&&typeof window.clearTimeout==='function')window.clearTimeout(deadline);
        if(fallback&&fallback!=='lost'&&!disposed&&!stats.contextLost)gl.finish();
        if(sync&&!stats.contextLost)gl.deleteSync(sync);sync=null;
        report.waitMs=clock()-begin;report.ms=clock()-start;report.fallback=fallback;done(report);
      };
      // Contexte perdu pendant les rendus : fenceSync rendrait null et le repli se dirait 'unsupported'.
      if(disposed||stats.contextLost){finish('lost');return;}
      if(typeof gl.fenceSync==='function'){sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();}
      const timer=typeof window.setTimeout==='function';
      const later=typeof window.requestAnimationFrame==='function'
        ?step=>{if(timer&&window.document?.hidden)window.setTimeout(step,16);else window.requestAnimationFrame(step);}
        :timer?step=>window.setTimeout(step,16):null;
      if(!sync||!later){finish('unsupported');return;}
      if(timer)deadline=window.setTimeout(()=>finish('timeout'),timeoutMs);
      // Le statut d'une barrière WebGL ne change pas pendant la tâche qui l'a posée : première lecture différée.
      const poll=()=>{
        if(finished)return;
        if(disposed||stats.contextLost){finish('lost');return;}
        const status=gl.clientWaitSync(sync,0,0);
        if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)finish(false);
        else if(status===gl.WAIT_FAILED)finish('failed');
        else if(clock()-begin>=timeoutMs)finish('timeout');
        else later(poll);
      };
      later(poll);
    }
    // prewarm(camera, dynamic, fx, options) : options.variants (fx partiels), options.allShapes, options.timeoutMs (4 000 par
    // défaut), options.reserve = { dynamic, overlay, effects } (instances à réserver dans les flux de chaque image).
    // Il retient les cibles (retain(true)), puis rend l'état du moteur tel qu'il l'a trouvé : lampe d'ombre, plan de
    // lumière, matrices d'ombre, caches d'ombre et de sélection, ciseau, statistiques ; stats.creations repart de zéro,
    // y compris dans les replis sans rendu ('lost', 'busy'). Une erreur rend aussi la rétention d'avant l'appel.
    function prewarm(camera,dynamic,fx,options){
      camera=camera||{};fx=fx||{};options=options||{};
      const start=clock(),timeoutMs=Number.isFinite(options.timeoutMs)&&options.timeoutMs>=0?options.timeoutMs:4000;
      const report={variants:0,draws:0,drawCalls:0,triangles:0,lots:0,nappes:0,subsets:0,creations:0,bytes:0,keys:[],ms:0,submitMs:0,waitMs:0,fallback:false};
      if(disposed||stats.contextLost||warm){report.fallback=warm?'busy':'lost';stats.creations=0;report.ms=clock()-start;return Promise.resolve(report);}
      const retainedBefore=retained;retain(true);
      const snapshot=Object.assign({},stats),savedMatrices=shadowMatrices.slice();
      // Les VAO créés au préchauffage restent résidents. Les deux compteurs de vue décrivent le dernier draw.
      const utilisationsAvant=etatDispositions.reutilisations,replisAvant=etatDispositions.replis;
      const savedLight=shadowLight,savedPlan=actorLightPlan,savedCasters=lampCasters.slice(),savedCaches=staticCaches.map(c=>({entries:c.entries,batch:c.batch}));
      const scissor=gl.isEnabled(gl.SCISSOR_TEST),box=gl.getParameter(gl.SCISSOR_BOX);
      // balayes : cibles (passe, format, échantillons) déjà balayées en entier ; cible : celle de la passe en cours.
      warm={extra:[],creations:0,lots:0,nappes:0,subsets:0,balayes:new Set(),cible:''};let failure=null;
      try{
        // Dans le try : une option qui lève rejette la promesse après la remise en état, comme une erreur de rendu.
        const list=prewarmVariants(fx,options.variants);warm.extra=prewarmExtras(camera,options.allShapes===true);
        report.variants=list.length;
        for(const variant of list){
          if(stats.contextLost)break;
          const merged={...fx,...variant,adaptive:false};
          render(camera,dynamic,merged);report.draws++;report.drawCalls+=stats.drawCalls;report.triangles+=stats.triangles;report.keys.push(effectiveKey(merged));
        }
        const reserve=options.reserve||{},instances=v=>Number.isFinite(v)&&v>0?Math.ceil(v)*64:0;
        if(!stats.contextLost){reserveStream(dynamicStream,instances(reserve.dynamic));reserveStream(overlayStream,instances(reserve.overlay));reserveStream(fxStream,instances(reserve.effects));}
      }catch(error){failure=error;}finally{
        report.creations=warm.creations;report.lots=warm.lots;report.nappes=warm.nappes;report.subsets=warm.subsets;warm=null;
        shadowLight=savedLight;actorLightPlan=savedPlan;lampCasters=savedCasters;shadowMatrices.set(savedMatrices);
        if(!stats.contextLost){
          // Un cache réécrit par le préchauffage reprend sa sélection et ses données GPU.
          for(let i=0;i<staticCaches.length;i++){const c=staticCaches[i],s=savedCaches[i];if(c.entries===s.entries&&c.batch===s.batch)continue;
            c.entries=s.entries;c.batch=s.batch;if(s.batch.groups.length){gl.bindBuffer(gl.ARRAY_BUFFER,c.buffer);gl.bufferData(gl.ARRAY_BUFFER,s.batch.values,gl.DYNAMIC_DRAW);}}
          if(scissor)gl.scissor(box[0],box[1],box[2],box[3]);else gl.disable(gl.SCISSOR_TEST);
        }
        const lost=stats.contextLost;Object.assign(stats,snapshot);stats.contextLost=lost;stats.creations=0;
        etatDispositions.reutilisations=utilisationsAvant;etatDispositions.replis=replisAvant;
      }
      // Une erreur (options, rendu du jeu ou du moteur) rejette la promesse, après la remise en état.
      if(failure){retain(retainedBefore);return Promise.reject(failure);}
      report.bytes=targetBytes();report.submitMs=clock()-start;
      return new Promise(resolve=>waitForGpu(report,timeoutMs,start,resolve));
    }
    // retain(true) : l'atlas d'ombres, le tampon MSAA et les cibles de reflets ne sont plus libérés après 120 rendus
    // sans usage (un changement de taille ou de qualité les libère toujours). retain(false) : comportement d'origine,
    // compteurs repartis de zéro. Sans argument : l'état courant.
    function retain(value){
      if(value===undefined)return retained;
      retained=!!value;shadowIdle=msaaIdle=0;if(post)post.reflectionIdle=0;return retained;
    }
    function resetStats(){stats.creations=0;return stats;}
    // PDR (foule) : le jeu dessine la foule lui-même dans les passes du moteur. renderer.gl est le contexte WebGL 2 ;
    // renderer.pdr donne la bibliothèque d'éclairage (glsl), lier(programme) qui rend la fonction posant ses uniformes à
    // partir de la vue passée à fx.foule.couleur, la génération du contexte (elle change après une perte de contexte : tout
    // est à recréer) et la compilation des shaders avec les messages du moteur.
    const pdr={glsl:pdrGlsl,uniformes:PDR_UNIFORMS,
      get generation(){return pdrGeneration;},
      programme(vertex,fragment){return link(vertex,fragment);},
      lier(programme){
        const u={};for(const name of PDR_UNIFORMS)u[name]=gl.getUniformLocation(programme,name);
        return v=>{
          const o=v.ombre;
          gl.uniform1i(u.uPdrOmbre,o.unite);gl.uniformMatrix4fv(u.uPdrMatriceOmbre,false,o.matrice);
          gl.uniform4f(u.uPdrOmbreReglages,o.active?1:0,o.texel,o.plein?1:0,0);
          gl.uniform3fv(u.uPdrOeil,v.oeil);gl.uniform3fv(u.uPdrSoleil,v.soleil);gl.uniform3fv(u.uPdrCouleurSoleil,v.couleurSoleil);
          gl.uniform3fv(u.uPdrAmbiance,v.ambiance);gl.uniform3fv(u.uPdrBrouillard,v.brouillard);
          gl.uniform3fv(u.uPdrCielHaut,v.cielHaut);gl.uniform3fv(u.uPdrCielBas,v.cielBas);
          gl.uniform4f(u.uPdrEnvironnement,1,v.densiteBrouillard,v.temps,0);gl.uniform2f(u.uPdrResolution,v.largeur,v.hauteur);
          const l=v.lumieres;gl.uniform3fv(u.uPdrLumierePosition,l.positions);gl.uniform3fv(u.uPdrLumiereCouleur,l.couleurs);
          gl.uniform3fv(u.uPdrLumiereDirection,l.directions);gl.uniform2fv(u.uPdrLumiereCone,l.cones);gl.uniform1fv(u.uPdrLumierePortee,l.portees);gl.uniform1i(u.uPdrLumieres,l.nombre);
        };
      }};
    return {setEnvironment(value){environment=environmentInfo(value);},setWorld,updateWorld,draw,resize,dispose,stats,actorFilter,setNappes,setLots,preparerLot,updateShape,gl,pdr,calibrate,profile,prewarm,retain,resetStats,precalculerOmbre,setRenderScale:value=>surface?.setScale(value),setMaxPixels(value){runtimeMaxPixels=Number.isFinite(value)&&value>0?value:0;surface?.setMaxPixels?.(runtimeMaxPixels);return resize();},setBudgetTarget:value=>watch?.setTarget(value)};
  }
  // Both GPU backends share the procedural shapes, instance layout and visibility
  // rules. No rendering calls or GPU state are shared between the APIs.
  const shared={orthographicSun,sunBounds,bitumeWeather,localWindState,vegetationFrame,groundCoverRank,groundCoverGeometry,groundCoverPlan,prepareGroundCover,lotViewState,terrainViewState,rigidOverlayView,rigidTerrainVertices,writeRigidTerrain,geometry,indexPrimitiveVertices,pack,packEffects,instancePacker,splitPacker,effectsPacker,packIndexed,spatialIndex,partitionWorld,planChunks,visible,setFrustumRadii,metadata,environmentInfo,outdoorMesh,surfaceFlags,transientLights,horrorLights,cameraAxes,multiply,detailRanges,lotDetailDistance,materialFamily,extendedDistance,resolutionGovernor,settings,indoor:PDR_INDOOR,shapes:FORMES_LIBRES};
  function mesh(shape,p,s,mat,r=[0,0,0],emissive=0){
    return {shape,p,s,mat,r,emissive,color:undefined,surface:undefined,overlay:false,fx:false,
      alpha:undefined,opacity:1,additive:undefined,outdoor:undefined,actorPart:undefined,actorLod:0,
      actorScale:undefined,structural:false,debrisId:undefined,sourceId:undefined,material:undefined,
      effectPart:'',fxFire:false,fxSmoke:false,fxSpark:false,fxPriority:undefined,ground:undefined,
      innerRatio:undefined,region:undefined,windResponsive:false,groundCover:false,groundShear:0,fog:undefined,lit:false};
  }
  globalThis.FRender={create,foliageTriangles,forme,shared,mesh,materials:MATERIALS};
  if(typeof window!=='undefined')window.FRender=globalThis.FRender;
})();
