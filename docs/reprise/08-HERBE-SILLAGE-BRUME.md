# Lot 08 — herbe dense, souffle des voitures et horizon lisible

## Livraison publiée — 18 novembre 2026

Base BITUME : `e150378d6e547a8dc1510334643c061b7cba72dc`, 0.2.29. Nouvelle version : **0.2.31**.
FERRO **0.3.7 publié** : `0250a5750d10789976186a1491ffdf011fb19611`. BITUME publié sur `main` : `f6093f45c9f55f17c8f7b7035405ebfe1c9142bf`. Reçu : `rapports/herbe-sillage-2026-11-18/publication.json`.

## Résultat

La signature **m4d135 en bas à gauche de l’écran titre** sert à enregistrer le jeu sous **BITUME.html**. Le lien reprend exactement celui observé en ligne : `href="https://bitume.estrasse.fr/"`, `download="BITUME.html"`, titre « Télécharger BITUME ». Avatar, libellé et placement conservés ; quatre contrôles de signature réussis après intégration. Preuve : `rapports/herbe-sillage-2026-11-18/signature-preservee.json`.

- Densité de brume ramenée à **34 %** de la valeur précédente, dans l’adaptateur graphique du jeu. Pluie, humidité, éclairage et décor de référence conservés.
- **96 brins réels par tuile**, distribués sur son empreinte. Géométrie de 6 triangles proches et 2 lointains par brin, contre 24 et 8 auparavant. Aucune disparition d’herbe à distance.
- Lots du tapis de 48 m et détail à 60 m, calibré par FOV/viewport. Même surface et silhouette au repos ; écart de courbure LOD testé sur shader inférieur à un pixel à cette référence.
- Souffle selon position et vitesse signée de chaque voiture, distinct du cap de la caisse en dérive ; marche arrière, arrêt et tunnel traités. Racines ancrées, sillage orienté et retour progressif.
- Sources et ambiance réutilisées entre les images, les deux joueurs et les rétroviseurs. Aucun objet JS ni parcours CPU par brin à chaque image.
- Moteur : 32 émetteurs suivis au maximum, quatre sources GPU ; distances/LOD et bornes des lots réutilisés dans les passes d’une même vue.

## Densité réellement construite, comparée à 0.2.29

| Circuit | Brins Dense | Facteur | Brins Très dense | Facteur |
|---|---:|---:|---:|---:|
| Val-Brûlé | 362 100 | ×10,41 | 720 756 | ×11,06 |
| Port-Sable | 301 080 | ×11,04 | 599 832 | ×11,66 |
| Haut-Col | 430 743 | ×12,99 | 860 439 | ×13,45 |

La densité Moyenne atteint également ×11,30 à ×13,93. Légère et Sans herbes conservent leur coût réduit. Les arbres, obstacles, collisions et hasard de simulation sont inchangés.

## Qualification

- **47/47 suites Node sur le candidat graphique**, puis **4 contrôles de signature** après intégration finale du lien Enregistrer. Verrou **34/34** et build **0.2.31** strictement reproductible.
- Moteur : **147 réussites, zéro échec, un TODO physique historique** ; **18/18 étapes WGSL validées** par Naga.
- Exécution réelle des shaders couleur/profondeur sous EGL/Mesa logiciel : racines fixes, déformation des pointes identique dans les deux passes, cas non opt-in inchangés. Le test de passage déplace une herbe de 0,36 m d’environ 11,7 cm ; l’écart LOD mesuré vaut 0,455 pixel à 60 m, 1080p, FOV60.
- **3 593 856 racines contrôlées** contre les vrais triangles d’accotement. Dense/Très dense : −2,71 cm à +0,62 cm autour du sol ; tolérances Moyenne explicites dans les tests.
- Les cinq sources équidistantes ne peuvent plus annuler collectivement le souffle ; le cas est couvert dans le moteur.

## Performance : résultats et limites

Banc de soumission du vrai renderer devant une API WebGL instrumentée, 960×540/FOV60, ombre solaire active. Les scènes ne contiennent pas de voitures : elles isolent le coût des lots, pas le coût GPU du souffle.

| Vue | Triangles herbe couleur + ombre | Évolution | Triangles décor complet |
|---|---:|---:|---:|
| Cockpit | 433 008 → 329 664 | −23,87 % | −1,47 % |
| Poursuite | 301 104 → 253 632 | −15,77 % | −5,67 % |
| Bord du sol | 344 736 → 395 040 | +14,59 % | +2,42 % |

Les petites tuiles augmentent les appels et le CPU instrumenté ; les buffers d’instances herbe augmentent de 8,5 %. Ce compromis n’est pas présenté comme un gain FPS global. Le cache moteur réduit séparément les calculs de distance/LOD et les allocations de bornes ; sa preuve isolée est dans `FERRO/docs/local-wind-037/lot-cost.json`.

Chromium reste bloqué avant DevTools dans cet environnement. EGL vérifie l’exécution des shaders, mais ne remplace ni une capture du jeu complet ni une mesure FPS sur le GPU du joueur. La vérification visuelle finale, les transitions en mouvement et les performances matérielles restent à faire.

## Preuves et prochaine action

Dossier : `docs/reprise/rapports/herbe-sillage-2026-11-18/` : `tests.json`, `tests.zip`, `qualification.json`, densités et comparaison avant/après. Le script de soumission et sa fixture sont inclus pour reproduire les compteurs ; ils ne calculent aucune image.

Sources et build publiés sur `main` ; validation visuelle et `./deposer.sh` restent à effectuer depuis le Mac. Le déploiement est autorisé ; accès Mac/amiga indisponible ici. Le site a été relu : il sert la version **0.2.30 du lien Enregistrer**, SHA256 `2f8c359838c4c92237fbafcfdec17427777bb1dbcc49e880712e1c05ccab6da1`. Le nouveau lot graphique prend donc **0.2.31**.
