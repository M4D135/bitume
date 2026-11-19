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
for (const nom of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js', 'ferro/vehicle-dynamics.js',
  'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(racine, 'src', nom), 'utf8'), contexte, { filename: nom });
const V = contexte.BITUME.voiture;
const formes = new Map(Object.values(V.FORMES).map(f => [f.nom, f.tri]));
const primitives = new Map([['cylinder', []], ['sphere', []]]);
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
      if (segHit(t[i], t[(i + 1) % 3], u) || segHit(u[i], u[(i + 1) % 3], t)) return [t, u];
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
  if (objet.shape === 'cylinder') {
    // Capsule circonscrite au cylindre : un succès garantit la séparation du cylindre réel.
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
const piecesCoque = ['goutte', 'goutte-dedans', 'jonc', 'bulle', 'cuve'];
function coque(sortie) {
  const obstacles = piecesCoque.map(nom => {
    const objet = sortie.find(o => o.shape === 'bitume-' + nom || (nom === 'bulle' && o.shape === 'bitume-bulle-pilote'));
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

// Ces cas empêchent le contrôleur lui-même de prendre un croisement pour un succès.
test('le contrôleur distingue traversée, séparation et simple proximité', () => {
  const t = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  assert.equal(st2([.2, .2, -1], [.2, .2, 1], t), 0);
  assert.ok(Math.abs(st2([.2, .2, 1], [.2, .2, 2], t) - 1) < 1e-12);
  assert.ok(crossing([[[.2, .2, -1], [.2, .2, 1], [.3, .2, 1]]], build([t])));
  assert.equal(crossing([[[.2, .2, .1], [.3, .2, .1], [.2, .3, .1]]], build([t])), null);
});

test('la tige du levier ne traverse plus le carénage à son pied', () => {
  const modele = creer(), ev = pose(), obstacle = coque(dessiner(modele, ev).sortie);
  for (const [rapportAvant, rapport] of passages) for (const passage of etapes) {
    Object.assign(ev.pilote, { rapportAvant, rapport, passage });
    const { pieces } = dessiner(modele, ev);
    for (const role of ['levier', 'pommeau']) for (const { nom, arbre } of obstacle) {
      if (role === 'levier' && nom === 'console-levier') continue; // liaison mécanique vérifiée séparément
      assert.ok(!traversee(pieces.find(p => p.role === role).objet, arbre), `${role}/${nom}, ${rapportAvant}→${rapport}, passage=${passage}`);
    }
  }
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
        if (piece.role === 'levier' && nom === 'console-levier') continue; // deux millimètres sertis au pied
        assert.ok(!traversee(piece.objet, arbre), `${piece.role}/${nom} traverse : volant=${volant}, ${rapportAvant}→${rapport}, passage=${passage}`);
      }
    }
    poses++;
  }
  console.log('cockpit : ' + poses + ' poses, commandes/gants/bras sans traversée de la coque ni du support (ancrage de tige exclu)');
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
  for (const modele of [joueur, rival]) {
    const obstacle = coque(dessiner(modele, ev).sortie);
    for (const detail of ['complet', 'moyen', 'simple']) for (const passage of [0, .15, .5, .85, 1]) {
      Object.assign(ev.pilote, { volant: -.8, rapportAvant: 4, rapport: 3, passage });
      const { pieces } = dessiner(modele, ev, detail);
      for (const piece of pieces) {
        if (!['volant', 'levier', 'pommeau'].includes(piece.role) && !piece.role.startsWith('gant-')) continue;
        for (const { nom, arbre } of obstacle) {
          if (piece.role === 'levier' && nom === 'console-levier') continue;
          assert.ok(!traversee(piece.objet, arbre), `${detail}/${piece.role}/${nom}, passage=${passage}`);
        }
      }
    }
  }
});

test('le levier est fixé dans une console jointe à la cuve, seul son pied est serti', () => {
  const modele = creer(), ev = pose(), reference = dessiner(modele, ev), obstacle = coque(reference.sortie);
  const cuveArbre = build(triangles(reference.sortie.find(o => o.shape === 'bitume-cuve')));
  for (const detail of ['complet', 'moyen', 'simple']) for (const passage of [0, .5, 1]) {
    ev.pilote.passage = passage;
    const { pieces, sortie } = dessiner(modele, ev, detail);
    const support = pieces.find(p => p.role === 'console-levier');
    const tige = pieces.find(p => p.role === 'levier');
    assert.ok(support && tige, detail + ' : ni console ni tige supprimée');
    const supportTriangles = triangles(support.objet), arbre = build(supportTriangles);
    assert.ok(crossing(supportTriangles, cuveArbre), 'console rattachée au fond dessiné');
    for (const { nom, arbre: coqueArbre } of obstacle) {
      if (nom === 'cuve' || nom === 'console-levier') continue;
      assert.ok(!traversee(support.objet, coqueArbre), 'console ne traverse pas ' + nom);
    }
    const { points } = capsule(tige.objet);
    points.sort((a, b) => a[1] - b[1]);
    const [pied, haut] = points;
    const distancePied = Math.sqrt(Math.min(...supportTriangles.map(t => pt2(pied, t))));
    assert.ok(distancePied <= .004, 'pied à moins de 4 mm du support : ' + distancePied);
    const d = Math.sqrt(d2(pied, haut)), libre = add(pied, scale(sub(haut, pied), .006 / d));
    const tigeLibre = { ...tige.objet, p: add(libre, scale(sub(haut, libre), .5)), s: Array.from(tige.objet.s) };
    tigeLibre.s[1] = d - .006;
    assert.ok(!traversee(tigeLibre, arbre), 'hors des six premiers millimètres, tige libre du support');
    for (const piece of pieces) {
      if (piece.role === 'console-levier' || piece.role === 'levier' || piece.role === 'buste') continue;
      assert.ok(!traversee(piece.objet, arbre), piece.role + ' libre de la console');
    }
  }
});
