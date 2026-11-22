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

test('la couronne alpine se raccorde aux vrais sommets des tuiles et reste hors du monde de conduite', t => {
  const c = creerCircuitCatalogue(B,catalogueJeu.find(x=>x.id==='larche'));
  const d = B.decor.construire(c,{qualite:'low',saison:'ete',vegetation:false});
  const collines = d.nappes.filter(n=>n.surfaceType==='panorama');
  assert(d.nappes.every(n => (n.vertexTint==='smooth') === ['terrain','panorama'].includes(n.surfaceType)));
  const terrain = new Map();
  for (const n of d.nappes.filter(n=>n.surfaceType==='terrain')) {
    for (let k=0;k<n.sommets.length;k+=13) terrain.set(n.sommets[k]+','+n.sommets[k+2],n.sommets.subarray(k,k+13));
  }
  // Couper seulement le pigment mesuré du terrain proche et comparer les mêmes sommets.
  // Les points sur le ruban routier conservent leur teinte ; le pied des versants évolue.
  t.mock.method(B.larcheRelief, 'pigmentsRelief', () => () => false);
  const original=B.decor.construire(c,{qualite:'low',saison:'ete',vegetation:false});
  const surRoute=new Set();
  for (let i=0;i<c.n;i+=49) {
    const x=Math.round(c.x[i]/32)*32,z=Math.round(c.z[i]/32)*32;
    if (Math.hypot(x-c.x[i],z-c.z[i])<16) surRoute.add(x+','+z);
  }
  let modifies=0, routeVerifiee=0;
  for (const n of original.nappes.filter(n=>n.surfaceType==='terrain')) {
    const v=n.sommets;
    for (let k=0;k<v.length;k+=13) {
      const cle=v[k]+','+v[k+2], h=terrain.get(cle);
      if (h[10]!==v[k+10] || h[11]!==v[k+11] || h[12]!==v[k+12]) modifies++;
      if (surRoute.delete(cle)) {
        assert.deepEqual(h.subarray(10,13),v.subarray(k+10,k+13));
        routeVerifiee++;
      }
    }
  }
  assert.ok(modifies>10000, 'les pigments mesurés atteignent les tuiles proches');
  assert.ok(routeVerifiee>30, 'la chaussée conserve son sol historique');
  let joints=0, triangles=0;
  for (const n of collines) {
    for (let k=0;k<n.sommets.length;k+=13) {
      const v=n.sommets, h=terrain.get(v[k]+','+v[k+2]);
      if (h!==undefined) {
        assert.equal(v[k+1],h[1]);
        assert.deepEqual(v.subarray(k+10,k+13),h.subarray(10,13));
        joints++;
      }
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

test('les proportions WorldCover utilisent la grille du MNT et changent uniquement le pigment du panorama', () => {
  const d = B.larcheData.reliefVallee, c = d.couverture;
  const src = JSON.parse(readFileSync(new URL('../docs/references/larche-vinadio-2026/sources/worldcover-2021.json', import.meta.url)));
  assert.deepEqual(src.classes, [10,30,60]);
  assert.deepEqual([c.nx*c.pas,c.nz*c.pas],[d.nx*d.pas,d.nz*d.pas]);
  for (const axe of ['x0','z0']) assert.ok(Math.abs((c[axe]-c.pas/2)-(d[axe]-d.pas/2)) < .001);
  const fractions = Buffer.from(c.fractionsU8,'base64');
  assert.equal(fractions.length, 3*c.nx*c.nz);
  const moyenne = [0,0,0], brute = Buffer.from(src.fractionsU8,'base64');
  for (let k=0; k<fractions.length; k+=3) {
    assert.ok(fractions[k]+fractions[k+1]+fractions[k+2] <= 257);
    for (let j=0; j<3; j++) moyenne[j] += fractions[k+j]-brute[k+j];
  }
  for (const delta of moyenne) assert.ok(Math.abs(delta)/(c.nx*c.nz*255) < .001);
  // Même petite grille de géométrie, deux classes extrêmes et deux saisons.
  const grid = {...d, x0:0, z0:0, pas:100, nx:15, nz:15,
    metresI16LE:Buffer.alloc(15*15*2).toString('base64')};
  function echantillon(classe, neige) {
    const valeurs = Buffer.alloc(12);
    for (let i=classe;i<valeurs.length;i+=3) valeurs[i]=255;
    const couverture={x0:0,z0:0,pas:800,nx:2,nz:2,fractionsU8:valeurs.toString('base64')};
    return B.larcheRelief.construire({...grid,couverture},new Map(),256,32,{neige})[0];
  }
  const foret=echantillon(0,false), mineral=echantillon(2,false), hiver=echantillon(0,true);
  assert.deepEqual(foret.indices,mineral.indices);
  assert.deepEqual(foret.indices,hiver.indices);
  for (let k=0;k<foret.sommets.length;k+=13) {
    assert.deepEqual(foret.sommets.subarray(k,k+10),mineral.sommets.subarray(k,k+10));
    assert.deepEqual(foret.sommets.subarray(k,k+10),hiver.sommets.subarray(k,k+10));
    assert.ok(foret.sommets[k+10]<mineral.sommets[k+10] && foret.sommets[k+11]>foret.sommets[k+10]);
    assert.ok(hiver.sommets[k+10]>foret.sommets[k+10]);
  }
});

test('les pigments de versant suivent les pentes et l’occupation mesurées', () => {
  const n = 15, pas = 100;
  const relief = (classe, altitude) => {
    const hauteurs = Buffer.alloc(n*n*2), fractions = Buffer.alloc(3*n*n);
    for (let j=0;j<n;j++) for (let i=0;i<n;i++) {
      hauteurs.writeInt16LE(altitude(i,j), 2*(j*n+i));
      if (classe !== null) fractions[3*(j*n+i)+classe] = 255;
    }
    const grille = { nx:n,nz:n,x0:0,z0:0,pas };
    return B.larcheRelief.pigmentsRelief({ ...grille, metresI16LE:hauteurs.toString('base64'),
      couverture:{ ...grille, fractionsU8:fractions.toString('base64') } });
  };
  const plat=()=>500, pente=i=>200+110*i, dos=i=>1200-75*Math.abs(i-7);
  const lire = (f, x=700) => { const rgb=[]; assert.ok(f(x,700,rgb)); return rgb; };
  const herbe=lire(relief(1,plat)), foret=lire(relief(0,plat)), roche=lire(relief(2,plat));
  assert.ok(foret[0]<herbe[0] && foret[1]>foret[0] && herbe[0]<roche[0]);
  assert.ok(lire(relief(2,pente))[0]>roche[0]+.10, 'affleurement sur le versant escarpé');
  assert.ok(lire(relief(2,dos))[0]>roche[0], 'épaulement exposé');
  assert.deepEqual(lire(relief(null,pente)),lire(relief(null,plat)), 'les autres classes ne reçoivent aucun affleurement');
  const absent=relief(1,()=>-32768);
  assert.equal(absent(700,700,[]),false);assert.equal(relief(2,plat)(-100,700,[]),false);
});
