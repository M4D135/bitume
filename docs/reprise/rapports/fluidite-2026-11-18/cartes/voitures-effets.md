# Carte des accrocs — voitures-effets

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Chemins relatifs à /Users/david/Projects/bitume/src/. Lecture seule, rien n'a été exécuté : les comptes viennent du code lu.

CHARGEMENT DE LA PAGE. carene.js bâtit carènes et tubes en triangles JS (`carene` 69-135, `tube` 161-223, `lisser` 34-53) ; humain-donnees.js et humain-corps.js génèrent tête et buste ; main.js la main (`construire` 49-103). voiture.js enregistre 60 formes libres (`forme` 61-66 vers `FRender.forme`), environ 37 000 triangles d'après les formules, avant `FRender.create` (jeu.js:2698) : toute la géométrie des voitures est dans le VBO statique dès le démarrage, rien n'est téléversé en course.

LANCEMENT D'UNE COURSE. `demarrerSeance` (jeu.js:2364-2374) montre le voile 30 ms, le retire, puis appelle `lancer` (172-237) : effets de la séance précédente libérés (177), décor (`installer`, 181), course (183), pneus (201-204), 12 × `B.voiture.modele` (207 ; voiture.js:365-501 : listes `corps`, `simples`, `epave`), `B.traces.creer` (213 ; traces.js:30-55 : 512 bandes, 96 débris, 48 fumées, 48 étincelles, 160 embruns, chacun avec son objet de rendu). Restent paresseux : `S.sillage` (1621), `rouleVu` (1635), premier `cockpit()`, second moteur des rétroviseurs (1545-1556), monde PhysX au premier débris (traces.js:276). Aucun préchauffage n'existe, hors la seconde de chauffe du banc (2821-2858).

CHAQUE IMAGE. `rendreVue` (1689) vide `sortie` (1692), puis par voiture crée un `ev` (1748) et appelle `B.voiture.poser` (voiture.js:521-543) — modèle complet sous `complet`, environ 89 à 112 m (1745), `simples` au-delà — ou `cockpit` (598-780) pour la voiture suivie, `fantome` (783-791) en chrono. `poser` recalcule `attitude` (27), puis par pièce `mul`, `rotationRoue` (507-512), `angles` (16-19), et crée un objet neuf. Le moteur recopie aussitôt ces objets dans un Float32Array (moteur/renderer.js:1549-1563, 3089-3095) et les dessine dans l'ombre du soleil (2940), la couleur (3167) et la surimpression (3200) ; il ne garde aucune référence.

COMPTES (pneus lisses). Voiture complète : 114 + 3 × segments du numéro objets, environ 1 740 allocations. Douze voitures : environ 1 600 objets et 20 900 allocations par image (2 080 et 32 000 en pneus pluie). Modèle simple : 11 objets, une centaine d'allocations. Cockpit : environ 195 objets et 4 000 allocations. Glaces : tous les objets de la vue sont repris, la voiture suivie est reposée entière puis réduite à ses roues arrière (1588-1595).

EFFETS. `B.traces.pas` (traces.js:60-86) est appelé à chaque pas de 1/120 s (jeu.js:744) et ne travaille qu'à 30 Hz (67-69) : `vieillir` (310-357, pas PhysX compris), puis toutes les voitures à moins de 160 m. `dessiner` (360-398) prolonge positions et alphas jusqu'à l'image (`h = fx.acc`) et pousse les objets persistants sans allouer, sauf `anglesQuaternion` (304-308). `sillage.mettreAJour` (sillage.js:13-35) n'alloue rien.

## Constats

### voitures-effets-retro-moteur-paresseux — gravité 5, confiance 0.85
- Où : /Users/david/Projects/bitume/src/jeu.js : 1545-1556 (moteur/renderer.js 1362-1370, 2413, 2478-2482, 2735-2736) (allocation GPU tardive)
- Quand : course : première image en vue cockpit de la page, puis de chaque circuit ; ou premier changement de vue en course
- Mécanisme : Le second moteur des rétroviseurs est créé dans l'image même : contexte WebGL2 neuf, liaison des programmes avec lecture synchrone de LINK_STATUS, `geometry()` qui remet à plat les 60 formes libres (environ 37 000 triangles), contextes 2D des glaces. Puis `setWorld`, `setNappes` et `setLots` recopient et retéléversent tout le décor, à chaque nouveau circuit. Cockpit et glaces sont les réglages par défaut (jeu.js:26).
- Correctif proposé : Créer `retro.rendu` et y installer le décor au lancement de la séance, sous le voile, dès que le réglage des rétroviseurs peut s'appliquer ; y dessiner une image par glace avant de rendre la main. Refaire l'installation quand `installer()` change de scène. `majGlaces` ne doit plus rien créer.
- Risque : Travail certain, durée non mesurée. Mémoire GPU du second contexte payée même si le joueur reste en vue extérieure : garder la création conditionnée au réglage.

### voitures-effets-poser-allocations — gravité 4, confiance 0.8
- Où : /Users/david/Projects/bitume/src/voiture.js : 8-19, 27, 507-543 (appel : jeu.js 1746-1765) (ramasse-miettes)
- Quand : course, chaque image
- Mécanisme : Par pièce, `poser` alloue `mul` (1 tableau), `mulM` (4), `euler` (4), `angles` (1), l'objet et son `p` : 3 à 27 allocations, environ 1 740 par voiture complète dont 1 422 pour ses 74 pièces de roue. Douze voitures proches : environ 1 600 objets, 20 900 allocations (1 Mo estimé) et 9 600 appels trigonométriques par image, soit 60 à 120 Mo/s de déchets à 60-120 Hz.
- Correctif proposé : Dans `modele()`, donner à chaque pièce un objet de rendu permanent et sa matrice locale aplatie. À l'image : M en neuf scalaires, une matrice par roue, une table d'angles par rotation distincte (46 par voiture en pneus lisses), écriture en place de `p` et `r`, puis `sortie.push(pc.obj)`. Le moteur recopie les valeurs aussitôt (renderer.js:1559-1561), comme pour traces.js.
- Risque : Comptes établis par lecture, coût en millisecondes non mesuré. verifications/voiture.test.mjs lit les objets poussés : garder les mêmes champs. La pose pour les glaces (jeu.js:1591) réécrit les objets du modèle suivi après le dessin principal : conserver cet ordre.

### voitures-effets-cockpit-reconstruit — gravité 4, confiance 0.75
- Où : /Users/david/Projects/bitume/src/voiture.js : 598-780 (travail refait à chaque image)
- Quand : course, chaque image en vue cockpit
- Mécanisme : `cockpit()` recrée à chaque image une quinzaine de fermetures et environ 195 objets (57 de caisse et roues avant, 138 de planche, volant, mains, levier, rétroviseurs) à coups de `plus`/`map`/`reduce`, `Object.assign` et `angles(mulM())` : environ 4 000 allocations. Quelque 75 pièces de planche sont immobiles dans la voiture ; seuls aiguilles, voyants, segments, volant, mains et levier changent.
- Correctif proposé : Calculer une fois par modèle la table des pièces d'habitacle en repère voiture (position, matrice, taille, objet de rendu), puis les transformer comme la caisse. Volant et mains : un groupe tourné de `phi` autour de `wn`. Segments : objets fixes dont seuls `mat`, `color`, `emissive` changent. Garder le calcul actuel pour la main droite pendant un passage de rapport.
- Risque : Le cadrage du cockpit est tenu par verifications/voiture.test.mjs : comparer ancienne et nouvelle sortie pièce par pièce. Le compte de 4 000 est une estimation de lecture.

### voitures-effets-physx-premier-debris — gravité 4, confiance 0.5
- Où : /Users/david/Projects/bitume/src/traces.js : 253-282, 287-295 (ferro/physx.js 88-101, 137-149) (création paresseuse)
- Quand : course : première pièce détachée de chaque séance
- Mécanisme : Le monde PhysX naît au premier débris : `createWorld` (scène, répartiteur, filtre), puis `dalles()` échantillonne le tracé et recrée les corps statiques par `setStatics`, puis `addBox`. Les premières exécutions du code WebAssembly (création, `simulate`, CCD) tombent ainsi au moment du choc. `liberer()` détruit le monde à chaque séance : chaque course repaie la création.
- Correctif proposé : Créer le monde dans `B.traces.creer` si `FPhysX.isReady()`, sinon à la résolution de `FPhysX.init()`. Le chauffer hors course : une dalle, une boîte lancée, une dizaine de `step`, `readPose`, `remove`. Conserver un monde unique pour la page, vidé par `liberer()` au lieu d'être détruit.
- Risque : Durée jamais mesurée ; la part due à la compilation tardive du WebAssembly dépend du navigateur (supposition).

### voitures-effets-grille-detail-complet — gravité 4, confiance 0.7
- Où : /Users/david/Projects/bitume/src/jeu.js : 1745-1764 (course.js 111 ; voiture.js 490-497 ; moteur/renderer.js 2940) (coût permanent, pic au départ)
- Quand : course : départ arrêté et peloton groupé ; écran titre (caméra télé)
- Mécanisme : Le seuil `complet` (89 à 112 m en course, jusqu'à 738 m au téléobjectif) ignore le palier graphique et le champ réel ; la grille tient en 88 m. Au départ, les onze rivales sont complètes : environ 1 480 instances et 220 000 triangles (estimation), dessinés aussi dans l'ombre du soleil. Rien entre 133 pièces en moyenne et 11.
- Correctif proposé : Ajouter dans `modele()` une liste moyenne (carènes, pneus, jantes, ailerons, casque : une trentaine de pièces) servie d'une vingtaine de mètres jusqu'à `complet`, et multiplier les deux seuils par un facteur du profil (`profilDe(S)`). Borner le seuil des caméras à longue focale.
- Risque : Bascule visible sans fondu si le seuil est trop proche. Triangles estimés d'après carene.js, non comptés à l'exécution.

### voitures-effets-roues-pieces — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/voiture.js : 42, 462-488, 507-520 (travail refait à chaque image)
- Quand : course, chaque image ; pire sous la pluie
- Mécanisme : Chaque roue émet 18-19 pièces en pneus lisses, 22-23 en intermédiaires, 28-29 en pluie (cercles peints, craie, gomme ou rainures) : 74 à 114 objets par voiture, chacun avec sa `rotationRoue` complète alors qu'une roue n'a que neuf rotations distinctes. `lent` et `vite`, testés par `visible()`, ne sont posés nulle part : ces repères partent à toute vitesse et toute distance.
- Correctif proposé : Enregistrer au chargement, par type de pneu, des formes fusionnées par matière (pneu et flancs, jante et rayons, cercles, craie, rainures) : cinq à six objets par roue, une matrice par roue. Ne plus émettre repères et rainures au-delà d'une vingtaine de mètres. Retirer ou rétablir `lent`/`vite`.
- Risque : Une forme enregistrée après `FRender.create` fait échouer `renderBatch` (`source.ranges[nom]` indéfini, renderer.js:2837-2838) : tout enregistrer au chargement du module.

### voitures-effets-premier-cockpit-a-froid — gravité 3, confiance 0.5
- Où : /Users/david/Projects/bitume/src/jeu.js : 2364-2374, 1678, 1759 (voiture.js 598 ; style.css 227-228) (préchauffage absent)
- Quand : course : premières images après le lancement
- Mécanisme : `demarrerSeance` retire le voile (30 ms, fondu de 0,3 s) avant d'appeler `lancer` : rien n'est rendu dessous. L'écran titre tourne en vue « tele » ; `cockpit()` et ses fermetures sont donc compilés et interprétés pour la première fois à la première image de course, comme `fantome()` en chrono et `detacher`/`physique` au premier choc.
- Correctif proposé : Rendre `demarrerSeance` asynchrone : `lancer`, puis sous le voile quelques images complètes dans la vue du joueur et en vue extérieure, et une centaine d'appels de `cockpit`, `poser`, `fantome`, `traces.dessiner` vers une liste jetable ; retirer le voile ensuite, puis seulement lancer les feux.
- Risque : Gain non mesuré ; le chargement s'allonge de quelques dixièmes de seconde. Mêmes chemins à traiter pour le jeu en ligne (jeu.js:1117-1122) et la démo (2084-2100).

### voitures-effets-glaces-detail-complet — gravité 3, confiance 0.75
- Où : /Users/david/Projects/bitume/src/jeu.js : 1588-1589, 1600 (style.css 35) (coût permanent)
- Quand : course, à chaque rendu de glace
- Mécanisme : Chaque rendu de glace (toile de 330 × 100 px CSS) reprend tous les objets non « overlay » de la vue principale : voitures complètes choisies pour la caméra principale (133 instances et 20 000 triangles chacune, estimation), bandes, fumées. Le second moteur les rempaquette et les retéléverse à chaque rafraîchissement, pour des voitures de quelques pixels.
- Correctif proposé : Bâtir pour les glaces une liste propre : voitures en `simples`, la poursuivante la plus proche en modèle moyen, effets limités aux fumées et embruns proches. Avec des objets permanents par pièce, cette seconde pose ne coûte aucune allocation.
- Risque : Le modèle simple de près dans la glace peut se voir : garder la plus proche en détail moyen.

### voitures-effets-glaces-cadence-par-image — gravité 3, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 1540-1543, 1576 (cadence)
- Quand : course, vue cockpit à 120 ou 144 Hz (et à 30 Hz)
- Mécanisme : La cadence des glaces compte des images, pas du temps : `saut = round(30 / hz)`, puis une glace rendue toutes les `saut` images. À 60 Hz chaque glace est rafraîchie 30 fois par seconde ; à 120 ou 144 Hz, 60 à 72 fois, dans un budget d'image deux fois plus court ; à 30 Hz, 15 fois seulement.
- Correctif proposé : Cadencer sur `horlogeReelle` : rendre une glace quand 1 / (2 × hz) seconde s'est écoulée depuis la précédente, en alternant les côtés. Le coût par seconde devient le même à 30, 60, 120 et 144 Hz.
- Risque : À 30 Hz d'affichage, tenir 30 images par glace demanderait deux rendus par image : plafonner à un.

### voitures-effets-numeros-segments — gravité 2, confiance 0.85
- Où : /Users/david/Projects/bitume/src/voiture.js : 424-447, 569 (course.js 11-15, 30) (travail refait à chaque image)
- Quand : course, chaque image
- Mécanisme : Chaque numéro est dessiné trois fois (nez, deux flancs) en boîtes, une par segment, chacune avec sa matrice (`mulM` et `angles`, 8 allocations). Grille solo (1, 3, 5, 7, 8, 11, 14, 17, 19, 22, 26, 28) : 78 segments, soit 234 objets et environ 1 900 allocations par image pour des chiffres lisibles à quelques mètres.
- Correctif proposé : Enregistrer au chargement une forme par numéro connu (`PILOTES` et `NUMEROS_HUMAINS` de course.js), une pour le nez et une pour les flancs : deux objets par voiture, absents du modèle moyen.
- Risque : L'encre (blanche ou noire) reste une couleur d'instance : une seule forme par numéro suffit.

### voitures-effets-glaces-pose-entiere — gravité 2, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 1588-1595 (travail refait à chaque image)
- Quand : course, à chaque rendu de glace
- Mécanisme : À chaque rendu de glace, la voiture suivie est reposée entière (`poser` : environ 135 objets, 1 740 allocations), puis une boucle de `splice` retire tout ce qui n'est pas près de l'essieu arrière : 36 à 56 objets gardés.
- Correctif proposé : Préparer dans `modele()` la liste `rouesArriere` (pièces dont `roue` vaut 2 ou 3) et la poser directement dans `retro.objets`, sans tri ni `splice`.

### voitures-effets-objets-polymorphes — gravité 2, confiance 0.4
- Où : /Users/david/Projects/bitume/src/voiture.js : 537-539, 601, 787-790 (traces.js 35, 40, 45 ; moteur/renderer.js 1498-1499, 1520-1527, 1559-1561, 3089) (coût permanent)
- Quand : course, chaque image
- Mécanisme : Les objets de rendu ont une dizaine de formes cachées (`fx`, `alpha`, `overlay` ajoutés après coup, `emissive` par `Object.assign`, ordres de champs propres à `fantome`, bandes, particules, débris). Les boucles du moteur lisent une quinzaine de propriétés sur chacun : accès mégamorphes. `outdoor` absent impose `materialFamily` puis `outdoorAt` (`some` et sa fermeture) par instance et par image.
- Correctif proposé : Une seule fabrique d'objets de rendu : mêmes champs, même ordre, tous initialisés (`shape, p, s, r, mat, color, surface, fx, alpha, overlay, emissive, outdoor, fxPriority`). Poser `outdoor: true` sur les pièces de voiture et les effets, comme faune.js:113 et effets-saison.js:19.
- Risque : Gain supposé, non mesuré. `outdoor: true` reproduit le résultat actuel (zone unique de decor.js:1190) mais figerait les voitures « dehors » si le tunnel recevait un jour sa propre zone.

### voitures-effets-physx-30hz — gravité 2, confiance 0.7
- Où : /Users/david/Projects/bitume/src/traces.js : 276, 304-308, 312-333, 368-373 (cadence)
- Quand : course, pendant les 12 s de vie des débris après un choc
- Mécanisme : Le monde PhysX (pas fixe 1/60) n'avance que dans la passe à 30 Hz : deux sous-pas d'un coup, une image sur deux à 60 Hz, une sur quatre à 120 Hz. Les poses sont lues à 30 Hz ; la position est prolongée par la vitesse mais la rotation saute, et `anglesQuaternion` reconvertit à chaque image un quaternion inchangé (5 tableaux par débris).
- Correctif proposé : Appeler `fx.monde.step(dt)` à chaque pas de simulation, avant la porte des 30 Hz : son accumulateur donne un sous-pas par image à 60 Hz. Lire les poses après chaque sous-pas, garder les deux dernières, interpoler position et quaternion au dessin, convertir en angles sans tableau.
- Risque : Durée d'un sous-pas avec 96 boîtes en CCD non mesurée ; l'interpolation ajoute un sous-pas de retard aux débris.

### voitures-effets-passe-30hz-groupee — gravité 2, confiance 0.7
- Où : /Users/david/Projects/bitume/src/traces.js : 67-85, 105-117, 142-152, 164-174, 350-356 (calcul en rafale)
- Quand : course, une image sur deux à 60 Hz, une sur quatre à 120 Hz
- Mécanisme : La passe à 30 Hz traite d'un bloc `vieillir` (864 emplacements) et toutes les voitures à moins de 160 m : `attitude()` (20 tableaux) par voiture, un littéral et un `mul` par roue, `orienter` (21 tableaux) par bande posée et par étincelle vivante. Jusqu'à 2 400 allocations dans une image sur deux à 60 Hz, aucune dans l'autre.
- Correctif proposé : Répartir les voitures sur les quatre pas de 1/120 s d'un trentième (voiture k au pas k mod 4), `vieillir` restant sur un seul. Réécrire `orienter` et la position des roues en scalaires, sans `attitude()` ni tableaux.
- Risque : Le tirage `fx.alea` change d'ordre : sans effet sur la simulation (graine propre), mais verifications/traces.test.mjs peut être à réajuster.

### voitures-effets-bandes-chaque-image — gravité 2, confiance 0.6
- Où : /Users/david/Projects/bitume/src/traces.js : 14, 374-381 (moteur/renderer.js 1581-1595, 2887) (coût permanent)
- Quand : course, chaque image dès que la piste est marquée
- Mécanisme : Jusqu'à 512 bandes de gomme, immobiles une fois posées, repartent à chaque image comme objets translucides dans un rayon de 190 m, sans test du champ : le moteur les enregistre, les trie par distance avec fumées et vitres, recalcule leurs drapeaux, les rempaquette et les retéléverse (jusqu'à 32 Ko).
- Correctif proposé : Dans `dessiner`, écarter les bandes derrière la caméra (produit scalaire avec l'axe de visée, à passer en argument) et régler `VUE` et le nombre maximal émis selon le profil. À terme : un lot translucide versionné dans FERRO, hors périmètre du jeu.
- Risque : Les glaces reprennent la même liste : ne retirer les bandes arrière que si l'image des rétroviseurs est coupée, ou garder une soixantaine de mètres derrière.

### voitures-effets-hors-champ — gravité 2, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1512-1516, 1746-1764 (coût permanent)
- Quand : course, chaque image
- Mécanisme : Aucune voiture n'est allégée selon le champ : une rivale à 50 m derrière la caméra part complète (133 objets, 20 000 triangles estimés), même quand l'image des rétroviseurs est coupée (réglage, écran tactile par défaut, palier bas) ou en vue extérieure.
- Correctif proposé : Calculer une fois par vue l'axe de visée ; une voiture à plus de quelques mètres derrière le plan de la caméra passe en `simple` si `retroVoulu` est faux, en modèle moyen sinon : son ombre et son image dans la glace restent.
- Risque : Ombre portée vers l'avant par une voiture juste derrière : garder une marge de quelques mètres.

### voitures-effets-liste-videe — gravité 1, confiance 0.5
- Où : /Users/david/Projects/bitume/src/jeu.js : 1588, 1692, 1748, 1751-1757, 1776-1783 (ramasse-miettes)
- Quand : course, chaque image
- Mécanisme : `sortie.length = 0` puis environ 1 800 `push` : sous V8, une longueur remise à zéro rend le tampon du tableau, qui regrandit par une dizaine de réallocations à chaque image (de même `retro.objets`). S'ajoutent par image un `ev` et son `p` par voiture, la liste `derriere` triée même quand `glaceVive` la rend inutile, et les littéraux des feux du portique.
- Correctif proposé : Index d'écriture, cases écrasées, puis `sortie.length = n` (jamais 0). `ev` réutilisé par voiture ; `derriere` bâtie seulement si `glaceVive` est faux, dans un tableau gardé ; objets des feux créés une fois par séance, seuls `mat`, `color`, `emissive` changent.
- Risque : Comportement de V8 cité de mémoire, non vérifié ici ; le moteur fait de même sur ses propres listes (renderer.js:3089), hors de portée du jeu.

### voitures-effets-memoire-triangles — gravité 1, confiance 0.6
- Où : /Users/david/Projects/bitume/src/voiture.js : 61-66, 586-588, 733 (humain-donnees.js 17 ; humain-corps.js 19) (mémoire)
- Quand : chargement, puis permanent
- Mécanisme : Les 37 000 triangles estimés des formes restent en tableaux JS imbriqués (sept tableaux par triangle, une dizaine de Mo estimés) dans le registre du moteur. `MAIN` garde en plus ses triangles bruts pour le seul `MAIN.points`, et `RADE.humanData`/`bodyData` restent globaux après extraction du pilote : tas ancien plus lourd à marquer à chaque collecte majeure.
- Correctif proposé : Après enregistrement : `MAIN = { points: MAIN.points }` ; libérer `RADE.humanData` et `RADE.bodyData` depuis voiture.js (seul lecteur). Le registre du moteur reste nécessaire (second moteur, restauration de contexte) ; le compacter en tableaux typés relève de FERRO.
- Risque : Taille du tas non mesurée. Les tests Node lisent `FORMES[nom].tri` : ne pas le retirer hors navigateur.

## Points d’entrée utiles

- `demarrerSeance(type, conditions)` — /Users/david/Projects/bitume/src/jeu.js:2364-2374 : point de lancement solo, avec le voile `#chargement` (index.html:471, style.css:227-228) retiré 30 ms plus tard, avant `lancer`. À rendre asynchrone pour préchauffer sous le voile. Autres chemins : jeu.js:1117-1122 (en ligne), 2084-2100 (démo), 2786-2813 (référence et banc).
- `lancer()` — jeu.js:172-237 : construit `S.modeles` (207) et `S.fx` (213). C'est là que se préallouent les objets de rendu par pièce et que peut se créer le monde PhysX.
- `B.voiture.modele(livree)` — /Users/david/Projects/bitume/src/voiture.js:365-501 : listes `corps`, `simples`, `epave` par voiture, à étendre (objets permanents, matrices locales, liste moyenne, `rouesArriere`, table d'habitacle).
- `B.voiture.poser`, `cockpit`, `fantome` — voiture.js:521, 598, 783 : sans effet hors de la liste `sortie` passée ; appelables vers une liste jetable pour chauffer le compilateur.
- `window.FRender.forme(nom, triangles)` — voiture.js:61-66, moteur/renderer.js:1262-1267 : formes fusionnées (roues par type de pneu, numéros, planche) à enregistrer au chargement du module, avant `FRender.create` (jeu.js:2698). Enregistrée plus tard, une forme est absente de `source.ranges` et `renderBatch` échoue (renderer.js:2837-2838).
- `B.traces.creer`, `pas`, `dessiner`, `liberer`, `compter` — /Users/david/Projects/bitume/src/traces.js:30, 60, 360, 287, 401 : tous les effets sont déjà en réserve fixe avec objet de rendu persistant ; `creer` est le point de création anticipée du monde PhysX.
- `FPhysX.init()` (promesse lancée en jeu.js:2719 ; ferro/physx.js:7-18), `FPhysX.isReady()`, `FPhysX.createWorld()` (physx.js:88) : enchaîner l'échauffement à la résolution de la promesse.
- `rendu.draw(cam, sortie, options)` — jeu.js:1801. Deux options du moteur que BITUME n'utilise pas : `options.instances`, lot déjà empaqueté `{ values: Float32Array de 16 flottants par instance (format renderer.js:1561), groups: [{ name, offset en octets, count }] }`, dessiné en couleur (3168) et dans l'ombre du soleil (2940) ; `options.lots`, lots versionnés retéléversés seulement si `version` change (3102-3110). Non validé pour les voitures.
- `retro` — jeu.js:1511, création en 1545-1556 : à déplacer au lancement de la séance.
- `BITUME_JEU.banc({ duree, qualite, circuit, chauffe })` — jeu.js:2821-2858 : p50, p95, pire image, temps des effets. Il saute la grille et la première seconde (2831, 2838) : le départ arrêté et les premiers usages lui échappent.
- `B.mesures.section('effets', …)` (jeu.js:1787) et `S.banc.effets` (745, 1787) chronomètrent déjà `traces.pas` et `traces.dessiner` ; rien d'équivalent autour de la boucle des voitures (1746-1765).
- Modèle d'objets persistants déjà en place : traces.js:35-45, faune.js:113, effets-saison.js:19, aurores.js:53 (champs complets, `outdoor: true`) ; `tampons.poses` (jeu.js:1613, 1620) pour les poses interpolées.
- /Users/david/Projects/bitume/src/scene-bench.js:8, 48-50 : la détection graphique pose déjà douze modèles avec `poser` ; réutilisable comme scène de chauffe.

## À mesurer

- Temps réel de la boucle des voitures (jeu.js:1746-1765) et de `cockpit()` par image, grille pleine, en pneus lisses puis pluie, sur le Mac et sur un portable modeste ; nombre et durée des collectes mineures par seconde à 60 et 120 Hz.
- Durée de la première image en vue cockpit : `FRender.create` du second moteur, `geometry()`, `setLots` (jeu.js:1545-1556).
- Durée du premier `createWorld` + `setStatics` + `addBox` + `step` en course (traces.js:276-279) sous Chrome, Firefox et Safari ; durée d'un sous-pas avec 96 boîtes en CCD.
- Part des voitures dans le temps GPU au départ (environ 220 000 triangles, deux passes) par palier sur un processeur graphique intégré ; gain d'un modèle moyen.
- Nombre réel de triangles par forme et taille du tas retenue par le registre des formes : mes chiffres viennent des formules de carene.js, pas d'une exécution.
- V8 rend-il bien le tampon d'un tableau sur `length = 0` dans les versions de Chrome visées ? Les accès mégamorphes des empaqueteurs du moteur sont-ils mesurables ?
- Le plafond de rotation des roues est de 0,11 m par image (jeu.js:1638) et non par seconde : l'allure des roues dépend de la fréquence d'affichage (30, 60, 120, 144 Hz). Est-ce voulu ?
- Le banc saute la grille et la première seconde : faut-il lui ajouter une mesure des 120 premières images et du départ arrêté pour constater les accrocs de premier usage ?
- Après préallocation des objets par pièce, vérifier en écran partagé l'ordre « dessin principal, puis glaces » : la pose pour les glaces réécrit les objets du modèle suivi.
- Les pièces opaques des voitures passées par `options.instances` gardent-elles drapeaux de surface, ombres et présence dans les glaces ? Non vérifié.
