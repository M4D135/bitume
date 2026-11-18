# Lot 22 — Circuits et génération procédurale : relief, chaussée, aménagements, matières, diversité

Date : **18 novembre 2026**. Statut : **étude et plan ; aucune source du jeu modifiée**. Branche `etude/procedural`
(arbre `~/Projects/bitume-wt/procedural`, base `e96eeaf`, BITUME 0.2.39, physique `p9`).

Demandes de David (18/11) :

- lot 22 (AGENTS.md) : « améliore la géération procedurale, rend la plus détaillée, meilleures matières etc, plus
  diversivfié et aléatoire » ;
- « ajoute plus de relief aux circuits, plus d'irrugularité sur les routes, plus d'aménagement accessoire course etc » ;
- tunnels : « plus de passage en tunnel, améliore eclairages dans tunnel, pas de clipping ».

Cadre : AGENTS.md demande de préserver les sept circuits, leurs identifiants et leurs graines ; tout changement de
conduite change la version de physique (`p9` → `p10`, lot 17), donc les bosses qui agissent sur la voiture
l'attendent ; l'éclairage, tunnels compris, relève du lot 21 (photoréalisme).

Preuves : `docs/reprise/rapports/procedural-2026-11-18/` (mesures, profils, 174 captures en 14 planches, prototype 22A
avec ses 8 planches en jeu). Outils neufs : `tools/profil-circuits.mjs`, `tools/circuits-commun.mjs`,
`tools/profil-svg.mjs`, `tools/tour-captures.mjs`, `tools/prototype-relief.mjs`.

## 0. En bref

1. **Le relief existe mais il est écrasé et invisible.** Trois sinusoïdes par circuit (longueurs d'onde tirées de
   728 à 2 617 m) ; un plafond de pente de 6,8 % appliqué par **un seul facteur à tout le tour**, déclenché par le
   raccord de 120 m de la ligne droite des stands. Haut-Col (montagne, amplitude prévue 32 m) est réduit à
   **× 0,22**, soit 13,2 m de dénivelé. Hors de ces raccords, les crêtes et cuvettes ont des rayons verticaux de
   **2 950 à 25 800 m** (charge ±0,01 à 0,17 g) : sur 87 positions en vue cockpit, la route ne disparaît derrière une
   crête **qu'une fois**, sur un raccord (Roche-Fauve 400 m).
2. **Le dévers est un reflet de la courbure** (courbure × 1,6, plafond 2,6°) : 70 à 84 % du tour à moins de 0,05°,
   aucun virage en contre-dévers, aucune pente d'écoulement en ligne droite.
3. **La chaussée est un ruban parfait** : 12 m partout, un seul quadrilatère en travers (pas de bombement possible),
   teinte qui varie sur 90 m, motifs en coordonnées monde (pas alignés sur la piste), vibreurs plats de 5 cm.
4. **Les abords sont vides et répétitifs** : 12 à 14 m d'herbe ou de sable uniforme jusqu'à la glissière ; publicité
   tous les 36 m en ligne droite ; repères et pneus seulement devant les virages de rayon < 95 m ; un poste de
   commissaires tous les 380 à 540 m ; une seule passerelle ; tribunes et public seulement sur la ligne droite.
   39 à 66 % des cases de 100 m n'ont au plus qu'une famille de mobilier.
5. **Le prototype 22A** (sans toucher aux sources) rend l'amplitude des thèmes et place des crêtes, compressions et
   creux bornés par la vitesse : dénivelé 13,2 → **50,5 m** à Haut-Col, 13,4 → **34,2 m** à Cap-Séquoia,
   27,2 → **45,3 m** à Roche-Fauve ; voiture masquée par une crête à moins de 120 m sur 2,7 à 11,6 % du tour
   (1,0 à 2,7 % aujourd'hui) ; charges toujours sous le plafond fixé (pas de décollage à 1,05 × la vitesse de
   référence). Visible en jeu (planches `prototype-22a/captures/` : crête aveugle de Cap-Séquoia 1 600 m, vallée
   de Haut-Col 4 000 m), mais **les 30 premiers mètres de sol suivent la piste comme un ruban** : sans tranchée ni
   remblai, la piste paraît inclinée plutôt que posée dans un paysage. Le terrain des abords fait donc partie de 22A.
6. Ordre proposé : **22A** (relief, dévers, terrain des abords, passages couverts) → **22D** (matières et coordonnées de
   piste) → **22B** (irrégularités, visuel puis `p10`) → **22C** (aménagements) → **22E** (diversité). Chaque
   sous-lot se livre seul, derrière une version de génération ; les empreintes historiques du décor restent.

## 1. Mesures (sources lues sans modification)

Commande : `node tools/profil-circuits.mjs --src ~/Projects/bitume/src` (25 s). Fichiers : `tableaux.md`,
`profils.json`, `axes/<id>.csv` (axe tous les 10 m), `profils/<id>.png` et `profils/sept-circuits.png`.

### 1.1 Relief

| Circuit | Thème (amplitude prévue) | Longueurs d'onde tirées | Facteur d'écrasement | Dénivelé | Pente max | R vertical des crêtes et cuvettes (hors raccords) | Raccords de la ligne droite : R mini crête / cuvette, charge max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Val-Brûlé | forêt (14 m) | 844 m (trois fois) | × 0,94 | 12,2 m | 6,8 % | 2 952 m partout, ±0,17 g au plus | 475 / 462 m, −0,74 / +0,90 g |
| Port-Sable | côte (6 m) | 728, 910, 1 819 m | × 1,00 | 10,1 m | 3,5 % | 3 870 à 8 731 m, ±0,05 g | 1 057 / 1 023 m, −0,18 / +0,26 g |
| Haut-Col | montagne (32 m) | 1 304 (deux fois), 1 739 m | × 0,22 | 13,2 m | 6,8 % | 7 640 à 13 878 m, ±0,07 g | 498 / 541 m, −0,36 / +0,29 g |
| Lande-Noire | islande (21 m) | 1 154, 1 539 m (deux fois) | × 0,48 | 12,9 m | 6,8 % | 6 204 à 18 676 m, ±0,07 g | 461 / 498 m, −0,73 / +0,63 g |
| Roche-Fauve | désert (26 m) | 1 209, 1 611, 2 417 m | × 0,60 | 27,2 m | 6,8 % | 4 230 à 8 305 m, ±0,09 g | 512 / 448 m, −0,42 / +0,43 g |
| Brume-de-Jade | asie (23 m) | 1 255 (deux fois), 2 509 m | × 1,00 | 24,8 m | 5,5 % | 4 891 à 12 791 m, ±0,08 g | 673 / 518 m, −0,32 / +0,34 g |
| Cap-Séquoia | pacifique (20 m) | 2 617 m (trois fois) | × 0,46 | 13,4 m | 6,8 % | 25 819 m, ±0,01 g | 575 / 527 m, −0,89 / +0,77 g |

- `circuit.js`, `relief()` : `y = Σ harmoniques / somme × A × (1 − plat)`, puis si la pente dépasse 6,8 % quelque part,
  **tout le tour** est multiplié par `0,068 / pmax`. La pente la plus forte naît du raccord de 120 m (`lisse(0, 120)`)
  entre la ligne droite tenue plate et le relief : c'est lui qui fixe le facteur sur les cinq circuits écrasés
  (Haut-Col : 30,8 % au raccord contre 13,4 % pour les harmoniques seules ; Cap-Séquoia 14,8 % contre 3,5 % ;
  Lande-Noire 14,0 % contre 6,7 %). Sans ce raccord, Cap-Séquoia, Lande-Noire et Val-Brûlé ne seraient pas écrasés
  et Haut-Col le serait à × 0,51 au lieu de × 0,22. Le seul relief ressenti du tour est donc ce raccord, en sortie
  et en entrée de ligne droite.
- Chaque harmonique a pour longueur d'onde le tour divisé par k, k tiré de 1 à 5. Val-Brûlé tire trois fois k = 5 :
  une seule sinusoïde de 844 m, d'où ses crêtes et cuvettes toutes de rayon 2 952 m ; Cap-Séquoia tire trois fois
  k = 2 : une seule ondulation de 2 617 m (R 25 819 m), invisible. De l'œil du pilote (1,05 m), une voiture n'est
  masquée par le relief à moins de 120 m que sur 1,0 à 2,7 % du tour (calcul sur le profil en long, tracé en plan
  ignoré). Les charges au-delà de 0,2 g ne viennent que des raccords de 120 m.
- Le modèle `p9` applique la pente (gravité le long de la piste) et le dévers, pas la courbure verticale : une crête
  n'allège pas la voiture, une compression ne l'écrase pas. La vitesse de référence (`vitesses()`, IA, réalisateur)
  ignore pente et dévers.

### 1.2 Dévers, largeur, courbures

| Circuit | Dévers max | Tour > 1° | Tour à plat (< 0,05°) | Virages relevés / contraires / plats | Lignes droites (R > 900 m) | Plus longue |
| --- | --- | --- | --- | --- | --- | --- |
| Val-Brûlé | 2,49° | 4,9 % | 70,2 % | 10 / 0 / 1 | 75,0 % | 526 m |
| Port-Sable | 2,58° | 9,3 % | 73,9 % | 8 / 0 / 1 | 78,0 % | 484 m |
| Haut-Col | 2,31° | 1,7 % | 78,4 % | 7 / 0 / 1 | 81,4 % | 612 m |
| Lande-Noire | 2,56° | 4,3 % | 83,5 % | 6 / 0 / 1 | 86,7 % | 624 m |
| Roche-Fauve | 2,58° | 7,6 % | 73,1 % | 10 / 0 / 0 | 77,7 % | 530 m |
| Brume-de-Jade | 2,29° | 7,0 % | 79,2 % | 9 / 0 / 0 | 83,0 % | 684 m |
| Cap-Séquoia | 2,12° | 6,8 % | 76,7 % | 10 / 0 / 0 | 80,3 % | 524 m |

- Dévers = `borner(courbure × 1,6, ±0,045 rad)` lissé sur ±20 m, nul sur la ligne droite. Aucun contre-dévers,
  aucune pente transversale d'écoulement, aucun bombement.
- Largeur 12 m sur les sept circuits ; dégagement bord → glissière médian 14 m (minimum 1,6 m au tunnel).
- `decor.js`, `nappesRoute()` : neuf bandes en travers (jupe, herbe, bord, ligne, **asphalte**, ligne, bord, herbe,
  jupe) ; l'asphalte est **un seul quadrilatère** de −5,7 à +5,7 m. Teinte `0,165 + 0,035 × fbm(s / 90 m)` ; vibreurs
  rouges et blancs par tranches de 4 m, relevés de 5 cm au bord extérieur, sans relief propre.

### 1.3 Terrain des abords

- `nappesTerrain()`, `hauteur()` : jusqu'à 26-34 m de l'axe, le sol vaut l'altitude pondérée de l'axe moins 0,9 m ; le
  relief naturel (`fbm`) n'entre qu'avec `lisse(30, 260, d)` : **complet seulement à 260 m**. Les abords sont donc un
  ruban plat qui suit la piste.
- Montagne : `(120 + 260 × crête) × lisse(380, 1 050, d)` — des parois de 120 à 380 m qui montent entre 380 et
  1 050 m de la piste, lues en jeu comme des rideaux verticaux à stries (§ 2). Asie : sept sommets en cloche de 160 à
  285 m, posés dans la grille du terrain. Islande : deux caldeiras. Ces fonds sont des hauteurs de la grille de 24 m.
- L'eau descend toujours sous le point le plus bas de l'axe (`th.eau ≤ yMin − 2,5`).

### 1.4 Mobilier de course (`decor.js`, `construire()`)

| Famille | Règle actuelle | Val-Brûlé … Cap-Séquoia |
| --- | --- | --- |
| Glissières | une lisse sur poteaux, par tronçons de 4 m, à la limite des deux côtés | 1 056 à 1 310 lisses |
| Publicités | lignes droites (R > 500 m), un panneau tous les 9 tronçons (36 m), probabilité 0,7, deux boîtes colorées | 57 à 85 panneaux |
| Repères de freinage | 150 / 100 / 50 m (3, 2, 1 barres) à l'extérieur, **seulement si R < 95 m** | 3 à 7 virages équipés |
| Murs de pneus | même condition, de −16 à +28 m autour du sommet, devant la glissière | 216 à 504 pneus |
| Commissaires | tous les 380 à 540 m, côtés alternés, derrière la glissière | 8 à 11 postes |
| Départ | grille, portique des feux, tribunes à gauche (72 m), stands à droite (60 m) | identique partout |
| Passerelle | une, vers 45 % du tour | 1 |

- Répartition par cases de 100 m : 2,1 à 15,3 % des cases sans aucun mobilier à moins de 40 m ; **39,2 à 66,0 %**
  avec au plus une famille ; Cap-Séquoia : 9,6 % des cases sans arbre, rocher ni maison à 120 m.
- Végétation basse absente à Lande-Noire, Roche-Fauve, Brume-de-Jade et Cap-Séquoia ; aucun arbre à Lande-Noire et
  Roche-Fauve ; rochers : 0 à 768 selon le thème.
- Hasard : un seul générateur `r = alea(g)` du décor sert aux publicités, tribunes, commissaires, passerelle ; arbres,
  villages et rochers ont des générateurs dédiés (`g ^ constante`). L'ordre des obstacles découle de l'ordre des lots ;
  `verifications/decor-identite.test.mjs` fige 9 empreintes historiques.

### 1.5 Matières

- Recettes FERRO : celles de la chaussée, du béton, de la roche et du métal peint (21 à 24, `MATIERES_PILOTES`) ne
  servent qu'au thème forêt, donc à **Val-Brûlé seul** (où la roche 23 n'a pas d'objet) ; humus, écorce et feuillage
  (25 à 27) servent à tous les arbres. Les six autres circuits gardent l'asphalte PDR historique (matière 14 :
  granulat, reprises, fissures en coordonnées monde), comme les lignes et les vibreurs de Val-Brûlé.
- **Anomalie** : les cabanes de commissaires portent la matière **13,6** ; le shader range `13,5 ≤ m < 14,5` dans la
  branche asphalte (granulat, reprises, fissures) et la pluie les mouille comme la chaussée (`step(13.5, m)`). Le
  rythme des façades n'est défini que de 12,55 à 13,45 : sans doute une valeur de façade mal placée, à confirmer.
- Diversité : le témoin forêt de graine 96 (celle des tests) a **la même palette et la même ambiance** que Val-Brûlé :
  aujourd'hui la graine change le tracé, jamais le style.

## 2. Tour de captures : ce qui paraît plat, vide, répétitif ou artificiel

`node tools/tour-captures.mjs` : 7 circuits, une position tous les 400 m depuis la ligne (87 positions), vue cockpit à
144 km/h (vraie caméra, rivaux à l'autre bout du tour, affichage tête haute masqué) et vue de bord de piste (spectateur
debout à 4,5 m du bord, à l'extérieur du virage qui suit). Qualité high, été, jour ; horloge commandée. Planches :
`captures/planche-<id>-cockpit.jpg` et `-bord.jpg`.

**Plat.**
- Sur 85 des 87 vues cockpit, l'horizon reste à la même hauteur et la piste file à plat jusqu'au fond. Les deux
  exceptions sont des raccords de la ligne droite : Roche-Fauve 400 m (+6,8 %, la route passe une crête et disparaît
  derrière) et Cap-Séquoia 400 m (−6,7 %, creux puis remontée). À Val-Brûlé 4 000 m (−6,4 %, raccord aussi), la
  descente vers les stands se devine à peine.
- En bord de piste, la chaussée, l'accotement et la prairie sont dans un même plan jusqu'à 30 m : la piste est posée
  sur une table. Aucun talus, aucune tranchée, aucun remblai.
- Le dévers ne se lit nulle part (2,6° au plus, et seulement au sommet des virages serrés).

**Vide.**
- 12 à 14 m d'herbe tondue ou de sable uniforme entre le bord et la glissière, sur tout le tour : ni bac à gravier,
  ni dégagement goudronné, ni route de service, ni grillage, ni talus de spectateurs.
- Hors de la ligne droite, aucun spectateur, aucun véhicule, aucune tente. Les postes de commissaires n'apparaissent
  que sur quelques vues (Val-Brûlé 1 600 m et Haut-Col 4 000 m en bord de piste), cabane blanche et drapeau jaune
  derrière la glissière.
- Val-Brûlé « forêt » : ni sous-bois ni lisière au bord de la piste ; une rangée d'arbres à 50-150 m à 800 m, des
  arbres isolés ailleurs (1 600, 3 600 m). Port-Sable « côte » et Cap-Séquoia « pacifique » : la mer prévue par le
  thème ne se voit d'aucune des 24 positions. Lande-Noire et Roche-Fauve : aucun arbre.

**Répétitif.**
- Quatre à cinq vues cockpit sont interchangeables sur cinq circuits (route grise, champ plat, horizon plat) :
  Port-Sable 800, 1 200, 2 000, 2 400, 2 800 m ; Lande-Noire 800, 1 200, 2 400, 3 200, 4 000 m ; Cap-Séquoia 1 600,
  2 000, 2 400, 2 800 m ; Brume-de-Jade 1 200, 1 600, 2 400, 4 400 m ; Val-Brûlé 1 200, 2 400, 2 800, 3 600 m.
- La ligne droite des stands est la même scène sur les sept circuits (tribune bariolée à gauche, bâtiment à droite,
  portique) : seule la couleur du sol change.
- Publicités : boîtes unies à deux tons, sans motif ; repères de freinage tous identiques ; piles de pneus alignées
  au cordeau ; bosquets de conifères de même hauteur (Cap-Séquoia).

**Artificiel.**
- Haut-Col : les montagnes sont des **rideaux verticaux gris à stries régulières**, au sommet presque plat, qui
  ferment l'horizon de presque toutes les vues (800, 1 200, 2 400, 4 000, 4 400 m) ; la piste est dans une plaine au
  pied. La colline du tunnel est un tas de blocs anguleux, bas, posé sur cette plaine (1 600 m).
- Brume-de-Jade : pains de sucre lisses, mêmes profils répétés par groupes de deux ou trois (800, 2 000, 3 200 m),
  piliers de roche sombres isolés (1 200 m) ; aucune brume malgré le nom.
- Lande-Noire : rochers en parallélépipèdes sombres, qui se lisent de loin comme des immeubles (400, 1 200 m).
- Roche-Fauve : dômes de sable lisses, rochers en blocs cubiques (800, 2 800, 3 200 m).
- Chaussée : gris presque uniforme, sans trajectoire gommée ni rapiéçage lisible ; vibreurs plats peints.
- Tunnel de Haut-Col (2 000 m) : section carrée, murs sombres quadrillés, petites lampes espacées (une tous les 12 m
  de chaque côté, en quinconce) sans flaque de lumière sur la chaussée, sortie en rectangle blanc saturé ; aucune
  coupe de géométrie sur les deux vues prises dedans. L'éclairage est à reprendre au lot 21.
- Les plus naturels : les collines de Lande-Noire et de Cap-Séquoia au loin.

## 3. Références (années 1970-1980 et normes)

**Relief de grands circuits.** Raidillon (Spa) : environ 17 % et 40 m de montée, compression au bas de l'Eau Rouge
citée de 1,7 à 3 g selon l'époque et la source ; Spa, environ 100 m entre le point le plus haut et le plus bas.
Corkscrew (Laguna Seca) : 12 % à l'entrée, 18 % au point le plus raide, 18 m de chute sur environ 137 m.
Nordschleife : environ 300 m de dénivelé, 17 % en montée, 11 % en descente. Ordres de grandeur pour BITUME : 5 à 50 m de
dénivelé selon le thème, 6 à 10 % de pente, crêtes de rayon 300 à 900 m aux vitesses moyennes.

**Pente transversale et relevé.** Texte FIA cité : en ligne droite, pente transversale d'écoulement de 1,5 à 3 % ; en
virage, relevé d'au plus 10 % (5,7°). Route courante : 2 % en alignement.

**Rugosité.** ISO 8608 : densité spectrale de hauteur `Gd(n) = Gd(n0)·(n/n0)^−2`, `n0 = 0,1 cycle/m` (10 m) ; classes
A à H, chaussées revêtues de A à D ; moyenne de classe A : `Gd(n0) = 16·10⁻⁶ m³`. Calcul pour 22B : écart type des
hauteurs entre 1 et 10 m de longueur d'onde = 1,2 mm (A), 2,4 mm (B), 4,8 mm (C) ; entre 10 et 90 m, 3,6 mm (A),
7,2 mm (B). Les plaintes de pilotes portent sur des bosses localisées, des raccords et des rapiéçages qui se
dégradent (repavages successifs).

**Gommes.** La trajectoire s'assombrit au fil des tours (dépôt de gomme, plus d'adhérence au sec) ; les « billes »
de gomme et de poussière s'accumulent hors trajectoire et glissent.

**Mobilier de l'époque (Grand Prix).** 1967 : bottes de foin interdites comme protection ; 1970 : accotements d'au
moins 3 m, doubles glissières, public à 3 m au moins derrière les grillages, bottes de paille interdites ; 1972 :
grillages anti-débris ; 1973 : filets d'arrêt ; 1975 : postes de commissaires et routes de service ; 1977 : bacs à
gravier ; 1981 : murs de pneus, voie des stands d'au moins 10 m ; 1985 : filets interdits. Postes : protégés de fûts
de sable dans les années 1970 ; chaque poste en contact visuel avec le précédent et le suivant (annexe H FIA ; la
distance entre postes n'a pas été lue, le PDF n'étant pas lisible ici). Panneaux de freinage : 300 / 200 / 100 m le
plus souvent, parfois 150 et 50 m.

Sources : [Mercedes-AMG F1, relief](https://www.mercedesamgf1.com/news/the-impact-of-track-elevation-in-f1) ·
[Motor Sport, Eau Rouge](https://www.motorsportmagazine.com/articles/single-seaters/f1/eau-rouge-the-corner-that-could-not-be-built-today/) ·
[F1technical, Spa](https://www.f1technical.net/news/25100) ·
[Laguna Seca, informations piste](https://weathertechraceway.com/pages/track-information) ·
[Nürburgring Langstrecken-Serie](https://www.nuerburgring-langstrecken-serie.de/en/the-nurburgring) ·
[Red Bull, Nordschleife](https://www.redbull.com/us-en/nurburgring-10-iconic-corners) ·
[Cross slope](https://en.wikipedia.org/wiki/Cross_slope) ·
[Motorsport.com, grade FIA](https://www.motorsport.com/f1/news/fia-grade-1-what-it-means-and-why-its-the-minimum-to-host-an-f1-race/10772878/) ·
[ISO 8608, profils artificiels](https://link.springer.com/article/10.1007/s40534-017-0122-1) ·
[Building Speed, gomme](https://buildingspeed.org/2016/08/05/how-tracks-take-and-lose-rubber/) ·
[Formula 1 Dictionary, sécurité des circuits](https://formula1-dictionary.net/safety_racing_track.html) ·
[Motor Sport, 1975](https://www.motorsportmagazine.com/archive/article/february-1975/28/the-song-of-the-grand-prix-driver/) ·
[FIA, annexe H](https://www.fia.com/sites/default/files/appendix_h_2021_published_09_03_2021_0.pdf) ·
[Autosport, bosses de COTA](https://www.autosport.com/f1/news/cota-undertaking-track-resurfacing-to-fix-bumps-after-f1-and-motogp-complaints/7472176/).
Les chiffres de magazines varient d'une source à l'autre : ce sont des ordres de grandeur, pas des cotes.

## 4. Contraintes communes à tous les sous-lots

- Tracé en plan (x, z), identifiants, graines, longueurs : inchangés. Les tirages actuels (`r` du tracé, `r` du décor,
  générateurs dédiés) gardent leur ordre et leur nombre ; chaque nouveauté tire dans **son propre générateur**
  (`alea(graine ^ constante)`), jamais dans le hasard de course.
- Génération versionnée : `c.generation = 2` (circuit.js) et `options.generation` côté décor ; la génération 1 reste
  disponible et `decor-identite.test.mjs` garde ses 9 empreintes ; de nouvelles empreintes figent la génération 2.
- Obstacles : les nouveaux solides s'ajoutent **après** les historiques dans chaque lot ; l'ordre des obstacles
  existants ne bouge pas.
- Décor par lots de 150 m (version proche et version lointaine) et cellules lointaines de 420 m ; rien n'est coupé au
  loin (la brume fait la limite) ; tout est préparé au chargement, aucun travail par image.
- Qualité Légère (`low`) : mêmes géométries de collision, pas de nouvelle passe de rendu ; les détails fins
  (normales de chaussée, petits objets) s'arrêtent à la version lointaine.
- Records et fantômes : aujourd'hui rangés par `PHYSIQUE` (`p9`) et longueur ; un nouveau relief à longueur égale
  ferait rejouer d'anciens fantômes sur un autre profil. Clé de rangement : physique **et** génération de circuit.

## 5. Plan par sous-lot

### 22A — Relief, dévers, terrain des abords, passages couverts

**Ce qui se voit.** Montées et descentes de 6 à 10 %, crêtes aveugles avant les freinages, crêtes en sortie de
virage lent, compressions dans les courbes rapides, bosses et creux de ligne droite ; virages relevés jusqu'à 5,7°,
quelques contre-dévers, pente d'écoulement de 1,5 à 2,5 % en ligne droite ; abords en tranchée ou en remblai ; de
nouveaux passages couverts.

**Prototype livré** (`tools/prototype-relief.mjs`, fonction autonome `relief22A`, même source dans Node et dans la
page) :
1. *Fond* : les trois harmoniques actuelles, **mêmes tirages** (vérifié : reproduction exacte de `circuit.js` sur les
   sept circuits, écart < 10⁻⁶ m), sans l'écrasement global.
2. *Événements* (générateur `graine ^ 0x22A0BEEF`) : candidats typés lus sur la courbure et la vitesse de référence
   (crête 50 à 110 m avant l'entrée d'un virage, si l'approche fait au moins 160 m et que la référence y dépasse
   162 km/h ; crête 30 à 80 m après un virage pris à moins de 151 km/h ; compression 10 à 40 m avant le sommet des
   courbes de 110 à 700 m de rayon ; bosse ou creux à mi-chemin des approches de plus de 360 m). Hauteur tirée par
   thème, **largeur dictée par la vitesse** : `σ ≥ √(A·v²/(0,85·α·g))`, 28 m au moins.
3. *Ondulations* : cinq longueurs d'onde de 60 à 260 m, amplitude bornée sur place par la vitesse.
4. *Contraintes* sur la pente `p = dy/ds`, par passes avant-arrière comme un profil de vitesse : plafond par thème
   (6 % côte, 8 % ailleurs, 10 % montagne), variation bornée par `α·g/v²` à 1,05 × la vitesse de référence
   (allègement 0,25 à 0,45 g, écrasement 0,5 à 0,9 g selon le thème), ligne droite des stands à plat, tunnel régulier
   (pente ≤ 5 %, R ≥ 3 000 m), tour refermé exactement.
5. *Dévers* : virages répartis relevés / contraires / plats selon les parts du thème, relevé visé de 4 à 5,7° selon le
   thème (10 % au plus), contre-dévers jusqu'à −2°, pente d'écoulement 1,5 à 2,5 % en ligne droite, nul sur la ligne
   des stands et dans le tunnel, lissé sur ±40 m (d'où 2,4 à 4,9° mesurés).

| Circuit | Dénivelé | Pente max | Tour > 3 % | R vertical mini crête / cuvette | Allègement / écrasement max | Voiture masquée < 120 m | Dévers max | Relevés / contraires / plats |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Val-Brûlé | 12,2 → **17,1 m** | 6,8 → **8,0 %** | 47,9 → 47,0 % | 475/462 → **855/498 m** | −0,74/0,90 → **−0,32/0,63 g** | 2,1 → **6,1 %** | 2,5 → **4,3°** | 10/0/1 → **6/3/2** |
| Port-Sable | 10,1 → **10,1 m** | 3,5 → **6,0 %** | 6,0 → 9,5 % | 1 057/1 023 → **686/1 108 m** | −0,18/0,26 → **−0,23/0,23 g** | 1,0 → **2,7 %** | 2,6 → **3,9°** | 8/0/1 → **5/0/4** |
| Haut-Col | 13,2 → **50,5 m** | 6,8 → **10,0 %** | 2,7 → 63,0 % | 498/541 → **292/211 m** | −0,36/0,29 → **−0,41/0,82 g** | 1,4 → **11,6 %** | 2,3 → **4,0°** | 7/0/1 → **4/2/2** |
| Lande-Noire | 12,9 → **25,4 m** | 6,8 → **7,9 %** | 9,8 → 36,6 % | 461/498 → **317/269 m** | −0,73/0,63 → **−0,36/0,72 g** | 2,7 → **7,7 %** | 2,6 → **2,4°** | 6/0/1 → **3/2/2** |
| Roche-Fauve | 27,2 → **45,3 m** | 6,8 → **8,0 %** | 26,9 → 48,1 % | 512/448 → **530/339 m** | −0,42/0,43 → **−0,36/0,68 g** | 1,6 → **6,7 %** | 2,6 → **4,9°** | 10/0/0 → **6/2/2** |
| Brume-de-Jade | 24,8 → **24,2 m** | 5,5 → **7,9 %** | 34,9 → 32,1 % | 673/518 → **468/588 m** | −0,32/0,34 → **−0,32/0,59 g** | 2,1 → **4,1 %** | 2,3 → **4,7°** | 9/0/0 → **5/2/2** |
| Cap-Séquoia | 13,4 → **34,2 m** | 6,8 → **8,0 %** | 3,4 → 33,4 % | 575/527 → **321/290 m** | −0,89/0,77 → **−0,32/0,64 g** | 2,1 → **4,9 %** | 2,1 → **4,2°** | 10/0/0 → **8/2/0** |

Charges mesurées à la vitesse de référence (v²/R vertical sur ±10 m). Talus entre deux portions voisines du tour
(différence d'altitude sur l'écart restant hors des 30 m collés à la piste) : 0,05 à 0,20, aucune paire au-delà de
0,5. Le tour se referme exactement sur les sept circuits. Calcul : 3 à 11 ms par circuit (Node, M5), contre 19 à
38 ms pour `creer()`. Profils avant/après : `prototype-22a/<id>.png` et
`sept-circuits-propose.png` ; en jeu (script injecté, sources intactes) :
`prototype-22a/captures/planche-{haut-col,cap-sequoia,roche-fauve,val-brule}-*-prototype-22a.jpg`. Relief lisible
depuis le cockpit : Haut-Col 1 200 m (creux puis remontée devant), 2 800 m (longue montée devant), 4 000 m (−10 %,
la vallée s'ouvre) ; Cap-Séquoia 400 m (−8 %, creux puis remontée), 1 600 m (crête aveugle : la route disparaît
40 m devant, la crête avant freinage tirée à 1 638 m).

**Ce qui manque au prototype et fait partie du sous-lot.**
- *Terrain des abords* (`decor.js`, `hauteur()`) : laisser le relief naturel entrer dès 8 à 12 m au-delà de
  l'accotement, en talus de 1/1,5 à 1/3 : **tranchée** quand le terrain naturel est au-dessus de la piste,
  **remblai** quand il est dessous ; c'est ce qui fait « asseoir » la piste. La pondération en 1/d⁸ de `indexAxe`
  reste ; seule la loi `lisse(30, 260, d)` change en génération 2.
- *Passages couverts* (demande du 18/11) : générateur commun à tous les thèmes, à partir des crêtes de 22A et des
  portions de rayon > 400 m : montagne, un second tunnel court (80 à 120 m) ; forêt et pacifique, un pont de route
  au-dessus de la piste (12 à 20 m couverts) ; côte, une arche de roche ; désert, un passage en canyon ; asie, une
  galerie couverte ; islande, un tunnel de lave. Mêmes règles que le tunnel de Haut-Col : murs aux limites, rien qui
  dépasse à l'intérieur, caméras extérieures basculées en poursuite (`DANS_LA_ROCHE`) ; l'éclairage est au lot 21.
- *Vitesse de référence* (`vitesses()`) : ajouter le dévers (`(μ + tan θ)/(1 − μ tan θ)`) et la limite de crête
  (`v ≤ √(g·R·(1 − marge))`), sinon l'IA est trop lente dans les virages relevés et, en `p10`, trop rapide sur les
  crêtes.
- *Caméras* : les caméras de bord de piste (`cameraTele`, `cameraSol` de `jeu.js`) et le réalisateur doivent vérifier
  la ligne de vue au-dessus du terrain ; une crête ne doit pas masquer la voiture filmée.

**Fichiers.** `src/circuit.js` (`relief()` en génération 2, dévers, `c.generation`, vitesses) ; `src/decor.js`
(`hauteur()`, passages couverts) ; `src/jeu.js` (clé des records et fantômes) ; `src/realisateur.js` et caméras de
`jeu.js` (ligne de vue) ; tests `verifications/circuit.test.mjs` (fermeture, plafonds de pente et de charge, ligne des
stands plate, tunnel régulier, génération 1 identique) et `decor-identite.test.mjs` (nouvelles empreintes).

**Ce qui attend `p10`.** Allègement et écrasement sur les crêtes et compressions (charge normale
`m·(g·cos θ + v²·κv)`), perte d'adhérence au sommet, décollage. Le prototype garde une marge : aucune crête ne fait
décoller à 1,05 × la vitesse de référence ; un vrai saut ne se fera qu'avec `p10` et sur demande.

**Coût estimé.** Relief, dévers et terrain : 1,5 à 2 jours de session (circuit.js ≈ 180 lignes, decor.js ≈ 60 lignes,
jeu.js ≈ 30 lignes, tests ≈ 150 lignes). Passages couverts : 1,5 jour de plus (géométrie par thème, contrôle des
coupes caméra par caméra). Au chargement, moins de 15 ms de plus par circuit.

**Captures de validation.** Tour complet avant/après sur les sept circuits (`tools/tour-captures.mjs --etiquette`) ;
vues fixes : Haut-Col 1 460 m (crête avant freinage), 2 808 m (crête de sortie), 4 382 m (compression) ; Cap-Séquoia
3 490 m ; un virage relevé et un contre-dévers en vue de poursuite ; chaque passage couvert en cockpit, poursuite,
télévision et rétroviseurs (aucune coupe de géométrie) ; Port-Sable et Cap-Séquoia en bord de mer.

### 22B — Irrégularités de chaussée

**Ce qui se voit et s'entend.** Une chaussée qui vit sous la lumière rasante : micro-relief (ISO 8608 classe A à B :
1 à 2,5 mm d'écart type entre 1 et 10 m, 4 à 7 mm entre 10 et 90 m), joints de répandage longitudinaux tous les 3,5 à
4 m, joints transversaux, rapiéçages rectangulaires de 3 à 8 mm de marche, ornières légères de 2 à 5 mm aux traces
des roues dans les zones de freinage, bosses de tassement de 1 à 3 cm sur 2 à 6 m (deux à six par tour), vibreurs en
relief (dents de 2 à 3 cm). Le son du pneu change sur les raccords et rapiéçages ; la manette vibre sur les bosses
(lot 24).

**Deux étapes.**
- *22B-1, sans effet sur la voiture* : normales et teinte de chaussée calculées depuis les coordonnées de piste
  (s, d) — pas de géométrie qui sorte de plus de 1 cm du plan de `p9` ; bande d'asphalte à 7 sommets en travers
  (bords, traces des roues, axe) pour que la lumière rasante et l'eau (flaques dans les ornières, `meteo.js`) s'y
  accrochent ; sons et vibrations déclenchés par une table d'événements le long de s.
- *22B-2, avec `p10`* : bombement de 1,5 à 2,5 % (9 à 15 cm au bord : impossible sans que la physique lise la même
  hauteur), bosses qui excitent les suspensions. Une seule fonction `hauteurChaussee(c, s, d)` dans `circuit.js`,
  lue par `conduite.js` et par `decor.js`, sinon les roues s'enfoncent ou flottent.

**Fichiers.** `src/circuit.js` (table des irrégularités, générateur `graine ^ 0x22B…`) ; `src/decor.js`
(`nappesRoute()` : 7 sommets en travers, coordonnées s et d dans les 3 flottants libres du sommet) ;
`src/moteur/renderer.js` (branche asphalte et recette 21 : normales et teinte en (s, d)) ; `src/son.js` ;
`src/jeu.js` (vibrations) ; en 22B-2 `src/conduite.js`.

**Contraintes.** Déterministe (fonction de s, d et de la graine) ; rien au hasard à l'exécution ; en Légère, la
bande reste à 2 sommets et les normales fines sont coupées ; sommets de la bande d'asphalte × 3,5 (3 700 à 5 300
aujourd'hui, soit +9 000 à +13 500 sommets par circuit).

**Coût.** 22B-1 : 1,5 jour ; 22B-2 : avec le lot 17. **Captures** : crépuscule et soleil rasant en cockpit et au
ras du sol (`--moment crepuscule`), pluie (flaques dans les ornières), même position avant/après.

### 22C — Aménagements de course

Catalogue par zone, chaque famille avec **son générateur** (`alea(g ^ constante)`), sa règle de placement lue sur la
courbure, la vitesse de référence, le côté et la visibilité (après 22A), sa version proche et lointaine :

| Zone | Familles (fin des années 1970 – 1980) | Règle de placement |
| --- | --- | --- |
| Approche de freinage | panneaux 300 / 200 / 100 m (150 / 100 / 50 si l'approche est lente), à l'extérieur | tout virage où la vitesse chute de plus de 40 km/h, plus seulement R < 95 m ; distance des panneaux selon la vitesse d'arrivée |
| Extérieur des virages | bac à gravier (nappe), murs de pneus à la zone d'impact, filets d'arrêt sur poteaux dans les courbes rapides ; bottes de paille seulement pour une ambiance de circuit de club (interdites en Grand Prix dès 1970) | zone d'impact = prolongement de la tangente d'entrée jusqu'à la limite ; bac de l'entrée −20 m à la sortie +60 m pour R < 300 m |
| Intérieur des virages | vibreurs en relief, bordure de gazon ras, plots de corde | sommet ± longueur du vibreur |
| Lignes droites | publicités peintes sur glissières et sur bâches (marques imaginaires), grillages et talus de spectateurs, camions, tentes, parkings, tour de télévision en bout de droite | publicités en séries de 3 à 7 avec trous ; spectateurs là où 22A donne un talus face à un freinage |
| Postes de commissaires | cabane, drapeaux, extincteurs, fûts ou sacs de sable, plateforme, dépanneuse à certains postes | tous les 300 à 500 m, **chacun en vue du précédent et du suivant** (ligne de vue sur le relief 22A), de préférence à l'extérieur des virages |
| Passerelles et ponts | passerelles à publicité (1 à 3 par tour), pont de route (passage couvert de 22A) | lignes droites, jamais au-dessus d'une zone de freinage |
| Stands et paddock | muret, panneautage, tour de chronométrage, podium, camions, motorhomes, tentes | ligne droite des stands et arrière des stands |
| Entourage | routes de service derrière les glissières, chemins, parkings, campings | le long des limites, hors des cases déjà occupées |

- **Marques imaginaires** : noms tirés de syllabes par le générateur 22C (jamais de vraie marque), logos géométriques
  (bandes, disques, losanges) sur une petite planche de textures générée au chargement ; si le moteur ne peut pas
  porter de texture de panneau, motifs procéduraux dans le shader des panneaux (matière 16).
- **Collision** : tout ce qui est en deçà de la limite (pneus, paille, panneaux, poteaux de filets) devient obstacle,
  ajouté après les historiques ; ce qui est au-delà n'en a pas.
- **Budget** : ≈ +1 500 à +3 000 objets proches par circuit (aujourd'hui 7 500 à 9 500 hors végétation basse, soit
  +20 à 35 %), quelques centaines en version lointaine, bacs à gravier ≈ +2 000 à +5 000 sommets de nappe ; contrôle
  avec `tools/budget-decor.mjs` au palier Légère et au palier high, comparé au 0.2.39.
- **Fichiers** : `src/decor.js` (catalogue et règles, de préférence un module `src/amenagements.js` chargé avant
  `decor.js`), `src/obstacles.js` (types de collision nouveaux : paille, filet), `construire.py` (ordre des
  modules), tests de décor (obstacles, empreintes génération 2).
- **Coût** : 2,5 à 3 jours, par familles livrables séparément (freinage et commissaires d'abord, puis gravier et
  pneus, puis lignes droites et entourage). **Captures** : tour complet en bord de piste, plus une vue par famille ;
  vérifier qu'aucune case de 100 m ne reste sans mobilier hors des portions boisées voulues.

### 22D — Matières

- **Asphalte** en coordonnées de piste (s, d) : neuf (sombre, granulat fin), ancien (gris clair, granulat apparent),
  rapiécé (rectangles plus sombres, bords nets), peint (lignes, damier de la grille), **trajectoire gommée** lue sur
  `c.ligne` (bande sombre plus marquée aux freinages et aux sorties), billes hors trajectoire dans les virages,
  traces de freinage avant les virages lents.
- **Béton** (muret des stands, tunnel, passerelles), **gravier** (bacs : nouvelle recette), **sable** (désert, bacs
  de Roche-Fauve), **terre** (routes de service, talus), **herbe** tondue à bandes, **roche** litée sur les pentes
  raides (remplace les stries verticales de Haut-Col), toutes en recettes FERRO.
- **Moteur** : étendre `MATIERES_PILOTES` (recettes 21 à 27) aux sept thèmes ; ajouter les recettes gravier et sable
  (`src/ferro/recipes.js`, `materials.js`, `surface.js`, branche du shader) ; faire passer s, d et un drapeau de zone
  dans les 3 flottants libres des sommets de nappe ; **corriger la matière 13,6 des cabanes de commissaires**
  (branche asphalte) ; consigner les changements du moteur dans `src/moteur/PROVENANCE.md`.
- **Contraintes** : Légère garde l'asphalte historique (matière 14) et des recettes simplifiées ; aucune texture
  téléchargée, tout reste procédural et dans la page.
- **Coût** : 1,5 à 2 jours. **Captures** : même vue de chaussée en plein jour, au crépuscule et sous la pluie, avant
  et après, sur trois thèmes ; gros plans des bacs et des talus.

### 22E — Diversité

- **Par graine, dans le cadre du thème** (générateur `graine ^ 0x22E…`) : teinte de l'herbe, du sable et de
  l'asphalte (±8 % en valeur, ±10° en teinte), couleurs des vibreurs (rouge-blanc, bleu-blanc, vert-blanc, jaune-noir),
  des glissières et des toits, style des tribunes (toit plat, en dents de scie, à mâts) et des postes, mélange des
  essences (parts tirées autour de celles du biome), ciel (couverture nuageuse, voile, brume au sol : Brume-de-Jade
  doit en avoir), hauteur du soleil de référence.
- **Silhouettes de fond** : montagnes de Haut-Col en crêtes déchiquetées et éboulis au pied (plus de rideau à sommet
  plat), pains de sucre de Brume-de-Jade aux profils variés avec bandes de végétation, dômes de Roche-Fauve en roche
  litée, forêt de Val-Brûlé jusqu'à 30-60 m de la piste par endroits, mer visible de Port-Sable sur au moins trois
  portions du tour.
- **Contrôle** : le témoin forêt de graine 96 doit différer de Val-Brûlé en palette, mobilier et ciel ; les sept
  circuits gardent leur identité de thème (planches côte à côte).
- **Fichiers** : `src/decor.js` (`THEMES`, `PUBLICITES`), `src/ambiance.js`, `src/saisons.js`, `src/ecologie.js`,
  `src/botanique.js`. **Coût** : 1 jour. **Captures** : planche « un circuit, trois graines » par thème.

## 6. Intégration proposée

1. **22A** d'abord : la génération 2 du relief et du dévers (porter `relief22A` dans `circuit.js` derrière
   `c.generation`), le terrain des abords, la vitesse de référence ; clé des records et fantômes. Si le lot 17 (`p10`)
   est prêt, livrer la même version de physique ; sinon la génération 2 roule en `p9` (pente et dévers seulement).
2. **Passages couverts** avec 22A (géométrie), l'éclairage au lot 21.
3. **22D** (coordonnées de piste et recettes), dont dépendent 22B-1 et les bacs de 22C.
4. **22B-1**, puis **22B-2** avec `p10` et le lot 24 (vibrations).
5. **22C** par familles ; **22E** en dernier, ou en parallèle de 22C sur les seules couleurs.

Chaque étape : tests Node, tour de captures avant/après, budget de décor en Légère et en high, empreintes de la
génération 1 inchangées.

## 7. Questions pour David

1. Dénivelé visé par thème : les valeurs du prototype (côte 10 m, forêt 17 m, islande 25 m, asie 24 m, pacifique
   34 m, désert 45 m, montagne 50 m) conviennent-elles, ou faut-il plus (Spa : 100 m ; Nordschleife : 300 m) ?
2. Pentes de 10 % en montagne et contre-dévers jusqu'à −2° : d'accord ?
3. Crêtes qui allègent la voiture : jusqu'où (0,25 à 0,45 g dans le prototype) ? Des sauts plus tard, avec `p10` ?
4. Records et fantômes : accepter qu'ils repartent à zéro avec la génération 2, ou garder l'ancien relief jouable
   (deux versions de chaque circuit) ?
5. Bombement de chaussée (9 à 15 cm au bord) : à faire avec `p10`, ou ne garder que le visuel ?
6. Époque du mobilier : fin des années 1970 (filets, paille, Armco nu) ou début des années 1980 (bacs à gravier, murs
   de pneus) — ou un mélange selon le circuit ?
7. Marques imaginaires sur les publicités : noms inventés tirés au hasard, ou une liste écrite par vous ?
8. Passages couverts : combien par circuit, et lesquels (pont de route, arche, galerie, second tunnel) ?

## 8. Fichiers de l'étude

- `tools/circuits-commun.mjs` — chargement des modules du jeu dans Node, catalogue, mesures du tracé, inventaire du
  décor par famille.
- `tools/profil-circuits.mjs` — mesures des sept circuits (JSON, tableaux, axes, profils SVG/PNG).
- `tools/profil-svg.mjs` — graphiques SVG et rendu PNG par Chrome sans interface.
- `tools/tour-captures.mjs` — tour de captures (cockpit, bord de piste) et planches ; `--injecter` pour un prototype.
- `tools/prototype-relief.mjs` — prototype 22A, mesures avant/après, profils, script de page.
- `docs/reprise/rapports/procedural-2026-11-18/` — `tableaux.md`, `profils.json`, `axes/`, `profils/`,
  `captures/` (14 planches, `tour.json`), `prototype-22a/` (`tableau.md`, `prototype-22a.json`, 8 profils, 8
  planches en jeu, `tour-prototype-22a.json`).

Régénérer : `node tools/profil-circuits.mjs --src <src>` ; `node tools/tour-captures.mjs --images <dossier>` ;
`node tools/prototype-relief.mjs --script-page /tmp/p22a.js` puis
`node tools/tour-captures.mjs --injecter /tmp/p22a.js --etiquette prototype-22a --sortie <dossier>`.
Les images unitaires (JPEG 960 × 540) ne sont pas versionnées ; seules les planches le sont.
