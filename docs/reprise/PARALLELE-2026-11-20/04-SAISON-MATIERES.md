# 04 — Saisons puis matières du terrain

## Prompt à copier

~~~text
Continue BITUME, discussion 04 « Saisons et matières ».
Dépôt : https://github.com/M4D135/bitume
Lis AGENTS.md, REPRISE.md, docs/reprise/PARALLELE-2026-11-20/README.md, 04-SAISON-MATIERES.md et etat/04.json. Retrouve le lot saisons existant sans y mélanger l'audio Troll.
Qualifie les quatre saisons sur les neuf circuits, surtout Route-des-Cimes. Ensuite améliore par petits lots les matières procédurales du terrain, montagnes et abords proches : grain, relief visuel, variations naturelles et transitions. Préserve graines, climat, physique et budgets.
Le décor/saisons t'appartient ; cockpit à 01, shaders FERRO à 02, jeu.js/build à 00. Fournis les raccords et commit/push chaque lot vérifié et ton état. Aucun fichier de texture externe, aucune fusion main.
~~~

## Reprise et étapes

Lire [SAISONS-CATALOGUE](../SAISONS-CATALOGUE-2026-11-20.md) et REPRISES-EXISTANTES.md. Le commit local 91973c6 prépare 11 fichiers saisons ; l'audio ajouté ensuite dans ce worktree appartient à 01.

1. Reprendre couleurs/feuilles/neige déjà corrigées après comparaison avec main. Compléter la matrice **9 circuits × 4 saisons**, générateurs particuliers et espèces. Préserver le climat de Port-Sable ; hiver ne veut pas dire neige uniforme partout.
2. Contrôler graines/identités, positions physiques, caches et coût des arbres d'hiver. Préparer avant départ ; aucune reconstruction tardive inutile en course. Proposer les clés/raccords de préparation à 00/02.
3. Contrôles de matrice et captures représentatives, puis remise à 00. Un test de données ne vaut pas inspection d'image.
4. Après saisons, isoler un défaut terrain/montagnes puis un défaut des abords proches. Détail procédural attaché au monde et filtré au loin, moins de carrés/diagonales/répétitions visibles. Le relief visuel ne change pas silencieusement les collisions.
5. Après accord des budgets : couches proches/asphalte/vibreurs/herbe/gravier/reflets/usure. Besoins shader à 02 et recettes cockpit à 01. Comparer image/coût avant extension.

Propriété : saisons.js, botanique.js, decor.js, bords.js, route-des-cimes-decor.js et éventuel module de matières. 05 ne modifie pas le décor durant cette phase ; les lieux complets/lac/cascade attendent leur transfert explicite.

Tests utiles : saisons-circuits, saisons, botanique, herbier-saisons, nature-integration, nature-preparation et contrôles décor/matières concernés. Vérifier les noms exacts présents et reprendre les outils déjà préparés. Tenir raccordements/04.md et etat/04.json.
