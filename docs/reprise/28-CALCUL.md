# Lot 28 « calcul » : où part le temps, et ce qui le réduit

**Mise à jour du 22 novembre, version 0.2.111.** Le Fjord prépare son herbier à la demande. Pour un grand herbier en séance, le jeu embarque le noyau WebAssembly de 28F avec repli JavaScript. À Larche, en Fine, les six chargements CPU donnent un gain médian de 218 ms pour le circuit, le décor et la végétation, à empreinte géométrique identique. Les mesures historiques ci-dessous restent celles de leurs versions. [Mesures de Larche](rapports/LARCHE-RENDU-2026-11-22/chargement-herbier-0111.json) · [Budget des onze circuits](rapports/LARCHE-RENDU-2026-11-22/budget-decors.json)

Étude du 18/11/2026, arbre `etude/calcul` (base main 0.2.39) ; Apple M5 (10 cœurs, 24 Go), Chrome 157 sans interface avec la vraie carte graphique, Node
24.18. D'autres agents chargeaient la machine (charge 13 à 160) : les temps muraux varient jusqu'à ×3 d'un essai à l'autre, d'où les temps processeur de Node
partout où c'est possible. Chiffres : médiane [min–max] d'au moins trois essais. Résumés dans `docs/reprise/rapports/calcul-2026-11-18/` (index :
`MESURES.md`), code des essais dans `prototypes/calcul/`. Rien de `src/` ni de `verifications/` n'est modifié.

**Seuil retenu** (un choix, pas une mesure) : une image figée de plus de 50 ms (trois images à 60 Hz) se voit ; un gain par image compte à partir de 1 ms (6 %
du budget à 60 Hz, 12 % à 120 Hz).

## 1. Ce que David a demandé (mots exacts)

1. « reflets aussi sur les vehicule et persos , grain des textures generées, precache pour optimoiser et charger tout en vram ram, test bench la premiere fois
   qu'on charge une version pas systemeatique. tous les effets possible gerées par les gpu cuda ou non , des librairies c si necessaire pour otpimiser tout e
   qui est procedural et math »
2. « question, si on fait ça ensuite pour macosx  linux windows xbox ps5 par exemple, on peut encore amléiorer le moteur ? optimiser ? »
3. Plus tôt : « optimise son moteur pour le rendre le plus fluide possible sur n'importe quelle machine, aucun accro de buffering ou autre pendant le jeu,
   precache en debut de niveau en cas, fais tout pour tout avoir en ram et que ça soit 100% fluide 30fps ou 60 fps ou 120fps ».

Reflets des voitures et des personnages, grain des textures : demandes visuelles, hors de ce lot ; le banc une fois par version est au lot 5B.

## 2. Où part le temps

**Réponse courte.** En course, le processeur du M5 n'est pas la limite (5 à 6 ms par image). Le gros accroc est ailleurs : **le niveau entier se construit
dans le clic qui choisit le circuit**, et l'image reste figée 1,5 à 2,5 s (4,4 à 6,7 s à processeur ralenti ×4). L'herbier, découpe des triangles de terrain
autour de la route et des obstacles (`creerHerbier`, decor.js), en prend la moitié aux trois quarts. Le lot 5B ne le chiffre pas : ses relevés portent sur la
course et sur la première image du départ.

### 2.1 Construction d'un niveau, étape par étape (Node, temps processeur, Fine, première construction)

| Circuit | Total des étapes | Herbier | Végétation | Faune | Envoi GPU (principal + rétro) | Relief |
|---|---|---|---|---|---|---|
| 0 Val-Brûlé (forêt) | 2 214 ms | 1 092 [863–1 257] | 385 | 173 | 188 + 103 | 50 |
| 1 Port-Sable (côte) | 1 938 | 1 039 [924–1 352] | 329 | 230 | 70 + 48 | 40 |
| 2 Haut-Col (montagne) | 2 035 | 968 [903–1 312] | 364 | 216 | 115 + 87 | 67 |
| 3 Lande-Noire (islande) | 280 | — | — | — | 14 + 8 | 76 |
| 4 Roche-Fauve (désert) | 281 | — | — | — | 12 + 8 | 83 |
| 5 Brume-de-Jade (asie) | 1 929 | 1 419 [851–1 871] | — | 171 | 14 + 6 | 127 |
| 6 Cap-Séquoia (pacifique) | 1 906 | 1 429 [946–1 578] | — | 132 | 14 + 8 | 103 |

Le reste : tracé 35 à 60 ms, chaussée 23 à 45 ms, assemblage du décor 64 à 124 ms. **Moyenne ne réduit rien** (2 117, 2 269, 2 431, 282, 281, 2 030, 1 995
ms) ; Légère : non mesuré. L'envoi au GPU est ici un empaquetage sur doublure WebGL ; sur vraie carte, Haut-Col mesure 102 [72–155] ms, du même ordre. Charge
17 à 113.

### 2.2 Le chemin réel dans Chrome (page instrumentée, ms murales)

| Circuit | Image figée au choix du circuit ×1 | dont herbier | Même chose ×4 | dont herbier | 1re image de course ×1 | ×4 |
|---|---|---|---|---|---|---|
| 0 Val-Brûlé (*) | 283 [233–283] | — | 883 [683–1 033] | — | 500 [483–800] | 1 367 [1 217–1 650] |
| 2 Haut-Col | **2 483** [2 333–3 283] | 1 323 | **6 733** [6 333–6 866] | 3 576 | 617 [400–767] | 1 400 [1 300–1 583] |
| 3 Lande-Noire | 417 [300–500] | — | 983 [850–1 200] | — | 300 [200–367] | 783 [683–1 033] |
| 6 Cap-Séquoia | **1 550** [1 317–1 867] | 958 | **4 367** [4 100–4 833] | 2 468 | 383 [300–483] | 733 [617–1 367] |

(*) Val-Brûlé est déjà bâti pour la vitrine du titre : son image figée vient de la **création des six autres circuits** à la première ouverture de l'écran de
préparation (258 ms ×1, 868 ms ×4). Charge 24 à 41 (×1), 39 à 113 (×4). La première image de course contient la création du moteur des rétroviseurs (255 à 309
ms ×1) et de la faune (105 à 202 ms ; aucune à Lande-Noire) ; le lot 5B la mesure à 117–167 ms ×1 sans instrumentation : retenir ici les parts, pas les
totaux. Autre accroc : **changer de saison refait l'herbier** (le cache n'en garde qu'une palette par circuit, decor.js 1197–1208) : 1,25 s ×1 et 4,27 s ×4 à
Haut-Col en hiver, 1,83 s et 3,55 s à Cap-Séquoia en automne (palier Moyenne), relevés pendant une course de banc.

### 2.3 Par image en course (profileur de V8, 8 s de course de banc, Fine, 1440 × 900)

| Course | ×1 : ms par image | dont rendu | rivaux (IA) | voitures | ×4 : ms par image | dont rendu |
|---|---|---|---|---|---|---|
| Val-Brûlé, soleil | 5,8 [5,3–6,7] | 2,1 | 0,39 | 0,40 | 37,9 [26,6–42,1] | 16,5 |
| Haut-Col, pluie | 5,5 [5,4–6,1] | 1,9 | 0,45 | 0,80 | 34,1 [20,7–39,1] | 13,6 |

Majorants (démarrage compris), 3 essais par cas ; charge 13 à 56 (×1), 33 à 80 (×4). Effets, par le minuteur du jeu : 0,06 à 0,12 ms par image ×1, 0,12 à
0,43 ms ×4. Rétroviseurs (page instrumentée) : 0,74 à 1,79 ms par image ×1 et 1,9 à 4,8 ms ×4, pour 1,26 à 2,61 ms (×1) au rendu principal. À ×4, le
processeur ne tient plus 60 Hz et frôle le budget de 30 Hz ; le rendu du moteur en prend 40 % ; les calculs d'effets restent partout sous le seuil.

## 3. Ce que coûte « tout en mémoire »

| Circuit | Nappes | Instances | Objets | Herbes | Tampons GPU par moteur | Tas JS après construction |
|---|---|---|---|---|---|---|
| 0 Val-Brûlé | 3,7 Mo | 5,7 Mo | 89 087 | 39 025 | 24,4 Mo | +110 Mo |
| 1 Port-Sable | 3,3 | 4,1 | 64 483 | 27 963 | 22,4 | +77 |
| 2 Haut-Col | 5,1 | 5,1 | 79 586 | 33 607 | 25,3 | +86 |
| 3 Lande-Noire | 4,5 | 0,6 | 9 945 | 0 | 20,2 | +8 |
| 4 Roche-Fauve | 4,7 | 0,6 | 8 867 | 0 | 20,3 | +8 |
| 5 Brume-de-Jade | 5,1 | 0,6 | 9 350 | 0 | 20,7 | +76 |
| 6 Cap-Séquoia | 5,3 | 0,6 | 9 618 | 0 | 20,9 | +72 |

Les tampons GPU sont doublés par les rétroviseurs (second contexte, copie du décor). Les cibles de rendu s'y ajoutent : le MSAA 4× seul coûte 32 octets par
pixel, environ 58 Mo à 1,8 Mpx (lot 5B, `cartes/renderer-ressources.md`). Textures générées : **non mesuré** (la doublure ne les compte pas).

- Le niveau courant est **déjà entièrement en mémoire avant le départ** : rien ne se charge en course (les accrocs de course du lot 5B sont des compilations
  de shaders et le ramasse-miettes).
- Précharger les sept niveaux coûterait 10,6 s de processeur sur le M5 (somme du tableau 2.1, 2,7 à 2,8 fois plus à ×4 au menu), environ +440 Mo de tas et 2 ×
  155 Mo de tampons GPU : déraisonnable sur une carte intégrée. L'équivalent utile : un niveau à la fois en mémoire et le cache binaire du § 6 (12,6 et
  14,5 Mo par niveau) pour générer une fois par version.

## 4. Effets : tableau et cibles

| Effet | Calculé aujourd'hui | Coût mesuré | Meilleure cible | Repli |
|---|---|---|---|---|
| Pluie (gouttes à l'écran) | processeur, Canvas 2D (meteo.js) | 0,22 ms/image ×1 | shader de pixels en surimpression | Canvas 2D actuel |
| Vitre, visière | Canvas 2D à 30 Hz (vitre.js) | 0,010–0,018 ms/image ×1 ; 0,03–0,04 ×4 | rester ainsi | — |
| Neige, feuilles | processeur (effets-saison.js), objets instanciés | ≈ 0,08 ms/image ×1 | rester ; shader de sommets si le nombre grossit | processeur |
| Gerbes, fumée, étincelles, débris, traces de pneus | processeur à 30 Hz (traces.js), instances | effets 0,06–0,12 ms/image ×1 ; vieillissement des traces 0,14 | rester (quelques centaines de particules, § 7) | — |
| Vent dans l'herbe et les arbres | shader de sommets, sources de vent tenues par le processeur | non mesuré à part (dans le rendu) | rester | — |
| Couvert d'herbe | préparé par le processeur à chaque image, dessiné en shader | 0,47 ms/image ×4 | rester | — |
| Public ; drapeaux | géométrie fixe du décor (silhouettes) ; état de course et réalisateur | aucun calcul par image ; drapeaux non mesuré | rester | — |
| Animaux | faune.js : habitats au départ, dessin par image | création 105–230 ms, dessin 0,011 ms/image ×1 | créer au chargement (5B) | — |
| Eau, reflets, halo | shaders de pixels (reflets d'écran, post-traitement) | coût GPU, non mesuré à part | rester | palier plus bas |
| Échappement | non construit (lot 20) | — | shader et instances | — |
| Ombres | passe GPU préparée par le processeur | préparation 0,26 ms/image ×1 | rester | atlas réduit |
| Rétroviseurs | second moteur WebGL complet | 0,74–1,79 ms/image ×1, création 255–309 ms | rendu dans une texture du contexte principal, ou un seul appareil WebGPU pour deux toiles | moteur à part actuel |

Aucun calcul d'effet ne dépasse 1 ms par image à ×1 (rien à « envoyer sur la carte » aujourd'hui) ; seul le rendu, rétroviseurs compris, passe le seuil.

## 5. Noyaux C en WebAssembly : verdict par poste

Prototype 1, l'herbier, hors de `src/` : JavaScript resserré (`herbier-serre.js` : tableaux typés, grilles à clé numérique, aucune allocation en boucle) et
noyau C (`herbier.c`, clang `--target=wasm32 -O3 -ffp-contract=off -nostdlib`), sur les arguments d'un vrai niveau (`banc-herbier.mjs`).

| Poste | Coût ×1 | JS resserré | WebAssembly | Verdict |
|---|---|---|---|---|
| Herbier, Haut-Col | 1 163 ms [1 109–1 304] | 456 ms (**×2,55**) | 259 ms (**×4,5** ; ×1,76 sur le JS resserré) | JS resserré d'abord |
| Herbier, Val-Brûlé | 739 ms [519–922] | 259 ms (**×2,85**) | 156 ms (**×4,7** ; ×1,66) | idem |
| Requête surface(x, z) | 1,8 à 2,5 µs | ×1,2 à ×1,4 | — | vient avec 28A |
| Végétation | 329 à 410 ms | non mesuré | non mesuré | rester JS, cache |
| Faune (habitats) | 105 à 250 ms | profite de la grille de l'herbier | — | au chargement |
| Empaquetage GPU, relief, tracé | 12 à 230 ms chacun | — | non (copie de données) | rien |
| Rendu par image | 1,9 à 2,1 ms ×1 (13,6 à 16,5 ×4) | non mesuré | non (les appels WebGL partent du JS) | banc WebGPU (28H) |
| IA, conduite par image | 0,2 à 0,5 ms ×1 | non mesuré | non mesuré | sous le seuil |

Temps processeur de Node, 3 à 5 essais alternés, charge 23 à 46 ; noyau seul : 178 et 290 ms en JS, 60 et 81 ms en Wasm (×3,0 à ×3,6). Identité **au bit
près** : 73 315 et 57 427 triangles identiques, 200 000 requêtes de surface identiques. `-msimd128` : aucun gain mesurable (×5,08 contre ×4,74, dans le
bruit). Poids : 5 963 octets, 7 952 en base64 ; compilation 0,17 à 0,26 ms, instanciation 0,04 à 0,17 ms. Le même `herbier.c` compile en natif (arm64).

**Déterminisme.** `src/reseau.js` synchronise l'état (hôte autoritaire, 15 champs float32 par voiture) : aucun pas à pas identique n'est exigé entre
machines ; seul le monde, tiré de la graine partagée, doit concorder. Sa génération appelle Math.sin, cos, pow, exp et atan2 (tracé, décor, végétation,
botanique, obstacles). Essai (`sensibilite-ulp.mjs`) : tous ces résultats décalés d'une unité au dernier rang, le monde reste le même sur 0, 2, 3 et 6
(longueurs, 47 609 / 43 157 / 7 858 / 7 502 objets, obstacles, arbres, tunnel ; positions à moins de 1e-11 m). Un seul sens de perturbation : aucune preuve
qu'il n'existe pas de bascule. Un noyau Wasm ne fixe les bits que de ce qu'il contient ; celui de l'herbier n'utilise que + − × ÷ et des comparaisons. La
suite p9 n'est pas concernée : aucun noyau ne touche la physique ni le tracé (non relancée, `src/` inchangé).

## 6. Cache entre deux visites

Prototype 2 (`scenario-worker-cache.js`), vraie page en `file://`, Fine, ×1, charge 23 à 41, 3 essais de 3 relectures. « Pire image » : plus long intervalle
entre deux images à la relecture.

| | Haut-Col (79 586 objets) | Cap-Séquoia (9 618 objets) |
|---|---|---|
| Régénération décor et herbier (fil principal) | 1 641 ms [805–2 386], image figée d'autant | 1 086 [1 081–1 664] |
| IndexedDB, graphe d'objets tel quel : relecture | 266 [202–435], pire image 250 | 260 [197–449], pire image 217 |
| IndexedDB, objets en JSON (34 Mo et 2,2 Mo) : relecture + analyse | 45 + 87, pire image 100 | 29 + 12, pire image 16,7 |
| **IndexedDB, tout binaire** (14,5 et 12,6 Mo) : relecture + objets refaits | **19 [9–28] + 17 [4–23], aucune image perdue** | **17 [12–99] + 5 [4–7], aucune** |
| Écriture binaire (une fois par version) | 42 [34–69] | 83 [38–401] |
| OPFS | **refusé en file://** (SecurityError) | idem |

- En `file://`, Chrome 157 accepte IndexedDB (origine « file:// ») et un Worker `blob:`, refuse OPFS ; `crossOriginIsolated` est faux et SharedArrayBuffer
  absent (pas de fils à mémoire partagée). Firefox et Safari en `file://` : non vérifié.
- Le cache couvre le décor et les triangles de l'herbier ; la grille de recherche de l'herbier se refait en 10 à 34 ms (Node). Envoi au GPU, faune et
  rétroviseurs restent à faire.
- Clé : version du jeu, circuit, palier, saison et options qui changent la géométrie (arbres, écologie, comme la clé actuelle de l'herbier). Le stockage est
  « au mieux » et peut être évincé (MDN, Storage quotas and eviction criteria) : la régénération reste le repli.
- Worker pendant le chargement : nappes identiques au bit et objets identiques sur l'échantillon comparé, mais le graphe d'objets renvoyé coûte 227 à 309 ms
  de désérialisation sur le fil principal (Haut-Col) ; à plat, 6 à 11 ms plus 93 à 128 ms d'analyse JSON (aucune image perdue à Cap-Séquoia). Calcul dans le
  Worker plus lent (1,1 à 5,7 s), sans rien figer.

## 7. WebGPU

**La machine.** Chrome 157 sans interface, sans drapeau : `navigator.gpu` présent, adaptateur apple / metal-3 (pas de repli logiciel), 25 fonctions dont
shader-f16, subgroups, timestamp-query, textures BC, ASTC et ETC2 ; tampon maximal 4 Gio, texture 16 384 ; mode de compatibilité disponible ; création d'un
pipeline de calcul en 2 à 135 ms.

**Essai court** (`scenario-webgpu.js`, particules : vitesse, gravité, vent, rebond ; 3 essais) :

| Particules | JS (Float32Array) par pas | WebGPU : envoi (processeur) | WebGPU : exécution |
|---|---|---|---|
| 4 096 | 0,039 ms | 0,006 ms | 0,013 ms |
| 65 536 | 0,52 ms | 0,006 ms | 0,027 ms |
| 1 048 576 | 11,3 ms | 0,005 ms | 0,99 ms |

Le jeu compte aujourd'hui quelques centaines de particules (banc : 268 à 427 bandes, 160 embruns, 2 à 29 fumées) : moins de 0,04 ms par pas en JS. Le calcul
GPU ne servirait qu'à des effets neufs, massifs.

**Dans FERRO** (lecture seule) : un moteur WebGPU complet à part, `webgpu-renderer.js` (333 lignes denses), `webgpu-shaders.js` (481 Ko de WGSL produit par
Naga depuis les GLSL), `crowd-webgpu.js`, `gpu-profile.js`, et `backends.js` qui choisit WebGPU ou WebGL2 avec repli (délai de 30 s, perte d'appareil gérée).
Il dessine monde, nappes, lots proches et lointains, ombres, reflets d'écran, halo, couvert d'herbe, foule, avec préchauffage. **BITUME n'en embarque rien** :
seul le moteur WebGL2 (METAL 0.6, `src/moteur/renderer.js`), créé par `FRender.create` (jeu.js 2704) ; tout autre moteur est refusé (jeu.js 2712).

Écarts relevés en lisant : sondes locales, ciel avancé et surface native absents côté WebGPU (backends.js 61) ; création asynchrone là où BITUME l'attend
synchrone ; rétroviseurs faits d'un second moteur sur une seconde toile (jeu.js 1552), alors qu'un appareil WebGPU peut servir deux toiles et partager ses
tampons ; chronomètre `profile` absent (appels gardés dans BITUME) ; retouches de Point de rupture et du lot 5B absentes du moteur WebGPU. **Chantier :
moyen** : le moteur existe et couvre les passes principales, mais il faut l'embarquer, rendre le démarrage asynchrone, porter rétroviseurs et retouches, tout
vérifier sur deux moteurs. Gain sur la scène de BITUME : **non mesuré** ; le seul poste où WebGPU pourrait payer est le coût processeur du rendu (13,6 à
16,5 ms par image à ×4). Un banc public cité par la recherche montre que l'instanciation pèse plus que l'API
(https://github.com/mvaligursky/webgpu-webgl-benchmarks) ; BITUME instancie déjà (434 appels, 4 134 instances à Val-Brûlé). Couverture WebGPU 84 à 89 % selon
la source (https://caniuse.com/webgpu, https://web3dsurvey.com/webgpu ; Linux 19 %) : le repli WebGL2 reste indispensable.

## 8. Portage natif (macOS, Linux, Windows, Xbox, PS5)

Une version native pourrait encore gagner, mais **aucune mesure publiée ne chiffre ce gain pour un jeu de ce genre** (deux recherches). Elle apporterait :
- pas d'aller-retour vers le processus GPU : Chromium sérialise chaque appel WebGPU (Dawn Wire) et le rejoue dans un autre processus, surcoût jamais chiffré
  (https://chromium.googlesource.com/chromium/src.git/+show/fafff21/docs/security/research/graphics/webgpu_technical_report.md) ;
- de vrais fils, et des caches de pipelines sur disque (https://docs.vulkan.org/samples/latest/samples/performance/pipeline_cache/README.html ; wgpu
  PipelineCache, limité à Vulkan d'après https://wgpu.rs/doc/wgpu/struct.PipelineCache.html) ;
- des sur-échantillonneurs : FSR sous licence MIT pour DirectX 12 et Vulkan (https://gpuopen.com/manuals/fsr_sdk/getting-started/), MetalFX
  (https://developer.apple.com/videos/play/wwdc2025/211/) ; XeSS 3 en binaires Windows sous licence Intel
  (https://www.techpowerup.com/347202/intel-releases-official-xess-3-0-software-development-kit).

Les voies, de la moins chère à la plus chère :
- **Bureau par emballage** (Electron, Tauri, NW.js) : distribution sur Steam, pas de vitesse (même moteur de navigateur). Tauri change de moteur selon le
  système, WebView2, WKWebView ou WebKitGTK (https://v2.tauri.app/reference/webview-versions/), avec des pièges graphiques sous Linux
  (https://v2.tauri.app/develop/debug/linux-graphics/). Steam Direct : 100 $ par jeu, rendus après 1 000 $ de revenu
  (https://partner.steamgames.com/steamdirect).
- **WebGPU natif** (wgpu ou Dawn) avec les WGSL du moteur WebGPU de FERRO : le paquet Dawn pour Node n'a pas de fenêtre
  (https://github.com/dawn-gpu/node-webgpu), Deno en a une derrière un drapeau instable (https://docs.deno.com/runtime/desktop/webgpu/). La logique en JS
  demande un moteur JS natif ou une réécriture.
- **Consoles.** Xbox : WebView2 pour les applis Xbox (https://blogs.windows.com/msedgedev/2023/11/01/webview2-for-xbox-announcement/) ; ID@Xbox sans frais
  d'inscription, kits par l'Entertainment Developer Store (https://learn.microsoft.com/en-us/gaming/game-publishing/onboarding/overview). PS5 : kits prêtés si
  le concept est accepté (https://sonyinteractive.com/en/news/blog/complimentary-development-hardware/), aucune voie web trouvée. Les jeux JavaScript arrivés
  sur console ont été compilés ou réécrits : CrossCode, JavaScript compilé en C++
  (https://www.siliconera.com/crosscode-interview-radical-fish-games-on-console-ports-and-whats-next/) ; Vampire Survivors, nouveau moteur
  (https://news.xbox.com/en-us/2023/04/13/vampire-survivors-dlc-2-launch/).

Ce qui garde la porte ouverte dès aujourd'hui : des **données à plat** en tableaux typés (la même exigence sert le Worker, le cache, Wasm et le natif) ; des
**noyaux en C portable** (`herbier.c` compile en wasm32 et en arm64) ; le rendu par l'API WebGPU de FERRO le jour venu, la même en natif ; des modules de
génération et de simulation sans DOM (ils tournent déjà dans Node, les bancs le montrent).

## 9. Plan proposé, par gain mesuré rapporté au coût

| Sous-lot | Quoi | Gain (mesuré, ou déduit quand c'est dit) | Coût |
|---|---|---|---|
| **28A** | Herbier en JavaScript resserré (prototype prêt, identique au bit) | ×2,55 à ×2,85 sur l'herbier ; ≈ 0,8 s figée de moins à Haut-Col ×1, ≈ 2,2 s ×4 (déduit) | petit |
| **28B** | Créer les six circuits du menu au chargement, ou un par image | 258 ms ×1, 868 ms ×4 à la 1re préparation | très petit |
| **28C** | Un herbier par saison, ou couleur séparée de la géométrie | supprime 1,25 s ×1 et 4,27 s ×4 à chaque changement de saison | petit |
| **28D** | Construire hors du clic, sous le voile de chargement du lot 5B, par tranches | 0,3 à 2,5 s d'image figée deviennent une attente affichée | petit à moyen, après 5B |
| **28E** | Cache binaire du niveau dans IndexedDB, clé version + circuit + réglages, régénération en repli | 1 641 → 36 ms à Haut-Col, aucune image perdue, dès la 2e visite d'une version | moyen |
| **28F** | Herbier en WebAssembly (noyau écrit) | ×1,66 à ×1,85 de plus que 28A ; +8 Ko en base64 | petit, plus clang à la construction |
| **28G** | Construction dans un Worker, résultat à plat | 1re visite sans image perdue à Cap-Séquoia ; 100–133 ms restent à Haut-Col (JSON) | moyen |
| **28H** | Banc de la scène BITUME sur le moteur WebGPU de FERRO, puis décision | non mesuré ; vise le rendu à ×4 | moyen (banc), moyen à gros (bascule) |

Ordre conseillé : 28A, 28B, 28C, puis 28D et 28E ; 28F et 28G seulement si l'herbier ou la première visite restent au-dessus du seuil ; 28H en dernier. Les
rétroviseurs créés au chargement relèvent du lot 5B.

**À ne pas faire**, mesures à l'appui : SIMD (aucun gain) ; particules en calcul GPU (moins de 0,04 ms par pas aujourd'hui) ; réécriture complète en C ; OPFS
en `file://` (refusé) ; Worker ou cache qui transportent le graphe d'objets (200 à 450 ms de désérialisation qui figent l'image) ; précharger les sept niveaux
(10,6 s de processeur, +440 Mo de tas).

## 10. Questions pour David

1. On commence par 28A, 28B et 28C (petits, mesurés), avant le cache 28E ? *Par défaut : oui.*
2. Le cache du niveau est-il effacé à chaque nouvelle version du jeu ? *Par défaut : oui.*
3. WebAssembly pour l'herbier seulement s'il dépasse encore 100 ms ×1 après 28A ? *Par défaut : oui.*
4. WebGPU : un banc séparé d'abord, le jeu restant en WebGL2 tant que le gain n'est pas mesuré ? *Par défaut : oui.*
5. Portage natif : rien maintenant, mais données à plat et noyaux en C portable dès qu'on y touche ? *Par défaut : oui.*
6. Un monde identique au bit entre navigateurs est-il requis ? *Par défaut : non, tant que le jeu en ligne reste en état synchronisé.*

## 28E — premier raccord en jeu, panorama de Larche (22 novembre 2026)

La préparation des menus lance la lecture IndexedDB pendant le voile. Si le bloc est prêt quand la construction du terrain atteint la couronne visuelle, le jeu réutilise ses sommets et ses indices. Au premier passage, en cas de corruption ou si le navigateur tarde, le générateur reprend la main immédiatement. L’écriture est proposée au repos après la première image. Une préparation annulée abandonne sa copie. La clé inclut le circuit, sa graine, le palier du décor, l’enrichissement, les matières, la végétation, la saison et la version affichée du jeu.

Sur Chrome WebGL2 / ANGLE Metal, Apple M5, en fichier local à 960 × 540, le premier calcul a pris **156,9 ms**. Après rechargement complet de la page, la lecture et le décodage ont pris **18,7 ms** et le générateur n’a reçu aucun appel. La préparation du décor complet a pris respectivement **1 702,7 et 1 548,5 ms** sur cette paire. Son temps inclut la construction du corridor proche et l’envoi au moteur. Les deux états du terrain rendent 396 nappes identiques, avec un bloc de 2 109 188 octets.

Le banc compare cinq ouvertures dans un profil Chrome jetable. Une entrée altérée est remplacée. Le refus du stockage et une lecture suspendue indéfiniment aboutissent également à l’écran de course. L’empreinte des octets de sommets et d’indices vaut 283003719 dans les cinq cas. La portée de ce premier raccord est le panorama visuel. Le cache des autres décors, de l’herbier binaire et des données de niveau reste ouvert.

```sh
python3 construire.py
node tools/banc-navigateur.mjs --url "file://$PWD/dist/bitume.html" --mode cache-panorama --taille 960,540 --attendre 90000 --angle native
node --test verifications/cache-panorama.test.mjs verifications/relief-vallee.test.mjs verifications/backlog-0286.test.mjs
```
