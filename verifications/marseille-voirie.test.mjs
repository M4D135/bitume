// Préparation uniquement ; aucun runtime, réseau ou build.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { projection } from '../tools/preparer-marseille-15ab.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = join(root, 'docs/references/marseille-2026');
const script = join(root, 'tools/preparer-marseille-voirie.py');
const outputs = ['voirie-corridor-p05.json', 'voirie-corridor-p05.md'];
const read = (d, p) => JSON.parse(readFileSync(join(d, p), 'utf8'));
const save = (d, p, v) => writeFileSync(join(d, p), JSON.stringify(v, null, 2) + '\n');
const hash = b => createHash('sha256').update(b).digest('hex');
const run = (d, ...args) => spawnSync('python3', [script, '--directory', d, ...args], { encoding: 'utf8', timeout: 15000 });
const ok = r => assert.equal(r.status, 0, r.stderr || r.stdout);
const bad = r => assert.notEqual(r.status, 0, 'Données incohérentes acceptées');
const snapshot = (d, except = []) => readdirSync(d, { recursive: true }).sort()
  .filter(p => !except.includes(p) && statSync(join(d, p)).isFile())
  .map(p => [p, hash(readFileSync(join(d, p))), statSync(join(d, p)).mtimeMs]);
function fixture(fn) {
  const d = mkdtempSync(join(tmpdir(), 'marseille-voirie-'));
  try { cpSync(folder, d, { recursive: true }); fn(d); }
  finally { rmSync(d, { recursive: true, force: true }); }
}

test('305 objets sources conservés avec leurs propriétés ; aucune acquisition close réécrite', () => fixture(d => {
  const before = snapshot(d, outputs); ok(run(d)); assert.deepEqual(snapshot(d, outputs), before);
  const r = read(d, outputs[0]), m = read(d, 'sources-voirie-corridor-p05.json');
  assert.equal(r.readyForRuntime, false); assert.equal(r.networkUsed, false);
  assert.equal(r.summary.sourceFeatures, 305); assert.equal(r.summary.roadAxes, 229); assert.equal(r.summary.constructionAxes, 76);
  for (const s of m.sources) {
    const data = read(d, s.file);
    for (let i = 0; i < data.features.length; i++) {
      const f = data.features[i], a = r.axes.find(a => a.sourceId === s.id && a.cleabs === f.properties.cleabs);
      assert.deepEqual(a.properties, f.properties); assert.equal(a.locator, `features[${i}]`);
      assert.equal(a.sourceVertexCount, f.geometry.coordinates.length);
      for (const k of ['individualMeasurementDate', 'verticalDatum', 'roadAltitudeM', 'raceWidthM', 'leftWidthM', 'rightWidthM', 'bankRadians']) assert.equal(a[k], null);
      assert.equal(a.eligibleForRoadProfile, false); assert.equal(a.widthIsRaceBoundary, false);
      assert.equal(a.metadataDatesAreMeasurementDates, false);
    }
  }
}));

test('treize polylignes EMPRISE exactes, douze raccords, ouverture et inconnus routiers conservés', () => {
  const r = read(folder, outputs[0]), c = read(folder, 'coeur.json').donnees;
  assert.equal(r.corridor.segments.length, 13); assert.equal(r.corridor.exactXZJoins, 12);
  assert.equal(r.corridor.closed, false); assert.equal(r.corridor.roadLevelsConfirmed, false);
  assert.equal(r.corridor.raceDirectionSelected, false); assert.equal(r.corridor.lengthIsCertifiedCourseLength, false);
  assert.equal(r.corridor.startXZ[0], -610); assert.equal(r.corridor.endXZ[0], -610);
  assert.notDeepEqual(r.corridor.startXZ, r.corridor.endXZ);
  let last = null, total = 0;
  for (const s of r.corridor.segments) {
    const original = c.rues[s.indexRue], pts = [];
    for (let i = 0; i < original.points.length; i += 2) pts.push(original.points.slice(i, i + 2));
    if (s.orientation < 0) { pts.reverse(); assert.equal(original.sens, 0); }
    assert.deepEqual(s.pointsXZ, pts); if (last) assert.deepEqual(pts[0], last); last = pts.at(-1);
    total += pts.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    for (const k of ['selectedRoadAxisId', 'roadAltitudeM', 'leftWidthM', 'rightWidthM', 'bankRadians']) assert.equal(s[k], null);
  }
  assert(Math.abs(total - r.corridor.sourcePolylineLengthM) < 1e-8);
});

test('repère Marseille vérifié indépendamment : X est, Z sud, aucun réemploi de la projection Monaco', () => {
  const r = read(folder, outputs[0]), p = projection(read(folder, 'coeur.json').donnees.centre);
  for (const e of r.tunnelSourceEndpoints) {
    const expected = p.convertir(e.lon, e.lat);
    assert(Math.abs(e.x - expected.x) < 1e-9); assert(Math.abs(e.z - expected.z) < 1e-9);
  }
  assert.equal(r.projection.axes, 'x est, z sud ; altitude_api_m séparée de z');
  assert.equal(r.projection.kx_m_par_degre, p.kx); assert.equal(r.projection.kz_m_par_degre, p.kz);
});

test('Pas de Z/9999, liaisons maritimes et fictifs exclus ; largeurs brutes jamais divisées', () => {
  const r = read(folder, outputs[0]), roads = r.axes.filter(a => a.kind === 'road_axis');
  assert.equal(r.summary.roadAxesWithExcludedZ, 23); assert.equal(r.summary.excludedNonRoadOrFictitiousAxes, 41);
  assert.deepEqual(r.summary.sourceLevelsRoads, { 0: 225, '-1': 4 });
  for (const a of roads) {
    if (a.properties.precision_altimetrique === 9999 || a.properties.methode_d_acquisition_altimetrique === 'Pas de Z') {
      assert.equal(a.validSourceZRangeM, null);
      assert.equal(a.sourceZExcludedVertexIndices.length, a.sourceVertexCount);
      assert(a.sourceZExclusionReasons.includes('source_has_no_z'));
    }
    if (a.properties.fictif || a.properties.nature === 'Bac ou liaison maritime') {
      assert.equal(a.excludedFromRoadReview, true); assert.equal(a.validSourceZRangeM, null);
    }
    assert.equal(a.sourceWidthRaw, a.properties.largeur_de_chaussee ?? null);
    assert.equal(a.leftWidthM, null); assert.equal(a.rightWidthM, null);
  }
  assert(r.axes.some(a => a.validSourceZRangeM?.[0] < 0), 'Altitudes négatives valides conservées');
});

test('tunnels : huit extrémités, jonction triple et variations Z signalées sans portail inventé', () => {
  const r = read(folder, outputs[0]); assert.equal(r.tunnelSourceEndpoints.length, 8);
  assert.equal(r.summary.confirmedPortals, 0);
  assert.equal(r.tunnelSourceEndpoints.filter(e => e.sameXYZEndpointOccurrences === 3).length, 3);
  for (const e of r.tunnelSourceEndpoints) {
    assert.equal(e.confirmedCircuitPortal, false); assert.equal(e.circuitClearanceM, null);
    const a = r.axes.find(a => a.id === e.axisId), f = read(folder, a.sourceFile).features.find(f => f.properties.cleabs === a.cleabs);
    assert.deepEqual([e.lon, e.lat, e.sourceZM], f.geometry.coordinates[e.vertexIndex]);
  }
  const a = r.axes.find(a => a.cleabs === 'CONSLINE0000002150241872');
  assert.equal(a.sourceGradeSegmentsToReview.length, 2);
  const down = a.sourceGradeSegmentsToReview.find(s => s.segmentIndex === 2);
  assert.equal(down.sourceDeltaZM, -1.5); assert(down.horizontalLengthM > 2.65 && down.horizontalLengthM < 2.66);
  assert.equal(down.isQualifiedRoadGrade, false); assert.equal(down.cause, 'unknown');
  assert.equal(r.sourceGradeReview.thresholdIsPhysicsLimit, false);
  assert(r.sameGeometryRecords.some(p => p.axisIds.includes(a.id) && p.axisIds.includes('bdtopo-quais:TRONROUT0000000040966024') && !p.independentCorroboration));
});

test('captures altérées, tronquées, faux datum et raccords cassés refusés sans écriture ; --check reproductible', () => {
  for (const mode of ['hash', 'count', 'datum', 'join']) fixture(d => {
    const m = read(d, 'sources-voirie-corridor-p05.json');
    if (mode === 'hash') writeFileSync(join(d, m.sources[0].file), '{}');
    if (mode === 'count') {
      const s = m.sources[0], doc = read(d, s.file); doc.numberMatched++;
      save(d, s.file, doc); const b = readFileSync(join(d, s.file)); s.bytes = b.length; s.sha256 = hash(b);
    }
    if (mode === 'datum') m.sources[0].verticalDatum = 'IGN69';
    if (mode === 'join') [m.corridorSelection[2], m.corridorSelection[3]] = [m.corridorSelection[3], m.corridorSelection[2]];
    save(d, 'sources-voirie-corridor-p05.json', m); const before = snapshot(d); bad(run(d)); assert.deepEqual(snapshot(d), before);
  });
  const before = snapshot(folder); ok(run(folder, '--check')); assert.deepEqual(snapshot(folder), before);
});
