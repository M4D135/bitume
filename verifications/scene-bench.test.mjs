// Terrain et voitures de production, renderer instrumenté : contrat de scène, pas mesure GPU.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const nom of ['carene','circuit','main','humain-donnees','humain-corps','voiture','botanique','ecologie','saisons','vegetation','decor','faune','meteo','graphismes','autoconfig','scene-bench']) require('../src/' + nom + '.js');
const B = globalThis.BITUME;
let decorMesure, circuitMesure;
const construire = B.decor.construire;
B.decor.construire = (c,o) => { circuitMesure = c; decorMesure = construire(c,o); return decorMesure; };
let renduCourant = null, monde = null, nappes = null, lots = null, images = 0;
const faux = { resize(x) { assert.ok(x === 'auto' || x > 0); }, setWorld(objets, lampes, atmosphere) { monde = atmosphere; },
  setNappes(v) { nappes = v; }, setLots(v) { lots = v; }, profile() { return null; }, draw(camera, objets, effets) {
    assert.ok(camera.pos.every(Number.isFinite)); assert.ok(Number.isFinite(camera.yaw));
    assert.equal(camera.fov, 60); assert.equal(effets.adaptive, false);
    assert.ok(objets.length > 50, 'les vraies monoplaces sont dessinées');
    for (const o of objets) { assert.ok(o.p.every(Number.isFinite)); assert.ok(o.s.every(Number.isFinite)); }
    renduCourant = { camera, objets: objets.length, effets }; images++;
  } };
const capacites = B.graphismes.capacites({ msaa: 4, shadowMapScale: 2, reflections: true }, false, 1);
// Interdire les effets de bord les plus importants, même si une future réécriture réutilisait course/jeu.
B.course = { creer() { throw Error('aucune course pendant la calibration'); } };
globalThis.localStorage = { getItem() { throw Error('pas de lecture de records'); }, setItem() { throw Error('pas d’écriture de records'); } };
const p = B.sceneBench.creer(faux, capacites);
p.preparer('medium', B.autoconfig.profils.medium);
assert.ok(monde && nappes.length && lots.length);
assert.equal(p.positions.length, 3);
for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.abs(p.positions[i] - p.positions[j]) > 300);
for (const s of p.positions) {
  const e = B.circuit.echantillon(circuitMesure, s), dx = Math.sin(e.cap) * 17, dz = Math.cos(e.cap) * 17;
  assert.ok(decorMesure.surfaceHerbe(e.x + dx, e.z - dz)); assert.ok(decorMesure.surfaceHerbe(e.x - dx, e.z + dz));
}
for (let i = 0; i < 3; i++) p.dessiner(i * .3, i);
assert.equal(images, 3); assert.equal(p.images, 3);
assert.equal(renduCourant.effets.shadows, true); assert.equal(renduCourant.effets.msaa, true);
assert.deepEqual(renduCourant.effets.groundCover, B.graphismes.PRAIRIE.medium);
p.preparer('low', B.autoconfig.profils.low); p.dessiner(1, 0);
assert.equal(renduCourant.effets.shadows, false); assert.equal(renduCourant.effets.msaa, false);
p.liberer(); delete globalThis.localStorage;
console.log('Scène de détection : vrais décors et voitures, trois zones chargées, options et absence de course/records vérifiés.');
