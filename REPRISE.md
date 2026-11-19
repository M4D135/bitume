# BITUME — reprise courte

## Point actif — 19 novembre 2026

**0.2.56 / p14 : PhysX, sols procéduraux et pilotes animés qualifiés ; publication finale à terminer.**
Lire `docs/reprise/ETAT.json` et `docs/reprise/PHYSX-SOLS-PILOTES-2026-11-19.md`.
Checkpoint qualifié `62c9461`, fusions réelles des branches concurrentes `6e9c1ea0` puis `b8f05074` ; main de départ `c2880297`.
La PR #9 a entre-temps publié le checkpoint parallèle 0.2.55 sur main `1e4579c5`, arbre identique à `b8f05074`.
Ses clôtures documentaires jusqu’à `293f4fae` sont intégrées, avec les reçus et CI 0.2.55.
Publier 0.2.56 sur `codex/bitume-physx-sols-pilotes-20261119-qualifie`, en préservant ce main.

## Livré dans le build

- Voitures dynamiques PhysX : masse, inertie, quatre suspensions, forces de pneus par roue, CCD, sol et obstacles
  issus de la scène. Débris dans le même monde. Réseau 3D, transfert d’autorité et libération des séances couverts.
- File des stands : dégagement sans contact ni replacement ; limiteur par accélérateur/frein. Monte neuve seulement
  après service complet. Repères/annonces des virages et correction des reflets 0.2.54 conservés.
- Sols hors route : grain rugueux et microrelief d’herbe calculés par shader, sans image importée.
- Pilotes extérieurs : tête, bras, volant et main au levier ; phase de rapport commune au cockpit et aux rétroviseurs.

## Preuves et réserves

122/123 suites consolidées : balayage initial 118, cinq ajouts et reprises ciblées, pas un passage intégral
sur la révision finale. Seul échec restant : signature historique de `traces.test.mjs`, oracle inchangé.
Deux processus natifs donnent 54/54 empreintes p14 identiques. Deux builds identiques, 56 scripts valides,
14 162 317 octets, SHA-256 `d93139352b308a1b5c2b3e60b8a15a52803b254577030d470037fa0838ac2e65`.
FERRO 0.3.14 publié (PR #2, main `85ba9417`), 34 modules exacts ; 210 réussis / 0 échec / 1 TODO hérité.
Les douze reprises après le correctif WebIDL passent, 234 fichiers de sources/tests stables ; fixture p14 inchangée.
Rapport : `docs/reprise/rapports/PHYSX-SOLS-PILOTES-2026-11-19/QUALIFICATION-FINALE.json`.

Les captures sont des rendus réels EGL/llvmpipe, pas des essais navigateur complets. Aucun FPS matériel,
essai multi-machines ni déploiement sur bitume.estrasse.fr validé. Les courses natives incluent 4 replacements
après accident à Haut-Col (règle antérieure), aucun dans les scénarios de file bloquée.
CI de la tête `edf660e5` terminées : push 122/123 (traces héritées), PR 121/123 (mêmes traces et décor 152 ms/150 ms).
Leur code/build est inchangé par la réconciliation documentaire ; fusion PR11 et reçu final à consigner.

## Suite conservée

Démos cinématographiques avec paysages, faune et flore : `docs/reprise/DEMOS-CINEMA-2026-11-19.md`,
lot suivant, non intégré ici. La fiche conserve la copie préparée ailleurs et son correctif de caméra : les
réconcilier sur 0.2.56 avant de poursuivre. Ensuite 13B Baïkal (lac, berges, lieux, saisons).
Monaco fidèle, Marseille avec relief mesuré, grand circuit montagne distinct et six propositions restent prévus.
Spark/Mac/amiga non disponibles. Publier par petits lots, sans push forcé, conserver une reprise courte.
