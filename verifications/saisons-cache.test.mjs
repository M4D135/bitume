// Complément du cache historique : les deux générateurs particuliers du catalogue actuel.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { B, CATALOGUE_SAISONS, creerCircuitSaisons } from '../tools/qualification/saisons-circuits.mjs';

const empreinte = h => createHash('sha256').update(JSON.stringify(h.triangles)).digest('hex');
const options = { qualite: 'high', vegetation: false, arbres: 220 };
const ordre = ['ete', 'automne', 'hiver', 'printemps', 'ete'];

for (const id of ['baikal', 'route-des-cimes']) test(id + ' : découpe partagée, palettes indépendantes et retour été exact', () => {
  const definition = CATALOGUE_SAISONS.find(d => d.id === id), c = creerCircuitSaisons(definition);
  assert(definition, 'générateur particulier présent au catalogue réel');
  const debut = { ...B.decor.comptesHerbier }, herbiers = [], empreintes = [];
  for (const [i, saison] of ordre.entries()) {
    const d = B.decor.construire(c, { ...options, saison }), h = d.herbier;
    assert.equal(d.herbier, h, 'lectures répétées sans reconstruction');
    herbiers.push(h); empreintes.push(empreinte(h));
    assert.equal(B.decor.comptesHerbier.decoupes - debut.decoupes, 1, 'une seule découpe pour les cinq préparations');
    assert.equal(B.decor.comptesHerbier.reprises - debut.reprises, i, 'palette suivante sur la découpe existante');
    if (i) assert.equal(empreinte(herbiers[0]), empreintes[0], 'une autre saison ne repeint pas la scène été précédente');
  }
  assert.equal(new Set(empreintes.slice(0, 4)).size, 4, 'quatre palettes distinctes');
  assert.equal(empreintes[0], empreintes[4], 'retour été bit-à-bit identique');
  for (let i = 0; i < 4; i++) {
    const sansCache = B.decor.construire(creerCircuitSaisons(definition), { ...options, saison: ordre[i] }).herbier;
    assert.equal(empreinte(sansCache), empreintes[i], 'reprise identique à une préparation neuve : ' + ordre[i]);
  }
});
