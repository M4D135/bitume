# Carte des accrocs — renderer-ressources

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Moteur WebGL2 en un fichier, copie exacte de la référence FERRO (cmp identique) : toute correction interne passe par la référence ; certains correctifs tiennent côté jeu.

Créé à create (2385-2695) : contexte (2387) ; geometry() réunit toutes les formes, formes libres comprises, dans un VBO et un IBO (1269-1371, 2657-2660) ; initialize (2641-2694) compile et lie en série six programmes — SSR, monde, profondeur, post, ciel, effets (2647-2649) — et lit tous les emplacements d'uniformes (2648-2655, 2684). Dans la configuration de BITUME (ni composition, ni advancedSky, ni sceneReflections), aucune variante de shader et aucun getUniformLocation n'arrivent plus tard. S'ajoutent deux VAO, des tampons sans stockage (objets, habitacle, effets, sonde, caches : 2662-2668), une texture blanche et trois tableaux PBR 1×1 (2672-2681). Aucune cible de rendu.

À resize (2808-2830) : taille de toile lue sur clientWidth (2821), puis ensureTargets (2516-2525) : scène RGBA8 avec profondeur et deux cibles de halo au quart, sous la clé « taille:qualité ».

À setWorld (2785-2797) : monde vide pour BITUME, caches vidés, échelle Auto remise à 1 (2794). setNappes → chargerNappes (2699-2720) : un VAO, un VBO, un IBO statiques. setLots → chargerLots (2731-2740) : pack, un ou deux tampons statiques par lot (proche, lointain), plan d'herbe. Passer de proche à lointain ne téléverse rien.

Seulement au premier draw qui s'en sert : atlas d'ombres (ensureShadowTarget, 2527-2549), tampon MSAA 4× et paire de cibles de reflets (ensureOptionalTargets, 2554-2580), tous détruits après 120 draws sans usage ; stockage des tampons d'objets, d'habitacle et d'effets (bufferData à chaque image : 3095, 2834).

draw (3050-3210) : gouverneur de résolution (1634-1651, 3052), resize, cibles, empaquetage des objets (instancePacker, 1549-1564), ombre du soleil (2913-2956), ciel (2961), nappes (2722), lots (2742), objets, effets (2886), habitacle (3192-3203), résolution du MSAA (3204-3208), reflets (2972), halo (2977). Aucun appel synchrone GPU vers CPU par image : readPixels n'existe que dans calibrate (3238) ; checkFramebufferStatus et getParameter(MAX_SAMPLES) ne servent qu'à la création des cibles (2500, 2506, 2512, 2545).

Perte de contexte : lost et restored (3211-3217) refont initialize, nappes et lots ; les cibles reviennent au draw suivant.

Ordre au lancement d'une course (src/jeu.js) : lancer (172) appelle installer (134-163) — construction du décor, setWorld, setNappes, setLots — puis crée course, modèles et traces. La première image fait le reste : draw crée les cibles manquantes, puis majGlaces crée un second moteur complet pour les rétroviseurs et lui recopie le décor (1545-1556). Aucun écran de chargement ni image de chauffe entre le clic et le départ.

Rien ne préchauffe aujourd'hui : create ne trace rien, draw crée à la demande, calibrate n'est appelé par personne. Il manque une fonction qui réserve et retient les cibles de toutes les options, trace une fois chaque programme dans chaque format de cible et chaque tampon de lot, puis attend le GPU.

## Constats

### renderer-ressources-retro-moteur-paresseux — gravité 5, confiance 0.9
- Où : src/jeu.js : 1545-1556 (appelle src/moteur/renderer.js 2385-2695, 2699-2741) (création paresseuse (contexte, shaders, décor))
- Quand : En course : première image en vue cockpit avec image des rétroviseurs, puis première glace après chaque changement de circuit
- Mécanisme : majGlaces crée un second moteur dans la boucle d'image : nouveau contexte WebGL2, geometry() de toutes les formes libres, douze compilations et six éditions de liens synchrones, trois cibles. Puis setNappes et setLots recopient, re-empaquettent et téléversent tout le décor dans ce contexte, dont aucun pipeline n'a encore servi.
- Correctif proposé : Créer ce moteur au démarrage, juste après le moteur principal. Dans installer(), lui passer setWorld, setNappes et setLots en même temps qu'au principal. Tracer une image de chauffe par glace avant le départ et créer alors les contextes 2D des glaces. Ne rien créer si le profil refuse les images de rétroviseurs.
- Risque : Mémoire GPU prise même si le joueur ne passe jamais en vue cockpit ; le chargement s'allonge du temps d'un second create.

### renderer-ressources-echelle-auto-realloue — gravité 5, confiance 0.8
- Où : src/moteur/renderer.js : 1634-1651, 2515-2525, 2823-2827, 3052 (allocation GPU tardive (redimensionnement des cibles))
- Quand : En course, qualité Auto : à chaque pas d'échelle du gouverneur (−0,1 après 1,3 s lentes, +0,05 après 5 s rapides)
- Mécanisme : Chaque pas d'échelle change canvas.width et canvas.height. ensureTargets voit une autre clé : freePost détruit scène, halo, MSAA et reflets, puis tout est recréé dans la même image (texImage2D, renderbufferStorageMultisample, checkFramebufferStatus synchrone). La réallocation tombe quand la machine peine déjà, et de nouveau à chaque remontée.
- Correctif proposé : Côté jeu : adaptive:false pendant la course et ratio numérique fixé avant le départ d'après la détection. Dans la référence FERRO : cibles allouées une fois à la taille maximale, échelle appliquée par viewport et par facteur d'UV dans le post-traitement, sans toucher à la taille de la toile.
- Risque : Sans échelle dynamique, une machine sous-estimée reste lente toute la course : la détection doit garder une marge.

### renderer-ressources-aucune-prechauffe — gravité 4, confiance 0.9
- Où : src/moteur/renderer.js : 2550-2553, 3050-3054, 3233-3243, 3265 ; src/jeu.js 134-163, 172-237 (préchargement absent (API manquante))
- Quand : Entre le clic de lancement et la première image de course
- Mécanisme : L'API publique (ligne 3265) n'offre ni réservation, ni rétention, ni chauffe : create ne trace rien, draw crée à la demande (commentaire 2550-2553), calibrate n'est appelé par personne. Le jeu passe d'installer() à la première image de course sans écran de chargement ni image de chauffe.
- Correctif proposé : Référence FERRO : prechauffer(options) qui réserve et retient les cibles de toutes les options, trace chaque programme dans chaque format de cible et chaque tampon de lot dans un pixel, puis rend une promesse résolue par fenceSync et clientWaitSync. En attendant, côté jeu : draws de chauffe puis readPixels 1×1 derrière un voile, sur le modèle de la détection graphique.
- Risque : La chauffe allonge le lancement de chaque course ; elle doit rester derrière un voile et ne rien écrire dans les records.

### renderer-ressources-cibles-premier-usage — gravité 4, confiance 0.85
- Où : src/moteur/renderer.js : 2527-2549, 2554-2580, 3054 (allocation GPU tardive (reflets, MSAA, atlas d'ombres))
- Quand : En course : première image mouillée (reflets), première image d'un palier qui rouvre ombres ou MSAA, changement d'échelle d'atlas ; première image d'une course à deux (taille de toile)
- Mécanisme : Les options de création n'allouent rien. draw crée à la demande : pour les reflets, une cible couleur avec texture de profondeur pleine taille et une cible demi-taille ; pour le MSAA, deux renderbuffers 4× ; pour les ombres, une texture de profondeur jusqu'à 2 048². Chaque création ajoute un checkFramebufferStatus synchrone.
- Correctif proposé : Avant le départ, tracer une image de chauffe avec toutes les options que la course peut activer : shadows:true à l'échelle du profil, msaa:true, bloom:true, reflections:true, à la taille de toile de la course (écran partagé compris). Les cibles existent alors avant le feu vert.
- Risque : Les cibles créées à la chauffe repartent après 120 draws sans usage : à coupler avec renderer-ressources-liberation-120-draws.

### renderer-ressources-liberation-120-draws — gravité 4, confiance 0.85
- Où : src/moteur/renderer.js : 2530, 2562-2563, 2574-2577 (allocation GPU tardive (libération puis recréation))
- Quand : En course : 120 draws après l'arrêt d'une option (2 s à 60 Hz, 1 s à 120 Hz, moitié moins à deux), puis à son retour
- Mécanisme : Atlas d'ombres, tampon MSAA et cibles de reflets sont détruits après 120 draws sans usage, comptés en draws et non en secondes. Une piste qui sèche puis une nouvelle averse, ou un palier Auto qui se rétablit, recréent ces cibles en pleine course, autant de fois que l'option revient.
- Correctif proposé : Référence FERRO : une option de rétention qui suspend ces trois libérations tant qu'une course tourne, avec libération en fin de séance. En attendant, côté jeu : geler les paliers pendant la course et décider des reflets pour toute la course d'après la météo prévue.
- Risque : Mémoire GPU retenue toute la course (MSAA 4× : environ 58 Mo à 1,8 Mpx).

### renderer-ressources-gouverneurs-seuils-60hz — gravité 4, confiance 0.75
- Où : src/moteur/renderer.js : 1639-1648, 3052 ; src/qualite.js 4, 25-29 ; src/jeu.js 1400-1407 (cadence (seuils en millisecondes absolues))
- Quand : En course, qualité Auto, écran ou navigateur à 30 Hz (limite à 50 Hz) ; écran partagé
- Mécanisme : Le moteur juge lent au-delà de 25 ms et rapide sous 18,5 ms ; le jeu monte d'un palier au-delà de 20 ms de moyenne. À 30 images par seconde stables, tout est « lent » : échelle à 0,65 et palier 4 en une douzaine de secondes, une réallocation par pas, sans gain. À deux, governor.update tourne deux fois par image.
- Correctif proposé : Rapporter les seuils à la période de l'écran, déjà mesurée par la détection (autoconfig.js 82-83) ou par calibrate().refreshMs : lent si la moyenne dépasse 1,3 période. Décider du niveau avant le départ ; pendant la course, ne plus rien changer qui alloue.
- Risque : Une période d'écran mal mesurée (onglet en arrière-plan, écran à fréquence variable) fausserait tous les seuils : la borner et la remesurer.

### renderer-ressources-pipelines-premier-trace — gravité 4, confiance 0.55
- Où : src/moteur/renderer.js : 2473-2483, 2641-2649, 2886-2893, 2972-2976, 3122, 3191 (shaders (finalisation par le pilote au premier tracé))
- Quand : En course : première fumée ou étincelle, premiers reflets, premier draw sans MSAA ou sans halo après un changement de palier
- Mécanisme : create lie les six programmes mais ne trace rien. Le pilote (ANGLE vers Metal ou D3D) finalise un pipeline au premier tracé de chaque combinaison programme, format de cible et mélange : fxProgram avec mélange, ssrProgram et son blit couleur et profondeur, monde et ciel vers la toile sans MSAA. Supposition non mesurée ici.
- Correctif proposé : Image de chauffe au chargement : un objet fx et un objet opaque tracés dans chaque chemin (MSAA et halo, halo seul, toile directe, reflets), puis readPixels 1×1 sur rendu.gl pour attendre le GPU derrière l'écran de chargement.
- Risque : Aucun pour l'image ; la durée de la chauffe est à mesurer sur GPU intégré.

### renderer-ressources-echelle-remise-a-un — gravité 4, confiance 0.8
- Où : src/moteur/renderer.js : 2517, 2794, 2809 (allocation GPU tardive (remise à zéro du gouverneur, clé des cibles))
- Quand : Première image après un changement de circuit (setWorld) ; en course au passage du palier 4 d'Auto (resize(0,75)) ou à tout changement de qualité
- Mécanisme : setWorld et tout resize avec une autre valeur de qualité remettent autoScale à 1 : la toile reprend sa pleine taille, les cibles sont recréées, puis la descente de 1 à 0,65 se rejoue (jusqu'à quatre réallocations). La clé des cibles contient la qualité : passer de 'auto' à un nombre recrée tout, même à taille égale.
- Correctif proposé : Référence FERRO : ne pas remettre l'échelle dans setWorld et faire porter la clé des cibles sur la seule taille en pixels. Côté jeu : n'appeler rendu.resize qu'entre deux courses et garder la même valeur de qualité du départ à l'arrivée.

### renderer-ressources-index-vide-interroge — gravité 3, confiance 0.85
- Où : src/moteur/renderer.js : 1825-1839, 2863-2871, 2935, 3077-3078 (ramasse-miettes (chaînes par image))
- Quand : Chaque draw, en course
- Mécanisme : BITUME passe un monde vide, mais la passe du soleil interroge quand même l'index spatial sur 124 m : environ 1 000 clés « x,z » construites en chaînes à chaque image. Le cache de vue se reconstruit dès que le champ varie, et il suit la vitesse : environ 500 clés de plus. Le tout pour zéro objet.
- Correctif proposé : Côté jeu, sans toucher au moteur : poser allStatic:true sur les caméras (jeu.js 1709 et 1583) ; les lignes 3077-3078 et 2935 prennent alors directement la liste vide. Dans la référence FERRO : sortir de query dès que l'index n'a aucune entrée.
- Risque : allStatic n'est sûr que tant que setWorld reçoit une liste vide.

### renderer-ressources-ombre-retracee-par-vue — gravité 3, confiance 0.7
- Où : src/moteur/renderer.js : 2913-2940, 3112-3117, 3135 (coût permanent (passe d'ombre))
- Quand : Chaque draw avec ombres : 120 fois par seconde à 120 Hz, deux fois par image à deux
- Mécanisme : L'atlas du soleil est effacé puis retracé en entier à chaque draw : tous les lots du carré de 200 m, herbe comprise, et toutes les voitures. Aucune option ne garde l'atlas de l'image ou de la vue précédente ; shadows:false coupe aussi la lecture des ombres dans le shader.
- Correctif proposé : Référence FERRO : option fx qui saute la passe d'ombre en gardant l'atlas et la matrice de l'image précédente. Le jeu rafraîchit alors l'ombre à 60 Hz sur un écran à 120 Hz, et une image sur deux par vue en écran partagé.
- Risque : À deux, chaque vue a son volume d'ombre : la réutilisation demande un atlas par vue ou un volume commun ; l'ombre des voitures rapides retarde d'une image.

### renderer-ressources-bufferdata-par-image — gravité 3, confiance 0.7
- Où : src/moteur/renderer.js : 1556-1557, 2834, 2892, 3095, 3200 (téléversement de tampons par image)
- Quand : Chaque draw (deux fois par image à deux, plus le moteur des rétroviseurs)
- Mécanisme : Les tampons des objets, des effets et de l'habitacle sont respécifiés par bufferData(DYNAMIC_DRAW) à chaque image, avec une taille qui suit le nombre d'instances : stockage GPU réalloué presque à chaque image, et nouvelle sous-vue Float32Array dès que le compte change.
- Correctif proposé : Réserver une capacité (bufferData avec une taille seule, doublée quand elle est dépassée), puis bufferSubData(cible, 0, stockage, 0, longueur) : plus de réallocation ni de sous-vue. Dimensionner la capacité à la chauffe sur le pire cas : douze voitures complètes, traces et débris.
- Risque : bufferSubData sur un tampon encore utilisé peut faire attendre certains pilotes : garder un orphelinage à taille constante.

### renderer-ressources-tampons-statiques-premier-trace — gravité 3, confiance 0.35
- Où : src/moteur/renderer.js : 2711-2718, 2735-2736, 2742-2757 (téléversement de tampons (matérialisation au premier tracé))
- Quand : Premier tour : première fois qu'un lot, proche ou lointain, entre dans le champ ou dans le volume d'ombre
- Mécanisme : setNappes et setLots téléversent tout au chargement et le passage proche/lointain ne renvoie rien : c'est sain. Mais aucun tampon de lot n'est tracé avant d'entrer dans le champ, et certains pilotes ne créent le tampon natif qu'au premier tracé. Supposition non mesurée : comparer premier et deuxième tour.
- Correctif proposé : À la chauffe, tracer une fois chaque lot, version proche et version lointaine, en passe d'ombre et en passe couleur, sans découpage au champ (fonction de préchauffage de la référence, ou caméras de chauffe réparties le long du circuit), puis attendre le GPU.

### renderer-ressources-attributs-par-groupe — gravité 2, confiance 0.6
- Où : src/moteur/renderer.js : 2835-2839, 2844-2850, 2939, 3166 (coût permanent (appels GL par groupe))
- Quand : Chaque draw, passe d'ombre et passe couleur
- Mécanisme : Tous les tampons d'instances partagent un seul VAO : avant chaque tracé, renderBatch et renderGroundCover reposent quatre vertexAttribPointer. Chaque groupe de formes de chaque lot visible coûte cinq appels au lieu de deux, en ombre puis en couleur. Nombre de groupes à mesurer par stats.drawCalls.
- Correctif proposé : Construire dans chargerLots un VAO par groupe (tampon du lot, décalage du groupe, VBO et IBO communs) ; le tracé devient bindVertexArray puis drawElementsInstanced. Garder le VAO partagé pour les tampons dynamiques et pour les tranches d'herbe, dont le décalage change à chaque image.
- Risque : Les VAO sont à recréer avec le contexte (restored) et à supprimer dans setLots et dispose.

### renderer-ressources-allocations-par-draw — gravité 2, confiance 0.85
- Où : src/moteur/renderer.js : 2517, 2726, 2829, 2882, 2914-2935, 3061-3091, 3125, 3137 (ramasse-miettes (objets et fermetures par image))
- Quand : Chaque draw
- Mécanisme : Hors chaînes de l'index, une soixantaine d'allocations par draw : cameraAxes (8), œil, view.set([16 valeurs]), detailRanges, margins et deux toFixed, lightPlan (map, sort, trois find), transientLights (slice, un tableau et un objet par lampe), liste des lampes (map, concat, filter, slice), torchPosition, une douzaine dans sunShadowPass, un objet par nappe, clé de cible.
- Correctif proposé : Référence FERRO : vecteurs de travail créés une fois dans create, boucles indexées à la place de map, filter, sort et forEach, visible() appelé avec la nappe elle-même, statistiques numériques sans toFixed, clé de cible comparée en nombres.

### renderer-ressources-resize-lit-la-mise-en-page — gravité 2, confiance 0.6
- Où : src/moteur/renderer.js : 2821-2827, 3052 (DOM (lecture forçant la mise en page) et réallocation sur changement de taille)
- Quand : Chaque draw ; et à toute variation de la taille affichée (barre d'adresse mobile, plein écran, zoom)
- Mécanisme : draw appelle resize, qui lit canvas.clientWidth et clientHeight à chaque image : si le jeu a écrit un style depuis la dernière mise en page (affichage, glaces), le navigateur la recalcule sur-le-champ, plusieurs fois par image à deux. Toute variation d'un pixel recrée aussitôt toutes les cibles, sans temporisation.
- Correctif proposé : Référence FERRO : mémoriser la taille par ResizeObserver et ne plus la lire dans draw. Côté jeu : pendant la course, n'appliquer un changement de taille qu'une fois stabilisé quelques dixièmes de seconde.

### renderer-ressources-create-en-serie — gravité 2, confiance 0.9
- Où : src/moteur/renderer.js : 936-947, 2473-2483, 2647-2649 (compilation de shaders (chargement))
- Quand : Au chargement ; en course si le moteur des rétroviseurs naît tard ; à la restauration du contexte
- Mécanisme : Chaque compileShader est suivi de la lecture de COMPILE_STATUS, chaque linkProgram de LINK_STATUS : douze compilations et six liens strictement en série, fil principal bloqué. POST_VERT est compilé trois fois et VERT trois fois : FX_VERT est identique à VERT, ses deux replace ne trouvant plus leur cible (anneaux et grain des fumées inactifs).
- Correctif proposé : Référence FERRO : compiler une fois chaque shader de sommets et le partager ; soumettre toutes les compilations et tous les liens avant de lire un statut ; avec KHR_parallel_shader_compile, attendre COMPLETION_STATUS_KHR sans figer l'écran de chargement. Réparer les deux replace de FX_VERT.
- Risque : Réparer FX_VERT change l'image des effets en anneau : à valider visuellement dans la référence.

### renderer-ressources-restauration-contexte — gravité 2, confiance 0.7
- Où : src/moteur/renderer.js : 2731-2739, 3211-3217 (perte et restauration de contexte, mémoire)
- Quand : Au retour d'un contexte perdu (rare) ; côté mémoire, pendant toute la séance
- Mécanisme : restored() refait initialize, puis chargerLots re-empaquette chaque lot depuis ses objets JS alors que l.paquet existe déjà. Il faut donc garder en mémoire tous les objets du décor en plus des tableaux empaquetés, et le moteur des rétroviseurs refait le même empaquetage. Les cibles reviennent au draw suivant.
- Correctif proposé : Référence FERRO : retéléverser l.paquet.values à la restauration et accepter dans setLots des lots déjà empaquetés, pour partager l'empaquetage entre les deux moteurs et laisser le jeu lâcher les objets du décor après le chargement. Mesurer d'abord le tas JS.

### renderer-ressources-cibles-post-toujours-creees — gravité 1, confiance 0.85
- Où : src/moteur/renderer.js : 2516-2525, 2808-2829 (mémoire GPU (cibles inutilisées))
- Quand : Au chargement et à chaque changement de taille
- Mécanisme : ensureTargets ne s'abstient que pour la qualité 'low' ; BITUME passe 'auto' ou un nombre. La scène pleine taille avec profondeur et les deux cibles de halo sont donc créées même quand ni halo ni MSAA ne servent : profil Légère, derniers paliers d'Auto, moteur des rétroviseurs (bloom:false).
- Correctif proposé : Référence FERRO : créer ces cibles au premier besoin déclaré (halo, ou réservation explicite au chargement). Gain : mémoire GPU sur les machines modestes et réallocations plus courtes ; aucun effet sur l'image.

## Points d’entrée utiles

- FRender.forme(nom, triangles) avant create (renderer.js 1262-1267) : toutes les formes entrent dans le VBO/IBO unique bâti par geometry() ; rien ne s'ajoute après.
- FRender.create(canvas, {msaa:4, shadowMapScale:2, reflections:true}) (renderer.js 2385, 2412 ; jeu.js 2697-2698) : compile tout tout de suite ; les options ouvrent des capacités sans allouer (2550-2553).
- rendu.resize(qualité) (2808-2830) : hors draw, crée déjà la scène et les cibles de halo ; une valeur numérique fige le ratio et rend le gouverneur du moteur inerte (1639, 2820-2823).
- rendu.setWorld / setNappes / setLots (2785, 2721, 2741) : téléversement statique immédiat ; installer() (jeu.js 134-163) est le point d'entrée « début de niveau » où brancher la chauffe, moteur des rétroviseurs compris.
- rendu.draw(cam, objets, fx) appelable hors course : un draw avec shadows:true, shadowMapScale, msaa:true, bloom:true, reflections:true crée atlas, MSAA et reflets (3054) et fait tracer ciel, monde, profondeur, SSR et post ; ajouter un objet {fx:true, alpha:.5} pour fxProgram et un {overlay:true} pour l'habitacle ; rejouer avec bloom:false et msaa:false pour le chemin vers la toile.
- rendu.calibrate(cam, objets, fx, frames) (3233-3243) : enchaîne des draw sous requestAnimationFrame avec readPixels 1×1 (attend le GPU) et rend p50, p95 et refreshMs, la période de l'écran. Jamais appelé par le jeu : c'est la chauffe bloquante la plus proche de l'existant.
- rendu.gl (3265) : contexte exposé ; readPixels 1×1 ou fenceSync + clientWaitSync après la chauffe, lecture de KHR_parallel_shader_compile.
- fx.adaptive:false (1639, 3052) : gèle le gouverneur de résolution du moteur pendant la course.
- camera.allStatic (2935, 3077-3078) : court-circuite les deux requêtes de l'index spatial, vide dans BITUME.
- fx.instances {values, groups} (3096-3098, 2940, 3168) avec FRender.shared.instancePacker et surfaceFlags (3269) : instances déjà empaquetées, tracées en ombre et en couleur sans objets JS par image. fx.lots {values, groups, version} (3102-3109, 3170) : tampon renvoyé seulement quand la version change.
- rendu.stats : uploadBytes, drawCalls, msaa, reflections, shadowMapSize, renderScale, width, height, cache.viewRebuilds, lotInstanceTests, fxInstances — sonde pour vérifier que rien ne se crée ni ne change de taille en course.
- rendu.profile(true) (2618-2625, src/ferro/gpu-profile.js) : temps GPU par passe (shadows, world, effects, post) ; à réserver aux mesures, car il interroge le GPU à chaque image (getParameter, getQueryParameter).
- Détection graphique existante (jeu.js 2634-2685, src/autoconfig.js 62-111, src/scene-bench.js 29-59) : voile #autodetection, attente par requestAnimationFrame (imageDetection), draws hors course depuis trois points du circuit, mesure de la cadence de l'écran (autoconfig.js 82-83) — gabarit prêt pour une étape de chauffe avant le départ.
- Perte de contexte : le moteur recharge seul programmes, nappes et lots (3211-3217) ; le jeu suit par webglcontextlost et webglcontextrestored (jeu.js 2703-2704, 2576-2590).
- rendu.actorFilter(camera, fx) (3007-3049) : filtre les objets avant leur construction ; non utilisé par le jeu.
- MANQUE dans le moteur : (a) prechauffer(options) qui réserve les cibles de toutes les options, trace chaque programme dans chaque format de cible et chaque tampon de lot dans un pixel, puis rend une promesse résolue quand le GPU a fini ; (b) une rétention qui suspend la libération après 120 draws ; (c) une échelle de rendu par viewport, sans réallocation ; (d) setLots acceptant des lots déjà empaquetés ; (e) une option gardant l'atlas d'ombres de l'image précédente.

## À mesurer

- Durée de la première image avec rétroviseurs (create + setNappes/setLots du second moteur, jeu.js 1545-1556) sur le Mac et sur un GPU intégré ; nombre de sommets des formes libres et durée de geometry().
- Durée d'une réallocation complète des cibles quand stats.renderScale ou la taille de toile change (scène, halo, MSAA, reflets) : intervalle d'image à cet instant, par navigateur.
- Premier tracé : intervalle d'image à la première fumée (stats.fxInstances > 0), au premier draw avec stats.reflections, au premier draw sans MSAA ni halo — avec et sans image de chauffe, sous Chrome (Metal et D3D11), Safari et Firefox.
- Premier tour contre deuxième tour : pires intervalles quand stats.lotsVisibles augmente, pour confirmer ou écarter la matérialisation tardive des tampons de lots.
- Débit d'allocation par image et fréquence des ramassages mineurs à 60 et 120 Hz, avant et après allStatic:true sur les caméras.
- Nombre de groupes tracés par image (stats.drawCalls) et temps processeur de draw (section « rendu » de B.mesures) : gain réel d'un VAO par groupe.
- ctx.drawImage(source) des glaces (jeu.js 1604) : la toile de 330 × 100 px CSS est-elle accélérée par le navigateur ? Sinon chaque glace impose une relecture GPU vers CPU. Même question pour #scene2 (jeu.js 1672). Non vérifié.
- Mémoire : tas JS après installer() (objets des lots gardés pour pack et pour la restauration) et mémoire GPU avec deux contextes, MSAA 4× à la résolution Fine et atlas ; risque de perte de contexte sur GPU intégré ou mobile.
- À 30 Hz réels (écran ou bridage du navigateur) : suivre palier.n et stats.renderScale pendant vingt secondes pour confirmer la dégradation sans gain ; à 120 et 144 Hz : coût de la passe d'ombre par image (rendu.profile, passe « shadows »).
- Retour d'onglet ou long blocage : majPalier reçoit l'intervalle brut (jeu.js 2482, 2522 ; qualite.js 16-27). Un seul intervalle de plusieurs secondes suffit-il à monter un palier en démo ou avec pauseAuto désactivé ?
- Atlas attendu en Fine : la qualité passée au moteur étant 'auto' ou un nombre, la base reste 512 (ligne 2538), soit 2 048² au plus, alors que le commentaire de la ligne 2389 annonce 4 096. Est-ce voulu ?
- FX_VERT identique à VERT (936-947) : les anneaux à innerRatio et le grain plafonné des fumées servent-ils dans BITUME ? La correction relève de la référence FERRO.
