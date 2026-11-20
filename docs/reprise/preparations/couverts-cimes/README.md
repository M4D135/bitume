# couverts-cimes — préparation conservée

## État

**historique_supplante_avec_preuves**. Étape antérieure de portails et qualification Cimes, reprise dans la livraison unifiée.

Conserver la géométrie et les tests actuellement qualifiés. Les preuves de cette étape restent récupérables dans leur commit d’origine, sans remplacer les reçus 0.2.66.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `feat/bitume-couverts-cimes-20261120`.
- Commit d’origine : `6c83902378e923c13683ce853428bc38b879d551`.
- Arbre d’origine : `1c8c1d9afa09c4f231c84e4fd99d12d49ee26861`.
- Vraie base commune avec main : `9459baa8926a5989d25138af51da5e0ea41be81f`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 15 chemins dans le delta d’origine ; 4 absents de main au moment de l’inventaire.

## Notice de travail supplanté

Le code actif est supplanté par main. Cette notice évite une copie redondante ; tous les chemins et leurs objets d’origine sont recensés dans `INVENTAIRE.json`. Les preuves historiques propres à cette tête restent dans son historique.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
