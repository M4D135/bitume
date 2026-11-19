// Les mesures de chaussee ci-dessous sont synthetiques, jamais des releves Monaco.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
const tools=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../tools');
const program=`import json,sys
sys.path.insert(0,sys.argv[1])
from monaco_mesures import construire_registre
p=json.load(sys.stdin); before=json.dumps(p,sort_keys=True)
try:
 r=construire_registre(p['data'],p['manifest'],p['registry'])
 print(json.dumps({'result':r,'unchanged':before==json.dumps(p,sort_keys=True)},allow_nan=False))
except ValueError as e:
 print(str(e),file=sys.stderr); sys.exit(2)
`;
const observation=(extra={})=>({id:'synthetic-1',osmNodeId:101,quantity:'altitudeM',value:0,
 unit:'m',kind:'chaussee',sourceId:'synthetic-survey',locator:'record:1',date:'2021-01-01',
 uncertainty:0,verticalDatum:'SYNTHETIC-DATUM',...extra});
const payload=(observations=[observation()])=>({
 data:{points:[101,102,103].map(osmNodeId=>({osmNodeId,y:null,leftWidthM:null,rightWidthM:null,bankRadians:null})),
  tunnelTags:[{firstEdgeIndex:1,lastEdgeIndex:1}]},
 manifest:{sources:[{id:'synthetic-survey'}]},
 registry:{format:'bitume-monaco-measurements',version:1,observations}});
function run(p,raw=JSON.stringify(p)){
 return spawnSync('python3',['-B','-c',program,tools],{input:raw,encoding:'utf8'});
}
function accepted(p){const r=run(p);assert.equal(r.status,0,r.stderr);const v=JSON.parse(r.stdout);
 assert(v.unchanged,'aucune mutation des donnees ou observations');return v.result;}
function rejected(p,pattern){const r=run(p);assert.equal(r.status,2,r.stderr||r.stdout);assert.match(r.stderr,pattern);}

test('zero altitude et zero devers sont des mesures valides ; aucune ecriture runtime',()=>{
 const r=accepted(payload([observation(),observation({id:'bank',quantity:'bankRadians',unit:'rad',bankReference:'right-edge-down-positive'})]));
 assert.equal(r.summary.eligibleForRoadProfile,2);assert(r.observations.every(o=>o.value===0));
 assert.equal(r.readyForRuntime,false);assert.equal(r.sourceIntegrityCheckedHere,false);
});
test('devers : une orientation absente est refusee, meme pour zero',()=>{
 rejected(payload([observation({quantity:'bankRadians',unit:'rad'})]),/Reference devers/);
});
test('devers : la convention inverse cote gauche plus bas est refusee',()=>{
 rejected(payload([observation({quantity:'bankRadians',unit:'rad',value:.1,bankReference:'left-edge-down-positive'})]),/Reference devers/);
});
test('terrain IGN69 date, mais incertitude inconnue : importe sans convertir null en zero',()=>{
 const r=accepted(payload([observation({kind:'terrain',uncertainty:null,verticalDatum:'IGN69'})]));
 assert.equal(r.observations[0].uncertainty,null);assert.equal(r.summary.eligibleForRoadProfile,0);
 assert.deepEqual(r.observations[0].reasons,['terrain_not_road','uncertainty_unknown']);
 assert.equal(r.observations[0].verticalDatum,'IGN69');assert.equal(r.observations[0].date,'2021-01-01');
});
test('datum, date, incertitude inconnus et estimation ne qualifient pas la chaussee',()=>{
 for(const extra of [{verticalDatum:null},{date:null},{uncertainty:null},{kind:'estime'}]){
  const r=accepted(payload([observation(extra)]));assert.equal(r.summary.eligibleForRoadProfile,0);
 }
});
test('tunnel : meme terrain a date et datum connus reste terrain ; route exige confirmation',()=>{
 for(const extra of [{osmNodeId:102},{osmNodeId:103},{osmNodeId:102,kind:'terrain',tunnelRoadConfirmed:true}])
  assert.equal(accepted(payload([observation(extra)])).summary.eligibleForRoadProfile,0);
 assert.equal(accepted(payload([observation({osmNodeId:102,tunnelRoadConfirmed:true})])).summary.eligibleForRoadProfile,1);
 rejected(payload([observation({tunnelRoadConfirmed:'true'})]),/booleenne/);
});
test('contradictions et datums incompatibles sont conserves, sans moyenne ni selection',()=>{
 for(const extra of [{value:3},{verticalDatum:'ANOTHER-SYNTHETIC-DATUM'}]){
  const source=[observation(),observation({id:'other',...extra})],r=accepted(payload(source));
  assert.equal(r.summary.eligibleForRoadProfile,0);assert.equal(r.summary.contradictionGroups.length,1);
  assert.deepEqual(r.observations.map(o=>o.value),source.map(o=>o.value));
 }
 const r=accepted(payload([observation({uncertainty:1}),observation({id:'overlap',value:1,uncertainty:1})]));
 assert.equal(r.summary.eligibleForRoadProfile,2,'intervalles compatibles');
});
test('une mesure terrain et une mesure chaussee ne sont pas fusionnees',()=>{
 const r=accepted(payload([observation(),observation({id:'ground',kind:'terrain',value:20})]));
 assert.equal(r.summary.eligibleForRoadProfile,1);assert.equal(r.summary.contradictionGroups.length,0);
});
test('largeurs : valeur positive et cote dans le sens du parcours obligatoires',()=>{
 for(const quantity of ['leftWidthM','rightWidthM']){
  const o=observation({quantity,value:3,widthReference:'track-direction'});
  assert.equal(accepted(payload([o])).summary.eligibleForRoadProfile,1);
  for(const extra of [{value:0},{value:-1},{widthReference:'north'}])rejected(payload([{...o,...extra}]),/Largeur positive/);
 }
});
test('sources, noeuds, identifiants et locateurs ne peuvent etre inventes ou ambigus',()=>{
 for(const [extra,pattern] of [[{sourceId:'absent'},/Source inconnue/],[{osmNodeId:404},/Noeud absent/],
  [{osmNodeId:true},/entier positif/],[{locator:''},/locator/]])rejected(payload([observation(extra)]),pattern);
 rejected(payload([observation(),observation()]),/observation duplique/);
 const p=payload();p.manifest.sources.push({id:'synthetic-survey'});rejected(p,/source duplique/);
});
test('null, booleens, NaN, infinis, fausses unites et dates impossibles sont refuses',()=>{
 for(const value of [null,true,false,'0'])rejected(payload([observation({value})]),/Nombre fini/);
 for(const token of ['NaN','Infinity','-Infinity']){
  const raw=JSON.stringify(payload()).replace('"value":0','"value":'+token),r=run(null,raw);
  assert.equal(r.status,2);assert.match(r.stderr,/Nombre fini/);
 }
 for(const extra of [{uncertainty:true},{uncertainty:-1},{unit:'ft'},{date:'2021-02-30'},
  {quantity:'bankRadians',unit:'rad',value:Math.PI,bankReference:'right-edge-down-positive'}])assert.equal(run(payload([observation(extra)])).status,2);
 const p=payload();p.registry.version=true;rejected(p,/Format/);
});
test('registre vide accepte ; absence de cle et cle mal orthographiee refusees',()=>{
 assert.equal(accepted(payload([])).summary.total,0);
 const o=observation();delete o.uncertainty;rejected(payload([o]),/Champs observation/);
 rejected(payload([observation({incertitude:0})]),/Champs observation/);
 for(const field of ['sources','tunnelTags']){
  const p=payload();(field==='sources'?p.manifest:p.data)[field]=null;rejected(p,/listes/);
 }
});
