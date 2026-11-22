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

test('les cinq villages synthétiques conservent leurs solides et empreintes antérieurs', () => {
  // Témoin .115 après exclusion du quatrième groupe, Pietraporzio, désormais fondé sur la BDTRE.
  for (const [qualite,nb,solides,emprises] of [
    ['low',10,'31f03e133a85ae62aec0a5c44897cddb9193f41d7ea5f1fdab3c462a6ff7e8ea','830298a8ebdee914713305cee5ff828e9548c62002de62b998db22727f60cc14'],
    ['high',25,'9eaa15a82745141a81f67bd5d6d4b0d2ad57eb54a18f1e37f1064f43c7f25b52','27faa3d3c759ca3f157555711e869c354664d1e9d3c38e40072d832101330929']
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
