// Simulation réelle et frontière WebGL2. Le faux GL ne qualifie pas les pixels du shader :
// compilation/rendu GLES puis captures navigateur sont des contrôles distincts.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
require('../src/visiere-optique.js');require('../src/vitre.js');require('../src/sillage.js');
const O=globalThis.BITUME.visiereOptique,V=globalThis.BITUME.vitre;
let nombre=0;const verifier=(nom,f)=>{f();nombre++;console.log('ok '+nom);};
const contexte=(ajout={})=>({qualite:'high',actif:true,pluie:1,neige:0,embruns:0,vitesse:0,intensite:1,cockpit:true,...ajout});
function avancer(e,c,secondes,hz=60){for(let i=0;i<Math.round(secondes*hz);i++)O.avancerEtat(e,1/hz,c);}
function toile(support=true){
  const appels={dessins:0,copies:0,textures:0,clear:0,supprimes:0,uniformes:{},echouerCopie:false};
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,TEXTURE_2D:5,TEXTURE0:6,RGBA:7,UNSIGNED_BYTE:8,
    COLOR_BUFFER_BIT:9,TRIANGLES:10,DEPTH_TEST:11,BLEND:12,TEXTURE_MIN_FILTER:13,TEXTURE_MAG_FILTER:14,LINEAR:15,
    TEXTURE_WRAP_S:16,TEXTURE_WRAP_T:17,CLAMP_TO_EDGE:18,UNPACK_FLIP_Y_WEBGL:19,
    createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',deleteShader(){},
    createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,getProgramInfoLog:()=>'',
    createVertexArray:()=>({}),createTexture:()=>({}),bindTexture(){},texParameteri(){},texImage2D(){appels.textures++;},
    getUniformLocation:(_,nom)=>nom,disable(){},clearColor(){},viewport(){},useProgram(){},bindVertexArray(){},activeTexture(){},pixelStorei(){},
    uniform1i(n,v){appels.uniformes[n]=v;},uniform2f(n,...v){appels.uniformes[n]=v;},uniform4fv(n,v){appels.uniformes[n]=Array.from(v);},
    drawArrays(){appels.dessins++;},clear(){appels.clear++;},deleteTexture(){appels.supprimes++;},deleteProgram(){appels.supprimes++;},deleteVertexArray(){appels.supprimes++;}};
  const ctx={drawImage(){if(appels.echouerCopie)throw new Error('source refusée');appels.copies++;},setTransform(){},clearRect(){},beginPath(){},ellipse(){},fill(){},stroke(){},moveTo(){},lineTo(){},quadraticCurveTo(){}};
  const listeners=new Map();
  const canvas={width:1280,height:720,clientWidth:1280,clientHeight:720,style:{},
    getContext:type=>type==='webgl2'?(support?gl:null):ctx,getBoundingClientRect:()=>({width:1280,height:720}),
    addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),
    ownerDocument:{createElement:()=>({width:1,height:1,getContext:()=>ctx})}};
  return{canvas,appels,listeners};
}
verifier('état et uniformes identiques aux cadences 30/47/60/120/144 Hz',()=>{
  let ref;
  for(const hz of [30,47,60,120,144]){
    const e=O.creerEtat({graine:2});avancer(e,contexte({pluie:1,vitesse:35}),12,hz);avancer(e,contexte({pluie:0,neige:1,vitesse:12}),12,hz);
    const valeurs=[e.eau,e.neige,e.embruns,e.film,e.etapes,...e.uniformes];
    if(ref)valeurs.forEach((v,i)=>assert(Math.abs(v-ref[i])<1e-6,`${hz} Hz, valeur ${i}`));else ref=valeurs;
  }
});
verifier('petite pluie, averse et réglage fort font monter la charge d’eau ; la vitesse la chasse',()=>{
  const mesures=[];
  for(const [pluie,intensite,vitesse] of [[.2,1,0],[1,1,0],[1,2,0],[1,1,100]]){
    const e=O.creerEtat();avancer(e,contexte({pluie,intensite,vitesse}),20);mesures.push(e.eau);
  }
  assert(mesures[0]<mesures[1] && mesures[1]<mesures[2]);assert(mesures[3]<mesures[1]*.45);
});
verifier('neige accumulée, eau de fonte et dégagement progressif sous abri',()=>{
  const e=O.creerEtat();avancer(e,contexte({pluie:0,neige:1}),24);assert(e.neige>.8 && e.eau>.1);
  const initial=e.neige;avancer(e,contexte({pluie:0,neige:1,abri:true,vitesse:90}),3);assert(e.neige>0 && e.neige<initial*.5);
  avancer(e,contexte({pluie:0,abri:true,vitesse:90}),45);assert.equal(e.neige,0);assert.equal(e.eau,0);
});
verifier('le nuage d’eau monte puis s’efface, sans supprimer les dépôts persistants',()=>{
  const e=O.creerEtat();avancer(e,contexte({pluie:0,embruns:1}),1);assert(e.embruns>.95 && e.eau>.5);
  avancer(e,contexte({pluie:0,embruns:0}),3);assert(e.embruns<.02 && e.eau>.1);
});
verifier('à 300 km/h le sillage recharge la visière ; en sortir évacue la charge sans effacement brutal',()=>{
  const pluie=O.creerEtat(),sillage=O.creerEtat(),c=contexte({vitesse:300/3.6});
  avancer(pluie,c,12);avancer(sillage,{...c,embruns:.8},12);
  assert(sillage.eau>pluie.eau*2.5,'les projections sont encore chassées comme la pluie libre');
  assert(sillage.film>pluie.film*3,'film du sillage insuffisant à grande vitesse');
  const avant=sillage.eau;avancer(sillage,{...c,pluie:0,embruns:0},.25);
  assert(sillage.eau>0 && sillage.eau<avant,'sortie du sillage progressive');
  avancer(sillage,{...c,pluie:0,embruns:0},15);
  assert(sillage.eau<.001 && sillage.embruns<.001 && sillage.film<.001);
});
verifier('les projections seules mouillent à grande vitesse ; abri et neige coupent les nouveaux impacts',()=>{
  const c=contexte({pluie:0,embruns:.8,vitesse:300/3.6});
  const e=O.creerEtat();avancer(e,c,8);assert(e.eau>.65 && e.embruns>.79);
  const avant=JSON.stringify(e);avancer(e,{...c,pause:true},8);assert.equal(JSON.stringify(e),avant);
  const abri=O.creerEtat(),neige=O.creerEtat();
  avancer(abri,{...c,abri:true},8);assert.equal(abri.eau,0);assert.equal(abri.embruns,0);
  avancer(neige,{...c,neige:1},1);assert.equal(neige.embruns,0);
});
verifier('pause exacte, temps borné après interruption et indépendance des vues',()=>{
  const a=O.creerEtat({graine:1}),b=O.creerEtat({graine:2});avancer(a,contexte(),4);avancer(b,contexte(),4);
  assert.notEqual(a.uniformes[10],b.uniformes[10]);const avant=JSON.stringify(a);
  avancer(a,contexte({pause:true}),5);avancer(b,contexte({neige:1}),3);assert.equal(JSON.stringify(a),avant);
  const etapes=a.etapes;O.avancerEtat(a,20,contexte());assert.equal(a.etapes-etapes,30);
});
verifier('WebGL2 choisit le bon backend ; absence WebGL2 conserve le repli existant',()=>{
  assert.equal(V.creer(toile().canvas).stats.backend,'webgl2');
  assert.equal(V.creer(toile(false).canvas).stats.backend,'canvas2d');
  assert.equal(V.creer(null).stats.backend,'canvas2d');
});
verifier('préchauffage prépare la vraie passe puis la laisse transparente et sans dépôt',()=>{
  const t=toile(),e=V.creer(t.canvas),c=contexte({sourceScene:{width:1280,height:720}});
  assert(V.prechauffer(e,c));assert(t.appels.dessins>0 && t.appels.copies>0);
  assert.equal(e.simulation.eau,0);assert(e.simulation.uniformes.every(v=>v===0));assert(e.propre && e.masquee);
  const dessins=t.appels.dessins,copies=t.appels.copies;
  for(let i=0;i<60;i++)V.mettreAJour(e,1/60,{...c,pluie:0});
  assert.equal(t.appels.dessins,dessins);assert.equal(t.appels.copies,copies);
});
verifier('source propre à la vue, budgets de pixels et palier Léger sans copie',()=>{
  const t=toile(),e=V.creer(t.canvas),c=contexte({sourceScene:{width:7680,height:2160},largeur:7680,hauteur:2160,dpr:4});
  for(let i=0;i<120;i++)V.mettreAJour(e,1/60,c);
  assert(e.stats.pixels<=O.MAX_PIXELS && e.stats.pixelsSource<=O.MAX_SOURCE_PIXELS);assert(e.stats.copiesScene>0);
  const copies=e.stats.copiesScene;V.mettreAJour(e,1/60,{...c,qualite:'low'});
  assert.equal(e.stats.copiesScene,copies);assert.equal(t.appels.uniformes.uAvecScene,false);
  V.mettreAJour(e,1/60,c);assert.equal(e.stats.copiesScene,copies+1);assert.equal(t.appels.uniformes.uAvecScene,true);
});
verifier('copie refusée : overlay sans scène ; copie suivante valide rétablit la réfraction',()=>{
  const t=toile(),e=V.creer(t.canvas),c=contexte({sourceScene:{width:1280,height:720}});
  t.appels.echouerCopie=true;for(let i=0;i<60;i++)V.mettreAJour(e,1/60,c);
  assert.match(e.stats.erreur,/source refusée/);assert.equal(t.appels.uniformes.uAvecScene,false);
  t.appels.echouerCopie=false;V.mettreAJour(e,1/60,c);assert.equal(e.stats.erreur,null);assert.equal(t.appels.uniformes.uAvecScene,true);
});
verifier('contexte perdu masque la couche ; restauration redessine et libération nettoie',()=>{
  const t=toile(),e=V.creer(t.canvas),c=contexte({sourceScene:{width:1280,height:720}});
  for(let i=0;i<60;i++)V.mettreAJour(e,1/60,c);const dessins=t.appels.dessins;
  let retenu=false;t.listeners.get('webglcontextlost')({preventDefault(){retenu=true;}});
  assert(retenu && e.stats.perdu && e.masquee);V.mettreAJour(e,1/60,c);assert.equal(t.appels.dessins,dessins);
  t.listeners.get('webglcontextrestored')();V.mettreAJour(e,1/60,c);assert(e.stats.pret && !e.stats.perdu && !e.masquee);
  V.liberer(e);V.liberer(e);assert.equal(t.appels.supprimes,3);assert.equal(t.listeners.size,0);assert.equal(e.canvas,null);
});
verifier('pause ne copie ni ne dessine ; zéro, rétro et off effacent immédiatement',()=>{
  for(const option of [{intensite:0},{retro:true},{qualite:'off'},{actif:false}]){
    const t=toile(),e=V.creer(t.canvas),c=contexte({sourceScene:{width:1280,height:720}});
    for(let i=0;i<60;i++)V.mettreAJour(e,1/60,c);const stats={...e.stats};
    V.mettreAJour(e,.1,{...c,pause:true});assert.deepEqual(e.stats,stats);
    V.mettreAJour(e,0,{...c,pause:true,...option});assert(e.propre && e.masquee);assert.equal(e.simulation.eau,0);
  }
});
verifier('sans dimensions dans le contexte du jeu, dépôts et traînées suivent chaque toile et son redimensionnement',()=>{
  const c=Object.freeze(contexte({pluie:0})),vues=[];
  for(const [largeur,hauteur] of [[960,540],[480,270]]){
    const t=toile();t.canvas.clientWidth=largeur;t.canvas.clientHeight=hauteur;
    const e=V.creer(t.canvas),d=e.simulation.depots,p=d.gouttes[0];
    Object.assign(p,{vivant:true,x:.8,y:.65,px:.8,py:.65,taille:3,pr:3,age:1,pa:1,duree:30,
      poids:1,pp:1,glisse:.04,vitesse:0,phase:0,frequence:.5});p.traceX.fill(.8);p.traceY.fill(.65);d.stats.gouttes=1;
    V.mettreAJour(e,1/120,c);
    assert.equal(d.largeur,largeur);assert.equal(d.hauteur,hauteur);
    assert.deepEqual(t.appels.uniformes.uVue.slice(0,2),[largeur,hauteur]);
    assert(Math.abs(t.appels.uniformes.uGouttes[0]/largeur-.8)<1e-6);
    assert(Math.abs(t.appels.uniformes.uGouttes[1]/hauteur-.35)<1e-6);
    assert(Math.abs(t.appels.uniformes.uTrajets[2]/largeur-.8)<1e-6);
    assert(Math.abs(t.appels.uniformes.uTrajets[3]/hauteur-.35)<1e-6);
    vues.push({t,e,d});
  }
  const {t,e,d}=vues[0],autre=JSON.stringify(vues[1].e.simulation);
  t.canvas.clientWidth=1440;t.canvas.clientHeight=810;V.mettreAJour(e,1/120,c);
  assert.equal(d.largeur,1440);assert.equal(d.hauteur,810);
  assert(Math.abs(t.appels.uniformes.uGouttes[0]/1440-.8)<1e-6);
  assert(Math.abs(t.appels.uniformes.uTrajets[3]/810-.35)<1e-6);
  assert.equal(JSON.stringify(vues[1].e.simulation),autre);
  assert.equal(c.largeur,undefined);assert.equal(c.hauteur,undefined);
});
verifier('sillage réel à 360 km/h : dépôts denses, fusions, sorties aux bords et récupération hors panache',()=>{
  const S=globalThis.BITUME.sillage,wake=S.creer();
  S.mettreAJour(wake,[{id:7,etat:{v:100,s:0}}],[{x:0,y:0,z:0,cap:0}]);
  const embruns=S.exposition(wake,[-12,1,0],1,0);assert(embruns>.75);
  const libre=O.creerEtat({graine:4}),suiveur=O.creerEtat({graine:4}),c=contexte({vitesse:100,largeur:1280,hauteur:720});
  avancer(libre,c,12);avancer(suiveur,{...c,embruns},12);
  assert(suiveur.eau>libre.eau*3.5 && suiveur.eau<=1.9);
  assert(suiveur.depots.stats.gouttes>=libre.depots.stats.gouttes*2);
  assert(suiveur.depots.stats.fusionsEau>10 && suiveur.depots.stats.expulses>10);
  assert(suiveur.depots.stats.surfaceExpulsee>0 && suiveur.nbGouttes>=16);
  const pool=suiveur.depots.gouttes.slice(),buffer=suiveur.gouttesUniformes;
  assert(suiveur.trajetsUniformes.some((v,i)=>i<suiveur.nbGouttes*4 && Math.abs(v-suiveur.gouttesUniformes[i%4<2?i:i-2])>3));
  avancer(suiveur,c,6);assert(Math.abs(suiveur.eau-libre.eau)<.01,'retour à la pluie libre');
  avancer(suiveur,{...c,pluie:0},15);assert.equal(suiveur.eau,0);assert.equal(suiveur.nbGouttes,0);
  assert.equal(suiveur.depots.stats.gouttes,0);assert.equal(suiveur.gouttesUniformes,buffer);
  pool.forEach((p,i)=>assert.equal(p,suiveur.depots.gouttes[i]));
});
verifier('route humide sans pluie dépose de l’eau ; sur route sèche, le vrai sillage n’en crée pas',()=>{
  const S=globalThis.BITUME.sillage,wake=S.creer();S.mettreAJour(wake,[{id:7,etat:{v:100,s:0}}],[{x:0,y:0,z:0,cap:0}]);
  for(const mouille of [0,1]){
    const e=O.creerEtat({graine:4}),embruns=S.exposition(wake,[-12,1,0],mouille,0);
    avancer(e,contexte({pluie:0,embruns,vitesse:100}),12);
    if(mouille){assert(e.eau>1 && e.depots.stats.depotsEmbruns>50 && e.nbGouttes>10);}
    else {assert.equal(e.eau,0);assert.equal(e.nbGouttes,0);assert.equal(e.depots.stats.depotsEau,0);}
  }
});
verifier('la fusion conserve toute l’aire visible à chaque image, même sans film diffus',()=>{
  const t=toile(),e=V.creer(t.canvas),d=e.simulation.depots;
  for(const [i,r,x] of [[0,3,.4],[1,4,.402]]){
    const p=d.gouttes[i];Object.assign(p,{vivant:true,x,y:.4,px:x,py:.4,taille:r,pr:r,age:1,pa:1,duree:30,
      poids:1,pp:1,glisse:.04,vitesse:0,phase:0,frequence:.5});p.traceX.fill(x);p.traceY.fill(.4);
  }
  d.stats.gouttes=2;
  V.mettreAJour(e,1/30,contexte({pluie:0,largeur:1000,hauteur:600}));
  assert.equal(e.stats.fusionsEau,1);assert.equal(e.stats.gouttes,1);assert.equal(e.simulation.eau,0);
  assert.equal(t.appels.uniformes.uNbGouttes,2,'le dépôt absorbé demeure visible au début de la fusion');
  assert.equal(t.appels.uniformes.uGouttes[2],3);assert.equal(t.appels.uniformes.uGouttes[6],4);
  for(let image=1;image<=4;image++){
    V.mettreAJour(e,1/120,contexte({pluie:0,largeur:1000,hauteur:600}));
    const u=t.appels.uniformes,n=u.uNbGouttes;
    const aire=u.uGouttes[2]**2+(n>1?u.uGouttes[6]**2:0);
    assert(Math.abs(aire-25)<.00001,`aire perdue à l’image ${image}: ${aire}`);
  }
  assert.equal(t.appels.uniformes.uNbGouttes,1);assert.equal(t.appels.uniformes.uGouttes[2],5);
  assert(e.stats.dessins>0 && !e.masquee);
});
verifier('gouttes et traînées physiques identiques à 30/47/60/120/144 Hz, plafonds par qualité',()=>{
  let ref;
  for(const hz of [30,47,60,120,144]){
    const e=O.creerEtat({graine:4});avancer(e,contexte({embruns:.8,vitesse:100,largeur:1280,hauteur:720}),8,hz);
    const valeurs=[...e.gouttesUniformes,...e.trajetsUniformes,e.nbGouttes,e.depots.stats.fusionsEau,e.depots.stats.expulses];
    if(ref)valeurs.forEach((v,i)=>assert(Math.abs(v-ref[i])<1e-4,`${hz} Hz, dépôt ${i}`));else ref=valeurs;
  }
  for(const [qualite,maximum] of [['low',6],['medium',12],['high',24],['ultra',32]]){
    const e=O.creerEtat();avancer(e,contexte({qualite,embruns:1,vitesse:65,intensite:2}),10);
    assert(e.depots.stats.gouttes>0 && e.depots.stats.gouttes<=maximum);assert(e.nbGouttes<=maximum);
    assert(e.depots.stats.paires<=maximum*(maximum-1)/2);
  }
});
verifier('perles et film : gravité à l’arrêt, transport vers les quatre bords à 300 km/h dans les deux vues',()=>{
  // Les populations sont encore les mêmes à 0,9 s : aucune disparition ni nouvelle graine
  // ne peut masquer une direction erronée. Le raster natif vérifie séparément leurs pixels.
  for(const cockpit of [true,false])for(const vitesse of [0,300/3.6]){
    const e=O.creerEtat({graine:4});avancer(e,contexte({cockpit,vitesse,largeur:1280,hauteur:720}),.9,120);
    for(const couche of [0,1,2,3,4]){
      const t=e.transportUniformes,i=couche*8;
      assert.equal(e.phaseUniformes[couche*2],0);assert.equal(t[i+3],1);assert.equal(t[i+7],0);
      for(const [x,y] of [[.2,.2],[.8,.2],[.2,.8],[.8,.8]]){
        const dx=x*t[i]+t[i+1]-x,dy=y*t[i]+t[i+2]-y;
        if(!vitesse){assert(Math.abs(dx)<1e-8);assert(dy>0,`couche ${couche}: la gravité monte`);}
        else {assert(dx*(x-.5)>0,`couche ${couche}: convergence horizontale`);assert(dy*(y-.45)>0,`couche ${couche}: descente dominante`);}
      }
    }
  }
});
verifier('changements de flux : positions continues, histoire conservée et projection cohérente',()=>{
  const e=O.creerEtat(),c=contexte({largeur:1280,hauteur:720,vitesseX:0,vitesseY:0,vitesseZ:-80,cameraYaw:0});
  avancer(e,c,.8,120);const avant=[...e.transportUniformes],temoin=O.creerEtat();avancer(temoin,c,.8,120);
  O.avancerEtat(e,0,{...c,cameraYaw:Math.PI/2,ventX:90});assert.deepEqual([...e.transportUniformes],avant);
  O.avancerEtat(e,1/120,{...c,cameraYaw:Math.PI/2,ventX:90});
  e.transportUniformes.forEach((v,i)=>assert(Math.abs(v-avant[i])<.02,`saut de position ${i}`));
  O.avancerEtat(temoin,1/120,c);
  assert.deepEqual([...e.histoireUniformes],[...temoin.histoireUniformes],'une rafale a réécrit le trajet passé');
  const flux=V.calculerFlux({...c,cameraYaw:Math.PI/2,ventX:90},{});
  [flux.expansion,flux.deriveX,flux.deriveY,flux.air,flux.graviteX,flux.graviteY,flux.centreX,flux.centreY]
    .forEach((v,i)=>assert(Math.abs(e.fluxUniformes[i]-v)<1e-7));
});
verifier('renouvellement des perles sans saut : populations pondérées, tampons permanents et cadence conservée',()=>{
  let ref;
  for(const hz of [30,47,60,120,144]){
    const e=O.creerEtat({graine:3}),t=e.transportUniformes,h=e.histoireUniformes,f=e.fluxUniformes,ph=e.phaseUniformes;
    avancer(e,contexte({vitesse:100}),8,hz);
    const valeurs=[...t,...h,...ph,...f];
    if(ref)valeurs.forEach((v,i)=>assert(Math.abs(v-ref[i])<1e-5,`${hz} Hz, transport ${i}`));else ref=valeurs;
    assert(e.couches.every(c=>c.sequence>0),'le banc ne couvre pas le renouvellement');
    for(let i=0;i<6;i++){assert(Math.abs(t[i*8+3]+t[i*8+7]-1)<1e-6);assert(t[i*8]>0&&t[i*8+4]>0);}
    const avant=JSON.stringify(e);avancer(e,contexte({pause:true}),1,hz);assert.equal(JSON.stringify(e),avant);
    assert.equal(e.transportUniformes,t);assert.equal(e.histoireUniformes,h);assert.equal(e.fluxUniformes,f);assert.equal(e.phaseUniformes,ph);
  }
});
verifier('la vraie frontière WebGL transmet le champ et les trajectoires des couches',()=>{
  const t=toile(),e=V.creer(t.canvas),c=contexte({vitesse:300/3.6,cameraRoll:.2,ventX:12,sourceScene:{width:1280,height:720}});
  for(let i=0;i<120;i++)V.mettreAJour(e,1/120,c);
  assert.deepEqual(t.appels.uniformes.uFlux,[...e.simulation.fluxUniformes.slice(0,4)]);
  assert.deepEqual(t.appels.uniformes.uGravite,[...e.simulation.fluxUniformes.slice(4)]);
  assert.deepEqual(t.appels.uniformes.uTransport,[...e.simulation.transportUniformes]);
  assert.deepEqual(t.appels.uniformes.uHistoire,[...e.simulation.histoireUniformes]);
  assert.deepEqual(t.appels.uniformes.uPhase,[...e.simulation.phaseUniformes]);
});
verifier('une toile momentanément nulle ne contamine pas le transport lors de son retour',()=>{
  const e=O.creerEtat();
  for(const [largeur,hauteur] of [[0,720],[1280,0],[-1,-1],[1280,720]]){
    O.avancerEtat(e,1/60,contexte({vitesse:80,largeur,hauteur}));
    for(const buffer of [e.uniformes,e.fluxUniformes,e.transportUniformes,e.histoireUniformes])assert(buffer.every(Number.isFinite));
  }
  assert.equal(e.uniformes[8],1280);assert.equal(e.uniformes[9],720);
});
console.log('visière optique : '+nombre+' contrôles passés');
