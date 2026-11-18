/* BITUME — profils graphiques et réglages indépendants d'anticrénelage, d'ombres et de végétation.
   Le module ne rend rien : il ne calcule que des décisions (nombres et interrupteurs). Aucun DOM, aucun moteur,
   aucun asset, aucun réseau. C'est src/jeu.js qui applique : rendu.resize, rendu.draw, B.decor.construire,
   majGlaces et la vue du second joueur.
   Les valeurs restent dans les bornes du moteur : MSAA 4× et atlas d'ombres à deux échelles. Les choix explicites
   priment sur le profil et sur Auto, puis les capacités réellement ouvertes par le moteur bornent le résultat. */
(function (B) {
  'use strict';

  const PALIERS = Object.freeze(['low', 'medium', 'high']);
  const QUALITES = Object.freeze(['low', 'medium', 'high', 'auto']);
  const OPTIONS = Object.freeze({
    anticrenelage: Object.freeze(['profil', 'off', 'msaa4']),
    ombres: Object.freeze(['profil', 'off', 'medium', 'high']),
    vegetation: Object.freeze(['profil', 'off', 'low', 'medium', 'high', 'ultra']),
  });

  // ---------------------------------------------------------------- bornes du moteur (à ne pas dépasser)
  const MSAA_ACCEPTE = 4;            // settings(), renderer.js:2058 : config.msaa = (o.msaa === 4), sinon 0
  const ATLAS_MAX = 2;               // settings(), renderer.js:2059 : shadowMapScale === 2 ? 2 : 1
  const ATLAS_BASE = 512;            // ensureShadowTarget(), renderer.js:2197 : tuile de 512, doublée par le scale
  const RESOLUTION_MIN = .5, RESOLUTION_MAX = 2; // resize(), renderer.js:2469 : ratio = max(.5, min(2, ratio))
  const RESOLUTION_AUTO = 1.5;       // resize(), renderer.js:2470 : 'auto' se plafonne à sqrt(1 800 000 / pixels)
  const BLOOM_DEFAUT = Object.freeze([.56, .86]); // settings(), renderer.js:2057 : smoothstep(.56,.86,…) du POST_FRAG
  const RESOLUTION_PALIER_4 = .75;   // 0,56× les pixels d'une image 1,0 : le seul poste que le jeu baisse à ce jour

  function figer(o) {
    for (const k of Object.keys(o)) { const v = o[k]; if (v && typeof v === 'object' && !Object.isFrozen(v)) figer(v); }
    return Object.freeze(o);
  }

  // ---------------------------------------------------------------- les trois paliers effectifs
  // Coût de référence, en échantillons par pixel de la fenêtre (ratio² × échantillons MSAA) :
  //   Low 0,64 · Medium 4 · High 16 sur un écran 2×. L'écart vient d'abord de là, puis des effets et des lots.
  const PROFILS = figer({
    low: {
      palier: 'low', libelle: 'Légère',
      rendu: {
        msaa: 0,              // 4× la bande passante du raster avant le bloom pour adoucir un bord : premier poste coupé
        shadowMapScale: 1,    // le moteur n'accepte que 1 ou 2 ; ici sans ombres de toute façon
        vignette: .59,        // dégradé 2D gratuit (renderer.js:1736) : identique partout, l'image ne change pas d'aspect
        bloomThreshold: BLOOM_DEFAUT,
        resolution: .8,       // le ratio « low » du moteur (renderer.js:2467) : 0,64× les pixels de la fenêtre
      },
      effets: { ombres: false, halo: false, reflets: false, retroImages: false },
      decor: { matieres: false, vegetation: false }, // les massifs instanciés sont le gros des draw calls
      lod: { bascule: 380 },  // decor.js:674 bascule à 520 m ; à 380 m une canopée de 6 m tient encore ~16 px au
                              // champ de 60° sur 1 080 px : la version allégée prend le relais bien avant de gêner,
                              // et le moteur fait le relais par fondu, jamais par coupure
      secondaires: {
        retroviseurs: { glaces: 0, hz: 0 },  // glace peinte, comme le jeu aujourd'hui en qualité basse (jeu.js:1414)
        partage: { hz: 30 },                 // la vue du joueur 2 est rendue une image sur deux : il garde la sienne
      },
    },
    medium: {
      palier: 'medium', libelle: 'Moyenne',
      rendu: {
        msaa: 4,              // anticrénelage de la géométrie, indépendant du halo
        shadowMapScale: 1,    // tuile de 512 : une ombre du soleil un peu douce vaut mieux qu'un atlas doublé payé deux fois
        vignette: .59,
        bloomThreshold: BLOOM_DEFAUT,
        resolution: 1,        // un pixel rendu par pixel CSS : sur un écran 2×, le quart des pixels de Fine
      },
      effets: { ombres: true, halo: true, reflets: false, retroImages: true },
      decor: { matieres: true, vegetation: true },
      lod: { bascule: 520 },  // la valeur historique du jeu (decor.js:674) : Medium ne change rien au décor d'aujourd'hui
      secondaires: {
        retroviseurs: { glaces: 2, hz: 15 }, // jeu.js:1429 rafraîchit une glace par image ; ici une sur quatre par côté
        partage: { hz: 30 },
      },
    },
    high: {
      palier: 'high', libelle: 'Fine',
      rendu: {
        msaa: 4,
        shadowMapScale: 2,    // 512 × 2 = 1 024 : la densité de texels tient sur le carré de 200 m du soleil (AGENTS.md)
        vignette: .59,
        bloomThreshold: [.5, .8], // rampe descendue à 0,50 : les lampes du tunnel et le métal ciel-allumé mordent dans le
                                  // halo ; le haut reste à 0,80 pour ne pas noyer le ciel clair. Le moteur exige fin > début
        resolution: 2,        // le plafond du moteur, ramené à devicePixelRatio par les garde-fous : min(dpr, 2)
      },
      effets: { ombres: true, halo: true, reflets: true, retroImages: true },
      decor: { matieres: true, vegetation: true },
      lod: { bascule: 760 },  // au-delà de 760 m une canopée de 6 m tombe sous ~8 px au champ de 60° : la version
                              // allégée ne se distingue plus ; en deçà la silhouette compte, Fine la garde
      secondaires: {
        retroviseurs: { glaces: 2, hz: 30 }, // les deux glaces réelles à pleine cadence (David, 16/11)
        partage: { hz: 60 },                 // le second joueur rendu à chaque image
      },
    },
  });

  // ---------------------------------------------------------------- qualité demandée → palier
  const ANCIENNES = Object.freeze({
    legere: 'low', basse: 'low', minimale: 'low', min: 'low', petit: 'low',
    moyenne: 'medium', med: 'medium', mid: 'medium', equilibree: 'medium', normale: 'medium',
    fine: 'high', elevee: 'high', max: 'high', ultra: 'high', grande: 'high',
    auto: 'auto', automatique: 'auto',
  });

  function normaliser(valeur) {
    if (typeof valeur !== 'string') return 'auto';
    const v = valeur.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (QUALITES.indexOf(v) >= 0) return v;
    return ANCIENNES[v] || 'auto'; // une valeur enregistrée par une ancienne version ne doit jamais bloquer le menu
  }
  function normaliserOptions(reglages) {
    const source = reglages || {}, resultat = {};
    for (const cle of Object.keys(OPTIONS)) {
      const v = typeof source[cle] === 'string' ? source[cle].trim().toLowerCase() : '';
      resultat[cle] = OPTIONS[cle].includes(v) ? v : 'profil';
    }
    return Object.freeze(resultat);
  }
  const estPalier = v => typeof v === 'string' && PALIERS.indexOf(v) >= 0;

  function profil(palier) {
    const p = PROFILS[palier];
    if (!p) throw new Error('palier inconnu : ' + palier);
    return p; // déjà figé à la profondeur
  }

  // ---------------------------------------------------------------- gouverneur → palier : source unique
  // src/qualite.js décide du niveau (fenêtre 3 s au-delà de 1/50 s, remontée après 8 s sous 0,014 s, niveaux 0..4
  // tenus par jeu.js). Ce tableau est le SEUL endroit où un niveau devient un palier et une coupe.
  // Le gouverneur retire un poste par niveau, du moins coûteux au plus coûteux mesuré au banc :
  //   1 images de rétroviseurs (deux scènes de plus par image) · 2 ombres du soleil · 3 halo et reflets · 4 résolution.
  // Règle du palier : il suit le poste le plus sévère déjà coupé.
  //   0 et 1 restent High — couper une vue secondaire ne change pas la richesse de l'image principale ;
  //   2 et 3 deviennent Medium — l'atlas d'ombres est précisément ce qui sépare High de Medium, et le reflet est déjà
  //     fermé à Medium ;
  //   4 devient Low — l'image principale perd de la définition, c'est le signe distinctif de Low.
  const TABLE_GOUVERNEUR = figer([
    { palier: 'high',   retroviseurs: false, ombres: false, halo: false, reflets: false, resolution: false },
    { palier: 'high',   retroviseurs: true,  ombres: false, halo: false, reflets: true,  resolution: false },
    { palier: 'medium', retroviseurs: true,  ombres: true,  halo: false, reflets: true,  resolution: false },
    { palier: 'medium', retroviseurs: true,  ombres: true,  halo: true,  reflets: true,  resolution: false },
    { palier: 'low',    retroviseurs: true,  ombres: true,  halo: true,  reflets: true,  resolution: true },
  ]);
  const NIVEAU_MAX = TABLE_GOUVERNEUR.length - 1; // 4, le plafond de jeu.js (PALIERS = 4)

  function niveauDe(palierAuto) {
    const n = Number.isFinite(palierAuto) ? Math.floor(palierAuto) : 0; // au repos, le gouverneur laisse tout ouvert
    return Math.max(0, Math.min(NIVEAU_MAX, n));
  }

  function resoudre(qualite, palierAuto) {
    const q = normaliser(qualite);
    return q === 'auto' ? TABLE_GOUVERNEUR[niveauDe(palierAuto)].palier : q;
  }

  // ---------------------------------------------------------------- capacités ouvertes par le moteur
  // On relit les options réellement données à FRender.create : settings() (renderer.js:2057-2059) ne retient que
  // msaa === 4, shadowMapScale === 2 et reflections !== false. Leur annoncer le contraire serait mentir au profil.
  function capacites(options, gpuModeste, pixelRatio) {
    const o = options || {};
    const logiciel = o.logiciel === true; // le repli Canvas 2D ignore ombres, bloom, MSAA et reflets
    return figer({
      msaa: !logiciel && o.msaa === MSAA_ACCEPTE,
      shadowMapScale: o.shadowMapScale === ATLAS_MAX ? ATLAS_MAX : 1,
      reflets: !logiciel && o.reflections !== false,
      ombres: !logiciel,
      halo: !logiciel,
      retroviseurs: o.retroviseurs !== false,
      gpuModeste: !!gpuModeste,
      pixelRatio: Number.isFinite(pixelRatio) ? Math.max(1, Math.min(RESOLUTION_MAX, pixelRatio)) : RESOLUTION_MAX,
    });
  }
  const CAPACITES_OUVERTES = capacites({ msaa: MSAA_ACCEPTE, shadowMapScale: ATLAS_MAX }, false, RESOLUTION_MAX);
  const CAPACITES_CLES = Object.freeze(['msaa', 'shadowMapScale', 'reflets', 'ombres', 'halo', 'retroviseurs', 'gpuModeste', 'pixelRatio']);
  // Le garde-fou accepte soit un objet de capacités (sortie de capacites()), soit le gardeFous lui-même.
  function capacitesDe(g) {
    const source = (g && g.capacites) || g, c = Object.assign({}, CAPACITES_OUVERTES);
    if (source) for (const k of CAPACITES_CLES) if (source[k] !== undefined) c[k] = source[k];
    c.shadowMapScale = c.shadowMapScale === ATLAS_MAX ? ATLAS_MAX : 1; // le moteur ne connaît que 1 et 2
    c.pixelRatio = Number.isFinite(c.pixelRatio) ? Math.max(1, Math.min(RESOLUTION_MAX, c.pixelRatio)) : RESOLUTION_MAX;
    return c;
  }

  function bornes(v, min, max, defaut) {
    return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : defaut;
  }
  function seuilsDeBloom(seuils) {
    if (!Array.isArray(seuils) || !Number.isFinite(seuils[0]) || !Number.isFinite(seuils[1])) return BLOOM_DEFAUT;
    const a = Math.max(0, Math.min(1, seuils[0])), b = Math.max(0, Math.min(1, seuils[1]));
    return b > a ? [a, b] : BLOOM_DEFAUT; // le moteur retombe sur sa rampe par défaut si la rampe est monotone
  }

  // ---------------------------------------------------------------- l'objet réellement appliqué
  // gardeFous : les capacités du moteur, `options` (choix du menu) et éventuellement `decor`, l'ancre du décor.
  // Ancre : le gouverneur ne fait JAMAIS varier le décor en cours de course. Sans ancre, le décor suit le palier
  // résolu (choix explicite du menu, ou première décision d'Auto avant la course).
  function melange(qualite, palierAuto, gardeFous) {
    const g = gardeFous || {};
    const c = capacitesDe(g);
    const options = normaliserOptions(g.options);
    const q = normaliser(qualite), p = profil(resoudre(q, palierAuto));
    const coupes = q === 'auto' ? TABLE_GOUVERNEUR[niveauDe(palierAuto)] : null;
    const veut = (demande, cle) => demande && !!c[cle] && !(coupes && coupes[cle]);

    const halo = veut(p.effets.halo, 'halo');
    const effets = {
      ombres: options.ombres === 'profil' ? veut(p.effets.ombres, 'ombres') : options.ombres !== 'off' && !!c.ombres,
      halo,
      // Le moteur n'allume les reflets d'écran que si la capacité est ouverte ET avec le bloom
      // (wantReflections, renderer.js:2216), et le jeu les refuse sur un GPU modeste (jeu.js:1320).
      reflets: veut(p.effets.reflets, 'reflets') && !c.gpuModeste && halo,
      retroImages: veut(p.effets.retroImages, 'retroviseurs'),
    };

    // Auto conserve sa réduction de coût au niveau 3 et le GPU modeste son réglage prudent par défaut.
    // Un choix manuel de MSAA reste cependant actif sans halo, même en Légère ou au dernier palier d'Auto.
    const msaaProfil = !c.gpuModeste && !(coupes && coupes.halo) ? p.rendu.msaa : 0;
    const msaaDemande = options.anticrenelage === 'profil' ? msaaProfil : options.anticrenelage === 'msaa4' ? MSAA_ACCEPTE : 0;
    const atlasDemande = options.ombres === 'profil' ? (c.gpuModeste ? 1 : p.rendu.shadowMapScale) : options.ombres === 'high' ? ATLAS_MAX : 1;
    const rendu = {
      msaa: c.msaa ? msaaDemande : 0,
      shadowMapScale: effets.ombres ? Math.max(1, Math.min(ATLAS_MAX, c.shadowMapScale, atlasDemande)) : 1,
      vignette: bornes(p.rendu.vignette, 0, 1, .59),
      bloomThreshold: figer(seuilsDeBloom(p.rendu.bloomThreshold)),
      resolution: resolutionDe(q, p, c, coupes),
    };

    const ancre = estPalier(g.decor) ? g.decor : p.palier;
    const decorProfil = PROFILS[ancre];
    const vegetationQualite = options.vegetation === 'profil' ? (decorProfil.decor.vegetation ? ancre : 'off') : options.vegetation;
    const glaces = effets.retroImages ? p.secondaires.retroviseurs.glaces : 0;
    const hz = effets.retroImages ? p.secondaires.retroviseurs.hz : 0;

    return figer({
      palier: p.palier, libelle: p.libelle, qualite: q,
      rendu, effets,
      decor: { matieres: decorProfil.decor.matieres, vegetation: vegetationQualite !== 'off', vegetationQualite },
      // Le module ne produit jamais de portée de culling : le moteur coupe par fondu (decor.js:674, portee Infinity).
      lod: { bascule: p.lod.bascule },
      secondaires: {
        retroviseurs: { glaces, hz },
        partage: { hz: p.secondaires.partage.hz },
      },
    });
  }
  function resolutionDe(q, p, c, coupes) {
    if (coupes && coupes.resolution) return RESOLUTION_PALIER_4; // Auto au dernier palier : le jeu baisse déjà à 0,75
    if (q === 'auto' || typeof p.rendu.resolution !== 'number') return 'auto'; // le gouverneur du moteur garde la main (jeu.js:1307)
    // Un nombre fige le ratio côté moteur : on le borne comme lui (renderer.js:2467-2469) et on ne dépasse jamais
    // devicePixelRatio, sinon Fine rendrait 4× les pixels d'un écran 1×.
    return Math.max(RESOLUTION_MIN, Math.min(RESOLUTION_MAX, Math.min(p.rendu.resolution, c.pixelRatio)));
  }

  // ---------------------------------------------------------------- décompte comparable des trois paliers
  // Index sans unité physique, purement comparatif : il sert à prouver qu'un contrôle que les paliers diffèrent.
  //   1 point par échantillon par pixel CSS · 1 point par mégapixel d'atlas d'ombres quand les ombres tournent ·
  //   halo 1 · reflets 2 (second passage des opaques puis flou) · une glace de rétroviseur à 30 Hz ≈ 1 scène de plus
  //   par image · la vue du second joueur à 60 Hz ≈ 1 scène · matières 0,5 · végétation 2 (les massifs instanciés).
  function budget(palier) {
    const p = profil(palier), r = p.rendu, e = p.effets, s = p.secondaires;
    const ratio = typeof r.resolution === 'number' ? r.resolution : RESOLUTION_AUTO;
    const echantillons = ratio * ratio * Math.max(1, r.msaa);
    const texels = e.ombres ? ATLAS_BASE * r.shadowMapScale * (ATLAS_BASE * r.shadowMapScale) : 0;
    const score = echantillons + texels / 1e6 + (e.halo ? 1 : 0) + (e.reflets ? 2 : 0)
      + s.retroviseurs.glaces * s.retroviseurs.hz / 30 + s.partage.hz / 60
      + (p.decor.matieres ? .5 : 0) + (p.decor.vegetation ? 2 : 0);
    return figer({
      palier: p.palier, libelle: p.libelle,
      rendu: { msaa: r.msaa, shadowMapScale: r.shadowMapScale, resolution: r.resolution, vignette: r.vignette,
        bloomThreshold: r.bloomThreshold.slice() },
      effets: { ombres: e.ombres, halo: e.halo, reflets: e.reflets, retroImages: e.retroImages },
      decor: { matieres: p.decor.matieres, vegetation: p.decor.vegetation },
      lod: { bascule: p.lod.bascule },
      secondaires: { retroviseurs: { glaces: s.retroviseurs.glaces, hz: s.retroviseurs.hz }, partage: { hz: s.partage.hz } },
      echantillonsParPixelCss: +echantillons.toFixed(3),
      texelsOmbres: texels,
      vuesSecondairesHz: s.retroviseurs.glaces * s.retroviseurs.hz + s.partage.hz,
      score: +score.toFixed(3),
    });
  }
  function budgets() { return figer({ low: budget('low'), medium: budget('medium'), high: budget('high') }); }

  // ---------------------------------------------------------------- temporisation de l'Auto
  // Le gouverneur de src/qualite.js reste seul décideur : il choisit le niveau. Ici on ne fait que retarder
  // l'application d'un palier, pour qu'une fluctuation isolée ne rebâtisse pas le terrain ni ne recrée les cibles.
  const STABILISATION = .75;   // le palier demandé doit tenir 0,75 s : le gouverneur met déjà 3 s à baisser
  const RECONSTRUCTION = 5;    // deux changements du budget de décor à moins de 5 s sont refusés (rebâtir le décor coûte)
  function etatStable() { return { palier: null, decor: null, demande: null, tDemande: 0, tDecor: -Infinity }; }

  // t : horloge en secondes fournie par le jeu (jamais Date.now ici, pour rester testable).
  // etat.decor mémorise le budget de décor réellement bâti : il ne bouge que si ce budget change vraiment.
  function decorDiffer(a, b) {
    // Le décor bâti dépend du palier entier, pas seulement des deux booléens : comptes d'herbes, de fougères et de
    // fleurs (vegetation.js:PALIERS), matières 0.3.5 et distance de bascule du LOD (decor.js:construire) suivent le
    // palier. Deux paliers nommés donnent donc deux terrains différents. Ce qui borne la cadence des rebâtiments,
    // c'est le verrou RECONSTRUCTION de majDecor, pas une comparaison qui laisserait Medium collé à Fine.
    return a !== b;
  }
  // Le terrain bâti correspond à etat.decor. On ne le rebâtit que si le budget du palier appliqué diffère
  // réellement, et jamais à moins de RECONSTRUCTION secondes du dernier rebâtiment : une fluctuation de l'Auto
  // ne doit pas reconstruire le décor. La demande reste en attente et passe dès que le verrou est levé.
  function majDecor(e, temps, sansVerrou) {
    if (!decorDiffer(e.decor, e.palier)) return false;
    if (!sansVerrou && temps - e.tDecor < RECONSTRUCTION) return false;
    e.decor = e.palier; e.tDecor = temps;
    return true;
  }
  function stabiliser(etat, qualite, palierAuto, t) {
    const e = etat || etatStable();
    const q = normaliser(qualite);
    const cible = resoudre(q, palierAuto);
    const temps = Number.isFinite(t) ? t : 0;
    if (e.palier === null) { e.palier = cible; e.decor = cible; e.demande = null; e.tDecor = temps; return resultat(e, true, true); }
    if (q !== 'auto') { // un choix du menu est un acte délibéré : il s'applique à l'image, sans temporisation
      const changement = e.palier !== cible;
      e.palier = cible; e.demande = null;
      return resultat(e, changement, majDecor(e, temps, true));
    }
    let changement = false;
    if (cible === e.palier) e.demande = null;
    else if (e.demande !== cible) { e.demande = cible; e.tDemande = temps; }
    else if (temps - e.tDemande >= STABILISATION) { e.palier = cible; e.demande = null; changement = true; }
    return resultat(e, changement, majDecor(e, temps, false));
  }
  function resultat(e, changement, reconstruit) {
    return figer({ palier: e.palier, decor: e.decor, changement: !!changement, reconstruit: !!reconstruit, attente: !!e.demande });
  }

  // Réglage d'image du jeu : le décor de référence et sa géométrie restent intacts.
  // La pluie garde son extinction supplémentaire ; les reliefs restent lisibles au loin.
  const BRUME = .34;
  function atmosphere(base) {
    if (!base || !Number.isFinite(base.fogDensity)) return base;
    return { ...base, fogDensity: base.fogDensity * BRUME };
  }

  B.graphismes = {
    PALIERS, QUALITES, OPTIONS, PROFILS, TABLE_GOUVERNEUR, NIVEAU_MAX, RESOLUTION_PALIER_4, STABILISATION, RECONSTRUCTION,
    normaliser, normaliserOptions, estPalier, profil, resoudre, capacites, melange, budget, budgets, stabiliser, etatStable,
    atmosphere, BRUME,
  };
})(globalThis.BITUME = globalThis.BITUME || {});
