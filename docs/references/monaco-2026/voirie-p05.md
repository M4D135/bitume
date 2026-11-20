# Monaco — axes de voirie et portails candidats (P05)

Reproduction hors réseau ; aucune cote ni limite de piste remplie.

5 captures, 47 observations d’axes routiers et 9 axes de galerie. 56 points examinés, dont 49 prioritaires. 56 ont un candidat en plan.

Les Z interpolés sont des calculs sur les axes sources, sans identification de la voie de course. Les précisions annoncées décrivent la source, pas une borne garantie. Date de mesure et datum individuels restent inconnus. Largeur indicative ≠ limites FIA ; dévers inconnu.

## Transitions OSM et extrémité de galerie la plus proche

| Point OSM | Objet BD TOPO candidat | Sommet | Distance en plan calculée (m) | Z source (m) |
|---|---|---:|---:|---:|
| 206 | CONSLINE0000002150237308 | 5 | 51.779 | 17.6 |
| 211 | CONSLINE0000002150237308 | 5 | 56.705 | 17.6 |
| 219 | CONSLINE0000002150241393 | 27 | 8.723 | 9.5 |
| 245 | CONSLINE0000002150241393 | 0 | 4.449 | 6.9 |

La proximité ne sélectionne aucun portail. Les extrémités de galerie décrites par la classe BD TOPO doivent encore être confrontées au parcours et à ses niveaux. Une absence d’objet Tunnel ne prouve pas une absence de couvert sous dalle/bâtiment.

2 correspondances géométriques exactes entre classes sont conservées : elles ne sont pas des mesures indépendantes.

## Variations des axes sources à examiner

Le seuil de variation verticale / distance horizontale de 0,35 sert uniquement au tri. La cause des variations reste inconnue ; elles ne deviennent pas des pentes de chaussée.

| Objet source | Segment | Distance horizontale (m) | Variation Z source (m) |
|---|---:|---:|---:|
| TRONROUT0000000074271878 | 5 | 1.304 | 1.000 |
| TRONROUT0000000074274447 | 0 | 2.765 | 6.600 |
| CONSLINE0000002150241393 | 0 | 2.765 | 6.600 |

## Inconnus conservés

415 altitudes, 415 largeurs gauches, 415 largeurs droites et 415 dévers restent null. Longueur OSM conservée : 3323.609508 m, sans remise à l’échelle. Monaco reste non jouable.

Registre complet, localisateurs, coordonnées, calculs et empreintes : [voirie-p05.json](voirie-p05.json).
Reçu des sources : [sources-voirie-p05.json](sources-voirie-p05.json).

Attribution : IGN, Licence Ouverte 2.0 ; © les contributeurs OpenStreetMap, ODbL 1.0.
