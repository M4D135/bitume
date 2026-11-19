# Marseille — sources préparatoires des lots 15A/15B

**19 novembre 2026. Données conservées et cohérence interne contrôlée.** Ce dossier prépare la Spéciale Marseille depuis EMPRISE ; il ne clôt ni le choix du corridor 15A, ni la qualification du relief 15B. Aucun parcours de course, profil de chaussée, module du jeu ou build n’est produit.

## Contenu réutilisable

| Fichier | Rôle |
|---|---|
| [sources.json](sources.json) | Commit, blobs Git, SHA-256, dates connues ou manquantes, licences et limites. |
| [sources/](sources/) | Neuf acquisitions et notices conservées à l’octet : cœur EMPRISE, trois notices, grille IGN, requête, reçu, descriptif de ressource et diagnostic distinct. |
| [coeur.json](coeur.json) | Toutes les données décodées du cœur et de son horizon ; tableaux typés remplacés par des tableaux JSON, valeurs inchangées. |
| [inventaire.json](inventaire.json) | Liste complète des voies, empreintes bâties et repères métriques ; renvoi de chaque objet à son indice source. |
| [grille.json](grille.json) | 4 225 altitudes API avec coordonnées géographiques, coordonnées métriques et incertitudes séparées. |
| [qualification.json](qualification.json) | Comptes, emprises, pas, valeurs négatives, niveaux et réserves calculés. |

Le fichier urbain vient d’[EMPRISE au commit `cc004826a506e6979eaaec217748fe85d5cd6ac5`](https://github.com/M4D135/emprise/blob/cc004826a506e6979eaaec217748fe85d5cd6ac5/src/pdr/villes/marseille.js), version 0.6.8, blob `3ae57a817b1426cc969ea2de6e363dd083231355`. Le décodeur vérifie aussi son empreinte interne FNV-1a `1651787597`. Son décodage frais a été comparé intégralement à l’acquisition JSON préexistante avant conversion des tableaux.

## Inventaire et emprise

| Élément du cœur | Quantité | Interprétation |
|---|---:|---|
| Polylignes de voies | 1 177 | Dont chemins, pontons et rails ; ce compte n’atteste pas des routes roulables. |
| Tronçons nommés | 662 | 278 noms distincts ; un nom peut couvrir plusieurs segments disjoints. |
| Empreintes ou parties de bâtiments | 5 274 | Ne pas les compter comme autant d’immeubles cadastraux uniques. |
| Indicateur de hauteur `connue` | 1 080 | Hauteur renseignée par le fournisseur ; aucune vérification de terrain. |
| Eau / espaces / mobilier | 5 / 166 / 1 008 | Géométrie de plan, sans altitude exploitable du sol. |
| Repères nommés | 119 | Coordonnées X/Z exactes de l’extraction, aucune altitude ajoutée. |
| Tronçons marqués pont / couche 1 | 4 / 8 | Informations source conservées, connexions et niveaux non qualifiés. |

Le carré de jeu source mesure 1 100 m de côté ; sa marge de 60 m donne une emprise documentaire de **1 220 × 1 220 m**. Origine : **43,2962° N, 5,3734° E** ; **X vers l’est, Z vers le sud**, mètres. Les coordonnées sont quantifiées au décimètre puis décodées en Float32. Cette finesse de stockage ne mesure pas l’exactitude de la cartographie OpenFreeMap/OpenMapTiles au zoom 14, snapshot `20261101_080013_pt`.

Quelques repères permettent de se situer sans inventer de tracé :

| Indice `reperes` du cœur | Repère | X (m) | Z (m) |
|---|---|---:|---:|
| 2 | Musée des Arts Africains, Océaniens, Amérindiens | −428,9 | −534,3 |
| 7 | Musée d’Archéologie Méditerranéenne | −415,4 | −487,0 |
| 48 | Hôtel de ville | −288,8 | −37,2 |
| 50 | Vieux-Port | −334,0 | 180,1 |
| 115 | Musée Cantini | 390,3 | 443,4 |

`coeur:rues:0042` désigne l’indice 42 de la liste source, **pas un identifiant OpenStreetMap**. Les objets gardent leur ordre et leurs points. Les longueurs de l’inventaire sont celles des polylignes 2D extraites ; elles ne constituent ni une longueur de course ni une distance topographique certifiée. Les bâtiments n’ont pas de noms dans cette source : le dossier ne leur attribue pas ceux de points d’intérêt voisins.

L’horizon déjà présent dans le fichier source est également conservé : 10 repères, 201 empreintes détaillées, 3 898 boîtes de simplification, 314 voies et un sommet annoté. Ces simplifications restent des données historiques, sans création de nouveaux volumes de rendu. Elles ne remplacent pas la ville complète d’EMPRISE. Notre-Dame-de-la-Garde est hors de la grille altimétrique archivée ; l’annotation source de son sommet à 144 m conserve un datum non confirmé et ne devient pas un point de contrôle du MNT.

### Hauteurs et couches qui ne sont pas des altitudes

`hauteur` et `base` du bâti sont les attributs relatifs `render_height` et `render_min_height` d’OpenMapTiles. Ils ne représentent pas le niveau absolu du pied du bâtiment. Les 4 194 empreintes sans indicateur `connue` gardent leurs valeurs de fournisseur ; le paquet ne les transforme pas en mesures. Les cinq objets `contour` sont également conservés comme tels.

Le complément **`src/core-heights.js` n’est pas inclus**. C’est pourquoi les 4 122 hauteurs renseignées mentionnées dans la notice [WORLD.md](sources/emprise-WORLD.md), après enrichissement IGN d’EMPRISE, ne sont pas le compte du cœur brut ici archivé. Les cellules de toute la ville et les générateurs de côte, de relief synthétique ou de bâtiments ne sont pas copiés.

Les voies du fichier source excluent les tunnels et souterrains. Un `pont=false` ou une couche zéro ne suffit pas à établir une connexion sûre entre deux chaussées. Les deux espaces de type quai, l’espace de type pont et les huit jetées sont indexés séparément, avec altitude et raccords inconnus. Largeurs utiles, profils longitudinaux/transversaux, dévers, tabliers, escaliers et continuité roulable restent à mesurer ou à sourcer.

## Grille IGN : échantillonnage et limites

La réponse archivée a été acquise le **19 novembre 2026 à 20:27:06 UTC**, ressource `ign_lidar_hd_mnt_mono_wld` du [service altimétrique de la Géoplateforme](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/calcul-altimetrique/). La date d’acquisition du fichier n’est pas la date du vol LiDAR.

| Propriété | Valeur observée ou statut |
|---|---|
| Dimensions | 65 × 65 = 4 225 points |
| Coordonnées | Longitude 5,3658 à 5,3810° ; latitude 43,2906 à 43,3018° |
| Pas de la requête | 0,0002375° en longitude ; 0,000175° en latitude |
| Pas dans le repère local | **19,272696 m est ; 19,442239 m nord** |
| Pas annoncé de la ressource amont | **0,50 m**, distinct du pas de notre acquisition |
| Altitudes API | −3,77 à 41,74 m ; 14 valeurs négatives conservées |
| Valeur absente API | −99 999 ; aucune occurrence dans cette réponse |
| Champ `acc` de la grille | `Average value` sur les 4 225 points ; aucune erreur numérique fournie |
| Date du vol, dalle, précision verticale locale | Inconnues |
| Datum individuel confirmé dans la réponse | Inconnu |

Les points sont ordonnés du sud au nord, et d’ouest en est dans chaque ligne. Le script contrôle cette correspondance avec les paramètres de requête archivés. Il conserve l’altitude API sans offset, lissage ou interpolation supplémentaire. `altitude_api_m` est distinct du champ horizontal `z`. Une future valeur absente serait représentée par `null`, jamais transformée en niveau zéro.

Le changement de repère horizontal utilise les rayons de courbure de l’ellipsoïde WGS84 à l’origine commune : `x = (lon−lon0) × kx`, `z = −(lat−lat0) × kz`. Les facteurs exacts employés sont livrés dans `grille.json`. L’emprise obtenue est environ ±616,726 m en X et ±622,152 m en Z. Les axes, l’origine et l’échelle locale suivent la déclaration de la source EMPRISE ; aucun calage sur des points topographiques indépendants n’a été effectué.

Le [descriptif IGN, révision juillet 2026](https://data.geopf.fr/annexes/ressources/documentation/DC_LiDAR_HD_1-0.pdf), page 7, donne **IGN 1969, altitude normale, EPSG:5720** pour les produits continentaux. C’est le datum attendu du produit ; la réponse API ne le certifie pas individuellement. Pages 36–37, le document explique que le MNT dérive de points sélectionnés et d’une interpolation triangulaire. Une altitude MNT n’est donc pas un retour laser direct, et ce terrain ne fournit pas automatiquement un tablier de pont. L’empreinte du PDF consulté est consignée dans `sources.json` ; le PDF n’est pas recopié.

**Incohérence de couverture à résoudre :** le descriptif de ressource acquis annonce une limite sud à 45,8767° N, au nord de Marseille. Les 4 225 valeurs reçues sont donc hors de sa bbox annoncée. La cause n’est pas établie. Les réponses sont conservées et utilisables pour la reconnaissance, mais cette contradiction empêche de présenter la couverture et la provenance locale comme pleinement qualifiées. Il faut vérifier les dalles, leur date et leur référence avant de clore 15B.

Le diagnostic de trois points avec `measures=true` reste séparé de la grille, demandée avec `measures=false`. Son libellé « Pas de 50 cm » ne prouve ni une précision verticale de 50 cm, ni la provenance détaillée de chaque point de la grille. L’arrondi au centimètre de l’API n’est pas non plus une précision de mesure. Les valeurs négatives ne sont interprétées ni comme une bathymétrie ni comme le niveau de la mer.

## Reproduction et contrôles

Depuis la racine du dépôt, avec Node sans dépendance supplémentaire :

```sh
node tools/preparer-marseille-15ab.mjs --check
node verifications/marseille-sources.test.mjs
```

Pour régénérer les quatre JSON dérivés :

```sh
node tools/preparer-marseille-15ab.mjs
```

Le script ne fait aucun accès réseau et ne modifie jamais les acquisitions. Il vérifie tailles, SHA-256 et blobs Git, puis exécute le décodeur exact dans un contexte sans API disque/réseau. `--check` compare les sorties à l’octet. Les tests confrontent l’ensemble des géométries à un décodage indépendant, contrôlent anneaux/trous, points et ordre de requête, rejettent une altération, maintiennent les altitudes négatives et vérifient les inconnues des niveaux urbains.

Qualification locale de ce paquet le 19 novembre 2026 : **7 tests réussis sur 7**, Node 24.22.3 ; les quatre fichiers régénérés sont identiques à l’octet. Cette vérification documentaire n’exécute ni build du jeu ni validation visuelle ou physique d’un parcours.

La requête API reste disponible pour une acquisition ultérieure volontaire. Son mode HTTP d’origine n’a pas été enregistré ; le manifeste propose une répétition POST compatible avec la documentation, sans prétendre reconstituer ce détail absent ni garantir une réponse future identique.

## Attributions et suite

**Géographie :** © les contributeurs d’OpenStreetMap, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) ; tuiles OpenFreeMap, schéma OpenMapTiles. Conserver cette attribution et les obligations de la licence lors de la redistribution de la base ou de ses dérivés. La notice d’origine reste dans le fichier source et dans les données décodées.

**Altimétrie :** © IGN, MNT LiDAR HD et service de la Géoplateforme, acquisition du 19 novembre 2026 ; [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/), confirmée par la [fiche IGN du produit](https://www.data.gouv.fr/datasets/mnt-lidar-hd). Mentionner la source et la date d’acquisition ; ne pas attribuer à l’IGN une validation du parcours ou des transformations ultérieures.

Le code de préparation appartient au projet BITUME ; les notices et le décodeur copiés gardent leur provenance EMPRISE. Aucun code de triangulation Earcut, image, modèle ou texture n’est ajouté ici.

Avant un circuit jouable : sélectionner un corridor continu sur les voies réellement présentes, établir ses largeurs et niveaux, résoudre les références locales du MNT, densifier près des chaussées et qualifier les ruptures de quais/ponts. Ensuite seulement pourront être construits le profil, les fondations, les surfaces visibles et les surfaces physiques communes. Ce dossier conserve les sources nécessaires sans anticiper ces validations.
