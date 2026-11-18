# Carte des accrocs — jeu-boucle

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Racine : /Users/david/Projects/bitume ; « jeu.js » = src/jeu.js, « renderer.js » = src/moteur/renderer.js.

BOUCLE. `image(t)` (jeu.js 2477-2549) se réarme par rAF. `tBrut = (t − tPrec)/1000` (DT à la première image), `dtReel = min(0,1 s ; tBrut)`, `horlogeReelle += dtReel`, `dureeImage` lissée à 10 % par image (2482-2484). Puis `lireManette` (367), `majAttente` (2073), simulation à pas fixe : `S.acc += dtReel`, `while (acc ≥ DT && n < 14) pasSimulation` (2513-2516). Le plafond de 14 n'est jamais atteint : le bridage à 100 ms donne 12 pas au plus, le reste du retard est abandonné (ralenti). En ligne, jusqu'à 90 pas calés sur l'horloge commune (2505-2509). Hors course, image figée redessinée à 4 Hz (2517). Ensuite `rendreImage(S, alpha = acc/DT, dtVu)` (2521, 1616), `majPalier(S, tBrut)` (2522, 1400), `majHud` (2525, 1910), `majSon` (2540), mesures (2541-2548). Retour d'onglet : `oublierIntervalle` (2471) sur `visibilitychange` et `focus` (348-354), pause automatique. Manquent : période d'écran mesurée, arrondi de l'intervalle, verrou sur un diviseur ; `FLoop` de FERRO (src/ferro/loop.js) les fournit mais n'est pas chargé (construire.py 23-67).

QUALITÉ. `profilDe` (1387) recalcule `B.graphismes.melange` (graphismes.js 205) à chaque usage. Auto : `B.qualite.avancer` (qualite.js 6) descend si la moyenne de 3 s dépasse 20 ms, remonte après 8 s sous 14 ms ; coupes (graphismes.js 145) : 1 glaces et reflets, 2 ombres, 3 halo et MSAA, 4 résolution 0,75. `appliquerPalier` (1407) = `rendu.resize`. Le moteur ajoute son gouverneur de résolution (renderer.js 1634) et crée ses cibles au premier usage, libérées après 120 rendus (2527-2580). Après une détection réussie la qualité est fixe ; Auto reste si elle est passée ou interrompue.

LANCEMENT D'UNE COURSE. `demarrerSeance` (2364) : voile, 30 ms, puis une seule tâche : `lancer` (172) → `installer` (134 : décor, nappes, lots, plan ; sauté si la vitrine tient déjà la scène), `B.course.creer`, fantôme lu au stockage (191), douze `B.voiture.modele`, `B.traces.creer`, `B.ambiance.creer`, poses ; puis `aller('course')` (2015). Naissent à la première image : sillage (1621), faune (1714), effets de saison (1722), aurores (1735), lampes (1474), second moteur des glaces et sa copie du décor (1545-1556), toiles du joueur 2 (497, 504, 1670), cibles du moteur.

DÉMARRAGE. `demarrer` (2694) : sonde WebGL2, `FRender.create` (tous les programmes liés d'un coup), détection au premier lancement (`detecterGraphismes` 2634, `B.autoconfig.executer`, `B.sceneBench`), PhysX en fond (2719), son, vitrine, titre.

HUD. Écritures filtrées par `texte/attr/style/classe` (1887-1890) ; classement à 4 Hz par `innerHTML` (1970) ; plan redessiné à chaque image (1988).

MESURES. `B.mesures` : anneau de 240 images, sections CPU, GPU par requêtes asynchrones, volet à 5 Hz (F3) ; `BITUME_JEU.banc` (2821) mesure l'intervalle rAF après 1 s de chauffe ; `reference` (2751) fixe le scénario.

STOCKAGE. `localStorage` synchrone : réglages à chaque changement, records et fantôme dans `finTour` (829-853).

ALLOCATIONS. Environ 400 par image dans la coque à 60 Hz (profil 110, HUD 100 dont carte 70, vue 75, glaces 60, deux pas 65), hors pièces de voitures et moteur.

## Constats

### jeu-boucle-01-moteur-des-glaces-tardif — gravité 5, confiance 0.85
- Où : /Users/david/Projects/bitume/src/jeu.js : 1545-1556, 1549, 1515 ; moteur : /Users/david/Projects/bitume/src/moteur/renderer.js 2473-2482, 2647-2649, 2731-2741 (shaders et allocation GPU au premier usage)
- Quand : En course : première image en vue cockpit de chaque séance (sur la grille), premier passage en cockpit en pleine course (touche de vue), chaque nouvelle scène. La vitrine ne le chauffe jamais.
- Mécanisme : `majGlaces` crée à la demande un second moteur (`FRender.create` : tous les programmes compilés et liés de façon synchrone), puis `setNappes`/`setLots` réempaquettent et retéléversent tout le décor dans ce second contexte ; les contextes 2D des glaces naissent au même moment. `retroVoulu` exclut la vitrine : rien n'est prêt avant la première image de course. Lu hors de ma tranche, en suivant les appels ; durée non mesurée.
- Correctif proposé : Créer `retro.rendu` dans `demarrer()` juste après le moteur principal ; poser son décor dans `installer()` avec la même clé de scène ; créer les contextes 2D des quatre glaces au démarrage ; dessiner une image de glace voile fermé pendant le préchargement. `majGlaces` ne doit plus contenir aucun « si absent, créer ».
- Risque : Mémoire GPU du décor doublée même quand les glaces ne serviront pas (écran tactile, qualité Légère) : ne créer que si `retroVoulu` peut devenir vrai.

### jeu-boucle-02-depart-sans-prechauffe — gravité 4, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 2364-2374, 2083-2087 ; créations paresseuses : 1621, 1635, 1714, 1722, 1735, 1474, 497-505, 1670-1671 ; /Users/david/Projects/bitume/src/style.css 227-228 (préchargement absent)
- Quand : Chaque départ (Départ, Recommencer, Rejouer, démo) : les premières images de la course.
- Mécanisme : Le voile n'est posé que 30 ms et retiré dans la tâche même de `lancer()` ; aucune image n'est rendue cachée. Sillage, tableaux de roues, faune, effets de saison, aurores, lampes du tunnel, pluie et vitre du joueur 2, toile `scene2`, cibles MSAA, ombres et reflets du moteur naissent à la première image visible, pendant le fondu de 0,3 s : le voile découvre une image gelée.
- Correctif proposé : Rendre `demarrerSeance` asynchrone : voile opaque, `lancer`, création explicite de ces objets, puis 3 à 5 images dessinées voile fermé avec toutes les options que le profil peut ouvrir (ombres, halo, MSAA, reflets, lampes, glaces, vue du joueur 2) et un `readPixels` 1×1 ; `oublierIntervalle()` ; lever le voile seulement ensuite. Même chemin pour `lancerDemo` et `reference`.
- Risque : Départ allongé de quelques dixièmes de seconde ; en ligne, l'instant T0 commun doit rester inchangé.

### jeu-boucle-03-aucun-verrou-de-cadence — gravité 4, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 2477-2478, 2511-2516 ; /Users/david/Projects/bitume/src/autoconfig.js 42-48 ; /Users/david/Projects/bitume/construire.py 23-67 (src/ferro/loop.js non chargé) (cadence)
- Quand : En course, dès que le coût d'une image dépasse la période de l'écran ; quasi permanent sur écran 120/144 Hz avec une machine moyenne.
- Mécanisme : La boucle rend à chaque rappel rAF, sans cible de cadence ni période d'écran connue. Quand une image coûte plus qu'une période, les intervalles alternent une et deux périodes (16,7/33,3 ms ; 6,9/13,9 ms à 144 Hz) : saccade plus visible qu'un 30, 60 ou 72 i/s tenu. La détection retient d'ailleurs un profil dès 56 i/s sur un écran 144 Hz (budget borné à 16,7 ms).
- Correctif proposé : Mesurer la période (médiane glissante, ou `FLoop` de FERRO ajouté à `MODULES`), puis verrouiller sur un diviseur k : ne rien simuler ni dessiner tant que `t − tRendu < (k − 0,5) × période`. Choisir k par hystérésis sur le temps de travail p95 (section « boucle » + GPU) ; réglage « Cadence : Auto, 30, 60, 120 ».
- Risque : Latence d'entrée plus longue quand k > 1 ; sur écran à fréquence variable, ne pas verrouiller si la période mesurée bouge.

### jeu-boucle-04-auto-seuils-absolus — gravité 4, confiance 0.9
- Où : /Users/david/Projects/bitume/src/qualite.js : 4, 22, 27-29 ; /Users/david/Projects/bitume/src/jeu.js 1377, 1400-1406 (qualité Auto)
- Quand : Qualité Auto (valeur par défaut tant que la détection est passée ou interrompue), en course.
- Mécanisme : Seuils absolus sur l'intervalle rAF : descente si la moyenne de 3 s dépasse 20 ms, remontée après 8 s sous 14 ms. À 60 Hz l'intervalle vaut 16,7 ms : la remontée est impossible et toute descente dure jusqu'au rechargement (`palier.n` n'est remis à zéro ni par `lancer` ni par `aller`). À 30 Hz (économie d'énergie) : palier 4 en 12 s. À 144 Hz : 50 i/s tolérées.
- Correctif proposé : Seuils relatifs à la cadence visée (k × période mesurée) : lent au-delà de 1,15 × cible ; aise jugée sur le temps de travail réel (section « boucle » + GPU) sous 0,65 × cible, pas sur l'intervalle synchronisé. Remettre `palier` à l'état initial dans `lancer()`. Écarter tout échantillon supérieur à trois périodes.
- Risque : Sans temps GPU mesurable (extension absente), l'aise ne repose que sur le temps JS : garder alors une remontée prudente, hors course.

### jeu-boucle-05-palier-auto-reallocations — gravité 4, confiance 0.75
- Où : /Users/david/Projects/bitume/src/jeu.js : 1403-1407, 2521-2522, 1801 ; /Users/david/Projects/bitume/src/graphismes.js 145-151, 257-259 ; /Users/david/Projects/bitume/src/moteur/renderer.js 2516-2525, 2527-2549, 2554-2580, 2808-2829 (allocation GPU tardive, redimensionnement)
- Quand : À chaque changement de palier Auto en course ; aller-retour possible toutes les 11 s sur un écran de 75 Hz et plus (8 s d'aise, 3 s de lenteur).
- Mécanisme : Un palier coupe ou rouvre glaces, reflets, ombres, halo et MSAA : le moteur libère chaque cible après 120 rendus sans usage et la recrée au premier rendu qui la redemande (atlas d'ombres, MSAA 4× pleine taille, `checkFramebufferStatus`). Au palier 4, `appliquerPalier` redimensionne la toile après le rendu de l'image (2521-2522) : tampon vidé avant présentation, donc une image noire probable, puis toutes les cibles recréées.
- Correctif proposé : Appliquer le palier avant `rendreImage`, jamais après. En course, Auto ne fait que descendre ; la remontée attend la pause, les résultats ou le lancement suivant, avec mémoire du palier qui a échoué. Aucun changement de résolution en course : échelle fixée au préchargement. Côté référence FERRO : option gardant les cibles allouées toute la séance.
- Risque : Qualité plus basse que nécessaire jusqu'à la pause suivante. L'image noire n'a pas été observée, elle découle de l'ordre des appels.

### jeu-boucle-06-gouverneur-de-resolution-du-moteur — gravité 4, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1801, 2484 ; /Users/david/Projects/bitume/src/moteur/renderer.js 1634-1650, 3052, 2820-2827, 2516-2522 (redimensionnement de cibles)
- Quand : Qualité Auto, en course : moyenne lissée au-dessus de 25 ms pendant 1,3 s, ou sous 18,5 ms pendant 5 s ; en continu quand la cadence est de 30 Hz.
- Mécanisme : `adaptive: true` et `frameMs: dureeImage` activent le gouverneur de résolution du moteur : `autoScale` bouge par pas de 0,1 ou 0,05, `canvas.width/height` changent, la clé d'`ensureTargets` aussi : scène, halo, MSAA et reflets sont détruits puis recréés, avec un saut de définition visible. À 30 Hz stable il descend jusqu'à 0,65 en quatre réallocations ; à 60 Hz synchronisé il peut osciller entre deux échelles (supposition).
- Correctif proposé : Passer `adaptive: false` pendant une course et fixer l'échelle au préchargement à partir des mesures de la détection ou de la séance précédente ; ne la réviser qu'à la pause ou entre deux séances. À terme, dans la référence FERRO : résolution dynamique par `viewport` dans des cibles de taille fixe, sans réallocation.
- Risque : Sans adaptation en course, une échelle mal choisie se paie jusqu'à la pause : d'où l'intérêt du verrou de cadence.

### jeu-boucle-07-reflets-crees-a-la-premiere-pluie — gravité 4, confiance 0.75
- Où : /Users/david/Projects/bitume/src/jeu.js : 1419-1427, 1801 ; /Users/david/Projects/bitume/src/moteur/renderer.js 2556, 2565-2577, 2648 (allocation GPU tardive)
- Quand : En course, qualité Fine ou Auto au palier 0, quand l'eau sur la piste franchit 0,2 (pluie, météo variable ou réelle) ; de nouveau après 120 rendus au sec.
- Mécanisme : `avecReflets` devient vrai au milieu de la course : le moteur crée alors `reflectSource` (couleur et profondeur pleine taille) et `reflection` (demi-taille), avec `checkFramebufferStatus`, et `ssrProgram`, lié au démarrage, sert pour la première fois (compilation différée par le pilote : supposition). Les cibles sont libérées après 120 rendus sans reflets et recréées à l'averse suivante.
- Correctif proposé : Au préchargement, si le profil autorise les reflets et que la météo peut mouiller la piste, dessiner une image cachée avec `reflections: true`. Garder les cibles vivantes : soit une option « sans libération » dans la référence FERRO, soit des reflets maintenus actifs tant que la séance peut pleuvoir (coût GPU à mesurer).
- Risque : Mémoire GPU tenue pendant toute la séance ; reflets maintenus = passe supplémentaire sur piste sèche.

### jeu-boucle-08-intervalle-brut-non-arrondi — gravité 3, confiance 0.65
- Où : /Users/david/Projects/bitume/src/jeu.js : 2482-2484, 2513, 2521 (cadence)
- Quand : Chaque image ; sensible quand l'horodatage rAF est arrondi (Firefox, Safari : à confirmer) et à 120/144 Hz.
- Mécanisme : `dtReel` est la différence brute de deux horodatages rAF. Elle alimente telle quelle l'accumulateur, `alpha`, les caméras lissées, la météo et `horlogeReelle`. Dès que l'horodatage est arrondi à la milliseconde ou qu'un rappel glisse, le monde avance de pas inégaux (6, 7, 8 ms à 144 Hz) alors que l'écran présente à intervalles réguliers : micro-saccade sans image perdue. Arrondi réel des navigateurs non mesuré ici.
- Correctif proposé : Arrondir `tBrut` au multiple entier de la période mesurée quand l'écart est inférieur à 20 %, reporter la différence dans une dette résorbée à 10 % par image, verrouiller le nombre de pas quand la période est un multiple de 1/120 s (60 et 120 Hz : 2 et 1 pas, alpha constant). C'est ce que fait `FLoop.advance` de `src/ferro/loop.js`.
- Risque : En ligne, la simulation suit l'horloge commune (2505-2509) : n'arrondir que le chemin local. `majPalier` doit garder l'intervalle brut.

### jeu-boucle-09-premier-intervalle-apres-lancer — gravité 3, confiance 0.85
- Où : /Users/david/Projects/bitume/src/jeu.js : 2364-2374, 2482-2483, 2513-2516, 2522, 2471-2476, 2807 (cadence, qualité Auto)
- Quand : Première image après `lancer()` (départ, recommencer, démo lancée depuis le titre ligne 2079) et après toute image longue.
- Mécanisme : `tPrec` n'est remis à zéro que par `reference`, la visibilité et la détection. Après un `lancer()` ordinaire, la première image reçoit `dtReel` = 100 ms : jusqu'à douze pas de simulation s'ajoutent à l'image la plus froide. `majPalier` reçoit `tBrut` non borné : 0,5 s de chargement cumulé suffit, à 60 Hz, à faire descendre Auto d'un palier trois secondes après le départ.
- Correctif proposé : Appeler `oublierIntervalle()` et mettre `S.acc = 0` à la fin de `demarrerSeance` et de `lancerDemo`. Dans `B.qualite.avancer`, ignorer la première seconde d'une séance et borner chaque échantillon à trois périodes. Borner aussi le rattrapage à quatre périodes plutôt qu'à 100 ms fixes.

### jeu-boucle-10-plan-du-circuit-a-chaque-image — gravité 3, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 1988-2003, 106 ; /Users/david/Projects/bitume/src/style.css 307, 404, 34 (coût permanent, toile 2D, filtre CSS)
- Quand : Chaque image de course et de démo, carte masquée comprise (data-carte à non) ; deux fois par image à deux.
- Mécanisme : Le plan est effacé puis redessiné à chaque image : `drawImage` du fond, puis par voiture un tableau (`p.vers`), un `map().join()`, deux couleurs CSS à analyser, `fill` et `stroke` ; environ 70 allocations. La toile porte `filter: drop-shadow`, recalculé à chaque changement de contenu ; les glaces portent aussi un filtre CSS.
- Correctif proposé : Redessiner à 15-20 Hz et jamais si `reglages.carte === 'non'` ; chaînes de couleur calculées une fois dans `lancer` ; coordonnées écrites sans tableau ; ombre cuite dans `scene.fond` et filtre CSS retiré ; luminosité des glaces passée par l'option `brightness` du rendu plutôt que par `filter`.

### jeu-boucle-11-hud-mise-en-page-par-image — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1924, 1933, 1936-1938, 1946, 1953-1957 ; /Users/david/Projects/bitume/src/style.css 259, 312-314, 321 (DOM, coût permanent)
- Quand : Chaque image de course.
- Mécanisme : Chrono au millième et écart changent de texte à chaque image ; régime et dérive passent par `--r`/`--f`, lus en `width: calc(…)` sous un masque. Style, mise en page et peinture du HUD sont donc refaits à chaque image, à 144 Hz comme à 60. La feuille ne contient aucun `contain` : rien n'isole ces cases.
- Correctif proposé : Remplacer `width` par `transform: scaleX()` ou `clip-path` ; rafraîchir chrono, écart, vitesse et régime à 30 Hz au plus, sur une image différente de celle de la carte ; `contain: layout paint` et largeur fixe sur les cases numériques.
- Risque : `scaleX` écrase le dégradé de la barre de régime : préférer `clip-path` pour elle.

### jeu-boucle-12-stockage-synchrone-en-course — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 836-838, 847-849, 24-25, 51-56, 674-681 (stockage local synchrone)
- Quand : En course : au passage de la ligne (chaque tour de chrono ; tout nouveau record) et à chaque changement de vue.
- Mécanisme : `finTour` relit et analyse le fantôme gardé (`lireStock`, jusqu'à 43 ko de base64) à chaque tour de chrono, même sans record ; sur un meilleur tour : `enBase64`, `JSON.stringify` et `localStorage.setItem` synchrones, à l'intérieur d'un pas de simulation. `changerVue` réécrit tous les réglages en pleine course. Durées non mesurées.
- Correctif proposé : Garder en mémoire le temps et la longueur du fantôme lu dans `lancer` (ligne 191) : plus aucune relecture. Mettre records, fantôme et réglages dans une file vidée à la pause, aux résultats, sur `visibilitychange` ou par `requestIdleCallback`.
- Risque : Un onglet tué avant la vidange perd le dernier record : vider aussi sur `pagehide`.

### jeu-boucle-13-profil-recalcule-a-chaque-usage — gravité 2, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 1387-1390, 1396-1404, 1515, 1534, 1540, 1661, 1691 ; /Users/david/Projects/bitume/src/graphismes.js 113-126, 184-190, 205-256, 319-338 (coût permanent, ramasse-miettes)
- Quand : Chaque image : 2 à 5 appels par vue (jusqu'à 9 à deux), plus `stabiliser`.
- Mécanisme : `profilDe` rappelle `B.graphismes.melange` à chaque usage : normalisation de chaînes (expression régulière, `normalize('NFD')`), une vingtaine d'objets et de tableaux `Object.keys`, gel récursif. `majPalier` appelle en plus `majProfils` à chaque image et jette son résultat. Environ 110 allocations par image pour un profil qui ne change que par le menu ou le gouverneur.
- Correctif proposé : Mémoriser le profil sur une clé (qualité, `palier.n`, ancre du décor, quatre options, capacités, qualité du banc) et ne le recalculer que lorsqu'elle change. N'appeler `majProfils` que lorsque `palier.n` change, et une fois dans `installer`.

### jeu-boucle-14-classement-par-innerhtml — gravité 2, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 1970-1985 (DOM, ramasse-miettes)
- Quand : Quatre fois par seconde en course, pour chaque affichage.
- Mécanisme : `map`, `Set`, `filter`, décomposition et `sort`, puis par ligne `couleur.map().join()` et concaténation HTML. Les écarts au dixième changent presque à chaque fois : `innerHTML` détruit et recrée six `<li>` et vingt-quatre `<span>`, avec analyse HTML, style et mise en page, toutes les 250 ms.
- Correctif proposé : Créer sept lignes une fois ; mettre à jour chaque cellule par `texte()` et `classe()` ; ne reposer la couleur que si le pilote de la ligne change ; trier dans un tableau réutilisé.

### jeu-boucle-15-mise-en-page-forcee-par-les-messages — gravité 2, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1895-1906, 1917 ; lectures de taille : 1286, 1291, 1561, 1568 (DOM, mise en page forcée)
- Quand : En course, à chaque message (départ, tour, turbo, replacement) et à chaque place gagnée.
- Mécanisme : `void el.offsetWidth` force un recalcul synchrone du style et de la mise en page au milieu du pas de simulation pour relancer l'animation CSS ; le moteur relit ensuite `canvas.clientWidth` dans la même image (renderer.js 2821), d'où un second vidage.
- Correctif proposé : Relancer l'animation sans lecture de géométrie : `el.animate(...)` (Web Animations) ou alternance de deux noms d'animation identiques. Mettre en cache la taille CSS de la toile par `ResizeObserver` pour les caméras (1286, 1291) et `majGlaces` (1561, 1568).

### jeu-boucle-16-allocations-manette-et-pas — gravité 2, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 367-380, 393-394, 451-483, 581-611, 721-724, 243-252, 741 ; /Users/david/Projects/bitume/src/circuit.js 349-354 (ramasse-miettes)
- Quand : Chaque image (`lireManette`) et chaque pas de simulation (120 par seconde).
- Mécanisme : `lireManette` alloue deux tableaux, une décomposition et trois fermetures par image. `vibrationManette` est calculée et rend un tableau à chaque pas, même sans manette. `remplirPoses` crée une fermeture et douze objets `echantillon` (plus douze fermetures) par pas ; `commandesJoueur` cinq fermetures et un objet. Environ 32 allocations par pas dans la coque.
- Correctif proposé : Tester `pad.manette` et son `vibrationActuator` avant tout calcul de vibration ; réutiliser tableaux et sorties ; ajouter une variante d'`echantillon` écrivant dans un objet fourni, sans fermeture, pour `remplirPoses` ; tester les touches par boucle plutôt que par `some`.

### jeu-boucle-17-banc-et-volet-aveugles-aux-accrocs — gravité 2, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 2822, 2838, 2842-2850 ; /Users/david/Projects/bitume/src/mesures.js 17-18, 89-95, 131-154, 204-209 (mesure)
- Quand : Outils : banc de console et volet F3.
- Mécanisme : Le banc écarte la première seconde, celle des accrocs de lancement, et ne rend que p50, p95 et pire. Le volet oublie un accroc après 240 images, ne compte pas les images manquées et trie quinze tableaux de 240 valeurs à 5 Hz dans l'image qu'il mesure. Aucun journal ne relie un accroc à sa cause.
- Correctif proposé : Ajouter aux deux : période d'écran, nombre d'intervalles supérieurs à 1,5 période, p99, et un journal des 32 pires images avec leurs sections et un marqueur (palier, redimensionnement, première utilisation). Qualifier le lancement avec `chauffe: 0`. Percentiles par histogramme, sans tri.

### jeu-boucle-18-detection-bornee-a-60-hz — gravité 2, confiance 0.8
- Où : /Users/david/Projects/bitume/src/autoconfig.js : 42-48, 77-78, 81-84 ; /Users/david/Projects/bitume/src/jeu.js 2619-2633, 2709-2711 ; /Users/david/Projects/bitume/src/scene-bench.js 42-58 (détection graphique)
- Quand : Premier lancement, puis chaque ouverture tant qu'elle est passée ou interrompue (chargement, pas en course).
- Mécanisme : Le budget est borné entre 16,7 et 33,3 ms : sur écran 120 ou 144 Hz, un profil est retenu dès 56 i/s. La période mesurée (`cadence`, neuf intervalles) est enregistrée mais jamais relue par la boucle ni par le gouverneur. Le parcours ne rend ni glaces ni écran partagé. Passée ou interrompue, la détection laisse la qualité Auto et revient à chaque ouverture.
- Correctif proposé : Enregistrer par profil le temps de travail (CPU p95 + GPU p95) et en déduire profil et diviseur de cadence pour la période réelle ; ajouter une passe avec glaces ; relire `cadence` au démarrage comme première estimation de la période ; mémoriser un refus pour ne plus reproposer la détection.

## Points d’entrée utiles

- `demarrerSeance(type, conditions)` — /Users/david/Projects/bitume/src/jeu.js 2364-2374 : passage unique de Départ, Recommencer et Rejouer ; point d'insertion d'un préchargement asynchrone derrière `#chargement` (src/index.html 471, src/style.css 227-228). Autres entrées : `lancerDemo` 2083, `demoSuivante` 2089 (voile de 340 ms déjà en place), `reference` 2751.
- `lancer()` jeu.js 172-237 et `installer()` 134-163 : ordre de construction d'une séance ; cache de scène ligne 141 (circuit, enrichi, ancre, végétation, saison : une seule scène gardée) ; cache `circuits[]` 79-83 (tous générés d'un coup au premier `remplirPreparation`, 2184-2195).
- `oublierIntervalle()` jeu.js 2471-2476 : remet `tPrec`, la fenêtre Auto et `B.mesures` à zéro après une étape bloquante ; déjà branché sur `visibilitychange` et `focus` (348-354).
- `imageDetection()` jeu.js 2604-2618 : promesse résolue au prochain rAF (garde de 1,8 s) ; brique d'une boucle de chauffe asynchrone.
- `B.sceneBench.creer(rendu, capacites)` → `preparer(id, profil)`, `dessiner(t, vue)` (/Users/david/Projects/bitume/src/scene-bench.js 29-59) et la chauffe de `B.autoconfig.executer` (/Users/david/Projects/bitume/src/autoconfig.js 92-94 : 12 images ou 180 à 450 ms) : modèle de parcours de chauffe (12 voitures, pluie, faune, trois points de vue).
- Résultat de détection : `derniereDetection` / `localStorage['bitume.detection.v1']` (autoconfig.js 4, 77-78) : `cadence` (période d'écran en ms), `mesures[]` (p50, p95, cpu95, gpu95, budget par profil).
- `BITUME_JEU.banc({ duree, chauffe, qualite, circuit })` jeu.js 2821-2858 et `BITUME_JEU.reference({ mode: 'duo', meteo: 'pluie', mouille, depart: 'tunnel', vue, retro, … })` 2751-2816 : scénarios reproductibles ; `chauffe: 0` inclut le lancement dans la mesure.
- `B.mesures` (/Users/david/Projects/bitume/src/mesures.js 211-216) : `section(nom, ms)`, `vue()`, `lire()` ; `BITUME_JEU.mesures = true` ou F3 (jeu.js 299, 2868) ; la section « boucle » donne le temps de travail JS d'une image, `rendu.profile()` le GPU par passe.
- Moteur, API rendue par `FRender.create` (/Users/david/Projects/bitume/src/moteur/renderer.js 3265) : `draw`, `resize`, `calibrate(cam, objets, fx, n)` (3233-3243 : n images + `readPixels` 1×1, rend p50, p95 et `refreshMs`), `gl`, `stats.msaa/shadowMapSize/reflections/bloom` (cibles réellement vivantes), `setNappes`, `setLots` (téléversement immédiat, 2700-2741), `profile`. Tous les programmes sont liés dans `create` (2647-2649).
- Mode surface du moteur : `FRender.create(canvas, { resolution: 'native', renderScale, onBudget })`, `rendu.setRenderScale`, `rendu.setBudgetTarget` (renderer.js 2424-2427, 2810-2818) avec /Users/david/Projects/bitume/src/ferro/surface.js (taille par `ResizeObserver`, budget passif p50/p95) : module verrouillé présent, absent de `MODULES` (/Users/david/Projects/bitume/construire.py 23-67).
- /Users/david/Projects/bitume/src/ferro/loop.js : `FLoop.create({ hz: 120, maxSteps })`, `advance(t, pas)` → `{ steps, alpha, dt, period, locked, dropped }`, `observe`, `reset`, `resetPeriod`, `stats` ; période d'écran mesurée, arrondi de l'intervalle, verrou quand la période est un multiple du pas, rattrapage borné. Présent, verrouillé, non chargé.
- /Users/david/Projects/bitume/src/ferro/schedule.js (`FSchedule.create({ now })`, `add`, `pump(budget)`, `FSchedule.budget(periode, travail)`) pour étaler du travail par image, et /Users/david/Projects/bitume/src/ferro/jobs.js (`FJobs`, Worker avec repli) : présents, non chargés. Modèle maison déjà en place : `finirClassement` jeu.js 2409-2429 (tranches de 4 ms).
- `profilDe` jeu.js 1387, `appliquerPalier` 1407, `B.graphismes.melange/stabiliser`, `etatProfils`, `B.qualite.avancer(palier, 0, { actif: false })` ; lecture par `BITUME_JEU.profil`, `.palier`, `.scene`, `.ancre`.
- La vitrine derrière les menus (jeu.js 2034-2036, 2501) garde résidente la scène du circuit et de la saison choisis (2148-2149) : décor et programme principal déjà chauds au départ ; elle ne rend ni cockpit ni glaces.
- Caches d'écriture du HUD : `texte/attr/style/classe` jeu.js 1887-1890, `H.classement._html` 1984 ; pools déjà sans allocation : `lampesTunnel` 1464-1501, `sonCandidats` 1857.
- `window.FPhysX.init()` lancé en fond au démarrage (jeu.js 2717-2719) ; `FPhysX.status()` dit s'il est prêt.

## À mesurer

- Durée de `FRender.create` du second moteur et de ses `setNappes`/`setLots` (jeu.js 1546, 1552-1554) sur le Mac et sur un portable à GPU intégré.
- `BITUME_JEU.banc({ chauffe: 0 })` contre le banc par défaut : « pire » de la première seconde en cockpit avec glaces, en poursuite, à deux.
- Coût d'un `pasSimulation` (section « simulation ») : il borne le rattrapage de 12 pas après une image longue, et les 90 pas possibles en ligne.
- Écart-type de `tBrut` par navigateur (Chrome, Firefox, Safari) à 60, 120 et 144 Hz ; l'horodatage rAF y est-il arrondi à la milliseconde ?
- Coût réel de chaque bascule de palier Auto et de chaque pas du gouverneur du moteur (intervalle de l'image où `rendu.stats.msaa`, `shadowMapSize`, `reflections` ou la taille de la toile changent) ; l'image noire attendue au passage du palier 4 se voit-elle ?
- Accroc à la première pluie (création des cibles de reflets, premier usage de `ssrProgram`) : à provoquer en faisant monter `S.meteo.mouille` en cours de séance de référence.
- Section « hud » p50/p95 à 60 et 144 Hz, avec et sans carte ; part du style et de la mise en page dans un profil Performance.
- Durée de `localStorage.setItem` et de la relecture du fantôme au passage de ligne en chrono, sous Firefox et Safari.
- Fréquence et durée des ramasse-miettes mineurs en course ; part de la coque (environ 400 allocations par image) face aux pièces de voitures poussées dans `sortie`.
- Un palier Auto change `P.groundCover` et `P.faune` : le moteur reconstruit-il alors les plans de prairie, et à quel coût ?
- Safari et iOS en économie d'énergie (rAF à 30 Hz) ou écran 30 Hz : comportement réel d'Auto et du gouverneur du moteur (descente au plancher attendue d'après le code).
- `drawImage` des glaces : à dpr 1 la toile fait 330×100 px ; si le navigateur n'accélère pas une toile 2D aussi petite, la copie depuis WebGL devient une relecture synchrone (supposition, confiance basse).
- Quel profil la détection retient-elle sur un écran 120 ou 144 Hz, et neuf intervalles suffisent-ils pour `cadence` ?
- Coût de `B.faune.creer`, `B.effetsSaison.creer`, `B.aurores.creer` et `B.sillage.creer` à la première image d'une séance (non lus, hors de mes fichiers).
- Écart à la consigne : en vérifiant l'initialisation de PhysX, j'ai affiché par erreur les 1 500 premiers octets (en-tête de licence) de src/ferro/physx-runtime.js ; rien d'autre n'en a été lu. Aucun fichier créé ni modifié, aucun build, test ou navigateur lancé.
