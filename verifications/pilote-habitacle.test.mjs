// Régression cockpit extérieur : volumes rendus et triangles de carrosserie réellement posés.
// Aucun ancrage de production recopié ; les deux passages de rapports, le braquage et les LOD sont balayés.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexte = vm.createContext({ console });
for (const nom of ['carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js', 'ferro/vehicle-dynamics.js',
  'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(racine, 'src', nom), 'utf8'), contexte, { filename: nom });
const V = contexte.BITUME.voiture;
const formes = new Map(Object.values(V.FORMES).map(f => [f.nom, f.tri]));

// Distances point/segment-triangle et recherche dans un arbre de boîtes : calcul indépendant du rig.
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],scale=(v,s)=>v.map(x=>x*s),add=(a,b)=>a.map((x,i)=>x+b[i]);
const d2=(a,b)=>dot(sub(a,b),sub(a,b));
function pt2(p,t){const [a,b,c]=t,ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2_=dot(ac,ap);if(d1<=0&&d2_<=0)return d2(p,a);const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return d2(p,b);const vc=d1*d4-d3*d2_;if(vc<=0&&d1>=0&&d3<=0)return d2(p,add(a,scale(ab,d1/(d1-d3))));const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return d2(p,c);const vb=d5*d2_-d1*d6;if(vb<=0&&d2_>=0&&d6<=0)return d2(p,add(a,scale(ac,d2_/(d2_-d6))));const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return d2(p,add(b,scale(sub(c,b),(d4-d3)/((d4-d3)+(d5-d6)))));const den=1/(va+vb+vc);return d2(p,add(add(a,scale(ab,vb*den)),scale(ac,vc*den)));}
function segHit(a,b,t){const d=sub(b,a),u=sub(t[1],t[0]),v=sub(t[2],t[0]),h=cross(d,v),det=dot(u,h);if(Math.abs(det)<1e-12)return false;const s=sub(a,t[0]),x=dot(s,h)/det;if(x< -1e-9||x>1+1e-9)return false;const q=cross(s,u),y=dot(d,q)/det;if(y< -1e-9||x+y>1+1e-9)return false;const f=dot(v,q)/det;return f>=-1e-9&&f<=1+1e-9;}
const clamp=x=>Math.max(0,Math.min(1,x));
function ss2(p1,q1,p2,q2){const a1=sub(q1,p1),a2=sub(q2,p2),r=sub(p1,p2),a=dot(a1,a1),e=dot(a2,a2),f=dot(a2,r);let s,t;if(a<=1e-16&&e<=1e-16)return d2(p1,p2);if(a<=1e-16){s=0;t=clamp(f/e)}else{const c=dot(a1,r);if(e<=1e-16){t=0;s=clamp(-c/a)}else{const b=dot(a1,a2),den=a*e-b*b;s=den?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a)}else if(t>1){t=1;s=clamp((b-c)/a)}}}return d2(add(p1,scale(a1,s)),add(p2,scale(a2,t)));}
function st2(a,b,t){if(segHit(a,b,t))return 0;return Math.min(pt2(a,t),pt2(b,t),ss2(a,b,t[0],t[1]),ss2(a,b,t[1],t[2]),ss2(a,b,t[2],t[0]));}
const box=t=>({lo:[0,1,2].map(k=>Math.min(...t.map(p=>p[k]))),hi:[0,1,2].map(k=>Math.max(...t.map(p=>p[k])))});
const overlap=(a,b)=>a.lo.every((x,k)=>x<=b.hi[k]+1e-9&&a.hi[k]+1e-9>=b.lo[k]);

function build(tris){function node(entries){const lo=[0,1,2].map(k=>Math.min(...entries.map(e=>e.box.lo[k]))),hi=[0,1,2].map(k=>Math.max(...entries.map(e=>e.box.hi[k]))),out={lo,hi};if(entries.length<=12)out.entries=entries;else{const k=[0,1,2].reduce((a,k)=>hi[k]-lo[k]>hi[a]-lo[a]?k:a,0);entries.sort((a,b)=>a.box.lo[k]+a.box.hi[k]-b.box.lo[k]-b.box.hi[k]);const m=entries.length>>1;out.left=node(entries.slice(0,m));out.right=node(entries.slice(m))}return out}return node(tris.map(tri=>({tri,box:box(tri)})))}
function query(root,b,out=[]){if(!overlap(root,b))return out;if(root.entries){for(const e of root.entries)if(overlap(e.box,b))out.push(e.tri)}else{query(root.left,b,out);query(root.right,b,out)}return out}
function crossing(tris,tree){for(const t of tris){for(const u of query(tree,box(t))){for(let i=0;i<3;i++)if(st2(t[i],t[(i+1)%3],u)<=1e-20||st2(u[i],u[(i+1)%3],t)<=1e-20)return [t,u]}}return null}

let cacheTriangles = new WeakMap(), cacheBoites = new WeakMap();
function triangles(objet) {
  if (cacheTriangles.has(objet)) return cacheTriangles.get(objet);
  const source = formes.get(objet.shape);
  assert.ok(source, 'forme libre connue : ' + objet.shape);
  const m = V.euler(...objet.r);
  const resultat = source.map(t => t.slice(0, 3).map(p => V.mul(m, p.map((v, k) => v * objet.s[k])).map((v, k) => v + objet.p[k])));
  cacheTriangles.set(objet, resultat); return resultat;
}
function agrandir(b, r) { return { lo: b.lo.map(x => x - r), hi: b.hi.map(x => x + r) }; }
function capsule(objet) {
  const m = V.euler(...objet.r), r = Math.max(objet.s[0], objet.s[2]) / 2;
  const points = [-1, 1].map(s => objet.p.map((x, k) => x + s * m[1][k] * objet.s[1] / 2));
  return { points, r };
}
function cylindreTriangle(objet, tri) {
  // Cylindre fini de rayon 1/2, après transformation inverse. Il circonscrit les cylindres
  // FERRO à 6, 8 ou 16 côtés sans gonfler leurs faces comme le ferait une capsule.
  const m = V.euler(...objet.r);
  let polygone = tri.map(p => {
    const v = sub(p, objet.p);
    return [0, 1, 2].map(k => dot(v, m[k]) / objet.s[k]);
  });
  for (const signe of [-1, 1]) {
    const suivant = [];
    for (let i = 0; i < polygone.length; i++) {
      const a = polygone[i], b = polygone[(i + 1) % polygone.length];
      const da = .5 - signe * a[1], db = .5 - signe * b[1];
      if (da >= 0) suivant.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        suivant.push(a.map((v, k) => v + t * (b[k] - v)));
      }
    }
    polygone = suivant;
    if (!polygone.length) return 1; // Le triangle est au-delà d'une face du cylindre.
  }
  // La projection du triangle découpé sur x/z est convexe. Sa distance au centre donne
  // son intersection avec le disque ; les projections aplaties restent des segments.
  let minimum = Infinity, positif = false, negatif = false, aire = 0;
  for (let i = 0; i < polygone.length; i++) {
    const a = polygone[i], b = polygone[(i + 1) % polygone.length];
    const x = b[0] - a[0], z = b[2] - a[2], n = x * x + z * z;
    const t = n ? clamp(-(a[0] * x + a[2] * z) / n) : 0;
    minimum = Math.min(minimum, (a[0] + t * x) ** 2 + (a[2] + t * z) ** 2);
    const c = a[0] * b[2] - a[2] * b[0]; aire += c;
    if (c > 1e-12) positif = true;
    if (c < -1e-12) negatif = true;
  }
  if (Math.abs(aire) > 1e-12 && positif !== negatif) minimum = 0;
  return (Math.sqrt(minimum) - .5) * Math.min(objet.s[0], objet.s[2]);
}
function ellipsoideTriangle(objet, tri) {
  const m = V.euler(...objet.r);
  const local = tri.map(p => {
    const v = sub(p, objet.p);
    return [0, 1, 2].map(k => dot(v, m[k]) / objet.s[k]);
  });
  return (Math.sqrt(pt2([0, 0, 0], local)) - .5) * Math.min(...objet.s);
}
function degagement(objet, arbre, marge = .001) {
  if (objet.shape === 'cylinder') {
    // Capsule pour éliminer rapidement les triangles lointains ; cylindre fini pour le verdict.
    const { points, r } = capsule(objet), candidats = query(arbre, agrandir(box(points), r + marge));
    return candidats.length ? Math.min(...candidats.map(t => cylindreTriangle(objet, t))) : marge;
  }
  if (objet.shape === 'sphere') {
    // Sphère pour les candidats ; ellipsoïde fini qui circonscrit la sphère FERRO mise à l'échelle.
    const r = Math.max(...objet.s) / 2, candidats = query(arbre, agrandir(box([Array.from(objet.p)]), r + marge));
    return candidats.length ? Math.min(...candidats.map(t => ellipsoideTriangle(objet, t))) : marge;
  }
  let borne = cacheBoites.get(objet);
  if (!borne) {
    const m = V.euler(...objet.r), coins = [];
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5])
      coins.push(V.mul(m, [x * objet.s[0], y * objet.s[1], z * objet.s[2]]).map((v, k) => v + objet.p[k]));
    borne = box(coins); cacheBoites.set(objet, borne);
  }
  if (!query(arbre, borne).length) return marge;
  return crossing(triangles(objet), arbre) ? -1 : marge;
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
  return piecesCoque[detail].map(nom => {
    const objet = sortie.find(o => o.shape === 'bitume-' + nom || o.shape === 'bitume-' + nom + '-pilote');
    assert.ok(objet, 'pièce de cockpit toujours présente : ' + nom);
    return { nom, arbre: build(triangles(objet)) };
  });
}
const etapes = [0, .08, .15, .25, .3, .45, .5, .65, .75, .85, .93, 1];
const passages = [[-1, 0], [0, -1], [0, 1], [1, 0]];
for (let n = 1; n < 6; n++) passages.push([n, n + 1], [n + 1, n]);

// Ces cas empêchent le contrôleur lui-même de prendre un croisement pour un succès.
test('le contrôleur distingue traversée, séparation et simple proximité', () => {
  const t = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  assert.equal(st2([.2, .2, -1], [.2, .2, 1], t), 0);
  assert.ok(Math.abs(st2([.2, .2, 1], [.2, .2, 2], t) - 1) < 1e-12);
  assert.ok(crossing([[[.2, .2, -1], [.2, .2, 1], [.3, .2, 1]]], build([t])));
  assert.equal(crossing([[[.2, .2, .1], [.3, .2, .1], [.2, .3, .1]]], build([t])), null);
  assert.ok(crossing([[[.2, .2, 0], [.3, .2, 0], [.2, .3, 0]]], build([t])), 'recouvrement coplanaire détecté');
  assert.equal(crossing([[[2, 2, 0], [3, 2, 0], [2, 3, 0]]], build([t])), null);
  const cylindre = { p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0] };
  assert.ok(cylindreTriangle(cylindre, [[.4, -.4, 0], [.4, .4, 0], [.6, .4, 0]]) < 0, 'traversée du flanc');
  assert.ok(cylindreTriangle(cylindre, [[-1, .49, -1], [1, .49, -1], [0, .49, 1]]) < 0, 'triangle couvrant une face');
  assert.ok(cylindreTriangle(cylindre, [[-1, .51, -1], [1, .51, -1], [0, .51, 1]]) > 0, 'au-delà de la face, malgré la capsule');
  assert.ok(cylindreTriangle(cylindre, [[.6, -.4, 0], [.6, .4, 0], [.8, .4, 0]]) > 0, 'séparation radiale');
  const ellipsoide = { p: [0, 0, 0], s: [1, .2, .4], r: [0, 0, 0] };
  assert.ok(ellipsoideTriangle(ellipsoide, [[-1, .09, -1], [1, .09, -1], [0, .09, 1]]) < 0, 'traversée de l’ellipsoïde');
  assert.ok(ellipsoideTriangle(ellipsoide, [[-1, .11, -1], [1, .11, -1], [0, .11, 1]]) > 0, 'hors de l’ellipsoïde mais dans sa sphère');
});

test('volant, levier, gants et bras restent séparés des triangles du cockpit pendant les passages', () => {
  const modele = creer(), ev = pose(), obstacle = coque(dessiner(modele, ev).sortie);
  let poses = 0;
  for (const volant of [-1, -.5, 0, .5, 1]) for (const [rapportAvant, rapport] of passages) for (const passage of etapes) {
    Object.assign(ev.pilote, { volant, rapportAvant, rapport, passage });
    const { pieces } = dessiner(modele, ev);
    for (const piece of pieces) {
      if (!(piece.source || piece.de !== undefined || piece.joint !== undefined)) continue;
      for (const { nom, arbre } of obstacle) {
        const jeu = degagement(piece.objet, arbre);
        assert.ok(jeu >= -1e-8, `${piece.role}/${nom} traverse : jeu=${jeu}, volant=${volant}, ${rapportAvant}→${rapport}, passage=${passage}`);
      }
    }
    poses++;
  }
  console.log('cockpit : ' + poses + ' poses, commandes/gants/bras sans traversée des cinq maillages');
});

test('la jante laisse au moins huit centimètres devant le buste rendu', () => {
  const modele = creer(), ev = pose();
  let minimum = Infinity;
  for (const volant of [-1, -.5, 0, .5, 1]) {
    ev.pilote.volant = volant;
    const { pieces, sortie } = dessiner(modele, ev);
    const volantObjet = pieces.find(p => p.role === 'volant').objet;
    const buste = sortie.find(o => o.shape === 'bitume-pilote-buste');
    assert.ok(buste, 'buste humain conservé');
    const avantBuste = Math.max(...triangles(buste).flat().map(p => p[0]));
    const arriereVolant = Math.min(...triangles(volantObjet).flat().map(p => p[0]));
    minimum = Math.min(minimum, arriereVolant - avantBuste);
  }
  assert.ok(minimum >= .08, 'jeu longitudinal jante/buste insuffisant : ' + minimum);
  console.log('cockpit : jeu longitudinal jante/buste minimal = ' + minimum.toFixed(6) + ' m');
});

test('joueur et rival, LOD et attitude de caisse conservent les dégagements des commandes', () => {
  const joueur = creer(27), rival = creer(12), ev = pose();
  Object.assign(ev, { p: [3, 2, -4], cap: .8, tangage: .3, roulis: -.25 });
  let poses = 0;
  for (const modele of [joueur, rival]) {
    for (const detail of ['complet', 'moyen', 'simple']) {
      // Chaque LOD doit être mesuré contre sa propre carrosserie : le simple n'a pas de saute-vent,
      // mais possède un dessus fermé qui n'existe pas dans le modèle complet.
      const obstacle = coque(dessiner(modele, ev, detail).sortie, detail);
      for (const volant of [-1, -.5, 0, .5, 1]) for (const passage of [0, .15, .5, .85, 1]) {
        Object.assign(ev.pilote, { volant, rapportAvant: 4, rapport: 3, passage });
        const { pieces } = dessiner(modele, ev, detail);
        for (const piece of pieces) {
          if (!(piece.source || piece.de !== undefined || piece.joint !== undefined)) continue;
          for (const { nom, arbre } of obstacle)
            assert.ok(degagement(piece.objet, arbre) >= -1e-8, `${detail}/${piece.role}/${nom}, volant=${volant}, passage=${passage}`);
        }
        poses++;
      }
    }
  }
  console.log('cockpit : ' + poses + ' poses joueur/rival, trois LOD, braquages extrêmes et attitude composée');
});
