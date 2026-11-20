# BITUME — demandes vidéo arcade, hélicoptères et drones

Demandes de David du **20 novembre 2026**, consignées à sa demande explicite de les pousser sur GitHub pour ne rien oublier. Cette fiche s'ajoute au programme existant. **Les six évolutions sont demandées et planifiées ; leur présence dans cette fiche ne signifie pas qu'elles sont déjà livrées.**

## Source et examen effectué

- [Vidéo transmise par David, Rozz Games / Super Polygon Grand Prix](https://x.com/games_rozz/status/2123620848644821437/video/1).
- [Média officiel associé à ce statut](https://video.twimg.com/amplify_video/2123620697851174912/vid/avc1/1920x1080/gjQFKJ2AGDswwwrx.mp4), retrouvé dans les métadonnées publiques de X.
- Extrait de **18,85 s**, 1920 × 1080 ; **189 images extraites à environ 0,1 s**, avec inspection détaillée des séquences de transition et des panneaux. Empreinte SHA256 du MP4 : `9e2f3f8c52e6c16cd18325b7b7007b41362ab7bd3c785d0069c643835c2d25e7`. L'audio de la référence n'a pas été analysé.
- Les fichiers vidéo et les images extraites servent à l'étude locale. Aucun de ces médias n'entre dans le jeu ou le dépôt : les réalisations BITUME restent procédurales.

| Repère | Observation vérifiée | Demande BITUME correspondante |
|---|---|---|
| 3,3–3,8 s | Passage continu poursuite → cockpit, HUD stable et course continue | Transitions entre vues |
| 10,3–10,9 s | Passage cockpit → poursuite ; à 10,5 s, le casque masque largement la chaussée | Trajet de caméra contrôlé sur tous les instants intermédiaires |
| 14,0–14,5 s | Nouveau passage poursuite → cockpit, aileron et casque en gros plan | Même voiture et même pilote pendant tout le changement de vue |
| 6–7,6 s et 16,2–17,8 s | Grosses flèches jaunes qui clignotent sur des disques rouges, répétées le long de la courbe | Signalisation directionnelle animée |
| Plusieurs instants | Scène inclinée avec HUD horizontal | Sensation de dévers et virages inclinés |
| 0–4,5 s et 8–11 s | Bandeaux graphiques lumineux près des stands et écran sur un portique | Bandeaux LED portant des informations utiles |
| 0–3,4 s | Hélicoptère rouge/blanc au-dessus des stands et de la ligne droite | Appareils visibles qui survolent et accompagnent la course |

La vidéo montre une inclinaison de la scène, mais ne permet pas de déterminer la part du roulis caméra et celle d'un véritable dévers physique. Les bandeaux observés portent surtout textes et logos : l'affichage d'informations de course est la demande de David pour BITUME. Aucun drone n'a été identifié avec certitude dans l'extrait ; les drones constituent sa demande complémentaire, avec réemploi de METAL.

## 1. Transitions continues entre les vues

**Demande :** reprendre l'effet de déplacement entre vue extérieure et vue intérieure, au lieu d'un changement de point de vue brutal.

- Faire voyager la caméra entre poursuite, arceau et cockpit en conservant une cible lisible vers la route. La demi-seconde observée sert de point de départ à régler, pas de constante imposée.
- Conserver exactement le même véhicule, les mêmes dimensions, l'assise, le pilote et les commandes. Seuls la caméra et les niveaux de détail cohérents changent.
- Contrôler le trajet complet par rapport au casque, à l'arceau, à l'aileron et à la coque. La référence occulte la route pendant certains passages ; BITUME doit préserver sa lisibilité pendant le déplacement.
- Conserver direction, accélération, freinage, regard arrière et événements de course pendant la transition. Un nouvel appui doit reprendre la transition depuis la pose actuelle, sans retour à une ancienne pose ni saut.
- Lisser position, orientation et champ sans modifier la préférence de champ mémorisée. Garder l'ATH stable et raccorder progressivement les rétros et les effets d'eau à la vue effective.
- Traiter séparément J1 et J2, les deux dispositions d'écran partagé et le portrait. Respecter le mouvement réduit et les réglages de secousses ; conserver une option de transition immédiate.

**Acceptation :** captures et mesures pendant tout le trajet, en braquage, en dévers, à basse et haute vitesse, près d'un mur et sous un abri ; route et commandes utilisables, aucune traversée visible des pièces, aucun état caméra partagé entre joueurs. Physique p15 conservée pour ce lot visuel.

## 2. Virages inclinés et raccords de dévers

**Demande :** enrichir les circuits avec des virages relevés et une sensation claire d'inclinaison.

- Étudier des dévers favorables progressifs sur des courbes choisies ; conserver le tracé en plan, les identifiants et les graines des circuits existants, sauf demande distincte.
- Accorder chaussée, vibreurs, accotements, glissières et contacts des roues. Les surfaces affichées et les triangles utilisés par PhysX doivent décrire le même dévers.
- Soigner les transitions d'entrée et de sortie pour éviter marches, cassures de normale, châssis qui accroche et changements de charge brusques.
- Distinguer le roulis visuel réglable de la caméra du véritable changement de chaussée. Une image inclinée ne qualifie pas le dévers physique.
- Contrôler voiture joueur, IA, pneus, pluie, vitesse de référence, trajectoires et freinage. Vérifier particulièrement Haut-Col et Route-des-Cimes.
- Un changement réel des surfaces de conduite ouvre un lot physique et incrémente la version depuis celle alors publiée ; les records et fantômes restent séparés. Ne pas introduire ces changements dans le correctif p15 en cours.

**Acceptation :** continuité géométrique et contacts PhysX, roulage à plusieurs vitesses avec les IA, comparaison sec/mouillé, absence d'accrochage aux raccords ; validation de l'image depuis cockpit et poursuite.

## 3. Panneaux de virage clignotants

**Demande :** ajouter des panneaux très lisibles qui annoncent le virage et s'animent comme dans la référence.

- Utiliser le vrai sens et la difficulté de `B.virages.planifier`, ainsi que les repères de freinage déjà présents. Positionner les annonces avant le freinage, puis des répétitions cohérentes le long des courbes importantes.
- Produire les flèches et panneaux par le code, dans le style propre à BITUME. Maintenir une silhouette directionnelle lisible entre deux phases lumineuses.
- Donner un rythme commun aux panneaux d'un même virage, à partir de l'horloge de course. Le cycle apparent de la vidéo est voisin de 0,5 s ; intensité et rythme de BITUME restent à régler visuellement.
- Garder des entrées et sorties lisibles dans les enchaînements. Le panneau d'une courbe suivante ne doit pas donner une instruction contradictoire pendant la courbe courante.
- Conserver les panneaux passifs sur les profils modestes et en mouvement réduit ; simplifier la lumière avant la direction utile. Lisibilité de jour, de nuit, sous pluie et dans les deux vues.
- Préparer géométrie et états avant départ ; éviter une lumière dynamique par diode, le clignotement d'objets complets et les créations de meshes pendant la course.

**Acceptation :** sens conforme au circuit, distances d'annonce mesurées, panneaux hors du passage des voitures, phase identique dans les vues et les rétros, coût borné et aucune perte de repère lorsque l'animation est réduite.

## 4. Bandeaux LED et informations intégrées à la piste

**Demande :** des bandeaux et écrans lumineux affichant des informations, notamment près des stands, des tribunes et des portiques.

- Construire une matrice de caractères et pictogrammes procédurale, sans police téléchargée ni image externe. Préparer la grille au chargement et changer le contenu seulement lorsqu'il évolue.
- Prévoir des messages français courts : nom du circuit ou du secteur, tour en cours, dernier tour, drapeau, incident local, ouverture/entrée des stands, météo et piste humide.
- Pour une position ou un écart, préciser le pilote concerné. En écran partagé, les panneaux physiques du monde affichent un état commun de la course ; les messages personnels restent dans l'ATH de chaque joueur.
- Définir une priorité : informations de sécurité et de direction de course, puis progression, puis ambiance. Borner la longueur, la durée et le rythme ; réserver les défilements aux messages secondaires.
- Garder les panneaux au bon niveau de luminosité de nuit et dans les rétros. En qualité légère, réduire la densité des points et la cadence des changements en conservant le message utile.
- Reprendre l'idée des portiques et de l'animation des abords. Les noms, logos et compositions restent propres à BITUME.

**Acceptation :** message conforme à l'état réel de course, français lisible à distance utile, aucun message contradictoire J1/J2, pas de reconstruction de scène à chaque image ; coûts de préparation, mémoire et rendu mesurés.

## 5. Hélicoptères visibles qui accompagnent la course

**Demande :** voir de véritables hélicoptères survoler la course et suivre le peloton.

- Créer un modèle procédural de retransmission : fuselage arrondi, verrière, patins, queue, rotor principal, rotor anticouple et nacelle caméra.
- Prévoir des passages au-dessus des stands, des suivis latéraux et des plans plus lointains. Éviter une présence collée constamment au centre de la vision du joueur.
- Préparer des trajectoires continues au-dessus du terrain **et** des structures. Prévoir les arbres, ponts, tunnels, galeries et le relief de Route-des-Cimes ; l'appareil poursuit son vol quand une voiture entre sous un abri.
- Les rotors, oscillations et inclinaisons suivent le temps de course. Un même appareil conserve la même position dans les vues J1/J2, la démo et les rétros.
- Ajouter ensuite un son rotor synthétique spatial et atténué par la distance et les abris, avec moteur de voiture et annonces toujours audibles.
- La caméra `cameraHelico` actuelle de BITUME est un point de vue de démo. Elle ne constitue pas un modèle d'hélicoptère déjà livré.

**Acceptation :** modèle visible et cohérent dans les différentes vues, trajets sans traversée du relief ni apparition brutale, pause/reprise correctes, préchargement et niveaux de détail qualifiés. Premier lot visuel sans souffle ni collision agissant sur les voitures, donc p15 conservée.

## 6. Drones de course issus de METAL

**Demande explicite :** réutiliser les assets de notre jeu METAL pour ajouter des drones à BITUME.

Référence source vérifiée : **METAL main `747dc3179a4c58bae24c699b0bafe6adaeab156d`**.

| Source METAL | Réemploi identifié |
|---|---|
| [src/avatars.js — MetalAvatars.drone](https://github.com/M4D135/METAL/blob/747dc3179a4c58bae24c699b0bafe6adaeab156d/src/avatars.js) | Corps, quatre rotors carénés, pales alternées, optique, oscillation et inclinaison de vol |
| [src/actors.js — drone de FActors.build](https://github.com/M4D135/METAL/blob/747dc3179a4c58bae24c699b0bafe6adaeab156d/src/actors.js) | Nacelle, antenne, patins et trois niveaux de détail |
| [src/audio.js — motor:fan](https://github.com/M4D135/METAL/blob/747dc3179a4c58bae24c699b0bafe6adaeab156d/src/audio.js) | Principe de souffle et modulation synthétiques ; le son aérien reste à créer et à écouter |

- Modèles construits par le code avec des primitives FERRO : aucun fichier de modèle, texture ou son à importer. Extraire les générateurs utiles avec leur provenance ; garder le FERRO canonique de BITUME.
- Adapter le drone en appareil de prise de vues : conserver corps, rotors, optique et patins, remplacer les armes par une nacelle de télévision. Les systèmes de combat, HUD et conduite de METAL ne font pas partie du portage.
- Comptage des générateurs existants : drone joueur **40 objets** en riche et **31** en léger ; drone ennemi **49 / 16 / 6 objets** suivant le niveau de détail. Ces nombres ne sont ni des draw calls ni des FPS.
- METAL utilise FERRO 0.3.3, BITUME 0.3.15 au point d'étude. Les primitives nécessaires sont présentes. Le portage garde le moteur BITUME et contrôle les matières dans son rendu réel.
- Pour une forme METAL inchangée : `yawMETAL = capBITUME + π/2`. Neutraliser l'ajout implicite de 1,42 m et de l'oscillation à la hauteur d'entrée du générateur joueur ; l'API dérivée reçoit une altitude de fuselage explicite.
- Les générateurs d'origine créent des objets à l'appel. BITUME doit réserver les formes, palettes et pools avant départ, puis mettre à jour les transformations en place.
- Prévoir des suivis latéraux et de courts passages de tournage ; même trajectoire dans toutes les vues, sans gêner le point de corde ni les rétros. Les drones complètent les hélicoptères avec une présence plus proche et plus discrète.

**Acceptation :** provenance conservée, silhouette et rotors reconnus, LOD cohérents, absence de création d'objets au premier passage, trajectoires identiques à temps égal et coût mesuré avec/sans appareil. Aucun modèle d'hélicoptère n'a été retrouvé dans les sources METAL examinées ; sa création reste un travail distinct.

## Raccords et petits lots

Les interfaces ci-dessous sont des propositions à implémenter, pas des fonctions annoncées livrées.

| Sous-lot | Propriétaire / raccord | Condition de sortie |
|---|---|---|
| C0 puis C1 : trajet caméra et branchement | 00, `src/jeu.js` ; coordination avec 01 pour l'enveloppe du pilote | Dégagement contrôlé pendant le trajet complet et captures du HTML exact |
| S0 : panneaux directionnels | 04 pour placement/décor, 00 pour horloge ; accord de périmètre avant édition | Sens, distances et rythme qualifiés ; profils modestes conservés |
| L0 : matrice LED, puis états de course | Nouveau module à attribuer explicitement ; 00 pour événements et préparation | Contenu correct, mise à jour bornée et lisibilité |
| A0 : extraction drone, puis A1 : hélicoptère | Nouveau `src/aeriens-course.js` proposé, propriétaire à réserver ; 00 pour raccords, 01 pour son, 02 pour coûts | Pools, trajectoires et LOD vérifiés, puis captures des deux joueurs |
| D0 : étude de dévers, puis lot physique | 04 et coordination conduite/00 | Géométrie/PhysX/IA qualifiés et version physique séparée si modifiée |

Pour les aériens : préparation avant départ, graine propre sans consommation du hasard de course, une mise à jour commune avant J2/J1, sélection et LOD propres à chaque vue. Préserver les objets utiles aux rétros même hors de la caméra principale. Les budgets et nombres d'appareils restent des objectifs à mesurer ; aucun gain ou FPS Xbox/Intel n'est acquis par cette étude.

## Demandes précédentes à préserver

Cette fiche ne remplace ni ne clôt les travaux suivants :

- Cockpit commun intérieur/extérieur, assise basse, bras et coudes naturels, mains/commandes/rétros dégagés et chaussée lisible.
- Pluie en cockpit, poursuite et derrière l'arceau ; quatre forces, abondance variable, impacts avant écoulement, évacuation selon vitesse, perles sur les véhicules et pluie visible depuis les abris.
- Troll : un bouton pour le geste et le klaxon choisis par joueur ; IA aléatoires et réactions aux dépassements ; les limites réseau connues restent suivies.
- Menu arcade, vrai tracé 3D tournant, navigation manette, clavier/tactile et choix indépendants J1/J2 ; aperçus cachés arrêtés.
- Quatre saisons sur neuf circuits, matières du terrain et des montagnes, détail des abords, bâtiments et stands.
- Optimisation des configurations modestes : préparation CPU/GPU, mémoire, pools, géométrie, visibilité/occlusion et importance selon vitesse/vue ; étude des reflets/rayons séparée, FERRO canonique.
- Physique et collisions p15 acquises, couverts et Route-des-Cimes, sources Monaco/Marseille, Baïkal et autres destinations déjà inscrites.

Voir [FILE-TRAVAIL](FILE-TRAVAIL.json), [répartition parallèle](PARALLELE-2026-11-20/README.md), [demandes arcade/performance/Troll](DEMANDES-ARCADE-PERFORMANCE-TROLL-2026-11-20.md) et [programme autonome](CONTINUATION-AUTONOME-2026-11-19.md).

La qualification du correctif cockpit/pluie 0.2.70 suit la [PR #44](https://github.com/M4D135/bitume/pull/44). Les quatre dépendances de bancs CI ont été corrigées et leurs 97 contrôles ciblés passent ; la CI complète et les captures du candidat exact décident de sa publication. L'alerte de construction du décor Val-Brûlé, 152 ms observés pour un seuil strict inférieur à 150 ms, reste ouverte. Aucun de ces états n'est fermé par la présente publication documentaire.
