// 12F2 : vraie migration, vrais contrôles DOM et vrais raccords course, sans WebGL ni transport simulé complet.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'conduite', 'degats', 'contacts', 'course', 'meteo', 'ambiance', 'saisons', 'graphismes']) require('../src/' + nom + '.js');
const B = globalThis.BITUME;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
function fonction(nom) {
  const a = source.indexOf('  function ' + nom + '('), ligne = source.indexOf('\n', a);
  assert.ok(a >= 0, nom + ' présente dans jeu.js');
  if (source.slice(a, ligne).trimEnd().endsWith('}')) return source.slice(a, ligne);
  const z = source.indexOf('\n  }', a);
  assert.ok(z > a, nom + ' complète dans jeu.js');
  return source.slice(a, z + 4);
}
const fonctions = ['initialiserChoixPneus', 'choixPneusLocaux', 'pneusAutomatiques', 'appliquerConseilPneus',
  'choisirPneusPilote', 'majChoixPneus', 'monterPneusDepart', 'choisirPneusStands', 'majPneusStands',
  'preselectionnerPneus', 'cleConditions', 'conditionsDuDepart', 'meteoPourConditions', 'surfaceAnnoncee'].map(fonction).join('\n');
const debutStock = source.indexOf('  const DEFAUT = '), finStock = source.indexOf('  reglages.qualite = ', debutStock);
const debutChange = source.indexOf("  document.addEventListener('change', e => {"), finChange = source.indexOf('\n  });', debutChange) + 6;
assert.ok(debutStock >= 0 && finStock > debutStock && debutChange >= 0 && finChange > debutChange);
const catalogue = source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0];
function dom() {
  const elements = new Map(), groupes = new Map(), ecouteurs = new Map();
  for (const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) elements.set(m[1], {
    hidden: /\bhidden\b/.test(m[0]), disabled: false, textContent: ''
  });
  for (const m of html.matchAll(/<input type="radio" name="([^"]+)" value="([^"]+)"[^>]*>/g)) {
    if (!groupes.has(m[1])) groupes.set(m[1], []);
    groupes.get(m[1]).push({ name: m[1], value: m[2], checked: false });
  }
  return {
    $: id => { assert.ok(elements.has(id), 'élément réellement présent : ' + id); return elements.get(id); },
    groupes, ecouteurs,
    document: { querySelectorAll: s => groupes.get(s.match(/^input\[name="([^"]+)"\]$/)?.[1]) || [],
      addEventListener: (nom, f) => ecouteurs.set(nom, f) }
  };
}
const assembler = new Function('B', 'D', 'stock', `
  let session = null, ecran = 'preparation', modePrepa = 'course', graineCourse = 200;
  let conditionsPreparation = null, conditionsPreparationCle = '';
  const EL = {R: null, role: null, course: null}, sauvegardes = [], messages = [], appels = [];
  const $ = D.$, document = D.document, matchMedia = () => ({matches: false});
  const texte = (n, t) => n.textContent = t;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lireStock = (cle, defaut) => { assertStock(cle); return stock == null ? defaut : structuredClone(stock); };
  function assertStock(cle) { if (cle !== 'bitume.reglages') throw new Error('clé de réglages inattendue'); }
  ${catalogue}
  ${fonctions}
  ${source.slice(debutStock, finStock)}
  const NOMS_PNEUS = B.pneus.NOMS_PNEUS;
  const sauverReglages = () => { appels.push('sauver'); sauvegardes.push(structuredClone(reglages)); };
  const retirerPret = () => appels.push('retirerPret');
  const envoyerPneus = () => { appels.push('envoyer'); messages.push(choixPneusLocaux()); };
  const lienActif = () => false;
  ${source.slice(debutChange, finChange)}
  return { reglages, sauvegardes, messages, appels, EL, ...D,
    initialiserChoixPneus, appliquerConseilPneus, choisirPneusPilote, choixPneusLocaux, pneusAutomatiques,
    majChoixPneus, monterPneusDepart, choisirPneusStands, majPneusStands, preselectionnerPneus,
    changer: (name, value) => D.ecouteurs.get('change')({target: {name, value}}),
    mode: m => {modePrepa = m;}, ecran: n => {ecran = n;}, seance: s => {session = s;}
  };
`);
const creer = stock => assembler(B, dom(), stock);
const circuit = B.circuit.creer(11, {theme: 'foret', longueur: 4200});
function course(o = {}) {
  const co = B.course.creer(circuit, {mode: 'course', graine: 808, rivaux: 3, ...o});
  co.phase = 'course'; co.feux.vert = true; return co;
}
function roues(v) { return structuredClone({pneus: v.etat.pneus, service: v.etat.servicePneus, roues: v.etat.etatPneus, livree: v.livree}); }
function user(co) {
  for (const v of co.voitures) v.etat.etatPneus.forEach((r, k) => Object.assign(r, {usure: .24 + k * .13, salete: .6, distance: 8700}));
}
function selection(a, nom) { return a.groupes.get(nom).filter(r => r.checked).map(r => r.value); }

test('démarrage réel : ancienne préférence recopiée aux deux pilotes sans changer sa valeur', () => {
  for (const type of B.pneus.TYPES_JOUABLES) {
    const stock = {pneus: type, boite: 'manuelle'}, a = creer(stock);
    assert.deepEqual(a.reglages.pneusPilotes, [type, type]);
    assert.deepEqual(a.reglages.pneusAutoPilotes, [false, false]);
    assert.equal(a.reglages.pneus, type); assert.equal(a.reglages.boite, 'manuelle');
    a.changer('pneus2', type === 'neige' ? 'inter' : 'neige');
    assert.equal(a.reglages.pneusPilotes[0], type); assert.deepEqual(stock, {pneus: type, boite: 'manuelle'});
    const recharge = creer(a.sauvegardes.at(-1));
    assert.deepEqual(recharge.reglages.pneusPilotes, a.reglages.pneusPilotes);
    assert.deepEqual(recharge.reglages.pneusAutoPilotes, [false, false]);
  }
});

test('nouveau profil : les conseils suivent la chaussée et chaque choix manuel reste indépendant', () => {
  const a = creer(); assert.deepEqual(a.reglages.pneusAutoPilotes, [true, true]);
  a.appliquerConseilPneus('neige'); assert.deepEqual(a.reglages.pneusPilotes, ['neige', 'neige']);
  a.changer('pneus2', 'inter'); a.appliquerConseilPneus('pluie');
  assert.deepEqual(a.reglages.pneusPilotes, ['pluie', 'inter']);
  assert.deepEqual(a.reglages.pneusAutoPilotes, [true, false]);
  const avant = structuredClone(a.reglages); a.appliquerConseilPneus('constructor');
  assert.deepEqual(a.reglages, avant);
});

test('mode Conseillés : seul le pilote visé suit la prévision, sans dépendre de l’ordre des contrôles', () => {
  const a = creer({pneusPilotes: ['neige', 'pluie'], pneusAutoPilotes: [false, false], meteo: 'soleil', saison: 'ete'});
  a.changer('pneus2', 'auto');
  assert.deepEqual(a.reglages.pneusPilotes, ['neige', 'slicks']);
  assert.deepEqual(a.reglages.pneusAutoPilotes, [false, true]);
  assert.deepEqual(a.appels, ['retirerPret', 'sauver', 'envoyer']);
  a.reglages.saison = 'hiver'; a.preselectionnerPneus();
  assert.deepEqual(a.reglages.pneusPilotes, ['neige', 'neige']);
  assert.deepEqual(selection(a, 'pneus'), ['neige']); assert.deepEqual(selection(a, 'pneus2'), ['auto']);
});

test('réglages anciens ou partiels : les faux types et modes ne deviennent pas des choix valides', () => {
  const a = creer({pneus: 'inter', pneusPilotes: ['constructor', 'neige'], pneusAutoPilotes: ['true']});
  assert.deepEqual(a.reglages.pneusPilotes, ['inter', 'neige']);
  assert.deepEqual(a.reglages.pneusAutoPilotes, [false, false]);
  const avant = structuredClone(a.reglages);
  for (const n of [-1, 2, '1', null]) assert.equal(a.choisirPneusPilote(n, 'pluie'), false);
  for (const type of ['constructor', '__proto__', null, {}, 0]) a.changer('pneus2', type);
  assert.deepEqual(a.reglages, avant); assert.equal(a.sauvegardes.length, 0);
});

test('menus : le second choix est masqué seul et visible pour le vrai nombre de pilotes locaux', () => {
  const a = creer({pneusPilotes: ['slicks', 'neige']});
  a.majChoixPneus(); assert.equal(a.$('o-pneus-2').hidden, true); assert.equal(a.$('pr-pneus-2').hidden, true);
  a.mode('duo'); a.majChoixPneus(); assert.equal(a.$('o-pneus-2').hidden, false);
  a.mode('enligne'); a.EL.R = {id: 4, membres: [{id: 0, joueurs: 2}, {id: 4, joueurs: 1}]}; a.majChoixPneus();
  assert.equal(a.$('o-pneus-2').hidden, true); assert.equal(a.$('pr-pneus-2').hidden, true);
  a.EL.R.membres[1].joueurs = 2; a.majChoixPneus();
  assert.equal(a.$('o-pneus-2').hidden, false); assert.equal(a.$('pr-pneus-2').hidden, false);
  assert.deepEqual(selection(a, 'pneusPret2'), ['neige']);
});

test('départ solo et duo : seules les voitures humaines prennent leurs préférences distinctes', () => {
  const a = creer({pneusPilotes: ['slicks', 'neige']});
  for (const duo of [false, true]) {
    const co = course(duo ? {humains: {noms: ['Un', 'Deux'], locaux: [0, 1], hote: true, enLigne: false}} : {});
    a.monterPneusDepart(co, true, null, 'pluie');
    assert.equal(co.joueur.etat.pneus, 'slicks');
    if (duo) assert.equal(co.voitures[1].etat.pneus, 'neige');
    for (const v of co.voitures) {
      if (!v.joueur) assert.equal(v.etat.pneus, 'pluie');
      assert.equal(v.livree.pneus, v.etat.pneus); assert.equal(v.etat.pneusProchainArret, v.etat.pneus);
    }
  }
});

test('départ distant 2+2 : chaque id humain reçoit la configuration annoncée, aucune préférence locale ne fuit', () => {
  const a = creer({pneusPilotes: ['pluie', 'pluie']});
  const noms = ['Hôte 1', 'Hôte 2', 'Invité 1', 'Invité 2'], pneus = ['slicks', 'neige', 'inter', 'pluie'];
  const co = course({humains: {noms, locaux: [2, 3], hote: false, enLigne: true}});
  a.monterPneusDepart(co, true, {pneus}, 'inter');
  assert.deepEqual(co.voitures.slice(0, 4).map(v => v.etat.pneus), pneus);
  assert.deepEqual(a.reglages.pneusPilotes, ['pluie', 'pluie']);
});

test('démo et vitrine : les préférences des pilotes ne changent pas la monte conseillée des voitures', () => {
  const a = creer({pneusPilotes: ['slicks', 'pluie']}), co = course();
  a.monterPneusDepart(co, false, null, 'neige');
  assert.ok(co.voitures.every(v => v.etat.pneus === 'neige'));
});

test('pause : le vrai clic de choix de stand ne remplace aucun pneu et ne répare rien', () => {
  const a = creer(), co = course({humains: {noms: ['Un', 'Deux'], locaux: [0, 1], hote: true, enLigne: false}});
  a.monterPneusDepart(co, true, null, 'slicks'); user(co);
  const avant = co.voitures.map(roues);
  a.seance({type: 'duo', course: co, locaux: [0, 1]}); a.ecran('pause');
  a.changer('pneusStand1', 'pluie');
  assert.deepEqual(co.voitures.map(roues), avant, 'montes, usures, graines et livrées restent inchangées');
  assert.equal(co.voitures[1].etat.pneusProchainArret, 'pluie');
  assert.equal(co.voitures[0].etat.pneusProchainArret, 'slicks');
  assert.deepEqual(selection(a, 'pneusStand1'), ['pluie']);
  assert.match(a.$('ps-etat-1').textContent, /Montés : Slicks.*prochain arrêt : Pluie/);
  assert.equal(a.$('ps-pilote-1').hidden, false); assert.equal(a.sauvegardes.length, 0, 'commande propre à la séance');
});

test('stand : le bon joueur local est trouvé même quand les id des humains sont 2 et 3', () => {
  const a = creer(), co = course({humains: {noms: ['H1', 'H2', 'I1', 'I2'], locaux: [2, 3], hote: false, enLigne: true}});
  a.monterPneusDepart(co, true, {pneus: ['slicks', 'inter', 'pluie', 'neige']}, 'slicks');
  a.seance({type: 'duo', course: co, locaux: [2, 3]}); a.ecran('pause');
  assert.equal(a.choisirPneusStands(1, 'slicks'), true);
  assert.equal(co.voitures[3].etat.pneusProchainArret, 'slicks');
  assert.equal(co.voitures[1].etat.pneusProchainArret, 'inter');
  assert.equal(co.voitures[3].etat.pneus, 'neige');
});

test('service engagé : choix verrouillé, affichage figé, aucun clic ne change la transaction', () => {
  const a = creer(), co = course(), v = co.joueur;
  a.monterPneusDepart(co, true, null, 'slicks'); user(co);
  Object.assign(v.etat, {pneusProchainArret: 'neige', stands: {phase: 'service', pneus: 'neige'}});
  a.seance({type: 'course', course: co, locaux: [0]}); a.ecran('pause'); a.majPneusStands();
  const avant = roues(v); a.changer('pneusStand0', 'pluie');
  assert.equal(v.etat.pneusProchainArret, 'neige'); assert.deepEqual(roues(v), avant);
  assert.equal(a.$('ps-pilote-0').disabled, true); assert.equal(a.$('ps-pilote-1').hidden, true);
  assert.deepEqual(selection(a, 'pneusStand0'), ['neige']); assert.match(a.$('ps-etat-0').textContent, /verrouillé/);
});

test('commandes de service hors pause ou sans pilote local : rejet sans mutation de voiture', () => {
  const a = creer(), co = course(); a.monterPneusDepart(co, true, null, 'slicks'); user(co);
  a.seance({type: 'course', course: co, locaux: [0]}); a.ecran('course');
  const avant = roues(co.joueur);
  assert.equal(a.choisirPneusStands(0, 'pluie'), false);
  a.ecran('pause'); assert.equal(a.choisirPneusStands(1, 'pluie'), false);
  assert.equal(a.choisirPneusStands(-1, 'pluie'), false);
  assert.deepEqual(roues(co.joueur), avant); assert.equal(co.joueur.etat.pneusProchainArret, 'slicks');
});

test('12F3 : choix de monte en ligne autorisé pour chaque pilote local sans changer les pneus en place', () => {
  const a = creer(), co = course({humains: {noms: ['H1', 'H2', 'I1', 'I2'], locaux: [2, 3], hote: false, enLigne: true}});
  a.monterPneusDepart(co, true, {pneus: ['slicks', 'inter', 'pluie', 'neige']}, 'slicks'); user(co);
  a.seance({type: 'duo', course: co, locaux: [2, 3], enLigne: {role: 'invite'}}); a.ecran('pause'); a.majPneusStands();
  const avant = co.voitures.map(roues);
  assert.equal(a.choisirPneusStands(0, 'slicks'), true);
  a.changer('pneusStand1', 'pluie');
  assert.deepEqual(co.voitures.map(roues), avant);
  assert.deepEqual(co.voitures.slice(0, 4).map(v => v.etat.pneusProchainArret), ['slicks', 'inter', 'slicks', 'pluie']);
  assert.equal(a.$('ps-pilote-0').disabled, false); assert.equal(a.$('ps-pilote-1').disabled, false);
  assert.deepEqual(selection(a, 'pneusStand0'), ['slicks']); assert.deepEqual(selection(a, 'pneusStand1'), ['pluie']);
  assert.equal(a.sauvegardes.length, 0, 'choix propre à la séance, sans réécriture des préférences de départ');
});
