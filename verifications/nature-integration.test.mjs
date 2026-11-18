// Vraies sections de production, frontières renderer/DOM remplacées ; ce contrôle ne remplace pas WebGL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
require('../src/ambiance.js'); require('../src/graphismes.js');
const source=readFileSync(new URL('../src/jeu.js',import.meta.url),'utf8');
const A=globalThis.BITUME.ambiance,Grap=globalThis.BITUME.graphismes;
function section(debut,fin){
  const a=source.indexOf(debut),b=source.indexOf(fin,a);
  assert.ok(a>=0 && b>a,'section réelle de jeu.js');return source.slice(a,b);
}
const base={skyTop:[.1,.3,.6],skyBottom:[.6,.7,.8],fog:[.6,.7,.8],sunColor:[1,1,1],ambient:[.3,.3,.4],fogDensity:.0003};
const env=[],miroirs=[],dessins=[];
const session={nature:{ambiance:A.creer(base,true),revisionRendu:-1,faune:null},fauneVue:null};
let crees=0;
const B={ambiance:A,faune:{
  creer:()=>{crees++;return {habitats:true};},
  dessiner:(etat,t,ctx,sortie)=>{dessins.push({...ctx,t,etat});sortie.push({faune:true});}
}};
const ctx={B,S:session,session,co:{horloge:180},reglages:{moment:'nuit'},
  rendu:{setEnvironment:v=>env.push(v)},retro:{rendu:{setEnvironment:v=>miroirs.push(v)}},
  c:{},scene:{decor:{}},P:Grap.melange('high',0),ps:{x:1,y:2,z:3},meteo:{pluie:.3},horlogeReelle:5,sortie:[]};
const lumiere=section('    if (S.nature) {','    if (B.meteo) B.meteo.actuel');
const reflet=section('    if (S.nature && (retro.ambianceSource','    retro.rendu.draw(camR');
const faune=section("    if (S.nature && B.faune && P.faune !== 'off'",'    // voitures : toujours dessinées');
let controles=0;
const verifier=(nom,f)=>{f();controles++;console.log('ok '+nom);};

verifier('lumière commune aux deux joueurs et rétroviseurs sans rebâtir le monde',()=>{
  vm.runInNewContext(lumiere,ctx);vm.runInNewContext(reflet,ctx);
  assert.equal(env.length,1);assert.equal(miroirs.length,1);assert.equal(env[0].night,1);
  assert.strictEqual(env[0],miroirs[0]);
  ctx.S=Object.assign(Object.create(session),{fauneVue:null});
  vm.runInNewContext(lumiere,ctx);vm.runInNewContext(reflet,ctx);
  assert.equal(env.length,1);assert.equal(miroirs.length,1,'la même lumière ne se renormalise pas deux fois');
  ctx.reglages.moment='jour';
  vm.runInNewContext(lumiere,ctx);vm.runInNewContext(reflet,ctx);
  assert.equal(env.length,2);assert.equal(miroirs.length,2);assert.equal(env[1].night,0);
  session.nature.moment='nuit';
  vm.runInNewContext(lumiere,ctx);
  assert.equal(env.at(-1).night,1,'en ligne, le moment transmis par l’hôte prime sur les préférences locales');
  session.nature.moment=null;
});

verifier('faune inactive sans construction ; habitats partagés et pools propres aux vues',()=>{
  ctx.S=session;ctx.P=Grap.melange('low',0);
  vm.runInNewContext(faune,ctx);assert.equal(crees,0);assert.equal(dessins.length,0);
  ctx.P=Grap.melange('high',0,{options:{faune:'ultra'}});
  vm.runInNewContext(faune,ctx);
  const second=Object.assign(Object.create(session),{fauneVue:null});ctx.S=second;
  vm.runInNewContext(faune,ctx);
  assert.equal(crees,1);assert.equal(dessins.length,2);
  assert.strictEqual(dessins[0].etat,dessins[1].etat);
  assert.equal(dessins[0].t,dessins[1].t);assert.equal(dessins[0].vue,0);assert.equal(dessins[1].vue,1);
  assert.notStrictEqual(session.fauneVue,second.fauneVue);
  assert.equal(dessins[1].qualite,'ultra');assert.equal(dessins[1].pluie,.3);
});

verifier('faune et lumière chargées avant la coque et réglages restaurables',()=>{
  const build=readFileSync(new URL('../construire.py',import.meta.url),'utf8');
  assert.ok(build.indexOf("'faune.js'")<build.indexOf("'jeu.js'"));
  assert.ok(build.indexOf("'ambiance.js'")<build.indexOf("'jeu.js'"));
  const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
  for(const mode of A.MODES) assert.ok(html.includes(`name="momentDepart" value="${mode}"`));
  const preparation=html.slice(html.indexOf('<section id="preparation"'),html.indexOf('<section id="reglages"'));
  assert.ok(preparation.includes('id="o-meteo"') && preparation.includes('id="o-moment"') && preparation.includes('id="o-saison"'),'météo, moment et saison ensemble avant départ');
  const reglages=html.slice(html.indexOf('<section id="reglages"'),html.indexOf('<section id="pause"'));
  assert.ok(!reglages.includes('name="moment"') && !reglages.includes('name="momentDepart"') && !reglages.includes('name="saisonDepart"') && !reglages.includes('name="meteo"'),'conditions de course absentes des Réglages');
  for(const q of Grap.OPTIONS.faune)assert.ok(html.includes(`name="faune" value="${q}"`));
  assert.ok(source.includes("'vegetation', 'faune', 'moment', 'saison', 'retro'"),'banc restitue tous les nouveaux réglages');
});
console.log(`${controles} contrôles intégration nature réussis.`);
