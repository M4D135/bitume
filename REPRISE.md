# BITUME — reprise courte

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
