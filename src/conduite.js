// Node consumers retain the direct-load contract; browsers load the explicit build dependency.
if(typeof module!=='undefined'&&module.exports&&!globalThis.FVehicleDynamics)require('./ferro/vehicle-dynamics.js');
// De même pour la loi de pneu (src/pneu.js, lot 17) : déjà chargée (cache de Node), elle est rendue par son module.
if(typeof module!=='undefined'&&module.exports&&!(globalThis.BITUME&&globalThis.BITUME.pneu))(globalThis.BITUME=globalThis.BITUME||{}).pneu=require('./pneu.js');
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
  // Lot 17B, Claude (18/11/2026), docs/reprise/17-CONDUITE.md § 3.1, 3.2, 3.4 et 3.8 : châssis de la 312 T5
  // (665 kg, empattement 2,70 m, voies 1,70 / 1,615 m) ; charge normale selon la pente, le dévers et la courbure
  // verticale (un creux plaque la voiture, une crête l'allège), transferts en partie immédiats ; loi de pneu p10 par
  // roue (src/pneu.js) : adhérence en puissance de la charge, angle du pic qui croît avec la charge, plateau après le
  // pic (avant 85 %, arrière 76 %) atteint avec un retard de 0,15 s ; amortisseur de glisse plus fort à haute vitesse ;
  // une crête franchie trop vite fait décoller la voiture (sous 10 % du poids, appui compris). Le couplage longitudinal
  // (ellipse de motricité, `transmis`) et la force de freinage restent ceux de p9 jusqu'aux lots 17C et 17D.
  // Conventions : d > 0 à droite ; psi (axe de vitesse positive sur la tangente), beta (caisse − axe) et omega
  // (lacet de la caisse) > 0 vers la droite ; v est signée (recul<0), la caisse garde le cap psi+beta.
  // Tangage > 0 nez levé ; roulis > 0 côté droit plus bas.

  const G = 9.81;
  const PARAMS = Object.freeze({
    // châssis (§ 3.1) : monoplace de 1980, la 312 T5, 665 kg pilote compris (carburant non modélisé) ; voies avant et
    // arrière ; giration (garde l'indice dynamique k²/(a·b) 0,84 de p9 ; 1,30 rendait S7 mais rapprochait l'épave
    // du contact, rapport 17B) ; part du
    // roulis sur l'avant ; transferts : une part immédiate (géométrique, centres de roulis), le reste élastique, retardé
    // de chargeTau (s) ; courbure verticale du profil (bosses, crêtes, creux) lissée sur courbureVLissage mètres
    masse: 665, empattement: 2.70, repartition: 0.44, hauteurCG: 0.33, voieAv: 1.70, voieAr: 1.615, giration: 1.23,
    roulisAvant: 0.55, chargeTau: 0.062, transfertImmediat: 0.3, courbureVLissage: 6,
    // air : appui (m/s² par (m/s)²), part de l'appui sur l'avant, traînée, roulement, aspiration
    aero: 0.0016, aeroAvant: 0.45, coeffTrainee: 0.00059, roulement: 0.25, aspirationMax: 0.35,
    // pneus (§ 3.2, loi de src/pneu.js) : adhérence à la charge statique d'une roue de l'essieu, sensibilité à la charge
    // (adhérence en (Fz/Fz0)^−q), adhérence arrière, angles du pic à la charge statique (rad : 5,2° et 4,9°) et leur
    // exposant de charge, retombée après le pic vers le plateau 1 − c (largeur l ; 85 % devant, 76 % derrière),
    // mémoire du pic (la perte arrive en picTau secondes, l'adhérence revient aussitôt), relaxation (longueur σ en m,
    // 0 : sans ; vitesse plancher, m/s ; gardée parce qu'elle adoucit S8 sans rien casser, § 3.4). Valeurs réglées au
    // banc en 17B (docs/reprise/rapports/conduite-2026-11-18/17B-CHASSIS-PNEUS.md).
    muPiste: 1.85, muVibreur: 1.70, muHerbe: 1.01, sensibiliteQ: 0.22, gripArriere: 1.05,
    alphaAv: 0.090757, alphaAr: 0.085521, picCharge: 0.10,
    chute: 0.15, chuteLargeur: 1.0, chuteAr: 0.24, chuteArLargeur: 1.0, picTau: 0.15, relaxation: 0.3, relaxationV: 5,
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
    // freins : part de l'adhérence totale à pleine pédale, adhérence de référence de la pédale (celle de p9, gardée
    // jusqu'au lot 17D : même force de freinage), part de l'avant
    freinMax: 0.92, freinMu: 1.72, freinAvant: 0.58,
    // direction : le volant commande une part de l'adhérence avant ; plein volant au pic ; amortisseur de glisse
    // (§ 3.8) amortGlisse jusqu'à amortV0 (m/s), amortGlisseV au-delà de amortV1, lâché entre amortSeuil et
    // amortSeuil + amortPlage fois la dérive arrière au pic
    braquageMeca: 0.38, marge: 1.0, vSuivi0: 2, vSuivi1: 6, amortGlisse: 0.5, amortGlisseV: 0.62, amortV0: 30, amortV1: 60,
    amortSeuil: 3.0, amortPlage: 0.5,
    volantMontee: 0.030, volantMonteeV: 0.0002, volantRetour: 0.026,
    // aide au volant : rattrape les glisses (niveaux 0,35 et 0,7)
    aideSeuil: 0.062, aidePlage: 0.118, aideGain: 2.15, aideLacet: 0.28,
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
    // qualité de la dérive : contre-braquage (nul, plein, au-delà) et angle de caisse (rad) qui comptent ; 17B : bas de
    // la fenêtre d'angle 0,02 → 0,025 rad (avec p10, l'arrière trop contré revient vers 2,2° et la dérive tenait encore)
    deriveContreQ: Object.freeze([0.10, 0.22, 0.78]), deriveContreTrop: 0.30, deriveAngleQ: Object.freeze([0.025, 0.06, 0.66, 0.84]),
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
    decollage: 0.10, volMax: 2.0,                          // crête : décolle sous 10 % du poids (appui compris) ; vol ≤ 2 s
    accidentDuree: .65, accidentImm: 1, accidentFrein: 3.2, // remise en piste rapide, puis immunité
    // Paramètres historiques conservés ; la roue perdue utilise désormais le retour rapide.
    rouePerdueBraquage: 0.06, rouePerdueTraine: 0.05, rouePerdueLacet: 0.7, rouePerdueFrein: 9,
    reculAttente: .3, reculMax: 12 / 3.6, reculAcc: 3.5, reculFrein: 8,
    reparationDuree: .65                                       // délai court de remise en piste
  });
  const P = PARAMS;
  // accélération moteur maximale de chaque rapport : 13 × (27 / vitesse de pointe)^0,8
  const POUSSEE = P.vitessePointe.map(v => P.coeffMoteur * Math.pow(27 / v, 0.8));
  // géométrie tirée des constantes
  const L = P.empattement, A = L * (1 - P.repartition), BR = L * P.repartition; // CG → avant, CG → arrière
  const IZ = P.masse * P.giration * P.giration;
  // charge statique d'une roue de chaque essieu (N) : la loi de pneu y norme la charge (§ 3.2)
  const FZ0AV = P.masse * G * P.repartition / 2, FZ0AR = P.masse * G * (1 - P.repartition) / 2;

  // Shared FERRO force equations; this adapter owns vehicle tuning and world coordinates.
  const FVD=FVehicleDynamics.create(P);
  const {clamp,borne01,sign,expTau,ramener,angle,rampe,regimeBrut,couple,consigne,suivi,capaciteLaterale,geometrie,braquageMax}=FVD;
  // Loi de pneu p10 (src/pneu.js, lot 17) : fonctions pures, sans création d'objet.
  const {forceMax,alphaPic,chute,courbe,courbeAvec,suivreChute,relaxer}=B.pneu;
  // courbe normalisée de l'avant (x = dérive / dérive au pic), exportée comme en p9
  function pneu(x) { return courbe(x, P.chute, P.chuteLargeur); }
  // Braquage (rad) par rapport à la vitesse du centre de gravité pour une part rho de l'adhérence avant : `braquer`
  // de FERRO, avec l'angle du pic de l'avant du moment (il croît avec la charge, § 3.2) au lieu de celui de la charge
  // statique. braquageMax (FERRO, pour l'IA et les critères) garde celui de la charge statique.
  function braquerPic(rho, v, amax, pic) {
    const l = suivi(v), x = consigne(rho);
    return l * (rho * geometrie(v, amax) + x * pic) + (1 - l) * clamp(rho, -1, 1) * P.braquageMeca;
  }

  // Filtres de constante de temps fixe : au pas fixe, expTau(tau, dt) redonne la même valeur pour chaque voiture et
  // à chaque pas (un Math.exp chaque fois). Elle est retenue pour le dernier dt vu : même fonction, mêmes entrées,
  // donc mêmes bits qu'un calcul neuf. Une mémoire par constante : [dt, valeur].
  const memoTau = () => new Float64Array([NaN, 0]);
  function expTauFixe(m, tau, dt) { if (m[0] !== dt) { m[1] = expTau(tau, dt); m[0] = dt; } return m[1]; }
  const TAU = {
    contre: memoTau(), grilleMontee: memoTau(), grilleDescente: memoTau(), entree: memoTau(), sortie: memoTau(),
    tirage: memoTau(), lancement: memoTau(), regime: memoTau(), charge: memoTau(), attitude: memoTau(), retour: memoTau(),
    pic: memoTau()
  };
  // § 3.5 — Moteur, boîte, roues motrices
  const MOTEUR = {
    T_max: 216,          // N·m (niveau actuel ; fidèle = 320)
    eta: 0.90,           // rendement transmission
    c0: 15,              // N·m frein moteur constant
    c1: 0.0030,          // N·m/(tr/min) frein moteur proportionnel
    J_mot: 0.15,         // kg·m² inertie moteur
    J_roue: 1.0,         // kg·m² inertie d'une roue
    coupure: 0.08,       // s coupure au passage de rapport
    rupteur: 13000,      // tr/min
    lancement: 11000,    // tr/min
    // τ(n) : (tr/min ; coefficient)
    tauPts: [[4000,0.62],[7000,0.80],[8500,0.95],[10500,1.0],[12300,0.93],[12800,0.80]],
    // NMAX par rapport (1→6)
    NMAX: [3.70, 2.60, 1.95, 1.50, 1.20, 1.00],
    // vPointe_k par rapport (km/h) — dérivé de NMAX et R_ar
    vPointe: [85, 125, 165, 210, 260, 310],
  };
  function tauMoteur(n) {
    const pts = MOTEUR.tauPts;
    if (n <= pts[0][0]) return pts[0][1];
    if (n >= pts[pts.length-1][0]) return pts[pts.length-1][1];
    for (let i = 0; i < pts.length - 1; i++) {
      if (n <= pts[i+1][0]) {
        const t = (n - pts[i][0]) / (pts[i+1][0] - pts[i][0]);
        return pts[i][1] + t * (pts[i+1][1] - pts[i][1]);
      }
    }
    return pts[pts.length-1][1];
  }
  function coupleMoteur(gaz, n) {
    const nClamp = clamp(n, 0, MOTEUR.rupteur);
    const tau = tauMoteur(nClamp);
    return gaz * MOTEUR.T_max * tau - (1 - gaz) * (MOTEUR.c0 + MOTEUR.c1 * nClamp);
  }
  // Lectures du tracé : un objet par appelant, rempli à chaque lecture (B.circuit.echantillon, troisième argument).
  // Chaque appelant lit sa valeur rendue, jamais l'objet directement : un tracé de test peut rendre un objet neuf.
  const LU = { cap: {}, rail: {}, rouler: {}, attitude: {}, replacer: {}, vol: {}, reculA: {}, reculB: {}, reliefA: {}, reliefB: {}, envolA: {}, aero: {
    SCz: 1.9,
    rhoAir: 1.225,
    aeroAvant: 0.42,
    kT: 0.015,
    aspirationTrainee: 0.25,
    perteAppuiAv: 0.20,
    perteAppuiAr: 0.08,
    porteeAspiration: 30,
    porteeSale: 40
  } };

  // Courbure verticale du profil (rad/m), > 0 dans un creux, < 0 sur une crête : variation de l'angle de la pente sur
  // courbureVLissage mètres centrés sur s (deux lectures du tracé), ce qui lisse les raccords et les petites bosses.
  function courbureVerticale(c, s) {
    const h = P.courbureVLissage / 2;
    if (!(h > 0)) return 0;
    const a = B.circuit.echantillon(c, ramener(s - h, c.longueur), LU.reliefA).pente;
    const b = B.circuit.echantillon(c, ramener(s + h, c.longueur), LU.reliefB).pente;
    return (Math.atan(Number.isFinite(b) ? b : 0) - Math.atan(Number.isFinite(a) ? a : 0)) / (2 * h);
  }

  function creer(s, d) {
    return {
      s: s, d: d, psi: 0, beta: 0, v: 0, omega: 0,
      rapport: 1, regime: P.ralenti, volant: 0, gaz: 0, frein: 0, braquage: 0,
      surface: 'piste', vibreur: false, glisse: 0, alat: 0, along: 0,
      chargeX: 0, chargeY: 0, chargeAv: P.repartition, capAv: 0, capAr: 0,
      // avant gauche, avant droite, arrière gauche, arrière droite ; chute : retombée de la roue après le pic, retenue
      roues: [0, 1, 2, 3].map(() => ({ charge: 0, glisse: 0, chute: 0 })),
      // dérives des essieux (rad) et rapportées à l'angle du pic de l'essieu (x)
      glisseAv: 0, glisseAr: 0, deriveAv: 0, deriveAr: 0, xAv: 0, xAr: 0, patinage: 0, blocage: 0, aspiration: 0, pente: 0,
      derive: {
        actif: false, sens: 0, duree: 0, charge: 0, niveau: 0, palier: 0, fenetre: 0, qualite: 0, contre: 0,
        perte: 0, grace: 0, amorce: 0, melange: 0, tirage: 0, verrou: false, arme: 0, relache: P.deriveRearmement
      },
      turbo: { reste: 0, niveau: 0, parfait: false, duree: 0, ecoule: 0, poussee: 0 },
      bond: 0, bondT: 0, choc: 0, distance: 0, tangage: 0, roulis: 0, y: 0,
      coupure: 0, rupteurT: 0, sousVirage: 0,
      // Chantier 3 : vol (saut), accident et retour en piste, immunité, dégâts — tous inactifs au départ, la
      // conduite reste exactement celle des critères quand ils sont absents (tests de conduite sans ces modules)
      saut: null, accident: null, immunite: 0, degats: null, reparation: null, stands: null, standsSortie: false, recuperation: null,
      freinRecul: 0, repositionnements: 0, choc: 0, auRail: false
    };
  }

  // Pneus (David, 16/11 : « choisir les pneus, présélectionnés selon le climat, ça évite de glisser sous la pluie »).
  // Adhérence relative selon l'eau sur la piste w (0 sec, 1 détrempée) : [sur le sec, pente avec w]. Les slicks sont
  // les meilleurs au sec et glissent sous la pluie ; les pneus pluie chauffent et se déforment au sec ; les
  // intermédiaires tiennent l'entre-deux. Meilleur choix : slicks sous w 0,2, intermédiaires jusqu'à 0,47, pluie au-delà.
  const PNEUS = Object.freeze({ slicks: Object.freeze([1, -.30]), inter: Object.freeze([.96, -.10]), pluie: Object.freeze([.88, .07]) });
  function adherencePneus(type, eau) { const p = PNEUS[type] || PNEUS.slicks; return p[0] + p[1] * clamp(eau || 0, 0, 1); }
  function pneusConseilles(eau) { return eau < .2 ? 'slicks' : eau < .47 ? 'inter' : 'pluie'; }
  // eau sur la piste : la pluie qui tombe, ou la piste qui reste mouillée après l'averse (séchage de meteo.js)
  function eauSurPiste(m) {
    m = m || (B.meteo && B.meteo.actuel);
    if (!m) return 0;
    return clamp(Math.max(Number.isFinite(m.pluie) ? m.pluie : 0, .6 * (Number.isFinite(m.mouille) ? m.mouille : 0)), 0, 1);
  }

  function cap(etat, c) { return B.circuit.echantillon(c, etat.s, LU.cap).cap + etat.psi + etat.beta; }
  function kmh(etat) { return Math.round(Math.abs(etat.v) * 3.6); }

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
      dr.contre = cb >= dr.contre ? cb : dr.contre + (cb - dr.contre) * expTauFixe(TAU.contre, P.deriveContreRetombee, dt);
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
    etat.regime += (cible - etat.regime) * (cible > etat.regime ? expTauFixe(TAU.grilleMontee, P.grilleMonteeTau, dt) : expTauFixe(TAU.grilleDescente, P.grilleDescenteTau, dt));
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

  // Une même réponse pour une caisse roulante, en petit bond ou privée d'une roue.
  function heurterGlissiere(etat, c, dt, ev, enVol = false) {
    // Glissière : le choc dépend de l'angle d'attaque et de la vitesse ; la caisse (emprise
    // 4,95 × 2,02 m) ne franchit jamais le rail, quel que soit son cap, et n'est jamais renvoyée de l'autre
    // côté de l'axe. Un frôlement rasant (< 8°) garde l'essentiel de la vitesse ; un mur plein à plus de
    // 100 km/h (au-delà de 35°) est un accident.
    const cdg = etat.d < 0 ? -1 : 1;
    // Le rail dessiné culmine à 0,80 m au-dessus de l'accotement. Un bond bas reste solide,
    // un vrai survol n'est pas arrêté par un mur invisible. Même dévers et pente d'accotement que decor.js.
    if (enVol) {
      const q = B.circuit.echantillon(c, etat.s, LU.rail), w = c.largeur / 2, L = limiteCote(c, etat.s, cdg);
      const haut = q.y - cdg * w * Math.sin(q.devers) - .02 * (L - w - 1.2) + .8;
      if (etat.y >= haut || etat.y + 1.1 <= haut - .8) { etat.auRail = false; return; }
    }
    const capRel = etat.psi + etat.beta;
    const emprise = (P.caissel / 2) * Math.abs(Math.cos(capRel)) + (P.caisseL / 2) * Math.abs(Math.sin(capRel));
    const lim = limiteCote(c, etat.s, cdg);
    const bord = Math.max(0.2, lim - emprise);   // au-delà, un coin de la caisse passerait le rail
    if (Math.abs(etat.d) > bord) {
      const vAvant=etat.v, normale=Math.max(0,cdg*vAvant*Math.sin(etat.psi));
      const premier=!etat.auRail&&etat.choc<=0, body=etat.psi+etat.beta;
      etat.d=cdg*bord;
      if(normale>.1) {
        if(premier || (B.degats&&normale>=B.degats.PARAMS.chocRoue))
          for(const e of subirChoc(etat,normale))ev.push(e);
        if(!etat.recuperation) {
          // Une réponse normale dissipative fonctionne aussi en marche arrière ; la caisse ne pivote pas.
          const vx=vAvant*Math.cos(etat.psi),vz=vAvant*Math.sin(etat.psi)-cdg*normale*1.05;
          const sg=vAvant<0?-1:1;etat.v=sg*Math.hypot(vx,vz);
          if(Math.abs(etat.v)>.001){etat.psi=angle(Math.atan2(vz,vx)-(sg<0?Math.PI:0));etat.beta=angle(body-etat.psi);}
          etat.omega*=.65;
        }
        if(premier&&normale>=2){ev.push({type:'choc',force:normale});etat.choc=P.chocDuree;}
        annuler(etat,ev);
      } else if(Math.abs(etat.v)<2)etat.d=cdg*Math.max(0,Math.abs(etat.d)-.6*dt);
      etat.auRail = true;
    } else etat.auRail = false;
    if (etat.choc > 0) etat.choc -= dt;

  }

  function rouler(etat, cmd, c, dt, gaz, frein, aide, guidage, ev) {
    const dr = etat.derive, m = P.masse;
    const e = B.circuit.echantillon(c, etat.s, LU.rouler), k = e.courbure, v = etat.v;

    // Surface sous la voiture
    const demi = c.largeur / 2, ad = Math.abs(etat.d), cote = etat.d < 0 ? -1 : 1;
    let mu = P.muPiste, surf = 'piste';
    if (ad > demi) {
      if (ad <= demi + P.largeurVibreur && B.circuit.vibreurA(c, etat.s, cote)) { mu = P.muVibreur; surf = 'vibreur'; }
      else { mu = P.muHerbe; surf = 'herbe'; }
    }
    etat.surface = surf; etat.vibreur = surf === 'vibreur';
    // dégâts (Chantier 3) : une caisse abîmée perd de l'adhérence (jusqu'à −8 %) ; les débris et le capot
    // de côté la freinent (traînée jusqu'à +8 %, appliquée plus bas). Absents, rien ne change.
    const dg = etat.degats;
    if (dg) mu *= dg.adher;
    // Pluie et pneus : l'adhérence suit l'eau sur la piste (pluie qui tombe, piste encore mouillée) et les pneus.
    mu *= adherencePneus(etat.pneus, B.circuit.dansTunnel && B.circuit.dansTunnel(c, etat.s) ? 0 : eauSurPiste()); // sous la voûte, la piste est sèche
    const enPiste = ad <= demi + P.largeurVibreur;

    // Dérive au bouton
    piloterDerive(etat, cmd, k, frein, surf, enPiste, dt, ev);
    // l'arrière passe en glisse par un fondu en S (deux filtres en cascade) ; le tirage de l'avant suit au
    // rythme du volant, pour que le contre-braquage ne creuse pas l'effort de l'avant au départ
    const cible = dr.actif ? 1 : 0, kM = dr.actif ? expTauFixe(TAU.entree, P.deriveEntree, dt) : expTauFixe(TAU.sortie, P.deriveSortie, dt);
    dr.amorce += (cible - dr.amorce) * kM;
    dr.melange += (dr.amorce - dr.melange) * kM;
    dr.tirage += (cible - dr.tirage) * expTauFixe(TAU.tirage, P.deriveTirageTau, dt);
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
    etat.regime += (clamp(cibleR, P.ralenti, P.rupteur) - etat.regime) * (lance > brut ? expTauFixe(TAU.lancement, P.lancementTau, dt) : expTauFixe(TAU.regime, P.regimeTau, dt));
    // en sixième sous turbo, le moteur reste à fond au-delà de sa pointe sans couper
    const libre = aTurbo > 0 && etat.rapport === 6;
    const auRupteur = brut >= P.maxUtile && !libre;
    if (auRupteur && gaz > 0.05 && etat.rapport < 6 && etat.rupteurT <= 0) { ev.push({ type: 'rupteur' }); etat.rupteurT = P.rupteurCadence; }
    let aMot = gaz * POUSSEE[etat.rapport - 1] * couple(etat.regime);
    if (etat.coupure > 0 || auRupteur) aMot = 0;
    if (surf === 'herbe') aMot *= P.herbeMoteur;

    // Vitesses dans le repère de la caisse (u vers l'avant, w vers la droite)
    let u = v * Math.cos(etat.beta), w = -v * Math.sin(etat.beta), r = etat.omega;

    // Charges (§ 3.1). Charge normale de la piste : le poids selon la pente et le dévers, plus la charge de relief
    // u²·κv (un creux plaque la voiture, une crête l'allège) ; puis l'appui, et les transferts longitudinal et latéral,
    // pour une part immédiats (géométriques), le reste filtré (accélérations des pneus du pas précédent), chacun sur la
    // voie de son essieu. Une charge ne descend jamais sous zéro : une roue délestée ne transmet plus rien. Le transfert
    // de la pente vient des pneus : en montée, ils poussent contre la gravité et chargent l'arrière (m·g·sin θ·h/L).
    const pente = Number.isFinite(e.pente) ? e.pente : 0, devers = Number.isFinite(e.devers) ? e.devers : 0;
    const kv = courbureVerticale(c, etat.s);
    const fN = m * (G * Math.cos(devers) / Math.sqrt(1 + pente * pente) + u * u * kv);
    const appui = m * P.aero * v * v;
    const gI = P.transfertImmediat;
    const dx = m * (gI * etat.along + (1 - gI) * etat.chargeX) * P.hauteurCG / L;
    const dy = m * (gI * etat.alat + (1 - gI) * etat.chargeY) * P.hauteurCG;
    // Garde au décollage (fiche 22F § 3.4) : sous `decollage` fois le poids, appui compris, les roues ne guident plus
    // et la voiture vole jusqu'à ce que son arc recoupe le profil (decoller, voler).
    const fzTot = fN + appui;
    if (fzTot < P.decollage * m * G) { decoller(etat, pente, Number.isFinite(e.y) ? e.y : 0); return; }
    // Les charges se conservent : un essieu ou une roue délestés à zéro reportent leur part sur l'autre.
    const fzAv = clamp(fN * P.repartition + appui * P.aeroAvant - dx, 0, fzTot), fzAr = fzTot - fzAv;
    const tAv = clamp(dy * P.roulisAvant / P.voieAv, -fzAv / 2, fzAv / 2);
    const tAr = clamp(dy * (1 - P.roulisAvant) / P.voieAr, -fzAr / 2, fzAr / 2);
    const R = etat.roues;
    // virage à droite (chargeY > 0) : la charge passe sur les roues gauches
    R[0].charge = fzAv / 2 + tAv; R[1].charge = fzAv / 2 - tAv;
    R[2].charge = fzAr / 2 + tAr; R[3].charge = fzAr / 2 - tAr;
    // Pneus (§ 3.2, src/pneu.js) : force maximale et angle du pic de chaque roue selon sa charge, normée sur la charge
    // statique d'une roue de son essieu ; l'angle du pic d'un essieu est la moyenne de ceux de ses roues, pesée par
    // leurs forces maximales.
    const Q = P.sensibiliteQ, PC = P.picCharge, muAr = mu * P.gripArriere * (1 - (1 - P.deriveMuAr) * bd);
    const f0 = forceMax(mu, R[0].charge, FZ0AV, Q), f1 = forceMax(mu, R[1].charge, FZ0AV, Q);
    const f2 = forceMax(muAr, R[2].charge, FZ0AR, Q), f3 = forceMax(muAr, R[3].charge, FZ0AR, Q);
    const p0 = alphaPic(P.alphaAv, R[0].charge, FZ0AV, PC), p1 = alphaPic(P.alphaAv, R[1].charge, FZ0AV, PC);
    const p2 = alphaPic(P.alphaAr, R[2].charge, FZ0AR, PC), p3 = alphaPic(P.alphaAr, R[3].charge, FZ0AR, PC);
    const capAv = f0 + f1, capAr = f2 + f3;
    const picAv = capAv > 0 ? (f0 * p0 + f1 * p1) / capAv : P.alphaAv, picAr = capAr > 0 ? (f2 * p2 + f3 * p3) / capAr : P.alphaAr;
    etat.capAv = capAv; etat.capAr = capAr; etat.chargeAv = fzAv / fzTot;

    // Longitudinal : moteur et frein moteur à l'arrière, freins répartis (force de pédale de p9, sur la charge normale)
    const pied = 1 - gaz;
    const freinMoteur = u > 0.5 ? m * P.freinMoteur * pied : 0;
    const fFrein = frein * P.freinMax * P.freinMu * fzTot * (u > 0.05 ? 1 : 0);
    // Vitesses des essieux, dérive et adhérence de l'arrière. Au-delà du pic, la roue arrière qui glisse perd de
    // l'adhérence totale (la retombée de sa courbe, retenue : elle arrive en picTau, revient aussitôt), partagée ensuite
    // entre motricité et virage : sous le gaz, une glisse franche ne se rattrape plus seule. En dérive au bouton,
    // l'arrière suit une courbe adoucie, sans retombée.
    const ua = Math.max(Math.abs(u), 1);
    const angCG = Math.atan2(w, ua), angAv = Math.atan2(w + A * r, ua), angAr = Math.atan2(w - BR * r, ua);
    const kPic = expTauFixe(TAU.pic, P.picTau, dt);
    const alphaAr = relaxer(etat.deriveAr, -angAr, u, dt, P.relaxation, P.relaxationV), xAr = alphaAr / picAr;
    const x2 = alphaAr / p2, x3 = alphaAr / p3;
    R[2].chute = suivreChute(R[2].chute, chute(x2, P.chuteAr, P.chuteArLargeur), kPic);
    R[3].chute = suivreChute(R[3].chute, chute(x3, P.chuteAr, P.chuteArLargeur), kPic);
    const nd = 1 - bd, g2 = f2 * (1 - nd * R[2].chute), g3 = f3 * (1 - nd * R[3].chute), capArG = g2 + g3;
    let fAr = capArG > 0 ? (g2 * courbeAvec(x2, 0) + g3 * courbeAvec(x3, 0)) / capArG : 0;
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
    // l'intérieur s'efface et un contre-braquage s'ajoute ; inactive pendant une dérive au bouton. Le lacet rattrapé
    // est surtout l'excès de rotation (lacet plus vif que la trajectoire), pas le lacet d'un virage propre : la limite
    // reste lisible au lieu d'un sous-virage artificiel (relecture Spark, David 16/11 : « précision et fun »).
    if (aide > 0 && bd < 0.5) {
      const exces = rampe(Math.abs(etat.beta), P.aideSeuil, P.aideSeuil + P.aidePlage) * aide * (1 - 2 * bd);
      if (exces > 0) {
        const sb = sign(etat.beta), lacetExces = r - etat.alat / ua, rAide = 0.6 * r + (lacetExces * sb > 0 ? lacetExces : 0);
        if (rho * sb > 0) rho *= 1 - Math.min(1, P.aideGain * exces);
        rho -= sb * exces * P.aideGain * 0.5 + P.aideLacet * aide * rAide * (1 - 2 * bd);
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
    // Il est plus fort à haute vitesse (κ_D selon u, § 3.8), où le lacet est le moins amorti.
    const lache = rampe(Math.abs(xAr), P.amortSeuil, P.amortSeuil + P.amortPlage) * (1 - Math.max(bd, envTurbo));
    const glisseLacet = r - etat.alat / ua;
    const kD = P.amortGlisse + (P.amortGlisseV - P.amortGlisse) * rampe(u, P.amortV0, P.amortV1);
    rho -= suivi(v) * kD * (1 - lache) * (1 - (1 - P.deriveAmort) * bd) * glisseLacet * Math.max(v, 1) / Math.max(amaxAv, 1);
    let delta = suivi(v) * angCG + braquerPic(rho, v, amaxAv, picAv);
    delta = clamp(delta, -P.braquageMeca, P.braquageMeca);
    etat.braquage = delta;

    // Pneus : dérive et force latérale de chaque roue avant, la retombée retenue comme à l'arrière (fAr et la
    // retombée de l'arrière, dans capArG, sont calculées plus haut) ; l'ellipse de l'avant (latAv) est celle de p9
    const sgnU = u >= 0 ? 1 : -1;
    const alphaAv = relaxer(etat.deriveAv, delta * sgnU - angAv, u, dt, P.relaxation, P.relaxationV);
    const x0 = alphaAv / p0, x1 = alphaAv / p1;
    R[0].chute = suivreChute(R[0].chute, chute(x0, P.chute, P.chuteLargeur), kPic);
    R[1].chute = suivreChute(R[1].chute, chute(x1, P.chute, P.chuteLargeur), kPic);
    const fyAv = capAv > 0 ? latAv * (f0 * courbeAvec(x0, R[0].chute) + f1 * courbeAvec(x1, R[1].chute)) / capAv : 0;
    const fyAr = latAr * fAr, xAv = alphaAv / picAv;
    etat.deriveAv = alphaAv; etat.deriveAr = alphaAr; etat.xAv = xAv; etat.xAr = xAr;
    // Relevé facultatif pour le banc (tools/banc-conduite.mjs) : un objet `_mesure` posé sur l'état reçoit les
    // grandeurs internes du pas (demandes et capacités des essieux, dérives rapportées au pic). Le jeu ne le pose
    // jamais ; les champs « _ » n'entrent dans aucune empreinte d'état.
    const M = etat._mesure;
    if (M) {
      M.demAv = demAv; M.demAr = demAr; M.capAv = capAv; M.capAr = capArG; M.fxAv = fxAv; M.fxAr = fxAr;
      M.latAv = latAv; M.latAr = latAr; M.fyAv = fyAv; M.fyAr = fyAr;
      M.alphaPicAv = picAv; M.alphaPicAr = picAr; M.xAv = xAv; M.xAr = xAr;
      M.freinMoteur = freinMoteur; M.fFrein = fFrein; M.fN = fN; M.kv = kv; M.fzAv = fzAv; M.fzAr = fzAr;
    }

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
    const gT = -G * pente / Math.sqrt(1 + pente * pente), gN = G * Math.sin(devers);
    etat.pente = pente;
    fx += m * (gT * ct + gN * st); fy += m * (-gT * st + gN * ct);

    // Intégration semi-implicite : vitesses, puis positions
    const u0 = u;
    u += (fx / m + w * r) * dt;
    w += (fy / m - u0 * r) * dt;
    r += mz / IZ * dt;
    // Le solveur de marche avant s’arrête à zéro ; le recul volontaire est traité par reculer().
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
    const kc = expTauFixe(TAU.charge, P.chargeTau, dt);
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

    heurterGlissiere(etat, c, dt, ev);

    // Glisse par essieu et par roue, pour le son et les effets (dérive rapportée à l'angle du pic de l'essieu)
    const gAv = rampe(Math.abs(xAv), 0.8, 1.6);
    const gAr = Math.max(rampe(Math.abs(xAr), 0.8, 1.6), etat.patinage);
    etat.glisseAv = Math.max(gAv, etat.blocage); etat.glisseAr = Math.max(gAr, etat.blocage);
    const pAv = Math.max(fzAv, 1), pAr = Math.max(fzAr, 1);
    R[0].glisse = etat.glisseAv * clamp(2 * R[0].charge / pAv, 0, 1); R[1].glisse = etat.glisseAv * clamp(2 * R[1].charge / pAv, 0, 1);
    R[2].glisse = etat.glisseAr * clamp(2 * R[2].charge / pAr, 0, 1); R[3].glisse = etat.glisseAr * clamp(2 * R[3].charge / pAr, 0, 1);
    etat.sousVirage = Math.max(0, Math.abs(xAv) - 1);
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
    const e = B.circuit.echantillon(c, etat.s, LU.attitude), kA = expTauFixe(TAU.attitude, P.attitudeTau, dt);
    // sol sous la voiture, même profil que le décor : dévers sur la piste, vibreur, accotement à 2 %
    const w = c.largeur / 2, ad = Math.abs(etat.d);
    etat.vibreur=ad>w&&ad<=w+P.largeurVibreur&&B.circuit.vibreurA(c,etat.s,etat.d<0?-1:1);
    etat.surface=ad<=w?'piste':etat.vibreur?'vibreur':'herbe';
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
    // la montée dépend de la vitesse : seul le retour, de constante fixe, se retient
    const k = retour ? expTauFixe(TAU.retour, P.volantRetour, dt) : expTau(P.volantMontee + P.volantMonteeV * etat.v, dt);
    etat.volant = x + (cible - x) * k;
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
      tangV: o.tangV || 0, roulV: o.roulV || 0, pouss: o.pouss || 0, contre: 0,
      // vol de crête (decoller) : vitesse verticale et accélération vers le sol de l'arc, hauteur de la piste au départ
      crete: !!o.crete, vz: o.vz || 0, gz: o.gz || 0, yPiste: o.yPiste || 0
    };
    if (o.omega) etat.omega = o.omega;
    annuler(etat, []); // plus de dérive ni de turbo pendant le vol
  }

  // Décollage d'une crête (lot 17B, garde de la fiche 22F § 3.4) : la voiture quitte le sol avec la vitesse verticale
  // que lui donne la piste (pente × vitesse) et retombe sous la gravité et l'appui ; voler la pose quand cet arc
  // recoupe le profil là où la piste la porte de nouveau (au plus volMax s). Sans perte à la réception : rien ne l'a
  // poussée.
  function decoller(etat, pente, yPiste) {
    const v = Math.abs(etat.v);
    lancerSaut(etat, { duree: P.volMax, h: 0, crete: true, vz: v * pente, gz: G + P.aero * v * v, yPiste });
  }
  // Appui de la piste par unité de masse (m/s²) : poids selon la pente et le dévers, relief, appui aérodynamique.
  function appuiPiste(c, s, q, u, v) {
    const pe = Number.isFinite(q.pente) ? q.pente : 0, dv = Number.isFinite(q.devers) ? q.devers : 0;
    return G * Math.cos(dv) / Math.sqrt(1 + pe * pe) + u * u * courbureVerticale(c, s) + P.aero * v * v;
  }

  // Déclencher un accident : la caisse n'obéit plus, freine et revient seule sur le revêtement, puis immunité.
  function declencherAccident(etat, o = {}) {
    if(etat.recuperation)return;
    immobiliser(etat,[]);
    etat.recuperation.cause='accident';
    etat.accident={t:0,duree:P.accidentDuree,d0:etat.d,reception:!!o.reception};
  }

  // Décision David16/11 : l'impact reste visible, puis la voiture revient vite, sans gagner d'abscisse.
  function immobiliser(etat, ev) {
    etat.v=0;etat.gaz=0;etat.frein=1;etat.regime=P.ralenti;
    etat.psi=angle(etat.psi+etat.beta);etat.omega=0;etat.beta=0;etat.saut=null;etat.accident=null;etat.reparation=null;
    etat.bond=0;etat.bondT=0;etat.glisse=0;etat.immunite=0;etat.freinRecul=0;
    if(!etat.recuperation)etat.recuperation={t:0,cause:'choc'};
    annuler(etat,ev);
  }
  function replacer(etat,c) {
    const s=etat.s,distance=etat.distance,degats=etat.degats,numero=(etat.repositionnements||0)+1;
    annulerDerive(etat,true);couperTurbo(etat);
    if(degats&&B.degats)B.degats.reparerUrgence(degats);   // jouable, pas neuve : la réparation complète se fait aux stands
    Object.assign(etat,creer(s,0));etat.distance=distance;etat.degats=degats;etat.repositionnements=numero;etat.immunite=P.accidentImm;
    const q=B.circuit.echantillon(c,s,LU.replacer);etat.y=q.y;etat.tangage=Math.atan(q.pente||0);etat.roulis=q.devers||0;
    return [{type:'retour',repositionnement:true}];
  }
  function recuperer(etat,c,dt,ev) {
    etat.recuperation.t+=dt;
    if(etat.accident)etat.accident.t=etat.recuperation.t;
    if(etat.recuperation.t>=P.accidentDuree)ev.push(...replacer(etat,c));
  }

  // L'immunité protège les dégâts, pas la géométrie : rails, solides et concurrents restent présents.
  function subirChoc(etat, force, options = {}) {
    if(etat.immunite>0 || etat.recuperation)return [];
    const ev=B.degats&&etat.degats?(B.degats.choc(etat.degats,force,options)||[]):[];
    if(etat.degats&&(etat.degats.casse||B.degats.uneRouePerdue(etat.degats)))immobiliser(etat,ev);
    return ev;
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
    etat.v = Math.sign(etat.v) * Math.max(0, Math.abs(etat.v) - P.volTrainee * etat.v * etat.v * dt);
    // cinématique de Frenet, comme au sol, pour que cap et position restent continus
    const e = B.circuit.echantillon(c, etat.s, LU.vol), k = e.courbure;
    const den = Math.max(1 - k * etat.d, 0.1);
    const psiV = angle(e.cap - etat.beta);
    const dsdt = etat.v * Math.cos(psiV) / den;
    etat.s = ramener(etat.s + etat.v * Math.cos(etat.psi) / den * dt, c.longueur);
    etat.d += etat.v * Math.sin(etat.psi) * dt;
    etat.psi = angle(etat.psi + etat.omega * dt);
    // hauteur et attitude ; un vol de crête suit l'arc de la gravité et de l'appui, jamais sous le profil, et se pose
    // quand il le recoupe là où la piste porte de nouveau `decollage` fois le poids (au plus volMax s)
    etat.tangage = s.tang0 + s.tangV * s.t;
    etat.roulis = s.roul0 + s.roulV * s.t;
    if (s.crete) {
      const q = B.circuit.echantillon(c, etat.s, LU.envolA), ya = s.ySol + s.vz * s.t - s.gz * s.t * s.t / 2;
      const yp = s.ySol + ((Number.isFinite(q.y) ? q.y : s.yPiste) - s.yPiste), v = Math.abs(etat.v);
      etat.y = Math.max(ya, yp);
      if (s.t < s.duree && (ya > yp || appuiPiste(c, etat.s, q, v, v) < P.decollage * G)) return;
    } else {
      const p = clamp(s.t / s.duree, 0, 1);
      etat.y = s.ySol + s.h * 4 * p * (1 - p);
      if (s.t < s.duree) return;
    }
    // réception
    if (Math.abs(etat.tangage) > P.sautTangLim || Math.abs(etat.roulis) > P.sautRoulLim) {
      etat.saut = null; declencherAccident(etat, { reception: true });
      ev.push({ type: 'tonneau' });
      return;
    }
    const corr = s.crete || s.contre >= P.contreBon ? 1 : (s.contre <= P.contreMauvais ? 0.94 : 0.97);
    etat.v *= corr; // jamais de gain : corr ≤ 1
    etat.saut = null;
    etat.bondT = P.deriveBondDuree; // petit écrasement visuel à l'atterrissage
    ev.push({ type: 'reception', corr, force: (1 - corr) * etat.v, bon: corr >= 1, grand: s.grand });
  }

  // Recul réservé à une commande joueur explicite. Le cap reste celui de l'axe avant de la caisse,
  // v devient négative ; les normales de collision emploient toujours v*cos(psi),v*sin(psi).
  function reculer(etat,cmd,c,dt,gaz,frein,ev) {
    annuler(etat,ev);couperTurbo(etat);
    const autorise=cmd.marcheArriere===true;
    const avant=etat.v;
    if(gaz>0 || !autorise)etat.v=Math.min(0,etat.v+P.reculFrein*Math.max(gaz,.5)*dt);
    else if(frein>0)etat.v=Math.max(-P.reculMax,etat.v-P.reculAcc*frein*dt);
    else etat.v=Math.min(0,etat.v+.8*dt);
    if(etat.v>=0){etat.v=0;etat.omega=0;etat.along=0;etat.alat=0;if(gaz>0||!autorise){etat.rapport=1;etat.freinRecul=0;}return;}
    etat.rapport=-1;etat.regime=P.ralenti+Math.abs(etat.v)/P.reculMax*1800;
    const q=B.circuit.echantillon(c,etat.s,LU.reculA),body=q.cap+etat.psi+etat.beta;
    etat.braquage=etat.volant*P.braquageMeca;etat.omega=etat.v*Math.tan(etat.braquage)/L;
    const rel=angle(body-q.cap),ds=etat.v*Math.cos(rel)/Math.max(.1,1-q.courbure*etat.d)*dt;
    etat.s=ramener(etat.s+ds,c.longueur);etat.d+=etat.v*Math.sin(rel)*dt;etat.distance+=ds;
    etat.psi=angle(body+etat.omega*dt-B.circuit.echantillon(c,etat.s,LU.reculB).cap);etat.beta=0;
    etat.along=(etat.v-avant)/dt;etat.alat=etat.v*etat.omega;etat.glisse=0;
    const kc=expTauFixe(TAU.charge,P.chargeTau,dt);
    etat.chargeX+=(etat.along-etat.chargeX)*kc;etat.chargeY+=(etat.alat-etat.chargeY)*kc;
    heurterGlissiere(etat,c,dt,ev);
  }

  // cmd = { gaz, frein, volant, derive, haut, bas, boite, aide, guidage, marcheArriere: true uniquement pour le joueur }
  // `sortie`, facultatif : tableau d'événements de l'appelant, complété (jamais vidé) et rendu au lieu d'un neuf ;
  // la course y verse directement ceux de ses douze voitures à chaque pas.
  function pas(etat, cmd, c, dt, retenue = false, sortie) {
    const ev=sortie||[];
    if(!etat.recuperation&&(etat.accident||etat.reparation||(etat.degats&&(etat.degats.casse||B.degats?.uneRouePerdue(etat.degats)))))immobiliser(etat,ev);
    if(etat.recuperation){recuperer(etat,c,dt,ev);return ev;}
    const gaz=borne01(cmd.gaz),frein=borne01(cmd.frein),aide=borne01(cmd.aide),guidage=borne01(cmd.guidage);
    etat.gaz=gaz;etat.frein=frein;filtrerVolant(etat,clamp(+cmd.volant||0,-1,1),dt);
    if(etat.immunite>0)etat.immunite=Math.max(0,etat.immunite-dt);
    if(etat.saut&&etat.saut.actif){voler(etat,cmd,c,dt,ev);heurterGlissiere(etat,c,dt,ev,true);return ev;}
    if(retenue){etat.freinRecul=0;if(etat.rapport<1)etat.rapport=1;retenir(etat,gaz,dt,ev);}
    else if(etat.v<0||etat.rapport===-1)reculer(etat,cmd,c,dt,gaz,frein,ev);
    else if(cmd.marcheArriere===true&&etat.v<=.05&&frein>.5&&gaz<.01){
      etat.v=0;etat.omega=0;etat.psi=angle(etat.psi+etat.beta);etat.beta=0;etat.freinRecul+=dt;
      if(etat.freinRecul>=P.reculAttente){etat.rapport=-1;reculer(etat,cmd,c,dt,gaz,frein,ev);}
    } else {etat.freinRecul=0;rouler(etat,cmd,c,dt,gaz,frein,aide,guidage,ev);}
    if(!etat.recuperation)poserAttitude(etat,c,dt);
    return ev;
  }

  B.conduite = {
    PARAMS, PNEUS, adherencePneus, pneusConseilles, eauSurPiste, creer, pas, annulerDerive, couperTurbo, cap, kmh, couple, limiteCote, braquageMax, volantPour,
    capaciteLaterale, pneu, lancerSaut, declencherAccident, subirChoc, replacer
  };
})(globalThis.BITUME = globalThis.BITUME || {});
