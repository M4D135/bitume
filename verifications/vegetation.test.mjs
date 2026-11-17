// Géométrie, coût borné et invariants du biome pilote. Les références historiques restent séparées.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'carene', 'vegetation', 'decor']) require('../src/' + nom + '.js');
const B = globalThis.BITUME, V = B.vegetation;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const sous = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function distanceSegment2(p, a, b) {
  const ab = sous(b, a), ap = sous(p, a), t = Math.max(0, Math.min(1, dot(ap, ab) / dot(ab, ab)));
  return ap.reduce((s, v, i) => s + (v - ab[i] * t) ** 2, 0);
}
function distanceTriangle2(p, t) {
  const [a, b, c] = t, ab = sous(b, a), ac = sous(c, a), ap = sous(p, a);
  const aa = dot(ab, ab), bb = dot(ac, ac), xy = dot(ab, ac), px = dot(ap, ab), py = dot(ap, ac), det = aa * bb - xy * xy;
  const v = (bb * px - xy * py) / det, w = (aa * py - xy * px) / det;
  if (v >= 0 && w >= 0 && v + w <= 1) {
    const n = croix(ab, ac), d = dot(ap, n); return d * d / dot(n, n);
  }
  return Math.min(distanceSegment2(p, a, b), distanceSegment2(p, b, c), distanceSegment2(p, c, a));
}
verifier('quatre formes réutilisées, au plus 800 triangles au registre', () => {
  assert.equal(Object.keys(V.FORMES).length, V.BUDGET.formes);
  assert.ok(Object.values(V.FORMES).reduce((n, t) => n + t.length, 0) <= 800);
  const enregistrees = new Map();
  assert.equal(V.installer({ forme: (nom, triangles) => enregistrees.set(nom, triangles) }), true);
  assert.equal(enregistrees.size, 4);
  assert.equal(V.installer(null), false);
});
verifier('triangles finis, orientés, non dégénérés et tenus dans le cube des instances', () => {
  for (const [nom, tri] of Object.entries(V.FORMES)) for (const t of tri) {
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
const erreursLod = {};
verifier('LOD vraiment simplifié ; détail retiré sous 0,4 pixel à la distance de référence', () => {
  // Échantillons de la surface proche (sommets, milieux d'arêtes, centres des triangles), comparés aux vrais
  // triangles lointains. C'est une borne observée sur ces échantillons, pas un verdict sur une vidéo.
  for (const famille of ['herbes', 'taillis']) {
    const proche = V.FORMES[famille + '-val'], loin = V.FORMES[famille + '-val-loin'];
    assert.ok(loin.length < proche.length * .5, famille);
    let distance2 = 0;
    for (const t of proche) {
      const points = t.slice(0, 3).concat([0, 1, 2].map(i => t[i].map((v, k) => (v + t[(i + 1) % 3][k]) / 2)), [t[0].map((v, k) => (v + t[1][k] + t[2][k]) / 3)]);
      for (const p of points) {
        let meilleure = Infinity;
        for (const f of loin) meilleure = Math.min(meilleure, distanceTriangle2(p, f));
        distance2 = Math.max(distance2, meilleure);
      }
    }
    const metres = Math.sqrt(distance2) * 1.55, pixels = metres * (1080 / (2 * Math.tan(Math.PI / 6))) / 520;
    erreursLod[famille] = { metres, pixels };
    assert.ok(pixels < .4, `${famille}: ${pixels.toFixed(3)} px`);
  }
});
const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
const avant = B.decor.construire(c, { matieres: false, vegetation: false });
const apres = B.decor.construire(c), lots = apres.lots.filter(l => l.vegetation);
verifier('Val-Brûlé reçoit un nombre borné de plantes et deux groupes au plus par lot', () => {
  assert.ok(apres.vegetation.herbes > 60 && apres.vegetation.herbes <= V.BUDGET.herbes);
  assert.ok(apres.vegetation.taillis > 10 && apres.vegetation.taillis <= V.BUDGET.taillis);
  assert.ok(lots.length > 0 && lots.length <= Math.ceil(c.longueur / 420));
  let proches = 0, lointains = 0;
  for (const l of lots) {
    assert.ok(new Set(l.objets.map(o => o.shape)).size <= 2);
    assert.ok(new Set(l.loin.map(o => o.shape)).size <= 2);
    assert.equal(l.objets.length, l.loin.length, 'aucune plante supprimée au loin');
    assert.equal(l.portee, Infinity);
    assert.equal(l.lodReferenceFov, 60); assert.equal(l.lodReferenceHeight, 1080);
    for (let i = 0; i < l.objets.length; i++) {
      const a = l.objets[i], b = l.loin[i];
      proches += V.FORMES[a.shape].length; lointains += V.FORMES[b.shape].length;
      assert.deepEqual(a.p, b.p); assert.deepEqual(a.s, b.s); assert.deepEqual(a.r, b.r); assert.deepEqual(a.color, b.color);
      assert.ok(Math.hypot(...sous(a.p, l.centre)) + Math.hypot(...a.s) / 2 + .249999 <= l.rayon, 'vent compris dans le culling');
      assert.equal(a.collision, undefined);
    }
  }
  assert.ok(proches < 60000 && lointains < proches * .5, `${proches}/${lointains}`);
});
verifier('aucun obstacle, arbre ou objet historique déplacé ou retiré', () => {
  assert.deepEqual(apres.obstacles, avant.obstacles);
  assert.deepEqual(apres.arbres, avant.arbres);
  const anciensLots = apres.lots.filter(l => !l.vegetation);
  assert.equal(anciensLots.length, avant.lots.length);
  const sansMatiere = objet => { const { mat, ...reste } = objet; return reste; };
  for (let i = 0; i < avant.lots.length; i++) for (const cle of ['objets', 'loin'])
    assert.deepEqual(anciensLots[i][cle].map(sansMatiere), avant.lots[i][cle].map(sansMatiere));
});
verifier('nouvel asphalte seul, géométrie de chaussée et marquages inchangés', () => {
  let asphalte = 0, marquages = 0;
  assert.equal(avant.nappes.length, apres.nappes.length);
  for (let i = 0; i < avant.nappes.length; i++) {
    const a = avant.nappes[i], b = apres.nappes[i];
    assert.deepEqual(a.indices, b.indices); assert.equal(a.sommets.length, b.sommets.length);
    for (let k = 0; k < a.sommets.length; k++) {
      if (k % 13 !== 9) { assert.equal(a.sommets[k], b.sommets[k]); continue; }
      if (a.sommets[k] === 14 && a.sommets[k + 1] < .3 && a.sommets[k + 2] < .3) { assert.equal(b.sommets[k], 21); asphalte++; }
      else { assert.equal(b.sommets[k], a.sommets[k]); if (a.sommets[k] === 14) marquages++; }
    }
  }
  assert.ok(asphalte > 100 && marquages > 100);
  assert.ok(apres.lots.some(l => l.objets.some(o => o.mat === 22)), 'béton pilote utilisé');
  assert.ok(apres.lots.some(l => l.objets.some(o => o.mat === 24 && o.collision === 'toit')), 'tôle peinte du stand');
  assert.ok(apres.lots.some(l => l.objets.some(o => o.mat === 0 && o.detail === 1)), 'métal nu des glissières conservé');
});
verifier('plantes à l’écart de la chaussée, des stands et des glissières', () => {
  for (const l of lots) for (const o of l.objets) {
    let distance2 = Infinity, indice = -1;
    for (let i = 0; i < c.n; i++) {
      const d = (o.p[0] - c.x[i]) ** 2 + (o.p[2] - c.z[i]) ** 2;
      if (d < distance2) { distance2 = d; indice = i; }
    }
    const marge = Math.hypot(o.s[0], o.s[2]) / 2;
    assert.ok(Math.sqrt(distance2) >= c.largeur / 2 + 1.2 + marge);
    assert.ok(Math.abs(B.circuit.ecart(c, 0, indice * c.pas)) >= 350);
  }
});
verifier('répartition déterministe et indépendante des autres générateurs', () => {
  const autre = B.decor.construire(c);
  assert.deepEqual(autre.lots.filter(l => l.vegetation), lots);
  assert.deepEqual(autre.vegetation, apres.vegetation);
  assert.equal(B.decor.construire(c, { vegetation: false }).vegetation, undefined);
});
verifier('Port-Sable et Haut-Col entièrement inchangés par le pilote', () => {
  for (const [graine, theme, longueur] of [[29, 'cote', 3600], [47, 'montagne', 5200]]) {
    const piste = B.circuit.creer(graine, { theme, longueur });
    const a = B.decor.construire(piste), b = B.decor.construire(piste, { matieres: false, vegetation: false });
    // Les fonctions de hauteur sont reconstruites à chaque appel ; comparer toutes les données, sans ces fonctions.
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  }
});
console.log(JSON.stringify({ controles, plantes: apres.vegetation, erreursLod }, null, 2));
