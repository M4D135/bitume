/* BITUME — Stands F1 complets : portiques lumineux PIT IN / PIT OUT, panneaux d'approche,
   box peint + potence pneumatique, chicane de sortie des stands (vibreurs + quilles souples)
   et équipe de 12 mécaniciens F1 animés (4 pistolets pneumatiques + étincelles, 4 porteurs de roues,
   2 crics avant/arrière, 1 ravitailleur essence + tuyau articulé, 1 chef sucette STOP → GO !).
   Zéro allocation par image ; zéro Math.random(). */
(function (B) {
  'use strict';

  const PI = Math.PI;
  const RAYON_ACTIF_2 = 340 * 340;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (lo, hi, x) => {
    const t = clamp((x - lo) / (hi - lo), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function echantillonner(c, s) {
    const L = c.longueur || (c.n * c.pas);
    const sMod = c.ouvert ? clamp(s, 0, L) : ((s % L) + L) % L;
    const e = B.circuit && B.circuit.echantillon ? B.circuit.echantillon(c, sMod) : null;
    if (e) {
      return {
        x: e.x, y: e.y, z: e.z, cap: e.cap,
        tx: Math.cos(e.cap), tz: Math.sin(e.cap),
        rx: -Math.sin(e.cap), rz: Math.cos(e.cap),
        devers: e.devers || 0
      };
    }
    const idx = Math.max(0, Math.min(c.n - 1, Math.round(sMod / (c.pas || 2))));
    const a = c.cap[idx] || 0;
    return {
      x: c.x[idx], y: c.y[idx], z: c.z[idx], cap: a,
      tx: Math.cos(a), tz: Math.sin(a),
      rx: -Math.sin(a), rz: Math.cos(a),
      devers: c.devers ? (c.devers[idx] || 0) : 0
    };
  }

  function pointVoie(f, d, dy, w) {
    const dd = clamp(d, -w, w);
    const yRoute = f.y - dd * Math.sin(f.devers || 0);
    return [f.x + f.rx * d, yRoute + dy, f.z + f.rz * d];
  }

  // ---------------------------------------------------------------- décors statiques des stands F1 (opt-in organique)
  function construireDecors(c, terrain, ajouter) {
    if (!c || !c.stands || !ajouter) return null;
    const S = c.stands;
    const w = (c.largeur || 12) * 0.5;
    const sBox = (S.garage0 + S.garage1) * 0.5;
    const dVoie = S.d; // ~4.4 m (voie de 3,2 m entre d = 2.8 et d = 6.0)
    const dBordG = dVoie - S.demi; // ~2.8 m (séparation piste / voie des stands)
    const objets = [];

    function push(o, loin, refX, refZ) {
      objets.push(o);
      ajouter([o], loin ? [o] : [], refX !== undefined ? refX : o.p[0], refZ !== undefined ? refZ : o.p[2]);
    }

    // 1. Panneaux d'approche F1 côté droit hors piste (100 m, 50 m, PIT IN 40 km/h)
    const panneaux = [
      { ds: -46, haut: [0.95, 0.78, 0.08], bas: [0.08, 0.09, 0.11], bandes: 3 },
      { ds: -24, haut: [0.96, 0.52, 0.06], bas: [0.08, 0.09, 0.11], bandes: 2 },
      { ds: -5, haut: [0.08, 0.84, 0.28], bas: [0.92, 0.14, 0.10], bandes: 1 }
    ];
    for (let k = 0; k < panneaux.length; k++) {
      const cfg = panneaux[k];
      const f = echantillonner(c, S.debut + cfg.ds);
      const dP = w + 2.55;
      const yaw = -f.cap + 0.16;
      const pBase = pointVoie(f, dP, 0, w);
      // Double poteau métallique
      for (const off of [-0.62, 0.62]) {
        const px = pBase[0] + f.rx * off, pz = pBase[2] + f.rz * off;
        push({ shape: 'box', p: [px, pBase[1] + 0.95, pz], s: [0.09, 1.9, 0.09], r: [0, yaw, 0], mat: 0, color: [0.22, 0.24, 0.27] }, false, pBase[0], pBase[2]);
      }
      // Cadre du panneau
      push({ shape: 'box', p: [pBase[0], pBase[1] + 1.85, pBase[2]], s: [0.14, 1.15, 1.85], r: [0, yaw, 0], mat: 1, color: cfg.bas }, true, pBase[0], pBase[2]);
      // Face réfléchissante lumineuse (face au pilote)
      push({ shape: 'box', p: [pBase[0] - f.tx * 0.08, pBase[1] + 1.98, pBase[2] - f.tz * 0.08], s: [0.04, 0.56, 1.65], r: [0, yaw, 0], mat: 16, color: cfg.haut, emissive: 0.45 }, true, pBase[0], pBase[2]);
      // Barres de décompte blanches (3 / 2 / 1) ou disque limite 40 km/h
      if (cfg.bandes > 1) {
        for (let b = 0; b < cfg.bandes; b++) {
          const zB = (b - (cfg.bandes - 1) * 0.5) * 0.42;
          push({ shape: 'box', p: [pBase[0] - f.tx * 0.09 + f.rx * zB, pBase[1] + 1.48, pBase[2] - f.tz * 0.09 + f.rz * zB], s: [0.04, 0.24, 0.22], r: [0, yaw, 0], mat: 16, color: [0.96, 0.96, 0.94], emissive: 0.3 }, false, pBase[0], pBase[2]);
        }
      } else {
        // Disque rouge de limitation 40 km/h à l'entrée des stands (axe +Y du cylindre face au pilote : Rx=PI/2, Ry=atan2(tx,tz))
        const ryFace = Math.atan2(f.tx, f.tz);
        push({ shape: 'cylinder', p: [pBase[0] - f.tx * 0.10, pBase[1] + 1.45, pBase[2] - f.tz * 0.10], s: [0.52, 0.05, 0.52], r: [PI * 0.5, ryFace, 0], mat: 16, color: [0.94, 0.12, 0.10], emissive: 0.55 }, false, pBase[0], pBase[2]);
        push({ shape: 'cylinder', p: [pBase[0] - f.tx * 0.12, pBase[1] + 1.45, pBase[2] - f.tz * 0.12], s: [0.34, 0.05, 0.34], r: [PI * 0.5, ryFace, 0], mat: 16, color: [0.98, 0.98, 0.96], emissive: 0.45 }, false, pBase[0], pBase[2]);
      }
    }

    // 2. Portiques en porte-à-faux PIT IN & PIT OUT (ancrés HORS PISTE à d = w + 3.0 m, ZERO pilier sur la trajectoire !)
    function portiquePotence(sPos, couleurBande, estEntree) {
      const f = echantillonner(c, sPos);
      const rot = [0, -f.cap, 0];
      const dMat = w + 3.0;
      const pMat = pointVoie(f, dMat, 0, w);
      const pPoutre = pointVoie(f, (dBordG + dMat) * 0.5 + 0.1, 4.45, w);
      const portee = (dMat - dBordG) + 0.6;
      const pPanneau = pointVoie(f, dVoie + 0.1, 4.35, w);
      // Mât vertical massif hors piste + semelle béton
      const mat = { shape: 'box', p: [pMat[0], pMat[1] + 2.45, pMat[2]], s: [0.55, 4.9, 0.55], r: rot, mat: 0, color: [0.18, 0.20, 0.24] };
      push(mat, true, pMat[0], pMat[2]);
      push({ shape: 'box', p: [pMat[0], pMat[1] + 0.28, pMat[2]], s: [0.95, 0.56, 0.95], r: rot, mat: 22, color: [0.68, 0.68, 0.66] }, false, pMat[0], pMat[2]);
      if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(mat, 'pilier', 2);
      // Jambe de force diagonale côté tablier
      push({ shape: 'box', p: [pMat[0] - f.rx * 0.65, pMat[1] + 3.85, pMat[2] - f.rz * 0.65], s: [0.24, 0.24, 1.8], r: [-0.65, -f.cap, 0], mat: 0, color: [0.24, 0.26, 0.30] }, false, pMat[0], pMat[2]);
      // Traverse porte-à-faux au-dessus de la voie des stands
      push({ shape: 'box', p: pPoutre, s: [0.42, 0.44, portee], r: rot, mat: 0, color: [0.14, 0.16, 0.20] }, true, pPoutre[0], pPoutre[2]);
      // Caisson lumineux PIT IN / PIT OUT centré exactement sur la voie des stands
      push({ shape: 'box', p: pPanneau, s: [0.52, 0.86, 3.65], r: rot, mat: 1, color: [0.06, 0.07, 0.09] }, true, pPanneau[0], pPanneau[2]);
      push({ shape: 'box', p: [pPanneau[0] - f.tx * 0.28, pPanneau[1] + 0.22, pPanneau[2] - f.tz * 0.28], s: [0.04, 0.26, 3.35], r: rot, mat: 16, color: couleurBande, emissive: 0.85 }, true, pPanneau[0], pPanneau[2]);
      // Barre de contraste blanche sous la bande principale
      push({ shape: 'box', p: [pPanneau[0] - f.tx * 0.28, pPanneau[1] - 0.24, pPanneau[2] - f.tz * 0.28], s: [0.04, 0.14, 3.10], r: rot, mat: 16, color: estEntree ? [0.98, 0.84, 0.12] : [0.92, 0.96, 1.0], emissive: 0.45 }, false, pPanneau[0], pPanneau[2]);
    }
    portiquePotence(S.debut + 2, [0.08, 0.90, 0.28], true);
    portiquePotence(S.fin - 2, [0.06, 0.78, 0.98], false);

    // La recette diélectrique 21 garde le pigment des lignes et prend le même film d'eau
    // que l'enrobé. Sur ces boîtes, la texture photographique du matériau 14 effaçait le marquage.
    const matPeinture = 21;
    // 3. Ligne blanche continue séparant piste et voie des stands + chevrons d'entrée jaunes peints au sol
    for (let s = S.debut - 10; s <= S.fin + 14; s += 8) {
      const f = echantillonner(c, s + 4);
      const pL = pointVoie(f, dBordG, 0.015, w);
      push({ shape: 'box', p: pL, s: [7.9, 0.024, 0.24], r: [0, -f.cap, 0], mat: matPeinture, color: [0.95, 0.95, 0.93] }, false, pL[0], pL[2]);
    }
    for (let s = S.debut + 6; s < S.debut + 28; s += 5.5) {
      const f = echantillonner(c, s);
      const pC = pointVoie(f, dVoie, 0.014, w);
      push({ shape: 'box', p: pC, s: [0.32, 0.022, 1.45], r: [0, -f.cap + 0.55, 0], mat: matPeinture, color: [0.94, 0.88, 0.16] }, false, pC[0], pC[2]);
      push({ shape: 'box', p: pC, s: [0.32, 0.022, 1.45], r: [0, -f.cap - 0.55, 0], mat: matPeinture, color: [0.94, 0.88, 0.16] }, false, pC[0], pC[2]);
    }

    // 4. Box F1 peint au sol + Potence pneumatique + Tour de ravitaillement essence + Piles de pneus + Mur de télémétrie
    {
      const fB = echantillonner(c, sBox);
      const rotB = [0, -fB.cap, 0];
      // Marquage jaune & rouge du Pit Box au sol (4 équerres + barre d'arrêt rouge)
      for (const sd of [-2.8, 2.8]) {
        const pM = pointVoie(fB, dVoie, 0.016, w);
        pM[0] += fB.tx * sd; pM[2] += fB.tz * sd;
        push({ shape: 'box', p: pM, s: [0.34, 0.024, 2.7], r: rotB, mat: matPeinture, color: sd > 0 ? [0.94, 0.12, 0.08] : [0.98, 0.82, 0.08] }, false, pM[0], pM[2]);
      }
      // Les côtés se terminent aux faces intérieures des barres à ±2,8 m :
      // les couleurs se touchent sans superposer deux faces horizontales aux coins.
      for (const lat of [-1.25, 1.25]) {
        const pS = pointVoie(fB, dVoie + lat, 0.016, w);
        push({ shape: 'box', p: pS, s: [2 * 2.8 - 0.34, 0.024, 0.26], r: rotB, mat: matPeinture, color: [0.98, 0.82, 0.08] }, false, pS[0], pS[2]);
      }
      // Potence pneumatique F1 en porte-à-faux (ancrée sur l'aire technique d = w + 2.3 m)
      const dPot = w + 2.35;
      for (const ds of [-3.4, 3.4]) {
        const fP = echantillonner(c, sBox + ds);
        const pP = pointVoie(fP, dPot, 0, w);
        push({ shape: 'box', p: [pP[0], pP[1] + 2.05, pP[2]], s: [0.28, 4.1, 0.28], r: [0, -fP.cap, 0], mat: 1, color: [0.86, 0.10, 0.08] }, true, pP[0], pP[2]);
      }
      // Poutre longitudinale + 2 bras transversaux portant les flexibles d'air comprimé
      const pLong = pointVoie(fB, dPot, 4.05, w);
      push({ shape: 'box', p: pLong, s: [7.4, 0.34, 0.34], r: rotB, mat: 1, color: [0.86, 0.10, 0.08] }, true, pLong[0], pLong[2]);
      for (const ds of [-2.2, 2.2]) {
        const fA = echantillonner(c, sBox + ds);
        const pArm = pointVoie(fA, (dVoie - 1.35 + dPot) * 0.5, 4.05, w);
        push({ shape: 'box', p: pArm, s: [0.24, 0.26, dPot - (dVoie - 1.35) + 0.3], r: [0, -fA.cap, 0], mat: 0, color: [0.16, 0.18, 0.22] }, true, pArm[0], pArm[2]);
        // Lampes LED blanches sous la potence (éclairent le pit stop de nuit !)
        const pLed = pointVoie(fA, dVoie, 3.88, w);
        push({ shape: 'box', p: pLed, s: [0.18, 0.08, 1.9], r: [0, -fA.cap, 0], mat: 5, color: [0.98, 0.98, 1.0], emissive: 1.45 }, false, pLed[0], pLed[2]);
        // Flexibles pneumatiques pendants sur les 4 roues (hors gabarit voiture, h = 2.65..3.95 m)
        for (const side of [-1.05, 1.05]) {
          const pH = pointVoie(fA, dVoie + side, 3.30, w);
          push({ shape: 'cylinder', p: pH, s: [0.06, 1.35, 0.06], r: [0, 0, 0], mat: 7, color: [0.94, 0.44, 0.06] }, false, pH[0], pH[2]);
        }
      }

      // Tour de ravitaillement essence (Fuel Rig F1) sur l'aire de stand (d = w + 2.75 m)
      const fFuel = echantillonner(c, sBox - 1.2);
      const pFuel = pointVoie(fFuel, w + 2.75, 0, w);
      push({ shape: 'box', p: [pFuel[0], pFuel[1] + 1.35, pFuel[2]], s: [0.92, 2.7, 0.92], r: [0, -fFuel.cap, 0], mat: 1, color: [0.86, 0.10, 0.08] }, true, pFuel[0], pFuel[2]);
      push({ shape: 'cylinder', p: [pFuel[0], pFuel[1] + 2.1, pFuel[2]], s: [0.68, 1.6, 0.68], r: [0, 0, 0], mat: 0, color: [0.80, 0.83, 0.86] }, true, pFuel[0], pFuel[2]);
      push({ shape: 'box', p: [pFuel[0] - fFuel.rx * 0.48, pFuel[1] + 1.55, pFuel[2] - fFuel.rz * 0.48], s: [0.58, 0.36, 0.06], r: [0, -fFuel.cap, 0], mat: 16, color: [0.10, 0.90, 0.36], emissive: 0.9 }, false, pFuel[0], pFuel[2]);

      // Piles de pneus F1 sous couvertures chauffantes (rouge tendres / jaune médiums / bleu pluie)
      const COUL_COUV = [[0.88, 0.12, 0.10], [0.96, 0.78, 0.08], [0.08, 0.56, 0.94]];
      for (const ds of [-5.8, 5.8]) {
        const fT = echantillonner(c, sBox + ds);
        for (let st = 0; st < 2; st++) {
          const pT = pointVoie(fT, w + 2.55 + st * 0.95, 0, w);
          for (let h = 0; h < 4; h++) {
            push({ shape: 'ring', p: [pT[0], pT[1] + 0.24 + h * 0.32, pT[2]], s: [0.76, 1.45, 0.76], r: [0, 0, 0], mat: 7, color: h === 3 ? COUL_COUV[(st + (ds > 0 ? 1 : 0)) % 3] : [0.08, 0.08, 0.09] }, false, pT[0], pT[2]);
          }
        }
      }

      // Poste d'ingénieurs de piste & écrans télémétrie le long du muret (d = w + 5.1 m)
      const pIng = pointVoie(fB, w + 5.1, 0, w);
      push({ shape: 'box', p: [pIng[0], pIng[1] + 1.1, pIng[2]], s: [5.4, 1.15, 1.05], r: rotB, mat: 1, color: [0.12, 0.13, 0.16] }, true, pIng[0], pIng[2]);
      push({ shape: 'box', p: [pIng[0], pIng[1] + 2.75, pIng[2]], s: [5.6, 0.14, 1.45], r: rotB, mat: 0, color: [0.84, 0.12, 0.09] }, true, pIng[0], pIng[2]);
      for (const dx of [-1.6, 0, 1.6]) {
        const sx = pIng[0] + fB.tx * dx - fB.rx * 0.42;
        const sz = pIng[2] + fB.tz * dx - fB.rz * 0.42;
        push({ shape: 'box', p: [sx, pIng[1] + 1.92, sz], s: [1.1, 0.62, 0.08], r: rotB, mat: 16, color: [0.08, 0.84, 0.96], emissive: 0.85 }, false, pIng[0], pIng[2]);
      }
    }

    // 5. CHICANE DE SORTIE DES STANDS (strictement dans la voie d ∈ [2.95, 6.15], 0 intrusion piste principale !)
    // Deux vibreurs alternés rouge/blanc + 6 quilles souples orange/blanc formant un S de sortie réaliste F1
    {
      const sCh1 = S.fin - 24; // vibreur gauche de la voie des stands (pousse légèrement à droite)
      const sCh2 = S.fin - 13; // vibreur droit de la voie des stands (ramène proprement vers la piste)
      const chicanes = [
        { s0: sCh1, d: dBordG + 0.34, nBlocs: 6 },
        { s0: sCh2, d: w - 0.24, nBlocs: 6 }
      ];
      for (let ci = 0; ci < chicanes.length; ci++) {
        const ch = chicanes[ci];
        for (let b = 0; b < ch.nBlocs; b++) {
          const f = echantillonner(c, ch.s0 + b * 1.25);
          const pV = pointVoie(f, ch.d, 0.045, w);
          const rouge = (b & 1) === 0;
          push({
            shape: 'bevel',
            p: pV,
            s: [1.22, 0.09, 0.56],
            r: [0, -f.cap, 0],
            mat: matPeinture,
            color: rouge ? [0.90, 0.10, 0.08] : [0.96, 0.96, 0.94]
          }, false, pV[0], pV[2]);
          // Quilles souples F1 orange fluo + bague blanche réfléchissante (visuelles sans bloquer une roue)
          if (b === 1 || b === 3 || b === 5) {
            const pQ = pointVoie(f, ch.d, 0.40, w);
            push({ shape: 'cylinder', p: pQ, s: [0.16, 0.78, 0.16], r: [0, 0, 0], mat: 16, color: [1.0, 0.42, 0.04], emissive: 0.45 }, false, pQ[0], pQ[2]);
            push({ shape: 'cylinder', p: [pQ[0], pQ[1] + 0.16, pQ[2]], s: [0.17, 0.16, 0.17], r: [0, 0, 0], mat: 16, color: [0.98, 0.98, 0.98], emissive: 0.55 }, false, pQ[0], pQ[2]);
          }
        }
      }
      // Flèches blanches de trajectoire de sortie S-chicane + ligne de réinsertion
      for (let k = 0; k < 5; k++) {
        const sA = S.fin - 26 + k * 5.2;
        const dA = dVoie + Math.sin((k / 4) * PI * 2) * 0.55;
        const f = echantillonner(c, sA);
        const pA = pointVoie(f, dA, 0.015, w);
        push({ shape: 'box', p: pA, s: [1.9, 0.022, 0.24], r: [0, -f.cap, 0], mat: matPeinture, color: [0.96, 0.96, 0.94] }, false, pA[0], pA[2]);
      }
    }

    return { objets, sBox };
  }

  // ---------------------------------------------------------------- équipe de 12 mécaniciens F1 & LEDs animés (0 alloc/frame)
  function creer(c, decor) {
    if (!c || !c.stands) return { actif: false, objets: [] };
    const S = c.stands;
    const w = (c.largeur || 12) * 0.5;
    const sBox = (S.garage0 + S.garage1) * 0.5;
    const fBox = echantillonner(c, sBox);
    const fIn = echantillonner(c, S.debut + 2);
    const fOut = echantillonner(c, S.fin - 2);
    const objets = [];

    const mk = o => { objets.push(o); return o; };

    // LEDs animées portique PIT IN (4 flèches vertes/ambre défilantes)
    const ledsIn = [];
    for (let k = 0; k < 4; k++) {
      const p = pointVoie(fIn, S.d - 1.15 + k * 0.76, 4.18, w);
      ledsIn.push(mk({
        shape: 'box',
        p: [p[0] - fIn.tx * 0.28, p[1], p[2] - fIn.tz * 0.28],
        s: [0.05, 0.22, 0.42],
        r: [0, -fIn.cap, 0],
        mat: 16,
        color: [0.10, 0.96, 0.34],
        emissive: 1.6
      }));
    }

    // LEDs animées portique PIT OUT (3 feux de sortie vert/bleu)
    const ledsOut = [];
    for (let k = 0; k < 3; k++) {
      const p = pointVoie(fOut, S.d - 0.85 + k * 0.85, 4.18, w);
      ledsOut.push(mk({
        shape: 'sphere',
        p: [p[0] - fOut.tx * 0.28, p[1], p[2] - fOut.tz * 0.28],
        s: [0.24, 0.24, 0.24],
        r: [0, 0, 0],
        mat: 16,
        color: [0.08, 0.84, 1.0],
        emissive: 1.5
      }));
    }

    // Bandeau lumineux d'état sous la potence du Pit Box (veille blanc → entrée ambre → service rouge → GO vert)
    const ledsBox = [];
    for (let k = 0; k < 3; k++) {
      const fL = echantillonner(c, sBox + (k - 1) * 1.7);
      const p = pointVoie(fL, S.d, 3.84, w);
      ledsBox.push(mk({
        shape: 'box',
        p,
        s: [1.35, 0.14, 0.32],
        r: [0, -fL.cap, 0],
        mat: 16,
        color: [0.95, 0.95, 0.95],
        emissive: 1.2
      }));
    }

    // 12 Mécaniciens F1 articulés :
    // 0..3 : 4 pistolets pneumatiques (FL, FR, RL, RR)
    // 4..7 : 4 porteurs de roues F1 (FL, FR, RL, RR)
    // 8..9 : 2 crics avant & arrière
    // 10   : 1 ravitailleur essence + tuyau flexible 3 segments
    // 11   : 1 chef de stand « sucette » (Lollipop Man)
    const ROLES = [
      { role: 'gunner', coin: 0, dxCar: 1.55, dzCar: -1.48, dxAtt: -2.2, dzAtt: 2.35, casque: [0.96, 0.96, 0.96] },  // FL
      { role: 'gunner', coin: 1, dxCar: 1.55, dzCar: 1.48,  dxAtt: -1.3, dzAtt: 2.35, casque: [0.96, 0.96, 0.96] },  // FR
      { role: 'gunner', coin: 2, dxCar: -1.48, dzCar: -1.52, dxAtt: -3.8, dzAtt: 2.35, casque: [0.96, 0.96, 0.96] }, // RL
      { role: 'gunner', coin: 3, dxCar: -1.48, dzCar: 1.52,  dxAtt: -2.9, dzAtt: 2.35, casque: [0.96, 0.96, 0.96] }, // RR
      { role: 'pneu',   coin: 0, dxCar: 2.15, dzCar: -1.95, dxAtt: 0.4,  dzAtt: 2.65, casque: [0.98, 0.80, 0.10] },  // FL tire
      { role: 'pneu',   coin: 1, dxCar: 2.15, dzCar: 1.95,  dxAtt: 1.4,  dzAtt: 2.65, casque: [0.98, 0.80, 0.10] },  // FR tire
      { role: 'pneu',   coin: 2, dxCar: -2.15, dzCar: -2.00, dxAtt: -0.6, dzAtt: 2.65, casque: [0.98, 0.80, 0.10] }, // RL tire
      { role: 'pneu',   coin: 3, dxCar: -2.15, dzCar: 2.00,  dxAtt: 2.4,  dzAtt: 2.65, casque: [0.98, 0.80, 0.10] }, // RR tire
      { role: 'cric',   coin: 0, dxCar: 2.85, dzCar: 0.0,   dxAtt: 3.4,  dzAtt: 2.35, casque: [0.12, 0.14, 0.18] },  // Front jack
      { role: 'cric',   coin: 1, dxCar: -2.85, dzCar: 0.0,  dxAtt: -4.6, dzAtt: 2.35, casque: [0.12, 0.14, 0.18] },  // Rear jack
      { role: 'essence',coin: 0, dxCar: -0.35, dzCar: 1.75, dxAtt: -1.2, dzAtt: 3.45, casque: [0.96, 0.46, 0.08] },  // Refueler
      { role: 'sucette',coin: 0, dxCar: 3.75, dzCar: 0.18,  dxAtt: 4.3,  dzAtt: 2.25, casque: [0.96, 0.96, 0.96] }   // Lollipop man
    ];

    const mecs = ROLES.map((cfg, idx) => {
      const jambes = mk({ shape: 'box', p: [0, 0, 0], s: [0.28, 0.78, 0.38], r: [0, 0, 0], mat: 7, color: [0.14, 0.15, 0.18] });
      const torse = mk({ shape: 'box', p: [0, 0, 0], s: [0.30, 0.62, 0.44], r: [0, 0, 0], mat: 1, color: [0.88, 0.09, 0.07] });
      const bande = mk({ shape: 'box', p: [0, 0, 0], s: [0.32, 0.12, 0.45], r: [0, 0, 0], mat: 16, color: [0.96, 0.96, 0.96], emissive: 0.12 });
      const casque = mk({ shape: 'sphere', p: [0, 0, 0], s: [0.30, 0.32, 0.30], r: [0, 0, 0], mat: 1, color: cfg.casque.slice() });
      const visiere = mk({ shape: 'box', p: [0, 0, 0], s: [0.18, 0.09, 0.24], r: [0, 0, 0], mat: 7, color: [0.05, 0.06, 0.08] });
      const brasG = mk({ shape: 'box', p: [0, 0, 0], s: [0.12, 0.52, 0.12], r: [0, 0, 0], mat: 1, color: [0.86, 0.10, 0.08] });
      const brasD = mk({ shape: 'box', p: [0, 0, 0], s: [0.12, 0.52, 0.12], r: [0, 0, 0], mat: 1, color: [0.86, 0.10, 0.08] });
      const m = { cfg, idx, jambes, torse, bande, casque, visiere, brasG, brasD };

      if (cfg.role === 'gunner') {
        m.pistolet = mk({ shape: 'box', p: [0, 0, 0], s: [0.36, 0.16, 0.12], r: [0, 0, 0], mat: 0, color: [0.22, 0.24, 0.28] });
        m.etincelle = mk({ shape: 'sphere', p: [0, 0, 0], s: [0.001, 0.001, 0.001], r: [0, 0, 0], mat: 16, color: [1.0, 0.76, 0.18], emissive: 2.6 });
      } else if (cfg.role === 'pneu') {
        m.roue = mk({ shape: 'ring', p: [0, 0, 0], s: [0.64, 1.25, 0.64], r: [0, 0, 0], mat: 7, color: [0.07, 0.07, 0.08] });
        m.flanc = mk({ shape: 'ring', p: [0, 0, 0], s: [0.48, 1.32, 0.48], r: [0, 0, 0], mat: 16, color: [0.94, 0.14, 0.10], emissive: 0.35 });
      } else if (cfg.role === 'cric') {
        m.manche = mk({ shape: 'cylinder', p: [0, 0, 0], s: [0.06, 1.45, 0.06], r: [0, 0, 0], mat: 0, color: [0.82, 0.84, 0.88] });
        m.patin = mk({ shape: 'box', p: [0, 0, 0], s: [0.52, 0.12, 0.42], r: [0, 0, 0], mat: 1, color: [0.92, 0.14, 0.08] });
      } else if (cfg.role === 'essence') {
        m.buse = mk({ shape: 'cylinder', p: [0, 0, 0], s: [0.13, 0.56, 0.13], r: [0, 0, 0], mat: 0, color: [0.84, 0.86, 0.90] });
        m.tuyau = [
          mk({ shape: 'cylinder', p: [0, 0, 0], s: [0.11, 1.0, 0.11], r: [0, 0, 0], mat: 7, color: [0.10, 0.11, 0.13] }),
          mk({ shape: 'cylinder', p: [0, 0, 0], s: [0.11, 1.0, 0.11], r: [0, 0, 0], mat: 7, color: [0.10, 0.11, 0.13] }),
          mk({ shape: 'cylinder', p: [0, 0, 0], s: [0.11, 1.0, 0.11], r: [0, 0, 0], mat: 7, color: [0.10, 0.11, 0.13] })
        ];
        m.voyant = mk({ shape: 'sphere', p: [0, 0, 0], s: [0.16, 0.16, 0.16], r: [0, 0, 0], mat: 16, color: [0.98, 0.68, 0.08], emissive: 1.5 });
      } else if (cfg.role === 'sucette') {
        m.perche = mk({ shape: 'cylinder', p: [0, 0, 0], s: [0.055, 2.05, 0.055], r: [0, 0, 0], mat: 0, color: [0.86, 0.88, 0.90] });
        m.disque = mk({ shape: 'cylinder', p: [0, 0, 0], s: [0.76, 0.08, 0.76], r: [0, 0, 0], mat: 16, color: [0.96, 0.10, 0.08], emissive: 2.2 });
        m.cadre = mk({ shape: 'box', p: [0, 0, 0], s: [0.095, 0.14, 0.56], r: [0, 0, 0], mat: 16, color: [0.98, 0.98, 0.98], emissive: 1.8 });
      }
      return m;
    });

    return {
      actif: true,
      c, S, w, sBox, fBox,
      ledsIn, ledsOut, ledsBox,
      mecs, objets,
      blendActif: 0,
      dernierPhase: 'veille',
      dernierU: 0,
      dernierSCar: sBox,
      dernierDCar: S.d
    };
  }

  function poserSegment(obj, x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.max(0.05, Math.hypot(dx, dy, dz));
    obj.p[0] = (x0 + x1) * 0.5;
    obj.p[1] = (y0 + y1) * 0.5;
    obj.p[2] = (z0 + z1) * 0.5;
    obj.s[1] = len;
    obj.r[0] = Math.acos(clamp(dy / len, -1, 1));
    obj.r[1] = Math.atan2(dx, dz);
    obj.r[2] = 0;
  }

  function animer(etat, t, ctx, sortie) {
    if (!etat || !etat.actif) return;
    const { c, S, w, sBox, fBox, ledsIn, ledsOut, ledsBox, mecs, objets } = etat;
    const nuit = ctx && ctx.nuit ? ctx.nuit : 0;
    const boostNuit = 1 + 1.55 * nuit;

    // Culling distance caméra : coût nul quand on roule loin de la ligne droite des stands
    const camPos = ctx && ctx.cameraPos;
    if (camPos) {
      const dx = camPos[0] - fBox.x, dz = camPos[2] - fBox.z;
      if (dx * dx + dz * dz > RAYON_ACTIF_2) return;
    }

    // 1. Trouver la voiture active aux stands (priorité au joueur humain)
    const course = ctx && ctx.course;
    let cible = null;
    if (course && course.voitures) {
      for (let i = 0; i < course.voitures.length; i++) {
        const v = course.voitures[i];
        if (!v || !v.etat || !v.etat.stands) continue;
        if (v.joueur || v.humain) { cible = v; break; }
        if (!cible) cible = v;
      }
    }

    let phase = 'veille';
    let u = 0;
    let sCar = sBox;
    let dCar = S.d;
    let typePneus = 'slicks';

    if (cible && cible.etat && cible.etat.stands) {
      const st = cible.etat.stands;
      phase = st.phase || 'voie';
      typePneus = st.pneus || cible.etat.pneusProchainArret || cible.etat.pneus || 'slicks';
      if (phase === 'service') {
        u = clamp(st.duree > 0 ? st.t / st.duree : 0, 0, 1);
        sCar = Number.isFinite(st.sService) ? st.sService : cible.etat.s;
        dCar = Number.isFinite(st.dService) ? st.dService : cible.etat.d;
      } else if (phase === 'voie') {
        // Guider vers la position réelle ou le milieu du garage
        const eS = cible.etat.s;
        const dS = B.circuit && B.circuit.ecart ? B.circuit.ecart(c, sBox, eS) : (eS - sBox);
        sCar = clamp(sBox + clamp(dS, -18, 18) * 0.35, S.garage0 + 3, S.garage1 - 3);
        dCar = S.d;
      } else if (phase === 'sortie') {
        u = 1;
        sCar = etat.dernierSCar;
        dCar = etat.dernierDCar;
      }
      etat.dernierSCar = sCar;
      etat.dernierDCar = dCar;
    }
    etat.dernierPhase = phase;
    etat.dernierU = u;

    // 2. Animer LEDs PIT IN (chenillard d'entrée vert/ambre)
    const curseurIn = (t * 4.5) % 4;
    for (let k = 0; k < ledsIn.length; k++) {
      const o = ledsIn[k];
      let d = Math.abs(curseurIn - k);
      if (d > 2) d = 4 - d;
      const onde = Math.max(0, 1 - d * d * 1.8);
      if (phase === 'voie') {
        o.color[0] = 1.0; o.color[1] = 0.72 + 0.24 * onde; o.color[2] = 0.06;
      } else {
        o.color[0] = 0.08; o.color[1] = 0.84 + 0.16 * onde; o.color[2] = 0.28 + 0.25 * onde;
      }
      o.emissive = (0.55 + 1.85 * onde) * boostNuit;
    }

    // 3. Animer LEDs PIT OUT (feux de relâchement vert/bleu)
    const feuVert = phase === 'sortie' || (phase === 'service' && u >= 0.86);
    for (let k = 0; k < ledsOut.length; k++) {
      const o = ledsOut[k];
      const pulse = 0.5 + 0.5 * Math.sin(t * (feuVert ? 12 : 4.2) - k * 1.4);
      if (feuVert) {
        o.color[0] = 0.08; o.color[1] = 0.98; o.color[2] = 0.24;
        o.emissive = (1.3 + 1.6 * pulse) * boostNuit;
      } else {
        o.color[0] = 0.06; o.color[1] = 0.72; o.color[2] = 1.0;
        o.emissive = (0.55 + 1.25 * pulse) * boostNuit;
      }
    }

    // 4. Bandeau lumineux d'état sous la potence
    for (let k = 0; k < ledsBox.length; k++) {
      const o = ledsBox[k];
      if (phase === 'service' && u < 0.86) {
        const p = 0.5 + 0.5 * Math.sin(t * 14 + k);
        o.color[0] = 0.98; o.color[1] = 0.08; o.color[2] = 0.06;
        o.emissive = (1.2 + 1.4 * p) * boostNuit;
      } else if (feuVert) {
        o.color[0] = 0.08; o.color[1] = 0.98; o.color[2] = 0.24;
        o.emissive = 2.6 * boostNuit;
      } else if (phase === 'voie') {
        const p = 0.5 + 0.5 * Math.sin(t * 9 - k * 1.1);
        o.color[0] = 1.0; o.color[1] = 0.68; o.color[2] = 0.06;
        o.emissive = (0.9 + 1.4 * p) * boostNuit;
      } else {
        o.color[0] = 0.92; o.color[1] = 0.94; o.color[2] = 0.98;
        o.emissive = 0.75 * boostNuit;
      }
    }

    // 5. Repère local du Pit Box / de la voiture stoppée
    const fCar = echantillonner(c, sCar);
    const baseCar = pointVoie(fCar, dCar, 0, w);
    const carX = baseCar[0], carY = baseCar[1], carZ = baseCar[2];
    const tx = fCar.tx, tz = fCar.tz, rx = fCar.rx, rz = fCar.rz;
    const cap = fCar.cap;

    // Position fixe de la tour de ravitaillement pour le tuyau flexible
    const fFuel = echantillonner(c, sBox - 1.2);
    const pFuel = pointVoie(fFuel, w + 2.55, 1.85, w);

    // Couleur du flanc de pneu selon la gomme demandée
    const flancR = typePneus === 'pluie' ? 0.08 : typePneus === 'inter' ? 0.96 : 0.94;
    const flancG = typePneus === 'pluie' ? 0.62 : typePneus === 'inter' ? 0.80 : 0.12;
    const flancB = typePneus === 'pluie' ? 0.98 : typePneus === 'inter' ? 0.08 : 0.08;

    // Facteur d'engagement de l'équipe (0 = alignés en attente sur l'aire technique, 1 = collés à la monoplace !)
    let engage = 0;
    if (phase === 'voie') engage = 0.72;
    else if (phase === 'service') {
      engage = u < 0.86 ? 1.0 : lerp(1.0, 0.15, smoothstep(0.86, 0.98, u));
    } else if (phase === 'sortie') {
      engage = 0.08;
    }

    // Positionner les 12 mécaniciens et leurs outils
    for (let i = 0; i < mecs.length; i++) {
      const m = mecs[i];
      const cfg = m.cfg;

      // Coordonnées locales dans le repère de la voiture : lx (avant +), lz (droite +)
      const lxAtt = cfg.dxAtt;
      const lzAtt = (w - dCar) + cfg.dzAtt; // toujours hors piste sur l'aire technique !
      let lx = lerp(lxAtt, cfg.dxCar, engage);
      let lz = lerp(lzAtt, cfg.dzCar, engage);

      // Flexion (accroupi au travail sur les roues/crics/essence)
      let accroupi = 0;
      let rotBras = 0.25;
      let secousse = 0;

      if (phase === 'service' && u < 0.86) {
        if (cfg.role === 'gunner') {
          accroupi = 0.34;
          const devisse = u >= 0.08 && u <= 0.34;
          const revisse = u >= 0.56 && u <= 0.80;
          if (devisse || revisse) {
            secousse = Math.sin(t * 95 + i * 2.1) * 0.035;
            rotBras = 1.25;
          } else {
            rotBras = 0.85;
          }
        } else if (cfg.role === 'pneu') {
          accroupi = 0.24;
          // Chorégraphie ultra-rapide : retrait usé → pose roue neuve
          const aller = smoothstep(0.28, 0.44, u) * (1 - smoothstep(0.46, 0.62, u));
          const approche = smoothstep(0.44, 0.60, u) * (1 - smoothstep(0.70, 0.84, u));
          const signeZ = cfg.dzCar >= 0 ? 1 : -1;
          lz += signeZ * (0.38 * aller - 0.35 * approche);
          rotBras = 1.15;
        } else if (cfg.role === 'cric') {
          accroupi = 0.18;
          const leve = smoothstep(0.06, 0.14, u) * (1 - smoothstep(0.80, 0.86, u));
          rotBras = 0.65 + leve * 0.72;
        } else if (cfg.role === 'essence') {
          accroupi = 0.14;
          const branche = smoothstep(0.12, 0.20, u) * (1 - smoothstep(0.76, 0.84, u));
          lz -= branche * 0.38;
          rotBras = 0.85 + branche * 0.45;
        } else if (cfg.role === 'sucette') {
          accroupi = 0.0;
          rotBras = 0.95;
        }
      } else if (phase === 'voie') {
        // Prêts à bondir : léger piétinement nerveux
        accroupi = 0.08 + 0.04 * Math.abs(Math.sin(t * 7 + i));
        rotBras = cfg.role === 'sucette' ? 1.15 + 0.30 * Math.sin(t * 9) : 0.55;
      }

      // Orientation du mécanicien : face à la monoplace en action, face à l'entrée des stands en veille
      let yawM = -cap + PI; // regarde vers l'arrière (voitures qui arrivent)
      if (engage > 0.35) {
        if (cfg.role === 'sucette' || (cfg.role === 'cric' && cfg.coin === 0)) yawM = -cap + PI;
        else if (cfg.role === 'cric' && cfg.coin === 1) yawM = -cap;
        else yawM = cfg.dzCar >= 0 ? (-cap + PI * 0.5) : (-cap - PI * 0.5);
      }

      const wx = carX + tx * lx + rx * lz;
      const wz = carZ + tz * lx + rz * lz;
      const wy = carY;

      const fx = Math.cos(-yawM), fz = Math.sin(-yawM);
      const bx = -fz, bz = fx; // droite locale du mécanicien

      // Corps (jambes, torse, bande blanche, casque, visière, bras)
      const hJ = 0.78 - accroupi * 0.36;
      m.jambes.p[0] = wx; m.jambes.p[1] = wy + hJ * 0.5; m.jambes.p[2] = wz;
      m.jambes.s[1] = hJ;
      m.jambes.r[0] = 0; m.jambes.r[1] = yawM; m.jambes.r[2] = 0;

      const yT = wy + hJ + 0.28;
      m.torse.p[0] = wx + fx * accroupi * 0.18; m.torse.p[1] = yT; m.torse.p[2] = wz + fz * accroupi * 0.18;
      m.torse.r[0] = 0; m.torse.r[1] = yawM; m.torse.r[2] = 0;

      m.bande.p[0] = m.torse.p[0]; m.bande.p[1] = yT + 0.08; m.bande.p[2] = m.torse.p[2];
      m.bande.r[0] = 0; m.bande.r[1] = yawM; m.bande.r[2] = 0;

      const yC = yT + 0.44;
      m.casque.p[0] = m.torse.p[0] + fx * accroupi * 0.14; m.casque.p[1] = yC; m.casque.p[2] = m.torse.p[2] + fz * accroupi * 0.14;
      m.visiere.p[0] = m.casque.p[0] + fx * 0.13; m.visiere.p[1] = yC + 0.02; m.visiere.p[2] = m.casque.p[2] + fz * 0.13;
      m.visiere.r[0] = 0; m.visiere.r[1] = yawM; m.visiere.r[2] = 0;

      // Bras articulés exactement de l'épaule vers les mains (valide pour tout cap 0..360° via poserSegment)
      const shY = yT + 0.20;
      const handAv = 0.34 + rotBras * 0.18 + secousse;
      const handY = cfg.role === 'gunner' && phase === 'service' && u < 0.86
        ? wy + 0.46
        : (cfg.role === 'sucette' && feuVert ? wy + 1.55 : yT - 0.04 + (rotBras - 0.5) * 0.14);
      poserSegment(
        m.brasG,
        m.torse.p[0] - bx * 0.25, shY, m.torse.p[2] - bz * 0.25,
        m.torse.p[0] + fx * handAv - bx * 0.16, handY, m.torse.p[2] + fz * handAv - bz * 0.16
      );
      poserSegment(
        m.brasD,
        m.torse.p[0] + bx * 0.25, shY, m.torse.p[2] + bz * 0.25,
        m.torse.p[0] + fx * handAv + bx * 0.16, handY, m.torse.p[2] + fz * handAv + bz * 0.16
      );

      // Outils spécifiques par rôle
      if (cfg.role === 'gunner') {
        const px = m.torse.p[0] + fx * (0.48 + secousse);
        const pz = m.torse.p[2] + fz * (0.48 + secousse);
        const py = phase === 'service' && u < 0.86 ? wy + 0.42 : handY;
        m.pistolet.p[0] = px; m.pistolet.p[1] = py; m.pistolet.p[2] = pz;
        m.pistolet.r[0] = 0; m.pistolet.r[1] = yawM; m.pistolet.r[2] = 0;

        const actifSpark = phase === 'service' && ((u >= 0.08 && u <= 0.34) || (u >= 0.56 && u <= 0.80));
        const flash = actifSpark && (Math.sin(t * 140 + i * 3.7) > 0.1);
        const rSp = flash ? (0.14 + 0.10 * Math.abs(Math.sin(t * 210 + i))) : 0.001;
        m.etincelle.p[0] = px + fx * 0.22; m.etincelle.p[1] = py; m.etincelle.p[2] = pz + fz * 0.22;
        m.etincelle.s[0] = rSp; m.etincelle.s[1] = rSp; m.etincelle.s[2] = rSp;
        m.etincelle.emissive = flash ? 3.2 * boostNuit : 0;
      } else if (cfg.role === 'pneu') {
        const rxP = m.torse.p[0] + fx * 0.46;
        const rzP = m.torse.p[2] + fz * 0.46;
        const ryP = phase === 'service' && u < 0.86 ? wy + 0.38 : wy + 0.58;
        const ryEssieu = Math.atan2(rx, rz); // axe de roue parallèle à l'essieu de la F1 !
        m.roue.p[0] = rxP; m.roue.p[1] = ryP; m.roue.p[2] = rzP;
        m.roue.r[0] = PI * 0.5; m.roue.r[1] = ryEssieu; m.roue.r[2] = 0;
        m.flanc.p[0] = rxP; m.flanc.p[1] = ryP; m.flanc.p[2] = rzP;
        m.flanc.r[0] = PI * 0.5; m.flanc.r[1] = ryEssieu; m.flanc.r[2] = 0;
        m.flanc.color[0] = flancR; m.flanc.color[1] = flancG; m.flanc.color[2] = flancB;
      } else if (cfg.role === 'cric') {
        const leve = phase === 'service' ? smoothstep(0.06, 0.14, u) * (1 - smoothstep(0.80, 0.86, u)) : 0;
        const patX = m.torse.p[0] + fx * 0.72;
        const patZ = m.torse.p[2] + fz * 0.72;
        const patY = wy + 0.08 + leve * 0.14;
        m.patin.p[0] = patX; m.patin.p[1] = patY; m.patin.p[2] = patZ;
        m.patin.r[0] = 0; m.patin.r[1] = yawM; m.patin.r[2] = 0;
        poserSegment(m.manche, patX, patY + 0.06, patZ, m.torse.p[0] + fx * 0.16, wy + (1.28 - leve * 0.52), m.torse.p[2] + fz * 0.16);
      } else if (cfg.role === 'essence') {
        const branche = phase === 'service' ? smoothstep(0.12, 0.20, u) * (1 - smoothstep(0.76, 0.84, u)) : 0;
        const bx0 = m.torse.p[0] + fx * (0.42 + branche * 0.36);
        const bz0 = m.torse.p[2] + fz * (0.42 + branche * 0.36);
        const by0 = wy + 0.74 - branche * 0.12;
        m.buse.p[0] = bx0; m.buse.p[1] = by0; m.buse.p[2] = bz0;
        m.buse.r[0] = PI * 0.5; m.buse.r[1] = Math.atan2(fx, fz); m.buse.r[2] = 0;

        // Tuyau d'essence flexible en 3 segments courbes depuis la tour de ravitaillement jusqu'à la buse
        const p0x = pFuel[0], p0y = pFuel[1], p0z = pFuel[2];
        const p1x = lerp(p0x, bx0, 0.35), p1y = lerp(p0y, by0, 0.35) - 0.32, p1z = lerp(p0z, bz0, 0.35);
        const p2x = lerp(p0x, bx0, 0.70), p2y = lerp(p0y, by0, 0.70) - 0.24, p2z = lerp(p0z, bz0, 0.70);
        poserSegment(m.tuyau[0], p0x, p0y, p0z, p1x, p1y, p1z);
        poserSegment(m.tuyau[1], p1x, p1y, p1z, p2x, p2y, p2z);
        poserSegment(m.tuyau[2], p2x, p2y, p2z, bx0, by0, bz0);

        m.voyant.p[0] = p0x; m.voyant.p[1] = p0y + 0.88; m.voyant.p[2] = p0z;
        if (branche > 0.4) {
          const fl = 0.5 + 0.5 * Math.sin(t * 16);
          m.voyant.color[0] = 1.0; m.voyant.color[1] = 0.62 + 0.32 * fl; m.voyant.color[2] = 0.06;
          m.voyant.emissive = (1.6 + 1.4 * fl) * boostNuit;
        } else if (feuVert) {
          m.voyant.color[0] = 0.08; m.voyant.color[1] = 0.98; m.voyant.color[2] = 0.24;
          m.voyant.emissive = 2.4 * boostNuit;
        } else {
          m.voyant.color[0] = 0.30; m.voyant.color[1] = 0.82; m.voyant.color[2] = 0.96;
          m.voyant.emissive = 0.75 * boostNuit;
        }
      } else if (cfg.role === 'sucette') {
        // Lollipop Man : panneau STOP rouge abaissé devant le cockpit → levé brutalement en VERT GO !
        const leveGo = feuVert ? 1 : 0;
        const signeAv = phase === 'voie' ? (0.85 + 0.22 * Math.sin(t * 8)) : 1.0;
        const mainX = m.torse.p[0] + fx * 0.28;
        const mainY = wy + 1.18;
        const mainZ = m.torse.p[2] + fz * 0.28;
        const boutX = mainX + fx * (leveGo ? 0.55 : 1.15);
        const boutY = leveGo ? (wy + 2.55) : (wy + 1.25 * signeAv);
        const boutZ = mainZ + fz * (leveGo ? 0.55 : 1.15);
        poserSegment(m.perche, mainX, mainY, mainZ, boutX, boutY, boutZ);

        // Disque vertical face au pilote (axe +Y du cylindre aligné sur (tx, 0, tz) : Rx=PI/2, Ry=atan2(tx,tz))
        const ryFace = Math.atan2(tx, tz);
        m.disque.p[0] = boutX; m.disque.p[1] = boutY; m.disque.p[2] = boutZ;
        m.disque.r[0] = PI * 0.5; m.disque.r[1] = ryFace; m.disque.r[2] = 0;
        m.cadre.p[0] = boutX; m.cadre.p[1] = boutY; m.cadre.p[2] = boutZ;
        m.cadre.r[0] = 0; m.cadre.r[1] = -cap; m.cadre.r[2] = 0;
        if (leveGo) {
          m.disque.color[0] = 0.08; m.disque.color[1] = 0.98; m.disque.color[2] = 0.24;
          m.disque.emissive = 2.8 * boostNuit;
          m.cadre.color[0] = 0.98; m.cadre.color[1] = 1.0; m.cadre.color[2] = 0.96;
          m.cadre.emissive = 2.2 * boostNuit;
        } else if (phase === 'voie') {
          const fl = 0.5 + 0.5 * Math.sin(t * 10);
          m.disque.color[0] = 1.0; m.disque.color[1] = 0.48 + 0.28 * fl; m.disque.color[2] = 0.05;
          m.disque.emissive = (1.6 + 1.1 * fl) * boostNuit;
          m.cadre.emissive = 1.5 * boostNuit;
        } else {
          m.disque.color[0] = 0.98; m.disque.color[1] = 0.08; m.disque.color[2] = 0.06;
          m.disque.emissive = (phase === 'service' ? 2.5 : 0.9) * boostNuit;
          m.cadre.emissive = (phase === 'service' ? 1.9 : 0.6) * boostNuit;
        }
      }
    }

    if (sortie) {
      for (let i = 0; i < objets.length; i++) sortie.push(objets[i]);
    }
  }

  B.equipeStands = { construireDecors, creer, animer };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.equipeStands;
