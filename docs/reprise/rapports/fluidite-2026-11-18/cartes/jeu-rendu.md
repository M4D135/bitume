# Carte des accrocs — jeu-rendu

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Racine : /Users/david/Projects/bitume (les chemins `src/…` lui sont relatifs). Rien n'a été exécuté : les comptes sont des estimations par lecture.

Chaque image, `image(t)` (jeu.js 2477-2549) avance la simulation (pas de 1/120 s, 14 au plus, 2513-2516), puis `rendreImage(S, alpha, dt)` (1616-1686) : poses interpolées (`melange` 253, `tampons.poses` 1620), sillage, roues et rebonds (1635-1642), météo (`majMeteo` 487), ambiance et `setEnvironment` sur révision (1645-1659). À deux, la vue du joueur 2 est rendue d'abord et copiée par `drawImage` dans `#scene2` (1664-1673).

`rendreVue` (1689-1818) reconstruit `S.sortie` : profil (`profilDe` 1387), caméra (cockpit 1275, poursuite 1296, télé 1314, démo 1336, sol 1357), soleil (1709), faune, saison et aurores (1712-1741), voitures (`B.voiture.poser`/`cockpit`, 1746-1765), fantôme (1767), feux (1776), traces (1786), lampes du tunnel (`lampesTunnel` 1471-1501, axe en cache par `preparerTunnel` 1436), puis `rendu.draw` (1801), `dessinerMeteo` (494-515 : toile 2D de pluie par image, visière à 30 Hz) et `majGlaces` (1529-1605).

`majGlaces` : second moteur FERRO sur `#retro-rendu` (second contexte WebGL, 330 × 100 px CSS), créé au premier usage (1545) ; décor copié et retéléversé à chaque nouvelle scène (1550-1556) ; par image : coins projetés et `matrix3d` des deux glaces (1557-1574), rendu d'une glace (1600), copie `drawImage` (1604).

Qualité Auto : `majPalier` (1400-1406) → `B.qualite.avancer` (fenêtre de 3 s, seuils fixes 20 et 14 ms), `appliquerPalier` (1407) → `rendu.resize`. Le moteur ajoute son gouverneur de résolution (renderer.js 1634-1652), nourri par `frameMs`. Ombres, MSAA et reflets sont alloués au premier draw qui s'en sert et libérés après 120 draws sans usage (renderer.js 2527-2580).

Son : `majSon` (1830-1867) remplit des objets réutilisés ; `son.mettreAJour` (son.js 215-253) programme une trentaine de paramètres par image.

Lancement : `demarrerSeance` (2364-2374) montre le voile 30 ms puis, dans la même tâche, le retire et appelle `lancer` (172-237) : `installer` (134-163 ; décor déjà bâti par la vitrine si circuit, palier et saison sont les mêmes), `B.course.creer`, douze `B.voiture.modele`, `B.traces.creer`, ambiance ; puis `aller('course')`. Tout le reste naît dans la première image, voile retiré : sillage, faune, effets de saison, aurores, pluie et visière, axe du tunnel, lampes, cibles du moteur, moteur des glaces et son décor, second moteur audio à deux.

Par image, en cockpit avec glaces vives : environ 13 000 allocations en course et 27 000 sur la grille (voitures : plus de 90 %) ; écritures DOM : 2 `transform`, 1 `drawImage` de glace, 1 effacement de `#meteo` (plus 1 `drawImage` de demi-écran à deux) ; une douzaine de lectures `clientWidth`/`clientHeight`. Aucun `readPixels`, `getError` ni `finish` côté jeu ; seuls appels synchrones : statuts de programmes et `checkFramebufferStatus` du moteur à chaque création.

## Constats

### jeu-rendu-01-retro-moteur-paresseux — gravité 5, confiance 0.85
- Où : /Users/david/Projects/bitume/src/jeu.js : 1545-1556 ; déclencheurs 1515 et 678-681 ; moteur : src/moteur/renderer.js 2385-2413, 2473-2483, 2641-2695, 2699-2741 (shaders, allocation GPU et téléversement au premier usage)
- Quand : Première image en vue cockpit avec glaces vives : juste après le voile ; en pleine course si l'on passe en cockpit, si Auto revient au niveau 0 ou à une coupe de démo. Le décor est retéléversé à la première image cockpit de chaque nouveau circuit.
- Mécanisme : `FRender.create` ouvre un second contexte WebGL2 dans l'image : géométrie recalculée, six programmes compilés et liés avec lecture synchrone des statuts, puis `setNappes` et `setLots` réempaquettent et retéléversent tout le décor (`pack` de chaque lot, `bufferData`). Plusieurs centaines de millisecondes d'un seul tenant. Le moteur persiste ensuite, mais le décor repart à chaque nouveau circuit.
- Correctif proposé : Extraire `preparerRetro(scene)` : création, `resize`, `setWorld`, `setNappes`, `setLots`, contextes 2D, un draw à blanc par glace. L'appeler depuis `lancer()` sous le voile dès que le réglage et le profil peuvent ouvrir les glaces, quelle que soit la vue de départ. `majGlaces` ne crée plus rien : sans moteur prêt, glace peinte.
- Risque : Allonge le chargement et double la mémoire GPU du décor même si le joueur reste en poursuite.

### jeu-rendu-02-premiere-image-creations — gravité 4, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1714, 1722, 1735, 497-505, 1621, 1635, 1778 ; src/faune.js 22-97 et 129-141 ; src/effets-saison.js 22-73 ; src/decor.js 1198-1216 et 1225-1227 ; src/son.js 221 (création paresseuse d'objets dans le chemin d'une image)
- Quand : Première image de chaque séance, voile déjà retiré ; en course si la faune sort de « off » (Auto 4 vers 3) ; première image à deux pour le son.
- Mécanisme : `B.faune.creer` balaie une dizaine de milliers de cellules, sonde jusqu'à 1 536 habitats par 65 appels à `surfaceHerbe` (qui bâtit l'herbier au premier appel si la végétation ne l'a pas ouvert) et alloue environ 8 000 objets de pools ; `B.effetsSaison.creer` environ 7 000 ; pluie et visière créent leurs toiles plein écran ; à deux, `m2 = moteur()` crée une trentaine de nœuds audio. Refait à chaque séance.
- Correctif proposé : `prechargerSeance(S)` en fin de `lancer()` : faune, effets de saison, aurores, sillage, axe du tunnel, lampes, pluie et visière des deux vues, second moteur audio. Garder habitats et masques dans `scene` (ils ne dépendent que du décor) et ne réinitialiser que les pools. Rendre deux images de chauffe sous voile opaque avant de le retirer.
- Risque : Un état de faune partagé entre séances doit être remis à zéro (époques, temps) pour ne pas téléporter les essaims.

### jeu-rendu-03-chargement-compte-par-auto — gravité 4, confiance 0.75
- Où : /Users/david/Projects/bitume/src/jeu.js : 2364-2374, 2482-2484, 2522, 1400-1406 ; src/qualite.js 16-28 ; contre-exemple 2807-2808 (cadence et gouverneur de qualité)
- Quand : Trois secondes après chaque départ en qualité Auto (course, chrono, duo, démo), dès que chargement et premières images dépassent environ 0,5 s à 60 Hz ; immédiatement si le chargement dépasse 3 s.
- Mécanisme : Le voile est retiré avant `lancer()` et `tPrec` n'est pas remis à zéro : l'intervalle du chargement entre brut dans `majPalier(S, tBrut)`. La moyenne de la première fenêtre de 3 s dépasse 20 ms : Auto monte d'un niveau (glaces vives ou ombres coupées), puis redescend après 8 s. Douze pas de simulation tombent aussi dans la première image.
- Correctif proposé : Voile opaque d'abord (deux `requestAnimationFrame` avant `lancer`), préchargement, images de chauffe, puis `oublierIntervalle()` et retrait du voile : horloge de course et fenêtre du gouverneur partent de zéro, comme le fait déjà `reference()` (2807-2808). Dans `majPalier`, ignorer tout intervalle supérieur à 100 ms.
- Risque : En ligne, le départ est daté sur l'horloge commune : la chauffe doit tenir dans les 4 s d'avance de T0.

### jeu-rendu-04-resolution-reallocations — gravité 4, confiance 0.7
- Où : /Users/david/Projects/bitume/src/jeu.js : 1400-1407, 1671, 1801 ; src/moteur/renderer.js 1638-1650, 2516-2525, 2808-2830, 3052 (allocation GPU tardive et redimensionnement de cibles)
- Quand : En course, qualité Auto : à chaque pas du gouverneur de résolution (toutes les 3 à 7 s près du seuil) et au passage des niveaux 3 et 4.
- Mécanisme : Chaque pas du gouverneur de résolution (−0,10 après 1,3 s lentes, +0,05 après 5 s rapides) change `canvas.width` : tampon de dessin, cibles de scène, halo, MSAA et reflets sont détruits puis recréés, `#scene2` aussi. Sous synchro verticale, une machine au seuil alterne 16,7 et 33 ms : le moteur oscille sans fin. À deux, il reçoit deux fois la même durée par image.
- Correctif proposé : Passer `adaptive: false` et piloter la résolution depuis le jeu : deux ou trois crans francs par `rendu.resize`, appliqués à l'arrêt (grille, pause, entre deux séances) ou une seule baisse par course, jamais de remontée en roulant. À deux, ne compter la durée d'image qu'une fois.
- Risque : Sans gouverneur fin, une machine faible reste lente jusqu'au prochain cran : choisir le cran initial par la détection graphique.

### jeu-rendu-05-reflets-cibles-tardives — gravité 4, confiance 0.7
- Où : /Users/david/Projects/bitume/src/jeu.js : 1419-1427, 1801 ; src/moteur/renderer.js 2494-2502, 2527-2580, 2648 ; src/meteo.js 42-63 (allocation GPU tardive au premier usage d'une option)
- Quand : En course quand la pluie arrive (météo variable : vers 38 s, un départ aléatoire sur trois) ; de nouveau après 120 draws sans reflets (2 s à 60 Hz, 1 s à deux ou à 120 Hz) ; à chaque palier qui rouvre ombres ou MSAA.
- Mécanisme : `avecReflets` passe à vrai quand l'eau atteint 0,2 : le moteur crée alors deux cibles (pleine résolution avec profondeur, demi-résolution), appelle `checkFramebufferStatus` (synchrone) et exécute pour la première fois le programme de reflets. Les cibles sont libérées après 120 draws sans usage. Même chemin pour le MSAA et l'atlas d'ombres quand un palier les rouvre.
- Correctif proposé : Au préchargement, un draw de chauffe avec `reflections: true`, MSAA, ombres, halo, une lampe et une particule. Demander à la référence FERRO une réservation des cibles pour la séance ; en attendant, si la météo de la séance peut mouiller la piste, garder `reflections` actif dès le départ pour ne jamais franchir le seuil en roulant.
- Risque : Reflets actifs sur piste sèche : coût de la passe d'écran à mesurer ; la compilation différée par le pilote n'est pas vérifiée.

### jeu-rendu-06-seuils-auto-absolus — gravité 4, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1401-1405, 1801 ; src/qualite.js 4 ; src/moteur/renderer.js 1638-1650 (cadence 30, 60, 120 et 144 Hz)
- Quand : Qualité Auto sur écran ou navigateur bridé à 30 Hz : dans les 12 premières secondes de chaque course ; sur écran 120 ou 144 Hz : en permanence.
- Mécanisme : Seuils fixes : niveau +1 si la moyenne dépasse 20 ms, résolution du moteur réduite au-delà de 25 ms. À 30 Hz (33 ms), Auto descend au niveau 4 en 12 s avec trois ou quatre réallocations de cibles, sans rien gagner. À 120 Hz, rien ne vise 8,3 ms : une cadence irrégulière entre 60 et 120 i/s passe pour confortable.
- Correctif proposé : Mesurer l'intervalle d'affichage (médiane des écarts de `requestAnimationFrame` au titre et pendant la chauffe), viser la plus haute cadence tenable parmi 30, 60 et 120, et exprimer les seuils en fraction de cet intervalle. Juger sur le temps de travail (`performance.now()`, `rendu.profile()`), et tenir une cadence stable en ne rendant qu'un rappel sur deux si nécessaire.
- Risque : Change la décision de qualité : à requalifier au banc à 30, 60 et 120 Hz.

### jeu-rendu-07-poses-voitures-allocations — gravité 4, confiance 0.6
- Où : /Users/david/Projects/bitume/src/jeu.js : 1746-1765, 1591 ; src/voiture.js 8-15, 27, 507-512, 521-543, 598-780 (ramasse-miettes : allocations par image)
- Quand : Chaque image, pour chaque vue (deux fois à deux, plus la glace).
- Mécanisme : Chaque pièce de chaque voiture est reposée par des fonctions qui rendent des tableaux neufs (`euler`, `mulM`, `angles`, `mul`) : environ 1 800 allocations par voiture complète (139 pièces dont 74 de roues), 5 000 pour le cockpit et ses fermetures. Estimation par lecture : 13 000 allocations par image en course, 27 000 sur la grille, soit plus de 1,5 million par seconde à 120 Hz.
- Correctif proposé : Pool par modèle : objets de sortie préalloués (`p` et `r` réutilisés) et matrices de travail sans allocation, comme `B.traces.dessiner` ; le moteur relit `p`, `s`, `r` à chaque draw (renderer.js 1559-1561), des objets mutés lui conviennent. Poser chaque voiture une fois par image pour toutes les vues ; pièces fixes du tableau de bord précalculées en repère voiture.
- Risque : `verifications/voiture.test.mjs` tient le cadrage : garder les mêmes valeurs numériques, objets partagés entre vues à ne pas muter (drapeau `overlay`).

### jeu-rendu-08-glaces-cadence-en-images — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1540-1543, 1576, 1600 ; src/graphismes.js 63, 80, 99 (cadence et coût permanent)
- Quand : Chaque image en cockpit avec glaces vives.
- Mécanisme : La cadence des glaces compte des images, pas du temps : à 120 ou 144 Hz, le second rendu complet de la scène tourne 120 à 144 fois par seconde (60 prévues) ; à 30 i/s chaque glace tombe à 15 Hz. Quand `saut` vaut 2 (profil Moyenne), le `return` de la ligne 1543 saute aussi la pose `matrix3d` : la glace ne suit son boîtier qu'une image sur deux.
- Correctif proposé : Cumuler `dtImage` par joueur et rendre une glace dès que le cumul atteint 1/(2 × hz) seconde ; passer ce cumul à `lampesTunnel`. Remonter le calcul des coins et de `matrix3d` (1557-1574) avant le test de cadence pour qu'il s'exécute à chaque image.

### jeu-rendu-09-joueur2-demi-cadence — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1667-1669 ; src/graphismes.js 64, 81 ; src/meteo.js 98-104 ; src/vitre.js 134 (cadence de la vue du second joueur)
- Quand : À deux, profil Légère ou Moyenne, ou Auto aux niveaux 2 à 4.
- Mécanisme : La vue du joueur 2 est rendue une image sur deux, à la parité et non au temps, mais reçoit le `dtImage` d'une seule image : lissage de caméra, secousse, adaptation, lampes et visière avancent à mi-vitesse, et la pluie calcule une vitesse de caméra doublée (déplacement de deux images divisé par une durée). À 120 Hz il a 60 i/s, à 30 Hz 15.
- Correctif proposé : Cumuler `dtImage` dans la vue du joueur 2 à chaque image, passer ce cumul à `rendreVue` quand la vue est rendue, puis le remettre à zéro. Décider du saut au temps écoulé (au moins 1/hz seconde) plutôt qu'à la parité de `S.j2Image`.

### jeu-rendu-10-temps-rendu-non-interpole — gravité 3, confiance 0.75
- Où : /Users/david/Projects/bitume/src/jeu.js : 1767-1773, 1340-1352, 1700, 1740, 1786 ; src/course.js 645-661 ; src/traces.js 67-69 et 360-398 (cadence et interpolation)
- Quand : Chrono avec fantôme, démo (orbite, travelling), particules : dès que la fréquence d'affichage n'est pas un multiple exact de 120 Hz (144, 165, 100, 75 Hz) ; à-coups isolés à 59,94 Hz.
- Mécanisme : Les voitures sont interpolées par `alpha`, mais le fantôme est échantillonné à `course.temps`, les caméras de démo et le casque à `course.horloge`, les particules à `fx.acc` : tous quantifiés au pas de 1/120 s. À 144 Hz, une image sur six n'a aucun pas : le fantôme se fige (0,67 m d'écart à 290 km/h). À 59,94 Hz, un à-coup toutes les 8 s environ.
- Correctif proposé : Calculer une fois dans `rendreImage` le temps rendu (horloge − DT + alpha × DT), le ranger dans `S`, et l'utiliser pour le fantôme (décalage optionnel ajouté à `B.course.fantome`), `cameraDemo`, le tremblement du casque, les aurores et l'extrapolation de `B.traces.dessiner`.
- Risque : Affichage seul : la simulation et les fantômes enregistrés ne changent pas (PHYSIQUE inchangée).

### jeu-rendu-11-toile-meteo-effacee — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/meteo.js : 91-96, 107, 119, 150-160 ; src/jeu.js 497-502 ; src/style.css 31 (DOM : toile 2D plein écran à chaque image)
- Quand : Chaque image, même par temps sec et sur l'écran titre ; plus lourd sous la pluie.
- Mécanisme : `dessiner` lit `clientWidth` et `clientHeight`, puis fait `setTransform` et `clearRect` avant de tester la pluie : la toile `#meteo` plein écran (jusqu'à 1,5 fois la densité) est salie et recomposée à chaque image sans rien montrer. Sous la pluie : jusqu'à 840 segments à bouts ronds en trois tracés, quel que soit le profil. jeu.js alloue un objet d'options par image.
- Correctif proposé : Drapeau `propre` comme dans vitre.js (27-31, 141) : n'effacer que si l'image précédente a dessiné ; masquer la toile (`hidden`) quand la pluie est sous 0,025. Nombre de gouttes selon `profil.palier`, `lineCap = 'butt'`, taille tenue par un `ResizeObserver`, objet d'options réutilisé.

### jeu-rendu-12-partage-copie-toile — gravité 3, confiance 0.5
- Où : /Users/david/Projects/bitume/src/jeu.js : 1669-1672 ; src/style.css 501-506 (DOM : copie de la toile WebGL vers une toile 2D)
- Quand : À deux, chaque image (ou une sur deux selon le profil).
- Mécanisme : `ctx2.drawImage(canvas, 0, 0)` recopie la toile WebGL (une moitié d'écran) dans une toile 2D : vidage forcé du contexte WebGL puis copie GPU, ou relecture synchrone vers le processeur si la toile 2D n'est pas accélérée (non vérifié, dépend du navigateur). Le contexte 2D garde son canal alpha et `t2.width` est réalloué à chaque changement de résolution.
- Correctif proposé : Court terme : `getContext('2d', { alpha: false })`, `globalCompositeOperation = 'copy'`, résolution figée à deux. Sur le fond : une option `viewport` dans la référence FERRO pour dessiner les deux vues dans la même toile, sans copie ni seconde toile, propagée par version qualifiée.
- Risque : L'option de fond touche un module verrouillé : passer par la référence FERRO.

### jeu-rendu-13-profil-recalcule — gravité 2, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 1387-1390, 1515, 1540, 1661, 1691, 1761 ; src/graphismes.js 113-126, 184-190, 205-256 (coût permanent : travail refait sans changement)
- Quand : Chaque image : 5 appels en solo cockpit, 9 à deux.
- Mécanisme : `profilDe` refait `B.graphismes.melange` à chaque appel : deux `normalize('NFD')` avec expression régulière, `Object.assign`, `Object.keys`, une fermeture, une dizaine d'objets neufs gelés en profondeur par `figer`. Environ 24 allocations par appel, 120 à 220 par image, pour un résultat qui ne change qu'avec le menu ou le palier.
- Correctif proposé : Mémoriser dans `profilDe` : clé faite de la qualité, de `palier.n`, de `etatProfils.decor`, de `capacitesRendu` et des quatre options ; ne rappeler `melange` que si elle change. Passer `P` à `retroVoulu` et à `majGlaces` au lieu de le redemander.

### jeu-rendu-14-glaces-dom-par-image — gravité 2, confiance 0.6
- Où : /Users/david/Projects/bitume/src/jeu.js : 1519-1528, 1557-1574, 1600-1604 ; src/style.css 34-35 ; src/moteur/renderer.js 2821 (DOM : écritures de style et lecture forçant le recalcul)
- Quand : Chaque image en cockpit avec glaces vives.
- Mécanisme : Deux chaînes `matrix3d` (16 `toFixed` chacune) sont écrites dans `style.transform` sans comparaison ; `retro.rendu.draw` lit ensuite `canvas.clientWidth` : recalcul de style synchrone à chaque image, trois à deux. Les glaces portent `filter` et `border-radius`. L'image passe par `drawImage` WebGL vers 2D sur une toile de 330 × 100 px : relecture synchrone possible à densité 1 (non vérifié).
- Correctif proposé : Dessiner d'abord, écrire les `transform` en fin d'image et seulement si la chaîne change (arrondi à 4 décimales). Remplacer le filtre CSS par un assombrissement à la copie (fond noir puis `globalAlpha = .9`) ; contexte 2D sans alpha.

### jeu-rendu-15-glace-voiture-entiere — gravité 2, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1567, 1579-1595, 1600 ; src/voiture.js 203-210, 521-543 (coût permanent et allocations)
- Quand : Chaque image où une glace est rendue.
- Mécanisme : Pour montrer la roue arrière, `B.voiture.poser` repose les quelque 139 pièces de la voiture (environ 1 800 allocations) puis une centaine de `splice(k, 1)` n'en gardent qu'une quarantaine. S'y ajoutent `glacesCockpit` (environ 85 allocations), `camR`, l'`Object.assign` du soleil, l'objet d'options du draw et la clé `'lampes' + i`.
- Correctif proposé : À la construction du modèle, ranger la liste des pièces de roue arrière et ne poser qu'elle. Réutiliser `camR`, son soleil et l'objet d'options ; clés `lampes0` et `lampes1` constantes ; `glacesCockpit` avec sortie réutilisée.

### jeu-rendu-16-son-par-image — gravité 2, confiance 0.7
- Où : /Users/david/Projects/bitume/src/jeu.js : 1830-1867 ; src/son.js 194-253, 221, 119, 261-315 (audio : paramètres par image et nœuds créés en course)
- Quand : Chaque image ; première image à deux ; chaque changement de rapport ou choc.
- Mécanisme : `son.mettreAJour` pousse environ 29 `setTargetAtTime` par image (42 à deux), sans seuil ni cadence propre : 3 500 à 5 000 événements par seconde à 120 Hz. `m2 = moteur()` naît dans la première image à deux (une trentaine de nœuds, courbe de 2 048 `tanh`). Chaque changement de rapport ou choc crée 3 à 5 nœuds et une fermeture `onended`.
- Correctif proposé : Borner la mise à jour audio à 60 Hz par cumul de temps et sauter les paramètres dont la cible n'a pas bougé. Créer `m2` dans `init()` ou sous le voile d'une course à deux, avec une courbe de saturation partagée. Voix ponctuelles préconstruites : filtre et gain réutilisés, seule la source est neuve.
- Risque : `verifications/son.test.mjs` contrôle les signaux : garder hauteurs et enveloppes.

### jeu-rendu-17-lectures-mise-en-page — gravité 2, confiance 0.7
- Où : /Users/david/Projects/bitume/src/jeu.js : 1269, 1286, 1291, 1561, 1568, 1898, 1904, 1917 ; src/meteo.js 91 ; src/vitre.js 44-45 ; src/moteur/renderer.js 2821 (DOM : lectures forçant la mise en page)
- Quand : Chaque image ; à chaque message de course et à chaque place gagnée.
- Mécanisme : `clientWidth` et `clientHeight` sont relus par les caméras, la pluie, la visière, les glaces et chaque `draw` : une douzaine de lectures par image. `message`, `sousMessage` et l'éclat de position écrivent texte et classe puis lisent `offsetWidth` pour relancer l'animation : mise en page synchrone en pleine image, deux fois de suite à deux.
- Correctif proposé : Un `ResizeObserver` sur `#scene` et `#retro-rendu` tient largeur, hauteur et rapport dans des variables que lisent caméras, pluie et glaces. Relancer les animations sans relecture : `getAnimations()` puis `cancel()` et `play()`, ou alternance de deux noms d'animation identiques.
- Risque : Le `resize` du moteur (module verrouillé) continue de lire la taille à chaque draw.

### jeu-rendu-18-petites-allocations — gravité 2, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1206, 1228, 1283-1287, 1302, 1707-1709, 1748, 1751-1761, 1781, 1801, 502, 678-681 (ramasse-miettes et stockage synchrone)
- Quand : Chaque image, chaque pas de simulation en ligne, chaque changement de vue.
- Mécanisme : Une centaine d'objets courts par vue : caméra et `pos`, `fwd`, `Object.assign` du soleil, `ev` et `p` par voiture, `derriere` et son tri, options du cockpit et du draw, trois objets par feu du portique. En ligne, un tableau littéral de douze clés par voiture distante et par pas (1228). `changerVue` écrit `localStorage` de façon synchrone en course.
- Correctif proposé : Objets de travail au niveau du module (caméra, soleil, options), feux du portique construits dans `lancer`, constante pour les champs distants, `derriere` trié par insertion dans un tableau réutilisé. Différer `sauverReglages` à la pause ou à la fin de la séance.

## Points d’entrée utiles

- `lancer(type, i, enl, conditions)` — src/jeu.js 172-237 : point unique de création d'une séance ; y accrocher le préchargement (toutes les entrées y passent : course, chrono, duo, démo, vitrine, en ligne).
- `installer(i, saison)` — src/jeu.js 134-163 : cache de scène par circuit, enrichissement, palier ancre, végétation et saison ; la vitrine de la préparation le remplit déjà avant le départ (2035, 2149, 2193), programmes du moteur principal compris.
- Voile `#chargement` (src/style.css 227-228, transition d'opacité de 0,3 s) piloté par `demarrerSeance` 2364-2374, `lancerEnLigne` 1115-1124, `demoSuivante` 2089-2096 : à tenir opaque pendant préchargement et images de chauffe.
- `oublierIntervalle()` — src/jeu.js 2471-2476 : remet `tPrec`, la fenêtre du gouverneur et les mesures à zéro ; `reference()` 2807-2808 montre la remise à zéro complète (horloge, palier, états des glaces).
- Bloc 1545-1556 de `majGlaces` à extraire en `preparerRetro(scene)` ; l'état `retro` (1511) persiste entre séances, `retro.echec` sert de repli vers la glace peinte.
- `rendu.draw(cam, [], options)` : un draw de chauffe avec toutes les options force `ensureShadowTarget` et `ensureOptionalTargets` (src/moteur/renderer.js 2527-2580) ; `rendu.resize(resolution)` (2808) ; `rendu.setWorld`, `setNappes`, `setLots`, `setEnvironment`.
- `rendu.calibrate(camera, dynamic, fx, frames)` — src/moteur/renderer.js 3233-3242 : dessine des images synchronisées et rend p50, p95 et `refreshMs`, l'intervalle d'affichage médian ; utilisable pour la chauffe et pour connaître la fréquence de l'écran.
- Créateurs à appeler au chargement : `B.faune.creer` (src/faune.js 135), `B.effetsSaison.creer` (src/effets-saison.js 36), `B.aurores.creer` (src/aurores.js 57), `B.sillage.creer` (src/sillage.js 6), `B.meteo.creerPluie` (src/meteo.js 77), `B.vitre.creer` (src/vitre.js 20), `preparerTunnel(c)` (jeu.js 1436), `nouvelEtatLampes` (1464).
- `decor.herbier` et `decor.surfaceHerbe` (src/decor.js 1198-1216) : ouvrir l'herbier pendant `installer` ; cache `HERBIERS` par circuit et clé de qualité.
- `son.demarrer()` et `init()` (src/son.js 148-184) : y créer le second moteur `m2` ; `son.stats()` donne les voix actives.
- `profilDe(S)` 1387, `majProfils` 1396, `etatProfils` (ancre du décor) et `B.graphismes.stabiliser` : le décor n'est déjà jamais rebâti en course ; `B.qualite.avancer(palier, 0, { actif: false })` vide la fenêtre du gouverneur ; `appliquerPalier()` 1407.
- Mesure : `BITUME_JEU.banc`, `.reference`, `.avancer`, `.mesures` (2859-2868) ; `B.mesures.section` et `B.mesures.vue('retro', …)` ; `rendu.profile()` (temps GPU) et `rendu.stats` (`uploadBytes`, `drawCalls`).
- Modèles sans allocation déjà présents à imiter : `B.traces.dessiner` (src/traces.js 360-398), `tampons.poses` (jeu.js 1613-1620), `lampesTunnel` (1471-1501), `sonCandidats` (1857), pools de `B.faune` et `B.effetsSaison`.

## À mesurer

- Durée de `lancer()` et de la première image après le voile, poste par poste (faune et herbier, effets de saison, moteur des glaces et son décor, premier draw de glace), sur une machine faible et sur le Mac.
- Débit d'allocation et fréquence et durée des ramassages mineurs en cockpit, sur la grille puis en course : l'estimation de 13 000 à 27 000 allocations par image vient de la lecture, pas d'une mesure.
- `drawImage` de la toile WebGL vers une toile 2D : copie GPU ou relecture synchrone ? À vérifier pour la glace de 330 × 100 px à densité 1 et pour le demi-écran à deux, sous Chrome, Firefox et Safari.
- Coût en millisecondes d'un pas de résolution (redimensionnement et recréation des cibles) et nombre de pas par course en Auto, à 30 Hz et sur une machine proche du seuil de 25 ms.
- Auto monte-t-il bien d'un niveau trois secondes après le départ ? Journal de `BITUME_JEU.palier` sur les quinze premières secondes d'une course, puis d'une démo suivie d'une course.
- Premier usage des programmes de reflets, de particules et de profondeur : le pilote (ANGLE sous Windows) compile-t-il à ce moment ? Mesurer l'image où `avecReflets` devient vrai.
- Coût de la toile de pluie (environ 630 segments à bouts ronds) et de la composition des couches plein écran `#meteo`, `#vitre` et `#vignette` sur un processeur graphique intégré.
- Mémoire GPU du décor doublée par le moteur des glaces (nappes et lots téléversés dans deux contextes) : taille réelle sur le plus grand circuit.
- `fx.brightness` n'est lu que par `bindScreen`, inactif sans `options.composition` (src/moteur/renderer.js 2613, 3055) : l'adaptation de l'œil du tunnel (jeu.js 1793-1801) a-t-elle un effet à l'écran ?
- Le banc écarte la première seconde et fige la qualité (jeu.js 2822, 2838) : ni la première image ni les pas d'Auto ne sont mesurés. Ajouter une mesure du départ (images 0 à 300, voile compris) et une course en Auto.
- Coût sur le fil principal des 29 à 42 `setTargetAtTime` par image à 120 Hz, et de la création de nœuds à chaque changement de rapport.
- Écart réel entre deux rappels de `requestAnimationFrame` à 30, 60, 120 et 144 Hz et nombre de pas de simulation par image : confirmer l'à-coup du fantôme et des caméras de démo hors multiples de 120 Hz.
