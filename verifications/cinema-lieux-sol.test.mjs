// Les anciens gros plans animaliers sont remplacés par les vrais lieux (décision du 21 novembre).
// Rayons indépendants depuis la caméra et contrôle du sol en été/hiver sur Haut-Col.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['moteur/renderer','circuit','couverts','conduite','carene','ecologie','saisons','botanique','vegetation','bords','batiments','lieux','decor','obstacles','solides-physx','cinema']) require('../src/'+f+'.js');
const B=globalThis.BITUME,C=B.cinema,X=await chargerPhysX();
let controles=0,postes=0,sondes=0;
const verifier=(nom,f)=>{f();controles++;console.log('ok '+nom);};
for(const saison of ['ete','hiver']){
 const c=B.circuit.creer(47,{theme:'montagne',longueur:5200}); B.bords.limites(c,B.bords.planifier(c));
 const decor=B.decor.construire(c,{qualite:'high',vegetationQualite:'high',organique:true,solsProceduraux:true,saison});
 const world=X.createWorld({fixedStep:1/120,maxSubSteps:1}),montage=B.solidesPhysX.installer(world,c,decor);
 try{
  const cin=C.preparer(c,decor,null,world),poses=[B.circuit.echantillon(c,200)];
  const a=C.choisir(cin,'lieu',0,0);assert(a);assert.equal(a.marqueur,decor.lieux.marqueurs[0]);
  verifier(saison+' : lieu réel et caméra au-dessus du terrain pendant le plan complet',()=>{
   for(const cote of [-1,1]){
    const plan={vue:'lieu',ancre:a,sujet:0,debut:0,fin:6,cote,nature:true};
    for(let i=0;i<=60;i++){
     const t=i/10,cam=C.camera(cin,plan,poses,{},t);assert(cam);
     const direction=cam.cible.map((v,k)=>v-cam.pos[k]),distance=Math.hypot(...direction);
     const hit=world.raycast(cam.pos,direction.map(v=>v/distance),distance-.17,{mask:3,staticOnly:true});
     assert(!hit.hit,'une paroi masque le lieu');
     const sol=world.raycast([cam.pos[0],cin.maxY+200,cam.pos[2]],[0,-1,0],cin.maxY-cin.minY+400,{mask:1,staticOnly:true});
     if(sol.hit)assert(cam.pos[1]>=sol.y+.38,'caméra sous les triangles du terrain');
     assert(C.valider(cin,cam,cam.cible,plan,t,16/9));sondes+=2;
    }
    postes++;
   }
  });
  verifier(saison+' : un masque interrompt le plan, sans déplacement de caméra inventé',()=>{
   const plan={vue:'lieu',ancre:a,sujet:0,debut:0,fin:6,cote:1,nature:true};
   const cam=C.camera(cin,plan,poses,{},0),trajets=cin.trajets.get(a),milieu=cam.pos.map((v,k)=>(v+cam.cible[k])/2);
   const id=world.addBox(milieu,[2,2,2],{type:'static',group:2,queryGroup:2});
   try{assert.equal(C.camera(cin,plan,poses,{},0),null,'paroi ignorée');assert.strictEqual(cin.trajets.get(a),trajets,'trajectoire déplacée pour contourner le refus');}
   finally{world.remove(id);}
   assert.deepEqual(C.camera(cin,plan,poses,{},0),cam,'le masque a changé le poste de prise de vue');
  });
 }finally{B.solidesPhysX.liberer(montage);world.dispose();}
}
assert.equal(postes,4);assert.equal(sondes,488);assert.equal(X.status().worlds,0);
console.log(controles+' contrôles réussis, '+postes+' trajectoires et '+sondes+' rayons indépendants');
