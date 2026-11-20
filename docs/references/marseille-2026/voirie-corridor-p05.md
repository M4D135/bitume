# Marseille — corridor ouvert et voirie BD TOPO

Sous-lot sources uniquement. EMPRISE `cc004826a506e6979eaaec217748fe85d5cd6ac5` reste la carte de référence.
Le corridor est une proposition de reconnaissance : **13 polylignes**, **12 raccords X/Z exacts**,
**1638.398 m de géométrie 2D source**. Cette longueur n'est pas une mesure de course.
Les deux extrémités touchent x = −610 m ; aucune fermeture ni liaison nouvelle n'est inventée.

## Acquisition et inventaire

Les captures WFS sont complètes : **229 tronçons routiers**, **76 constructions linéaires**.
L'emprise est calculée depuis les voies sélectionnées avec une marge documentaire de 50 m ;
cette marge ne mesure aucune précision. Les objets source complets peuvent sortir de cette emprise.
URLs, paramètres, heures HTTP, tailles et empreintes : `sources-voirie-corridor-p05.json`.
Les sources déjà closes et les dérivés historiques sont vérifiés mais jamais réécrits.

**23 axes routiers portent des Z exclus** par précision absente/9999 ou méthode « Pas de Z ».
**41 axes** sont écartés de la revue de chaussée : sentiers, escaliers, liaisons maritimes ou axes fictifs.
Les attributs bruts et localisateurs restent dans `voirie-corridor-p05.json` ; aucune valeur absente ne devient zéro.
Les largeurs BD TOPO restent indicatives ; aucune division par deux ne crée des limites gauche/droite.
Le niveau `position_par_rapport_au_sol` reste ordinal, sans conversion en mètres.

Les 8 extrémités de segments Tunnel sont des objets à examiner, **zéro portail confirmé**.
Les extrémités communes sont comptées explicitement : une coupure d'objet ne devient pas automatiquement un portail.
Les variations Z fortes sont signalées dans `sourceGradeSegmentsToReview`, sans correction ni sélection de niveau.
Il n'y a pas encore de rapprochement axe/corridor : aucune altitude n'est interpolée sur la proposition EMPRISE.
Date de mesure, datum individuel, dévers, limites de course et gabarits restent inconnus.

## Reproduction

```sh
python3 tools/preparer-marseille-voirie.py --check
node --test verifications/marseille-voirie.test.mjs
```

Le préparateur réemploie le validateur de propriétés BD TOPO du lot Monaco, **avec le repère linéaire Marseille archivé**.
Il n'utilise ni la projection ECEF Monaco ni une fonction de hauteur de terrain.
**Dépendance : intégrer 05A (`466afcd`, arbre `836336ed`) avant ce sous-lot.** Les cinq outils lus sont épinglés par empreinte.
Suite : identifier les voies/niveaux correspondants, confirmer les surfaces et limites puis rechercher une fermeture sourcée.
Raccords 00/04 uniquement après données suffisantes ; aucun runtime ou build modifié.

Attributions : © IGN, BD TOPO, Licence Ouverte 2.0 ; © les contributeurs d'OpenStreetMap, ODbL 1.0.
Référence de classe : descriptif officiel BD TOPO 3.5, juillet 2026, sections et URL dans le manifeste.
