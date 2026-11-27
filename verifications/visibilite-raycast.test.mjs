import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.BITUME = globalThis.BITUME || {};
await import('../src/visibilite-raycast.js');
const { creer, calculerFovea, occulter } = globalThis.BITUME.visibiliteRaycast;

const cam = {
  pos: [0, 10, 0],
  yaw: 0,
  pitch: 0,
  roll: 0,
  fov: 75
};

function faireSol(hauteurColline, zColline, largeurColline) {
  return function (x, z) {
    const d = Math.abs(z - zColline);
    if (d < largeurColline) {
      const t = d / largeurColline;
      return (1 - t * t) * hauteurColline;
    }
    return 0;
  };
}

test('1. Lot basse altitude derrière une colline -> masqué', () => {
  const sol = faireSol(45, -100, 60);
  const decor = {
    lots: [
      { centre: [0, 10, -220], rayon: 10, ombre: false, groundCover: false, detailProcheSeul: false }
    ],
    nappes: [],
    sol
  };
  const etat = creer(decor);
  occulter(etat, cam, 1.77, { actif: true });
  assert.equal(etat.masqueLots[0], 1, 'Le lot derrière la colline doit être masqué');
});

test('2. Pic montagneux haut derrière la colline -> non masqué (zéro clipping)', () => {
  const sol = faireSol(45, -100, 60);
  const decor = {
    lots: [
      { centre: [0, 180, -220], rayon: 10, ombre: false, groundCover: false, detailProcheSeul: false }
    ],
    nappes: [],
    sol
  };
  const etat = creer(decor);
  occulter(etat, cam, 1.77, { actif: true });
  assert.equal(etat.masqueLots[0], 0, 'Le pic haut ne doit PAS être masqué');
});

test('3. Lot proche (<96m) ou nappe chaussee/accotement/eau -> jamais masqué', () => {
  const sol = faireSol(45, -100, 60);
  const decor = {
    lots: [
      { centre: [0, 10, -50], rayon: 10, ombre: false, groundCover: false, detailProcheSeul: false }
    ],
    nappes: [
      { sommets: new Float32Array(13 * 4), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), surfaceType: 'chaussee' },
      { sommets: new Float32Array(13 * 4), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), surfaceType: 'accotement' },
      { sommets: new Float32Array(13 * 4), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), surfaceType: 'eau' }
    ],
    sol
  };
  const etat = creer(decor);
  occulter(etat, cam, 1.77, { actif: true, vue: 'cockpit' });
  assert.equal(etat.masqueLots[0], 0, 'Lot proche jamais masqué');
  assert.equal(etat.masqueNappes[0], 0, 'Nappe chaussee jamais masquée');
  assert.equal(etat.masqueNappes[1], 0, 'Nappe accotement jamais masquée');
  assert.equal(etat.masqueNappes[2], 0, 'Nappe eau jamais masquée');
});

test('4. Occultation bas-écran cockpit vs poursuite', () => {
  const sol = () => -120;
  const decor = {
    lots: [
      { centre: [0, -85, -180], rayon: 6, ombre: false, groundCover: false, detailProcheSeul: false }
    ],
    nappes: [],
    sol
  };
  const etat = creer(decor);

  occulter(etat, cam, 1.77, { actif: true, vue: 'cockpit' });
  assert.equal(etat.masqueLots[0], 1, 'Lot bas masqué en vue cockpit (derrière tableau de bord)');

  occulter(etat, cam, 1.77, { actif: true, vue: 'poursuite' });
  assert.equal(etat.masqueLots[0], 0, 'Lot bas visible en vue poursuite');
});

test('5. calculerFovea suit virage à droite + zéro allocation', () => {
  const sol = faireSol(0, -100, 60);
  const decor = {
    lots: [
      { centre: [0, 10, -220], rayon: 10, ombre: false, groundCover: false, detailProcheSeul: false }
    ],
    nappes: [],
    sol
  };
  const etat = creer(decor);

  const masqueRef = etat.masqueLots;
  const foveaRef = etat.fovea;

  const circuit = {
    points: [
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 10, z: -50 },
      { x: 10, y: 10, z: -100 },
      { x: 30, y: 10, z: -150 },
      { x: 50, y: 10, z: -200 }
    ]
  };

  globalThis.BITUME.circuit = {
    echantillon(c, s, cible) {
      const pts = c.points;
      const n = pts.length;
      const t = Math.max(0, Math.min(n - 1, s / 50));
      const i = Math.floor(t);
      const f = t - i;
      const p0 = pts[Math.min(i, n - 1)];
      const p1 = pts[Math.min(i + 1, n - 1)];
      cible.x = p0.x + (p1.x - p0.x) * f;
      cible.y = p0.y + (p1.y - p0.y) * f;
      cible.z = p0.z + (p1.z - p0.z) * f;
      return cible;
    }
  };

  const voitureEtat = { s: 100, v: 60 };

  calculerFovea(etat, circuit, voitureEtat, cam, 1.77, {});
  assert.ok(etat.fovea[0] > 0.51, `Fovéa doit suivre le virage à droite (u=${etat.fovea[0]})`);

  occulter(etat, cam, 1.77, { actif: true });
  assert.equal(etat.masqueLots, masqueRef, 'masqueLots garde la même référence (zéro allocation)');
  assert.equal(etat.fovea, foveaRef, 'fovea garde la même référence (zéro allocation)');
});
