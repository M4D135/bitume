# Monaco 14A — coupe à la sortie du boulevard Louis-II

L’axe IGN présente une chute de 6,60 m sur les 2,765 derniers mètres horizontaux de la galerie en sens de course. Les deux modèles de terrain consultés décrivent à cet endroit une transition entre la chaussée découverte et le dessus du couvert. Aucun des deux ne reproduit une variation de 6,60 m entre les mêmes points. La surface de roulement sous la dalle et sa cote 2026 restent à mesurer. [Comparaison des axes et raccords](LOUIS-II-20261122.md)

## Ce que montrent les trois premiers sommets

T0 est le raccord avec la rue extérieure, T1 son voisin immédiat côté galerie, T2 le sommet suivant. Le tableau suit l’ordre des sommets de la source, du quai vers le Portier. Les positions image sont exprimées en pixels depuis le bord supérieur gauche de l’orthophoto de 600 × 450 pixels.

| Sommet | Voirie IGN (m) | MNT LiDAR HD à l’axe (m) | RGE ALTI à l’axe (m) | Pixel de l’axe | Lecture visuelle de l’orthophoto |
|---|---:|---:|---:|---|---|
| T0 | 6,90 | 7,46 | 7,41 | (251,01 ; 181,39) | Chaussée découverte avant le bord de l’ouvrage |
| T1 | 13,50 | 8,19 | 7,38 | (268,42 ; 168,05) | Au voisinage immédiat du bord apparent de la dalle |
| T2 | 13,40 | 13,37 | 13,39 | (354,48 ; 133,13) | Projection sur le dessus de l’ouvrage |

À T1, cinq interrogations espacées sur une coupe transversale d’environ dix mètres donnent **13,50, 7,98, 8,19, 7,42 et 7,39 m** dans le MNT LiDAR. Aux mêmes positions, le RGE ALTI donne **7,38, 7,40, 7,38, 7,37 et 7,41 m**. La valeur de 13,50 m apparaît donc dans le voisinage latéral d’un terrain à environ 7,4 m. Elle ne démontre ni l’origine de la valeur BD TOPO ni la cote de l’asphalte. La précision planimétrique déclarée du tronçon BD TOPO est de 2,5 m, comparable à l’intervalle entre T0 et T1. [Orthophoto IGN figée](sources/portail-20261122/ortho.jpg) · [Neuf coupes et localisateurs des réponses](louis-ii-portail.json)

L’accord des deux MNT à T2 concerne une zone visuellement couverte. Plus loin sous l’ouvrage, à T3, ils donnent respectivement 13,85 et 33,33 m. Les calculs gardent séparés les deux produits, dont l’indépendance d’acquisition reste inconnue. Le RGE ALTI signale une source LiDAR topographique externe dans ce secteur. Le graphe BD ORTHO renvoie des vols du 26 juin et du 10 juillet 2023 sur l’emprise, avec une résolution déclarée de 20 cm. La date d’une prise précise à T1 reste indéterminée. [Graphe de mosaïquage](sources/portail-20261122/graphe.geojson) · [Requêtes et empreintes des acquisitions](sources-portail.json)

## Trois repères de nivellement à proximité

L’IGN attribue au sommet de la borne IM – 35-I une altitude normale de **7,500 m NGF-IGN 1969**. Sa localisation indicative se trouve à environ 61 m de T0, entre parapet et boulevard. Sa dernière observation indiquée date de 1968. Deux repères observés en 2008 sous l’hôtel, côté auditorium, sont cotés à **8,186 m** et **7,917 m**. Les deux fiches situent les marques 0,52 m au-dessus de leur sol local, sur des supports distincts. Pourtant, le WFS renvoie la même position indicative pour les deux. Ces repères renseignent le référentiel et l’ordre de grandeur de supports voisins. Aucun n’est situé sur les deux sommets de la chaussée. [Borne 525299](https://data.geopf.fr/annexes/geodesie/pt-nivf-525299.pdf) · [Pilier 526864](https://data.geopf.fr/annexes/geodesie/pt-nivf-526864.pdf) · [Escalier 526865](https://data.geopf.fr/annexes/geodesie/pt-nivf-526865.pdf)

Le plan d’urbanisme des quais nord donne dans sa légende des hauteurs d’ensembles bâtis. Les deux MNT rendent des surfaces différentes sous l’ouvrage. Le contrôle complémentaire à rechercher est une coupe topographique de la **surface roulable** de Louis-II traversant la limite du couvert, avec son rattachement vertical et sa date. Un nouveau contrôle d’accès direct au nuage COPC 1056_6304, le 22 novembre 2026, a rendu HTTP 403. [Plan de masse officiel de la Condamine, îlot 3](https://documents.gouv.mc/www/dpum/plans/condamine/PU-C2-CDN-Z2-I3-D2.pdf) · [Références LiDAR et dalles](REVUE-SOURCES-20261120.md)

## Vérification hors ligne

Les 45 positions sont dérivées des tronçons figés dans P05 et dans le dossier sur les raccords. Chaque série comporte cinq déports signés approximatifs (−5, −2, 0, +2, +5 m), perpendiculaires au même segment T0–T1. Deux séries portent sur l’approche extérieure et sept sur la galerie. Pour chaque position, le contrôle vérifie les coordonnées retournées et la mesure métropolitaine de chaque produit. La reproduction des requêtes POST utilise les latitudes et longitudes calculées par la fonction `stations`, jointes dans cet ordre par le caractère `|`, avec les paramètres conservés dans le manifeste.

```sh
python3 tools/qualifier-monaco-portail.py --check
node --test verifications/monaco-portail.test.mjs
```

Données de terrain, réseau de nivellement, BD TOPO et BD ORTHO © IGN. [Produits altimétriques de la Géoplateforme](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/calcul-altimetrique/) · [Fiche BD ORTHO et licence](https://www.data.gouv.fr/datasets/bd-ortho-r)
