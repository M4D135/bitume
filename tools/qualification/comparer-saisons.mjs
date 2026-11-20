#!/usr/bin/env node
// Deux copies figées des vraies sources, chargées dans deux contextes distincts ; aucun rendu GPU.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MODULES_SAISONS, CATALOGUE_SAISONS, observerSaisons, objetsSaisons } from './saisons-circuits.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url)), o = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i];
  if (!['--avant', '--sortie', '--qualite'].includes(k) || o[k] || !process.argv[i + 1]) throw new Error('Option inconnue ou incomplète : ' + k);
  o[k] = process.argv[i + 1];
}
if (!o['--avant'] || !o['--sortie']) throw new Error('Usage : node tools/qualification/comparer-saisons.mjs --avant <commit> --sortie <dossier> [--qualite low|medium|high]');
const qualite = o['--qualite'] || 'low';
if (!['low', 'medium', 'high'].includes(qualite)) throw new Error('Qualité inconnue');
const base = execFileSync('git', ['rev-parse', '--verify', o['--avant'] + '^{commit}'], { cwd: racine, encoding: 'utf8' }).trim();
const sortie = path.resolve(o['--sortie']); fs.mkdirSync(sortie, { recursive: true });
const sha = v => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const copies = Object.fromEntries(['avant', 'apres'].map(variante => [variante, Object.fromEntries(MODULES_SAISONS.map(n => {
  const f = 'src/' + n + '.js';
  return [f, variante === 'avant' ? execFileSync('git', ['show', base + ':' + f], { cwd: racine, encoding: 'utf8', maxBuffer: 8e6 }) : fs.readFileSync(path.join(racine, f), 'utf8')];
}))]));
const rapports = {};
for (const variante of ['avant', 'apres']) {
  // Même Math standard pour les deux copies : évite le coût des recherches de propriétés
  // du proxy vm dans les millions d'échantillons, sans changer le hasard ni les sources.
  const contexte = vm.createContext({ console, Buffer, createHash, sha, Math }), sources = {};
  for (const [f, source] of Object.entries(copies[variante])) { sources[f] = sha(source); vm.runInContext(source, contexte, { filename: f }); }
  vm.runInContext('const objetsSaisons=' + objetsSaisons.toString() + ';globalThis.observer=' + observerSaisons.toString() + ';', contexte);
  const B = contexte.BITUME, r = rapports[variante] = { format: 'bitume-saisons-budgets-v1', base, sources,
    conditions: { qualite, vegetation: false, arbres: 220 }, limites: [
      'Budgets de tous les lots, sans caméra ni GPU ni mesure FPS.',
      'Les métadonnées d’essence n’existent pas dans la référence historique ; ses compteurs typés sont alors indéterminés.'
    ], circuits: [] };
  for (const d of CATALOGUE_SAISONS) {
    const c = d.partition === 'route-des-cimes' ? B.routeDesCimes.creer() : B.circuit.creer(d.graine, d);
    B.bords.limites(c, B.bords.planifier(c));
    const scenes = Array.from(B.saisons.IDS, saison => contexte.observer(B.decor.construire(c, { ...r.conditions, saison })));
    r.circuits.push({ id: d.id, theme: d.theme, scenes });
    fs.writeFileSync(path.join(sortie, 'budgets-' + variante + '.json'), JSON.stringify(r, null, 2) + '\n');
    console.log(variante + ' ' + d.id);
  }
}
const a = rapports.avant, b = rapports.apres, r = { format: 'bitume-saisons-comparaison-v1', sourcesAvant: a.sources, sourcesApres: b.sources, cas: [] };
let conservation = 0;
for (let i = 0; i < a.circuits.length; i++) for (let j = 0; j < a.circuits[i].scenes.length; j++) {
  const x = a.circuits[i].scenes[j], y = b.circuits[i].scenes[j], identite = {};
  for (const k of ['racinesSHA256', 'obstaclesSHA256', 'troncsSHA256', 'geometrieSolSHA256']) { identite[k] = x[k] === y[k]; if (identite[k]) conservation++; }
  r.cas.push({ circuit: a.circuits[i].id, saison: x.saison, identite,
    proche: { avant: x.lotsProches, apres: y.lotsProches }, loin: { avant: x.lotsLointains, apres: y.lotsLointains } });
}
r.identitesConservees = conservation; r.identitesAttendues = r.cas.length * 4;
fs.writeFileSync(path.join(sortie, 'comparaison-budgets.json'), JSON.stringify(r, null, 2) + '\n');
console.log(JSON.stringify({ identitesConservees: conservation, identitesAttendues: r.identitesAttendues }));
if (conservation !== r.identitesAttendues) process.exitCode = 1;
