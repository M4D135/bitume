import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
for(const f of ['circuit','couverts','larche-vinadio-data','larche-vinadio','larche-relief','larche-vinadio-decor'])require('../src/'+f+'.js');
const B=globalThis.BITUME;

test('Larche : même terrain physique et coloré, toutes les mailles à 420 m de la route restent dans la découpe',()=>{
  const c=B.larche.creer(210);
  const terrain=corridor=>B.larcheDecor.terrain(c,null,null,{corridor}).liste;
  const avant=terrain(false), apres=terrain(true),suivies=new Map();
  let actives=0,total=0;
  assert.equal(apres.length,avant.length);
  for(let i=0;i<avant.length;i++){
    const a=avant[i],b=apres[i];
    assert.deepEqual(b.indices,a.indices);assert.deepEqual(b.sommets,a.sommets);
    assert.deepEqual(b.herbeTriangles,a.herbeTriangles);
    total+=b.indices.length/3;actives+=b.cellulesHerbier?.length??b.indices.length/3;
    if(b.surfaceType==='panorama'){assert.equal(b.cellulesHerbier.length,0); continue;}
    if(b.surfaceType!=='terrain')continue;
    const x=b.sommets[0]/32,z=b.sommets[2]/32, offsets=new Set(b.cellulesHerbier);
    for(let k=0;k<8;k++)for(let j=0;j<8;j++){
      const off=(k*8+j)*6;
      suivies.set((x+j)+','+(z+k),!b.cellulesHerbier||offsets.has(off)&&offsets.has(off+3));
    }
  }
  assert.ok(actives<total*.8,`${actives} / ${total} triangles`);
  // Oracle géométrique indépendant du voisin le plus proche de la grille de génération.
  for(let i=0;i<c.n;i++){
    const x=c.x[i],z=c.z[i];
    for(let k=Math.floor((z-420)/32);k<=Math.floor((z+420)/32);k++)for(let j=Math.floor((x-420)/32);j<=Math.floor((x+420)/32);j++){
      const dx=Math.max(0,j*32-x,x-(j+1)*32),dz=Math.max(0,k*32-z,z-(k+1)*32);
      if(dx*dx+dz*dz<=420**2)assert.equal(suivies.get(j+','+k),true);
    }
  }
});
