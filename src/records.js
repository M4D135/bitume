(function (B) {
  'use strict';

  /**
   * B.records — Records enrichis par circuit, sens, mode, boîte et version physique + migration.
   * L’ancien stockage enrichi reste lisible. Chaque nouvelle physique possède sa clé d’écriture.
   */

  const VERSION_PHYSIQUE = 'p22';
  const ARCHIVE_ENRICHIE = 'bitume.records.v2';
  const STORAGE_KEY = ARCHIVE_ENRICHIE + '.' + VERSION_PHYSIQUE;

  /* ─── CLÉ ─── */
  function cle(ctx) {
    const circuitId = ctx.circuitId || 'inconnu';
    const sens = ctx.sens || 'normal';
    const mode = ctx.mode || 'course';
    const boite = ctx.boite || 'auto';
    const versionPhysique = ctx.versionPhysique || VERSION_PHYSIQUE;
    return 'bitume:' + circuitId + ':' + sens + ':' + mode + ':' + boite + ':' + versionPhysique;
  }

  /* ─── MIGRATION ─── */
  function migrerAnciens(anciens, catalogue, versionPhysique = VERSION_PHYSIQUE, facteurTemps = 1) {
    if (!anciens) return {};
    const table = {};

    // Format ancien : { [circuitId]: { tour, course, date } } ou tableau par index
    const ids = [];
    if (Array.isArray(anciens)) {
      for (let i = 0; i < anciens.length; i++) {
        if (catalogue && catalogue[i]) ids.push(catalogue[i].id);
        else ids.push('circuit_' + i);
      }
    } else {
      const keys = Object.keys(anciens);
      for (let k = 0; k < keys.length; k++) ids.push(keys[k]);
    }

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const ancien = Array.isArray(anciens) ? anciens[i] : anciens[id];
      if (!ancien) continue;

      const ctx = {
        circuitId: id,
        sens: 'normal',
        mode: typeof ancien.mode === 'string' ? ancien.mode : 'course',
        boite: 'auto',
        versionPhysique
      };
      const k = cle(ctx);
      const entree = {
        meilleurTourMs: null,
        meilleureCourseMs: null,
        date: null,
        pilote: null
      };

      if (typeof ancien.tour === 'number' && ancien.tour > 0 && isFinite(ancien.tour)) {
        entree.meilleurTourMs = Math.round(ancien.tour * facteurTemps);
      }
      if (typeof ancien.course === 'number' && ancien.course > 0 && isFinite(ancien.course)) {
        entree.meilleureCourseMs = Math.round(ancien.course * facteurTemps);
      }
      if (ancien.date) entree.date = ancien.date;

      if (entree.meilleurTourMs !== null || entree.meilleureCourseMs !== null) {
        table[k] = entree;
      }
    }

    return table;
  }

  /* ─── ENREGISTRER ─── */
  function enregistrer(table, contexte, mesures) {
    if (!table || !contexte || !mesures) return { nouveauTour: false, nouvelleCourse: false, entree: null };

    const k = cle(contexte);
    let entree = table[k];
    if (!entree) {
      entree = { meilleurTourMs: null, meilleureCourseMs: null, date: null, pilote: null };
      table[k] = entree;
    }

    let nouveauTour = false;
    let nouvelleCourse = false;

    // Tour
    if (typeof mesures.tourMs === 'number' && mesures.tourMs > 0 && isFinite(mesures.tourMs)) {
      if (entree.meilleurTourMs === null || mesures.tourMs < entree.meilleurTourMs) {
        entree.meilleurTourMs = mesures.tourMs;
        nouveauTour = true;
      }
    }

    // Course
    if (typeof mesures.courseMs === 'number' && mesures.courseMs > 0 && isFinite(mesures.courseMs)) {
      if (entree.meilleureCourseMs === null || mesures.courseMs < entree.meilleureCourseMs) {
        entree.meilleureCourseMs = mesures.courseMs;
        nouvelleCourse = true;
      }
    }

    // Métadonnées
    if (mesures.date) entree.date = mesures.date;
    if (mesures.pilote) entree.pilote = mesures.pilote;

    return { nouveauTour, nouvelleCourse, entree };
  }

  /* ─── MEILLEUR ─── */
  function meilleur(table, contexte) {
    if (!table || !contexte) return null;
    const k = cle(contexte);
    return table[k] || null;
  }

  function meilleurCircuit(table, circuitId, versionPhysique = VERSION_PHYSIQUE) {
    if (!table || !circuitId) return null;
    // Cherche toutes les entrées pour ce circuitId
    let best = null;
    const prefix = 'bitume:' + circuitId + ':';
    const keys = Object.keys(table);
    for (let i = 0; i < keys.length; i++) {
      if (!keys[i].startsWith(prefix) || !keys[i].endsWith(':' + versionPhysique)) continue;
      const e = table[keys[i]];
      if (!e) continue;
      if (!best) {
        best = { meilleurTourMs: e.meilleurTourMs, meilleureCourseMs: e.meilleureCourseMs, date: e.date, pilote: e.pilote };
      } else {
        if (e.meilleurTourMs !== null && (best.meilleurTourMs === null || e.meilleurTourMs < best.meilleurTourMs)) {
          best.meilleurTourMs = e.meilleurTourMs;
        }
        if (e.meilleureCourseMs !== null && (best.meilleureCourseMs === null || e.meilleureCourseMs < best.meilleureCourseMs)) {
          best.meilleureCourseMs = e.meilleureCourseMs;
        }
      }
    }
    return best;
  }

  /* ─── LIRE / SAUVER ─── */
  function lireTout(storage, catalogue) {
    function lire(cle) {
      try {
        const valeur = JSON.parse(storage.getItem(cle));
        return valeur && typeof valeur === 'object' ? valeur : {};
      } catch (_) { return {}; }
    }
    // Les clés de finTour contiennent des secondes. Les anciennes archives enrichies sont déjà en ms.
    // Les tableaux p15 sans identifiants sont antérieurs au tri du catalogue et gardent leurs indices.
    const table = migrerAnciens(lire('bitume.records.p15'), null, 'p15', 1000);
    const version = Number(VERSION_PHYSIQUE.slice(1));
    for (let n = 16; n <= version; n++) {
      const physique = 'p' + n;
      Object.assign(table, migrerAnciens(lire('bitume.records.' + physique), catalogue, physique, 1000));
    }
    // Les entrées enrichies conservent leurs identifiants de physique et priment sur les temps bruts.
    Object.assign(table, lire(ARCHIVE_ENRICHIE));
    for (let n = 16; n <= version; n++) Object.assign(table, lire(ARCHIVE_ENRICHIE + '.p' + n));
    return table;
  }

  function courants(table) {
    return Object.fromEntries(Object.entries(table).filter(([cle]) => cle.endsWith(':' + VERSION_PHYSIQUE)));
  }

  function sauverTout(table, storage) {
    try {
      if (storage && typeof storage.setItem === 'function') {
        storage.setItem(STORAGE_KEY, JSON.stringify(courants(table)));
      }
    } catch (e) {
      // Quota dépassé ou Node sans localStorage → silencieux
    }
  }

  /* ─── EXPORT ─── */
  B.records = {
    VERSION_PHYSIQUE, STORAGE_KEY, courants,
    cle,
    lireTout,
    sauverTout,
    enregistrer,
    meilleur,
    meilleurCircuit,
    migrerAnciens
  };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.records;
