import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); require('../src/meteo.js');
const M = globalThis.BITUME.meteo;

test('depuisReel filtre et borne les observations sans modifier la source ou garder sa localisation', () => {
  const source = Object.freeze({ reel: true, fixe: false, phase: 'orage', pluie: 3, nuage: -.2, mouille: NaN,
    ventX: -500, ventZ: Infinity, neige: true, t: 100, tp: 100, eclair: 1, prochainEclair: -100,
    ip: '203.0.113.10', latitude: 48.9, longitude: 2.4, lieu: 'Lieu privé' });
  const m = M.depuisReel(source);
  assert.equal(m.pluie, 1); assert.equal(m.nuage, 0); assert.equal(m.mouille, 0); assert.equal(m.ventX, -60); assert.equal(m.ventZ, 0);
  assert.equal(m.t, 0); assert.equal(m.tp, 0); assert.equal(m.eclair, 0); assert.equal(m.fixe, true); assert.equal(m.neige, true);
  for (const key of ['ip','latitude','longitude','lieu']) assert(!(key in m));
  assert.equal(M.depuisReel(null), null); assert.equal(M.depuisReel({ reel: 'true' }), null);
  const autre = M.depuisReel({ reel: true, phase: 'inconnue', neige: 1 }); assert.equal(autre.phase, 'couvre'); assert.equal(autre.neige, false);
});

test('météo réelle reste constante pendant plusieurs cycles de fronts, avec horloge et eau actives', () => {
  for (const phase of ['clair', 'couvre', 'pluie', 'orage']) {
    const m = M.depuisReel({ reel: true, phase, pluie: phase === 'pluie' || phase === 'orage' ? .43 : 0,
      nuage: .71, mouille: .25, ventX: -2.75, ventZ: 4.25, neige: true });
    const S = { meteo: m }, champs = ['phase', 'pluie', 'nuage', 'ventX', 'ventZ', 'neige'], initial = champs.map(k => m[k]);
    let eclairs = 0;
    for (let i = 0; i < 24000; i++) { M.avancer(S, 1 / 120); if (m.eclair === 1) eclairs++; }
    assert.deepEqual(champs.map(k => m[k]), initial); assert(Math.abs(m.t - 200) < 1e-6); assert(Math.abs(m.tp - 200) < 1e-6);
    assert(m.mouille >= 0 && m.mouille <= 1); assert(phase === 'orage' ? eclairs > 0 : eclairs === 0);
    assert.equal(S.meteo, m); assert(phase === 'pluie' || phase === 'orage' ? m.mouille > .25 : m.mouille < .25);
  }
});

test('pas invalides ignorés et sortie ambiance transmet vent/pluie réels', () => {
  const m = M.depuisReel({ reel: true, phase: 'pluie', pluie: .4, nuage: .6, mouille: .2, ventX: -5, ventZ: 2 }), S = { meteo: m };
  const avant = JSON.stringify(m); for (const dt of [0, -1, NaN, Infinity]) M.avancer(S, dt); assert.equal(JSON.stringify(m), avant);
  const sortie = {}, a = M.ambiance(m, sortie); assert.equal(a, sortie); assert.equal(a.ventX, -5); assert.equal(a.ventZ, 2);
  assert.equal(a.pluie, .4 * .72); assert.equal(a.nuage, .6 * .86);
});
