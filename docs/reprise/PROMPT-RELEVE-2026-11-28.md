# BITUME — Prompt de relève complet (28 novembre 2026, 07:52)

> **À lire en premier par la session de relève** : copie ce document ou exécute directement les étapes ci-dessous. Tout le code préparé jusqu'à **BITUME `0.2.346`** (`FERRO 0.3.36`) est commité et poussé sur `origin/main` de GitHub (`M4D135/bitume` et `M4D135/FERRO`). **Attention :** `0.2.345` (`d82f5e1`) est actuellement en ligne sur `https://bitume.estrasse.fr/` ; `0.2.346` est poussé sur GitHub mais **pas encore déployé** sur `amiga` (attendre d'avoir terminé le chantier Tracés F1 + Sauts ci-dessous ou un `go deploy` de David).

---

## 1. État livré et poussé sur GitHub

### A. Déjà en production (`0.2.345`, commit `d82f5e1`, `FERRO 0.3.36` `20ef396`)
1. **Gants FIA procéduraux photoréalistes & biomécanique** (`src/main.js`, `src/voiture.js`, `FERRO 0.3.36` `src/ferro/renderer.js`) :
   - Doigts `cotes: 14` (repère parallèle de Bishop sans vrillage, section asymétrique en D, pulpe palmaire hors tore de jante `+0,45 mm`, condyles MCP/PIP/DIP, plis Nomex, méplat d'ongle), pouce musclé à éminence thénar, dos métacarpien étanche (`euler = 2`, 4 tendons extenseurs, arche asymétrique, fronces FIA), paume suédée sombre sans z-fighting, garde 4 dômes en cuir carbone capitonné sur `repPaume`, manchette passepoilée englobant la manche, sangle Velcro.
   - Demi-prise du pommeau (`prisePommeau`) au passage de rapport, pronation/supination douce de l'avant-bras (`0,70°` neutre, `14,46°` butée), `0,00 o/appel` (`voiture-permanents` 12/12).
   - Recettes PBR `fineLeather` (`28`) et `wovenFabric` (`29`) dans `FERRO 0.3.36` (sergé Nomex 2×2 mat sous la pluie, sans reflet plastique).
2. **Caméras de démo & vitrine corrigées** (`src/jeu.js`, `src/cinema.js`) :
   - Suppression du clamp post-validation `cam.pos[1] > ps.y + 4.4` qui enterrait les caméras en montée et faussait `cam.pitch` ; `cameraSol` relevée (`+0,62 m` hors congères 50 cm) avec recherche multi-candidats `cinema.libre` ; relais `cameraTele` propres ; `S.cinema` actif en `vitrine` + rotation auto de voiture.

### B. Déjà codé et poussé dans `0.2.346` : Flux sans gel « Route sans fin » (`src/route-sans-fin-flux.js`)
- **Demande de David** : *« course illimité gros acces avant arrivé sur checkpoint, faut corriger ça trouver un moyen de ne pas figer le jeu au chargement du circuit suivant »*.
- **Cause mesurée avant correctif** (`1920×1080` `high` Metal-3 WebGPU) :
  - Double bascule coup sur coup à `s ≈ 1447 m` (fin station 1) puis `s ≈ 1468 m` (seuil `REPRISE_DECOR = 1500` juste devant le Checkpoint #1 à `1500 m` !) bloquant le fil principal pendant **`250 ms + 66 ms + 450 ms = 766 ms`**, puis **`466 ms`** à `s ≈ 3028 m` : `decor.construire` (`352 ms`) + `solidesPhysX.installer` (`77–102 ms`) + `preparerLot` ×300 (`32 ms`) + `animaux.creer` (`25–55 ms`) + `fenetre.avancer` (`20 ms`).
- **Ce qui est en place dans `0.2.346`** :
  - `src/route-sans-fin-flux.js` : Web Worker auto-extrait depuis `document.scripts` (`Blob` URL pour `https://` + repli `data:text/javascript;charset=utf-8,` ajouté pour `file://` Chrome !) préparant ~1 km à l'avance `circuit` + `decor` + `herbierPlat` (grille spatiale `MAILLE = 32` sans rappeler `creerHerbier` sur le fil principal) + `grilleAnimaux` (`animaux.creer` tombe de `55 ms` à **`3,7 ms`**) + `solidesPhysX.extraire` (transfert `ArrayBuffer` zéro copie).
  - Cuisson incrémentale de `nextWorld` PhysX sur le fil principal par micro-tranches (`<= 1,5 ms`/image via `B.solidesPhysX.insererTranche`), détachement différé de l'ancien monde (`B.physique.detacher` + recyclage hors bascule), conservation des traces de gomme/fumée (`B.traces.changerMonde`), réutilisation des pipelines/textures WebGPU de prairie (`prairie.changerDecor` dans `src/herbe-gpu.js`), et fusion des bascules station + fenêtre proches dans `src/route-sans-fin-seance.js` (**7/7 suites `verifications/route-sans-fin*.test.mjs` 100 % vertes**).
  - **Vérification rapide restante à faire en début de relève (2 min)** : relancer un banc Chrome WebGPU avec le repli `data:text/javascript` de `creerWorkerBlob()` (sur `http://127.0.0.1` local ET `file://`) pour confirmer que le Worker tourne bien hors fil principal (`maxMs < 25 ms`, `0` appel `decor.construire` sur le fil principal ! Note : si `data:` Worker dépasse une limite d'URL ou d'origine sur `file://`, vérifier via serveur HTTP local `python3 -m http.server` qui reproduit `https://bitume.estrasse.fr` où `Blob` Worker marche nativement, et au besoin ajouter un découpage asynchrone en repli `file://`).

---

## 2. Chantier prioritaire à exécuter immédiatement : Fluidité F1 des circuits, suppression des routes bosselées & sauts fun

### Demande exacte de David (verbatim)
> *« dans certains circuits surtout le ring ou les montagnes, on a certaines routes bosselées , irregulieres et c'est pas terrible pour un jeu ve f1, améliore les tracés des circuits, rend les plus fluides à emprunter avec une f1, ajoute quelque petit endroits propices aux sauts, ajoute du fun sur les tracés des circuit plutot que de la frustration, on doit avoir envie de continuer pas d'abandonner »*

### Diagnostic technique exact déjà établi (zéro exploration à refaire !)

Le châssis F1 (`src/physique.js:9-11`) a une suspension à poussoirs raide (`courseRepos: 0.08 m`, `courseLibre: 0.105 m`, `courseMax: 0.17 m`, garde fond plat `0.15 m`). Toute cassure de pente (`C0`), marche de quantification DEM ou torsion brutale de dévers percute le fond plat, fait rebondir le train avant et rend la voiture frustrante. Voici les **5 sources exactes de bosses/irrégularités** identifiées dans le code :

1. **`src/larche-vinadio.js` (`Descente des Freins Chauds`, 32,8 km — Montagne)** :
   - **Bug critique #1 (marches d'escalier de 10 cm)** : `D.y10` est quantifié en décimètres (`int16 / 10` = marches de `0,10 m` > `0,08 m` de course de suspension F1 !) et interpolé linéairement (`interpLinear`, `C0`) à la ligne `170` ! Et la boucle de lissage des lignes `226-235` ne lisse **que** si `|Δy/ds| > 0.155` (`15,5 %`) — donc **95 % de la descente conserve des facettes cassées tous les 4 à 12 m** !
     - *Correctif* : appliquer un filtre passe-bas gaussien / Savitzky-Golay / spline C2 sans déphasage sur `y` (fenêtre ~`±36 m`, préservant l'altitude aux ponts/tunnels si nécessaire ou le terrain suit `c.y` automatiquement dans `larche-vinadio-decor.js` ! Vérifier `larche-vinadio-decor.js` : le maillage de route et le terrain lisent directement `c.y`), éliminant 100 % des micro-bosses haute fréquence (`|d²y/ds²|` continu et doux !).
   - **Bug critique #2 (contre-dévers inversé + sauts de dévers aux ponts !)** : ligne `252` écrit `let dv = -courbure[i] * 1.4;` alors que la convention de BITUME (`src/circuit.js:536`, `src/decor.js` `y - d * tan(devers)`) est **`+courbure[i] * 1.6`** !! Tous les virages de Larche étaient en **contre-dévers** (jetant la F1 vers l'extérieur !), et ligne `257` coupe brutalement `dv = 0` sur les ponts sans rampe de transition (`C0` roll kick) !
     - *Correctif* : remettre le bon signe `+courbure[i] * 1.6` (relevé favorable F1 vers la corde, jusqu'à `±0.06 rad`), fondre progressivement vers `0` sur `40 m` avant/après les ponts et le départ/arrivée, puis lisser `devers` sur `±24 m`.
   - **Bug #3 (`Float32Array` à 32 km)** : lignes `146, 192-195` stockent `outX`, `outZ`, `cap`, `courbure`, `pente`, `devers` en `Float32Array` (bruit de quantification millimétrique sur `atan2(dz, dx)` à 32 km) → passer en `Float64Array` (comme `circuit.js`) et éventuellement descendre `PAS` ou lisser `th(s)` un cran de plus dans les enchaînements rapides.

2. **`src/route-des-cimes.js` (`Lacets de l'Aiglière`, 9,7 km — Grand circuit alpin type Nürburgring / « le Ring » montagne)** :
   - **Bug #1 (14 cassures franches de pente `RACCORDS_PENTE = 0`)** : ligne `21` a `0 m` de raccord vertical sur 14 jonctions de séquences (ex. sortie du Pont de la Gorge `-8 % → -1 % → -8 %` aux séquences 96–99 ! C'est un mur vertical dans le bitume à 240 km/h !) et `fonctionRaccordee` (lignes `126-142`) fait une rampe linéaire de pente (`kv` en créneau discontinu).
     - *Correctif* : remplacer les `0` par des raccords doux (`>= 50–80 m`), utiliser un raccord **quintique `C2`** (`t³(10 - 15t + 6t²)`) dans `fonctionRaccordee` pour le profil vertical, et adoucir `devers` (`moyenneCirculaire` multi-passes Hann, et supprimer ou adoucir le contre-dévers punitif de `Virage du Vide` `dv: 2` → dévers neutre ou légèrement porteur pour garder le plaisir de pilotage F1 !).
   - **Attention contrat de test** : vérifier `verifications/` (`grep -rn "route-des-cimes\|routeDesCimes" verifications/`) pour respecter les invariants de `B.routeDesCimes.valider(c)` (lignes `377-390` : `rayonMin >= 31.99`, `penteMax <= 0.30`, `penteMin >= -0.10`, fermeture `< 0.01 m`, 3 couverts, 1 pont, 7 lieux, stands).

3. **`src/circuit.js:411-487` (`creerOvaleDesForges` — `Autodrome des Alizés`, anneau relevé à 40° / Ring ovale)** & **Circuits raccordés (`src/circuit-raccords.js` : `forets-du-pacifique`, `karst-et-lagon`, `nord-atlantique`)** :
   - Sur **l'anneau à 40° (`ovale-des-forges`)** :
     - À 40° de banking (`tan 40° = 0,839`), la torsion hélicoïdale de la nappe de chaussée (`PAS = 2 m`, 2 triangles par quad de `16 m` de large) crée un pli diagonal sur chaque quad dans la rampe de transition (`raccordDevers = 64`), et l'entrée/sortie du banking commence `48 m` avant le virage pendant que la voiture est encore pleine charge !
     - *Correctif* : vérifier dans `decor.js` (construction de la nappe `chaussee` / `accotement`) la subdivision transversale de la chaussée quand `|devers| > 0.12` (ex. 4 bandes transversales au lieu d'un seul quad de 16 m vrillé ! Zéro arête diagonale qui fait sauter les roues PhysX !), allonger/adoucir la rampe de dévers C2 et harmoniser le dévers avec la courbure pour que la F1 s'inscrive comme sur un rail à 300 km/h !
   - Sur **les 3 grands circuits raccordés (`circuit-raccords.js`, type Ring de 9–10 km)** et **`circuit.js` (`sierra`, `baikal`)** :
     - Appliquer à la sortie de `B.raccords.creer(def)` (hors zone `stands`/`ligneDroite`) un lissage C2 léger sans dérive sur `c.y`, `c.pente` et `c.devers` aux corridors de couture (`c.corridors`) où deux circuits fusionnés avaient des raccords de pente/dévers trop secs, et un dévers F1 progressif (`borner(courbure * 2.1, -0.065, 0.065)` lissé par 3 passes de moyenne glissante = filtre gaussien C2).

4. **Ajout d'endroits propices aux sauts F1 fun et maîtrisés (sans frustration ni crash à la réception !)** :
   - **Principe physique d'un bon saut F1 dans BITUME** (`src/physique.js:260` gère déjà les vrais décollages et réceptions !) :
     - Un tremplin / crête de décollage (« bosse de saut » / *flugplatz* façon Nürburgring Pflanzgarten / Finlande / OutRun) doit être **100 % sur une portion droite ou très grand rayon (`|courbure| < 1/450`)**, loin des stands/tunnels/ponts (`> 140 m`), avec :
       1. Une rampe d'appel progressive en cloche asymétrique C2 (`y += H * clocheQuintique(s)`, ex. `H = 2,2 à 3,4 m` sur `90 m` de montée puis descente plus franche sur `65–80 m` en contrebas doux, courbure verticale au sommet `kv ≈ -0.006 à -0.009 m⁻¹` → décollage franc et grisant au-delà de `210 km/h` !),
       2. **Zone de réception sécurisée** : piste élargie ou dégagement généreux sur `110 m` après la crête, `devers = 0` parfaitement à plat latéralement pour atterrir droit sur les 4 roues sans coup de raquette,
       3. **Signalisation visuelle fun** dans `decor.js` (ex. vibreurs/chevrons jaunes ou portique/repères d'appel de crête) et consigne IA (`c.vitesse`) qui **ne freine pas** excessivement sur les bosses de saut marquées (`c.sauts = [{ debut, sommet, fin }]`) pour que le peloton IA saute aussi en course et en démo !
   - **Où placer ces bosses de saut fun** :
     - `Route-des-Cimes` : au sommet du Mur (`séquence 19–20`, bascule haute de l'Aiglière → vrai *Flugplatz* alpin droit avant le replat !) + 1 bosse rapide dans la descente de l'Alpage.
     - `Larche` (`Descente des Freins Chauds`) : 3 belles crêtes de décollage sur les grandes lignes droites rapides hors ouvrages/épingles.
     - `Circuit des Longues Ombres` (`forets-du-pacifique`), `Passe du Beau Temps` (`nord-atlantique` / Lande-Noire), `Sierra` (`Second Écho`) et `Baïkal` : 1 à 2 crêtes *Flugplatz* droites chacun sur leurs longues sections rapides.
     - `Route sans fin` (`src/route-sans-fin.js`) : 1 crête de saut fun occasionnelle sur les longues portions droites (`|capLocal'| < 1/500`) des biomes `plaine`, `petite-montagne` et `grande-montagne` !

---

## 3. Chantier #2 : Changer de circuit directement depuis l'aperçu circuit dans le menu

### Demande exacte de David (verbatim)
> *« on doit aussi pouvoir changer les circuits depuis direct l'aperçu circuit dans le menu »*

### Diagnostic exact & implémentation attendue (`src/index.html`, `src/menu-arcade.js`, `src/style.css`, `src/jeu.js`)
- Dans `#preparation > .panneaux-menu > #p-piste` (`src/index.html:264-274`), la grande carte héroïque `.apercu-circuit` affiche `#p-circuit-lieu`, `#p-circuit-nom`, `#p-circuit-numero` (`01 / 09`), le canvas `#p-trace-3d`, `#p-rotation` (« Figer le tracé »), les chiffres et les jauges, **mais aucun contrôle direct pour passer au circuit précédent/suivant** sans descendre dans la grille `#circuits` (`#p-categories` en bas ne change que les familles).
- **Ce qu'il faut brancher proprement** :
  1. **Boutons directs `<button>` précédent / suivant sur `.apercu-circuit`** (`#p-apercu-prec` `‹` et `#p-apercu-suiv` `›`, encadrant `#p-trace-3d` en overlay ergonomique arcade ou intégrés dans `.apercu-entete`) qui cyclent directement à travers les circuits disponibles (et changent automatiquement de famille si nécessaire, en synchronisant la carte `[role="radio"]` sélectionnée dans `#circuits` + la vitrine 3D de fond !).
  2. **Interaction directe sur le canvas `#p-trace-3d` / `.apercu-circuit`** :
     - Clic sur les flèches overlay `‹` / `›` (ou moitié gauche / moitié droite), **molette souris** (`wheel` avec anti-rebond ~180 ms) et **glisser horizontal tactile/souris** (`pointerdown`/`pointerup` swipe gauche/droite) sur `#p-trace-3d` pour passer au circuit précédent/suivant,
     - Support clavier/manette (`ArrowLeft` / `ArrowRight`) quand le focus est dans `.apercu-circuit`,
     - Bonus cohérence : sur `#p-bilan` (`src/index.html:468`), permettre aussi de cliquer ou flécher sur la tuile `Destination` (`#p-bilan-circuit`) pour changer de circuit ou rouvrir `#p-piste`.
  3. **Tests à vérifier / compléter** : `verifications/menu-arcade.test.mjs` et `verifications/navigation-menu.test.mjs` (conserver `overflow = 0 px` à `1280×720` et la navigation manette 100 % fonctionnelle).

---

## 4. Chantier #3 : Nouveau titre plus orienté F1 (remplacer « BITUME »)

### Demande exacte de David (verbatim)
> *« et aussi il faudrait trouver un titre plus orienté F1, bitume c bof en fait »*

### Cadrage & marche à suivre pour la relève
- **Important** : proposer d'abord à David **5 à 8 propositions de titres F1 originaux et percutants** (esprit monoplace Grand Prix, vitesse pure, aérodynamisme, vibreurs, V10, zone rouge — ex. **APEX**, **ZONE ROUGE**, **RUPTEUR**, **MONOPLACE**, **PLEIN GAZ**, **CHICANE**, **FOND PLAT**, **AERO GP** ; éviter toute marque déposée FIA/Formula 1) via `ask_question` ou liste courte **avant** de modifier les textes visibles, afin que David choisisse son titre !
- **Règles techniques lors du renommage une fois le titre validé par David** :
  - Mettre à jour l'affichage visible : `<title>`, `<meta name="description">`, écran titre `.marque` (`src/index.html`), `VERSION.json` (`"titre"`), HUD/menus/salon si le titre y apparaît.
  - **Préserver 100 % de la compatibilité technique** : conserver les clés `localStorage` / `IndexedDB` (`bitume.*`), le namespace JS interne `globalThis.BITUME`, `construire.py` (`dist/bitume.html`) et `deposer.sh` sur `amiga` (sauf demande explicite de renommer aussi le domaine/dépôt).

---

## 5. Plan d'exécution pas-à-pas pour la relève

1. **Dès l'ouverture de la session** :
   - Vérifier que `git status` est propre sur `/Users/david/Projects/bitume` (commit `0.2.346`).
   - Proposer immédiatement à David la sélection de **nouveaux titres orientés F1** pour recueillir son choix pendant ou avant l'exécution technique.
2. **Valider en 2 min le Worker `Route sans fin` en HTTP local** :
   - Lancer un mini serveur HTTP local sur `dist/` et exécuter un banc 3,5 km pour vérifier `0` appel `decor.construire` sur le fil principal et `maxFrameMs < 25 ms` aux passages de checkpoints (`1500 m`, `3000 m`). Si un navigateur ouvert en `file://` bloque aussi `new Worker('data:...')`, ajouter un découpage coopératif (`await frame`) dans le repli sans Worker de `src/route-sans-fin-flux.js`.
3. **Implémenter le changement de circuit direct depuis `.apercu-circuit` (`src/index.html`, `src/menu-arcade.js`, `src/style.css`, `src/jeu.js`)** :
   - Boutons `‹` / `›` sur l'aperçu 3D + molette / swipe sur `#p-trace-3d` + synchro complète `#circuits` et vitrine 3D + tests `menu-arcade.test.mjs` & `navigation-menu.test.mjs` verts.
4. **Implémenter la fluidification F1 des tracés + Sauts fun** :
   - Identifier les tests géométriques :
     ```sh
     cd /Users/david/Projects/bitume && ls verifications/*circuit* verifications/*cimes* verifications/*larche* verifications/*alizes* verifications/*raccords* verifications/*physx*
     ```
     Adapter proprement les seuils si un test épingle l'ancien profil bosselé, **sans casser** `B.routeDesCimes.valider(c)`, `devers-alizes.test.mjs` (0 tonneau / 0 replacement sur 60 s à 12 voitures !), `physx-circuits.test.mjs`, ni `records-physique`.
   - `src/decor.js` : subdiviser transversalement la nappe de chaussée (`4` sous-bandes au lieu d'une seule quand `|devers| > 0.08` ou partout sur la piste, très léger en triangles mais supprime 100 % du vrillage diagonal sur le Ring 40° et les entrées de virage !).
   - `src/larche-vinadio.js` : passage `Float64Array`, lissage C2 de `y` (suppression des marches de 10 cm), correction du signe de `devers` (`+courbure * 1.6` lissé + fondu aux ponts), ajout de 3 crêtes de saut droites sécurisées.
   - `src/route-des-cimes.js` : raccords verticaux quintiques `C2` partout (`RACCORDS_PENTE >= 60 m`), lissage C2 du dévers, transformation de la crête du Mur + descente Alpage en vrais *Flugplatz* F1 fluides (en laissant l'IA y passer fort !).
   - `src/circuit.js`, `src/circuit-raccords.js`, `src/route-sans-fin.js` : lissage C2 des coutures et dévers F1 porteurs + bosses de saut `c.sauts` sur les portions droites rapides (hors stands/ligne de départ/tunnels).
5. **Appliquer le titre F1 choisi par David & qualifier sous PhysX + Chrome Mac Metal-3 WebGPU** :
   - Vérifier sur `ovale-des-forges`, `route-des-cimes`, `larche`, `forets-du-pacifique`, `sierra` et `sans-fin` :
     - **0 rebond parasite / 0 accrochage de fond plat** sur les raccords,
     - **Vrais sauts F1 stables** (`airborne > 0.25 s`, réception à plat sur les 4 roues sans tonneau ni tête-à-queue),
     - **60,0 FPS stables**, `overflow = 0 px` à `1280×720`, et toutes les suites de vérification vertes.
6. **Rebuild `python3 construire.py`**, puis demander à David (ou si demandé) `commit + push + ./deposer.sh`.
