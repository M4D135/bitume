# Virages lisibles, annonces et reflets des flaques

## Demande et périmètre

Demandes de David du 19 novembre : préparer surtout les virages difficiles avec vibreurs, glissières et décor routier ; proposer une annonce réglable ; corriger les reflets découpés en lignes parallèles dans les flaques (photo Port-Sable, caméra extérieure de démo).

Base : `main f03a99cc0a5bcbd663a7ff25c887c4ea9ecacd0c`, BITUME 0.2.53 / p13. Branche `codex/bitume-reperes-annonces-reflets-20261119`. 13A fermé ; 13B différé après ce lot.

## Réalisation en cours

- `src/virages.js` : plan géométrique partagé, pur et mémorisé hors du circuit ; direction, distance et trois degrés de difficulté. Aucune mutation physique ni tirage aléatoire.
- `src/decor.js` : contrastes des vibreurs et rails, panneaux de freinage et chevrons lisibles à distance ; hors des stands, tunnels, routes voisines et limites physiques. Les anciens murs de pneus et solides restent identiques.
- Interface : réglage Non / Écran / Écran et voix, Écran par défaut ; affichage indépendant par joueur. Voix française locale facultative, J1 seulement à deux ; interruption en pause/menu/onglet masqué/son coupé.
- FERRO : le SSR historique du renderer est actif ; le module optionnel `reflections.js` ne remplace pas directement les flaques diélectriques. Cause reproduite sur le vrai shader EGL : la lecture de profondeur sans highp créait des stries sur le sol et les reflets. La précision corrigée retire les bandes ; parcours en pixels, raffinement et alpha prémultiplié traitent ensuite les pièces fines et contours. Correction dans un checkout canonique isolé puis propagation vérifiée.

## Contrôles requis

Tests du plan et du suivi (S, épingles, raccord du tour, arrêt/recul, reprises), intégration réglages/ATH/voix, invariance des obstacles des huit circuits, syntaxe et construction reproductible. Pour FERRO : shader réel sur EGL, comparatif avant/après et contrôle des silhouettes fines/franges ; reproduction obtenue, qualification finale en cours. Aucun résultat WebGL de la scène ou FPS matériel encore disponible ; Chromium est bloqué ici par `socket() failed: Operation not permitted`.

Conserver p13, météo et service des pneus. Spark, Mac et amiga indisponibles ; repli local documenté. Pas de déploiement du site depuis cet environnement. Publier des checkpoints Git immuables et leurs preuves, sans push forcé.

## Prochain geste

Terminer les trois implémentations séparées, vérifier les preuves et intégrer la version canonique de FERRO. Ne pas relancer les parcours 13A déjà clos sauf modification qui affecterait réellement leur résultat.
