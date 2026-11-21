// Classification prudente à partir d'informations déclarées ; aucune mesure de vitesse.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
require('../src/autoconfig.js');
const A = globalThis.BITUME.autoconfig;
const bureau = { userAgent: 'Chrome desktop', platform: 'Win32', hardwareConcurrency: 16, deviceMemory: 8, maxTouchPoints: 0, gpu: 'NVIDIA GeForce RTX' };

test('téléphones, iPad en mode ordinateur et capacités absentes utilisent le profil léger', () => {
  for (const capacites of [
    {},
    { ...bureau, userAgent: 'iPhone Mobile Safari', platform: 'iPhone', hardwareConcurrency: undefined, deviceMemory: undefined },
    { ...bureau, userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5, deviceMemory: undefined },
    { ...bureau, userAgent: 'Android Mobile Chrome', maxTouchPoints: 5 },
    { ...bureau, mobile: true },
    { ...bureau, userAgent: '', platform: '', pointeurGrossier: true, maxTouchPoints: 1, petitEcran: true },
    { hardwareConcurrency: NaN, deviceMemory: Infinity, maxTouchPoints: -1 }
  ]) assert.equal(A.recommander(capacites).selection, 'low');
});

test('informations modestes ou rendu logiciel restent prudents, quel que soit le nombre de cœurs annoncé', () => {
  for (const capacites of [
    { ...bureau, hardwareConcurrency: 4 }, { ...bureau, deviceMemory: 4 },
    { ...bureau, gpu: 'Intel UHD Graphics' }, { ...bureau, gpu: 'Mali G78' },
    { ...bureau, gpu: 'SwiftShader', hardwareConcurrency: 64, deviceMemory: 64 }
  ]) assert.equal(A.recommander(capacites).selection, 'low');
});

test('un ordinateur déclaré capable part au plus en Moyenne, sans promettre de FPS', () => {
  for (const capacites of [bureau, { ...bureau, gpu: 'Apple M5' }, { ...bureau, maxTouchPoints: 10, pointeurGrossier: false }]) {
    const r = A.passive(capacites, 'appareil');
    assert.equal(r.selection, 'medium'); assert.equal(r.appareil.mobile, false);
    assert.equal(r.methode, A.METHODE_PASSIVE); assert.equal(r.performancesMesurees, false);
    assert.deepEqual(r.mesures, []); assert.deepEqual(r.reglages, A.reglages('medium'));
    for (const cle of ['fps', 'cpu', 'gpu', 'cout', 'cadenceBridee']) assert.equal(Object.hasOwn(r, cle), false);
  }
});

test('la recommandation passive a un cache distinct d’une performance mesurée', () => {
  const cle = A.empreinte('appareil', '0.2.80'), r = A.passive({}, cle);
  assert.equal(A.cacheValide(r, cle), true);
  assert.equal(A.cacheValide({ ...r, performancesMesurees: true }, cle), false);
  assert.equal(A.cacheValide({ ...r, selection: 'inconnue' }, cle), false);
  assert.equal(A.cacheValide(r, A.empreinte('appareil', '0.2.81')), false);
  assert.equal(A.cacheValide({ ...r, methode: A.METHODE }, cle), false, 'aucune fausse série de rafales');
});
