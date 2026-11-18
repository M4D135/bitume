/* BITUME — vibrations de manette, ressenties à la main.
   Quatre sorties continues (faible, fort, gâchette gauche/droite), calculées au pas dt
   pour le même ressenti à 30, 60 ou 120 images par seconde. Aucun état global : chaque
   manette porte son propre état V. Rien n'est alloué pendant calculer. */
(function (B) {
  'use strict';

  // Sous ce seuil le moteur de la manette est parfaitement silencieux : on coupe net
  // pour éviter un bourdonnement de fond qui fatigue la main.
  var SEUIL = 0.03;

  // Les moteurs d'une manette ne suivent pas une modulation d'amplitude au-delà d'une
  // quinzaine de hertz, et le jeu ne peut reprogrammer l'effet qu'environ 30 fois par
  // seconde : tous les battements restent sous 15 Hz pour être perçus à la main sans
  // repliement de spectre, quelle que soit la cadence d'appel (30, 60 ou 120 Hz).
  var FREQ_RUPTEUR = 12;           // crépitement en haut régime
  var FREQ_BLOCAGE = 10;           // pulsation de la roue bloquée au frein
  var FREQ_PATINAGE = 12;          // pulsation de la roue qui patine
  var FREQ_GLISSE_AR = 8;          // frémissement lent du train arrière qui part
  var FREQ_GLISSE_AV = 11;         // frémissement plus aigu du train avant
  var FREQ_FENETRE = 12;           // signal de relâchement de la dérive chargée
  var VIBREUR_HZ_PAR_MS = 1 / 3.6; // dents tous les 3,6 m : rythme = v / 3.6
  var VIBREUR_MIN = 3;             // plancher à très basse vitesse
  var VIBREUR_MAX = 14;            // plafond : sature vers 50 m/s, reste sous 15 Hz

  function creer() {
    return {
      // Phases d'oscillateurs, accumulées avec dt (jamais le temps absolu) pour que
      // les battements restent cohérents quand la cadence change.
      phVibreur: 0, phHerbe1: 0, phHerbe2: 0, phHerbe3: 0,
      phGlisseAr: 0, phGlisseAv: 0, phBlocage: 0, phPatinage: 0,
      phRupteur: 0, phDerive: 0, phFenetre: 0,
      // Enveloppes d'événements : valeur courante et durée de retombée (s) de l'effet
      // retenu. Les pics ne s'additionnent pas : on garde le plus fort sur le moteur
      // lourd, qui décroît ensuite de façon exponentielle.
      envFort: 0, decFort: 0.35,
      envRapportGD: 0, // coup de passage sur la gâchette droite, indépendant
      envTic: 0,       // « tic » de montée de niveau de dérive sur le moteur lourd
      envDerive: 0,    // battement de dérive déclenché au tour de phase, retombée 0,07 s
      dernierNiveau: -1, // niveau de dérive vu au pas précédent, pour détecter la montée
      // Sorties lissées au temps : la montée est vive, la descente plus douce.
      lFaible: 0, lFort: 0, lGG: 0, lGD: 0,
      // Entrée vide réutilisée : évite toute propriété créée à la volée sur V.
      vide: {},
      // Objet de sortie réutilisé à chaque appel : calculer ne doit rien allouer.
      sortie: { faible: 0, fort: 0, gachetteG: 0, gachetteD: 0 }
    };
  }

  function calculer(V, entree, dt) {
    var e = entree || V.vide;

    // Lecture défensive : tout champ absent vaut 0 ou faux, jamais NaN.
    var regime = +e.regime || 0;
    var ralenti = +e.ralenti || 0;
    var maxUtile = +e.maxUtile || 0;
    var gaz = +e.gaz || 0;
    var frein = +e.frein || 0;
    var v = +e.v || 0;
    var surface = e.surface || 'piste';
    var vibreur = !!e.vibreur;
    var patinage = +e.patinage || 0;
    var blocage = +e.blocage || 0;
    var glisseAr = +e.glisseAr || 0;
    var glisseAv = +e.glisseAv || 0;
    var bosse = +e.bosse || 0;
    var turbo = +e.turbo || 0;
    var force = e.force == null ? 0.5 : +e.force;
    if (!(force > 0)) force = 0;
    if (force > 1) force = 1;
    // dt absent, négatif ou non fini vaut 0 ; un très grand dt (retour d'onglet) est borné à un quart de
    // seconde, sinon une phase infinie donnerait un sinus NaN sur toutes les sorties.
    var pas = +dt;
    if (!(pas > 0)) pas = 0; else if (pas > 0.25) pas = 0.25;

    var absV = v < 0 ? -v : v;

    // Contributions brutes par sortie, sommées avant mise en forme.
    var cFaible = 0, cFort = 0, cGG = 0, cGD = 0;

    // a. Moteur : grondement très discret, qui monte avec le régime et la charge.
    // Le carré de r garde le bas régime presque silencieux ; la base de 0.03 ne s'ajoute
    // que si la voiture tourne vraiment, pour que le ralenti à l'arrêt reste sous le seuil.
    var denom = maxUtile - ralenti;
    var r = denom > 0 ? (regime - ralenti) / denom : 0;
    if (r < 0) r = 0; else if (r > 1) r = 1;
    var motActif = r > 0.001 || gaz > 0.001 || absV > 0.05;
    if (motActif) cFort += 0.03 + 0.22 * r * r * (0.3 + 0.7 * gaz);
    // Rupteur : crépitement sec en haut régime, senti sur le léger et la gâchette droite.
    if (r > 0.97) {
      V.phRupteur += FREQ_RUPTEUR * pas;
      V.phRupteur -= (V.phRupteur | 0);
      var rup = V.phRupteur < 0.5 ? 1 : 0;
      cFaible += 0.25 * rup;
      cGD += 0.3 * rup;
    }

    // b. Route : roulement léger proportionnel à la vitesse, les bosses cognent le lourd.
    cFaible += 0.1 * (absV / 90 < 1 ? absV / 90 : 1);
    cFort += bosse * 0.5;

    // c. Vibreur : dents régulières tous les 3,6 m, donc la fréquence suit la vitesse.
    // Onde carrée adoucie (tangente hyperbolique du sinus) pour un battement franc
    // sans clic numérique ; la phase est accumulée, jamais déduite du temps absolu.
    if (vibreur && absV > 0.01) {
      var freqV = absV * VIBREUR_HZ_PAR_MS;
      if (freqV < VIBREUR_MIN) freqV = VIBREUR_MIN; else if (freqV > VIBREUR_MAX) freqV = VIBREUR_MAX;
      V.phVibreur += freqV * pas;
      V.phVibreur -= (V.phVibreur | 0);
      var sV = Math.sin(6.283185307179586 * V.phVibreur);
      var ondeV = (1 + Math.tanh(2.5 * sV)) * 0.5;
      cFort += 0.55 * ondeV;
      cFaible += 0.45 * ondeV;
    }

    // d. Herbe et gravier : grondement irrégulier, somme de trois fréquences sans rapport
    // simple pour éviter un ronronnement périodique ; le gravier mord 1,3 fois plus.
    if (surface === 'herbe' || surface === 'gravier') {
      V.phHerbe1 += 7 * pas;    V.phHerbe1 -= (V.phHerbe1 | 0);
      V.phHerbe2 += 11.3 * pas; V.phHerbe2 -= (V.phHerbe2 | 0);
      V.phHerbe3 += 13.7 * pas; V.phHerbe3 -= (V.phHerbe3 | 0);
      var irr = (Math.sin(6.283185307179586 * V.phHerbe1)
        + Math.sin(6.283185307179586 * V.phHerbe2)
        + Math.sin(6.283185307179586 * V.phHerbe3)) / 3;
      var rug = (irr + 1) * 0.5; // ramené dans [0, 1]
      var vitSol = absV / 26 < 1 ? absV / 26 : 1;
      var coefSol = surface === 'gravier' ? 1.3 : 1;
      cFort += 0.45 * vitSol * rug * coefSol;
      cFaible += 0.3 * vitSol * rug * coefSol;
    }

    // e. Glisses : l'arrière qui part vibre le léger avec un frémissement lent, l'avant
    // plus aigu ; la profondeur de 30 % garde une composante continue sous le tremblement.
    if (glisseAr > 0) {
      V.phGlisseAr += FREQ_GLISSE_AR * pas; V.phGlisseAr -= (V.phGlisseAr | 0);
      var tremAr = 0.7 + 0.3 * ((Math.sin(6.283185307179586 * V.phGlisseAr) + 1) * 0.5);
      cFaible += 0.45 * glisseAr * tremAr;
    }
    if (glisseAv > 0) {
      V.phGlisseAv += FREQ_GLISSE_AV * pas; V.phGlisseAv -= (V.phGlisseAv | 0);
      var tremAv = 0.7 + 0.3 * ((Math.sin(6.283185307179586 * V.phGlisseAv) + 1) * 0.5);
      cFaible += 0.25 * glisseAv * tremAv;
    }

    // f. Blocage au frein : la gâchette gauche pulse pour signaler la roue qui frotte.
    var bEff = blocage < 1 ? blocage : 1; if (bEff < 0) bEff = 0;
    if (bEff > 0) {
      V.phBlocage += FREQ_BLOCAGE * pas; V.phBlocage -= (V.phBlocage | 0);
      cGG += bEff * 0.9 * (V.phBlocage < 0.5 ? 1 : 0);
      cFort += 0.2 * bEff;
    }

    // g. Patinage : la gâchette droite pulse, symétrique du blocage, pour la roue qui chasse.
    var pEff = patinage < 1 ? patinage : 1; if (pEff < 0) pEff = 0;
    if (pEff > 0) {
      V.phPatinage += FREQ_PATINAGE * pas; V.phPatinage -= (V.phPatinage | 0);
      cGD += pEff * 0.8 * (V.phPatinage < 0.5 ? 1 : 0);
      cFaible += 0.3 * pEff;
    }

    // h. Événements : chocs et passages donnent des pics qui retombent seuls. On garde le
    // plus fort sur chaque canal (pas d'addition) puis on le laisse décroître avec dt.
    var evs = e.evenements;
    if (evs && evs.length) {
      for (var i = 0; i < evs.length; i++) {
        var ev = evs[i];
        var type = ev.type;
        var fEv = +ev.force || 0;
        if (type === 'rapport') {
          if (0.6 >= V.envFort) { V.envFort = 0.6; V.decFort = 0.09; }
          if (0.5 >= V.envRapportGD) V.envRapportGD = 0.5;
        } else if (type === 'choc' || type === 'contact') {
          var picC = (fEv - 2) / 28; if (picC < 0) picC = 0; else if (picC > 1) picC = 1; picC *= 0.95;
          if (picC >= V.envFort) { V.envFort = picC; V.decFort = 0.35; }
        } else if (type === 'roue' || type === 'casse') {
          if (0.9 >= V.envFort) { V.envFort = 0.9; V.decFort = 0.5; }
        } else if (type === 'atterrissage') {
          if (0.7 >= V.envFort) { V.envFort = 0.7; V.decFort = 0.2; }
        }
      }
    }

    // i. Dérive chargée : battement lent qui s'accélère avec le niveau pour faire sentir
    // la montée en charge, tic franc au changement de niveau, et frémissement rapide dans
    // la fenêtre de relâchement parfait — le signal « lâchez maintenant ».
    var derive = e.derive;
    if (derive) {
      var fen = +derive.fenetre || 0;
      if (derive.actif) {
        var niveau = (derive.niveau | 0);
        if (niveau < 0) niveau = 0; else if (niveau > 3) niveau = 3;
        var freqD = 2 + 2 * niveau; // 2, 4, 6, 8 Hz
        V.phDerive += freqD * pas;
        if (V.phDerive >= 1) {
          // Déclenchement au passage de la phase par 1 : une enveloppe brève remplace
          // l'impulsion de 15 ms, impossible à échantillonner de façon fiable à 30 Hz.
          // Un seul déclenchement même si dt couvre plusieurs tours d'un coup.
          V.phDerive -= (V.phDerive | 0);
          V.envDerive = 0.18 + 0.08 * niveau;
        }
        // Tic quand le niveau monte par rapport au dernier niveau actif connu, même si la
        // dérive a été coupée entre-temps : la main doit sentir la reprise plus chargée.
        if (V.dernierNiveau >= 0 && niveau > V.dernierNiveau) {
          V.envTic = 0.5; // pic retenu séparément, retombée fixe 0,08 s
        }
        V.dernierNiveau = niveau;
      }
      if (fen > 0) {
        V.phFenetre += FREQ_FENETRE * pas; V.phFenetre -= (V.phFenetre | 0);
        var tremF = (V.phFenetre < 0.5 ? 1 : 0) * 0.6;
        cFaible += tremF;
        cFort += tremF;
      }
    }

    // Décroissance exponentielle des enveloppes. La constante 4/durée amène un pic sous
    // le seuil bien avant 6× la durée, ce qui correspond au retour demandé par les tests.
    if (V.envFort > 0) {
      cFort += V.envFort;
      V.envFort *= Math.exp(-pas * 4 / (V.decFort || 0.35));
      if (V.envFort < 1e-6) V.envFort = 0;
    }
    if (V.envRapportGD > 0) {
      cGD += V.envRapportGD;
      V.envRapportGD *= Math.exp(-pas * 4 / 0.09);
      if (V.envRapportGD < 1e-6) V.envRapportGD = 0;
    }
    if (V.envTic > 0) {
      cFort += V.envTic;
      V.envTic *= Math.exp(-pas * 4 / 0.08);
      if (V.envTic < 1e-6) V.envTic = 0;
    }
    // Battement de dérive : enveloppe déclenchée au tour de phase (pas une fenêtre étroite),
    // pour rester identique à 30, 60 ou 120 Hz ; retombée en 0,07 s sur le moteur léger.
    if (V.envDerive > 0) {
      cFaible += V.envDerive;
      V.envDerive *= Math.exp(-pas * 4 / 0.07);
      if (V.envDerive < 1e-6) V.envDerive = 0;
    }

    // j. Turbo : poussée grave franche et contre-pression sur la gâchette droite.
    if (turbo > 0) {
      cFort += 0.5 * turbo;
      cGD += 0.4 * turbo;
    }

    // k. Mise en forme : compression douce pour garder de la marge, gain joueur, lissage
    // au temps (montée vive 15 ms, descente plus lente 60 ms) puis coupure sous le seuil.
    var gain = force * 2; if (gain > 1) gain = 1;
    var s = V.sortie;
    s.faible = cFaible; s.fort = cFort; s.gachetteG = cGG; s.gachetteD = cGD;

    // Faible
    var x = s.faible; if (x < 0) x = 0; x = x / (1 + 0.6 * x) * 1.6; if (x > 1) x = 1; x *= gain;
    var coef = x > V.lFaible ? (1 - Math.exp(-pas / 0.015)) : (1 - Math.exp(-pas / 0.06));
    V.lFaible += (x - V.lFaible) * coef; if (V.lFaible < SEUIL) V.lFaible = 0; s.faible = V.lFaible;
    // Fort
    x = s.fort; if (x < 0) x = 0; x = x / (1 + 0.6 * x) * 1.6; if (x > 1) x = 1; x *= gain;
    coef = x > V.lFort ? (1 - Math.exp(-pas / 0.015)) : (1 - Math.exp(-pas / 0.06));
    V.lFort += (x - V.lFort) * coef; if (V.lFort < SEUIL) V.lFort = 0; s.fort = V.lFort;
    // Gâchette gauche
    x = s.gachetteG; if (x < 0) x = 0; x = x / (1 + 0.6 * x) * 1.6; if (x > 1) x = 1; x *= gain;
    coef = x > V.lGG ? (1 - Math.exp(-pas / 0.015)) : (1 - Math.exp(-pas / 0.06));
    V.lGG += (x - V.lGG) * coef; if (V.lGG < SEUIL) V.lGG = 0; s.gachetteG = V.lGG;
    // Gâchette droite
    x = s.gachetteD; if (x < 0) x = 0; x = x / (1 + 0.6 * x) * 1.6; if (x > 1) x = 1; x *= gain;
    coef = x > V.lGD ? (1 - Math.exp(-pas / 0.015)) : (1 - Math.exp(-pas / 0.06));
    V.lGD += (x - V.lGD) * coef; if (V.lGD < SEUIL) V.lGD = 0; s.gachetteD = V.lGD;

    return s;
  }

  B.vibrations = { creer: creer, calculer: calculer, SEUIL: SEUIL };
})(globalThis.BITUME = globalThis.BITUME || {});
