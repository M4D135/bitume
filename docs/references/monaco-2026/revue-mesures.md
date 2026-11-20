# Monaco — revue des mesures de terrain

**Diagnostic de préparation : Monaco reste non jouable. Aucune cote routière ajoutée.**

La revue couvre les **32 écarts strictement supérieurs à 1 m**, les **33 points touchant un tag tunnel** et les **17 alertes de pente du terrain**.
Les écarts concernent 20 points tagués tunnel et 12 autres points ; 49 points distincts sont détaillés dans `revue-mesures.json`.

`sM` suit la reconnaissance OSM, depuis son origine propre ; ce ne sont pas des chaînages FIA. Les noms de virages sont des repères candidats.

## Groupes contigus d’écarts > 1 m

| Points (indices) | s début → fin (m) | Nombre | Maximum absolu (m) | Repères voisins du début |
|---|---:|---:|---:|---|
| 194 → 195 | 1347.164 → 1350.083 | 2 | 5.23 | T7 Mirabeau Bas → T8 Portier |
| 220 → 228 | 1524.065 → 1644.379 | 9 | 25.23 | T8 Portier → T9 Tunnel |
| 232 → 237 | 1708.240 → 1784.717 | 6 | 20.45 | T8 Portier → T9 Tunnel |
| 240 → 243 | 1822.445 → 1860.185 | 4 | 16.97 | T9 Tunnel → T10 Nouvelle Chicane, entree |
| 245 → 245 | 1878.564 → 1878.564 | 1 | 6.13 | T9 Tunnel → T10 Nouvelle Chicane, entree |
| 278 → 283 | 2286.178 → 2374.209 | 6 | 3.24 | T11 Nouvelle Chicane, sortie → T12 Tabac |
| 286 → 289 | 2382.341 → 2417.440 | 4 | 3.68 | T12 Tabac → T13 Piscine, premier gauche |

## Passages portant un tag tunnel

Les bornes ci-dessous sont des transitions de tags OSM, **pas des portails mesurés**. Leur précision et la hauteur libre restent inconnues.

| Arêtes | Longueur OSM (m) | Points d’entrée → sortie | Voies OSM |
|---|---:|---|---|
| 206 → 210 | 18.008 | 206 → 211 | 1470365907 |
| 219 → 244 | 361.823 | 219 → 245 | 4230891, 1230247123 |

Les intervalles sans tag sont conservés séparément. Ils ne sont pas fusionnés avec les passages couverts et ne prouvent pas une exposition à ciel ouvert.

- Arêtes 211 → 218 : 85.190 m.
- Arêtes 245 → 205 : 2858.588 m (passage par l’origine).

## Points avec écart > 1 m ou tag tunnel

| Index / nœud OSM | s (m) | LiDAR (m) | RGE (m) | LiDAR − RGE (m) | Tag tunnel |
|---|---:|---:|---:|---:|---|
| 194 / 21914573 | 1347.164 | 12.47 | 13.74 | -1.27 | non |
| 195 / 1720684395 | 1350.083 | 8.35 | 13.58 | -5.23 | non |
| 206 / 13484626647 | 1413.543 | 8.80 | 8.73 | 0.07 | oui |
| 207 / 10687075420 | 1418.333 | 8.67 | 8.52 | 0.15 | oui |
| 208 / 10683095895 | 1421.696 | 8.49 | 8.40 | 0.09 | oui |
| 209 / 10687075421 | 1425.058 | 8.35 | 8.29 | 0.06 | oui |
| 210 / 1720684415 | 1428.976 | 8.21 | 8.18 | 0.03 | oui |
| 211 / 10687075425 | 1431.552 | 8.13 | 8.03 | 0.10 | oui |
| 219 / 519323656 | 1516.741 | 7.58 | 7.55 | 0.03 | oui |
| 220 / 12136114443 | 1524.065 | 9.29 | 32.55 | -23.26 | oui |
| 221 / 6566017213 | 1532.690 | 9.58 | 32.76 | -23.18 | oui |
| 222 / 1720684293 | 1548.647 | 8.97 | 32.47 | -23.50 | oui |
| 223 / 6485591900 | 1564.595 | 7.38 | 32.61 | -25.23 | oui |
| 224 / 6485591901 | 1580.549 | 10.50 | 32.73 | -22.23 | oui |
| 225 / 1280338640 | 1596.510 | 12.38 | 32.79 | -20.41 | oui |
| 226 / 21914381 | 1612.462 | 18.65 | 32.71 | -14.06 | oui |
| 227 / 6485591903 | 1628.417 | 20.93 | 32.75 | -11.82 | oui |
| 228 / 1720684274 | 1644.379 | 18.08 | 32.64 | -14.56 | oui |
| 229 / 9416148986 | 1660.345 | 21.45 | 21.58 | -0.13 | oui |
| 230 / 6485591905 | 1676.308 | 22.55 | 22.40 | 0.15 | oui |
| 231 / 25239162 | 1692.269 | 22.55 | 22.48 | 0.07 | oui |
| 232 / 2264703507 | 1708.240 | 20.55 | 32.94 | -12.39 | oui |
| 233 / 6485591906 | 1724.213 | 17.47 | 19.50 | -2.03 | oui |
| 234 / 21914359 | 1740.182 | 15.31 | 20.07 | -4.76 | oui |
| 235 / 6485591907 | 1756.158 | 13.65 | 32.57 | -18.92 | oui |
| 236 / 1736929676 | 1772.146 | 12.34 | 32.79 | -20.45 | oui |
| 237 / 11409061521 | 1784.717 | 18.06 | 32.56 | -14.50 | oui |
| 238 / 9416148980 | 1797.288 | 21.29 | 21.25 | 0.04 | oui |
| 239 / 11409061520 | 1809.865 | 22.03 | 22.04 | -0.01 | oui |
| 240 / 9416148963 | 1822.445 | 20.12 | 33.07 | -12.95 | oui |
| 241 / 11409061519 | 1835.022 | 17.04 | 33.09 | -16.05 | oui |
| 242 / 279442967 | 1847.600 | 15.57 | 32.54 | -16.97 | oui |
| 243 / 11409061518 | 1860.185 | 14.25 | 21.49 | -7.24 | oui |
| 244 / 11407697331 | 1872.768 | 13.51 | 13.45 | 0.06 | oui |
| 245 / 21914343 | 1878.564 | 13.48 | 7.35 | 6.13 | oui |
| 278 / 1738369856 | 2286.178 | 2.34 | -0.15 | 2.49 | non |
| 279 / 6485591934 | 2288.773 | 2.31 | 0.04 | 2.27 | non |
| 280 / 6444966428 | 2292.541 | 2.30 | -0.11 | 2.41 | non |
| 281 / 25193217 | 2310.828 | 2.35 | -0.89 | 3.24 | non |
| 282 / 6485591936 | 2370.518 | 2.35 | 0.36 | 1.99 | non |
| 283 / 9416148865 | 2374.209 | 2.38 | 0.43 | 1.95 | non |
| 286 / 917957146 | 2382.341 | 2.28 | 5.96 | -3.68 | non |
| 287 / 9416148876 | 2392.110 | 2.17 | 5.44 | -3.27 | non |
| 288 / 9416148875 | 2399.518 | 2.07 | 4.83 | -2.76 | non |
| 289 / 9416148870 | 2417.440 | 1.81 | 3.30 | -1.49 | non |

## Variations du terrain à examiner

Seuil de tri : 0,35 m/m. Ce seuil n’est pas une limite de la physique et les valeurs ne sont pas des pentes de chaussée qualifiées.

| Produit | Arête | s début → fin (m) | Distance (m) | Variation (m) | Pente terrain (m/m) |
|---|---:|---:|---:|---:|---:|
| lidar | 193 | 1344.353 → 1347.164 | 2.812 | -1.49 | -0.529887 |
| lidar | 194 | 1347.164 → 1350.083 | 2.918 | -4.12 | -1.411721 |
| lidar | 195 | 1350.083 → 1352.658 | 2.575 | 5.05 | 1.961071 |
| lidar | 225 | 1596.510 → 1612.462 | 15.952 | 6.27 | 0.393048 |
| lidar | 236 | 1772.146 → 1784.717 | 12.571 | 5.72 | 0.455015 |
| rge | 219 | 1516.741 → 1524.065 | 7.323 | 25.00 | 3.413758 |
| rge | 228 | 1644.379 → 1660.345 | 15.965 | -11.06 | -0.692746 |
| rge | 231 | 1692.269 → 1708.240 | 15.971 | 10.46 | 0.654930 |
| rge | 232 | 1708.240 → 1724.213 | 15.972 | -13.44 | -0.841465 |
| rge | 234 | 1740.182 → 1756.158 | 15.976 | 12.50 | 0.782412 |
| rge | 237 | 1784.717 → 1797.288 | 12.572 | -11.31 | -0.899646 |
| rge | 239 | 1809.865 → 1822.445 | 12.581 | 11.03 | 0.876734 |
| rge | 242 | 1847.600 → 1860.185 | 12.585 | -11.05 | -0.878059 |
| rge | 243 | 1860.185 → 1872.768 | 12.583 | -8.04 | -0.638960 |
| rge | 244 | 1872.768 → 1878.564 | 5.796 | -6.10 | -1.052368 |
| rge | 283 | 2374.209 → 2376.327 | 2.118 | 1.79 | 0.844943 |
| rge | 285 | 2379.212 → 2382.341 | 3.130 | 3.65 | 1.166296 |

## Mesures encore nécessaires

- altitudes de chaussee et limites gauche/droite localisees, datees, datum et incertitude documentes.
- releve de la surface routiere sous ouvrage, position des vrais portails et hauteur libre ; ne pas interpoler le MNT.
- identifier la surface echantillonnee, les niveaux superposes et les ruptures ; verifier les deux produits avant de choisir une cote.
- largeurs de course, devers, lignes FIA et actualite 2026 ; aucun zero ou profil moyen par defaut.

## Provenance et reproduction

Les captures IGN et les six fichiers géométriques sont contrôlés par leur manifeste ; les trois sorties du préparateur sont reproduites et comparées avant cette revue. Les SHA-256 de toutes les entrées sont consignés dans le JSON. Le programme ne fait aucun appel réseau.

```sh
python3 tools/examiner-monaco-mesures.py
python3 tools/examiner-monaco-mesures.py --check
node --test verifications/monaco-revue.test.mjs
```

Coordonnées, sélection et repères : © les contributeurs d’OpenStreetMap, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Observations de terrain IGN : [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/).

Les 415 altitudes de chaussée, largeurs gauche/droite et dévers restent `null`. `readyForRuntime` reste faux ; cette revue n’établit ni profil routier ni validation de course.
