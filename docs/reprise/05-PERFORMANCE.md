# Lot 5 : optimisation mesurée et qualification finale

Statut : **à faire**, après intégration des lots fonctionnels. Réutiliser l'overlay et la référence avant modification du lot 1.

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

Rapport avant/après avec environnement et données brutes, mises à jour ciblées de `CONCEPTION.md` et `PLAN-MAITRE.md`, tests manuels décrits avec leur statut réel. Distinguer tests passés, échoués et non exécutés. Build autonome prêt ; déploiement seulement sur demande explicite.
