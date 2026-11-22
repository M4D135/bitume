# Pietraporzio, dix-huit emprises autour de la SS21

L’extrait du 22 novembre 2026 contient les 114 édifices et les 156 unités volumétriques de l’emprise WFS, ainsi que les sept tronçons de voirie portant le nom « SS21 DELLA MADDALENA ». Les coordonnées originales, les identifiants, les producteurs, les échelles et les dates figurent dans le fichier versionné. Chaque couche conserve sa requête WFS et le SHA-256 de la réponse complète. Le jeu embarque uniquement les données dérivées des huit emprises retenues. Il peut les afficher hors ligne. [Extrait régional](sources/bdtre-pietraporzio.json)

BDTRE de Regione Piemonte, avec la contribution de CSI Piemonte. Les enregistrements individuels précisent leur producteur. Les données régionales sont diffusées sous CC BY 4.0. BITUME extrait, sélectionne, projette, triangule et extrude ces empreintes. L’axe de référence du jeu est celui de son relevé OpenStreetMap préexistant, attribué séparément. [Portail officiel BDTRE](https://igr.piemonte.it/scheda-informativa/bdtre-base-cartografica-riferimento) · [Fiche du bâti](https://www.geoportale.piemonte.it/geonetwork/srv/api/records/r_piemon:60d6c1da-d68c-44f4-ba0f-350ea3bdeb41/formatters/xml) · [Licence Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) · [Provenance du tracé](README.md)

## Position sur la route jouée

La projection utilise les mètres de l’UTM 32 N (EPSG:32632). L’origine du tracé OSM est E = 332 705,811 m et N = 4 920 874,595 m. Dans la scène, X croît vers l’est et Z vers le sud. Le lissage des épingles accumule en amont un décalage d’environ 522 m à Pietraporzio. Une même translation locale de −19,043 m en X et +521,545 m en Z relie les 24 points OSM du secteur km 17,9–18,5 à leur chaînage dans le jeu. L’écart quadratique moyen vaut 0,803 m et l’écart maximal 1,546 m. Les 151 points contrôlés sur l’axe routier régional fournissent une comparaison indépendante, avec un écart médian de 2,71 m, un 90e centile de 6,56 m et un maximum de 7,80 m. La translation conserve les polygones et les distances mutuelles du bâti. Elle s’applique seulement dans ce secteur.

Le premier rang retient huit bâtiments. La sélection exige un édifice construit, une unité au sol portant une valeur d’« altezza » et les mêmes sommets d’emprise dans les deux couches. Pour ce premier rang, la façade doit se trouver à moins de 35 m de l’axe joué et à au moins 1,20 m au-delà de la limite latérale de chaque segment voisin. Cinq emprises plus proches ont été omises. Trois coupent le bitume large de 11 m (4,2 à 4,7 m de l’axe). La centrale électrique à 6,7 m et une habitation à 8,7 m ne laissent pas la réserve prévue autour de la glissière. Les bâtiments dépourvus de hauteur ou comportant plusieurs unités différentes restent dans l’extrait source.

| Usage de la BDTRE | Chaînage du centre dans le jeu | Distance minimale à l’axe | Hauteur d’extrusion |
| --- | ---: | ---: | ---: |
| Hébergement | 17 996 m | 13,85 m | 6 m |
| Service public | 18 040 m | 22,75 m | 8 m |
| Mairie | 18 092 m | 20,64 m | 11 m |
| Commerce | 18 120 m | 15,24 m | 6 m |
| Habitation | 18 176 m | 21,62 m | 8 m |
| Habitation | 18 244 m | 18,86 m | 5 m |
| Résidentiel | 18 264 m | 9,69 m | 10 m |
| Usage inconnu | 18 440 m | 10,22 m | 3 m |

## Volumes du premier rang

L’attribut régional UN_VOL_AV donne une hauteur d’extrusion. BITUME l’applique au faîtage au-dessus du niveau médian du sol joué sous les sommets de l’emprise. L’altitude de ce sol transforme aussi la fondation afin qu’elle reste enterrée. Les hauteurs de gouttière, la direction du faîtage, les versants de toit, menuiseries, matériaux et couleurs sont interprétés. L’enveloppe conserve les décrochements cadastraux et la hauteur globale régionale. Aucun relevé de façade, photographie ou plan cadastral tiers n’a servi de texture. [Spécification régionale, classe Unità volumetrica](https://geoportale.igr.piemonte.it/cms/images/bdtre_doc/Specifica_NC_221.pdf)

Pour les huit emprises, les triangles de façade, de pignon et de couverture sont communs au rendu et à la collision PhysX. Le masque d’herbier suit la triangulation concave de chaque emprise. Les trois parties de la silhouette sont présentes à distance et en qualité légère. Le profil fin ajoute les menuiseries des façades dirigées vers la voie.

À la racine du dépôt, `python3 tools/preparer-pietraporzio.py --check` reproduit le recalage et la sélection à partir des deux sources versionnées et de l’axe effectivement construit par le jeu. `node --test verifications/pietraporzio-bdtre.test.mjs` contrôle les dimensions régionales, les deux qualités, l’hiver, les masques et les collisions natives dans le WASM, y compris les rayons de dégagement sur les deux bordures de la SS21.

## Deuxième rang autour de la SS21

La recherche sur la même archive régionale livre 22 empreintes entre 35 et 65 m de l’axe. Les dix implantations ci-dessous tiennent sur le relief dessiné. Les deux couches régionales concordent sommet par sommet et fournissent une seule hauteur d’extrusion au sol pour chaque édifice. Les contrôles de chaussée et de glissière utilisent tous les segments proches du polygone. Les références individuelles EDIFC et UN_VOL restent dans les données embarquées. [Source archivée et attribution CC BY 4.0](sources/bdtre-pietraporzio.json)

| Chaînage | Usage BDTRE | Distance minimale à l’axe | Hauteur BDTRE |
|---:|---|---:|---:|
| 17 928 m | Résidentiel | 41,056 m | 6 m |
| 18 024 m | Centrale électrique | 41,480 m | 3 m |
| 18 108 m | Habitation | 49,815 m | 6 m |
| 18 120 m | Résidentiel | 56,046 m | 7 m |
| 18 124 m | Habitation | 38,494 m | 5 m |
| 18 160 m | Habitation | 39,197 m | 9 m |
| 18 168 m | Habitation | 41,895 m | 9 m |
| 18 180 m | Résidentiel et commercial | 46,904 m | 9 m |
| 18 240 m | Habitation | 38,041 m | 7 m |
| 18 252 m | Habitation | 39,268 m | 8 m |

Les coordonnées horizontales, les hauteurs et les usages proviennent de la BDTRE. L’outil d’extraction détermine le socle sur le terrain de conduite aux sommets, aux milieux des arêtes et au centre des triangles de chaque emprise. Le faîtage utilise le sol médian aux sommets. Douze emprises sont écartées lorsque le dénivelé sous le bâtiment dépasse 65 % de sa hauteur ou que le point le plus haut du sol dépasse de plus de 45 % de cette hauteur le niveau médian. Ces seuils d’intégration évitent d’enterrer le toit ou d’exposer une fondation disproportionnée. La direction et la pente des toits, le toit bas de la petite centrale, le crépi et les pigments sont des interprétations régionales.

Les dix volumes sont répartis sur quatre îlots par tranche d’abscisse de 100 m. Chaque îlot réunit les façades et pignons dans un maillage et les toits dans un autre. Leurs 91 sommets d’emprise donnent au total 513 triangles opaques et huit surfaces de rendu pour l’ensemble du deuxième rang. Les fenêtres, portes et volets détaillés restent sur les bâtiments du premier rang. Les deux qualités de décor partagent la géométrie des îlots, dont la couverture change de matériau en hiver. PhysX reçoit les triangles des volumes. Les masques de sol et la végétation utilisent les contours de chaque parcelle bâtie, y compris les décrochements. Le bourg procédural de Pietraporzio est remplacé au même point de construction.

La génération géométrique hors ligne a produit cet inventaire. La qualité à hauteur de pilote, les ombres, la cadence et les collisions en conduite restent à recevoir. Si le terrain de Larche évolue, relancer le générateur pour recalculer les socles des îlots.
