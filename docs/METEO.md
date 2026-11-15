# Pluie projetée — 16 novembre 2026

La pluie de BITUME est calculée dans un volume autour de la caméra, puis projetée sur le canvas météo avec les mêmes axes et le même champ vertical que FERRO. Elle remplace les traits uniformes attachés à l'écran. Les gouttes proches sont plus épaisses ; les lointaines sont plus fines et moins opaques. Les rafales sont exprimées dans le monde, et la traînée tient compte du mouvement de la caméra avec une exposition fixe de 1/90 s. Une coupe de caméra ne produit pas une traînée démesurée.

Le volume contient au plus 840 candidats et n'utilise que trois chemins Canvas2D, sans allocation par goutte pendant le rendu. Les gouttes sont générées par des graines fixes et des positions analytiques ; leur animation ne dépend pas du nombre d'images. L'atténuation progressive dans le bas du cockpit dégage les mains et la planche. L'intensité des éclairs passe par l'ambiance du moteur ; aucun grand voile blanc n'est ajouté au canvas.

Le cycle clair/couvert/pluie/orage conserve les durées 26/12/22/16 secondes. Les transitions conservent le reliquat de temps. La pause transmet zéro seconde et fige aussi bien le cycle que la position et la traînée des gouttes. L'ancien état `S.meteo` à phases nommées est accepté. L'humidité ajoutée ne change ni l'adhérence ni la physique de course.

## Source et adaptation

Source consultée en lecture seule : EMPRISE / RADE, `src/weather.js`, HEAD `22a330f2dbbdc7ee359ce03da785e0cbeca495d4`, SHA-256 du fichier `a764ccb1a79d7602f0b10cc77bbc9e9dfcfce9c9776e63a9ff8542ab8c43a939`. Ce fichier correspondait au HEAD ; d'autres fichiers du projet étaient en cours de modification par un autre chat. Chemin du snapshot consulté : `/Users/david/Documents/Codex/2026-11-14/files-pasted-by-the-user-cr/outputs/rade/src/weather.js`.

Idées adaptées : distribution déterministe de pluie dans l'espace, deux oscillations de rafales, accumulation et séchage progressif de l'humidité. Les boîtes GPU, anneaux au sol, éclairs géométriques, cycle solaire et sauvegardes d'EMPRISE ne sont pas portés ici. La projection et le regroupement Canvas2D sont propres à BITUME. Aucun asset, son, texture, bibliothèque ni renderer tiers n'est ajouté par ce lot.

Le Spark a fourni un premier jet ciblé, puis relu et corrigé : noms des phases, reliquat des transitions, intégrale du vent, vitesse réelle de caméra, dimensions/DPR, longueurs et opacités des traits, lots de dessin et pause. Les réponses et la demande sont conservées avec les preuves de travail, hors sources du jeu.

## Contrat moteur

`B.meteo.avancer(S, secondes)` rend l'état `S.meteo`. `B.meteo.creerPluie(canvas)` rend un dessinateur et des statistiques de candidats, gouttes visibles, traits et lots. `dessiner(m, camera, secondes, {cockpit, dpr})` utilise la caméra effectivement rendue.

`B.meteo.ambiance(m)` conserve le contrat `fx.weather` objet et expose :

- `pluie`, `nuage`, `eclair` : intensités atténuées pour préserver la lisibilité avec le renderer BITUME existant ;
- `mouille` : humidité 0..1 qui persiste après l'averse ;
- `ventX`, `ventZ` : vitesse des rafales dans le monde, en mètres par seconde.

Le renderer historique ignore les trois derniers champs ; une brume légère résiduelle passe alors par `pluie`. Le moteur EMPRISE intégré utilise désormais `mouille` pour ses matériaux mouillés et le vent pour son ambiance. Le module Canvas ne simule pas de reflets par-dessus le jeu ; ceux-ci sont calculés par les shaders du moteur. La provenance de ce port est détaillée dans `src/moteur/PROVENANCE.md`.

## Vérifications et limites

`node verifications/meteo.test.mjs` exerce 98 contrôles : secondes et raccord réel dans `jeu.js`, 200 secondes de cycle, frontières de phases, cadence 20/30/60/120/144 Hz, pause/reprise, éclair en orage, ancien état, projection à 30/60/120 Hz, mouvement et coupe de caméra, resize, DPR plafonné à 1,5, traits fins et bornés et nombre de lots.

Sur le candidat isolé : 27 fichiers de tests Node ont passé sur Spark. Après le réglage final de densité/contraste, les tests météo ont été rejoués ; les autres sources de simulation sont inchangées. Chrome sur Mac sans fenêtre a vérifié WebGL2, trois cadrages avant/après et l'absence d'erreurs, avec des captures inspectées.

Le coût du module sur 400 échantillons Canvas2D à 1280×720, caméra avançant à 60 m/s, était de 0,053 ms en moyenne, 0,10 ms au 95e percentile et 0,20 ms au maximum. Il mesure le JavaScript et la soumission des commandes Canvas, avec une horloge quantifiée. Il ne mesure pas l'achèvement GPU, les images effectivement affichées, un téléphone ou une Xbox. La cadence visuelle après assemblage avec le nouveau moteur doit être vérifiée séparément.

La pluie reste un overlay : elle ne lit pas le tampon de profondeur et n'est pas masquée individuellement par les arbres ou les rivaux. Le masque du cockpit est une approximation visuelle, pas une surface vitrée. Le volume périodique est fondu près de la caméra et à sa limite lointaine ; les rares gouttes au bord du volume peuvent être renouvelées. Les captures avant/après montrent deux séances indépendantes, pas une comparaison pixel à pixel des voitures.
