/* BITUME — Panneaux LED modernes de virage à flèches défilantes (>>> / <<<) & bandeaux LED portiques.
   Zéro allocation par image ; émission scalaire compatible FRender. */
(function (B) {
  'use strict';

  const LED_COUNT = 12;
  const CHEVRONS_PAR_PANNEAU = 4;
  const RAYON_PANNEAUX_2 = 650 * 650;

  function creer(circuit, decor, options) {
    if (!options) options = {};
    const chevrons = [];
    const panneaux = [];
    const bandeaux = [];
    const avant = [];
    const objets = [];
    if (!circuit || !circuit.n) return { chevrons, panneaux, bandeaux, avant, objets };

    const lim = B.decor && B.decor.limites ? B.decor.limites(circuit) : null;
    const w = (circuit.largeur || 12) / 2;
    const solFn = decor && typeof decor.sol === 'function' ? decor.sol : null;
    const pas = circuit.pas || 2;
    const longueur = Number.isFinite(circuit.longueur)
      ? circuit.longueur
      : (circuit.s && circuit.s.length ? circuit.s[circuit.n - 1] : 4000);
    const maxPanneaux = Math.max(72, Math.round(longueur / 65));
    const maxAvant = Math.max(48, Math.round(longueur / 110));

    function couvert(s) {
      return B.circuit && B.circuit.dansCouvert ? B.circuit.dansCouvert(circuit, s, 14) : false;
    }

    function pont(s) {
      if (!circuit.ponts) return false;
      for (let p = 0; p < circuit.ponts.length; p++) {
        const q = circuit.ponts[p];
        if (!q) continue;
        const d = Number.isFinite(q.debut) ? q.debut : -1e9;
        const f = Number.isFinite(q.fin) ? q.fin : 1e9;
        if (s >= d - 10 && s <= f + 10) return true;
      }
      return false;
    }

    function solY(x, z, yRoute) {
      if (solFn) {
        const y = solFn(x, z);
        if (Number.isFinite(y)) return Math.max(yRoute - 3.0, Math.min(yRoute + 1.5, y));
      }
      return yRoute - 0.15;
    }

    function capAt(i) {
      return circuit.cap && Number.isFinite(circuit.cap[i]) ? circuit.cap[i] : 0;
    }

    function courbureAt(i) {
      return circuit.courbure && Number.isFinite(circuit.courbure[i]) ? circuit.courbure[i] : 0;
    }

    function axes(i, ext) {
      const cap = capAt(i);
      const yaw = -cap + ext * 0.18;
      return {
        yaw,
        fx: -Math.cos(yaw),
        fz: Math.sin(yaw),
        bx: Math.sin(yaw),
        bz: Math.cos(yaw)
      };
    }

    function degage(x, z, i, bx, bz, largeur) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      const margeCentre = w + 3.6;
      const margePoste = w + 1.0;
      const m2C = margeCentre * margeCentre;
      const m2P = margePoste * margePoste;
      const j0 = Math.max(0, i - 180);
      const j1 = Math.min(circuit.n, i + 180);

      for (let j = j0; j < j1; j += 2) {
        if (Math.abs(j - i) < 8) continue;
        const dx = circuit.x[j] - x;
        const dz = circuit.z[j] - z;
        if (dx * dx + dz * dz < m2C) return false;
      }

      const half = Math.max(0.5, largeur * 0.5);
      const sides = [-half, -half * 0.55, half * 0.55, half];
      for (let s = 0; s < sides.length; s++) {
        const ox = x + bx * sides[s];
        const oz = z + bz * sides[s];
        for (let j = j0; j < j1; j += 2) {
          if (Math.abs(j - i) < 8) continue;
          const dx = circuit.x[j] - ox;
          const dz = circuit.z[j] - oz;
          if (dx * dx + dz * dz < m2P) return false;
        }
      }
      return true;
    }

    let dernierX = -1e9, dernierZ = -1e9;

    function creerPanneauChevron(i, ext, minDist) {
      if (panneaux.length >= maxPanneaux) return false;
      const s = i * pas;
      if (s < 20 || s > longueur - 20 || couvert(s) || pont(s)) return false;

      const ax = axes(i, ext);
      const latBase = lim && lim.G && lim.D ? (ext < 0 ? lim.G[i] : lim.D[i]) : w + 3.2;
      const lat = Math.max(w + 3.0, (Number.isFinite(latBase) ? latBase : w + 3.2) + 1.0);
      const x = circuit.x[i] + ax.bx * ext * lat;
      const z = circuit.z[i] + ax.bz * ext * lat;

      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      if ((x - dernierX) * (x - dernierX) + (z - dernierZ) * (z - dernierZ) < minDist * minDist) return false;
      if (!degage(x, z, i, ax.bx, ax.bz, 3.4)) return false;

      const yRoute = circuit.y[i] - Math.sin(circuit.devers && Number.isFinite(circuit.devers[i]) ? circuit.devers[i] : 0) * ext * w;
      const ySol = solY(x, z, yRoute);
      const yCentre = ySol + 1.55;
      const objs = [];

      function add(o) {
        objets.push(o);
        objs.push(o);
        return o;
      }

      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const side = sideIdx === 0 ? -1.25 : 1.25;
        const px = x + ax.bx * side;
        const pz = z + ax.bz * side;
        add({
          shape: 'box',
          p: [px, ySol + 0.78, pz],
          s: [0.09, 1.56, 0.09],
          r: [0, ax.yaw, 0],
          mat: 0,
          color: [0.16, 0.18, 0.21],
          emissive: 0
        });
      }

      add({
        shape: 'box',
        p: [x, yCentre, z],
        s: [0.14, 0.90, 3.2],
        r: [0, ax.yaw, 0],
        mat: 1,
        color: [0.045, 0.052, 0.068],
        emissive: 0
      });

      const kSign = ext < 0 ? 1 : -1;
      const fleches = [];

      for (let a = 0; a < CHEVRONS_PAR_PANNEAU; a++) {
        const decZ = (a - 1.5) * 0.72;
        const px = x + ax.fx * 0.085 + ax.bx * decZ;
        const pz = z + ax.fz * 0.085 + ax.bz * decZ;

        const haut = add({
          shape: 'box',
          p: [px, yCentre + 0.115, pz],
          s: [0.032, 0.082, 0.40],
          r: [kSign * 0.70, ax.yaw, 0],
          mat: 16,
          color: [1.0, 0.54, 0.05],
          emissive: 0.45
        });

        const bas = add({
          shape: 'box',
          p: [px, yCentre - 0.115, pz],
          s: [0.032, 0.082, 0.40],
          r: [-kSign * 0.70, ax.yaw, 0],
          mat: 16,
          color: [1.0, 0.54, 0.05],
          emissive: 0.45
        });

        const ordre = kSign > 0 ? a : (CHEVRONS_PAR_PANNEAU - 1 - a);
        fleches.push({ ordre, haut, bas });
        chevrons.push({ x: px, y: yCentre, z: pz, ordre, haut, bas });
      }

      panneaux.push({ x, y: yCentre, z, fleches, objets: objs });
      dernierX = x;
      dernierZ = z;
      return true;
    }

    let i = 12;
    const pasScan = Math.max(1, Math.round(12 / pas));
    while (i < circuit.n - 12 && panneaux.length < maxPanneaux) {
      const kAbs = Math.abs(courbureAt(i));
      if (kAbs < 1 / 72) {
        i += pasScan;
        continue;
      }

      let j = i;
      let maxK = 0;
      let maxIdx = i;
      while (j < circuit.n - 12) {
        const kk = Math.abs(courbureAt(j));
        if (kk < 1 / 72) break;
        if (kk > maxK) {
          maxK = kk;
          maxIdx = j;
        }
        j++;
      }

      const ext = courbureAt(maxIdx) >= 0 ? -1 : 1;
      const hairpin = maxK > 1 / 45;
      const minDist = hairpin ? 16 : 26;
      const segmentLen = (j - i) * pas;
      let count = hairpin
        ? (maxK > 1 / 28 ? 3 : 2)
        : Math.max(1, Math.min(4, Math.floor(segmentLen / 26) + 1));

      for (let q = 0; q < count && panneaux.length < maxPanneaux; q++) {
        const idx = i + Math.round((j - i - 1) * (q + 0.5) / count);
        creerPanneauChevron(idx, ext, minDist);
      }

      if (panneaux.length < maxPanneaux) creerPanneauChevron(maxIdx, ext, minDist);
      i = j + Math.max(1, Math.round(25 / pas));
    }

    let dernierAvantX = -1e9, dernierAvantZ = -1e9;

    function creerAvant(i, ext, refIdx) {
      if (avant.length >= maxAvant) return false;
      const s = i * pas;
      if (s < 20 || s > longueur - 20 || couvert(s) || pont(s)) return false;

      const ax = axes(i, ext);
      const latBase = lim && lim.G && lim.D ? (ext < 0 ? lim.G[i] : lim.D[i]) : w + 3.2;
      const lat = Math.max(w + 3.0, (Number.isFinite(latBase) ? latBase : w + 3.2) + 1.2);
      const x = circuit.x[i] + ax.bx * ext * lat;
      const z = circuit.z[i] + ax.bz * ext * lat;

      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      if ((x - dernierAvantX) * (x - dernierAvantX) + (z - dernierAvantZ) * (z - dernierAvantZ) < 40 * 40) return false;
      if (!degage(x, z, i, ax.bx, ax.bz, 1.3)) return false;

      const yRoute = circuit.y[i] - Math.sin(circuit.devers && Number.isFinite(circuit.devers[i]) ? circuit.devers[i] : 0) * ext * w;
      const ySol = solY(x, z, yRoute);
      const objs = [];
      const rouges = [];
      const points = [];

      function add(o) {
        objets.push(o);
        objs.push(o);
        return o;
      }

      add({
        shape: 'box',
        p: [x, ySol + 1.1, z],
        s: [0.09, 2.2, 0.09],
        r: [0, ax.yaw, 0],
        mat: 0,
        color: [0.18, 0.20, 0.23],
        emissive: 0
      });

      const kSign = courbureAt(refIdx) >= 0 ? 1 : -1;

      add({
        shape: 'box',
        p: [x + ax.fx * 0.04, ySol + 1.45, z + ax.fz * 0.04],
        s: [0.05, 0.12, 1.05],
        r: [0, ax.yaw, 0],
        mat: 16,
        color: [0.92, 0.94, 0.96],
        emissive: 0.35
      });

      add({
        shape: 'box',
        p: [x + ax.fx * 0.04 + ax.bx * (-0.26), ySol + 1.80, z + ax.fz * 0.04 + ax.bz * (-0.26)],
        s: [0.05, 0.10, 0.62],
        r: [0.65, ax.yaw, 0],
        mat: 16,
        color: [0.92, 0.94, 0.96],
        emissive: 0.35
      });

      add({
        shape: 'box',
        p: [x + ax.fx * 0.04 + ax.bx * 0.26, ySol + 1.80, z + ax.fz * 0.04 + ax.bz * 0.26],
        s: [0.05, 0.10, 0.62],
        r: [-0.65, ax.yaw, 0],
        mat: 16,
        color: [0.92, 0.94, 0.96],
        emissive: 0.35
      });

      rouges.push(add({
        shape: 'box',
        p: [x + ax.fx * 0.06, ySol + 2.22, z + ax.fz * 0.06],
        s: [0.045, 0.08, 1.15],
        r: [0, ax.yaw, 0],
        mat: 16,
        color: [1.0, 0.12, 0.08],
        emissive: 0.8
      }));

      rouges.push(add({
        shape: 'box',
        p: [x + ax.fx * 0.06 + ax.bx * (-0.30), ySol + 1.80, z + ax.fz * 0.06 + ax.bz * (-0.30)],
        s: [0.045, 0.08, 0.66],
        r: [0.65, ax.yaw, 0],
        mat: 16,
        color: [1.0, 0.12, 0.08],
        emissive: 0.8
      }));

      rouges.push(add({
        shape: 'box',
        p: [x + ax.fx * 0.06 + ax.bx * 0.30, ySol + 1.80, z + ax.fz * 0.06 + ax.bz * 0.30],
        s: [0.045, 0.08, 0.66],
        r: [-0.65, ax.yaw, 0],
        mat: 16,
        color: [1.0, 0.12, 0.08],
        emissive: 0.8
      }));

      for (let q = 0; q < 4; q++) {
        const lx = (q - 1.5) * 0.22;
        const ly = ySol + 1.75 + (q - 1.5) * 0.05 * kSign;

        add({
          shape: 'box',
          p: [x + ax.fx * 0.05 + ax.bx * lx, ly, z + ax.fz * 0.05 + ax.bz * lx],
          s: [0.04, 0.07, 0.18],
          r: [kSign * 0.4, ax.yaw, 0],
          mat: 1,
          color: [0.04, 0.04, 0.05],
          emissive: 0
        });

        points.push(add({
          shape: 'box',
          p: [x + ax.fx * 0.075 + ax.bx * lx, ly, z + ax.fz * 0.075 + ax.bz * lx],
          s: [0.035, 0.035, 0.035],
          r: [0, ax.yaw, 0],
          mat: 16,
          color: [1.0, 0.54, 0.05],
          emissive: 0.45
        }));
      }

      avant.push({ x, y: ySol + 1.85, z, rouges, points, objets: objs, phase: avant.length * 0.37 });
      dernierAvantX = x;
      dernierAvantZ = z;
      return true;
    }

    let a = 12;
    while (a < circuit.n - 12 && avant.length < maxAvant) {
      const kAbs = Math.abs(courbureAt(a));
      if (kAbs < 1 / 70) {
        a += Math.max(1, Math.round(15 / pas));
        continue;
      }

      let b = a;
      let maxK = 0;
      let maxIdx = a;
      while (b < circuit.n - 12) {
        const kk = Math.abs(courbureAt(b));
        if (kk < 1 / 70) break;
        if (kk > maxK) {
          maxK = kk;
          maxIdx = b;
        }
        b++;
      }

      const sEntree = a * pas;
      const sAvant = sEntree - 75;
      if (sAvant > 25 && sAvant < longueur - 25) {
        const idxAvant = Math.max(0, Math.min(circuit.n - 1, Math.round(sAvant / pas)));
        const ext = courbureAt(maxIdx) >= 0 ? -1 : 1;
        creerAvant(idxAvant, ext, maxIdx);
      }

      a = b + Math.max(1, Math.round(50 / pas));
    }

    const portiquesS = [0];
    if (circuit.ouvert && Number.isFinite(circuit.arrivee) && circuit.arrivee > 100) {
      portiquesS.push(circuit.arrivee);
    }

    for (let pIdx = 0; pIdx < portiquesS.length; pIdx++) {
      const s = portiquesS[pIdx];
      const idx = Math.max(0, Math.min(circuit.n - 1, Math.round(s / (circuit.pas || 2))));
      const cap = capAt(idx);
      const cx = circuit.x[idx], cy = circuit.y[idx], cz = circuit.z[idx];
      const rx = -Math.sin(cap), rz = Math.cos(cap);
      const tx = Math.cos(cap), tz = Math.sin(cap);
      const largeurBandeau = Math.min(13.2, (circuit.largeur || 12) + 0.8);

      for (let faceIdx = 0; faceIdx < 2; faceIdx++) {
        const face = faceIdx === 0 ? -1 : 1;
        const modules = [];
        for (let m = 0; m < LED_COUNT; m++) {
          const lat = -largeurBandeau / 2 + (m + 0.5) * (largeurBandeau / LED_COUNT);
          const obj = {
            shape: 'box',
            p: [cx + rx * lat + tx * face * 0.34, cy + 5.72, cz + rz * lat + tz * face * 0.34],
            s: [0.10, 0.24, largeurBandeau / LED_COUNT * 0.82],
            r: [0, -cap, 0],
            mat: 16,
            color: [0.10, 0.90, 0.30],
            emissive: 0.75
          };
          modules.push(obj);
          objets.push(obj);
        }
        bandeaux.push({ s, modules });
      }
    }

    return { chevrons, panneaux, bandeaux, avant, portique: bandeaux, objets };
  }

  function animer(etat, t, contexte, sortie) {
    if (!etat) return;
    const camPos = contexte && (contexte.cameraPos || contexte.camPos);
    const phaseCourse = (contexte && contexte.phase) || 'vert';
    const feuxAllumes = (contexte && (contexte.feux ?? contexte.feuxAllumes)) || 0;
    const pluie = (contexte && contexte.pluie) || 0;
    const nuit = (contexte && contexte.nuit) || 0;
    const temps = Number.isFinite(t) ? t : 0;
    const boostNuit = 1 + 1.6 * nuit;

    const panneaux = etat.panneaux;
    if (panneaux) {
      const curseur = (temps * 4.2) % CHEVRONS_PAR_PANNEAU;
      for (let i = 0; i < panneaux.length; i++) {
        const p = panneaux[i];
        if (camPos) {
          const dx = p.x - camPos[0];
          const dz = p.z - camPos[2];
          if (dx * dx + dz * dz > RAYON_PANNEAUX_2) continue;
        }

        const fleches = p.fleches;
        if (fleches) {
          for (let f = 0; f < fleches.length; f++) {
            const fl = fleches[f];
            let dist = Math.abs(curseur - fl.ordre);
            if (dist > CHEVRONS_PAR_PANNEAU * 0.5) dist = CHEVRONS_PAR_PANNEAU - dist;
            const onde = Math.max(0, 1 - dist * dist * 1.8);
            const em = (0.45 + 1.55 * onde) * boostNuit;
            const g = 0.54 + 0.41 * onde;
            const b = 0.05 + 0.40 * onde;

            fl.haut.emissive = em;
            fl.bas.emissive = em;
            fl.haut.color[0] = 1.0;
            fl.haut.color[1] = g;
            fl.haut.color[2] = b;
            fl.bas.color[0] = 1.0;
            fl.bas.color[1] = g;
            fl.bas.color[2] = b;
          }
        }

        if (sortie && p.objets) {
          for (let k = 0; k < p.objets.length; k++) sortie.push(p.objets[k]);
        }
      }
    }

    const avant = etat.avant;
    if (avant) {
      for (let i = 0; i < avant.length; i++) {
        const a = avant[i];
        if (camPos) {
          const dx = a.x - camPos[0];
          const dz = a.z - camPos[2];
          if (dx * dx + dz * dz > RAYON_PANNEAUX_2) continue;
        }

        let phase = (temps * 1.8 + a.phase) % 1;
        if (phase < 0) phase += 1;
        const pulse = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        const emRouge = (0.55 + 1.45 * pulse) * boostNuit;

        for (let r = 0; r < a.rouges.length; r++) {
          const o = a.rouges[r];
          o.emissive = emRouge;
          o.color[0] = 1.0;
          o.color[1] = 0.12;
          o.color[2] = 0.08;
        }

        const curseurD = (temps * 5.0 + a.phase * 2.0) % 4;
        for (let d = 0; d < a.points.length; d++) {
          const o = a.points[d];
          let dist = Math.abs(curseurD - d);
          if (dist > 2) dist = 4 - dist;
          const onde = Math.max(0, 1 - dist * dist * 2.2);
          o.emissive = (0.35 + 1.7 * onde) * boostNuit;
          o.color[0] = 1.0;
          o.color[1] = 0.54 + 0.41 * onde;
          o.color[2] = 0.05 + 0.40 * onde;
        }

        if (sortie && a.objets) {
          for (let k = 0; k < a.objets.length; k++) sortie.push(a.objets[k]);
        }
      }
    }

    const bandeaux = etat.bandeaux;
    if (bandeaux) {
      for (let b = 0; b < bandeaux.length; b++) {
        const mods = bandeaux[b].modules;
        for (let m = 0; m < mods.length; m++) {
          const o = mods[m];

          if (phaseCourse === 'depart' || phaseCourse === 'feux') {
            const seuil = Math.round(feuxAllumes * LED_COUNT / 5);
            const allume = m < seuil;
            o.color[0] = allume ? 0.96 : 0.20;
            o.color[1] = allume ? 0.10 : 0.04;
            o.color[2] = allume ? 0.06 : 0.04;
            o.emissive = (allume ? 1.15 : 0.05) * boostNuit;
          } else if (phaseCourse === 'damier' || phaseCourse === 'fini' || phaseCourse === 'arrivee') {
            const damier = ((m + Math.floor(temps * 5)) & 1) === 0;
            o.color[0] = damier ? 0.96 : 0.08;
            o.color[1] = damier ? 0.96 : 0.08;
            o.color[2] = damier ? 0.96 : 0.08;
            o.emissive = (damier ? 1.1 : 0.06) * boostNuit;
          } else if (phaseCourse === 'pluie' || pluie > 0.35) {
            let phase = (temps * 0.7 - m * 0.08) % 1;
            if (phase < 0) phase += 1;
            const vague = phase < 0.5 ? phase * 2 : 2 - phase * 2;
            o.color[0] = 0.12;
            o.color[1] = 0.62;
            o.color[2] = 0.98;
            o.emissive = (0.35 + 0.65 * vague) * boostNuit;
          } else if (phaseCourse === 'dernier-tour') {
            let phase = (temps * 1.0 - m * 0.09) % 1;
            if (phase < 0) phase += 1;
            const vague = phase < 0.5 ? phase * 2 : 2 - phase * 2;
            o.color[0] = 0.96;
            o.color[1] = 0.72;
            o.color[2] = 0.08;
            o.emissive = (0.35 + 0.75 * vague) * boostNuit;
          } else {
            let phase = (temps * 0.45 - m * 0.075) % 1;
            if (phase < 0) phase += 1;
            const vague = phase < 0.5 ? phase * 2 : 2 - phase * 2;
            o.color[0] = 0.08;
            o.color[1] = 0.86;
            o.color[2] = 0.28;
            o.emissive = (0.35 + 0.55 * vague) * boostNuit;
          }

          if (sortie) sortie.push(o);
        }
      }
    }
  }

  function mettreAJour(etat, t, contexte, sortie) {
    animer(etat, t, contexte, sortie);
  }

  function objets(etat) {
    return etat && etat.objets ? etat.objets : [];
  }

  B.signalisationCourse = { creer, animer, mettreAJour, objets };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.signalisationCourse;
