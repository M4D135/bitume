// Exécute les vraies fonctions de qualité : l'archive 0.2.18 appelait avecHalo sans la définir.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = readFileSync(process.argv[2] || new URL('../src/jeu.js', import.meta.url), 'utf8');
const debut = source.indexOf('  // effets permis par la qualité et le palier');
const fin = source.indexOf('  // ---------------------------------------------------------------- rétroviseurs', debut);
assert.ok(debut >= 0 && fin > debut);
const fonctions = new Function('palier', 'gpuModeste', source.slice(debut, fin) + '\nreturn { avecHalo, avecOmbres, avecReflets };');
for (const n of [0, 1, 2, 3, 4]) test('halo et ombres au palier ' + n, () => {
  const q = fonctions({ n }, false);
  assert.equal(q.avecHalo('high'), true); assert.equal(q.avecHalo('low'), false);
  assert.equal(q.avecHalo('auto'), n < 3); assert.equal(q.avecOmbres('auto'), n < 2);
});
test('reflets préservés selon la météo et le GPU', () => {
  // une séance neuve à chaque contrôle : le seuil a une prise et un relâchement (tunnel-transitions.test.mjs les tient)
  const q = fonctions({ n: 0 }, false);
  assert.equal(q.avecReflets({}, 'high', { mouille: .5 }), true);
  assert.equal(q.avecReflets({}, 'high', { mouille: 0, pluie: 0 }), false);
  assert.equal(q.avecReflets({}, 'high', { mouille: .1, pluie: .3 }), true);
  assert.equal(fonctions({ n: 0 }, true).avecReflets({}, 'high', { mouille: 1 }), false);
});
