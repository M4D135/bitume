import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const enregistrees = new Map();
globalThis.FRender = { forme(nom, triangles) { if (nom.startsWith('arbre-alpin-')) enregistrees.set(nom, triangles); } };
for (const f of ['circuit', 'couverts', 'larche-vinadio-data', 'larche-vinadio', 'larche-vinadio-decor']) require('../src/' + f + '.js');
delete globalThis.FRender;
const B = globalThis.BITUME;
const A = B.coniferesAlpins;

test('formes instanciables fermées, normales et budget dans chaque niveau', () => {
  assert.equal(enregistrees.size, 9);
  for (const [espece, max] of [
    ['sapin', [5158, 1238, 410]], ['meleze', [2634, 698, 286]], ['meleze-nu', [2634, 698, 286]]
  ]) {
    const boites = [];
    for (const [i, detail] of ['proche', 'leger', 'loin'].entries()) {
      const tri = enregistrees.get(A.nom(espece, detail));
      assert.ok(tri.length <= max[i], espece + '/' + detail + ': ' + tri.length);
      const min = [1,1,1], maxCoord = [-1,-1,-1];
      for (const [a,b,c,...normales] of tri) {
        const u = b.map((val,k) => val-a[k]), v = c.map((val,k) => val-a[k]);
        const croix = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        assert.ok(Math.hypot(...croix) > 1e-10);
        for (const n of normales) {
          assert.ok(Math.abs(Math.hypot(...n)-1) < 1e-9);
          assert.ok(n.reduce((s,x,k) => s+x*croix[k],0) > 0);
        }
        for (const p of [a,b,c]) p.forEach((v,k) => {
          assert.ok(v>=-.5 && v<=.5); min[k]=Math.min(min[k],v);maxCoord[k]=Math.max(maxCoord[k],v);
        });
      }
      boites.push([...min, ...maxCoord]);
      assert.equal(min[1], -.5); assert.equal(maxCoord[1], .5);
    }
    for (const boite of boites.slice(1)) boite.forEach((v,k) => assert.ok(Math.abs(v-boites[0][k])<.025));
  }
});

test('le mélèze dénudé reste au plus au budget feuillé à tous les niveaux', () => {
  for (const detail of ['proche', 'leger', 'loin']) {
    assert.ok(enregistrees.get(A.nom('meleze-nu',detail)).length <= enregistrees.get(A.nom('meleze',detail)).length);
  }
});

test('la pose garde les mêmes arbres et les mêmes appuis de l’été à l’hiver', () => {
  const c = B.larche.creer(210);
  const terrain = { sol: (x,z) => 380+x*.025-z*.035 };
  function relever(id) {
    const arbres=[];
    B.larcheDecor.poser(c, { terrain, qualite:'low', saison:{id}, ajouter(objets,loin) {
      const couronne = objets.find(o => o.shape.startsWith('arbre-alpin-'));
      if (!couronne) return;
      assert.equal(objets.length,2); assert.equal(loin.length,1);
      const l=loin[0];
      assert.deepEqual(couronne.p,l.p);assert.deepEqual(couronne.r,l.r);assert.deepEqual(couronne.s,l.s);
      assert.ok(enregistrees.has(couronne.shape) && enregistrees.has(l.shape));
      assert.ok(l.p[1]-l.s[1]*.5 <= terrain.sol(l.p[0],l.p[2]));
      arbres.push(couronne);
    } });
    return arbres;
  }
  const ete=relever('ete'), hiver=relever('hiver'), automne=relever('automne');
  assert.equal(ete.length,hiver.length);assert.equal(ete.length,automne.length);
  assert.ok(ete.some(o=>o.shape.includes('meleze')) && ete.some(o=>o.shape.includes('sapin')));
  ete.forEach((e,i)=>{
    const h=hiver[i], a=automne[i], meleze=e.shape.includes('meleze');
    assert.deepEqual(e.p,h.p);assert.deepEqual(e.s,h.s);assert.deepEqual(e.r,h.r);
    assert.deepEqual(e.p,a.p);assert.equal(e.mat,27);assert.equal(a.mat,27);
    assert.equal(h.mat,meleze ? 26 : 27);assert.equal(h.shape.includes('nu'),meleze);
    if (meleze) assert.ok(a.color[0]>a.color[1] && e.color[0]<e.color[1]);
    else assert.deepEqual(a.color,e.color);
  });
});
