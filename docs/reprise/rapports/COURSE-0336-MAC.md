# Cache de relief, records et suivi Larche (26 novembre)

Chrome Mac, ANGLE natif. `0.2.336` : SHA-256 `41231a53ef66cf964ca971124c46efa7ab46a6f81241e83c540009c3425cc78d`.

- `tools/banc-navigateur.mjs --mode cache-relief` : 44 096 hauteurs finales, empreinte `3753069026` aux deux ouvertures. Bloc de 352 808 octets. Calcul et capture : 30,1 ms ; copie du bloc déjà lu : 0,1 ms. Ces mesures ne chronomètrent ni l’ouverture IndexedDB ni le chargement complet. Zéro erreur remontée.
- `records-physique` vérifie la file d’écriture de `finTour`, la relecture du record enrichi p55, l’isolation des clés p15/p54 et la conservation des fantômes historiques. Aucun changement de physique. `pneus-reseau-integration` : 13/13 avec le repère actuel du garage.
- Trois parcours du banc `strategie-stands-sortie-file` échouent encore : voiture derrière la file, sortie dans la neige et joueur qui redémarre. Ne pas réceptionner 12F4.

## Contre-épreuves du build 0.2.335

SHA-256 `173160459d2652630eba8f5c68acf396c2fd82a747bba12dd76769724cc0bf94`, mêmes options que la [matrice](COURSE-0335-MAC.json).

- `cache-lru` : 12 entrées ; éviction, remplacement, purge par préfixe et par version vérifiés dans Chrome.
- Départ Larche à 17 950 m, 1080p Fine, pluie : p50 16,7 ms, p95 33,3 ms, pire 2 216,6 ms, sur la fenêtre du banc. La pause de plus de deux secondes se reproduit.
- `endurance-larche` : dernière position 15 395,14 m sur 32 249,33 m, 485,864 s enregistrées, aucune arrivée. 29 063 intervalles rAF (59,82/s), 18 625 dessins principaux (38,33/s), p95 entre dessins 33,4 ms. Aucun résultat après cette position ; aucune perte de visibilité ni exception consignée par le compteur pendant la portion observée.

## Chronométrage corrigé en 0.2.337

Avec `--profil oui` sur .336, l'appel de préparation a occupé l'intervalle 1 417,1–3 606,2 ms. Le premier callback, daté 1 426,3 ms, a été livré à 3 661,9 ms. Le suivant était daté 3 659,4 ms : leur différence, 2 233,1 ms, est exactement la pire « image » publiée par cet essai. Le chronomètre démarrait pendant le chargement.

Sur .337, les deux horodatages d'un intervalle retenu sont postérieurs à la préparation et à la chauffe. Même départ : préparation 2 380,8 ms, puis 1 106 intervalles en 20,03 s, p50 16,7 ms, p95 33,3 ms, pire 33,4 ms. C'est une correction de mesure, pas une accélération du moteur. Empreinte `c48cf4eb7ec5379b6cdcaac67e4ba57e8626f47b7f5324cd62589632d99729f6`.

`node tools/banc-navigateur.mjs --url file:///…/dist/bitume.html --angle native --taille 1920,1080 --qualite high --meteo pluie --depart 17950 --circuit 6 --chauffe 2 --duree 20 --profil oui --attendre 120000`
