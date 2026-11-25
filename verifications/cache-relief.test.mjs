import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/cache-relief.js';

test('relief : la copie persistée précède le creusement ; grille et pigments restitués au bit',()=>{
  const C=BITUME.cacheRelief, plans=()=>[new Float32Array(6),new Float32Array(6),null,new Uint8Array(6),null];
  const r={rapport:{}}, a=plans(); let calculs=0;
  C.grille(r,3,2,-350,42,18,a,()=>{calculs++;a[0][4]=127.125;a[1][1]=230.5;a[3][0]=197;});
  const bloc=r.bloc; a[0][4]=23;
  const b=plans(), seconde={bloc,rapport:{}};
  C.grille(seconde,3,2,-350,42,18,b,()=>calculs++);
  assert.equal(calculs,1); assert.equal(seconde.rapport.source,'indexeddb');
  assert.equal(b[0][4],127.125);assert.equal(b[1][1],230.5);assert.equal(b[3][0],197);
  C.grille({bloc,rapport:{}},3,2,-351,42,18,plans(),()=>calculs++);
  C.grille({bloc:bloc.slice(0,-1),rapport:{}},3,2,-350,42,18,plans(),()=>calculs++);
  assert.equal(calculs,3,'une grille tronquée ou déplacée impose le calcul');
});
