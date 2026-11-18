#!/usr/bin/env node
/* BITUME — budget du décor par biome et par palier (ou --densites). Node, sans dépendance ni réseau.
   Compte les lots, les objets, les triangles des formes libres et le détail végétal réellement produits.
   Sort avec un code non nul si deux paliers d'un même biome donnent le même décompte : l'option serait décorative. */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const src = n => path.join(racine, 'src', n + '.js');

// Faux moteur : seule la déclaration des formes libres sert ici, pour compter leurs triangles.
const formes = new Map();
globalThis.FRender = { forme: (nom, triangles) => { formes.set(nom, triangles); return nom; } };

for (const n of ['graphismes', 'carene', 'circuit', 'vegetation', 'decor']) require(src(n));
// Botanique est optionnel : le budget du décor ne doit rien à ce module s'il n'existe pas encore.
if (existsSync(src('botanique'))) require(src('botanique'));

const B = globalThis.BITUME;
const PALIERS = ['low', 'medium', 'high'];
const DENSITES = ['off', 'low', 'medium', 'high', 'ultra'];
// Graines fixes : le même tracé est comparé d'un palier à l'autre, aucune mesure ne dépend du hasard du jour.
const GRAINES = { foret: [11, 4200], cote: [29, 3600], montagne: [47, 5200] };
// Nombre de touffes réellement produit par e150378 (BITUME 0.2.29), neuf brins par touffe.
const REFERENCE_029 = {
  foret: { low: 124, medium: 1123, high: 3866, ultra: 7238 },
  cote: { low: 86, medium: 853, high: 3030, ultra: 5716 },
  montagne: { low: 74, medium: 1079, high: 3684, ultra: 7108 },
};
const REFERENCE_031 = {
  foret: { low: 1116, medium: 114228, high: 362100, ultra: 720756 },
  cote: { low: 774, medium: 94848, high: 301080, ultra: 599832 },
  montagne: { low: 666, medium: 135309, high: 430743, ultra: 860439 },
};

function mesurer(theme, graine, longueur, qualite, vegetationDemandee = 'profil') {
  const c = B.circuit.creer(graine, { theme, longueur });
  // Même résolution du profil et même construction que jeu.js : Low ferme réellement la végétation,
  // une densité explicite surcharge seulement les plantes. Aucun lot n'est remplacé après construction.
  const profil = B.graphismes.melange(qualite, 0, { decor: qualite, options: { vegetation: vegetationDemandee } });
  const d = B.decor.construire(c, { qualite: profil.palier, ...profil.decor });
  const lots = d.lots;
  const v = d.vegetation || { herbes: 0, fougeres: 0, fleurs: 0, taillis: 0, lots: 0, qualite: 'off' };
  const formesUtilisees = new Set();
  let objets = 0, rendus = 0, brins = 0, brinsTapis = 0, tuiles = 0, objetsHerbe = 0, trianglesHerbe = 0, trianglesHerbeLoin = 0;
  const inconnues = new Set();
  for (const l of lots) for (const o of l.objets) {
    objets++;
    const t = formes.get(o.shape);
    if (t === undefined) { inconnues.add(o.shape); continue; }
    if (!formesUtilisees.has(o.shape)) formesUtilisees.add(o.shape);
    rendus += t.length;
    if (o.shape === 'herbes-val' || o.shape.startsWith('prairie-val')) {
      const tuile = o.shape.startsWith('prairie-val');
      // Le test géométrique vérifie 24 triangles par ancien brin, 6 par brin du tapis : compter les
      // formes vraiment instanciées détecte aussi un compteur de densité modifié sans ajout de géométrie.
      const n = t.length / (tuile ? 6 : 24);
      brins += n; objetsHerbe++; if (tuile) { tuiles++; brinsTapis += n; }
      trianglesHerbe += t.length; trianglesHerbeLoin += formes.get(o.shape + '-loin').length;
    }
  }
  let trianglesFormes = 0;
  for (const nom of formesUtilisees) trianglesFormes += formes.get(nom).length;
  const reference = (REFERENCE_029[theme]?.[v.qualite] || 0) * 9;
  const reference031 = REFERENCE_031[theme]?.[v.qualite] || 0;
  return {
    biome: theme, graine, longueur, qualite,
    lots: lots.length, objets,
    formesUniques: formesUtilisees.size, trianglesFormes, trianglesRendus: rendus,
    primitivesMoteur: inconnues.size,
    objetsHorsVegetation: lots.filter(l => !l.vegetation).reduce((s, l) => s + l.objets.length, 0),
    solides: d.obstacles.length,
    vegetation: { herbes: v.herbes, fougeres: v.fougeres, fleurs: v.fleurs, taillis: v.taillis, lots: v.lots,
      objetsHerbe, tuiles, brins, brinsTapis,
      trianglesHerbeProches: trianglesHerbe, trianglesHerbeLointains: trianglesHerbeLoin,
      lotsTapis: lots.filter(l => l.tapis).length,
      groupesHerbe: lots.reduce((n, l) => n + new Set(l.objets.filter(o => o.shape === 'herbes-val' || o.shape.startsWith('prairie-val')).map(o => o.shape)).size, 0),
      brinsReference029: reference, facteurBrinsDepuis029: reference ? brins / reference : null,
      brinsReference031: reference031, facteurBrinsDepuis031: reference031 ? brins / reference031 : null,
      brinsAccotements: v.brinsAccotements || 0, brinsTerrain: v.brinsTerrain || 0,
      aireAccotements: v.aireAccotements || 0, aireTerrain: v.aireTerrain || 0,
      instanceBufferBytesTheoriques: objetsHerbe * 16 * 4 * 2 },
    qualiteDemandee: qualite, qualiteAppliquee: d.qualite,
    vegetationDemandee, vegetationQualite: v.qualite,
  };
}

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const densites = argv.includes('--densites');
const iSortie = argv.indexOf('--sortie');
const sortie = iSortie >= 0 ? argv[iSortie + 1] : null;

const biomes = Object.keys(B.decor.THEMES);
const rapport = {
  genere: 'tools/budget-decor.mjs', mode: densites ? 'densites' : 'profils',
  mesure: 'Décor complet généré par graphismes.melange puis decor.construire ; triangles des formes libres proches, hors primitives moteur. Brins déduits des maillages réellement instanciés. Références 0.2.29 et 0.2.31. La densité locale est mesurée séparément par tools/budget-herbe.mjs. Totaux théoriques, pas une mesure de triangles soumis, visibles ou de FPS GPU.',
  biomes: {}, lignes: [],
};
for (const [i, biome] of biomes.entries()) {
  const [graine, longueur] = GRAINES[biome] || [13 + i, 4000];
  rapport.biomes[biome] = { graine, longueur };
  if (densites) for (const densite of DENSITES) rapport.lignes.push(mesurer(biome, graine, longueur, 'high', densite));
  else for (const qualite of PALIERS) rapport.lignes.push(mesurer(biome, graine, longueur, qualite));
}

const cle = l => [l.lots, l.objets, l.formesUniques, l.trianglesFormes, l.trianglesRendus,
  l.vegetation.herbes, l.vegetation.fougeres, l.vegetation.fleurs, l.vegetation.taillis].join('|');

let conflits = 0;
if (json) {
  console.log(JSON.stringify(rapport, null, 2));
} else {
  const entetes = ['biome', 'palier', 'végétation', 'lots', 'objets', 'formes', 'triFormes', 'triRendus', 'instHerbe', 'brins', '×0.2.31', 'fougères', 'fleurs', 'taillis'];
  const lignes = rapport.lignes.map(l => [l.biome, l.qualite, l.vegetationQualite, String(l.lots), String(l.objets), String(l.formesUniques),
    String(l.trianglesFormes), String(l.trianglesRendus), String(l.vegetation.objetsHerbe), String(l.vegetation.brins),
    l.vegetation.facteurBrinsDepuis031 === null ? '—' : l.vegetation.facteurBrinsDepuis031.toFixed(2), String(l.vegetation.fougeres),
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
      const libelle = l => densites ? l.vegetationQualite : l.qualite;
      console.error(`conflit : ${biome} — les choix ${libelle(lignes[i])} et ${libelle(lignes[j])} donnent le même décompte (${cle(lignes[i])})`);
    }
  }
  if (densites) {
    const reference = lignes[0];
    for (const l of lignes) {
      if (l.vegetationDemandee !== l.vegetationQualite || l.objetsHorsVegetation !== reference.objetsHorsVegetation || l.solides !== reference.solides) {
        conflits++;
        console.error(`conflit : ${biome} ${l.vegetationDemandee} — densité non appliquée ou décor hors végétation modifié`);
      }
      if (['medium', 'high', 'ultra'].includes(l.vegetationQualite) && l.vegetation.facteurBrinsDepuis029 < 10) {
        conflits++;
        console.error(`conflit : ${biome} ${l.vegetationQualite} — moins de dix fois les brins de la 0.2.29`);
      }
      if (l.vegetationQualite === 'ultra' && l.vegetation.facteurBrinsDepuis031 < 10) {
        conflits++;
        console.error(`conflit : ${biome} MAX — moins de dix fois les brins de la 0.2.31`);
      }
    }
    for (let i = 1; i < lignes.length; i++) if (lignes[i].vegetation.herbes <= lignes[i - 1].vegetation.herbes) {
      conflits++;
      console.error(`conflit : ${biome} — nombre de touffes non croissant entre ${lignes[i - 1].vegetationQualite} et ${lignes[i].vegetationQualite}`);
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
