/* BITUME — optique procédurale de la visière, hors des modules FERRO verrouillés.
 * L'eau dévie une copie bornée de la vue courante ; seule la surface mouillée est composée.
 * Les rétroviseurs et l'ATH, posés ensuite par le jeu, restent nets. Aucune image importée. */
(function (B) {
  'use strict';
  const PAS = 1 / 120, MAX_PIXELS = 2000000, MAX_SOURCE_PIXELS = 1048576;
  const QUALITES = Object.freeze({ low: 0, medium: 1, high: 2, ultra: 3 });
  const MAX_GOUTTES_MOBILES = 32;
  const DEPOTS = Object.freeze([6, 12, 24, 32].map((gouttes, i) => Object.freeze({ gouttes, neige: 0, echelleEau: 1.4 + i * .1 })));
  // Micro-impacts, perles fines/moyennes/larges, film et neige humide. Chaque couche garde
  // son transport réel : modifier le vent ou le regard change sa vitesse, jamais sa position.
  const COUCHES = Object.freeze([[.015,.76],[.04,1.85],[.22,4.1],[.65,9.7],[.85,11],[.08,4.5]].map(Object.freeze));
  const FONDU_TRANSPORT = .55;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const nombre = (v, defaut = 0) => Number.isFinite(Number(v)) && v != null ? Number(v) : defaut;
  const VERTEX = `#version 300 es
  precision highp float;
  out vec2 uv;
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;
  const FRAGMENT = `#version 300 es
  precision highp float;
  in vec2 uv;
  out vec4 couleur;
  uniform sampler2D uScene;
  uniform vec4 uMeteo;       // eau, neige accumulée, nuage de roues, film humide
  uniform vec4 uMouvement;   // temps, charge d'air, incidence normalisée, pression frontale
  uniform vec4 uVue;         // largeur CSS, hauteur CSS, graine, atténuation extérieure
  uniform vec4 uFlux;        // expansion /s, dérive X/Y en hauteurs écran/s, charge d'air
  uniform vec4 uGravite;     // gravité écran, centre de divergence (repère CPU, y vers le bas)
  uniform vec4 uTransport[12]; // échelle et translation affine normalisée, poids de la génération
  uniform vec4 uHistoire[12];   // même transformation il y a environ 0,3 s
  uniform vec4 uPhase[3];      // graines stables des générations, changées seulement lorsqu'invisibles
  uniform vec2 uTexel;
  uniform int uQualite;
  uniform bool uAvecScene;
  uniform int uNbGouttes;
  uniform vec4 uGouttes[32]; // centre en pixels, rayon, opacité ; vraies rencontres du modèle partagé
  uniform vec4 uTrajets[32]; // milieu et fin de la coulure, historique réel des positions
  uniform vec4 uImpacts[32]; // phase brève, force, orientation, rayon d'arrivée ; même pool que les perles
  float h21(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(.1031,.1030,.0973));
    q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z);
  }
  vec2 h22(vec2 p) { return vec2(h21(p), h21(p + vec2(41.7,93.4))); }
  float bruit(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.0),f.x),f.y);
  }
  float bords(float r, float largeur) { return 1.0 - smoothstep(1.0-largeur,1.0+largeur,r); }
  vec2 positionTransportee(vec2 p, vec4 tr) {
    vec2 n=vec2(p.x/uVue.x,1.0-p.y/uVue.y)*tr.x+tr.yz;
    return vec2(n.x,1.0-n.y)*uVue.xy;
  }
  vec2 positionSource(vec2 p, vec4 tr) {
    vec2 n=(vec2(p.x/uVue.x,1.0-p.y/uVue.y)-tr.yz)/tr.x;
    return vec2(n.x,1.0-n.y)*uVue.xy;
  }
  vec2 directionFlux(vec2 p, float mobilite, float rayon) {
    vec2 n=vec2(p.x/uVue.x,1.0-p.y/uVue.y),aspect=vec2(uVue.y/uVue.x,1.0);
    vec2 v=(uFlux.x*(n-uGravite.zw)+uFlux.yz*aspect)*(.3+.7*mobilite);
    v+=uGravite.xy*aspect*(mobilite*8.0*(rayon*.35+1.5)/720.0);
    v*=uVue.xy;v.y=-v.y;
    return length(v)>.0001 ? normalize(v) : vec2(0,-1);
  }
  // Les cellules vivent dans leur repère matériel transporté, et non dans une grille écran.
  // Les centres traversent donc les frontières et les bords sans remise à zéro par cellule.
  vec4 perlesGeneration(vec2 p, float cellule, float taille, float densite, float couche, float mobilite, int indice) {
    vec4 tr=uTransport[indice];
    if(tr.w<.0001)return vec4(0);
    float graine=uVue.z+uPhase[indice/4][indice%4],t=uMouvement.x,air=uMouvement.y;
    vec2 q=positionSource(p,tr)/cellule;
    vec2 id = floor(q), local = fract(q) - .5;
    vec2 alea = h22(id + couche*17.3 + graine);
    float vie = fract(t * (.033 + alea.x*.022) + alea.y);
    float apparition = smoothstep(0.0,.09,vie) * (1.0-smoothstep(.84,1.0,vie));
    float presence = (1.0-smoothstep(densite-.08,densite+.025,h21(id+73.1+couche+graine))) * clamp(densite*8.0,0.0,1.0)*tr.w;
    vec2 centre = (alea-.5)*.48;
    vec2 sourceCentre=(id+.5+centre)*cellule,centreEcran=positionTransportee(sourceCentre,tr);
    vec2 ancienCentre=positionTransportee(sourceCentre,uHistoire[indice]),trajet=centreEcran-ancienCentre;
    vec2 direction=length(trajet)>.03 ? normalize(trajet) : directionFlux(centreEcran,mobilite,taille);
    vec2 travers=vec2(-direction.y,direction.x),delta=(local-centre)*tr.x;
    vec2 d=vec2(dot(delta,travers),dot(delta,direction));
    float rayon = taille * (.48 + alea.x*alea.x*.94) / cellule;
    // À haute vitesse : les perles s'affinent fortement en largeur et s'étirent en longues traînées radiales vives.
    float wVit = clamp(uMouvement.w, 0.0, 1.0);
    float rxCell = max(.006, rayon * mix(1.0, .28, wVit));
    float ryCell = max(.008, rayon * (1.12 + mobilite * (.5 + air * 1.4) + wVit * (2.6 + 5.2 * mobilite)));
    vec2 axes = vec2(rxCell, min(.46, ryCell));
    vec2 n = d/max(axes,vec2(.001));
    float angle = atan(n.y,n.x);
    float asymetrie = 1.0 + sin(angle*3.0+alea.y*6.283)*(couche==6.0 ? .23 : .10*taille/12.0);
    if (couche==6.0) asymetrie+=sin(angle*5.0-alea.x*11.0)*.11;
    float r = length(n)*asymetrie;
    // Anticrénelage dans l'espace des pixels réellement rendus
    float aa = clamp(fwidth(r)*.72,.018,.58);
    // Dégagement progressif du centre de l'écran à haute vitesse : les traînées filent vers la périphérie !
    vec2 uvC = vec2(centreEcran.x/uVue.x, 1.0-centreEcran.y/uVue.y) - uGravite.zw;
    float dCentre = length(uvC * vec2(1.45, 1.15));
    float clairCentre = mix(1.0, smoothstep(0.06, 0.46, dCentre), wVit * 0.82);
    float masque = bords(r,aa) * presence * apparition * clairCentre * mix(1.0, 0.65, wVit);
    float longueur=min(.46, rayon*1.5+min(.24,length(trajet)/cellule)+rayon*wVit*(2.8+6.5*mobilite)),arriere=-d.y;
    float tx=d.x-sin(arriere*25.0+alea.x*12.0)*rayon*.10*(1.0-wVit*.6);
    float trace=(1.0-smoothstep(rxCell*.22,rxCell*.75,abs(tx)))*smoothstep(rayon*.4,rayon*1.2,arriere);
    trace*=(1.0-smoothstep(longueur*.65,longueur,arriere))*(mobilite+wVit*.35)*presence*apparition*clairCentre*smoothstep(.06,1.2,length(trajet)+wVit*1.4);
    float creux = sqrt(max(0.0,1.0-min(r*r,1.0)));
    vec2 nn=clamp(n,vec2(-1),vec2(1));
    vec2 normale=(travers*nn.x+direction*nn.y)*masque*(.20+.80*creux);
    return vec4(normale+travers*sign(tx)*trace*.12,max(masque,trace*.48),max(masque*(.34+.66*creux),trace*.26));
  }
  vec4 perles(vec2 p,float cellule,float taille,float densite,float couche,float mobilite,int groupe) {
    int i=groupe*2;
    return perlesGeneration(p,cellule,taille,densite,couche,mobilite,i)+perlesGeneration(p,cellule,taille,densite,couche,mobilite,i+1);
  }
  vec4 nappeGeneration(vec2 p,float densite,int indice) {
    vec4 tr=uTransport[indice];if(tr.w<.0001)return vec4(0);
    float graine=uVue.z+uPhase[indice/4][indice%4];
    mat2 rotation=mat2(.932,.362,-.362,.932);
    vec2 q=rotation*positionSource(p,tr)/vec2(157.0,191.0),id=floor(q),a=h22(id+103.0+graine);
    vec2 d=(fract(q)-.5-(a-.5)*.36)*vec2(1.0,.84)*tr.x;
    float vie = fract(uMouvement.x*(.021+a.y*.017)+a.x);
    float rayon = .08+a.y*.095;
    float angle = atan(d.y,d.x);
    float r = length(d)/(rayon*(1.0+.18*sin(angle*3.0+a.x*15.0)+.09*sin(angle*5.0-a.y*9.0)));
    float present = (1.0-smoothstep(densite-.05,densite+.08,h21(id+vec2(31,81)+graine)))*tr.w;
    float fondu = smoothstep(0.0,.13,vie)*(1.0-smoothstep(.72,1.0,vie));
    float m = bords(r,.035)*present*fondu;
    return vec4(transpose(rotation)*clamp(d/rayon,vec2(-1),vec2(1))*m*.65,m,m*(.5+.5*sqrt(max(0.0,1.0-min(r*r,1.0)))));
  }
  vec4 nappe(vec2 p,float densite) {
    return nappeGeneration(p,densite,8)+nappeGeneration(p,densite,9);
  }
  vec4 impactGoutte(vec2 delta,vec4 impact) {
    if(impact.y<.005)return vec4(0);
    float phase=impact.x,rayon=impact.w*(.65+1.7*phase),angle=impact.z;
    vec2 axe=vec2(cos(angle),sin(angle)),travers=vec2(-axe.y,axe.x);
    vec2 local=vec2(dot(delta,axe),dot(delta,travers)/(.60+.25*phase));
    float a=atan(local.y,local.x),distance=length(local);
    float irregulier=1.0+.10*sin(a*3.0+angle)+.055*sin(a*7.0-angle);
    float largeur=max(.7,rayon*.10),bord=abs(distance-rayon*irregulier);
    float couronne=(1.0-smoothstep(largeur*.5,largeur+1.0,bord))*(.62+.38*sin(a*3.0+angle)*sin(a*3.0+angle));
    float eclats=(1.0-smoothstep(.55,1.5+impact.w*.08,abs(distance-rayon*(1.15+phase*.45))))
      *pow(max(0.0,cos(a*3.0-angle)),18.0)*(1.0-phase);
    float centre=(1.0-smoothstep(rayon*.25,rayon*.8,distance))*(1.0-phase)*.18;
    float eau=max(couronne*.83,max(eclats*.72,centre))*impact.y;
    vec2 normale=delta/max(length(delta),.1)*(couronne*.52+eclats*.35)*impact.y;
    return vec4(normale,eau,(couronne*.22+eclats*.35+centre)*impact.y);
  }
  vec4 gouttesMobiles(vec2 p) {
    vec4 total=vec4(0);
    vec2 uvP=vec2(p.x/uVue.x,1.0-p.y/uVue.y);
    float centreDist=length((uvP-uGravite.zw)*vec2(1.55,1.2));
    float wMob=clamp(uMouvement.w,0.0,1.0);
    // À haute vitesse : centre dégagé, traînées fines filant vers les bords extérieurs
    float centreClear=mix(1.0,smoothstep(0.08,0.44,centreDist),wMob*0.80);
    for(int i=0;i<32;i++) {
      if(i>=uNbGouttes) break;
      vec4 g=uGouttes[i],tr=uTrajets[i],impact=uImpacts[i]; float rayon=g.z;
      float emprise=max(rayon*(2.3+wMob*6.5),impact.y>.005?impact.w*(.65+1.7*impact.x)*1.75+2.0:0.0);
      vec2 bas=min(g.xy,min(tr.xy,tr.zw))-emprise,haut=max(g.xy,max(tr.xy,tr.zw))+emprise;
      // Les calculs de lentille et de courbe sont locaux ; le reste de l'écran ne parcourt que les emprises.
      if(any(lessThan(p,bas))||any(greaterThan(p,haut))) continue;
      vec2 trajet=g.xy-tr.xy,direction=length(trajet)>.03?normalize(trajet):directionFlux(g.xy,1.0,rayon);
      vec2 travers=vec2(-direction.y,direction.x),delta=p-g.xy;
      float rx=max(.9, rayon*mix(1.0, .32, wMob));
      float ry=max(1.2, rayon*(1.25+uMouvement.y*.55+wMob*5.8));
      vec2 n=vec2(dot(delta,travers),dot(delta,direction))/vec2(rx,ry);
      float r=length(n);
      float aa=rayon>.001 ? max(.025,.85/rayon) : .025;
      float m=bords(r,aa)*g.w;
      float creux=sqrt(max(0.0,1.0-min(r*r,1.0)));
      vec2 nn=clamp(n,vec2(-1),vec2(1));
      vec2 normale=(travers*nn.x+direction*nn.y)*m*(.18+.82*creux);
      float trace=0.0;
      if(distance(g.xy,tr.zw)>rayon*1.2) {
        float meilleur=1e9,progres=0.0; vec2 precedent=tr.zw,ecart=vec2(0);
        // Trois positions du modèle forment une courbe, sans traînée verticale inventée pour les perles fixes.
        for(int j=1;j<=4;j++) {
          float t=float(j)*.25;
          vec2 q=mix(mix(tr.zw,tr.xy,t),mix(tr.xy,g.xy,t),t),v=q-precedent;
          float f=clamp(dot(p-precedent,v)/max(dot(v,v),.001),0.0,1.0);
          vec2 d=p-(precedent+f*v);float d2=dot(d,d);
          if(d2<meilleur){meilleur=d2;progres=(float(j-1)+f)*.25;ecart=d;}
          precedent=q;
        }
        float largeur=max(.55,rayon*mix(.05,.18,progres)-rayon*uMouvement.w*.03);
        trace=(1.0-smoothstep(largeur*.45,largeur+1.0,sqrt(meilleur)))*smoothstep(0.0,.14,progres)*g.w*.62;
        normale+=ecart/max(length(ecart),.1)*trace*.35;
      }
      total+=vec4(normale,max(m,trace),max(m*(.5+.5*creux),trace*.45));
      total+=impactGoutte(delta,impact);
    }
    total*=centreClear;
    return total;
  }
  vec3 scene(vec2 p, float flou) {
    p = clamp(p,vec2(.002),vec2(.998));
    vec3 c = texture(uScene,p).rgb;
    if (uQualite > 1 && flou > .015) {
      vec2 d = uTexel*(1.0+flou*7.0);
      vec3 b = texture(uScene,p+vec2(d.x,d.y)).rgb + texture(uScene,p+vec2(-d.x,d.y)).rgb;
      b += texture(uScene,p+vec2(d.x,-d.y)).rgb + texture(uScene,p-d).rgb;
      c = mix(c,b*.25,min(.88,flou));
    }
    return c;
  }
  void main() {
    float eau=uMeteo.x, neige=uMeteo.y, embruns=uMeteo.z, film=uMeteo.w;
    if (max(max(eau,neige),max(embruns,film)) < .001 && uNbGouttes==0) { couleur=vec4(0); return; }
    vec2 p=uv*uVue.xy;
    // Deux granulométries fines indépendantes : des milliers de micro-impacts ponctuels, puis
    // des perles à ménisque net. Le panache renouvelle ces impacts même à grande vitesse.
    vec4 micro=vec4(0);
    if (uQualite > 0) micro=perles(p+vec2(3.7,8.1),9.5,.76,clamp(eau*(.78+uMouvement.w*.28),0.0,.96),7.0,.015,0);
    vec4 a=perles(p,15.0,1.85,clamp(eau*.94,0.0,.97),1.0,.04,1);
    vec4 b=perles(p,35.0,4.1,clamp(eau*.83,0.0,.93),2.0,.22,2);
    vec4 c=vec4(0),n=vec4(0),filets=vec4(0);
    if (uQualite > 0) {
      float attenuGros = mix(1.0, 0.18, clamp(uMouvement.w, 0.0, 1.0));
      c=perles(p,77.0,9.7,clamp(eau*.70*attenuGros,0.0,.85),3.0,.65,3)*attenuGros;
      n=nappe(p,clamp(((eau-.30)*.48+film*.32)*attenuGros,0.0,.65))*attenuGros;
      if (eau > .30) filets=perles(p+vec2(11.3,4.7),18.0,1.25,clamp(eau*.95,0.0,.96),4.0,.45,0);
    } else { a*=.6; }
    vec4 mobiles=gouttesMobiles(p);
    vec2 normale=micro.xy*.20+filets.xy*.26+a.xy*.44+b.xy*.68+c.xy*.9+n.xy+mobiles.xy;
    float goutte=clamp(micro.z+filets.z*.72+a.z+b.z+c.z+n.z+mobiles.z,0.0,1.0);
    float relief=clamp(micro.w*.16+filets.w*.20+a.w*.3+b.w*.5+c.w*.8+n.w+mobiles.w,0.0,1.0);
    float menisque=clamp((micro.z-micro.w+filets.z-filets.w+a.z-a.w+b.z-b.w+c.z-c.w+n.z-n.w+mobiles.z-mobiles.w)*1.7,0.0,1.0);
    // Brouillard d'eau local dans l'axe : il monte puis retombe dans le modèle, pas d'aplat blanc instantané.
    float turbulent=.5;
    if (embruns>.001 || (uAvecScene && film>.001)) {
      turbulent=bruit(uv*vec2(9.0,7.0)+vec2(uMouvement.x*.38,-uMouvement.x*.54));
      turbulent=.67*turbulent+.33*bruit(uv*vec2(21.0,17.0)-uMouvement.x*.27);
    }
    vec2 centre=uv-vec2(.5,.57);
    float panache=exp(-dot(centre*vec2(1.8,1.45),centre*vec2(1.8,1.45))*2.1);
    float voile=clamp(embruns*panache*(.44+turbulent*.78),0.0,.88);
    // La neige humide s'agglomère irrégulièrement sur le pourtour, avec de petits amas au centre.
    float grain=0.0,blanc=0.0;
    if (neige>.001) {
      vec2 bord= min(uv,1.0-uv);
      float distanceBord=min(bord.x*1.32,bord.y);
      float dentelle=bruit(p/37.0+uVue.z)*.024 + bruit(p/11.0)*.010;
      float lobes=bruit(p/vec2(173.0,109.0)+uVue.z);
      float coin=exp(-length(bord*vec2(1.3,1.0))*11.0);
      float epaisseur=neige*((.021+.078*(1.0-uv.y))*(.35+1.15*lobes)+coin*.046+dentelle);
      float bourrelet=(1.0-smoothstep(epaisseur*.52,epaisseur+.022+lobes*.015,distanceBord))*neige;
      grain=bruit(p*.39+uVue.z)*.5+bruit(p*.13)*.5;
      vec4 amas=perles(p,48.0,4.5,clamp(neige*.65,0.0,.82),6.0,.08,5);
      float cristaux=smoothstep(.44,.75,bruit(p*.71+uVue.z))*.34;
      // Des cœurs granuleux blancs dans des ménisques translucides, pas des disques opaques.
      normale+=amas.xy*neige*.35;
      goutte=clamp(goutte+amas.z*neige*.35,0.0,1.0);
      blanc=clamp(bourrelet*(.68+.32*grain)+amas.z*neige*(.26+.53*grain+cristaux),0.0,.96);
    }
    float brume=clamp(film*.065+neige*.04,0.0,.13);
    float alpha=clamp(max(goutte*.90,max(voile,blanc)) + brume,0.0,.98)*uVue.w;
    if (alpha<.002) { couleur=vec4(0); return; }
    vec3 image=vec3(.61,.69,.73);
    if (uAvecScene) {
      vec2 deviation=normale*vec2(10.0,12.0)/uVue.xy;
      deviation += (vec2(turbulent,bruit(uv*13.0+uMouvement.x*.2))-.5)*film*.002;
      image=scene(uv+deviation,clamp(relief*.45+voile*.88+blanc*.72,0.0,1.0));
      float ombre=smoothstep(.01,.24,dot(normale,normalize(vec2(.35,-.94))));
      float reflet=pow(smoothstep(.02,.33,dot(-normale,normalize(vec2(.35,-.94)))),2.0);
      image *= 1.0-ombre*(.10+menisque*.37)-menisque*.19;
      image += vec3(.72,.85,.94)*reflet*(.11+menisque*.43);
    } else {
      // Légère : ménisques contrastés sur fond transparent, aucune copie ni lecture de la scène.
      float lumiere=dot(-normale,normalize(vec2(.35,-.94)));
      image=mix(vec3(.08,.15,.19),vec3(.87,.94,.98),smoothstep(-.2,.5,lumiere));
      alpha*=.44;
    }
    image=mix(image,vec3(.72,.78,.80),voile*.63+brume);
    image=mix(image,vec3(.86,.91,.94)+grain*.055,blanc);
    couleur=vec4(clamp(image,0.0,1.0),alpha);
  }`;
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
    B.vitre.avancerSimulation(e.depots,dt,c,DEPOTS[niveau]);preparerDepots(e);
  }
  function montrer(e, oui) {
    if (e.masquee===!oui) return;
    e.masquee=!oui; if(e.canvas.style) e.canvas.style.visibility=oui ? '' : 'hidden';
  }
  function shader(gl,type,code) {
    const s=gl.createShader(type); gl.shaderSource(s,code); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) {
      const message=gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(message);
    }
    return s;
  }
  function initialiser(e) {
    const gl=e.gl, vs=shader(gl,gl.VERTEX_SHADER,VERTEX), fs=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT);
    const programme=gl.createProgram(); gl.attachShader(programme,vs); gl.attachShader(programme,fs); gl.linkProgram(programme);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if(!gl.getProgramParameter(programme,gl.LINK_STATUS)) {
      const message=gl.getProgramInfoLog(programme); gl.deleteProgram(programme); throw new Error(message);
    }
    e.programme=programme; e.vao=gl.createVertexArray(); e.texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,e.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    e.lieux={}; for(const nom of ['uScene','uMeteo','uMouvement','uVue','uTexel','uQualite','uAvecScene','uNbGouttes','uGouttes','uTrajets','uImpacts','uFlux','uGravite','uTransport','uHistoire','uPhase']) e.lieux[nom]=gl.getUniformLocation(programme,nom);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.clearColor(0,0,0,0);
    e.pret=true; e.perdu=false; e.stats.pret=true; e.stats.perdu=false;e.stats.erreur=null;
  }
  function creer(canvas,options) {
    // Les doubles de Canvas Node et les anciens navigateurs passent au repli Canvas2D de vitre.js.
    if(!canvas || typeof canvas.addEventListener!=='function' || !canvas.ownerDocument || typeof canvas.getBoundingClientRect!=='function') return null;
    let gl; try { gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false}); } catch (_) { return null; }
    if(!gl) return null;
    const copie=canvas.ownerDocument.createElement('canvas'); copie.width=1; copie.height=1;
    const e={canvas,gl,contexte:gl,simulation:creerEtat(options),source:copie,sourceContexte:copie.getContext('2d',{alpha:false}),
      masquee:false,propre:true,perdu:false,libere:false,pret:false,dprPalier:null,largeur:1,hauteur:1,dpr:1,
      stats:{backend:'webgl2',pret:false,perdu:false,erreur:null,copiesScene:0,copiesDirectes:0,dessins:0,etapes:0,pixels:0,pixelsSource:0,
        largeur:0,hauteur:0,dpr:1,eau:0,accumulationNeige:0,embruns:0,gouttes:0,neige:0,
        fusionsEau:0,expulses:0,depotsEau:0,depotsEmbruns:0,impactsEmis:0,surfaceExpulsee:0}};
    e.uMeteo=e.simulation.uniformes.subarray(0,4);e.uMouvement=e.simulation.uniformes.subarray(4,8);e.uVue=e.simulation.uniformes.subarray(8,12);
    e.uFlux=e.simulation.fluxUniformes.subarray(0,4);e.uGravite=e.simulation.fluxUniformes.subarray(4,8);
    e.perte=event=>{event.preventDefault(); e.perdu=true; e.pret=false; e.stats.perdu=true; e.stats.pret=false; montrer(e,false);};
    e.restauration=()=>{if(e.libere)return; try{initialiser(e);}catch(err){e.stats.erreur=String(err.message||err);montrer(e,false);}};
    canvas.addEventListener('webglcontextlost',e.perte,false); canvas.addEventListener('webglcontextrestored',e.restauration,false);
    try{initialiser(e);}catch(err){e.stats.erreur=String(err.message||err);montrer(e,false);}
    montrer(e,false); return e;
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
  function dessiner(e,c,niveau,chauffe) {
    const gl=e.gl,u=e.simulation.uniformes;
    gl.viewport(0,0,e.canvas.width,e.canvas.height); gl.useProgram(e.programme); gl.bindVertexArray(e.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,e.texture);
    let avecScene=false;
    if(niveau>0 && e.sourceContexte && c.sourceScene && c.sourceScene.width>0 && c.sourceScene.height>0) {
      try {
        const scene=c.sourceScene;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        // À taille native, la texture reçoit directement le canvas opaque de cette caméra.
        // Le passage 2D ne sert qu'au redimensionnement ou au repli d'un navigateur.
        if(typeof scene.getContext==='function' && scene.width===e.source.width && scene.height===e.source.height) {
          try {
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,scene);
            e.stats.copiesDirectes++;avecScene=true;
          } catch (_) { /* Le passage 2D peut accepter une source refusée en copie directe. */ }
        }
        if(!avecScene) {
          e.sourceContexte.drawImage(scene,0,0,e.source.width,e.source.height);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,e.source);
        }
        e.stats.copiesScene++;e.stats.erreur=null;avecScene=true;
      }catch(err){e.stats.erreur='copie scène : '+String(err.message||err);}
    }
    u[8]=e.largeur;u[9]=e.hauteur;
    gl.uniform1i(e.lieux.uScene,0);gl.uniform4fv(e.lieux.uMeteo,e.uMeteo);
    gl.uniform4fv(e.lieux.uMouvement,e.uMouvement);gl.uniform4fv(e.lieux.uVue,e.uVue);
    gl.uniform2f(e.lieux.uTexel,1/e.source.width,1/e.source.height);gl.uniform1i(e.lieux.uQualite,niveau);gl.uniform1i(e.lieux.uAvecScene,avecScene);
    gl.uniform1i(e.lieux.uNbGouttes,e.simulation.nbGouttes);
    gl.uniform4fv(e.lieux.uGouttes,e.simulation.gouttesUniformes);gl.uniform4fv(e.lieux.uTrajets,e.simulation.trajetsUniformes);
    gl.uniform4fv(e.lieux.uImpacts,e.simulation.impactsUniformes);
    gl.uniform4fv(e.lieux.uFlux,e.uFlux);gl.uniform4fv(e.lieux.uGravite,e.uGravite);
    gl.uniform4fv(e.lieux.uTransport,e.simulation.transportUniformes);gl.uniform4fv(e.lieux.uHistoire,e.simulation.histoireUniformes);
    gl.uniform4fv(e.lieux.uPhase,e.simulation.phaseUniformes);
    gl.drawArrays(gl.TRIANGLES,0,3);e.stats.dessins++;e.propre=!!chauffe;montrer(e,!chauffe);
  }
  function effacer(e) {
    if(!e || e.libere)return;
    if(!e.propre && e.pret && !e.perdu){e.gl.clear(e.gl.COLOR_BUFFER_BIT);e.propre=true;}
    const s=e.simulation;s.eau=s.neige=s.embruns=s.film=s.accumulateur=0;s.precedent.fill(0);s.uniformes.fill(0);
    B.vitre.effacer(s.depots);s.nbGouttes=0;s.gouttesUniformes.fill(0);s.trajetsUniformes.fill(0);s.impactsUniformes.fill(0);
    reinitialiserTransport(s);
    e.stats.eau=e.stats.accumulationNeige=e.stats.embruns=e.stats.gouttes=0;e.dprPalier=null;montrer(e,false);
  }
  function mettreAJour(e,dt,c) {
    if(!e || e.libere)return e ? e.stats : null;
    c=c||{};
    if(c.actif===false || c.retro===true || c.qualite==='off' || clamp(nombre(c.intensite,1),0,2)===0){effacer(e);return e.stats;}
    if(c.pause || !e.pret || e.perdu || !Number.isFinite(dt) || dt<=0)return e.stats;
    const niveau=QUALITES[c.qualite]??2, s=e.simulation;
    // Le jeu transmet la toile, sans dimensions CSS dans le contexte : dépôts et shader doivent partager
    // celles de cette vue, y compris J2 et un redimensionnement, avant le premier pas de déplacement.
    dimensionner(e,c,niveau);s.depots.largeur=e.largeur;s.depots.hauteur=e.hauteur;
    avancerEtat(s,dt,c);
    e.stats.eau=s.eau;e.stats.accumulationNeige=s.neige;e.stats.embruns=s.embruns;e.stats.etapes=s.etapes;
    e.stats.gouttes=s.depots.stats.gouttes;e.stats.fusionsEau=s.depots.stats.fusionsEau;e.stats.expulses=s.depots.stats.expulses;
    e.stats.depotsEau=s.depots.stats.depotsEau;e.stats.depotsEmbruns=s.depots.stats.depotsEmbruns;e.stats.surfaceExpulsee=s.depots.stats.surfaceExpulsee;
    e.stats.impactsEmis=s.depots.stats.impactsEmis;
    if(Math.max(s.eau,s.neige,s.embruns,s.film)<.001&&!s.nbGouttes){if(!e.propre){e.gl.clear(e.gl.COLOR_BUFFER_BIT);e.propre=true;}montrer(e,false);return e.stats;}
    dessiner(e,c,niveau,false);return e.stats;
  }
  function prechauffer(e,c) {
    if(!e || e.libere || !e.pret || e.perdu)return false;c=c||{};
    if(c.actif===false || c.retro || c.qualite==='off' || c.intensite===0)return false;
    const niveau=QUALITES[c.qualite]??2;dimensionner(e,c,niveau);
    const u=e.simulation.uniformes;u[0]=.02;u[1]=.02;u[10]=e.simulation.graine*37.31;u[11]=.01;
    dessiner(e,c,niveau,true);u.fill(0);e.gl.clear(e.gl.COLOR_BUFFER_BIT);e.propre=true;montrer(e,false);return true;
  }
  function liberer(e) {
    if(!e || e.libere)return;effacer(e);
    e.canvas.removeEventListener('webglcontextlost',e.perte); e.canvas.removeEventListener('webglcontextrestored',e.restauration);
    if(!e.perdu){e.gl.deleteTexture(e.texture);e.gl.deleteVertexArray(e.vao);e.gl.deleteProgram(e.programme);}
    e.libere=true;e.canvas=null;e.contexte=null;e.source=null;e.sourceContexte=null;e.gl=null;
  }
  B.visiereOptique={creer,creerEtat,avancerEtat,mettreAJour,prechauffer,effacer,liberer,MAX_PIXELS,MAX_SOURCE_PIXELS,MAX_GOUTTES_MOBILES,QUALITES,COUCHES};
})(globalThis.BITUME=globalThis.BITUME||{});
