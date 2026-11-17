# Lot 3 : rivaux agressifs contre tous

Statut : **terminé le 17 novembre 2026**, commit `7b09e84f35eb38ed9c918ff0325944d9ffea4a50`, client **0.2.23**.
Rapport brut : `docs/reprise/rapports/LOT3-2026-11-17.md`.

## Objectif

Des concurrents capables de serrer une trajectoire, bloquer, provoquer un contact latéral ou tenter une manœuvre risquée contre le joueur ET contre d'autres IA. Conserver des courses disputées, pas un convoi qui vise exclusivement le joueur.

## Sources utiles

`src/course.js` pour les décisions et caractères ; `src/contacts.js` et `src/conduite.js` pour les limites de dynamique ; tests `ia.test.mjs`, `ia-reprise.test.mjs`, `ia-epaves.test.mjs`, `course.test.mjs`. Reprendre le contrat de dégâts du lot 2.

## Travail borné

Décisions déterministes au pas fixe, tempéraments distincts, mémoire de cible et délai entre deux attaques. Même capacité d'attaque sur les humains et les rivaux. Choisir une cible réellement atteignable et abandonner une action devenue impossible ; pas de téléportation ni d'impulsion cachée réservée à l'IA.

Équilibrer agressivité, risque et difficulté. Garder une possibilité de récupération après contact et un comportement raisonnable près d'une voiture immobilisée. Respecter un adversaire en cours de replacement ou de service aux stands ; éviter les attaques infinies sur une cible bloquée.

Préserver la conduite propre du chrono et le mode d'essai. En ligne, les décisions des rivaux restent cohérentes avec l'autorité de simulation existante ; ne pas tirer un hasard différent sur chaque client.

## Acceptation

Scénarios reproductibles montrant attaque IA/joueur et IA/IA, sorties de manœuvre, absence d'oscillation de cible, absence de blocage durable et fin de course. Rejouer plusieurs graines et difficultés. Mesurer les contacts, abandons de manœuvre et temps de décision, pas seulement afficher un nouvel état « agressif ».

## Livraison

Paramètres de comportement documentés, tests des décisions et collisions, conséquences sur les temps de course. Pas de refonte du rendu ni du système audio dans ce lot.

## Ce qui a été fait (17/11/2026)

- **Engagement mesuré** : cible à portée (`IA_PORT` = 34 m), vitesse relative suffisante (`Δv > gap/60`), côté libre,
  et délai de `IA_ATTENTE` = 2,5 s entre deux attaques d'une même voiture, compté sur l'horloge locale de simulation
  (`ia.t`) — pas le temps affiché, pour que les décisions restent identiques sur chaque machine en ligne.
- **Hors service respecté** : une voiture en récupération, replacement, accident ou casse n'est plus une cible
  d'attaque (`B.course.horsService`). Elle reste une voiture devant soi : **contourner et éviter gardent la main**,
  sans portée ni délai. Oublier cette distinction faisait freiner un rival à 80 m/s derrière une voiture arrêtée au
  lieu de la contourner (régression rattrapée par `ia.test.mjs`).
- **Blocage** : un rival combatif (`agressivite > .55`) tenu de près dans un virage tient la ligne qu'il a prise au
  lieu de se rabattre sous le nez de son poursuivant, une fois par virage, jusqu'à ce que l'autre décroche ou que le
  virage finisse. Aucun élan ajouté ; l'évitement d'une voiture plus lente prime toujours.
- **Compteurs** `course.statsIa` : `attaques`, `abandons`, `presses`, `contacts`, `decisions`, `tempsDecision`.
  Un contournement de voiture hors service n'est pas compté comme attaque (`ia.attaque`).

## Reste ouvert après ce lot

- **Le spectacle reste à juger à l'œil** : les compteurs prouvent que les manœuvres ont lieu, s'arrêtent et coûtent
  des contacts, pas qu'elles sont belles. Capture et avis humain sur le Mac.
- **Réseau réel non éprouvé** : décisions sans hasard et sur horloge locale, donc divergentes nulle part par
  construction, mais aucune vraie partie multi-machines jouée.
- Les 13 contacts relevés en navigateur viennent d'une démo en rendu logiciel à ~1 image/s : preuve que la chaîne
  tourne, pas un taux exploitable. Le taux exploitable vient avec la qualification Mac du lot 5.
