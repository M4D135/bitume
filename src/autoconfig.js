/* BITUME — détection locale des réglages. Mesure le rendu, jamais le nom du GPU pour choisir un palier. */
(function (B) {
  'use strict';
  // REVISION entre dans l'empreinte et dans la validité du cache : la monter fait refaire une fois les détections
  // enregistrées. Celles de la révision 1 jugeaient au chronomètre GPU, sur un parcours qui allégeait les voitures dès
  // la septième.
  const REVISION = 2, CLE = 'bitume.detection.v1';
  const CLES = Object.freeze(['qualite', 'anticrenelage', 'ombres', 'vegetation', 'faune', 'retro']);
  const profils = {
    low: { nom: 'Légère', qualite: 'low', anticrenelage: 'off', ombres: 'off', vegetation: 'off', faune: 'off', retro: 'non' },
    medium: { nom: 'Moyenne', qualite: 'medium', anticrenelage: 'msaa4', ombres: 'medium', vegetation: 'medium', faune: 'medium', retro: 'auto' },
    high: { nom: 'Fine', qualite: 'high', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'high', faune: 'high', retro: 'auto' },
    extreme: { nom: 'Fine · végétation extrême', qualite: 'high', anticrenelage: 'msaa4', ombres: 'high', vegetation: 'ultra', faune: 'ultra', retro: 'auto' },
  };
  for (const p of Object.values(profils)) Object.freeze(p);
  Object.freeze(profils);

  // Coût d'une image complète, méthode « terminer » : le jeu fournit io.terminer(), qui force la fin du travail
  // graphique (lecture d'un pixel). Le chronomètre GPU du moteur gonfle les temps sur les processeurs graphiques à
  // tuiles (ses requêtes coupent les passes, le travail d'un autre contexte y est compté) et coûte lui-même ;
  // l'horloge autour de « dessiner puis terminer » ne dépend ni de la synchronisation verticale ni d'un navigateur
  // bridé à 30 Hz.
  // Le budget vise 60 images par seconde sur tout écran : un écran à 120 ou 144 Hz se cale sur un diviseur de sa
  // cadence, et un bridage à 30 Hz (économie d'énergie) ne dit rien de la machine.
  // Ce que l'image de mesure contient (src/scene-bench.js, mesure à l'horloge) : la vue principale avec douze
  // voitures, le décor, la végétation, les ombres, le halo et les reflets du palier ; l'un des trois points de vue est
  // l'endroit le plus chargé compté en course le 18/11 (départ de Val-Brûlé, vu du cockpit, habitacle compris : 4,3 M
  // de triangles en Fine), et le 95e centile tombe sur lui ; les glaces des rétroviseurs au rythme de la course (une
  // par image en Fine, une image sur deux en Moyenne) quand le jeu prête leur moteur.
  // FRACTION : ce qui reste hors de la mesure doit tenir dans le reste du budget. Sur un Apple M5 (MESURES-BASE du
  // 18/11) : simulation, affichage, son et effets, 1,6 à 1,7 ms du fil principal ; un ramassage mineur de 0,9 à
  // 2,1 ms dans 7 à 10 % des images, donc dans le 95e centile ; la copie des glaces dans leurs toiles et la
  // composition du navigateur, de l'ordre d'une milliseconde. Ces travaux du processeur se recouvrent en course avec
  // celui du GPU, alors que la lecture d'un pixel met processeur et GPU en série : la mesure les surestime déjà. À
  // 0,75, il reste 4,2 ms (16,7 − 12,5), de quoi couvrir le ramassage et la composition dans la même image. Le cas de
  // référence borne ce choix : Fine rate une image sur quatre sur ce M5 en course, son coût mesuré glaces comprises
  // dépasse donc 16,7 ms et elle est refusée à toute fraction inférieure à 1 ; Moyenne y tient sans une image ratée,
  // avec moitié moins de triangles et le quart des pixels. La fraction de 0,6 laissait 6,7 ms pour des glaces et un
  // endroit chargé que la mesure ne contenait pas ; ils y sont maintenant, la garder refuserait Moyenne sur des
  // machines qui la tiennent. Elle reste à confirmer à l'horloge sur une machine au repos.
  const BUDGET = 1000 / 60, FRACTION = .75, LIMITE = BUDGET * FRACTION;
  // Glaces que la course dessinerait mais que le parcours ne peut pas dessiner (moteur des glaces non prêté) : leur
  // part est retirée de la limite. Comptée le 18/11 au départ de Val-Brûlé, une image de glace pèse 0,36 fois les
  // triangles de la vue principale en Fine (1,56 M pour 4,28 M, une glace par image) ; en Moyenne, une image sur
  // deux, 0,19 (0,48 M pour 2,54 M), soit 0,36 × 0,5. Les triangles valent ici pour le coût : la toile d'une glace
  // compte peu de pixels.
  const PART_GLACES = .36;
  function limiteProfil(info) {
    if (!info || info.glaces !== 'absentes') return LIMITE;
    const parImage = Number.isFinite(info.glacesParImage) ? Math.max(0, Math.min(1, info.glacesParImage)) : 1;
    return LIMITE / (1 + PART_GLACES * parImage);
  }
  // Extrême rend le tapis d'herbe trente fois plus dru que Fine : il n'est essayé que si Fine tient dans la moitié
  // de la limite.
  const EXTREME = .5;

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
  // options.terminer : le jeu sait forcer la fin du travail graphique. Une détection faite sans cette fin forcée
  // n'est alors plus valable : elle est refaite une fois avec la méthode fiable.
  function cacheValide(cache, cle, options) {
    const valide = !!cache && cache.revision === REVISION && cache.empreinte === cle && cache.statut === 'ok'
      && Object.prototype.hasOwnProperty.call(profils, cache.selection)
      && Array.isArray(cache.mesures) && cache.mesures.length > 0;
    return valide && !(options && options.terminer === true && cache.methode !== 'terminer');
  }
  function gpuComplet(stats, premiereImage) {
    if (!stats || !stats.gpu || !Array.isArray(stats.history)) return [];
    return stats.history.filter(r => r.frame >= premiereImage && r.valid && r.queries > 0 && r.completed === r.queries)
      .map(r => Object.values(r.gpu).reduce((s, n) => s + n, 0)).filter(Number.isFinite);
  }
  // Méthode du chronomètre GPU, gardée tant que le jeu ne fournit pas io.terminer.
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
  // Méthode « terminer » : couts = dessiner + terminer par image ; cpu = dessiner seul ; attentes = terminer seul
  // (fin du travail graphique) ; intervalles = écarts entre images, relevés pour mémoire, jamais jugés : la lecture
  // du pixel les allonge.
  // limite : celle du profil (limiteProfil), LIMITE par défaut.
  function bilanCout(id, couts, cpu, attentes, intervalles, limite = LIMITE) {
    const c95 = q(couts, .95);
    return { profil: id, methode: 'terminer', images: couts.length, cout50: arrondir(q(couts, .5)), cout95: arrondir(c95),
      cpu95: arrondir(q(cpu || [], .95)), attente95: arrondir(q(attentes || [], .95)),
      p50: arrondir(q(intervalles || [], .5)), p95: arrondir(q(intervalles || [], .95)),
      budget: arrondir(BUDGET), limite: arrondir(limite),
      acceptable: couts.length >= 24 && c95 !== null && c95 <= limite };
  }
  function choisir(mesures) {
    for (const id of ['extreme', 'high', 'medium', 'low']) if (mesures.some(m => m.profil === id && m.acceptable)) return id;
    return 'low';
  }
  function peutEssayerExtreme(m) {
    if (m && m.methode === 'terminer') return m.acceptable && m.images >= 24 && Number.isFinite(m.cout95) && m.cout95 <= m.limite * EXTREME;
    // Le maximum ne se déduit pas d'un écran plafonné à 60 Hz. Il faut des requêtes GPU complètes et de la marge.
    return !!m && m.acceptable && m.imagesGPU >= 12 && m.gpu95 !== null
      && m.gpu95 < m.budget * .28 && m.cpu95 < m.budget * .34;
  }

  async function executer(io) {
    const maintenant = io.maintenant || (() => performance.now()), debut = maintenant();
    const avecFin = typeof io.terminer === 'function', methode = avecFin ? 'terminer' : 'chrono-gpu';
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
    const conclure = partiel => {
      const selection = choisir(mesures);
      progression('Réglages adaptés', 1);
      const r = { revision: REVISION, statut: 'ok', empreinte: cle, selection, reglages: reglages(selection), mesures,
        cadence: arrondir(q(cadence, .5)), duree: arrondir((maintenant() - debut) / 1000), date: Date.now(), partiel: !!partiel, methode };
      // cadence : période de l'écran relevée sur des images à vide ; l'écart du 10e au 90e centile dit si elle est
      // régulière (écran à fréquence variable, navigateur chargé).
      if (avecFin) Object.assign(r, { budget: arrondir(BUDGET), fraction: FRACTION, limite: arrondir(LIMITE),
        cadenceIntervalles: cadence.length, cadenceEcart: arrondir(q(cadence, .9) - q(cadence, .1)) });
      return r;
    };
    try {
      progression('Mesure de la cadence de l’écran…', .02);
      let prec = await trame();
      if (avecFin) {
        // Images à vide, distinctes des images de mesure : rien n'y est dessiné, la période reste celle de l'écran.
        const t0 = maintenant();
        while (cadence.length < 9 || (cadence.length < 24 && maintenant() - t0 < 400)) { const t = await trame(); cadence.push(t - prec); prec = t; }
      } else for (let i = 0; i < 9; i++) { const t = await trame(); cadence.push(t - prec); prec = t; }
      const periode = q(cadence, .5) || 1000 / 60;
      const essayer = async id => {
        const rang = mesures.length;
        progression('Préparation · ' + profils[id].nom, .1 + rang * .23);
        await trame();
        // Sans le chronomètre GPU, le parcours ne l'ouvre pas : ses requêtes fausseraient la mesure à l'horloge.
        // Le parcours répond s'il dessine les glaces que la course paierait à ce palier.
        let info = null;
        if (avecFin) info = await io.preparer(id, profils[id], { chronoGPU: false });
        else await io.preparer(id, profils[id]);
        const limite = limiteProfil(info), glaces = info && typeof info.glaces === 'string' ? info.glaces : null;
        verifier();
        // Trois points de vue parcourus pendant la chauffe et la mesure : aucune clairière isolée ne fait le test.
        // Avec la fin forcée, chaque image de chauffe est attendue : la première image mesurée ne paie pas le retard
        // des précédentes.
        const t0 = maintenant(); let n = 0;
        do { const t = await trame(); io.dessiner(t / 1000, n++ % 3); if (avecFin) io.terminer(); }
        while ((n < 12 || maintenant() - t0 < 180) && maintenant() - t0 < 450);
        if (avecFin) {
          progression('Mesure · ' + profils[id].nom, .16 + rang * .23);
          const couts = [], cpu = [], attentes = [], temps = [], depart = maintenant(); prec = await trame();
          do {
            const t = await trame(), avant = maintenant();
            io.dessiner(t / 1000, Math.floor(n++ / 8) % 3);
            const dessine = maintenant();
            io.terminer();
            const fin = maintenant();
            cpu.push(dessine - avant); attentes.push(fin - dessine); couts.push(fin - avant); temps.push(t - prec); prec = t;
            // Profil sans espoir : la médiane dépasse déjà largement la limite, inutile de prolonger.
            if (couts.length >= 8 && q(couts, .5) > limite * 1.5) break;
          } while (((maintenant() - depart < 720 || couts.length < 24) && couts.length < 90) && maintenant() - depart < 1800);
          const resultat = bilanCout(id, couts, cpu, attentes, temps, limite);
          resultat.glaces = glaces;
          mesures.push(resultat); return resultat;
        }
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
      return conclure(false);
    } catch (e) {
      if (e && e.motif === 'delai' && mesures.some(m => m.acceptable)) return conclure(true);
      return { revision: REVISION, statut: 'interrompu', motif: e && e.motif || 'erreur', empreinte: cle, mesures, methode };
    }
  }
  B.autoconfig = { REVISION, CLE, CLES, BUDGET, FRACTION, LIMITE, PART_GLACES, profils, empreinte, reglages, cacheValide, bilan, bilanCout, limiteProfil,
    choisir, peutEssayerExtreme, gpuComplet, executer };
})(globalThis.BITUME = globalThis.BITUME || {});
