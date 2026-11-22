// Physique des voitures, vrai solveur PhysX ; aucune substitution de corps/impulsion/contacts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'solides-physx', 'physique', 'son', 'carene', 'main', 'voiture', 'traces']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;
const NEUTRE = { gaz: 0, frein: 0, volant: 0, aide: 0, guidage: 0, boite: 'auto' }, FREIN = { ...NEUTRE, frein: 1 };
let n = 0;
const near = (a, b, e, text = '') => assert.ok(Math.abs(a - b) <= e, text + ` ${a} / ${b} (±${e})`);
function fixture({ pente = 0, devers = 0, voitures = 1, obstacles = [], masses, demiHerbe = false, distant = false } = {}) {
  const n = 1000, pas = 2, c = { n, pas, longueur: n * pas, largeur: 14, graine: 7, theme: 'foret', depart: 0 };
  for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD']) c[k] = new Float64Array(n);
  c.vibreur = new Uint8Array(n);
  for (let i = 0; i < n; i++) { c.x[i] = i * pas; c.y[i] = i * pas * pente; c.pente[i] = pente; c.devers[i] = devers; c.vitesse[i] = 75; c.limiteG[i] = c.limiteD[i] = 100; }
  const sommets = [], indices = [], herbe = [], nx = 66, nz = 9;
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const x = -50 + ix * 10, z = -40 + iz * 10;
    sommets.push(x, pente * x - Math.sin(devers) * z, z, 0, 1, 0, 0, 0, 0, 14, .16, .16, .17);
    if (ix && iz) { const d = iz * nx + ix, a = d - nx - 1, b = d - nx, c0 = d - 1; (demiHerbe && iz >= 5 ? herbe : indices).push(a, c0, b, b, c0, d); }
  }
  const decor = { nappes: [{ sommets: new Float32Array(sommets), indices: new Uint32Array(indices), surfaceType: 'accotement' }], lots: [], obstacles };
  if (demiHerbe) {
    const verts = new Float32Array(sommets); for (let i = 9; i < verts.length; i += 13) verts[i] = 25;
    decor.nappes.push({ sommets: verts, indices: new Uint32Array(herbe), surfaceType: 'terrain' });
  }
  c.obstacles = B.obstacles.creer(obstacles);
  const co = B.course.creer(c, { mode: voitures === 1 ? 'chrono' : 'course', rivaux: voitures - 1, tours: 10, graine: 1 });
  co.phase = 'course';
  for (let i = 0; i < co.voitures.length; i++) { const v = co.voitures[i]; v.etat.s = 100 + i * 20; v.etat.d = 0; v.joueur = true; v.distant = distant; }
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
test('les parois signalent une glissade réelle puis la séparation, le bois conserve son seul choc', () => {
  for (const [genre, matiere] of [['glissiere','metal'], ['mur-tunnel','mur'], ['tronc','']]) {
    const s = fixture({ obstacles:[{ type:'box', x:200, z:1.55, ymin:0, ymax:1, angle:0, hx:110, hz:.05, genre }] });
    try {
      avancer(s,.8,FREIN); s.e.immunite = 10; s.p.world.setVelocity(s.ph.id,[25,0,2.4]);
      const r = B.son.creerRaclement(); let chocs = 0, pasEnContact = 0, duree = 0;
      const observer = ev => {
        chocs += ev.filter(x => x.type === 'choc' && x.obstacle === genre).length;
        B.son.suivreRaclement(r,s.ph,s.co.horloge);
        if (!r.matiere) return;
        assert.equal(r.matiere,matiere); assert(r.vitesse > 14 && r.vitesse < 29);
        pasEnContact++; duree = Math.max(duree,r.duree);
      };
      avancer(s,1.3,{ ...NEUTRE,gaz:.4,volant:.27 },observer);
      avancer(s,1.1,{ ...NEUTRE,gaz:.4,volant:-1 },observer);
      assert(chocs > 0, 'le solveur a réellement heurté le solide');
      if (matiere) assert(pasEnContact > 100 && duree > .8, 'plus de 0,8 s de glissade confirmée');
      else assert.equal(pasEnContact,0);
      assert.equal(r.vitesse,0); assert.equal(r.matiere,''); assert(s.e.v > 10, 'voiture dégagée encore en mouvement');
    } finally { B.physique.liberer(s.co); }
  }
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
test('chaque pneu respecte son adhérence locale avec deux roues dans l’herbe', () => {
  const s = fixture({ demiHerbe: true });
  try {
    avancer(s, 1, FREIN); s.p.world.setVelocity(s.ph.id, [35, 0, 0]);
    const forces = [], force = s.p.world.force;
    s.p.world.force = function (id, f, point) { if (id === s.ph.id && point) forces.push({ f: Array.from(f), point }); return force.call(this, id, f, point); };
    avancer(s, DT, { ...FREIN, volant: .8 });
    assert.deepEqual(new Set(s.ph.contacts.map(w => w.surface)), new Set(['piste', 'herbe']));
    let utilisation = 0;
    for (const w of s.ph.contacts) {
      const f = forces.find(f => f.point === w.point)?.f; assert(f, 'aucune force native au point de contact');
      const effort = Math.hypot(...f.map((x, j) => x - w.normal[j] * w.load));
      assert(effort <= w.capacity + .01, `${w.surface}: ${effort} N > ${w.capacity} N`);
      utilisation = Math.max(utilisation, effort / w.capacity);
    }
    assert(utilisation > .9, 'l’essai ne sollicite pas suffisamment les pneus');
  } finally { B.physique.liberer(s.co); }
});
test('roues et traces restent sur le vrai plan malgré la compression et le dévers', () => {
  const pente = .068, devers = .07, s = fixture({ pente, devers }), fx = B.traces.creer(1, 7, s.p.world);
  const norm = Math.hypot(pente, 1, Math.sin(devers)), n = [-pente / norm, 1 / norm, Math.sin(devers) / norm];
  const pose = () => [{ x: s.ph.x, y: s.ph.y, z: s.ph.z, cap: s.ph.cap, tangage: s.e.tangage, roulis: s.e.roulis }];
  try {
    avancer(s, 1, FREIN);
    s.p.world.setVelocity(s.ph.id, [45, 45 * pente, 0]);
    avancer(s, .8, { ...NEUTRE, gaz: .4 }, () => {
      for (const r of s.e.roues) r.glisse = 1; // stimulus de gomme ; les points viennent exclusivement du vrai sol
      B.traces.pas(fx, s.co, pose(), 0, DT, []);
    });
    for (const w of s.ph.contacts) {
      const R = w.roue, center = s.ph.pose.slice(0, 3).map((x, j) => x + s.ph.forward[j] * R.x + s.ph.up[j] * (R.r + s.ph.offsets[w.i]) + s.ph.right[j] * R.z);
      const axial = n.reduce((x, v, j) => x + v * s.ph.right[j], 0), support = R.r * Math.sqrt(1 - axial * axial) + R.l * .5 * Math.abs(axial);
      near(center.reduce((x, v, j) => x + v * n[j], 0) - support, 0, .014, 'enveloppe roue/plan');
    }
    const bandes = fx.bandes.filter(b => b.actif); assert(bandes.length >= 4, 'pas de gomme');
    for (const b of bandes) for (const end of [0, 1]) {
      const distance = (-pente * b['x' + end] + b['y' + end] + Math.sin(devers) * b['z' + end]) / norm;
      near(distance, .018, .001, 'gomme au-dessus du sol');
    }
    B.conduite.lancerSaut(s.e, { h: 1 });
    avancer(s, .3, NEUTRE, () => B.traces.pas(fx, s.co, pose(), 0, DT, []));
    assert.equal(s.ph.groundCount, 0); assert(fx.valide.every(x => x === 0), 'trace persistante en l’air');
  } finally { B.traces.liberer(fx); B.physique.liberer(s.co); }
});
test('les débris partagent le sol et les contacts sans doubler le pas PhysX', () => {
  const s = fixture({ obstacles: [{ type: 'box', x: 150, z: 0, ymin: 0, ymax: 3, angle: 0, hx: .04, hz: 5, genre: 'barriere' }] });
  const world = s.p.world, nombre = world._bodies.size, fx = B.traces.creer(1, 9, world), poses = [{ x: 100, y: 0, z: 0, cap: 0 }];
  try {
    avancer(s, 1, FREIN);
    B.traces.pas(fx, s.co, poses, 0, DT, [{ type: 'roue', id: 0, roue: 0 }]);
    const debris = fx.debris.find(d => d.corps); assert(debris, 'aucun débris natif');
    assert.equal(world._bodies.size, nombre + 1); assert.equal(fx.sols.length, 0, 'sol plat de substitution');
    world.setPose(debris.corps, [130, .8, 0, 0, 0, 0, 1]); world.setVelocity(debris.corps, [90, 0, 0]);
    let pas = 0, contacts = 0, maxX = -Infinity;
    const step = world.step; world.step = function (dt) { pas++; return step.call(this, dt); };
    for (let i = 0; i < 60; i++) {
      B.course.pas(s.co, FREIN, DT, []);
      for (let j = 0; j < world.contacts.count; j++) { const p = world.contacts.points[j]; if (p.a === debris.corps || p.b === debris.corps) contacts++; }
      B.traces.pas(fx, s.co, poses, 0, DT, []);
      maxX = Math.max(maxX, world.readPose(debris.corps)[0]);
    }
    assert.equal(pas, 60, 'effets qui simulent à nouveau la course');
    assert(contacts > 0 && maxX < 150, 'débris à travers la barrière');
    B.traces.liberer(fx); assert.equal(world._bodies.size, nombre, 'sol/voiture supprimé ou débris orphelin');
    assert(s.e._physx && world._bodies.has(s.ph.id));
  } finally { B.traces.liberer(fx); B.physique.liberer(s.co); }
});
test('la reprise d’une voiture distante en vol conserve pose et vitesses natives', () => {
  const s = fixture({ distant: true });
  try {
    s.e.s = 120; s.e.y = 4; s.e.v = 25;
    s.co.distant = () => { s.e.s += 25 * DT; s.e.y += .5 * DT; s.e.psi += .1 * DT; };
    avancer(s, .5);
    const world = s.p.world, id = s.ph.id, pose = world.readPose(id), velocity = world.readVelocity(id), angular = world.readAngularVelocity(id);
    assert(pose[1] > 4 && velocity[0] > 20, 'acteur distant non prolongé');
    s.co.voitures[0].distant = false;
    B.physique.avant(s.co, DT, false);
    assert.notEqual(s.ph.id, id); assert(!world._bodies.has(id)); assert(!s.ph.distant);
    for (let i = 0; i < 7; i++) near(world.readPose(s.ph.id)[i], pose[i], 1e-5, 'pose à la reprise');
    for (let i = 0; i < 3; i++) {
      near(world.readVelocity(s.ph.id)[i], velocity[i], 1e-5, 'vitesse à la reprise');
      near(world.readAngularVelocity(s.ph.id)[i], angular[i], 1e-5, 'rotation à la reprise');
    }
    avancer(s, .1); assert(s.ph.y > 3, 'replacement au sol pendant la reprise');
    assert.equal(s.p.placements, 0);
  } finally { B.physique.liberer(s.co); }
});
test('un proxy distant garde ses suspensions transmises et ses points de contact réels', () => {
  const s = fixture({ distant: true });
  try {
    s.e.y = -.04; s.ph.hasRemote = true; s.ph.remote.set([0, 0, 0, 0, 0, 0, .04, .04, .04, .04, 4]);
    const poses = [], setShape = s.p.world.setShapePose;
    s.p.world.setShapePose = function (id, index, pose) { if (id === s.ph.id) poses[index] = Array.from(pose); return setShape.call(this, id, index, pose); };
    avancer(s, .1);
    assert.equal(s.ph.groundCount, 4); assert.equal(s.e.y, -.04, 'les sondes ont remplacé l’état reçu');
    for (const w of s.ph.contacts) {
      near(s.ph.offsets[w.i], .04, 1e-9); near(poses[w.i + 1][1], w.roue.r + .04, 1e-9, 'forme de roue distante');
      near(s.ph.pose[1] + poses[w.i + 1][1] - w.roue.r, 0, 1e-5, 'roue visuelle sous le sol');
      assert(w.hit.hit && w.load > 0); near(w.point[1], 0, 1e-6, 'point réel pour les effets distants');
    }
  } finally { B.physique.liberer(s.co); }
});
test('la reprise emploie les vitesses 3D transmises même entre deux déplacements du proxy', () => {
  const s = fixture({ distant: true });
  try {
    s.e.y = 5; avancer(s, .1); // proxy immobile : sa vitesse cinématique locale ne décrit pas le saut émetteur
    s.ph.remote.set([25, 3, -2, .1, .2, .3, 0, 0, 0, 0, 0]); s.ph.hasRemote = true;
    const pose = s.p.world.readPose(s.ph.id); s.co.voitures[0].distant = false;
    B.physique.avant(s.co, DT, false);
    for (let i = 0; i < 7; i++) near(s.ph.pose[i], pose[i], 1e-6, 'continuité de position');
    for (let i = 0; i < 3; i++) {
      near(s.ph.velocity[i], [25, 3, -2][i], 1e-6, 'vitesse émetteur');
      near(s.ph.angular[i], [.1, .2, .3][i], 1e-6, 'rotation émetteur');
    }
    assert.equal(s.ph.hasRemote, false); assert.equal(s.p.placements, 0);
  } finally { B.physique.liberer(s.co); }
});
console.log(`${n} contrôles PhysX voitures réussis`);
X.dispose();
