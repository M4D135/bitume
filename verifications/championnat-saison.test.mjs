import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const championnat = require('../src/championnat.js');
const catalogue = ['marseille', 'val-brule', 'fjord'].map(id => ({ id }));

test("le calendrier européen suit les identifiants du catalogue", () => {
  const etat = championnat.creer('europe', catalogue);
  assert.deepEqual(etat.manches.map(m => m.circuitId), ['val-brule', 'marseille', 'fjord']);
  assert.deepEqual(etat.manches.map(m => m.circuitIndex), [1, 0, 2]);
  assert.equal(championnat.creer('integral', catalogue).manches.length, 3);
});

test("barème, abandon, meilleur tour du joueur zéro et fin du championnat", () => {
  const etat = championnat.creer('integral', catalogue.slice(0, 2));
  const resultats = (tour, abandon) => [
    {id: 0, nom: 'Vous', joueur: true, meilleurTour: tour},
    {id: 1, nom: 'Rival', meilleurTour: 50, abandon}
  ];
  championnat.enregistrerCourse(etat, resultats(59, true), 0);
  assert.deepEqual(etat.manches[0].resultats.map(r => r.points), [26, 0]);
  championnat.enregistrerCourse(etat, resultats(57, false), 1);
  championnat.enregistrerCourse(etat, resultats(50, false), 0);
  assert.equal(etat.termine, true);
  assert.equal(etat.indexManche, 2);
  assert.deepEqual(championnat.classement(etat).map(p => [p.points, p.meilleurTour]), [[51, 57], [19, 50]]);
});

test("reprise des sauvegardes par indice, et protection contre les données incomplètes", () => {
  const donnees = new Map(), storage = {
    getItem: cle => donnees.get(cle), setItem: (cle, val) => donnees.set(cle, val),
    removeItem: cle => donnees.delete(cle)
  };
  const etat = championnat.creer('integral', catalogue);
  delete etat.manches[0].circuitId;
  assert.equal(championnat.sauver(etat, storage), true);
  assert.deepEqual(championnat.charger(storage), etat);
  for (const invalide of [{...etat, pilotes: null}, {...etat, indexManche: -1}, {...etat, manches: [null]}]) {
    championnat.sauver(invalide, storage);
    assert.equal(championnat.charger(storage), null);
  }
  assert.equal(championnat.effacer(storage), true);
  assert.equal(championnat.charger(storage), null);
});
