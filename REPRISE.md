# BITUME — reprise courte

## Point actif — 19 novembre 2026

**0.2.53 / p13 publiée et vérifiée sur main**, livraison `b791ae60`.
**PR n°7 fusionnée ; lot 13A tracé et relief terminé.**
Sources, jeu compilé et preuves correspondent à la tête revue `b1eabdff`.
Lire `docs/reprise/ETAT.json`, la dernière entrée du suivi et `docs/reprise/13A-RUSSIE-TRACE-RELIEF.md` uniquement.
**Lot actif : repères de virage, annonces réglables et reflets des flaques**, demandé ensuite par David.
Lire `docs/reprise/VIRAGES-REFLETS-2026-11-19.md`. Branche `codex/bitume-reperes-annonces-reflets-20261119`, base `f03a99cc`.
Les tests de 13A sont terminés : ne pas recommencer sa qualification ou les lots 12A–12F4/Safari clos.

## Résultat de 13A

Huit circuits dans le build, Baïkal ajouté index 7, ID `baikal`, graine 179 : **5 424 m**, **62,9477 m de dénivelé**,
**6,8 %** de pente maximale, droite de 816 m, grille/stands plats. Baïkal est un choix de conception original issu du plan.
Les 84 tableaux des sept circuits historiques et les 22 scénarios / 1 415 empreintes p13 sont identiques, sans régénération.
**9/9 contrôles russes** : douze voitures font trois tours sur sec/pluie/neige sans accident, replacement ni blocage.
Les contacts et frottements sont comptés. Les allées de troncs proches ont été écartées des courbes descendantes.

## Qualification et build

**107/109 suites** : traces héritées identiques et seuil de temps décor dépassé aussi sur la base (205 ms / 211 ms,
seuil 150 ms inchangé). Aucune qualification entièrement verte ni différence de performance annoncée.
Deux builds identiques de **14 063 125 octets**, SHA-256
`686db2c0863bd8dfa042389f22501fb9bacde19dca2bb1dcabf9f9a527ccd510`.
53 scripts valides, 34 modules FERRO 0.3.11 inchangés. Rapport canonique :
`docs/reprise/rapports/13A-RUSSIE-2026-11-19/qualification-finale.json`.

Reçu de livraison : `docs/reprise/rapports/13A-RUSSIE-2026-11-19/PUBLICATION-0253.json`.
Les deux CI du code sont terminées : **108/109 chacune**, seules traces héritées identiques ; décor réussi en CI.
Reçu : `docs/reprise/rapports/13A-RUSSIE-2026-11-19/github/RECU-CI.json`. Cette vérification est close.

## Suite

Après le lot virages/reflets : **13B Russie — décor et saisons, NON COMMENCÉ**. Le thème de base permet le roulage ; lac,
berges, lieux, végétation/faune détaillés et validation visuelle restent à faire. Le tracé et sa graine sont figés.
Conserver Monaco fidèle, Marseille depuis EMPRISE avec relief mesuré, nouveau grand circuit montagne distinct
et six propositions. L’indice 7 russe n’annule pas la demande montagne.

Spark (`~/bin/kbza`), Mac et amiga indisponibles. WebGL, FPS matériel et déploiement non validés.
Un sous-lot à la fois, publications fréquentes, aucun push forcé ; correction des reflets dans FERRO canonique avant propagation.
