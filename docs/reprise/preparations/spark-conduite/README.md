# spark-conduite — préparation conservée

## État

**historique_a_adapter_p15**. Prototypes prolongés de conduite et de pneus, sur la base physique historique.

Ne pas remplacer PhysX p15, ses fixtures ou la course actuelle. Reprendre les critères et les intentions séparément après revue et mesures.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `spark/conduite`.
- Commit d’origine : `0b6b9f9804aea890e2bc8d7b61df532315683a54`.
- Arbre d’origine : `b22aa722c4857c8b592a19c7d4728e679a182a4a`.
- Vraie base commune avec main : `09b6f23b15150546a3d2662f3909d6cc60a63aa5`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 37 chemins dans le delta d’origine ; 29 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 33 chemins, 836,276 octets. SHA-256 : `e05242aebd9e953de1b5b7b4e695f4de7b545929bb8c8c61ab3f3df1b28ae664`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
