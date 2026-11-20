import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { optionsPierres, scenariosPierres, optionsScenarioPierres, pierreCible, preparerVariantePierres,
  viserPierres, empreintesPierres, verifierPierres, comparerPierres } from '../tools/captures-pierres.mjs';

test('la campagne A/B garde mêmes conditions et refuse les paliers ou variantes non prévus', () => {
  const args = ['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/pierres'];
  const o = optionsPierres(args), scenes = scenariosPierres(o);
  assert.equal(scenes.length, 8);
  assert.equal(scenes.length * 2, 16);
  for (let i = 0; i < scenes.length; i += 2) {
    const a = optionsScenarioPierres(scenes[i], o, '/tmp/a'), b = optionsScenarioPierres(scenes[i + 1], o, '/tmp/b');
    assert.deepEqual(a.referenceJeu, b.referenceJeu);
    assert.equal(a.referenceJeu.qualite, 'high'); assert.equal(a.referenceJeu.vitesse, 0); assert.equal(a.referenceJeu.retro, 'non');
    assert.deepEqual(scenes.slice(i, i + 2).map(s => s.variante), ['reference', 'procedurale']);
  }
  assert.equal(scenariosPierres(optionsPierres([...args, '--vues', 'route-des-cimes-pont', '--saisons', 'hiver'])).length, 2);
  for (const extra of [['--vues', 'inconnu'], ['--vues', 'haut-col-portail,haut-col-portail'], ['--saisons', 'ete,ete'],
    ['--saisons', 'printemps'], ['--qualite', 'low'], ['--variante', 'procedurale'], ['--taille', '0,0']]) assert.throws(() => optionsPierres([...args, ...extra]));
});

test('les vues et la fixture M1 passent sur les vrais décors et le monde PhysX, sans mutation géométrique', async () => {
  const { B, CATALOGUE_SAISONS, creerCircuitSaisons } = await import('../tools/qualification/saisons-circuits.mjs');
  const { chargerPhysX } = await import('./helpers/physx-runtime.mjs');
  const require = createRequire(import.meta.url);
  for (const n of ['cinema', 'obstacles', 'solides-physx']) require('../src/' + n + '.js');
  const X = await chargerPhysX();
  try {
    const o = optionsPierres(['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/pierres']);
    for (const s of scenariosPierres(o).filter(s => s.variante === 'reference')) {
      const c = creerCircuitSaisons(CATALOGUE_SAISONS[s.circuit]);
      const d = B.decor.construire(c, { qualite: 'high', saison: s.saison, vegetation: false, solsProceduraux: true });
      const objets = d.lots.flatMap(l => l.objets), cibles = objets.filter(pierreCible);
      assert(cibles.length > 250); assert(cibles.every(o => o.mat === 23));
      const eau = objets.filter(o => o.mat === 9 && !pierreCible(o));
      assert(eau.length > 0, 'matière 9 hors des pierres ciblées réellement présente');
      const avant = await empreintesPierres(d), unique = new Set(d.lots.flatMap(l => [...l.objets, ...(l.loin || [])]).filter(pierreCible));
      const selection = preparerVariantePierres(d, 'reference');
      assert.equal(selection.uniques, unique.size);
      assert([...unique].every(o => o.mat === 9)); assert(eau.every(o => o.mat === 9));
      assert.deepEqual(await empreintesPierres(d), avant, 'identité de scène entière, hors recette M1');
      assert.throws(() => preparerVariantePierres(d, 'reference'), /build/, 'un témoin ne doit pas être remappé deux fois');
      assert.equal(pierreCible({ mat: 9, collision: 'roche' }), false);
      assert.equal(pierreCible({ mat: 9, solidePhysX: { genre: 'refuge-cimes' }, partie: 'mur-refuge' }), false);
      assert.equal(pierreCible({ mat: 3, solidePhysX: { genre: 'portail-tunnel' } }), false);
      c.obstacles = B.obstacles.creer(d.obstacles);
      const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1, contacts: true }); let solids;
      try {
        solids = B.solidesPhysX.installer(world, c, d);
        const cam = B.cinema.viser(s.position, s.cible, s.fov), r = viserPierres(world, solids, cam, s, d.sol);
        assert(r.cibleDistance > 4);
        if (r.touchePierre) assert(s.genres.includes(r.genre));
        assert.throws(() => viserPierres(world, solids, { ...cam, pos: [cam.pos[0], d.sol(cam.pos[0], cam.pos[2]) - 1, cam.pos[2]] }, s, d.sol), /terrain/);
      } finally { if (solids) B.solidesPhysX.liberer(solids); world.dispose(); }
    }
  } finally { X.dispose(); }
});

// Faux reçus seulement pour exercer les refus du vérificateur, jamais pour simuler un renderer.
function recu() {
  const s = { circuitId: 'haut-col', saison: 'ete', variante: 'reference' }, camera = { pos: [1, 2, 3], yaw: .1, pitch: .2, fov: 44 };
  const observation = { ...s, circuit: s.circuitId, camera, cameraPrescrite: structuredClone(camera), glErreur: 0, glPerdu: false,
    matieres: { uniques: 278, genres: { 'roche-tunnel': 272, 'portail-tunnel': 6 }, matiere: 9 },
    empreintes: Object.fromEntries(['lotsSansRecette', 'nappes', 'solides', 'obstacles', 'racines'].map(k => [k, 'a'.repeat(64)])),
    rendu: { drawCalls: 100, triangles: 1000, instances: 500 },
    cout: { mesures: 16, echantillonsMs: Array(16).fill(20), p50Ms: 20, simulationInchangee: true } };
  return { s, r: { build: { sha256: 'b'.repeat(64) }, source: { commit: 'c'.repeat(40) },
    parametres: { qualite: 'high', saison: 'ete' }, environnement: { webgl2: true, physx: { ready: true } },
    initialisation: { modeleReel: true, methode: 'fixture-matiere-meme-build' }, images: [{ observation }, { observation }] } };
}
test('une caméra remplacée, une mesure absente ou une comparaison géométriquement différente échoue', () => {
  const { s, r } = recu(); assert.deepEqual(verifierPierres(r, s), []);
  const camera = structuredClone(r); camera.images[0].observation.camera.pos[0] += 1;
  assert(verifierPierres(camera, s).some(e => /Caméra/.test(e)));
  const temps = structuredClone(r); temps.images[1].observation.cout = null;
  assert(verifierPierres(temps, s).some(e => /Mesure/.test(e)));
  const recette = structuredClone(r); recette.images[0].observation.matieres.matiere = 23;
  assert(verifierPierres(recette, s).some(e => /Recette/.test(e)));
  assert(verifierPierres({ images: [] }, s).length >= 3);
  const autre = structuredClone(r); assert.deepEqual(comparerPierres(r, autre).erreurs, []);
  autre.images[1].observation.empreintes.solides = 'd'.repeat(64);
  assert(comparerPierres(r, autre).erreurs.some(e => /empreintes/.test(e)));
  autre.images[0].observation.rendu.triangles++;
  assert(comparerPierres(r, autre).erreurs.some(e => /rendu/.test(e)));
  autre.build.sha256 = 'e'.repeat(64);
  assert(comparerPierres(r, autre).erreurs.some(e => /Builds/.test(e)));
});
