/* BITUME — détection locale des réglages. Mesure le rendu, jamais le nom du GPU pour choisir un palier. */
(function (B) {
  'use strict';
  const REVISION = 1, CLE = 'bitume.detection.v1';
  const CLES = Object.freeze(['qualite', 'anticrenelage', 'ombres', 'vegetation', 'faune', 'retro']);
  const profils = {
    low: { nom: 'Légère', qualite: 'low', anticrenelage: 'off', ombres: 'off', vegetation: 'off', faune: 'off', retro: 'non' },
    medium: { nom: 'Moyenne', qualite: 'medium', anticrenelage: 'msaa4', ombres: 'medium', vegetation: 'medium', faune: 'medium', retro: 'auto' },
    high: { nom: 'Fine', qualite: 'high', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'high', faune: 'high', retro: 'auto' },
    extreme: { nom: 'Fine · végétation extrême', qualite: 'high', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra', faune: 'ultra', retro: 'auto' },
  };
  for (const p of Object.values(profils)) Object.freeze(p);
  Object.freeze(profils);
  const q = (liste, p) => {
    const a = liste.filter(x => Number.isFinite(x) && x >= 0).slice().sort((x, y) => x - y);
    return a.length ? a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))] : null;
  };
  const arrondir = v => Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
  function empreinte(materiel, largeur, hauteur, ratio) {
    // Empreinte locale seulement. Un changement de taille significatif relance la mesure au prochain démarrage.
    const pixels = Math.max(1, largeur * hauteur), tranche = Math.round(Math.log(pixels) / Math.log(1.3));
    const texte = [REVISION, materiel || 'webgl2', tranche, Math.round(Math.min(2, ratio || 1) * 4)].join('|');
    let h = 2166136261;
    for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }
  function reglages(id) {
    const p = profils[id];
    return p ? Object.fromEntries(CLES.map(k => [k, p[k]])) : null;
  }
  function cacheValide(cache, cle) {
    return !!cache && cache.revision === REVISION && cache.empreinte === cle && cache.statut === 'ok'
      && Object.prototype.hasOwnProperty.call(profils, cache.selection)
      && Array.isArray(cache.mesures) && cache.mesures.length > 0;
  }
  function gpuComplet(stats, premiereImage) {
    if (!stats || !stats.gpu || !Array.isArray(stats.history)) return [];
    return stats.history.filter(r => r.frame >= premiereImage && r.valid && r.queries > 0 && r.completed === r.queries)
      .map(r => Object.values(r.gpu).reduce((s, n) => s + n, 0)).filter(Number.isFinite);
  }
  function bilan(id, images, cpu, gpu, cadence) {
    const budget = Math.max(1000 / 60, Math.min(1000 / 30, cadence || 1000 / 60));
    const r = { profil: id, images: images.length, p50: arrondir(q(images, .5)), p95: arrondir(q(images, .95)),
      cpu95: arrondir(q(cpu, .95)), gpu95: gpu.length >= 8 ? arrondir(q(gpu, .95)) : null,
      imagesGPU: gpu.length, budget: arrondir(budget), acceptable: false };
    // Une marge reste disponible pour la simulation, les glaces et les passages plus chargés que le parcours.
    r.acceptable = images.length >= 24 && r.p50 <= budget * 1.07 && r.p95 <= budget * 1.23
      && r.cpu95 <= budget * .68 && (r.gpu95 === null || r.gpu95 <= budget * .76);
    if (id === 'extreme' && (gpu.length < 12 || r.gpu95 === null)) r.acceptable = false;
    return r;
  }
  function choisir(mesures) {
    for (const id of ['extreme', 'high', 'medium', 'low']) if (mesures.some(m => m.profil === id && m.acceptable)) return id;
    return 'low';
  }
  function peutEssayerExtreme(m) {
    // Le maximum ne se déduit pas d'un écran plafonné à 60 Hz. Il faut des requêtes GPU complètes et de la marge.
    return !!m && m.acceptable && m.imagesGPU >= 12 && m.gpu95 !== null
      && m.gpu95 < m.budget * .28 && m.cpu95 < m.budget * .34;
  }

  async function executer(io) {
    const maintenant = io.maintenant || (() => performance.now()), debut = maintenant();
    const cle = io.empreinte(), mesures = [], cadence = [];
    const verifier = () => {
      if (io.annule && io.annule()) throw { motif: 'annule' };
      if (io.masque && io.masque()) throw { motif: 'onglet_masque' };
      if (io.perdu && io.perdu()) throw { motif: 'contexte_perdu' };
      if (io.empreinte() !== cle) throw { motif: 'taille_modifiee' };
      if (maintenant() - debut > 14000) throw { motif: 'delai' };
    };
    const trame = async () => { verifier(); const t = await io.image(); verifier(); if (!Number.isFinite(t)) throw { motif: 'cadence_indisponible' }; return t; };
    const progression = (texte, fraction) => { if (io.progression) io.progression(texte, fraction); };
    const terminer = partiel => {
      const selection = choisir(mesures);
      progression('Réglages adaptés', 1);
      return { revision: REVISION, statut: 'ok', empreinte: cle, selection, reglages: reglages(selection), mesures,
        cadence: arrondir(q(cadence, .5)), duree: arrondir((maintenant() - debut) / 1000), date: Date.now(), partiel: !!partiel };
    };
    try {
      progression('Mesure de la cadence de l’écran…', .02);
      let prec = await trame();
      for (let i = 0; i < 9; i++) { const t = await trame(); cadence.push(t - prec); prec = t; }
      const periode = q(cadence, .5) || 1000 / 60;
      const essayer = async id => {
        const rang = mesures.length;
        progression('Préparation · ' + profils[id].nom, .1 + rang * .23);
        await trame();
        await io.preparer(id, profils[id]);
        verifier();
        // Trois points de vue parcourus pendant la chauffe et la mesure : aucune clairière isolée ne fait le test.
        const t0 = maintenant(); let n = 0;
        do { const t = await trame(); io.dessiner(t / 1000, n++ % 3); }
        while ((n < 12 || maintenant() - t0 < 180) && maintenant() - t0 < 450);
        const premiereImage = (io.profilGPU && io.profilGPU()?.frames || 0) + 1;
        progression('Mesure · ' + profils[id].nom, .16 + rang * .23);
        const temps = [], cpu = [], depart = maintenant(); prec = await trame();
        do {
          const t = await trame(), avant = maintenant();
          io.dessiner(t / 1000, Math.floor(n++ / 8) % 3);
          cpu.push(maintenant() - avant); temps.push(t - prec); prec = t;
          if (temps.length >= 8 && q(temps, .5) > Math.max(1000 / 60, periode) * 2.2) break;
        } while (((maintenant() - depart < 720 || temps.length < 24) && temps.length < 90) && maintenant() - depart < 1800);
        const resultat = bilan(id, temps, cpu, gpuComplet(io.profilGPU && io.profilGPU(), premiereImage), periode);
        mesures.push(resultat); return resultat;
      };
      const moyen = await essayer('medium');
      if (!moyen.acceptable) await essayer('low');
      else if (maintenant() - debut < 9000) {
        const fin = await essayer('high');
        if (peutEssayerExtreme(fin) && maintenant() - debut < 9000) await essayer('extreme');
      }
      verifier();
      return terminer(false);
    } catch (e) {
      if (e && e.motif === 'delai' && mesures.some(m => m.acceptable)) return terminer(true);
      return { revision: REVISION, statut: 'interrompu', motif: e && e.motif || 'erreur', empreinte: cle, mesures };
    }
  }
  B.autoconfig = { REVISION, CLE, CLES, profils, empreinte, reglages, cacheValide, bilan, choisir, peutEssayerExtreme, gpuComplet, executer };
})(globalThis.BITUME = globalThis.BITUME || {});
