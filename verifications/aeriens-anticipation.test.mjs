// Lot J : anticipation d'obstacles / relief par l'hélicoptère et les drones TV,
// vol bas sans téléportation et séparation de secteurs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
for (const f of ['circuit', 'obstacles', 'aeriens']) require('../src/' + f + '.js');
const B = globalThis.BITUME;

function circuitDroit(longueur = 2400) {
  const pas = 2, n = Math.floor(longueur / pas);
  const x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n);
  const cap = new Float64Array(n), courbure = new Float64Array(n), pente = new Float64Array(n), devers = new Float64Array(n);
  for (let i = 0; i < n; i++) { x[i] = i * pas; }
  return { n, pas, longueur, largeur: 12, x, y, z, cap, courbure, pente, devers, ouvert: true };
}

test('Lot J · anticipation d’une crête ou d’un obstacle haut avant contact', () => {
  const c = circuitDroit(2400);
  // Une barre rocheuse haute de 36 m placée à x = 520..620 m (loin de la zone de croisière 140..200 m)
  const sol = (x) => (x >= 520 && x <= 620) ? 36 : 0;
  const etat = B.aeriens.creer(c);
  const sortie = [];
  let yCroisiere = 0, yAvantCrete = 0, ySurCrete = 0;
  let sautMax = 0, prevH = null;
  for (let i = 0; i <= 780; i++) {
    const t = i / 60;
    sortie.length = 0;
    const sTete = 80 + t * 50; // 50 m/s vers la crête (x = 520 atteint à t ≈ 8.8 s)
    B.aeriens.dessiner(etat, t, { sTete, sDernier: sTete - 180, sol, qualite: 'high', nuit: 0 }, sortie);
    const p = etat.volH.pos;
    if (prevH) sautMax = Math.max(sautMax, Math.hypot(p[0] - prevH[0], p[1] - prevH[1], p[2] - prevH[2]));
    prevH = p.slice();
    if (p[0] >= 140 && p[0] <= 200) yCroisiere = Math.max(yCroisiere, p[1]);
    if (p[0] >= 420 && p[0] <= 495) yAvantCrete = Math.max(yAvantCrete, p[1]);
    if (p[0] >= 525 && p[0] <= 615) ySurCrete = Math.max(ySurCrete, p[1]);
    // Jamais sous le plancher de sécurité local (sol + 13 m pour l'hélicoptère)
    assert.ok(p[1] >= sol(p[0], p[2]) + 12.9, `hélico sous le relief à x=${p[0].toFixed(1)} : y=${p[1].toFixed(2)}`);
  }
  assert.ok(yCroisiere > 12 && yCroisiere < 24, `vol de croisière doit rester bas (12..24 m), reçu ${yCroisiere.toFixed(1)}`);
  assert.ok(yAvantCrete > yCroisiere + 8, `l’hélico doit anticiper la crête avant x=495 (croisière=${yCroisiere.toFixed(1)}, avant=${yAvantCrete.toFixed(1)})`);
  assert.ok(ySurCrete >= 49, `l’hélico doit franchir la crête de 36 m avec marge (reçu ${ySurCrete.toFixed(1)})`);
  assert.ok(sautMax < 2.5, `aucune téléportation autorisée (pas max = ${sautMax.toFixed(2)} m)`);
});

test('Lot J · séparation des secteurs entre hélicoptère et deux drones TV', () => {
  const c = circuitDroit(3000);
  const sol = () => 0;
  const etat = B.aeriens.creer(c);
  const sortie = [];
  let distMinHD0 = Infinity, distMinHD1 = Infinity, distMinD01 = Infinity;
  for (let i = 0; i <= 900; i++) {
    const t = i / 60;
    sortie.length = 0;
    const sTete = 300 + t * 55;
    B.aeriens.dessiner(etat, t, { sTete, sDernier: sTete - 260, sol, qualite: 'high', nuit: 0 }, sortie);
    if (i > 60) {
      const h = etat.volH.pos, d0 = etat.volD[0].pos, d1 = etat.volD[1].pos;
      distMinHD0 = Math.min(distMinHD0, Math.hypot(h[0] - d0[0], h[1] - d0[1], h[2] - d0[2]));
      distMinHD1 = Math.min(distMinHD1, Math.hypot(h[0] - d1[0], h[1] - d1[1], h[2] - d1[2]));
      distMinD01 = Math.min(distMinD01, Math.hypot(d0[0] - d1[0], d0[1] - d1[1], d0[2] - d1[2]));
    }
  }
  assert.ok(distMinHD0 > 40, `hélico et drone 0 trop proches : ${distMinHD0.toFixed(1)} m`);
  assert.ok(distMinHD1 > 40, `hélico et drone 1 trop proches : ${distMinHD1.toFixed(1)} m`);
  assert.ok(distMinD01 > 120, `drones 0 et 1 trop proches : ${distMinD01.toFixed(1)} m`);
});

test('Lot J · anticipation d’un obstacle haut (arbre/portique) dans l’index obstacles', () => {
  const c = circuitDroit(2000);
  const obstacles = B.obstacles.creer([
    { type: 'circle', x: 340, z: 16, r: 4, ymin: 0, ymax: 32, genre: 'tronc' }
  ]);
  c.obstacles = obstacles;
  const etat = B.aeriens.creer(c);
  const sortie = [];
  let yAvant = 0;
  for (let i = 0; i <= 420; i++) {
    const t = i / 60;
    sortie.length = 0;
    const sTete = 100 + t * 48;
    B.aeriens.dessiner(etat, t, { sTete, sDernier: sTete - 180, sol: () => 0, qualite: 'high', nuit: 0 }, sortie);
    const d0 = etat.volD[0].pos;
    if (d0[0] >= 280 && d0[0] <= 325) yAvant = Math.max(yAvant, d0[1]);
    if (Math.hypot(d0[0] - 340, d0[2] - 16) < 18) {
      assert.ok(d0[1] >= 43.5, `drone 0 trop bas près de l’arbre 32 m : y=${d0[1].toFixed(2)}`);
    }
  }
  assert.ok(yAvant > 18, `drone 0 doit amorcer la montée avant l’obstacle haut (reçu ${yAvant.toFixed(1)})`);
});
