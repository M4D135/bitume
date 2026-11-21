#!/usr/bin/env node
// Mesure CPU comparative des modules seuls, Canvas sans raster et vrai PhysX embarqué.
// Aucun gain FPS, GPU ou matériel de jeu n'est déduit de ces mesures.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { chargerPhysX } from '../verifications/helpers/physx-runtime.mjs';
const req = createRequire(import.meta.url), args = process.argv.slice(2), opts = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(/^--(parent|prototype|candidat|sortie|images|series)$/.test(args[i]), 'option inconnue : ' + args[i]);
  assert.ok(args[i + 1], 'valeur manquante : ' + args[i]); opts[args[i].slice(2)] = args[i + 1];
}
assert.ok(opts.parent && opts.prototype && opts.candidat && opts.sortie,
  'Usage : node tools/mesurer-pluie-abris.mjs --parent F --prototype F --candidat F --sortie F [--images 120 --series 5]');
const images = Number(opts.images || 120), series = Number(opts.series || 5);
assert.ok(Number.isInteger(images) && images >= 60 && images <= 3000);
assert.ok(Number.isInteger(series) && series >= 3 && series <= 15);
for (const f of ['circuit', 'couverts', 'carene', 'decor', 'solides-physx']) req('../src/' + f + '.js');
const B = globalThis.BITUME, X = await chargerPhysX();
const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200 }), tunnel = c.tunnel;
c.couverts = [
  { ...tunnel, id: 'premier', type: 'tunnel', fin: tunnel.debut + 78 },
  { ...tunnel, id: 'galerie', type: 'galerie', ouvert: 'G', debut: tunnel.debut + 100, fin: tunnel.debut + 154 },
  { ...tunnel, id: 'second', type: 'tunnel', debut: tunnel.debut + 186 }
];
const decor = B.decor.construire(c, { qualite: 'low', vegetation: false });
const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1 }), solids = B.solidesPhysX.installer(world, c, decor);
const physique = { world, solids }, rayon = world.raycast; let rayons = 0;
world.raycast = function (a, b, d, options, hit) { rayons++; return rayon.call(this, a, b, d, options, hit); };
const variants = ['parent', 'prototype', 'candidat'].map(nom => {
  const source = readFileSync(resolve(opts[nom]), 'utf8'), contexte = { BITUME: { ...B } };
  new Function('globalThis', source)(contexte);
  return { nom, sha256: createHash('sha256').update(source).digest('hex'), module: contexte.BITUME.meteo };
});
function camera(s, angle = 0, hauteur = 1.2, lateral = 0) {
  const p = B.circuit.echantillon(c, s);
  return { pos: [p.x - Math.sin(p.cap) * lateral, p.y + hauteur, p.z + Math.cos(p.cap) * lateral],
    yaw: p.cap + Math.PI / 2 + angle, pitch: 0, fov: 70 };
}
function toile(signature = false) {
  const bits = new DataView(new ArrayBuffer(8)); let hash = 2166136261, traits = 0, effacements = 0, x = 0, y = 0;
  function ajouter(v) { bits.setFloat64(0, v, true); hash = Math.imul(hash ^ bits.getUint32(0, true), 16777619); hash = Math.imul(hash ^ bits.getUint32(4, true), 16777619); }
  const ctx = { globalAlpha: 1, setTransform() {}, clearRect() { effacements++; }, beginPath() {}, stroke() {},
    moveTo(a, b) { x = a; y = b; }, lineTo(a, b) { traits++; if (signature) { ajouter(x); ajouter(y); ajouter(a); ajouter(b); } } };
  return { width: 960, height: 540, clientWidth: 960, clientHeight: 540, style: {}, getContext: () => ctx,
    bilan: () => ({ traits, effacements, fnv1a32CoordonneesFloat64: (hash >>> 0).toString(16).padStart(8, '0') }) };
}
const scenarios = [
  ['dehors', () => camera(0), 'high', 1],
  ['fond-tunnel', () => camera(tunnel.debut + 39), 'high', 1],
  ['portail', () => camera(tunnel.debut + 3, Math.PI), 'high', 1],
  ['galerie-ouverte', () => camera(tunnel.debut + 127, -Math.PI / 2), 'high', 1],
  ['galerie-mur', () => camera(tunnel.debut + 127, Math.PI / 2), 'high', 1],
  ['galerie-ouverte-low', () => camera(tunnel.debut + 127, -Math.PI / 2), 'low', 1],
  ['galerie-flou-300', i => camera(tunnel.debut + 103 + (i % 16) * (300 / 3.6 / 30), -Math.PI / 2), 'high', 1],
  ['portail-sec', () => camera(tunnel.debut + 3, Math.PI), 'high', 0]
].map(([nom, cam, palier, pluie]) => ({ nom, palier, frames: Array.from({ length: images }, (_, i) => ({
  m: { t: 12 + i / 30, pluie }, cam: cam(i), options: { circuit: c, physique, palier, largeur: 960, hauteur: 540, dpr: 1 }
})) }));
function run(v, scene, mesure = false, signature = false) {
  const canvas = toile(signature), pluie = v.module.creerPluie(canvas), couts = [], debutRayons = rayons;
  let rayonsMax = 0, spatiauxMax = 0, traitsMin = Infinity, traitsMax = 0;
  const debut = performance.now();
  for (const frame of scene.frames) {
    const avant = performance.now(), s = pluie.dessiner(frame.m, frame.cam, 1 / 30, frame.options);
    if (mesure) couts.push(performance.now() - avant);
    rayonsMax = Math.max(rayonsMax, s.rayons || 0); spatiauxMax = Math.max(spatiauxMax, s.spatiaux || 0);
    traitsMin = Math.min(traitsMin, s.traits); traitsMax = Math.max(traitsMax, s.traits);
  }
  return { couts, totalMs: performance.now() - debut, rayons: rayons - debutRayons, rayonsMax, spatiauxMax, traitsMin, traitsMax, dessin: canvas.bilan() };
}
const rapport = { schema: 1, scene: 'Circuit 47, mêmes trois couverts et solides PhysX que le banc dédié',
  sources: variants.map(({ nom, sha256 }) => ({ nom, sha256 })), imagesParSerie: images, series, chauffeImagesParVarianteEtScene: images,
  node: process.version, plateforme: process.platform, architecture: process.arch, comparaison: [],
  limites: ['CPU du module dans Node et vrai PhysX WASM ; Canvas instrumenté sans raster ni WebGL.',
    'Parent sans masque spatial : référence de coût de la pluie brute ; sous abri sa sortie ne satisfait pas la nouvelle fonction.',
    'Allocations non mesurées ; aucune déduction à partir de la mémoire retenue après GC.',
    'Aucun FPS Xbox/Intel ni gain matériel annoncé.'] };
try {
  for (const scene of scenarios) {
    for (const v of variants) run(v, scene);
    const donnees = new Map(variants.map(v => [v.nom, { temps: [], totaux: [], rayons: [], rayonsMax: 0, spatiauxMax: 0 }]));
    for (let tour = 0; tour < series; tour++) for (let ordre = 0; ordre < variants.length; ordre++) {
      const v = variants[(ordre + tour) % variants.length], r = run(v, scene, true), d = donnees.get(v.nom);
      d.temps.push(...r.couts); d.totaux.push(r.totalMs); d.rayons.push(r.rayons);
      d.rayonsMax = Math.max(d.rayonsMax, r.rayonsMax); d.spatiauxMax = Math.max(d.spatiauxMax, r.spatiauxMax);
    }
    const mesures = variants.map(v => {
      const d = donnees.get(v.nom), r = run(v, scene, false, true); d.temps.sort((a, b) => a - b); d.totaux.sort((a, b) => a - b);
      const quantile = p => d.temps[Math.min(d.temps.length - 1, Math.floor(d.temps.length * p))];
      return { nom: v.nom, cpuMs: { p50: quantile(.5), p95: quantile(.95), p99: quantile(.99), pire: d.temps.at(-1),
        medianeSerie: d.totaux[Math.floor(series / 2)] }, rayonsParSerie: d.rayons, rayonsMaxParImage: d.rayonsMax,
        spatiauxMaxParImage: d.spatiauxMax, traitsMin: r.traitsMin, traitsMax: r.traitsMax, dessin: r.dessin };
    });
    rapport.comparaison.push({ scenario: scene.nom, qualite: scene.palier, mesures });
    console.log(scene.nom + ' : ' + mesures.map(r => `${r.nom} p50=${r.cpuMs.p50.toFixed(3)} ms p95=${r.cpuMs.p95.toFixed(3)} ms rayons<=${r.rayonsMaxParImage}`).join(' ; '));
  }
} finally {
  B.solidesPhysX.liberer(solids); world.dispose(); X.dispose();
  writeFileSync(resolve(opts.sortie), JSON.stringify(rapport, null, 2) + '\n');
}
