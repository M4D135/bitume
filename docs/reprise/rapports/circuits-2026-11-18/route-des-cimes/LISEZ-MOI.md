# Route-des-Cimes, le huitième circuit — 18 novembre 2026

**Branche locale circuits/lot22, BITUME 0.2.40 : rien n'est poussé ni mis en ligne.**

## Ce qui est fait

### Le circuit

- Le jeu construit un circuit dessiné : `B.circuit.creer(graine, { partition })`. Les partitions sont des données, dans `src/partitions.js`.
- La validation accepte une pente au-delà du plafond du thème (10 % en montagne) seulement dans une rampe déclarée : le Mur, jusqu'à 30 %.
- Route-des-Cimes est au catalogue en huitième position : identifiant `route-des-cimes`, graine 181, thème montagne, « Montagne · grande route des cols ».
- Longueur 9 698 m, dénivelé 270 m, pentes de −10 % à +30 %, 312 m au-delà de 20 %, rayon mini 32 m.
- Deux tours par défaut (environ 6 min de course). Le nombre de tours choisi est gardé pour ce circuit ; les sept autres partagent toujours le même réglage. La démo y fait deux tours.
- Les sept circuits d'avant n'ont pas changé d'un bit : l'empreinte SHA-256 de leur tracé et de leur décor, en Fine, Moyenne et Légère, est la même avant (commit ff1f986) et après (commit dad2a37). Outil : `tools/empreinte-circuits.mjs`.
- Dans `src/jeu.js`, les retouches se limitent au catalogue, à la création du circuit, au trait du plan, aux tours de la démo et au nombre de tours par circuit. `src/index.html` n'est pas touché.

### Le Mur et les crêtes

- Crête du Mur corrigée : la bascule est allongée (100 m à 24 %, 110 m à 15 %, 100 m à 7 %).
- À la vitesse de référence de l'étude (p10), la crête du Mur allège de 0,34 g et le pont de 0,39 g (règle : 0,4 g au plus).
- Aux vitesses roulées par l'IA du joueur, la charge la plus basse du tour est 0,634 g (sur le pont de la Gorge, 230 km/h), et 0,672 g sur la crête du Mur (203 km/h).
- Arrêtée à 29 % (2 480 m) puis plein gaz, la voiture est à 64 km/h en 2 s, 113 km/h en 4 s, et passe la crête (2 924 m). Pareil depuis 15 %, 18 % et 25 %.

### La course

- Les rivaux visent la vitesse de référence p9, celle de la conduite actuelle. La référence p10 de l'étude compte sur l'appui d'un creux que la conduite actuelle ne donne pas : au pied du Mur, elle vise 10 km/h de trop.
- Sur 5 courses de 12 voitures et 2 tours (difficulté 2) : 19 sorties de piste en tout, dont 8 sans contact dans les 2 s avant, toutes de voitures touchées plus tôt (adhérence de 92 à 99 %).
- Au pied du Mur (2 250 à 2 450 m), sur ces 5 courses : 2 sorties avec p9, toutes deux 0,8 s après un contact ; 14 avec p10, dont 11 sans contact juste avant.
- Pour 10 km de course : 2,0 sorties sur Route-des-Cimes, 2,4 sur Val-Brûlé, 1,1 sur Cap-Séquoia, 0,8 sur Port-Sable, 0,6 sur Haut-Col, Roche-Fauve et Brume-de-Jade, 0 sur Lande-Noire.
- Aucune voiture abandonnée ; toutes bouclent au moins un tour. Tout le monde monte le Mur : vitesse la plus basse dans le Mur de 35 à 99 km/h selon les voitures (35 km/h pour une voiture sortie juste après un contact), 207 à 214 km/h en haut.
- En difficulté 0 et 1 (4 courses) : 1 à 9 sorties par course, aucun abandon.
- Records et fantômes : rangés sous l'identifiant `route-des-cimes`. Un fantôme n'est relu que pour la même longueur de piste.

### Le jeu en ligne

- Chaque machine construit le même tracé. Test : sin, cos, tan, atan, atan2, asin, acos, hypot, pow, exp et log faussées d'un dernier bit. Le nombre de points, les vibreurs, les séquences, le tunnel et les stands restent identiques ; les autres valeurs bougent de moins d'un millionième (2,7e-10 au plus).

### L'image

- Tunnel du Rocher : 305 m, construit par le tunnel actuel du jeu (éclairé, vue cockpit vérifiée).
- La galerie des Avalanches (300 m), le tunnel des Échelles (170 m), le pont de la Gorge, les bords (vide, muret, arbres) et les sept lieux sont gardés dans les données, pas encore construits.
- Plan de l'affichage : le trait s'amincit selon l'écart entre les deux portions de piste les plus proches (69 m dans les Lacets). Les lacets se lisent en zigzag sur le petit plan.
- Caméras de la démo : 1 371 images sur Route-des-Cimes, en plans hélico, télé, orbite, roue, sol, poursuite et arrière ; aucune caméra sous le terrain. Après deux tours, la démo passe au circuit suivant.
- Dans le tunnel, les caméras hors piste passent en poursuite et les postes télé restent dehors (règles déjà là pour Haut-Col).
- Budget de dessin : pour un circuit dessiné, chaque morceau du décor (chaussée, tuile de terrain, lot d'objets près de la piste et au loin) s'agrandit dans le rapport du tour à 5,2 km (× 1,87 ici). Rien n'est retiré ni coupé à distance. Les huit captures, reprises après ce changement, n'ont pas bougé (écart moyen 0,02 sur 255 au plus).

### Les tests

- Tests ajoutés : `verifications/route-des-cimes.test.mjs` (10 vérifications) et `verifications/route-des-cimes-course.test.mjs` (4 vérifications, 5 s).
- Vérifiés par mutation : neuf changements volontaires (Mur à 31 % ou à 60 %, plafond de pente levé, rampe sans limite, rivaux sur p10, 3 tours au catalogue, second tunnel devenu galerie, moteur à 30 %, crête du pont plus vive) font chacun échouer un des deux tests.
- La suite complète passe : 81 fichiers, aucun échec.

## Ce qui se voit

Captures du dossier `captures/`, regardées une à une :

- Départ : portique, tribunes, stands, mais de grands murs gris derrière.
- Bois Noir : pas de forêt dense, un mur gris en face.
- Le Mur : la rampe monte bien, des sapins de chaque côté.
- Les Lacets : le terrain recouvre la branche du dessus, on n'en voit que la glissière.
- Le Balcon : pas de vide à gauche, un plateau gris.
- Le col : un plateau blanchâtre (couleur de neige au-dessus de 250 m), ni lac ni refuge.
- Le pont : pas de pont, la route seule devant un mur gris.
- Virage du Vide : pas de vide, une pente d'herbe et un mur gris.

## Ce qu'il manque pour des lieux exceptionnels

Par importance, chacun avec son sous-lot :

- Un terrain de montagne qui suit la vallée et le cirque au lieu de murs gris (sous-lot C).
- Des branches de lacets dégagées, chacune à sa hauteur (C).
- La neige seulement plus haut, la roche et l'alpage au col (C).
- Les bords construits : vide et parapet au Balcon et au Virage du Vide, murets des Lacets, sapins serrés à 3 m du Bois Noir (sous-lot D).
- Les lieux : lac et refuge du col, gorge et cascade sous le pont (D).
- Les passages couverts : galerie, second tunnel, pont en arche.
- Le zoom du plan sur les Lacets.

## Mesures

Budget de rendu en six poses par tour : `tools/budget-circuits-page.js` par `tools/page-essai.mjs`, vue cockpit, rivaux envoyés à l'autre bout du tour, Chrome sans fenêtre, 1440×900, Apple M5. Chaque nombre est le plus grand des six poses ; entre parenthèses, avant le budget de dessin.

| Palier | Appels de dessin, Route-des-Cimes | Triangles, Route-des-Cimes | Appels, le plus lourd des sept | Triangles, le plus lourd des sept | Construction, Route-des-Cimes | Construction la plus longue des sept |
|---|---|---|---|---|---|---|
| Fine | 306 (370) | 3 035 965 | Port-Sable 422 | Haut-Col 4 262 655 | 456 ms | Haut-Col 443 ms |
| Moyenne | 236 (303) | 1 596 934 | Port-Sable 391 | Haut-Col 2 241 869 | 462 ms | Val-Brûlé 460 ms |
| Légère | 136 (215) | 271 727 | Cap-Séquoia 162 | Haut-Col 308 817 | 157 ms | Brume-de-Jade 189 ms |

À chaque palier, la vue la plus chargée de Route-des-Cimes reste sous celle du circuit actuel le plus lourd, en appels de dessin comme en triangles. Aucune création d'objet GL pendant 300 images de course, aux trois paliers, sur les huit circuits. Les temps de construction (médiane de 3) sont indicatifs : la machine était chargée (Port-Sable en Fine : 329 à 632 ms selon la série).

Balayage serré : une pose tous les 200 m en Légère, tous les 400 m en Moyenne et en Fine. Six poses peuvent manquer la vue la plus chargée ; ce balayage la cherche mieux.

| Palier | Appels, Route-des-Cimes | Appels, Haut-Col | Triangles, Route-des-Cimes | Triangles, Haut-Col |
|---|---|---|---|---|
| Fine | 442 | 473 | 4 071 989 | 4 118 719 |
| Moyenne | 390 | 417 | 2 136 133 | 2 153 509 |
| Légère | 158 (184 au premier essai du budget) | 163 | 275 807 | 307 325 |

Haut-Col est le plus lourd des sept sur ce balayage (mesurés aussi : Port-Sable aux trois paliers, Val-Brûlé en Fine et en Moyenne, Cap-Séquoia en Légère). En Fine et en Moyenne, les triangles de Route-des-Cimes restent juste sous ceux de Haut-Col (1,1 % et 0,8 % de moins).

## Questions pour David

1. Garder la pointe à 30 % du Mur ? (oui)
2. Deux tours par défaut ? (oui)
3. Quand la conduite p10 arrivera (lot 17), faire viser p10 aux rivaux ? (oui, `c.vitesseP10` est prête)
4. Les rivaux abîmés visent toujours la pleine vitesse ; une ligne dans `course.js` (viser selon l'adhérence restante, comme pour les pneus) fait passer les sorties de 28 à 16 sur les sept circuits et de 19 à 13 sur Route-des-Cimes, mais change les courses de tous les circuits : la faire dans le lot de l'IA ? (oui)
5. En chrono, le fantôme d'un tour de plus de 102 s fait grandir son tampon une fois (64 Ko) : le dimensionner d'après la longueur du circuit dans `course.js` ? (oui)
6. Haut-Col reste tel qu'il est, Route-des-Cimes est un circuit de plus : d'accord ? (oui)
7. En Fine et en Moyenne, il reste 1 % de marge en triangles sous Haut-Col au balayage serré : faut-il viser une marge plus grande ? (non, la règle est de ne pas dépasser)

## Fichiers de ce dossier

- `plan.png` et `profil.png` (`tools/lieux-plans.mjs`). Le titre du plan dit encore « tracé proposé » et sort du cadre à droite : c'est le titre de l'outil d'étude.
- `captures/1-depart.jpg` à `8-virage-du-vide.jpg`, `planche-cockpit.jpg`, `planche-bord.jpg`, `positions.json` (`tools/tour-captures.mjs`, Fine, été, jour, 1280×720)
- `mesures/trace-etude.json`
- `mesures/empreinte-avant.json` et `empreinte-apres.json`
- `mesures/budget.json` (six poses)
- `mesures/balayage.json` (une pose tous les 200 ou 400 m) et `mesures/balayage-page.js`, le script de mesure
- `mesures/courses.txt` (simulations des courses)
- `mesures/demo.json` (caméras de la démo)
- `mesures/tours.json` (tours gardés par circuit)
