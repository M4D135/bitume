# Banc de conduite — mesures de base (18/11/2026)

Ce que le modèle de conduite actuel fait sur des manœuvres normalisées, chiffré, puis comparé à une F1 de 1980 et
à une conduite arcade agréable. Modèle décrit dans `MODELE.md` ; résultats bruts dans `banc-base.json`.

```
node tools/banc-conduite.mjs --json docs/reprise/rapports/conduite-2026-11-18/banc-base.json
banc v1 · empreinte 52a7484e7589dd23 · sources 7dd27cbbaa1e · Node v24.18.0 · 12 à 47 s de calcul selon la charge
```

L'empreinte porte sur les nombres bruts : deux passages la rendent au bit près, et un changement du modèle la change.
Pour le lot « fluidité » (allocations retirées de `src/conduite.js` à résultat identique) :
`node tools/banc-conduite.mjs --src <arbre>/src` doit rendre **52a7484e7589dd23**, ou `--court` **6dc495a68695aec5**
(même version de Node).

## En bref

- **Adhérence et freinage au niveau de 1980** : 2,2 à 2,6 g tenus entre 180 et 240 km/h, 2,1 à 2,7 g de
  décélération moyenne. **Puissance courte** : 316 ch à la roue au mieux, et elle croît avec le rapport (182 kW en
  1re, 233 kW en 6e).
- **Les virages rapides se prennent à fond** : dès R 250 m la voiture plafonne à la puissance (273 km/h, gaz 1,00)
  alors que l'adhérence tiendrait plus de 313 km/h.
- **L'appareil compte plus que le pilote** : avec des pédales tout ou rien (clavier, souris, doigt), la voiture
  perd 5 à 13 % en virage, 8 % dans la chicane, 11 à 13 % dans le slalom.
- **L'aide « Légère » écrête la limite des grands rayons** (−1,7 % en R 120, −3,4 % en R 180) et change les
  survirages de remise des gaz et de freinage en sous-virages vers l'herbe.
- **Sans aide**, freinage plein ou plein gaz trop tôt en appui : tête-à-queue.
- **Direction très vive** (lacet à 90 % en 75 à 121 ms), bien amortie à 100 km/h, **sous-amortie à 200 km/h**
  (dépassement de 17 à 25 %).
- **Dérive chargée trop simple** : palier III « parfait » en 2,1 s de R 80 à R 250 pour toutes les chaînes, tenue
  10 s sans coût, gain nul à la manette, +0,2 à +0,9 s au clavier dans les virages serrés.
- **Herbe presque gratuite à 100 km/h** (0,05 s pour 3 s dedans), **pluie douce** (−9 à −15 % en virage).
- **Une seule constante, l'exposant de motricité 1,3, explique une bonne part de ces défauts** (variante C du § 5) :
  les tête-à-queue de remise des gaz sur le sec, l'écrêtage par l'aide, et une part de la perte du clavier (de
  15 % dans le slalom à 85 % en R 120).

## 1. Comment le banc mesure

- **Le vrai modèle** : `src/ferro/vehicle-dynamics.js`, `src/circuit.js` et `src/conduite.js` chargés comme dans
  les tests, appelés par `B.conduite.pas` à 1/120 s, sans aucune retouche. Une variante de PARAMS (`--regler`) se
  mesure sur une copie temporaire.
- **Deux sortes de pistes**, construites au format des tableaux de `circuit.js` (pas de 2 m), lues par les
  fonctions mêmes de la course :
  - l'**aire d'essai**, 400 m de large : la voiture seule, rien à heurter (virages établis, échelons) ;
  - la **vraie piste**, 12 m de large, vibreurs aux virages, glissières à 20 m resserrées dans les virages serrés,
    comme `circuit.js` : pour comparer les chaînes de commande.
- **Quatre chaînes de commande**, celles de `src/jeu.js` (le test `banc-conduite.test.mjs` vérifie qu'elles le
  restent) :

  | chaîne | décisions | aide | guidage | volant | pédales |
  |---|---|---|---|---|---|
  | physique (voiture seule) | 120 Hz, exactes | 0 | 0 | continu | continues |
  | manette | 60 Hz (une lecture par image) | 0,35 | 0 | continu | continues |
  | clavier | 60 Hz | 0,35 | 0,15 | touches | touches |
  | souris ou doigt | 60 Hz | 0,35 | 0 | continu | touches |

  « Touches » : la commande voulue est rendue en appuis tout ou rien par modulation sigma-delta (constante 0,05 s,
  appui tenu au moins 0,05 s ; une variante à 0,1 s est mesurée en R 120). C'est un joueur adroit au clavier, pas
  un joueur moyen.
- **Pilotes scriptés** : suivi de ligne (visée à 8 + 0,45·v m, même loi que les rivaux, `volantPour`),
  régulateur de vitesse PI, loi de contre-braquage en dérive (celle des critères S6).
- **Limites** : une vitesse est « tenue » si, sur les dernières secondes, l'écart à la ligne reste sous 1 m (aire)
  ou 2 m (vraie piste), la vitesse à ±1 à 1,5 m/s, sans tête-à-queue. La limite est la plus haute vitesse tenue en
  montant par pas de 2 % puis par dichotomie jusqu'au premier échec (un passage isolé au-delà d'un échec, que le
  joueur ne retrouverait pas, ne compte pas).
- **Limite d'adhérence** séparée de celle de la puissance : une pente descendante annule la traînée
  (`pente = −a/√(g² − a²)`).
- **Échelon de volant** : gaz figé, régime établi pris entre 1 et 1,5 s, pic cherché avant 1 s,
  ζ = −ln D/√(π² + ln² D) pour un dépassement D, TB = temps du pic × dérive de caisse.
- **Ce que le banc ne fait pas** : il ne joue pas comme un humain ; il ne roule pas sur un vrai circuit (pas de
  tour, pas de pente, pas de dévers) ; ni rivaux, ni contacts, ni glissières (sauf comme limites), ni aide « Forte ».

## 2. Ce que disent les nombres

### 2.1 Ligne droite et freinage (sec sauf mention)

| essai | mesure |
|---|---|
| départ arrêté (2 s de grille plein gaz) | 0-100 2,53 s · 0-200 7,30 s · 0-300 29,0 s · 400 m 9,88 s (230 km/h) · 1 000 m 18,22 s (279 km/h) |
| pointe | 307,1 km/h (rupteur de 6e) ; 309,6 en plein sillage |
| puissance à la roue maxi par rapport | 182 / 196 / 206 / 214 / 221 / 233 kW (316 ch) |
| accélération maxi par rapport | 1,27 / 0,97 / 0,78 / 0,66 / 0,57 / 0,50 g |
| sans lancement sur la grille | 0-100 2,54 s (le lancement ne change presque rien) |
| aspiration pleine | 200 → 280 km/h en 7,18 s au lieu de 11,12 s |
| mouillé (eau 0,75), 0-100 | slicks 3,25 s · inter 2,82 s · pluie 2,68 s |
| 200-0 | 75,6 m, 2,95 s, 2,61 g maxi, 2,08 g moyen ; mouillé : slicks 90,7 m, inter 80,9 m, pluie 78,1 m |
| 300-100 | 116,2 m, 2,21 s, 3,67 g maxi, 2,71 g moyen ; slicks mouillé 139,5 m |
| 100-0 | 22,3 m, 1,94 g maxi ; slicks mouillé 26,8 m |
| 200-0 pédale 0,9 / 0,8 / 0,6 | 79,6 / 85,7 / 108,7 m (indicateur de blocage 0,81 / 0,39 / 0) |
| pied levé | 0,24 g à 100 km/h · 0,37 g à 200 · 0,58 g à 290 ; 300 → 200 km/h en 403 m |

### 2.2 Virages établis (voiture seule, aire d'essai)

| R | v tenue | a_y | gaz | β caisse | K (°/g) | v d'adhérence (traînée compensée) | réf. rivaux / tenue |
|---|---|---|---|---|---|---|---|
| 30 m | 84,3 km/h | 1,87 g | 0,26 | 1,98° | 0,43 | 84,9 km/h (1,90 g) | 94 % |
| 60 m | 120,5 | 1,91 g | 0,36 | 2,91° | 0,40 | 121,7 (1,95 g) | 97 % |
| 120 m | 182,4 | 2,18 g | 0,62 | 3,49° | 0,31 | 185,9 (2,27 g) | 100 % |
| 180 m | 242,3 | 2,57 g | 0,93 | 3,85° | 0,21 | 249,8 (2,73 g) | 103 % |
| 250 m | 272,9 | 2,35 g | **1,00** | 2,78° | 0,14 | ≥ 313,1 (≥ 3,09 g) | 113 % |
| 500 m | 300,8 | 1,42 g | **1,00** | 1,36° | 0,10 | ≥ 313,2 | 103 % |

Le gradient de sous-virage K est faible et positif (0,10 à 0,43 °/g) : une voiture presque neutre, précise. Virage
à gauche : 182,36 km/h en R 120, comme à droite. Voiture abîmée au maximum : R 120 à 172,6 km/h (−5 %).
Mouillé (eau 0,75), R 30 / 120 / 500 : slicks 73 / 155 / 297, inter 79 / 169 / 299, pluie 81 / 174 / 300 km/h.
R 120 selon l'eau (0 → 1) : slicks 182 → 145, inter 178 → 166, pluie 168 → 176 ; les croisements tombent sur les
seuils de `pneusConseilles` (0,2 et 0,47).

### 2.3 Selon la commande (vraie piste, |d| < 2 m ; part de la voiture seule sur l'aire)

| condition | R | voiture seule | manette | clavier (appuis/s) | souris, doigt |
|---|---|---|---|---|---|
| sec | 30 | 83,4 (99 %) | 83,4 (99 %) | 75,6 (90 %) 0,3/s | 75,7 (90 %) |
| sec | 120 | 182,9 (100 %) | 179,7 (99 %) | 172,8 (95 %) 0,4/s | 172,6 (95 %) |
| sec | 500 | 303,0 | 303,0 | 300,5 (100 %) **9,0/s** | 302,8 |
| slicks mouillé | 30 | 74,0 | 74,0 | 64,1 (87 %) | 64,1 (87 %) |
| slicks mouillé | 120 | 155,3 | 152,2 (98 %) | 140,4 (91 %) | 140,2 (91 %) |
| pluie mouillé | 120 | 174,9 | 171,6 | 163,7 (94 %) | 163,5 (94 %) |

- La souris (volant continu, pédales tout ou rien) perd autant que le clavier : **c'est la pédale, pas le volant**.
- Appuis tenus 0,1 s au lieu de 0,05 s : R 120 à 171,5 km/h, à peine moins.
- En R 500, le clavier tient la vitesse mais au prix de 7 à 9 appuis par seconde.
- **L'aide seule** (même pilote, même cadence, aide 0,35) : R 30 83,4 → 83,4, R 120 182,9 → 179,7 (−1,7 %),
  R 180 243,0 → 234,8 km/h (−3,4 %) ; slicks mouillé R 120 −1,9 %. L'écart manette / voiture seule est celui de
  l'aide, pas de la cadence de 60 Hz. Cause : l'aide entre à |β| > 3,55°, et la voiture tient ses grands rayons à
  3,5 à 3,9° de dérive de caisse.

### 2.4 Réponse au volant (échelon, gaz figé)

| vitesse, entrée | t90 volant | t90 lacet | dépassement | ζ | a_y | TB (s·°) |
|---|---|---|---|---|---|---|
| 100 km/h, mi-volant | 82 ms | 113 ms | 1,4 % | 0,81 | 0,96 g | 0,18 |
| 100 km/h, plein volant | 82 ms | 121 ms | 3,3 % | 0,74 | 1,85 g | 0,56 |
| 200 km/h, mi-volant | 95 ms | 79 ms | **17,1 %** | 0,49 | 1,27 g | 0,24 |
| 200 km/h, plein volant, voiture seule | 95 ms | 77 ms | **21,1 %** | 0,44 | 2,33 g | 0,64 |
| 200 km/h, plein volant, manette ou clavier | 95 ms | 75 ms | **24,5 %** | 0,41 | 2,27 g | 0,59 |
| 200 km/h, mi-volant, slicks mouillé | 95 ms | 78 ms | 24,5 % | 0,41 | 1,26 g | 0,37 |

### 2.5 Transferts de charge en appui

- **Lever de pied** (0,95 × limite, volant figé, après 0,5 s) : lacet × 1,09 à 1,13, courbure × 1,13 à 1,18,
  0,96 à 0,98 m vers l'intérieur, 0,38 à 0,59 g ; l'aide n'y change rien. En boucle fermée, la voiture se
  rattrape à 0,03–0,18 m près. **Cohérent et lisible.**
- **Remise des gaz** (0,92 × limite) :
  - volant figé, R 30 : sans aide β +36,9° ; aide 0,35 : lacet × 0,19, β +6,1°, 6,9 m vers l'extérieur ;
  - en boucle fermée, à 15° de la sortie : toutes les chaînes passent (voiture seule β 13,4° en R 30) ;
  - à 45° de la sortie : voiture seule en **tête-à-queue** en R 30 et R 60, les autres chaînes **dans l'herbe**,
    8 à 19 m dehors ; mouillé : pareil ; progressif : la voiture seule part encore en R 30.
- **Freinage en appui** R 120 (0,9 × limite, volant figé) :
  - pédale 0,3 : lacet × 1,25, courbure × 1,26 (la voiture tourne : cohérent) ;
  - pédale 0,6 : sans aide β +20,6° ; avec aide +3,0° ;
  - pédale pleine : sans aide β +75° (tête-à-queue), avec aide β +7,9° et 4,5 m vers l'extérieur ;
  - pédale pleine en boucle fermée : voiture seule en tête-à-queue (β +87°), les autres à 4 m dehors, β 9 à 15°.
  - Cause (calcul pas à pas, `MODELE.md` § 13 point 3) : à pleine pédale, l'arrière demande 1,11 à 1,17 fois son
    adhérence, l'avant 0,86 à 0,92. C'est l'arrière qui sature.

### 2.6 Chicane R 50 et slalom R 40 (vitesse km/h · chrono s)

| condition | voiture seule | manette | clavier | souris | slalom : seule / manette / clavier / souris |
|---|---|---|---|---|---|
| sec | 116,9 · 14,742 | 116,7 · 14,733 | 107,5 · 15,417 | 106,7 · 15,467 | 94,0 / 93,3 / 81,4 / 83,2 |
| slicks mouillé | 100,2 · 16,258 | 101,1 · 16,117 | 88,4 · 17,392 | 89,3 · 17,283 | 81,6 / 80,6 / 70,6 / 71,7 |
| pluie mouillé | 112,2 · 15,117 | 112,0 · 15,067 | 101,8 · 15,908 | 102,0 · 15,883 | 90,6 / 89,8 / 80,8 / 81,4 |

Le clavier perd 0,68 s sur 15 s dans la chicane (−8 % de vitesse) et 1 s sur 6,5 s dans le slalom (−13 %).

### 2.7 Dérive chargée

- **Entrée** : au pas qui suit l'appui (8 ms) pour toutes les chaînes. **Paliers** à 0,70 / 1,31 / 2,11 s de R 80
  à R 250 ; R 40 :
  0,71 / 1,40 / 2,36 s (souris 0,82 / 1,50 / 2,36) ; R 400 : 1,44 / 2,29 / 3,38 s, le clavier n'y atteint que le
  palier II.
- **Turbo** III « parfait » de 1,8 s partout ailleurs, β moyen 3 à 15°, écart maxi 0,25 à 2,6 m.
- **Mouillé** : slicks en R 80, clavier et souris annulés (β jusqu'à 48,8°, au-delà de la limite de 48,7°) ;
  inter et pluie : palier III partout.
- **Durée tenable** : 10 s à tous les rayons et pour toutes les chaînes (le banc s'arrête à 10 s).
- **Après le lâcher** : +17 à +46 km/h en 1 s (en 6e, le turbo ignore le rupteur jusqu'à 331 km/h, lecture du code).
- **Gain** sur un demi-tour puis 800 m de droite. La référence est le meilleur passage propre en adhérence parmi
  six vitesses d'approche ; elle est plus exigeante que celle de S7, qui trouve +0,283 s :

  | R | voiture seule | manette | clavier | souris |
  |---|---|---|---|---|
  | 40 | herbe | −0,217 s | **+0,850 s** | herbe |
  | 80 | +0,008 s | +0,025 s | +0,175 s | +0,425 s |
  | 250 | +0,017 s | +0,017 s | −0,075 s | 0,000 s |

  R 80 mouillé, manette : slicks −0,967 s, inter −0,133 s, pluie −0,083 s ; clavier : slicks tête-à-queue, inter
  +0,050 s, pluie +0,167 s.

### 2.8 Herbe (le centre 3 m dedans pendant 1,5 s, puis retour)

- **100 km/h** : 0,05 s perdus pour 2,9 à 3,0 s dans l'herbe ; la poussée compense presque le freinage de l'herbe.
- **200 km/h** : 0,35 s perdus.
- **Slicks mouillé à 100 km/h** : la voiture seule part en tête-à-queue ; les autres perdent 0,09 à 0,11 s, β 8°.

## 3. Face à une F1 de 1980

Ordres de grandeur de la consigne : environ 500 ch pour moins de 600 kg, 2 g et plus en latéral à haute vitesse,
freinages au-delà de 2 g. Hypothèse de lecture (non sourcée) : une transmission qui rend environ 90 % de la
puissance, soit environ 330 kW à la roue.

| grandeur | 1980 (ordre de grandeur) | BITUME (mesuré) | lecture |
|---|---|---|---|
| puissance | ≈ 500 ch au moteur, ≈ 330 kW à la roue | 233 kW (316 ch) à la roue au mieux, 182 kW en 1re | 30 % de moins, et elle croît avec le rapport |
| masse | < 600 kg | 600 kg | conforme |
| latéral à haute vitesse | ≥ 2 g | 2,18 g à 182 km/h, 2,57 g à 242 km/h ; adhérence 2,73 g à 250 km/h | conforme |
| latéral lent | — | 1,87 à 1,91 g de 84 à 120 km/h | plausible pour des slicks |
| freinage | > 2 g | 2,08 g moyen sur 200-0 (75,6 m), 2,71 g sur 300-100, 3,67 g maxi | conforme |
| pointe | — | 307 km/h, mur du rupteur de 6e | plausible |
| traînée | — | SCx 0,58 m², finesse 2,7 | basse : c'est elle qui donne 307 km/h avec 233 kW |
| pied levé à 290 km/h | — | 0,58 g | faible, faute de traînée |

**Lecture.** L'adhérence et le freinage ont l'ordre de grandeur d'une monoplace de 1980. La puissance et la
traînée sont toutes deux aux deux tiers environ, et la pointe en sort juste. Il en découle deux traits peu
« 1980 » :

- en ligne droite, le pied levé ralentit peu (0,58 g à 290 km/h) et l'accélération de 200 à 300 km/h est longue ;
- tout virage de plus de 200 m de rayon se prend à fond.

L'appui est une constante (SCz 1,57 m²) : rien de l'effet de sol des jupes (sensibilité à la hauteur, perte au
décollement).

## 4. Face à une conduite arcade agréable

**Ce qui marche déjà**

- **Réponse vive et précise** : lacet à 90 % en 75 à 121 ms, gradient de sous-virage faible (0,10 à 0,43 °/g).
- **Transferts lisibles** : le lever de pied referme doucement la trajectoire, et le frein 0,3 en entrée la fait
  tourner.
- **Pneus de pluie cohérents** : les croisements tombent sur les seuils conseillés.
- **Aspiration forte et nette.**
- **Dérive qui part tout de suite**, sur des paliers réguliers.

**Molle**

- Virages rapides à fond (R ≥ 250 m) : on n'y fait que tourner.
- Pied levé faible.
- Herbe à 100 km/h presque gratuite : 0,05 s, la poussée compense le freinage de l'herbe.
- Vibreur réduit à −8 % d'adhérence.
- Une sortie de piste à basse vitesse ne coûte presque rien.

**Brutale**

- Sans aide : tête-à-queue au freinage plein en appui (β 75 à 87°) et au plein gaz à 45° de la sortie en R 30 et
  R 60.
- Dépassement de lacet de 17 à 25 % à 200 km/h.
- Surface qui passe de 1,72 à 0,94 en un pas quand le centre de gravité franchit le bord.
- Au clavier sur slicks mouillés, la dérive de R 80 part à 49° de caisse.

**Incohérente**

- L'aide sous-vire vers l'herbe là où la voiture devrait glisser et se rattraper, et elle écrête la limite des
  grands rayons.
- ABS parfait sur toutes les surfaces, frein moteur constant.
- Puissance qui croît avec le rapport.
- Turbo qui passe le rupteur de 6e.
- Rivaux sur les constantes de l'essai 0.1 : 113 % de la tenue de la voiture en R 250.

**Trop facile**

- Le turbo III « parfait » tombe à chaque fois (la fenêtre de 0,22 s s'ouvre au palier ; lâcher dans la foulée
  suffit).
- La dérive se tient 10 s sans rien coûter.
- Plein volant = pic du pneu : impossible de faire sous-virer l'avant en braquant trop.

**Trop punitive**

- Pédales tout ou rien : −5 à −13 % en virage, −8 % dans la chicane, −13 % dans le slalom, pour un joueur adroit.
- 9 appuis par seconde pour tenir un R 500 au clavier.
- Le gain de la dérive dépend de l'appareil (manette ≈ 0, clavier jusqu'à +0,85 s) : le turbo répare surtout le
  clavier.

## 5. Trois variantes mesurées (pour comprendre, pas des réglages proposés)

Chacune est mesurée sur tout le banc, sur une copie temporaire de `conduite.js` ; empreintes reproductibles.

**A. Plus de puissance, plus de traînée** — `--regler coeffMoteur=18.4,coeffTrainee=0.00092` (441 ch à la roue,
SCx 0,90 m²) · empreinte 90f700f849564ce0.

- **Ligne droite plus proche de 1980** :
  - 0-200 en 5,88 s au lieu de 7,30 s ; 400 m en 9,30 s ;
  - pointe 297,6 km/h ;
  - pied levé 0,80 g à 290 km/h ; 300 → 200 km/h en 299 m au lieu de 403 m.
- **R 250 toujours à fond** (273,5 km/h), et R 180 plus lent (230,6 km/h) : plus de traînée demande plus de
  poussée à l'arrière.
- **Bien plus punitive** :
  - la voiture seule part en tête-à-queue à la remise des gaz même à 15° de la sortie de R 30 et R 60 ;
  - la dérive de R 40 part en tête-à-queue pour toutes les chaînes, et cinq des six dérives de R 80 sur le mouillé ;
  - clavier en R 120 : 91 % au lieu de 95 %.
- **Leçon** : la puissance ne peut pas monter seule ; il faut d'abord une motricité qui se dose.

**B. Freinage réparti à 64 % sur l'avant** — `--regler freinAvant=0.64` · empreinte 4d59bd005525fa63.

- 200-0 en 73,7 m (−1,9 m), 300-100 en 114,2 m (−2,0 m).
- Freinage plein en appui sans aide : β +44,8° au lieu de +75,4° volant figé, +57,9° au lieu de +87,4° en boucle
  fermée.
- Moins violent, mais toujours un tête-à-queue : la répartition n'est qu'une partie de l'histoire, il manque un
  vrai blocage de l'avant.

**C. Ellipse de motricité entière** — `--regler ellipseMotrice=2` (au lieu de 1,3) · empreinte f0326e7a46089d87.

- **Remise des gaz** : plus aucun tête-à-queue sur le sec, quelle que soit la chaîne (R 30 à 45° : β 7,4° pour la
  voiture seule, 3,7 m dehors à la manette au lieu de 15,8 m dans l'herbe).
- **L'aide n'écrête plus** : R 120 et R 180 à 100 %. La dérive de caisse à la limite tombe à 2,9–3,0°, sous le
  seuil de l'aide.
- **Clavier** :
  - R 120 à 99 % au lieu de 95 %, R 30 à 93 % au lieu de 90 % ;
  - chicane à 114,1 km/h au lieu de 107,5 (l'écart avec la manette passe de 0,68 s à 0,24 s) ;
  - slalom à 84,2 km/h au lieu de 81,4.
- **Plus stable** : K 0,52 °/g en R 120 au lieu de 0,31.
- **Revers : la dérive ne paie plus** (gain −0,23 à −0,01 s en R 80, négatif en R 250), puisque l'adhérence va
  mieux.
- **Ce qu'elle ne règle pas** : sur le mouillé, la voiture seule part encore en tête-à-queue à la remise des gaz,
  et le clavier perd encore 11 % dans le slalom (84,2 contre 94,3 km/h à la manette).
- Le critère S3 (≥ 6° de glisse arrière plein gaz en 2e), pour lequel l'exposant 1,3 a été posé, n'a pas été
  repassé.

## 6. Pistes d'amélioration, classées

Classées par effet mesuré sur le ressenti et par risque. Rien n'est réglé ici : chaque piste se juge au banc
(lignes citées), aux 46 critères, puis en jouant.

1. **Motricité : une perte au patinage plutôt qu'un exposant permanent.** Garder l'ellipse entière tant que la
   demande reste sous l'adhérence, et faire décrocher l'arrière quand le joueur en met trop. C'est ce qui sépare
   un plein gaz dosé d'un plein gaz brutal, comme sur une vraie voiture.
   - Variante C : cela supprime les tête-à-queue de remise des gaz sur le sec et l'écrêtage par l'aide, et
     reprend de 15 % (slalom) à 85 % (R 120) de la perte du clavier, la moitié dans la chicane.
   - À surveiller : remise des gaz, chaînes de commande, aide seule, chicane, slalom.
   - Risques : S3, et le gain de la dérive (piste 4).
2. **Pédales tout ou rien dosées par le jeu** (clavier, souris, doigt) : montée du gaz en 0,2 à 0,3 s, et un
   anti-patinage léger pour ces appareils seulement, comme le volant clavier a déjà son filtre. Perte actuelle :
   −5 à −13 %. À mesurer après la piste 1, qui en retire déjà une part.
3. **Aide « Légère »** :
   - la déclencher sur l'excès de lacet ou la glisse de l'arrière, pas sur |β| > 3,55°, qui est la dérive
     naturelle à la limite ;
   - agir d'abord sur le gaz (anti-patinage), ensuite sur le volant ;
   - rattraper la glisse sans renvoyer la voiture tout droit dans l'herbe.
   - À surveiller : aide seule, remise des gaz, freinage en appui, et S4 (forte glisse rattrapée).
4. **Dérive, à rééquilibrer après les pistes 1 à 3** :
   - charge tirée de la glisse et du lacet réels de la voiture, pas de la courbure de la piste ;
   - un coût à la tenir longtemps (vitesse, ou charge qui retombe au-delà du palier III) ;
   - une fenêtre « parfait » qui demande un vrai geste ;
   - un gain de 0,1 à 0,3 s pour **toutes** les chaînes (S7), mesuré contre la référence exigeante du banc.
5. **Freins** :
   - demande tirée de l'adhérence réelle ;
   - répartition et frein moteur équilibrés (variante B : −1,9 m) ;
   - un vrai blocage de l'avant (sous-virage, plus sûr qu'un tête-à-queue), avec un ABS comme aide, si David le
     veut ;
   - un frein moteur selon le rapport.
6. **Moteur** : puissance constante d'un rapport à l'autre (POUSSEE ∝ 1/vPointe), régime proportionnel à la vitesse.
   Le niveau de puissance (316 ou environ 440 ch à la roue) est une décision de David, à prendre seulement après les
   pistes 1 et 2 (variante A).
7. **Amortissement du lacet à haute vitesse** : viser un dépassement d'environ 10 % à 200 km/h, au lieu de 17 à
   25 %. Pistes : relaxation des pneus, ou amortisseur de glisse selon la vitesse. SUIVI-PHASE-2.md (14/11) montre
   qu'elles touchent S4, S5, S7, S8 et S9 : à mesurer avec ces critères.
8. **Surfaces** :
   - herbe et vibreur jugés par essieu, ou par une transition, plutôt qu'au centre de gravité ;
   - une herbe qui coûte aussi à basse vitesse, et davantage mouillée ;
   - un frottement au rail : les paramètres existent mais ne sont pas lus.
9. **Pluie** :
   - slicks plus pénalisés sur piste détrempée ;
   - aquaplanage au-delà d'une vitesse qui dépend de l'eau et des pneus ;
   - une trajectoire qui sèche ;
   - une loi pour la neige.
10. **Rivaux** : un profil de vitesse tiré des constantes de la voiture (`capaciteLaterale`, enveloppe de poussée
    mesurée) au lieu de MU 1,55 et AERO 0,00155, puis l'élastique et `hab` réglés à nouveau.
11. **Ménage** :
    - le commentaire du guidage au doigt (ou bien le guidage lui-même) ;
    - les paramètres morts ;
    - l'empattement de 2,85 m contre 2,70 m pour la 312 T5 ;
    - le commentaire « monoplace de 1990 » ;
    - la zone morte et l'exposant de la manette dans FEUILLE-DE-ROUTE.md.

## 7. Preuves

- **Déterminisme** : `verifications/banc-conduite.test.mjs` refait le sous-ensemble court deux fois et compare les
  empreintes (mêmes nombres au bit près).
- **Sensibilité** : le même test mesure `freinMax` 0,92 → 0,80 et exige deux empreintes différentes et +2 m au
  200-0. Deux mutants du test échouent comme attendu (repassés le 18/11) : une « variante » de même valeur (0,92),
  et un guidage attendu de 0,25 dans `jeu.js`.
- **Fidélité au jeu** : le test lit `src/jeu.js` (guidage, aide par défaut, gaz du clavier et du doigt, gâchettes)
  et échoue si les chaînes du banc s'en écartent.
- **Dans le vrai navigateur** :
  - `node tools/banc-conduite.mjs --script-page F` écrit la partie pure du banc pour la page construite ;
    `node tools/page-essai.mjs dist/bitume.html F > S` la joue (Chrome 157, page 0.2.38) ;
    `--verifier-page S` compare.
  - Sur 214 nombres, 40 diffèrent au dernier chiffre, écart relatif maxi 9,82e-14 : même modèle.
  - Empreintes : page d17bebc01b642772, Node 6dc495a68695aec5.
  - Cause : `Math.exp` ne rend pas toujours le même dernier bit sous Node v24.18.0 (V8 13.6) et Chrome 157.
  - Témoin négatif : muPiste 1,73 au lieu de 1,72 donne un écart de 1,7e-1, et « MODÈLES DIFFÉRENTS ».
- **Critères** : `verifications/conduite-criteres.test.mjs` reste à 46/46 critères obligatoires (S8 ouverte à
  1 031 °/s²), sans changement : le modèle n'est pas touché.

## 8. Limites de ces mesures

- **Des pilotes scriptés** : ils montrent les mécanismes et les ordres de grandeur, pas le ressenti ; c'est David qui
  juge en jouant.
- **Le clavier simulé est adroit** : appuis de 0,05 s modulés, ou de 0,1 s.
- **« Voiture seule »** (aide 0, commandes exactes à 120 Hz) n'est pas un réglage du jeu ; le plus proche est la
  manette avec l'aide « Aucune ».
- **Pistes synthétiques** : cercles et S réguliers, sans pente, dévers, bosses, vibreurs partiels, rivaux ni
  sillage en virage.
- **Hors du banc** : l'aide « Forte » (0,7), les dégâts autres qu'au maximum, les glissières, les sauts et le
  circuit de montagne.
- **Comparaison à 1980** : ordres de grandeur de la consigne et une hypothèse de transmission, sans recherche de
  sources ni de forums dans cette étape.
