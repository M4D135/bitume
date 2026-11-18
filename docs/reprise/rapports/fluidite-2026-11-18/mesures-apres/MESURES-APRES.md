# Fluidité — mesures après intégration (première mise en ligne du lot)

Date : 18 novembre 2026, de 23 h 19 à 23 h 36. Machine : celle de la base (MacBook Air, Apple M5, écran intégré à
60 Hz), sur secteur. Charge relevée : 3,75 / 5,17 / 10,67 avant la série, 3,77 / 5,15 / 8,51 après
(`charge-machine.txt`), avec d'autres agents actifs sur la machine.

Page mesurée : `dist/bitume.html` construite de `17eb95e` (branche `fluidite/integration`, V0.2.40, SHA-256
`6362eb15…`). Base : `../MESURES-BASE.md` (0.2.38, `baf4ddf`). Pour les captures, la base est
`~/Projects/bitume/dist/bitume.html` (0.2.39). Outils : `tools/serie-fluidite.sh … toutes`, puis
`tools/resume-fluidite.py --table`. La série en fenêtre visible n'a été lancée qu'une fois. Rapports bruts :
`*.json` de ce dossier.

## Fenêtre visible : la cadence réellement affichée

Séance de référence à Val-Brûlé, vue cockpit sauf mention. Fenêtre de 1 440 × 757 points, densité 2. On mesure 5 s,
après 2 s de course. Une image longue dure plus d'une fois et demie la période.

| Réglage | Images en 5 s (avant → après) | p95 | Images longues | Irrégularité | Triangles |
|---|---|---|---|---|---|
| Fine | 239 → **291** | 33,4 → **18,7 ms** | 60 (25 %) → **9 (3 %)** | 8,35 → 2,99 ms | 4,94 M → 1,30 M |
| Fine, rétroviseurs peints | 300 → 300 | 17,3 → 18,6 ms | 0 → 0 | 0,9 ms après | 4,95 M → 1,31 M |
| Moyenne | 301 → 300 | 16,8 → **18,6 ms** | 0 → 0 | 0,10 → **0,89 ms** | 2,45 M → 0,60 M |
| Fine, pluie | 222 → **246** | 33,4 → 33,4 ms | 77 (35 %) → **54 (22 %)** | — | 4,45 M → 1,50 M |
| Fine, poursuite | 300 → 300 | 16,8 → **18,6 ms** | 0 → 0 | 0,15 → **0,92 ms** | 4,40 M → 0,97 M |
| Fine, à deux | 173, à 30 images/s régulières → 234, irrégulières | 33,4 → 33,4 ms | 0 → **67** | — | 4,48 M → 1,09 M |
| Légère | pas de base comparable | 18,6 ms après | 0 après | 0,9 ms après | 0,32 M après |

Irrégularité : écart type des intervalles autour de la période, en ms (`tools/profil-accrocs.mjs`). La base de Légère
n'est pas comparable : la série `f` de la base était bridée à 30 Hz.

## Sans interface, avec le GPU réel : les accrocs en course

| Scénario | Clic → course | Pire image en course | Images longues | Ramassages par s | Triangles |
|---|---|---|---|---|---|
| Val-Brûlé, Fine | 213 → 419 ms | 33,4 → **16,8 ms** | 1 → **0** | 4,4 → **0** | 3,47 M → 0,79 M |
| idem, processeur ×4 | 500 → 792 ms | 16,8 → 16,8 ms | 0 → 0 | 4,65 → 1,25 | 3,43 M → 0,89 M |
| Haut-Col, Fine, pluie | 200 → 491 ms | 16,8 → 16,8 ms | 0 → 0 | 5,6 → 0,36 | 1,09 M → 0,46 M |
| idem, processeur ×4 | 567 → 817 ms | 16,8 → 16,8 ms | 0 → 0 | 5,72 → 1,16 | 1,15 M → 0,40 M |
| Cap-Séquoia, Fine | 167 → 355 ms | 16,8 → 16,8 ms | 0 → 0 | 4,1 → 0,55 | 0,86 M → 0,55 M |
| À deux, Fine | 221 → 427 ms | 33,4 → **16,8 ms** | 4 → **0** | 6,1 → 0,65 | 3,42 M → 0,88 M |
| Lande-Noire, Auto, ×4 | 319 → 534 ms | 16,8 → 16,8 ms | 0 → 0 | 3,96 → 0,44 | 0,51 M → 0,42 M |
| Val-Brûlé, Moyenne, ×6 (nouveau) | 2 122 ms | 16,8 ms | 0 | 0,95 | 0,61 M |

- Au départ de Val-Brûlé, la plus longue image pendant le chargement passe de 150 à 50 ms : le voile reste animé.
- Le compteur de créations en course reste à 0 dans les huit scénarios.

## Rendu logiciel : il amplifie les accrocs de première utilisation

| Scénario | Clic → course | Image habituelle (p50) | Images longues en course | Pire image |
|---|---|---|---|---|
| Val-Brûlé, Légère, 640 × 360 | 103 → 1 293 ms | 133 → 117 ms | 9 → 4 (à 3,7 s, 9,6 s, 14,2 s, 22,3 s) | 1 383 → 467 ms |
| Haut-Col, Moyenne, pluie, 480 × 270 | 1 330 → 5 700 ms | 333 → **367 ms** | 3 → **4** (à 8,7 s, 9,8 s, 30,8 s, 31,4 s) | 1 517 → 933 ms |

## Captures : base 0.2.39 contre après

Images de 1 280 × 720 prises avec `tools/page-essai.mjs`. Les vues de jeu comptent 45 images, les vues d'arbres 40
(`../arbres/vue-capture.js.tpl`). Écarts calculés avec `../integration/vues-outils/diff.mjs`. Chiffres complets dans
`captures.json`. Aucune erreur de console.

| Vue | Triangles | Appels | Pixels changés de plus de 16 niveaux |
|---|---|---|---|
| Cockpit, Fine | 4,17 M → 1,06 M | 410 → 400 | 11 % (autre instant de course) |
| Poursuite, Fine | 4,15 M → 0,93 M | 326 → **409** | 5 % (idem) |
| Cockpit, Fine, pluie (Haut-Col) | 0,97 M → 0,51 M | 433 → 351 | 17 % (idem) |
| Cockpit, Moyenne, pluie (Haut-Col) | 0,80 M → 0,50 M | 457 → 346 | 20 % (idem) |
| À deux, Fine | 4,14 M → 0,94 M | 357 → **446** | 33 % (idem) |
| Cockpit, Légère | 0,49 M → 0,45 M | 244 → 189 | 14 % (idem) |
| Arbre à 30 m (Val-Brûlé) | 1,02 M → 0,27 M | 206 → 275 | 0,05 % |
| Arbre à 250 m (Haut-Col) | 2,36 M → 0,65 M | 350 → 542 | 0,07 % |
| Arbre à 600 m (Val-Brûlé, caméra à 25 m) | 1,58 M → 0,42 M | 249 → 431 | 0,005 % |
| Arbre à 600 m (Haut-Col) | 2,27 M → 0,67 M | 358 → 599 | 0,05 % |
| Piste à 1 500 m (Val-Brûlé) | 2,13 M → 0,50 M | 264 → 251 | 0,07 % |

- **Vues de jeu.** Elles ne diffèrent que par l'instant de course. Le voile retient l'horloge : après 45 images, le
  chrono marque de 0,78 à 0,89 s, contre 0,83 à 1,11 s avant. Le cadrage et le décor sont les mêmes : arbres lointains
  présents, rien de coupé au loin.
- **Rétroviseurs.** Ils sont nets en Fine, en Moyenne sous la pluie et à deux. En Légère, ils restent peints comme
  avant.
- **Vues d'arbres.** On obtient la même image avec trois à quatre fois moins de triangles. Il faut en revanche 30 à
  70 % d'appels de plus, à cause des cases de 60 m : le rapport `../arbres/` l'annonçait.
- **Haut-Col à 600 m.** Le relief y cache l'arbre : cette vue prouve seulement que l'image est identique.
- **Bascule.** Le changement d'arbre pendant un déplacement n'a pas été refilmé ici. Le lot arbres l'a mesuré : 0,02
  à 0,09 % des pixels.

## Détection graphique

- **Sans interface** (1 390 × 1 295, densité 1), la détection retient Fine en 2,4 s. Fine coûte 6,4 ms pour une
  limite de 13,3 ms, et Extrême est refusée à 27,5 ms (`d1-detection-sans-interface.json`). La base retenait Légère.
- **En fenêtre**, la branche de détection a relevé Moyenne : Fine y coûte 23 à 25 ms en 3 420 × 2 214. Ce relevé
  vient de `../../detection-2026-11-18/`, essais F1 à F3. Il n'a pas été refait après l'intégration, puisqu'une seule
  série en fenêtre était permise.

## Cibles du pilotage

- **Fine cockpit sans image ratée en fenêtre : manquée.** 9 images longues sur 291 ; il y en avait 60 sur 239.
- **Fine sous la pluie sans image ratée en fenêtre : manquée.** 54 sur 246 ; il y en avait 77 sur 222.
- **Plus aucune image longue après la levée du voile.** Tenue sur GPU réel : 0 dans les huit scénarios. Manquée en
  rendu logiciel : 4 et 4.
- **Compteur de créations en course à zéro : tenue.**

## Dégradations mesurées, à trancher avant la mise en ligne

1. **Fenêtre visible.** Le p95 passe de 16,8 à 18,6 ms et l'irrégularité de 0,1 à 0,9 ms. Cela vaut pour toutes les
   séances qui tiennent 60 images par seconde : Moyenne, poursuite, rétroviseurs peints, et même Légère avec
   0,32 M triangles. Aucune image n'est perdue : 300 images en 5 s.
   - La cause n'est pas établie. La base a été mesurée à un autre moment, sans relevé de charge ; ici, d'autres
     agents tournaient.
   - Pour trancher, il faut une série « fenêtre » de la base et de l'intégration, dans les mêmes conditions. Elle n'a
     pas été refaite, puisqu'une seule série était permise.
2. **À deux, en fenêtre.** Avant, 30 images par seconde régulières. Après, 47 en moyenne, mais irrégulières : 67
   images de 33 ms sur 234.
   - La séance de référence coupe la cadence Auto. En course réelle, cette cadence doit caler 30 images régulières,
     mais ce n'est pas mesuré en fenêtre.
3. **Chargement.** Du clic à la course : 190 à 290 ms de plus sur GPU réel, 1,2 s et 4,4 s de plus en rendu
   logiciel. Le voile prépare et chauffe la séance : c'est voulu par le lot chargement, mais c'est mesuré.
4. **Rendu logiciel, Haut-Col en Moyenne sous la pluie.** L'image habituelle passe de 333 à 367 ms et les images
   longues en course de 3 à 4. La pire image tombe toutefois de 1 517 à 933 ms.

## Non mesuré

- **La course réelle, cadence Auto active, en fenêtre**, à deux et en Fine.
- **Une petite machine réelle.**
