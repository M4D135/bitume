# enligne-etude — préparation conservée

## État

**prototype_a_reprendre**. Étude et prototype de mise en relation pair à pair, relais et signalisation.

Porter sur le réseau actuel et vérifier plusieurs réseaux réels. Conserver le salon existant tant que son remplacement n’est pas qualifié.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `etude/enligne`.
- Commit d’origine : `654e75e684a0b5335035bb7d1f776d1d6ebe9d10`.
- Arbre d’origine : `1d3a70f0b2efefbd1bf94f49d95b93833eb5f525`.
- Vraie base commune avec main : `7033ced25c3265e961003aabcfb4a52e701e90fe`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 26 chemins dans le delta d’origine ; 25 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 26 chemins, 536,554 octets. SHA-256 : `c2300e32dd0f76ced17544bf1f39f0836edbe3acb454bdcccb92cfa79a294e5c`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
