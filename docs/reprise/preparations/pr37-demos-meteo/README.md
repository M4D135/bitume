# pr37-demos-meteo — préparation conservée

## État

**historique_supplante_avec_preuves**. Dernier état de la PR #37, basé sur la livraison antérieure 0.2.65 ; dix reçus historiques sont propres à cette tête.

Conserver runtime, version et build 0.2.66. Le seuil poursuite inférieur à 0,1 et les fixtures acceptant zéro dépôt d’embruns sont supplantés ; les contrôles compatibles et les dix reçus font l’objet d’une réconciliation séparée.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `feat/bitume-0263-demos-meteo-20261120`.
- Commit d’origine : `e12420c7db914fa82d420cbbde75d763dea78668`.
- Arbre d’origine : `b556ef01a388284a96fd990c6d6f4ad7e51a0093`.
- Vraie base commune avec main : `80aa1e2913a93b54daf68bd1c3dc6abb520dc69b`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 20 chemins dans le delta d’origine ; 10 absents de main au moment de l’inventaire.

## Notice de travail supplanté

Le code actif est supplanté par main. Cette notice évite une copie redondante ; tous les chemins et leurs objets d’origine sont recensés dans `INVENTAIRE.json`. Les preuves historiques propres à cette tête restent dans son historique.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
