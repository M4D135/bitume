/* BITUME — état de chaussée commun à la conduite, aux rivaux et au conseil de pneus. */
(function (B) {
  'use strict';
  const VIDE = Object.freeze({});
  const borner = x => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
  const objet = x => x && typeof x === 'object' ? x : VIDE;

  // Initialisation de séance seulement : la couverture reste explicite, indépendante des flocons.
  // .75 décrit la route du paysage hivernal du jeu, pas une profondeur mesurée de neige.
  // Une couverture fournie par la préparation/l'hôte est conservée, y compris zéro.
  function preparer(m, profilSaison) {
    m = m && typeof m === 'object' ? m : {};
    const p = objet(profilSaison), sud = p.theme === 'cote';
    m.precipitationsNeige = !sud && (m.reel === true ? m.neige === true : p.neige === true);
    m.neigeSol = sud ? 0 : Number.isFinite(m.neigeSol) ? borner(m.neigeSol) : p.neige === true ? .75 : 0;
    return m;
  }

  // Lecture sans mutation ni évolution temporelle ; passer une sortie propre à l'appelant évite
  // toute allocation au pas de simulation. Les limites de tunnel restent celles du circuit.
  function lire(c, s, meteo, sortie) {
    const m = objet(meteo === undefined ? B.meteo && B.meteo.actuel : meteo);
    const out = sortie && typeof sortie === 'object' ? sortie : {};
    const abri = !!(c && Number.isFinite(s) && B.circuit && typeof B.circuit.dansCouvert === 'function'
      && B.circuit.dansCouvert(c, s));
    const flocons = typeof m.precipitationsNeige === 'boolean' ? m.precipitationsNeige : m.reel === true && m.neige === true;
    // .6 conserve la pondération historique de l'eau résiduelle. Une chute de neige n'est
    // pas une pluie liquide ; de l'eau déjà présente peut néanmoins coexister avec la neige.
    out.eau = abri ? 0 : Math.max(flocons ? 0 : borner(m.pluie), .6 * borner(m.mouille));
    out.neige = abri ? 0 : borner(m.neigeSol);
    out.abri = abri;
    return out;
  }

  B.chaussee = { preparer, lire };
})(globalThis.BITUME = globalThis.BITUME || {});
