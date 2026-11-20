# Cockpit et pluie — correctif du 20 novembre 2026

## Demande et périmètre

La photo utilisateur montre un volant et un tableau trop hauts, avec des glaces
sur les mains. Le même défaut est signalé depuis l’extérieur. C’est un défaut
bloquant de la livraison 0.2.69, pas une validation acquise par projection.

Le correctif possède une seule géométrie métrique pour intérieur et extérieur,
conserve les yeux et l’assise du pilote et ne change pas le champ manuel mémorisé.
Le dégagement est contrôlé par intersections avec les vrais triangles, puis par
images du HTML assemblé. Une référence 0.2.69 doit échouer aux nouveaux contrôles.

La demande complémentaire porte sur la pluie derrière l’arceau, plusieurs forces
et abondances, des impacts brefs suivis de perles qui glissent, et de l’eau sur les
surfaces des véhicules. Quatre forces : fine, modérée, forte, très forte. La météo
réelle reste liée à ses observations. Sec, neige, toit, pause et deux joueurs
restent contrôlés séparément.

## Coordination

Base publiée : `96f720e788698401a72d41a9e0befa18c88c2e7b`, runtime 0.2.69,
p15 / FERRO 0.3.15 / neuf circuits. Deux worktrees isolés : cockpit et pluie.
00 assemble et publie ; géométrie, optique et carrosserie ont chacun un propriétaire.
Les transferts sont inscrits dans `PARALLELE-2026-11-20/REPARTITION.json`.
Le lot d’abris PR 43 reste conservé sur sa branche ; aucun fichier FERRO verrouillé
n’est modifié et aucun déploiement du site n’est demandé.

## Qualification

Banc cockpit indépendant : 324 rayons vers la chaussée à 10, 20, 40 et 80 m,
trois braquages, yeux gauche/droit/centre ; polygones de glaces et commandes dans
24 cadres. La référence publiée échoue : 324 rayons masqués et 544 recouvrements
ou marges insuffisantes. Les critères ne sont pas relâchés pour accepter le correctif.

Campagne navigateur préparée : cinq dispositions (Mac, paysage, portrait,
partage haut/bas et côte/côte), deux états d’allure/braquage, plus profil et trois
quarts extérieurs. Le workflow Troll suit J1 et J2 dans le HTML du candidat courant.
Chaque capture archive commit, arbre, SHA du HTML et diagnostics ; les images
restent à recevoir et inspecter avant décision de publication.

L’alerte historique de construction décor à 172 ms pour un seuil strict de
150 ms demeure ouverte ; aucun seuil modifié. Les captures logicielles ne sont
pas une mesure de FPS Xbox/Intel ou un essai de conduite matérielle.


## Complément de reprise : caméra et coût au sec

La revue indépendante a trouvé que le champ précédent ne suivait pas le regard
dans les virages : 50 des 216 cadres examinés pouvaient tronquer une glace. La
correction calcule la marge avec les vrais coins dans le repère de la caméra et
les inerties, sans déplacer les pièces ni changer la préférence de champ.

Le module de gouttes de carrosserie évite aussi de parcourir ses 2 304 perles
quand les douze voitures sont déjà sèches. Le dernier pas de séchage et la reprise
de pluie restent exécutés. Les mesures locales sont des coûts CPU et ne prouvent
pas un gain de FPS sur Xbox/Intel.

Les impacts, quatre forces et surfaces sont assemblés avant les captures ; la
qualification doit couvrir le même HTML que le cockpit. Les origines des deux
préparations sont conservées dans [PROVENANCE.json](rapports/COCKPIT-PLUIE-2026-11-20/PROVENANCE.json).
