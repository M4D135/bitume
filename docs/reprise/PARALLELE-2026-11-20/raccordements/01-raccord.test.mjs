// Exécuter depuis le dépôt : node docs/reprise/PARALLELE-2026-11-20/raccordements/01-raccord.test.mjs
// Le patch proposé est appliqué dans un dossier temporaire. src/jeu.js reste intact.
// Les helpers et le début de rendreImage sont extraits du résultat réel, avec les modules 01 réels.
// Ceci ne qualifie pas le navigateur, le réseau, le menu 03 ni le build assemblé.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dossier = path.dirname(fileURLToPath(import.meta.url)), racine = path.resolve(dossier, '../../../..');
const BASE = '1c71bb341d20df4328e5178497503ee4ad26a131';
const sha = b => createHash('sha256').update(b).digest('hex');
const partageAvant = sha(readFileSync(path.join(racine, 'src/jeu.js')));
const provisoire = mkdtempSync(path.join(tmpdir(), 'bitume-raccord01-'));
mkdirSync(path.join(provisoire, 'src'));
writeFileSync(path.join(provisoire, 'src/jeu.js'), execFileSync('git', ['show', BASE + ':src/jeu.js'], { cwd: racine }));
execFileSync('git', ['apply', '--check', path.join(dossier, '01-jeu.patch')], { cwd: provisoire });
execFileSync('git', ['apply', path.join(dossier, '01-jeu.patch')], { cwd: provisoire });
const source = readFileSync(path.join(provisoire, 'src/jeu.js'), 'utf8');
execFileSync(process.execPath, ['--check', path.join(provisoire, 'src/jeu.js')]);
after(() => {
  assert.equal(sha(readFileSync(path.join(racine, 'src/jeu.js'))), partageAvant, 'le test ne modifie jamais le fichier partagé');
  rmSync(provisoire, { recursive: true, force: true });
});
const extraire = nom => {
  const debut = source.indexOf('  function ' + nom + '('); assert(debut >= 0, 'fonction proposée : ' + nom);
  const fin = source.indexOf('\n  }', debut); assert(fin > debut, 'fin de fonction : ' + nom);
  return source.slice(debut, fin + 4);
};
const creerExpression = source.match(/^\s+expressions: (.+),$/m)?.[1]; assert(creerExpression);
const allocationEvenement = source.match(/^\s+trollEvenement: (\{.+\}),$/m)?.[1]; assert(allocationEvenement);
const allocationAudio = source.match(/^\s+trollAudio: (\{.+\}),$/m)?.[1]; assert(allocationAudio);
const initLocaux = source.match(/    S\.locaux = [^\n]+\n    if \(joue && S\.expressions\) configurerTrollLocaux\(S\);/)?.[0]; assert(initLocaux);
const debutImage = source.indexOf('  function rendreImage(S, alpha, dtImage)');
const finDebutImage = source.indexOf('    if (B.sillage)', debutImage); assert(finDebutImage > debutImage);
const imageProposee = source.slice(debutImage, finDebutImage) + '\n  }';
const copie = v => JSON.parse(JSON.stringify(v));

function banc(type = 'duo', locaux = [3, 7], nombre = 8) {
  const contexte = vm.createContext({ console });
  Object.defineProperty(contexte, 'AudioContext', { get() { throw new Error('Le raccord crée un contexte audio'); } });
  Object.defineProperty(contexte, 'webkitAudioContext', { get() { throw new Error('Le raccord crée un contexte audio'); } });
  for (const nom of ['expressions-pilote.js', 'son.js'])
    vm.runInContext(readFileSync(path.join(racine, 'src', nom), 'utf8'), contexte, { filename: nom });
  vm.runInContext('var B = BITUME; var reglages = {}; var ecran = "course"; var son = null;', contexte);
  vm.runInContext(extraire('configurerTrollLocaux') + '\n' + extraire('consommerTroll') + '\n' + imageProposee, contexte);
  const X = contexte.BITUME.expressionsPilote, appels = [], ordre = [], buffers = [];
  const sortieSon = { evenement(nom, audio) { ordre.push('son'); appels.push({ nom, ...copie(audio) }); buffers.push(audio); return true; } };
  contexte.son = sortieSon; contexte.ecran = type === 'demo' ? 'demo' : 'course';
  const voitures = Array.from({ length: nombre }, (_, id) => ({ id, progression: 100 + id * 40,
    joueur: locaux.includes(id), humain: locaux.includes(id), fini: false, abandon: false, tPassage: -100,
    etat: { v: 30, rapport: 3, repositionnements: 0 } }));
  const co = { voitures, joueur: voitures[locaux[0]], phase: 'course', termine: false, horloge: 0 };
  const poses = voitures.map(v => ({ x: v.progression, y: 0, z: 0, cap: 0 }));
  contexte.course = co; contexte.graineCourse = 19; contexte.joue = ['course', 'chrono', 'duo'].includes(type);
  const S = { type, course: co, expressions: vm.runInContext(creerExpression, contexte), locaux: [...locaux], suivie: locaux[0],
    trollEvenement: vm.runInContext('(' + allocationEvenement + ')', contexte), trollAudio: vm.runInContext('(' + allocationAudio + ')', contexte),
    prec: poses, cour: poses };
  contexte.S = S; contexte.DT = 1 / 120; contexte.appliquerCarte = () => {};
  contexte.tampons = { poses: poses.map(p => ({ ...p })) };
  contexte.melange = (a, b, alpha, sortie) => Object.assign(sortie, b);
  contexte.creationTardive = () => { throw new Error('Allocation tardive dans le début d’image testé'); };
  const actualiser = X.actualiser, consommer = contexte.consommerTroll;
  X.actualiser = (...args) => { ordre.push('actualiser'); return actualiser(...args); };
  contexte.consommerTroll = (...args) => { ordre.push('consommer'); return consommer(...args); };
  const image = t => { co.horloge = t; contexte.rendreImage(S, 1, 1 / 60); };
  const demander = id => { X.demander(S.expressions, id, true); X.demander(S.expressions, id, false); };
  const configurer = choix => { contexte.reglages.trollPilotes = choix; vm.runInContext(initLocaux, contexte); };
  return { contexte, X, S, co, poses, appels, ordre, buffers, sortieSon, image, demander, configurer };
}

test('patch applicable/syntaxique, un raccord unique avant J2/J1 et les instruments communs', () => {
  assert.equal((source.match(/consommerTroll\(S, poses\);/g) || []).length, 1);
  const actualiser = source.indexOf('B.expressionsPilote.actualiser(', debutImage);
  const consommation = source.indexOf('consommerTroll(S, poses);', debutImage);
  const j2 = source.indexOf('rendreVue(S.vueJ2', debutImage);
  assert(actualiser < consommation && consommation < j2);
  assert(!extraire('provoquer').includes('son'));
  assert(source.includes('INCLINAISON_COCKPIT = -Math.PI / 60'));
  assert(source.includes('pilote.regime = etatPilote.regime; pilote.kmh = B.conduite.kmh(etatPilote);'));
  assert.equal(sha(readFileSync(path.join(racine, 'src/jeu.js'))), partageAvant);
});

test('création : IA activée seulement pour les séances jouées ; sorties préallouées', () => {
  for (const type of ['course', 'chrono', 'duo', 'demo', 'vitrine']) {
    const b = banc(type);
    assert.equal(b.S.expressions.ia, ['course', 'chrono', 'duo'].includes(type));
    assert.deepEqual(Object.keys(b.S.trollEvenement), ['sequence', 'pilote', 'geste', 'klaxon', 'instant', 'cote']);
    assert.deepEqual(Object.keys(b.S.trollAudio), ['klaxon', 'gain', 'pan']);
  }
});

test('les choix J1/J2 sont copiés aux vrais ID locaux, puis prennent le helper 03 quand disponible', () => {
  const b = banc(), choix = Object.freeze([Object.freeze({ geste: 'salut', klaxon: 'ancien' }), Object.freeze({ geste: 'poing', klaxon: 'mariage' })]);
  b.configurer(choix); assert.deepEqual(Array.from(b.S.locaux), [3, 7]);
  assert.equal(b.S.expressions.pilotes[3].choixGeste, b.X.GESTES.indexOf('salut'));
  assert.equal(b.S.expressions.pilotes[7].choixKlaxon, b.X.KLAXONS.indexOf('mariage'));
  assert.equal(b.S.expressions.pilotes[0].choixGeste, -1, 'aucun choix humain copié au rival ID 0');
  let lectures = 0;
  b.contexte.choixTrollLocaux = () => { lectures++; return [{ geste: 'poing', klaxon: 'classique' }, { geste: 'salut', klaxon: 'ancien' }]; };
  b.configurer(choix); assert.equal(lectures, 1);
  assert.equal(b.S.expressions.pilotes[3].choixGeste, b.X.GESTES.indexOf('poing'));
  assert.equal(b.S.expressions.pilotes[7].choixKlaxon, b.X.KLAXONS.indexOf('ancien'));
  delete b.contexte.choixTrollLocaux; b.configurer([{ geste: '__proto__', klaxon: 42 }, null]);
  for (const id of [3, 7]) { assert.equal(b.S.expressions.pilotes[id].choixGeste, 0); assert.equal(b.S.expressions.pilotes[id].choixKlaxon, 0); }
});

test('le vrai début de rendreImage appelle actualiser/consommer une fois et ne sonne pas sur demander/lire', () => {
  const b = banc(); b.configurer([{ geste: 'salut', klaxon: 'ancien' }, { geste: 'poing', klaxon: 'mariage' }]);
  b.image(0); b.ordre.length = 0; b.demander(3); b.demander(7);
  b.X.lire(b.S.expressions, 7); b.X.lire(b.S.expressions, 3); assert.equal(b.appels.length, 0);
  b.contexte.consommerTroll(b.S, b.poses); assert.equal(b.appels.length, 0, 'demande sans démarrage : aucun son');
  b.ordre.length = 0; b.image(.1);
  assert.deepEqual(b.ordre, ['actualiser', 'consommer', 'son', 'son']);
  assert.deepEqual(b.appels.map(a => [a.nom, a.klaxon]), [['troll', 'ancien'], ['troll', 'mariage']]);
  assert(b.buffers.every(p => p === b.S.trollAudio), 'un seul buffer audio réutilisé');
  const evenement = b.S.trollEvenement;
  b.X.lire(b.S.expressions, 7); b.X.lire(b.S.expressions, 3); b.image(.1); b.image(.12);
  assert.equal(b.appels.length, 2, 'ni relecture J2/J1 ni nouvel affichage ne rejoue le son');
  assert.equal(b.S.trollEvenement, evenement);
});

test('une demande différée par la boîte reste silencieuse jusqu’au départ effectif', () => {
  const b = banc('course', [3]); b.configurer([{ geste: 'poing', klaxon: 'mariage' }]); b.image(0);
  b.co.voitures[3].etat.rapport = 4; b.co.voitures[3].tPassage = .1; b.demander(3); b.image(.1);
  assert.equal(b.appels.length, 0); assert.equal(b.X.lire(b.S.expressions, 3).geste, null);
  b.image(.3); assert.equal(b.appels.length, 0); b.image(.5);
  assert.equal(b.appels.length, 1); assert.equal(b.appels[0].klaxon, 'mariage');
  assert.equal(b.S.trollEvenement.instant, b.S.expressions.pilotes[3].gesteA);
});

test('menu, pause et vitrine drainent la file sans son ni reprise tardive', () => {
  for (const [type, ecran] of [['course', 'titre'], ['duo', 'reglages'], ['course', 'pause'], ['vitrine', 'course'], ['demo', 'titre']]) {
    const b = banc(type); b.image(0); b.contexte.ecran = ecran; b.demander(3); b.image(.1);
    assert.equal(b.appels.length, 0, type + '/' + ecran);
    assert.equal(b.X.consommerEvenement(b.S.expressions, {}), false, 'file réellement vidée');
    b.contexte.ecran = type === 'demo' ? 'demo' : 'course'; b.image(.1); assert.equal(b.appels.length, 0, 'aucun rejeu au retour');
  }
});

test('audio absent, non initialisé ou muet : l’événement est consommé une seule fois', () => {
  for (const mode of ['absent', 'refuse']) {
    const b = banc(); b.image(0);
    let essais = 0; b.contexte.son = mode === 'absent' ? null : { evenement() { essais++; return false; } };
    b.demander(3); b.image(.1); assert.equal(essais, mode === 'absent' ? 0 : 1);
    assert.equal(b.X.consommerEvenement(b.S.expressions, {}), false);
    b.contexte.son = b.sortieSon; b.image(.1); b.image(.12); assert.equal(b.appels.length, 0);
  }
});

test('spatialisation : auditeur J2 le plus proche, puis sujet de démo ; gain/pan bornés', () => {
  for (const type of ['duo', 'demo']) {
    const b = banc(type); b.S.suivie = 7;
    Object.assign(b.poses[3], { x: 0, y: 0, z: 0, cap: 0 });
    Object.assign(b.poses[7], { x: 100, y: 0, z: 0, cap: 0 });
    Object.assign(b.poses[2], { x: 100, y: 0, z: 7, cap: Math.PI });
    b.image(0); b.demander(2); b.image(.1); assert.equal(b.appels.length, 1);
    assert.equal(b.appels[0].gain, b.contexte.BITUME.son.gainDistance(7));
    assert(Math.abs(b.appels[0].pan - 1) < 1e-12, 'cap de l’auditeur, non celui de l’émetteur');
    assert(b.appels[0].gain > 0 && b.appels[0].gain <= 1); assert(Math.abs(b.appels[0].pan) <= 1);
  }
  const b = banc(); b.image(0); b.demander(7); b.image(.1);
  assert.equal(b.appels[0].gain, 1); assert.equal(b.appels[0].pan, 0, 'son du pilote J2 centré sur lui');
});

test('la capacité maximale de 64 événements est drainée hors écran sans appel audio', () => {
  const b = banc('course', [3, 7], 64); b.contexte.ecran = 'titre'; b.image(0);
  for (let i = 0; i < 64; i++) b.demander(i);
  b.image(.1); assert.equal(b.S.expressions.evenementsN, 64); assert.equal(b.S.expressions.evenementsLu, 64);
  assert.equal(b.appels.length, 0); assert.equal(b.X.consommerEvenement(b.S.expressions, {}), false);
});
