/* BITUME — usure au pas de simulation : visuel depuis 12D, lecture physique depuis 12E/p10.
   Les coefficients sont des réglages de jeu, pas des mesures thermomécaniques de pneus réels.
   Les charges viennent de conduite.js (newtons), les glisses par roue sont sans unité, de 0 à 1. */
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.pneus) require('./pneus.js');
(function (B) {
  'use strict';
  const P = B.pneus;
  const PARAMS = Object.freeze({
    chargeReference: 1500, chargeMax: 4,
    chargeRecul: 1471.5, // moyenne statique de la masse p9 : 600 kg × 9,81 / 4 ; approximation visuelle seulement
    abrasionParMetre: 1 / 250000, surcroitGlisse: 8,
    vitessePatinage: 2, // mètres de frottement équivalents/seconde, faute de vitesse angulaire simulée
    distanceGrainage: 180, distanceSalissure: 24, distanceNettoyage: 110,
    pasMax: .1, vitesseContactMax: 180
  });
  const TYPES = Object.freeze({
    slicks: Object.freeze({ sec: 1, mouille: .85, neige: .18 }),
    inter: Object.freeze({ sec: 1.35, mouille: .9, neige: .20 }),
    pluie: Object.freeze({ sec: 1.8, mouille: .95, neige: .22 }),
    neige: Object.freeze({ sec: 2.4, mouille: 1.8, neige: .32 })
  });
  const SURFACES = Object.freeze({
    piste: Object.freeze({ abrasion: 1, salete: 0 }),
    vibreur: Object.freeze({ abrasion: 1.12, salete: .04 }),
    herbe: Object.freeze({ abrasion: .35, salete: .85 }),
    terre: Object.freeze({ abrasion: .65, salete: .95 }),
    gravier: Object.freeze({ abrasion: 1.4, salete: 1 }),
    neige: Object.freeze({ abrasion: 1, salete: .45 })
  });
  function borne(n, maximum = 1) {
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(maximum, n)) : 0;
  }
  function exclu(e) {
    return !e || !!(e.saut || e.recuperation || e.accident || e.reparation || e.bond > 0 || e.bondT > 0 ||
      e.degats?.casse || e.stands?.phase === 'service');
  }

  // distanceSignee : déplacement au sol de CE pas, en mètres, jamais la différence de s après un replacement.
  // eau/neige : couverture réelle de chaussée [0,1], déjà corrigée pour un passage couvert ; aucune lecture de saison.
  // contactsFrais : true après rouler ; false en grille/pause ou quand les contacts sont périmés.
  // Le mode explicite 'recul' emploie la charge moyenne ci-dessus, sans lire charge/glisse/patinage périmés.
  // Il conserve les vetos de présence (roue absente, perdue, contact:false) et les exclusions de vol/récupération.
  // surface peut décrire le contact courant calculé par l'appelant.
  // Aucun objet, tableau, événement ou tirage aléatoire n'est créé dans cette boucle.
  function pas(e, dt, distanceSignee, eau = 0, neige = 0, contactsFrais = true, surface = e?.surface) {
    const recul = contactsFrais === 'recul';
    if ((!recul && contactsFrais !== true) || exclu(e) || !Number.isFinite(dt) || dt <= 0 || dt > PARAMS.pasMax ||
      !Number.isFinite(distanceSignee) || !Array.isArray(e.etatPneus) || e.etatPneus.length !== 4 ||
      !Array.isArray(e.roues)) return 0;
    if (recul && (!Number.isFinite(e.v) || e.v >= 0)) return 0;
    const d = Math.abs(distanceSignee);
    // Un déplacement discontinu (téléportation, replacement) n'est pas du roulage : la vitesse implicite
    // du pas doit rester dans les bornes plausibles d'un contact de pneu avec le sol.
    if (!(d / dt <= PARAMS.vitesseContactMax)) return 0;
    eau = borne(eau); neige = surface === 'neige' ? 1 : borne(neige);
    const type = P.normaliserType(e.pneus), t = TYPES[type];
    const surf = Object.prototype.hasOwnProperty.call(SURFACES, surface) ? SURFACES[surface] : SURFACES.piste;
    const climat = (t.sec + (t.mouille - t.sec) * eau) * (1 - neige) + t.neige * neige;
    const patinage = recul ? 0 : borne(e.patinage);
    const saleteCible = Math.max(surf.salete, .45 * neige);
    let touches = 0;
    for (let i = 0; i < 4; i++) {
      const r = e.roues[i], u = e.etatPneus[i];
      if (!r || !u || typeof u !== 'object' || r.contact === false || e.degats?.roues?.[i]) continue;
      if (!recul && (!Number.isFinite(r.charge) || r.charge <= 0)) continue;
      const charge = recul ? PARAMS.chargeRecul / PARAMS.chargeReference : borne(r.charge / PARAMS.chargeReference, PARAMS.chargeMax);
      const glisse = recul ? 0 : borne(r.glisse);
      // Le patinage est simulé sur l'essieu moteur arrière. Une glisse latérale résiduelle à l'arrêt n'use rien.
      const frottementArret = i >= 2 ? PARAMS.vitessePatinage * patinage * glisse * dt : 0;
      const distanceActive = d + frottementArret;
      if (!(distanceActive > 1e-9)) continue;
      const sollicitation = charge * (d * (1 + PARAMS.surcroitGlisse * glisse * glisse) +
        (1 + PARAMS.surcroitGlisse) * frottementArret);
      // La distance d'usure ne compte que le roulage réel (d), jamais le frottement de patinage à l'arrêt.
      u.distance = Math.min(P.DISTANCE_MAX, borne(u.distance, P.DISTANCE_MAX) + d);
      u.sollicitation = Math.min(P.SOLLICITATION_MAX, borne(u.sollicitation, P.SOLLICITATION_MAX) + sollicitation);
      u.usure = Math.min(1, borne(u.usure) + sollicitation * PARAMS.abrasionParMetre * climat * surf.abrasion);
      const grainCible = glisse * glisse * Math.min(charge, 1) * (1 - .55 * eau) * (1 - .6 * neige);
      u.grainage = borne(u.grainage);
      u.grainage += (grainCible - u.grainage) * (1 - Math.exp(-distanceActive / PARAMS.distanceGrainage));
      u.salete = borne(u.salete);
      const nettoyage = saleteCible > u.salete ? PARAMS.distanceSalissure : PARAMS.distanceNettoyage / (1 + 2 * eau);
      u.salete += (saleteCible - u.salete) * (1 - Math.exp(-distanceActive / nettoyage));
      touches++;
    }
    return touches;
  }

  B.usurePneus = Object.freeze({ PARAMS, TYPES, SURFACES, exclu, pas });
})(globalThis.BITUME = globalThis.BITUME || {});
