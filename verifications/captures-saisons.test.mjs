import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { optionsSaisons, scenariosSaisons, optionsScenarioSaisons, verifierSaisons, preparerSaisons, foretLibreSaisons } from '../tools/captures-saisons.mjs';

test('couverture des onze circuits du menu et quatre saisons, plus été/hiver sur la roche alpine', () => {
  const o = optionsSaisons(['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/saisons']);
  const scenes = scenariosSaisons(o); assert.equal(scenes.length, 46);
  for (let i = 0; i < 11; i++) assert.deepEqual(scenes.filter(s => s.circuit === i && !s.alpin).map(s => s.saison), ['printemps', 'ete', 'automne', 'hiver']);
  assert.deepEqual(scenes.filter(s => s.alpin).map(s => [s.id, s.saison]), [['route-des-cimes', 'ete'], ['route-des-cimes', 'hiver']]);
  assert(scenes.every(s => Number.isFinite(s.depart)));
  for (const s of scenes) {
    const p = optionsScenarioSaisons(s, o, '/tmp/' + s.nom);
    assert.equal(p.images, 2); assert.equal(p.referenceJeu.circuit, s.circuit); assert.equal(p.referenceJeu.saison, s.saison);
    assert.equal(p.referenceJeu.meteo, 'sec'); assert.equal(p.referenceJeu.moment, 'jour');
  }
});
test('job ciblé par circuit/palier et options ambiguës refusées', () => {
  const a = ['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/saisons'];
  const o = optionsSaisons([...a, '--circuits', '8', '--saisons', 'ete,hiver', '--qualite', 'low', '--alpin', 'non']);
  assert.equal(scenariosSaisons(o).length, 2);
  for (const extra of [['--circuits', '8,8'], ['--circuits', '11'], ['--saisons', 'hiver,foo'], ['--alpin', 'peut-etre'], ['--qualite', 'fake']]) assert.throws(() => optionsSaisons([...a, ...extra]));
});
test('le vérificateur refuse une caméra remplacée, les couronnes hivernales et une preuve absente', () => {
  const s = { id: 'route-des-cimes', saison: 'hiver' }, camera = { pos: [1, 2, 3], yaw: .3, pitch: .1, fov: 54 };
  const observation = { saison: s.saison, circuit: s.id, vue: 'poursuite', camera, cameraPrescrite: structuredClone(camera),
    glErreur: 0, glPerdu: false, obstruction: false, foretLibre: true, caducs: 2, branchesNues: 2, couronnesCaduques: 0, sourcesFeuilles: 0 };
  const r = { build: { sha256: 'a'.repeat(64) }, source: { commit: 'b'.repeat(40) },
    environnement: { webgl2: true, physx: { ready: true } },
    initialisation: { modeleReel: true, controleForet: 'enveloppes-troncs-9-rayons', arbre: { essence: 'feuillu' } }, images: [{ observation }, { observation }] };
  assert.deepEqual(verifierSaisons(r, s), []);
  const faux = structuredClone(r); faux.images[0].observation.camera.pos[0] += 2; assert(verifierSaisons(faux, s).some(e => /Caméra/.test(e)));
  const feuilles = structuredClone(r); feuilles.images[0].observation.couronnesCaduques = 1; assert(verifierSaisons(feuilles, s).some(e => /hivernaux/.test(e)));
  const masque = structuredClone(r); masque.images[0].observation.foretLibre = false; assert(verifierSaisons(masque, s).some(e => /houppier/.test(e)));
  const persistant = structuredClone(r); persistant.initialisation.arbre.essence = 'conifere'; assert(verifierSaisons(persistant, s).some(e => /caduc/.test(e)));
  assert(verifierSaisons({ images: [] }, s).length >= 3);
});

test('Cimes : le cadrage réel masqué est refusé, un caduc dégagé reste identique aux quatre saisons', async () => {
  const { B, CATALOGUE_SAISONS, creerCircuitSaisons } = await import('../tools/qualification/saisons-circuits.mjs');
  const { chargerPhysX } = await import('./helpers/physx-runtime.mjs');
  const require = createRequire(import.meta.url);
  for (const n of ['cinema', 'obstacles', 'solides-physx']) require('../src/' + n + '.js');
  const X = await chargerPhysX(), sauvegarde = { BITUME_JEU: globalThis.BITUME_JEU, __SAISONS_CAPTURE: globalThis.__SAISONS_CAPTURE };
  try {
    for (const qualite of ['low', 'high']) {
      const index = CATALOGUE_SAISONS.findIndex(k => k.id === 'route-des-cimes');
      const c = creerCircuitSaisons(CATALOGUE_SAISONS[index]);
      const ete = B.decor.construire(c, { qualite, vegetation: false, saison: 'ete' });
      // Les 2 600 candidats par défaut sont ceux du jeu capturé, pas une petite forêt de test.
      const arbres = ete.lotsHerbier.flatMap(l => l.objets).filter(o => o.collision === 'tronc' && o.essenceArbre);
      assert(arbres.length > 700, 'vraie densité de la scène capturée');
      // Position observée dans la CI initiale 259ed2b : un persistant emplit le premier plan.
      const ancienSujet = arbres.find(o => Math.hypot(o.p[0] - 776.900039443718, o.p[2] + 722.773084355104) < 1e-7);
      assert(ancienSujet); assert.equal(ancienSujet.essenceArbre, 'feuillu');
      assert.equal(foretLibreSaisons(arbres, ancienSujet, [776.7222220526468, 33.62042304493631, -756.9826756831799]), false);
      c.obstacles = B.obstacles.creer(ete.obstacles);
      const world = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1, contacts: true });
      let montage;
      try {
        montage = B.solidesPhysX.installer(world, c, ete);
        let reference;
        for (const saison of B.saisons.IDS) {
          const d = saison === 'ete' ? ete : B.decor.construire(c, { qualite, vegetation: false, saison });
          globalThis.BITUME_JEU = { CATALOGUE: CATALOGUE_SAISONS, reglages: {}, scene: { decor: d },
            session: { reference: true, course: { c, physique: { world } } } };
          const r = preparerSaisons({ id: 'route-des-cimes', circuit: index, saison, depart: 1400, alpin: false });
          assert.equal(r.arbre.essence, 'feuillu');
          assert.equal(r.controleForet, 'enveloppes-troncs-9-rayons');
          assert.equal(globalThis.__SAISONS_CAPTURE.verifierForet(r.camera.pos), true, 'neuf visées PhysX réelles et enveloppes libres');
          const sujet = arbres.find(o => o.p.every((v, k) => v === r.arbre.p[k]));
          assert(sujet);
          assert.equal(foretLibreSaisons(arbres, sujet, r.camera.pos, () => false), false, 'une obstruction physique ne peut être ignorée');
          const h = sujet.s[1] / .84, sol = sujet.p[1] - sujet.s[1] / 2;
          assert(Math.abs(r.cible[1] - sol - h * .6) < 1e-9, 'silhouette centrée plutôt que cime');
          const empreinte = JSON.stringify({ camera: r.camera, cible: r.cible, arbre: r.arbre });
          if (reference) assert.equal(empreinte, reference, 'caméra strictement identique entre les quatre saisons');
          else reference = empreinte;
        }
        const alpin = preparerSaisons({ id: 'route-des-cimes', circuit: index, saison: 'hiver', depart: 4750, alpin: true });
        assert.equal(alpin.controleForet, null); assert.equal(alpin.arbre, null, 'fallback alpin préservé');
      } finally { if (montage) B.solidesPhysX.liberer(montage); world.dispose(); }
    }
  } finally {
    X.dispose();
    for (const [cle, valeur] of Object.entries(sauvegarde)) {
      if (valeur === undefined) delete globalThis[cle]; else globalThis[cle] = valeur;
    }
  }
});
