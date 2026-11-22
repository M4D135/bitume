(() => {
 const J=BITUME_JEU, segments=[], exceptions=[], observations=[],champions=[];
 let tDebut=null,tPrec=null,compteur=0,pertes=0,session=null,fin=null,virtuelDebut=0;
 const principal=J.rendu,dessiner=principal.draw;
 let rendus=0,dernierRendu=0,tempsDernierDessin=null;
 principal.draw=function(...a){const retour=dessiner.apply(this,a);if(J.session?.course?.c?.id==='larche' && J.ecran==='course')rendus++;return retour;};
 if(principal.draw===dessiner)throw Error('Impossible de compter les dessins principaux');
 function nouveau(k){return {km:k+1,rendus:0,delaisRendu:[],source:[],longues:[],vMin:Infinity,vMax:0,meteoMin:Infinity,meteoMax:0,sMin:Infinity,sMax:-Infinity}}
 function bilan(x){
   const rendusTries=[...x.delaisRendu].sort((a,b)=>a-b);const quantileR=p=>rendusTries[Math.min(rendusTries.length-1,Math.floor(rendusTries.length*p))]??null;
   const t=[...x.source].sort((a,b)=>a-b),d=t.reduce((a,b)=>a+b,0),q=p=>Math.round(t[Math.min(t.length-1,Math.floor(t.length*p))]*100)/100;
   return {km:x.km,images:t.length,rendus:x.rendus,fpsRendus:+(1000*x.rendus/d).toFixed(2),p95Rendu:quantileR(.95),p99Rendu:quantileR(.99),pireRendu:quantileR(1),secondes:+(d/1000).toFixed(3),fps:+(t.length*1000/d).toFixed(2),p50:q(.5),p95:q(.95),p99:q(.99),pire:q(1),images25ms:x.longues.length,images50ms:x.longues.filter(r=>r[1]>=50).length,intervalles25ms:x.longues,vitesseKmh:[x.vMin,x.vMax],abscisses:[x.sMin,x.sMax],precipitations:[x.meteoMin,x.meteoMax]};
 }
 function relever(t) {
   const S=J.session,co=S?.course,j=co?.joueur;
   if(!j||co.c.id!=='larche'||!((co.phase==='course'||co.phase==='arrivee')&&J.ecran==='course')) {
     if(session && (J.ecran==='resultats'||j?.fini||j?.abandon))fin={ecran:J.ecran,termine:!!j?.fini,abandon:!!j?.abandon,temps:j?.tempsFinal,s:j?.etat?.s};
     else requestAnimationFrame(relever);
     return;
   }
   if(!session){session=S;tDebut=t;virtuelDebut=co.horloge;}
   if(S!==session){exceptions.push('La séance a changé');fin={interrompu:true};return;}
   if(document.hidden)pertes++;
   if(tPrec!==null){
     const ms=t-tPrec,meteo=S.meteo.pluie,et=j.etat,km=Math.max(0,Math.floor((et.s-(co.c.depart||0))/1000)),x=segments[km]||(segments[km]=nouveau(km));
     if(rendus!==dernierRendu){if(tempsDernierDessin!==null)x.delaisRendu.push(t-tempsDernierDessin);tempsDernierDessin=t;}x.source.push(ms);x.rendus+=rendus-dernierRendu;if(ms>=25)x.longues.push([+((t-tDebut)/1000).toFixed(3),+ms.toFixed(2),+et.s.toFixed(2)]);x.vMin=Math.min(x.vMin,et.v*3.6);x.vMax=Math.max(x.vMax,et.v*3.6);
     x.sMin=Math.min(x.sMin,et.s);x.sMax=Math.max(x.sMax,et.s);x.meteoMin=Math.min(x.meteoMin,meteo);x.meteoMax=Math.max(x.meteoMax,meteo);
     if(compteur%60===0){
       const R=J.rendu,scene=R.gl?.canvas || document.getElementById('scene'),P=J.profil,vit=J.vitres.j1;
       observations.push({t:+((t-tDebut)/1000).toFixed(2),s:+et.s.toFixed(1),largeur:scene.width,hauteur:scene.height,css:[scene.clientWidth,scene.clientHeight],qualite:J.reglages.qualite,palier:P?.palier,vue:S.vue,retros:J.reglages.retro,secondaires:P?.secondaires?.retroviseurs?.hz,retroVisibles:['glace-g','glace-d'].filter(id=>!document.getElementById(id).hidden).length,voitures:co.voitures.length,pluie:meteo,mouille:S.meteo.mouille,ssrDemande:S.refletsEcran,ssrReel:R.stats.reflections||R.stats.reflectionMode||false,physx:!!co.physique?.world,backend:vit?.backend,source:vit?.pixelsSource,gouttes:vit?.gouttes,angle:et.cap});
       if(scene.width!==1920||scene.height!==1080||P?.palier!=='high'||S.vue!=='cockpit'||J.reglages.retro!=='oui'||co.voitures.length!==12||!co.physique?.world)exceptions.push(observations.at(-1));
     }
     compteur++;
   }
   dernierRendu=rendus;tPrec=t;
   if(j.fini||j.abandon){fin={ecran:J.ecran,termine:!!j.fini,abandon:!!j.abandon,temps:j.tempsFinal,s:j.etat.s};return;}
   requestAnimationFrame(relever);
 }
 window.recuDescente={
   troncon:i=>segments[i]?bilan(segments[i]):null,
   etat:()=>({fin,kmRoute:session?(session.course.joueur.etat.s-session.course.c.depart)/1000:null,km:session?.course?.joueur?.etat?.s/1000,tReel:tPrec===null?null:(tPrec-tDebut)/1000,simulation:session?session.course.horloge-virtuelDebut:null,compteur,pertes,erreurs:exceptions.length}),
   fin:()=>({fin,compteur,pertes,exceptions,observations,segments:segments.filter(Boolean).map(bilan),
     total:bilan({km:0,delaisRendu:segments.flatMap(x=>x?.delaisRendu||[]),rendus:segments.reduce((n,x)=>n+(x?.rendus||0),0),source:segments.flatMap(x=>x?.source||[]),longues:segments.flatMap(x=>x?.longues||[])}),
     circuit:session.course.c.id,depart:session.course.c.depart,arrivee:session.course.c.arrivee,classement:session.course.classement.map(id=>({id,s:session.course.voitures[id].etat.s,fini:session.course.voitures[id].fini,abandon:session.course.voitures[id].abandon,temps:session.course.voitures[id].tempsFinal}))})
 };requestAnimationFrame(relever);return true;
})()
