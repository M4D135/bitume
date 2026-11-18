// Terrain et voitures de production, renderer instrumenté : contrat de scène, pas mesure GPU.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const nom of ['carene','circuit','main','humain-donnees','humain-corps','conduite','voiture','botanique','ecologie','saisons','vegetation','decor','faune','meteo','sillage','graphismes','autoconfig','scene-bench']) require('../src/' + nom + '.js');
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
    renduCourant = { camera, objets: objets.length, overlay: objets.filter(o => o.overlay).length, effets }; images++;
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
const pointsHerbe = p.positions;
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

// Mesure à l'horloge : le parcours contient l'endroit le plus chargé de la course (départ de la séance de référence
// de Val-Brûlé, vu du cockpit) et, si le jeu prête leur moteur, les glaces des rétroviseurs au rythme de la course.
const VAL_BRULE = { graine: 11, theme: 'foret', longueur: 4200 };
const glacesVues = [], lectG = [];
let lotsGlaces = null, nappesGlaces = null, mondeGlaces = null;
const glacesRendu = { gl: { RGBA: 1, UNSIGNED_BYTE: 2, readPixels(...a) { lectG.push(a); } },
  setWorld(o, l, atm) { mondeGlaces = atm; }, setNappes(v) { nappesGlaces = v; }, setLots(v) { lotsGlaces = v; },
  draw(camera, objets, effets) {
    assert.ok(camera.pos.every(Number.isFinite) && Number.isFinite(camera.yaw) && Number.isFinite(camera.pitch));
    assert.ok(camera.fov > 5 && camera.fov < 20, 'champ de la glace : ' + camera.fov);
    assert.ok(objets.length > 50 && objets.every(o => !o.overlay), 'ni habitacle ni pièces « overlay » dans la glace');
    glacesVues.push({ image: images, effets });
  } };
const lect = [];
const course = B.sceneBench.creer({ ...faux, gl: { RGBA: 1, UNSIGNED_BYTE: 2, readPixels(...a) { lect.push(a); } } }, capacites, { glaces: glacesRendu });
const vb = B.circuit.creer(VAL_BRULE.graine, { theme: VAL_BRULE.theme, longueur: VAL_BRULE.longueur, nom: 'Val-Brûlé' });
// même tracé que Val-Brûlé : le point de départ de la séance de référence est bien le même endroit
for (const s of [0, 800, 2100]) {
  const a = B.circuit.echantillon(vb, s), b = B.circuit.echantillon(circuitMesure, s);
  assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.y - b.y) < 1e-6, 'tracé de Val-Brûlé à ' + s);
}
assert.equal(circuitMesure.longueur, vb.longueur);
// Ancienne méthode (chronomètre) : mêmes points d'herbe qu'avant, aucune glace, même avec leur moteur prêté.
let info = course.preparer('medium', B.autoconfig.profils.medium);
assert.deepEqual(course.positions, pointsHerbe, 'chronomètre : points de vue inchangés');
for (let i = 0; i < 6; i++) course.dessiner(i / 60, 0);
assert.equal(glacesVues.length, 0); assert.equal(lotsGlaces, null);
assert.ok(renduCourant.camera.pos[1] - B.circuit.echantillon(circuitMesure, course.positions[0]).y > 2, 'vue de poursuite');
assert.equal(info.glaces, 'absentes');

info = course.preparer('medium', B.autoconfig.profils.medium, { chronoGPU: false });
assert.deepEqual(info, { glaces: 'dessinees', glacesParImage: .5, cockpit: true });
const pos = course.positions;
assert.equal(pos[0], 800, 'départ de la séance de référence');
for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.abs(pos[i] - pos[j]) > 300);
for (const s of pos.slice(1)) {
  const e = B.circuit.echantillon(circuitMesure, s), dx = Math.sin(e.cap) * 17, dz = Math.cos(e.cap) * 17;
  assert.ok(decorMesure.surfaceHerbe(e.x + dx, e.z - dz) && decorMesure.surfaceHerbe(e.x - dx, e.z + dz), 'herbe à ' + s);
}
// copies des lots pour le moteur des glaces, sans ses tampons, comme en course (src/jeu.js, majGlaces)
assert.ok(lotsGlaces.length === decorMesure.lots.length && lotsGlaces.every((l, i) => l !== decorMesure.lots[i] && l.tampon === null && l.paquet === null));
assert.equal(nappesGlaces.length, decorMesure.nappes.length); assert.equal(mondeGlaces, decorMesure.atmosphere);
// point de vue 0 : œil du pilote, habitacle dessiné
course.dessiner(0, 0);
const eSol = B.circuit.echantillon(circuitMesure, 800), hauteur = renduCourant.camera.pos[1] - eSol.y;
assert.ok(hauteur > .5 && hauteur < 1, 'œil du cockpit : ' + hauteur);
assert.ok(renduCourant.overlay > 20, 'habitacle dessiné : ' + renduCourant.overlay);
let fx = renduCourant.effets;
assert.equal(fx.shadows, true); assert.deepEqual(fx.groundCover, B.graphismes.PRAIRIE.medium);
// Moyenne : une glace une image du cockpit sur deux ; les autres points de vue n'en dessinent pas
glacesVues.length = 0;
for (let i = 0; i < 8; i++) course.dessiner(i / 60, 0);
assert.equal(glacesVues.length, 4);
for (let i = 0; i < 8; i++) course.dessiner(i / 60, 1 + i % 2);
assert.equal(glacesVues.length, 4, 'pas de glace en vue de poursuite');
assert.ok(renduCourant.camera.pos[1] - B.circuit.echantillon(circuitMesure, pos[2]).y > 2);
assert.equal(renduCourant.overlay, 0, 'pas d habitacle en vue de poursuite');
const g = glacesVues[0].effets;
assert.equal(g.shadows, false); assert.equal(g.bloom, false); assert.equal(g.photo, 0); assert.equal(g.adaptive, false);
assert.deepEqual(g.groundCover, B.graphismes.PRAIRIE.medium); assert.ok(Array.isArray(g.windSources) && g.windSources.length === 12);
// fin forcée sur les deux contextes
lect.length = 0; lectG.length = 0; course.terminer();
assert.equal(lect.length, 1); assert.equal(lectG.length, 1);
// Fine : une glace par image du cockpit
assert.deepEqual(course.preparer('high', B.autoconfig.profils.high, { chronoGPU: false }), { glaces: 'dessinees', glacesParImage: 1, cockpit: true });
glacesVues.length = 0;
for (let i = 0; i < 6; i++) course.dessiner(i / 60, 0);
assert.equal(glacesVues.length, 6); assert.equal(course.imagesGlaces, 6);
// Légère : pas d'image des glaces en course, aucune ici ; seul le moteur principal est terminé
assert.deepEqual(course.preparer('low', B.autoconfig.profils.low, { chronoGPU: false }), { glaces: 'aucune', glacesParImage: 0, cockpit: true });
glacesVues.length = 0;
for (let i = 0; i < 4; i++) course.dessiner(i / 60, 0);
assert.equal(glacesVues.length, 0);
lect.length = 0; lectG.length = 0; course.terminer();
assert.equal(lect.length, 1); assert.equal(lectG.length, 0);
course.liberer();
// Sans moteur des glaces prêté : le parcours dit qu'il ne les dessine pas, la détection resserre sa limite.
const seul = B.sceneBench.creer({ ...faux, gl: { RGBA: 1, UNSIGNED_BYTE: 2, readPixels() {} } }, capacites);
assert.deepEqual(seul.preparer('high', B.autoconfig.profils.high, { chronoGPU: false }), { glaces: 'absentes', glacesParImage: 1, cockpit: true });
seul.dessiner(0, 0); assert.ok(renduCourant.objets > 50);
seul.liberer();
B.voiture.poser = poser; delete globalThis.localStorage;
console.log('Scène de détection : vrais décors, douze voitures comme en course, sillage, options de chaque palier, fin forcée, chronomètre fermé, départ de Val-Brûlé au cockpit et glaces au rythme de la course vérifiés.');
