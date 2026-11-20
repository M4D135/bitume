// Contrôles indépendants du test de pénétration, avec solides de dimensions connues.
import assert from 'node:assert/strict';
import {surface,interieur,mesurerContacts,distanceSurface} from '../tools/qualification/pilote-surfaces.mjs';
function cube(centre=[0,0,0],r=.1){
 const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>p.map((x,k)=>centre[k]+x*r));
 return [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,4,7],[0,7,3],[1,2,6],[1,6,5],[0,1,5],[0,5,4],[3,7,6],[3,6,2]].map(t=>t.map(i=>v[i]));
}
let n=0;const verifier=(nom,f)=>{f();n++;console.log('ok '+nom);};
const thorax=surface(cube(),{fermee:true});
verifier('la fermeture et le volume d’un solide connu sont établis',()=>{
 assert.equal(thorax.topologie.aretesOuvertes,0);assert.equal(thorax.topologie.euler,2);assert(Math.abs(thorax.topologie.volumeM3-.008)<1e-12);
 assert(interieur([0,0,0],thorax));assert(!interieur([.101,0,0],thorax));assert(Math.abs(distanceSurface([0,0,0],thorax)-.1)<1e-12);
});
verifier('une surface ouverte ne fournit jamais de preuve d’intérieur',()=>{
 const ouvert=surface(cube().slice(1));assert.throws(()=>interieur([0,0,0],ouvert),/ouverte/);assert.throws(()=>surface(cube().slice(1),{fermee:true}),/non valide/);
});
verifier('un membre entièrement inclus est refusé sans intersection de surface',()=>{
 const c=mesurerContacts(cube([0,0,0],.02),thorax);assert.equal(c.croisement,false);assert.equal(c.entierementContenu,true);assert.equal(c.horsAttache,true);
});
verifier('un assemblage partiellement inclus n’est pas annoncé entièrement contenu',()=>{
 const c=mesurerContacts([...cube([0,0,0],.02),...cube([.3,0,0],.02)],thorax);
 assert(!c.croisement);assert(!c.entierementContenu);assert(c.horsAttache);assert(c.interieurHorsAttache);
});
verifier('un membre qui traverse la peau est détecté et un membre distant passe',()=>{
 const c=mesurerContacts(cube([.095,.05,0],.02),thorax);assert(c.croisement);assert(c.horsAttache);assert(!c.entierementContenu);
 const d=mesurerContacts(cube([.2,0,0],.02),thorax);assert(!d.croisement&&!d.entierementContenu&&!d.horsAttache);
});
verifier('l’attache autorise seulement la petite jonction locale',()=>{
 const a={epaule:[.1,0,0],rayonAttache:.035};const c=mesurerContacts(cube([.095,0,0],.015),thorax,a);assert(c.croisement);assert(!c.horsAttache);
 const d=mesurerContacts(cube([.095,.05,0],.02),thorax,a);assert(d.horsAttache);
});
verifier('un centre proche de l’épaule ne masque pas un objet entièrement inclus trop grand',()=>{
 const a={epaule:[0,0,0],rayonAttache:.035};assert(!mesurerContacts(cube([0,0,0],.01),thorax,a).horsAttache);
 const c=mesurerContacts(cube([0,0,0],.025),thorax,a);assert(c.entierementContenu);assert(c.horsAttache);
});
verifier('un membre qui entre par l’attache puis reste enfoui est refusé',()=>{
 // Entrée x=.1 dans la boule de 3.5 cm, extrémité x=0 au milieu du thorax.
 const membre=cube([0,0,0],1).map(t=>t.map(p=>[.055+p[0]*.055,p[1]*.008,p[2]*.008]));
 const c=mesurerContacts(membre,thorax,{epaule:[.1,0,0],rayonAttache:.035});
 assert(c.croisement);assert.equal(c.pointsHorsAttache.length,0);assert(c.interieurHorsAttache);assert(c.horsAttache);
});
verifier('les tangences et recouvrements coplanaires sont des contacts explicites',()=>{
 const plan=surface([[[-.1,0,-.1],[.1,0,-.1],[0,0,.1]]]);
 const recouvre=[[[-.08,0,.05],[.08,0,.05],[0,0,-.15]]];
 const c=mesurerContacts(recouvre,plan);assert(c.croisement);assert(c.horsAttache);assert(c.points.length>=2);
 const tangent=cube([.2,0,0]);const t=mesurerContacts(tangent,thorax);assert(t.croisement);assert(t.horsAttache);
 const d=mesurerContacts(recouvre.map(t=>t.map(p=>[p[0],p[1]+1e-5,p[2]])),plan);assert(!d.croisement&&!d.horsAttache);
});
verifier('une zone d’attache excessive ou sans centre est refusée',()=>{
 assert.throws(()=>mesurerContacts(cube(),thorax,{epaule:[0,0,0],rayonAttache:.1}),/hors borne/);
 assert.throws(()=>mesurerContacts(cube(),thorax,{rayonAttache:.03}),/centre explicite/);
 assert.throws(()=>mesurerContacts(cube(),thorax,{epaule:[0,0,0],rayonAttache:NaN}),/hors borne/);
 assert.throws(()=>mesurerContacts(cube(),thorax,{epaule:[NaN,0,0],rayonAttache:.03}),/invalide/);
});
console.log(n+' contrôles surfaces pilote conformes');
