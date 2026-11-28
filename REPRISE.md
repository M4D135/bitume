# BITUME — reprise courte

<!-- bitume-reprise-actuelle-debut -->
## Par où reprendre

**28 novembre (fin de matinée) — relève du 28/11 faite, sauf le titre. Poussé sur `origin/main`, non déployé : 0.2.350.**
- **En production** : toujours **0.2.345** (`d82f5e1`). Déployer (`./deposer.sh`) seulement sur le GO de David.
- **Chantier 2, Route sans fin sans gel (0.2.347)** : l'ouvrier prépare le décor et PhysX hors du fil principal, en HTTP
  comme en `file://`, et le repli sans ouvrier découpe le travail en tranches. Il reste une image de 33 ms à chaque
  bascule de fenêtre : passer sous 25 ms demande un double tampon des lots et des nappes dans FERRO (module canonique).
- **Chantier 3, changer de circuit depuis l'aperçu du menu Préparation (0.2.348).**
- **Chantier 4, pistes fluides et sauts (0.2.349, 0.2.350)** : Larche sans marches ni contre-dévers, courbure verticale
  bornée sur tous les circuits (crêtes à 0,4 g, creux à 0,8 g à la vitesse de l'IA), sauts voulus annoncés par panneaux
  sur six circuits et sur la Route sans fin, enrobé des Alizés sans pli diagonal (10,6 cm auparavant, 1 cm au plus).
  La physique passe en p56 : records et fantômes repartent à zéro. Aux Lacets de l'Aiglière, le saut est sur la
  descente finale et non sur le Mur (30 % de pente, épingles juste après).
- **Qualification du 28/11** : suite complète, 47 échecs sur 256, les mêmes qu'en 0.2.349 (même contrôle, même message).
  Chrome Mac (Apple Metal-3, WebGPU, 1280×720, high) : 60 images/s sur les neuf circuits en passant un saut ; Route sans
  fin sur 6 km, p99 16,8 ms (une image de 33 ms par bascule, comme avant) ; saut de la Route sans fin passé dans le jeu
  (286 km/h, 0,68 s en l'air, sans incident). Une image isolée de 117 ms à une bascule au premier passage, non reproduite
  en quatre passages sur la même route (graine 19692). Piège : `tools/banc-navigateur.mjs` rend en SwiftShader par
  défaut ; passer `--angle native` (et `--attendre 330000` en `--mode sans-fin`), sinon les chiffres ne valent rien.
- **Modèle 205 GTI** : posé par ChatGPT dans `modeles/peugeot-205-gti` (644824b, galbes et proportions affinés), pas encore
  intégré au jeu.
- **En attente de David** : le titre (TRAJECTOIRE, CONTRE-BRAQUAGE, TALON-POINTE, POINT DE CORDE, LACETS, GOMME,
  RUPTEUR, TOUR LANCÉ ; voir `AGENTS.md`), la confirmation de la « Renalt 5 GT 3 » (R5 GT Turbo ?), et le GO de
  déploiement.

**28 novembre (07:52), exécuté depuis, sauf le titre — PROMPT DE RELÈVE PRIORITAIRE : [`docs/reprise/PROMPT-RELEVE-2026-11-28.md`](docs/reprise/PROMPT-RELEVE-2026-11-28.md).**
- **En production (`https://bitume.estrasse.fr/`)** : **0.2.345** (`d82f5e1`, `FERRO 0.3.36` `20ef396`, sha256 `7a0e897ed944ea15`, salon actif) — gants FIA photoréalistes procéduraux, biomécanique mains/poignets (`prisePommeau`, `0,00 o/appel`), Nomex mat sous la pluie, et correctifs complets des caméras démo/vitrine.
- **Poussé sur GitHub (`origin/main`, non déployé) : 0.2.346** — ajout de `src/route-sans-fin-flux.js` (Web Worker + cuisson PhysX par micro-tranches `< 1,5 ms`/image + fusion des bascules station/fenêtre + `traces.changerMonde` + `herbeGPU.changerDecor`, 7/7 suites `route-sans-fin*` vertes, bascule GPU tombée à `4,3 ms`).
- **À exécuter immédiatement par la relève** (tout le diagnostic ligne par ligne est dans [`PROMPT-RELEVE-2026-11-28.md`](docs/reprise/PROMPT-RELEVE-2026-11-28.md)) :
  1. Vérifier le Worker `Route sans fin` en HTTP/WebGPU (`maxFrameMs < 25 ms` aux checkpoints) ;
  2. **Fluidifier les tracés F1 (Ring 40°, Montagnes Larche & Route-des-Cimes, circuits raccordés)** : supprimer les marches DEM de 10 cm et le contre-dévers inversé de `larche-vinadio.js`, passer les jonctions de pente de `route-des-cimes.js` en quintique C2 sans zéros, subdiviser transversalement la chaussée vrillée du Ring 40°, et **ajouter des crêtes de saut F1 fun et sécurisées (*Flugplatz*)** sur les portions droites rapides ;
  3. **Menu Préparation — changer de circuit directement depuis l'aperçu circuit** (`.apercu-circuit` / `#p-trace-3d` dans `src/index.html` & `src/menu-arcade.js` : boutons `‹`/`›` sur l'aperçu, molette/swipe sur `#p-trace-3d`, flèches/manette et synchro grille `#circuits`) ;
  4. **Trouver un nouveau titre plus orienté F1** (« BITUME » jugé bof par David : proposer des titres originaux typés F1 / Grand Prix / monoplace et appliquer le choix de David sur l'UI/marque sans casser `localStorage` `bitume.*`, `globalThis.BITUME` ni le déploiement).

**0.2.343 — [Décor cinéma, enveloppe 3D constante, caméras basses et neige 3D ~50 cm](docs/reprise/rapports/ENVELOPPE-CINEMA-0343-MAC.json) · remplacé en prod par `0.2.345` (`d82f5e1`).** Sur Chrome Mac Metal-3 WebGPU en 1080p Fine sous la pluie avec 12 voitures et les deux rétroviseurs vifs, les **neuf circuits** tiennent **59,97 à 60,17 dessins/s (60 FPS)**, `p95` 17,2–17,7 ms, `pire` 17,5–19,2 ms et **`midRaceCreations = 0`** partout ; l'enveloppe géométrique reste bornée entre **0,94 M et 1,51 M triangles** (`514–780` appels) quelle que soit la scène (contre 6–21,2 M auparavant). En Retina `2880×1800` Ultra MSAA 4× (`50 176` brins GPU), Forêts du Pacifique tient **59,97–59,99 FPS** et Larche km 18 sous pluie cockpit **30,0–57,5 FPS** constants (contre 11–21 FPS). Le décor ne génère plus que le couloir visible autour de la piste (`decorCinema: true`, talus d'horizon naturel, suppression du panorama 35 km et de la grille urbaine lointaine), toutes les caméras — démo et vitrine comprises — restent près du bitume (`≤ +4,4 m`, zéro survol aérien), l'hiver sculpte de vraies congères 3D continues de **48 à 95 cm** en rive d'asphalte déneigé (`congere-pied`, `congere-talus`, `congere-crete`, herbe ensevelie), et `src/voiture.js` retrouve **0,01 o/appel** en régime permanent (`voiture-permanents` 12/12). Déployé et vérifié le 26/11 à 22:53 (`./deposer.sh`, HTTP/2 200, `/salon/sante` actif).

**0.2.342 — Consolidation VRAM (`midRaceCreations = 0`) et prairie WebGPU dense à budget borné.** Regroupement spatial des lots `TAPIS_DENSE` et Pietraporzio, préchauffage intégral des lots VRAM sous le voile + rafraîchissement tournant sans allocation (`evictIdleLots` neutralisé en course), herbe WebGPU 4 triangles/brin à sous-cellules stratifiées ×4 avec tonemap Reinhard + gamma + vignettage alignés sur FERRO (`prairieCombineeUltra` en Ultra, exclue des rétroviseurs).

**0.2.341 — [Route des Cimes : tapis de prairie](docs/reprise/rapports/CIMES-0341-MAC.json).** Sans retirer la végétation, les glaces ni les ombres, la même portion passe de 54,11 à 60 dessins/s, p95 de 33,3 à 16,7 ms. Les maillages suivent mieux la densité de chaque surface et le tapis de fond s'allège en fondu là où les brins animés assurent le détail. Le contrôle Ultra de l'appui côtier reste ouvert : écart de 3,25 cm reproduit sur la base .340. Aucune qualification complète du catalogue par cette portion.

**0.2.340 — [Cadence sur les neuf circuits](docs/reprise/rapports/COURSE-0340-MAC.json).** Six portions à 60 dessins/s ; Sierra 59,50, Larche 57,25 et Route des Cimes 54,31. Chrome Mac 1080p Fine sous la pluie, 20 s par portion, compte du dessin principal après chauffe. Aucune erreur signalée. Poursuivre en priorité le coût du décor des Cimes, puis les sorties de stands.

**0.2.339 — Corridor de plantation de Larche.** La préparation de l'herbier ne lit plus que 204 322 triangles sur 290 822. Le relief et les masques de couleur restent identiques jusqu'à l'horizon. [Comparaison Chrome](docs/reprise/rapports/CORRIDOR-LARCHE-0339.json). En .338, [descente complète en mode Écran](docs/reprise/rapports/ENDURANCE-LARCHE-0338-ECRAN.json.gz) : 55,81 dessins/s sur 32,249 km ; 60/s sur les trois derniers kilomètres entiers mais 47,36/s sur le 18e. Une pointe de 500,1 ms au km 9,422 ne s'est pas reproduite lors des deux passages courts.

**0.2.338 — Terrain partagé avec les glaces.** FERRO 0.3.34 évite une seconde allocation de 13 418 752 octets à Larche sur le GPU du Mac. [Mesure WebGPU et changements de circuit](docs/reprise/rapports/TERRAIN-GLACES-0338.json). **Endurance .337 terminée** sous la pluie : 32,249 km, 41 124 dessins en 892,781 s (46,06/s ; p95 33,4 ms). [Rapport complet par kilomètre](docs/reprise/rapports/ENDURANCE-LARCHE-0337.json.gz). Le mode Écran est à comparer avec le mode par défaut. La production reste en .334.

**0.2.337 — Cadence à Pietraporzio.** Les 2,23 s incluaient la préparation synchrone du circuit. Le banc corrigé mesure 2 380,8 ms de préparation, puis p95 33,3 ms et pire 33,4 ms pendant 20,03 s en course sur le Mac. [Détail et reproduction](docs/reprise/rapports/COURSE-0336-MAC.md#chronom%C3%A9trage-corrig%C3%A9-en-02337).

**26 novembre — 0.2.336.** Relief ordinaire réutilisé depuis IndexedDB ; records de `finTour` relus en p55, archives préservées. [Preuves et limites](docs/reprise/rapports/COURSE-0336-MAC.md). L’endurance .335 s’est interrompue au km 15,395. Le second passage court à Pietraporzio reproduit une pause supérieure à deux secondes ; la réception 60 images 3D/s reste ouverte.

**26 novembre — 0.2.335, chantier « uniquement ce qui sert à la course ».** Grille, accidents et arrivée filmés depuis la piste ; le jeu ne prépare plus les trajectoires panoramiques. Prairie sélectionnée par tuiles occupées dans le champ de chaque joueur ; les reliefs ordinaires au-delà du corridor de 420 m ne produisent plus de surfaces à planter. Cache IndexedDB : éviction atomique et purge par préfixe sans recopier les blocs. **Production vérifiée : 0.2.334 (`93d64ac`)**. [Matrice 9 circuits, mesures et empreintes](docs/reprise/rapports/COURSE-0335-MAC.json) · [File de continuation et critères](docs/reprise/CONTINUATION-2026-11-26.md).

**25 novembre — BITUME 0.2.334, base 0.2.333 `66e5cde`.** La prairie WebGPU proche (`src/herbe-gpu.js`) est intégrée aux vues des pilotes ; les rétroviseurs gardent arbres et bâtiments mais excluent tapis et végétation basse. [Capture Ultra au ras du sol](docs/reprise/rapports/prairie-gpu-0334.jpg). Banc cockpit Fine sur Mac Metal-3, Longues Ombres en été, 1440 × 900 : 1 201 images en 20,02 s, p95 16,7 ms, pire 16,8 ms. Reproduction : `tools/banc-navigateur.mjs --mode prairie` pour le gros plan, `--mode banc --qualite high --duree 20` pour la cadence, avec `--angle native --taille 1440,900 --url file:///…/dist/bitume.html`. Ce lot ne déploie pas le site. L'état du 24 novembre ci-dessous reste historique.

**Consignes canoniques de la mission (reprise 24 novembre) :** `docs/reprise/MASTER-PROMPT-BITUME.md` — à relire en entier après toute réduction de contexte, avec son **Tableau de suivi** des douze lots A–L. Ne pas redemander les définitions des lots C/D/G/H/I/L : elles sont dans ce fichier.

**Site servi, BITUME 0.2.299** (`e2dab57`, sha256 servi `ee016800…`, identique au `dist/bitume.html` commité — **non déployé** vers `0.2.316` sans feu vert explicite de David). Incident du 23/11 22:00 GMT corrigé le 24/11 : `current` pointait sur l'ancien commit `ac6a74a4` (V0.2.90) ; rollback atomique documenté vers `releases/e2dab57…`. Salon `/salon/sante` HTTP 200.

**Branche `main` poussée sur `origin/main` (24/11 soir), BITUME 0.2.316, physique p55, FERRO 0.3.33 (35 modules vérifiés, `src/ferro/*` intact)** — build `dist/bitume.html` sha256 `90a4df54cd9c063c…`, dernier commit code `ae7b5f6` (+ suivi documentaire). Réception complète en **Chrome Mac Metal-3 WebGPU** (`1440×900`, `high`, MSAA 4×, ombres 2048 px, 2 rétroviseurs, bloom) : **60,0 FPS verrouillés (`p50 = 16,7 ms`, `p95 = 16,7 ms`, `pire = 16,8 ms`, 0 erreur JS/WebGPU)**.
- **Lots qualifiés et livrés sur Mac** :
  - **A (Route des Cimes)** (`ce1f023`, `5ce9b3d`) : qualifié en Metal-3 WebGPU, crêtes alpines ciselées + roche stratifiée (recette 23), rochers de crête et chalets ancrés au sol (`appui-objets-cimes` 3/3).
  - **B (Alizés 40°)** (`d43c064`, `ce1f023`) : `poseDepart` `sin→tan`, rampe quintique C2 112 m, dégagement extérieur, garde châssis 0,15 m ; **0 tonneau / 0 replacement** sur 60 s solo & 12 voitures PhysX + WebGPU (`devers-alizes` 6/6).
  - **C (Split-screen 3–4J)** & **D (Minimap zoomée défilante)** (`05fcf96`, `fb7b602`, `eeeed2e`, `ce1f023`) : grille 2×2 J1–J4, case carte 4e quadrant à 3J (`#case-circuit` centré), verre HUD J3/J4, qualifiés Mac WebGPU (4J ~33 FPS en `high` MSAA 4×).
  - **G (Photoréalisme)** & **H (Végétation dense ×100 à 60 FPS)** (`5ce9b3d`) : `PALETTES_PHOTO` en linéaire, atmosphères contrastées ~7:1, bitume sombre réaliste, été verdoyant, `mat: 23/25.125/27`, bosquets multi-étages organiques, `PALIERS_DENSE`/`TAPIS_DENSE`, 3,3–4,75 M triangles & 6 900–10 500 instances tenus à **60,0 FPS**.
  - **I (Route sans fin 1–4J)** (`f06b0bd..1efef8d`, `ce1f023`) : cap Hermite borné `|cap| ≤ 65°` (0 auto-intersection sur 20 graines × 18 km), portiques Checkpoint 3D, continuité PhysX `reinstallerSansFin` + rétros couleur + `S.fx`, résultats distance + record local, multi 1–4J ; validé sur 11,06 km en Mac Metal-3 WebGPU.
  - **J (Aériens & démos)** (`d63c523..e44d90a`, `c03cb64`) : anticipation relief/obstacles `plancherAnticipe` (~3 s / 180 m, autorité verticale dédiée, `aeriens-anticipation` 3/3), cadrages démos abaissés/resserrés sur la piste, caméra arrière rehaussée.
  - **K (Recul→avant)** (`757ab11`) & **E (Descente des Freins Chauds)** (`183597d`) préservés (`recul-physx`, `reprise-recul` 21/21).
  - **L (Cohérence menus/multi)** (`ae7b5f6`) : préparation Route sans fin en 3 étapes sans onglet Circuit (`01/03..03/03`, retour direct titre, bandeau et record Route sans fin), titres `Course à trois/quatre`, résumé manettes/clavier 1..4J, pneus/Troll J2 préservés au-delà de 2J, bilan J1..J4, assignation manette 1..4 en réglages.
  - **Tests rouges réels corrigés (`c03cb64`)** : `russie.test.mjs` neige (3 courses 12 voitures sec/pluie/neige 100 % verts, 0 replacement) et `physx-circuits.test.mjs` Baïkal (19/19 verts après diagnostic physique `lancerSurSol`).
- **Reste / arbitrages David** : (1) **Déploiement `bitume.estrasse.fr`** (encore en `0.2.299`, incluant config proxys `BITUME_VISITES_PROXIES` du lot **F**), (2) **Inflation `PHYSIQUE` p17→p55** (épinglée dans `russie`/`records-physique`), (3) **Catalogue 9 vs 11 circuits** (`menu-arcade`/`cinema`), (4) essai manettes physiques 3–4J + touches J3/J4 + éventuelle option « plan complet » minimap (lot D).

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
