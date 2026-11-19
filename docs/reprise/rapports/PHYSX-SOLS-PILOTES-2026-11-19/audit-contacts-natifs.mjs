// Sonde hôte reproductible : corps PhysX natif, freinage sur sol plat puis adhérence dissymétrique.
// Elle ne corrige aucun état par pas et n'affirme pas qu'une anomalie doit subsister après sa correction.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { chargerPhysX } from '../../../../verifications/helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url), racine = new URL('../../../../', import.meta.url), empreintes = {};
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'solides-physx', 'physique', 'carene', 'main', 'voiture', 'traces', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bords', 'decor']) require(new URL('src/' + f + '.js', racine).pathname);
for (const f of ['physique', 'course', 'conduite', 'traces']) empreintes[f] = createHash('sha256').update(readFileSync(new URL('src/' + f + '.js', racine))).digest('hex');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;
const NEUTRE = { gaz: 0, frein: 0, volant: 0, aide: 0, guidage: 0, boite: 'auto' }, FREIN = { ...NEUTRE, frein: 1 };
function fixture(mixte) {
  const n = 1000, c = { n, pas: 2, longueur: n * 2, largeur: 14, graine: 7, theme: 'foret', depart: 0 };
  for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD']) c[k] = new Float64Array(n);
  c.vibreur = new Uint8Array(n);
  for (let i = 0; i < n; i++) { c.x[i] = i * 2; c.vitesse[i] = 75; c.limiteG[i] = c.limiteD[i] = 100; }
  const nappes = [];
  for (const [z0, z1, surface] of [[-40, 0, 1], [0, 40, mixte ? 3 : 1]]) {
    const s = []; for (const [x, z] of [[-50, z0], [800, z0], [800, z1], [-50, z1]]) s.push(x, 0, z, 0, 1, 0, 0, 0, 0, surface === 1 ? 14 : 8, .2, .2, .2);
    nappes.push({ sommets: new Float32Array(s), indices: new Uint32Array([0, 2, 1, 0, 3, 2]), surfaceType: 'accotement', surfacesPhysX: new Uint8Array([surface, surface]) });
  }
  const decor = { nappes, lots: [], obstacles: [] }; c.obstacles = B.obstacles.creer([]);
  const co = B.course.creer(c, { mode: 'chrono', rivaux: 0, tours: 10, graine: 1 }); co.phase = 'course';
  const e = co.joueur.etat; Object.assign(e, { s: 100, d: 0, v: 60, rapport: 5 });
  B.physique.installer(co, decor);
  const fx = B.traces.creer(1, 999, co.physique.world);
  return { co, e, fx, ph: e._physx };
}
const cas = [];
for (const mixte of [false, true]) {
  const s = fixture(mixte), { co, e, ph, fx } = s, ev = [], poses = [{}], forces = [], world = co.physique.world;
  try {
    // Le corps se place et se comprime réellement sous l'appui à 60 m/s ; aucune pose/vitesse écrite après montage.
    for (const f of ['setPose', 'setVelocity', 'setAngularVelocity']) world[f] = () => assert.fail(f + ' pendant la sonde');
    for (let k = 0; k < 240; k++) B.course.pas(co, NEUTRE, DT, ev);
    const appliquer = world.force;
    world.force = function (id, force, point, mode) {
      if (id === ph.id && point) forces.push({ force: [...force], point: [...point] });
      return appliquer.call(this, id, force, point, mode);
    };
    B.course.pas(co, FREIN, DT, ev); world.force = appliquer;
    const P = B.conduite.PARAMS, dynamique = globalThis.FVehicleDynamics.create(P), chaussee = B.chaussee.lire(co.c, e.s);
    const roues = ph.contacts.map((w, i) => {
      const f = forces[i].force, fx = f.reduce((n, a, j) => n + a * w.tangent[j], 0), fy = f.reduce((n, a, j) => n + a * w.right[j], 0);
      const mu = (w.surface === 'herbe' ? P.muHerbe : w.surface === 'vibreur' ? P.muVibreur : P.muPiste) * (i >= 2 ? P.gripArriere : 1);
      const capacite = dynamique.adherence(mu * B.conduite.adherencePneus(e.pneus, chaussee, e.etatPneus[i].usure), w.load);
      return { roue: i, surface: w.surface, charge: w.load, point: [...w.point], effortTangent: Math.hypot(fx, fy), capaciteLocale: capacite,
        rapportEffortCapacite: Math.hypot(fx, fy) / capacite };
    });
    for (let k = 0; k < 24; k++) {
      B.course.pas(co, FREIN, DT, ev);
      Object.assign(poses[0], { x: ph.x, y: ph.y, z: ph.z, cap: ph.cap, tangage: e.tangage, roulis: e.roulis, rebond: ph.offsets });
      B.traces.pas(fx, co, poses, 0, DT, ev);
    }
    const bandes = fx.bandes.filter(b => b.actif), hauteur = bandes.flatMap(b => [b.y0, b.y1]);
    cas.push({ sol: mixte ? 'piste-gauche-herbe-droite' : 'piste', vitesse: e.v, origineY: ph.y, appuis: ph.groundCount,
      debattements: [...ph.offsets], roues, traces: { nombre: bandes.length, yMin: hauteur.length ? Math.min(...hauteur) : null,
        yMax: hauteur.length ? Math.max(...hauteur) : null, solY: 0 }, replacements: co.physique.placements });
  } finally { B.traces.liberer(fx); B.physique.liberer(co); }
}
assert.equal(X.status().worlds, 0);
// Injection d'une exception de rendu après la création du nouveau monde, dans la vraie fonction lancer().
// Le circuit, son décor et ses deux mondes restent réels ; seules les entrées d'interface sont sans navigateur.
const sourceJeu = readFileSync(new URL('src/jeu.js', racine), 'utf8');
empreintes.jeu = createHash('sha256').update(sourceJeu).digest('hex');
const catalogue = vm.runInNewContext(sourceJeu.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
const k = catalogue[0], c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom });
B.bords.limites(c, B.bords.planifier(c));
const decor = B.decor.construire(c, { qualite: 'low', vegetation: false, saison: 'ete', solsProceduraux: true });
c.obstacles = B.obstacles.creer(decor.obstacles);
const ancienne = B.course.creer(c, { mode: 'chrono', rivaux: 0, tours: 3, graine: 1 });
const ancienMonde = B.physique.installer(ancienne, decor), ancienneSession = { type: 'vitrine', i: 0, course: ancienne, fx: B.traces.creer(1, 1, ancienMonde.world) };
const creees = [], erreurModele = new Error('sonde : exception de modèle après montage PhysX');
const environnement = { prepa: { enCours: false }, restaurerReference() {}, session: ancienneSession,
  B: { ...B, ombres: { carte() {}, ombresPossibles: () => false },
    course: { ...B.course, creer(...args) { const co = B.course.creer(...args); creees.push(co); return co; } },
    voiture: { ...B.voiture, modele() { throw erreurModele; } } },
  installer: () => ({ c, decor, saison: 'ete' }), rendu: {}, gpuModeste: false,
  reglages: { qualite: 'low', tours: 3, difficulte: 1 }, etatProfils: { decor: {} }, capacitesRendu: {},
  graineCourse: 3, meteoPourConditions: () => B.chaussee.preparer({}, B.saisons.profil('ete', c.theme)),
  monterPneusDepart() {}, conditions: { saison: 'ete' } };
let cycle;
try {
  const lancer = sourceJeu.match(/  function lancer\(type, i, enl, conditionsChoisies\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(lancer);
  assert.throws(() => vm.runInNewContext(lancer + '; lancer("course", 0, null, conditions);', environnement), e => e === erreurModele);
  cycle = { erreur: erreurModele.message, anciensCorpsDetruits: ancienMonde.disposed,
    sessionAncienneConservee: environnement.session === ancienneSession, mondesAvant: 1, mondesApresException: X.status().worlds,
    nouvellesCourses: creees.length, nouveauxMondesNonLiberes: creees.filter(co => co.physique && !co.physique.disposed).length };
} finally {
  B.traces.liberer(ancienneSession.fx); B.physique.liberer(ancienne); for (const co of creees) B.physique.liberer(co);
}
assert.equal(X.status().worlds, 0);
const resultat = { date: new Date().toISOString(), version: X.status().version, empreintes, cas, cycle };
if (process.env.BITUME_AUDIT_CONTACTS) writeFileSync(process.env.BITUME_AUDIT_CONTACTS, JSON.stringify(resultat, null, 2) + '\n');
console.log(JSON.stringify(resultat, null, 2));
