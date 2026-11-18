import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Charger le module lieux.js
require(join(__dirname, '..', 'src', 'lieux.js'));

const B = globalThis.BITUME;

function creerCircuitSynthetique(longueur, pas, largeur, graine) {
  const n = Math.ceil(longueur / pas);
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = i * pas;
    x[i] = s;
    z[i] = 0;
  }
  return { x, z, longueur, pas, largeur, graine };
}

test('parapets - structure et meta', () => {
  const circuit = creerCircuitSynthetique(9700, 1, 12, 7);
  const lots = B.lieux.parapets(circuit);

  const nBalcon = Math.ceil((5478 - 4511) / 3);
  const nVide = Math.ceil((8719 - 8523) / 3);
  const attendu = nBalcon + nVide;

  assert.strictEqual(lots.length, attendu, 'Nombre total de lots incorrect');

  let countBalcon = 0;
  let countVide = 0;

  for (const lot of lots) {
    assert.strictEqual(lot.type, 'parapet', 'Type incorrect');
    assert.ok(lot.nappes && lot.nappes.length === 1, 'Nappe manquante');
    assert.ok(lot.meta, 'Meta manquante');

    if (lot.meta.nom === 'balcon') {
      assert.strictEqual(lot.meta.cote, -1, 'Cote balcon incorrect');
      countBalcon++;
    } else if (lot.meta.nom === 'virage-du-vide') {
      assert.strictEqual(lot.meta.cote, 1, 'Cote virage-du-vide incorrect');
      countVide++;
    } else {
      assert.fail('Nom de tronçon inconnu');
    }
  }

  assert.strictEqual(countBalcon, nBalcon, 'Nombre de lots balcon incorrect');
  assert.strictEqual(countVide, nVide, 'Nombre de lots virage-du-vide incorrect');
});

test('parapets - dimensions géométriques', () => {
  const circuit = creerCircuitSynthetique(9700, 1, 12, 7);
  const lots = B.lieux.parapets(circuit);

  for (const lot of lots) {
    const nappe = lot.nappes[0];
    const min = nappe.min;
    const max = nappe.max;

    // Hauteur (axe Y)
    const hauteur = max[1] - min[1];
    assert.ok(hauteur >= 0.55 && hauteur <= 0.75, `Hauteur hors bornes: ${hauteur}`);

    // Épaisseur (axe local perpendiculaire à la piste, ici Z car piste droite sur X)
    // Sur une piste droite (z=0, cap=0), r2 est l'axe Z. L'épaisseur est sur r2.
    // Donc l'épaisseur est mesurée sur Z (axe 2).
    const epaisseur = max[2] - min[2];
    assert.ok(Math.abs(epaisseur - 0.30) <= 0.05, `Épaisseur hors bornes: ${epaisseur}`);
  }
});
