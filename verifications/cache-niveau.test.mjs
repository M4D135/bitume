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
