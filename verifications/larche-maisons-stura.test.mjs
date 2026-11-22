import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url), formes = new Map();
globalThis.FRender = { forme(nom, triangles) { if (nom.startsWith('stura-')) formes.set(nom, triangles); } };
for (const f of ['circuit', 'couverts', 'larche-vinadio-data', 'larche-vinadio', 'larche-vinadio-decor', 'decor']) require('../src/' + f + '.js');
delete globalThis.FRender;
const B = globalThis.BITUME, c = B.larche.creer(210);
const terrain = { sol: (x,z) => 380 + x*.025 - z*.035 };
const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function villages(qualite, neige = false) {
  const maisons = [];
  B.larcheDecor.poser(c, { terrain, qualite, saison:{ id: neige ? 'hiver' : 'ete', neige }, ajouter(proche,loin) {
    if (proche[0]?.architecture === 'haute-stura') maisons.push({proche,loin});
  } });
  return maisons;
}

test('pans, pignons et feuillures instanciés, normales orientées et 42 triangles partagés', () => {
  assert.deepEqual([...formes.values()].map(t => t.length), [20,2,20]);
  for (const triangles of formes.values()) for (const [a,b,c,n,m,k] of triangles) {
    for (const p of [a,b,c]) assert.ok(p.every(v => Number.isFinite(v) && Math.abs(v) <= .5));
    const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
    const croix=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(croix.reduce((s,x,i)=>s+x*n[i],0)>1e-6);
    assert.ok(Math.abs(Math.hypot(...n)-1)<1e-10); assert.equal(m,n); assert.equal(k,n);
  }
  const couv = formes.get('stura-couverture');
  assert.ok(couv.some(t=>t[3][1]>.3 && t[3][2]>.5)); assert.ok(couv.some(t=>t[3][1]>.3 && t[3][2]<-.5));
});

test('les solides de la .111 et ses empreintes de végétation restent aux mêmes coordonnées', () => {
  // Témoins indépendants des anciens couples cube/biseau, classements de la route et sol de test inchangés.
  for (const [qualite,nb,solides,emprises] of [
    ['low',12,'e0d27c73dadb3881f093309f99fb630e24446da011f52231ec614a4c684ed67c','e93cac7ddaca95b2a3ab6962e183fe996ee33919747fcd8a20f800ad80195846'],
    ['high',30,'1e5d00a3941883f277cd5e8fbdf57fc6ba1e16ed4bb0dad4e92b7534c3899d32','985af94aa645ec79d3e4db4ec8d94ce790885cd2104fd186cef7b11c1850de36']
  ]) {
    const maisons=villages(qualite); assert.equal(maisons.length,nb);
    const murs=maisons.flatMap(g=>g.proche.filter(o=>o.solidePhysX)).map(o=>({shape:o.shape,p:o.p,s:o.s,r:o.r,solide:o.solidePhysX}));
    assert.equal(murs.length,nb); assert.equal(sha(murs),solides);
    assert.equal(sha(maisons.map(g=>g.proche.filter(o=>o.masqueHerbier||Math.floor(o.mat+.01)===23)
      .map(o=>[o.p[0],o.p[2],o.s[0],o.s[2],o.r[1]]))),emprises);
    for(const g of maisons) {
      assert.deepEqual(g.loin.map(o=>o.partie),['mur','toit','pignons','cheminee']);
      assert.ok(g.proche.length<=38); assert.ok(g.proche.some(o=>o.partie==='menuiserie'));
      assert.ok(g.loin.every(o=>g.proche.includes(o)));
      assert.ok(g.proche.filter(o=>o.partie==='vitrage').every(o=>o.mat===19.1));
    }
    assert.ok(new Set(maisons.map(g=>String(g.proche[0].color))).size>=3);
  }
});

test('la neige couvre les pans en hiver sur les mêmes toits', () => {
  const toits=neige=>villages('high',neige).map(g=>g.loin.find(o=>o.partie==='toit'));
  const ete=toits(false),hiver=toits(true);
  for(let i=0;i<ete.length;i++) {
    assert.equal(ete[i].mat,24);assert.equal(hiver[i].mat,25);
    for(const cle of ['shape','s','p','r']) assert.deepEqual(ete[i][cle],hiver[i][cle]);
  }
});
