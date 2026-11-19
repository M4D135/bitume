// Une séance abandonnée rend ses acteurs natifs et détache les anciens états de jeu.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';

const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'solides-physx', 'physique', 'traces']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX();
function fixture() {
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
  const co = B.course.creer(c, { mode: 'course', rivaux: 1, graine: 7 }); co.phase = 'course';
  for (const v of co.voitures) { v.etat.s = 100 + v.id * 15; v.etat.d = 0; }
  return { co, decor };
}
function mondeVide(world) {
  assert.equal(world._disposed, true); assert.equal(world._bodies.size, 0);
  assert.equal(world._actorIds.size, 0); assert.equal(world._statics.length, 0);
  // Le canon 0.3.13 utilise des tampons natifs réservés, pas les anciens caches _views/_viewPointers.
  // Le contrat observable reste : aucun acteur conservé et aucune lecture/simulation après destruction.
  assert.throws(() => world.step(1 / 120), /disposed/);
  assert.throws(() => world.readPose(1), /disposed/);
}

test('PhysX : une création interrompue détache les voitures déjà installées et permet une reprise propre', () => {
  const { co, decor } = fixture(); let world;
  globalThis.FPhysX = { ...X, createWorld(options) {
    world = X.createWorld(options); const add = world.addCompound; let corps = 0;
    world.addCompound = function (...args) {
      if (++corps === 2) throw new Error('échec contrôlé de la deuxième voiture');
      return add.apply(this, args);
    };
    return world;
  } };
  try {
    assert.throws(() => B.physique.installer(co, decor), /échec contrôlé de la deuxième voiture/);
    assert.equal(X.status().worlds, 0);
    assert(co.voitures.every(v => !Object.hasOwn(v.etat, '_physx')), 'aucun état ne conserve un adaptateur détruit');
    assert(!co.physique); mondeVide(world);
  } finally { globalThis.FPhysX = X; }
  try {
    B.physique.installer(co, decor);
    assert(co.voitures.every(v => v.etat._physx && !v.etat._physx.world._disposed));
    assert.equal(co.physique.voitures.length, 2);
  } finally { B.physique.liberer(co); }
});

test('PhysX : libérer les effets partagés puis la course vide aussi les références conservées', () => {
  const { co, decor } = fixture(); B.physique.installer(co, decor);
  const p = co.physique, world = p.world, fx = B.traces.creer(2, 7, world);
  try {
    const corps = world.addBox([100, 1, 0], [.1, .1, .1], { mass: 2, group: 8, mask: 0xffffffff, queryGroup: 8 });
    Object.assign(fx.debris[0], { corps, actif: true });
    world.step(1 / 120); world.readPose(corps); world.readVelocity(corps);
    assert.equal(X.status().worlds, 1, 'la séance et ses effets partagent un seul monde');
    B.traces.liberer(fx);
    assert.equal(world._disposed, false, 'les effets ne détruisent pas le monde de la course');
    assert.equal(fx.monde, null); assert(fx.debris.every(d => !d.corps && !d.actif));
    B.physique.liberer(co); B.physique.liberer(co);
    assert.equal(X.status().worlds, 0); assert.equal(co.physique, null);
    assert(co.voitures.every(v => !Object.hasOwn(v.etat, '_physx')));
    assert.equal(p.voitures.length, 0); assert.equal(p.byId.size, 0); assert.equal(p.collisions.size, 0); assert.equal(p.impacts.size, 0);
    assert.equal(p.solids.ids.length, 0); assert.equal(p.solids.acteurs.size, 0); assert.equal(p.solids.libere, true);
    mondeVide(world);
  } finally { B.traces.liberer(fx); B.physique.liberer(co); }
});

after(() => { assert.equal(X.status().worlds, 0); X.dispose(); });
