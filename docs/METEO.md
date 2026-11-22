# Pluie projetée — 16 novembre 2026

La pluie de BITUME est calculée dans un volume autour de la caméra, puis projetée sur le canvas météo avec les mêmes axes et le même champ vertical que FERRO. Elle remplace les traits uniformes attachés à l'écran. Les gouttes proches sont plus épaisses ; les lointaines sont plus fines et moins opaques. Les rafales sont exprimées dans le monde, et la traînée tient compte du mouvement de la caméra avec une exposition de 1/90 s en pluie légère, prolongée jusqu’à 1,45/90 s sous une forte averse. Une coupe de caméra ne produit pas une traînée démesurée.

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

## Visière optique — 20 novembre 2026

Depuis la .130, la caméra de course affiche simultanément la chute de la pluie dans l’air et les gouttes sur la visière. Le réglage de la visière à zéro laisse l’averse visible sur le circuit. Les couches de petites perles disposent de dix fois plus de positions sur une même surface. Le sillage des roues active des positions supplémentaires pour les gouttes moyennes et les filets. Le module
`src/visiere-optique.js`, chargé avant `vitre.js`, reconstruit le contrat du prototype Claude décrit
dans `docs/reprise/rapports/etudes-2026-11-18/etudier-vitre.json` : petites perles, grosses gouttes,
ruissellement, nappes, embruns, neige humide périphérique et buée. Les formes et les variations sont
calculées par un shader du jeu ; aucun module FERRO verrouillé ni fichier de texture n'est modifié.

En Moyenne, Fine et Photo, une copie bornée de la scène courante fournit la couleur réellement
déformée dans l'eau. Fine et Photo ajoutent un filtrage local plus riche. En Légère, le shader ne copie
pas la scène. Si WebGL2 est indisponible pour la visière, `vitre.js` conserve son repli Canvas2D.
L'effet reste composé sous l'ATH et les rétroviseurs, atténué en extérieur, distinct pour J1/J2.
La pause fige les dépôts ; la vitesse les évacue. Le réglage « Gouttes sur l'écran » reste de 0 à 2,
sans geste d'essuyage. La neige fond progressivement en eau.

`contexte.sourceScene` reçoit l'image juste rendue pour chaque vue, avant la copie de J2 et avant
le rendu de J1. `contexte.embruns` vient de `B.sillage.exposition` : position de caméra dans le
panache arrière d'une voiture, vitesse réelle, hauteur et chaussée mouillée. La voiture filmée
est exclue. Une caméra hors du panache, une source à l'arrêt ou abritée, une chaussée sèche et
une autre chaussée superposée n'ajoutent pas d'eau. Les dépôts existants continuent à sécher sous abri.

Les ressources optiques sont préparées sous le voile de chargement, même pour une course sèche.
La surface est bornée à 2 000 000 pixels et la copie de scène à 1 048 576 pixels au maximum
(plafond réduit en Moyenne). La copie entre contextes peut coûter selon le navigateur : les mesures
du module Canvas historique ci-dessus ne décrivent pas cette nouvelle optique. Aucune performance
matérielle n'est déduite des contrôles Node, EGL ou des captures SwiftShader.

Qualification et captures : `docs/reprise/HAUT-COL-METEO-2026-11-20.md` ; outil reproductible
`tools/captures-meteo.mjs`. Les poses des scènes de comparaison sont volontairement figées, leurs
vitesses alimentant les effets. Ces captures vérifient le rendu et ses raccords, pas la conduite.
