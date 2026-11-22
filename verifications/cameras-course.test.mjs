// Caméras de production, vraies cotes de la 126 CK et réglages persistés.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
const require = createRequire(import.meta.url);
for (const f of ['graphismes','pneus','ambiance','saisons','chaussee','meteo','conditions-course','cadence','menu-arcade',
  'carene','main','ferro/vehicle-dynamics','usure-pneus','conduite','voiture']) require('../src/' + f + '.js');
const B = globalThis.BITUME, source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
function bloc(a,b) { const i=source.indexOf(a), j=source.indexOf(b,i); assert(i>=0 && j>i); return source.slice(i,j); }
function extraire(nom) {
  const i=source.indexOf('  function '+nom+'('); assert(i>=0,nom); let j=source.indexOf('{',i), n=1;
  for(j++;n;j++){if(source[j]==='{')n++;else if(source[j]==='}')n--;assert(j<source.length);}
  return source.slice(i,j);
}
const ligne = nom => {const m=source.match(new RegExp('^  const '+nom+' = [^\\n]+;', 'm'));assert(m,nom);return m[0];};
const vues = ['aileron-avant','nez','cockpit','arceau','poursuite-proche','poursuite'];
const prefs = new Function('B','prefs',`
  let session=null,ecran='titre';const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),matchMedia=()=>({matches:false}),setTimeout=()=>0;
  const stock={'bitume.reglages':JSON.stringify(prefs)},localStorage={getItem:k=>stock[k]||null,setItem:(k,v)=>{stock[k]=v}};
  ${bloc('  function initialiserChoixPneus(', '  function choixPneusLocaux(')}
  ${bloc('  function lireStock(', '  // records et fantômes')}
  return {reglages,sauver:sauverReglages,stock};
`);
const fabriquer = new Function('B','reglages','session',`
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a)),PORTEE_VUE=6000;
  const estTactile=false,canvas={clientWidth:1280,clientHeight:720},scene={decor:{sol:()=>0}};
  const retro={echec:false},cameraEssai=null,profilDe=()=>({effets:{retroImages:true}});let sauvegardes=0;
  const sauverReglages=()=>{sauvegardes++};
  ${['VUES_COURSE','INCLINAISON_COCKPIT','CAMERAS_DEMO'].map(ligne).join('\n')}
  ${bloc('  const ANCRAGES_CAMERAS =', '  function cameraEmbarquee(')}
  ${['champCockpit','cameraCockpit','champAdapte','cameraEmbarquee','cameraPoursuite','cameraDemo','retroVoulu',
    'reglerVue','changerVue','changerVue2'].map(extraire).join('\n')}
  return {cockpit:cameraCockpit,embarquee:cameraEmbarquee,poursuite:cameraPoursuite,demo:cameraDemo,retro:retroVoulu,
    cycle:changerVue,cycle2:changerVue2,choisir:reglerVue,canvas,ancrages:ANCRAGES_CAMERAS,
    get sauvegardes(){return sauvegardes;},get vuesDemo(){return [...CAMERAS_DEMO];}};
`);
function jeu(options={}) {
  const reglages={vue:'cockpit',vue2:'poursuite',champ:70,secousses:0,retro:'oui',...options};
  const S={type:'course',camCap:null}; S.vueJ2=Object.assign(Object.create(S),{camCap:null});
  return {reglages,S,api:fabriquer(B,reglages,S)};
}
const pose={x:0,y:0,z:0,cap:0,tangage:0,roulis:0};
const etat={v:0,alat:0,along:0,volant:0,surface:'route'};

test('les choix anciens et les six nouveaux choix survivent au stockage sans migration du champ',()=>{
  for(const vue of vues)for(const vue2 of vues){const p=prefs(B,{vue,vue2,champ:83,champRevu:true});
    assert.equal(p.reglages.vue,vue);assert.equal(p.reglages.vue2,vue2);assert.equal(p.reglages.champ,83);
    p.sauver();const stock=JSON.parse(p.stock['bitume.reglages']);assert.equal(stock.vue,vue);assert.equal(stock.vue2,vue2);}
  assert.equal(prefs(B,{}).reglages.vue,'cockpit');assert.equal(prefs(B,{}).reglages.vue2,'poursuite');
  const invalide=prefs(B,{vue:'inconnue',vue2:'ancienne-faute'}).reglages;
  assert.equal(invalide.vue,'cockpit');assert.equal(invalide.vue2,'poursuite');
});
test('un cycle complet et un choix direct changent seulement le joueur concerné',()=>{
  const {api,reglages,S}=jeu();S.camCap=.7;S.vueJ2.camCap=1.1;
  const idx0 = vues.indexOf('cockpit');
  for(const vue of vues.slice(idx0+1).concat(vues.slice(0,idx0+1))){api.cycle();assert.equal(reglages.vue,vue);assert.equal(reglages.vue2,'poursuite');assert.equal(S.vueJ2.camCap,1.1);}
  api.cycle2();assert.equal(reglages.vue2,'aileron-avant');assert.equal(reglages.vue,'cockpit');
  assert(api.choisir(1,'nez'));assert.equal(reglages.vue2,'nez');assert.equal(api.sauvegardes,8);
  assert(!api.choisir(0,'tele'));assert.equal(reglages.vue,'cockpit');assert.equal(api.sauvegardes,8);
});
test('les six choix sont accessibles pour chacun dans préparation, prêts et réglages',()=>{
  for(const nom of ['vue','vue2','vuePret','vuePret2']){
    const ids=[...html.matchAll(new RegExp('name="'+nom+'" value="([^"]+)"','g'))].map(m=>m[1]);assert.deepEqual(ids,vues,nom);
  }
  for(const nom of ['vueDepart','vueDepart2']){
    const select=html.match(new RegExp('<select[^>]+name="'+nom+'"[^>]*>([\\s\\S]*?)</select>'));assert(select,nom);
    assert.deepEqual([...select[1].matchAll(/value="([^"]+)"/g)].map(m=>m[1]),vues);
  }
});
test('supports embarqués hors de la coque, portés par la vraie attitude avec modèle inchangé',()=>{
  const {api,S}=jeu(), geometrie=JSON.stringify([B.voiture.OEIL,B.voiture.POSTE_126CK,B.voiture.ARRIERE_126CK,B.voiture.FORMES]);
  const p={x:23,y:8,z:-17,cap:.71,tangage:.18,roulis:-.24},M=B.voiture.attitude(p.cap,p.tangage,p.roulis);
  assert(api.ancrages.arceau.p[0]<B.voiture.ARRIERE_126CK.arceauX);assert(api.ancrages.arceau.p[1]>1.05);
  assert(api.ancrages.nez.p[0]>B.voiture.ROUES[0].x+B.voiture.ROUES[0].r);
  assert(api.ancrages['aileron-avant'].p[0]>B.voiture.ROUES[0].x+B.voiture.ROUES[0].r);
  assert(api.ancrages['aileron-avant'].p[2]>.46, 'support hors du nez');
  for(const vue of ['arceau','nez','aileron-avant']){
    const cam=api.embarquee(p,{...etat,v:75},vue),q=B.voiture.mul(M,api.ancrages[vue].p);
    assert.deepEqual(cam.pos,[p.x+q[0],p.y+q[1],p.z+q[2]]);assert.equal(cam.roll,-p.roulis);
    assert(cam.pos.concat(cam.yaw,cam.pitch,cam.fov).every(Number.isFinite));
  }
  const cam=api.cockpit(S,pose,etat,0,1/60);assert.deepEqual(cam.pos,B.voiture.OEIL);assert(Math.abs(cam.fov-70)<1e-10);
  assert.equal(JSON.stringify([B.voiture.OEIL,B.voiture.POSTE_126CK,B.voiture.ARRIERE_126CK,B.voiture.FORMES]),geometrie);
});
test('les deux poursuites restent distinctes, l’ancien cadre et le format partagé sont conservés',()=>{
  const {api,S}=jeu();const loin=api.poursuite(S,pose,etat,0),pres=api.poursuite(S,pose,etat,0,'poursuite-proche');
  assert.deepEqual(loin.pos,[-7.4,2.45,0]);assert.deepEqual(pres.pos,[-4.65,1.65,0]);assert.equal(loin.fov,64);
  S.type='duo';api.canvas.clientWidth=640;api.canvas.clientHeight=720;
  const a=api.poursuite(S,pose,etat,0),b=api.poursuite(S.vueJ2,pose,etat,0,'poursuite-proche');
  assert(a.fov>loin.fov && b.fov>pres.fov);assert.equal(S.camCap,0);assert.equal(S.vueJ2.camCap,0);
});
test('glaces réelles seulement dans le cockpit et la T-cam avant ; plans démo préservés',()=>{
  const {api,S}=jeu();for(const vue of vues)assert.equal(api.retro(S,vue),vue==='cockpit'||vue==='arceau');
  S.regardArriere=true;for(const vue of vues)assert(!api.retro(S,vue));
  assert.deepEqual(api.vuesDemo,['roue','aileron','arriere','travelling','orbite']);
  const cam=api.demo({tRendu:0},pose,{vue:'aileron',debut:0});assert.deepEqual(cam.pos,[-.66,1.17,0]);
});
