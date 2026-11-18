// Terrain et voitures de production, renderer instrumenté : contrat de scène, pas mesure GPU.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const nom of ['carene','circuit','main','humain-donnees','humain-corps','voiture','botanique','ecologie','saisons','vegetation','decor','faune','meteo','sillage','graphismes','autoconfig','scene-bench']) require('../src/' + nom + '.js');
const B = globalThis.BITUME;
let decorMesure, circuitMesure, optionsDecor;
const construire = B.decor.construire;
B.decor.construire = (c,o) => { circuitMesure = c; optionsDecor = o; decorMesure = construire(c,o); return decorMesure; };
// Chaque voiture posée : son modèle (complet ou allégé) et sa place, pour comparer à la règle de la course.
const poser = B.voiture.poser, poses = [];
B.voiture.poser = (mod, ev, sortie, options) => { poses.push({ simple: !!(options && options.simple), p: ev.p }); return poser(mod, ev, sortie, options); };
let renduCourant = null, monde = null, nappes = null, lots = null, images = 0;
const chrono = [];
const faux = { resize(x) { assert.ok(x === 'auto' || x > 0); }, setWorld(objets, lampes, atmosphere) { monde = atmosphere; },
  setNappes(v) { nappes = v; }, setLots(v) { lots = v; }, profile(v) { chrono.push(v); return null; }, draw(camera, objets, effets) {
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
assert.equal(p.terminer, null, 'sans contexte lisible, aucune fin forcée factice');
p.preparer('medium', B.autoconfig.profils.medium);
assert.deepEqual(chrono, [false, true], 'détection au chronomètre : le parcours l’ouvre comme avant');
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

// Douze voitures, modèle complet jusqu'à la distance où la course l'allège (une trentaine de pixels de haut).
poses.length = 0; p.dessiner(1.1, 1);
assert.equal(poses.length, 12);
const complet = B.sceneBench.distanceComplete(60), oeil = renduCourant.camera.pos;
assert.ok(complet > 100 && complet < 120, 'distance de la course au champ de 60° : ' + complet);
for (const v of poses) assert.equal(v.simple, Math.hypot(v.p[0] - oeil[0], v.p[2] - oeil[2]) > complet);
assert.ok(poses.filter(v => !v.simple).length >= 10, 'le peloton proche est dessiné en modèles complets');
// Sillage du peloton : les sources de vent de la course plient aussi la prairie du parcours.
const vent = renduCourant.effets.windSources;
assert.ok(Array.isArray(vent) && vent.length === 12 && vent.every(s => s.strength === 1 && Number.isFinite(s.velocity[0])));

// Pour chaque profil de la détection : les options que la course appliquera après elle (src/jeu.js : melange des
// réglages retenus, décor bâti sur la même ancre) sont celles du parcours.
for (const id of Object.keys(B.autoconfig.profils)) {
  const reglages = B.autoconfig.reglages(id);
  const course = B.graphismes.melange(reglages.qualite, 0, { decor: reglages.qualite, capacites, options: reglages });
  p.preparer(id, B.autoconfig.profils[id]); p.dessiner(2, 2);
  const fx = renduCourant.effets;
  assert.equal(optionsDecor.vegetationQualite, course.decor.vegetationQualite, id + ' : végétation du palier');
  assert.equal(optionsDecor.vegetation, course.decor.vegetation, id); assert.equal(optionsDecor.matieres, course.decor.matieres, id);
  assert.deepEqual(fx.groundCover, course.groundCover, id + ' : prairie du palier');
  assert.equal(fx.shadows, course.effets.ombres, id + ' : ombres'); assert.equal(fx.shadowMapScale, course.rendu.shadowMapScale, id);
  assert.equal(fx.msaa, course.rendu.msaa === 4, id); assert.equal(fx.bloom, course.effets.halo, id);
  assert.equal(fx.photo, course.effets.halo ? 1 : 0, id + ' : finition des surfaces comme en course');
  assert.equal(fx.reflections, course.effets.reflets, id); assert.equal(fx.windStrength, course.windStrength, id);
}
assert.equal(optionsDecor.vegetationQualite, 'ultra');

p.preparer('low', B.autoconfig.profils.low); p.dessiner(1, 0);
assert.equal(renduCourant.effets.shadows, false); assert.equal(renduCourant.effets.msaa, false); assert.equal(renduCourant.effets.photo, 0);

// Mesure à l'horloge : le chronomètre GPU reste fermé pendant tout le parcours.
chrono.length = 0; p.preparer('medium', B.autoconfig.profils.medium, { chronoGPU: false });
assert.deepEqual(chrono, [false]);
p.liberer();

// Fin forcée : un pixel lu sur le contexte du moteur, dans un tampon réutilisé.
const lectures = [];
const gl = { RGBA: 0x1908, UNSIGNED_BYTE: 0x1401, readPixels(...a) { lectures.push(a); } };
const lisible = B.sceneBench.creer({ ...faux, gl }, capacites);
assert.equal(typeof lisible.terminer, 'function');
lisible.terminer(); lisible.terminer();
assert.equal(lectures.length, 2);
assert.deepEqual(lectures[0].slice(0, 6), [0, 0, 1, 1, 0x1908, 0x1401]);
assert.ok(lectures[0][6] instanceof Uint8Array && lectures[0][6].length === 4 && lectures[0][6] === lectures[1][6]);
lisible.liberer();
B.voiture.poser = poser; delete globalThis.localStorage;
console.log('Scène de détection : vrais décors, douze voitures comme en course, sillage, options de chaque palier, fin forcée et chronomètre fermé vérifiés.');
