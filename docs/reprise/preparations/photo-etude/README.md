# photo-etude — préparation conservée

## État

**etude_documentaire**. Étude de lumière, ombres, reflets et paliers graphiques, avec scripts et maquettes dans les rapports.

Aucun module runtime n’est modifié par cette branche. Reprendre les idées utiles via le FERRO canonique, avec mesures et preuves visuelles actuelles.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `etude/photo`.
- Commit d’origine : `53048015dc94621ae24a3a7e251867a1b4fb1e0b`.
- Arbre d’origine : `d123ae93f66bc89df6374a696ef06a2678b377c2`.
- Vraie base commune avec main : `8bd3d86a4b1635ad2dd90c5ae8a585711aa196f8`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 77 chemins dans le delta d’origine ; 77 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 46 chemins, 127,580 octets. SHA-256 : `1847387e17b785fb67c9418c1a302e702fd4ab848142266ed5b4c46f2d2318a8`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
