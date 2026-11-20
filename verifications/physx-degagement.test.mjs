// Après un vrai contact fixe, le même contrôleur IA doit sortir le châssis natif
// par ses commandes normales. Aucun solveur Frenet ni contact de substitution.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';

const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'solides-physx', 'physique']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;

function fixture() {
  const n = 1000, pas = 2, c = { n, pas, longueur: n * pas, largeur: 14, graine: 7, theme: 'foret', depart: 0 };
  for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD']) c[k] = new Float64Array(n);
  c.vibreur = new Uint8Array(n);
  for (let i = 0; i < n; i++) { c.x[i] = i * pas; c.vitesse[i] = 75; c.limiteG[i] = c.limiteD[i] = 100; }
  // Même format de nappe que le rendu : les quatre suspensions prennent appui
  // sur ces triangles cuits par PhysX, sans plan analytique de remplacement.
  const sommets = [], indices = [], nx = 66, nz = 9;
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    sommets.push(-50 + ix * 10, 0, -40 + iz * 10, 0, 1, 0, 0, 0, 0, 14, .16, .16, .17);
    if (ix && iz) { const d = iz * nx + ix, a = d - nx - 1, b = d - nx, c0 = d - 1; indices.push(a, c0, b, b, c0, d); }
  }
  // Un seul obstacle, devant et décalé de l'axe. L'arrière reste libre et la
  // trajectoire de course permet de contourner le tronc après le recul.
  const tronc = { type: 'circle', x: 104, z: 4, r: .8, ymin: 0, ymax: 4, genre: 'tronc' };
  const decor = { nappes: [{ sommets: new Float32Array(sommets), indices: new Uint32Array(indices), surfaceType: 'accotement' }], lots: [], obstacles: [tronc] };
  c.obstacles = B.obstacles.creer(decor.obstacles);
  const co = B.course.creer(c, { mode: 'chrono', rivaux: 0, tours: 10, graine: 1 }), v = co.joueur, e = v.etat;
  co.phase = 'course'; co.feux.vert = true; co.temps = co.horloge = 30; co.dt = DT;
  Object.assign(e, { s: 100, d: 4, v: 2, psi: 0, beta: 0, omega: 0, rapport: 1, regime: 5000 });
  e.etatPneus.forEach((r, i) => { r.usure = .2 + i * .1; });
  B.physique.installer(co, decor);
  return { co, v, e, tronc, p: co.physique, ph: e._physx };
}

const s = fixture(), { co, v, e, tronc, p, ph } = s;
try {
  assert.equal(p.backend, 'PhysX'); assert.equal(p.version, '5.12.0');
  assert.equal(p.solids.statistiques.obstaclesHistoriques, 1);
  assert(p.solids.statistiques.trianglesSol > 100);
  assert.equal(p.world._bodies.get(ph.id).actor.getMass(), 600);
  const calls = { pose: 0, vitesse: 0, rotation: 0 };
  // Le placement initial est terminé. Toute correction imposée après ce point
  // invalide le scénario, même si la voiture semble ensuite repartir.
  for (const [nom, cle] of [['setPose', 'pose'], ['setVelocity', 'vitesse'], ['setAngularVelocity', 'rotation']]) {
    const original = p.world[nom]; p.world[nom] = function (...a) { calls[cle]++; return original.apply(this, a); };
  }
  const roues = e.etatPneus, graines = roues.map(r => r.graine), usure = roues.map(r => r.usure), ev = [], cmd = {};
  let contactNatif = 0, choc = null, recul = null, reprise = null, vitesseReculMin = 0, phasesRecul = 0, anciennePhase = 0;
  let rayonsArriere = 0, pasRecul = 0, appuisFin = 0;
  for (let k = 0; k < 18 / DT; k++) {
    // Le joueur est confié explicitement au vrai pilote IA, comme dans le banc
    // de course ; la physique reste pilotée uniquement par course.pas.
    B.course.commandesIA(co, v, cmd);
    B.course.pas(co, cmd, DT, ev);
    const t = (k + 1) * DT;
    for (let j = 0; j < p.world.contacts.count; j++) {
      const point = p.world.contacts.points[j]; if (point.a !== ph.id && point.b !== ph.id) continue;
      const autre = point.a === ph.id ? point.b : point.a;
      if (p.solids.acteurs.get(autre)?.genre === 'tronc') contactNatif++;
    }
    if (ev.some(x => x.type === 'choc' && x.id === v.id && x.obstacle === 'tronc')) choc ??= t;
    if (v.ia.degagement === 1 && anciennePhase !== 1) {
      phasesRecul++;
      assert(choc !== null && contactNatif > 0, 'le dégagement précède le vrai choc');
      for (const cote of [-1.1, 0, 1.1]) {
        const origine = [ph.x + ph.right[0] * cote, ph.y + .5, ph.z + ph.right[2] * cote];
        const hit = p.world.raycast(origine, [-ph.forward[0], 0, -ph.forward[2]], 5, { mask: B.physique.GROUPES.OBSTACLE, staticOnly: true });
        assert(!hit.hit, 'le scénario n’offre plus de place libre derrière'); rayonsArriere++;
      }
    }
    anciennePhase = v.ia.degagement;
    if (choc !== null && cmd.marcheArriere && e.rapport === -1 && ph.u < -.2) { recul ??= t; pasRecul++; }
    if (recul !== null && e.rapport > 0 && ph.u > 8 && ph.x > tronc.x + 10) reprise ??= t;
    vitesseReculMin = Math.min(vitesseReculMin, ph.u);
    assert.equal(e.repositionnements, 0, 'replacement au lieu d’un dégagement');
    assert(!e.recuperation && !e.accident, 'secours utilisé pour sortir du contact');
    assert.equal(e.etatPneus, roues); assert.equal(e.servicePneus, 0);
    assert.deepEqual(e.etatPneus.map(r => r.graine), graines);
    for (let j = 0; j < 4; j++) { assert(e.etatPneus[j].usure >= usure[j], 'pneu réparé pendant le dégagement'); usure[j] = e.etatPneus[j].usure; }
    if (k >= 17 / DT) appuisFin = Math.max(appuisFin, ph.groundCount);
  }
  assert(contactNatif > 0 && choc !== null, 'le châssis n’a pas heurté le tronc dans le vrai solveur');
  assert(recul !== null && recul > choc && pasRecul > 30, 'marche arrière native commandée absente après le choc');
  assert(reprise !== null && reprise > recul, 'reprise du guidage absente après le recul');
  assert(ph.x > tronc.x + 100 && ph.u > 8, 'la voiture reste près de son obstacle');
  assert.equal(v.ia.degagement, 0); assert(phasesRecul >= 1 && phasesRecul <= 2);
  assert(vitesseReculMin >= -B.conduite.PARAMS.reculMax - .1, 'recul excessif');
  assert.equal(appuisFin, 4); assert.equal(p.placements, 0);
  assert.deepEqual(calls, { pose: 0, vitesse: 0, rotation: 0 });
  console.log('ok  PhysX : choc fixe, recul IA puis reprise sans téléportation ni réparation des pneus');
  console.log(JSON.stringify({ backend: p.backend, version: p.version, pas: 18 / DT, dt: DT, contactNatif,
    chocS: choc, reculS: recul, repriseS: reprise, phasesRecul, rayonsArriere, pasRecul,
    vitesseReculMin, xFinal: ph.x, vitesseFinale: ph.u, replacements: e.repositionnements,
    servicePneus: e.servicePneus, ecritures: calls, appuisFin }));
} finally { B.physique.liberer(co); assert.equal(X.status().worlds, 0); X.dispose(); }
