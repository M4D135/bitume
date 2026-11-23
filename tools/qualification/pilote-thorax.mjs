// Qualification indépendante des surfaces réellement posées par voiture.js.
// Usage : node tools/qualification/pilote-thorax.mjs rapport.json [scenes.json] [detail] [qualite]
// Aucune substitution du source, aucune modification du modèle, aucune construction HTML.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {lireMaillages,trianglesObjet,surface,mesurerContacts,bornes,distanceSurface,raccordEpaule} from './pilote-surfaces.mjs';

const racine=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const noms=['ferro/render-shared.js','carene.js','main.js','humain-donnees.js','humain-corps.js','ferro/vehicle-dynamics.js',
 'pneus.js','usure-pneus.js','chaussee.js','conduite.js','expressions-pilote.js','voiture.js'];
const recouvre=(a,b)=>a.lo.every((x,k)=>x<=b.hi[k]+1e-9&&a.hi[k]+1e-9>=b.lo[k]);
const membre=role=>/^(gant|bras|avant-bras|manche-joint|coude|epaule)-/.test(role);
const cote=role=>Number(role.split('-').find(x=>/^[01]$/.test(x)));
function scenesCourtes(){
 const scenes=[];
 for(const volant of [-1,0,1])scenes.push({nom:'volant',volant,passage:1});
 for(const passage of [.30,.38,.50,.72])for(const volant of [-1,0,1])scenes.push({nom:'rapport',volant,passage,rapportAvant:2,rapport:3});
 for(const geste of ['majeur','poing','salut'])for(const gesteCote of [-1,1])for(const gesteIntensite of [.6,.7,1])
  scenes.push({nom:'geste',geste,gesteCote,gesteIntensite,gestePhase:.43,volant:0,passage:1});
 return scenes;
}
export function preparerBanc(qualite=false){
 const contexte=vm.createContext({console});vm.runInContext('globalThis.window=globalThis',contexte);
 const empreintes={};
 for(const nom of noms){const source=fs.readFileSync(path.join(racine,'src',nom),'utf8');empreintes['src/'+nom]=createHash('sha256').update(source).digest('hex');vm.runInContext(source,contexte,{filename:nom});}
 for(const nom of ['tools/qualification/pilote-surfaces.mjs','tools/qualification/pilote-thorax.mjs'])empreintes[nom]=createHash('sha256').update(fs.readFileSync(path.join(racine,nom))).digest('hex');
 const V=contexte.BITUME.voiture,maillages=lireMaillages(contexte,qualite),modele=V.modele({couleur:[.8,.12,.1],combinaison:[.9,.85,.7],numero:27});
 return {contexte,V,maillages,modele,empreintes};
}
export function qualifier({scenes=scenesCourtes(),details=['complet','moyen','simple'],qualite=false,progression=false}={}){
 const {V,maillages,modele,empreintes}=preparerBanc(qualite);
 const ev={p:[0,0,0],cap:0,tangage:0,roulis:0,braquage:0,roule:0,v:20,pilote:{}};
 const cache=new Map(),rapport={format:'bitume-pilote-surfaces-1',statut:'en_cours',empreintes,qualite,
  geometrie:qualite===false?'FRender.shared.geometry(false), répertoire des primitives du rendu WebGPU':'Répertoire réduit du rendu logiciel',
  attacheM:.035,scenes:scenes.length,scenarios:scenes,lod:{},limites:['Prises jante/pommeau réservées aux tests de contact dédiés.',
  'Appui thorax-assise et liaison au fond de cuve contrôlés par les tests de siège dédiés.',
  'Contrôle des triangles de rendu et des articulations ; ne remplace pas la revue visuelle du jeu.']};
 function obstacle(nom,objet,fixe=true){
  // Les têtes suivent chaque pose : conserver tous leurs BVH ferait croître
  // la mémoire avec le nombre de scénarios. Seules les pièces fixes sont cachées.
  if(!fixe)return {nom,s:surface(trianglesObjet(objet,maillages,V))};
  const cle=JSON.stringify([objet.shape,Array.from(objet.p),Array.from(objet.r),Array.from(objet.s)]);
  if(!cache.has(cle)){const triangles=trianglesObjet(objet,maillages,V);cache.set(cle,surface(triangles));}
  return {nom,s:cache.get(cle)};
 }
 for(const detail of details){
  const li=detail==='complet'?0:detail==='moyen'?3:1,vi=li*2;
  const resultat=rapport.lod[detail]={poses:0,posesAvecContact:0,contacts:{},exemples:[],attaches:[],raccordsEpaule:{controles:0,absents:0,rotulesHorsAttache:0,rayonRotuleMax:0,exemples:[]},osErreurMax:0,porteeMax:0};
  let torse;
  for(const scene of scenes){
   Object.assign(ev.pilote,{volant:0,rapportAvant:2,rapport:3,passage:1,passageVisuel:null,geste:null,gesteIntensite:0,gestePhase:0,regard:0},scene);
   const sortie=[];V.poser(modele,ev,sortie,{detail});
   const presents=new Set(sortie),R=modele.objetsRendu.pilote,A=R.articulations,pieces=R.variantes[vi].pieces,table=modele.objetsRendu.tables[li*4];
   const objetTorse=sortie.find(o=>/^bitume-pilote-buste(?:-|$)/.test(o.shape));
   if(!objetTorse)throw Error('Thorax réellement rendu absent : '+detail);
   if(!torse){torse=surface(trianglesObjet(objetTorse,maillages,V),{fermee:true});resultat.topologie=torse.topologie;resultat.bornes=bornes(torse.triangles);
    for(let h=0;h<2;h++){const p=Array.from(A.slice(h*9,h*9+3));resultat.attaches.push({epaule:p,distancePeauM:distanceSurface(p,torse)});}}
   const fixes=[],tetes=[];
   for(let i=0;i<table.objets.length;i++){
    const o=table.objets[i];if(!presents.has(o)||table.buste[i])continue;
    (table.tete[i]?tetes:fixes).push(obstacle(o.shape+'#'+i,o,!table.tete[i]));
   }
   if(!tetes.length)throw Error('Tête réellement rendue absente : '+detail);
   for(const p of pieces)if(/^(planche|casquette|support-volant|console-levier|retro-)/.test(p.role)&&presents.has(p.objet))fixes.push(obstacle(p.role,p.objet));
   const membres=pieces.filter(p=>membre(p.role)&&presents.has(p.objet)).map(p=>{
    const triangles=trianglesObjet(p.objet,maillages,V);return {role:p.role,cote:cote(p.role),triangles,bornes:bornes(triangles)};
   });
   const rotules=membres.filter(m=>/^epaule-[01]$/.test(m.role)).map(m=>{
    return {cote:m.cote,s:surface(m.triangles)};
   });
   let touche=false;
   function signaler(categorie,role,o,c){
    const cle=categorie+':'+role+'/'+o.nom;resultat.contacts[cle]=(resultat.contacts[cle]||0)+1;touche=true;
    if(resultat.exemples.length<40)resultat.exemples.push({categorie,scene,role,obstacle:o.nom,point:c.pointsHorsAttache[0]||c.pointInterieurHorsAttache,
     entierementContenu:c.entierementContenu,articulations:Array.from(A)});
   }
   function tester(categorie,role,tris,b,obstacles,options){for(const o of obstacles){if(!recouvre(b,o.s.arbre))continue;const c=mesurerContacts(tris,o.s,options);if(c.horsAttache)signaler(categorie,role,o,c);}}
   for(const m of membres){
    const epaule=Array.from(A.slice(m.cote*9,m.cote*9+3));
    const contactTorse=mesurerContacts(m.triangles,torse,{epaule,rayonAttache:.035});
    if(contactTorse.horsAttache)signaler('membre-thorax',m.role,{nom:'thorax'},contactTorse);
    if(/^bras-[01]$/.test(m.role)){resultat.raccordsEpaule.controles++;
     const rotule=rotules.find(r=>r.cote===m.cote),r=raccordEpaule(m.triangles,torse,{epaule,rotule:rotule&&rotule.s});
     resultat.raccordsEpaule.rayonRotuleMax=Math.max(resultat.raccordsEpaule.rayonRotuleMax,r.rayonRotuleMax);
     if(!r.rotuleDansAttache)resultat.raccordsEpaule.rotulesHorsAttache++;
     if(!r.lie){resultat.raccordsEpaule.absents++;
      if(resultat.raccordsEpaule.exemples.length<12)resultat.raccordsEpaule.exemples.push({scene,role:m.role,epaule});}}
    tester('membre-coque',m.role,m.triangles,m.bornes,fixes);
    tester('membre-tete',m.role,m.triangles,m.bornes,tetes);
   }
   const droite=membres.filter(m=>m.cote===1).flatMap(m=>m.triangles);
   if(droite.length){const s=surface(droite);for(const m of membres.filter(m=>m.cote===0))tester('bras-bras',m.role,m.triangles,m.bornes,[{nom:'membres-droits',s}]);}
   // Le bas du thorax peut toucher son assise ; toutes les autres peaux restent des obstacles.
   tester('thorax-coque','thorax',torse.triangles,torse.arbre,fixes.filter(o=>!/assise|siege/.test(o.nom)));
   for(const o of tetes)tester('tete-coque',o.nom,o.s.triangles,o.s.arbre,fixes);
   // Reconstruction 126 CK : humérus 27 cm, avant-bras 29 cm ; tolérance et oracle inchangés.
   for(let h=0;h<2;h++){const j=h*9,d=(a,b)=>Math.hypot(A[j+a]-A[j+b],A[j+a+1]-A[j+b+1],A[j+a+2]-A[j+b+2]);
    resultat.osErreurMax=Math.max(resultat.osErreurMax,Math.abs(d(0,3)-.27),Math.abs(d(3,6)-.29));resultat.porteeMax=Math.max(resultat.porteeMax,d(0,6));}
   resultat.poses++;if(touche)resultat.posesAvecContact++;
   if(progression&&resultat.poses%25===0)console.error(JSON.stringify({detail,progression:resultat.poses,total:scenes.length,posesAvecContact:resultat.posesAvecContact}));
  }
 }
 rapport.statut=Object.values(rapport.lod).every(r=>r.posesAvecContact===0&&r.raccordsEpaule.absents===0&&r.raccordsEpaule.rotulesHorsAttache===0&&r.osErreurMax<1e-8)?'conforme_sur_echantillon':'echec_conserve';return rapport;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const destination=process.argv[2];if(!destination)throw Error('Fichier de rapport requis.');
 const scenes=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3],'utf8')):undefined;
 const details=process.argv[4]?[process.argv[4]]:undefined,qualite=process.argv[5]==='2'?2:process.argv[5]==='true';
 const r=qualifier({scenes,details,qualite,progression:true});fs.writeFileSync(destination,JSON.stringify(r,null,2)+'\n');
 console.log(JSON.stringify({statut:r.statut,lod:Object.fromEntries(Object.entries(r.lod).map(([k,v])=>[k,{poses:v.poses,posesAvecContact:v.posesAvecContact,contacts:v.contacts,osErreurMax:v.osErreurMax}]))}));
 if(r.statut!=='conforme_sur_echantillon')process.exitCode=1;
}
