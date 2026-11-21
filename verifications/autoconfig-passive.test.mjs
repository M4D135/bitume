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

test('Xbox déclarée reste légère même avec les mêmes capacités qu’un ordinateur', () => {
  const capable = { ...bureau, hardwareConcurrency: 16, deviceMemory: 16, gpu: 'AMD Radeon Graphics' };
  const pc = A.passive(capable, 'ordinateur');
  assert.equal(pc.selection, 'medium'); assert.equal(pc.appareil.xbox, false); assert.equal(pc.appareil.console, null);
  for (const declaration of [
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) Chrome/144 Safari/537.36 Edg/144' },
    { userAgent: 'Mozilla/5.0 (Xbox Series X) Edge' },
    { userAgent: 'Mozilla/5.0 (xbox series s) Edge' },
    { platform: 'Xbox' },
    { userAgentData: { platform: 'Xbox', mobile: false } }
  ]) {
    const resultat = A.passive({ ...capable, ...declaration }, 'console');
    assert.equal(resultat.selection, 'low'); assert.equal(resultat.appareil.xbox, true);
    assert.equal(resultat.appareil.console, 'xbox'); assert.equal(resultat.appareil.mobile, false);
    assert.deepEqual(resultat.reglages, A.reglages('low'));
    assert.equal(resultat.reglages.anticrenelage, 'off'); assert.equal(resultat.reglages.ombres, 'off');
    assert.equal(resultat.reglages.retro, 'non');
    assert.equal(resultat.performancesMesurees, false); assert.deepEqual(resultat.mesures, []);
  }
});

test('une manette Xbox sur PC ne fait pas passer l’ordinateur pour une console', () => {
  const resultat = A.recommander({ ...bureau,
    gamepadId: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    gamepads: [{ id: 'Xbox Series Controller', mapping: 'standard' }],
    userAgentData: { platform: 'Windows', mobile: false }
  });
  assert.equal(resultat.selection, 'medium'); assert.equal(resultat.xbox, false); assert.equal(resultat.console, null);
});

test('la recommandation Xbox remplace l’ancien profil automatique et conserve les choix modifiés', () => {
  const reference = A.reglages('medium'), recommandes = A.passive({ ...bureau, platform: 'Xbox' }, 'console').reglages;
  const migration = A.fusionner(reference, reference, recommandes, false);
  assert.deepEqual(migration.valeurs, A.reglages('low')); assert.deepEqual(migration.gardes, []);
  const choisis = { ...reference, ombres: 'high', qualite: 'high', commandes: ['manette', 'clavier'] };
  const automatique = A.fusionner(choisis, reference, recommandes, false);
  assert.equal(automatique.valeurs.qualite, 'high'); assert.equal(automatique.valeurs.ombres, 'high');
  assert.equal(automatique.valeurs.retro, 'non');
  assert.deepEqual(choisis.commandes, ['manette', 'clavier']);
  assert.deepEqual(A.fusionner(choisis, reference, recommandes, true).valeurs, A.reglages('low'));
});

test('la recommandation passive a un cache distinct d’une performance mesurée', () => {
  const cle = A.empreinte('appareil', '0.2.80'), r = A.passive({}, cle);
  assert.equal(A.cacheValide(r, cle), true);
  assert.equal(A.cacheValide({ ...r, performancesMesurees: true }, cle), false);
  assert.equal(A.cacheValide({ ...r, selection: 'inconnue' }, cle), false);
  assert.equal(A.cacheValide(r, A.empreinte('appareil', '0.2.81')), false);
  assert.equal(A.cacheValide({ ...r, methode: A.METHODE }, cle), false, 'aucune fausse série de rafales');
  assert.equal(A.cacheValide({ ...r, revision: A.REVISION - 1 }, cle), false, 'revoir une ancienne classification sans test de charge');
});
