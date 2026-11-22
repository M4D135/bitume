import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
require('../src/cache.js'); require('../src/panorama-cache.js');
const B=globalThis.BITUME, C=B.panoramaCache;
const exemple={sommets:new Float32Array(39),indices:new Uint32Array([0,2,1]),centre:[1/3,10,20],rayon:Math.SQRT2};
exemple.sommets[9]=1/7;
test('abscisses, indices, volumes et étiquette visuelle se relisent sans copie de sommets',()=>{
  const bloc=C.encoder([exemple,exemple]), nappes=C.decoder(bloc);
  for(const n of nappes){
    assert.deepEqual(n,exemple);assert.equal(n.surfaceType,'panorama');
    assert.equal(n.sommets.buffer,bloc);assert.equal(n.indices.buffer,bloc);
    assert.equal(Object.keys(n).includes('surfaceType'),false);
  }
  assert.equal(C.decoder(bloc.slice(0,-4)),null);
  const copie=bloc.slice(0); new Uint32Array(copie)[0]=0; assert.equal(C.decoder(copie),null);
  const indices=C.encoder([exemple]);
  new DataView(indices).setUint32(indices.byteLength-4,9,true);assert.equal(C.decoder(indices),null);
});
test('une valeur corrompue est retirée et une lecture tardive ne change pas les nappes déjà choisies',async()=>{
  const mem=new Map(); B.cache._setMemoryStore(mem);
  try{
    const bloc=C.encoder([exemple]);await B.cache.ecrire('été',bloc);
    const pret=C.ouvrir('été');await pret.lecture;
    const lu=C.obtenir(pret,()=>assert.fail('génération malgré un bloc valide'));
    assert.equal(lu.length,1);assert.equal(pret.rapport.source,'indexeddb');
    const tardif=C.ouvrir('été');const direct=[exemple];
    assert.equal(C.obtenir(tardif,()=>direct),direct);await tardif.lecture;
    assert.equal(tardif.nappes,direct);assert.equal(tardif.rapport.source,'calcul');
    new Uint8Array(bloc)[64]^=1;assert.equal(await B.cache.lire('été'),null);assert.equal(mem.has('été'),false);
  }finally{B.cache._setMemoryStore(null);}
});
test('une entrée valide tardive solde l’écriture sans remplacer le bloc ni attendre au repos', async t => {
  const bloc = C.encoder([exemple]), direct = [exemple], planifies = [];
  let finirLecture;
  t.mock.method(B.cache, 'lire', () => new Promise(ok => { finirLecture = ok; }));
  t.mock.method(B.cache, 'ecrire', () => assert.fail('réécriture d’une entrée valide'));
  const idleAvant = globalThis.requestIdleCallback;
  globalThis.requestIdleCallback = fn => planifies.push(fn);
  t.after(() => {
    if (idleAvant === undefined) delete globalThis.requestIdleCallback;
    else globalThis.requestIdleCallback = idleAvant;
  });
  for (const avantRepos of [true, false]) {
    const cache = C.ouvrir('été');
    assert.equal(C.obtenir(cache, () => direct), direct);
    if (!avantRepos) C.conserver(cache);
    finirLecture(bloc); await cache.lecture;
    if (avantRepos) C.conserver(cache);
    assert.equal(planifies.length, avantRepos ? 0 : 1);
    if (planifies.length) await planifies.shift()();
    assert.equal(cache.nappes, null);
    assert.equal(cache.rapport.source, 'calcul');
    assert.equal(cache.rapport.ecriture, false);
  }
});

test('le préchauffage différencie les options réellement demandées et la version du jeu',()=>{
  const code=readFileSync(new URL('../src/jeu.js',import.meta.url),'utf8');
  const cle=new Function('CATALOGUE','decorEnrichi','B','document','i','v',code.match(/  function clePanorama\(i, v\) \{[\s\S]*?\n  \}/)[0]+';return clePanorama(i,v)');
  const def={ancre:'medium',veut:{matieres:true},vegetationQualite:'medium',saison:'ete'};
  function nom(v=def,enrichi=true,version='V1',id='larche',graine=210){
    return cle([{id,graine}],enrichi,B,{querySelector(){return {textContent:version}}},0,v);
  }
  assert.equal(nom(def,true,'V1','autre'),null);
  assert.equal(new Set([nom(),nom({...def,saison:'hiver'}),nom({...def,ancre:'low'}),nom({...def,vegetationQualite:'low'}),nom({...def,veut:{matieres:false}}),nom(def,false),nom(def,true,'V2'),nom(def,true,'V1','larche',211)]).size,8);
});
