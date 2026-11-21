// Contrats mécaniques de la régression .75 ; support compact selon la photo et les vues 126 CK (21/11).
// Le témoin .75 se rejoue avec BITUME_COCKPIT_RACINE=/chemin/reference node ce-fichier.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = process.env.BITUME_COCKPIT_RACINE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = vm.createContext({ console });
vm.runInContext('globalThis.window=globalThis;', c);
for (const file of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'cockpit-matieres.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), c, { filename: file });
const V = c.BITUME.voiture, geometry = c.FRender.shared.geometry(false);
const model = V.modele({ couleur: [.82, .12, .08], combinaison: [.88, .84, .72], numero: 27 });
const pose = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 0,
  pilote: { volant: 0, rapport: 3, rapportAvant: 3, passage: 1, regime: 3000, kmh: 0 } };
const out = []; V.cockpit(model, pose, out, pose.pilote);
const H = model.objetsRendu.habitacle;
function points(object) {
  assert(out.includes(object), 'objet effectivement dessiné');
  const range = geometry.ranges[object.shape], matrix = V.euler(...object.r), result = [];
  assert(range, 'vrais sommets du registre FERRO');
  for (let i = range.offset / 4; i < range.offset / 4 + range.count; i++) {
    const index = geometry.indices[i] * 6, local = Array.from(geometry.vertices.slice(index, index + 3));
    result.push([0, 1, 2].map(k => object.p[k] + local.reduce((n, x, a) => n + x * object.s[a] * matrix[a][k], 0)));
  }
  return result;
}
const bounds = p => ({ min: [0, 1, 2].map(k => Math.min(...p.map(q => q[k]))), max: [0, 1, 2].map(k => Math.max(...p.map(q => q[k]))) });

test('colonne descendante vers l’avant, face du volant orientée vers les yeux', () => {
  const normal = V.euler(...H.jante.objet.r)[1];
  assert(normal[0] < -.90 && normal[1] >= .10 && normal[1] <= .45,
    'la normale du vrai volant regarde le pilote et le haut ; l’ancien signe pointait vers le bas');
  const shaft = H.supportVolant[0].objet, axis = V.euler(...shaft.r)[1];
  const ends = [-1, 1].map(sign => Array.from(shaft.p, (v, k) => v + sign * axis[k] * shaft.s[1] / 2)).sort((a, b) => a[0] - b[0]);
  assert(ends[1][0] - ends[0][0] > .08 && ends[0][1] - ends[1][1] > .01,
    'la colonne affichée descend réellement de plus de 1 cm vers l’avant, sans mât vers le ciel');
});

test('volant de taille physique conservée et éloigné des yeux', () => {
  const p = points(H.jante.objet), b = bounds(p), centre = b.min.map((v, k) => (v + b.max[k]) / 2);
  assert(b.max[2] - b.min[2] >= .265 && b.max[2] - b.min[2] <= .290, 'diamètre réel conservé, sans réduction de cadrage');
  assert(centre[0] - V.OEIL[0] >= .39 && centre[0] - V.OEIL[0] <= .55,
    'au moins 39 cm devant les yeux, sans avancer au-delà de la portée humaine');
});

test('support compact, trois cadrans physiques groupés derrière la jante', () => {
  const panel = H.planche[0].objet, p = points(panel), b = bounds(p), rim = points(H.jante.objet), r = bounds(rim);
  assert(b.max[1] - b.min[1] < .65 * (r.max[2] - r.min[2]),
    'support moins haut que deux tiers du diamètre du volant, sans la grande arche refusée en .76');
  // 21/11 : une occultation naturelle par la jante est acceptée. Le panneau garde
  // sa géométrie mesurée ; l'ancien seuil de marge apparente ne commande plus le modèle.
  assert(b.min[0] > r.max[0], 'planche fixée devant la direction, aucune interpénétration');
  const tours = H.planche.map(e => e.objet).filter(o => o.shape === 'cylinder' && o.s[0] >= .075 && o.s[2] >= .075);
  assert(tours.length >= 2, 'compte-tours réel, lunette et fond');
  assert(Math.max(...tours.flatMap(points).map(q => q[1])) < V.OEIL[1], 'instrumentation sous les yeux');
  assert(panel.mat === c.BITUME.cockpitMatieres.cuir, 'fond mat gainé, sans plaque de métal brossé');
  const instrument = H.aiguilles.map(a => a.centre.map((v, k) => V.ORIGINE_HABITACLE[k] + V.K * v));
  assert(instrument[0][1] > instrument[1][1] + .035 && instrument[0][1] > instrument[2][1] + .035,
    'compte-tours réellement surélevé, petits cadrans disposés en dessous');
});

test('boîtiers bas, pattes courtes et presque horizontales', () => {
  for (const mirror of H.glaces) {
    const b = bounds(points(mirror.boitier.objet)), foot = mirror.patte.objet;
    assert(b.max[1] < .75 && b.min[1] > .58, 'boîtier au flanc de la coque, bien sous les yeux');
    assert(foot.s[1] < .19, 'patte mécanique courte, moins de 19 cm');
    const axis = V.euler(...foot.r)[1];
    assert(Math.abs(axis[1]) * foot.s[1] < .07, 'moins de 7 cm de montée : aucun montant perché');
    assert(Math.abs(mirror.c[2]) > .35, 'miroirs latéraux, non rentrés devant les mains');
  }
});
