# procedural-etude — préparation conservée

## État

**etude_documents_et_outils**. Étude des reliefs et du détail procédural, outils de profil et prototype de relief.

Pas de source runtime src/ dans ce delta ; les outils et intentions restent à adapter aux circuits et à PhysX actuels.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `etude/procedural`.
- Commit d’origine : `dad93266dc6c82d6c1b49b86d61274f0c86c5134`.
- Arbre d’origine : `787e0188c8cac291739b2e3098f908926f433073`.
- Vraie base commune avec main : `e96eeafe8f53b1c0761bd083b89d6312e8eda03f`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 73 chemins dans le delta d’origine ; 73 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 19 chemins, 586,589 octets. SHA-256 : `bfa4c9275ffa1bba3557d97a2c5e81a5c99b31f8dd1445b45ff0f08fbc76fe2d`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
