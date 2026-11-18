# Chargement des séances (lot 5B, fluidité) — 18/11/2026

Arbre `bitume-wt/chargement`, branche `fluidite/chargement`, base `54e98c9`. Page mesurée : `dist/bitume.html` 0.2.39,
SHA-256 `0502cc15304c3bb3…`. La reconstruction depuis les sources du commit redonne la même empreinte. Base mesurée :
`46a0b0af1311c310…`.

## Ce qui change

Chaque départ de séance passe par `preparerSeance` : course, chrono, à deux, démo, en ligne, ainsi que la vitrine
quand son décor change. Le voile est opaque d'emblée et suit dix étapes nommées, avec une barre ; une image est cédée
entre deux étapes. Sous le voile, rien n'est simulé ni dessiné pour le joueur, et les entrées n'agissent pas. On y
fait, dans l'ordre :

- le décor ;
- le moteur des rétroviseurs et sa copie du décor ;
- les créations explicites (`prechargerSeance`) ;
- la chauffe de toutes les variantes de rendu que la séance peut atteindre, sur les deux moteurs (les paliers Auto
  compris) ;
- la chauffe du code : des images à dt = 0 de chaque vue, puis une course jetable de 2,5 s qui ne touche pas la
  séance d'un bit ;
- la remise à zéro ;
- la première vraie image, sous le voile à 99 %.

Au lever du voile, l'horloge repart propre : intervalle oublié, `S.acc = 0`, fenêtre Auto vidée, durée d'image égale à
la cadence de l'écran. Recommencer sur la même scène prend le chemin léger : le fondu d'aujourd'hui, sans texte.

## Comment on a mesuré

- Outil : `tools/profil-accrocs.mjs --scenario depart`. C'est le chemin du joueur : titre, préparation, clic sur
  Départ, la voiture confiée à l'ordinateur. Chrome 157 sans interface, Apple M5.
- Passes de la base et d'après intercalées, à la même minute, dans `mesures-ab/` ; leur synthèse est dans
  `synthese.json` (calculée par `synthese.py`).
- **Machine chargée par les autres exécutants** : charge moyenne de 11 à 101 pendant les passes
  (`mesures-ab/charge-machine.txt`). Les durées absolues sont bruitées.
- L'écran de course est relevé toutes les 100 ms environ.
- Le circuit se choisit sur l'écran de préparation : le décor s'y bâtit avant le clic, dans les deux versions, donc
  hors de la fenêtre mesurée.

## GPU réel (ANGLE Metal), 1390 × 1295, Fine

Durées en ms. Les intervalles min–max sont entre parenthèses.

| Scénario | Version (passes) | Clic → écran de course, médiane | Plus longue image entre le clic et la course | Pire image des 2 premières s | Images > 50 ms ensuite, par passe |
|---|---|---|---|---|---|
| Val-Brûlé, sec | base (3) | 303 (218–527) | 250 (150–483), menu figé | 16,8–33,4 | 1, 0, 0 |
| | après (3) | 604 (339–635) | 100 (67–117), sous le voile | 16,8–33,4 | 2, 0, 0 |
| Haut-Col, pluie | base (5) | 421 (216–604) | 350 (167–533), menu figé | 16,8–33,4 | 2, 0, 0, 0, 0 |
| | après (5) | 499 (433–697) | 100 (83–183), sous le voile | 16,8–33,4 | 0 × 5 |
| À deux | base (3) | 294 (240–425) | 233 (167–333), menu figé | 33,4 | 0, 1, 0 |
| | après (3) | 409 (383–783) | 100 (83–117), sous le voile | 16,8–50 | 0 × 3 |

Ce que montrent ces nombres :

- **Base.** Le lancement tient en une seule image synchrone de 150 à 533 ms, juste avant l'écran de course : le menu
  se fige, puis la course apparaît. `MESURES-BASE.md` relevait de même 150, 150 et 167 ms.
- **Après.** Entre le clic et la course, aucune image ne dépasse 183 ms, et toutes sont sous un voile opaque qui
  affiche son étape.
  - Dans les 2 s qui suivent le voile, la pire image ne dépasse pas 33,5 ms dans 10 passes sur 11. Elle fait 50 ms
    dans une passe à deux, sous une charge de 73. Aucune ne dépasse 50 ms.
  - Plus tard, les deux seules images au-delà de 50 ms font 66,7 ms, à 11,4 et 14,8 s. Elles tombent dans une seule
    passe, sous une charge de 101.
- **Coût.** Le départ est plus long : +78 à +301 ms en médiane, pour chauffer les variantes, faire la course jetable
  et attendre le GPU.
- **Régime établi : rien à conclure.** Les images au-delà de 1,5 fois la nominale vont de 0 à 255 par passe dans les
  deux versions, au gré de la charge. La boucle du fil principal reste dans les mêmes plages en médiane : 3,2 à
  7,2 ms après contre 6,5 à 7,2 ms dans la base sur Haut-Col ; 9,4 à 13,6 ms contre 8,1 à 14,9 ms à deux.
- **Variante sans le fondu de 0,3 s de la vue** (`mesures-ab/essai-sans-fondu-vue/`, deux passes sur Haut-Col) :
  529 et 546 ms, image de chargement la plus longue 83 et 100 ms. Pas de différence visible, donc le fondu est gardé.

## Rendu logiciel (SwiftShader), Val-Brûlé, Légère, 640 × 360, 40 s

| Version (passes) | Clic → écran de course | Plus longue image du chargement | Pire image des 2 premières s | Images longues ensuite |
|---|---|---|---|---|
| base (3) | 144 à 611 ms | jusqu'à 567 ms | 917 et 1 817 ms ; 0 image en 2 s dans la 3e passe | 0,55 à 0,92 s entre 1,4 et 6,2 s ; jusqu'à 7,6 s dans les passes chargées |
| après (3) | 2,9 à 6,1 s | 1,4 à 4,7 s, sous le voile | 233 à 533 ms | passe 3 (image médiane 167 ms) : 300 à 567 ms entre 2,1 et 8,6 s ; passe 1 : 1,0 à 2,9 s entre 19,7 et 31 s ; passe 2 : page presque arrêtée (3 images, dont 14 s et 22 s) |

- **Le chargement s'allonge nettement** en rendu logiciel. Dans la mesure par étapes (`essais/etapes-swiftshader.json`),
  il dure 5,0 s au total :
  - 3,3 s pour la chauffe du rendu ;
  - 0,74 s pour la chauffe du code, coupée après une image de plus de 50 ms ;
  - 0,81 s pour la première image.
- Les deux premières secondes sont meilleures. **Des images longues restent pourtant après le voile** dans les trois
  passes : charge de la machine, ou compilations qui restent, on ne sait pas. Je n'annonce aucun gain sur ce mode :
  il faut le remesurer sur une machine calme.

## Essais dans la page (build final, charge 7 à 8)

Outil : `tools/page-essai.mjs`, avec les scripts de `essais/` ; les sorties JSON sont à côté. Les séances sont lancées
par `BITUME_JEU.preparer`.

| Séance | Total | Étapes notables (ms) | Créations tardives (sous le voile / en course) |
|---|---|---|---|
| Course Val-Brûlé, Fine, vues changées | 312 ms | code 128,6 (5 images, course jetable 84,8) | 0 / 0 |
| Recommencer, même scène | 95 ms, léger | créations 58,7 (faune) | 0 / 0 |
| Haut-Col, pluie, tunnel | 1 079 ms | décor 836,9 ; rendu 4 variantes et 2 du miroir | 0 / 0 |
| À deux, Val-Brûlé | 510 ms | décor 256,2 ; code 7 images | 0 / 0 |
| Lande-Noire, nuit, aurores | 261 ms | décor 148,5 | 0 / 0 |
| Chrono Port-Sable, Auto | 1 077 ms | décor 834,3 ; rendu 5 variantes, paliers Auto | 0 / 0 |
| Démo Port-Sable | 310 ms | code 12 images | 0 / 0 |

Le compteur « en course » est relevé après 3,5 à 7,9 s d'horloge de course.

Les autres essais dans la page :

- **Démo enchaînée** (`demo-enchainee.json`) : la démo suivante part sur le circuit 1, sous le voile, en 1 468 ms
  (fondu de 340 ms compris). Aucune création tardive.
- **Annulations** (`annulations.json`) :
  - un geste pendant le décor de la démo rend le titre : voile levé, affichage caché, titre actif ;
  - Échap sous le voile est ignoré ;
  - une préparation remplacée par une autre est marquée annulée, et la seconde aboutit (990 ms).
- **Lever du voile** (`voile-leve.json`) : à l'écran de course, le voile part de 99 % d'opacité avec l'affichage
  visible. 1,2 s plus tard il est à 0 et masqué ; ni le titre ni l'affichage ne restent inertes.
- **Captures** : `voile-premiere-image.png` (le voile à l'étape « Première image ») et `apres-le-voile.jpg`.

## Testé, lu, pas fait

- **Testé** :
  - 67 suites Node : les 66 de départ et `chargement.test.mjs`, qui a 7 contrôles, dont le déterminisme de la course
    jetable. En cours de travail, le seuil de temps de `decor.test.mjs` (< 150 ms) a échoué sous une charge de 33 à
    41 (365 à 1 028 ms) ; le même test de la base échouait au même moment (371 ms). Il passe dans la dernière boucle ;
  - le parcours `banc-navigateur --mode smoke` sur le build final : 7 contrôles, 0 erreur, 0 avertissement ;
  - les mesures et essais ci-dessus.
- **Seulement lu ou simulé dans Node** :
  - la partie en ligne sur deux machines (horloge commune, départ commun) ;
  - les manettes réelles sous le voile ;
  - la perte de contexte et l'onglet masqué pendant une préparation ;
  - la chauffe au retour de pause après un changement de réglages ;
  - le mouvement réduit (règle CSS) ;
  - les écrans à 120 ou 144 Hz (l'outil est cadencé à 60 Hz) ;
  - Firefox et Safari.
- **Pas fait**, ce sont les raccords à reprendre :
  - `prewarm` et `retain` de FERRO sur les deux moteurs ;
  - `B.traces.prechauffer` (monde PhysX des débris) ;
  - `son.preparer` ;
  - `B.cadence.periode` ;
  - la faune par scène plutôt que par séance (environ 59 à 135 ms à chaque séance) ;
  - un décor bâti par tranches : `B.decor.construire` reste synchrone (0,15 à 0,9 s) et fige le texte du voile,
    ou le menu quand c'est la vitrine qui change de circuit.

## Correction après relecture

Deux relectures ont rendu six constats ; ils sont vérifiés dans le code et dans le navigateur. Page corrigée :
`33a28e95e67171ad…`. Les essais `titres.txt`, `reactif.txt`, `perte-au-demarrage.json` et `demo-synchrone.json` ont
tourné sur `f39028cc…`, qui ne diffère que d'un commentaire. Tout est rangé dans `correction/`.

Ce qui a été corrigé :

- **`BITUME_JEU.demo` redevient synchrone**, comme `reference()`. `tools/controle-options.mjs` lit la scène juste
  après l'appel, et `banc-navigateur --mode crash` attend 2,5 s. Le jeu, lui, prépare toujours la démo sous le voile.
  Preuve dans `essais/demo-synchrone.json` : `{ memeScene: false, vegetation: 'high' }`, comme sur la base. La
  version précédente donnait `{ memeScene: true, vegetation: 'off' }`.
- **Le chemin léger ne cache plus de compilation.** Après `lancer`, la préparation recompte ce qui manque : les
  variantes de cette météo et de cette taille d'image, les glaces, le code de cette piste. S'il manque quelque chose,
  le voile passe opaque et se peint deux fois avant la chauffe. La chauffe du code se note désormais par type et par
  piste (`course:sec`, `course:mouille`), et la course jetable par mode et par piste.
  - Essai `essais/leger-puis-pluie.json` : une course sèche, puis la même piste sous la pluie, donne
    `leger: false, promu: true`. Le voile est opaque (`net`, opacité 1) pendant la chauffe d'une variante de reflets
    et de 5 images de code. 0 création tardive.
- **La vitrine ne chauffe que ce qu'elle montre**, par sa première vraie image. Les variantes et les témoins de
  course attendent la première préparation de course.
- **Machine lente.** Une image de régime au-delà de 50 ms se mesure dans la boucle des menus ou pendant la chauffe du
  code, et la page la retient. La chauffe ne couvre alors que le palier Auto courant et ses deux voisins, et saute
  les images de code : la première vraie image, sous le voile, suffit.
- **Contexte perdu pendant le voile de la vitrine du démarrage** : la vitrine se lance d'un bloc, comme avant.
  - Reproduit dans `essais/perte-au-demarrage.*` (injection avant la page). La version précédente affichait « Le jeu
    n'a pas pu démarrer ». La version corrigée atteint le titre en 981 ms ; la vitrine dessine (405 tracés) et une
    course se prépare ensuite.

### Temps jusqu'à l'écran titre

Mesure `essais/titres.txt`, avec `page-essai-avant.mjs` (copie de `page-essai` qui chronomètre le titre). Charge 5 à 9.

| Rendu | Base | Avant la correction | Après |
|---|---|---|---|
| GPU, 3 passes | 1,02 à 1,11 s | 1,39 à 1,52 s | 1,30 à 1,33 s |
| SwiftShader 640×360, 2 passes | 1,6 et 2,0 s | 4,7 et 6,0 s | 3,5 et 5,9 s |

En rendu logiciel, l'écart qui reste vient surtout de la première image de la vitrine, qui compile sous le voile :
1,5 à 2,7 s. La base paie ce coût juste après le titre. Dans `essais/reactif.txt` (charge 6 à 9), la base montre le
titre à 3,1–4,1 s puis le fige 3,6 à 4,8 s sur sa première image. Après la correction, le titre arrive à 6,0–11,2 s,
mais sa première image ne dure que 0,2 à 0,5 s. Le titre reste saccadé dans les deux versions : aucun gain annoncé.

### Accrocs, base et après la correction, passes intercalées

Fichiers dans `correction/mesures/`, synthèse dans `correction/synthese.json`. La charge est passée de 4 à 84
pendant les passes (voir `charge-machine.txt`). Durées en ms, une valeur par passe.

| Scénario | Version | Clic → écran de course | Plus longue image du chargement | Pire image des 2 premières s | Images > 50 ms ensuite |
|---|---|---|---|---|---|
| Val-Brûlé, sec | base | 378, 231 | 333, 167 | 16,8, 33,4 | 0, 0 |
| | après | 340, 440 | 83, 67 | 16,8, 16,8 | 0, 0 |
| Haut-Col, pluie | base | 243, 294 | 184, 233 | 33,3, 33,3 | 1 (116,8 ms), 0 |
| | après | 358, 397 | 67, 67 | 16,8, 16,8 | 0, 0 |
| À deux | base | 220, 477 | 167, 400 | 16,8, 66,7 | 1, 1 |
| | après | 648, 441 | 100, 83 | 50, 16,8 | 3, 0 |

- **À deux, première passe après la correction** : la charge est montée à 23 pendant la passe. Les trois images de
  66,6 ms viennent toutes de l'engorgement du processus graphique, sans aucune compilation (0 ms de shaders). La
  base montre la même figure dans sa seconde passe.
- **SwiftShader** (Légère, 640×360, 40 s), charge 25 à 84 :
  - clic → course : 506 et 829 ms sur la base, 2,4 et 16,7 s après la correction. La passe de 16,7 s contient une
    lecture de pixel de 12,2 s, l'attente de la chauffe par le processus graphique ;
  - pire image des 2 premières s : 467 et 883 ms sur la base, 183 ms et 2,1 s après la correction ;
  - la médiane des images va de 167 à 450 ms selon la passe, et presque toutes dépassent 50 ms.
  - **Non concluant.**
- **Essai par étapes sur SwiftShader** (`essais/etapes-swiftshader.json`, charge 18 à 30) : 2,85 s au total, dont
  2,09 s de rendu pour une variante, 384 ms de code (une image, machine lente) et 283 ms pour la première image.

**Tests** : 67 suites Node passent ; `chargement.test.mjs` compte maintenant 9 contrôles et échoue sur le
`jeu.js` d'avant la correction. Le parcours smoke passe ses 7 contrôles (`correction/smoke.json`), sans erreur ni
avertissement.

## Refaire

```bash
cd /Users/david/Projects/bitume-wt/chargement
for t in verifications/*.test.mjs; do node "$t" > /dev/null 2>&1 || echo "ECHEC $t"; done
python3 construire.py
node /Users/david/Projects/bitume/tools/banc-navigateur.mjs --url file://$PWD/dist/bitume.html --mode smoke --angle native --sortie smoke.json
node /Users/david/Projects/bitume/tools/profil-accrocs.mjs --url file://$PWD/dist/bitume.html --scenario depart --circuit 0 --duree 20 --qualite high --sortie apres-c0-r1.json
#   Haut-Col : --circuit 2 --meteo pluie ; à deux : --partie duo ;
#   logiciel : --angle swiftshader --qualite low --taille 640,360 --duree 40
node /Users/david/Projects/bitume/tools/page-essai.mjs file://$PWD/dist/bitume.html docs/reprise/rapports/fluidite-2026-11-18/chargement/essais/essai-tardives.js
python3 docs/reprise/rapports/fluidite-2026-11-18/chargement/synthese.py docs/reprise/rapports/fluidite-2026-11-18/chargement
```
