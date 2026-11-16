// BITUME : reprise WebGL2 EMPRISE, identité des triangles et humidité persistante.
import assert from 'node:assert/strict';
import '../src/moteur/renderer.js';
const S=FRender.shared;
const n=[0,0,1],t=[[0,0,0],[1,0,0],[0,1,0],n,n,n];FRender.forme('test-moteur-libre',[t,t]);
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function expand(source,indices){const words=new Uint32Array(source.vertices.buffer,source.vertices.byteOffset,source.vertices.length),out=new Uint32Array(indices.length*6);for(let i=0;i<indices.length;i++)out.set(words.subarray(indices[i]*6,indices[i]*6+6),i*6);return out;}
const rapports=[];
for(const lod of [undefined,true,2]){
 const source=S.geometry(lod),old=source.indices.slice(),indexed=S.indexPrimitiveVertices(source);
 assert.deepEqual(bytes(expand(source,indexed.indices)),bytes(expand(source,old)),'chaque triangle indexé garde ses 18 mots exacts et son ordre');
 assert.deepEqual(source.indices,old,'le snapshot développé reste inchangé');assert.ok(indexed.stats.vertices<indexed.stats.references,'réutilisation des sommets');
 const free=source.ranges['test-moteur-libre'];assert.deepEqual(indexed.indices.slice(free.offset/4,free.offset/4+free.count),old.slice(free.offset/4,free.offset/4+free.count),'formes libres sans fusion');
 assert.equal(indexed.restore('test-moteur-libre'),null);assert.ok(indexed.restore('box'));assert.equal(indexed.restore('box'),null);
 for(const name of Object.keys(source.ranges))indexed.restore(name);assert.deepEqual(indexed.indices,old,'restauration avant updateShape sans alias résiduel');
 rapports.push({detail:lod??'fin',...indexed.stats});
}
const env=S.environmentInfo({skyTop:[.2,.4,.6],sunColor:[1,1,1],wind:.6});const original=JSON.stringify(env),w=S.bitumeWeather(env,{pluie:.6,nuage:.8,eclair:0,mouille:.9},12);
assert.ok(Math.abs(w.values[0]-.9)<1e-6);assert.ok(Math.abs(w.values[2]-.6)<1e-6);
const references=[w.values,w.skyTop,w.skyBottom,w.fog,w.sunColor,w.ambient,w.cloudOffset];
assert.equal(S.bitumeWeather(env,{pluie:0,nuage:.2,eclair:0,mouille:.7},13,w),w);assert.ok(Math.abs(w.values[0]-.7)<1e-6,'humidité après la pluie');assert.equal(w.values[2],0);
for(const [i,key] of ['values','skyTop','skyBottom','fog','sunColor','ambient','cloudOffset'].entries())assert.equal(w[key],references[i]);
S.bitumeWeather(env,{pluie:Infinity,nuage:9,eclair:-1,mouille:NaN},14,w);assert.deepEqual([...w.values],[0,1,0,0]);
S.bitumeWeather(env,[.3,.4,.5,.2],15,w);assert.ok(Math.abs(w.values[0]-.3)<1e-6,'vec4 natif accepté');assert.equal(JSON.stringify(env),original,'environnement conservé');
assert.equal(S.settings({reflections:false}).reflections,false,'aucun SSR implicite');assert.equal(S.settings({reflections:true}).reflections,true);
console.log('moteur EMPRISE : triangles exacts aux 3 LOD, formes libres, restauration, météo et SSR optionnel',JSON.stringify(rapports));
// Le branchement WebGL2 doit désindexer avant une mutation, puis restaurer le même état après perte du contexte.
let serial=0;const constants=new Map(),uploads=[],subUploads=[],listeners={};
const gl=new Proxy({}, {get(_,key){
 if(typeof key!=='string')return undefined;
 if(/^[A-Z][A-Z0-9_]*$/.test(key)){if(!constants.has(key))constants.set(key,++serial);return constants.get(key);}
 if(key==='getParameter')return ()=>4096;
 if(key==='getShaderParameter'||key==='getProgramParameter')return ()=>true;
 if(key==='getExtension')return ()=>null;
 if(key==='checkFramebufferStatus')return ()=>constants.get('FRAMEBUFFER_COMPLETE');
 if(key==='bufferData')return (target,data)=>uploads.push({target,data:data.slice?.()});
 if(key==='bufferSubData')return (target,offset,data)=>subUploads.push({target,offset,data:data.slice()});
 return key.startsWith('create')||key==='getUniformLocation'?()=>({id:++serial}):()=>{};
}});
globalThis.window={devicePixelRatio:1,innerWidth:800,innerHeight:600};
const renderer=FRender.create({getContext:()=>gl,addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){},width:800,height:600,clientWidth:800,clientHeight:600});
const expanded=S.geometry(),box=expanded.ranges.box,first=expanded.indices[box.offset/4]*6,changed=expanded.vertices.slice(first,first+box.count*6);changed[0]+=.01;
renderer.updateShape('box',changed);
assert.equal(renderer.stats.primitiveIndex.restored,1);
assert.deepEqual(subUploads[0].data,expanded.indices.slice(box.offset/4,box.offset/4+box.count));
assert.deepEqual(subUploads[1].data,changed);
listeners.webglcontextlost({preventDefault(){}});assert.equal(renderer.stats.contextLost,true);const previous=uploads.length;listeners.webglcontextrestored();
assert.equal(renderer.stats.contextLost,false);const after=uploads.slice(previous);const restoredVertices=after.find(x=>x.data instanceof Float32Array&&x.data.length>6).data;const restoredIndices=after.find(x=>x.data instanceof Uint32Array).data;
assert.deepEqual(restoredVertices.slice(first,first+changed.length),changed);assert.deepEqual(restoredIndices.slice(box.offset/4,box.offset/4+box.count),expanded.indices.slice(box.offset/4,box.offset/4+box.count));
renderer.dispose();console.log('moteur EMPRISE : updateShape WebGL2, indices et sommets restaurés après perte du contexte');
