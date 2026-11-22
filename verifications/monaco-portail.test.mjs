import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = new URL('../docs/references/monaco-2026/', import.meta.url);
const lire = nom => JSON.parse(readFileSync(new URL(nom, base), 'utf8'));
const r = lire('louis-ii-portail.json'), p = id => r.coupes.find(c => c.id === id);
test('qualification rejouée à partir des 45 positions et des captures figées', () => {
  execFileSync('python3', ['tools/qualifier-monaco-portail.py', '--check'], { cwd:new URL('../',import.meta.url) });
  assert.equal(r.coupes.length,9);
  assert.deepEqual(r.coupes.map(c=>c.indicesReponses),Array.from({length:9},(_,i)=>[i*5,i*5+4]));
  assert.deepEqual(r.deportsApproximatifsM,[-5,-2,0,2,5]);
});
test('les trois surfaces discordantes et leurs coordonnées image restent attribuées à leur source', () => {
  assert.equal(r.distanceHorizontaleT0T1M,2.765);
  for(const [id,zVoirie,zLidar,zRge,pixel] of [
    ['T0',6.9,7.46,7.41,[251.01,181.39]], ['T1',13.5,8.19,7.38,[268.42,168.05]], ['T2',13.4,13.37,13.39,[354.48,133.13]]]){
    const c=p(id);
    assert.deepEqual([c.zVoirieM,c.mntLidarM[2],c.rgeAltiM[2],c.pixelOrthoDepuisBordHautGauche],[zVoirie,zLidar,zRge,pixel]);
  }
  assert.deepEqual(p('T1').mntLidarM,[13.5,7.98,8.19,7.42,7.39]);
  assert.equal(p('T3').rgeAltiM[2],33.33);
  assert.equal(p('T3').mntLidarM[2],13.85);
  assert.equal(r.altitudeCourse2026M,null); assert.equal(r.readyForRuntime,false);
});
test('les trois repères du nivellement et les deux dates de vol restent distincts', () => {
  assert.deepEqual(r.reperesDeNivellementDistincts.map(p=>[p.id,p.altitudeDuRepereM]),[[525299,7.5],[526864,8.186],[526865,7.917]]);
  const [,pilier,escalier]=r.reperesDeNivellementDistincts;
  assert.deepEqual(pilier.crs84LocalisationIndicative,escalier.crs84LocalisationIndicative);
  assert.deepEqual(r.datesVolDansEmprise,['2023-06-26Z','2023-07-10Z']);
});
