# Publication 0.2.41 — branche `fluidite/integration`

Base : `deploy-origin-main` (0.2.40, a3d3e16), avancée en avance rapide. Cinq lots fusionnés dans l'ordre, la suite
complète passée après chacun. Page construite : 0.2.41, 13 905 518 octets, sha256 `cffdbd5c6033dd65…`.
Machine : Apple M5, Chrome 157, ANGLE Metal. Chiffres complets : `mesures.json`.

## Lots

| Lot | Source | Commits | État |
|---|---|---|---|
| Détection graphique (C1, C2, C4 à C9) | `fluidite/detection` 0a188a3 | ace4e81 | fusionné ; C3 non traité |
| Animaux des abords (26) | `etude/animaux` cee9b75 + patch | 44a0189, 586bd87 | branché |
| Bords de route (22F) | `etude/lieux` df14675 + patch | b356e40, 5db7843 | branché |
| Échappements (20) | `etude/echappement` 10f2c82 + patch | cc799f3, d988b07 | branché |
| Public (18) | `etude/public` 247ec4a + patch | 6db4046, ac7bf27 | branché |

## Ce qui change pour le joueur

- **Détection** : un onglet en arrière-plan ne bloque plus le test ; le fil principal est mesuré image par image ; un
  palier refusé de peu donne un verdict provisoire, refait à l'ouverture suivante.
- **Animaux** : bêtes propres au biome (à Val-Brûlé : cerfs, sangliers, buses), qui paissent et fuient au passage du
  peloton, jamais à moins de 34 m de l'axe. Réglage « Faune » existant. En Légère, quelques silhouettes au-delà de 120 m.
- **Bords de route** : séries de bandeaux de marques imaginaires, grands panneaux ; bords dangereux balisés (fossé,
  arbres à ras de la piste…) où la limite de piste se resserre.
- **Échappements** : flammes au surrégime et détonations aux passages de rapport, sur toutes les voitures ; visibles
  en vue extérieure et dans les rétroviseurs ; détonations audibles (6 voix au plus).
- **Public** : spectateurs humains animés (corps d'EMPRISE) à la place des boîtes des gradins, nombre et détail selon
  le palier, aussi dans les rétroviseurs.

## Vérifications

- `verifications/` : 87 fichiers, aucun échec (81, 82, 85, 86 puis 87 fichiers après les lots). Au lot 2,
  `decor.test.mjs` a dépassé son seuil de temps en parallèle (168 ms pour 150), puis est passé seul.
- Smoke (`banc-navigateur.mjs --mode smoke --angle native`) : 7 contrôles, aucune erreur de console, après chaque lot.
- Créations en course, après 9,5 s : `tardives` à 0 et créations du moteur à 0, en Fine (cockpit), Moyenne
  (poursuite) et Légère (cockpit). Tout est créé sous le voile : `prechargerSeance`, puis `chaufferRendu`, qui réserve
  les flux d'instances (animaux, flammes) ; sans cette réserve, le départ en Fine faisait grandir un flux en course.

## Comptes par image (Val-Brûlé, simulation figée, 60 images)

Poses : départ = grille en cockpit ; tribune = vue sur la tribune principale ; panneaux = ligne droite s 540 à 600.

| Qualité | Pose | Triangles 0.2.40 → 0.2.41 | Appels | Dont public | Dont animaux |
|---|---|---|---|---|---|
| Fine | départ | 691 771 → 1 094 419 (+58 %) | 294 → 310 | 338 324 | 3 696 |
| Fine | tribune | 460 796 → 781 898 (+70 %) | 188 → 204 | 281 454 | 5 600 |
| Fine | panneaux | 530 041 → 551 189 (+4 %) | 325 → 349 | 0 | 9 080 |
| Moyenne | départ | 616 803 → 738 861 (+20 %) | 269 → 289 | 125 926 | 3 696 |
| Moyenne | tribune | 380 232 → 473 058 (+24 %) | 181 → 201 | 111 254 | 4 514 |
| Moyenne | panneaux | 343 879 → 368 785 (+7 %) | 311 → 342 | 0 | 6 744 |
| Légère | départ | 398 704 → 385 900 (−3 %) | 133 → 141 | 23 184 | 516 |
| Légère | tribune | 236 106 → 220 446 (−7 %) | 77 → 84 | 19 734 | 2 874 |
| Légère | panneaux | 206 754 → 212 074 (+3 %) | 77 → 94 | 0 | 0 |

Rétroviseurs au départ en Fine : 173 841 → 218 157 triangles, 102 → 107 appels.

## Cadence en fenêtre (1440 × 900, alternée 0.2.40 / 0.2.41, trois tours, médianes de `images.apres2s`)

| Réglage | Images | p95 (ms) | Au-delà de 1,5 × | Irrégularité |
|---|---|---|---|---|
| Moyenne, cockpit | 301 → 301 | 18,6 → 18,6 | 0 → 0 | 1,04 → 0,97 |
| Légère, cockpit | 300 → 300 | 18,6 → 18,6 | 0 → 0 | 1,02 → 1,04 |
| Fine, poursuite | 278 → 300 | 32,7 → 18,6 | 22 → 0 | 4,72 → 0,93 |

Charge sur 1 min pendant la série : 5,0 à 13,6. Au premier tour en Fine, les deux pages ont eu 68 intervalles
au-delà de 1,5 fois la période (charge 8,5 et 12,7) : la Fine est bruitée. Aucune page n'est moins régulière que
l'autre.

## Détection (profil neuf, en fenêtre, en alternance)

Les trois pages choisissent Moyenne à chaque essai.

| Pages comparées | Charge | Durée du test | Voile vu (affiché → masqué) |
|---|---|---|---|
| 0.2.40 / 0.2.41 | 1,6 à 3,7 | 2,04 et 2,01 s / 2,94 et 2,50 s | 1,80 et 1,99 s / 2,91 et 2,90 s |
| lot 1 seul (ace4e81) / 0.2.41 | 2,2 à 2,8 | 2,79 et 2,89 s / 2,86 et 2,96 s | 2,81 et 2,83 s / 2,85 et 2,84 s |

Le voile s'allonge d'environ 1 s avec le lot 1 (mesure image par image, zone grise refaite) ; les lots 2 à 5 y
ajoutent moins de 0,05 s. Ils ajoutent 0,2 ms environ à l'image seule du point de vue le plus chargé (de 1,18-1,28 ms
à 1,38-1,53 ms, limite 2,8 ms). Le coût GPU de Moyenne ne bouge pas à la précision de la mesure (7,6-8,3 ms, puis
7,2-8,1 ms ; limite 13,3 ms).

## Captures

| Fichier | Ce qu'on voit |
|---|---|
| `animaux-bete-pres.jpg` | sangliers à 6 m, Fine |
| `animaux-groupe-loin.jpg` | sept cerfs à 130 m, œil à 10 m, champ de 24°, Fine |
| `animaux-legere.jpg` | Légère : cerfs à 145 m, silhouettes d'une pièce |
| `bords-panneaux-et-fosse.jpg` | s 568 m : série de bandeaux à gauche, fossé balisé à droite |
| `bords-arbres.jpg` | s 1 197 m : arbres alignés à ras de la piste |
| `echappement-rival-poursuite.jpg` | rival au surrégime (intensité 0,99), vue de poursuite |
| `public-tribune-pres.jpg`, `public-tribune-loin.jpg` | tribune principale, Fine |
| `retroviseur.jpg` | départ en cockpit : les deux glaces, voitures et public derrière |

## Limites et suites

- `PHYSIQUE` reste `p9` alors que les bords dangereux resserrent la limite sur quelques portions : records et
  fantômes de 0.2.40 restent présentés comme comparables. À trancher par David (`p10` maintenant ou avec le lot 17).
- Légère : une bête n'est dessinée qu'au-delà de 120 m. En approchant, sa silhouette disparaît d'un coup, sans fondu.
- Échappements : le « mode lumineux » de jour, prévu dans FERRO, n'est pas fait. Le jour, une flamme faible reste
  terne ; à pleine intensité, elle se voit.
- `tools/planche-animaux.mjs` : sur une page qui a `B.cadence` (depuis 0.2.40), une image de 0 ms n'est pas rendue.
  Les prises « loin » et « passage » reprennent alors l'image précédente, et l'écart avec ou sans animaux vaut 0. Les
  captures d'animaux ci-dessus ont été refaites avec `tools/page-essai.mjs`.
- Relecture du Spark (lots 2, 4 et 5) : aucun défaut retenu. Sa seule remarque, une écoute des échappements partagée
  en écran partagé, est fausse : `majSon` ne tourne qu'une fois par image et traite les deux écoutes.
