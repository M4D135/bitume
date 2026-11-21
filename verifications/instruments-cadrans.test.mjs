// Régression .77 : le petit cadran droit abaissé masquait le chiffre des centaines.
// Rayons depuis les vrais yeux vers les faces des segments effectivement allumés.
// Ce contrôle vise les cadrans ; il ne certifie pas le dégagement mains/jante.
// Témoin refusé : BITUME_INSTRUMENTS_RACINE=/chemin/candidat-avant node ce-fichier.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = process.env.BITUME_INSTRUMENTS_RACINE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ console });
vm.runInContext('globalThis.window = globalThis;', context);
for (const f of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'cockpit-matieres.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), context, { filename: f });
const V = context.BITUME.voiture, geometry = context.FRender.shared.geometry(false);
const sub = (a, b) => Array.from(a, (x, i) => x - b[i]);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function triangles(o) {
  const r = geometry.ranges[o.shape], m = V.euler(...o.r), ts = [];
  assert(r, 'forme réellement enregistrée par FERRO');
  for (let j = r.offset / 4; j < r.offset / 4 + r.count; j += 3)
    ts.push([0, 1, 2].map(k => {
      const off = geometry.indices[j + k] * 6, q = geometry.vertices.slice(off, off + 3);
      return [0, 1, 2].map(i => o.p[i] + m[0][i] * q[0] * o.s[0] + m[1][i] * q[1] * o.s[1] + m[2][i] * q[2] * o.s[2]);
    }));
  return ts;
}
function hit(a, b, t) {
  const d = sub(b, a), u = sub(t[1], t[0]), v = sub(t[2], t[0]), h = cross(d, v), det = dot(u, h);
  if (Math.abs(det) < 1e-12) return false;
  const s = sub(a, t[0]), x = dot(s, h) / det, q = cross(s, u), y = dot(d, q) / det, f = dot(v, q) / det;
  return x >= -1e-9 && y >= -1e-9 && x + y <= 1 + 1e-9 && f > 1e-9 && f < 1 - 1e-9;
}

test('oracle : un cadran devant le segment le masque, un cadran derrière ne le masque pas', () => {
  const eye = [0, 1, 0], segment = [2, 0, 0], face = [[1, .3, -.2], [1, .7, -.2], [1, .5, .2]];
  assert(hit(eye, segment, face));
  assert(!hit(eye, segment, face.map(p => [3, p[1], p[2]])));
  assert(!hit(eye, segment, face.map(p => [p[0], p[1], p[2] + 1])));
});

test('les six faces des cadrans ne masquent aucun segment allumé de vitesse ou rapport', () => {
  const model = V.modele({ couleur: [.82, .12, .08], numero: 27 });
  const pose = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, v: 0,
    pilote: { volant: 0, rapport: 3, rapportAvant: 3, passage: 1, regime: 8000, kmh: 288 } };
  const out = []; V.cockpit(model, pose, out, pose.pilote);
  const H = model.objetsRendu.habitacle;
  const dials = H.planche.filter(e => e.objet.shape === 'cylinder' && e.objet.s[0] >= .049 && e.objet.s[2] >= .049);
  assert.equal(dials.length, 6, 'lunette et fond réellement affichés de chacun des trois cadrans');
  const obstacles = dials.map(e => { assert(out.includes(e.objet)); return triangles(e.objet); });
  const displays = [...H.vitesse.map((pieces, i) => ({ name: 'vitesse-' + i, pieces })), { name: 'rapport', pieces: H.rapport }];
  const masked = []; let rays = 0, lit = 0;
  for (const display of displays) for (let i = 0; i < display.pieces.length; i++) {
    const o = display.pieces[i].objet;
    if (!o.emissive) continue;
    assert(out.includes(o), 'segment allumé effectivement rendu'); lit++;
    const m = V.euler(...o.r);
    // Centre, bords et coins de la face tournée vers le pilote, à 5 % du bord.
    for (const x of [-.45, 0, .45]) for (const y of [-.45, 0, .45]) {
      const target = Array.from(o.p, (v, k) => v + m[0][k] * o.s[0] * x + m[1][k] * o.s[1] * y + m[2][k] * o.s[2] * .5);
      rays++;
      if (obstacles.some(ts => ts.some(t => hit(V.OEIL, target, t))))
        masked.push(display.name + '/' + 'abcdefg'[i] + ':' + x + ',' + y);
    }
  }
  assert.equal(lit, 24, '288 km/h et troisième rapport : 24 segments lumineux');
  assert.equal(rays, 216);
  console.log('instruments : ' + rays + ' rayons, ' + masked.length + ' masqués par un cadran');
  assert.equal(masked.length, 0, masked.slice(0, 12).join('\n'));
});
