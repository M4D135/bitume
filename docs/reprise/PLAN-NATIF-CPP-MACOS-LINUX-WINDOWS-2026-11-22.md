# BITUME / FERRO — plan de migration native C++

Date : 22 novembre 2026  
Statut : **plan uniquement ; implémentation non commencée**  
Ordre demandé : **macOS → Linux → Windows**

## 1. Décision de David et périmètre du présent lot

David choisit « c++ et version macosx pour commencer, ensuite linux puis windows », puis précise :
« fais juste le plan et pousse le sur le github ».

Décisions fermes :

- Développer une édition native en **C++**, avec FERRO comme moteur.
- Livrer et qualifier **macOS d’abord**, **Linux ensuite**, **Windows en troisième**.
- Faire de la fluidité, de la maîtrise de la mémoire et de la régularité des images des critères de réception.
- Conserver l’identité, le contenu procédural, les modèles et la conduite de BITUME pendant le portage.
- Ce lot publie seulement le plan et ses liens de reprise. Il ne lance aucun développement natif,
  ne modifie aucun runtime, ne construit aucun jeu et ne déploie rien.

Les choix de bibliothèques et de versions ci-dessous sont des propositions techniques à qualifier.
Ils ne changent ni le langage ni l’ordre des plateformes demandés. Le démarrage de l’exécution
fera l’objet d’une instruction ultérieure ; les anciennes consignes de continuation autonome
ne transforment pas ce lot documentaire en autorisation d’implémentation.

## 2. Base constatée et référence à figer

Base consultée pour ce plan :

| Élément | Référence |
|---|---|
| BITUME | `73ce09ffc820501a14a9330e2cd6be9807985fe3`, état déclaré 0.2.89 |
| Physique du jeu | p15 |
| FERRO utilisé par BITUME | 0.3.15, modules canoniques verrouillés |
| Dépôt moteur consulté | `M4D135/FERRO`, main `7de089805ba04465d48684085a79a84fa6160b26` |
| Rendu réellement ouvert par BITUME | WebGL2, imposé au démarrage dans `src/jeu.js` |
| Physique actuelle | PhysX 5.12.0 déjà embarqué en WebAssembly |
| Xbox navigateur | Budget de pixels déjà plafonné ; aucun FPS matériel démontré par ce plan |

Sources internes : [rendu du jeu](../../src/jeu.js), [référence FERRO](../../FERRO-REFERENCE.md),
[fiche Xbox](XBOX-EDGE-COMMANDES-2026-11-21.md) et
[optimisation mémoire, géométrie et matières](OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES-2026-11-20.md).

À l’ouverture du premier lot de code, relire le main courant et figer une nouvelle référence
si le jeu a avancé. Préserver les travaux concurrents. Les documents historiques peuvent
mentionner un ancien catalogue ou d’anciennes options : établir la matrice de parité depuis
le code et le jeu effectivement retenus, pas depuis une ancienne liste de fonctionnalités.

La version web retenue reste disponible comme référence pendant la migration.
Son avenir commercial ou sa transformation en démo ne sont pas décidés par ce plan.

## 3. Architecture proposée

### 3.1 Cœur C++ commun

Socle proposé : **C++20 et CMake**, versions des dépendances épinglées et builds reproductibles
à partir d’un commit identifié.

Séparer clairement :

| Couche | Responsabilité |
|---|---|
| Cœur FERRO | Mathématiques, ressources, géométrie, matériaux, tâches, instrumentation |
| Simulation | Adaptateur PhysX CPU natif, pas fixe, événements et cycle de vie |
| BITUME | Générateurs de circuits, conduite, courses, IA, pneus, dégâts, stands et règles |
| Plateforme | Fenêtre, manettes, clavier, audio, fichiers, horloge et affichage |
| Rendu | Préparation des scènes, passes et commandes GPU derrière une interface indépendante du système |

Le gameplay ne dépend directement ni de Metal, ni d’AppKit, ni de Win32. Les adaptations
propres aux systèmes restent dans la couche plateforme. Le runtime natif ne dépend pas
d’un navigateur ou d’un interpréteur JavaScript pour faire fonctionner le jeu.

### 3.2 Rendu : Metal sur Mac, portabilité préparée

Cibles graphiques proposées :

- **macOS : Metal**.
- **Linux : Vulkan**, après réception du jalon macOS.
- **Windows : Direct3D 12**, après réception du jalon Linux.

Évaluer en premier **SDL3** pour fenêtres, entrées, manettes et audio, ainsi que **SDL GPU**
comme abstraction graphique commune : sa documentation expose des backends Metal,
Vulkan et Direct3D 12 [S1]. FERRO conserve la propriété de ses scènes, de ses matériaux
et de ses règles de rendu ; SDL ne remplace pas le moteur de jeu.

Le lot N0 doit confirmer que cette abstraction couvre les passes nécessaires :
ombres, rétroviseurs, reflets, transparence, instancing et buffers. Si une limitation
mesurée empêche un besoin essentiel, documenter l’écart et choisir une autre abstraction
ou un backend Metal propre. Apple fournit une interface `metal-cpp` utilisable depuis
C++ [S2]. Ne pas engager trois renderers indépendants avant cette décision.

Préparer une chaîne de shaders versionnée : adaptation des recettes actuelles, compilation
hors course vers les formats des backends, contrôle des variantes et préchauffe.
La conversion des shaders ne garantit pas à elle seule la parité des images.
Les éventuels fichiers binaires générés par le build restent des produits du code
procédural, pas des images ou sons importés.

### 3.3 PhysX natif : risque à lever immédiatement

Conserver l’objectif de conduite **p15** et intégrer PhysX CPU natif derrière un adaptateur.
L’existence du WASM actuel ne prouve pas que la même révision se compile sans adaptation
sur le Mac cible. Vérifier très tôt les sources, l’architecture, le compilateur,
les dépendances et la construction reproductible.

Si une adaptation est nécessaire, la documenter et la tester. Ne pas remplacer
silencieusement PhysX ou le modèle de conduite pour débloquer une compilation.
Ne pas faire dépendre la simulation de CUDA : le chemin commun prévu est CPU.
La documentation PhysX décrit une API C++ et une simulation CPU multithreadée [S3].

### 3.4 Organisation des dépôts

- Le moteur natif commun appartient à **M4D135/FERRO**, dans un répertoire dédié à créer
  lors de l’exécution, par exemple `native/`.
- Les règles, générateurs et application BITUME appartiennent à **M4D135/bitume**,
  dans un répertoire natif distinct.
- BITUME référence une révision précise du moteur natif. Définir au lot N0 le mécanisme
  de dépendance, de verrouillage et de mise à jour.
- Ne jamais modifier les copies web verrouillées de FERRO pour y glisser le portage.
- Utiliser des branches dédiées et des commits courts ; intégrer les modifications communes
  de manière coordonnée. Aucun travail concurrent n’est supprimé.

## 4. Contrat de fidélité

Créer une matrice des fonctions de la version de référence, avec trois états :
**à porter**, **portée à vérifier**, **qualifiée**. Une fonction non portée reste visible
dans cette matrice ; un prototype réduit n’est pas présenté comme le jeu complet.

À préserver :

- Tracés, identifiants, graines, reliefs et conventions de repères ; parcours ouverts
  avec arrivée définitive, notamment sommet du col de Larche → Vinadio.
- Unités, pas de simulation de 1/120 s et règles de course de la référence.
- Relation entre les triangles affichés et ceux utilisés pour les collisions,
  suspensions, obstacles et passages couverts.
- Une seule voiture et un seul pilote dans le monde : les caméras changent le point
  de vue, jamais les proportions ou la position des commandes.
- Modèles, cockpit, mains, animations et recettes de matériaux existants.
- Pneus, usure, dégâts, stands, IA, fantômes, records et progression.
- Météo, saisons, lumière, ombres, reflets, rétroviseurs, sons synthétisés et musique
  limitée au titre.
- Menus arcade, clavier/manettes, réglages individuels et écran partagé.
- Faune proche utile, sommeil hors champ et démos centrées sur route, tracé et lieux.

Prévoir des entrées enregistrées et des scènes reproductibles : même graine, caméra,
résolution, météo et paramètres. Comparer positions, vitesses, contacts et images avec
des tolérances explicites et justifiées. Ne pas promettre une identité bit à bit entre
WebAssembly, ARM et x86.

Le portage ne doit pas déclarer automatiquement les anciens fantômes ou records compatibles.
Versionner les formats et conserver les données existantes ; valider séparément leur import.
Tout changement réel de comportement physique suit la règle de version du jeu et reste
distinct d’une optimisation ou d’une différence d’arrondi.

## 5. Lots d’exécution, dans l’ordre

Tous les lots ci-dessous sont **planifiés et non commencés**.

| Lot | Travail | Livrable et condition de passage |
|---|---|---|
| **N0 — Référence et décisions techniques** | Identifier le Mac, fixer le commit de référence, inventorier les fonctions, tester la couverture SDL GPU et vérifier le chemin PhysX | Architecture écrite, dépendances et cibles choisies, scène de comparaison et risques documentés |
| **N1 — Socle macOS** | CMake, cœur C++, application Mac, fenêtre Metal, entrées, horloge, logs et PhysX natif minimal | Construction depuis un checkout propre et exécution réelle sur le Mac ; aucune compatibilité supposée |
| **N2 — Scène et conduite de référence** | Porter un circuit représentatif et une voiture avec les vrais modèles, le sol et la conduite | Parcours pilotable, collisions et caméra cohérentes ; rapport de parité et de coûts face à la version web |
| **N3 — Course complète** | Départ, grille réelle de concurrents, IA, pneus, stands, dégâts, arrivée et règles | Course terminée puis relancée ; vérification du parcours ouvert ; absence de régression de conduite |
| **N4 — Rendu et ambiance** | Matériaux, éclairages, météo, rétroviseurs, animations, faune et son procédural | Comparaisons visuelles et sonores ; coûts par passe et limites explicitement relevés |
| **N5 — Produit macOS** | Catalogue retenu, menus, sauvegardes, réglages, progression, deux manettes et écran partagé ; réseau selon matrice | Parcours titre → préparation → course → résultats → relance, sans manipulation de développeur |
| **N6 — Réception et distribution Mac** | Optimisation mesurée, stabilité longue, paquet .app et préparation de distribution | Version Mac qualifiée sur la matrice matérielle annoncée ; liste exacte des fonctions et limites |
| **L1 — Portage Linux** | Activer Vulkan et les services Linux avec le même cœur et les mêmes règles | Construction et jeu sur machines Linux réelles, parité avec la version Mac reçue |
| **L2 — Réception Linux** | Entrées, audio, fichiers, sessions graphiques et pilotes retenus ; paquet et performances | Version Linux qualifiée sans régression macOS |
| **W1 — Portage Windows** | Activer le backend Windows, outils de compilation, entrées et packaging | Construction et jeu natif Windows avec le cœur commun |
| **W2 — Réception Windows** | Configurations GPU retenues, manettes, stabilité, sauvegardes et distribution | Version Windows qualifiée ; vérification des trois plateformes |

N2 donne une première portion jouable pour décider de la suite, pas une livraison complète.
Linux ne commence qu’après réception du jalon N6 ; Windows après L2.
Les interfaces portables sont préparées dès le début, mais cela n’autorise pas trois portages simultanés.

Le réseau demande un lot identifié dans N5 : l’API WebRTC du navigateur ne se transpose pas
directement. Définir l’implémentation native, vérifier la signalisation, les coupures et
la compatibilité des protocoles avant d’annoncer un jeu croisé web/natif.
Ne pas imposer un serveur supplémentaire ou un nouveau service payant sans décision explicite.
Une édition de test solo peut précéder cette qualification, avec son périmètre clairement indiqué.

## 6. Performance : objectifs et preuves attendues

### Cible de départ

Objectif proposé : **60 images/s**, soit environ **16,7 ms par image**, sur une configuration
de référence précisément identifiée. Ce n’est ni une mesure acquise ni une promesse pour
tous les Mac. Définir au lot N0 les résolutions, profils, configurations minimales et cas
solo/duo. Consigner les pixels réellement rendus, notamment sur un écran Retina.

Conserver les seuils de réception déjà applicables à la référence. Toute évolution de seuil
doit être justifiée et déclarée avant les comparaisons, jamais ajustée pour masquer un échec.

### Mesures nécessaires

- Temps CPU par grande phase et temps GPU par passe quand disponible.
- Temps d’image p50, p95, p99 et pires pics ; fréquence des images au-delà du budget.
- Mémoire résidente, mémoire des ressources graphiques et allocations récurrentes.
- Dessins soumis, instances, triangles et volumes transférés CPU → GPU.
- Temps de génération, de chargement, de cuisson des collisions et de préchauffe.
- Stabilité et évolution mémoire sur plusieurs courses et changements de circuit.

Comparer web et natif sur le **même Mac**, à contenu, caméra, résolution et qualité comparables.
Conserver les rapports associés aux commits exacts. Une compilation réussie, un résultat
de CI ou un rendu logiciel ne prouvent pas des performances matérielles.

### Optimisations à étudier selon les mesures

Préparation des géométries et des pipelines avant course ; ressources GPU persistantes ;
instances partagées ; données contiguës ; réduction des copies et synchronisations ;
réutilisation des buffers ; culling par vue utile et LOD cohérents ; fréquence adaptée
des ombres, reflets et rétroviseurs ; parallélisation des tâches coûteuses identifiées.

Les détails lointains peuvent être simplifiés sans dégrader les repères utiles à la conduite.
Préserver ce qui contribue aux ombres et aux rétroviseurs ; éviter les apparitions brutales.
La génération procédurale n’implique pas de régénérer chaque objet à chaque image.

**Aucun benchmark de charge automatique au démarrage du joueur.**
Utiliser une détection passive et des réglages prudents. Les mesures détaillées sont
des outils de développement ou des parcours lancés explicitement.

## 7. Réception spécifique macOS

Le modèle de Mac, son architecture, sa mémoire et sa version de macOS ne sont pas connus
dans ce plan. Les identifier avant de fixer la cible du premier binaire.

- Compiler et tester nativement sur l’architecture retenue. Traiter Apple Silicon et Intel
  comme des cibles distinctes tant que les dépendances et le matériel ne sont pas qualifiés.
- Un binaire universel n’est annoncé que si ses deux architectures sont construites et testées.
- Tester plein écran, Retina, changement d’écran, redimensionnement, focus, pause et reprise.
- Vérifier branchement/débranchement de deux manettes, zones mortes, réglages et retour clavier.
- Tester audio, volume, reprise après suspension et absence de vibrations dans les menus.
- Enregistrer les données dans le répertoire utilisateur adapté, avec formats versionnés
  et sans écraser les sauvegardes web.
- Produire une application `.app` avec ressources procédurales générées, métadonnées,
  logs de diagnostic et lancement par double-clic.
- Prévoir signature et notarisation dans le jalon de distribution publique.
  Les essais locaux du prototype restent un jalon séparé ; aucun achat ni publication
  de boutique n’est inclus dans cette demande.

## 8. Réception Linux puis Windows

**Linux :** fixer les distributions et architectures réellement couvertes, qualifier
Vulkan sur les pilotes retenus, clavier/manettes, audio, plein écran et sessions graphiques
ciblées. Choisir un format de distribution après vérification de ses dépendances.
Rejouer la matrice fonctionnelle et contrôler que macOS reste vert.

**Windows :** fixer les versions et architectures visées, qualifier le backend graphique
sur les familles de GPU retenues, entrées, audio, changement d’écran, suspension et reprise.
Préparer le paquet et les diagnostics. Comparer les comportements à Mac et Linux et
vérifier les sauvegardes portables.

Les tâches consoles, Xbox, boutiques et monétisation sont hors de cet ordre de portage.
Aucun port console automatique n’est promis par le choix C++ ou SDL.

## 9. Suivi, critères de fermeture et reprise

Chaque lot devra fournir :

1. Les commits BITUME et FERRO utilisés et les dépendances verrouillées.
2. Son périmètre livré et les cases de la matrice réellement qualifiées.
3. Les vérifications de comportement et les comparaisons utiles à son objectif.
4. Les mesures matérielles quand le lot porte sur la fluidité.
5. Les limites restantes et la prochaine action précise.

La réception Mac exige une application jouable et représentative, pas seulement une fenêtre
Metal ou un circuit vide. Le passage à Linux puis Windows suit les jalons de réception,
pas une date annoncée sans preuve.

Le présent commit documentaire ne change ni la version 0.2.89, ni p15, ni les builds web,
ni FERRO.lock.json. Prochaine étape native proposée : **N0**, uniquement lorsqu’une
instruction d’exécution sera donnée.

## 10. Références techniques

Sources officielles consultées le 22 novembre 2026 :

- **[S1] SDL3 GPU** — API graphique commune, backends et chaîne de shaders :
  <https://wiki.libsdl.org/SDL3/CategoryGPU>
- **[S2] Apple Metal-cpp** — interface Metal depuis C++ :
  <https://developer.apple.com/metal/cpp/>
- **[S3] NVIDIA PhysX** — API C++, simulation CPU et capacités :
  <https://nvidia-omniverse.github.io/PhysX/physx/latest/index.html>

Ces références décrivent les outils disponibles ; elles ne constituent pas une validation
du futur portage BITUME sur le matériel de David.
