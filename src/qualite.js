/* BITUME — gouverneur de qualité, en temps réel visible. Une décision vaut pour toutes les vues de la séance. */
(function (B) {
  'use strict';
  const FENETRE = 3, REMONTEE = 8, LENT = 1 / 50, AISE = .014, EPS = 1e-9;
  function vider(palier) { palier.somme = palier.compte = palier.t = palier.aise = 0; }
  function avancer(palier, dtReel, { actif = true, min = 0, max = 4 } = {}) {
    // Une vue masquée, un banc à qualité fixe ou un mode manuel ne contribue à aucune décision ultérieure.
    if (!actif) { vider(palier); return false; }
    if (!(dtReel > 0) || !Number.isFinite(dtReel)) return false;
    const minimum = Math.max(0, Math.floor(Number.isFinite(min) ? min : 0));
    const maximum = Math.max(minimum, Math.floor(Number.isFinite(max) ? max : 4));
    const niveau = Number.isFinite(palier.n) ? Math.floor(palier.n) : minimum;
    const borne = Math.max(minimum, Math.min(maximum, niveau));
    if (borne !== palier.n) { palier.n = borne; vider(palier); return true; }

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
  B.qualite = { avancer };
})(globalThis.BITUME = globalThis.BITUME || {});
