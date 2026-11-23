// Raccords de production avec le vrai modèle, les vrais pools et les vraies matrices.
// Le prédicat de toit est isolé ici ; sa géométrie est couverte par les bancs couverts/PhysX.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const contexte = vm.createContext({ console });
vm.runInContext('globalThis.window = globalThis;', contexte);
for (const nom of ['moteur/renderer', 'carene', 'main', 'humain-donnees', 'humain-corps',
  'ferro/vehicle-dynamics', 'pneus', 'usure-pneus', 'chaussee', 'conduite', 'voiture', 'eau-carrosserie', 'meteo', 'sillage', 'saute-vent-webgpu'])
  vm.runInContext(readFileSync(new URL('../src/' + nom + '.js', import.meta.url), 'utf8'), contexte, { filename: nom });
const B = contexte.BITUME, E = B.eauCarrosserie, V = B.voiture;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const debut = source.indexOf('  function majEauCarrosserie('), fin = source.indexOf('  let pluieVue', debut);
assert(debut >= 0 && fin > debut);
const neige = source.slice(source.indexOf('  function precipitationsNeige('), source.indexOf('  function dessinerMeteo('));
const fabriquer = new Function('B', 'sousLaVoute', neige + source.slice(debut, fin)
  + '\nreturn { majEauCarrosserie, poserEauCarrosserie };');
const raccord = fabriquer(B, (_c, p) => p[0] > 10);

function seance() {
  const modeles = [V.modele({ couleur: [.8, .12, .1], numero: 1 }), V.modele({ couleur: [.1, .3, .8], numero: 2 })];
  for (let k = 0; k < modeles.length; k++) { V.preparerPneusService(modeles[k]); E.preparer(modeles[k], k + 37); }
  return { modeles, nature: { saison: { theme: 'foret', neige: false } }, meteo: { pluie: 1 },
    course: { c: {}, voitures: [{ id: 0, etat: { v: 35 } }, { id: 1, etat: { v: 12 } }] },
    eauCarrosserieTemps: 0, eauCarrosseriePoint: new Float64Array(3) };
}
const poses = [{ x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 }, { x: 25, y: 0, z: 5, cap: .7, tangage: .1, roulis: -.1 }];
const etatPhysique = e => JSON.stringify({ humide: e.humide, age: e.age, revisions: e.revisions,
  gouttes: e.gouttes.map(g => [g.u, g.v, g.force]) });

test('mise à jour commune : pluie reçue par voiture, toit propre à sa pose et pause sans vieillissement', () => {
  const S = seance(), point = S.eauCarrosseriePoint;
  for (let n = 0; n < 60; n++) raccord.majEauCarrosserie(S, poses, 1 / 60, { pluie: .75, precipitationsNeige: false });
  const [a, b] = S.modeles.map(m => m.eauCarrosserie);
  assert(a.humide > 0 && a.actives > 0); assert.equal(b.humide, 0); assert.equal(b.actives, 0);
  const [verreA, verreB] = S.modeles.map(m => m.surfaceVerre);
  assert(verreA.mouillage > 0 && !verreA.abri);
  assert.equal(verreB.mouillage, 0); assert.equal(verreB.abri, true);
  const phase = verreA.phase;
  assert(Math.abs(a.age - 1) < 1e-12); assert.equal(a.revisions, 60); assert.strictEqual(S.eauCarrosseriePoint, point);
  const avant = etatPhysique(a), temps = S.eauCarrosserieTemps;
  for (let n = 0; n < 5; n++) raccord.majEauCarrosserie(S, poses, 0, { pluie: 1 });
  assert.equal(etatPhysique(a), avant); assert.equal(S.eauCarrosserieTemps, temps); assert.equal(verreA.phase, phase);
});

test('cockpit, extérieur et rétros reposent les mêmes gouttes ; distance et qualité bornent leur coût', () => {
  const S = seance(), e = S.modeles[0].eauCarrosserie, ev = { p: [0, 0, 0], cap: .8, tangage: .1, roulis: -.05, v: 35 };
  for (let n = 0; n < 120; n++) raccord.majEauCarrosserie(S, poses, 1 / 60, { pluie: 1 });
  const avant = etatPhysique(e), point = e.gouttes[0].objet.p, rotation = e.gouttes[0].objet.r;
  const sortie = [], matrice = V.poser(S.modeles[0], ev, sortie, { detail: 'complet' });
  sortie.length = 0;
  raccord.poserEauCarrosserie(S, 0, ev, sortie, 'complet', false, matrice, 1, .4, 900, 'high');
  assert(sortie.length > 0 && sortie.length <= 192);
  const dehors = sortie.map(o => [o, [...o.p], [...o.r], [...o.s]]);
  sortie.length = 0;
  raccord.poserEauCarrosserie(S, 0, ev, sortie, 'complet', true, matrice, 1, .4, 900, 'high');
  assert.equal(sortie.length, dehors.length);
  sortie.forEach((o, k) => { assert.strictEqual(o, dehors[k][0]); assert.deepEqual([...o.p], dehors[k][1]);
    assert.deepEqual([...o.r], dehors[k][2]); assert.deepEqual([...o.s], dehors[k][3]); assert.equal(o.overlay, true); });
  sortie.length = 0;
  raccord.poserEauCarrosserie(S, 0, ev, sortie, 'complet', false, matrice, 1, .4, 900, 'low');
  assert(sortie.length > 0 && sortie.length <= 12);
  sortie.length = 0;
  raccord.poserEauCarrosserie(S, 0, ev, sortie, 'complet', false, matrice, 100, .4, 80, 'high');
  assert.equal(sortie.length, 0, 'les perles sous-pixel ne sont pas envoyées aux petites glaces');
  assert.equal(etatPhysique(e), avant); assert.strictEqual(e.gouttes[0].objet.p, point); assert.strictEqual(e.gouttes[0].objet.r, rotation);
});

test('carrosserie sèche : horloge unique conservée sans accès aux 192 perles invisibles', () => {
  const S = seance(), e = S.modeles[0].eauCarrosserie, gouttes = e.gouttes, couleurs = e.couleurs;
  let lectures = 0;
  for (const [nom, valeur] of [['gouttes', gouttes], ['couleurs', couleurs]])
    Object.defineProperty(e, nom, { configurable: true, get() { lectures++; return valeur; } });
  for (let n = 1; n <= 30; n++) {
    // Sec, neige ou pluie au-dessus d'un toit : aucun dépôt liquide sur une voiture sèche.
    const neige = n % 3 === 1, abri = n % 3 === 2;
    assert.equal(E.mettreAJour(e, 1 / 60, { pluie: neige || abri ? 1 : 0, precipitationsNeige: neige }, 35, abri, n, poses[0]), true);
  }
  assert.equal(lectures, 0, 'le coût au sec ne dépend pas du nombre de perles ni de pièces peintes');
  assert.equal(e.humide, 0); assert.equal(e.actives, 0); assert.equal(e.pluie, 0);
  assert.equal(e.revisions, 30); assert(Math.abs(e.age - .5) < 1e-12); assert.equal(e.dernierInstant, 30);
  assert.equal(E.mettreAJour(e, 0, { pluie: 1 }, 35, false, 31, poses[0]), false);
  assert.equal(E.mettreAJour(e, 1 / 60, { pluie: 1 }, 35, false, 30, poses[0]), false);
  assert.equal(e.revisions, 30); assert.equal(lectures, 0);
});

test('fin de séchage et pluie suivante : mêmes attaches, couleurs et reprise que sur une carrosserie neuve', () => {
  const S = seance(), e = S.modeles[0].eauCarrosserie;
  const autre = V.modele({ couleur: [.8, .12, .1], numero: 1 }); V.preparerPneusService(autre);
  const reference = E.preparer(autre, 37), pose = { tangage: .15, roulis: -.2 };
  const identites = e.gouttes.map(g => [g, g.objet, g.local, g.repere]);
  let instant = 0;
  for (let n = 0; n < 30; n++) E.mettreAJour(e, .1, { pluie: 1 }, 75, false, ++instant, pose);
  assert(e.humide > .7 && e.actives > 0);
  assert(e.couleurs.some(c => c.couleur.some((x, k) => x !== c.base[k])));
  for (let n = 0; n < 600 && e.humide > 0; n++) E.mettreAJour(e, .1, { pluie: 0 }, 75, false, ++instant, pose);
  assert.equal(e.humide, 0); assert.equal(e.actives, 0);
  assert.deepEqual([...e.deplacement], [0, 0, 0]);
  for (const g of e.gouttes) { assert.equal(g.u, g.u0); assert.equal(g.v, g.v0); assert.equal(g.force, 0); }
  for (const c of e.couleurs) assert.deepEqual([...c.couleur], [...c.base]);
  // Une longue partie sèche ne change ni la graine ni l'emplacement du prochain dépôt.
  for (let n = 0; n < 30; n++) E.mettreAJour(e, .1, { pluie: 0 }, -12, false, ++instant, { tangage: -.1, roulis: .3 });
  for (const etat of [e, reference]) E.mettreAJour(etat, .1, { pluie: .45 }, 35, false, ++instant, pose);
  assert.equal(e.humide, reference.humide); assert.equal(e.actives, reference.actives);
  e.gouttes.forEach((g, i) => {
    assert.strictEqual(g, identites[i][0]); assert.strictEqual(g.objet, identites[i][1]);
    assert.strictEqual(g.local, identites[i][2]); assert.strictEqual(g.repere, identites[i][3]);
    const r = reference.gouttes[i];
    assert.deepEqual([g.u, g.v, g.force, g.allongement, ...g.local, ...g.repere], [r.u, r.v, r.force, r.allongement, ...r.local, ...r.repere]);
  });
  assert.deepEqual(e.couleurs.map(c => [...c.couleur]), reference.couleurs.map(c => [...c.couleur]));
});
