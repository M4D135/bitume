/* BITUME — cadence d'affichage : période de l'écran, pas fixes, diviseur d'images et essais de retour. */
(function (B) {
  'use strict';
  // Un écran présente ses images à intervalles fixes. Une image qui manque son échéance reste deux périodes à
  // l'écran : alterner une et deux périodes se voit bien plus qu'une cadence moitié tenue. Ce module estime la
  // période réelle de l'écran, cale le temps de jeu sur elle (verrou du nombre de pas, intervalles recalés) et, en
  // mode Auto, ne rend qu'un rappel sur k quand la machine ne tient pas la période.
  // Il ne lit aucune horloge : le jeu lui passe l'horodatage de chaque rappel de requestAnimationFrame. En régime
  // établi, image() n'alloue rien : tableaux typés, champs numériques stables, objet rendu réutilisé, et aucun
  // nombre à virgule passé en argument d'une fonction du chemin de chaque rappel (V8 l'emballerait dans le tas).
  // FLoop de FERRO tient les mêmes règles de verrou et de rattrapage, mais il apprend la période d'intervalles
  // isolés (à 120 Hz avec ±2 ms, un intervalle varie de la moitié d'une période) et ses variables de fermeture
  // allouent un nombre à chaque rappel : la cadence garde sa propre grille et applique ces règles elle-même.

  const MODES = Object.freeze(['auto', 'ecran', '120', '60', '30']);
  const COUPURE = 250;          // ms : au-delà, l'intervalle est une coupure (onglet, chargement), pas une image
  const NORMAUX = 3;            // intervalles normaux après lesquels un intervalle long est une coupure isolée
  const AMORCE = 24, AMORCE_MIN = 12, AMORCE_MS = 300; // intervalles avant la première grille (moins s'ils sont longs)
  const BRUTS = 32;             // intervalles bruts gardés
  const REEST = 16;             // intervalles récents d'une réestimation (le régime précédent en sort vite)
  const GRILLE = 48;            // synchronisations retenues pour la droite des horodatages
  const APRIORI = 40;           // poids de la période connue tant que la droite a peu de points (environ 8 points)
  const ACCORD = .4;            // écart à la grille (en périodes) au-delà duquel un horodatage n'entre pas dans la droite
  const TOT = .5;               // un rappel moins d'une demi-période après la synchronisation précédente est en avance
  const SUITE = 8;              // rappels de suite sur un même multiple de la période : l'écran est peut-être bridé
  const SUITE_MAX = 32;         // suite exigée au plus, doublée à chaque bridage démenti aussitôt
  const BRIDE_COURTE = 3000;    // ms : un bridage démenti plus tôt était la machine
  // ms : seul un bridage tenu au moins aussi longtemps rend la suite exigée courte. Une machine liée au processeur
  // graphique, aux images de une et demie à deux périodes, tient une hypothèse de bridage plus de 3 s puis la dément :
  // remettre la suite à 8 à chaque fois faisait osciller la grille sans fin entre une et deux périodes.
  const BRIDE_LONGUE = 30000;
  const CHARGE = .9;            // travail du fil principal (en périodes) qui explique à lui seul des rappels espacés
  const DESACCORDS = 4;         // rappels en avance ou hors grille parmi les 16 derniers : la grille est à refaire
  // Écart quadratique moyen des synchronisations retenues à la droite (2 ms, ou 0,15 période si c'est plus) au-delà
  // duquel elle range un autre rythme que le sien, vérifié sur une droite pleine et confirmée. Une machine qui rend une image toutes les deux ou trois périodes d'un écran 75 Hz tombe à 6,7 ms près sur
  // une grille de 60 Hz, sous la tolérance de 0,4 période ; la droite absorbe ce décalage et l'écart reste toujours
  // en deçà, mais il vaut 3,3 ms en moyenne quadratique. La gigue uniforme de ±2 ms en vaut 1,3 sur la droite.
  const RESIDU = 2, RESIDU_PART = .15;
  const ECART = .25;            // écart quadratique moyen (en périodes) au-delà duquel des horodatages ne font pas une grille
  const PROCHE = 1.1;           // une période plus longue est retenue si elle range presque aussi bien
  const PRECIS = .1;            // écart (en périodes) d'une grille précise
  const DOMINE = 2, DOMINE_MS = .05;       // une grille précise écarte celles qui rangent deux fois moins bien en ms
  const DOMINE_N = 16;          // intervalles qu'il faut pour qu'un peigne fin ne paraisse plus précis par hasard
  // ms : aucun horodatage n'est jugé plus précis que l'arrondi à la milliseconde (écart quadratique 1/√12 ms) ; des
  // horodatages arrondis à 100 ms d'intervalle tombent sinon exactement sur un peigne de 4 ms
  const PRECISION = 1 / Math.sqrt(12);
  const DIVISEURS = 8;          // candidats : un intervalle divisé par 1 à 8
  const CANDIDATS = 2 * (DIVISEURS * BRUTS + 1);   // deux premières passes par candidat (voir essayer)
  const MEME = .03;             // écart relatif d'une réestimation qui garde la période de la droite
  const CHANGEMENT = .15;       // écart relatif qui fait une nouvelle période
  // ms : requestAnimationFrame bat entre 400 et 30 Hz au premier plan (un navigateur bride à 30 images par seconde,
  // pas en dessous) ; une grille plus longue serait une machine lente dont le rythme cache l'écran
  const PERIODE_MIN = 2.5, PERIODE_MAX = 34;
  // ms : un écran plus lent que 50 Hz n'existe guère que bridé ; une grille plus longue peut être une machine lente
  const ECRAN_LENT = 20;
  const VERROU = .01, DEVERROU = .02;      // période multiple du pas à 1 % près ; lâché au-delà de 2 % (règle de FLoop)
  const DETTE = .1, DETTE_MAX = 2;         // part de la dette rendue par image, dette comptée au plus (ms)
  const FENETRE = 1500, SEUIL = .12;       // part d'images ratées tolérée sur la fenêtre de décision
  const PLANCHER = 1000 / 24, K_MAX = 6;   // jamais sous 24 images par seconde environ
  const REGULARITE = 20000;     // ms de régularité parfaite avant un essai de retour
  const ESSAI = 1000, ESSAI_RATEES = 2, ECHECS = 3, PART_TRAVAIL = .4, RECHUTE = 10000;
  const PHASE = .999;           // phase de l'accumulateur au verrou : l'image montre l'état le plus récent
  const CAP = 1024;             // images de la fenêtre (1,5 s jusqu'à 680 Hz)

  function normaliser(mode) {
    const m = typeof mode === 'number' ? String(mode) : typeof mode === 'string' ? mode.trim().toLowerCase() : '';
    if (m === 'écran') return 'ecran';
    return MODES.indexOf(m) >= 0 ? m : 'auto';
  }

  function creer(options) {
    const o = options || {};
    const hz = o.hz === undefined ? 120 : o.hz, maxPas = o.maxPas === undefined ? 14 : o.maxPas;
    if (!Number.isFinite(hz) || hz < 1 || hz > 1000) throw new TypeError('BITUME.cadence : hz entre 1 et 1000');
    if (!Number.isInteger(maxPas) || maxPas < 1 || maxPas > 60) throw new TypeError('BITUME.cadence : maxPas entier entre 1 et 60');
    const C = {
      pasMs: 1000 / hz, maxPas, mode: 'auto',
      // horloge de l'écran : période estimée et droite des horodatages (numéro de synchronisation → temps)
      periode: 0, grille: false, reprise: true, tPrec: NaN, brut: 0, normaux: NORMAUX, lent: 0,
      bruts: new Float64Array(BRUTS), nBruts: 0, iBruts: 0, sBruts: 0,
      eT: new Float64Array(BRUTS + 1), eN: new Float64Array(BRUTS + 1), ePente: 0, eB: 0, eNombre: 0,
      cP: new Float64Array(CANDIDATS), cR: new Float64Array(CANDIDATS), cG: new Float64Array(CANDIDATS),
      cZ: new Uint8Array(CANDIDATS), cA: new Float64Array(CANDIDATS),
      gN: new Float64Array(GRILLE), gT: new Float64Array(GRILLE), gC: 0, gI: 0,
      t0: 0, nCour: 0, phi: 0, apriori: 0, residu: 0,
      suite: 0, suiteN: 0, suiteMin: SUITE, desaccords: 0, reestimations: 0, fine: 0, brideDebut: 0, confirmer: 0,
      rConnue: 0, rPrecis: 0, kAvant: 1, cadenceBride: 0,
      // temps de jeu : pas entiers en attente, phase (fraction de pas, l'alpha rendu), instant recalé précédent
      attente: 0, phase: PHASE, tCale: NaN, dtCumul: 0, dette: 0, verrou: false, pasSync: 1, abandon: 0,
      // diviseur et décisions
      k: 1, kStable: 1, depuis: 0, tRendu: NaN, intervalleMs: 0, actif: false,
      fT: new Float64Array(CAP), fD: new Uint8Array(CAP), fR: new Uint8Array(CAP),
      fTete: 0, fQueue: 0, fCompte: 0, fRatees: 0, fDebut: NaN,
      regulier: 0, travailMs: 0, travailVu: false,
      essai: false, essaiDebut: 0, essaiImages: 0, essaiRatees: 0,
      essais: 0, echecs: 0, reussis: 0, delai: REGULARITE, succesA: -Infinity, hausses: 0,
      images: 0, ratees: 0, affinages: 0,
      sortie: { rendre: false, pas: 0, alpha: PHASE, dt: 0, periode: 1 / 60, diviseur: 1, ips: 0, verrouille: false,
        intervalle: 0, rate: false, travail: 0 }
    };
    regler(C, o.mode);
    return C;
  }

  // ---------------------------------------------------------------- horloge de l'écran
  // Les horodatages tombent sur une grille t = t0 + N × période, à la gigue près (arrondi à la milliseconde de
  // Firefox et Safari, rappels décalés). Une droite des moindres carrés sur les 48 dernières synchronisations donne
  // la période et l'instant recalé de chaque rappel : le temps de jeu avance d'intervalles sans gigue, et le nombre
  // de pas reste verrouillé même avec ±2 ms sur chaque horodatage. La droite étant refaite à chaque rappel, l'écart
  // entre temps recalé et horodatages réels se résorbe de lui-même, par fractions de la gigue.
  function noter(C) {
    if (C.nBruts === BRUTS) C.sBruts -= C.bruts[C.iBruts]; else C.nBruts++;
    C.bruts[C.iBruts] = C.brut; C.iBruts = (C.iBruts + 1) % BRUTS; C.sBruts += C.brut;
  }
  function ajuster(C) {
    const c = C.gC; let sN = 0, sT = 0;
    for (let i = 0; i < c; i++) { sN += C.gN[i]; sT += C.gT[i]; }
    const mN = sN / c, mT = sT / c; let nn = 0, nt = 0;
    for (let i = 0; i < c; i++) { const d = C.gN[i] - mN; nn += d * d; nt += d * (C.gT[i] - mT); }
    // tant que la droite a peu de points, la pente reste tirée vers la période déjà connue
    const P = (nt + APRIORI * C.apriori) / (nn + APRIORI);
    if (P >= PERIODE_MIN && P <= PERIODE_MAX) C.periode = P;
    C.phi = C.t0 + mT + C.periode * (C.nCour - mN);
    // écart quadratique moyen des synchronisations retenues à la droite (ms²), voir RESIDU
    let r = 0;
    for (let i = 0; i < c; i++) { const e = C.gT[i] - mT - C.periode * (C.gN[i] - mN); r += e * e; }
    C.residu = r / c;
  }
  function ancrer(C, t) {
    C.apriori = C.periode; C.t0 = t; C.nCour = 0; C.phi = t;
    C.gN[0] = 0; C.gT[0] = 0; C.gC = 1; C.gI = 1;
    C.suite = 0; C.desaccords = 0;
  }
  // Grille refaite sur les horodatages que l'estimation vient de ranger (C.eT, C.eN, le plus récent en n) : arrondir
  // de nouveau chaque intervalle sur la période retrouvée défairait ce rangement (à 144 Hz avec ±2 ms, un intervalle
  // dépasse une fois et demie la période). La droite part de la période P.
  function refaire(C, t, n, P) {
    C.periode = C.apriori = P; C.t0 = t; C.nCour = 0;
    const base = C.eN[n];
    for (let i = 0; i <= n; i++) { C.gN[i] = C.eN[i] - base; C.gT[i] = C.eT[i]; }
    C.gC = n + 1; C.gI = (n + 1) % GRILLE;
    ajuster(C);
    C.suite = 0; C.desaccords = 0;
  }
  function pousser(C, n, t) {
    C.nCour += n;
    C.gN[C.gI] = C.nCour; C.gT[C.gI] = t - C.t0; C.gI = (C.gI + 1) % GRILLE;
    if (C.gC < GRILLE) C.gC++;
    ajuster(C);
  }
  // Droite des moindres carrés des horodatages relatifs eT sur les numéros eN (indices 0 à n) : pente dans
  // C.ePente, ordonnée dans C.eB ; rend l'écart quadratique moyen des horodatages à la droite, en ms.
  function droite(C, n) {
    const T = C.eT, N = C.eN, c = n + 1;
    let sN = 0, sT = 0;
    for (let i = 0; i <= n; i++) { sN += N[i]; sT += T[i]; }
    const mN = sN / c, mT = sT / c;
    let nn = 0, nt = 0;
    for (let i = 0; i <= n; i++) { const d = N[i] - mN; nn += d * d; nt += d * (T[i] - mT); }
    if (!(nn > 0)) { C.ePente = 0; return Infinity; }
    C.ePente = nt / nn; C.eB = mT - C.ePente * mN;
    let r = 0;
    for (let i = 0; i <= n; i++) { const e = T[i] - C.eB - C.ePente * N[i]; r += e * e; }
    return Math.sqrt(r / c);
  }
  // Grille de pas c posée sur les horodatages : numéros tirés des intervalles, droite, puis seconde passe où chaque
  // horodatage est rangé sur la première droite. Une période presque juste converge vers la vraie pente. La première
  // passe compte au moins une synchronisation par intervalle, ou, si zero, aucune pour un intervalle de moins d'une
  // demi-période : un rappel en trop décalerait sinon la numérotation de tous les suivants, mais à 144 Hz avec
  // ±2 ms, deux synchronisations voisines sont parfois à moins d'une demi-période. Les deux sont essayées.
  function essayer(C, n, c, zero) {
    const T = C.eT, N = C.eN;
    N[0] = 0;
    for (let i = 1; i <= n; i++) {
      const s = Math.round((T[i] - T[i - 1]) / c);
      N[i] = N[i - 1] + (s > 0 || zero ? s : 1);
    }
    droite(C, n);
    const P = C.ePente;
    if (!(P >= PERIODE_MIN / 2)) return Infinity;
    for (let i = 0; i <= n; i++) N[i] = Math.round((T[i] - C.eB) / P);
    // Deux rappels sur une même synchronisation : un rappel en trop (moins d'une demi-période après le précédent),
    // toléré s'il reste rare. Plus espacés, ou fréquents, la grille est trop lâche : le double d'une période range
    // deux rappels sur chacune de ses synchronisations.
    let doubles = 0;
    for (let i = 1; i <= n; i++) {
      const d = N[i] - N[i - 1];
      if (d < 0 || d === 0 && T[i] - T[i - 1] >= TOT * P) return Infinity;
      if (d === 0) doubles++;
    }
    if (doubles * 4 > n) return Infinity;
    return droite(C, n);
  }
  // Période fondamentale des m derniers rappels contigus, jugée sur les horodatages et non sur des intervalles
  // isolés : avec ±2 ms sur chaque horodatage à 120 Hz, un intervalle varie de ±4 ms, la moitié de la période, et
  // un peigne faux en explique beaucoup par hasard ; sur seize horodatages, une période fausse se décale et sa
  // droite s'écarte. Candidats : chaque intervalle divisé par 1 à 8 (une machine qui ne rend, dès le départ,
  // qu'une image toutes les sept ou huit périodes laisse quand même trouver l'écran), plus la période connue. Une
  // grille doit ranger les horodatages à un quart de période près (écart quadratique moyen), et jamais au-delà de
  // PERIODE_MAX. L'écart est compté en périodes : une sous-période range aussi bien les horodatages en
  // millisecondes, mais deux fois plus mal en périodes, et le double d'une période laisse la moitié des rappels à
  // mi-chemin ; compté en millisecondes, un peigne fin rangerait la gigue elle-même (à 30 Hz avec ±2 ms, un peigne
  // de 4 ms explique deux intervalles de 37 ms par une dent de plus). À écart presque égal, le plus long l'emporte :
  // 33 ms partout est un écran à 30 Hz, pas un écran à 60 Hz qui rate tout. Une grille longue posée sur des rappels
  // toutes les quatre ou cinq périodes paraît pourtant précise en périodes (30 ms sur un écran 144 Hz, 18 ms à
  // 240 Hz) alors qu'elle s'écarte de plusieurs millisecondes : toute grille qui range les horodatages deux fois
  // moins bien, en ms, qu'une grille précise à un dixième de période est écartée d'abord. Sur moins de seize
  // intervalles, un peigne fin le paraît parfois par hasard (à 30 Hz avec ±2 ms, une fois sur trente-cinq sur huit
  // intervalles) : seule une grille déjà presque aussi bonne en périodes sert alors de référence. Seule, la période
  // connue est vérifiée sans autre candidat. Rend 0 si rien ne fait une grille ; sinon C.eN garde le rangement
  // retenu et C.eNombre le nombre d'intervalles.
  function estimer(C, m, connue, seule) {
    const n = Math.min(m, C.nBruts), T = C.eT;
    C.eNombre = n;
    if (n < 2) return 0;
    T[n] = 0;
    for (let i = 0; i < n; i++) T[n - 1 - i] = T[n - i] - C.bruts[(C.iBruts - 1 - i + BRUTS) % BRUTS];
    let nc = 0, eMin = Infinity;
    C.rConnue = C.rPrecis = Infinity;
    // la période déjà connue est un candidat de plus : une estimation ne la remplace que si elle range mieux
    const fin = seule ? 0 : n;
    for (let i = connue > 0 ? -1 : 0; i < fin; i++) for (let d = 1; d <= DIVISEURS; d++) {
      if (i < 0 && d > 1) break;
      const c = i < 0 ? connue : (T[i + 1] - T[i]) / d;
      if (c < PERIODE_MIN || c > PERIODE_MAX) continue;
      for (let z = 0; z < 2; z++) {
        const brut = essayer(C, n, c, z === 1), P = C.ePente, r = brut > PRECISION ? brut : PRECISION, e = r / P;
        if (!(e <= ECART) || P < PERIODE_MIN || P > PERIODE_MAX) continue;
        C.cP[nc] = P; C.cR[nc] = e; C.cA[nc] = r; C.cG[nc] = c; C.cZ[nc] = z; nc++;
        if (e < eMin) eMin = e;
        if (i < 0 && r < C.rConnue) C.rConnue = r;
      }
    }
    const peu = n < DOMINE_N, avant = eMin * PROCHE;
    for (let j = 0; j < nc; j++) if (C.cR[j] <= PRECIS && (!peu || C.cR[j] <= avant) && C.cA[j] < C.rPrecis) C.rPrecis = C.cA[j];
    const admis = DOMINE * C.rPrecis + DOMINE_MS;
    eMin = Infinity;
    for (let j = 0; j < nc; j++) if (C.cA[j] <= admis && C.cR[j] < eMin) eMin = C.cR[j];
    const proche = eMin * PROCHE;
    let P = 0, graine = 0, zero = false;
    for (let j = 0; j < nc; j++) {
      if (C.cA[j] <= admis && C.cR[j] <= proche && C.cP[j] > P) { P = C.cP[j]; graine = C.cG[j]; zero = C.cZ[j] === 1; }
    }
    if (!P) return 0;
    essayer(C, n, graine, zero);   // rangement du candidat retenu, pour refaire la grille
    // La règle du plus long suppose que rien n'explique des rappels espacés. Un fil principal qui occupe à lui seul
    // toutes les périodes d'une grille plus fine sauf la dernière, sur le plus court des intervalles, les explique :
    // 22 ms par image sur un écran 60 Hz donnent des rappels toutes les 33 ms, qui ne sont pas un écran à 30 Hz. La
    // grille fine retenue est la plus longue que le travail explique ; elle range les horodatages aussi bien en
    // millisecondes, les images y comptent ratées et la qualité Auto peut baisser. Aucune marge : le travail mesuré
    // commence après le rappel et sous-estime l'occupation du fil, et 8 ms n'expliquent pas qu'un écran 120 Hz ne
    // rappelle qu'une synchronisation sur deux. Un processeur graphique lent, que le travail ne montre pas, reste pris
    // pour un écran bridé (voir bridePossible). Seule, la vérification d'un bridage s'en passe.
    if (!seule && C.travailVu && P > ECRAN_LENT) {
      let court = Infinity;
      for (let i = 1; i <= n; i++) { const d = C.eN[i] - C.eN[i - 1]; if (d > 0 && d < court) court = d; }
      let fin = 0;
      for (let j = 0; j < nc; j++) {
        const c = C.cP[j], m = Math.round(P / c);
        if (C.cA[j] <= admis && m >= 2 && c > fin && Math.abs(P - m * c) <= MEME * P && C.travailMs >= (court * m - 1) * c) {
          fin = c; graine = C.cG[j]; zero = C.cZ[j] === 1;
        }
      }
      if (fin) { P = fin; essayer(C, n, graine, zero); }
    }
    return P;
  }
  function bits(x) { let n = 0; while (x) { x &= x - 1; n++; } return n; }
  // Suite de rappels sur un même multiple (deux périodes ou plus) de la période : écran bridé en cours ? Un écran qui
  // change de période sort de la grille et passe par les désaccords ; une suite reste sur la grille, comme une
  // machine lente.
  function suivre(C, n) {
    if (n < 2) { C.suite = 0; return; }
    if (C.suite && n === C.suiteN) C.suite++; else { C.suite = 1; C.suiteN = n; }
  }
  // Une suite peut être un écran bridé si elle tient 30 images par seconde ou plus et si le fil principal ne
  // l'explique pas à lui seul. Sinon c'est la machine : les images sont comptées ratées et le diviseur en décide.
  // Un processeur graphique qui ne rend qu'une image sur deux, régulièrement, reste indiscernable d'un écran bridé.
  function bridePossible(C) {
    return C.suiteN * C.periode <= PERIODE_MAX && !(C.travailVu && C.travailMs >= CHARGE * C.periode);
  }
  // bride : la suite de rappels sur un même multiple de la période propose une période précise, vérifiée seule
  // sur ces quelques intervalles (où un peigne fin rangerait la gigue par hasard). douteuse : la période connue
  // n'est pas candidate (voir tropFine).
  function reestimer(C, m, t, bride, douteuse) {
    C.reestimations++;
    const ancien = C.periode;
    const P = bride ? estimer(C, m, C.suiteN * ancien, true) : estimer(C, m, douteuse ? 0 : ancien, false);
    // les images ratées d'avant étaient peut-être jugées sur une grille fausse
    viderFenetre(C);
    if (!P) { ancrer(C, t); return; }
    // Même grille à la gigue près : la période de la droite, tirée de 48 synchronisations, est plus sûre que celle
    // de seize intervalles ; seul le recalage des horodatages récents change.
    const meme = Math.abs(P - ancien) <= MEME * ancien;
    refaire(C, t, C.eNombre, meme ? ancien : P);
    if (!meme && !bride) C.confirmer = BRUTS;
    if (!meme && Math.abs(C.periode - ancien) > CHANGEMENT * ancien) changementPeriode(C, ancien, C.periode, t, bride);
  }
  function changementPeriode(C, ancien, P, t, bride) {
    annulerEssai(C);
    const auto = C.mode === 'auto';
    let premier = false;
    if (bride && P > ancien) {
      // Écran bridé, ou machine qui rend régulièrement une image sur m : la cadence visée est gardée (deux
      // périodes à 60 Hz deviennent une à 30 Hz). La période et le diviseur d'avant restent en mémoire, pour
      // juger l'hypothèse et pour la fin du bridage.
      premier = !(C.fine > 0);
      if (premier) { C.fine = ancien; C.brideDebut = t; C.kAvant = C.k; }
      if (auto) C.k = Math.max(1, Math.round(C.k * ancien / P));
    } else if (C.fine > 0 && Math.abs(P - C.fine) <= CHANGEMENT * C.fine) {
      if (t - C.brideDebut < BRIDE_COURTE) {
        // Bridage démenti en moins de 3 s : c'était la machine, qui rendait une image sur m avec des écarts (60 Hz
        // tenus à peine sur un écran 120 Hz). La cadence tenue est gardée, en périodes de l'écran, et la prochaine
        // hypothèse exigera une suite deux fois plus longue : sans quoi la grille oscillerait entre les deux périodes.
        if (auto) C.k = Math.max(1, Math.round(C.k * ancien / P));
        C.suiteMin = Math.min(SUITE_MAX, 2 * C.suiteMin);
      } else {
        // Fin d'un vrai bridage : l'écran retrouve sa période. Si la cadence tenue (en ms) n'a pas changé depuis
        // le début du bridage, le diviseur d'avant revient aussitôt (30 images par seconde sur un écran 120 Hz bridé
        // à 60 restent 30 ; 60 sur un écran 60 Hz bridé à 30 redeviennent 60), sans repartir de la cadence de
        // l'écran ni rater toutes ses images pendant 1,5 s. Si elle a changé (hausse, essai réussi, machine ralentie
        // prise pour un bridage plus fort), c'est elle qui est convertie. La suite exigée ne redevient courte
        // qu'après un bridage long (BRIDE_LONGUE).
        const pareille = Math.abs(C.k * ancien - C.cadenceBride) <= MEME * C.cadenceBride;
        if (auto) C.k = pareille ? C.kAvant : Math.max(1, Math.round(C.k * ancien / P));
        if (t - C.brideDebut >= BRIDE_LONGUE) C.suiteMin = SUITE;
      }
      C.fine = 0;
    } else {
      // Autre écran. Période plus courte : le mode Auto repart de la cadence de l'écran et réapprend. Un bridage
      // tenu longtemps (BRIDE_LONGUE) était un vrai écran bridé : la suite exigée redevient courte.
      if (auto) C.k = P > ancien ? Math.max(1, Math.round(C.k * ancien / P)) : 1;
      if (C.fine > 0 && t - C.brideDebut >= BRIDE_LONGUE) C.suiteMin = SUITE;
      C.fine = 0;
    }
    ajusterK(C);
    if (premier) C.cadenceBride = C.k * P;
    C.kStable = C.k; C.depuis = 0;
    viderFenetre(C); C.regulier = 0;
  }
  // Rend le nombre de périodes de l'écran écoulées depuis la synchronisation précédente : -1 pour une reprise
  // (premier rappel, après oublier ou une coupure), 0 pour un rappel en double ou en avance sur la grille.
  function horloge(C, t) {
    if (C.reprise || C.tPrec !== C.tPrec) {
      C.reprise = false; C.tPrec = t; C.nBruts = 0; C.sBruts = 0; C.normaux = NORMAUX; C.lent = 0;
      if (C.grille) ancrer(C, t);
      return -1;
    }
    C.brut = t - C.tPrec;
    if (!(C.brut > 0)) {
      // Rappel en double ou un peu en avance : rien. Un horodatage qui recule de plus d'une demi-période (horloge
      // changée, page restaurée) est une reprise, comme dans FLoop : sinon plus rien n'était rendu tant que
      // l'horloge n'avait pas rattrapé l'ancien instant (dix secondes d'écran figé pour un recul de dix secondes).
      if (C.brut < -TOT * (C.periode > 0 ? C.periode : 1000 / 60)) {
        C.tPrec = t; C.nBruts = 0; C.sBruts = 0; C.normaux = NORMAUX; C.lent = 0;
        if (C.grille) ancrer(C, t);
        return -1;
      }
      return 0;
    }
    C.tPrec = t;
    if (C.brut > COUPURE) {
      // Coupure isolée, après des intervalles normaux (onglet, chargement) : un seul pas, rien à rattraper. Des
      // intervalles longs rapprochés sont une machine qui tient moins de quatre images par seconde : image() les
      // rattrape (C.lent), bornés par maxPas comme la boucle d'avant ; un seul pas par image ramenait le temps de jeu
      // à 2 ou 3 % du temps réel. Aucun n'entre dans la grille.
      C.lent = C.normaux >= NORMAUX ? 0 : C.brut; C.normaux = 0;
      C.nBruts = 0; C.sBruts = 0; if (C.grille) ancrer(C, t); return -1;
    }
    if (C.normaux < NORMAUX) C.normaux++;
    C.lent = 0;
    noter(C);
    if (!C.grille) {
      // 24 intervalles, ou 12 s'ils couvrent déjà 300 ms : un écran à 30 Hz a sa grille en 0,4 s
      if (C.nBruts >= AMORCE || (C.nBruts >= AMORCE_MIN && C.sBruts >= AMORCE_MS)) {
        const P = estimer(C, BRUTS, 0, false);
        if (P) { refaire(C, t, C.eNombre, P); C.grille = true; ajusterK(C); C.kStable = C.k; C.confirmer = BRUTS; }
      }
      return 1;
    }
    // Une grille tirée de douze à vingt-quatre intervalles est confirmée sur trente-deux nouveaux : une machine lente
    // dès le départ, aux intervalles mêlés de quatre et cinq périodes, peut tromper la première estimation, et sa
    // grille fausse range assez bien les rappels pour ne jamais être démentie. Une période plus courte la remplace :
    // l'estimation l'a préférée malgré la règle du plus long. Une période plus longue ne la remplace que si la grille
    // connue range les horodatages nettement moins bien que la référence (voir estimer) : des intervalles tous de
    // 50 ms tiennent aussi bien sur 25 que sur 16,7 ms, et la première estimation savait pourquoi. Pas sous
    // l'hypothèse d'un écran bridé : une machine qui ne s'en écarte que rarement y rend déjà la bonne cadence.
    if (C.confirmer > 0 && --C.confirmer === 0 && !(C.fine > 0)) {
      const P = estimer(C, BRUTS, C.periode, false);
      if (P && (P < (1 - MEME) * C.periode || P > (1 + MEME) * C.periode && !(C.rConnue <= DOMINE * C.rPrecis + DOMINE_MS))) {
        reestimer(C, BRUTS, t, false); return 1;
      }
    }
    const P = C.periode, ecart = t - C.phi;
    if (ecart < TOT * P) {
      // entre deux synchronisations de la grille : rien de neuf à montrer
      C.desaccords = (C.desaccords << 1 | 1) & 0xffff; C.suite = 0;
      if (bits(C.desaccords) >= DESACCORDS) { reestimer(C, REEST, t, false); return 1; }
      return 0;
    }
    // Sous l'hypothèse d'un écran bridé, l'accord se juge sur la période d'avant : une machine qui rend une image
    // sur trois d'un écran 144 Hz, parfois sur deux, resterait sinon dans la tolérance de la grille de 21 ms.
    let base = P;
    if (C.fine > 0) base = C.fine;
    const n = Math.round(ecart / P), hors = Math.abs(ecart - n * P) > ACCORD * base;
    // Un rappel sur la grille d'avant mais hors de la grille bridée (trois périodes d'avant quand la bridée en vaut
    // deux) dément aussitôt le bridage : un écran bridé ne présente rien entre ses synchronisations. Attendre quatre
    // désaccords laissait le temps de jeu sauter d'une période à chaque bascule.
    if (hors && C.fine > 0) {
      const m = Math.round(ecart / C.fine);
      if (m > 0 && Math.abs(ecart - m * C.fine) <= ACCORD * C.fine) {
        // le rappel compte les périodes de la nouvelle grille écoulées depuis la synchronisation précédente : en
        // compter une seule ferait perdre au temps de jeu une période bridée à chaque démenti
        reestimer(C, REEST, t, false);
        const nouvelles = Math.round(ecart / C.periode);
        return nouvelles > 1 ? nouvelles : 1;
      }
    }
    C.desaccords = (C.desaccords << 1 | (hors ? 1 : 0)) & 0xffff;
    suivre(C, n);
    if (C.suite >= C.suiteMin && bridePossible(C)) { reestimer(C, C.suiteMin, t, true); return 1; }
    if (!hors) {
      pousser(C, n, t);
      const seuil = RESIDU > RESIDU_PART * P ? RESIDU : RESIDU_PART * P;
      if (C.gC === GRILLE && !(C.confirmer > 0) && C.residu > seuil * seuil) { reestimer(C, REEST, t, false); return 1; }
    } else {
      C.nCour += n; C.phi += n * P;
      if (bits(C.desaccords) >= DESACCORDS) { reestimer(C, REEST, t, false); return 1; }
    }
    return n;
  }
  // Verrou du nombre de pas : la période de l'écran est un multiple du pas à 1 % près (60 Hz : deux pas, 120 Hz :
  // un, 30 Hz : quatre ; 59,94 Hz aussi, le temps de jeu y prend 0,1 % de retard sur l'horloge murale).
  function verrouiller(C) {
    if (!C.grille) { C.verrou = false; return; }
    const H = C.pasMs, m = Math.max(1, Math.round(C.periode / H)), ecart = Math.abs(C.periode - m * H) / (m * H);
    C.verrou = ecart <= (C.verrou ? DEVERROU : VERROU);
    C.pasSync = m;
  }

  // ---------------------------------------------------------------- diviseur
  function kMax(P) { return P > 0 ? Math.max(1, Math.min(K_MAX, Math.floor(PLANCHER * 1.02 / P))) : 1; }
  // Cible imposée ramenée au diviseur de l'écran le plus proche : 60 sur un écran 144 Hz donne 72 images par seconde.
  function kImpose(mode, P) {
    if (mode === 'ecran' || !(P > 0)) return 1;
    return Math.max(1, Math.min(K_MAX, Math.round(1000 / Number(mode) / P)));
  }
  function ajusterK(C) { C.k = C.mode === 'auto' ? Math.min(C.k, kMax(C.periode)) : kImpose(C.mode, C.periode); }
  function viderFenetre(C) { C.fTete = C.fQueue = C.fCompte = C.fRatees = 0; C.fDebut = NaN; }
  function pousserFenetre(C, t, dN, rate) {
    if (C.fDebut !== C.fDebut) C.fDebut = t;
    while (C.fCompte && (t - C.fT[C.fQueue] > FENETRE || C.fCompte === CAP)) {
      if (C.fR[C.fQueue]) C.fRatees--;
      C.fQueue = (C.fQueue + 1) % CAP; C.fCompte--;
    }
    C.fT[C.fTete] = t; C.fD[C.fTete] = dN > 255 ? 255 : dN; C.fR[C.fTete] = rate ? 1 : 0;
    C.fTete = (C.fTete + 1) % CAP; C.fCompte++;
    if (rate) C.fRatees++;
  }
  function annulerEssai(C) { if (C.essai) { C.essai = false; C.k = C.kStable; } }
  function suspendre(C) { annulerEssai(C); viderFenetre(C); C.regulier = 0; }
  // Le diviseur monte au plus petit qui aurait tenu la fenêtre : une machine à 40 images par seconde sur un écran
  // 144 Hz passe directement à 36, sans trois paliers saccadés.
  function augmenter(C, t) {
    const haut = kMax(C.periode);
    let k = C.k + 1;
    for (; k < haut; k++) {
      let r = 0;
      for (let i = 0, j = C.fQueue; i < C.fCompte; i++, j = (j + 1) % CAP) if (C.fD[j] >= k + 1) r++;
      if (r <= SEUIL * C.fCompte) break;
    }
    // retomber peu après un essai réussi : l'essai comptait sur un passage favorable, il est compté raté
    if (t - C.succesA < RECHUTE) { C.echecs++; C.delai *= 2; C.succesA = -Infinity; }
    C.k = C.kStable = k; C.hausses++;
    viderFenetre(C); C.regulier = 0;
  }
  // Grille trop fine : le diviseur est à K_MAX, et plus de 12 % des images de la fenêtre sont ratées alors que la
  // machine les a rendues à 24 par seconde ou plus. Un diviseur plus haut les tiendrait, mais K_MAX l'interdit : sur
  // une grille de moins de 7 ms, le plafond ne vient plus du plancher de 24 images par seconde. C'est une fraction
  // de la vraie période (3,5 ms au lieu de 6,9 après un changement d'écran sous charge : les rappels tombent juste et
  // rien ne la dément, toutes les images ratent sans fin et la qualité Auto tombe au plancher), ou un écran très
  // rapide dont le diviseur n'atteint pas la cadence que la machine tient. Dans les deux cas, la grille est refaite
  // sur les derniers rappels sans la période connue, que la règle du plus long ne retiendrait pas contre ses
  // multiples. Le mode Écran ne vise pas de diviseur : ses images ratées ne disent rien de la grille.
  function tropFine(C, t) {
    if (!(t - C.fDebut >= FENETRE) || C.fine > 0 || C.k < K_MAX || C.mode === 'ecran') return false;
    if (!(Math.floor(PLANCHER * 1.02 / C.periode) > K_MAX) || !(C.fRatees > SEUIL * C.fCompte)) return false;
    let tenables = 0;
    for (let i = 0, j = C.fQueue; i < C.fCompte; i++, j = (j + 1) % CAP) if (C.fR[j] && C.fD[j] * C.periode <= PLANCHER * 1.02) tenables++;
    return tenables > SEUIL * C.fCompte;
  }
  function travailPermis(C) { return !C.travailVu || C.travailMs < PART_TRAVAIL * (C.k - 1) * C.periode; }
  function decider(C, t, dN, rate, reductible) {
    C.images++; if (rate) C.ratees++;
    if (!C.actif) return;
    if (C.essai) {
      C.essaiImages++; if (rate) C.essaiRatees++;
      if (C.essaiRatees >= ESSAI_RATEES) {
        C.essai = false; C.k = C.kStable; C.echecs++; C.delai *= 2; C.regulier = 0; viderFenetre(C);
      } else if (t - C.essaiDebut >= ESSAI) {
        C.essai = false; C.kStable = C.k; C.reussis++; C.delai = REGULARITE; C.succesA = t; C.regulier = 0; viderFenetre(C);
      }
      return;
    }
    pousserFenetre(C, t, dN, rate);
    if (tropFine(C, t)) { C.affinages++; reestimer(C, BRUTS, t, false, true); return; }
    C.regulier = rate ? 0 : C.regulier + dN * C.periode;
    if (C.mode !== 'auto') return;
    // Une suite de rappels longs peut être un écran qui passe à 30 Hz : l'horloge tranche d'abord.
    if (!reductible && (C.suite < 3 || !bridePossible(C)) && C.k < kMax(C.periode) && t - C.fDebut >= FENETRE && C.fRatees > SEUIL * C.fCompte) {
      augmenter(C, t);
    } else if (C.k > 1 && C.echecs < ECHECS && C.regulier >= C.delai && travailPermis(C)) {
      C.essai = true; C.kStable = C.k; C.k--; C.essaiDebut = t; C.essaiImages = C.essaiRatees = 0; C.essais++;
      viderFenetre(C);
    }
  }

  // ---------------------------------------------------------------- appels du jeu
  function finir(C) {
    const S = C.sortie;
    S.periode = (C.periode || 1000 / 60) / 1000;
    S.diviseur = C.k; S.verrouille = C.verrou;
    S.ips = C.intervalleMs ? 1000 / C.intervalleMs : 0;
    S.travail = C.travailVu ? C.travailMs / 1000 : 0;
    return S;
  }
  // À chaque rappel de requestAnimationFrame. rendre faux : ni simulation ni dessin, l'image précédente reste.
  function image(C, t, contexte) {
    const S = C.sortie;
    S.rendre = false; S.pas = 0; S.dt = 0; S.intervalle = 0; S.rate = false;
    if (!Number.isFinite(t)) return finir(C);
    const echelle = contexte && Number.isFinite(contexte.echelle) && contexte.echelle >= 0 ? contexte.echelle : 1;
    const actif = !contexte || contexte.actif !== false;
    if (!actif && C.actif) suspendre(C);
    C.actif = actif;
    const n = horloge(C, t);
    if (n === 0) return finir(C);
    const avant = C.verrou;
    verrouiller(C);
    let ajout;
    if (n < 0) {
      if (C.lent > 0) {
        // Machine durablement très lente (voir horloge) : l'intervalle réel est rattrapé, borné par maxPas plus bas,
        // sans image ratée ni décision.
        ajout = C.lent / C.pasMs * echelle; C.dtCumul = C.lent;
      } else {
        // Reprise : ni rattrapage ni image ratée. Un seul pas, la phase est gardée.
        ajout = echelle; C.attente = 0; C.dtCumul = C.pasMs;
      }
      // La fenêtre de décision repart : ses images datent d'avant la coupure.
      annulerEssai(C); viderFenetre(C);
    } else if (C.verrou) {
      // verrouillé : n synchronisations valent exactement n × m pas
      ajout = n * C.pasSync * echelle;
      if (!avant) C.phase = PHASE;   // verrou acquis : phase calée une fois pour toutes
      C.dtCumul += n * C.pasSync * C.pasMs;
    } else {
      // Non verrouillé : n périodes de la grille. L'écart au temps recalé (dette : droite qui se redresse, grille
      // refaite) est rendu par dixièmes, deux millisecondes au plus comptées à la fois, comme dans FLoop. Avant la
      // grille, l'intervalle brut.
      let dt = C.brut;
      if (C.grille && C.tCale === C.tCale) {
        dt = n * C.periode;
        C.dette += C.phi - C.tCale - dt;
        let fix = (C.dette > DETTE_MAX ? DETTE_MAX : C.dette < -DETTE_MAX ? -DETTE_MAX : C.dette) * DETTE;
        if (C.dette - fix > C.pasMs) fix = C.dette - C.pasMs; else if (C.dette - fix < -C.pasMs) fix = C.dette + C.pasMs;
        dt += fix; C.dette -= fix;
      }
      ajout = dt / C.pasMs * echelle;
      C.dtCumul += dt;
    }
    if (C.verrou || n < 0) C.dette = 0;
    // Les pas entiers vont tels quels à l'attente ; seule la fraction touche la phase. Verrouillé sans ralenti,
    // l'ajout est entier : l'alpha reste le même au bit près, accroc et rattrapage compris.
    const entier = Math.floor(ajout), reste = ajout - entier;
    C.attente += entier;
    if (reste > 0) {
      const x = C.phase + reste;
      if (x >= 1 - 1e-9) { C.attente++; C.phase = x - 1 > 0 ? x - 1 : 0; } else C.phase = x;
    }
    // pas d'opérateur ternaire entre t et phi : V8 emballerait phi dans un nombre du tas à chaque rappel
    if (C.grille) C.tCale = C.phi; else C.tCale = t;
    if (n > 0) C.depuis += n;
    if (n > 0 && C.grille && C.depuis < C.k) return finir(C);
    const dN = n < 0 ? 0 : C.depuis;
    C.depuis = 0;
    // pas fixes : rattrapage borné par maxPas, l'excédent est abandonné et la phase gardée
    let pas = C.attente;
    if (pas > C.maxPas) { C.abandon += pas - C.maxPas; pas = C.maxPas; }
    C.attente = 0;
    const rate = n > 0 && C.grille && dN >= C.k + 1;
    S.rendre = true; S.pas = pas; S.alpha = C.phase;
    S.dt = (C.dtCumul < C.maxPas * C.pasMs ? C.dtCumul : C.maxPas * C.pasMs) / 1000; C.dtCumul = 0;
    S.intervalle = n < 0 ? 0 : C.grille ? dN * C.periode / 1000 : C.tRendu === C.tRendu ? (t - C.tRendu) / 1000 : 0;
    S.rate = rate;
    if (n > 0 && C.tRendu === C.tRendu) {
      // images par seconde lissées sur les intervalles recalés : la gigue des horodatages ne fait pas vaciller 144
      const iv = S.intervalle * 1000;
      C.intervalleMs = C.intervalleMs ? C.intervalleMs + (iv - C.intervalleMs) * .1 : iv;
    }
    C.tRendu = t;
    if (n > 0 && C.grille) decider(C, t, dN, rate, !!(contexte && contexte.qualiteReductible));
    return finir(C);
  }
  // Temps de travail du fil principal (ms) pour l'image qui vient d'être rendue.
  function travail(C, ms) {
    if (!(ms >= 0) || !Number.isFinite(ms)) return;
    C.travailMs = C.travailVu ? C.travailMs + (ms - C.travailMs) * .1 : ms;
    C.travailVu = true;
  }
  function regler(C, mode) {
    C.mode = normaliser(mode);
    annulerEssai(C); viderFenetre(C); C.regulier = 0;
    C.k = 1; ajusterK(C); C.kStable = C.k;
    return C.mode;
  }
  // Après un chargement, un retour d'onglet ou une pause : l'intervalle suivant n'est ni une image ratée ni du
  // temps à rattraper. Le compte des essais ratés de la séance est gardé.
  function oublier(C) { C.reprise = true; annulerEssai(C); }
  // Nouvelle séance : trois essais de retour permis de nouveau ; le diviseur atteint est gardé, les essais le
  // ramèneront si la machine tient mieux.
  function nouvelleSeance(C) {
    annulerEssai(C); C.echecs = 0; C.delai = REGULARITE; C.succesA = -Infinity; C.regulier = 0; viderFenetre(C);
  }
  // Instantané lisible ; sortie (facultatif) est réutilisé, sous-objets compris.
  function etat(C, sortie) {
    const o = sortie || {};
    const P = C.periode;
    o.mode = C.mode; o.periodeMs = P || null; o.hz = P ? 1000 / P : null;
    o.diviseur = C.k; o.diviseurStable = C.essai ? C.kStable : C.k; o.diviseurMax = kMax(P);
    o.cibleMs = P ? P * C.k : null; o.ips = C.intervalleMs ? 1000 / C.intervalleMs : null;
    o.verrouille = C.verrou; o.pasParPeriode = C.verrou ? C.pasSync : null;
    o.grille = C.grille; o.reestimations = C.reestimations; o.grillesTropFines = C.affinages;
    o.bride = C.fine > 0; o.periodeAvantBridageMs = C.fine > 0 ? C.fine : null; o.suiteBridage = C.suiteMin;
    o.images = C.images; o.ratees = C.ratees; o.hausses = C.hausses; o.pasAbandonnes = C.abandon;
    const f = o.fenetre || (o.fenetre = {});
    f.images = C.fCompte; f.ratees = C.fRatees; f.part = C.fCompte ? C.fRatees / C.fCompte : 0;
    o.regulierS = C.regulier / 1000; o.travailMs = C.travailVu ? C.travailMs : null;
    const e = o.essais || (o.essais = {});
    e.enCours = C.essai; e.faits = C.essais; e.rates = C.echecs; e.reussis = C.reussis;
    e.restants = Math.max(0, ECHECS - C.echecs); e.delaiS = C.delai / 1000;
    return o;
  }
  // Débit du rendu principal sur des fenêtres entières de temps réel. Le premier
  // rendu fixe l'origine : il faut N intervalles complets pour annoncer N images/s.
  function compteurImages() { return { debut: null, derniere: null, images: 0, actuel: null, maximum: null }; }
  function releverImage(m, t, cadence) {
    // Avant la première estimation de la période d'écran, le limiteur dessine à
    // chaque RAF : le diviseur demandé en 30/60/120 n'est pas encore appliqué.
    if (cadence && !cadence.grille && cadence.mode !== 'auto' && cadence.mode !== 'ecran') t = null;
    if (t === null) {
      m.debut = m.derniere = m.actuel = null; m.images = 0;
      return;
    }
    if (!Number.isFinite(t) || t === m.derniere) return;
    if (m.debut === null || t < m.derniere) {
      m.debut = m.derniere = t; m.images = 0; m.actuel = null; return;
    }
    m.derniere = t; m.images++;
    const duree = t - m.debut;
    if (duree < 1000) return;
    m.actuel = Math.round(m.images * 1000 / duree);
    m.maximum = Math.max(m.maximum ?? 0, m.actuel);
    m.debut = t; m.images = 0;
  }
  B.cadence = { MODES, creer, image, travail, regler, normaliser, oublier, nouvelleSeance, etat, compteurImages, releverImage };
})(globalThis.BITUME = globalThis.BITUME || {});
