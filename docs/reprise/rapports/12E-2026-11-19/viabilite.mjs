import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const repo = resolve(process.argv[2] || process.cwd());
const sortie = resolve(process.argv[3] || 'docs/reprise/rapports/12E-2026-11-19/viabilite-reexecution');
const filtre = process.argv[4] || '';
const req = createRequire(import.meta.url);
for (const nom of ['circuit','conduite','degats','contacts','obstacles','course','botanique','ecologie','saisons','vegetation','bords','decor','meteo']) req(join(repo,'src',nom+'.js'));
const B = globalThis.BITUME, dt = 1 / 120;
const diagnostic = process.env.BITUME_DIAG === '1';
if(process.env.BITUME_USURE === 'off')B.usurePneus={...B.usurePneus,pas(){return 0;}};
if(process.env.BITUME_GRIP === 'un'&&B.pneus.ADHERENCE_NEIGE){
 B.pneus={...B.pneus,PNEUS:{slicks:[1,0],inter:[1,0],pluie:[1,0],neige:[1,0]},ADHERENCE_NEIGE:{slicks:1,inter:1,pluie:1,neige:1},PERTE_USURE:Object.fromEntries(B.pneus.TYPES.map(t=>[t,{sec:0,eau:0,neige:0}]))};
}
const circuits = [
  {id:'val-brule',nom:'Val-Brûlé',theme:'foret',graine:11,longueur:4200},
  {id:'port-sable',nom:'Port-Sable',theme:'cote',graine:29,longueur:3600},
  {id:'haut-col',nom:'Haut-Col',theme:'montagne',graine:47,longueur:5200}
];
const climats = ['sec','tres-mouille','neige'];
mkdirSync(sortie,{recursive:true});
const hashes = {};
for (const f of ['src/conduite.js','src/pneus.js','src/course.js','src/chaussee.js','src/decor.js']) {
  try { hashes[f] = createHash('sha256').update(readFileSync(join(repo,f))).digest('hex'); } catch {}
}
const rapport = { date:new Date().toISOString(), protocole:{pas:dt,toursDemandes:2,rivaux:11,difficulte:1,graineCourse:2047,borneSecondes:600,meteo:'fixe, couverture explicite',regleFin:'arrêt naturel du jeu ; pas de remise à zéro pour forcer les arrivées',abri:'tunnel réel du circuit',decor:'high, modules botanique/ecologie/vegetation/bords chargés, vrais solides'},hashes,scenarios:[] };
const neutre = {gaz:0,frein:0,volant:0,boite:'auto',aide:.35,guidage:0};
for (const climat of climats) for (const def of circuits) {
  const id=def.id+'-'+climat;
  if(filtre && !id.includes(filtre))continue;
  const deb=performance.now(), c=B.circuit.creer(def.graine,def);
  const saison=B.saisons.profil(climat==='neige'?'hiver':'ete',def.theme);
  const decor=B.decor.construire(c,{qualite:'high',matieres:true,vegetation:true,vegetationQualite:'high',saison:saison.id});
  c.obstacles=B.obstacles.creer(decor.obstacles);
  const meteo={pluie:climat==='tres-mouille'?1:climat==='neige'?.75:0,mouille:climat==='tres-mouille'?1:0,neigeSol:climat==='neige'&&def.theme!=='cote'?.75:0,fixe:true};
  if(B.chaussee)B.chaussee.preparer(meteo,saison);
  B.meteo.actuel=meteo;
  const surface=B.chaussee?B.chaussee.lire(null,0,meteo):B.conduite.eauSurPiste(meteo);
  const pneu=B.conduite.pneusConseilles(surface);
  const co=B.course.creer(c,{mode:'course',tours:2,rivaux:11,difficulte:1,graine:2047,placeJoueur:12});
  for(const v of co.voitures) {v.etat.pneus=pneu;v.livree.pneus=pneu;}
  const trace=co.voitures.map(v=>({id:v.id,progression:v.progression,stagne:0,maxStagne:0,stagneSansAccident:0,maxStagneSansAccident:0,recuperationSecondes:0,usure:[0,0,0,0]}));
  const evenements={}, derniersIncidents=[], anomalies=[],details=[];
  const ev=[],cmd={};let pas=0,maxUsure=0;
  for(;pas<600*120&&!co.termine;pas++){
    const auto=co.joueur.fini?neutre:B.course.commandesIA(co,co.joueur,cmd);
    B.course.pas(co,auto,dt,ev);
    for(const x of ev){evenements[x.type]=(evenements[x.type]||0)+1;if(['accident','repositionnement','reprise','choc'].includes(x.type)){derniersIncidents.push({t:+co.temps.toFixed(3),type:x.type,id:x.id,motif:x.motif,obstacle:x.obstacle});if(derniersIncidents.length>20)derniersIncidents.shift();}}
    if(pas%120===0){
      for(const v of co.voitures){
        const e=v.etat,t=trace[v.id];
        for(const k of ['s','d','v','psi','beta','omega','capAv','capAr','distance'])if(!Number.isFinite(e[k]))anomalies.push({type:'non_fini',id:v.id,k,t:co.temps,valeur:String(e[k])});
        for(let i=0;i<4;i++){
          const u=e.etatPneus[i].usure;
          if(!Number.isFinite(u)||u<0||u>1)anomalies.push({type:'usure_invalide',id:v.id,roue:i,t:co.temps});
          if(u+1e-12<t.usure[i])anomalies.push({type:'remise_a_neuf',id:v.id,roue:i,t:co.temps});
          t.usure[i]=u;maxUsure=Math.max(maxUsure,u);
        }
        if(co.phase==='course'&&co.temps>5&&!v.fini){
          const lent=v.progression-t.progression<.5;
          t.stagne=lent?t.stagne+1:0;t.maxStagne=Math.max(t.maxStagne,t.stagne);
          const incident=!!(e.recuperation||e.accident||e.reparation||e.saut);
          if(incident)t.recuperationSecondes++;
          t.stagneSansAccident=lent&&!incident?t.stagneSansAccident+1:0;
          t.maxStagneSansAccident=Math.max(t.maxStagneSansAccident,t.stagneSansAccident);
        }
        t.progression=v.progression;
        if(diagnostic&&co.temps>5&&!v.fini&&(t.stagne===1||t.stagne>0&&t.stagne%5===0))details.push({t:+co.temps.toFixed(2),id:v.id,s:e.s,d:e.d,v:e.v,progression:v.progression,stagne:t.stagne,stands:e.stands,commande:co._cmdsIA?.[v.id],recuperation:e.recuperation,roues:e.degats?.roues,psi:e.psi,beta:e.beta});
      }
      if(anomalies.length)break;
    }
  }
  const voitures=co.voitures.map(v=>({id:v.id,joueur:v.joueur,fini:v.fini,tours:v.tours,tempsFinal:v.tempsFinal===null?null:+v.tempsFinal.toFixed(3),progressionMetres:+v.progression.toFixed(2),vitesse:+v.etat.v.toFixed(3),replacements:v.etat.repositionnements||0,maxStagnation_s:trace[v.id].maxStagne,maxStagnationSansAccident_s:trace[v.id].maxStagneSansAccident,recuperationSecondes:trace[v.id].recuperationSecondes,usureMax:Math.max(...v.etat.etatPneus.map(r=>r.usure)),abandon:v.abandon}));
  const r={id,climat,circuit:def,monte:pneu,surface,obstacles:c.obstacles.objets.length,secondesSimulees:+co.temps.toFixed(3),secondesReelles:+((performance.now()-deb)/1000).toFixed(3),fin:co.termine?'regle_du_jeu':anomalies.length?'anomalie':'borne_600s',arrives:voitures.filter(v=>v.fini).length,toursDeux:voitures.filter(v=>v.tours>=2).length,voituresTotal:voitures.length,replacements:voitures.reduce((s,v)=>s+v.replacements,0),maxUsure,stagnants15s:voitures.filter(v=>v.maxStagnationSansAccident_s>=15).map(v=>v.id),evenements,anomalies,voitures,derniersIncidents};
  rapport.scenarios.push(r);
  if(diagnostic)writeFileSync(join(sortie,id+'-detail.json'),JSON.stringify(details,null,2)+'\n');
  writeFileSync(join(sortie,id+'.json'),JSON.stringify(r,null,2)+'\n');
  writeFileSync(join(sortie,'rapport.json'),JSON.stringify(rapport,null,2)+'\n');
  console.log(JSON.stringify({id,fin:r.fin,arrives:r.arrives,toursDeux:r.toursDeux,remplacements:r.replacements,stagnants:r.stagnants15s,maxUsure:+maxUsure.toFixed(3),sSimulation:r.secondesSimulees,sReelles:r.secondesReelles,anomalies:anomalies.length}));
}
