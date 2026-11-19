// Le jeu fournit ev.pilote aux deux vues. Qualifier ce chemin réel, et non seulement l'ancien cadrage isolé.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), contexte = vm.createContext({ console });
vm.runInContext('globalThis.window = globalThis;', contexte);
for (const f of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js', 'ferro/vehicle-dynamics.js',
  'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(racine, 'src', f), 'utf8'), contexte, { filename: f });
const V = contexte.BITUME.voiture;
const creer = () => V.modele({ couleur: [.8, .12, .1], combinaison: [.9, .85, .7], numero: 27 });
const pose = () => ({ p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 20,
  pilote: { volant: 0, rapportAvant: 2, rapport: 3, passage: 1 } });
const snapshot = H => JSON.stringify({ joints: Array.from(H.articulations), pieces: H.volant.map(p =>
  [p.objet.shape, Array.from(p.o), Array.from(p.objet.s), p.rep ? Array.from(p.rep.m) : null]) });

test('490 poses : mêmes gants, commandes et manches dans les deux vues et les trois LOD', () => {
  const mod = creer(), ev = pose(), ancien = { ...ev }; delete ancien.pilote;
  const passages = [[-1, 0], [0, -1], [0, 1], [1, 0]];
  for (let i = 1; i < 6; i++) passages.push([i, i + 1], [i + 1, i]);
  let maximum = 0, poses = 0;
  for (const volant of [-1, -.5, 0, .5, 1]) for (const [rapportAvant, rapport] of passages)
    for (const passage of [0, .15, .3, .5, .65, .85, 1]) {
      Object.assign(ev.pilote, { volant, rapportAvant, rapport, passage }); V.poser(mod, ev, []);
      const R = mod.objetsRendu.pilote, H = R.habitacle, reference = snapshot(H), etat = { ...ev.pilote, regime: 9000, kmh: 150 };
      assert.equal(R.articulations, H.articulations, 'un seul tableau d’articulations');
      const volantPiece = R.variantes[0].pieces.find(p => p.role === 'volant');
      const echelle = volantPiece.objet.s[0] / volantPiece.source.objet.s[0];
      const translation = Array.from(volantPiece.objet.p).map((x, i) => x - echelle * volantPiece.source.o[i]);
      for (const [detail, index] of [['complet', 0], ['moyen', 6], ['simple', 2]]) {
        V.poser(mod, ev, [], { detail });
        for (const p of R.variantes[index].pieces) if (p.source) {
          assert.equal(p.objet.shape, p.simple || p.source.objet.shape, 'même forme, sauf simplification LOD déclarée');
          const rotation = V.euler(...p.objet.r), attendue = p.source.rep?.m || [1, 0, 0, 0, 1, 0, 0, 0, 1];
          for (let k = 0; k < 3; k++) {
            maximum = Math.max(maximum, Math.abs(p.objet.p[k] - translation[k] - echelle * p.source.o[k]),
              Math.abs(p.objet.s[k] - echelle * p.source.objet.s[k]));
            for (let j = 0; j < 3; j++) maximum = Math.max(maximum, Math.abs(rotation[j][k] - attendue[j * 3 + k]));
          }
        }
        for (let h = 0; h < 2; h++) for (const source of [...H.mains[h].tubes, ...H.mains[h].boules])
          assert.ok(R.variantes[index].pieces.some(p => p.source === source), 'manche provenant du modèle commun');
      }
      for (let h = 0; h < 2; h++) for (let k = 0; k < 3; k++)
        maximum = Math.max(maximum, Math.abs(R.articulations[h * 9 + 3 + k] - translation[k] - echelle * H.mains[h].boules[5].o[k]));
      V.cockpit(mod, ev, [], etat); assert.equal(snapshot(H), reference, 'extérieur puis intérieur');
      V.cockpit(mod, ancien, [], etat); V.poserRetro(mod, ev, []); assert.equal(snapshot(H), reference, 'ancien cadrage puis rétroviseur');
      V.cockpit(mod, ev, [], etat); V.poser(mod, ev, []); assert.equal(snapshot(H), reference, 'intérieur puis extérieur');
      poses++;
    }
  assert.ok(maximum < 1e-12, 'écart entre modèles : ' + maximum);
  assert.equal(poses, 490);
});

// Les sommets Float32 et indices du registre sont ceux qui sont envoyés au moteur.
const geometrie = contexte.FRender.shared.geometry(false), sommets = new Map(), surfaces = new Map();
function locaux(nom) {
  if (!sommets.has(nom)) {
    const r = geometrie.ranges[nom], uniques = new Map(), points = [], triangles = [];
    assert.ok(r, 'forme préparée dans le registre de rendu : ' + nom);
    for (let i = r.offset / 4; i < r.offset / 4 + r.count; i += 3) {
      const triangle = [];
      for (let k = 0; k < 3; k++) {
        const n = geometrie.indices[i + k] * 6, p = Array.from(geometrie.vertices.slice(n, n + 3)), cle = p.join(',');
        if (!uniques.has(cle)) { uniques.set(cle, points.length); points.push(p); }
        triangle.push(uniques.get(cle));
      }
      triangles.push(triangle);
    }
    sommets.set(nom, points); surfaces.set(nom, triangles);
  }
  return sommets.get(nom);
}
const apparent = p => p.map((x, i) => (x - V.OEIL[i]) / V.K);

// Distance à la surface entière : une face peut traverser le pommeau alors que ses trois sommets sont dehors.
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const d2 = (a, b) => dot(sub(a, b), sub(a, b));
const avance = (p, v, s) => p.map((x, i) => x + v[i] * s);
function pointTriangle2(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2a = dot(ac, ap);
  if (d1 <= 0 && d2a <= 0) return d2(p, a);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return d2(p, b);
  const vc = d1 * d4 - d3 * d2a;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return d2(p, avance(a, ab, d1 / (d1 - d3)));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return d2(p, c);
  const vb = d5 * d2a - d1 * d6;
  if (vb <= 0 && d2a >= 0 && d6 <= 0) return d2(p, avance(a, ac, d2a / (d2a - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0)
    return d2(p, avance(b, sub(c, b), (d4 - d3) / (d4 - d3 + d5 - d6)));
  return d2(p, avance(avance(a, ab, vb / (va + vb + vc)), ac, vc / (va + vb + vc)));
}
test('le contrôle du pommeau détecte aussi une face ou une arête dont les sommets sont dehors', () => {
  const centre = [0, 0, 0], face = [[-2, -2, 0], [2, -2, 0], [0, 2, 0]], arete = [[-2, 0, 0], [2, 0, 0], [0, 2, 0]];
  assert.ok(face.every(p => d2(p, centre) > 1));
  assert.equal(pointTriangle2(centre, ...face), 0);
  assert.equal(pointTriangle2(centre, ...arete), 0);
  assert.equal(pointTriangle2([0, 0, 2], ...face), 4);
});

test('mode réel : sommets dégagés de la jante et surfaces dégagées du pommeau pendant le passage', () => {
  const mod = creer(), ev = pose(), { centre: C, rayon: R, inclinaison: tau } = V.VOLANT;
  const wn = [-Math.cos(tau), Math.sin(tau), 0], rayonTube = .0225 * (R / .105) / 2;
  const phases = [...new Set([...Array.from({ length: 51 }, (_, i) => i / 50), .001, .002, .003, .004, .005, .006, .008, .01, .015, .985, .99, .992, .994, .995, .996, .997, .998, .999])];
  let pireJante = 0, pirePommeau = 0, casJante = null, casPommeau = null, poses = 0;
  for (const volant of [-1, -.5, 0, .5, 1]) for (const [rapportAvant, rapport] of [[2, 3], [4, 5], [6, 5], [-1, 0]])
    for (const passage of phases) {
      Object.assign(ev.pilote, { volant, rapportAvant, rapport, passage });
      V.cockpit(mod, ev, [], { ...ev.pilote, regime: 9000, kmh: 140 });
      const H = mod.objetsRendu.habitacle, pommeau = apparent(H.pommeau.o), rayonPommeau = H.pommeau.objet.s[0] / (2 * V.K);
      for (const main of H.mains) for (const piece of main.pieces) {
        const o = piece.objet, m = V.euler(...o.r);
        const points = locaux(o.shape).map(p => {
          const x = p[0] * o.s[0], y = p[1] * o.s[1], z = p[2] * o.s[2];
          return [0, 1, 2].map(i => (o.p[i] + m[0][i] * x + m[1][i] * y + m[2][i] * z - V.OEIL[i]) / V.K);
        });
        for (const q of points) {
          const dx = q[0] - C[0], dy = q[1] - C[1], dz = q[2] - C[2], h = dx * wn[0] + dy * wn[1];
          const rho = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - h * h));
          const penetrationJante = rayonTube - Math.hypot(rho - R, h);
          const penetrationPommeau = rayonPommeau - Math.hypot(q[0] - pommeau[0], q[1] - pommeau[1], q[2] - pommeau[2]);
          if (penetrationJante > pireJante) { pireJante = penetrationJante; casJante = { volant, rapportAvant, rapport, passage, main: main.k }; }
          if (penetrationPommeau > pirePommeau) { pirePommeau = penetrationPommeau; casPommeau = { volant, rapportAvant, rapport, passage, main: main.k }; }
        }
        for (const [i, j, k] of surfaces.get(o.shape)) {
          const a = points[i], b = points[j], c = points[k];
          if ([0, 1, 2].some(n => Math.min(a[n], b[n], c[n]) > pommeau[n] + rayonPommeau ||
            Math.max(a[n], b[n], c[n]) < pommeau[n] - rayonPommeau)) continue;
          const penetration = rayonPommeau - Math.sqrt(pointTriangle2(pommeau, a, b, c));
          if (penetration > pirePommeau) { pirePommeau = penetration; casPommeau = { volant, rapportAvant, rapport, passage, main: main.k, forme: o.shape, face: [i, j, k] }; }
        }
      }
      poses++;
    }
  assert.ok(pireJante < 1e-6, JSON.stringify({ objet: 'jante', penetration: pireJante, cas: casJante }));
  assert.ok(pirePommeau < 1e-6, JSON.stringify({ objet: 'pommeau', penetration: pirePommeau, cas: casPommeau }));
  console.log('mains et commandes : ' + poses + ' poses du mode réellement utilisé par le jeu');
});

test('le poignet suit un trajet continu et les doigts utilisent seulement leurs prises préparées', () => {
  const mod = creer(), ev = pose(), variantes = new Set(), nombreFormes = Object.keys(V.FORMES).length;
  let maximum = 0, poses = 0;
  for (const volant of [-1, -.5, 0, .5, 1]) for (const [rapportAvant, rapport] of [[2, 3], [6, 5]]) {
    Object.assign(ev.pilote, { volant, rapportAvant, rapport });
    let precedent = null, depart = null, formeDepart = null;
    for (let n = 0; n <= 1000; n++) {
      ev.pilote.passage = n / 1000; V.poser(mod, ev, []);
      const R = mod.objetsRendu.pilote, poignet = Array.from(R.articulations.slice(15, 18));
      const gant = R.habitacle.mains[1].pieces[0].objet;
      assert.ok(geometrie.ranges[gant.shape], 'prise déjà enregistrée avant le premier rendu');
      variantes.add(gant.shape);
      if (precedent) maximum = Math.max(maximum, Math.hypot(...poignet.map((x, k) => x - precedent[k])));
      else { depart = poignet; formeDepart = gant.shape; }
      if (n === 1000) {
        assert.deepEqual(poignet, depart, 'retour exact du poignet sur la jante');
        assert.equal(gant.shape, formeDepart, 'doigts refermés au retour');
      }
      precedent = poignet; poses++;
    }
    // Une entrée infinitésimale ne doit pas changer soudainement le maillage ni la position du gant.
    for (const passage of [1e-9, 1 - 1e-9]) {
      ev.pilote.passage = passage; V.poser(mod, ev, []);
      const R = mod.objetsRendu.pilote;
      assert.equal(R.habitacle.mains[1].pieces[0].objet.shape, formeDepart);
      assert.ok(Math.hypot(...Array.from(R.articulations.slice(15, 18)).map((x, k) => x - depart[k])) < 1e-8);
    }
  }
  assert.ok(maximum < .006, 'pas du poignet à phase 0,001 : ' + maximum);
  assert.equal(variantes.size, 6, 'fermé, quatre intermédiaires, ouvert ; aucun morphing reconstruit par image');
  assert.equal(Object.keys(V.FORMES).length, nombreFormes, 'registre inchangé pendant les poses');
  console.log(`trajet du poignet : ${poses} poses, pas maximal ${(1000 * maximum).toFixed(3)} mm par phase 0,001`);
});
