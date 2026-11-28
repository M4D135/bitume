/* BITUME — polycarbonate galbé dans les passes 3D FERRO. Les gouttes sont en mètres
   sur la peau du saute-vent et persistent quand la voiture ou la caméra tournent. */
(function(B) {
  'use strict';
  const shader = `
struct Vue {
  clip: mat4x4f,
  oeil: vec4f,
  soleil: vec4f,
  lumiere: vec4f,
  ciel: vec4f,
  horizon: vec4f,
  ambiance: vec4f,
  brume: vec4f,
};
@group(0) @binding(0) var<uniform> vue: Vue;
@group(1) @binding(0) var scene:texture_2d<f32>;
@group(1) @binding(1) var bilineaire:sampler;
struct V {
  @builtin(position) clip: vec4f,
  @location(0) position: vec3f,
  @location(1) normale: vec3f,
  @location(2) uv: vec2f,
  @location(3) tangent: vec3f,
  @location(4) @interpolate(flat) eau: vec4f,
  @location(5) @interpolate(flat) abri: f32,
};
@vertex fn sommet(
  @location(0) point: vec3f, @location(1) normale: vec3f,
  @location(2) axeX: vec4f, @location(3) axeY: vec4f, @location(4) axeZ: vec4f,
  @location(5) position: vec4f, @location(6) echelle: vec4f
)->V {
  let r=mat3x3f(axeX.xyz,axeY.xyz,axeZ.xyz);
  let p=r*(point*echelle.xyz)+position.xyz;
  var clip=vue.clip*vec4f(p,1);
  clip.z=(clip.z+clip.w)*.5;
  // Une coordonnée suit l'arc du bouclier, l'autre parcourt sa hauteur inclinée.
  let uv=vec2f(asin(clamp(point.z*1.72,-.98,.98))*echelle.z/1.72,
                point.y*echelle.y-point.x*echelle.x*.72);
  return V(clip,p,normalize(r*(normale/echelle.xyz)),uv,axeZ.xyz,
           vec4f(axeX.w,axeY.w,axeZ.w,echelle.w),position.w);
}
fn h(p:vec2f)->vec3f {
  var q=fract(vec3f(p.xyx)*vec3f(.1031,.1030,.0973));
  q+=vec3f(dot(q,q.yzx+33.33));
  return fract((q.xxy+q.yzz)*q.zyx);
}
// Relief de la calotte, du sillon et du ménisque sur une seule cellule. Une marge
// garde toute empreinte dans sa cellule. Le filtrage disparaît avant le sous-pixel.
fn goutte(p:vec2f, graine:f32, eau:f32, air:f32, phase:f32, filtre:f32)->vec4f {
  let cellule=floor(p);
  let hasard=h(cellule+graine);
  let apparition=smoothstep(hasard.z*.88,hasard.z*.88+.12,eau);
  let rayon=mix(.085,.225,hasard.y);
  let centre=vec2f(.28+.44*hasard.x,.38+.22*hasard.y);
  let local=fract(p)-centre;
  let allonge=1.+air*.29;
  let q=local/vec2f(rayon,rayon*allonge);
  let d=length(q);
  let aa=clamp(filtre/rayon,.045,.55);
  let masque=(1.-smoothstep(1.-aa,1.+aa,d))*apparition;
  let bord=exp(-19.*abs(d-.84))*masque;
  let decal=local.x/(rayon*.22);
  let longueur=rayon*(.65+.65*air);
  let sillon=(1.-smoothstep(.75,1.35,abs(decal)))*smoothstep(.28*rayon,.85*rayon,-local.y)*
      (1.-smoothstep(.74*longueur,1.5*longueur,-local.y))*apparition*air;
  let vivant=.83+.17*sin(phase+hasard.z*6.28);
  return vec4f((q*masque*.78+vec2f(decal*.17,0)*sillon)*vivant,masque+sillon*.45,bord);
}
fn environnement(dir:vec3f,abri:f32)->vec3f {
  let ciel=mix(vue.horizon.rgb,vue.ciel.rgb,smoothstep(0.,.86,dir.y));
  // La chaussée et l'infield renvoient le niveau ambiant de la scène, y compris au crépuscule.
  let sol=mix(vue.ambiance.rgb*.43,vue.horizon.rgb*.42,smoothstep(-.78,.06,dir.y));
  let dehors=mix(sol,ciel,smoothstep(-.12,.08,dir.y));
  return mix(dehors,vue.ambiance.rgb*(.18+.18*max(dir.y,0.)),abri);
}
// FERRO 0.3.39 : la scène est en radiance linéaire et post.wgsl applique seul la courbe d'affichage (tonemap ferro :
// c/(c+0,76) puis gamma 1/2,2). Le verre reste réglé à l'œil en valeurs affichées, comme en 0.3.38 ; affiche et
// radiance sont cette courbe et son inverse exact (0,98 affiché au plus, soit une radiance de 16,7).
fn affiche(r:vec3f)->vec3f {
  let x=max(r,vec3f(0.));
  return pow(x/(x+vec3f(.76)),vec3f(1./2.2));
}
fn radiance(d:vec3f)->vec3f {
  let u=pow(clamp(d,vec3f(0.),vec3f(.98)),vec3f(2.2));
  return .76*u/(1.-u);
}
// 0.3.38 mélangeait le verre en valeurs affichées : sortie = c + k·fond. Mélangé en radiance par « src-alpha,
// one-minus-src-alpha », le même verre éclaircissait les fonds sombres d'un voile laiteux (capotage, route : jusqu'à
// +0,4 affiché). La cible ne se lit pas ; le mélange matériel « one, src-alpha » donne a + m·fond en radiance, et a, m
// sont ajustés pour que l'image affichée soit exacte sous des fonds affichés de 0,1 et 0,6 (radiances ci-dessous) :
// écart de 0,04 au plus entre 0,03 et 0,6, l'excès restant sur les fonds très clairs. m est borné à 4 quand un reflet
// solaire sature la cible. Réglé pour le tonemap ferro : AgX ou ACES demanderaient de reprendre ce verre.
const FOND_SOMBRE=.00482572;
const FOND_CLAIR=.365988;
fn melange(c:vec3f,k:f32)->vec4f {
  let f1=radiance(c+vec3f(k*.1));
  let f2=radiance(c+vec3f(k*.6));
  let m=clamp(dot((f2-f1)/(FOND_CLAIR-FOND_SOMBRE),vec3f(.2126,.7152,.0722)),0.,4.);
  return vec4f(max(f1-vec3f(m*FOND_SOMBRE),vec3f(0.)),m);
}
struct Aspect { couleur:vec4f, deviation:vec3f, refraction:f32 };
fn aspect(f:V)->Aspect {
  let versOeil=vue.oeil.xyz-f.position;
  let distance=max(length(versOeil),.0001);
  let v=versOeil/distance;
  let brut=normalize(f.normale);
  let n=select(-brut,brut,dot(brut,v)>=0.);
  let mouillage=f.eau.x;
  let vitesse=f.eau.y;
  let phase=f.eau.z;
  let id=f.eau.w;
  let empreinte=max(length(dpdx(f.uv)),length(dpdy(f.uv)));
  let fin=1.-smoothstep(.24,.86,empreinte*88.);
  let gros=1.-smoothstep(.24,.86,empreinte*34.);
  var gouttes=vec4f(0);
  if(mouillage>0. && gros>0.) {
    // Translation continue avec la distance parcourue. À l'arrêt, la gravité
    // fait descendre les perles ; en vitesse le film remonte sur le galbe.
    let p=f.uv+vec2f(0.,phase);
    gouttes=goutte(p*34.,id*19.71,mouillage,vitesse,vue.oeil.w,.5*empreinte*34.)*gros;
    if(fin>0.) {
      gouttes+=.58*goutte((f.uv+vec2f(0.,phase*.43))*88.,id*23.63+9.,mouillage,
        vitesse,vue.oeil.w+.7,.5*empreinte*88.)*fin;
    }
  }
  let tangente=f.tangent-n*dot(f.tangent,n);
  let t=tangente*inverseSqrt(max(dot(tangente,tangente),1e-8));
  let b=cross(n,t);
  let face=select(-1.,1.,dot(brut,v)>=0.);
  let normalEau=normalize(n+t*gouttes.x*.62+b*gouttes.y*.62*face);
  let incidence=clamp(dot(v,normalEau),0.,1.);
  // Schlick : réflexion normale du polycarbonate (~4 %) et reflet rasant.
  let fresnel=.041+.959*pow(1.-incidence,5.);
  let reflet=reflect(-v,normalEau);
  let transmission=refract(-v,normalEau,1./1.49);
  let lumiere=vue.lumiere.rgb*(1.-f.abri);
  let cosSoleil=max(dot(reflet,normalize(vue.soleil.xyz)),0.);
  let refletSolaire=pow(cosSoleil,238.)*1.25+pow(cosSoleil,34.)*.10;
  let absorption=.020+.036*(1.-incidence);
  let relief=clamp(gouttes.z,0.,1.);
  let alpha=clamp(absorption+fresnel*.87+relief*.19+gouttes.w*.06,0.,.91);
  let teint=mix(vue.horizon.rgb,vue.ambiance.rgb,.31+.64*f.abri)*vec3f(.89,.97,1.);
  let refracte=environnement(transmission,f.abri);
  let couleur=(environnement(reflet,f.abri)*fresnel*.87+teint*absorption+
      refracte*relief*.19+lumiere*(refletSolaire*(.10+.56*fresnel)+gouttes.w*.085)) / max(alpha,.001);
  let brume=1.-exp(-distance*max(vue.brume.w,0.)*.65);
  let deviation=(normalEau-n)*.013+(transmission+v)*.0018;
  return Aspect(vec4f(mix(couleur,vue.brume.rgb,brume),alpha),deviation,(.10+relief*.72)*(1.-fresnel));
}
@fragment fn verre(f:V)->@location(0) vec4f {
  let c=aspect(f).couleur;
  return melange(c.rgb*c.a,1.-c.a);
}
@fragment fn verreRefractant(f:V)->@location(0) vec4f {
  let a=aspect(f);
  let cible=vue.clip*vec4f(f.position+a.deviation,1.);
  let dim=vec2f(textureDimensions(scene));
  let uv=f.clip.xy/dim;
  let projetee=cible.xy/max(cible.w,.0001)*vec2f(.5,-.5)+.5;
  let delta=clamp(projetee-uv,-10./dim,10./dim);
  let lecture=uv+delta;
  let bord=min(lecture,1.-lecture)*dim;
  let poids=a.refraction*smoothstep(.5,2.,min(bord.x,bord.y))*smoothstep(.0,.45,length(delta*dim));
  let fond=textureSampleLevel(scene,bilineaire,clamp(lecture,.5/dim,1.-.5/dim),0.).rgb;
  let part=(1.-a.couleur.a)*poids;
  // Le fond réfracté est lu en radiance dans la copie de la scène : il revient en valeur affichée pour le mélange.
  return melange(a.couleur.rgb*a.couleur.a+affiche(fond)*part,1.-a.couleur.a-part);
}`;
  function sommetUnique(gpu, triangles) {
    const donnees=new Float32Array(triangles.length*18);
    let offset=0;
    for(const t of triangles)for(let k=0;k<3;k++){
      donnees.set(t[k],offset);donnees.set(t[k+3],offset+3);offset+=6;
    }
    const buffer=gpu.device.createBuffer({label:'BITUME · géométrie saute-vent',size:donnees.byteLength,
      usage:GPUBufferUsage.VERTEX,mappedAtCreation:true});
    new Float32Array(buffer.getMappedRange()).set(donnees);buffer.unmap();
    return buffer;
  }
  const bornes=(v,a,b)=>Math.max(a,Math.min(b,v));
  function defilement(vitesse,averse) {
    return .0038-bornes((vitesse||0)/72,-1,1)*(.020+.011*bornes(averse||0,0,1));
  }
  // État de la voiture, avancé une seule fois quel que soit le nombre de vues et de rétros.
  function avancer(verre,dt,vitesse,averse,abri) {
    if(!verre)return;
    const pas=Number.isFinite(dt)&&dt>0?dt:0;
    verre.phase=(verre.phase||0)+pas*defilement(vitesse,averse);
    const ombre=abri?1:0;
    verre.ombre=Number.isFinite(verre.ombre)?verre.ombre+(ombre-verre.ombre)*-Math.expm1(-pas/.18):ombre;
    verre.abri=!!abri;
  }
  function signalerPerte(etat){etat.perdu=true;}
  function creer(gpu, triangles) {
    if(!gpu?.device || !triangles?.length)return null;
    const device=gpu.device, nombre=triangles.length*3;
    const geometrie=sommetUnique(gpu,triangles), module=device.createShaderModule({label:'BITUME · verre de la monoplace',code:shader});
    const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
    const layoutScene=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},
      {binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}}]});
    const filtre=device.createSampler({minFilter:'linear',magFilter:'linear'});
    const pipelineLayouts=[[layout],[layout,layoutScene]].map(bindGroupLayouts=>device.createPipelineLayout({bindGroupLayouts}));
    const pipelines=new Map(), histoire=new Map(), zero=[0,0,0], blanc=[1,1,1], soleil=[.4,.8,.3];
    let temps=0, pluie=0, etape=0, libere=false;
    const appareil={perdu:false};
    const vues=[0,1].map(()=>{
      const camera=device.createBuffer({size:176,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      const groupe=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:camera}}]});
      return {elements:[],ordre:[],vueScene:null,groupeScene:null,n:0,donnees:new Float32Array(20*16),buffer:null,camera,groupe,uniformes:new Float32Array(44)};
    });
    device.lost.then(signalerPerte.bind(null,appareil));
    function pipeline(vue,avecScene){
      const cle=vue.format+'/'+vue.depthFormat+'/'+vue.samples+'/'+(avecScene?1:0);
      let p=pipelines.get(cle);
      if(!p){
        p=device.createRenderPipeline({label:'BITUME · saute-vent '+cle,layout:pipelineLayouts[Number(avecScene)],
          vertex:{module,entryPoint:'sommet',buffers:[{arrayStride:24,attributes:[
            {shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]},
            {arrayStride:80,stepMode:'instance',attributes:Array.from({length:5},(_,i)=>({shaderLocation:2+i,offset:i*16,format:'float32x4'}))}]},
          // Couleur : a + m·fond (voir `melange`). Alpha : la scène y porte le poids des reflets d'écran de la surface
          // vue derrière le verre ; le verre n'y touche plus, sans quoi FERRO 0.3.39 mélangerait en radiance des
          // reflets de la route sous toute la glace.
          fragment:{module,entryPoint:avecScene?'verreRefractant':'verre',targets:[{format:vue.format,blend:{
            color:{srcFactor:'one',dstFactor:'src-alpha'},alpha:{srcFactor:'zero',dstFactor:'one'}}}]},
          primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:vue.depthFormat,depthCompare:'less-equal',depthWriteEnabled:false},
          multisample:{count:vue.samples}});
        pipelines.set(cle,p);
      }
      return p;
    }
    function commencer(t,averse){
      temps=Number.isFinite(t)?t:0;pluie=bornes(averse||0,0,1);etape++;
      for(const vue of vues)vue.n=0;
    }
    function ajouter(mesh,vitesse,id,overlay,mouillage,phaseVoiture,ombre=0){
      if(libere||appareil.perdu||!mesh?.p)return false;
      const eau=bornes(Number.isFinite(mouillage)?mouillage:pluie,0,1), air=bornes(Math.abs(vitesse||0)/72,0,1);
      const cle=id??mesh;
      let h=histoire.get(cle);
      if(!h){h={phase:0,dernier:temps,codes:[-1,-1],indice:[0,0]};histoire.set(cle,h);}
      const dt=bornes(temps-h.dernier,0,.2);
      if(temps<h.dernier)h.phase=0;
      h.phase=Number.isFinite(phaseVoiture)?phaseVoiture:h.phase+dt*defilement(vitesse,pluie);h.dernier=temps;
      const l=overlay?1:0, vue=vues[l];
      let i=h.indice[l];
      if(h.codes[l]!==etape){h.codes[l]=etape;i=h.indice[l]=vue.n++;}
      const e=vue.elements[i]||(vue.elements[i]={});
      e.mesh=mesh;e.eau=eau;e.air=air;e.phase=h.phase;e.ombre=bornes(ombre,0,1);e.id=Number.isFinite(id)?id:0;
      return true;
    }
    function collecter(mesh){
      const e=mesh?.surfaceVerre;
      return !!e && ajouter(mesh,e.vitesse,e.id,!!mesh.overlay,e.mouillage,e.phase,e.ombre??Number(!!e.abri));
    }
    function dessiner(pass,v,overlay){
      const vue=vues[overlay?1:0],n=vue.n;
      if(!n||libere||appareil.perdu)return null;
      const u=vue.uniformes, o=v.origine||zero, oeil=v.oeil;
      u.set(v.vp);for(let k=0;k<3;k++)u[16+k]=oeil[k]-o[k];
      u[19]=temps%8192;u.set(v.soleil||soleil,20);u.set(v.couleurSoleil||blanc,24);
      u.set(v.ciel||blanc,28);u.set(v.horizon||blanc,32);u.set(v.ambiance||zero,36);
      u.set(v.brouillard||zero,40);u[43]=v.densite||0;
      device.queue.writeBuffer(vue.camera,0,u);
      if(vue.donnees.length<n*20 || !vue.buffer){
        if(vue.donnees.length<n*20)vue.donnees=new Float32Array(20*2**Math.ceil(Math.log2(n)));
        vue.buffer?.destroy();
        vue.buffer=device.createBuffer({label:'BITUME · instances saute-vent',size:vue.donnees.byteLength,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.VERTEX});
      }
      // Ordre fond puis avant pour les vitres qui se recouvrent. La profondeur du châssis,
      // du pilote, des roues et des autres opaques est celle de cette même passe.
      for(let i=0;i<n;i++){
        const e=vue.elements[i],p=e.mesh.p;
        e.distance=(p[0]-oeil[0])**2+(p[1]-oeil[1])**2+(p[2]-oeil[2])**2;
        let j=i;
        while(j>0 && vue.ordre[j-1].distance<e.distance){vue.ordre[j]=vue.ordre[j-1];j--;}
        vue.ordre[j]=e;
      }
      const m=vue.donnees;
      for(let i=0;i<n;i++){
        const e=vue.ordre[i],mesh=e.mesh, r=mesh.r||zero,s=mesh.s||blanc,p=mesh.p,k=i*20;
        // Colonnes Euler Z·Y·X comme le poseur FERRO, normales par l'inverse transposée.
        const cx=Math.cos(r[0]),sx=Math.sin(r[0]),cy=Math.cos(r[1]),sy=Math.sin(r[1]),cz=Math.cos(r[2]),sz=Math.sin(r[2]);
        m[k]=cz*cy;m[k+1]=sz*cy;m[k+2]=-sy;m[k+3]=e.eau;
        m[k+4]=cz*sy*sx-sz*cx;m[k+5]=sz*sy*sx+cz*cx;m[k+6]=cy*sx;m[k+7]=e.air;
        m[k+8]=cz*sy*cx+sz*sx;m[k+9]=sz*sy*cx-cz*sx;m[k+10]=cy*cx;m[k+11]=e.phase;
        m[k+12]=p[0]-o[0];m[k+13]=p[1]-o[1];m[k+14]=p[2]-o[2];m[k+15]=e.ombre;
        m[k+16]=s[0];m[k+17]=s[1];m[k+18]=s[2];m[k+19]=e.id;
      }
      device.queue.writeBuffer(vue.buffer,0,m,0,n*20);
      const avecScene=!!v.sceneCouleur;
      pass.setPipeline(pipeline(v,avecScene));pass.setBindGroup(0,vue.groupe);
      // FERRO n'expose que la couleur du monde déjà résolue dans une texture distincte.
      if(avecScene){
        if(vue.vueScene!==v.sceneCouleur){
          vue.vueScene=v.sceneCouleur;vue.groupeScene=device.createBindGroup({layout:layoutScene,entries:[
            {binding:0,resource:v.sceneCouleur},{binding:1,resource:filtre}]});
        }
        pass.setBindGroup(1,vue.groupeScene);
      }else{vue.vueScene=vue.groupeScene=null;}
      pass.setVertexBuffer(0,geometrie);pass.setVertexBuffer(1,vue.buffer);pass.draw(nombre,n);
      return {drawCalls:1,instances:n,triangles:n*nombre/3};
    }
    function liberer(){
      if(libere)return;libere=true;geometrie.destroy();
      for(const vue of vues){vue.camera.destroy();vue.buffer?.destroy();vue.elements.length=vue.ordre.length=0;vue.vueScene=vue.groupeScene=null;vue.n=0;}
      histoire.clear();pipelines.clear();
    }
    return {commencer,ajouter,collecter,dessiner,liberer};
  }
  B.sauteVentWebGPU={creer,avancer};
})(globalThis.BITUME=globalThis.BITUME||{});
