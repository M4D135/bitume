import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

globalThis.BITUME = globalThis.BITUME || {};
require(resolve(__dirname, '..', 'src', 'lieux.js'));

const B = globalThis.BITUME;

if (!B || !B.lieux || !B.lieux.muretsLacets) {
  console.error('ÉCHEC : fonction muretsLacets non trouvée');
  process.exit(1);
}

// Circuit synthétique rectiligne le long de z (largeur en x)
const longueur = 9700;
const pas = 1;
const largeur = 12;
const graine = 7;
const n = Math.floor(longueur / pas);
const x = new Float32Array(n);
const z = new Float32Array(n);

for (let i = 0; i < n; i++) {
  x[i] = 0;
  z[i] = i * pas;
}

const circuit = { x, z, pas, longueur, largeur, graine };

const lots = B.lieux.muretsLacets(circuit);

// Vérification du nombre de lots
const n1 = Math.ceil((3569 - 3339) / 4);
const n2 = Math.ceil((3900 - 3670) / 4);
const attendu = n1 + n2;

assert.equal(lots.length, attendu, `Nombre de lots incorrect: attendu ${attendu}, obtenu ${lots.length}`);

// Vérification des types et cotes
for (let i = 0; i < lots.length; i++) {
  const lot = lots[i];
  assert.equal(lot.type, 'muret', `Type incorrect pour le lot ${i}`);
  assert.ok(lot.meta.cote === 1 || lot.meta.cote === -1, `Cote invalide pour le lot ${i}`);
}

// Vérification géométrique
for (let i = 0; i < lots.length; i++) {
  const lot = lots[i];
  const nappe = lot.nappes[0];
  const min = nappe.min;
  const max = nappe.max;

  // Hauteur
  const hauteur = max[1] - min[1];
  assert.ok(hauteur >= 0.75 && hauteur <= 0.95, `Hauteur hors bornes pour le lot ${i}: ${hauteur}`);

  // Emprise hors piste : piste le long de z, largeur en x
  const bord_droit = largeur / 2;
  const bord_gauche = -largeur / 2;

  if (lot.meta.cote === 1) {
    assert.ok(min[0] > bord_droit, `Lot ${i} (cote +1) : min[0] (${min[0]}) doit être > bord droit (${bord_droit})`);
  } else {
    assert.ok(max[0] < bord_gauche, `Lot ${i} (cote -1) : max[0] (${max[0]}) doit être < bord gauche (${bord_gauche})`);
  }
}

console.log('SUCCÈS : muretsLacets — tous les tests passent');
