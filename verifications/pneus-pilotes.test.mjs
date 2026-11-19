// 12F2 : une préférence locale indépendante par pilote, migration sans modifier les réglages lus.
import '../src/pneus.js';
import assert from 'node:assert/strict';

const P = globalThis.BITUME.pneus;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

verifier('les quatre anciennes préférences migrent vers deux choix valides', () => {
  for (const type of P.TYPES_JOUABLES) {
    const reglages = Object.freeze({ pneus: type });
    assert.deepEqual(P.normaliserChoixPilotes(reglages), [type, type]);
    assert.deepEqual(reglages, { pneus: type });
  }
});

verifier('les pilotes conservent leurs choix distincts et les entrées supplémentaires sont ignorées', () => {
  const choix = Object.freeze(['pluie', 'neige', 'inter']);
  const reglages = Object.freeze({ pneus: 'slicks', pneusPilotes: choix });
  const a = P.normaliserChoixPilotes(reglages), b = P.normaliserChoixPilotes(reglages);
  assert.deepEqual(a, ['pluie', 'neige']); assert.deepEqual(b, a);
  assert.notEqual(a, choix); assert.notEqual(a, b);
  a[0] = 'inter';
  assert.deepEqual(b, ['pluie', 'neige']); assert.deepEqual(choix, ['pluie', 'neige', 'inter']);
});

verifier('un tableau partiel ne reprend pas le choix de son voisin', () => {
  assert.deepEqual(P.normaliserChoixPilotes({ pneus: 'neige', pneusPilotes: ['pluie'] }), ['pluie', 'neige']);
  assert.deepEqual(P.normaliserChoixPilotes({ pneus: 'inter', pneusPilotes: [, 'neige'] }), ['inter', 'neige']);
  assert.deepEqual(P.normaliserChoixPilotes({ pneusPilotes: ['pluie'] }), ['pluie', 'slicks']);
  assert.deepEqual(P.normaliserChoixPilotes({ pneusPilotes: [] }), ['slicks', 'slicks']);
});

verifier('types inconnus et noms du prototype reviennent à l’ancienne préférence, ou aux slicks', () => {
  for (const invalide of [null, undefined, '', 'constructor', '__proto__', 'toString', 2, {}, [], NaN]) {
    assert.deepEqual(P.normaliserChoixPilotes({ pneus: 'inter', pneusPilotes: [invalide, 'pluie'] }), ['inter', 'pluie']);
    assert.deepEqual(P.normaliserChoixPilotes({ pneus: invalide, pneusPilotes: ['neige', invalide] }), ['neige', 'slicks']);
  }
});

verifier('anciennes sauvegardes absentes ou mal formées restent utilisables', () => {
  for (const reglages of [undefined, null, false, 5, 'neige', []]) {
    assert.deepEqual(P.normaliserChoixPilotes(reglages), ['slicks', 'slicks']);
  }
  for (const invalide of [undefined, null, false, 5, 'pluie', { 0: 'neige', 1: 'inter' }]) {
    assert.deepEqual(P.normaliserChoixPilotes({ pneus: 'pluie', pneusPilotes: invalide }), ['pluie', 'pluie']);
  }
});

verifier('la migration ne lit ni préférence ni entrée de tableau héritée', () => {
  const reglages = Object.create({ pneus: 'neige', pneusPilotes: ['pluie', 'inter'] });
  assert.deepEqual(P.normaliserChoixPilotes(reglages), ['slicks', 'slicks']);
  const choix = [, 'neige'], prototype = Object.create(Array.prototype);
  prototype[0] = 'pluie'; Object.setPrototypeOf(choix, prototype);
  assert.deepEqual(P.normaliserChoixPilotes({ pneus: 'inter', pneusPilotes: choix }), ['inter', 'neige']);
  assert.equal(Object.hasOwn(choix, 0), false);
});

console.log(controles + ' contrôles préférences des pneus par pilote réussis');
