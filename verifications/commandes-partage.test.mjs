// Entrées réelles de jeu.js et vraie physique : les deux joueurs ne se volent pas leurs commandes.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = process.argv[3] || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(process.argv[2] || join(root, 'src/jeu.js'), 'utf8');
const { B, CD, DT, circuit, commande } = await import(pathToFileURL(join(root, 'verifications/phase2/outils.mjs')).href);
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
const fabrique = new Function('navigator', 'B', 'session', 'reglages', `
  let ecran = 'course', dernierGeste = 0;
  const actions = [], enCourse = () => ecran === 'course', activerSon = () => {};
  const changerVue = () => actions.push('vue1'), changerVue2 = () => actions.push('vue2');
  const basculerPause = () => { actions.push('pause'); ecran = ecran === 'course' ? 'pause' : 'course'; };
  const sortirDemo = () => { ecran = 'titre'; }, naviguerManette = () => {};
  ${declarations}
  ${['lireManette', 'lireManette2', 'commandesJoueur', 'commandesJoueur2'].map(extraire).join('\n')}
  return { touches, souris, pad, pad2, impulsions2, actions,
    poll: lireManette, j1: commandesJoueur, j2: commandesJoueur2,
    setSession: s => { session = s; }, setScreen: s => { ecran = s; } };
`);
function seance(locaux = [0, 1]) {
  const voitures = Array.from({ length: Math.max(...locaux) + 1 }, (_, id) => ({ id, etat: CD.creer(100, 0) }));
  return { type: 'duo', locaux, course: { voitures, joueur: voitures[locaux[0]] } };
}
function preparer(options = {}) {
  const reglages = { boite: 'auto', aide: .35, ...options.reglages };
  const session = seance(options.locaux), navigator = { pads: [], getGamepads() { return this.pads; } };
  return { reglages, session, navigator, api: fabrique(navigator, B, session, reglages),
    etat: session.course.voitures[session.locaux[1]].etat };
}
const manette = (index = 0, boutons = {}, axe = 0, id = 'manette-' + index) => ({
  index, id, connected: true, axes: [axe],
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
console.log(`${reussis}/${reussis + echecs.length} contrôles commandes partagées tenus`);
if (echecs.length) process.exitCode = 1;
