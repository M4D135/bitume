import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {chargerPhysX} from '../../verifications/helpers/physx-runtime.mjs';
const require=createRequire(import.meta.url);
for(const f of ['circuit','conduite','degats','contacts','obstacles','botanique','ecologie','saisons','vegetation','bords','carene','decor','meteo','strategie-stands','course','solides-physx','physique'])require('../../src/'+f+'.js');
const B=globalThis.BITUME, X=globalThis.FPhysX=await chargerPhysX(),DT=1/120;
const src=readFileSync(new URL('../../src/jeu.js',import.meta.url),'utf8');
const catalogue=vm.runInNewContext(src.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
const ids=(process.env.CIRCUITS||'baikal').split(','), duree=+(process.env.DUREE||75), rivals=+(process.env.RIVAUX||11), out=process.env.RAPPORT||'/tmp/bitume-physx-courses.json';
const adapter=process.env.BITUME_PHYSX_ADAPTER||fileURLToPath(new URL('../../src/ferro/physx.js',import.meta.url));
const files=['src/circuit.js','src/conduite.js','src/course.js','src/strategie-stands.js','src/physique.js','src/solides-physx.js','src/bords.js','src/decor.js','src/ferro/physx-runtime.js','tools/qualification/physx-courses.mjs'];
const empreintes=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(new URL('../../'+f,import.meta.url))).digest('hex')]));
empreintes.adaptateurPhysX=createHash('sha256').update(readFileSync(adapter)).digest('hex');
const report={date:new Date().toISOString(),node:process.version,portee:'Diagnostic de courses à plusieurs voitures avec le vrai WASM ; les collisions de course sont autorisées.',backend:X.status(),adapter,empreintes,dt:DT,duree,resultats:[]};
mkdirSync(dirname(resolve(out)),{recursive:true});
for(const k of catalogue.filter(c=>ids.includes(c.id))){
 const start=performance.now(),c=B.circuit.creer(k.graine,{theme:k.theme,longueur:k.longueur,nom:k.nom});B.bords.limites(c,B.bords.planifier(c));
 const decor=B.decor.construire(c,{qualite:'high',matieres:true,vegetation:true,vegetationQualite:'high',saison:'ete'});c.obstacles=B.obstacles.creer(decor.obstacles);
 const weather=process.env.METEO||'sec',surface=weather==='pluie'?{pluie:1,mouille:1,neigeSol:0}:weather==='neige'?{pluie:.8,mouille:0,neigeSol:.8,precipitationsNeige:true}:{pluie:0,mouille:0,neigeSol:0};
 B.meteo.actuel=B.chaussee.preparer({...surface,fixe:true},B.saisons.profil(weather==='neige'?'hiver':'ete',c.theme));
 const co=B.course.creer(c,{mode:'course',rivaux:rivals,tours:3,difficulte:1,graine:42,placeJoueur:12});co.joueur.ia.hab=.9;
 const pneus=B.conduite.pneusConseilles(B.chaussee.lire(c,0));
 for(const v of co.voitures){Object.assign(v.etat,B.pneus.creerEtat(pneus,{seance:42,voiture:v.id}));v.livree.pneus=pneus;}
 const p=B.physique.installer(co,decor),born=performance.now(),row={circuit:k.id,meteo:weather,constructionMs:born-start,statiques:p.solids.statistiques,frames:0,contacts:0,chocs:0,placements:0,maxAbsD:0,minChassisRoute:Infinity,minChassisTrianglesVisibles:Infinity,maxV:0,corrections:{pose:0,vitesse:0,rotation:0},points:[],voitures:[]};
 for(const [name,key] of [['setPose','pose'],['setVelocity','vitesse'],['setAngularVelocity','rotation']]){const original=p.world[name];p.world[name]=function(...args){row.corrections[key]++;return original.apply(this,args);};}
 const ev=[],cmd={},origin=[0,0,0],hit={};
 try{
  for(let i=0;i<duree/DT&&!co.termine;i++){
   B.course.commandesIA(co,co.joueur,cmd);B.course.pas(co,cmd,DT,ev);
   for(const e of ev){if(e.type==='contact')row.contacts++;if(e.type==='choc')row.chocs++;}
   for(const v of co.voitures){const e=v.etat,ph=e._physx;if(![ph.x,ph.y,ph.z,e.v,e.tangage,e.roulis].every(Number.isFinite))throw new Error('Etat non fini pour voiture '+v.id);row.maxAbsD=Math.max(row.maxAbsD,Math.abs(e.d));row.maxV=Math.max(row.maxV,e.v);if(Math.abs(e.d)<c.largeur/2-1){const q=B.circuit.echantillon(c,e.s);row.minChassisRoute=Math.min(row.minChassisRoute,e.y-(q.y-e.d*Math.sin(q.devers)));origin[0]=ph.x;origin[1]=ph.y+12;origin[2]=ph.z;p.world.raycast(origin,[0,-1,0],24,{mask:1,staticOnly:true},hit);if(!hit.hit)throw new Error('Triangles visibles absents sous voiture '+v.id);row.minChassisTrianglesVisibles=Math.min(row.minChassisTrianglesVisibles,ph.y-hit.y);}}
   if(i%1200===0){const point={t:co.horloge,cars:co.voitures.map(v=>({id:v.id,s:v.etat.s,d:v.etat.d,v:v.etat.v,y:v.etat.y,r:v.etat.repositionnements,sol:v.etat._physx.groundCount,phase:v.etat.stands?.phase}))};row.points.push(point);console.log(k.id,JSON.stringify(point));}
   row.frames++;
  }
  row.placements=p.placements;row.voitures=co.voitures.map(v=>({id:v.id,tours:v.tours,progression:v.progression,s:v.etat.s,d:v.etat.d,v:v.etat.v,replacements:v.etat.repositionnements,accident:!!v.etat.recuperation,usures:v.etat.etatPneus.map(r=>r.usure)}));
 }catch(e){row.erreur=e.stack;process.exitCode=1;console.error(e.stack);}finally{row.simulationMs=performance.now()-born;B.physique.liberer(co);row.mondesRestants=X.status().worlds;report.resultats.push(row);writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
 console.log('RESULTAT',k.id,JSON.stringify({frames:row.frames,contacts:row.contacts,chocs:row.chocs,placements:row.placements,maxD:row.maxAbsD,minY:row.minChassisRoute,maxV:row.maxV,simulationMs:row.simulationMs}));
}
X.dispose();
