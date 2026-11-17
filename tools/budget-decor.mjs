#!/usr/bin/env node
/* BITUME — budget du décor par biome et par palier. Node, sans dépendance, sans réseau, sans image ni son.
   Compte les lots, les objets, les triangles des formes libres et le détail végétal réellement produits.
   Sort avec un code non nul si deux paliers d'un même biome donnent le même décompte : l'option serait décorative. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const src = n => path.join(racine, 'src', n + '.js');

// Faux moteur : seule la déclaration des formes libres sert ici, pour compter leurs triangles.
const formes = new Map();
globalThis.FRender = { forme: (nom, triangles) => { formes.set(nom, triangles); return nom; } };

for (const n of ['carene', 'circuit', 'vegetation', 'decor']) require(src(n));
// Botanique est optionnel : le budget du décor ne doit rien à ce module s'il n'existe pas encore.
try { require(src('botanique.js')); } catch { /* absent */ }

const B = globalThis.BITUME;
const PALIERS = ['low', 'medium', 'high'];
// Graines fixes : le même tracé est comparé d'un palier à l'autre, aucune mesure ne dépend du hasard du jour.
const GRAINES = { foret: [11, 4200], cote: [29, 3600], montagne: [47, 5200] };

// Index des échantillons de l'axe, même maille que decor.js : la végétation juge l'accotement comme le décor.
function indexAxe(c) {
  const T = 40;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < c.n; i++) {
    const x = Math.floor(c.x[i] / T), z = Math.floor(c.z[i] / T);
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const nz = z1 - z0 + 1, cases = new Array((x1 - x0 + 1) * nz);
  for (let i = 0; i < c.n; i++) {
    const k = (Math.floor(c.x[i] / T) - x0) * nz + Math.floor(c.z[i] / T) - z0;
    let l = cases[k]; if (!l) cases[k] = l = []; l.push(i);
  }
  return (x, z, rayon) => {
    const cx = Math.floor(x / T), cz = Math.floor(z / T), r = Math.ceil(rayon / T);
    let meilleur = -1, d2min = Infinity;
    const amin = Math.max(cx - r, x0), amax = Math.min(cx + r, x1);
    const bmin = Math.max(cz - r, z0), bmax = Math.min(cz + r, z1);
    for (let a = amin; a <= amax; a++) for (let b = bmin; b <= bmax; b++) {
      const l = cases[(a - x0) * nz + b - z0]; if (!l) continue;
      for (const i of l) {
        const dx = c.x[i] - x, dz = c.z[i] - z, d2 = dx * dx + dz * dz;
        if (d2 < d2min) { d2min = d2; meilleur = i; }
      }
    }
    return { i: meilleur, d: Math.sqrt(d2min) };
  };
}

function mesurer(theme, graine, longueur, qualite) {
  const c = B.circuit.creer(graine, { theme, longueur });
  const d = B.decor.construire(c, { qualite, matieres: true, vegetation: true });
  // decor.js ne forwarding pas encore `qualite` à la végétation (pilote forêt, palier par défaut) : on écarte
  // ses lots végétaux et on mesure le module avec le palier demandé, pour que les trois lignes soient comparables.
  const lotsDecor = d.lots.filter(l => !l.vegetation);
  const v = B.vegetation.construire(c, { limites: d.limites, interroger: indexAxe(c), qualite });
  const lots = lotsDecor.concat(v.lots);
  const formesUtilisees = new Set();
  let objets = 0, rendus = 0;
  const inconnues = new Set();
  for (const l of lots) for (const o of l.objets) {
    objets++;
    const t = formes.get(o.shape);
    if (t === undefined) { inconnues.add(o.shape); continue; }
    if (!formesUtilisees.has(o.shape)) formesUtilisees.add(o.shape);
    rendus += t.length;
  }
  let trianglesFormes = 0;
  for (const nom of formesUtilisees) trianglesFormes += formes.get(nom).length;
  return {
    biome: theme, graine, longueur, qualite,
    lots: lots.length, objets,
    formesUniques: formesUtilisees.size, trianglesFormes, trianglesRendus: rendus,
    primitivesMoteur: inconnues.size,
    vegetation: { herbes: v.herbes, fougeres: v.fougeres, fleurs: v.fleurs, taillis: v.taillis, lots: v.lots.length },
    qualiteDemandee: qualite, qualiteAppliquee: v.qualite,
  };
}

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const iSortie = argv.indexOf('--sortie');
const sortie = iSortie >= 0 ? argv[iSortie + 1] : null;

const biomes = Object.keys(B.decor.THEMES);
const rapport = { genere: 'tools/budget-decor.mjs', biomes: {}, lignes: [] };
for (const [i, biome] of biomes.entries()) {
  const [graine, longueur] = GRAINES[biome] || [13 + i, 4000];
  rapport.biomes[biome] = { graine, longueur };
  for (const qualite of PALIERS) rapport.lignes.push(mesurer(biome, graine, longueur, qualite));
}

const cle = l => [l.lots, l.objets, l.formesUniques, l.trianglesFormes, l.trianglesRendus,
  l.vegetation.herbes, l.vegetation.fougeres, l.vegetation.fleurs, l.vegetation.taillis].join('|');

let conflits = 0;
if (json) {
  console.log(JSON.stringify(rapport, null, 2));
} else {
  const entetes = ['biome', 'palier', 'lots', 'objets', 'formes', 'triFormes', 'triRendus', 'herbes', 'fougères', 'fleurs', 'taillis'];
  const lignes = rapport.lignes.map(l => [l.biome, l.qualite, String(l.lots), String(l.objets), String(l.formesUniques),
    String(l.trianglesFormes), String(l.trianglesRendus), String(l.vegetation.herbes), String(l.vegetation.fougeres),
    String(l.vegetation.fleurs), String(l.vegetation.taillis)]);
  const largeurs = entetes.map((h, i) => Math.max(h.length, ...lignes.map(l => l[i].length)));
  const ligne = c => c.map((v, i) => v.padEnd(largeurs[i])).join('  ');
  console.log(ligne(entetes));
  console.log(largeurs.map(w => '-'.repeat(w)).join('  '));
  for (const l of lignes) console.log(ligne(l));
}

for (const biome of biomes) {
  const lignes = rapport.lignes.filter(l => l.biome === biome);
  for (let i = 0; i < lignes.length; i++) for (let j = i + 1; j < lignes.length; j++) {
    if (cle(lignes[i]) === cle(lignes[j])) {
      conflits++;
      console.error(`conflit : ${biome} — les paliers ${lignes[i].qualite} et ${lignes[j].qualite} donnent le même décompte (${cle(lignes[i])})`);
    }
  }
}

if (sortie) {
  const chemin = path.resolve(sortie);
  mkdirSync(path.dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify({ ...rapport, conflits }, null, 2) + '\n');
  if (!json) console.log(`rapport écrit : ${chemin}`);
}

if (!json && conflits) console.error(`${conflits} conflit(s) : la qualité n'a pas d'effet réel sur ce biome.`);
process.exit(conflits ? 1 : 0);
