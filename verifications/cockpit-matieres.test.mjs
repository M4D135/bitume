// L'adaptateur doit changer la réponse des surfaces, jamais la géométrie ou
// l'animation. La même suite couvre le repli 0.3.14 et les recettes FERRO opt-in.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const renderer=process.env.FERRO_RENDERER||path.join(root,'src/moteur/renderer.js');
function charger(adapter=true,moteur=true){
  const c=vm.createContext({console});vm.runInContext('globalThis.window=globalThis;',c);
  if(moteur)vm.runInContext(readFileSync(renderer,'utf8'),c,{filename:renderer});
  const files=['carene.js','main.js','humain-donnees.js','humain-corps.js','ferro/vehicle-dynamics.js',
    'pneus.js','usure-pneus.js','conduite.js',...(adapter?['cockpit-matieres.js']:[]),'voiture.js'];
  for(const file of files)vm.runInContext(readFileSync(path.join(root,'src',file),'utf8'),c,{filename:file});
  return c;
}
const reference=charger(false),candidat=charger(),V=candidat.BITUME.voiture,A=candidat.BITUME.cockpitMatieres;
const livres=[{couleur:[.82,.12,.08],combinaison:[.88,.84,.72],numero:27},
  {couleur:[.94,.93,.86],combinaison:[.12,.18,.34],numero:3}];
const json=x=>JSON.parse(JSON.stringify(x));
const sansMatiere=o=>Object.fromEntries(Object.entries(o).filter(([k])=>k!=='mat'));
const empreinte=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pose=i=>({p:[i*31,i*.02,-i*13],cap:i*.31,tangage:Math.sin(i)*.15,roulis:Math.cos(i)*.09,
  braquage:Math.sin(i)*.45,roule:i*8,v:i*7,pilote:{volant:Math.sin(i),rapport:1+i%6,
    rapportAvant:Math.max(1,i%6),passage:(i%7)/6}});

test('formes et dimensions inchangées, y compris gants, jante et instruments',()=>{
  assert.equal(empreinte(V.FORMES),empreinte(reference.BITUME.voiture.FORMES));
  for(const livre of livres){
    const a=reference.BITUME.voiture.modele(livre),b=V.modele(livre);
    for(const key of ['corps','simples','moyens','epave'])
      assert.deepEqual(json(b[key].map(sansMatiere)),json(a[key].map(sansMatiere)),key);
  }
});

test('cuir, tissu, métal brossé et peinture restent distincts dans les objets rendus',()=>{
  const m=V.modele(livres[0]),h=m.objetsRendu.habitacle;
  assert.equal(A.cuir,candidat.FRender.materials.fineLeather??7);
  assert.equal(A.tissu,candidat.FRender.materials.wovenFabric??18);
  assert.equal(h.planche[0].objet.mat,A.cuir);assert.equal(h.jante.objet.mat,A.cuir);
  assert.equal(h.branches.objet.mat,0);assert.equal(h.tige.objet.mat,0);assert.equal(h.pommeau.objet.mat,0);
  for(const main of h.mains){
    main.pieces.forEach((piece,i)=>assert.equal(piece.objet.mat,i===1||i===2?A.cuir:A.tissu));
    for(const piece of [...main.tubes,...main.boules])assert.equal(piece.objet.mat,A.tissu);
  }
  for(const variant of m.objetsRendu.pilote.variantes){
    const pieces=variant.pieces;
    assert.equal(pieces.find(p=>p.role==='volant').objet.mat,A.cuir);
    for(const piece of pieces)if(/^(bras-|avant-bras-|coude-|buste$)/.test(piece.role))assert.equal(piece.objet.mat,A.tissu);
  }
  const capot=m.corps.find(p=>p.shape===V.FORMES.fleche.nom);
  const casque=m.corps.find(p=>p.shape===V.FORMES['pilote-casque'].nom);
  assert.equal(capot.mat,17);assert.equal(casque.mat,16);
});

test('toutes les poses et enveloppes sont identiques avant/après, cockpit et trois LOD',()=>{
  let changed=0,poses=0;
  for(const livre of livres){
    const a=reference.BITUME.voiture.modele(livre),b=V.modele(livre);
    for(let i=0;i<14;i++)for(const option of [{detail:'complet'},{detail:'moyen'},{detail:'simple'},'cockpit']){
      const p=pose(i),initial=JSON.stringify(p),aa=[],bb=[];
      if(option==='cockpit'){
        const state={...p.pilote,regime:8000,kmh:120};
        reference.BITUME.voiture.cockpit(a,p,aa,state);V.cockpit(b,p,bb,state);
      }else{reference.BITUME.voiture.poser(a,p,aa,option);V.poser(b,p,bb,option);}
      assert.equal(JSON.stringify(p),initial,'animation modifie la simulation');
      assert.equal(bb.length,aa.length);poses++;
      for(let n=0;n<bb.length;n++){
        assert.deepEqual(json(sansMatiere(bb[n])),json(sansMatiere(aa[n])),`pose ${i}, objet ${n}`);
        if(bb[n].mat!==aa[n].mat)changed++;
      }
    }
  }
  assert.equal(poses,112);assert(changed>112,'adaptateur absent du rendu');
});

test('le repli sans moteur garde les mêmes maillages et ne crée rien pendant une pose',()=>{
  const c=charger(true,false),v=c.BITUME.voiture,a=c.BITUME.cockpitMatieres;
  assert.equal(a.cuir,7);assert.equal(a.tissu,18);
  const m=v.modele(livres[0]),p=pose(4),first=[],second=[];
  v.cockpit(m,p,first,p.pilote);v.cockpit(m,pose(5),second,pose(5).pilote);
  assert.equal(first.length,second.length);
  for(let i=0;i<first.length;i++)assert.equal(first[i],second[i],'nouvel objet à chaque image');
});
