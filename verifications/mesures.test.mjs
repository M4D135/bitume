// Instrumentation : le volet sépare les vues, ne rend jamais un temps JavaScript pour un temps GPU, et lit les
// requêtes asynchrones du moteur sans attendre. Sans extension, la ligne GPU reste N/D.
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
  for (const n of ['imageDebut', 'imageFin', 'section', 'vue', 'voitures', 'pieces', 'audio', 'reglages', 'lire', 'reinitialiser', 'afficher', 'majAffichage'])
    assert.equal(typeof M[n], 'function', n + ' manque');
  assert.deepEqual(M.VUES, ['principale', 'joueur2', 'retro']);
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
