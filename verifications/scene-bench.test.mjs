// Terrain et voitures de production, renderer instrumenté : contrat de scène, pas mesure GPU.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
// Aucune vraie course : la simulation du parcours passe par une course de chauffe jetable (src/course.js, chauffe,
// vérifiée dans simulation-sorties.test.mjs), remplacée ici par un compteur. Records et stockage interdits.
const chauffes = [];
let totalChauffe = null;
B.course = { creer() { throw Error('aucune course pendant la calibration'); },
  chauffe(c, o) {
    const s = { c, o, pas: 0, total: totalChauffe ?? Math.round(o.secondes * 120), get reste() { return this.total - this.pas; },
      avancer(n) { this.pas += n; return this.pas < this.total; } };
    chauffes.push(s); return s;
  } };
globalThis.localStorage = { getItem() { throw Error('pas de lecture de records'); }, setItem() { throw Error('pas d’écriture de records'); } };

const p = B.sceneBench.creer(faux, capacites);
assert.equal(p.terminer, null, 'sans contexte lisible, aucune fin forcée factice');
let info = p.preparer('medium', B.autoconfig.profils.medium);
assert.deepEqual(chrono, [false], 'le chronomètre GPU du moteur reste fermé : ses requêtes coupent les passes des cartes à tuiles');
assert.ok(monde && nappes.length && lots.length);
// Dans Node, ni document ni FRender : aucun moteur des glaces, le parcours les dit absentes.
assert.deepEqual(info, { glaces: 'absentes', glacesParImage: .5, glacesTemporaires: false, cockpit: true, toile: null });
assert.equal(p.positions.length, 3);
assert.equal(p.positions[0], B.sceneBench.DEPART); assert.equal(B.sceneBench.DEPART, 800);
for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.abs(p.positions[i] - p.positions[j]) > 300);
// les deux points de vue de poursuite : herbe des deux côtés de la piste
for (const s of p.positions.slice(1)) {
  const e = B.circuit.echantillon(circuitMesure, s), dx = Math.sin(e.cap) * 17, dz = Math.cos(e.cap) * 17;
  assert.ok(decorMesure.surfaceHerbe(e.x + dx, e.z - dz) && decorMesure.surfaceHerbe(e.x - dx, e.z + dz), 'herbe à ' + s);
}
for (let i = 0; i < 3; i++) p.dessiner(i * .3, i);
assert.equal(images, 3); assert.equal(p.images, 3);
assert.equal(renduCourant.effets.shadows, true); assert.equal(renduCourant.effets.msaa, true);
assert.deepEqual(renduCourant.effets.groundCover, B.graphismes.PRAIRIE.medium);
// Simulation : deux pas de 1/120 s par image, comme en course, sur une course de chauffe du tracé du parcours.
assert.equal(chauffes.length, 1); assert.strictEqual(chauffes[0].c, circuitMesure, 'la course jetable roule sur le tracé du parcours');
assert.equal(chauffes[0].o.secondes, 60); assert.equal(chauffes[0].pas, 6); assert.equal(p.pasSimulation, 6);
p.simuler(15); assert.equal(chauffes[0].pas, 21, 'simuler(n) seul, pendant les images à vide');

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
assert.ok(chrono.every(v => v === false), 'chronomètre jamais ouvert');
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

// Le parcours contient l'endroit le plus chargé de la course (départ de la séance de référence de Val-Brûlé, vu du
// cockpit) et les glaces des rétroviseurs au rythme de la course, différées jusqu'à activerGlaces.
const VAL_BRULE = { graine: 11, theme: 'foret', longueur: 4200 };
const glacesVues = [], lectG = [];
let lotsGlaces = null, nappesGlaces = null, mondeGlaces = null;
const toileGlaces = { width: 495, height: 150 };
const glacesRendu = { gl: { RGBA: 1, UNSIGNED_BYTE: 2, canvas: toileGlaces, readPixels(...a) { lectG.push(a); } },
  setWorld(o, l, atm) { mondeGlaces = atm; }, setNappes(v) { nappesGlaces = v; }, setLots(v) { lotsGlaces = v; },
  draw(camera, objets, effets) {
    assert.ok(camera.pos.every(Number.isFinite) && Number.isFinite(camera.yaw) && Number.isFinite(camera.pitch));
    assert.ok(camera.fov > 5 && camera.fov < 20, 'champ de la glace : ' + camera.fov);
    assert.ok(objets.length > 50 && objets.every(o => !o.overlay), 'ni habitacle ni pièces « overlay » dans la glace');
    glacesVues.push({ image: images, effets });
  } };
// Copie 2D de chaque glace, comme le jeu la pose sur le rétroviseur : une toile du document, jamais affichée.
const copies = [], toiles = [];
globalThis.document = { createElement(tag) {
  const t = { tag, width: 300, height: 150, getContext: k => k === '2d' ? { drawImage: (...a) => copies.push({ t, a }) } : null };
  toiles.push(t); return t;
} };
const lect = [];
const course = B.sceneBench.creer({ ...faux, gl: { RGBA: 1, UNSIGNED_BYTE: 2, canvas: { width: 2880, height: 1864 }, readPixels(...a) { lect.push(a); } } }, capacites, { glaces: glacesRendu });
const vb = B.circuit.creer(VAL_BRULE.graine, { theme: VAL_BRULE.theme, longueur: VAL_BRULE.longueur, nom: 'Val-Brûlé' });
// même tracé que Val-Brûlé : le point de départ de la séance de référence est bien le même endroit
for (const s of [0, 800, 2100]) {
  const a = B.circuit.echantillon(vb, s), b = B.circuit.echantillon(circuitMesure, s);
  assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.y - b.y) < 1e-6, 'tracé de Val-Brûlé à ' + s);
}
assert.equal(circuitMesure.longueur, vb.longueur);
info = course.preparer('medium', B.autoconfig.profils.medium, { chronoGPU: false, glaces: 'differees' });
assert.deepEqual(info, { glaces: 'differees', glacesParImage: .5, cockpit: true, toile: [2880, 1864] }, 'toile : taille de l’image mesurée');
// glaces différées : rien n'est chargé ni dessiné dans leur moteur, seul le moteur principal est terminé
for (let i = 0; i < 4; i++) course.dessiner(i / 60, 0);
assert.equal(glacesVues.length, 0); assert.equal(lotsGlaces, null);
lect.length = 0; course.terminer(); assert.equal(lect.length, 1); assert.equal(lectG.length, 0);
assert.deepEqual(course.activerGlaces(), { glaces: 'dessinees', glacesParImage: .5, glacesTemporaires: false });
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
glacesVues.length = 0; copies.length = 0;
for (let i = 0; i < 8; i++) course.dessiner(i / 60, 0);
assert.equal(glacesVues.length, 4);
for (let i = 0; i < 8; i++) course.dessiner(i / 60, 1 + i % 2);
assert.equal(glacesVues.length, 4, 'pas de glace en vue de poursuite');
assert.ok(renduCourant.camera.pos[1] - B.circuit.echantillon(circuitMesure, course.positions[2]).y > 2, 'vue de poursuite');
assert.equal(renduCourant.overlay, 0, 'pas d habitacle en vue de poursuite');
// chaque glace est copiée dans la toile 2D, à la taille de la toile des glaces
assert.equal(copies.length, 4); assert.ok(copies.every(c => c.a[0] === toileGlaces && c.t.width === 495 && c.t.height === 150));
const g = glacesVues[0].effets;
assert.equal(g.shadows, false); assert.equal(g.bloom, false); assert.equal(g.photo, 0); assert.equal(g.adaptive, false);
assert.deepEqual(g.groundCover, B.graphismes.PRAIRIE.medium); assert.ok(Array.isArray(g.windSources) && g.windSources.length === 12);
// fin forcée sur les deux contextes
lect.length = 0; lectG.length = 0; course.terminer();
assert.equal(lect.length, 1); assert.equal(lectG.length, 1);
// Fine : une glace par image du cockpit
assert.deepEqual(course.preparer('high', B.autoconfig.profils.high, { chronoGPU: false, glaces: 'differees' }), { glaces: 'differees', glacesParImage: 1, cockpit: true, toile: [2880, 1864] });
lect.length = 0; lectG.length = 0; course.terminer(); assert.equal(lectG.length, 0, 'glaces de Fine pas encore actives');
course.activerGlaces();
glacesVues.length = 0;
for (let i = 0; i < 6; i++) course.dessiner(i / 60, 0);
assert.equal(glacesVues.length, 6);
// Légère : pas d'image des glaces en course, aucune ici ; seul le moteur principal est terminé
assert.deepEqual(course.preparer('low', B.autoconfig.profils.low, { chronoGPU: false, glaces: 'differees' }), { glaces: 'aucune', glacesParImage: 0, cockpit: true, toile: [2880, 1864] });
assert.deepEqual(course.activerGlaces(), { glaces: 'aucune', glacesParImage: 0 });
glacesVues.length = 0;
for (let i = 0; i < 4; i++) course.dessiner(i / 60, 0);
assert.equal(glacesVues.length, 0);
lect.length = 0; lectG.length = 0; course.terminer();
assert.equal(lect.length, 1); assert.equal(lectG.length, 0);
course.liberer();

// Sans moteur prêté (premier lancement) : le parcours crée un moteur des glaces temporaire, une fois, après la chauffe,
// et le détruit avec son contexte à la fin.
let fabriques = 0, liberes = 0;
const temporaire = { ...glacesRendu, gl: { ...glacesRendu.gl } };
const seul = B.sceneBench.creer({ ...faux, gl: { RGBA: 1, UNSIGNED_BYTE: 2, readPixels() {} } }, capacites,
  { creerGlaces: () => { fabriques++; return { rendu: temporaire, liberer() { liberes++; } }; } });
seul.preparer('low', B.autoconfig.profils.low, { glaces: 'differees' }); seul.activerGlaces();
assert.equal(fabriques, 0, 'Légère n’a pas de glaces : aucun moteur créé');
seul.preparer('high', B.autoconfig.profils.high, { glaces: 'differees' });
assert.equal(fabriques, 0, 'rien avant activerGlaces');
assert.deepEqual(seul.activerGlaces(), { glaces: 'dessinees', glacesParImage: 1, glacesTemporaires: true });
seul.preparer('medium', B.autoconfig.profils.medium, { glaces: 'differees' }); seul.activerGlaces();
assert.equal(fabriques, 1, 'un seul moteur pour tous les paliers');
glacesVues.length = 0; seul.dessiner(0, 0); seul.dessiner(1 / 60, 0); assert.equal(glacesVues.length, 1);
seul.liberer(); assert.equal(liberes, 1);
// moteur impossible à créer : glaces absentes (la détection resserre sa limite), pas de nouvel essai
let essais = 0;
const rate = B.sceneBench.creer({ ...faux, gl: { RGBA: 1, UNSIGNED_BYTE: 2, readPixels() {} } }, capacites, { creerGlaces: () => { essais++; return null; } });
rate.preparer('high', B.autoconfig.profils.high, { glaces: 'differees' });
assert.deepEqual(rate.activerGlaces(), { glaces: 'absentes', glacesParImage: 1, glacesTemporaires: false });
rate.preparer('medium', B.autoconfig.profils.medium, { glaces: 'differees' }); rate.activerGlaces();
assert.equal(essais, 1); rate.dessiner(0, 0); assert.ok(renduCourant.objets > 50);
rate.liberer();

// Fabrique par défaut : toile .retro-rendu posée dans #jeu, FRender aux options des rétroviseurs de la course
// (src/jeu.js, majGlaces), densité bornée à 1,5 ; détruite avec son contexte.
const cree = [], journal = [];
const jeu = { appendChild(t) { journal.push('pose'); t.parent = jeu; } };
globalThis.document = { createElement(tag) {
  const t = { tag, width: 300, height: 150, className: '', attributs: {}, setAttribute(k, v) { this.attributs[k] = v; }, remove() { journal.push('retire'); },
    getContext: k => k === '2d' ? { drawImage() {} } : null };
  return t;
}, getElementById: id => id === 'jeu' ? jeu : null, body: null };
globalThis.FRender = { create(toile, options) {
  cree.push({ toile, options });
  return { gl: { RGBA: 1, UNSIGNED_BYTE: 2, canvas: toile, readPixels() {}, getExtension: n => n === 'WEBGL_lose_context' ? { loseContext() { journal.push('perdu'); } } : null },
    resize(r) { journal.push('resize ' + r); }, setWorld() {}, setNappes() {}, setLots() {}, draw() {}, dispose() { journal.push('libere'); } };
} };
const defaut = B.sceneBench.creer({ ...faux, gl: { RGBA: 1, UNSIGNED_BYTE: 2, readPixels() {} } }, capacites);
defaut.preparer('high', B.autoconfig.profils.high, { glaces: 'differees' });
assert.equal(defaut.activerGlaces().glacesTemporaires, true);
assert.equal(cree.length, 1); assert.equal(cree[0].toile.className, 'retro-rendu'); assert.equal(cree[0].toile.parent, jeu);
assert.equal(cree[0].toile.attributs['aria-hidden'], 'true');
assert.deepEqual(cree[0].options, { msaa: 0, shadowMapScale: 1, reflections: false, sea: false, overlayLighting: 'world' });
assert.deepEqual(cree[0].options, B.sceneBench.OPTIONS_GLACES);
// mêmes options et même densité que le moteur des rétroviseurs de la course : un changement de l'un sans l'autre se voit
const jeuSource = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const creation = /retro\.rendu = window\.FRender\.create\(source, (\{[^}]*\})\); retro\.rendu\.resize\(Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)\)/.exec(jeuSource);
assert.ok(creation, 'création du moteur des rétroviseurs introuvable dans src/jeu.js');
assert.deepEqual(new Function('return ' + creation[1])(), { ...B.sceneBench.OPTIONS_GLACES });
defaut.liberer();
assert.deepEqual(journal, ['pose', 'resize 1', 'libere', 'perdu', 'retire']);
delete globalThis.FRender; delete globalThis.document;

// Sonde de débit : toile à part de 512 × 512, contexte aux préférences du moteur, une première passe (compilation)
// puis trois, contexte rendu. Une passe très lente arrête la sonde. Sans document ni WebGL2 : pas de sonde.
assert.equal(B.sceneBench.creer({ ...faux }, capacites).sonder(), null, 'Node : pas de sonde');
let heure = 0, dureePasse = () => .5, lien = true, nomMoteur = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)', infoMoteur = true;
const appelsSonde = [], toilesSonde = [];
globalThis.document = { createElement(tag) {
  const t = { tag, width: 300, height: 150, getContext(k, attributs) {
    t.contexte = [k, attributs];
    return k !== 'webgl2' ? null : { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, LINK_STATUS: 3, TRIANGLES: 4, RGBA: 5, UNSIGNED_BYTE: 6, RENDERER: 7937,
      createProgram: () => ({}), createShader: type => ({ type }), shaderSource() {}, compileShader() {}, attachShader() {}, linkProgram() {},
      getProgramParameter: () => lien, useProgram() {}, viewport: (...a) => appelsSonde.push('vue ' + a.join(' ')), getUniformLocation: () => 'u',
      uniform1f() {}, drawArrays: () => { heure += dureePasse(); appelsSonde.push('passe'); }, readPixels: () => appelsSonde.push('lecture'),
      getParameter: p => p === 37446 ? nomMoteur : p === 7937 ? 'WebKit WebGL' : null,
      getExtension: n => n === 'WEBGL_lose_context' ? { loseContext: () => appelsSonde.push('perdu') }
        : n === 'WEBGL_debug_renderer_info' && infoMoteur ? { UNMASKED_RENDERER_WEBGL: 37446 } : null };
  } };
  toilesSonde.push(t); return t;
} };
const sondeur = B.sceneBench.creer({ ...faux }, capacites, { maintenant: () => heure });
let sonde = sondeur.sonder();
assert.deepEqual(sonde, { logiciel: false, passes: [.5, .5, .5], premiere: .5, taille: [512, 512] });
assert.equal(toilesSonde.length, 1); assert.equal(toilesSonde[0].width, 512); assert.equal(toilesSonde[0].height, 512);
assert.deepEqual(toilesSonde[0].contexte, ['webgl2', B.sceneBench.ATTRIBUTS_SONDE]);
assert.deepEqual(appelsSonde, ['vue 0 0 512 512', 'passe', 'lecture', 'passe', 'lecture', 'passe', 'lecture', 'passe', 'lecture', 'perdu']);
// même carte que le moteur : la préférence de puissance du contexte principal (src/moteur/renderer.js)
const moteurSource = readFileSync(new URL('../src/moteur/renderer.js', import.meta.url), 'utf8');
const pref = /getContext\('webgl2',\{[^}]*powerPreference:'([a-z-]+)'/.exec(moteurSource);
assert.ok(pref, 'contexte du moteur introuvable'); assert.equal(B.sceneBench.ATTRIBUTS_SONDE.powerPreference, pref[1]);
// une passe très lente suffit à juger
appelsSonde.length = 0; let passeN = 0; dureePasse = () => (++passeN === 1 ? 50 : 300);
sonde = sondeur.sonder(); assert.deepEqual(sonde.passes, [300]); assert.equal(sonde.premiere, 50); assert.equal(appelsSonde.at(-1), 'perdu');
// rendu logiciel reconnu à son nom : rien n'est compilé ni dessiné ; nom masqué (sans l'extension) : on mesure
for (const nom of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)',
  'llvmpipe (LLVM 15.0.7, 256 bits)', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)']) {
  appelsSonde.length = 0; nomMoteur = nom;
  assert.deepEqual(sondeur.sonder(), { logiciel: true, passes: [], premiere: null, taille: [512, 512] }, nom); assert.deepEqual(appelsSonde, ['perdu']);
}
for (const nom of ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Mesa Intel(R) UHD Graphics (CML GT2)', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)'])
  assert.equal(B.sceneBench.LOGICIEL.test(nom), false, nom + ' est une carte graphique');
infoMoteur = false; appelsSonde.length = 0; dureePasse = () => .5;
assert.equal(sondeur.sonder().logiciel, false, 'nom masqué : la sonde mesure'); assert.equal(appelsSonde.filter(a => a === 'passe').length, 4);
infoMoteur = true; nomMoteur = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)';
// programme refusé : pas de sonde, contexte rendu quand même ; pas de WebGL2 : pas de sonde
appelsSonde.length = 0; lien = false; dureePasse = () => .5;
assert.equal(sondeur.sonder(), null); assert.deepEqual(appelsSonde, ['perdu']);
globalThis.document = { createElement: () => ({ getContext: () => null }) };
assert.equal(sondeur.sonder(), null);
delete globalThis.document;

// Simulation : une course de chauffe neuve quand la précédente arrive à son terme.
totalChauffe = 3; chauffes.length = 0;
const court = B.sceneBench.creer({ ...faux }, capacites);
court.preparer('low', B.autoconfig.profils.low);
court.dessiner(0, 1); court.dessiner(1 / 60, 1);
assert.equal(chauffes.length, 2); assert.equal(court.pasSimulation, 4);
court.liberer(); totalChauffe = null;

B.voiture.poser = poser; delete globalThis.localStorage;
console.log('Scène de détection : vrais décors, douze voitures et leur simulation comme en course, sillage, options de chaque palier, fin forcée, chronomètre fermé, départ de Val-Brûlé au cockpit, glaces différées au rythme de la course, copie 2D, moteur temporaire et sonde de débit vérifiés.');
