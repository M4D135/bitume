// Une seule géométrie métrique : comparer les sorties réellement dessinées, sans ajuster
// une échelle ou une translation entre les vues. Les sommets viennent du registre Float32 FERRO.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexte = vm.createContext({ console });
vm.runInContext('globalThis.window = globalThis;', contexte);
for (const fichier of ['moteur/renderer.js', 'carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'cockpit-matieres.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(racine, 'src', fichier), 'utf8'), contexte, { filename: fichier });
const V = contexte.BITUME.voiture, geometrie = contexte.FRender.shared.geometry(false);
const modele = () => V.modele({ couleur: [.82, .12, .08], combinaison: [.88, .84, .72], numero: 27 });
const copie = o => ({ shape: o.shape, p: Array.from(o.p), s: Array.from(o.s), r: Array.from(o.r),
  mat: o.mat, color: Array.from(o.color), emissive: o.emissive, surface: o.surface });
const egal = (a, b, contexte) => {
  assert.equal(a.shape, b.shape, contexte + ' forme');
  assert.equal(a.mat, b.mat, contexte + ' matière');
  assert.equal(a.surface, b.surface, contexte + ' repère de matière');
  assert.equal(a.emissive, b.emissive, contexte + ' émission');
  for (const cle of ['p', 's', 'r', 'color']) for (let i = 0; i < 3; i++)
    assert.ok(Math.abs(a[cle][i] - b[cle][i]) < 1e-11, `${contexte} ${cle}[${i}] ${a[cle][i]} != ${b[cle][i]}`);
};
const points = new Map();
function sommets(nom) {
  if (!points.has(nom)) {
    const plage = geometrie.ranges[nom], vus = new Map();
    assert.ok(plage, 'forme dans les tampons de rendu : ' + nom);
    for (let n = plage.offset / 4; n < plage.offset / 4 + plage.count; n++) {
      const i = geometrie.indices[n] * 6;
      if (!vus.has(i)) vus.set(i, Array.from(geometrie.vertices.slice(i, i + 3)));
    }
    points.set(nom, [...vus.values()]);
  }
  return points.get(nom);
}
function monde(o, q) {
  const m = V.euler(...o.r);
  return [0, 1, 2].map(i => o.p[i] + m[0][i] * q[0] * o.s[0] + m[1][i] * q[1] * o.s[1] + m[2][i] * q[2] * o.s[2]);
}
function pose(pilote = {}) {
  return { p: [8, 2, -3], cap: .4, tangage: .09, roulis: -.06, braquage: .12, roule: 6, v: 35,
    rebond: [.01, -.02, .03, 0], pilote: { volant: 0, rapport: 3, rapportAvant: 2, passage: 1,
      regime: 9000, kmh: 150, ...pilote } };
}

test('le contrôle monde refuse une translation ou une homothétie cachée entre vues', () => {
  const a = { shape: 'box', p: [1, 2, 3], s: [.2, .3, .4], r: [0, 0, 0], mat: 1, color: [.5, .5, .5] };
  const b = structuredClone(a); b.p[0] += .11;
  assert.throws(() => egal(a, b, 'témoin translation'));
  b.p[0] = a.p[0]; b.s = b.s.map(x => x * 1.8);
  assert.throws(() => egal(a, b, 'témoin ancienne échelle'));
  egal(a, structuredClone(a), 'témoin identique');
});

test('les instruments relus dans plusieurs vues rendent exactement les valeurs d’un modèle neuf', () => {
  const reuse = modele(), etats = [{ rapport: -1, regime: 12500, kmh: 8 }, { rapport: 0, regime: 0, kmh: 0 },
    { rapport: 3, regime: 9000, kmh: 144 }, { rapport: 6, regime: 13200, kmh: 351 },
    { rapport: NaN, regime: NaN, kmh: NaN }, { rapport: undefined, regime: undefined, kmh: -15 }];
  for (let i = 0; i < etats.length; i++) {
    // Une autre vue et un autre affichage précèdent la cible : rien ne doit rester du précédent pilote.
    const ancien = pose({ rapport: 1, regime: 4500, kmh: 29 });
    V.cockpit(reuse, ancien, [], { ...ancien.pilote, glaceVive: true });
    const ev = pose(etats[i]);
    V.poser(reuse, ev, []); V.poserRetro(reuse, ev, []);
    for (let vue = 0; vue < 2; vue++) {
      ev.p[0] += 7; ev.cap += .2;
      const actuel = [], neuf = [], etat = { ...ev.pilote, glaceVive: true };
      V.cockpit(reuse, ev, actuel, etat); V.cockpit(modele(), ev, neuf, etat);
      assert.deepEqual(actuel.map(copie), neuf.map(copie), `état ${i}, vue ${vue} : mêmes valeurs exactes, y compris après une relecture`);
    }
  }
});

test('commandes, instruments et rétros : mêmes objets métriques et sommets monde dans les deux vues', () => {
  const mod = modele(); let mesures = 0;
  const etats = [{}, { volant: -1 }, { volant: 1 }, { passage: .25 }, { passage: .5 }, { passage: .75 },
    { rapport: -1, rapportAvant: 0, regime: 12500, kmh: 8 },
    { geste: 'salut', gesteCote: -1, gesteIntensite: .8, gestePhase: .4 },
    { geste: 'majeur', gesteCote: 1, gesteIntensite: 1, gestePhase: .6 }];
  for (const etat of etats) for (const attitude of [[0, 0, 0], [.4, .09, -.06], [-1.3, .24, -.19]]) {
    const ev = pose(etat); [ev.cap, ev.tangage, ev.roulis] = attitude;
    const exterieur = []; V.poser(mod, ev, exterieur);
    const R = mod.objetsRendu.pilote, H = R.habitacle;
    const avant = new Map(R.variantes[0].pieces.filter(p => p.source && p.source.visible !== false).map(p => [p.source, copie(p.objet)]));
    const dedans = []; V.cockpit(mod, ev, dedans, { ...ev.pilote, glaceVive: true });
    const sources = [...H.planche, ...H.volant, ...H.supportVolant, ...H.rapport, H.diagonale, ...H.vitesse.flat(),
      ...H.glaces.flatMap(g => [g.boitier, g.patte, g.vive])];
    for (const source of sources) {
      if (source.visible === false) { assert.ok(!dedans.includes(source.objet)); continue; }
      assert.ok(avant.has(source), 'pièce commune réellement présente dehors : ' + source.objet.shape);
      assert.ok(dedans.includes(source.objet), 'pièce commune réellement présente depuis le siège');
      const a = avant.get(source), b = copie(source.objet);
      egal(a, b, source.objet.shape);
      for (const q of sommets(a.shape)) {
        const p = monde(a, q), r = monde(b, q);
        for (let i = 0; i < 3; i++) assert.ok(Math.abs(p[i] - r[i]) < 1e-11, 'sommets monde sans normalisation');
        mesures++;
      }
    }
    for (const piece of R.cockpit.pieces) {
      assert.ok(dedans.includes(piece.objet), 'bras/coude/console également dessiné depuis le siège');
      const dehors = R.variantes[0].pieces.find(p => p.role === piece.role);
      egal(copie(dehors.objet), copie(piece.objet), piece.role);
    }
  }
  assert.ok(mesures > 100000, 'registre réellement parcouru');
  console.log(`habitacle commun : 27 poses, ${mesures} sommets comparés dans le monde`);
});

test('coque commune, buste commun et propre tête seule masquée depuis les yeux', () => {
  const mod = modele(), ev = pose(), exterieur = [], dedans = [];
  V.poser(mod, ev, exterieur); V.cockpit(mod, ev, dedans, { ...ev.pilote, glaceVive: true });
  for (const nom of ['goutte', 'goutte-dedans', 'jonc', 'bulle-pilote', 'cuve', 'assise-pilote', 'siege-supports', 'pilote-buste']) {
    const shape = V.FORMES[nom].nom, a = exterieur.find(o => o.shape === shape), b = dedans.find(o => o.shape === shape);
    assert.ok(a && b, 'forme commune : ' + nom); egal(copie(a), copie(b), nom);
  }
  for (const nom of ['epaules', 'epaules-jonc', 'flancs', 'dome', 'pare-brise', 'pare-brise-arete'])
    assert.ok(!dedans.some(o => o.shape === V.FORMES[nom].nom), 'aucune coque de substitution : ' + nom);
  assert.ok(exterieur.some(o => o.shape === V.FORMES['pilote-casque'].nom));
  assert.ok(!dedans.some(o => o.shape === V.FORMES['pilote-casque'].nom));
  assert.ok(!dedans.some(o => o.shape === V.FORMES['pilote-visiere'].nom));
});

test('caméra indépendante et buffers de rendu séparés, y compris instruments et bascule en plein geste', () => {
  const mod = modele(), ev = pose({ geste: 'poing', gesteCote: 1, gesteIntensite: .75, gestePhase: .6 });
  const sortie = []; V.poser(mod, ev, sortie);
  const avant = sortie.map(copie), oeil = Array.from(V.OEIL);
  V.OEIL[0] += .13; V.OEIL[1] -= .07;
  try {
    const autre = []; V.cockpit(mod, ev, autre, { ...ev.pilote, regime: 12500, kmh: 7, glaceVive: true });
    assert.deepEqual(sortie.map(copie), avant, 'un rendu cockpit ne réécrit pas les objets déjà placés dehors');
    const revenu = []; V.poser(mod, ev, revenu);
    assert.deepEqual(revenu.map(copie), avant, 'déplacer les yeux ne modifie aucune pièce de voiture');
  } finally { for (let i = 0; i < 3; i++) V.OEIL[i] = oeil[i]; }
});

function trianglesMonde(o) {
  const plage = geometrie.ranges[o.shape], triangles = [];
  for (let n = plage.offset / 4; n < plage.offset / 4 + plage.count; n += 3)
    triangles.push([0, 1, 2].map(k => {
      const i = geometrie.indices[n + k] * 6;
      return monde(o, Array.from(geometrie.vertices.slice(i, i + 3)));
    }));
  return triangles;
}
function segmentTraverse(a, b, t) {
  const sub = (p, q) => p.map((x, i) => x - q[i]);
  const croix = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const produit = (p, q) => p.reduce((s, x, i) => s + x * q[i], 0);
  const d = sub(b, a), u = sub(t[1], t[0]), v = sub(t[2], t[0]), h = croix(d, v), det = produit(u, h);
  if (Math.abs(det) < 1e-12) return false;
  const s = sub(a, t[0]), x = produit(s, h) / det, q = croix(s, u), y = produit(d, q) / det, f = produit(v, q) / det;
  return x >= -1e-9 && y >= -1e-9 && x + y <= 1 + 1e-9 && f >= 0 && f <= 1;
}

test('les yeux déclarés viennent du visage réellement placé et regardent à travers la visière', () => {
  const mod = modele(), ev = pose({ rapportAvant: 3, rapport: 3, passage: 1, regard: 0 });
  ev.p = [0, 0, 0]; ev.cap = ev.tangage = ev.roulis = 0;
  const sortie = []; V.poser(mod, ev, sortie);
  const visage = sortie.find(o => o.shape === V.FORMES['pilote-visage'].nom);
  const rendu = trianglesMonde(visage), humain = contexte.RADE.humanData, source = [];
  // Retrouver les correspondances du vrai visage à la donnée humaine d'origine. Seule la permutation
  // de repère est connue ; la translation est mesurée sur les sommets affichés, jamais lue dans le rig.
  const tourner = p => [p[2], p[1], -p[0]];
  for (let i = 0; i < humain.indices.length; i += 3) {
    const t = [0, 1, 2].map(k => humain.positions[humain.indices[i + k]]);
    if (t.reduce((s, p) => s + p[2], 0) / 3 > -.01 && t.reduce((s, p) => s + p[1], 0) / 3 > 1.6)
      source.push(t.map(tourner));
  }
  assert.equal(rendu.length, source.length, 'toutes les faces humaines attendues sont réellement affichées');
  const decalage = rendu[0][0].map((x, k) => x - source[0][0][k]);
  for (let i = 0; i < source.length; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++)
    assert.ok(Math.abs(rendu[i][j][k] - source[i][j][k] - decalage[k]) < 2e-8, 'visage en taille réelle, sans déformation ou échelle ajustée');
  const yeux = Array.from(humain.eyes, p => tourner(p).map((x, k) => x + decalage[k]));
  const milieu = [0, 1, 2].map(k => (yeux[0][k] + yeux[1][k]) / 2);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(milieu[k] - V.OEIL[k]) < 2e-8, 'caméra au milieu des deux vrais yeux');
  assert.ok(Math.abs(milieu[1] - .920 + .130) < 2e-8, 'baisse physique de 13 cm mesurée depuis les anciens yeux');
  assert.ok(Math.abs(milieu[0] + .022 + .040) < 2e-8, 'recul de tête de 4 cm mesuré depuis les anciens yeux');
  const visiere = trianglesMonde(sortie.find(o => o.shape === V.FORMES['pilote-visiere'].nom));
  const casque = trianglesMonde(sortie.find(o => o.shape === V.FORMES['pilote-casque'].nom));
  for (const oeil of yeux) {
    const devant = [oeil[0] + .3, oeil[1], oeil[2]];
    assert.ok(visiere.some(t => segmentTraverse(oeil, devant, t)), 'chaque œil regarde à travers la visière');
    assert.ok(!casque.some(t => segmentTraverse(oeil, devant, t)), 'la coque du casque ne bouche pas le regard');
  }
  console.log('yeux mesurés sur le visage : ' + milieu.map(x => x.toFixed(6)).join(', '));
});

function rayonsVerticaux(nom, x, z, haut, bas) {
  const f = V.FORMES[nom], plage = geometrie.ranges[f.nom], resultats = [];
  const points = indice => {
    const n = geometrie.indices[indice] * 6;
    return [0, 1, 2].map(k => f.centre[k] + geometrie.vertices[n + k] * f.taille[k]);
  };
  // Barycentriques dans le plan xz : les faces presque verticales ne coupent pas le rayon vertical.
  for (let n = plage.offset / 4; n < plage.offset / 4 + plage.count; n += 3) {
    const a = points(n), b = points(n + 1), c = points(n + 2);
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(den) < 1e-12) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
    if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
    const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
    if (y > bas + 1e-7 && y < haut - 1e-7) resultats.push(y);
  }
  return resultats;
}

test('la cuve ouverte offre une profondeur réelle sans ancien couvercle ni fond de carrosserie à travers le bassin', () => {
  for (const x of [-.18, -.10, .05, .20]) for (const z of [-.12, 0, .12]) {
    for (const nom of ['cuve', 'pontons', 'goutte', 'goutte-dedans', 'loin-caisse', 'loin-dessus-pilote'])
      assert.equal(rayonsVerticaux(nom, x, z, .60, .18).length, 0, `${nom} bouche la cellule en ${x}, ${z}`);
    assert.ok(rayonsVerticaux('cuve', x, z, .18, .08).length > 0, 'un vrai fond existe sous le siège');
  }
});
