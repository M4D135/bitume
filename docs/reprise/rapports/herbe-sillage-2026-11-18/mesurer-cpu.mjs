// Read-only CPU comparison of deterministic vegetation generation and instance packing.
// Usage: node mesurer-cpu.mjs <repo> <commit|WORKTREE> <output.json>
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const [repo,requestedRef='HEAD',output]=process.argv.slice(2);
if(!repo||!output)throw new Error('repo, ref and output required');
const ref=requestedRef==='WORKTREE'?'WORKTREE':execFileSync('git',['-C',repo,'rev-parse',requestedRef],{encoding:'utf8'}).trim();
const hashes={};
function load(file){
 const source=ref==='WORKTREE'?readFileSync(path.join(repo,file),'utf8'):execFileSync('git',['-C',repo,'show',ref+':'+file],{encoding:'utf8',maxBuffer:4000000});
 hashes[file]=createHash('sha256').update(source).digest('hex');
 vm.runInThisContext(source,{filename:file});
}
load('src/moteur/renderer.js');
const forms=new Map(),register=globalThis.FRender.forme;
globalThis.FRender.forme=(name,triangles)=>{forms.set(name,triangles);return register(name,triangles);};
for(const name of ['graphismes','carene','circuit','vegetation','decor','botanique'])load('src/'+name+'.js');
const B=globalThis.BITUME,F=globalThis.FRender.shared;
const circuit=B.circuit.creer(11,{theme:'foret',longueur:4200});
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return{samples:values,median:sorted[Math.floor(sorted.length/2)],max:sorted.at(-1)};};
const cases=[];
for(const density of ['high','ultra']){
 const options={qualite:'high',vegetationQualite:density};
 B.decor.construire(circuit,options); // unmeasured warmup
 const construction=[];let decor;
 for(let i=0;i<5;i++){const start=performance.now();decor=B.decor.construire(circuit,options);construction.push(performance.now()-start);}
 const lots=decor.lots.filter(lot=>lot.vegetation),environment=F.environmentInfo(decor.atmosphere);
 const packing=[];let bytes=0,nearGroups=0,farGroups=0;
 for(let trial=0;trial<6;trial++){
  const start=performance.now();bytes=nearGroups=farGroups=0;
  for(const lot of lots){const near=F.pack(lot.objets,environment),far=F.pack(lot.loin||[],environment);bytes+=near.values.byteLength+far.values.byteLength;nearGroups+=near.groups.length;farGroups+=far.groups.length;}
  const elapsed=performance.now()-start;if(trial)packing.push(elapsed);
 }
 const triangles=key=>lots.reduce((sum,lot)=>sum+(lot[key]||[]).reduce((n,o)=>n+(forms.get(o.shape)?.length||0),0),0);
 cases.push({density,grassClumps:decor.vegetation.herbes,vegetationInstances:lots.reduce((n,l)=>n+l.objets.length,0),lots:lots.length,nearTrianglesWholeCircuit:triangles('objets'),farTrianglesWholeCircuit:triangles('loin'),nearGroupsWholeCircuit:nearGroups,farGroupsWholeCircuit:farGroups,instanceBufferBytesNearAndFar:bytes,decorConstructionMs:stats(construction),vegetationPackingMs:stats(packing)});
}
const result={date:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,sourceRef:ref,hashes,conditions:{theme:'foret',seed:11,length:4200,generalQuality:'high',warmups:1,measuredSamples:5},scope:'CPU generation and static instance packing only. Complete-circuit counts are not visible-frame counts. No GPU execution or FPS measurement. Timings include normal runtime and GC noise.',cases};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({sourceRef:ref,cases:cases.map(c=>({density:c.density,grassClumps:c.grassClumps,lots:c.lots,nearTriangles:c.nearTrianglesWholeCircuit,farTriangles:c.farTrianglesWholeCircuit,instanceBufferBytes:c.instanceBufferBytesNearAndFar,constructionMedianMs:c.decorConstructionMs.median,packingMedianMs:c.vegetationPackingMs.median}))}));
