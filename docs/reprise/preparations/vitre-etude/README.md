# vitre-etude — préparation conservée

## État

**etude_documents_et_tests**. Étude historique de pluie et neige sur la vitre, bancs, scènes et premier test.

Les optiques et le sillage livrés ont évolué depuis cette étude. Préserver les cas et observations sans restaurer les anciens oracles.

Cette archive ne change ni le runtime, ni le build, ni les tests actifs de BITUME 0.2.66.

## Provenance

- Branche d’origine : `etude/vitre`.
- Commit d’origine : `9e29337b280f6481689fa410b443a189fea74b86`.
- Arbre d’origine : `f1246d63da9a2f79dd01f4f0355b7ed48e9684c3`.
- Vraie base commune avec main : `eb494c1b8315c19a53e0cdfd938eb537a88a7b28`.
- Main observé : `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
- 28 chemins dans le delta d’origine ; 28 absents de main au moment de l’inventaire.

## Delta de source et d’étude archivé

`delta-source.patch` contient 11 chemins, 1,376,124 octets. SHA-256 : `fa68f69a09d5f5a576d44315c05bb6061284e5c6232b88406a4da690a0dc9953`.

Il est produit depuis la vraie base commune, avec `git diff --binary --full-index --no-renames`, et ne doit pas être appliqué directement à main. Sa réapplication sur la base a été vérifiée dans un index temporaire : mêmes objets et modes pour chaque chemin sélectionné, aucun autre changement.

`INVENTAIRE.json` distingue les chemins copiés dans le patch de ceux préservés par leur objet Git :
contenus déjà identiques sur main, captures et graphes générés, builds ou journaux historiques.
Chaque objet est identifié par son SHA Git, son mode et sa taille lorsque disponible. Ces exclusions évitent les duplications ;
elles ne suppriment aucun contenu d’origine.

La consolidation finale doit conserver ce commit d’origine dans ses parents ou ancêtres, comme indiqué
dans `../MANIFESTE.json`. Cette condition est à vérifier avant tout retrait de référence secondaire.
Une fois l’historique conservé, `git show COMMIT:CHEMIN` restitue un fichier d’origine à partir des valeurs de l’inventaire.
