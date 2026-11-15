// Les états de vol et de roue perdue ne doivent pas traverser un rail solide.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.env.BITUME_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(import.meta.url);
for(const f of ['circuit','conduite','degats'])req(path.join(root,'src',f+'.js'));
const B=globalThis.BITUME, C=B.conduite, D=B.degats, dt=1/120;
const c=B.circuit.creer(11,{theme:'foret',longueur:4200});
const cmd={gaz:1,frein:0,volant:0,boite:'auto',aide:0,guidage:0};
const results=[];
function check(name,fn){try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}}
function state(side,psi=.65,v=45){
 const s=1000,q=B.circuit.echantillon(c,s),e=C.creer(s,side*17.4);
 Object.assign(e,{v,psi:side*psi,rapport:6,y:q.y-side*c.largeur/2*Math.sin(q.devers)});e.degats=D.creer();return e;
}
function advance(e,n=30){const ev=[];for(let k=0;k<n;k++)ev.push(...C.pas(e,cmd,c,dt));return ev;}
for(const side of [-1,1]){
 check('petit bond contre rail '+side+' : casse unique, quatre roues, épave immobile',()=>{
  const e=state(side);C.lancerSaut(e,{grand:false});const ev=advance(e);
  assert.ok(e.degats.casse,'le petit bond traverse le rail sans casser');assert.equal(e.v,0);
  assert.equal(ev.filter(x=>x.type==='casse').length,1);assert.equal(ev.filter(x=>x.type==='roue').length,4);
  assert.ok(Math.abs(e.d)<C.limiteCote(c,e.s,side));const fixed=[e.s,e.d];advance(e,600);assert.deepEqual([e.s,e.d],fixed);
 });
 check('roue perdue puis second choc violent '+side+' : casse définitive',()=>{
  const e=state(side);C.subirChoc(e,10);assert.ok(!e.degats.casse);const ev=advance(e);
  assert.ok(e.degats.casse,'le freinage roue perdue masque le second choc');assert.equal(e.reparation,null);
  assert.equal(ev.filter(x=>x.type==='casse').length,1);const fixed=[e.s,e.d];advance(e,1800);assert.equal(e.v,0);assert.deepEqual([e.s,e.d],fixed);
 });
 check('survol haut '+side+' : pas de mur invisible au-dessus de la glissière',()=>{
  const e=state(side);e.y+=3;C.lancerSaut(e,{grand:true});const ev=advance(e,30);
  assert.ok(!e.degats.casse);assert.equal(e.degats.chocs,0);assert.ok(Math.abs(e.d)>20);assert.ok(!ev.some(x=>x.type==='choc'));
 });
 check('frôlement rapide en bond '+side+' : vitesse normale faible, pas de casse',()=>{
  const e=state(side,.02);e.d=side*18.95;C.lancerSaut(e,{grand:false});advance(e,10);
  assert.ok(!e.degats.casse);assert.ok(e.v>40);assert.ok(!D.uneRouePerdue(e.degats));
 });
}
console.log(JSON.stringify({passed:results.filter(x=>x.ok).length,total:results.length,results},null,2));
if(results.some(x=>!x.ok))process.exitCode=1;
