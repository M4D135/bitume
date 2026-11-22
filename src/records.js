(function (B) {
  'use strict';

  /**
   * B.records — Records enrichis par circuit, sens, mode, boîte et version physique + migration.
   * Stockage sous clé 'bitume.records.v2'.
   */

  const VERSION_PHYSIQUE = 'p15';
  const STORAGE_KEY = 'bitume.records.v2';

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
  function migrerAnciens(anciens, catalogue) {
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
        mode: 'course',
        boite: 'auto',
        versionPhysique: VERSION_PHYSIQUE
      };
      const k = cle(ctx);
      const entree = {
        meilleurTourMs: null,
        meilleureCourseMs: null,
        date: null,
        pilote: null
      };

      if (typeof ancien.tour === 'number' && ancien.tour > 0 && isFinite(ancien.tour)) {
        entree.meilleurTourMs = ancien.tour;
      }
      if (typeof ancien.course === 'number' && ancien.course > 0 && isFinite(ancien.course)) {
        entree.meilleureCourseMs = ancien.course;
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

  function meilleurCircuit(table, circuitId) {
    if (!table || !circuitId) return null;
    // Cherche toutes les entrées pour ce circuitId
    let best = null;
    const prefix = 'bitume:' + circuitId + ':';
    const keys = Object.keys(table);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(prefix) !== 0) continue;
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
    let table = {};
    try {
      let raw = null;
      if (storage && typeof storage.getItem === 'function') {
        raw = storage.getItem(STORAGE_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          table = parsed;
        }
      }
    } catch (e) {
      // localStorage indisponible ou JSON corrompu → table vide
    }
    return table;
  }

  function sauverTout(table, storage) {
    try {
      if (storage && typeof storage.setItem === 'function') {
        storage.setItem(STORAGE_KEY, JSON.stringify(table));
      }
    } catch (e) {
      // Quota dépassé ou Node sans localStorage → silencieux
    }
  }

  /* ─── EXPORT ─── */
  B.records = {
    VERSION_PHYSIQUE,
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
