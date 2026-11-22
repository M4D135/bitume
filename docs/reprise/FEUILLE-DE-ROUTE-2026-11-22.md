# BITUME — feuille de route des modifications et essais

**22 novembre 2026.** Les demandes viennent des Markdown de GitHub et des 47 entrées du registre. Cette mise à jour compare la version jouable **0.2.107** à la .90 (`ac6a74a`). Les rapports précisent la version de chaque essai. Les parcours complets de Larche, les coûts GPU et les essais sur appareils physiques sont suivis séparément. [Build 0.2.107][v103] · [Réception du 22 novembre][reception103] · [Version de départ][base] · [Demandes récentes][retours] · [Registre des lots][file] · [Programme autonome][autonome]

## Demandes du 22 novembre et ordre de réception

| Demande | Réalisation et suite |
|---|---|
| Pluie et tracé de Larche | Correction essayée dans la spéciale, au point du signalement. Contrôles sur toute la chaussée, à l’entrée et sous le premier abri. Les essais du tracé entier en chrono, en course et en écran partagé sont détaillés au §2 et dans les relevés de cette livraison. [Parcours de Larche][parcours] |
| Animaux en bord de piste | Densité accrue sur le catalogue, y compris au niveau de détail léger. Contrôle du placement au sol et de la visibilité depuis les deux caméras. Essais console et GPU d’entrée de gamme à poursuivre. |
| Un ruban lumineux dans chaque virage | 354 rubans continus sur onze circuits. Les 222 courbes de l’audit géométrique sont couvertes de leur entrée à leur sortie, dont 124 à Larche. Les modules suivent le relief derrière la glissière. Les flèches et les diodes à proximité défilent dans le sens du virage. La préférence système de réduction des animations est respectée. Les dalles proches conservent 209 emplacements de diodes avec 68 triangles de fond. Les mesures GPU par pose figurent au §5. [Géométrie par circuit][rubans] |
| HUD et assistant de virage | Classement et instruments réduits, alerte de direction translucide avec reflet fin. L’alerte mesure environ 196 × 33 px dans la vue de référence. Six caméras contrôlées en solo, en duo et sur deux formats tactiles. Les 64 états de joueur essayés gardent séparés commandes, carte, classement et alerte. |
| Vibrations Switch, Xbox et PS5 | Grain léger, pulsations moteur autour de 4,5 / 7 / 9,5 Hz aux trois régimes mesurés, bordure déclenchée par le contact des roues, impulsion courte au changement de rapport et choc grave selon sa force. Le mélange atténue le fond au passage d’un événement. Le pilote règle la puissance de 0 à 100 %, par pas de 5, avec un défaut à 50 %. Le jeu choisit automatiquement les canaux annoncés par le navigateur. Les deux sorties cessent immédiatement à la pause, aux résultats ou si la page est masquée ; il faut un nouveau pas de conduite valide avant la reprise. Une course WebGL/PhysX à deux joueurs et les actionneurs simulés vérifient les commandes envoyées. Réception tactile à effectuer sur les trois manettes, en USB et Bluetooth selon disponibilité. [Courbes des cinq sensations][courbeshaptiques] · [Mesures des signaux][vibrations] |
| Fluidité et rendu photoréaliste | Le détail du feuillage périphérique s’adapte à la caméra et à la trajectoire à venir. À Cap-Séquoia, sur trois poses cockpit 1080p, 40 000 à 72 000 triangles supprimés par image, avec égalité des pixels de la moitié centrale. La grille du Piémont donne à Larche ses crêtes lointaines. Le photoréalisme reste un chantier sur les feuillages proches, les bâtiments, l’éclairage, les matériaux et leurs reflets. Le §5 détaille les mesures et les étapes. |
| Intégration de toutes les branches | GitHub et le dépôt local principal conservent uniquement `main`. Les travaux de chaque pointe sont dans son historique. Les références et les modifications locales ont été sauvegardées. |

**Réception suivante.** Comparer le toucher sur Switch, Xbox et PS5, puis mesurer le temps d’image sous la pluie sur Xbox Edge, GPU intégré et téléphone. Monaco, Marseille, le réseau et le portage natif ont leurs critères de réception aux §2, §6 et §7.

## 1. Corriger et recevoir la course actuelle

| Priorité | Demande | État et critère de réception |
|---|---|---|
| Livré et essayé | Une seule pluie en conduite | Chrome WebGL2, Larche, à 29,4 km de l’arrivée, à 0 et 288 km/h : un seul effet de gouttes, zéro trait de pluie extérieure superposé. Lentille désactivée : les précipitations extérieures prennent le relais. Le portail laisse voir la pluie et la visière sèche sous abri. Les essais automatisés couvrent aussi deux vues, la neige et la pause. Réception à poursuivre sur les appareils physiques. [Correction][pluieroute] |
| Livré et essayé | Route continue sur Larche → Vinadio | La capture à 29,4 km de l’arrivée a été reproduite en jeu. Sur 82 040 points sondés de la spéciale, 572 pénétrations du sol en .90, aucune après correction. Sur 50 962 triangles de chaussée vérifiés, garde minimale mesurée de 13,5 cm. Les 16 ponts restent dégagés. Réception complète de conduite détaillée au §2. [Correction][pluieroute] · [Parcours SS21][larche] |
| En cours | Étendre l’audit des cartes | Aucun dépassement de terrain dans les 11 circuits sondés. Les jonctions des dalles dans les tunnels courbes ont aussi été corrigées. Le balayage de 104 692 rayons PhysX passe de 99 rayons sans sol et 8 impacts sur tranche à zéro. Compléter le contrôle avec décors solides, rochers, arbres, arches, animaux, stands, tunnels et caméras. Vérifier départ, arrivée, raccords et virages en sec/pluie, de près et à distance. Sierra et Route-des-Cimes ont déjà reçu un correctif ponctuel en .89. [Audit demandé][retours] |
| Livré et essayé | Championnat dans les menus | Trois coupes de 5, 8 et 11 manches. La Coupe d’Europe a été parcourue avec le pilote automatique PhysX, en passant par les menus et le classement de chaque manche. Avec la correction du dégagement, 60 franchissements sur 60 départs. Le joueur termine 1er avec 70 points, toujours présents après rechargement. Les essais de barème couvrent aussi le meilleur tour et l’abandon. [Coupe en course][coupecomplete] · [Intégration][coupe] · [Barème][champ] |
| Livré et essayé | Davantage d’animaux au bord des routes et démos sur les circuits | Habitats répartis sur les 11 cartes. Sur Larche, en cockpit léger, animaux discernables à 68/368 points contre 0 ; en poursuite fine, 316/368 contre 9. Val-Brûlé en cockpit léger passe de 4 à 25 points sur 48. Les pattes suivent le sol triangulé et le réglage Faune désactivée reste disponible. Démos recentrées sur route et lieux, 11 parcours testés au moteur, avec contrôle d’occultation sur Route-des-Cimes. À qualifier sur GPU modestes et machines réelles. [Faune de bord de route][densite] · [Fondu][fondu] |

## 2. Finir les circuits, le relief et les ouvrages

| Lot | Acquis | Travail à faire |
|---|---|---|
| Monaco 14A — sources | Boucle OSM de 3 323,610 m sur 415 points, référence FIA 3 337 m. Les deux tunnels concurrents ont été confrontés en plan. Les coupes, le nivellement et l’orthophoto placent le saut de 6,60 m à la limite du couvert. À 2,765 m d’écart, le MNT LiDAR donne 7,46 puis 8,19 m, tandis que la voirie passe de 6,90 à 13,50 m. [Réception du portail][portail] Sur les 26 arêtes du tunnel principal, le tracé OSM reste au moins 9,712 m plus proche de l’axe Louis-II. | Obtenir un relevé de chaussée daté et géoréférencé, résoudre la rupture de 6,6 m près de la sortie, le premier couvert du Portier, les limites gauche/droite, dévers, niveaux et portails. Expliquer l’écart de longueur avec les sources. Garder les inconnues explicites. [Dossier géométrique][monaco] · [Voirie et limites][monaco05] |
| Monaco 14B–F — course et ville | La voie explicite, ses outils et les tests génériques existent. Monaco est encore absent du catalogue. | Après 14A, adapter largeur et limites communes au rendu/PhysX/IA, gérer rues superposées, murs, grille, épingle Fairmont, Portier, lumière du tunnel, Nouvelle Chicane, Tabac, Piscine et Rascasse. Faire les stands sur une voie distincte, le port, les quais, bateaux, tribunes et façades. Recevoir un tour filmé, la course à 12, le duo et les écarts par secteur. [Plan détaillé][maitre] |
| Marseille 15A–F | La spéciale Vieux-Port → Pharo/Catalans → Corniche → Statue de David est jouable depuis .90. Le tracé, la ville et le profil d’altitude tabulé sont dans le code. L’inventaire EMPRISE, la grille terrain et des sondes BD TOPO sont publiés. | Relier la géométrie jouable aux sources point par point, dater le relief et son datum, densifier les ruptures et qualifier la hauteur de chaussée aux quais, sous les ouvrages et sur les tabliers. Recaler bâtiments, murs et collisions, vérifier onze rivaux, duo, météo et réseau. Préserver les attributions. [Spéciale et dépendances][mars] · [Sources][marsref] · [Profil du jeu][marsjs] |
| Larche L0–L6 | Sur la spéciale entière, au soleil, le chrono est de **14 min 11,560 s** et le joueur termine la course 4e sur douze en **14 min 39,897 s**. La première course pluvieuse a révélé un rival immobilisé au pont du km 11,43. Une fois la consigne de dégagement corrigée, les douze voitures franchissent la ligne avec les mêmes graines et les mêmes pas de simulation. Le rival concerné termine en **16 min 30,575 s**. Les sept immobilisations initiales sur 72 approches dirigées du pont disparaissent. [Parcours en jeu][parcours] · [Reproduction du blocage][pontia] | Comparer les épingles et l’altitude à la source, éprouver le demi-tour/replacement et les séances sur les appareils cibles. [Fiche Larche][larche] |
| Relief et lieux 22A–F | Route-des-Cimes est jouable avec Lacets, Mur, gorge, pont et couverts. Baïkal 13A/B, Brume-de-Jade, Cap-Séquoia et d’autres biomes ont reçu des lieux distinctifs. Le moteur sait représenter plusieurs couverts. | Qualifier les nouveaux dévers, crêtes, compressions, bombement et raccords de chaussée avec la voiture et les rivaux. Compléter les identités de lieu, vrais vides, corniches, ponts, mobilier de course d’époque et passages couverts là où le plan le demande. Même niveau pour géométrie, collision, ombre, pluie, caméra et rétros. Haut-Col a son dossier historique rampes/corniche/deuxième tunnel, mais sort du menu resserré. [Lieux et ouvrages][lieux] · [Haut-Col][haut] |
| Destinations 16A–F et fusion des biomes | Les six originales étaient intégrées en .86. La décision .89 a resserré le menu à dix identités, puis Marseille en a porté le nombre à onze. | Peaufiner Fjord-d’Argent, Sierra-Cuivrée et Baie-du-Corail dans le menu. Conserver les travaux Carpates, Écosse et Andes ainsi que Port-Sable, Haut-Col et Roche-Fauve, retirés de la sélection. La cible historique de 16 puis 17 ne justifie pas de réintroduire seule les doublons. Protéger les anciennes sauvegardes quand un identifiant ou un indice disparaît. [Catalogue .90][catalogue] · [Décision de fusion][retours] |

**Les onze circuits sélectionnables en 0.2.107.** Val-Brûlé, Marseille, Baie-du-Corail, Cap-Séquoia, Fjord-d’Argent, Route-des-Cimes, Col de Larche → Vinadio, Lande-Noire, Sierra-Cuivrée, Brume-de-Jade et Baïkal. [Source du menu][catalogue]

## 3. Conduite, voitures, pilotes et présentation de course

| Demande | Reste à réaliser ou à vérifier |
|---|---|
| Conduite 17, puissance et aides | Repartir des chemins PhysX actuels. Étalonner les **521 ch** visés, les rapports/régimes, accélérations et vitesse de pointe. Distinguer ABS absent/léger/complet selon l’aide. L’aide Légère est le défaut. Qualifier la dérive au glissement réel et le rôle du bouton, du guidage clavier/tactile et du contre-braquage. Mesurer sec/pluie, masse/appui, freinage et comportement arcade. Changer la version physique et migrer les records si les lois changent. [Contrat physique p16][p16] · [Code de conduite][conduite] |
| Contacts, IA, pneus et stands | Préserver châssis/suspensions raides, envol roue contre roue, perte d’appui en vol, aspiration, collision, dégâts et replacement. Rejouer les séries de dépassements propres, défense, freinage en épingle, trafic, accident et reprise. Les quatre montes, usure par roue, choix par pilote, réseau, stratégie et service existent. Recevoir les 12 mécaniciens et la sortie en chicane de .90, l’attente de plusieurs voitures, les pneus visuels et endommagés, l’affichage et les décisions de l’IA sur piste mouillée. [Pneus et stratégie][pneus] · [Retours de course][retours] |
| Monoplace 126 CK, R1–R5, M1–M4 | La géométrie commune carrosserie/habitacle/siège, les six vues et les mains articulées sont intégrées. Finir la réception profil, dessus, arrière et trois-quarts contre la référence 126 CK, puis les finitions manchettes, manches, avant-bras, coudes, épaules et silhouette. Vérifier longueurs des doigts, tenue de jante, prise du levier, Troll interrompu, les trois niveaux de détail et rivaux. Comparer à caméra et phase identiques. [Modèle complet][modele] · [Mains et manches][mains] |
| Cockpit, caméras et affichage | Recevoir le champ cockpit de 70° en configuration par défaut, volant/tableau, deux rétros, yeux du pilote et visibilité sous arceau. Vérifier la transition des six vues avant/arrière sans masque par le casque, le regard arrière, HUD/carte configurables, paysage, portrait et écran partagé. Vérifier séparément le coût des rétros et leur image lors du changement de caméra. [Vues J1/J2][vues] · [Référence de survol][survol] |
| Signalisation, hélicoptères et drones | Le ruban de chevrons à matrice LED suit les virages de tous les circuits. Les triangles avant-virage, l’hélicoptère et les drones fonctionnent. Poursuivre les essais de nuit sur écran physique, sur les dévers extrêmes et sur les signaux des portiques (drapeaux, tours, secteurs, stands, météo). Tester le déplacement autonome tête → dernier, les rotors, prise de vue basse, évitement des arbres/reliefs/ouvrages, rétros et coûts selon qualité. [Demande vidéo][survol] · [Livraison .89][retours] |
| Public, emotes, audio et vibrations (18/20/24) | Public humain animé, acclamations, parapluies, moteur, échappements, gestes de pilotes, klaxons et vibrations sont présents. Recevoir à l’oreille le Doppler des rivaux, l’ambiance de tribunes et le passage sous abri. Vérifier l’emote et le klaxon des IA au dépassement, les interruptions et anti-répétition. Régler sur vraies manettes le passage de rapport, la poussée, le patinage, les bosses, vibreurs et gâchettes. Les menus restent sans vibration. [Demandes arcade, Troll et son][arcade] · [Règles de réalisation][agents] |
| Records, fantômes et compteurs | En .90 le jeu appelle déjà les records enrichis. Vérifier import des anciens records et fantômes, historique par piste/mode/boîte/version physique, tour propre, exclusion des essais, comparaison au bon fantôme et sauvegarde après arrivée. Au titre, le code des visites et visiteurs uniques est présent. Vérifier sur le service autorisé le comptage global persistant et les comportements hors ligne, privé, multi-onglets et rafraîchissement. [Records][records] · [Compteurs][visites] |

## 4. Rendu, matériaux, météorologie et environnement

| Lot | Travail restant |
|---|---|
| 19/21 — eau, neige, lumière et Photo | Conserver les impacts sur la lentille, les gouttes qui fusionnent, gel/fonte, panache et eau de carrosserie. Recevoir toutes les vues et paliers, notamment tunnel, soleil bas, pleine nuit, phares et galerie ouverte. Comparer reflets des flaques, sur carrosserie et pilotes, ombres stables et contact sous véhicule, adaptation de l’œil aux portails et teintes préservées. Qualifier un palier Photo et les effets coûteux par image et par passe. Reproduire sur la version courante tout ancien défaut de bandes ou diagonales avant correction. [Programme rendu][autonome] · [Optique][eau] |
| 22/26 — saisons, arbres, flore et faune | Le jeu comprend déjà quatre saisons, décors organiques, arbres procéduraux, rochers, lieux emblématiques, animaux 3D et groupes de spectateurs. Contrôler chaque circuit réellement au menu sur changement de saison, espèces, feuillage, floraison, neige, densité et LOD. Retirer les motifs géométriques visibles et objets flottants restants. Vérifier sommeil hors champ, apparitions/disparitions progressives et absence d’animaux dans les collisions de piste. [Saisons][saisons] · [Faune et démos][faune] |
| 23/25 — matériaux cockpit et voiture | Fignoler grain et rugosité à petite échelle, vernis, métal, caoutchouc mat, coque, casque et peintures reflétant la scène. Dépend de la lumière du lot 21. Vérifier freins qui rougissent, chaleur d’échappement, salissures et usure, sans introduire de surfaces qui scintillent ou de roues barrées. Préserver le décor pas à pas dans les trois niveaux de détail et les rétros. [Programme réaliste][autonome] · [Référence voiture][modele] |
| Huit idées « race » | Qualifier séparément les raccords longitudinaux de l’asphalte, contacts terre–gravier–herbe, évaluation moins coûteuse au loin, silhouettes de forêts lointaines, sons de pneus selon leur état, distinction impact/raclement, lecture des avaries et explication du replacement. Le dossier contient les inspirations et les critères de réussite de chaque idée. [R1–R8][race] |

## 5. Fluidité, mémoire et GPU

| Lot | Travail et preuve attendue |
|---|---|
| 5B, 28A–D — préparation | Les optimisations de l’herbier, des saisons, de la préparation progressive et du préchauffage ont déjà une base. Chronométrer la première visite, le changement de piste/saison, le premier affichage des rétros et le départ, avec les onze cartes actuelles. Éliminer les reconstructions pendant la course. En mode Auto, conserver la détection une fois par version sur les appareils concernés et le démarrage passif sans banc sur mobile. Respecter le choix manuel. [Étude A–H][calcul] · [Démarrage mobile][mobile] |
| 28E — cache persistant | **Première tranche reçue sur le panorama de Larche.** Lors du premier banc en .103, une base Chrome vierge calcule 396 nappes en 156,9 ms. Après rechargement complet de la page dans la même origine, la lecture et le décodage prennent 18,7 ms. Les 2 109 188 octets de données redonnent les mêmes sommets et indices. L’étape décor entière passe de 1 702,7 à 1 548,5 ms sur cette paire. Sur cette version, la première construction prend 189,6 ms et la lecture à la réouverture 46,0 ms. Les cinq essais arrivent en course, y compris après corruption, refus du stockage ou lecture suspendue. Étendre le dispositif aux autres décors et à l’herbier, puis mesurer quotas, éviction et budgets RAM/VRAM sur les machines cibles. [Réception en jeu][cachepan] · [Cache versionné][cache103] · [Plan calcul][calcul] |
| 28F–H — options après mesure | Si la première visite saccade encore, comparer le noyau C/WASM de l’herbier et un Worker avec transfert de tableaux typés. Si le coût du rendu le justifie, mesurer WebGPU sur une vraie scène face à WebGL2, inclure le coût initial et le repli. Conserver les licences, la génération procédurale et la même géométrie jouable. Toute modification de FERRO passe par son dépôt canonique et un nouveau verrou qualifié. [Prototypes et seuils][calcul] · [Optimisation moteur][perf] |
| Géométrie, matériaux et GPU | Quantifier poids des maillages, textures, transparence, ombres, effets, allocations, envois GPU et rétros. Étudier selon le coût mesuré les groupes de triangles, instances, imposteurs lointains, visibilité par zones/portails, relief simulé par normales ou parallaxe et réflexion ou lancer de rayons quand pris en charge. Calculer l’importance à l’écran pour chaque vue, selon vitesse, champ de vision et taille projetée. Comparer à caméra, météo, réglages et définition identiques. [Cahier des charges][perf] |
| Mesures et réception | Relever médiane, p95, pire image et temps de préparation avec douze voitures, en solo et duo. Faire apparaître les images longues, les pics RAM/VRAM et les éventuelles pertes de contexte après plusieurs courses. Le budget historique Mac à 1 390 × 1 295 est p95 ≤ 16,7 ms, pire image ≤ 29 ms. Essayer les paliers 30/60/120 sur le matériel disponible, y compris Intel intégré, Xbox Edge plafonnée à 1 280 × 720, Windows et téléphone. Un essai avec navigateur émulé et une mesure sur la machine cible ont chacun leur colonne. [Budgets][feuille] · [Profil Xbox][xbox] |

**Dalles LED à caméra fixe.** La géométrie de fond passe de **422 à 68 triangles par dalle**, en gardant les 209 emplacements des diodes. Sur Apple M5, en WebGL2/Metal à 1 280 × 720, le temps GPU du rendu principal varie selon la position. Chaque cellule compare 27 mesures avant et après sur la même pose. [Séries et protocole][perfled]

| Abscisse sur Larche | Triangles de scène en moins | Médiane GPU avant → après | p95 GPU avant → après |
|---|---:|---:|---:|
| 2 868 m | 19 356 | 8,261 → 8,158 ms | 8,541 → 10,216 ms |
| 2 920 m | 18 648 | 8,533 → 9,719 ms | 9,335 → 12,884 ms |

Le nombre de triangles diminue aux deux poses. La médiane s’améliore légèrement à 2 868 m et augmente à 2 920 m. Dans les séries roulantes, les trois essais sous pluie ont produit 1 321 images en .102 intermédiaire contre 1 497 en .99. Au sec, les totaux sont de 1 986 et 2 051. Les essais par suppression d’un effet ont varié avec la charge du Mac. Il reste à isoler les coûts en course sur une machine réservée et à réceptionner les GPU modestes. [Mesures de fluidité et de visibilité][perfled]

**Cadence en course de la version 0.2.107.** Sur le Mac M5 branché, Chrome utilise Metal en qualité Fine à 1 280 × 720, avec rétroviseurs, cockpit et douze voitures. Après douze secondes de chauffe, sur trois passages de dix secondes par météo près du signalement de Larche, la cadence moyenne atteint **60,0 i/s au sec** et **51,2 i/s sous la pluie**. La médiane des trois p95 vaut 16,7 ms au sec et 33,4 ms sous la pluie. Les mesures d’images incluent la cadence du navigateur, les soumissions et la simulation. Elles décrivent ce passage et ce matériel. Lors de la première série juste après branchement, les mesures allaient de 8 à 60 i/s sur six passages. Cette première série est conservée dans le même rapport. [Mesures des six passages][cadence107]

## 6. Menus, deux joueurs, réseau et réception du jeu web

| Demande | Travail restant |
|---|---|
| Navigation arcade | Recevoir le parcours titre → préparation → course → résultats → relance au clavier, tactile et à la manette. Vérifier catégories LT/RT, croix/stick, validation/retour, Start, focus visible, mémorisation des options, tracé 3D animé et lisible. Vérifier également l’accès aux réglages en portrait et avec le pointeur d’Edge sur Xbox. [Menu arcade][menu] · [Commandes Xbox][xbox] |
| Deux joueurs locaux | Qualifier les deux manettes physiques, le branchement/débranchement et leurs affectations distinctes J1/J2. Tester direction, accélérateur et frein analogiques, remappage et conflits avec clavier/tactile. Recevoir l’écran partagé aux différents formats, deux caméras/rétros/HUD, changement de vue indépendant, départ et arrivée sur une spéciale et en boucle. Vérifier sur manettes Xbox et Switch selon disponibilité, en notant le modèle. [Commandes et réception][xbox] · [Vues indépendantes][vues] |
| 27 — réseau sans serveur à administrer | Le jeu dispose d’un salon WebSocket, de connexions WebRTC avec découverte STUN, d’un relais et d’une horloge hôte. Le prototype d’invitation autonome reste à raccorder et à éprouver, y compris consentement/visibilité des adresses et limites des services publics retenus. Tester création, invitation, expiration et reconnexion sur deux accès Internet distincts, réseau local, NAT difficile, chute de la liaison directe et passage au relais, départ synchronisé, arrivée, coupure d’un joueur et reprise par l’IA. Documenter les situations où l’invitation échoue. [Plan de jeu][autonome] · [Transport du jeu][reseau] |
| Démos, pilotes et météo | Recevoir plans embarqués/externes, pilotes articulés et direction de course, vitesse normale pendant les accidents et reprise après blocage. Vérifier saisons, transition sec/pluie/neige, météo réelle si activée, âge/localité des données et comportement hors ligne. Contrôler que les ouvrages ouverts montrent l’extérieur et que les tunnels abritent la voiture. [Demandes vidéo et survol][survol] · [Programme et dépendances][objectifs] |
| Qualification finale | Rejouer les parcours complets en navigateur avec WebGL2 et PhysX, clavier, tactile, manette et duo, ainsi qu’un duel WAN. Vérifier chargement, premières secondes, chronos, sauvegarde/lecture et retour au titre. Conserver rapports numériques, temps d’image et captures aux passages discriminants. Pour chaque version, distinguer la recette locale, les tests sur matériel, le build reproductible, le commit et l’état réellement publié. [Critères de réception][feuille] · [Objectifs d’exécution][objectifs] |

## 7. Moteur natif C++ — après cadrage, Mac puis Linux puis Windows

Le plan de la PR #58 a été intégré dans `main`. Sur Mac M5, les sondes C++20 ont exercé Metal et SDL GPU. Le SDK PhysX CPU 5.12.0 arm64 a ensuite été compilé depuis deux répertoires propres. Trois exécutions par compilation, soit **six au total**, retrouvent le contact au pas 70, la hauteur de repos à 0,350000 m au pas 360, le rayon vertical à 3,000000 m et zéro allocation en fin de scène. Les deux compilations de SDL 3.4.20 arm64 depuis son archive officielle produisent une bibliothèque identique. Pour clôturer N0, fixer les cibles matérielles et les budgets, puis réceptionner les ombres et les rétroviseurs. [PR de cadrage][pr58] · [Plan par plateforme][natif] · [Relevé N0][n0]

| Étape | Condition de passage |
|---|---|
| N0 → N1, macOS | **N0 partiel.** Metal, SDL GPU et PhysX natif ont chacun une sonde exécutée sur M5. La SDL 3.4.20 arm64 est désormais reconstruite depuis son archive officielle. Les deux compilations livrent la même bibliothèque et les six lancements rendent les trois pixels de référence. Fixer les budgets de comparaison, puis assembler dans N1 la fenêtre, les entrées, l’horloge, le journal et la scène physique. Comparer la conduite à la référence web actuelle p16. |
| N2 → N3, jouabilité | Porter un circuit et une voiture, comparer géométrie, trajectoire, collisions, caméras et coût au jeu web. Finir puis relancer une course avec les douze voitures, IA, pneus, stands, dégâts, règles et une spéciale ouverte. |
| N4 → N5, parité produit | Reproduire lumière, météo, matériaux, faune, son, rétros, puis catalogue, menus, réglages, sauvegardes, progression, deux manettes et écran partagé. Qualifier séparément signalisation et protocole réseau avant de proposer le jeu croisé. |
| N6, livraison Mac | Constituer une `.app`, éprouver sur les machines Mac annoncées les temps d’image, la stabilité longue, les sauvegardes et la distribution. Documenter les différences encore visibles. |
| L1 → L2, Linux | Après N6, activer Vulkan et les services Linux, tester affichage, pilotes, entrées, audio et fichiers sur du vrai matériel. Distribuer un paquet et vérifier la parité Mac. |
| W1 → W2, Windows | Après L2, activer le moteur de rendu Windows et la chaîne de compilation. Qualifier paquet, GPU, deux manettes, sauvegardes et stabilité sur Windows, puis comparer les trois plateformes. |

L’étude initiale envisage également Xbox et PS5 natives. Leur étude dépend des accès développeur et du matériel. La réception **Xbox Edge** ci-dessus appartient au jeu web et peut avancer dès maintenant. [Étude des plateformes][calcul] · [Ordre des portages][natif]

## 8. Demandes remplacées et travaux déjà repris

- La revendication « 20/20 » appartient au rapport historique .89/.90. Le présent signalement rouvre explicitement l’eau et le sol de Larche. Les anciens incidents identifiés (portique, pile de pont, muret/replacement, tunnel de Barricate, arche de Sierra et rocher aux Cimes) servent de cas de régression. Le rapprochement des biomes remplace les anciennes cibles de 16 puis 17 pistes au menu. [Livraison et changements de périmètre][retours]
- La 126 CK de référence remplace le projet 312 T5. Le champ cockpit de 70° remplace l’objectif antérieur de 60°. La spéciale de 32,8 km commence au col de Larche et remplace l’ancien départ Barcelonnette à 64,5 km. Les vues, les compteurs du titre, le démarrage mobile passif et les saisons ont déjà des livraisons repérables. [Modèle][modele] · [Vues][vues] · [Spéciale][larche] · [File des lots et reçus][file]
- Les bases 5B, 12A–12F4, 13A/B, 18, 20, 24, 26, 28A/C ont des réalisations à préserver avant de reprendre leurs finitions. La PR #43 et ses outils de réception des abris sont intégrés dans `main`. Les critères restant à vérifier couvrent notamment les rétros et les projections d’eau. [PR des couverts][pr43] · [Historique des branches][branches] · [Programme autonome][autonome]
- Les documents historiques .80 à .90 restent consultables. Cette feuille porte le rapprochement du registre avec les changements du 22 novembre. Les numéros de lots expriment des demandes et dépendances, pas un état de livraison universel. Les états des PR, les reçus de publication et les mesures de performance sont datés. [Registre][file] · [État .90][etat] · [Liste maîtresse][master]

## Intégration du 22 novembre

- **Annonces de virage.** Marseille et Larche utilisent leur distance réelle jusqu’à l’arrivée. Le contrôle détecte 18 annonces sur Marseille et 117 sur Larche. La décélération après la ligne est exclue.
- **IA et stands.** Une IA contourne une voiture accidentée ou en service. Dans le piège en U du test, elle fait deux manœuvres, attend le délai de secours de 15 secondes et reprend la course avec ses pneus.
- **126 CK.** Les quatre flammes utilisent les coordonnées et le rayon des sorties du modèle courant. Le conduit arrière du ponton rejoint la carrosserie et les sept ouvertures ont été vérifiées dans les niveaux de détail. Les contrôles retrouvent les embouchures directement sur les triangles.
- **Pierres et shaders.** Les recettes optionnelles de pierre ont été vérifiées sur trois sites, deux saisons et deux variantes dans Chrome. FERRO 0.3.16 conserve le même modèle pendant le fondu de la faune. Le compilateur Naga rattaché à `main` a converti un shader GLSL en WGSL et a revalidé le résultat sur le Mac.
- **Branches.** 88 branches GitHub sont passées à une ; les 87 autres pointes sont dans l’historique de `main`. Les pull requests #43 et #58 sont fusionnées. Le dépôt local principal est passé de 37 branches à une. Dans le clone de livraison du 17 novembre, la seconde branche archivée a également été retirée après vérification de son ascendance. Les anciens worktrees gardent leurs fichiers et les modifications locales ont une sauvegarde séparée. Le contrôle local des nappes est également intégré. [PR des abris][pr43] · [PR du portage][pr58]

- **Contrat p16.** Les anciens records et fantômes p15 restent lisibles dans leur espace. Les nouvelles séances utilisent p16 et les pairs réseau vérifient le contrat. Les 54 relectures de physique correspondent bit à bit à la référence archivée. [Qualification][p16]
- **Relief de Larche.** Le DTM ICE 2009–2011 de Regione Piemonte, fourni sous CC BY 4.0, couvre une grille de 260 × 180 points au pas de 100 m. La construction garde les altitudes mesurées à un demi-mètre d’arrondi et traite les points absents. Les 45 212 triangles du panorama rejoignent les tuiles proches sur 2 542 sommets contrôlés. Les rayons des roues restent sur le maillage de conduite. [Provenance du relief][dtm] · [Essai géométrique][relief]
- **Rayons et visibilité.** PhysX interroge le sol et les obstacles pour les roues et les caméras. Sur piste humide, le profil compatible utilise un lancer de rayons en espace écran pour les reflets. L’optimisation fovéale de cette livraison porte sur les niveaux de détail des arbres, selon la position projetée et le freinage. Tester ensuite l’occlusion par relief et portails, la stabilité des reflets hors écran et le coût de chaque passe. Sur Mac M5, le tracé de rayons matériel est vérifié sur un extrait du pont de Larche. Restent son intégration dans le rendu d’une course et la qualification des autres plateformes et du suivi oculaire. [Étude moteur][optim]

- **Raccord des tuiles de montagne.** Le générateur prépare une seule fois les tuiles voisines à consulter dans chaque cellule du relief. Sur cinq passages alternés par version sur le Mac, la médiane de cette étape descend de 548 à 183 ms. Les 396 nappes produites avant la coloration géographique sont identiques octet pour octet. [Données du banc][raccords]
- **Historique local.** Le test de budget du décor est intégré dans la suite. La synthèse de travail du 21 novembre et le différentiel de la première conduite sont conservés à l’identique dans l’archive de réception. Le différentiel est relatif au commit `e3bcb6b`. [Prototypes archivés][archiveslocales]
- **Classement et chronos.** Le chrono affiche le temps de la spéciale même après un replacement, avec la mention « hors record ». Un pilote qui a manqué la ligne apparaît « en piste » pendant le classement provisoire puis « Non arrivé ». Son rang reste visible. [Essai dans Chrome][resultatsnav]

- **Écran partagé.** Le classement de la spéciale mémorise le passage des douze voitures. Sur la même graine avant et après correction, J1 termine deuxième en 14 min 46,862 s et J2 septième en 15 min 42,423 s. Duvernet, précédemment affiché « Non arrivé », termine huitième à seulement 122 ms de J2. Les deux commandes ont divergé sur 112 074 pas de simulation. [Course et chronométrage][duoss21]
- **Végétation des versants.** Les proportions de forêt, prairie et sol nu de la vallée proviennent de la carte ESA WorldCover 2021 à 10 m, agrégée sur 11 700 cellules de 200 m. Cinq vues en jeu comparent les couleurs en été, en hiver et sous la pluie. Les 29 823 sommets, normales et indices sont identiques. Des facettes restent visibles près du km 4,59. [Réception et attribution][couverture] · [Comparaison visuelle][versants]
- **Animation de la faune.** Deux interpolations des pattes au repos allouaient des nombres à chaque image dans un mode de compilation de V8. Sur le même essai à deux vues, la charge de 3 521 octets par image tombe à 612. Les transformations et couleurs de 372 768 pièces sont identiques avant et après. [Mesures et protocole][allocfaune]

- **Trois championnats complets.** Les trois coupes de 5, 8 et 11 manches ont été conduites en Chrome, avec les départs et classements du menu. Les trois classements sont conservés après rechargement de la page. Coupe d’Europe : 60/60 voitures arrivées. Tour du Monde : 96/96. Grand Championnat Intégral : 132/132. Le joueur totalise 173 points au Tour du Monde et 212 dans le Grand Championnat. [Europe][coupecomplete] · [Monde][monde8] · [Intégral][integrale11]

- **Arrêt des vibrations.** Dans Chrome, Start arrête les deux sorties simulées et dix images en pause restent silencieuses. Masquer vraiment l’onglet produit le même arrêt. Les commandes reprennent après un nouveau pas de conduite. Sur l’écran des résultats avec la fin réseau simulée et l’horloge physique arrêtée, la .106 envoyait cinq commandes par joueur sur dix images. La .107 en envoie zéro. [Pause et visibilité][pausehaptique] · [Résultats avant/après][finhaptique]
- **Coût du cache.** Sur le bloc binaire de 2,1 Mo, la vérification d’intégrité FNV passe de 50 à 5,7 ms en médiane sur le Mac avec Node. Les empreintes restent identiques. Une lecture qui aboutit après le choix du générateur termine désormais son rapport sans programmer de réécriture superflue. Le jeu peut entrer en course pendant que le stockage répond. [Mesures du contrôle d’intégrité][fnvpan]

- **Vérifications de la version 0.2.107.** Sur le Mac, les 225 suites Node et les huit tests Python passent. Le budget de simulation de 1,5 s a été repris après une première mesure de 1,635 s sous charge : 191, 193 et 187 ms en isolation. Lors du premier passage Ubuntu, le décor des Cimes a pris 164,5 ms pour un budget de 150 ms et la machine a atteint sa limite de vingt minutes après 189 suites. Sur la vérification répartie entre quatre machines, les 225 suites et les huit tests Python passent, avec reconstruction identique du HTML. [Qualification complète](https://github.com/M4D135/bitume/actions/runs/45040217066) [Première qualification Ubuntu](https://github.com/M4D135/bitume/actions/runs/45038134289)

- **Rayons matériels sur la SS21.** La sonde native Metal emploie 135 triangles de la chaussée du pont au km 14,273. Six rayons vérifient le contact, le passage par le vide et les ombres bornées à la distance de la lumière. Les 144 comparaisons CPU/GPU concordent. La médiane de 19,6 µs mesure une commande de six rayons sur cette micro-scène. Le jeu web continue d’utiliser ses reflets en espace écran. [Mesures natives][rayonsm5]

## Index des 47 demandes du registre

Les 47 lignes suivent le registre dans son ordre. L’état ci-dessous tient compte de la version 0.2.107, des réceptions précédentes et des décisions qui ont réduit le catalogue. La section indiquée précise les suites et les critères de réception. [Registre source][file]

| Demande enregistrée | Section | État au 22 novembre et suite |
|---|---:|---|
| Animaux proches de la route ; sommeil hors des vues utiles | §1 | Qualifiée sur Larche et Val-Brûlé en Chrome. Comparer densité et budgets sur Xbox et GPU intégré. |
| Refaire les démos des neuf circuits : route, tracé et point d’intérêt uniquement | §1 | Qualifiée au moteur sur les onze cartes actuelles. Revoir visuellement les séquences complètes et plusieurs météos. |
| Démarrer sur téléphone sans scène ni rafale de benchmark | §5 | Livré. Le mobile démarre sans banc automatique. Reste la mesure de démarrage sur téléphone physique. |
| Références, modèles et programme complet | §3 | Publié. Références, empreintes et programme réunis. Les retouches de modèle se reçoivent par angle et par phase. |
| Même habitacle monde entre vues, assise plus basse et bras dégagés du buste | §3 | Livré. Habitacle commun et assise révisée. Réception des mains, des manches et du dégagement du buste à poursuivre. |
| Écarter et évacuer les gouttes selon vitesse, flux et orientation caméra | §1 | Corrigé et reçu à Larche à 0 et 288 km/h. Les essais de course sur appareils physiques restent ouverts. |
| Caméras, sols, volant et pilote expressif | §3 | Partiel. Pilote commun, gestes et caméras intégrés. Recevoir cadrages, sols et animation sur séquences complètes. |
| Pluie, panache et neige selon les références | §4 | Partiel. Pluie de la lentille reçue et parcours mouillé terminé. Panaches, neige et toutes les vues sous abri restent à comparer. |
| Plusieurs passages couverts et niveaux cohérents | §4 | Partiel. Plusieurs ouvrages des Cimes et de Larche jouables. Revoir interfaces, niveaux et visibilité des ouvertures. |
| Route-des-Cimes distincte, objectif 9,70 km | §2 | Partiel. Circuit de 9,70 km au menu avec sept lieux. Lac, cascade et finition de certains raccords restent à recevoir. |
| Haut-Col : rampes, corniche, second tunnel | §2 | Retiré du menu après regroupement des biomes. La fiche historique conserve pentes, corniche et tunnels. |
| Monaco 14A : chaussée, niveaux et provenance | §2 | Qualification partielle. L’ortho et les MNT localisent la limite du couvert Louis-II. La surface roulable 2026 et le premier couvert restent à mesurer. |
| Monaco 14B–D : route, murs, IA, stands et tunnel | §2 | Prévu après 14A. Rues superposées, murs, stands, tunnel et circulation à qualifier sur la chaussée mesurée. |
| Monaco 14E–F : port, architecture et fidélité | §2 | Prévu après validation du circuit et des niveaux. Port, façades et écarts par secteur restent à documenter. |
| Marseille 15A–B : corridor et relief | §2 | Partiel. Corridor, relief tabulé et sondes disponibles. Relier les points jouables au datum et aux sources datées. |
| Marseille 15C–F : route, ville, collisions et IA | §2 | Jouable. Achever le recalage du bâti et des contacts, puis les réceptions en course, sous météo et en duo. |
| 16A Fjord-d’Argent | §2 | Jouable. Comparer relief du fjord, silhouettes, collisions et visibilité à proximité des ouvrages. |
| 16B Crêtes-des-Carpates | §2 | Hors menu après regroupement des biomes. Conserver les références si un circuit distinct est repris. |
| 16C Landes-d’Écosse | §2 | Hors menu après regroupement des biomes. La lande sélectionnable reste Lande-Noire. |
| 16D Sierra-Cuivrée | §2 | Jouable. Le rocher et l’arche servent de cas de régression. Recevoir les autres aménagements en conduite. |
| 16E Baie-du-Corail | §2 | Jouable. Recevoir les aménagements du lagon, la lisibilité du phare et les performances de la côte. |
| 16F Col-des-Andes | §2 | Hors menu après regroupement des biomes. Aucune nouvelle destination jouable n’est annoncée. |
| 17 : puissance, ABS, glisse et aides depuis p15 | §3 | Partiel. Contrat p16 et 54 relectures qualifiés. Calibrage des 521 ch, ABS et niveaux d’aide à vérifier en conduite. |
| 21 : sols, ombres, eau, reflets, nuit, Photo et grain | §4 | Partiel. Les effets et plusieurs matériaux existent. Recevoir les ombres, les reflets, la nuit et le palier Photo par vue. |
| 23/25 : freins, chaleur, salissures et matières | §4 | Partiel. Matières et sorties d’échappement intégrées. Revoir la chaleur, les salissures et les métaux sous éclairages identiques. |
| 27 : invitations sans serveur dédié à administrer | §6 | Partiel. Salon, WebRTC et relais présents. Brancher l’invitation autonome et tester sur deux réseaux Internet distincts. |
| 28B/28D : précréation et installation progressive | §5 | Partiel. Une préparation et un préchauffage existent. Mesurer les onze cartes, les changements de saison et les premières images. |
| 28E : IndexedDB versionné et intègre | §5 | Partiel. Panorama de Larche relu en jeu sur cinq scénarios. Étendre les données binaires au reste du niveau et recevoir quotas et mémoire. |
| 28F–H : Worker/WASM/WebGPU selon mesure | §5 | Conditionnel. Engager Worker, WASM ou WebGPU seulement après mesure du coût visé et validation du repli. |
| Records par circuit, mode, boîte et modèle | §3 | Partiel. Records enrichis et espaces p15/p16 distincts. Qualifier les sauvegardes réelles, les tours propres et les fantômes par mode. |
| Championnat de plusieurs courses | §1 | Jouable. Coupe d’Europe entièrement conduite en Chrome avec douze voitures par manche, classement et points retrouvés après rechargement. Les coupes de huit et onze manches ont aussi été parcourues et leur classement retrouvé après rechargement. Comparer sur les appareils cibles. |
| Qualification et publication du programme | §6 | Par version. Rapports du 22 novembre disponibles. Matériel réel, duo sur manettes et réseaux distants restent à recevoir. |
| Quatre saisons cohérentes sur les neuf circuits, arbres et couverture hivernale | §4 | Publié pour le premier catalogue. Contrôler les onze cartes actuelles, les quatre saisons, la végétation et la neige. |
| Menu arcade multi-écrans, tracé 3D rotatif, manette et profil Xbox/Intel | §6 | Partiel. Menu et parcours de navigation intégrés. Mesurer Xbox Edge et GPU Intel et recevoir la navigation à la manette. |
| Caractériser le dépassement observé du budget CPU de construction du décor | §5 | Partiel. Un coût de construction et des variantes ont été mesurés. Relever les onze cartes contre le budget strict de 150 ms. |
| Transitions continues poursuite, arceau et cockpit, chaussée visible pendant tout le trajet | §3 | Partiel. Transitions présentes. Comparer les six caméras en mouvement, y compris casque, habitacle, visibilité de chaussée et rétros. |
| Virages relevés, dévers progressifs, surfaces dessinées et contacts PhysX cohérents | §2 | Partiel. Dévers, surfaces et contacts existent. Confronter les raccords sur les cartes avec roue, caméra et rivaux. |
| Panneaux directionnels clignotants et lisibles avant freinage et le long des courbes | §3 | Livré et reçu géométriquement. 222 courbes sur onze cartes, dont 124 à Larche. Vérifier de nuit sur écran physique. |
| Bandeaux LED procéduraux affichant drapeaux, tours, secteurs, stands et météo | §3 | Partiel. Bandeaux de course intégrés. Vérifier la priorité et la lisibilité des drapeaux, tours, secteurs, stands et météo. |
| Hélicoptères visibles de retransmission survolant le peloton, rotors et trajectoires animés | §3 | Partiel. Hélicoptère animé présent. Recevoir trajectoire du premier au dernier, évitement des reliefs et coût des rotors. |
| Drones de tournage issus des modèles procéduraux de METAL | §3 | Partiel. Drones procéduraux en jeu. Recevoir silhouettes, trajectoires basses, évitement des arbres et budgets par vue. |
| Galerie complète126CK et nouvel objectif voiture | §3 | Référence 126 CK retenue et modèle intégré. Ponton arrière et sorties contrôlés. Poursuivre les vues de comparaison. |
| Doigts sans contraction artificielle, volumes des gants et transitions plus naturels | §3 | En cours. Doigts articulés et prises de jante existants. Revoir volumes, changement de rapport et interruption des gestes. |
| Affiner manches, coudes, épaules et silhouette du personnage commun | §3 | À affiner. Personnage commun présent. Mesurer ancrages, volumes et silhouette pour les trois niveaux de détail. |
| Sommet du col de Larche → Vinadio par SS21, terrain et tracé réels, arrivée définitive | §2 | Jouable et parcourue trois fois. Chrono et course au soleil, puis course sous pluie. Douze franchissements sous la pluie, puis douze en écran partagé. Qualifier les épingles et le relief réel. |
| Six vues F1 du modèle commun et commandes J1/J2 indépendantes | §3 | Livré. Six caméras et commandes indépendantes contrôlées dans le HUD. Essais de périphériques et rétros en deux vues à poursuivre. |
| Visites et visiteurs uniques globaux persistants sur le titre | §6 | Livré côté jeu. Vérifier le service global sur sa destination autorisée, la persistance, le hors-ligne et les doubles visites. |

[agents]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/AGENTS.md
[arcade]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/DEMANDES-ARCADE-PERFORMANCE-TROLL-2026-11-20.md
[autonome]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md
[base]: https://github.com/M4D135/bitume/commit/ac6a74a452626c54929c6353b274e60d4b0d7a46
[branches]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/BRANCHES-ET-LOTS-2026-11-20.md
[calcul]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/28-CALCUL.md
[catalogue]: https://github.com/M4D135/bitume/blob/5ed77794ff5fbe72d718e79c08c1dc05f0072d28/src/jeu.js
[champ]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/src/championnat.js
[conduite]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/src/conduite.js
[eau]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/EAU-VITESSE-2026-11-20.md
[etat]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/ETAT.json
[faune]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/FAUNE-PROCHE-DEMOS-CIRCUITS-2026-11-21.md
[feuille]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/FEUILLE-DE-ROUTE.md
[file]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/FILE-TRAVAIL.json
[fondu]: https://github.com/M4D135/bitume/commit/daf7b5ee892132a9f9f2005f78622ed72eff9189
[haut]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/HAUT-COL-METEO-2026-11-20.md
[larche]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/COL-DE-LARCHE-VINADIO-2026-11-21.md
[lieux]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/22F-CIRCUITS-MEMORABLES.md
[mains]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/MAINS-REALISME-2026-11-21.md
[maitre]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md
[mars]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md
[marsjs]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/src/marseille.js
[marsref]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/references/marseille-2026/voirie-corridor-p05.md
[master]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/MASTER-LISTE-CLAUDE-FABLE.md
[menu]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/MENU-ARCADE-PROFILS-2026-11-20.md
[mobile]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/DEMARRAGE-MOBILE-SANS-BANC-2026-11-21.md
[modele]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/MODELE-COMPLET-126CK-2026-11-21.md
[monaco]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/references/monaco-2026/README.md
[monaco05]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/references/monaco-2026/VOIRIE-P05-20261120.md
[natif]: https://github.com/M4D135/bitume/blob/7a4cd9ba25ef26d1eda7d25fbd859cd40fa3b565/docs/reprise/PLAN-NATIF-CPP-MACOS-LINUX-WINDOWS-2026-11-22.md
[objectifs]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/OBJECTIFS-EXECUTION-2026-11-20.md
[perf]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES-2026-11-20.md
[pneus]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/12F4-STRATEGIE-STANDS-IA.md
[pr43]: https://github.com/M4D135/bitume/pull/43
[pr58]: https://github.com/M4D135/bitume/pull/58
[race]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/REFERENCE-RACE-2026-11-21.md
[records]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/src/records.js
[reseau]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/src/reseau.js
[retours]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/PLAN-0289-RETOURS-2026-11-22.md
[saisons]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/SAISONS-CATALOGUE-2026-11-20.md
[survol]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/DEMANDES-VIDEO-ARCADE-SURVOL-2026-11-20.md
[visites]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/VISITES-TITRE-2026-11-21.md
[vues]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/CAMERAS-F1-2026-11-21.md
[xbox]: https://github.com/M4D135/bitume/blob/ac6a74a452626c54929c6353b274e60d4b0d7a46/docs/reprise/XBOX-EDGE-COMMANDES-2026-11-21.md

[pluieroute]: https://github.com/M4D135/bitume/commit/118be51be3b72b6bcae73248300d64fce34f64ea
[coupe]: https://github.com/M4D135/bitume/commit/6a19904
[densite]: https://github.com/M4D135/bitume/commit/7fbc4c4
[n0]: https://github.com/M4D135/bitume/blob/main/docs/reprise/N0-MAC-2026-11-22.md

[portail]: https://github.com/M4D135/bitume/blob/main/docs/references/monaco-2026/PORTAIL-LOUIS-II-20261122.md
[p16]: https://github.com/M4D135/bitume/blob/main/docs/reprise/PHYSIQUE-P16-20261122.md
[dtm]: https://github.com/M4D135/bitume/tree/main/docs/references/larche-vinadio-2026
[relief]: https://github.com/M4D135/bitume/blob/main/verifications/relief-vallee.test.mjs
[rubans]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/rubans.json
[vibrations]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/vibrations.json
[optim]: https://github.com/M4D135/bitume/blob/main/docs/reprise/OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES-2026-11-20.md
[v103]: https://github.com/M4D135/bitume/blob/a2a1a1acd31f10b1951446a8fd302be62aec98f6/VERSION.json
[reception103]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/RECEPTION.json
[parcours]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/parcours-larche.json
[cachepan]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/panorama-cache.json
[cache103]: https://github.com/M4D135/bitume/blob/5ed77794ff5fbe72d718e79c08c1dc05f0072d28/src/panorama-cache.js
[perfled]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/perf-led.json

[pontia]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/castagnet-bilan.json
[coupecomplete]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/coupe-conduite.json
[raccords]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/panorama-raccords.json
[archiveslocales]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/archives-locales.zip
[resultatsnav]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/resultats-navigation.json

[duoss21]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/duo-larche.json
[couverture]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/worldcover.json
[versants]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/versants-worldcover.jpg
[allocfaune]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/allocations-faune.json

[courbeshaptiques]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/vibrations-manettes.png

[monde8]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/coupe-monde.json
[integrale11]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/coupe-integrale.json

[pausehaptique]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/vibrations-pause.json
[finhaptique]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/vibrations-resultats.json
[fnvpan]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/panorama-integrite.json

[cadence107]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/INTEGRATION-2026-11-22/cadence-larche.json

[rayonsm5]: https://github.com/M4D135/bitume/blob/main/docs/reprise/rapports/N0-MAC-20261122/rayons-larche.json
