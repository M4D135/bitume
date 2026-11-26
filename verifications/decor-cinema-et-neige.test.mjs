// Vérification du mode « Décor Cinéma » (couloir strict sans map complète) et des congères de neige 3D (~50 cm).
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bosquets', 'lieux', 'decor']) {
  require('../src/' + f + '.js');
}
const B = globalThis.BITUME;

test('Décor cinéma : réduction massive des triangles hors couloir et plafond strict des arbres', () => {
  const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200 });
  const complet = B.decor.construire(c, { qualite: 'high', organique: true, vegetation: true, vegetationQualite: 'high', saison: 'ete', decorCinema: false });
  const cinema = B.decor.construire(c, { qualite: 'high', organique: true, vegetation: true, vegetationQualite: 'high', saison: 'ete', decorCinema: true });
  const triTerrain = d => d.nappes.filter(n => n.surfaceType === 'terrain').reduce((s, n) => s + n.indices.length / 3, 0);
  const tComplet = triTerrain(complet), tCinema = triTerrain(cinema);
  assert.ok(tCinema < tComplet * 0.45, `couloir cinéma ${tCinema} tri vs complet ${tComplet} tri`);
  assert.ok(cinema.arbres.length <= 1400, `arbres plafonnés : ${cinema.arbres.length}`);
});

test('Neige 3D réaliste (~50 cm) : bourrelets/congères sculptés en bord de route et herbe ensevelie', () => {
  const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200 });
  const ete = B.decor.construire(c, { qualite: 'high', organique: true, vegetation: true, vegetationQualite: 'high', saison: 'ete', decorCinema: true });
  const hiver = B.decor.construire(c, { qualite: 'high', organique: true, vegetation: true, vegetationQualite: 'high', saison: 'hiver', decorCinema: true });
  assert.equal(hiver.vegetation.tuiles, 0, 'le tapis d’herbe est enseveli sous 50 cm de neige');
  let maxCongere = 0, sommetsCongere = 0;
  for (const nap of hiver.nappes.filter(n => n.surfaceType === 'accotement')) {
    const V = nap.sommets;
    for (let k = 0; k < V.length; k += 13) {
      if (V[k + 9] !== 25) continue;
      const x = V[k], y = V[k + 1], z = V[k + 2];
      // Chercher le point d'axe le plus proche
      let d2Min = Infinity, idx = 0;
      for (let i = 0; i < c.n; i += 2) {
        const d2 = (c.x[i] - x) ** 2 + (c.z[i] - z) ** 2;
        if (d2 < d2Min) { d2Min = d2; idx = i; }
      }
      const dist = Math.sqrt(d2Min);
      if (dist > c.largeur / 2 + 0.5 && dist < c.largeur / 2 + 4.5) {
        const dy = y - c.y[idx];
        if (dy > maxCongere) maxCongere = dy;
        if (dy >= 0.35) sommetsCongere++;
      }
    }
  }
  assert.ok(maxCongere >= 0.44 && maxCongere <= 1.2, `hauteur crête de congère attendue ~50-75 cm, obtenue ${maxCongere.toFixed(2)} m`);
  assert.ok(sommetsCongere > 200, `bourrelets continus des deux côtés de la route (${sommetsCongere} sommets >= 35 cm)`);
  const sommetsEte = ete.nappes.filter(n => n.surfaceType === 'accotement').reduce((s, n) => s + n.sommets.length / 13, 0);
  const sommetsHiver = hiver.nappes.filter(n => n.surfaceType === 'accotement').reduce((s, n) => s + n.sommets.length / 13, 0);
  assert.ok(sommetsHiver > sommetsEte, 'les bandes 3D de congères ajoutent leur vrai relief géométrique');
});
