// Ouvertures réelles du modèle 126 CK : contrôle des triangles et des niveaux de détail.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';
const require=createRequire(import.meta.url);
for(const f of ['carene.js','main.js','ferro/vehicle-dynamics.js','pneus.js','usure-pneus.js','conduite.js','voiture.js'])require('../src/'+f);
const V=BITUME.voiture;
const mesh=name=>{const f=V.FORMES[name];return f.tri.map(t=>t.slice(0,3).map(p=>p.map((v,k)=>v*f.taille[k]+f.centre[k])));};
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function hit(a,b,t){const d=sub(b,a),u=sub(t[1],t[0]),v=sub(t[2],t[0]),h=cross(d,v),det=dot(u,h);
 if(Math.abs(det)<1e-12)return false;const s=sub(a,t[0]),x=dot(s,h)/det;if(x<0||x>1)return false;
 const q=cross(s,u),y=dot(d,q)/det;if(y<0||x+y>1)return false;const f=dot(v,q)/det;return f>=0&&f<=1;}
const coupe=(tris,a,b)=>tris.some(t=>hit(a,b,t));

test('ouïes de flanc : passage libre à travers la peau puis fond réellement en retrait',()=>{
 const fond=mesh('pontons-conduits');
 for(const nom of ['pontons','loin-caisse'])for(const k of [-1,1])for(const [x,y] of [[.16,.33],[.30,.37],[.45,.40],[.58,.36],[.67,.40]]){
  const a=[x,y,k*.79],b=[x,y,k*.65];
  assert(!coupe(mesh(nom),a,b),`peau pleine ${nom} ${k} ${x}/${y}`);
  assert(!coupe(fond,a,b),'fond trop proche de la lèvre');
  assert(coupe(fond,a,[x,y,k*.61]),'radiateur de fond absent');
 }
 // Une plaque réintroduite dans le flanc doit échouer au même rayon.
 assert(coupe([[[.1,.3,.72],[.7,.3,.72],[.7,.44,.72]]],[.4,.34,.79],[.4,.34,.65]));
});
test('lèvres et rétrécissement vers l’avant sont maintenus dans les deux peaux',()=>{
 for(const nom of ['pontons','loin-caisse'])for(const k of [-1,1])for(const [x,y] of [[.08,.37],[.75,.40],[.32,.285],[.32,.45],[.67,.34]])
  assert(coupe(mesh(nom),[x,y,k*.80],[x,y,k*.63]),`bord perdu ${nom} ${x}/${y}`);
});
test('grille fine : montants réels et intervalles libres, sans masquer le fond',()=>{
 const grille=mesh('pontons-grilles');
 for(const k of [-1,1]){
  for(const x of [.113,.227,.341,.455])assert(coupe(grille,[x,.37,k*.80],[x,.37,k*.66]),'montant absent');
  for(const x of [.12725,.24125,.35525,.46925])assert(!coupe(grille,[x,.37,k*.80],[x,.37,k*.66]),'intervalle bouché');
 }
});
test('prises arrière sur le dessus : deux dépressions ouvertes avec leur rampe',()=>{
 const fond = mesh('pontons-conduits');
 // Les deux rives intactes définissent la hauteur locale du plateau actuel.
 function hauteur(tris, x, z) {
  let bas = .29, haut = .65;
  if (!coupe(tris, [x, haut, z], [x, bas, z])) return null;
  for (let i = 0; i < 16; i++) {
   const milieu = (bas + haut) * .5;
   if (coupe(tris, [x, haut, z], [x, milieu, z])) bas = milieu;
   else haut = milieu;
  }
  return (bas + haut) * .5;
 }
 for (const nom of ['pontons', 'loin-caisse']) for (const cote of [-1, 1]) {
  const peau = mesh(nom);
  for (const [x, z] of [[-.94, .355], [-.94, .383], [-.94, .406], [-.87, .408]]) {
   const interieur = hauteur(peau, x, cote * .315), exterieur = hauteur(peau, x, cote * .448);
   assert(interieur != null && exterieur != null, 'plateau disparu autour de la prise');
   const plateau = interieur + (exterieur - interieur) * (z - .315) / (.448 - .315);
   assert.equal(hauteur(peau, x, cote * z), null, 'toit non ouvert ' + nom);
   const rampe = hauteur(fond, x, cote * z);
   assert(rampe != null && rampe < plateau - .012 && rampe > plateau - .060, 'rampe hors du ponton ' + nom);
  }
 }
});
test('LOD : conduits partagés, grilles proches/moyennes et joints proches seulement',()=>{
 const mod=V.modele({couleur:[.8,.1,.1],numero:27}),ev={p:[0,0,0],cap:0,roule:0,braquage:0,v:0};
 let conduit;
 for(const detail of ['complet','moyen','simple']){
  const out=[];V.poser(mod,ev,out,{detail});
  const o=out.find(o=>o.shape==='bitume-pontons-conduits');assert(o);
  const valeur=JSON.stringify([o.p,o.s,o.r]);if(conduit)assert.equal(valeur,conduit);conduit=valeur;
  assert.equal(out.some(o=>o.shape==='bitume-pontons-grilles'),detail!=='simple');
  assert.equal(out.some(o=>o.shape==='bitume-pontons-joints'),detail==='complet');
 }
});
test('les ajouts de pontons préservent la marge réelle de 15 mm aux pneus braqués',()=>{
 const tris=['pontons','pontons-conduits','pontons-grilles','pontons-joints','loin-caisse'].flatMap(mesh);
 for(const d of [-.60,-.35,0,.35,.60])for(let i=0;i<2;i++){
  const w=V.ROUES[i],a=V.braquages(d)[i],co=Math.cos(a),si=Math.sin(a);
  for(const t of tris)for(const p of [...t,t[0].map((_,k)=>(t[0][k]+t[1][k]+t[2][k])/3)]){
   const dx=p[0]-w.x,dz=p[2]-w.z,x=dx*co+dz*si,z=-dx*si+dz*co;
   const distance=Math.hypot(Math.max(0,Math.hypot(x,p[1]-w.r)-w.r),Math.max(0,Math.abs(z)-w.l/2));
   assert(distance>.015,`marge pneu ${distance}, braquage ${d}, point ${p}`);
  }
 }
});
