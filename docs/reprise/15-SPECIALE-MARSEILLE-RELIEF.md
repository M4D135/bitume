# Lot 15 — Spéciale Marseille, carte EMPRISE et relief

Date : **18 novembre 2026**. Statut : **plan à exécuter ; aucun portage réalisé**.
Demandes explicites de David : ajouter la **Spéciale Marseille** au catalogue BITUME, reprendre la carte de **notre jeu EMPRISE**, et **ajouter du relief**.

## 1. Source vérifiée et version à reprendre

- Dépôt : **[M4D135/emprise](https://github.com/M4D135/emprise)**, branche `main`.
- Commit examiné : **`cc004826a506e6979eaaec217748fe85d5cd6ac5`**.
- Version du code : **0.6.8** dans `VERSION.json` ; le README mentionne encore 0.6.4, donc ne pas s’appuyer sur ce dernier pour dater les données.
- Lire d’abord `docs/WORLD.md`, `docs/ASSETS.md`, `docs/LANDMARKS.md`, puis les modules nécessaires. Aucun `AGENTS.md` n’a été trouvé dans l’arbre source examiné ; revérifier au prochain HEAD.
- Le dossier `src/pdr/` conserve une filiation avec Point de rupture. **La source demandée aujourd’hui est EMPRISE** : prendre ces fichiers dans ce dépôt au commit choisi, pas dans une ancienne copie de Point de rupture.

Les documents du commit source indiquent une couverture communale de **237,818 km²**, un cœur détaillé autour du Vieux-Port d’environ **1,1 × 1,1 km**, puis des cellules extérieures de **512 m**. Les façades sont générées et ne sont pas un relevé architectural exact de tous les immeubles.

## 2. Ce qui existe et ce qui manque

| Élément | État observé dans EMPRISE | Conséquence pour BITUME |
|---|---|---|
| Vieux-Port | Cœur cartographique, rues, empreintes bâties, eaux, places, mobilier et repères. | Base réelle à réutiliser, après extraction d’un parcours. |
| Centre | Sol du cœur constant à `y = 0.08` ; pas de MNT mesuré. | Le relief demandé doit effectivement modifier les altitudes jouables. |
| Bonne-Mère, îles, Calanques | Relief synthétique déjà présent. | Préserver les repères ; raccorder ou remplacer les reliefs approximatifs avec une source altimétrique cohérente. |
| Hauteurs IGN | Hauteurs de bâtiments complétées et métadonnées de sol. | Une hauteur de bâtiment ou un `groundAltitude` isolé ne remplace pas un terrain continu. |
| Routes | Adaptation possible à `groundAt` ; largeurs par classes de voie. | Vérifier largeur réelle, chaussée utile et raccords avant d’en faire une piste de course. |
| Ponts / tunnels | Représentation simplifiée. | Traiter chaque niveau explicitement ; aucune projection automatique sur le sol inférieur. |
| Monde complet | Ville, intérieurs, trafic, personnages, destruction et systèmes propres à EMPRISE. | Extraire le décor et les données nécessaires au parcours BITUME ; isoler les dépendances. |

**Résultat recherché :** une course urbaine dans Marseille avec des montées, descentes et perspectives cohérentes avec les lieux, des bâtiments correctement posés et des routes qui suivent le même relief que la physique. Une montagne ajoutée à l’horizon ou une pente arbitraire sur une ville toujours plate ne suffit pas.

## 3. Fichiers et fonctions à examiner

| Chemin dans EMPRISE | Usage prévu |
|---|---|
| `src/pdr/villes/marseille.js` | Données du cœur : 1 177 rues, 5 274 empreintes bâties, eaux et places, selon la source examinée. |
| `src/pdr/ville-reelle.js` | Génération procédurale du cœur urbain. |
| `src/city-data.js` | Données de ville extérieure ; environ 13,98 Mo dans la version examinée. |
| `src/city-stream.js` | Décodage, cellules, façades, routes, collisions ; `planRoad()` et adaptation à la hauteur du sol. |
| `src/coast-data.js`, `src/coast.js` | Côte, eaux, îles et terrain existant ; environ 3,99 Mo pour les données de côte. |
| `src/landmarks.js` | Bonne-Mère et sa colline synthétique ; interpolation de hauteur associée. |
| `src/world.js::ground()` | Contrat de hauteur actuel, dont le cœur plat. |
| `src/core-heights.js` | Compléments de hauteurs du bâti, à conserver comme tels. |
| `tools/prepare-city.py`, `tools/prepare-coast.py` | Extraction et compilation des données ; vérifier les dépendances Shapely du commit choisi. |
| `tools/core-heights.py`, `tools/city-heights.py` | Provenance et correspondances des hauteurs IGN de bâtiments. |
| `tests/city-road-terrain.mjs`, `tests/landmarks.mjs`, `tests/coast.mjs` | Références de contrôles utiles, à adapter au parcours et aux voitures BITUME. |

Le repère source est centré sur **43,2962° N / 5,3734° E**, avec **X vers l’est, Z vers le sud, Y vers le haut**. Conserver un transformateur explicite si BITUME utilise un autre repère local ; contrôler position, sens de parcours, normales et orientation de la mer après conversion.

Les générateurs source peuvent utiliser `RADE`, `PDR`, `BITUME.carene`, `BITUME.voiture` et `FRender.forme`. Recenser les dépendances par module et construire un adaptateur de décor limité ; ne pas embarquer des états FPS dans la simulation de course.

## 4. Définir la Spéciale avant de porter toute la ville

1. Inspecter la carte EMPRISE dans son état réel et identifier plusieurs corridors de rues continus et roulables.
2. Comparer visibilité, largeur disponible, croisements, pente, points reconnaissables, raccords et possibilités de départ.
3. Choisir un parcours fermé compatible avec les courses à tours de BITUME pour la première livraison. Le nom « Spéciale Marseille » n’active pas implicitement un nouveau mode de rallye de point à point ; celui-ci demanderait un lot de règles de course distinct.
4. Figer une ligne centrale, les bords, les barrières temporaires, la grille, le sens, les secteurs et les stands. La carte de la ville ne définit pas automatiquement ces éléments.
5. Découper un corridor de course et son horizon utile. Conserver la silhouette des grands repères visibles sans charger systématiquement l’ensemble de la commune.

Le Vieux-Port constitue un point d’ancrage évident de la carte existante. Les extensions vers des rues plus pentues, la Bonne-Mère ou la côte sont des possibilités à étudier sur la géométrie disponible, pas des portions de course déjà choisies. Ne pas fabriquer de rues de liaison pour fermer la boucle ; sélectionner un autre trajet ou documenter explicitement toute adaptation de jeu.

**ID proposé :** `speciale-marseille`. Position prévue dans le catalogue : après Russie et Monaco, soit indice 9 si les sept circuits actuels restent les seules entrées antérieures. Relever les IDs présents au moment de l’intégration et ajouter sans réordonner.

## 5. Terrain altimétrique : source et préparation

### 5.1 Acquisition hors ligne

- Rechercher le MNT IGN disponible et approprié à l’emprise : **RGE ALTI** ou produit MNT issu du **LiDAR HD** plus récent si sa couverture et ses métadonnées le justifient.
- Examiner date, résolution, qualité, système horizontal et référence verticale avant de choisir. La fiche officielle consultée décrit RGE ALTI aux pas de 1 m et 5 m ; une maille de 1 m ne prouve pas une exactitude centimétrique.
- Choisir un **modèle de terrain**, pas une surface qui inclut toits et cimes d’arbres. Une toiture ne doit pas devenir une bosse de chaussée.
- Conserver le fichier source ou une extraction reproductible, son empreinte, les métadonnées et les commandes de transformation. Les acquisitions se font pendant la préparation, sans appel altimétrique pendant une course.
- Identifier les zones sans données. Les exclure du trajet ou les traiter à partir d’une source exploitable et signalée ; une valeur absente ne devient jamais arbitrairement zéro.

### 5.2 Transformation

- Reprojeter dans le repère métrique choisi et appliquer une origine verticale commune au terrain, à la mer et aux bâtiments.
- Conserver séparément, dès l’extraction, la hauteur relative du bâtiment, l’altitude éventuelle de son pied et l’altitude du MNT, avec leur provenance et leur signification. Ne pas additionner deux altitudes absolues ni interpréter une hauteur de façade comme un sol.
- Éviter le mélange de hauteurs ellipsoïdales et d’altitudes de nivellement ; consigner la conversion lorsqu’elle est nécessaire.
- Découper des tuiles déterministes autour de la piste, avec marges communes suffisantes pour un raccord continu.
- Conserver une résolution utile près de la chaussée ; simplifier le relief lointain avec une erreur mesurée et des raccords sans fissures.
- Préserver le littoral, les quais et leurs niveaux. La hauteur moyenne de la mer ne doit pas être obtenue en lissant la colline voisine.

## 6. Une même altitude pour le dessin et la conduite

Définir une fonction de référence du sol et une représentation de surface de voie. Le terrain visible et le sol utilisé par les voitures doivent partager la même interpolation ou une approximation dont l’erreur est bornée et contrôlée.

- **Routes :** profil longitudinal et transversal, raccords de pente et de dévers, accotements et trottoirs. Contrôler les crêtes et compressions avec les dimensions de la monoplace.
- **Bâtiments :** ancrage des empreintes, fondations et façades à leur altitude locale ; aucun immeuble flottant, enterré ou incliné arbitrairement avec une seule pente moyenne.
- **Objets :** barrières, arbres, mobilier, places et points d’apparition placés sur la surface qui leur appartient.
- **Collisions :** mêmes bords et niveaux que les éléments dessinés ; raccords solides, pas de mur invisible au changement de tuile.
- **Voies superposées :** identifiant de voie/couche et profil propre pour pont, tunnel, rampe ou rue proche ; ne pas choisir le sol par la seule proximité X/Z.
- **Replacements :** retrouver le bon point du parcours, la bonne voie et la bonne altitude, sans téléporter sur le quai inférieur ou dans un bâtiment voisin.
- **Eaux et reflets :** plan d’eau raccordé aux quais, silhouettes cohérentes ; conserver les vues de la ville et du port sans fuite de terrain sous la chaussée.

Les reliefs synthétiques d’EMPRISE, notamment la colline de la Bonne-Mère, doivent être comparés au terrain retenu. Les repères s’ancrent sur le terrain cohérent ; ne pas superposer une seconde colline à celle du MNT.

## 7. Adaptation à BITUME et FERRO

L’EMPRISE examiné porte un verrou **FERRO 0.3.3**, tandis que BITUME utilise **0.3.9**. Réutiliser les données et recettes utiles, puis adapter leurs interfaces au moteur BITUME. **Ne pas remplacer son moteur par une ancienne copie EMPRISE.** Tout besoin commun nouveau passe par FERRO canonique et une propagation qualifiée.

Réemployer, une fois validée, l’infrastructure de tracé explicite, limites variables, voies et stands préparée pour Monaco. Les circuits originaux à graine conservent leur génération antérieure.

La Spéciale doit couvrir les fonctions habituelles : onze rivaux, chrono, démo avec FPS, météo/saisons choisies avant course, écran partagé, commandes manette, rétroviseurs et conditions de l’hôte en ligne. Définir explicitement la politique de neige de Marseille ; conserver la règle de Port-Sable et ne pas confondre météo réelle du joueur/hôte avec celle du lieu représenté.

Le contenu graphique reste procédural : géométrie générée à partir des données, matériaux et décor calculés. Les données géographiques et altimétriques compilées sont embarquées dans le HTML autonome ; aucun téléchargement de ville pendant la partie.

## 8. Lots et preuves attendues

| Lot | Contenu | Preuve pour clôturer |
|---|---|---|
| 15A — source et corridor | Figer le commit EMPRISE, cartographier les dépendances, choisir les rues du parcours et les repères. | Carte du trajet sur les données sources, continuité, largeur, points difficiles et manifeste de provenance. |
| 15B — relief mesuré | Préparer le MNT, repère, datum, extraction, interpolation et raccords. | Rapport des points altimétriques, profils, zones sans données, pentes et empreintes reproductibles. |
| 15C — ville sur terrain | Reposer routes, quais, bâti, objets et collisions sur le relief commun. | Coupes et captures terrain/chaussée/fondations, contrôles de toutes les ruptures critiques. |
| 15D — course et IA | Raccorder tracé explicite, grille, secteurs, stands, pneus et replacements. | Onze rivaux terminent plusieurs tours, trois difficultés, conditions représentatives ; stagnations et replacements expliqués. |
| 15E — rendu et coût | Décor utile, silhouettes, lumière, rétros, qualité et ressources bornées. | Tour filmé et captures fixes, mesures CPU/GPU/p50/p95, stabilité des tuiles et collisions entre qualités. |
| 15F — livraison | Régression, double build, publication et contrôle du site selon l’accès disponible. | Sources/tests/build distants, reçu, reprise courte et preuves de déploiement séparées. |

### Critères de réception spécifiques au relief

- Le profil possède les montées et descentes des données retenues ; publier les écarts aux points de contrôle avec l’incertitude source.
- Une route reste continue : aucun trou, marche artificielle, coin flottant ou cassure créée par une frontière de tuile.
- La hauteur des roues correspond à la surface visible ; le rayon de roue ne change pas pour dissimuler une erreur de terrain.
- Les constructions et protections des zones de course sont correctement ancrées sur tous leurs côtés critiques.
- La ville reste identique en plan : ajouter le relief ne déplace pas arbitrairement rues, port, quartiers ou repères.
- Une voiture en collision ou replacée garde une altitude et une voie valides ; un système de secours ne masque pas une pente impraticable.
- Une vue aérienne seule ne suffit pas : contrôler au niveau de la piste, en mouvement, en cockpit et dans les rétroviseurs.

## 9. Ressources, coûts et attributions

Extraire uniquement les données nécessaires au corridor et à l’horizon. Mesurer le coût des bâtiments, routes, eaux et terrain séparément ; instancier les éléments répétitifs, simplifier les façades éloignées et conserver un cache borné. Le jeu n’a pas de plafond artificiel de taille, mais le temps d’ouverture, la mémoire et le temps d’image restent des critères de livraison.

Conserver la provenance déjà documentée dans EMPRISE : **OpenStreetMap / OpenFreeMap / OpenMapTiles et ODbL**, compléments IGN et contour administratif sous **Licence Ouverte 2.0**, triangulation **Earcut sous ISC**. Le portage et ses données dérivées doivent conserver les attributions et éléments de licence applicables dans les documents et le produit distribués. Lire les textes source lors de l’extraction ; ne pas effacer ces informations en renommant un module.

## 10. Références pour reprendre sans recherche à l’aveugle

- [EMPRISE — WORLD.md au commit source](https://github.com/M4D135/emprise/blob/cc004826a506e6979eaaec217748fe85d5cd6ac5/docs/WORLD.md) : couverture, repère, limites de précision et relief actuel.
- [EMPRISE — ASSETS.md au commit source](https://github.com/M4D135/emprise/blob/cc004826a506e6979eaaec217748fe85d5cd6ac5/docs/ASSETS.md) : provenance et dépendances.
- [EMPRISE — LANDMARKS.md au commit source](https://github.com/M4D135/emprise/blob/cc004826a506e6979eaaec217748fe85d5cd6ac5/docs/LANDMARKS.md) : repères et relief synthétique.
- [IGN — fiche RGE ALTI](https://www.data.gouv.fr/datasets/rge-alti-r) : produit, métadonnées et licence ; examiner l’actualité locale des données avant acquisition.
- [IGN — service de calcul altimétrique](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/calcul-altimetrique/) : ressources et profils utilisables lors de la préparation ; respecter les limites annoncées du service.
- [Plan détaillé roues / Russie / Monaco](12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md) : contrats de roues, voies et réseau à partager.
- [Master liste et passation Claude Fable](../../MASTER-LISTE-CLAUDE-FABLE.md).

## 11. Checklist

- [x] Dépôt, commit, version et documents EMPRISE identifiés.
- [x] Absence de MNT mesuré dans le centre constatée et relief demandé inscrit au plan.
- [ ] 15A — corridor et dépendances.
- [ ] 15B — MNT et altitudes.
- [ ] 15C — routes, bâti et collisions raccordés.
- [ ] 15D — course complète et IA.
- [ ] 15E — visuel et performances.
- [ ] 15F — publication, qualification et reçu.
