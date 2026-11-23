/* BITUME — optique procédurale de la visière, hors des modules FERRO verrouillés.
 * L'eau dévie une copie bornée de la vue courante ; seule la surface mouillée est composée.
 * Les rétroviseurs et l'ATH, posés ensuite par le jeu, restent nets. Aucune image importée. */
(function (B) {
  'use strict';
  const PAS = 1 / 120, MAX_PIXELS = 2000000, MAX_SOURCE_PIXELS = 1048576;
  const QUALITES = Object.freeze({ low: 0, medium: 1, high: 2, ultra: 3 });
  const MAX_GOUTTES_MOBILES = 32;
  const DEPOTS = Object.freeze([6, 12, 24, 32].map((gouttes, i) => Object.freeze({ gouttes, neige: 0, echelleEau: 1.4 + i * .1 })));
  // Micro-impacts, perles fines/moyennes, dépôts espacés, filets et neige humide. Chaque couche garde
  // son transport réel : modifier le vent ou le regard change sa vitesse, jamais sa position.
  const COUCHES = Object.freeze([[.015,.76],[.04,1.35],[.22,2.1],[.65,3.2],[.45,1.25],[.08,4.5]].map(Object.freeze));
  const FONDU_TRANSPORT = .55;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const nombre = (v, defaut = 0) => Number.isFinite(Number(v)) && v != null ? Number(v) : defaut;
  const OPTIQUE = `
struct Uniformes {
  meteo: vec4f, mouvement: vec4f, vue: vec4f, flux: vec4f, gravite: vec4f,
  image: vec4f,
  // Taille du texel, qualité et présence de la scène
  transport: array<vec4f,12>, histoire: array<vec4f,12>, phase: array<vec4f,3>,
  gouttes: array<vec4f,32>, trajets: array<vec4f,32>, impacts: array<vec4f,32>,
  tuiles: array<vec4u,36>, origines: array<vec4i,3>, nombre: vec4u,
};
@group(0) @binding(0) var<uniform> u: Uniformes;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var filtre: sampler;
@group(0) @binding(3) var cacheFilm: texture_2d<u32>;
struct Sommet {
  @builtin(position) position:vec4f, @location(0) uv:vec2f
};
@vertex fn sommet(@builtin(vertex_index) i:u32)->Sommet {
  let p=vec2f(f32((i<<1u)&2u),f32(i&2u));
  return Sommet(vec4f(p*2.-1.,0.,1.),p);
}
fn h21(p:vec2f)->f32 {
  var q=fract(p.xyx*vec3f(.1031,.1030,.0973));
  q+=vec3f(dot(q,q.yzx+33.33));
  return fract((q.x+q.y)*q.z);
}
fn h22(p:vec2f)->vec2f {
  return vec2f(h21(p),h21(p+vec2f(41.7,93.4)));
}
fn coins(i:vec2f)->vec4f {
  return vec4f(h21(i),h21(i+vec2f(1,0)),h21(i+vec2f(0,1)),h21(i+1.));
}
fn interpole(p:vec2f,c:vec4f)->f32 {
  let f=fract(p);
  let k=f*f*(3.-2.*f);
  return mix(mix(c.x,c.y,k.x),mix(c.z,c.w,k.x),k.y);
}
fn bruit(p:vec2f)->f32 {
  return interpole(p,coins(floor(p)));
}
@fragment fn remplirFilm(@builtin(position) pos:vec4f)->@location(0) vec4u {
  let c=vec2i(pos.xy);
  let bande=c.y/20;
  return bitcast<vec4u>(coins(vec2f(u.origines[bande].xy+vec2i(c.x,c.y%20))));
}
fn bruitFilm(p:vec2f,bande:i32)->f32 {
  let c=vec2i(floor(p))-u.origines[bande].xy;
  if(all(c>=vec2i(0)) && all(c<vec2i(24,20))) {
    return interpole(p,bitcast<vec4f>(textureLoad(cacheFilm,c+vec2i(0,bande*20),0)));
  }
  return bruit(p);
}
fn bords(r:f32,aa:f32)->f32 {
  return 1.-smoothstep(1.-aa,1.+aa,r);
}
fn positionTransportee(p:vec2f,tr:vec4f)->vec2f {
  let n=vec2f(p.x/u.vue.x,1.-p.y/u.vue.y)*tr.x+tr.yz;
  return vec2f(n.x,1.-n.y)*u.vue.xy;
}
fn positionSource(p:vec2f,tr:vec4f)->vec2f {
  let n=(vec2f(p.x/u.vue.x,1.-p.y/u.vue.y)-tr.yz)/tr.x;
  return vec2f(n.x,1.-n.y)*u.vue.xy;
}
fn directionFlux(p:vec2f,mobilite:f32,rayon:f32)->vec2f {
  let n=vec2f(p.x/u.vue.x,1.-p.y/u.vue.y);
  let aspect=vec2f(u.vue.y/u.vue.x,1.);
  var v=(u.flux.x*(n-u.gravite.zw)+u.flux.yz*aspect)*(.3+.7*mobilite);
  v+=u.gravite.xy*aspect*(mobilite*8.*(rayon*.35+1.5)/720.);
  v*=vec2f(u.vue.x,-u.vue.y);
  if(length(v)>.0001){
    return normalize(v);
  }
  return vec2f(0,-1);
}
fn perlesGeneration(p:vec2f,cellule:f32,taille:f32,densite:f32,couche:f32,mobilite:f32,indice:i32)->vec4f {
  let tr=u.transport[indice];
  if(tr.w<.0001 || densite==0.){
    return vec4f(0);
  }
  let graine=u.vue.z+u.phase[indice/4][indice%4];
  let t=u.mouvement.x;
  let air=u.mouvement.y;
  let q=positionSource(p,tr)/cellule;
  let id=floor(q);
  let local=fract(q)-.5;
  let alea=h22(id+couche*17.3+graine);
  let centre=(alea-.5)*.48;
  let sourceCentre=(id+.5+centre)*cellule;
  let centreEcran=positionTransportee(sourceCentre,tr);
  let trajet=centreEcran-positionTransportee(sourceCentre,u.histoire[indice]);
  var direction=directionFlux(centreEcran,mobilite,taille);
  if(length(trajet)>.03){
    direction=normalize(trajet);
  }
  let travers=vec2f(-direction.y,direction.x);
  let delta=(local-centre)*tr.x;
  let d=vec2f(dot(delta,travers),dot(delta,direction));
  let rayon=taille*(.48+alea.x*alea.x*.94)/cellule;
  let wVit=clamp(u.mouvement.w,0.,1.);
  let bordMin=select(.006,.38/cellule,couche==7.||couche==1.||couche==4.);
  let rxCell=max(bordMin,rayon*mix(1.,.28,wVit));
  let ryCell=max(.008,rayon*(1.12+mobilite*(.5+air*1.4)+wVit*(2.6+5.2*mobilite)));
  let semisDense=couche==7.||couche==1.||couche==2.||couche==4.;
  let bordCellule=(.5-max(abs(centre.x),abs(centre.y)))*tr.x;
  let limiteAxe=select(.46,min(.46,.86*bordCellule),semisDense);
  let axes=vec2f(select(rxCell,min(rxCell,limiteAxe),semisDense),min(limiteAxe,ryCell));
  let n=d/max(axes,vec2f(.001));
  let angle=atan2(n.y,n.x);
  var asymetrie=1.+sin(angle*3.+alea.y*6.283)*select(.10*taille/12.,.23,couche==6.);
  if(couche==6.){
    asymetrie+=sin(angle*5.-alea.x*11.)*.11;
  }
  let r=length(n)*asymetrie;
  let aa=clamp(fwidth(r)*.72,.018,.58);
  let arriere=-d.y;
  let tracePossible=arriere>rayon*.4 && arriere<.46 && abs(d.x)<=rxCell*.76+rayon*.11;
  if(r>1.59 && !tracePossible){
    return vec4f(0);
  }
  let vie=fract(t*(.033+alea.x*.022)+alea.y);
  let apparition=smoothstep(0.,.09,vie)*(1.-smoothstep(.84,1.,vie));
  var choix=h21(id+73.1+couche+graine);
  if(couche==2.||couche==4.){
    choix/=mix(.5,1.,clamp(u.meteo.z,0.,1.));
  }
  let presence=(1.-smoothstep(densite-.08,densite+.025,choix))*clamp(densite*8.,0.,1.)*tr.w;
  if(presence==0.||apparition==0.){
    return vec4f(0);
  }
  let uvC=vec2f(centreEcran.x/u.vue.x,1.-centreEcran.y/u.vue.y)-u.gravite.zw;
  let clairCentre=mix(1.,smoothstep(.06,.46,length(uvC*vec2f(1.45,1.15))),wVit*.82);
  let masque=bords(r,aa)*presence*apparition*clairCentre*mix(1.,.65,wVit);
  var tx=0.;
  var trace=0.;
  if(tracePossible){
    let limiteTrace=select(.46,min(.46,.92*bordCellule),semisDense);
    let longueur=min(limiteTrace,rayon*1.5+min(.24,length(trajet)/cellule)+rayon*wVit*(2.8+6.5*mobilite));
    tx=d.x-sin(arriere*25.+alea.x*12.)*rayon*.10*(1.-wVit*.6);
    trace=(1.-smoothstep(rxCell*.22,rxCell*.75,abs(tx)))*smoothstep(rayon*.4,rayon*1.2,arriere);
    trace*=(1.-smoothstep(longueur*.65,longueur,arriere))*(mobilite+wVit*.35)*presence*apparition*clairCentre*smoothstep(.06,1.2,length(trajet)+wVit*1.4);
  }
  let creux=sqrt(max(0.,1.-min(r*r,1.)));
  let nn=clamp(n,vec2f(-1),vec2f(1));
  let normale=(travers*nn.x+direction*nn.y)*masque*(.20+.80*creux);
  return vec4f(normale+travers*sign(tx)*trace*.12,max(masque,trace*.48),max(masque*(.34+.66*creux),trace*.26));
}
fn perles(p:vec2f,cellule:f32,taille:f32,densite:f32,couche:f32,mobilite:f32,groupe:i32)->vec4f {
  let i=groupe*2;
  return perlesGeneration(p,cellule,taille,densite,couche,mobilite,i)+perlesGeneration(p,cellule,taille,densite,couche,mobilite,i+1);
}
fn impactGoutte(delta:vec2f,impact:vec4f)->vec4f {
  if(impact.y<.005){
    return vec4f(0);
  }
  let phase=impact.x;
  let rayon=impact.w*(.65+1.7*phase);
  let angle=impact.z;
  let axe=vec2f(cos(angle),sin(angle));
  let travers=vec2f(-axe.y,axe.x);
  let local=vec2f(dot(delta,axe),dot(delta,travers)/(.60+.25*phase));
  let a=atan2(local.y,local.x);
  let dist=length(local);
  let irregulier=1.+.10*sin(a*3.+angle)+.055*sin(a*7.-angle);
  let largeur=max(.7,rayon*.10);
  let bord=abs(dist-rayon*irregulier);
  let couronne=(1.-smoothstep(largeur*.5,largeur+1.,bord))*(.62+.38*sin(a*3.+angle)*sin(a*3.+angle));
  let eclats=(1.-smoothstep(.55,1.5+impact.w*.08,abs(dist-rayon*(1.15+phase*.45))))*pow(max(0.,cos(a*3.-angle)),18.)*(1.-phase);
  let centre=(1.-smoothstep(rayon*.25,rayon*.8,dist))*(1.-phase)*.18;
  let eau=max(couronne*.83,max(eclats*.72,centre))*impact.y;
  let normale=delta/max(length(delta),.1)*(couronne*.52+eclats*.35)*impact.y;
  return vec4f(normale,eau,(couronne*.22+eclats*.35+centre)*impact.y);
}
fn gouttesMobiles(p:vec2f)->vec4f {
  var total=vec4f(0);
  let uvP=vec2f(p.x/u.vue.x,1.-p.y/u.vue.y);
  let centreDist=length((uvP-u.gravite.zw)*vec2f(1.55,1.2));
  let wMob=clamp(u.mouvement.w,0.,1.);
  let centreClear=mix(1.,smoothstep(.08,.44,centreDist),wMob*.80);
  let tuile=clamp(vec2i(p/u.vue.xy*vec2f(16,9)),vec2i(0),vec2i(15,8));
  let index=tuile.y*16+tuile.x;
  var masque=u.tuiles[index/4][index%4];
  while(masque!=0u){
    let i=firstTrailingBit(masque);
    masque&=masque-1u;
    let g=u.gouttes[i];
    let tr=u.trajets[i];
    var impact=u.impacts[i];
    let rayon=g.z*.45;
    impact.w*=.45;
    let emprise=max(rayon*(2.3+wMob*6.5),select(0.,impact.w*(.65+1.7*impact.x)*1.75+2.,impact.y>.005));
    let bas=min(g.xy,min(tr.xy,tr.zw))-emprise;
    let haut=max(g.xy,max(tr.xy,tr.zw))+emprise;
    if(any(p<bas)||any(p>haut)){
      continue;
    }
    let trajet=g.xy-tr.xy;
    var direction=directionFlux(g.xy,1.,rayon);
    if(length(trajet)>.03){
      direction=normalize(trajet);
    }
    let travers=vec2f(-direction.y,direction.x);
    let delta=p-g.xy;
    let rx=max(.9,rayon*mix(1.,.32,wMob));
    let ry=max(1.2,rayon*(1.25+u.mouvement.y*.55+wMob*5.8));
    let n=vec2f(dot(delta,travers),dot(delta,direction))/vec2f(rx,ry);
    let r=length(n);
    let aa=select(.025,max(.025,.85/max(.001,rayon)),rayon>.001);
    let m=bords(r,aa)*g.w;
    let creux=sqrt(max(0.,1.-min(r*r,1.)));
    let nn=clamp(n,vec2f(-1),vec2f(1));
    var normale=(travers*nn.x+direction*nn.y)*m*(.18+.82*creux);
    var trace=0.;
    if(distance(g.xy,tr.zw)>rayon*1.2){
      var meilleur=1e9;
      var progres=0.;
      var precedent=tr.zw;
      var ecart=vec2f(0);
      for(var j=1;j<=4;j++){
        let t=f32(j)*.25;
        let q=mix(mix(tr.zw,tr.xy,t),mix(tr.xy,g.xy,t),t);
        let v=q-precedent;
        let f=clamp(dot(p-precedent,v)/max(dot(v,v),.001),0.,1.);
        let d=p-(precedent+f*v);
        let d2=dot(d,d);
        if(d2<meilleur){
          meilleur=d2;
          progres=(f32(j-1)+f)*.25;
          ecart=d;
        }
        precedent=q;
      }
      let largeur=max(.55,rayon*mix(.05,.18,progres)-rayon*u.mouvement.w*.03);
      trace=(1.-smoothstep(largeur*.45,largeur+1.,sqrt(meilleur)))*smoothstep(0.,.14,progres)*g.w*.62;
      normale+=ecart/max(length(ecart),.1)*trace*.35;
    }
    total+=vec4f(normale,max(m,trace),max(m*(.5+.5*creux),trace*.45))+impactGoutte(delta,impact);
  }
  return total*centreClear;
}
// La surface du modèle utilise l'origine basse. Le stockage de présentation WebGPU est orienté vers le bas.
fn lireScene(p:vec2f)->vec3f {
  return textureSampleLevel(source,filtre,vec2f(p.x,1.-p.y),0.).rgb;
}
fn scene(pixel:vec2f,flou:f32)->vec3f {
  let p=clamp(pixel,vec2f(.002),vec2f(.998));
  var c=lireScene(p);
  if(u.image.z>1. && flou>.015){
    let d=u.image.xy*(1.+flou*7.);
    let b=lireScene(p+d)+lireScene(p+vec2f(-d.x,d.y))+lireScene(p+vec2f(d.x,-d.y))+lireScene(p-d);
    c=mix(c,b*.25,min(.88,flou));
  }
  return c;
}
@fragment fn reduire(@location(0) uv:vec2f)->@location(0) vec4f {
  return vec4f(lireScene(uv),1.);
}
@fragment fn composer(@location(0) uv:vec2f)->@location(0) vec4f {
  let eau=u.meteo.x;
  let neige=u.meteo.y;
  let embruns=u.meteo.z;
  let film=u.meteo.w;
  if(max(max(eau,neige),max(embruns,film))<.001 && u.nombre.x==0u){
    return vec4f(0);
  }
  let p=uv*u.vue.xy;
  const pasPluie=.316227766;
  const pasSillage=.223606798;
  var micro=vec4f(0);
  if(u.image.z>0.){
    micro=perles(p+vec2f(3.7,8.1),9.5*pasPluie,.76,clamp(eau*(.78+u.mouvement.w*.28),0.,.96),7.,.015,0);
  }
  var a=perles(p,15.*pasPluie,1.35,clamp(eau*.94,0.,.97),1.,.04,1);
  let b=perles(p,35.*pasSillage,2.1,clamp(eau*.83,0.,.93),2.,.22,2);
  var c=vec4f(0);
  var filets=vec4f(0);
  if(u.image.z>0.){
    let attenuGros=mix(1.,.18,clamp(u.mouvement.w,0.,1.));
    c=perles(p,77.,3.2,clamp(eau*.34*attenuGros,0.,.85),3.,.65,3)*attenuGros;
    if(eau>.30){
      filets=perles(p+vec2f(11.3,4.7),18.*pasSillage,1.25,clamp(eau*.95,0.,.96),4.,.45,4);
    }
  } else{
    a*=.6;
  }
  let mobiles=gouttesMobiles(p);
  var normale=micro.xy*.20+filets.xy*.26+a.xy*.44+b.xy*.68+c.xy*.9+mobiles.xy;
  var goutte=clamp(micro.z+filets.z*.72+a.z+b.z+c.z+mobiles.z,0.,1.);
  let relief=clamp(micro.w*.16+filets.w*.20+a.w*.3+b.w*.5+c.w*.8+mobiles.w,0.,1.);
  let menisque=clamp((micro.z-micro.w+filets.z-filets.w+a.z-a.w+b.z-b.w+c.z-c.w+mobiles.z-mobiles.w)*1.7,0.,1.);
  var turbulent=.5;
  if(embruns>.001||(u.image.w>0. && film>.001)){
    turbulent=bruitFilm(uv*vec2f(9,7)+vec2f(u.mouvement.x*.38,-u.mouvement.x*.54),0);
    turbulent=.67*turbulent+.33*bruitFilm(uv*vec2f(21,17)-u.mouvement.x*.27,1);
  }
  let centre=uv-vec2f(.5,.57);
  let panache=exp(-dot(centre*vec2f(1.8,1.45),centre*vec2f(1.8,1.45))*2.1);
  let voile=clamp(embruns*panache*(.44+turbulent*.78),0.,.88);
  var grain=0.;
  var blanc=0.;
  if(neige>.001){
    let bord=min(uv,1.-uv);
    let distanceBord=min(bord.x*1.32,bord.y);
    let dentelle=bruit(p/37.+u.vue.z)*.024+bruit(p/11.)*.010;
    let lobes=bruit(p/vec2f(173,109)+u.vue.z);
    let coin=exp(-length(bord*vec2f(1.3,1.))*11.);
    let epaisseur=neige*((.021+.078*(1.-uv.y))*(.35+1.15*lobes)+coin*.046+dentelle);
    let bourrelet=(1.-smoothstep(epaisseur*.52,epaisseur+.022+lobes*.015,distanceBord))*neige;
    grain=bruit(p*.39+u.vue.z)*.5+bruit(p*.13)*.5;
    let amas=perles(p,48.,4.5,clamp(neige*.65,0.,.82),6.,.08,5);
    let cristaux=smoothstep(.44,.75,bruit(p*.71+u.vue.z))*.34;
    normale+=amas.xy*neige*.35;
    goutte=clamp(goutte+amas.z*neige*.35,0.,1.);
    blanc=clamp(bourrelet*(.68+.32*grain)+amas.z*neige*(.26+.53*grain+cristaux),0.,.96);
  }
  let brume=clamp(film*.065+neige*.04,0.,.13);
  var alpha=clamp(max(goutte*.90,max(voile,blanc))+brume,0.,.98)*u.vue.w;
  if(alpha<.002){
    return vec4f(0);
  }
  var image=vec3f(.61,.69,.73);
  if(u.image.w>0.){
    var deviation=normale*vec2f(3.,3.6)/u.vue.xy;
    if(film!=0.){
      deviation+=(vec2f(turbulent,bruitFilm(uv*13.+u.mouvement.x*.2,2))-.5)*film*.002;
    }
    image=scene(uv+deviation,clamp(relief*.22+voile*.88+blanc*.72,0.,1.));
    let ombre=smoothstep(.01,.24,dot(normale,normalize(vec2f(.35,-.94))));
    let reflet=pow(smoothstep(.02,.33,dot(-normale,normalize(vec2f(.35,-.94)))),2.);
    image*=1.-ombre*(.025+menisque*.10)-menisque*.035;
    image+=vec3f(.72,.85,.94)*reflet*(.045+menisque*.18);
  } else{
    let lumiere=dot(-normale,normalize(vec2f(.35,-.94)));
    image=mix(vec3f(.08,.15,.19),vec3f(.87,.94,.98),smoothstep(-.2,.5,lumiere));
    alpha*=.30;
  }
  image=mix(image,vec3f(.72,.78,.80),voile*.63+brume);
  image=mix(image,vec3f(.86,.91,.94)+grain*.055,blanc);
  return vec4f(clamp(image,vec3f(0),vec3f(1))*alpha,alpha);
}
`;
  function nouvelleGeneration() {
    return { echelle:1,x:0,y:0,poids:0,age:0,graine:0,tempsTrace:0,histoire:new Float64Array(12) };
  }
  function initialiserGeneration(g,graine,poids) {
    g.echelle=1;g.x=g.y=g.age=g.tempsTrace=0;g.graine=graine;g.poids=poids;
    for(let i=0;i<12;i+=3){g.histoire[i]=1;g.histoire[i+1]=g.histoire[i+2]=0;}
  }
  function preparerTransport(e,k=1) {
    for(let couche=0;couche<COUCHES.length;couche++)for(let n=0;n<2;n++) {
      const g=e.couches[couche].generations[n],i=(couche*2+n)*4,p=e.transportPrecedent,h=e.histoirePrecedente;
      e.transportUniformes[i]=p[i]*(1-k)+g.echelle*k;
      e.transportUniformes[i+1]=p[i+1]*(1-k)+g.x*k;e.transportUniformes[i+2]=p[i+2]*(1-k)+g.y*k;
      e.transportUniformes[i+3]=p[i+3]*(1-k)+g.poids*k;
      for(let j=0;j<3;j++)e.histoireUniformes[i+j]=h[i+j]*(1-k)+g.histoire[9+j]*k;
      e.histoireUniformes[i+3]=0;e.phaseUniformes[couche*2+n]=g.graine;
    }
  }
  function reinitialiserTransport(e) {
    for(const couche of e.couches) {
      couche.active=0;couche.fondu=0;couche.transition=false;couche.sequence=0;
      initialiserGeneration(couche.generations[0],0,1);initialiserGeneration(couche.generations[1],0,0);
    }
    preparerTransport(e);e.transportPrecedent.set(e.transportUniformes);e.histoirePrecedente.set(e.histoireUniformes);
    e.fluxUniformes.fill(0);
  }
  // Solution affine exacte du champ commun pendant un pas fixe. L'échelle et la translation sont
  // intégrées, pas recalculées avec temps*vitesse : une rafale ou un regard arrière ne téléporte rien.
  function avancerGeneration(g,flux,mobilite,rayon,aspect) {
    const adherence=.3+.7*mobilite,a=flux.expansion*adherence,ex=Math.exp(a*PAS),integrale=a>1e-10?(ex-1)/a:PAS;
    const gravite=mobilite*8*(rayon*.35+1.5)/720;
    const bx=flux.deriveX*adherence*aspect+flux.graviteX*gravite*aspect-a*flux.centreX;
    const by=flux.deriveY*adherence+flux.graviteY*gravite-a*flux.centreY;
    g.tempsTrace+=PAS;
    if(g.tempsTrace>=.1-1e-10) {
      g.tempsTrace-=.1;
      for(let i=11;i>=3;i--)g.histoire[i]=g.histoire[i-3];
      g.histoire[0]=g.echelle;g.histoire[1]=g.x;g.histoire[2]=g.y;
    }
    g.echelle*=ex;g.x=g.x*ex+bx*integrale;g.y=g.y*ex+by*integrale;g.age+=PAS;
  }
  function avancerTransport(e,flux,aspect) {
    for(let couche=0;couche<COUCHES.length;couche++) {
      const l=e.couches[couche],a=l.generations[l.active],b=l.generations[1-l.active],param=COUCHES[couche];
      for(let n=0;n<2;n++) {
        const g=l.generations[n],i=(couche*2+n)*4;
        e.transportPrecedent[i]=g.echelle;e.transportPrecedent[i+1]=g.x;e.transportPrecedent[i+2]=g.y;e.transportPrecedent[i+3]=g.poids;
        for(let j=0;j<3;j++)e.histoirePrecedente[i+j]=g.histoire[9+j];
      }
      avancerGeneration(a,flux,param[0],param[1],aspect);
      if(l.transition) {
        avancerGeneration(b,flux,param[0],param[1],aspect);l.fondu=Math.min(1,l.fondu+PAS/FONDU_TRANSPORT);
        a.poids=1-l.fondu;b.poids=l.fondu;
        if(l.fondu===1){l.active=1-l.active;l.transition=false;}
      } else if(a.echelle>3.8 || Math.abs(a.x)>1.2 || Math.abs(a.y)>1.2 || a.age>18+couche*.71) {
        // Une deuxième population naît sans déplacer la première, puis la remplace en fondu.
        // Hors de ce bref chevauchement, le shader ne calcule qu'une génération par couche.
        initialiserGeneration(b,++l.sequence*173.17+couche*31.9,0);l.fondu=0;l.transition=true;
      }
    }
  }
  function creerEtat(options) {
    if (!B.vitre && typeof module !== 'undefined' && module.exports) require('./vitre.js');
    const e={ temps: 0, accumulateur: 0, eau: 0, neige: 0, embruns: 0, film: 0,
      precedent: new Float64Array(4), uniformes: new Float32Array(12), etapes: 0,
      depots: B.vitre.creerSimulation(options), gouttesUniformes: new Float32Array(MAX_GOUTTES_MOBILES * 4),
      trajetsUniformes: new Float32Array(MAX_GOUTTES_MOBILES * 4), impactsUniformes: new Float32Array(MAX_GOUTTES_MOBILES * 4), nbGouttes: 0,
      couches:COUCHES.map(()=>({active:0,fondu:0,transition:false,sequence:0,generations:[nouvelleGeneration(),nouvelleGeneration()]})),
      transportUniformes:new Float32Array(48),histoireUniformes:new Float32Array(48),phaseUniformes:new Float32Array(12),
      transportPrecedent:new Float64Array(48),histoirePrecedente:new Float64Array(48),fluxUniformes:new Float32Array(8),
      graine: options && Number.isInteger(options.graine) ? options.graine : 0 };
    reinitialiserTransport(e);return e;
  }
  function preparerDepots(e) {
    const d=e.depots,k=clamp(d.accumulateur*30,0,1),w=d.largeur,h=d.hauteur,g=e.gouttesUniformes,tr=e.trajetsUniformes,imp=e.impactsUniformes;
    let n=0;
    for(let i=0;i<MAX_GOUTTES_MOBILES;i++) {
      const p=d.gouttes[i];if(!p.vivant&&!p.fusion)continue;
      const age=p.pa*(1-k)+p.age*k,poids=p.pp*(1-k)+p.poids*k;
      const alpha=clamp(Math.min(1,age/.24,(p.duree-age)/1.5)*poids,0,1);
      const force=B.vitre.lireImpact(p,k,imp,n*4,d.impactsActifs);if(Math.max(alpha,force)<.005)continue;
      const j=n++*4;
      g[j]=(p.px*(1-k)+p.x*k)*w;g[j+1]=(1-p.py*(1-k)-p.y*k)*h;
      g[j+2]=Math.sqrt(p.pr*p.pr*(1-k)+(p.vivant?p.taille*p.taille:0)*k);g[j+3]=alpha;
      tr[j]=p.traceX[2]*w;tr[j+1]=(1-p.traceY[2])*h;tr[j+2]=p.traceX[5]*w;tr[j+3]=(1-p.traceY[5])*h;
    }
    // Une sortie par un bord réduit réellement le nombre actif. Ne pas garder d'anciens
    // uniformes dans la fin du tampon : leur contenu ne doit pas dépendre de la cadence.
    g.fill(0,n*4);tr.fill(0,n*4);imp.fill(0,n*4);e.nbGouttes=n;
  }
  function avancerEtat(e, dt, c) {
    if (c.pause || !Number.isFinite(dt) || dt <= 0) return;
    const intensite=clamp(nombre(c.intensite,1),0,2),flux=B.vitre.calculerFlux(c,e.depots.flux),air=nombre(flux.air,0);
    const niveau=QUALITES[c.qualite]??2;
    // L'étirement, les motifs de réfraction et les dépôts mobiles suivent le même
    // air relatif. Un regard arrière ou un recul peut délester cette face en pleine vitesse.
    const charge=clamp(flux.vitesseIncidente/95,0,1);
    const largeur=Math.max(1,nombre(c.largeur,e.depots.largeur)),hauteur=Math.max(1,nombre(c.hauteur,e.depots.hauteur)),aspect=hauteur/largeur;
    const neige=c.abri ? 0 : clamp(nombre(c.neige),0,1);
    const pluie=c.abri || neige>.001 ? 0 : clamp(nombre(c.pluie),0,1);
    const spray=c.abri || neige>.001 ? 0 : clamp(nombre(c.embruns),0,1);
    // Le flux de pneus renouvelle la visière même quand l'air chasse efficacement la pluie libre.
    const eauCible=clamp((pluie*1.20/(1+air*2.8)+spray*1.90/(1+air*.35))*intensite,0,1.90);
    const neigeCible=clamp(neige*intensite/(1+air*7),0,1.25);
    e.accumulateur+=Math.min(.25,dt);
    while (e.accumulateur+1e-10>=PAS) {
      avancerTransport(e,flux,aspect);
      e.precedent[0]=e.eau; e.precedent[1]=e.neige; e.precedent[2]=e.embruns; e.precedent[3]=e.film;
      const fonte=e.neige*.18+Math.max(0,e.neige-neigeCible)*(.03+air*.10);
      e.eau+=(eauCible+fonte-e.eau)*(1-Math.exp(-PAS*(eauCible>e.eau ? .72 : .22+air*1.8)));
      e.neige+=(neigeCible-e.neige)*(1-Math.exp(-PAS*(neigeCible>e.neige ? .10 : .065+air*.6)));
      e.embruns+=(spray*intensite-e.embruns)*(1-Math.exp(-PAS*(spray>e.embruns ? 4 : 1.4)));
      const filmCible=clamp((pluie*.40/(1+air*4)+spray*.82/(1+air*.45))*intensite,0,1.5);
      e.film+=(filmCible-e.film)*(1-Math.exp(-PAS*(filmCible>e.film ? .5 : .3+air)));
      if(e.eau<.0005 && eauCible+fonte===0)e.eau=0;
      if(e.neige<.0005 && neigeCible===0)e.neige=0;
      if(e.embruns<.0005 && spray===0)e.embruns=0;
      if(e.film<.0005 && filmCible===0)e.film=0;
      e.temps+=PAS; e.etapes++; e.accumulateur-=PAS;
    }
    const k=clamp(e.accumulateur/PAS,0,1), u=e.uniformes;
    u[0]=e.precedent[0]*(1-k)+e.eau*k; u[1]=e.precedent[1]*(1-k)+e.neige*k;
    u[2]=e.precedent[2]*(1-k)+e.embruns*k; u[3]=e.precedent[3]*(1-k)+e.film*k;
    u[4]=Math.max(0,e.temps-PAS+e.accumulateur); u[5]=air;
    u[6]=charge; u[7]=charge*charge;
    u[8]=largeur;u[9]=hauteur; u[10]=e.graine*37.31;
    u[11]=(c.cockpit===false ? .64 : 1)*Math.min(1,intensite);
    const f=e.fluxUniformes;f[0]=flux.expansion;f[1]=flux.deriveX;f[2]=flux.deriveY;f[3]=flux.air;
    f[4]=flux.graviteX;f[5]=flux.graviteY;f[6]=flux.centreX;f[7]=flux.centreY;
    preparerTransport(e,k);
    B.vitre.avancerSimulation(e.depots,dt,c,DEPOTS[niveau],flux);preparerDepots(e);
  }
  function montrer(e, oui) {
    if (e.masquee===!oui) return;
    e.masquee=!oui; if(e.canvas.style) e.canvas.style.visibility=oui ? '' : 'hidden';
  }
  // Un programme et un sampler par format et par appareil. Les textures de scène, le film et
  // les uniformes appartiennent à chaque joueur : J1 peut reprendre la scène après la copie de J2.
  const appareils = new WeakMap();
  const NB_MOTS = 676;
  let appareilAutonome = null;

  function gpuAutonome() {
    if (!appareilAutonome) {
      appareilAutonome = (async () => {
        const adaptateur = await navigator.gpu.requestAdapter();
        if (!adaptateur) throw new Error('Adaptateur WebGPU indisponible');
        const device = await adaptateur.requestDevice();
        device.lost.then(() => { appareilAutonome = null; });
        return {device, canvasFormat:navigator.gpu.getPreferredCanvasFormat()};
      })().catch(err => { appareilAutonome = null; throw err; });
    }
    return appareilAutonome;
  }
  function programmes(device, format) {
    let appareil = appareils.get(device);
    if (!appareil) {
      appareil = { clients:new Set(), formats:new Map(), module:device.createShaderModule({label:'BITUME · optique',code:OPTIQUE}),
        filtre:device.createSampler({label:'BITUME · réfraction linéaire',magFilter:'linear',minFilter:'linear'}) };
      appareils.set(device,appareil);
      device.lost.then(info => {
        appareil.perdu = true;
        for (const e of appareil.clients) {
          e.perdu = e.stats.perdu = true;
          e.pret = e.stats.pret = false;
          e.stats.erreur = 'Périphérique perdu · ' + (info.message || info.reason);
          montrer(e,false);
        }
      });
    }
    let p = appareil.formats.get(format);
    if (!p) {
      const module = appareil.module;
      function pipeline(entryPoint, cible) {
        return device.createRenderPipeline({label:'BITUME · '+entryPoint,layout:'auto',
          vertex:{module,entryPoint:'sommet'},fragment:{module,entryPoint,targets:[{format:cible}]},primitive:{topology:'triangle-list'}});
      }
      p = {composer:pipeline('composer',format), film:pipeline('remplirFilm','rgba32uint'), reduire:pipeline('reduire','rgba8unorm'), appareil};
      appareil.formats.set(format,p);
    }
    return p;
  }
  function texture(e, label, w, h, format, usage) {
    const t=e.device.createTexture({label:'BITUME · '+label,size:[w,h],format,usage});
    return {t,vue:t.createView(),w,h,format};
  }
  function detruireRessources(e) {
    e.pipelines?.appareil.clients.delete(e);
    e.uniformeGPU?.destroy();
    e.filmGPU?.t.destroy(); e.vide?.t.destroy(); e.native?.t.destroy(); e.reduite?.t.destroy();
    e.uniformeGPU=e.filmGPU=e.vide=e.native=e.reduite=null;
    e.groupeFilm=e.groupeReduction=e.groupeComposition=e.vueLiee=e.pipelines=null;
    if(e.device) e.contexte.unconfigure();
    e.device=null; e.pret=e.stats.pret=false;
  }
  function rattacher(e, gpu) {
    const device = gpu?.device;
    if (!device || e.libere) return false;
    if (device===e.device) return e.pret && !e.perdu;
    if (e.device) detruireRessources(e);
    const format = gpu.canvasFormat || globalThis.navigator.gpu.getPreferredCanvasFormat();
    e.device=device;
    try {
      const p=programmes(device,format);
      if (p.appareil.perdu) return false;
      e.pipelines=p; p.appareil.clients.add(e);
      e.contexte.configure({device,format,alphaMode:'premultiplied'});
      e.uniformeGPU=device.createBuffer({label:'BITUME · état optique',size:NB_MOTS*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      e.filmGPU=texture(e,'atlas de film',24,60,'rgba32uint',GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING);
      e.vide=texture(e,'source vide',1,1,'rgba8unorm',GPUTextureUsage.TEXTURE_BINDING);
      e.groupeFilm=device.createBindGroup({layout:p.film.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.uniformeGPU}}]});
      e.filmValide=false; e.gpu=gpu; e.propre=true; e.perdu=e.stats.perdu=false;
      e.pret=e.stats.pret=true; e.stats.erreur=null;
      return true;
    } catch (err) {
      detruireRessources(e); e.stats.erreur=String(err.message||err); montrer(e,false); return false;
    }
  }
  function synchroniser(e) {
    const gpu=e.fournirGPU ? e.fournirGPU() : e.gpu;
    if (e.fournirGPU && !gpu?.device) { montrer(e,false); return false; }
    if (gpu?.device && gpu.device !== e.device) rattacher(e,gpu);
    return e.pret && !e.perdu;
  }
  function creer(canvas,options={}) {
    options ||= {};
    if (!canvas || typeof canvas.getContext !== 'function' || typeof canvas.getBoundingClientRect !== 'function' ||
        !canvas.ownerDocument || (!options.gpu && !globalThis.navigator?.gpu)) return null;
    let contexte;
    try { contexte=canvas.getContext('webgpu'); } catch (_) { return null; }
    if (!contexte) return null;
    const e={canvas,contexte, gpu:null, device:null, fournirGPU:typeof options.gpu==='function' ? options.gpu : null,
      tuilesGouttes:new Uint32Array(16*9),mots:new Float32Array(NB_MOTS),simulation:creerEtat(options),
      masquee:false,propre:true,perdu:false,libere:false,pret:false,dprPalier:null,largeur:1,hauteur:1,dpr:1,
      source:{width:1,height:1}, stats:{backend:'webgpu',pret:false,perdu:false,erreur:null,copiesScene:0,copiesDirectes:0,reductionsGPU:0,dessins:0,etapes:0,pixels:0,pixelsSource:0,
      largeur:0,hauteur:0,dpr:1,eau:0,accumulationNeige:0,embruns:0,gouttes:0,neige:0,
      fusionsEau:0,expulses:0,depotsEau:0,depotsEmbruns:0,impactsEmis:0,surfaceExpulsee:0}};
    e.entiers=new Uint32Array(e.mots.buffer); e.origines=new Int32Array(e.mots.buffer,660*4,12);
    montrer(e,false);
    if (options.gpu) rattacher(e,e.fournirGPU ? e.fournirGPU() : options.gpu);
    else e.initialisation=gpuAutonome().then(gpu=>rattacher(e,gpu)).catch(err=>{ e.stats.erreur=String(err.message||err);return false; });
    return e;
  }
  function dimensionner(e,c,niveau) {
    const palier=niveau>2 ? 1.5 : niveau>1 ? 1.25 : 1;
    e.dprPalier=e.dprPalier===null ? palier : Math.min(e.dprPalier,palier);
    const largeur=Math.max(1,nombre(c.largeur,e.canvas.clientWidth||1)),hauteur=Math.max(1,nombre(c.hauteur,e.canvas.clientHeight||1));
    const dpr=Math.min(e.dprPalier,Math.max(.25,nombre(c.dpr,globalThis.devicePixelRatio||1)),Math.sqrt(MAX_PIXELS/(largeur*hauteur)));
    const w=Math.max(1,Math.floor(largeur*dpr)),h=Math.max(1,Math.floor(hauteur*dpr));
    if(e.canvas.width!==w || e.canvas.height!==h){e.canvas.width=w;e.canvas.height=h;e.propre=true;}
    e.largeur=largeur;e.hauteur=hauteur;e.dpr=dpr;
    e.stats.largeur=w;e.stats.hauteur=h;e.stats.dpr=dpr;e.stats.pixels=w*h;
    const plafond=niveau>1 ? MAX_SOURCE_PIXELS : MAX_SOURCE_PIXELS/2;
    const rapport=Math.min(1,Math.sqrt(plafond/(largeur*hauteur)));
    const sw=Math.max(1,Math.floor(largeur*rapport)),sh=Math.max(1,Math.floor(hauteur*rapport));
    if(e.source.width!==sw || e.source.height!==sh){e.source.width=sw;e.source.height=sh;}
    e.stats.pixelsSource=sw*sh;
  }
  function preparerTuiles(e) {
    const s=e.simulation, cases=e.tuilesGouttes, gx=s.gouttesUniformes, tr=s.trajetsUniformes, impacts=s.impactsUniformes;
    const tuilesParPixelX=16/e.largeur, tuilesParPixelY=9/e.hauteur, vitesse=clamp(s.uniformes[7],0,1);
    cases.fill(0);
    for(let i=0;i<s.nbGouttes;i++) {
      const o=i*4, halo=impacts[o+1]>.005 ? impacts[o+3]*.45*(.65+1.7*impacts[o])*1.75+2 : 0;
      // Même emprise que le shader, élargie d'un pixel à ses limites d'arrondi.
      const m=1+Math.max(gx[o+2]*.45*(2.3+vitesse*6.5),halo);
      const x0=Math.max(0,Math.floor((Math.min(gx[o],tr[o],tr[o+2])-m)*tuilesParPixelX));
      const x1=Math.min(15,Math.floor((Math.max(gx[o],tr[o],tr[o+2])+m)*tuilesParPixelX));
      const y0=Math.max(0,Math.floor((Math.min(gx[o+1],tr[o+1],tr[o+3])-m)*tuilesParPixelY));
      const y1=Math.min(8,Math.floor((Math.max(gx[o+1],tr[o+1],tr[o+3])+m)*tuilesParPixelY));
      for(let y=y0;y<=y1;y++) {
        for(let x=x0;x<=x1;x++)cases[y*16+x]|=1<<i;
      }
    }
  }
  function passe(encodeur, vue, pipeline, groupe) {
    const p=encodeur.beginRenderPass({colorAttachments:[{view:vue,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}]});
    if (pipeline) { p.setPipeline(pipeline); p.setBindGroup(0,groupe); p.draw(3); }
    p.end();
  }
  function copierScene(e,c,encodeur) {
    const scene=c.sourceScene, gpu=e.fournirGPU ? e.fournirGPU() : e.gpu;
    if (!scene?.width || !scene.height) return null;
    // La texture de présentation n’est valable que pendant cette image. Capturer avant
    // le dessin de l'autre joueur. Aucune lecture CPU ni rétention du swapchain.
    const original=gpu?.context?.canvas===scene ? gpu.context.getCurrentTexture() : null;
    const format=original?.format || 'rgba8unorm';
    const w=original?.width || scene.width, h=original?.height || scene.height;
    if (!e.native || e.native.w!==w || e.native.h!==h || e.native.format!==format) {
      e.native?.t.destroy();
      e.native=texture(e,'copie de la caméra',w,h,format,GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT);
      e.groupeReduction=null;
    }
    if (original && (original.usage&GPUTextureUsage.COPY_SRC)) encodeur.copyTextureToTexture({texture:original},{texture:e.native.t},[w,h]);
    else e.device.queue.copyExternalImageToTexture({source:scene},{texture:e.native.t},[w,h]);
    if (w===e.source.width && h===e.source.height) {e.stats.copiesDirectes++;return e.native.vue;}
    if (!e.reduite || e.reduite.w!==e.source.width || e.reduite.h!==e.source.height) {
      e.reduite?.t.destroy();
      e.reduite=texture(e,'réfraction réduite',e.source.width,e.source.height,'rgba8unorm',GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT);
    }
    const p=e.pipelines;
    if (!e.groupeReduction) e.groupeReduction=e.device.createBindGroup({layout:p.reduire.getBindGroupLayout(0),entries:[
      {binding:1,resource:e.native.vue},{binding:2,resource:p.appareil.filtre}]});
    passe(encodeur,e.reduite.vue,p.reduire,e.groupeReduction);e.stats.reductionsGPU++;
    return e.reduite.vue;
  }
  function ecrireUniformes(e,niveau,avecScene) {
    const s=e.simulation,m=e.mots;
    s.uniformes[8]=e.largeur; s.uniformes[9]=e.hauteur;
    m.set(s.uniformes); m.set(s.fluxUniformes,12);
    m[20]=1/e.source.width; m[21]=1/e.source.height; m[22]=niveau; m[23]=avecScene?1:0;
    m.set(s.transportUniformes,24); m.set(s.histoireUniformes,72); m.set(s.phaseUniformes,120);
    m.set(s.gouttesUniformes,132); m.set(s.trajetsUniformes,260); m.set(s.impactsUniformes,388);
    preparerTuiles(e);e.entiers.set(e.tuilesGouttes,516);e.entiers[672]=s.nbGouttes;
    e.device.queue.writeBuffer(e.uniformeGPU,0,m);
  }
  function dessiner(e,c,niveau,chauffe) {
    const u=e.simulation.uniformes,p=e.pipelines,encodeur=e.device.createCommandEncoder({label:'BITUME · visière'});
    let vue=null;
    if (niveau>0 && c.sourceScene) {
      try { vue=copierScene(e,c,encodeur); if(vue){e.stats.copiesScene++;e.stats.erreur=null;} }
      catch(err) { e.stats.erreur='copie scène · '+String(err.message||err); }
    }
    // Les trois bandes d'entiers préservent les bits des quatre hachages de chaque cellule.
    // Une mise à jour par changement d'origine suffit ; le bruit reste interpolé par pixel.
    if (chauffe || u[2]>.001 || (vue && u[3]!==0)) {
      const t=u[4],o=e.origines,x=Math.floor(t*.38)-1,y=Math.floor(-t*.54)-1,b=Math.floor(-t*.27)-1,k=Math.floor(t*.2)-1;
      if (!e.filmValide || o[0]!==x || o[1]!==y || o[4]!==b || o[8]!==k) {
        o[0]=x;o[1]=y;o[4]=o[5]=b;o[8]=o[9]=k;e.filmValide=true;
        passe(encodeur,e.filmGPU.vue,p.film,e.groupeFilm);
      }
    }
    ecrireUniformes(e,niveau,!!vue);
    const lecture=vue || e.vide.vue;
    if (lecture!==e.vueLiee) {
      e.vueLiee=lecture;
      e.groupeComposition=e.device.createBindGroup({layout:p.composer.getBindGroupLayout(0),entries:[
        {binding:0,resource:{buffer:e.uniformeGPU}},{binding:1,resource:lecture},
        {binding:2,resource:p.appareil.filtre},{binding:3,resource:e.filmGPU.vue}]});
    }
    passe(encodeur,e.contexte.getCurrentTexture().createView(),p.composer,e.groupeComposition);
    e.device.queue.submit([encodeur.finish()]);e.stats.dessins++;e.propre=!!chauffe;montrer(e,!chauffe);
  }
  function viderToile(e) {
    if (!e.propre && e.pret && !e.perdu) {
      const encodeur=e.device.createCommandEncoder();passe(encodeur,e.contexte.getCurrentTexture().createView());
      e.device.queue.submit([encodeur.finish()]);
    }
    e.propre=true;
  }
  function effacer(e) {
    if(!e || e.libere)return;
    viderToile(e);
    const s=e.simulation;s.eau=s.neige=s.embruns=s.film=s.accumulateur=0;s.precedent.fill(0);s.uniformes.fill(0);
    B.vitre.effacer(s.depots);s.nbGouttes=0;s.gouttesUniformes.fill(0);s.trajetsUniformes.fill(0);s.impactsUniformes.fill(0);
    reinitialiserTransport(s);
    e.stats.eau=e.stats.accumulationNeige=e.stats.embruns=e.stats.gouttes=0;e.dprPalier=null;montrer(e,false);
  }
  function mettreAJour(e,dt,c) {
    if(!e || e.libere)return e ? e.stats : null;
    c=c||{};
    if(c.actif===false || c.retro===true || c.qualite==='off' || clamp(nombre(c.intensite,1),0,2)===0){effacer(e);return e.stats;}
    if(c.pause || !synchroniser(e) || !Number.isFinite(dt) || dt<=0)return e.stats;
    const niveau=QUALITES[c.qualite]??2, s=e.simulation;
    // Le jeu transmet la toile, sans dimensions CSS dans le contexte : dépôts et shader doivent partager
    // celles de cette vue, y compris J2 et un redimensionnement, avant le premier pas de déplacement.
    dimensionner(e,c,niveau);s.depots.largeur=e.largeur;s.depots.hauteur=e.hauteur;
    avancerEtat(s,dt,c);
    e.stats.eau=s.eau;e.stats.accumulationNeige=s.neige;e.stats.embruns=s.embruns;e.stats.etapes=s.etapes;
    e.stats.gouttes=s.depots.stats.gouttes;e.stats.fusionsEau=s.depots.stats.fusionsEau;e.stats.expulses=s.depots.stats.expulses;
    e.stats.depotsEau=s.depots.stats.depotsEau;e.stats.depotsEmbruns=s.depots.stats.depotsEmbruns;e.stats.surfaceExpulsee=s.depots.stats.surfaceExpulsee;
    e.stats.impactsEmis=s.depots.stats.impactsEmis;
    if(Math.max(s.eau,s.neige,s.embruns,s.film)<.001&&!s.nbGouttes){viderToile(e);montrer(e,false);return e.stats;}
    dessiner(e,c,niveau,false);return e.stats;
  }
  function prechauffer(e,c) {
    if(!e || e.libere || !synchroniser(e))return false;c=c||{};
    if(c.actif===false || c.retro || c.qualite==='off' || c.intensite===0)return false;
    const niveau=QUALITES[c.qualite]??2;dimensionner(e,c,niveau);
    const u=e.simulation.uniformes;u[0]=.02;u[1]=.02;u[10]=e.simulation.graine*37.31;u[11]=.01;
    dessiner(e,c,niveau,true);u.fill(0);e.propre=false;viderToile(e);montrer(e,false);return true;
  }
  function liberer(e) {
    if(!e || e.libere)return;effacer(e);
    e.libere=true; detruireRessources(e); e.gpu=e.fournirGPU=e.canvas=e.contexte=null;
  }
  B.visiereOptique={creer,creerEtat,avancerEtat,mettreAJour,prechauffer,effacer,liberer,rattacher,MAX_PIXELS,MAX_SOURCE_PIXELS,MAX_GOUTTES_MOBILES,QUALITES,COUCHES};
})(globalThis.BITUME=globalThis.BITUME||{});
