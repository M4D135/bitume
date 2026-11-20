# BITUME — mémoire, géométrie, matières et rendu adaptatif

## Demandes utilisateur à conserver

Demandes du 20 novembre 2026, ajoutées au programme en cours, à publier sur main puis à réaliser. Leur inscription ne vaut pas implémentation ni validation.

### 1. Mémoire et chargement

- Étudier et mettre en œuvre le pré-cache/préchargement en RAM avant le départ pour réduire les saccades et alléger le runtime.
- Définir les stratégies de streaming, pooling et gestion mémoire adaptées au circuit procédural : terrain, accessoires, véhicules, effets.
- Préparer aussi les ressources GPU et les variantes nécessaires ; mesurer mémoire résidente, pics de préparation, allocations et transferts pendant la course.

### 2. Géométrie et triangles

- Réduire les triangles sans perte visuelle perceptible.
- Remplacer les calculs géométriques coûteux lorsque pertinent par shaders, normal maps procédurales, parallax, tessellation adaptative, impostors, billboards, meshlets ou rendu piloté par le GPU.
- Évaluer les alternatives : quads, patches, voxels, champs de distance signée (SDF), géométrie virtualisée de type Nanite. Distinguer les techniques utiles maintenant et celles qui imposeraient une nouvelle architecture.

### 3. Qualité visuelle

- Améliorer nettement le relief et les matières des montagnes, du terrain moyen et lointain.
- Améliorer les éléments proches vus du cockpit : asphalte, vibreurs, barrières, herbe, graviers, reflets, saleté et usure.
- Améliorer le cockpit : matériaux, reflets, poussière, usure, instrumentation et lumière.
- Proposer puis appliquer des techniques concrètes adaptées au temps réel : shaders, matières procédurales, niveaux de détail, couches de matériaux, parallax occlusion et effets écran. Prioriser le rapport qualité/coût, particulièrement pour la vue cockpit proche.

### 4. Rendu de type fovéal

- Concentrer le détail sur ce qui est essentiel à la course selon la vitesse, la vue et la situation.
- Protéger route à venir, virages, concurrents proches, obstacles, commandes et instruments ; simplifier progressivement les décors périphériques et secondaires.
- L’intérêt visuel est estimé par le jeu, sans supposer un suivi oculaire. Les zones utiles doivent suivre la caméra et la direction de conduite, pas seulement un cercle fixe au centre de l’écran.
- Conserver une visibilité cohérente des rétroviseurs, de l’écran partagé, du regard arrière et des caméras de démonstration. Lisser les changements et éviter le pompage du détail.

### 5. Visibilité et demande « genre de ray tracing »

- Privilégier ce qui est réellement visible ; éviter le rendu inutile hors champ et derrière les obstacles opaques.
- Étudier le culling de frustum, le culling par hiérarchie spatiale, les portails/tunnels et l’occlusion par relief/bâtiments. Les requêtes ne doivent pas bloquer CPU/GPU.
- La suppression des éléments cachés et le ray tracing des reflets/ombres sont deux coûts distincts. Étudier les rayons lorsque utiles ; ne pas présenter un filtrage de visibilité comme un ray tracing complet déjà réalisé.
- Un objet absent de la vue principale peut encore contribuer aux ombres ou être visible dans un rétroviseur : chaque passe conserve sa visibilité propre.

## Priorité et contraintes de réalisation

1. Mesurer les vrais coûts avant de choisir le levier : simulation, préparation des poses, soumissions de rendu, travail des sommets, pixels, ombres, rétros, effets, allocations et transferts. Comparaison même scène/caméra/résolution/qualité.
2. Retirer les redondances sans perte de qualité : calculs invisibles, copies, réallocation, sommets exactement identiques.
3. Installer un budget de ressources par circuit et des pools bornés, préchauffés avant départ ; conserver une marge mémoire. « Précharger le maximum » ne signifie pas remplir toute la mémoire ni préparer les neuf circuits à la fois.
4. Appliquer des niveaux de détail par taille projetée et importance pour la conduite, avec hystérésis/transitions. La physique et les obstacles restent identiques.
5. Améliorer les matières proches avec un coût borné ; les effets plus coûteux restent adaptés aux capacités mesurées.
6. Évaluer WebGPU/meshlets/occlusion avancée dans un lot séparé si une mesure démontre le besoin. WebGL2 reste le socle compatible actuel.

Les contenus graphiques et sonores restent procéduraux. Une carte de matière générée au chargement n’est pas un asset externe. Les modifications des modules FERRO passent par le dépôt canonique, puis par une version qualifiée et son verrou dans BITUME. Préserver p15 et les tests/images déjà clos. Aucune promesse de FPS sur Xbox Edge ou GPU Intel sans essai sur ces appareils.

## État constaté au checkpoint

- BITUME livré :0.2.68, moteur FERRO0.3.15, neuf circuits ; habitacle0.2.69 construit séparément et en attente de CI/captures.
- Le jeu possède déjà préparation des séances, préchauffe GPU, réserves de flux d’instances, pools et compteurs de créations tardives. L’audit doit améliorer ce socle, pas le remplacer sur une hypothèse.
- Une optimisation de pose des rétroviseurs est préparée avec égalité stricte des objets rendus et un banc logiciel avant/après. Elle ne vaut pas une mesure de FPS matériel.
- L’audit canonique étudie la déduplication exacte des sommets des formes procédurales. Le potentiel et le coût de préparation sont en cours de mesure, sans résultat moteur publié à ce stade.
- Le menu arcade en préparation utilise un petit aperçu du tracé ; la course complète derrière les menus opaques doit être suspendue.
- Rendu fovéal estimé, occlusion supplémentaire et enrichissement des matières : demandes ouvertes, pas encore qualifiées.

## Sources techniques de travail

- [WebGL : budgets mémoire, synchronisations et préchauffe](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).
- [Web Workers et transferts de tampons](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects).
- [Spécification WebGL2](https://registry.khronos.org/webgl/specs/latest/2.0/).
- [WebGPU : calcul et commandes indirectes](https://gpuweb.github.io/gpuweb/).
- [Geometry clipmaps pour terrain](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry).
- [meshoptimizer : simplification, indexation et caches](https://github.com/zeux/meshoptimizer).
- [Filament : modèles de matière](https://google.github.io/filament/main/materials.html).

## Liens de reprise

[Demandes arcade, saisons et Troll](DEMANDES-ARCADE-PERFORMANCE-TROLL-2026-11-20.md) · [File complète](FILE-TRAVAIL.json) · [Journal](JOURNAL-AUTONOME-2026-11-20.md).
