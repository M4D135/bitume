// Outils de qualification du pilote : triangles réellement transmis à FERRO.
// Calculs indépendants des ancrages et de l’IK du runtime. Pas de modification du rendu.
// Les surfaces ouvertes ne sont jamais soumises au test d’intérieur.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (v, s) => v.map(x => x * s), add = (a, b) => a.map((x, i) => x + b[i]);
const d2 = (a, b) => dot(sub(a, b), sub(a, b));
function pt2(p, t) {
  const [a, b, c] = t, ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2a = dot(ac, ap);
  if (d1 <= 0 && d2a <= 0) return d2(p, a);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return d2(p, b);
  const vc = d1 * d4 - d3 * d2a;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return d2(p, add(a, scale(ab, d1 / (d1 - d3))));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return d2(p, c);
  const vb = d5 * d2a - d1 * d6;
  if (vb <= 0 && d2a >= 0 && d6 <= 0) return d2(p, add(a, scale(ac, d2a / (d2a - d6))));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0)
    return d2(p, add(b, scale(sub(c, b), (d4 - d3) / (d4 - d3 + d5 - d6))));
  const den = 1 / (va + vb + vc);
  return d2(p, add(add(a, scale(ab, vb * den)), scale(ac, vc * den)));
}
function segHit(a, b, t) {
  const d = sub(b, a), u = sub(t[1], t[0]), v = sub(t[2], t[0]), h = cross(d, v), det = dot(u, h);
  if (Math.abs(det) < 1e-12) return false;
  const s = sub(a, t[0]), x = dot(s, h) / det;
  if (x < -1e-9 || x > 1 + 1e-9) return false;
  const q = cross(s, u), y = dot(d, q) / det;
  if (y < -1e-9 || x + y > 1 + 1e-9) return false;
  const f = dot(v, q) / det;
  return f >= -1e-9 && f <= 1 + 1e-9;
}
const clamp = x => Math.max(0, Math.min(1, x));
function pointsSegments(p1, q1, p2, q2) {
  const a1 = sub(q1, p1), a2 = sub(q2, p2), r = sub(p1, p2), a = dot(a1, a1), e = dot(a2, a2), f = dot(a2, r);
  let s, t;
  if (a <= 1e-16 && e <= 1e-16) return [p1, p2];
  if (a <= 1e-16) { s = 0; t = clamp(f / e); }
  else {
    const c = dot(a1, r);
    if (e <= 1e-16) { t = 0; s = clamp(-c / a); }
    else {
      const b = dot(a1, a2), den = a * e - b * b;
      s = den ? clamp((b * f - c * e) / den) : 0; t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a); }
    }
  }
  return [add(p1, scale(a1, s)), add(p2, scale(a2, t))];
}
const ss2 = (...args) => d2(...pointsSegments(...args));
function st2(a, b, t) {
  if (segHit(a, b, t)) return 0;
  return Math.min(pt2(a, t), pt2(b, t), ss2(a, b, t[0], t[1]), ss2(a, b, t[1], t[2]), ss2(a, b, t[2], t[0]));
}
const box = t => ({ lo: [0, 1, 2].map(k => Math.min(...t.map(p => p[k]))), hi: [0, 1, 2].map(k => Math.max(...t.map(p => p[k]))) });
const overlap = (a, b) => a.lo.every((x, k) => x <= b.hi[k] + 1e-9 && a.hi[k] + 1e-9 >= b.lo[k]);
function build(tris) {
  function node(entries) {
    const lo = [0, 1, 2].map(k => Math.min(...entries.map(e => e.box.lo[k])));
    const hi = [0, 1, 2].map(k => Math.max(...entries.map(e => e.box.hi[k]))), out = { lo, hi };
    if (entries.length <= 12) out.entries = entries;
    else {
      const k = [0, 1, 2].reduce((a, k) => hi[k] - lo[k] > hi[a] - lo[a] ? k : a, 0);
      entries.sort((a, b) => a.box.lo[k] + a.box.hi[k] - b.box.lo[k] - b.box.hi[k]);
      const milieu = entries.length >> 1;
      out.left = node(entries.slice(0, milieu)); out.right = node(entries.slice(milieu));
    }
    return out;
  }
  return node(tris.map(tri => ({ tri, box: box(tri) })));
}
function query(root, b, out = []) {
  if (!overlap(root, b)) return out;
  if (root.entries) { for (const e of root.entries) if (overlap(e.box, b)) out.push(e.tri); }
  else { query(root.left, b, out); query(root.right, b, out); }
  return out;
}
function intersectionPoint(a,b,t){const d=sub(b,a),e1=sub(t[1],t[0]),e2=sub(t[2],t[0]),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)return null;const inv=1/det,s=sub(a,t[0]),u=inv*dot(s,h);if(u < -1e-8 || u>1+1e-8)return null;const q=cross(s,e1),v=inv*dot(d,q);if(v < -1e-8 || u+v>1+1e-8)return null;const f=inv*dot(e2,q);if(f < -1e-8 || f>1+1e-8)return null;return add(a,scale(d,f));}
function contactsSegment(a,b,t){
 const p=intersectionPoint(a,b,t);if(p)return [p];
 // Inclure les tangences et les segments coplanaires : le déterminant nul
 // du test de traversée ne prouve pas que les surfaces sont séparées.
 const n=cross(sub(t[1],t[0]),sub(t[2],t[0])),longueur=Math.hypot(...n);
 if(Math.abs(dot(n,sub(b,a)))>=1e-12)return [];
 if(longueur>1e-12&&Math.abs(dot(n,sub(a,t[0])))>longueur*1e-10)return [];
 if(st2(a,b,t)>1e-20)return [];
 const points=[];
 if(pt2(a,t)<=1e-20)points.push(a);if(pt2(b,t)<=1e-20)points.push(b);
 for(let i=0;i<3;i++){const [x,y]=pointsSegments(a,b,t[i],t[(i+1)%3]);if(d2(x,y)<=1e-20)points.push(scale(add(x,y),.5));}
 return points;
}
function pointsIntersections(tris,tree){const points=new Map();for(const t of tris)for(const u of query(tree,box(t)))for(let i=0;i<3;i++)for(const args of [[t[i],t[(i+1)%3],u],[u[i],u[(i+1)%3],t]])for(const p of contactsSegment(...args))points.set(p.map(x=>Math.round(x*1e6)).join(','),p);return [...points.values()];}

export function lireMaillages(contexte,niveau=false) {
 const resultat=new Map(),g=contexte.FRender.shared.geometry(niveau);
 for(const [nom,r] of Object.entries(g.ranges)){
  const tris=[];for(let i=r.offset/4;i<r.offset/4+r.count;i+=3)
   tris.push([0,1,2].map(k=>Array.from(g.vertices.slice(g.indices[i+k]*6,g.indices[i+k]*6+3))));
  resultat.set(nom,tris);
 }
 return resultat;
}
export function trianglesObjet(objet,maillages,V){
 const source=maillages.get(objet.shape);if(!source)throw Error('Maillage inconnu : '+objet.shape);
 const m=V.euler(...objet.r);
 return source.map(t=>t.map(p=>V.mul(m,p.map((x,k)=>x*objet.s[k])).map((x,k)=>x+objet.p[k])));
}
export function topologie(tris){
 const edges=new Map(),sommets=new Set();let volume=0,degeneres=0;
 const cle=p=>p.map(x=>Math.round(x*1e8)).join(',');
 for(const t of tris){volume+=dot(t[0],cross(t[1],t[2]))/6;if(Math.hypot(...cross(sub(t[1],t[0]),sub(t[2],t[0])))<1e-12)degeneres++;
  for(let i=0;i<3;i++){const a=cle(t[i]),b=cle(t[(i+1)%3]),k=[a,b].sort().join('|');sommets.add(a);if(!edges.has(k))edges.set(k,[]);edges.get(k).push(a<b?1:-1);}
 }
 return {triangles:tris.length,sommets:sommets.size,aretes:edges.size,
  aretesOuvertes:[...edges.values()].filter(x=>x.length===1).length,
  aretesNonManifold:[...edges.values()].filter(x=>x.length>2).length,
  orientationsIncoherentes:[...edges.values()].filter(x=>x.length===2&&x[0]===x[1]).length,
  degeneres,volumeM3:volume,euler:sommets.size-edges.size+tris.length};
}
export function surface(tris,{fermee=false}={}){
 const t=topologie(tris);
 if(fermee&&(t.aretesOuvertes||t.aretesNonManifold||t.orientationsIncoherentes||t.degeneres||t.euler!==2||t.volumeM3<=0))
  throw Error('Surface fermée non valide : '+JSON.stringify(t));
 return {triangles:tris,arbre:build(tris),topologie:t,fermee};
}
export function interieur(point,s){
 if(!s.fermee)throw Error('Intérieur indéfini pour une surface ouverte.');
 if(!point.every((v,k)=>v>s.arbre.lo[k]&&v<s.arbre.hi[k]))return false;
 // Nombre d’enroulement par angles solides. Aucun rayon ni direction de l’IK ne sert d’oracle.
 let angle=0;
 for(const t of s.triangles){
  const a=sub(t[0],point),b=sub(t[1],point),c=sub(t[2],point),la=Math.hypot(...a),lb=Math.hypot(...b),lc=Math.hypot(...c);
  if(Math.min(la,lb,lc)<1e-10)return false;
  angle+=2*Math.atan2(dot(a,cross(b,c)),la*lb*lc+dot(a,b)*lc+dot(a,c)*lb+dot(b,c)*la);
 }
 return Math.abs(angle)>Math.PI*2;
}
export function mesurerContacts(tris,s,{epaule=null,rayonAttache=0}={}){
 if(!Number.isFinite(rayonAttache)||rayonAttache<0||rayonAttache>.04)throw Error('Attache hors borne : de 0 à 4 cm.');
 if(rayonAttache&&!epaule)throw Error('Une attache doit avoir un centre explicite.');
 if(epaule&&(epaule.length!==3||!Array.from(epaule).every(Number.isFinite)))throw Error('Centre d’attache invalide.');
 if(!overlap(box(tris.flat()),s.arbre))return {croisement:false,entierementContenu:false,interieurHorsAttache:false,horsAttache:false,points:[],pointsHorsAttache:[]};
 const points=pointsIntersections(tris,s.arbre);
 const hors=points.filter(p=>!epaule||Math.sqrt(d2(p,epaule))>rayonAttache);
 const contenu=!points.length&&s.fermee&&tris.every(t=>t.every(p=>interieur(p,s)));
 // Contrôler l’intérieur même quand le membre entre seulement par l’attache :
 // une intersection locale peut se prolonger par un bras enfoui dans le thorax.
 // Sommets ET centres des faces sont indépendants des articulations du runtime.
 let pointInterieurHorsAttache=null;
 if(s.fermee&&!hors.length){
  const vus=new Set(),candidats=[];
  for(const t of tris){for(const p of [...t,scale(add(add(t[0],t[1]),t[2]),1/3)]){
   if(epaule&&d2(p,epaule)<=rayonAttache*rayonAttache)continue;
   const k=p.map(x=>Math.round(x*1e8)).join(',');if(!vus.has(k)){vus.add(k);candidats.push(p);}
  }}
  for(const p of candidats)if(interieur(p,s)){pointInterieurHorsAttache=p;break;}
 }
 const interieurHorsAttache=pointInterieurHorsAttache!==null;
 return {croisement:points.length>0,entierementContenu:contenu,interieurHorsAttache,horsAttache:hors.length>0||interieurHorsAttache,points,pointsHorsAttache:hors,pointInterieurHorsAttache};
}
export function distanceSurface(point,s){return Math.sqrt(Math.min(...s.triangles.map(t=>pt2(point,t))));}
export function bornes(tris){return box(tris.flat());}
export function raccordEpaule(bras,thorax,{epaule,rotule=null,rayonAttache=.035}){
 if(!thorax.fermee)throw Error('Le raccord exige un thorax fermé qualifié.');
 const direct=mesurerContacts(bras,thorax,{epaule,rayonAttache});
 let chaine=false,rayonRotuleMax=0,rotuleDansAttache=true,contactRotule=null;
 if(rotule){
  rayonRotuleMax=Math.max(...rotule.triangles.flat().map(p=>Math.sqrt(d2(p,epaule))));
  rotuleDansAttache=rayonRotuleMax<=rayonAttache+1e-8;
  contactRotule=mesurerContacts(rotule.triangles,thorax,{epaule,rayonAttache});
  chaine=(contactRotule.croisement||contactRotule.entierementContenu)&&mesurerContacts(bras,rotule).croisement;
 }
 const lie=direct.croisement||direct.entierementContenu||chaine;
 return {lie,chaine,rotuleDansAttache,rayonRotuleMax,direct,contactRotule,
  conforme:lie&&rotuleDansAttache&&!direct.horsAttache&&!(contactRotule&&contactRotule.horsAttache)};
}
export {pointsIntersections};
