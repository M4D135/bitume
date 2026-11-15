// Les volumes solides doivent rester alignés sur les primitives réellement dessinées, sans troncs inclinés fictifs.
import {createRequire} from 'node:module';import assert from 'node:assert/strict';const req=createRequire(import.meta.url);for(const f of ['circuit','conduite','degats','contacts','obstacles','course','carene','decor'])req('../src/'+f+'.js');const B=globalThis.BITUME,reports=[];
for(const [graine,theme,longueur,approche] of [[11,'foret',4200,2195],[29,'cote',3600,1770],[47,'montagne',5200,1550]]){
 const c=B.circuit.creer(graine,{theme,longueur}),decor=B.decor.construire(c),objects=decor.lots.flatMap(l=>l.objets).filter(o=>o.collision),index=B.obstacles.creer(decor.obstacles);
 assert.equal(index.objets.length,objects.length);assert.ok(index.objets.length>100);
 const kinds={};objects.forEach((o,k)=>{const d=index.objets[k];kinds[d.genre]=(kinds[d.genre]||0)+1;assert.equal(d.x,o.p[0]);assert.equal(d.z,o.p[2]);assert.equal(d.ymin,o.p[1]-o.s[1]/2);assert.equal(d.ymax,o.p[1]+o.s[1]/2);if(d.type==='circle'){assert.equal(o.shape,'cylinder');assert.equal(d.r,o.s[0]/2);assert.ok(!o.r||(!o.r[0]&&!o.r[2]));}else{assert.equal(o.shape,'box');assert.equal(d.angle,-(o.r?o.r[1]:0));assert.equal(d.hx,o.s[0]/2);assert.equal(d.hz,o.s[2]/2);}});
 for(const kind of ['pneus','pilier','muret','batiment','gradin'])assert.ok(kinds[kind]>0,kind);
 c.obstacles=index;const co=B.course.creer(c,{mode:'chrono',rivaux:0}),e=co.joueur.etat;Object.assign(e,{s:approche,d:0,v:50,rapport:6,psi:0});const cmd={gaz:1,frein:0,volant:0,derive:false,boite:'auto',aide:0,guidage:0};let impact=null;
 for(let k=0;k<1200&&!e.degats.casse;k++){const ev=B.course.pas(co,cmd,1/120);for(const x of ev)if(x.type==='choc')impact={t:co.horloge,s:e.s,d:e.d,force:x.force,obstacle:x.obstacle||'glissiere'};}
 assert.ok(e.degats.casse,'virage serré à180km/h sans braquer : casse');const stopped={s:e.s,d:e.d};for(let k=0;k<600;k++)B.course.pas(co,cmd,1/120);assert.equal(e.s,stopped.s);assert.equal(e.d,stopped.d);assert.equal(e.v,0);assert.ok(co.joueur.abandon);assert.ok(co.termine);assert.equal(co.fantome.meilleur,null);
 reports.push({graine,theme,solides:index.objets.length,kinds,impact,terminal:true});
}
console.log(JSON.stringify({passed:3,total:3,reports},null,2));
