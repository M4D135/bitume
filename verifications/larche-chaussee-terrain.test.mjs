// Géométrie envoyée au rendu, de la ligne de départ jusqu'au bout de la zone de décélération.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'route-des-cimes', 'larche-vinadio-data', 'larche-vinadio',
  'larche-vinadio-decor', 'carene', 'botanique', 'ecologie', 'saisons', 'bords', 'decor']) require('../src/' + f + '.js');
const B = globalThis.BITUME, circuit = B.larche.creer(210);
const decor = B.decor.construire(circuit, { qualite: 'low', organique: true, vegetation: false });
const tuiles = decor.nappes.filter(n => n.surfaceType === 'terrain');
const pas = tuiles[0].sommets[13] - tuiles[0].sommets[0];
const mailles = new Map();

function* triangles(nappe) {
  const v = nappe.sommets, indices = nappe.indices;
  const point = index => v.subarray(index * 13, index * 13 + 3);
  for (let i = 0; i < indices.length; i += 3)
    yield [point(indices[i]), point(indices[i + 1]), point(indices[i + 2]), nappe.surfacesPhysX?.[i / 3]];
}

for (const tuile of tuiles) for (const [a, b, c] of triangles(tuile)) {
  const cle = Math.floor(Math.min(a[0], b[0], c[0]) / pas) + ',' + Math.floor(Math.min(a[2], b[2], c[2]) / pas);
  if (!mailles.has(cle)) mailles.set(cle, []);
  mailles.get(cle).push([a, b, c]);
}

// Intersection verticale avec les triangles indexés du terrain, indépendante de decor.sol.
function terrainDessine(x, z) {
  const candidats = mailles.get(Math.floor(x / pas) + ',' + Math.floor(z / pas));
  assert.ok(candidats, 'maille absente à ' + [x, z]);
  for (const [a, b, c] of candidats) {
    const bx = b[0] - a[0], bz = b[2] - a[2], cx = c[0] - a[0], cz = c[2] - a[2];
    const det = bx * cz - bz * cx, dx = x - a[0], dz = z - a[2];
    const u = (dx * cz - dz * cx) / det, v = (dz * bx - dx * bz) / det;
    if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
      return a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
  }
  assert.fail('triangle absent à ' + [x, z]);
}

test('la chaussée inclinée, les lignes et les vibreurs restent découverts sur les 32,8 km', () => {
  const poids = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [.5, .5, 0], [0, .5, .5], [.5, 0, .5], [1/3, 1/3, 1/3]];
  let controlees = 0, gardeMin = Infinity;
  for (const nappe of decor.nappes.filter(n => n.surfaceType === 'accotement')) {
    for (const [a, b, c, surface] of triangles(nappe)) {
      if (surface !== 1 && surface !== 2) continue;
      for (const [u, v, w] of poids) {
        const x = u * a[0] + v * b[0] + w * c[0], z = u * a[2] + v * b[2] + w * c[2];
        const hauteur = u * a[1] + v * b[1] + w * c[1];
        gardeMin = Math.min(gardeMin, hauteur - terrainDessine(x, z));
      }
      controlees++;
    }
  }
  assert.ok(controlees >= (circuit.n - 1) * 6, 'la chaussée et les deux lignes doivent exister à chaque section');
  assert.ok(gardeMin > .10, 'garde minimale du maillage = ' + gardeMin + ' m');
  for (const pont of circuit.ponts) {
    const q = B.circuit.echantillon(circuit, (pont.debut + pont.fin) / 2);
    assert.ok(q.y - terrainDessine(q.x, q.z) > 5, 'ravin sous ' + pont.nom);
  }
  console.log(controlees + ' triangles routiers, garde minimale mesurée ' + gardeMin.toFixed(3) + ' m');
});

test('les tuiles sont jointives et les points d’appui du décor suivent le triangle affiché', () => {
  const bordures = new Map();
  let doublons = 0;
  for (const tuile of tuiles) {
    const v = tuile.sommets, cote = Math.sqrt(v.length / 13);
    for (let j = 0; j < cote; j++) for (let i = 0; i < cote; i++) {
      if (j && i && i < cote - 1 && j < cote - 1) continue;
      const k = (j * cote + i) * 13, cle = v[k] + ',' + v[k+2];
      if (bordures.has(cle)) {
        assert.equal(v[k + 1], bordures.get(cle), 'joint de tuile ' + cle);
        doublons++;
      } else bordures.set(cle, v[k + 1]);
    }
    for (const [a, b, c] of triangles(tuile)) {
      const x = (a[0] + 2*b[0] + 3*c[0]) / 6, z = (a[2] + 2*b[2] + 3*c[2]) / 6;
      assert.ok(Math.abs(decor.sol(x, z) - (a[1] + 2*b[1] + 3*c[1]) / 6) < 1e-5, 'appui de décor à ' + [x,z]);
    }
  }
  assert.ok(doublons > 0);
});

test('le bitume de la SS21 garde ses pigments, sa géométrie, ses marquages et ses surfaces PhysX', t => {
  const options = { qualite: 'high', organique: true, vegetation: false };
  const route = o => B.decor.construire(circuit, o).nappes.filter(n => n.surfaceType === 'accotement');
  const reference = route({ ...options, matieres: false }), enrichie = route({ ...options, matieres: true });
  assert.equal(reference.length, enrichie.length);
  let modifies = 0;
  for (let i = 0; i < reference.length; i++) {
    const avant = reference[i], apres = enrichie[i], attendu = avant.sommets.slice();
    assert.deepEqual(apres.indices, avant.indices);
    assert.deepEqual(apres.surfacesPhysX, avant.surfacesPhysX);
    for (let k = 9; k < attendu.length; k += 13) {
      if (apres.sommets[k] !== 21.125) continue;
      assert.equal(attendu[k], 14.125);
      assert(attendu[k + 1] < .3, 'le blanc des marquages ne devient pas du goudron');
      attendu[k] = 21.125;
      modifies++;
    }
    assert.deepEqual(apres.sommets, attendu);
  }
  assert(modifies > 10000);
  t.diagnostic(modifies + ' sommets d’asphalte sur ' + enrichie.length + ' nappes routières');
});
