import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DOSSIER, sha256 } from '../tools/preparer-marseille-15ab.mjs';
import { contient, rattacher, verifierDalles, preparerMetadonnees } from '../tools/preparer-marseille-metadonnees.mjs';

const lire = nom => JSON.parse(readFileSync(join(DOSSIER, nom), 'utf8'));
const manifeste = lire('sources-metadonnees.json');
const dalles = lire(manifeste.fichier), grille = lire('grille.json');

test('nouvelle acquisition WFS intègre quatre dalles complètes et conserve ses dates source', () => {
  const fs = verifierDalles(dalles);
  assert.equal(fs.length, 4);
  for (const f of fs) {
    assert.equal(f.properties.systeme_altimetrique, 'IGN69');
    assert.equal(f.properties.systeme_planimetrique, 'LAMB93');
    assert.equal(f.properties.code_mission, '21LHD7PQ');
    assert.equal(f.properties.date_debut_acquisition, '2021-06-26Z');
    assert.equal(f.properties.date_fin_acquisition, '2021-10-17Z');
    assert.equal(f.properties.date_edition, '2025-03-14Z');
  }
  const partielle = structuredClone(dalles); partielle.features.pop();
  assert.throws(() => verifierDalles(partielle), /Réponse WFS incomplète/);
  const dupliquee = structuredClone(dalles); dupliquee.features[1].id = dupliquee.features[0].id;
  assert.throws(() => verifierDalles(dupliquee), /Identifiant dalle absent ou répété/);
  const anneau = structuredClone(dalles); anneau.features[0].geometry.coordinates[0][0].pop();
  assert.throws(() => verifierDalles(anneau), /Anneau non fermé/);
});

test('rattachement des 4 225 points confirmé par nombres d’enroulement indépendants', () => {
  const r = rattacher(grille.echantillons, dalles);
  const angle = (p, ring) => {
    let somme = 0;
    for (let k = 1; k < ring.length; k++) {
      const ax = ring[k - 1][0] - p.lon, ay = ring[k - 1][1] - p.lat;
      const bx = ring[k][0] - p.lon, by = ring[k][1] - p.lat;
      somme += Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    }
    return Math.abs(somme) > Math.PI;
  };
  const independant = new Map(dalles.features.map(f => [f.id, []]));
  for (const p of grille.echantillons) for (const f of dalles.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    if (polys.some(([outer, ...holes]) => angle(p, outer) && !holes.some(h => angle(p, h)))) independant.get(f.id).push(p.index);
  }
  for (const [id, indices] of r.groupes) assert.deepEqual(indices, independant.get(id), id);
  assert.deepEqual(r.sansDalle, []);
  assert.deepEqual(r.ambigus, []);
  assert.equal([...r.groupes.values()].reduce((n, v) => n + v.length, 0), 4225);
});

test('trous, recouvrements, frontières et absences ne choisissent aucune dalle en silence', () => {
  const carre = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  const g = { type: 'Polygon', coordinates: [carre(0, 0, 4, 4), carre(1, 1, 3, 3)] };
  assert.equal(contient(g, [0.5, 0.5]), true);
  assert.equal(contient(g, [2, 2]), false);
  assert.equal(contient(g, [1, 2]), true);
  assert.equal(contient(g, [5, 2]), false);
  const fixture = { type: 'FeatureCollection', numberMatched: 2, numberReturned: 2, totalFeatures: 2,
    crs: { properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
    features: [
      { id: 'a', properties: {}, geometry: { type: 'Polygon', coordinates: [carre(0, 0, 2, 2)] } },
      { id: 'b', properties: {}, geometry: { type: 'Polygon', coordinates: [carre(2, 0, 4, 2)] } },
    ] };
  const r = rattacher([
    { index: 0, lon: 2, lat: 1, altitude_api_m: null },
    { index: 1, lon: 5, lat: 1, altitude_api_m: -99999 },
    { index: 2, lon: 1, lat: 1, altitude_api_m: -3.77 },
  ], fixture);
  assert.deepEqual(r.ambigus, [{ index: 0, dalles: ['a', 'b'] }]);
  assert.deepEqual(r.sansDalle, [1]);
  assert.deepEqual(r.sansAltitude, [0, 1]);
});

test('empreintes des acquisitions et dérivés historiques contrôlées, altération rejetée', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bitume-marseille-metadata-'));
  try {
    cpSync(DOSSIER, dir, { recursive: true });
    const f = join(dir, manifeste.fichier), initial = readFileSync(f);
    const corrompu = Buffer.from(initial); corrompu[12] ^= 1; writeFileSync(f, corrompu);
    assert.throws(() => preparerMetadonnees(dir), /Empreinte WFS altérée/);
    writeFileSync(f, initial);
    const g = join(dir, 'grille.json'), bytes = readFileSync(g); bytes[30] ^= 1; writeFileSync(g, bytes);
    assert.throws(() => preparerMetadonnees(dir), /Empreinte historique altérée/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('rapport reproductible sans transformer les métadonnées terrain en qualification de chaussée', () => {
  const empreintes = manifeste.entrees_historiques.map(e => sha256(readFileSync(join(DOSSIER, e.fichier))));
  const sorties = preparerMetadonnees();
  for (const [nom, texte] of Object.entries(sorties)) assert.equal(texte, readFileSync(join(DOSSIER, nom), 'utf8'));
  const r = JSON.parse(sorties['metadonnees-grille.json']);
  assert.equal(r.readyForRuntime, false);
  assert.equal(r.interpretation.lien_api_dalle_prouve, false);
  assert.equal(r.interpretation.datum_individuel_grille_confirme, null);
  assert.equal(r.interpretation.incertitude_verticale_m, null);
  assert.equal(r.bilan.contradiction_bbox_ressource_historique.resolue, false);
  assert.equal(r.bilan.contradiction_bbox_ressource_historique.points_hors_bbox_annoncee, 4225);
  assert.deepEqual(manifeste.entrees_historiques.map(e => sha256(readFileSync(join(DOSSIER, e.fichier)))), empreintes);
  assert.equal(grille.echantillons.filter(p => p.altitude_api_m < 0).length, 14);
});
