# Qualification — prairies vivantes, 18 novembre 2026

**BITUME 0.2.32, FERRO 0.3.8.** Ces preuves ont été rassemblées sans relancer les tests ni modifier les sources.

## Suites et construction

- **49 suites générales réussies**, sur des sources inchangées pendant leur exécution : `tests-integration-49-summary.json` conserve les empreintes de début et de fin, les codes de sortie et les horaires. Les 49 sorties complètes sont dans `tests-integration-49-logs.zip`.
- `vegetation.js` a ensuite reçu son dernier regroupement spatial. La **suite végétation finale réussit ses 16 contrôles** sur la source finale ; elle était exclue des 49 suites précédentes. Preuves : `vegetation-final.log` et `vegetation-verification.json`.
- Le bilan est donc **50 suites réussies**, avec une qualification séparée de la végétation finale. Ce nombre ne signifie pas que les 50 suites ont été exécutées simultanément sur une seule empreinte de tous les fichiers.
- `prairie-sourcehashes.json` donne les empreintes finales des fichiers du sous-lot ; elles correspondent aux bancs de soumission finaux. `build-candidat.json` et `construction-reproduite.log` documentent le paquet 0.2.32 construit et reproduit. `build-final-verification.json` confirme les empreintes du paquet final, son blob, le lien Enregistrer et les groupes de moments de la journée.

## Mesures à lire

`prairie-rapport.md` est la synthèse. `vegetation-verification.json` fournit les résultats détaillés et `densites-final.json` les quinze combinaisons biome/densité.

Les minima locaux finaux **×14,87 forêt, ×14,71 côte, ×14,18 montagne** proviennent de `vegetation-verification.json`, champs `syntheseMAX[].minimumFacteurLocal` et `tests.mesures.<biome>.ultra.disques`. Ils comparent les racines réellement construites dans **28 disques fixes de rayon 2 m**, aux mêmes positions que dans la 0.2.31. `densite-locale-031.json` conserve cette référence ; aucun relevé MAX intermédiaire n’est inclus. Les minima ne sont pas déduits de l’extension de la surface totale.

`empreinte-racines-031-max.png` compare les positions réelles des racines sur la même fenêtre de sol. Cette carte est un diagnostic géométrique, **pas une capture du jeu**.

Les fichiers `soumission-031-high.json` et `soumission-031-ultra.json` sont les références. `soumission-032-medium.json`, `soumission-032-high.json` et `soumission-032-ultra.json` sont les bancs finaux, dont les empreintes de végétation et de décor correspondent aux sources gelées.

## Limites

Les totaux de brins ne sont pas des brins simultanément visibles. Le banc WebGL inerte mesure les appels, les triangles soumis et le travail CPU ; les triangles éteints ensuite dans le shader restent comptés. Il n’exécute pas la rasterisation GPU et **ne qualifie aucun FPS matériel ni l’image finale dans un navigateur**. Le MAX reste manuel et coûteux : environ 34 à 35 millions de triangles d’herbe soumis, couleur et ombre réunies, dans les trois vues du banc final. La RAM du processus instrumenté ne constitue pas une mesure de VRAM ou de mémoire finale du navigateur.

`inventaire.json` recense les fichiers du dossier, leurs tailles et leurs SHA-256 (hors inventaire lui-même). Aucun fichier graphique de ce dossier n’est un asset du jeu.
