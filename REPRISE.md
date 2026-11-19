# BITUME — reprise courte

## Point actif — 19 novembre 2026

**PhysX réel pour les voitures, sols procéduraux et pilotes animés : implémentation en cours.**
Lire `docs/reprise/ETAT.json` et `docs/reprise/PHYSX-SOLS-PILOTES-2026-11-19.md`.
Base `10f71ff1` (0.2.54/p13), branche `codex/bitume-physx-sols-pilotes-20261119`.
La nouvelle conduite sera p14. Le build 0.2.54 existant ne contient pas encore ces changements.

## Demandes et constat

- Voitures sous le sol, collisions manquantes : PhysX ne porte encore que les débris. Passer aux corps dynamiques,
  forces et inerties réelles, quatre suspensions, sol exact et solides de la scène ; aucun pilotage de pose par pas.
- Sols hors route : grain/herbe/relief apparent entièrement procédural, sans image ni texture importée.
- Pilotes extérieurs : tête, bras, direction et changements de rapport doivent bouger comme au cockpit.

## Livraison précédente

Virages/reflets 0.2.54 publiée sur main `c2880297`, PR #8 fusionnée.
Build 14 089 230 octets, SHA-256 `db24f69a55bd6ac6778009e9511dbb901f82e62628adfbaab8e11980a467d3a3`.
Canon FERRO `a22b738f`, clôture et CI conservées depuis main. La nouvelle physique n'est pas encore dans le build.
Checkpoint local de reprise `14b8ace` ; limiteur des stands converti en forces, pilote 375 poses/3 LOD contrôlé.
Reste : essais dynamiques conservés 8 circuits/tunnels, nettoyage caches PhysX, shader WebGPU,
propagation canonique, qualification complète et deux builds reproductibles.

## Suite conservée

13B Baïkal — lac, berges, lieux, végétation/faune et saisons — reste prévu après ce chantier.
Conserver Monaco fidèle, Marseille avec relief mesuré, grand circuit montagne distinct et six propositions.
Spark/Mac/amiga non disponibles. Pas de FPS matériels ni de déploiement validés. Publier par petits lots,
sans push forcé, corriger le canon FERRO avant de propager et conserver une reprise courte.
