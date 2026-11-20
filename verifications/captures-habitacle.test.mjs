import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionsHabitacle, optionsScenarioHabitacle, SCENARIOS_HABITACLE, verifierHabitacle } from '../tools/captures-habitacle.mjs';

test('inspection bornée à neuf scènes et deux images, vrais cockpits et LOD par distance', () => {
  const base = ['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/habitacle'];
  const o = optionsHabitacle(base);
  assert.equal(o.cas.length, 9);
  for (const s of SCENARIOS_HABITACLE) {
    const p = optionsScenarioHabitacle(s, o.url, '/tmp/' + s.id, o);
    assert.equal(p.images, 2); assert.equal(p.referenceJeu.vue, s.cockpit ? 'cockpit' : 'poursuite');
    assert.equal(p.referenceJeu.retro, s.cockpit ? 'oui' : 'non');
    assert.deepEqual(p.taille, s.taille ? [540, 960] : [960, 540]);
  }
  for (const ajout of [['--cas', 'face,face'], ['--cas', 'inconnu'], ['--taille', '2,2'], ['--forcing', 'simple'], ['--avant', 'https://example.com/a']])
    assert.throws(() => optionsHabitacle([...base, ...ajout]));
  assert.throws(() => optionsHabitacle([...base, '--url', 'file:///tmp/b.html']));
});

function rapport(s) {
  const cam = { pos: [1, 2, 3], yaw: .2, pitch: -.1, roll: 0, fov: 40 };
  const o = { type: 'course', ecran: 'course', vue: s.cockpit ? 'cockpit' : 'poursuite', cameraImposee: !s.cockpit,
    camera: cam, cameraPrescrite: s.cockpit ? null : structuredClone(cam), glErreur: 0, glPerdu: false,
    obstructionStatique: false, volant: s.volant || 0, rapport: 3, rapportAvant: s.passage ? 2 : 3, passage: .5,
    expression: { geste: s.geste || null, gesteIntensite: s.geste ? 1 : 0 },
    variantes: s.lod ? [{ indice: s.lod === 'moyen' ? 6 : 2, niveau: s.lod === 'moyen' ? 1 : 2, pieces: 30 }] : [],
    articulations: Array(18).fill(0), formes: { 'pilote-casque': [], 'pilote-visiere': [] },
    instruments: { plancheAttendue: 54, plancheRendue: 54, aiguillesRendues: 3, supportsRendus: 5, retrosRendus: 2 } };
  return { source: { commit: 'a'.repeat(40) }, build: { sha256: 'b'.repeat(64) },
    environnement: { webgl2: true, physx: { ready: true }, resolution: s.taille ? [540, 960, 1] : [960, 540, 1] },
    initialisation: { entree: 'BITUME_JEU.reference', posesPrescrites: true }, erreurs: [], avertissements: [],
    images: Array.from({ length: 2 }, () => ({ observation: structuredClone(o), etat: { zones: { scene: {}, ...(s.cockpit ? { 'glace-g': {}, 'glace-d': {} } : {}) } },
      vues: { scene: { noir: .1, luminance: .5 } } })) };
}

test('identité exacte, caméra finale et état WebGL sont nécessaires même pour la référence', () => {
  const s = SCENARIOS_HABITACLE[0], r = rapport(s);
  assert.deepEqual(verifierHabitacle(r, s), []);
  for (const changer of [
    r => { r.build.sha256 = ''; }, r => { r.source.commit = null; }, r => { r.environnement.physx.ready = false; },
    r => { r.images[0].observation.camera = null; }, r => { r.images[0].observation.camera.pos[0] += 1; },
    r => { r.images[0].observation.cameraPrescrite.pitch = NaN; }, r => { r.images[0].observation.obstructionStatique = true; },
    r => { r.images[0].observation.glErreur = 1282; }, r => { r.images[0].observation.cameraImposee = false; }
  ]) {
    const faux = structuredClone(r); changer(faux); assert(verifierHabitacle(faux, s, false).length);
  }
});

test('les instruments réellement présents sont distincts du modèle disponible et des anciens manques', () => {
  const s = SCENARIOS_HABITACLE[0], r = rapport(s);
  for (const changer of [
    o => { o.instruments.aiguillesRendues = 0; }, o => { o.instruments.plancheRendue = 2; },
    o => { o.instruments.retrosRendus = 1; }, o => { o.instruments.supportsRendus = 0; },
    o => { o.articulations = null; }, o => { o.articulations[3] = NaN; }
  ]) {
    const faux = structuredClone(r); changer(faux.images[0].observation);
    assert(verifierHabitacle(faux, s, true).length); assert.deepEqual(verifierHabitacle(faux, s, false), []);
  }
});

test('cockpit, passage, geste, portrait et LOD refusent leurs faux positifs', () => {
  for (const s of SCENARIOS_HABITACLE) assert.deepEqual(verifierHabitacle(rapport(s), s), [], s.id);
  for (const [id, changer] of [
    ['cockpit', r => { r.images[0].observation.cameraImposee = true; }],
    ['cockpit', r => { delete r.images[0].etat.zones['glace-g']; }],
    ['cockpit', r => { r.images[0].observation.formes['pilote-casque'].push({}); }],
    ['cockpit-portrait', r => { r.environnement.resolution = [960, 540, 1]; }],
    ['braquage-passage', r => { r.images[0].observation.passage = 1; }],
    ['braquage-passage', r => { r.images[0].observation.volant = 0; }],
    ['geste-majeur', r => { r.images[0].observation.expression.gesteIntensite = .1; }],
    ['lod-moyen', r => { r.images[0].observation.variantes[0].niveau = 0; }],
    ['lod-simple', r => { r.images[0].observation.variantes = []; }]
  ]) {
    const s = SCENARIOS_HABITACLE.find(s => s.id === id), faux = rapport(s); changer(faux);
    assert(verifierHabitacle(faux, s).length, id);
  }
});
