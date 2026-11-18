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
    roueReparation: 0,                      // remise en piste gérée par conduite.js
    urgenceAdher: .96                       // plancher rendu après une récupération d'urgence : jamais remise à neuf
  });
  const P = PARAMS;

  // état des dégâts d'une voiture : adhérence et traînée multiplicatrices, roues manquantes, violence max reçue
  function creer() {
    return { adher: 1, trainee: 1, chocs: 0, pire: 0, roues: [false, false, false, false], casse: false, teinte: 0, cote: 0, avant: true };
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
    if (o.cote) d.cote = o.cote > 0 ? 1 : -1;
    if (o.front !== undefined) d.avant = !!o.front;
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
      ev.push({ type: 'casse', force, cote: d.cote, avant: d.avant });
    }
    return ev.length ? ev : null;
  }

  // Récupération d'urgence (lot 2) : la caisse redevient conduisible — les roues repoussent, la casse est levée —
  // mais l'état des dégâts reste visible et exploitable : teinte, traînée, nombre de chocs et violence maximale
  // tiennent. La réparation complète (reparer) appartient aux stands, pas au remplacement sur la piste.
  function reparerUrgence(d) {
    d.roues = [false, false, false, false];
    d.casse = false;
    d.adher = Math.max(P.urgenceAdher, d.adher);
    d.teinte = Math.min(1, (1 - d.adher) / (1 - P.adherMin));   // la teinte suit l'adhérence qui reste, pas la violence reçue
    return d;
  }

  // Réparation complète : celle des stands (lot 4), jamais celle du remplacement sur la piste.
  function reparer(d) {
    d.adher = 1; d.trainee = 1; d.chocs = 0; d.pire = 0; d.roues = [false, false, false, false]; d.casse = false; d.teinte = 0;
  }

  // Lues pour chaque voiture à chaque pas de simulation : une boucle simple, sans fonction de rappel ni tableau
  // intermédiaire (même réponse que roues.some(Boolean) et roues.filter(Boolean).length sur ce tableau plein).
  function uneRouePerdue(d) { const r = d.roues; for (let i = 0; i < r.length; i++) if (r[i]) return true; return false; }
  function rouesPerdues(d) { const r = d.roues; let n = 0; for (let i = 0; i < r.length; i++) if (r[i]) n++; return n; }

  // Santé (lot 4) : un seul chiffre, 1 = neuve, 0 = au plus bas des critères. Il se lit dans le MÊME état que les
  // pénalités et la réparation — adhérence, traînée, roues manquantes — et n'est jamais une simulation parallèle
  // montée pour le seul affichage. Le flash rouge d'un impact est autre chose (jeu.js) : la santé, elle, persiste.
  const NOMS_ROUES = ['roue avant droite', 'roue avant gauche', 'roue arrière droite', 'roue arrière gauche'];
  function sante(d) {
    if (!d) return 1;
    const gA = (1 - d.adher) / (1 - P.adherMin);           // 0 à 1 sur la plage utile des critères
    const gT = (d.trainee - 1) / (P.traineeMax - 1);
    const gR = rouesPerdues(d) / 4;
    const gC = d.casse ? 1 : 0;                            // la caisse à redresser pèse à part
    return Math.max(0, Math.min(1, 1 - (.4 * gA + .2 * gT + .3 * gR + .1 * gC)));
  }
  // Ce qui est abîmé, en français, pour l'affichage et pour le devis du service.
  function avaries(d) {
    if (!d) return [];
    const a = [];
    if (d.adher < .995) a.push('adhérence');
    if (d.trainee > 1.005) a.push('carrosserie');
    for (let i = 0; i < 4; i++) if (d.roues[i]) a.push(NOMS_ROUES[i]);
    if (d.casse) a.push("caisse à redresser");
    return a;
  }
  // Durée du service, en secondes : elle dépend de l'état réellement constaté, pas d'un compteur de passage.
  function chiffrerService(d) {
    if (!d) return 0;
    return 2.5 + 1.2 * rouesPerdues(d) + (d.casse ? 3 : 0) + Math.min(3, d.chocs * .12);
  }

  B.degats = { PARAMS, creer, choc, reparer, reparerUrgence, uneRouePerdue, sante, avaries, chiffrerService, NOMS_ROUES };
})(globalThis.BITUME = globalThis.BITUME || {});
