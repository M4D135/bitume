import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { optionsDemo, optionsScenario, SCENARIOS, verifierRapport, preparerEtat, observerEtat } from '../tools/captures-demo.mjs';

const base = ['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/qualification'];
function rapport(s) {
  const lentille = s.aerien ? 0 : s.vue === 'poursuite' ? .7 : .8;
  const o = { type: 'demo', ecran: 'demo', cameraImposee: false, gardeDisponible: true, vue: s.attendu,
    plan: { vue: s.attendu, motif: s.realisation ? 'expression' : s.refus ? 'cadre' : 'course', sujet: 0 },
    camera: { pos: [0, 2, 0], yaw: 0, pitch: -.1, fov: 34, secours: false }, obstruction: { hit: false },
    saison: s.saison, glErreur: 0, glPerdu: false,
    faune: s.faune ? { y: 1, sol: 1, fractionHauteur: .16 } : null,
    volants: s.pilote ? [{ p: [0, 1, 0], r: [0, 0, .4] }] : [], volant: s.volant || 0,
    pilote: s.geste ? { geste: s.geste, gesteIntensite: 1 } : null,
    sillage: s.spray ? { rival: 1, sources: [{ id: 1, exposition: .76 }], casque: .76, lentille } : null,
    vitrage: { actif: !s.aerien, pluie: s.pluie ? 1 : 0, neige: 0, embruns: lentille }, vitreVisible: !s.aerien,
    vitres: { j1: { backend: 'webgl2', pret: true, erreur: null, erreurs: 0, perdu: false, eau: s.aerien ? 0 : 20, embruns: lentille,
      gouttes: s.aerien ? 0 : 20, neige: 0, accumulationNeige: 0, depotsEmbruns: s.aerien ? 0 : 600, expulses: 250 } } };
  return { initialisation: { entree: 'BITUME_JEU.demo', cameraImposee: false }, environnement: { gpu: 'ANGLE SwiftShader' }, erreurs: [], avertissements: [],
    images: Array.from({ length: s.images }, () => ({ observation: structuredClone(o), vues: { scene: { noir: .02, luminance: .4 } } })) };
}
function rejette(s, changer, attendu) {
  const r = rapport(s); changer(r, r.images[0].observation);
  assert(verifierRapport(r, s).some(e => e.includes(attendu)), JSON.stringify(verifierRapport(r, s)));
}

test('les scénarios CI couvrent chaque plan déclaré avec des options bornées', () => {
  const o = optionsDemo(base); assert.equal(o.cas.length, 12);
  assert.deepEqual(optionsDemo([...base, '--cas', 'tele-montagne,faune-hiver']).cas, ['tele-montagne', 'faune-hiver']);
  for (const suite of [['--cas','inconnu'], ['--cas','faune-ete,faune-ete'], ['--taille','9000,1'], ['--url','file:///autre'], ['--inconnu','oui'], ['--chrome']])
    assert.throws(() => optionsDemo([...base, ...suite]));
  assert.throws(() => optionsDemo(['--url','javascript:alert(1)','--sortie','/tmp/images']));
  const workflow = readFileSync(new URL('../.github/workflows/visuel-demo.yml', import.meta.url), 'utf8');
  const cas = [...workflow.matchAll(/^\s+cas: (.+)$/gm)].flatMap(m => m[1].split(','));
  assert.equal(new Set(cas).size, cas.length); assert.deepEqual(cas.sort(), SCENARIOS.map(s => s.id).sort());
  for (const s of SCENARIOS) {
    const p = optionsScenario(s, o.url, '/tmp/images/' + s.id, o);
    assert.equal(p.images, 3); assert.equal(p.referenceJeu.circuit, s.circuit); assert.equal(p.referenceJeu.saison, s.saison);
    assert.deepEqual(verifierRapport(rapport(s), s), [], s.id);
  }
  assert(!/J\.camera\s*=/.test(preparerEtat.toString()), 'le banc remplace la caméra du jeu');
});

test('une caméra imposée, une fausse séance ou une visée masquée ne qualifie pas la démo', () => {
  const s = SCENARIOS.find(s => s.refus);
  rejette(s, (_, o) => { o.cameraImposee = true; }, 'contourné');
  rejette(s, (_, o) => { delete o.cameraImposee; }, 'contourné');
  rejette(s, r => { r.initialisation.entree = 'camera libre'; }, 'non prouvée');
  rejette(s, (_, o) => { o.type = 'course'; }, 'contourné');
  rejette(s, (_, o) => { o.obstruction.hit = true; }, 'masquée');
  rejette(s, (_, o) => { o.camera = null; }, 'invalide');
  rejette(s, (_, o) => { o.camera.secours = true; }, 'non qualifié');
  rejette(s, (_, o) => { o.vue = s.vue; o.plan.vue = s.vue; }, 'attendu');
  rejette(s, (_, o) => { o.plan.motif = 'course'; }, 'explicitement');
});

test('la taille à l’écran, les appuis et la saison des bouquetins sont contrôlés', () => {
  const s = SCENARIOS.find(s => s.id === 'faune-hiver');
  for (const f of [.06, .3, NaN]) rejette(s, (_, o) => { o.faune.fractionHauteur = f; }, 'illisible');
  rejette(s, (_, o) => { o.faune.y += .5; }, 'appui');
  rejette(s, (_, o) => { o.camera.pitch = -.65; }, 'illisible');
  rejette(s, (_, o) => { o.saison = 'ete'; }, 'Saison');
  const ancien = rapport(s); ancien.images[0].observation.faune.fractionHauteur = .06;
  assert.deepEqual(verifierRapport(ancien, s, false), [], 'la référence conserve le défaut sans être présentée comme corrigée');
});

test('le volant extérieur et les trois gestes doivent être rendus par le bon plan', () => {
  for (const s of SCENARIOS.filter(s => s.pilote)) rejette(s, (_, o) => { o.volants = []; }, 'Volant');
  for (const s of SCENARIOS.filter(s => s.geste)) {
    rejette(s, (_, o) => { o.pilote.geste = null; }, 'Geste');
    rejette(s, (_, o) => { o.pilote.gesteIntensite = 0; }, 'Geste');
  }
  const s = SCENARIOS.find(s => s.realisation);
  rejette(s, (_, o) => { o.plan.motif = 'course'; }, 'réalisateur');
  rejette(SCENARIOS.find(s => s.volant < 0), (_, o) => { o.volant = 0; }, 'Braquage');
});

test('pluie en sillage et vue aérienne sans overlay sont des preuves distinctes', () => {
  for (const s of SCENARIOS.filter(s => s.pluie)) {
    for (const changer of [o => { o.vitres = null; }, o => { o.vitres.j1.backend = 'canvas2d'; },
      o => { o.vitres.j1.pret = false; }, o => { delete o.vitres.j1.pret; }, o => { o.vitres.j1.perdu = true; },
      o => { o.vitres.j1.erreur = 'shader'; }, o => { o.vitres.j1.erreurs = 1; }, o => { o.vitres.j1.erreurs = ['GL_INVALID_OPERATION']; }])
      rejette(s, (_, o) => changer(o), 'Diagnostic optique');
    for (const pluie of [0, undefined, NaN, Infinity]) rejette(s, (_, o) => { o.vitrage.pluie = pluie; }, 'non exercée');
  }
  for (const s of SCENARIOS.filter(s => s.pluie && !s.aerien)) {
    for (const cle of ['eau','gouttes','depotsEmbruns','expulses']) for (const valeur of [0, NaN, undefined, Infinity])
      rejette(s, (_, o) => { o.vitres.j1[cle] = valeur; }, 'non exercés');
    for (const embruns of [0, .05, .5]) rejette(s, (_, o) => { o.vitrage.embruns = embruns; }, 'non exercés');
    rejette(s, (_, o) => { o.sillage.sources.push({ id: 2, exposition: .6 }); }, 'seul rival');
    rejette(s, (_, o) => { o.sillage.sources = []; }, 'seul rival');
    rejette(s, (_, o) => { delete o.sillage.rival; }, 'seul rival');
    rejette(s, (_, o) => { o.sillage.sources[0].id = o.sillage.rival = o.plan.sujet; }, 'seul rival');
    rejette(s, (_, o) => { o.sillage.sources[0].id = 2; }, 'seul rival');
    rejette(s, (_, o) => { o.sillage.sources[0].exposition = 0; }, 'seul rival');
    for (const casque of [0, .5, 1.1, NaN, undefined, Infinity]) rejette(s, (_, o) => { o.sillage.casque = casque; }, 'seul rival');
  }
  const s = SCENARIOS.find(s => s.aerien);
  rejette(s, (_, o) => { o.vitreVisible = true; }, 'Overlay');
  rejette(s, (_, o) => { o.vitrage.actif = true; }, 'Overlay');
  rejette(s, (_, o) => { delete o.vitreVisible; }, 'Overlay');
  rejette(s, (_, o) => { delete o.vitrage.actif; }, 'Overlay');
  for (const cle of ['eau','accumulationNeige','embruns','gouttes','neige']) for (const valeur of [1, NaN, undefined])
    rejette(s, (_, o) => { o.vitres.j1[cle] = valeur; }, 'Overlay');
  const historiques = rapport(s); historiques.images[0].observation.vitres.j1.expulses = 1800;
  assert.deepEqual(verifierRapport(historiques, s), [], 'un compteur cumulé ne prouve pas un overlay encore composé');
  for (const im of historiques.images) {
    assert(!Object.hasOwn(im.observation.vitres.j1, 'propre'));
    assert(!Object.hasOwn(im.observation.vitres.j1, 'masquee'));
  }
});

test('cockpit et poursuite exigent un fort panache cohérent à la lentille réellement composée', () => {
  for (const s of SCENARIOS.filter(s => s.spray)) {
    for (const valeur of [false, undefined]) {
      rejette(s, (_, o) => { o.vitreVisible = valeur; }, 'non exercés');
      rejette(s, (_, o) => { o.vitrage.actif = valeur; }, 'non exercés');
    }
    for (const valeur of [0, .05, .5, 1.1, NaN, undefined, Infinity])
      rejette(s, (_, o) => { o.sillage.lentille = valeur; }, 'lentille');
    for (const valeur of [0, .05, .5, .9, NaN, undefined, Infinity]) {
      rejette(s, (_, o) => { o.vitrage.embruns = valeur; }, 'lentille');
      rejette(s, (_, o) => { o.vitres.j1.embruns = valeur; }, 'lentille');
    }
    rejette(s, (_, o) => { o.sillage = null; }, 'seul rival');
    const faible = rapport(s);
    for (const im of faible.images) {
      const o = im.observation;
      o.sillage.lentille = o.vitrage.embruns = o.vitres.j1.embruns = .05;
      o.vitres.j1.depotsEmbruns = 0;
    }
    assert(verifierRapport(faible, s).length, 'l’ancien contrat à faible panache de la PR37 reste refusé');
  }
});

test('un seul rival à18m arrose le casque et la vraie hauteur de poursuite à235km/h', () => {
  const require = createRequire(import.meta.url); require('../src/circuit.js'); require('../src/sillage.js');
  const B = globalThis.BITUME, c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 }), p = B.circuit.echantillon(c, 280);
  const voitures = [], poses = [];
  for (let id = 0; id < 12; id++) {
    const s = 280 + (id === 0 ? 0 : id === 1 ? 18 : 120 + id * 12);
    voitures.push({ id, etat: { s, v: 235 / 3.6, beta: 0 } }); poses.push(B.circuit.echantillon(c, s));
  }
  const etat = B.sillage.creer(); B.sillage.mettreAJour(etat, voitures, poses, c);
  const camera = [p.x - 7.4 * Math.cos(p.cap), p.y + 2.45, p.z - 7.4 * Math.sin(p.cap)];
  const casque = [p.x, p.y + .95, p.z];
  assert(B.sillage.exposition(etat, camera, 1, 0) > .6, 'la poursuite reçoit réellement les projections du rival');
  assert(B.sillage.exposition(etat, casque, 1, 0) > .6);
  assert.equal(etat.sources.filter(source => B.sillage.exposition({ sources: [source] }, casque, 1, 0) > 1e-6).length, 1);
  assert.equal(B.sillage.exposition(etat, camera, 0, 0), 0, 'l’exposition ne dépend plus du mouillage');
  assert.equal(B.sillage.exposition(etat, [camera[0], p.y + 21, camera[2]], 1, 0), 0, 'le plan aérien reste hors du panache');
  const appels = [], s = SCENARIOS.find(s => s.id === 'pluie-poursuite-sillage');
  const S = { type: 'demo', cour: poses, suivie: 0, sortie: [], vue: 'poursuite', meteo: { pluie: 1, mouille: 1 }, sillage: etat,
    camera: { pos: camera, cible: [p.x, p.y + .65, p.z] }, course: { voitures, physique: { world: { raycast: () => ({ hit: false }) } } } };
  const observation = runInNewContext(`(${observerEtat.toString()})()`, {
    BITUME: { ...B, voiture: { FORMES: { jante: { nom: 'jante' } } }, cinema: { valider() {} }, sillage: { exposition(...args) {
      appels.push(args); return B.sillage.exposition(...args);
    } } },
    BITUME_JEU: { session: S, camera: null, ecran: 'demo', scene: { saison: 'ete' }, rendu: { gl: { getError: () => 0, isContextLost: () => false } } },
    __DEMO_FIXTURE: { scenario: s, sujet: 0, rival: 1 }, document: { getElementById: () => ({ hidden: false }) },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
  });
  assert.equal(appels.at(-1)[1], camera, 'l’observateur doit échantillonner cam.pos, pas le casque');
  assert(appels.every(args => args[3] === 0), 'le véhicule filmé doit être exclu de chaque mesure');
  assert.equal(observation.sillage.lentille, B.sillage.exposition(etat, camera, 1, 0));
  assert.equal(observation.sillage.casque, B.sillage.exposition(etat, casque, 1, 0));
});

test('erreurs page/GL, image noire et archive incomplète bloquent le résultat', () => {
  const s = SCENARIOS[0];
  rejette(s, r => r.erreurs.push('exception'), 'Erreur page');
  rejette(s, r => r.avertissements.push('GL_INVALID_OPERATION'), 'graphique');
  rejette(s, (_, o) => { o.glErreur = 1282; }, 'WebGL');
  rejette(s, r => { r.images[0].vues.scene = { noir: 1, luminance: 0 }; }, 'noire');
  rejette(s, r => r.images.pop(), 'incomplet');
});
