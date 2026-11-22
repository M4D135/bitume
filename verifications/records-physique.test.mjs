import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const records = createRequire(import.meta.url)('../src/records.js');
const jeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const { PHYSIQUE, CLE_RECORDS, CLE_FANTOME } = new Function(
  jeu.match(/  const PHYSIQUE = .*?;/)[0] + ' return { PHYSIQUE, CLE_RECORDS, CLE_FANTOME };')();

test('une installation p15 retrouve son historique et réserve les nouveaux records et fantômes à p16', () => {
  const contexte = { circuitId: 'val-brule', sens: 'normal', mode: 'chrono', boite: 'auto' };
  const enrichi = { 'bitume:baikal:normal:course:manuelle:p15': { meilleurTourMs: 82500, meilleureCourseMs: null } };
  const mem = new Map([
    ['bitume.records.p15', JSON.stringify({ 'val-brule': { tour: 78.26, mode: 'chrono' } })],
    ['bitume.fantome.p15.val-brule', JSON.stringify({ b64: 'ancien', n: 6 })],
    ['bitume.records.v2', JSON.stringify(enrichi)]
  ]);
  const stock = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const anciens = new Map(mem), catalogue = [{ id: 'val-brule' }];
  const table = records.lireTout(stock, catalogue);
  assert.equal(PHYSIQUE, 'p16'); assert.equal(records.VERSION_PHYSIQUE, PHYSIQUE);
  assert.equal(records.meilleur(table, { ...contexte, versionPhysique: 'p15' }).meilleurTourMs, 78260);
  assert.equal(records.meilleur(table, contexte), null);
  assert.equal(records.meilleurCircuit(table, 'val-brule'), null);
  assert.equal(stock.getItem(CLE_FANTOME + 'val-brule'), null);
  assert.equal(stock.getItem(CLE_RECORDS), null);
  assert.deepEqual(mem, anciens);
  records.enregistrer(table, contexte, { tourMs: 92345 });
  records.sauverTout(table, stock);
  const relue = records.lireTout(stock, catalogue);
  assert.equal(records.meilleurCircuit(relue, 'val-brule').meilleurTourMs, 92345);
  assert.equal(records.meilleurCircuit(relue, 'val-brule', 'p15').meilleurTourMs, 78260);
  assert.equal(records.meilleurCircuit(relue, 'baikal', 'p15').meilleurTourMs, 82500);
  assert.deepEqual(relue, table);
  for (const [k,v] of anciens) assert.equal(stock.getItem(k), v);
  assert.deepEqual(Object.keys(JSON.parse(stock.getItem(records.STORAGE_KEY))), [records.cle(contexte)]);
  // Un onglet resté sur l’ancienne version peut encore enregistrer ses propres résultats.
  stock.setItem('bitume.records.v2', JSON.stringify({ ...enrichi,
    'bitume:baikal:normal:chrono:auto:p15': { meilleurTourMs:71000, meilleureCourseMs:null } }));
  assert.equal(records.meilleurCircuit(records.lireTout(stock,catalogue),'baikal','p15').meilleurTourMs,71000);
  assert.equal(records.meilleurCircuit(records.lireTout(stock,catalogue),'val-brule').meilleurTourMs,92345);
});

test('les anciennes tables p15 par indice sans catalogue daté restent consultables après la fusion des circuits', () => {
  const table = records.lireTout({ getItem(k) { return k === 'bitume.records.p15' ? '[null,{"tour":60}]' : null; } },
    [{id:'val-brule'}, {id:'marseille'}]);
  assert.equal(records.meilleurCircuit(table, 'circuit_1', 'p15').meilleurTourMs, 60000);
  assert.equal(records.meilleurCircuit(table, 'marseille','p15'), null);
});
