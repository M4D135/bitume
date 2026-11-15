// Troncs solides : prisme exact du cylindre WebGL, sans feuillage ni cylindre vertical élargi.
import {createRequire} from 'node:module';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=process.env.BITUME_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),req=createRequire(import.meta.url);
for(const f of ['circuit','conduite','degats','obstacles','contacts','course','carene','decor'])req(path.join(root,'src',f+'.js'));
const B=globalThis.BITUME,O=B.obstacles,CD=B.conduite,DG=B.degats,realTrack=B.circuit.echantillon,results=[];
const trunk=(extra={})=>({type:'prism',genre:'tronc',p:[0,6,0],s:[.3,12,.3],r:[0,0,0],sides:16,...extra});
const pose=(x=0,z=0,extra={})=>({x,z,angle:0,hx:2.475,hz:1.01,ymin:0,ymax:1.1,...extra});
function indexed(d){const o=O.creer([d]).objets[0];assert.ok(o,'tronc absent de l’index');return o;}
function check(name,f){try{B.circuit.echantillon=realTrack;f();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}}
function flat(){B.circuit.echantillon=(c,s)=>({x:s,z:0,y:0,cap:0,courbure:0,devers:0,pente:0});}
function setup(v=40,y=1,d=0,descriptor=trunk({p:[10,6,0],r:[.06,.3,-.04]})){flat();const e=CD.creer(5,d);Object.assign(e,{v,y,rapport:6,degats:DG.creer()});return {e,co:{c:{longueur:1000,largeur:100,limite:100,obstacles:O.creer([descriptor])},horloge:0,voitures:[{id:0,etat:e,degats:e.degats}]}};}
function run(co,e,changes){co.horloge+=1/120;O.avant(co);Object.assign(e,changes);const ev=[];O.pas(co,ev);return ev;}
check('index : prisme16 accepté, dimensions/rotations invalides rejetées',()=>{assert.equal(O.creer([trunk(),trunk({s:[-1,2,3]}),trunk({r:[NaN,0,0]}),trunk({sides:1}),trunk({p:[1e20,6,0]}),trunk({p:[1e308,6,0],s:[1e308,12,1e308]}),trunk({s:[1e-320,12,.3]})]).objets.length,1);});
check('32 sommets et bornes exacts, Rz·Ry·Rx ; géométrie source inchangée',()=>{
 const d=trunk({p:[15.9,6,32.1],s:[.3,12,.4],r:[.06,.7,-.04]}),old=JSON.stringify(d),o=indexed(d);assert.equal(o.sommets.length,32);
 for(let i=0;i<16;i++)for(let k=0;k<2;k++){const a=i*Math.PI/8;let [x,y,z]=[Math.cos(a)*d.s[0]/2,(k?1:-1)*d.s[1]/2,Math.sin(a)*d.s[2]/2];let t=y;y=y*Math.cos(d.r[0])-z*Math.sin(d.r[0]);z=t*Math.sin(d.r[0])+z*Math.cos(d.r[0]);t=x;x=x*Math.cos(d.r[1])+z*Math.sin(d.r[1]);z=-t*Math.sin(d.r[1])+z*Math.cos(d.r[1]);t=x;x=x*Math.cos(d.r[2])-y*Math.sin(d.r[2]);y=t*Math.sin(d.r[2])+y*Math.cos(d.r[2]);for(let j=0;j<3;j++)assert.ok(Math.abs(o.sommets[i*2+k][j]-[x,y,z][j])<1e-12);}
 assert.equal(JSON.stringify(d),old);for(const v of o.sommets){assert.ok(v[0]+o.x>=o.xmin&&v[0]+o.x<=o.xmax);assert.ok(v[1]+o.y>=o.ymin&&v[1]+o.y<=o.ymax);assert.ok(v[2]+o.z>=o.zmin&&v[2]+o.z<=o.zmax);}assert.ok(O.creer([d]).grille.size>1);
});
for(const axis of [0,2])for(const sign of [-1,1])check('inclinaison axe'+axis+' sens'+sign+' : tranche réelle, vide près de la base',()=>{
 const r=[0,0,0];r[axis]=sign*.06;const o=indexed(trunk({r})),v=o.aretes[0],yy=.4,at=yy-6;
 assert.ok(O.tester(pose(v[0]*at/v[1],v[2]*at/v[1],{hx:.03,hz:.03,ymin:yy-.03,ymax:yy+.03}),o));
 assert.equal(O.tester(pose(0,0,{hx:.03,hz:.03,ymin:yy-.03,ymax:yy+.03}),o),null,'pas un gros cylindre vertical fictif');
});
check('caps et facettes : au-dessus/dessous libres, facette polygonale sans cercle gonflé',()=>{
 const o=indexed(trunk());assert.equal(O.tester(pose(0,0,{ymin:12,ymax:13}),o),null);assert.equal(O.tester(pose(0,0,{ymin:-1,ymax:0}),o),null);
 const a=Math.PI/16,r=.15;assert.equal(O.tester(pose(Math.cos(a)*r,Math.sin(a)*r,{hx:.0001,hz:.0001,ymin:2,ymax:3}),o),null);
 assert.ok(O.tester(pose(Math.cos(a)*r*.97,Math.sin(a)*r*.97,{hx:.0001,hz:.0001,ymin:2,ymax:3}),o));
});
check('caps inclinés : hauteur AABB seule ne crée pas de faux solide',()=>{const o=indexed(trunk({r:[.06,0,.04]}));assert.equal(O.tester(pose(o.xmin,o.zmax,{hx:.001,hz:.001,ymin:o.ymax-.001,ymax:o.ymax+.01}),o),null);});
check('containment : profondeur horizontale entière, sortie finie et test pur',()=>{for(const r of [[0,0,0],[.06,.7,-.04],[.4,.3,-.3]]){const o=indexed(trunk({r})),a=pose(0,0,{ymin:5,ymax:6}),json=JSON.stringify([o,a]),h=O.tester(a,o);assert.ok(h&&Number.isFinite(h.depth));assert.ok(Math.abs(Math.hypot(h.nx,h.nz)-1)<1e-12);assert.equal(O.tester({...a,x:a.x+h.nx*(h.depth+.001),z:a.z+h.nz*(h.depth+.001)},o),null);assert.equal(JSON.stringify([o,a]),json);}});
check('CCD : arbre fin traversé entre deux poses libres, casse/quatre roues/arrêt',()=>{const {co,e}=setup(),ev=run(co,e,{s:20,distance:15});assert.ok(e.degats.casse);assert.equal(e.v,0);assert.ok(e.s<10);assert.equal(ev.filter(x=>x.type==='casse').length,1);assert.equal(ev.filter(x=>x.type==='roue').length,4);assert.equal(ev.filter(x=>x.type==='choc'&&x.obstacle==='tronc').length,1);const fixed=[e.s,e.d];run(co,e,{});assert.deepEqual([e.s,e.d],fixed);});
check('CCD vertical : caps traversés entre hauteurs libres',()=>{const {co,e}=setup(0,14,0,trunk({p:[5,6,0]}));run(co,e,{y:-2});assert.ok(e.y>=12&&e.y<12.01);assert.equal(e.v,0);});
check('passage haut et sous les racines : pas de mur invisible',()=>{for(const y of [13,-2]){const {co,e}=setup(40,y),ev=run(co,e,{s:20});assert.equal(ev.length,0);assert.equal(e.s,20);assert.ok(!e.degats.casse);}});
check('impact léger : énergie et cap caisse préservés, aucune casse',()=>{const {co,e}=setup(5);e.beta=.15;const ev=run(co,e,{s:20});assert.ok(ev.some(x=>x.type==='choc'));assert.ok(e.v<=5&&!e.degats.casse);assert.ok(Math.abs(e.psi+e.beta-.15)<1e-10);});
check('frôlement tangent : passage libre sans collision élargie',()=>{const {co,e}=setup(50,1,1.161,trunk({p:[10,6,0]}));const ev=run(co,e,{s:20});assert.equal(ev.length,0);assert.equal(e.v,50);});
check('chevauchement immobile : correction sans dégâts ni vitesse',()=>{const {co,e}=setup(0);e.s=10;run(co,e,{});assert.equal(O.tester(pose(e.s,e.d,{angle:e.psi+e.beta,ymin:e.y,ymax:e.y+1.1}),co.c.obstacles.objets[0]),null);assert.equal(e.v,0);assert.equal(e.degats.chocs,0);});
const actual=[[11,'foret',4200,1119.2503992610818,30.126671699057564,-5.636906863502683],[29,'cote',3600,2914.988726381194,-30.58991972793483,-.32210412485675366],[47,'montagne',5200,4636.035692977203,-30.56354590324779,1.1201933896433194]];
for(const [seed,theme,longueur,s,d,y] of actual)check('décor réel '+theme+' : tous troncs, aucun feuillage, grand saut200km/h destructif puis reprise',()=>{
 const c=B.circuit.creer(seed,{theme,longueur}),decor=B.decor.construire(c),trees=decor.lots.flatMap(l=>l.objets).filter(x=>x.shape==='cylinder'&&x.mat===10),desc=decor.obstacles.filter(x=>x.genre==='tronc');assert.ok(trees.length>100);assert.equal(desc.length,trees.length);assert.ok(!decor.obstacles.some(x=>x.genre==='foliage'));
 trees.forEach((t,i)=>{assert.deepEqual(desc[i].p,t.p);assert.deepEqual(desc[i].s,t.s);assert.deepEqual(desc[i].r,t.r);assert.equal(desc[i].sides,16);});
 c.obstacles=O.creer(decor.obstacles);const co=B.course.creer(c,{mode:'chrono',rivaux:0}),e=co.joueur.etat,side=Math.sign(d);Object.assign(e,{s,d:side*10,y,v:200/3.6,psi:side*Math.PI/2,rapport:6});CD.lancerSaut(e,{grand:true,h:1.8,duree:1});let ev=[];for(let k=0;k<100&&!e.degats.casse;k++)ev.push(...B.course.pas(co,{gaz:1,frein:0,volant:0,boite:'auto',aide:0,guidage:0},1/120));assert.ok(e.degats.casse,'arbre traversé');assert.equal(e.v,0);assert.ok(ev.some(x=>x.type==='choc'&&x.obstacle==='tronc'));assert.ok(!co.joueur.abandon);assert.equal(co.fantome.meilleur,null);const impactS=e.s;for(let k=0;k<80;k++)B.course.pas(co,{gaz:0,frein:0,volant:0,boite:'auto'},1/120);assert.equal(e.s,impactS);assert.equal(e.d,0);assert.ok(!e.degats.casse&&!e.recuperation);assert.ok(!co.termine);assert.equal(co.joueur.tourValide,false);
});
console.log(JSON.stringify({passed:results.filter(x=>x.ok).length,total:results.length,results},null,2));if(results.some(x=>!x.ok))process.exitCode=1;
