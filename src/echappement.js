/* BITUME — flammes et détonations à l'échappement (lot 20).
   David, 18/11/2026 : « aussi flamme dans les pots d'échappement quand surrégime et pop and bang quand passage vitesse
   comme dans la réalité et ça permet de voir pour le passage vitesse en vue extérieure, fais cet effet aussi sur les
   voitures concurrentes pour plus de réalisme ».
   Moteur visé : douze-cylindres atmosphérique de 1980 à injection mécanique, sans coupure électronique. Le mélange
   imbrûlé finit de brûler dans les tubes chauds :
   - lever de pied à haut régime : crépitements irréguliers, petites flammes bleues ou orangées, d'un banc puis de
     l'autre ; rien à bas régime ;
   - passage de rapport : la coupure des gaz (rapportDuree de conduite.js) donne une détonation sèche et une langue de
     flamme 12 à 55 ms après le passage, parfois un second claquement ; un rétrogradage claque moins souvent et relance
     les crépitements ;
   - rupteur, surrégime entretenu : une flamme à presque chaque coupure, et un raté sourd.
   Décision (pas) : à chaque pas de la simulation, d'après l'état de chaque voiture. Chaque épisode (un passage, un
   lever de pied, un séjour au rupteur) est daté sur l'horloge de la course et tire ses nombres d'un hachage de la
   graine, de la voiture, du genre et de l'instant de l'épisode : rien ne dépend de la cadence d'affichage ni de l'ordre
   des voitures, et le hasard de la course n'est jamais touché (ni son générateur ni Math.random).
   Dessin (dessiner) : par sortie, une langue de flamme, son cœur plus chaud et une bouffée qui se détache ; objets préparés
   au chargement et réutilisés, translucides et émissifs (passe des effets du moteur), fonction du seul temps de
   l'image : à 30, 60 ou 120 images par seconde, la même flamme au même instant. Rien ne s'efface au loin : une
   concurrente à 150 m crache la même flamme, cœur compris, qu'à 5 m, lisible devant soi comme dans les rétroviseurs,
   pour trois objets par sortie au plus. Rien n'est alloué par image ni par pas.
   Le son lit la file `son` de l'état (src/son.js, echappement). */
(function (B) {
  'use strict';

  // ------------------------------------------------------------------ sorties
  // Embouchures 126 CK des quatre tubes de voiture.js (formes « echappements-hauts » et « echappements-bas ») : dernier point
  // de chaque tube et son rayon, dans le repère de la voiture (x vers l'avant, y vers le haut, z vers la droite). Les
  // tubes finissent dans l'axe : la flamme part vers −x. Banc 0 : côté gauche (z < 0).
  const arriere = B.voiture.ARRIERE_126CK;
  function sortie(x, y, z, r, banc, haut) {
    return Object.freeze({ x, y, z: banc === 0 ? -z : z, r, banc, haut });
  }
  const SORTIES = Object.freeze([
    ...[0, 1].map(banc => sortie(arriere.sortieHauteX, arriere.sortieHauteY, arriere.sortieHauteZ, arriere.sortieHauteRayon, banc, true)),
    ...[0, 1].map(banc => sortie(arriere.sortieBasseX, arriere.sortieBasseY, arriere.sortieBasseZ, arriere.sortieBasseRayon, banc, false))
  ]);
  const NS = SORTIES.length, TOUTES = (1 << NS) - 1;
  const BANC = [1 | 4, 2 | 8];                 // sorties d'un banc : le tube haut et le tube bas du même côté

  const DETONATION = 1, CREPITEMENT = 2, RATE = 3;
  const GENRES = Object.freeze(['', 'detonation', 'crepitement', 'rate']);

  const PARAMS = Object.freeze({
    regimeFlamme: 7000,          // tr/min : un passage plus bas ne s'enflamme pas
    regimePlein: 12300,          // montée automatique de conduite.js : le passage le plus vif
    regimeCrepitement: 8500,     // pied levé au-dessus : crépitements ; au-dessous, rien
    regimeMax: 12800,            // maxUtile de conduite.js
    gazLeve: .12, gazOuvert: .45,
    // rupteur : entrée au-dessus de 12 700 tr/min, sortie sous 12 000 (sur la grille, le rebond du rupteur redescend
    // à 12 420 : sans cette marge, chaque rebond ouvrirait un nouvel épisode)
    regimeRupteur: 12700, regimeRupteurSortie: 12000, gazRupteur: .5,
    fenetre: Object.freeze([.012, .055]),        // s : la détonation suit le passage
    second: Object.freeze([.07, .13]),           // s : second claquement, une fois sur deux environ
    cadenceRupteur: .1,                          // rupteurCadence de conduite.js
    crepitementDuree: 1.6, crepitementsMax: 18,  // un épisode de crépitements s'éteint
    recent: .6,                                  // s : pied à fond juste avant le lever, crépitements plus vifs
    vitessePassage: 4                            // m/s : en dessous, un changement de rapport ne claque pas
  });
  const IMPULSIONS = 4;                          // flammes retenues par sortie, en anneau
  const OBJETS_PAR_SORTIE = 3, OBJETS_PAR_VOITURE = NS * OBJETS_PAR_SORTIE;
  const VIE_BOUFFEE = .16, RENTREE = .015;       // la flamme naît 1,5 cm dans le tube

  // ------------------------------------------------------------------ hasard propre
  // Hachage entier (lowbias32 de C. Wellons) : bien mélangé, sans état. Une clé par épisode, un tirage par indice : la
  // k-ième flamme d'un épisode ne dépend que de lui.
  const SEL = 0x45434841;                        // « ECHA » : séparé de toute autre graine du jeu
  function melange(x) {
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
    return x >>> 0;
  }
  // instant compté en pas de 1/120 s : les passages et les épisodes tombent sur des pas de la simulation
  function cle(E, k, genre, t) {
    return melange(melange(E.graine ^ Math.imul(k + 1, 0x9E3779B1)) ^ ((genre << 24) ^ (Math.round(t * 120) & 0xffffff)));
  }
  function tirage(c, i) { return melange(c ^ Math.imul(i + 1, 0x85EBCA77)) / 4294967296; }
  // tirage m (0 à 47) de l'événement i d'un épisode : 0 à 7 pour l'événement, 8 à 39 (huit par sortie), 40 la forme
  const u = (c, i, m) => tirage(c, i * 48 + m);
  const EPISODE = 0x5bd1e995;                    // tirages propres à l'épisode, hors de ceux des événements

  const borner = (x, a, b) => x < a ? a : x > b ? b : x;
  const fract = x => x - Math.floor(x);

  // ------------------------------------------------------------------ formes des flammes
  // Trois fuseaux de longueur 1 le long de −x (base en x = 0, dans le tube ; pointe en x = −1), diamètre 1 au plus
  // gros : larme lisse, larme à trois lobes tordus qui lèche, larme coudée vers le haut. Chaque événement tire la sienne
  // (langue, cœur et bouffée la partagent : une voiture en feu reste un seul lot d'instances). Construits une fois et
  // enregistrés comme formes libres du moteur, avant FRender.create.
  const C = B.carene;
  function fuseau(variante) {
    const ANNEAUX = 16, COTES = 16, faces = [];
    const profil = t => t <= .22 ? .5 * (.45 + .55 * Math.sin(t / .22 * Math.PI / 2))
      : .5 * Math.pow(Math.max(0, Math.cos((t - .22) / .78 * Math.PI / 2)), .85);
    const axe = t => variante === 2 ? [-t, .16 * t * t, .07 * Math.sin(2.6 * t)] : [-t, 0, 0];
    const rayon = (t, a) => profil(t) * (variante === 1 ? 1 + .24 * Math.sin(3 * a + 5.5 * t) * Math.sqrt(t)
      : variante === 2 ? .9 + .1 * Math.sin(9 * t + 1.3) : 1);
    const point = (t, a) => { const c = axe(t), r = rayon(t, a); return [c[0], c[1] + r * Math.sin(a), c[2] + r * Math.cos(a)]; };
    // triangle tourné vers dehors (produit vectoriel des côtés), d'après un point intérieur
    const dehors = (a, b, c, dedans) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = (a[0] + b[0] + c[0]) / 3 - dedans[0], my = (a[1] + b[1] + c[1]) / 3 - dedans[1], mz = (a[2] + b[2] + c[2]) / 3 - dedans[2];
      return nx * mx + ny * my + nz * mz < 0 ? [a, c, b] : [a, b, c];
    };
    const ts = Array.from({ length: ANNEAUX }, (_, i) => .97 * i / (ANNEAUX - 1));
    const anneaux = ts.map(t => Array.from({ length: COTES }, (_, j) => point(t, 2 * Math.PI * j / COTES)));
    for (let i = 0; i + 1 < ANNEAUX; i++) {
      const A = anneaux[i], Bn = anneaux[i + 1], dedans = axe((ts[i] + ts[i + 1]) / 2);
      for (let j = 0; j < COTES; j++) { const k = (j + 1) % COTES; faces.push(dehors(A[j], A[k], Bn[k], dedans), dehors(A[j], Bn[k], Bn[j], dedans)); }
    }
    const pointe = axe(1), dernier = anneaux[ANNEAUX - 1], base = axe(0), presPointe = axe(.95), sousBase = [base[0] - .05, base[1], base[2]];
    for (let j = 0; j < COTES; j++) {
      const k = (j + 1) % COTES;
      faces.push(dehors(dernier[j], dernier[k], pointe, presPointe), dehors(base, anneaux[0][j], anneaux[0][k], sousBase));
    }
    return C.lisser(faces, 70);
  }
  const FORMES = [];
  if (C) for (let v = 0; v < 3; v++) {
    const n = C.normaliser(fuseau(v)), nom = 'bitume-flamme-' + v;
    const R = globalThis.window && globalThis.window.FRender;
    if (R && R.forme) R.forme(nom, n.triangles);
    FORMES.push(Object.freeze({ nom, centre: Object.freeze(n.centre), taille: Object.freeze(n.taille), triangles: n.triangles.length, tri: n.triangles }));
  }
  Object.freeze(FORMES);
  const FORME_DEFAUT = FORMES.length ? FORMES[0] : Object.freeze({ nom: 'sphere', centre: [0, 0, 0], taille: [1, 1, 1], triangles: 0, tri: [] });

  // ------------------------------------------------------------------ état
  function objet() { return { shape: FORME_DEFAUT.nom, p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], fx: true, alpha: 0, color: [1, 1, 1], emissive: 0 }; }

  // n voitures ; graine : celle de la course (jeu.js), mêlée à un sel propre
  function creer(n, graine) {
    const N = n * NS, K = IMPULSIONS;
    const E = {
      n, graine: ((graine >>> 0) ^ SEL) >>> 0, libere: false, horloge: 0, dernier: -Infinity, dessines: 0,
      // dernier état lu de chaque voiture
      vu: new Uint8Array(n), rapport: new Int8Array(n), vitesse: new Float32Array(n), regime: new Float32Array(n),
      gaz: new Float32Array(n), tGaz: new Float64Array(n).fill(-Infinity),
      // passage en attente : deux places par voiture (la détonation, puis le second claquement)
      attT: new Float64Array(n * 2).fill(Infinity), attF: new Float32Array(n * 2), attG: new Uint8Array(n * 2),
      attC: new Uint32Array(n * 2), attI: new Uint8Array(n * 2),
      // épisode de crépitements (0 éteint, 1 en cours, 2 épuisé : attend que le pied revienne)
      crEtat: new Uint8Array(n), crT0: new Float64Array(n), crCle: new Uint32Array(n), crK: new Uint16Array(n),
      crProchain: new Float64Array(n), crI0: new Float32Array(n),
      // séjour au rupteur
      ruEtat: new Uint8Array(n), ruT0: new Float64Array(n), ruCle: new Uint32Array(n), ruK: new Uint32Array(n), ruProchain: new Float64Array(n),
      // flammes : IMPULSIONS par sortie, en anneau
      impT0: new Float64Array(N * K).fill(-Infinity), impVie: new Float32Array(N * K), impForce: new Float32Array(N * K),
      impLong: new Float32Array(N * K), impLarge: new Float32Array(N * K), impGenre: new Uint8Array(N * K), impForme: new Uint8Array(N * K),
      impTeinte: new Float32Array(N * K), impRoulis: new Float32Array(N * K), impLacet: new Float32Array(N * K),
      impTangage: new Float32Array(N * K), impBouffee: new Float32Array(N * K), impProchain: new Uint8Array(N),
      finCar: new Float64Array(n).fill(-Infinity), intensite: new Float32Array(n),
      // file des sons, circulaire : src/son.js la lit (echappement) et joue ce qui est nouveau
      son: { n: 0, taille: 64, horloge: 0, liste: Array.from({ length: 64 }, () => ({ voiture: -1, genre: '', t: 0, force: 0, variante: 0, hauteur: 1 })) },
      objets: Array.from({ length: N * OBJETS_PAR_SORTIE }, objet),
      compte: { detonation: 0, crepitement: 0, rate: 0 }
    };
    return E;
  }

  function eteindre(E, k) {
    E.attT[2 * k] = E.attT[2 * k + 1] = Infinity;
    E.crEtat[k] = 0; E.ruEtat[k] = 0;
  }
  function reinitialiser(E) {
    E.vu.fill(0); E.attT.fill(Infinity); E.crEtat.fill(0); E.ruEtat.fill(0); E.tGaz.fill(-Infinity);
    E.impT0.fill(-Infinity); E.finCar.fill(-Infinity); E.intensite.fill(0);
  }

  // ------------------------------------------------------------------ décision, à chaque pas de la simulation
  // voitures : celles de la course (état dans v.etat) ou des états nus { regime, gaz, rapport, v, coupure } ;
  // horloge : temps de la course (s), après le pas. Appelé à chaque pas de 1/120 s (jeu.js), chaque instant est exact.
  function pas(E, voitures, horloge) {
    if (!E || E.libere || !voitures || !Number.isFinite(horloge)) return;
    if (horloge < E.dernier - 1e-9) reinitialiser(E);          // horloge reprise en arrière : nouvelle séance
    E.dernier = E.horloge = E.son.horloge = horloge;
    const P = PARAMS, Pc = B.conduite && B.conduite.PARAMS, duree = Pc ? Pc.rapportDuree : .08;
    for (let k = 0, n = Math.min(E.n, voitures.length); k < n; k++) {
      const v = voitures[k];
      if (!v) continue;
      const et = v.etat || v, regime = +et.regime || 0, gaz = +et.gaz || 0, rapport = et.rapport | 0, vit = Math.abs(+et.v || 0);
      // épave, accident, remise en piste, réparation : le moteur ne crache plus rien
      const hors = !!(v.abandon || (et.degats && et.degats.casse) || et.accident || et.recuperation || et.reparation);
      if (hors || !E.vu[k]) {
        E.vu[k] = hors ? 0 : 1; E.rapport[k] = rapport; E.vitesse[k] = vit; E.regime[k] = regime; E.gaz[k] = gaz;
        if (hors) eteindre(E, k);
        continue;
      }
      if (gaz >= P.gazOuvert) E.tGaz[k] = horloge;
      const leve = regime >= P.regimeCrepitement && gaz <= P.gazLeve;
      // 1. passage de rapport, daté par la coupure en cours (conduite.js la met à rapportDuree au pas du passage) ;
      //    régime et gaz d'avant le passage : ceux du pas précédent
      if (rapport !== E.rapport[k]) {
        const avant = E.rapport[k];
        if (avant >= 1 && rapport >= 1 && Math.abs(rapport - avant) === 1 && vit > P.vitessePassage) {
          const coupure = +et.coupure || 0, t = coupure > 0 && coupure <= duree ? horloge - (duree - coupure) : horloge;
          passage(E, k, t, rapport > avant, Math.max(regime, E.regime[k]), E.gaz[k], leve);
        }
      }
      // 2. rupteur
      const auRupteur = gaz >= P.gazRupteur && regime >= (E.ruEtat[k] ? P.regimeRupteurSortie : P.regimeRupteur);
      if (E.ruEtat[k]) { avancerRupteur(E, k, auRupteur ? horloge : horloge - 1e-9, vit); if (!auRupteur) E.ruEtat[k] = 0; }
      else if (auRupteur) { demarrerRupteur(E, k, horloge); avancerRupteur(E, k, horloge, vit); }
      // 3. crépitements du pied levé
      if (E.crEtat[k] === 1) avancerCrepitements(E, k, leve ? horloge : horloge - 1e-9);
      if (!leve) E.crEtat[k] = 0;
      else if (E.crEtat[k] === 0) { demarrerCrepitements(E, k, horloge, regime, horloge - E.tGaz[k] <= P.recent); avancerCrepitements(E, k, horloge); }
      // 4. détonations des passages, à leur heure
      for (let j = 2 * k; j < 2 * k + 2; j++) if (E.attT[j] <= horloge) {
        const t = E.attT[j], c = E.attC[j], i = E.attI[j];
        E.attT[j] = Infinity;
        emettre(E, k, E.attG[j], t, E.attF[j], E.attG[j] === DETONATION ? TOUTES : BANC[u(c, i, 3) < .5 ? 0 : 1], c, i);
      }
      E.rapport[k] = rapport; E.vitesse[k] = vit; E.regime[k] = regime; E.gaz[k] = gaz;
      E.intensite[k] = horloge < E.finCar[k] ? intensite(E, k, horloge) : 0;
    }
  }

  // Passage : la détonation suit presque toujours une montée à haut régime ; un rétrogradage claque moins souvent et
  // relance les crépitements, comme au freinage d'un vrai douze-cylindres.
  function passage(E, k, t, haut, regime, gaz, leve) {
    const P = PARAMS;
    if (!haut && E.crEtat[k] === 1) { avancerCrepitements(E, k, t - 1e-9); E.crEtat[k] = 0; }
    if (!haut && leve) demarrerCrepitements(E, k, t, regime, true);
    if (regime < P.regimeFlamme) return;
    const c = cle(E, k, DETONATION, t), f = borner((regime - P.regimeFlamme) / (P.regimePlein - P.regimeFlamme), 0, 1);
    const chance = haut ? Math.min(1, .3 + .85 * f) : .25 + .45 * f;
    if (tirage(c ^ EPISODE, 0) >= chance) return;
    const force = haut ? (.45 + .55 * f) * (.55 + .45 * borner(gaz, 0, 1)) : (.3 + .4 * f) * .8, j = 2 * k;
    E.attT[j] = t + P.fenetre[0] + (P.fenetre[1] - P.fenetre[0]) * tirage(c ^ EPISODE, 1);
    E.attF[j] = force; E.attG[j] = DETONATION; E.attC[j] = c; E.attI[j] = 0;
    if (tirage(c ^ EPISODE, 2) < (haut ? .45 : .6)) {
      E.attT[j + 1] = t + P.second[0] + (P.second[1] - P.second[0]) * tirage(c ^ EPISODE, 3);
      E.attF[j + 1] = force * (.3 + .3 * tirage(c ^ EPISODE, 4)); E.attG[j + 1] = CREPITEMENT; E.attC[j + 1] = c; E.attI[j + 1] = 1;
    } else E.attT[j + 1] = Infinity;
  }

  function demarrerCrepitements(E, k, t, regime, recent) {
    const P = PARAMS, c = cle(E, k, CREPITEMENT, t);
    E.crEtat[k] = 1; E.crT0[k] = t; E.crCle[k] = c; E.crK[k] = 0;
    E.crI0[k] = (.35 + .65 * borner((regime - P.regimeCrepitement) / (P.regimeMax - P.regimeCrepitement), 0, 1)) * (recent ? 1 : .7);
    E.crProchain[k] = t + .016 + .05 * tirage(c ^ EPISODE, 0);
  }
  // Claquements dus jusqu'à `limite` : espacés de 30 à 150 ms au début, de plus en plus rares et faibles.
  function avancerCrepitements(E, k, limite) {
    const P = PARAMS;
    while (E.crEtat[k] === 1 && E.crProchain[k] <= limite) {
      const i = E.crK[k], c = E.crCle[k], t = E.crProchain[k], age = t - E.crT0[k];
      const force = E.crI0[k] * Math.exp(-age / .8) * (.4 + .6 * u(c, i, 2));
      // un banc entier (55 %), sinon un seul tube, le haut plus souvent que le bas
      const banc = u(c, i, 3) < .5 ? 0 : 1, choix = u(c, i, 7);
      emettre(E, k, CREPITEMENT, t, force, choix < .55 ? BANC[banc] : 1 << (banc + (choix < .82 ? 0 : 2)), c, i);
      E.crK[k] = i + 1;
      E.crProchain[k] = t + (.03 + .12 * Math.pow(u(c, i, 1), 1.7)) * (1 + age / .6);
      if (i + 1 >= P.crepitementsMax || E.crProchain[k] - E.crT0[k] > P.crepitementDuree || force < .04) E.crEtat[k] = 2;
    }
  }

  // Rupteur : une coupure par dixième de seconde, à ± 15 ms ; à l'arrêt (grille) le moteur rebondit sans charge et
  // crache moins.
  const instantRupteur = (E, k, i) => E.ruT0[k] + .022 + i * PARAMS.cadenceRupteur + (u(E.ruCle[k], i, 1) - .5) * .03;
  function demarrerRupteur(E, k, t) {
    E.ruEtat[k] = 1; E.ruT0[k] = t; E.ruCle[k] = cle(E, k, RATE, t); E.ruK[k] = 0;
    E.ruProchain[k] = instantRupteur(E, k, 0);
  }
  function avancerRupteur(E, k, limite, vit) {
    while (E.ruEtat[k] === 1 && E.ruProchain[k] <= limite) {
      const i = E.ruK[k], c = E.ruCle[k], t = E.ruProchain[k], arret = vit < 1;
      if (u(c, i, 0) < (arret ? .45 : .7)) {
        const force = (.55 + .4 * u(c, i, 2)) * (arret ? .75 : 1);
        emettre(E, k, RATE, t, force, u(c, i, 3) < .6 ? TOUTES : BANC[i & 1], c, i);
      }
      E.ruK[k] = i + 1;
      E.ruProchain[k] = instantRupteur(E, k, i + 1);
    }
  }

  // Un événement : une entrée de la file des sons et une flamme dans chaque sortie du masque.
  function emettre(E, k, genre, t, force, masque, c, i) {
    const F = E.son, ev = F.liste[F.n % F.taille];
    F.n++;
    ev.voiture = k; ev.genre = GENRES[genre]; ev.t = t; ev.force = force;
    ev.variante = (u(c, i, 5) * 7) | 0; ev.hauteur = .9 + .2 * u(c, i, 6);
    E.compte[GENRES[genre]]++;
    const famille = u(c, i, 4), forme = Math.min(FORMES.length - 1, (u(c, i, 40) * FORMES.length) | 0);
    for (let o = 0; o < NS; o++) if (masque & (1 << o)) impulsion(E, k, o, genre, t, force, c, i, famille, forme);
  }

  function impulsion(E, k, o, genre, t, force, c, i, famille, forme) {
    const q = k * NS + o, j = q * IMPULSIONS + E.impProchain[q], m = 8 + o * 8, S = SORTIES[o];
    E.impProchain[q] = (E.impProchain[q] + 1) % IMPULSIONS;
    const U0 = u(c, i, m), U1 = u(c, i, m + 1), U2 = u(c, i, m + 2), U7 = u(c, i, m + 7);
    let vie, long, large, teinte, bouffee, t0 = t;
    if (genre === DETONATION) {
      vie = .095 + .05 * U0; long = (.3 + .34 * force) * (.85 + .3 * U1); large = (.17 + .1 * force) * (.9 + .2 * U2);
      teinte = .8 + .2 * fract(U7 * 7.31); bouffee = force * (.7 + .3 * fract(U7 * 13.37)); t0 = t + .005 * U7;
    } else if (genre === CREPITEMENT) {
      vie = .035 + .045 * U0; long = (.14 + .34 * force) * (.8 + .4 * U1); large = (.08 + .08 * force) * (.85 + .3 * U2);
      // une famille par claquement : bleue (mélange pauvre, un sur quatre) ou orangée (riche), jamais un mélange
      // boueux ; de jour, le bleu se voit à peine (captures du 18/11) : l'orangé domine, comme sur les photos d'époque
      teinte = famille < .25 ? .2 * fract(U7 * 5.17) : .8 + .2 * fract(U7 * 5.17);
      bouffee = U7 < .12 ? .35 * force : 0;
    } else {
      vie = .07 + .04 * U0; long = (.25 + .3 * force) * (.85 + .3 * U1); large = (.11 + .07 * force) * (.9 + .2 * U2);
      teinte = .85 + .15 * fract(U7 * 3.7); bouffee = U7 < .5 ? .6 * force : 0;
    }
    if (!S.haut) { long *= .9; large *= .92; }
    E.impT0[j] = t0; E.impVie[j] = vie; E.impForce[j] = force; E.impLong[j] = long; E.impLarge[j] = large;
    E.impGenre[j] = genre; E.impForme[j] = forme; E.impTeinte[j] = teinte; E.impBouffee[j] = bouffee;
    // la larme coudée garde son coude vers le haut ; les autres tournent librement sur leur axe
    E.impRoulis[j] = forme === 2 ? (u(c, i, m + 4) - .5) * .9 : u(c, i, m + 4) * 2 * Math.PI;
    E.impLacet[j] = (u(c, i, m + 5) - .5) * .16; E.impTangage[j] = (u(c, i, m + 6) - .5) * .2;
    const fin = t0 + Math.max(vie, bouffee > 0 ? VIE_BOUFFEE : 0);
    if (fin > E.finCar[k]) E.finCar[k] = fin;
  }

  // Montée brève (14 ms au plus), puis extinction ; nulle hors de la vie de la flamme.
  function enveloppe(a, vie) {
    if (!(a >= 0) || a >= vie) return 0;
    const ta = Math.min(.014, vie * .22);
    return a < ta ? Math.sqrt(a / ta) : Math.pow(1 - (a - ta) / (vie - ta), 1.35);
  }
  // Intensité de flamme d'une voiture à l'instant t (0 à 1 environ) : la plus forte de ses sorties.
  function intensite(E, k, t) {
    let m = 0;
    for (let j = k * NS * IMPULSIONS, fin = j + NS * IMPULSIONS; j < fin; j++) {
      const v = enveloppe(t - E.impT0[j], E.impVie[j]) * E.impForce[j];
      if (v > m) m = v;
    }
    return m;
  }

  // ------------------------------------------------------------------ dessin, à chaque image
  // Matrices 3 × 3 en colonnes (images de x, y, z), dans des tableaux réservés : rien n'est alloué.
  const M = new Float64Array(9), MR = new Float64Array(9), R1 = new Float64Array(9), W = new Float64Array(9);
  // même ordre que le moteur et voiture.js : Rz(rz)·Ry(ry)·Rx(rx)
  function eulerDans(rx, ry, rz, m) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    m[0] = cz * cy; m[1] = sz * cy; m[2] = -sy;
    m[3] = cz * sy * sx - sz * cx; m[4] = sz * sy * sx + cz * cx; m[5] = cy * sx;
    m[6] = cz * sy * cx + sz * sx; m[7] = sz * sy * cx - cz * sx; m[8] = cy * cx;
    return m;
  }
  function mulDans(a, b, m) {   // m = a·b ; m distinct de a et de b
    for (let c = 0; c < 9; c += 3) {
      const x = b[c], y = b[c + 1], z = b[c + 2];
      m[c] = a[0] * x + a[3] * y + a[6] * z; m[c + 1] = a[1] * x + a[4] * y + a[7] * z; m[c + 2] = a[2] * x + a[5] * y + a[8] * z;
    }
    return m;
  }
  // attitude de la caisse, comme voiture.attitude : Ry(−cap)·Rz(tangage)·Rx(roulis)
  function attitudeDans(cap, tangage, roulis, m) { eulerDans(0, -cap, 0, R1); eulerDans(roulis, 0, tangage, MR); return mulDans(R1, MR, m); }
  function anglesDans(m, r) { r[0] = Math.atan2(m[5], m[8]); r[1] = -Math.asin(borner(m[2], -1, 1)); r[2] = Math.atan2(m[1], m[0]); return r; }

  // Pousse dans `sortie` les flammes visibles à l'instant t (temps de la course de l'image, celui des poses
  // interpolées). poses : position et attitude de chaque voiture { x, y, z, cap, tangage, roulis } ; exclure : voiture
  // à ne pas dessiner (celle du pilote en vue cockpit : l'arrière de sa caisse ne l'est pas non plus). Aucune distance
  // n'entre en compte : la flamme est la même de près et de loin. Rend le nombre d'objets poussés.
  function dessiner(E, sortie, poses, t, exclure = -1, reflet) {
    if (reflet) reflet.debut = reflet.fin = reflet.debutPilote = reflet.finPilote = sortie?.length || 0;
    if (!E || E.libere || !sortie || !poses) return 0;
    let total = 0;
    for (let k = 0, n = Math.min(E.n, poses.length); k < n; k++) {
      if (k === exclure || !(t < E.finCar[k])) continue;
      const p = poses[k];
      if (!p) continue;
      attitudeDans(p.cap || 0, p.tangage || 0, p.roulis || 0, M);
      const debut = sortie.length;
      for (let o = 0; o < NS; o++) total += flammeSortie(E, k, o, p, t, E.vitesse[k], sortie);
      if (reflet && k === reflet.pilote) { reflet.debutPilote = debut; reflet.finPilote = sortie.length; }
    }
    if (reflet) reflet.fin = sortie.length;
    E.dessines = total;
    return total;
  }

  // point (bx, by, bz) de la caisse dans le monde, plus un décalage (cx, cy, cz) pris dans le repère W de la flamme
  function placer(o, p, bx, by, bz, cx, cy, cz) {
    o.p[0] = p.x + M[0] * bx + M[3] * by + M[6] * bz + W[0] * cx + W[3] * cy + W[6] * cz;
    o.p[1] = p.y + M[1] * bx + M[4] * by + M[7] * bz + W[1] * cx + W[4] * cy + W[7] * cz;
    o.p[2] = p.z + M[2] * bx + M[5] * by + M[8] * bz + W[2] * cx + W[5] * cy + W[8] * cz;
  }
  // teinte < .5 : bleu profond vers bleu vif ; sinon rouge, orange puis orangé clair quand la flamme est au plus fort.
  // Le moteur multiplie la couleur par l'émission puis compresse chaque canal (x / (x + 0,76)) : des canaux vert et bleu
  // faibles gardent la flamme orange au lieu de la blanchir (essais du 18/11 : à 0,3 de vert, elle virait au beige).
  function teinter(c, teinte, h) {
    if (teinte < .5) { c[0] = .05 + .1 * h; c[1] = .12 + .15 * h; c[2] = 1; }
    else { const y = (teinte - .8) * 5; c[0] = 1; c[1] = .045 + (.07 + .07 * y) * Math.pow(h, 1.2); c[2] = .004 + (.01 + .012 * y) * h * h; }
  }

  function flammeSortie(E, k, o, p, t, vit, sortie) {
    const q = k * NS + o, S = SORTIES[o];
    let j = -1, valeur = 0, env = 0, b = -1;
    for (let i = q * IMPULSIONS, fin = i + IMPULSIONS; i < fin; i++) {
      const a = t - E.impT0[i];
      if (!(a >= 0)) continue;
      const e = enveloppe(a, E.impVie[i]), v = e * E.impForce[i];
      if (v > valeur) { valeur = v; j = i; env = e; }
      if (E.impBouffee[i] > 0 && a < VIE_BOUFFEE && (b < 0 || E.impT0[i] > E.impT0[b])) b = i;
    }
    let n = 0;
    const objs = E.objets, base = q * OBJETS_PAR_SORTIE, bx = S.x + RENTREE;
    if (j >= 0 && valeur > .004) {
      const f = E.impForce[j], ph = E.impRoulis[j];
      // scintillement : deux battements rapides, fonction du seul temps (la même image à toute cadence)
      const sc = 1 + .16 * Math.sin(t * 97 + ph * 3) + .10 * Math.sin(t * 171 + ph * 7);
      // lancée, l'air étire la flamme (jusqu'à moitié plus longue) ; à l'arrêt, le gaz chaud monte
      const L = E.impLong[j] * (.35 + .65 * env) * sc * Math.min(1.45, 1 + vit / 120), D = E.impLarge[j] * (.55 + .45 * env) * (1.12 - .12 * sc);
      eulerDans(ph, E.impLacet[j], E.impTangage[j] - .22 * (1 - Math.min(1, vit / 25)), MR);
      mulDans(M, MR, W);
      const F = FORMES[E.impForme[j]] || FORME_DEFAUT, ol = objs[base + 1];
      ol.shape = F.nom;
      ol.s[0] = F.taille[0] * L; ol.s[1] = F.taille[1] * D; ol.s[2] = F.taille[2] * D;
      placer(ol, p, bx, S.y, S.z, F.centre[0] * L, F.centre[1] * D, F.centre[2] * D);
      anglesDans(W, ol.r);
      teinter(ol.color, E.impTeinte[j], env);
      ol.alpha = Math.min(.8, .8 * Math.pow(env, .6) * (.7 + .3 * Math.min(1, f)));
      ol.emissive = 1.1 + 1.5 * env;
      sortie.push(ol); n++;
      // cœur : une flamme plus courte et plus mince dans la langue, plus chaude (jaune presque blanc, ou bleu clair) ;
      // la passe des effets mêle les deux par transparence : le centre brille, les bords restent orangés ou bleus ; au
      // loin, ce point clair fait repérer le passage d'une concurrente
      const oc = objs[base], Lc = .55 * L, Dc = .52 * D;
      oc.shape = F.nom;
      oc.s[0] = F.taille[0] * Lc; oc.s[1] = F.taille[1] * Dc; oc.s[2] = F.taille[2] * Dc;
      placer(oc, p, bx, S.y, S.z, F.centre[0] * Lc, F.centre[1] * Dc, F.centre[2] * Dc);
      oc.r[0] = ol.r[0]; oc.r[1] = ol.r[1]; oc.r[2] = ol.r[2];
      if (E.impTeinte[j] < .5) { oc.color[0] = .1 + .15 * env; oc.color[1] = .3 + .2 * env; oc.color[2] = 1; }
      else { oc.color[0] = 1; oc.color[1] = .42 + .2 * env; oc.color[2] = .09 + .08 * env; }
      oc.alpha = Math.min(.92, .95 * Math.pow(env, .45)); oc.emissive = 2.2 + 1.8 * env;
      if (oc.alpha > .004) { sortie.push(oc); n++; }
    }
    // bouffée : la boule de feu chassée du tube (6 m/s) ralentit dans l'air et reste derrière la voiture en grossissant
    if (b >= 0) {
      const a = t - E.impT0[b], x = a / VIE_BOUFFEE, tau = .05, y = 1 - x;
      const recul = .06 + vit * a + (6 - vit) * tau * (1 - Math.exp(-a / tau)), monte = .5 * a;
      const ob = objs[base + 2], d = (.2 + 2.5 * a) * (.7 + .6 * E.impBouffee[b]), F = FORMES[E.impForme[b]] || FORME_DEFAUT;
      ob.shape = F.nom;
      ob.s[0] = F.taille[0] * 1.3 * d; ob.s[1] = F.taille[1] * d; ob.s[2] = F.taille[2] * d;
      const cx = S.x - recul, cy = S.y + monte;
      ob.p[0] = p.x + M[0] * cx + M[3] * cy + M[6] * S.z;
      ob.p[1] = p.y + M[1] * cx + M[4] * cy + M[7] * S.z;
      ob.p[2] = p.z + M[2] * cx + M[5] * cy + M[8] * S.z;
      anglesDans(M, ob.r);
      ob.color[0] = 1; ob.color[1] = .06 + .14 * y * y; ob.color[2] = .008 + .01 * y;
      ob.alpha = .7 * E.impBouffee[b] * Math.pow(Math.max(0, y), 2) * Math.min(1, a / .01);
      ob.emissive = .2 + 1.6 * y;
      if (ob.alpha > .004) { sortie.push(ob); n++; }
    }
    return n;
  }

  // ------------------------------------------------------------------ outils
  function compter(E) {
    let actives = 0;
    const t = E.horloge;
    for (let j = 0; j < E.impT0.length; j++) {
      const a = t - E.impT0[j];
      if (a >= 0 && a < Math.max(E.impVie[j], E.impBouffee[j] > 0 ? VIE_BOUFFEE : 0)) actives++;
    }
    return { flammes: actives, objets: E.dessines, evenements: E.son.n, detonations: E.compte.detonation, crepitements: E.compte.crepitement, rates: E.compte.rate };
  }
  function liberer(E) { if (E) { E.libere = true; reinitialiser(E); } }

  B.echappement = {
    creer, pas, dessiner, compter, liberer, intensite, enveloppe,
    SORTIES, PARAMS, FORMES, GENRES, IMPULSIONS, OBJETS_PAR_VOITURE, VIE_BOUFFEE, RENTREE,
    // pour les vérifications
    cle, tirage, eulerDans, mulDans, attitudeDans, anglesDans
  };
})(globalThis.BITUME = globalThis.BITUME || {});
