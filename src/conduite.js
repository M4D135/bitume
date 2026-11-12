(function (B) {
  'use strict';
  // BITUME : conduite arcade d'une monoplace, dans le repère du circuit (abscisse s, décalage d).
  // Premier jet : Spark (KBZA, 12/11/2026). Repris par Claude : retenue sur la grille, lâcher de
  // dérive et turbo, sous-virage, glissières propres à chaque côté (c.limiteG / c.limiteD),
  // rupteur, attitude, intégration semi-implicite.
  // Conventions : d > 0 à droite ; psi, beta, omega > 0 vers la droite ; tangage > 0 nez levé ;
  // roulis > 0 côté droit plus bas (mêmes conventions que B.voiture.attitude).

  const G = 9.81;
  const PARAMS = Object.freeze({
    empattement: 2.8,
    vitessePointe: Object.freeze([27, 40, 52, 63, 75, 86]),
    ralenti: 4000, maxUtile: 12800, rupteur: 13000,
    monteeAuto: 12300, descenteAuto: 11000,
    couple: Object.freeze([[4000, 0.62], [7000, 0.86], [10500, 1.0], [12800, 0.88]]),
    coeffMoteur: 13, coeffTrainee: 0.00059, roulement: 0.25, freinMoteur: 1.6,
    coeffFrein: 14, coeffFreinV: 0.15, rapportDuree: 0.08, regimeTau: 0.05,
    braquageMax: 0.30, braquageV: 28, penteVolant: 5,
    omegaTau: 0.06, betaTau: 0.15, betaGain: 0.03,
    muPiste: 1.55, muVibreur: 1.42, muHerbe: 0.85, aero: 0.00155, largeurVibreur: 1.2,
    herbeResist: 2.5, herbeResistV: 0.05, herbeMoteur: 0.65,
    sousVirPerd: 3, sousVirMax: 6,
    chocRebond: 0.7, chocV: 0.85, chocSeuil: 0.1, chocDuree: 0.4, frottementMur: 6,
    deriveVMin: 12.2, deriveCourbMin: 1 / 400, deriveFreinMax: 0.3, deriveVolantMin: 0.35, deriveAnnulV: 10,
    deriveBeta: 0.36, deriveBetaTau: 0.18, deriveOmegaBase: 1.30, deriveOmegaPente: 0.75,
    derivePerd: 1.8, derivePerdCB: 1.5, deriveCBSeuil: 0.85,
    deriveReserreVolant: 0.2, deriveReserreOmega: 1.40, deriveReserreBeta: 0.45, deriveReserrePerd: 3,
    deriveChargeQ: 0.55, deriveChargeBase: 0.1, deriveChargeSeuil: 0.1,
    deriveNiveaux: Object.freeze([1.0, 2.2, 3.6]),
    deriveFenDur: 0.25, deriveFenPer: 1.2, deriveFondSeuil: 0.9, deriveFondDur: 0.6,
    turboDurees: Object.freeze([0, 0.6, 1.0, 1.5]), turboBonus: 0.2, turboAcc: 5.5, turboVMax: 92,
    tangageCoef: 0.0035, tangageMax: 0.05, roulisCoef: 0.0025, roulisMax: 0.04, attitudeTau: 0.1,
    glisseFrein: 0.9, glisseFreinV: 30, glisseFreinMax: 0.5,
    grilleMonteeTau: 0.09, grilleDescenteTau: 0.22, rupteurRebond: 380, rupteurCadence: 0.1
  });
  // accélération moteur maximale de chaque rapport : 13 × (27 / vitesse de pointe)^0,8
  const POUSSEE = PARAMS.vitessePointe.map(v => PARAMS.coeffMoteur * Math.pow(27 / v, 0.8));

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function borne01(x) { x = +x; return x > 0 ? (x < 1 ? x : 1) : 0; }
  function sign(x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); }
  function expTau(tau, dt) { return tau > 0 ? 1 - Math.exp(-dt / tau) : 1; }
  function ramener(s, L) { return ((s % L) + L) % L; }
  function angle(a) { return a - 2 * Math.PI * Math.round(a / (2 * Math.PI)); }
  function regimeBrut(v, vPointe) { return PARAMS.ralenti + (PARAMS.maxUtile - PARAMS.ralenti) * v / vPointe; }

  function couple(r) {
    const c = PARAMS.couple;
    if (r <= c[0][0]) return c[0][1];
    for (let i = 0; i < c.length - 1; i++) {
      if (r <= c[i + 1][0]) return c[i][1] + (c[i + 1][1] - c[i][1]) * (r - c[i][0]) / (c[i + 1][0] - c[i][0]);
    }
    return c[c.length - 1][1];
  }

  function creer(s, d) {
    return {
      s: s, d: d, psi: 0, beta: 0, v: 0, omega: 0,
      rapport: 1, regime: PARAMS.ralenti, volant: 0, gaz: 0, frein: 0,
      surface: 'piste', vibreur: false, glisse: 0, alat: 0, along: 0,
      derive: { actif: false, sens: 0, duree: 0, charge: 0, niveau: 0, fenetre: 0, aFond: 0, verrou: false },
      turbo: { reste: 0 }, choc: 0, distance: 0, tangage: 0, roulis: 0, y: 0,
      coupure: 0, rupteurT: 0, sousVirage: 0
    };
  }

  function cap(etat, c) { return B.circuit.echantillon(c, etat.s).cap + etat.psi + etat.beta; }
  function kmh(etat) { return Math.round(etat.v * 3.6); }

  // glissière du côté donné ; repli sur c.limite pour un circuit sans limites par échantillon
  function limiteCote(c, s, cote) {
    return c.limiteG && B.circuit.limiteA ? B.circuit.limiteA(c, s, cote) : c.limite;
  }

  function eteindre(dr) {
    dr.actif = false; dr.sens = 0; dr.duree = 0; dr.charge = 0; dr.niveau = 0; dr.fenetre = 0; dr.aFond = 0;
  }
  // fin sans turbo ; le bouton doit être relâché avant une nouvelle dérive
  function annulerDerive(etat) {
    const dr = etat.derive;
    if (!dr.actif) return null;
    eteindre(dr); dr.verrou = true;
    return { type: 'deriveAnnulee' };
  }
  function annuler(etat, ev) { const a = annulerDerive(etat); if (a) ev.push(a); }
  function lacher(etat, ev) {
    const dr = etat.derive, P = PARAMS;
    if (dr.niveau >= 1) {
      const parfait = dr.fenetre > 0, duree = P.turboDurees[dr.niveau] + (parfait ? P.turboBonus : 0);
      etat.turbo.reste = Math.max(etat.turbo.reste, duree);
      ev.push({ type: 'turbo', duree, niveau: dr.niveau, parfait });
    }
    eteindre(dr);
  }

  function changer(etat, sens, ev) {
    etat.rapport += sens; etat.coupure = PARAMS.rapportDuree;
    ev.push({ type: 'rapport', rapport: etat.rapport, haut: sens > 0 });
  }

  // Grille et feux : la voiture ne bouge pas, le régime suit le gaz et rebondit sur le rupteur.
  function retenir(etat, gaz, dt, ev) {
    const P = PARAMS;
    if (etat.derive.actif) eteindre(etat.derive);
    etat.v = 0; etat.omega = 0; etat.psi = 0; etat.beta = 0; etat.alat = 0; etat.along = 0;
    etat.glisse = 0; etat.sousVirage = 0; etat.turbo.reste = 0; etat.rapport = 1; etat.coupure = 0;
    const cible = P.ralenti + (P.rupteur - P.ralenti) * gaz;
    etat.regime += (cible - etat.regime) * expTau(cible > etat.regime ? P.grilleMonteeTau : P.grilleDescenteTau, dt);
    if (etat.regime >= P.maxUtile) { etat.regime = P.maxUtile - P.rupteurRebond; ev.push({ type: 'rupteur' }); }
  }

  function rouler(etat, cmd, c, dt, gaz, frein, aide, ev) {
    const P = PARAMS, dr = etat.derive;
    const e = B.circuit.echantillon(c, etat.s), k = e.courbure, v = etat.v;

    // Surface sous la voiture
    const demi = c.largeur / 2, ad = Math.abs(etat.d), cote = etat.d < 0 ? -1 : 1;
    let mu = P.muPiste, surf = 'piste';
    if (ad > demi) {
      if (ad <= demi + P.largeurVibreur && B.circuit.vibreurA(c, etat.s, cote)) { mu = P.muVibreur; surf = 'vibreur'; }
      else { mu = P.muHerbe; surf = 'herbe'; }
    }
    etat.surface = surf; etat.vibreur = surf === 'vibreur';

    // Dérive : départ, lâcher, annulations, charge, niveaux, fenêtre
    if (!dr.actif) {
      if (cmd.derive && !dr.verrou && surf !== 'herbe' && frein < P.deriveFreinMax && v >= P.deriveVMin &&
          Math.abs(k) >= P.deriveCourbMin && Math.abs(etat.volant) >= P.deriveVolantMin && sign(etat.volant) === sign(k)) {
        dr.actif = true; dr.sens = sign(etat.volant);
        dr.duree = 0; dr.charge = 0; dr.niveau = 0; dr.fenetre = 0; dr.aFond = 0;
        ev.push({ type: 'derive', sens: dr.sens });
      }
    } else if (frein >= P.deriveFreinMax || surf === 'herbe' || v < P.deriveAnnulV) annuler(etat, ev);
    else if (!cmd.derive) lacher(etat, ev);

    let cb = 0, serre = false;
    if (dr.actif) {
      cb = Math.max(0, -dr.sens * etat.volant);
      serre = dr.sens * etat.volant > P.deriveReserreVolant;
      dr.duree += dt;
      if (cb > P.deriveChargeSeuil) dr.charge += dt * (P.deriveChargeQ * clamp(1 - Math.abs(cb - 0.5) / 0.5, 0, 1) + P.deriveChargeBase);
      const N = P.deriveNiveaux, niv = dr.charge >= N[2] ? 3 : dr.charge >= N[1] ? 2 : dr.charge >= N[0] ? 1 : 0;
      if (niv > dr.niveau) { dr.niveau = niv; ev.push({ type: 'niveau', niveau: niv }); }
      if (dr.niveau >= 1) {
        const t = dr.duree % P.deriveFenPer, ouverte = t < P.deriveFenDur;
        if (ouverte && !(dr.fenetre > 0)) ev.push({ type: 'fenetre' });
        dr.fenetre = ouverte ? P.deriveFenDur - t : 0;
      }
      if (cb > P.deriveFondSeuil) {
        dr.aFond += dt; // cumulé sur toute la dérive
        if (dr.aFond > P.deriveFondDur) { annuler(etat, ev); cb = 0; serre = false; }
      }
    }

    // Boîte et régime
    const turbo = etat.turbo.reste > 0;
    if (turbo) etat.turbo.reste = etat.turbo.reste - dt > 1e-9 ? etat.turbo.reste - dt : 0;
    if (etat.coupure > 0) etat.coupure -= dt;
    if (etat.rupteurT > 0) etat.rupteurT -= dt;
    const VP = P.vitessePointe;
    if (etat.coupure <= 0) {
      if (cmd.boite === 'manuelle') {
        if (cmd.haut && etat.rapport < 6) changer(etat, 1, ev);
        // pas de rétrogradage qui ferait dépasser le rupteur
        else if (cmd.bas && etat.rapport > 1 && regimeBrut(v, VP[etat.rapport - 2]) < P.rupteur) changer(etat, -1, ev);
      } else if (etat.rapport < 6 && regimeBrut(v, VP[etat.rapport - 1]) >= P.monteeAuto) changer(etat, 1, ev);
      else if (etat.rapport > 1 && regimeBrut(v, VP[etat.rapport - 2]) < P.descenteAuto) changer(etat, -1, ev);
    }
    const brut = regimeBrut(v, VP[etat.rapport - 1]);
    etat.regime += (clamp(brut, P.ralenti, P.rupteur) - etat.regime) * expTau(P.regimeTau, dt);
    // en sixième sous turbo, le moteur reste à fond au-delà de sa pointe sans couper
    const libre = turbo && etat.rapport === 6;
    const auRupteur = brut >= P.maxUtile && !libre;
    if (auRupteur && gaz > 0.05 && etat.rapport < 6 && etat.rupteurT <= 0) { ev.push({ type: 'rupteur' }); etat.rupteurT = P.rupteurCadence; }

    // Lacet demandé, adhérence, sous-virage, dérive
    const amax = mu * (G + P.aero * v * v), omegaMax = amax / Math.max(v, 0.5);
    const deltaMax = P.braquageMax / (1 + v / P.braquageV);
    const omegaC = v * Math.tan(etat.volant * deltaMax) / P.empattement + aide * k * v;
    let omegaCible, perte = 0, sousVir = 0;
    if (dr.actif) {
      const f = serre ? P.deriveReserreOmega : P.deriveOmegaBase - P.deriveOmegaPente * Math.min(cb, 1);
      omegaCible = dr.sens * omegaMax * f;
      perte = P.derivePerd + (cb > P.deriveCBSeuil ? P.derivePerdCB : 0) + (serre ? P.deriveReserrePerd : 0);
    } else if (Math.abs(omegaC) > omegaMax) {
      omegaCible = sign(omegaC) * omegaMax;
      sousVir = Math.abs(omegaC) * v / amax - 1;
      perte = Math.min(P.sousVirPerd * sousVir, P.sousVirMax);
    } else omegaCible = omegaC;
    etat.omega += (omegaCible - etat.omega) * expTau(P.omegaTau, dt);

    // Accélération longitudinale
    let aMot = gaz * POUSSEE[etat.rapport - 1] * couple(etat.regime);
    if (etat.coupure > 0 || auRupteur) aMot = 0;
    if (surf === 'herbe') aMot *= P.herbeMoteur;
    let along = aMot - P.coeffTrainee * v * v - P.roulement - P.freinMoteur * (1 - gaz)
      - frein * (P.coeffFrein + P.coeffFreinV * v) - perte;
    if (surf === 'herbe') along -= P.herbeResist + P.herbeResistV * v;
    if (turbo) along += P.turboAcc * clamp((P.turboVMax - v) / 2, 0, 1);
    etat.v = Math.max(0, v + along * dt);
    etat.along = etat.v > 0 || along > 0 ? along : 0;
    const vN = etat.v;
    etat.alat = etat.omega * vN;

    // Angle de caisse
    let betaCible, tauB;
    if (dr.actif) { betaCible = dr.sens * (serre ? P.deriveReserreBeta : P.deriveBeta); tauB = P.deriveBetaTau; }
    else { betaCible = -P.betaGain * etat.alat / amax; tauB = P.betaTau; }
    etat.beta += (betaCible - etat.beta) * expTau(tauB, dt);

    // Cinématique de Frenet, semi-implicite (vitesses d'abord, positions ensuite)
    const den = Math.max(1 - k * etat.d, 0.1);
    etat.psi = angle(etat.psi + (etat.omega - k * vN * Math.cos(etat.psi) / den) * dt);
    const dsdt = vN * Math.cos(etat.psi) / den;
    etat.s = ramener(etat.s + dsdt * dt, c.longueur);
    etat.d += vN * Math.sin(etat.psi) * dt;
    etat.distance += Math.abs(dsdt) * dt;

    // Glissière
    const cd = etat.d < 0 ? -1 : 1, lim = limiteCote(c, etat.s, cd);
    if (Math.abs(etat.d) > lim) {
      const vAvant = etat.v, sinI = Math.abs(Math.sin(etat.psi)), versMur = cd * etat.psi > 0;
      etat.d = cd * (lim - 0.1);
      if (versMur) { etat.psi = -etat.psi * 0.5; etat.v *= 1 - P.chocRebond * sinI; }
      etat.v = Math.max(0, etat.v - P.frottementMur * dt);
      if (etat.choc <= 0) {
        // un vrai choc coûte au moins 15 % ; une glissade le long du mur, seulement le frottement
        if (versMur && sinI > P.chocSeuil) etat.v = Math.min(etat.v, P.chocV * vAvant);
        ev.push({ type: 'choc', force: vAvant - etat.v });
      }
      etat.choc = P.chocDuree;
      annuler(etat, ev);
    } else if (etat.choc > 0) etat.choc -= dt;

    // Intensité de glisse pour le son
    let gl = dr.actif ? Math.abs(etat.beta) / P.deriveBeta : 0;
    if (sousVir > gl) gl = sousVir;
    if (frein > P.glisseFrein && vN > P.glisseFreinV) gl = Math.max(gl, P.glisseFreinMax * (frein - P.glisseFrein) / (1 - P.glisseFrein));
    etat.glisse = clamp(gl, 0, 1);
    etat.sousVirage = sousVir;
  }

  function poserAttitude(etat, c, dt) {
    const P = PARAMS, e = B.circuit.echantillon(c, etat.s), kA = expTau(P.attitudeTau, dt);
    // sol sous la voiture, même profil que le décor : dévers sur la piste, vibreur, accotement à 2 %
    const w = c.largeur / 2, ad = Math.abs(etat.d);
    etat.y = e.y - clamp(etat.d, -w, w) * Math.sin(e.devers);
    if (ad > w + P.largeurVibreur) etat.y -= 0.015 + 0.02 * (ad - w - P.largeurVibreur);
    else if (ad > w) etat.y += (etat.vibreur ? 0.05 : -0.015) * (ad - w) / P.largeurVibreur;
    const tang = Math.atan(e.pente) + clamp(P.tangageCoef * etat.along, -P.tangageMax, P.tangageMax);
    const roul = e.devers + clamp(-P.roulisCoef * etat.alat, -P.roulisMax, P.roulisMax);
    etat.tangage += (tang - etat.tangage) * kA;
    etat.roulis += (roul - etat.roulis) * kA;
  }

  // cmd = { gaz, frein, volant, derive, haut, bas, boite: 'auto'|'manuelle', aide }
  function pas(etat, cmd, c, dt, retenue = false) {
    const ev = [];
    const gaz = borne01(cmd.gaz), frein = borne01(cmd.frein), aide = borne01(cmd.aide);
    etat.gaz = gaz; etat.frein = frein;
    const dmax = PARAMS.penteVolant * dt;
    etat.volant += clamp(clamp(+cmd.volant || 0, -1, 1) - etat.volant, -dmax, dmax);
    if (!cmd.derive) etat.derive.verrou = false;
    if (retenue) retenir(etat, gaz, dt, ev);
    else rouler(etat, cmd, c, dt, gaz, frein, aide, ev);
    poserAttitude(etat, c, dt);
    return ev;
  }

  B.conduite = { PARAMS, creer, pas, annulerDerive, cap, kmh, couple, limiteCote };
})(globalThis.BITUME = globalThis.BITUME || {});
