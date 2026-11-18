# BITUME 0.2.29 — herbe dense et options indépendantes

## Demande du 18 novembre 2026

Densifier les herbes et proposer dans les réglages des choix séparés pour l'anticrénelage, les ombres et la densité de végétation. Base de travail : `main`, `b094dc4d25bf9a16d0c21044226d29879ab93dab`, BITUME 0.2.28 / FERRO 0.3.5. Conserver les profils généraux et le travail déjà publié par le Spark.

## Fonctionnement livré

| Réglage | Choix | Application |
|---|---|---|
| Qualité générale | Légère, Moyenne, Auto, Fine | Fonctionnement précédent conservé |
| Anticrénelage | Selon qualité, Désactivé, MSAA 4× | Au prochain rendu, sans recréer le contexte |
| Ombres | Selon qualité, Désactivées, Moyennes, Fines | Au prochain rendu ; seule la cible d'ombres change de taille |
| Densité de végétation | Selon qualité, Sans herbes, Légère, Moyenne, Dense, Très dense | À la prochaine course, indiqué dans le menu |

Les trois choix sont persistés dans `bitume.reglages`. Une ancienne préférence ou une valeur inconnue reprend « Selon qualité ». Un choix explicite n'est pas annulé par les paliers d'Auto ; les limites matérielles restent respectées. La qualité générale Légère peut ainsi garder une végétation Dense ou un anticrénelage actif sans rallumer le halo et les autres effets.

Le MSAA dépendait auparavant du halo et l'échelle d'ombres du profil n'était pas transmise au moteur. FERRO **0.3.6** corrige ces chemins dans sa source canonique ; ses 34 modules sont installés sans retouche locale. Avec une résolution numérique, les niveaux d'ombres demandent des atlas de 1 024 ou 2 048 pixels, bornés par le GPU. MSAA demande jusqu'à quatre échantillons. Les compteurs `stats.msaa`, `shadowMapSize` et `shadowTileSize` indiquent les valeurs effectives.

## Végétation

Un tapis de graminées plus basses relie les massifs existants sur les deux côtés de la route. Les positions et les hauteurs sont irrégulières et déterministes. Les nouvelles plantes réemploient les maillages et les lots existants ; aucun asset externe. La maille des tapis passe de 8 à 4 puis 2 mètres et les budgets sont bornés. Les arbres, les solides, le tracé et le hasard de simulation sont inchangés. Chaussée, stands et tunnel restent exclus ; les plantes gardent leurs niveaux de détail au loin.

Comptage des touffes d'herbe du décor réellement construit, aux graines des circuits du jeu :

| Circuit | Légère | Moyenne | Dense | Très dense |
|---|---:|---:|---:|---:|
| Val-Brûlé | 124 | 1 123 | 3 866 | 7 238 |
| Port-Sable | 86 | 853 | 3 030 | 5 716 |
| Haut-Col | 74 | 1 079 | 3 684 | 7 108 |

Le réglage Dense de Val-Brûlé comptait 468 touffes dans la version précédente : la nouvelle densité est environ 8,3 fois supérieure. Ces chiffres portent sur le circuit entier ; ils ne constituent pas des mesures de triangles visibles ou de performances GPU. La qualité générale Légère avec « Selon qualité » conserve zéro végétation basse.

## Qualification

- **46/46 suites Node du jeu réussies**, dont les scénarios de stockage, changements d'options, cache de scène et restauration des références.
- **FERRO 34/34 modules conformes** ; moteur testé séparément : 137 contrôles, 136 réussis, un TODO physique préexistant et zéro échec ; 13 contrôles ciblent les cibles de rendu.
- **Build reproductible** : BITUME 0.2.29, 13 007 872 octets, 3 004 365 octets compressés. Empreinte complète dans `rapports/options-vegetation-2026-11-18/build.json`.
- **15 combinaisons de densité/biome vérifiées**, sans conflit ; le budget utilise désormais le résultat réel de `decor.construire`, y compris les arbres détaillés.
- Revue indépendante des chemins MSAA/ombres, de la gestion des ressources et de l'intégration des options.

Preuves : [tests](rapports/options-vegetation-2026-11-18/tests.json), [journaux](rapports/options-vegetation-2026-11-18/tests.zip), [densités](rapports/options-vegetation-2026-11-18/densites.json), [build](rapports/options-vegetation-2026-11-18/build.json), [limites](rapports/options-vegetation-2026-11-18/limites.json).

## Limites et suite

La vérification navigateur du build final n'a pas pu être exécutée ici : Chromium local est arrêté par la restriction de sockets ; le navigateur distant n'accède pas au serveur local et refuse le protocole `file://`. Les tests du moteur exercent son code de production devant une interface WebGL instrumentée ; ils ne valident pas l'image ou les performances d'un pilote GPU réel.

Le parcours reproductible `node tools/controle-options.mjs --entree dist/bitume.html --sortie /tmp/bitume-options.html` prépare une copie de QA hors du build. Depuis un navigateur autorisé sur le Mac, ouvrir cette copie avec `?vue=options` ou `?vue=herbe&densite=high`/`ultra` ; le résultat est dans `#qa-resultats`. Tester ensuite le vrai `dist/bitume.html`, en solo et à deux. Aucune exécution navigateur de cet outil n'est revendiquée dans cette reprise.

Le déploiement Mac/amiga est déjà autorisé mais aucun accès SSH correspondant n'est présent dans cet environnement. Après publication, utiliser la procédure habituelle `./deposer.sh` et vérifier l'empreinte de la page servie. Un commit publié ne constitue pas une preuve de déploiement.

## Reprise courte et publication du 18 novembre

FERRO 0.3.6 publié sur `main` : `7d7f1018db33632ae448e6fd6e0b4f6b6f8fe5d1`. Les quatre suites jeu ciblées et le verrou 34/34 repassent ; reconstruction identique au build récupéré. Preuve : `rapports/options-vegetation-2026-11-18/publication-validation.json`. Les résultats 46/46 restent les preuves antérieures, pas une nouvelle exécution complète.

`REPRISE.md` et `ETAT.json` sont réduits à l’état courant. Leur contenu précédent est conservé dans `archives/` ; les prochaines discussions ne lisent que le lot actif. La validation visuelle et le déploiement du build 0.2.29 restent à faire depuis le Mac.

Publication du jeu vérifiée : `40b31d582e434b8d87379c360648997e940f6d64` sur `main`, arbre `0285d3f8073f17c21b46619d751eeac8e019b3d9` strictement identique à l’index local qualifié, comprenant sources et `dist/bitume.html`. Le site public a été relu : il sert encore **0.2.28** (SHA256 `41f82e4cac4256fe3db92f032e9a4f2e4c498a5402ab1f79b9eef2aa71e329bd`). L’hôte `amiga` n’est pas résolu dans cet environnement ; aucune mise en ligne 0.2.29 n’est revendiquée.
