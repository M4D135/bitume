# spark-calcul — préparation conservée

## État

**prototype_a_reprendre**. Prototype de cache-niveau avec format binaire et tests, non branché dans le runtime actuel.

Vérifier invalidation, versionnement, intégrité, quotas et repli avant intégration ; mesurer le bénéfice réel.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `spark/calcul`.
- Commit d’origine : `807ae77b9d556f4feb34c0455ac4c12095e3bce9`.
- Arbre d’origine : `3d5acf82aeb23608bd092da14ca22d1f577cfdd6`.
- Vraie base commune avec main : `b1ed8e49309d2cdaa43e37ca8329205526eb919d`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 3 chemins dans le delta d’origine ; 2 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 3 chemins, 8,049 octets. SHA-256 : `b181643f33cf93aa2aabfb8f8f60b076d3380e926f99b791ab2ff93b740faccd`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
