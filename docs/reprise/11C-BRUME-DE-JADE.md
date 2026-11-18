# Lot 11C — Brume-de-Jade

## Objectif

Sixième circuit original, Asie montagneuse : pics calcaires asymétriques, vallées en terrasses jade et bosquets clairsemés.
Graine 131, cible 5 000 m. Aucune reprise de tracé externe, aucun asset ni module FERRO modifié.
Préserver les cinq circuits, les quatre saisons (hiver enneigé sauf Port-Sable), conditions de l’hôte et menus manette.

## Checkpoint de travail — 18 novembre 2026

Sources et tests en cours sauvegardés dans `rapports/brume-de-jade-2026-11-18/travail-en-cours.patch`.
Base exacte et fichiers dans `checkpoint.json`. Ce patch n'est pas une version qualifiée du jeu.
La dernière version qualifiée reste 0.2.36. L’arrière de monoplace de cette version doit être conservé.

## Prochaines actions

1. Finir et contrôler les appuis des éperons, tenir obstacles hors chaussée.
2. Vérifier tracé, onze IA sur un tour, quatre saisons et stabilité des collisions entre qualités.
3. Comparer les 20 décors précédents contre la baseline du commit 8d2c784.
4. Recalculer une carte et un aperçu CPU ; WebGL reste non validé, navigateur local et cloud indisponibles pour ce build.
5. Reconstruire deux fois, vérifier FERRO, publier sources et build 0.2.37 ; actualiser cette fiche et le reçu.
6. Déploiement déjà autorisé, à réaliser depuis Mac/amiga avec `./deposer.sh` lorsque l’accès est disponible.

## Rythme de publication demandé

Publier fréquemment les progrès pour survivre à une interruption de session : checkpoint du patch en cours,
puis code/build qualifiés et reçu. Garder un point de reprise court ; un seul circuit dans ce lot.
