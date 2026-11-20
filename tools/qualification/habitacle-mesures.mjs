// Diagnostic H0/B0 du modèle du 20 novembre 2026. Aucun changement du runtime.
// Les calculs de contact indépendants ci-dessous proviennent de pilote-habitacle.test.mjs.
// Ce script mesure les surfaces, sans qualifier l’intérieur d’un buste ouvert ni le rendu GPU.
// Régression cockpit extérieur : volumes rendus et triangles de carrosserie réellement posés.
// Aucun ancrage de production recopié ; les deux passages de rapports, le braquage et les LOD sont balayés.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const destination = process.argv[2] && path.resolve(process.argv[2]);
if (!destination) throw new Error('Usage : node tools/qualification/habitacle-mesures.mjs <rapport.json>');
const contexte = vm.createContext({ console });
vm.runInContext('globalThis.window = globalThis;', contexte);
for (const nom of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js', 'ferro/vehicle-dynamics.js',
  'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'expressions-pilote.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(racine, 'src', nom), 'utf8'), contexte, { filename: nom });
const V = contexte.BITUME.voiture;
const formes = new Map(), geometrie = contexte.FRender.shared.geometry(false);
// Mailles réellement préparées pour le moteur, y compris leur conversion en Float32.
for (const f of Object.values(V.FORMES)) {
  const r = geometrie.ranges[f.nom], triangles = [];
  assert.ok(r, 'forme libre enregistrée : ' + f.nom);
  for (let i = r.offset / 4; i < r.offset / 4 + r.count; i += 3)
    triangles.push([0, 1, 2].map(k => Array.from(geometrie.vertices.slice(geometrie.indices[i + k] * 6, geometrie.indices[i + k] * 6 + 3))));
  formes.set(f.nom, triangles);
}
const primitives = new Map([['cylinder', []], ['sphere', []], ['box', []]]);
for (const niveau of [false, true, 2]) {
  const g = contexte.FRender.shared.geometry(niveau);
  for (const [nom, niveaux] of primitives) {
    const r = g.ranges[nom], triangles = [];
    for (let i = r.offset / 4; i < r.offset / 4 + r.count; i += 3)
      triangles.push([0, 1, 2].map(k => Array.from(g.vertices.slice(g.indices[i + k] * 6, g.indices[i + k] * 6 + 3))));
    niveaux.push(triangles);
  }
}
for (const [nom, niveaux] of primitives) formes.set(nom, niveaux[0]);

// Distances point/segment-triangle et recherche dans un arbre de boîtes : calcul indépendant du rig.
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
function ss2(p1, q1, p2, q2) {
  const a1 = sub(q1, p1), a2 = sub(q2, p2), r = sub(p1, p2), a = dot(a1, a1), e = dot(a2, a2), f = dot(a2, r);
  let s, t;
  if (a <= 1e-16 && e <= 1e-16) return d2(p1, p2);
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
  return d2(add(p1, scale(a1, s)), add(p2, scale(a2, t)));
}
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
function crossing(tris, tree) {
  for (const t of tris) for (const u of query(tree, box(t)))
    for (let i = 0; i < 3; i++)
      if (st2(t[i], t[(i + 1) % 3], u) <= 1e-20 || st2(u[i], u[(i + 1) % 3], t) <= 1e-20) return [t, u];
  return null;
}

let cacheTriangles = new WeakMap(), cacheBoites = new WeakMap();
function triangles(objet, source = formes.get(objet.shape)) {
  const standard = source === formes.get(objet.shape);
  if (standard && cacheTriangles.has(objet)) return cacheTriangles.get(objet);

  assert.ok(source, 'forme libre connue : ' + objet.shape);
  const m = V.euler(...objet.r);
  const resultat = source.map(t => t.slice(0, 3).map(p => V.mul(m, p.map((v, k) => v * objet.s[k])).map((v, k) => v + objet.p[k])));
  if (standard) cacheTriangles.set(objet, resultat); return resultat;
}
function agrandir(b, r) { return { lo: b.lo.map(x => x - r), hi: b.hi.map(x => x + r) }; }
function capsule(objet) {
  const m = V.euler(...objet.r), r = Math.max(objet.s[0], objet.s[2]) / 2;
  const points = [-1, 1].map(s => objet.p.map((x, k) => x + s * m[1][k] * objet.s[1] / 2));
  return { points, r };
}
function traversee(objet, arbre, marge = .001) {
  if (objet.shape === 'cylinder' || (objet.shape === 'sphere' && objet.s[1] > 2 * Math.max(objet.s[0], objet.s[2]))) {
    // Capsule circonscrite au cylindre ou à une manche ellipsoïde allongée : rejet large conservateur.
    const { points, r } = capsule(objet), candidats = query(arbre, agrandir(box(points), r + marge));
    if (!candidats.length || Math.sqrt(Math.min(...candidats.map(t => st2(...points, t)))) - r >= 0) return false;
    // Le disque du volant est court : la capsule est trop large à ses extrémités.
    // Départager avec les vrais triangles FERRO pour chacun des niveaux de qualité.
    return primitives.get(objet.shape).some(source => crossing(triangles(objet, source), arbre));
  }
  if (objet.shape === 'sphere') {
    // Sphère circonscrite à l'ellipsoïde pour les LOD simplifiés et le pommeau.
    const r = Math.max(...objet.s) / 2, candidats = query(arbre, agrandir(box([Array.from(objet.p)]), r + marge));
    if (!candidats.length || Math.sqrt(Math.min(...candidats.map(t => pt2(objet.p, t)))) - r >= 0) return false;
    return primitives.get(objet.shape).some(source => crossing(triangles(objet, source), arbre));
  }
  let borne = cacheBoites.get(objet);
  if (!borne) {
    const m = V.euler(...objet.r), coins = [];
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5])
      coins.push(V.mul(m, [x * objet.s[0], y * objet.s[1], z * objet.s[2]]).map((v, k) => v + objet.p[k]));
    borne = box(coins); cacheBoites.set(objet, borne);
  }
  if (!query(arbre, borne).length) return false;
  return !!crossing(triangles(objet), arbre);
}
const creer = (numero = 27) => V.modele({ couleur: [.8, .12, .1], combinaison: [.9, .85, .7], numero });
const pose = () => ({ p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 20,
  pilote: { volant: 0, rapportAvant: 2, rapport: 3, passage: 1 } });
function dessiner(modele, ev, detail = 'complet') {
  cacheTriangles = new WeakMap(); cacheBoites = new WeakMap();
  const sortie = []; V.poser(modele, ev, sortie, { detail });
  const index = detail === 'complet' ? 0 : detail === 'moyen' ? 6 : 2;
  return { sortie, pieces: modele.objetsRendu.pilote.variantes[index].pieces };
}
const piecesCoque = {
  complet: ['goutte', 'goutte-dedans', 'jonc', 'bulle', 'cuve'],
  moyen: ['goutte', 'cuve'],
  simple: ['loin-caisse', 'loin-dessus', 'loin-quille']
};
function coque(sortie, detail = 'complet') {
  const obstacles = piecesCoque[detail].map(nom => {
    const objet = sortie.find(o => o.shape === 'bitume-' + nom || o.shape === 'bitume-' + nom + '-pilote');
    assert.ok(objet, 'pièce de cockpit toujours présente : ' + nom);
    return { nom, arbre: build(triangles(objet)) };
  });
  const consoleLevier = sortie.find(o => o.shape === 'bitume-console-levier-pilote');
  if (consoleLevier) obstacles.push({ nom: 'console-levier', arbre: build(triangles(consoleLevier)) });
  return obstacles;
}
const etapes = [0, .08, .15, .25, .3, .45, .5, .65, .75, .85, .93, 1];
const passages = [[-1, 0], [0, -1], [0, 1], [1, 0]];
for (let n = 1; n < 6; n++) passages.push([n, n + 1], [n + 1, n]);



const report = {commit:execFileSync('git',['-C',racine,'rev-parse','HEAD'],{encoding:'utf8'}).trim(), version:JSON.parse(fs.readFileSync(path.join(racine,'VERSION.json'),'utf8')).version, sourceSha256:createHash('sha256').update(fs.readFileSync(path.join(racine,'src/voiture.js'))).digest('hex'), source:'src/voiture.js; actual Float32 FERRO geometry', expectedStatus:'diagnostic only, not qualification', world:{}, body:{}, intersections:[]};
const modele = creer(), ev = pose();
let rendu = dessiner(modele, ev);
const H = modele.objetsRendu.habitacle, R = modele.objetsRendu.pilote;
const save = o => ({shape:o.shape,p:Array.from(o.p),s:Array.from(o.s),r:Array.from(o.r),mat:o.mat,color:Array.from(o.color||[])});
const bbox = tris => box(tris.flat());
const ext = R.variantes[0].pieces.filter(p=>p.source).map(p=>({role:p.role,source:p.source,ext:save(p.objet)}));
const worldPieces = ['cuve','jonc','goutte','goutte-dedans','bulle-pilote','pilote-buste','pilote-casque','pilote-visiere','retros'];
for (const name of worldPieces) {const o=rendu.sortie.find(o=>o.shape==='bitume-'+name);if(o)report.world[name]={...save(o),bounds:bbox(triangles(o))};}
report.world.joints=Array.from(H.articulations); report.world.cameraEye=Array.from(V.OEIL);
report.world.physicalEyeReference={comment:'Actual source eye anchors rotated to car, shifted by -0.781 vertical and PILOTE_RECUL=-0.10, neutral head',eyes:contexte.RADE.humanData.eyes.map(q=>[q[2]-.10,q[1]-.781,-q[0]])};
const inside = [];V.cockpit(modele,ev,inside,{...ev.pilote,regime:9000,kmh:140});
report.world.comparisons=ext.map(e=>({role:e.role,exterior:e.ext,cockpit:save(e.source.objet),positionDelta:e.ext.p.map((x,k)=>x-e.source.objet.p[k]),scaleRatio:e.ext.s.map((x,k)=>x/e.source.objet.s[k])}));
report.world.insideOnlyForms=[...new Set(inside.map(o=>o.shape))].filter(name=>!rendu.sortie.some(o=>o.shape===name));
report.world.exteriorOnlyForms=[...new Set(rendu.sortie.map(o=>o.shape))].filter(name=>!inside.some(o=>o.shape===name));
report.world.instrumentation={planchePieces:H.planche.length,exteriorPlanchePieces:R.variantes[0].pieces.filter(p=>H.planche.includes(p.source)).length,aiguilles:H.aiguilles.length,exteriorAiguilles:R.variantes[0].pieces.filter(p=>H.aiguilles.includes(p.source)).length};
report.world.mirrors={cockpit:V.RETRO,externalGlasses:modele.corps.filter(p=>p.glace).map(p=>({centre:p.o,dimensions:p.s}))};
function topo(tris) {const edges=new Map();const key=p=>p.map(x=>Math.round(x*1e7)).join(',');for(const t of tris)for(let i=0;i<3;i++){const e=[key(t[i]),key(t[(i+1)%3])].sort().join('|');edges.set(e,(edges.get(e)||0)+1);}return {triangles:tris.length,edges:edges.size,boundaryEdges:[...edges.values()].filter(x=>x===1).length,nonManifoldEdges:[...edges.values()].filter(x=>x>2).length};}
function section(tris,y) {const pts=[];for(const t of tris)for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3];if((a[1]<=y&&b[1]>=y)||(b[1]<=y&&a[1]>=y)){if(Math.abs(b[1]-a[1])<1e-10)continue;const f=(y-a[1])/(b[1]-a[1]);pts.push(a.map((x,k)=>x+f*(b[k]-x)));}}return pts.length?{y,count:pts.length,bounds:box(pts)}:{y,count:0};}
const source=contexte.RADE.bodyData;let nTri=0, armTriangles=0, torsoTriangles=0;const retainedBoneIds=new Set(),selectedArm=[];
for(let i=0;i<source.indices.length;i+=3){const ids=source.indices.slice(i,i+3),p=ids.map(j=>source.positions[j]);const x=p.reduce((s,q)=>s+q[0],0)/3,y=p.reduce((s,q)=>s+q[1],0)/3;if(!(y>1.2&&(Math.abs(x)<.19||y>1.38)))continue;nTri++;const bones=ids.flatMap(j=>source.bones[j].slice(0,2));bones.forEach(x=>retainedBoneIds.add(x));const isArm=bones.some(x=>[2,3,18,19].includes(x));selectedArm.push(isArm);if(isArm)armTriangles++;else torsoTriangles++;}
report.body.source={selectedTriangles:nTri,trianglesWithArmBone:armTriangles,trianglesWithTorsoOnly:torsoTriangles,retainedBoneIds:[...retainedBoneIds]};
function intersectionPoint(a,b,t){const d=sub(b,a),e1=sub(t[1],t[0]),e2=sub(t[2],t[0]),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)return null;const inv=1/det,s=sub(a,t[0]),u=inv*dot(s,h);if(u < -1e-8 || u>1+1e-8)return null;const q=cross(s,e1),v=inv*dot(d,q);if(v < -1e-8 || u+v>1+1e-8)return null;const f=inv*dot(e2,q);if(f < -1e-8 || f>1+1e-8)return null;return add(a,scale(d,f));}
function pointsIntersections(tris,tree){const points=new Map();for(const t of tris)for(const u of query(tree,box(t)))for(let i=0;i<3;i++)for(const args of [[t[i],t[(i+1)%3],u],[u[i],u[(i+1)%3],t]]){const p=intersectionPoint(...args);if(p)points.set(p.map(x=>Math.round(x*1e6)).join(','),p);}return [...points.values()];}
const scenarios=[];for(const volant of [-1,0,1])scenarios.push({nom:'volant',volant,passage:1});for(const passage of [.25,.5,.75])for(const [rapportAvant,rapport] of [[2,3],[4,3]])scenarios.push({nom:'rapport',passage,rapportAvant,rapport,volant:0});for(const geste of ['majeur','poing','salut'])for(const gesteCote of [-1,1])for(const gesteIntensite of [.5,1])scenarios.push({nom:'geste',geste,gesteCote,gesteIntensite,gestePhase:.43,volant:0,passage:1});
for(const detail of ['complet','moyen','simple']){
 Object.assign(ev.pilote,{volant:0,passage:1,rapportAvant:2,rapport:3,geste:null,gesteIntensite:0});rendu=dessiner(modele,ev,detail);const body=rendu.sortie.find(o=>o.shape==='bitume-pilote-buste')||rendu.pieces.find(p=>p.role==='buste').objet;
 const tris=triangles(body); if(detail==='complet') assert.equal(tris.length, selectedArm.length, 'Le modèle du buste a changé : revoir la correspondance avec la source humaine avant de classer les contacts.'); const tree=build(tris),thorax=detail==='complet'?build(tris.filter((t,i)=>!selectedArm[i])):tree,rigidArms=detail==='complet'?build(tris.filter((t,i)=>selectedArm[i])):null;report.body[detail]={...save(body),bounds:bbox(tris),topology:topo(tris),sections:[.42,.48,.54,.60,.66,.70,.73].map(y=>section(tris,y))};
 let poses=0,posesHit=0,partsHit=0,maxAway=0,worst=null,thoraxParts=0,rigidArmParts=0,thoraxWorst=null;
 for(const scene of scenarios){Object.assign(ev.pilote,{volant:0,passage:1,rapportAvant:2,rapport:3,geste:null,gesteIntensite:0},scene);const {pieces}=dessiner(modele,ev,detail);poses++;let hit=false;for(const piece of pieces.filter(p=>/^(gant|bras|avant-bras|manche-joint|coude)-/.test(p.role))){const contacts=pointsIntersections(triangles(piece.objet),tree);if(!contacts.length)continue;partsHit++;hit=true;const h=Number(piece.role.split('-').filter(x=>/^[01]$/.test(x))[0]||'0');const shoulder=Array.from(H.articulations.slice(h*9,h*9+3));let away=0,pmax=null;for(const p of contacts){const dist=Math.sqrt(d2(p,shoulder));if(dist>away){away=dist;pmax=p;}}const cTorso=pointsIntersections(triangles(piece.objet),thorax),cRigid=rigidArms?pointsIntersections(triangles(piece.objet),rigidArms):[];if(cTorso.length)thoraxParts++;if(cRigid.length)rigidArmParts++;for(const cp of cTorso){const dist=Math.sqrt(d2(cp,shoulder));if(!thoraxWorst||dist>thoraxWorst.distanceFromShoulderM)thoraxWorst={scene,role:piece.role,contact:cp,distanceFromShoulderM:dist};}if(away>maxAway){maxAway=away;worst={scene,role:piece.role,shoulder,contact:pmax,distanceFromShoulderM:away,contactCount:contacts.length,object:save(piece.objet),joints:Array.from(H.articulations)};}if(report.intersections.length<100)report.intersections.push({detail,scene,role:piece.role,contactCount:contacts.length,furthestContactM:away,contact:pmax});}if(hit)posesHit++;}
 report.body[detail].sweep={poses,posesWithSurfaceCrossing:posesHit,partsWithSurfaceCrossing:partsHit,thoraxPartsWithCrossing:thoraxParts,rigidArmPartsWithCrossing:rigidArmParts,thoraxWorst,maxContactDistanceFromShoulderM:maxAway,worst};
 console.error(detail,poses,posesHit,partsHit,maxAway);
}
report.limitations=['Surface crossings measured on actual renderer triangles; no reliable inside test for open detailed torso','Shoulder joint tolerance not defined here; contact distance from anchor distinguishes evidence for future bounded attachment zone','No correction and no new game captures in this diagnostic','Sphere mesh uses renderer high quality; all LOD body choices inspected but no GPU low-quality raster validation'];
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({rapport:destination,sourceSha256:report.sourceSha256,poses:['complet','moyen','simple'].reduce((n,d)=>n+report.body[d].sweep.poses,0),posesAvecIntersections:['complet','moyen','simple'].reduce((n,d)=>n+report.body[d].sweep.posesWithSurfaceCrossing,0),intersectionsParLod:Object.fromEntries(['complet','moyen','simple'].map(d=>[d,report.body[d].sweep.partsWithSurfaceCrossing]))}));
