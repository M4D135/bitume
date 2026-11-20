# circuits-lot22 — préparation conservée

## État

**historique_a_adapter_p15**. Études et prototypes de relief, bords, lieux et Route-des-Cimes, préparés avant le port PhysX actuel.

Garder les intentions de tracé et les outils utiles ; adapter explicitement à p15. Ne pas remplacer les couverts et la géométrie Cimes qualifiés de main.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `circuits/lot22`.
- Commit d’origine : `10fbad842fc8b86e36891963a30d656a83a94155`.
- Arbre d’origine : `a764210916f5c3aec3f1ba6724c84318d66b1b50`.
- Vraie base commune avec main : `09b6f23b15150546a3d2662f3909d6cc60a63aa5`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 176 chemins dans le delta d’origine ; 100 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 46 chemins, 937,982 octets. SHA-256 : `9dbc1b6527bf38f2fdc3af76b659e10baa3bb026f25b5e88bc48a83799f2c948`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
