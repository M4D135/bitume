# Lot 11C — Brume-de-Jade

## Résultat qualifié — 18 novembre 2026

Sixième circuit original : `brume-de-jade`, index 5, thème `asie`, graine 131, longueur réelle **5 018 m**.
Sept pics calcaires asymétriques et terrasses jade sont intégrés aux nappes existantes. Atmosphère brumeuse,
46 arbres en bosquets, 104 éperons ; aucun brin additionnel ni boucle de décor supplémentaire par image.
Printemps fleuri, été plus sec, automne orangé avec feuilles, hiver enneigé. Port-Sable conserve son exception.
Aucun asset, tracé externe ou module FERRO importé ou modifié. Arrière de monoplace 0.2.36 conservé.

## Qualification

- **65/65 suites**, deux builds identiques, 34 modules FERRO 0.3.9 conformes.
- Onze adversaires terminent un tour en 253,12 secondes simulées.
- Pente maximale 5,445 %, dénivelé de piste 24,76 m ; terrain de −42,57 à 277,72 m.
- Rochers dégagés d’au moins 47,68 m de la chaussée ; troncs à 36,07 m au minimum.
- 95 608 triangles de nappes ; aucune mesure FPS matérielle annoncée.
- Route, positions des arbres et collisions stables entre quatre saisons et entre Low/High.
- Les 20 variantes des cinq décors précédents sont strictement identiques au commit `8d2c784`
  dans le contrôle High sans végétation additionnelle. Rapport avec empreintes exactes conservé.
- Sixième circuit et conditions de l’hôte transmis jusqu’au départ invité, 28 contrôles de pré-départ réussis.

Preuves : `rapports/brume-de-jade-2026-11-18/qualification.json`, `tests.json`, `qualification-asie.json`,
`decors-historiques.json`, `carte-relief.png` et `terrain-oblique.png`.
Les images sont des projections CPU du terrain réel. **Pas des captures du jeu** : WebGL, matériaux et performances
restent non validés. Chromium local ne démarre pas ; le navigateur cloud refuse les fichiers locaux par sa politique.
Le déploiement via `./deposer.sh` est autorisé mais l’accès Mac/amiga n’est pas disponible ici.

## Publications fréquentes et reprise

Checkpoint initial publié et vérifié : `5368b4bebd77c7005c287d042050c28011f64e39`.
Il conserve le vrai patch des sources/tests alors en cours, ainsi que les actions restantes. Ce patch est historique :
ne pas le réappliquer sur la version qualifiée. Voir `publication.json` pour le reçu de la 0.2.37.
La branche unique reste `main`, sans push forcé. Après chaque petit lot, publier le progrès puis le code/build qualifiés.

## Suite

Contrôle du jeu en WebGL et déploiement dès que Mac/amiga est accessible. Le programme atteint 6 circuits sur 16.
Pour le prochain lot de contenu, choisir un seul circuit original aux États-Unis ; ne pas recharger les anciens lots.
