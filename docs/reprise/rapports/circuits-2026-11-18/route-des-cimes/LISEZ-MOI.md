# Route-des-Cimes, le huitième circuit — 18 novembre 2026

**branche locale circuits/lot22, BITUME 0.2.40, rien n'est poussé ni mis en ligne.**

## Ce qui est fait

- Le jeu construit un circuit dessiné via `B.circuit.creer(graine, { partition })`. Les partitions sont dans `src/partitions.js`.
- La validation accepte une pente au-delà du plafond du thème (10 % en montagne) seulement dans une rampe déclarée (le Mur, jusqu'à 30 %).
- Route-des-Cimes est au catalogue en huitième position : identifiant `route-des-cimes`, graine 181, thème montagne, « Montagne · grande route des cols ».
- Longueur : 9 698 m. Dénivelé : 270 m. Pentes : de −10 % à +30 %.
- Distance avec pente > 20 % : 312 m. Rayon minimum : 32 m.
- Deux tours par défaut (environ 6 min). Le nombre de tours choisi est gardé pour ce circuit ; les sept autres partagent le même réglage.
- La démo fait deux tours sur ce circuit.
- Les sept circuits d'avant n'ont pas changé : empreinte SHA-256 identique avant (commit ff1f986) et après (commit dad2a37). Outil : `tools/empreinte-circuits.mjs`.
- Crête du Mur corrigée : bascule allongée (100 m à 24 %, 110 m à 15 %, 100 m à 7 %).
- À la vitesse de référence de l'étude, la crête du Mur allège de 0,34 g et le pont de 0,39 g (règle : 0,4 g au plus).
- Aux vitesses de l'IA, la charge la plus basse est 0,634 g (pont de la Gorge, 230 km/h) et 0,672 g (crête du Mur, 203 km/h).
- Les rivaux visent la vitesse de référence p9 (conduite actuelle). La référence p10 de l'étude compte un appui de creux non donné par p9 : au pied du Mur, p10 vise 10 km/h de trop.
- Sur 5 courses, au pied du Mur (2 250 à 2 450 m) : 14 sorties avec p10 (dont 11 sans contact juste avant) ; 2 avec p9 (toutes deux 0,8 s après un contact).
- Les onze rivaux bouclent leurs tours et montent le Mur. Sur 5 courses (12 voitures, 2 tours, difficulté 2) : 19 sorties de piste, dont 8 sans contact dans les 2 s avant (toutes voitures touchées plus tôt, adhérence 92 à 99 %).
- Pour 10 km de course : 2,0 sorties sur Route-des-Cimes, 2,4 sur Val-Brûlé, 1,1 sur Cap-Séquoia, 0,8 sur Port-Sable, 0,6 sur Haut-Col, Roche-Fauve et Brume-de-Jade, 0 sur Lande-Noire.
- Aucune voiture abandonnée. Toutes bouclent au moins un tour.
- Vitesse la plus basse dans le Mur : 35 à 99 km/h (35 km/h pour une voiture sortie après contact). En haut : 207 à 214 km/h.
- En difficulté 0 et 1 (4 courses) : 1 à 9 sorties par course, aucun abandon.
- Arrêtée dans le Mur puis plein gaz, la voiture repart et passe la crête.
- Arrêtée à 29 % (2 480 m) : 64 km/h en 2 s, 113 km/h en 4 s, passe la crête (2 924 m). Pareil depuis 15 %, 18 % et 25 %.
- Jeu en ligne : chaque machine construit le même tracé. Test avec fonctions mathématiques faussées d'un dernier bit : nombre de points, vibreurs, séquences, tunnel et stands identiques. Autres valeurs bougent de moins d'un millionième (2,7e-10 au plus).
- Tunnel du Rocher : 305 m, construit par le tunnel actuel du jeu (éclairé, vue cockpit vérifiée).
- Galerie des Avalanches (300 m), tunnel des Échelles (170 m), pont de la Gorge, bords (vide, muret, arbres) et sept lieux sont gardés dans les données, pas encore construits.
- Plan de l'affichage : le trait s'amincit selon l'écart entre les deux portions de piste les plus proches (69 m dans les Lacets). Les lacets se lisent en zigzag sur le petit plan.
- Caméras : en démo, 1 371 images sur Route-des-Cimes (plans hélico, télé, orbite, roue, sol, poursuite, arrière). Aucune caméra sous le terrain. Après deux tours, la démo passe au circuit suivant.
- Dans le tunnel, les caméras hors piste passent en poursuite et les postes télé restent dehors (règles déjà là pour Haut-Col).
- Records et fantômes : rangés sous l'identifiant `route-des-cimes`. Un fantôme n'est relu que pour la même longueur.
- Budget de dessin : pour un circuit dessiné, chaque morceau du décor s'agrandit dans le rapport du tour à 5,2 km (× 1,87 ici). Rien n'est retiré ni coupé à distance.
- Les captures n'ont pas bougé (écart moyen 0,02 sur 255 au plus).
- Tests ajoutés : `verifications/route-des-cimes.test.mjs` (10 vérifications) et `route-des-cimes-course.test.mjs` (4 vérifications, 5 s).
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

Tableau 1, budget de rendu en six poses par tour (`tools/budget-circuits-page.js`, vue cockpit, Chrome sans fenêtre, 1440×900, Apple M5).

| palier | Route-des-Cimes, appels de dessin de la pose la plus chargée (sans budget) | Route-des-Cimes, triangles au plus | le plus lourd des sept, appels | le plus lourd des sept, triangles | construction du niveau, Route-des-Cimes | la plus longue des sept |
|---|---|---|---|---|---|---|
| Fine | 306 (370) | 3 035 965 | Port-Sable 422 | Haut-Col 4 262 655 | 456 ms | Haut-Col 443 ms |
| Moyenne | 236 (303) | 1 596 934 | Port-Sable 391 | Haut-Col 2 241 869 | 462 ms | Val-Brûlé 460 ms |
| Légère | 136 (215) | 271 727 | Cap-Séquoia 162 | Haut-Col 308 817 | 157 ms | Brume-de-Jade 189 ms |

Aucune création d'objet GL pendant 300 images de course, aux trois paliers, sur les huit circuits. Les temps de construction (médiane de 3) sont indicatifs, la machine était chargée (Port-Sable en Fine : 329 à 632 ms selon la série).

Tableau 2, balayage serré (une pose tous les 200 m en Légère, 400 m en Moyenne et Fine), appels de dessin au plus.

| palier | Route-des-Cimes | Haut-Col, le plus lourd des sept sur ce balayage |
|---|---|---|
| Fine | 442 | 473 |
| Moyenne | 390 | 417 |
| Légère | 158 (184 au premier essai du budget) | 163 |

## Questions pour David

1. Garder la pointe à 30 % du Mur ? (oui)
2. Deux tours par défaut ? (oui)
3. Quand la conduite p10 arrivera (lot 17), faire viser p10 aux rivaux ? (oui, `c.vitesseP10` est prête)
4. Les rivaux abîmés visent toujours la pleine vitesse ; une ligne dans `course.js` (viser selon l'adhérence restante, comme pour les pneus) fait passer les sorties de 28 à 16 sur les sept circuits et de 19 à 13 sur Route-des-Cimes, mais change les courses de tous les circuits : la faire dans le lot de l'IA ? (oui)
5. En chrono, le fantôme d'un tour de plus de 102 s fait grandir son tampon une fois (64 Ko) : le dimensionner d'après la longueur du circuit dans `course.js` ? (oui)
6. Haut-Col reste tel qu'il est, Route-des-Cimes est un circuit de plus : d'accord ? (oui)

## Fichiers de ce dossier

- `plan.png` et `profil.png` (`tools/lieux-plans.mjs`)
- `captures/1-depart.jpg` à `8-virage-du-vide.jpg`, `planche-cockpit.jpg`, `planche-bord.jpg`, `positions.json` (`tools/tour-captures.mjs`, Fine, été, jour, 1280×720)
- `mesures/trace-etude.json`
- `mesures/empreinte-avant.json` et `empreinte-apres.json`
- `mesures/budget.json` (six poses)
- `mesures/balayage.json` (une pose tous les 200 ou 400 m)
- `mesures/courses.txt` (simulations des courses)
- `mesures/demo.json` (caméras de la démo)
- `mesures/tours.json` (tours gardés par circuit)
