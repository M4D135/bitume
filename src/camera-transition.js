(function (B) {
  'use strict';

  /**
   * B.cameraTransition — Transitions continues de caméra entre les 6 vues de conduite.
   * Zéro allocation par frame. Interpolation ease-out cubic.
   */

  function _angle(a) {
    // ramène à [-PI, PI]
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  function creer() {
    return {
      actif: false,
      t: 0,
      duree: 0.34,
      de: { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fov: 64, near: 0.1 },
      sortie: { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fov: 64, near: 0.1 }
    };
  }

  function demander(etat, camCourante, options) {
    if (!options) options = {};
    if (options.instantane === true || !camCourante) {
      etat.actif = false;
      return;
    }
    // Copie en place dans etat.de
    const de = etat.de;
    const p = camCourante.pos;
    de.pos[0] = p[0];
    de.pos[1] = p[1];
    de.pos[2] = p[2];
    de.yaw = camCourante.yaw || 0;
    de.pitch = camCourante.pitch || 0;
    de.roll = camCourante.roll || 0;
    de.fov = camCourante.fov || 64;
    de.near = camCourante.near || 0.1;

    etat.t = 0;
    etat.duree = options.duree || 0.34;
    etat.actif = true;
  }

  function appliquer(etat, camCible, dt, options) {
    if (!options) options = {};
    if (!etat || !etat.actif) return camCible;

    // Avance le temps, clampé pour éviter les sauts
    etat.t += Math.max(0, Math.min(0.05, dt));

    if (etat.t >= etat.duree) {
      etat.actif = false;
      return camCible;
    }

    // Ease-out cubic : u = 1 - (1 - t/d)^3
    const ratio = etat.t / etat.duree;
    const inv = 1 - ratio;
    const u = 1 - inv * inv * inv;

    const de = etat.de;
    const s = etat.sortie;
    const cible = camCible;

    // Position : interpolation linéaire
    s.pos[0] = de.pos[0] + (cible.pos[0] - de.pos[0]) * u;
    s.pos[1] = de.pos[1] + (cible.pos[1] - de.pos[1]) * u;
    s.pos[2] = de.pos[2] + (cible.pos[2] - de.pos[2]) * u;

    // Garde-fou chaussée visible : ne jamais passer sous l'asphalte
    if (options.solY !== undefined) {
      const minSol = options.solY + 0.32;
      if (s.pos[1] < minSol) s.pos[1] = minSol;
    }

    // Yaw : plus court chemin angulaire
    const dyaw = _angle(cible.yaw - de.yaw);
    s.yaw = de.yaw + dyaw * u;

    // Pitch, roll, fov : linéaire
    s.pitch = de.pitch + (cible.pitch - de.pitch) * u;
    s.roll = de.roll + (cible.roll - de.roll) * u;
    s.fov = de.fov + (cible.fov - de.fov) * u;

    // Near : minimum des deux (sécurité)
    s.near = Math.min(de.near, cible.near);
    s.far = cible.far;

    return s;
  }

  function annuler(etat) {
    if (etat) etat.actif = false;
  }

  B.cameraTransition = { creer, demander, appliquer, annuler };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.cameraTransition;
