# 02 — Performance du jeu et de FERRO

## Prompt à copier

~~~text
Continue BITUME, discussion 02 « Performance et rendu ».
Dépôts : https://github.com/M4D135/bitume et https://github.com/M4D135/FERRO
Lis AGENTS.md, REPRISE.md, docs/reprise/PARALLELE-2026-11-20/README.md, 02-PERFORMANCE.md et etat/02.json.
Retrouve les optimisations préparées et mesure les coûts. Améliore par petits lots mémoire/préchauffe/pools, géométrie, visibilité et détail selon vitesse/vue. Protège route, virages, concurrents, obstacles, instruments, rétros, écran partagé et p15. Étudie séparément ray tracing et alternatives plus lourdes.
Tu es l'unique auteur FERRO de cette répartition : corrige le dépôt canonique, jamais ses copies verrouillées dans BITUME. Fournis les raccords jeu.js/decor.js et la version qualifiée à 00/04. Commit/push chaque étape et son état. Aucun gain Xbox/Intel affirmé sans mesure matérielle.
~~~

## Références et périmètre

Lire [OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES](../OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES-2026-11-20.md), puis seulement les sections utiles de 05B-FLUIDITE et 28-CALCUL. Lire les consignes propres à FERRO avant de l'éditer.

BITUME : mesures, scene-bench, qualite, autoconfig, graphismes, cadence ; nouveaux modules ressources/importance si justifiés. Raccords jeu.js, chargement des modules, imports FERRO par 00 ; décor par 04. Les copies de FERRO.lock.json, dont carene.js, ne sont pas à modifier directement.

## Étapes successives

1. **P0 — mesurer et retrouver.** Retrouver les préparations poses des rétroviseurs et déduplication exacte des sommets. Fixer scène/graine/caméra/résolution/qualité. Mesurer préparation, p50/p95/pire, allocations/GC, créations tardives, soumissions, coût par passe et mémoire estimée ; indiquer les mesures absentes.
2. **P1 — supprimer une redondance démontrée.** Déduplication : préserver attributs, normales, coutures, silhouettes et ordre requis. Tester image et coût de préparation, pas seulement compter les sommets.
3. **P2 — mémoire/chargement.** Auditer prechargerSeance, reserveFlux, chaufferRendu et preparerSeance déjà présents. Améliorer ce socle, avec pools bornés, annulation/libération et changements de circuit sans accumulation. Préserver le repli Safari évitant une préchauffe massive. Streaming si les mesures le justifient ; ne pas préparer les neuf circuits ensemble.
4. **P3 — visibilité.** Examiner le culling existant avant une extension spatiale/portails/occlusion conservatrice. Visibilité propre aux vues, rétros et ombres ; éviter synchronisations bloquantes et disparitions visibles aux portails. Les objets physiques restent actifs.
5. **P4 — importance/profils.** Module testable selon vitesse, caméra, taille projetée et situation. Protéger route à venir, virages, rivaux/obstacles proches et instruments. Hystérésis/transitions, arrêt, regard arrière, cockpit/poursuite, démo et deux joueurs. Conserver choix manuels et banc versionné. Aucun suivi oculaire supposé.
6. **P5 — études limitées.** Évaluer rayons/reflets, shaders/cartes procédurales, impostors/LOD, SDF/voxels/patches, meshlets/WebGPU et terrain virtualisé. Classer faisable maintenant, prototype utile ou changement d'architecture. Pas de réécriture générale sans gain démontré. L'occlusion n'est pas du ray tracing.

Après le socle, traiter dans cette même discussion les besoins shader de 01/04, un changement à la fois, pour garder un seul auteur du moteur.

## Preuves

Tests utiles selon le changement : chargement, scene-bench, mesures, effets-allocation, nature-preparation, chaussee-preparation, qualite et autoconfig. Après import canonique : formes-libres, moteur-emprise, rendu-halo et python3 tools/check-ferro-lock.py, plus tests concernés dans FERRO. Vérifier les chemins présents ; ne pas relancer toute la liste pour une modification documentaire.

Chaque bilan donne parent/candidat, scène/configuration, avant/après, coût mémoire/qualité et limites. Node/SwiftShader ne mesurent pas les FPS Xbox/Intel. Publier SHA canonique et preuves avant propagation par 00. Mettre à jour raccordements/02.md et etat/02.json.
