# Cockpit et pilotes extérieurs — 19 novembre 2026

## Demandes de David

- Les animations du pilote conviennent ; conserver les mouvements de tête et de bras.
- En vue extérieure, le levier de vitesses traverse le cockpit, sur le joueur comme sur les concurrents.
- Le volant est également trop près du pilote dans cette vue.
- Consigner les demandes, corrections, vérifications et la reprise dans GitHub.

## Diagnostic et périmètre

Le placement extérieur transpose uniformément des coordonnées conçues pour le cadrage intérieur.
Le pied du levier tombe dans la coque, et le volant manque de recul par rapport au buste.
Le contrôle des triangles doit aussi couvrir le saute-vent et le trajet de la main au levier.
Corriger l'aménagement extérieur et sa cinématique, conserver le cadrage intérieur et les animations.
Joueur, concurrents, niveaux de détail et rétroviseurs utilisent les mêmes poses corrigées.
La conduite p14 et les modules FERRO ne font pas partie de ce correctif visuel.

## État au démarrage

Base de travail : candidat 0.2.57, commit local `da99e13`, construit deux fois à l'identique.
Sa qualification ciblée reste distincte : 7/7 suites, 135 contrôles.
Sa publication est reprise sur `codex/bitume-demos-regard-arriere-20261119` ; CI complète à constater.
Le correctif cockpit forme le lot suivant, sur `codex/bitume-cockpit-exterieur-20261119`.

## Correctif 0.2.58

- Volant extérieur avancé de 10 cm : le jeu longitudinal minimal entre la jante et le buste rendu passe
  de 6,904 cm à 16,904 cm dans les cinq braquages contrôlés.
- Levier recentré dans la cellule ; tige et pommeau partagent le nouvel ancrage. La main droite et son
  poignet suivent la même correction, pondérée sur toute la courbe d'aller et de retour au levier.
- Saute-vent extérieur adapté au poste animé pour dégager la jante et les mains ; coudes relevés pour
  préserver le passage au-dessus du bord. La coque et les pièces restent visibles.
- La coque simplifiée conserve une véritable ouverture : son ancien dessus plein traversait le gant gauche
  et l’avant-bras malgré la correction du modèle détaillé. Le contrôle utilise les formes visibles à chaque niveau.
- Les mêmes articulations servent au joueur, aux concurrents, aux niveaux de détail et aux vues secondaires.
  Les objets et vecteurs sont réutilisés ; le calcul du pilote ne fait pas avancer la simulation.
- La vue intérieure, la conduite p14, PhysX, les pneus, le réseau et FERRO 0.3.14 sont conservés.

## Qualification ciblée terminée

Six suites ciblées réussies : géométrie habitacle (4), puis cinq suites adjacentes : pilote extérieur (14 contrôles), voiture (33), objets permanents (12),
identité (6, dont 134 groupes par configuration) et registre des formes libres.
Le contrôle géométrique balaie 840 poses détaillées : braquages, montée et descente des rapports,
point mort et marche arrière. Le test retrouve le défaut sur la source 0.2.57. La vérification finale des
maillages réellement dessinés dans chaque niveau de détail réussit également : 150 poses supplémentaires
pour joueur/rival, trois niveaux, cinq braquages et cinq phases, avec une attitude composée.

Inspection logicielle de trois angles pour trois poses (mains au volant, prise du levier, transition
avec braquage maximal) : aucun chevauchement apparent des commandes avec la coque. Ce rendu utilise
les triangles du jeu sans ses shaders ; il ne vaut pas une validation du jeu complet dans un navigateur
ni une mesure des FPS matériels.

Deux constructions 0.2.58 identiques : **14 185 661 octets**, SHA-256
`dc12ee680cba5fe30b0abe2fc46e4b8febf4d6b6a6e4b639e8533bc9da2e4939`.
Rapport : `rapports/COCKPIT-PILOTES-2026-11-19/QUALIFICATION-0258.json`.
La CI complète de la 0.2.58 reste à constater après publication du correctif.

La première CI 0.2.57 donne 124/126 : traces héritées et contexte `cam` absent du harnais nature.
Le test est corrigé au commit `6527496` (4/4 contrôles ciblés), sans modifier les sources ni le build 0.2.57.
Il vérifie caméra de nature, retour en course et indépendance J1/J2 ; sa nouvelle CI est en cours.

Le suivi publié contient les résultats utiles et les empreintes du build ; aucun journal local brut
ni chemin de travail interne n'est ajouté. Les réserves antérieures restent séparées des nouveaux résultats.

## Ensuite

Après publication et clôture du correctif : reprendre 13B Baïkal, puis les autres circuits déjà demandés.
