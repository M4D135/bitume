# BITUME — reprise courte

## 0.2.86 livré (22 novembre 2026) — Cockpit & 3D voiture, Menus sans défilement, Route-des-Cimes corrigé, Envol pneu Vroom, Col de Larche → Vinadio jouable & 16 circuits

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
