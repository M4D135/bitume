import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
require('../src/circuit.js'); require('../src/detail-peripherique.js'); require('../src/ferro/render-shared.js');
const B = globalThis.BITUME, D = B.detailPeripherique, R = globalThis.FRender.shared;
const cas = (nom, verifier) => { verifier(); console.log('ok '+nom); };
const lot = (x,z,options={}) => Object.assign({centre:[x,2,z],rayon:1,objets:[{}],loin:[{}],arbres:true,bascule:160,
  lodReferenceFov:60,lodReferenceHeight:1080}, options);
const voiture = {s:0,v:60,frein:0}, vue = {pos:[0,2,0],pitch:0,yaw:0,roll:0,fov:60};
function trajet(x,z) {
  const c = B.circuit.creer(11,{theme:'foret',longueur:4200});
  c.ouvert=true;
  // Le tracé se prolonge rectiligne sur plusieurs centaines de mètres pour isoler l'effet du champ.
  for(let i=0;i<c.n;i++){c.x[i]=i*c.pas*x;c.z[i]=i*c.pas*z;}
  return c;
}
const droit = trajet(0,-1);
cas('la vue garde le centre entier, la sphère proche et les éléments de conduite',()=>{
  const arbres = [lot(105,-105),lot(30,-145),lot(18,-30),lot(105,-105,{arbres:false}),lot(90,-105,{rayon:44})];
  const d=D.creer(arbres),base=arbres.map(a=>[a.bascule,a.objets,a.loin]);
  D.appliquer(d,droit,voiture,vue,1920,1080);
  assert.equal(d.n,1);assert.equal(d.touches[0],arbres[0]);assert.ok(arbres[0].bascule<160);
  assert.equal(R.lotViewState().prepare([arbres[0]],vue.pos,Math.tan(Math.PI/6),1080)[0].near,false);
  for(let k=1;k<arbres.length;k++)assert.equal(arbres[k].bascule,160);
  D.restaurer(d);
  for(let i=0;i<arbres.length;i++)assert.deepEqual([arbres[i].bascule,arbres[i].objets,arbres[i].loin],base[i]);
});
cas('le freinage préserve la périphérie sur la future trajectoire',()=>{
  const arbre=lot(105,-105), d=D.creer([arbre]), route=trajet(Math.SQRT1_2,-Math.SQRT1_2);
  D.appliquer(d,route,{s:0,v:72,frein:0},vue,1920,1080);assert.equal(d.n,1);
  D.restaurer(d);D.appliquer(d,route,{s:0,v:72,frein:1},vue,1920,1080);assert.equal(d.n,0);
});
cas('les deux vues ont chacune leur champ et leur résolution, les glaces retrouvent le seuil initial',()=>{
  const arbre=lot(105,-105), d=D.creer([arbre]), temoin={...arbre};
  for(const [yaw,w,h,n] of [[0,1920,1080,1],[Math.PI/4,1920,1080,0],[0,1920,540,0],[0,1920,1080,1]]){
    D.appliquer(d,droit,voiture,{...vue,yaw},w,h); assert.equal(d.n,n);D.restaurer(d);
    assert.deepEqual(arbre,temoin);
  }
  D.appliquer(D.creer([lot(100,-100,{arbres:false})]),null,null,null,1920,1080);
});
