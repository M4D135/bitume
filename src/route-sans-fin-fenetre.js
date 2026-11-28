// Fenêtre glissante de la Route sans fin : le monde autour des joueurs, mémoire bornée.
// La fenêtre ne dépend que des positions absolues des joueurs (déterminisme) ; les pilotes
// gardent leur abscisse absolue (course.js, sansFin.sAbsolu) et la fenêtre ne fait que
// traduire entre l'abscisse du circuit courant et l'abscisse absolue de la route.
(function (B) {
  'use strict';
  const R = B.routeSansFin;
  const DERRIERE = 600, DEVANT = 2200, MARGE_SEG = 600;

  function creer(graine, options = {}) {
    const f = {
      graine: graine >>> 0,
      k0: 0, k1: 0,                 // tronçons [k0, k1[ dans la fenêtre
      sOrigine: 0,                  // abscisse absolue du s = 0 du circuit courant
      longueur: 0,
      c: null,
      derriere: options.derriere ?? DERRIERE,
      devant: options.devant ?? DEVANT,
      maxSegments: options.maxSegments ?? 10,
    };
    etendre(f, f.devant);
    f.c = construire(f);
    return f;
  }

  function sAbsolu(f, s) { return f.sOrigine + s; }
  function sFenetre(f, sAbs) { return sAbs - f.sOrigine; }

  // ajouter des tronçons jusqu'à couvrir l'abscisse absolue demandée
  function etendre(f, sCible) {
    const plafond = (f._plafondSegments ?? f.maxSegments) + 2;
    while (f.sOrigine + f.longueur < sCible + MARGE_SEG) {
      if (f.k1 - f.k0 >= plafond) break;   // garde-fou mémoire absolu
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
    const segs = Math.max(1, f.k1 - f.k0);
    const segMoyen = f.longueur > 0 ? f.longueur / segs : 1000;
    const besoin = Math.ceil((maxi - mini + f.devant + f.derriere + 2 * MARGE_SEG) / Math.max(1, segMoyen));
    f._plafondSegments = (vivantes.length >= 2 && besoin > f.maxSegments) ? Math.min(24, Math.max(f.maxSegments + 4, besoin)) : f.maxSegments;
    etendre(f, maxi + f.devant);
    // libérer derrière : on n'avance l'origine que si le joueur le plus en arrière est
    // hors de portée ET qu'il reste assez de route devant lui dans la fenêtre
    // Libérer derrière : garder de la marge, mais toujours libérer si le devant est affamé
    // et que le joueur le plus en arrière est déjà loin du premier segment.
    const frontStarved = () => f.sOrigine + f.longueur < maxi + f.devant + MARGE_SEG;
    while (f.k1 - f.k0 > 2 && mini - f.derriere > f.sOrigine + R.pointsSegment(f.k0, f.graine).profil.L
        && (f.k1 - f.k0 > (f._plafondSegments ?? f.maxSegments) || frontStarved())) {
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
    c.sauts = R.sautsFenetre(trace, c);
    c.graine = f.graine;
    c.theme = R.pointsSegment(f.k0, f.graine).profil.theme;
    // Découpage par tronçon de biome : permet au décor de teinter plage → plaine → montagnes
    // sur la fenêtre active. Les longueurs sont ramenées à c.longueur (corde ≤ arc).
    const tronconsThemes = [];
    let sAcc = 0, sBrut = 0;
    for (let k = f.k0; k < f.k1; k++) sBrut += R.pointsSegment(k, f.graine).profil.L;
    const echelle = sBrut > 0 ? c.longueur / sBrut : 1;
    for (let k = f.k0; k < f.k1; k++) {
      const p = R.pointsSegment(k, f.graine).profil, dL = p.L * echelle;
      tronconsThemes.push({ theme: p.theme, biome: p.biome, debut: sAcc, fin: Math.min(c.longueur, sAcc + dL) });
      sAcc += dL;
    }
    if (tronconsThemes.length) tronconsThemes[tronconsThemes.length - 1].fin = c.longueur;
    c.tronconsThemes = tronconsThemes;
    // Checkpoints visibles (portiques 3D + repères minimap) tombant dans la fenêtre courante (pas 1 500 m).
    const pasCp = 1500, cps = [];
    const premierCp = Math.max(1, Math.ceil((f.sOrigine + 10) / pasCp));
    for (let m = premierCp; m * pasCp <= f.sOrigine + c.longueur - 10; m++) {
      cps.push({ s: m * pasCp - f.sOrigine, sAbs: m * pasCp, numero: m });
    }
    c.checkpointsSansFin = cps;
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

  // Calcule sans allocation ni construction de tracé les bornes [k0, k1[ voulues pour `positions`.
  function planifier(f, positions) {
    const vivantes = positions.filter(s => Number.isFinite(s));
    if (!vivantes.length) return { k0: f.k0, k1: f.k1, sOrigine: f.sOrigine, longueur: f.longueur, plafondSegments: f._plafondSegments ?? f.maxSegments, change: false };
    const mini = Math.min(...vivantes), maxi = Math.max(...vivantes);
    let k0 = f.k0, k1 = f.k1, sOrigine = f.sOrigine, longueur = f.longueur;
    const segs = Math.max(1, k1 - k0);
    const segMoyen = longueur > 0 ? longueur / segs : 1000;
    const besoin = Math.ceil((maxi - mini + f.devant + f.derriere + 2 * MARGE_SEG) / Math.max(1, segMoyen));
    const plafondSegments = (vivantes.length >= 2 && besoin > f.maxSegments) ? Math.min(24, Math.max(f.maxSegments + 4, besoin)) : f.maxSegments;
    const plafond = plafondSegments + 2;
    const etendreBornes = sCible => {
      while (sOrigine + longueur < sCible + MARGE_SEG) {
        if (k1 - k0 >= plafond) break;
        const seg = R.pointsSegment(k1, f.graine);
        k1++;
        longueur += seg.profil.L;
      }
    };
    etendreBornes(maxi + f.devant);
    let libere = false;
    const frontStarved = () => sOrigine + longueur < maxi + f.devant + MARGE_SEG;
    while (k1 - k0 > 2 && mini - f.derriere > sOrigine + R.pointsSegment(k0, f.graine).profil.L
        && (k1 - k0 > plafondSegments || frontStarved())) {
      const L0 = R.pointsSegment(k0, f.graine).profil.L;
      sOrigine += L0;
      longueur -= L0;
      k0++;
      libere = true;
    }
    if (libere) etendreBornes(maxi + f.devant);
    return { k0, k1, sOrigine, longueur, plafondSegments, change: k0 !== f.k0 || k1 !== f.k1 || !f.c };
  }

  // Adopte directement un circuit déjà préparé en arrière-plan pour [k0, k1[ sans reconstruire sur le fil principal.
  function appliquerPrepare(f, cPrepare) {
    if (!cPrepare?.sansFinFenetre) return f.c;
    const { k0, k1, sOrigine } = cPrepare.sansFinFenetre;
    let longueur = 0;
    for (let k = k0; k < k1; k++) longueur += R.pointsSegment(k, f.graine).profil.L;
    f.k0 = k0; f.k1 = k1; f.sOrigine = sOrigine; f.longueur = longueur;
    f.c = cPrepare;
    return f.c;
  }

  B.routeSansFinFenetre = { creer, avancer, planifier, appliquerPrepare, sAbsolu, sFenetre, stationActive, DERRIERE, DEVANT };
})(globalThis.BITUME = globalThis.BITUME || {});
