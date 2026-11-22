# Pietraporzio, huit emprises autour de la SS21

L’extrait du 22 novembre 2026 contient les 114 édifices et les 156 unités volumétriques de l’emprise WFS, ainsi que les sept tronçons de voirie portant le nom « SS21 DELLA MADDALENA ». Les coordonnées originales, les identifiants, les producteurs, les échelles et les dates figurent dans le fichier versionné. Chaque couche conserve sa requête WFS et le SHA-256 de la réponse complète. Le jeu embarque uniquement les données dérivées des huit emprises retenues. Il peut les afficher hors ligne. [Extrait régional](sources/bdtre-pietraporzio.json)

BDTRE de Regione Piemonte, avec la contribution de CSI Piemonte. Les enregistrements individuels précisent leur producteur. Les données régionales sont diffusées sous CC BY 4.0. BITUME extrait, sélectionne, projette, triangule et extrude ces empreintes. L’axe de référence du jeu est celui de son relevé OpenStreetMap préexistant, attribué séparément. [Portail officiel BDTRE](https://igr.piemonte.it/scheda-informativa/bdtre-base-cartografica-riferimento) · [Fiche du bâti](https://www.geoportale.piemonte.it/geonetwork/srv/api/records/r_piemon:60d6c1da-d68c-44f4-ba0f-350ea3bdeb41/formatters/xml) · [Licence Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) · [Provenance du tracé](README.md)

## Position sur la route jouée

La projection utilise les mètres de l’UTM 32 N (EPSG:32632). L’origine du tracé OSM est E = 332 705,811 m et N = 4 920 874,595 m. Dans la scène, X croît vers l’est et Z vers le sud. Le lissage des épingles accumule en amont un décalage d’environ 522 m à Pietraporzio. Une même translation locale de −19,043 m en X et +521,545 m en Z relie les 24 points OSM du secteur km 17,9–18,5 à leur chaînage dans le jeu. L’écart quadratique moyen vaut 0,803 m et l’écart maximal 1,546 m. Les 151 points contrôlés sur l’axe routier régional fournissent une comparaison indépendante, avec un écart médian de 2,71 m, un 90e centile de 6,56 m et un maximum de 7,80 m. La translation conserve les polygones et les distances mutuelles du bâti. Elle s’applique seulement dans ce secteur.

La sélection exige un édifice construit, une unité au sol portant une valeur d’« altezza » et les mêmes sommets d’emprise dans les deux couches. La façade doit se trouver à moins de 35 m de l’axe joué et à au moins 1,20 m au-delà de la limite latérale de chaque segment voisin. Cinq emprises plus proches ont été omises. Trois coupent le bitume large de 11 m (4,2 à 4,7 m de l’axe). La centrale électrique à 6,7 m et une habitation à 8,7 m ne laissent pas la réserve prévue autour de la glissière. Les bâtiments dépourvus de hauteur ou comportant plusieurs unités différentes restent dans l’extrait source.

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

## Volumes, toitures et collisions

L’attribut régional UN_VOL_AV donne une hauteur d’extrusion. BITUME l’applique au faîtage au-dessus du niveau médian du sol joué sous les sommets de l’emprise. L’altitude de ce sol transforme aussi la fondation afin qu’elle reste enterrée. Les hauteurs de gouttière, la direction du faîtage, les versants de toit, menuiseries, matériaux et couleurs sont interprétés. L’enveloppe conserve les décrochements cadastraux et la hauteur globale régionale. Aucun relevé de façade, photographie ou plan cadastral tiers n’a servi de texture. [Spécification régionale, classe Unità volumetrica](https://geoportale.igr.piemonte.it/cms/images/bdtre_doc/Specifica_NC_221.pdf)

Pour les huit emprises, les triangles de façade, de pignon et de couverture sont communs au rendu et à la collision PhysX. Le masque d’herbier suit la triangulation concave de chaque emprise. Les trois parties de la silhouette sont présentes à distance et en qualité légère. Le profil fin ajoute les menuiseries des façades dirigées vers la voie.

À la racine du dépôt, `python3 tools/preparer-pietraporzio.py --check` reproduit le recalage et la sélection à partir des deux sources versionnées et de l’axe effectivement construit par le jeu. `node --test verifications/pietraporzio-bdtre.test.mjs` contrôle les dimensions régionales, les deux qualités, l’hiver, les masques et les collisions natives dans le WASM, y compris les rayons de dégagement sur les deux bordures de la SS21.
