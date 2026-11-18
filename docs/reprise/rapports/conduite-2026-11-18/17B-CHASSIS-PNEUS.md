# 17B — Châssis, charges et pneus latéraux

Lot 17 (conduite p10), deuxième sous-lot, 18/11/2026. Plan : `docs/reprise/17-CONDUITE.md` § 5, 17B (§ 3.1, 3.2,
3.4 et 3.8). Base : 4799fb6 (17A). Couplage longitudinal (ellipse 1,3, `transmis`) et force de freinage : ceux de p9,
jusqu'à 17C et 17D.

## État : arrêté avant le commit (règle d'arrêt, § 5)

La dixième variante mesurée tient les 19 cibles obligatoires de 17B et les 46 critères. Deux contrôles du § 6 restent
rouges : `glissiere-rebond.test.mjs` et la comparaison page contre Node (≤ 1e-12). Tous deux lisent un nombre qui
dépend du dernier bit (détail plus bas) ; aucun réglage permis ne les rend verts autrement que par chance. Rien n'est
commis : les changements attendent dans l'arbre `bitume-wt/conduite` (branche `conduite/etude`). **À David de choisir**
(fin du rapport).

## Ce qui change au volant

- La voiture est la 312 T5 : 665 kg pilote compris, empattement 2,70 m, voies 1,70 / 1,615 m. Elle accélère comme
  avant : le moteur de p9 donne une accélération, pas une force (17C le passe en couple).
- Chaque roue a sa charge et son adhérence. Plus une roue est chargée, moins elle adhère par kilo : un frein en entrée
  fait tourner, un lever de pied referme. Après le pic, la force retombe vers un plateau (avant 85 % ; arrière 83 % à
  2,5 fois le pic, 76 % au loin), en 0,15 s : le temps de rattraper.
- Le lacet est mieux amorti à haute vitesse : à 200 km/h, un coup de volant dépasse de 8,6 % au lieu de 17,1 %
  (mi-volant) et de 13,7 % au lieu de 21 à 25 % (plein volant). La réponse reste aussi vive (t90 80 ms à 200 km/h,
  103 ms au lieu de 113 à 100 km/h).
- À la limite, c'est toujours l'avant qui lâche, avec plus de marge derrière (réserve arrière 6,6 à 9,8 % au lieu de
  4,6 à 7,1 %) ; la voiture y est un peu moins en travers (β 1,6 à 3,5° au lieu de 2,0 à 3,8°). Plein gaz en 2e en
  appui, l'arrière part toujours (1,43 fois son pic).
- Le relief compte. Un creux plaque la voiture (1,85 g dans un creux de 300 m à 180 km/h), une crête l'allège. Une
  crête prise trop vite la fait décoller (sous 10 % du poids, appui compris) ; elle se repose sur la piste sans accident.
  Sur les 7 circuits du jeu, cela n'arrive jamais : l'appui le plus faible est 0,82 g à la vitesse de référence, 0,42 g
  à 310 km/h partout.
- En montée, l'arrière se charge (30 % : 3,4 % du poids passe derrière). Freiner de 150 à 50 km/h prend 39,8 m à plat,
  36,2 m en montée à 25 %, 46,8 m en descente à 25 %.

## Ce qui est livré (dans l'arbre, non commis)

- `src/conduite.js` : châssis de la T5 ; charge normale m·g·cos θ·cos φ (pente, dévers) plus m·v²·κ_v (courbure
  verticale lissée sur 6 m) plus l'appui ; transfert de pente m·g·sin θ·h/L vers l'arrière ; transferts en partie
  immédiats (30 %), le reste retardé de 62 ms. Les charges d'essieu restent dans [0, charge totale] et les transferts de
  roue dans ±la moitié de l'essieu : la somme des quatre roues est toujours la charge totale, aucune n'est négative.
  Loi de pneu p10 par roue (`src/pneu.js` de 17A) ; relaxation σ 0,3 m ; amortisseur de glisse 0,5 jusqu'à 108 km/h,
  0,62 au-delà de 216 km/h. Décollage de crête : sous 10 % du poids, la voiture vole (arc tenu au-dessus du profil,
  vol de 2 s au plus) et se repose dès que la piste la porte à nouveau.
- `tools/banc-conduite.mjs` : banc v3 (voir Méthode) ; voie avant et arrière lues à part ; réglages en tableau gelé
  acceptés par les variantes.
- `verifications/conduite-relief.test.mjs` (nouveau, 11 contrôles) : charge cos θ·cos φ, m·g exactement sur le plat,
  report de pente ±5 %, creux et crête (κ_v ±1 %), décollage et retour d'une crête de 60 m à 180 km/h sans accident ni
  gain de vitesse, crête de 300 m sans décollage, roue délestée, freinage en montée et en descente, profil de montagne
  de 120 s avec un mur à 30 % (ni tête-à-queue ni sortie).
- `verifications/conduite-p10.test.mjs` : 17B obligatoire (19 cibles). La ligne « plein gaz en 2e, R 60, 0,92 ×
  limite » retourne au tableau de 17C, où le plan la range ; sa place en 17B est prise par S3 « plein gaz » en fois le
  pic, comme le plan le demande.
- `verifications/conduite-criteres.test.mjs` : S3 « plein gaz » exprimé en fois le pic arrière (≥ 1,25 au lieu de
  ≥ 6°), changement annoncé au § 6.
- `verifications/determinisme-simulation.test.mjs` : garde-fou p10 de 17B, `fixtures/determinisme-p10.json`
  (19 séances, 1 259 empreintes) ; la fixture p9 reste dans l'histoire à 4799fb6. `PHYSIQUE` reste `p9` dans `jeu.js`
  jusqu'à 17J.

## Mesures avant et après (banc v3)

| Mesure | p9 (4799fb6) | 17B | Cible |
|---|---|---|---|
| vitesse d'adhérence R 30 / 60 / 120 / 180 (km/h) | 85,0 / 121,7 / 185,8 / 249,7 | 85,8 / 122,1 / 184,2 / 243,6 | ±3 % (R 180 : −2,5 %) |
| limite fixée par | l'avant partout | l'avant partout | l'avant |
| réserve arrière (%) | 4,6 à 7,1 | **6,6 à 9,8** | 6 à 13 |
| gradient K, R 30 à R 180 (°/g) | 0,21 à 0,43 | 0,16 à 0,35 | 0,1 à 0,6 |
| β à la limite (°) | 2,0 à 3,8 | **1,6 à 3,5** | 1,5 à 3,5 |
| échelon 200 km/h mi / plein / manette : dépassement (%) | 17,1 / 21,1 / 24,5 | **8,6 / 13,7 / 13,7** | ≤ 10 / 15 / 18 (+2) |
| t90 du lacet 200 / 100 km/h (ms) | 78,6 / 112,5 | 79,7 / 102,7 | ≤ 90 / 125 (+5) |
| S3 lever de pied / S11 frein 0,3 | 1,126 / 1,532 | 1,102 / 1,485 | 1,05 à 1,20 / ≥ 1,15 |
| clavier R 30 / R 120, part de la voiture seule (%) | 89,6 / 94,7 | 90,4 / 96,3 | ≥ 89,5 / 94,5 |
| critères de la phase 2 | 46/46 | 46/46 | 46/46 |
| S3 plein gaz (fois le pic arrière) | 1,43 | 1,43 | ≥ 1,25 |
| S4 forte glisse avec aide / S7 gain / S9 plein braquage | 3,10° / 0,283 s / 1,161 | 2,89° / 0,275 s / 1,024 | < 5° / 0,1 à 0,3 / ≤ 1,2 |
| S8 lissage de β (°/s², ouverte) | 1 031 | 990 | selon David |
| cibles obligatoires de 17B | 14/19 | **19/19** | 19/19 |
| suite `verifications/` (82 tests) | verte | 81 verts, `glissiere-rebond` rouge | verte |
| page contre Node (sous-ensemble court) | 9,8e-14 (17A, banc v2) | **2,05e-8** sur 2 nombres, ≤ 2,4e-13 sur les 212 autres | ≤ 1e-12 |
| empreinte banc complet · lot 17 · court | 05fb2f62b9e8b6fb · 4a484f8bbb3dde21 · a306a7bb6bea8a6e | ea6f667e6b909e27 · 95c34a40af743c02 · ff894f97114481d1 | notée |

Coût d'un pas de course (12 voitures, `tools/cout-pas.mjs`, essais alternés, médianes de 9) : **52,6 µs contre
46,7 µs pour 17A, soit +13 %**, à la charge la plus basse de la soirée (≈ 7 sur 10 cœurs) ; +7 % en temps processeur
(11 essais). Sous forte charge (20 à 80, d'autres travaux), les rapports allaient de 0,93 à 1,23 contre 17A et de 1,14
à 1,36 contre la base 5ce4474 : à remesurer sur une machine calme. Le profil place `rouler` et la loi de pneu à 16 % du
pas au lieu de 11 %. Ramasse-miettes mineurs : 42 au lieu de 33 sur 300 s. Le code ne crée ni objet ni tableau à chaque
pas (seul un décollage en crée, et cette course n'en a aucun) ; la hausse vient probablement des nombres que V8 met en
boîte entre les fonctions de la loi de pneu. Budget du lot : +30 % au total ; 17B en prend environ la moitié.

## Écarts aux valeurs de départ du plan (toutes dans leur plage)

| Paramètre | Départ | 17B | Plage | Pourquoi (mesure) |
|---|---|---|---|---|
| g_ar | 1,04 | 1,05 | 1,00–1,10 | à 1,04 : réserve 5,4 % en R 30 et clavier R 30 89,4 % ; 1,05 rend les deux |
| retombée arrière c | 0,20 | 0,24 | 0,12–0,28 | à 0,20, S4 témoin ne part pas en tête-à-queue sans aide et S4 contre-braquage échoue |
| α_pic avant / arrière | 4,9 / 4,4° | 5,2 / 4,9° | 4,0–6,0 / 3,6–5,4° | arrière 4,9° (variante C) : β en R 30 remonte de 1,33 à 1,58° ; avant 5,2° (E) : K repasse de 0,06 à 0,16 °/g au plus bas |
| exposant de l'angle p | 0,25 | 0,10 | 0–0,35 | S3 plein gaz : p plus faible fait passer le pic arrière (0 : 1,29 ; 0,35 : 1,11 fois le pic) |
| sensibilité q | 0,18 | 0,22 | 0,10–0,25 | S3 plein gaz (0,10 : 0,98 ; 0,25 : 1,41 fois le pic) |
| part du roulis sur l'avant | 0,54 | 0,55 | 0,45–0,62 | réglée avec les angles du pic (variante C) ; effet faible, non isolé seul |
| relaxation σ (option § 3.4) | 0 | 0,3 m | 0–0,5 | S8 1 109 → 963 °/s² (E contre G, autres réglages égaux) ; les autres cibles bougent peu |
| fenêtre d'angle de la dérive (bas) | 0,02 rad | 0,025 rad | levier permis | `conduite.test` « dérive annulée fond » : trop contré, l'arrière revenait vers 2,2° et la dérive tenait |
| giration | 1,23 m | 1,23 m | 1,10–1,35 | gardée ; 1,30 (variantes C à G) faisait échouer `ia-epaves` avec q 0,22 et la relaxation (contact, −2,89 m ; p9 −2,98) |

Aucun paramètre hors de sa plage. `aideSeuil` et `aideGain` n'ont pas bougé.

**Conflit avec le principe 4** (« jamais sous 80 % du pic ») : avec c = 0,24, le plateau arrière vaut 83 % à 2,5 fois
le pic, 80 % à 3,24 fois, 76 % au loin. C'est dans la plage du § 3.2, mais sous 80 % au-delà de 3,24 fois le pic.
C'est le témoin S4 qui l'impose : à 0,20, la voiture sans aide rattrape seule une forte glisse. À David de trancher
(garder 0,24, ou garder 80 % et revoir le témoin S4, qui sera refait en 17G).

## Les deux contrôles rouges

**`glissiere-rebond`** : après le choc (200 km/h, 17°), la caisse s'écarte du rail (84 mm en p9, 117 mm en 17B), puis,
p9 comme 17B, la voiture frotte le long du rail jusqu'à 3 s : la caisse reste tournée de 11 à 13° vers lui et les pneus
l'y ramènent. Le test lit l'écart à un seul instant, 1,00 s. En p9, la voiture touche toutes les 58 ms et 1,00 s tombe
entre deux touches (2,8 mm). En 17B, elle touche toutes les 42 ms et 1,00 s tombe sur une touche (0 mm, −2,8e-16 au
calcul). Toutes les girations permises frottent de même ; 1,10, 1,15, 1,20 et 1,35 passeraient le test, de 0,5 à 0,9 mm,
par la seule phase des touches.

**Page contre Node** : 212 nombres sur 214 sont égaux à 2,4e-13 près. Les deux autres sont β et le volant à la vitesse
d'adhérence exacte de R 120 (fin de dichotomie, 184,2 km/h). À cette vitesse, p9 comme 17B oscillent encore (β ±0,8°
sur les 2 dernières secondes) et le pneu avant touche son pic. Sous Node seul, un bit de plus sur la vitesse change β
de 4,7e-6 et fait basculer « tenu » en « non tenu » (en p9 : 1,3e-15). Chrome et Node n'ont pas le même `Math.exp` au
dernier bit ; ici, ce bit se voit. La mémoire du pic et la relaxation n'y sont pour rien (essayé sans l'une, sans
l'autre, sans les deux : même sensibilité).

## Méthode

- **Banc v3.** Jusqu'au banc v2, une pente descendante rendait la traînée dans les essais d'adhérence. En p10, la pente
  change la charge (m·g·cos θ : −4,5 % à R 180) : la mesure n'en était plus une. Le banc v3 enlève traînée et
  roulement par l'état de dégâts, sur piste plate. Sur p9, les deux façons donnent les mêmes vitesses à 0,07 % près ;
  empreintes de p9 au banc v2 : 52a7484e7589dd23 · ce461e6c87021649 · 6dc495a68695aec5.
- **Variantes.** Dix variantes mesurées en entier (banc complet, 85 cibles, 46 critères) : départ du plan sauf g_ar
  1,06, g_ar 1,04, g_ar 1,05, + c 0,24, + α_ar 4,6°, C (+ giration 1,30, p 0,10, α_ar 4,9°, q 0,22, roulis 0,55),
  D (p 0,05, α_ar 5,0°), E (C + α_av 5,2°), G (E + relaxation), et la dernière (G avec giration 1,23 et fenêtre
  0,025). Le départ du plan a été mesuré une seconde fois au banc v3 (mêmes réglages). Une cinquantaine de sondes
  partielles (sous-ensembles du banc, scénarios isolés) ont guidé les choix sans compter comme variantes.
- **Pas encore fait pour p10** (22F, points 5 à 7) : la référence des rivaux (0,93 à 1,03 de la vitesse
  d'adhérence, cible 0,97 à 1,03 en 17J), la validation des rampes et les clés de records.
- **Laissé de côté, à proposer** : le terme a_y·sin φ de la charge en virage relevé (le § 3.1 ne l'a pas) ; en vol de
  crête, la voiture ne perd de vitesse que par l'air (pas de pesanteur le long de l'arc).

## Autres mesures qui bougent (sous-lots suivants)

- Puissance lue à la roue : 202 à 258 kW au lieu de 182 à 233. Le banc la lit comme masse × accélération ; le moteur
  de p9 donne une accélération : la masse plus forte gonfle le chiffre, pas la voiture. 17C le passe en couple.
- K à R 500 : 0,045 °/g (p9 0,096 ; cible 17E ≥ 0,05) ; gain le plus bas R 250 : −0,117 s (p9 −0,075 ; cible 17G
  ≥ −0,05) ; gain d'une dérive manette R 80 : 0 s (p9 0,025).
- Mieux qu'en p9 : départ sans aide (arrière au-delà du pic 0,41 s au lieu de 1,33, cible 17C 0,2 à 1,0), aide seule
  R 120 (−0,3 % au lieu de −1,7 %), gain au clavier R 40 (0,08 s au lieu de 0,85), remise des gaz à 45° R 30 (11 m au
  lieu de 16).

## Ce que David choisit

1. `glissiere-rebond` : garder le test et chercher une onzième variante qui tombe entre deux touches (giration 1,20 :
   0,5 mm), ou lui faire lire ce qu'il veut dire (par exemple : la caisse s'écarte d'au moins 5 cm dans les 0,3 s qui
   suivent le premier choc ; p9 84 mm, 17B 117 mm). Proposition : la seconde.
2. Page contre Node : garder 1e-12 sur les nombres bien conditionnés et lire β et le volant d'adhérence avec une
   tolérance écrite (ou les sortir de la comparaison), la preuve étant donnée sous Node seul ; ou garder la règle telle
   quelle, et 17B attend. Proposition : la première.
3. Principe 4 : plateau arrière 76 % au loin (c 0,24, S4 témoin tenu) ou 80 % (c 0,20, S4 témoin à revoir).

## Rejouer

```bash
node tools/banc-conduite.mjs --json r.json                 # banc complet v3
node verifications/conduite-p10.test.mjs --json r.json     # 85 cibles, 17B obligatoire
node verifications/conduite-criteres.test.mjs
node verifications/conduite-relief.test.mjs
node tools/banc-conduite.mjs --court
python3 construire.py && node tools/banc-conduite.mjs --script-page p.js \
  && node tools/page-essai.mjs dist/bitume.html p.js > s.json && node tools/banc-conduite.mjs --verifier-page s.json
git checkout -- dist VERSION.json SIZE.json
node tools/cout-pas.mjs --src src --contre <arbre de 17A>/src --essais 7
```
