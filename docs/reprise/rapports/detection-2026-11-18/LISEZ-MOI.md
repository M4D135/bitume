# Détection des réglages : le test au premier lancement

18 et 19 novembre 2026, branche `fluidite/detection` (base `fluidite/integration`), BITUME 0.2.40, test en révision 4.

Machine : MacBook Air 15 pouces, Apple M5 (10 cœurs). Écran intégré de 1710 × 1107 points en densité 2 (3420 × 2214 pixels), à 60 Hz. Navigateur : Chrome 157 avec ANGLE Metal.

D'autres agents chargeaient la machine pendant toutes les mesures. Elle n'a jamais été au repos. La charge est donnée avec chaque résultat : c'est la moyenne `uptime` sur une minute, pour 10 cœurs. Pendant la correction, elle est allée de 1,7 à 9. La carte graphique était souvent occupée avant même l'ouverture de Chrome (de 0 à 100 %, `ioreg`).

Les relevés de chaque essai sont dans `mesures.json` (ce dossier), un essai par ligne. Ceux de la révision 4 viennent en premier.

## La relecture du 18/11 et ce qui a été fait

| Constat | Ce qui a été fait | Preuve |
|---|---|---|
| C1. Page ouverte en arrière-plan : plus jamais de test après deux ouvertures | Corrigé. Le test attend que la page passe au premier plan. Caché pendant le test, il se met en pause et reprend au retour. Un onglet caché ne compte plus comme un échec. | Reproduit sur la page de la relecture (deux ouvertures en arrière-plan, puis plus de test). Après correction : deux ouvertures en arrière-plan sans rien noter, puis le test tourne au premier plan. Onglet caché pendant le test : « Test en pause », puis le test reprend et finit. Tests : `autoconfig.test.mjs`, `autoconfig-integration.test.mjs`. |
| C2. Une seule mesure, gardée pour toute la version, même prise pendant qu'un autre programme occupait la machine | Corrigé. Un palier refusé de peu (moins de 1,6 fois ses limites) rend le verdict provisoire : appliqué, puis refait à l'ouverture suivante, deux fois au plus. L'onglet Image le dit. | Une seconde instance de Chrome fait une course en Fine pendant le test : Moyenne mesurée deux fois (14,65 et 13,85 ms pour 13,33), Légère provisoire. À l'ouverture suivante, sans cette charge : Moyenne (7,45 ms), verdict gardé. |
| C3. Après le test, la qualité n'est plus « Auto » : rien ne rattrape une erreur en course | Non changé : c'est un choix à faire par David (voir plus bas). | `src/graphismes.js` : la qualité Auto coupe les images des rétroviseurs dès son premier cran. |
| C4. Moyenne acceptée juste sous la limite, puis images ratées | Corrigé. Un palier mesuré entre 85 % de ses limites et 1,6 fois ses limites est mesuré une seconde fois. Les deux séries doivent passer. Si elles se contredisent, une troisième tranche. Le rapport est corrigé (voir plus bas). | Tests de la zone grise. Dans le navigateur : Moyenne mesurée trois fois (14,3, 11,3 et 9,2 ms, retenue sur la médiane) ; Fine deux et trois fois. |
| C5. Rapport de 3 calé sur l'émulation de Chrome, et temps processeur pris en rafale | Corrigé. Le fil principal est mesuré sur douze images seules, une par rafraîchissement, comme la course. Le rapport de 3 est revu contre la course, sur le M5 et avec le processeur ralenti. Le rapport ne conclut plus rien de l'émulation seule. | Voir « Processeur ralenti ». Une vraie petite machine n'a pas été essayée. |
| C6. Le voile dure plus longtemps qu'annoncé, et la page se fige | En partie. Le rapport donne maintenant la durée vue par le joueur, du voile affiché au voile masqué. L'animation du voile et la remise en place du décor sont hors du lot : demandes à l'intégration. | Voir « Durée vue par le joueur ». |
| C7. Trace de la détection perdue : les réglages d'une détection passent pour des choix du joueur | Corrigé. Sans trace lisible, la référence est le palier (ou les valeurs d'usine) qui ressemble le plus aux six réglages actuels. | Page de la relecture : « vos choix gardés : qualité, anticrénelage, ombres, végétation, faune ». Après correction : « vos choix gardés : végétation », tout le reste passe en Légère. |
| C8. 8 262 lignes de relevés bruts dans le commit | Corrigé. `mesures.json` est résumé : 150 lignes, un essai par ligne, anciens essais compris. | Ce dossier. |
| C9. 30 Hz sous charge, 120 Hz, vrai plein écran non vérifiés | 30 Hz refait à charge plus basse. Plein écran essayé, sans succès. Pas d'écran à 120 Hz. | Voir « Écran bridé à 30 Hz » et « Plein écran ». |

## Ce qui change pour le joueur

- **Une fois par version.** Le test « Réglage automatique » tourne au premier chargement d'une version sur une machine, puis plus pour cette version. Il ne revient ni au redimensionnement, ni sur un autre écran. On peut le relancer dans l'onglet Image.
- **Onglet en arrière-plan.** Une page ouverte dans un onglet en arrière-plan attend que le joueur la regarde pour lancer le test. Si le joueur change d'onglet pendant le test, le test s'arrête et reprend à son retour.
- **Machine occupée.** Si un palier est refusé de peu, le test le refait à l'ouverture suivante, deux fois au plus. L'onglet Image le dit : « Moyenne refusée de peu, peut-être parce qu'un autre programme occupait la machine : nouvelle mesure à la prochaine ouverture. » La seconde fois : « … relancez la détection quand la machine est au repos. »
- **Taille de l'écran entier.** Le test mesure à la taille de l'écran entier, même si la fenêtre est petite.
- **Moyenne sur le M5.** Le test y choisit Moyenne, et la course la tient. L'ancien test choisissait Légère.
- **Choix du joueur respectés.** Une détection automatique ne change que les options que le joueur n'a pas touchées depuis la précédente, même si sa trace est perdue. L'onglet Image affiche « Recommandé : … · vos choix gardés : … ». Une détection relancée à la main applique tout.
- **Machine sans carte graphique ou très lente.** Pour un rendu logiciel, le test conclut Légère en moins d'une seconde. Pour un processeur très lent, il conclut Légère en 3,2 à 4,1 s.
- **Écran bridé à 30 images par seconde.** Ce bridage vient de l'économie d'énergie. Le test le reconnaît. Le réglage choisi est appliqué, puis refait à l'ouverture suivante, deux fois au plus.

## La méthode

1. **Coût d'une image : des rafales.** À chaque rafraîchissement de l'écran, le test enchaîne 2 à 4 images de course, puis lit un pixel.
   - Chaque image fait deux pas de simulation des douze voitures, dessine la scène, et dessine la glace du rétroviseur au rythme de la course.
   - Le coût d'une image est la durée de la rafale divisée par le nombre d'images. Comme en course, le processeur prépare l'image suivante pendant que la carte graphique dessine.
   - Il y a trois points de vue : le cockpit au départ de Val-Brûlé, puis deux vues de poursuite aux endroits les plus chargés en herbe et en bois.
   - Le coût doit rester sous 80 % de la période de l'écran, soit 13,3 ms à 60 Hz.
2. **Fil principal : des images seules (nouveau).** Avant les rafales, le test dessine douze images, une par rafraîchissement, sans attendre la carte graphique. C'est ainsi que la course les dessine.
   - Dans une rafale, les images se suivent d'un seul tenant. Le processeur y paie une fois ce que la course paie à chaque image. Sur le M5 : 0,8 à 1,1 ms par image en rafale, 1,2 à 1,6 ms en image seule.
   - La boucle de la course est estimée à 3 fois l'image seule du point de vue le plus chargé. Elle doit rester sous la moitié de la période, soit 8,3 ms. Moyenne n'est donc retenue que sous 2,8 ms par image seule.
   - Pourquoi 3 : voir « Processeur ralenti ». La course tient jusqu'à 2,1 ms par image seule, et rate des images dès 5,4 ms. Le rapport de 3 place la limite entre les deux, du côté prudent.
3. **Zone grise (nouveau).** Un palier dont la mesure tombe entre 85 % de ses limites et 1,6 fois ses limites est mesuré une seconde fois.
   - Les deux séries doivent passer.
   - Si elles se contredisent, une troisième série tranche, sur la médiane.
   - Une série de plus n'est faite que si elle tient dans les 6 s du test.
4. **Refus de peu provisoire (nouveau).** Un palier refusé à moins de 1,6 fois ses limites rend le verdict provisoire. Il est appliqué, puis refait à l'ouverture suivante, deux fois au plus, comme sous un écran bridé à 30 Hz.
5. **Contrôles avant de bâtir le décor.** Chacun conclut Légère tout de suite, sans bâtir le décor de Moyenne.
   - **Nom du rendu logiciel** (SwiftShader, llvmpipe…). C'est la seule exception à la règle « jamais le nom du GPU ». Une vraie carte graphique n'est jamais jugée sur son nom.
   - **Sonde.** Un petit programme de dessin tourne sur 512 × 512 pixels. Au-delà de 4 ms par passe, le test conclut Légère. Sur le M5, une passe prend 0,2 à 1,2 ms.
   - **Simulation.** Si la boucle de course estimée d'après la simulation dépasse 16,7 ms, le test conclut Légère. Le résultat doit se répéter quatre images plus tard.
6. **Décor trop long.** Si le décor d'un palier demande plus de 3 s à bâtir, ce palier n'est pas mesuré.
7. **Chauffe.** Six images une à une avant la mesure. Il faut deux images très lentes de suite pour juger un palier sans espoir.
8. **Une fois par version et par machine.** L'empreinte réunit la révision du test (4), la version du jeu (badge du titre), la carte graphique annoncée par le navigateur avec sa taille de texture maximale, et le nombre de cœurs. Le passage à la révision 4 refait le test une fois sur chaque machine. Le palier appris par la qualité Auto (`bitume.palier.v1`) suit la même empreinte.

## Résultats

Une « image ratée » dépasse 1,5 période de l'écran. Les courses durent 10 s, au départ de Val-Brûlé, en vue cockpit, rétroviseurs compris. Toutes les mesures de cette partie ont été faites sur la construction finale (révision 4), sauf mention contraire.

### Le M5 tel quel, en fenêtre visible

Douze fenêtres Chrome visibles en tout, une à la fois, 20 s au plus chacune. Fenêtre de 1710 × 846 points. Charge de 2,2 à 3,1.

| Essai | Charge | Coût Moyenne | Coût Fine | Choix | Durée du test | Voile vu | Course au réglage choisi |
|---|---|---|---|---|---|---|---|
| V1 | 3,1 | 8,9 ms | 23,9 ms | Moyenne | 2,32 s | 2,89 s | soleil : 0 image ratée sur 599, pire 18,7 ms |
| V2 | 2,8 | 8,7 ms | 22,9 ms | Moyenne | 2,30 s | 2,85 s | soleil : 0 sur 599, pire 18,7 ms |
| V3 | 2,6 | 8,7 ms | 24,5 ms | Moyenne | 2,31 s | 2,88 s | soleil : 0 sur 599, pire 18,7 ms |
| V6 | 3,0 | 7,9 ms | 23,1 ms | Moyenne | 2,28 s | 2,87 s | pluie : 0 sur 599, pire 18,7 ms |

Autres courses en Moyenne, sous la pluie, test déjà fait (V5, V7, V8, charge 2,2 à 3,1) : 0 image ratée sur 599, trois fois.

Le palier au-dessus, Fine, échoue des deux façons :
- **Sa mesure** (22,9 à 24,5 ms) dépasse de loin la limite de 13,3 ms. Fine est mesurée à 3420 × 2214 pixels, la taille de l'écran entier.
- **En course** (V4, charge 2,3, image de 3420 × 1692 pixels) : 161 images ratées sur 400, médiane 17,9 ms.

### Le M5 sans interface, à la taille de l'écran entier

Image de 1710 × 1107 pixels en Moyenne, comme en plein écran.

- **Charge de 4,7 à 5,2**, carte occupée de 71 à 100 % avant l'essai : Moyenne 3 fois sur 3 (7,9 à 8,0 ms). Courses en Moyenne : soleil 2, 0 et 0 images ratées ; pluie 18, 0 et 2.
- **Charge de 2,1** : pluie 0 et 0, soleil 0. Légère sous la pluie : 0.
- **Charge de 5,9**, carte occupée par d'autres agents, courses en alternance sous la pluie : Légère 0, Moyenne 63, Légère 0, Moyenne 31.

Ce dernier résultat a été pris sous forte charge, et il est donné tel quel. Quand un autre programme occupe la carte graphique pendant la course, Moyenne peut rater des images sous la pluie, à la taille de l'écran entier, même mesurée à 9,5 ms. La limite de 80 % ne couvre pas ce cas.

### Processeur ralenti (émulation de Chrome)

Le processeur est ralenti pendant toute la séance : détection et course. Sans interface, Moyenne à la taille de l'écran entier. « Image seule » : temps du fil principal mesuré par le test.

| Ralenti | Charge | Image seule | Choix | Course en Moyenne, soleil | Boucle de la course (50e / 95e centile) |
|---|---|---|---|---|---|
| × 1 (M5) | 4,7 à 5,2 | 1,2 à 1,6 ms | Moyenne (3 sur 3) | 2, 0, 0 ratées | 1,7–1,8 / 2,6–3,5 ms |
| × 2 | 3,1 à 3,8 | 1,9 et 2,1 ms | Moyenne (2 sur 2) | 0, 0 ratée | 1,9–2,2 / 2,7–3,4 ms |
| × 3 | 3,0 à 3,3 | 5,4 et 6,2 ms | Légère (2 sur 2) | 24, 23 ratées | 4,8–5,2 / 7,0–10,0 ms |
| × 4 | 3,6 à 5,1 | 5,8 ms, puis décor de 3,7 s | Légère (2 sur 2) | 12, 43 ratées | 6,2–7,4 / 8,8–13,1 ms |
| × 6 | 6,1 | décor de 3,9 s | Légère | 43 ratées | 10,2 / 16,1 ms |

Courses en Légère, au palier choisi : 0 image ratée à × 4 et à × 6.

En fenêtre visible (charge 2,1) :
- **× 4** : Légère, à titre provisoire. Moyenne refusée de peu par le fil principal : estimation de 10,6 puis 8,9 ms pour une limite de 8,3. Test de 3,6 s. Course en Légère : 0 image ratée sur 599.
- **× 6** : Légère (décor de 3,0 s). Test de 3,2 s. Course en Légère : 0 sur 599.

Ce que ces mesures disent, et ne disent pas :
- L'image seule suit la boucle de la course, du M5 au ralenti quatre fois : la boucle de la course vaut 0,84 à 1,4 fois l'image seule, au 50e centile.
- Le ralentissement émulé est irrégulier. Ralenti trois fois, Moyenne a coûté 22 et 25 ms ; quatre fois, 13 ms. Le rapport du 18/11 annonçait 14 et 95 images ratées à × 4 ; la relecture en a trouvé 0 ; ces mesures en trouvent 12 et 43. Aucune conclusion n'est tirée de l'émulation seule : le test et la course sont comparés dans le même essai.
- Deux autres façons de ralentir le processeur ont été essayées et écartées : les cœurs d'efficacité (`taskpolicy -c background`) et la classe `utility`. Elles brident aussi l'horloge des images : Légère y tournait à une image toutes les 50 à 200 ms (médiane).
- **Une vraie petite machine reste à essayer** (david-pc, un portable modeste).

### Rendu logiciel (SwiftShader)

En fenêtre visible (charge 1,7) : Légère, reconnue à son nom, en 0,79 s. Voile de 0,89 s ; la page ne s'arrête jamais plus de 248 ms pendant le voile. Une tâche de 1,2 s fige la page au démarrage, avant le test (hors du lot).

### Écran bridé à 30 Hz (économie d'énergie de Chrome)

En fenêtre visible, charge 2,2, parmi les plus basses de la séance : période de 33,3 ms reconnue, Moyenne (9,1 ms), réglage provisoire, première tentative. L'onglet Image affiche : « Écran bridé à 30 images par seconde pendant le test (économie d'énergie ?) : nouvelle mesure à la prochaine ouverture. »

### Plein écran

Le vrai plein écran du navigateur n'a pas été obtenu :
- la demande au navigateur (`Browser.setWindowBounds`) n'a donné qu'une fenêtre agrandie (1710 × 989 points) ;
- la demande de la page (`requestFullscreen`), après un clic envoyé par le protocole de débogage, a été refusée (« not granted »).

Ce qui est vérifié : depuis une fenêtre de 1710 × 846 points, le test mesure Moyenne à 1710 × 1107 pixels et Fine à 3420 × 2214, la taille de l'écran entier. Sans interface, à la taille de l'écran entier, la course en Moyenne tient (voir plus haut), sauf sous la pluie quand d'autres programmes occupent la carte.

### Écrans à 120 ou 144 Hz

Non essayés : pas d'écran de ce type sur cette machine. Le budget est fixé à 60 images par seconde ; la période de l'écran n'est relevée que pour mémoire.

## Durée vue par le joueur

Durée du voile « Réglage automatique », de son apparition à sa disparition. Elle compte la remise en place du décor du jeu, que la durée du test (`duree` dans la trace) ne compte pas.

| Machine | Durée du test | Voile vu | Arrêts de la page pendant le voile |
|---|---|---|---|
| M5, fenêtre visible (V1, V2, V3, V6, charge 2,6 à 3,1) | 2,28 à 2,32 s | 2,85 à 2,89 s, médiane 2,88 s | 0,52 à 0,54 s au début (décor de Moyenne) ; 0,2 s (décor de Fine) ; 0,53 à 0,58 s à la fin (remise en place) |
| M5 sans interface, charge 4,7 à 5,9 | 2,7 à 3,6 s | 4,0 à 4,5 s | jusqu'à 1,4 s |
| Processeur ralenti × 4, fenêtre visible | 3,6 s | 3,9 s | 2,0 s (décor de Moyenne) |
| Processeur ralenti × 6, fenêtre visible | 3,2 s | 3,7 s | 3,4 s (décor de Moyenne) |
| Rendu logiciel, fenêtre visible | 0,79 s | 0,89 s | 0,25 s |
| 30 Hz, fenêtre visible | 3,56 s | 4,41 s | 0,87 s |

La relecture avait relevé des voiles de 3,1 à 4,7 s (médiane 3,7 s), sous une autre charge.

Bâtir un décor fige la page d'un bloc (`src/decor.js`), et la barre de progression s'arrête pendant ce temps. Deux demandes à l'intégration :
- donner au voile une animation CSS (`transform` ou `opacity`) qui tourne même quand la page est figée ;
- étaler la remise en place du décor sur plusieurs images (zone de l'agent du voile).

## Corrections du rapport du 18/11

- **« 0 image ratée en 6 courses » au palier choisi.** La relecture a trouvé 1, 17 et 0 images ratées en Moyenne sur la construction du 18/11. Avec la révision 4, en fenêtre visible : 0 image ratée en 7 courses de Moyenne (3 au soleil, 4 sous la pluie), charge de 2,2 à 3,1. Sans interface, sous une charge plus forte et à la taille de l'écran entier : de 0 à 18 images ratées, et jusqu'à 63 sous la pluie quand d'autres programmes occupaient la carte.
- **« Ralenti 4 fois : Moyenne rate 14 et 95 images ».** Retiré. L'émulation est irrégulière (voir plus haut).
- **« 2,5 à 3,3 s » de test.** C'était la durée du test. Le joueur voit le voile environ 0,6 s de plus (voir « Durée vue par le joueur »).

## Décisions pour David

1. **Qualité Auto en course après le test (C3).** Aujourd'hui, le test écrit une qualité fixe (Légère, Moyenne ou Fine). Le régulateur de la qualité Auto ne joue alors plus : rien ne baisse si la course rate des images, rien ne monte si la machine était occupée pendant le test.
   - Proposition de la relecture : garder la qualité Auto, avec le palier mesuré comme départ et comme plafond.
   - Ce qu'elle coûterait : la qualité Auto coupe les images des rétroviseurs dès son premier cran (`src/graphismes.js`, `TABLE_GOUVERNEUR`). Sur le M5, la Moyenne du test garde les rétroviseurs vivants, et la course la tient. Avec cette proposition, le M5 jouerait sans eux.
   - Choix possibles : (a) garder la qualité fixe, comme aujourd'hui ; (b) passer à la qualité Auto plafonnée, sans images des rétroviseurs ; (c) changer d'abord la qualité Auto pour qu'elle garde les rétroviseurs à son premier cran (hors du lot : `src/qualite.js` et `src/graphismes.js`).
2. **Pluie et carte occupée.** Le test mesure une pluie légère. Quand d'autres programmes occupent la carte graphique, Moyenne peut rater des images sous la pluie à la taille de l'écran entier, alors que Légère tient. Les choix (1) b ou c serviraient aussi de filet dans ce cas.
3. **Une nouvelle mesure à l'ouverture suivante.** Un refus de peu, ou un écran bridé à 30 Hz, fait revenir le test une fois de plus (deux fois au plus). C'est une exception à « une fois par version », demandée par la relecture.

## Ce qui reste

- **Vraie petite machine.** Le rapport de 3 n'est vérifié que sur le M5 et avec l'émulation de Chrome. À mesurer sur david-pc ou un portable modeste.
- **Vrai plein écran**, **écrans à 120 ou 144 Hz**, Windows, cartes Intel, AMD ou NVIDIA, Firefox et Safari : non essayés.
- **Durée au-delà de 6 s.** Le décor de Moyenne se bâtit d'un bloc et ne peut pas être interrompu (`src/decor.js`, hors du lot). Les essais avec le processeur ralenti l'arrêtent à 3 s.
- **Démarrage de la page en rendu logiciel** : une tâche de 1,2 s avant le test (hors du lot).
- **Outil de mesure hors dépôt.** Il pilote Chrome par son protocole de débogage et reste dans le dossier temporaire de l'agent.
