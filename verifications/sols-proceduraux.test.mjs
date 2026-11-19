// Recette de sol FERRO 25 : seul le numéro de matière change après la préparation du décor.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'carene', 'chaussee', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bords', 'decor']) require('../src/' + f + '.js');
const B = globalThis.BITUME, sourceJeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const catalogue = vm.runInNewContext(sourceJeu.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
const rapports = []; let controles = 0;
function verifier(nom, f) { const r = f(); controles++; console.log('ok  ' + nom); if (r) rapports.push({ nom, ...r }); }
function circuit(k) { const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom }); B.bords.limites(c, B.bords.planifier(c)); return c; }
function empreinte(x) { return createHash('sha256').update(JSON.stringify(x)).digest('hex'); }
function solides(d) { return d.lotsHerbier.flatMap(l => l.objets).map(o => o.solidePhysX || null); }
function photographieVegetation(qualite, actif) {
  const d = B.decor.construire(circuit(catalogue[0]), { qualite, saison: 'printemps', matieres: true,
    vegetation: true, vegetationQualite: qualite, solsProceduraux: actif });
  assert.ok(d.vegetation, 'générateur de végétation non exercé');
  const hash = createHash('sha256'), json = x => hash.update(JSON.stringify(x)), donnees = x => hash.update(Buffer.from(x.buffer, x.byteOffset, x.byteLength));
  let convertis = 0;
  for (const n of d.nappes) {
    const s = new Float32Array(n.sommets);
    if (n.surfaceType === 'accotement' || n.surfaceType === 'terrain') for (let k = 9; k < s.length; k += 13) {
      if (!actif && s[k] === 8) s[k] = 25;
      if (s[k] === 25) convertis++;
    }
    donnees(s); donnees(n.indices); json([n.surfaceType, n.herbeTriangles, n.surfacesPhysX]);
    for (const cle of Object.keys(n)) if (cle !== 'sommets' && cle !== 'indices') json([cle, n[cle]]);
  }
  // Le palier haut peut contenir 180 000 instances. Écrit l'empreinte objet par objet et libère son témoin
  // avant de construire l'autre : aucun grand JSON ni deux scènes de végétation conservés simultanément.
  for (const l of d.lots) {
    for (const cle of Object.keys(l)) if (cle !== 'objets' && cle !== 'loin') json([cle, l[cle]]);
    for (const cle of ['objets', 'loin']) { json([cle, l[cle]?.length]); for (const o of l[cle] || []) json(o); }
  }
  json(solides(d)); json(d.obstacles); json(d.limites); json(d.atmosphere); json(d.vegetation);
  const h = d.herbier;
  for (const cle of Object.keys(h)) if (cle !== 'triangles' && typeof h[cle] !== 'function') json([cle, h[cle]]);
  for (const t of h.triangles) json(t);
  return { empreinte: hash.digest('hex'), convertis, trianglesHerbier: h.triangles.length };
}
function comparer(ancien, actif) {
  assert.equal(actif.nappes.length, ancien.nappes.length);
  let convertis = 0, accotementsEnneiges = 0, neigeClaire = 0, eau = 0;
  for (let i = 0; i < ancien.nappes.length; i++) {
    const a = ancien.nappes[i], b = actif.nappes[i], attendu = new Float32Array(a.sommets);
    assert.equal(b.surfaceType, a.surfaceType); assert.deepEqual(b.indices, a.indices, 'indices modifiés');
    assert.deepEqual(b.herbeTriangles, a.herbeTriangles, 'masques de plantation modifiés');
    assert.deepEqual(b.surfacesPhysX, a.surfacesPhysX, 'adhérence des faces PhysX modifiée');
    const sol = a.surfaceType === 'accotement' || a.surfaceType === 'terrain';
    for (let k = 9; k < attendu.length; k += 13) {
      if (attendu[k] === 12) eau++;
      if (attendu[k] !== 8 || !sol) continue;
      attendu[k] = 25; convertis++;
      if (actif.saison.neige && a.surfaceType === 'accotement') {
        accotementsEnneiges++;
        if (b.sommets[k + 1] > .8 && b.sommets[k + 2] > .84 && b.sommets[k + 3] > .86) neigeClaire++;
      }
    }
    assert.deepEqual(b.sommets, attendu, 'positions, normales, coordonnées ou couleurs modifiées');
    // Les centres et rayons des nappes, comme leurs autres champs énumérables, restent ceux du décor source.
    for (const cle of Object.keys(a)) if (cle !== 'sommets' && cle !== 'indices') assert.deepEqual(b[cle], a[cle]);
  }
  assert.ok(convertis > 0, 'option active sans sol enrichi');
  assert.deepEqual(actif.lots, ancien.lots, 'arbres, feuillages ou autres primitives remappés');
  assert.deepEqual(actif.obstacles, ancien.obstacles, 'obstacles modifiés');
  assert.deepEqual(solides(actif), solides(ancien), 'métadonnées des solides modifiées');
  assert.deepEqual(actif.limites, ancien.limites); assert.deepEqual(actif.atmosphere, ancien.atmosphere);
  assert.deepEqual(actif.vegetation, ancien.vegetation, 'végétation préparée avec une matière incompatible');
  assert.equal(empreinte(actif.herbier), empreinte(ancien.herbier), 'herbier ou couleurs de ses triangles modifiés');
  const h = ancien.herbier;
  for (let i = 0; i < h.triangles.length; i += 1024) {
    const t = h.triangles[i], x = t.points.reduce((n, p) => n + p[0] / 3, 0), z = t.points.reduce((n, p) => n + p[2] / 3, 0);
    assert.deepEqual(actif.surfaceHerbe(x, z, {}), ancien.surfaceHerbe(x, z, {}), 'appui ou couleur du masque d’herbe modifié');
  }
  if (actif.saison.neige) { assert.ok(accotementsEnneiges > 0); assert.equal(neigeClaire, accotementsEnneiges, 'la neige des accotements a perdu sa palette claire'); }
  return { convertis, sommetsEauPreserves: eau, sommetsNeigeClairs: neigeClaire, trianglesHerbier: h.triangles.length };
}

// Circuits indépendants : aucun herbier déjà préparé par le témoin ne peut masquer une mauvaise lecture du mode 25.
for (const k of catalogue) for (const qualite of ['low', 'high']) {
  const temoin = circuit(k), enrichi = circuit(k);
  for (const saison of B.saisons.IDS) verifier(k.id + ' / ' + qualite + ' / ' + saison + ' : surfaces identiques, recette 8 → 25 seule', () => {
    const options = { qualite, saison, matieres: true, vegetation: false };
    const ancien = B.decor.construire(temoin, { ...options, solsProceduraux: false });
    const actif = B.decor.construire(enrichi, { ...options, solsProceduraux: true });
    return comparer(ancien, actif);
  });
}
verifier('sans option explicite, le décor historique reste identique à solsProceduraux:false', () => {
  const c = circuit(catalogue[0]), options = { qualite: 'low', saison: 'ete', vegetation: false };
  const ancien = B.decor.construire(c, options), explicite = B.decor.construire(c, { ...options, solsProceduraux: false });
  assert.equal(empreinte(ancien), empreinte(explicite));
  assert.ok(ancien.nappes.some(n => n.sommets.some((x, i) => i % 13 === 9 && x === 8)));
  assert.ok(ancien.nappes.every(n => !n.sommets.some((x, i) => i % 13 === 9 && x === 25)));
});
for (const qualite of ['low', 'high']) verifier('Val-Brûlé / ' + qualite + ' : végétation et herbier préparés avant le remappage', () => {
  const ancien = photographieVegetation(qualite, false), actif = photographieVegetation(qualite, true);
  assert.deepEqual(actif, ancien, 'la végétation complète diffère après remappage');
  return actif;
});
verifier('le jeu active les sols procéduraux dans tous les profils et modes de décor', () => {
  // Exécute la vraie fonction jusqu’à la réception des options, sans initialiser un navigateur ni remplacer le décor testé ci-dessus.
  const installer = sourceJeu.match(/  function installer\(i, saisonDemandee\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(installer, 'fonction de construction du jeu absente');
  const recueilli = {};
  for (const qualite of ['low', 'high']) for (const enrichi of [false, true]) {
    const contexte = { decorEnrichi: enrichi, sceneEnPlace: () => false, circuit: () => ({}),
      voeuDecor: () => ({ ancre: qualite, veut: { matieres: true, vegetation: true }, vegetationQualite: qualite, saison: 'ete' }),
      B: { decor: { construire: (_c, options) => { recueilli.options = options; throw recueilli; } } } };
    try { vm.runInNewContext(installer + '; installer(0, "ete");', contexte); assert.fail('construction non observée'); }
    catch (e) { assert.equal(e, recueilli); }
    assert.equal(recueilli.options.solsProceduraux, true, 'jeu sans recette de sol pour ' + qualite + ', enrichi=' + enrichi);
  }
});
const bilan = { controles, cas: rapports };
if (process.env.BITUME_RAPPORT_SOLS) writeFileSync(process.env.BITUME_RAPPORT_SOLS, JSON.stringify(bilan, null, 2) + '\n');
console.log(JSON.stringify({ controles, comparaisons: rapports.length, convertis: rapports.reduce((s, r) => s + r.convertis, 0) }));
