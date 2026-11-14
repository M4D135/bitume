(function (B) {
  'use strict';
  // BITUME : conduite d'une monoplace, dans le repère du circuit (abscisse s, décalage d).
  // Essai 0.1 : premier jet du Spark (KBZA, 12/11/2026), repris par Claude (grille, boîte, rupteur, glissières).
  // Chantier 2, Claude (12/11/2026) : modèle bicyclette dynamique. Deux essieux et quatre charges de roue,
  // transferts de charge longitudinal et latéral filtrés, sensibilité à la charge, appui réparti, courbe de pneu
  // qui sature puis retombe un peu, ellipse d'adhérence partagée avec la motricité (arrière) et le freinage
  // (réparti), inertie de lacet, pente et dévers. Dérive au bouton rendue physique : l'arrière passe en glisse
  // (courbe adoucie, sans retombée) et le pilote la tient au contre-braquage et au gaz ; turbo transmis par les
  // pneus arrière, dans l'adhérence que le virage leur laisse. Équilibre : au-delà du pic, l'arrière en glisse
  // franche perd de l'adhérence totale, partagée avec la motricité, et l'amortisseur de glisse lâche ; une forte
  // glisse non corrigée part en tête-à-queue.
  // Phase 2, réglages (Claude, 12/11/2026) : la poussée du moteur prend plus d'adhérence latérale à l'arrière que
  // l'ellipse (ellipseMotrice : plein gaz en 2e, l'arrière glisse) ; le guidage du clavier s'efface vers le plein
  // volant (plein volant = braquageMax(v), comme pour l'IA) ; le contre-braquage de la dérive compte aussitôt et
  // retombe lentement (des appuis répétés au clavier tiennent la dérive) ; centre de gravité à 0,33 m.
  // La mécanique de la dérive chargée vient de vroom-unreal ; constantes et code sont ceux de BITUME.
  // Conventions : d > 0 à droite ; psi (cap de la vitesse sur la tangente), beta (caisse − vitesse) et omega
  // (lacet de la caisse) > 0 vers la droite ; tangage > 0 nez levé ; roulis > 0 côté droit plus bas.

  const G = 9.81;
  const PARAMS = Object.freeze({
    // châssis : monoplace de 1990, pilote et essence compris
    masse: 600, empattement: 2.85, repartition: 0.44, hauteurCG: 0.33, voie: 1.75, giration: 1.30,
    roulisAvant: 0.54, chargeTau: 0.07,
    // air : appui (m/s² par (m/s)²), part de l'appui sur l'avant, traînée, roulement, aspiration
    aero: 0.0016, aeroAvant: 0.45, coeffTrainee: 0.00059, roulement: 0.25, aspirationMax: 0.35,
    // pneus : adhérence au pic, sensibilité à la charge, dérive au pic, retombée après le pic (plus basse et plus
    // étalée à l'arrière)
    muPiste: 1.72, muVibreur: 1.58, muHerbe: 0.94, sensibilite: 0.06, chargeNominale: 1500, gripArriere: 1.08,
    alphaAv: 0.105, alphaAr: 0.095, chute: 0.15, chuteLargeur: 1.0, chuteAr: 0.3, chuteArLargeur: 2.0,
    glissement: 0.97,
    // motricité : exposant de l'ellipse d'adhérence arrière sous la poussée du moteur (2 : ellipse ; moins : la
    // poussée prend plus d'adhérence latérale, et plein gaz sur un petit rapport fait glisser l'arrière)
    ellipseMotrice: 1.3,
    largeurVibreur: 1.2, herbeResist: 2.5, herbeResistV: 0.05, herbeMoteur: 0.65,
    // moteur et boîte
    vitessePointe: Object.freeze([27, 40, 52, 63, 75, 86]),
    ralenti: 4000, maxUtile: 12800, rupteur: 13000, monteeAuto: 12300, descenteAuto: 11000,
    couple: Object.freeze([[4000, 0.62], [7000, 0.86], [10500, 1.0], [12800, 0.88]]),
    coeffMoteur: 13, freinMoteur: 1.6, rapportDuree: 0.08, regimeTau: 0.05,
    lancement: 0.70, lancementTau: 0.09,
    // freins : part de l'adhérence totale à pleine pédale, part de l'avant
    freinMax: 0.92, freinAvant: 0.60,
    // direction : le volant commande une part de l'adhérence avant ; plein volant un peu après le pic ;
    // amortisseur de glisse, lâché entre amortSeuil et amortSeuil + amortPlage fois la dérive arrière au pic
    braquageMeca: 0.38, marge: 1.0, vSuivi0: 2, vSuivi1: 6, amortGlisse: 0.5, amortSeuil: 3.0, amortPlage: 0.5,
    volantMontee: 0.030, volantMonteeV: 0.0002, volantRetour: 0.028,
    // aide au volant : rattrape les glisses (niveaux 0,35 et 0,7)
    aideSeuil: 0.06, aidePlage: 0.12, aideGain: 2.2, aideLacet: 0.25,
    // dérive au bouton
    deriveVMin: 12.2, deriveCourbMin: 0.0015, deriveVolantMin: 0.2, deriveFreinMax: 0.05, deriveAnnulV: 10,
    deriveArmement: 0.15, deriveRearmement: 0.25, deriveAttente: 0.2, deriveGrace: 0.18, derivePerte: 0.38,
    deriveNiveaux: Object.freeze([0.5, 1.1, 1.9]), deriveChargeMax: 2.2, deriveDecroit: 0.2, deriveFenDur: 0.22,
    // fondus d'entrée et de sortie de l'arrière, tirage de l'avant et son délai, courbe de l'arrière en dérive,
    // adhérence arrière en dérive, part de l'amortisseur de glisse gardée en dérive
    deriveEntree: 0.10, deriveSortie: 0.16, deriveTirage: 1.4, deriveTirageTau: 0.035, deriveAlpha: 0.12, deriveMuAr: 1.0,
    deriveAmort: 0.25,
    // contre-braquage compté pour la qualité : pris aussitôt, retombée lente (s) ; le clavier contre-braque par appuis
    deriveContreRetombee: 0.25,
    // qualité de la dérive : contre-braquage (nul, plein, au-delà) et angle de caisse (rad) qui comptent
    deriveContreQ: Object.freeze([0.10, 0.22, 0.78]), deriveContreTrop: 0.30, deriveAngleQ: Object.freeze([0.02, 0.06, 0.66, 0.84]),
    deriveAngleMax: 0.85, deriveBond: 0.18, deriveBondDuree: 0.24,
    // turbo : durée par palier, bonus du lâcher parfait, poussée par palier, fondus
    turboDurees: Object.freeze([0, 0.6, 1.1, 1.6]), turboBonus: 0.2, turboAcc: Object.freeze([0, 9, 13, 16]),
    turboMontee: 0.10, turboDescente: 0.16, turboVMax: 92,
    // glissières
    chocRebond: 0.7, chocV: 0.85, chocSeuil: 0.1, chocDuree: 0.4, frottementMur: 6,
    // Chantier 3 : glissières selon l'angle et la vitesse, et emprise de la caisse (coins jamais au-delà du rail)
    caisseL: 4.95, caissel: 2.02,
    glissRasant: 0.14,               // < 8° : on frôle le rail, on garde l'essentiel de la vitesse
    glissAccident: 0.61,             // > 35° et au-delà de glissVAccident : accident
    glissVAccident: 27.0,             // ≈ 97 km/h : au-delà et au-delà de 35°, mur plein = accident
    glissFrottementRasant: 2.2,      // frottement d'une glissade le long du rail (m/s²)
    // attitude visuelle et grille
    tangageCoef: 0.0035, tangageMax: 0.05, roulisCoef: 0.0025, roulisMax: 0.04, attitudeTau: 0.1,
    grilleMonteeTau: 0.09, grilleDescenteTau: 0.22, rupteurRebond: 380, rupteurCadence: 0.1,
    // Chantier 3 — chocs, sauts roue contre roue, dégâts, accident et retour
    bondVMin: 0.65, bondH: 0.22, bondDuree: 0.34,          // petit bond : rapprochement minimal, hauteur, durée
    sautVMin: 6.5, sautH: 1.8, sautDuree: 1.0,             // grand saut : rapprochement au-delà du seuil, arc, durée
    sautTangLim: 0.55, sautRoulLim: 0.72,                  // au-delà à la réception, la voiture tonne (accident)
    contreBon: 0.4, contreMauvais: -0.4,                   // contre-braquage : 100 % / 97 % / 94 % de la vitesse
    volBraquage: 0.15, volTrainee: 0.0011,                 // en l'air on dirige peu ; légère traînée d'air
    accidentDuree: 4.5, accidentImm: 2, accidentFrein: 3.2, // retour progressif en piste, puis immunité
    // roue perdue (Chantier 3) : plus de direction ni de motricité, on s'immobilise, réparation lente, repositionnement
    rouePerdueBraquage: 0.06, rouePerdueTraine: 0.05, rouePerdueLacet: 0.7, rouePerdueFrein: 9,
    reparationDuree: 9                                       // réparation lente à l'arrêt (pénalise le temps de course)
  });
  const P = PARAMS;
  // accélération moteur maximale de chaque rapport : 13 × (27 / vitesse de pointe)^0,8
  const POUSSEE = P.vitessePointe.map(v => P.coeffMoteur * Math.pow(27 / v, 0.8));
  // géométrie tirée des constantes
  const L = P.empattement, A = L * (1 - P.repartition), BR = L * P.repartition; // CG → avant, CG → arrière
  const IZ = P.masse * P.giration * P.giration;

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function borne01(x) { x = +x; return x > 0 ? (x < 1 ? x : 1) : 0; }
  function sign(x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); }
  function expTau(tau, dt) { return tau > 0 ? 1 - Math.exp(-dt / tau) : 1; }
  function ramener(s, Lc) { return ((s % Lc) + Lc) % Lc; }
  function angle(a) { return a - 2 * Math.PI * Math.round(a / (2 * Math.PI)); }
  function rampe(x, a, b) { return x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); }
  function regimeBrut(v, vPointe) { return P.ralenti + (P.maxUtile - P.ralenti) * v / vPointe; }

  function couple(r) {
    const c = P.couple;
    if (r <= c[0][0]) return c[0][1];
    for (let i = 0; i < c.length - 1; i++) {
      if (r <= c[i + 1][0]) return c[i][1] + (c[i + 1][1] - c[i][1]) * (r - c[i][0]) / (c[i + 1][0] - c[i][0]);
    }
    return c[c.length - 1][1];
  }

  // Courbe de pneu normalisée, x = dérive / dérive au pic : montée en sinus jusqu'au pic (forme), puis retombée
  // douce vers 1 − chute (retombee ; à l'avant, 85 % de l'adhérence de pic en pleine glisse).
  function forme(x) {
    if (x >= 1) return 1;
    if (x <= -1) return -1;
    return Math.sin(x * Math.PI / 2);
  }
  function retombee(x, chute, largeur) {
    const ax = x < 0 ? -x : x;
    if (ax <= 1) return 1;
    const q = (ax - 1) * (ax - 1);
    return 1 - chute * q / (q + largeur * largeur);
  }
  function pneu(x) { return forme(x) * retombee(x, P.chute, P.chuteLargeur); }
  // Consigne de dérive avant (en dérive au pic) pour une part rho de l'adhérence avant : inverse de la montée,
  // si bien que la force suit le volant ; plein volant à P.marge fois la dérive au pic, au-delà en dérive.
  function consigne(rho) {
    const a = rho < 0 ? -rho : rho;
    let x;
    if (a <= 1) { const a3 = a * a * a; x = Math.asin(a) * 2 / Math.PI * (1 + (P.marge - 1) * a3 * a3); }
    else x = P.marge + (a - 1) * 2;
    return rho < 0 ? -x : x;
  }
  // adhérence d'une roue selon sa charge (N), pour un coefficient de surface mu
  function adherence(mu, fz) {
    return fz > 0 ? mu * clamp(1 - P.sensibilite * (fz / P.chargeNominale - 1), 0.6, 1.15) * fz : 0;
  }
  // part de la direction qui suit la vitesse du centre de gravité : nulle au pas, entière dès 6 m/s
  function suivi(v) { return rampe(v, P.vSuivi0, P.vSuivi1); }
  // Capacité latérale nominale (m/s²) à la vitesse v, sur la piste, sans transfert.
  function capaciteLaterale(v) { return P.muPiste * (G + P.aero * v * v); }
  // Braquage géométrique (rad) qui fait tourner la voiture à l'accélération latérale amax à la vitesse v : le lacet
  // qu'il faut, vu de l'essieu avant (CG → avant × courbure).
  function geometrie(v, amax) { return Math.min(P.braquageMeca, A * amax / Math.max(v * v, 1)); }
  // Braquage (rad) par rapport à la vitesse du centre de gravité pour une part rho de l'adhérence avant : part
  // géométrique et dérive au pic ; au pas, braquage mécanique.
  function braquer(rho, v, amax) {
    const l = suivi(v), x = consigne(rho);
    return l * (rho * geometrie(v, amax) + x * P.alphaAv) + (1 - l) * clamp(rho, -1, 1) * P.braquageMeca;
  }
  // Plus grand braquage commandé (rad) à la vitesse v, plein volant, pour la capacité nominale : partagé avec l'IA.
  function braquageMax(v) {
    v = Math.max(0, +v || 0);
    return Math.min(P.braquageMeca, braquer(1, v, capaciteLaterale(v)));
  }

  function creer(s, d) {
    return {
      s: s, d: d, psi: 0, beta: 0, v: 0, omega: 0,
      rapport: 1, regime: P.ralenti, volant: 0, gaz: 0, frein: 0, braquage: 0,
      surface: 'piste', vibreur: false, glisse: 0, alat: 0, along: 0,
      chargeX: 0, chargeY: 0, chargeAv: P.repartition, capAv: 0, capAr: 0,
      roues: [0, 1, 2, 3].map(() => ({ charge: 0, glisse: 0 })), // avant gauche, avant droite, arrière gauche, arrière droite
      glisseAv: 0, glisseAr: 0, deriveAv: 0, deriveAr: 0, patinage: 0, blocage: 0, aspiration: 0, pente: 0,
      derive: {
        actif: false, sens: 0, duree: 0, charge: 0, niveau: 0, palier: 0, fenetre: 0, qualite: 0, contre: 0,
        perte: 0, grace: 0, amorce: 0, melange: 0, tirage: 0, verrou: false, arme: 0, relache: P.deriveRearmement
      },
      turbo: { reste: 0, niveau: 0, parfait: false, duree: 0, ecoule: 0, poussee: 0 },
      bond: 0, bondT: 0, choc: 0, distance: 0, tangage: 0, roulis: 0, y: 0,
      coupure: 0, rupteurT: 0, sousVirage: 0,
      // Chantier 3 : vol (saut), accident et retour en piste, immunité, dégâts — tous inactifs au départ, la
      // conduite reste exactement celle des critères quand ils sont absents (tests de conduite sans ces modules)
      saut: null, accident: null, immunite: 0, degats: null, reparation: null, choc: 0, auRail: false
    };
  }

  function cap(etat, c) { return B.circuit.echantillon(c, etat.s).cap + etat.psi + etat.beta; }
  function kmh(etat) { return Math.round(etat.v * 3.6); }

  // glissière du côté donné ; repli sur c.limite pour un circuit sans limites par échantillon
  function limiteCote(c, s, cote) {
    return c.limiteG != null && B.circuit.limiteA ? B.circuit.limiteA(c, s, cote) : c.limite;
  }

  // ---------------------------------------------------------------- dérive et turbo
  function eteindre(dr, doux) {
    dr.actif = false; dr.sens = 0; dr.duree = 0; dr.charge = 0; dr.niveau = 0; dr.palier = 0; dr.fenetre = 0;
    dr.qualite = 0; dr.contre = 0; dr.perte = 0; dr.grace = 0; dr.relache = 0;
    // fin douce : le fondu et le tirage retombent par leurs filtres (sortie 0,16 s), pas d'un cran —
    // la caisse ne peut pas reprendre l'adhérence instantanément, et un saut de β fausse le lissage (S8)
    if (!doux) { dr.amorce = 0; dr.melange = 0; dr.tirage = 0; }
  }
  function couperTurbo(etat) {
    const t = etat.turbo;
    t.reste = 0; t.niveau = 0; t.parfait = false; t.duree = 0; t.ecoule = 0; t.poussee = 0;
  }
  // Fin sans turbo (frein, herbe, contact, perte de contrôle) : le bouton doit être relâché avant une nouvelle dérive.
  // Un contact coupe aussi un turbo en cours.
  function annulerDerive(etat, doux) {
    const dr = etat.derive, avaitTurbo = etat.turbo.reste > 0;
    couperTurbo(etat);
    if (!dr.actif) return avaitTurbo ? { type: 'turboCoupe' } : null;
    eteindre(dr, doux); dr.verrou = true;
    return { type: 'deriveAnnulee' };
  }
  function annuler(etat, ev) { const a = annulerDerive(etat, true); if (a) ev.push(a); }
  function lacher(etat, ev, enPiste) {
    const dr = etat.derive;
    if (enPiste && dr.niveau >= 1 && dr.perte < P.derivePerte) {
      const parfait = dr.fenetre > 0 && dr.niveau === dr.palier, duree = P.turboDurees[dr.niveau] + (parfait ? P.turboBonus : 0);
      const t = etat.turbo;
      t.reste = duree; t.duree = duree; t.niveau = dr.niveau; t.parfait = parfait; t.ecoule = 0;
      ev.push({ type: 'turbo', duree, niveau: dr.niveau, parfait });
    }
    eteindre(dr, true);
  }
  function lisse(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  // Machine d'état de la dérive : départ, charge à la qualité du contre-braquage, paliers et fenêtres, fin.
  function piloterDerive(etat, cmd, k, frein, surf, enPiste, dt, ev) {
    const dr = etat.derive, v = etat.v;
    if (!cmd.derive) {
      dr.verrou = false; dr.arme = 0;
      dr.relache = Math.min(P.deriveRearmement, dr.relache + dt);
    }
    if (dr.actif) {
      if (frein >= P.deriveFreinMax || surf === 'herbe' || !enPiste || v < P.deriveAnnulV ||
          Math.abs(etat.beta) > P.deriveAngleMax) { annuler(etat, ev); return; }
      const dansVirage = Math.abs(k) >= P.deriveCourbMin && k * dr.sens > 0;
      dr.grace = dansVirage ? P.deriveGrace : dr.grace - dt;
      dr.duree += dt;
      dr.fenetre = Math.max(0, dr.fenetre - dt);
      // contre-braquage : volant opposé au sens de la dérive
      // compté aussitôt, il retombe en deriveContreRetombee : des appuis répétés au clavier valent un contre-braquage tenu
      const cb = Math.max(0, -dr.sens * etat.volant);
      dr.contre = cb >= dr.contre ? cb : dr.contre + (cb - dr.contre) * expTau(P.deriveContreRetombee, dt);
      const c = dr.contre;
      const QC = P.deriveContreQ, QA = P.deriveAngleQ;
      const qC = c <= QC[0] ? 0 : c < QC[1] ? (c - QC[0]) / (QC[1] - QC[0]) : c <= QC[2] ? 1 :
        1 - P.deriveContreTrop * (c - QC[2]) / (1 - QC[2]);
      const ab = dr.sens * etat.beta; // angle de dérive, positif nez vers l'intérieur
      const qA = rampe(ab, QA[0], QA[1]) * (1 - rampe(ab, QA[2], QA[3]));
      dr.qualite = qC * qA;
      if (dr.duree > P.deriveAttente) {
        const bon = dr.qualite >= 0.3;
        dr.perte = bon ? Math.max(0, dr.perte - 2 * dt) : dr.perte + dt;
        if (bon && dr.grace > 0) dr.charge = Math.min(P.deriveChargeMax, dr.charge + dr.qualite * dt);
        else dr.charge = Math.max(0, dr.charge - P.deriveDecroit * dt);
        const N = P.deriveNiveaux, niv = dr.charge >= N[2] ? 3 : dr.charge >= N[1] ? 2 : dr.charge >= N[0] ? 1 : 0;
        dr.niveau = niv;
        if (niv > dr.palier) {
          dr.palier = niv; dr.fenetre = P.deriveFenDur;
          ev.push({ type: 'niveau', niveau: niv }); ev.push({ type: 'fenetre', niveau: niv });
        }
      }
      if (!cmd.derive) { lacher(etat, ev, enPiste); dr.relache = 0; return; }
      if (dr.perte > P.derivePerte || dr.grace <= 0) {
        // perte de contrôle ou virage fini bouton tenu : la glisse retombe sans turbo
        eteindre(dr, true); dr.verrou = true; ev.push({ type: 'deriveAnnulee' });
      }
      return;
    }
    if (!cmd.derive || dr.verrou) return;
    dr.arme += dt;
    const possible = v >= P.deriveVMin && surf !== 'herbe' && enPiste && frein < P.deriveFreinMax &&
      etat.turbo.reste <= 0 && dr.relache >= P.deriveRearmement;
    if (possible && Math.abs(k) >= P.deriveCourbMin && Math.abs(etat.volant) >= P.deriveVolantMin &&
        etat.volant * k > 0) {
      eteindre(dr, true);
      dr.actif = true; dr.sens = sign(k); dr.grace = P.deriveGrace;
      etat.bondT = P.deriveBondDuree;
      ev.push({ type: 'derive', sens: dr.sens });
    } else if (dr.arme >= P.deriveArmement || !possible) {
      // appui trop tôt, hors virage ou martelé : il faut relâcher, et le délai de réarmement repart
      dr.verrou = true; dr.relache = 0;
    }
  }

  function changer(etat, sens, ev) {
    etat.rapport += sens; etat.coupure = P.rapportDuree;
    ev.push({ type: 'rapport', rapport: etat.rapport, haut: sens > 0 });
  }

  // Grille et feux : la voiture ne bouge pas, le régime suit le gaz et rebondit sur le rupteur.
  function retenir(etat, gaz, dt, ev) {
    if (etat.derive.actif) eteindre(etat.derive);
    etat.v = 0; etat.omega = 0; etat.psi = 0; etat.beta = 0; etat.alat = 0; etat.along = 0; etat.chargeX = 0; etat.chargeY = 0;
    etat.glisse = 0; etat.glisseAv = 0; etat.glisseAr = 0; etat.sousVirage = 0; etat.patinage = 0; etat.blocage = 0;
    couperTurbo(etat); etat.rapport = 1; etat.coupure = 0;
    etat.derive.amorce = 0; etat.derive.melange = 0; etat.derive.tirage = 0;
    const cible = P.ralenti + (P.rupteur - P.ralenti) * gaz;
    etat.regime += (cible - etat.regime) * expTau(cible > etat.regime ? P.grilleMonteeTau : P.grilleDescenteTau, dt);
    if (etat.regime >= P.maxUtile) { etat.regime = P.maxUtile - P.rupteurRebond; ev.push({ type: 'rupteur' }); }
  }

  // Force longitudinale transmise par un essieu d'adhérence cap pour une demande fx : linéaire, puis saturée
  // vers P.glissement × cap (patinage ou blocage).
  function transmis(fx, cap) {
    if (cap <= 0) return 0;
    const a = Math.abs(fx) / cap;
    const t = a <= 0.85 ? a : 0.85 + (P.glissement - 0.85) * Math.tanh((a - 0.85) / (P.glissement - 0.85));
    return fx < 0 ? -t * cap : t * cap;
  }

  function rouler(etat, cmd, c, dt, gaz, frein, aide, guidage, ev) {
    const dr = etat.derive, m = P.masse;
    const e = B.circuit.echantillon(c, etat.s), k = e.courbure, v = etat.v;

    // Surface sous la voiture
    const demi = c.largeur / 2, ad = Math.abs(etat.d), cote = etat.d < 0 ? -1 : 1;
    let mu = P.muPiste, surf = 'piste';
    if (ad > demi) {
      if (ad <= demi + P.largeurVibreur && B.circuit.vibreurA(c, etat.s, cote)) { mu = P.muVibreur; surf = 'vibreur'; }
      else { mu = P.muHerbe; surf = 'herbe'; }
    }
    etat.surface = surf; etat.vibreur = surf === 'vibreur';
    // dégâts (Chantier 3) : une caisse abîmée perd de l'adhérence (jusqu'à −18 %) ; les débris et le capot
    // de côté la freinent (traînée jusqu'à +24 %, appliquée plus bas). Absents, rien ne change.
    const dg = etat.degats;
    if (dg) mu *= dg.adher;
    const enPiste = ad <= demi + P.largeurVibreur;

    // Dérive au bouton
    piloterDerive(etat, cmd, k, frein, surf, enPiste, dt, ev);
    // l'arrière passe en glisse par un fondu en S (deux filtres en cascade) ; le tirage de l'avant suit au
    // rythme du volant, pour que le contre-braquage ne creuse pas l'effort de l'avant au départ
    const cible = dr.actif ? 1 : 0, kM = expTau(dr.actif ? P.deriveEntree : P.deriveSortie, dt);
    dr.amorce += (cible - dr.amorce) * kM;
    dr.melange += (dr.amorce - dr.melange) * kM;
    dr.tirage += (cible - dr.tirage) * expTau(P.deriveTirageTau, dt);
    const bd = dr.melange < 1e-4 ? 0 : dr.melange, bt = dr.tirage < 1e-4 ? 0 : dr.tirage;
    const sensD = dr.actif ? dr.sens : sign(etat.beta);

    // Turbo : poussée à fondus, coupée par le frein, l'herbe et la sortie de piste
    const T = etat.turbo;
    if (T.reste > 0 && (frein >= P.deriveFreinMax || surf === 'herbe' || !enPiste)) couperTurbo(etat);
    let aTurbo = 0, envTurbo = 0;
    if (T.reste > 0) {
      T.ecoule += dt;
      const env = Math.min(lisse(T.ecoule / P.turboMontee), lisse(T.reste / P.turboDescente));
      envTurbo = env;
      aTurbo = P.turboAcc[T.niveau] * env * clamp((P.turboVMax - v) / 2, 0, 1);
      T.reste = T.reste - dt > 1e-9 ? T.reste - dt : 0;
      if (T.reste === 0) couperTurbo(etat);
    }
    T.poussee = aTurbo;

    // Boîte et régime
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
    // départ : en première, l'embrayage patine et tient le moteur haut tant que les roues ne l'ont pas rattrapé
    const lance = etat.rapport === 1 ? P.ralenti + (P.rupteur - P.ralenti) * P.lancement * gaz : 0;
    const cibleR = Math.max(brut, lance);
    etat.regime += (clamp(cibleR, P.ralenti, P.rupteur) - etat.regime) * expTau(lance > brut ? P.lancementTau : P.regimeTau, dt);
    // en sixième sous turbo, le moteur reste à fond au-delà de sa pointe sans couper
    const libre = aTurbo > 0 && etat.rapport === 6;
    const auRupteur = brut >= P.maxUtile && !libre;
    if (auRupteur && gaz > 0.05 && etat.rapport < 6 && etat.rupteurT <= 0) { ev.push({ type: 'rupteur' }); etat.rupteurT = P.rupteurCadence; }
    let aMot = gaz * POUSSEE[etat.rapport - 1] * couple(etat.regime);
    if (etat.coupure > 0 || auRupteur) aMot = 0;
    if (surf === 'herbe') aMot *= P.herbeMoteur;

    // Vitesses dans le repère de la caisse (u vers l'avant, w vers la droite)
    let u = v * Math.cos(etat.beta), w = -v * Math.sin(etat.beta), r = etat.omega;

    // Charges : statique, appui, transferts filtrés (accélérations des pneus du pas précédent)
    const appui = m * P.aero * v * v;
    const dx = m * etat.chargeX * P.hauteurCG / L;
    const dy = m * etat.chargeY * P.hauteurCG / P.voie;
    const fzAv = Math.max(0, m * G * P.repartition + appui * P.aeroAvant - dx);
    const fzAr = Math.max(0, m * G * (1 - P.repartition) + appui * (1 - P.aeroAvant) + dx);
    const tAv = dy * P.roulisAvant, tAr = dy * (1 - P.roulisAvant);
    const R = etat.roues;
    // virage à droite (chargeY > 0) : la charge passe sur les roues gauches
    R[0].charge = Math.max(0, fzAv / 2 + tAv); R[1].charge = Math.max(0, fzAv / 2 - tAv);
    R[2].charge = Math.max(0, fzAr / 2 + tAr); R[3].charge = Math.max(0, fzAr / 2 - tAr);
    const muAr = mu * P.gripArriere * (1 - (1 - P.deriveMuAr) * bd);
    const capAv = adherence(mu, R[0].charge) + adherence(mu, R[1].charge);
    const capAr = adherence(muAr, R[2].charge) + adherence(muAr, R[3].charge);
    etat.capAv = capAv; etat.capAr = capAr; etat.chargeAv = (fzAv + fzAr) > 0 ? fzAv / (fzAv + fzAr) : P.repartition;

    // Longitudinal : moteur et frein moteur à l'arrière, freins répartis
    const pied = 1 - gaz;
    const freinMoteur = u > 0.5 ? m * P.freinMoteur * pied : 0;
    const fFrein = frein * P.freinMax * P.muPiste * (m * G + appui) * (u > 0.05 ? 1 : 0);
    // Vitesses des essieux, dérive et adhérence de l'arrière. Au-delà du pic, un arrière qui glisse perd de
    // l'adhérence totale, partagée ensuite entre motricité et virage : sous le gaz, une glisse franche ne se rattrape
    // plus seule. En dérive au bouton, l'arrière suit une courbe adoucie, sans retombée.
    const ua = Math.max(Math.abs(u), 1);
    const angCG = Math.atan2(w, ua), angAv = Math.atan2(w + A * r, ua), angAr = Math.atan2(w - BR * r, ua);
    const alphaAr = -angAr, xAr = alphaAr / P.alphaAr;
    const capArG = capAr * (1 - (1 - retombee(xAr, P.chuteAr, P.chuteArLargeur)) * (1 - bd));
    let fAr = forme(xAr);
    if (bd > 0) fAr = (1 - bd) * fAr + bd * Math.tanh(alphaAr / P.deriveAlpha);
    // le turbo ne pousse qu'avec l'adhérence arrière que le virage laisse libre (1 − f², en deçà de l'ellipse
    // √(1 − f²)) et que le moteur n'a pas déjà prise : il accélère sans faire décrocher l'arrière
    const fMot = m * aMot;
    const fTurbo = Math.min(m * aTurbo, Math.max(0, capArG * (1 - fAr * fAr) - Math.max(0, fMot)));
    const demAr = fMot + fTurbo - freinMoteur - fFrein * (1 - P.freinAvant);
    const demAv = -fFrein * P.freinAvant;
    const fxAr = transmis(demAr, capArG), fxAv = transmis(demAv, capAv);
    etat.patinage = demAr > 0 ? rampe(demAr / Math.max(capArG, 1), 0.85, 1.15) : 0;
    etat.blocage = rampe(-Math.min(demAv / Math.max(capAv, 1), demAr / Math.max(capArG, 1)), 0.9, 1.2);
    const latAv = Math.sqrt(Math.max(0, capAv * capAv - fxAv * fxAv));
    // Sous la poussée, l'arrière perd plus d'adhérence latérale que ne le dit l'ellipse (exposant ellipseMotrice) ;
    // en dérive au bouton et sous turbo, l'ellipse reste entière : le turbo est déjà borné par ce qu'elle laisse.
    const nM = P.ellipseMotrice + (2 - P.ellipseMotrice) * Math.max(bd, envTurbo);
    const latAr = fxAr > 0 && nM < 2
      ? capArG * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, fxAr / Math.max(capArG, 1)), nM)), 1 / nM)
      : Math.sqrt(Math.max(0, capArG * capArG - fxAr * fxAr));

    // Direction : le volant (après aide et guidage) commande une part de l'adhérence avant.
    let rho = etat.volant;
    // le guidage du clavier s'efface vers le plein volant : plein volant = braquageMax(v), comme pour l'IA
    if (guidage > 0) rho = clamp(rho + guidage * (1 - Math.abs(rho)) * volantPour(etat, k / Math.max(1 - k * etat.d, 0.3)), -1, 1);
    // aide au volant : quand l'arrière décroche (nez vers l'intérieur au-delà du seuil), la consigne vers
    // l'intérieur s'efface et un contre-braquage s'ajoute ; inactive pendant une dérive au bouton
    if (aide > 0 && bd < 0.5) {
      const exces = rampe(Math.abs(etat.beta), P.aideSeuil, P.aideSeuil + P.aidePlage) * aide * (1 - 2 * bd);
      if (exces > 0) {
        const sb = sign(etat.beta);
        if (rho * sb > 0) rho *= 1 - Math.min(1, P.aideGain * exces);
        rho -= sb * exces * P.aideGain * 0.5 + P.aideLacet * aide * r * (1 - 2 * bd);
      }
    }
    if (bt > 0) rho += bt * sensD * P.deriveTirage;
    rho = clamp(rho, -1 - P.deriveTirage, 1 + P.deriveTirage);
    // la direction suit la vitesse du centre de gravité (contre-braquage naturel des glisses) ; le lacet, vu de
    // l'avant, reste dans la dérive du pneu et amortit la rotation
    const amaxAv = capAv * L / (m * BR);
    // amortisseur de glisse : quand la caisse tourne plus vite que sa trajectoire (dérapage qui grandit), l'avant
    // rend une part de son effort ; nul en virage établi. Il lâche quand l'arrière glisse franchement : la glisse
    // se rattrape alors au volant, en levant le pied ou par l'aide. La dérive au bouton et son turbo le gardent.
    const lache = rampe(Math.abs(xAr), P.amortSeuil, P.amortSeuil + P.amortPlage) * (1 - Math.max(bd, envTurbo));
    const glisseLacet = r - etat.alat / ua;
    rho -= suivi(v) * P.amortGlisse * (1 - lache) * (1 - (1 - P.deriveAmort) * bd) * glisseLacet * Math.max(v, 1) / Math.max(amaxAv, 1);
    let delta = suivi(v) * angCG + braquer(rho, v, amaxAv);
    delta = clamp(delta, -P.braquageMeca, P.braquageMeca);
    etat.braquage = delta;

    // Pneus : dérives et forces latérales (fAr et la retombée de l'arrière, dans capArG, sont calculées plus haut)
    const sgnU = u >= 0 ? 1 : -1;
    const alphaAv = delta * sgnU - angAv;
    const fyAv = latAv * pneu(alphaAv / P.alphaAv), fyAr = latAr * fAr;
    etat.deriveAv = alphaAv; etat.deriveAr = alphaAr;

    // Forces dans le repère de la caisse
    const cd = Math.cos(delta), sd = Math.sin(delta);
    let fx = fxAv * cd - fyAv * sd + fxAr, fy = fxAv * sd + fyAv * cd + fyAr;
    const mz = A * (fxAv * sd + fyAv * cd) - BR * fyAr;
    const axPneus = fx / m, ayPneus = fy / m;
    // air, roulement, herbe : opposés au mouvement
    const vv = Math.hypot(u, w);
    let resist = P.coeffTrainee * (1 - P.aspirationMax * clamp(etat.aspiration, 0, 1)) * vv * vv;
    if (vv > 0.1) resist += P.roulement;
    if (surf === 'herbe' && vv > 0.1) resist += P.herbeResist + P.herbeResistV * vv;
    if (dg) { resist *= dg.trainee; if (B.degats && B.degats.uneRouePerdue(dg)) resist += 0.02 * vv; }
    if (vv > 1e-6) { fx -= m * resist * u / vv; fy -= m * resist * w / vv; }
    // pente et dévers : gravité le long de la tangente et vers la droite de la piste
    const thetaB = etat.psi + etat.beta, ct = Math.cos(thetaB), st = Math.sin(thetaB);
    const pente = Number.isFinite(e.pente) ? e.pente : 0, devers = Number.isFinite(e.devers) ? e.devers : 0;
    const gT = -G * pente / Math.sqrt(1 + pente * pente), gN = G * Math.sin(devers);
    etat.pente = pente;
    fx += m * (gT * ct + gN * st); fy += m * (-gT * st + gN * ct);

    // Intégration semi-implicite : vitesses, puis positions
    const u0 = u;
    u += (fx / m + w * r) * dt;
    w += (fy / m - u0 * r) * dt;
    r += mz / IZ * dt;
    // ni marche arrière ni recul : sans moteur, la voiture s'arrête au lieu de repartir en arrière
    if (u0 >= 0 && u < 0 && demAr <= 0) u = 0;
    // au pas, le mouvement se rapproche du roulement sans glisse
    const lk = rampe(Math.hypot(u, w), 1, 4);
    if (lk < 1) {
      const rCin = u * Math.tan(delta) / L, wCin = BR * rCin;
      r = lk * r + (1 - lk) * rCin; w = lk * w + (1 - lk) * wCin;
    }
    const vN = Math.hypot(u, w);
    if (vN < 0.02 && demAr <= 0) { u = 0; w = 0; r = 0; }
    etat.v = Math.hypot(u, w);
    // presque arrêtée, la vitesse n'a plus de direction : elle reprend celle de la caisse. Sinon une voiture arrêtée
    // caisse retournée (tête-à-queue), là où la poussée est faible (herbe), se reconstruit à reculons à chaque pas
    // et ne repart jamais.
    if (etat.v > 0.05) etat.beta = -Math.atan2(w, u); else etat.beta = 0;
    etat.omega = r;
    etat.along = axPneus; etat.alat = ayPneus;
    const kc = expTau(P.chargeTau, dt);
    etat.chargeX += (axPneus - etat.chargeX) * kc;
    etat.chargeY += (ayPneus - etat.chargeY) * kc;

    // Cinématique de Frenet : la caisse tourne de r, la piste de k·ds
    const den = Math.max(1 - k * etat.d, 0.1);
    const psiV = angle(thetaB - etat.beta);
    const dsdt = etat.v * Math.cos(psiV) / den;
    const thetaN = angle(thetaB + (r - k * dsdt) * dt);
    etat.psi = angle(thetaN - etat.beta);
    const dsdt2 = etat.v * Math.cos(etat.psi) / den;
    etat.s = ramener(etat.s + dsdt2 * dt, c.longueur);
    etat.d += etat.v * Math.sin(etat.psi) * dt;
    etat.distance += Math.abs(dsdt2) * dt;

    // Glissière (Chantier 3) : le choc dépend de l'angle d'attaque et de la vitesse ; la caisse (emprise
    // 4,95 × 2,02 m) ne franchit jamais le rail, quel que soit son cap, et n'est jamais renvoyée de l'autre
    // côté de l'axe. Un frôlement rasant (< 8°) garde l'essentiel de la vitesse ; un mur plein à plus de
    // 100 km/h (au-delà de 35°) est un accident.
    const cdg = etat.d < 0 ? -1 : 1;
    const capRel = etat.psi + etat.beta;
    const emprise = (P.caissel / 2) * Math.abs(Math.cos(capRel)) + (P.caisseL / 2) * Math.abs(Math.sin(capRel));
    const lim = limiteCote(c, etat.s, cdg);
    const bord = Math.max(0.2, lim - emprise);   // au-delà, un coin de la caisse passerait le rail
    if (Math.abs(etat.d) > bord) {
      const vAvant = etat.v, ang = Math.abs(angle(etat.psi)), versMur = cdg * etat.psi > 0;
      const premier = !etat.auRail && etat.choc <= 0;   // vrai premier contact, pas le frottement continu le long du rail
      if (versMur && ang > P.glissAccident && etat.v >= P.glissVAccident) {
        etat.d = cdg * bord;
        ev.push({ type: 'choc', force: vAvant });
        declencherAccident(etat, {});
        annuler(etat, ev);
      } else if (versMur && ang >= P.glissRasant) {
        // choc de trois-quarts : la caisse rebondit et SE DÉGAGE du rail (cap renvoyé vers la piste), au lieu de rester collée
        etat.d = cdg * bord;
        etat.psi = -cdg * Math.min(Math.abs(etat.psi) * 0.2 + 0.02, 0.09, bord / Math.max(vAvant, 1));   // rebond vers la piste, limité par la largeur libre
        etat.v *= 1 - P.chocRebond * Math.sin(ang);
        etat.omega *= 0.4;
        if (premier && vAvant - etat.v >= P.chocSeuil) { ev.push({ type: 'choc', force: vAvant - etat.v }); etat.choc = P.chocDuree; }
        annuler(etat, ev);
      } else {
        // frôlement le long du rail : on longe en gardant la vitesse ; au ralenti la caisse se dégage du mur pour repartir
        etat.d = cdg * Math.min(Math.abs(etat.d), bord);
        etat.v = Math.max(0, etat.v - P.glissFrottementRasant * dt);
        if (etat.v < 2) etat.d = cdg * Math.max(0, Math.abs(etat.d) - 0.6 * dt);
      }
      etat.auRail = true;
    } else etat.auRail = false;
    if (etat.choc > 0) etat.choc -= dt;

    // Glisse par essieu et par roue, pour le son et les effets
    const gAv = rampe(Math.abs(alphaAv) / P.alphaAv, 0.8, 1.6);
    const gAr = Math.max(rampe(Math.abs(alphaAr) / P.alphaAr, 0.8, 1.6), etat.patinage);
    etat.glisseAv = Math.max(gAv, etat.blocage); etat.glisseAr = Math.max(gAr, etat.blocage);
    const pAv = Math.max(fzAv, 1), pAr = Math.max(fzAr, 1);
    R[0].glisse = etat.glisseAv * clamp(2 * R[0].charge / pAv, 0, 1); R[1].glisse = etat.glisseAv * clamp(2 * R[1].charge / pAv, 0, 1);
    R[2].glisse = etat.glisseAr * clamp(2 * R[2].charge / pAr, 0, 1); R[3].glisse = etat.glisseAr * clamp(2 * R[3].charge / pAr, 0, 1);
    etat.sousVirage = Math.max(0, Math.abs(alphaAv) / P.alphaAv - 1);
    etat.glisse = etat.v > 3 ? clamp(Math.max(etat.glisseAv, etat.glisseAr), 0, 1) : 0;
  }

  // Volant (part de l'adhérence avant) qui tient une trajectoire de courbure kp en régime établi, à la vitesse
  // actuelle : partagé par l'IA et le guidage du clavier.
  function volantPour(etat, kp) {
    const v = Math.max(etat.v, 1), m = P.masse;
    const cap = etat.capAv > 0 ? etat.capAv : P.muPiste * (m * G * P.repartition + m * P.aero * v * v * P.aeroAvant);
    return clamp(m * v * v * kp * (BR / L) / Math.max(cap, 1), -1, 1);
  }

  function poserAttitude(etat, c, dt) {
    const e = B.circuit.echantillon(c, etat.s), kA = expTau(P.attitudeTau, dt);
    // sol sous la voiture, même profil que le décor : dévers sur la piste, vibreur, accotement à 2 %
    const w = c.largeur / 2, ad = Math.abs(etat.d);
    etat.y = e.y - clamp(etat.d, -w, w) * Math.sin(e.devers);
    if (ad > w + P.largeurVibreur) etat.y -= 0.015 + 0.02 * (ad - w - P.largeurVibreur);
    else if (ad > w) etat.y += (etat.vibreur ? 0.05 : -0.015) * (ad - w) / P.largeurVibreur;
    // petit bond au départ d'une dérive
    if (etat.bondT > 0) {
      etat.bondT = Math.max(0, etat.bondT - dt);
      const t = 1 - etat.bondT / P.deriveBondDuree;
      etat.bond = 4 * P.deriveBond * t * (1 - t);
    } else etat.bond = 0;
    etat.y += etat.bond;
    const tang = Math.atan(e.pente) + clamp(P.tangageCoef * etat.chargeX, -P.tangageMax, P.tangageMax);
    const roul = e.devers + clamp(-P.roulisCoef * etat.chargeY, -P.roulisMax, P.roulisMax);
    etat.tangage += (tang - etat.tangage) * kA;
    etat.roulis += (roul - etat.roulis) * kA;
  }

  // Volant filtré : montée un peu plus douce à haute vitesse, retour et contre-braquage vifs.
  function filtrerVolant(etat, cible, dt) {
    const x = etat.volant;
    const retour = cible * x < 0 || Math.abs(cible) < Math.abs(x);
    const tau = retour ? P.volantRetour : P.volantMontee + P.volantMonteeV * etat.v;
    etat.volant = x + (cible - x) * expTau(tau, dt);
    if (Math.abs(etat.volant) < 1e-6) etat.volant = 0;
  }

  // ---------------------------------------------------------------- Chantier 3 : vol (saut) et accident
  // Lancer un saut (petit bond ou grand arc). `o` = { grand, h, duree, tangV, roulV, pouss, omega }. Appelé par
  // contacts.js quand deux roues se frôlent. La hauteur de décollage est prise à l'état du sol du moment.
  function lancerSaut(etat, o = {}) {
    const grand = !!o.grand;
    etat.saut = {
      actif: true, t: 0, grand,
      duree: o.duree || (grand ? P.sautDuree : P.bondDuree),
      h: o.h != null ? o.h : (grand ? P.sautH : P.bondH),
      ySol: etat.y, tang0: etat.tangage, roul0: etat.roulis,
      tangV: o.tangV || 0, roulV: o.roulV || 0, pouss: o.pouss || 0, contre: 0
    };
    if (o.omega) etat.omega = o.omega;
    annuler(etat, []); // plus de dérive ni de turbo pendant le vol
  }

  // Déclencher un accident : la caisse n'obéit plus, freine et revient seule sur le revêtement, puis immunité.
  function declencherAccident(etat, o = {}) {
    if (etat.accident) return;
    etat.saut = null; etat.reparation = null;
    etat.accident = { t: 0, duree: o.duree || P.accidentDuree, d0: etat.d, reception: !!o.reception };
    annuler(etat, []);
  }

  // Vol : arc parabolique, tangage et roulis qui tournent, peu de direction ; à la réception, la vitesse garde
  // 100 % / 97 % / 94 % selon le contre-braquage, et au-delà d'une limite d'attitude c'est l'accident.
  function voler(etat, cmd, c, dt, ev) {
    const s = etat.saut; s.t += dt;
    // contre-braquage : on retient si le pilote braque à l'opposé de la poussée reçue (moyenne glissante sur le vol)
    const cB = s.pouss ? -Math.sign(s.pouss) * etat.volant : 0;
    s.contre += (cB - s.contre) * clamp(dt / s.duree, 0, 1);
    // en l'air, on dirige peu : le lacet pris au décollage se poursuit, le volant n'a qu'une faible emprise
    const rCible = etat.volant * P.volBraquage * (etat.v > 1 ? 0.5 : 0);
    etat.omega += (rCible - etat.omega) * (1 - Math.exp(-dt / 0.5));
    // légère traînée d'air, jamais de gain
    etat.v = Math.max(0, etat.v - P.volTrainee * etat.v * etat.v * dt);
    // cinématique de Frenet, comme au sol, pour que cap et position restent continus
    const e = B.circuit.echantillon(c, etat.s), k = e.courbure;
    const den = Math.max(1 - k * etat.d, 0.1);
    const psiV = angle(e.cap - etat.beta);
    const dsdt = etat.v * Math.cos(psiV) / den;
    etat.s = ramener(etat.s + etat.v * Math.cos(etat.psi) / den * dt, c.longueur);
    etat.d += etat.v * Math.sin(etat.psi) * dt;
    etat.psi = angle(etat.psi + etat.omega * dt);
    // hauteur et attitude
    const p = clamp(s.t / s.duree, 0, 1);
    etat.y = s.ySol + s.h * 4 * p * (1 - p);
    etat.tangage = s.tang0 + s.tangV * s.t;
    etat.roulis = s.roul0 + s.roulV * s.t;
    if (s.t < s.duree) return;
    // réception
    if (Math.abs(etat.tangage) > P.sautTangLim || Math.abs(etat.roulis) > P.sautRoulLim) {
      etat.saut = null; declencherAccident(etat, { reception: true });
      ev.push({ type: 'tonneau' });
      return;
    }
    const corr = s.contre >= P.contreBon ? 1 : (s.contre <= P.contreMauvais ? 0.94 : 0.97);
    etat.v *= corr; // jamais de gain : corr ≤ 1
    etat.saut = null;
    etat.bondT = P.deriveBondDuree; // petit écrasement visuel à l'atterrissage
    ev.push({ type: 'reception', corr, force: (1 - corr) * etat.v, bon: corr >= 1, grand: s.grand });
  }

  // Accident et retour progressif : la caisse freine, garde cap et vitesse continus, revient seule sur le
  // revêtement (d ramené à 0 sans à-coup), puis roule avec 2 s d'immunité.
  function accidenter(etat, c, dt, ev) {
    const a = etat.accident; a.t += dt;
    const p = clamp(a.t / a.duree, 0, 1);
    // vitesse continue : on freine sans à-coup, sans jamais descendre sous une vitesse de réinsertion
    etat.v = Math.max(6, etat.v - P.accidentFrein * dt - P.coeffTrainee * etat.v * etat.v * dt);
    // cap ramené doucement à la piste (continu), lacet qui suit
    etat.psi += (0 - etat.psi) * (1 - Math.exp(-dt / 0.7));
    etat.omega += (0 - etat.omega) * (1 - Math.exp(-dt / 0.7));
    // position latérale revenue à la trajectoire sans discontinuité (dérivée nulle à la fin)
    etat.d = a.d0 * (1 - p) * (1 - p);
    const e = B.circuit.echantillon(c, etat.s), den = Math.max(1 - e.courbure * etat.d, 0.1);
    etat.s = ramener(etat.s + etat.v * Math.cos(etat.psi) / den * dt, c.longueur);
    // attitude qui se pose, sol sous la caisse
    etat.tangage *= Math.exp(-dt / 0.5); etat.roulis *= Math.exp(-dt / 0.5);
    etat.y = e.y - clamp(etat.d, -c.largeur / 2, c.largeur / 2) * Math.sin(e.devers);
    if (a.t >= a.duree) {
      etat.accident = null; etat.immunite = P.accidentImm;
      if (etat.degats && B.degats) B.degats.reparer(etat.degats);   // caisse réparée au retour en piste
      etat.d = 0; etat.psi = 0; etat.omega = 0; etat.tangage = 0; etat.roulis = 0;
      ev.push({ type: 'retour' });
    }
  }

  // Roue perdue (vroom original) : plus de direction ni de motricité, la caisse s'immobilise, répare lentement à
  // l'arrêt, puis se fait repositionner sur la route — un remplacement lent qui pénalise le temps de course.
  function reparerRoue(etat, c, dt, ev) {
    const rp = etat.reparation, e = B.circuit.echantillon(c, etat.s);
    if (rp.phase === 'arret') {
      // on ne dirige plus, on n'a plus de motricité : la caisse roule en ligne et freine jusqu'à l'arrêt
      etat.v = Math.max(0, etat.v - P.rouePerdueFrein * dt - P.rouePerdueTraine * etat.v * etat.v * dt);
      const den = Math.max(1 - e.courbure * etat.d, 0.1);
      etat.s = ramener(etat.s + etat.v * Math.cos(etat.psi) / den * dt, c.longueur);
      etat.d += etat.v * Math.sin(etat.psi) * dt;
      const cdg = etat.d < 0 ? -1 : 1, lim = limiteCote(c, etat.s, cdg);
      if (Math.abs(etat.d) > lim) etat.d = cdg * lim;
      etat.tangage *= Math.exp(-dt / 0.5); etat.roulis *= Math.exp(-dt / 0.5);
      etat.y = e.y - clamp(etat.d, -c.largeur / 2, c.largeur / 2) * Math.sin(e.devers);
      if (etat.v < 0.8) { etat.v = 0; rp.phase = 'stand'; rp.t = 0; annuler(etat, ev); ev.push({ type: 'reparation' }); }
    } else {
      // réparation lente à l'arrêt, puis repositionnement progressif sur la route (roue remise, caisse remise à neuf)
      etat.v = 0; rp.t += dt;
      etat.y = e.y - clamp(etat.d, -c.largeur / 2, c.largeur / 2) * Math.sin(e.devers);
      if (rp.t >= P.reparationDuree) {
        if (etat.degats && B.degats) B.degats.reparer(etat.degats);
        etat.reparation = null;
        declencherAccident(etat, { duree: 2.8 });
        ev.push({ type: 'repare' });
      }
    }
  }

  // cmd = { gaz, frein, volant, derive, haut, bas, boite: 'auto'|'manuelle', aide, guidage }
  function pas(etat, cmd, c, dt, retenue = false) {
    const ev = [];
    const gaz = borne01(cmd.gaz), frein = borne01(cmd.frein), aide = borne01(cmd.aide), guidage = borne01(cmd.guidage);
    etat.gaz = gaz; etat.frein = frein;
    filtrerVolant(etat, clamp(+cmd.volant || 0, -1, 1), dt);
    if (etat.immunite > 0) etat.immunite = Math.max(0, etat.immunite - dt);
    if (etat.accident) { accidenter(etat, c, dt, ev); return ev; }
    if (etat.saut && etat.saut.actif) { voler(etat, cmd, c, dt, ev); return ev; }
    // une roue manquante met la caisse hors d'état de rouler : arrêt, réparation lente, repositionnement
    if (!etat.reparation && etat.degats && B.degats && B.degats.uneRouePerdue(etat.degats)) {
      etat.reparation = { phase: 'arret', t: 0 }; annuler(etat, ev);
    }
    if (etat.reparation) { reparerRoue(etat, c, dt, ev); return ev; }
    if (retenue) retenir(etat, gaz, dt, ev);
    else rouler(etat, cmd, c, dt, gaz, frein, aide, guidage, ev);
    poserAttitude(etat, c, dt);
    return ev;
  }

  B.conduite = {
    PARAMS, creer, pas, annulerDerive, couperTurbo, cap, kmh, couple, limiteCote, braquageMax, volantPour,
    capaciteLaterale, pneu, lancerSaut, declencherAccident
  };
})(globalThis.BITUME = globalThis.BITUME || {});
