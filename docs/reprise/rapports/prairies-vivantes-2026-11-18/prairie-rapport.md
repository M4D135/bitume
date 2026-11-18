# Lot 09 — prairie, implantation finale

**Sources gelées et qualifiées.** Base comparée : BITUME 0.2.31 (`ff40baa`). `vegetation-final.log` contient les 16 contrôles réussis, répétés après gel ; `densites-final.json` couvre les 15 combinaisons de densité et de biome. Les SHA-256 figurent dans `prairie-sourcehashes.json` et concordent exactement avec les trois bancs finaux.

## Implantation et ancrage

Les brins couvrent les triangles réellement herbeux des accotements et du terrain, après retrait de la chaussée, des stands, du tunnel, des rochers, des objets solides, de l’eau et des couches de sol supérieures. Les teintes alternées tous les 20 m sont remplacées par un bruit doux déterministe aux paliers supérieurs. Les hauteurs, tons, orientations et motifs varient sans consommer le hasard de la simulation. Low et Off sont préservés. `decor.surfaceHerbe(x, z, sortie?)` reste disponible en Off pour la faune.

Un maillage triangulaire partagé épouse chaque triangle grâce à sa rotation et à `groundShear`. Les pieds locaux restent exactement à y = −0,5 ; leur erreur verticale réelle maximale est 5,00001 mm, correspondant à l’enfouissement volontaire de 5 mm. Les contrôles indépendants du sol portent sur chaque instance MAX des trois circuits. Tous les sommets de chaque brin restent dans la même cellule GPU 32 × 32.

## Quantité réelle et densité locale

Les disques de rayon 2 m sont aux mêmes positions que dans la référence immuable 0.2.31, de part et d’autre de cinq abscisses fixes. Les brins sont déduits des maillages construits et leurs racines sont transformées réellement. Le total étend aussi la surface : la preuve locale ci-dessous est donc distincte.

| Circuit | Brins MAX | × total depuis 0.2.31 | × local minimal | Densité locale minimale | Surface admissible plantée |
|---|---:|---:|---:|---:|---:|
| foret | 163 010 460 | 226.17 | 14.87 | 242.55/m² | 8.227 km² |
| cote | 129 057 608 | 215.16 | 14.71 | 244.38/m² | 5.283 km² |
| montagne | 167 320 367 | 194.46 | 14.18 | 239.93/m² | 2.895 km² |

Couverture géométrique de la surface admissible : au moins 99.99999178 %. Il s’agit de triangles recevant une plantation  pas d’une promesse de couverture opaque à chaque pixel. 28 disques et 278 972 ancrages d’instances sont contrôlés.

`empreinte-racines-031-max.png` compare les positions réelles sur une même fenêtre de 40 × 70 m. Son détail de 2 × 2 m contient 62 puis 1 960 racines (×31,61). C’est une carte de données, pas une capture du jeu.

## Coût mesuré et limites

Une seule variante par lot et 2 familles de taille pour Medium/High, 4 pour MAX. Les secteurs proches mesurent 24 m (Medium/High) ou 16 m (MAX), les secteurs de campagne 64 m. Aucune boucle CPU par brin à chaque image. Le moteur fait décroître la couverture, conserve exactement 1/8 des brins lointains, puis fond vers le sol avant de couper les secteurs. Les bornes incluent le cisaillement et une marge de 0,25 + 2,3 × hauteur.

Banc final : forêt, FOV 60°, 960 × 540, herbe seule, somme couleur + ombre. Les triangles soumis incluent ceux ensuite éteints dans le shader. Les temps sont ceux du CPU avec WebGL inerte, sans rasterisation GPU.

| Palier | Triangles soumis (3 vues) | Appels (3 vues) | CPU médian inerte | Buffers d’instances | RSS max du banc |
|---|---:|---:|---:|---:|---:|
| medium | 0.183–0.234 M | 146–161 | 3.23–3.48 ms | 11.23 Mo | 588.2 Mio |
| high | 0.692–0.964 M | 242–285 | 3.71–4.05 ms | 11.25 Mo | 586.5 Mio |
| ultra | 34.194–35.371 M | 775–1330 | 6.21–6.33 ms | 13.07 Mo | 612.4 Mio |

Le MAX est nettement plus coûteux que la 0.2.31 : la dernière réduction descend d’environ 60 M à 34–35 M triangles soumis, mais ce niveau doit rester manuel. Les petits secteurs réduisent les triangles et augmentent les appels. La RAM indiquée appartient au processus du banc complet ; elle ne mesure pas la VRAM ni la consommation finale d’un navigateur. Aucun FPS matériel ni rendu final du jeu n’a été qualifié ici.

## Fichiers livrés

`src/vegetation.js`, `src/decor.js`, `verifications/vegetation.test.mjs`, `verifications/fixtures/herbe-031.json`, `tools/budget-herbe.mjs`, `tools/budget-decor.mjs`. Aucun asset ajouté au jeu, aucune modification de version, build ou référence Git par ce sous-lot. Le rapport JSON donne tous les comptes par palier, les disques, les erreurs de sol et les empreintes.
