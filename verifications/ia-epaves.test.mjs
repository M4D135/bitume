import {createRequire} from 'node:module';import assert from 'node:assert/strict';const req=createRequire(import.meta.url);for(const f of ['circuit','conduite','degats','contacts','course'])req(f==='course'&&process.env.BITUME_COURSE?process.env.BITUME_COURSE:'../src/'+f+'.js');const B=globalThis.BITUME,results=[];
B.circuit={echantillon:(c,s)=>({x:s,y:0,z:0,cap:0,courbure:0,pente:0,devers:0,ligne:0,vitesse:80}),ecart:(c,a,b)=>{let d=b-a;if(d>c.longueur/2)d-=c.longueur;else if(d<-c.longueur/2)d+=c.longueur;return d;},vibreurA:()=>false};
const c={longueur:3000,largeur:12,limite:6,pas:5,n:600,vitesse:new Array(600).fill(80),ligne:new Array(600).fill(0),courbure:new Array(600).fill(0),depart:0};
for(const [d,h] of [[0,Math.PI/2],[2,Math.PI/2],[-2,Math.PI/2],[0,Math.PI/4]]){
 const co=B.course.creer(c,{rivaux:1,graine:3,tours:1});co.phase='course';co.temps=20;co.feux.vert=true;
 const a=co.voitures[0],b=co.voitures[1];Object.assign(a.etat,{s:1000,d,v:0,psi:h});B.degats.choc(a.degats,20);
 Object.assign(b.etat,{s:870,d:0,v:65,psi:0});let contact=false,passed=false,minGap=Infinity;
 for(let k=0;k<1440&&!passed;k++){
  const ev=B.course.pas(co,{gaz:0,frein:0,volant:0,derive:false,boite:'auto',aide:0},1/120);
  contact ||= ev.some(e=>e.type==='contact');minGap=Math.min(minGap,Math.abs(1000-b.etat.s));passed=b.etat.s>1008;
 }
 const safe=!contact&&!b.degats.casse&&(passed||(b.etat.s<995&&b.etat.v<1.5));results.push({d,heading:h,contact,passed,v:b.etat.v,s:b.etat.s,lat:b.etat.d,safe});
}
console.log(JSON.stringify({passed:results.filter(x=>x.safe).length,total:4,results},null,2));assert.ok(results.every(x=>x.safe));
