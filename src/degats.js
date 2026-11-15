/* BITUME — dégâts de la caisse (Chantier 3). Un choc coûte de l'adhérence et de la traînée, dans la limite
   des critères (adhérence −8 % au plus, traînée +8 % au plus) ; au-delà d'un seuil de violence, une roue
   se détache et la caisse attend une remise en piste rapide. L'état des dégâts vit sur
   etat.degats ; conduite.js le lit pour moduler mu et la traînée, le moteur le lit pour teinter la caisse
   (uEffects.z) et masquer une roue perdue. Rien ici ne dépend du moteur ni du circuit. */
(function (B) {
  'use strict';

  const PARAMS = Object.freeze({
    // un choc de `force` (m/s normaux vers le rail ou de rapprochement rival) enlève adherPar de coefficient d'adhérence par unité, plafonné
    adherPar: 0.0025, adherMin: 0.92,       // −8 % au plus
    traineePar: 0.002, traineeMax: 1.08,   // +8 % au plus
    chocRoue: 20,                            // m/s normaux/relatifs : au-delà, une roue peut partir
    chocCasse: 30,                          // m/s normaux au rail / rapprochement rival : casse franche
    roueReparation: 0                       // remise en piste gérée par conduite.js
  });
  const P = PARAMS;

  // état des dégâts d'une voiture : adhérence et traînée multiplicatrices, roues manquantes, violence max reçue
  function creer() {
    return { adher: 1, trainee: 1, chocs: 0, pire: 0, roues: [false, false, false, false], casse: false, teinte: 0 };
  }

  // un choc de `force` m/s ; `o` = { roue: index 0..3 ou absent, durete: 0..1 } pour orienter la casse
  function choc(d, force, o = {}) {
    force = Math.max(0, +force || 0);
    if (force < 2 || d.casse) return null;
    d.chocs++;
    d.pire = Math.max(d.pire, force);
    d.adher = Math.max(P.adherMin, d.adher - P.adherPar * force);
    d.trainee = Math.min(P.traineeMax, d.trainee + P.traineePar * force);
    d.teinte = Math.min(1, (1 - d.adher) / (1 - P.adherMin));   // 0 = neuve, 1 = au plus bas de l'adhérence
    const ev = [];
    // une roue part sur un choc violent et localisé (ou tiré au sort selon la violence) ; une seule par roue
    if (force >= P.chocRoue) {
      const candidates = [0, 1, 2, 3].filter(i => !d.roues[i]);
      if (candidates.length) {
        const i = o.roue !== undefined && !d.roues[o.roue] ? o.roue
          : candidates[Math.min(candidates.length - 1, Math.floor((force - P.chocRoue) / 2) % candidates.length)];
        d.roues[i] = true;
        ev.push({ type: 'roue', roue: i });
      }
    }
    // Casse franche : roues et panneaux détachés, arrêt avant remise en piste.
    if (force >= P.chocCasse) {
      d.casse = true;
      for (let i = 0; i < 4; i++) if (!d.roues[i]) { d.roues[i] = true; ev.push({ type: 'roue', roue: i }); }
      ev.push({ type: 'casse', force });
    }
    return ev.length ? ev : null;
  }

  // Réparation complète lors de la remise en piste (décision David, 16/11/2026).
  function reparer(d) {
    d.adher = 1; d.trainee = 1; d.chocs = 0; d.pire = 0; d.roues = [false, false, false, false]; d.casse = false; d.teinte = 0;
  }

  const uneRouePerdue = d => d.roues.some(Boolean);

  B.degats = { PARAMS, creer, choc, reparer, uneRouePerdue };
})(globalThis.BITUME = globalThis.BITUME || {});
