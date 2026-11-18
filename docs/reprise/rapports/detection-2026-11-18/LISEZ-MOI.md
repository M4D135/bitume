# Détection des réglages : le test au premier lancement

18 novembre 2026, branche `fluidite/detection` (base `fluidite/integration`), BITUME 0.2.40.

Machine : MacBook Air 15 pouces, Apple M5 (10 cœurs). Écran intégré de 1710 × 1107 points en densité 2 (3420 × 2214 pixels), à 60 Hz. Navigateur : Chrome 157 avec ANGLE Metal.

D'autres agents chargeaient la machine pendant toutes les mesures, et elle n'a jamais été au repos. La charge est donnée avec chaque résultat : c'est la moyenne `uptime` sur une minute, pour 10 cœurs. Elle est allée de 5 à 82.

Les relevés de chaque essai sont dans `mesures.json` (ce dossier). Les essais F1 à F15 sont les fenêtres Chrome visibles. Les autres essais tournent dans Chrome sans interface.

## Ce qui change pour le joueur

- **Une fois par version.** Le test « Réglage automatique » tourne au premier chargement d'une version sur une machine, puis plus jamais pour cette version. Il ne revient ni au redimensionnement, ni sur un autre écran, ni aux ouvertures suivantes. On peut le relancer dans l'onglet Image.
- **Taille de l'écran entier.** Le test mesure à la taille de l'écran entier, même si la fenêtre est petite.
- **Moyenne sur le M5.** Le test y choisit Moyenne, et la course la tient. L'ancien test choisissait Légère.
- **Choix du joueur respectés.** Une détection automatique (nouvelle version) ne change que les options que le joueur n'a pas touchées depuis la précédente. L'onglet Image affiche « Recommandé : … · vos choix gardés : … ». Une détection relancée à la main applique tout.
- **Machine sans carte graphique ou très lente.** Pour un rendu logiciel, le test conclut Légère en 0,5 à 1,5 s, sans figer la page. Pour un processeur très lent, il conclut Légère en 0,5 à 5,7 s.
- **Écran bridé à 30 images par seconde.** Ce bridage vient de l'économie d'énergie. Le test le reconnaît. Le réglage choisi est appliqué, mais refait à l'ouverture suivante, deux fois au plus. L'onglet Image le signale.

## La méthode, et pourquoi

1. **Des rafales d'images.** L'ancien test (révision 2) dessinait une image à chaque rafraîchissement de l'écran, puis lisait un pixel.
   - Il mesurait donc le rythme de l'écran (16,7 ms), et non ce que coûte une image.
   - Sur le M5, il refusait Moyenne et choisissait Légère : 16,7 ms mesurés pour une limite de 10,6 ms, d'après les relevés de l'agent d'intégration.

   Le nouveau test enchaîne 2 à 4 images de course à chaque rafraîchissement, puis lit un pixel.
   - Chaque image fait deux pas de simulation des douze voitures, dessine la scène, et dessine la glace du rétroviseur au rythme de la course.
   - Le coût d'une image est la durée de la rafale divisée par le nombre d'images. Comme en course, le processeur prépare l'image suivante pendant que la carte graphique dessine.
   - Il y a trois points de vue : le cockpit au départ, puis deux vues de poursuite aux endroits les plus chargés en herbe et en bois.
2. **Deux limites.**
   - **Coût d'une image.** Il doit rester sous 80 % de la période de l'écran, soit 13,3 ms à 60 Hz.
   - **Travail du processeur.** La boucle de la course, estimée, doit rester sous la moitié de la période, soit 8,3 ms.
     - La boucle de la course pèse environ 3 fois le temps processeur d'une image du test. Sur le M5, au volet de mesures, la boucle prend 4,6 à 5,2 ms quand une image du test prend 1,6 à 1,75 ms.
     - Sans cette seconde limite, le processeur ralenti quatre fois passait Moyenne, alors que la course y rate des images.
     - Avec un rapport de 2,5, il la passait encore quand la machine était peu chargée (8,25 ms estimés). D'où le rapport de 3.
3. **Contrôles avant de bâtir le décor.** Chacun conclut Légère tout de suite, sans bâtir le décor de Moyenne.
   - **Nom du rendu logiciel** (SwiftShader, llvmpipe…). C'est la seule exception à la règle « jamais le nom du GPU ». Le temps seul ne suffit pas à le reconnaître : une passe de la sonde y prend de 1 à 14 ms selon l'essai. Une vraie carte graphique n'est jamais jugée sur son nom.
   - **Sonde.** Un petit programme de dessin tourne sur 512 × 512 pixels. Le test conclut Légère au-delà de 4 ms par passe. Sur le M5, une passe prend 0,2 à 1,2 ms.
   - **Simulation.** Le test la mesure pendant les images vides du début. Si la boucle de course estimée dépasse 16,7 ms (plus de 0,52 ms par pas), il conclut Légère. Ce résultat doit se répéter quatre images plus tard : le M5 donne 0,05 à 0,5 ms par pas selon la charge, mais il a donné une fois 0,58 ms, sous une charge de 9.
4. **Décor trop long.** Si le décor d'un palier demande plus de 3 s à bâtir, ce palier n'est pas mesuré : Légère, si c'est Moyenne.
   - La mesure dépasserait alors les 6 s de durée maximale.
   - Aucune mesure n'a accepté Moyenne quand son décor dépassait 3 s.
   - Sur le M5, ce décor prend 0,6 à 2,6 s.
5. **Chauffe.** Le test dessine six images une à une avant les rafales. Il faut deux images très lentes de suite pour juger un palier sans espoir ; une seule ne suffit pas. Le M5 a montré une image isolée de 52 ms sur Moyenne, qu'il tient.
6. **Plein écran.** Pendant le test, l'image prend la taille de l'écran entier. Depuis une fenêtre de 1440 × 757 points, Moyenne a été mesurée à 1710 × 1107 pixels et Fine à 3420 × 2214, comme en plein écran. Essais F1 à F4.
7. **Une fois par version et par machine.**
   - L'empreinte réunit :
     - la révision du test ;
     - la version du jeu, lue sur le badge du titre ;
     - la carte graphique annoncée par le navigateur (`WEBGL_debug_renderer_info`), avec sa taille de texture maximale ;
     - le nombre de cœurs.
   - La fenêtre, la densité de pixels et l'écran n'y entrent pas.
   - Le palier appris par la qualité Auto (`bitume.palier.v1`) suit la même empreinte. Une nouvelle version ou une autre machine repart donc de zéro.

## Résultats

Une « image ratée » est une image qui dépasse 1,5 période de l'écran. Les courses de vérification durent 10 s, au départ de Val-Brûlé, en vue cockpit.

### Le M5 tel quel

Fenêtres Chrome visibles. Ces essais ont tourné sur une construction intermédiaire, sans les dernières règles. Le travail du processeur a été recalculé à partir de leurs relevés, avec le rapport de 3 : 2,7 à 6,5 ms, sous la limite de 8,3 ms. Le choix reste donc le même avec la construction finale.

| Essai | Charge | Fenêtre (points) | Coût Moyenne | Coût Fine | Choix | Durée du test | Course au réglage choisi |
|---|---|---|---|---|---|---|---|
| F1 | 35 | 1440 × 757 | 9,7 ms | 25,0 ms | Moyenne | 3,0 s | 0 image ratée sur 601, pire 17,7 ms |
| F2 | 30 | 1440 × 813 | 8,8 ms | 23,3 ms | Moyenne | 2,5 s | 0 sur 600, pire 17,7 ms |
| F3 | 37 | 1440 × 757 | 9,5 ms | 25,5 ms | Moyenne | 3,1 s | 0 sur 600, pire 17,7 ms |
| F4 | 27 | 1440 × 757 | 8,0 ms | 27,3 ms | Moyenne | 3,3 s | 0 sur 600, pire 17,7 ms |
| F5 | 44 | 1710 × 1107 | 8,5 ms | 25,3 ms | Moyenne | 3,2 s | 0 sur 600, pire 17,7 ms |
| F15 | 10 | 1710 × 1107 | 10,0 ms | 23,7 ms | Moyenne | 3,2 s | 0 sur 602, pire 17,8 ms |

Le palier au-dessus, Fine, échoue de deux façons :
- **Sa mesure** (23 à 27 ms) est loin de la limite de 13,3 ms.
- **En course** (essai F6 : fenêtre de 1710 × 1107 points, image de 3420 × 2214 pixels, charge 32), il rate 276 images sur 286 (médiane 33,3 ms).

Sans interface, avec la construction finale (v3m) et les deux précédentes (v3k, v3l) :
- **Charge de 9.** Moyenne 4 fois sur 4 (coût 7,3 à 11,4 ms ; test de 2,0 à 3,2 s).
- **Charge de 13 à 44, en hausse.** D'autres travaux occupaient la carte graphique à 74–95 % avant la mesure. Moyenne 2 fois sur 8 ; les 6 autres essais donnent Légère (coût 16,7 à 22,8 ms). Ce résultat a été pris sous forte charge, et il est donné tel quel.
- **Les deux dernières corrections.** Deux Légère à tort, dues l'une à une image isolée, l'autre à une simulation lente quelques images (v3l), ont conduit à la chauffe jugée sur deux images et à la simulation confirmée.

### Processeur ralenti (émulation de Chrome)

Courses de 10 s en fenêtre visible. Le processeur n'est ralenti que pendant la course.

| Ralenti | Palier | Charge | Images ratées | Pire image |
|---|---|---|---|---|
| × 4 | Légère | 18 | 0 sur 601 | 17,7 ms |
| × 4 | Légère | 11 | 0 sur 602 | 17,7 ms |
| × 4 | Moyenne | 22 | 14 sur 579 | 351 ms |
| × 4 | Moyenne | 8 | 95 sur 473 | 566 ms |
| × 6 | Légère | 16 | 20 sur 581 | 49,9 ms |

Détections sans interface, avec le rapport de 3 (v3l, v3m) :
- **× 4** : Légère 7 fois sur 7, charge de 9 à 65.
- **× 6** : Légère 5 fois sur 5, charge de 11 à 82.

Avec l'ancien rapport de 2,5, le × 4 peu chargé passait Moyenne 2 fois sur 3 (v3k). C'est corrigé.

À × 6, même Légère rate 20 images sur 581, avec la carte graphique occupée à 91 % par d'autres travaux. Il n'existe pas de palier plus bas.

### Rendu logiciel (SwiftShader)

- **Sans interface.** Légère à chaque essai : le rendu logiciel est reconnu par son nom, avant tout décor. Le test dure 0,5 à 1,5 s avec v3k à v3m, contre 1,2 à 3,1 s avant (v3g à v3i).
- **Page jamais figée.** Pendant la mesure, aucune tâche ne bloque la page plus de 73 ms. La remise en place du décor du jeu, à la fin, la bloque 0,1 à 0,3 s.
- **Démarrage hors du lot.** Avant le test, le démarrage de la page la fige 1,9 à 6,8 s. En fenêtre visible, deux essais n'ont pas atteint le test en 20 s, à cause de ce démarrage.

### Écran bridé à 30 Hz (économie d'énergie de Chrome)

- **Bridage reconnu à chaque essai** : période de 33,3 ms.
- **Fenêtre visible** (F12, charge 29) : Légère, à titre provisoire (Moyenne à 18,0 ms).
- **Sans interface** : selon la charge, Moyenne 4 fois (7,8 à 13,3 ms, charge 5 à 20) et Légère 4 fois (charge 15 à 55, dont une fois par la sonde, à 7,1 ms).
- **Machine jamais condamnée.** Un réglage obtenu sous bridage est appliqué, puis refait à l'ouverture suivante, deux fois au plus.

## Durée du test

| Machine | Durée de l'écran « Réglage automatique » |
|---|---|
| M5, fenêtre visible (charge 10 à 44) | 2,5 à 3,3 s, médiane 3,2 s |
| M5 sans interface, charge 9 | 2,0 à 3,2 s |
| Rendu logiciel | 0,5 à 1,5 s |
| Processeur ralenti × 4 | 0,5 à 5,0 s (médiane 3,6 s), et 7,8 s une fois sous une charge de 65 |
| Processeur ralenti × 6 | 0,7 à 5,7 s |

Bâtir un décor fige la page d'un bloc (src/decor.js) : 0,6 à 2,6 s pour Moyenne sur le M5. La barre de progression s'arrête pendant ce temps.

## Ce qui reste

- **M5 sous forte charge graphique.** Quand d'autres programmes occupent la carte graphique, le M5 conclut souvent Légère (6 fois sur 8). Ce réglage reste alors pour toute la version, sauf détection relancée dans l'onglet Image. Une piste : rendre provisoire un refus de Moyenne de peu. À décider.
- **Durée au-delà de 6 s.** C'est arrivé une fois (× 4 sous une charge de 65). Le décor de Moyenne se bâtit d'un bloc et ne peut pas être interrompu (src/decor.js, hors du lot).
- **Vrai plein écran non essayé.** Le mode plein écran du navigateur n'a pas pu être obtenu dans le banc. La fenêtre a été mise à la taille de l'écran. Il est vérifié que l'image du test prend la taille de l'écran entier depuis une petite fenêtre.
- **Rendu logiciel jamais vu en fenêtre visible.**
- **Réglages calibrés sur le seul M5.**
  - Le ralentissement émulé par Chrome est irrégulier : des relevés courts sont tantôt ralentis, tantôt non.
  - Ils sont à revoir sur une vraie petite machine, par exemple david-pc ou un portable modeste.
  - Non essayés : écrans à 120 ou 144 Hz, Windows, cartes Intel, AMD ou NVIDIA, Firefox et Safari.
- **Démarrage de la page en rendu logiciel.** Il fige la page 1,9 à 6,8 s avant le test (hors du lot).
- **Outil de mesure hors dépôt.** Il pilote Chrome par son protocole de débogage, et il est resté dans le dossier temporaire de l'agent.
