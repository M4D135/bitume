// Fonctions d'entrée réelles et vraie conduite, sans navigateur ni benchmark physique.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const root=process.argv[3]||resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(process.argv[2]||join(root,'src/jeu.js'),'utf8');
const {B,CD,DT,circuit,commande}=await import(pathToFileURL(join(root,'verifications/phase2/outils.mjs')).href);
await import(pathToFileURL(join(root,'src/commandes-manette.js')).href);
function extract(name){const a=source.indexOf(`  function ${name}(`);assert(a>=0,name);let b=source.indexOf('{',a),n=1;for(b++;n&&b<source.length;b++){if(source[b]==='{')n++;else if(source[b]==='}')n--;}assert.equal(n,0);return source.slice(a,b);}
const declarations=source.slice(source.indexOf('  const touches ='),source.indexOf('  // conduite par position physique'));
const factory=new Function('navigator','B','session',`const reglages={boite:'auto',aide:.35};let ecran='course',dernierGeste=0;const compteurVisites=null;const actions=[];const enCourse=()=>ecran==='course';const activerSon=()=>{};const sortirDemo=()=>{ecran='titre'};const changerVue=()=>actions.push('vue');const basculerPause=()=>{actions.push('pause');ecran=ecran==='course'?'pause':'course'};const naviguerManette=()=>{};${declarations}\n${extract('lireManette')}\n${extract('commandesJoueur')}\nreturn {poll:lireManette,command:commandesJoueur,touches,doigt,pad,actions,setScreen:v=>ecran=v,setSession:v=>session=v};`);
const gamepad=(index,pressed={},axis=0,id='manette-'+index)=>({index,id,connected:true,axes:[axis],buttons:Array.from({length:16},(_,i)=>({value:pressed[i]||0,pressed:!!pressed[i]}))});
const fresh=()=>{const navigator={pads:[],getGamepads(){return this.pads}},etat=CD.creer(100,0),session={type:'course',course:{joueur:{etat}}};return {navigator,etat,session,api:factory(navigator,B,session)}};
const neutral=cmd=>assert.deepEqual([cmd.gaz,cmd.frein,cmd.volant,cmd.derive],[0,0,0,false]);
let passed=0,failures=[];function test(name,fn){try{fn();passed++;console.log('ok '+name)}catch(e){failures.push({name,error:e.message});console.error('KO '+name+': '+e.message)}}
test('déconnexion neutralise pédales, volant et dérive',()=>{const {api,navigator}=fresh();navigator.pads=[gamepad(0,{0:1,6:.75,7:1},.8)];api.poll();const before=api.command();assert.equal(before.gaz,1);assert.equal(before.derive,true);navigator.pads=[];api.poll();neutral(api.command());assert.equal(api.pad.manette,null)});
test('clavier et tactile restent utilisables sans manette',()=>{const {api,navigator}=fresh();navigator.pads=[gamepad(0,{0:1,6:1,7:1},.8)];api.poll();api.command();navigator.pads=[];api.touches.add('ArrowUp');api.touches.add('ArrowLeft');api.poll();const c=api.command();assert.deepEqual([c.gaz,c.frein,c.volant,c.derive],[1,0,-1,false]);api.touches.clear();api.doigt.frein=true;const t=api.command();assert.deepEqual([t.gaz,t.frein,t.volant,t.derive],[0,1,0,false])});
test('trous, manette déconnectée et indice sélectionné',()=>{const {api,navigator}=fresh(),off=gamepad(0,{7:1});off.connected=false;navigator.pads=[off,null,gamepad(2,{6:.4},-.5)];api.poll();assert.equal(api.pad.manette.index,2);assert.equal(api.command().frein,.4);navigator.pads=[off,null,null];api.poll();neutral(api.command())});
test('première manette connectée prioritaire et changement d’indice sans pause fantôme',()=>{const {api,navigator}=fresh(),a=gamepad(0),b=gamepad(2,{9:1});navigator.pads=[a,b];api.poll();assert.equal(api.pad.manette.index,0);a.connected=false;api.poll();assert.equal(api.pad.manette.index,2);assert.deepEqual(api.actions,[])});
test('bouton tenu à reconnexion : aucune pause fantôme, nouvel appui unique',()=>{const {api,navigator}=fresh(),p=gamepad(0);navigator.pads=[p];api.poll();p.buttons[9]={value:1,pressed:true};api.poll();assert.deepEqual(api.actions,['pause']);navigator.pads=[];api.poll();navigator.pads=[p];api.poll();assert.deepEqual(api.actions,['pause']);p.buttons[9]={value:0,pressed:false};api.poll();p.buttons[9]={value:1,pressed:true};api.poll();api.poll();assert.deepEqual(api.actions,['pause','pause'])});
test('autre contrôleur au même indice initialise ses boutons',()=>{const {api,navigator}=fresh();navigator.pads=[gamepad(0)];api.poll();navigator.pads=[gamepad(0,{9:1},0,'autre')];api.poll();assert.deepEqual(api.actions,[])});
const c=circuit({R:80,largeur:40,limite:30});
function charge(e){e.v=30;e.rapport=3;e.beta=.1;e.volant=-.5;Object.assign(e.derive,{actif:true,sens:1,duree:3,charge:2,niveau:3,palier:3,grace:1,qualite:1,contre:.5,fenetre:0})}
function held(){const f=fresh();f.navigator.pads=[gamepad(0,{0:1})];f.api.poll();f.api.command();charge(f.etat);return f;}
test('oracle : relâcher une dérive chargée déclenche réellement turboIII',()=>{const e=CD.creer(100,0);charge(e);const ev=CD.pas(e,commande({derive:false}),c,DT);assert(ev.some(e=>e.type==='turbo'&&e.niveau===3))});
test('perte de manette annule sa dérive sans turbo fantôme',()=>{const {api,navigator,etat}=held();navigator.pads=[];api.poll();const ev=CD.pas(etat,api.command(),c,DT);assert(!ev.some(e=>e.type==='turbo'),'turbo fantôme: '+JSON.stringify(ev));assert.equal(etat.turbo.reste,0);assert.equal(etat.derive.actif,false)});
for(const key of ['Space','ShiftLeft','ShiftRight'])test('dérive clavier maintenue : '+key,()=>{const {api,navigator,etat}=held();api.touches.add(key);navigator.pads=[];api.poll();assert.equal(etat.derive.actif,true);assert.equal(api.command().derive,true)});
test('dérive tactile maintenue',()=>{const {api,navigator,etat}=held();api.doigt.derive=true;navigator.pads=[];api.poll();assert.equal(etat.derive.actif,true);assert.equal(api.command().derive,true)});
test('perte en pause annule seulement la dérive issue du pad',()=>{const {api,navigator,etat}=held();api.setScreen('pause');navigator.pads=[];api.poll();assert.equal(etat.derive.actif,false);assert.deepEqual(api.actions,[])});
test('rejouer : ancien pad ne peut annuler la dérive de la nouvelle séance',()=>{const {api,navigator,etat}=held(),next=CD.creer(100,0);charge(next);api.setScreen('titre');api.setSession({type:'course',course:{joueur:{etat:next}}});navigator.pads=[];api.poll();assert.equal(next.derive.actif,true);assert.equal(etat.derive.actif,true)});
test('charge non commandée par le pad et turbo déjà lancé préservés',()=>{const {api,navigator,etat}=fresh();navigator.pads=[gamepad(0)];api.poll();api.command();charge(etat);navigator.pads=[];api.poll();assert.equal(etat.derive.actif,true);const f=held();f.etat.derive.actif=false;f.etat.turbo.reste=1.2;f.navigator.pads=[];f.api.poll();assert.equal(f.etat.turbo.reste,1.2)});

test('API getGamepads refusée neutralise les commandes sans interrompre la boucle',()=>{const {api,navigator}=fresh();navigator.pads=[gamepad(0,{0:1,6:.75,7:1},.8)];api.poll();api.command();navigator.getGamepads=()=>{throw new DOMException('Gamepad forbidden','SecurityError')};assert.doesNotThrow(()=>api.poll());neutral(api.command());assert.equal(api.pad.manette,null)});
test('API refusée annule la dérive chargée sans turbo fantôme',()=>{const {api,navigator,etat}=held();navigator.getGamepads=()=>{throw new DOMException('Gamepad forbidden','SecurityError')};assert.doesNotThrow(()=>api.poll());const ev=CD.pas(etat,api.command(),c,DT);assert(!ev.some(e=>e.type==='turbo'));assert.equal(etat.derive.actif,false)});
// Vibration : seulement sur l'écran de course et quand un joueur conduit (David, 18/11 : aucune vibration dans les menus).
const vibre=(ecran,auto,vibrations='oui')=>new Function('reglages','ecran',extract('manetteVibre')+';return manetteVibre('+auto+');')({vibrations},ecran);
test('vibration : un joueur en course la reçoit',()=>assert.equal(vibre('course',false),true));
for(const ecran of ['titre','preparation','reglages','pause','resultats','demo','enligne','prets'])test('vibration : aucune sur l’écran '+ecran,()=>assert.equal(vibre(ecran,false),false));
test('vibration : aucune quand l’ordinateur conduit (vitrine des menus, démo, outils)',()=>assert.equal(vibre('course',true),false));
test('vibration : aucune si le réglage est à non',()=>assert.equal(vibre('course',false,'non'),false));
test('vibration : la vitrine et la démo passent par le garde-fou',()=>{assert.match(extract('pasSimulation'),/const vibre = manetteVibre\(auto\);/);assert.match(extract('aller'),/if \(nom !== 'course'\) \{ secouerManette\(0, 0\); secouerManette\(0, 0, pad2\); \}/)});
// Vibrations par image : le vrai bloc de jeu.js et le vrai module src/vibrations.js, une manette simulée. Le pas
// retient les événements derrière le garde-fou ; l'image rendue calcule une fois et reprogramme au plus ~30 fois/s.
test('vibration : les pas retiennent derrière le garde-fou, chaque image rendue calcule',()=>{
  assert.match(extract('pasSimulation'),/const vibre = manetteVibre\(auto\);\n    vibreImage = vibre;\n    if \(vibre\) \{\n      retenirVibrations\(vibrations\[0\], ev, co\.joueur\.id\);/);
  assert.match(extract('image'),/if \(tourne\) majVibrations\(S, dtReel, t\);/);
  assert.equal(source.includes('vibrationManette('),false,'ancien calcul par pas retiré');
});
createRequire(import.meta.url)(join(root,'src/vibrations.js'));
const blocVibrations=source.slice(source.indexOf('  // Vibrations de manette (David, 14/11'),source.indexOf('  // Météo et pluie projetée'));
const fabriqueVibrations=new Function('B','clamp','pad','pad2','reglages','performance',blocVibrations+'\nreturn { vibrations, secouerManette, retenirVibrations, calmerVibrations, majVibrations, set vibreImage(v) { vibreImage = v; } };');
const actionneur=(effets=['dual-rumble'])=>{const appels=[];return {appels,vibrationActuator:{effects:effets,playEffect(type,o){appels.push({type,...o});return Promise.resolve('complete');}}};};
function seanceVibrante({duo=false,effets}={}){
  const pad={manette:actionneur(effets)},pad2={manette:duo?actionneur(effets):null},maintenant={t:0};
  const etats=[CD.creer(100,0),CD.creer(120,0)];for(const e of etats)Object.assign(e,{v:40,regime:9000,gaz:1});
  const voitures=etats.map((etat,id)=>({id,etat}));
  const S={type:duo?'duo':'course',locaux:duo?[0,1]:[0],course:{joueur:voitures[0],voitures}};
  const api=fabriqueVibrations(B,(x,a,b)=>Math.max(a,Math.min(b,x)),pad,pad2,{vibrationForce:.5},{now:()=>maintenant.t});
  api.vibreImage=true;
  return {api,pad,pad2,S,etats,maintenant};
}
// n images à hz images par seconde ; ev(i) : événements retenus avant l'image i
function rouler(f,hz,secondes,ev){const dt=1/hz;for(let i=0;i<Math.round(secondes*hz);i++){if(ev)for(const [n,e,id] of ev(i)||[])f.api.retenirVibrations(f.api.vibrations[n],e,id);f.maintenant.t=i*1000/hz;f.api.majVibrations(f.S,dt,f.maintenant.t);}}
for(const hz of [30,60,120,144])test('vibration : '+hz+' images par seconde, au plus une commande toutes les 31 ms',()=>{
  const f=seanceVibrante();rouler(f,hz,2);const a=f.pad.manette.appels;
  assert.ok(a.length>=50&&a.length<=61,a.length+' commandes en 2 s');
  for(let i=1;i<a.length;i++)assert.ok(a[i].type==='dual-rumble'&&a[i].duration===100);
  assert.ok(a.some(x=>x.strongMagnitude>0),'le moteur gronde');
});
test('vibration : gâchettes quand la manette annonce trigger-rumble, deux moteurs sinon',()=>{
  const f=seanceVibrante({effets:['dual-rumble','trigger-rumble']});Object.assign(f.etats[0],{blocage:1,frein:1,gaz:0});rouler(f,60,1);
  const a=f.pad.manette.appels;assert.ok(a.length&&a.every(x=>x.type==='trigger-rumble'));
  assert.ok(a.some(x=>x.leftTrigger>0),'blocage au frein : la gâchette gauche pulse');
  const g=seanceVibrante();Object.assign(g.etats[0],{blocage:1,frein:1,gaz:0});rouler(g,60,1);
  assert.ok(g.pad.manette.appels.every(x=>x.type==='dual-rumble'&&!('leftTrigger' in x)));
});
test('vibration : hors garde-fou, un seul arrêt puis plus rien',()=>{
  const f=seanceVibrante();rouler(f,60,.5);const avant=f.pad.manette.appels.length;f.api.vibreImage=false;rouler(f,60,.5);
  const apres=f.pad.manette.appels.slice(avant);
  assert.equal(apres.length,1);assert.deepEqual([apres[0].weakMagnitude,apres[0].strongMagnitude],[0,0]);
});
test('vibration : événements de sa voiture seulement, réception devenue atterrissage, tableau borné',()=>{
  const f=seanceVibrante(),J=f.api.vibrations[0];
  f.api.retenirVibrations(J,[{type:'choc',id:0,force:20},{type:'choc',id:1,force:20},{type:'contact',a:3,b:0,force:9},{type:'contact',a:1,b:2,force:9},
    {type:'rapport',id:0},{type:'reception',id:0,corr:.9},{type:'tour',id:0},{type:'retour',id:0,repositionnement:true}],0);
  assert.deepEqual(J.evenements.map(e=>e.type),['choc','contact','rapport','atterrissage']);
  for(let k=0;k<40;k++)f.api.retenirVibrations(J,[{type:'choc',id:0,force:5},{type:'choc',id:0,force:6}],0);
  assert.equal(J.evenements.length,64);
  f.api.majVibrations(f.S,1/60,0);assert.equal(J.evenements.length,0,'vidé à chaque image');
});
test('vibration : à deux, chaque joueur a sa manette, son état et ses chocs',()=>{
  const f=seanceVibrante({duo:true});
  rouler(f,60,1,i=>i===30?[[0,[{type:'choc',id:1,force:30}],0],[1,[{type:'choc',id:1,force:30}],1]]:null);
  const pic=a=>Math.max(...a.map(x=>x.strongMagnitude));
  assert.ok(f.pad.manette.appels.length>20&&f.pad2.manette.appels.length>20,'deux manettes vivantes');
  assert.ok(pic(f.pad2.manette.appels)>pic(f.pad.manette.appels)+.2,'le choc de la voiture 2 n’est senti que par le joueur 2');
  assert.notStrictEqual(f.api.vibrations[0].V,f.api.vibrations[1].V);
});
test('vibration : la voiture replacée repart sans le pic d’un choc antérieur',()=>{
  const f=seanceVibrante();rouler(f,60,1/60,i=>i===0?[[0,[{type:'choc',id:0,force:30}],0]]:null);
  const V=f.api.vibrations[0].V;assert.ok(V.envFort>.5);f.api.calmerVibrations(0);
  assert.notStrictEqual(f.api.vibrations[0].V,V);assert.equal(f.api.vibrations[0].V.envFort,0);
});
console.log(`${passed}/${passed+failures.length} contrôles manette tenus`);if(failures.length)process.exitCode=1;
