# PhysX, sols procéduraux et pilote extérieur

## Objectif demandé

Éliminer les traversées du sol et les obstacles sans contact. PhysX doit intégrer les voitures avec leur masse,
inertie, gravité, suspension et forces de pneus. Rendre les sols hors route plus détaillés par le calcul seul,
et animer tête/bras/levier des pilotes vus de l'extérieur.

## Base et répartition

Base exacte 0.2.54 : `10f71ff1ad6c9ae5ae26fbe761c8bfa7332c3c30`, PR #8.
Branche de travail : `codex/bitume-physx-sols-pilotes-20261119`.
La clôture documentaire de #8 est traitée séparément ; production et build de cette base identiques à `dc8a1c9`.

- Canon FERRO : extension de l'adaptateur PhysX et shader procédural, puis verrou et installation officielle.
- Hôte : sol et obstacles depuis la scène réelle ; voitures dynamiques, quatre suspensions, forces de pneus.
- Pilote : animation extérieure, données partagées de direction et passage des rapports.
- Version physique cible p14. Ne pas annoncer le lot qualifié tant que les scénarios réels WASM ne passent pas.

## Constats reproductibles

PhysX 5.12.0 est réellement embarqué, mais n'intègre actuellement que les débris. La conduite impose une hauteur
au seul centre et les sauts suivent une parabole indépendante de la route rencontrée. Les lisses sont simulées
par une limite latérale, pas par des solides de scène ; le dessus du sol du tunnel est 4 cm plus haut que la route.
Le diagnostic détaillé est conservé dans le sous-dossier de rapports de ce lot.

## Qualification nécessaire

Vrai runtime PhysX : repos en pente et dévers, saut sur montée, freinage et marche arrière, route/accotements/tunnel,
voiture contre voiture et petits obstacles à vitesse élevée, masse/inertie/impulsions, libération des scènes.
Courses et stands : reprendre les scénarios ciblés affectés, dont sortie de file bloquée sans contact ni replacement.
Rendu : preuves shader réel des sols, bras/tête/rapport à plusieurs phases et niveaux de détail.
Deux builds reproductibles, modules verrouillés exacts ; distinguer logiciels de contrôle et GPU matériel absent.

Spark/Mac/amiga non disponibles ; aucun déploiement du site n'est revendiqué. 13B et les nouveaux circuits restent prévus.


## Clôture de qualification — 0.2.55 / p14

Qualification complète terminée : 117/119 suites, réserves décor et traces explicitement conservées.
Les 235 sources/tests/builds contrôlés sont identiques avant/après. Deux builds identiques, 34 modules du canon
FERRO 0.3.14 fusionné `85ba9417`. Les références p14 utilisent désormais le vrai WASM ; les références historiques
ne sont pas présentées comme preuve de la nouvelle physique. Voir `rapports/PHYSX-SOLS-PILOTES-2026-11-19/livraison/VALIDATION.md`.
Publication terminée : PR #9 fusionnée sur main au commit `1e4579c5`, arbre identique au snapshot qualifié.
CI branche/PR : 118/119, traces héritées. Après fusion : 117/119, mêmes traces et Val-Brûlé 163 ms / 150 ms.
La réserve de durée du décor reste conservée ; aucun nouvel échec distinct.
ZIP CI récupéré et vérifié, même build. Reçu `rapports/PHYSX-SOLS-PILOTES-2026-11-19/PUBLICATION-0255.json`.
Aucun test ni build local relancé pour la publication ; aucune validation matérielle ni mise en ligne revendiquée.
