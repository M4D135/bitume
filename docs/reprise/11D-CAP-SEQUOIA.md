# Lot 11D — Cap-Séquoia, FPS démo et Faune

## Résultat qualifié — 18 novembre 2026

Septième circuit original : `cap-sequoia`, index 6, thème `pacifique`, graine 157, longueur réelle **5 234 m**.
Côte rocheuse du Pacifique aux États-Unis : trois caps inégaux, anses, océan et clairières dans les nappes existantes.
**320 grands conifères** groupés en bosquets, tronc maximal 39,34 m. Les troncs restent présents dans le modèle lointain.
Un petit rocher côtier solide est généré ; l’identité des falaises vient principalement du relief. Aucun brin supplémentaire, village ni asset importé.
Quatre saisons et hiver enneigé ; conifères persistants ; Port-Sable conserve son exception sans neige.

Demandes ajoutées pendant la reprise : **FPS visibles en démo**, ordinateur et tactile, en bas à gauche ; réglage **Faune** remplaçant « Insectes et lucioles », niveaux de densité accordés et description générale.
Le compteur existant reste actualisé depuis la durée d’image lissée ; le masquage CSS en démo est supprimé.

## Qualification

- **66/66 suites**, puis 11 contrôles Pacifique sur la correction finale des modèles lointains ; 29 contrôles pré-départ réseau.
- **11/11 adversaires terminent un tour** en 262,05 secondes simulées avec les vrais modules contacts/dégâts/obstacles et 968 solides actifs.
- **24 décors historiques identiques** (six circuits × quatre saisons, High sans végétation additionnelle) à la base `2a0c9d9`.
- Deux builds strictement identiques ; **34 modules FERRO 0.3.9 conformes**.
- Dénivelé de piste 13,44 m ; pente maximale 6,8 % ; terrain de −76 à 34,35 m ; mer à −58 m.
- Dégagement minimal des troncs 38,31 m ; 320 troncs proches/lointains correspondants, 320 collisions uniques, y compris avec botanique réelle.
- 99 768 triangles de nappes ; terrain, arbre et collisions stables entre saisons et qualités.

Preuves : `rapports/cap-sequoia-2026-11-18/qualification.json`, `tests.json`, `qualification-pacifique.json`, `decors-historiques.json`, `builds.json`.
La carte et la projection CPU inspectées montrent le terrain réel et la route, sans arbres ni objets. **Ce ne sont pas des captures du jeu.**
Le navigateur local ne démarre pas (`socket(): Operation not permitted`) ; WebGL et performances matérielles restent non validés.
Aucun accès SSH à Mac/amiga dans cette session : déploiement autorisé mais non effectué.

## Publications et reprise

Reçu précédent 0.2.37 complété : `2df8acc`. Checkpoint de travail réel : **`896b1c8`**, avant qualification.
`travail-en-cours.patch` conserve ce checkpoint historique ; **ne pas le réappliquer** après la publication du code qualifié.
La publication 0.2.38 contient sources, tests et jeu reconstruit. Le reçu final est dans `publication.json`.
Maintenir `main` sans force ; contrôler le jeu puis déployer dès accès Mac/amiga. Programme : **7 circuits sur 16**.
Prochain lot de contenu : un seul circuit original d’Europe du Nord ou de l’Est, à choisir sans recharger les anciennes archives.
