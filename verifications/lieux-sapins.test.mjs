import { test } from 'node:test';
import assert from 'node:assert';

globalThis.BITUME = globalThis.BITUME || {};
await import('../src/lieux.js');
const B = globalThis.BITUME;

test('sapinsBoisNoir', () => {
  const longueur = 9700;
  const pas = 1;
  const largeur = 12;
  const graine = 7;
  const n = longueur / pas;
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = i * pas;
    z[i] = 0;
  }
  const circuit = { longueur, pas, largeur, graine, x, z };

  const lots = B.lieux.sapinsBoisNoir(circuit);

  // Nombre total de lots
  const n1 = Math.ceil((970 - 790) / 2.5);
  const n2 = Math.ceil((1366 - 1146) / 2.5);
  const n3 = Math.ceil((2026 - 1766) / 2.5);
  const attendu = n1 + n2 + n3;
  assert.strictEqual(lots.length, attendu, `Nombre de lots: ${lots.length} ≠ ${attendu}`);

  // Tous de type sapin
  for (const l of lots) {
    assert.strictEqual(l.type, 'sapin');
  }

  // distance_bord ∈ [2.6, 6.0]
  for (const l of lots) {
    assert.ok(l.meta.distance_bord >= 2.6 && l.meta.distance_bord <= 6.0,
      `distance_bord hors bornes: ${l.meta.distance_bord}`);
  }

  // Cotes par tronçon
  for (let i = 0; i < n1; i++) {
    assert.strictEqual(lots[i].meta.cote, +1, `Tronçon 1, index ${i}`);
  }
  for (let i = n1; i < n1 + n2; i++) {
    assert.strictEqual(lots[i].meta.cote, -1, `Tronçon 2, index ${i}`);
  }
  for (let i = n1 + n2; i < n1 + n2 + n3; i++) {
    assert.strictEqual(lots[i].meta.cote, +1, `Tronçon 3, index ${i}`);
  }

  // Hauteur totale ∈ [5.0, 8.5]
  for (const l of lots) {
    let min_y = Infinity;
    let max_y = -Infinity;
    for (const nap of l.nappes) {
      if (nap.min[1] < min_y) min_y = nap.min[1];
      if (nap.max[1] > max_y) max_y = nap.max[1];
    }
    const hauteur = max_y - min_y;
    assert.ok(hauteur >= 5.0 && hauteur <= 8.5,
      `Hauteur hors bornes: ${hauteur}`);
  }

  // Emprise hors piste : sapin à cote=+1 est au-delà du bord droit
  for (const l of lots) {
    if (l.meta.cote !== +1) continue;
    const piste = B.lieux.echantillonPiste(circuit, l.meta.s);
    const bord = piste.largeur !== undefined ? piste.largeur / 2 : circuit.largeur / 2;
    const lat = circuit.largeur / 2 + l.meta.distance_bord;
    // Vérifier que le décalage latéral dépasse la moitié de la largeur
    assert.ok(lat > circuit.largeur / 2,
      `Sapin cote=+1 pas assez loin: lat=${lat}, bord=${circuit.largeur / 2}`);
  }
});
