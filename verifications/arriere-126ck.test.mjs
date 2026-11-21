// Géométrie réelle de l'arrière 126 CK, sans prétendre à des cotes constructeur.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';
const require=createRequire(import.meta.url);
for(const f of ['carene.js','main.js','voiture.js','echappement.js'])require('../src/'+f);
const V=globalThis.BITUME.voiture, X=globalThis.BITUME.echappement;
const mesh=name=>{const f=V.FORMES[name];assert(f,name);return f.tri.map(t=>t.slice(0,3).map(p=>p.map((v,k)=>v*f.taille[k]+f.centre[k])));};
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function hit(a,b,t){
 const d=sub(b,a),u=sub(t[1],t[0]),v=sub(t[2],t[0]),h=cross(d,v),det=dot(u,h);
 if(Math.abs(det)<1e-12)return false;
 const s=sub(a,t[0]),x=dot(s,h)/det;if(x<0||x>1)return false;
 const q=cross(s,u),y=dot(d,q)/det;if(y<0||x+y>1)return false;
 const f=dot(v,q)/det;return f>=0&&f<=1;
}
test('capot en arche : accès arrière ouvert et peau supérieure conservée',()=>{
 const peau=mesh('moteur');
 for(const z of [-.22,0,.22])for(const y of [.49,.55,.60])
  assert(!peau.some(t=>hit([-1.05,y,z],[-.31,y,z],t)),`capot bouché en ${y}/${z}`);
 for(const z of [-.20,0,.20])
  assert(peau.some(t=>hit([-.40,1,z],[-.40,.50,z],t)),'la peau supérieure doit être réellement présente');
 // Raccord au plateau : aucun abaissement arbitraire du bord supérieur avant.
 const bord=peau.flat().filter(p=>Math.abs(p[0]+.30)<1e-8&&Math.abs(p[2])<.24);
 assert(bord.length>0&&bord.every(p=>Math.abs(p[1]-.84)<1e-8));
 // Témoin négatif : un disque ajouté devant l'arche est correctement détecté.
 assert(hit([-1.05,.55,0],[-.31,.55,0],[[-.8,.4,-.3],[-.8,.4,.3],[-.8,.8,0]]));
});
test('plateau métallique et renforts sont implantés derrière le nouveau dossier',()=>{
 const p=mesh('plateau-arriere').flat(),a=mesh('arceau').flat(),r=mesh('arceau-renforts').flat();
 assert(Math.min(...p.map(v=>v[0]))>=-.301&&Math.max(...p.map(v=>v[0]))<=.351);
 assert(Math.max(...p.map(v=>v[1]))>.835&&Math.max(...p.map(v=>v[1]))<.845);
 assert(Math.min(...a.map(v=>v[0]))>.30&&Math.max(...a.map(v=>v[0]))<.34);
 assert(Math.max(...a.map(v=>v[1]))>1.03&&Math.max(...a.map(v=>v[1]))<1.051);
 assert(Math.min(...r.map(v=>v[0]))<-.25&&Math.max(...r.map(v=>v[0]))>.31);
 assert(r.some(v=>v[2]<-.17)&&r.some(v=>v[2]>.17));
});
test('détails lointains : capot commun, arceau, plateau, tubes et aile gardent leurs vrais sommets',()=>{
 const agregat=new Set(mesh('arriere-metal-simple').flat().map(p=>p.map(x=>x.toFixed(6)).join(',')));
 for(const nom of ['arceau','arceau-renforts','plateau-arriere','echappements-hauts','echappements-bas','aileron-arriere','derives-arriere'])
  for(const p of mesh(nom).flat())assert(agregat.has(p.map(x=>x.toFixed(6)).join(',')),`sommet perdu ${nom}: ${p}`);
 const mod=V.modele({couleur:[.8,.1,.1],numero:27}),ev={p:[0,0,0],cap:0,tangage:0,roulis:0,braquage:0,roule:0,v:0};
 for(const detail of ['complet','moyen','simple']){
  const out=[];V.poser(mod,ev,out,{detail});
  assert(out.some(o=>o.shape==='bitume-moteur'),`capot absent ${detail}`);
  assert(out.some(o=>o.shape===(detail==='simple'?'bitume-arriere-metal-simple':'bitume-plateau-arriere')),`plateau absent ${detail}`);
  for(const o of out)for(const k of ['p','s','r'])assert(o[k].every(Number.isFinite),`${detail}: ${o.shape}.${k}`);
 }
});
test('les quatre flammes partent des embouchures ouvertes, supérieures plus grosses que les inférieures',()=>{
 for(const S of X.SORTIES){
  const nom=S.haut?'echappements-hauts':'echappements-bas',triangles=mesh(nom);
  const bord=triangles.flat().filter(p=>Math.abs(p[0]-S.x)<1e-8&&Math.sign(p[2])===Math.sign(S.z));
  assert(bord.length>0,'embouchure absente');
  assert(bord.every(p=>Math.abs(Math.hypot(p[1]-S.y,p[2]-S.z)-S.r)<1e-8));
  assert(!triangles.some(t=>hit([S.x-.02,S.y,S.z],[S.x+.03,S.y,S.z],t)),'tube bouché');
 }
 assert(X.SORTIES[0].r>X.SORTIES[2].r*1.7);
 assert(X.SORTIES[0].x>X.SORTIES[2].x+.3);
});
test('aile avant et arrière ont des profils de volume fini dans les bornes physiques conservées',()=>{
 for(const nom of ['aileron-avant','derives-avant','aileron-arriere','derives-arriere']){
  const tris=mesh(nom),p=tris.flat();assert(tris.length>20);
  assert(p.every(v=>v.every(Number.isFinite)&&v[0]>=-2.231&&v[0]<=2.301&&v[1]>.04&&v[1]<1.02));
  assert(Math.max(...p.map(v=>v[2]))>0.6&&Math.min(...p.map(v=>v[2]))<-.6);
 }
 assert.deepEqual(V.ROUES.map(w=>w.x),[1.35,1.35,-1.35,-1.35]);
});
