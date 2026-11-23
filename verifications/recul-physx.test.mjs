// Bug K (reproduit en PhysX, le mode réel du jeu) : après un recul, le gaz doit faire repartir en avant.
// Le joueur a marcheArriere toujours vrai (le recul s'engage au frein maintenu à l'arrêt) ; la sortie
// de recul doit donc être pilotée par l'intention avant (gaz), pas par le relâchement de marcheArriere.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'botanique', 'ecologie', 'saisons', 'bords',
  'carene', 'decor', 'meteo', 'chaussee', 'pneus', 'usure-pneus', 'strategie-stands', 'course', 'solides-physx', 'physique', 'traces']) require('../src/' + f + '.js');
const B = globalThis.BITUME, X = globalThis.FPhysX = await chargerPhysX(), DT = 1 / 120;
const NEUTRE = { gaz: 0, frein: 0, volant: 0, aide: 0, guidage: 0, boite: 'auto', marcheArriere: true };

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
  B.meteo.actuel = B.chaussee.preparer({ pluie: 0, mouille: 0, neigeSol: 0, fixe: true }, B.saisons.profil('ete', 'foret'));
  const co = B.course.creer(c, { mode: 'chrono', rivaux: 0, tours: 3, graine: 42 }); co.phase = 'course';
  Object.assign(co.joueur.etat, { s: 100, d: 0, v: 0 });
  B.physique.installer(co, decor);
  return { co, e: co.joueur.etat };
}
function drive(co, n, cmd) { for (let i = 0; i < n; i++) B.course.pas(co, { ...NEUTRE, ...cmd }, DT, []); }

test('PhysX (bug K) : après un recul, le gaz fait repartir en avant', () => {
  const { co, e } = fixture();
  try {
    drive(co, 150, { gaz: 1 });
    assert.ok(e.v > 2, 'doit avancer d\'abord, v=' + e.v.toFixed(2));
    drive(co, 200, { frein: 1 });
    assert.equal(e.rapport, -1, 'le recul s\'engage au frein maintenu à l\'arrêt');
    assert.ok(e.v < 0, 'la voiture recule, v=' + e.v.toFixed(2));
    const sBack = e.s;
    drive(co, 260, { gaz: 1 });
    assert.equal(e.rapport, 1, 'le gaz doit faire repasser en marche avant (bug K)');
    assert.ok(e.v > 1, 'la voiture accélère en avant, v=' + e.v.toFixed(2));
    assert.ok(e.s > sBack, 'la voiture avance au-delà du point de recul');
  } finally { B.physique.liberer(co); }
});
