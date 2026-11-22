// Candidat M1 opt-in : les seules différences A/B sont les recettes de pierres identifiées, en qualité Fine.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { B, CATALOGUE_SAISONS, creerCircuitSaisons } from '../tools/qualification/saisons-circuits.mjs';

// En navigateur, lieux.js enregistre ces formes au chargement sur window.FRender.
await import('../src/lieux.js');
for (const [nom, triangles] of Object.entries(B.lieux.FORMES)) globalThis.FRender.forme(nom, triangles);

// Inventaire des ouvrages réels avant M1, identique aux deux distances. Les rochers libres sont exclus.
const PIERRES = {
  'route-des-cimes': { 'roche-tunnel': 493, 'portail-tunnel': 12, 'arche-cimes': 44,
    'tympan-cimes': 44, 'rive-pont-cimes': 88, 'socle-refuge': 1 },
};
const base = { qualite: 'high', saison: 'ete', arbres: 220, vegetation: false };
const sha = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const objets = (d, cle = 'objets') => d.lots.flatMap(l => l[cle] || []);
const identitePierre = o => o.solidePhysX?.genre === 'refuge-cimes' ? o.partie : o.solidePhysX?.genre;
function creer(id, options = {}) {
  // Deux circuits frais : le cache de l'herbier du témoin ne peut cacher un masque divergent.
  const definition = CATALOGUE_SAISONS.find(d => d.id === id);
  assert.ok(definition, 'circuit du catalogue réel : ' + id);
  return B.decor.construire(creerCircuitSaisons(definition), { ...base, ...options });
}
function comparerLots(ancien, actif, selection = {}) {
  assert.equal(actif.length, ancien.length, 'nombre de lots');
  const comptes = { objets: {}, loin: {} }, rendu = globalThis.FRender.shared.geometry(false).ranges;
  const budgets = { objets: { instances: 0, triangles: 0 }, loin: { instances: 0, triangles: 0 } };
  for (let i = 0; i < ancien.length; i++) {
    const { objets: _a, loin: _b, ...a } = ancien[i], { objets: _c, loin: _d, ...b } = actif[i];
    assert.deepEqual(b, a, 'centre, rayon, portée ou bascule du lot ' + i);
    for (const cle of ['objets', 'loin']) {
      const aa = ancien[i][cle] || [], bb = actif[i][cle] || [];
      assert.equal(bb.length, aa.length, 'instances du lot ' + i + '/' + cle);
      for (let j = 0; j < aa.length; j++) {
        const o = aa[j], attendu = Object.getOwnPropertyDescriptors(o), pierre = identitePierre(o);
        if (o.mat === 9 && Object.hasOwn(selection, pierre)) {
          attendu.mat = { ...attendu.mat, value: 23 };
          comptes[cle][pierre] = (comptes[cle][pierre] || 0) + 1;
        }
        // Les descripteurs incluent solidePhysX non énumérable : pose, couleur, géométrie, collision et
        // métadonnées de surface doivent rester strictement celles de l'objet témoin, hors mat 9→23.
        assert.deepEqual(Object.getOwnPropertyDescriptors(bb[j]), attendu, 'objet ' + i + '/' + cle + '/' + j);
        assert.ok(rendu[o.shape], 'forme réellement rendue : ' + o.shape);
        budgets[cle].instances++; budgets[cle].triangles += rendu[o.shape].count / 3;
      }
    }
  }
  return { comptes, budgets };
}
function comparerScenes(ancien, actif, selection = {}) {
  const bilan = comparerLots(ancien.lots, actif.lots, selection);
  // Les données PhysX et les masques lisent les lots avant le regroupement des arbres pour l'image.
  comparerLots(ancien.lotsHerbier, actif.lotsHerbier, selection);
  assert.equal(actif.nappes.length, ancien.nappes.length);
  for (let i = 0; i < ancien.nappes.length; i++) {
    assert.deepEqual(Object.getOwnPropertyDescriptors(actif.nappes[i]), Object.getOwnPropertyDescriptors(ancien.nappes[i]),
      'nappe ' + i + ' : sommets, couleurs, matières, indices, surfaces PhysX et masques de plantation');
  }
  for (const cle of Object.keys(ancien)) if (!['nappes', 'lots', 'sol'].includes(cle)) {
    assert.deepEqual(actif[cle], ancien[cle], 'donnée du décor : ' + cle);
  }
  for (const cle of ['qualite', 'saison', 'sourcesFeuilles', 'architecture', 'gradins']) {
    assert.deepEqual(actif[cle], ancien[cle], 'donnée non énumérable : ' + cle);
  }
  for (const o of objets(ancien)) if (o.mat === 9) {
    assert.equal(actif.sol(o.p[0], o.p[2]), ancien.sol(o.p[0], o.p[2]), 'hauteur du sol sous une pierre ou un fossé');
  }
  return bilan;
}
function comparerHerbiers(ancien, actif) {
  const a = ancien.herbier, b = actif.herbier;
  assert.notEqual(b, a, 'les deux préparations sont indépendantes');
  assert.equal(b.empreinte, a.empreinte, 'géométrie et empreintes des masques d’herbe');
  assert.deepEqual(b.sourcesTriangles, a.sourcesTriangles, 'association des triangles aux surfaces');
  for (const cle of ['aireBrute', 'aire', 'aireAccotements', 'aireTerrain', 'trianglesSources', 'masques']) {
    assert.equal(b[cle], a[cle], 'herbier : ' + cle);
  }
  assert.equal(sha(b.triangles), sha(a.triangles), 'triangles et palettes de l’herbier');
  for (let i = 0; i < a.triangles.length; i += 1024) {
    const t = a.triangles[i], x = t.points.reduce((n, p) => n + p[0] / 3, 0), z = t.points.reduce((n, p) => n + p[2] / 3, 0);
    assert.deepEqual(actif.surfaceHerbe(x, z, {}), ancien.surfaceHerbe(x, z, {}), 'appui et couleur d’herbe');
  }
  return { triangles: a.triangles.length, masques: a.masques };
}

for (const id of Object.keys(PIERRES)) for (const saison of ['ete', 'hiver']) {
  test(id + ' / ' + saison + ' : matière 23 ciblée, données et budgets identiques', t => {
    const ancien = creer(id, { saison, pierresProcedurales: false }), actif = creer(id, { saison, pierresProcedurales: true });
    const bilan = comparerScenes(ancien, actif, PIERRES[id]);
    for (const cle of ['objets', 'loin']) assert.deepEqual(bilan.comptes[cle], PIERRES[id], 'inventaire pierre ' + cle);
    const pierres = cle => objets(actif, cle).filter(o => o.mat === 23 && Object.hasOwn(PIERRES[id], identitePierre(o)))
      .map(o => JSON.stringify(Object.getOwnPropertyDescriptors(o))).sort();
    assert.deepEqual(pierres('loin'), pierres('objets'), 'mêmes pierres et matières aux deux distances');
    const beton = objets(actif).filter(o => o.solidePhysX?.genre === 'portail-tunnel' && o.mat === 3);
    assert.equal(beton.length, PIERRES[id]['portail-tunnel'], 'tous les encadrements de béton restent en matière 3');
    assert.ok(objets(actif).some(o => o.mat === 9 && !o.solidePhysX), 'rochers visuels hors sélection conservés');
    if (id === 'route-des-cimes') {
      const refuge = objets(actif).filter(o => o.solidePhysX?.genre === 'refuge-cimes');
      assert.equal(refuge.filter(o => o.mat === 23).length, 1, 'seul le socle du refuge est enrichi');
      assert.ok(refuge.some(o => o.partie === 'mur-refuge' && o.mat === 13.2));
      assert.ok(refuge.some(o => o.partie === 'toiture-refuge' && o.mat === 1));
    }
    const herbier = comparerHerbiers(ancien, actif);
    t.diagnostic(JSON.stringify({ circuit: id, saison, convertis: bilan.comptes, budgets: bilan.budgets, herbier }));
  });
}

for (const id of Object.keys(PIERRES)) for (const saison of B.saisons.IDS) {
  test(id + ' / ' + saison + ' : Fine par défaut strictement identique à pierresProcedurales:false', () => {
    const ancien = creer(id, { saison, pierresProcedurales: false }), defaut = creer(id, { saison });
    const bilan = comparerScenes(ancien, defaut);
    assert.deepEqual(bilan.comptes, { objets: {}, loin: {} }, 'aucune recette de pierre activée sans option');
    for (const cle of ['objets', 'loin']) {
      const historique = {};
      for (const o of objets(defaut, cle)) {
        const pierre = identitePierre(o);
        if (o.mat === 9 && Object.hasOwn(PIERRES[id], pierre)) historique[pierre] = (historique[pierre] || 0) + 1;
      }
      assert.deepEqual(historique, PIERRES[id], 'toutes les pierres gardent la recette 9 : ' + cle);
    }
    comparerHerbiers(ancien, defaut);
  });
}

for (const id of Object.keys(PIERRES)) {
  for (const qualite of ['low', 'medium']) test(id + ' / ' + qualite + ' : option explicite et défaut sans effet', () => {
    const ancien = creer(id, { qualite, pierresProcedurales: false });
    for (const pierresProcedurales of [undefined, true]) {
      const bilan = comparerScenes(ancien, creer(id, { qualite, pierresProcedurales }));
      assert.deepEqual(bilan.comptes, { objets: {}, loin: {} });
    }
  });
  test(id + ' : matieres:false désactive aussi les pierres', () => {
    const ancien = creer(id, { pierresProcedurales: false });
    comparerScenes(ancien, creer(id, { pierresProcedurales: true, matieres: false }));
  });
  test(id + ' : solsProceduraux reste indépendant des pierres', () => {
    const ancien = creer(id, { solsProceduraux: true, pierresProcedurales: false });
    const actif = creer(id, { solsProceduraux: true, pierresProcedurales: true });
    const sansSols = creer(id, { solsProceduraux: false, pierresProcedurales: true });
    const bilan = comparerScenes(ancien, actif, PIERRES[id]);
    assert.deepEqual(bilan.comptes.objets, PIERRES[id]);
    comparerLots(sansSols.lots, actif.lots); comparerLots(sansSols.lotsHerbier, actif.lotsHerbier);
    assert.ok(actif.nappes.some(n => n.sommets.some((m, i) => i % 13 === 9 && m === 25)), 'sols procéduraux exercés');
    assert.ok(!sansSols.nappes.some(n => n.sommets.some((m, i) => i % 13 === 9 && m === 25)), 'témoin sans remappage du sol');
    comparerHerbiers(ancien, actif);
  });
}

test('Cap-Séquoia : témoin hors montagne et eau littorale identiques malgré l’option explicite', () => {
  const ancien = creer('cap-sequoia', { pierresProcedurales: false });
  const actif = creer('cap-sequoia', { pierresProcedurales: true });
  comparerScenes(ancien, actif);
  assert.ok(actif.nappes.some(n => n.sommets.some((m, i) => i % 13 === 9 && m === 12)), 'nappe d’eau du littoral présente');
});

test('Lande-Noire : berges et eau de fossé en matière 9 restent intactes', () => {
  const ancien = creer('lande-noire', { pierresProcedurales: false });
  const actif = creer('lande-noire', { pierresProcedurales: true });
  comparerScenes(ancien, actif);
  const proches = objets(actif);
  assert.equal(proches.filter(o => o.solidePhysX?.genre === 'berge-fosse' && o.mat === 9).length, 52, 'berges de terre présentes');
  assert.equal(proches.filter(o => o.mat === 9 && JSON.stringify(o.color) === '[0.07,0.11,0.1]').length, 26, 'eau sombre de fossé en matière historique 9');
});
