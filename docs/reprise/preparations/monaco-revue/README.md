# monaco-revue — préparation conservée

## État

**historique_supplante**. Ancienne revue cartographique Monaco ; ses douze chemins sont déjà présents dans main.

Les deux fichiers revue-chaussee et leur générateur sont identiques. Les neuf autres fichiers ont évolué : ne pas réimporter des documents ou tests anciens sur la seule base d’une comparaison de blobs.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `feat/monaco-revue-mesures-20261120`.
- Commit d’origine : `c6d6fe6e5367a65fbe9c71fef31ce11688bc4912`.
- Arbre d’origine : `29baa5d9f877945e22eaaf40a4a478dfe7151b46`.
- Vraie base commune avec main : `560646cf48fe85befafa80c1cf07cfd29e58fe0c`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 12 chemins dans le delta d’origine ; 0 absents de main au moment de l’inventaire.

## Notice de travail supplanté

Le code actif est supplanté par main. Cette notice évite une copie redondante ; tous les chemins et leurs objets d’origine sont recensés dans `INVENTAIRE.json`. Les preuves historiques propres à cette tête restent dans son historique.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
