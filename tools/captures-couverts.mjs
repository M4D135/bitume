#!/usr/bin/env node
// Poses prescrites dans le vrai HTML : contrôle du rendu, des abris et des solides, pas un roulage.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturer, optionsCapture } from './controle-visuel.mjs';
import { preparerEtat } from './captures-meteo.mjs';

export const SCENARIOS_COUVERTS = Object.freeze([
  { id: 'haut-col-portails', circuit: 2, circuitId: 'haut-col', type: 'tunnel', ordinal: 0, portails: true, images: 5 },
  { id: 'cimes-rocher', circuit: 8, circuitId: 'route-des-cimes', type: 'tunnel', ordinal: 0, portails: true, images: 5 },
  { id: 'cimes-echelles', circuit: 8, circuitId: 'route-des-cimes', type: 'tunnel', ordinal: 1 },
  { id: 'cimes-galerie', circuit: 8, circuitId: 'route-des-cimes', type: 'galerie', ordinal: 0 },
  { id: 'cimes-dessus-toit', circuit: 8, circuitId: 'route-des-cimes', type: 'tunnel', ordinal: 1, dessus: true },
  { id: 'cimes-deux-vues', circuit: 8, circuitId: 'route-des-cimes', type: 'tunnel', ordinal: 0, duo: true }
].map(Object.freeze));
export function optionsCouverts(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !['url', 'sortie', 'chrome', 'cas', 'taille', 'angle'].includes(k) || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error('Option inconnue ou valeur absente : '+argv[i]);
    if (o[k] !== undefined) throw new Error('Option répétée : '+k);
    o[k] = argv[i+1];
  }
  if (!o.url || !o.sortie || new URL(o.url).protocol !== 'file:') throw new Error('--url file: et --sortie nécessaires pour identifier le build exact');
  o.cas = o.cas ? o.cas.split(',') : SCENARIOS_COUVERTS.map(s => s.id);
  if (!o.cas.length || new Set(o.cas).size !== o.cas.length || o.cas.some(id => !SCENARIOS_COUVERTS.some(s => s.id === id))) throw new Error('Cas couvert inconnu ou dupliqué');
  o.taille ||= '960,540'; o.angle ||= 'swiftshader';
  optionsScenarioCouvert(SCENARIOS_COUVERTS[0], o); // validation unique des bornes du CLI commun
  return o;
}
export function optionsScenarioCouvert(s, o) {
  const args = ['--url',o.url,'--sortie',path.join(o.sortie,s.id),'--scenario',s.duo?'duo':'pluie','--images',String(s.images || 2),
    '--chauffe','30','--pas','.1','--taille',o.taille,'--angle',o.angle || 'swiftshader','--qualite','high','--circuit',String(s.circuit),
    '--saison','ete','--meteo','pluie','--vitesse','35','--depart','280','--retro',s.dessus?'non':'oui','--attendre','120000'];
  if (o.chrome) args.push('--chrome', o.chrome);
  const p = optionsCapture(args);
  if (s.dessus) p.referenceJeu.vue = 'helico';
  return p;
}
// Seules les poses et conditions sont disposées. Aucune implémentation de géométrie, caméra, météo
// ou shader n'est injectée : tout provient du HTML désigné et de son monde PhysX déjà installé.
export function installerEtatCouverts(s) {
  const J = BITUME_JEU, B = BITUME, S = J.session, c = S.course.c, C = B.couverts, co = S.course;
  if (J.CATALOGUE[S.i]?.id !== s.circuitId) throw new Error('Catalogue chargé différent du scénario : '+s.circuitId);
  const sections = C.liste(c), t = sections.filter(q => C.type(q) === s.type)[s.ordinal], galerie = sections.find(q => C.type(q) === 'galerie');
  if (!t || s.duo && !galerie) throw new Error('Ouvrage requis absent dans la page');
  const premier = t.debut, dernier = premier + C.longueur(c,t), dedans = s.type === 'galerie' ? premier + Math.min(30,(dernier-premier)/2) : (premier+dernier)/2;
  const marge = Math.min(12, (dernier-premier)/4), etapes = s.portails ? [
    { id:'entree-exterieure', s:premier-12, abri:false }, { id:'entree-interieure', s:premier+marge, abri:true },
    { id:'centre', s:dedans, abri:true }, { id:'sortie-interieure', s:dernier-marge, abri:true },
    { id:'sortie-exterieure', s:dernier+12, abri:false }
  ] : [{ id:s.dessus?'dessus-toit':'interieur', s:dedans, abri:!s.dessus }];
  const fixer = (v, abscisse) => {
    const e = v.etat, q = B.circuit.echantillon(c,abscisse), d = 0;
    Object.assign(e,{s:((abscisse%c.longueur)+c.longueur)%c.longueur,d,v:35,psi:0,beta:0,y:q.y,tangage:Math.atan(q.pente||0),roulis:q.devers||0});
    const p = {x:q.x,y:q.y,z:q.z,cap:q.cap,tangage:e.tangage,roulis:e.roulis,braquage:0,roule:v.roule||0,rebond:[0,0,0,0]};
    if(e._physx) Object.assign(e._physx,{x:p.x,y:p.y,z:p.z,cap:p.cap,groundCount:4});
    for(const liste of [S.prec,S.cour]) Object.assign(liste[v.id],p);
  };
  const G = globalThis.__COUVERTS_CAPTURE = { scenario:s, section:t, galerie, etapes, etapeIndex:0, abscisse:dedans, etape(i) {
    const etape = etapes[s.portails?i:0];
    if (!etape) throw new Error('Étape de portail absente : '+i);
    G.etapeIndex = i; G.abscisse = etape.s;
    for(const v of co.voitures) {
      const j2 = s.duo && S.locaux?.[1] === v.id;
      const abscisse = j2 ? galerie.debut + Math.min(30,C.longueur(c,galerie)/2) : G.abscisse + (v.id === S.suivie ? 0 : 35+v.id*7);
      fixer(v,abscisse);
    }
    S.camCap = null; S.tete = null;
    if(S.vueJ2) { S.vueJ2.camCap = null; S.vueJ2.tete = null; }
    if(s.dessus) {
      const q = B.circuit.echantillon(c,dedans);
      J.camera = () => ({pos:[q.x,q.y+t.hauteur+4,q.z],yaw:q.cap+Math.PI/2,pitch:-.15,roll:0,fov:60});
    }
  }};
  G.etape(0);
  return { posePrescrite:true, circuitId:s.circuitId, section: {...t}, sections: sections.map(q=>({...q})),
    etapes, longueur:c.longueur, pas:c.pas,
    description:'Pose prescrite, rendu et effets du vrai build. Les cinq phases portail sont des états séparés, pas une traversée roulée.' };
}
export function observerCouverts() {
  const J=BITUME_JEU,B=BITUME,S=J.session,c=S.course.c,G=__COUVERTS_CAPTURE,gl=J.rendu.gl,C=B.couverts;
  const vue = V => {
    if(!V?.camera) return null;
    const p=V.camera.pos,q=C.position(c,p),v=V.vitreContexte;
    return {camera:[...p],abri:!!q,interieur:!!q?.interieur,section:q?.couvert?.id || null,type:q?.type || null,
      lumiere:V.lumiere,lampes:Array.from(V.lampesTunnel?.p||[]).filter(x=>x>0).length,
      pluie:v?.pluie,abriVisiere:v?.abri,visiereActive:v?.actif,vue:V.vue};
  };
  const t=G.section,q=B.circuit.echantillon(c,G.abscisse),w=S.course.physique.world;
  const sol=w.raycast([q.x,q.y+1,q.z],[0,-1,0],2,{mask:1,staticOnly:true});
  const toit=w.raycast([q.x,q.y+1,q.z],[0,1,0],t.hauteur+2,{mask:2,staticOnly:true});
  const present=x=>({hit:!!x.hit,y:x.hit?x.y:null,body:x.hit?x.body:null});
  const vitres=J.vitres, vitresGL={}, visieresVisibles={};
  for (const [joueur,id] of [['j1','vitre'],['j2','vitre2']]) {
    if(joueur==='j2'&&!G.scenario.duo) continue;
    const toile=document.getElementById(id), css=toile&&getComputedStyle(toile);
    visieresVisibles[joueur]=!!toile&&!toile.hidden&&css.display!=='none'&&css.visibility!=='hidden';
    if(vitres?.[joueur]?.backend==='webgl2') {
      const g=toile?.getContext('webgl2');
      vitresGL[joueur]={present:!!g,erreur:g?g.getError():null,perdu:g?g.isContextLost():true};
    }
  }
  return {glErreur:gl.getError(),glPerdu:gl.isContextLost(),vitres,vitresGL,visieresVisibles,j1:vue(S),j2:G.scenario.duo?vue(S.vueJ2):null,
    sol:present(sol),toit:present(toit),yRoute:q.y,etape:G.etapeIndex,etapeId:G.etapes[G.scenario.portails?G.etapeIndex:0].id,
    abscisse:G.abscisse,pluie:S.meteo.pluie,
    sections:C.liste(c).map(t=>({id:t.id||null,type:C.type(t),debut:t.debut,fin:t.fin})),temps:S.meteo.t};
}
export function verifierCouvert(r,s) {
  const e=[]; if(r.fatal)e.push(r.fatal.split('\n')[0]);
  if(!r.build?.sha256 || !/^[a-f0-9]{64}$/.test(r.build.sha256))e.push('Empreinte du HTML absente');
  if(!r.source?.commit || !/^[a-f0-9]{40}$/.test(r.source.commit))e.push('Identité des outils absente');
  if(r.environnement?.webgl2!==true || r.environnement?.physx?.ready!==true)e.push('WebGL2 ou PhysX natif absent');
  if(r.initialisation?.posePrescrite!==true || r.initialisation?.circuitId!==s.circuitId)e.push('Scène prescrite incorrecte');
  for(const x of r.erreurs||[]) e.push('Erreur page : '+x);
  for(const x of r.avertissements||[])if(/GL_INVALID|shader.*(error|failed)|GLSL|context lost/i.test(x))e.push('Erreur graphique : '+x);
  if(r.images?.length!==(s.images||2))e.push('Nombre de captures incomplet');
  for(const [i,im] of (r.images||[]).entries()) {
    const o=im.observation,abri=!s.dessus&&(!s.portails||i>0&&i<4),interieur=abri&&s.type==='tunnel';
    if(!o){e.push('Observation absente');continue;}
    if(o.glErreur||o.glPerdu)e.push('Erreur WebGL');
    const etapeId=s.portails?['entree-exterieure','entree-interieure','centre','sortie-interieure','sortie-exterieure'][i]:s.dessus?'dessus-toit':'interieur';
    if(o.etapeId!==etapeId)e.push('Étape des portails incorrecte');
    if(!(o.pluie>.5))e.push('Pluie non exercée');
    if(o.j1?.abri!==abri||o.j1?.abriVisiere!==abri||o.j1?.interieur!==interieur)e.push('Abri ou niveau incorrect');
    if(abri&&(o.j1?.type!==s.type||r.initialisation?.section?.id&&o.j1?.section!==r.initialisation.section.id))e.push('Ouvrage observé différent du scénario');
    if(!Array.isArray(o.j1?.camera)||o.j1.camera.length!==3||!o.j1.camera.every(Number.isFinite))e.push('Caméra invalide');
    if(!Number.isFinite(o.j1?.lumiere))e.push('Exposition absente');
    if(!o.sol?.hit||!Number.isFinite(o.sol.y)||!Number.isFinite(o.yRoute)||Math.abs(o.sol.y-o.yRoute)>.16)e.push('Appui physique absent ou incohérent');
    const sousToit=!s.portails||i>0&&i<4;
    if(o.toit?.hit!==sousToit)e.push('Toit physique incohérent avec les portails');
    if(sousToit&&!(o.toit.y-o.yRoute>5&&o.toit.y-o.yRoute<8))e.push('Hauteur de toit incohérente');
    if(interieur&&(!(o.j1?.lumiere>1.20)||!(o.j1?.lampes>0)))e.push('Tunnel non éclairé ou œil non adapté');
    if(s.type==='galerie'&&Math.abs(o.j1?.lumiere-1)>.02)e.push('Galerie obscurcie comme un tunnel');
    if(s.dessus&&(o.j1?.visiereActive!==false||!(o.j1?.camera?.[1]>o.toit?.y)))e.push('Caméra aérienne non extérieure');
    if(s.duo&&(!o.j2?.abri||!o.j2?.abriVisiere||o.j2?.interieur||o.j2?.type!=='galerie'||!Number.isFinite(o.j2?.lumiere)||Math.abs(o.j2.lumiere-1)>.02))e.push('J2 galerie non indépendant de J1 tunnel');
    for (const joueur of ['j1',...(s.duo?['j2']:[])]) {
      const v=o.vitres?.[joueur], g=o.vitresGL?.[joueur], contexte=o[joueur];
      if(v?.backend!=='webgl2'||v?.pret!==true)e.push('Visière WebGL2 inactive : '+joueur);
      if(v?.erreur||v?.perdu||v?.erreurs>0||v?.erreurs?.length||!g?.present||g?.erreur||g?.perdu)e.push('Erreur visière : '+joueur);
      if(!Number.isFinite(v?.eau)||!Number.isFinite(v?.embruns)||!Number.isFinite(v?.etapes))e.push('Mesures visière absentes : '+joueur);
      if(!(contexte?.pluie>.5))e.push('Contexte pluie absent : '+joueur);
      if(s.dessus) {
        if(v?.eau!==0||v?.embruns!==0||v?.gouttes!==0||o.visieresVisibles?.[joueur]!==false)e.push('Dépôt aérien inattendu');
      } else {
        if(contexte?.visiereActive!==true||!(v?.etapes>0))e.push('Simulation visière inactive : '+joueur);
        if(!contexte?.abri&&(!(v?.eau>.05)||!(v?.dessins>0)||!(v?.copiesScene>0)||!(v?.pixelsSource>0)||o.visieresVisibles?.[joueur]!==true))e.push('Pluie extérieure non rendue : '+joueur);
        if(!s.portails&&contexte?.abri&&(v?.eau!==0||v?.embruns!==0||v?.gouttes!==0))e.push('Apport sous le toit : '+joueur);
      }
    }
    for(const id of ['scene',...(s.duo?['scene2']:[])]) {
      if(!im.etat?.zones?.[id])e.push('Toile manquante : '+id);
      if(!Number.isFinite(im.vues?.[id]?.noir)||!Number.isFinite(im.vues?.[id]?.luminance))e.push('Mesure de l’image absente : '+id);
      if(im.vues?.[id]?.noir>.97&&im.vues[id].luminance<.025)e.push('Vue noire : '+id);
    }
    if(!s.dessus)for(const id of ['glace-g','glace-d',...(s.duo?['glace-g2','glace-d2']:[])])if(!im.etat?.zones?.[id])e.push('Rétroviseur manquant : '+id);
  }
  if(s.portails&&r.images?.length===5) {
    const eau=r.images.map(im=>im.observation?.vitres?.j1?.eau);
    if(!(eau[1]<eau[0]&&eau[2]<eau[1]&&eau[3]<eau[2]&&eau[4]>eau[3]+.05))e.push('Eau : arrêt sous le toit puis reprise à la sortie non prouvés');
    const lum=r.images.map(im=>im.observation?.j1?.lumiere);
    if(!(Math.abs(lum[0]-1)<.02&&Math.abs(lum[4]-1)<.02))e.push('Adaptation au jour des portails incorrecte');
  }
  return [...new Set(e)];
}
export async function campagneCouverts(o) {
  mkdirSync(o.sortie,{recursive:true});
  const r={format:'bitume-captures-couverts-v1',date:new Date().toISOString(),demandes:[...o.cas],passages:[],echecs:0,
    limites:['Poses prescrites : aucun essai de conduite, les états des portails sont séparés.','Raster indiqué par le navigateur, aucun FPS matériel mesuré.',
      'La vue au-dessus du toit ne prétend pas montrer une route superposée : ce cas géométrique est vérifié séparément.',
      'Les PNG doivent encore être inspectés ; les observations de géométrie ne prouvent pas leur qualité esthétique.',
      'source désigne le commit des outils ; build.sha256 identifie le HTML ouvert. La correspondance aux sources exige le contrôle de reconstruction CI.']};
  for(const id of o.cas) {
    const s=SCENARIOS_COUVERTS.find(s=>s.id===id),p=optionsScenarioCouvert(s,o);
    p.initialiser=({evaluer})=>evaluer(`(${preparerEtat.toString()})(${JSON.stringify({vitesse:35,duo:!!s.duo})}); (${installerEtatCouverts.toString()})(${JSON.stringify(s)})`);
    p.avantImage=async({evaluer,i})=>{
      if(s.portails&&i>0){ await evaluer(`__COUVERTS_CAPTURE.etape(${i}); true`); for(let k=0;k<30;k++)await evaluer('__BITUME_CAPTURE.avancer(100)'); }
    };
    p.observer=({evaluer})=>evaluer(`(${observerCouverts.toString()})()`);
    const resultat=await capturer(p),erreurs=verifierCouvert(resultat,s);
    const htmlFinal=readFileSync(fileURLToPath(o.url)), hashFinal=createHash('sha256').update(htmlFinal).digest('hex');
    if(resultat.build?.sha256!==hashFinal)erreurs.push('Le HTML a changé pendant la capture');
    if(r.build&&r.build.sha256!==resultat.build?.sha256)erreurs.push('Les scènes ne portent pas le même HTML');
    r.build ||= resultat.build;
    const empreintes=resultat.images.map(im=>{
      const png=readFileSync(path.join(p.sortie,im.fichier));
      return {fichier:im.fichier,etape:im.observation?.etapeId||null,octets:png.length,sha256:createHash('sha256').update(png).digest('hex')};
    });
    r.passages.push({scenario:id,images:resultat.images.length,dossier:id,build:resultat.build,source:resultat.source,empreintes,erreurs});
    r.echecs+=erreurs.length?1:0;
    writeFileSync(path.join(o.sortie,'rapport.json'),JSON.stringify(r,null,2)+'\n');
    process.stderr.write(id+' : '+resultat.images.length+' images, '+erreurs.length+' erreurs\n');
    if(resultat.fatal&&!resultat.images.length)break;
  }
  r.nonExecutes=o.cas.filter(id=>!r.passages.some(p=>p.scenario===id));
  r.complet=r.nonExecutes.length===0;
  writeFileSync(path.join(o.sortie,'rapport.json'),JSON.stringify(r,null,2)+'\n');
  return r;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{const r=await campagneCouverts(optionsCouverts(process.argv.slice(2)));console.log(JSON.stringify(r,null,2));process.exitCode=r.echecs?1:0;}
  catch(e){console.error(e.stack||e.message);process.exitCode=1;}
}
