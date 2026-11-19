# Démos — paysages, nature et course

## Demande du 19 novembre 2026

David souhaite que la démo montre les environnements des circuits, leur faune et leur flore, avec de beaux plans
inspirés des retransmissions F1 et l'énergie de l'introduction de Daytona USA sur borne d'arcade.

## Réalisation prévue

- Ouvrir chaque circuit par une découverte lisible de son relief et de ses lieux, avec des mouvements de caméra
  amples et progressifs ; conserver la grille et le départ en course.
- Alterner les plans de course (passage au ras du sol, travelling, poursuite, peloton, détails du pilote) avec des
  respirations sur le paysage, la végétation et des animaux effectivement présents et animés dans la scène.
- Cadrages propres au tracé et aux points d'intérêt existants, respect du terrain, des obstacles et des tunnels.
- Montage déterministe avec durées maîtrisées, retour à l'action et protection de l'arrivée ; pas d'ajout d'asset,
  de vidéo, d'image, de musique ni d'appel réseau pendant la démo.
- Préserver la qualité choisie, Faune désactivée, l'écran partagé hors démo, la conduite p14 et les enchaînements
  de circuits. Préparer les ancrages au chargement et ne pas reconstruire le décor pendant les plans.

## Ordre et validation

Chantier suivant le lot PhysX/sols/pilotes, dans un travail isolé jusqu'à sa clôture. Contrôles de montage,
déterminisme, caméras finies/au-dessus du sol et présence réelle des sujets ; validation visuelle quand le rendu
est accessible, sans confondre un contrôle numérique et une appréciation visuelle.
13B Baïkal et les autres circuits demandés restent prévus après ce lot.


## Reprise après publication 0.2.55

Base publiée : PR #9, main `1e4579c5`, p14. Copie préparée la plus avancée :
`/workspace/scratch/749f331cc09f/bitume-demo`, branche `codex/bitume-demos-cinema-20261119`, base ancienne `838756b`.
Travail non commité : `construire.py`, `src/jeu.js`, `src/realisateur.js`, nouveaux `src/cinema.js` et
`verifications/cinema.test.mjs`, journaux dans `docs/reprise/rapports/DEMOS-CINEMA-2026-11-19/`.

Le bond quand un arbre quitte le champ a un correctif préparé : trajectoires nature prévalidées et mémorisées,
poste fixe pour les animaux, repli vers un plan de course et pondération progressive du peloton.
Les journaux préexistants annoncent 18 contrôles cinéma, 7 réalisateur et 9 chargement ; ils n'ont pas été
relancés à cette reprise et ne qualifient pas une intégration sur 0.2.55. Récupérer ce travail sur la base publiée,
réconcilier les trois fichiers modifiés, puis qualifier raccords, transitions et cadrages. Ne pas écraser la copie
avancée avec `/workspace/scratch/2540d1a213f9/bitume-demo`, plus ancienne et différente.

La PR #11 / **0.2.56** est désormais fusionnée : main `a2b89f5cff2779ec0b7158609c53e18dd607a49e`.
Retenir cette version publiée, avec PhysX et les raccords finaux de `src/jeu.js`, comme base des démos.
Ses CI du code donnent 122/123 et 121/123 (traces héritées et réserve de temps du décor), avec build identique.
Preuves : `rapports/PHYSX-SOLS-PILOTES-2026-11-19/PUBLICATION-0256.json` et `github-0256/RECU-CI.json`.
La qualification 0.2.55 ne remplace pas ces preuves ; les anciens journaux de la préparation démos restent
à reprendre après réconciliation de ses trois fichiers partagés.
