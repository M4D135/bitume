import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const records = createRequire(import.meta.url)('../src/records.js');
const jeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const { PHYSIQUE, CLE_RECORDS, CLE_FANTOME } = new Function(
  jeu.match(/  const PHYSIQUE = .*?;/)[0] + ' return { PHYSIQUE, CLE_RECORDS, CLE_FANTOME };')();

test('une installation p15 retrouve son historique et réserve les nouveaux records et fantômes à la physique du jeu', () => {
  const contexte = { circuitId: 'val-brule', sens: 'normal', mode: 'chrono', boite: 'auto' };
  const enrichi = { 'bitume:baikal:normal:course:manuelle:p15': { meilleurTourMs: 82500, meilleureCourseMs: null } };
  const mem = new Map([
    ['bitume.records.p15', JSON.stringify({ 'val-brule': { tour: 78.26, mode: 'chrono' } })],
    ['bitume.fantome.p15.val-brule', JSON.stringify({ b64: 'ancien', n: 6 })],
    ['bitume.records.v2.p54',JSON.stringify({'bitume:val-brule:normal:chrono:auto:p54':{meilleurTourMs:90100,meilleureCourseMs:null}})],
    ['bitume.records.v2', JSON.stringify(enrichi)]
  ]);
  const stock = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const anciens = new Map(mem), catalogue = [{ id: 'val-brule' }];
  const table = records.lireTout(stock, catalogue);
  assert.equal(records.VERSION_PHYSIQUE, PHYSIQUE);
  assert.equal(records.STORAGE_KEY,'bitume.records.v2.'+PHYSIQUE);
  assert.equal(records.meilleurCircuit(table,'val-brule','p54').meilleurTourMs,90100);
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

test('finTour persiste son chrono enrichi sous la clé que le jeu relit', () => {
  const mem=new Map(), stock={get length(){return mem.size;},key:i=>[...mem.keys()][i],getItem:k=>mem.get(k)??null};
  const file=[], catalogue=[{id:'val-brule'}];
  const fabriquer=new Function('B','CATALOGUE','recordsEnrichis','PHYSIQUE','CLE_RECORDS','differerStock',`
    const records={}, reglages={boite:'manuelle'}, chrono=String, sousMessage=()=>{}, message=()=>{};
    ${jeu.slice(jeu.indexOf('  function finTour('),jeu.indexOf('  function finTourJ2('))}
    return finTour;`);
  const finTour=fabriquer({records},catalogue,{},PHYSIQUE,CLE_RECORDS,(k,v)=>file.push([k,v]));
  finTour({i:0,profil:new Float32Array(3),course:{mode:'course',joueur:{tours:1},toursTotal:3}},
    {tour:1,temps:92.345,meilleur:true});
  for(const [k,v] of file)mem.set(k,JSON.stringify(typeof v==='function'?v():v));
  const contexte={circuitId:'val-brule',sens:'normal',mode:'course',boite:'manuelle',versionPhysique:PHYSIQUE};
  assert.equal(JSON.parse(mem.get(records.STORAGE_KEY))[records.cle(contexte)].meilleurTourMs,92345);
  assert.equal(records.meilleur(records.lireTout(stock,catalogue),contexte).meilleurTourMs,92345);
});
