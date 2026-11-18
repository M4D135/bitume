/* BITUME — gouverneur de qualité, en temps réel visible. Une décision vaut pour toutes les vues de la séance. */
(function (B) {
  'use strict';
  const FENETRE = 3, REMONTEE = 8, LENT = 1 / 50, AISE = .014, EPS = 1e-9;
  // Avec l'option periode (période de l'écran × diviseur de la cadence, en secondes), les seuils suivent la cadence
  // visée au lieu de supposer 60 Hz : 20 ms de moyenne sont une machine lente à 60 Hz, une machine à l'aise à 30 Hz.
  const TROP = 1.2;             // moyenne de la fenêtre, en périodes, au-delà de laquelle la qualité baisse
  const ECARTE = 3, ECARTE_MAX = .25; // intervalle écarté (accroc isolé, reprise) : plus de 3 périodes ou de 0,25 s
  const CONFORT = .5;           // part de la période que le travail du fil principal ne dépasse pas pour remonter
  const REESSAI = 20;           // secondes avant de réessayer un niveau qui a échoué, doublées à chaque échec
  function vider(palier) { palier.somme = palier.compte = palier.t = palier.aise = 0; }
  // Mémoire des échecs, créée au premier usage du mode période : un palier sans période garde ses cinq champs.
  function memoire(palier, maximum) {
    if (!Array.isArray(palier.echecs)) { palier.echecs = []; palier.reessai = []; palier.horloge = 0; }
    while (palier.echecs.length <= maximum) { palier.echecs.push(0); palier.reessai.push(0); }
  }
  function avancerPeriode(palier, dtReel, minimum, maximum, periode, travail) {
    // Pas de période connue : rien à juger. Un accroc isolé ou une reprise ne dit rien de la charge du rendu.
    if (!(periode > 0) || !Number.isFinite(periode)) return false;
    if (dtReel > ECARTE * periode + EPS || dtReel > ECARTE_MAX + EPS) return false;
    memoire(palier, maximum);
    palier.horloge += dtReel;
    // Intervalles comptés en périodes : un essai de la cadence ou un écran bridé en cours de fenêtre ne fausse pas
    // la moyenne.
    palier.somme = (palier.somme || 0) + dtReel / periode;
    palier.compte = (palier.compte || 0) + 1;
    palier.t = (palier.t || 0) + dtReel;
    const moyenne = palier.somme / palier.compte;
    // La remontée ne se juge que sur le travail du fil principal : synchronisés sur l'écran, les intervalles ne
    // descendent jamais sous la période et ne disent pas la marge. Elle exige aussi une fenêtre sans lenteur.
    const confort = Number.isFinite(travail) && travail >= 0 && travail < CONFORT * periode && moyenne <= TROP + EPS;
    if (confort && palier.n > minimum) palier.aise = (palier.aise || 0) + dtReel;
    else palier.aise = 0;
    if (palier.t >= FENETRE - EPS) {
      palier.somme = palier.compte = palier.t = 0;
      if (moyenne > TROP + EPS && palier.n < maximum) {
        // Le niveau quitté a échoué : il ne sera réessayé qu'après un délai doublé à chaque échec de la séance.
        const quitte = palier.n;
        palier.echecs[quitte]++;
        palier.reessai[quitte] = palier.horloge + REESSAI * Math.pow(2, palier.echecs[quitte] - 1);
        palier.n++; palier.aise = 0;
        return true;
      }
    }
    if (palier.aise >= REMONTEE - EPS && palier.n > minimum && palier.horloge >= palier.reessai[palier.n - 1] - EPS) {
      palier.n--; vider(palier); return true;
    }
    return false;
  }
  function avancer(palier, dtReel, { actif = true, min = 0, max = 4, periode, travail } = {}) {
    // Une vue masquée, un banc à qualité fixe ou un mode manuel ne contribue à aucune décision ultérieure.
    if (!actif) { vider(palier); return false; }
    if (!(dtReel > 0) || !Number.isFinite(dtReel)) return false;
    const minimum = Math.max(0, Math.floor(Number.isFinite(min) ? min : 0));
    const maximum = Math.max(minimum, Math.floor(Number.isFinite(max) ? max : 4));
    const niveau = Number.isFinite(palier.n) ? Math.floor(palier.n) : minimum;
    const borne = Math.max(minimum, Math.min(maximum, niveau));
    if (borne !== palier.n) { palier.n = borne; vider(palier); return true; }
    if (periode !== undefined) return avancerPeriode(palier, dtReel, minimum, maximum, periode, travail);

    palier.somme = (palier.somme || 0) + dtReel;
    palier.compte = (palier.compte || 0) + 1;
    palier.t = (palier.t || 0) + dtReel;
    const moyenne = palier.somme / palier.compte;
    // La remontée exige huit secondes de moyennes confortables successives. Un intervalle isolé est intégré
    // à la moyenne de la fenêtre courante ; les frontières de fenêtres ne conservent pas une ancienne charge.
    if (moyenne < AISE - EPS && palier.n > minimum) palier.aise = (palier.aise || 0) + dtReel;
    else palier.aise = 0;

    if (palier.t >= FENETRE - EPS) {
      palier.somme = palier.compte = palier.t = 0;
      if (moyenne > LENT + EPS && palier.n < maximum) { palier.n++; palier.aise = 0; return true; }
    }
    if (palier.aise >= REMONTEE - EPS && palier.n > minimum) { palier.n--; vider(palier); return true; }
    return false;
  }
  // Nouvelle séance : les niveaux qui ont échoué redeviennent essayables sans délai ; le niveau atteint est gardé.
  function nouvelleSeance(palier) {
    vider(palier);
    if (Array.isArray(palier.echecs)) { palier.echecs.fill(0); palier.reessai.fill(0); palier.horloge = 0; }
  }
  B.qualite = { avancer, nouvelleSeance };
})(globalThis.BITUME = globalThis.BITUME || {});
