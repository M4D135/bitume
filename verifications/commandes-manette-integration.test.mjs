// Raccord réel de la capture jusqu'aux commandes de course. Le DOM est réduit
// aux boutons de réglage ; le parcours visuel complet appartient au navigateur.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/commandes-manette.js';
import '../src/autoconfig.js';
const B = globalThis.BITUME;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
function extraire(nom) {
  const a = source.indexOf(`  function ${nom}(`); assert(a >= 0, nom);
  let b = source.indexOf('{', a), n = 1;
  for (b++; n && b < source.length; b++) { if (source[b] === '{') n++; else if (source[b] === '}') n--; }
  assert.equal(n, 0); return source.slice(a, b);
}
const declarations = source.slice(source.indexOf('  const touches ='), source.indexOf('  // conduite par position physique'));
const debut = source.indexOf("  $('r-commandes').addEventListener('click', e => {");
const ecouteur = source.slice(debut, source.indexOf('  function manetteConfiguration(', debut));
assert(debut > 0 && ecouteur.includes('r-pad-annuler'));
const fabriquer = new Function('B', 'navigator', 'reglages', 'session', `
  let ecran = 'reglages', retourReglages = 'titre', modePrepa = 'course', dernierGeste = 0, captureTouche = null;
  let sauvegardes = 0; const actions = [], compteurVisites = null;
  const zone = { addEventListener: (_t, f) => zone.click = f, querySelector: () => zone.bouton, bouton: {} };
  const panneau = { hidden: false }, $ = id => id === 'r-commandes' ? zone : panneau;
  const texte = (el, v) => { el.textContent = v; }, majCommandes = () => {};
  const sauverReglages = () => { sauvegardes++; }, activerSon = () => {}, enCourse = () => ecran === 'course';
  const basculerPause = () => { actions.push('pause'); ecran = ecran === 'course' ? 'pause' : 'course'; };
  const changerVue = () => actions.push('vue1'), changerVue2 = () => actions.push('vue2');
  const naviguerManette = nouveau => { for (const i of [0, 1, 9, 12, 13, 14, 15]) if (nouveau(i)) actions.push('menu' + i); };
  const sortirDemo = () => { ecran = 'titre'; };
  ${declarations}
  ${['lireManette', 'lireManette2', 'commandesJoueur', 'commandesJoueur2', 'manetteConfiguration', 'lireCaptureManette'].map(extraire).join('\n')}
  ${ecouteur}
  return { poll: lireManette, commande: commandesJoueur, commande2: commandesJoueur2, actions, panneau,
    get capture() { return captureManette; }, get screen() { return ecran; }, get sauvegardes() { return sauvegardes; },
    screenTo: v => { ecran = v; }, get label() { return zone.bouton.textContent; },
    clic: (action, n = 0) => { const b = { dataset: { padAction: action, n: String(n) } }; zone.click({ target: { closest: () => b } }); },
    bouton: id => zone.click({ target: { id, closest: () => null } }) };
`);
function manette(index = 0) { return { index, id: 'manette-' + index, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })) }; }
const appuyer = (p, i, valeur = 1) => { p.buttons[i] = { value: valeur, pressed: valeur > .5 }; };
function preparer({ duo = false, reglages = {} } = {}) {
  const p = manette(), q = duo ? manette(1) : null;
  const navigator = { pads: q ? [p, q] : [p], getGamepads() { return this.pads; } };
  const joueurs = [{ id: 0, etat: {} }, { id: 1, etat: {} }];
  const session = { type: duo ? 'duo' : 'course', locaux: duo ? [0, 1] : [0], course: { joueur: joueurs[0], voitures: joueurs } };
  const api = fabriquer(B, navigator, reglages, session); api.poll();
  return { api, p, q, navigator, reglages };
}
const neutre = f => { f.api.poll(); f.api.poll(); assert.equal(f.api.capture?.suivi.pret, true); };
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }

verifier('A ouvre une affectation, son maintien ne devient pas la nouvelle commande', () => {
  const f = preparer(); appuyer(f.p, 0); f.api.clic('gaz');
  for (let i = 0; i < 3; i++) f.api.poll();
  assert.equal(f.api.capture.suivi.pret, false); assert.equal(f.api.sauvegardes, 0); assert.deepEqual(f.api.actions, []);
  appuyer(f.p, 0, 0); neutre(f); assert.equal(f.api.label, 'Actionnez…'); appuyer(f.p, 2, .8); f.api.poll();
  assert.equal(f.api.capture, null); assert.equal(f.api.sauvegardes, 1); assert.equal(f.reglages.commandes[0], 'manette');
  assert.deepEqual(f.reglages.manettes[0].gaz, [{ type: 'bouton', index: 2 }]);
  f.api.screenTo('course'); f.api.poll(); assert.equal(f.api.commande().gaz, .8); assert.equal(f.api.commande().derive, false);
});
for (const touche of [1, 9]) verifier('annuler avec bouton ' + touche + ' reste dans les réglages sans action double', () => {
  const f = preparer(); f.api.clic('gaz'); neutre(f); appuyer(f.p, touche); f.api.poll(); f.api.poll();
  assert.equal(f.api.capture, null); assert.equal(f.api.screen, 'reglages'); assert.equal(f.api.sauvegardes, 0); assert.deepEqual(f.api.actions, []);
  appuyer(f.p, touche, 0); f.api.poll();
});
verifier('le bouton utilisé pour affecter la vue ne valide pas le menu ni la première image de course', () => {
  const f = preparer(); f.api.clic('vue'); neutre(f); appuyer(f.p, 0); f.api.poll(); f.api.poll();
  assert.deepEqual(f.api.actions, []); f.api.screenTo('course'); f.api.poll(); assert.deepEqual(f.api.actions, []);
  appuyer(f.p, 0, 0); f.api.poll(); appuyer(f.p, 0); f.api.poll(); assert.deepEqual(f.api.actions, ['vue1']);
});
verifier('capture perdue au débranchement attend la reconnexion et le relâchement', () => {
  const f = preparer(); f.api.clic('gaz'); neutre(f); f.navigator.pads = []; f.api.poll();
  assert.equal(f.api.capture.suivi.raison, 'deconnectee'); assert.equal(f.api.sauvegardes, 0);
  appuyer(f.p, 2); f.navigator.pads = [f.p]; f.api.poll(); assert.equal(f.api.sauvegardes, 0);
  appuyer(f.p, 2, 0); neutre(f); appuyer(f.p, 2); f.api.poll(); assert.equal(f.api.sauvegardes, 1);
});
verifier('le bouton Annuler reste une issue même sans manette reçue', () => {
  const f = preparer(); f.navigator.pads = []; f.api.poll(); f.api.clic('gaz'); f.api.poll();
  assert(f.api.capture); f.api.bouton('r-pad-annuler'); f.api.poll();
  assert.equal(f.api.capture, null); assert.equal(f.api.sauvegardes, 0); assert.equal(f.api.screen, 'reglages');
});
verifier('fermer le panneau Commandes annule la capture sans sauvegarder', () => {
  const f = preparer(); f.api.clic('gaz'); neutre(f); f.api.panneau.hidden = true; appuyer(f.p, 2); f.api.poll();
  assert.equal(f.api.capture, null); assert.equal(f.api.sauvegardes, 0);
});
verifier('la capture de J2 conserve J1 et se retrouve après rechargement des réglages', () => {
  const f = preparer({ duo: true }); f.api.clic('gaz', 1); neutre(f); appuyer(f.q, 2, .9); f.api.poll();
  assert.equal(f.api.sauvegardes, 1); assert.deepEqual(f.reglages.manettes[0].gaz, B.commandesManette.DEFAUT.gaz);
  const g = preparer({ duo: true, reglages: JSON.parse(JSON.stringify(f.reglages)) });
  g.api.screenTo('course'); appuyer(g.p, 7, .4); appuyer(g.q, 2, .9); g.api.poll();
  assert.equal(g.api.commande().gaz, .4); assert.equal(g.api.commande2().gaz, .9); assert.equal(g.api.commande2().derive, false);
});
verifier('rétablir les manettes conserve les touches clavier personnalisées', () => {
  const f = preparer({ reglages: { touches: [{ gaz: ['KeyZ'] }, {}] } });
  f.api.clic('gaz'); neutre(f); appuyer(f.p, 2); f.api.poll(); f.api.bouton('r-pad-defaut');
  assert.deepEqual(f.reglages.manettes[0], B.commandesManette.DEFAUT); assert.deepEqual(f.reglages.touches[0].gaz, ['KeyZ']);
});
for (const nombre of [1, 2]) verifier('J1 réglé Clavier peut affecter la manette directement, ' + nombre + ' contrôleur(s)', () => {
  const f = preparer({ duo: true, reglages: { commandes: ['clavier', 'auto'] } });
  if (nombre === 1) { f.navigator.pads = [f.p]; f.api.poll(); }
  f.api.clic('gaz', 0); neutre(f); appuyer(f.p, 2, .8); f.api.poll();
  assert.equal(f.api.capture, null); assert.equal(f.reglages.commandes[0], 'manette');
  assert.deepEqual(f.reglages.manettes[0].gaz, [{ type: 'bouton', index: 2 }]);
  assert.deepEqual(f.reglages.manettes[1].gaz, B.commandesManette.DEFAUT.gaz);
  f.api.screenTo('course'); f.api.poll(); assert.equal(f.api.commande().gaz, .8); assert.equal(f.api.commande2().gaz, 0);
});
console.log(`${controles}/${controles} contrôles capture manette intégrée tenus`);
