import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), formes = new Map();
globalThis.FRender = { forme(nom, triangles) { assert(!formes.has(nom)); formes.set(nom, triangles); } };
require('../src/aurores.js');
const A = globalThis.BITUME.aurores;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const circuit = { theme: 'islande', graine: 83, x: [-850, 850, 600, -600], z: [-650, 650, -600, 600], y: [0, 30, -15, 20] };
const ctx = (autre = {}) => ({ nuit: 1, pluie: 0, neige: 0, nuages: 0, qualite: 'high', vue: 0, ...autre });
function dessiner(e, temps = 12, c = ctx()) { const objets = []; const stats = A.dessiner(e, temps, c, objets); return { objets, stats }; }
const snapshot = objets => objets.map(o => ({ ...o, p: o.p.slice(), s: o.s.slice(), r: o.r.slice(), color: o.color.slice() }));

verifier('formes finies, doubles faces, dans le cube unité et sans triangles dégénérés', () => {
  assert.equal(formes.size, 6);
  for (const triangles of formes.values()) for (let i = 0; i < triangles.length; i += 2) {
    const face = triangles[i], retour = triangles[i + 1];
    assert.deepEqual(retour.slice(0, 3), [face[0], face[2], face[1]]);
    for (const p of face.slice(0, 3)) for (const n of p) assert(Number.isFinite(n) && Math.abs(n) <= .5);
    for (const n of face.slice(3)) assert(Math.abs(Math.hypot(...n) - 1) < 1e-10);
    const a = face[0], b = face[1], c = face[2], ab = b.map((v, k) => v - a[k]), ac = c.map((v, k) => v - a[k]);
    assert(Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]) > 1e-8);
  }
});
verifier('Islande uniquement, nuit et ciel dégagé ; pluie/neige/nuages atténuent, tunnels masquent', () => {
  for (const theme of ['foret', 'cote', 'montagne', undefined]) assert.equal(dessiner(A.creer({ ...circuit, theme })).objets.length, 0);
  const e = A.creer(circuit), clair = dessiner(e).stats.intensite;
  assert.equal(dessiner(e, 12, ctx({ nuit: 0 })).objets.length, 0);
  assert.equal(dessiner(e, 12, ctx({ nuit: .45 })).objets.length, 0);
  assert.equal(dessiner(e, 12, ctx({ tunnel: true })).objets.length, 0);
  assert.equal(dessiner(e, 12, ctx({ nuages: 1 })).objets.length, 0);
  for (const conditions of [{ pluie: .8 }, { neige: .8 }, { nuages: .6 }]) {
    const image = dessiner(e, 12, ctx(conditions)); assert(image.stats.intensite > 0 && image.stats.intensite < clair * .7);
  }
  const faible = dessiner(e, 12, ctx({ nuit: .52 })).stats.intensite;
  assert(faible > 0 && faible < clair * .1);
});
verifier('rubans déterministes dans le monde, sans hasard de simulation ni dépendance à la caméra', () => {
  const alea = Math.random; let a, b;
  try { Math.random = () => { throw Error('hasard global interdit'); }; a = A.creer(circuit); b = A.creer(circuit); }
  finally { Math.random = alea; }
  const image = snapshot(dessiner(a).objets);
  assert.deepEqual(image, snapshot(dessiner(b, 12, ctx({ vue: 1, pose: { x: 700, y: 50, z: -500 } })).objets));
  assert.notDeepEqual(image, snapshot(dessiner(a, 48).objets));
  assert.deepEqual(image, snapshot(dessiner(a, 12).objets));
  assert.notDeepEqual(image, snapshot(dessiner(A.creer({ ...circuit, graine: 84 })).objets));
});
verifier('géométrie au-dessus du terrain, sans collision ni overlay, dans le plan lointain de 6000 m', () => {
  const e = A.creer(circuit);
  for (const temps of [0, 20, 80, 160, 360]) for (const o of dessiner(e, temps).objets) {
    assert.equal(o.overlay, false); assert.equal(o.fx, true); assert.equal(o.outdoor, true); assert.equal(o.collision, undefined);
    assert(o.emissive >= 4 && o.alpha > 0 && o.alpha < .4);
    const ca = Math.cos(o.r[1]), sa = Math.sin(o.r[1]);
    for (const triangle of formes.get(o.shape)) for (const p of triangle.slice(0, 3)) {
      const x = o.p[0] + p[0] * o.s[0] * ca + p[2] * o.s[2] * sa;
      const y = o.p[1] + p[1] * o.s[1];
      const z = o.p[2] - p[0] * o.s[0] * sa + p[2] * o.s[2] * ca;
      assert(y > 400);
      for (let i = 0; i < circuit.x.length; i++) assert(Math.hypot(x - circuit.x[i], y - circuit.y[i], z - circuit.z[i]) < 6000);
    }
  }
});
verifier('budgets qualité bornés et pools réutilisés sans mutation croisée des deux vues', () => {
  const e = A.creer(circuit), objets = e.vues.map(v => v.objets.slice());
  const poseJ1 = snapshot(dessiner(e, 1, ctx({ vue: 0 })).objets);
  dessiner(e, 2, ctx({ vue: 1 })); assert.deepEqual(poseJ1, snapshot(e.vues[0].objets));
  for (let frame = 0; frame < 600; frame++) for (const qualite of ['off', 'low', 'medium', 'high', 'ultra']) {
    const image = dessiner(e, frame / 30, ctx({ qualite, vue: frame % 2 }));
    assert.equal(image.stats.rubans, A.BUDGETS[qualite]); assert(image.objets.length <= A.MAX_OBJETS);
    assert(image.stats.triangles <= 3456);
    for (const o of image.objets) {
      assert(objets[frame % 2].includes(o));
      for (const n of [...o.p, ...o.s, ...o.r, ...o.color, o.alpha]) assert(Number.isFinite(n));
    }
  }
  assert.deepEqual(e.vues.map(v => v.objets.length), [18, 18]);
});
console.log(`${controles} contrôles des aurores réussis`);
