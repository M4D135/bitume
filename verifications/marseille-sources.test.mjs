import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { DOSSIER, preparer, projection, verifierGrille, verifierSources, sha256, blobGit } from '../tools/preparer-marseille-15ab.mjs';

const lire = p => JSON.parse(readFileSync(join(DOSSIER, p), 'utf8'));
const coeur = lire('coeur.json').donnees, inventaire = lire('inventaire.json'), grille = lire('grille.json');
const brute = lire('sources/ign-grille.json'), requete = lire('sources/ign-grille-requete.json'), acquisition = lire('sources/ign-grille-acquisition.json');

test('sources exactes : blob EMPRISE choisi et reçu IGN acquis, altération rejetée', () => {
  const m = verifierSources();
  assert.equal(m.fichiers.length, 9);
  assert.equal(blobGit(readFileSync(join(DOSSIER, 'sources/emprise-marseille.js'))), '3ae57a817b1426cc969ea2de6e363dd083231355');
  assert.equal(sha256(readFileSync(join(DOSSIER, 'sources/ign-grille.json'))), 'eba0bca0ff828a052254bf77047e3a0fdc54fdb31499a2020360bdda808f89c0');
  const dir = mkdtempSync(join(tmpdir(), 'bitume-marseille-'));
  try {
    cpSync(join(DOSSIER, 'sources'), join(dir, 'sources'), { recursive: true });
    cpSync(join(DOSSIER, 'sources.json'), join(dir, 'sources.json'));
    const p = join(dir, 'sources/ign-grille.json'), data = readFileSync(p);
    data[20] ^= 1; writeFileSync(p, data);
    assert.throws(() => verifierSources(dir), /Empreinte source altérée/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('toutes les données urbaines et lointaines conservent les valeurs décodées de la source', () => {
  const contexte = vm.createContext({});
  vm.runInContext(readFileSync(join(DOSSIER, 'sources/emprise-marseille.js'), 'utf8'), contexte, { timeout: 10000 });
  const original = contexte.PDR.plans.marseille;
  const normaliser = valeur => {
    if (typeof valeur === 'function') return undefined;
    if (ArrayBuffer.isView(valeur)) return [...valeur];
    if (Array.isArray(valeur)) return Array.from(valeur, normaliser);
    if (valeur && typeof valeur === 'object') return Object.fromEntries(Object.entries(valeur).filter(([, v]) => typeof v !== 'function').map(([k, v]) => [k, normaliser(v)]));
    return valeur;
  };
  assert.deepEqual(coeur, normaliser(original));
  assert.equal(coeur.rues.length, 1177);
  assert.equal(coeur.batiments.length, 5274);
  assert.equal(coeur.reperes.length, 119);
  assert.equal(coeur.lointain.reperes.length, 10);
  assert.equal(coeur.empreinte, 1651787597);
});

test('anneaux, trous et géométries métriques gardent leur orientation et leur emprise', () => {
  const aire = p => p.reduce((s, v, i) => i % 2 ? s : s + v * p[(i + 3) % p.length] - p[(i + 2) % p.length] * p[i + 1], 0) / 2;
  for (const type of ['rues', 'batiments', 'espaces', 'eau']) {
    for (const o of coeur[type]) {
      assert.equal(o.points.length % 2, 0);
      assert.ok(o.points.every(n => Number.isFinite(n) && n >= -610 && n <= 610));
      if (type === 'rues') assert.ok(o.points.length >= 4);
      else {
        assert.ok(o.points.length >= 6 && aire(o.points) > 0);
        for (const trou of o.trous) assert.ok(trou.length >= 6 && aire(trou) < 0);
      }
    }
  }
  for (const b of coeur.batiments) assert.ok(b.base >= 0 && b.hauteur > b.base);
});

test('inventaire complet : provenance par indice, niveaux source préservés, mesures absentes explicites', () => {
  assert.equal(inventaire.rues.length, coeur.rues.length);
  assert.equal(inventaire.batiments.length, coeur.batiments.length);
  assert.equal(inventaire.rues_nommees.length, 278);
  for (let i = 0; i < coeur.rues.length; i++) {
    const s = coeur.rues[i], r = inventaire.rues[i];
    assert.equal(r.source, `coeur.json#/donnees/rues/${i}`);
    assert.equal(r.nom, s.nom); assert.equal(r.pont_source, s.pont); assert.equal(r.couche_source, s.niveau);
    assert.equal(r.profil_altimetrique_m, null); assert.equal(r.largeur_mesuree_m, null); assert.equal(r.devers_mesure, null);
    assert.ok(r.longueur_polyligne_m >= Math.hypot(s.points.at(-2) - s.points[0], s.points.at(-1) - s.points[1]) - 1e-6);
  }
  for (let i = 0; i < coeur.batiments.length; i++) {
    const b = inventaire.batiments[i], s = coeur.batiments[i];
    assert.equal(b.source, `coeur.json#/donnees/batiments/${i}`);
    assert.equal(b.hauteur_fournisseur_m, s.hauteur); assert.equal(b.base_fournisseur_m, s.base);
    assert.equal(b.connue_source, s.connue); assert.equal(b.altitude_pied_m, null); assert.equal(b.hauteur_verifiee_sur_terrain_m, null);
  }
  assert.equal(inventaire.rues.filter(r => r.pont_source).length, 4);
  assert.equal(inventaire.rues.filter(r => r.couche_source === 1).length, 8);
  assert.equal(inventaire.batiments.filter(b => b.connue_source).length, 1080);
  assert.ok(inventaire.espaces_a_niveau_distinct.every(e => e.altitude_surface_m === null && e.connexion_a_une_voie_validee === false));
  assert.deepEqual(inventaire.reperes.map(r => [r.nom, r.x, r.z]), coeur.reperes.map(r => [r.nom, r.x, r.z]));
});

test('4 225 échantillons ordonnés correspondent à la requête, altitudes négatives intactes', () => {
  verifierGrille(brute, requete, acquisition);
  assert.equal(grille.echantillons.length, 65 * 65);
  for (let i = 0; i < brute.elevations.length; i++) {
    const p = grille.echantillons[i], source = brute.elevations[i];
    assert.equal(p.index, i); assert.equal(p.colonne, i % 65); assert.equal(p.ligne, Math.floor(i / 65));
    assert.equal(p.lon, source.lon); assert.equal(p.lat, source.lat); assert.equal(p.altitude_api_m, source.z); assert.equal(p.acc_api, source.acc);
  }
  const z = grille.echantillons.map(p => p.altitude_api_m);
  assert.equal(z.filter(n => n < 0).length, 14);
  assert.equal(Math.min(...z), -3.77); assert.equal(Math.max(...z), 41.74);
  const ordreFaux = structuredClone(brute);
  [ordreFaux.elevations[10], ordreFaux.elevations[11]] = [ordreFaux.elevations[11], ordreFaux.elevations[10]];
  assert.throws(() => verifierGrille(ordreFaux, requete, acquisition), /Correspondance requête/);
  const nonFini = structuredClone(brute); nonFini.elevations[0].z = NaN;
  assert.throws(() => verifierGrille(nonFini, requete, acquisition), /Valeur non finie/);
});

test('repère est/sud et résolution de reconnaissance distincts du pas source et de la précision', () => {
  const proj = projection(coeur.centre), centre = grille.echantillons[32 * 65 + 32];
  assert.equal(centre.x, 0); assert.equal(centre.z, 0);
  assert.ok(grille.echantillons[0].x < 0 && grille.echantillons[0].z > 0);
  assert.ok(grille.echantillons.at(-1).x > 0 && grille.echantillons.at(-1).z < 0);
  for (const p of grille.echantillons) {
    const ll = proj.inverse(p.x, p.z);
    assert.ok(Math.abs(ll.lon - p.lon) < 1e-10 && Math.abs(ll.lat - p.lat) < 1e-10);
  }
  assert.ok(grille.pas_echantillonnage_local.est_m > 19 && grille.pas_echantillonnage_local.est_m < 20);
  assert.ok(grille.pas_echantillonnage_local.nord_m > 19 && grille.pas_echantillonnage_local.nord_m < 20);
  assert.equal(grille.pas_ressource_annonce_m, 0.5);
  assert.equal(grille.vertical.erreur_bornee_m, null);
  assert.equal(grille.vertical.datum_reponse_confirme, null);
  assert.equal(grille.vertical.interpolation_ajoutee, false);
  const q = lire('qualification.json');
  assert.equal(q.altimetrie.points_hors_bbox_annoncee, 4225);
  const bonneMere = inventaire.reperes_lointains.find(r => r.modele === 'garde');
  assert.equal(bonneMere.couvert_par_grille, false);
  assert.equal(bonneMere.altitude_sol_m, null);
});

test('reconstruction hors réseau identique des quatre JSON versionnés', () => {
  for (const [fichier, contenu] of Object.entries(preparer())) assert.equal(readFileSync(join(DOSSIER, fichier), 'utf8'), contenu, fichier);
});
