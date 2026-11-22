(function (B) {
  'use strict';

  /**
   * B.cameraTransition — Transitions continues de caméra entre les 6 vues de conduite.
   * Interpole en repère relatif voiture (quand carPos/carCap sont fournis) pour éviter
   * tout décrochage ou traversée de la carrosserie à 300 km/h. Zéro allocation par frame.
   */

  function _angle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  function creer() {
    return {
      actif: false,
      t: 0,
      duree: 0.24,
      enRepere: false,
      de: { pos: [0, 0, 0], local: [0, 0, 0], yaw: 0, dyaw: 0, pitch: 0, roll: 0, fov: 64, near: 0.1 },
      sortie: { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fov: 64, near: 0.1 },
      _cibleLocal: [0, 0, 0]
    };
  }

  function mondeVersLocal(pos, carPos, cap, out) {
    const dx = pos[0] - carPos[0], dy = pos[1] - carPos[1], dz = pos[2] - carPos[2];
    const ca = Math.cos(cap), sa = Math.sin(cap);
    out[0] = dx * ca + dz * sa;
    out[1] = dy;
    out[2] = -dx * sa + dz * ca;
  }

  function demander(etat, camCourante, options) {
    if (!options) options = {};
    if (options.instantane === true || !camCourante) {
      etat.actif = false;
      return;
    }
    const de = etat.de;
    const p = camCourante.pos;
    de.pos[0] = p[0]; de.pos[1] = p[1]; de.pos[2] = p[2];
    de.yaw = camCourante.yaw || 0;
    de.pitch = camCourante.pitch || 0;
    de.roll = camCourante.roll || 0;
    de.fov = camCourante.fov || 64;
    de.near = camCourante.near || 0.1;

    if (options.carPos && Number.isFinite(options.carCap)) {
      mondeVersLocal(p, options.carPos, options.carCap, de.local);
      de.dyaw = _angle(de.yaw - (-options.carCap + Math.PI * 0.5));
      etat.enRepere = true;
    } else {
      etat.enRepere = false;
    }

    etat.t = 0;
    etat.duree = options.duree || 0.24;
    etat.actif = true;
  }

  function appliquer(etat, camCible, dt, options) {
    if (!options) options = {};
    if (!etat || !etat.actif) return camCible;

    etat.t += Math.max(0, Math.min(0.05, dt));
    if (etat.t >= etat.duree) {
      etat.actif = false;
      return camCible;
    }

    // Ease-out quartique : départ vif, arrivée posée sans rebond
    const ratio = etat.t / etat.duree;
    const inv = 1 - ratio;
    const u = 1 - inv * inv * inv * inv;

    const de = etat.de;
    const s = etat.sortie;
    const cible = camCible;

    if (etat.enRepere && options.carPos && Number.isFinite(options.carCap)) {
      const cl = etat._cibleLocal;
      mondeVersLocal(cible.pos, options.carPos, options.carCap, cl);
      // Léger arc vertical de dégagement si la caméra franchit la longueur du cockpit/capot
      const distLon = Math.abs(cl[0] - de.local[0]);
      const arcY = distLon > 1.8 ? Math.sin(Math.PI * u) * Math.min(0.45, distLon * 0.08) : 0;
      const lx = de.local[0] + (cl[0] - de.local[0]) * u;
      const ly = de.local[1] + (cl[1] - de.local[1]) * u + arcY;
      const lz = de.local[2] + (cl[2] - de.local[2]) * u;
      const ca = Math.cos(options.carCap), sa = Math.sin(options.carCap);
      s.pos[0] = options.carPos[0] + lx * ca - lz * sa;
      s.pos[1] = options.carPos[1] + ly;
      s.pos[2] = options.carPos[2] + lx * sa + lz * ca;
      const baseYaw = -options.carCap + Math.PI * 0.5;
      const cibleDyaw = _angle(cible.yaw - baseYaw);
      s.yaw = baseYaw + de.dyaw + _angle(cibleDyaw - de.dyaw) * u;
    } else {
      s.pos[0] = de.pos[0] + (cible.pos[0] - de.pos[0]) * u;
      s.pos[1] = de.pos[1] + (cible.pos[1] - de.pos[1]) * u;
      s.pos[2] = de.pos[2] + (cible.pos[2] - de.pos[2]) * u;
      const dyaw = _angle(cible.yaw - de.yaw);
      s.yaw = de.yaw + dyaw * u;
    }

    if (options.solY !== undefined) {
      const minSol = options.solY + 0.30;
      if (s.pos[1] < minSol) s.pos[1] = minSol;
    }

    s.pitch = de.pitch + (cible.pitch - de.pitch) * u;
    s.roll = de.roll + (cible.roll - de.roll) * u;
    s.fov = de.fov + (cible.fov - de.fov) * u;
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
