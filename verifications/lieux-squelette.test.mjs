import { test } from 'node:test';
import assert from 'node:assert';

globalThis.BITUME = globalThis.BITUME || {};
const B = await import('../src/lieux.js').then(() => globalThis.BITUME);

test('alea reproductible', () => {
  const r1 = B.lieux.alea(42);
  const r2 = B.lieux.alea(42);
  for (let i = 0; i < 10; i++) {
    const v1 = r1();
    const v2 = r2();
    assert.ok(v1 >= 0 && v1 < 1);
    assert.strictEqual(v1, v2);
  }
});

test('echantillonPiste rectiligne', () => {
  const circuit = {
    x: [0, 1, 2, 3, 4],
    z: [0, 0, 0, 0, 0],
    pas: 1,
    longueur: 4
  };
  const res = B.lieux.echantillonPiste(circuit, 2.5);
  assert.strictEqual(res.x, 2.5);
  assert.strictEqual(res.z, 0);
  assert.ok(Math.abs(res.cap) < 1e-6);
});

test('boite', () => {
  const sommets = [[1, 2, 3], [4, 5, 6], [0, -1, 2]];
  const b = B.lieux.boite(sommets);
  assert.deepStrictEqual(b.min, [0, -1, 2]);
  assert.deepStrictEqual(b.max, [4, 5, 6]);
});

test('nappe/sommet/finir', () => {
  const n = B.lieux.nappe();
  B.lieux.sommet(n, [1, 2, 3], 0, 0, 0);
  B.lieux.sommet(n, [4, 5, 6], 1, 0, 0);
  B.lieux.finir(n);
  assert.deepStrictEqual(n.min, [1, 2, 3]);
  assert.deepStrictEqual(n.max, [4, 5, 6]);
  assert.strictEqual(n.s.length, 2);
});
