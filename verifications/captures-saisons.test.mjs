import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optionsSaisons, scenariosSaisons, optionsScenarioSaisons, verifierSaisons } from '../tools/captures-saisons.mjs';

test('couverture des neuf circuits et quatre saisons, plus été/hiver sur la roche alpine', () => {
  const o = optionsSaisons(['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/saisons']);
  const scenes = scenariosSaisons(o); assert.equal(scenes.length, 38);
  for (let i = 0; i < 9; i++) assert.deepEqual(scenes.filter(s => s.circuit === i && !s.alpin).map(s => s.saison), ['printemps', 'ete', 'automne', 'hiver']);
  assert.deepEqual(scenes.filter(s => s.alpin).map(s => s.saison), ['ete', 'hiver']);
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
  for (const extra of [['--circuits', '8,8'], ['--circuits', '9'], ['--saisons', 'hiver,foo'], ['--alpin', 'peut-etre'], ['--qualite', 'fake']]) assert.throws(() => optionsSaisons([...a, ...extra]));
});
test('le vérificateur refuse une caméra remplacée, les couronnes hivernales et une preuve absente', () => {
  const s = { id: 'route-des-cimes', saison: 'hiver' }, camera = { pos: [1, 2, 3], yaw: .3, pitch: .1, fov: 54 };
  const observation = { saison: s.saison, circuit: s.id, vue: 'poursuite', camera, cameraPrescrite: structuredClone(camera),
    glErreur: 0, glPerdu: false, obstruction: false, caducs: 2, branchesNues: 2, couronnesCaduques: 0, sourcesFeuilles: 0 };
  const r = { build: { sha256: 'a'.repeat(64) }, source: { commit: 'b'.repeat(40) },
    environnement: { webgl2: true, physx: { ready: true } }, initialisation: { modeleReel: true }, images: [{ observation }, { observation }] };
  assert.deepEqual(verifierSaisons(r, s), []);
  const faux = structuredClone(r); faux.images[0].observation.camera.pos[0] += 2; assert(verifierSaisons(faux, s).some(e => /Caméra/.test(e)));
  const feuilles = structuredClone(r); feuilles.images[0].observation.couronnesCaduques = 1; assert(verifierSaisons(feuilles, s).some(e => /hivernaux/.test(e)));
  assert(verifierSaisons({ images: [] }, s).length >= 3);
});
