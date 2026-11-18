#!/usr/bin/env node
// Lot 28 « calcul » — banc de l'herbier (creerHerbier de src/decor.js) : original contre JavaScript resserré
// (herbier-serre.js) et noyau C compilé en WebAssembly (herbier.c), sur les vrais arguments d'un vrai niveau.
// Vérifie l'identité au bit près des triangles produits et des réponses de surface(x, z).
//
//   node --expose-gc prototypes/calcul/herbier/banc-herbier.mjs --circuit 2 --reps 5 [--wasm herbier.wasm] [--sortie f.json]
import vm from 'node:vm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url)), racine = path.resolve(ici, '..', '..', '..');
const require = createRequire(import.meta.url);
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const CATALOGUE = [['foret', 11, 4200], ['cote', 29, 3600], ['montagne', 47, 5200], ['islande', 83, 4600], ['desert', 107, 4800], ['asie', 131, 5000], ['pacifique', 157, 5200]];
const ci = Number(arg('circuit', 2)), reps = Number(arg('reps', 5));
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

// modules, avec capture des arguments du premier appel de creerHerbier
globalThis.__capturer = f => function (...a) { if (!globalThis.__herbier) globalThis.__herbier = { f, args: a }; return f.apply(this, a); };
vm.runInThisContext(readFileSync(path.join(racine, 'src/moteur/renderer.js'), 'utf8'));
for (const m of ['graphismes', 'carene', 'circuit', 'botanique', 'ecologie', 'saisons', 'vegetation', 'decor']) {
  let code = readFileSync(path.join(racine, 'src', m + '.js'), 'utf8');
  if (m === 'decor') code = code.replace('  B.decor = { construire,', '  creerHerbier = __capturer(creerHerbier);\n  B.decor = { construire,');
  vm.runInThisContext(code, { filename: m + '.js' });
}
const B = globalThis.BITUME;
const [theme, graine, longueur] = CATALOGUE[ci];
const c = B.circuit.creer(graine, { theme, longueur });
const veut = B.graphismes.melange('high', 0, { decor: 'high', options: { vegetation: 'profil' } }).decor;
const decor = B.decor.construire(c, { qualite: 'high', matieres: veut.matieres, vegetation: veut.vegetation, vegetationQualite: veut.vegetationQualite, saison: 'ete' });
void decor.herbier;
const { f: original, args } = globalThis.__herbier;
const { creerHerbierSerre, preparer, noyauJS, finir } = require('./herbier-serre.js');
const serre = creerHerbierSerre(B);

// noyau WebAssembly (facultatif)
let noyauWasm = null, wasmInfo = null;
if (arg('wasm')) {
  const octets = readFileSync(arg('wasm'));
  const t0 = performance.now(); const module = new WebAssembly.Module(octets); const t1 = performance.now();
  noyauWasm = require('./noyau-wasm.js').creer(module);
  wasmInfo = { fichier: path.basename(arg('wasm')), octets: octets.length, base64: Math.ceil(octets.length / 3) * 4, compilationMs: +(t1 - t0).toFixed(2), instanciationMs: +noyauWasm.instanciationMs.toFixed(2) };
}
const wasm = noyauWasm ? (cc, nappes, lots, lim, enceinte, eau) => { const D = preparer(B, cc, nappes, lots, lim, enceinte, eau); return finir(D, noyauWasm(D)); } : null;

// identité au bit près
function comparer(a, b) {
  const pb = [];
  for (const k of ['aireBrute', 'aire', 'aireAccotements', 'aireTerrain', 'trianglesSources', 'masques']) if (!Object.is(a[k], b[k])) pb.push(k + ' ' + a[k] + ' ≠ ' + b[k]);
  if (a.triangles.length !== b.triangles.length) pb.push('triangles ' + a.triangles.length + ' ≠ ' + b.triangles.length);
  const n = Math.min(a.triangles.length, b.triangles.length);
  for (let i = 0; i < n && pb.length < 8; i++) {
    const x = a.triangles[i], y = b.triangles[i];
    for (let p = 0; p < 3; p++) for (let k = 0; k < 3; k++) if (!Object.is(x.points[p][k], y.points[p][k])) { pb.push(`t${i} p${p}${k} ${x.points[p][k]} ≠ ${y.points[p][k]}`); break; }
    if (!Object.is(x.aire, y.aire) || x.type !== y.type || x.plan.h !== y.plan.h || x.plan.len !== y.plan.len || x.normal.some((v, k) => !Object.is(v, y.normal[k])) || x.color.some((v, k) => !Object.is(v, y.color[k]))) pb.push('t' + i + ' aire/type/plan/couleur');
    for (const k of ['x0', 'x1', 'z0', 'z1']) if (!Object.is(x.boite[k], y.boite[k])) pb.push('t' + i + ' boite ' + k);
  }
  return pb;
}
const refO = original(...args), refS = serre(...args), refW = wasm ? wasm(...args) : null;
const identite = { serre: comparer(refO, refS), wasm: refW ? comparer(refO, refW) : null };
// réponses de surface(x, z) sur 200 000 points tirés dans la boîte des triangles
let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
for (const t of refO.triangles) { x0 = Math.min(x0, t.boite.x0); x1 = Math.max(x1, t.boite.x1); z0 = Math.min(z0, t.boite.z0); z1 = Math.max(z1, t.boite.z1); }
let a = 12345; const alea = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const PTS = new Float64Array(400000); for (let i = 0; i < PTS.length; i += 2) { PTS[i] = x0 + alea() * (x1 - x0); PTS[i + 1] = z0 + alea() * (z1 - z0); }
let ecartsSurface = 0, touches = 0;
{ const s1 = {}, s2 = {}; for (let i = 0; i < PTS.length; i += 2) { const r1 = refO.surface(PTS[i], PTS[i + 1], s1), r2 = refS.surface(PTS[i], PTS[i + 1], s2);
  if (!!r1 !== !!r2 || (r1 && (!Object.is(s1.y, s2.y) || s1.type !== s2.type || s1.normal !== s2.normal && s1.normal.some((v, k) => !Object.is(v, s2.normal[k]))))) ecartsSurface++; if (r1) touches++; } }

// chronos alternés, temps processeur du fil
const temps = { original: [], serre: [], wasm: [], serrePreparer: [], serreNoyau: [], serreFinir: [], wasmNoyau: [], surfaceOriginal: [], surfaceSerre: [] };
for (let r = 0; r < reps; r++) {
  global.gc(); let t = cpu(); original(...args); temps.original.push(cpu() - t);
  global.gc(); t = cpu(); const D = preparer(B, ...args); const t1 = cpu(); const OUT = noyauJS(D); const t2 = cpu(); finir(D, OUT); const t3 = cpu();
  temps.serre.push(t3 - t); temps.serrePreparer.push(t1 - t); temps.serreNoyau.push(t2 - t1); temps.serreFinir.push(t3 - t2);
  if (noyauWasm) { global.gc(); t = cpu(); const D2 = preparer(B, ...args); const u1 = cpu(); const O2 = noyauWasm(D2); const u2 = cpu(); finir(D2, O2); temps.wasm.push(cpu() - t); temps.wasmNoyau.push(u2 - u1); }
  const s = {}; t = cpu(); for (let i = 0; i < PTS.length; i += 2) refO.surface(PTS[i], PTS[i + 1], s); temps.surfaceOriginal.push(cpu() - t);
  t = cpu(); for (let i = 0; i < PTS.length; i += 2) refS.surface(PTS[i], PTS[i + 1], s); temps.surfaceSerre.push(cpu() - t);
}
const resume = {};
for (const [k, v] of Object.entries(temps)) if (v.length) resume[k] = { med: +med(v).toFixed(1), min: +Math.min(...v).toFixed(1), max: +Math.max(...v).toFixed(1) };
const sortie = { date: new Date().toISOString(), node: process.version, charge: os.loadavg().map(x => +x.toFixed(1)), circuit: ci, theme, reps,
  volumes: { triangles: refO.triangles.length, sources: refO.trianglesSources, masques: refO.masques, pointsSurface: PTS.length / 2, pointsSurHerbe: touches },
  identite, ecartsSurface, wasm: wasmInfo, tempsMs: resume, unite: 'ms de processeur du fil principal (process.threadCpuUsage), médiane de ' + reps + ' essais alternés ; surface = 200 000 requêtes' };
if (arg('sortie')) writeFileSync(arg('sortie'), JSON.stringify(sortie, null, 1));
console.log(JSON.stringify(sortie, null, 1));
