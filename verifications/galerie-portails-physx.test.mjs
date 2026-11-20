// Les rayons natifs suivent les six raccords du vrai circuit : galerie et deux tunnels.
// Une tranche de dalle de 4 cm stoppait une voiture à grande vitesse malgré ses quatre appuis.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'route-des-cimes', 'carene', 'botanique', 'ecologie', 'saisons', 'bords', 'decor', 'obstacles', 'solides-physx']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = await chargerPhysX(), c = B.routeDesCimes.creer();
B.bords.limites(c, B.bords.planifier(c));
const scene = B.decor.construire(c, { qualite: 'low', vegetation: false, saison: 'ete' });
c.obstacles = B.obstacles.creer(scene.obstacles);
const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1 }), solides = B.solidesPhysX.installer(world, c, scene);
let rayons = 0, marcheMax = 0;
try {
  assert.equal(c.couverts.length, 3, 'galerie et deux tunnels présents');
  for (const t of c.couverts) for (const [nom, portail, direction] of [['entrée', t.debut, 1], ['sortie', t.fin, -1]]) {
    for (const d of [-5, 0, 5]) {
      let avant = null, dalle = false;
      for (let u = -3; u <= 9; u += .25) {
        const s = portail + direction * u, q = B.circuit.echantillon(c, s);
        const route = q.y - d * Math.sin(q.devers), x = q.x - Math.sin(q.cap) * d, z = q.z + Math.cos(q.cap) * d;
        const hit = world.raycast([x, route + 1, z], [0, -1, 0], 2, { mask: 1, staticOnly: true }); rayons++;
        assert.ok(hit.hit && hit.ny > .8, `${t.nom}, ${nom}, d=${d}, s=${s} : sol réel absent ou vertical`);
        const hauteur = hit.y - route;
        if (avant !== null) {
          const marche = Math.abs(hauteur - avant); marcheMax = Math.max(marcheMax, marche);
          assert.ok(marche < .015, `${t.nom}, ${nom}, d=${d}, s=${s} : marche frontale ${marche} m`);
        }
        if (u >= 7 && solides.acteurs.get(hit.body)?.genre === 'sol-' + t.type) dalle = true;
        avant = hauteur;
      }
      assert.ok(dalle, `${t.nom}, ${nom}, d=${d} : revêtement intérieur conservé après le raccord`);
    }
  }
  console.log(JSON.stringify({ portails: 6, rayons, marcheMax, correctionPhysique: false }));
} finally {
  B.solidesPhysX.liberer(solides); world.dispose(); X.dispose();
}
