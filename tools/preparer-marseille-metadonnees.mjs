#!/usr/bin/env node
/** Rattachement spatial des métadonnées LiDAR : aucune altitude de chaussée produite. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOSSIER, sha256, verifierSources } from './preparer-marseille-15ab.mjs';

const lire = p => JSON.parse(readFileSync(p, 'utf8'));
const json = valeur => JSON.stringify(valeur, null, 2) + '\n';
const EPS = 1e-12; // Tolérance arithmétique en degrés, jamais précision de la source.

function dansAnneau(p, anneau) {
  let dedans = false;
  for (let i = 1; i < anneau.length; i++) {
    const a = anneau[i - 1], b = anneau[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], px = p[0] - a[0], py = p[1] - a[1];
    const l2 = dx * dx + dy * dy, t = l2 ? (px * dx + py * dy) / l2 : 0;
    const tc = Math.max(0, Math.min(1, t));
    if (Math.hypot(px - tc * dx, py - tc * dy) <= EPS) return 'bord';
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < a[0] + (p[1] - a[1]) * dx / dy) dedans = !dedans;
  }
  return dedans ? 'dedans' : 'dehors';
}

export function contient(geometrie, p) {
  const polygones = geometrie.type === 'Polygon' ? [geometrie.coordinates] : geometrie.coordinates;
  return polygones.some(([exterieur, ...trous]) => {
    if (dansAnneau(p, exterieur) === 'dehors') return false;
    // Une frontière reste candidate ; ne pas choisir silencieusement un côté.
    return !trous.some(trou => dansAnneau(p, trou) === 'dedans');
  });
}

export function verifierDalles(collection) {
  assert.equal(collection.type, 'FeatureCollection', 'Collection WFS attendue');
  assert.ok(Array.isArray(collection.features) && collection.features.length, 'Dalles absentes');
  for (const champ of ['numberMatched', 'numberReturned', 'totalFeatures']) {
    assert.equal(collection[champ], collection.features.length, `Réponse WFS incomplète : ${champ}`);
  }
  assert.equal(collection.crs?.properties?.name, 'urn:ogc:def:crs:EPSG::4326', 'CRS GeoJSON inattendu');
  const ids = new Set();
  for (const f of collection.features) {
    assert.ok(typeof f.id === 'string' && f.id.length && !ids.has(f.id), 'Identifiant dalle absent ou répété');
    ids.add(f.id);
    assert.ok(f.properties && typeof f.properties === 'object', 'Propriétés de dalle absentes');
    assert.ok(['MultiPolygon', 'Polygon'].includes(f.geometry?.type), 'Emprise polygonale attendue');
    const polygones = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    assert.ok(Array.isArray(polygones) && polygones.length, 'Polygones absents');
    for (const polygone of polygones) {
      assert.ok(Array.isArray(polygone) && polygone.length, 'Anneau extérieur absent');
      for (const anneau of polygone) {
        assert.ok(Array.isArray(anneau) && anneau.length >= 4, 'Anneau incomplet');
        for (const p of anneau) assert.ok(Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
          && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90, 'Coordonnées invalides');
        assert.deepEqual(anneau[0], anneau.at(-1), 'Anneau non fermé');
      }
    }
  }
  return [...collection.features].sort((a, b) => a.id.localeCompare(b.id));
}

export function rattacher(echantillons, collection) {
  const dalles = verifierDalles(collection);
  const groupes = new Map(dalles.map(d => [d.id, []])), sansDalle = [], ambigus = [], sansAltitude = [];
  for (let i = 0; i < echantillons.length; i++) {
    const p = echantillons[i];
    assert.equal(p.index, i, 'Indice de grille altéré');
    assert.ok([p.lon, p.lat].every(Number.isFinite), 'Coordonnées de grille invalides');
    assert.ok(p.altitude_api_m === null || Number.isFinite(p.altitude_api_m), 'Altitude non finie');
    if (p.altitude_api_m === null || p.altitude_api_m === -99999) sansAltitude.push(i);
    const candidats = dalles.filter(d => contient(d.geometry, [p.lon, p.lat])).map(d => d.id);
    for (const id of candidats) groupes.get(id).push(i);
    if (!candidats.length) sansDalle.push(i);
    if (candidats.length > 1) ambigus.push({ index: i, dalles: candidats });
  }
  return { dalles, groupes, sansDalle, ambigus, sansAltitude };
}

export function preparerMetadonnees(dossier = DOSSIER) {
  const m = lire(join(dossier, 'sources-metadonnees.json'));
  assert.equal(m.schema, 1, 'Schéma de manifeste inattendu');
  for (const e of m.entrees_historiques) {
    const brut = readFileSync(join(dossier, e.fichier));
    assert.equal(brut.length, e.octets, `Taille historique altérée : ${e.fichier}`);
    assert.equal(sha256(brut), e.sha256, `Empreinte historique altérée : ${e.fichier}`);
  }
  const historique = verifierSources(dossier);
  const brut = readFileSync(join(dossier, m.fichier));
  assert.equal(m.acquisition.status, 200, 'Acquisition WFS non réussie');
  assert.equal(brut.length, m.acquisition.bytes, 'Taille WFS altérée');
  assert.equal(sha256(brut), m.acquisition.sha256, 'Empreinte WFS altérée');
  const collection = JSON.parse(brut);
  const grille = lire(join(dossier, 'grille.json')), q = lire(join(dossier, 'qualification.json'));
  const r = rattacher(grille.echantillons, collection);
  const rapport = {
    schema: 1,
    statut: 'metadonnees_locales_rattachees_spatialement_sans_validation_individuelle_api',
    readyForRuntime: false,
    fichier_grille: 'grille.json',
    source_grille: historique.fichiers.find(f => f.id === 'ign-grille'),
    source_metadonnees: { fichier: m.fichier, sha256: m.acquisition.sha256, octets: m.acquisition.bytes,
      url: m.acquisition.url, date_http: m.acquisition.headers.date, timestamp_wfs: collection.timeStamp },
    entrees_historiques: m.entrees_historiques,
    interpretation: {
      nature: 'MNT et emprises de dalles ; pas surfaces de chaussée',
      lien_api_dalle_prouve: false,
      datum_individuel_grille_confirme: null,
      date_individuelle_grille_confirmee: null,
      incertitude_verticale_m: null,
      longueur_largeurs_devers_portails_deduits: false,
      methode: 'Point dans les polygones WFS ; frontières et recouvrements conservés comme candidats multiples.',
      epsilon_numerique_degres: EPS,
    },
    bilan: { points: grille.echantillons.length, dalles: r.dalles.length,
      points_avec_une_seule_dalle: grille.echantillons.length - r.sansDalle.length - r.ambigus.length,
      points_sans_dalle: r.sansDalle.length, points_avec_plusieurs_dalles: r.ambigus.length,
      points_sans_altitude: r.sansAltitude.length,
      contradiction_bbox_ressource_historique: {
        points_hors_bbox_annoncee: q.altimetrie.points_hors_bbox_annoncee,
        cause: null, resolue: false,
        constat: 'Les emprises WFS apportent une preuve de métadonnées locales ; elles ne corrigent pas le descriptif de ressource archivé ni ne prouvent la provenance individuelle de ses valeurs API.',
      },
    },
    rattachements: r.dalles.map(d => ({ id: d.id, localisateur: `${m.fichier}#feature=${d.id}`,
      dalle: d.properties.coordonnees_nw ?? null, mission: d.properties.code_mission ?? null,
      systeme_altimetrique_source: d.properties.systeme_altimetrique ?? null,
      systeme_planimetrique_source: d.properties.systeme_planimetrique ?? null,
      date_debut_acquisition_source: d.properties.date_debut_acquisition ?? null,
      date_fin_acquisition_source: d.properties.date_fin_acquisition ?? null,
      date_edition_source: d.properties.date_edition ?? null,
      url_mnt_source: d.properties.url_mnt ?? null,
      indices_grille: r.groupes.get(d.id), nombre_points: r.groupes.get(d.id).length })),
    sans_dalle: r.sansDalle, ambigus: r.ambigus, sans_altitude: r.sansAltitude,
    inconnus_conserves: [
      'Dalle et date exactes de chaque échantillon API ; la réponse close ne fournit pas ces identifiants.',
      'Incertitude verticale locale ; pas de borne déduite du pas de 50 cm.',
      'Corridor de course ; altitudes des chaussées, ponts et quais ; largeurs, dévers et portails.',
    ],
  };
  return { 'metadonnees-grille.json': json(rapport) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--check'),
    'Usage : node tools/preparer-marseille-metadonnees.mjs [--check]');
  for (const [nom, contenu] of Object.entries(preparerMetadonnees())) {
    if (args.includes('--check')) assert.equal(readFileSync(join(DOSSIER, nom), 'utf8'), contenu, `Sortie différente : ${nom}`);
    else writeFileSync(join(DOSSIER, nom), contenu);
  }
  console.log('Marseille : métadonnées de dalles rapprochées hors réseau ; grille et chaussée inchangées.');
}
