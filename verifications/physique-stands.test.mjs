// Stands sur le vrai monde PhysX : parcours, arrêt et dégagement sans piloter les poses.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const nom of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons',
  'vegetation', 'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course', 'solides-physx', 'physique']) require('../src/' + nom + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const CATALOGUE = new Function(source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0] + '; return CATALOGUE;')();
const FREIN = Object.freeze({ gaz: 0, frein: 1, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0, guidage: 0 });
const SECHES = { pluie: 0, mouille: 0, neigeSol: 0, fixe: true };
const circuits = new Map(), rapports = [], empreintes = {};
for (const f of ['physique', 'solides-physx', 'conduite', 'course', 'strategie-stands']) empreintes[f] = createHash('sha256').update(readFileSync(new URL('../src/' + f + '.js', import.meta.url))).digest('hex');

function circuit(saison) {
  if (!circuits.has(saison)) {
    const k = CATALOGUE.find(k => k.id === 'val-brule');
    const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
    B.bords.limites(c, B.bords.planifier(c));
    // La qualité légère conserve les nappes et solides réels (testés sur les huit circuits).
    const decor = B.decor.construire(c, { qualite: 'low', matieres: true, vegetation: false, saison });
    c.obstacles = B.obstacles.creer(decor.obstacles); circuits.set(saison, { c, decor });
  }
  return circuits.get(saison);
}
function placer(co, v, s, vitesse = 0, d = co.c.stands.d) {
  s = (s % co.c.longueur + co.c.longueur) % co.c.longueur;
  const q = B.circuit.echantillon(co.c, s);
  Object.assign(v.etat, { s, d, v: vitesse, psi: 0, beta: 0, omega: vitesse * q.courbure, y: q.y,
    rapport: vitesse ? 3 : 1, regime: vitesse ? 11000 : 5000 });
  v.progression = s; v.passages = v.maxPassages = 0; v.tourValide = false;
}
function usure(v) {
  v.etat.etatPneus.forEach((r, n) => Object.assign(r, { usure: .9, salete: .2, grainage: .1,
    distance: 20000 + n * 100, sollicitation: 40000 + n * 100 }));
}
function roues(v) { return structuredClone({ pneus: v.etat.pneus, servicePneus: v.etat.servicePneus, etatPneus: v.etat.etatPneus }); }
function court(v) {
  const e = v.etat, ph = e._physx;
  return { s: e.s, d: e.d, v: e.v, psi: e.psi, beta: e.beta, rapport: e.rapport, gaz: e.gaz, frein: e.frein,
    volant: e.volant, phase: v.ia?.stand?.phase, recul: v.ia?.stand?.recul, stands: e.stands && { ...e.stands },
    position: [ph.x, ph.y, ph.z], vitesse: [...ph.velocity], appuis: ph.groundCount, pneus: e.pneus, service: e.servicePneus };
}
function seance({ file = null, bloqueur = false, meteo = SECHES, saison = 'ete' } = {}) {
  const { c, decor } = circuit(saison), S = c.stands;
  B.meteo.actuel = B.chaussee.preparer(meteo, B.saisons.profil(saison, c.theme));
  const co = B.course.creer(c, { mode: 'course', rivaux: 1, graine: 1244, tours: 99, difficulte: 1 });
  co.phase = 'course'; co.feux.vert = true; co.temps = co.horloge = 30;
  const v = co.voitures[1];
  for (const o of co.voitures) o.etat.pneus = o.etat.pneusProchainArret = o.livree.pneus = 'slicks';
  usure(v);
  // Reprise des placements de strategie-stands*.test.mjs, avant la création des acteurs.
  placer(co, v, file === null ? S.debut - 350 : S.garage0 + 10, file === null ? 25 : 0, file === null ? 0 : S.d);
  placer(co, co.joueur, S.debut - 1500, 0, -2);
  if (file !== null) {
    Object.assign(v.ia.stand, { phase: 'voie', debut: co.temps - 10, vuStand: true, motif: 'usure', pneus: 'slicks', revision: v.etat.servicePneus });
    v.etat.stands = { phase: 'voie', t: 0, repare: false };
  }
  const p = B.physique.installer(co, decor);
  assert.equal(p.backend, 'PhysX'); assert.ok(p.solids.ids.length > 1000, 'vrai décor absent');
  if (file !== null || bloqueur) {
    // Un seul adversaire injecté, avant le premier pas. Plus aucune pose n'est écrite ensuite.
    const joueur = co.joueur, s = file === null ? S.garage0 + 30 : v.etat.s + file;
    placer(co, joueur, s);
    const q = B.circuit.echantillon(c, joueur.etat.s), x = q.x - Math.sin(q.cap) * S.d, z = q.z + Math.cos(q.cap) * S.d;
    const hit = p.world.raycast([x, q.y + 3, z], [0, -1, 0], 6, { mask: 1, staticOnly: true });
    assert.ok(hit.hit, 'sol réel du garage absent');
    p.world.setPose(joueur.etat._physx.id, [x, hit.y + .025, z, ...B.physique.quaternion(q.cap, Math.atan(q.pente || 0), q.devers || 0)]);
    p.world.setVelocity(joueur.etat._physx.id, [0, 0, 0]); p.world.setAngularVelocity(joueur.etat._physx.id, [0, 0, 0]);
  }
  const joueurInitial = p.world.readPose(co.joueur.etat._physx.id).slice(0, 3), placements = p.placements;
  const replacements = co.voitures.map(o => o.etat.repositionnements || 0);
  // Un correctif qui masquerait le problème par une pose/vitesse forcée doit faire échouer cette preuve.
  for (const nom of ['setPose', 'setVelocity', 'setAngularVelocity', 'setKinematicTarget']) p.world[nom] = () => assert.fail(nom + ' appelé pendant le parcours PhysX');
  return { co, c, v, p, joueurInitial, placements, replacements };
}
function surveiller(s, journal) {
  const { co, p, v, joueurInitial, placements, replacements } = s, id = v.etat._physx.id, ev = [];
  let n = 0;
  return () => {
    const ph = v.etat._physx, avant = [ph.x, ph.y, ph.z], vitesseAvant = Math.hypot(...ph.velocity);
    B.course.pas(co, FREIN, DT, ev); n++;
    const deplacement = Math.hypot(ph.x - avant[0], ph.y - avant[1], ph.z - avant[2]);
    assert.ok(deplacement <= (Math.max(vitesseAvant, Math.hypot(...ph.velocity)) + .5) * DT + .0005, 'pose discontinue : ' + JSON.stringify(court(v)));
    assert.equal(p.placements, placements, 'replacement physique automatique');
    co.voitures.forEach((o, i) => assert.equal(o.etat.repositionnements || 0, replacements[i], 'replacement automatique'));
    assert.ok(!v.etat.accident && !v.etat.recuperation && !v.etat.reparation, 'secours pendant le parcours');
    const contacts = p.world.contacts;
    assert.equal(contacts.enabled, true, 'rapport de contacts natifs désactivé');
    assert.equal(contacts.error, null, 'rapport de contacts natifs en erreur');
    assert.equal(contacts.dropped, 0, 'contacts natifs perdus par débordement');
    for (let i = 0; i < contacts.count; i++) {
      const c = contacts.points[i], autre = c.a === id ? c.b : c.b === id ? c.a : null;
      if (autre !== null && (p.byId.has(autre) || p.solids.acteurs.get(autre)?.groupe === 2)) {
        assert.fail('contact natif interdit : ' + JSON.stringify({ t: co.horloge, genre: p.solids.acteurs.get(autre)?.genre || 'voiture', contact: c, etat: court(v) }));
      }
    }
    assert.ok(!ev.some(e => e.type === 'contact' && (e.a === v.id || e.b === v.id)), 'contact de jeu pendant le parcours');
    assert.ok(!ev.some(e => e.type === 'choc' && e.id === v.id), 'choc de jeu pendant le parcours');
    const joueur = co.joueur.etat._physx;
    assert.ok(Math.hypot(joueur.x - joueurInitial[0], joueur.z - joueurInitial[2]) < .05, 'le joueur garé a été déplacé');
    const interes = ev.filter(e => e.id === v.id);
    if (n % 60 === 0 || interes.some(e => e.type === 'stand')) journal.points.push({ t: co.horloge, ...court(v) });
    if (interes.length) journal.evenements.push({ t: co.horloge, evenements: structuredClone(interes) });
    journal.final = court(v); journal.dureeSimulee = n * DT;
    return ev;
  };
}
function verifier(nom, options, f) {
  test(nom, () => {
    let s; const journal = { nom, reussi: false, points: [], evenements: [] }, debut = performance.now();
    try { s = seance(options); f(s, journal); journal.reussi = true; }
    catch (e) { journal.erreur = e.message; throw e; }
    finally {
      if (s) B.physique.liberer(s.co); B.meteo.actuel = null;
      journal.dureeExecutionMs = performance.now() - debut; rapports.push(journal);
    }
  });
}
function quitter(s, journal, secondes) {
  const { co, v, c } = s, e = v.etat, initial = roues(v), tableau = e.etatPneus, avancer = surveiller(s, journal);
  let annule = false, pret = false, recul = 0, precedentes = initial.etatPneus;
  for (let n = 0; n < secondes / DT; n++) {
    const ev = avancer();
    assert.ok(!ev.some(e => e.id === v.id && e.type === 'stand' && ['service', 'repare'].includes(e.phase)), 'service reçu dans la file bloquée');
    annule ||= ev.some(e => e.id === v.id && e.type === 'stand' && e.phase === 'annule');
    assert.equal(e.servicePneus, initial.servicePneus); assert.equal(e.pneus, initial.pneus); assert.equal(e.etatPneus, tableau);
    e.etatPneus.forEach((r, i) => {
      assert.equal(r.graine, precedentes[i].graine);
      for (const cle of ['usure', 'distance', 'sollicitation']) assert.ok(r[cle] + 1e-10 >= precedentes[i][cle], cle + ' remise à neuf hors service');
    });
    precedentes = structuredClone(e.etatPneus); if (e.v < -.05) recul += DT;
    if (B.circuit.ecart(c, c.stands.garage1, e.s) > 30 && e.v > 8 && !e.stands && !B.course.dansLaVoie(c, e, c.stands) && v.ia.stand.phase === 'repos') { pret = true; break; }
  }
  assert.ok(pret, 'reprise de course absente : ' + JSON.stringify(court(v))); assert.ok(annule, 'annulation de service absente');
  journal.reculSecondes = recul;
}
for (const distance of [8, 10]) verifier('PhysX : IA à ' + distance + ' m derrière un joueur garé, dégagement sans contact ni replacement', { file: distance }, (s, j) => quitter(s, j, 40));
verifier('PhysX : vraie approche puis dégagement devant un joueur garé', { bloqueur: true }, (s, j) => quitter(s, j, 140));

for (const [nom, meteo, saison, monte] of [
  ['pluie', { pluie: 1, mouille: 1, neigeSol: 0, fixe: true }, 'ete', 'pluie'],
  ['neige', { pluie: .8, mouille: 0, neigeSol: .8, precipitationsNeige: true, fixe: true }, 'hiver', 'neige']
]) verifier('PhysX : trajet sous ' + nom + ', nouvelle monte seulement après le service complet', { meteo, saison }, (s, journal) => {
  const { co, c, v } = s, e = v.etat, initial = roues(v), avancer = surveiller(s, journal), phases = new Set();
  let tableau = e.etatPneus, service = null, repare = 0, sortie = null, termine = false;
  assert.equal(B.conduite.pneusConseilles(B.chaussee.lire(c, c.stands.garage0)), monte);
  for (let n = 0; n < 180 / DT; n++) {
    const ev = avancer(), fin = ev.some(x => x.id === v.id && x.type === 'stand' && x.phase === 'repare');
    for (const x of ev) if (x.id === v.id && x.type === 'stand') { phases.add(x.phase); if (x.phase === 'sortie') sortie = e.distance; }
    if (fin) {
      assert.equal(++repare, 1); assert.ok(service, 'service jamais immobilisé');
      assert.ok(co.horloge - service.t >= service.duree - 2 * DT, 'service écourté');
      assert.notEqual(e.etatPneus, tableau); tableau = e.etatPneus;
      assert.ok(e.etatPneus.every(r => r.usure === 0 && r.salete === 0 && r.grainage === 0 && r.distance === 0 && r.sollicitation === 0));
      e.etatPneus.forEach((r, i) => assert.notEqual(r.graine, initial.etatPneus[i].graine));
    }
    assert.equal(e.pneus, repare ? monte : initial.pneus, 'monte remplacée avant service complet');
    assert.equal(v.livree.pneus, e.pneus); assert.equal(e.servicePneus, initial.servicePneus + repare); assert.equal(e.etatPneus, tableau);
    if (e.stands?.phase === 'service') {
      if (!service) service = { t: co.horloge, duree: e.stands.duree, s: e.s, d: e.d, roues: roues(v) };
      assert.ok(Math.hypot(B.circuit.ecart(c, service.s, e.s), e.d - service.d) <= B.course.STANDS.mouvementService, 'voiture déplacée pendant le service');
      assert.ok(Math.hypot(...e._physx.velocity) < B.course.STANDS.arret, 'le vrai corps ne reste pas arrêté');
      assert.deepEqual(roues(v), service.roues, 'pneus changés pendant le service');
    }
    if (sortie !== null && e.distance > sortie + 50 && e.v > 8 && B.circuit.ecart(c, c.stands.fin, e.s) > 30 && !e.stands && !B.course.dansLaVoie(c, e, c.stands)) { termine = true; break; }
  }
  assert.ok(termine, 'entrée, service et retour en course incomplets : ' + JSON.stringify(court(v)));
  assert.equal(repare, 1); for (const phase of ['entree', 'service', 'repare', 'sortie']) assert.ok(phases.has(phase), 'phase absente : ' + phase);
  assert.equal(e.standsSortie, false); journal.phases = [...phases];
});
after(() => {
  assert.equal(X.status().worlds, 0, 'monde PhysX non libéré');
  if (process.env.BITUME_RAPPORTS_PHYSX_STANDS) {
    const dossier = path.resolve(process.env.BITUME_RAPPORTS_PHYSX_STANDS); mkdirSync(dossier, { recursive: true });
    writeFileSync(path.join(dossier, 'physique-stands.json'), JSON.stringify({ date: new Date().toISOString(), pas: DT,
      versionPhysX: X.status().version, empreintes, resultats: rapports }, null, 2) + '\n');
  }
  console.log(JSON.stringify({ standsPhysX: rapports.map(({ nom, reussi, dureeSimulee, dureeExecutionMs }) => ({ nom, reussi, dureeSimulee, dureeExecutionMs })) }));
});
