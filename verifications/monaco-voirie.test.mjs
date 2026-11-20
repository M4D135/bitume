// Sources et preparation uniquement : aucune physique, aucun build, aucun reseau.
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
const script=path.join(root,'tools/preparer-monaco-voirie.py');
const outputs=['voirie-p05.json','voirie-p05.md'];
const read=(d,n)=>JSON.parse(readFileSync(path.join(d,n),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const save=(d,n,v)=>writeFileSync(path.join(d,n),JSON.stringify(v,null,2)+'\n');
const run=(d,...args)=>spawnSync('python3',[script,'--directory',d,...args],{encoding:'utf8',timeout:15000});
const ok=r=>assert.equal(r.status,0,r.stderr||r.stdout);
const bad=r=>assert.notEqual(r.status,0,'source acceptee a tort');
function fixture(fn){const d=mkdtempSync(path.join(os.tmpdir(),'monaco-voirie-'));try{cpSync(folder,d,{recursive:true});fn(d);}finally{rmSync(d,{recursive:true,force:true});}}
function snapshot(d,except=[]){return readdirSync(d,{recursive:true}).sort().filter(n=>!except.includes(n)&&statSync(path.join(d,n)).isFile()).map(n=>{const p=path.join(d,n);return[n,hash(readFileSync(p)),statSync(p).mtimeMs];});}
const pythonPrefix=`import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('voirie',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\n`;
const py=code=>{const r=spawnSync('python3',['-c',pythonPrefix+code,script],{encoding:'utf8',timeout:15000});ok(r);return JSON.parse(r.stdout);};

test('captures conservees, 49 priorites et intervalle non tague sans decision routiere',()=>fixture(d=>{
  const before=snapshot(d,outputs);ok(run(d));assert.deepEqual(snapshot(d,outputs),before);
  const r=read(d,outputs[0]),g=read(d,'donnees.json');
  assert.equal(r.readyForRuntime,false);assert.equal(r.networkUsed,false);
  assert.equal(r.summary.sourceFeatureCount,77);assert.equal(r.summary.axisRecords,56);
  assert.equal(r.summary.uniqueAxisIds,53);assert.equal(r.summary.reviewPriorityPoints,49);
  assert.equal(r.points.length,56);assert.deepEqual(r.points.filter(p=>p.untaggedGapInterior).map(p=>p.index),[212,213,214,215,216,217,218]);
  assert.deepEqual(r.summary.unknownRoadFields,{y:415,leftWidthM:415,rightWidthM:415,bankRadians:415});
  assert.equal(r.lengthMUnmodified,g.lengthM);assert.equal(r.scaleApplied,1);
  for(const p of r.points){assert.equal(p.osmNodeId,g.points[p.index].osmNodeId);for(const k of ['selectedAxisId','roadAltitudeM','leftWidthM','rightWidthM','bankRadians'])assert.equal(p[k],null);}
  for(const a of r.axes){assert.equal(a.verticalDatum,null);assert.equal(a.individualMeasurementDate,null);assert.equal(a.eligibleForRoadProfile,false);assert.equal(a.widthIsRaceBoundary,false);assert.equal(a.bankRadians,null);}
}));

test('interpolation de revue : deux voies superposees gardent deux Z, jamais une profondeur par niveau',()=>{
  const v=py(`
source={'id':'test','featureKind':'road_axis','noDataZValues':[],'verticalDatum':None,'individualMeasurementDate':None}
def axis(n,z):
 f={'id':n,'properties':{'cleabs':n,'precision_altimetrique':1.5,'position_par_rapport_au_sol':'-1'},'geometry':{'type':'LineString','coordinates':[[0,0,z],[10,0,z+2]]}}
 return m.inspect_axis(f,source,0,lambda p:(p['lon'],p['lat']))
a=axis('bas',10);b=axis('haut',30);p={'x':5,'z':3}
print(json.dumps([m.nearest_on_axis(p,a),m.nearest_on_axis(p,b),m.nearest_on_axis({'x':-4,'z':3},a)]))
`);
  assert.deepEqual(v.map(x=>x.sourceAxisZInterpolatedM),[11,31,10]);
  assert.deepEqual(v.map(x=>x.distanceM),[3,3,5]);
  assert.deepEqual(v.map(x=>x.fraction),[.5,.5,0]);
  for(const a of v){assert.equal(a.roadAltitudeM,null);assert.equal(a.isMeasuredAtOsmPoint,false);assert.equal(a.eligibleForRoadProfile,false);assert.equal(a.positionRelativeToGround,'-1');}
});

test('Z absents/sentinelles/Pas de Z exclus ; valeurs negatives valides conservees',()=>{
  const v=py(`
source={'id':'t','featureKind':'road_axis','noDataZValues':[-99999],'verticalDatum':None,'individualMeasurementDate':None}
def check(z,accuracy=1.5,method='BDTopo'):
 f={'properties':{'cleabs':'a','precision_altimetrique':accuracy,'methode_d_acquisition_altimetrique':method},'geometry':{'type':'LineString','coordinates':[[0,0,z],[10,0,2]]}}
 a=m.inspect_axis(f,source,0,lambda p:(p['lon'],p['lat']));p=m.nearest_on_axis({'x':5,'z':0},a)
 return [a['vertices'][0]['sourceZM'],a['vertices'][0]['interpolationZM'],p['sourceAxisZInterpolatedM'],a['vertices'][0]['exclusions']]
print(json.dumps([check(-99999),check(None),check(20,9999),check(20,1.5,'Pas de Z'),check(20,None),check(-2)]))
`);
  for(const row of v.slice(0,5)){assert.equal(row[1],null);assert.equal(row[2],null);assert(row[3].length);}
  assert.equal(v[0][0],-99999);assert.equal(v[2][0],20);
  assert.deepEqual(v[5],[-2,-2,0,[]]);
});

test('portails de galerie, localisateurs et doublons de classes ne sont pas des observations independantes',()=>{
  const r=read(folder,outputs[0]);assert.equal(r.galleryEndpoints.length,18);assert.equal(r.portalReview.length,4);
  assert.equal(r.identicalGeometryAcrossClasses.length,2);
  for(const pair of r.identicalGeometryAcrossClasses){
    const a=r.axes.find(a=>a.id===pair.tunnelAxisId),b=r.axes.find(a=>a.id===pair.roadAxisId);
    assert.deepEqual(a.vertices.map(v=>[v.lon,v.lat,v.sourceZM]),b.vertices.map(v=>[v.lon,v.lat,v.sourceZM]));
    assert.equal(pair.independentCorroboration,false);
  }
  for(const p of r.galleryEndpoints){
    const a=r.axes.find(a=>a.id===p.axisId),v=a.vertices[p.vertexIndex];
    assert([0,a.vertices.length-1].includes(p.vertexIndex));assert.deepEqual([p.lon,p.lat,p.sourceZM],[v.lon,v.lat,v.sourceZM]);
    assert.equal(p.confirmedCircuitPortal,false);assert.equal(p.isIndependentRoadSurvey,false);assert.equal(p.circuitClearanceM,null);
  }
  const louis=r.axes.find(a=>a.cleabs==='TRONROUT0000000074274447');
  assert.deepEqual(louis.vertices.filter((v,i)=>i===0||i===louis.vertices.length-1).map(v=>[v.lon,v.lat,v.sourceZM]),[[7.42794325,43.73774443,6.9],[7.43035575,43.74043743,9.5]]);
  const flagged=r.galleryEndpoints.find(p=>p.cleabs==='CONSLINE0000002150241393'&&p.vertexIndex===0);
  assert.equal(flagged.sourceZM,6.9);assert.equal(flagged.adjacentSourceSegmentNeedsReview,true);
  assert.equal(flagged.adjacentSourceSegmentWarnings[0].segmentIndex,0);
  for(const p of r.portalReview){assert.equal(p.selectedPortal,null);assert.equal(p.geometricPortalConfirmed,false);}
  assert(r.portalReview.filter(p=>[206,211].includes(p.osmPointIndex)).every(p=>p.nearestSourceEndpoints[0].horizontalDistanceM>50));
});

test('variation Z source Louis II conservee et signalee, sans correction ni pente de jeu',()=>{
  const r=read(folder,outputs[0]),a=r.axes.find(a=>a.cleabs==='TRONROUT0000000074274447');
  const s=a.sourceGradeSegmentsToReview.find(s=>s.segmentIndex===0);
  assert(s);assert(Math.abs(s.sourceDeltaZM-6.6)<1e-10);assert(s.horizontalLengthM>2.7&&s.horizontalLengthM<2.8);
  assert.equal(s.isQualifiedRoadGrade,false);assert.equal(s.cause,'unknown');
  assert.equal(r.sourceGradeReview.thresholdIsPhysicsLimit,false);
  assert.deepEqual(a.vertices.slice(0,2).map(v=>v.sourceZM),[6.9,13.5]);
});

test('segment vertical de longueur horizontale nulle signale et jamais interpole',()=>{
  const v=py(`
source={'id':'t','featureKind':'road_axis','verticalDatum':None,'individualMeasurementDate':None}
f={'properties':{'cleabs':'a','precision_altimetrique':1.5},'geometry':{'type':'LineString','coordinates':[[1,2,5],[1,2,15]]}}
a=m.inspect_axis(f,source,0,lambda p:(p['lon'],p['lat']))
print(json.dumps({'alert':a['sourceGradeSegmentsToReview'],'nearest':m.nearest_on_axis({'x':1,'z':2},a)}))
`);
  assert.equal(v.nearest,null);assert.equal(v.alert.length,1);assert.equal(v.alert[0].sourceGrade,null);
  assert.equal(v.alert[0].sourceDeltaZM,10);assert.equal(v.alert[0].reason,'horizontal_length_zero_with_z_change');
});

test('reponses tronquees, CRS change, doublons, faux datum/date refusent avant ecriture',()=>{
  for(const mode of ['count','crs','duplicate','datum','date'])fixture(d=>{
    const manifest=read(d,'sources-voirie-p05.json');
    if(mode==='datum')manifest.sources[0].verticalDatum='IGN69';
    else if(mode==='date')manifest.sources[0].individualMeasurementDate='2026-11-20';
    else{
      const source=manifest.sources[0],v=read(d,source.file);
      if(mode==='count')v.numberMatched+=1;
      if(mode==='crs')v.crs.properties.name='EPSG:3857';
      if(mode==='duplicate')v.features[1].properties.cleabs=v.features[0].properties.cleabs;
      save(d,source.file,v);const raw=readFileSync(path.join(d,source.file));source.bytes=raw.length;source.sha256=hash(raw);
    }
    save(d,'sources-voirie-p05.json',manifest);const before=snapshot(d);bad(run(d));assert.deepEqual(snapshot(d),before);
  });
});

test('capture alteree et sortie --check divergente : aucune reparation silencieuse',()=>{
  fixture(d=>{const m=read(d,'sources-voirie-p05.json');writeFileSync(path.join(d,m.sources[0].file),'{}');const before=snapshot(d);bad(run(d));assert.deepEqual(snapshot(d),before);});
  fixture(d=>{ok(run(d));const before=snapshot(d);ok(run(d,'--check'));assert.deepEqual(snapshot(d),before);writeFileSync(path.join(d,outputs[0]),'{}\n');const altered=snapshot(d);bad(run(d,'--check'));assert.deepEqual(snapshot(d),altered);});
});

test('sorties et sources restent confinees dans le dossier demande',()=>fixture(d=>{
  const outside=mkdtempSync(path.join(os.tmpdir(),'monaco-outside-'));
  try{
    const target=path.join(outside,'sentinel.txt');writeFileSync(target,'NE PAS MODIFIER');
    rmSync(path.join(d,outputs[0]));symlinkSync(target,path.join(d,outputs[0]));bad(run(d));assert.equal(readFileSync(target,'utf8'),'NE PAS MODIFIER');
    rmSync(path.join(d,outputs[0]));const m=read(d,'sources-voirie-p05.json');m.sources[0].file='../outside.json';save(d,'sources-voirie-p05.json',m);bad(run(d));
  }finally{rmSync(outside,{recursive:true,force:true});}
}));
