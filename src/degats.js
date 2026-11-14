/* BITUME — dégâts de la caisse (Chantier 3). Un choc coûte de l'adhérence et de la traînée, dans la limite
   des critères (adhérence −18 % au plus, traînée +24 % au plus) ; au-delà d'un seuil de violence, une roue
   se détache et la caisse casse (retour en piste assuré par conduite.js). L'état des dégâts vit sur
   etat.degats ; conduite.js le lit pour moduler mu et la traînée, le moteur le lit pour teinter la caisse
   (uEffects.z) et masquer une roue perdue. Rien ici ne dépend du moteur ni du circuit. */
(function (B) {
  'use strict';

  const PARAMS = Object.freeze({
    // un choc de `force` (m/s de vitesse perdue) enlève adherPar de coefficient d'adhérence par unité, plafonné
    adherPar: 0.012, adherMin: 0.82,       // −18 % au plus
    traineePar: 0.008, traineeMax: 1.24,   // +24 % au plus
    chocRoue: 9,                            // m/s de vitesse perdue : au-delà, une roue peut partir
    chocCasse: 16,                          // m/s : au-delà, la caisse casse (retour en piste)
    roueReparation: 0                       // une roue perdue ne revient pas (0 = définitif pour la séance)
  });
  const P = PARAMS;

  // état des dégâts d'une voiture : adhérence et traînée multiplicatrices, roues manquantes, violence max reçue
  function creer() {
    return { adher: 1, trainee: 1, chocs: 0, pire: 0, roues: [false, false, false, false], casse: false, teinte: 0 };
  }

  // un choc de `force` m/s ; `o` = { roue: index 0..3 ou absent, durete: 0..1 } pour orienter la casse
  function choc(d, force, o = {}) {
    force = Math.max(0, +force || 0);
    if (force < 0.5) return null;
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
    // la casse franche : au-delà du seuil, la caisse est HS et rentre au stand (retour en piste)
    if (force >= P.chocCasse && !d.casse) { d.casse = true; ev.push({ type: 'casse' }); }
    return ev.length ? ev : null;
  }

  // remise à zéro (nouvelle séance, ou réparation au stand)
  function reparer(d) {
    d.adher = 1; d.trainee = 1; d.chocs = 0; d.pire = 0; d.roues = [false, false, false, false]; d.casse = false; d.teinte = 0;
  }

  const uneRouePerdue = d => d.roues.some(Boolean);

  B.degats = { PARAMS, creer, choc, reparer, uneRouePerdue };
})(globalThis.BITUME = globalThis.BITUME || {});
