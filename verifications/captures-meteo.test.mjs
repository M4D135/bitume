import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionsMeteo, optionsScenario, SCENARIOS, verifierRapport } from '../tools/captures-meteo.mjs';
import { optionsCapture } from '../tools/controle-visuel.mjs';

test('options de capture bornées, cas explicites et URL valides', () => {
  const base = ['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/images'];
  assert.equal(optionsMeteo(base).cas.length, 10);
  assert.deepEqual(optionsMeteo([...base, '--cas', 'neige45,duo']).cas, ['neige45', 'duo']);
  for (const suite of [['--cas', 'inconnu'], ['--cas', 'duo,duo'], ['--taille', '9000,1'], ['--test', 'oui'], ['--chrome']])
    assert.throws(() => optionsMeteo([...base, ...suite]));
  assert.throws(() => optionsMeteo(['--url', 'javascript:alert(1)', '--sortie', '/tmp/a']));
  assert.ok(Math.abs(SCENARIOS.find(s => s.id === 'pluie-spray235').vitesse * 3.6 - 235) < 1e-10);
  assert.ok(SCENARIOS.every(s => s.chauffe >= 0 && s.chauffe <= 120 && (s.images || 2) <= 3));
  assert.equal(optionsCapture([...base, '--images', '2']).images, 2);
  assert.throws(() => optionsCapture([...base, '--images', '1']));
  for (const s of SCENARIOS) {
    const p = optionsScenario(s, 'file:///tmp/bitume.html', '/tmp/qa/' + s.id, { taille: '960,540' });
    assert.equal(p.images, s.pause ? 3 : 2, s.id);
    assert.equal(p.referenceJeu.vitesse, s.vitesse, s.id);
  }
});

function rapport(s, patch = {}) {
  const optique = { backend: 'webgl2', pret: true, erreur: null, erreurs: [], perdu: false, dessins: 60, etapes: 720, copiesScene: 60, pixelsSource: 518400 };
  return { erreurs: [], avertissements: [], environnement: { gpu: 'ANGLE SwiftShader' }, images: Array.from({ length: s.images || 2 }, (_, i) => ({
    etat: { zones: { scene: {}, scene2: {}, 'glace-g': {}, 'glace-d': {}, 'glace-g2': {}, 'glace-d2': {} } },
    observation: { glErreur: 0, glPerdu: false, vitres: { j1: structuredClone(optique), j2: structuredClone(optique) },
      j1: { pluie: s.sec ? 0 : s.saison === 'hiver' ? 0 : 1, neige: s.saison === 'hiver' ? 1 : 0, embruns: s.spray ? .6 : 0, abri: !!s.tunnel },
      j2: {}, ecran: s.pause && i < 2 ? 'pause' : 'course', temps: s.pause && i < 2 ? 9 : 9.1, ...structuredClone(patch) } })) };
}

test('erreurs de page, GL et repli optique silencieux empêchent la qualification', () => {
  const s = SCENARIOS[0];
  assert.deepEqual(verifierRapport(rapport(s), s, true), []);
  assert.ok(verifierRapport(rapport(s, { glErreur: 1282 }), s, true).some(e => e.includes('WebGL')));
  assert.ok(verifierRapport(rapport(s, { vitres: { j1: { backend: 'canvas2d' } } }), s, true).some(e => e.includes('inactive')));
  assert.ok(verifierRapport(rapport(s, { vitres: { j1: { backend: 'webgl2', erreurs: 1 } } }), s, true).some(e => e.includes('visière')));
  for (const mauvais of [{ erreur: 'shader invalid' }, { pret: false }, { dessins: 0 }, { copiesScene: 0 }, { pixelsSource: 0 }]) {
    const r = rapport(s); Object.assign(r.images[0].observation.vitres.j1, mauvais);
    assert.ok(verifierRapport(r, s, true).length, JSON.stringify(mauvais));
  }
  assert.ok(verifierRapport(rapport(s, { vitresGL: { j1: { present: true, erreur: 1282, perdu: false } } }), s, true).some(e => e.includes('WebGL')));
  const noir = rapport(s); noir.images[0].vues = { scene: { noir: 1, luminance: 0 } };
  assert.ok(verifierRapport(noir, s, true).some(e => e.includes('noire')));
  assert.deepEqual(verifierRapport(rapport(s, { vitres: null }), s, false), []); // le build ancien n'a pas le diagnostic
  const r = rapport(s); r.erreurs.push('Shader invalid');
  assert.ok(verifierRapport(r, s, true).some(e => e.includes('Erreur page')));
});

test('nuage rival, neige, tunnel et seconde vue sont vraiment exercés', () => {
  for (const s of SCENARIOS.filter(s => ['pluie-spray235', 'neige45', 'tunnel', 'duo'].includes(s.id))) {
    const r = rapport(s); assert.deepEqual(verifierRapport(r, s, true), []);
    if (s.spray) r.images[0].observation.j1.embruns = 0;
    if (s.tunnel) r.images[0].observation.j1.abri = false;
    if (s.saison === 'hiver') r.images[0].observation.j1.pluie = 1;
    if (s.duo) delete r.images[0].etat.zones['glace-g2'];
    assert.ok(verifierRapport(r, s, true).length > 0, s.id);
  }
});

test('pause figée puis reprise vérifiées sur l’horloge observée', () => {
  const s = SCENARIOS.find(s => s.pause), r = rapport(s);
  assert.deepEqual(verifierRapport(r, s, true), []);
  r.images[1].observation.temps += .1;
  assert.ok(verifierRapport(r, s, true).some(e => e.includes('Horloge')));
});
