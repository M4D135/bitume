#!/usr/bin/env node
// Mesure statique : géométrie brute FERRO, primitives + botanique uniquement.
// Aucun fichier du dépôt n'est modifié, aucune instance n'est dessinée.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [repo, sortie, avantRef = '1c71bb341d20df4328e5178497503ee4ad26a131', apresRef = '259ed2bb8ba39375f6b792459c24997cfac6e701'] = process.argv.slice(2);
if (!repo || !sortie) throw new Error('Usage : node mesurer-formes-nues.mjs DEPOT SORTIE.json [AVANT_REF APRES_REF]');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
const sha = x => createHash('sha256').update(x).digest('hex');
const commits = { avant: git('rev-parse', avantRef + '^{commit}').trim(), apres: git('rev-parse', apresRef + '^{commit}').trim() };
const fichiers = ['src/moteur/renderer.js', 'src/botanique.js'];
const sources = Object.fromEntries(Object.entries(commits).map(([nom, ref]) => [nom,
  Object.fromEntries(fichiers.map(f => [f, git('show', ref + ':' + f)]))]));
if (sources.avant['src/moteur/renderer.js'] !== sources.apres['src/moteur/renderer.js'])
  throw new Error('Le renderer doit être identique pour isoler les formes nues.');

function charger(source) {
  const contexte = { console, Math };
  vm.createContext(contexte);
  for (const fichier of fichiers) vm.runInContext(source[fichier], contexte, { filename: fichier });
  return contexte.FRender.shared.geometry(false);
}
const a = charger(sources.avant), b = charger(sources.apres);
const compter = g => ({
  formes: Object.keys(g.ranges).length,
  triangles: g.indices.length / 3,
  float32Sommets: g.vertices.length,
  sommets: g.vertices.length / 6,
  indices: g.indices.length,
  octetsSommets: g.vertices.byteLength,
  octetsIndices: g.indices.byteLength,
  octetsTotal: g.vertices.byteLength + g.indices.byteLength,
});
const registreAvant = compter(a), registreApres = compter(b);
const formes = Object.keys(b.ranges).filter(n => !a.ranges[n]).map(nom => {
  const r = b.ranges[nom];
  if (!nom.startsWith('arbre-feuillu-nu-')) throw new Error('Autre nouvelle forme dans le témoin : ' + nom);
  return { nom, triangles: r.count / 3, sommets: r.count, float32Sommets: r.count * 6,
    octetsSommets: r.count * 24, indices: r.count, octetsIndices: r.count * 4, octetsTotal: r.count * 28 };
});
if (formes.length !== 6) throw new Error('Six formes nues attendues.');
const delta = Object.fromEntries(Object.entries(registreApres).map(([k, v]) => [k, v - registreAvant[k]]));
const rapport = {
  schema: 1,
  nature: 'Registre statique de formes, sans dessin ni mesure FPS',
  dateUTC: new Date().toISOString(),
  environnement: { node: process.versions.node, v8: process.versions.v8, plateforme: process.platform, architecture: process.arch },
  methode: 'Deux VM indépendantes, mêmes sources FERRO ; geometry(false) après chargement botanique seulement ; comptage exact Float32Array/Uint32Array.',
  sources: Object.fromEntries(Object.entries(commits).map(([nom, commit]) => [nom,
    { commit, arbre: git('rev-parse', commit + '^{tree}').trim(), fichiers: Object.fromEntries(fichiers.map(f => [f, { sha256: sha(sources[nom][f]) }])) }])),
  registreAvant, registreApres, delta, formes,
  coutDessin: { mesure: false, explication: 'Seules les instances caduques présentes et leur LOD sélectionné utilisent ces formes ; la somme des six formes enregistrées ne représente pas des triangles rendus à chaque image.' },
  limites: [
    'Primitives FERRO et botanique seulement : les totaux avant/après excluent les formes voiture, pilote, végétation et autres modules du jeu.',
    'Octets exacts des tableaux géométriques à envoyer au renderer, pas une mesure complète RAM/VRAM. Le tas JS des triangles, tableaux de génération, index de travail et caches du pilote graphique ne sont pas mesurés.',
    'Les six formes sont préchargées pour les trois qualités, indépendamment de la saison de la première course.',
    'Chaque renderer possède sa géométrie ; un renderer de rétroviseurs peut détenir un second exemplaire du même delta. Aucun total multiplateforme ou de mémoire GPU réelle n’est revendiqué.',
    'Aucune mesure de coût d’image, de GPU matériel ni de FPS.'
  ],
  reproduction: { script: path.basename(process.argv[1]), arguments: ['DEPOT', 'SORTIE.json', commits.avant, commits.apres] },
};
fs.mkdirSync(path.dirname(path.resolve(sortie)), { recursive: true });
fs.writeFileSync(sortie, JSON.stringify(rapport, null, 2) + '\n');
console.log(JSON.stringify({ sortie: path.resolve(sortie), delta, sources: rapport.sources }));
