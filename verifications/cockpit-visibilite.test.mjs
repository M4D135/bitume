// Visibilité géométrique, pas projection du seul horizon. Les triangles sont ceux
// préparés par FERRO et les objets ceux réellement rendus, sans déplacement de caméra.
// Témoin ancien : BITUME_VISIBILITE_RACINE=/chemin/ancien node ce-fichier.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const racine = process.env.BITUME_VISIBILITE_RACINE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexte = vm.createContext({ console });
vm.runInContext('globalThis.window = globalThis;', contexte);
for (const f of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'cockpit-matieres.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(racine, 'src', f), 'utf8'), contexte, { filename: f });
const B = contexte.BITUME, V = B.voiture, geometrie = contexte.FRender.shared.geometry(false);
const source = fs.readFileSync(path.join(racine, 'src/jeu.js'), 'utf8');
console.log('visibilité — sources ' + ['voiture.js', 'jeu.js'].map(f => f + ':' +
  createHash('sha256').update(fs.readFileSync(path.join(racine, 'src', f))).digest('hex')).join(' '));
const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const bornes = points => ({ min: [0, 1, 2].map(k => Math.min(...points.map(p => p[k]))),
  max: [0, 1, 2].map(k => Math.max(...points.map(p => p[k]))) });
const formes = new Map();
function triangles(o) {
  if (!formes.has(o.shape)) {
    const r = geometrie.ranges[o.shape], t = [];
    assert(r, 'forme réellement enregistrée : ' + o.shape);
    for (let j = r.offset / 4; j < r.offset / 4 + r.count; j += 3)
      t.push([0, 1, 2].map(k => Array.from(geometrie.vertices.slice(geometrie.indices[j + k] * 6, geometrie.indices[j + k] * 6 + 3))));
    formes.set(o.shape, t);
  }
  const m = V.euler(...o.r);
  return formes.get(o.shape).map(t => t.map(q => [0, 1, 2].map(i =>
    o.p[i] + m[0][i] * q[0] * o.s[0] + m[1][i] * q[1] * o.s[1] + m[2][i] * q[2] * o.s[2])));
}
// Möller–Trumbore double face : un triangle opaque traversé masque ce rayon.
function traverse(a, b, t) {
  const d = sub(b, a), u = sub(t[1], t[0]), v = sub(t[2], t[0]), h = cross(d, v), det = dot(u, h);
  if (Math.abs(det) < 1e-12) return false;
  const s = sub(a, t[0]), x = dot(s, h) / det, q = cross(s, u), y = dot(d, q) / det, f = dot(v, q) / det;
  return x >= -1e-9 && y >= -1e-9 && x + y <= 1 + 1e-9 && f > 1e-9 && f < 1 - 1e-9;
}
function extraire(nom) {
  const debut = source.indexOf('  function ' + nom + '('), fin = source.indexOf('\n  }', debut);
  assert(debut >= 0 && fin > debut, 'fonction de cadrage réelle : ' + nom);
  return source.slice(debut, fin + 4);
}
const inclinaison = source.match(/^  const INCLINAISON_COCKPIT = [^\n]+;/m); assert(inclinaison);
const camera = new Function('B', 'canvas', 'reglages', 'estTactile', `
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), PORTEE_VUE = 6000;
  ${inclinaison[0]} ${extraire('champCockpit')} ${extraire('cameraCockpit')}
  return cameraCockpit;`);
function projeter(q, cam, largeur, hauteur) {
  const [x, y, z] = sub(q, cam.pos), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const profondeur = x * sy * cp + y * sp - z * cy * cp;
  const droite = x * cy + z * sy, haut = -x * sy * sp + y * cp + z * cy * sp;
  const t = Math.tan(cam.fov * Math.PI / 360), cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
  return [(largeur + (droite * cr + haut * sr) * hauteur / (profondeur * t)) / 2,
    (hauteur - (haut * cr - droite * sr) * hauteur / (profondeur * t)) / 2, profondeur];
}
function enveloppe(points) {
  const p = [...new Map(points.map(q => [q[0] + ',' + q[1], q])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cote = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const chaine = a => { const h = []; for (const q of a) { while (h.length > 1 && cote(h.at(-2), h.at(-1), q) <= 0) h.pop(); h.push(q); } return h.slice(0, -1); };
  return [...chaine(p), ...chaine([...p].reverse())];
}
// Axes séparateurs : un intervalle d'au moins 2 px évite même le contact de bords.
function separes(a, b, marge = 2) {
  for (const polygone of [a, b]) for (let i = 0; i < polygone.length; i++) {
    const p = polygone[i], q = polygone[(i + 1) % polygone.length], n = [q[1] - p[1], p[0] - q[0]], longueur = Math.hypot(...n);
    if (longueur < 1e-9) continue;
    const intervalle = poly => poly.map(r => (r[0] * n[0] + r[1] * n[1]) / longueur);
    const x = intervalle(a), y = intervalle(b);
    if (Math.max(...x) + marge <= Math.min(...y) || Math.max(...y) + marge <= Math.min(...x)) return true;
  }
  return false;
}
const poses = new Map();
function pose(volant) {
  if (poses.has(volant)) return poses.get(volant);
  const mod = V.modele({ couleur: [.82, .12, .08], combinaison: [.88, .84, .72], numero: 27 });
  const ev = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: volant * .12, roule: 0, v: 0,
    pilote: { volant, rapport: 3, rapportAvant: 3, passage: 1, regard: 0, regime: 3000, kmh: 0 } };
  const dehors = [], dedans = [];
  V.poser(mod, ev, dehors); V.cockpit(mod, ev, dedans, { ...ev.pilote, glaceVive: true });
  const H = mod.objetsRendu.habitacle, R = mod.objetsRendu.pilote, cache = new Map();
  const lire = o => { if (!cache.has(o)) cache.set(o, { nom: o.shape, t: triangles(o) }); return cache.get(o); };
  const casquette = H.planche.find(p => p.objet.shape === V.FORMES.casquette.nom); assert(casquette);
  const commandes = [...H.planche, ...H.volant, ...H.supportVolant].filter(p => dedans.includes(p.objet));
  const resultat = { ev, H, R, dehors, dedans, lire, casquette,
    opaques: dedans.filter(o => !o.fx || o.alpha >= 1).map(lire), commandes: commandes.map(p => lire(p.objet)),
    glaces: H.glaces.map(g => lire(g.vive.objet)), coins: Array.from(V.glacesCockpit(ev), g => Array.from(g.coins, c => Array.from(c))) };
  poses.set(volant, resultat); return resultat;
}
let yeux;
function yeuxNeutres() {
  if (yeux) return yeux;
  // Ancrages neutres de la caméra mesurés sur le visage, comme dans habitacle-monde.
  // La tête extérieure tourne avec le braquage ; cela ne relève pas la caméra du jeu.
  const dehors = pose(0).dehors;
  const humain = contexte.RADE.humanData, visage = dehors.find(o => o.shape === V.FORMES['pilote-visage'].nom);
  let premier;
  for (let i = 0; i < humain.indices.length && !premier; i += 3) {
    const t = [0, 1, 2].map(k => humain.positions[humain.indices[i + k]]);
    if (t.reduce((s, p) => s + p[2], 0) / 3 > -.01 && t.reduce((s, p) => s + p[1], 0) / 3 > 1.6) premier = t[0];
  }
  const tourner = p => [p[2], p[1], -p[0]], decalage = sub(triangles(visage)[0][0], tourner(premier));
  yeux = Array.from(humain.eyes, p => tourner(p).map((x, k) => x + decalage[k]));
  yeux.push([0, 1, 2].map(k => (yeux[0][k] + yeux[1][k]) / 2));
  return yeux;
}

test('oracles : triangle masquant réel et chevauchement des polygones sont détectés', () => {
  const oeil = [0, 1, 0], route = [20, 0, 0], obstacle = [[1, .8, -.2], [1, 1.1, -.2], [1, .95, .2]];
  assert(traverse(oeil, route, obstacle));
  assert(!traverse(oeil, route, obstacle.map(p => [p[0], p[1] - .5, p[2]])));
  assert(!traverse(oeil, route, obstacle.map(p => [-p[0], p[1], p[2]])));
  const carre = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert(!separes(carre, [[3, 3], [4, 3], [3, 4]]));
  assert(!separes(carre, carre.map(p => [p[0] + 11, p[1]])));
  assert(separes(carre, carre.map(p => [p[0] + 13, p[1]])));
});

test('yeux, assise et épaules conservés ; volant et casquette communs aux deux vues', () => {
  for (const [nom, attendu] of [['OEIL', [-.062, .790, 0]], ['PILOTE_ASSISE', [-.10, .277, 0]], ['PILOTE_EPAULES', [-.09, .60, .16]]])
    assert.deepEqual(Array.from(V[nom]), attendu, nom + ' ne sert pas à masquer la gêne');
  yeuxNeutres()[2].forEach((x, k) => assert(Math.abs(x - V.OEIL[k]) < 2e-8, 'caméra au milieu des vrais yeux neutres'));
  for (const volant of [-1, 0, 1]) {
    const p = pose(volant);
    for (const debut of [0, 9]) for (const [offset, longueur] of [[0, .21], [3, .23]]) {
      const a = Array.from(p.H.articulations.slice(debut + offset, debut + offset + 3));
      const b = Array.from(p.H.articulations.slice(debut + offset + 3, debut + offset + 6));
      assert(Math.abs(Math.hypot(...sub(a, b)) - longueur) < 1e-9, 'os du bras de 21/23 cm conservés');
    }
    for (const piece of [p.H.jante, p.casquette, ...p.H.glaces.map(g => g.vive)]) {
      const exterieur = p.R.variantes[0].pieces.find(q => q.source === piece);
      assert(exterieur && p.dehors.includes(exterieur.objet) && p.dedans.includes(piece.objet), 'pièce réellement dessinée dans les deux vues');
      for (const cle of ['p', 's', 'r']) for (let k = 0; k < 3; k++)
        assert(Math.abs(exterieur.objet[cle][k] - piece.objet[cle][k]) < 1e-11, 'ancrage commun ' + piece.objet.shape);
    }
  }
});

test('jante et casquette sous les yeux, volant de taille physique conservée', () => {
  for (const volant of [-1, 0, 1]) {
    const p = pose(volant), jante = bornes(p.lire(p.H.jante.objet).t.flat()), casquette = bornes(p.lire(p.casquette.objet).t.flat());
    const diametre = jante.max[2] - jante.min[2];
    // 20–28 cm : pas de disparition par réduction ; 3 cm sous les yeux est une marge
    // minimale distincte de la visibilité à 10 m, contrôlée ci-dessous sur toute la coque.
    assert(diametre >= .20 && diametre <= .28, 'diamètre réel de la jante : ' + diametre);
    console.log(`volant=${volant} haut jante=${jante.max[1].toFixed(6)} casquette=${casquette.max[1].toFixed(6)} yeux=${V.OEIL[1]}`);
    for (const [nom, b] of [['jante', jante], ['casquette', casquette]])
      assert(b.max[1] <= V.OEIL[1] - .03, `${nom} doit rester au moins 3 cm sous les yeux : ${b.max[1]}`);
  }
});

test('70° verticaux en 16:9 : la jante occupe entre un cinquième et trois dixièmes de la largeur', () => {
  const largeur = 960, hauteur = 540, p = pose(0);
  const produire = camera(B, { clientWidth: largeur, clientHeight: hauteur }, { champ: 70, secousses: 0 }, false);
  const cam = produire({}, { x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 },
    { v: 0, alat: 0, along: 0, volant: 0, surface: 'route' }, 0, 1 / 60);
  assert(Math.abs(cam.fov - 70) < 1e-9, 'le champ transmis à FERRO est vertical');
  const points = p.lire(p.H.jante.objet).t.flat().map(q => projeter(q, cam, largeur, hauteur));
  assert(points.every(q => q.every(Number.isFinite) && q[2] > cam.near));
  const fraction = (Math.max(...points.map(q => q[0])) - Math.min(...points.map(q => q[0]))) / largeur;
  console.log(`cadrage 16:9 : champ vertical=${cam.fov}°, largeur jante=${(fraction * 100).toFixed(3)} %`);
  assert(fraction >= .20 && fraction <= .30, 'proportion apparente de la vraie jante : ' + fraction);
});

test('chaussée à 10/20/40/80 m : aucun triangle opaque sur les 324 rayons du corridor central', () => {
  const obstacles = [], minimum = new Map(); let rayons = 0;
  // Corridor de 2 m, comparable à la largeur de la voiture ; route horizontale au
  // niveau des pneus. Cette grille ne certifie ni tout le relief ni tous les gestes.
  for (const volant of [-1, 0, 1]) {
    const p = pose(volant);
    for (const oeil of yeuxNeutres()) for (const distance of [10, 20, 40, 80]) for (let z = -1; z <= 1; z += .25) {
      const cible = [distance, 0, z]; rayons++;
      for (const o of p.opaques) {
        if (!minimum.has(o)) minimum.set(o, bornes(o.t.flat()));
        const b = minimum.get(o);
        if (b.max[0] <= oeil[0] || b.min[0] >= distance || b.min[1] > oeil[1] || b.max[1] < 0) continue;
        if (o.t.some(t => traverse(oeil, cible, t))) {
          obstacles.push(`volant=${volant} œil=${oeil[2].toFixed(3)} cible=${distance}/${z} : ${o.nom}`); break;
        }
      }
    }
  }
  assert.equal(rayons, 324);
  console.log(`chaussée : ${rayons} rayons, ${obstacles.length} occultés`);
  assert.equal(obstacles.length, 0, obstacles.slice(0, 12).join('\n'));
});

test('regard, freinage et virage réels : rétros entiers et séparés des commandes dans les vrais cadres', () => {
  const conflits = []; let cadres = 0;
  const allures = [{ v: 0, alat: 0, along: 0 }];
  for (const along of [-22, 0, 22]) for (const alat of [-26, 0, 26]) allures.push({ v: 80, along, alat });
  for (const volant of [-1, 0, 1]) for (const [largeur, hauteur, tactile] of [[960, 540, false], [540, 960, true], [960, 270, false], [480, 540, false]])
    for (const allure of allures) {
      const p = pose(volant), reglages = { champ: 60, secousses: 0 }, S = {};
      const produire = camera(B, { clientWidth: largeur, clientHeight: hauteur }, reglages, tactile);
      const et = { ...allure, volant, surface: 'route' }, posture = { x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 };
      let cam = produire(S, posture, et, 0, 1 / 60);
      const cache = S.cadrageCockpit, glaces = cache?.glaces, coins = glaces?.[0].coins[0];
      // Deux secondes d'entrée réelle : le regard anticipe effectivement le braquage, les déplacements
      // de tête et le roulis suivent les accélérations. L'ancien banc passait toujours et.volant = 0.
      for (let i = 1; i < 120; i++) cam = produire(S, posture, et, i / 60, 1 / 60);
      assert.equal(reglages.champ, 60, 'le choix manuel reste mémorisé');
      assert(cache && S.cadrageCockpit === cache && cache.glaces === glaces && glaces[0].coins[0] === coins,
        'buffers de cadrage réutilisés après leur préparation');
      if (allure.v && volant) assert(Math.abs(cam.yaw - Math.PI / 2) > .069, 'regard réellement braqué');
      const proj = q => projeter(q, cam, largeur, hauteur);
      const dans = q => q.every(Number.isFinite) && q[2] > cam.near && q[0] >= 0 && q[0] <= largeur && q[1] >= 0 && q[1] <= hauteur;
      const commandes = p.commandes.map(o => ({ nom: o.nom, t: o.t.map(t => t.map(proj)) }));
      for (let g = 0; g < 2; g++) {
        const boitier = p.lire(p.H.glaces[g].boitier.objet).t.flat().map(proj);
        assert(boitier.every(q => dans(q) && q[0] >= 2.99 && q[0] <= largeur - 2.99 && q[1] >= 2.99 && q[1] <= hauteur - 2.99),
          `boîtier ${g} tronqué : ${largeur}×${hauteur}, volant=${volant}, alat=${allure.alat}, along=${allure.along}`);
      }
      for (let g = 0; g < 2; g++) for (const [nom, points] of [['volume', p.glaces[g].t.flat()], ['image', p.coins[g]]]) {
        const projetes = points.map(proj), poly = enveloppe(projetes);
        assert(projetes.every(dans), `glace ${g}/${nom} hors cadre ${largeur}×${hauteur}`);
        for (const o of commandes) if (o.t.some(t => t.every(q => q[2] > cam.near) &&
          Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0])) > 1e-8 && !separes(poly, t)))
          conflits.push(`${largeur}×${hauteur}, v=${allure.v}, volant=${volant}, alat=${allure.alat}, along=${allure.along}, glace=${g}/${nom}, ${o.nom}`);
      }
      cadres++;
    }
  assert.equal(cadres, 120);
  console.log(`glaces : ${cadres} cadres, ${conflits.length} recouvrements ou marges < 2 px`);
  assert.equal(conflits.length, 0, conflits.slice(0, 12).join('\n'));
});

test('la seconde vue garde son propre cadrage quand elle hérite de la séance J1', () => {
  const S = {}, J2 = Object.assign(Object.create(S), { tete: null });
  const produire = camera(B, { clientWidth: 480, clientHeight: 540 }, { champ: 60, secousses: 0 }, false);
  const et = { alat: 26, along: -22, volant: 1, v: 80, surface: 'route' };
  produire(S, { x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 }, et, 0, 1 / 60);
  const avant = JSON.stringify(S.cadrageCockpit.glaces);
  produire(J2, { x: 80, y: 3, z: -50, cap: .8, tangage: .2, roulis: -.1 }, { ...et, volant: -1 }, 0, 1 / 60);
  assert.notEqual(J2.cadrageCockpit, S.cadrageCockpit);
  assert.notEqual(J2.cadrageCockpit.glaces[0].coins[0], S.cadrageCockpit.glaces[0].coins[0]);
  assert.equal(JSON.stringify(S.cadrageCockpit.glaces), avant, 'le passage J2 préserve les coins observés pour J1');
  const glaces = B.voiture.glacesCockpit({ p: [80, 3, -50], cap: .8, tangage: .2, roulis: -.1 });
  assert.deepEqual(J2.cadrageCockpit.glaces, glaces, 'vrais coins après changement de cap, pente et dévers');
});
