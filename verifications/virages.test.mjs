import { creerCircuitCatalogue } from '../tools/qualification/circuit-catalogue.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const charger = createRequire(import.meta.url);
charger('../src/circuit.js');
charger('../src/route-des-cimes.js');
charger('../src/virages.js');
const B = globalThis.BITUME, { planifier, lire, creerVoix } = B.virages;
const ramener = (s, L) => ((s % L) + L) % L;

function trace(segments = [], { longueur = 1600, pas = 2, depart = 0, bruit = 0 } = {}) {
  const n = longueur / pas, courbure = new Float64Array(n), vitesse = new Float64Array(n).fill(86);
  for (let i = 0; i < n; i++) courbure[i] = bruit * Math.sin(i * 1.7);
  for (const [debut, fin, rayon, limite = 30] of segments) {
    for (let s = debut; s < fin; s += pas) {
      const i = Math.floor(ramener(s, longueur) / pas);
      courbure[i] = 1 / rayon; vitesse[i] = limite;
    }
  }
  return { n, pas, longueur, depart, courbure, vitesse };
}
function position(c, progression, options = {}) {
  return { s: ramener(progression + c.depart, c.longueur), progression, vitesse: 60, adherence: 1, actif: true, ...options };
}
const presque = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-8, message || `${a} ≈ ${b}`);

test('le module accepte un hôte sans DOM, son ni circuit valide', () => {
  assert.deepEqual(planifier(null), []);
  assert.deepEqual(planifier({}), []);
  assert.equal(lire(null, null, {}), null);
  assert.equal(lire(trace(), {}, null), null);
  assert.equal(creerVoix({}).disponible(), false);
});

test('les droites bruitées, grandes courbes et pics isolés ne deviennent pas des virages difficiles', () => {
  assert.deepEqual(planifier(trace([], { bruit: 1e-9 })), []);
  assert.deepEqual(planifier(trace([[200, 500, 400]])), []);
  assert.deepEqual(planifier(trace([[200, 204, 25]])), []);
  assert.deepEqual(planifier(trace([[200, 230, 160]])), []);
});

test('la géométrie distingue direction, virage marqué, serré et épingle', () => {
  const plan = planifier(trace([[200, 280, 120, 48], [500, 580, -60, 35], [900, 980, 32, 24]]));
  assert.equal(plan.length, 3);
  assert.deepEqual(plan.map(v => [v.sens, v.difficulte, v.libelle]), [
    [1, 1, 'Droite marquée'], [-1, 2, 'Gauche serrée'], [1, 3, 'Épingle à droite']
  ]);
  assert.deepEqual(plan.map(v => v.vitesseMin), [48, 35, 24]);
  presque(plan[2].rayonMin, 32);
  presque(plan[2].angle, 2.5);
  assert.equal(planifier(trace([[200, 248, 32]]))[0].difficulte, 2, 'un coude proche de 90° ne devient pas une épingle');
});

test('deux sommets voisins du même virage donnent une seule consigne', () => {
  const [virage, autre] = planifier(trace([[300, 350, 50], [370, 420, 45]]));
  assert.equal(autre, undefined);
  assert.equal(virage.debut, 300); assert.equal(virage.fin, 420); assert.equal(virage.longueur, 120);
  assert.ok(virage.sommet >= 370 && virage.sommet < 420, 'le sommet est dans le vrai plateau, hors du creux');
});

test('une petite oscillation entre deux sommets ne crée pas de faux S', () => {
  const plan = planifier(trace([[300, 350, 50], [356, 362, -200], [370, 420, 50]]));
  assert.equal(plan.length, 1);
  assert.equal(plan[0].sens, 1);
  assert.equal(plan[0].longueur, 120);
});

test('une inversion réelle préserve les deux directions du S', () => {
  const plan = planifier(trace([[300, 360, 50], [364, 424, -50]]));
  assert.equal(plan.length, 2);
  assert.deepEqual(plan.map(v => v.sens), [1, -1]);
  assert.ok(plan[0].fin <= plan[1].debut);
  // Même si le petit retour intermédiaire n'est pas annoncé lui-même, son angle
  // empêche d'assimiler les deux virages à droite à un unique virage continu.
  assert.equal(planifier(trace([[300, 350, 50], [354, 374, -180], [380, 430, 50]])).length, 2);
});

test('deux virages du même sens séparés par une vraie droite restent distincts', () => {
  assert.equal(planifier(trace([[300, 360, 50], [430, 490, 50]])).length, 2);
});

test('un virage traversant la jonction du tour reste unique et correctement borné', () => {
  const [v, autre] = planifier(trace([[1500, 1680, -50]]));
  assert.equal(autre, undefined);
  assert.equal(v.debut, 1500); assert.equal(v.fin, 80); assert.equal(v.longueur, 180);
  assert.equal(v.sens, -1); assert.equal(v.difficulte, 2);
  presque(v.angle, 3.6);
  assert.ok(ramener(v.sommet - v.debut, 1600) < v.longueur);
});

test('le regroupement des sommets fonctionne aussi de part et d’autre de zéro', () => {
  const plan = planifier(trace([[1500, 1580, 50], [10, 80, 45]]));
  assert.equal(plan.length, 1);
  assert.equal(plan[0].debut, 1500); assert.equal(plan[0].fin, 80); assert.equal(plan[0].longueur, 180);
});

test('un S traversant zéro conserve la gauche puis la droite sans fusion', () => {
  const plan = planifier(trace([[1530, 1600, -50], [0, 70, 50]]));
  assert.equal(plan.length, 2);
  assert.deepEqual(plan.map(v => [v.debut, v.sens]), [[0, 1], [1530, -1]]);
});

test('les plans sont mémorisés, gelés, déterministes et ne modifient pas le circuit', () => {
  const c = trace([[300, 400, 50]]), avant = structuredClone(c);
  Object.freeze(c);
  const plan = planifier(c);
  assert.strictEqual(planifier(c), plan);
  assert.ok(Object.isFrozen(plan) && plan.every(Object.isFrozen));
  assert.deepEqual(planifier(structuredClone(c)), plan);
  assert.deepEqual(c, avant);
});

test('un tracé sans enveloppe de vitesse garde une référence finie', () => {
  const c = trace([[300, 400, 50]]); delete c.vitesse;
  const v = planifier(c)[0];
  assert.ok(Number.isFinite(v.vitesseMin) && v.vitesseMin > 0 && v.vitesseMin <= 86);
});

test('l’annonce dépend de la vitesse et anticipe davantage quand l’adhérence baisse', () => {
  const c = trace([[400, 480, 60]]);
  assert.equal(lire(c, position(c, 100, { vitesse: 30 }), {}), null);
  assert.equal(lire(c, position(c, 100, { vitesse: 60 }), {}), null);
  assert.equal(lire(c, position(c, 100, { vitesse: 90 }), {}).distance, 300);
  assert.equal(lire(c, position(c, 100, { vitesse: 60, adherence: .4 }), {}).distance, 300);
});

test('la portée reste entre une courte approche et 420 m même à vitesse ou adhérence extrême', () => {
  const c = trace([[600, 680, 60]]);
  assert.equal(lire(c, position(c, 179, { vitesse: 500, adherence: 0 }), {}), null);
  assert.equal(lire(c, position(c, 181, { vitesse: 500, adherence: 0 }), {}).distance, 419);
  assert.equal(lire(c, position(c, 529, { vitesse: 2 }), {}), null);
  assert.equal(lire(c, position(c, 530, { vitesse: 2 }), {}).distance, 70);
});

test('un virage lointain plus sévère ne prend pas la place du prochain virage', () => {
  const c = trace([[400, 440, 120, 90], [500, 600, -32, 20]]);
  assert.equal(lire(c, position(c, 110, { vitesse: 90 }), {}), null);
  const annonce = lire(c, position(c, 250, { vitesse: 90 }), {});
  assert.equal(annonce.sens, 1); assert.equal(annonce.difficulte, 1);
});

test('une seule nouvelle annonce par passage avec une distance arrondie stable', () => {
  const c = trace([[400, 480, 60]]), suivi = {};
  const annonce = lire(c, position(c, 247.6), suivi);
  assert.equal(annonce.nouveau, true); presque(annonce.distance, 152.4); assert.equal(annonce.distanceAffichee, 150);
  for (let i = 0; i < 40; i++) {
    const suivante = lire(c, position(c, 247.6 + i * .05), suivi);
    assert.equal(suivante.nouveau, false); assert.equal(suivante.cle, annonce.cle); assert.equal(suivante.distanceAffichee, 150);
  }
});

test('le freinage ne fait pas clignoter une annonce déjà montrée', () => {
  const c = trace([[400, 480, 60]]), suivi = {};
  assert.ok(lire(c, position(c, 100, { vitesse: 90 }), suivi)?.nouveau);
  const annonce = lire(c, position(c, 110, { vitesse: 20 }), suivi);
  assert.ok(annonce); assert.equal(annonce.nouveau, false); assert.equal(annonce.distance, 290);
});

test('un arrêt puis un redémarrage ne répètent pas la phrase', () => {
  const c = trace([[400, 480, 60]]), suivi = {};
  assert.equal(lire(c, position(c, 350, { vitesse: 10 }), suivi).nouveau, true);
  for (let i = 0; i < 50; i++) assert.equal(lire(c, position(c, 350, { vitesse: 0 }), suivi), null);
  assert.equal(lire(c, position(c, 351, { vitesse: 10 }), suivi).nouveau, false);
});

test('le recul et le retour sur ses pas restent silencieux', () => {
  const c = trace([[400, 480, 60]]), suivi = {};
  assert.equal(lire(c, position(c, 350), suivi).nouveau, true);
  assert.equal(lire(c, position(c, 340, { vitesse: -3 }), suivi), null);
  assert.equal(lire(c, position(c, 345), suivi), null);
  assert.equal(lire(c, position(c, 351), suivi).nouveau, false);
});

test('une pause ou un écran inactif ne produit aucune annonce et conserve le passage', () => {
  const c = trace([[400, 480, 60]]), suivi = {};
  assert.equal(lire(c, position(c, 350), suivi).nouveau, true);
  for (let i = 0; i < 50; i++) assert.equal(lire(c, position(c, 350, { actif: false }), suivi), null);
  assert.equal(lire(c, position(c, 351), suivi).nouveau, false);
  assert.equal(lire(c, position(c, 350, { actif: false }), {}), null);
});

test('l’annonce tient jusqu’au sommet puis prépare le second virage du S', () => {
  const c = trace([[400, 480, 60], [500, 580, -60]]), suivi = {};
  const premiere = lire(c, position(c, 350), suivi);
  const dansVirage = lire(c, position(c, 420), suivi);
  assert.equal(dansVirage.cle, premiere.cle); assert.equal(dansVirage.distance, 0); assert.equal(dansVirage.nouveau, false);
  const suivante = lire(c, position(c, 450), suivi);
  assert.equal(suivante.sens, -1); assert.equal(suivante.distance, 50); assert.equal(suivante.nouveau, true);
});

test('la jonction du tour ne répète pas un virage en cours et le tour suivant le réarme', () => {
  const c = trace([[1560, 1720, 50]]), suivi = {};
  const premiere = lire(c, position(c, 1520), suivi);
  assert.equal(premiere.nouveau, true);
  const apresZero = lire(c, position(c, 1610), suivi);
  assert.equal(apresZero.cle, premiere.cle); assert.equal(apresZero.nouveau, false); assert.equal(apresZero.distance, 0);
  assert.equal(lire(c, position(c, 1660), suivi), null);
  const tourSuivant = lire(c, position(c, 3120), suivi);
  assert.equal(tourSuivant.nouveau, true); assert.notEqual(tourSuivant.cle, premiere.cle);
});

test('une ligne de départ décalée garde les bons passages', () => {
  const c = trace([[400, 480, 60]], { depart: 300 }), suivi = {};
  const premiere = lire(c, position(c, 50), suivi), suivante = lire(c, position(c, 1650), suivi);
  assert.equal(premiere.distance, 50); assert.equal(suivante.distance, 50);
  assert.equal(suivante.nouveau, true); assert.notEqual(premiere.cle, suivante.cle);
});

test('deux joueurs possèdent des annonces indépendantes, et une nouvelle séance repart proprement', () => {
  const c = trace([[400, 480, 60]]), j1 = {}, j2 = {};
  assert.equal(lire(c, position(c, 350), j1).nouveau, true);
  const autre = lire(c, position(c, 250), j2);
  assert.equal(autre.nouveau, true); assert.equal(autre.distance, 150);
  assert.equal(lire(c, position(c, 351), j1).nouveau, false);
  assert.equal(lire(c, position(c, 350), {}).nouveau, true);
  const circuit2 = trace([[400, 480, -60]]);
  assert.equal(lire(circuit2, position(circuit2, 350), j1).nouveau, true);
});

test('les lectures ne modifient ni la position ni les tableaux physiques du circuit', () => {
  const c = trace([[400, 480, 60]]), avant = structuredClone(c), suivi = {};
  for (let p = 0; p < 1800; p += 7) {
    const entree = Object.freeze(position(c, p)); lire(c, entree, suivi);
  }
  assert.deepEqual(c, avant);
  assert.equal(lire(c, position(c, NaN), suivi), null);
  assert.equal(lire(c, position(c, 350, { vitesse: Infinity }), suivi), null);
});

test('une spéciale garde ses virages de départ et de fin distincts et termine ses annonces à l’arrivée', () => {
  const c = trace([[0, 60, 35], [900, 990, 35]], { longueur: 1000 });
  c.ouvert = true; c.arrivee = 949;
  c.n++; // La dernière coordonnée de la spéciale est un sommet, pas un segment de plus.
  c.courbure = Float64Array.from([...c.courbure, 0]);
  c.vitesse = Float64Array.from([...c.vitesse, 0]);
  const plan = planifier(c);
  assert.deepEqual(plan.map(v => [v.debut, v.fin]), [[0, 60], [900, 949]]);
  presque(plan[1].longueur, 49); presque(plan[1].angle, 49 / 35);
  const suivi = {};
  assert.equal(lire(c, position(c, 845), suivi).id, plan[1].id);
  assert.equal(lire(c, position(c, 948), suivi), null);
  assert.equal(lire(c, position(c, 949), suivi), null);
  assert.equal(lire(c, { s: 1000, progression: 1000, vitesse: 50, actif: true }, suivi), null);
});

const sourceJeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const declaration = sourceJeu.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/);
assert.ok(declaration, 'catalogue réel disponible');
const catalogue = new Function(declaration[0] + '; return CATALOGUE;')();
assert.ok(catalogue.some(k => k.id === 'route-des-cimes'));
for (const configuration of catalogue) test(`${configuration.nom} : les vrais virages serrés sont couverts sans toucher au tracé`, () => {
  const c = creerCircuitCatalogue(B, configuration), avant = structuredClone(c);
  const plan = planifier(c), suivi = {}, annonces = new Map();
  // Les huit circuits historiques gardent leur plafond ; le parcours dirigé de 9,7 km
  // conserve ses 20 vrais virages, sans en supprimer pour satisfaire le budget des circuits courts.
  const maximum = c.ouvert ? Math.floor(c.arrivee / 14) : configuration.partition ? Math.ceil(c.longueur / 400) : 12;
  assert.ok(plan.length >= 3 && plan.length <= maximum, `${plan.length} annonces pour ${c.longueur} m`);
  assert.ok(plan.some(v => v.difficulte >= 2));
  for (const v of plan) {
    for (const champ of ['debut', 'sommet', 'fin']) assert.ok(v[champ] >= 0 && (c.ouvert ? v[champ] <= c.arrivee : v[champ] < c.longueur));
    assert.ok(v.longueur >= 14 && v.longueur < c.longueur);
    assert.ok(ramener(v.sommet - v.debut, c.longueur) < v.longueur);
    assert.ok(v.rayonMin <= 180 && v.angle >= .30 && v.vitesseMin > 0 && v.vitesseMin <= 86);
  }
  for (let i = 0; i < c.n; i++) if (Math.abs(c.courbure[i]) >= 1 / 70) {
    // Exiger un vrai changement de cap alentour : Lande-Noire contient aussi
    // un pic de seulement 6 m / 3,6° à 408 m, qui ne doit pas devenir une annonce.
    let angleLocal = 0;
    const rayonMesure = Math.floor(24 / c.pas);
    for (let j = -rayonMesure; j <= rayonMesure; j++) {
      if (c.ouvert && (i + j < 0 || i + j >= c.n)) continue;
      const k = c.courbure[ramener(i + j, c.n)] * Math.sign(c.courbure[i]);
      // Sur la spéciale, le raccord de rayon supérieur à 350 m ne fait pas partie du virage annoncé.
      if (!c.ouvert || k >= 1 / 350) angleLocal += Math.max(0, k) * c.pas;
    }
    if (angleLocal < .30 || (c.ouvert && i * c.pas >= c.arrivee)) continue;
    assert.ok(plan.some(v => ramener(i * c.pas - v.debut, c.longueur) < v.longueur
      && v.sens === Math.sign(c.courbure[i])), `courbe serrée à ${i * c.pas} m couverte dans son sens`);
  }
  const passages = c.ouvert ? 1 : 2;
  for (let p = 0; p < (c.ouvert ? c.arrivee : 2 * c.longueur); p += 8) {
    const a = lire(c, position(c, p, { vitesse: 70 }), suivi);
    if (a?.nouveau) annonces.set(a.cle, (annonces.get(a.cle) || 0) + 1);
  }
  assert.equal(annonces.size, plan.length * passages, 'une annonce de chaque virage par passage');
  if (c.ouvert) assert.equal(lire(c, { s: c.longueur, progression: c.longueur, vitesse: 40, actif: true }, suivi), null);
  assert.ok([...annonces.values()].every(n => n === 1));
  assert.strictEqual(planifier(c), plan);
  assert.deepEqual(planifier(structuredClone(c)), plan);
  assert.deepEqual(c, avant);
});

function hoteVoix(voix = []) {
  const journal = [], file = [];
  const synthese = {
    voix, paused: false,
    getVoices() { return this.voix; },
    speak(parole) { file.push(parole); journal.push(['parler', parole]); },
    cancel() { journal.push(['annuler']); for (const p of file.splice(0)) p.onerror?.({ error: 'interrupted' }); },
    resume() { this.paused = false; journal.push(['reprendre']); }
  };
  return { speechSynthesis: synthese, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    journal, file, finir() { file.shift()?.onend?.(); } };
}
const francaise = { name: 'Français local', lang: 'fr-FR', localService: true };

test('la voix refuse les moteurs distants, les langues étrangères et les provenances inconnues', () => {
  for (const voix of [[], [{ lang: 'fr-FR', localService: false, default: true }], [{ lang: 'en-US', localService: true }], [{ lang: 'fr-FR' }]]) {
    const hote = hoteVoix(voix), aide = creerVoix(hote);
    assert.equal(aide.disponible(), false); assert.equal(aide.dire('Droite serrée', .5), false);
    assert.equal(hote.journal.length, 0);
  }
});

test('seule une voix française locale explicite reçoit la parole', () => {
  const hote = hoteVoix([{ lang: 'fr-FR', localService: false, default: true }, { lang: 'en-GB', localService: true }, francaise]);
  const aide = creerVoix(hote);
  assert.equal(aide.disponible(), true); assert.equal(hote.journal.length, 0);
  assert.equal(aide.dire('  Gauche serrée, dans 150 mètres.  ', .45), true);
  const parole = hote.file[0];
  assert.strictEqual(parole.voice, francaise); assert.equal(parole.lang, 'fr-FR'); assert.equal(parole.volume, .45);
  assert.equal(parole.text, 'Gauche serrée, dans 150 mètres.');
});

test('les voix françaises régionales et leur arrivée tardive sont prises en compte sans repli distant', () => {
  const hote = hoteVoix(), aide = creerVoix(hote);
  assert.equal(aide.disponible(), false); assert.equal(aide.dire('Droite'), false);
  const canadienne = { lang: 'fr-CA', localService: true, default: true };
  hote.speechSynthesis.voix = [canadienne];
  assert.equal(aide.disponible(), true); assert.equal(aide.dire('Droite'), true);
  assert.strictEqual(hote.file[0].voice, canadienne);
  hote.speechSynthesis.voix = [{ lang: 'fr-FR', localService: false }];
  assert.equal(aide.dire('Gauche'), false); assert.equal(hote.file.length, 0);
});

test('chaque nouvelle phrase remplace la précédente et les événements périmés restent sans effet', () => {
  const hote = hoteVoix([francaise]), aide = creerVoix(hote);
  assert.equal(aide.dire('Droite'), true);
  const vieilleFin = hote.file[0].onend;
  assert.equal(aide.dire('Gauche'), true); assert.equal(hote.file.length, 1); assert.equal(hote.file[0].text, 'Gauche');
  vieilleFin();
  assert.equal(aide.annuler(), true); assert.equal(hote.file.length, 0);
  const n = hote.journal.length; aide.annuler(); assert.equal(hote.journal.length, n, 'annulation idempotente');
});

test('fin et erreur libèrent la parole, sans répéter ni remettre une ancienne phrase en file', () => {
  const hote = hoteVoix([francaise]), aide = creerVoix(hote);
  aide.dire('Droite'); hote.finir();
  const n = hote.journal.length; aide.annuler(); assert.equal(hote.journal.length, n);
  aide.dire('Gauche'); hote.file.shift().onerror({ error: 'voice-unavailable' });
  assert.equal(hote.file.length, 0); assert.equal(aide.disponible(), true);
});

test('volume borné et volume nul ou invalide coupent la parole', () => {
  const hote = hoteVoix([francaise]), aide = creerVoix(hote);
  assert.equal(aide.dire('Droite', 5), true); assert.equal(hote.file[0].volume, 1);
  for (const volume of [0, -3, NaN, Infinity]) {
    assert.equal(aide.dire('Gauche', volume), false); assert.equal(hote.file.length, 0);
  }
  assert.equal(aide.dire('Épingle'), true); assert.equal(hote.file[0].volume, 1);
  assert.equal(aide.dire('   '), false); assert.equal(hote.file.length, 0);
});

test('un moteur suspendu est repris avant la phrase, ou reste silencieux sans reprise disponible', () => {
  const hote = hoteVoix([francaise]); hote.speechSynthesis.paused = true;
  assert.equal(creerVoix(hote).dire('Droite'), true);
  assert.deepEqual(hote.journal.map(x => x[0]), ['reprendre', 'parler']);
  const sansReprise = hoteVoix([francaise]); sansReprise.speechSynthesis.paused = true; delete sansReprise.speechSynthesis.resume;
  assert.equal(creerVoix(sansReprise).dire('Gauche'), false); assert.equal(sansReprise.file.length, 0);
});

test('des API absentes ou en erreur ne cassent jamais l’affichage', () => {
  const interdit = {}; Object.defineProperty(interdit, 'speechSynthesis', { get() { throw new Error('indisponible'); } });
  assert.equal(creerVoix(interdit).dire('Droite'), false);
  const hote = hoteVoix([francaise]); hote.speechSynthesis.getVoices = () => { throw new Error('voix'); };
  assert.equal(creerVoix(hote).disponible(), false);
  const erreurLecture = hoteVoix([francaise]); erreurLecture.speechSynthesis.speak = () => { throw new Error('bloqué'); };
  assert.equal(creerVoix(erreurLecture).dire('Gauche'), false); assert.equal(erreurLecture.file.length, 0);
});

test('un échec d’annulation interdit l’empilement, puis une annulation réussie permet la reprise', () => {
  const hote = hoteVoix([francaise]), aide = creerVoix(hote), annulation = hote.speechSynthesis.cancel;
  aide.dire('Droite');
  hote.speechSynthesis.cancel = () => { throw new Error('moteur occupé'); };
  assert.equal(aide.dire('Gauche'), false); assert.equal(hote.file.length, 1); assert.equal(hote.file[0].text, 'Droite');
  assert.equal(aide.dire('Épingle'), false); assert.equal(hote.file.length, 1);
  hote.speechSynthesis.cancel = annulation;
  assert.equal(aide.dire('Gauche'), true); assert.equal(hote.file.length, 1); assert.equal(hote.file[0].text, 'Gauche');
});
