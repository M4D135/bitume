// Garde-fou p14+ : vraie scène PhysX WASM, géométrie de production et commandes de course.
// Les archives p9–p13 restent dans le banc historique. Cette référence distincte ne prétend pas
// conserver leurs trajectoires : elle garde les trajectoires du nouvel intégrateur qualifié.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chargerPhysX } from './physx-runtime.mjs';

const root = new URL('../../', import.meta.url), source = readFileSync(new URL('src/jeu.js', root), 'utf8');
const PHYSIQUE = source.match(/\bPHYSIQUE\s*=\s*['"](p\d+)['"]/)?.[1];
assert(+PHYSIQUE?.slice(1) >= 14, 'ce banc exige la physique native p14 ou ultérieure');
assert(!process.env.BITUME_PHYSX_ADAPTER, 'le déterminisme doit qualifier le moteur verrouillé du jeu');
const fixture = new URL('verifications/fixtures/determinisme-' + PHYSIQUE + '.json', root);
const ecrire = process.argv.includes('--ecrire');
if (!ecrire) assert(existsSync(fixture), 'référence native absente : qualifier puis créer avec --ecrire');
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons',
  'vegetation', 'bords', 'carene', 'decor', 'meteo', 'strategie-stands', 'course', 'solides-physx', 'physique',
  'humain-donnees', 'humain-corps', 'main', 'voiture']) require(fileURLToPath(new URL('src/' + f + '.js', root)));
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;
const catalogue = vm.runInNewContext(source.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
const NEUTRE = Object.freeze({ gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false,
  boite: 'auto', aide: 0, guidage: 0, marcheArriere: false });
const FREIN = Object.freeze({ ...NEUTRE, frein: 1 });
const hash = data => createHash('sha256').update(data).digest('hex');

// Encodage canonique sans arrondi : Float64 LE pour chaque nombre, y compris -0.
// Les poignées natives, fonctions et caches privés ne sont pas sérialisés. Les poses/vitesses
// natives sont lues séparément ; les caches privés susceptibles de porter la physique aussi.
class Ecrivain {
  constructor() { this.buf = Buffer.allocUnsafe(65536); this.n = 0; this.vus = new Set(); }
  place(n) { if (this.n + n > this.buf.length) { const b = Buffer.allocUnsafe(Math.max(this.buf.length * 2, this.n + n)); this.buf.copy(b, 0, 0, this.n); this.buf = b; } }
  octet(n) { this.place(1); this.buf[this.n++] = n; }
  nombre(n) { this.place(9); this.buf[this.n++] = 100; this.buf.writeDoubleLE(n, this.n); this.n += 8; }
  texte(s) { const b = Buffer.from(String(s)); this.place(5 + b.length); this.buf[this.n++] = 115; this.buf.writeUInt32LE(b.length, this.n); this.n += 4; b.copy(this.buf, this.n); this.n += b.length; }
  valeur(v) {
    if (v === null) return this.octet(110);
    if (v === undefined) return this.octet(117);
    if (typeof v === 'number') return this.nombre(v);
    if (typeof v === 'boolean') return this.octet(v ? 84 : 70);
    if (typeof v === 'string') return this.texte(v);
    assert(!this.vus.has(v), 'cycle dans la projection d’état'); this.vus.add(v);
    if (Array.isArray(v) || ArrayBuffer.isView(v)) {
      this.octet(91); this.nombre(v.length); for (const x of v) this.valeur(x); this.octet(93);
    } else if (v instanceof Map) {
      this.octet(77); for (const [k, x] of [...v.entries()].sort(([a], [b]) => String(a).localeCompare(String(b), 'en'))) { this.valeur(k); this.valeur(x); } this.octet(109);
    } else {
      this.octet(123);
      for (const k of Object.keys(v).sort()) if (!k.startsWith('_') && v[k] !== undefined && typeof v[k] !== 'function') { this.texte(k); this.valeur(v[k]); }
      this.octet(125);
    }
    this.vus.delete(v);
  }
  finir() { return this.buf.subarray(0, this.n); }
}
function encoder(v) { const w = new Ecrivain(); w.valeur(v); return w.finir(); }
function publicCourse(co) {
  const f = co.fantome;
  return { horloge: co.horloge, temps: co.temps, dt: co.dt, phase: co.phase, mode: co.mode,
    toursTotal: co.toursTotal, difficulte: co.difficulte, feux: co.feux, delaiVert: co.delaiVert,
    classement: co.classement, termine: co.termine, drapeau: co.drapeau, finisseurs: co.finisseurs,
    finSansCourse: co.finSansCourse, chronoParti: co.chronoParti, fantome: f,
    enregN: co.enreg.n, enregProchain: co.enreg.prochain, enreg: co.enreg.donnees.subarray(0, co.enreg.n * 4),
    statsIa: co.statsIa, sAvant: co.sAvant, contactsT: co.contactsT, tempsReference: co.tempsReference,
    vref: co.vref, enLigne: co.enLigne, duo: co.duo, voitures: co.voitures };
}
function natif(co) {
  const p = co.physique, world = p.world;
  return { pas: p.pas, temps: p.temps, placements: p.placements, collisions: p.collisions,
    impacts: [...p.impacts].map(([cle, q]) => ({ cle, a: q.a, b: q.b, x: q.x, y: q.y, z: q.z, ny: q.ny })),
    contacts: world.contacts.points.slice(0, world.contacts.count),
    voitures: co.voitures.map(v => {
      const ph = v.etat._physx;
      assert(ph && ph.world === world, 'une voiture a quitté le vrai solveur');
      const body = world._bodies.get(ph.id); assert(body, 'acteur natif absent');
      assert.equal(body.type, v.distant ? 'kinematic' : 'dynamic');
      const pose = world.readPose(ph.id, []), vitesse = world.readVelocity(ph.id, []), rotation = world.readAngularVelocity(ph.id, []);
      assert([...pose, ...vitesse, ...rotation].every(Number.isFinite), 'état natif non fini');
      return { id: v.id, type: body.type, pose, vitesse, rotation, masse: ph.mass, inertie: ph.inertia,
        appuis: ph.groundCount, vol: ph.airborne, surface: ph.surface, forces: ph.forces, offsets: ph.offsets,
        suspensions: ph.contacts.map(w => ({ hit: w.hit, load: w.load, distance: w.distance,
          surface: w.surface, point: w.point, normal: w.normal, velocity: w.velocity, shapePose: w.shapePose })) };
    }) };
}
function scene(id, meteo = 'sec', options = {}) {
  const k = catalogue.find(k => k.id === id); assert(k, 'circuit absent du catalogue ' + id);
  const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
  B.bords.limites(c, B.bords.planifier(c));
  const decor = B.decor.construire(c, { qualite: 'high', matieres: true, vegetation: true, vegetationQualite: 'high', saison: 'ete' });
  c.obstacles = B.obstacles.creer(decor.obstacles);
  const surface = meteo === 'pluie' ? { pluie: 1, mouille: 1, neigeSol: 0 }
    : meteo === 'neige' ? { pluie: .8, mouille: 0, neigeSol: .8, precipitationsNeige: true }
    : { pluie: 0, mouille: 0, neigeSol: 0 };
  B.meteo.actuel = B.chaussee.preparer({ ...surface, fixe: true }, B.saisons.profil(meteo === 'neige' ? 'hiver' : 'ete', c.theme));
  const co = B.course.creer(c, { mode: 'course', rivaux: 11, tours: 8, difficulte: 1, graine: 7, placeJoueur: 8, ...options });
  for (const v of co.voitures) {
    const type = B.conduite.pneusConseilles(B.chaussee.lire(c, v.etat.s));
    Object.assign(v.etat, B.pneus.creerEtat(type, { seance: 7, voiture: v.id })); v.livree.pneus = type;
  }
  return { c, co, decor, suivi: {}, commande: () => co.duo
    ? co.voitures.filter(v => v.joueur).map(v => B.course.commandesIA(co, v))
    : B.course.commandesIA(co, co.joueur) };
}
function placer(s, v, abscisse, vitesse = 0, d = 0) {
  const q = B.circuit.echantillon(s.c, abscisse);
  Object.assign(v.etat, { s: abscisse, d, v: vitesse, psi: 0, beta: 0, omega: vitesse * q.courbure,
    y: q.y, rapport: vitesse ? 3 : 1, regime: vitesse ? 11000 : 5000 });
  v.progression = abscisse; v.passages = v.maxPassages = 0; v.tourValide = false;
}
function lancer(s) {
  try {
    assert(X.isReady(), 'runtime PhysX WASM non initialisé');
    assert.equal(X.status().worlds, 0, 'la répétition doit créer sa propre scène native');
    const p = B.physique.installer(s.co, s.decor);
    assert.equal(p.backend, 'PhysX'); assert.equal(p.version, X.status().version);
    assert(p.world._scene.ptr > 0 && p.world._physics.ptr > 0, 'scène native WASM absente');
    assert(p.solids.statistiques.trianglesSol > 0, 'aucun triangle réel de décor dans la scène');
    return p;
  } catch (e) { B.physique.liberer(s.co); throw e; }
}
function partir(s) { s.co.phase = 'course'; s.co.feux.vert = true; s.co.temps = s.co.horloge = 30; }
function rendu(s, modeles, k) {
  for (const v of s.co.voitures) {
    const e = v.etat, ph = e._physx, mod = modeles[v.id], objets = [];
    const ev = { p: [ph.x, ph.y, ph.z], cap: ph.cap, tangage: e.tangage, roulis: e.roulis,
      roule: e.distance, v: e.v, rebond: 0, braquage: e.braquage || 0, etatPneus: e.etatPneus,
      pilote: { volant: e.volant || 0, rapport: e.rapport, rapportAvant: e.rapportAvant || e.rapport,
        passage: Math.min(1, (e.passage || 0) / .25) } };
    for (const detail of ['complet', 'moyen', 'simple']) B.voiture.poser(mod, ev, objets, { detail });
    B.voiture.poserRetro(mod, ev, objets);
    B.voiture.cockpit(mod, ev, objets, { regime: e.regime, kmh: e.v * 3.6, ...ev.pilote });
    assert(objets.length > 100 && objets.every(o => [...o.p, ...o.s, ...o.r].every(Number.isFinite)), 'rendu logiciel vide/non fini');
    s.rendus++;
  }
}

const cas = [
  { nom: 'peloton-val-brule', secondes: 24, creer: () => scene('val-brule'),
    verifier: s => { assert(s.co.voitures.every(v => v.etat.distance > 80)); assert(s.suivi.appuis > 1000); } },
  { nom: 'duo-pluie-haut-col', secondes: 18,
    creer() { const s = scene('haut-col', 'pluie', { graine: 977, humains: { noms: ['Joueur 1', 'Joueur 2'], locaux: [0, 1], hote: true, enLigne: false } });
      s.co.voitures[0].etat.pneus = 'slicks'; s.co.voitures[1].etat.pneus = 'inter'; return s; },
    verifier: s => { assert(s.co.duo); assert(s.co.voitures.every(v => v.etat.distance > 30)); } },
  { nom: 'neige-usure-cap-sequoia', secondes: 18,
    creer() { const s = scene('cap-sequoia', 'neige', { graine: 1205 });
      for (const v of s.co.voitures) { v.etat.pneus = ['slicks', 'inter', 'pluie', 'neige'][v.id % 4]; v.etat.etatPneus.forEach((p, i) => p.usure = .08 + .16 * ((v.id + i) % 4)); } return s; },
    verifier: s => { assert.equal(new Set(s.co.voitures.map(v => v.etat.pneus)).size, 4); assert(s.co.voitures.every(v => v.etat.distance > 10)); } },
  { nom: 'saut-baikal', secondes: 3,
    creer() { const s = scene('baikal', 'sec', { mode: 'chrono', rivaux: 0 }); partir(s); placer(s, s.co.joueur, 2520, 60); s.commande = () => NEUTRE;
      s.installe = () => B.conduite.lancerSaut(s.co.joueur.etat, { grand: true }); return s; },
    verifier: s => { assert(s.suivi.vol > 0, 'saut non exercé'); assert.equal(s.co.joueur.etat._physx.groundCount, 4); assert(s.co.joueur.etat.s > 2660); } },
  { nom: 'contact-mur-tunnel', secondes: 1,
    creer() { const s = scene('haut-col', 'sec', { mode: 'chrono', rivaux: 0 }); partir(s);
      placer(s, s.co.joueur, (s.c.tunnel.debut + s.c.tunnel.fin) / 2); s.commande = () => NEUTRE;
      s.installe = () => { const e = s.co.joueur.etat, q = B.circuit.echantillon(s.c, e.s); e.immunite = 10;
        s.co.physique.world.setVelocity(e._physx.id, [-Math.sin(q.cap) * 60, 0, Math.cos(q.cap) * 60]); }; return s; },
    verifier: s => assert(s.suivi.contactsMur > 0, 'aucun contact natif avec le mur du tunnel') },
  { nom: 'stands-service-pluie', secondes: 50,
    creer() { const s = scene('val-brule', 'pluie', { rivaux: 1, graine: 1244, placeJoueur: 1 }); partir(s);
      const v = s.co.voitures[1]; placer(s, v, (s.c.stands.debut - 350 + s.c.longueur) % s.c.longueur, 25);
      placer(s, s.co.joueur, (s.c.stands.fin + 1000) % s.c.longueur);
      for (const v of s.co.voitures) v.etat.pneus = v.etat.pneusProchainArret = v.livree.pneus = 'slicks';
      v.etat.etatPneus.forEach((r, i) => Object.assign(r, { usure: .9, salete: .2, grainage: .1, distance: 20000 + i * 100, sollicitation: 40000 + i * 100 }));
      s.commande = () => FREIN; return s; },
    verifier(s) { const e = s.co.voitures[1].etat; assert.equal(e.servicePneus, 1); assert.equal(e.pneus, 'pluie');
      for (const p of ['entree', 'service', 'repare', 'sortie']) assert(s.suivi.stands.includes(p), 'phase de stands absente ' + p);
      assert(!e.stands && e.v > 10); } },
  { nom: 'stands-file-bloquee', secondes: 24,
    creer() { const s = scene('val-brule', 'sec', { rivaux: 1, graine: 1244, placeJoueur: 1 }); partir(s);
      const v = s.co.voitures[1], e = v.etat, S = s.c.stands;
      placer(s, v, S.garage0 + 10, 0, S.d); placer(s, s.co.joueur, e.s + 8, 0, S.d);
      e.etatPneus.forEach((r, i) => Object.assign(r, { usure: .9, salete: .2, grainage: .1, distance: 20000 + i * 100, sollicitation: 40000 + i * 100 }));
      Object.assign(v.ia.stand, { phase: 'voie', debut: 20, vuStand: true, motif: 'usure', pneus: 'slicks', revision: e.servicePneus });
      e.stands = { phase: 'voie', t: 0, repare: false }; s.commande = () => FREIN; return s; },
    verifier(s) { const e = s.co.voitures[1].etat; assert(s.suivi.stands.includes('annule')); assert(s.suivi.recul > 0);
      assert.equal(e.servicePneus, 0); assert(e.etatPneus.every(p => p.usure >= .9)); assert(!e.stands && e.v > 8);
      assert.equal(s.suivi.contactsVoiture, 0); assert.equal(s.suivi.replacements, 0); } },
  { nom: 'reprise-reseau-en-vol', secondes: 3,
    creer() { const s = scene('baikal', 'sec', { mode: 'chrono', rivaux: 0 }); partir(s); placer(s, s.co.joueur, 2520, 25);
      s.co.joueur.distant = true; s.commande = () => NEUTRE;
      s.installe = () => { const ph = s.co.joueur.etat._physx, pose = ph.world.readPose(ph.id, []); pose[1] += 2; ph.world.setPose(ph.id, pose);
        B.physique.avant(s.co, DT, false); s.co.joueur.etat.y = pose[1]; };
      s.avant = k => { const v = s.co.joueur, e = v.etat;
        if (k < 12) { e.s += .2; e.d += .01; e.y += .01; e.tangage += .001; }
        if (k === 12) { const ph = e._physx; s.suivi.vitesseTransfert = ph.world.readVelocity(ph.id, []); v.distant = false; s.suivi.transfert = true; } };
      return s; },
    verifier: s => { assert(s.suivi.transfert); assert(Math.hypot(...s.suivi.vitesseTransfert) > 10); assert.equal(s.co.joueur.etat._physx.distant, false); } }
];

function rejouer(cas, { dessiner = false, perturbation = null, secondes = cas.secondes } = {}) {
  const s = cas.creer(), co = s.co, p = lancer(s), t = performance.now(); s.rendus = 0;
  s.suivi = { ...s.suivi, appuis: 0, vol: 0, recul: 0, contactsMur: 0, contactsVoiture: 0, replacements: 0, stands: [] };
  s.installe?.();
  const modeles = dessiner ? co.voitures.map(v => B.voiture.modele(v.livree)) : [];
  const empreintes = [], evenements = {}, ev = [], ecritures = { pose: 0, vitesse: 0, rotation: 0 };
  const pasSolveur = { simulate: 0, fetchResults: 0 };
  for (const nom of Object.keys(pasSolveur)) {
    const f = p.world._scene[nom];
    p.world._scene[nom] = function (...a) { pasSolveur[nom]++; return f.apply(this, a); };
  }
  for (const [nom, cle] of [['setPose', 'pose'], ['setVelocity', 'vitesse'], ['setAngularVelocity', 'rotation']]) {
    const f = p.world[nom]; p.world[nom] = function (...a) { ecritures[cle]++; return f.apply(this, a); };
  }
  let bloc = createHash('sha256');
  try {
    for (let k = 0, total = Math.round(secondes / DT); k < total; k++) {
      s.avant?.(k); let cmd = s.commande(k);
      if (perturbation === 'commande' && k === 1199) cmd = { ...cmd, frein: 1, gaz: 0, volant: -.8 };
      B.course.pas(co, cmd, DT, ev);
      if (perturbation === 'ulp-natif' && k === 1199) {
        const ph = co.voitures[3].etat._physx, vitesse = p.world.readVelocity(ph.id, []), avantPublic = hash(encoder(publicCourse(co)));
        const f = new Float32Array([vitesse[0]]), u = new Uint32Array(f.buffer); u[0]++; vitesse[0] = f[0];
        const avantNatif = hash(encoder(natif(co))); p.world.setVelocity(ph.id, vitesse);
        assert.equal(hash(encoder(publicCourse(co))), avantPublic, 'le témoin doit modifier uniquement le solveur');
        assert.notEqual(hash(encoder(natif(co))), avantNatif, 'la projection ignore un ulp de vitesse native');
      }
      assert.equal(p.pas, k + 1, 'la course ne fait plus avancer le solveur à chaque pas fixe');
      assert.equal(pasSolveur.simulate, k + 1, 'le pas de course n’appelle plus le vrai solveur natif');
      assert.equal(pasSolveur.fetchResults, k + 1, 'les résultats natifs ne sont plus récupérés à chaque pas');
      for (const e of ev) { evenements[e.type] = (evenements[e.type] || 0) + 1; if (e.type === 'stand' && e.id === 1) s.suivi.stands.push(e.phase); }
      for (const v of co.voitures) { const ph = v.etat._physx; s.suivi.appuis += ph.groundCount;
        s.suivi.vol += ph.groundCount === 0 ? 1 : 0; s.suivi.recul += v.etat.v < -.05 ? 1 : 0; }
      s.suivi.replacements = p.placements;
      for (let i = 0; i < p.world.contacts.count; i++) {
        const q = p.world.contacts.points[i];
        if (p.solids.acteurs.get(q.a)?.genre === 'mur-tunnel' || p.solids.acteurs.get(q.b)?.genre === 'mur-tunnel') s.suivi.contactsMur++;
        if (p.byId.has(q.a) && p.byId.has(q.b)) s.suivi.contactsVoiture++;
      }
      // Même avec une simulation à 120 Hz, les vues sont demandées irrégulièrement, avec répétitions.
      if (dessiner && k % 4 === 0) { rendu(s, modeles, k); if (k % 120 === 0) rendu(s, modeles, k); }
      bloc.update(encoder({ k, natif: natif(co), evenements: ev, commande: cmd }));
      if ((k + 1) % 120 === 0 || k === total - 1) {
        bloc.update(encoder(publicCourse(co))); empreintes.push(bloc.digest('hex')); bloc = createHash('sha256');
      }
    }
    if (!perturbation && secondes === cas.secondes) cas.verifier(s);
    if (cas.nom !== 'reprise-reseau-en-vol' && !perturbation) assert.deepEqual(ecritures, { pose: 0, vitesse: 0, rotation: 0 }, 'pilotage de pose/vitesse après le départ');
    return { empreintes, resume: { pas: p.pas, pasSolveur, voitures: co.voitures.length, suivi: s.suivi, evenements, ecritures,
      fin: co.voitures.map(v => ({ id: v.id, s: v.etat.s, d: v.etat.d, v: v.etat.v, y: v.etat.y, servicePneus: v.etat.servicePneus })) }, rendus: s.rendus, duree: performance.now() - t };
  } finally { B.physique.liberer(co); assert.equal(X.status().worlds, 0, 'scène native non libérée'); B.meteo.actuel = null; }
}

const debut = performance.now(), resultats = {}, reference = ecrire ? null : JSON.parse(readFileSync(fixture, 'utf8'));
try {
  if (reference) { assert.equal(reference.format, 'bitume-determinisme-physx-2'); assert.equal(reference.physique, PHYSIQUE);
    assert.equal(reference.runtime, X.status().version); assert.deepEqual(Object.keys(reference.cas).sort(), cas.map(c => c.nom).sort()); }
  for (const c of cas) {
    const a = rejouer(c), b = rejouer(c);
    assert.deepEqual(a.empreintes, b.empreintes, c.nom + ' : deux scènes PhysX neuves divergent');
    assert.deepEqual(a.resume, b.resume, c.nom + ' : le résumé de couverture diverge');
    if (reference) assert.deepEqual(a.empreintes, reference.cas[c.nom].empreintes, c.nom + ' : divergence de la référence native');
    resultats[c.nom] = { empreintes: a.empreintes, resume: a.resume };
    console.log(`ok  ${c.nom} : ${a.empreintes.length} empreintes, 2 scènes natives identiques (${((a.duree + b.duree) / 1000).toFixed(2)} s)`);
  }
  const temoin = cas[0], attendu = resultats[temoin.nom].empreintes;
  for (const perturbation of ['ulp-natif', 'commande']) {
    const r = rejouer(temoin, { perturbation, secondes: 12 });
    assert.deepEqual(r.empreintes.slice(0, 9), attendu.slice(0, 9), 'divergence avant perturbation ' + perturbation);
    assert.notEqual(r.empreintes[9], attendu[9], 'perturbation ignorée à la seconde 10 : ' + perturbation);
    console.log('ok  sensibilité ' + perturbation + ' : la première divergence est à la seconde 10');
  }
  const visuel = rejouer(temoin, { dessiner: true, secondes: 12 });
  assert.deepEqual(visuel.empreintes, attendu.slice(0, 12), 'les appels de rendu ont changé la simulation native');
  assert(visuel.rendus > 4000); console.log(`ok  rendu logiciel : ${visuel.rendus} poses multi-vues sans modifier les empreintes PhysX`);
  // L’usure et la glisse restent des nombres non arrondis, indépendamment du nouveau moteur.
  const e = Object.assign(B.conduite.creer(), B.pneus.creerEtat('slicks', { seance: 7, voiture: 0 }));
  const avant = hash(encoder(e)), f = new Float64Array([e.etatPneus[0].usure]);
  const u = new BigUint64Array(f.buffer); u[0]++; e.etatPneus[0].usure = f[0];
  assert.notEqual(hash(encoder(e)), avant, 'usure par roue omise de l’empreinte');
  const apres = hash(encoder(e)); e.glisseAv += Number.EPSILON;
  assert.notEqual(hash(encoder(e)), apres, 'glisse physique omise de l’empreinte');
  if (ecrire) {
    const fichiers = ['src/circuit.js', 'src/conduite.js', 'src/pneus.js', 'src/usure-pneus.js', 'src/chaussee.js',
      'src/degats.js', 'src/contacts.js', 'src/obstacles.js', 'src/course.js', 'src/strategie-stands.js', 'src/bords.js',
      'src/decor.js', 'src/solides-physx.js', 'src/physique.js', 'src/ferro/physx.js', 'src/ferro/physx-runtime.js',
      'verifications/determinisme-simulation.test.mjs', 'verifications/helpers/determinisme-physx.mjs', 'verifications/helpers/physx-runtime.mjs'];
    writeFileSync(fixture, JSON.stringify({ format: 'bitume-determinisme-physx-2', physique: PHYSIQUE,
      runtime: X.status().version, node: process.version, v8: process.versions.v8, dt: DT,
      origine: 'Qualification 0.2.55 : intégrateur PhysX natif p14 ; références historiques p9 à p13 conservées.',
      portee: 'À chaque pas : poses/vitesses/rotations natives, suspensions, forces, contacts, événements et commandes. État public complet chaque seconde, Float64 LE sans arrondi. Ne couvre pas les caches internes du solveur ni le rendu GPU.',
      sources: Object.fromEntries(fichiers.map(f => [f, hash(readFileSync(new URL(f, root)))])),
      controles: { repetitionsParCas: 2, sensibiliteUlpNative: true, sensibiliteCommande: true,
        rendusLogiciels: visuel.rendus, renduGpuValide: false, mondesRestants: X.status().worlds }, cas: resultats }, null, 1) + '\n');
    console.log('fixture native écrite après contrôles : ' + fileURLToPath(fixture));
  }
  const n = Object.values(resultats).reduce((sum, r) => sum + r.empreintes.length, 0);
  console.log(`ok  déterminisme ${PHYSIQUE} PhysX : ${cas.length} cas, ${n} empreintes, ${((performance.now() - debut) / 1000).toFixed(1)} s`);
} finally { X.dispose(); }
