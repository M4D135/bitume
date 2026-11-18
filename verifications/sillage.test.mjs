import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const f of ['sillage', 'graphismes', 'meteo']) require('../src/' + f + '.js');
const B = globalThis.BITUME;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const proche = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const voiture = (id, v = 50, beta = 0) => ({ id, etat: { v, beta, s: 100 } });
const pose = (cap = 0) => ({ x: 30, y: 2, z: -40, cap });

verifier('flux dans la direction de vitesse, distincte du cap de la caisse en dérive', () => {
  const s = B.sillage.creer(), voitures = [voiture(3, 50, .4)], poses = [pose(.4)];
  const original = JSON.stringify({ voitures, poses });
  const [source] = B.sillage.mettreAJour(s, voitures, poses);
  assert.equal(source.id, 3); proche(source.velocity[0], 50); proche(source.velocity[2], 0);
  assert.deepEqual(source.p, [30, 2.35, -40]); assert.equal(s.actifs, 1);
  assert.equal(JSON.stringify({ voitures, poses }), original, 'aucune modification de la simulation');
});
verifier('marche arrière et vitesse signée orientent le sillage correctement', () => {
  const s = B.sillage.creer();
  const [source] = B.sillage.mettreAJour(s, [voiture(0, -3)], [pose(Math.PI / 2)]);
  proche(source.velocity[0], 0); proche(source.velocity[2], -3);
});
verifier('arrêt, épave, tunnel ou données invalides ne produisent aucun souffle artificiel', () => {
  B.circuit = { dansTunnel: (c, s) => s >= c.entree };
  const s = B.sillage.creer();
  for (const [v, p, c] of [
    [voiture(0, 0), pose(), null], [Object.assign(voiture(0), { abandon: true }), pose(), null],
    [voiture(0), pose(), { entree: 90 }], [voiture(0, NaN), pose(), null],
    [voiture(0), { ...pose(), x: Infinity }, null], [null, null, null],
  ]) {
    const [source] = B.sillage.mettreAJour(s, [v], [p], c);
    assert.equal(source.strength, 0); assert.deepEqual(source.velocity, [0, 0, 0]); assert.equal(s.actifs, 0);
  }
});
verifier('pool borné et références identiques pendant 2 000 images, partagées par les vues', () => {
  const s = B.sillage.creer(100), voitures = Array.from({ length: 30 }, (_, i) => voiture(i));
  const poses = voitures.map(() => pose()), liste = B.sillage.mettreAJour(s, voitures, poses);
  const sources = liste.slice(), positions = sources.map(x => x.p), vitesses = sources.map(x => x.velocity);
  assert.equal(liste.length, 16);
  for (let frame = 0; frame < 2000; frame++) {
    poses[0].x += .5;
    assert.strictEqual(B.sillage.mettreAJour(s, voitures, poses), liste);
    for (let i = 0; i < liste.length; i++) {
      assert.strictEqual(liste[i], sources[i]); assert.strictEqual(liste[i].p, positions[i]); assert.strictEqual(liste[i].velocity, vitesses[i]);
    }
  }
  B.sillage.mettreAJour(s, [], []); assert.equal(liste.length, 0);
  B.sillage.mettreAJour(s, voitures, poses); assert.strictEqual(liste[0], sources[0]);
});
verifier('téléportation et vitesses extrêmes ne créent ni impulsion de position ni rayon sans limite', () => {
  const s = B.sillage.creer(), v = voiture(0, 60), p = pose();
  const [source] = B.sillage.mettreAJour(s, [v], [p]);
  p.x += 4000; B.sillage.mettreAJour(s, [v], [p]); proche(source.velocity[0], 60);
  v.etat.v = 1000; B.sillage.mettreAJour(s, [v], [p]);
  assert.equal(source.radius, 8); assert.equal(source.wake, 34);
});
verifier('brume réduite sur les trois biomes, atmosphère source et météo conservées', () => {
  for (const density of [.0011, .0009, .00075]) {
    const base = Object.freeze({ fogDensity: density, fog: [.6, .7, .8], wind: .55 });
    const clair = B.graphismes.atmosphere(base);
    proche(clair.fogDensity / density, .34); assert.strictEqual(clair.fog, base.fog); assert.equal(clair.wind, .55);
    const extinctionAvant = 1 - Math.exp(-density * 1000), extinctionApres = 1 - Math.exp(-clair.fogDensity * 1000);
    assert.ok(extinctionApres < extinctionAvant * .55, 'reliefs plus lisibles à 1 km');
    assert.equal(base.fogDensity, density);
  }
});
verifier('ambiance réutilisée entre vues et images sans perdre pluie, humidité ou vent', () => {
  const m = { pluie: .75, mouille: .4, nuage: .85, eclair: .5, ventX: 2, ventZ: 1 }, buffer = {};
  const attendu = B.meteo.ambiance(m);
  assert.strictEqual(B.meteo.ambiance(m, buffer), buffer); assert.deepEqual(buffer, attendu);
  m.pluie = 0; m.ventX = -2; B.meteo.ambiance(m, buffer);
  assert.deepEqual(buffer, B.meteo.ambiance(m)); assert.equal(buffer.ventX, -2);
});
console.log('sillage et brume : ' + controles + ' contrôles passés');
