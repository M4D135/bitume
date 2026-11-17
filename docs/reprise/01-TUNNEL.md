# Lot 1 : tunnel et mesures de référence

Statut : **terminé le 17 novembre 2026**, commit `856dd363150892e74494f045aa8ca94c8e6bbc1d`, client **0.2.21**.
Rapport brut et journaux : `docs/reprise/rapports/LOT1-2026-11-17.md`. Lire `REPRISE.md` et la tête distante avant intervention.

## Objectif

Supprimer les apparitions/disparitions brutales des éclairages et reflets dans le tunnel de Haut-Col, sans cacher le problème en retirant tous les reflets. Installer les premières mesures pour distinguer amélioration visuelle et coût réel.

## Sources utiles

`src/jeu.js` : `dessinerVue`, sélection des lampes, `avecReflets`, `majGlaces`, qualité automatique et `BITUME_JEU.banc` ; `src/decor.js` : tunnel et lampes ; `src/circuit.js` : `dansTunnel`. Lire seulement les API utiles de `src/moteur/renderer.js`, `src/ferro/` et `FERRO.lock.json`, sans les modifier localement.

Observation de la base 0.2.19 : la sélection ne garde que huit lampes, triées à chaque vue par distance, avec un seuil à 70 m et une activation liée à l'abscisse de la voiture suivie. C'est une piste de diagnostic, pas une cause prouvée par une capture. Le rendu expose déjà `stats`, `profile` et `gl` : exploiter ces capacités avant d'inventer une seconde instrumentation.

## Sous-lots possibles

1A : mesures reproductibles avant modification, overlay désactivable (FPS, temps image, CPU, GPU si réellement disponible, draw calls, triangles, voitures actives), comptage clair des rétroviseurs et des deux vues.

1B : sélection stable des lampes et transitions continues par caméra ; vérifier bornes des reflets d'écran, ombres et adaptation de l'œil. Respecter les limites du moteur. Si une correction de shader est nécessaire, la faire dans FERRO source puis propager une version qualifiée.

Ne pas mélanger les états temporels des deux joueurs et des rétroviseurs. Éviter les nouvelles allocations dans les boucles chaudes. Ne pas transformer un temps CPU autour de `draw` en prétendu temps GPU.

## Acceptation

Même scène, graine, caméra, résolution, qualité et météo avant/après. Vérifier entrée, milieu et sortie à plusieurs vitesses, caméra avant/arrière, cockpit, poursuite, démo et écran partagé. Vérifier piste sèche du tunnel et pas de pluie sous la voûte. Documenter toute validation navigateur indisponible.

Tests ciblés : `tunnel.test.mjs`, `rendu-halo.test.mjs`, `decor-identite.test.mjs`, plus régressions pour les nouvelles transitions. Le changement intentionnel de géométrie ne doit pas être masqué par une nouvelle référence sans justification. Reconstruction et empreintes FERRO obligatoires.

## Livraison

Patch limité ; mesures brutes et environnement dans `docs/reprise/rapports/` ; état de l'overlay ; résultats visuels réels ou explicitement non mesurés. Pas d'objectif de FPS déclaré atteint sans mesures. Reporter la baseline utile au lot 5.

## Ce qui a été fait (17/11/2026)

**1A — mesures.** `src/mesures.js`, chargé avant `jeu.js`, volet activable par **F3** ou `BITUME_JEU.mesures = true` :
FPS, intervalle d'image (p50/p95/pire), CPU par section (simulation, rendu, effets, affichage, son), temps GPU, draw
calls et triangles **par vue** (principale, joueur 2, rétroviseurs), voitures actives, lampes retenues, ombres,
qualité et palier. Le temps GPU vient des seules requêtes asynchrones du moteur (`EXT_disjoint_timer_query_webgl2`,
module verrouillé `src/ferro/gpu-profile.js`, **chargé** dans `MODULES` — il ne l'était pas, `rendu.profile()` restait
donc nul). Sans extension, sans requête terminée ou sur mesure disjointe : **N/D**, jamais un temps CPU déguisé.
Aucune attente bloquante. `tools/banc-navigateur.mjs` pilote Chrome (CDP, sans dépendance), rend la page réelle,
compte les erreurs de console et tue tout son groupe de processus.

**1B — transitions.** Sélection des lampes devenue une rampe continue **par caméra** (portée 20 m au-delà des 18 m
réels du moteur, lissage 80 ms, sélection par contribution sans tri ni allocation, plafond de huit jamais atteint).
Le seuil d'extinction porte sur la cible et non sur la valeur lissée, sinon une lampe sous le seuil ne se rallume plus.
Œil et abri de la pluie testent la **position de la caméra** sur une polyligne de l'axe du tunnel, plus l'abscisse de
la voiture. Reflets d'écran : le moteur verrouillé ne les offre que tout ou rien, l'intensité n'est donc pas réglable
ici ; le franchissement du seuil si, avec deux seuils (0,20 / 0,12) et un état mémorisé **par séance**, donc J1 et J2
indépendants. Les rétroviseurs, qui ne recevaient aucune lampe, reçoivent celles de leur propre caméra.

## Résultats réels

Sur le Spark (`spark-5fc3`, Linux arm64, Node 24.18.0, Chrome 151 sans interface, rendu **logiciel** ANGLE/SwiftShader,
carte GB10 non exposée) : 37 suites Node réussies, `check-ferro-lock.py` **FERRO 0.3.3, 34/34**, build reproductible
`dist/bitume.html` 12 863 555 octets, gzip 2 951 929, sha256 `40e8a9d50c3dfafb77a4ff117a3e463759a85d9bc9175f155887297ae081fd58`.
Page réellement rendue dans Chrome, écran titre avec signature, course et démo lancées, **aucune erreur de console**.

Même scène (Val-Brûlé, 1390×1295, qualité `high`, banc 6 s après 1 s de chauffe) : CPU autour de `draw` **1,4 ms**
(p95 1,7), simulation **3,2 ms**, effets/affichage/son **0,1 ms** chacun, **GPU mesuré 407,5 ms** (ombres 176,2 · monde
217,3 · effets 2,0 · post 16,2), 171,8 draw calls et 703 066 triangles en vue principale, 90,3 et 301 588 en
rétroviseurs, 0 requête disjointe écartée. Avant le lot, rien de tout cela n'était mesurable.

Tunnel de Haut-Col, caméra réellement rendue : à l'abscisse 1 928 sous la voûte, **3 lampes retenues**, somme 24,79,
135 draw calls, 261 150 triangles ; à 2 200 hors du tunnel, **0 lampe**, 110,2 draw calls, 221 132 triangles. Journaux
bruts à côté de ce fichier.

## Reste ouvert après ce lot

- **Performances non qualifiées** : le Spark ne rend qu'en logiciel. La cible 60 FPS et le critère « p95 ≤ 16,7 ms en
  1390×1295 sur le Mac, volet visible et focalisé » sont à prendre sur le Mac. Aucun gain de FPS n'est déclaré.
- **Validation visuelle non faite** : les chiffres prouvent que les lampes suivent la caméra, pas que le fondu est bon
  à l'œil. Capture Mac à prendre en cockpit sous la voûte, à l'entrée, au milieu et à la sortie, en vitesses lente et
  rapide, en poursuite, en démo et en écran partagé.
- **Conduite S8** (~1 031 °/s² pour une cible ≤ 300) : inchangée, ouverte.
- `verifications/decor.test.mjs` échoue sous concurrence CPU (154 à 180 ms pour 150 ms de seuil), passe machine calme ;
  seuil non assoupli.
