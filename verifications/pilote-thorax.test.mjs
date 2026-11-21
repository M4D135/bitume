// Témoins positifs et négatifs sur le vrai modèle candidat, sans modifier voiture.js.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {preparerBanc} from '../tools/qualification/pilote-thorax.mjs';
import {trianglesObjet,surface,mesurerContacts,raccordEpaule,bornes,distanceSurface,interieur} from '../tools/qualification/pilote-surfaces.mjs';

const {V,maillages,modele,empreintes}=preparerBanc();
empreintes['verifications/pilote-thorax.test.mjs']=createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex');
const ev={p:[0,0,0],cap:0,tangage:0,roulis:0,braquage:0,roule:0,v:20,pilote:{volant:0,rapportAvant:2,rapport:3,passage:1}};
const temoins={format:'bitume-temoins-thorax-reel-1',empreintes,lod:{},negatifs:{}};
let complet;
function echantillons(triangles){
 const points=new Map();
 for(const t of triangles)for(const p of [...t,[0,1,2].map(k=>(t[0][k]+t[1][k]+t[2][k])/3)])
  points.set(p.map(x=>Math.round(x*1e8)).join(','),p);
 return [...points.values()];
}
function penetrationSiege(triangles,thorax){
 // Un coussin peut toucher la peau. Les sommets et centres de faces ne doivent
 // pas être à l'intérieur du thorax fermé au-delà de la précision géométrique.
 return echantillons(triangles).find(p=>interieur(p,thorax)&&distanceSurface(p,thorax)>1e-8)||null;
}
test('le thorax rendu reste fermé et ses deux épaules raccordées dans les trois LOD',()=>{
 let reference;
 for(const [detail,indice] of [['complet',0],['moyen',6],['simple',2]]){
  const sortie=[];V.poser(modele,ev,sortie,{detail});
  const R=modele.objetsRendu.pilote,A=R.articulations,pieces=R.variantes[indice].pieces;
  const corps=sortie.find(o=>/^bitume-pilote-buste(?:-|$)/.test(o.shape));assert(corps,'thorax réellement rendu : '+detail);
  const thorax=surface(trianglesObjet(corps,maillages,V),{fermee:true}),b=bornes(thorax.triangles),epaules=[];
  if(!reference)reference=b;else for(const cle of ['lo','hi'])for(let k=0;k<3;k++)assert(Math.abs(reference[cle][k]-b[cle][k])<1e-6,'silhouette extérieure commune : '+detail);
  for(let h=0;h<2;h++){
   const epaule=Array.from(A.slice(h*9,h*9+3)),bras=pieces.find(p=>p.role==='bras-'+h),rotule=pieces.find(p=>p.role==='epaule-'+h);
   assert(bras&&rotule,'bras entier et vraie rotule présents : '+detail);
   assert(sortie.includes(bras.objet)&&sortie.includes(rotule.objet),'raccord effectivement dessiné : '+detail);
   const trBras=trianglesObjet(bras.objet,maillages,V),sRotule=surface(trianglesObjet(rotule.objet,maillages,V));
   const r=raccordEpaule(trBras,thorax,{epaule,rotule:sRotule});assert(r.conforme,'peau/rotule/humérus raccordés sans pénétration hors attache : '+detail+'/'+h);
   assert(r.rayonRotuleMax>.02&&r.rayonRotuleMax<.027,'rotule mesurée de taille réelle : '+detail);
   epaules.push({epaule,chaine:r.chaine,rayonRotuleMax:r.rayonRotuleMax,conforme:r.conforme});
   if(detail==='complet'&&h===1)complet={thorax,bras:trBras,rotule:sRotule,epaule,pieces,A:Array.from(A)};
  }
  temoins.lod[detail]={topologie:thorax.topologie,bornes:b,epaules};
 }
});
test('une vraie manche déplacée entièrement dans le thorax est refusée sans traversée de surface',()=>{
 assert(complet);const p=complet.pieces.find(p=>p.role==='avant-bras-1-3');assert(p);
 const b=bornes(complet.thorax.triangles),centre=b.lo.map((x,k)=>(x+b.hi[k])/2);
 const clone={...p.objet,p:centre};
 const origine=mesurerContacts(trianglesObjet(p.objet,maillages,V),complet.thorax,{epaule:complet.epaule,rayonAttache:.035});assert(!origine.horsAttache,'la manche initiale est dégagée');
 const c=mesurerContacts(trianglesObjet(clone,maillages,V),complet.thorax,{epaule:complet.epaule,rayonAttache:.035});
 assert(!c.croisement);assert(c.entierementContenu);assert(c.horsAttache);assert(c.interieurHorsAttache);
 temoins.negatifs.mancheEnfouie={refuse:true,role:p.role,forme:p.objet.shape,taille:Array.from(p.objet.s),positionAvant:Array.from(p.objet.p),positionInjectee:centre,
  croisement:c.croisement,entierementContenu:c.entierementContenu,interieurHorsAttache:c.interieurHorsAttache};
});
test('le dossier suit le dos rendu et aucun élément du siège ne pénètre le thorax',()=>{
 for(const detail of ['complet','moyen','simple']){
  const sortie=[];V.poser(modele,ev,sortie,{detail});
  const thorax=surface(trianglesObjet(sortie.find(o=>/^bitume-pilote-buste(?:-|$)/.test(o.shape)),maillages,V),{fermee:true});
  const b=bornes(thorax.triangles),siege={pieces:[],jeuxDosM:[]};
  for(const nom of ['assise-pilote','siege-supports','siege-dossier','siege-stries','siege-coutures']){
   const objet=sortie.find(o=>o.shape==='bitume-'+nom);
   if(!objet){assert(!['assise-pilote','siege-supports','siege-dossier'].includes(nom),'siège porteur présent : '+detail+'/'+nom);continue;}
   const tris=trianglesObjet(objet,maillages,V),point=penetrationSiege(tris,thorax);
   assert(!point,'siège dans le thorax : '+JSON.stringify({detail,nom,point}));
   siege.pieces.push(nom);
   if(nom==='siege-dossier'){
    const points=echantillons(tris);
    for(const fraction of [.25,.55,.80]){
     const y=b.lo[1]+fraction*(b.hi[1]-b.lo[1]),bande=points.filter(p=>Math.abs(p[1]-y)<.035&&Math.abs(p[2])<.04);
     assert(bande.length,'dossier rendu continu devant le dos : '+detail+'/'+fraction);
     const jeu=Math.min(...bande.map(p=>distanceSurface(p,thorax)));siege.jeuxDosM.push(jeu);
     assert(jeu<.01,'dossier proche de la peau dans trois bandes de hauteur : '+JSON.stringify({detail,fraction,jeu}));
    }
    if(detail==='complet'){
     const avance=tris.map(t=>t.map(p=>[p[0]+.05,p[1],p[2]])),pointInjecte=penetrationSiege(avance,thorax);
     assert(pointInjecte,'le vrai dossier avancé de cinq centimètres doit être refusé');
     temoins.negatifs.dossierEnfoui={refuse:true,translation:[.05,0,0],pointInterieur:pointInjecte};
    }
   }
  }
  temoins.lod[detail].siege=siege;
 }
});
test('le vrai thorax déplacé hors de portée est refusé par le raccord géométrique',()=>{
 const translation=[2,0,0],loin=surface(complet.thorax.triangles.map(t=>t.map(p=>p.map((x,k)=>x+translation[k]))),{fermee:true});
 const r=raccordEpaule(complet.bras,loin,{epaule:complet.epaule,rotule:complet.rotule});
 assert(!r.lie&&!r.conforme);const A=complet.A,j=9,d=(a,b)=>Math.hypot(A[j+a]-A[j+b],A[j+a+1]-A[j+b+1],A[j+a+2]-A[j+b+2]);
 const os=d(0,3)+d(3,6),ecart=distanceSurface(complet.epaule,loin);assert(ecart>os);
 temoins.negatifs.thoraxHorsPortee={refuse:true,translation,distanceEpaulePeauM:ecart,longueurDeuxOsM:os,raccordLie:r.lie,raccordConforme:r.conforme};
 if(process.env.BITUME_RAPPORT_TEMOINS)fs.writeFileSync(process.env.BITUME_RAPPORT_TEMOINS,JSON.stringify(temoins,null,2)+'\n');
});
