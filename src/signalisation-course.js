/* BITUME — Panneaux LED modernes de virage à flèches défilantes (>>> / <<<) & bandeaux LED portiques.
   Zéro allocation par image ; émission scalaire compatible FRender. */
(function (B) {
  'use strict';

  const LED_COUNT = 12;
  const CHEVRONS_PAR_PANNEAU = 3;
  const RAYON_PANNEAUX_2 = 280 * 280;

  function creer(circuit, decor, options) {
    if (!options) options = {};
    const chevrons = [];
    const panneaux = [];
    const bandeaux = [];
    const objets = [];
    if (!circuit || !circuit.n) return { chevrons, panneaux, bandeaux, objets };

    const lim = B.decor && B.decor.limites ? B.decor.limites(circuit) : null;
    const w = (circuit.largeur || 12) / 2;
    const solFn = decor && typeof decor.sol === 'function' ? decor.sol : null;

    // 1. Panneaux LED noirs sur double poteau ancré au sol avec 3 flèches chevron défilantes (> > > ou < < <)
    const maxPanneaux = options.maxChevrons || 48;
    const pasScan = Math.max(2, Math.round(28 / (circuit.pas || 2)));
    let dernierX = -1e9, dernierZ = -1e9;
    for (let i = 12; i < circuit.n - 12 && panneaux.length < maxPanneaux; i += pasScan) {
      const k = circuit.courbure[i];
      if (Math.abs(k) < 1 / 72) continue;
      if (B.circuit && B.circuit.dansCouvert && B.circuit.dansCouvert(circuit, i * circuit.pas, 14)) continue;
      // Éviter les ponts
      if (circuit.ponts && circuit.ponts.some(p => i * circuit.pas >= p.debut - 8 && i * circuit.pas <= p.fin + 8)) continue;
      const ext = k > 0 ? -1 : 1; // côté extérieur du virage
      const cap = circuit.cap[i];
      const lat = (lim ? (ext < 0 ? lim.G[i] : lim.D[i]) : w + 3.2) + 0.95;
      const rx = -Math.sin(cap), rz = Math.cos(cap);
      const tx = Math.cos(cap), tz = Math.sin(cap);
      const x = circuit.x[i] + rx * ext * lat;
      const z = circuit.z[i] + rz * ext * lat;
      if ((x - dernierX) ** 2 + (z - dernierZ) ** 2 < 26 * 26) continue;
      // S'assurer que le panneau n'empiète jamais sur une autre branche d'épingle
      let tropPresRoute = false;
      for (let j = Math.max(0, i - 140); j < Math.min(circuit.n, i + 140); j += 3) {
        if (Math.abs(j - i) < 10) continue;
        if ((circuit.x[j] - x) ** 2 + (circuit.z[j] - z) ** 2 < (w + 3.0) ** 2) { tropPresRoute = true; break; }
      }
      if (tropPresRoute) continue;

      const yRoute = circuit.y[i] - Math.sin(circuit.devers[i] || 0) * ext * w;
      const ySol = solFn ? Math.min(yRoute + 0.3, Math.max(yRoute - 2.2, solFn(x, z))) : yRoute - 0.15;
      // Panneau orienté face au pilote qui approche (normale face = -tangent légèrement tourné vers la piste)
      const yaw = -cap + ext * 0.24;
      const cy = Math.cos(-yaw), sy = Math.sin(-yaw);
      // Axes du panneau en monde : avant (normal face vers le pilote) = (-cy, 0, -sy), droite panneau = (-sy, 0, cy)
      const fx = -cy, fz = -sy;
      const bx = -sy, bz = cy;
      const yCentre = ySol + 1.48;
      const largeurP = 2.30, hauteurP = 0.72;

      // Twin grounded dark steel posts
      const pObjs = [];
      for (const side of [-0.78, 0.78]) {
        const px = x + bx * side, pz = z + bz * side;
        const poteau = {
          shape: 'cylinder',
          p: [px, ySol + 0.65, pz],
          s: [0.085, 1.55, 0.085],
          r: [0, 0, 0],
          mat: 0,
          color: [0.16, 0.18, 0.21],
          emissive: 0
        };
        objets.push(poteau);
        pObjs.push(poteau);
      }

      // Boîtier LED noir mat moderne avec léger cadre métallique
      const boitier = {
        shape: 'box',
        p: [x, yCentre, z],
        s: [0.12, hauteurP, largeurP],
        r: [0, yaw, 0],
        mat: 1,
        color: [0.045, 0.052, 0.068],
        emissive: 0
      };
      objets.push(boitier);
      pObjs.push(boitier);

      // 3 flèches chevron fines sur la face avant du panneau LED (sens du virage : k > 0 = droite, k < 0 = gauche)
      const dirFleche = k > 0 ? 1 : -1;
      const fleches = [];
      for (let a = 0; a < CHEVRONS_PAR_PANNEAU; a++) {
        const decZ = (a - 1) * 0.66; // -0.66, 0, +0.66 le long du panneau
        const ax = x + fx * 0.075 + bx * decZ;
        const az = z + fz * 0.075 + bz * decZ;
        // Deux barres obliques formant un chevron net > ou <
        const barreHaut = {
          shape: 'box',
          p: [ax, yCentre + 0.105, az],
          s: [0.032, 0.082, 0.36],
          r: [dirFleche * 0.62, yaw, 0],
          mat: 16,
          color: [1.0, 0.54, 0.05],
          emissive: 0.15
        };
        const barreBas = {
          shape: 'box',
          p: [ax, yCentre - 0.105, az],
          s: [0.032, 0.082, 0.36],
          r: [-dirFleche * 0.62, yaw, 0],
          mat: 16,
          color: [1.0, 0.54, 0.05],
          emissive: 0.15
        };
        objets.push(barreHaut, barreBas);
        pObjs.push(barreHaut, barreBas);
        // Ordre de défilement dans le sens de la flèche
        const ordre = dirFleche > 0 ? a : (CHEVRONS_PAR_PANNEAU - 1 - a);
        fleches.push({ ordre, haut: barreHaut, bas: barreBas });
        chevrons.push({ x: ax, y: yCentre, z: az, ordre, haut: barreHaut, bas: barreBas });
      }

      panneaux.push({ x, y: yCentre, z, fleches, objets: pObjs });
      dernierX = x; dernierZ = z;
    }

    // 2. Bandeaux LED fins sur les portiques départ (s = 0) et arrivée (parcours ouvert)
    const portiquesS = [0];
    if (circuit.ouvert && Number.isFinite(circuit.arrivee) && circuit.arrivee > 100) {
      portiquesS.push(circuit.arrivee);
    }
    for (let pIdx = 0; pIdx < portiquesS.length; pIdx++) {
      const s = portiquesS[pIdx];
      const idx = Math.max(0, Math.min(circuit.n - 1, Math.round(s / (circuit.pas || 2))));
      const cap = circuit.cap[idx];
      const cx = circuit.x[idx], cy = circuit.y[idx], cz = circuit.z[idx];
      const rx = -Math.sin(cap), rz = Math.cos(cap);
      const tx = Math.cos(cap), tz = Math.sin(cap);
      const largeurBandeau = Math.min(13.2, (circuit.largeur || 12) + 0.8);
      for (const face of [-1, 1]) {
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

    return { chevrons, panneaux, bandeaux, objets };
  }

  function animer(etat, t, contexte, sortie) {
    if (!etat) return;
    const camPos = contexte && (contexte.cameraPos || contexte.camPos);
    const phaseCourse = (contexte && contexte.phase) || 'vert';
    const feuxAllumes = (contexte && (contexte.feux ?? contexte.feuxAllumes)) || 0;
    const pluie = (contexte && contexte.pluie) || 0;
    const nuit = (contexte && contexte.nuit) || 0;
    const temps = Number.isFinite(t) ? t : 0;
    const boostNuit = 1 + 0.35 * nuit;

    // 1. Défilement fluide moderne des 3 flèches LED (> > >) sur chaque panneau de virage
    const panneaux = etat.panneaux || [];
    const curseur = (temps * 3.8) % CHEVRONS_PAR_PANNEAU;
    for (let i = 0; i < panneaux.length; i++) {
      const p = panneaux[i];
      let actif = true;
      if (camPos) {
        const dx = p.x - camPos[0], dz = p.z - camPos[2];
        actif = dx * dx + dz * dz <= RAYON_PANNEAUX_2;
      }
      if (!actif) continue;
      for (let f = 0; f < p.fleches.length; f++) {
        const fl = p.fleches[f];
        // Distance circulaire entre la vague lumineuse et cette flèche (défilement fluide, pas clignotement sec)
        let dist = Math.abs(curseur - fl.ordre);
        if (dist > CHEVRONS_PAR_PANNEAU * 0.5) dist = CHEVRONS_PAR_PANNEAU - dist;
        const onde = Math.exp(-dist * dist * 2.8);
        const em = (0.10 + 1.25 * onde) * boostNuit;
        fl.haut.emissive = em; fl.bas.emissive = em;
        const r = 0.88 + 0.12 * onde, g = 0.36 + 0.36 * onde, b = 0.02 + 0.06 * onde;
        fl.haut.color[0] = r; fl.haut.color[1] = g; fl.haut.color[2] = b;
        fl.bas.color[0] = r; fl.bas.color[1] = g; fl.bas.color[2] = b;
      }
      if (sortie && p.objets) {
        for (let k = 0; k < p.objets.length; k++) sortie.push(p.objets[k]);
      }
    }

    // 2. Bandeau LED du portique synchronisé sur la phase de course
    const bandeaux = etat.bandeaux || [];
    for (let b = 0; b < bandeaux.length; b++) {
      const mods = bandeaux[b].modules;
      for (let m = 0; m < mods.length; m++) {
        const o = mods[m];
        if (phaseCourse === 'depart' || phaseCourse === 'feux') {
          const allume = m < Math.round(feuxAllumes * LED_COUNT / 5);
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
          const vague = 0.5 + 0.5 * Math.sin(temps * 4.2 - m * 0.5);
          o.color[0] = 0.12; o.color[1] = 0.62; o.color[2] = 0.98;
          o.emissive = (0.35 + 0.65 * vague) * boostNuit;
        } else if (phaseCourse === 'dernier-tour') {
          const vague = 0.5 + 0.5 * Math.sin(temps * 6 - m * 0.55);
          o.color[0] = 0.96; o.color[1] = 0.72; o.color[2] = 0.08;
          o.emissive = (0.35 + 0.75 * vague) * boostNuit;
        } else {
          const vague = 0.5 + 0.5 * Math.sin(temps * 3.0 - m * 0.45);
          o.color[0] = 0.08; o.color[1] = 0.86; o.color[2] = 0.28;
          o.emissive = (0.35 + 0.55 * vague) * boostNuit;
        }
        if (sortie) sortie.push(o);
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
