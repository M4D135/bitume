import { definitionHistorique, historiques } from './helpers/catalogue-historique.mjs';
import { creerCircuitCatalogue } from '../tools/qualification/circuit-catalogue.mjs';
// 12F4 : décisions et trajets physiques vers les stands, sans déplacer les voitures pendant un parcours réussi.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'route-des-cimes', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons',
  'vegetation', 'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course', 'pneus-reseau']) require('../src/' + nom + '.js');
const B = globalThis.BITUME, DT = 1 / 120;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const CATALOGUE = new Function(source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0] + '; return CATALOGUE;')();
const circuitsAvecStands = [...CATALOGUE.filter(k => !k.ouvert),
  ...historiques.filter(h => !CATALOGUE.some(k => k.id === h.id))];
assert.ok(circuitsAvecStands.some(k => k.id === 'baikal'));
const RAPPORTS = process.env.BITUME_RAPPORTS_STANDS || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../12f4-tests');
mkdirSync(RAPPORTS, {recursive: true});
const NEUTRE = {gaz: 0, frein: 1, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0};
const circuits = new Map();
function circuit(id) {
  if (!circuits.has(id)) {
    const k = definitionHistorique(CATALOGUE, id);
    const c = creerCircuitCatalogue(B, k);
    const decor = B.decor.construire(c, {qualite: 'high', matieres: true, vegetation: true, vegetationQualite: 'high', saison: 'ete'});
    c.obstacles = B.obstacles.creer(decor.obstacles);
    assert.ok(c.obstacles.objets.length > 0, 'les solides du vrai décor sont actifs');
    circuits.set(id, c);
  }
  return circuits.get(id);
}
function roues(v) {
  return structuredClone({pneus: v.etat.pneus, servicePneus: v.etat.servicePneus, etatPneus: v.etat.etatPneus});
}
function placerInitialement(co, v, s, vitesse = 25, d = 0) {
  const c = co.c; s = ((s % c.longueur) + c.longueur) % c.longueur;
  const q = B.circuit.echantillon(c, s);
  Object.assign(v.etat, {s, d, v: vitesse, psi: 0, beta: 0, omega: vitesse * q.courbure, y: q.y,
    rapport: vitesse ? 3 : 1, regime: vitesse ? 11000 : 5000});
  v.progression = s; v.passages = v.maxPassages = 0; v.tourValide = false;
}
function user(v, usure = .9) {
  v.etat.etatPneus.forEach((r, n) => Object.assign(r, {usure, salete: .2, grainage: .1,
    distance: 20000 + n * 100, sollicitation: 40000 + n * 100}));
}
function seance(id = 'val-brule', o = {}) {
  const c = circuit(id);
  B.meteo.actuel = B.chaussee.preparer({pluie: 0, mouille: 0, neigeSol: 0, fixe: true}, B.saisons.profil('ete', c.theme));
  const co = B.course.creer(c, {mode: 'course', rivaux: 1, graine: 1244, tours: 99, difficulte: 1, ...o});
  co.phase = 'course'; co.feux.vert = true; co.temps = co.horloge = 30;
  for (const v of co.voitures) {
    placerInitialement(co, v, c.stands.debut - 350 - Math.max(0, v.id - 1) * 35);
    v.etat.pneus = v.etat.pneusProchainArret = v.livree.pneus = 'slicks';
  }
  placerInitialement(co, co.joueur, c.stands.debut - 1500, 0, -2);
  return co;
}
function etatCourt(v) {
  const e = v.etat;
  return {id: v.id, s: e.s, d: e.d, v: e.v, psi: e.psi, rapport: e.rapport, gaz: e.gaz, frein: e.frein, volant: e.volant,
    pneus: e.pneus, service: e.servicePneus, usures: e.etatPneus.map(r => r.usure),
    stands: e.stands && {...e.stands}, strategie: v.ia.stand && {...v.ia.stand},
    repositionnements: e.repositionnements, fini: v.fini, abandon: v.abandon};
}
function verifier(nom, f) {
  test(nom, () => {
    const journal = {nom, pas: DT, catalogue: CATALOGUE.map(k => k.id), evenements: [], points: []};
    try { f(journal); journal.reussi = true; }
    catch (e) { journal.reussi = false; journal.erreur = {message: e.message, stack: e.stack}; throw e; }
    finally {
      B.meteo.actuel = null;
      const fichier = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
      writeFileSync(path.join(RAPPORTS, fichier + '.json'), JSON.stringify(journal, null, 2) + '\n');
    }
  });
}
function suivre(co, ids, journal, monteApres = null) {
  journal.circuit = {nom: co.c.nom, longueur: co.c.longueur, stands: co.c.stands, solides: co.c.obstacles.objets.length};
  const suivis = new Map(ids.map(id => {
    const v = co.voitures[id], initial = roues(v);
    return [id, {initial, precedentes: initial, tableau: v.etat.etatPneus, phase: null, service: null,
      phases: [], decision: false, repare: 0, sortie: null, replacements: v.etat.repositionnements || 0}];
  }));
  let pas = 0;
  return {
    suivis,
    avancer() {
      const ev = B.course.pas(co, NEUTRE, DT); pas++;
      const interes = ev.filter(e => ids.includes(e.id) || (e.type === 'contact' && (ids.includes(e.a) || ids.includes(e.b))));
      if (interes.length) journal.evenements.push({t: co.horloge, evenements: structuredClone(interes)});
      if (pas === 1 || pas % 30 === 0 || interes.some(e => e.type === 'stand')) journal.points.push({t: co.horloge, voitures: ids.map(id => etatCourt(co.voitures[id]))});
      journal.final = ids.map(id => etatCourt(co.voitures[id]));
      for (const id of ids) {
        const v = co.voitures[id], e = v.etat, suivi = suivis.get(id);
        const termines = ev.filter(x => x.id === id && x.type === 'stand' && x.phase === 'repare');
        suivi.decision ||= B.strategieStands.autorise(co, v);
        for (const x of ev) if (x.id === id && x.type === 'stand') {
          suivi.phases.push(x.phase);
          if (x.phase === 'sortie') suivi.sortie = {t: co.horloge, distance: e.distance, s: e.s};
        }
        assert.equal(e.repositionnements || 0, suivi.replacements, 'aucune téléportation pour rejoindre ou quitter les stands');
        const monteAttendue = suivi.repare || termines.length ? monteApres || suivi.initial.pneus : suivi.initial.pneus;
        assert.equal(e.pneus, monteAttendue, 'la monte ne change qu’après la fin réelle du service');
        assert.equal(v.livree.pneus, e.pneus, 'la livrée suit la monte réellement équipée');
        if (termines.length) {
          assert.equal(termines.length, 1); assert.equal(++suivi.repare, 1, 'un seul service utile');
          assert.ok(suivi.service, 'l’immobilisation au garage a été observée avant la fin');
          assert.ok(co.horloge - suivi.service.t >= suivi.service.duree - 2 * DT, 'le service a consommé sa durée réelle');
          assert.equal(e.servicePneus, suivi.initial.servicePneus + 1);
          assert.notEqual(e.etatPneus, suivi.tableau);
          assert.ok(e.etatPneus.every(r => r.usure === 0 && r.salete === 0 && r.grainage === 0 && r.distance === 0 && r.sollicitation === 0));
          e.etatPneus.forEach((r, n) => assert.notEqual(r.graine, suivi.initial.etatPneus[n].graine));
          suivi.neufs = roues(v); suivi.tableau = e.etatPneus;
        } else {
          assert.equal(e.servicePneus, suivi.initial.servicePneus + suivi.repare, 'aucun renouvellement hors de la fin du service');
          assert.equal(e.etatPneus, suivi.tableau);
          e.etatPneus.forEach((r, n) => {
            const precedent = suivi.precedentes.etatPneus[n];
            assert.equal(r.graine, precedent.graine);
            for (const cle of ['usure', 'distance', 'sollicitation']) assert.ok(r[cle] + 1e-10 >= precedent[cle], cle + ' ne revient pas à neuf avant un service complet');
          });
        }
        if (e.stands?.phase === 'service') {
          if (suivi.phase !== 'service') suivi.service = {t: co.horloge, duree: e.stands.duree, s: e.s, d: e.d, pneus: roues(v)};
          assert.equal(e.v, 0); assert.equal(e.s, suivi.service.s); assert.equal(e.d, suivi.service.d);
          assert.deepEqual(roues(v), suivi.service.pneus, 'les pneus restent strictement inchangés pendant l’immobilisation');
        }
        if (e.stands) assert.equal(v.tourValide, false, 'un arrêt ne crée pas de tour valable');
        suivi.phase = e.stands?.phase || null; suivi.precedentes = roues(v);
      }
      return ev;
    },
    termine() {
      return ids.every(id => {
        const v = co.voitures[id], s = suivis.get(id);
        return s.sortie && v.etat.distance > s.sortie.distance + 50 && v.etat.v > 8 &&
          B.circuit.ecart(co.c, co.c.stands.fin, v.etat.s) > 30 && !v.etat.stands && !B.course.dansLaVoie(co.c, v.etat, co.c.stands);
      });
    }
  };
}
function parcourir(co, ids, journal, secondes = 150, monteApres = null) {
  const suivi = suivre(co, ids, journal, monteApres);
  for (let k = 0; k < secondes / DT && !suivi.termine(); k++) suivi.avancer();
  assert.ok(suivi.termine(), 'entrée, service puis reprise réelle de progression dans le temps imparti');
  for (const s of suivi.suivis.values()) {
    assert.equal(s.decision, true); assert.equal(s.repare, 1);
    for (const phase of ['entree', 'service', 'repare', 'sortie']) assert.ok(s.phases.includes(phase), 'phase réellement observée : ' + phase);
  }
  for (const id of ids) assert.equal(co.voitures[id].etat.standsSortie, false, 'hors de la voie, le verrou de sortie est libéré');
  return suivi;
}

for (const k of circuitsAvecStands) verifier('12F4 ' + k.id + ' usure forte entrée service sortie sur le vrai parcours', journal => {
  const co = seance(k.id), v = co.voitures[1]; user(v);
  const joueur = roues(co.joueur); parcourir(co, [v.id], journal);
  assert.deepEqual(roues(co.joueur), joueur, 'le rival ne remplace aucun pneu du joueur');
});

for (const [nom, meteo, saison, monte] of [
  ['pluie', {pluie: 1, mouille: 1, neigeSol: 0, fixe: true}, 'ete', 'pluie'],
  ['neige', {pluie: .8, mouille: 0, neigeSol: .8, precipitationsNeige: true, fixe: true}, 'hiver', 'neige']
]) verifier('12F4 trajet réel sous ' + nom + ' slicks conservés puis monte adaptée après service complet', journal => {
  const co = seance(), v = co.voitures[1]; user(v);
  B.meteo.actuel = B.chaussee.preparer(meteo, B.saisons.profil(saison, co.c.theme));
  const surface = B.chaussee.lire(co.c, co.c.stands.garage0, B.meteo.actuel);
  journal.surface = {...surface};
  assert.equal(surface.abri, false, 'le garage ne tire pas son conseil d’un tunnel');
  assert.equal(B.conduite.pneusConseilles(surface), monte);
  const suivi = parcourir(co, [1], journal, 180, monte);
  assert.equal(v.etat.pneus, monte); assert.equal(suivi.suivis.get(1).neufs.pneus, monte);
});

verifier('12F4 pneus sains aucune décision ni arrêt dans le même parcours', journal => {
  const co = seance(), v = co.voitures[1], initial = roues(v);
  for (let n = 0; n < 40 / DT; n++) {
    const ev = B.course.pas(co, NEUTRE, DT);
    if (n % 120 === 0) journal.points.push({t: co.horloge, voitures: [etatCourt(v)]});
    assert.equal(B.strategieStands.autorise(co, v), false);
    assert.equal(v.etat.stands, null); assert.equal(v.etat.servicePneus, initial.servicePneus);
    assert.ok(!ev.some(e => e.type === 'stand' && e.id === v.id));
  }
  assert.deepEqual(v.etat.etatPneus.map(r => r.graine), initial.etatPneus.map(r => r.graine));
});

verifier('12F4 trois IA simultanées sont servies séparément puis repartent', journal => {
  const co = seance('val-brule', {rivaux: 3}), ids = [1, 2, 3];
  ids.forEach(id => user(co.voitures[id]));
  const suivi = parcourir(co, ids, journal, 240);
  const graines = ids.flatMap(id => suivi.suivis.get(id).neufs.etatPneus.map(r => r.graine));
  assert.equal(new Set(graines).size, 12, 'aucun partage de pneus neufs entre voitures');
});

verifier('12F4 second service après usure renouvelée et vrai tour sans boucle au même passage', journal => {
  const co = seance('port-sable'), v = co.voitures[1]; user(v);
  const premier = parcourir(co, [1], journal), passage = v.maxPassages, sortie = premier.suivis.get(1).sortie.t;
  assert.equal(v.etat.standsSortie, false);
  v.etat.etatPneus.forEach(r => { r.usure = .9; }); // nouvelle demande, sans changement de pose ni de compteur
  const deuxieme = suivre(co, [1], journal);
  for (let k = 0; k < 240 / DT && !deuxieme.termine(); k++) {
    const ev = deuxieme.avancer();
    if (co.horloge - sortie < 25 || v.maxPassages <= passage) {
      assert.equal(v.etat.servicePneus, 1, 'pas de répétition immédiate du service');
      assert.ok(!ev.some(e => e.id === 1 && e.type === 'stand' && e.phase === 'entree'), 'pas de nouvelle entrée au même passage ni pendant le délai');
    }
  }
  assert.ok(deuxieme.termine(), 'la voiture a réellement refait un tour puis son second arrêt');
  assert.ok(v.maxPassages > passage); assert.equal(v.etat.servicePneus, 2); assert.equal(v.etat.standsSortie, false);
  assert.equal(deuxieme.suivis.get(1).repare, 1);
});

verifier('12F4 garage occupé tardivement un humain devant bloque le début du service IA', journal => {
  const co = seance(), v = co.voitures[1], humain = co.joueur; user(v);
  const suivi = suivre(co, [1], journal);
  for (let k = 0; k < 100 / DT && v.etat.stands?.phase !== 'voie'; k++) suivi.avancer();
  assert.equal(v.etat.stands?.phase, 'voie', 'l’IA a décidé et rejoint réellement la voie');
  const S = co.c.stands;
  // Situation adversaire injectée après la décision : un autre pilote arrive au garage.
  placerInitialement(co, v, S.garage0 + 10, 0, S.d);
  placerInitialement(co, humain, S.garage0 + 30, 0, S.d);
  const avant = roues(v);
  for (let k = 0; k < 120 * 20; k++) {
    const ev = B.course.pas(co, NEUTRE, DT);
    journal.final = [etatCourt(v), etatCourt(humain)];
    journal.points.push({t: co.horloge, voitures: journal.final});
    if (ev.length) journal.evenements.push({t: co.horloge, evenements: structuredClone(ev)});
    assert.ok(!ev.some(e => e.type === 'contact' && (e.a === v.id || e.b === v.id)), 'le refus précède tout contact');
    assert.ok(!ev.some(e => e.id === v.id && e.type === 'stand' && ['service', 'repare'].includes(e.phase)));
    assert.notEqual(v.etat.stands?.phase, 'service'); assert.equal(v.etat.servicePneus, avant.servicePneus);
    assert.deepEqual(v.etat.etatPneus.map(r => r.graine), avant.etatPneus.map(r => r.graine));
  }
  assert.ok(B.circuit.ecart(co.c, S.garage1, v.etat.s) > 20 && v.etat.v > 8, 'le garage durablement occupé est dépassé avant le retour à la conduite ordinaire');
});

verifier('12F4 interruption juste avant la fin aucun pneu neuf ni service conservé', journal => {
  const co = seance(), v = co.voitures[1]; user(v); const suivi = suivre(co, [1], journal);
  let pret = false;
  for (let k = 0; k < 150 / DT; k++) {
    suivi.avancer(); const st = v.etat.stands;
    if (st?.phase === 'service' && st.t >= st.duree - 2 * DT) { pret = true; break; }
  }
  assert.ok(pret, 'un vrai trajet a amené la voiture à la fin de son immobilisation');
  const avant = roues(v), s = v.etat.s;
  v.etat.s += .2; // injection explicite d’un déplacement subi, juste avant le pas de fin
  journal.interruption = {t: co.horloge, avant: s, apres: v.etat.s};
  const ev = suivi.avancer();
  assert.ok(ev.some(e => e.id === 1 && e.type === 'stand' && e.phase === 'annule'));
  assert.ok(!ev.some(e => e.id === 1 && e.type === 'stand' && e.phase === 'repare'));
  assert.equal(v.etat.servicePneus, avant.servicePneus);
  assert.deepEqual(v.etat.etatPneus.map(r => r.graine), avant.etatPneus.map(r => r.graine));
});

verifier('12F4 distant humain arrivée abandon drapeau et fin proche ne programment pas de nouvel arrêt', journal => {
  for (const cas of ['distant', 'humain', 'fini', 'abandon', 'drapeau', 'dernier-tour']) {
    const co = seance(), v = co.voitures[1]; user(v);
    if (cas === 'distant') v.distant = true;
    if (cas === 'humain') { v.humain = true; v.joueur = true; }
    if (cas === 'fini') v.fini = true;
    if (cas === 'abandon') v.abandon = true;
    if (cas === 'drapeau') co.drapeau = co.temps;
    if (cas === 'dernier-tour') co.toursTotal = v.tours + 1;
    const avant = roues(v);
    assert.equal(B.strategieStands.commandes(co, v, {}), null, cas);
    B.course.pas(co, NEUTRE, DT);
    assert.equal(B.strategieStands.autorise(co, v), false, cas); assert.equal(v.etat.stands, null, cas);
    assert.equal(v.etat.servicePneus, avant.servicePneus, cas);
    assert.deepEqual(v.etat.etatPneus.map(r => r.graine), avant.etatPneus.map(r => r.graine), cas);
    journal.points.push({cas, voitures: [etatCourt(v)]});
  }
});

verifier('12F4 hôte sert le rival distant reçoit le résultat sans simuler un deuxième service', journal => {
  const humains = [{machine: 0, nom: 'Hôte'}, {machine: 1, nom: 'Invité'}], cfg = {noms: humains.map(h => h.nom), enLigne: true};
  const h = seance('val-brule', {rivaux: 2, humains: {...cfg, locaux: [0], hote: true}});
  const i = seance('val-brule', {rivaux: 2, humains: {...cfg, locaux: [1], hote: false}});
  const ctxH = B.pneusReseau.creer({seance: '12f4-hote', machine: 0, humains, nombre: h.voitures.length});
  const ctxI = B.pneusReseau.creer({seance: '12f4-hote', machine: 1, humains, nombre: i.voitures.length});
  user(h.voitures[2]); B.pneusReseau.recevoir(ctxI, B.pneusReseau.encoder(ctxH, h.voitures), 0, i.voitures);
  const avant = roues(i.voitures[2]);
  for (let n = 0; n < 120; n++) B.course.pas(i, NEUTRE, DT);
  assert.deepEqual(roues(i.voitures[2]), avant, 'l’invité n’use ni ne sert son rival distant');
  parcourir(h, [2], journal);
  const m = B.pneusReseau.encoder(ctxH, h.voitures, 'pneus-service');
  assert.ok(B.pneusReseau.recevoir(ctxI, m, 0, i.voitures).includes(2));
  const recu = roues(i.voitures[2]), local = roues(h.voitures[2]);
  assert.equal(recu.servicePneus, 1); assert.equal(recu.pneus, local.pneus);
  recu.etatPneus.forEach((r, n) => {
    assert.equal(r.graine, local.etatPneus[n].graine);
    assert.ok(Math.abs(r.usure - local.etatPneus[n].usure) <= 1 / B.pneusReseau.QUANTIFICATION);
  });
  assert.deepEqual(B.pneusReseau.recevoir(ctxI, m, 0, i.voitures), []);
  assert.deepEqual(roues(i.voitures[2]), recu, 'la répétition du résultat ne crée pas un nouveau service');
});

verifier('12F4 humain repris par IA conserve ses pneus puis paie le trajet et le service complet', journal => {
  const co = seance('val-brule', {rivaux: 1, humains: {noms: ['Hôte', 'Parti'], locaux: [0], hote: true, enLigne: true}});
  const v = co.voitures[1]; user(v); const avant = roues(v);
  assert.equal(v.distant, true); assert.equal(B.strategieStands.commandes(co, v, {}), null);
  // État de propriété fourni par la reprise réseau 12F3, sans toucher à la voiture ni aux pneus.
  v.distant = false; v.joueur = false; v.reprise = true;
  assert.deepEqual(roues(v), avant);
  parcourir(co, [1], journal); assert.equal(v.etat.servicePneus, 1);
});
