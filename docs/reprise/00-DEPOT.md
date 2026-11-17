# Lot 0 : une seule branche principale

Statut : **à faire**. Base de cadrage : `d891fa2`, à revalider avant toute action.

## Demande

L'utilisateur veut tout réunir sur la branche principale, qu'il appelle « master », et n'avoir qu'une branche. La branche par défaut observée s'appelle `main`. Ne pas créer un doublon `master` pour contourner la demande. Indiquer le nom réellement conservé ; un éventuel renommage doit aussi régler la branche par défaut et les références CI.

## Inventaire connu, à actualiser

- `main` : `d891fa24b6a2d00ffd01abb50989b2d9199698ee`.
- `archive/versions-0.2.15-0.2.18` : `247d4445e02129af3c28b242eab9783ca3fb010d`.
- `codex/bitume-reprise4-20261117` : `861c342bee6766f031202ecc7afa0d442d6914fa`.
- `codex/reconciliation-archives-20261117` : `f53c3b40e477bbe25a264b406a8acbd9fd5878e0`.
- `codex/bitume-suite-20261117` et `codex/reprise-bitume-20261117` : `7fab6b77fe37e42369e7a936935ed79c0d8cc5f2`.
- `opencode/titre-zip-signature-20261116` : `9e23cc125bdf3763bb3a515f2afd9cb035ac12e3`.

## Travail borné

Vérifier les ancêtres et les différences de chaque tête avec la principale actuelle. La branche opencode doit être examinée : elle n'est pas réputée fusionnée. Préserver toute modification utile et expliquer les éléments écartés, sans réintroduire une ancienne interface ni une fermeture HTML surnuméraire.

Conserver une sauvegarde de l'historique accessible avant de supprimer une référence non intégrée. Fusionner et tester les différences utiles ; supprimer seulement les branches dont le contenu et l'historique ont été traités. Ne pas supprimer une branche qui a avancé depuis l'inventaire. Ne pas forcer un déplacement de référence.

## Preuves de fin

Liste distante montrant une seule branche ; nom de la branche par défaut ; commit final ; état des PR ; contrôle que les historiques conservés restent accessibles. Vérifier les déclencheurs de qualification si le nom principal change.

Si les outils connectés ne permettent pas la suppression ou le renommage, noter cette limite précisément, laisser les références intactes et passer au lot 1. Ne pas annoncer le nettoyage terminé ni fabriquer une automatisation administrative pour masquer la limite.

## Point de reprise

Aucune branche supprimée dans le lot documentaire. Prochaine action : comparer l'inventaire distant et la branche opencode à la principale actuelle.
