#!/usr/bin/env node
/* BITUME — profil des circuits du catalogue (étude 22) : relief, pentes, crêtes et cuvettes, dévers par virage, largeur
   et dégagements, courbures, lignes droites, puis inventaire du décor par famille d'objets, répartition le long du tour,
   zones vides et matières. Lit les sources sans les modifier ; Node seul, sans dépendance ni réseau.

     node tools/profil-circuits.mjs [--src src] [--sortie dossier] [--qualite high] [--saison ete] [--circuits 0,2] [--sans-png]

   Écrit dans le dossier de sortie : profils.json (tout), tableaux.md (synthèse), axes/<id>.csv (pas de 10 m),
   profils/<id>.svg et .png (profil en long), profils/sept-circuits.svg et .png (altitudes sur une même échelle). */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerBitume, lireCatalogue, creerCircuit, construireDecor, mesurerTrace, inventaireDecor, NOMS_MATIERES, FAMILLES_MOBILIER, arrondi } from './circuits-commun.mjs';
import { svgProfil, svgPetitsMultiples, ecrireSvgEtPng, nombreFr } from './profil-svg.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const src = path.resolve(opt('src', path.join(racine, 'src')));
const sortie = path.resolve(opt('sortie', path.join(racine, 'docs/reprise/rapports/procedural-2026-11-18')));
const qualite = opt('qualite', 'high'), saison = opt('saison', 'ete'), png = !opt('sans-png', false);
for (const d of ['', 'axes', 'profils']) mkdirSync(path.join(sortie, d), { recursive: true });

const { B } = chargerBitume(src);
const CATALOGUE = lireCatalogue(src);
const choisis = opt('circuits', null) ? String(opt('circuits')).split(',').map(Number) : CATALOGUE.map((_, i) => i);
const fr = (v, d = 0) => nombreFr(v, d);

const resultats = [];
for (const i of choisis) {
  const k = CATALOGUE[i], t0 = Date.now();
  const c = creerCircuit(B, k), m = mesurerTrace(c);
  const d = construireDecor(B, c, qualite, saison), inv = inventaireDecor(c, d);
  const th = d.theme;
  resultats.push({ k, c, m, inv, palette: { herbe: th.herbe, herbeClaire: th.herbeClaire, terre: th.terre, roche: th.roche || null, sable: th.sable || null,
    ciel: [th.atmosphere.skyTop, th.atmosphere.skyBottom], brume: th.atmosphere.fog, densiteBrume: th.atmosphere.fogDensity, essence: th.essence, densiteArbres: th.densite,
    reliefTerrain: th.relief, echelleTerrain: th.echelle, matieresRecettes: !!th.matieres } });
  // axe tous les 10 m, pour les tableurs et les comparaisons futures
  const lignes = ['s;x;z;y;pente_pct;devers_deg;courbure_1_km;vitesse_ref_kmh;ligne_ideale_m;limite_g_m;limite_d_m'];
  for (let j = 0; j < c.n; j += 5) lignes.push([j * c.pas, c.x[j].toFixed(2), c.z[j].toFixed(2), c.y[j].toFixed(3), (c.pente[j] * 100).toFixed(3), (c.devers[j] * 180 / Math.PI).toFixed(3),
    (c.courbure[j] * 1000).toFixed(3), (c.vitesse[j] * 3.6).toFixed(1), c.ligne[j].toFixed(2), c.limiteG[j].toFixed(1), c.limiteD[j].toFixed(1)].join(';'));
  writeFileSync(path.join(sortie, 'axes', k.id + '.csv'), lignes.join('\n') + '\n');
  const r = m.relief;
  const svg = svgProfil(c, m, { titre: `${k.nom} — profil en long (graine ${k.graine}, ${fr(c.longueur)} m, thème ${k.theme})`,
    sousTitre: `dénivelé ${fr(r.denivele, 1)} m · pente max ${fr(r.penteMaxPct, 1)} % · ${r.cretes} crêtes, ${r.cuvettes} cuvettes · rayon vertical mini ${fr(r.rayonVerticalMinCrete)} m (crête), ${fr(r.rayonVerticalMinCuvette)} m (cuvette) · dévers max ${fr(m.devers.maxDeg, 1)}°` });
  const ok = png ? ecrireSvgEtPng(path.join(sortie, 'profils', k.id + '.svg'), svg) : (writeFileSync(path.join(sortie, 'profils', k.id + '.svg'), svg), false);
  console.error(`${k.id} : ${Date.now() - t0} ms${ok ? ', profil rendu' : ''}`);
}

// Même thème, autre graine : ce qui change d'un circuit forestier à l'autre aujourd'hui (graine 96, celle des tests).
const temoin = (() => {
  const k = { id: 'foret-96', nom: 'Forêt, graine 96', theme: 'foret', graine: 96, longueur: 4200 };
  const c = creerCircuit(B, k), m = mesurerTrace(c), d = construireDecor(B, c, qualite, saison), inv = inventaireDecor(c, d);
  return { k, m, inv, paletteIdentique: JSON.stringify(d.theme.atmosphere) === JSON.stringify(B.decor.THEMES.foret.atmosphere) };
})();

if (png && resultats.length > 1) {
  const svg = svgPetitsMultiples(resultats.map(({ k, c, m }) => ({ c, nom: k.nom, ligneBas: [`${k.theme} · dénivelé ${fr(m.relief.denivele, 1)} m`, `pente max ${fr(m.relief.penteMaxPct, 1)} %`] })),
    { titre: 'Les sept circuits : altitude de l’axe le long du tour', sousTitre: 'Relief actuel (BITUME 0.2.39, circuit.js) : trois sinusoïdes par tour, pente bornée à 6,8 %, ligne droite des stands plate.' });
  ecrireSvgEtPng(path.join(sortie, 'profils', 'sept-circuits.svg'), svg);
}

// ---------------------------------------------------------------- synthèse
const json = {
  date: new Date().toISOString(), src, qualite, saison,
  note: 'Mesures sur les sources lues sans modification. Charges verticales : v²/R vertical à la vitesse de référence de circuit.js, en g (le modèle de conduite p9 ne les applique pas).',
  circuits: resultats.map(({ k, m, inv, palette }) => ({ id: k.id, nom: k.nom, theme: k.theme, graine: k.graine, longueurVisee: k.longueur, mesures: m, decor: inv, palette })),
  temoinMemeTheme: { id: temoin.k.id, mesures: temoin.m, familles: temoin.inv.familles, paletteIdentique: temoin.paletteIdentique }
};
writeFileSync(path.join(sortie, 'profils.json'), JSON.stringify(json, null, 1));

const T = [];
const ligne = cellules => T.push('| ' + cellules.join(' | ') + ' |');
const entete = cellules => { ligne(cellules); ligne(cellules.map(() => '---')); };
const srcAffiche = path.relative(racine, src).startsWith('..') ? src : path.relative(racine, src) || src;
T.push('# Profils des circuits — mesures du 18/11/2026', '', `Sources : \`${srcAffiche}\` (lues sans modification). Décor au palier ${qualite}, saison ${saison}.`,
  'Produit par `node tools/profil-circuits.mjs`. Les valeurs complètes sont dans `profils.json` ; l\'axe tous les 10 m dans `axes/`.', '');
T.push('## Tracé', '');
entete(['Circuit', 'Thème', 'Graine', 'Longueur (m)', 'Virages (R < 500 m)', 'Lignes droites (R > 900 m)', 'Plus longue droite', 'Vitesse réf. (km/h)', 'Temps réf.']);
for (const { k, c, m } of resultats) ligne([k.nom, k.theme, k.graine, fr(c.longueur), m.nombreVirages, fr(m.courbures.droite, 1) + ' % du tour', fr(m.droites.plusLongue) + ' m',
  fr(m.vitesse.minKmh) + ' à ' + fr(m.vitesse.maxKmh), fr(m.vitesse.tempsReference, 1) + ' s']);
T.push('', '## Relief', '');
entete(['Circuit', 'Dénivelé', 'Altitudes', 'Montée cumulée', 'Pente max (montée / descente)', 'Pente moyenne', 'Crêtes / cuvettes ≥ 1 m', 'R vertical mini (crête / cuvette)', 'Allègement / écrasement max']);
for (const { k, m } of resultats) {
  const r = m.relief;
  ligne([k.nom, fr(r.denivele, 1) + ' m', fr(r.altitudeMin, 1) + ' à ' + fr(r.altitudeMax, 1) + ' m', fr(r.montéeCumulée) + ' m', fr(r.penteMonteeMaxPct, 1) + ' % / ' + fr(r.penteDescenteMaxPct, 1) + ' %',
    fr(r.penteMoyennePct, 1) + ' %', r.cretes + ' / ' + r.cuvettes, fr(r.rayonVerticalMinCrete) + ' / ' + fr(r.rayonVerticalMinCuvette) + ' m', fr(r.allegementMaxG, 2) + ' / +' + fr(r.chargeVerticaleMaxG, 2) + ' g']);
}
T.push('', 'Crêtes et cuvettes (proéminence ≥ 1 m) : abscisse, rayon vertical et charge à la vitesse de référence.', '');
for (const { k, m } of resultats) {
  const l = [...m.relief.listeCretes, ...m.relief.listeCuvettes].sort((a, b) => a.s - b.s)
    .map(e => `${e.sens} ${fr(e.s)} m (R ${fr(e.rayonVertical)} m, ${fr(e.vitesseKmh)} km/h, ${e.chargeG > 0 ? '+' : ''}${fr(e.chargeG, 2)} g)`);
  T.push(`- **${k.nom}** : ${l.join(' ; ')}.`);
}
T.push('', '## Dévers', '');
entete(['Circuit', 'Dévers max', 'Part du tour > 1°', 'Part du tour à plat (< 0,05°)', 'Virages relevés / contraires / plats', 'Dévers à la corde, du plus fort au plus faible']);
for (const { k, m } of resultats) {
  const n = rel => m.virages.filter(v => v.relation === rel).length;
  const l = [...m.virages].sort((a, b) => Math.abs(b.deversApexDeg) - Math.abs(a.deversApexDeg)).map(v => fr(Math.abs(v.deversApexDeg), 1) + '°').join(', ');
  ligne([k.nom, fr(m.devers.maxDeg, 2) + '°', fr(m.devers.partSup1DegPct, 1) + ' %', fr(m.devers.partNulPct, 1) + ' %', n('relevé') + ' / ' + n('contraire') + ' / ' + n('plat'), l]);
}
T.push('', '## Courbures (part du tour par classe de rayon)', '');
entete(['Circuit', 'Droite > 900 m', 'Rapide 400-900', 'Moyen 150-400', 'Lent 70-150', 'Serré 35-70', 'Épingle < 35', 'Dégagement (bord → glissière) mini / médian']);
for (const { k, m } of resultats) ligne([k.nom, ...['droite', 'rapide', 'moyen', 'lent', 'serré', 'épingle'].map(x => fr(m.courbures[x], 1) + ' %'), fr(m.degagement.min, 1) + ' / ' + fr(m.degagement.median, 1) + ' m']);
T.push('', 'Largeur de chaussée : 12 m partout, sur les sept circuits.', '');

const familles = [...new Set(resultats.flatMap(r => Object.keys(r.inv.familles)))].sort((a, b) => a.localeCompare(b, 'fr'));
T.push('## Décor par famille (objets de la version proche ; entre parenthèses, objets solides)', '');
entete(['Famille', ...resultats.map(r => r.k.nom)]);
for (const f of familles) ligne([f, ...resultats.map(r => { const x = r.inv.familles[f]; return x ? fr(x.objets) + (x.solides ? ' (' + fr(x.solides) + ')' : '') : '–'; })]);
T.push('', 'Les familles « végétation » comptent des tuiles et des touffes instanciées (une tuile de prairie porte 8 à 128 brins).', '');
T.push('## Répartition le long du tour (cases de 100 m)', '');
entete(['Circuit', 'Sans mobilier de course à moins de 40 m', 'Au plus une famille de mobilier', 'Sans arbre, rocher ni maison à 120 m', 'Sans végétation basse à 40 m', 'Familles de mobilier présentes']);
for (const { k, inv } of resultats) {
  const pres = FAMILLES_MOBILIER.filter(f => inv.familles[f] && inv.familles[f].objets).length;
  ligne([k.nom, fr(inv.zonesSansMobilier.partPct, 1) + ' %', fr(inv.partCasesAuPlusUneFamillePct, 1) + ' %', fr(inv.zonesVides.partPct, 1) + ' %', fr(inv.zonesSansVegetationProche.partPct, 1) + ' %', pres + ' / ' + FAMILLES_MOBILIER.length]);
}
T.push('', 'Mobilier de course compté : ' + FAMILLES_MOBILIER.join(', ') + '. Les glissières, continues, ne comptent pas.', '');
T.push('## Matières', '');
entete(['Circuit', 'Chaussée et accotements (sommets par matière)', 'Terrain (sommets par matière)', 'Objets par matière']);
const lib = m => (NOMS_MATIERES[Math.round(m)] || 'matière') + ' ' + String(m).replace('.', ',');
for (const { k, inv } of resultats) {
  const fmt = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([m, n]) => lib(+m) + ' : ' + fr(n)).join(' ; ');
  const objets = {};
  for (const f of Object.values(inv.familles)) for (const [m, n] of Object.entries(f.matieres)) objets[m] = (objets[m] || 0) + n;
  ligne([k.nom, fmt(inv.nappes.accotement && inv.nappes.accotement.matieres), fmt(inv.nappes.terrain && inv.nappes.terrain.matieres), fmt(objets)]);
}
T.push('', `Témoin du même thème : forêt, graine 96 (celle des tests). Ambiance et palette identiques à Val-Brûlé : ${temoin.paletteIdentique ? 'oui' : 'non'} ; `
  + `dénivelé ${fr(temoin.m.relief.denivele, 1)} m, pente max ${fr(temoin.m.relief.penteMaxPct, 1)} %, ${temoin.m.nombreVirages} virages.`, '');
writeFileSync(path.join(sortie, 'tableaux.md'), T.join('\n') + '\n');
console.error('écrit : ' + path.relative(racine, sortie) + '/{profils.json,tableaux.md,axes/,profils/}');
