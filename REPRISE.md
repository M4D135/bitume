# BITUME — reprise courte

<!-- bitume-reprise-actuelle-debut -->
## Par où reprendre

**Version en ligne du 23 novembre, BITUME 0.2.289.** Au premier lancement de chaque version, le jeu mesure la machine et choisit un des quatre profils graphiques. Les réglages personnalisés sont conservés. En démo, le compteur affiche la cadence et le maximum de la séance. Les quatre contrôles sur le site concordent avec un comptage indépendant des images. [Mesures du mini-banc et des FPS](docs/reprise/rapports/PROFIL-FPS-2026-11-23.json)

**Candidate locale de nuit, BITUME 0.2.290, physique p54.** Elle reprend le test graphique et le maximum de FPS en démo sur la .288. La pluie, la vitre et le public conservent leurs variantes de nuit. [Réception locale et empreintes des deux versions](docs/reprise/rapports/NUIT-PROFIL-0290-2026-11-23.json).

**Version publique précédente, BITUME 0.2.287.** Les neuf tracés portent des noms de course ou de lieux-dits. Le menu, les chronos déjà enregistrés et la piste au départ affichent le même nom. Les neuf départs ont été contrôlés sur le site public. [Catalogue et réception en course](docs/reprise/rapports/CATALOGUE-2026-11-23.json)

**Candidate locale précédente, BITUME 0.2.288, physique p54.** Elle reprend les neuf noms de la .287 sur la candidate .286, avec les mêmes identifiants de piste et les classements de la branche de nuit. [Réception du catalogue et empreintes des deux versions](docs/reprise/rapports/NUIT-NOMS-0288-2026-11-23.json).

**Version publique précédente, BITUME 0.2.285 et FERRO 0.3.31.** La 3D utilise WebGPU. Le bord inférieur du saute-vent rejoint la carrosserie sur toute sa longueur. La vitre reflète le ciel et le soleil selon l’angle de vue. En qualité Fine, les gouttes déforment la piste visible à travers le verre. Les neuf circuits ont démarré sous la pluie, dont trois depuis le site public. Sur Mac M5, le passage de 16 secondes à Pietraporzio donne 60,00 images 3D/s en 1080p Fine avec les deux rétroviseurs, et 17,6 ms au 95ᵉ percentile. [Contrôles du verre, des circuits et de la cadence](docs/reprise/rapports/WEBGPU-2026-11-23.json)

**Candidate locale précédente, BITUME 0.2.286, physique p54.** Sur `nuit/2026-11-22`, FERRO 0.3.31 dessine les traits de pluie avec l’atténuation des bords de toit calculée par la simulation de nuit. Le fondu des dépôts sous abri et la fusion des microgouttes sont conservés. Une course sur Larche sous forte pluie a avancé avec douze voitures et les deux rétroviseurs sur Metal. Les deux contrôles encore rouges se reproduisent déjà sur la .284 locale. [Réception locale et empreinte du build](docs/reprise/rapports/NUIT-WEBGPU-2026-11-23.json).

**Version précédente 0.2.283, FERRO 0.3.27.** Le shader de hauteur compile dans Chrome et les fenêtres WebKit embarquées utilisent la préférence graphique déjà appliquée dans Safari. La course démarre après un chargement neuf et après rechargement. Les neuf circuits ont été pilotés sous la pluie sur le fichier publié, dont trois depuis le site. À Pietraporzio, le contrôle couvre le cockpit en Fine, en 1 920 × 1 080, avec les deux rétroviseurs. [Détail des contrôles et limites](docs/reprise/rapports/DEMARRAGE-2026-11-23.json)

La décision du 22 novembre au soir donne le même objectif aux neuf circuits et à chaque configuration prise en charge. La [feuille de route de nuit](docs/reprise/NUIT-2026-11-22-23.md) répartit les lots, la revue du code et les critères de réception.

**Version 0.2.131, FERRO 0.3.26, physique p19.** L’accueil affiche Solo, Multijoueur et Réglages. LT et RT changent de famille de circuits ou de page de réglages. Le neuvième parcours, Le Cocodrome, mesure 1 600 m et comporte quatre virages à 24 %, une voie des stands dans l’infield et des tribunes face à la plage. La physique, les reflets de la chaussée, les limites de visibilité du décor et le roulement sur sol mouillé ont évolué. La cadence matérielle de cette version reste à mesurer. [Sources de la .131](https://github.com/M4D135/bitume/commit/9703e711bf9f849fbd2c8d9fdc320f6e0177857d).

**Version précédente 0.2.130, FERRO 0.3.26, physique p18.** Le catalogue compte huit circuits, dont trois boucles à deux habitats. Les réceptions restantes concernent les démos, la visibilité des LED, les contacts, l’arrivée, le décor progressif sous la pluie à Pietraporzio et les nouvelles surfaces des huit circuits. Le relevé M5 .113 complet a donné 55,54 images 3D/s. Les interruptions ultérieures sont détaillées dans la feuille. La fiche des huit circuits donne la distance avant le départ. Dans la .125, les deux joueurs commencent avec le même profil. RT accélère, LT freine, le stick gauche dirige et LB fait dériver. A monte un rapport, X le descend, Y change la vue et B déclenche le geste. Select / View revient au menu précédent ou annule une affectation. Start / Menu met la course en pause. Le décor progressif et les sols à pigments interpolés emploient FERRO 0.3.26.

[Feuille de route des 47 demandes et suites actuelles](docs/reprise/FEUILLE-DE-ROUTE-2026-11-22.md) · [Sources du jeu](https://github.com/M4D135/bitume/commit/b15cd823af4e1f803fe4c1ac7f5af04882332cca)

La .130 corrige les trois cadrans du cockpit et conserve les tribunes situées en face des stands. Les chevrons marquent les portions serrées sur le bord extérieur du virage. La pluie projetée est visible avec la visière. La densité des petites gouttes de visière est multipliée par dix et les projections augmentent dans le sillage. La cadence de la .130 à chaud sous la pluie à Pietraporzio et sur les 32 km de Larche reste à mesurer en 1080p Fine. [Sources de la .130](https://github.com/M4D135/bitume/commit/b15cd823af4e1f803fe4c1ac7f5af04882332cca)

La .129 ancre l’arche de Sierra-Cuivrée et pose chaque éboulis sur le terrain. Quatre flèches de 60 cm occupent chaque rail de 8 m. La faune, les arbres et les ombres proches sont sélectionnés par groupes. La préparation des glaces suit les côtés à rafraîchir. La cadence de la .129 à chaud sous la pluie à Pietraporzio et sur les 32 km de Larche reste à mesurer en 1080p Fine. [Sources de la .129](https://github.com/M4D135/bitume/commit/a43ba6d387c4cac6ceead2d11dd6f744b4bf31cb)

La .128 ajoute la voie et le service aux stands, les gestes tirés des captures CMU, une flèche jaune de 0,60 m et les arches rocheuses mobiles PhysX. La foule, le décor, les lampes de tunnel et les ombres solaires évitent des calculs répétés. Les nouveaux temps et fantômes utilisent p18, et les enregistrements p17 sont conservés. La cadence de la .128 sous la pluie à Pietraporzio et sur chaque kilomètre de Larche reste à mesurer. [Sources de la .128](https://github.com/M4D135/bitume/commit/9651b7bb218ba55f97c6070a19c9e92c9c0d332e)

<!-- bitume-reprise-actuelle-fin -->

## Larche en 1080p et préparation du paysage, version 0.2.111

Sur Mac M5 en Fine, au virage du km 2,868, la paire en régime thermique nominal passe de 55,34 à 60,00 i/s sous la pluie. En régime thermique élevé, la même comparaison donne 45,65 et 48,33 i/s. La nouvelle version atteint 59,98 i/s en pluie 720p. À Pietraporzio à chaud en pluie 1080p, elle donne 39,18 i/s. La feuille de route conserve les durées des images et les conditions de chaque passage.

La visière sélectionne les gouttes qui touchent chaque partie de l’écran. La préparation des grandes prairies de Larche utilise WebAssembly en séance et gagne 218 ms en médiane à géométrie identique. Un pilote bloqué reçoit la commande disponible sur son périphérique. Les deux pilotes locaux reçoivent leurs propres avis d’accident. Le contrôle de course est passé au point de la capture initiale, à 29,4 km de l’arrivée.

[Feuille de route des 47 demandes](docs/reprise/FEUILLE-DE-ROUTE-2026-11-22.md) · [Dossier de réception](docs/reprise/rapports/LARCHE-RENDU-2026-11-22/RECEPTION.json) · [Capture de Larche](docs/reprise/rapports/LARCHE-RENDU-2026-11-22/Larche-cockpit-pluie-0111.png)

## Larche sous la pluie et état de course, version 0.2.110

Sur Mac M5 en cockpit 1 280 × 720, la visière réutilise directement l’image de FERRO. Les trois passages pluvieux de référence passent de 52,35 i/s en .108 à 59,98 i/s. En 1 920 × 1 080, le relevé initial donne 48,67 i/s sous la pluie. Les arbres et l’asphalte de Larche, les distances chronométrées, les sons de pneus et de glissières, la pause des deux pilotes, l’affichage du portique et le survol des obstacles ont reçu des essais distincts. La qualification GitHub de la .110 passe ses 227 suites Node et ses huit tests Python.

[Feuille de route des 47 demandes](docs/reprise/FEUILLE-DE-ROUTE-2026-11-22.md) · [Mesures, écoute et comparaisons en course](docs/reprise/rapports/LARCHE-RENDU-2026-11-22/RECEPTION-0110.json)

## Livraison intégrée du 22 novembre — 0.2.108

Le jeu web propose onze circuits sur FERRO 0.3.16 et le contrat de conduite p16. La pluie utilise une seule couche en conduite. La route de Larche a été parcourue intégralement en chrono et en course par le pilote automatique PhysX, y compris sous la pluie. Les chevrons à grille LED suivent les courbes et le HUD de course est plus discret. Les essais de vibrations différencient rapport, impact, vibreur, roulement et régime moteur. La réception tactile sur les trois familles de manettes reste ouverte.

La feuille de route réunit les 47 lots et les demandes du 22 novembre. Elle couvre aussi les crêtes topographiques de Larche, le cache du panorama, la faune, les mesures GPU et le portage C++. Une seule branche demeure sur GitHub, `main`.

[Feuille de route et travail restant](docs/reprise/FEUILLE-DE-ROUTE-2026-11-22.md) · [Données de réception](docs/reprise/rapports/INTEGRATION-2026-11-22/RECEPTION.json) · [Essais natifs sur Mac M5](docs/reprise/N0-MAC-2026-11-22.md)

## 0.2.91 — Pluie en conduite et chaussée de Larche

Sur Larche–Vinadio, à 29,4 km de l’arrivée, le terrain recouvrait les deux voies. Les mailles sont maintenant dégagées sous les triangles de chaussée et les vibreurs, dévers compris. Les appuis du décor suivent le terrain dessiné. Les 572 pénétrations relevées en 0.2.90 disparaissent sur les 82 040 points sondés de la spéciale. Le contrôle complémentaire de 50 962 triangles routiers donne une garde minimale mesurée de 13,5 cm.

En conduite, la lentille traite les impacts et leur déplacement avec le vent relatif. Les projections extérieures restent disponibles depuis les abris et les caméras TV ou quand les gouttes de lentille sont coupées. Vérifié dans Chrome WebGL2 en poursuite à 29,4 km de l’arrivée, à l’arrêt et en cockpit à 288 km/h. Les essais utilisent une horloge commandée.

## Décision du 22 novembre 2026 — C++ natif, macOS puis Linux puis Windows

[Plan de migration native](docs/reprise/PLAN-NATIF-CPP-MACOS-LINUX-WINDOWS-2026-11-22.md) : FERRO et BITUME en C++, première édition
macOS, puis Linux, puis Windows. Le lot demandé est **documentaire uniquement** :
ce cadrage précédait les premières sondes natives de la livraison ci-dessus. Le plan fixe les lots,
la fidélité à p15, les mesures matérielles et les critères de passage entre plateformes.
La réception matérielle N0 en cours est détaillée dans la fiche Mac M5. Le suivi web ci-dessous est conservé.

## 0.2.88 livré (22 novembre 2026) — Retours jeu réel, Faune proche & Démos refaites (16 circuits), Menu Arcade, Col de Larche fluide, Hélico TV bas & Arbres réalistes

Livraison complète construite avec délégation lourde sur le Spark local (`spark-local`), vérifiée en Node (21/21 suites vertes + simulation PhysX WASM 12 voitures sur Col de Larche) et par 12 captures réelles Chrome WebGL2 (`1280×720` et `1600×1000`, 0 erreur console, migration `0.2.85 → 0.2.88` validée) :

1. **Sols organiques sans motifs géométriques (`src/decor.js`, `src/larche-vinadio-decor.js`)** :
   - Unification du terrain organique en `mat = 25` (`recipe 5` de FERRO 0.3.15 gérant herbe, terre, roche et neige par pixel sans transition brutale `23 ↔ 25` ni bande métallique `24`), diagonales alternées `((i + j) & 1)` et variation chromatique organique à deux échelles ; `decor-identite.test.mjs` 100 % inchangé au bit près.
2. **Démos refaites + Faune proche intégrées (`src/cinema.js`, `src/realisateur.js`, `src/animaux.js`, `src/faune.js`, `src/jeu.js`, `src/destinations.js`, `src/larche-vinadio-decor.js`)** :
   - Branche qualifiée `codex/bitume-faune-demos-validation-20261121` intégrée proprement et étendue aux **16 circuits** (vrais marqueurs emblématiques pour Larche → Vinadio et les 6 nouvelles destinations ; 0 plan faune/flore en démo ; `cinema.test.mjs` 34/34 vert sur 16 circuits).
3. **Col de Larche → Vinadio : épingles corrigées, 0 blocage (`src/larche-vinadio.js`, `src/decor.js`)** :
   - Diffusion locale du cap `θ(s)` sur les épingles serrées (`R_geom >= 30,0 m`, espacement minimal entre branches passé de `16,3 m` à **`53,1 m`**, longueur exacte `32 816 m` conservée), suppression des piles de pneus empiétant sur les accotements étroits de col ouvert (`pneus < 7,2 m : 0`), simulation PhysX 12 voitures validée à travers toute la série d'épingles.
4. **Menu Préparation type Arcade plein écran 100 % manette (`src/style.css`, `src/index.html`, `src/navigation-menu.js`, `src/menu-arcade.js`, `src/jeu.js`)** :
   - Vitrine 3D héroïque en haut + grille Arcade pleine largeur **4×4 (16/16 circuits visibles sans scroll ni vide)** à `1280×720` (`pOverflow: 0`, `clOverflow: 0`) et `1600×1000`, navigation croix/stick 2D (`←/→` ±1, `↑/↓` ±4), `PRENDRE LE DÉPART` toujours visible, lancement direct par `START` ou `A` sur le circuit choisi.
5. **Panneaux LED modernes de virage à flèches défilantes (`src/signalisation-course.js`)** :
   - Remplacement des blocs jaunes clignotants par des panneaux LED noirs sur double poteau ancré au sol affichant 3 flèches chevron lumineuses (`> > >` / `< < <`) à défilement fluide dans le sens du virage, + bandeaux LED de portique.
6. **Hélicoptère TV réaliste volant bas + drones actifs dès `low` (`src/aeriens.js`, `src/jeu.js`)** :
   - Modèle 3D profilé style Airbus H135 / Bell 429 (fuselage aérodynamique, verrière panoramique fumée, capot biturbine profilé, poutre de queue effilée, dérive verticale en flèche, patins tubulaires, nacelle caméra TV, rotor principal 4 pales + anticouple sur axe exact) volant bas (`10–14 m`, 30 m devant le peloton) + drones de tournage actifs sur **tous les paliers (`low` inclus)**.
7. **Modèles d'arbres réalistes non cartoon (`src/botanique.js`)** :
   - Houppiers feuillus multi-anneaux organiques irréguliers, couronnes de pins parasols volumétriques bombées et ramures de conifères denses et retombantes (`botanique.test.mjs` 14/14, `arbres-lots.test.mjs` vert).
8. **Cockpit 70° par défaut sans arceau flottant (`src/voiture.js`, `src/jeu.js`)** :
   - Suppression du cadre de saute-vent noir détaché (`bulle-cadre`), migration automatique FOV → **70°** (`champRevu = 2`) et carte → **bas-gauche** (`cartePositionVersion = 3`).

## 0.2.86 / 0.2.87 livré (22 novembre 2026) — Cockpit & 3D voiture, Menus sans défilement, Route-des-Cimes corrigé, Envol pneu Vroom, Col de Larche → Vinadio jouable & 16 circuits

Livraison complète construite avec délégation lourde sur le Spark local (`spark-local`), vérifiée en Node + PhysX WASM + 15 captures réelles Chrome WebGL2 (`1280×720`) :

1. **Vue cockpit, rétroviseurs & modélisation 3D voiture (`src/voiture.js`, `src/jeu.js`)** :
   - Deux rétroviseurs 100 % visibles, centrés (`horizonFractionHauteur = 0,490`) et lisibles dès 70° de FOV (`RETRO` + `champCockpit` adapté).
   - Modélisation 3D très nettement enrichie (0 B/appel en régime permanent, 33/33 `voiture.test.mjs`, 12/12 `voiture-permanents.test.mjs`) : pontons sculptés coke-bottle, fond plat carbone, diffuseur arrière à 6 lames, feu pluie LED FIA lumineux, ailerons avant/arrière bi-plans à dérives carbone et pylônes, échappements titane affinés, étriers de frein rouges, jantes champagne + écrou central cuivre, cadre de saute-vent carbone, volant détaillé à boutons et bande jaune 12 h.
2. **Manette, menus sans défilement & carte aux 4 coins (`src/commandes-manette.js`, `src/style.css`, `src/index.html`, `src/jeu.js`)** :
   - Bouton **A Xbox / B Switch (`buttons[0]`) = Troll / Emotes** ; dérive conservée sur **X (`buttons[2]`)**, migration automatique `manettesVersion = 3`.
   - **Zéro défilement vertical (`overflow = 0 px`) à `1280×720`** sur les 4 onglets de `#reglages` (Image, Pilotage, Son, Commandes) et les 4 onglets de `#preparation` avec les 16 circuits en 2 colonnes compactes.
   - Carte du circuit en **bas à gauche par défaut** (`cartePosition: 'bas-gauche'`, migration v2), les **4 coins** sélectionnables dans Pilotage.
3. **Corrections Route-des-Cimes & reliefs montagne (`src/decor.js`, `src/route-des-cimes-decor.js`)** :
   - **Bug envol dans le Tunnel du Rocher corrigé** : subdivision fine des dalles `sol-tunnel` quand le dévers/cap/pente varie et à ±18 m des portails avec normale moyenne → marche PhysX max ramenée de **2,70 cm à 0,63 cm** (`couverts-joints-courbes` 8/8, `physx-circuits` 24/24).
   - **Murs verticaux cannelés de 300 m éliminés** : champ de distance continu au-delà du rayon local `230 m` d'`indexAxe` en mode organique et sur Route-des-Cimes (zéro saut `d: 230 → 1e4` / `yT → 0`), versant lissé dans Les Lacets, **Lac de l'Aiglière** et **Cascade de la Gorge** ajoutés ; `decor-identite` 9/9 inchangé au bit près.
4. **Envol pneu-contre-pneu façon Vroom / vroom-unreal (`src/physique.js`, `verifications/envol-pneu.test.mjs`)** :
   - Contact pneu contre pneu à haute vitesse déclenchant une impulsion verticale + tangage cabré (`+67,8°`, `2,83 m` à 195 km/h en PhysX WASM réel, cooldown `0,65 s`, zéro faux déclenchement à basse vitesse).
5. **Pluie extérieure vue des couverts (PR #43 intégrée, `src/meteo.js`, `src/jeu.js`)** :
   - `meteo`, `meteo-couverts-physx`, `meteo-couverts-traits`, `meteo-toile`, `vitre-meteo` 100 % verts, `m.pluieFixe` conservé.
6. **Col de Larche → Vinadio jouable (L3/L4/L5) + 6 nouvelles destinations (`16A–16F`) = 16 circuits** :
   - `src/larche-vinadio-data.js` (34 ko issus d'OSM SS21 + Piemonte DTM5m + IGN RGE Alti : 32,8 km, 6 tunnels/galeries, 16 ponts, 21 épingles, 8 villages, Lac de la Maddalena), `src/larche-vinadio.js`, `src/larche-vinadio-decor.js` (corridor terrain lissé anti-croisement, Fort Albertino, spectateurs ancrés au sol, validé PhysX WASM + WebGL2).
   - `src/destinations.js` : `Fjord-d'Argent`, `Crêtes-des-Carpates`, `Landes-d'Écosse`, `Sierra-Cuivrée`, `Baie-du-Corail`, `Col-des-Andes` (indices 10–15, 9 circuits historiques 0–8 inchangés).
7. **Modules complémentaires & vie de piste** :
   - `src/aeriens.js` (hélicoptère TV + 2 drones métal de tournage, visible en WebGL2, 0 objet en `low`), `src/signalisation-course.js` (chevrons LED virages + bandeau LED portique), `src/camera-transition.js` (transitions douces entre vues), `src/championnat.js`, `src/records.js` (branché en course avec migration `bitume.records.v2`), `src/cache.js`.

## Demandes ajoutées au suivi — à réaliser

[Faune proche et démos des circuits](docs/reprise/FAUNE-PROCHE-DEMOS-CIRCUITS-2026-11-21.md), demande de David du 21 novembre :
animaux près de la route, sans simulation détaillée hors champ ; nouvelles démos des
circuits centrées uniquement sur la route, le tracé et leur point d’intérêt (supprimer
les plans herbe/faune/flore). Lots F1/F2 et D1/D2 planifiés.

## Prochaines étapes (limites honnêtes)

- Lots F1/F2 (faune proche + sommeil hors champ) et D1/D2 (démos centrées route/circuit/point d’intérêt).
- Tests physiques sur Xbox Series / Edge, manette Switch, iPhone physique et multijoueur WAN (non testables depuis ce poste).
- Lots réels ultérieurs si souhaités : Monaco & Marseille (données géographiques réelles dédiées) et entrée UI dédiée au mode Championnat.
