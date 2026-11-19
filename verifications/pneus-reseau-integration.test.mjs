// 12F3 : vrai contrôleur réseau, vrais pneus/course ; seuls DOM, transport et horloge sont bornés.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'conduite', 'degats', 'contacts', 'course', 'meteo', 'ambiance', 'saisons', 'graphismes', 'reseau', 'pneus-reseau']) require('../src/' + nom + '.js');
const modules = globalThis.BITUME;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const debut = source.indexOf('  const EL = ');
const fin = source.indexOf('  for (const r of document.querySelectorAll(\'input[name="joueursIci"]\'))', debut);
assert.ok(debut >= 0 && fin > debut, 'bloc réseau réel présent');
const reseau = source.slice(debut, fin);
function fonction(nom) {
  const a = source.indexOf('  function ' + nom + '('), ligne = source.indexOf('\n', a);
  assert.ok(a >= 0, nom + ' présente dans jeu.js');
  if (source.slice(a, ligne).trimEnd().endsWith('}')) return source.slice(a, ligne);
  const z = source.indexOf('\n  }', a);
  assert.ok(z > a, nom + ' complète dans jeu.js');
  return source.slice(a, z + 4);
}
const noms = ['contratPiste', 'choixPneusLocaux', 'pneusAutomatiques', 'appliquerConseilPneus', 'choisirPneusPilote', 'majChoixPneus',
  'monterPneusDepart', 'choisirPneusStands', 'majPneusStands', 'initialiserPneusReseau', 'envoyerPneusReseau',
  'recevoirPneusReseau', 'recevoirEtatEnLigne', 'reprendrePneusReseau', 'actualiserPneusDistants', 'traiter'];
const ajouts = noms.filter(n => !reseau.includes('  function ' + n + '(')).map(fonction).join('\n');
const catalogue = source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0];
const assembler = new Function('B', `
  let session = null, ecran = 'course', modePrepa = 'course', retourReglages = 'titre', graineCourse = 900;
  let conditionsPreparation = null, conditionsPreparationCle = '', maintenant = 0, numero = 0;
  const timers = new Map(), messages = [], elements = new Map(), callbacks = new Map();
  const setTimeout = (f, d) => { const id = ++numero; timers.set(id, {f, t: maintenant + d}); return id; };
  const clearTimeout = id => timers.delete(id);
  const performance = { now: () => maintenant };
  const $ = id => { if (!elements.has(id)) elements.set(id, {hidden: false, disabled: false, textContent: '', innerHTML: '', classList: {add() {}, remove() {}}}); return elements.get(id); };
  const document = { querySelector: $, querySelectorAll: () => [] };
  const texte = (n, t) => n.textContent = t, classe = () => {};
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), ramener = (x, l) => ((x % l) + l) % l;
  const reglages = {circuit: 0, tours: 99, difficulte: 1, meteo: 'soleil', pneus: 'slicks', pneusPilotes: ['slicks', 'neige'], pneusAutoPilotes: [false, false], joueursLocaux: 1};
  const NOMS_PNEUS = B.pneus.NOMS_PNEUS, son = null;
  const message = () => {}, sousMessage = () => {}, finirClassement = () => {}, montrerResultats = () => {}, sauverReglages = () => {};
  const finTour = () => {}, finTourJ2 = () => {}, chrono = n => String(n);
  const aller = s => { ecran = s; if (s === 'enligne') majSalon(); };
  const preparerSeance = () => { throw new Error('chargement de course hors du périmètre de ce harnais'); };
  ${catalogue}
  ${reseau}
  ${ajouts}
  return {
    EL, reglages, messages, $, ${noms.join(', ')}, surMessageEnLigne, surDepart, surFermeture, envoyerEtats, appliquerDistant,
    installer(S) { session = S; }, ecran(n) { ecran = n; },
    horloge(ms) { maintenant = ms; },
    connecter(machine, joueurs) {
      const R = {id: machine, etat: 'connecte', code: 'ABCD', pairs: new Map(),
        membres: joueurs.map((n, id) => ({id, joueurs: n, nom: 'Machine ' + id})),
        pretAvec: id => id !== machine && joueurs[id] !== undefined,
        horloge: () => session ? session.enLigne.T0 + session.course.horloge * 1000 : maintenant,
        envoyer(m, a) { messages.push({m: structuredClone(m), a}); }, envoyerEtat(buf) { this.dernierEtat = buf; },
        on(n, f) { callbacks.set(n, f); return this; }, emit(n, ...args) { callbacks.get(n)?.(...args); },
        fermer() { this.etat = 'ferme'; this.emit('ferme', 'local'); }
      };
      B.reseau.creer = () => R;
      nouvelleLiaison(); EL.role = machine === 0 ? 'hote' : 'invite'; reglages.joueursLocaux = joueurs[machine];
      return R;
    }
  };
`);
const c = modules.circuit.creer(11, {theme: 'foret', longueur: 4200}), DT = 1 / 120;
const TYPES = ['slicks', 'neige', 'inter', 'pluie'];
function creer(machine, joueurs = [2, 2], seance = 'integration-12f3-1') {
  const B = {...modules, reseau: {...modules.reseau, adresseSalon: () => 'test://salon'}}, a = assembler(B), R = a.connecter(machine, joueurs);
  const humains = joueurs.flatMap((n, id) => Array.from({length: n}, (_, local) => ({machine: id, local, nom: 'Pilote ' + id + '.' + local})));
  const locaux = humains.flatMap((h, id) => h.machine === machine ? [id] : []), role = machine === 0 ? 'hote' : 'invite';
  const cfg = {seance, protocolePneus: 1, versionChoixPneus: 2, piste: a.contratPiste(0), graine: 808,
    i: 0, tours: 99, difficulte: 1, T0: 10000, humains, locaux, role, pneus: TYPES.slice(0, humains.length)};
  const co = B.course.creer(c, {mode: 'course', rivaux: 5, graine: cfg.graine, tours: 99,
    humains: {noms: humains.map(h => h.nom), locaux, hote: machine === 0, enLigne: true}});
  co.phase = 'course'; co.feux.vert = true; co.temps = co.horloge = 20;
  a.monterPneusDepart(co, true, cfg, 'inter');
  const S = {type: locaux.length === 2 ? 'duo' : 'course', course: co, c, locaux,
    enLigne: {T0: cfg.T0, role, humains, seance}, enLigneOrigine: true,
    vueJ2: locaux.length === 2 ? {secousse: 0, eclair: 0} : null};
  a.installer(S); a.initialiserPneusReseau(S, cfg); a.horloge(20000); a.messages.length = 0;
  return {...a, B, R, S, co, cfg, machine};
}
function pneus(v) { return structuredClone({type: v.etat.pneus, service: v.etat.servicePneus, roues: v.etat.etatPneus}); }
function user(v, base = .2) {
  v.etat.etatPneus.forEach((r, i) => Object.assign(r, {usure: base + .1 * i, salete: .1 + .05 * i,
    grainage: .05 + .1 * i, distance: 12000 + 100 * i, sollicitation: 23000 + 200 * i}));
}
function proches(a, b) {
  assert.equal(a.type, b.type); assert.equal(a.service, b.service); assert.equal(a.roues.length, 4);
  a.roues.forEach((r, i) => {
    assert.equal(r.graine, b.roues[i].graine);
    for (const k of ['usure', 'salete', 'grainage']) assert.ok(Math.abs(r[k] - b.roues[i][k]) <= .001, k + ' transmis');
    for (const k of ['distance', 'sollicitation']) assert.ok(Math.abs(r[k] - b.roues[i][k]) <= 1, k + ' transmis');
  });
}
function paquets(a) { return a.messages.filter(x => x.m.t === 'pneus-etat' || x.m.t === 'pneus-service'); }
function envoyer(a, b, force = true) {
  const n = a.messages.length; a.envoyerPneusReseau(a.S, force);
  const nouveaux = a.messages.slice(n).filter(x => x.m.t === 'pneus-etat' || x.m.t === 'pneus-service');
  if (a.machine !== 0) assert.ok(nouveaux.every(x => x.a === 0), 'les invités envoient leurs pneus uniquement à l’hôte');
  for (const {m, a: destinataire} of nouveaux) if (destinataire === undefined || destinataire === b.machine) b.surMessageEnLigne(structuredClone(m), a.machine);
  return nouveaux;
}
function relayer(h, cible, depuis = 0) {
  const messages = h.messages.slice(depuis).filter(x => x.m.t === 'pneus-relais' && (x.a === undefined || x.a === cible.machine));
  for (const {m} of messages) cible.surMessageEnLigne(structuredClone(m), 0);
  return messages;
}
function commencer(a, id) {
  const v = a.co.voitures[id], st = c.stands, s = (st.garage0 + st.garage1) / 2;
  Object.assign(v.etat, {s, d: st.d, v: 0, psi: 0, beta: 0, omega: 0, y: modules.circuit.echantillon(c, s).y});
  const ev = [];
  a.B.course.stands(a.co, v, DT, ev); a.B.course.stands(a.co, v, DT, ev);
  assert.equal(v.etat.stands?.phase, 'service'); a.traiter(a.S, ev); return v;
}
function terminer(a, v) {
  const ev = [];
  for (let i = 0; i < 2400 && v.etat.stands?.phase === 'service'; i++) a.B.course.stands(a.co, v, DT, ev);
  assert.equal(v.etat.stands?.phase, 'sortie'); a.traiter(a.S, ev); return ev;
}

for (const joueurs of [[2, 2], [2, 1], [1, 2]]) test('12F3 : transport indépendant des pneus pour ' + joueurs.join('+'), () => {
  const h = creer(0, joueurs), i = creer(1, joueurs);
  for (const a of [h, i]) for (const id of a.S.locaux) user(a.co.voitures[id], .1 + id * .03);
  const locauxH = h.S.locaux.map(id => pneus(h.co.voitures[id])), locauxI = i.S.locaux.map(id => pneus(i.co.voitures[id]));
  assert.ok(envoyer(h, i).length > 0); assert.ok(envoyer(i, h).length > 0);
  for (let id = 0; id < h.cfg.humains.length; id++) proches(pneus(h.co.voitures[id]), pneus(i.co.voitures[id]));
  assert.deepEqual(h.S.locaux.map(id => pneus(h.co.voitures[id])), locauxH);
  assert.deepEqual(i.S.locaux.map(id => pneus(i.co.voitures[id])), locauxI);
});

test('12F3 : envoi depuis la boucle réseau limité à deux états pneus par seconde', () => {
  const h = creer(0); h.envoyerPneusReseau(h.S, true); const n = paquets(h).length;
  assert.equal(n, 1);
  h.co.horloge = 20.49; h.horloge(20490); h.envoyerEtats(h.S);
  assert.equal(paquets(h).length, n);
  h.co.horloge = 20.5; h.horloge(20500); h.envoyerEtats(h.S);
  assert.equal(paquets(h).length, n + 1);
  h.co.horloge = 20.99; h.horloge(20990); h.envoyerEtats(h.S);
  assert.equal(paquets(h).length, n + 1);
  h.co.horloge = 21; h.horloge(21000); h.envoyerEtats(h.S);
  assert.equal(paquets(h).length, n + 2);
  assert.ok(h.R.dernierEtat instanceof ArrayBuffer, 'les états cinématiques continuent d’être envoyés');
});

test('12F3 : le vrai callback cinématique conserve l’expéditeur et respecte les autorités de voitures', () => {
  const h = creer(0), i = creer(1), t = i.cfg.T0 + i.co.horloge * 1000;
  const p = i.B.reseau.deballer(i.B.reseau.emballer(t, [i.co.voitures[2]]));
  h.R.emit('etat', p, 99); assert.equal(h.EL.recus.size, 0);
  h.R.emit('etat', p, 0); assert.equal(h.EL.recus.size, 0);
  h.R.emit('etat', p, 1); assert.ok(h.EL.recus.has(2));
  const avant = h.EL.recus.get(2);
  const usurpe = i.B.reseau.deballer(i.B.reseau.emballer(t + 10, [i.co.voitures[0]]));
  h.R.emit('etat', usurpe, 1);
  assert.equal(h.EL.recus.has(0), false); assert.equal(h.EL.recus.get(2), avant);
});

test('12F3 : service réel du second pilote invité envoyé immédiatement, ancien état et doublon sans effet', () => {
  const h = creer(0), i = creer(1), id = i.S.locaux[1], v = i.co.voitures[id];
  user(v); const anciens = envoyer(i, h); const autre = pneus(h.co.voitures[i.S.locaux[0]]);
  i.ecran('pause'); assert.equal(i.choisirPneusStands(1, 'slicks'), true); i.ecran('course');
  commencer(i, id); const n = i.messages.length; terminer(i, v);
  const nouveaux = i.messages.slice(n).filter(x => x.m.t === 'pneus-service');
  assert.ok(nouveaux.length > 0, 'le service est transmis sans attendre le prochain envoi périodique');
  for (const {m} of nouveaux) h.surMessageEnLigne(m, 1);
  const recu = pneus(h.co.voitures[id]); proches(recu, pneus(v));
  assert.equal(recu.service, 1); assert.equal(recu.type, 'slicks'); assert.ok(recu.roues.every(r => r.usure === 0));
  assert.deepEqual(h.S.pneusVisuels[id], recu.roues, 'les quatre pneus du nouveau service apparaissent ensemble');
  const objets = h.co.voitures[id].etat.etatPneus;
  for (const {m} of [...anciens, ...nouveaux, ...anciens]) h.surMessageEnLigne(m, 1);
  assert.deepEqual(pneus(h.co.voitures[id]), recu); assert.equal(h.co.voitures[id].etat.etatPneus, objets);
  assert.deepEqual(pneus(h.co.voitures[i.S.locaux[0]]), autre);
});

test('12F3 : état périodique hors ordre et usurpation d’expéditeur ne changent pas les pneus', () => {
  const h = creer(0), i = creer(1), id = i.S.locaux[0];
  user(i.co.voitures[id], .1); const ancien = envoyer(i, h).at(-1).m;
  user(i.co.voitures[id], .4); const recent = envoyer(i, h).at(-1).m;
  const avant = h.co.voitures.map(pneus);
  h.surMessageEnLigne(ancien, 1); h.surMessageEnLigne(recent, 99); h.surMessageEnLigne(recent, 0);
  assert.deepEqual(h.co.voitures.map(pneus), avant);
  const locaux = i.S.locaux.map(k => pneus(i.co.voitures[k]));
  i.surMessageEnLigne(recent, 1);
  assert.deepEqual(i.S.locaux.map(k => pneus(i.co.voitures[k])), locaux);
});

test('12F3 : deux invités n’échangent des pneus que par un relais authentique de l’hôte', () => {
  const joueurs = [1, 1, 1], h = creer(0, joueurs), i = creer(1, joueurs), temoin = creer(2, joueurs);
  user(i.co.voitures[1], .3); const n = h.messages.length, directs = envoyer(i, h), avant = temoin.co.voitures.map(pneus);
  const relais = h.messages.slice(n).find(x => x.m.t === 'pneus-relais');
  assert.ok(relais, 'l’hôte relaie l’état qu’il vient d’accepter');
  for (const {m} of directs) temoin.surMessageEnLigne(m, 1);
  temoin.surMessageEnLigne(relais.m, 1); temoin.surMessageEnLigne(relais.m, 99);
  assert.deepEqual(temoin.co.voitures.map(pneus), avant);
  assert.ok(relayer(h, temoin, n).length > 0);
  proches(pneus(temoin.co.voitures[1]), pneus(h.co.voitures[1]));
  assert.ok(temoin.co.voitures[1].etat.etatPneus.every(r => r.usure > 0));
});

test('12F3 : chargement terminé après un service récupère le snapshot hôte et ses archives validées', () => {
  const joueurs = [1, 1, 1], h = creer(0, joueurs), i = creer(1, joueurs);
  user(h.co.voitures[0], .25); user(h.co.voitures[3], .3); user(i.co.voitures[1], .4);
  i.ecran('pause'); assert.equal(i.choisirPneusStands(0, 'pluie'), true); i.ecran('course');
  const v = commencer(i, 1), n = i.messages.length; terminer(i, v);
  for (const {m} of i.messages.slice(n)) if (m.t === 'pneus-service') h.surMessageEnLigne(m, 1);
  assert.equal(h.co.voitures[1].etat.servicePneus, 1);
  const tardif = creer(2, joueurs), debut = h.messages.length;
  for (const [patch, de] of [[{version: 0}, 2], [{seance: 'course-ancienne'}, 2], [{}, 99]]) {
    h.surMessageEnLigne({t: 'demande-pneus', version: 1, seance: h.cfg.seance, ...patch}, de);
  }
  assert.equal(h.messages.length, debut, 'une demande incompatible ou extérieure ne déclenche aucune réponse');
  h.surMessageEnLigne({t: 'demande-pneus', version: 1, seance: h.cfg.seance}, 2);
  const retour = h.messages.slice(debut);
  assert.ok(retour.some(x => x.m.t === 'pneus-etat')); assert.ok(retour.some(x => x.m.t === 'pneus-relais'));
  assert.ok(retour.every(x => x.a === 2), 'bootstrap adressé uniquement à la machine demandeuse');
  for (const {m} of retour) tardif.surMessageEnLigne(m, 0);
  for (const id of [0, 1, 3]) proches(pneus(tardif.co.voitures[id]), pneus(h.co.voitures[id]));
  assert.equal(tardif.co.voitures[1].etat.servicePneus, 1); assert.equal(tardif.co.voitures[1].etat.pneus, 'pluie');
  const avantPair = h.messages.length; h.R.emit('pair', 2);
  assert.ok(h.messages.slice(avantPair).some(x => x.m.t === 'pneus-etat' && x.a === 2), 'le vrai hook de liaison relance aussi le bootstrap');
  const avantInconnu = h.messages.length; h.R.emit('pair', 99);
  assert.ok(h.messages.slice(avantInconnu).every(x => !['pneus-etat', 'pneus-service', 'pneus-relais'].includes(x.m.t)), 'un nouveau pilote hors grille attend la course suivante');
});

test('12F3 : interpolation visuelle des roues distante sans seconde usure ni modification du pneu physique', () => {
  const h = creer(0), i = creer(1), id = i.S.locaux[0];
  user(i.co.voitures[id], .3); envoyer(i, h);
  const physique = pneus(h.co.voitures[id]), objets = h.co.voitures[id].etat.etatPneus;
  const visibles = h.S.pneusVisuels[id], avant = visibles.map(r => r.usure);
  const locaux = h.S.locaux.map(k => pneus(h.co.voitures[k]));
  h.actualiserPneusDistants(h.S, DT);
  assert.equal(h.S.pneusVisuels[id], visibles, 'le miroir conserve ses objets préparés');
  assert.equal(h.co.voitures[id].etat.etatPneus, objets); assert.deepEqual(pneus(h.co.voitures[id]), physique);
  visibles.forEach((r, n) => {
    assert.ok(r.usure > avant[n] && r.usure < physique.roues[n].usure, 'l’image progresse vers l’usure reçue');
    assert.notEqual(r, objets[n]); assert.equal(r.graine, objets[n].graine);
  });
  for (let k = 0; k < 240; k++) h.actualiserPneusDistants(h.S, DT);
  visibles.forEach((r, n) => assert.ok(Math.abs(r.usure - physique.roues[n].usure) < .000001));
  assert.deepEqual(pneus(h.co.voitures[id]), physique);
  assert.deepEqual(h.S.locaux.map(k => pneus(h.co.voitures[k])), locaux);
});

test('12F3 : changement de séance refuse un paquet de la course précédente même à graine identique', () => {
  const i = creer(1), h = creer(0), nouveau = creer(0, [2, 2], 'integration-12f3-2');
  user(i.co.voitures[2], .4); const vieux = envoyer(i, h).at(-1).m;
  const avant = nouveau.co.voitures.map(pneus);
  nouveau.surMessageEnLigne(vieux, 1);
  assert.deepEqual(nouveau.co.voitures.map(pneus), avant);
});

test('12F3 : reprise par l’hôte conserve le dernier état reçu et se propage sans événement de départ chez le témoin', () => {
  const joueurs = [1, 1, 1], h = creer(0, joueurs), i = creer(1, joueurs), temoin = creer(2, joueurs);
  user(i.co.voitures[1], .35); envoyer(i, h); relayer(h, temoin);
  const avant = pneus(h.co.voitures[1]), ancienRelais = h.messages.find(x => x.m.t === 'pneus-relais').m;
  i.ecran('pause'); assert.equal(i.choisirPneusStands(0, 'pluie'), true); i.ecran('course'); commencer(i, 1);
  user(i.co.voitures[1], .5); i.envoyerPneusReseau(i.S, true); const retarde = paquets(i).at(-1).m;
  h.R.membres = h.R.membres.filter(m => m.id !== 1); h.surDepart(1);
  assert.equal(h.co.voitures[1].reprise, true); assert.equal(h.co.voitures[1].distant, false);
  assert.deepEqual(pneus(h.co.voitures[1]), avant);
  envoyer(h, temoin); const repris = pneus(temoin.co.voitures[1]); proches(repris, avant);
  assert.equal(temoin.co.voitures[1].reprise, true); assert.equal(temoin.S.pneusReseau.autorites[1], 0);
  h.surMessageEnLigne(retarde, 1); temoin.surMessageEnLigne(retarde, 1);
  temoin.surMessageEnLigne(ancienRelais, 0);
  temoin.surMessageEnLigne({t: 'pneus-relais', origine: 1, etat: retarde}, 0);
  assert.deepEqual(pneus(h.co.voitures[1]), avant); assert.deepEqual(pneus(temoin.co.voitures[1]), repris);
  const ev = []; h.B.course.stands(h.co, h.co.voitures[1], 30, ev);
  assert.deepEqual(pneus(h.co.voitures[1]), avant); assert.equal(ev.length, 0);
  assert.equal(h.co.voitures[1].etat.servicePneus, 0, 'le service interrompu chez le pilote n’est pas terminé gratuitement');
  user(h.co.voitures[1], .45); envoyer(h, temoin);
  proches(pneus(temoin.co.voitures[1]), pneus(h.co.voitures[1]));
  assert.ok(temoin.co.voitures[1].etat.etatPneus[0].usure > repris.roues[0].usure, 'la nouvelle autorité continue de publier son usure');
});

test('12F3 : perte de l’hôte conserve les pneus reçus puis ferme l’application des anciens messages', () => {
  const h = creer(0), i = creer(1);
  user(h.co.voitures[0], .3); const messages = envoyer(h, i); const avant = i.co.voitures.map(pneus);
  i.surFermeture('parti');
  assert.equal(i.S.enLigne, null); assert.equal(i.co.voitures[0].reprise, true);
  assert.deepEqual(i.co.voitures.map(pneus), avant);
  for (const {m} of messages) i.surMessageEnLigne(m, 0);
  assert.deepEqual(i.co.voitures.map(pneus), avant);
});
