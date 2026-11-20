// Les plans cinéma lisent le vrai décor et les rayons du solveur natif ; ils ne modifient aucun acteur.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'route-des-cimes','conduite','carene','botanique','ecologie','saisons','vegetation','bords','decor','obstacles','solides-physx','ambiance','animaux','course','cinema','realisateur']) require('../src/'+f+'.js');
const B = globalThis.BITUME, X = await chargerPhysX(), Cine = B.cinema, R = B.realisateur;
const catalogue = vm.runInNewContext(readFileSync(new URL('../src/jeu.js',import.meta.url),'utf8').match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
// Les huit identités déjà livrées restent dans leur ordre ; Cimes est un neuvième parcours distinct.
const circuitsAttendus = ['val-brule','port-sable','haut-col','lande-noire','roche-fauve','brume-de-jade','cap-sequoia','baikal','route-des-cimes'];
let controles=0;
const rapports=[];
function verifier(nom,f) { f(); controles++; console.log('ok  '+nom); }
function posesSur(c,s=200) { return Array.from({length:12},(_,i)=>{const q=B.circuit.echantillon(c,s-i*7);return {...q,tangage:0,roulis:0};}); }
const plan = (a,cote=1) => ({vue:a.type,ancre:a,sujet:0,debut:0,fin:a.type==='panorama'?6.4:4.8,cote,n:1,nature:true});
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const signatures = new Set();
try {
for(const k of catalogue) {
 const c=B.circuit.creer(k.graine,{theme:k.theme,longueur:k.longueur,nom:k.nom,partition:k.partition}); B.bords.limites(c,B.bords.planifier(c));
 const decor=B.decor.construire(c,{qualite:'high',vegetationQualite:'high',saison:'ete'});c.obstacles=B.obstacles.creer(decor.obstacles);
 const animaux=B.animaux.creer(c,decor,{saison:'ete'}), world=X.createWorld({fixedStep:1/120,maxSubSteps:1}), montage=B.solidesPhysX.installer(world,c,decor);
 try {
  const avant=Array.from(animaux.cour), nbActeurs=world._bodies.size, t0=performance.now(), C=Cine.preparer(c,decor,animaux,world), preparationMs=performance.now()-t0;
  const poses=posesSur(c), co=B.course.creer(c,{mode:'course',tours:2,rivaux:11,graine:42});
  const rapport={circuit:k.id,preparationMs,panoramas:0,flores:0,photos:0,pasMax:0,faunes:0};
  verifier(k.nom+' : vrais sujets, trajectoires continues au-dessus des triangles, acteurs intacts',()=>{
   assert.equal(C.ancres.panorama.length,8);
   const plantes=(decor.lotsHerbier||[]).concat(decor.lots).flatMap(l=>l.objets||[]).filter(o=>o.collision==='tronc'||/fleur|fougere|fougère|taillis/.test(String(o.shape)));
   if(!plantes.length)assert.equal(C.ancres.flore.length,0,'flore inventée dans un biome sans plante');
   for(const a of C.ancres.flore) assert((decor.lotsHerbier||[]).concat(decor.lots).some(l=>l.objets?.includes(a.objet)),'sujet inventé');
   for(const a of C.ancres.panorama.concat(C.ancres.flore)) {
    if(!Cine.disponible(C,a,0)) continue;
    if(a.type==='panorama')rapport.panoramas++;else rapport.flores++;
    for(const cote of [-1,1]) {
     const p=plan(a,cote), sequence=[];
     for(let i=0;i<=240;i++) {
      const cam=Cine.camera(C,p,poses,co,p.fin*i/240);assert(cam,`${k.id}/${a.type}/${a.s}: plan interrompu à ${i}/240`);
      assert(cam.pos.concat([cam.yaw,cam.pitch,cam.fov]).every(Number.isFinite));assert(cam.sujetNature);
      const h=world.raycast([cam.pos[0],C.maxY+200,cam.pos[2]],[0,-1,0],C.maxY-C.minY+400,{mask:1,staticOnly:true});
      if(h.hit)assert(cam.pos[1]>=h.y+.38,'caméra sous le sol réel');
      if(i){const step=distance(cam.pos,sequence[i-1].pos);rapport.pasMax=Math.max(rapport.pasMax,step);assert(step<.5,'bond de caméra '+step);}
      sequence.push(cam);rapport.photos++;
     }
     // Le plan est une fonction du temps, y compris quand des images sont sautées ou demandées à rebours.
     for(const i of [240,0,123,60,180,123])assert.deepEqual(Cine.camera(C,p,poses,co,p.fin*i/240),sequence[i]);
    }
   }
   assert(rapport.panoramas>=6,JSON.stringify(rapport));if(C.ancres.flore.length)assert(rapport.flores>=Math.min(4,C.ancres.flore.length),JSON.stringify(rapport));
   assert.equal(world._bodies.size,nbActeurs);assert.deepEqual(Array.from(animaux.cour),avant);
   signatures.add(JSON.stringify(C.ancres.panorama.map(a=>[a.s,a.cible])));
  });
  verifier(k.nom+' : faune désactivée/légère respectée et vrai animal dessiné',()=>{
   for(const q of ['off','low']){Cine.regler(C,{faune:q});assert.equal(Cine.choisir(C,'faune',0,0),null);}
   Cine.regler(C,{faune:'high',nuit:0,pluie:0});
   for(const a of C.ancres.faune) {
    if(!Cine.disponible(C,a,0))continue;
    const p=plan(a), cam=Cine.camera(C,p,poses,co,0);if(!cam)continue;
    const sortie=[];B.animaux.dessiner(animaux,0,{vue:0,qualite:'high',camera:cam,hauteur:720,aspect:16/9,nuit:0,pluie:0},sortie);
    assert(sortie.length>0,'plan sur une faune non dessinée');
    const indice=a.famille==='sol'?a.indice:animaux.nAnimaux+a.groupe.premier+a.indice;
    assert(animaux.vues[0].lod[indice]>0,'animal choisi hors des budgets de dessin');rapport.faunes++;
    if(rapport.faunes===3)break;
   }
   assert(rapport.faunes>0,'aucun poste faune accessible');
   Cine.regler(C,{faune:'high',nuit:.8,pluie:1});
   for(const a of C.ancres.faune)if(a.famille==='vol')assert.equal(Cine.disponible(C,a,0),false,'oiseau invisible de nuit');
  });
  if(k.id===catalogue[0].id){
   verifier('départ, nature, perte du sujet, sprint et drapeau gardent des plans explicites',()=>{
    Cine.regler(C,{faune:'high',nuit:0,pluie:0});const r=R.creer(777);co.horloge=0;co.phase='grille';
    let p=R.tenir(r,co,C);assert.equal(p.motif,'decouverte');assert.equal(p.vue,'panorama');
    co.horloge=2.4;co.phase='feux';p=R.tenir(r,co,C);assert.equal(p.motif,'grille');
    co.horloge=5;co.phase='course';R.tenir(r,co,C);co.horloge=7.51;p=R.tenir(r,co,C);assert.equal(p.motif,'depart');
    co.horloge=30;r.plansCourse=3;p.fin=0;for(const v of co.voitures){v.etat.v=30;v.progression=200;}
    p=R.tenir(r,co,C);assert(p.nature);const ancien=p, n=r.n;
    p=R.replier(r,co);assert.notEqual(p,ancien);assert.equal(p.n,n+1);assert.equal(p.vue,'tele');assert.equal(p.motif,'cadre');
    const a=C.ancres.faune.find(a=>Cine.disponible(C,a,30));r.plan={...plan(a),debut:30,fin:36,n:++r.n,nature:true};Cine.regler(C,{faune:'off'});
    p=R.tenir(r,co,C);assert(!p.nature,'un animal désactivé reste au montage');
    Cine.regler(C,{faune:'high'});r.plan={...plan(C.ancres.panorama[0]),debut:30,fin:36,n:++r.n,nature:true};
    co.voitures[co.classement[0]].progression=co.toursTotal*c.longueur-200;p=R.tenir(r,co,C);assert.equal(p.motif,'sprint');assert(!p.nature);
    co.drapeau=31;co.horloge=31;co.voitures[0].fini=true;co.voitures[0].tempsFinal=31;p=R.tenir(r,co,C);assert.equal(p.motif,'arrivee');
   });
  }
  rapports.push(rapport);console.log(JSON.stringify(rapport));
 } finally {B.solidesPhysX.liberer(montage);world.dispose();}
}
verifier('huit circuits historiques, Route-des-Cimes distincte et aucun monde natif conservé',()=>{
 assert.deepEqual(rapports.map(r=>r.circuit),circuitsAttendus,'un circuit historique manque, a changé de place ou Cimes ne termine pas le catalogue');
 assert.equal(catalogue[8].partition,'route-des-cimes','le neuvième circuit doit utiliser la partition Cimes');
 assert.equal(signatures.size,circuitsAttendus.length,'les neuf circuits doivent conserver des plans de panorama distincts');
 assert.equal(X.status().worlds,0);
});
}finally{
 if(process.env.BITUME_CINEMA_REPORT)writeFileSync(process.env.BITUME_CINEMA_REPORT,JSON.stringify({controles,versionPhysX:X.status().version,rapports},null,2)+'\n');
}
console.log(controles+' vérifications réussies');
