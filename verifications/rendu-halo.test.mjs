// Exécute les vraies fonctions de qualité : l'archive 0.2.18 appelait avecHalo sans la définir.
// Depuis le lot 5, le menu (Légère, Moyenne, Fine, Auto), le gouverneur Auto et les capacités réellement ouvertes
// par FRender.create se rejoignent dans src/graphismes.js. Les fonctions de jeu.js ne reçoivent plus une chaîne de
// qualité mais le profil résolu : c'est lui qui décide, et ces contrôles vérifient que jeu.js l'écoute.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const req = createRequire(import.meta.url);
req('../src/graphismes.js');
const B = globalThis.BITUME;
const source = readFileSync(process.argv[2] || new URL('../src/jeu.js', import.meta.url), 'utf8');
const debut = source.indexOf('  // effets permis par le profil résolu');
const fin = source.indexOf('  // ---------------------------------------------------------------- rétroviseurs', debut);
assert.ok(debut >= 0 && fin > debut, 'bloc des effets disponible dans jeu.js');
const fonctions = new Function('B', source.slice(debut, fin) + '\nreturn { avecHalo, avecOmbres, avecReflets };');
// ce que le moteur a ouvert à la création du rendu : un poste complet, puis un processeur graphique modeste
const garde = B.graphismes.capacites({ msaa: 4, shadowMapScale: 2, reflections: true }, false, 2);
const modeste = B.graphismes.capacites({ msaa: 0, shadowMapScale: 1, reflections: false }, true, 1);
const P = (q, n, c) => B.graphismes.melange(q, n, c || garde);

for (const n of [0, 1, 2, 3, 4]) test('halo et ombres au palier ' + n, () => {
  const q = fonctions(B);
  assert.equal(q.avecHalo(P('high', n)), true); assert.equal(q.avecHalo(P('low', n)), false);
  assert.equal(q.avecHalo(P('auto', n)), n < 3); assert.equal(q.avecOmbres(P('auto', n)), n < 2);
  // Moyenne (David, 17/11 : « menu graphique low medium high ») : ombres et halo ouverts dès le choix du menu
  assert.equal(q.avecOmbres(P('medium', n)), true); assert.equal(q.avecHalo(P('medium', n)), true);
  assert.equal(q.avecHalo(P('low', n)), false, 'le palier bas ne paie jamais le halo');
});
test('reflets préservés selon la météo et le GPU', () => {
  // une séance neuve à chaque contrôle : le seuil a une prise et un relâchement (tunnel-transitions.test.mjs les tient)
  const q = fonctions(B);
  assert.equal(q.avecReflets({}, P('high', 0), { mouille: .5 }), true);
  assert.equal(q.avecReflets({}, P('high', 0), { mouille: 0, pluie: 0 }), false);
  assert.equal(q.avecReflets({}, P('high', 0), { mouille: .1, pluie: .3 }), true);
  assert.equal(q.avecReflets({}, P('medium', 0), { mouille: 1 }), false, 'Moyenne ne paie pas les reflets d écran');
  assert.equal(q.avecReflets({}, P('high', 0, modeste), { mouille: 1 }), false);
});
