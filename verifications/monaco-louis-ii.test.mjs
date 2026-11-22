// Les joints XY aux niveaux concurrents doivent rester distincts, même au même niveau ordinal.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../tools/qualifier-monaco-louis-ii.py', import.meta.url));
const json = JSON.parse(readFileSync(new URL('../docs/references/monaco-2026/louis-ii-raccords.json', import.meta.url)));

test('les acquisitions complètes et le tracé figé reproduisent exactement le résultat publié', () => {
  const run = spawnSync('python3', [script, '--check'], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(json.uniqueRoadObjects, 9);
  assert.equal(json.readyForRuntime, false);
  assert.equal(json.measuredRacePortals, null);
  assert.equal(json.roadAltitudeDatum, null);
});

test('la voie Louis-II est plus proche sur tout le second intervalle OSM couvert', () => {
  assert.deepEqual(json.osmEdges.map(e => e.osmEdge), Array.from({length: 26}, (_, i) => 219 + i));
  assert.equal(json.minimumLowerBoundMarginM, Math.min(...json.osmEdges.map(e => e.lowerBoundMarginM)));
  assert.ok(json.minimumLowerBoundMarginM > 9.7);
});

test('les raccords Louis-II et le saut intérieur restent localisés dans l’ordre IGN', () => {
  const tunnel = json.axes.find(a => a.cleabs.endsWith('74447'));
  for (const p of tunnel.endpointsInSourceOrder) {
    assert.equal(p.coincidentEndpointsXY.length, 1);
    assert.equal(p.coincidentEndpointsXY[0].name, 'BD LOUIS II');
    assert.equal(p.coincidentEndpointsXY[0].relativeLevel, '0');
    assert.equal(p.coincidentEndpointsXY[0].deltaZSourceM, 0);
  }
  const [saut] = tunnel.sourceGradeSegmentsToReview;
  assert.equal(saut.segmentIndex, 0);
  assert.equal(saut.horizontalLengthM, 2.764877);
  assert.equal(saut.sourceGrade, 2.387086);
  assert.ok(Math.abs(saut.sourceDeltaZM - 6.6) < 1e-10);
  assert.equal(saut.cause, 'unknown');
  assert.equal(saut.isQualifiedRoadGrade, false);
});

test('au même XY et au niveau −1 le voisin a trois raccords possibles à deux Z distincts', () => {
  const voisin = json.axes.find(a => a.cleabs.endsWith('74448'));
  const [sortie, entree] = voisin.endpointsInSourceOrder;
  assert.equal(sortie.coincidentEndpointsXY[0].name, 'BD DU LARVOTTO');
  assert.equal(entree.zSourceM, 11.4);
  assert.deepEqual(entree.coincidentEndpointsXY.map(p => p.deltaZSourceM), [7.6, 0, 7.6]);
  assert.ok(entree.coincidentEndpointsXY.every(p => p.relativeLevel === '-1'));
});
