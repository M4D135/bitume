/* BITUME — lot 19 : la visière sous la pluie et la neige (prototype, 18/11/2026).
   Deux parties qui vont ensemble :
   1. Un modèle à pas fixe (1/120 s) pour ce qui a une mémoire : l'eau qui s'accumule ou que l'air chasse, les
      coulures, les traînées, le nuage d'eau des voitures suivies, la neige collée, les bourrelets du bord et la buée ;
      et les « horloges » que l'effet lit (glissement, vent, cycles), intégrées ici pour qu'un changement de vitesse ne
      fasse jamais sauter une goutte. Rien n'est tiré au hasard : la course garde son hasard, l'effet n'en consomme
      pas. Rien n'est alloué après creer() : l'état et ses uniformes sont réutilisés à chaque image.
   2. L'effet de fragment (GLSL ES 3.00) pour la passe post du moteur. Il lit l'image nette de la scène et sa copie
      floue au quart de résolution, et tout le reste est procédural : chaque goutte vit dans une case d'une grille
      (position, taille, naissance et départ tirés d'un hachage entier de la case et de son cycle), les coulures et
      les traînées suivent des chemins fixés à l'écran, la brume et la neige sont des bruits de valeur.
   L'effet est une fonction du temps et des uniformes seulement : même image à 30, 60, 120 ou 144 images par seconde.
   Le palier 0 (Légère, sans post-traitement) dessine par mélange alpha sans lire la scène. */
(function (B) {
  'use strict';
  const PAS = 1 / 120;
  const VEC4 = 7, TAILLE_UNIFORMES = VEC4 * 4;
  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const lisse = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const nombre = (x, defaut = 0) => Number.isFinite(x) ? x : defaut;

  // Paliers : ce que chaque niveau dessine. Le coût est mesuré dans le rapport (prototype.html?mesure=1).
  const PALIERS = Object.freeze({
    low: Object.freeze({ palier: 0, libelle: 'Légère', lecturesScene: 0, couches: 'une couche de gouttes, coulures sans traînée, brume sans tourbillon' }),
    medium: Object.freeze({ palier: 1, libelle: 'Moyenne', lecturesScene: 6, couches: 'gouttelettes, deux couches de gouttes, coulures et traînées, vent, brume, neige, buée' }),
    high: Object.freeze({ palier: 2, libelle: 'Fine', lecturesScene: 6, couches: 'Moyenne + troisième couche, gouttes chassées par les coulures, flocons doublés, bruits plus fins' })
  });

  function creer() {
    return {
      t: 0, reste: 0, etapes: 0,
      // horloges intégrées (unités : hauteur d'écran, ou cycles)
      glisse: 0, vent: 0, cycle: 0, cycleNeige: 0,
      vGlisse: 0, vVent: 0, vCycle: 0, vCycleNeige: 0,
      // couvertures (0 à 1)
      gouttelettes: 0, gouttes: 0, coulures: 0, trainees: 0, embruns: 0,
      neigeCollee: 0, bourrelet: 0, buee: 0, nappes: 0, air: 0,
      // instantanés recopiés de l'entrée (lissés quand il le faut)
      pluie: 0, neige: 0, froid: 0, vue: 0, intensite: 1, graine: 0,
      cibleX: .5, cibleY: .45, cibleTaille: .12, proche: 0, fondu: .03,
      uniformes: new Float32Array(TAILLE_UNIFORMES)
    };
  }

  // Un pas de 1/120 s. c : { pluie, neige (0 à 1, intensités finales), vitesse (m/s), embruns (0 à 1), froid,
  // humidite (0 à 1), vue ('cockpit' ou 'exterieur'), abri (tunnel), intensite (réglage, 1 par défaut), graine,
  // cibleX, cibleY, cibleTaille (voiture qui projette le nuage d'eau : viser()), proche, fondu (haut du cockpit) }.
  function etape(e, c) {
    const h = PAS;
    const exterieur = c.vue === 'exterieur' || c.vue === 1;
    const abri = c.abri === true;
    const v = clamp(Math.abs(nombre(c.vitesse)), 0, 120);
    const pluie = abri ? 0 : clamp(nombre(c.pluie)), neige = abri ? 0 : clamp(nombre(c.neige));
    const froid = clamp(nombre(c.froid)), humide = clamp(nombre(c.humidite));
    // Part de l'air dans le mouvement de l'eau : nulle à l'arrêt (la gravité décide), entière vers 200 km/h.
    const air = lisse(9, 52, v);
    // On roule dans la pluie : plus vite, plus d'impacts par seconde sur la visière.
    const front = .45 + 1.35 * clamp(v / 45);
    const flux = pluie * front * (exterieur ? .75 : 1);
    // Embruns : montée rapide quand on entre dans le nuage d'eau, retombée plus lente quand on en sort.
    const cibleEmbruns = clamp(nombre(c.embruns));
    e.embruns += h * (cibleEmbruns - e.embruns) * (cibleEmbruns > e.embruns ? 5 : .9);
    // Gouttes posées : l'apport sature la visière à l'arrêt ; l'air les chasse vite, la pluie forte recharge sans cesse.
    // L'objectif d'une caméra extérieure est abrité par sa monture : l'air le nettoie moins bien que la visière.
    const depart = 2.6 * air * air * (exterieur ? .45 : 1) + (pluie > .01 ? .012 : .045);
    e.gouttes += h * ((flux + e.embruns * .6) * (1 - e.gouttes) - e.gouttes * depart);
    // Gouttelettes : elles collent, l'air n'en chasse qu'une partie ; le nuage d'eau en apporte des rafales.
    const fluxFin = pluie * (.25 + .75 * clamp(v / 40)) * (exterieur ? .25 : 1) + e.embruns * 2.4;
    e.gouttelettes += h * (fluxFin * (1 - e.gouttelettes) - e.gouttelettes * (.55 * air + (fluxFin > .01 ? .02 : .06)));
    // Coulures : à basse vitesse, une visière chargée laisse couler ses grosses gouttes ; l'air les remplace par
    // des traînées qui partent vers le haut et les côtés.
    const cibleCoulures = clamp((e.gouttes - .3) / .45) * (1 - air);
    e.coulures += h * (cibleCoulures - e.coulures) * (cibleCoulures > e.coulures ? .4 : 1.4);
    const cibleTrainees = clamp(flux * 1.1 + e.embruns * .8) * lisse(10, 42, v);
    e.trainees += h * (cibleTrainees - e.trainees) * (cibleTrainees > e.trainees ? 4 : 1.6);
    // Nappes : une visière saturée à l'arrêt ne porte plus des gouttes séparées mais des plaques d'eau qui glissent.
    const cibleNappes = clamp((e.gouttes - .55) / .35) * (1 - air) * (exterieur ? .6 : 1);
    e.nappes += h * (cibleNappes - e.nappes) * (cibleNappes > e.nappes ? .3 : 1.5);
    // Horloges : vitesses en hauteurs d'écran par seconde ; l'effet n'en lit que l'intégrale.
    e.vGlisse = .14 * (1 - air) * (.4 + .6 * e.coulures) * (exterieur ? .6 : 1);
    e.vVent = 2.2 * air * clamp(v / 70, .35, 1.4);
    e.vCycle = .1 + 1.2 * air + .25 * pluie;
    e.vCycleNeige = .045 + .9 * air;
    e.glisse += h * e.vGlisse; e.vent += h * e.vVent; e.cycle += h * e.vCycle; e.cycleNeige += h * e.vCycleNeige;
    // Neige : les flocons collent, l'air les chasse vers les bords, la tiédeur les fond en gouttes.
    const fluxNeige = neige * (.5 + 1.3 * clamp(v / 40)) * (exterieur ? .5 : 1);
    const fonte = .025 + .12 * (1 - froid);
    e.neigeCollee += h * (fluxNeige * (1 - e.neigeCollee) - e.neigeCollee * (1.5 * air * air + fonte));
    e.gouttes += h * e.neigeCollee * fonte * .5 * (1 - e.gouttes); // la neige fondue devient de l'eau
    // Bourrelets : la neige s'entasse au bord de la visière (plus vite quand l'air l'y pousse), fond à la tiédeur,
    // s'use un peu aux grandes vitesses.
    e.bourrelet += h * (neige * (.011 + .028 * air) * (1 - e.bourrelet) - e.bourrelet * ((1 - froid) * .008 + .004 * lisse(55, 80, v)));
    // Buée : froid humide à l'arrêt, dans le casque seulement ; la ventilation de la vitesse l'efface.
    const cibleBuee = exterieur ? 0 : froid * humide * (1 - lisse(2, 16, v));
    e.buee += h * (cibleBuee - e.buee) * (cibleBuee > e.buee ? .16 : .55);
    e.air = air; e.pluie = pluie; e.neige = neige; e.froid = froid; e.vue = exterieur ? 1 : 0;
    e.intensite = clamp(nombre(c.intensite, 1), 0, 2);
    e.graine = Math.floor(clamp(nombre(c.graine), 0, 65535));
    e.cibleX = clamp(nombre(c.cibleX, .5), -.5, 1.5); e.cibleY = clamp(nombre(c.cibleY, .45), -.5, 1.5);
    e.cibleTaille = clamp(nombre(c.cibleTaille, .12), .01, 1);
    // Haut du cockpit à l'écran (uv) : la brume et le voile de neige s'arrêtent à la planche ; 0 en vue extérieure.
    e.proche = exterieur ? 0 : clamp(nombre(c.proche), 0, 1); e.fondu = clamp(nombre(c.fondu, .03), .002, .2);
    e.t += h; e.etapes++;
  }

  // Avance de dt secondes réelles (0 en pause). Les pas restent de 1/120 s ; le reliquat sert à prolonger les
  // horloges jusqu'à l'image (uniformes), si bien que le mouvement reste continu à 144 Hz comme à 30 Hz.
  function avancer(e, dt, c) {
    if (!e || !(dt > 0) || !Number.isFinite(dt)) return e;
    e.reste += Math.min(dt, .25);
    while (e.reste >= PAS - 1e-9) { etape(e, c || {}); e.reste -= PAS; }
    if (e.reste < 0) e.reste = 0;
    return e;
  }

  // Remplit et rend le Float32Array réutilisé : sept vec4 pour uniform4fv('uVisiere', …).
  function uniformes(e) {
    const u = e.uniformes, r = e.reste, k = e.intensite;
    u[0] = e.t + r; u[1] = e.glisse + e.vGlisse * r; u[2] = e.vent + e.vVent * r; u[3] = e.cycle + e.vCycle * r;
    u[4] = e.gouttelettes * k; u[5] = e.gouttes * k; u[6] = e.coulures * k; u[7] = e.trainees * k;
    u[8] = clamp(e.embruns * k); u[9] = e.cibleX; u[10] = e.cibleY; u[11] = e.cibleTaille;
    u[12] = e.neigeCollee * k; u[13] = e.bourrelet * k; u[14] = e.neige * k; u[15] = e.cycleNeige + e.vCycleNeige * r;
    u[16] = e.buee * k; u[17] = e.vVent; u[18] = e.vue; u[19] = e.air;
    u[20] = e.pluie * k; u[21] = e.froid; u[22] = k; u[23] = e.graine;
    u[24] = e.proche; u[25] = e.fondu; u[26] = e.nappes * k; u[27] = 0;
    return u;
  }

  // Le nuage d'eau d'une voiture devant : distance (m, > 0 devant), écart latéral (m), sa vitesse (m/s), l'eau sur la
  // piste (B.conduite.eauSurPiste, 0 à 1). Rend 0 à 1. Les gerbes de traces.js naissent à partir de 14 m/s et 12 %
  // d'eau ; le nuage reçu suit les mêmes seuils, s'étale avec la distance et s'éteint vers 70 m.
  function embruns(distance, ecart, vitesse, eau) {
    if (!(distance > 0) || !(eau > .12) || !(vitesse > 14)) return 0;
    const force = clamp((eau - .12) / .5) * lisse(14, 55, vitesse);
    const largeur = 1.6 + distance * .05;                     // la gerbe s'élargit en reculant
    const lateral = Math.exp(-(ecart * ecart) / (2 * largeur * largeur));
    const portee = Math.exp(-distance / 26) * (1 - lisse(45, 70, distance));
    return clamp(force * lateral * portee * 1.35);
  }

  // Position à l'écran (uv, y vers le haut) et largeur apparente (hauteurs d'écran) d'un point du monde, pour la
  // caméra FERRO { pos, yaw, pitch, fov (vertical, degrés) } ; écrit dans sortie, sans allocation. Rend false derrière.
  function viser(sortie, cam, x, y, z, aspect, largeurMonde) {
    const yaw = cam.yaw || 0, pitch = cam.pitch || 0;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const dx = x - cam.pos[0], dy = y - cam.pos[1], dz = z - cam.pos[2];
    const fx = sy * cp, fy = sp, fz = -cy * cp;                       // même convention que meteo.js
    const rx = cy, rz = sy, ux = -sy * sp, uy = cp, uz = cy * sp;
    const prof = dx * fx + dy * fy + dz * fz;
    if (prof < .5) return false;
    const f = 1 / Math.tan(clamp(nombre(cam.fov, 60), 10, 110) * Math.PI / 360);
    sortie.cibleX = .5 + (dx * rx + dz * rz) * f / (prof * aspect) * .5;
    sortie.cibleY = .5 + (dx * ux + dy * uy + dz * uz) * f / prof * .5;
    sortie.cibleTaille = (largeurMonde || 1.8) * f / prof * .5;
    return true;
  }

  // ------------------------------------------------------------------------------------------------ effet GLSL
  // Unités de travail : p = ((uv.x − 0,5) × aspect, uv.y − 0,5), soit des hauteurs d'écran centrées ; la taille des
  // gouttes suit donc la hauteur de l'image, quelle que soit la résolution. px = un pixel dans ces unités.
  const GLSL = String.raw`
uniform vec4 uVisiere[7];
uniform vec2 uVisiereTaille;
uniform vec3 uVisiereCiel;

float vAsp;
uint vGr;   // graine de l'arrangement (uniforme) : deux séances, deux visières différentes
uint vH(uint n){n^=n>>16u;n*=0x85ebca6bu;n^=n>>13u;n*=0xc2b2ae35u;n^=n>>16u;return n;}
uint vG(ivec2 c,uint k){return vH(uint(c.x)*0x9e3779b1u^uint(c.y)*0x85ebca77u^k*0x632be5abu^vGr);}   // un seul brassage
float vA(inout uint s){s=vH(s+0x9e3779b9u);return float(s>>8u)*(1./16777216.);}
float vB(ivec2 c,uint k){return float(vG(c,k)>>8u)*(1./16777216.);}
// Quatre tirages de 8 bits d'un seul hachage : assez fins pour une forme ou une place dans sa case.
vec4 vA4(inout uint s){s=vH(s+0x9e3779b9u);return (vec4((uvec4(s)>>uvec4(0u,8u,16u,24u))&255u)+.5)*(1./256.);}
// Bruit de valeur et sa pente, d'une seule évaluation (quatre hachages).
vec3 vBruitD(vec2 p,uint k){
  vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);ivec2 c=ivec2(i);
  float a=vB(c,k),b=vB(c+ivec2(1,0),k),d=vB(c+ivec2(0,1),k),e=vB(c+ivec2(1,1),k);
  float k0=b-a,k1=d-a,k2=a-b-d+e;
  return vec3(a+k0*u.x+k1*u.y+k2*u.x*u.y,du*vec2(k0+k2*u.y,k1+k2*u.x));
}
float vBruit(vec2 p,uint k){return vBruitD(p,k).x;}
float vFbm(vec2 p,uint k){
  float s=.5*vBruit(p,k)+.25*vBruit(p*2.03+vec2(7.1,1.3),k+1u);
#if VISIERE_PALIER>=2
  s+=.125*vBruit(p*4.07+vec2(3.7,9.2),k+2u);return s/.875;
#else
  return s/.75;
#endif
}
vec2 vUv(vec2 p){return vec2(p.x/vAsp+.5,p.y+.5);}
vec2 vMiroir(vec2 u){return 1.-abs(1.-mod(u,2.));}

// Ce que l'air laisse en place : peu au milieu de la visière, où il frappe de face, beaucoup en haut et aux côtés.
float vReste(vec2 pc){
  vec2 r=(pc-vec2(0.,-.62))*vec2(.78,1.);
  return clamp(.1+.95*smoothstep(.5,1.12,length(r)),0.,1.);
}
// Le monde (1) ou le cockpit (0) : le nuage d'eau et le voile de neige sont dehors, devant la voiture, pas entre
// l'œil et la planche de bord. uVisiere[6].xy : hauteur (uv) du haut du cockpit à l'écran et largeur du fondu ; 0 en
// vue extérieure. Le moteur peut lui substituer la profondeur de la scène (voir 19-VITRE.md).
float vLoin(vec2 uv){
  float s=uVisiere[6].x;
  return s<=0.?1.:smoothstep(s-uVisiere[6].y,s+uVisiere[6].y,uv.y);
}

struct VEau{float a;vec2 s;float w;float sombre;float eclat;float film;vec2 filmD;};

void vAjoute(inout VEau e,float a,float h,vec2 s,float sombre,float eclat){
  float w=a*(.05+h);w*=w;                   // la plus épaisse l'emporte : pas d'image moyenne, grise
  e.s+=s*w;e.w+=w;e.sombre+=sombre*w;
  e.eclat=max(e.eclat,eclat*a);
  e.a=1.-(1.-e.a)*(1.-a);
}

// Une goutte : pied irrégulier (ovale tourné et lobes en trèfle, sans trigonométrie), haut et bas étirés à part ;
// lentille. Bombée, elle montre à l'envers un large champ de la scène autour d'elle ; plate (grosse goutte étalée),
// elle laisse voir à travers et ne tord que son bord. Bord sombre (réflexion totale), éclat du ciel en haut ;
// flou : bord adouci (l'œil fait la mise au point au loin, l'objectif aussi).
void vGoutte(inout VEau e,vec2 p,vec2 c,float r,float haut,float bas,float plat,float px,float flou,float champ,vec4 irr){
  vec2 d=p-c;
  d.y/=d.y>0.?haut:bas;
  vec2 n=d/r;
  float n2=dot(n,n);
  if(n2>=1.7)return;
  float q=n2*(1.+irr.x*(n.x*n.x-n.y*n.y)+irr.y*2.*n.x*n.y+irr.z*n.x*(n.x*n.x-3.*n.y*n.y)+irr.w*n.y*(3.*n.x*n.x-n.y*n.y));
  if(q>=1.)return;
  float h=1.-q;
  float a=smoothstep(0.,2.2*px/r+flou,h);
  float l=sqrt(q);
  vec2 dn=n*(l/max(sqrt(n2),1e-4));
  vec2 inv=vUv(c)-dn*champ*(1.+.7*q);
  vec2 dir=vUv(p)-dn*(.004+.05*l*l*l);
  vAjoute(e,a,h,mix(inv,dir,plat),smoothstep(.42,1.,l)*(.75-.25*plat),
          smoothstep(.26,0.,length(dn-vec2(-.3,.42)))*(1.-.6*plat));
}

// Gouttes posées : une par case et par cycle, tenue dans sa case (aucune case voisine à lire). Le rang de la case
// décide de sa présence selon la couverture, modulée par des amas (bruit lent) ; le cycle (intégré par le modèle)
// la fait naître puis partir.
void vPosees(inout VEau e,vec2 p,float taille,float dens,float cyc,uint k,float px,float flou,float air,
             float rMin,float rMax,float plat,float champ){
  vec2 q=p/taille,ci=floor(q);
  uint s=vG(ivec2(ci),k);
  float rang=vA(s);
  vec2 pc=(ci+.5)*taille;
  float dl=dens*mix(1.,vReste(pc),air);
#if VISIERE_PALIER>=1
  if(rang>=dl*1.6)return;                  // plus haut que le plus dense des amas : case vide, rien d'autre à lire
#else
  if(rang>=dl)return;
#endif
  vec4 t=vA4(s);
  float rythme=.55+.9*t.x,dec=t.y;
  float ph=cyc*rythme+dec,n=floor(ph),age=ph-n;
  uint s2=vG(ivec2(ci)+ivec2(int(n)*7919,int(n)*3571),k+101u);
  vec4 a=vA4(s2);
  float u=a.x;
  // Étirée vers le bas et lobée, une grosse goutte s'étend jusqu'à 1,7 r, une petite jusqu'à 1,27 r : bornée
  // ainsi, elle tient dans sa case et n'y est jamais coupée au carré ; les petites gardent du jeu (pas de grille).
  float r=min(mix(rMin,rMax,u*u),.29);
  vec2 c=(a.yz-.5)*max(0.,1.-2.*r*mix(1.27,1.69,u));
  vec2 cp=(ci+.5+c)*taille,dp=p-cp;
  float lim=1.7*r*taille;
  if(dot(dp,dp)>=lim*lim)return;           // hors de la goutte (la plupart des pixels) : ni amas ni forme à lire
#if VISIERE_PALIER>=1
  dl*=.4+1.2*vBruit(pc*(2.2+.35*float(k&3u))+vec2(float(k)*.37,0.),k+701u);
  if(rang>=dl)return;
#endif
  float vie=smoothstep(0.,.025,age)*(1.-smoothstep(.8,1.,age))*clamp((dl-rang)*14.,0.,1.);
  if(vie<=.002)return;
  vec4 irr=(vA4(s2)-.5)*vec4(.34,.34,.2,.2)*(.35+u);
  vGoutte(e,p,cp,r*taille*sqrt(vie),1.03+.05*a.w,1.+.3*u,plat*u,px,flou,champ,irr);
}

// Nappes : à l'arrêt sous forte pluie, les gouttes se rejoignent en plaques d'eau aux contours mous qui glissent vers
// le bas. Bruit à seuil ; sa pente donne la réfraction, forte au bord, presque nulle au milieu (eau plate).
const vec2 V_NAPPE=vec2(8.6,6.4);
const mat2 V_ROT=mat2(.8,.6,-.6,.8);       // réseau du bruit tourné : pas de bords en losange calés sur la grille
vec3 vNappeChamp(vec2 p,float g){
  vec2 q=V_ROT*((p+vec2(0.,g*.4))*V_NAPPE);
  vec3 b=vBruitD(q,307u)*.64;
#if VISIERE_PALIER>=2
  b+=vBruitD(q*2.37+vec2(5.7,1.9),311u)*vec3(.36,.36*2.37,.36*2.37);
#else
  b*=1./.64;
#endif
  b.yz=b.yz*V_ROT;                         // pente ramenée dans le repère de l'écran
  return b;
}

float vNappeSeuil(float qte){return 1.-qte*.3;}
void vNappes(inout VEau e,vec2 p,float qte,float g,float px){
  vec3 b=vNappeChamp(p,g);
  float h=(b.x-vNappeSeuil(qte))*11.;
  if(h<=0.)return;
  vec2 gr=b.yz*V_NAPPE*11.;                // pente de h par hauteur d'écran
  float lg=length(gr);
  float a=smoothstep(0.,1.6*lg*px+.02,h);
  float hc=clamp(h,0.,1.),bord=1.-hc;
  // eau plate au milieu (vue presque directe, un peu grossie), ménisque au bord qui tord et assombrit
  vec2 s=vUv(p)-gr/max(lg,1e-3)*(.03*bord*bord*bord)-(vUv(p)-.5)*.012*hc;
  // les gouttes posées sous la nappe s'y sont fondues : elle les remplace (les coulures, ajoutées après, restent)
  float f=1.-a*smoothstep(0.,.35,hc);
  e.s*=f;e.w*=f;e.sombre*=f;e.eclat*=f;e.a*=f;
  vAjoute(e,a,.25+.5*hc,s,smoothstep(.45,1.,bord)*.75,smoothstep(.55,.9,bord)*smoothstep(1.,.9,bord)*.5);
}

// Coulures : colonnes verticales ; dans chacune, des gouttes lourdes descendent par à-coups sur un chemin fixé à
// l'écran. Derrière la goutte restent un film étroit et des gouttelettes, qui sèchent avec la distance parcourue.
float vChemin(float z,float x0,float W,float a,float b){return x0+W*(.2*sin(z*6.3+a)+.08*sin(z*15.7+b));}
const float V_COL=.068;
void vCoulures(inout VEau e,vec2 p,float dens,float g,float px,float flou,float echelle){
  float W=V_COL*echelle;
  float col=floor(p.x/W);
  uint s=vG(ivec2(int(col),-77),97u);
  if(vA(s)>=dens)return;
  vec4 t=vA4(s);
  float k=.5+t.x,L=(.75+.75*t.y)*echelle,a1=t.z*6.2832,a2=t.w*6.2832,x0=(col+.5)*W;
  float z=.5-p.y;
  float gg=g*k+vA(s)*L;
  gg+=.03*L*sin(gg*27.3/L+a1);                 // s'accroche puis glisse ; la progression reste croissante
  float m=(gg-z)/L,n0=floor(m);
  for(int i=0;i<2;i++){
    float nn=n0+float(i),zd=gg-nn*L;
    uint s3=vG(ivec2(int(col),int(nn)),131u);
    vec4 b=vA4(s3);
    if(b.x>.8)continue;
    float R=W*(.17+.14*b.y);
    vec4 irr=(vA4(s3)-.5)*vec4(.3,.3,.16,.16);
#if VISIERE_PALIER>=1
    float dz=zd-z,dx=p.x-vChemin(z,x0,W,a1,a2);
    if(i==0){
      // la goutte qui court avale ce qu'elle croise : derrière elle, ni gouttes posées ni nappe, un temps
      float f=1.-(1.-smoothstep(R*1.1,R*1.9,abs(dx)))*(1.-smoothstep(.35,.8,dz));
      e.s*=f;e.w*=f;e.sombre*=f;e.eclat*=f;e.a*=f;
    }
#endif
    vGoutte(e,p,vec2(vChemin(zd,x0,W,a1,a2),.5-zd),R,2.6,1.1,.3,px,flou,.3,irr);
#if VISIERE_PALIER>=1
    if(i==0){
      float Lt=.46*echelle,sec=clamp(1.-dz/Lt,0.,1.);
      if(sec>0.){
        float lar=R*(.28+.32*sec);
        float bande=(1.-smoothstep(lar*.5,lar,abs(dx)))*sec;
        if(bande>e.film){e.film=bande;e.filmD=vec2(sign(dx)*(1.-abs(dx)/lar),0.);}
        float st=.02*echelle,mt=floor(z/st);
        uint s4=vG(ivec2(int(col),int(mt)),173u);
        vec4 c4=vA4(s4);
        if(c4.x<.8){
          float zt=(mt+.3+.4*c4.y)*st,dzt=zd-zt;
          if(dzt>0.){
            float vt=clamp(1.-dzt/Lt,0.,1.);
            vGoutte(e,p,vec2(vChemin(zt,x0,W,a1,a2)+(c4.z-.5)*R*.6,.5-zt),R*(.24+.26*c4.w)*sqrt(vt),1.,1.12,0.,px,flou,.38,vec4(0.));
          }
        }
      }
    }
#endif
  }
}
// Traînées de vent : à vitesse, l'eau part du point d'arrêt de l'air (sous le bas de la visière) vers le haut et les
// côtés. Colonnes en éventail autour de ce point ; la tête s'étire du chemin parcouru en 1/40 s et s'amincit en
// queue ; un film étroit sèche derrière.
void vVent(inout VEau e,vec2 p,float dens,float av,float vit,float px,float flou){
  vec2 S=vec2(0.,-.66),r=p-S;
  float rho=length(r);
  if(rho<.32)return;
  float th=atan(r.x,r.y);
  const float Wa=.026;
  float u=th/Wa,col=floor(u);
  uint s=vG(ivec2(int(col),-191),211u);
  if(vA(s)>=dens*smoothstep(.32,.6,rho))return;
  vec4 t=vA4(s);
  float k=.6+.8*t.x,L=.28+.4*t.y,dec=(t.z-.5)*.5;
  vec2 rad=r/rho,lat=vec2(rad.y,-rad.x);
  float aa=av*k+t.w*L;
  float m=(aa-rho)/L,n0=floor(m);
  float ex=(u-col-.5-dec)*Wa*rho+Wa*rho*.22*sin(rho*11.+dec*20.);   // écart à l'axe ; l'air ne coule pas droit
  for(int i=0;i<2;i++){
    float nn=n0+float(i),rd=aa-nn*L;
    uint s3=vG(ivec2(int(col),int(nn)),223u);
    vec4 b=vA4(s3);
    if(b.x>.7)continue;
    float R=min(Wa*rho*.26,.0075)*(.55+.7*b.y);
    float len=R*1.2+vit*k*.024;
    float dr=rd-rho,tq=clamp(dr,0.,len),fr=tq/max(len,1e-4);
    float rq=R*mix(1.,.3,fr);
    vec2 dd=vec2(ex,dr-tq);
    float q=dot(dd,dd)/(rq*rq);
    if(q<1.){
      float h=1.-q,a=smoothstep(0.,2.2*px/rq+flou,h)*mix(1.,.45,fr);
      // en travers, la traînée inverse comme une goutte ; en long, elle étale l'image
      vAjoute(e,a,h*(1.-.5*fr),vUv(p-lat*dd.x)-lat*(dd.x/rq)*.09+rad*.01,smoothstep(.35,1.,sqrt(q))*.55,0.);
    }
#if VISIERE_PALIER>=1
    if(i==0&&dr>len){
      float sec=clamp(1.-(dr-len)/.22,0.,1.),lar=R*.34;
      float bande=(1.-smoothstep(lar*.35,lar,abs(ex)))*sec*.75;
      if(bande>e.film){e.film=bande;e.filmD=lat*sign(ex)*(1.-abs(ex)/lar);}
    }
#endif
  }
}

// Flocons collés : touffes floues (trois ou quatre lobes) d'opacité propre ; avec l'âge, la touffe pâlit et laisse
// une goutte à sa place. Les amas groupent les flocons comme la neige mouillée qui s'agglomère.
void vFlocons(inout VEau e,inout float blanc,vec2 p,float taille,float dens,float cyc,uint k,float px,float flou,float air,float chaud){
  vec2 q=p/taille,ci=floor(q);
  uint s=vG(ivec2(ci),k);
  float rang=vA(s);
  if(rang>=dens*1.98)return;               // plus haut que le plus dense des amas
  vec4 t=vA4(s);
  float rythme=.6+.8*t.x,dec=t.y;
  vec2 pc=(ci+.5)*taille;
  float ph=cyc*rythme+dec,n=floor(ph),age=ph-n;
  uint s2=vG(ivec2(ci)+ivec2(int(n)*6007,int(n)*911),k+7u);
  vec4 a=vA4(s2);
  float u=a.x;
  float r=mix(.12,.34,u*u)*mix(1.2,.8,air);   // lente, la neige mouillée colle en paquets
  vec2 c=(a.yz-.5)*max(0.,1.-2.9*r);
  vec2 d=q-ci-.5-c;
  if(dot(d,d)>=3.45*r*r)return;            // hors de la touffe (lobes à 1,13 r du centre, de rayon 0,72 r au plus)

  float nb=vBruit(pc*2.7,k+711u);
  float dl=dens*mix(1.,vReste(pc),air)*(.08+1.9*nb*nb);   // des amas et des vides, pas une grille de pois
  if(rang>=dl)return;
  float fonte=smoothstep(mix(.72,.22,chaud),1.,age);
  float vie=smoothstep(0.,.02,age)*clamp((dl-rang)*14.,0.,1.);
  float op=.3+.5*a.w;

  float f=0.;
#if VISIERE_PALIER>=2
  for(int i=0;i<4;i++){
#else
  for(int i=0;i<3;i++){
#endif
    vec4 l=vA4(s2);
    vec2 o=(l.xy-.5)*r*1.6;
    float ri=r*(.3+.42*l.z);

    f=max(f,1.-dot(d-o,d-o)/(ri*ri));
  }
  if(f>0.){
    // cristaux : une touffe n'est pas un disque blanc uni, elle a du grain et des bords qui fondent
    float cr=vBruit(d*(3.5/max(r,.05))+vec2(float(k),u*9.),k+3u);
    blanc=max(blanc,smoothstep(0.,.85+flou*2.,f)*op*vie*(1.-fonte)*(.55+.7*cr));
  }
  if(fonte>.02)vGoutte(e,p,(ci+.5+c)*taille,r*taille*.6*sqrt(fonte*vie),1.,1.15,.2,px,flou,.34,vec4(0.));
}

// Bourrelets de neige au bord de la visière : plus épais sur la lèvre du bas et dans les coins ; bord intérieur
// irrégulier. Rend l'opacité ; ep : épaisseur relative (le blanc le plus dense au bord) ; gr : grain de la neige.
float vBourrelet(vec2 p,float b,out float ep,out float gr){
  float dx=.5*vAsp-abs(p.x),dy=.5-abs(p.y);
  float d=min(dx*1.25,dy+(p.y<0.?0.:.03));
  d=min(d,length(vec2(dx,dy))*.9);
  if(d>b*(.03+.2*b)*2.38+b*.11+.004){ep=0.;gr=.5;return 0.;}   // plus loin du bord que le plus gros bourrelet

  float n=vFbm(p*vec2(4.2,5.6)+vec2(3.1,0.),401u),n2=vBruit(p*vec2(15.,19.),405u);
  gr=vFbm(p*41.,409u);
  float coin=smoothstep(.25,0.,min(dx,dy*1.6)+.2-length(vec2(dx,dy))*.6);
  // le long du bord, des tas et des trouées ; le haut, sous le front du casque, en garde moins
  float tas=smoothstep(.22,.72,vBruit(p*vec2(2.3,2.9)+vec2(9.7,4.1),413u));
  float haut=mix(1.,.4,smoothstep(.05,.45,p.y));
  float T=(b*(.03+.2*b)*(.15+1.5*n*n+.25*n2)*(.25+1.*tas)+b*.05*coin)*haut+b*.06*(1.-smoothstep(-.5,-.32,p.y));

  ep=clamp((T-d)/max(T,1e-4),0.,1.);
  return smoothstep(T,T-.01-.025*b,d+(gr-.5)*.006);
}

// Nuage d'eau des voitures suivies : brume dans le monde (derrière la visière). Panache autour de la voiture visée,
// plus large que haut, qui s'ouvre vers nous ; tourbillons qui fuient depuis la voiture. Rend la densité.
float vBrume(vec2 uv,float t){
  float E=uVisiere[2].x;
  if(E<=.001)return 0.;
  vec2 cb=uVisiere[2].yz;float w=max(uVisiere[2].w,.025);
  vec2 d=(uv-cb)*vec2(vAsp,1.);
  float bas=max(0.,-d.y);
  float ex=d.x/(w*2.3+bas*1.3),ey=(d.y-w*.45)/(w*1.5+bas*.9);
  float panache=exp(-(ex*ex+ey*ey));
  float rr=length(d)+.01,an=atan(d.y,d.x),f=log(rr)*2.4-t*1.9;
  float tu=.5+.25*sin(an*5.+f*3.1+sin(f*1.7+an*2.))+.25*sin(an*9.-f*4.3+1.3);
#if VISIERE_PALIER>=1
  tu=mix(tu,vBruit(vec2(an*3.,f*2.),601u),.5);
#endif
  float dens=E*(.3*E+1.15*panache)*(.8+.36*tu);   // nuage dense et clair ; les tourbillons ne font que le moirer
  return clamp(dens,0.,.86);                         // au cœur, on devine encore la voiture
}

#ifdef VISIERE_SCENE
vec3 visiere(vec2 uv){
  vec3 net=texture(VISIERE_SCENE,uv).rgb;
  float actif=uVisiere[1].x+uVisiere[1].y+uVisiere[1].z+uVisiere[1].w+uVisiere[2].x+uVisiere[3].x+uVisiere[3].y+uVisiere[3].z+uVisiere[4].x;
  if(actif<=.0008)return net;
  vAsp=uVisiereTaille.x/uVisiereTaille.y;vGr=uint(uVisiere[5].w)*0x27d4eb2fu;
  vec2 p=vec2((uv.x-.5)*vAsp,uv.y-.5);
  float px=1./uVisiereTaille.y,t=uVisiere[0].x;
  float ext=uVisiere[4].z,air=uVisiere[4].w;
  vec3 flou=texture(VISIERE_VOILE,uv).rgb;
  vec3 ciel=texture(VISIERE_VOILE,vec2(.5,.84)).rgb;
  float lum=dot(ciel,vec3(.3,.59,.11)),loin=vLoin(uv);
  // 1. le nuage d'eau des voitures devant (dans le monde)
  float brume=vBrume(uv,t)*loin;
  vec3 teinte=(mix(ciel,flou,.1)*1.06+.06)*(.92+.12*uv.y);   // l'eau en suspension prend la lumière du ciel
  // 2. l'eau sur la visière (ou l'objectif : gouttes plus grosses, plus rares, floues)
  VEau e=VEau(0.,vec2(0.),0.,0.,0.,0.,vec2(0.));
  float defo=mix(.05,.75,ext);                  // bord adouci : mise au point au loin
  float ech=mix(1.,3.,ext),gr=mix(1.,1.45,ext);
  float cyc=uVisiere[0].w,glisse=uVisiere[0].y,coul=uVisiere[1].z;
  if(uVisiere[1].x>.001&&ext<.5)
    vPosees(e,p,.0105,uVisiere[1].x*.9,cyc*.35,11u,px,defo,air*.4,.16,.36,0.,.42);
  if(uVisiere[1].y>.001){
    // sur l'objectif, l'air ne dessine pas l'éventail de la visière : les gouttes restent partout
    vPosees(e,p,.024*ech,uVisiere[1].y*mix(.85,.55,ext),cyc,23u,px,defo,air*(1.-ext*.8),.12*gr,.34*gr,.0,.4);
    vPosees(e,p,.056*ech,uVisiere[1].y*mix(.62,.6,ext),cyc*.7,37u,px,defo,air*(1.-ext*.8),.12*gr,.36*gr,.7,.3);
#if VISIERE_PALIER>=2
    vPosees(e,p,.013*ech,uVisiere[1].y*mix(.7,.2,ext),cyc*1.3,53u,px,defo,air,.14,.32,0.,.42);
#endif
  }
  if(uVisiere[6].z>.001)vNappes(e,p,uVisiere[6].z*mix(1.,.6,ext),glisse,px);
  if(coul>.001)vCoulures(e,p,coul*mix(.75,.45,ext),glisse,px,defo,ech);
  if(uVisiere[1].w>.001)vVent(e,p,uVisiere[1].w*mix(1.,.3,ext),uVisiere[0].z,uVisiere[4].y,px,defo);
  float blanc=0.;
  if(uVisiere[3].x>.001){
    float chaud=1.-uVisiere[5].y;
    vFlocons(e,blanc,p,.068*ech,uVisiere[3].x*.8,uVisiere[3].w,71u,px,defo,air,chaud);
#if VISIERE_PALIER>=2
    vFlocons(e,blanc,p,.034*ech,uVisiere[3].x*.7,uVisiere[3].w*1.2,83u,px,defo,air,chaud);
#endif

  }
  // fond : le film des coulures tord un peu, les gouttelettes et la brume diffusent
  vec3 fond=net;
  if(e.film>.001)fond=texture(VISIERE_SCENE,uv+e.filmD*e.film*.006).rgb;
  float diffus=clamp(uVisiere[1].x*.1+e.film*.18+brume*1.25,0.,1.);
  fond=mix(fond,flou,diffus);
  fond=mix(fond,teinte,brume*.88);
  vec3 c=fond;
  if(e.a>.001){
    vec2 sp=vMiroir(e.s/max(e.w,1e-5));
    float df=mix(.22,.8,ext);
    vec3 r=mix(texture(VISIERE_SCENE,sp).rgb,texture(VISIERE_VOILE,sp).rgb,df);
    r=mix(r,teinte,brume*.7);
    r*=1.-mix(.62,.4,ext)*e.sombre/max(e.w,1e-5);   // hors de la mise au point, le bord noir se fond
    r+=e.eclat*(.18+.32*lum)*(1.-ext*.5);

    r*=vec3(.95,.98,1.01);
    c=mix(c,r,e.a);
  }
  // 3. neige sur la visière : flocons, bourrelets du bord, voile blanc des rafales (dehors)
  vec3 neige=vec3(.86,.9,.95)*(.55+.6*lum);
  if(blanc>.001)c=mix(c,neige*(.9+.1*blanc),blanc*.9);
  if(uVisiere[3].y>.001){
    float ep,g2;
    float mb=vBourrelet(p,uVisiere[3].y,ep,g2);
    vec3 bn=neige*(.8+.2*ep+.16*(g2-.5));
    bn=mix(bn*vec3(.86,.92,1.02),bn,ep);       // mince, la neige laisse passer un jour bleuté
    c=mix(c,bn,mb*(.7+.3*ep));
  }
  if(uVisiere[3].z>.001){
    float rafale=.5+.5*sin(t*.73+sin(t*1.91)*1.3);
    float v=uVisiere[3].z*uVisiere[3].z*(.18+.4*rafale)*loin;
    c=mix(c,mix(flou,neige,.6),clamp(v,0.,.7));
  }
  // 4. buée, dans le casque : monte du bas, laiteuse, irrégulière
  if(uVisiere[4].x>.001){
    float b=uVisiere[4].x,n=vFbm(p*3.2+vec2(0.,t*.015),501u);
    float niveau=b*1.3-(p.y+.5)*.8+(n-.5)*.34;
    float m=smoothstep(0.,.32,niveau)*.9+b*.1;
    c=mix(c,mix(flou,ciel,.3)*.92+.06,clamp(m,0.,.94));
  }
  return c;
}
#endif

// Palier 0 (Légère) : sans image de la scène. Rend une couleur prémultipliée à mélanger par-dessus la scène
// (ONE, ONE_MINUS_SRC_ALPHA). Les gouttes montrent le ciel en bas et la route en haut, comme une lentille inversée.
vec4 visiereLegere(vec2 uv){
  float actif=uVisiere[1].y+uVisiere[1].z+uVisiere[1].w+uVisiere[2].x+uVisiere[3].x+uVisiere[3].y+uVisiere[3].z+uVisiere[4].x;
  if(actif<=.0008)return vec4(0.);
  vAsp=uVisiereTaille.x/uVisiereTaille.y;vGr=uint(uVisiere[5].w)*0x27d4eb2fu;
  vec2 p=vec2((uv.x-.5)*vAsp,uv.y-.5);
  float px=1./uVisiereTaille.y,t=uVisiere[0].x,ext=uVisiere[4].z,air=uVisiere[4].w;
  vec3 ciel=uVisiereCiel;float lum=dot(ciel,vec3(.3,.59,.11)),loin=vLoin(uv);
  float ech=mix(1.,2.4,ext),defo=mix(.05,.85,ext);
  VEau e=VEau(0.,vec2(0.),0.,0.,0.,0.,vec2(0.));
  if(uVisiere[1].y>.001)vPosees(e,p,.03*ech,uVisiere[1].y*mix(.85,.4,ext),uVisiere[0].w,23u,px,defo,air,.14,.36,0.,.4);
  if(uVisiere[1].z>.001)vCoulures(e,p,uVisiere[1].z*.7,uVisiere[0].y,px,defo,ech);
  if(uVisiere[1].w>.001)vVent(e,p,uVisiere[1].w*mix(1.,.3,ext),uVisiere[0].z,uVisiere[4].y,px,defo);
  vec4 o=vec4(0.);
  if(e.a>.001){
    vec2 sp=e.s/max(e.w,1e-5);
    float haut=clamp((sp.y-.15)/.7,0.,1.);
    vec3 r=mix(ciel*.38,ciel*1.05,haut);     // inversée : le ciel tombe dans le bas de la goutte
    r*=1.-.6*e.sombre/max(e.w,1e-5);
    r+=e.eclat*(.2+.3*lum);
    float a=e.a*.62;
    o=vec4(r*a,a);
  }
  float brume=vBrume(uv,t)*loin;
  if(brume>.001){float a=brume*.92;o=vec4((ciel*1.04+.04)*a,a)+o*(1.-a);}   // sans flou, le nuage doit couvrir plus

  vec3 neige=vec3(.86,.9,.95)*(.55+.6*lum);
  if(uVisiere[3].y>.001){
    float ep,g2,mb=vBourrelet(p,uVisiere[3].y,ep,g2)*(.7+.3*ep);
    o=vec4(neige*(.85+.15*ep)*mb,mb)+o*(1.-mb);
  }
  if(uVisiere[3].z>.001){
    float v=clamp(uVisiere[3].z*uVisiere[3].z*(.18+.4*(.5+.5*sin(t*.73+sin(t*1.91)*1.3)))*loin,0.,.7);
    o=vec4(neige*.95*v,v)+o*(1.-v);
  }
  if(uVisiere[4].x>.001){
    float b=uVisiere[4].x,m=clamp(smoothstep(0.,.32,b*1.3-(p.y+.5)*.8)*.85+b*.1,0.,.9);
    o=vec4(ciel*.9*m,m)+o*(1.-m);
  }
  return o;
}
`;

  // Source pour un palier : 0 Légère (visiereLegere seulement), 1 Moyenne, 2 Fine. scene et voile : noms des
  // échantillonneurs de la passe (image nette, copie floue au quart) ; inutiles au palier 0.
  const CACHE = new Map();
  function source(palier, scene, voile) {
    const n = palier === 'low' || palier === 0 ? 0 : palier === 'medium' || palier === 1 ? 1 : 2;
    const cle = n + ':' + (scene || '') + ':' + (voile || '');
    let s = CACHE.get(cle);
    if (!s) {
      s = '#define VISIERE_PALIER ' + n + '\n' + (n > 0 && scene ? '#define VISIERE_SCENE ' + scene + '\n#define VISIERE_VOILE ' + voile + '\n' : '') + GLSL;
      CACHE.set(cle, s);
    }
    return s;
  }

  B.visiere = Object.freeze({ PAS, VEC4, TAILLE_UNIFORMES, PALIERS, creer, avancer, uniformes, embruns, viser, source, GLSL });
})(globalThis.BITUME = globalThis.BITUME || {});
