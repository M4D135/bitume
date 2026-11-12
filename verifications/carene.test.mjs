// Vérifications des carènes et des tubes (src/carene.js) : volumes fermés, normales, cotes, symétrie, normalisation.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
createRequire(import.meta.url)(path.join(ici, '..', 'src', 'carene.js'));
const C = globalThis.BITUME.carene;

let compte = 0;
function verifier(nom, f) {
  try { f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`FAIL ${nom}: ${e.message}`); process.exit(1); }
}

const cle = p => p.map(v => Math.round(v * 1e6)).join(',');
// Arêtes orientées : dans un volume fermé et bien orienté, chaque arête a → b apparaît une fois, et b → a une fois.
function aretesLibres(tris) {
  const n = new Map();
  for (const t of tris) for (let i = 0; i < 3; i++) {
    const a = cle(t[i]), b = cle(t[(i + 1) % 3]);
    if (a === b) continue;
    const k = a + '>' + b, r = b + '>' + a;
    if (n.get(r) > 0) n.set(r, n.get(r) - 1); else n.set(k, (n.get(k) || 0) + 1);
  }
  return [...n.entries()].filter(([, v]) => v > 0).map(([k]) => k);
}
const sous = (a, b) => a.map((v, k) => v - b[k]);
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Volume signé (théorème de la divergence) : positif si les faces regardent dehors.
const volume = tris => tris.reduce((s, t) => s + scal(t[0], croix(t[1], t[2])) / 6, 0);

const sections = [
  { x: 1.0, y0: .10, y1: .30, l: .20, n: 3 },
  { x: .40, y0: .05, y1: .45, l: .50, n: 5 },
  { x: -.60, y0: .05, y1: .40, l: .40, n: 4 }
];

verifier('carène fermée : chaque arête partagée par deux triangles, volume positif', () => {
  const t = C.carene(sections, { cotes: 20, pas: 4 });
  assert.equal(aretesLibres(t).length, 0, `${aretesLibres(t).length} arêtes libres`);
  assert.ok(volume(t) > 0, `volume ${volume(t)}`);
});

verifier('carène : nombre de triangles attendu (20 côtés, 2 intervalles de 4 pas, deux bouts)', () => {
  const t = C.carene(sections, { cotes: 20, pas: 4 });
  assert.equal(t.length, 8 * 20 * 2 + 2 * 20);
});

verifier('normales unitaires, tournées vers dehors, cohérentes avec les faces', () => {
  for (const t of [C.carene(sections), C.tube([[0, 0, 0], [.1, .05, 0], [.2, 0, .05]], [.02, .015, .01])]) {
    for (const tri of t) {
      const nf = croix(sous(tri[1], tri[0]), sous(tri[2], tri[0]));
      for (let i = 3; i < 6; i++) {
        assert.ok(Math.abs(Math.hypot(...tri[i]) - 1) < 1e-9, 'normale unitaire');
        assert.ok(scal(tri[i], nf) > 0, 'normale du côté de la face');
      }
    }
  }
});

verifier('boîte englobante égale aux cotes des sections', () => {
  const { lo, hi } = C.boite(C.carene(sections, { cotes: 24 }));
  assert.ok(Math.abs(hi[0] - 1.0) < 1e-9 && Math.abs(lo[0] + .6) < 1e-9, `x ${lo[0]} ${hi[0]}`);
  assert.ok(Math.abs(hi[1] - .45) < 1e-3 && Math.abs(lo[1] - .05) < 1e-3, `y ${lo[1]} ${hi[1]}`);
  assert.ok(Math.abs(hi[2] - .5) < 1e-3 && Math.abs(lo[2] + .5) < 1e-3, `z ${lo[2]} ${hi[2]}`);
});

verifier('symétrie gauche-droite : chaque sommet a son reflet', () => {
  const t = C.carene(sections, { cotes: 20 }), sommets = new Set();
  for (const tri of t) for (let i = 0; i < 3; i++) sommets.add(cle(tri[i]));
  for (const tri of t) for (let i = 0; i < 3; i++) assert.ok(sommets.has(cle([tri[i][0], tri[i][1], -tri[i][2]])), 'reflet manquant');
});

verifier('peau lisse : entre deux sections, aucune arête de plus de 50° (normales moyennées)', () => {
  const t = C.carene(sections, { cotes: 24 }), parSommet = new Map();
  for (const tri of t) for (let i = 0; i < 3; i++) { const k = cle(tri[i]); if (!parSommet.has(k)) parSommet.set(k, []); parSommet.get(k).push(tri[i + 3]); }
  // hors des bouts (x = 1 et x = −0,6), toutes les normales d'un même sommet sont identiques
  let lisses = 0;
  for (const [k, ns] of parSommet) {
    const x = +k.split(',')[0] / 1e6;
    if (x > .999 || x < -.599) continue;
    for (const n of ns) assert.ok(scal(n, ns[0]) > 1 - 1e-9, `normale brisée en ${k}`);
    lisses++;
  }
  assert.ok(lisses > 100);
});

verifier('ouverture : le haut reste ouvert entre ses abscisses, le bord est net', () => {
  const t = C.carene(sections, { cotes: 24, ouverture: { de: .2, a: -.3, angle: 1.4 } });
  const libres = aretesLibres(t).map(k => k.split('>').map(s => s.split(',').map(v => +v / 1e6)));
  assert.ok(libres.length > 0);
  for (const [a, b] of libres) for (const p of [a, b]) {
    assert.ok(p[0] <= .2 + 1e-6 && p[0] >= -.3 - 1e-6, `arête libre hors de l'ouverture : x ${p[0]}`);
    assert.ok(p[1] > .2, `arête libre trop basse : y ${p[1]}`);
  }
  // rien au-dessus du milieu de l'ouverture
  for (const tri of t) {
    const c = [0, 1, 2].map(k => (tri[0][k] + tri[1][k] + tri[2][k]) / 3);
    assert.ok(!(c[0] < .15 && c[0] > -.25 && Math.abs(c[2]) < .05 && c[1] > .3), 'peau au-dessus de l’ouverture');
  }
  const d = C.carene(sections, { cotes: 24, ouverture: { de: .2, a: -.3, angle: 1.4 }, interieur: true });
  assert.ok(d.length > t.length, 'la doublure ajoute la peau intérieure');
});

verifier('tube : fermé, rayon tenu, bouts en demi-sphère', () => {
  const pts = [[0, 0, 0], [.1, 0, 0], [.18, .05, 0]], t = C.tube(pts, .01, { cotes: 10 });
  assert.equal(aretesLibres(t).length, 0);
  assert.ok(volume(t) > 0);
  const { lo, hi } = C.boite(t);
  assert.ok(Math.abs(lo[0] + .01) < 1e-3, `bout arrondi : ${lo[0]}`);
  assert.ok(Math.abs(hi[2] - .01) < 1e-3 && Math.abs(lo[2] + .01) < 1e-3, `rayon ${lo[2]} ${hi[2]}`);
  const anneau = C.tube([[.1, 0, 0], [0, .1, 0], [-.1, 0, 0], [0, -.1, 0]], .01, { ferme: true });
  assert.equal(aretesLibres(anneau).length, 0, 'anneau fermé');
});

verifier('normaliser : cube unité, centre et taille, normales ramenées par l’inverse transposée', () => {
  const t = C.carene(sections), { triangles, centre, taille } = C.normaliser(t), { lo, hi } = C.boite(triangles);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(lo[k] + .5) < 1e-9 && Math.abs(hi[k] - .5) < 1e-9, `axe ${k}`);
  assert.ok(Math.abs(taille[0] - 1.6) < 1e-9 && Math.abs(centre[0] - .2) < 1e-9);
  // le nuanceur divise la normale par s : on doit retrouver la normale d'origine
  for (let i = 0; i < t.length; i += 17) {
    const n = triangles[i][3].map((v, k) => v / taille[k]), l = Math.hypot(...n);
    assert.ok(scal(n.map(v => v / l), t[i][3]) > 1 - 1e-9);
  }
});

verifier('miroir : orientation gardée, volume identique', () => {
  const t = C.tube([[0, 0, 0], [.1, .02, .03], [.2, 0, .05]], .01), m = C.miroir(t);
  assert.ok(Math.abs(volume(m) - volume(t)) < 1e-12 && volume(m) > 0);
  assert.equal(aretesLibres(m).length, 0);
});

console.log(`carène : ${compte} vérifications passées`);
