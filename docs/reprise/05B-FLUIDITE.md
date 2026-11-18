# Lot 5B : fluidité, cadence et préchargement

Demande de David, 18 novembre 2026 : « optimise son moteur pour le rendre le plus fluide possible sur n'importe
quelle machine, aucun accroc de buffering ou autre pendant le jeu, précache en début de niveau, fais tout pour tout
avoir en RAM et que ce soit 100 % fluide à 30, 60 ou 120 fps ». Ce lot passe avant 12A.

Statut : **en cours**. Base 0.2.38 (`baf4ddf`), FERRO 0.3.9. Rien n'est publié tant que le reçu n'est pas écrit.

## Ce que disent les mesures

Relevé complet : [MESURES-BASE.md](rapports/fluidite-2026-11-18/MESURES-BASE.md). Cartes de lecture du code, constat
par constat, avec contre-vérification : [cartes/](rapports/fluidite-2026-11-18/cartes/).

1. **Saccade en Fine sur le Mac de David** : une image sur quatre ratée en fenêtre réelle. Sans les images des
   rétroviseurs, zéro. Les rétroviseurs redessinent toute la scène dans un second moteur pour 495 × 150 pixels.
2. **Les arbres font 3,6 des 4,2 millions de triangles d'une image** : la version « lointaine » d'un feuillu garde
   70 % des triangles et ne prend le relais qu'à 520 m.
3. **Accroc au départ** : première image de 150 ms (480 ms sur un processeur quatre fois plus lent) ; le voile de
   chargement est retiré avant la construction et rien ne chauffe le rendu. En rendu logiciel, des images de 250 à
   1 500 ms tombent en pleine course au premier usage de chaque effet.
4. **Cadence** : aucun verrou sur la période de l'écran ; seuils de la qualité Auto en millisecondes absolues, donc
   effondrement de la qualité à 30 Hz (économie d'énergie de Chrome) et remontée impossible à 60 Hz ; la qualité
   Auto réalloue les cibles du moteur en pleine course.
5. **Ramasse-miettes** : 4 à 6 passages par seconde, 20 000 allocations par image pour poser les voitures.
6. **Détection graphique** : choisit « Légère » sur un M5, trompée par le chronomètre GPU.

## Sous-lots

| Sous-lot | Contenu | Fichiers |
|---|---|---|
| 5B-1 moteur | FERRO 0.3.10 : préchauffage (`prewarm`), rétention des cibles, compteur de créations en course, index vide, lots sans ombre, compilation groupée, tampons dynamiques | dépôt FERRO, puis verrou |
| 5B-2 arbres | Vraie forme lointaine, bascule rapprochée, lots d'arbres séparés | `botanique.js`, `decor.js` |
| 5B-3 prairie | Moins de lots d'herbe, herbe hors de la passe d'ombre | `vegetation.js` |
| 5B-4 cadence | Période de l'écran, verrou des pas, diviseur de cadence (30, 60, 120), qualité Auto relative à la période | `cadence.js` (nouveau), `qualite.js` |
| 5B-5 voitures | Pose sans allocation, niveau de détail moyen | `voiture.js` |
| 5B-6 effets et nature | PhysX prêt avant le choc, préparations rangées sur la scène, pluie et vitre régulières | `traces.js`, `sillage.js`, `faune.js`, `effets-saison.js`, `aurores.js`, `meteo.js`, `vitre.js` |
| 5B-7 simulation et son | Pas de simulation sans allocation, à résultat identique au bit ; son préparé avant le départ | `course.js`, `conduite.js`, `contacts.js`, `obstacles.js`, `circuit.js`, `son.js` |
| 5B-8 détection et mesures | Coût mesuré sans chronomètre GPU ; volet de mesures qui compte les accrocs | `autoconfig.js`, `scene-bench.js`, `mesures.js` |
| 5B-9 chargement | Phase de chargement réelle : tout construire, tout créer, tout chauffer sous un voile opaque | `jeu.js`, `index.html`, `style.css` |
| 5B-10 boucle et vues | Branchement de la cadence, rétroviseurs allégés, affichage de course moins coûteux | `jeu.js`, `style.css` |

## Règles du lot

- La simulation ne change pas d'un bit : physique `p9`, records et fantômes valides.
- Rien ne se coupe à distance ; les rétroviseurs restent « bien visibles et bien foutus ».
- Aucun gain annoncé sans mesure. Mesurer la cadence en fenêtre visible, volet de mesures fermé.
- Le moteur se corrige dans `M4D135/FERRO` puis se propage par `tools/install-ferro.py`.

## Outils ajoutés

- `tools/profil-accrocs.mjs` : intervalle de chaque image, accrocs attribués par la trace de Chrome.
- `tools/page-essai.mjs` : évalue une expression dans la page construite, avec capture.
- `tools/banc-navigateur.mjs` : attend la fin de la détection graphique ; économie d'énergie coupée dans son profil.
