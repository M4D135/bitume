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
  //
  // Les compteurs du moteur (rendu.stats) sont remis à zéro à chaque draw : chaque vue est donc relevée juste après
  // son draw, ce qui sépare le coût de la vue principale, de l'écran partagé et des rétroviseurs.

  const SECTIONS = ['intervalle', 'boucle', 'simulation', 'rendu', 'effets', 'hud', 'son'];
  const VUES = ['principale', 'joueur2', 'retro'];
  const FENETRE = 240;        // ~4 s à 60 i/s
  const PAS_AFFICHAGE = 0.2;  // le volet se rafraîchit à 5 Hz, jamais à chaque image

  const cercles = {};
  for (const n of SECTIONS) cercles[n] = new Float64Array(FENETRE).fill(NaN);
  const cerclesVues = {};
  for (const v of VUES) cerclesVues[v] = { appels: new Float64Array(FENETRE), draw: new Float64Array(FENETRE), triangles: new Float64Array(FENETRE) };
  let tete = 0, remplies = 0;

  const etat = {
    actif: false, gpu: false, gpuValide: false, gpuMs: null, gpuPasses: null,
    voitures: 0, voituresTotal: 0, lampes: 0, ombres: false, palier: 0, qualite: '',
    pieces: 0, piecesTotal: 0, physx: null,
    audio: { actif: false, voix: 0, joueurs: 0, rivaux: 0, fondus: 0, budget: null, musique: false },
    images: 0, descartees: 0, enAttente: 0
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
    cercles.intervalle[tete] = Number.isFinite(dtReel) && dtReel > 0 ? dtReel * 1000 : NaN;
    // performance.now() est déjà en millisecondes, contrairement à dtReel (secondes).
    cercles.boucle[tete] = Math.max(0, performance.now() - t0);
    etat.images++;
    tete = (tete + 1) % FENETRE;
    if (remplies < FENETRE) remplies++;
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
  function reglages(v) { if (v) { etat.palier = v.palier === null ? null : (v.palier || 0); etat.qualite = v.qualite || ''; } }

  function percentile(cercle, p) {
    if (!remplies) return null;
    const t = Array.prototype.slice.call(cercle, 0, remplies).filter(Number.isFinite);
    if (!t.length) return null;
    t.sort((a, b) => a - b);
    return t[Math.min(t.length - 1, Math.floor(p * (t.length - 1)))];
  }
  function moyenne(cercle) {
    if (!remplies) return null;
    let s = 0, k = 0;
    for (let i = 0; i < remplies; i++) if (Number.isFinite(cercle[i])) { s += cercle[i]; k++; }
    return k ? s / k : null;
  }

  // Le chronomètre GPU du moteur : une ligne par draw, retenue seulement si toutes ses requêtes sont revenues.
  function lireGpu(rendu) {
    if (!rendu || typeof rendu.profile !== 'function') return arretGpu();
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
    if (etat.actif) lireGpu(rendu);
    const p50 = percentile(cercles.intervalle, .5);
    const v = {
      actif: etat.actif,
      fps: p50 ? 1000 / p50 : null, imageP50: p50,
      imageP95: percentile(cercles.intervalle, .95), imagePire: percentile(cercles.intervalle, 1),
      cpu: {}, cpuP50: {}, cpuP95: {}, vues: {},
      gpu: etat.gpu, gpuValide: etat.gpuValide, gpuMs: etat.gpuMs, gpuPasses: etat.gpuPasses,
      gpuPortee: 'Moyenne des trois derniers rendus complets du moteur principal ; pas le total de l’image avec les rétroviseurs.',
      gpuDescartes: etat.descartees, gpuEnAttente: etat.enAttente,
      voitures: etat.voitures, voituresTotal: etat.voituresTotal,
      lampes: etat.lampes, ombres: etat.ombres, palier: etat.palier, qualite: etat.qualite, images: etat.images,
      pieces: etat.pieces, piecesTotal: etat.piecesTotal, physx: etat.physx, audio: Object.assign({}, etat.audio)
    };
    for (const n of SECTIONS) if (n !== 'intervalle') { v.cpu[n] = moyenne(cercles[n]); v.cpuP50[n] = percentile(cercles[n], .5); v.cpuP95[n] = percentile(cercles[n], .95); }
    for (const k of VUES) {
      const c = cumulVues[k];
      const cv = cerclesVues[k];
      v.vues[k] = { images: c.images, drawCalls: c.images ? c.drawCalls / c.images : 0, triangles: c.images ? c.triangles / c.images : 0,
        rendusParImage: moyenne(cv.appels), drawCallsParImage: moyenne(cv.draw), trianglesParImage: moyenne(cv.triangles) };
    }
    return v;
  }

  function reinitialiser() {
    for (const n of SECTIONS) cercles[n].fill(NaN);
    for (const k of VUES) {
      const c = cumulVues[k]; c.drawCalls = c.triangles = c.images = 0;
      const cv = cerclesVues[k]; cv.appels.fill(0); cv.draw.fill(0); cv.triangles.fill(0);
    }
    tete = 0; remplies = 0; etat.images = 0; dernier = -1;
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
    el.textContent = [
      'FPS ' + f(v.fps) + ' · image ' + f(v.imageP50) + ' ms · p95 ' + f(v.imageP95) + ' · pire ' + f(v.imagePire),
      'CPU (ms, p50/p95)  ' + SECTIONS.filter(n => n !== 'intervalle').map(n => n + ' ' + f(v.cpuP50[n]) + '/' + f(v.cpuP95[n])).join(' · '),
      'GPU / rendu principal  ' + (v.gpuValide ? f(v.gpuMs) + ' ms' : 'N/D') + (v.gpu ? '' : ' (extension absente)') +
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
  function afficher(oui, rendu) {
    const v = !!oui;
    etat.actif = v;
    if (typeof document !== 'undefined') { const n = element(); if (n) n.hidden = !v; }
    if (rendu && typeof rendu.profile === 'function') rendu.profile(v ? {} : false);
    reinitialiser();
    dernier = -1;
    return lire(rendu);
  }
  function majAffichage(rendu, maintenant) {
    if (!etat.actif || !el) return;
    if (maintenant - dernier < PAS_AFFICHAGE) return;
    dernier = maintenant;
    texte(lire(rendu));
  }

  B.mesures = {
    SECTIONS, VUES, etat,
    imageDebut, imageFin, section, vue, voitures, pieces, audio, reglages,
    lire, reinitialiser, afficher, majAffichage,
    get actif() { return etat.actif; }
  };
})(globalThis.BITUME = globalThis.BITUME || {});
