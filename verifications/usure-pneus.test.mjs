import '../src/pneus.js';
import '../src/usure-pneus.js';
import '../src/degats.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const B = globalThis.BITUME, P = B.pneus, U = B.usurePneus;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
function etat(type = 'slicks') {
  return Object.assign({ v: 30, surface: 'piste', patinage: 0, roues: Array.from({ length: 4 }, () => ({ charge: 1500, glisse: 0 })),
    degats: B.degats.creer() }, P.creerEtat(type, { seance: 7, voiture: 3 }));
}
function rouler(e, secondes, hz = 120, eau = 0, neige = 0) {
  for (let i = 0; i < Math.round(secondes * hz); i++) U.pas(e, 1 / hz, e.v / hz, eau, neige);
}
const proche = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) <= epsilon, `${a} contre ${b}`);

verifier('roulage propre, agressif et charge asymétrique produisent des usures différentes', () => {
  const propre = etat(), agressif = etat();
  agressif.roues[0].glisse = .9; agressif.roues[0].charge = 2400;
  agressif.roues[1].glisse = .2; agressif.roues[1].charge = 600;
  rouler(propre, 120); rouler(agressif, 120);
  assert.ok(propre.etatPneus[0].usure > 0);
  assert.ok(agressif.etatPneus[0].usure > 4 * propre.etatPneus[0].usure);
  assert.ok(agressif.etatPneus[0].usure > agressif.etatPneus[1].usure);
  assert.ok(agressif.etatPneus[0].grainage > .5);
  assert.equal(propre.etatPneus[0].grainage, 0);
});

verifier('marche arrière : distance positive d’usure, identique au même roulage en avant', () => {
  const a = etat(), b = etat(); a.v = 3; b.v = -3;
  rouler(a, 50); rouler(b, 50);
  assert.deepEqual(a.etatPneus, b.etatPneus);
  proche(b.etatPneus[0].distance, 150);
});

verifier('mode recul : contacts visuels statiques sans lire les anciennes charges, glisses et patinage', () => {
  const a = etat(), reference = etat(); a.v = -3; reference.v = 3;
  for (const r of reference.roues) r.charge = U.PARAMS.chargeRecul;
  for (const r of a.roues) {
    Object.defineProperty(r, 'charge', { get() { throw Error('charge périmée'); } });
    Object.defineProperty(r, 'glisse', { get() { throw Error('glisse périmée'); } });
    Object.freeze(r);
  }
  Object.defineProperty(a, 'patinage', { get() { throw Error('patinage périmé'); } });
  for (let i = 0; i < 120; i++) assert.equal(U.pas(a, 1 / 120, a.v / 120, 0, 0, 'recul'), 4);
  rouler(reference, 1);
  assert.deepEqual(a.etatPneus, reference.etatPneus);
  assert.ok(a.etatPneus.every(r => r.usure > 0 && r.grainage === 0));
});

verifier('mode recul : aucune roue absente, perdue ou suspendue ; aucun roulage fictif à l’arrêt', () => {
  const e = etat(); e.v = -3;
  e.roues[0] = null; e.roues[1].contact = false; e.degats.roues[2] = true;
  assert.equal(U.pas(e, 1 / 120, -.025, 0, 0, 'recul'), 1);
  assert.deepEqual(e.etatPneus.slice(0, 3), etat().etatPneus.slice(0, 3));
  for (const champ of ['saut', 'recuperation', 'accident', 'reparation', 'bond', 'bondT']) {
    const suspendu = etat(); suspendu.v = -3; suspendu[champ] = champ.startsWith('bond') ? .2 : {};
    const avant = structuredClone(suspendu.etatPneus);
    assert.equal(U.pas(suspendu, 1 / 120, -.025, 0, 0, 'recul'), 0);
    assert.deepEqual(suspendu.etatPneus, avant);
  }
  const avant = structuredClone(e.etatPneus);
  for (const vitesse of [0, 30, NaN]) {
    e.v = vitesse; assert.equal(U.pas(e, 1 / 120, -.025, 0, 0, 'recul'), 0);
  }
  assert.deepEqual(e.etatPneus, avant);
});

verifier('surface explicite du recul : saleté réversible sans modifier la surface physique', () => {
  const e = etat(); e.v = -3; e.surface = 'piste';
  for (let i = 0; i < 120 * 40; i++) U.pas(e, 1 / 120, -.025, 0, 0, 'recul', 'herbe');
  assert.equal(e.surface, 'piste');
  const sale = e.etatPneus[0].salete, use = e.etatPneus[0].usure;
  assert.ok(sale > .8);
  for (let i = 0; i < 120 * 60; i++) U.pas(e, 1 / 120, -.025, 1, 0, 'recul', 'piste');
  assert.equal(e.surface, 'piste');
  assert.ok(e.etatPneus[0].salete < .01);
  assert.ok(e.etatPneus[0].usure > use);
  const neige = etat('neige'); neige.v = -3;
  U.pas(neige, 1 / 120, -.025, 0, 0, 'recul', 'neige');
  assert.ok(neige.etatPneus[0].salete > 0);
  assert.equal(neige.surface, 'piste');
});

verifier('pas fixes regroupés en images : mêmes valeurs ; subdivision constante à 30/60/120 Hz', () => {
  const reference = etat('inter'); reference.surface = 'herbe'; reference.roues[0].glisse = .45;
  const copies = [30, 60, 120].map(() => structuredClone(reference));
  [30, 60, 120].forEach((hz, i) => rouler(copies[i], 20, hz, .2));
  for (const e of copies) for (let i = 0; i < 4; i++) for (const champ of ['usure', 'salete', 'grainage', 'distance', 'sollicitation'])
    proche(e.etatPneus[i][champ], copies[2].etatPneus[i][champ], 1e-7);
  const a = etat(), b = etat();
  rouler(a, 10);
  for (let image = 0; image < 300; image++) for (let pas = 0; pas < 4; pas++) U.pas(b, 1 / 120, b.v / 120);
  assert.deepEqual(a.etatPneus, b.etatPneus);
});

verifier('pause, grille, arrêt sans patinage et contacts périmés ne changent rien', () => {
  const e = etat(); e.roues.forEach(r => { r.glisse = 1; });
  const avant = structuredClone(e.etatPneus);
  assert.equal(U.pas(e, 0, 10), 0);
  assert.equal(U.pas(e, 1 / 120, 0), 0);
  assert.equal(U.pas(e, 1 / 120, .25, 0, 0, false), 0);
  assert.equal(U.pas(e, NaN, .25), 0);
  assert.equal(U.pas(e, 10, 300), 0);
  assert.equal(U.pas(e, 1 / 120, 5000), 0); // déplacement discontinu, pas du roulage
  assert.deepEqual(e.etatPneus, avant);
});

verifier('une roue déchargée, sans contact ou perdue ne perd pas de gomme', () => {
  const e = etat();
  e.roues[0].charge = 0; e.roues[1].contact = false; e.degats.roues[2] = true;
  e.roues.forEach(r => { r.glisse = 1; });
  assert.equal(U.pas(e, 1 / 120, .25), 1);
  assert.deepEqual(e.etatPneus.slice(0, 3), etat().etatPneus.slice(0, 3));
  assert.ok(e.etatPneus[3].usure > 0);
});

verifier('roue absente et état incomplet sont ignorés sans fabrication de contact', () => {
  const e = etat();
  e.roues[0] = null; e.roues[1].charge = NaN; e.etatPneus[2] = null;
  const absent = structuredClone(e.etatPneus.slice(0, 3));
  assert.equal(U.pas(e, 1 / 120, .25), 1);
  assert.deepEqual(e.etatPneus.slice(0, 3), absent);
  assert.ok(e.etatPneus[3].usure > 0);
  for (const incomplet of [null, {}, { roues: [] }, { roues: [], etatPneus: 'abcd' },
    { roues: {}, etatPneus: [null, 1, 'x', {}] }])
    assert.equal(U.pas(incomplet, 1 / 120, .25), 0);
  e.etatPneus[2] = 12; assert.equal(U.pas(e, 1 / 120, .25), 1);
});

verifier('vol, bond, accident, récupération, réparation et service excluent les anciennes charges', () => {
  for (const champ of ['saut', 'recuperation', 'accident', 'reparation', 'bond', 'bondT']) {
    const e = etat(); e[champ] = champ.startsWith('bond') ? .2 : {};
    const avant = structuredClone(e.etatPneus);
    assert.equal(U.pas(e, 1 / 120, .25), 0, champ);
    assert.deepEqual(e.etatPneus, avant);
  }
  const e = etat(); e.stands = { phase: 'service' };
  assert.equal(U.pas(e, 1 / 120, .25), 0);
  e.stands.phase = 'voie'; assert.equal(U.pas(e, 1 / 120, .25), 4);
  e.stands.phase = 'sortie'; assert.equal(U.pas(e, 1 / 120, .25), 4);
  e.degats.casse = true; assert.equal(U.pas(e, 1 / 120, .25), 0);
});

verifier('patinage immobile mesuré : usure arrière sans fausse distance de roulage', () => {
  const e = etat(); e.v = 0; e.patinage = 1; e.roues.forEach(r => { r.glisse = 1; });
  rouler(e, 10);
  assert.equal(e.etatPneus[0].usure, 0); assert.equal(e.etatPneus[1].usure, 0);
  assert.ok(e.etatPneus[2].usure > 0); assert.ok(e.etatPneus[3].usure > 0);
  assert.equal(e.etatPneus[2].distance, 0);
});

verifier('neige réelle et eau diffèrent du sec ; la seule saison ne change pas l’usure', () => {
  const sec = etat('neige'), blanc = etat('neige'), humide = etat('neige'), hiver = etat('neige');
  hiver.saison = 'hiver';
  rouler(sec, 30); rouler(blanc, 30, 120, 0, 1); rouler(humide, 30, 120, 1, 0); rouler(hiver, 30);
  assert.ok(blanc.etatPneus[0].usure < humide.etatPneus[0].usure);
  assert.ok(humide.etatPneus[0].usure < sec.etatPneus[0].usure);
  assert.deepEqual(sec.etatPneus, hiver.etatPneus);
});

verifier('saleté réversible et grainage continu sans restauration de gomme', () => {
  const e = etat(); e.surface = 'herbe'; e.roues[0].glisse = .8;
  rouler(e, 20);
  const sale = e.etatPneus[0].salete, use = e.etatPneus[0].usure, grain = e.etatPneus[0].grainage;
  assert.ok(sale > .8); assert.ok(grain > .5);
  e.surface = 'piste'; e.roues[0].glisse = 0; rouler(e, 20, 120, 1);
  assert.ok(e.etatPneus[0].salete < .01);
  assert.ok(e.etatPneus[0].grainage < grain);
  assert.ok(e.etatPneus[0].usure > use);
});

verifier('types et surfaces inconnus retombent sur le roulage sec sans accès hérité', () => {
  const reference = etat(); rouler(reference, 2);
  for (const invalide of ['inconnu', '__proto__', 'constructor', 'toString', null]) {
    const e = etat(); e.pneus = invalide; e.surface = invalide;
    rouler(e, 2);
    assert.deepEqual(e.etatPneus, reference.etatPneus);
    assert.equal(e.pneus, invalide); // lecture sûre sans modifier la monte de la voiture
  }
});

verifier('réparations de caisse et d’urgence conservent les pneus ; aucun service dans le lot visuel', () => {
  const e = etat(); rouler(e, 30); const avant = structuredClone(e.etatPneus), roues = e.etatPneus.slice();
  B.degats.reparer(e.degats); B.degats.reparerUrgence(e.degats);
  assert.deepEqual(e.etatPneus, avant);
  for (let i = 0; i < 4; i++) {
    assert.equal(e.etatPneus[i], roues[i]);
    assert.equal(roues[i].graine, avant[i].graine);
  }
  assert.equal(e.pneus, 'slicks'); assert.equal(e.servicePneus, 0);
  assert.equal(U.terminerService, undefined);
});

verifier('longue simulation bornée, mêmes objets et aucune modification des données de conduite', () => {
  const e = etat(), roues = e.etatPneus, refs = roues.slice();
  e.roues.forEach(r => { r.charge = 6000; r.glisse = 1; });
  const contact = structuredClone(e.roues), degats = structuredClone(e.degats), types = JSON.stringify(P.PNEUS);
  rouler(e, 600);
  assert.equal(e.etatPneus, roues);
  for (let i = 0; i < 4; i++) {
    assert.equal(roues[i], refs[i]);
    for (const champ of ['usure', 'salete', 'grainage']) assert.ok(Number.isFinite(roues[i][champ]) && roues[i][champ] >= 0 && roues[i][champ] <= 1);
    assert.ok(roues[i].distance <= P.DISTANCE_MAX && roues[i].sollicitation <= P.SOLLICITATION_MAX);
  }
  assert.deepEqual(e.roues, contact); assert.deepEqual(e.degats, degats);
  assert.equal(JSON.stringify(P.PNEUS), types); assert.equal(e.v, 30);
});

verifier('saturation et anciennes valeurs invalides restent finies et bornées', () => {
  const e = etat();
  Object.assign(e.etatPneus[0], { usure: .999999, salete: 2, grainage: -1,
    distance: P.DISTANCE_MAX - .01, sollicitation: P.SOLLICITATION_MAX - .01 });
  Object.assign(e.etatPneus[1], { usure: NaN, salete: Infinity, grainage: undefined,
    distance: Infinity, sollicitation: -10 });
  e.roues[0].charge = Number.MAX_VALUE; e.roues[0].glisse = 4;
  const graines = e.etatPneus.map(u => u.graine);
  rouler(e, 3);
  assert.equal(e.etatPneus[0].usure, 1);
  assert.equal(e.etatPneus[0].distance, P.DISTANCE_MAX);
  assert.equal(e.etatPneus[0].sollicitation, P.SOLLICITATION_MAX);
  for (const u of e.etatPneus) {
    for (const champ of ['usure', 'salete', 'grainage']) assert.ok(Number.isFinite(u[champ]) && u[champ] >= 0 && u[champ] <= 1);
    for (const champ of ['distance', 'sollicitation']) assert.ok(Number.isFinite(u[champ]) && u[champ] >= 0);
  }
  assert.deepEqual(e.etatPneus.map(u => u.graine), graines);
});

verifier('boucle sans allocation de collection ni hasard : état déjà préparé', () => {
  const c = vm.createContext({});
  for (const nom of ['pneus.js', 'usure-pneus.js']) vm.runInContext(readFileSync(new URL('../src/' + nom, import.meta.url), 'utf8'), c);
  vm.runInContext('var e = Object.assign({roues:[{charge:1500,glisse:.5},{charge:1500,glisse:0},{charge:1500,glisse:0},{charge:1500,glisse:0}],surface:"piste",patinage:0}, BITUME.pneus.creerEtat());', c);
  vm.runInContext('Math.random = () => { throw Error("hasard"); }; Array.prototype.map = Array.prototype.filter = Array.prototype.slice = () => { throw Error("collection"); };', c);
  assert.equal(vm.runInContext('BITUME.usurePneus.pas(e, 1/120, .25)', c), 4);
});

console.log(controles + ' contrôles usure pneus réussis');
