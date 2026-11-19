# 12D — usure visible par roue

## Point de départ

19 novembre 2026 : reprise depuis `71354f05e59dcfcbc98cabc0a690f86d5a8419b4`, publié et vérifié sur `main`.
Jeu 0.2.45, FERRO 0.3.11, physique p9. Le tree local récupéré correspond exactement au tree GitHub
`06fbb90ba53daabb148ff6dc6b7ab890ead0dc7a`. Le lot 12ABC est publié, avec sa réserve WebGL inchangée.

## Périmètre unique

- Reprendre le brouillon `usure-pneus.js` sauvegardé, relire ses règles et intégrer une évolution au pas fixe.
- Quatre états indépendants AVG, AVD, ARG, ARD : usure, saleté réversible, grainage, distance et sollicitation.
- Roulage, charge et glisse commandent l'abrasion ; aucune progression en pause, au repos sans patinage,
  en saut, en récupération ou sur une roue sans contact. Marche arrière cohérente.
- Montrer une bande progressivement polie et marquée, puis les traces d'abrasion et la saleté dans le
  repère de chaque roue. Le slick reste sans rainures ; les sculptures s'atténuent sans changer le diamètre.
- Conserver l'usure lors d'un replacement et d'un changement de caméra. Aucune adhérence nouvelle.

Le service réel, l'interface et les instantanés réseau appartiennent à 12F. Les voitures distantes ne doivent
pas accumuler une deuxième usure à partir des positions interpolées. La neige reste indisponible avant 12E.

## Validation bornée

Module pur (déterminisme, repos, contact, nettoyage, valeurs bornées), branchement dans la simulation,
géométrie/permanence des objets et contrôles ciblés voiture/pneus/conduite/stands. Comparaison p9 avec la
base publiée ; build reproductible et verrou FERRO. Distinguer aperçu CPU, WebGL réel et performances.
Les deux échecs hérités de 0.2.45 restent documentés ; ne pas changer leurs fixtures pour les masquer.

## Reprise

Un intégrateur pour le branchement et le rendu ; relecture/module dans des fichiers disjoints.
Spark indisponible dans cet environnement (pas de kbza, de Mac ni de configuration SSH).
Checkpoint documentaire, puis sources/build qualifiés, reçu GitHub et prochaine action à chaque jalon.
Journal : `SUIVI-2026-11-19.md`. Résultats : `rapports/12D-2026-11-19/`.

## Clôture technique — 19 novembre 2026

Implémenté dans la 0.2.46. Qualification et récupération : `rapports/12D-2026-11-19/`.
91/93 suites, deux échecs hérités, p9 identique ; réserve WebGL. Publication et reçu dans le suivi actif.
Prochain lot : 12E chaussée/adhérence ; 12F garde service, interface détaillée et synchronisation.
