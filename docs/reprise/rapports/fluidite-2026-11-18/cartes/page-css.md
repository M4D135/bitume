# Carte des accrocs — page-css

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Page : un seul document (src/index.html) ; style et modules sont inlinés par construire.py (l.132-138), polices du système, aucune image chargée en course. Dans #vue-course s'empilent en position absolue : #scene (WebGL2 opaque, alpha:false, renderer.js:2387), #scene2 (toile 2D du joueur 2), quatre glaces .glace (toiles 2D posées par matrix3d, avec filter et border-radius, style.css:34), #retro-rendu (second contexte WebGL hors écran, 330×100), #meteo/#meteo2 (pluie, toiles 2D plein écran), #vitre/#vitre2 (gouttes et neige sur la visière), #vignette (dégradé plein écran). Par-dessus : #hud et son clone #hud2 (jeu.js:1877), #demo, #tactile, les menus (hidden = display:none) et le voile #chargement (opacité 0 une fois « fini », style.css:227-228). style.css n'a ni will-change, ni contain, ni mix-blend-mode ; un seul backdrop-filter (pause, l.216).

Boucle : image(t) (jeu.js:2477-2549) → pasSimulation (711) → rendreImage (1616) → rendreVue (1689) → rendu.draw (1801), dessinerMeteo (494 ; meteo.js:88, vitre.js:129), majGlaces (1529) → majHud (1910), une fois par joueur.

Par image, course en solo : 11 texte() gardés par cache (l.1887), 2 style(), 2 attr(), 4 classe() ; changent vraiment : chrono au millième à chaque image, écart, vitesse, FPS et --r souvent. Sans garde : trois .hidden (1952, 1966, 1986), deux transform matrix3d et deux visibility des glaces (1572-1573). Toiles 2D : #meteo effacée même à sec (meteo.js:96), plan #carte redessiné en entier (1989-2003, sous filter drop-shadow), une glace recopiée du second contexte par drawImage (1604), #vitre à 30 Hz s'il pleut ; à deux, copie de la toile WebGL vers #scene2 (1672). Classement : innerHTML toutes les 0,25 s (1970-1985). Lectures de mise en page : clientWidth/clientHeight 8 à 10 fois par image (1286, 1291, 1561, 1568, meteo.js:91 ; le moteur repasse par resize() à chaque draw, renderer.js:3052). Mise en page forcée (offsetWidth) sur événement seulement : annonce (1898), sous-annonce (1904), place gagnée (1917). Allocations estimées dans ce périmètre : environ 25 chaînes (HUD), 70 objets (plan), une centaine pour les glaces, plus 4 à 5 par pièce de voiture posée puis retirée (1591-1595).

Animations CSS en course : annonces (opacité et transformation, 1 à 2,2 s), éclat de position (fond, 0,7 s), témoin de passage (opacité infinie, boîte manuelle), transition de 50 ms du bouton de volant tactile.

Lancement d'une course : demarrerSeance (2364) montre le voile puis, 30 ms après, le retire et enchaîne lancer (172 : installer 134 → B.decor.construire, setWorld/setNappes/setLots, fond du plan, sauf décor déjà bâti par la vitrine, l.141 ; B.course.creer ; douze modèles ; traces ; ambiance) et aller('course') (2015 : HUD affiché, simulation en marche). Restent créés à la première image : second moteur des glaces et son décor (1545-1556), faune, effets de saison, aurores (1714, 1722, 1735), sillage (1621), pluie et vitre du joueur 2 (497, 504). Seul préchauffage existant : la vitrine des menus, qui rend le même circuit en vue télé, sans HUD, sans cockpit ni glaces.

## Constats

### page-css-retro-moteur-paresseux — gravité 5, confiance 0.9
- Où : src/jeu.js : 1545-1556 (déclencheurs : 1515, 1534) (allocation GPU tardive)
- Quand : En course : première image en vue cockpit avec glaces réelles (départ par défaut hors tactile, touche de vue, plan cockpit de la démo, retour au palier 0 d'Auto) ; le décor est rechargé à chaque nouveau circuit ou saison
- Mécanisme : majGlaces crée au premier usage un second moteur FERRO (FRender.create : second contexte WebGL2, shaders, cibles) puis, pour chaque nouveau décor, lui redonne nappes et lots copiés : chargerLots (renderer.js:2731-2741) re-empaquette toutes les instances et refait tous les bufferData. La vitrine du menu ne le chauffe jamais (S.type !== 'vitrine', l.1515). Même image : getContext('2d') et dimensionnement des glaces (l.1549).
- Correctif proposé : Créer retro.rendu dans demarrer() juste après rendu, si le profil permet les glaces. Dans installer(), après rendu.setLots (l.153), charger aussi le décor du second moteur, dimensionner les quatre glaces, puis un draw et un drawImage à blanc, derrière le voile. Mieux, dans la référence FERRO : rendre les glaces vers une texture du contexte principal, sans second contexte ni décor en double.
- Risque : Chargement de chaque circuit allongé du temps de ce second chargement ; mémoire GPU du décor doublée dès la préparation ; contexte créé même si le joueur reste en vue poursuite.

### page-css-voile-sans-chauffe — gravité 4, confiance 0.85
- Où : src/jeu.js : 2364-2373 ; même schéma 1115-1124, 2089-2096, 2722-2725 ; src/style.css 227-228 (préchargement absent)
- Quand : Au lancement de chaque course : les premières images rendues sont visibles et la simulation tourne
- Mécanisme : demarrerSeance pose la classe « fini » du voile (l.2368) avant même lancer() : aucune image n'est rendue derrière lui. La première image de course paie donc à découvert l'affichage du HUD (styles, mise en page, glyphes), le second moteur des glaces, les toiles 2D, et faune, effets de saison, aurores créés au premier rendu (l.1714, 1722, 1735). La simulation tourne déjà : le compte à rebours avance pendant ces images longues.
- Correctif proposé : Rendre demarrerSeance asynchrone : voile opaque (attendre transitionend ou deux rAF), lancer(), puis trois à cinq images de chauffe à dt nul (rendreImage dans chaque vue, glaces des deux côtés, majHud, une annonce en opacité quasi nulle, toiles pluie et vitre), rendu.gl.finish(), et seulement alors aller('course'), oublierIntervalle() et retrait du voile. Même séquence pour lancerEnLigne, demoSuivante et demarrer.
- Risque : Départ retardé de quelques images ; en ligne la chauffe doit tenir dans les 4 s avant T0 (jeu.js:1197). gl.finish() bloque : à n'appeler que sous le voile.

### page-css-meteo-effacee-a-sec — gravité 3, confiance 0.75
- Où : src/meteo.js : 91-96, 107 (appel : src/jeu.js 502 ; style : src/style.css 31) (coût permanent, compositeur)
- Quand : En course et derrière les menus, à chaque image, même par temps sec ou sous la neige
- Mécanisme : dessiner() lit clientWidth et clientHeight, puis fait setTransform et clearRect sur la toile plein écran #meteo à chaque image ; la sortie anticipée « pluie < 0,025 » (l.107) ne vient qu'après. Par temps sec ou sous la neige, la toile est donc marquée modifiée, revidée et recomposée (calque transparent plein écran mélangé par-dessus la toile WebGL) 60 à 144 fois par seconde, pour rien.
- Correctif proposé : Tester la pluie avant tout accès au DOM : sous 0,025, effacer une seule fois (drapeau « sale »), passer canvas.hidden à true et sortir ; réafficher quand la pluie revient (tampon déjà alloué pendant la chauffe). Largeur et hauteur tenues en cache sur resize. Supprimer l'objet d'options alloué à chaque appel (jeu.js:502).
- Risque : Afficher ou masquer la toile modifie l'arbre des calques : à faire au changement de phase météo, jamais image par image.

### page-css-partage-copie-toile — gravité 3, confiance 0.6
- Où : src/jeu.js : 1664-1673 (style : src/style.css 501-506) (copie WebGL vers toile 2D)
- Quand : En course à deux, à chaque image (une sur deux aux paliers serrés)
- Mécanisme : La vue du joueur 2 est rendue dans #scene, recopiée par ctx2.drawImage(canvas, 0, 0) dans la toile 2D #scene2, puis le joueur 1 est rendu dans le même contexte. Une copie inter-contextes d'une demi-image pleine résolution par image : point de synchronisation GPU, voire relecture vers le CPU selon le navigateur (non mesuré). Le contexte 2D et la taille de #scene2 naissent à la première image à deux.
- Correctif proposé : Mesurer d'abord drawImage sur Chrome, Firefox et Safari. Cible : une seule toile WebGL plein écran et deux rendus par viewport et scissor, ce qui demande une option de fenêtre dans draw() de la référence FERRO. En attendant : créer le contexte 2D et dimensionner #scene2 au lancement de la séance à deux, derrière le voile.
- Risque : La cible touche un module verrouillé : elle passe par une version qualifiée de la référence FERRO.

### page-css-glaces-par-image — gravité 3, confiance 0.7
- Où : src/jeu.js : 1558-1604, 1519-1528 (style : src/style.css 34) (copie WebGL vers toile 2D, filtres CSS, ramasse-miettes)
- Quand : En course, vue cockpit avec glaces réelles, à chaque image
- Mécanisme : À chaque image : second rendu FERRO, drawImage du second contexte vers une toile 2D (l.1604), deux chaînes matrix3d refaites (16 toFixed chacune), et deux calques portant filter: brightness() contrast() et border-radius, donc deux surfaces filtrées de plus au compositeur. La voiture entière est posée puis retirée pièce par pièce par splice (l.1591-1595) : plusieurs centaines d'allocations par image (ordre de grandeur estimé, pièces non comptées).
- Correctif proposé : Passer brightness: .9 au draw du rétroviseur et retirer le filter CSS. Poser seulement les pièces de roue arrière (liste préfiltrée par modèle dans voiture.js) au lieu de tout poser puis splice. Réutiliser tableaux et caméra ; ne réécrire matrix3d que si un coin bouge de plus de 0,25 px. Mesurer transferToImageBitmap + bitmaprenderer face à drawImage.
- Risque : La luminosité réglée dans le moteur ne donne pas exactement le rendu du filtre CSS : comparer sur captures.

### page-css-annonces-reflow — gravité 3, confiance 0.75
- Où : src/jeu.js : 1895-1906, 1917 (style : src/style.css 268-269, 296-304) (mise en page forcée, calque créé à chaud)
- Quand : En course, à chaque annonce : Départ, Turbo, Meilleur tour, Dernier tour, Replacé, place gagnée
- Mécanisme : message(), sousMessage() et l'éclat de position relancent leur animation CSS par « void el.offsetWidth » : style et mise en page recalculés de façon synchrone en pleine image, juste après une écriture de texte. L'animation promeut ensuite un calque neuf et fait tramer un texte de 34 à 84 px à ombre floue de 24 px. « Départ » tombe sur l'image du feu vert, « Turbo » à chaque sortie de dérive.
- Correctif proposé : Relancer sans relecture : deux @keyframes identiques (message-a, message-b) alternés par classe, ou un objet Animation créé une fois (el.animate) puis cancel() et play(). will-change: transform, opacity sur .message et .sous-message pour garder le calque. Pendant la chauffe, afficher une fois chaque texte d'annonce en opacité quasi nulle : glyphes et ombres seront en cache.
- Risque : will-change garde deux calques de texte en mémoire en permanence.

### page-css-classement-innerhtml — gravité 3, confiance 0.8
- Où : src/jeu.js : 1970-1986 (style : src/style.css 347, 429) (innerHTML en course)
- Quand : En course hors chrono, toutes les 0,25 s de course ; deux fois à deux
- Mécanisme : Quatre fois par seconde : map, Set, filter, tri, puis une chaîne HTML par ligne (couleur.map().join, regex de nomCourt, toFixed) et, dès qu'un écart change, innerHTML : une trentaine de nœuds détruits et recréés, avec analyse, styles, mise en page et peinture. Une image sur 15 à 30 est donc plus longue que ses voisines. Tout est fait même liste masquée (tactile, largeur ≤ 760 px).
- Correctif proposé : Créer une fois sept <li> fixes de quatre <span> et n'y mettre à jour que textes, couleurs et classes changés, via texte(), style() et classe(). Couleurs rgb() précalculées par voiture au lancement. Ne rien calculer si la liste est masquée (drapeau tenu par matchMedia et estTactile). Décaler ce rafraîchissement d'une image par rapport à celui du plan.

### page-css-pluie-sans-plafond — gravité 3, confiance 0.7
- Où : src/meteo.js : 93-96, 150-160 (toile 2D redessinée par image)
- Quand : En course sous la pluie, à chaque image
- Mécanisme : La toile de pluie vaut la taille CSS × min(dpr, 1,5) sans plafond de pixels, alors que vitre.js en a un (MAX_PIXELS, l.4 et 46) : 8,3 Mpx sur un écran 4K à 150 %. À chaque image : effacement complet, jusqu'à 840 traits en trois stroke() à bouts ronds, trois chaînes rgba, puis mélange plein écran. La charge suit la fréquence de l'écran.
- Correctif proposé : Plafonner comme vitre.js (≈ 2 Mpx) et tirer le dpr du profil (1 en Légère et Moyenne). lineCap « butt » (indiscernable à 0,5–1 px) et couleurs précalculées. À comparer, mesure à l'appui, avec des traits dessinés par le moteur dans la passe WebGL (un seul appel de dessin), ce qui supprimerait ce calque.
- Risque : Traits un peu plus épais à définition réduite.

### page-css-vignette-doublon — gravité 2, confiance 0.8
- Où : src/index.html : 18 (style : src/style.css 36 ; bandeaux tactiles : 329, 416) (calque plein écran redondant)
- Quand : En permanence, à chaque image composée
- Mécanisme : #vignette est un dégradé radial plein écran posé sur la toile WebGL, alors que le shader du moteur applique déjà sa vignette (renderer.js:923-924). Le compositeur mélange donc un calque translucide plein écran de plus à chaque image et garde ses tuiles ; le calque du HUD, peint après lui, s'étend à tout l'écran. En tactile, deux bandeaux dégradés s'y ajoutent (style.css:329, 416).
- Correctif proposé : Supprimer #vignette et sa règle. Pour garder des bords plus sombres, passer vignette (≈ 0,45, à régler à l'œil) dans les options de FRender.create (jeu.js:2697) : l'option existe (renderer.js:2371-2375), le moteur verrouillé n'est pas touché. Valider sur captures avant/après, écran titre compris.
- Risque : Aspect des bords légèrement modifié, y compris derrière les menus ; le coût réel du mélange reste à mesurer par machine.

### page-css-plan-par-image — gravité 2, confiance 0.8
- Où : src/jeu.js : 1989-2003 (plan.vers : 106 ; style : src/style.css 307) (toile 2D redessinée par image)
- Quand : En course et en démo, à chaque image ; deux fois à deux
- Mécanisme : Le plan est redessiné en entier à chaque image : getContext, clearRect, drawImage du fond, 12 arcs avec fill et stroke, un tableau par p.vers() et une chaîne rgb() (map + join) par rival, soit environ 70 allocations. La toile porte filter: drop-shadow : le compositeur refait une passe de flou à chaque mise à jour. Le dessin a lieu même carte masquée (data-carte='non').
- Correctif proposé : Redessiner à 10–15 Hz (les points bougent de moins d'un pixel par image), sur une autre image que le classement. Cuire l'ombre une fois dans scene.fond (shadowBlur à l'installation, l.155-157) et retirer le filter CSS. Contexte, couleurs et coordonnées en cache (vers() écrivant dans un tableau réutilisé). Sortir aussitôt si reglages.carte vaut 'non'.

### page-css-hud-texte-par-image — gravité 2, confiance 0.7
- Où : src/jeu.js : 1916-1948, 2005-2006 (style : src/style.css 244-248, 281-284) (écritures DOM par image)
- Quand : En course, à chaque image
- Mécanisme : Le chrono au millième (l.1924) change à chaque image ; l'écart (l.1933), la vitesse et le compteur FPS (l.2006) presque autant. Chaque écriture de texte relance style, mise en page (boîtes flex et grille sans confinement, donc jusqu'à la racine), peinture à double ombre floue et tramage, 60 à 144 fois par seconde. chrono(j.meilleur), « /12 » et la santé sont reformatés à chaque image sans avoir changé : environ 25 chaînes.
- Correctif proposé : Plafonner les écritures du HUD à 20–30 Hz (FPS à 2 Hz) en répartissant textes, plan et classement sur des images différentes. contain: layout paint et largeur fixe (en ch) sur .chronos, .case, .tableau et .fps. Ne formater qu'au changement de valeur (comparer le nombre avant de bâtir la chaîne). Ne rien écrire dans les blocs masqués (tableau réduit).
- Risque : Chrono rafraîchi à 30 Hz : les millièmes sautent, mais ils sont illisibles à l'œil.

### page-css-cadence-en-images — gravité 2, confiance 0.85
- Où : src/jeu.js : 1540-1543, 1569-1574, 1667-1668 (cadence liée à la fréquence d'écran)
- Quand : En course, selon l'écran : 30, 60, 120 ou 144 Hz
- Mécanisme : La cadence des glaces (saut = 30 / hz, l.1541-1543) et celle du joueur 2 (une image sur deux, l.1668) se comptent en images, pas en temps : à 120 Hz chaque glace est rendue 60 fois par seconde (charge doublée), à 30 i/s 15 fois. Quand une image de glace est sautée, le retour (l.1543) précède l'écriture des matrix3d : la glace reste à l'ancienne position de la caméra.
- Correctif proposé : Cadencer au temps : cumuler dtImage et rendre une glace quand 1/(2 × hz) s est écoulée ; même règle pour la vue du joueur 2. Écrire les transformations matrix3d à chaque image, avant le test de saut. À 120 Hz et plus, garder 30 Hz par glace : une image sur deux n'a plus de second rendu.

### page-css-creations-paresseuses — gravité 2, confiance 0.6
- Où : src/jeu.js : 497-498, 504-505, 1531-1532, 1549, 1670-1671 ; src/vitre.js 43-48, 136, 141 (création paresseuse au premier usage)
- Quand : Première image d'une course à deux ; première goutte sur la visière en course
- Mécanisme : Créés dans le chemin d'une image : pluie et vitre du joueur 2 (creerPluie, B.vitre.creer : 148 objets, contexte 2D), état et contextes des glaces, contexte 2D et taille de #scene2. La toile #vitre n'est dimensionnée qu'en course et dessinée à la première goutte : son tampon (jusqu'à 2 Mpx) et son calque naissent alors en pleine course, quand la pluie arrive (comportement du navigateur supposé, non mesuré).
- Correctif proposé : Tout créer au démarrage : les quatre objets pluie et vitre, retro.j1 et retro.j2, les contextes 2D. Au lancement d'une séance, derrière le voile : dimensionner #vitre, #meteo, #scene2 et les glaces, puis y dessiner une fois (un tracé presque transparent suffit) pour forcer l'allocation des tampons et la création des calques.

### page-css-lectures-mise-en-page — gravité 2, confiance 0.8
- Où : src/jeu.js : 1269, 1286, 1291, 1561, 1568 ; src/meteo.js 91 ; src/vitre.js 44-45 (lecture de mise en page par image)
- Quand : En course, à chaque image (8 à 10 lectures en cockpit avec glaces)
- Mécanisme : clientWidth et clientHeight de #scene, #retro-rendu, #meteo et #vitre sont relus à chaque image (le moteur repasse aussi par resize() à chaque draw, renderer.js:3052). Chaque lecture fait vérifier styles et mise en page ; à deux, celles de la vue du joueur 1 suivent les écritures de transform des glaces du joueur 2 et forcent un recalcul de style synchrone. Ces tailles ne changent qu'au redimensionnement ou au changement de partage.
- Correctif proposé : Tenir un objet de taille { l, h, aspect } par toile, rempli par un ResizeObserver (ou resize et changement de data-partage), et le lire dans champCockpit, champAdapte, majGlaces, meteo.dessiner et vitre.dimensionner, qui accepte déjà c.largeur et c.hauteur. Plus aucune lecture du DOM dans la boucle du jeu.

### page-css-volant-tactile — gravité 2, confiance 0.65
- Où : src/jeu.js : 632-637 (style : src/style.css 332) (DOM dans un gestionnaire d'entrée)
- Quand : En course sur écran tactile, à chaque pointermove du volant
- Mécanisme : Chaque déplacement du pouce lit zone.clientWidth et bouton.offsetWidth (vidage synchrone des styles, salis par l'écriture précédente), puis écrit bouton.style.transform. La règle transition: transform .05s relance une transition à chaque événement : une animation du compositeur créée puis annulée à chaque image, avec validation par le fil principal, au lieu d'un simple changement de transformation.
- Correctif proposé : Calculer la course une fois (pointerdown et resize). Dans pointermove, ne garder que doigt.volant ; écrire la transformation une fois par image depuis la boucle, seulement si la valeur a changé. Retirer la transition et poser will-change: transform sur .bouton-volant.

### page-css-jauges-largeur — gravité 2, confiance 0.65
- Où : src/style.css : 312-316, 320-324, 444 (écritures : src/jeu.js 1938-1939, 1955-1958) (CSS : mise en page et animation)
- Quand : En course : régime à chaque image (tableau complet ou vue poursuite), jauge pendant chaque dérive, témoin de passage en boîte manuelle
- Mécanisme : --r et --f pilotent width: calc(var() * 100%) : chaque image refait style, mise en page et peinture de la barre (sous mask et overflow) et des trois segments. Le témoin « passer » est une animation infinie d'opacité sur un pseudo-élément sous masque, créée et détruite à chaque bascule de classe ; la fenêtre de dérive ajoute un box-shadow de 22 px (filter drop-shadow en tactile).
- Correctif proposé : Largeur fixe et transform: scaleX(var(--f)), origine à gauche, pour les segments ; clip-path: inset(0 calc((1 - var(--r)) * 100%) 0 0) pour la barre : plus de mise en page. Témoin de passage piloté par l'écriture existante (classe alternée à 8 Hz) plutôt que par une animation infinie. Pas de filter sur la jauge tactile.

### page-css-stockage-ligne — gravité 2, confiance 0.7
- Où : src/jeu.js : 836-838, 847-849, 674-681 (localStorage et JSON synchrones)
- Quand : En course : au passage de la ligne (record battu, chaque tour en chrono) et à chaque changement de vue
- Mécanisme : finTour écrit les records (JSON.stringify + localStorage.setItem) dès qu'un record tombe ; en chrono il relit et analyse à chaque tour le fantôme stocké (jusqu'à ≈ 44 Ko en base64), puis au meilleur tour l'encode et le réécrit, le tout dans le pas de simulation, en pleine ligne droite. changerVue() appelle sauverReglages() : une écriture synchrone sur la touche de vue.
- Correctif proposé : Garder en mémoire le temps et la longueur du fantôme lus au lancement (l.191-195) : plus de lireStock par tour. Mettre les écritures en file et la vider hors course : pause, résultats, visibilitychange, pagehide. Même file pour sauverReglages quand l'écran est « course ».
- Risque : Un record battu puis un onglet tué avant la fin de course serait perdu si pagehide ne passe pas.

### page-css-petits-couts-permanents — gravité 1, confiance 0.6
- Où : src/jeu.js : 125-128, 1617, 1888-1889, 1952, 1966, 1986 ; src/style.css 216 (coût permanent)
- Quand : En course, à chaque image ; pause d'une course en ligne
- Mécanisme : Trois .hidden affectés sans garde par HUD (jauge, feux, classement) : un attribut réécrit à l'identique redemande un recalcul de style local (comportement Blink supposé). appliquerCarte() relit trois dataset et alloue un tableau à chaque image ; attr() et style() fabriquent leur clé par concaténation. profilDe() est résolu au moins cinq fois par image (objets gelés). En ligne, la pause garde backdrop-filter: blur sur une course qui continue.
- Correctif proposé : Garder les trois .hidden (if (el.hidden !== v)). Appeler appliquerCarte() au seul changement de réglage. Clés de cache constantes passées par l'appelant. Résoudre le profil une fois par image et le passer en argument, ou le mémoriser tant que palier, réglages et capacités sont inchangés. Pas de backdrop-filter quand la séance est en ligne.

## Points d’entrée utiles

- demarrerSeance(type, conditions) — src/jeu.js:2364 : point d'entrée unique du départ (Départ, Recommencer, Rejouer) ; variantes lancerEnLigne 1115, lancerDemo 2083, demoSuivante 2089, demarrer 2694.
- Voile #chargement (src/index.html:471, src/style.css:227-228) : la classe « fini » le rend transparent ; à tenir opaque pendant la chauffe.
- installer(i, saison) — src/jeu.js:134-163 : seul endroit où le décor est donné au moteur (rendu.setWorld/setNappes/setLots, l.151-153) et où le fond du plan est dessiné (155-157) ; y charger aussi le second moteur des glaces. Retour immédiat si le décor est déjà bâti (l.141).
- lancer(type, i, enl, conditions) — src/jeu.js:172-237 : crée la séance (douze modèles l.207, traces l.213, ambiance l.215) ; nature.faune, effetsSaison et aurores y restent à null (l.217) et sont créés au premier rendu.
- rendreImage(S, alpha, dtImage) 1616, rendreVue 1689, majGlaces 1529, dessinerMeteo 494, majHud 1910 : appelables avec dt nul pour des images de chauffe ; image() rend déjà des images figées à dt = 0 (l.2517-2521).
- aller(nom) — src/jeu.js:2015 : bascule d'écran, rend le HUD visible (l.2028) ; oublierIntervalle() (2471) remet à zéro tPrec, le gouverneur Auto et les mesures après une image longue.
- API rendue par FRender.create (src/moteur/renderer.js:3265) : draw, resize, setWorld, updateWorld, setNappes, setLots, setEnvironment, updateShape, profile, calibrate, setRenderScale, setBudgetTarget, stats, et gl (contexte brut : gl.finish() ou fenceSync en fin de chauffe). calibrate, setRenderScale, setBudgetTarget et gl ne sont pas encore utilisés par le jeu.
- Options de création du moteur (renderer.js:2371-2375, 2385) : msaa, shadowMapScale, reflections, vignette, bloomThreshold ; vignette permet de retirer le calque #vignette sans toucher au moteur.
- B.meteo.creerPluie(canvas) — src/meteo.js:77 ; B.vitre.creer / mettreAJour / effacer — src/vitre.js:20, 129, 32 ; dimensionner accepte c.largeur, c.hauteur, c.dpr (vitre.js:44-46) : aucune lecture du DOM si on les fournit.
- Écritures gardées par cache : texte, attr, style, classe (src/jeu.js:1887-1890) ; tables d'éléments déjà résolues HUD1/HUD2 (1884-1886) ; #hud2 cloné au chargement (1877).
- Mesure : B.mesures (F3) avec les sections simulation, rendu, hud, son, effets (src/jeu.js:2518, 1803, 2538, 2542, 1787) ; BITUME_JEU.banc({ duree, chauffe, qualite, circuit }) (2821) rend p50, p95 et pire ; BITUME_JEU.reference() (2751) fixe vue, partage, rétroviseurs et météo.
- Profil résolu : B.graphismes.melange (src/graphismes.js:205-256) donne P.effets.retroImages, P.secondaires.retroviseurs.hz et P.secondaires.partage.hz, c'est-à-dire les droits et cadences des vues secondaires.
- detecterGraphismes() (src/jeu.js:2634) et B.sceneBench.creer(rendu, …) (2652) : parcours synthétique existant (preparer, dessiner), modèle possible pour une passe de chauffe.

## À mesurer

- Durée réelle de la première image cockpit avec glaces (FRender.create du second contexte + setNappes/setLots en double), par circuit et par qualité ; durée de rendu.setLots seul pour comparaison.
- Coût de drawImage(toile WebGL → toile 2D) pour les glaces (495×150) et pour l'écran partagé (demi-écran) sur Chrome, Firefox et Safari : copie GPU ou relecture vers le CPU ? À comparer avec transferToImageBitmap + bitmaprenderer.
- Temps GPU du compositeur avec et sans #meteo, #vitre et #vignette, à 1080p, 1440p et 4K sur processeur graphique intégré (trace Chrome catégorie viz, ou DevTools > Layers).
- Temps du navigateur par image dû au HUD (Recalculate Style, Layout, Paint, Commit dans l'onglet Performance) à 60 et 120 Hz : la section « hud » de B.mesures ne compte que le JavaScript de majHud.
- Durée de l'image qui porte le classement (innerHTML) et de celle du feu vert (annonce « Départ » + feux masqués + classement) : écart à la médiane dans le banc.
- La référence FERRO peut-elle rendre vers une texture (glaces) et dans une fenêtre de la toile (écran partagé) ? Cela supprimerait le second contexte, le décor en double et les copies drawImage.
- Fréquence et durée des ramasse-miettes mineurs en course (--trace-gc ou profil mémoire) : part du HUD et des glaces face à la liste « sortie » du rendu.
- Nombre de pièces de mod.corps posées puis retirées par splice pour la roue arrière des glaces (src/jeu.js:1591-1595) : non compté ici.
- Une toile 2D jamais dessinée (#vitre par temps sec) est-elle tout de même un calque plein écran composé dans Chrome et Safari ? Et un .hidden réécrit à l'identique coûte-t-il un recalcul de style hors Blink ?
- Mode accessibilité actif (lecteur d'écran, certaines extensions) : coût par image des textes du HUD et de la région aria-live #message (src/index.html:39) ; faut-il aria-hidden sur les compteurs rapides ?
- Sur mobile, la barre d'adresse ou 100dvh (src/style.css:398, 412) font-ils varier la taille de #scene pendant la course, donc réallouer les cibles du moteur ?
- Page monolithique : compilation paresseuse du JavaScript inliné au premier appel d'un chemin rare en course, et moment où tombe le décodage de PhysX lancé en tâche de fond (src/jeu.js:2719, script inline de 12 Mo) : visibles dans un profil ?
