// Banc causal de l'aspiration : vraie course, deux châssis dynamiques et vrai WASM.
// La piste d'essai est une ligne droite plane en triangles ; ni circuit du catalogue,
// ni soufflerie réelle. Aucune pose/vitesse n'est imposée après la condition initiale.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerPhysX } from '../../verifications/helpers/physx-runtime.mjs';

const require = createRequire(import.meta.url), DT = 1 / 120;
const MODULES = ['circuit', 'conduite', 'degats', 'contacts', 'course', 'solides-physx', 'physique'];
const SOURCES = [...MODULES.map(n => 'src/' + n + '.js'), 'src/pneus.js', 'src/usure-pneus.js',
  'src/chaussee.js', 'src/strategie-stands.js', 'src/ferro/vehicle-dynamics.js',
  'src/ferro/physx.js', 'src/ferro/physx-runtime.js', 'FERRO.lock.json',
  'tools/qualification/aspiration-physx.mjs', 'verifications/helpers/physx-runtime.mjs'];
const CAS = Object.freeze([
  { id: 'seul', ecart: null, lateral: 0 },
  { id: 'sillage-20m', ecart: 20, lateral: 0 },
  { id: 'hors-couloir-2_1m', ecart: 20, lateral: 2.1 },
  { id: 'hors-portee-35m', ecart: 35, lateral: 0 }
]);
const COMMANDE = Object.freeze({ gaz: 1, frein: 0, volant: 0, aide: 0, guidage: 0,
  boite: 'auto', derive: false, haut: false, bas: false, marcheArriere: false });
const empreintes = () => Object.fromEntries(SOURCES.map(f => [f, createHash('sha256')
  .update(readFileSync(new URL('../../' + f, import.meta.url))).digest('hex')]));

function pisteEssai() {
  // Même pas et mêmes interpolateurs que la production. La couture artificielle est
  // à plus de 3 km du segment parcouru et n'est jamais franchie pendant ce banc.
  const n = 2048, pas = 2, longueur = n * pas;
  const c = { nom: 'Ligne droite de qualification', theme: 'foret', graine: 1401,
    longueur, n, pas, largeur: 12, limite: 20, depart: 0, tunnel: null, stands: null };
  for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD']) c[k] = new Float64Array(n);
  for (let i = 0; i < n; i++) { c.x[i] = i * pas; c.vitesse[i] = 100; c.limiteG[i] = c.limiteD[i] = 20; }
  c.vibreur = new Uint8Array(n);
  // Maillage régulier : de très grands triangles déclenchent un avertissement de
  // cooking PhysX et rendent un banc de dynamique moins robuste numériquement.
  const segments = longueur / 16, sommets = new Float32Array((segments + 1) * 2 * 13), indices = [];
  for (let i = 0; i <= segments; i++) for (let cote = 0; cote < 2; cote++) {
    const k = (i * 2 + cote) * 13;
    sommets.set([i * 16, 0, cote ? 12 : -12], k); sommets[k + 4] = 1;
  }
  for (let i = 0; i < segments; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const decor = { nappes: [{ sommets, indices: new Uint32Array(indices),
    surfacesPhysX: new Uint8Array(segments * 2).fill(1), surfaceType: 'accotement' }], lots: [], obstacles: [] };
  return { c, decor };
}

function mesurerCas(B, options, vitesseKmh, secondes) {
  const { c, decor } = pisteEssai(), duo = options.ecart !== null;
  const co = B.course.creer(c, duo ? { mode: 'course', rivaux: 1, graine: 1401,
    humains: { noms: ['Suiveur', 'Meneur'], locaux: [0, 1], hote: true, enLigne: false } }
    : { mode: 'chrono', rivaux: 0, graine: 1401 });
  co.phase = 'course'; co.feux.vert = true;
  for (const v of co.voitures) Object.assign(v.etat, { s: 500 + (v.id ? options.ecart : 0),
    d: v.id ? options.lateral : 0, v: 0, rapport: 6 });
  const p = B.physique.installer(co, decor), ev = [];
  // L'installation garde une marge au-dessus du sol. Laisser les ressorts prendre la
  // charge avant le départ lancé évite de mesurer un essieu encore en l'air.
  const immobilise = { ...COMMANDE, gaz: 0, frein: 1 };
  const commandesRepos = duo ? [immobilise, immobilise] : immobilise;
  for (let i = 0; i < 120; i++) B.course.pas(co, commandesRepos, DT, ev);
  const pasRepos = p.pas;
  for (const ph of p.voitures) {
    assert.equal(ph.groundCount, 4, 'quatre appuis avant le départ lancé');
    const x = 500 + (ph.v.id ? options.ecart : 0), z = ph.v.id ? options.lateral : 0;
    // Même cap, mêmes coordonnées de départ et même vitesse dans les quatre expériences.
    const hauteur = p.world.readPose(ph.id)[1];
    p.world.setPose(ph.id, [x, hauteur, z, 0, 0, 0, 1]);
    p.world.setAngularVelocity(ph.id, [0, 0, 0]);
    ph.e.s = x; ph.e.d = z;
    ph.e.v = vitesseKmh / 3.6;
    ph.e.rapport = 6;
    p.world.setVelocity(ph.id, [ph.e.v, 0, 0]);
  }
  const initial = co.voitures.map(v => ({
    id: v.id, s: v.etat.s, d: v.etat.d, v: v.etat.v, pose: p.world.readPose(v.etat._physx.id),
    vitesse: p.world.readVelocity(v.etat._physx.id) }));
  const r = { id: options.id, vitesseInitialeKmh: vitesseKmh, secondes, ecartInitialM: options.ecart,
    lateralM: options.lateral, corpsDynamiques: p.voitures.length, trianglesSol: p.solids.statistiques.trianglesSol,
    pas: 0, corrections: 0, contactsVoitures: 0, contactsSol: 0, contactsPerdus: 0,
    replacements: 0, minEcartM: null, maxEcartLateralSuiveurM: 0, minAppuis: 4,
    forcesNatives: 0, maxErreurForceN: 0, premierPas: [], initial, mesures: [] };
  try {
    assert.equal(p.backend, 'PhysX'); assert.equal(p.solids.statistiques.trianglesSol, 512);
    for (const ph of p.voitures) {
      const body = p.world._bodies.get(ph.id);
      assert.equal(body.type, 'dynamic'); assert.equal(body.actor.getMass(), 600);
    }
    for (const nom of ['setPose', 'setVelocity', 'setAngularVelocity', 'setKinematicTarget']) {
      const original = p.world[nom];
      p.world[nom] = function (...args) { r.corrections++; return original.apply(this, args); };
    }
    const force = p.world.force;
    p.world.force = function (id, f, point) {
      const ph = p.byId.get(id);
      if (ph && point === undefined) {
        r.forcesNatives++;
        const attendue = ph.forward.map((v, i) => v * ph.forces.resistance[0] + ph.right[i] * ph.forces.resistance[1]);
        r.maxErreurForceN = Math.max(r.maxErreurForceN, ...f.map((v, i) => Math.abs(v - attendue[i])));
        if (r.pas === 0) r.premierPas.push({ id: ph.v.id, aspiration: ph.e.aspiration,
          resistanceLongitudinaleN: ph.forces.resistance[0], forceNativeN: [...f],
          vitesseCaisseMps: ph.u, masseKg: ph.mass });
      }
      return force.call(this, id, f, point);
    };
    const checkpoints = new Set([2, 4, secondes].filter(t => t <= secondes).map(t => Math.round(t / DT)));
    for (let i = 0; i < Math.round(secondes / DT); i++) {
      B.course.pas(co, duo ? [COMMANDE, COMMANDE] : COMMANDE, DT, ev); r.pas++;
      assert.equal(p.world.contacts.error, null); r.contactsPerdus += p.world.contacts.dropped;
      for (let j = 0; j < p.world.contacts.count; j++) {
        const q = p.world.contacts.points[j], a = p.byId.has(q.a), b = p.byId.has(q.b);
        if (a && b) r.contactsVoitures++; else if (a || b) r.contactsSol++;
      }
      for (const ph of p.voitures) {
        assert.ok(ph.controle, 'les forces de conduite ne sont pas transmises au châssis');
        assert.ok([...ph.pose, ...ph.velocity, ph.e.v, ph.e.s, ph.e.aspiration].every(Number.isFinite), 'état natif non fini');
        r.minAppuis = Math.min(r.minAppuis, ph.groundCount);
      }
      r.maxEcartLateralSuiveurM = Math.max(r.maxEcartLateralSuiveurM, Math.abs(co.joueur.etat.d));
      if (duo) { const ecart = co.voitures[1].etat.s - co.joueur.etat.s; r.minEcartM = Math.min(r.minEcartM ?? Infinity, ecart); }
      if (checkpoints.has(i + 1)) r.mesures.push({ secondes: (i + 1) * DT, voitures: co.voitures.map((v, j) => {
        const ph = v.etat._physx, pose = p.world.readPose(ph.id), vitesse = p.world.readVelocity(ph.id);
        return { id: v.id, distanceM: pose[0] - initial[j].pose[0], vitesseKmh: Math.hypot(...vitesse) * 3.6,
          aspiration: v.etat.aspiration, pose, vitesse, appuis: ph.groundCount };
      }) });
    }
    r.replacements = p.placements;
    assert.equal(p.pas - pasRepos, r.pas); assert.equal(r.corrections, 0, 'une pose ou vitesse a été imposée après le départ');
    assert.equal(r.replacements, 0); assert.equal(r.contactsVoitures, 0, 'contact entre voitures : le gain ne serait plus isolé');
    assert.equal(r.contactsPerdus, 0); assert.equal(r.maxErreurForceN, 0);
    assert.equal(r.forcesNatives, r.pas * r.corpsDynamiques, 'force aérodynamique manquante');
    assert.equal(r.minAppuis, 4); assert(r.maxEcartLateralSuiveurM < .01, 'sortie de la ligne droite');
    return r;
  } finally { B.physique.liberer(co); }
}

export async function mesurerAspirationPhysX({ vitessesKmh = [160, 235, 300], secondes = 6 } = {}) {
  assert.ok(!process.env.BITUME_PHYSX_ADAPTER, 'le banc exige le moteur verrouillé, sans adaptateur substitué');
  assert.ok(Number.isFinite(secondes) && secondes >= 2 && secondes <= 6, 'durée entre 2 et 6 s, avant tout contact');
  assert.ok(vitessesKmh.length && vitessesKmh.every(v => Number.isFinite(v) && v >= 100 && v <= 300));
  const avant = empreintes();
  for (const f of MODULES) require('../../src/' + f + '.js');
  const B = globalThis.BITUME, precedentPhysX = globalThis.FPhysX, meteo = B.meteo;
  const X = globalThis.FPhysX = await chargerPhysX();
  B.meteo = { actuel: { pluie: 0, mouille: 0, neigeSol: 0, fixe: true } };
  const r = { format: 'bitume-aspiration-physx-1', date: new Date().toISOString(), node: process.version,
    physique: readFileSync(new URL('../../src/jeu.js', import.meta.url), 'utf8').match(/const PHYSIQUE = '([^']+)'/)[1],
    runtime: X.status(), dt: DT, sourceHashes: avant,
    protocole: { piste: 'Droite plane dédiée de 4096 m, 512 triangles, trajectoire à 500 m au moins des extrémités',
      departs: 'Même état du suiveur, vitesse native initiale et sixième rapport ; tous les pilotes plein gaz, sans direction ni assistance',
      mesure: 'Positions et vitesses lues dans PhysX, vraie B.course.pas ; aucune substitution de ecart, aspirer, conduite ou solveur',
      conditions: 'Sec, pneus slicks, masses de 600 kg ; distances du meneur libres après le départ, aucun maintien artificiel du sillage',
      limites: 'Banc contrôlé du jeu ; ne mesure ni vitesse maximale, ni course complète, ni aérodynamique de voitures réelles, ni FPS' },
    resultats: [], comparaisons: [] };
  try {
    for (const vitesse of vitessesKmh) {
      const cas = CAS.map(c => mesurerCas(B, c, vitesse, secondes)); r.resultats.push(...cas);
      const libre = cas[0];
      for (const c of cas.slice(1)) for (const m of c.mesures) {
        const ref = libre.mesures.find(a => a.secondes === m.secondes).voitures[0];
        r.comparaisons.push({ id: c.id, vitesseInitialeKmh: vitesse, secondes: m.secondes,
          gainSuiveurDistanceM: m.voitures[0].distanceM - ref.distanceM,
          gainSuiveurVitesseKmh: m.voitures[0].vitesseKmh - ref.vitesseKmh,
          gainMeneurDistanceM: m.voitures[1].distanceM - ref.distanceM,
          gainMeneurVitesseKmh: m.voitures[1].vitesseKmh - ref.vitesseKmh });
      }
    }
    const sillage = r.resultats.filter(c => c.id === 'sillage-20m');
    r.sensSillageConforme = sillage.every(c => c.premierPas[0].aspiration > 0 && c.premierPas[1].aspiration === 0);
    r.mondesRestants = X.status().worlds; assert.equal(r.mondesRestants, 0);
    assert.deepEqual(empreintes(), avant, 'sources modifiées pendant la mesure');
    return r;
  } finally { X.dispose(); globalThis.FPhysX = precedentPhysX; B.meteo = meteo; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rapport = await mesurerAspirationPhysX();
  if (process.env.RAPPORT) { const sortie = resolve(process.env.RAPPORT); mkdirSync(dirname(sortie), { recursive: true }); writeFileSync(sortie, JSON.stringify(rapport, null, 2) + '\n'); }
  console.log(JSON.stringify({ physique: rapport.physique, sensSillageConforme: rapport.sensSillageConforme,
    cas: rapport.resultats.length, comparaisons: rapport.comparaisons,
    corrections: rapport.resultats.reduce((n, c) => n + c.corrections, 0),
    contactsVoitures: rapport.resultats.reduce((n, c) => n + c.contactsVoitures, 0) }, null, 2));
}
