#!/usr/bin/env node
// Lot 28 « calcul » — rassemble les mesures brutes de /private/tmp/calcul-28 en résumés JSON courts dans
// docs/reprise/rapports/calcul-2026-11-18/ (médiane, min, max ; pas de profil brut).
//   node prototypes/calcul/rassembler-rapports.mjs [/private/tmp/calcul-28]
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const T = process.argv[2] || '/private/tmp/calcul-28', R = 'docs/reprise/rapports/calcul-2026-11-18';
const lire = f => JSON.parse(readFileSync(f, 'utf8'));
const med = a => { const s = a.filter(x => typeof x === 'number').sort((x, y) => x - y); if (!s.length) return null; return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const mmm = (a, d = 1) => { const v = a.filter(x => typeof x === 'number'); return v.length ? { med: +med(v).toFixed(d), min: +Math.min(...v).toFixed(d), max: +Math.max(...v).toFixed(d), n: v.length } : null; };
const ecrire = (nom, o) => { writeFileSync(path.join(R, nom), JSON.stringify(o, null, 1) + '\n'); console.log(nom); };

// 1. changement de circuit dans le menu et départ de la course (page réelle)
ecrire('page-menu.json', { methode: 'Chrome 157 sans interface, file://dist/bitume.html instrumenté (page-instrumentee.py), 1440×900, carte graphique réelle ; scénario scenario-menu.js : choix du circuit dans l’écran de préparation, puis Départ ; 3 essais par cas ; ms murales', charges: readFileSync(path.join(T, 'serie-page.log'), 'utf8').trim().split('\n'), cas: lire(path.join(T, 'page-menu-resume.json')) });

// 2. calculs par image (courses de banc profilées)
const banc = lire(path.join(T, 'banc-resume.json'));
for (const c of banc.courses) delete c.fonctions;
banc.charges = readFileSync(path.join(T, 'serie-banc.log'), 'utf8').trim().split('\n');
banc.note = 'BITUME_JEU.mesures laissé éteint. Haut-Col hiver et Cap-Séquoia automne : l’herbier est refait pendant la course mesurée (une seule palette de saison gardée par circuit et par clé, decor.js 1197-1208), donc leurs chiffres par image sont pollués.';
ecrire('banc-image.json', banc);

// 3. herbier : original, JavaScript resserré, WebAssembly
const herbier = {};
for (const f of ['herbier-c0-scalaire.json', 'herbier-c0-simd.json', 'herbier-c2-scalaire.json']) if (existsSync(path.join(T, f))) { const j = lire(path.join(T, f)); herbier[f.replace('.json', '')] = { circuit: j.circuit, charge: j.charge, reps: j.reps, volumes: j.volumes, identite: j.identite, ecartsSurface: j.ecartsSurface, wasm: j.wasm, tempsMs: j.tempsMs, unite: j.unite }; }
ecrire('herbier.json', herbier);

// 4. Worker et cache entre visites
const wc = { methode: 'Chrome 157 sans interface, file://dist/bitume.html non modifié ; scenario-worker-cache.js ; palier Fine (high) ; ms murales ; « pire image » = plus long intervalle entre deux images relevé jusqu’à 100 ms après le bloc mesuré', series: {} };
for (const d of ['wc', 'wc2', 'wc3']) {
  const dir = path.join(T, d); if (!existsSync(dir)) continue;
  const log = existsSync(path.join(T, d + '.log')) ? readFileSync(path.join(T, d + '.log'), 'utf8').trim().split('\n') : [];
  const parCas = {};
  for (const f of readdirSync(dir).filter(f => /^wc-c\d-high-cpu\d-r\d\.json$/.test(f)).sort()) {
    const j = lire(path.join(dir, f)); if (j.fatal) continue; const v = j.valeur, k = f.replace(/-r\d\.json$/, '');
    (parCas[k] = parCas[k] || []).push(v);
  }
  const resume = {};
  for (const [k, L] of Object.entries(parCas)) {
    const g = fn => mmm(L.map(v => { try { return fn(v); } catch { return undefined; } }));
    const g3 = fn => mmm(L.flatMap(v => { try { return fn(v); } catch { return []; } }));
    resume[k] = { essais: L.length, protocole: L[0].protocole, crossOriginIsolated: L[0].crossOriginIsolated, objets: L[0].objets, octetsNappes: L[0].octetsNappes, trianglesHerbier: L[0].trianglesHerbier,
      regenerationFilPrincipalMs: g(v => v.regenerationFilPrincipalMs), pireImageRegenerationMs: g(v => v.pireImagePendantRegenerationMs), structuredCloneMs: g(v => v.structuredCloneMs),
      workerGraphe: { calculDansWorkerMs: g(v => v.worker.essai2.calculDansWorkerMs), receptionFilPrincipalMs: g(v => v.worker.essai2.lectureMessageMs), pireImageMs: g(v => v.worker.essai2.pireImageFilPrincipalMs), identiques: L.every(v => v.worker && v.worker.nappesDifferentes === 0 && v.worker.objetsIdentiques) },
      workerPlat: L[0].worker && L[0].worker.plat ? { calculDansWorkerMs: g(v => v.worker.plat.calculDansWorkerMs), receptionMs: g(v => v.worker.plat.lectureMessageMs), jsonParseMs: g(v => v.worker.plat.jsonParseMs), pireImageMs: g(v => v.worker.plat.pireImageFilPrincipalMs), octetsJson: L[0].worker.plat.octetsJson } : null,
      indexedDBGraphe: L[0].indexedDB && L[0].indexedDB.mesures && L[0].indexedDB.mesures.length ? { ecritureMs: g3(v => v.indexedDB.mesures.map(m => m.ecritureMs)), lectureMs: g3(v => v.indexedDB.mesures.map(m => m.lectureMs)), pireImageLectureMs: g3(v => v.indexedDB.mesures.map(m => m.pireImageLectureMs ?? m.pireImageMs)) } : (L[0].indexedDB || null),
      indexedDBPlat: L[0].indexedDB && L[0].indexedDB.plat && L[0].indexedDB.plat.mesures ? { octetsJson: L[0].indexedDB.plat.octetsJson, ecritureMs: g3(v => v.indexedDB.plat.mesures.map(m => m.ecritureMs)), lectureMs: g3(v => v.indexedDB.plat.mesures.map(m => m.lectureMs)), jsonParseMs: g3(v => v.indexedDB.plat.mesures.map(m => m.jsonParseMs)), pireImageLectureMs: g3(v => v.indexedDB.plat.mesures.map(m => m.pireImageLectureMs ?? m.pireImageMs)) } : null,
      indexedDBBinaire: L[0].indexedDB && L[0].indexedDB.binaire && L[0].indexedDB.binaire.mesures ? { octets: L[0].indexedDB.binaire.octets, objets: L[0].indexedDB.binaire.objets, encoderMs: g(v => v.indexedDB.binaire.encoderMs), ecritureMs: g3(v => v.indexedDB.binaire.mesures.map(m => m.ecritureMs)), lectureMs: g3(v => v.indexedDB.binaire.mesures.map(m => m.lectureMs)), reconstitutionObjetsMs: g3(v => v.indexedDB.binaire.mesures.map(m => m.reconstitutionObjetsMs)), pireImageLectureMs: g3(v => v.indexedDB.binaire.mesures.map(m => m.pireImageLectureMs)) } : null,
      opfs: L[0].opfs };
  }
  wc.series[d] = { charges: log, resume };
}
wc.note = 'wc : première version du scénario (pire image relevée trop tôt, pas de variante à plat) ; wc2 : variante à plat du Worker ajoutée, bloc IndexedDB en échec (objets lointains sans champ s/r) ; wc3 : version finale, fait foi pour IndexedDB.';
ecrire('worker-cache.json', wc);

// 5. WebGPU
const gpu = [];
for (const f of ['webgpu-r0.json', 'webgpu-r1.json', 'webgpu-r2.json']) if (existsSync(path.join(T, 'wc', f))) gpu.push(lire(path.join(T, 'wc', f)).valeur);
const banc3 = n => { const L = gpu.map(v => v.bancParticules.find(b => b.particules === n)); return { particules: n, cpuJsParPasMs: mmm(L.map(b => b.cpuJsParPasMs), 4), gpuEnvoiProcesseurParPasMs: mmm(L.map(b => b.gpuEnvoiProcesseurParPasMs), 4), gpuExecutionParPasMs: mmm(L.map(b => b.gpuExecutionParPasMs), 4) }; };
ecrire('webgpu.json', { methode: 'Chrome 157 sans interface (sans drapeau), scenario-webgpu.js, 3 essais ; contrôle des échantillons non comparable au bit (le GPU fait plus de pas que la boucle JS)', navigateur: gpu[0] && gpu[0].userAgent, adaptateur: gpu[0] && gpu[0].adaptateur, fonctions: gpu[0] && gpu[0].fonctions, formatPrefere: gpu[0] && gpu[0].formatPrefere, modeCompatibilite: gpu[0] && gpu[0].modeCompatibilite,
  limites: gpu[0] && gpu[0].limites, creationPipelineMs: mmm(gpu.map(v => v.creationPipelineMs)), bancParticules: [4096, 65536, 1048576].map(banc3) });
