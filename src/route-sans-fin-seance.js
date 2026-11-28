// Séance « Route sans fin » : ce que jeu.js pilote à chaque image.
// Possède la fenêtre glissante, la liste des checkpoints (allongée à mesure qu'on avance)
// et la station active ; ne touche à rien d'autre. Déterministe : mêmes positions, même état.
(function (B) {
  'use strict';
  const R = B.routeSansFin, F = B.routeSansFinFenetre;
  const PAS_CHECKPOINT = 1500, AVANCE_FENETRE = 0.25;   // secondes entre deux glissements
  const REPRISE_DECOR = 1500, PAS_REPRISE = 300;         // où l'on reprend le décor, et à quel rythme
  const ANTICIPATION_DECOR = 2550, ANTICIPATION_STATION = 750;

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

  // Planifie à l'avance (sans muter la séance ni bâtir de géométrie) la prochaine fenêtre + station
  // afin qu'un Web Worker la prépare ~1 km avant le besoin réel et fusionne station + fenêtre proches.
  function anticiper(seance, positions) {
    if (!seance?.cPorteur || !F.planifier) return null;
    const f = seance.fenetre, bati = seance.cPorteur;
    const oB = bati.sansFinFenetre.sOrigine, edgeBati = oB + bati.longueur;
    const abs = positions.map(s => oB + s).filter(Number.isFinite);
    if (!abs.length) return null;
    const minAbs = Math.min(...abs), maxAbs = Math.max(0, ...abs);
    const stActuelle = seance.station;
    const procheBord = edgeBati - maxAbs < ANTICIPATION_DECOR;
    const procheFinStation = !!(stActuelle && stActuelle.finAbs - maxAbs < Math.max(ANTICIPATION_STATION, procheBord ? 1150 : 0));
    if (!procheBord && !procheFinStation) return null;

    // Si la sortie de la station active est proche du seuil de reprise du décor, viser d'emblée
    // la position au-delà de la station + 900 m pour fusionner les deux bascules en une seule.
    const projection = procheFinStation
      ? Math.max(maxAbs + 950, stActuelle.finAbs + 650)
      : maxAbs + 1050;
    const plan = F.planifier(f, [Math.max(minAbs, projection - (maxAbs - minAbs)), projection]);
    const k0 = plan.k0, k1 = plan.k1, sOrigine = plan.sOrigine, longueur = plan.longueur;
    const sCibleStation = procheFinStation ? Math.max(maxAbs, stActuelle.finAbs + 4) : maxAbs;
    const liste = R.stationsEntre(sOrigine, sOrigine + longueur + f.devant, seance.graine);
    const station = R.stationActive(sCibleStation, liste);
    const cleStation = station ? station.debutAbs + ':' + station.finAbs : null;
    if (k0 === bati.sansFinFenetre.k0 && k1 === bati.sansFinFenetre.k1 && cleStation === seance.cleStation) return null;
    return {
      cle: seance.graine + ':' + k0 + ':' + k1 + ':' + (cleStation || 'none'),
      graine: seance.graine,
      k0, k1, sOrigine, longueur,
      station, cleStation,
    };
  }

  // positions : abscisses (relatives au circuit courant du jeu) des voitures encore en course.
  // Rend true si jeu.js doit reprendre décor et solides : le monde bâti (cPorteur) touche à sa fin,
  // ou sa station active a changé. La fenêtre, elle, glisse en silence devant.
  function avancer(seance, positions, dt, asyncOpts) {
    seance.tDepuisGlissement += dt;
    if (seance.tDepuisGlissement < seance.pas) return false;
    seance.tDepuisGlissement = 0;
    const f = seance.fenetre;
    const abs = positions.map(s => (seance.cPorteur ? seance.cPorteur.sansFinFenetre.sOrigine : 0) + s);
    const minAbs = Math.min(...abs), maxAbs = Math.max(0, ...abs);
    allongerCheckpoints(seance, maxAbs);
    seance.sJoueur = maxAbs;

    const bati = seance.cPorteur;
    const oBati = bati ? bati.sansFinFenetre.sOrigine : 0;
    const edgeBati = bati ? oBati + bati.longueur : 0;

    // Mode flux asynchrone (en jeu navigateur) : n'exécuter jamais `F.avancer` synchrone tant qu'il reste
    // de la piste bâtie devant (> 620 m) ; adopter directement le monde pré-cuit dès le seuil de bascule
    // ou le dépassement de la station active.
    if (asyncOpts) {
      const listeCourante = R.stationsEntre(oBati, oBati + (bati?.longueur || 0) + f.devant, seance.graine);
      const stCourante = R.stationActive(maxAbs, listeCourante);
      const cleCourante = stCourante ? stCourante.debutAbs + ':' + stCourante.finAbs : null;
      const stationChangee = cleCourante !== seance.cleStation;
      const finStationProche = !!(stCourante && stCourante.finAbs >= maxAbs && stCourante.finAbs - maxAbs < 320 && edgeBati - maxAbs > 900);
      const besoinBascule = (!finStationProche && (edgeBati - maxAbs < REPRISE_DECOR)) || stationChangee;

      const pret = asyncOpts.pret;
      if (besoinBascule && pret?.c) {
        const oP = pret.c.sansFinFenetre.sOrigine;
        if (minAbs >= oP - 10 && maxAbs <= oP + pret.c.longueur - 450) {
          seance.c = F.appliquerPrepare(f, pret.c);
          seance.cPorteur = seance.c;
          seance.station = pret.station || null;
          seance.cleStation = pret.cleStation ?? null;
          return true;
        }
      }
      // Tant que la marge de sécurité reste confortable (> 620 m), laisser l'ouvrier finir la cuisson sans gel !
      if (edgeBati - maxAbs > 620) {
        // Si seule la station a été dépassée et que le paquet fusionné arrive sous peu, ne pas bloquer pour elle
        if (stationChangee && asyncOpts.enPreparation) return false;
        if (!stationChangee) return false;
      }
    }

    seance.c = F.avancer(f, abs);   // repli synchrone (tests Node ou urgence < 620 m)
    // Si la station active du monde bâti change alors que ce monde arrive déjà près du seuil de reprise,
    // basculer tout de suite sur `seance.c` pour éviter deux reprises coup sur coup à quelques dizaines de mètres.
    const listeAvant = R.stationsEntre(oBati, oBati + (bati?.longueur || 0) + f.devant, seance.graine);
    const stAvant = R.stationActive(maxAbs, listeAvant);
    const cleAvant = stAvant ? stAvant.debutAbs + ':' + stAvant.finAbs : null;
    const fusionStation = cleAvant !== seance.cleStation && (edgeBati - maxAbs < REPRISE_DECOR + 450) && seance.c !== bati;
    const finStationProcheSync = !!(stAvant && stAvant.finAbs >= maxAbs && stAvant.finAbs - maxAbs < 320 && edgeBati - maxAbs > 900);
    // 1) le monde bâti n'est plus assez long devant le joueur : on bascule sur le monde en construction
    const bascule = ((!finStationProcheSync && (edgeBati - maxAbs < REPRISE_DECOR)) && seance.c !== bati) || fusionStation;
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

  B.routeSansFinSeance = { creer, avancer, anticiper, meteoCible, biomeA, PAS_CHECKPOINT, AVANCE_FENETRE, REPRISE_DECOR, PAS_REPRISE };
})(globalThis.BITUME = globalThis.BITUME || {});
