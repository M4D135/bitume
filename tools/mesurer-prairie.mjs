// Soumissions du vrai moteur sur une frontière instrumentée. Les archives conservent leur backend d’origine.
// node tools/mesurer-prairie.mjs <BITUME repo> <commit|WORKTREE> <output.json> <low|medium|high|ultra>
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const [repo,requestedRef,output,quality="high"]=process.argv.slice(2);
if(!["low","medium","high","ultra"].includes(quality))throw Error("unknown density");
const memoryBefore=process.memoryUsage();
if(!repo||!requestedRef||!output)throw Error('repo, ref and output required');
const ref=requestedRef==='WORKTREE'?'WORKTREE':execFileSync('git',['-C',repo,'rev-parse',requestedRef],{encoding:'utf8'}).trim();
const hashes={};
function sourceOf(file){
 const text=ref==='WORKTREE'?readFileSync(path.join(repo,file),'utf8'):execFileSync('git',['-C',repo,'show',ref+':'+file],{encoding:'utf8',maxBuffer:4000000});
 hashes[file]=createHash('sha256').update(text).digest('hex');return text;
}
const build=sourceOf('construire.py');
const webgpu=build.includes("'ferro/render-shared.js'");
const rendererFile=webgpu?'src/ferro/render-shared.js':'src/moteur/renderer.js';
const rendererSource=sourceOf(rendererFile);
vm.runInThisContext(rendererSource,{filename:rendererFile});
if(webgpu)for(const file of ['src/ferro/webgpu-shaders.js','src/ferro/webgpu-renderer.js'])
  vm.runInThisContext(sourceOf(file),{filename:file});
const registry=new Map(),register=globalThis.FRender.forme;
globalThis.FRender.forme=(name,triangles)=>{registry.set(name,triangles);return register(name,triangles);};
const ecologyExists=ref==='WORKTREE'?existsSync(path.join(repo,'src/ecologie.js')):
  execFileSync('git',['-C',repo,'ls-tree','--name-only',ref,'src/ecologie.js'],{encoding:'utf8'}).trim().length>0;
const seasonsExist=ref==='WORKTREE'?existsSync(path.join(repo,'src/saisons.js')):
  execFileSync('git',['-C',repo,'ls-tree','--name-only',ref,'src/saisons.js'],{encoding:'utf8'}).trim().length>0;
for(const name of ['graphismes','carene','circuit',...(ecologyExists?['ecologie']:[]),...(seasonsExist?['saisons']:[]),'vegetation','decor','botanique'])vm.runInThisContext(sourceOf('src/'+name+'.js'),{filename:'src/'+name+'.js'});
const fixtureFile=webgpu?'./qualification/commandes-prairie-webgpu.mjs':'../docs/reprise/rapports/herbe-sillage-2026-11-18/fixture-webgl.js';
const fixtureSource=readFileSync(new URL(fixtureFile,import.meta.url),'utf8');
const fixture=webgpu?null:new Function('assert','vm','source','registry',fixtureSource+'\nreturn fixture;')(assert,vm,rendererSource,registry);
const B=globalThis.BITUME,circuit=B.circuit.creer(11,{theme:'foret',longueur:4200});
const decor=B.decor.construire(circuit,{qualite:'high',vegetationQualite:quality});
const isGrass=o=>o.groundCover===true || /^(herbes-val|prairie-val)/.test(o.shape||'');
const cloneLot=lot=>({...lot,tampon:null,tamponLoin:null,paquet:null,paquetLoin:null});
const grassLots=decor.lots.filter(l=>l.vegetation).map(l=>({...cloneLot(l),objets:l.objets.filter(o=>isGrass(o)),loin:(l.loin||[]).filter(o=>isGrass(o))})).filter(l=>l.objets.length);
const sun=decor.atmosphere.sunDirection,sinus=sun[1]/Math.hypot(...sun),extent=100;
const depth=2*(extent*Math.sqrt(Math.max(0,1-sinus*sinus))/Math.max(.25,sinus)+30);
function camera(label,s,side,height,behind,pitch,exterior){
 const q=B.circuit.echantillon(circuit,s),ca=Math.cos(q.cap),sa=Math.sin(q.cap);
 const x=q.x-sa*side-ca*behind,z=q.z+ca*side-sa*behind;
 const y=(decor.sol(x,z)??q.y)+height;
 return {label,s,side,pos:[x,y,z],yaw:q.cap+Math.PI/2,pitch,roll:0,fov:60,near:.045,far:6000,
  sun:{center:exterior?[q.x,q.y,q.z]:[x+ca*76,q.y,z+sa*76],extent,depth}};
}
const cameras=[camera('cockpit',1200,0,1.1,0,0,false),camera('poursuite',2200,0,3.2,8,-.12,true),camera('bord-sol',3400,7.5,.65,0,-.02,true)];
const weather={pluie:.72,nuage:.731,eclair:0,mouille:.75,ventX:2,ventZ:.3};
const fx={time:5,shadows:true,sunOnly:true,torch:false,shadowMapScale:2,msaa:true,bloom:true,reflections:false,adaptive:false,weather,groundCover:B.graphismes.PRAIRIE?.[quality],windStrength:1};
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return{median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),samples:values.length};};
const cases=[];
for(const scope of ['grass-only','full-decor']){
 const creation={msaa:4,shadowMapScale:2,reflections:false,sea:false};
 const f=webgpu?await (await import('./qualification/commandes-prairie-webgpu.mjs')).mesurerCommandes(globalThis.FRenderWebGPU,creation):fixture({creation});
 f.canvas.clientWidth=960;f.canvas.clientHeight=540;f.renderer.resize(1);
 f.renderer.setWorld([],[],decor.atmosphere);
 f.renderer.setNappes(scope==='full-decor'?decor.nappes.map(n=>({...n})):[]);
 const lots=(scope==='grass-only'?grassLots:decor.lots).map(cloneLot);
 const setupStart=performance.now();f.renderer.setLots(lots);const setLotsMs=performance.now()-setupStart;
 const instanceBytes=webgpu?f.resources('Buffer').filter(b=>b.label==='FERRO instances').reduce((n,b)=>n+b.size,0):lots.reduce((n,l)=>n+(l.paquet?.values.byteLength||0)+(l.paquetLoin?.values.byteLength||0),0);
 for(const cam of cameras){
  const durations=[];let submitted=null,rendererStats=null;
  for(let frame=0;frame<32;frame++){
   f.draws.length=0;if(!webgpu)f.blits.length=f.windUniforms.length=0;
   const t=performance.now();f.renderer.draw(cam,[],fx);const elapsed=performance.now()-t;
   if(frame>=8)durations.push(elapsed);
   const next={colorCalls:0,shadowCalls:0,postCalls:0,colorTriangles:0,shadowTriangles:0,postTriangles:0};
   for(const d of f.draws){
    const pass=webgpu?d.pass:d.kind==='fullscreen'?'post':d.target&&!d.target[f.gl.COLOR_ATTACHMENT0]?'shadow':'color';
    next[pass+'Calls']++;next[pass+'Triangles']+=d.count*(d.instances??1)/3;
   }
   if(frame>=8&&submitted)assert.deepEqual(next,submitted,'same static view submits stable work');
   submitted=next;
   rendererStats=Object.fromEntries(['drawCalls','triangles','instances','lots','lotsVisibles','msaa','shadowMaps','shadowMapSize','shadowTileSize','uploadBytes'].map(k=>[k,f.renderer.stats[k]]));
  }
  cases.push({scope,camera:cam.label,cameraParameters:cam,submitted,rendererStats,setLotsMs,instanceBufferBytes:instanceBytes,requestedLiveBufferBytes:f.resources('Buffer').reduce((n,b)=>n+(b.size||b.byteLength||0),0),cpuDrawMs:summarize(durations)});
 }
 f.renderer.dispose();assert.equal(f.live.size,0,'renderer releases its resources');
}
const result={date:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,sourceRef:ref,backend:webgpu?'webgpu':'webgl2-historique',hashes,fixtureSha256:createHash('sha256').update(fixtureSource).digest('hex'),conditions:{theme:'foret',seed:11,length:4200,generalQuality:'high',density:quality,viewport:[960,540],fov:60,warmupFrames:8,measuredFrames:24,fx},vegetation:decor.vegetation,memory:{before:memoryBefore,after:process.memoryUsage(),maxRssKiB:process.resourceUsage().maxRSS},cases,
 scope:'Production setLots/draw and real generated geometry; Colour, shadow and post-process submissions recorded by an inert API. No shader compilation, rasterization, pixels, driver memory measurement or GPU/FPS claims. All CPU times include instrumentation overhead and normal Node/JIT noise. Full-decor omits cars and weather overlays. Grass-only preserves original lot bounding spheres.'};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({sourceRef:ref,grass:cases.filter(c=>c.scope==='grass-only').map(c=>({camera:c.camera,...c.submitted,cpuMedianMs:c.cpuDrawMs.median,lotsVisible:c.rendererStats.lotsVisibles,bufferBytes:c.instanceBufferBytes})),output}));
