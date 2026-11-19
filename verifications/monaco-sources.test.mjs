// Dossier 14A seulement : aucune partie du jeu ne charge ces donnees.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'docs/references/monaco-2026');
const script=path.join(root,'tools/preparer-monaco-14a.py');
const json=name=>JSON.parse(readFileSync(path.join(folder,name),'utf8'));
const data=json('donnees.json'),report=json('comparaison.json'),manifest=json('sources.json');
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const attributes=text=>Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
// Lecture independante des seules primitives OSM utilisees par les assertions.
const nodes=new Map(),ways=new Map();
for(const source of manifest.sources.filter(s=>s.role==='geometry')){
  const text=readFileSync(path.join(folder,source.file),'utf8');
  for(const match of text.matchAll(/<node\b([^>]+)>/g)){
    const a=attributes(match[1]);nodes.set(Number(a.id),a);
  }
  for(const match of text.matchAll(/<way\b([^>]+)>([\s\S]*?)<\/way>/g)){
    const a=attributes(match[1]);ways.set(Number(a.id),{...a,refs:[...match[2].matchAll(/<nd ref="(\d+)"\s*\/>/g)].map(m=>Number(m[1]))});
  }
}

test('les instantanes sont exacts et les trois sorties se reproduisent hors reseau',()=>{
  for(const source of manifest.sources.filter(s=>s.file)){
    const raw=readFileSync(path.join(folder,source.file));
    assert.equal(raw.length,source.bytes,source.file);assert.equal(hash(raw),source.sha256,source.file);
  }
  const names=['donnees.json','comparaison.json','plan.svg'];
  const before=names.map(n=>hash(readFileSync(path.join(folder,n))));
  const run=spawnSync('python3',[script,'--check'],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.stdout);
  assert.deepEqual(names.map(n=>hash(readFileSync(path.join(folder,n)))),before,'--check ne doit rien ecrire');
});

test('chaque coordonnee et chaque arete conserve une provenance OSM existante',()=>{
  assert.equal(data.points.length,data.edges.length);
  for(const p of data.points){
    const raw=nodes.get(p.osmNodeId);assert(raw);
    assert.equal(p.lat,Number(raw.lat));assert.equal(p.lon,Number(raw.lon));
    assert.equal(p.osmNodeVersion,Number(raw.version));assert.equal(p.sourceTimestamp,raw.timestamp);
  }
  for(const e of data.edges){
    const raw=ways.get(e.osmWayId);assert(raw);
    assert.equal(e.osmWayVersion,Number(raw.version));
    const pair=raw.refs.slice(e.originalEdgeIndex,e.originalEdgeIndex+2);
    assert.equal(pair.length,2);if(!e.originalForward)pair.reverse();
    assert.deepEqual(pair,[e.fromNodeId,e.toNodeId]);
    assert(e.sourceIds.length>0);
  }
});

test('la boucle parcourt une seule fois ses noeuds et se ferme par une vraie arete',()=>{
  const ids=data.points.map(p=>p.osmNodeId),degree=new Map();
  assert.equal(new Set(ids).size,ids.length);
  for(let i=0;i<data.edges.length;i++){
    const e=data.edges[i];assert.equal(e.fromNodeId,ids[i]);assert.equal(e.toNodeId,ids[(i+1)%ids.length]);
    for(const n of [e.fromNodeId,e.toNodeId])degree.set(n,(degree.get(n)||0)+1);
    assert(e.lengthM>0&&Number.isFinite(e.lengthM));
  }
  assert([...degree.values()].every(n=>n===2));assert.equal(degree.size,ids.length);
  const sum=data.edges.reduce((s,e)=>s+e.lengthM,0);
  assert(Math.abs(sum-data.lengthM)<.001);
  assert.equal(report.syntheticEdges,0);assert.equal(report.movedSourceNodes,0);
  assert.equal(data.coordinates.scaleApplied,1);assert.equal(data.coordinates.closureCorrectionApplied,false);
});

test('raccord et stands restent distingues, sans absorber la branche urbaine',()=>{
  const gap=data.edges.filter(e=>e.osmWayId===35092475);
  assert.deepEqual(gap.map(e=>e.fromNodeId).concat(gap.at(-1).toNodeId),[918118157,14109303021,1737326309,12571844664]);
  assert(data.edges.some(e=>e.osmWayId===1551240830));
  const continuation=data.edges.filter(e=>e.osmWayId===1551240829);
  assert.deepEqual(continuation.map(e=>[e.fromNodeId,e.toNodeId]),[[14109303023,21912962]]);
  assert(!data.points.some(p=>p.osmNodeId===14109303022));
  for(const id of [850261588,1388331347]){
    assert(!data.edges.some(e=>e.osmWayId===id));
    const auxiliary=data.auxiliaryWays.find(w=>w.osmWayId===id);assert(auxiliary);
    assert.deepEqual(auxiliary.orderedNodeIds,ways.get(id).refs);
    assert.equal(auxiliary.raceConnectionValidated,false);
  }
  assert(report.alternateGapLoopLengthM>data.lengthM);
});

test('les 19 reperes suivent le sens des geometries, sans se dire apex mesures',()=>{
  assert.deepEqual(data.turns.map(t=>t.number),Array.from({length:19},(_,i)=>i+1));
  const indices=new Map(data.points.map((p,i)=>[p.osmNodeId,i]));
  let previous=-1;
  for(const t of data.turns){
    const lo=indices.get(t.approachNodeId),at=indices.get(t.representativeNodeId),hi=indices.get(t.exitNodeId);
    assert(previous<=lo&&lo<at&&at<hi);previous=hi;
    // Le changement total d'angle est mesure dans le polyline fourni, pas repris du rapport.
    const headings=[];
    for(let i=lo;i<hi;i++){
      const a=data.points[i],b=data.points[i+1];headings.push(Math.atan2(b.z-a.z,b.x-a.x));
    }
    let signed=0;
    for(let i=1;i<headings.length;i++)signed+=Math.atan2(Math.sin(headings[i]-headings[i-1]),Math.cos(headings[i]-headings[i-1]));
    assert(signed*(t.direction==='right'?1:-1)>0,'sens de T'+t.number);
    assert.equal(t.locationStatus,'candidate_osm_anchor_not_surveyed_apex');assert.equal(t.horizontalAccuracyM,null);
  }
  assert.equal(report.surveyedApexCount,0);
  assert.equal(report.officialSectorSumM,3337);
  assert.equal(report.lengthTargetMet,false,'les 13 m manquants ne doivent pas etre masques');
  assert.equal(report.differenceM,Number((data.lengthM-3337).toFixed(6)));
  for(const p of data.points)for(const field of ['y','leftWidthM','rightWidthM','bankRadians'])assert.equal(p[field],null);
  assert.equal(data.readyForRuntime,false);
});

test('une source alteree est refusee avant regeneration',()=>{
  const temp=mkdtempSync(path.join(os.tmpdir(),'bitume-monaco-sources-'));
  try{
    cpSync(folder,temp,{recursive:true});
    const target=path.join(temp,'sources/osm-ostende-monte-carlo.osm');
    writeFileSync(target,readFileSync(target,'utf8').replace('7.4264265','7.4269999'));
    const before=hash(readFileSync(path.join(temp,'donnees.json')));
    const run=spawnSync('python3',[script,'--directory',temp,'--check'],{encoding:'utf8'});
    assert.notEqual(run.status,0);assert.match(run.stderr,/Empreinte source differente/);
    assert.equal(hash(readFileSync(path.join(temp,'donnees.json'))),before);
  }finally{rmSync(temp,{recursive:true,force:true});}
});
