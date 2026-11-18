// Herbier : vérification du cache de découpe entre saisons (bit-à-bit).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const n of ['circuit', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'decor']) require('../src/' + n + '.js');
const B = globalThis.BITUME;

const circuitsSaisons = [
  { nom: 'Val-Brûlé', theme: 'foret', graine: 11, longueur: 4200 },
  { nom: 'Port-Sable', theme: 'cote', graine: 29, longueur: 3600 },
  { nom: 'Haut-Col', theme: 'montagne', graine: 47, longueur: 5200 },
  { nom: 'Brume-de-Jade', theme: 'asie', graine: 131, longueur: 5000 },
  { nom: 'Cap-Séquoia', theme: 'pacifique', graine: 157, longueur: 5200 }
];
const circuitGeometrie = { nom: 'Roche-Fauve', theme: 'desert', graine: 107, longueur: 4800 };
const saisonsOrdre = ['ete', 'automne', 'hiver', 'printemps', 'ete'];

const buf64 = new Float64Array(24);

function empreinteTriangles(h) {
  const hash = createHash('sha256');
  const totaux = new Float64Array(7);
  totaux[0] = h.aireBrute;
  totaux[1] = h.aire;
  totaux[2] = h.aireAccotements;
  totaux[3] = h.aireTerrain;
  totaux[4] = h.trianglesSources;
  totaux[5] = h.masques;
  totaux[6] = h.triangles.length;
  hash.update(Buffer.from(totaux.buffer));
  
  for (const t of h.triangles) {
    buf64[0] = t.points[0][0]; buf64[1] = t.points[0][1]; buf64[2] = t.points[0][2];
    buf64[3] = t.points[1][0]; buf64[4] = t.points[1][1]; buf64[5] = t.points[1][2];
    buf64[6] = t.points[2][0]; buf64[7] = t.points[2][1]; buf64[8] = t.points[2][2];
    buf64[9] = t.aire;
    buf64[10] = t.normal[0]; buf64[11] = t.normal[1]; buf64[12] = t.normal[2];
    buf64[13] = t.color[0]; buf64[14] = t.color[1]; buf64[15] = t.color[2];
    buf64[16] = t.plan.dx; buf64[17] = t.plan.dz; buf64[18] = t.plan.h; buf64[19] = t.plan.len;
    buf64[20] = t.boite.x0; buf64[21] = t.boite.x1; buf64[22] = t.boite.z0; buf64[23] = t.boite.z1;
    hash.update(Buffer.from(buf64.buffer));
    hash.update(t.type + ';');
  }
  return hash.digest('hex');
}

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function genererPoints(avant) {
  const points = [];
  if (avant.triangles.length === 0) return points;
  
  // Centre des triangles
  for (const t of avant.triangles) {
    const cx = (t.points[0][0] + t.points[1][0] + t.points[2][0]) / 3;
    const cz = (t.points[0][2] + t.points[1][2] + t.points[2][2]) / 3;
    points.push([cx, cz]);
  }
  
  // Boîte englobante
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const t of avant.triangles) {
    if (t.boite.x0 < x0) x0 = t.boite.x0;
    if (t.boite.x1 > x1) x1 = t.boite.x1;
    if (t.boite.z0 < z0) z0 = t.boite.z0;
    if (t.boite.z1 > z1) z1 = t.boite.z1;
  }
  x0 -= 10; x1 += 10; z0 -= 10; z1 += 10;
  
  const rand = mulberry32(12345);
  for (let i = 0; i < 20000; i++) {
    const x = x0 + rand() * (x1 - x0);
    const z = z0 + rand() * (z1 - z0);
    points.push([x, z]);
  }
  return points;
}

const bufSurf = new Float64Array(8);

function empreinteSurface(h, points) {
  const hash = createHash('sha256');
  const sortie = {};
  for (const [x, z] of points) {
    const res = h.surface(x, z, sortie);
    if (res === null) {
      hash.update('n;');
    } else {
      bufSurf[0] = sortie.y;
      bufSurf[1] = sortie.normal[0]; bufSurf[2] = sortie.normal[1]; bufSurf[3] = sortie.normal[2];
      bufSurf[4] = sortie.color[0]; bufSurf[5] = sortie.color[1]; bufSurf[6] = sortie.color[2];
      hash.update(Buffer.from(bufSurf.buffer));
      hash.update(sortie.type + ';');
    }
  }
  return hash.digest('hex');
}

const opts = { qualite: 'high', matieres: true, vegetation: false };
let controles = 0;

// 1. Circuits à géométrie stable : cache de découpe
for (const c of circuitsSaisons) {
  const circuit = B.circuit.creer(c.graine, { theme: c.theme, longueur: c.longueur });
  const d0 = B.decor.comptesHerbier.decoupes;
  const r0 = B.decor.comptesHerbier.reprises;
  const herbiers = [];
  let empreinteEte1 = null;

  for (let i = 0; i < saisonsOrdre.length; i++) {
    const s = saisonsOrdre[i];
    const d = B.decor.construire(circuit, { ...opts, saison: s });
    const h = d.herbier;
    herbiers.push(h);
    const dd = B.decor.comptesHerbier.decoupes - d0;
    const rr = B.decor.comptesHerbier.reprises - r0;

    if (i === 0) {
      assert.strictEqual(dd, 1, 'découpe initiale');
      assert.strictEqual(rr, 0, 'pas de reprise initiale');
      empreinteEte1 = empreinteTriangles(h);
    } else {
      assert.strictEqual(rr, i, 'reprise attendue');
      assert.strictEqual(dd, 1, 'pas de nouvelle découpe');
    }
  }

  // Vérification palette (été vs hiver)
  assert.notStrictEqual(empreinteTriangles(herbiers[0]), empreinteTriangles(herbiers[2]), 'palette différente');

  // Vérification bit-à-bit contre zéro
  for (let i = 0; i < saisonsOrdre.length; i++) {
    const s = saisonsOrdre[i];
    const c2 = B.circuit.creer(c.graine, { theme: c.theme, longueur: c.longueur });
    const d2 = B.decor.construire(c2, { ...opts, saison: s });
    const h2 = d2.herbier;
    
    assert.strictEqual(empreinteTriangles(herbiers[i]), empreinteTriangles(h2), 'triangles identiques');
    const pts = genererPoints(h2);
    assert.strictEqual(empreinteSurface(herbiers[i], pts), empreinteSurface(h2, pts), 'surface identique');
  }

  // Vérification retour été
  assert.strictEqual(empreinteTriangles(herbiers[0]), empreinteEte1, 'été stable');
  assert.strictEqual(empreinteTriangles(herbiers[4]), empreinteEte1, 'second été identique');
  
  controles++;
  console.log(`ok saisons ${c.nom} : ${saisonsOrdre.length} saisons, 1 découpe, ${saisonsOrdre.length - 1} reprises, identiques au bit`);
}

// 2. Roche-Fauve : géométrie changeante (hiver)
{
  const c = circuitGeometrie;
  const circuit = B.circuit.creer(c.graine, { theme: c.theme, longueur: c.longueur });
  const d0 = B.decor.comptesHerbier.decoupes;
  const r0 = B.decor.comptesHerbier.reprises;
  
  const dEte = B.decor.construire(circuit, { ...opts, saison: 'ete' });
  const hEte = dEte.herbier;
  assert.strictEqual(B.decor.comptesHerbier.decoupes - d0, 1, 'été découpe');
  assert.strictEqual(B.decor.comptesHerbier.reprises - r0, 0, 'été pas reprise');
  const masquesEte = hEte.masques;

  const dHiver = B.decor.construire(circuit, { ...opts, saison: 'hiver' });
  const hHiver = dHiver.herbier;
  assert.strictEqual(B.decor.comptesHerbier.decoupes - d0, 2, 'hiver découpe (géométrie change)');
  assert.strictEqual(B.decor.comptesHerbier.reprises - r0, 0, 'hiver pas reprise');
  assert.notStrictEqual(hHiver.masques, masquesEte, 'masques différents');

  // Comparaison zéro
  const c2 = B.circuit.creer(c.graine, { theme: c.theme, longueur: c.longueur });
  const d2 = B.decor.construire(c2, { ...opts, saison: 'hiver' });
  const h2 = d2.herbier;
  
  assert.strictEqual(empreinteTriangles(hHiver), empreinteTriangles(h2), 'hiver identique zéro');
  const pts = genererPoints(h2);
  assert.strictEqual(empreinteSurface(hHiver, pts), empreinteSurface(h2, pts), 'surface hiver identique zéro');

  controles++;
  console.log(`ok saisons ${c.nom} : l'hiver refait la découpe (masques ${masquesEte} → ${hHiver.masques})`);
}

console.log(`herbier-saisons : ${controles} circuits contrôlés`);
