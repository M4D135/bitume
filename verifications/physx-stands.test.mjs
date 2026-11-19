// Voie, service et file bloquée avec les vrais corps PhysX et les vrais solides du circuit.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerPhysX } from './helpers/physx-runtime.mjs';

const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons',
  'vegetation', 'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course', 'solides-physx', 'physique']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;
const NEUTRE = Object.freeze({ gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 });
const FREIN = Object.freeze({ ...NEUTRE, frein: 1 }), GAZ = Object.freeze({ ...NEUTRE, gaz: 1 });
const src = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const CATALOGUE = new Function(src.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0] + '; return CATALOGUE;')();
const resultats = [], circuits = new Map();
const fichiers = ['src/course.js', 'src/strategie-stands.js', 'src/physique.js', 'src/conduite.js', 'src/solides-physx.js',
  'src/circuit.js', 'src/decor.js', 'src/bords.js', 'src/ferro/physx-runtime.js',
  'verifications/physx-stands.test.mjs', 'verifications/helpers/physx-runtime.mjs'];
const empreintes = Object.fromEntries(fichiers.map(f => [f, createHash('sha256').update(readFileSync(new URL('../' + f, import.meta.url))).digest('hex')]));
const adaptateur = process.env.BITUME_PHYSX_ADAPTER || fileURLToPath(new URL('../src/ferro/physx.js', import.meta.url));
empreintes.adaptateurPhysX = createHash('sha256').update(readFileSync(adaptateur)).digest('hex');
function verifier(nom, fn) {
  test(nom, () => {
    const r = { nom, reussi: false }, debut = performance.now();
    try { r.mesures = fn(); r.reussi = true; }
    catch (e) { r.erreur = e.message; throw e; }
    finally { r.dureeExecutionMs = performance.now() - debut; resultats.push(r); }
  });
}
after(() => {
  assert.equal(X.status().worlds, 0, 'toutes les scènes de test ont été libérées');
  if (process.env.BITUME_RAPPORTS_PHYSX_STANDS) {
    const dossier = resolve(process.env.BITUME_RAPPORTS_PHYSX_STANDS); mkdirSync(dossier, { recursive: true });
    writeFileSync(resolve(dossier, 'stands-physx.json'), JSON.stringify({ date: new Date().toISOString(), node: process.version,
      runtime: X.status(), adaptateur, dt: DT,
      tests: resultats.length, reussis: resultats.filter(r => r.reussi).length, empreintes, resultats }, null, 2) + '\n');
  }
  X.dispose();
});
function avancer(co, secondes, cmd = FREIN, observer) {
  const ev = [];
  for (let i = 0; i < secondes / DT; i++) {
    B.course.pas(co, typeof cmd === 'function' ? cmd(i * DT) : cmd, DT, ev);
    if (observer?.(ev, i) === false) break;
  }
}
function poser(co, v, s, vitesse = 0, d = co.c.stands.d) {
  const q = B.circuit.echantillon(co.c, s);
  Object.assign(v.etat, { s, d, v: vitesse, psi: 0, beta: 0, omega: vitesse * q.courbure, y: q.y,
    rapport: vitesse ? 3 : 1, regime: vitesse ? 11000 : 5000 });
  v.progression = s; v.passages = v.maxPassages = 0; v.tourValide = false;
}
function surveillerEcritures(co) {
  const p = co.physique, calls = { pose: 0, vitesse: 0, rotation: 0 };
  for (const [nom, cle] of [['setPose', 'pose'], ['setVelocity', 'vitesse'], ['setAngularVelocity', 'rotation']]) {
    const original = p.world[nom]; p.world[nom] = function (...args) { calls[cle]++; return original.apply(this, args); };
  }
  return calls;
}
function fixture() {
  const n = 1000, pas = 2, c = { n, pas, longueur: n * pas, largeur: 14, graine: 7, theme: 'foret', depart: 0,
    stands: { debut: 50, fin: 550, garage0: 450, garage1: 500, d: 0, demi: 3, vitesse: 10 } };
  for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD']) c[k] = new Float64Array(n);
  c.vibreur = new Uint8Array(n);
  for (let i = 0; i < n; i++) { c.x[i] = i * pas; c.vitesse[i] = 75; c.limiteG[i] = c.limiteD[i] = 100; }
  const sommets = [], indices = [], nx = 71, nz = 9;
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    sommets.push(-50 + ix * 10, 0, -40 + iz * 10, 0, 1, 0, 0, 0, 0, 14, .16, .16, .17);
    if (ix && iz) { const d = iz * nx + ix, a = d - nx - 1, b = d - nx, c0 = d - 1; indices.push(a, c0, b, b, c0, d); }
  }
  const decor = { nappes: [{ sommets: new Float32Array(sommets), indices: new Uint32Array(indices), surfaceType: 'accotement' }], lots: [], obstacles: [] };
  c.obstacles = B.obstacles.creer([]);
  const co = B.course.creer(c, { mode: 'chrono', rivaux: 0, graine: 7 }); co.phase = 'course'; co.temps = co.horloge = 30;
  poser(co, co.joueur, 100); B.physique.installer(co, decor);
  return { c, co, e: co.joueur.etat, ph: co.joueur.etat._physx, p: co.physique };
}
function reelle(id = 'val-brule', meteo = 'sec', distance = 8, approche = false) {
  if (!circuits.has(id)) {
    const k = CATALOGUE.find(x => x.id === id), c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
    B.bords.limites(c, B.bords.planifier(c));
    const decor = B.decor.construire(c, { qualite: 'high', matieres: true, vegetation: true, vegetationQualite: 'high', saison: 'ete' });
    c.obstacles = B.obstacles.creer(decor.obstacles); circuits.set(id, { c, decor });
  }
  const { c, decor } = circuits.get(id), surface = meteo === 'pluie' ? { pluie: 1, mouille: 1, neigeSol: 0 }
    : meteo === 'neige' ? { pluie: .8, mouille: 0, neigeSol: .8, precipitationsNeige: true } : { pluie: 0, mouille: 0, neigeSol: 0 };
  B.meteo.actuel = B.chaussee.preparer({ ...surface, fixe: true }, B.saisons.profil(meteo === 'neige' ? 'hiver' : 'ete', c.theme));
  const co = B.course.creer(c, { mode: 'course', rivaux: 1, graine: 1244, tours: 99, difficulte: 1 });
  co.phase = 'course'; co.feux.vert = true; co.temps = co.horloge = 30;
  const v = co.voitures[1], e = v.etat;
  for (const car of co.voitures) car.etat.pneus = car.etat.pneusProchainArret = car.livree.pneus = 'slicks';
  e.etatPneus.forEach((r, n) => Object.assign(r, { usure: .9, salete: .2, grainage: .1, distance: 20000 + n * 100, sollicitation: 40000 + n * 100 }));
  if (approche) {
    poser(co, v, (c.stands.debut - 350 + c.longueur) % c.longueur, 25, 0);
    poser(co, co.joueur, (c.stands.fin + 1000) % c.longueur, 0, 0);
  } else {
    poser(co, v, c.stands.garage0 + 10); poser(co, co.joueur, e.s + distance);
    Object.assign(v.ia.stand, { phase: 'voie', debut: co.temps - 10, vuStand: true, motif: 'usure', pneus: meteo === 'sec' ? 'slicks' : meteo, revision: e.servicePneus });
    e.pneusProchainArret = v.ia.stand.pneus; e.stands = { phase: 'voie', t: 0, repare: false };
  }
  B.physique.installer(co, decor);
  return { c, co, v, e, ph: e._physx, p: co.physique };
}

verifier('PhysX : le limiteur ralentit réellement la voiture, même accélérateur tenu', () => {
  const s = fixture();
  try {
    avancer(s.co, 1); s.e.stands = { phase: 'voie', t: 0, repare: false };
    s.p.world.setVelocity(s.ph.id, [30, 0, 0]); const calls = surveillerEcritures(s.co);
    let vitesseMin = Infinity, vitesseMaxStabilisee = 0;
    avancer(s.co, 8, GAZ, (ev, i) => {
      assert.equal(s.e.stands?.phase, 'voie');
      assert(Math.abs(s.e.v - Math.hypot(...s.ph.velocity)) < .02, 'la vitesse affichée ne doit pas cacher la vitesse native');
      vitesseMin = Math.min(vitesseMin, s.ph.u);
      if (i > 4 / DT) vitesseMaxStabilisee = Math.max(vitesseMaxStabilisee, s.ph.u);
    });
    assert(vitesseMin < 10.2 && vitesseMaxStabilisee < 10.2, 'le limiteur ne freine pas à 10 m/s : ' + vitesseMaxStabilisee);
    assert(s.ph.x > 190, 'le limiteur ne doit pas immobiliser la voiture');
    assert.deepEqual(calls, { pose: 0, vitesse: 0, rotation: 0 }); assert.equal(s.e.repositionnements, 0);
    return { limite: s.c.stands.vitesse, vitesseMin, vitesseMaxStabilisee, fin: s.ph.u, ecritures: calls };
  } finally { B.physique.liberer(s.co); }
});

verifier('PhysX : service immobile complet, quatre pneus changés ensemble seulement à son terme', () => {
  const s = fixture();
  try {
    s.c.stands.garage0 = 90; s.c.stands.garage1 = 120;
    s.e.pneusProchainArret = 'pluie'; s.e.etatPneus.forEach(r => { r.usure = .9; });
    const roues = s.e.etatPneus, calls = surveillerEcritures(s.co);
    let service = null, fin = null, distanceMax = 0;
    avancer(s.co, 15, FREIN, ev => {
      const start = ev.find(e => e.type === 'stand' && e.phase === 'service');
      if (start) service = { t: s.co.horloge, duree: start.duree, x: s.ph.x, z: s.ph.z };
      if (service) distanceMax = Math.max(distanceMax, Math.hypot(s.ph.x - service.x, s.ph.z - service.z));
      assert(!ev.some(e => e.type === 'stand' && e.phase === 'annule'), 'service annulé malgré un vrai frein immobile');
      if (ev.some(e => e.type === 'stand' && e.phase === 'repare')) { fin = s.co.horloge; return false; }
      assert.equal(s.e.etatPneus, roues, 'changement de pneus anticipé'); assert.equal(s.e.servicePneus, 0);
    });
    assert(service && fin, 'service incomplet'); assert(fin - service.t >= service.duree - DT * 2);
    assert(distanceMax <= B.course.STANDS.mouvementService); assert.equal(s.e.pneus, 'pluie'); assert.equal(s.e.servicePneus, 1);
    assert.notEqual(s.e.etatPneus, roues); assert(s.e.etatPneus.every(r => r.usure === 0));
    assert.deepEqual(calls, { pose: 0, vitesse: 0, rotation: 0 }); assert.equal(s.e.repositionnements, 0);
    return { dureeDemandee: service.duree, dureeObservee: fin - service.t, distanceMax, servicePneus: s.e.servicePneus, ecritures: calls };
  } finally { B.physique.liberer(s.co); }
});

verifier('PhysX : une impulsion pendant le service l’annule et garde les pneus usés', () => {
  const s = fixture();
  try {
    s.c.stands.garage0 = 90; s.c.stands.garage1 = 120; s.e.pneusProchainArret = 'pluie';
    s.e.etatPneus.forEach(r => { r.usure = .9; }); const roues = s.e.etatPneus;
    avancer(s.co, 2, FREIN, () => s.e.stands?.phase === 'service' ? false : undefined);
    assert.equal(s.e.stands?.phase, 'service'); const calls = surveillerEcritures(s.co);
    s.p.world.impulse(s.ph.id, [1800, 0, 0]); let annule = false;
    avancer(s.co, 1, FREIN, ev => { if (ev.some(e => e.type === 'stand' && e.phase === 'annule')) { annule = true; return false; } });
    assert(annule, 'le déplacement du vrai corps doit interrompre le service');
    assert.equal(s.e.etatPneus, roues); assert.equal(s.e.pneus, 'slicks'); assert.equal(s.e.servicePneus, 0);
    assert(s.e.etatPneus.every(r => r.usure >= .9)); assert.deepEqual(calls, { pose: 0, vitesse: 0, rotation: 0 });
    return { annule, servicePneus: s.e.servicePneus, vitesseApresImpulsion: s.ph.u, ecritures: calls };
  } finally { B.physique.liberer(s.co); }
});

for (const meteo of ['sec', 'pluie', 'neige']) verifier(`PhysX : trajet IA complet vers le vrai garage puis sortie sous ${meteo}`, () => {
  const s = reelle('val-brule', meteo, 8, true), { co, v, e, c, ph } = s;
  try {
    const calls = surveillerEcritures(co), roues = e.etatPneus, debut = co.horloge;
    let service = null, fin = null, pret = false, maxMouvementService = 0;
    avancer(co, 120, FREIN, ev => {
      assert.equal(e.repositionnements, 0, 'replacement pendant le trajet de stands');
      assert(!e.recuperation && !e.accident, 'accident pendant le trajet de stands');
      assert(!ev.some(x => x.type === 'choc' && x.id === v.id), 'collision avec le mobilier pendant le trajet de stands');
      for (const x of ev) if (x.type === 'stand' && x.id === v.id) {
        if (x.phase === 'service') service = { t: co.horloge, duree: x.duree, x: ph.x, z: ph.z };
        if (x.phase === 'repare') { fin = co.horloge; assert(service, 'réparation sans service'); }
        assert.notEqual(x.phase, 'annule', 'le vrai trajet jusqu’au garage doit aller au terme du service');
      }
      if (service && !fin) maxMouvementService = Math.max(maxMouvementService, Math.hypot(ph.x - service.x, ph.z - service.z));
      if (!fin) { assert.equal(e.etatPneus, roues); assert.equal(e.pneus, 'slicks'); assert.equal(e.servicePneus, 0); }
      else {
        assert.equal(e.servicePneus, 1, 'pas de deuxième service sur la sortie');
        if (!e.stands && v.ia.stand.phase === 'repos' && B.circuit.ecart(c, c.stands.fin, e.s) > 30 && e.v > 10) { pret = true; return false; }
      }
    });
    assert(service && fin && pret, 'trajet incomplet : ' + JSON.stringify({ service, fin, s: e.s, d: e.d, v: e.v, phase: v.ia.stand.phase }));
    assert(fin - service.t >= service.duree - 2 * DT); assert(maxMouvementService < B.course.STANDS.mouvementService);
    assert.equal(e.pneus, meteo === 'sec' ? 'slicks' : meteo); assert.notEqual(e.etatPneus, roues);
    assert.deepEqual(calls, { pose: 0, vitesse: 0, rotation: 0 });
    return { meteo, dureeTrajet: co.horloge - debut, dureeService: fin - service.t, dureeDemandee: service.duree,
      maxMouvementService, monteApres: e.pneus, vitesseFinale: e.v, ecritures: calls };
  } finally { B.physique.liberer(co); B.meteo.actuel = null; }
});

for (const [id, meteo, distance] of [['val-brule', 'sec', 8], ['val-brule', 'sec', 10],
  ['val-brule', 'pluie', 8], ['val-brule', 'neige', 8], ['haut-col', 'sec', 8]]) {
  verifier(`PhysX : file à ${distance} m, ${id}, ${meteo}, retour en course sans contact ni replacement`, () => {
    const s = reelle(id, meteo, distance), { co, e, v, c, ph } = s;
    try {
      const calls = surveillerEcritures(co), roues = e.etatPneus, usure = roues.map(r => r.usure), debut = co.horloge;
      const humain = co.joueur.etat._physx, hx = humain.x, hz = humain.z;
      let pret = false, annule = false, recul = 0, minEcart = Infinity, maxMouvementHumain = 0;
      avancer(co, 50, FREIN, ev => {
        assert(!ev.some(x => x.type === 'contact' && (x.a === v.id || x.b === v.id)), 'contact avec le joueur pendant le dégagement');
        assert(!ev.some(x => x.type === 'choc' && x.id === v.id), 'choc contre le mobilier pendant le dégagement');
        // Les petits contacts peuvent rester sous le seuil des sons/dégâts. Le solveur lui-même doit rester
        // sans contact avec une voiture ou le mobilier, quelle que soit la force remontée au jeu.
        const natifs = s.p.world.contacts;
        for (let j = 0; j < natifs.count; j++) {
          const point = natifs.points[j]; if (point.a !== ph.id && point.b !== ph.id) continue;
          const autre = point.a === ph.id ? point.b : point.a;
          assert.equal(s.p.solids.acteurs.get(autre)?.groupe, B.physique.GROUPES.SOL,
            'contact PhysX natif avec une voiture ou un obstacle pendant le dégagement');
        }
        assert(!ev.some(x => x.type === 'stand' && x.id === v.id && ['service', 'repare'].includes(x.phase)), 'service illégitime dans la file');
        annule ||= ev.some(x => x.type === 'stand' && x.id === v.id && x.phase === 'annule');
        assert.equal(e.repositionnements, 0); assert(!e.recuperation && !e.accident, 'secours utilisé pour se dégager');
        assert.equal(e.etatPneus, roues); assert.equal(e.servicePneus, 0); assert.equal(e.pneus, 'slicks');
        assert(e.etatPneus.every((r, i) => r.usure >= usure[i]));
        const ecart = Math.hypot(ph.x - humain.x, ph.z - humain.z); minEcart = Math.min(minEcart, ecart);
        maxMouvementHumain = Math.max(maxMouvementHumain, Math.hypot(humain.x - hx, humain.z - hz));
        if (e.v < -.05) recul += DT;
        if (B.circuit.ecart(c, c.stands.garage1, e.s) > 30 && e.v > 8 && !e.stands && !B.course.dansLaVoie(c, e, c.stands) && v.ia.stand.phase === 'repos') {
          pret = true; return false;
        }
      });
      assert(pret, 'reprise réelle absente : ' + JSON.stringify({ s: e.s, d: e.d, v: e.v, phase: v.ia.stand.phase, recul }));
      assert(annule); assert(maxMouvementHumain < .08, 'le joueur garé a été déplacé');
      assert.deepEqual(calls, { pose: 0, vitesse: 0, rotation: 0 });
      return { circuit: id, meteo, distanceInitiale: distance, duree: co.horloge - debut, recul, minEcart,
        maxMouvementHumain, vitesseFinale: e.v, servicePneus: e.servicePneus, ecritures: calls };
    } finally { B.physique.liberer(co); B.meteo.actuel = null; }
  });
}
