// Oracle indépendant : échantillonne tous les demi-pixels du centre des traits
// effectivement affichés et confronte leur profondeur à la vraie scène PhysX.
// Les graines et l'exposition constituent le contrat du champ existant, pas son masque.
import { pluieMesuree } from './helpers/projection-pluie.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'carene', 'decor', 'solides-physx']) req('../src/' + f + '.js');
const B = globalThis.BITUME, source = readFileSync(process.env.BITUME_PLUIE_SOURCE || new URL('../src/meteo.js', import.meta.url), 'utf8');
new Function('globalThis', source)(globalThis);
const M = B.meteo, X = await chargerPhysX(), c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200 }), t = c.tunnel;
c.couverts = [
  { ...t, id: 'premier', type: 'tunnel', fin: t.debut + 78 },
  { ...t, id: 'galerie', type: 'galerie', ouvert: 'G', debut: t.debut + 100, fin: t.debut + 154 },
  { ...t, id: 'second', type: 'tunnel', debut: t.debut + 186 }
];
const decor = B.decor.construire(c, { qualite: 'low', vegetation: false });
const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1 }), solids = B.solidesPhysX.installer(world, c, decor);
const physique = { world, solids }, rapport = { schema: 1, meteoSha256: createHash('sha256').update(source).digest('hex'),
  controles: 0, traits: 0, sondes: 0, occultations: 0, exemples: [], scenarios: [],
  limite: 'Centre du trait à pas <= 0,5 pixel, profondeur perspective et vrais murs/toits/portails/piliers PhysX ; ne qualifie ni rochers de décor ni franges antialias Canvas.' };
function toile() {
  const traits = []; let x = 0, y = 0;
  const ctx = { globalAlpha: 1, setTransform() {}, clearRect() { traits.length = 0; }, beginPath() {}, stroke() {},
    moveTo(a, b) { x = a; y = b; }, lineTo(a, b) { traits.push([x, y, a, b]); } };
  return { width: 960, height: 540, clientWidth: 960, clientHeight: 540, style: {}, traits, getContext: () => ctx };
}
function camera(s, angle = -Math.PI / 2, hauteur = 1.2, lateral = 0) {
  const q = B.circuit.echantillon(c, s);
  return { pos: [q.x - Math.sin(q.cap) * lateral, q.y + hauteur, q.z + Math.cos(q.cap) * lateral],
    yaw: q.cap + Math.PI / 2 + angle, pitch: 0, fov: 70 };
}
function hasard(n) {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const modulo = (x, n) => x - Math.floor(x / n) * n;
const cle = (x, y) => Math.fround(x) + ',' + Math.fround(y);
function donneesChamp(cam, temps, vitesse) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const R = [cy, 0, sy], U = [-sy * sp, cp, cy * sp], F = [sy * cp, sp, -cy * cp];
  const focale = 540 / (2 * Math.tan(cam.fov * Math.PI / 360)), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vent = [1.8 + .9 * Math.sin(temps * .61) + .5 * Math.sin(temps * 1.47), 0, .55 + .35 * Math.cos(temps * .43)];
  const derive = [1.8 * temps + .9 / .61 * (1 - Math.cos(temps * .61)) + .5 / 1.47 * (1 - Math.cos(temps * 1.47)),
    0, .55 * temps + .35 / .43 * Math.sin(temps * .43)];
  const gouttes = new Map();
  for (let i = 0; i < M.GOUTTES.high; i++) {
    const k = i * 4, chute = 12 + hasard(k + 4) * 4;
    const p = [modulo(hasard(k + 1) * 48 + derive[0] - cam.pos[0] + 24, 48) - 24,
      modulo(hasard(k + 2) * 18 - chute * temps - cam.pos[1] + 9, 18) - 9,
      modulo(hasard(k + 3) * 48 + derive[2] - cam.pos[2] + 24, 48) - 24];
    const q = [p[0] - (vent[0] - vitesse[0]) / 90, p[1] + (chute + vitesse[1]) / 90, p[2] - (vent[2] - vitesse[2]) / 90];
    const d0 = dot(p, F), d1 = dot(q, F); if (d0 < .8 || d1 < .8) continue;
    const sx = 480 + dot(p, R) * focale / d0, sy = 270 - dot(p, U) * focale / d0;
    const ex = 480 + dot(q, R) * focale / d1, ey = 270 - dot(q, U) * focale / d1;
    gouttes.set(cle(sx, sy), { id: i, d0, d1, sx, sy, dx: ex - sx, dy: ey - sy });
  }
  return { gouttes, R, U, F, focale };
}
const scenarios = [
  ['galerie-piliers-statique', i => camera(t.debut + 110 + i * .1), 72, 'high'],
  ['galerie-flou-300', i => camera(t.debut + 103 + i * (300 / 3.6 / 30)), 18, 'high'],
  ['galerie-flou-300-low', i => camera(t.debut + 103 + i * (300 / 3.6 / 30)), 18, 'low'],
  ['coin-portail', i => camera(t.debut + .1 + i * .04, Math.PI * .9, 1.2, -t.mur + .6), 60, 'high'],
  ['pilier-proche', i => camera(t.debut + 112 + (i - 20) * .025, -Math.PI / 2, 1.2, -t.mur + .5), 40, 'high'],
  ...[-.15, -.25, -.4].flatMap(angle => [1.2, 3.8].map(hauteur => [
    `galerie-oblique-${angle}-${hauteur}`, i => ({ ...camera(t.debut + 102 + i * (300 / 3.6 / 30), Math.PI * angle, hauteur, t.mur - 1), fov: 105 }), 40, 'high']))
];
try {
  const hit = {}, direction = [0, 0, 0], optionsRayon = { mask: 3, staticOnly: true };
  for (const [nom, obtenirCamera, images, palier] of scenarios) {
    const canvas = toile(), pluie = pluieMesuree(M, canvas); let precedente = null, traits = 0, sondes = 0, occultations = 0;
    for (let frame = 0; frame < images; frame++) {
      const cam = obtenirCamera(frame), temps = 12 + frame / 30, vitesse = precedente ? cam.pos.map((p, i) => (p - precedente.pos[i]) * 30) : [0, 0, 0];
      pluie.dessiner({ t: temps, pluie: 1 }, cam, 1 / 30, { circuit: c, physique, palier });
      const champ = donneesChamp(cam, temps, vitesse);
      for (const segment of canvas.traits) {
        const g = champ.gouttes.get(cle(segment[0], segment[1]));
        assert.ok(g, 'Le trait affiché correspond à une goutte déterministe du champ : ' + nom);
        const longueur = Math.hypot(segment[2] - segment[0], segment[3] - segment[1]), pas = Math.max(1, Math.ceil(longueur * 2));
        traits++;
        for (let j = 0; j <= pas; j++) {
          const u = j / pas, sx = segment[0] + (segment[2] - segment[0]) * u, sy = segment[1] + (segment[3] - segment[1]) * u;
          const fraction = ((sx - g.sx) * g.dx + (sy - g.sy) * g.dy) / (g.dx * g.dx + g.dy * g.dy);
          const profondeur = g.d0 * g.d1 / ((1 - fraction) * g.d1 + fraction * g.d0);
          for (let k = 0; k < 3; k++) direction[k] = champ.F[k] + (sx - 480) / champ.focale * champ.R[k] - (sy - 270) / champ.focale * champ.U[k];
          world.raycast(cam.pos, direction, Math.max(0, profondeur * Math.hypot(...direction) - .002), optionsRayon, hit); sondes++;
          const genre = hit.hit && solids.acteurs.get(hit.body)?.genre;
          if (genre && /^(mur|voute|portail|pilier)-(tunnel|galerie)$/.test(genre)) {
            occultations++;
            if (rapport.exemples.length < 12) rapport.exemples.push({ nom, frame, goutte: g.id, genre, fractionTrait: u, pixel: [sx, sy],
              segment, distanceSurface: hit.distance, profondeurPluie: profondeur });
          }
        }
      }
      precedente = cam;
    }
    rapport.traits += traits; rapport.sondes += sondes; rapport.occultations += occultations;
    rapport.scenarios.push({ nom, images, palier, traits, sondes, occultations });
    console.log(`${nom} : ${traits} traits, ${sondes} sondes, ${occultations} occultations`);
  }
  assert.ok(rapport.traits > 1000, 'les ouvertures conservent suffisamment de pluie visible');
  assert.equal(rapport.occultations, 0, 'aucun centre de trait affiché ne traverse une paroi ou un pilier réel');
  rapport.controles = scenarios.length + 1;
} finally {
  if (process.env.BITUME_PLUIE_TRAITS_RAPPORT) writeFileSync(process.env.BITUME_PLUIE_TRAITS_RAPPORT, JSON.stringify(rapport, null, 2) + '\n');
  B.solidesPhysX.liberer(solids); world.dispose(); X.dispose();
}
console.log(`météo couverts traits : ${rapport.controles} contrôles, ${rapport.sondes} sondes natives sans traversée`);
