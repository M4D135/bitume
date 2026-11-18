/* BITUME — jour et nuit sur les circuits ; palette féerique réservée à Haut-Col. */
(function (B) {
  'use strict';
  const MODES = Object.freeze(['jour', 'crepuscule', 'nuit', 'cycle']);
  const DUREE_CYCLE = 360;
  const CHAMPS = ['skyTop', 'skyBottom', 'fog', 'sunColor', 'ambient'];
  const CREPUSCULE = Object.freeze({
    skyTop: [.095, .075, .22], skyBottom: [.62, .29, .28], fog: [.23, .24, .34],
    sunColor: [.69, .43, .32], ambient: [.24, .24, .34],
  });
  const NUIT = Object.freeze({
    skyTop: [.004, .008, .027], skyBottom: [.025, .047, .105], fog: [.035, .061, .115],
    sunColor: [.23, .32, .48], ambient: [.15, .20, .30],
  });
  const CREPUSCULE_NATURE = Object.freeze({
    skyTop: [.10, .115, .19], skyBottom: [.66, .35, .23], fog: [.24, .27, .32],
    sunColor: [.76, .49, .32], ambient: [.25, .26, .30],
  });
  const NUIT_NATURE = Object.freeze({
    skyTop: [.006, .012, .025], skyBottom: [.035, .055, .085], fog: [.045, .065, .095],
    sunColor: [.25, .31, .40], ambient: [.17, .20, .25],
  });
  const lisser = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  const normaliser = mode => MODES.includes(mode) ? mode : 'jour';

  function creer(base, montagne) {
    const jour = {}, atmosphere = { ...base, night: 0 };
    for (const cle of CHAMPS) {
      jour[cle] = Array.from(base[cle]);
      atmosphere[cle] = Array.from(base[cle]);
    }
    return { montagne: !!montagne, jour, atmosphere, nuit: 0, revision: 0, valeur: -1 };
  }

  function appliquer(etat, mode, temps) {
    mode = normaliser(mode);
    const t = Number.isFinite(temps) ? Math.max(0, temps) : 0;
    const elevation = Math.cos((t % DUREE_CYCLE) * Math.PI * 2 / DUREE_CYCLE);
    const nuit = mode === 'jour' ? 0 : mode === 'nuit' ? 1 : mode === 'crepuscule' ? .5
      : 1 - lisser((elevation + .25) / .8);
    etat.nuit = nuit;
    // Pas de normalisation/allocation moteur à chaque image : un changement de 1/512 suffit pour la lumière.
    const valeur = Math.round(nuit * 512);
    if (valeur === etat.valeur) return etat;
    etat.valeur = valeur;
    const crepuscule = etat.montagne ? CREPUSCULE : CREPUSCULE_NATURE, cielNuit = etat.montagne ? NUIT : NUIT_NATURE;
    const n = valeur / 512, debut = n <= .5 ? etat.jour : crepuscule, fin = n <= .5 ? crepuscule : cielNuit;
    const melange = lisser(n <= .5 ? n * 2 : (n - .5) * 2);
    for (const cle of CHAMPS) for (let i = 0; i < 3; i++)
      etat.atmosphere[cle][i] = debut[cle][i] + (fin[cle][i] - debut[cle][i]) * melange;
    etat.atmosphere.night = n;
    etat.revision++;
    return etat;
  }

  B.ambiance = { MODES, DUREE_CYCLE, normaliser, creer, appliquer };
})(globalThis.BITUME = globalThis.BITUME || {});
