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
// Dix-neuf formes : les dix-huit arbres et le tronc d'écorce de la version lointaine (TRONC_LOINTAIN), qui remplace
// au loin le cylindre à seize côtés du moteur sous la silhouette allégée.
verifier('installer enregistre les dix-huit arbres et le tronc lointain, et refuse un rendu indisponible', () => {
  assert.equal(A.installer(null), false);
  assert.equal(A.installer(undefined), false);
  assert.equal(A.installer({}), false);
  const enregistrees = new Map();
  assert.equal(A.installer({ forme: (nom, tri) => enregistrees.set(nom, tri) }), true);
  assert.equal(enregistrees.size, 25, 'formes historiques et six rameaux nus préchargés');
  for (const [e, loin, q] of COMBOS)
    assert.equal(enregistrees.get(A.nomForme(e, loin, q)), A.forme(e, loin, q));
  assert.equal(A.TRONC_LOINTAIN, 'arbre-tronc-loin');
  assert.equal(enregistrees.get(A.TRONC_LOINTAIN), A.formeTroncLointain());
  for (const q of A.QUALITES) for (const loin of [false, true])
    assert.equal(enregistrees.get(A.nomFormeNue(loin, q)), A.formeNue(loin, q));
});

// Formes proches figées : nombres de triangles exacts et
// empreintes des coordonnées arrondies au millionième, pour qu'un écart d'un bit d'une plateforme à l'autre ne
// compte pas. La bascule ne doit rien changer à ce qu'on voit de près : ces neuf formes ne bougent pas.
const PROCHES_HISTORIQUES = {
  'feuillu-low': [486, 'eb6b30437e989dde7db262fb73d2d462f9dd6be50dd39ecb0b97d01cf9ecefde'],
  'feuillu-medium': [1074, '122ccddce364805913ccd8504b24191c2c3b3d31e2e24b38f4330a6813493a83'],
  'feuillu-high': [2022, '584fb66c465b95bf4845d29055cc9d50f3688a2842340a7f4eeb40cd8ed631f5'],
  'pin-low': [538, 'abc69feca96e4d7c11a8da5ee485c189afa375385d9761a1e79fe3bb46c6f4b2'],
  'pin-medium': [1182, '63a9a8f4889113b94cb5e88b1a86b4c797889b2ced082ea17d66115a426cab85'],
  'pin-high': [2218, '370a33f6ac8b12d7e8d317d4799331f3587709072e4a3d40c3a1c51c359570a6'],
  'conifere-low': [750, 'cca2b787fffaf17c5df5be993bc83dbcd2b89d992dc7bc69395816fefca4f8ab'],
  'conifere-medium': [1854, '13b07179148a2162032a03ed5f506cd8bba3b89783ec35afea959d7f468b7cd1'],
  'conifere-high': [3702, '4d590962b36cf50f0c1ea9f92e40450cc7143d4af8573acb8ac4f1f025ba92b6'],
};
const arrondi = tri => tri.map(t => t.map(p => p.map(v => Math.round(v * 1e6) / 1e6)));
verifier('formes proches figées (triangles et empreintes arrondies)', () => {
  for (const e of A.ESSENCES) for (const q of ['low', 'medium', 'high']) {
    const [n, sha] = PROCHES_HISTORIQUES[e + '-' + q], tri = A.forme(e, false, q);
    assert.equal(tri.length, n, `${e} ${q} : nombre de triangles proches`);
    assert.equal(empreinte(arrondi(tri)), sha, `${e} ${q} : géométrie proche modifiée`);
  }
});
verifier('silhouette lointaine tenue dans la boîte de la forme proche', () => {
  for (const e of A.ESSENCES) for (const q of ['low', 'medium', 'high']) {
    const boite = tri => {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const t of tri) for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], t[i][k]); max[k] = Math.max(max[k], t[i][k]);
      }
      return { min, max };
    };
    const p = boite(A.forme(e, false, q)), l = boite(A.forme(e, true, q));
    for (let k = 0; k < 3; k++) {
      assert.ok(l.min[k] >= p.min[k] - 1e-12 && l.max[k] <= p.max[k] + 1e-12, `${e} ${q} axe ${k} hors de la boîte proche`);
    }
    // Même hauteur à la bascule : la cime et le pied tombent aux mêmes ordonnées que la forme proche.
    assert.equal(l.min[1], p.min[1], `${e} ${q} pied`);
    assert.equal(l.max[1], p.max[1], `${e} ${q} cime`);
  }
});
verifier('silhouette lointaine : amas et plateaux de la forme proche repris à l\'identique', () => {
  for (const e of A.ESSENCES) for (const q of ['low', 'medium', 'high']) {
    const proche = new Set(A.forme(e, false, q).map(t => JSON.stringify(t))), o = A.organes(e, q);
    const communs = A.forme(e, true, q).filter(t => proche.has(JSON.stringify(t))).length;
    // Feuillu et conifère : douze faces extérieures par amas (six en haut, six en bas). Pin : plateaux à huit
    // rayons sur leurs deux faces, un par branche et un au sommet.
    const attendu = e === 'pin' ? (o.branches + 1) * 2 * A.SILHOUETTE.rayonsPlateau : o.amas * 12;
    assert.ok(communs >= attendu, `${e} ${q} : ${communs} faces reprises sur ${attendu} attendues`);
  }
});
verifier('silhouette lointaine : seules les faces des plateaux du pin sont émises des deux côtés', () => {
  const cle = (a, b, c) => JSON.stringify([a, b, c]);
  for (const e of A.ESSENCES) for (const q of ['low', 'medium', 'high']) {
    const loin = A.forme(e, true, q), faces = new Set(loin.map(t => cle(t[0], t[1], t[2])));
    // Une face double est la même face dans les deux sens (a, c, b) : un amas fermé n'en a pas besoin.
    const doubles = loin.filter(t => faces.has(cle(t[0], t[2], t[1]))).length / 2;
    const attendu = e === 'pin' ? (A.organes(e, q).branches + 1) * A.SILHOUETTE.rayonsPlateau : 0;
    assert.equal(doubles, attendu, `${e} ${q} : faces doubles`);
  }
});
verifier('silhouette lointaine au moins 2,5 fois plus légère que la forme proche en Moyenne et en Fine', () => {
  for (const e of A.ESSENCES) for (const q of ['medium', 'high']) {
    const proche = A.forme(e, false, q).length, loin = A.forme(e, true, q).length;
    assert.ok(loin * 2.5 <= proche, `${e} ${q} : ${loin} triangles au loin pour ${proche} de près`);
  }
  assert.ok(Object.isFrozen(A.SILHOUETTE) && Object.isFrozen(A.SILHOUETTE.fut));
});
// Silhouette figée : les mesures et les captures du rapport fluidite-2026-11-18/arbres valent pour ces formes. Des
// branches à trois faces s'allument en blanc à la bascule, des plateaux à six rayons changent de bord : les deux
// tests précédents lisent SILHOUETTE et ne le verraient pas. Toute retouche voulue refait les captures.
const LOINTAINES_MESUREES = { feuillu: [144, 212, 296], pin: [286, 454, 670], conifere: [218, 378, 582] };
verifier('silhouette lointaine figée : quatre faces par branche, huit rayons par plateau, triangles mesurés', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(A.SILHOUETTE)), { fut: { feuillu: 2, pin: 4, conifere: 2 }, facesBranche: 4, rayonsPlateau: 8 });
  for (const e of A.ESSENCES) ['low', 'medium', 'high'].forEach((q, i) =>
    assert.equal(A.forme(e, true, q).length, LOINTAINES_MESUREES[e][i], `${e} ${q} : triangles de la silhouette`));
});
verifier('tronc lointain : prisme à six faces sans fonds, normales lisses horizontales, dans le cylindre unité', () => {
  const t = A.formeTroncLointain();
  assert.equal(t, A.formeTroncLointain(), 'mémoïsé');
  assert.equal(t.length, 12);
  for (const tri of t) {
    assert.equal(tri.length, 6);
    for (let i = 0; i < 3; i++) {
      const [x, y, z] = tri[i];
      assert.ok(Math.abs(Math.hypot(x, z) - .5) < 1e-12 && Math.abs(Math.abs(y) - .5) < 1e-12, 'sommet sur le bord du cylindre unité');
      const n = tri[3 + i];
      assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-12 && n[1] === 0, 'normale unitaire horizontale');
      // Lisse : la normale d'un sommet est la direction radiale de ce sommet, partagée par ses deux faces.
      assert.ok(Math.abs(n[0] - x / .5) < 1e-12 && Math.abs(n[2] - z / .5) < 1e-12, 'normale radiale');
    }
    // Sens direct vu de l'extérieur : la face regarde du côté de ses normales (le moteur retire les faces arrière).
    const f = croix(sous(tri[1], tri[0]), sous(tri[2], tri[0]));
    const centre = [0, 1, 2].map(k => (tri[0][k] + tri[1][k] + tri[2][k]) / 3);
    assert.ok(f[0] * centre[0] + f[2] * centre[2] > 0, 'face tournée vers l\'extérieur');
  }
});
verifier('matières du moteur : écorce 26 (fibrousBark), feuillage 27 (botanicalFoliage)', () => {
  assert.equal(A.matiere('ecorce'), 26);
  assert.equal(A.matiere('feuillage'), 27);
});
console.log(JSON.stringify({ controles, comptes }, null, 2));
