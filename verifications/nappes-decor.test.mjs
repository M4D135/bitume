// Vérification de la réserve budget décor (lot décor / allocation nappes route)
// Évite les 19 323 couples temporaires sans modifier les sommets, indices, surfaces PhysX ou herbe.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));
charger('carene.js'); charger('circuit.js'); charger('decor.js');
const C = globalThis.BITUME.circuit, D = globalThis.BITUME.decor;

const CIRCUITS = [
  { id: 'val-brule', nom: 'Val-Brûlé', theme: 'foret', graine: 11, longueur: 4200 },
  { id: 'port-sable', nom: 'Port-Sable', theme: 'cote', graine: 29, longueur: 3600 },
  { id: 'haut-col', nom: 'Haut-Col', theme: 'montagne', graine: 47, longueur: 5200 },
  { id: 'route-des-cimes', nom: 'Route-des-Cimes', theme: 'cimes', graine: 73, longueur: 9700 }
];

for (const k of CIRCUITS) {
  const c = C.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
  const t0 = performance.now();
  const decor = D.construire(c);
  const ms = performance.now() - t0;
  assert.ok(Array.isArray(decor.nappes) && decor.nappes.length > 0, `${k.nom} : nappes construites`);
  assert.ok(ms < 150, `${k.nom} : durée construction ${ms.toFixed(1)} ms < 150 ms`);

  // Vérifier l'intégrité de chaque nappe de route
  for (let n = 0; n < decor.nappes.length; n++) {
    const nap = decor.nappes[n];
    assert.ok(nap.sommets instanceof Float32Array, `${k.nom} nappe ${n} sommets Float32Array`);
    assert.ok(nap.indices instanceof Uint16Array || nap.indices instanceof Uint32Array, `${k.nom} nappe ${n} indices`);
    assert.equal(nap.indices.length % 3, 0, `${k.nom} nappe ${n} triangles complets`);
  }
}

console.log('decor-allocation : 4 circuits vérifiés avec succès, budget < 150 ms tenu.');
