// Import de captures seulement : aucun moteur ni parcours de course execute.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'docs/references/monaco-2026'),script=path.join(root,'tools/preparer-monaco-mesures.py');
const outputs=['mesures-terrain.json','mesures-controlees.json','bilan-mesures.json'];
const read=(d,n)=>JSON.parse(readFileSync(path.join(d,n),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=(d,n,v)=>writeFileSync(path.join(d,n),JSON.stringify(v));
const run=(d,...args)=>spawnSync('python3',[script,'--directory',d,...args],{encoding:'utf8',timeout:10000});
const ok=r=>assert.equal(r.status,0,r.stderr||r.stdout);
const bad=r=>assert.notEqual(r.status,0,'import accepte a tort');
function fixture(fn){const d=mkdtempSync(path.join(os.tmpdir(),'monaco-alti-'));try{cpSync(folder,d,{recursive:true});fn(d);}finally{rmSync(d,{recursive:true,force:true});}}
function source(d,id){const m=read(d,'sources-mesures.json');return m.sources.find(s=>s.id===id);}
function rewrite(d,id,raw){const m=read(d,'sources-mesures.json'),s=m.sources.find(s=>s.id===id),b=Buffer.from(raw);writeFileSync(path.join(d,s.file),b);s.bytes=b.length;s.sha256=hash(b);save(d,'sources-mesures.json',m);}
function mutate(d,id,fn){const v=read(d,source(d,id).file);fn(v);rewrite(d,id,JSON.stringify(v));}
function snapshot(d){return readdirSync(d,{recursive:true}).sort().filter(n=>statSync(path.join(d,n)).isFile()).map(n=>{const p=path.join(d,n);return[n,hash(readFileSync(p)),statSync(p).mtimeMs];});}

test('415 observations par source, terrain distinct de la chaussee, donnees figees intactes',()=>fixture(d=>{
  const m=read(d,'sources-mesures.json'),old=m.frozenGeometry.map(e=>[e.file,hash(readFileSync(path.join(d,e.file)))]);
  ok(run(d));const t=read(d,outputs[0]),c=read(d,outputs[1]),b=read(d,outputs[2]);
  assert.equal(t.points.length,415);assert.equal(c.summary.total,830);assert.equal(c.summary.eligibleForRoadProfile,0);
  assert(c.observations.every(o=>o.kind==='terrain'&&o.uncertainty===null&&!o.eligibleForRoadProfile));
  assert(t.points.every(p=>p.samples.rge.verticalDatum===null&&p.samples.rge.date===null));
  assert.equal(b.comparisonCount,415);assert.equal(b.gradeThresholdIsPhysicsLimit,false);assert.equal(b.gradeReviewThreshold,.35);
  assert.equal(b.unknownRoadMeasurements.y,415);assert.equal(b.unknownRoadMeasurements.bankRadians,415);
  for(const name of outputs){const out=read(d,name);assert.equal(out.readyForRuntime,false);assert(out.attribution.geometry);assert(out.sourceLicenses.terrain);}
  assert.deepEqual(m.frozenGeometry.map(e=>[e.file,hash(readFileSync(path.join(d,e.file)))]),old);
  const data=read(d,'donnees.json'),tunnel=new Set(data.tunnelTags.flatMap(t=>Array.from({length:t.lastEdgeIndex-t.firstEdgeIndex+2},(_,i)=>(i+t.firstEdgeIndex)%415)));
  assert.deepEqual(t.points.filter(p=>p.tunnelTagged).map(p=>p.index),[...tunnel].sort((a,b)=>a-b));
}));

test('--check reproduit sans ecrire et signale toute derive sans la reparer',()=>fixture(d=>{
  ok(run(d));let before=snapshot(d);ok(run(d,'--check'));assert.deepEqual(snapshot(d),before);
  writeFileSync(path.join(d,outputs[2]),'{}\n');before=snapshot(d);bad(run(d,'--check'));assert.deepEqual(snapshot(d),before);
}));

test('empreintes, geometrie figee et chemins confines sont effectivement controles',()=>{
  for(const name of ['raw','geometry','traversal','symlink'])fixture(d=>{
    if(name==='raw')writeFileSync(path.join(d,source(d,'lidar-samples').file),'{}');
    if(name==='geometry')writeFileSync(path.join(d,'donnees.json'),'{}');
    if(name==='traversal'){const m=read(d,'sources-mesures.json');m.sources[0].file='../escape.json';save(d,'sources-mesures.json',m);}
    if(name==='symlink'){rmSync(path.join(d,outputs[0]),{force:true});symlinkSync(path.join(d,'donnees.json'),path.join(d,outputs[0]));}
    const original=readFileSync(path.join(d,'donnees.json'));bad(run(d));assert.deepEqual(readFileSync(path.join(d,'donnees.json')),original);
  });
});

test('ordre, compte et coordonnees de la requete et de la reponse sont verifies',()=>{
  for(const name of ['order','count','request'])fixture(d=>{
    if(name==='order')mutate(d,'lidar-samples',v=>{[v.elevations[0],v.elevations[1]]=[v.elevations[1],v.elevations[0]];});
    if(name==='count')mutate(d,'rge-samples',v=>v.elevations.pop());
    if(name==='request'){const m=read(d,'sources-mesures.json'),s=m.sources.find(s=>s.id==='lidar-samples');s.request.lon=s.request.lon.split('|').reverse().join('|');save(d,'sources-mesures.json',m);}
    bad(run(d));
  });
});

test('titre exact et unique : ni autre territoire ni titre duplique',()=>{
  for(const mode of ['missing','duplicate','metadata'])fixture(d=>{
    if(mode==='metadata')mutate(d,'lidar-metadata',v=>v.data.push(v.data[0]));
    else mutate(d,'lidar-samples',v=>{const e=v.elevations[0];if(mode==='duplicate')e.measures.push(e.measures[0]);else e.measures[0].title='autre territoire';});
    bad(run(d));
  });
});

test('z principal ignore ; sentinelle, booleen, NaN et provenance invalide restent rejetes',()=>fixture(d=>{
  mutate(d,'lidar-samples',v=>{
    v.elevations[0].z=8000;v.elevations[1].measures[0].z=-99999;v.elevations[2].measures[0].z=false;
    v.elevations[3].measures[0].source_name='Autre - Pas de données';v.elevations[4].measures[0].source_name='Source mapping not found';
    v.elevations[5].measures[0].source_name='Origine inconnue';v.elevations[6].measures[0].z=-3.75;v.elevations[7].measures[0].z=123456789;
  });
  rewrite(d,'lidar-samples',readFileSync(path.join(d,source(d,'lidar-samples').file),'utf8').replace('"z":123456789','"z":NaN'));
  ok(run(d));const t=read(d,outputs[0]),c=read(d,outputs[1]);
  assert.equal(t.points[0].samples.lidar.valueM,3.78);assert.equal(t.points[6].samples.lidar.valueM,-3.75);
  for(const i of [1,2,3,4,5,7]){assert.equal(t.points[i].samples.lidar.status,'rejected');assert.equal(t.points[i].samples.lidar.valueM,null);}
  assert.equal(c.summary.total,824);assert(c.observations.some(o=>o.value===-3.75));
}));

test('polygonage reel : trous exclus, union des polygones et datum seulement sur emprise',()=>fixture(d=>{
  const p=read(d,'donnees.json').points[0],x=p.lon,y=p.lat;
  const box=(a,b,r)=>[[a-r,b-r],[a+r,b-r],[a+r,b+r],[a-r,b+r],[a-r,b-r]];
  mutate(d,'lidar-tiles',v=>{
    v.features.forEach(f=>{f.geometry.coordinates=[[box(-10,10,.01)]];});
    v.features[0].geometry.coordinates=[[box(x,y,.1),box(x,y,.000001)],[box(-20,20,.01)]];
  });
  ok(run(d));let t=read(d,outputs[0]);assert.deepEqual(t.points[0].samples.lidar.tileIds,[]);assert.equal(t.points[0].samples.lidar.verticalDatum,null);
  assert.equal(t.points[1].samples.lidar.tileIds.length,1);assert.equal(t.points[1].samples.lidar.verticalDatum,'IGN69');
  assert.equal(t.points[1].samples.lidar.date,null);assert.deepEqual(t.points[1].samples.lidar.acquisitionPeriod,{start:'2021-05-13',end:'2021-06-27'});
  mutate(d,'lidar-tiles',v=>{v.features[0].geometry.coordinates.push([box(x,y,.0000005)]);});
  ok(run(d));t=read(d,outputs[0]);assert.equal(t.points[0].samples.lidar.tileIds.length,1);
}));

test('datum heterogene, CRS inattendu et sources inconnues ne sont pas supposes valides',()=>{
  fixture(d=>{mutate(d,'lidar-tiles',v=>{v.features[1].geometry=v.features[4].geometry;v.features[1].properties.systeme_altimetrique='autre datum';});ok(run(d));assert(read(d,outputs[0]).points.some(p=>p.samples.lidar.tileIds.length>1&&p.samples.lidar.verticalDatum===null));});
  fixture(d=>{mutate(d,'lidar-tiles',v=>{v.crs.properties.name='EPSG:2154';});bad(run(d));});
  fixture(d=>{const m=read(d,'sources-mesures.json');m.datasets[0].samplesSourceId='absent';save(d,'sources-mesures.json',m);bad(run(d));});
});
