'use strict';

(function () {
  const B = (globalThis.BITUME = globalThis.BITUME || {});

  const POINTS = Object.freeze([25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0]);
  const STORAGE_KEY = 'bitume.championnat.v1';

  // L’ordre des onze tracés de la version 0.2.120 ne se déduit pas de leur nouvel emplacement.
  // Il sert également à rattacher les vieux records par indice à leur piste d’origine.
  const ANCIEN_CATALOGUE = Object.freeze([
    'val-brule', 'marseille', 'corail', 'cap-sequoia', 'fjord', 'route-des-cimes',
    'larche', 'lande-noire', 'sierra', 'brume-de-jade', 'baikal'
  ].map(id => Object.freeze({ id })));

  function indiceCircuit(catalogue, id, ancienIndice) {
    const cherche = id || ANCIEN_CATALOGUE[ancienIndice]?.id;
    if (!cherche) return -1;
    return catalogue.findIndex(c => c.id === cherche || c.troncons?.some(t => t.id === cherche));
  }

  const SAISONS = Object.freeze({
    europe: {
      nom: "Coupe d'Europe",
      circuits: ['forets-du-pacifique', 'marseille', 'nord-atlantique', 'route-des-cimes', 'larche'],
      anciensCircuits: ['val-brule', 'marseille', 'fjord', 'route-des-cimes', 'larche'],
      manches: [0, 1, 4, 5, 6]
    },
    monde: {
      nom: 'Tour du Monde',
      circuits: ['forets-du-pacifique', 'marseille', 'karst-et-lagon', 'nord-atlantique', 'route-des-cimes', 'sierra', 'larche', 'baikal'],
      anciensCircuits: ['val-brule', 'marseille', 'corail', 'cap-sequoia', 'fjord', 'route-des-cimes', 'sierra', 'brume-de-jade'],
      manches: [0, 1, 2, 3, 4, 5, 6, 7]
    },
    integral: {
      nom: 'Grand Championnat Intégral',
      manches: null // rempli dynamiquement depuis le catalogue
    }
  });

  function creer(saisonId, catalogue, options = {}) {
    const saison = SAISONS[saisonId];
    if (!saison) throw new Error(`Saison inconnue: ${saisonId}`);

    let indicesManches;
    if (saison.manches === null) {
      // integral : tous les circuits du catalogue
      indicesManches = (catalogue || []).map((_, i) => i);
    } else {
      const pistes = catalogue || [];
      const calendrier = pistes.some(c => saison.anciensCircuits.includes(c.id) && !saison.circuits.includes(c.id))
        ? saison.anciensCircuits : saison.circuits;
      indicesManches = calendrier.map(id => pistes.findIndex(c => c.id === id)).filter(i => i >= 0);
      if (!indicesManches.length) indicesManches = saison.manches.filter(i => i < pistes.length);
    }

    const pilotes = (options.pilotes || []).map(p => ({
      id: p.id,
      nom: p.nom,
      couleur: p.couleur || [0.8, 0.2, 0.2],
      joueur: p.joueur || false,
      points: 0,
      victoires: 0,
      podiums: 0,
      meilleurTour: 0
    }));

    const etat = {
      version: 1,
      saisonId,
      nom: saison.nom,
      manches: indicesManches.map(ci => ({
        circuitIndex: ci,
        circuitId: catalogue[ci].id,
        sens: (options.sens && options.sens[ci]) || 0,
        meteo: (options.meteo && options.meteo[ci]) || 'sec',
        terminee: false,
        resultats: null
      })),
      indexManche: 0,
      pilotes,
      termine: false
    };

    return etat;
  }

  function enregistrerCourse(etat, classementCourse, meilleurTourId = null) {
    if (!etat || etat.termine) return etat;
    if (etat.indexManche >= etat.manches.length) {
      etat.termine = true;
      return etat;
    }

    const manche = etat.manches[etat.indexManche];
    manche.terminee = true;
    manche.resultats = classementCourse.map((r, i) => ({
      ...r,
      rang: i + 1,
      points: r.abandon ? 0 : (POINTS[i] || 0) +
        (meilleurTourId != null && r.id === meilleurTourId && i < 10 ? 1 : 0)
    }));

    // Mise à jour des pilotes
    for (let i = 0; i < classementCourse.length; i++) {
      const r = classementCourse[i];
      let pilote = etat.pilotes.find(p => p.id === r.id);
      if (!pilote) {
        pilote = { id: r.id, nom: r.nom || String(r.id), couleur: r.couleur || '#ccc', joueur: !!r.joueur, points: 0, victoires: 0, podiums: 0, meilleurTour: 0 };
        etat.pilotes.push(pilote);
      }

      pilote.points += manche.resultats[i].points;

      if (!r.abandon) {
        if (i === 0) pilote.victoires++;
        if (i < 3) pilote.podiums++;
      }
      if (r.meilleurTour > 0 && (!pilote.meilleurTour || r.meilleurTour < pilote.meilleurTour)) {
        pilote.meilleurTour = r.meilleurTour;
      }
    }

    etat.indexManche++;
    if (etat.indexManche >= etat.manches.length) {
      etat.termine = true;
    }

    return etat;
  }

  function classement(etat) {
    if (!etat || !etat.pilotes) return [];
    return [...etat.pilotes].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.victoires !== a.victoires) return b.victoires - a.victoires;
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      return a.nom.localeCompare(b.nom);
    });
  }

  function sauver(etat, storage) {
    try {
      if (storage === undefined) storage = globalThis.localStorage;
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(etat));
      return true;
    } catch (_) {
      return false;
    }
  }

  function charger(storage, catalogue) {
    try {
      if (storage === undefined) storage = globalThis.localStorage;
      if (!storage) return null;
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const etat = JSON.parse(raw);
      if (!etat || etat.version !== 1 || !Object.hasOwn(SAISONS, etat.saisonId)
          || !Array.isArray(etat.manches) || !etat.manches.length || !Array.isArray(etat.pilotes)
          || !Number.isInteger(etat.indexManche) || etat.indexManche < 0 || etat.indexManche > etat.manches.length
          || etat.termine !== (etat.indexManche === etat.manches.length)
          || !etat.manches.every(m => m && Number.isInteger(m.circuitIndex))
          || !etat.pilotes.every(p => p && typeof p.nom === 'string' && Number.isFinite(p.points))) return null;
      if (catalogue) {
        let changement = false;
        // Préserver le nombre et l’ordre des manches, les arrivées et les points déjà attribués.
        for (const manche of etat.manches.slice(etat.indexManche)) {
          const i = indiceCircuit(catalogue, manche.circuitId, manche.circuitIndex);
          if (i < 0 || (manche.circuitIndex === i && manche.circuitId === catalogue[i].id)) continue;
          manche.circuitIndex = i;
          manche.circuitId = catalogue[i].id;
          changement = true;
        }
        if (changement) sauver(etat, storage);
      }
      return etat;
    } catch (_) {
      return null;
    }
  }

  function effacer(storage) {
    try {
      if (storage === undefined) storage = globalThis.localStorage;
      if (!storage) return false;
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }

  B.championnat = {
    creer,
    indiceCircuit,
    ANCIEN_CATALOGUE,
    enregistrerCourse,
    classement,
    sauver,
    charger,
    effacer,
    POINTS,
    SAISONS
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.championnat;
