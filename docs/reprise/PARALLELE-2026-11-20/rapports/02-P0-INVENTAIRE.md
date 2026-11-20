# 02 / P0 — reprise et coût à mesurer

20 novembre 2026. Bases GitHub relues : BITUME `1c71bb341d20df4328e5178497503ee4ad26a131` (arbre `409499e1631489b667f34bf83e37682cd18657ae`), FERRO `7de089805ba04465d48684085a79a84fa6160b26` (arbre `403c9c99102559ae2a15c9cba953b4f7ce0756a4`). Runtime de référence : **0.2.68 / p15 / FERRO 0.3.15**. Aucune PR ouverte ni branche performance plus récente au relevé. Sources des checkouts isolés vérifiées par les identifiants de blobs de ces arbres ; anciennes preuves FERRO conservées.

## Préparations récupérées

- **Poses rétroviseurs** : déjà présentes dans le patch habitacle sauvegardé ; relève de 01/00, pas de nouvelle application par 02. La préparation reporte rotations/copies après le filtre rétro et réemploie les entrées des instruments. Preuve historique : 4 480 poses, 701 006 objets strictement égaux, ordre et zéros signés conservés ; CPU Node 24/EPYC médian 288,278 → 144,620 µs, neuf séries. SHA256 voiture après : `b37269498b6a97ee27be729e3c9ea793e7108e02f5850b6d84b4ec5c5a69afe9`. Ce résultat n'est ni une mesure sur main actuel ni un gain de FPS.
- **Déduplication** : préparation de `indexPrimitiveVertices` étendant l'indexation aux formes libres, par égalité exacte des six mots Float32 (position + normale), sans changement des triangles ni du tampon de sommets. Une table typée temporaire remplace les clés texte par sommet. Reprendre seulement cette fonction : le dossier préparatoire contient aussi une ancienne `recipes.js`, à ne pas importer. Aucune version moteur qualifiée à ce stade.
- L'ancien audit géométrique portait sur le candidat habitacle, pas main : 1 536 411 références et 533 469 sommets distincts. Il ne sera pas réutilisé comme comparaison du candidat courant. Les mesures dans un contexte VM amplifient fortement les accès globaux ; utiliser une exécution native pour les temps de référence.

## Mesure P1 figée

Forêt, graine 11, longueur 4 200 m, qualité high ; sources BITUME du SHA ci-dessus, pose de voiture fixe, atlas identique parent/candidat. Mesurer construction et indexation, p50/p95/pire, mémoire typée et tas après GC, égalité de tous les attributs après expansion des indices. Le banc indiquera les appels graphiques absents, sans assimiler sommets distincts et invocations du shader.

Une qualification image indépendante vérifiera les formes libres, normales, coutures, transparence, ordre, modification de forme et invalidation des variantes d'herbe. Les vues principales, ombres et rétroviseurs partagent les mêmes attributs ; aucun objet physique ni triangle PhysX n'est retiré. Le raccord partagé des tests BITUME est remis à 00.

## Audit mémoire et visibilité

- Le préchargement, les réserves de flux, la chauffe, l'annulation et les restitutions de vues existent déjà. Conserver le repli Safari `contexteFragile`. Ne pas précharger neuf circuits ensemble.
- `sceneBench.creer()` construit 13 modèles de voitures avant la sonde graphique ; celle-ci peut conclure au rendu logiciel sans appeler `preparer()`. Audit CPU (7 séries, médiane des 5 dernières) : 100,703 ms création totale, dont 20,773 ms dans les constructeurs de voitures, 5 650 744 octets de tas retenu total circuit inclus. CPU partagé : dispersion, pas de gain candidat mesuré. P2 proposé : différer ces ressources jusqu'au premier `preparer()`, les réemployer et libérer de façon idempotente.
- La réserve de flux FERRO est logique : `bufferData` est encore appelé à la taille utile. Zéro création tardive ne démontre pas zéro allocation côté pilote graphique.
- Le banc CPU isolé utilise `course.chauffe()` sans installation PhysX ; il ne qualifie pas le coût complet p15. La vraie préparation installe PhysX. Raccord à 00 avant toute modification de ce contrat partagé.
- Frustum, index spatial, lots/LOD et volumes d'ombres sont déjà présents. BITUME rend surtout via nappes/lots (`setWorld([],[])`). Aucun nouvel index ou occlusion générale justifié avant mesure. Les reflets, rétros et ombres doivent garder leurs sélections indépendantes.

## Mesures encore absentes

Pas de p50/p95/pire du jeu sur GPU physique, coût GPU par passe, GC navigateur, VRAM résidente réelle, ni mesure Xbox/Intel. Pas de nouvelle qualification p15, audio, manette ou réseau : aucun de ces comportements n'est changé. L'étude ray tracing et alternatives reste séparée du correctif sans perte.
