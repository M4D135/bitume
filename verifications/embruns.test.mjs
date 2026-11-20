// Exposition aux nuages d'eau dans le repère du monde, indépendante de la piste et des vues.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/sillage.js');
const { sillage } = globalThis.BITUME;
let total = 0;
const verifier = (nom, f) => { f(); total++; console.log('ok ' + nom); };
function source(vitesse = 65, cap = 0, y = 0) {
  const etat = sillage.creer();
  sillage.mettreAJour(etat, [{ id: 7, etat: { v: vitesse, s: 0 } }], [{ x: 0, y, z: 0, cap }]);
  return etat;
}
const mesure = (s, p, eau = 1, exclu = 2) => sillage.exposition(s, p, eau, exclu);
verifier('nuage local derrière une voiture rapide ; ni devant ni à côté ni au loin', () => {
  const s = source();
  assert(mesure(s, [-12, 1, 0]) > .6);
  for (const p of [[12, 1, 0], [-12, 1, 8], [-110, 1, 0], [-12, 14, 0], [-12, -4, 0]]) assert.equal(mesure(s, p), 0);
  assert(mesure(s, [-12, 1, 0]) > mesure(s, [-45, 1, 0]));
});
verifier('rotation du monde et marche arrière : le panache suit la vitesse réelle', () => {
  const a = mesure(source(), [-12, 1, 0]);
  const b = mesure(source(65, Math.PI / 2), [0, 1, -12]);
  assert(Math.abs(a - b) < 1e-12);
  const recul = source(-65);
  assert(mesure(recul, [12, 1, 0]) > .6); assert.equal(mesure(recul, [-12, 1, 0]), 0);
});
verifier('route sèche, propre voiture, arrêt et source sous abri n’apportent aucune eau', () => {
  assert.equal(mesure(source(), [-12, 1, 0], 0), 0);
  assert.equal(mesure(source(), [-12, 1, 0], 1, 7), 0);
  assert.equal(mesure(source(0), [-12, 1, 0]), 0);
  const abri = source(); abri.sources[0].strength = 0;
  assert.equal(mesure(abri, [-12, 1, 0]), 0);
});
verifier('pluie proportionnelle et voitures multiples bornées sans contamination entre vues', () => {
  const s = source(), p = [-12, 1, 0], sec = mesure(s, p, .2), humide = mesure(s, p);
  assert(sec > 0 && sec < humide);
  const avant = JSON.stringify(s);
  const proche = mesure(s, p), loin = mesure(s, [500, 1, 0]);
  assert(proche > 0 && loin === 0); assert.equal(JSON.stringify(s), avant);
  s.sources.push(...Array(15).fill(s.sources[0]));
  assert(mesure(s, p) >= humide && mesure(s, p) <= 1);
});
verifier('deux chaussées superposées ne partagent pas un panache', () => {
  const pont = source(65, 0, 18);
  assert.equal(mesure(pont, [-12, 1, 0]), 0);
  assert(mesure(pont, [-12, 19, 0]) > .6);
});
verifier('entrées absentes ou non finies : aucune opacité invalide', () => {
  for (const p of [null, [], [NaN, 1, 0], [0, Infinity, 0]]) assert.equal(mesure(source(), p), 0);
  assert.equal(mesure(null, [-12, 1, 0]), 0);
  assert.equal(mesure(source(), [-12, 1, 0], NaN), 0);
});
console.log(`${total} contrôles embruns réussis`);
