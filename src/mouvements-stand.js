/* BITUME — lectures des gestes CMU au stand, dans le repère du mécanicien. */
(function (B) {
  'use strict';
  if (!B.donneesMouvementsStand && typeof module !== 'undefined' && module.exports)
    require('./mouvements-stand-data.js');
  const { marche, accroupissement } = B.donneesMouvementsStand;

  function phaseMarche(temps) {
    if (!Number.isFinite(temps)) return 0;
    const cycle = temps / marche.duree;
    return cycle - Math.floor(cycle);
  }
  function interpoler(points, canaux, facteur, phase, sortie) {
    const fin = points.length / canaux - 1, image = phase * fin;
    const i = Math.max(0, Math.min(Math.floor(image), fin - 1));
    const t = phase >= 1 ? 1 : image - i;
    const a = i * canaux, b = Math.min(i + 1, fin) * canaux;
    for (let k = 0; k < canaux; k++) {
      const valeur = t === 1 ? points[b + k] : points[a + k] + (points[b + k] - points[a + k]) * t;
      sortie[k] = valeur * facteur;
    }
    return sortie;
  }
  // Angles en radians. Hanche G, genou G, hanche D, genou D, épaule G, coude G,
  // épaule D, coude D. Hanche et épaule positives vers l'avant à partir de la verticale.
  function lireMarche(temps, sortie) {
    return interpoler(marche.angles, 8, .001, phaseMarche(temps), sortie);
  }
  function lireAccroupissement(progression, sortie) {
    const phase = Number.isFinite(progression) ? Math.min(1, Math.max(0, progression)) : 0;
    return interpoler(accroupissement.angles, 8, .001, phase, sortie);
  }
  // Poids de contact mesurés, pied gauche puis pied droit. 1 = appui au sol.
  function lireAppuis(temps, sortie) {
    return interpoler(marche.appuis, 2, 1/255, phaseMarche(temps), sortie);
  }
  B.mouvementsStand = { lireMarche, lireAppuis, lireAccroupissement,
    periodeMarche: marche.duree, longueurFoulee: marche.distance, dureeAccroupissement: accroupissement.duree };
})(globalThis.BITUME = globalThis.BITUME || {});
