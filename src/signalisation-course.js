/* BITUME — Panneaux directionnels de virages animés & bandeaux LED procéduraux de course.
   Zéro allocation par image ; émission scalaire compatible FRender. */
(function (B) {
  'use strict';

  const LED_COUNT = 12;
  const RAYON_CHEVRONS_2 = 260 * 260;

  function creer(circuit, decor, options) {
    if (!options) options = {};
    const chevrons = [];
    const bandeaux = [];
    const objets = [];
    if (!circuit || !circuit.n) return { chevrons, bandeaux, objets };

    const lim = B.decor && B.decor.limites ? B.decor.limites(circuit) : null;
    const w = (circuit.largeur || 12) / 2;

    // 1. Chevrons LED séquentiels à l'extérieur des virages marqués (|k| > 1/92)
    const maxChevrons = options.maxChevrons || 60;
    const pasScan = Math.max(2, Math.round(14 / (circuit.pas || 2)));
    let phaseCompteur = 0;
    for (let i = 10; i < circuit.n - 10 && chevrons.length < maxChevrons; i += pasScan) {
      const k = circuit.courbure[i];
      if (Math.abs(k) < 1 / 92) continue;
      if (B.circuit && B.circuit.dansCouvert && B.circuit.dansCouvert(circuit, i * circuit.pas, 8)) continue;
      const ext = k > 0 ? -1 : 1; // extérieur du virage
      const cap = circuit.cap[i];
      const lat = (lim ? (ext < 0 ? lim.G[i] : lim.D[i]) : w + 3.2) + 0.55;
      const x = circuit.x[i] - Math.sin(cap) * ext * lat;
      const z = circuit.z[i] + Math.cos(cap) * ext * lat;
      const y = circuit.y[i] - Math.sin(circuit.devers[i] || 0) * ext * w + 1.55;
      const obj = {
        shape: 'box',
        p: [x, y, z],
        s: [0.14, 0.56, 0.92],
        r: [0, -cap, 0],
        mat: 16,
        color: [0.98, 0.65, 0.08],
        emissive: 0
      };
      chevrons.push({ x, y, z, phase: phaseCompteur++ % 3, objet: obj });
      objets.push(obj);
    }

    // 2. Bandeaux LED sur le portique départ (s = 0) et arrivée (si circuit ouvert)
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
          const u = (m / (LED_COUNT - 1) - 0.5) * largeurBandeau;
          const x = cx + rx * u + tx * face * 0.58;
          const z = cz + rz * u + tz * face * 0.58;
          const y = cy + 5.75;
          const obj = {
            shape: 'box',
            p: [x, y, z],
            s: [0.12, 0.34, largeurBandeau / LED_COUNT * 0.82],
            r: [0, -cap, 0],
            mat: 16,
            color: [0.1, 0.1, 0.12],
            emissive: 0
          };
          modules.push(obj);
          objets.push(obj);
        }
        bandeaux.push({ x: cx, y: cy + 5.75, z: cz, modules });
      }
    }

    return { chevrons, bandeaux, objets };
  }

  function setCol(obj, r, g, b, em) {
    obj.color[0] = r; obj.color[1] = g; obj.color[2] = b; obj.emissive = em;
  }

  function mettreAJour(etat, t, contexte, sortie) {
    if (!etat || !contexte || !sortie) return;
    const qualite = contexte.qualite || 'medium';
    const phase = contexte.phase || 'vert';
    const feux = contexte.feux | 0;
    const pluie = contexte.pluie || 0;
    const nuit = contexte.nuit || 0;
    const cam = contexte.cameraPos;
    const cx = cam ? cam[0] : 0, cz = cam ? cam[2] : 0;

    // 1. Chevrons séquentiels (skippés en low pour économiser le GPU Xbox/modeste)
    if (qualite !== 'low') {
      const cycle = Math.floor(t * 3.5) % 3;
      const boost = 1.1 + nuit * 1.1 + pluie * 0.45;
      for (let i = 0; i < etat.chevrons.length; i++) {
        const ch = etat.chevrons[i];
        const dx = ch.x - cx, dz = ch.z - cz;
        if (cam && dx * dx + dz * dz > RAYON_CHEVRONS_2) continue;
        const d = (ch.phase - cycle + 3) % 3;
        if (d === 0) setCol(ch.objet, 1.0, 0.62, 0.06, 1.8 * boost);
        else if (d === 1) setCol(ch.objet, 0.96, 0.95, 0.90, 0.85 * boost);
        else setCol(ch.objet, 0.14, 0.12, 0.10, 0);
        sortie.push(ch.objet);
      }
    }

    // 2. Bandeaux LED des portiques
    const blink = (Math.floor(t * 4) & 1) === 0;
    const vague = Math.floor(t * 7) % LED_COUNT;
    const pulse = 0.55 + 0.45 * Math.sin(t * 4.5);
    for (let b = 0; b < etat.bandeaux.length; b++) {
      const ban = etat.bandeaux[b];
      if (cam) {
        const dx = ban.x - cx, dz = ban.z - cz;
        if (dx * dx + dz * dz > 500 * 500) continue;
      }
      const mods = ban.modules;
      for (let m = 0; m < mods.length; m++) {
        const o = mods[m];
        if (phase === 'depart') {
          const allume = Math.floor(m * 5 / LED_COUNT) < feux;
          if (allume) setCol(o, 0.98, 0.08, 0.06, 2.4);
          else setCol(o, 0.10, 0.04, 0.04, 0);
        } else if (phase === 'jaune') {
          const on = ((m & 1) === 0) === blink;
          if (on) setCol(o, 0.98, 0.78, 0.05, 2.2);
          else setCol(o, 0.12, 0.10, 0.04, 0);
        } else if (phase === 'pluie') {
          setCol(o, 0.18, 0.72, 0.98, 1.6 * pulse);
        } else if (phase === 'dernier-tour') {
          const on = ((m & 1) === 0) === blink;
          if (on) setCol(o, 0.98, 0.98, 0.96, 2.0);
          else setCol(o, 0.92, 0.12, 0.08, 1.8);
        } else if (phase === 'damier') {
          const on = ((m + (blink ? 1 : 0)) & 1) === 0;
          if (on) setCol(o, 0.98, 0.98, 0.96, 2.0);
          else setCol(o, 0.04, 0.04, 0.05, 0);
        } else {
          // 'vert' : onde verte lumineuse
          const dist = Math.min(Math.abs(m - vague), LED_COUNT - Math.abs(m - vague));
          const em = dist <= 2 ? 2.1 - dist * 0.45 : 0.7;
          setCol(o, 0.10, 0.95, 0.25, em);
        }
        sortie.push(o);
      }
    }
  }

  B.signalisationCourse = { creer, mettreAJour, LED_COUNT };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.signalisationCourse;
