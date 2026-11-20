# spark-circuits — préparation conservée

## État

**historique_a_adapter_p15**. Prototypes prolongés de lieux, relief et bords de circuits, avec outils et tests.

Porter les idées utiles vers p15 sans écraser les circuits livrés. Ce delta partage une partie de ses études avec circuits/lot22 ; les deux têtes sont préservées.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `spark/circuits`.
- Commit d’origine : `5d3ea96737a553f71d7b7690a804c07c08475433`.
- Arbre d’origine : `09057da0bd2fc2b9a1aa2dfa9143c36e397ae119`.
- Vraie base commune avec main : `09b6f23b15150546a3d2662f3909d6cc60a63aa5`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 182 chemins dans le delta d’origine ; 106 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 52 chemins, 969,847 octets. SHA-256 : `8cb3bb35cfb8efb448b7c2299d700442de6b2b22fc9aecc51c9d68ce588f5fb5`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
