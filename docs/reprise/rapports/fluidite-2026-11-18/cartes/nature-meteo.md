# Carte des accrocs — nature-meteo

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Rôle. Sept modules sans code WebGL : ils remplissent `sortie` d'objets JS réutilisés, dessinent deux toiles 2D par-dessus la scène et tiennent l'état météo et lumière.

Par image (src/jeu.js). image() 2477 → rendreImage 1616 : B.meteo.avancer (meteo.js:24-67 ; dt d'image plafonné à 0,1 s, intégration exacte, même évolution à 30, 60 ou 120 Hz, mais hors pas fixe) ; B.meteo.ambiance (68-74, objet réutilisé) ; B.ambiance.appliquer ou appliquerReel (ambiance.js:35-60, quantifié au 1/512 ; setEnvironment seulement si `revision` change, jeu.js:1655) ; en mode Réel, nuitReelle une fois par seconde (1647-1651). Puis rendreVue 1689, pour chaque vue : B.faune.dessiner (faune.js:303-344 ; 48 habitats proches resélectionnés tous les 6 m, 142-164), B.effetsSaison.dessiner (effets-saison.js:221-248 ; resélection tous les 3 m, 95-126 ; 128 feuilles, 480 flocons), B.aurores.dessiner (aurores.js:76-103 ; 18 objets). rendu.draw (1801) reçoit `weather` (uniformes seuls, renderer.js:2354-2368) et `reflections` = avecReflets (1420-1427). Enfin dessinerMeteo (494-515) : pluie en traits sur la toile 2D #meteo (meteo.js:88-162 ; 840 gouttes projetées, trois stroke) et gouttes ou flocons de visière sur la toile 2D #vitre (vitre.js:129-143 ; pas fixe de 30 Hz). Ce sont deux <canvas> plein écran sans filtre CSS (index.html:13-17, style.css:31-39), doublés à deux joueurs (#meteo2, #vitre2). Aucun élément DOM par goutte, aucun son météo.

Réseau. fetch uniquement dans resoudre() (conditions-course.js:150-227 ; GeoJS puis Open-Meteo, délai de 4 s, cache mémoire de 12 min), appelé depuis l'écran de préparation (jeu.js:2144, 2360). Rien en course.

Lancement. demarrerSeance (2364-2374) : voile, 30 ms, voile retiré, puis lancer() (172-237) : installer() (décor, setNappes, setLots ; scène réutilisée si inchangée, 141), B.course.creer, modèles, B.traces.creer, météo initiale (197), B.ambiance.creer et horlogePartagee (215-216). Faune, effetsSaison et aurores restent à null (217) et naissent dans la première image rendue (1714, 1722, 1735), comme B.sillage (1621), les contextes de vue, les toiles 2D du joueur 2 (497-505) et le moteur des glaces (1545-1556).

Déjà en place. Pools et tableaux typés alloués à la création ; boucles de dessin sans allocation (1 à 8 petits objets ou chaînes par image et par vue, tous en jeu.js:502 et meteo.js:154) ; formes d'aurore dans la géométrie dès FRender.create (aurores.js:46, renderer.js:1361-1368) ; visière non redessinée quand elle est propre ; cache des sols (effets-saison.js:74-86) ; herbier mémorisé par circuit (decor.js:1198-1208).

Points faibles. Habitats de la faune calculés paresseusement (jusqu'à environ 100 000 requêtes de surface, faune.js:22-97), déclenchables en pleine course par la qualité Auto ; premier usage de la pluie non chauffé (cibles de reflets du moteur, toiles 2D) ; #meteo effacée et composée à chaque image même au sec ; visière à 30 Hz sans interpolation ; aucune mesure autour de ces coûts.

## Constats

### nature-meteo-faune-creation-en-course — gravité 5, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1712-1714 ; coût : src/faune.js:22-97 et 135-141 ; déclencheur : src/graphismes.js:240 et src/qualite.js:29 ; herbier : src/decor.js:1198-1216 et 432-585 (création paresseuse, calcul en rafale)
- Quand : En course : première image où P.faune quitte « off » (qualité Auto remontant du niveau 4 au niveau 3, ou réglage changé en pause ; palier.n n'est pas remis à zéro par lancer()). Sinon : première image de chaque séance.
- Mécanisme : `if (!nature.faune) nature.faune = B.faune.creer(c, scene.decor)` s'exécute dans rendreVue. habitats() parcourt jusqu'à ~12 000 cellules (clé chaîne, Map, bruit écologique), trie, puis lance jusqu'à 1 536 × 65 decor.surfaceHerbe, chacun allouant objet, tableau et chaîne ; l'herbier (creerHerbier) est bâti à ce moment s'il ne l'était pas (Asie, Pacifique, végétation coupée). Durée estimée : dizaines à centaines de millisecondes, non mesurée.
- Correctif proposé : Créer dans lancer() dès que saison.faune > 0, sans regarder P.faune (qui ne doit régler que le budget de dessin). Garder habitats et index, immuables, sur `scene` pour les réutiliser entre vitrine, course et « Recommencer » ; ne recréer que les deux vues. Ouvrir `decor.herbier` au même endroit. Si cela reste long : tranches de 4 ms comme finirClassement (jeu.js:2414-2428).
- Risque : Mémoire : habitats gardés par scène (au plus 1 536 × 32 flottants). Garder la création déterministe (tests de verifications/).

### nature-meteo-pluie-premier-usage — gravité 4, confiance 0.55
- Où : /Users/david/Projects/bitume/src/jeu.js : 1420-1427 et 1801 ; src/moteur/renderer.js:2565-2577 et 2494-2501 ; src/meteo.js:8, 150-160, 165-173 ; src/vitre.js:98-126 (allocation GPU tardive, premier usage)
- Quand : En course, météo « variable » (choisie, ou un tirage aléatoire sur trois) : entre 38 et 39 s après le lancement, à la première pluie.
- Mécanisme : Dès que max(mouille, pluie) atteint 0,2, draw reçoit reflections:true (profil Fine ou Auto niveau 0) : le moteur crée alors deux cibles (trois textures, deux framebuffers) et appelle deux fois checkFramebufferStatus, synchrone. Dans la même seconde, #meteo trace ses premiers traits et #vitre ses premières gouttes : première surface et premiers pipelines Canvas2D du navigateur (supposition non mesurée).
- Correctif proposé : Au lancement, si `!meteo.fixe || meteo.pluie > 0`, rendre sous le voile une image avec bloom et reflections:true. Le moteur libère ces cibles après 120 rendus sans usage : ajouter à la référence FERRO un état « réservé » qui les garde sans passe de reflet. Tracer aussi un trait, une goutte et un flocon presque transparents sur chaque toile 2D.
- Risque : Mémoire GPU réservée toute la course ; changement de la référence FERRO à qualifier avant propagation. La part Canvas2D est une hypothèse.

### nature-meteo-toile-pluie-toujours-active — gravité 3, confiance 0.7
- Où : /Users/david/Projects/bitume/src/meteo.js : 91-96 puis 106-107 ; src/style.css:31 ; appel : src/jeu.js:502 et 1806 (coût permanent, toile 2D)
- Quand : À chaque image de toute séance (écran titre compris), même sans pluie, sous le tunnel ou par temps de neige.
- Mécanisme : dessiner() lit clientWidth et clientHeight, puis exécute setTransform et clearRect plein écran avant le test `pluie < .025`. La toile #meteo, toujours affichée, est donc salie et recomposée au-dessus de la scène à chaque image. Sa définition suit devicePixelRatio jusqu'à 1,5 sans plafond de pixels : 8,3 Mpx pour une fenêtre 2560 × 1440 à 1,5, quand vitre.js se limite à 2 Mpx.
- Correctif proposé : Tenir un drapeau « propre » comme vitre.js:127 et 141 : sans pluie, ne rien effacer et masquer la toile (visibility:hidden), la remontrer au premier trait. Plafonner la définition (`dpr = min(dpr, sqrt(2e6 / (w * h)))`). Recevoir largeur et hauteur d'un ResizeObserver au lieu de les relire à chaque image.
- Risque : Coût réel variable selon le navigateur (non mesuré). Préférer visibility à display:none : clientWidth y vaut 0 et la toile ne reviendrait pas.

### nature-meteo-vitre-30hz-sans-interpolation — gravité 3, confiance 0.7
- Où : /Users/david/Projects/bitume/src/vitre.js : 4, 129-143 (pas fixe), 98-128 (dessin), 66-97 (simulation) (cadence, toile 2D)
- Quand : En course sous la pluie ou la neige, pour chaque vue.
- Mécanisme : Les gouttes avancent et se redessinent au seul pas de 1/30 s, sans interpolation. À 60 Hz, une image sur deux efface toute la toile et rejoue trois tracés par goutte (56 gouttes et 18 flocons au palier Fine) ; à 120 Hz une sur quatre ; à 144 Hz l'écart oscille entre 4 et 5 images ; à 30 Hz la gigue donne 0 ou 2 pas. Mouvement saccadé.
- Correctif proposé : Garder la simulation à 30 Hz, mémoriser la position précédente et dessiner à chaque image à la fraction `accumulateur / PAS`. Pour un dessin bon marché : lutins de goutte et de flocon pré-rendus au chargement dans une toile hors écran et posés par drawImage ; traînées réunies en un seul chemin par niveau d'opacité.
- Risque : Aspect des gouttes légèrement modifié par les lutins ; à valider à l'œil.

### nature-meteo-creations-premiere-image — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 217, 1722, 1735, 1715, 1723, 1736, 497-498, 504-506 ; voile : 2364-2374 ; src/effets-saison.js:36-73 (création paresseuse)
- Quand : Première image de chaque séance (départ, « Recommencer », chaque course de démo), voile de chargement déjà retiré (2368).
- Mécanisme : nature.effetsSaison et nature.aurores partent à null et naissent dans rendreVue : masques de route et de tunnel (1 800 à 2 600 points × 9 à 25 cellules en Map et Set), sources de feuilles, 2 × 608 objets. S'y ajoutent les contextes de vue et, à deux, pluieVue2 et vitreVue2 (getContext 2D, tampons). Tout est recalculé à chaque relance alors que circuit et décor n'ont pas changé.
- Correctif proposé : Créer ces états dans lancer(), avant de retirer le voile. Séparer la partie statique (interdits, route, sources, cache des sols ; rubans d'aurore) et la garder sur `scene` ; ne refaire que les pools par vue. Créer les quatre toiles 2D et leurs contextes une fois, au démarrage de la page.
- Risque : Durée non mesurée (estimée à quelques millisecondes hors faune).

### nature-meteo-fx-tri-et-lots — gravité 2, confiance 0.55
- Où : /Users/david/Projects/bitume/src/moteur/renderer.js : 1583-1592 (module verrouillé) ; formes : src/effets-saison.js:18, src/faune.js:112 et 121, src/aurores.js:51, src/traces.js:35 (coût permanent, moteur)
- Quand : À chaque image, pour chaque vue et chaque glace, dès que neige, feuilles, insectes ou aurores sont visibles.
- Mécanisme : Le moteur trie tous les objets fx par distance (sort avec comparateur), puis ouvre un lot de dessin à chaque changement de forme dans cet ordre. Flocons et feuilles (« octa », 228 au palier Fine, 608 en « ultra »), ailes et halos (« sphere »), traces (« box ») et vitrages s'entrelacent en profondeur : des dizaines, voire des centaines de drawElementsInstanced par vue. Non mesuré.
- Correctif proposé : Sans toucher au moteur : donner aux flocons et aux feuilles la forme des traces (« box » aplatie) pour fusionner les suites ; suivre rendu.stats.drawCalls et fxInstances et baisser les budgets si besoin. À terme, dans la référence FERRO : un drapeau « sans tri » pour les particules minuscules.
- Risque : Silhouette des flocons et des feuilles légèrement changée.

### nature-meteo-particules-dans-les-glaces — gravité 2, confiance 0.75
- Où : /Users/david/Projects/bitume/src/jeu.js : 1588-1589 et 1600 (coût permanent)
- Quand : À chaque rendu de glace en vue cockpit (15 à 30 fois par seconde et par glace).
- Mécanisme : La liste des glaces reprend tout `sortie` sauf les pièces overlay. Flocons, feuilles, abeilles et lucioles (300 objets environ au palier Fine, plus de 1 000 en « ultra ») sont donc empaquetés, triés et téléversés une seconde fois pour une image de 330 × 100 px où les insectes sont sous le pixel et les flocons tiennent en quelques pixels.
- Correctif proposé : Dans la boucle de la ligne 1589, écarter `o.faune` (posé par faune.js:114) et ne garder qu'une partie des `o.effetSaison` (effets-saison.js:20), par exemple un sur trois ou seulement au palier Fine ; garder `o.aurore`, visible dans le ciel arrière.
- Risque : Moins de neige visible dans les glaces.

### nature-meteo-vitre-redimension-palier — gravité 2, confiance 0.75
- Où : /Users/david/Projects/bitume/src/vitre.js : 43-51, 5-11, 136 ; src/jeu.js:510 (allocation tardive, DOM)
- Quand : En course, quand la qualité Auto passe de Fine à Moyenne ou l'inverse (fenêtre de moins de 2 Mpx CSS sur écran à haute densité) ; lectures de taille 30 fois par seconde.
- Mécanisme : Le dpr de la toile dépend du palier (1,25 en high, 1 en medium et low). Au changement, `canvas.width = w` réalloue et efface la surface, jusqu'à 2 Mpx, en pleine course. dimensionner() est en outre appelé à chaque pas de 1/30 s, même sans pluie ni neige, avec deux lectures clientWidth et clientHeight.
- Correctif proposé : Fixer le dpr de la vitre une fois par séance (ou au redimensionnement de la fenêtre) et ne faire dépendre du palier que le nombre de gouttes. Sortir de mettreAJour avant dimensionner quand pluie et neige sont nulles et qu'aucune goutte ne vit. Passer largeur et hauteur dans le contexte (déjà acceptées, lignes 44-45).

### nature-meteo-ecran-partage-dt — gravité 2, confiance 0.7
- Où : /Users/david/Projects/bitume/src/jeu.js : 1667-1669 ; src/meteo.js:98-104 ; src/vitre.js:134 (cadence)
- Quand : En course à deux, aux paliers Légère et Moyenne, où la vue du joueur 2 n'est rendue qu'une image sur deux.
- Mécanisme : La vue du joueur 2 saute une image sur deux mais reçoit le dtImage d'une seule. La pluie calcule `vx = dx / dt` sur un déplacement de deux images : vitesse relative doublée, et au-delà de 75 m/s réels le garde-fou `distance / dt > 150` l'annule (bascule visible vers 270 km/h). La visière du joueur 2 avance à demi-vitesse, à 15 pas par seconde.
- Correctif proposé : Cumuler le temps des images sautées dans l'état de la vue 2 (`S.vueJ2.dtAttente += dtImage`), passer ce cumul à rendreVue pour cette vue, puis le remettre à zéro.
- Risque : Les caméras lissées de la vue 2 reçoivent le même dt : vérifier leur comportement avec le cumul.

### nature-meteo-neige-replanification — gravité 2, confiance 0.6
- Où : /Users/david/Projects/bitume/src/effets-saison.js : 242-244, 95-126, 132-164, 201 (calcul irrégulier)
- Quand : En course en automne (forêt, Asie) ou sous la neige : toutes les 2 à 5 images à grande vitesse.
- Mécanisme : Tout déplacement de plus de 3 m relance selectionner (25 cellules, jusqu'à 100 insertions triées, plan de 480 clés), puis planifier avec change = true pour les deux pools : 2 048 propriétaires remis à −1, sondages hachés des 480 slots, tri par classes. Coût en pointe, simultané pour les deux vues ; quelques dizaines de microsecondes, estimation non mesurée.
- Correctif proposé : Porter le seuil à 6 m (cellules de 12 m, fondu sur 10 m) ou ne resélectionner qu'au changement de cellule ; décaler la vue 2 d'une image. Remplacer Math.hypot à trois arguments (ligne 201, un appel par flocon et par image) par une racine de somme de carrés.

### nature-meteo-faune-affectation — gravité 2, confiance 0.7
- Où : /Users/david/Projects/bitume/src/faune.js : 332-339, 142-164, 182-221 (calcul irrégulier, coût permanent)
- Quand : En course, tous les 6 m parcourus (environ 13 fois par seconde à 290 km/h), par vue.
- Mécanisme : Chaque resélection enchaîne trois affecter(change) : `proprietaires.fill(-1)` sur 8 entrées par habitat (jusqu'à 12 288) et par espèce, puis, pour chaque identité nouvelle, balayage complet des slots (256 × 256 au pire pour les lucioles en « ultra », après une coupe de caméra). Ce travail a lieu même quand les trois budgets sont nuls : nuit hors montagne, forte pluie.
- Correctif proposé : Calculer `jour` et `nuitActive` avant la sélection et sortir quand ils valent 0 et que les trois `limite` sont nulles. Remplacer le balayage par identité par le tri en 32 classes de effets-saison.js:148-163. N'effacer que les clés réellement posées (relues dans les slots) au lieu d'un fill complet.

### nature-meteo-mesure-absente — gravité 2, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 1800-1807 ; banc : 2822 et 2838 (mesure)
- Quand : Outillage : toute mesure de fluidité en course.
- Mécanisme : La section « rendu » se ferme ligne 1803, avant dessinerMeteo (1806) : le temps des toiles de pluie et de visière n'apparaît dans aucune section de B.mesures, pas plus que celui de la faune, des feuilles et de la neige (1712-1741). Le banc écarte la première seconde et dure 20 s : il ne voit ni les créations de la première image ni l'arrivée de la pluie vers 38 s.
- Correctif proposé : Entourer les lignes 1712-1741 d'une section « nature » et la ligne 1806 d'une section « meteo » (B.mesures.section). Donner au banc une option qui garde la première seconde et rend la plus longue image avec son instant. Essai type : météo « variable », 60 s.

### nature-meteo-profil-recalcule — gravité 2, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : 1387-1390 ; appels : 1661, 1691, 1515 (via 1534 et 1761), 1540 ; src/graphismes.js:205-256 et 39-42 (ramasse-miettes)
- Quand : À chaque image : deux fois par vue en poursuite, environ cinq fois en cockpit avec glaces.
- Mécanisme : Hors fichiers confiés, mais P.faune et P.palier en viennent. profilDe() rappelle B.graphismes.melange à chaque usage : Object.assign, Object.keys, sept objets imbriqués puis gel récursif (figer), soit une vingtaine d'allocations par appel, donc 40 à 100 par image et par vue — dix fois plus que tout le sous-système nature-météo.
- Correctif proposé : Mémoriser le profil résolu tant que qualité, palier.n, etatProfils.decor, capacitesRendu et réglages graphiques ne changent pas (compteur de révision incrémenté par sauverReglages et majPalier). À recouper avec l'agent chargé de jeu.js et graphismes.js.
- Risque : Constat probablement en double avec un autre sous-système.

### nature-meteo-allocations-par-image — gravité 1, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js : 502 ; src/meteo.js:154 (ramasse-miettes)
- Quand : À chaque image, par vue.
- Mécanisme : `Object.assign(METEO_ABRI, { t })` crée un objet jetable sous le tunnel ou par temps de neige ; le littéral `{ cockpit, dpr }` en crée un à chaque appel ; sous la pluie, trois chaînes `'rgba(190,210,225,' + alpha + ')'` par image, réanalysées par le navigateur puisque alpha varie. Total : 1 à 8 allocations par image et par vue ; les boucles des sept modules n'allouent rien d'autre.
- Correctif proposé : `METEO_ABRI.t = S.meteo.t` ; un objet d'options réutilisé par vue ; strokeStyle constant posé une fois et `ctx.globalAlpha = alpha` pour chaque lot.

### nature-meteo-horloge-reelle — gravité 1, confiance 0.6
- Où : /Users/david/Projects/bitume/src/conditions-course.js : 89-110, 35-46, 77-88 ; appel : src/jeu.js:1647-1651 (création paresseuse, ramasse-miettes)
- Quand : En course, moment « Réel » : une fois par seconde ; premier appel dans la première image chez un invité en ligne.
- Mécanisme : nuitReelle crée une Date et un objet (jourProche) par appel. Avec une horloge « locale », le premier appel construit `new Intl.DateTimeFormat('en-GB', …)`, lent à froid, puis formatToParts une fois par minute. L'hôte l'a fait dans resoudre() ; l'invité, qui ne résout rien, le paie à la première image. Aucun appel réseau en course : fetch reste dans resoudre(), écran de préparation.
- Correctif proposé : Appeler une fois `B.conditionsCourse.nuitReelle(Date.now(), nature.horlogeReelle)` dans lancer() pour remplir le cache `formats`. Accepter un nombre de millisecondes sans créer de Date ; faire écrire jourProche dans un objet réutilisé.
- Risque : Durée de la construction Intl non mesurée.

### nature-meteo-cycle-environnement — gravité 1, confiance 0.8
- Où : /Users/david/Projects/bitume/src/ambiance.js : 45-59 ; src/jeu.js:1655-1657 et 1596-1598 ; src/moteur/renderer.js:1490-1497 et 3265 (ramasse-miettes)
- Quand : En course, moment « cycle » : environ 11 fois par seconde pendant les deux transitions de 48 s de chaque cycle de 360 s.
- Mécanisme : Chaque pas de 1/512 incrémente `revision` ; le jeu rappelle alors rendu.setEnvironment, puis celui des glaces. environmentInfo recopie l'atmosphère (`{...value}`), crée six tableaux et des fermetures : une vingtaine d'allocations par appel. Le moteur WebGL2 se contente d'une affectation (ligne 3265), sans cache GPU invalidé. Coût faible et borné.
- Correctif proposé : Rien d'urgent. Si le mode cycle montre des pauses du ramasse-miettes : quantifier à 1/256, ou ajouter à la référence FERRO une mise à jour en place des cinq couleurs et de `night`.

## Points d’entrée utiles

- B.faune.creer(c, decor) (src/faune.js:135-141) : ne dépend que du circuit et du décor ; `habitats` et `index` sont immuables et peuvent être gardés sur `scene` (src/jeu.js:161), seules `vues` sont propres à la séance.
- decor.herbier (accesseur, src/decor.js:1215) ouvre l'herbier ; cache HERBIERS par circuit, qualité et saison (src/decor.js:675 et 1198-1208) : à ouvrir pendant installer() plutôt qu'au premier surfaceHerbe.
- B.effetsSaison.creer(c, decor) (src/effets-saison.js:36-73), B.aurores.creer(c) (src/aurores.js:57-75), B.ambiance.creer(base, montagne) (src/ambiance.js:26-33) : appelables dans lancer() (src/jeu.js:172-237), avant aller('course').
- B.meteo.creerPluie(canvas) (src/meteo.js:77) et B.vitre.creer(canvas) (src/vitre.js:20) : à appeler une fois au démarrage pour #meteo, #meteo2, #vitre et #vitre2 ; B.vitre.mettreAJour accepte largeur, hauteur et dpr dans son contexte (src/vitre.js:44-46), ce qui évite les lectures de mise en page.
- Prévoir la pluie dès le lancement : meteoInit (src/jeu.js:197) porte `fixe`, `phase`, `pluie`, `mouille`, `neige` ; en « variable », première pluie à 38 s (DUREES, src/meteo.js:8) ; seuils des reflets REFLET_PRISE 0,2 et REFLET_LACHE 0,12 (src/jeu.js:1419).
- demarrerSeance() et son voile #chargement (src/jeu.js:2364-2374), demoSuivante() (2089-2096) : points d'entrée d'un préchargement ; installer() mémorise déjà la scène (141, 161).
- rendu.draw(cam, sortie, options) peut rendre une image de chauffe (bloom et reflections à true, nombre maximal d'objets fx à alpha faible pour dimensionner les tampons d'instances) ; attention, ensureOptionalTargets libère les cibles après 120 rendus sans usage (src/moteur/renderer.js:2554-2577).
- Étalement existant : finirClassement() découpe en tranches de 4 ms par setTimeout(0) (src/jeu.js:2409-2429), modèle réutilisable pour habitats().
- Mesure : B.mesures.section(nom, ms) (src/mesures.js:56) ; BITUME_JEU.banc({ duree, qualite, circuit, meteo, moment, saison, faune, vegetation }) et BITUME_JEU.reference() (src/jeu.js:2751-2858) ; rendu.stats (drawCalls, fxInstances, uploadBytes).
- Compteurs déjà tenus par les modules : stats de la faune (requetes, objets, habitats), des effets de saison (requetes, objets), de la pluie (candidats, visibles, traits, lots) et de la vitre (dessins, etapes, pixels).
- Étiquettes posées sur les objets : `faune`, `effetSaison`, `aurore` (src/faune.js:114, src/effets-saison.js:20, src/aurores.js:53) : filtrage possible pour les glaces ou pour un budget.
- B.conditionsCourse.nuitReelle(ms, horloge) : un appel dans lancer() chauffe le cache Intl ; resoudre() garde un cache mémoire de 12 min et n'est appelé que depuis l'écran de préparation.
- Budgets nommés par module (B.faune.BUDGETS, B.effetsSaison.BUDGETS, B.vitre.BUDGETS, B.aurores.BUDGETS) : bornes maximales connues à l'avance pour dimensionner un préchauffage.

## À mesurer

- Durée réelle de B.faune.creer sur les sept circuits et à chaque palier, avec et sans herbier déjà ouvert (Asie, Pacifique, végétation coupée) ; nombre d'appels à surfaceHerbe et durée de creerHerbier, y compris sur petite configuration.
- Sur une petite configuration en Auto, le gouverneur atteint-il le niveau 4 puis remonte-t-il en course ? Journal des changements de palier.n avec l'instant et la durée de l'image suivante.
- Coût par image des toiles #meteo et #vitre sous la pluie (fil principal et processus GPU), en 1080p et en 4K, sous Chrome, Firefox et Safari ; gain obtenu en les masquant par temps sec.
- Pic de durée d'image à l'arrivée de la pluie en météo « variable » (38 à 39 s) : part de l'allocation des cibles de reflets, part du premier tracé Canvas2D (hypothèse à confirmer par une trace de performance).
- Nombre de lots de dessin et temps de tri des objets fx sous la neige avec traces de pneus (rendu.stats.drawCalls, fxInstances), vue principale et glaces, aux budgets Fine et « ultra ».
- Saccade perçue des gouttes de visière à 60, 120 et 144 Hz, et durée d'un redessin de la visière (56 gouttes) sur petite configuration.
- Le moteur plafonne-t-il bien sa résolution en « auto » à 1,8 Mpx dans la voie WebGL2 (commentaire src/graphismes.js:35, vu seulement dans src/ferro/webgpu-renderer.js:114) ? La toile de pluie dépasserait alors la scène en nombre de pixels.
- Un changement de taille de la toile WebGL par le gouverneur du moteur invalide-t-il la mise en page avant les lectures clientWidth de src/meteo.js:91 ? Non vérifié.
- Durée de la première image d'une séance, création par création (faune, effets de saison, sillage, moteur des glaces) : le banc actuel l'écarte avec sa seconde de chauffe.
