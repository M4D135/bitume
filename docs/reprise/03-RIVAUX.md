# Lot 3 : rivaux agressifs contre tous

Statut : **à faire**, après intégration du lot 2.

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
