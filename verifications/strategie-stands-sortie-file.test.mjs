// 12F4 : quitter physiquement une file bloquée, sans service, contact ni replacement.
import { definitionHistorique } from './helpers/catalogue-historique.mjs';
import assert from 'node:assert/strict';
import { test as nodeTest, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function empreintesSources() {
  const resultats = {};
  function ajouter(dossier) {
    for (const entree of readdirSync(path.join(racine, dossier), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const relatif = dossier + '/' + entree.name;
      if (entree.isDirectory()) ajouter(relatif);
      else if (entree.isFile()) resultats[relatif] = createHash('sha256').update(readFileSync(path.join(racine, relatif))).digest('hex');
    }
  }
  ajouter('src');
  resultats['verifications/strategie-stands-sortie-file.test.mjs'] = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');
  return resultats;
}
const empreintesAvant = empreintesSources(), resultats = [];
function test(nom, f) {
  nodeTest(nom, () => {
    const debut = performance.now(), resultat = {nom, reussi: false};
    try { resultat.parcours = f(); resultat.reussi = true; }
    catch (e) { resultat.erreur = e.message; throw e; }
    finally { resultat.dureeExecutionMs = performance.now() - debut; resultats.push(resultat); }
  });
}
after(() => {
  const empreintesApres = empreintesSources();
  if (process.env.BITUME_RAPPORTS_STANDS) {
    const dossier = path.resolve(process.env.BITUME_RAPPORTS_STANDS); mkdirSync(dossier, {recursive: true});
    writeFileSync(path.join(dossier, 'sortie-file.json'), JSON.stringify({date: new Date().toISOString(), node: process.version,
      pas: 1 / 120, sourcesStables: JSON.stringify(empreintesAvant) === JSON.stringify(empreintesApres),
      tests: resultats.length, reussis: resultats.filter(r => r.reussi).length, resultats, empreintes: empreintesAvant}, null, 2) + '\n');
  }
  assert.deepEqual(empreintesApres, empreintesAvant, 'les sources restent identiques pendant les parcours');
});
const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons',
  'vegetation', 'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course']) require('../src/' + nom + '.js');
const B = globalThis.BITUME, DT = 1 / 120;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const CATALOGUE = new Function(source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0] + '; return CATALOGUE;')();
const NEUTRE = {gaz: 0, frein: 1, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0};
const circuits = new Map();
function circuit(id) {
  if (!circuits.has(id)) {
    const k = definitionHistorique(CATALOGUE, id);
    const c = B.circuit.creer(k.graine, {theme: k.theme, longueur: k.longueur, nom: k.nom});
    B.bords.limites(c, B.bords.planifier(c));
    const decor = B.decor.construire(c, {qualite: 'high', matieres: true, vegetation: true, vegetationQualite: 'high', saison: 'ete'});
    c.obstacles = B.obstacles.creer(decor.obstacles);
    assert.ok(c.obstacles.objets.length > 0, 'limites et solides réels actifs');
    circuits.set(id, c);
  }
  return circuits.get(id);
}
function poser(co, v, s, vitesse = 0, d = co.c.stands.d) {
  const q = B.circuit.echantillon(co.c, s);
  Object.assign(v.etat, {s, d, v: vitesse, psi: 0, beta: 0, omega: vitesse * q.courbure, y: q.y,
    rapport: vitesse ? 3 : 1, regime: vitesse ? 11000 : 5000});
  v.progression = s; v.passages = v.maxPassages = 0; v.tourValide = false;
}
function seance(id = 'val-brule', options = {}) {
  const c = circuit(id);
  B.meteo.actuel = B.chaussee.preparer({pluie: 0, mouille: 0, neigeSol: 0, fixe: true}, B.saisons.profil('ete', c.theme));
  const co = B.course.creer(c, {mode: 'course', rivaux: 1, graine: 1244, tours: 99, difficulte: 1, ...options});
  co.phase = 'course'; co.feux.vert = true; co.temps = co.horloge = 30;
  for (const v of co.voitures) v.etat.pneus = v.etat.pneusProchainArret = v.livree.pneus = 'slicks';
  for (const v of co.voitures.filter(v => !v.joueur && !v.humain)) v.etat.etatPneus.forEach((r, n) => Object.assign(r,
    {usure: .9, salete: .2, grainage: .1, distance: 20000 + n * 100, sollicitation: 40000 + n * 100}));
  return co;
}
function quitter(co, secondes = 40, options = {}) {
  const v = co.voitures.find(v => !v.joueur && !v.humain), e = v.etat, humain = co.joueur, S = co.c.stands;
  const initial = structuredClone(e), roues = e.etatPneus, poseHumain = {s: humain.etat.s, d: humain.etat.d}, debut = co.horloge;
  let precedent = structuredClone(e.etatPneus), pret = false, annule = false, recul = 0;
  for (let n = 0; n < secondes / DT; n++) {
    const sAvant = e.s, dAvant = e.d, vitesseAvant = e.v;
    const evenements = B.course.pas(co, options.commandes ? options.commandes(n * DT) : NEUTRE, DT);
    assert.ok(!evenements.some(ev => ev.type === 'contact' && (ev.a === v.id || ev.b === v.id)), 'aucun contact pendant le dégagement');
    assert.ok(!evenements.some(ev => ev.type === 'choc' && ev.id === v.id) && !e.auRail, 'aucun choc contre les limites ou solides');
    assert.ok(!evenements.some(ev => ev.type === 'stand' && ev.id === v.id && ['service', 'repare'].includes(ev.phase)), 'aucun service admis dans la file bloquée');
    annule ||= evenements.some(ev => ev.type === 'stand' && ev.id === v.id && ev.phase === 'annule');
    assert.equal(e.repositionnements || 0, initial.repositionnements || 0, 'aucun replacement automatique');
    assert.ok(!e.accident && !e.recuperation && !e.reparation, 'aucun accident ou secours utilisé pour se libérer');
    const deplacement = Math.hypot(B.circuit.ecart(co.c, sAvant, e.s), e.d - dAvant);
    assert.ok(deplacement <= (Math.max(Math.abs(e.v), Math.abs(vitesseAvant)) + 2) * DT,
      'la pose évolue continûment avec la vitesse physique');
    assert.equal(e.servicePneus, initial.servicePneus); assert.equal(e.pneus, initial.pneus);
    assert.equal(e.etatPneus, roues, 'les quatre mêmes pneus restent équipés');
    e.etatPneus.forEach((r, i) => {
      assert.equal(r.graine, precedent[i].graine);
      for (const cle of ['usure', 'distance', 'sollicitation']) assert.ok(r[cle] + 1e-10 >= precedent[i][cle], cle + ' conservée sans remise à neuf');
    });
    precedent = structuredClone(e.etatPneus);
    if (!options.bloqueurMobile) assert.ok(Math.abs(B.circuit.ecart(co.c, poseHumain.s, humain.etat.s)) < .05 && Math.abs(humain.etat.d - poseHumain.d) < .05,
      'le joueur garé reste à sa place');
    if (options.observer) options.observer(n * DT, v, evenements);
    if (e.v < -.05) recul += DT;
    if (B.circuit.ecart(co.c, S.garage1, e.s) > 30 && e.v > 8 && !e.stands && !B.course.dansLaVoie(co.c, e, S) &&
      v.ia.stand.phase === 'repos') {
      pret = true; break;
    }
  }
  assert.ok(pret, 'reprise réelle de course dans le délai : ' + JSON.stringify({s: e.s, d: e.d, v: e.v,
    psi: e.psi, phase: v.ia.stand.phase, recul, temps: co.horloge - debut, garage1: S.garage1}));
  if (!options.serviceAccompli) assert.ok(annule, 'la tentative de service abandonnée est signalée');
  assert.equal(e.servicePneus, initial.servicePneus);
  return {circuit: co.c.nom, dureeSimulee: co.horloge - debut, reculSecondes: recul,
    distanceParcourue: e.distance - initial.distance, sFinal: e.s, dFinal: e.d, vitesseFinale: e.v,
    servicesAvant: initial.servicePneus, servicesApres: e.servicePneus, pneus: e.pneus,
    usureInitiale: initial.etatPneus.map(r => r.usure), usureFinale: e.etatPneus.map(r => r.usure)};
}

for (const distance of [8, 10]) test('12F4 IA immobilisée à ' + distance + ' m derrière un joueur : dégagement réel sans contact', () => {
  try {
    const co = seance(), v = co.voitures[1], S = co.c.stands;
    // État initial explicite de deux voitures déjà en file ; plus aucune pose n'est écrite pendant l'essai.
    poser(co, v, S.garage0 + 10); poser(co, co.joueur, S.garage0 + 10 + distance);
    Object.assign(v.ia.stand, {phase: 'voie', debut: co.temps - 10, vuStand: true, motif: 'usure', pneus: 'slicks', revision: v.etat.servicePneus});
    v.etat.stands = {phase: 'voie', t: 0, repare: false};
    return quitter(co);
  } finally { B.meteo.actuel = null; }
});

test('12F4 vraie approche vers un joueur garé : attente bornée puis retour en course', () => {
  try {
    const co = seance(), v = co.voitures[1], S = co.c.stands;
    poser(co, v, ((S.debut - 350) % co.c.longueur + co.c.longueur) % co.c.longueur, 25, 0);
    poser(co, co.joueur, S.garage0 + 30);
    // Le plan reste au repos initial : décision, entrée, attente et sortie viennent tous de la simulation.
    assert.equal(v.ia.stand.phase, 'repos');
    return quitter(co, 140);
  } finally { B.meteo.actuel = null; }
});

test('12F4 voiture derrière la file : recul sûr puis sortie quand elle libère réellement la place', () => {
  try {
    const co = seance('val-brule', {rivaux: 2,
      humains: {noms: ['Devant', 'Derrière'], locaux: [0, 1], hote: true, enLigne: false}});
    const v = co.voitures[2], arriere = co.voitures[1], S = co.c.stands;
    poser(co, v, S.garage0 + 5); poser(co, co.joueur, v.etat.s + 8); poser(co, arriere, v.etat.s - 7);
    Object.assign(v.ia.stand, {phase: 'voie', debut: co.temps - 10, vuStand: true, motif: 'usure', pneus: 'slicks', revision: v.etat.servicePneus});
    v.etat.stands = {phase: 'voie', t: 0, repare: false};
    const depart = arriere.etat.s, replacements = arriere.etat.repositionnements || 0;
    let attenteObservee = false, reculHumain = false;
    const resultat = quitter(co, 40, {
      commandes: t => [NEUTRE, t < 8 ? NEUTRE : {...NEUTRE, marcheArriere: true}],
      observer(t, voiture) {
        assert.equal(arriere.etat.repositionnements || 0, replacements);
        if (t < 8) {
          assert.ok(Math.abs(B.circuit.ecart(co.c, depart, arriere.etat.s)) < .05, 'la voiture arrière attend à sa place');
          if (t > 7) attenteObservee = Math.abs(voiture.etat.v) < .5;
        } else reculHumain ||= B.circuit.ecart(co.c, depart, arriere.etat.s) < -8 && arriere.etat.v < -1;
      }
    });
    assert.ok(attenteObservee, 'l’IA reste en attente lorsque les deux intervalles sont insuffisants');
    assert.ok(reculHumain, 'la place arrière est libérée par un vrai recul commandé');
    return {...resultat, attenteObservee, reculHumain};
  } finally { B.meteo.actuel = null; }
});

test('12F4 service achevé : sortie bloquée par un joueur puis reprise sans second service', () => {
  try {
    const co = seance(), v = co.voitures[1], S = co.c.stands;
    poser(co, v, ((S.debut - 350) % co.c.longueur + co.c.longueur) % co.c.longueur, 25, 0);
    poser(co, co.joueur, S.garage1 + 8);
    let termine = false, debutService = null, duree = null;
    for (let n = 0; n < 120 / DT; n++) {
      const ev = B.course.pas(co, NEUTRE, DT);
      assert.ok(!ev.some(e => e.type === 'contact' && (e.a === v.id || e.b === v.id)));
      if (ev.some(e => e.type === 'stand' && e.id === v.id && e.phase === 'service')) {
        debutService = co.horloge; duree = v.etat.stands.duree;
      }
      if (ev.some(e => e.type === 'stand' && e.id === v.id && e.phase === 'repare')) {
        termine = true; break;
      }
    }
    assert.ok(termine, 'un service complet réel précède la sortie');
    assert.ok(debutService !== null && co.horloge - debutService >= duree - DT * 2);
    assert.equal(v.etat.servicePneus, 1);
    const resultat = quitter(co, 40, {serviceAccompli: true});
    assert.equal(v.etat.servicePneus, 1, 'la sortie bloquée ne déclenche pas un deuxième service');
    return {...resultat, dureeServiceObservee: duree};
  } finally { B.meteo.actuel = null; }
});

for (const [nom, meteo, saison] of [
  ['pluie', {pluie: 1, mouille: 1, neigeSol: 0, fixe: true}, 'ete'],
  ['neige', {pluie: .8, mouille: 0, neigeSol: .8, precipitationsNeige: true, fixe: true}, 'hiver']
]) test('12F4 file serrée sous ' + nom + ' : les slicks usés restent équipés pendant le dégagement', () => {
  try {
    const co = seance(), v = co.voitures[1], S = co.c.stands;
    B.meteo.actuel = B.chaussee.preparer(meteo, B.saisons.profil(saison, co.c.theme));
    poser(co, v, S.garage0 + 10); poser(co, co.joueur, v.etat.s + 8);
    const surface = B.chaussee.lire(co.c, v.etat.s, B.meteo.actuel);
    assert.equal(surface.abri, false, 'le parcours se déroule sur la chaussée mouillée ou enneigée');
    assert.equal(B.conduite.pneusConseilles(surface), nom, 'les slicks sont réellement inadaptés');
    Object.assign(v.ia.stand, {phase: 'voie', debut: co.temps - 10, vuStand: true, motif: 'usure', pneus: nom, revision: v.etat.servicePneus});
    v.etat.pneusProchainArret = nom; v.etat.stands = {phase: 'voie', t: 0, repare: false};
    const resultat = quitter(co);
    assert.equal(v.etat.pneus, 'slicks', 'aucun équipement anticipé de la monte demandée');
    return {...resultat, surface};
  } finally { B.meteo.actuel = null; }
});

test('12F4 Haut-Col : sortie de file serrée sur le second circuit avec ses vrais obstacles', () => {
  try {
    const co = seance('haut-col'), v = co.voitures[1], S = co.c.stands;
    poser(co, v, S.garage0 + 10); poser(co, co.joueur, v.etat.s + 8);
    Object.assign(v.ia.stand, {phase: 'voie', debut: co.temps - 10, vuStand: true, motif: 'usure', pneus: 'slicks', revision: v.etat.servicePneus});
    v.etat.stands = {phase: 'voie', t: 0, repare: false};
    return quitter(co);
  } finally { B.meteo.actuel = null; }
});

test('12F4 joueur qui redémarre pendant le dégagement : restitution réelle à la conduite de course', () => {
  try {
    const co = seance(), v = co.voitures[1], humain = co.joueur, S = co.c.stands;
    poser(co, v, S.garage0 + 10); poser(co, humain, v.etat.s + 8);
    Object.assign(v.ia.stand, {phase: 'voie', debut: co.temps - 10, vuStand: true, motif: 'usure', pneus: 'slicks', revision: v.etat.servicePneus});
    v.etat.stands = {phase: 'voie', t: 0, repare: false};
    const departHumain = humain.etat.s, replacements = humain.etat.repositionnements || 0;
    let redemarrage = null, mobilePendantRecul = false, margeLiberee = false;
    const resultat = quitter(co, 40, {
      bloqueurMobile: true,
      commandes(t) {
        if (redemarrage === null && v.etat.v < -.5) redemarrage = t;
        // Les commandes de conduite font partir le joueur et suivre la route ; aucun état reçu ou déplacement forcé.
        return redemarrage === null ? NEUTRE : B.course.commandesIA(co, humain);
      },
      observer(t, voiture, ev) {
        assert.equal(humain.etat.repositionnements || 0, replacements, 'le joueur redémarre sans secours');
        assert.ok(!ev.some(e => e.type === 'choc' && e.id === humain.id) && !humain.etat.auRail, 'le joueur quitte réellement la file sans choc');
        const distance = B.circuit.ecart(co.c, voiture.etat.s, humain.etat.s);
        mobilePendantRecul ||= voiture.etat.v < -.05 && humain.etat.v > 2;
        margeLiberee ||= distance > 30 && humain.etat.v > voiture.etat.v + 5;
        if (redemarrage === null) assert.ok(Math.abs(B.circuit.ecart(co.c, departHumain, humain.etat.s)) < .05);
      }
    });
    assert.ok(redemarrage !== null && mobilePendantRecul, 'le bloqueur est réellement reparti pendant le recul IA');
    assert.ok(margeLiberee && B.circuit.ecart(co.c, v.etat.s, humain.etat.s) > 20, 'le joueur a dégagé l’intervalle avant');
    assert.equal(v.ia.stand.phase, 'repos', 'la conduite ordinaire est réellement rétablie');
    return {...resultat, redemarrage, mobilePendantRecul, margeLiberee, distanceAvantFinale: B.circuit.ecart(co.c, v.etat.s, humain.etat.s)};
  } finally { B.meteo.actuel = null; }
});
