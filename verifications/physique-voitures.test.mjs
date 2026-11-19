// Physique des voitures, vrai solveur PhysX ; aucune substitution de corps/impulsion/contacts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'solides-physx', 'physique']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;
const NEUTRE = { gaz: 0, frein: 0, volant: 0, aide: 0, guidage: 0, boite: 'auto' }, FREIN = { ...NEUTRE, frein: 1 };
let n = 0;
const near = (a, b, e, text = '') => assert.ok(Math.abs(a - b) <= e, text + ` ${a} / ${b} (±${e})`);
function fixture({ pente = 0, devers = 0, voitures = 1, obstacles = [], masses } = {}) {
  const n = 1000, pas = 2, c = { n, pas, longueur: n * pas, largeur: 14, graine: 7, theme: 'foret', depart: 0 };
  for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD']) c[k] = new Float64Array(n);
  c.vibreur = new Uint8Array(n);
  for (let i = 0; i < n; i++) { c.x[i] = i * pas; c.y[i] = i * pas * pente; c.pente[i] = pente; c.devers[i] = devers; c.vitesse[i] = 75; c.limiteG[i] = c.limiteD[i] = 100; }
  const sommets = [], indices = [], nx = 66, nz = 9;
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const x = -50 + ix * 10, z = -40 + iz * 10;
    sommets.push(x, pente * x - Math.sin(devers) * z, z, 0, 1, 0, 0, 0, 0, 14, .16, .16, .17);
    if (ix && iz) { const d = iz * nx + ix, a = d - nx - 1, b = d - nx, c0 = d - 1; indices.push(a, c0, b, b, c0, d); }
  }
  const decor = { nappes: [{ sommets: new Float32Array(sommets), indices: new Uint32Array(indices), surfaceType: 'accotement' }], lots: [], obstacles };
  c.obstacles = B.obstacles.creer(obstacles);
  const co = B.course.creer(c, { mode: voitures === 1 ? 'chrono' : 'course', rivaux: voitures - 1, tours: 10, graine: 1 });
  co.phase = 'course';
  for (let i = 0; i < co.voitures.length; i++) { const v = co.voitures[i]; v.etat.s = 100 + i * 20; v.etat.d = 0; v.joueur = true; }
  B.physique.installer(co, decor, { masses });
  return { c, co, decor, e: co.voitures[0].etat, p: co.physique, ph: co.voitures[0].etat._physx };
}
function avancer(s, secondes, cmd = NEUTRE, observer) {
  const ev = [];
  for (let i = 0; i < secondes / DT; i++) { B.course.pas(s.co, cmd, DT, ev); observer?.(ev, i); }
}
function test(nom, f) { try { f(); n++; console.log('ok  ' + nom); } catch (e) { console.error('KO  ' + nom); throw e; } }

test('les voitures sont des acteurs dynamiques natifs de 600 kg, avec centre de masse et inertie', () => {
  const s = fixture();
  try {
    assert.equal(s.p.backend, 'PhysX'); assert.equal(s.p.version, '5.12.0');
    const actor = s.p.world._bodies.get(s.ph.id).actor;
    near(actor.getMass(), 600, .01); near(actor.getCMassLocalPose().get_p().get_y(), .33, 1e-6);
    near(actor.getMassSpaceInertiaTensor().get_y(), 1014, .01);
    assert(s.p.world._bodies.size > s.co.voitures.length, 'le vrai sol est absent');
  } finally { B.physique.liberer(s.co); }
});
test('quatre ressorts portent le poids au repos, sans réécrire la pose ni les vitesses', () => {
  const s = fixture();
  try {
    let poses = 0, vitesses = 0, angulaires = 0;
    for (const [name, incr] of [['setPose', () => poses++], ['setVelocity', () => vitesses++], ['setAngularVelocity', () => angulaires++]]) {
      const fn = s.p.world[name]; s.p.world[name] = function (...a) { incr(); return fn.apply(this, a); };
    }
    avancer(s, 5, FREIN);
    near(s.e.y, 0, .025, 'garde au sol');
    near(s.ph.contacts.reduce((n, q) => n + q.load, 0), 600 * 9.81, 120, 'poids');
    near(s.e.tangage, 0, .015); near(s.e.roulis, 0, .015);
    assert.equal(poses + vitesses + angulaires, 0, 'pilotage caché de pose/vitesse');
    assert.equal(s.e.repositionnements, 0); assert.equal(s.ph.groundCount, 4);
  } finally { B.physique.liberer(s.co); }
});
test('le frein maintient une pente et un dévers par forces, nez dans les deux sens', () => {
  for (const sens of [0, Math.PI]) {
    const s = fixture({ pente: .068, devers: .07 });
    try {
      s.e.psi = sens; s.e.repositionnements++; // placement d'essai explicite, avant toute mesure
      avancer(s, 1, FREIN); const x = s.ph.x, z = s.ph.z, resets = s.p.placements;
      avancer(s, 4, FREIN);
      assert(Math.hypot(s.ph.x - x, s.ph.z - z) < .12, 'frein ne tient pas le plan incliné');
      assert.equal(s.p.placements, resets, 'replacement pendant le maintien');
      for (const w of s.ph.contacts) assert(w.hit.hit && w.load > 100, 'roue sans appui');
      near(s.e.tangage, Math.atan(.068) * Math.cos(sens), .02, 'tangage orienté avec la caisse');
    } finally { B.physique.liberer(s.co); }
  }
});
test('accélération, freinage puis marche arrière viennent des forces de pneus', () => {
  const s = fixture();
  try {
    avancer(s, 1, FREIN); const debut = s.ph.x;
    avancer(s, 5, { ...NEUTRE, gaz: 1 });
    assert(s.e.v > 25 && s.ph.x > debut + 60, `pas de motricité : ${s.e.v} m/s, ${s.ph.x - debut} m`);
    avancer(s, 5, FREIN); assert(Math.abs(s.e.v) < .2, 'freinage sans arrêt'); const arret = s.ph.x;
    avancer(s, 3, { ...FREIN, marcheArriere: true });
    assert(s.e.v < -.5 && s.e.v > -3.6, 'marche arrière absente ou excessive ' + s.e.v);
    assert(s.ph.x < arret - 2, 'la caisse ne recule pas');
    assert.equal(s.e.repositionnements, 0);
  } finally { B.physique.liberer(s.co); }
});
test('un saut rencontre physiquement la pente et revient sur ses roues', () => {
  const s = fixture({ pente: .068 });
  try {
    avancer(s, 1, FREIN);
    s.p.world.setVelocity(s.ph.id, [55, 55 * .068, 0]);
    B.conduite.lancerSaut(s.e, { grand: true, h: .7 });
    let min = Infinity, hauteur = 0;
    avancer(s, 2.5, NEUTRE, () => { const h = s.ph.y - s.ph.x * .068; min = Math.min(min, h); hauteur = Math.max(hauteur, h); });
    assert(hauteur > .2, 'aucun décollage réel'); assert(min > -.1, 'la caisse traverse le sol de la montée : ' + min);
    assert(s.ph.groundCount >= 2, 'pas de réception'); assert.equal(s.e.repositionnements, 0);
  } finally { B.physique.liberer(s.co); }
});
test('une barrière de 8 cm arrête le châssis à haute vitesse sans traversée', () => {
  const s = fixture({ obstacles: [{ type: 'box', x: 150, z: 0, ymin: 0, ymax: 2, angle: 0, hx: .04, hz: 5, genre: 'barriere' }] });
  try {
    avancer(s, 1, FREIN); s.e.immunite = 10; s.p.world.setVelocity(s.ph.id, [90, 0, 0]);
    let max = -Infinity, chocs = 0;
    avancer(s, 1, NEUTRE, ev => { max = Math.max(max, s.ph.x); chocs += ev.filter(e => e.type === 'choc').length; });
    assert(max < 149.8, 'barrière traversée ' + max); assert(chocs > 0, 'aucun contact remonté');
    assert.equal(s.e.repositionnements, 0); assert(s.e.v < 15, 'vitesse non résolue');
  } finally { B.physique.liberer(s.co); }
});
test('deux voitures échangent leur quantité de mouvement avec leur masse réelle', () => {
  const s = fixture({ voitures: 2, masses: { 0: 600, 1: 1200 } });
  try {
    avancer(s, 1, [FREIN, FREIN]);
    for (const v of s.co.voitures) v.etat.immunite = 10;
    s.p.world.setVelocity(s.ph.id, [12, 0, 0]); let contacts = 0;
    avancer(s, 2, [NEUTRE, NEUTRE], ev => { contacts += ev.filter(e => e.type === 'contact').length; });
    const autre = s.co.voitures[1].etat._physx;
    assert(contacts > 0, 'voitures sans contact'); assert(autre.x > 120.2, 'voiture heurtée immobile');
    assert(s.ph.x < autre.x - 2.5, 'voitures imbriquées');
    assert(s.co.voitures.every(v => !v.etat.repositionnements), 'replacement au lieu de résoudre le contact');
  } finally { B.physique.liberer(s.co); }
});
test('les mondes se libèrent entre les courses et aucun corps ne reste orphelin', () => {
  const avant = X.status().worlds;
  for (let i = 0; i < 6; i++) { const s = fixture(); avancer(s, .1, FREIN); B.physique.liberer(s.co); B.physique.liberer(s.co); assert.equal(s.e._physx, undefined); }
  assert.equal(X.status().worlds, avant);
});
console.log(`${n} contrôles PhysX voitures réussis`);
X.dispose();
