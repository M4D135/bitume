// La tenue du volant est mesurée sur le dos du gant et le bras réellement posés.
// Les tolérances de contact jante/pommeau restent celles de pilote-commun.
import assert from 'node:assert/strict';
import test from 'node:test';
import {preparerBanc} from '../tools/qualification/pilote-thorax.mjs';
import {surface,trianglesObjet,distanceSurface,interieur,mesurerContacts} from '../tools/qualification/pilote-surfaces.mjs';

const {V,contexte,modele,maillages}=preparerBanc(),M=contexte.BITUME.main,points=M.construire().points;
const ev={p:[0,0,0],cap:0,tangage:0,roulis:0,braquage:0,roule:0,v:20,pilote:{volant:0,rapportAvant:2,rapport:3,passage:1}};
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0)/Math.hypot(...a)/Math.hypot(...b))))*180/Math.PI;

test('le dos et la manchette suivent l’avant-bras au neutre et sur toute la course du volant',()=>{
 let maximum=0,neutre=0,poses=0;
 for(const [detail,indice] of [['complet',0],['moyen',6],['simple',2]])for(let n=0;n<=100;n++){
  ev.pilote.volant=-1+n/50;const sortie=[];V.poser(modele,ev,sortie,{detail});
  const R=modele.objetsRendu.pilote,A=R.articulations;
  for(let h=0;h<2;h++){
   const j=h*9,k=h?1:-1,dos=R.variantes[indice].pieces.find(p=>p.role==='gant-'+h+'-5');
   assert(dos&&sortie.includes(dos.objet),'dos du gant réellement rendu : '+detail);
   const axe=V.mul(V.euler(...dos.objet.r),[M.AXE[0],M.AXE[1],k*M.AXE[2]]),avant=[0,1,2].map(i=>A[j+3+i]-A[j+6+i]);
   const cassure=angle(axe,avant);maximum=Math.max(maximum,cassure);
   assert(cassure<18,'poignet excessivement cassé : '+JSON.stringify({detail,volant:ev.pilote.volant,h,cassure}));
   if(n===50){neutre=Math.max(neutre,cassure);assert(cassure<2,'poignet neutre dans l’axe de l’avant-bras');}
   assert(Math.abs(Math.hypot(...avant)-.29)<1e-8,'avant-bras de longueur constante');
  }
  poses++;
 }
 console.log(JSON.stringify({poses,angleNeutreMaxDeg:neutre,angleCourseMaxDeg:maximum}));
});

test('les quatre doigts et le pouce restent raccordés au dos articulé pendant le braquage',()=>{
 const echelle=V.K*V.VOLANT.rayon/M.JANTE.R;
 for(let n=0;n<=20;n++){
  ev.pilote.volant=-1+n/10;V.poser(modele,ev,[],{detail:'complet'});
  const R=modele.objetsRendu.pilote,H=R.habitacle;
  for(let h=0;h<2;h++){
   const k=h?1:-1,main=H.mains[h],F=main.rep.m,c=main.pieces[0].ferme.c,
    origine=main.pieces[0].o.map((v,i)=>v-V.K*(F[i]*c[0]+F[3+i]*c[1]+F[6+i]*c[2])),
    dos=R.variantes[0].pieces.find(p=>p.role==='gant-'+h+'-5'),peau=surface(trianglesObjet(dos.objet,maillages,V),{fermee:true});
   for(let doigt=0;doigt<4;doigt++){
    const p=points.doigts[doigt][0].map((v,i)=>v*echelle*(i===2?k:1)),
     racine=origine.map((v,i)=>v+F[i]*p[0]+F[3+i]*p[1]+F[6+i]*p[2]),
     rayon=M.DOIGTS[doigt].r*echelle,jeu=distanceSurface(racine,peau);
    assert(interieur(racine,peau)||jeu<rayon,'doigt détaché de la paume : '+JSON.stringify({volant:ev.pilote.volant,h,doigt,jeu,rayon}));
   }
   const pieces=R.variantes[0].pieces,prise=surface(trianglesObjet(pieces.find(p=>p.role==='gant-'+h+'-0').objet,maillages,V)),
    pouce=trianglesObjet(pieces.find(p=>p.role==='gant-'+h+'-6').objet,maillages,V);
   assert(mesurerContacts(pouce,peau).horsAttache,'racine du pouce reliée à la paume');
   assert(mesurerContacts(pouce,prise).croisement,'éminence du pouce reliée aux doigts de prise');
  }
 }
});
