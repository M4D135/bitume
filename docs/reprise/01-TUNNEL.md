# Lot 1 : tunnel et mesures de référence

Statut : **à faire**. Lire `REPRISE.md` et la tête distante avant intervention.

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
