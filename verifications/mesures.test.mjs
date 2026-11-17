// Instrumentation : le volet sépare les vues, ne rend jamais un temps JavaScript pour un temps GPU, et lit les
// requêtes asynchrones du moteur sans attendre. Sans extension, la ligne GPU reste N/D.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const req = createRequire(import.meta.url);
req('../src/mesures.js');
const M = globalThis.BITUME.mesures;

function renduFactice(stats, profil) {
  return { stats, profile: profil === undefined ? undefined : () => profil };
}

test('le module expose l API attendue', () => {
  for (const n of ['imageDebut', 'imageFin', 'section', 'vue', 'voitures', 'reglages', 'lire', 'reinitialiser', 'afficher', 'majAffichage'])
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
