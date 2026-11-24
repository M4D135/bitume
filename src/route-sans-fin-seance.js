// Séance « Route sans fin » : ce que jeu.js pilote à chaque image.
// Possède la fenêtre glissante, la liste des checkpoints (allongée à mesure qu'on avance)
// et la station active ; ne touche à rien d'autre. Déterministe : mêmes positions, même état.
(function (B) {
  'use strict';
  const R = B.routeSansFin, F = B.routeSansFinFenetre;
  const PAS_CHECKPOINT = 1500, AVANCE_FENETRE = 0.25;   // secondes entre deux glissements

  function creer(options = {}) {
    const graine = (options.graine ?? 1) >>> 0;
    const f = F.creer(graine, options);
    const seance = {
      graine,
      fenetre: f,
      c: f.c,
      checkpoints: [],
      prochainCheckpoint: PAS_CHECKPOINT,
      tDepuisGlissement: 0,
      pas: AVANCE_FENETRE,
      station: null,
    };
    allongerCheckpoints(seance, 0);
    return seance;
  }

  function allongerCheckpoints(seance, sAbsMax) {
    while (seance.prochainCheckpoint <= sAbsMax + 4 * PAS_CHECKPOINT) {
      seance.checkpoints.push({ s: seance.prochainCheckpoint, nom: 'checkpoint ' + (seance.checkpoints.length + 1) });
      seance.prochainCheckpoint += PAS_CHECKPOINT;
    }
  }

  // positions : abscisses (relatives au circuit courant) des voitures encore en course.
  // Rend true si la fenêtre a bougé (jeu.js doit alors reconstruire décor et solides).
  function avancer(seance, positions, dt) {
    seance.tDepuisGlissement += dt;
    if (seance.tDepuisGlissement < seance.pas) return false;
    seance.tDepuisGlissement = 0;
    const abs = positions.map(s => seance.fenetre.sOrigine + s);
    const avant = seance.fenetre.k0 + ':' + seance.fenetre.k1;
    const c = F.avancer(seance.fenetre, abs);
    const aBouge = (seance.fenetre.k0 + ':' + seance.fenetre.k1) !== avant || c !== seance.c;
    seance.c = c;
    allongerCheckpoints(seance, Math.max(0, ...abs));
    // la station active du circuit courant, dans son repère ; aucune si hors fenêtre
    const st = F.stationActive(seance.fenetre, Math.max(0, ...abs));
    const cle = st ? st.debut + ':' + st.fin : null;
    if (cle !== (seance.station ? seance.station.debut + ':' + seance.station.fin : null)) {
      seance.station = st;
      if (st) {
        c.stands = { debut: st.debut, fin: st.fin, garage0: st.garage0, garage1: st.garage1, cote: st.cote, vitesse: 11 };
        B.circuit.preparerStands(c);
      } else c.stands = null;
      return true;   // les limites et la voie des stands viennent d'être posées : décor à reprendre
    }
    return aBouge;
  }

  B.routeSansFinSeance = { creer, avancer, PAS_CHECKPOINT, AVANCE_FENETRE };
})(globalThis.BITUME = globalThis.BITUME || {});
