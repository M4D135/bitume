# conduite-etude — préparation conservée

## État

**historique_a_adapter_p15**. Étude chiffrée et premiers prototypes de la conduite historique p9/p10.

Conserver la recherche et les critères ; toute reprise passe par le moteur PhysX et la physique p15 présents. Les anciennes intégrations et fixtures ne sont pas compatibles par défaut.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `conduite/etude`.
- Commit d’origine : `8476c5b10e7ff7561e2d8845f01502cfea3041a8`.
- Arbre d’origine : `c5a67c18a08368742a6ca3bdceca913724dd08c1`.
- Vraie base commune avec main : `09b6f23b15150546a3d2662f3909d6cc60a63aa5`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 35 chemins dans le delta d’origine ; 28 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 31 chemins, 828,866 octets. SHA-256 : `69b2f9baddb6de7a2a60a473c359bc44205f9e1b30e6e5cd8514cd724be69e83`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
