// Régression .76 : la glace basse, restée verticale, renvoyait le regard sous l'horizon.
// Oracle sur peindreGlace du runtime ; aucune image ni caméra de remplacement.
// Témoin : BITUME_RETROS_RACINE=/chemin/sources-0276 node ce-fichier.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

const root = process.env.BITUME_RETROS_RACINE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = vm.createContext({ console });
vm.runInContext('globalThis.window=globalThis;', c);
for (const f of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'cockpit-matieres.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), c, { filename: f });
const B = c.BITUME, V = B.voiture;
B.mesures = { actif: false };
const source = fs.readFileSync(path.join(root, 'src/jeu.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8').match(/\.retro-rendu\s*\{([^}]+)\}/);
assert(css, 'taille de la vraie toile des rétroviseurs');
const l = +css[1].match(/\bwidth:\s*([\d.]+)px/)[1], h = +css[1].match(/\bheight:\s*([\d.]+)px/)[1];
const start = source.indexOf('  function peindreGlace('), end = source.indexOf('\n  }', start);
assert(start >= 0 && end > start, 'fonction réelle de rendu du reflet');
const captures = [];
const paint = new Function('B', 'captures', `
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const CAM_GLACE = { pos: [0, 0, 0], sun: { center: [0, 0, 0] } }, PORTEE_VUE = 6000;
  const scene = { ombre: { extent: 100, depth: 100 }, decor: { tunnelLampes: [] }, index: null };
  const retro = { rendu: { draw: cam => captures.push(JSON.parse(JSON.stringify(cam))) } };
  const publicVisible = false, horlogeReelle = 0, dureeImage = 16.667;
  const listeGlace = () => [], lampesTunnel = () => [];
  ${source.slice(start, end + 4)}
  return peindreGlace;
`)(B, captures);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const minus = (a, b) => Array.from(a, (x, i) => x - b[i]);
const unit = a => a.map(x => x / Math.hypot(...a));
const close = (a, b, message) => assert(Math.hypot(...minus(a, b)) < 1e-8, message);
const pose = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 0,
  pilote: { volant: 0, rapport: 3, rapportAvant: 3, passage: 1, regime: 3000, kmh: 0, glaceVive: true } };
const mirrors = V.glacesCockpit(pose);
function reflected(i, eye = V.OEIL) {
  let copies = 0;
  const target = { toiles: [{ width: l, height: h }, { width: l, height: h }],
    ctx: [{ drawImage: () => copies++ }, { drawImage: () => copies++ }] };
  const before = captures.length;
  paint({}, target, i, mirrors[i], { pos: eye }, { x: 0, y: 0, z: 0, roulis: 0 }, [], {}, null,
    { windStrength: 0, groundCover: 0 }, { width: l, height: h }, l, h, 1 / 60);
  assert.equal(captures.length, before + 1, 'la caméra provient du vrai appel draw');
  assert.equal(copies, 1, 'le runtime copie réellement son image vers la glace');
  return captures.at(-1);
}
function project(point, cam) {
  const [x, y, z] = minus(point, cam.pos), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  const sp = Math.sin(cam.pitch), cp = Math.cos(cam.pitch), t = Math.tan(cam.fov * Math.PI / 360);
  const depth = x * sy * cp + y * sp - z * cy * cp;
  return [(1 + (x * cy + z * sy) / (depth * t * l / h)) / 2,
    (1 - (-x * sy * sp + y * cp + z * cy * sp) / (depth * t)) / 2, depth];
}

console.log('reflets — sources ' + ['voiture.js', 'jeu.js', 'style.css'].map(f => f + ':' +
  createHash('sha256').update(fs.readFileSync(path.join(root, 'src', f))).digest('hex')).join(' '));

test('glace, boîtier et coins partagent le vrai plan incliné vers les yeux', () => {
  const model = V.modele({ couleur: [.82, .12, .08], combinaison: [.88, .84, .72], numero: 27 });
  for (const attitude of [{ cap: 0, tangage: 0, roulis: 0 }, { cap: .7, tangage: .12, roulis: -.09 }]) {
    const ev = { ...pose, ...attitude }, out = [];
    V.cockpit(model, ev, out, pose.pilote);
    const world = V.glacesCockpit(ev), M = V.attitude(ev.cap, ev.tangage, ev.roulis);
    for (let i = 0; i < 2; i++) {
      const frame = V.cadreGlace(world[i].k), g = world[i], pieces = model.objetsRendu.habitacle.glaces[i];
      assert(frame.n[1] > .20 && frame.n[1] < .30, 'la normale rejoint le nouveau poste 126 CK ; reflet utile contrôlé ci-dessous');
      close(frame.c, [.83, .67, g.k * .375], 'centres 126 CK communs aux vues');
      const up = cross(g.normale, g.droite);
      close(unit(g.normale), g.normale, 'normale unitaire');
      close(unit(up), up, 'orthobase sans cisaillement');
      close(unit(minus(g.coins[1], g.coins[0])), g.droite, 'coins alignés sur la largeur réelle');
      close(unit(minus(g.coins[0], g.coins[3])), up, 'coins alignés sur le haut incliné');
      for (const point of g.coins) assert(Math.abs(dot(minus(point, g.centre), g.normale) - .0035) < 1e-9,
        'image posée sur la face pilote, pas sur un plan vertical séparé');
      for (const part of [pieces.boitier, pieces.vive]) {
        assert(out.includes(part.objet), 'pièce réellement rendue');
        const matrix = V.euler(...part.objet.r);
        close(matrix[0], Array.from(g.normale, x => -x), 'boîtier/glace orientés par la normale commune');
        close(matrix[1], up, 'boîtier/glace orientés par le haut commun');
      }
      close(g.normale, V.mul(M, frame.n), 'la normale suit aussi pente, cap et dévers');
    }
  }
});

test('peindreGlace conserve un horizon utile au milieu des deux reflets', () => {
  for (let i = 0; i < 2; i++) {
    const cam = reflected(i), horizon = project([cam.pos[0] + 1000 * Math.sin(cam.yaw), cam.pos[1],
      cam.pos[2] - 1000 * Math.cos(cam.yaw)], cam)[1];
    console.log(JSON.stringify({ glace: mirrors[i].k, pitchDeg: cam.pitch * 180 / Math.PI, fovVertical: cam.fov,
      toile: [l, h], horizonFractionHauteur: horizon }));
    assert(horizon >= .30 && horizon <= .70, 'horizon entre 30 et 70 % de la hauteur, pas seulement dans un coin');
    assert(cam.fov < 11, 'aucun élargissement artificiel du champ de la glace');
    const incident = unit(minus(mirrors[i].centre, V.OEIL)), n = mirrors[i].normale, d = dot(incident, n);
    const reflectedY = incident[1] - 2 * d * n[1];
    assert(Math.abs(cam.pitch - Math.asin(reflectedY) - .06) < 1e-12,
      'même réglage historique du regard : la correction vient du plan mécanique');
  }
});

test('le centre d’une voiture à 10, 20 ou 30 m derrière reste dans le champ utile', () => {
  for (const lateral of [-.016, 0, .016]) for (const longitudinal of [-.02, 0, .02]) {
    const eye = [V.OEIL[0] + longitudinal, V.OEIL[1] - (longitudinal > 0 ? .006 : 0), V.OEIL[2] + lateral];
    for (let i = 0; i < 2; i++) for (const distance of [10, 20, 30]) {
      const p = project([-distance, .45, 0], reflected(i, eye));
      assert(p[2] > 0 && p[0] >= .15 && p[0] <= .85 && p[1] >= .15 && p[1] <= .85,
        `centre du suiveur à ${distance} m dans la zone centrale, glace ${i}, œil ${eye}, projection ${p}`);
    }
  }
});
