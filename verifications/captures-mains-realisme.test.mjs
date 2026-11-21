import assert from 'node:assert/strict';
import { SCENARIOS_MAINS, optionsMains, verifierMains, comparerConditionsMains,
  preparerInstantMains } from '../tools/qualification/captures-mains-realisme.mjs';

let controles = 0;
const tester = (nom, fn) => { fn(); controles++; };
const piece = (role, shape = 'box', pilote = false) => ({ role, shape, pilote, p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1] });
const s = SCENARIOS_MAINS.find(s => s.id === 'prise-gauche');
const observation = instant => ({ type: 'course', ecran: 'course', glErreur: 0, glPerdu: false, cameraImposee: true,
  sansPilote: false, obstructionStatique: false, camera: { pos: [1, 2, 3], yaw: 0, pitch: 0, roll: 0, fov: 35, near: .1 },
  pose: { x: 0, y: 0, z: 0, cap: 0 }, volant: 0, rapport: 3, passage: 1, expression: { geste: null, gesteIntensite: 0 },
  instant: instant.nom, ageRendu: instant.age, viewportMains: { largeur: 1280, hauteur: 960 },
  mains: [0, 1].map(cote => ({ cote, pieces: 7, formeDoigts: 'gant-' + cote,
    cadre: { x: 500 + cote * 200, y: 400, profondeur: 1, diametreEnveloppePx: 100 } })),
  piecesModele: ['volant', 'levier', 'pommeau', 'planche', 'support-volant-0'].map(r => piece(r)).concat(
    ['goutte', 'cuve', 'assise-pilote', 'arceau'].map(n => piece('coque:' + n, 'bitume-' + n)), [piece('gant-0-0', 'main', true)]) });
const rapport = (scenario = s) => ({ environnement: { webgl2: true, physx: { ready: true }, gpu: 'test', resolution: [1280, 960, 1] },
  parametres: { images: scenario.images, pas: scenario.pas }, erreurs: [], build: { sha256: 'a'.repeat(64), octets: 1 },
  initialisation: { mains: { substitutionModele: false } },
  images: scenario.instants.map(i => ({ etat: { referenceConservee: true }, observation: observation(i) })) });

tester('options locales et comparaison explicite', () => {
  const args = ['--url', 'file:///tmp/apres.html', '--avant', 'file:///tmp/avant.html', '--sortie', '/tmp/mains'];
  assert.equal(optionsMains(args).cas.length, 9);
  assert.throws(() => optionsMains(args.concat('--cas', 'prise-gauche,prise-gauche')));
  assert.throws(() => optionsMains(args.concat('--cas', 'inconnue')));
  assert.throws(() => optionsMains(['--url', 'https://example.org', '--avant', args[3], '--sortie', args[5]]));
  assert.throws(() => optionsMains(['--url', args[1], '--avant', args[1], '--sortie', args[5]]));
});
tester('la campagne couvre les deux mains, les trois gestes et le levier', () => {
  assert.deepEqual(SCENARIOS_MAINS.filter(x => x.geste).map(x => x.geste).sort(), ['majeur', 'poing', 'salut']);
  for (const x of SCENARIOS_MAINS) {
    assert.equal(x.images, x.instants.length);
    assert.ok(x.instants.every((v, i) => v.age > 0 && (!i || v.age > x.instants[i - 1].age)));
  }
  assert.equal(SCENARIOS_MAINS.find(x => x.id === 'passage').images, 4);
  assert.ok(SCENARIOS_MAINS.some(x => x.volant > 0) && SCENARIOS_MAINS.some(x => x.volant < 0));
});
tester('un rapport natif complet est accepté', () => assert.deepEqual(verifierMains(rapport(), s), []));
tester('une main absente ou trop petite est refusée', () => {
  const r = rapport(); r.images[0].observation.mains[0].pieces = 0;
  assert.ok(verifierMains(r, s).includes('Les deux mains réellement rendues sont requises'));
  r.images[0].observation.mains[0].pieces = 7; r.images[0].observation.mains[0].cadre.diametreEnveloppePx = 10;
  assert.ok(verifierMains(r, s).some(e => e.startsWith('Main trop petite')));
});
tester('un centre hors champ est refusé', () => {
  const r = rapport(); r.images[0].observation.mains[1].cadre.x = 2000;
  assert.ok(verifierMains(r, s).includes('Centre de main hors champ : 1'));
});
tester('un faux moteur ou une pose à un autre instant ne passent pas', () => {
  const r = rapport(); r.environnement.physx.ready = false; r.images[0].observation.ageRendu += .1;
  const e = verifierMains(r, s); assert.ok(e.includes('PhysX réel absent')); assert.ok(e.includes('Phase temporelle différente : 0'));
});
tester('un geste annoncé mais absent est refusé', () => {
  const scenario = SCENARIOS_MAINS.find(x => x.geste === 'salut');
  assert.ok(verifierMains(rapport(scenario), scenario).includes('Geste natif attendu absent : ouverture'));
});
tester('le temps du levier est contrôlé', () => {
  const scenario = SCENARIOS_MAINS.find(x => x.passage);
  assert.ok(verifierMains(rapport(scenario), scenario).includes('Phase de rapport incorrecte'));
});
tester('les maillages peuvent changer mais pas la caméra ni la pose comparée', () => {
  const a = rapport(), b = rapport(); b.images[0].observation.mains[0].formeDoigts = 'nouvelle-main';
  assert.deepEqual(comparerConditionsMains(a, b), []);
  b.images[0].observation.camera.fov += 1;
  assert.ok(comparerConditionsMains(a, b).includes('Pose, caméra ou phase différente : 0'));
  assert.ok(comparerConditionsMains(a, { images: [] }).includes('Paire de séquences incomplète'));
});
tester('les étapes gardent l’API native et prescrivent le bon temps de rendu', () => {
  const E = { temps: 12 }, appels = [], scenario = { pas: 1 / 60, instants: [{ nom: 'maintien', age: 1.2 }] };
  globalThis.BITUME_JEU = { session: { expressions: E, course: {}, cour: [] } };
  globalThis.__HABITACLE_CAPTURE = { mains: { debut: 12, scenario } };
  globalThis.BITUME = { expressionsPilote: { actualiser(e, co, poses, t) { appels.push(t - e.temps); e.temps = t; } } };
  try {
    assert.deepEqual(preparerInstantMains(0), { instant: 'maintien', agePrescrit: 1.2 });
    assert.ok(appels.length > 0 && appels.every(dt => dt > 0 && dt <= .100000001));
    assert.ok(Math.abs(BITUME_JEU.session.course.horloge + scenario.pas - 1 / 120 - 13.2) < 1e-12);
  } finally { delete globalThis.BITUME_JEU; delete globalThis.__HABITACLE_CAPTURE; delete globalThis.BITUME; }
});
console.log(`${controles} contrôles de comparaison des mains réussis.`);
