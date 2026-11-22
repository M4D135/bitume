// Vérifie l'envolée logique pneu contre pneu (style Vroom / F1 open-wheel) dans le vrai PhysX WASM.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chargerPhysX } from './helpers/physx-runtime.mjs';

const req = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'carene', 'decor', 'solides-physx', 'conduite', 'physique', 'course']) {
  req('../src/' + f + '.js');
}
const B = globalThis.BITUME;
const X = await chargerPhysX();
globalThis.FPhysX = X;

function creerCourseDeuxVoitures(vA, vB, ds, dd) {
  const c = B.circuit.creer(11, { theme: 'plaine', longueur: 3600 });
  const decor = B.decor.construire(c, { qualite: 'low', vegetation: false });
  const co = B.course.creer(c, { tours: 1, nb: 2, graine: 1 });
  co.depart = 0; // départ lancé immédiat
  co.voitures[0].etat.s = 200; co.voitures[0].etat.d = 0; co.voitures[0].etat.v = vA;
  co.voitures[1].etat.s = 200 + ds; co.voitures[1].etat.d = dd; co.voitures[1].etat.v = vB;
  B.physique.installer(co, decor);
  return { co, c };
}

try {
  // 1. Engrenage roue avant droite sur roue arrière gauche à 195 km/h (54 m/s vs 44 m/s) :
  //    d_avant_droite = +0.85, d_arriere_gauche = dd - 0.8075 => dd = +1.55 met les deux pneus en collision directe !
  {
    const { co } = creerCourseDeuxVoitures(54, 40, 5.0, 1.55);
    let maxY = -Infinity, maxVy = 0, maxTangage = -Infinity, envol = null;
    const y0 = co.voitures[0].etat.y;
    try {
      for (let k = 0; k < 180; k++) {
        const ev = [];
        B.physique.avant(co, 1 / 120);
        co.voitures[0].etat.gaz = 1; co.voitures[1].etat.gaz = 0.6;
        B.physique.pas(co, 1 / 120, ev);
        const e0 = co.voitures[0].etat, ph0 = e0._physx;
        if (e0.y > maxY) maxY = e0.y;
        if (ph0.velocity[1] > maxVy) maxVy = ph0.velocity[1];
        if (e0.tangage > maxTangage) maxTangage = e0.tangage;
        const found = ev.find(x => x.type === 'envol' && x.id === 0);
        if (found) envol = found;
      }
      const sautM = maxY - y0;
      console.log(`ok engrenage pneu AV/AR 195 km/h : saut=${sautM.toFixed(2)}m, maxVy=${maxVy.toFixed(2)}m/s, maxTangage=${(maxTangage * 180 / Math.PI).toFixed(1)}°, envol=`, envol);
      assert.ok(envol, 'un événement envol est émis au contact pneu contre pneu');
      assert.ok(sautM > 0.65 && sautM < 6.0, `saut réaliste attendu entre 0.65 m et 6 m, obtenu ${sautM.toFixed(2)} m`);
      assert.ok(maxVy > 3.5 && maxVy < 12.0, `vitesse verticale logique attendue, obtenue ${maxVy.toFixed(2)} m/s`);
      assert.ok(maxTangage > 0.08, `le nez doit cabrer vers le haut (tangage > 0), obtenu ${(maxTangage * 180 / Math.PI).toFixed(1)}°`);
    } finally {
      B.physique.liberer(co);
    }
  }

  // 2. À basse vitesse (35 km/h = 10 m/s), un petit contact ne fait PAS s'envoler la voiture.
  {
    const { co } = creerCourseDeuxVoitures(10, 6, 3.8, 1.55);
    let envol = null, maxY = -Infinity;
    const y0 = co.voitures[0].etat.y;
    for (let k = 0; k < 120; k++) {
      const ev = [];
      B.physique.avant(co, 1 / 120);
      B.physique.pas(co, 1 / 120, ev);
      if (co.voitures[0].etat.y > maxY) maxY = co.voitures[0].etat.y;
      const found = ev.find(x => x.type === 'envol');
      if (found) envol = found;
    }
    console.log(`ok basse vitesse 35 km/h : aucun envol (saut=${(maxY - y0).toFixed(2)}m)`);
    assert.equal(envol, null, 'aucun envol à basse vitesse');
    assert.ok(maxY - y0 < 0.35, 'pas de saut excessif à basse vitesse');
    B.physique.liberer(co);
  }

  // 3. Sans contact (deux voies séparées à 195 km/h), aucun envol.
  {
    const { co } = creerCourseDeuxVoitures(54, 44, 3.8, 3.5);
    let envol = null;
    for (let k = 0; k < 120; k++) {
      const ev = [];
      B.physique.avant(co, 1 / 120);
      B.physique.pas(co, 1 / 120, ev);
      const found = ev.find(x => x.type === 'envol');
      if (found) envol = found;
    }
    assert.equal(envol, null, 'aucun envol sans contact');
    console.log('ok voies séparées : aucun faux envol');
    B.physique.liberer(co);
  }

  console.log('envol-pneu : 3 vérifications passées');
} finally {
  X.dispose();
}
