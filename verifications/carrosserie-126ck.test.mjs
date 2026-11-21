// Qualification des vraies peaux, indépendante des sections de fabrication.
// La référence est visuelle : ces contrôles n'affirment pas des cotes Ferrari.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = vm.createContext({ console });
for (const f of ['carene.js','main.js','ferro/vehicle-dynamics.js','pneus.js','usure-pneus.js','conduite.js','voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(root,'src',f),'utf8'),c,{filename:f});
const V = c.BITUME.voiture;
const mesh = name => { const f=V.FORMES[name]; return f.tri.map(t=>t.slice(0,3).map(p=>p.map((v,k)=>v*f.taille[k]+f.centre[k]))); };
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function hit(a,b,t){
 const d=sub(b,a),u=sub(t[1],t[0]),v=sub(t[2],t[0]),h=cross(d,v),det=dot(u,h);
 if(Math.abs(det)<1e-12)return false;
 const s=sub(a,t[0]),x=dot(s,h)/det;if(x<0||x>1)return false;
 const q=cross(s,u),y=dot(d,q)/det;if(y<0||x+y>1)return false;
 const f=dot(v,q)/det;return f>=0&&f<=1;
}
test('deux prises réellement ouvertes avec fond en retrait, proche et lointain',()=>{
 const fond=mesh('pontons-conduits');
 for(const nom of ['pontons','loin-caisse']){
  const peau=mesh(nom);
  for(const k of [-1,1])for(const y of [.225,.26,.285])for(const z of [.38,.49,.60]){
   const a=[1.01,y,k*z],b=[.78,y,k*z];
   assert(!peau.some(t=>hit(a,b,t)),`ouverture libre ${nom} ${k} ${y} ${z}`);
   assert(fond.some(t=>hit(a,[.755,y,k*z],t)),`radiateur en retrait ${k} ${y} ${z}`);
  }
 }
});
test('les pontons conservent leur lèvre et leur dessus autour des ouvertures',()=>{
 const peau=mesh('pontons');
 for(const k of [-1,1]){
  assert(peau.some(t=>hit([1.04,.390,k*.49],[.90,.390,k*.49],t)),'lèvre haute réelle');
  assert(peau.some(t=>hit([.88,.50,k*.49],[.88,.35,k*.49],t)),'plateau continu');
 }
});
test('le nez et les pontons restent hors du volume balayé des pneus avant',()=>{
 const tris=['fleche','pontons','pontons-conduits','loin-caisse'].flatMap(mesh);
 let echantillons=0;
 for(const d of [-.60,-.35,0,.35,.60])for(let i=0;i<2;i++){
  const w=V.ROUES[i],a=V.braquages(d)[i],co=Math.cos(a),si=Math.sin(a);
  for(const t of tris)for(const p of [...t,t[0].map((_,k)=>(t[0][k]+t[1][k]+t[2][k])/3)]){
   const dx=p[0]-w.x,dz=p[2]-w.z,x=dx*co+dz*si,z=-dx*si+dz*co;
   const distance=Math.hypot(Math.max(0,Math.hypot(x,p[1]-w.r)-w.r),Math.max(0,Math.abs(z)-w.l/2));
   assert(distance>.015,`carrosserie dans la marge de pneu: ${distance}, braquage ${d}, roue ${i}, point ${p}`);
   echantillons++;
  }
 }
 console.log(`${echantillons} échantillons sommet/centre : marge minimale exigée 15 mm`);
});
test('les trois détails rendent la même entrée, grilles détaillées seulement près',()=>{
 const mod=V.modele({couleur:[.8,.1,.1],numero:27});
 const ev={p:[0,0,0],cap:0,tangage:0,roulis:0,braquage:0,roule:0,v:0};
 for(const detail of ['complet','moyen','simple']){
  const out=[];V.poser(mod,ev,out,{detail});
  assert(out.some(o=>o.shape==='bitume-pontons-conduits'),`conduit ${detail}`);
  assert.equal(out.some(o=>o.shape==='bitume-pontons-radiateurs'),detail==='complet');
  for(const o of out)for(const p of ['p','s','r'])assert(o[p].every(Number.isFinite),`${detail} ${o.shape} ${p}`);
 }
});
