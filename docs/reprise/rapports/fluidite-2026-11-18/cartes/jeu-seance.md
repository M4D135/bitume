# Carte des accrocs — jeu-seance

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

BOUCLE. image(t) (jeu.js 2477-2549), sur requestAnimationFrame : tBrut = t − tPrec, dtReel borné à 0,1 s (2482-2484) ; lireManette (367-427) ; accumulateur S.acc et pas fixes de 1/120 s par pasSimulation (711-748), 14 au plus (2513-2516) ; rendreImage(S, acc/DT) interpole S.prec et S.cour (melange 253-259 ; poses refaites à chaque pas par remplirPoses 243-252) ; majPalier (1400) ; majHud ; majSon. À 30, 60, 120, 144 Hz : 4, 2, 1, 0 ou 1 pas par image. oublierIntervalle (2471) au retour d'onglet.

LANCEMENT. « Départ » (2359) → demarrerSeance (2364-2374) : voile #chargement montré, minuteur de 30 ms, voile retiré, puis d'un seul bloc lancer (172-237) et aller('course') (2015). Ordre dans lancer : libération des traces de la séance morte (177) ; installer (134-163), qui réemploie la scène si circuit, ancre, végétation et saison sont inchangés (141), sinon B.decor.construire (decor.js 676-1251) puis setWorld, setNappes, setLots (151-153, envois GPU synchrones, renderer.js 2699-2741) et plan 2D (155-157) ; B.course.creer (183) ; fantôme lu dans localStorage en chrono (191-195) ; météo et pneus ; 12 B.voiture.modele (207) ; B.traces.creer (213) ; ambiance (215) ; poses (233). Le décor du circuit choisi est le plus souvent déjà installé par la vitrine, qui tourne derrière les menus (2035, 2149, 2193).

PREMIÈRE IMAGE DE COURSE, sans aucune chauffe : rattrapage de simulation ; sillage (1621) ; dans rendreVue (1689) : faune (1714, avec l'herbier paresseux de decor.js 1198-1216), effets de saison (1722), aurores (1735) ; premier dessin du cockpit ; majGlaces (1529) crée le second moteur FRender (1545-1548) et y renvoie tout le décor (1550-1556) ; premier HUD.

QUALITÉ. profilDe (1387) = B.graphismes.melange (graphismes.js 205-256), recalculé 3 à 5 fois par image ; gouverneur B.qualite.avancer (qualite.js 6-31) ; appliquerPalier → rendu.resize (1407) ; ancre du décor etatProfils (1384-1399). Après la détection du premier lancement (2634-2686) la qualité est fixe ; « auto » reste le défaut si elle est passée.

DÉMARRAGE DE LA PAGE. demarrer (2694-2730) : FRender.create, appliquerPalier, détection éventuelle, son, lancer('vitrine'), boucle. PhysX est prêt avant jeu.js (construire.py 131).

ALLOCATIONS DE LA COQUE, par image (solo, cockpit, 60 Hz) : ≈ 115 pour les profils, ≈ 64 pour deux pas (poses, commandes, vibration), ≈ 10 divers ; 128 pour les pas à 30 Hz, 32 à 120 Hz. Estimations lues dans le code, non mesurées. Le reste (objets de sortie, moteur, HUD) relève des autres sous-systèmes.

CE QUI EXISTE DÉJÀ. Scène réemployée (141) et ancre qui interdit de rebâtir le décor en course ; circuits en cache (79-83) ; formes du moteur enregistrées une fois avant FRender.create ; six programmes et leurs uniformes résolus à la création (renderer.js 2641-2655) ; pools de traces, de faune, de saison, de vitre ; détection du premier lancement, qui chauffe au passage les profils essayés ; voile de 340 ms pour la démo suivante (2089-2096) ; classement final étalé par tranches de 4 ms (2409-2429). Aucun rendu de chauffe, aucun préchargement des rétroviseurs.

## Constats

### jeu-seance-01 — gravité 5, confiance 0.9
- Où : src/jeu.js : 1529-1556 (création 1545-1548, copie du décor 1550-1556), 1512-1516 ; src/moteur/renderer.js 2385-2413, 2641-2695, 2699-2741 (allocation-gpu-tardive)
- Quand : En course : 1re image (Fine) ou 2e image (Moyenne) de la première course en vue cockpit, vue par défaut ; premier passage en cockpit (touche C, plan cockpit de la démo) ; première image cockpit après chaque nouveau décor. Jamais sur écran tactile (glaces peintes).
- Mécanisme : majGlaces crée le moteur des rétroviseurs au premier besoin : FRender.create rebâtit la géométrie de toutes les formes (renderer.js 2413), compile et lie six programmes en lisant LINK_STATUS, crée tampons et cibles. Puis, pour chaque nouvelle scène, setNappes et setLots sur des copies : tous les lots sont rempaquetés et renvoyés au GPU. Le tout dans une image de course ; la vitrine ne le chauffe jamais (retroVoulu exclut la vitrine).
- Correctif proposé : Extraire de majGlaces une fonction preparerRetro(scene) : créer retro.rendu une fois dans demarrer(), sous le voile initial ; recopier le décor et dessiner une image par glace pendant le chargement de chaque séance, dès que réglage et profil peuvent ouvrir les glaces, même en vue poursuite. En course, majGlaces ne fait que rendre ; si la scène n'est pas prête, il garde la glace peinte.
- Risque : Durée non mesurée (dépend du cache de programmes du navigateur). Le moteur verrouillé ne sait pas partager les lots empaquetés entre deux contextes : le double empaquetage reste, mais passe au chargement ; mémoire GPU du décor doublée dès le départ.

### jeu-seance-02 — gravité 5, confiance 0.9
- Où : src/jeu.js : 2364-2374 ; aussi 1115-1123 et 2083-2096 ; src/style.css 227-228 ; src/index.html 471 (prechargement)
- Quand : Au lancement de chaque course (Départ, Recommencer, Rejouer, en ligne) ; l'effet se voit dans les premières images de course.
- Mécanisme : demarrerSeance montre le voile puis, 30 ms plus tard, le retire avant d'appeler lancer : avec sa transition d'opacité de 0,3 s, il ne devient jamais opaque. Aucune image n'est dessinée avant aller('course') : tout ce qui naît au premier usage (constats 01, 03, 07, premier dessin du cockpit, premier HUD) se paie dans les premières images affichées, course déjà lancée. Même schéma en ligne (1115-1123).
- Correctif proposé : Faire de demarrerSeance une vraie phase de chargement : voile opaque sans transition, deux requestAnimationFrame, ecran = 'chargement' (la vitrine se fige, 2501), construction et créations de séance, puis trois à six rendus de chauffe sous le voile (vues cockpit et poursuite depuis la grille, variantes d'effets du profil) conclus par rendu.gl.readPixels d'un pixel ; enfin oublierIntervalle(), aller('course') et retrait du voile.
- Risque : Chargement plus long de quelques centaines de millisecondes. En ligne, le départ suit l'horloge commune T0 : la chauffe doit tenir avant T0. La première démo part depuis la boucle d'image (2079), sans voile : même traitement à prévoir.

### jeu-seance-03 — gravité 4, confiance 0.85
- Où : src/jeu.js : 1712-1719 (création 1714), 215-218 ; src/faune.js 22-97 (75, 90), 135-141 ; src/decor.js 1198-1216, 432-585, 569-582 (creation-paresseuse)
- Quand : Première image de chaque séance dont la faune est active (profils Moyenne et Fine) : course, Recommencer, démo. Plus rarement en pleine course, quand la faune passe de off à active (Auto du palier 4 vers 3 sur écran rapide, réglage changé pendant une pause).
- Mécanisme : lancer met nature.faune à null : rendreVue appelle B.faune.creer à la première image. habitats() parcourt jusqu'à 12 000 cellules puis fait jusqu'à 65 requêtes surfaceHerbe pour chacun des 1 536 habitats au plus, chacune allouant tableau et clé de texte. Si le décor n'a pas ouvert son herbier (thèmes islande, désert, asie, pacifique ; végétation low ou off), la première requête lance creerHerbier, qui découpe tous les triangles du sol.
- Correctif proposé : Créer la faune avec la scène : dans installer, lire decor.herbier pour le forcer, puis ranger B.faune.creer(c, decor) dans scene ; lancer le réemploie au lieu de null. La créer aussi quand le profil courant dit off mais que le réglage ou l'Auto peuvent l'ouvrir pendant la séance. Dans faune.js et decor.js, rendre les requêtes sans allocation (clé numérique, tableau réemployé).
- Risque : Durée non mesurée (estimation : dizaines à centaines de millisecondes). Les pools par vue garderaient l'état de la séance précédente : prévoir une remise à zéro.

### jeu-seance-04 — gravité 4, confiance 0.85
- Où : src/qualite.js : 4, 16-29 ; src/jeu.js 1400-1406, 2482, 2522 ; verifications/qualite.test.mjs 17-29 (cadence)
- Quand : En course, qualité Auto (défaut quand la détection a été passée ou interrompue, ou choix du joueur).
- Mécanisme : Seuils absolus : baisse si la moyenne dépasse 20 ms sur 3 s, remontée sous 14 ms pendant 8 s. À 30 images par seconde (écran 30 Hz, économie d'énergie), l'Auto perd un palier toutes les 3 s jusqu'au dernier ; à 60 Hz il ne remonte jamais (16,7 ms > 14 ms). majPalier reçoit tBrut non borné : l'image de chargement et les accrocs du départ comptent dans la première fenêtre.
- Correctif proposé : Mesurer la période T de l'écran (médiane des intervalles ; derniereDetection.cadence existe déjà) et exprimer les seuils en fractions de T : baisse si la moyenne dépasse 1,25 T. Décider la remontée d'après le temps de travail mesuré (B.mesures, rendu.profile) et non l'intervalle. Écarter de la fenêtre tout intervalle supérieur à 4 T et appeler oublierIntervalle() en fin de chargement.
- Risque : Le comportement actuel est figé par verifications/qualite.test.mjs (60 i/s : ni baisse ni remontée) : tests à réécrire. À 60 Hz, 0,5 s d'accrocs cumulés dans les 3 premières secondes suffit à perdre un palier pour toute la vie de la page.

### jeu-seance-05 — gravité 4, confiance 0.75
- Où : src/jeu.js : 1400-1407, 1419-1427, 1801 ; src/moteur/renderer.js 2516-2525, 2527-2549 (2530), 2554-2580 (2561-2576), 2808-2829 ; src/meteo.js 8, 165-179 (allocation-gpu-tardive)
- Quand : En course : changement de palier en Auto ; première pluie d'une météo variable (≈ 39 s après le début de la séance) en Fine ou Auto au palier 0.
- Mécanisme : Le moteur n'alloue ses cibles qu'au premier rendu qui s'en sert et les libère après 120 rendus sans usage. Un palier qui coupe puis rend ombres, halo ou anticrénelage fait recréer atlas d'ombres et tampon MSAA ; le palier 4 change la clé de ensureTargets : toile et cibles refaites. avecReflets (1420) ouvre les reflets quand l'eau dépasse 0,2 : cibles de reflet créées en pleine course.
- Correctif proposé : Au chargement, dessiner une image dans chaque variante que la séance peut atteindre : ombres, MSAA, halo coupé, reflets si la météo n'est pas fixée au sec. En course, n'autoriser que les baisses de palier ; remonter entre deux séances. Demander à la référence FERRO une option qui épingle les cibles pendant une séance (pas de libération à 120 rendus), plutôt qu'un contournement dans le jeu.
- Risque : Les allocations sont certaines ; leur durée et l'éventuelle compilation de pipeline au premier dessin dans une nouvelle cible (Metal, Direct3D) ne sont pas mesurées. Sans option du moteur, une cible chauffée puis inutilisée 120 rendus est de nouveau libérée.

### jeu-seance-06 — gravité 4, confiance 0.7
- Où : src/jeu.js : 1801 (adaptive, frameMs), 2484 ; src/moteur/renderer.js 1634-1651, 3052, 2819-2827, 2516-2525 ; src/graphismes.js 257-263 (allocation-gpu-tardive)
- Quand : En course, qualité Auto seulement (la résolution est un nombre fixe en Légère, Moyenne et Fine).
- Mécanisme : rendu.draw reçoit adaptive: true et frameMs = dureeImage. Le moteur baisse l'échelle de 0,1 après 1,3 s au-dessus de 25 ms, la remonte de 0,05 après 5 s sous 18,5 ms ; chaque marche change la taille de la toile, donc recrée cibles de scène, de halo, MSAA et reflets. Près de la limite l'échelle pompe sans fin ; à 30 images par seconde elle tombe à 0,65 en quatre marches.
- Correctif proposé : Passer adaptive: false et fixer la résolution par palier : un nombre choisi au chargement, changé seulement entre deux séances ou en pause. À défaut, normaliser frameMs par la période T de l'écran (frameMs × 16,7 / T) et le borner à 19 ms après une première baisse, ce qui interdit la remontée pendant la course.
- Risque : Le pompage dépend de la machine (supposition raisonnée, non mesurée). Une résolution fixe ne rattrape plus une scène ponctuellement lourde : le palier du jeu doit prendre le relais.

### jeu-seance-07 — gravité 3, confiance 0.85
- Où : src/jeu.js : 1621, 1720-1730 (1722), 1733-1741 (1735), 494-505 (497, 504), 1531-1532, 1549, 1670-1671 ; src/effets-saison.js 36-86 ; src/aurores.js 57-75 (creation-paresseuse)
- Quand : Première image de chaque séance ; première image d'une course à deux.
- Mécanisme : Autres créations au premier usage dans le chemin d'une image : B.sillage.creer (1621) ; B.effetsSaison.creer en automne et en hiver (1722 : masque le long de tout le tracé, neuf sondes de sol par cellule touchée, deux vues de 608 emplacements) ; B.aurores.creer à Lande-Noire (1735) ; à deux joueurs : contextes 2D de #scene2 et des glaces, pluie et vitre du joueur 2 (497, 504, 1549, 1670).
- Correctif proposé : Les créer dans lancer, ou les ranger dans scene pour effets de saison et aurores, qui ne dépendent que du circuit et du décor ; obtenir tous les contextes 2D au chargement. Garder les tests « if (!x) » comme garde-fou, avec un compteur de créations tardives dans B.mesures pour prouver qu'il reste à zéro pendant la course.
- Risque : Faible. Durées non mesurées ; la plus lourde est celle des effets de saison en automne (sources de feuilles de tous les arbres).

### jeu-seance-08 — gravité 3, confiance 0.9
- Où : src/jeu.js : 2364-2374, 2471-2476, 2482-2484, 2513-2516 ; en ligne 2505-2509 ; contre-exemple 2807 (cadence)
- Quand : Première et deuxième image de chaque course.
- Mécanisme : demarrerSeance ne remet pas tPrec à zéro : l'intervalle de la première image contient la durée de lancer, celui de la deuxième contient la première image et ses créations tardives. dtReel vaut alors jusqu'à 0,1 s : douze pas de simulation à douze voitures s'ajoutent à des images déjà longues, et la grille a avancé avant d'être vue. Seul reference() fait la remise à zéro (2807).
- Correctif proposé : Appeler oublierIntervalle() après la dernière image de chauffe, juste avant aller('course'), dans demarrerSeance, lancerEnLigne et lancerDemo ; remettre S.acc à 0 et dureeImage à la période de l'écran. Hors ligne, ramener le plafond de rattrapage à six pas (50 ms) : un accroc ne doit pas alourdir l'image suivante.
- Risque : Aucun hors ligne. En ligne, la simulation suit T0 et rattrape jusqu'à 90 pas par image (2507) : ne pas y toucher sans revoir la synchronisation.

### jeu-seance-09 — gravité 3, confiance 0.85
- Où : src/jeu.js : 134-163 (141-153), 1396-1399, 2035, 2149, 2193, 2381, 2404, 1115-1123, 2083-2095 ; src/decor.js 676-1251 ; src/moteur/renderer.js 2699-2741 (calcul-en-rafale)
- Quand : Au chargement : changement de circuit, de saison ou d'ancre. À l'entrée en course pour Recommencer ou Rejouer après un changement d'ancre, pour l'invité en ligne et pour chaque démo suivante.
- Mécanisme : installer rebâtit tout en un appel : B.decor.construire (terrain, glissières, jusqu'à 2 600 arbres, végétation, teinte de saison sommet par sommet), puis setNappes (concaténation, deux bufferData) et setLots (un pack et un à deux bufferData par lot). Aucun découpage : page figée, sans voile, dans un clic (2193), une promesse (2149) ou le minuteur de 30 ms. L'ancre bouge pendant une course (1396-1399) : le « Recommencer » suivant reconstruit.
- Correctif proposé : Découper installer en étapes (terrain, objets, végétation, envoi des nappes, envoi des lots) exécutées par tranches de quelques millisecondes, comme finirClassement (2409-2429), derrière le voile opaque. Garder en mémoire les deux derniers décors (clé : circuit, ancre, végétation, saison). Bâtir le décor dès que les conditions sont résolues sur l'écran de préparation, avec annulation si le choix change.
- Risque : Durée non mesurée (decor.js n'a été lu que pour construire et creerHerbier). Un décor gardé coûte ses tableaux et ses tampons GPU ; le moteur n'a qu'un jeu de nappes et de lots, donc seule la partie processeur se met en cache.

### jeu-seance-10 — gravité 3, confiance 0.8
- Où : src/jeu.js : 1895-1906 (1898, 1904), 1917 ; appels 799, 808, 812-813, 820-823, 843, 850-852, 857-859, 873 ; 632-637 (635-636) (dom)
- Quand : En course : feu vert, fin de tour, turbo, choc, replacement, contresens, place gagnée ; chaque mouvement du pouce sur le volant tactile.
- Mécanisme : message() et sousMessage() écrivent texte et classe puis lisent el.offsetWidth pour relancer l'animation : mise en page synchrone, au milieu d'un pas de simulation (traiter, finTour). Une fin de tour en provoque deux à quatre ; à deux joueurs, le double. Même procédé à la ligne 1917 (place gagnée). Le volant tactile lit clientWidth et offsetWidth puis écrit un style à chaque pointermove (635-636).
- Correctif proposé : Dans le pas, seulement mémoriser le message ; l'appliquer une fois par image dans majHud. Relancer l'animation sans lecture : el.getAnimations() puis cancel() et play(), ou alterner deux noms d'animation identiques. Volant tactile : mesurer la course au pointerdown et au resize, écrire le transform dans la boucle d'image seulement si la valeur a changé.
- Risque : La lecture forcée est certaine ; son coût dépend de la taille du HUD (non mesuré, plus sensible sur téléphone).

### jeu-seance-11 — gravité 3, confiance 0.7
- Où : src/jeu.js : 24-25, 44-46, 51-56, 674-681, 829-853 (833, 837-838, 847-849) (stockage-synchrone)
- Quand : En course : passage de la ligne (chrono : à chaque tour ; course : record du circuit) ; changement de vue (touche C, bouton Y, bouton tactile).
- Mécanisme : finTour, appelé dans le pas de simulation, relit le fantôme gardé (localStorage.getItem puis JSON.parse d'une chaîne base64 de plusieurs dizaines de ko) à chaque tour de chrono ; sur un meilleur tour il encode en base64, sérialise et écrit ; un record réécrit la clé des records. changerVue et changerVue2 réécrivent tous les réglages. Tout est synchrone, sur le fil principal, au passage de la ligne.
- Correctif proposé : Garder en mémoire le temps et la longueur du fantôme lus par lancer (191-195) : plus de relecture. Sortir toute écriture de l'image : file vidée par requestIdleCallback (repli setTimeout) et, dans tous les cas, à la pause, aux résultats et sur visibilitychange. Même file pour sauverReglages quand ecran vaut 'course'.
- Risque : Durée non mesurée (de moins d'une milliseconde à plusieurs selon le disque et la taille du fantôme). Une écriture différée peut se perdre si l'onglet est tué : vider la file sur visibilitychange et pagehide.

### jeu-seance-12 — gravité 3, confiance 0.75
- Où : src/traces.js : 272-282 (276), 253-269 (268), 287-295 ; src/jeu.js 177, 213 (creation-paresseuse)
- Quand : En course : premier choc de la séance qui détache une pièce ; chaque nouvelle zone d'accident.
- Mécanisme : B.traces.creer ne crée aucun monde physique : physique() appelle FPhysX.createWorld au premier débris de la séance, puis dalles() pose les sols statiques (setStatics, avec reduce et concat). lancer détruit ce monde à chaque séance (liberer, jeu.js 177). La création de la scène PhysX tombe donc dans l'image du premier accident, au moment où l'on regarde le plus.
- Correctif proposé : Créer le monde dans B.traces.creer dès que FPhysX.isReady() (PhysX est prêt avant jeu.js, construire.py 131), ou garder un seul monde pour toute la page et n'en retirer que les corps dans liberer. Poser pendant le chargement les dalles de sol de la grille et des premiers virages ; les suivantes par tranches, hors de l'image du choc.
- Risque : Coût de createWorld non mesuré ; traces.js n'a été lu que pour creer, pas, detacher, dalles, physique et liberer. Un monde partagé demande de vérifier qu'aucun corps ne survit d'une séance à l'autre.

### jeu-seance-13 — gravité 3, confiance 0.5
- Où : src/jeu.js : 2477-2521 ; 1700 et 1284, 1740, 1760 (cadence)
- Quand : En course sur écran 120 ou 144 Hz, et sur tout écran dont la période n'est pas un multiple de 1/120 s.
- Mécanisme : Les poses sont interpolées, mais plusieurs animations lisent co.horloge, qui n'avance que par pas : tremblement du casque (1284), main au levier (1760), aurores (1740). À 144 Hz, une image sur six n'a aucun pas : elles se figent une image. Par ailleurs rien ne régule la cadence : une machine qui met 9 à 10 ms par image sur un écran 120 Hz alterne des intervalles de 8,3 et 16,7 ms.
- Correctif proposé : Donner aux vues un temps continu : co.horloge + S.acc. Ajouter un régulateur dans image() : si le temps de travail lissé dépasse 0,9 T, ne rendre qu'un rappel sur deux (cadence stable de 2 T) et revenir à T après quelques secondes sous 0,6 T ; le gouverneur de qualité lit alors ses seuils sur la cadence choisie.
- Risque : L'alternance 8,3/16,7 ms est une supposition non vérifiée sur écran rapide. Un régulateur mal réglé ajoute de la latence : garder les entrées lues à chaque rappel.

### jeu-seance-14 — gravité 2, confiance 0.5
- Où : src/jeu.js : 172-237 (177, 206-219), 2035 ; src/traces.js 30-55 ; src/faune.js 116-134 ; src/effets-saison.js 22-35 (ramasse-miettes)
- Quand : À chaque lancer (entrée en course, retour au titre, démo suivante) ; l'effet tombe dans les secondes qui suivent, donc en début de course.
- Mécanisme : Chaque lancer recrée tout l'état : douze modèles (≈ 300 objets chacun), pools de traces (512 bandes et particules, ≈ 3 500 objets), puis faune (≈ 11 000) et effets de saison (≈ 7 000), tableaux typés. La séance précédente, la vitrine, meurt au même instant : 25 000 à 30 000 objets anciens, plus tout l'ancien décor s'il change, à ramasser pendant les premières secondes de course.
- Correctif proposé : Réemployer : modèles en cache par livrée et pneus, une remise à zéro des pools de traces au lieu de creer, états de nature rangés dans scene. Pour le reste, laisser le ramassage se faire sous le voile : quelques images de chauffe et deux à trois cents millisecondes d'attente avant aller('course'), pour que le marquage se termine avant la grille.
- Risque : Nombres estimés à la lecture ; aucune pause du ramasse-miettes n'a été mesurée. Le moment du ramassage majeur ne se commande pas : l'attente sous le voile ne fait que le rendre probable.

### jeu-seance-15 — gravité 2, confiance 0.9
- Où : src/jeu.js : 1387-1390, 1396-1399, 1403 ; appels 1515, 1534, 1540, 1661, 1691, 1761 ; src/graphismes.js 205-256, 39-42, 119-126, 184-190, 319-338 (ramasse-miettes)
- Quand : À chaque image, en course comme dans les menus.
- Mécanisme : profilDe rappelle B.graphismes.melange trois à cinq fois par image (neuf à deux joueurs) alors que ses entrées ne changent presque jamais. Chaque appel alloue ≈ 23 objets et tableaux (capacités, options, effets, rendu, seuils de halo, six objets du résultat, huit Object.keys de figer) et gèle treize objets ; s'y ajoutent stabiliser (1397) et le littéral d'options de majPalier (1403). Soit ≈ 120 allocations par image pour un résultat constant.
- Correctif proposé : Mémoriser le profil résolu : clé faite de la qualité, de palier.n, de etatProfils.decor, de l'identité de capacitesRendu et des quatre options ; ne rappeler melange que si la clé change. Calculer P une fois dans image() et le passer à rendreImage, rendreVue, retroVoulu et majGlaces. N'appeler stabiliser que lorsque palier.n ou la qualité changent, ou qu'une demande est en attente.
- Risque : Faible : le résultat est déjà figé (Object.freeze), donc partageable. Penser à invalider quand capacitesRendu est remplacé (2627, 2715) et quand S.banc impose une qualité.

### jeu-seance-16 — gravité 2, confiance 0.7
- Où : src/jeu.js : 711-748 (716-717, 721-729, 741), 243-252, 278, 434-447 (441-445), 451-483, 555-611 ; src/circuit.js 349-354 (ramasse-miettes)
- Quand : À chaque pas de simulation : 4, 2 ou 1 fois par image à 30, 60 ou 120 Hz ; vitrine et démo comprises.
- Mécanisme : Par pas, la coque alloue jusqu'à ≈ 32 objets : remplirPoses appelle douze fois B.circuit.echantillon (une fermeture et un objet à neuf champs chacun), commandesJoueur crée la commande et cinq fermetures (appuieSur), vibrationManette rend un tableau, même sans manette et en vitrine. secouerManette peut appeler playEffect à chaque pas quand l'intensité bouge de plus de 0,05 (vibreur, rupteur) : jusqu'à 120 appels par seconde.
- Correctif proposé : Ajouter echantillonDans(c, s, sortie), sans allocation, et l'employer dans remplirPoses ; ne recopier S.prec qu'avant le dernier pas de l'image. Réemployer un objet de commande par joueur ; remplacer some() par une boucle. Calculer la vibration une fois par image, seulement si pad.manette.vibrationActuator existe et si la séance est jouée, avec au plus un playEffect par image.
- Risque : Le compilateur peut déjà éliminer une partie de ces allocations (fonctions courtes mises en ligne) : compter au profil d'allocation avant de chiffrer le gain. S.cour sert à chaque pas aux traces (744) et aux replacements (742).

### jeu-seance-17 — gravité 2, confiance 0.6
- Où : src/jeu.js : 494-515 (502) ; src/meteo.js 88-107 (91, 95-96, 107) ; src/style.css 31, 37-39 ; src/vitre.js 43-46 (dom)
- Quand : À chaque image : sur tous les écrans pour #meteo, pendant la course pour .vitre.
- Mécanisme : dessinerMeteo appelle pluie.dessiner à chaque image : lecture de clientWidth et clientHeight, puis setTransform et clearRect de toute la toile avant le test « pas de pluie » (meteo.js 96, puis 107). Par temps sec, une toile 2D plein écran est donc salie et recomposée à chaque image, menus compris ; la toile .vitre reste affichée toute la course, vide. Deux couches transparentes plein écran de plus à mélanger.
- Correctif proposé : Tenir un drapeau « propre », comme vitre.js : sans pluie ni neige et toile déjà vide, ne rien faire. Mettre hidden sur #meteo et .vitre tant qu'elles sont vides, les rouvrir au premier trait. Lire leur taille au chargement et sur resize plutôt qu'à chaque image ; réemployer l'objet d'options passé à dessiner (502).
- Risque : Le gain de composition dépend du navigateur et du processeur graphique (non mesuré) ; surtout utile sur machines modestes et téléphones.

## Points d’entrée utiles

- demarrerSeance(type, conditions), src/jeu.js 2364-2374 : entrée unique des courses solo et à deux (Départ 2362, Recommencer 2381, Rejouer 2404) ; lancerEnLigne 1115-1123 et lancerDemo/demoSuivante 2083-2096 pour les autres. C'est là que se place la phase de chargement.
- Voile #chargement (src/index.html 471, src/style.css 227-228, classe « fini ») et état ecran === 'chargement', qui fige déjà la vitrine (jeu.js 2501). Le drapeau detectionGraphiqueActive met toute la boucle image() à l'écart (2480) pendant qu'un autre code dessine.
- installer(i, saison), jeu.js 134-163 : test de réemploi de la scène (141) ; l'objet scene (161) peut porter les caches liés au décor (faune, effets de saison, aurores, copie des rétroviseurs).
- rendu.calibrate(camera, objets, fx, images), src/moteur/renderer.js 3233-3243 : dessine N images avec readPixels d'un pixel (force le GPU à finir) et rend p50, p95 et refreshMs (période de l'écran). Présent dans le moteur, jamais appelé par le jeu.
- rendu.gl (renderer.js 3265) : contexte brut pour un readPixels de fin de chauffe ; rendu.draw(cam, sortie, options) accepte msaa, shadows, bloom, reflections, lights : une image par variante crée cibles et pipelines ; rendu.resize(resolution) recrée les cibles de scène.
- oublierIntervalle(), jeu.js 2471-2476 : remet tPrec, la fenêtre du gouverneur et les mesures à zéro ; reference() fait la même chose à la main (2807-2808).
- B.autoconfig.executer et B.sceneBench.creer (src/autoconfig.js 62-119, src/scene-bench.js 29-59) : modèle existant « préparer puis dessiner en chauffe sur trois points de vue » ; le résultat gardé sous 'bitume.detection.v1' contient cadence, la période d'écran mesurée en ms (derniereDetection.cadence).
- finirClassement, jeu.js 2409-2429 : modèle de travail étalé par tranches de 4 ms (setTimeout 0), réutilisable pour bâtir et envoyer le décor.
- Créateurs à appeler au chargement : scene.decor.herbier (accesseur, src/decor.js 1215), B.faune.creer(c, decor), B.effetsSaison.creer(c, decor), B.aurores.creer(c), B.sillage.creer(), B.meteo.creerPluie(toile), B.vitre.creer(toile), B.traces.creer(n, graine), FPhysX.createWorld (src/traces.js 276), bloc des rétroviseurs de majGlaces (jeu.js 1545-1556).
- Caches déjà en place : circuits[] (jeu.js 79-83 ; les sept tracés sont générés à la première ouverture de la préparation, 2185-2186), HERBIERS (decor.js 675, 1200), formes enregistrées une fois avant FRender.create (src/voiture.js 61-66, src/botanique.js 281-290, src/vegetation.js 323, src/aurores.js 46), programmes et uniformes résolus à la création (renderer.js 2641-2655).
- Profils : profilDe(S) 1387, etatProfils (ancre du décor) 1384, capacitesRendu 1385 et 2701, B.graphismes.melange et stabiliser, B.qualite.avancer(palier, 0, { actif: false }) pour vider la fenêtre du gouverneur.
- Mesure : B.mesures (touche F3 ; sections simulation, rendu, hud, son, effets ; temps GPU par rendu.profile()), BITUME_JEU.banc() et reference() (jeu.js 2751-2858), BITUME_JEU.avancer() (2733) ; pasSimulation(S, true) fait avancer la simulation sans rendu (2831).
- FRender.mesh(...) (renderer.js 3270-3276) : gabarit d'objet à forme stable, utile pour réemployer les objets de la liste de sortie.

## À mesurer

- Durée de la première et de la deuxième image de course par le vrai chemin (demarrerSeance), découpée : FRender.create des rétroviseurs (jeu.js 1546), setNappes et setLots des rétroviseurs (1553-1554), B.faune.creer (1714), B.effetsSaison.creer (1722), premier rendu.draw en cockpit. Le banc ne les voit pas : il passe par reference(), qui remet tPrec à zéro (2807), et écarte la première seconde (2838).
- Durée de installer par circuit, palier et saison : B.decor.construire, setNappes, setLots (marques autour de jeu.js 142-153), sur machine modeste et sur téléphone.
- Le second contexte WebGL profite-t-il du cache de programmes du navigateur (Chrome, Firefox, Safari) ? Chronométrer FRender.create sur #retro-rendu et la part de geometry() (renderer.js 2413).
- Sur Metal et Direct3D, le premier dessin dans une nouvelle cible (MSAA, sans halo, reflets, passe overlay du cockpit) compile-t-il un pipeline ? Mesurer l'image qui suit chaque changement de palier et la première pluie.
- Période réelle de l'écran et bridage de requestAnimationFrame à 30 images par seconde (économie d'énergie) sur les machines visées ; nombre de changements de palier et de marches d'échelle du moteur sur une course en Auto à 30, 60, 120 et 144 Hz.
- Ramasse-miettes : nombre et durée des passes majeures dans les 30 premières secondes d'une course ; allocations réelles par image après optimisation (profil d'allocation), pour vérifier les estimations de 115 par image pour les profils et de 32 par pas.
- Coût de message() (mise en page forcée, jeu.js 1898) et de la fin de tour en chrono (lecture, base64 et écriture localStorage, 847-849) sur ordinateur modeste et téléphone.
- Coût de FPhysX.createWorld au premier débris (traces.js 276).
- ctx.drawImage d'une toile WebGL vers une toile 2D (glaces 1604, #scene2 1672) : copie GPU ou relecture par le processeur selon le navigateur (Firefox, Safari) ?
- La manette vibre-t-elle pendant la vitrine et la démo ? pasSimulation (721-724) ne teste pas le type de séance avant vibrationManette et secouerManette.
