// Les gardes de cette campagne doivent refuser une image portant un faux état d'abri,
// un repli optique silencieux ou une mauvaise étape, même si un PNG a été produit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { SCENARIOS_COUVERTS, optionsCouverts, optionsScenarioCouvert, installerEtatCouverts, verifierCouvert } from '../tools/captures-couverts.mjs';

const cas = id => SCENARIOS_COUVERTS.find(s => s.id === id);
function rapport(s) {
  const phases = ['entree-exterieure','entree-interieure','centre','sortie-interieure','sortie-exterieure'];
  return {
    build: { sha256:'a'.repeat(64) }, source:{ commit:'b'.repeat(40) },
    environnement:{ webgl2:true, physx:{ ready:true } },
    initialisation:{ posePrescrite:true, circuitId:s.circuitId }, erreurs:[], avertissements:[],
    images:Array.from({length:s.images||2},(_,i)=>{
      const sousToit=!s.portails||i>0&&i<4, abri=!s.dessus&&sousToit, interieur=abri&&s.type==='tunnel';
      const eau=s.portails?[.65,.25,.1,.04,.55][i]:0;
      const optique={ backend:'webgl2',pret:true,erreur:null,erreurs:0,perdu:false,eau,embruns:0,gouttes:0,
        etapes:s.dessus?0:90+i*90,dessins:30,copiesScene:30,pixelsSource:518400 };
      const j1={ camera:[0,s.dessus?12:1.2,0],abri,interieur,abriVisiere:abri,visiereActive:!s.dessus,
        lumiere:interieur?1.31:1,lampes:interieur?4:0,type:abri?s.type:null,pluie:1 };
      const zones={scene:{}};
      if(!s.dessus)Object.assign(zones,{'glace-g':{},'glace-d':{}});
      if(s.duo)Object.assign(zones,{scene2:{},'glace-g2':{},'glace-d2':{}});
      return {etat:{zones},vues:{scene:{noir:.1,luminance:.2},scene2:{noir:.1,luminance:.2}},observation:{
        etapeId:s.portails?phases[i]:s.dessus?'dessus-toit':'interieur',glErreur:0,glPerdu:false,
        pluie:1,j1,j2:s.duo?{...j1,type:'galerie',interieur:false,lumiere:1}:null,
        sol:{hit:true,y:0,surface:'piste'},toit:{hit:sousToit,y:sousToit?6.4:null,genre:sousToit?'voute-'+s.type:null},yRoute:0,
        vitres:{j1:optique,j2:s.duo?structuredClone(optique):null},
        vitresGL:{j1:{present:true,erreur:0,perdu:false},j2:{present:true,erreur:0,perdu:false}},
        visieresVisibles:{j1:!s.dessus&&eau>0,j2:false}
      }};
    })
  };
}

test('six scènes distinctes et vingt-quatre images, tous les portails vus dedans et dehors',()=>{
  const base=['--url','file:///tmp/bitume.html','--sortie','/tmp/couverts'];
  const o=optionsCouverts(base);
  assert.equal(o.cas.length,6);
  assert.equal(SCENARIOS_COUVERTS.reduce((n,s)=>n+(s.images||2),0),24);
  assert.deepEqual(SCENARIOS_COUVERTS.filter(s=>s.portails).map(s=>s.id),
    ['haut-col-portails','cimes-rocher','cimes-echelles','cimes-galerie']);
  for(const s of SCENARIOS_COUVERTS) {
    const p=optionsScenarioCouvert(s,o);
    assert.equal(p.images,s.images||2);assert.equal(p.referenceJeu.circuit,s.circuit);
    assert.equal(p.referenceJeu.mode,s.duo?'duo':'solo');
    assert.equal(p.referenceJeu.vue,s.dessus?'helico':'cockpit');
    assert.equal(p.referenceJeu.meteo,'pluie');
  }
  for(const suite of [ ['--cas','cimes-rocher,cimes-rocher'], ['--cas','ailleurs'], ['--cas',''], ['--angle','faux'],
    ['--taille','9000,1'], ['--chrome'], ['--url','file:///deux.html'] ])assert.throws(()=>optionsCouverts([...base,...suite]));
  assert.throws(()=>optionsCouverts(['--url','https://example.com/bitume.html','--sortie','/tmp/couverts']));
});

test('les rapports complets des six scènes passent sans confondre galerie et tunnel',()=>{
  for(const s of SCENARIOS_COUVERTS)assert.deepEqual(verifierCouvert(rapport(s),s),[],s.id);
});

test('un autre build, une scène inconnue ou un moteur absent ne peut être qualifié',()=>{
  const s=cas('haut-col-portails');
  for(const changer of [ r=>{r.build=null;}, r=>{r.source=null;}, r=>{r.environnement.webgl2=false;},
    r=>{r.environnement.physx.ready=false;},r=>{r.initialisation.circuitId='autre';},r=>{r.images.pop();},
    r=>{r.fatal='Arrêt Chromium';},r=>{r.erreurs.push('erreur script');},r=>{r.avertissements.push('GL_INVALID_OPERATION');} ]) {
    const r=rapport(s);changer(r);assert.ok(verifierCouvert(r,s).length);
  }
});

test('une visière absente, en repli ou qui ne rend pas la pluie extérieure est refusée',()=>{
  const s=cas('haut-col-portails');
  for(const changer of [ o=>{o.vitres=null;},o=>{o.vitres.j1.backend='canvas2d';},o=>{o.vitres.j1.pret=false;},
    o=>{o.vitres.j1.erreurs=1;},o=>{o.vitres.j1.erreur='shader';},o=>{o.vitres.j1.perdu=true;},
    o=>{o.vitresGL.j1.erreur=1282;},o=>{o.vitresGL.j1.present=false;},o=>{o.vitresGL.j1.perdu=true;},
    o=>{o.vitres.j1.eau=0;},o=>{o.vitres.j1.dessins=0;},o=>{o.vitres.j1.copiesScene=0;},o=>{o.vitres.j1.pixelsSource=0;},
    o=>{o.visieresVisibles.j1=false;},o=>{o.j1.pluie=0;},o=>{o.j1.visiereActive=false;} ]) {
    const r=rapport(s);changer(r.images[0].observation);assert.ok(verifierCouvert(r,s).length);
  }
});

test('les cinq phases refusent eau constante, reprises absentes et faux abri aux portails',()=>{
  const s=cas('haut-col-portails');
  for(const changer of [ r=>{r.images[1].observation.etapeId='centre';},
    r=>{r.images[1].observation.vitres.j1.eau=.8;},r=>{r.images[4].observation.vitres.j1.eau=.04;},
    r=>{r.images[2].observation.j1.abriVisiere=false;},r=>{r.images[1].observation.toit.hit=false;},
    r=>{r.images[4].observation.toit.hit=true;},r=>{r.images[4].observation.j1.lumiere=1.31;},
    r=>{r.images[2].observation.j1.lampes=0;} ]) {
    const r=rapport(s);changer(r);assert.ok(verifierCouvert(r,s).length);
  }
});

test('galerie au jour, deux vues indépendantes et caméra au-dessus du toit',()=>{
  const galerie=cas('cimes-galerie');
  for(const i of [0,1,2,3,4]) {
    const r=rapport(galerie);r.images[i].observation.j1.lumiere=1.31;
    assert.ok(verifierCouvert(r,galerie).length);
  }
  const duo=cas('cimes-deux-vues');
  for(const changer of [o=>{o.j2=o.j1;},o=>{o.j2=null;},o=>{o.j2.lumiere=NaN;},o=>{o.vitres.j2.backend='canvas2d';}]) {
    const r=rapport(duo);changer(r.images[0].observation);assert.ok(verifierCouvert(r,duo).length);
  }
  for(const joueur of ['j1','j2'])for(const champ of ['eau','embruns','gouttes']) {
    const r=rapport(duo);r.images[0].observation.vitres[joueur][champ]=.2;
    assert.ok(verifierCouvert(r,duo).length,'apport sous le toit '+joueur+'/'+champ);
  }
  const dessus=cas('cimes-dessus-toit');
  for(const changer of [o=>{o.j1.camera[1]=5;},o=>{o.j1.abriVisiere=true;},o=>{o.j1.visiereActive=true;},
    o=>{o.vitres.j1.gouttes=1;},o=>{o.visieresVisibles.j1=true;}]) {
    const r=rapport(dessus);changer(r.images[0].observation);assert.ok(verifierCouvert(r,dessus).length);
  }
});

test('une roche au-dessus de la route ou un sol hors chaussée ne valide pas un ouvrage',()=>{
  for(const s of SCENARIOS_COUVERTS) {
    const i=s.portails?2:0;
    for(const genre of [null,'rocher','mur-tunnel','voute-'+(s.type==='tunnel'?'galerie':'tunnel')]) {
      const r=rapport(s);r.images[i].observation.toit.genre=genre;
      assert.ok(verifierCouvert(r,s).length,s.id+' / faux toit '+genre);
    }
    for(const surface of [null,'herbe','vibreur']) {
      const r=rapport(s);r.images[i].observation.sol.surface=surface;
      assert.ok(verifierCouvert(r,s).length,s.id+' / faux appui '+surface);
    }
  }
});

test('géométrie, image noire et rétroviseurs restent contrôlés pour toutes les scènes',()=>{
  for(const s of SCENARIOS_COUVERTS)for(const changer of [
    r=>{r.images[0].observation.sol.hit=false;},r=>{r.images[0].observation.sol.y=3;},
    r=>{r.images[0].observation.yRoute=NaN;},r=>{r.images[0].observation.j1.camera=null;},
    r=>{r.images[0].observation.j1.lumiere=NaN;},r=>{r.images[0].vues.scene={noir:1,luminance:0};},
    r=>{delete r.images[0].etat.zones.scene;}
  ]) {const r=rapport(s);changer(r);assert.ok(verifierCouvert(r,s).length,s.id);}
  for(const s of SCENARIOS_COUVERTS.filter(s=>!s.dessus))for(const id of ['glace-g','glace-d',...(s.duo?['glace-g2','glace-d2','scene2']:[])]) {
    const r=rapport(s);delete r.images[0].etat.zones[id];assert.ok(verifierCouvert(r,s).length,s.id+'/'+id);
  }
});

test('les poses prescrites utilisent le vrai lecteur des couverts et ne remplacent aucun module',()=>{
  const require=createRequire(import.meta.url);
  for(const f of ['circuit','couverts'])require('../src/'+f+'.js');
  const B=globalThis.BITUME, c=B.circuit.creer(47,{theme:'montagne',longueur:5200,nom:'Haut-Col'}), t=c.tunnel;
  c.couverts=[{...t,fin:t.debut+78,id:'premier',type:'tunnel'},
    {...t,debut:t.debut+100,fin:t.debut+154,id:'galerie',type:'galerie',ouvert:'G'},
    {...t,debut:t.debut+186,id:'second',type:'tunnel'}];
  const fonctions={echantillon:B.circuit.echantillon,liste:B.couverts.liste,position:B.couverts.position};
  function preparer(s) {
    const voitures=Array.from({length:4},(_,id)=>({id,etat:{}}));
    const S={i:s.circuit,suivie:0,locaux:s.duo?[0,1]:[0],course:{c,voitures},prec:voitures.map(()=>({})),cour:voitures.map(()=>({})),vueJ2:s.duo?{}:null};
    const catalogue=[];catalogue[s.circuit]={id:s.circuitId};
    const contexte=vm.createContext({BITUME:B,BITUME_JEU:{session:S,CATALOGUE:catalogue}});
    const init=vm.runInContext(`(${installerEtatCouverts.toString()})(${JSON.stringify(s)})`,contexte);
    return {S,init,G:contexte.__COUVERTS_CAPTURE};
  }
  const s=cas('haut-col-portails'), p=preparer(s);
  assert.deepEqual(Array.from(p.init.etapes,e=>e.abri),[false,true,true,true,false]);
  for(let i=0;i<5;i++) {
    p.G.etape(i);const pose=p.S.cour[0],position=[pose.x,pose.y+1.2,pose.z];
    assert.equal(B.couverts.abri(c,position),i>0&&i<4);
    assert.equal(p.S.course.voitures[0].etat.s,p.G.abscisse);
  }
  assert.throws(()=>p.G.etape(5));
  const duo=preparer(cas('cimes-deux-vues'));
  const position=v=>[v.x,v.y+1.2,v.z];
  assert.equal(B.couverts.position(c,position(duo.S.cour[0])).type,'tunnel');
  assert.equal(B.couverts.position(c,position(duo.S.cour[1])).type,'galerie');
  assert.equal(B.circuit.echantillon,fonctions.echantillon);
  assert.equal(B.couverts.liste,fonctions.liste);assert.equal(B.couverts.position,fonctions.position);
});
