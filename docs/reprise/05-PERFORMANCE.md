# Lot 5 : optimisation mesurée et qualification finale

Statut au **17 novembre 2026, reprise du soir** : **lot partiellement réalisé — pilote BITUME 0.2.25 local, publication en attente**. FERRO 0.3.4 est publié sur `main` au commit `457a9671f4ea5c314a5c8e7b3337474ba031c78e`. Matières et végétation pilotes, audio J2 borné, mesures corrigées, qualité Auto, outils reproductibles et corrections de reprise ont des preuves locales ; le candidat visuel initial est distingué du build final dans [le rapport du lot 5](rapports/LOT5-2026-11-17.md). Batching des monoplaces, LOD historique et qualification matérielle restent ouverts.

Le contrôle final avant publication réussit **43/43 suites Node**, confirme les **34/34 modules FERRO** et reproduit strictement le build final (`9180313f…`). Les preuves sont dans [publication-final/](rapports/lot5-2026-11-17/publication-final/) ; le précédent passage à 42/43 puis la réussite isolée de `decor.test.mjs` restent conservés comme historique, sans seuil assoupli. Le nouveau smoke est **non exécutable ici** : Chromium 156 échoue sur sa socket avant DevTools, y compris sur `about:blank`, donc avant le jeu. Aucun nouveau banc instrumenté n'a été exécuté. Les premières sorties de banc avaient l'instrumentation désactivée ; elles ne démontrent ni les coûts CPU/GPU détaillés ni un gain de performance. La publication sur `main` est en préparation via le connecteur GitHub ; son reçu sera consigné après vérification. Le déploiement est autorisé mais l'accès Mac/amiga manque ici. La suite reste le smoke final et les mesures GPU réelles, puis le batching des monoplaces et le LOD historique.

## Mesurer avant d'optimiser

Même machine, navigateur, résolution physique, qualité, graine, météo, caméra, durée et chauffe. Mesurer FPS, temps image p50/p95/pire, temps CPU, temps GPU si disponible, draw calls, triangles, voitures, corps PhysX, voix audio et taille brute/gzip. Séparer solo, deux vues et coût des rétroviseurs. Ne pas déduire le temps GPU d'une durée JavaScript ni mesurer une fenêtre cachée comme un jeu au premier plan.

Ne pas transposer les mesures d'un rendu logiciel vers un GPU intégré, un téléphone ou Xbox Edge. Inscrire N/D lorsqu'une plateforme ou une extension n'est pas disponible. Une cible de 60 FPS ne devient une garantie qu'après qualification sur l'appareil concerné.

## Sous-lots ciblés

5A : inspecter le batching/instancing existant. Regrouper géométries et matériaux compatibles des douze monoplaces ; roues et numéros lorsque l'API le permet. Compter par passe : « un draw call par matériau » est un objectif à vérifier, pas une propriété magique indépendante du maillage et des ombres.

5B : LOD de proximité pour vibreurs, glissières et relief, silhouette lointaine et brume. Transitions sans apparition brutale ; frustum propre à chaque caméra, sans réutiliser à tort le culling de J1 pour J2 ou les rétroviseurs. Préserver les obstacles de simulation quand leur rendu change de détail.

5C : limiter les voix moteur détaillées au joueur et à trois rivaux proches spatialisés avec Doppler. Définir le budget global à deux joueurs, conserver leurs deux moteurs, et agréger les autres sans rouvrir onze voix coûteuses. Préparer le thème du titre en mémoire sans son importé ; musique uniquement au titre, jamais en course/démo. Respecter le geste utilisateur nécessaire à Web Audio.

5D : supprimer les allocations et tris évitables des boucles chaudes, borner les pools et respecter le pas fixe. Qualité auto : tester la demande de baisse après moins de 50 FPS pendant trois secondes ; remontée avec hystérésis, sans oscillation. Sur mobile et Xbox Edge, aucun changement destructeur des commandes pour gagner des images.

Toute correction nécessaire dans un module verrouillé passe par FERRO source et une propagation qualifiée, sans casser les consommateurs du moteur commun.

## Matrice de non-régression

Solo, À deux (deux dispositions, clavier/souris/deux manettes), En ligne (2 à 4 pilotes, 2+2 et 2+1), Chrono/fantômes, Démo/titre, pluie/tunnel, crashs multiples et stands. Inclure perte de manette, départ de l'hôte, interruption réseau, visibilité de la page, contexte WebGL perdu/recréé si testable et retour aux menus.

Reconstruire avec `python3 construire.py`, exécuter toutes les suites, vérifier les empreintes FERRO et le build versionné. Ne pas assouplir un seuil pour le rendre artificiellement passant. La mesure historique S8 ouverte doit rester signalée tant qu'elle n'est pas corrigée.

## Livraison

Rapport avant/après avec environnement et données brutes, mises à jour ciblées de `CONCEPTION.md` et `PLAN-MAITRE.md`, tests manuels décrits avec leur statut réel. Distinguer tests passés, échoués et non exécutés. Le mandat du 17 novembre autorise commit, push sur `main` sans écrasement d'un travail concurrent, puis déploiement sur `bitume.estrasse.fr`. Consigner séparément la qualification locale, la publication GitHub et la vérification du site servi.
