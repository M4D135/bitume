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
  complet: ['goutte', 'goutte-dedans', 'jonc', 'bulle', 'cuve', 'assise-pilote', 'siege-supports'],
  moyen: ['goutte', 'cuve', 'assise-pilote', 'siege-supports'],
  simple: ['loin-caisse', 'loin-dessus', 'loin-quille', 'cuve', 'assise-pilote', 'siege-supports']
};
function coque(sortie, detail = 'complet') {
  const obstacles = piecesCoque[detail].map(nom => {
    const objet = sortie.find(o => o.shape === 'bitume-' + nom || o.shape === 'bitume-' + nom + '-pilote');
    assert.ok(objet, 'pièce de cockpit toujours présente : ' + nom);
    return { nom, arbre: build(triangles(objet)) };
  });
  // Le dossier et ses détails sont des obstacles réels pour les membres. Leur
  // appui sur le dos est qualifié séparément, à partir du thorax fermé rendu.
  for (const nom of ['siege-dossier', 'siege-stries', 'siege-coutures']) {
    const objet = sortie.find(o => o.shape === 'bitume-' + nom);
    if (objet) obstacles.push({ nom, arbre: build(triangles(objet)) });
  }
  const consoleLevier = sortie.find(o => o.shape === 'bitume-console-levier-pilote');
  if (consoleLevier) obstacles.push({ nom: 'console-levier', arbre: build(triangles(consoleLevier)) });
  return obstacles;
}
const etapes = [0, .08, .15, .25, .3, .45, .5, .65, .75, .85, .93, 1];
const passages = [[-1, 0], [0, -1], [0, 1], [1, 0]];
for (let n = 1; n < 6; n++) passages.push([n, n + 1], [n + 1, n]);

test('volant fixé : moyeu, arbre, palier, planche et cuve sont réellement reliés dans les trois LOD', () => {
  const modele = creer(), ev = pose();
  let reference = null;
  for (const detail of ['complet', 'moyen', 'simple']) for (const volant of [-1, 0, 1]) {
    ev.pilote.volant = volant;
    const { pieces, sortie } = dessiner(modele, ev, detail), piece = role => pieces.find(p => p.role === role).objet;
    const fixes = ['planche', 'casquette', ...[0, 1, 2, 3, 4].map(n => 'support-volant-' + n)];
    const etatFixe = JSON.stringify(fixes.map(role => { const o = piece(role); return [o.shape, ...['p', 's', 'r'].map(k => Array.from(o[k]))]; }));
    if (reference === null) reference = etatFixe; else assert.equal(etatFixe, reference, 'les supports restent fixes malgré le braquage et le LOD');
    const colonne = triangles(piece('support-volant-0')), palier = triangles(piece('support-volant-1'));
    const planche = build(triangles(piece('planche'))), cuve = build(triangles(sortie.find(o => o.shape === 'bitume-cuve')));
    assert.ok(crossing(colonne, build(triangles(piece('moyeu-0')))), 'arbre serti dans le moyeu');
    assert.ok(crossing(colonne, build(palier)), 'arbre dans le palier');
    assert.ok(crossing(palier, planche), 'palier rejoint la planche');
    assert.ok(crossing(triangles(piece('support-volant-2')), planche), 'platine réellement fixée à la planche');
    for (const role of ['support-volant-3', 'support-volant-4']) {
      const montant = triangles(piece(role));
      assert.ok(crossing(montant, planche), role + ' rejoint la planche');
      assert.ok(crossing(montant, cuve), role + ' rejoint le fond visible dans le LOD ' + detail);
    }
  }
});

test('rétroviseurs communs : chaque patte relie son boîtier à la carrosserie dans les trois LOD', () => {
  const modele = creer(), ev = pose();
  for (const detail of ['complet', 'moyen', 'simple']) {
    const { pieces, sortie } = dessiner(modele, ev, detail), obstacles = coque(sortie, detail);
    for (let k = 0; k < 2; k++) {
      const piece = role => pieces.find(p => p.role === role + '-' + k).objet;
      const patte = triangles(piece('retro-patte'));
      assert.ok(crossing(patte, build(triangles(piece('retro-boitier')))), `patte du rétro ${k} fixée à son boîtier en ${detail}`);
      assert.ok(obstacles.some(o => crossing(patte, o.arbre)), `patte du rétro ${k} fixée à la carrosserie en ${detail}`);
    }
  }
});

test('assise basse : appui du thorax, coussin, traverses et fond de cuve forment une liaison réelle', () => {
  const modele = creer(), ev = pose();
  for (const detail of ['complet', 'moyen', 'simple']) {
    const { sortie } = dessiner(modele, ev, detail);
    const trouver = nom => sortie.find(o => o.shape === 'bitume-' + nom);
    const torse = triangles(sortie.find(o => /^bitume-pilote-buste(?:-|$)/.test(o.shape)));
    const assise = triangles(trouver('assise-pilote')), supports = triangles(trouver('siege-supports'));
    const fond = build(triangles(trouver('cuve'))), bas = Math.min(...torse.flat().map(p => p[1]));
    const bordInferieur = torse.flat().filter(p => Math.abs(p[1] - bas) < 1e-8);
    const appui = [0, 1, 2].map(k => (Math.min(...bordInferieur.map(p => p[k])) + Math.max(...bordInferieur.map(p => p[k]))) / 2);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(appui[k] - V.PILOTE_ASSISE[k]) < 1e-8, 'repère d’assise mesuré sur le bas affiché du thorax');
    assert.ok(Math.min(...assise.map(t => pt2(appui, t))) < 1e-16, 'le coussin porte le point d’appui réel');
    assert.ok(Math.max(...assise.flat().map(p => p[1])) <= bas + 1e-8, 'le coussin reste sous la peau du thorax');
    assert.ok(crossing(assise, build(torse)), 'thorax au contact du coussin');
    assert.ok(crossing(supports, build(assise)), 'traverses fixées sous le coussin');
    assert.ok(crossing(supports, fond), 'traverses fixées au vrai fond de cuve');
    assert.ok(Math.max(...supports.flat().map(p => p[1])) < bas - .02, 'les supports restent sous le thorax');
    assert.ok(bas < .30 && bas > .24, 'appui physiquement bas dans la cellule');
  }
});

test('gestes : surfaces des mains et bras sans traversée de la coque, du casque ni de la direction', () => {
  const modele = creer(), ev = pose();
  const reference = dessiner(modele, ev), obstacles = coque(reference.sortie);
  for (const p of reference.pieces.filter(p => p.role === 'planche' || p.role === 'casquette' || p.role.startsWith('support-volant-') || p.role.startsWith('moyeu-')))
    obstacles.push({ nom: p.role, arbre: build(triangles(p.objet)) });
  let poses = 0;
  for (const geste of ['majeur', 'poing', 'salut']) for (const gesteCote of [-1, 1]) for (const volant of [-1, -.5, 0, .5, 1])
    for (const regard of Math.abs(volant) === 1 ? [-.32, 0, .32] : [0]) {
    Object.assign(ev.pilote, { volant, regard, geste, gesteCote, gestePhase: .43 });
    const rendu = dessiner(modele, ev), obstaclesPose = obstacles.slice();
    for (const nom of ['pilote-casque', 'pilote-visiere']) {
      const o = rendu.sortie.find(o => o.shape === 'bitume-' + nom);
      if (o) obstaclesPose.push({ nom, arbre: build(triangles(o)) });
    }
    const jante = build(triangles(modele.objetsRendu.pilote.variantes[0].pieces.find(p => p.role === 'volant').objet));
    for (const gesteIntensite of regard === 0 ? [0, .03, .06, .10, .14, .20, .26, .36, .44, .50, .60, .70, .80, .90, 1] : [.44, .50, .60, .70, .80, .90, 1]) {
      ev.pilote.gesteIntensite = gesteIntensite;
      const { pieces } = dessiner(modele, ev);
      for (const piece of pieces.filter(p => /^(gant|epaule|bras|avant-bras|manche-joint|coude)-/.test(p.role))) {
        for (const { nom, arbre } of obstaclesPose)
          assert.ok(!traversee(piece.objet, arbre), `${piece.role}/${nom} : ${geste}, côté=${gesteCote}, volant=${volant}, intensité=${gesteIntensite}`);
        if (piece.role.startsWith('gant-')) assert.ok(!traversee(piece.objet, jante), `${piece.role}/jante : ${geste}, côté=${gesteCote}, volant=${volant}, intensité=${gesteIntensite}`);
      }
      poses++;
    }
  }
  console.log('gestes : ' + poses + ' poses, surfaces Float32 des mains/bras et obstacles réellement affichés');
});

test('un rapport interrompt le geste sans téléporter les poignets ni traverser le cockpit', () => {
  const X = contexte.BITUME.expressionsPilote, modele = creer(), graines = new Map();
  function seance(cote, graine) {
    const co = { phase: 'course', termine: false, voitures: [0, 1].map(id => ({ id, progression: 100,
      tPassage: -100, etat: { v: 30, rapport: 3 } })) };
    const poses = [{ x: 100, y: 0, z: 0, cap: 0 }, { x: 100, y: 0, z: cote * 3, cap: 0 }], E = X.creer(2, graine);
    X.actualiser(E, co, poses, 0); X.demander(E, 0, true); X.demander(E, 0, false);
    return { co, poses, E };
  }
  function avancer(s, t) {
    s.co.voitures.forEach((v, i) => { v.progression = 100 + t * 30; s.poses[i].x = v.progression; });
    X.actualiser(s.E, s.co, s.poses, t);
  }
  for (let graine = 1; graines.size < 3 && graine <= 128; graine++) {
    const s = seance(-1, graine); avancer(s, 1 / 120);
    graines.set(X.lire(s.E, 0).geste, graine);
  }
  assert.equal(graines.size, 3, 'les trois vrais tirages manuels sont exercés');
  let controles = 0, sautInitial = 0, pasMaximum = 0, demiPasMaximum = 0;
  for (const [geste, graine] of graines) for (const cote of [-1, 1]) for (const volant of [-1, 0, 1]) {
    const s = seance(cote, graine), ev = pose();
    ev.pilote.volant = volant; ev.pilote.rapportAvant = ev.pilote.rapport = 3;
    for (let n = 1; n <= 60; n++) avancer(s, n / 120);
    X.lire(s.E, 0, ev.pilote);
    assert.equal(ev.pilote.geste, geste); assert.equal(ev.pilote.gesteCote, cote); assert.equal(ev.pilote.gesteIntensite, 1);
    const reference = dessiner(modele, ev), obstacles = coque(reference.sortie);
    for (const p of reference.pieces.filter(p => p.role === 'planche' || p.role === 'casquette' || p.role.startsWith('support-volant-') || p.role.startsWith('moyeu-')))
      obstacles.push({ nom: p.role, arbre: build(triangles(p.objet)) });
    const jante = build(triangles(reference.pieces.find(p => p.role === 'volant').objet));
    let avant = Array.from(modele.objetsRendu.habitacle.articulations);
    const debut = .5 + 1e-5;
    s.co.voitures[0].etat.rapport = 4; s.co.voitures[0].tPassage = debut;
    ev.pilote.rapport = 4;
    for (let n = 0; n <= 44; n++) {
      const t = debut + n / 120;
      let milieu = null;
      if (n > 0) {
        const demiTemps = t - 1 / 240;
        avancer(s, demiTemps); X.lire(s.E, 0, ev.pilote); ev.pilote.passage = Math.min(1, (demiTemps - debut) / .36);
        V.poser(modele, ev, []); milieu = Array.from(modele.objetsRendu.habitacle.articulations);
      }
      avancer(s, t); X.lire(s.E, 0, ev.pilote); ev.pilote.passage = Math.min(1, (t - debut) / .36);
      const rendu = dessiner(modele, ev), H = modele.objetsRendu.habitacle;
      for (const j of [3, 6, 12, 15]) {
        const delta = Math.sqrt(d2(Array.from(H.articulations.slice(j, j + 3)), avant.slice(j, j + 3)));
        if (n === 0) { sautInitial = Math.max(sautInitial, delta); assert.ok(delta < .001, 'coude ou poignet téléporté au déclenchement : ' + delta); }
        else {
          pasMaximum = Math.max(pasMaximum, delta);
          demiPasMaximum = Math.max(demiPasMaximum, Math.sqrt(d2(milieu.slice(j, j + 3), avant.slice(j, j + 3))),
            Math.sqrt(d2(milieu.slice(j, j + 3), Array.from(H.articulations.slice(j, j + 3)))));
        }
      }
      avant = Array.from(H.articulations);
      const mobiles = ['pilote-casque', 'pilote-visiere'].map(nom => ({ nom,
        arbre: build(triangles(rendu.sortie.find(o => o.shape === 'bitume-' + nom))) }));
      mobiles.push({ nom: 'pommeau', arbre: build(triangles(rendu.pieces.find(p => p.role === 'pommeau').objet)) });
      for (const piece of rendu.pieces.filter(p => /^(gant|epaule|bras|avant-bras|manche-joint|coude)-/.test(p.role))) {
        for (const { nom, arbre } of obstacles.concat(mobiles))
          assert.ok(!traversee(piece.objet, arbre), `${piece.role}/${nom} : geste=${geste}, côté=${cote}, volant=${volant}, retour=${n}/120`);
        if (piece.role.startsWith('gant-')) assert.ok(!traversee(piece.objet, jante), `${piece.role}/jante : geste=${geste}, côté=${cote}, volant=${volant}, retour=${n}/120`);
      }
      if (n >= 18) assert.equal(ev.pilote.geste, null, 'le rapport rend effectivement la main au levier');
      controles++;
    }
    assert.equal(s.E.pilotes[0].gestesManuels, 1, 'aucun nouveau geste déclenché pendant le passage');
  }
  assert.ok(demiPasMaximum < pasMaximum * .65, 'un saut ne décroît pas quand le pas est divisé par deux');
  console.log('transition geste/rapport : ' + controles + ' poses, coudes et poignets, saut initial=' + sautInitial + ' m, pas maximal 120/240 Hz=' + pasMaximum + '/' + demiPasMaximum + ' m');
});

// Ces cas empêchent le contrôleur lui-même de prendre un croisement pour un succès.
test('le contrôleur distingue traversée, séparation et simple proximité', () => {
  const t = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  assert.equal(st2([.2, .2, -1], [.2, .2, 1], t), 0);
  assert.ok(Math.abs(st2([.2, .2, 1], [.2, .2, 2], t) - 1) < 1e-12);
  assert.ok(crossing([[[.2, .2, -1], [.2, .2, 1], [.3, .2, 1]]], build([t])));
  assert.equal(crossing([[[.2, .2, .1], [.3, .2, .1], [.2, .3, .1]]], build([t])), null);
  assert.ok(crossing([[[.2, .2, 0], [.3, .2, 0], [.2, .3, 0]]], build([t])), 'recouvrement coplanaire détecté');
  assert.equal(crossing([[[2, 2, 0], [3, 2, 0], [2, 3, 0]]], build([t])), null);
});

test('les surfaces de tous les éléments des mains se dégagent de la jante pendant le passage', () => {
  const modele = creer(), ev = pose();
  // Dépliage, retrait, trajet, prise et retour : les transitions de doigts sont contrôlées avant le recul.
  const phases = [0, .04, .08, .10, .12, .14, .20, .24, .3, .4, .5, .7, .8, .86, .90, .92, .94, .97, 1];
  let poses = 0;
  for (const volant of [-1, -.5, 0, .5, 1]) {
    ev.pilote.volant = volant;
    V.cockpit(modele, ev, [], { ...ev.pilote, regime: 9000, kmh: 140 });
    cacheTriangles = new WeakMap();
    const H = modele.objetsRendu.habitacle, arbre = build(triangles(H.jante.objet));
    for (const [rapportAvant, rapport] of [[2, 3], [4, 5], [6, 5], [-1, 0]]) for (const passage of phases) {
      Object.assign(ev.pilote, { rapportAvant, rapport, passage });
      V.cockpit(modele, ev, [], { ...ev.pilote, regime: 9000, kmh: 140 });
      cacheTriangles = new WeakMap(); cacheBoites = new WeakMap();
      for (const main of H.mains) for (const piece of main.pieces)
        assert.ok(!traversee(piece.objet, arbre), `${piece.objet.shape}/jante : volant=${volant}, ${rapportAvant}→${rapport}, passage=${passage}, main=${main.k}`);
      poses++;
    }
  }
  assert.equal(poses, 380);
  console.log('mains/jante : ' + poses + ' poses, surfaces Float32 de chaque gant/paume/garde/manchette/sangle');
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
      if (piece.role.startsWith('support-volant-') || piece.role.startsWith('retro-patte-')) continue; // fixations à la coque, contrôlées par leurs tests de liaison
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
  let poses = 0;
  for (const modele of [joueur, rival]) for (const detail of ['complet', 'moyen', 'simple']) {
    // Les obstacles viennent des objets affichés dans CE niveau de détail. Le dessus lointain
    // est une autre carène : les triangles du modèle complet ne prouvent pas son dégagement.
    const obstacle = coque(dessiner(modele, ev, detail).sortie, detail);
    for (const volant of [-1, -.5, 0, .5, 1]) for (const passage of [0, .15, .5, .85, 1]) {
      Object.assign(ev.pilote, { volant, rapportAvant: 4, rapport: 3, passage });
      const { pieces } = dessiner(modele, ev, detail);
      for (const piece of pieces) {
        if (!(piece.source || piece.de !== undefined || piece.joint !== undefined)) continue;
        if (piece.role.startsWith('support-volant-') || piece.role.startsWith('retro-patte-')) continue; // pièces fixes de liaison, testées séparément
        for (const { nom, arbre } of obstacle) {
          if (piece.role === 'levier' && nom === 'console-levier') continue;
          assert.ok(!traversee(piece.objet, arbre), `${detail}/${piece.role}/${nom}, volant=${volant}, passage=${passage}`);
        }
      }
      poses++;
    }
  }
  console.log('cockpit : ' + poses + ' poses joueur/rival, trois coques réellement affichées, braquages extrêmes et attitude composée');
});

test('le levier est fixé dans une console jointe à la cuve, seul son pied est serti', () => {
  const modele = creer(), ev = pose(), reference = dessiner(modele, ev), obstacle = coque(reference.sortie);
  const cuveArbre = build(triangles(reference.sortie.find(o => o.shape === 'bitume-cuve')));
  for (const detail of ['complet', 'moyen', 'simple']) for (const passage of [0, .5, 1]) {
    ev.pilote.passage = passage;
    const { pieces, sortie } = dessiner(modele, ev, detail);
    const obstaclesAffiches = coque(sortie, detail);
    const support = pieces.find(p => p.role === 'console-levier');
    const tige = pieces.find(p => p.role === 'levier');
    assert.ok(support && tige, detail + ' : ni console ni tige supprimée');
    const supportTriangles = triangles(support.objet), arbre = build(supportTriangles);
    assert.ok(crossing(supportTriangles, cuveArbre), 'console rattachée à la cuve de référence');
    const fondAffiche = obstaclesAffiches.find(o => o.nom === 'cuve');
    assert.ok(fondAffiche && crossing(supportTriangles, fondAffiche.arbre), detail + ' : console rattachée au fond réellement affiché');
    for (const { nom, arbre: coqueArbre } of obstacle) {
      if (nom === 'cuve' || nom === 'console-levier') continue;
      assert.ok(!traversee(support.objet, coqueArbre), 'console ne traverse pas ' + nom);
    }
    for (const { nom, arbre: coqueArbre } of obstaclesAffiches) {
      if (nom === 'cuve' || nom === 'loin-caisse' || nom === 'console-levier') continue;
      assert.ok(!traversee(support.objet, coqueArbre), detail + ' : console ne traverse pas ' + nom);
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
