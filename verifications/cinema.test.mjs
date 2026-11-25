// Décision du 21 novembre : routes et lieux existants ; les anciens plans flore/faune sont remplacés.
// Le décor du jeu et les rayons PhysX contrôlent les circuits du menu, sans consulter les animaux.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['moteur/renderer','circuit','couverts','route-des-cimes','route-des-cimes-decor','larche-vinadio-data','larche-vinadio','larche-vinadio-decor','marseille','marseille-decor','destinations','conduite','carene','botanique','ecologie','saisons','vegetation','bords','baikal','batiments','lieux','decor','obstacles','solides-physx','course','cinema','realisateur']) require('../src/'+f+'.js');
const B = globalThis.BITUME, X = await chargerPhysX(), Cine = B.cinema, R = B.realisateur;
const catalogue = vm.runInNewContext(readFileSync(new URL('../src/jeu.js',import.meta.url),'utf8').match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1], { B });
const circuitsAttendus = ['val-brule', 'marseille', 'corail', 'cap-sequoia', 'fjord', 'route-des-cimes', 'larche', 'lande-noire', 'sierra', 'brume-de-jade', 'baikal'];
let controles=0;
const rapports=[];
function verifier(nom,f) { f(); controles++; console.log('ok  '+nom); }
const plan = (a,cote=1) => ({vue:a.type,ancre:a,sujet:0,debut:0,fin:6.4,cote,n:1,nature:true});
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const signatures = new Set();
const animauxInterdits = new Proxy({}, {get(){throw new Error('une démo prépare encore un sujet animal');}});
try {
for(const k of catalogue) {
 const c = k.id === 'larche' ? B.larche.creer(k.graine) : k.id === 'marseille' ? B.marseille.creer(k.graine)
  : B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom, partition: k.partition });
 if(!c.ouvert)B.bords.limites(c,B.bords.planifier(c));
 const decor=B.decor.construire(c,{qualite:'high',vegetationQualite:'high',saison:'ete',organique:true,solsProceduraux:true});c.obstacles=B.obstacles.creer(decor.obstacles);
 const world=X.createWorld({fixedStep:1/120,maxSubSteps:1}), montage=B.solidesPhysX.installer(world,c,decor);
 try {
  const nbActeurs=world._bodies.size, t0=performance.now(), geometry=globalThis.FRender.shared.geometry;
  let reconstructions=0,C;
  globalThis.FRender.shared.geometry=(...args)=>{reconstructions++;return geometry(...args);};
  try{C=Cine.preparer(c,decor,animauxInterdits,world);}finally{globalThis.FRender.shared.geometry=geometry;}
  const preparationMs=performance.now()-t0;
  assert(reconstructions<=1,'le catalogue des formes est reconstruit par rocher');
  const poses=Array.from({length:12},(_,i)=>({...B.circuit.echantillon(c,200-i*7),tangage:0,roulis:0})), co=B.course.creer(c,{mode:'course',tours:2,rivaux:11,graine:42});
  const avant=JSON.stringify(co.voitures), rapport={circuit:k.id,preparationMs,panoramas:0,lieux:[],photos:0,pasMax:0};
  verifier(k.nom+' : routes et vrais lieux, trajectoires continues au-dessus du sol, acteurs intacts',()=>{
   assert.equal(C.ancres.panorama.length,8);
   assert(C.ancres.lieu.length>0,'aucun lieu emblématique préparé');
   assert(Cine.disponible(C,C.ancres.lieu[0],0),'lieu principal inaccessible : '+C.ancres.lieu[0].label);
   for(const a of C.ancres.lieu) assert(decor.lieux.marqueurs.includes(a.marqueur),'lieu inventé hors du décor');
   for(const a of C.ancres.panorama.concat(C.ancres.lieu)) {
    if(!Cine.disponible(C,a,0)) continue;
    if(a.type==='panorama')rapport.panoramas++;else rapport.lieux.push(a.label);
    for(const cote of [-1,1]) {
     const p=plan(a,cote), sequence=[];
     for(let i=0;i<=240;i++) {
      const t=p.fin*i/240, cam=Cine.camera(C,p,poses,co,t);assert(cam,`${k.id}/${a.label}/${a.s}: plan interrompu à ${i}/240`);
      assert(cam.pos.concat([cam.yaw,cam.pitch,cam.fov]).every(Number.isFinite));assert(cam.sujetNature);
      const h=world.raycast([cam.pos[0],C.maxY+200,cam.pos[2]],[0,-1,0],C.maxY-C.minY+400,{mask:1,staticOnly:true});
      if(h.hit)assert(cam.pos[1]>=h.y+.38,'caméra sous le sol réel');
      assert(Cine.valider(C,cam,cam.cible,p,t,i<120?16/9:9/16),'objectif ou transition traverse le décor');
      if(i){const step=distance(cam.pos,sequence[i-1].pos);rapport.pasMax=Math.max(rapport.pasMax,step);assert(step<.5,'bond de caméra '+step);}
      sequence.push(cam);rapport.photos++;
     }
     for(const i of [240,0,123,60,180,123])assert.deepEqual(Cine.camera(C,p,poses,co,p.fin*i/240),sequence[i]);
    }
   }
   assert(rapport.panoramas>=6,JSON.stringify(rapport));assert(rapport.lieux.length>0,JSON.stringify(rapport));
   assert.equal(world._bodies.size,nbActeurs);assert.equal(JSON.stringify(co.voitures),avant);
   signatures.add(JSON.stringify(C.ancres.lieu.map(a=>[a.label,a.cible])));
  });
  verifier(k.nom+' : aucun sujet faune/flore/pilote et lieux indépendants du réglage Faune',()=>{
   for(const q of ['off','low','high']){
    Cine.regler(C,{faune:q,nuit:1,pluie:1});
    for(const type of ['flore','faune','pilote']){
     assert.equal(Cine.choisir(C,type,0,0),null);
     assert.equal(Cine.camera(C,{vue:type,sujet:0,debut:0,fin:6},poses,co,0),null);
     assert(!Object.hasOwn(C.ancres,type));
    }
    assert(Cine.choisir(C,'lieu',0,0));
   }
  });
  if(k.id===catalogue[0].id || c.ouvert){
   verifier('lieu au départ, tracé, sprint et drapeau gardent des plans explicites',()=>{
    const r=R.creer(777);co.horloge=0;co.phase='grille';
    let p=R.tenir(r,co,C);assert.equal(p.motif,'grille');assert.equal(p.vue,'aileron');
    co.horloge=2.4;co.phase='feux';p=R.tenir(r,co,C);assert.equal(p.motif,'grille');
    co.horloge=5;co.phase='course';R.tenir(r,co,C);co.horloge=7.51;p=R.tenir(r,co,C);assert.equal(p.motif,'depart');
    co.horloge=30;r.plansCourse=3;p.fin=0;for(const v of co.voitures){v.etat.v=30;v.progression=200;}
    p=R.tenir(r,co,C);assert(!p.nature);const ancien=p, n=r.n;
    p=R.replier(r,co);assert.notEqual(p,ancien);assert.equal(p.n,n+1);assert.equal(p.vue,'tele');assert.equal(p.motif,'cadre');
    co.horloge=60;r.plansCourse=3;p.fin=0;p=R.tenir(r,co,C);assert(!p.nature && p.vue!=='helico');
    const ligne = c.ouvert ? c.arrivee - (c.depart || 0) : co.toursTotal*c.longueur;
    co.voitures[co.classement[0]].progression=ligne-200;p=R.tenir(r,co,C);assert.equal(p.motif,'sprint');assert(!p.nature);
    co.drapeau=61;co.horloge=61;co.voitures[0].fini=true;co.voitures[0].tempsFinal=61;p=R.tenir(r,co,C);assert.equal(p.motif,'arrivee');
   });
  }
  rapports.push(rapport);console.log(JSON.stringify(rapport));
 } finally {B.solidesPhysX.liberer(montage);world.dispose();}
}
verifier('circuits actuels du menu, lieux distincts et aucun monde natif conservé',()=>{
 assert.deepEqual(rapports.map(r=>r.circuit),circuitsAttendus);
 assert.equal(catalogue.find(k => k.id === 'route-des-cimes').partition,'route-des-cimes');
 assert.equal(signatures.size,circuitsAttendus.length,'des lieux génériques remplacent les vrais marqueurs');
 assert.equal(X.status().worlds,0);
});
}finally{
 if(process.env.BITUME_CINEMA_REPORT)writeFileSync(process.env.BITUME_CINEMA_REPORT,JSON.stringify({controles,versionPhysX:X.status().version,rapports},null,2)+'\n');
}
console.log(controles+' vérifications réussies');
