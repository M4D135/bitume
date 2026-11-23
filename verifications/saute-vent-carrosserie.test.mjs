// Géométrie Float32 réellement soumise à FERRO, repère longitudinal +X.
// Rejouer le même oracle sur une ancienne voiture avec BITUME_VOITURE_SOURCE=/chemin/voiture.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';

const contexte = vm.createContext({ console });
vm.runInContext('globalThis.window = globalThis', contexte);
for (const nom of ['ferro/render-shared.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'cockpit-matieres.js', 'voiture.js']) {
  const fichier = nom === 'voiture.js' && process.env.BITUME_VOITURE_SOURCE || fileURLToPath(new URL('../src/' + nom, import.meta.url));
  vm.runInContext(readFileSync(fichier, 'utf8'), contexte, { filename: fichier });
}
const V = contexte.BITUME.voiture, geo = contexte.FRender.shared.geometry(false);
const modele = V.modele({ couleur: [.82, .12, .08], numero: 27 });
const pose = { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 0,
  pilote: { volant: 0, rapport: 3, rapportAvant: 3, passage: 1, regime: 8000, kmh: 288 } };
const exterieur = [], cockpit = [];
V.poser(modele, pose, exterieur); V.cockpit(modele, pose, cockpit, pose.pilote);

function triangles(objet) {
  const range = geo.ranges[objet.shape], rotation = V.euler(...objet.r), faces = [];
  assert(range, objet.shape);
  for (let j = range.offset / 4; j < range.offset / 4 + range.count; j += 3) {
    const points = [0, 1, 2].map(coin => {
      const i = 6 * geo.indices[j + coin];
      return [0, 1, 2].map(k => objet.p[k] + rotation[0][k] * geo.vertices[i] * objet.s[0]
        + rotation[1][k] * geo.vertices[i + 1] * objet.s[1] + rotation[2][k] * geo.vertices[i + 2] * objet.s[2]);
    });
    faces.push(points);
  }
  return faces;
}
const unique = (vue, nom) => {
  const pieces = vue.filter(objet => objet.shape === V.FORMES[nom].nom);
  assert.equal(pieces.length, 1, nom + ' à son ancrage réel');
  return pieces[0];
};

// Souder les normales et le recto/verso par position (0,01 µm). Le bord d'une
// feuille sans trou est une boucle simple. Sa lèvre libre est à l'arrière.
function embase(verre) {
  const sommets = new Map(), aretes = new Map(), faces = new Set();
  const id = p => {
    const cle = p.map(x => Math.round(x * 1e8)).join(',');
    if (!sommets.has(cle)) sommets.set(cle, { p, id: sommets.size });
    return sommets.get(cle);
  };
  for (const tri of verre) {
    const points = tri.map(id), cle = points.map(q => q.id).sort((a, b) => a - b).join('/');
    if (new Set(points).size !== 3 || faces.has(cle)) continue;
    faces.add(cle);
    for (let k = 0; k < 3; k++) {
      const a = points[k], b = points[(k + 1) % 3], cle = [Math.min(a.id, b.id), Math.max(a.id, b.id)].join('/');
      if (!aretes.has(cle)) aretes.set(cle, { a, b, count: 0 });
      aretes.get(cle).count++;
    }
  }
  const bord = [...aretes.values()].filter(e => e.count === 1), voisins = new Map();
  for (const { a, b } of bord) for (const [q, r] of [[a, b], [b, a]]) {
    if (!voisins.has(q)) voisins.set(q, []);
    voisins.get(q).push(r);
  }
  assert(bord.length > 0 && [...aretes.values()].every(e => e.count <= 2), 'surface ouverte sans cloison');
  assert([...voisins.values()].every(v => v.length === 2), 'contour sans branche');
  const vus = new Set(), pile = [bord[0].a];
  while (pile.length) { const p = pile.pop(); if (!vus.has(p)) { vus.add(p); pile.push(...voisins.get(p)); } }
  assert.equal(vus.size, voisins.size, 'une seule boucle, sans découpe ouverte dans le verre');
  assert.equal(sommets.size - aretes.size + faces.size, 1, 'feuille sans trou ni seconde peau');
  const arriere = Math.min(...[...sommets.values()].map(q => q.p[0]));
  const libre = bord.filter(e => Math.max(e.a.p[0], e.b.p[0]) < arriere + 1e-6);
  assert(libre.length && libre.length < bord.length, 'lèvre libre et embase distinctes');
  const ancrages = bord.filter(e => !libre.includes(e)).map(e => [e.a.p, e.b.p]);
  const points = ancrages.flat(), largeur = points.map(p => p[2]);
  assert(Math.min(...largeur) < -.21 && Math.max(...largeur) > .21 &&
    Math.max(...points.map(p => p[0])) > arriere + .18, 'l’embase revient sur chaque flanc depuis l’avant');
  return ancrages;
}
function barycentriquesXZ(p, a, b, c) {
  const bx = b[0] - a[0], bz = b[2] - a[2], cx = c[0] - a[0], cz = c[2] - a[2], det = bx * cz - bz * cx;
  if (Math.abs(det) < 1e-13) return null;
  const u = ((p[0] - a[0]) * cz - (p[2] - a[2]) * cx) / det;
  const v = (bx * (p[2] - a[2]) - bz * (p[0] - a[0])) / det;
  return [1 - u - v, u, v];
}
// Dans chaque triangle, l'écart vertical est affine le long de la corde. Découper
// aux traversées d'arêtes et aux éventuels croisements de deux surfaces superposées
// donne ses extrema, même si les deux sommets de verre seuls semblent joints.
function ecarts(aretes, peau) {
  const resultats = { gauche: [], avant: [], droite: [] };
  let sansAppui = 0;
  for (const [a, b] of aretes) {
    const morceaux = [], coupes = [0, 1];
    for (const z of [-.10, .10]) {
      const t = (z - a[2]) / (b[2] - a[2]);
      if (t > 0 && t < 1) coupes.push(t);
    }
    for (const tri of peau) {
      const u = barycentriquesXZ(a, ...tri);
      if (!u) continue;
      const v = barycentriquesXZ(b, ...tri);
      let min = 0, max = 1;
      for (let k = 0; k < 3; k++) {
        const d = v[k] - u[k];
        if (Math.abs(d) < 1e-12) { if (u[k] < -1e-9) max = -1; }
        else if (d > 0) min = Math.max(min, -u[k] / d);
        else max = Math.min(max, -u[k] / d);
      }
      if (max - min < 1e-10) continue;
      const dy = (y, coord) => y - coord.reduce((s, w, k) => s + w * tri[k][1], 0);
      const origine = dy(a[1], u), pente = dy(b[1], v) - origine;
      for (const autre of morceaux) {
        const t = (autre.origine - origine) / (pente - autre.pente);
        if (t > Math.max(min, autre.min) && t < Math.min(max, autre.max)) coupes.push(t);
      }
      morceaux.push({ min, max, origine, pente }); coupes.push(min, max);
    }
    coupes.sort((x, y) => x - y);
    for (let i = 1; i < coupes.length; i++) {
      const t0 = coupes[i - 1], t1 = coupes[i], t = (t0 + t1) / 2;
      if (t1 - t0 < 1e-8) continue;
      const surfaces = morceaux.filter(p => p.min <= t && p.max >= t);
      if (!surfaces.length) { sansAppui += (t1 - t0) * Math.hypot(...b.map((v, k) => v - a[k])); continue; }
      const z = a[2] + t * (b[2] - a[2]), region = z < -.10 ? 'gauche' : z > .10 ? 'droite' : 'avant';
      for (const borne of [t0, t1]) resultats[region].push(Math.min(...surfaces.map(p => p.origine + borne * p.pente)) * 1000);
    }
  }
  const regions = Object.fromEntries(Object.entries(resultats).map(([k, v]) => {
    assert(v.length, 'raccord mesuré ' + k);
    return [k, [Math.min(...v), Math.max(...v)]];
  }));
  return { regions, sansAppui };
}

for (const [nom, vue] of [['extérieur', exterieur], ['cockpit', cockpit]]) test('continuité du saute-vent sur le nez peint en ' + nom, t => {
  const bulle = unique(vue, 'bulle'), nez = unique(vue, 'goutte');
  assert(bulle.fx && bulle.alpha > 0 && bulle.alpha < 1 && !nez.fx, 'verre transparent sur panneau de livrée opaque');
  const { regions: mesures, sansAppui } = ecarts(embase(triangles(bulle)), triangles(nez));
  t.diagnostic('verre moins carrosserie en mm : ' + Object.entries(mesures).map(([k, [min, max]]) =>
    k + ' [' + min.toFixed(3) + ', ' + max.toFixed(3) + ']').join(' ; ') + ' ; bord sans appui ' + (sansAppui * 1000).toFixed(3));
  assert(sansAppui < .000001, 'bord du verre au-dessus d’une ouverture : ' + (sansAppui * 1000).toFixed(3) + ' mm');
  for (const [region, [min, max]] of Object.entries(mesures)) {
    assert(max <= .1, region + ' : jour de ' + max.toFixed(3) + ' mm');
    assert(min >= -5, region + ' : pénétration excessive de ' + (-min).toFixed(3) + ' mm');
  }
});

// Découper chaque triangle de verre dans la pyramide visuelle de chaque instrument.
// Sa section englobe tous les pixels possibles de la pièce, et s'arrête à sa face
// la plus distante : les triangles vus à travers le verre, au-delà, restent admis.
function verreDevantInstrument(verre, oeil, piece) {
  const cible = triangles(piece).flat().map(p => p.map((c, i) => c - oeil[i]));
  assert(cible.every(p => p[0] > 0));
  const inclinaison = cible.map(p => p[1] / p[0]), azimut = cible.map(p => p[2] / p[0]);
  const bas = Math.min(...inclinaison), haut = Math.max(...inclinaison);
  const g = Math.min(...azimut), d = Math.max(...azimut), fond = Math.max(...cible.map(p => p[0]));
  const plans = [p => fond - p[0], p => p[0], p => p[1] - bas * p[0], p => haut * p[0] - p[1],
    p => p[2] - g * p[0], p => d * p[0] - p[2]];
  return verre.some(t => {
    let poly = t.map(q => q.map((v, k) => v - oeil[k]));
    for (const plan of plans) {
      const suite = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], pa = plan(a), pb = plan(b);
        if (pa >= 0) suite.push(a);
        if ((pa >= 0) !== (pb >= 0)) suite.push(a.map((x, k) => x + (b[k] - x) * pa / (pa - pb)));
      }
      poly = suite;
      if (!poly.length) return false;
    }
    return true;
  });
}
test('aucune nappe de verre entre les yeux et les trois cadrans ou les afficheurs', () => {
  const h = modele.objetsRendu.habitacle, cadrans = h.planche.map(p => p.objet).filter(o => o.shape === V.FORMES['fond-cadran'].nom);
  assert.equal(cadrans.length, 3);
  const segments = [...h.vitesse.flat(), ...h.rapport].map(p => p.objet).filter(o => o.emissive);
  assert.equal(segments.length, 24, '288 km/h en troisième');
  const verre = triangles(unique(cockpit, 'bulle'));
  for (const o of [...cadrans, ...segments]) {
    assert(cockpit.includes(o));
    assert(!verreDevantInstrument(verre, V.OEIL, o), 'verre devant ' + o.shape);
  }
  assert(verreDevantInstrument(triangles(cadrans[0]).map(tri => tri.map(p =>
    p.map((x, k) => (x + V.OEIL[k]) / 2))), V.OEIL, cadrans[0]), 'une nappe à mi-chemin est détectée');
});
