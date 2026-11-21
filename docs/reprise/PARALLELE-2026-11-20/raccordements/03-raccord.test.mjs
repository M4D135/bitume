// Contre-tests des raccords proposés : aucune scène WebGL, aucun réseau, aucune manette physique.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
const require = createRequire(import.meta.url);
// Usage : node 03-raccord.test.mjs /chemin/de/la/copie-avec-03-menu.patch
const racine = resolve(process.argv[2] || '.');
require(join(racine, 'src/menu-arcade.js'));
const B = globalThis.BITUME;
const source = readFileSync(join(racine, 'src/jeu.js'), 'utf8');
function extraire(nom) {
  const a = source.indexOf('  function ' + nom + '('), finLigne = source.indexOf('\n', a);
  assert.ok(a >= 0, nom);
  if (source.slice(a, finLigne).trimEnd().endsWith('}')) return source.slice(a, finLigne);
  return source.slice(a, source.indexOf('\n  }', a) + 4);
}
const eventDebut = source.lastIndexOf("  document.addEventListener('change', e => {", source.indexOf("    const correspondance = /^(geste|klaxon)Pilote"));
const eventFin = source.indexOf('\n  });', eventDebut) + 6;
let tests = 0;
function test(nom, f) { f(); tests++; console.log('ok ' + nom); }
const make = new Function('B', `
  const elements = new Map(), buttons = [{disabled:false}, {disabled:false}, {disabled:false}, {disabled:false}], ecouteurs = new Map();
  const $ = id => { if (!elements.has(id)) elements.set(id,{hidden:false,value:'',textContent:''}); return elements.get(id); };
  const document = { querySelectorAll: () => buttons, addEventListener: (n,f) => ecouteurs.set(n,f) };
  let modePrepa='course',ecran='preparation',son=null,retire=0,sauve=0;
  const EL={R:null},reglages={circuit:0,tours:3,difficulte:1,trollPilotes:[{geste:'salut',klaxon:'ancien'},{geste:'poing',klaxon:'mariage'}]};
  const CATALOGUE=[{nom:'Val-Brûlé'}], NOMS_SAISON={ete:'été'}, NOMS_MOMENT={jour:'jour'},NOMS_PNEUS={slicks:'Slicks',pluie:'Pluie'};
  const texte=(el,t)=>el.textContent=t, conditionsDuDepart=()=>({saison:'ete',moment:'jour'}),nomMeteoCourse=()=> 'soleil';
  const choixPneusLocaux=()=>['slicks','pluie'], retirerPret=()=>retire++,sauverReglages=()=>sauve++;
  ${['pilotesMenu','choixTrollLocaux','majChoixTroll','majBilanArcade'].map(extraire).join('\n')}
  ${source.slice(eventDebut,eventFin)}
  return {EL,reglages,$,buttons,majChoixTroll,majBilanArcade,pilotesMenu,
    changer:(name,value)=>ecouteurs.get('change')({target:{name,value}}),
    mode:v=>modePrepa=v, ecran:v=>ecran=v,son:v=>son=v,compte:()=>({retire,sauve})};
`);
test('choix Troll : J1/J2 indépendants, préparation et prets synchronisés, persistance et retrait prêt',()=>{
  const a=make(B);a.mode('duo');a.majChoixTroll();
  assert.equal(a.$('o-troll-1').hidden,false);
  assert.equal(a.$('p-geste-0').value,'salut');assert.equal(a.$('pr-geste-1').value,'poing');
  a.changer('gestePilote1','majeur');a.changer('klaxonPilote0','classique');
  assert.deepEqual(a.reglages.trollPilotes,[{geste:'salut',klaxon:'classique'},{geste:'majeur',klaxon:'mariage'}]);
  assert.equal(a.$('p-geste-1').value,a.$('pr-geste-1').value);
  assert.deepEqual(a.compte(),{retire:2,sauve:2});
});
test('retour solo puis duo conserve le deuxième pilote, inconnus normalisés sans autre joueur altéré',()=>{
  const a=make(B);a.mode('course');a.majChoixTroll();assert.equal(a.$('o-troll-1').hidden,true);
  a.mode('duo');a.majChoixTroll();assert.equal(a.$('p-klaxon-1').value,'mariage');
  a.changer('gestePilote0','inconnu');assert.equal(a.reglages.trollPilotes[0].geste,'majeur');assert.equal(a.reglages.trollPilotes[1].geste,'poing');
  a.changer('gestePilote2','salut');assert.equal(a.compte().sauve,1);
});
test('préts en ligne identifie les deux pilotes locaux par membre et conserve les choix',()=>{
  const a=make(B);a.EL.R={id:7,membres:[{id:0,joueurs:1},{id:7,joueurs:2}]};a.mode('enligne');a.ecran('prets');a.majChoixTroll();
  assert.equal(a.pilotesMenu(),2);assert.equal(a.$('pr-troll-1').hidden,false);
  a.changer('klaxonPilote1','ancien');assert.equal(a.$('p-klaxon-1').value,'ancien');assert.deepEqual(a.compte(),{retire:1,sauve:1});
});
test('aperçu audio absent explicitement désactivé, disponible avec API klaxon',()=>{
  const a=make(B);a.majChoixTroll();assert.ok(a.buttons.every(b=>b.disabled));assert.match(a.$('p-troll-etat').textContent,/indisponible/);
  a.son({klaxon(){}});a.majChoixTroll();assert.ok(a.buttons.every(b=>!b.disabled));assert.equal(a.$('pr-troll-etat').textContent,'');
});
test('bilan : mode chrono et confirmation en ligne, pneus et Troll individuels',()=>{
  const a=make(B);a.mode('chrono');a.majBilanArcade();assert.match(a.$('p-bilan-course').textContent,/Contre-la-montre/);assert.match(a.$('b-depart').textContent,/chrono/);
  a.mode('duo');a.majBilanArcade();assert.match(a.$('p-bilan-troll').textContent,/J1\s: Slicks/);assert.match(a.$('p-bilan-troll').textContent,/J2\s: Pluie/);
  a.mode('enligne');a.majBilanArcade();assert.equal(a.$('b-depart').textContent,'Confirmer la course');
});
const image = new Function('ecranInitial','temps','cache',`
  let ecran=ecranInitial, dernierGeste=0, tPrec=77, detectionGraphiqueActive=false, captureManette=null;
  const elements=new Map(), $=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:''});return elements.get(id);};
  const appels={raf:0,entrees:0,autres:0,oubli:0,apercus:[],demo:0};
  const document={hidden:cache},performance={now:()=>temps},ATTENTE_DEMO=5;
  const reglages={demo:'oui',circuit:0,qualite:'auto'},rendu={},session={},nbManettes=0,manettes=[],pad2={start:false};
  const prepa={voile:false,enCours:false,attente:false},souris={active:false},jeu={dataset:{}},gpuModeste=false,modePrepa='course';
  const consoleXbox=false,dernierSignalManette=-Infinity,majEtatManettes=()=>{},entreeDe=()=> 'clavier';
  const requestAnimationFrame=()=>appels.raf++,lireManette=()=>appels.entrees++,lireAutresManettesMenu=()=>appels.autres++;
  const appliquerMessages=()=>{},enCourse=()=>false,texte=(el,t)=>el.textContent=t,style=()=>{},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lancerDemo=()=>{appels.demo++; ecran='demo'; prepa.enCours=true;};
  const B={cadence:{oublier(){appels.oubli++;},image(){throw Error('cadence lourde interdite en menu');}}},cadence={};
  const menuArcade={image:(...args)=>appels.apercus.push(args)},menuOpaque=()=>['titre','preparation','reglages','enligne','prets'].includes(ecran);
  ${extraire('majAttente')}
  ${extraire('image')}
  image(temps);
  return {appels,tPrec,dernierGeste};
`);
for(const e of ['titre','preparation','reglages','enligne','prets'])test('menu opaque '+e+' : entrées vivantes, aucun rendu ni simulation',()=>{
  const {appels,tPrec}=image(e,2000,false);assert.equal(appels.raf,1);assert.equal(appels.entrees,1);assert.equal(appels.autres,1);assert.equal(appels.oubli,1);assert.equal(tPrec,0);assert.equal(appels.apercus[0][1],e==='preparation');
});
test('titre : départ auto démo conservé à 5 s même sans rendu de vitrine',()=>{const {appels}=image('titre',5100,false);assert.equal(appels.demo,1);assert.equal(appels.apercus[0][1],false);});
test('titre caché : compte à rebours suspendu, pas de lancement démo',()=>{const {appels,dernierGeste}=image('titre',9000,true);assert.equal(appels.demo,0);assert.equal(dernierGeste,9000);});
const autres = new Function(`
  let ecran='preparation',captureManette=null; const document={hidden:false},performance={now:()=>50}; let dernierGeste=0;
  const pad={manette:null},pad2={manette:null,start:false},manettes=[],suivisManettesMenu=new Map(),appels=[];
  const naviguerManette=(front,p)=>appels.push({index:p.index,boutons:[0,1,9].filter(front)});
  ${extraire('lireAutresManettesMenu')}
  return {pad,pad2,manettes,appels,lire:lireAutresManettesMenu,ecran:s=>ecran=s};
`);
const padTest=(index,b=[])=>({index,id:'p'+index,axes:[0,0],buttons:Array.from({length:16},(_,i)=>({pressed:b.includes(i),value:b.includes(i)?1:0}))});
test('autres manettes : boutons tenus connexion consommés, J1/J2 exclus et nouveau front routé une fois',()=>{
  const a=autres(),p0=padTest(0),p1=padTest(1,[0]);a.pad.manette=p0;a.manettes.push(p0,p1);a.lire();
  assert.deepEqual(a.appels,[{index:1,boutons:[]}]);p1.buttons[0]={pressed:false,value:0};a.lire();p1.buttons[0]={pressed:true,value:1};a.lire();
  assert.deepEqual(a.appels.at(-1),{index:1,boutons:[0]});a.pad2.manette=p1;a.lire();assert.equal(a.appels.length,3);
});
test('changement écran par J1 : fronts J2 consommés sans acte différé, Start tenu connexion ne démarre pas',()=>{
  const a=autres(),p0=padTest(0),p1=padTest(1);a.pad.manette=p0;a.manettes.push(p0,p1);a.lire();
  p1.buttons[9]={pressed:true,value:1};a.lire(true);a.lire();assert.deepEqual(a.appels.at(-1).boutons,[]);
  const b=autres(),q0=padTest(0),q1=padTest(1,[9]);b.ecran('titre');b.pad.manette=q0;b.manettes.push(q0,q1);b.lire();assert.equal(b.pad2.start,true);
});
console.log(JSON.stringify({tests,passes:tests,physicalController:false,webgl:false},null,2));
