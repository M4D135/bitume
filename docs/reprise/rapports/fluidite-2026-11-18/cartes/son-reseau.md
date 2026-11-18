# Carte des accrocs — son-reseau

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Dépôt /Users/david/Projects/bitume ; lignes relevées par lecture, sans exécution.

SON (src/son.js). Aucun AudioContext avant demarrer() (178-184), appelé par activerSon() (jeu.js:685-689) au premier clic ou à la première touche (jeu.js:303, 355). init() (148-176) bâtit alors tout le graphe permanent, 65 nœuds : limiteur et bus, 2 s de bruit (155-158), moteur du joueur moteur() (109-136, 30 nœuds, onde périodique en cache 94-101, WaveShaper 2x), trois voix de rivaux voixRival() (139-146), pneus, vibreur, herbe. Par image : majSon (jeu.js:1830-1867, tampons réutilisés, aucune allocation JS) → mettreAJour (215-253) → reglerMoteur (194-210) : 29 setTargetAtTime en solo, 42 à deux. Sons ponctuels : evenement() (317-342) crée des nœuds à chaque fois (265-315) et les débranche par onended (261-264). Musique : écran titre seulement, setInterval(tic, 25) (388-407).

RÉSEAU (src/reseau.js). creer() (71-258) : WebSocket vers le salon, maillage WebRTC (canal « etat » sans reprise, canal « fiable » JSON), repli par le salon. Par image en ligne : envoyerEtats (jeu.js:1203-1209) → emballer (27-37) → envoyerEtat (235-245). Réception : deballer (38-49) → EL.recus (jeu.js:1110). À chaque pas et par voiture distante : appliquerDistant (jeu.js:1213-1229) → prolonger (53-65). Horloge commune R.horloge() = performance.now() + décalage (81-82, 212-219) ; la boucle en ligne (jeu.js:2503-2510) rattrape jusqu'à 90 pas par image. Rien de tout cela ne tourne en solo.

RÉALISATEUR (src/realisateur.js). tenir() (114-166) à chaque image de démo (jeu.js:1680) ; suivant() et couper() (50-54, 73-100) à chaque coupe, toutes les 3 à 8 s ; signaler() (103-112) à chaque pas ; vitesse() (169-172) pour le ralenti. Coût propre négligeable : le prix d'une coupe est dans jeu.js (remise à zéro 1682, puis majGlaces 1529-1605 si le plan est « cockpit »).

MENUS (src/navigation-menu.js). naviguer() (179-213) par image et par manette hors course (jeu.js:421, 551) ; sans appui, retour avant toute lecture du DOM (186).

ORDRE AU LANCEMENT D'UNE COURSE. demarrerSeance (jeu.js:2364-2374) : voile affiché, 30 ms, voile retiré (2368), puis lancer() (172-237) : installer() (134-163 ; en cache si la vitrine de la préparation montrait déjà ce circuit, 141 ; sinon B.decor.construire, setWorld, setNappes, setLots, plan 2D), B.course.creer, fantôme, météo, pneus, modèles des voitures, réalisateur (démo), B.traces.creer, ambiance, liaison (en ligne), vue du joueur 2, poses ; enfin aller('course'). Tout le reste naît à la première image visible : toiles de pluie et de vitre (jeu.js:497-505), faune, effets de saison, aurores (1714, 1722, 1735), second moteur de rendu des rétroviseurs et son décor (1545-1556), second moteur audio (son.js:221). Aucune image de chauffe ; aucun préchargement audio propre à la course (le graphe date du premier geste).

CE QUI EXISTE. Graphe audio permanent et tampons réutilisés ; coupures sans minuterie ; reprise de la musique sans rafale (son.js:391) ; EL.pred et EL.vieux réutilisés ; 4 s entre l'annonce et T0 en ligne (jeu.js:1197) ; voile #chargement ; finirClassement par tranches de 4 ms (jeu.js:2409-2429) ; chauffe d'une seconde du banc (2821-2858).

## Constats

### son-reseau-01-glaces-creees-a-la-coupe — gravité 5, confiance 0.9
- Où : /Users/david/Projects/bitume/src/jeu.js (déclencheur : /Users/david/Projects/bitume/src/realisateur.js) : jeu.js:1545-1556 (création du moteur et du décor des glaces), 1529-1536, 1512-1516, 1680-1685 et 1807 (coupe de la démo), 678-681, 316 et 412 (touche Vue) ; realisateur.js:97-99 ; moteur/renderer.js:2473-2483, 2731-2741 ; graphismes.js:145-151 (compilation de shaders et téléversement de tampons en cours de séance)
- Quand : En course et en démo : première image en vue cockpit sur une scène — coupe du réalisateur vers « cockpit », touche Vue en course, glaces rouvertes par la qualité Auto (niveau 1 vers 0), première image d'une course lancée en cockpit (vue par défaut).
- Mécanisme : majGlaces crée le second moteur FERRO à la première image en vue cockpit (FRender.create : compilation et édition de liens synchrones, LINK_STATUS lu), puis, à chaque nouvelle scène, ré-empaquette et téléverse tout le décor (setNappes, setLots : pack et bufferData de chaque lot). En démo, la première coupe du réalisateur vers « cockpit » de chaque course paie ce coût dans l'image de la coupe.
- Correctif proposé : Sortir de l'image la création de retro.rendu et le bloc « retro.scene !== scene » : les exécuter dans lancer(), sous le voile, dès que retroVoulu peut devenir vrai dans la séance (démo : toujours ; course : réglage, profil et capacités), puis dessiner une image par glace avant de lever le voile. majGlaces ne garde qu'un test. Aucune retouche du moteur verrouillé.
- Risque : Mémoire GPU et temps de lancement en hausse même si la vue cockpit ne sert pas ; à borner par les capacités (rien à créer sur un GPU modeste où les glaces restent fermées).

### son-reseau-02-voile-leve-avant-construction — gravité 4, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js ; /Users/david/Projects/bitume/src/style.css : jeu.js:2364-2374 (demarrerSeance), 1115-1124 (lancerEnLigne), 2089-2096 (demoSuivante), 2079 (démo lancée depuis l'image) ; style.css:227-228 (préchargement absent au lancement)
- Quand : Au lancement de chaque course, course en ligne et course de démo : les premières images visibles.
- Mécanisme : Le voile reçoit « fini » avant lancer() (2368 puis 2370) et, en démo, dans la tâche même de lancerDemo (2093-2094) : il s'efface en 0,3 s sur les premières images. Décor déjà en cache par la vitrine, il a à peine commencé à apparaître (30 ms sur 0,3 s). Tout ce qui se crée à la première image (glaces, pluie, vitre, faune, saison, aurores, second moteur audio) reste donc visible.
- Correctif proposé : Faire du voile une étape réelle : voile opaque, lancer(), puis quelques images de chauffe rendues dessous (chaque vue de la séance, options du profil, glaces, météo), préparation audio, oublierIntervalle(), et seulement alors « fini ». Même séquence dans lancerEnLigne (quatre secondes avant T0) et demoSuivante (les dix vues de B.realisateur.VUES, par BITUME_JEU.camera ou un plan forcé).
- Risque : Lancement allongé de quelques centaines de millisecondes ; en ligne, la chauffe doit tenir dans les 4 s avant T0. L'opacité exacte du voile n'a pas été observée, seulement déduite du code.

### son-reseau-03-noeuds-par-evenement — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/son.js : son.js:261-264 (ponctuelle), 265-315 (detonation, ton, clameur, clic, choc, souffle), 317-342 (evenement) ; appelants jeu.js:756-771, 798-817, 2025 ; sources conduite.js:253-255, 373 ; degats.js:38-51 (nœuds audio créés en course, rappels sur le fil principal)
- Quand : En course : rapport, rupteur (grille et zone rouge), choc, contact, casse, turbo, niveau de dérive, tour.
- Mécanisme : Chaque son ponctuel crée ses nœuds (détonation 3, ton 2, choc 5), une fermeture onended et deux tableaux, puis les débranche par un rappel sur le fil principal. Rupteur : environ 10 par seconde, gaz tenu sur la grille comme au rupteur. Casse : quatre « roue », « casse » et le contact dans le même pas, soit 41 nœuds et autant de connexions dans l'image du choc.
- Correctif proposé : Bâtir dans init() un pool fixe, toujours branché : six voix de bruit (source en boucle, filtre, gain nul) et six voix de ton (oscillateur, gain nul). evenement() ne programme plus que type, fréquence et enveloppes sur une voix libre, en tourniquet. Dédupliquer par type et par image (quatre « roue » : un seul choc). Le faux contexte de son.test.mjs peut exiger zéro nœud par événement.
- Risque : Timbre un peu différent (bruit en boucle au lieu d'un départ à zéro) ; vol de voix à régler à l'oreille ; son.test.mjs à adapter. Le coût en millisecondes est estimé, pas mesuré.

### son-reseau-04-horloge-en-ligne — gravité 3, confiance 0.7
- Où : /Users/david/Projects/bitume/src/reseau.js ; /Users/david/Projects/bitume/src/jeu.js : reseau.js:81-82 (horloge), 202-207 (ping), 212-219 (décalage) ; jeu.js:2505-2509 (cadence)
- Quand : Course en ligne : à chaque image ; saut possible à chaque pong chez l'invité.
- Mécanisme : La simulation en ligne vise R.horloge(), lu par performance.now() à l'instant où le rappel s'exécute, pas l'horodatage de requestAnimationFrame : nombre de pas et interpolation suivent la gigue du rappel. Chez l'invité, chaque pong (un par seconde) remplace d'un coup « decalage » par celui du meilleur des seize derniers échantillons : toute la scène, voiture du joueur comprise, saute de l'écart (quelques millisecondes de simulation).
- Correctif proposé : Dans image(t), calculer cible = (t + décalage − T0) / 1000 avec le t de requestAnimationFrame (même origine que performance.now). Dans reseau.js, asservir le décalage : les pongs fixent une cible, la valeur appliquée la rejoint à 0,5 ms par seconde au plus, saut direct seulement au-delà de 20 ms. Exposer R.horloge(t).
- Risque : Chaque machine corrige son propre décalage, sans changement de protocole ; vérifier que T0 reste commun (prets-enligne, salon-protocole). Ampleur de la gigue non mesurée.

### son-reseau-05-debit-des-etats — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/reseau.js ; /Users/david/Projects/bitume/src/jeu.js ; /Users/david/Projects/bitume/serveur/salon.mjs : reseau.js:235-245 ; jeu.js:1203-1209, 2508 ; salon.mjs:23, 80-83, 86-90 (réseau lié à la fréquence de l'écran)
- Quand : Course en ligne ; pire à 120 et 144 Hz, par le relais du salon ou sur une liaison montante faible.
- Mécanisme : Un paquet d'état part à chaque image (rivaux une image sur deux) : le débit suit l'écran. Par le relais, un message WebSocket par pair et par image : à 120 Hz avec trois pairs relayés, 360 par seconde contre 240 admis par le salon, qui jette le surplus en silence, messages fiables relayés compris. Le garde bufferedAmount < 64 Ko laisse s'empiler des états périmés.
- Correctif proposé : Cadencer sur les pas de simulation, pas sur l'image : humains tous les deux pas (60 Hz), rivaux tous les quatre à six pas. Par le relais, un seul message adressé à 255 quand plusieurs pairs sont relayés. N'émettre que si bufferedAmount est inférieur à deux paquets : l'état le plus récent remplace celui qui attend.
- Risque : Rivaux à 20–30 Hz : vérifier la résorption en 0,12 s ; l'adresse 255 atteint aussi les pairs en liaison directe (doublon sans effet, le plus récent gagne).

### son-reseau-06-parametres-par-image — gravité 2, confiance 0.85
- Où : /Users/david/Projects/bitume/src/son.js : son.js:194-210 (13 écritures), 243-246 (4 par rival), 249-252 (4) ; appel jeu.js:1866, 2540 (coût permanent par image)
- Quand : À chaque image de course, de démo et de vitrine.
- Mécanisme : mettreAJour programme sans condition 29 setTargetAtTime par image en solo (13 pour le moteur, 12 pour trois rivaux, 4 pour pneus, vibreur et herbe) et 42 à deux : 1 740 événements d'automation par seconde à 60 Hz, 4 176 à 144 Hz. Huit à dix cibles ne changent presque jamais : échappement, admission, écho, panoramique, pneus, vibreur, herbe.
- Correctif proposé : Mémoriser la dernière cible de chaque paramètre et ne reprogrammer que si elle change (seuil relatif de 0,2 % pour gains et filtres, aucun seuil pour la fréquence des oscillateurs). Plafonner la mise à jour audio à 60 Hz par un accumulateur de dtImage. Attendu : 10 à 14 écritures par image, indépendantes de la fréquence de l'écran.
- Risque : Seuil trop large : paliers audibles sur les filtres. Le coût sur le fil principal est faible ; le gain est surtout la régularité entre 30 et 144 Hz.

### son-reseau-07-son-lie-a-la-cadence — gravité 2, confiance 0.75
- Où : /Users/david/Projects/bitume/src/son.js ; /Users/david/Projects/bitume/src/jeu.js : son.js:195, 209, 215-217, 256-260 ; jeu.js:1844, 1851, 1866 (cadence (30, 60, 120 Hz))
- Quand : À chaque image ; audible à 30 images par seconde et après une image longue.
- Mécanisme : mettreAJour ignore le dtImage que jeu.js lui passe : constante fixe de 15 ms, donc régime en marches d'escalier à 30 images par seconde. Le moteur coupé par un rapport ne revient qu'à la première image après coupFin : 42 ms à 120 Hz, 50 à 60, 67 à 30, et toute la durée d'une image longue. Le Doppler des rivaux est lissé de 0,2 par image.
- Correctif proposé : Programmer le retour du moteur dans coupureMoteur, en temps audio : setTargetAtTime(dernier volume, t + 0,04, 0,015), sans attendre l'image. Constante de temps égale à clamp(0,6 × dtImage, 0,015, 0,04). Doppler lissé par 1 − exp(−dt / 0,08), mise à jour sautée quand dtImage est plafonné.
- Risque : Réglage d'oreille ; son.test.mjs vérifie les coupures sans minuterie et certaines constantes.

### son-reseau-08-second-moteur-paresseux — gravité 2, confiance 0.9
- Où : /Users/david/Projects/bitume/src/son.js : son.js:219-221 (création), 109-136, 54-58 ; jeu.js:1864, 227 ; verifications/son.test.mjs:123-124 (création paresseuse dans une image)
- Quand : Première image de la première course à deux (grille).
- Mécanisme : « if (j2 && !m2) m2 = moteur() » s'exécute dans mettreAJour, donc dans une image : 30 nœuds audio, environ 35 connexions, une courbe tanh de 2 048 points recalculée et un WaveShaper suréchantillonné, à la première image où la caméra du joueur 2 existe. Le test son.test.mjs (lignes 123-124) entérine ce comportement.
- Correctif proposé : Ajouter son.preparer({ joueurs }) et l'appeler depuis lancer() quand duo est vrai, sous le voile (et au premier geste si le son n'était pas encore démarré), ou créer m2 dans init() à gain nul. Partager la courbe tanh entre les deux moteurs. mettreAJour ne garde que les réglages ; adapter l'assertion du test.
- Risque : Aucun pour le son ; 30 nœuds de plus sur le fil audio dès le lancement à deux.

### son-reseau-09-fil-audio — gravité 2, confiance 0.5
- Où : /Users/david/Projects/bitume/src/son.js : son.js:119 (WaveShaper 2x), 122 et 142 (passe-bas, panoramiques), 182 (création du contexte), 199-206, 222, 243-246 (coût permanent sur le fil audio)
- Quand : En permanence dès le premier geste, course ou menus.
- Mécanisme : Fréquences des passe-bas et panoramiques sont automatisés au rythme audio : coefficients et gains recalculés à chaque échantillon (au moins sous Chrome). Le WaveShaper est en « 2x ». Les graphes muets restent calculés : m2 (30 nœuds) après une course à deux, moteur du joueur en vue extérieure, voix de rivaux libres. Sur petite machine, le fil audio peut manquer de temps : craquements. Non mesuré.
- Correctif proposé : Passer en « k-rate » pb.frequency, echap.gain, adm.gain, pan.pan et les paramètres des voix de rivaux (sous try/catch). Débrancher m2.pan de busMot hors course à deux, le rebrancher à la suivante. oversample « none » quand gpuModeste. Mesurer avant et après avec AudioContext.renderCapacity, affiché par B.mesures.audio.
- Risque : Supposition non mesurée ; « k-rate » absent des vieux Safari ; repliement possible sans suréchantillonnage.

### son-reseau-10-contexte-suspendu-ou-en-echec — gravité 2, confiance 0.5
- Où : /Users/david/Projects/bitume/src/son.js ; /Users/david/Projects/bitume/src/jeu.js : son.js:178-184, 216, 318 ; jeu.js:303, 355, 424, 553 (appels répétés par image, fuite de nœuds)
- Quand : En course à la manette tant que le contexte audio n'est pas « running » (activation refusée par le navigateur, API absente).
- Mécanisme : activerSon() est rappelé à chaque image où la manette agit. Contexte encore « suspended » (activation refusée) : demarrer() relance ctx.resume() à chaque image. init() en échec (API absente) : le contexte n'est pas fermé et tout est retenté à chaque appel, bruit de 96 000 échantillons compris. evenement() ne teste que « pret » : contexte suspendu, les sources ponctuelles ne finissent jamais et s'accumulent.
- Correctif proposé : Dans demarrer() : garder la promesse de reprise en cours au lieu de rappeler resume() ; en cas d'échec, fermer le contexte et ne plus réessayer avant une seconde. Dans evenement() et mettreAJour() : sortir si ctx.state n'est pas « running ». Dans jeu.js : appeler activerSon() sur un front de bouton, pas à chaque image.
- Risque : Le code est lu ; les règles d'activation de chaque navigateur (manette, toucher) ne sont pas vérifiées ici.

### son-reseau-11-prolongation-reintegree — gravité 2, confiance 0.7
- Où : /Users/david/Projects/bitume/src/reseau.js ; /Users/david/Projects/bitume/src/jeu.js ; /Users/david/Projects/bitume/src/circuit.js : reseau.js:53-65 ; jeu.js:1213-1229, 2507 ; circuit.js:349-354 ; course.js:97, 585 (calcul en rafale, ramasse-miettes)
- Quand : Course en ligne : à chaque pas de simulation et par voiture distante (jusqu'à 11 chez un invité).
- Mécanisme : appliquerDistant ré-intègre à chaque pas depuis le dernier état reçu : autant de sous-pas de 1/120 s que l'âge de l'état, jusqu'à 42 (plafond 0,35 s), chacun appelant B.circuit.echantillon, qui alloue un objet de neuf champs et une fermeture. Liaison en retard ou rattrapage de 90 pas par image : jusqu'à 90 × 11 × 42, soit environ 41 000 appels dans une image.
- Correctif proposé : Garder par voiture distante un état prédit, avancé d'un seul sous-pas par pas de simulation ; ne ré-intégrer depuis l'état reçu qu'à l'arrivée d'un paquet. Lire la courbure par un accesseur scalaire sur c.courbure, sans objet. Remplacer le plafond de 90 pas par un budget en millisecondes par image.
- Risque : La prédiction incrémentale doit donner le même résultat que la ré-intégration ; l'élision des allocations par le compilateur n'a pas été mesurée.

### son-reseau-12-allocations-reseau — gravité 2, confiance 0.75
- Où : /Users/david/Projects/bitume/src/reseau.js ; /Users/david/Projects/bitume/src/jeu.js : reseau.js:27-37, 38-49, 76, 95, 224, 241 ; jeu.js:1110, 1206, 1228 (ramasse-miettes)
- Quand : Course en ligne : par image émise, par paquet reçu et par pas.
- Mécanisme : Émission, par image : ArrayBuffer et DataView neufs, tableau de S.locaux.map, copie Uint8Array par le relais. Réception, par voiture : un objet à seize propriétés ajoutées une à une et quinze nombres en tas, plus { t, etat }. Par pas et par voiture distante : un tableau littéral de douze clés. Estimation pour un invité à 60 Hz : de l'ordre de 10 000 allocations par seconde.
- Correctif proposé : Décoder en place dans un Float32Array(15) par voiture, préalloué dans lancer() (EL.recus rempli d'avance, instant t mis à jour) ; lire les champs par indice. Un seul tampon d'émission de taille maximale, dont on envoie la vue utile. Liste d'envoi et tableau de clés hissés hors des fonctions. Garder emballer et deballer purs pour les tests.
- Risque : Le nombre d'allocations est une estimation de lecture ; emballer et deballer sont testés : garder leur forme publique.

### son-reseau-13-webrtc-en-course — gravité 2, confiance 0.45
- Où : /Users/david/Projects/bitume/src/reseau.js ; /Users/david/Projects/bitume/serveur/salon.mjs : reseau.js:98-101, 115-136, 137-147, 178-185, 193-200 ; salon.mjs:104-111 (appels synchrones en course)
- Quand : Course en ligne : arrivée d'une machine dans le salon, liaison directe perdue.
- Mécanisme : Le salon accepte une arrivée à tout moment : le message « salle » fait créer aussitôt, sur les machines plus anciennes, un RTCPeerConnection, deux canaux et une offre, même en pleine course. Une liaison directe perdue appelle pc.close(), synchrone, dans passerRelais et fermerPair. Coût par navigateur non mesuré ; des dizaines de millisecondes sont plausibles.
- Correctif proposé : Pendant une course (drapeau posé par jeu.js dans lancer(), levé aux résultats), mettre en file lier() et pc.close(), exécutés ensuite ; le passage par le relais reste immédiat, il ne crée rien. Côté salon, différer « rejoindre » tant que l'hôte a annoncé un départ.
- Risque : Supposition sur le coût, non mesurée ; un pilote arrivé en retard attend la fin de la course pour être lié.

### son-reseau-14-realisateur-allocations — gravité 1, confiance 0.9
- Où : /Users/david/Projects/bitume/src/realisateur.js ; /Users/david/Projects/bitume/src/jeu.js : realisateur.js:52, 75-99, 134, 146, 155-156, 161 ; jeu.js:1680-1682, 1915 (ramasse-miettes)
- Quand : Démo : une allocation par image, une quarantaine par coupe.
- Mécanisme : tenir() recopie le classement par ordre.slice() à chaque image hors sprint. Une coupe (suivant, couper) enchaîne map, filter, slice, fermetures et Object.assign : une quarantaine de petits objets toutes les 3 à 8 s. majHud recompose le libellé du plan à chaque image. Coût propre négligeable : le prix d'une coupe est celui des glaces (premier constat).
- Correctif proposé : Recopier le classement dans un tableau gardé (R.ordre[i] = ordre[i]). Composer le libellé du plan une seule fois, dans le bloc de coupe de jeu.js:1682. Laisser suivant() tel quel : une coupe est rare et realisateur.test.mjs fixe le tirage.
- Risque : Aucun ; ne pas changer l'ordre des tirages aléatoires (plans déterministes).

### son-reseau-15-musique-du-titre — gravité 1, confiance 0.8
- Où : /Users/david/Projects/bitume/src/son.js : son.js:353-393, 402 ; jeu.js:2035, 2193 (minuterie et nœuds audio (écran titre seulement))
- Quand : Écran titre uniquement, jamais en course.
- Mécanisme : Le thème est programmé par setInterval(tic, 25) avec 0,15 s d'avance ; chaque double croche crée de 3 à plus de 20 nœuds, environ 60 par seconde. Un blocage du fil principal de plus de 150 ms (changement de circuit de la vitrine, détection graphique) fait un trou puis des notes groupées. La musique est coupée hors du titre : aucun effet en course.
- Correctif proposé : Avant un travail lourd connu à l'écran titre (lancer de la vitrine), programmer une mesure d'avance (1,9 s). Ou rendre le thème une fois par OfflineAudioContext après le premier geste et le jouer en boucle depuis un AudioBuffer : 30,5 s, environ 12 Mo en stéréo, 6 en mono.
- Risque : Le rendu hors ligne coûte de la mémoire et un calcul au premier geste ; l'arrêt en fondu doit rester immédiat.

### son-reseau-16-navigation-menus — gravité 1, confiance 0.85
- Où : /Users/david/Projects/bitume/src/navigation-menu.js ; /Users/david/Projects/bitume/src/jeu.js : navigation-menu.js:10-16, 86-87, 151-153, 166, 180-192 ; jeu.js:421, 518-522, 551, 2501 (DOM)
- Quand : Menus ; en ligne aussi pendant la pause et les résultats, course affichée derrière. Jamais pendant une course en solo.
- Mécanisme : Par image et par manette : objet d'options et fermeture (jeu.js:520-521), deux tableaux et trois fermetures dans deplacement et direction, un closest(). Sans appui, retour avant toute lecture du DOM. À chaque appui : écriture de data-manette puis getComputedStyle et getClientRects pour chaque commande : style et mise en page recalculés de force, y compris en ligne où la course tourne derrière la pause.
- Correctif proposé : Réutiliser un objet d'options et des fonctions de module ; remplacer [12, 13, 14, 15].find et some par quatre tests. Mettre en cache par écran la liste des commandes visibles, invalidée à l'ouverture d'un onglet et au changement d'écran, pour ne plus relire le style à chaque appui.
- Risque : Cache périmé si un bloc est masqué sans passer par ouvrirOnglet ; navigation-menu.test.mjs à tenir.

## Points d’entrée utiles

- son.demarrer() (src/son.js:178-184), appelé par activerSon() (src/jeu.js:685-689) : seul endroit où le graphe audio se bâtit (init, son.js:148-176) ; c'est là qu'ajouter le pool de voix ponctuelles et le second moteur.
- son.stats() (son.js:418-423), BITUME_JEU.son, B.mesures.section('son', …) et B.mesures.audio() (jeu.js:2539-2543) : mesure du son par image déjà en place dans le volet F3.
- verifications/son.test.mjs : faux AudioContext qui compte les nœuds (lignes 74-98 ; assertions 123-136 et 171-175) ; peut exiger « zéro nœud créé par événement » et « aucun moteur créé dans mettreAJour ».
- demarrerSeance (jeu.js:2364-2374), lancerEnLigne (1115-1124), demoSuivante (2089-2096) et le voile #chargement (style.css:227-228, transition d'opacité de 0,3 s) : emplacement naturel d'un préchargement sous voile.
- lancer() (jeu.js:172-237) et installer() (134-163, cache ligne 141) : ordre de construction ; la vitrine installe déjà le circuit choisi dès l'écran de préparation (jeu.js:2035, 2149, 2193), si bien que le lancement lui-même est léger.
- B.realisateur.VUES, DUREES, PORTEES (realisateur.js:21-25, 174) : les dix vues à chauffer avant une démo ; BITUME_JEU.demo(i) et session.planVu pour lancer et lire le plan.
- retro et retroVoulu() (jeu.js:1511-1516) : état du second moteur de rendu (retro.rendu, retro.scene), à préparer dans lancer() plutôt que dans majGlaces.
- BITUME_JEU.camera (jeu.js:346, 1701, 2866) : vue libre, utilisable pour rendre des images de chauffe ; BITUME_JEU.avancer, reference() et banc({ chauffe }) (jeu.js:2733-2858).
- oublierIntervalle() (jeu.js:2471-2476) : remet l'intervalle d'image à zéro après un travail long (déjà appelé au retour d'onglet et au focus).
- finirClassement() (jeu.js:2409-2429) : modèle existant de travail étalé par tranches de 4 ms avec setTimeout(0).
- En ligne : T0 = R.horloge() + 4000 (jeu.js:1197) laisse 4 s pour précharger sur chaque machine ; EL.recus, EL.corr, EL.pred, EL.vieux (jeu.js:898) ; R.rtt, R.decalage, R.synchro (reseau.js:73, 218) ; adresse 255 du salon pour diffuser un état en un seul message (salon.mjs:89).
- B.reseau.emballer, deballer, prolonger (reseau.js:27-65, 269) : fonctions pures, testables dans Node sans navigateur.
- son.suspendre() et son.reprendre() (son.js:409-417), appelés par aller() (jeu.js:2046) ; son.musique() coupée hors du titre (jeu.js:2047, 352).
- FPhysX.init() déjà lancé en fond au démarrage (jeu.js:2719) : précédent d'un travail lourd sorti du chemin de l'écran titre.

## À mesurer

- Durée réelle de FRender.create pour la toile des rétroviseurs et de setNappes/setLots (pack de tous les lots) sur le Mac de référence et sur un GPU modeste : c'est la taille de l'accroc du premier constat.
- Le banc ne mesure aucun coût audio s'il est lancé sans vrai geste : majSon sort à jeu.js:1831 et evenement() sort si « pret » est faux. La mesure matérielle en cours a-t-elle le son démarré ?
- Coût en millisecondes d'une rafale d'événements sonores (casse : 41 nœuds) et d'un rupteur tenu sur la grille (environ 10 événements par seconde pendant 6 à 7 s avant le vert), sur une petite machine : chronométrer son.evenement dans traiter().
- Charge du fil audio en solo et à deux (AudioContext.renderCapacity sous Chrome) avant et après le passage en « k-rate », et avec oversample « none ».
- Une manette seule laisse-t-elle le contexte audio « suspended » sous Firefox, Safari et sur mobile (pointerdown tactile) ? Nombre d'appels à resume() par seconde dans ce cas.
- Gigue entre l'horodatage de requestAnimationFrame et performance.now() au début du rappel, et taille des sauts de R.decalage sur dix minutes de course en ligne.
- Nombre d'états jetés par le salon à 120 et 144 Hz avec deux ou trois pairs relayés (compteur c.exces de serveur/salon.mjs:82).
- Les objets de B.circuit.echantillon sont-ils éliminés par le compilateur dans prolonger() ? Profil d'allocations d'un invité en course en ligne.
- Premier usage des autres vues de la démo (hélicoptère, sol, caméras portées sous le tunnel avec lampes) : le moteur crée-t-il des cibles ou des variantes de shader à la première coupe de ce type ? Non vérifié ici, à confirmer côté renderer.js.
- Coût de RTCPeerConnection.close() et de la création d'une liaison pendant une course, par navigateur.
- Le premier geste (new AudioContext puis init : 65 nœuds, 96 000 tirages de bruit, tables d'onde) tombe à l'écran titre et fige la vitrine un instant : sa durée sur les machines visées mérite une mesure.
