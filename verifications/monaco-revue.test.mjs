// Diagnostic de donnees uniquement : aucun rendu ni parcours physique.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'docs/references/monaco-2026'),script=path.join(root,'tools/examiner-monaco-mesures.py');
const read=(d,n)=>JSON.parse(readFileSync(path.join(d,n),'utf8'));
const save=(d,n,v)=>writeFileSync(path.join(d,n),JSON.stringify(v));
const hash=b=>createHash('sha256').update(b).digest('hex');
const run=(d,...args)=>spawnSync('python3',[script,'--directory',d,...args],{encoding:'utf8',timeout:10000});
const ok=r=>assert.equal(r.status,0,r.stderr||r.stdout);
const bad=r=>assert.notEqual(r.status,0,'revue accepte une entree alteree');
const sorted=s=>[...s].sort((a,b)=>a-b);
function fixture(fn){const d=mkdtempSync(path.join(os.tmpdir(),'monaco-revue-'));try{cpSync(folder,d,{recursive:true});fn(d);}finally{rmSync(d,{recursive:true,force:true});}}
function snapshot(d){return readdirSync(d,{recursive:true}).sort().filter(n=>statSync(path.join(d,n)).isFile()).map(n=>{const p=path.join(d,n);return[n,hash(readFileSync(p)),statSync(p).mtimeMs];});}
function python(code){const r=spawnSync('python3',['-B','-c',`import runpy, json, pathlib\nm=runpy.run_path(${JSON.stringify(script)})\ndirectory=pathlib.Path(${JSON.stringify(folder)})\n`+code],{encoding:'utf8',timeout:10000});ok(r);return JSON.parse(r.stdout);}

test('tous les ecarts sont restitues, au-dela du top20 historique, avec associations exactes',()=>{
  ok(run(folder,'--check'));
  const d=read(folder,'donnees.json'),t=read(folder,'mesures-terrain.json'),r=read(folder,'revue-mesures.json');
  const expected=t.points.filter(p=>Math.abs(p.samples.lidar.valueM-p.samples.rge.valueM)>1).map(p=>p.index);
  assert.equal(expected.length,32);assert.deepEqual(r.differencePointIndices,expected);
  assert.deepEqual(sorted(r.differenceGroups.flatMap(g=>g.pointIndices)),expected);
  assert.equal(new Set(r.differenceGroups.flatMap(g=>g.pointIndices)).size,expected.length);
  assert.equal(r.differenceGroups.length,7);
  for(const p of r.points){
    const source=t.points[p.index];assert.equal(p.osmNodeId,source.osmNodeId);assert.equal(p.sM,source.sM);
    for(const did of ['lidar','rge']){assert.equal(p.terrain[did].valueM,source.samples[did].valueM);assert.equal(p.terrain[did].locator,source.samples[did].locator);}
    assert.equal(p.adjacentWays[0].osmWayId,d.edges[(p.index+414)%415].osmWayId);
    assert.equal(p.adjacentWays[1].osmWayId,d.edges[p.index].osmWayId);
    assert(p.neighboringTurns.before.locationStatus.includes('candidate'));assert.equal(p.neighboringTurns.before.horizontalAccuracyM,null);
  }
});

test('tunnels derives des aretes : 31 aretes, 33 points, quatre transitions et aucun raccord invente',()=>{
  const d=read(folder,'donnees.json'),r=read(folder,'revue-mesures.json');
  const edges=new Set(d.tunnelTags.flatMap(t=>Array.from({length:t.lastEdgeIndex-t.firstEdgeIndex+1},(_,i)=>i+t.firstEdgeIndex)));
  const points=new Set([...edges].flatMap(i=>[i,(i+1)%415]));
  assert.equal(edges.size,31);assert.equal(points.size,33);assert.equal(r.tunnelGroups.length,2);
  assert.deepEqual(sorted(r.tunnelGroups.flatMap(g=>g.edgeIndices)),sorted(edges));
  assert.deepEqual(r.tunnelPointIndices,sorted(points));
  const boundaries=r.tunnelGroups.flatMap(g=>g.boundaries);assert.deepEqual(boundaries.map(p=>p.index),[206,211,219,245]);
  for(const p of boundaries){assert.notEqual(p.previousEdge.tunnelTagged,p.nextEdge.tunnelTagged);assert.equal(p.portalAccuracyM,null);assert.equal(p.clearanceM,null);assert.match(p.status,/not_surveyed/);}
  const gap=r.untaggedIntervals.find(g=>!g.wrapsOrigin);assert.deepEqual(gap.edgeIndices,[211,212,213,214,215,216,217,218]);
  assert.equal(r.summary.differencePointsTunnelTagged,20);assert.equal(r.summary.differencePointsWithoutTunnelTag,12);
});

test('les pentes sont recalculees sur toutes les aretes, fermeture comprise, sans devenir des cotes routieres',()=>{
  const d=read(folder,'donnees.json'),t=read(folder,'mesures-terrain.json'),r=read(folder,'revue-mesures.json');
  const expected=[];
  for(const did of ['lidar','rge'])for(let i=0;i<d.edges.length;i++){
    const a=t.points[i].samples[did].valueM,b=t.points[(i+1)%415].samples[did].valueM;
    if(Math.abs((b-a)/d.edges[i].lengthM)>.35)expected.push([did,i]);
  }
  assert.deepEqual(r.gradeAlerts.map(g=>[g.dataset,g.edgeIndex]),expected);assert.equal(expected.length,17);
  assert.equal(r.readyForRuntime,false);assert.equal(r.gradeThresholdIsPhysicsLimit,false);assert.equal(r.summary.eligibleRoadMeasurements,0);
  for(const p of r.points)for(const k of ['y','leftWidthM','rightWidthM','bankRadians'])assert.equal(p.roadMeasurements[k],null);
  assert(d.points.every(p=>p.y===null&&p.leftWidthM===null&&p.rightWidthM===null&&p.bankRadians===null));
});

test('partition cyclique correcte aux bords, sans point perdu ni faux portail sur une boucle entierement couverte',()=>{
  const v=python(`runs=m['cyclic_runs']\nprint(json.dumps([runs([],6),runs([5,0,1,3],6),runs(range(6),6),m['edge_span'](4,1,6)]))`);
  assert.deepEqual(v,[[],[[3],[5,0,1]],[[0,1,2,3,4,5]],[4,5,0,1]]);
  const full=python(`d=json.loads((directory/'donnees.json').read_bytes())\nt=json.loads((directory/'mesures-terrain.json').read_bytes())\nb=json.loads((directory/'bilan-mesures.json').read_bytes())\nd['tunnelTags']=[{'firstEdgeIndex':0,'lastEdgeIndex':414}]\nfor p in t['points']: p['tunnelTagged']=True\nb['tunnelTaggedPoints']=415\nfor g in b['segmentsToReview']: g['tunnelTouching']=True\nr=m['build_review'](d,t,b,{})\nprint(json.dumps([r['summary']['osmTagTransitions'],r['tunnelGroups'][0]['pointIndices'],r['untaggedIntervals']]))`);
  assert.equal(full[0],0);assert.deepEqual(full[1],Array.from({length:415},(_,i)=>i));assert.deepEqual(full[2],[]);
  const wrapped=python(`d=json.loads((directory/'donnees.json').read_bytes())\nt=json.loads((directory/'mesures-terrain.json').read_bytes())\nb=json.loads((directory/'bilan-mesures.json').read_bytes())\nd['tunnelTags']=[{'firstEdgeIndex':414,'lastEdgeIndex':0}]\nselected={414,0,1}\nfor p in t['points']: p['tunnelTagged']=p['index'] in selected\nb['tunnelTaggedPoints']=3\nfor g in b['segmentsToReview']: g['tunnelTouching']=g['edgeIndex'] in selected or (g['edgeIndex']+1)%415 in selected\nr=m['build_review'](d,t,b,{})\ng=r['tunnelGroups'][0]\nprint(json.dumps([g['edgeIndices'],g['pointIndices'],[p['index'] for p in g['boundaries']],g['wrapsOrigin']]))`);
  assert.deepEqual(wrapped,[[414,0],[414,0,1],[414,1],true]);
});

test('le seuil est strict : les ecarts exactement +1 et -1 metre ne deviennent pas des alertes',()=>{
  const result=python(`d=json.loads((directory/'donnees.json').read_bytes())\nt=json.loads((directory/'mesures-terrain.json').read_bytes())\nb=json.loads((directory/'bilan-mesures.json').read_bytes())\nfor i,delta in ((0,1),(1,-1)):\n p=t['points'][i];p['samples']['lidar']['valueM']=p['samples']['rge']['valueM']+delta;p['deltaLidarRgeM']=delta\nr=m['build_review'](d,t,b,{})\nprint(json.dumps(r['differencePointIndices']))`);
  assert(!result.includes(0));assert(!result.includes(1));assert.equal(result.length,32);
});

test('provenance verifiee et --check strictement sans ecriture, meme en cas de derive',()=>fixture(d=>{
  ok(run(d));const r=read(d,'revue-mesures.json');assert.equal(r.sourceProvenance.networkUsed,false);
  for(const input of r.sourceProvenance.inputs){const b=readFileSync(path.join(d,input.file));assert.equal(input.bytes,b.length);assert.equal(input.sha256,hash(b));}
  let before=snapshot(d);ok(run(d,'--check'));assert.deepEqual(snapshot(d),before);
  writeFileSync(path.join(d,'revue-mesures.md'),'derive');before=snapshot(d);bad(run(d,'--check'));assert.deepEqual(snapshot(d),before);
}));

test('une entree brute, geometrique ou derivee alteree est rejetee avant toute ecriture',()=>{
  for(const mode of ['raw','geometry','derived','association','delta','bilan'])fixture(d=>{
    if(mode==='raw'){const m=read(d,'sources-mesures.json');writeFileSync(path.join(d,m.sources[0].file),'{}');}
    if(mode==='geometry'){const v=read(d,'donnees.json');v.points[0].y=0;save(d,'donnees.json',v);}
    if(['derived','association','delta'].includes(mode)){
      const v=read(d,'mesures-terrain.json');
      if(mode==='derived')v.points[206].samples.lidar.valueM=0;
      if(mode==='association')[v.points[0],v.points[1]]=[v.points[1],v.points[0]];
      if(mode==='delta')v.points[206].deltaLidarRgeM=0;
      save(d,'mesures-terrain.json',v);
    }
    if(mode==='bilan'){const v=read(d,'bilan-mesures.json');v.segmentsToReview.pop();save(d,'bilan-mesures.json',v);}
    const before=snapshot(d);bad(run(d));assert.deepEqual(snapshot(d),before);
  });
});

test('une association brute permutee reste rejetee meme apres actualisation de son empreinte',()=>fixture(d=>{
  const m=read(d,'sources-mesures.json'),s=m.sources.find(s=>s.id==='lidar-samples'),raw=read(d,s.file);
  [raw.elevations[0],raw.elevations[1]]=[raw.elevations[1],raw.elevations[0]];
  const b=Buffer.from(JSON.stringify(raw));writeFileSync(path.join(d,s.file),b);s.bytes=b.length;s.sha256=hash(b);save(d,'sources-mesures.json',m);
  const before=snapshot(d);bad(run(d));assert.deepEqual(snapshot(d),before);
}));

test('les sorties ne peuvent viser une entree historique par lien symbolique',()=>fixture(d=>{
  rmSync(path.join(d,'revue-mesures.json'));symlinkSync(path.join(d,'donnees.json'),path.join(d,'revue-mesures.json'));
  const before=readFileSync(path.join(d,'donnees.json'));bad(run(d));assert.deepEqual(readFileSync(path.join(d,'donnees.json')),before);
}));
