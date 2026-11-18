# Lot 19 — Pluie et neige sur la visière et sur l’objectif

Date : **18 novembre 2026**. Statut : **prototype autonome, mesures et spécification d’intégration ; rien n’est
intégré au jeu ni au moteur**. Branche `etude/vitre`.

Demande de David (18/11/2026) : « améliore énormément les effets de gouttes de pluie et de neige sur l’écran, faut
même que ça devienne gênant parfois, comme si on était dans la réalité ».

Tout le lot est dans `docs/reprise/rapports/vitre-2026-11-18/`. Pour juger l’effet, ouvrir les captures
(`captures/`, 14 images) puis le prototype en mouvement :
`prototype.html?scene=pluie-grille&pluie=1&vitesse=0&anim=1&panneau=1` (curseurs pluie, neige, vitesse, nuage d’eau,
froid, humidité, intensité, vue extérieure).

## 1. Ce qui est livré

| Fichier | Rôle |
|---|---|
| `visiere.js` | Module `B.visiere` : modèle à pas fixe (CPU) et effet GLSL ES 3.00 (trois paliers). Destiné à devenir `src/visiere.js`. |
| `prototype.html` | Page WebGL2 autonome (sans dépendance ni réseau) : l’effet sur de vraies images du jeu ; paramètres d’URL, contrôles (`controle=sec`, `controle=ips`) et mesures (`mesure=1`). |
| `scenes.js`, `fabriquer-scenes.py`, `capturer-scenes.sh` | Six images du jeu 0.2.38 (1280 × 720, sans HUD ni couches 2D de pluie), en `data:` : une page ouverte depuis le disque ne peut pas donner à WebGL une image voisine. |
| `capturer.sh`, `captures/*.jpg` | 14 captures de l’effet dans Chrome sans interface (GPU du Mac). |
| `mesurer.mjs`, `mesures-1.jsonl`, `mesures-2.jsonl`, `lire-mesures.py` | Contrôles et coût mesuré (deux passes complètes, code final). |
| `verifications/visiere.test.mjs` | 13 contrôles du module (Node). `muter.py` et `mutants.txt` prouvent qu’il échoue quand une garantie casse. |

## 2. Le modèle : ce qui est simulé, ce qui est procédural

Deux moitiés, séparées pour une raison précise : ce qui a une **mémoire** (l’eau qui s’accumule à l’arrêt, que l’air
chasse, la neige qui s’entasse au bord) doit être intégré dans le temps ; ce qui a une **forme** (où est chaque goutte,
son contour, son reflet) peut se recalculer à chaque pixel sans rien stocker.

### 2.1 Simulé sur le processeur, pas fixe de 1/120 s

`avancer(e, dt, entrees)` découpe le temps réel en pas de 1/120 s (au plus 0,25 s rattrapées, soit 30 pas ; pause et
`dt` invalides sans effet). Le reliquat sert à prolonger les horloges jusqu’à l’instant de l’image : le mouvement
reste continu à 144 Hz (une image sur six ne contient aucun pas entier) comme à 30 Hz. Aucun hasard, aucune
allocation après `creer()` : l’état et son `Float32Array` d’uniformes sont réutilisés. Coût mesuré sous Node (Apple
M5) : **0,2 µs par image** pour `avancer` + `uniformes`, 0,3 µs pour 20 appels à `embruns()` et un `viser()`.

| Grandeur (0 à 1) | Monte | Descend | Pourquoi |
|---|---|---|---|
| `air` | Part de l’air dans le mouvement de l’eau : `lisse(9, 52, v)` m/s, nulle sous 32 km/h, entière vers 190 km/h. | — | À l’arrêt la gravité décide, à vitesse le vent. |
| `gouttes` (posées) | Pluie × impacts (×0,45 à l’arrêt, ×1,8 au-delà de 160 km/h) + nuage d’eau × 0,6. | `2,6 air²` + séchage lent. | Une visière à l’arrêt sature ; à 250 km/h l’air la vide (contrôle : < 0,45 à 250 km/h, > 0,9 à l’arrêt après 30 s). |
| `gouttelettes` | Pluie (même à l’arrêt), nuage d’eau × 2,4. | `0,55 air` seulement : elles collent. | Le grain fin qui reste à vitesse. |
| `coulures` | Visière chargée (`gouttes` > 0,3) et peu d’air. | Vite quand l’air revient. | Les grosses gouttes qui dévalent à l’arrêt. |
| `trainees` | Pluie et nuage d’eau, à partir de 36 km/h, en entier au-delà de 150 km/h. | 1,6 /s. | L’eau chassée vers le haut et les côtés. |
| `nappes` | Visière saturée (`gouttes` > 0,55) à l’arrêt. | 1,5 /s. | Les plaques d’eau qui glissent : la gêne maximale. |
| `embruns` | Vers la cible en 0,2 s (taux 5 /s). | Taux 0,9 /s (≈ 1 s). | On entre d’un coup dans le nuage d’une voiture, on en sort lentement. |
| `neigeCollee` | Neige × (0,5 à 1,8 selon la vitesse). | `1,5 air²` + fonte (plus vite s’il fait doux). | La fonte nourrit `gouttes` : la neige devient de l’eau. |
| `bourrelet` | Neige, plus vite quand l’air la pousse au bord. | Fonte à la tiédeur, usure au-delà de 200 km/h. | Contrôle : > 0,4 après 60 s de forte neige à 45 km/h, au moins 30 % de moins après 60 s de redoux. |
| `buee` | Froid × humidité, à l’arrêt, **dans le casque seulement**. | La ventilation l’efface (7 à 58 km/h). | Jamais sur l’objectif d’une caméra extérieure. |

Horloges intégrées (l’effet n’en lit que l’intégrale, donc un changement de vitesse ne fait jamais sauter une
goutte) : `glisse` (coulures, gravité), `vent` (traînées), `cycle` (naissance et départ des gouttes), `cycleNeige`.

### 2.2 Procédural sur le processeur graphique

Chaque goutte vit dans une case d’une grille fixée à l’écran. Un hachage entier (murmur3, `vH`) de la case, de la
couche et de la **graine** décide de sa présence (rang comparé à la couverture simulée), de son rythme, de sa place
et de sa forme ; le numéro de cycle, tiré de l’horloge `cycle`, la fait naître, vivre puis partir, et la case reçoit
une autre goutte au cycle suivant. Une goutte est bornée pour tenir dans sa case : **aucune case voisine à lire**,
d’où le coût plat. Les couches :

- **Gouttes posées** (deux couches en Moyenne, trois en Fine, une en Légère) et **gouttelettes** : pied irrégulier
  (ovale tourné et lobes en trèfle, sans trigonométrie), haut et bas étirés à part. Bombée, la goutte montre la
  scène **à l’envers** (le ciel en bas) ; grosse et étalée, elle laisse voir à travers et ne tord que son bord. Bord
  sombre (réflexion totale), éclat du ciel en haut. L’air laisse peu d’eau au centre de la visière, où il frappe de
  face, beaucoup en haut et aux côtés (`vReste`). Des amas (bruit lent) évitent l’aspect de grille.
- **Nappes** : bruit à seuil dont la pente donne la réfraction (forte au ménisque, nulle au milieu) ; une nappe
  remplace les gouttes posées qu’elle recouvre.
- **Coulures** : colonnes ; une goutte lourde descend par à-coups sur un chemin fixe, avale ce qu’elle croise
  (Moyenne et Fine), laisse un film étroit qui tord l’image et des gouttelettes qui sèchent.
- **Traînées de vent** : en éventail depuis le point d’arrêt de l’air sous la visière, la tête s’étire du chemin
  parcouru en 1/40 s, film derrière.
- **Nuage d’eau** de la voiture devant (dans le monde, pas sur la visière) : panache autour de la voiture visée,
  tourbillons qui fuient d’elle ; densité plafonnée à 0,86 pour qu’on devine encore la voiture au cœur.
- **Neige** : flocons en touffes de trois ou quatre lobes, grain cristallin, opacité propre ; avec l’âge la touffe
  pâlit et laisse une goutte. **Bourrelets** au bord : plus épais en bas et dans les coins, tas et trouées, bord
  intérieur irrégulier, jour bleuté là où la neige est mince. Voile blanc des rafales, dehors seulement.
- **Buée** : monte du bas, laiteuse, irrégulière (bruit fractal).
- **Objectif** (vues extérieures) : gouttes dans des cases trois fois plus grandes (2,4 en Légère), donc plus grosses
  et plus rares, floues (mise au point au loin), réparties partout (l’air n’y dessine pas l’éventail de la visière) ;
  moins de coulures et de nappes, pas de buée. La monture abrite l’objectif : l’air le nettoie moins bien.

Le nuage d’eau, la brume et le voile de neige sont **dehors** : ils s’arrêtent à la planche de bord (`proche`, hauteur
du haut du cockpit à l’écran, 0 en vue extérieure).

L’effet est une fonction des uniformes seuls : même image à 30, 47, 60, 120 et 144 images par seconde (contrôle
`controle=ips` : 0 pixel différent, uniformes identiques, sur trois scènes).

### 2.3 La gêne voulue

| Situation | Ce qui gêne | Capture |
|---|---|---|
| Forte pluie, arrêt sur la grille | Nappes, coulures et gouttes : la visière ne se vide plus. | `03`, `13` (autre graine) |
| Dans le nuage d’eau d’une voiture | La voiture de devant disparaît presque, rafales de gouttelettes. | `04` |
| Forte neige lente | Flocons collés, bourrelets qui rognent les bords, voile des rafales. | `07` |
| Froid humide à l’arrêt | Buée qui monte du bas. | `12` |
| 250 km/h sous la pluie | Peu d’eau posée, traînées et gouttelettes : l’air nettoie. | `01`, `02` |

Le réglage `intensite` (0 à 2) ne touche que l’affichage : la simulation reste la même (contrôle).

## 3. Entrées du modèle et leurs sources dans le jeu

`avancer(e, dt, c)` lit un objet réutilisé (aucune allocation). Le câblage proposé reprend celui de `B.vitre` dans
`dessinerMeteo` (`src/jeu.js:494-514`), qui calcule déjà pluie, neige, vitesse et abri.

| Entrée | Unité | Source proposée |
|---|---|---|
| `pluie`, `neige` | 0 à 1 | Comme `B.vitre` : `neige = precipitationsNeige(S)` (`jeu.js:490`) ; `pluie = neige > 0 ? 0 : S.meteo.pluie`. |
| `vitesse` | m/s | `abs(voiture.etat.v)` de la voiture suivie (`S.suivie`), comme `B.vitre`. |
| `abri` | booléen | `sousLaVoute(S.course.c, cam.pos)` déjà calculé (`jeu.js:501`). Sous la voûte plus rien n’arrive, l’eau posée part. |
| `vue` | `'cockpit'` / `'exterieur'` | `cockpit` → visière ; `poursuite` et vues du réalisateur → objectif (voir question 5). |
| `embruns` | 0 à 1 | Pour chaque voiture devant à moins de 70 m : `B.visiere.embruns(distance, ecart, v, eau)` avec `distance = B.circuit.ecart(c, s_joueur, s_autre)`, `ecart = d_autre − d_joueur`, `eau = B.conduite.eauSurPiste(S.meteo)` (`conduite.js:133`) ; garder le maximum. Seuils de `traces.js:82` (eau > 0,12, v > 14 m/s) ; 0 si l’autre est dans le tunnel. |
| `cibleX`, `cibleY`, `cibleTaille` | uv, hauteurs d’écran | `B.visiere.viser(sortie, cam, x, y, z, aspect, 1.8)` sur la voiture qui donne le maximum (même convention de caméra que `meteo.js`). |
| `froid` | 0 à 1 | Température réelle quand elle existe (`conditions-course.js:188`, `meta.temperature`) : `clamp((8 − T) / 10)` ; sinon 0,9 en hiver (`saison.neige`), 0,2 ailleurs. **Proposition à valider.** |
| `humidite` | 0 à 1 | `clamp(0,35 + 0,65 × max(pluie, mouille, 0,5 × nuage))` sur `S.meteo`. **Proposition à valider.** |
| `proche`, `fondu` | uv | Haut du cockpit à l’écran : projeter avec `viser()` un point du bord de la coque de `voiture.js` ; le prototype prend 8° sous l’horizon pour un champ de 60°. 0 en vue extérieure. |
| `intensite` | 0 à 2 | Réglage d’affichage (question 2) ; 1 par défaut. |
| `graine` | entier | `graineCourse & 0xffff` (`jeu.js:169`) : **lue, jamais tirée** ; le hasard de la course n’est pas consommé. |

Uniformes (`uniformes(e)` remplit et rend le même `Float32Array(28)`, pour `uniform4fv('uVisiere', …)`) :

| `uVisiere[i]` | x | y | z | w |
|---|---|---|---|---|
| 0 | temps | glisse | vent | cycle |
| 1 | gouttelettes | gouttes | coulures | traînées |
| 2 | embruns | cibleX | cibleY | cibleTaille |
| 3 | neige collée | bourrelet | neige | cycle neige |
| 4 | buée | vitesse du vent | vue (0 casque, 1 objectif) | air |
| 5 | pluie | froid | intensité | graine |
| 6 | proche | fondu | nappes | — |

Plus `uVisiereTaille` (taille de la cible en pixels : les gouttes sont en hauteurs d’écran, donc de même aspect à toute
résolution) et `uVisiereCiel` (couleur du ciel, palier Légère seulement ; Moyenne et Fine la lisent dans la copie floue).

## 4. Paliers

| Palier | Ce qui est dessiné | Lectures de texture par pixel | Hachages par pixel, forte pluie à l’arrêt (typique → pire) |
|---|---|---|---|
| **Fine** (`high`) | Moyenne, plus une troisième couche de gouttes, une deuxième couche de flocons, une octave de plus aux nappes et aux bruits fractals. | Scène nette 1 ; copie floue 1 ; ciel 1 (même texel pour tous) ; dans l’eau +2 (scène et flou au point réfracté), sous un film +1 : **3 à 6**. Copie floue : 1,5 par pixel plein écran. | ≈ 38 → 60 |
| **Moyenne** (`medium`) | Gouttelettes, deux couches de gouttes en amas, nappes, coulures (qui avalent les gouttes, film et gouttelettes de sillage), traînées avec film, une couche de flocons, bourrelets, nuage d’eau tourbillonnant, voile de neige, buée. | Idem : **3 à 6** ; copie floue 1,5. | ≈ 31 → 46 |
| **Légère** (`low`) | Une couche de gouttes sans amas, coulures et traînées sans film, nuage d’eau aux tourbillons simplifiés, bourrelets, voile de neige, buée sans bruit ; ni gouttelettes, ni nappes, ni flocons collés. Couleur prémultipliée, mélangée par-dessus la scène (`ONE, ONE_MINUS_SRC_ALPHA`) ; le reflet d’une goutte est un dégradé du ciel. | **0** (le mélange est fait par le matériel). | ≈ 14 → 16 |
| Légère mi-résolution | La même couche, dessinée sur le quart des pixels puis posée agrandie. | 1 (pose). | Le quart. |

Les hachages sont un décompte statique lu dans le code (un hachage ≈ 10 opérations entières), pas une mesure ; les
temps du § 5 font foi. À sec (somme des couvertures ≤ 0,0008), le shader rend aussitôt la scène (Moyenne, Fine) ou
rien (Légère) : contrôle `controle=sec`, **0 pixel différent** sur 921 600 aux quatre variantes.

## 5. Coût mesuré

**Méthode.** Chrome sans interface, ANGLE sur Metal, **Apple M5**, en temps réel (`mesurer.mjs`, CDP). Chaque poste est
mesuré en rafale : n passes identiques (n calé pour ≈ 250 ms de travail), trois rafales, médiane ; deux passes
complètes (`mesures-1.jsonl`, `mesures-2.jsonl`), les tableaux donnent l’intervalle entre les deux. Deux pièges
évités, constatés pendant le lot :

- Un GPU à tuiles (Apple) ne colorie pas un fragment opaque recouvert plus loin dans la même passe : mille copies
  plein écran sur la même cible n’en coûtent qu’une. Chaque dessin mesuré va donc sur l’une de **deux cibles
  alternées** (une passe de rendu par dessin, comme la passe post du jeu).
- Le chronomètre GPU (`EXT_disjoint_timer_query_webgl2`) d’ANGLE sur Metal donne **3 à 5 fois** le temps de mur de la
  même rafale, ce qui est physiquement impossible pour des passes en série : il compte le travail encore en file.
  **Seul le temps de mur est retenu** ; le chronomètre reste dans les fichiers, pour mémoire. `gl.finish` n’aide pas
  (Chrome en fait un simple `flush`).

Le temps de mur est une borne haute (signal de fin relevé à l’image près : moins de 7 % sur 250 ms). D’une passe à
l’autre, quelques postes varient presque du simple au double (Légère, neige, 3024 × 1964 : 2,06 et 4,02 ms) : lire
des ordres de grandeur, pas des centièmes. Pour Légère, le coût
donné est effet − copie de la scène (la copie précède le mélange dans le prototype, pas dans le jeu).

Temps de mur par passe, en ms (états : `sec` = à sec, pluie 250 = forte pluie à 250 km/h, grille = forte pluie à
l’arrêt, nuage = dans le nuage d’eau à 235 km/h, neige = forte neige lente avec accumulation) :

**1280 × 720 (0,92 Mpx)**

| Palier | sec | pluie 250 | grille | nuage | neige | copie floue | copie seule |
|---|---|---|---|---|---|---|---|
| Fine | 0,03–0,05 | 0,49–0,63 | 0,85–1,08 | 0,63–0,79 | 0,96–1,21 | 0,10–0,12 | 0,03–0,04 |
| Moyenne | 0,03–0,04 | 0,47–0,55 | 0,74–0,89 | 0,57–0,71 | 0,58–0,78 | 0,10–0,13 | 0,03–0,04 |
| Légère | 0,01–0,02 | 0,21–0,28 | 0,25–0,33 | 0,24–0,35 | 0,27–0,40 | — | 0,02–0,04 |
| Légère mi-rés. | 0,06–0,07 | 0,11–0,15 | 0,12–0,16 | 0,12–0,17 | 0,13–0,20 | — | 0,02–0,04 |

**1920 × 1080 (2,07 Mpx)**

| Palier | sec | pluie 250 | grille | nuage | neige | copie floue | copie seule |
|---|---|---|---|---|---|---|---|
| Fine | 0,07–0,10 | 1,16–1,21 | 2,15–2,18 | 1,18–1,99 | 1,90–2,62 | 0,09–0,14 | 0,04–0,08 |
| Moyenne | 0,07 | 0,89–1,24 | 1,38–1,98 | 1,07–1,40 | 1,19–1,87 | 0,10–0,14 | 0,04–0,06 |
| Légère | 0,03–0,04 | 0,45–0,53 | 0,46–0,55 | 0,53–0,61 | 0,59–0,93 | — | 0,05–0,07 |
| Légère mi-rés. | 0,12–0,16 | 0,23–0,25 | 0,26–0,28 | 0,28 | 0,31–0,43 | — | 0,05–0,06 |

**3024 × 1964 (5,94 Mpx : Fine sur un portable Retina, profil `resolution: 2`)**

| Palier | sec | pluie 250 | grille | nuage | neige | copie floue | copie seule |
|---|---|---|---|---|---|---|---|
| Fine | 0,20–0,22 | 2,77–3,24 | 4,99–5,79 | 3,28–4,83 | 6,55–7,75 | 0,14–0,20 | 0,14–0,19 |
| Moyenne | 0,20–0,22 | 2,64–4,05 | 4,08–6,99 | 3,45–5,64 | 3,98–4,28 | 0,13–0,44 | 0,14–0,24 |
| Légère | 0,11–0,12 | 1,26–1,41 | 1,43–1,67 | 1,59–2,62 | 2,06–4,02 | — | 0,14–0,27 |
| Légère mi-rés. | 0,47–0,83 | 0,67–0,89 | 0,79–0,93 | 0,79–1,00 | 0,93–1,13 | — | 0,15–0,26 |

Ce qu’on en tire :

- Le coût suit le nombre de pixels. Les profils rendent à `min(dpr, 2)` (Fine), 1 (Moyenne) et 0,8 (Légère) pixel
  par pixel CSS (`src/graphismes.js:47-100`) : sur un portable Retina, Fine paie le tableau 5,94 Mpx (**3 à 8 ms sous
  forte pluie ou forte neige**, M5), Moyenne ≈ 1,5 Mpx et Légère ≈ 0,95 Mpx (entre les deux premiers tableaux).
- À sec, le jeu ne dessine rien de plus si le moteur saute l’effet (§ 6) : coût nul.
- Copie floue (réduction au quart et deux flous séparables, cinq passes au quart) : 0,1 à 0,2 ms.
- Légère à mi-résolution divise le coût procédural par 2 à 4 pour une image presque identique (captures `10` et
  `14`) ; la même idée pour Moyenne et Fine (l’eau calculée sur le quart des pixels, la scène lue à pleine
  résolution) n’est **pas prototypée** (§ 9).
- **Aucune mesure sur un GPU modeste.** Légère vise justement ces machines ; un GPU intégré ancien peut être 5 à 10
  fois plus lent que le M5 (ordre de grandeur, non mesuré). À mesurer avant de choisir Légère (question 3).
- Compilation des shaders : non mesurée. Les trois programmes sont à compiler au chargement (§ 6).

## 6. Intégration dans FERRO

`src/moteur/renderer.js` est un module verrouillé (`FERRO.lock.json`, FERRO 0.3.9) : la modification se fait dans la
référence `M4D135/FERRO:src/ferro`, qualifiée puis propagée ; BITUME n’y touche pas localement. Le jeu crée le moteur
WebGL2 directement (`window.FRender.create`, `jeu.js:2698`) : pas de portage WGSL tant que le moteur WebGPU de FERRO
n’est pas employé par BITUME. Proposition, sur le modèle de `fx.foule` (code du jeu, état du moteur) :

1. **Option de dessin** `draw(camera, objets, { …, visiere })` avec
   `visiere = { uniformes: Float32Array(28), ciel: [r, g, b], palier: 0|1|2 }`, le même objet à chaque image ;
   absente ou `null` : rien ne change, coût nul. Le jeu passe `null` quand la somme des couvertures est ≤ 0,0008
   (même seuil que le shader).
2. **Source GLSL fournie par le jeu à la création** (`create(canvas, { visiere: { source: B.visiere.source } })`) :
   le moteur reste indépendant du jeu. Il compile au chargement les variantes utiles — post Moyenne, post Fine et
   recouvrement Légère — pour qu’un changement de palier par le gouverneur Auto ne compile rien en course.
3. **Copie floue** : deux cibles au quart de la taille (`post.voile`, `post.voile2`, ≈ 0,5 Mo chacune en 1080p),
   créées avec les cibles post et libérées par `freePost`. Après les passes 0 et 1 du halo : réduction de
   `post.scene` (quatre lectures bilinéaires), puis flou horizontal, vertical, deux fois (poids du halo). Le halo ne
   peut pas servir : sa réduction ne garde que les zones claires.
4. **Place dans la passe post** : en passe 2 (composition du halo, `POST_FRAG`), `c=scene.rgb+c*.28` devient
   `c=visiere(vUV)+c*.28` : l’eau tord et voile la scène, le halo des lumières s’ajoute ensuite. `scene.a` reste lu
   pour les reflets. `#define VISIERE_SCENE uScene`, `#define VISIERE_VOILE uVoile` (une unité de texture libre, 4
   par exemple ; le post emploie 0, 1 et 3). Les reflets d’écran (`uReflections`) se mélangent après : ils passeraient
   devant l’eau. Pour les mettre dessous, remplacer dans le module les trois `texture(VISIERE_SCENE, …).rgb` par une
   macro `VISIERE_MONDE(uv)` que le moteur définit (scène + reflets), soit deux lectures de plus dans l’eau.
5. **Sans halo mais avec cibles post** (Moyenne ou Fine quand le gouverneur coupe le halo, `fx.bloom === false`) :
   aujourd’hui la scène va alors droit sur la toile (`renderer.js:3122`, `3155`). Quand `visiere` est active, le
   moteur la rend dans `post.scene` (comme pour `composeScreen`), fait la copie floue, puis une passe de composition
   `fragColor=vec4(visiere(vUV),1.)`. BITUME n’emploie pas `options.composition` : la passe 3 ne sert pas. Coût
   ajouté : une copie plein écran (0,04 à 0,2 ms mesurés) et la copie floue.
6. **Sans post-traitement** (Légère, `quality === 'low'` : aucune cible post) : après la scène, un triangle plein
   écran du programme `visiereLegere`, mélange `ONE, ONE_MINUS_SRC_ALPHA`, sans profondeur, sur le tampon de la toile.
   Variante mi-résolution (selon la mesure sur GPU modeste) : une cible RGBA8 de `ceil(l/2) × ceil(h/2)`, puis une
   pose agrandie avec le même mélange (le prototype le fait : `demi=1`).
7. **Profondeur** (facultatif) : `vLoin` sépare le cockpit du monde par la hauteur `proche`. Si la scène a une texture
   de profondeur (`colorTarget(…, 'texture')`), le moteur peut la substituer : plus juste en virage, une texture de
   plus. Pas nécessaire pour une première version.
8. **Statistiques** : `stats.visiere = { palier, passes }` pour `B.mesures`.

## 7. Intégration dans le jeu

1. `src/visiere.js` = `visiere.js` du rapport (le module ne dépend que de `globalThis.BITUME`), ajouté à `MODULES` de
   `construire.py` ; `verifications/visiere.test.mjs` pointé vers lui.
2. Un état par joueur (`S.visiere = B.visiere.creer()`) et un objet d’entrées réutilisé, remplis dans `dessinerMeteo`
   (§ 3) ; `avancer` puis `uniformes` à chaque image, `viser` pour la voiture qui projette le nuage. Écran partagé :
   la vue du joueur 2 est rendue par le même moteur puis copiée dans `#scene2` (`jeu.js:1664-1672`) ; chaque appel à
   `rendu.draw` reçoit la visière de son joueur, et l’état du joueur 2 avance à chaque image même quand sa vue n’est
   rendue qu’une image sur deux.
3. `B.vitre` (Canvas2D) s’efface (`B.vitre.effacer`) quand l’effet est actif ; il reste le repli si le moteur n’offre
   pas l’option, et peut-être pour Légère (question 3).
4. Ce qui est au-dessus de la toile WebGL ne reçoit pas l’effet : les **glaces des rétroviseurs** (`#glace-g`,
   `#glace-d`, toiles DOM) et la **pluie 2D** (`#meteo`, `meteo.js`). Aujourd’hui `#vitre` passe au-dessus des glaces ;
   avec l’effet dans la scène, les gouttes s’arrêteraient au bord des glaces (question 6). La pluie 2D tomberait
   devant les gouttes de la visière ; défaut léger, à revoir si la pluie passe un jour dans le moteur.
5. Le HUD reste net : il est en DOM, au-dessus.
6. Réseau et rejouabilité : l’effet ne lit que l’état de la course et ne tire aucun hasard ; rien n’est envoyé.

## 8. Preuves

| Preuve | Résultat |
|---|---|
| `node verifications/visiere.test.mjs` | 13 contrôles passés. |
| Suite complète (`for t in verifications/*.test.mjs …`) | Aucun échec. |
| `python3 -I muter.py <dossier>` → `mutants.txt` | 10 mutants sur 11 font échouer le test (extrapolation du reliquat, hasard, allocation, buée dehors, air, pas fixe, portée des gerbes, accolade au palier Fine, Légère qui lit la scène, sortie à sec). Le 11ᵉ (seuil des gerbes à 8 m/s) est équivalent : `lisse(14, …)` y vaut déjà 0. |
| `controle=sec` (deux passes) | 0 pixel différent sur 921 600, aux paliers Fine, Moyenne, Légère et Légère mi-résolution. |
| `controle=ips` (deux passes) | 30, 47, 120, 144 Hz contre 60 Hz : 0 pixel différent, écart des uniformes 0, sur pluie à 250, grille et neige. |
| Captures `01` à `14` | Voir ci-dessous ; image fixe, le mouvement se juge dans le prototype (`anim=1`). |
| `mesures-1.jsonl`, `mesures-2.jsonl` | § 5. |

Captures (1280 × 720, palier Fine sauf mention) : `01` bruine à 250 km/h · `02` forte pluie à 250 km/h · `03` forte
pluie, arrêt sur la grille · `04` dans le nuage d’eau d’une voiture à 235 km/h · `05` pluie, vue extérieure
(objectif) · `06` neige légère à 160 km/h · `07` forte neige à 45 km/h, accumulation · `08` sec · `09` grille,
Moyenne · `10` grille, Légère · `11` nuage d’eau, Légère · `12` buée, froid humide à l’arrêt · `13` grille, graine 7
· `14` grille, Légère à mi-résolution.

## 9. Constats, limites et ce qui n’est pas fait

- **Bandes verticales pâles** dans le fond des images du jeu sous la pluie (scènes `pluie-grille`, `pluie-course`) :
  elles sont dans la scène elle-même (capture de contrôle sans eau, effet identité prouvé). Origine non cherchée dans
  ce lot (rideaux de pluie ou gerbes 3D, à vérifier).
- **Fine sur écran 2×** : 3 à 8 ms sous forte pluie ou neige sur un M5. La parade proposée (couche d’eau au quart des
  pixels, composition à pleine résolution) n’est pas prototypée.
- **Pas d’intégration** au jeu ni à FERRO (prototype demandé ; moteur verrouillé), donc pas de démonstration en jeu
  ni de `integration.patch`.
- **Pas de mesure sur GPU modeste** ni sur david-pc ; pas de mesure de compilation des shaders.
- Rétroviseurs et pluie 2D au-dessus de la scène (§ 7.4) : non traités.
- « Essuyer la visière » : non fait, en attente de la décision (question 1).

## 10. Questions pour David

1. **Essuyer la visière** : un bouton (le pilote passe le gant ; la visière se vide, les nappes d’abord), un geste
   automatique à l’arrêt, ou rien (la gêne reste entière) ?
2. **Réglage** « Gouttes sur l’écran » (intensité 0 à 2, défaut 1, 0 = aucune) dans les réglages d’affichage ?
3. **Légère** : garder `vitre.js` (quelques contours en Canvas2D), ou la nouvelle couche sans lecture de la scène,
   pleine ou mi-résolution, après une mesure sur un GPU modeste ?
4. **Fine sur écran 2×** : accepter 3 à 8 ms sous forte pluie ou neige, ou faire calculer l’eau au quart des pixels
   (travail FERRO en plus) ?
5. **Vues du réalisateur** (télé, hélico, orbite, travelling, sol) : gouttes sur l’objectif comme une vraie caméra de
   bord de piste, atténuées, ou aucune ? Proposition : la vue poursuite en a, les vues du réalisateur à moitié.
6. **Rétroviseurs** : les gouttes doivent-elles passer sur les glaces (la visière est devant elles) ? Cela demande
   que le rendu des glaces reçoive la même couche, recadrée.
7. **Buée** : la ventilation l’efface dès 7 à 58 km/h. La veut-on plus tenace au départ par temps froid ?

## 11. Reprendre

```sh
cd docs/reprise/rapports/vitre-2026-11-18
open 'prototype.html?scene=pluie-grille&pluie=1&vitesse=0&anim=1&panneau=1'
zsh capturer.sh /tmp/visiere-captures                  # 14 captures PNG
node mesurer.mjs /tmp/visiere-mesures.jsonl            # contrôles et mesures (≈ 2 min, GPU au repos)
python3 -I lire-mesures.py /tmp/visiere-mesures.jsonl  # tableaux du § 5
python3 -I muter.py /tmp/visiere-mutants               # le test échoue sur chaque mutant
cd ../../../.. && node verifications/visiere.test.mjs
```
