// Arbres procéduraux des trois essences : géométrie tenue dans le cube, coûts croissants, organes conservés au loin.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
require('../src/botanique.js');
const B = globalThis.BITUME, A = B.botanique;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const sous = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const empreinte = tri => createHash('sha256').update(JSON.stringify(tri)).digest('hex');
const COMBOS = [];
for (const e of A.ESSENCES) for (const loin of [false, true]) for (const q of ['low', 'medium', 'high']) COMBOS.push([e, loin, q]);
const comptes = {};
for (const e of A.ESSENCES) {
  comptes[e] = {};
  for (const q of ['low', 'medium', 'high'])
    comptes[e][q] = { proche: A.forme(e, false, q).length, loin: A.forme(e, true, q).length };
}
verifier('trois essences figées et budgets consultables, segments proches strictement supérieurs aux lointains', () => {
  assert.deepEqual([...A.ESSENCES], ['feuillu', 'pin', 'conifere']);
  assert.ok(Object.isFrozen(A.ESSENCES));
  for (const q of ['low', 'medium', 'high']) {
    const b = A.BUDGETS[q];
    assert.ok(b.segments.proche > b.segments.loin && b.segments.loin > 0, q);
    for (const e of A.ESSENCES) for (const cle of Object.keys(b[e]))
      assert.ok(Number.isInteger(b[e][cle]) && b[e][cle] > 0, `${q}.${e}.${cle}`);
  }
  assert.ok(A.BUDGETS.medium.feuillu.branches > A.BUDGETS.low.feuillu.branches);
  assert.ok(A.BUDGETS.high.feuillu.branches > A.BUDGETS.medium.feuillu.branches);
  assert.ok(A.BUDGETS.medium.pin.étages > A.BUDGETS.low.pin.étages);
  assert.ok(A.BUDGETS.high.pin.étages > A.BUDGETS.medium.pin.étages);
  assert.ok(A.BUDGETS.medium.conifere.verticilles > A.BUDGETS.low.conifere.verticilles);
  assert.ok(A.BUDGETS.high.conifere.verticilles > A.BUDGETS.medium.conifere.verticilles);
});
verifier('dix-huit formes distinctes, nommées et mémoïsées à la référence près', () => {
  const vues = new Map();
  for (const [e, loin, q] of COMBOS) {
    const t1 = A.forme(e, loin, q), t2 = A.forme(e, loin, q);
    assert.equal(t1, t2, `mémoire ${e} ${loin} ${q}`);
    assert.ok(Array.isArray(t1) && t1.length > 0);
    const nom = A.nomForme(e, loin, q);
    assert.ok(!vues.has(nom), 'nom unique ' + nom);
    vues.set(nom, t1);
  }
  assert.equal(vues.size, 18);
  assert.equal(A.nomForme('feuillu', false, 'high'), 'arbre-feuillu-proche-high');
  assert.equal(A.nomForme('pin', true, 'low'), 'arbre-pin-loin-low');
  assert.equal(A.nomForme('conifere', false, 'medium'), 'arbre-conifere-proche-medium');
});
verifier('triangles finis, non dégénérés, normés, tenus dans le cube unité', () => {
  for (const [e, loin, q] of COMBOS) for (const t of A.forme(e, loin, q)) {
    const nom = A.nomForme(e, loin, q);
    assert.equal(t.length, 6);
    for (let i = 0; i < 6; i++) for (const n of t[i]) assert.ok(Number.isFinite(n), nom);
    for (let i = 0; i < 3; i++) for (const n of t[i]) assert.ok(Math.abs(n) <= .50000001, nom);
    const n = croix(sous(t[1], t[0]), sous(t[2], t[0])), aire = Math.hypot(...n);
    assert.ok(aire > 1e-10, nom);
    for (let i = 3; i < 6; i++) {
      assert.ok(Math.abs(Math.hypot(...t[i]) - 1) < 1e-10, nom);
      assert.ok(dot(n, t[i]) / aire > .999999, nom);
    }
  }
});
verifier('paliers strictement croissants low < medium < high, en proche comme en loin', () => {
  for (const e of A.ESSENCES) for (const loin of [false, true]) {
    const n = q => A.forme(e, loin, q).length;
    assert.ok(n('low') < n('medium'), `${e} ${loin ? 'loin' : 'proche'} low<medium`);
    assert.ok(n('medium') < n('high'), `${e} ${loin ? 'loin' : 'proche'} medium<high`);
  }
  for (const e of A.ESSENCES) for (const q of ['low', 'medium', 'high'])
    assert.ok(A.forme(e, true, q).length < A.forme(e, false, q).length, `${e} ${q} loin<proche`);
});
const sommetsA = (tri, y) => new Set(tri.flatMap(t => t.slice(0, 3))
  .filter(p => Math.abs(p[1] - y) < 1e-9).map(p => p.join(',')).values()).size;
verifier('le lointain ne retire aucun organe : mêmes pieds, mêmes cimes, organes comptés identiques', () => {
  for (const e of A.ESSENCES) for (const q of ['low', 'medium', 'high']) {
    const proche = A.forme(e, false, q), loin = A.forme(e, true, q), o = A.organes(e, q);
    assert.equal(sommetsA(proche, -.5), sommetsA(loin, -.5), `${e} ${q} pieds au sol`);
    assert.ok(sommetsA(proche, -.5) > 0, `${e} ${q} pied présent`);
    assert.equal(sommetsA(proche, .5), sommetsA(loin, .5), `${e} ${q} cimes`);
    assert.ok(sommetsA(proche, .5) > 0, `${e} ${q} cime présente`);
    assert.ok(loin.length >= o.pointes * 4, `${e} ${q} chaque organe reste triangulé au loin`);
    assert.ok(o.amas > 0 && o.pointes > o.branches, `${e} ${q} organes de base dénombrés`);
  }
});
verifier('déterminisme : deux exécutions indépendantes donnent les mêmes empreintes sha256', () => {
  const premieres = {};
  for (const [e, loin, q] of COMBOS) premieres[A.nomForme(e, loin, q)] = empreinte(A.forme(e, loin, q));
  delete require.cache[require.resolve('../src/botanique.js')];
  require('../src/botanique.js');
  const A2 = globalThis.BITUME.botanique;
  for (const [e, loin, q] of COMBOS)
    assert.equal(empreinte(A2.forme(e, loin, q)), premieres[A.nomForme(e, loin, q)], A.nomForme(e, loin, q));
});
verifier('installer enregistre dix-huit formes et refuse un rendu indisponible', () => {
  assert.equal(A.installer(null), false);
  assert.equal(A.installer(undefined), false);
  assert.equal(A.installer({}), false);
  const enregistrees = new Map();
  assert.equal(A.installer({ forme: (nom, tri) => enregistrees.set(nom, tri) }), true);
  assert.equal(enregistrees.size, 18);
  for (const [e, loin, q] of COMBOS)
    assert.equal(enregistrees.get(A.nomForme(e, loin, q)), A.forme(e, loin, q));
});
verifier('matières du moteur : écorce 26 (fibrousBark), feuillage 27 (botanicalFoliage)', () => {
  assert.equal(A.matiere('ecorce'), 26);
  assert.equal(A.matiere('feuillage'), 27);
});
console.log(JSON.stringify({ controles, comptes }, null, 2));
