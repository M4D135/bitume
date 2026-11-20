# demos-pilotes — préparation conservée

## État

**historique_supplante**. Premier checkpoint des démos et du pilote ; les versions livrées 0.2.66 le remplacent.

Conserver la réalisation et les articulations qualifiées de main. Cette sauvegarde ne constitue pas un candidat à réactiver.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `backup/demos-pilotes-20261120`.
- Commit d’origine : `9d6c47a952422d8ee4a392c06ea66a56d38c589c`.
- Arbre d’origine : `53d99b8e57fef3ccbc2d8d6d396daff8d6b47522`.
- Vraie base commune avec main : `f41614e1f3887a79ebbd633df3fde754534f202e`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 17 chemins dans le delta d’origine ; 0 absents de main au moment de l’inventaire.

## Notice de travail supplanté

Le code actif est supplanté par main. Cette notice évite une copie redondante ; tous les chemins et leurs objets d’origine sont recensés dans `INVENTAIRE.json`. Les preuves historiques propres à cette tête restent dans son historique.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
