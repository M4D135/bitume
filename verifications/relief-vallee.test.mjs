import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { catalogueJeu, creerCircuitCatalogue } from '../tools/qualification/circuit-catalogue.mjs';
const require = createRequire(import.meta.url);
for (const f of ['circuit','couverts','larche-vinadio-data','larche-vinadio-decor','marseille-decor',
  'route-des-cimes-decor','destinations','saisons','lieux','decor','solides-physx']) require('../src/'+f+'.js');
const B = globalThis.BITUME;

test('le panorama utilise les altitudes mesurées en mètres, avec la bonne origine et les zones sans données', () => {
  const sources = '../docs/references/larche-vinadio-2026/sources/piemonte-dtm5-samples.json';
  const src = JSON.parse(readFileSync(new URL(sources,import.meta.url)));
  const g = B.larcheData.reliefVallee, lire = B.larcheRelief.lireGrille(g);
  assert.equal(g.nx*g.nz,46800);
  assert(Math.abs(g.x0-(src.valleyOverview100m.originE+g.pas/2-src.roadSamples[0].E)) < .001);
  assert(Math.abs(g.z0-(src.roadSamples[0].N-src.valleyOverview100m.originN+g.pas/2)) < .001);
  let mesures = 0, absentes = 0;
  for (let j = 0; j < g.nz-1; j++) for (let i = 0; i < g.nx-1; i++) {
    const source = src.valleyOverview100m.elevationsM[j*g.nx+i], h = lire(g.x0+i*g.pas,g.z0+j*g.pas);
    if (source == null) { assert(Number.isNaN(h)); absentes++; }
    else { assert(Math.abs(h+B.larcheData.altitudeBaseM-source) <= .501); mesures++; }
  }
  assert(mesures>30000 && absentes>100);
  assert(Number.isNaN(lire(g.x0-1000,g.z0)));
});

test('la couronne alpine se raccorde aux vrais sommets des tuiles et reste hors du monde de conduite', () => {
  const c = creerCircuitCatalogue(B,catalogueJeu.find(x=>x.id==='larche'));
  const d = B.decor.construire(c,{qualite:'low',saison:'ete',vegetation:false});
  const collines = d.nappes.filter(n=>n.surfaceType==='panorama');
  const terrain = new Map();
  for (const n of d.nappes.filter(n=>n.surfaceType==='terrain')) {
    for (let k=0;k<n.sommets.length;k+=13) terrain.set(n.sommets[k]+','+n.sommets[k+2],n.sommets[k+1]);
  }
  let joints=0, triangles=0;
  for (const n of collines) {
    for (let k=0;k<n.sommets.length;k+=13) {
      const v=n.sommets, h=terrain.get(v[k]+','+v[k+2]);
      if (h!==undefined) { assert.equal(v[k+1],h); joints++; }
      assert(Math.abs(Math.hypot(v[k+3],v[k+4],v[k+5])-1)<1e-5);
    }
    const v=n.sommets;
    for (let k=0;k<n.indices.length;k+=3) {
      const [a,b,c]=n.indices.subarray(k,k+3).map(i=>i*13);
      assert((v[b+2]-v[a+2])*(v[c]-v[a])-(v[b]-v[a])*(v[c+2]-v[a+2])>0);
      triangles++;
    }
  }
  const erreur=()=>assert.fail('un panorama a été envoyé à PhysX');
  const monde={addBox:erreur,addTriangleMesh:erreur,remove:erreur};
  const m=B.solidesPhysX.installer(monde,c,{nappes:collines,lots:[],obstacles:[]});
  assert.equal(m.ids.length,0);
  assert(joints>500 && triangles>20000 && triangles<80000);
  console.log(joints+' sommets de raccord et '+triangles+' triangles de panorama');
});

test('les bordures peintes utilisent le béton en détail enrichi et gardent le contact vibreur sur les onze circuits', () => {
  for (const def of catalogueJeu) {
    const c=creerCircuitCatalogue(B,def), options={qualite:'low',saison:'ete',vegetation:false,organique:true};
    const route = mode => B.decor.construire(c,{...options,matieres:mode}).nappes.filter(n=>n.surfaceType==='accotement');
    const original=route(false), actuel=route(true);
    let convertis=0;
    for (let i=0;i<actuel.length;i++) {
      const a=actuel[i], b=original[i];
      assert.deepEqual(a.indices,b.indices);
      assert.deepEqual(a.surfacesPhysX,b.surfacesPhysX);
      for (let k=9;k<a.sommets.length;k+=13) if (a.sommets[k]===22) {
        assert.equal(b.sommets[k],14);
        convertis++;
      }
    }
    assert(convertis>0,def.id);
  }
});
