import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {catalogueJeu as catalogue,creerCircuitCatalogue} from './circuit-catalogue.mjs';
import {createHash} from 'node:crypto';
import {chargerPhysX} from '../../verifications/helpers/physx-runtime.mjs';
const require=createRequire(import.meta.url);
for(const f of ['circuit','couverts','destinations','conduite','degats','contacts','obstacles','botanique','ecologie','saisons','vegetation','bosquets','bords','carene','larche-vinadio-decor','marseille-decor','decor','meteo','strategie-stands','course','solides-physx','physique'])require('../../src/'+f+'.js');
const B=globalThis.BITUME, X=globalThis.FPhysX=await chargerPhysX(),DT=1/120;
const ids=(process.env.CIRCUITS||'baikal').split(','), duree=+(process.env.DUREE||75), rivals=+(process.env.RIVAUX||11), out=process.env.RAPPORT||'/tmp/bitume-physx-courses.json';
const sourceFiles=['src/jeu.js','src/circuit.js','src/circuit-raccords.js','src/route-des-cimes.js','src/marseille.js','src/larche-vinadio.js','src/larche-vinadio-data.js','src/physique.js','src/conduite.js','src/course.js','src/solides-physx.js','src/decor.js','src/traces.js','src/bords.js','src/chaussee.js','tools/qualification/physx-courses.mjs'];
const sourceHashes=Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex')]));
const adapterPath=process.env.BITUME_PHYSX_ADAPTER||new URL('../../src/ferro/physx.js',import.meta.url);
const report={backend:X.status(),dt:DT,duree,sourceHashes,adapterSHA256:createHash('sha256').update(readFileSync(adapterPath)).digest('hex'),resultats:[]};
for(const k of catalogue.filter(c=>ids.includes(c.id))){
 const start=performance.now(),c=creerCircuitCatalogue(B,k);
 const weather=process.env.METEO||'sec';
 const decor=B.decor.construire(c,{qualite:'high',matieres:true,vegetation:true,vegetationQualite:'high',saison:weather==='neige'?'hiver':'ete',solsProceduraux:true});c.obstacles=B.obstacles.creer(decor.obstacles);
 const surface=weather==='pluie'?{pluie:1,mouille:1,neigeSol:0}:weather==='neige'?{pluie:.8,mouille:0,neigeSol:.8,precipitationsNeige:true}:{pluie:0,mouille:0,neigeSol:0};
 B.meteo.actuel=B.chaussee.preparer({...surface,fixe:true},B.saisons.profil(weather==='neige'?'hiver':'ete',c.theme));
 const co=B.course.creer(c,{mode:'course',rivaux:rivals,tours:3,difficulte:1,graine:42,placeJoueur:12});co.joueur.ia.hab=.9;
 const pneus=B.conduite.pneusConseilles(B.chaussee.lire(c,0));
 for(const v of co.voitures){Object.assign(v.etat,B.pneus.creerEtat(pneus,{seance:42,voiture:v.id}));v.livree.pneus=pneus;}
 const p=B.physique.installer(co,decor),born=performance.now(),row={circuit:k.id,meteo:weather,constructionMs:born-start,statiques:p.solids.statistiques,frames:0,contacts:0,chocs:0,contactsPerdus:0,placements:0,maxAbsD:0,minOrigineCaisseRoute:Infinity,maxV:0,points:[],voitures:[]};
 const ev=[],cmd={};
 try{
  for(let i=0;i<duree/DT&&!co.termine;i++){
   B.course.commandesIA(co,co.joueur,cmd);B.course.pas(co,cmd,DT,ev);row.contactsPerdus+=p.world.contacts.dropped||0;
   for(const e of ev){if(e.type==='contact')row.contacts++;if(e.type==='choc')row.chocs++;}
   for(const v of co.voitures){const e=v.etat,ph=e._physx;row.maxAbsD=Math.max(row.maxAbsD,Math.abs(e.d));row.maxV=Math.max(row.maxV,e.v);if(Math.abs(e.d)<c.largeur/2-1)row.minOrigineCaisseRoute=Math.min(row.minOrigineCaisseRoute,e.y-(B.circuit.echantillon(c,e.s).y-e.d*Math.sin(B.circuit.echantillon(c,e.s).devers)));}
   if(i%1200===0){const point={t:co.horloge,cars:co.voitures.map(v=>({id:v.id,s:v.etat.s,d:v.etat.d,v:v.etat.v,y:v.etat.y,r:v.etat.repositionnements,sol:v.etat._physx.groundCount,phase:v.etat.stands?.phase}))};row.points.push(point);console.log(k.id,JSON.stringify(point));}
   row.frames++;
  }
  row.placements=p.placements;row.voitures=co.voitures.map(v=>({id:v.id,tours:v.tours,progression:v.progression,s:v.etat.s,d:v.etat.d,v:v.etat.v,replacements:v.etat.repositionnements,accident:!!v.etat.recuperation,usures:v.etat.etatPneus.map(r=>r.usure)}));
 }catch(e){row.erreur=e.stack;console.error(e.stack);}finally{row.simulationMs=performance.now()-born;B.physique.liberer(co);report.resultats.push(row);writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
 console.log('RESULTAT',k.id,JSON.stringify({frames:row.frames,contacts:row.contacts,chocs:row.chocs,placements:row.placements,maxD:row.maxAbsD,minY:row.minOrigineCaisseRoute,maxV:row.maxV,simulationMs:row.simulationMs}));
}
X.dispose();
