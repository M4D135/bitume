(function (B) {
  'use strict';
  // Instrumentation de la boucle : FPS, intervalle d'image, temps CPU par section, temps GPU réellement mesuré,
  // draw calls, triangles et voitures actives.
  //
  // Le temps GPU vient uniquement des requêtes asynchrones du moteur (EXT_disjoint_timer_query_webgl2,
  // src/ferro/gpu-profile.js, exposé par rendu.profile()). Une durée JavaScript autour de draw n'est PAS un temps
  // GPU : sans extension, sans requête terminée ou avec une mesure disjointe, la ligne reste « N/D ». Aucune attente
  // bloquante n'est faite : le moteur récupère les requêtes deux images plus tard, le volet ne lit que ce qui est
  // déjà prêt.
  // Ce chronomètre se coupe (afficher({ gpu: false }) ou chrono(false, rendu)) : ses requêtes coupent les passes des
  // processeurs graphiques à tuiles, y comptent le travail d'un autre contexte et coûtent elles-mêmes. Mesurer ne
  // ralentit alors plus le jeu ; les temps GPU s'affichent N/D.
  //
  // Les compteurs du moteur (rendu.stats) sont remis à zéro à chaque draw : chaque vue est donc relevée juste après
  // son draw, ce qui sépare le coût de la vue principale, de l'écran partagé et des rétroviseurs.
  //
  // La séance (depuis l'ouverture du volet ou reinitialiser()) garde ce que la fenêtre de 240 images oublie : images,
  // images longues, pire image et son instant, 95e et 99e centiles, tenus par un histogramme au dixième de
  // milliseconde (aucun tri). Une image est longue au-delà de (diviseur + 0,5) périodes : une période et demie à
  // pleine cadence. La période est celle que la boucle du jeu déclare (cadence(etat)) ; à défaut, une référence
  // estimée : le 10e centile des intervalles récents, car une image ratée allonge un intervalle et ne le raccourcit
  // jamais. Cette référence vaut la période de l'écran à pleine cadence, mais l'intervalle visé si le jeu tient un
  // diviseur sans le déclarer : le volet la nomme donc « référence estimée », pas « période de l'écran ».
  // Le nombre de ramassages de mémoire ne se mesure pas depuis la page : le volet ne l'affiche pas.

  const SECTIONS = ['intervalle', 'boucle', 'simulation', 'rendu', 'effets', 'hud', 'son'];
  const VUES = ['principale', 'joueur2', 'retro'];
  const FENETRE = 240;        // ~4 s à 60 i/s
  const PAS_AFFICHAGE = 0.2;  // le volet se rafraîchit à 5 Hz, jamais à chaque image
  const PAS_HISTO = .1, CASES = 2000; // intervalles de la séance, de 0 à 200 ms au dixième de milliseconde
  const MIN_ESTIMATION = 30;  // intervalles récents nécessaires pour estimer la période sans le jeu

  const cercles = {};
  for (const n of SECTIONS) cercles[n] = new Float64Array(FENETRE).fill(NaN);
  const cerclesVues = {};
  for (const v of VUES) cerclesVues[v] = { appels: new Float64Array(FENETRE), draw: new Float64Array(FENETRE), triangles: new Float64Array(FENETRE) };
  let tete = 0, remplies = 0;
  // Les centiles de la fenêtre se lisent dans ce tampon trié sur place (une copie et un tri par section) : le volet
  // ne crée plus de tableaux temporaires dans l'image même qu'il mesure.
  const tri = new Float64Array(FENETRE);
  const histo = new Uint32Array(CASES);
  const seance = { images: 0, debordement: 0, pire: null, instantPire: null, duree: 0 };
  // Créations tardives par moteur (principal, rétroviseurs) : relevé au début de la séance, puis dernier relevé.
  const moteurs = [];
  let gpuVoulu = true;

  const etat = {
    actif: false, gpu: false, gpuValide: false, gpuMs: null, gpuPasses: null,
    voitures: 0, voituresTotal: 0, lampes: 0, ombres: false, palier: 0, qualite: '', profil: '',
    pieces: 0, piecesTotal: 0, physx: null,
    audio: { actif: false, voix: 0, joueurs: 0, rivaux: 0, fondus: 0, budget: null, musique: false },
    images: 0, descartees: 0, enAttente: 0,
    // déclarés par la boucle du jeu (cadence) : ils survivent aux remises à zéro du volet
    periode: null, diviseur: null, verrou: null
  };
  const cumulVues = {};
  for (const v of VUES) cumulVues[v] = { drawCalls: 0, triangles: 0, images: 0 };

  // Une image remplit une ligne de tous les cercles ; la ligne suivante n'est ouverte qu'à la fin de l'image.
  function imageDebut() {
    if (etat.actif) {
      // La case appartient à la nouvelle image : une section absente ne doit pas hériter de l'image vieille de
      // quatre secondes. NaN signifie « non relevé » ; un vrai coût nul reste un échantillon valable.
      for (const n of SECTIONS) cercles[n][tete] = NaN;
      for (const v of VUES) { const c = cerclesVues[v]; c.appels[tete] = c.draw[tete] = c.triangles[tete] = 0; }
    }
    return performance.now();
  }
  function imageFin(t0, dtReel) {
    if (!etat.actif) return;
    const ms = Number.isFinite(dtReel) && dtReel > 0 ? dtReel * 1000 : NaN;
    cercles.intervalle[tete] = ms;
    // performance.now() est déjà en millisecondes, contrairement à dtReel (secondes).
    cercles.boucle[tete] = Math.max(0, performance.now() - t0);
    if (ms === ms) compterSeance(ms);
    etat.images++;
    tete = (tete + 1) % FENETRE;
    if (remplies < FENETRE) remplies++;
  }
  function compterSeance(ms) {
    const i = Math.floor(ms / PAS_HISTO);
    if (i < CASES) histo[i]++; else seance.debordement++;
    // instant : début de l'intervalle, en secondes depuis le début de la séance (somme des intervalles précédents)
    if (seance.pire === null || ms > seance.pire) { seance.pire = ms; seance.instantPire = seance.duree; }
    seance.duree += ms / 1000; seance.images++;
  }
  // section : coût JavaScript d'une partie de l'image, en millisecondes. Ce n'est pas un temps GPU.
  function section(nom, ms) {
    // Une section peut être appelée plusieurs fois dans une image (J1 + J2) : conserver leur coût total.
    if (etat.actif && cercles[nom] && Number.isFinite(ms) && ms >= 0)
      cercles[nom][tete] = (Number.isFinite(cercles[nom][tete]) ? cercles[nom][tete] : 0) + ms;
  }

  // relevé juste après un draw : le moteur vient de compter cette vue
  function vue(nom, rendu, info) {
    if (!etat.actif || !rendu || !rendu.stats || !cumulVues[nom]) return;
    const s = rendu.stats, c = cumulVues[nom], cv = cerclesVues[nom];
    c.drawCalls += s.drawCalls || 0; c.triangles += s.triangles || 0; c.images++;
    cv.appels[tete]++;
    cv.draw[tete] = (cv.draw[tete] || 0) + (s.drawCalls || 0);
    cv.triangles[tete] = (cv.triangles[tete] || 0) + (s.triangles || 0);
    if (info) {
      if (info.lampes !== undefined) etat.lampes = info.lampes;
      if (info.ombres !== undefined) etat.ombres = !!info.ombres;
    }
    suivreCreations(rendu);
  }
  function voitures(actives, total) { etat.voitures = actives; etat.voituresTotal = total; }
  function pieces(n, total, etatPhysX) { etat.pieces = n | 0; etat.piecesTotal = total | 0; etat.physx = etatPhysX || null; }
  // Une fabrique Web Audio préparée ne signifie pas que le geste utilisateur a démarré le son.
  // Le budget est une capacité, les voix sont les moteurs actifs ou encore en fondu (hors thème et effets).
  function audio(stats) {
    const a = etat.audio;
    a.actif = !!(stats && stats.actif);
    a.budget = stats && Number.isFinite(stats.budget) && stats.budget >= 0 ? Math.floor(stats.budget) : null;
    for (const k of ['voix', 'joueurs', 'rivaux', 'fondus'])
      a[k] = a.actif && Number.isFinite(stats[k]) && stats[k] >= 0 ? Math.floor(stats[k]) : 0;
    a.musique = a.actif && !!stats.musique;
  }
  function reglages(v) { if (v) { etat.palier = v.palier === null ? null : (v.palier || 0); etat.qualite = v.qualite || ''; etat.profil = v.profil || ''; } }
  // Période de l'écran (ms), diviseur de cadence et verrou, quand la boucle du jeu les connaît. Accepte aussi l'image
  // de FLoop (period, locked). Appel sans état : retour à l'estimation par les intervalles.
  function cadence(e) {
    const p = e ? (Number.isFinite(e.periode) ? e.periode : e.period) : null;
    etat.periode = Number.isFinite(p) && p >= 1 && p <= 1000 ? p : null;
    const k = e ? e.diviseur : null;
    etat.diviseur = Number.isInteger(k) && k >= 1 && k <= 16 ? k : null;
    const v = e ? (typeof e.verrouille === 'boolean' ? e.verrouille : e.locked) : null;
    etat.verrou = typeof v === 'boolean' ? v : null;
  }

  // stats.creations du moteur : un nombre, ou un objet (total, ou somme de ses compteurs). Absent : null.
  function totalCreations(c) {
    if (typeof c === 'number') return Number.isFinite(c) && c >= 0 ? c : null;
    if (!c || typeof c !== 'object') return null;
    if (typeof c.total === 'number') return Number.isFinite(c.total) && c.total >= 0 ? c.total : null;
    // relevé après chaque draw : parcours sans tableau de clés
    let s = 0, k = 0;
    for (const n in c) { const v = c[n]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0) { s += v; k++; } }
    return k ? s : null;
  }
  function suivreCreations(rendu) {
    const n = rendu && rendu.stats ? totalCreations(rendu.stats.creations) : null;
    if (n === null) return;
    let m = null;
    for (let i = 0; i < moteurs.length; i++) if (moteurs[i].rendu === rendu) { m = moteurs[i]; break; }
    if (!m) { if (moteurs.length >= 4) return; m = { rendu, debut: n, dernier: n, avant: 0 }; moteurs.push(m); }
    // compteur reparti de zéro (contexte restauré) : garder ce que la séance avait déjà compté
    if (n < m.dernier) { m.avant += m.dernier - m.debut; m.debut = 0; }
    m.dernier = n;
  }

  // Copie les valeurs finies du cercle en tête du tampon, complète par +∞ et trie le tout sur place : les n premières
  // cases sont alors les valeurs triées, sans vue ni tableau créés. Rend n.
  function trier(cercle) {
    let n = 0;
    for (let i = 0; i < remplies; i++) { const x = cercle[i]; if (x - x === 0) tri[n++] = x; }
    if (n > 1) { tri.fill(Infinity, n); tri.sort(); }
    return n;
  }
  const rang = (n, p) => n ? tri[Math.min(n - 1, Math.floor(p * (n - 1)))] : null;
  function moyenne(cercle) {
    if (!remplies) return null;
    let s = 0, k = 0;
    for (let i = 0; i < remplies; i++) if (Number.isFinite(cercle[i])) { s += cercle[i]; k++; }
    return k ? s / k : null;
  }
  function centileSeance(p) {
    if (!seance.images) return null;
    const r = Math.min(seance.images - 1, Math.floor(p * (seance.images - 1)));
    for (let i = 0, cumul = 0; i < CASES; i++) { cumul += histo[i]; if (cumul > r) return Math.min(seance.pire, (i + .5) * PAS_HISTO); }
    return seance.pire;
  }
  function longuesAu(seuil) {
    let n = seance.debordement;
    for (let i = Math.max(0, Math.floor(seuil / PAS_HISTO) + 1); i < CASES; i++) n += histo[i];
    return n;
  }
  function resumeSeance(estimee) {
    const periode = etat.periode || estimee, seuil = periode ? ((etat.diviseur || 1) + .5) * periode : null;
    return { images: seance.images, longues: seuil === null ? null : longuesAu(seuil), seuil,
      reference: etat.periode ? 'jeu' : (estimee ? 'estimee' : null),
      pire: seance.pire, instantPire: seance.instantPire, p95: centileSeance(.95), p99: centileSeance(.99), duree: seance.duree };
  }

  // Le chronomètre GPU du moteur : une ligne par draw, retenue seulement si toutes ses requêtes sont revenues.
  function lireGpu(rendu) {
    if (!gpuVoulu || !rendu || typeof rendu.profile !== 'function') return arretGpu();
    const st = rendu.profile();
    if (!st || !st.gpu) return arretGpu();
    etat.gpu = true;
    etat.descartees = st.discarded || 0; etat.enAttente = st.pending || 0;
    const h = st.history || [];
    let total = 0, lignes = 0, passes = null;
    for (let i = h.length - 1; i >= 0 && lignes < 3; i--) {
      const r = h[i];
      if (!r || !r.valid || !r.queries || r.completed !== r.queries || !r.gpu) continue;
      const noms = Object.keys(r.gpu);
      if (!noms.length || noms.some(k => !Number.isFinite(r.gpu[k]) || r.gpu[k] < 0)) continue;
      if (!passes) passes = {};
      for (const k of noms) { total += r.gpu[k]; passes[k] = (passes[k] || 0) + r.gpu[k]; }
      lignes++;
    }
    etat.gpuValide = lignes > 0;
    etat.gpuMs = lignes ? total / lignes : null;
    if (passes) for (const k of Object.keys(passes)) passes[k] /= lignes;
    etat.gpuPasses = passes;
  }
  function arretGpu() {
    etat.gpu = false; etat.gpuValide = false; etat.gpuMs = null; etat.gpuPasses = null;
    etat.descartees = etat.enAttente = 0;
  }

  function lire(rendu) {
    if (etat.actif) { lireGpu(rendu); suivreCreations(rendu); }
    const ni = trier(cercles.intervalle);
    const p50 = rang(ni, .5), estimee = ni >= MIN_ESTIMATION ? rang(ni, .1) : null;
    const v = {
      actif: etat.actif,
      fps: p50 ? 1000 / p50 : null, imageP50: p50,
      imageP95: rang(ni, .95), imagePire: rang(ni, 1),
      cpu: {}, cpuP50: {}, cpuP95: {}, vues: {},
      gpu: etat.gpu, gpuValide: etat.gpuValide, gpuMs: etat.gpuMs, gpuPasses: etat.gpuPasses,
      gpuPortee: 'Moyenne des trois derniers rendus complets du moteur principal ; pas le total de l’image avec les rétroviseurs.',
      gpuDescartes: etat.descartees, gpuEnAttente: etat.enAttente, gpuChrono: gpuVoulu,
      voitures: etat.voitures, voituresTotal: etat.voituresTotal,
      lampes: etat.lampes, ombres: etat.ombres, palier: etat.palier, qualite: etat.qualite, profil: etat.profil, images: etat.images,
      pieces: etat.pieces, piecesTotal: etat.piecesTotal, physx: etat.physx, audio: Object.assign({}, etat.audio),
      periode: etat.periode, diviseur: etat.diviseur, verrou: etat.verrou, periodeEstimee: estimee,
      seance: resumeSeance(estimee), creations: null, creationsSeance: null
    };
    for (const n of SECTIONS) if (n !== 'intervalle') {
      const k = trier(cercles[n]);
      v.cpu[n] = moyenne(cercles[n]); v.cpuP50[n] = rang(k, .5); v.cpuP95[n] = rang(k, .95);
    }
    for (const k of VUES) {
      const c = cumulVues[k];
      const cv = cerclesVues[k];
      v.vues[k] = { images: c.images, drawCalls: c.images ? c.drawCalls / c.images : 0, triangles: c.images ? c.triangles / c.images : 0,
        rendusParImage: moyenne(cv.appels), drawCallsParImage: moyenne(cv.draw), trianglesParImage: moyenne(cv.triangles) };
    }
    for (const m of moteurs) { v.creations = (v.creations || 0) + m.dernier; v.creationsSeance = (v.creationsSeance || 0) + m.avant + m.dernier - m.debut; }
    return v;
  }

  function reinitialiser() {
    for (const n of SECTIONS) cercles[n].fill(NaN);
    for (const k of VUES) {
      const c = cumulVues[k]; c.drawCalls = c.triangles = c.images = 0;
      const cv = cerclesVues[k]; cv.appels.fill(0); cv.draw.fill(0); cv.triangles.fill(0);
    }
    tete = 0; remplies = 0; etat.images = 0; dernier = -1;
    histo.fill(0); seance.images = seance.debordement = seance.duree = 0; seance.pire = seance.instantPire = null;
    moteurs.length = 0;
    arretGpu(); audio(null);
  }

  // ---------------------------------------------------------------- volet
  let el = null, dernier = -1;
  const f = v => v === null || v === undefined ? 'N/D' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
  const e = v => v === null || v === undefined ? 'N/D' : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function element() {
    if (el || typeof document === 'undefined') return el;
    el = document.createElement('div');
    el.id = 'mesures'; el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  }
  function texte(v) {
    if (!el) return;
    const s = v.seance;
    el.textContent = [
      'FPS ' + f(v.fps) + ' · image ' + f(v.imageP50) + ' ms · p95 ' + f(v.imageP95) + ' · pire ' + f(v.imagePire),
      'séance ' + e(s.images) + ' images · ' + e(s.longues) + ' au-delà de ' + f((v.diviseur || 1) + .5) + ' période' +
        (s.longues !== null && s.images ? ' (' + f(100 * s.longues / s.images) + ' %)' : '') +
        ' · pire ' + f(s.pire) + ' ms' + (s.instantPire !== null ? ' à ' + f(s.instantPire) + ' s' : '') + ' · p99 ' + f(s.p99),
      'écran période ' + (v.periode !== null ? f(v.periode) + ' ms' : 'N/D') + ' · diviseur ' + (v.diviseur !== null ? v.diviseur : 'N/D') +
        (v.periode === null && v.periodeEstimee !== null ? ' · référence estimée ' + f(v.periodeEstimee) + ' ms' : '') + ' · créations tardives ' +
        (v.creationsSeance !== null ? e(v.creationsSeance) + ' (moteur ' + e(v.creations) + ')' : 'N/D'),
      'CPU (ms, p50/p95)  ' + SECTIONS.filter(n => n !== 'intervalle').map(n => n + ' ' + f(v.cpuP50[n]) + '/' + f(v.cpuP95[n])).join(' · '),
      'GPU / rendu principal  ' + (v.gpuValide ? f(v.gpuMs) + ' ms' : 'N/D') + (!v.gpuChrono ? ' (chronomètre coupé)' : v.gpu ? '' : ' (extension absente)') +
        (v.gpuPasses ? '  ' + Object.keys(v.gpuPasses).map(k => k + ' ' + f(v.gpuPasses[k])).join(' · ') : '') +
        (v.gpuDescartes ? '  · ' + v.gpuDescartes + ' mesure(s) disjointe(s) écartée(s)' : ''),
      'draw calls / image  ' + VUES.map(k => k + ' ' + e(v.vues[k].drawCallsParImage)).join(' · '),
      'triangles / image  ' + VUES.map(k => k + ' ' + e(v.vues[k].trianglesParImage)).join(' · '),
      'son ' + (v.audio.actif ? 'démarré' : 'non démarré') + ' · voix moteur ' + v.audio.voix + '/' + e(v.audio.budget) +
        ' · joueurs ' + v.audio.joueurs + ' · rivaux ' + v.audio.rivaux + ' · fondus ' + v.audio.fondus +
        ' · musique ' + (v.audio.musique ? 'oui' : 'non'),
      'voitures ' + v.voitures + '/' + v.voituresTotal + ' · lampes ' + v.lampes + ' · ombres ' + (v.ombres ? 'oui' : 'non') +
      ' · pièces ' + v.pieces + '/' + v.piecesTotal + ' · PhysX ' + (v.physx && v.physx.ready ? v.physx.version : 'N/D') +
        ' · qualité ' + (v.qualite || 'N/D') + ' · palier ' + (v.palier === null ? 'N/D (hors Auto)' : v.palier)
    ].join('\n');
  }
  // oui : vrai ou faux, ou { gpu: false } pour ouvrir le volet sans le chronomètre GPU. Le choix du chronomètre est
  // retenu pour les ouvertures suivantes (F3 compris).
  function afficher(oui, rendu) {
    if (oui && typeof oui === 'object' && 'gpu' in oui) gpuVoulu = oui.gpu !== false;
    const v = !!oui;
    etat.actif = v;
    if (typeof document !== 'undefined') { const n = element(); if (n) n.hidden = !v; }
    if (rendu && typeof rendu.profile === 'function') rendu.profile(v && gpuVoulu ? {} : false);
    reinitialiser();
    dernier = -1;
    return lire(rendu);
  }
  // Coupe ou rouvre le chronomètre GPU ; volet ouvert, le moteur suit tout de suite si rendu est donné.
  function chrono(oui, rendu) {
    gpuVoulu = !!oui;
    if (etat.actif && rendu && typeof rendu.profile === 'function') rendu.profile(gpuVoulu ? {} : false);
    if (!gpuVoulu) arretGpu();
    return gpuVoulu;
  }
  function majAffichage(rendu, maintenant) {
    if (!etat.actif || !el) return;
    if (maintenant - dernier < PAS_AFFICHAGE) return;
    dernier = maintenant;
    texte(lire(rendu));
  }

  B.mesures = {
    SECTIONS, VUES, etat,
    imageDebut, imageFin, section, vue, voitures, pieces, audio, reglages, cadence,
    lire, reinitialiser, afficher, chrono, majAffichage,
    get actif() { return etat.actif; },
    get chronoGPU() { return gpuVoulu; }
  };
})(globalThis.BITUME = globalThis.BITUME || {});
