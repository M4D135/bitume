// Instrumentation : le volet sépare les vues, ne rend jamais un temps JavaScript pour un temps GPU, et lit les
// requêtes asynchrones du moteur sans attendre. Sans extension, la ligne GPU reste N/D. Il s'ouvre aussi sans
// chronomètre GPU, et garde pour la séance ce que la fenêtre de 240 images oublie (images longues, pire image).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const req = createRequire(import.meta.url);
req('../src/mesures.js');
const M = globalThis.BITUME.mesures;

function renduFactice(stats, profil) {
  return { stats, profile: profil === undefined ? undefined : () => profil };
}

function horlogeControlee(document) {
  let temps = 100;
  const contexte = vm.createContext({ performance: { now: () => temps }, document });
  vm.runInContext(readFileSync(new URL('../src/mesures.js', import.meta.url), 'utf8'), contexte);
  const mesures = contexte.BITUME.mesures;
  mesures.afficher(true, null);
  return { mesures, avancer: ms => { temps += ms; } };
}

test('deux millisecondes de boucle restent deux millisecondes', () => {
  const { mesures: m, avancer } = horlogeControlee();
  const t0 = m.imageDebut(); avancer(2); m.imageFin(t0, 1 / 60);
  const v = m.lire();
  assert.equal(v.cpu.boucle, 2);
  assert.equal(v.cpuP50.boucle, 2);
  assert.ok(Math.abs(v.imageP50 - 1000 / 60) < 1e-10);
});

test('deux vues cumulent leur coût CPU et les deux glaces leur coût par image', () => {
  const { mesures: m } = horlogeControlee();
  const t0 = m.imageDebut();
  m.section('rendu', 2); m.section('rendu', 3);
  m.vue('retro', renduFactice({ drawCalls: 4, triangles: 100 }));
  m.vue('retro', renduFactice({ drawCalls: 6, triangles: 200 }));
  m.imageFin(t0, 1 / 60);
  const v = m.lire();
  assert.equal(v.cpu.rendu, 5);
  assert.equal(v.vues.retro.drawCalls, 5, 'moyenne par rendu conservée pour les rapports existants');
  assert.equal(v.vues.retro.drawCallsParImage, 10);
  assert.equal(v.vues.retro.trianglesParImage, 300);
  assert.equal(v.vues.retro.rendusParImage, 2);
});

test('les coûts nuls comptent et la pire image est le maximum', () => {
  const { mesures: m } = horlogeControlee();
  for (const [ms, intervalle] of [[0, .016], [4, .100]]) {
    const t0 = m.imageDebut(); m.section('effets', ms); m.imageFin(t0, intervalle);
  }
  const v = m.lire();
  assert.equal(v.cpu.effets, 2);
  assert.equal(v.cpuP50.effets, 0);
  assert.equal(v.imagePire, 100);
});

test('la fenêtre circulaire efface les anciens relevés sans section ni rétroviseur', () => {
  const { mesures: m } = horlogeControlee();
  for (let i = 0; i < 241; i++) {
    const t0 = m.imageDebut();
    if (i === 0) { m.section('effets', 99); m.vue('retro', renduFactice({ drawCalls: 10, triangles: 200 })); }
    m.imageFin(t0, 1 / 60);
  }
  const v = m.lire();
  assert.equal(v.cpu.effets, null);
  assert.equal(v.vues.retro.drawCallsParImage, 0);
  assert.equal(v.vues.retro.trianglesParImage, 0);
});

test('le total GPU et ses passes utilisent les mêmes rendus complets', () => {
  const { mesures: m } = horlogeControlee();
  const profil = { gpu: true, history: [
    { valid: true, queries: 2, completed: 2, gpu: { world: 2, post: 1 } },
    { valid: true, queries: 2, completed: 2, gpu: { world: 4, post: 3 } },
    { valid: true, queries: 2, completed: 2, gpu: { world: NaN, post: 1 } }
  ] };
  const v = m.lire(renduFactice({}, profil));
  assert.equal(v.gpuMs, 5);
  assert.equal(v.gpuPasses.world, 3); assert.equal(v.gpuPasses.post, 2);
  assert.match(v.gpuPortee, /pas le total/);
});

test('le module expose l API attendue', () => {
  for (const n of ['imageDebut', 'imageFin', 'section', 'vue', 'voitures', 'pieces', 'audio', 'reglages', 'cadence', 'lire', 'reinitialiser', 'afficher', 'chrono', 'majAffichage'])
    assert.equal(typeof M[n], 'function', n + ' manque');
  assert.deepEqual(M.VUES, ['principale', 'joueur2', 'retro']);
  assert.equal(typeof M.chronoGPU, 'boolean');
});

// Un moteur factice qui compte ce qu'on demande à son chronomètre GPU.
function moteurChronometre(history) {
  const appels = [];
  return { appels, stats: { drawCalls: 1, triangles: 1 },
    profile(v) { appels.push(v === undefined ? 'lecture' : v); return v === false ? null : { gpu: true, discarded: 0, pending: 0, history }; } };
}
function images(m, intervallesMs) { for (const ms of intervallesMs) { const t0 = m.imageDebut(); m.imageFin(t0, ms / 1000); } }

test('ouvert sans chronomètre GPU : aucune requête, temps GPU N/D, choix retenu', () => {
  const el = { setAttribute() {}, textContent: '' };
  const { mesures: m } = horlogeControlee({ createElement: () => el, body: { appendChild() {} } });
  const rendu = moteurChronometre([{ valid: true, queries: 1, completed: 1, gpu: { world: 4 } }]);
  let v = m.afficher({ gpu: false }, rendu);
  assert.deepEqual(rendu.appels, [false], 'le chronomètre est fermé, jamais ouvert ni lu');
  images(m, [16.7, 16.7]);
  v = m.lire(rendu);
  assert.equal(v.gpuChrono, false); assert.equal(v.gpu, false); assert.equal(v.gpuValide, false); assert.equal(v.gpuMs, null);
  assert.deepEqual(rendu.appels, [false]);
  m.majAffichage(rendu, 10); assert.match(el.textContent, /GPU \/ rendu principal {2}N\/D \(chronomètre coupé\)/);
  m.afficher(false, rendu); m.afficher(true, rendu);
  assert.deepEqual(rendu.appels, [false, false, false], 'F3 rouvre sans chronomètre tant qu’il est coupé');
  assert.equal(m.chrono(true, rendu), true);
  v = m.lire(rendu);
  assert.equal(v.gpuChrono, true); assert.equal(v.gpuMs, 4);
  // Objet né dans le contexte isolé du module : on compare sa forme, pas son prototype.
  const reouverture = rendu.appels[3];
  assert.ok(reouverture && typeof reouverture === 'object' && Object.keys(reouverture).length === 0, 'chrono(true) rouvre comme F3 : profile({})');
  m.chrono(false, rendu);
  assert.equal(m.etat.gpuMs, null, 'l’état exporté oublie tout de suite le dernier temps GPU'); assert.equal(m.etat.gpu, false);
  v = m.lire(rendu);
  assert.equal(rendu.appels.at(-1), false); assert.equal(v.gpuMs, null);
});

test('séance : images longues et pire image au-delà de la fenêtre de 240 images', () => {
  const { mesures: m } = horlogeControlee();
  const suite = Array.from({ length: 300 }, (_, i) => i === 10 || i === 20 ? 40 : i === 30 ? 61 : 1000 / 60);
  images(m, suite);
  const v = m.lire();
  assert.ok(Math.abs(v.imagePire - 1000 / 60) < 1e-9, 'la fenêtre a oublié les accrocs');
  assert.equal(v.seance.images, 300); assert.equal(v.seance.longues, 3);
  assert.equal(v.seance.reference, 'estimee'); assert.ok(Math.abs(v.periodeEstimee - 1000 / 60) < 1e-9);
  assert.ok(Math.abs(v.seance.seuil - 1.5 * 1000 / 60) < 1e-9);
  assert.equal(v.seance.pire, 61);
  const avant = suite.slice(0, 30).reduce((a, b) => a + b, 0) / 1000;
  assert.ok(Math.abs(v.seance.instantPire - avant) < 1e-9, 'instant de la pire image');
  assert.ok(Math.abs(v.seance.duree - suite.reduce((a, b) => a + b, 0) / 1000) < 1e-9);
  assert.equal(v.periode, null); assert.equal(v.diviseur, null);
});

test('séance : centiles par histogramme, au dixième de milliseconde', () => {
  const { mesures: m } = horlogeControlee();
  images(m, [...Array(90).fill(10), ...Array(8).fill(20), 30, 250]);
  const s = m.lire().seance;
  assert.ok(Math.abs(s.p95 - 20) <= .1, 'p95 ' + s.p95); assert.ok(Math.abs(s.p99 - 30) <= .1, 'p99 ' + s.p99);
  assert.equal(s.pire, 250, 'un intervalle au-delà de l’histogramme reste exact');
  m.cadence({ periode: 1000 / 60 });
  // seuil 25 ms : 30 et 250 ms seulement ; celle de 250 ms, hors histogramme, compte aussi
  assert.equal(m.lire().seance.longues, 2, 'l’image de 250 ms, hors histogramme, compte parmi les longues');
});

test('séance : une image juste à 1,5 période n’est pas longue, une image au-delà l’est', () => {
  const { mesures: m } = horlogeControlee();
  m.cadence({ periode: 1000 / 60, diviseur: 1 });
  images(m, [25, 25.2]);
  assert.equal(m.lire().seance.longues, 1);
});

test('référence estimée : une cadence dégradée ne la déplace pas', () => {
  const { mesures: m } = horlogeControlee();
  // trois images sur cinq ratent une période : la médiane vaudrait 33 ms et cacherait ces accrocs
  images(m, Array.from({ length: 100 }, (_, i) => i % 5 < 3 ? 1000 / 30 : 1000 / 60));
  const v = m.lire();
  assert.ok(Math.abs(v.periodeEstimee - 1000 / 60) < 1e-9, 'référence ' + v.periodeEstimee);
  assert.equal(v.seance.longues, 60);
});

test('période et diviseur déclarés par le jeu : seuil à (diviseur + 0,5) périodes', () => {
  const { mesures: m } = horlogeControlee();
  m.cadence({ periode: 1000 / 60, diviseur: 2, verrouille: true });
  images(m, [...Array(20).fill(1000 / 30), 50, 50, 45]);
  let v = m.lire();
  assert.equal(v.diviseur, 2); assert.equal(v.verrou, true); assert.equal(v.seance.reference, 'jeu');
  assert.ok(Math.abs(v.seance.seuil - 2.5 * 1000 / 60) < 1e-9); assert.equal(v.seance.longues, 3);
  // l'image de FLoop convient telle quelle ; la cadence survit aux remises à zéro du volet
  m.cadence({ period: 1000 / 120, locked: false, steps: 1 }); m.reinitialiser();
  images(m, [8.3, 8.4, 13, 8.3]);
  v = m.lire();
  assert.ok(Math.abs(v.periode - 1000 / 120) < 1e-9); assert.equal(v.diviseur, null); assert.equal(v.verrou, false);
  assert.equal(v.seance.longues, 1);
  // période absente (0 avant les premiers échantillons de FLoop) et trop peu d'images : rien d'inventé
  m.cadence({ period: 0 }); v = m.lire();
  assert.equal(v.periode, null); assert.equal(v.periodeEstimee, null);
  assert.equal(v.seance.longues, null); assert.equal(v.seance.seuil, null); assert.equal(v.seance.reference, null);
  m.cadence(null); assert.equal(m.lire().periode, null);
  // un diviseur est un nombre entier d'images d'écran
  for (const k of [0, 1.5, -2, NaN]) { m.cadence({ periode: 1000 / 60, diviseur: k }); assert.equal(m.lire().diviseur, null, 'diviseur ' + k); }
});

test('créations tardives du moteur : N/D sans compteur, écart de la séance sinon', () => {
  const { mesures: m } = horlogeControlee();
  const principal = { stats: { drawCalls: 1, triangles: 1 } }, retro = { stats: { drawCalls: 1, triangles: 1, creations: { programmes: 1, cibles: 2 } } };
  m.vue('principale', principal); let v = m.lire(principal);
  assert.equal(v.creations, null); assert.equal(v.creationsSeance, null);
  principal.stats.creations = 5; m.vue('principale', principal);
  principal.stats.creations = 7; m.vue('principale', principal);
  m.vue('retro', retro); retro.stats.creations = { total: 4 }; m.vue('retro', retro);
  v = m.lire(principal);
  assert.equal(v.creations, 11); assert.equal(v.creationsSeance, 2 + 1);
  principal.stats.creations = 1; m.vue('principale', principal); // compteur reparti de zéro
  assert.equal(m.lire(principal).creationsSeance, 2 + 1 + 1);
  m.reinitialiser(); assert.equal(m.lire().creationsSeance, null);
  principal.stats.creations = 9; m.lire(principal); principal.stats.creations = 12;
  v = m.lire(principal); assert.equal(v.creationsSeance, 3);
});

test('le volet montre séance, période et créations, sans ramassage inventé', () => {
  const el = { setAttribute() {}, textContent: '' };
  const { mesures: m } = horlogeControlee({ createElement: () => el, body: { appendChild() {} } });
  images(m, [16.7, 40]);
  m.majAffichage(null, 10);
  assert.match(el.textContent, /séance 2 images · N\/D au-delà de 1,5 période · pire 40,0 ms à 0,0 s/);
  assert.match(el.textContent, /écran période N\/D · diviseur N\/D · créations tardives N\/D/);
  m.cadence({ periode: 1000 / 60, diviseur: 1 }); m.majAffichage(null, 20);
  assert.match(el.textContent, /séance 2 images · 1 au-delà de 1,5 période \(50,0 %\)/);
  assert.match(el.textContent, /écran période 16,7 ms · diviseur 1 · créations tardives N\/D/);
  // Sans période du jeu, la référence estimée est nommée comme telle, jamais donnée pour la période de l'écran.
  m.cadence(null); images(m, Array(40).fill(1000 / 60)); m.majAffichage(null, 30);
  assert.match(el.textContent, /séance 42 images · 1 au-delà de 1,5 période/);
  assert.match(el.textContent, /écran période N\/D · diviseur N\/D · référence estimée 16,7 ms · créations tardives N\/D/);
  const cles = JSON.stringify(m.lire());
  assert.doesNotMatch(cles, /ramass|"gc|garbage/i);
});

test('sans chronomètre GPU, le temps GPU reste N/D', () => {
  M.afficher(true, renduFactice({ drawCalls: 3, triangles: 30 }));
  const t0 = M.imageDebut();
  M.section('simulation', 1.5); M.section('rendu', 4); M.voitures(11, 12);
  M.vue('principale', renduFactice({ drawCalls: 40, triangles: 1200 }));
  M.imageFin(t0, 1 / 60);
  const v = M.lire();
  assert.equal(v.gpu, false); assert.equal(v.gpuValide, false); assert.equal(v.gpuMs, null);
  assert.ok(Math.abs(v.fps - 60) < .01, 'FPS attendu autour de 60, reçu ' + v.fps);
  assert.equal(v.cpu.rendu, 4); assert.equal(v.cpu.simulation, 1.5);
  assert.equal(v.vues.principale.drawCalls, 40);
  assert.equal(v.vues.joueur2.drawCalls, 0);
  assert.equal(v.voitures, 11); assert.equal(v.voituresTotal, 12);
});

test('les trois vues sont comptées séparément', () => {
  M.afficher(true, null);
  const t0 = M.imageDebut();
  M.vue('principale', renduFactice({ drawCalls: 50, triangles: 5000 }));
  M.vue('joueur2', renduFactice({ drawCalls: 48, triangles: 4800 }));
  M.vue('retro', renduFactice({ drawCalls: 12, triangles: 900 }));
  M.imageFin(t0, 1 / 60);
  const v = M.lire();
  assert.equal(v.vues.principale.drawCalls, 50);
  assert.equal(v.vues.joueur2.drawCalls, 48);
  assert.equal(v.vues.retro.drawCalls, 12);
  assert.equal(v.vues.retro.triangles, 900);
});

test('le GPU vient des requêtes du moteur, les mesures invalides sont écartées', () => {
  const stats = {
    gpu: true, discarded: 2, pending: 1,
    history: [
      { frame: 1, valid: true, queries: 3, completed: 3, gpu: { shadows: 1, world: 2, post: .5 } },
      { frame: 2, valid: false, queries: 3, completed: 1, gpu: { world: 99 } },
      { frame: 3, valid: true, queries: 3, completed: 2, gpu: { world: 99 } }
    ]
  };
  M.afficher(true, renduFactice({ drawCalls: 1, triangles: 1 }, stats));
  const t0 = M.imageDebut(); M.imageFin(t0, 1 / 60);
  const v = M.lire(renduFactice({ drawCalls: 1, triangles: 1 }, stats));
  assert.equal(v.gpu, true);
  assert.equal(v.gpuValide, true);
  assert.ok(Math.abs(v.gpuMs - 3.5) < 1e-9, 'seule la ligne complète compte, reçu ' + v.gpuMs);
  assert.deepEqual(v.gpuPasses, { shadows: 1, world: 2, post: .5 });
  assert.equal(v.gpuDescartes, 2);
});

test('une extension absente ou un profil inexistant ne fabrique pas de mesure', () => {
  const sans = { gpu: false, discarded: 0, pending: 0, history: [{ valid: true, queries: 1, completed: 1, gpu: { world: 5 } }] };
  M.afficher(true, renduFactice({ drawCalls: 1, triangles: 1 }, sans));
  const t0 = M.imageDebut(); M.imageFin(t0, 1 / 60);
  const v = M.lire(renduFactice({ drawCalls: 1, triangles: 1 }, sans));
  assert.equal(v.gpu, false); assert.equal(v.gpuValide, false); assert.equal(v.gpuMs, null);
});

test('reinitialiser vide la fenêtre', () => {
  M.afficher(true, null);
  const t0 = M.imageDebut(); M.section('effets', 2); M.imageFin(t0, 1 / 60);
  M.reinitialiser();
  const v = M.lire();
  assert.equal(v.fps, null); assert.equal(v.cpu.effets, null); assert.equal(v.images, 0);
  M.afficher(false, null);
  assert.equal(M.actif, false);
});

test('le budget audio ne devient pas une activité avant le geste utilisateur', () => {
  const { mesures: m } = horlogeControlee();
  assert.equal(m.lire().audio.budget, null);
  m.audio({ actif: false, voix: 5, joueurs: 2, rivaux: 3, fondus: 0, budget: 5, musique: true });
  let a = m.lire().audio;
  assert.equal(a.actif, false); assert.equal(a.voix, 0); assert.equal(a.joueurs, 0); assert.equal(a.rivaux, 0);
  assert.equal(a.budget, 5); assert.equal(a.musique, false);
  const stats = { actif: true, voix: 5, joueurs: 2, rivaux: 2, fondus: 1, budget: 5, musique: false };
  m.audio(stats); a = m.lire().audio;
  assert.equal(a.voix, 5); assert.equal(a.joueurs, 2); assert.equal(a.rivaux, 2); assert.equal(a.fondus, 1);
  stats.voix = 99;
  assert.equal(m.lire().audio.voix, 5, 'relevé indépendant de l’objet fourni');
  m.audio(null);
  assert.equal(m.lire().audio.actif, false); assert.equal(m.lire().audio.voix, 0);
  assert.equal(a.voix, 5, 'un ancien rapport reste un instantané');
});

test('le retour de l’horloge à zéro rafraîchit immédiatement le volet', () => {
  const el = { setAttribute() {}, textContent: '' };
  const { mesures: m } = horlogeControlee({ createElement: () => el, body: { appendChild() {} } });
  m.audio({ actif: true, voix: 4, joueurs: 1, rivaux: 3, fondus: 0, budget: 5, musique: false });
  m.majAffichage(null, 50);
  assert.match(el.textContent, /voix moteur 4\/5/);
  el.textContent = 'ancien relevé';
  m.reinitialiser(); m.majAffichage(null, 0);
  assert.notEqual(el.textContent, 'ancien relevé');
  assert.match(el.textContent, /son non démarré/);
});
