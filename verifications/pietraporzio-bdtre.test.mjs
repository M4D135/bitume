import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';

const require=createRequire(import.meta.url), formes=new Map();
globalThis.FRender={forme(n,tri){if(n.startsWith('pietraporzio-'))formes.set(n,tri);}};
for(const f of ['circuit','couverts','larche-vinadio','larche-vinadio-decor','decor','solides-physx'])require('../src/'+f+'.js');
delete globalThis.FRender;
const B=globalThis.BITUME,c=B.larche.creer(210), data=B.pietraporzioData;
const ref=JSON.parse(readFileSync(new URL('../docs/references/larche-vinadio-2026/sources/bdtre-pietraporzio.json',import.meta.url)));
const aire=(a,b,c)=>((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;
function placer(qualite,neige=false) {
  const groupes=[];
  B.larcheDecor.poser(c,{terrain:{sol:(x,z)=>100+.08*(x-10400)-.07*(z-9400)},qualite,saison:{neige},ajouter(proche,loin){
    if(proche[0]?.architecture==='pietraporzio-bdtre')groupes.push({proche,loin});
  }});
  return groupes;
}
test('emprises et hauteurs retrouvées dans deux couches indépendantes, mêmes dimensions à un centimètre',()=>{
  assert.equal(data.length,8);assert.equal(new Set(data.map(f=>f.id)).size,8);
  assert.equal(ref.couches.el_str.objets.length,7);
  for(const f of data){
    const src=ref.couches.edifc.objets.find(o=>o.uuid===f.id), vol=ref.couches.un_vol.objets.find(o=>o.uuid===f.volume);
    assert.deepEqual(new Set(src.geometrie.coordinates[0].map(String)),new Set(vol.geometrie.coordinates[0].map(String)));
    assert.equal(f.h,+vol.un_vol_av);assert.equal(src.edifc_uso,f.usage);assert.ok(f.axe>=9.5&&f.axe<=35);
    const utm=src.geometrie.coordinates[0].slice(0,-1);
    // Translation commune, contrôlée indépendamment de la sérialisation des empreintes.
    for(const [e,n] of utm)assert.ok(f.cm.some(([u,v])=>Math.hypot(
      (e-332705.811-19.0431227)-(f.x+u/100),
      (4920874.595-n+521.5449683)-(f.z+v/100))<.0071));
    const a=utm.reduce((s,p,i)=>s+aire(utm[0],p,utm[(i+1)%utm.length]),0);
    const triangles=f.tri.map(t=>aire(...t.map(i=>f.cm[i]))/10000);
    assert.ok(triangles.every(t=>t>0));assert.ok(Math.abs(triangles.reduce((s,n)=>s+n,0)-Math.abs(a))<.05);
    assert.ok(!B.circuit.dansCouvert(c,f.s,35));
  }
});

test('mêmes silhouettes, couvertures, colliders et masques dans les deux qualités et les deux saisons',()=>{
  const fin=placer('high'),leger=placer('low'),hiver=placer('high',true);
  assert.equal(fin.length,8);assert.equal(formes.size,24);
  for(let i=0;i<fin.length;i++){
    const a=fin[i],b=leger[i],h=hiver[i],f=data[i];
    assert.deepEqual(a.loin.map(o=>o.partie),['mur','toit','pignons']);
    if(f.h>=5){
      const fenetres=a.proche.filter(o=>o.partie==='menuiserie');
      assert.ok(fenetres.length>0);
      if(f.s===18092||f.s===18264){
        const q=B.circuit.echantillon(c,f.s);
        assert.ok(fenetres.some(o=>-Math.sin(o.r[1])*Math.cos(q.cap)-Math.cos(o.r[1])*Math.sin(q.cap)>.6));
      }
    }
    assert.ok(a.proche.length<=64);
    assert.deepEqual(a.loin,b.loin);assert.ok(b.proche.length<=22);
    const masque=a.loin[0].trianglesMasque;assert.equal(masque.length,f.tri.length);
    assert.equal(a.loin[1].mat,24);assert.equal(h.loin[1].mat,25);
    for(let k=0;k<3;k++){
      const o=a.loin[k];for(const champ of ['p','s','r','shape'])assert.deepEqual(o[champ],h.loin[k][champ]);
      const tri=formes.get(o.shape);assert.ok(tri.length);
      const phys=o.solidePhysX.maillage;
      assert.deepEqual([...phys.vertices],Array.from(new Float32Array(tri.flatMap(t=>t.slice(0,3).flat()))));
      for(const [p,q,r,n] of tri)assert.ok(Math.abs(Math.hypot(...n)-1)<1e-8 && [...p,...q,...r].every(Number.isFinite));
    }
  }
});

test('les conifères du bâtiment public et du commerce sont écartés sur le rayon de couronne',()=>{
  assert.equal(B.pietraporzio.recouvre(10387.94,9354.18,7),true);
  assert.equal(B.pietraporzio.recouvre(10421.62,9431.09,6),true);
  assert.equal(B.pietraporzio.recouvre(11500,9440,10),false);
  let arbres=0;
  B.larcheDecor.poser(c,{terrain:{sol:()=>100},qualite:'high',saison:{id:'ete'},ajouter(proche) {
    for(const o of proche)if(o.shape.startsWith('arbre-alpin-')){
      arbres++;
      assert.equal(B.pietraporzio.recouvre(o.p[0],o.p[2],o.s[0]/2),false);
    }
  }});
  assert.ok(arbres>100);
  for(const f of data){
    const tri=f.tri[0].map(i=>f.cm[i]);
    assert.ok(B.pietraporzio.recouvre(f.x+tri.reduce((s,p)=>s+p[0],0)/300,f.z+tri.reduce((s,p)=>s+p[1],0)/300,0));
  }
});

test('PhysX WASM touche les façades et les toits triangulés et laisse une voiture passer sur chaque bord de la SS21',async()=>{
  const X=await chargerPhysX(), world=X.createWorld({fixedStep:1/120,maxSubSteps:1});
  const groupes=placer('high'), montage=B.solidesPhysX.installer(world,c,{nappes:[],lots:groupes.map(g=>({objets:g.proche}))});
  try {
    assert.equal(montage.ids.length,24);
    for(let i=0;i<data.length;i++){
      const f=data[i], g=groupes[i], r=g.loin[1], tri=formes.get(r.shape).find(t=>t[3][1]>.2);
      const p=r.p.map((v,k)=>v+r.s[k]*(tri[0][k]+tri[1][k]+tri[2][k])/3);
      const top=world.raycast([p[0],p[1]+3,p[2]],[0,-1,0],4,{mask:2,staticOnly:true});
      assert.ok(top.hit);assert.equal(top.body,montage.ids[3*i+1]);assert.ok(Math.abs(top.distance-3)<.03);
      const mur=g.loin[0], poly=f.cm;
      const j=poly.findIndex((a,k)=>Math.hypot(a[0]-poly[(k+1)%poly.length][0],a[1]-poly[(k+1)%poly.length][1])>500);
      const a=poly[j], b=poly[(j+1)%poly.length], dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=dz/l,nz=-dx/l;
      const hit=world.raycast([f.x+(a[0]+b[0])/200+nx*.4,mur.p[1],f.z+(a[1]+b[1])/200+nz*.4],[-nx,0,-nz],.8,{mask:2,staticOnly:true});
      assert.ok(hit.hit);assert.equal(hit.body,montage.ids[3*i]);assert.ok(Math.abs(hit.distance-.4)<.02);
    }
    for(let s=17900;s<=18500;s+=2){
      const q=B.circuit.echantillon(c,s);
      for(const d of [-8.3,0,8.3]) {
        const x=q.x-Math.sin(q.cap)*d,z=q.z+Math.cos(q.cap)*d;
        assert.ok(!world.raycast([x,250,z],[0,-1,0],230,{mask:2,staticOnly:true}).hit);
      }
    }
  } finally {B.solidesPhysX.liberer(montage);world.dispose();}
});
