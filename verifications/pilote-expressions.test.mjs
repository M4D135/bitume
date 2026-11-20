// Expressions visuelles : vrais points de doigts, articulations, poses communes et cache de rendu.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), contexte = vm.createContext({ console });
for (const f of ['carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js', 'ferro/vehicle-dynamics.js',
  'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'voiture.js'])
  vm.runInContext(fs.readFileSync(path.join(racine, 'src', f), 'utf8'), contexte, { filename: f });
const V = contexte.BITUME.voiture, M = contexte.BITUME.main;
const creer = () => V.modele({ couleur: [.8, .12, .1], combinaison: [.9, .85, .7], numero: 27 });
const pose = () => ({ p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 20,
  pilote: { volant: 0, rapportAvant: 2, rapport: 3, passage: 1, regard: 0, geste: null, gesteCote: 1, gestePhase: .5, gesteIntensite: 0 } });
const instantane = H => JSON.stringify({ articulations: Array.from(H.articulations), mains: H.mains.map(m => m.pieces.map(p =>
  [p.objet.shape, Array.from(p.o), Array.from(p.objet.s), Array.from(p.rep.m)])) });
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const point = (A, j) => Array.from(A.slice(j, j + 3));
const formes = new Map(Object.values(V.FORMES).map(f => [f.nom, f]));
function sommets(o) {
  const m = V.euler(...o.r);
  return formes.get(o.shape).tri.flatMap(t => t.slice(0, 3).map(p => V.mul(m, p.map((v, k) => v * o.s[k])).map((v, k) => v + o.p[k])));
}

test('le préchauffage expose chaque prise et geste des deux mains aux packers objet et overlay', () => {
  const sortie = [], avant = Object.keys(V.FORMES).length;
  assert.equal(V.preparerExpressions(sortie, [1, 2, 3]), 96);
  for (const [nom, f] of Object.entries(V.FORMES)) if (/^main-geste-|^main-gant-[dg](?:$|-prise-|-ouvert$)/.test(nom))
    for (const overlay of [false, true]) assert.ok(sortie.some(o => o.shape === f.nom && o.overlay === overlay), nom + '/' + overlay);
  assert.equal(Object.keys(V.FORMES).length, avant, 'aucune forme enregistrée pendant la chauffe');
});

test('les trois gestes ont des doigts distincts ; majeur dressé seul et quatre doigts au salut', () => {
  for (const geste of ['majeur', 'poing', 'salut']) {
    const main = M.construire(1, { geste, progression: 1 });
    const longueurs = main.points.doigts.map(p => -p.at(-1).reduce((s, x, k) => s + (x - p[1][k]) * M.AXE[k], 0));
    if (geste === 'majeur') {
      assert.ok(longueurs[1] > .08, 'majeur réellement déployé');
      assert.ok(longueurs.every((l, i) => i === 1 || l < .005), 'trois doigts repliés');
    } else if (geste === 'salut') assert.ok(longueurs.every(l => l > .055), 'quatre doigts ouverts');
    else assert.ok(longueurs.every(l => l < .005), 'quatre bouts revenus dans la paume');
    assert.deepEqual(Array.from(main.points.poignet), Array.from(M.construire().points.poignet), 'ancrage du poignet inchangé');
    for (const tri of main.gant) assert.ok(tri.every(p => p.every(Number.isFinite)), 'vraie géométrie finie');
  }
});

test('les gestes lèvent un vrai gant au-dessus du jonc, avec les doigts lisibles de dehors', () => {
  const modele = creer(), ev = pose(), hauteurs = {};
  for (const geste of ['majeur', 'poing', 'salut']) for (const gesteCote of [-1, 1]) {
    Object.assign(ev.pilote, { geste, gesteCote, gesteIntensite: 1 }); V.poser(modele, ev, []);
    const role = 'gant-' + (gesteCote < 0 ? 0 : 1) + '-0';
    const gant = modele.objetsRendu.pilote.variantes[0].pieces.find(p => p.role === role).objet, points = sommets(gant);
    const ymin = Math.min(...points.map(p => p[1])), ymax = Math.max(...points.map(p => p[1]));
    assert.ok(ymin > .90 && ymax > 1.01, 'gant réellement levé : ' + JSON.stringify({ geste, gesteCote, ymin, ymax }));
    assert.ok(points.every(p => gesteCote * p[2] > .17), 'gant à côté du casque');
    hauteurs[geste] = ymax;
  }
  assert.ok(hauteurs.majeur > hauteurs.poing + .035, 'silhouette du majeur reconnaissable');
  assert.ok(hauteurs.salut > hauteurs.poing + .035, 'silhouette du salut reconnaissable');
});

test('poses partagées, os de 21/23 cm et retour exact au volant pour les deux côtés', () => {
  const modele = creer(), ev = pose(), nombreFormes = Object.keys(V.FORMES).length;
  let poses = 0;
  for (const volant of [-1, -.5, 0, .5, 1]) for (const geste of ['majeur', 'poing', 'salut']) for (const gesteCote of [-1, 1]) {
    Object.assign(ev.pilote, { volant, geste: null, gesteIntensite: 0 }); V.poser(modele, ev, []);
    const H = modele.objetsRendu.habitacle, repos = instantane(H), autre = gesteCote < 0 ? 9 : 0, brasAutre = Array.from(H.articulations.slice(autre, autre + 9));
    for (const gesteIntensite of [0, .06, .16, .26, .44, .6, .8, 1, .8, .44, .16, 0]) {
      Object.assign(ev.pilote, { geste, gesteCote, gesteIntensite }); V.poser(modele, ev, []);
      const A = H.articulations, reference = instantane(H);
      assert.deepEqual(Array.from(A.slice(autre, autre + 9)), brasAutre, 'l’autre main garde sa prise');
      for (const j of [0, 9]) {
        assert.ok(Math.abs(distance(point(A, j), point(A, j + 3)) - .21) < 1e-12, 'humérus constant');
        assert.ok(Math.abs(distance(point(A, j + 3), point(A, j + 6)) - .23) < 1e-12, 'avant-bras constant');
        assert.ok(A[j + 4] < Math.max(A[j + 1], A[j + 7]), 'coude replié sous épaule/poignet, sans inversion');
      }
      for (const detail of ['complet', 'moyen', 'simple']) { V.poser(modele, ev, [], { detail }); assert.equal(instantane(H), reference); }
      V.cockpit(modele, ev, [], { ...ev.pilote, regime: 9000, kmh: 140 }); assert.equal(instantane(H), reference);
      V.poserRetro(modele, ev, []); assert.equal(instantane(H), reference);
      if (gesteIntensite === 0) assert.equal(reference, repos, 'retour exact aux doigts fermés et aux mêmes os');
      poses++;
    }
  }
  assert.equal(Object.keys(V.FORMES).length, nombreFormes, 'aucun nouveau maillage pendant les poses');
  assert.equal(poses, 360);
});

test('temps, intensité et côté invalident la pose ; regard signé indépendant de la caméra', () => {
  const modele = creer(), ev = pose(); Object.assign(ev.pilote, { geste: 'salut', gesteIntensite: 1, gestePhase: .3 });
  V.poser(modele, ev, []); const H = modele.objetsRendu.habitacle, initial = instantane(H);
  ev.pilote.gestePhase = .4; V.poser(modele, ev, []); assert.notEqual(instantane(H), initial, 'seule la phase change');
  const phase = instantane(H); ev.pilote.gesteIntensite = .6; V.poser(modele, ev, []); assert.notEqual(instantane(H), phase, 'seule l’intensité change');
  ev.pilote.gesteCote = -1; V.poser(modele, ev, []); assert.notEqual(instantane(H), phase, 'côté changé');
  const mains = instantane(H), position = JSON.stringify([ev.p, ev.cap, ev.tangage, ev.roulis]);
  for (const regard of [-.32, .32]) {
    ev.pilote.regard = regard; V.poser(modele, ev, []);
    assert.ok(Math.sign(modele.objetsRendu.pilote.tete[2]) === Math.sign(regard), 'casque regarde le bon côté');
    assert.equal(instantane(H), mains, 'le regard ne déplace pas les mains');
    assert.equal(JSON.stringify([ev.p, ev.cap, ev.tangage, ev.roulis]), position, 'aucune attitude/caméra écrite');
  }
});

test('les entrées non finies ne contaminent pas le rig', () => {
  const modele = creer(), ev = pose();
  Object.assign(ev.pilote, { passage: 1, regard: NaN, gesteIntensite: Infinity, gestePhase: NaN });
  const sortie = []; V.poser(modele, ev, sortie);
  for (const o of sortie) for (const k of ['p', 'r', 's']) assert.ok(o[k].every(Number.isFinite));
});
