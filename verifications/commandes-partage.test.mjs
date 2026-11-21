// Entrées réelles de jeu.js et vraie physique : les deux joueurs ne se volent pas leurs commandes.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = process.argv[3] || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(process.argv[2] || join(root, 'src/jeu.js'), 'utf8');
const { B, CD, DT, circuit, commande } = await import(pathToFileURL(join(root, 'verifications/phase2/outils.mjs')).href);
await import(pathToFileURL(join(root, 'src/expressions-pilote.js')).href);
await import(pathToFileURL(join(root, 'src/commandes-manette.js')).href);
await import(pathToFileURL(join(root, 'src/autoconfig.js')).href);
function extraire(nom) {
  const debut = source.indexOf(`  function ${nom}(`);
  assert(debut >= 0, nom);
  let fin = source.indexOf('{', debut), niveau = 1;
  for (fin++; niveau && fin < source.length; fin++) {
    if (source[fin] === '{') niveau++;
    else if (source[fin] === '}') niveau--;
  }
  assert.equal(niveau, 0);
  return source.slice(debut, fin);
}
const declarations = source.slice(source.indexOf('  const touches ='), source.indexOf('  // conduite par position physique'));
const ecouteurs = source.slice(source.indexOf('  // conduite par position physique'), source.indexOf('  let pauseAuto = true'));
const fabrique = new Function('navigator', 'B', 'session', 'reglages', `
  let ecran = 'course', dernierGeste = 0;
  const compteurVisites = null; // Le compteur du titre est hors du contexte isolé de commandes.
  const nomTouche = c => c;
  const actions = [], enCourse = () => ecran === 'course', activerSon = () => {};
  const changerVue = () => actions.push('vue1'), changerVue2 = () => actions.push('vue2');
  const basculerPause = () => { actions.push('pause'); ecran = ecran === 'course' ? 'pause' : 'course'; };
  const sortirDemo = () => { ecran = 'titre'; }, retour = () => {}, couperSon = () => actions.push('son');
  const naviguerManette = nouveau => { for (const i of [0, 1, 12, 13, 14, 15]) if (nouveau(i)) actions.push('menu' + i); };
  const ecouteurs = new Map(), innerWidth = 1000;
  const addEventListener = (type, fn) => { if (!ecouteurs.has(type)) ecouteurs.set(type, []); ecouteurs.get(type).push(fn); };
  ${declarations}
  ${ecouteurs}
  ${['lireManette', 'lireManette2', 'commandesJoueur', 'commandesJoueur2', 'entreeDe'].map(extraire).join('\n')}
  return { touches, souris, pad, pad2, impulsions2, actions,
    poll: lireManette, j1: commandesJoueur, j2: commandesJoueur2, entreeDe,
    event: (type, valeurs = {}) => { const e = { preventDefault() {}, ...valeurs }; for (const fn of ecouteurs.get(type) || []) fn(e); },
    get screen() { return ecran; },
    setSession: s => { session = s; }, setScreen: s => { ecran = s; } };
`);
function seance(locaux = [0, 1]) {
  const voitures = Array.from({ length: Math.max(...locaux) + 1 }, (_, id) => ({ id, etat: CD.creer(100, 0) }));
  return { type: 'duo', locaux, course: { voitures, joueur: voitures[locaux[0]] } };
}
function preparer(options = {}) {
  const reglages = { boite: 'auto', aide: .35, ...options.reglages };
  const session = seance(options.locaux), navigator = { pads: [], userAgent: options.userAgent || '', getGamepads() { return this.pads; } };
  return { reglages, session, navigator, api: fabrique(navigator, B, session, reglages),
    etat: session.course.voitures[session.locaux[1]].etat };
}
const manette = (index = 0, boutons = {}, axe = 0, id = 'manette-' + index) => ({
  index, id, connected: true, mapping: 'standard', axes: [axe],
  buttons: Array.from({ length: 16 }, (_, i) => ({ value: boutons[i] || 0, pressed: !!boutons[i] }))
});
const activerSouris = api => Object.assign(api.souris, { active: true, gaz: true, x: 650, largeur: 1000 });
const piste = circuit({ R: 80, largeur: 40, limite: 30 });
function charger(etat) {
  etat.v = 30; etat.rapport = 3; etat.beta = .1; etat.volant = -.5;
  Object.assign(etat.derive, { actif: true, sens: 1, duree: 3, charge: 2, niveau: 3, palier: 3, grace: 1, qualite: 1, contre: .5, fenetre: 0 });
}
function deriveTenue(options) {
  const f = preparer(options);
  f.navigator.pads = [manette(0, { 0: 1 })]; f.api.poll();
  assert.equal(f.api.j2().derive, true);
  charger(f.etat);
  return f;
}
function debrancher(f) { f.navigator.pads = []; f.api.poll(); }
let reussis = 0;
const echecs = [];
function test(nom, verifier) {
  try { verifier(); reussis++; console.log('ok ' + nom); }
  catch (e) { echecs.push(nom); console.error('KO ' + nom + ': ' + e.message); }
}

for (const choixJ2 of ['auto', 'souris']) test('clavier J1 Auto et souris J2 ' + choixJ2 + ' simultanés', () => {
  const { api } = preparer({ reglages: { commandes: ['auto', choixJ2] } });
  activerSouris(api); api.touches.add('KeyW');
  assert.equal(api.j1().gaz, 1); // ordre réel du pas de simulation : J1, puis J2
  const j2 = api.j2();
  assert.equal(j2.gaz, 1); assert.equal(j2.volant, .5); assert.equal(api.souris.active, true);
});
test('le statut solo Xbox annonce la manette réellement affectée à J1 en Auto', () => {
  const { api, navigator, session } = preparer({ userAgent: 'Xbox' });
  session.type = 'course'; navigator.pads = [manette(0, { 7: .75 })]; api.poll();
  assert.equal(api.j1().gaz, .75);
  assert.match(api.entreeDe(0, false), /^manette(?: ou |$)/);
  assert.doesNotMatch(api.entreeDe(0, false), /souris|non détectée/);
});
test('le statut duo conserve la seule manette sur J2 en Auto', () => {
  const { api, navigator } = preparer();
  navigator.pads = [manette(0, { 7: .75 })]; api.poll();
  assert.equal(api.j1().gaz, 0); assert.equal(api.j2().gaz, .75);
  assert.doesNotMatch(api.entreeDe(0, true), /manette/);
  assert.match(api.entreeDe(1, true), /^manette(?: ou |$)/);
});
test('le statut solo respecte Clavier explicite et le repli souris Auto sur PC', () => {
  const { api, navigator, session, reglages } = preparer({ reglages: { commandes: ['clavier', 'auto'] } });
  session.type = 'course'; navigator.pads = [manette(0, { 7: 1 })]; api.poll();
  assert.equal(api.j1().gaz, 0); assert.doesNotMatch(api.entreeDe(0, false), /manette|souris/);
  reglages.commandes[0] = 'auto'; navigator.pads = []; api.poll();
  assert.match(api.entreeDe(0, false), /clavier.*souris/);
  reglages.commandes[0] = 'manette';
  assert.equal(api.entreeDe(0, false), 'manette (non détectée)');
});
test('manette J1 Auto et souris J2 explicite simultanées', () => {
  const { api, navigator } = preparer({ reglages: { commandes: ['auto', 'souris'] } });
  navigator.pads = [manette(0, { 7: 1 }, -.6)]; api.poll(); activerSouris(api);
  assert.equal(api.j1().gaz, 1); assert.equal(api.j2().gaz, 1); assert.equal(api.souris.active, true);
});
test('en solo, le clavier reprend toujours la priorité sur sa propre souris Auto', () => {
  const { api, session } = preparer(); session.type = 'course';
  activerSouris(api); api.touches.add('KeyW'); api.j1();
  assert.equal(api.souris.active, false);
});
test('pavé numérique J2 indépendant, puis touches reconfigurées', () => {
  const { api, reglages } = preparer();
  api.touches.add('Numpad8'); api.touches.add('Numpad4');
  assert.equal(api.j1().gaz, 0); assert.equal(api.j1().volant, 0);
  assert.equal(api.j2().gaz, 1); assert.equal(api.j2().volant, -1);
  reglages.touches = [{}, { gaz: ['KeyI'], gauche: ['KeyJ'] }];
  assert.equal(api.j2().gaz, 0); assert.equal(api.j2().volant, 0);
  api.touches.add('KeyI'); api.touches.add('KeyJ');
  assert.equal(api.j2().gaz, 1); assert.equal(api.j2().volant, -1);
});
test('impulsion de rapport clavier J2 applique la boîte manuelle dans la vraie conduite', () => {
  const { api, etat } = preparer({ reglages: { boite: 'manuelle' } });
  api.impulsions2.haut = true;
  const cmd = api.j2(); assert.equal(cmd.boite, 'manuelle');
  CD.pas(etat, cmd, piste, DT); assert.equal(etat.rapport, 2);
  assert.equal(api.j2().haut, false);
});
for (const [bouton, action, depart, arrivee] of [[5, 'haut', 1, 2], [4, 'bas', 2, 1]])
  test('manette J2 : ' + action + ' sur un seul front, avec rapport réellement passé', () => {
    const { api, etat, navigator } = preparer({ reglages: { boite: 'manuelle' } });
    navigator.pads = [manette()]; api.poll();
    navigator.pads = [manette(0, { [bouton]: 1 })]; api.poll();
    const cmd = api.j2(); assert.equal(cmd[action], true); assert.equal(api.j1()[action], false);
    etat.rapport = depart; CD.pas(etat, cmd, piste, DT); assert.equal(etat.rapport, arrivee);
    api.poll(); assert.equal(api.j2()[action], false);
    navigator.pads = [manette()]; api.poll();
    navigator.pads = [manette(0, { [bouton]: 1 })]; api.poll(); assert.equal(api.j2()[action], true);
  });
test('RB et LB déjà tenus à la connexion de J2 ne passent pas un rapport', () => {
  const { api, navigator } = preparer({ reglages: { boite: 'manuelle' } });
  navigator.pads = [manette(0, { 4: 1, 5: 1 })]; api.poll();
  const cmd = api.j2(); assert.equal(cmd.haut, false); assert.equal(cmd.bas, false);
});
test('oracle : un relâchement normal de dérive lance bien le turbo III', () => {
  const etat = CD.creer(100, 0); charger(etat);
  const ev = CD.pas(etat, commande({ derive: false }), piste, DT);
  assert(ev.some(e => e.type === 'turbo' && e.niveau === 3));
});
for (const locaux of [[0, 1], [2, 3]]) test('déconnexion J2 sans turbo ni effet sur J1, voitures locales ' + locaux, () => {
  const f = deriveTenue({ locaux }); charger(f.session.course.joueur.etat);
  debrancher(f);
  const ev = CD.pas(f.etat, f.api.j2(), piste, DT);
  assert(!ev.some(e => e.type === 'turbo'), JSON.stringify(ev));
  assert.equal(f.etat.turbo.reste, 0); assert.equal(f.etat.derive.actif, false);
  assert.equal(f.session.course.joueur.etat.derive.actif, true);
});
for (const touche of ['Numpad0', 'KeyU']) test('déconnexion préserve la dérive clavier J2 encore tenue : ' + touche, () => {
  const f = deriveTenue({ reglages: { touches: [{}, { derive: [touche] }] } });
  f.api.touches.add(touche); debrancher(f);
  assert.equal(f.etat.derive.actif, true); assert.equal(f.api.j2().derive, true);
});
test('déconnexion préserve la dérive souris encore tenue par J2', () => {
  const f = deriveTenue(); activerSouris(f.api); f.api.souris.derive = true;
  debrancher(f);
  assert.equal(f.etat.derive.actif, true); assert.equal(f.api.j2().derive, true);
});
test('la souris de J1 ne préserve pas une dérive abandonnée par J2', () => {
  const f = deriveTenue({ reglages: { commandes: ['souris', 'auto'] } });
  activerSouris(f.api); f.api.souris.derive = true; debrancher(f);
  assert.equal(f.etat.derive.actif, false); assert.equal(f.api.j2().derive, false);
});
test('déconnexion en pause annule la dérive propre à J2', () => {
  const f = deriveTenue(); f.api.setScreen('pause'); debrancher(f);
  assert.equal(f.etat.derive.actif, false); assert.deepEqual(f.api.actions, []);
});
test('une nouvelle séance est préservée à la déconnexion de l’ancien contrôleur', () => {
  const f = deriveTenue(), suivante = seance();
  charger(suivante.course.voitures[1].etat); f.api.setSession(suivante); debrancher(f);
  assert.equal(suivante.course.voitures[1].etat.derive.actif, true);
  assert.equal(f.etat.derive.actif, true);
});
test('dérive non commandée par la manette et turbo déjà lancé restent intacts', () => {
  const f = preparer(); f.navigator.pads = [manette()]; f.api.poll(); f.api.j2();
  charger(f.etat); debrancher(f); assert.equal(f.etat.derive.actif, true);
  const g = deriveTenue(); g.etat.derive.actif = false; g.etat.turbo.reste = 1.2;
  debrancher(g); assert.equal(g.etat.turbo.reste, 1.2);
});
test('API manette refusée neutralise J2 sans turbo fantôme', () => {
  const f = deriveTenue(); f.navigator.getGamepads = () => { throw new DOMException('Gamepad forbidden', 'SecurityError'); };
  assert.doesNotThrow(() => f.api.poll());
  const ev = CD.pas(f.etat, f.api.j2(), piste, DT);
  assert(!ev.some(e => e.type === 'turbo')); assert.equal(f.etat.derive.actif, false);
});

for (const locaux of [[0, 1], [2, 3]]) test('en pause, la manette de J2 reste à J2, voitures locales ' + locaux, () => {
  const { api, navigator } = preparer({ locaux });
  navigator.pads = [manette(0, { 7: 1 })]; api.poll();
  assert.deepEqual([api.j1().gaz, api.j2().gaz], [0, 1]);
  api.setScreen('pause'); api.poll();
  // En ligne, ces commandes continuent à alimenter la simulation pendant la pause.
  assert.deepEqual([api.j1().gaz, api.j2().gaz], [0, 1]);
  assert.equal(api.pad.manette, null); assert.equal(api.pad2.manette.index, 0);
  api.setScreen('course'); api.poll();
  assert.deepEqual([api.j1().gaz, api.j2().gaz], [0, 1]);
});
test('une pause conserve la dérive chargée du joueur 2 connecté', () => {
  const f = deriveTenue(); f.api.setScreen('pause'); f.api.poll();
  assert.equal(f.etat.derive.actif, true); assert.equal(f.etat.derive.charge, 2);
  f.api.setScreen('course'); f.api.poll();
  const ev = CD.pas(f.etat, f.api.j2(), piste, DT);
  assert(!ev.some(e => e.type === 'turbo'));
});
test('Start de la seule manette J2 met en pause puis reprend une seule fois par appui', () => {
  const { api, navigator } = preparer();
  navigator.pads = [manette()]; api.poll();
  navigator.pads = [manette(0, { 9: 1 })]; api.poll(); api.poll();
  assert.equal(api.screen, 'pause'); assert.deepEqual(api.actions, ['pause']);
  navigator.pads = [manette()]; api.poll();
  navigator.pads = [manette(0, { 13: 1 })]; api.poll();
  assert.deepEqual(api.actions, ['pause', 'menu13']);
  navigator.pads = [manette()]; api.poll();
  navigator.pads = [manette(0, { 9: 1 })]; api.poll(); api.poll();
  assert.equal(api.screen, 'course'); assert.deepEqual(api.actions, ['pause', 'menu13', 'pause']);
});
test('Start simultané sur deux manettes ne referme pas aussitôt la pause', () => {
  const { api, navigator } = preparer();
  navigator.pads = [manette(0), manette(1)]; api.poll();
  navigator.pads = [manette(0, { 9: 1 }), manette(1, { 9: 1 })]; api.poll(); api.poll();
  assert.equal(api.screen, 'pause'); assert.deepEqual(api.actions, ['pause']);
  navigator.pads = [manette(0), manette(1)]; api.poll();
  navigator.pads = [manette(0, { 9: 1 }), manette(1, { 9: 1 })]; api.poll(); api.poll();
  assert.equal(api.screen, 'course'); assert.deepEqual(api.actions, ['pause', 'pause']);
});
test('Start J2 et A J1 simultanés ouvrent la pause sans en valider aussitôt le menu', () => {
  const { api, navigator } = preparer();
  navigator.pads = [manette(0), manette(1)]; api.poll();
  navigator.pads = [manette(0, { 0: 1 }), manette(1, { 9: 1 })]; api.poll(); api.poll();
  assert.equal(api.screen, 'pause'); assert.deepEqual(api.actions, ['pause']);
});
test('en pause, les choix Clavier J1 et Manette J2 restent respectés avec deux pads branchés', () => {
  const { api, navigator } = preparer({ reglages: { commandes: ['clavier', 'manette'] } });
  navigator.pads = [manette(0, { 7: 1 }), manette(1, { 6: 1 })]; api.poll();
  api.setScreen('pause'); api.poll();
  assert.equal(api.pad.manette, null); assert.equal(api.pad2.manette.index, 0);
  assert.deepEqual([api.j2().gaz, api.j2().frein], [1, 0]);
});
test('pause, réglages et retour en course conservent la manette et la dérive de J2', () => {
  const f = deriveTenue();
  for (const ecran of ['pause', 'reglages', 'pause', 'course']) {
    f.api.setScreen(ecran); f.api.poll();
    assert.equal(f.api.pad.manette, null, ecran); assert.equal(f.api.pad2.manette?.index, 0, ecran);
    assert.equal(f.etat.derive.actif, true, ecran); assert.equal(f.etat.derive.charge, 2, ecran);
  }
});
for (const ecran of ['reglages', 'resultats']) test('la manette J2 navigue dans ' + ecran + ' en restant celle de sa voiture', () => {
  const { api, navigator } = preparer();
  navigator.pads = [manette(0, { 7: 1 })]; api.poll();
  api.setScreen(ecran); api.poll();
  assert.deepEqual([api.j1().gaz, api.j2().gaz], [0, 1]);
  navigator.pads = [manette(0, { 13: 1 })]; api.poll();
  navigator.pads = [manette()]; api.poll();
  navigator.pads = [manette(0, { 0: 1 })]; api.poll();
  assert.deepEqual(api.actions, ['menu13', 'menu0']);
  assert.equal(api.pad.manette, null); assert.equal(api.pad2.manette?.index, 0);
});
test('retour au titre : la manette unique retrouve les menus de la vitrine sans faux appui', () => {
  const { api, navigator } = preparer();
  navigator.pads = [manette()]; api.poll();
  api.setScreen('resultats'); api.poll();
  navigator.pads = [manette(0, { 0: 1 })]; api.poll();
  assert.deepEqual(api.actions, ['menu0']); api.actions.length = 0;
  const vitrine = seance(); vitrine.type = 'vitrine';
  api.setSession(vitrine); api.setScreen('titre');
  api.poll();
  assert.equal(api.pad.manette?.index, 0); assert.equal(api.pad2.manette, null);
  assert.deepEqual(api.actions, []);
  navigator.pads = [manette()]; api.poll();
  navigator.pads = [manette(0, { 13: 1 })]; api.poll();
  assert.deepEqual(api.actions, ['menu13']);
});
for (const choix of ['clavier', 'souris']) test('en solo ' + choix + ', RB/LB/Y du pad ne commandent pas la voiture', () => {
  const { api, navigator, session } = preparer({ reglages: { commandes: [choix, 'auto'], boite: 'manuelle' } });
  session.type = 'course';
  navigator.pads = [manette()]; api.poll();
  navigator.pads = [manette(0, { 5: 1, 3: 1 }, .8)]; api.poll();
  const etat = session.course.joueur.etat, cmd = api.j1();
  CD.pas(etat, cmd, piste, DT);
  assert.equal(etat.rapport, 1); assert.equal(cmd.haut, false); assert.deepEqual(api.actions, []);
  if (choix === 'clavier') assert.equal(cmd.guidage, .15);
  navigator.pads = [manette()]; api.poll();
  navigator.pads = [manette(0, { 4: 1 })]; api.poll();
  etat.rapport = 2; const bas = api.j1(); CD.pas(etat, bas, piste, DT);
  assert.equal(etat.rapport, 2); assert.equal(bas.bas, false);
});
function deriveJ1(reglages = {}) {
  const f = preparer({ reglages }); f.session.type = 'course';
  f.etat = f.session.course.joueur.etat;
  f.navigator.pads = [manette(0, { 0: 1 })]; f.api.poll(); f.api.j1(); charger(f.etat);
  return f;
}
test('J1 conserve la dérive sur sa touche reconfigurée à la perte du pad', () => {
  const f = deriveJ1({ touches: [{ derive: ['KeyU'] }, {}] });
  f.api.touches.add('KeyU'); debrancher(f);
  assert.equal(f.etat.derive.actif, true); assert.equal(f.etat.derive.charge, 2); assert.equal(f.api.j1().derive, true);
});
for (const touche of ['Space', 'ShiftLeft', 'ShiftRight']) test('J1 ne produit pas de turbo à la perte du pad avec une ancienne touche devenue inactive : ' + touche, () => {
  const f = deriveJ1({ touches: [{ derive: ['KeyU'] }, {}] });
  f.api.touches.add(touche); debrancher(f);
  const ev = CD.pas(f.etat, f.api.j1(), piste, DT);
  assert(!ev.some(e => e.type === 'turbo')); assert.equal(f.etat.derive.actif, false); assert.equal(f.etat.turbo.reste, 0);
});
test('J1 conserve la dérive encore tenue à la souris Auto à la perte du pad', () => {
  const f = deriveJ1(); activerSouris(f.api); f.api.souris.derive = true; debrancher(f);
  assert.equal(f.etat.derive.actif, true); assert.equal(f.api.j1().derive, true);
});
test('J1 Clavier : une manette ignorée ne prend pas possession de la dérive clavier', () => {
  const f = preparer({ reglages: { commandes: ['clavier', 'auto'], touches: [{ derive: ['KeyU'] }, {}] } });
  f.session.type = 'course'; const etat = f.session.course.joueur.etat;
  f.api.touches.add('KeyU'); f.navigator.pads = [manette(0, { 0: 1 })]; f.api.poll();
  assert.equal(f.api.j1().derive, true); charger(etat); debrancher(f);
  assert.equal(etat.derive.actif, true); assert.equal(etat.derive.charge, 2);
});
test('J1 Manette : une touche de dérive du clavier désactivé ne conserve pas la charge à la déconnexion', () => {
  const f = deriveJ1({ commandes: ['manette', 'auto'] });
  f.api.touches.add('Space'); debrancher(f);
  const ev = CD.pas(f.etat, f.api.j1(), piste, DT);
  assert(!ev.some(e => e.type === 'turbo')); assert.equal(f.etat.derive.actif, false);
});
for (const type of ['course', 'duo']) test('clic puis molette ignorés sans joueur à la souris, mode ' + type, () => {
  const { api, session } = preparer({ reglages: { commandes: ['clavier', 'manette'], boite: 'manuelle' } });
  session.type = type;
  api.event('pointerdown', { pointerType: 'mouse', buttons: 1, clientX: 650 });
  api.event('wheel', { deltaY: -100 });
  const cmd = api.j1(), cmd2 = api.j2();
  CD.pas(session.course.joueur.etat, cmd, piste, DT);
  assert.equal(cmd.haut, false); assert.equal(cmd2.haut, false); assert.equal(session.course.joueur.etat.rapport, 1);
  assert.equal(api.souris.active, false);
});
for (const joueur of [0, 1]) test('molette réservée au propriétaire souris J' + (joueur + 1), () => {
  const { api, session } = preparer({ reglages: { commandes: joueur ? ['clavier', 'souris'] : ['souris', 'clavier'], boite: 'manuelle' } });
  api.event('pointerdown', { pointerType: 'mouse', buttons: 1, clientX: 650 });
  api.event('wheel', { deltaY: -100 });
  const cmd = [api.j1(), api.j2()];
  for (const i of [0, 1]) CD.pas(session.course.voitures[i].etat, cmd[i], piste, DT);
  assert.equal(session.course.voitures[joueur].etat.rapport, 2);
  assert.equal(session.course.voitures[1 - joueur].etat.rapport, 1);
  assert.equal((joueur ? api.j2() : api.j1()).haut, false);
});
test('Troll : touches J1/J2 distinctes, maintien ignoré, nouveau front accepté', () => {
  const { api, session } = preparer();
  session.expressions = B.expressionsPilote.creer(2, 17);
  const p = session.expressions.pilotes;
  api.event('keydown', { code: 'KeyG', key: 'g' });
  assert(p[0].demande); assert(!p[1].demande);
  p[0].demande = false;
  api.event('keydown', { code: 'KeyG', key: 'g', repeat: true }); assert(!p[0].demande);
  api.event('keydown', { code: 'NumpadDecimal', key: ',' }); assert(p[1].demande);
  api.event('keyup', { code: 'KeyG' }); api.event('keydown', { code: 'KeyG', key: 'g' }); assert(p[0].demande);
});
test('Troll : remappage et écran pause respectés', () => {
  const { api, session } = preparer({ reglages: { touches: [{ troll: ['KeyT'] }, {}] } });
  session.expressions = B.expressionsPilote.creer(2, 17);
  const p = session.expressions.pilotes[0];
  api.event('keydown', { code: 'KeyG', key: 'g' }); assert(!p.demande);
  api.event('keydown', { code: 'KeyT', key: 't' }); assert(p.demande);
  p.demande = false; api.setScreen('pause'); api.event('keydown', { code: 'KeyT', key: 't' }); assert(!p.demande);
});
test('Troll L3 : manette de J2, pas de geste à la connexion ni pendant le maintien', () => {
  const { api, session, navigator } = preparer();
  session.expressions = B.expressionsPilote.creer(2, 17);
  const p = session.expressions.pilotes;
  navigator.pads = [manette(0, { 10: 1 })]; api.poll(); assert(!p[0].demande && !p[1].demande);
  navigator.pads = [manette(0)]; api.poll();
  navigator.pads = [manette(0, { 10: 1 })]; api.poll(); assert(p[1].demande && !p[0].demande);
  p[1].demande = false; api.poll(); assert(!p[1].demande);
});
test('une manette solo neutre garde la priorité sur les clics souris Auto', () => {
  const { api, navigator, session } = preparer(); session.type = 'course';
  navigator.pads = [manette()]; api.poll();
  api.event('pointerdown', { pointerType: 'mouse', clientX: 990, buttons: 1 });
  api.event('pointermove', { pointerType: 'mouse', clientX: 0, buttons: 1 });
  assert.equal(api.souris.active, false);
  const c = api.j1(); assert.deepEqual([c.gaz, c.frein, c.volant], [0, 0, 0]);
  activerSouris(api); // un clic précédant la connexion ne doit pas reprendre la direction.
  const ancien = api.j1(); assert.deepEqual([ancien.gaz, ancien.frein, ancien.volant], [0, 0, 0]);
});
test('le pointeur Auto de Xbox ne devient jamais un volant, même sans Gamepad reçu', () => {
  const { api, session } = preparer({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) Edg/142.0.0.0' });
  session.type = 'course'; api.poll();
  api.event('pointerdown', { pointerType: 'mouse', clientX: 990, buttons: 1 });
  assert.equal(api.souris.active, false);
  const c = api.j1(); assert.deepEqual([c.gaz, c.frein, c.volant], [0, 0, 0]);
});
for (const userAgent of ['', 'Mozilla/5.0 (Xbox; Xbox One) Edg/142']) test('la souris explicitement choisie reste pilotable, console ' + !!userAgent, () => {
  const { api, navigator, session } = preparer({ userAgent, reglages: { commandes: ['souris', 'auto'] } });
  session.type = 'course'; navigator.pads = [manette()]; api.poll();
  api.event('pointerdown', { pointerType: 'mouse', clientX: 650, buttons: 1 });
  const c = api.j1(); assert.equal(api.souris.active, true); assert.equal(c.gaz, 1); assert.equal(c.volant, .5);
});
test('un bouton de l’interface en course n’active pas la conduite souris', () => {
  const { api, session } = preparer(); session.type = 'course';
  api.event('pointerdown', { pointerType: 'mouse', clientX: 990, buttons: 1, target: { closest: () => ({}) } });
  assert.equal(api.souris.active, false); assert.equal(api.j1().gaz, 0);
});
test('une manette neutre J2 ne vole pas le clavier J1 et ignore le pointeur Auto de J2', () => {
  const { api, navigator } = preparer(); navigator.pads = [manette()]; api.poll();
  api.touches.add('KeyW'); api.event('pointerdown', { pointerType: 'mouse', clientX: 990, buttons: 1 });
  assert.equal(api.j1().gaz, 1); const j2 = api.j2(); assert.deepEqual([j2.gaz, j2.volant], [0, 0]);
});
test('RT remplacé par X et vue remplacée par R3 sont réellement lus par la conduite', () => {
  let m = B.commandesManette.affecter(null, 'gaz', { type: 'bouton', index: 2 });
  m = B.commandesManette.affecter(m, 'vue', { type: 'bouton', index: 11 });
  const { api, navigator, session } = preparer({ reglages: { manettes: [m, null] } }); session.type = 'course';
  navigator.pads = [manette()]; api.poll();
  navigator.pads = [manette(0, { 7: .8, 3: 1 })]; api.poll(); assert.equal(api.j1().gaz, 0); assert.deepEqual(api.actions, []);
  navigator.pads = [manette(0, { 2: .7, 11: 1 })]; api.poll();
  const c = api.j1(); assert.equal(c.gaz, .7); assert.equal(c.derive, false); assert.deepEqual(api.actions, ['vue1']);
  api.poll(); assert.deepEqual(api.actions, ['vue1'], 'un maintien ne répète pas la nouvelle vue');
});
test('les affectations manette J1 et J2 restent indépendantes', () => {
  const m = B.commandesManette.affecter(null, 'gaz', { type: 'bouton', index: 2 });
  const { api, navigator } = preparer({ reglages: { manettes: [m, null] } });
  navigator.pads = [manette(0), manette(1)]; api.poll();
  navigator.pads = [manette(0, { 2: .7 }), manette(1, { 2: 1, 7: .4 })]; api.poll();
  const a = api.j1(), b = api.j2();
  assert.deepEqual([a.gaz, a.derive, b.gaz, b.derive], [.7, false, .4, true]);
});
test('une gâchette remappée sur un axe non standard accélère sans clavier', () => {
  const m = B.commandesManette.affecter(null, 'gaz', { type: 'axe', index: 2, sens: 1, origine: -1 });
  const { api, navigator, session } = preparer({ reglages: { manettes: [m, null] } }); session.type = 'course';
  const p = manette(); p.mapping = ''; p.axes = [0, 0, -1]; navigator.pads = [p]; api.poll(); assert.equal(api.j1().gaz, 0);
  p.axes[2] = 1; api.poll(); assert.equal(api.j1().gaz, 1);
  p.axes[2] = -1; api.poll(); assert.equal(api.j1().gaz, 0);
});
test('une action remappée tenue à la reconnexion ne crée pas d’impulsion', () => {
  const m = B.commandesManette.affecter(null, 'vue', { type: 'bouton', index: 11 });
  const { api, navigator, session } = preparer({ reglages: { manettes: [m, null] } }); session.type = 'course';
  navigator.pads = [manette()]; api.poll();
  navigator.pads = [manette(0, { 11: 1 })]; api.poll(); assert.deepEqual(api.actions, ['vue1']);
  navigator.pads = []; api.poll(); navigator.pads = [manette(0, { 11: 1 })]; api.poll(); api.poll();
  assert.deepEqual(api.actions, ['vue1']);
  navigator.pads = [manette()]; api.poll(); navigator.pads = [manette(0, { 11: 1 })]; api.poll();
  assert.deepEqual(api.actions, ['vue1', 'vue1']);
});
console.log(`${reussis}/${reussis + echecs.length} contrôles commandes partagées tenus`);
if (echecs.length) process.exitCode = 1;
