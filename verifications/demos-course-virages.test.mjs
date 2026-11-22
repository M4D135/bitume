// Les onze tracés du menu : la réalisation doit filmer le rival qui freine depuis sa poursuivante.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const charger = createRequire(import.meta.url);
for (const f of ['circuit','route-des-cimes','larche-vinadio','marseille','virages','realisateur','cinema']) charger('../src/'+f+'.js');
const B=globalThis.BITUME, source=readFileSync(new URL('../src/jeu.js',import.meta.url),'utf8');
const catalogue=vm.runInNewContext(source.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
const cin={options:{pluie:0}};
function miseEnCourse(c,s,frein=.6,ecart=15) {
  const voitures=[0,1].map(id=>({id, tours:0, progression:200-id*ecart, etat:{s:s-id*ecart,d:0,v:33,frein:id===0?frein:0}}));
  const co={c,phase:'course',drapeau:null,horloge:25,classement:[0,1],voitures,toursTotal:3};
  const real=B.realisateur.creer(17017); real.vert=0;real.ordre=[0,1];
  real.plan={vue:'tele',sujet:0,debut:16,fin:22,motif:'tete',n:1};
  return {co,real};
}
for(const k of catalogue) test(k.id+' · freinage du rival, pluie et vues du tracé',()=>{
  const c=k.id==='larche'?B.larche.creer(k.graine):k.id==='marseille'?B.marseille.creer(k.graine):B.circuit.creer(k.graine,k);
  const virages=B.virages.planifier(c),v=virages.find(v=>v.sommet>150&&v.sommet<c.longueur-350);
  assert(v,'au moins un virage mesuré sur le tracé');
  const cinema=B.cinema.preparer(c,{nappes:[],lots:[],lieux:{marqueurs:[]}},null,null);
  assert(cinema.ancres.panorama.some(a=>virages[a.virage]?.sommet===a.s && a.label===virages[a.virage].libelle));
  if(c.ouvert)assert(cinema.ancres.panorama.every(v=>v.s<=(c.arrivee??c.longueur)));
  const {co,real}=miseEnCourse(c,v.sommet-35),p=B.realisateur.tenir(real,co,cin);
  assert.equal(p.motif,'freinage');assert.equal(p.sujet,1);assert.equal(p.rival,0);assert.equal(p.vue,'cockpit');
  assert.equal(p.label,virages[p.virage].libelle);assert.equal(B.realisateur.vitesse(real),1);
  const echange=miseEnCourse(c,v.sommet-35);
  const premier=echange.co.voitures[0], second=echange.co.voitures[1];
  echange.co.voitures=[{...second,id:0},{...premier,id:1}];echange.co.classement=[1,0];echange.real.ordre=[1,0];
  const inverse=B.realisateur.tenir(echange.real,echange.co,cin);
  assert.equal(inverse.sujet,0);assert.equal(inverse.rival,1);assert.equal(inverse.motif,'freinage');
  co.horloge=p.fin+.1;assert.notEqual(B.realisateur.tenir(real,co,cin).motif,'freinage','délai entre deux freinages filmés');
  for(const changer of [s=>{s.voitures[0].etat.frein=0},s=>{s.voitures[0].etat.stands={}},s=>{s.voitures[0].abandon=true},s=>{s.voitures[1].etat.v=3},s=>{s.voitures[1].progression-=45}]){
    const t=miseEnCourse(c,v.sommet-35);changer(t.co);assert.notEqual(B.realisateur.tenir(t.real,t.co,cin).motif,'freinage');
  }
  const pl=miseEnCourse(c,v.sommet-35,0),m=B.realisateur.tenir(pl.real,pl.co,{options:{pluie:.75}});
  assert.equal(m.motif,'pluie');assert.equal(m.vue,'cockpit');
  const sec=miseEnCourse(c,v.sommet-35,0);assert.notEqual(B.realisateur.tenir(sec.real,sec.co,cin).motif,'pluie');
  const spots=[{s:10,type:'lieu'}, {s:c.longueur*.5,type:'lieu'}, {s:c.longueur-15,type:'lieu'}];
  const C={c,ancres:{lieu:spots},trajets:new Map(spots.map(a=>[a,[true,true]]))};
  assert.equal(B.cinema.choisir(C,'lieu',0,80,c.longueur*.5-10),spots[1]);
  assert.equal(B.cinema.choisir(C,'lieu',0,80,c.longueur-5),spots[2]);
  assert.equal(B.cinema.choisir(C,'lieu',2,80),spots[2],'sélection libre du prologue');
  assert.equal(B.cinema.choisir(C,'lieu',0,80,c.longueur*.25),null);
});
