// Fenêtre glissante de la Route sans fin : le monde autour des joueurs, mémoire bornée.
// La fenêtre ne dépend que des positions absolues des joueurs (déterminisme) ; les pilotes
// gardent leur abscisse absolue (course.js, sansFin.sAbsolu) et la fenêtre ne fait que
// traduire entre l'abscisse du circuit courant et l'abscisse absolue de la route.
(function (B) {
  'use strict';
  const R = B.routeSansFin;
  const DERRIERE = 600, DEVANT = 1400, MARGE_SEG = 400;

  function creer(graine, options = {}) {
    const f = {
      graine: graine >>> 0,
      k0: 0, k1: 0,                 // tronçons [k0, k1[ dans la fenêtre
      sOrigine: 0,                  // abscisse absolue du s = 0 du circuit courant
      longueur: 0,
      c: null,
      derriere: options.derriere ?? DERRIERE,
      devant: options.devant ?? DEVANT,
      maxSegments: options.maxSegments ?? 6,
    };
    etendre(f, f.devant);
    f.c = construire(f);
    return f;
  }

  function sAbsolu(f, s) { return f.sOrigine + s; }
  function sFenetre(f, sAbs) { return sAbs - f.sOrigine; }

  // ajouter des tronçons jusqu'à couvrir l'abscisse absolue demandée
  function etendre(f, sCible) {
    while (f.sOrigine + f.longueur < sCible + MARGE_SEG && f.k1 - f.k0 < f.maxSegments) {
      const seg = R.pointsSegment(f.k1, f.graine);
      f.k1++;
      f.longueur += seg.profil.L;
    }
  }

  // positions : abscisses absolues des joueurs vivants (tableau). Avance la fenêtre,
  // libère derrière, et rend le circuit courant (régénéré seulement si la fenêtre bouge).
  function avancer(f, positions) {
    const vivantes = positions.filter(s => Number.isFinite(s));
    if (!vivantes.length) return f.c;
    const mini = Math.min(...vivantes), maxi = Math.max(...vivantes);
    const avant = f.k0 + ':' + f.k1;
    let change = false;
    etendre(f, maxi + f.devant);
    // libérer derrière : on n'avance l'origine que si le joueur le plus en arrière est
    // hors de portée ET qu'il reste assez de route devant lui dans la fenêtre
    while (f.k1 - f.k0 > 2 && mini - f.derriere > f.sOrigine + R.pointsSegment(f.k0, f.graine).profil.L) {
      f.sOrigine += R.pointsSegment(f.k0, f.graine).profil.L;
      f.longueur -= R.pointsSegment(f.k0, f.graine).profil.L;
      f.k0++;
      change = true;
    }
    if (change) etendre(f, maxi + f.devant);   // la libération derrière libère du quota devant
    if (f.k0 + ':' + f.k1 !== avant || !f.c) f.c = construire(f);   // devant comme derrière : le circuit doit suivre
    return f.c;
  }

  function construire(f) {
    const trace = R.creerTrace(f.k0, f.k1, f.graine);
    const c = B.circuit.creerDepuisTrace(trace, { topologie: 'ouvert' });
    B.circuit.preparerParcours(c);
    c.sansFinFenetre = { k0: f.k0, k1: f.k1, sOrigine: f.sOrigine };
    return c;
  }

  // la station active (encore devant le joueur le plus avancé) en abscisses de la fenêtre
  function stationActive(f, sAbsMax) {
    const liste = R.stationsEntre(f.sOrigine, f.sOrigine + f.longueur + f.devant, f.graine);
    const st = R.stationActive(sAbsMax, liste);
    if (!st) return null;
    return { debut: st.debutAbs - f.sOrigine, fin: st.finAbs - f.sOrigine,
      garage0: st.garage0 - f.sOrigine, garage1: st.garage1 - f.sOrigine,
      cote: st.cote, vitesse: 11 };
  }

  B.routeSansFinFenetre = { creer, avancer, sAbsolu, sFenetre, stationActive, DERRIERE, DEVANT };
})(globalThis.BITUME = globalThis.BITUME || {});
