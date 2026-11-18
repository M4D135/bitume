/* BITUME — détection locale des réglages. Mesure le rendu, jamais le nom du GPU pour choisir un palier : le nom ne
   sert qu'à reconnaître un rendu logiciel (aucune carte graphique), qui conclut Légère sans figer la page. */
(function (B) {
  'use strict';
  // REVISION entre dans l'empreinte et dans la validité du cache : la monter fait refaire une fois les détections
  // enregistrées. Révision 1 : chronomètre GPU. Révision 2 : image dessinée puis terminée, une par une (la lecture
  // d'un pixel mettait le fil principal, le processus graphique et la carte en série : Légère choisie sur un Apple M5
  // qui tient Moyenne à 60 images par seconde). Révision 3 : rafales d'images en vol, simulation comprise.
  const REVISION = 3, CLE = 'bitume.detection.v1', METHODE = 'rafales';
  const CLES = Object.freeze(['qualite', 'anticrenelage', 'ombres', 'vegetation', 'faune', 'retro']);
  // Noms courts des options, pour dire dans l'onglet Image lesquelles le joueur a gardées.
  const NOMS = Object.freeze({ qualite: 'qualité', anticrenelage: 'anticrénelage', ombres: 'ombres', vegetation: 'végétation',
    faune: 'faune', retro: 'rétroviseurs' });
  const profils = {
    low: { nom: 'Légère', qualite: 'low', anticrenelage: 'off', ombres: 'off', vegetation: 'off', faune: 'off', retro: 'non' },
    medium: { nom: 'Moyenne', qualite: 'medium', anticrenelage: 'msaa4', ombres: 'medium', vegetation: 'medium', faune: 'medium', retro: 'auto' },
    high: { nom: 'Fine', qualite: 'high', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'high', faune: 'high', retro: 'auto' },
    extreme: { nom: 'Fine · végétation extrême', qualite: 'high', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra', faune: 'ultra', retro: 'auto' },
  };
  for (const p of Object.values(profils)) Object.freeze(p);
  Object.freeze(profils);

  // Méthode des rafales. À chaque rappel d'image, le parcours (src/scene-bench.js) enchaîne R images de course d'un
  // même point de vue (deux pas de simulation des douze voitures, puis le rendu complet, glaces des rétroviseurs
  // comprises), puis io.terminer() force la fin du travail graphique (lecture d'un pixel). Le coût d'une image est la
  // durée de la rafale divisée par R. Dans la rafale, le processeur prépare l'image suivante pendant que la carte
  // dessine la précédente, comme en course : la lecture d'un pixel après chaque image les mettait en série et comptait
  // à chaque image la latence de la carte (Moyenne mesurée de 14 à 29 ms sur le M5 qui la tient à 60 images par
  // seconde). Mesurée sur le M5 le 18/11, la rafale donne une à deux millisecondes près le débit que la boucle
  // d'affichage tient quand on lui fait dessiner deux ou trois images par rappel, sans en dépendre : un écran bridé à
  // 30 Hz, un écran à 120 Hz ou une fenêtre sans affichage ne changent pas le coût mesuré.
  // Le budget vise 60 images par seconde sur tout écran : un écran à 120 ou 144 Hz se cale sur un diviseur de sa
  // cadence (src/cadence.js), un bridage à 30 Hz (économie d'énergie) ne dit rien de la machine. La période de l'écran
  // est relevée pour mémoire ; elle ne juge pas.
  // FRACTION : part du budget que l'image mesurée peut prendre. Le reste couvre la composition de la page, un
  // ramassage mineur de la mémoire, les endroits du circuit plus chargés que les trois points de vue et les écarts
  // d'une image à l'autre. Elle est confirmée en fenêtre réelle (docs/reprise/rapports/detection-2026-11-18).
  const BUDGET = 1000 / 60, FRACTION = .8, LIMITE = BUDGET * FRACTION;
  // Fil principal : la course y fait bien plus que le parcours (caméra, glaces, météo, habitacle, affichage, son, puis
  // la mise en page du navigateur). Relevé le 18/11 sur le M5 avec le volet de mesures, en Moyenne au départ de
  // Val-Brûlé : boucle de la course 4,6 à 5,2 ms par image pour 1,6 à 1,75 ms au parcours (deux séances, 2,7 à 3,1
  // fois) ; processeur ralenti quatre fois, 18,6 à 21,8 ms pour 8,35 ms (le ralentissement émulé gonfle le parcours
  // plus que la course). COURSE_PROCESSEUR estime ainsi le fil principal de la course d'après celui du parcours, au
  // rapport du processeur réel ; l'estimation doit tenir dans PART_PROCESSEUR du budget, pour que les images les plus
  // lourdes (une fois et demie la médiane) et un ramassage de mémoire y tiennent encore. Sans cette règle, le
  // processeur ralenti quatre fois passait Moyenne (11 ms en rafale, sous la limite) et la course y ratait 14 à 95
  // images en 10 s ; au rapport 2,5, il la passait encore machine peu chargée (3,3 ms au parcours, 8,25 estimés).
  const COURSE_PROCESSEUR = 3, PART_PROCESSEUR = .5, LIMITE_PROCESSEUR = BUDGET * PART_PROCESSEUR;
  // Glaces que la course dessinerait mais que le parcours ne peut pas dessiner (moteur des glaces impossible à
  // créer) : leur part est retirée de la limite. Comptée le 18/11 au départ de Val-Brûlé, une image de glace pèse
  // 0,36 fois les triangles de la vue principale en Fine (une glace par image) ; en Moyenne, une image sur deux.
  const PART_GLACES = .36;
  function limiteProfil(info) {
    if (!info || info.glaces !== 'absentes') return LIMITE;
    const parImage = Number.isFinite(info.glacesParImage) ? Math.max(0, Math.min(1, info.glacesParImage)) : 1;
    return LIMITE / (1 + PART_GLACES * parImage);
  }
  // Extrême rend le tapis d'herbe trente fois plus dru que Fine : il n'est essayé que si Fine tient dans la moitié
  // de la limite.
  const EXTREME = .5;
  // Chauffe : deux tours des trois points de vue, une image à la fois. Deux images de suite du second tour
  // (programmes compilés) au-delà de ESPOIR budgets en série, ou deux images de suite après la première au-delà de
  // ESPOIR_VITE budgets, et le palier est jugé sans espoir : la rafale gagne au mieux le recouvrement du processeur
  // et de la carte, jamais un facteur trois. Une image seule ne juge pas : le M5 en a montré une de 52 ms au second
  // tour de Moyenne, qu'il tient (le 18/11).
  const ESPOIR = 3, ESPOIR_VITE = 6;
  // Avant tout décor, deux relevés jugent Moyenne sans espoir et concluent Légère tout de suite, sans bâtir son décor
  // ni compiler ses programmes (4 à 9 s de page figée en rendu logiciel, 6 s de décor avec un processeur ralenti
  // quatre fois, le 18/11) :
  // - la sonde (src/scene-bench.js) : un rendu logiciel (pas de carte graphique : SwiftShader, llvmpipe…), ou plus de
  //   SONDE_MS par passe de 512 × 512 pixels d'un programme minuscule (0,2 à 1,2 ms sur le M5, chargé compris ; une
  //   carte assez lente pour les dépasser ne tiendrait pas Moyenne, dont l'image en demande des dizaines de fois plus) ;
  // - la simulation des images à vide : la boucle de la course pèse environ COURSE_SIMULATION fois deux pas de la
  //   simulation du parcours (le 18/11 sur le M5, volet de mesures : boucle de 3,9 à 5,2 ms pour des pas de 0,11 à
  //   0,25 ms au rythme normal ; 18,6 à 21,8 ms pour 0,43 à 0,55 ms, processeur ralenti quatre fois). Une boucle
  //   estimée au-delà du budget (un pas de plus de 0,52 ms) : la course ne tiendrait pas même son fil principal. Elle
  //   doit l'être deux fois, à quelques images d'écart : le M5 donne 0,05 à 0,5 ms selon la charge, mais une fois 0,58
  //   sous une charge de 9 (le 18/11 ; quelques images ralenties par un autre travail).
  const SONDE_MS = 4, COURSE_SIMULATION = 16;
  // Rafales : R images (2 à 4) pour environ 48 ms de travail, quatre rafales par point de vue.
  const RAFALE_MS = 48, R_MIN = 2, R_MAX = 4, RAFALES_PAR_VUE = 4, MESURE_MS = 1200;
  // Une détection automatique interrompue par autre chose que le joueur (onglet caché, contexte perdu, délai) est
  // refaite à l'ouverture suivante, deux fois au plus pour une même version.
  const TENTATIVES = 2;
  // Durée : trois secondes sur une machine correcte, six au pire. Un palier de plus n'est essayé que s'il tient dans
  // DUREE_MAX, estimé à la durée du palier précédent (décor compris ; le premier décor, qui compile le code du jeu, est
  // le plus long). DELAI : garde-fou d'une machine dont le premier décor ne finit pas.
  const DUREE_MAX = 6000, DELAI = 14000;
  // Un palier dont le décor a demandé plus de PREPARATION_MAX n'est pas mesuré (Légère si c'est Moyenne) : sa mesure
  // sortirait des six secondes, et un processeur aussi lent ne tient pas la course. Décor de Moyenne le 18/11 : 0,6 à
  // 2,6 s sur le M5 (très chargé compris) ; 2,4 à 4 s processeur ralenti deux fois, 2 à 7,2 s quatre fois et 3 à
  // 8,8 s six fois selon la charge. Aucune des mesures au-delà de 3 s n'a accepté Moyenne.
  const PREPARATION_MAX = DUREE_MAX / 2;

  const q = (liste, p) => {
    const a = liste.filter(x => Number.isFinite(x) && x >= 0).slice().sort((x, y) => x - y);
    return a.length ? a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))] : null;
  };
  const arrondir = v => Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
  // C : une détection par version du jeu et par machine (processeur graphique annoncé par le navigateur, taille de
  // texture, cœurs). Ni la taille de la fenêtre, ni la densité de pixels, ni l'écran n'y entrent : la mesure se fait à
  // la taille de l'écran entier (src/jeu.js), un redimensionnement ou un autre écran ne la relancent pas.
  function empreinte(materiel, version) {
    const texte = [REVISION, version || '?', materiel || 'webgl2'].join('|');
    let h = 2166136261;
    for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }
  function reglages(id) {
    const p = profils[id];
    return p ? Object.fromEntries(CLES.map(k => [k, p[k]])) : null;
  }
  // Le cache dit si la détection de cette version a déjà eu lieu sur cette machine : réussie, passée par le joueur, ou
  // interrompue TENTATIVES fois. Une mesure prise sous un écran bridé à 30 Hz est provisoire : le bridage vient le
  // plus souvent de l'économie d'énergie de Chrome, signe d'une machine qui n'est pas dans son état ordinaire
  // (Moyenne mesurée de 7,8 à 23,9 ms sous bridage sur le M5 le 18/11, selon la charge, pour 7 à 10 d'ordinaire). Elle
  // est appliquée, puis refaite à l'ouverture suivante ; TENTATIVES mesures bridées de suite valent verdict.
  // Un onglet passé en arrière-plan (onglet_masque) n'est jamais un verdict : la page attend le retour du joueur pour
  // mesurer (src/jeu.js, premierPlan), et une trace laissée ainsi ne compte pas parmi les tentatives.
  function cacheValide(cache, cle) {
    if (!cache || cache.revision !== REVISION || cache.empreinte !== cle) return false;
    if (cache.statut === 'ok') return Object.prototype.hasOwnProperty.call(profils, cache.selection)
      && Array.isArray(cache.mesures) && cache.mesures.length > 0 && (!cache.cadenceBridee || (cache.tentatives | 0) >= TENTATIVES);
    return cache.statut === 'interrompu' && (cache.motif === 'annule'
      || (cache.motif !== 'onglet_masque' && (cache.tentatives | 0) >= TENTATIVES));
  }
  // Tentatives de la même version sans verdict définitif (interruptions, mesures sous un écran bridé), celle-ci
  // comprise. Un onglet passé en arrière-plan n'en est pas une.
  function tentatives(precedent, resultat) {
    const meme = !!precedent && precedent.revision === REVISION && precedent.empreinte === resultat.empreinte;
    return (meme ? precedent.tentatives | 0 : 0) + (resultat.motif === 'onglet_masque' ? 0 : 1);
  }
  // D : valeurs posées par la dernière détection, référence des choix du joueur. Une détection de la révision 2
  // appliquait ses six réglages (cache.reglages) ; la révision 3 les note dans cache.appliques.
  const sixValeurs = o => !!o && typeof o === 'object' && CLES.every(k => typeof o[k] === 'string');
  function reference(cache) {
    if (!cache) return null;
    if (sixValeurs(cache.appliques)) return Object.fromEntries(CLES.map(k => [k, cache.appliques[k]]));
    if (cache.statut === 'ok' && sixValeurs(cache.reglages)) return Object.fromEntries(CLES.map(k => [k, cache.reglages[k]]));
    return null;
  }
  // D, trace perdue (illisible ou effacée alors que les réglages du joueur restent) : la référence est, parmi les
  // valeurs d'usine et les réglages des quatre paliers, celle qui ressemble le plus aux six valeurs actuelles (le plus
  // d'options égales ; à égalité, la première, les valeurs d'usine en tête). Une détection appliquée puis retouchée
  // est ainsi reconnue : seules les options retouchées passent pour des choix du joueur, et non toutes celles que la
  // détection avait posées.
  function referenceProbable(actuels, usine) {
    let meilleure = null, score = -1;
    for (const c of [usine, ...Object.keys(profils).map(reglages)]) {
      if (!sixValeurs(c)) continue;
      const s = CLES.reduce((n, k) => n + (!!actuels && actuels[k] === c[k] ? 1 : 0), 0);
      if (s > score) { score = s; meilleure = c; }
    }
    return meilleure && Object.fromEntries(CLES.map(k => [k, meilleure[k]]));
  }
  // D : une détection automatique ne change que les options que le joueur n'a pas modifiées depuis la détection
  // précédente (reference : ce qu'elle avait posé ; sans détection précédente, les valeurs d'usine). Les autres gardent
  // le choix du joueur, et la référence garde, pour elles, ce que la détection avait posé : la version suivante les
  // respecte encore. toutAppliquer (détection lancée à la main) : tout est remplacé.
  function fusionner(actuels, ref, recommandes, toutAppliquer) {
    const valeurs = {}, gardes = [], nouvelle = {};
    for (const k of CLES) {
      const touche = !toutAppliquer && !!ref && actuels[k] !== ref[k];
      valeurs[k] = touche ? actuels[k] : recommandes[k];
      nouvelle[k] = touche ? ref[k] : recommandes[k];
      if (touche && actuels[k] !== recommandes[k]) gardes.push(k);
    }
    return { valeurs, gardes, reference: nouvelle };
  }
  // C : trace d'une détection automatique qui n'a rien appliqué (passée par le joueur ou interrompue). Elle garde la
  // référence des choix du joueur et compte les tentatives de la même version.
  function marquer(precedent, resultat) {
    const r = { revision: REVISION, statut: 'interrompu', motif: resultat.motif || 'erreur', empreinte: resultat.empreinte,
      tentatives: tentatives(precedent, resultat), date: Date.now(), methode: METHODE };
    const ref = reference(precedent);
    if (ref) r.appliques = ref;
    return r;
  }
  // Rafales d'un palier : coût (ms par image) de chaque point de vue au 50e centile, le plus cher juge ; de même, le
  // point de vue au fil principal le plus chargé juge l'estimation de la course (processeur). Chaque point de vue doit
  // avoir au moins deux rafales.
  function bilanRafales(id, rafales, limite = LIMITE) {
    const parVue = [0, 1, 2].map(v => {
      const l = rafales.filter(r => r.vue === v);
      return { vue: v, rafales: l.length, cout: arrondir(q(l.map(r => r.cout), .5)), cpu: arrondir(q(l.map(r => r.cpu), .5)) };
    });
    const vues = parVue.filter(p => p.rafales > 0), complet = parVue.every(p => p.rafales >= 2);
    const cout = vues.length ? Math.max(...vues.map(p => p.cout)) : null;
    const cpus = vues.map(p => p.cpu).filter(Number.isFinite);
    const processeur = cpus.length ? Math.max(...cpus) * COURSE_PROCESSEUR : null;
    return { profil: id, methode: METHODE, rafales: rafales.length, images: rafales.reduce((s, r) => s + r.n, 0),
      cout: arrondir(cout), cout90: arrondir(q(rafales.map(r => r.cout), .9)), cpu: arrondir(q(rafales.map(r => r.cpu), .5)),
      processeur: arrondir(processeur), parVue, budget: arrondir(BUDGET), limite: arrondir(limite), limiteProcesseur: arrondir(LIMITE_PROCESSEUR),
      acceptable: complet && cout !== null && cout <= limite && processeur !== null && processeur <= LIMITE_PROCESSEUR };
  }
  function choisir(mesures) {
    for (const id of ['extreme', 'high', 'medium']) if (mesures.some(m => m.profil === id && m.acceptable)) return id;
    return 'low';
  }
  function peutEssayerExtreme(m) {
    return !!m && m.profil === 'high' && m.acceptable && Number.isFinite(m.cout) && m.cout <= m.limite * EXTREME;
  }

  // io : empreinte, image (promesse de l'horodatage du prochain rappel d'image), preparer, dessiner, terminer,
  // sonder, simuler et activerGlaces (facultatifs), annule, masque, perdu, progression, maintenant.
  async function executer(io) {
    const maintenant = io.maintenant || (() => performance.now()), debut = maintenant();
    const cle = io.empreinte(), mesures = [], cadence = [];
    if (typeof io.terminer !== 'function') return { revision: REVISION, statut: 'interrompu', motif: 'mesure_impossible', empreinte: cle, mesures, methode: METHODE };
    const verifier = () => {
      if (io.annule && io.annule()) throw { motif: 'annule' };
      if (io.masque && io.masque()) throw { motif: 'onglet_masque' };
      if (io.perdu && io.perdu()) throw { motif: 'contexte_perdu' };
      if (maintenant() - debut > DELAI) throw { motif: 'delai' };
    };
    const trame = async () => { verifier(); const t = await io.image(); verifier(); if (!Number.isFinite(t)) throw { motif: 'cadence_indisponible' }; return t; };
    const progression = (texte, fraction) => { if (io.progression) io.progression(texte, fraction); };
    let periode = null, sonde = null, simulation = null;
    const conclure = partiel => {
      const selection = choisir(mesures);
      progression('Réglages adaptés', 1);
      // periode : période de l'écran relevée sur des images à vide, pour mémoire ; cadenceBridee : 30 Hz ou moins
      // (économie d'énergie, onglet ralenti). Le bridage ne change pas le coût mesuré, mais rend le verdict
      // provisoire (cacheValide).
      return { revision: REVISION, statut: 'ok', empreinte: cle, selection, reglages: reglages(selection), mesures, sonde, simulation,
        methode: METHODE, budget: arrondir(BUDGET), fraction: FRACTION, limite: arrondir(LIMITE), limiteProcesseur: arrondir(LIMITE_PROCESSEUR),
        cadence: arrondir(periode), cadenceIntervalles: cadence.length, cadenceEcart: arrondir(q(cadence, .9) - q(cadence, .1)),
        cadenceBridee: Number.isFinite(periode) && periode > 25, duree: arrondir((maintenant() - debut) / 1000), date: Date.now(), partiel: !!partiel };
    };
    try {
      progression('Mesure de la cadence de l’écran…', .02);
      let prec = await trame();
      // Neuf images à vide (rien n'est dessiné) : la période reste celle de l'écran. La simulation du parcours y chauffe
      // (une seconde de course en tout), pour que la mesure ne paie pas la compilation de ses chemins ; ses quatre
      // derniers appels (chemins compilés) donnent le temps d'un pas, au second rang des quatre.
      const pas = [];
      while (cadence.length < 9) {
        const t = await trame(); cadence.push(t - prec); prec = t;
        if (io.simuler && cadence.length <= 8) { const a = maintenant(); io.simuler(15); pas.push((maintenant() - a) / 15); }
      }
      periode = q(cadence, .5);
      // Moyenne sans espoir avant tout décor : Légère conclue tout de suite (voir SONDE_MS et COURSE_SIMULATION).
      const sansEspoirAvant = motif => {
        mesures.push({ profil: 'medium', methode: METHODE, rafales: 0, images: 0, cout: null, chauffe: [], sansEspoir: true, motif, sonde, simulation,
          budget: arrondir(BUDGET), limite: arrondir(LIMITE), acceptable: false, glaces: null, toile: null, preparation: 0, duree: 0 });
        return conclure(false);
      };
      const pasMs = pas.length >= 4 ? q(pas.slice(-4), .5) : null;
      let lente = false;
      if (Number.isFinite(pasMs)) {
        const boucle = pasMs * 2 * COURSE_SIMULATION;
        simulation = { pasMs: arrondir(pasMs), processeur: arrondir(boucle), pas: pas.map(arrondir) };
        lente = boucle > BUDGET;
      }
      if (io.sonder) {
        await trame();
        let s = null;
        try { s = io.sonder(); } catch (e) { s = null; }
        verifier();
        const passe = s && Array.isArray(s.passes) ? q(s.passes, .5) : null;
        if (s && s.logiciel === true) sonde = { logiciel: true, passe: null, passes: [], premiere: null, taille: s.taille || null };
        else if (Number.isFinite(passe)) sonde = { logiciel: false, passe: arrondir(passe), passes: s.passes.map(arrondir), premiere: arrondir(s.premiere), taille: s.taille || null };
        if (sonde && sonde.logiciel) return sansEspoirAvant('logiciel');
        if (sonde && sonde.passe > SONDE_MS) return sansEspoirAvant('sonde');
      }
      // Simulation lente aux images à vide : confirmée sur quatre images de plus, après la sonde, avant de conclure.
      if (lente) {
        const encore = [];
        for (let i = 0; i < 4; i++) { await trame(); const a = maintenant(); io.simuler(15); encore.push((maintenant() - a) / 15); }
        const confirme = q(encore, .5);
        Object.assign(simulation, { confirmation: arrondir(confirme), pasConfirmation: encore.map(arrondir) });
        if (confirme * 2 * COURSE_SIMULATION > BUDGET) return sansEspoirAvant('processeur');
      }
      const essayer = async (id, rang) => {
        const nom = profils[id].nom;
        progression('Préparation · ' + nom, .08 + rang * .3);
        await trame();
        // Glaces différées : le moteur des glaces n'est créé et chargé qu'après la chauffe, si le palier a un espoir.
        const t0 = maintenant();
        let info = io.preparer(id, profils[id], { chronoGPU: false, glaces: io.activerGlaces ? 'differees' : undefined }) || {};
        const preparation = arrondir(maintenant() - t0);
        verifier();
        if (preparation > PREPARATION_MAX) {
          const r = { profil: id, methode: METHODE, rafales: 0, images: 0, cout: null, chauffe: [], sansEspoir: true, motif: 'preparation',
            budget: arrondir(BUDGET), limite: arrondir(limiteProfil(info)), acceptable: false, glaces: info.glaces || null, toile: info.toile || null,
            preparation, duree: preparation };
          mesures.push(r); return r;
        }
        progression('Mesure · ' + nom, .14 + rang * .3);
        const chauffe = [];
        let sansEspoir = false, serie = 0;
        for (let i = 0; i < 6; i++) {
          const t = await trame(), a = maintenant();
          io.dessiner(t / 1000, i % 3); io.terminer();
          const ms = maintenant() - a; chauffe.push(arrondir(ms));
          if (i >= 3) serie = Math.max(serie, ms);
          // deux images de suite (la première, qui compile, n'en est pas)
          const paire = i >= 2 ? Math.min(ms, chauffe[i - 1]) : 0;
          if ((i >= 2 && paire > ESPOIR_VITE * BUDGET) || (i >= 4 && paire > ESPOIR * BUDGET)) { sansEspoir = true; break; }
        }
        if (sansEspoir) {
          const r = { profil: id, methode: METHODE, rafales: 0, images: chauffe.length, cout: null, chauffe, sansEspoir: true,
            budget: arrondir(BUDGET), limite: arrondir(limiteProfil(info)), acceptable: false, glaces: info.glaces || null, toile: info.toile || null,
            preparation, duree: arrondir(maintenant() - t0) };
          mesures.push(r); return r;
        }
        let glacesMs = null;
        if (io.activerGlaces) {
          const tg = maintenant();
          info = Object.assign({}, info, io.activerGlaces() || {});
          glacesMs = arrondir(maintenant() - tg);
          // premières images des glaces : leurs programmes se compilent hors de la mesure
          if (info.glaces === 'dessinees') for (let i = 0; i < 2; i++) { const t = await trame(); io.dessiner(t / 1000, 0); io.terminer(); }
        }
        const limite = limiteProfil(info), R = Math.max(R_MIN, Math.min(R_MAX, Math.floor(RAFALE_MS / Math.max(1, serie))));
        const rafales = [], depart = maintenant();
        for (let k = 0; ; k++) {
          const vue = k % 3, t = await trame(), a = maintenant();
          for (let j = 0; j < R; j++) io.dessiner(t / 1000 + j / 60, vue);
          const b = maintenant();
          io.terminer();
          const w = maintenant() - a;
          rafales.push({ vue, n: R, cout: w / R, cpu: (b - a) / R });
          const tours = Math.floor(rafales.length / 3);
          if (tours >= RAFALES_PAR_VUE && rafales.length % 3 === 0) break;
          if (tours >= 2 && rafales.length % 3 === 0) {
            const b2 = bilanRafales(id, rafales, limite);
            // sans espoir ou hors du temps alloué : deux rafales par point de vue suffisent
            if (b2.cout > limite * 1.6 || maintenant() - depart > MESURE_MS) break;
          }
        }
        const resultat = bilanRafales(id, rafales, limite);
        // preparation, glacesMs, duree : millisecondes du décor du palier, du chargement des glaces, et du palier en tout
        Object.assign(resultat, { R, chauffe, glaces: info.glaces || null, glacesParImage: info.glacesParImage ?? null, toile: info.toile || null,
          preparation, glacesMs, duree: arrondir(maintenant() - t0), detail: rafales.map(r => [r.vue, arrondir(r.cout), arrondir(r.cpu)]) });
        mesures.push(resultat); return resultat;
      };
      const tient = m => maintenant() - debut + (Number.isFinite(m.duree) ? m.duree : 0) <= DUREE_MAX;
      const moyen = await essayer('medium', 0);
      if (moyen.acceptable && tient(moyen)) {
        const fin = await essayer('high', 1);
        if (peutEssayerExtreme(fin) && tient(fin)) await essayer('extreme', 2);
      }
      verifier();
      return conclure(false);
    } catch (e) {
      // délai après au moins un palier mesuré jusqu'au bout : le verdict tient (Légère si Moyenne a été refusée)
      if (e && e.motif === 'delai' && mesures.length) return conclure(true);
      return { revision: REVISION, statut: 'interrompu', motif: e && e.motif || 'erreur', empreinte: cle, mesures, methode: METHODE };
    }
  }
  B.autoconfig = { REVISION, CLE, CLES, NOMS, METHODE, BUDGET, FRACTION, LIMITE, COURSE_PROCESSEUR, PART_PROCESSEUR, LIMITE_PROCESSEUR,
    PART_GLACES, EXTREME, ESPOIR, ESPOIR_VITE, SONDE_MS, COURSE_SIMULATION, TENTATIVES, DUREE_MAX, DELAI, PREPARATION_MAX, profils,
    empreinte, reglages, cacheValide, tentatives, reference, referenceProbable, fusionner, marquer, bilanRafales, limiteProfil, choisir,
    peutEssayerExtreme, executer };
})(globalThis.BITUME = globalThis.BITUME || {});
