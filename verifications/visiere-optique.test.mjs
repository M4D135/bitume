// Simulation réelle et frontière WebGL2. Le faux GL ne qualifie pas les pixels du shader :
// compilation/rendu GLES puis captures navigateur sont des contrôles distincts.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
require('../src/visiere-optique.js');require('../src/vitre.js');
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
console.log('visière optique : '+nombre+' contrôles passés');
