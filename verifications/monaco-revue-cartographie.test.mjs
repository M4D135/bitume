// Revue de sources figees : aucun moteur, rendu du jeu ou acces reseau execute.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'docs/references/monaco-2026');
const script=path.join(root,'tools/preparer-monaco-revue.py');
const outputs=['revue-chaussee.json','revue-chaussee.svg'];
const read=(d,n)=>JSON.parse(readFileSync(path.join(d,n),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=(d,n,v)=>writeFileSync(path.join(d,n),JSON.stringify(v,null,2)+'\n');
const run=(d,...args)=>spawnSync('python3',[script,'--directory',d,...args],{encoding:'utf8',timeout:15000});
const ok=r=>assert.equal(r.status,0,r.stderr||r.stdout);
const bad=r=>assert.notEqual(r.status,0,'revue acceptee a tort');
function fixture(fn){const d=mkdtempSync(path.join(os.tmpdir(),'monaco-revue-'));try{cpSync(folder,d,{recursive:true});fn(d);}finally{rmSync(d,{recursive:true,force:true});}}
function snapshot(d,except=[]){return readdirSync(d,{recursive:true}).sort().filter(n=>!except.includes(n)&&statSync(path.join(d,n)).isFile()).map(n=>{const p=path.join(d,n);return[n,hash(readFileSync(p)),statSync(p).mtimeMs];});}

test('corpus complet : 32 ecarts dans sept groupes, tous les 17 segments de pente',()=>fixture(d=>{
  ok(run(d));const r=read(d,outputs[0]),t=read(d,'mesures-terrain.json'),g=read(d,'donnees.json');
  assert.deepEqual(r.differenceGroups.map(x=>x.pointIndices),[
    [194,195],[220,221,222,223,224,225,226,227,228],[232,233,234,235,236,237],
    [240,241,242,243],[245],[278,279,280,281,282,283],[286,287,288,289]
  ]);
  const expected=t.points.filter(p=>Math.abs(Math.round((p.samples.lidar.valueM-p.samples.rge.valueM)*100)/100)>1).map(p=>p.index);
  assert.deepEqual(r.differencePoints.map(p=>p.index),expected);
  assert.deepEqual(r.differenceGroups.flatMap(x=>x.pointIndices),expected);
  assert.equal(r.summary.differencePointCount,32);assert.equal(r.summary.differenceGroupCount,7);
  assert.equal(r.summary.positiveDifferences,7);assert.equal(r.summary.negativeDifferences,25);
  assert.equal(r.summary.differencePointsTaggedTunnel,20);
  const slopes=[];
  for(const did of ['lidar','rge'])for(const e of g.edges){
    const a=t.points[e.index].samples[did].valueM,b=t.points[(e.index+1)%415].samples[did].valueM;
    if(Math.abs((b-a)/e.lengthM)>.35)slopes.push(`${e.index}:${did}`);
  }
  const actual=r.terrainGradeSegments.flatMap(e=>e.observations.map(o=>`${e.edgeIndex}:${o.dataset}`));
  assert.deepEqual(actual.sort(),slopes.sort());assert.equal(actual.length,17);assert.equal(new Set(actual).size,17);
  assert.deepEqual(r.summary.gradeByDataset,{lidar:5,rge:12});assert.equal(r.summary.distinctGradeEdges,17);
  assert.equal(r.thresholds.gradeThresholdIsPhysicsLimit,false);
  for(const p of r.differencePoints){assert.equal(p.osmNodeId,g.points[p.index].osmNodeId);assert.equal(p.sM,g.points[p.index].sM);assert(p.outgoingEdge.sourceIds.length);}
}));

test('deux tunnels et quatre limites candidates ; aucun raccord couvert invente',()=>fixture(d=>{
  ok(run(d));const r=read(d,outputs[0]);
  assert.equal(r.tunnelRuns.length,2);assert.equal(r.summary.tunnelTaggedPoints,33);
  assert.deepEqual(r.tunnelRuns.map(t=>[t.edgeIndices[0],t.edgeIndices.at(-1),t.pointIndices.length]),[[206,210,6],[219,244,27]]);
  for(const t of r.tunnelRuns){assert.equal(t.portalsSurveyed,false);assert.equal(t.roadSurfaceConfirmed,false);assert.equal(t.portalAccuracyM,null);assert.equal(t.clearanceM,null);assert(Math.abs(t.lengthM-t.chainageSpanM)<=r.numericRoundingToleranceM);}
  const gap=r.untaggedIntervals[0];assert.equal(r.untaggedIntervals.length,1);
  assert.deepEqual(gap.edgeIndices,[211,212,213,214,215,216,217,218]);
  assert.deepEqual(gap.strictInteriorPointIndices,[212,213,214,215,216,217,218]);
  assert(Math.abs(gap.lengthM-85.189612)<.00001);assert.equal(gap.inferredTunnelConnection,false);
  assert.equal(gap.physicalCoverage,'unknown');assert.equal(gap.osmTunnelTagPresent,false);
  assert(gap.edges.every(e=>e.tunnelTag!=='yes'));assert.equal(r.summary.surveyedPortals,0);
  assert.equal(r.roundingToleranceIsSurveyAccuracy,false);
}));

test('dates individuelles inconnues, periodes de dalle conservees et champs routiers toujours null',()=>fixture(d=>{
  const before=snapshot(d,outputs);ok(run(d));assert.deepEqual(snapshot(d,outputs),before);
  const r=read(d,outputs[0]),t=read(d,'mesures-terrain.json');
  assert.equal(r.readyForRuntime,false);assert.equal(r.summary.eligibleRoadObservations,0);
  assert.deepEqual(r.summary.unknownRoadMeasurements,{y:415,leftWidthM:415,rightWidthM:415,bankRadians:415});
  const points=[...r.differencePoints,...r.tunnelRuns.flatMap(t=>[t.entryCandidate,t.exitCandidate])];
  for(const p of points){
    assert(Object.values(p.roadMeasurements).every(v=>v===null));
    for(const did of ['lidar','rge']){const s=p.terrainSamples[did],original=t.points[p.index].samples[did];
      assert.equal(s.individualMeasurementDate,null);assert.equal(s.tileDateIsIndividualMeasurementDate,false);
      assert.equal(s.uncertaintyM,null);assert.deepEqual(s.tileAcquisitionPeriod,original.acquisitionPeriod);
      assert.equal(s.tileSingleDayIfKnown,original.date);assert(!('date' in s));
    }
    assert.equal(p.nearestTurnCandidate.locationStatus,'candidate_osm_anchor_not_surveyed_apex');
    assert.equal(p.nearestTurnCandidate.horizontalAccuracyM,null);
  }
  for(const e of r.terrainGradeSegments)for(const o of e.observations)for(const s of [o.fromSample,o.toSample])assert.equal(s.individualMeasurementDate,null);
  assert.equal(r.temporalProvenance.individualMntCellDatesConfirmed,false);
  assert.equal(r.interpretationReferences[0].revision,'2026-07');
}));

test('reproduction exacte ; --check necrit pas et ne repare pas une sortie modifiee',()=>fixture(d=>{
  ok(run(d));const first=outputs.map(n=>hash(readFileSync(path.join(d,n))));ok(run(d));
  assert.deepEqual(outputs.map(n=>hash(readFileSync(path.join(d,n)))),first);
  let before=snapshot(d);ok(run(d,'--check'));assert.deepEqual(snapshot(d),before);
  writeFileSync(path.join(d,outputs[0]),'{}\n');before=snapshot(d);bad(run(d,'--check'));assert.deepEqual(snapshot(d),before);
}));

test('captures sources et derives modifies sont rejetes avant toute ecriture',()=>{
  for(const name of ['source','mesures-terrain.json','mesures-controlees.json','bilan-mesures.json'])fixture(d=>{
    if(name==='source'){const s=read(d,'sources-mesures.json').sources.find(s=>s.id==='lidar-samples');writeFileSync(path.join(d,s.file),'{}');}
    else{const v=read(d,name);if(name==='mesures-terrain.json')v.points[194].samples.lidar.valueM=999;else v.readyForRuntime=true;save(d,name,v);}
    const before=snapshot(d);bad(run(d));assert.deepEqual(snapshot(d),before);
  });
});

test('geometrie reempreintee mais incoherente : rang, noeud, coordonnees, arete et tunnel rejetes',()=>{
  const mutate=`import json,hashlib,sys\nfrom pathlib import Path\nd=Path(sys.argv[1]);mode=sys.argv[2]\np=d/'donnees.json';v=json.loads(p.read_text())\nif mode=='index': v['points'][1]['index']=7\nif mode=='node': v['points'][1]['osmNodeId']=v['points'][2]['osmNodeId']\nif mode=='coordinate': v['points'][1]['lat']+=0.001\nif mode=='edge': v['edges'][1]['toNodeId']=v['points'][4]['osmNodeId']\nif mode=='tunnel': v['tunnelTags'][0]['lastEdgeIndex']=218\nb=(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\\n').encode();p.write_bytes(b)\nm=d/'sources-mesures.json';v=json.loads(m.read_text());e=next(e for e in v['frozenGeometry'] if e['file']=='donnees.json');e.update(bytes=len(b),sha256=hashlib.sha256(b).hexdigest());m.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\\n')`;
  for(const mode of ['index','node','coordinate','edge','tunnel'])fixture(d=>{
    ok(spawnSync('python3',['-c',mutate,d,mode],{encoding:'utf8'}));const before=snapshot(d);
    const result=run(d);bad(result);assert.match(result.stderr,/Geometrie derivee differente des sources/);assert.deepEqual(snapshot(d),before);
  });
});

test('fermeture : groupe non coupe, tunnel synthetique sur la derniere arete sans indice hors tableau',()=>{
  const code=`import importlib.util,json,sys\nfrom pathlib import Path\nsys.dont_write_bytecode=True\ns=importlib.util.spec_from_file_location('revue',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nd,t,b,_=m.verified_inputs(Path(sys.argv[2]))\nd['tunnelTags']=[{'firstEdgeIndex':414,'lastEdgeIndex':414,'osmWayIds':[d['edges'][414]['osmWayId']],'portalAccuracyM':None,'clearanceM':None}]\nfor p in t['points']: p['tunnelTagged']=p['index'] in (414,0)\nb['tunnelTaggedPoints']=2\nreview=m.make_review(d,t,b,[]);tunnel=review['tunnelRuns'][0];svg=m.make_svg(d,t,review)\nprint(json.dumps([m.circular_groups([413,414,0,1,4,5],415),m.circular_groups([],415),m.circular_groups(range(5),5),[tunnel['pointIndices'],tunnel['wrapsOrigin'],tunnel['chainageSpanM']>0,len(svg)>0]]))`;
  const r=spawnSync('python3',['-c',code,script,folder],{encoding:'utf8'});ok(r);
  assert.deepEqual(JSON.parse(r.stdout),[[[4,5],[413,414,0,1]],[],[[0,1,2,3,4]],[[414,0],true,true,true]]);
});

test('sorties confines, pas de lien symbolique et SVG autonome sans ressources externes',()=>fixture(d=>{
  const before=readFileSync(path.join(d,'donnees.json'));rmSync(path.join(d,outputs[0]));symlinkSync(path.join(d,'donnees.json'),path.join(d,outputs[0]));
  bad(run(d));assert.deepEqual(readFileSync(path.join(d,'donnees.json')),before);
  rmSync(path.join(d,outputs[0]));ok(run(d));const svg=readFileSync(path.join(d,outputs[1]),'utf8');
  assert(!/<(?:script|image|foreignObject)\b|\b(?:href|src)\s*=|@import|url\(/i.test(svg));
  ok(spawnSync('python3',['-c','import sys,xml.etree.ElementTree as E; E.parse(sys.argv[1])',path.join(d,outputs[1])],{encoding:'utf8'}));
}));
