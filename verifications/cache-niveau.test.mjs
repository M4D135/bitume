import { test } from 'node:test';
import assert from 'node:assert/strict';

// Charger le module
globalThis.BITUME = globalThis.BITUME || {};
await import('../src/cache-niveau.js');
const { cle } = globalThis.BITUME.cacheNiveau;

test('cle est stable pour les mêmes entrées', () => {
  const a = cle('0.1', 'haut-col', 'haut', 'été', { arbres: true, ecologie: 'dense' });
  const b = cle('0.1', 'haut-col', 'haut', 'été', { ecologie: 'dense', arbres: true });
  assert.equal(a, b);
});

test('cle change quand un paramètre change', () => {
  const base = cle('0.1', 'haut-col', 'haut', 'été', null);
  assert.notEqual(base, cle('0.2', 'haut-col', 'haut', 'été', null));
  assert.notEqual(base, cle('0.1', 'cap-sequoia', 'haut', 'été', null));
  assert.notEqual(base, cle('0.1', 'haut-col', 'bas', 'été', null));
  assert.notEqual(base, cle('0.1', 'haut-col', 'haut', 'hiver', null));
});

test('cle avec options null et {} sont différentes', () => {
  assert.notEqual(cle('1', 'x', 'h', 'été', null), cle('1', 'x', 'h', 'été', {}));
});

test('cle avec options {} est stable', () => {
  assert.equal(cle('1', 'x', 'h', 'été', {}), cle('1', 'x', 'h', 'été', {}));
});

test('aller-retour exact au bit', () => {
  const { emballer, deballer } = globalThis.BITUME.cacheNiveau;
  const niveau = { tableaux: {
    positions: new Float32Array([1.5, -2.7, 3.14, 0, 99.9, -0.001]),
    indices: new Uint16Array([0, 1, 2, 65535, 128, 0]),
    drapeaux: new Uint8Array([0, 1, 255, 128]),
    ids: new Uint32Array([42, 0, 4294967295])
  }};
  const tampon = emballer(niveau);
  assert.ok(tampon instanceof ArrayBuffer);
  const rendu = deballer(tampon);
  assert.ok(rendu !== null);
  for (const nom of Object.keys(niveau.tableaux)) {
    assert.deepEqual(Array.from(rendu.tableaux[nom]), Array.from(niveau.tableaux[nom]));
  }
});

test('tampon abîmé refusé (format)', () => {
  const { emballer, deballer } = globalThis.BITUME.cacheNiveau;
  const niveau = { tableaux: { a: new Float32Array([1, 2, 3]) } };
  const tampon = emballer(niveau);
  const vue = new Uint32Array(tampon);
  vue[0] = 999; // format invalide
  assert.equal(deballer(tampon), null);
});

test('tampon abîmé refusé (longueur)', () => {
  const { emballer, deballer } = globalThis.BITUME.cacheNiveau;
  const niveau = { tableaux: { a: new Float32Array([1, 2, 3]) } };
  const tampon = emballer(niveau);
  const tronque = tampon.slice(0, tampon.byteLength - 4);
  assert.equal(deballer(tronque), null);
});

test('deballer sur non-ArrayBuffer rend null', () => {
  const { deballer } = globalThis.BITUME.cacheNiveau;
  assert.equal(deballer(null), null);
  assert.equal(deballer('coucou'), null);
  assert.equal(deballer(new Uint8Array([1, 2, 3])), null);
});
