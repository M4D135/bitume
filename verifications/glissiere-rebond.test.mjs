import {createRequire} from 'node:module';
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const root=fileURLToPath(new URL("../",import.meta.url));
const require=createRequire(import.meta.url);
require(join(root,'src/conduite.js'));
require(join(root,'src/degats.js'));
const B=globalThis.BITUME;
B.circuit={
  echantillon(c,s){return {x:s,y:0,z:0,cap:0,courbure:0,pente:0,devers:0,ligne:0,vitesse:0};},
  vibreurA(){return false;},
  surVoieStands(){return false;}
};
const circuit={longueur:100000,largeur:12,limite:8};
const command={gaz:0,frein:0,volant:0,derive:false,haut:false,bas:false,boite:'auto',aide:0,guidage:0};
const cases=[];
for(const side of [-1,1]){
  const state=B.conduite.creer(0,0);state.v=200/3.6;state.psi=side*.3;
  let first=null,events=0;
  for(let i=0;i<120;i++){
    const ev=B.conduite.pas(state,command,circuit,1/120);
    for(const event of ev)if(event.type==='choc'){
      events++;
      if(!first)first={time:(i+1)/120,psi:state.psi,beta:state.beta,speed:state.v,d:state.d,force:event.force};
    }
  }
  cases.push({side,first,events,rebound_toward_track:!!first&&side*first.psi<0,after1s:{speed:state.v,d:state.d,psi:state.psi,clearance:circuit.limite-Math.abs(state.d)-1.01*Math.abs(Math.cos(state.psi+state.beta))-2.475*Math.abs(Math.sin(state.psi+state.beta))}});
}
const damage=B.degats.creer();B.degats.choc(damage,8);
const hashes=Object.fromEntries(['conduite.js','jeu.js','degats.js'].map(f=>[f,createHash('sha256').update(readFileSync(join(root,'src',f))).digest('hex')]));
console.log(JSON.stringify({root,hashes,cases,nonBreakingImpact:{force:8,broken:damage.casse,missingWheel:B.degats.uneRouePerdue(damage),persistentTint:damage.teinte}},null,2));

for(const c of cases){assert.ok(c.rebound_toward_track,"le choc renvoie vers la piste");assert.equal(c.events,1,"un seul choc au premier contact");assert.ok(c.after1s.clearance>0,"la caisse entière se décolle du rail malgré son cap conservé");}
