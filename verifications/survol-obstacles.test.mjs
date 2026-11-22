import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/obstacles.js';
import '../src/aeriens.js';

const { obstacles, aeriens } = globalThis.BITUME;

test('le survol retrouve le sommet des emprises orientées, troncs et cylindres', () => {
  const sources = [
    { type: 'box', x: -174, z: 8, hx: 41, hz: 6, angle: .7, ymin: 20, ymax: 54 },
    { type: 'circle', x: 30, z: -16, r: 12, ymin: -4, ymax: 28 },
    { type: 'prism', p: [-21, 19, 6], s: [4, 36, 4], r: [.2, 0, -.12], sides: 16 },
  ];
  const index = obstacles.creer(sources);
  for (let x = -258; x < 97; x += 3) for (let z = -115; z < 94; z += 5) {
    for (const rayon of [0, 18]) {
      let reference = -Infinity;
      for (const o of index.objets) {
        const [x0, x1, z0, z1] = index.boites.subarray(o.id * 4, o.id * 4 + 4);
        const dx = Math.max(0, x0 - x, x - x1), dz = Math.max(0, z0 - z, z - z1);
        if (dx * dx + dz * dz <= rayon * rayon) reference = Math.max(reference, o.ymax);
      }
      assert.equal(obstacles.sommetProche(index, x, z, rayon), reference);
    }
  }
  assert.equal(index.generation, 0, 'aucune mutation du voisinage du simulateur de conduite');
});

test('après un changement de cible, les appareils prennent le relief à destination et restent fixes en pause', () => {
  const n = 1600;
  const c = { ouvert: true, n, pas: 1, longueur: n, x: Float64Array.from({ length: n }, (_, i) => i),
    y: new Float64Array(n), z: new Float64Array(n), cap: new Float64Array(n) };
  c.obstacles = obstacles.creer([{ type: 'box', x: 1300, z: 0, hx: 65, hz: 40, angle: 0, ymin: 125, ymax: 175 }]);
  const etat = aeriens.creer(c, {}), contexte = { qualite: 'high', sTete: 50, sDernier: 48, sol: x => x > 900 ? 125 : 0 };
  const sortie = [];
  function image(t) {
    sortie.length = 0;
    aeriens.dessiner(etat, t, contexte, sortie);
    return sortie.map(o => [...o.p, ...o.r]);
  }
  image(0);
  contexte.sTete = 1300;
  contexte.sDernier = 1298;
  image(.05);
  for (const vol of [etat.volH, ...etat.volD]) {
    assert(vol.pos[0] > 1200 && vol.pos[1] >= 187);
  }
  image(.1);
  const premier = image(.15);
  assert.deepEqual(image(.15), premier, 'deux vues au même temps de course');
});
