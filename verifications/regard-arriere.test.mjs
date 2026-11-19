// Le vrai raccord de rendreVue lit les vraies affectations Gamepad ; ses rayons utilisent le WASM PhysX embarqué.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite']) require('../src/' + f + '.js');
const B = globalThis.BITUME;
// Le montage cinéma d'une autre branche peut ajouter cette sélection au même raccord ; aucun plan cinéma ici.
B.cinema ||= { VUES: [] };
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function extraire(nom) {
  const debut = source.indexOf(`  function ${nom}(`); assert(debut >= 0, nom);
  let fin = source.indexOf('{', debut), niveau = 1;
  for (fin++; niveau && fin < source.length; fin++) {
    if (source[fin] === '{') niveau++;
    else if (source[fin] === '}') niveau--;
  }
  assert.equal(niveau, 0); return source.slice(debut, fin);
}
const declarations = source.slice(source.indexOf('  const touches ='), source.indexOf('  // conduite par position physique'));
const debutVue = source.indexOf('  function rendreVue('), finVue = source.indexOf('    if (cameraEssai)', debutVue);
assert(debutVue >= 0 && finVue > debutVue);
const raccord = source.slice(debutVue, finVue) + '    return cam;\n  }';
const ligne = nom => { const m = source.match(new RegExp('^  const ' + nom + ' = [^\\n]+;', 'm')); assert(m, nom); return m[0]; };
const fabrique = new Function('navigator', 'B', 'session', 'reglages', 'poses', `
  let ecran = 'course', dernierGeste = 0;
  const enCourse = () => ecran === 'course', activerSon = () => {}, naviguerManette = () => {};
  const changerVue = () => {}, changerVue2 = () => {}, basculerPause = () => { ecran = ecran === 'course' ? 'pause' : 'course'; };
  const sortirDemo = () => { ecran = 'titre'; }, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a)), PORTEE_VUE = 6000;
  const canvas = { clientWidth: 1280, clientHeight: 720 }, scene = { decor: { sol: () => 0 } };
  const tampons = { poses }, profilDe = () => ({});
  const cameraCockpit = () => ({ pos: [0, 1, 0], yaw: 0, pitch: 0, roll: 0, fov: 60 });
  const cameraTele = cameraCockpit, cameraHelico = cameraCockpit, cameraSol = cameraCockpit, cameraDemo = cameraCockpit;
  ${declarations}
  ${['lireManette', 'lireManette2', 'commandesJoueur', 'commandesJoueur2', 'champAdapte', 'cameraPoursuite', 'regardArriereVoulu', 'cameraRegardArriere'].map(extraire).join('\n')}
  ${['RAYON_REGARD', 'VUES_DEHORS', 'DANS_LA_ROCHE', 'CAMERAS_DEMO'].map(ligne).join('\n')}
  ${raccord}
  return { poll: lireManette, j1: commandesJoueur, j2: commandesJoueur2, pad, pad2,
    camera: (S = session, vue = 'poursuite', suivie = S === session ? session.course.joueur : session.course.voitures[session.locaux[1]]) => rendreVue(S, suivie, vue, 1/60, {}),
    setScreen: v => { ecran = v; }, setSol: f => { scene.decor.sol = f; } };
`);
function manette(index = 0, arriere = 0, options = {}) {
  return { index, id: options.id || 'pad-' + index, connected: true, mapping: 'standard', axes: [options.volant || 0, 0, options.horizontal || 0, arriere],
    buttons: Array.from({ length: 17 }, (_, i) => ({ value: options.boutons?.[i] || 0, pressed: !!options.boutons?.[i] })) };
}
function preparer({ duo = false, locaux = [0, 1], commandes = ['auto', 'auto'], monde = null } = {}) {
  const voitures = Array.from({ length: Math.max(...locaux) + 2 }, (_, id) => ({ id, etat: B.conduite.creer(100, 0) }));
  const co = { c: { tunnel: null }, voitures, joueur: voitures[locaux[0]], physique: monde ? { world: monde } : null };
  const S = { type: duo ? 'duo' : 'course', course: co, locaux, camCap: null, regardArriere: false, sortie: [], rouleVu: [], secousse: 0, tRendu: 1 };
  if (duo) S.vueJ2 = Object.assign(Object.create(S), { camCap: null, regardArriere: false, sortie: [], rouleVu: [] });
  const poses = voitures.map((_, i) => ({ x: 0, y: 0, z: i * 20, cap: 0, tangage: 0, roulis: 0 }));
  const reglages = { commandes, boite: 'auto', aide: .35, vue: 'poursuite', vue2: 'poursuite' };
  const navigator = { pads: [], getGamepads() { return this.pads; } };
  const api = fabrique(navigator, B, S, reglages, poses);
  return { api, navigator, S, poses, reglages };
}
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }
const arriere = cam => cam.regardArriere === true;
const axeX = cam => Math.sin(cam.yaw);

verifier('appui, maintien et relâchement : vrai raccord caméra, retour exact à la poursuite', () => {
  const f = preparer(), p = manette(); f.navigator.pads = [p]; f.api.poll();
  const avant = f.api.camera(); assert(axeX(avant) > .999); assert(avant.pos[0] < 0);
  p.axes[3] = 1; f.api.poll();
  for (let i = 0; i < 10; i++) { const cam = f.api.camera(); assert(arriere(cam)); assert(axeX(cam) < -.999); assert(cam.pos[0] > 0); }
  p.axes[3] = 0; f.api.poll(); const apres = f.api.camera(); assert(!arriere(apres)); assert.deepEqual(apres, avant);
  assert.equal(f.reglages.vue, 'poursuite');
});
verifier('zone morte et hystérésis : pas de flottement, ni de déclenchement sur un autre axe', () => {
  const f = preparer(), p = manette(); f.navigator.pads = [p]; f.api.poll();
  for (const [a, attendu] of [[.54, false], [.55, true], [.45, true], [.35, true], [.34, false], [.50, false], [-1, false], [NaN, false], [undefined, false]]) {
    p.axes[3] = a; f.api.poll(); assert.equal(arriere(f.api.camera()), attendu, 'axe ' + a);
  }
  p.axes = [1, 1, 1, 0]; p.buttons[11] = { value: 1, pressed: true }; f.api.poll(); assert(!arriere(f.api.camera()));
});
verifier('pédales, volant, rapports et état de voiture sont identiques avec le regard arrière', () => {
  const a = preparer(), b = preparer();
  a.navigator.pads = [manette(0, 0, { volant: .6, boutons: { 7: .8, 6: .2 } })];
  b.navigator.pads = [manette(0, 1, { volant: .6, boutons: { 7: .8, 6: .2 } })];
  const avant = JSON.stringify(b.S.course);
  a.api.poll(); b.api.poll(); assert.deepEqual(b.api.j1(), a.api.j1());
  b.api.camera(); assert.equal(JSON.stringify(b.S.course), avant);
});
verifier('cap de poursuite entretenu pendant le maintien : aucune rotation à rattraper au retour', () => {
  const a = preparer(), b = preparer(); a.navigator.pads = [manette()]; b.navigator.pads = [manette(0, 1)]; a.api.poll(); b.api.poll();
  for (let i = 0; i < 60; i++) { a.poses[0].cap = b.poses[0].cap = i / 100; a.api.camera(); b.api.camera(); }
  b.navigator.pads[0].axes[3] = 0; b.api.poll(); assert.deepEqual(b.api.camera(), a.api.camera());
});
for (const locaux of [[0, 1], [2, 3]]) verifier('écran partagé et voiture locale ' + locaux + ' : seul le joueur concerné regarde derrière', () => {
  const f = preparer({ duo: true, locaux });
  f.navigator.pads = [manette(0, 1), manette(1, 0)]; f.api.poll();
  assert(arriere(f.api.camera())); assert(!arriere(f.api.camera(f.S.vueJ2)));
  f.navigator.pads[0].axes[3] = 0; f.navigator.pads[1].axes[3] = 1; f.api.poll();
  assert(!arriere(f.api.camera())); assert(arriere(f.api.camera(f.S.vueJ2)));
  const nonLocale = f.S.course.voitures.find(v => !locaux.includes(v.id));
  assert(!arriere(f.api.camera(f.S.vueJ2, 'poursuite', nonLocale)));
});
verifier('la manette unique reste affectée au joueur 2 en écran partagé', () => {
  const f = preparer({ duo: true }); f.navigator.pads = [manette(0, 1)]; f.api.poll();
  assert(!arriere(f.api.camera())); assert(arriere(f.api.camera(f.S.vueJ2)));
});
verifier('cockpit, menus, démos, banc et commandes clavier/souris ne prennent pas le regard arrière', () => {
  const f = preparer(); f.navigator.pads = [manette(0, 1)]; f.api.poll(); assert(!arriere(f.api.camera(f.S, 'cockpit')));
  for (const e of ['titre', 'pause', 'reglages', 'preparation', 'resultats', 'demo']) { f.api.setScreen(e); assert(!arriere(f.api.camera()), e); }
  f.api.setScreen('course');
  for (const type of ['demo', 'vitrine']) { f.S.type = type; assert(!arriere(f.api.camera()), type); }
  f.S.type = 'course';
  for (const k of ['banc', 'reference']) { f.S[k] = {}; assert(!arriere(f.api.camera()), k); delete f.S[k]; }
  for (const choix of ['clavier', 'souris']) { f.reglages.commandes[0] = choix; assert(!arriere(f.api.camera()), choix); }
  f.reglages.commandes[0] = 'manette'; assert(arriere(f.api.camera()));
});
verifier('déconnexion, API refusée et changement de manette neutralisent le maintien', () => {
  const f = preparer(); f.navigator.pads = [manette(0, 1)]; f.api.poll(); assert(arriere(f.api.camera()));
  f.navigator.pads = [manette(0, .45, { id: 'autre' })]; f.api.poll(); assert(!arriere(f.api.camera()));
  f.navigator.pads[0].axes[3] = 1; f.api.poll(); assert(arriere(f.api.camera()));
  f.navigator.pads = []; f.api.poll(); assert(!arriere(f.api.camera()));
  f.navigator.pads = [manette(0, 1)]; f.api.poll(); assert(arriere(f.api.camera()));
  f.navigator.getGamepads = () => { throw new Error('refus'); }; f.api.poll(); assert(!arriere(f.api.camera()));
});
verifier('pose rendue en saut et terrain relevé : caméra finie au-dessus du terrain', () => {
  const f = preparer(); f.navigator.pads = [manette(0, 1)]; f.api.poll();
  Object.assign(f.poses[0], { y: 12, cap: .8, tangage: .3, roulis: -.2 }); f.api.setSol(() => 15);
  const cam = f.api.camera(); assert(cam.pos[1] >= 16.4); assert(cam.pos.concat([cam.yaw, cam.pitch, cam.fov]).every(Number.isFinite));
  assert.equal(f.poses[0].y, 12);
});
const X = await chargerPhysX();
for (const obstacle of ['paroi', 'plafond']) verifier('rayon natif PhysX : ne pas traverser ' + obstacle + ' en regardant derrière', () => {
  const w = X.createWorld({ fixedStep: 1/120, maxSubSteps: 1 });
  try {
    w.addBox([0, -.5, 0], [30, .5, 30], { type: 'static', group: 1, queryGroup: 1 });
    const paroi = obstacle === 'paroi';
    w.addBox(paroi ? [4, 3, 0] : [0, 2, 0], paroi ? [.5, 3, 20] : [20, .2, 20], { type: 'static', group: 2, queryGroup: 2 });
    const f = preparer({ monde: w }); f.navigator.pads = [manette(0, 1)]; f.api.poll();
    if (!paroi) f.api.setSol(() => 25); // terrain au-dessus d'une galerie : le plafond doit garder la caméra dedans.
    const n = w._bodies.size, cam = f.api.camera(); assert(arriere(cam));
    if (paroi) assert(cam.pos[0] < 3.5, JSON.stringify(cam.pos)); else assert(cam.pos[1] < 1.8, JSON.stringify(cam.pos));
    assert(cam.pos[1] > .4); assert.equal(w._bodies.size, n);
    const from = [0, 1.1, 0], dir = cam.pos.map((v, k) => v - from[k]), d = Math.hypot(...dir);
    assert(!w.raycast(from, dir, d, { mask: 3, staticOnly: true }).hit);
  } finally { w.dispose(); }
});
verifier('aide en français précise le maintien du stick et la vue concernée', () => {
  assert(source.includes('stick droit maintenu vers le bas pour regarder derrière en vue Poursuite'));
  assert.equal(X.status().worlds, 0);
});
console.log(controles + ' vérifications regard arrière réussies');
