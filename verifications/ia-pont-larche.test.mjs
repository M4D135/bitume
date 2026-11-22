// Passage d'un parapet du Col de Larche par un rival piloté en PhysX sous la pluie.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'route-des-cimes', 'larche-vinadio-data', 'larche-vinadio',
  'larche-vinadio-decor', 'carene', 'botanique', 'ecologie', 'saisons', 'bords', 'decor',
  'conduite', 'contacts', 'degats', 'obstacles', 'course', 'solides-physx', 'physique', 'meteo']) require('../src/' + f + '.js');
const B = globalThis.BITUME;

test('le rival coincé en travers du pont à 11 429,77 m ressort et dépasse le tablier', async () => {
  globalThis.FPhysX = await chargerPhysX();
  const c = B.larche.creer(210);
  const decor = B.decor.construire(c, { qualite: 'low', organique: true, vegetation: false });
  c.obstacles = B.obstacles.creer(decor.obstacles);
  const avant = B.meteo.actuel, pluie = B.meteo.pour('pluie');
  pluie.mouille = 1; B.meteo.actuel = pluie;
  const co = B.course.creer(c, { graine: 23731, mode: 'course', rivaux: 1, difficulte: 1 });
  try {
    B.physique.installer(co, decor);
    const rival = co.voitures[1], e = rival.etat;
    const depart = 11429.77, pont = c.ponts.find(p => p.debut < depart && p.fin > depart);
    assert.ok(pont, 'le point de départ se trouve sur le tablier');
    co.phase = 'course'; co.temps = 500; co.horloge = 510;
    co.joueur.etat.s = depart - 400;
    Object.assign(e, { s: depart, d: 4.8, psi: 1.35, v: 4 });
    B.pneus.remplacerEtat(e, 'pluie', { seance: 23731, voiture: 1 });
    B.physique.repositionner(co);
    const frein = { gaz: 0, frein: 1, volant: 0, boite: 'auto' }, ev = [];
    let procheArret = false, tentatives = false;
    for (let i = 0; i < 45 * 120 && e.s < pont.fin + 100; ++i) {
      B.course.pas(co, frein, 1 / 120, ev);
      if (Math.abs(e.v) < 1 && e.s < pont.fin && e._physx.groundCount > 0) procheArret = true;
      if (rival.ia.degagement || rival.ia.bloque > 1) tentatives = true;
    }
    assert.ok(procheArret, 'le rival a rencontré le parapet');
    assert.ok(tentatives, 'le pilote a détecté son absence de progression');
    assert.ok(e.s >= pont.fin + 100, 'le rival reste près du parapet à s = ' + e.s);
    assert.equal(rival.abandon, false);
  } finally { B.physique.liberer(co); B.meteo.actuel = avant; }
});
