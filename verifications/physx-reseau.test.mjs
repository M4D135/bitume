// Une reprise réseau change l'autorité du corps, jamais sa trajectoire ni son attitude.
// Vrai runtime PhysX : les vitesses du corps cinématique viennent de deux cibles successives.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';

const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'solides-physx', 'physique']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;
const near = (a, b, tolerance, message) => {
  assert.equal(a.length, b.length, message);
  for (let i = 0; i < a.length; i++) assert(Math.abs(a[i] - b[i]) <= tolerance, `${message}[${i}] : ${a[i]} / ${b[i]}`);
};

function fixture(distant) {
  const n = 1000, pas = 2, c = { n, pas, longueur: n * pas, largeur: 14, graine: 7, theme: 'foret', depart: 0 };
  for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD']) c[k] = new Float64Array(n);
  c.vibreur = new Uint8Array(n);
  for (let i = 0; i < n; i++) { c.x[i] = i * pas; c.vitesse[i] = 75; c.limiteG[i] = c.limiteD[i] = 100; }
  const sommets = [], indices = [], nx = 17;
  for (let iz = 0; iz < 9; iz++) for (let ix = 0; ix < nx; ix++) {
    sommets.push(ix * 10, 0, iz * 10 - 40, 0, 1, 0, 0, 0, 0, 14, .16, .16, .17);
    if (ix && iz) { const d = iz * nx + ix, a = d - nx - 1, b = d - nx, c0 = d - 1; indices.push(a, c0, b, b, c0, d); }
  }
  const decor = { nappes: [{ sommets: new Float32Array(sommets), indices: new Uint32Array(indices), surfaceType: 'accotement' }], lots: [], obstacles: [] };
  c.obstacles = B.obstacles.creer([]);
  const co = B.course.creer(c, { mode: 'chrono', rivaux: 0, graine: 7 }); co.phase = 'course';
  const v = co.joueur, e = v.etat; e.s = 100; e.d = -2; v.distant = distant;
  B.physique.installer(co, decor);
  return { co, v, e, ph: e._physx, p: co.physique };
}

function poseReseau(s) {
  return [s.e.s, s.e.y, s.e.d, ...B.physique.quaternion(s.e.psi + s.e.beta, s.e.tangage, s.e.roulis)];
}

test('PhysX réseau : reprise locale en plein saut conserve pose, vitesse latérale et rotation natives', () => {
  const s = fixture(true);
  try {
    Object.assign(s.e, { s: 100, d: -2, y: 2.5, psi: .2, beta: .06, tangage: .12, roulis: -.08, v: 18.6 });
    s.p.world.setPose(s.ph.id, poseReseau(s)); // Mise en situation du banc, avant le transfert observé.
    s.e.s += .15; s.e.d += .04; s.e.y += .025;
    s.e.psi += .004; s.e.tangage += .003; s.e.roulis += .002;
    B.physique.pas(s.co, DT, []);
    const pose = s.p.world.readPose(s.ph.id), vitesse = s.p.world.readVelocity(s.ph.id), rotation = s.p.world.readAngularVelocity(s.ph.id);
    assert(pose[1] > 2 && Math.abs(vitesse[1]) > 1 && Math.abs(vitesse[2]) > 1, 'le scénario doit être en vol et en dérive');
    assert(Math.hypot(...rotation) > .1, 'la cible cinématique doit produire une rotation native');
    const compte = s.p.world._bodies.size;
    s.v.distant = false; B.physique.avant(s.co, DT, false);
    assert.equal(s.p.world._bodies.get(s.ph.id).type, 'dynamic');
    assert.equal(s.p.world._bodies.size, compte, 'aucun double acteur après reprise');
    near(s.p.world.readPose(s.ph.id), pose, 1e-6, 'pose à la reprise');
    near(s.p.world.readVelocity(s.ph.id), vitesse, 1e-5, 'vitesse à la reprise');
    near(s.p.world.readAngularVelocity(s.ph.id), rotation, 1e-5, 'rotation à la reprise');
    assert.equal(s.p.placements, 0); assert.equal(s.e.repositionnements, 0);
    B.physique.pas(s.co, DT, []);
    assert(s.e.y > 2, 'la première intégration locale doit poursuivre le saut');
  } finally { B.physique.liberer(s.co); }
});

test('PhysX réseau : passage local vers distant garde la pose avant la prochaine cible réseau', () => {
  const s = fixture(false);
  try {
    const pose = [100, 3, -2, ...B.physique.quaternion(.28, .17, -.11)];
    s.p.world.setPose(s.ph.id, pose); s.p.world.setVelocity(s.ph.id, [18, 2, 4]);
    s.p.world.setAngularVelocity(s.ph.id, [.1, -.2, .3]);
    B.physique.avant(s.co, DT, false); // Synchronisation d'état habituelle, avant changement d'autorité.
    const avant = s.p.world.readPose(s.ph.id), compte = s.p.world._bodies.size;
    s.v.distant = true; B.physique.avant(s.co, DT, false);
    assert.equal(s.p.world._bodies.get(s.ph.id).type, 'kinematic');
    assert.equal(s.p.world._bodies.size, compte);
    near(s.p.world.readPose(s.ph.id), avant, 1e-6, 'pose avant prochaine cible');
    assert.equal(s.p.placements, 0); assert.equal(s.e.repositionnements, 0);
    Object.assign(s.e, { s: 100.3, d: -1.9, y: 3.02, psi: .31, beta: 0, tangage: .18, roulis: -.12 });
    const cible = poseReseau(s); B.physique.pas(s.co, DT, []);
    near(s.p.world.readPose(s.ph.id), cible, 2e-5, 'cible distante suivante');
  } finally { B.physique.liberer(s.co); }
});

after(() => { assert.equal(X.status().worlds, 0, 'mondes rendus après transferts'); X.dispose(); });
