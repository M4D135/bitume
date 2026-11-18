# Carte des accrocs — simulation

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Pas fixe DT = 1/120 s (jeu.js:5). `image(t)` (jeu.js:2477-2549) : dt brut de rAF borné à 0,1 s (2482-2484), accumulateur `S.acc` (2511-2516, 12 pas au plus ; en ligne jusqu'à 90, 2503-2510), puis `rendreImage(S, acc/DT)` interpole `S.prec` et `S.cour` (253-259). Soit 4 pas par image à 30 Hz, 2 à 60, 1 à 120, 0 ou 1 à 144.

`pasSimulation` (711-748) : commandes (555-611), `B.course.pas`, vibration de la manette (434-483), `remplirPoses` (243-252), `B.traces.pas` (effets à 30 Hz, PhysX), `traiter` (777-827 ; `finTour`, 829-853, écrit dans localStorage).

`B.course.pas` (course.js:560-634), douze voitures : feux ; `aspirer` (477-488) ; instantanés `contacts.avant` (contacts.js:17) et `obstacles.avant` (obstacles.js:119) ; par voiture, `commandesIA` (150-376 : cent échantillons de vitesse balayés, boucles sur les onze autres, `empriseIA` 146-149) puis `B.conduite.pas` (conduite.js:688-704 : `rouler` 308-531, `heurterGlissiere` 268-306, `poserAttitude` 541-561 ; équations sans état de FVehicleDynamics) ; `contacts.pas` (contacts.js:40-84 : 66 paires, `balayage` 31-37, `tester` 19-30) ; `obstacles.pas` (obstacles.js:152-221 : grille de 16 m à clés texte, balayage échantillonné, prismes des troncs 36-58) ; `stands` (513-558) ; passages de ligne (599-614, `passageLigne` 419-441) ; `majClassement` (453-472).

`B.circuit.echantillon` (circuit.js:349-354) alloue un objet de neuf champs et une fermeture : une dizaine d'appels par voiture et par pas. `lire` (course.js:45-48) est la lecture sans allocation, réservée à l'IA.

PhysX : `physx-runtime.js` (12 Mo) est le troisième script (construire.py:26) et construire.py:131 enveloppe tout jeu.js dans `FERRO.initPhysics().then(…)` (physx.js:7-18). Le module est donc instancié une seule fois, au chargement de la page, avant l'écran titre, et jamais libéré. Il ne sert qu'aux pièces détachées : monde créé au premier débris de la séance (traces.js:276, physx.js:88-157), dalles de sol (traces.js:253-269, `setStatics` physx.js:137-149), un corps CCD par pièce (traces.js:229 et 278 ; six par voiture, bassin de 96), `monde.step(1/30)`, soit deux sous-pas synchrones (traces.js:312, physx.js:116-122), relecture des poses (316), retrait au repos ou à 12 s (314, 325), monde détruit au changement de séance (`liberer`, 287-302, appelé jeu.js:177).

Lancement : `demarrerSeance` (jeu.js:2364-2374) ne montre le voile `#chargement` que 30 ms (fondu de 0,3 s, style.css:227), puis `lancer` (172-237) enchaîne `liberer`, `installer` (134-163 ; décor et `obstacles.creer` en cache si la vitrine montrait déjà ce circuit), `B.course.creer` (course.js:53-129), pneus, douze `B.voiture.modele`, `B.traces.creer` (bassins fixes), poses, puis `aller('course')`. Grille 1,5 s, feux 4,4 à 5,4 s (course.js:566-575). Aucune chauffe explicite : seule la vitrine des menus a rodé l'IA, la conduite automatique, les contacts et le classement.

Lu dans le code, non mesuré : 800 à 1 300 allocations par pas, davantage sur la ligne droite des stands.

## Constats

### simulation-physx-premier-debris — gravité 4, confiance 0.5
- Où : src/traces.js : 215-231, 253-282 (monde créé l. 276) ; src/ferro/physx.js 54-63, 88-157 (création paresseuse (PhysX))
- Quand : En course : premier choc d'au moins 20 m/s de chaque séance (première pièce détachée) ; pire au tout premier choc de la page
- Mécanisme : Dans le pas de simulation : `createWorld` (scène CCD, répartiteur, filtre de paires en JS), puis `dalles` et `setStatics`, qui recrée toutes les dalles à chaque nouvelle zone, puis un `addBox` CCD par pièce (jusqu'à six par voiture). Au premier choc de la page, ce code WASM n'a jamais tourné : compilation à la première exécution probable sous Chrome (supposition non mesurée).
- Correctif proposé : Créer le monde dans `B.traces.creer`, sous le voile de `lancer`, et le chauffer : cinq dalles, six boîtes CCD, trente `step`, retrait des corps. Le garder toute la séance. Ajouter les dalles une à une par `addBox(pos, demi, {type:'static'})` au lieu de `setStatics`. File d'attente : deux `addBox` au plus par pas.
- Risque : Débris purement visuels : aucun effet sur la course ni sur le jeu en ligne. physx.js est verrouillé : tout se fait dans traces.js.

### simulation-obstacles-balayage-par-objet — gravité 4, confiance 0.6
- Où : src/obstacles.js : 152-221 (boucle 174-193), 114-118, 125-147 (allocations et calcul par pas)
- Quand : À chaque pas, pour chaque voiture ; maximal sur la ligne droite des stands : grille, départ, chaque tour
- Mécanisme : Par voiture et par pas, même sans obstacle : une trentaine d'allocations (objets vides, clés texte `x+','+z`, tri) et cinq à six `echantillon`. Pour chaque objet voisin non touché (gradins, toits, murets, portique : boîtes de 60 à 90 m présentes dans les cellules de la piste), `interpoler` et `monde` sont refaits à chaque échantillon : voisins × échantillons × 3 allocations (4 à 30 voisins, non mesuré).
- Correctif proposé : Calculer une seule fois les poses échantillonnées de la voiture ; rejeter chaque objet par hauteur et par boîte englobante (garder xmin à zmax pour tous les types dans `creer`) avant tout test ; sortir dès que `ids` et `memory` sont vides. Objets de travail au niveau du module, clés entières, listes de champs constantes, tri à partir de deux identifiants seulement.
- Risque : Identique au bit près si le rejet reste conservatif ; à tenir par obstacles.test, decor-obstacles.test et troncs.test.

### simulation-contacts-balayage-toutes-paires — gravité 3, confiance 0.8
- Où : src/contacts.js : 31-37, 44-52 (fermeture l. 49) (allocations par pas)
- Quand : À chaque pas dès que les voitures roulent (au-delà de 24 m/s environ)
- Mécanisme : `balayage` interpole les 66 paires, même distantes de 2 km : deux `Math.hypot`, puis (n − 1) × 2 objets `{x,z,h,y}` et autant de `tester` par paire (n = 3 ou 4 à vitesse de course), soit 260 à 400 objets par pas, plus 66 fermetures `blocked`.
- Correctif proposé : Avant le balayage : si la distance des centres dépasse 5,35 m plus le trajet des deux voitures, rendre null (aucune pose interpolée ne peut se toucher, résultat identique). Deux objets de travail au niveau du module pour les poses interpolées, `blocked` hors de la boucle, résultat écrit dans un objet réutilisé.
- Risque : Rejet exact : la distance entre poses interpolées ne descend jamais sous la distance finale moins le trajet. contacts.test et collisions-orientees.test.

### simulation-echantillon-alloue — gravité 3, confiance 0.7
- Où : src/circuit.js : 349-354 ; appelants : conduite.js 310, 542 ; contacts.js 11 ; obstacles.js 132 ; jeu.js 246 (allocations et calcul refait)
- Quand : À chaque pas : une dizaine d'appels par voiture, 120 à 130 par pas, environ 15 000 par seconde
- Mécanisme : `echantillon` crée une fermeture `m` et un objet de neuf nombres, calcule neuf interpolations quand les appelants en lisent deux à quatre, et il est rappelé une dizaine de fois par voiture pour deux abscisses seulement, celle d'avant et celle d'après le pas.
- Correctif proposé : Ajouter `B.circuit.echantillonDans(c, s, sortie)`, sans fermeture, qui écrit dans un objet fourni, et remonter `lire` (course.js 45-48) pour les lectures d'un seul champ. Garder par voiture l'échantillon d'avant le pas (`contacts.avant`, relu par `rouler` et les obstacles) et celui d'après (`poserAttitude`, relu par `contacts.pas`, les obstacles et `remplirPoses` tant que `s` n'a pas bougé).
- Risque : Mêmes formules, mêmes résultats ; `echantillon` reste pour le décor, les caméras et les tests.

### simulation-ia-emprises — gravité 3, confiance 0.7
- Où : src/course.js : 146-149, 152, 199-206, 210, 236, 248, 268-277, 319-320, 375 (allocations et calcul refait)
- Quand : À chaque pas, pour les onze rivaux (douze en démo et en vitrine), grille comprise
- Mécanisme : `empriseIA` rend un objet neuf et refait cos et sin pour chaque autre voiture vue par chaque rival : 130 à 300 objets et 260 à 600 appels trigonométriques par pas, quand douze emprises suffiraient. S'y ajoutent l'objet de commandes rendu (l. 375) et la fermeture `libre` à chaque tentative de dépassement.
- Correctif proposé : Tenir l'emprise de chaque voiture dans deux Float64Array de la course, recalculées au début de `pas`, puis pour la voiture i juste après son `conduite.pas` (l. 589) : valeurs identiques à celles d'aujourd'hui. `commandesIA` les lit ; objet de commandes réutilisé par voiture ; `libre` devient une fonction de module.
- Risque : Conserver l'ordre séquentiel (un rival voit l'état déjà avancé des voitures précédentes), sinon l'IA change et le jeu en ligne diverge ; suites ia*.test.

### simulation-voile-sans-prechargement — gravité 3, confiance 0.6
- Où : src/jeu.js : 2364-2374, 172-237 ; style.css 227-228 (préchargement absent)
- Quand : Au lancement de chaque course (et de chaque course de démo, jeu.js 2089-2096)
- Mécanisme : `demarrerSeance` montre le voile 30 ms seulement, sur un fondu de 0,3 s : il n'est jamais opaque, et il est retiré (l. 2368) avant `lancer`. La construction de la course fige l'image, puis les toutes premières images (premier dessin des douze modèles, tables de contacts et d'obstacles créées au premier pas) passent à l'écran. Rien n'est chauffé avant la grille.
- Correctif proposé : Faire de `demarrerSeance` une vraie phase de préchargement : voile opaque, `lancer`, monde PhysX créé et chauffé, chauffe de la simulation par tranches, quelques images rendues sous le voile, puis voile levé et `tPrec = 0`. La grille et les feux (environ 6 s, voitures retenues) offrent une marge supplémentaire.
- Risque : Allonge le lancement de quelques centaines de millisecondes ; en ligne, le départ est daté par T0 : précharger avant l'instant commun.

### simulation-cadence-dt-brut — gravité 3, confiance 0.45
- Où : src/jeu.js : 2482-2484, 2511-2516, 2521 (cadence)
- Quand : À chaque image, à toute fréquence d'écran
- Mécanisme : Le dt de rAF entre brut dans l'accumulateur : ni estimation de la période de l'écran, ni verrouillage. Si l'horodatage est arrondi à 1 ms (Safari, Firefox : à vérifier), le déplacement par image varie d'environ 3 % à 60 Hz et 6 % à 120 Hz, et le nombre de pas oscille entre 1 et 3 à 60 Hz. Après une image longue, jusqu'à 12 pas d'un coup.
- Correctif proposé : Charger `ferro/loop.js` (FLoop, module verrouillé déjà présent, absent de MODULES) : `FLoop.create({hz:120, maxSteps:12})`, `advance(t, pas)`, `frame.alpha`. Il verrouille 30, 60 et 120 Hz sur un nombre entier de pas, cale 144 Hz sur la période mesurée et borne le rattrapage. `reset()` dans `oublierIntervalle` ; le mode en ligne garde son horloge commune.
- Risque : Change la répartition des pas entre images, pas la simulation elle-même ; à valider à 30, 60, 120 et 144 Hz et en démo (ralenti du réalisateur).

### simulation-tour-stockage-synchrone — gravité 3, confiance 0.55
- Où : src/jeu.js : 829-853 (837-838, 847-849), 51-56 ; course.js 433 (localStorage et JSON synchrones)
- Quand : En course, au passage de la ligne du joueur : chaque tour en chrono, chaque record battu en course
- Mécanisme : `finTour` s'exécute dans le pas de simulation. En chrono, `lireStock` relit et analyse le fantôme gardé (environ 40 Ko de JSON) à chaque tour ; un meilleur tour ajoute `enBase64`, `JSON.stringify` et `localStorage.setItem` ; un record écrit `bitume.records`. Entrées-sorties synchrones au passage de la ligne, à pleine vitesse.
- Correctif proposé : Garder en mémoire le temps et la longueur du fantôme stocké, déjà lus dans `lancer` (l. 191) : plus aucune lecture en course. Mettre les écritures en file et les vider par `requestIdleCallback` ou `setTimeout` après l'image, au plus tard à la pause, aux résultats et sur `pagehide`.
- Risque : Un record peut être perdu si la page est tuée avant l'écriture différée : d'où `pagehide`.

### simulation-classement-chaque-pas — gravité 2, confiance 0.8
- Où : src/course.js : 453-472, 615-616, 631 ; conduite.js 332, 335, 369, 505, 542, 568 (travail refait à chaque pas)
- Quand : À chaque pas (120 fois par seconde)
- Mécanisme : `majClassement` copie le tableau, le trie avec une fermeture, parcourt par `forEach` et recrée `course.classement` par `map`, alors que l'affichage le lit quatre fois par seconde (jeu.js 1970) et que ni la physique ni l'IA ne s'en servent. De même, six `Math.exp` de constantes par voiture et par pas (`expTau`, lignes citées de conduite.js).
- Correctif proposé : Trier en place un tableau gardé (tri par insertion : il est presque toujours déjà trié) et réécrire `course.classement` sans le recréer ; ne le faire que tous les 12 pas ou quand le pas émet `tour` ou `arrivee`. Compteur de voitures finies à la place de `every`. Dans conduite.js, mémoriser les coefficients `expTau` pour le dt courant.
- Risque : `position` est lue par le réalisateur et les messages de tour : garder la mise à jour dans le pas qui émet l'événement. vehicle-dynamics.js est verrouillé : le cache vit dans conduite.js.

### simulation-evenements-par-pas — gravité 2, confiance 0.8
- Où : src/conduite.js : 688-704 (tableau l. 689) ; course.js 561, 589 ; jeu.js 245, 278, 482, 577, 608 (allocations par pas)
- Quand : À chaque pas
- Mécanisme : `conduite.pas` crée un tableau d'événements par voiture, que `course.pas` recopie dans le sien, lui aussi neuf à chaque pas. Côté coque : objet de commandes, cinq fermetures `some` dans `appuieSur`, tableau `[faible, fort]`, fermeture de `forEach` dans `remplirPoses`. Environ 35 allocations par pas, faciles à supprimer.
- Correctif proposé : Passer à `conduite.pas` le tableau commun et l'identifiant en paramètres facultatifs (les tests gardent l'ancienne forme). Tableau `ev` de la séance remis à zéro par `length = 0`. Objets de commandes et de vibration réutilisés ; boucles `for` à la place de `some` et de `forEach`.
- Risque : Un appelant qui garderait le tableau rendu d'un pas à l'autre verrait son contenu changer : vérifier les tests et `finirClassement`.

### simulation-physx-pas-permanent — gravité 2, confiance 0.7
- Où : src/traces.js : 310-334 (l. 312, 316-318), 304-308, 368-373 ; src/ferro/physx.js 116-127 (coût permanent et allocations)
- Quand : Du premier débris à la fin de la séance : tous les 1/30 s de course, et à chaque image pour le dessin
- Mécanisme : Dès qu'un monde existe, `monde.step(1/30)` lance deux sous-pas `simulate` et `fetchResults(true)` bloquants sur le fil principal, même sans aucun corps, jusqu'à la fin de la séance. `readPose` et `readVelocity` allouent un tableau par corps et par tic ; `anglesQuaternion` alloue cinq tableaux par pièce et par image, pièces au repos comprises (leur `d.q` reste).
- Correctif proposé : Compter les corps vivants et sauter `step` quand il n'y en a plus. À la mise au repos, écrire une dernière fois les angles puis `d.q = null`. Matrice et tableaux de travail au niveau du module. Sur petite configuration, s'en tenir à la parabole (l. 331-333).
- Risque : Les tableaux rendus par `readPose` viennent de physx.js, verrouillé : seule la référence FERRO peut les supprimer.

### simulation-vibration-manette-chaque-pas — gravité 2, confiance 0.4
- Où : src/jeu.js : 434-447, 451-483, 721-729 (appels système par pas)
- Quand : À chaque pas quand une manette est branchée ; rafale sur les vibreurs et au rupteur
- Mécanisme : `vibrationManette` et `secouerManette` tournent à chaque pas (deux `Math.pow`, `performance.now()`). `playEffect` est rappelé au moins toutes les 40 ms, et dès que l'intensité bouge de 0,05 : sur un vibreur (`martellement`, sinus de 40 × horloge) ou au rupteur, cela peut monter vers 60 à 120 appels par seconde, chacun avec une promesse et un message vers le processus des manettes (non mesuré).
- Correctif proposé : Dans le pas, ne faire qu'accumuler les pics des événements ; calculer l'intensité et appeler `secouerManette` une fois par image, après la boucle des pas (jeu.js 2515), avec 30 ms au moins entre deux `playEffect`.
- Risque : Le martèlement des vibreurs devient moins fin à 30 images par seconde ; à juger manette en main.

### simulation-chemins-joueur-froids — gravité 2, confiance 0.3
- Où : src/conduite.js : 182-239, 358-361, 430, 575-586, 628-663, 667-685 ; course.js 375 (code jamais chauffé)
- Quand : En course : première dérive, premier turbo, premier saut, premier recul, premier choc du joueur depuis l'ouverture de la page
- Mécanisme : La vitrine des menus ne fait tourner que l'IA (`derive: false`, boîte automatique, ni guidage ni recul, course.js 375). La machine d'état de la dérive, le turbo, la boîte manuelle, le vol, le recul et les branches de choc sont interprétés à leur première exécution et peuvent désoptimiser `rouler`. Coût ponctuel supposé faible, non mesuré.
- Correctif proposé : Course de chauffe jetable pendant le préchargement : `B.course.creer` sur le même circuit, environ 600 pas avec des commandes scriptées (dérive tenue puis lâchée, rapports manuels, recul, mur, contact latéral à plus de 12 m/s, replacement), en tranches de 4 ms comme `finirClassement` (jeu.js 2409-2429).
- Risque : La course jetable ne doit toucher ni `B.meteo.actuel`, ni le son, ni les records de la vraie séance.

### simulation-tronc-sat-froid — gravité 2, confiance 0.35
- Où : src/obstacles.js : 36-58, 174-193 (calcul en rafale au choc)
- Quand : En course, au contact d'un tronc (prisme) : surtout le premier
- Mécanisme : `testerPrisme` parcourt 71 axes × 32 sommets (environ 2 300 produits scalaires), avec une fermeture `axe` par appel, un appel étalé `axe(...v)` et une déstructuration par arête ; le balayage le rappelle jusqu'à quatre itérations × (n + 10 dichotomies) par tronc proche. Jamais exécuté avant le premier contact : interprété à froid (supposition non mesurée).
- Correctif proposé : Dans `prisme`, ranger sommets, axes et arêtes dans des Float64Array et précalculer le rayon projeté du prisme sur ses 34 axes propres, qui est constant. Boucles indexées, sans fermeture ni étalement. Pendant le préchargement, quelques milliers d'appels de `B.obstacles.tester` sur un prisme et une boîte factices.
- Risque : L'ordre des axes fixe la normale retenue en cas d'égalité : le conserver ; troncs.test et obstacles.test.

### simulation-prismes-en-memoire — gravité 2, confiance 0.45
- Où : src/obstacles.js : 14-35, 60-86 ; decor.js 955, 1183-1189 ; jeu.js 150 (mémoire et ramasse-miettes)
- Quand : Au chargement du circuit (`installer`), puis en mémoire toute la séance
- Mécanisme : `creer` bâtit pour chaque tronc un prisme de 32 sommets, 34 axes et 17 arêtes, soit environ 85 petits tableaux : jusqu'à 2 600 arbres par circuit, donc de l'ordre de 220 000 objets et 10 Mo de tas (estimation), pour des troncs presque tous hors d'atteinte derrière les glissières. Ce tas vivant allonge le marquage des ramasse-miettes majeurs.
- Correctif proposé : Ne garder à la création que la boîte englobante du tronc ; calculer le prisme au premier recouvrement de cette boîte (`tester` le prévoit, l. 90, sans le conserver) et le garder, dans trois Float64Array plutôt qu'en tableaux de triplets. Ou ne précalculer que les troncs situés entre les glissières.
- Risque : Un prisme calculé à la demande alloue en course, au premier frôlement : coût d'un seul prisme, couvert par la chauffe.

### simulation-en-ligne-prolonger — gravité 2, confiance 0.6
- Où : src/reseau.js : 53-65 ; jeu.js 1213-1229, 2507 (allocations et rattrapage)
- Quand : Jeu en ligne seulement : à chaque pas pour chaque voiture distante (jusqu'à onze chez un invité)
- Mécanisme : `prolonger` avance l'état reçu par pas de 1/120 s, jusqu'à 0,35 s (42 itérations au pire), avec un `echantillon` alloué par itération ; `appliquerDistant` recrée une liste de douze noms de champs à chaque appel ; au retour d'une image longue, le rattrapage enchaîne jusqu'à 90 pas dans une image.
- Correctif proposé : Lire la seule courbure sans allocation ; liste de champs constante au niveau du module ; étaler le rattrapage (24 pas par image au plus) sur plusieurs images.
- Risque : La prolongation doit rester identique sur toutes les machines : mêmes pas, mêmes formules.

### simulation-physx-instancie-avant-titre — gravité 2, confiance 0.7
- Où : construire.py : 26, 131 ; src/ferro/physx.js 7-18 ; src/jeu.js 2717-2719 (chargement)
- Quand : Au chargement de la page seulement, jamais en course
- Mécanisme : construire.py enveloppe tout jeu.js dans `FERRO.initPhysics().then(…)` : décodage et instanciation du WASM précèdent l'écran titre, et un échec empêche le jeu de démarrer, à l'inverse du commentaire de jeu.js 2717-2718. Aucun effet en course : PhysX y est déjà en mémoire. Empreinte sur téléphone non mesurée (physx-runtime.js non lu).
- Correctif proposé : Garder ce chargement précoce, qui sert le « tout en RAM », mais rendre l'échec non bloquant (repli en parabole de traces.js 274 et 331-333) et, sur petite configuration, ne pas instancier PhysX du tout. Mettre le commentaire de jeu.js en accord avec construire.py.
- Risque : Sans l'enveloppe, l'instanciation en fond pourrait accrocher les menus : la garder derrière le voile initial.

### simulation-formes-tardives — gravité 1, confiance 0.3
- Où : src/course.js : 157, 159, 253-254, 282, 368-372 ; contacts.js 17, 41-46 ; obstacles.js 121-123, 155-158 ; jeu.js 202, 731-738 (désoptimisation possible)
- Quand : Premières secondes de chaque course, puis aux premiers événements de chaque voiture
- Mécanisme : Des champs sont ajoutés après coup aux objets chauds : `ia.dehors`, `bloque`, `entamee`, `attaque`, `retourBloque` (dans un ordre qui dépend de la voiture), `course._contactAvant`, `_paire`, `_obstacleMemo`, `etat.pneus`, `v.roule`, `rapportVu`, `tPassage`. Les formes cachées divergent d'une voiture à l'autre : accès polymorphes et désoptimisations possibles (supposition).
- Correctif proposé : Déclarer tous ces champs dès la création, dans le même ordre pour toutes les voitures : `voiture()` et `Object.assign(v.ia, …)` (course.js 76-88, 102-103), `conduite.creer` (103-123), objet rendu par `course.creer` (119-128).
- Risque : `replacer` fait `Object.assign(etat, creer())` : un champ ajouté à `creer`, comme `pneus`, serait remis à sa valeur initiale ; le préserver comme `degats`.

## Points d’entrée utiles

- `B.course.creer(c, o)` et `B.course.pas(course, cmd, 1/120)` (course.js:53, 560) : simulation pure, sans DOM, déjà avancée hors image par `BITUME_JEU.avancer` (jeu.js:2733-2739), `banc` (jeu.js:2831) et `finirClassement` (jeu.js:2409-2429, tranches de 4 ms par `setTimeout`) : modèle tout prêt pour une course de chauffe jetable et étalée.
- `demarrerSeance` (jeu.js:2364-2374) et le voile `#chargement` (style.css:227-228, fondu de 0,3 s ; aussi `demoSuivante`, jeu.js:2089-2096) : point d'insertion du préchargement ; `lancer` (jeu.js:172-237) est l'unique constructeur de séance.
- Vitrine des menus : `aller('preparation')` et le choix d'un circuit relancent `lancer('vitrine', i)` (jeu.js:2034-2036, 2193) ; décor, `B.obstacles.creer` (jeu.js:150) et tracé (`circuit(i)`, cache jeu.js:79-83 ; scène en cache jeu.js:141) sont donc bâtis avant « Départ », et le code de l'IA est déjà compilé.
- Phases `grille` (1,5 s) et `feux` (4,4 à 5,4 s) de `course.pas` (course.js:566-575) : voitures retenues par `retenir` (conduite.js:247-256), fenêtre d'environ 6 s pour finir une chauffe étalée.
- PhysX : `FERRO.initPhysics()` / `FPhysX.init()` (promesse mémorisée, physx.js:7-18), `isReady()`, `status()` (mondes, requêtes), `createWorld({fixedStep, maxSubSteps, ccdMaxPasses})`, puis `addBox(pos, demi, {type:'static'|'dynamic', ccd})`, `remove(id)`, `step(dt)`, `dispose()` (physx.js:88-157).
- `B.traces.creer(n, graine)` (traces.js:30-55) : bassins fixes (512 bandes, 96 pièces, 48 + 48 + 160 particules) et `monde: null`, l'endroit où créer et chauffer le monde ; `B.traces.liberer` (traces.js:287-302) le rend ; `B.traces.compter` et `B.mesures.pieces` (jeu.js:2545) exposent pièces et état PhysX.
- `B.obstacles.creer(liste)` (obstacles.js:60-86), bâti une fois par décor : y précalculer les boîtes englobantes et un drapeau de proximité par échantillon de piste. `B.obstacles.tester` et `B.contacts.tester` sont exportés, donc appelables pour chauffer le SAT.
- `lire(c, tab, s)` (course.js:45-48) : lecture interpolée sans allocation, à remonter dans circuit.js à côté de `echantillon`.
- Repli sans PhysX déjà écrit : pièces en parabole (traces.js:274, 331-333), utilisable sur petite configuration ou si l'initialisation échoue.
- Modules FERRO verrouillés présents dans src/ferro mais absents de MODULES (construire.py:23-67) : `loop.js` (FLoop : verrouillage sur la période d'écran, rattrapage borné, interpolation), `schedule.js` (FSchedule : file « frame » à budget de temps par image), `jobs.js` (FJobs : travaux en arrière-plan avec repli dans la page).
- Mesure : `B.mesures.section('simulation', ms)` (jeu.js:2502, 2518), `S.banc.effets` (jeu.js:743-745), `BITUME_JEU.banc()`, `reference()` et `mesures`, `tools/profil-accrocs.mjs` (attribue chaque image longue aux ramasse-miettes mineurs ou majeurs, option `--cpu 4`), `tools/banc-navigateur.mjs`.
- Garde-fous de déterminisme pour tout remaniement : verifications/course, conduite, conduite-criteres, contacts, collisions-orientees, obstacles, troncs, crash, pieces, ia*, traces (.test.mjs) ; `PHYSIQUE = 'p9'` (jeu.js:48) ne monte que si la conduite change réellement. Verrouillés (FERRO.lock.json) : vehicle-dynamics.js, physx.js, engine.js, loop.js.

## À mesurer

- Durée du premier débris d'une page : `createWorld` + `setStatics` + six `addBox` + premier `step`, sous Chrome, Firefox et Safari ; le WASM y est-il compilé à la première exécution, le tas WASM grandit-il à ce moment ? `tools/profil-accrocs.mjs` n'a pas de scénario de choc : en ajouter un.
- Taux d'allocation réel de la simulation et fréquence et durée des ramasse-miettes mineurs en course à douze voitures ; quelle part des 800 à 1 300 allocations par pas le compilateur élide-t-il par analyse d'échappement ?
- Nombre d'objets rendus par `voisins` pour une voiture sur la ligne droite des stands, circuit par circuit, et coût de `obstacles.pas` sur la grille et au départ (microsecondes par pas, aussi avec `--cpu 4`).
- Coût d'un pas de simulation à douze voitures (section « simulation » du volet de mesures) à 30, 60 et 120 Hz, et d'une image de rattrapage à 12 pas, sur une petite machine.
- Granularité de l'horodatage de requestAnimationFrame sous Safari et Firefox (1 ms ?) et gigue de déplacement qui en résulte ; FLoop se verrouille-t-il bien à 60 et 120 Hz sur les écrans visés ?
- Durée de `finTour` en chrono (relecture du fantôme, base64, `setItem`) sous Firefox et Safari.
- Cadence réelle de `playEffect` sur un vibreur et son coût sur le fil principal.
- Mémoire résidente due à PhysX (source de 12 Mo, binaire décodé, tas WASM) et aux prismes de troncs (10 Mo estimés) sur téléphone ; `decodeWasm` rend-il son tampon ? (physx-runtime.js n'a pas été lu.)
- Temps d'un `step` PhysX avec 72 pièces (carambolage des douze voitures) et coût de leur création dans un même pas.
- Le premier choc contre un tronc ou un mur de pneus produit-il une image longue (SAT exécuté à froid) ?
