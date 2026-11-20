// Événement commun geste/klaxon : acceptation, indépendance et vrais dépassements.
// Le son réel et le raccord de jeu.js appartiennent à leurs suites respectives.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const maths = Object.create(Math);
maths.random = () => { throw new Error('Un Troll consulte le hasard global'); };
const contexte = vm.createContext({ Math: maths });
vm.runInContext(readFileSync(new URL('../src/expressions-pilote.js', import.meta.url), 'utf8'), contexte);
const X = contexte.BITUME.expressionsPilote;
const copie = v => JSON.parse(JSON.stringify(v));
const voiture = id => ({ id, progression: 100 + id * 50, joueur: false, humain: false, reprise: false, distant: false,
  fini: false, abandon: false, tPassage: -100, etat: { v: 30, rapport: 3, repositionnements: 0, degats: { casse: false } } });
function seance(nombre = 2, graine = 1, options = null) {
  const co = { phase: 'course', termine: false, voitures: Array.from({ length: nombre }, (_, id) => voiture(id)) };
  Object.defineProperty(co, 'rng', { get() { throw new Error('Un Troll consulte le hasard de course'); } });
  return { E: X.creer(nombre, graine, options), co,
    poses: Array.from({ length: nombre }, (_, i) => ({ x: 100 + i * 50, y: 0, z: i * 3, cap: 0 })) };
}
function image(s, t, demo = false) { X.actualiser(s.E, s.co, s.poses, t, demo); }
function droit(s, t) {
  for (let i = 0; i < s.co.voitures.length; i++) s.co.voitures[i].progression = s.poses[i].x = 100 + t * 30 + i * 50;
}
function duel(s, t, cible = 1) {
  droit(s, t);
  const a = s.co.voitures[0], b = s.co.voitures[cible];
  a.progression = s.poses[0].x = 96 + 34 * t; a.etat.v = 34;
  b.progression = s.poses[cible].x = 100 + 30 * t; b.etat.v = 30;
}
function avancer(s, debut, fin, disposer = droit, demo = false, visite = () => {}) {
  for (let k = Math.round(debut * 120); k <= Math.round(fin * 120); k++) {
    const t = k / 120; disposer(s, t); image(s, t, demo); visite(t);
  }
}
function collecter(s, jusqua = 2, disposer = duel, demo = false) {
  const evenements = [];
  avancer(s, 0, jusqua, disposer, demo, () => {
    for (let id = 0; id < s.E.nombre; id++) { const e = X.consommer(s.E, id); if (e) evenements.push(copie(e)); }
  });
  return evenements;
}
function ia(graine = 1, nombre = 2) {
  const s = seance(nombre, graine, { ia: true }); s.co.voitures[1].joueur = true; return s;
}

test('J1/J2 choisissent indépendamment un couple, émis seulement au démarrage accepté', () => {
  const s = seance(), a = Object.freeze({ geste: 'salut', klaxon: 'ancien' }), b = Object.freeze({ geste: 'poing', klaxon: 'mariage' });
  assert(X.configurer(s.E, 0, a)); assert(X.configurer(s.E, 1, b)); image(s, 0);
  X.demander(s.E, 0, true); X.demander(s.E, 1, true);
  assert.equal(X.consommer(s.E, 0), null); assert.equal(X.consommer(s.E, 1), null);
  droit(s, .1); image(s, .1);
  for (const [id, choix] of [[0, a], [1, b]]) {
    const e = X.consommer(s.E, id), o = X.lire(s.E, id);
    assert(e); assert.equal(e.id, id); assert.equal(e.numero, 1); assert.equal(e.temps, s.E.pilotes[id].gesteA);
    assert.equal(e.geste, choix.geste); assert.equal(e.klaxon, choix.klaxon); assert.equal(e.geste, o.geste);
    assert.equal(e.cote, o.gesteCote); assert.equal(e.origine, 'manuel'); assert.equal(X.consommer(s.E, id), null);
  }
  assert.deepEqual(a, { geste: 'salut', klaxon: 'ancien' }); assert.deepEqual(b, { geste: 'poing', klaxon: 'mariage' });
});

test('normalisation des choix, copie des valeurs et geste en cours immuable', () => {
  const s = seance();
  for (const id of [-1, 2, 0.5, NaN, '0']) { assert.equal(X.configurer(s.E, id, {}), false); assert.equal(X.consommer(s.E, id), null); }
  assert.equal(X.configurer(null, 0, {}), false); assert.equal(X.consommer(null, 0), null);
  assert.equal(X.configurer({}, 0, {}), false); assert.equal(X.consommer({}, 0), null);
  const choix = { geste: 'salut', klaxon: 'ancien' }; X.configurer(s.E, 0, choix);
  choix.geste = 'poing'; choix.klaxon = 'mariage';
  X.configurer(s.E, 1, { geste: '__proto__', klaxon: Infinity }); image(s, 0);
  X.demander(s.E, 0, true); X.demander(s.E, 1, true); droit(s, .1); image(s, .1);
  const e = X.consommer(s.E, 0), avant = copie(e);
  assert.equal(e.geste, 'salut'); assert.equal(e.klaxon, 'ancien');
  assert.equal(X.consommer(s.E, 1).geste, 'majeur'); assert.equal(s.E.pilotes[1].evenement.klaxon, 'classique');
  X.configurer(s.E, 0, { geste: 'poing', klaxon: 'mariage' });
  assert.deepEqual(copie(e), avant); avancer(s, .11, .5);
  assert.equal(X.lire(s.E, 0).geste, 'salut', 'une préférence nouvelle ne remplace pas une animation commencée');
  avancer(s, .51, 3); X.demander(s.E, 0, false); X.demander(s.E, 0, true); droit(s, 3.01); image(s, 3.01);
  assert.equal(X.consommer(s.E, 0), e, 'l’événement est réutilisé');
  assert.equal(e.numero, 2); assert.equal(e.geste, 'poing'); assert.equal(e.klaxon, 'mariage');
});

test('bouton maintenu, refus pendant délai et nouvelle pression : aucune rafale', () => {
  const s = seance(); X.configurer(s.E, 0, { geste: 'poing', klaxon: 'ancien' }); image(s, 0);
  X.demander(s.E, 0, true); let lus = 0;
  avancer(s, 1 / 120, 4, droit, false, () => { assert.equal(X.demander(s.E, 0, true), false); if (X.consommer(s.E, 0)) lus++; });
  assert.equal(lus, 1); assert.equal(s.E.pilotes[0].gestesManuels, 1);
  X.demander(s.E, 0, false); X.demander(s.E, 0, true); droit(s, 4.01); image(s, 4.01);
  assert.equal(X.consommer(s.E, 0).numero, 2);
  X.demander(s.E, 0, false); X.demander(s.E, 0, true);
  avancer(s, 4.02, 7.1, droit, false, () => assert.equal(X.consommer(s.E, 0), null));
  assert.equal(s.E.pilotes[0].gestesManuels, 2, 'la demande expirée ne repart pas après le délai');
});

test('la boîte diffère le couple complet puis peut interrompre le geste sans second son', () => {
  const s = seance(); X.configurer(s.E, 0, { geste: 'majeur', klaxon: 'mariage' }); image(s, 0);
  s.co.voitures[0].tPassage = .02; X.demander(s.E, 0, true); let debut;
  avancer(s, 1 / 120, .7, droit, false, t => {
    const e = X.consommer(s.E, 0);
    if (t < .38) { assert.equal(e, null); assert.equal(X.lire(s.E, 0).geste, null); }
    if (e) { assert.equal(debut, undefined); debut = copie(e); assert.equal(e.temps, t); assert.equal(e.geste, X.lire(s.E, 0).geste); }
  });
  assert(debut); assert.equal(debut.geste, 'majeur'); assert.equal(debut.klaxon, 'mariage');
  s.co.voitures[0].etat.rapport = 4; s.co.voitures[0].tPassage = .72;
  avancer(s, .71, 1, droit, false, () => assert.equal(X.consommer(s.E, 0), null));
  assert.equal(X.lire(s.E, 0).geste, null); assert.equal(s.E.pilotes[0].gestesManuels, 1);
});

test('demande expirée, épave, stands, récupération et auteur distant restent sans son', () => {
  for (const cas of ['boite', 'accident', 'recuperation', 'stands', 'casse', 'distant']) {
    const s = seance(); image(s, 0); X.demander(s.E, 0, true);
    if (cas === 'distant') s.co.voitures[0].distant = true;
    else if (cas === 'casse') s.co.voitures[0].etat.degats.casse = true;
    else if (cas !== 'boite') s.co.voitures[0].etat[cas] = {};
    avancer(s, 1 / 120, 1.2, (q, t) => { droit(q, t); if (cas === 'boite') q.co.voitures[0].tPassage = t; }, false,
      () => assert.equal(X.consommer(s.E, 0), null, cas));
    assert.equal(s.E.pilotes[0].gestesManuels, 0, cas);
  }
});

test('l’événement expire avec son image, sa phase, son acteur et son horloge', () => {
  for (const cas of ['image', 'pause', 'termine', 'replacement', 'acteur', 'course', 'retour', 'saut']) {
    const s = seance(); image(s, 0); X.demander(s.E, 0, true); droit(s, .1); image(s, .1);
    assert(s.E.pilotes[0].evenementPret);
    let t = .2;
    if (cas === 'pause') s.co.phase = 'pause';
    if (cas === 'termine') s.co.termine = true;
    if (cas === 'replacement') s.co.voitures[0].etat.repositionnements++;
    if (cas === 'acteur') s.co.voitures[0] = voiture(0);
    if (cas === 'course') s.co = { ...s.co };
    if (cas === 'retour') t = 0;
    if (cas === 'saut') t = 2;
    droit(s, t); image(s, t); assert.equal(X.consommer(s.E, 0), null, cas);
    assert.equal(X.demander(s.E, 0, true), false, 'maintenir ne crée pas de nouvel appui : ' + cas);
  }
});

test('les vues et glaces ne consomment ni ne réémettent ; les buffers sont stables', () => {
  const s = seance(), e = s.E.pilotes[0].evenement, sortie = X.lire(s.E, 0), tables = [s.E.voitures, s.E.x, s.E.armes];
  image(s, 0); X.demander(s.E, 0, true); droit(s, .1); image(s, .1);
  const hasard = s.E.pilotes.map(p => [p.hasard, p.hasardSon]);
  for (let k = 0; k < 500; k++) { image(s, .1); X.lire(s.E, 1); assert.equal(X.lire(s.E, 0), sortie); }
  assert.equal(X.consommer(s.E, 0), e);
  for (let k = 0; k < 500; k++) { image(s, .1); X.lire(s.E, 1); X.lire(s.E, 0); assert.equal(X.consommer(s.E, 0), null); }
  assert.deepEqual(s.E.pilotes.map(p => [p.hasard, p.hasardSon]), hasard);
  [s.E.voitures, s.E.x, s.E.armes].forEach((v, k) => assert.equal(v, tables[k]));
  avancer(s, .11, 4, droit); X.demander(s.E, 0, false); X.demander(s.E, 0, true); droit(s, 4.1); image(s, 4.1);
  assert.equal(X.consommer(s.E, 0), e); assert.equal(e.numero, 2);
});

test('une IA réagit après avoir dépassé J1 ou J2, y compris un humain distant', () => {
  for (const id of [1, 2]) for (const distant of [false, true]) {
    const s = ia(73, 3); s.co.voitures[1].joueur = false;
    s.co.voitures[id].humain = true; s.co.voitures[id].joueur = !distant; s.co.voitures[id].distant = distant;
    const ev = collecter(s, 2, (q, t) => duel(q, t, id));
    assert.equal(ev.length, 1); assert.equal(ev[0].id, 0); assert.equal(ev[0].origine, 'ia');
    assert(ev[0].temps >= 1.19); assert(X.GESTES.includes(ev[0].geste)); assert(X.KLAXONS.includes(ev[0].klaxon));
    assert.equal(s.E.pilotes[0].gestesIA, 1);
  }
});

test('IA contre IA, humain qui dépasse, cible reprise et auteur distant ne provoquent pas', () => {
  for (const cas of ['ia-ia', 'humain', 'humain-distant', 'cible-reprise', 'auteur-distant']) {
    const s = ia();
    if (cas === 'ia-ia') s.co.voitures[1].joueur = false;
    if (cas === 'humain') s.co.voitures[0].joueur = true;
    if (cas === 'humain-distant') s.co.voitures[0].humain = true;
    if (cas === 'cible-reprise') s.co.voitures[1].reprise = true;
    if (cas === 'auteur-distant') s.co.voitures[0].distant = true;
    assert.equal(collecter(s).length, 0, cas);
  }
  const reprise = ia(); reprise.co.voitures[0].humain = true; reprise.co.voitures[0].reprise = true;
  assert.equal(collecter(reprise)[0].origine, 'ia', 'une IA de reprise peut réagir sous l’autorité locale');
});

test('la vitrine reste sans réaction par défaut ; la démo conserve son déclenchement explicite', () => {
  const vitrine = seance(); vitrine.co.voitures[1].joueur = true;
  assert.equal(vitrine.E.ia, false); assert.equal(collecter(vitrine).length, 0);
  const demo = seance(), ev = collecter(demo, 3, duel, true);
  assert.equal(ev.length, 1); assert.equal(ev[0].origine, 'demo'); assert.equal(demo.E.pilotes[0].gestesDemo, 1);
});

test('choix IA des deux variantes : hasard propre, neuf couples et préférences humaines ignorées', () => {
  const couples = new Set();
  for (let graine = 1; graine <= 64; graine++) {
    const s = ia(graine); X.configurer(s.E, 0, { geste: 'majeur', klaxon: 'classique' });
    const e = collecter(s)[0]; assert(e); couples.add(e.geste + '/' + e.klaxon);
  }
  assert.equal(couples.size, 9, 'les deux tirages ne doivent pas être corrélés par un indice commun');
  const a = ia(31, 3), b = ia(31, 3), events = [[], []];
  for (let k = 0; k <= 240; k++) {
    const t = k / 120; duel(a, t); duel(b, t);
    if (k === 1) X.demander(b.E, 2, true);
    image(a, t); image(b, t); X.lire(b.E, 1); image(b, t);
    for (const [i, s] of [a, b].entries()) { const e = X.consommer(s.E, 0); if (e) events[i].push(copie(e)); }
  }
  assert.equal(events[0][0].sequence, 1); assert.equal(events[1][0].sequence, 2, 'la séquence couvre aussi l’autre joueur');
  assert.deepEqual(events[0].map(({ sequence, ...e }) => e), events[1].map(({ sequence, ...e }) => e),
    'un Troll d’un autre joueur ne décale ni geste ni klaxon de cette IA');
});

test('faux dépassements et boîte prioritaire ne produisent aucun couple automatique', () => {
  for (const cas of ['loin', 'niveau', 'grille', 'recul', 'replacement', 'replacement-court', 'acteur', 'course', 'boite']) {
    const s = ia();
    const ev = collecter(s, 2, (q, t) => {
      duel(q, t);
      if (cas === 'loin') q.poses[1].z = 100;
      if (cas === 'niveau') q.poses[1].y = 15;
      if (cas === 'grille') q.co.phase = t < 1.4 ? 'grille' : 'course';
      if (cas === 'recul') q.co.voitures[0].etat.rapport = -1;
      if (cas === 'replacement' && t >= .9) q.co.voitures[0].progression = q.poses[0].x += 300;
      if (cas === 'replacement-court' && t >= .9) { q.co.voitures[0].progression = q.poses[0].x += 2.6; q.co.voitures[0].etat.repositionnements = 1; }
      if (cas === 'acteur' && Math.abs(t - 1) < 1e-7) { const p = q.co.voitures[0].progression; q.co.voitures[0] = voiture(0); q.co.voitures[0].progression = p; }
      if (cas === 'course' && Math.abs(t - 1) < 1e-7) q.co = { ...q.co };
      if (cas === 'boite') q.co.voitures[0].tPassage = t;
    });
    assert.equal(ev.length, 0, cas);
  }
});

test('duel oscillant : délai du pilote et délai global empêchent la rafale', () => {
  const s = ia();
  const ev = collecter(s, 10, (q, t) => {
    const ecart = t <= 2.5 ? -4 + 4 * t : t <= 4.5 ? 6 - 8 * (t - 2.5) : -10 + 4 * (t - 4.5);
    q.co.voitures[1].progression = q.poses[1].x = 100 + 30 * t;
    q.co.voitures[0].progression = q.poses[0].x = 100 + 30 * t + ecart;
    q.co.voitures[0].etat.v = t > 2.5 && t <= 4.5 ? 22 : 34;
  });
  assert.equal(s.E.pilotes[0].depassements, 2); assert.equal(ev.length, 1);
  const deux = ia(1, 3); deux.co.voitures[1].joueur = false; deux.co.voitures[2].joueur = true;
  const proches = collecter(deux, 2, (q, t) => {
    for (const id of [0, 1]) { q.co.voitures[id].progression = q.poses[id].x = 96 - id * .4 + 34 * t; q.co.voitures[id].etat.v = 34; }
    q.co.voitures[2].progression = q.poses[2].x = 100 + 30 * t;
  });
  assert.equal(deux.E.pilotes[0].depassements, 1); assert.equal(deux.E.pilotes[1].depassements, 1);
  assert.equal(proches.length, 1); assert(X.LIMITES.delaiGlobalIA >= .96, 'le plafond couvre le plus long klaxon');
});

test('configuration, animation et consommation ne modifient jamais la simulation', () => {
  const s = ia();
  for (const v of s.co.voitures) { Object.freeze(v.etat.degats); Object.freeze(v.etat); Object.freeze(v); }
  Object.freeze(s.co.voitures); Object.freeze(s.co); s.poses.forEach(Object.freeze); Object.freeze(s.poses);
  const avant = copie({ co: s.co, poses: s.poses });
  X.configurer(s.E, 0, { geste: 'poing', klaxon: 'ancien' }); image(s, 0); X.demander(s.E, 0, true); image(s, .1);
  assert(X.consommer(s.E, 0)); X.lire(s.E, 0);
  assert.deepEqual(copie({ co: s.co, poses: s.poses }), avant);
});

test('les normaliseurs publics du contrat 00 acceptent les noms et bornent les valeurs inconnues', () => {
  for (const geste of ['majeur', 'poing', 'salut']) assert.equal(X.normaliserGeste(geste), geste);
  for (const klaxon of ['classique', 'ancien', 'mariage']) assert.equal(X.normaliserKlaxon(klaxon), klaxon);
  for (const inconnu of [undefined, null, '', '__proto__', 1, NaN, {}, ['salut']]) {
    assert.equal(X.normaliserGeste(inconnu), 'majeur'); assert.equal(X.normaliserKlaxon(inconnu), 'classique');
  }
});

const sortieCanonique = () => ({ sequence: 0, pilote: -1, geste: null, klaxon: null, instant: -1, cote: 0 });
function simultanes(s, t) {
  for (let id = s.E.nombre - 1; id >= 0; id--) { X.demander(s.E, id, false); X.demander(s.E, id, true); }
  droit(s, t); image(s, t);
}

test('la file canonique donne les six champs et une séquence globale ordonnée entre acteurs', () => {
  const s = seance(4), sortie = sortieCanonique(); image(s, 0);
  for (let id = 0; id < 4; id++) X.configurer(s.E, id, { geste: X.GESTES[id % 3], klaxon: X.KLAXONS[id % 3] });
  simultanes(s, .1);
  for (let id = 0; id < 4; id++) {
    assert.equal(X.consommerEvenement(s.E, sortie), true);
    assert.deepEqual(Object.keys(sortie).sort(), ['sequence', 'pilote', 'geste', 'klaxon', 'instant', 'cote'].sort());
    assert.equal(sortie.sequence, id + 1); assert.equal(sortie.pilote, id); assert.equal(sortie.instant, .1);
    assert.equal(sortie.geste, X.GESTES[id % 3]); assert.equal(sortie.klaxon, X.KLAXONS[id % 3]);
    assert.equal(sortie.geste, X.lire(s.E, id).geste); assert.equal(sortie.cote, X.lire(s.E, id).gesteCote);
    assert.equal(X.consommer(s.E, id), null, 'la lecture par pilote ne rejoue pas la file');
  }
  const dernier = copie(sortie); assert.equal(X.consommerEvenement(s.E, sortie), false); assert.deepEqual(sortie, dernier);
  assert.equal(s.E.sequence, 4);
  avancer(s, .11, 3); simultanes(s, 3.01);
  for (let id = 0; id < 4; id++) { assert(X.consommerEvenement(s.E, sortie)); assert.equal(sortie.sequence, 5 + id); }
});

test('mélanger lecture par pilote et file canonique ne double jamais une émission', () => {
  const s = seance(4), sortie = sortieCanonique(); image(s, 0); simultanes(s, .1);
  const milieu = X.consommer(s.E, 1); assert.equal(milieu.sequence, 2);
  assert(X.consommerEvenement(s.E, sortie)); assert.equal(sortie.sequence, 1); assert.equal(sortie.pilote, 0);
  assert.equal(X.consommer(s.E, 0), null);
  const fin = X.consommer(s.E, 3); assert.equal(fin.sequence, 4);
  assert(X.consommerEvenement(s.E, sortie)); assert.equal(sortie.sequence, 3); assert.equal(sortie.pilote, 2);
  assert.equal(X.consommerEvenement(s.E, sortie), false);
  for (let id = 0; id < 4; id++) assert.equal(X.consommer(s.E, id), null);
  for (let k = 0; k < 100; k++) { image(s, .1); X.lire(s.E, k % 4); assert.equal(X.consommerEvenement(s.E, sortie), false); }
});

test('soixante-quatre départs simultanés tiennent dans la capacité fixe, sans écrasement ni nouvelle case', () => {
  const s = seance(64), sortie = sortieCanonique(), file = s.E.evenements;
  const references = s.E.pilotes.map(p => p.evenement), tableaux = [s.E.voitures, s.E.x, s.E.armes];
  assert.equal(file.length, 64); assert.throws(() => X.creer(65), /1 à 64/); image(s, 0);
  simultanes(s, .1); assert.equal(s.E.evenementsN, 64);
  for (let id = 0; id < 64; id++) {
    X.demander(s.E, id, false); X.demander(s.E, id, true);
  }
  assert.equal(X.demander(s.E, 64, true), false); image(s, .1);
  const pilotes = new Set();
  for (let k = 0; k < 64; k++) {
    assert(X.consommerEvenement(s.E, sortie)); assert.equal(sortie.sequence, k + 1); pilotes.add(sortie.pilote);
  }
  assert.equal(pilotes.size, 64); assert.equal(X.consommerEvenement(s.E, sortie), false);
  avancer(s, .11, 3); simultanes(s, 3.01);
  for (let k = 0; k < 64; k++) { assert(X.consommerEvenement(s.E, sortie)); assert.equal(sortie.sequence, 65 + k); }
  assert.equal(X.consommerEvenement(s.E, sortie), false); assert.equal(s.E.evenements, file);
  s.E.pilotes.forEach((p, id) => assert.equal(p.evenement, references[id]));
  [s.E.voitures, s.E.x, s.E.armes].forEach((v, i) => assert.equal(v, tableaux[i]));
});

test('la file expire à l’image suivante et au reset ; la séquence de séance ne revient pas en arrière', () => {
  for (const cas of ['image', 'phase', 'replacement', 'course', 'retour', 'saut']) {
    const s = seance(3), sortie = sortieCanonique(); image(s, 0); simultanes(s, .1);
    assert.equal(s.E.sequence, 3);
    let t = .2;
    if (cas === 'phase') s.co.phase = 'pause';
    if (cas === 'replacement') s.co.voitures[0].etat.repositionnements++;
    if (cas === 'course') s.co = { ...s.co };
    if (cas === 'retour') t = 0;
    if (cas === 'saut') t = 2;
    droit(s, t); image(s, t); assert.equal(X.consommerEvenement(s.E, sortie), false, cas);
    assert.deepEqual(sortie, sortieCanonique(), 'lecture vide sans mutation de sortie : ' + cas);
    assert.equal(s.E.sequence, 3, 'le numéro n’est pas réutilisé : ' + cas);
    s.co = { ...s.co, phase: 'course' }; droit(s, 3); image(s, 3);
    simultanes(s, 3.01); assert(X.consommerEvenement(s.E, sortie)); assert.equal(sortie.sequence, 4);
  }
  assert.equal(X.creer(1).sequence, 0, 'une nouvelle séance possède sa propre séquence');
});

test('une sortie absente ou non modifiable ne perd pas l’événement à lire', () => {
  const s = seance(1), sortie = sortieCanonique(); image(s, 0); simultanes(s, .1);
  assert.equal(X.consommerEvenement(s.E, null), false); assert.equal(X.consommerEvenement(s.E, 3), false);
  assert.equal(X.consommerEvenement(null, sortie), false);
  assert.throws(() => X.consommerEvenement(s.E, Object.freeze(sortieCanonique())), { name: 'TypeError' });
  assert(X.consommerEvenement(s.E, sortie)); assert.equal(sortie.sequence, 1);
  assert.equal(X.consommerEvenement(s.E, sortie), false);
});
