# Carte des accrocs — renderer-image

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Module verrouillé (FERRO.lock.json, id « render ») : toute retouche passe par la référence FERRO ; côté jeu, seule l'API est libre.

Création. create() (2385) reconstruit toutes les formes (geometry 1269, index 1376 et 1397), puis initialize() (2641-2694) compile et lie six programmes de façon bloquante (compile 2473, link 2478), crée VAO, VBO, IBO et tampons. Dans la configuration BITUME (ni composition, ni FSky, ni FSceneReflections, résolution non native), aucune variante de shader ni getUniformLocation n'arrive plus tard.

Décor. setWorld([], [], atmosphère) (2785) laisse l'index spatial vide. setNappes puis chargerNappes (2699) : un VBO et un IBO statiques. setLots puis chargerLots (2731) : pack() (1528) et deux tampons STATIC par lot (proche, lointain), plan d'herbe par lot (1429).

draw(camera, liste, fx) (3050-3210), pour chaque vue :
1. governor.update (1634), resize() (2808) qui lit canvas.clientWidth et appelle ensureTargets() (2516) ; ensureShadowTarget (2527) et ensureOptionalTargets (2554) créent atlas, MSAA et reflets au premier usage et les libèrent après 120 draws sans usage.
2. Météo (2354), cameraAxes (1604), vent local (85), végétation (54), lotView.prepare (38) sur tous les lots.
3. Cache de vue (selectionCache 2862), lightPlan (2994), transientLights (1501), tableaux de lampes.
4. Répartition de la liste en opaques, cockpit et particules (3089), packDynamic (1549), bufferData du tampon dynamique (3095). Aucune élimination hors champ des objets dynamiques.
5. sunShadowPass (2913) : requête sur l'index, lots (dessinerLots 2742) et dynamiques en profondeur dans l'atlas.
6. Cible MSAA ou scène (3122), skyPass (2961), une quarantaine d'uniformes (3124-3137), dessinerNappes (2722, test de champ par nappe), dessinerLots (version proche ou lointaine selon la distance ; herbe par plages : prepareGroundCover 1447, renderGroundCover 2842), dynamiques (3167).
7. renderEffects (2886) : tri par distance et téléversement (effectsPacker 1578) ; copie couleur et profondeur pour les reflets (3191) ; cockpit après effacement de la profondeur (3192-3203) ; résolution MSAA (3204) ; reflectionsPass (2972), postPass (2977, trois passes).

Vues secondaires (src/jeu.js). Écran partagé : deux draw du même moteur, la première vue copiée par drawImage dans #scene2 (1667-1672). Rétroviseurs : un second moteur, donc un second contexte WebGL2 avec ses copies des nappes et des lots, créé à la première image cockpit (1545-1556) ; un draw par image, puis drawImage vers la glace (1600-1604).

Bilan par draw de la vue principale, ombres actives : 2 à 3 bufferData (dynamiques, effets, cockpit) ; une soixantaine de petites allocations fixes, plus une par nappe ; environ 1 070 clés de chaîne construites pour interroger l'index vide (1833-1834). Rien n'est lu du GPU en régime établi : checkFramebufferStatus et getParameter n'arrivent qu'à la création d'une cible, readPixels seulement dans calibrate() (3238).

Existant utile : tampons statiques des nappes et des lots, deux niveaux de détail résidents, empaqueteurs à stockage réutilisé, météo et vent sans allocation, cibles gardées 120 draws. Aucune chauffe avant la première image d'une séance (seule la détection du premier lancement dessine, sur son propre circuit) ; le banc écarte sa première seconde (jeu.js 2821-2841).

## Constats

### renderer-image-retro-moteur-paresseux — gravité 5, confiance 0.9
- Où : src/jeu.js : jeu.js 1545-1556 ; renderer.js 2413, 2641-2695, 2699-2741 (création paresseuse, shaders, téléversement)
- Quand : En course : première image en vue cockpit avec image des glaces (création du second moteur), puis première image cockpit de chaque nouveau circuit (remplissage).
- Mécanisme : majGlaces crée le second moteur dans le chemin d'une image : nouveau contexte WebGL2, geometry() de toutes les formes, six programmes compilés et liés avec lecture immédiate des statuts, cibles de rendu, puis setNappes et setLots (pack de chaque lot en deux versions, bufferData de tout le décor). Tout est synchrone, et le remplissage recommence à chaque nouveau circuit.
- Correctif proposé : Dans installer(), juste après le setLots principal et sous l'écran de chargement : créer retro.rendu si les glaces sont permises, lui passer setWorld, setNappes et setLots, faire deux draw de chauffe puis un readPixels. Ne plus rien créer dans majGlaces. À terme, dans FERRO : rendre la glace dans le même contexte (cible hors écran), sans copie du décor.
- Risque : Mémoire GPU et RAM du décor doublées dès le chargement, même si le joueur ne passe jamais en cockpit : à conditionner au réglage des rétroviseurs.

### renderer-image-gouverneur-reallocation — gravité 4, confiance 0.85
- Où : src/moteur/renderer.js : 1634-1651, 2794, 2809, 2819-2827, 2516-2525, 3052 ; jeu.js 1407, 1801 (allocation GPU tardive, cadence)
- Quand : En course, qualité Auto : à chaque pas du gouverneur de résolution (baisse après 1,3 s au-dessus de 25 ms de moyenne, hausse après 5 s sous 18,5 ms) et au passage du palier 4 du jeu (résolution 0,75).
- Mécanisme : Le gouverneur change autoScale, donc la taille de la toile ; ensureTargets() détruit puis recrée scène, halo, MSAA et reflets dans la même image. Seuils absolus (25 et 18,5 ms) : à 30 Hz il descend à 0,65 en quatre réallocations ; près de 60 Hz avec synchro verticale, un cycle hausse/baisse est possible. setWorld remet l'échelle à 1 à chaque séance ; en écran partagé, update compte double.
- Correctif proposé : Sans toucher au moteur : pendant une course, passer adaptive:false et une résolution numérique fixée avant le départ (mesure de calibrate() ou de la détection). Dans FERRO : cibles allouées une fois à la taille maximale, échelle appliquée par le viewport, seuils relatifs à la période de l'écran, échelle conservée d'une séance à l'autre.
- Risque : Sans résolution adaptative en course, une machine trop juste reste lente : l'échelle choisie avant le départ doit garder de la marge.

### renderer-image-cibles-paresseuses-liberees — gravité 4, confiance 0.85
- Où : src/moteur/renderer.js : 2527-2549, 2554-2580, 2494-2514 (allocation GPU tardive, appels synchrones)
- Quand : En course : première image mouillée (reflets), palier Auto qui coupe puis rend ombres ou halo, et à chaque retour d'un effet resté 120 draws sans usage.
- Mécanisme : Atlas d'ombres, tampons MSAA 4× en pleine résolution et cibles de reflets naissent au premier draw qui les demande, avec checkFramebufferStatus et getParameter(MAX_SAMPLES) synchrones, puis sont détruits après 120 draws sans usage (1 s à 120 Hz, 4 s à 30 Hz). Pluie qui franchit le seuil, palier Auto qui coupe puis rend ombres ou halo : allocation et libération se répètent en course.
- Correctif proposé : FERRO : option de création qui supprime les trois libérations par inactivité, et fonction de préparation créant d'un coup atlas, MSAA et reflets. En attendant, côté jeu : un draw de chauffe au chargement avec shadows, msaa, bloom et reflections à vrai ; garder ombres et anticrénelage constants pendant une course (seuls les reflets resteront relâchés au bout de 120 draws).
- Risque : Mémoire GPU réservée en permanence : le MSAA 4× coûte 32 octets par pixel, les reflets une cible pleine résolution de plus.

### renderer-image-pipelines-premier-usage — gravité 4, confiance 0.5
- Où : src/moteur/renderer.js : 2647-2649, 2886-2893, 2972-2976, 3121-3123 (shaders au premier usage)
- Quand : En course : première trace ou fumée, première image avec reflets, premier draw après qu'un palier a coupé MSAA ou halo (autre format de cible).
- Mécanisme : Les six programmes sont liés à la création, mais rien ne les dessine avant leur premier besoin : fxProgram à la première trace ou fumée, ssrProgram à la première image mouillée, et le programme du monde change de cible (MSAA, scène, toile) quand msaa ou bloom basculent. Beaucoup de pilotes (Metal, D3D via ANGLE) finalisent le pipeline au premier dessin de chaque combinaison. Non mesuré ici.
- Correctif proposé : Chauffe sous l'écran de chargement : pour chaque combinaison atteignable par le profil (msaa, bloom, reflets, ombres), un draw avec une liste contenant une instance de chaque forme, une particule fx et une pièce overlay, puis readPixels. calibrate() fournit déjà la boucle draw + readPixels ; le parcours de la détection graphique peut servir de modèle.
- Risque : Supposition sur le comportement des pilotes : à confirmer par une trace. Les cibles créées par la chauffe et non utilisées sont relâchées après 120 draws.

### renderer-image-index-vide-cles — gravité 3, confiance 0.9
- Où : src/moteur/renderer.js : 1825-1839, 2935, 2871, 2863-2866, 3077-3078 (ramasse-miettes, coût permanent)
- Quand : Chaque draw avec ombres ; reconstruction du cache de vue toutes les 0,15 s environ en solo, à chaque draw pour les rétroviseurs (glaces alternées) et l'écran partagé (caméras alternées).
- Mécanisme : Le monde est vide (setWorld([], …)), mais query() balaie quand même sa grille de 8 m et construit une clé x+','+z par cellule pour un Map.get : rayon de 124 m pour le soleil, soit environ 1 070 clés et autant de chaînes temporaires (ou le double) par draw. Le cache de vue en ajoute 550 à 700 à chaque reconstruction.
- Correctif proposé : Sans toucher au moteur : poser allStatic:true sur les caméras du jeu (cam et camR). Le moteur ne lit ce drapeau qu'aux lignes 2935, 3077 et 3078 ; avec un monde vide l'image est identique et les deux requêtes disparaissent. Dans FERRO : sortie immédiate de query() quand l'index ne contient aucune entrée.
- Risque : Aucun tant que setWorld reçoit une liste vide ; à retirer si le jeu confie un jour des objets statiques à setWorld.

### renderer-image-herbe-dans-ombre — gravité 3, confiance 0.55
- Où : src/moteur/renderer.js : 2917-2918, 2935-2939, 2742-2756, 2842-2851, 1001-1005 (coût permanent, travail proportionnel au décor)
- Quand : Chaque draw avec ombres.
- Mécanisme : sunShadowPass redessine en profondeur tous les lots dont la sphère touche le carré de 200 m, sans découpe par le champ, y compris les lots d'herbe : milliers de brins animés par le vent, fragment avec discard. Un texel d'ombre mesure environ 10 cm (200 m sur 2 048) : un brin de quelques centimètres ne donne aucune ombre lisible.
- Correctif proposé : FERRO : dans dessinerLots, sauter en passe d'ombre (accepte défini) les lots groundCover, ou ceux portant un drapeau ombre:false posé par vegetation.js. Mesurer avant et après : passe « shadows » de rendu.profile() et stats.triangles.
- Risque : Perte possible d'un léger assombrissement au pied des herbes denses : à comparer à l'image. Poids réel de la passe non mesuré.

### renderer-image-dynamiques-sans-elimination — gravité 3, confiance 0.8
- Où : src/moteur/renderer.js : 3089-3095, 1549-1563, 2940, 3167, 3007-3049 ; jeu.js 1745-1766 (coût permanent)
- Quand : Chaque draw, pour chaque vue (principale, glace, joueur 2).
- Mécanisme : Aucune élimination hors champ des objets dynamiques : toute la liste est comptée et rangée (deux recherches Map par objet), convertie en 16 flottants, téléversée, puis dessinée deux fois (ombre du soleil et couleur). Le jeu pose les douze voitures pour chaque vue ; actorFilter(), prévu pour écarter une voiture avant de construire ses pièces, n'est jamais appelé.
- Correctif proposé : Côté jeu : un actorFilter(cam, fx) par vue, puis ne pas appeler poser() pour une voiture dont la sphère est refusée (hors caméra et hors volume du soleil). Étape suivante : écrire les poses dans un Float32Array persistant passé par fx.instances (lot déjà empaqueté), ce qui supprime objets par pièce et empaquetage par image.
- Risque : actorFilter alloue une vingtaine d'objets par appel et trois par test ; fx.instances oblige le jeu à poser lui-même les drapeaux de surface (colonne 11).

### renderer-image-appels-dessin-attributs — gravité 3, confiance 0.6
- Où : src/moteur/renderer.js : 2831-2840, 2842-2851, 2735-2736 (coût permanent, changements d'état)
- Quand : Chaque draw.
- Mécanisme : Chaque lot coûte un bindBuffer, et chacun de ses groupes de forme quatre vertexAttribPointer plus un drawElementsInstanced, en passe d'ombre puis en couleur, pour chaque vue. Un lot de décor a un groupe par forme distincte ; l'herbe ajoute un appel par plage de détail. Le nombre d'appels WebGL par image croît donc avec le décor visible (stats.drawCalls, non mesuré ici).
- Correctif proposé : Mesurer d'abord stats.drawCalls par vue. Si le total dépasse quelques centaines : dans FERRO, un VAO par groupe de lot créé dans chargerLots (bindVertexArray puis un seul appel) ; côté décor, moins de formes distinctes par lot et fusion des lots lointains voisins.
- Risque : Des milliers de VAO à créer au chargement : à inclure dans la chauffe.

### renderer-image-lots-tampons-premier-usage — gravité 3, confiance 0.4
- Où : src/moteur/renderer.js : 2731-2741, 2742-2758 (téléversement, premier usage)
- Quand : Fin du chargement et premières images de la séance ; premier tour, quand un lot ou sa version proche est dessiné pour la première fois.
- Mécanisme : chargerLots crée deux tampons GL par lot, soit des milliers, et rend la main sans attendre le GPU. Aucun tampon n'est dessiné avant que son lot entre dans le champ ; la version proche ne sert qu'à l'approche. Le coût de premier usage (stockage sommet créé au premier dessin sur certains pilotes) et la file de téléversements peuvent donc déborder sur les premières images. Hypothèse non mesurée.
- Correctif proposé : Tour de chauffe caché au chargement : draw depuis des caméras posées tous les 100 m du circuit, dans les deux sens, puis gl.readPixels avant de lever l'écran de chargement. Dans FERRO : un seul tampon d'instances pour tous les lots, adressé par décalage, au lieu de deux tampons par lot.
- Risque : Allonge le chargement : à étaler sur plusieurs images avec une barre de progression.

### renderer-image-vues-secondaires-copie — gravité 3, confiance 0.4
- Où : src/jeu.js : jeu.js 1546, 1600-1604, 1667-1672 ; style.css 35 (rendus secondaires, lecture GPU vers CPU (hypothèse))
- Quand : Chaque image en cockpit avec glaces (un draw et une copie par image) ; chaque image en écran partagé.
- Mécanisme : Chaque glace coûte un draw complet du décor dans un second contexte, puis un drawImage de la toile WebGL vers une toile 2D de 330 × 100 px CSS. À densité 1, cette taille est sous le seuil d'accélération des toiles 2D de Chrome : la copie peut passer par une relecture GPU vers CPU bloquante. L'écran partagé copie de même une demi-fenêtre par image. Hypothèse non mesurée.
- Correctif proposé : Mesurer (trace Chrome, écran 1×). Si la relecture est confirmée : montrer directement une toile WebGL par glace, ou transferToImageBitmap vers un contexte bitmaprenderer ; à terme, dans FERRO, glaces et joueur 2 rendus dans le même contexte par viewport et scissor, sans drawImage ni second jeu de tampons.
- Risque : Un contexte WebGL par glace multiplie la mémoire ; le rendu par viewport demande une évolution du moteur verrouillé.

### renderer-image-lampes-tunnel — gravité 2, confiance 0.85
- Où : src/moteur/renderer.js : 1501-1519, 3084-3088, 837-849 ; jeu.js 1471-1500 (ramasse-miettes, coût GPU par pixel)
- Quand : Chaque draw tant qu'une lampe du tunnel est active (vue principale et glaces).
- Mécanisme : Le jeu fournit une liste de lampes recyclée. transientLights la recopie (slice, map et some par lampe, un objet par lampe, sort, slice) et selected ajoute objets et tableaux : 40 à 70 allocations par draw sous le tunnel. Dans le fragment, la boucle calcule le reflet de chaque lampe pour chaque pixel de l'écran, même au-delà de sa portée de 18 m.
- Correctif proposé : FERRO : enregistrements réutilisés et sélection bornée sans tri dans transientLights (comme localWind.select) ; dans le shader, passer à la lampe suivante dès que l'atténuation est nulle, avant metalHighlight. Mesurer la passe « world » à l'entrée du tunnel.
- Risque : Retouche de shader : l'image doit rester identique à portée de lampe.

### renderer-image-allocations-fixes — gravité 2, confiance 0.9
- Où : src/moteur/renderer.js : 1604-1609, 3062-3065, 3072, 1614, 3075, 2994-3003, 3085-3091, 2914-2935, 3125, 3137, 2726, 2829 (ramasse-miettes)
- Quand : Chaque draw.
- Mécanisme : Une soixantaine de petites allocations fixes par draw : cameraAxes (8), œil, littéral de 16 nombres pour view.set, detailRanges, tableau vide d'extendedDistance, margins et deux toFixed pour des statistiques, lightPlan (9), selected (8), sunShadowPass (14), tableaux par défaut de la mer et de la torche, objet rendu par resize, plus un objet par nappe. Doublé par une glace ou par l'écran partagé.
- Correctif proposé : FERRO : objets et tableaux de travail créés une fois dans create() (axes, œil, volume du soleil), matrices écrites élément par élément, constantes partagées pour les valeurs par défaut, sphère englobante rangée sur chaque nappe au chargement, statistiques de marge sans toFixed. Aucune de ces retouches ne change l'image.
- Risque : Module verrouillé : à faire dans la référence FERRO puis à propager.

### renderer-image-televersements-par-image — gravité 2, confiance 0.8
- Où : src/moteur/renderer.js : 3095, 2834, 2892, 3200, 1556-1557, 1589-1590 (téléversement de tampons)
- Quand : Chaque draw ; croissance de capacité à la première image où le nombre d'objets dépasse le maximum déjà vu.
- Mécanisme : Deux à trois bufferData DYNAMIC par draw (dynamiques, effets, cockpit), chacun à la taille exacte du moment : le stockage GPU est réattribué à chaque image. Côté JS, le Float32Array d'un empaqueteur double quand sa capacité est dépassée en pleine course, et une nouvelle vue subarray est créée chaque fois que le nombre d'instances change.
- Correctif proposé : Chauffe au chargement avec la liste la plus longue possible (douze voitures complètes, toutes les traces et particules) pour figer la capacité. FERRO : capacité arrondie et stable côté GPU (bufferData de taille constante, puis bufferSubData), compteur d'instances à la place de la vue subarray.
- Risque : bufferSubData seul, sur un tampon encore utilisé par la vue précédente, peut bloquer certains pilotes : garder un bufferData de taille constante avant chaque envoi.

### renderer-image-lecture-mise-en-page — gravité 2, confiance 0.6
- Où : src/moteur/renderer.js : 2819-2829, 2517 ; jeu.js 1573, 1600 (DOM)
- Quand : Chaque draw.
- Mécanisme : resize() lit canvas.clientWidth et clientHeight à chaque draw. Si le DOM a été modifié plus tôt dans l'image (transform des glaces écrit par majGlaces juste avant le draw du rétroviseur, écritures entre les deux vues de l'écran partagé), la lecture force un recalcul de style ou de mise en page. ensureTargets() fabrique aussi une clé de chaîne par draw.
- Correctif proposé : Côté jeu : regrouper les écritures DOM après le dernier draw de l'image. FERRO : taille CSS fournie par l'hôte (ResizeObserver) et resize() refait seulement si elle change ; comparer largeur, hauteur et qualité sans construire de chaîne.
- Risque : Coût réel non mesuré ; un ResizeObserver arrive une image après le changement de taille.

### renderer-image-lots-parcours-complet — gravité 2, confiance 0.7
- Où : src/moteur/renderer.js : 25-33, 38-49, 3068, 2742-2748 ; vegetation.js 467 (coût permanent, travail proportionnel au décor)
- Quand : Chaque draw.
- Mécanisme : lotView.prepare visite tous les lots à chaque draw (distance, portée, niveau de détail), avec un Math.tan par lot portant lodReferenceFov ; dessinerLots les reparcourt ensuite deux fois (ombre, couleur). Les tapis d'herbe sont découpés en cellules de 16 à 64 m : le nombre de lots visités trois fois par vue suit la taille du circuit, pour quelques dizaines à portée.
- Correctif proposé : FERRO : tangente de référence calculée une fois dans setLots ; grille 2D des lots d'herbe pour ne visiter que les cellules à portée de la prairie ; liste des lots retenus par prepare réutilisée par les deux passes. Mesurer stats.lotDistanceTests par circuit.
- Risque : Nombre de lots par circuit non compté ici : le gain peut être faible sur les petits circuits.

### renderer-image-tri-effets — gravité 2, confiance 0.7
- Où : src/moteur/renderer.js : 1578-1596, 2886-2893 (coût permanent, tri)
- Quand : Chaque draw dès qu'il existe des effets translucides.
- Mécanisme : packFx trie par distance toutes les instances translucides à chaque draw et pour chaque vue, y compris les bandes de traces de pneus posées à plat sur la piste (jusqu'à 512), puis téléverse le tout. L'ordre des traces coplanaires ne change pas l'image ; seules fumées et étincelles ont besoin du tri.
- Correctif proposé : FERRO : lot non trié pour les effets au sol (drapeau sur l'objet), tri limité aux particules volumiques ; conserver l'ordre d'entrée du jeu pour les traces. Gain à mesurer sur la section « effets » du banc.
- Risque : Traces qui se croisent : vérifier qu'aucune différence de mélange n'apparaît.

### renderer-image-ciel-avant-decor — gravité 2, confiance 0.6
- Où : src/moteur/renderer.js : 3123, 2961-2971, 1013-1059 (coût permanent GPU)
- Quand : Chaque draw.
- Mécanisme : skyPass remplit tout l'écran avant le décor, test de profondeur coupé : nuages à quatre octaves de bruit, étoiles et halos du soleil sont calculés pour chaque pixel, puis recouverts par le terrain et la piste sur la plus grande part de l'image.
- Correctif proposé : FERRO : dessiner le ciel après les opaques, triangle au plan lointain avec le test LEQUAL déjà actif, pour ne calculer que les pixels de ciel visibles. Conserver l'alpha 0 du ciel, qui sert de masque aux reflets, et vérifier l'ordre avec la cible MSAA.
- Risque : Gain réel non mesuré ; utile surtout sur les processeurs graphiques intégrés.

### renderer-image-chargement-pack-compilation — gravité 2, confiance 0.8
- Où : src/moteur/renderer.js : 1528-1546, 2731-2740, 2473-2483 (chargement)
- Quand : Au chargement d'un circuit et à la création d'un moteur ; en course seulement tant que le moteur des rétroviseurs est créé à la première image cockpit.
- Mécanisme : chargerLots appelle pack() deux fois par lot ; pack() crée un tableau par forme enregistrée (names.map) avant de regrouper, soit une nuée de petits tableaux pour un circuit de plusieurs milliers de lots, et garde en RAM les valeurs déjà envoyées au GPU. link() lit COMPILE_STATUS et LINK_STATUS aussitôt : la compilation bloque le fil principal.
- Correctif proposé : FERRO : tri par comptage dans chargerLots, comme instancePacker (aucun tableau par forme) ; KHR_parallel_shader_compile avec attente de COMPLETION_STATUS sous l'écran de chargement ; chargerLots étalé par tranches de lots sur plusieurs images, barre de progression à l'appui.
- Risque : Le découpage par tranches change le contrat synchrone de setLots : le jeu doit attendre la fin avant le premier draw.

## Points d’entrée utiles

- FRender.create(canvas, options) — renderer.js 2385 : compile et lie tous les programmes à la création ; à appeler au chargement aussi pour le moteur des rétroviseurs (jeu.js 1546).
- rendu.setWorld, setNappes, setLots — renderer.js 2785, 2721, 2741 : synchrones, tampons statiques ; point d'entrée côté jeu : installer() (jeu.js 134-163).
- rendu.resize(qualité) — renderer.js 2808 : appelé hors draw, il crée aussitôt les cibles scène et halo (ensureTargets 2516).
- rendu.draw(cam, liste, fx) — renderer.js 3050 : seul moyen actuel de créer atlas d'ombres, MSAA et reflets (fx.shadows, fx.shadowMapScale, fx.msaa, fx.bloom, fx.reflections) et de dimensionner les empaqueteurs ; utilisable comme draw de chauffe.
- rendu.calibrate(camera, liste, fx, images) — renderer.js 3233-3243 : boucle draw + readPixels à la cadence de l'écran, adaptive forcé à false ; rend p50, p95 et refreshMs (période réelle de l'écran : 30, 60, 120 ou 144 Hz).
- rendu.gl — renderer.js 3265 : contexte brut, pour un readPixels de fin de chargement (vide la file du GPU) ou pour interroger KHR_parallel_shader_compile.
- camera.allStatic — lu seulement en renderer.js 2935, 3077 et 3078 : supprime les requêtes sur l'index spatial, vide dans BITUME.
- rendu.actorFilter(camera, fx) — renderer.js 3007-3049 : rend un test (x, y, z, rayon) qui refuse une sphère hors caméra et hors volume du soleil, avant de construire ses pièces.
- fx.instances {values, groups} — renderer.js 3096-3098, dessiné en 2940 et 3168 : lot dynamique déjà empaqueté, 16 flottants par instance (position, matière, échelle, émission, rotation, drapeaux, couleur, indicateur de couleur).
- fx.lots [{values, groups, version}] — renderer.js 3102-3110 : lots opaques renvoyés au GPU seulement quand version change.
- fx.adaptive et fx.frameMs — renderer.js 3052, 1638-1640 : adaptive:false gèle le gouverneur de résolution.
- rendu.stats — uploadBytes (3093, 2834), drawCalls, triangles, instances, fxInstances (2887), lotDistanceTests et lotInstanceTests (3068, 2751), lotsVisibles (3166), cache.viewRebuilds (3077), renderScale, width, height (2826), msaa, shadowMapSize, reflections.
- rendu.profile(true) — renderer.js 2618-2625 : temps GPU par passe (shadows, world, effects, post) quand l'extension de chronométrage existe.
- FRender.shared.instancePacker, effectsPacker, pack — renderer.js 3269 : empaqueteurs réutilisables côté jeu.
- B.sceneBench.creer(rendu, capacités) — src/scene-bench.js 5-52 : preparer() (resize, setWorld, setNappes, setLots) puis dessiner() avec toutes les options ; modèle prêt pour un parcours de chauffe sur le circuit de la course.
- oublierIntervalle() — jeu.js 2471 : à appeler après la chauffe pour que sa durée n'entre ni dans la simulation ni dans les gouverneurs.

## À mesurer

- Durée réelle de la première image cockpit (création du second moteur puis remplissage) sur Mac (Metal), Windows (ANGLE D3D11) et un portable à processeur graphique intégré.
- Pire image aux transitions : pas du gouverneur (stats.renderScale), changement de palier, première image mouillée (stats.reflections), première trace ou fumée. Le banc écarte sa première seconde : il faut une mesure de la pire image des dix premières secondes.
- stats.drawCalls, stats.triangles, stats.uploadBytes, stats.lotDistanceTests et stats.lotInstanceTests par vue (principale, glace, joueur 2) sur chaque circuit ; part de la passe « shadows » avec et sans herbe (rendu.profile()).
- Débit d'allocation et fréquence des ramassages mineurs avec et sans allStatic ; la fermeture de outdoorAt (1498-1499) est-elle éliminée par le compilateur pour les pièces de matière inférieure à 8 ?
- La copie drawImage des glaces passe-t-elle par une relecture GPU vers CPU sur un écran de densité 1 ? Coût du basculement entre les deux contextes WebGL à chaque image.
- Le premier dessin d'un tampon de lot coûte-t-il quelque chose selon le pilote (ANGLE D3D11, Metal, Firefox) ? La file de téléversements est-elle vide quand l'écran de chargement se lève ?
- Comportement à 30 Hz (écran ou bridage) : le gouverneur du moteur (25 ms) et celui du jeu (20 ms, qualite.js) descendent-ils jusqu'au plancher ? Quelle cadence cible leur donner à 30, 60, 120 et 144 Hz ?
- Mémoire GPU si tout est préalloué (MSAA 4× pleine résolution, reflets, atlas, second moteur et sa copie du décor) sur une carte de 2 Go ou un processeur graphique intégré.
- La lecture de canvas.clientWidth force-t-elle une mise en page mesurable (profil Chrome, « Forced reflow ») ? Sur mobile, la barre d'adresse change-t-elle la taille de la toile en course ?
- Nombre de lots, de formes enregistrées (names) et de nappes par circuit et par qualité de végétation ; nombre d'instances dynamiques par vue.
