# Profils des circuits — mesures du 18/11/2026

Sources : `/Users/david/Projects/bitume/src` (lues sans modification). Décor au palier high, saison ete.
Produit par `node tools/profil-circuits.mjs`. Les valeurs complètes sont dans `profils.json` ; l'axe tous les 10 m dans `axes/`.

## Tracé

| Circuit | Thème | Graine | Longueur (m) | Virages (R < 500 m) | Lignes droites (R > 900 m) | Plus longue droite | Vitesse réf. (km/h) | Temps réf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Val-Brûlé | foret | 11 | 4 222 | 11 | 75,0 % du tour | 526 m | 76 à 269 | 81,0 s |
| Port-Sable | cote | 29 | 3 638 | 9 | 78,0 % du tour | 484 m | 75 à 271 | 75,6 s |
| Haut-Col | montagne | 47 | 5 216 | 8 | 81,4 % du tour | 612 m | 67 à 283 | 87,3 s |
| Lande-Noire | islande | 83 | 4 616 | 7 | 86,7 % du tour | 624 m | 75 à 275 | 84,9 s |
| Roche-Fauve | desert | 107 | 4 834 | 10 | 77,7 % du tour | 530 m | 75 à 271 | 95,8 s |
| Brume-de-Jade | asie | 131 | 5 018 | 9 | 83,0 % du tour | 684 m | 75 à 284 | 97,3 s |
| Cap-Séquoia | pacifique | 157 | 5 234 | 10 | 80,3 % du tour | 524 m | 71 à 282 | 99,8 s |

## Relief

| Circuit | Dénivelé | Altitudes | Montée cumulée | Pente max (montée / descente) | Pente moyenne | Crêtes / cuvettes ≥ 1 m | R vertical mini (crête / cuvette) | Allègement / écrasement max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Val-Brûlé | 12,2 m | −6,1 à 6,1 m | 54 m | 4,8 % / −6,8 % | 2,6 % | 5 / 4 | 475 / 462 m | −0,74 / +0,90 g |
| Port-Sable | 10,1 m | −5,8 à 4,3 m | 21 m | 3,2 % / −3,5 % | 1,1 % | 4 / 3 | 1 057 / 1 023 m | −0,18 / +0,26 g |
| Haut-Col | 13,2 m | −6,5 à 6,6 m | 36 m | 2,8 % / −6,8 % | 1,4 % | 4 / 4 | 498 / 541 m | −0,36 / +0,29 g |
| Lande-Noire | 12,9 m | −6,1 à 6,8 m | 31 m | 6,8 % / −3,2 % | 1,3 % | 4 / 4 | 461 / 498 m | −0,73 / +0,63 g |
| Roche-Fauve | 27,2 m | −12,2 à 15,0 m | 47 m | 6,8 % / −5,8 % | 1,9 % | 3 / 3 | 512 / 448 m | −0,42 / +0,43 g |
| Brume-de-Jade | 24,8 m | −15,6 à 9,1 m | 52 m | 4,6 % / −5,5 % | 2,1 % | 4 / 3 | 673 / 518 m | −0,32 / +0,34 g |
| Cap-Séquoia | 13,4 m | −6,7 à 6,7 m | 27 m | 1,6 % / −6,8 % | 1,0 % | 2 / 2 | 575 / 527 m | −0,89 / +0,77 g |

Crêtes et cuvettes (proéminence ≥ 1 m) : abscisse, rayon vertical et charge à la vitesse de référence.

- **Val-Brûlé** : crête 644 m (R 2 952 m, 211 km/h, −0,12 g) ; cuvette 1 066 m (R 2 952 m, 256 km/h, +0,17 g) ; crête 1 488 m (R 2 952 m, 220 km/h, −0,13 g) ; cuvette 1 910 m (R 2 952 m, 214 km/h, +0,12 g) ; crête 2 332 m (R 2 952 m, 144 km/h, −0,06 g) ; cuvette 2 754 m (R 2 952 m, 243 km/h, +0,16 g) ; crête 3 176 m (R 2 952 m, 167 km/h, −0,07 g) ; cuvette 3 598 m (R 2 952 m, 230 km/h, +0,14 g) ; crête 3 932 m (R 481 m, 213 km/h, −0,74 g).
- **Port-Sable** : crête 388 m (R 1 084 m, 150 km/h, −0,16 g) ; cuvette 680 m (R 3 870 m, 134 km/h, +0,04 g) ; crête 1 112 m (R 5 598 m, 184 km/h, −0,05 g) ; cuvette 1 440 m (R 7 861 m, 196 km/h, +0,04 g) ; crête 1 778 m (R 8 731 m, 150 km/h, −0,02 g) ; cuvette 2 708 m (R 7 376 m, 189 km/h, +0,04 g) ; crête 3 158 m (R 4 750 m, 170 km/h, −0,05 g).
- **Haut-Col** : cuvette 508 m (R 881 m, 180 km/h, +0,29 g) ; crête 976 m (R 13 878 m, 258 km/h, −0,04 g) ; cuvette 1 540 m (R 13 524 m, 159 km/h, +0,01 g) ; crête 2 158 m (R 10 775 m, 252 km/h, −0,05 g) ; cuvette 2 832 m (R 8 576 m, 202 km/h, +0,04 g) ; crête 3 528 m (R 7 640 m, 231 km/h, −0,06 g) ; cuvette 4 230 m (R 7 743 m, 253 km/h, +0,07 g) ; crête 4 884 m (R 659 m, 152 km/h, −0,28 g).
- **Lande-Noire** : crête 520 m (R 642 m, 239 km/h, −0,70 g) ; cuvette 1 030 m (R 14 089 m, 98 km/h, +0,01 g) ; crête 1 490 m (R 18 676 m, 158 km/h, −0,01 g) ; cuvette 1 926 m (R 15 281 m, 220 km/h, +0,03 g) ; crête 2 510 m (R 9 281 m, 241 km/h, −0,05 g) ; cuvette 3 140 m (R 6 866 m, 244 km/h, +0,07 g) ; crête 3 778 m (R 6 204 m, 196 km/h, −0,05 g) ; cuvette 4 288 m (R 498 m, 173 km/h, +0,47 g).
- **Roche-Fauve** : crête 454 m (R 512 m, 164 km/h, −0,41 g) ; cuvette 1 796 m (R 7 851 m, 266 km/h, +0,07 g) ; crête 2 560 m (R 4 230 m, 128 km/h, −0,03 g) ; cuvette 3 306 m (R 4 581 m, 226 km/h, +0,09 g) ; crête 3 964 m (R 6 962 m, 162 km/h, −0,03 g) ; cuvette 4 476 m (R 8 305 m, 204 km/h, +0,04 g).
- **Brume-de-Jade** : crête 530 m (R 675 m, 141 km/h, −0,23 g) ; cuvette 1 058 m (R 4 892 m, 111 km/h, +0,02 g) ; crête 1 862 m (R 9 892 m, 139 km/h, −0,01 g) ; cuvette 2 250 m (R 12 791 m, 225 km/h, +0,03 g) ; crête 2 754 m (R 7 773 m, 273 km/h, −0,07 g) ; cuvette 3 566 m (R 4 891 m, 221 km/h, +0,08 g) ; crête 4 372 m (R 9 935 m, 193 km/h, −0,03 g).
- **Cap-Séquoia** : cuvette 712 m (R 25 819 m, 222 km/h, +0,01 g) ; crête 2 020 m (R 25 819 m, 210 km/h, −0,01 g) ; cuvette 3 328 m (R 25 819 m, 204 km/h, +0,01 g) ; crête 4 636 m (R 25 819 m, 214 km/h, −0,01 g).

## Dévers

| Circuit | Dévers max | Part du tour > 1° | Part du tour à plat (< 0,05°) | Virages relevés / contraires / plats | Dévers à la corde, du plus fort au plus faible |
| --- | --- | --- | --- | --- | --- |
| Val-Brûlé | 2,49° | 4,9 % | 70,2 % | 10 / 0 / 1 | 2,4°, 1,9°, 1,4°, 1,0°, 0,9°, 0,7°, 0,6°, 0,5°, 0,5°, 0,4°, 0,1° |
| Port-Sable | 2,58° | 9,3 % | 73,9 % | 8 / 0 / 1 | 2,4°, 2,3°, 2,1°, 2,0°, 1,4°, 0,7°, 0,6°, 0,4°, 0,0° |
| Haut-Col | 2,31° | 1,7 % | 78,4 % | 7 / 0 / 1 | 2,3°, 0,6°, 0,6°, 0,5°, 0,3°, 0,3°, 0,3°, 0,1° |
| Lande-Noire | 2,56° | 4,3 % | 83,5 % | 6 / 0 / 1 | 2,4°, 1,9°, 1,2°, 1,0°, 0,7°, 0,6°, 0,0° |
| Roche-Fauve | 2,58° | 7,6 % | 73,1 % | 10 / 0 / 0 | 2,4°, 2,1°, 2,0°, 1,1°, 1,1°, 1,0°, 0,7°, 0,3°, 0,3°, 0,2° |
| Brume-de-Jade | 2,29° | 7,0 % | 79,2 % | 9 / 0 / 0 | 2,3°, 1,9°, 1,6°, 1,5°, 1,3°, 0,6°, 0,5°, 0,4°, 0,3° |
| Cap-Séquoia | 2,12° | 6,8 % | 76,7 % | 10 / 0 / 0 | 2,1°, 1,7°, 1,4°, 1,1°, 1,1°, 0,8°, 0,5°, 0,5°, 0,5°, 0,3° |

## Courbures (part du tour par classe de rayon)

| Circuit | Droite > 900 m | Rapide 400-900 | Moyen 150-400 | Lent 70-150 | Serré 35-70 | Épingle < 35 | Dégagement (bord → glissière) mini / médian |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Val-Brûlé | 75,0 % | 2,5 % | 9,2 % | 9,1 % | 3,6 % | 0,6 % | 11,9 / 14,0 m |
| Port-Sable | 78,0 % | 2,1 % | 4,7 % | 7,0 % | 5,6 % | 2,6 % | 11,1 / 14,0 m |
| Haut-Col | 81,4 % | 2,8 % | 8,3 % | 5,2 % | 1,9 % | 0,5 % | 1,6 / 14,0 m |
| Lande-Noire | 86,7 % | 1,5 % | 2,4 % | 4,9 % | 3,3 % | 1,3 % | 11,2 / 14,0 m |
| Roche-Fauve | 77,7 % | 2,6 % | 7,0 % | 6,6 % | 5,1 % | 1,1 % | 11,2 / 14,0 m |
| Brume-de-Jade | 83,0 % | 2,1 % | 4,3 % | 3,1 % | 6,5 % | 1,0 % | 11,4 / 14,0 m |
| Cap-Séquoia | 80,3 % | 2,3 % | 5,2 % | 8,3 % | 3,1 % | 0,8 % | 9,9 / 14,0 m |

Largeur de chaussée : 12 m partout, sur les sept circuits.

## Décor par famille (objets de la version proche ; entre parenthèses, objets solides)

| Famille | Val-Brûlé | Port-Sable | Haut-Col | Lande-Noire | Roche-Fauve | Brume-de-Jade | Cap-Séquoia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| arbres | 2 164 (1 082) | 906 (453) | 1 598 (799) | – | – | 92 (46) | 640 (320) |
| glissières : lisses | 1 056 | 910 | 1 238 | 1 154 | 1 210 | 1 256 | 1 310 |
| glissières : poteaux | 1 056 | 910 | 1 238 | 1 154 | 1 210 | 1 256 | 1 310 |
| marquages de grille | 48 | 48 | 48 | 48 | 48 | 48 | 48 |
| murs de pneus | 504 (504) | 432 (432) | 216 (216) | 432 (432) | 504 (504) | 504 (504) | 504 (504) |
| panneaux publicitaires | 120 | 114 | 162 | 156 | 158 | 160 | 170 |
| passerelle | 5 (3) | 5 (3) | 5 (3) | 5 (3) | 5 (3) | 5 (3) | 5 (3) |
| portique des feux | 9 (3) | 9 (3) | 9 (3) | 9 (3) | 9 (3) | 9 (3) | 9 (3) |
| postes de commissaires | 36 (27) | 32 (24) | 44 (33) | 36 (27) | 40 (30) | 44 (33) | 44 (33) |
| repères de freinage | 84 | 72 | 36 | 72 | 84 | 84 | 84 |
| rochers | – | – | 155 | 768 (384) | 449 (321) | 208 (104) | 1 (1) |
| stands | 84 (24) | 84 (24) | 98 (28) | 98 (28) | 84 (24) | 98 (28) | 84 (24) |
| tribunes et public | 3 243 (80) | 3 304 (80) | 3 900 (96) | 3 926 (96) | 3 248 (80) | 3 906 (96) | 3 293 (80) |
| tunnel : colline | – | – | 279 | – | – | – | – |
| tunnel : structure | – | – | 380 | – | – | – | – |
| végétation : fleurs | 25 | 16 | – | – | – | – | – |
| végétation : fougères | 16 | – | 14 | – | – | – | – |
| végétation : herbe | 39 025 | 27 963 | 33 607 | – | – | – | – |
| végétation : humus | 16 | – | 14 | – | – | – | – |
| végétation : taillis | 31 | 18 | 20 | – | – | – | – |
| villages : maisons | 87 | 78 | 96 | – | – | – | – |
| villages : phare | – | 5 | – | – | – | – | – |

Les familles « végétation » comptent des tuiles et des touffes instanciées (une tuile de prairie porte 8 à 128 brins).

## Répartition le long du tour (cases de 100 m)

| Circuit | Sans mobilier de course à moins de 40 m | Au plus une famille de mobilier | Sans arbre, rocher ni maison à 120 m | Sans végétation basse à 40 m | Familles de mobilier présentes |
| --- | --- | --- | --- | --- | --- |
| Val-Brûlé | 4,7 % | 44,2 % | 0,0 % | 21,3 % | 9 / 9 |
| Port-Sable | 2,7 % | 51,4 % | 0,0 % | 16,5 % | 9 / 9 |
| Haut-Col | 13,4 % | 66,0 % | 0,0 % | 21,1 % | 9 / 9 |
| Lande-Noire | 2,2 % | 44,7 % | 0,0 % | 100,0 % | 9 / 9 |
| Roche-Fauve | 2,1 % | 49,0 % | 0,0 % | 100,0 % | 9 / 9 |
| Brume-de-Jade | 4,0 % | 39,2 % | 0,0 % | 100,0 % | 9 / 9 |
| Cap-Séquoia | 15,3 % | 52,8 % | 9,6 % | 100,0 % | 9 / 9 |

Mobilier de course compté : panneaux publicitaires, repères de freinage, murs de pneus, postes de commissaires, tribunes et public, stands, portique des feux, marquages de grille, passerelle. Les glissières, continues, ne comptent pas.

## Matières

| Circuit | Chaussée et accotements (sommets par matière) | Terrain (sommets par matière) | Objets par matière |
| --- | --- | --- | --- |
| Val-Brûlé | sol herbeux 8 : 24 340 ; asphalte PDR (et peintures de piste) 14 : 10 012 ; recette asphalte 21 : 4 294 | sol herbeux 8 : 16 625 | recette feuillage 27 : 40 179 ; tissu (public) 18 : 3 158 ; métal (glissières, portiques) 0 : 2 180 ; recette écorce 26 : 1 082 ; caoutchouc, noir 7 : 569 ; laque (panneaux, bandeaux) 16 : 215 ; métal cuivré (toits des villages) 1 : 58 ; recette béton 22 : 54 ; asphalte PDR (et peintures de piste) 14 : 48 ; façade enduite (13,x) 13,2 : 20 ; recette sol (humus) 25 : 16 ; asphalte PDR (et peintures de piste) 13,6 : 9 ; façade enduite (13,x) 13,3 : 7 ; recette métal peint 24 : 6 ; façade enduite (13,x) 13,1 : 4 ; façade enduite (13,x) 13,4 : 4 |
| Port-Sable | sol herbeux 8 : 20 576 ; asphalte PDR (et peintures de piste) 14 : 12 724 | sol herbeux 8 : 15 468 | recette feuillage 27 : 28 450 ; tissu (public) 18 : 3 219 ; métal (glissières, portiques) 0 : 1 890 ; caoutchouc, noir 7 : 497 ; recette écorce 26 : 453 ; laque (panneaux, bandeaux) 16 : 202 ; béton 3 : 54 ; métal cuivré (toits des villages) 1 : 52 ; asphalte PDR (et peintures de piste) 14 : 48 ; façade enduite (13,x) 13,2 : 16 ; asphalte PDR (et peintures de piste) 13,6 : 8 ; façade enduite (13,x) 13,3 : 8 ; façade enduite (13,x) 13,1 : 4 ; façade enduite (13,x) 13,4 : 4 ; lampe émissive 5 : 1 |
| Haut-Col | sol herbeux 8 : 30 920 ; asphalte PDR (et peintures de piste) 14 : 16 816 | béton 3 : 18 704 ; sol herbeux 8 : 6 284 ; roche 9 : 3 700 | recette feuillage 27 : 34 440 ; tissu (public) 18 : 3 798 ; métal (glissières, portiques) 0 : 2 548 ; recette écorce 26 : 799 ; roche 9 : 434 ; caoutchouc, noir 7 : 423 ; laque (panneaux, bandeaux) 16 : 315 ; béton 3 : 202 ; métal cuivré (toits des villages) 1 : 64 ; asphalte PDR (et peintures de piste) 14 : 48 ; lampe émissive 5 : 22 ; façade enduite (13,x) 13,2 : 21 ; recette sol (humus) 25 : 14 ; asphalte PDR (et peintures de piste) 13,6 : 11 ; façade enduite (13,x) 13,3 : 10 ; façade enduite (13,x) 13,4 : 6 ; façade enduite (13,x) 13,1 : 2 |
| Lande-Noire | sol herbeux 8 : 26 840 ; asphalte PDR (et peintures de piste) 14 : 15 406 | sol herbeux 8 : 25 274 ; roche 9 : 6 | tissu (public) 18 : 3 824 ; métal (glissières, portiques) 0 : 2 387 ; caoutchouc, noir 7 : 507 ; sol herbeux 8 : 384 ; roche 9 : 384 ; laque (panneaux, bandeaux) 16 : 244 ; béton 3 : 64 ; asphalte PDR (et peintures de piste) 14 : 48 ; asphalte PDR (et peintures de piste) 13,6 : 9 ; façade enduite (13,x) 13,2 : 7 |
| Roche-Fauve | sol herbeux 8 : 27 756 ; asphalte PDR (et peintures de piste) 14 : 16 488 | sol herbeux 8 : 24 526 ; roche 9 : 1 688 | tissu (public) 18 : 3 163 ; métal (glissières, portiques) 0 : 2 495 ; caoutchouc, noir 7 : 569 ; roche 9 : 449 ; laque (panneaux, bandeaux) 16 : 255 ; béton 3 : 54 ; asphalte PDR (et peintures de piste) 14 : 48 ; asphalte PDR (et peintures de piste) 13,6 : 10 ; façade enduite (13,x) 13,2 : 6 |
| Brume-de-Jade | sol herbeux 8 : 29 096 ; asphalte PDR (et peintures de piste) 14 : 16 822 | sol herbeux 8 : 28 066 ; roche 9 : 1 166 | tissu (public) 18 : 3 804 ; métal (glissières, portiques) 0 : 2 596 ; caoutchouc, noir 7 : 579 ; laque (panneaux, bandeaux) 16 : 261 ; sol herbeux 8 : 104 ; roche 9 : 104 ; béton 3 : 64 ; asphalte PDR (et peintures de piste) 14 : 48 ; recette écorce 26 : 46 ; recette feuillage 27 : 46 ; asphalte PDR (et peintures de piste) 13,6 : 11 ; façade enduite (13,x) 13,2 : 7 |
| Cap-Séquoia | sol herbeux 8 : 30 124 ; asphalte PDR (et peintures de piste) 14 : 17 774 | sol herbeux 8 : 22 281 ; roche 9 : 8 153 | tissu (public) 18 : 3 208 ; métal (glissières, portiques) 0 : 2 696 ; caoutchouc, noir 7 : 569 ; recette écorce 26 : 320 ; recette feuillage 27 : 320 ; laque (panneaux, bandeaux) 16 : 269 ; béton 3 : 54 ; asphalte PDR (et peintures de piste) 14 : 48 ; asphalte PDR (et peintures de piste) 13,6 : 11 ; façade enduite (13,x) 13,2 : 6 ; roche 9 : 1 |

Témoin du même thème : forêt, graine 96 (celle des tests). Ambiance et palette identiques à Val-Brûlé : oui ; dénivelé 22,6 m, pente max 6,5 %, 9 virages.

