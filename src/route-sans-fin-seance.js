// Séance « Route sans fin » : ce que jeu.js pilote à chaque image.
// Possède la fenêtre glissante, la liste des checkpoints (allongée à mesure qu'on avance)
// et la station active ; ne touche à rien d'autre. Déterministe : mêmes positions, même état.
(function (B) {
  'use strict';
  const R = B.routeSansFin, F = B.routeSansFinFenetre;
  const PAS_CHECKPOINT = 1500, AVANCE_FENETRE = 0.25;   // secondes entre deux glissements
  const REPRISE_DECOR = 900, PAS_REPRISE = 300;          // où l'on reprend le décor, et à quel rythme

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
      station: null, cleStation: null, cPorteur: f.c,   // le monde où vit le jeu : celui qu'il a installé au départ
      dernierEdge: null,
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

  // positions : abscisses (relatives au circuit courant du jeu) des voitures encore en course.
  // Rend true si jeu.js doit reprendre décor et solides : le monde bâti (cPorteur) touche à sa fin,
  // ou sa station active a changé. La fenêtre, elle, glisse en silence devant.
  function avancer(seance, positions, dt) {
    seance.tDepuisGlissement += dt;
    if (seance.tDepuisGlissement < seance.pas) return false;
    seance.tDepuisGlissement = 0;
    const f = seance.fenetre;
    const abs = positions.map(s => (seance.cPorteur ? seance.cPorteur.sansFinFenetre.sOrigine : 0) + s);
    const maxAbs = Math.max(0, ...abs);
    seance.c = F.avancer(f, abs);   // la fenêtre veut des abscisses absolues
    allongerCheckpoints(seance, maxAbs);
    seance.sJoueur = maxAbs;
    // 1) le monde bâti n'est plus assez long devant le joueur : on bascule sur le monde en construction
    const bati = seance.cPorteur;
    const edgeBati = bati ? bati.sansFinFenetre.sOrigine + bati.longueur : 0;
    // basculer seulement s'il existe un monde plus neuf (la fenêtre a grandi) ; sinon on roule sur l'existant
    const bascule = (edgeBati - maxAbs < REPRISE_DECOR) && seance.c !== bati;
    if (bascule) {
      seance.cPorteur = seance.c;
      seance.cleStation = undefined;   // reposer la station sur le nouveau monde bâti
    }
    // 2) la station active du monde bâti, dans SON repère ; son changement impose de reposer les solides
    const b = seance.cPorteur, oB = b.sansFinFenetre.sOrigine;
    const liste = R.stationsEntre(oB, oB + b.longueur + f.devant, seance.graine);
    const st = R.stationActive(maxAbs, liste);
    const cle = st ? st.debutAbs + ':' + st.finAbs : null;
    if (cle !== seance.cleStation) {
      seance.cleStation = cle; seance.station = st;
      if (st) {
        b.stands = { debut: st.debutAbs - oB, fin: st.finAbs - oB, garage0: st.garage0 - oB, garage1: st.garage1 - oB, cote: st.cote, vitesse: 11 };
        B.circuit.preparerStands(b);
      } else b.stands = null;
      if (!bascule) return true;   // hors bascule : seuls les solides sont à reposer
    }
    return bascule;
  }

  // Météo cyclique par biome : la cible regarde le relief que le monde bâti va traverser devant le joueur.
  // Hystérésis : une cible ne change que si le biome dominant tient la distance (pas de clignotement aux coutures).
  const METEO_BIOME = {
    plage: { phase: 'couvre', neige: false },
    plaine: { phase: 'clair', neige: false },
    foret: { phase: 'couvre', neige: false },
    'petite-montagne': { phase: 'pluie', neige: false },
    'grande-montagne': { phase: 'orage', neige: true },
  };
  const HORIZON_METEO = 1500, HYSTERESIS_METEO = 1200;
  function meteoCible(seance) {
    const b = seance.cPorteur, f = seance.fenetre;
    const s0 = b.sansFinFenetre.sOrigine, debut = Math.max(s0, seance.sJoueur ?? s0);
    const fin = Math.min(s0 + b.longueur, debut + HORIZON_METEO);
    const longueurs = {};
    // cumul propre : les tronçons du monde bâti commencent à son origine, dans l'ordre k0..k1
    let s = b.sansFinFenetre.sOrigine;
    for (let k = b.sansFinFenetre.k0; k < b.sansFinFenetre.k1; k++) {
      const L = R.pointsSegment(k, seance.graine).profil.L;
      const de = Math.max(s, debut), vers = Math.min(s + L, fin);
      if (vers > de) { const bi = R.biomePour(k); longueurs[bi] = (longueurs[bi] || 0) + (vers - de); }
      s += L;
    }
    let dominant = 'plaine', meilleur = -1;
    for (const bi in longueurs) if (longueurs[bi] > meilleur) { meilleur = longueurs[bi]; dominant = bi; }
    if (meilleur < HYSTERESIS_METEO && seance.meteoBiome) dominant = seance.meteoBiome;   // pas assez de relief : on garde
    seance.meteoBiome = dominant;
    return METEO_BIOME[dominant] || METEO_BIOME.plaine;
  }

  const LIBELLES_BIOME = {
    plage: 'Plage',
    plaine: 'Plaine',
    'petite-montagne': 'Petite montagne',
    'grande-montagne': 'Grande montagne',
  };
  function biomeA(seance, sRel) {
    const b = seance.cPorteur, sAbs = (b?.sansFinFenetre?.sOrigine || 0) + (Number.isFinite(sRel) ? sRel : 0);
    let s = b?.sansFinFenetre?.sOrigine || 0;
    const k0 = b?.sansFinFenetre?.k0 || 0, k1 = b?.sansFinFenetre?.k1 || k0 + 1;
    for (let k = k0; k < k1; k++) {
      const p = R.pointsSegment(k, seance.graine).profil;
      if (sAbs < s + p.L || k === k1 - 1) return { biome: p.biome, label: LIBELLES_BIOME[p.biome] || p.biome, theme: p.theme };
      s += p.L;
    }
    return { biome: 'plage', label: 'Plage', theme: 'cote' };
  }

  B.routeSansFinSeance = { creer, avancer, meteoCible, biomeA, PAS_CHECKPOINT, AVANCE_FENETRE, REPRISE_DECOR, PAS_REPRISE };
})(globalThis.BITUME = globalThis.BITUME || {});
