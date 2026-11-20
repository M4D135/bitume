# pluie-abris — préparation conservée

## État

**preparation_active_non_qualifiee**. Prototype de pluie extérieure visible depuis un abri, avec occlusion spatiale PhysX.

Reprendre les mesures CPU et le compositing raster avant intégration. Le prototype est sauvegardé ; il n’est pas activé dans le jeu 0.2.66.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `backup/pluie-abris-20261120`.
- Commit d’origine : `d3bd240a1bfa02ac1e0dbcc8f5c4cdb3b7176531`.
- Arbre d’origine : `65442e902e38ae0e93d80698c8c262ae198422cf`.
- Vraie base commune avec main : `1c1ac0c9e190368a02101263ddceb6be0b77240d`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 3 chemins dans le delta d’origine ; 1 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 3 chemins, 19,430 octets. SHA-256 : `505758f3cdb1c09d903c5d31cd2327358a8b997d3e5ef34133ceace90b2804a0`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
