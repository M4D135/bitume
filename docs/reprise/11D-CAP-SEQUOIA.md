# Lot 11D — Cap-Séquoia et réglages

## Travail en cours — 18 novembre 2026

Septième circuit original : `cap-sequoia`, index 6, thème `pacifique`, graine 157, cible 5 200 m et longueur réelle 5 234 m.
Côte rocheuse du Pacifique aux États-Unis, trois caps irréguliers, anses, océan bas et 320 grands conifères en bosquets.
Le terrain porte les falaises et les clairières ; aucun brin supplémentaire, aucun village ni asset importé.
Les grands troncs restent présents dans le modèle lointain. Les quatre saisons sont prises en charge ; Port-Sable conserve son exception sans neige.

Demandes ajoutées pendant la reprise :
- Afficher les FPS pendant la démo, sur ordinateur et tactile, en bas à gauche.
- Remplacer « Insectes et lucioles » par « Faune » dans les réglages et accorder les niveaux de densité.

## Vérifications et limites

Les contrôles ciblés initiaux passent : 9 critères Pacifique, 29 pré-départs réseau ; onze rivaux terminent un tour avec les vrais obstacles, contacts et dégâts.
La qualification globale et la vérification du détail lointain restent en cours au moment de ce checkpoint.
Le navigateur local ne démarre pas (`socket(): Operation not permitted`) ; aucune validation WebGL ni mesure FPS matérielle annoncée.
Aucune configuration SSH ni agent SSH pour Mac/amiga : déploiement autorisé mais non effectué.

## Reprise

`rapports/cap-sequoia-2026-11-18/checkpoint.json` décrit les sources sauvegardées ; `travail-en-cours.patch` conserve le vrai code et les tests.
Ce checkpoint ne remplace pas encore le jeu 0.2.37 publié. Finir les contrôles, reconstruire deux fois, publier code/build qualifiés sur `main` sans force, puis enregistrer le reçu.
Conserver les six circuits antérieurs, le correctif arrière de monoplace, les conditions de l’hôte, les menus manette et le lien de téléchargement m4d135.
