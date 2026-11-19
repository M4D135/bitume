# BITUME — reprise courte

## Point publié — 19 novembre 2026

**0.2.56 / p14 publiée sur GitHub par la PR #11.** Main vérifié : `a2b89f5cff2779ec0b7158609c53e18dd607a49e`.
Code testé `edf660e5` (équivalent local `15f03374`) ; réconciliation documentaire finale `253322d3`.
PhysX, sols entièrement procéduraux et pilotes extérieurs animés sont livrés ; virages/reflets et stands conservés.
FERRO 0.3.14 publié (PR #2, main `85ba9417`), 34 modules installés exacts.

Build : 14 162 317 octets ; SHA-256 `d93139352b308a1b5c2b3e60b8a15a52803b254577030d470037fa0838ac2e65`.
Deux constructions identiques, 56 scripts valides. CI complètes du code : **push 122/123 ; PR 121/123**.
Preuves dans `docs/reprise/rapports/PHYSX-SOLS-PILOTES-2026-11-19/` : `PUBLICATION-0256.json`,
`github-0256/RECU-CI.json` et `QUALIFICATION-FINALE.json`. Les 122/123 locaux restent une consolidation distincte.

## Reprise directe — démos cinéma

Lire `docs/reprise/ETAT.json` et `docs/reprise/DEMOS-CINEMA-2026-11-19.md`.
Récupérer la copie avancée `/workspace/scratch/749f331cc09f/bitume-demo`, branche
`codex/bitume-demos-cinema-20261119`, ancienne base `838756b`, avec ses modifications non commitées.
Préparation conservée par les clôtures jusqu’à `293f4fae` : paysages/faune/flore, trajectoires nature mémorisées,
poste fixe des animaux, repli course et pondération progressive du peloton pour corriger les bonds de caméra.
Réconcilier ce travail sur la 0.2.56 publiée, puis qualifier les raccords et transitions.
La copie `/workspace/scratch/2540d1a213f9/bitume-demo` est plus ancienne et ne doit pas écraser l’avancée.
Aucun code de démo n’est intégré à cette livraison ; les anciens journaux 18/7/9 ne valident pas son intégration.
Préserver p14, grille/départ/arrivée, courses continues, sortie sur geste, Faune/qualité et musique au titre seulement.

## Réserves et suite

Signature historique des traces et oracle conservés. Réserve de temps du décor distincte : 486 ms observées sur
la branche parallèle pour 150 ms, sans comparaison contrôlée ; résultat du décor dans les CI : **réussi sur push ; 152 ms pour seuil 150 ms sur PR, réserve conservée**.
Aucun essai navigateur complet, FPS matériel, partie multi-machines ni déploiement sur bitume.estrasse.fr validés.
Les quatre replacements après accident à Haut-Col relèvent de la récupération antérieure ; aucun dans les files testées.
Après les démos : **13B Baïkal**, lac/berges/lieux/saisons, puis demandes conservées de Monaco fidèle, Marseille
avec relief mesuré, grand circuit montagne distinct et six propositions. Huit circuits jouables actuellement.
Spark/Mac/amiga non disponibles ; petits lots, pas de push forcé, reprise courte actualisée après chaque publication.
