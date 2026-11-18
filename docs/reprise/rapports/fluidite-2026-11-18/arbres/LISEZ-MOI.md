# Fluidité, lot « arbres » (vague 1) — 18 novembre 2026

Branche `fluidite/arbres`, base `54e98c9`. Paliers Moyenne et Fine ; Extrême (Fine avec la végétation extrême) a
les arbres de Fine et n'a pas été mesuré à part. Légère inchangée.

## Ce qui change

- **Silhouette lointaine par essence** (`src/botanique.js`, `SILHOUETTE`) : mêmes pieds, mêmes cimes, mêmes amas et
  mêmes plateaux que la forme proche, tirés du même plan ; amas réduits à leurs faces extérieures, fût sans segments
  intermédiaires (sauf la sinuosité du pin), branches en prismes droits à quatre faces, charpentière cachée dans un
  amas retirée. Triangles de la silhouette (Moyenne / Fine) : feuillu 810 / 1 410 → 212 / 296, pin 902 / 1 582 →
  454 / 670, conifère 1 350 / 2 514 → 378 / 582. Les neuf formes proches sont identiques (empreintes dans
  `verifications/botanique.test.mjs`, qui fige aussi la silhouette).
- **Tronc lointain** : la version lointaine d'un arbre n'avait pas de tronc (elle ne se montrait qu'à 520 m au
  moins). Elle reçoit un prisme de 12 triangles (`arbre-tronc-loin` ; le tronc proche reste le cylindre de 64
  triangles du moteur), même pose, taille, rotation, matière et couleur, sans collision. Les géants de Cap-Séquoia,
  qui avaient déjà leur cylindre au loin, le gardent.
- **Cases d'arbres** (`src/decor.js`) : les arbres quittent les lots de 150 m de piste (sphères jusqu'à 276 m de
  rayon à Val-Brûlé, 324 m à Haut-Col ; bascule à 520 m de la sphère) pour des cases de 60 m ; une case de moins
  de trois arbres rejoint la case éparse de 120 m qui la contient. Le mobilier garde ses lots. Bascule par taille
  projetée : 80 m de la sphère pour 60° et 1 080 pixels (`lodReferenceFov` / `lodReferenceHeight`, que le moteur
  adapte au champ et à la toile), reculée pour qu'aucun arbre ne bascule à plus de 150 pixels de haut (96 cases sur
  143 à Haut-Col, jusqu'à 89 m ; toutes celles de Cap-Séquoia, 160 à 292 m pour des géants jusqu'à 47 m). Aucune
  portée : rien ne se coupe. Distance réelle : 112 m en Fine sur la toile de 1 514 pixels, 56 m en Moyenne
  (757 pixels), 80 m sur une toile de 1 080, ×0,92 dans la glace (9,9° sur 150 pixels).
- **Inchangé** : solides et leur ordre, positions des arbres, masques d'herbe (comparés à `54e98c9` sur cinq
  circuits et trois paliers), aucun tirage du hasard ajouté ni déplacé, version physique `p9`.

## Mesures

### Doublure WebGL, arbres seuls

Triangles des arbres par image, passe couleur + passe d'ombre du soleil, moteur réel (`src/moteur/renderer.js`) sur
la doublure WebGL inerte du rapport herbe-sillage (`mesurer-arbres.mjs`). Moyenne des poses cockpit tous les 700 m
de 800 à 4 300 m (cinq à Val-Brûlé, qui fait 4 200 m ; six ailleurs), toiles du navigateur (Fine 2 880 × 1 514,
Moyenne 1 440 × 757), ombres aux deux paliers. Pire pose : la pose au plus faible rapport. Appels : moyenne.

| Circuit | Palier | Avant | Après | Rapport | Pire pose | Appels | Lots portant des arbres |
|---|---|---:|---:|---:|---:|---:|---:|
| Val-Brûlé | Fine | 1 271 701 | 274 204 | ÷4,6 | ÷3,8 | 25 → 71 | 29 → 145 |
| Val-Brûlé | Moyenne | 698 620 | 116 360 | ÷6,0 | ÷5,5 | 25 → 71 | 29 → 145 |
| Haut-Col | Fine | 1 306 452 | 175 155 | ÷7,5 | ÷4,4 | 30 → 86 | 33 → 143 |
| Haut-Col | Moyenne | 679 910 | 105 052 | ÷6,5 | ÷3,7 | 30 → 86 | 33 → 143 |
| Brume-de-Jade | Fine | 50 293 | 6 876 | ÷7,3 | ÷2,9 | 19 → 15 | 18 → 29 |
| Brume-de-Jade | Moyenne | 27 675 | 4 280 | ÷6,5 | ÷2,8 | 19 → 15 | 18 → 29 |
| Cap-Séquoia | Fine | 865 482 | 152 501 | ÷5,7 | ÷3,5 | 30 → 52 | 22 → 75 |
| Cap-Séquoia | Moyenne | 445 702 | 63 679 | ÷7,0 | ÷4,8 | 30 → 52 | 22 → 75 |

**Pires poses.** À Val-Brûlé, Brume-de-Jade et Cap-Séquoia, 75 à 77 % de ce qui reste en Fine (55 à 69 % en
Moyenne) vient de cases encore en version proche ; à Val-Brûlé (1 500 m, Fine), 309 372 de ces triangles sont dans
la passe d'ombre et 55 118 dans la couleur. À Haut-Col (3 600 m), 91 % (Fine) et 95 % (Moyenne) viennent de
silhouettes : des conifères vus de loin, où le gain est surtout celui de la silhouette de conifère, tronc compris :
2 514 → 594 triangles (÷4,2) en Fine, 1 350 → 390 (÷3,5) en Moyenne.

**Passe d'ombre.** Le moteur la dessine dans la version choisie pour la vue. À Val-Brûlé en Fine, elle pèse
163 388 des 274 204 triangles restants (couleur 704 726 → 110 816, ombre 566 975 → 163 388). Simulée dans la
doublure (variante `ombres-lointaines` : version lointaine pour l'ombre d'un lot d'arbres à plus de 40 m ; retouche
du moteur non livrée, effet à l'écran non regardé), elle donnerait en moyenne et en pire pose : Val-Brûlé ÷6,9 et
÷6,2 en Fine, ÷6,6 et ÷5,7 en Moyenne ; Haut-Col ÷8,0 et ÷4,4, ÷6,5 et ÷3,7 ; Brume-de-Jade ÷8,4 et ÷3,5, ÷7,0 et
÷3,3 ; Cap-Séquoia ÷6,7 et ÷4,5, ÷7,9 et ÷5,9.

**Rétroviseur** (même méthode, toile de 495 × 150, sans passe d'ombre) : ÷10,8 et ÷8,6 à Val-Brûlé, ÷12,0 et ÷9,6 à
Haut-Col, ÷10,0 et ÷7,6 à Brume-de-Jade, ÷19,1 et ÷16,2 à Cap-Séquoia (Fine et Moyenne).

**Décor entier** (lots du décor et nappes, sans piste, terrain ni voitures ; cockpit) : Val-Brûlé 1 599 500 →
602 003 (÷2,7) en Fine, 766 765 → 184 506 (÷4,2) en Moyenne ; Haut-Col ÷3,8 et ÷4,1 ; Brume-de-Jade ÷1,5 et ÷1,3 ;
Cap-Séquoia ÷4,2 et ÷3,9. Appels : Val-Brûlé 224 → 279 et 115 → 170, Haut-Col 259 → 321 et 175 → 237,
Brume-de-Jade 113 → 115, Cap-Séquoia 119 → 149.

### Navigateur, image entière

`mesurer-navigateur.js` avec `tools/page-essai.mjs` (dépôt principal), fenêtre de 1 440 × 757 points en densité 2 :
départ de référence à 800 m, 60 images comptées, aucun chrono. Lots visibles : dernière image. Glace : moyenne par
image du jeu (en Moyenne, elle n'est rendue qu'une image sur deux).

| Circuit | Palier | Triangles | Appels | Lots visibles | Triangles glace |
|---|---|---:|---:|---:|---:|
| Val-Brûlé | Fine | 4 426 159 → 1 689 675 | 578 → 690 | 81 → 128 | 1 411 014 → 385 257 |
| Val-Brûlé | Moyenne | 2 488 162 → 911 833 | 361 → 476 | 20 → 70 | 436 493 → 167 625 |
| Haut-Col | Fine | 931 515 → 579 933 | 365 → 387 | 54 → 77 | 1 215 078 → 344 453 |
| Haut-Col | Moyenne | 739 468 → 562 005 | 307 → 329 | 25 → 48 | 387 208 → 163 304 |
| Brume-de-Jade | Fine | 559 972 → 536 866 | 301 → 296 | 7 → 7 | 312 987 → 299 868 |
| Brume-de-Jade | Moyenne | 550 764 → 537 140 | 303 → 297 | 7 → 7 | 152 588 → 149 082 |
| Cap-Séquoia | Fine | 1 110 962 → 633 706 | 297 → 301 | 9 → 17 | 500 220 → 300 661 |
| Cap-Séquoia | Moyenne | 830 530 → 553 449 | 296 → 300 | 9 → 18 | 200 442 → 150 024 |

Aucune erreur de console. Mesuré sur une construction de cette branche qui ne diffère de la version livrée que par
des commentaires.

### Appels de dessin

C'est le coût des cases : un lot coûte un appel par forme et par passe, quel que soit son nombre d'arbres. Vue de
départ : +112 à Val-Brûlé en Fine (+19 %), +115 en Moyenne (+32 %), +22 à Haut-Col, 6 au plus ailleurs. Vues
tournées vers les arbres (Fine, `vue-capture.js.tpl`) : à 600 m d'un arbre, Haut-Col 360 → 605 (+68 %) pour
2 271 537 → 598 837 triangles, Val-Brûlé 296 → 485 (+64 %) pour 1 797 132 → 454 832 ; à 250 m, 414 → 607 et
326 → 450. Dans la doublure, le regroupement des cases éparses retire 5,6 appels d'arbres en moyenne à Val-Brûlé
(76,8 → 71,2) et 21,6 à Haut-Col (107,3 → 85,7, maximum 188 → 152), comparé aux seules cases de 60 m
(`ARBRES_EPARS = 0`). Lots du décor (`tools/budget-decor.mjs`, ses propres circuits, Moyenne) : forêt 2 394 →
2 539, côte 1 595 → 1 683, montagne 1 553 → 1 696, Asie 28 → 60, Pacifique 31 → 96.

## Captures

Fenêtre de 1 440 × 757 points en densité 2 (`vue-capture.js.tpl`). Part des pixels qui changent de plus de 24
niveaux sur l'image entière, entre les deux versions :

- `bascule-fine-feuillu-conifere-pin.png` : version proche puis lointaine forcées en Fine, Val-Brûlé (arbre 152 à
  115 m), Haut-Col (arbre 90 à 125 m), Port-Sable (arbre 22 à 115 m), près de la bascule ; extraits agrandis quatre
  fois. 0,028 %, 0,021 %, 0,091 %.
- `bascule-moyenne-feuillu-conifere-pin.png` : les mêmes arbres à 60 m en Moyenne ; extraits sans agrandissement
  (la toile de Moyenne est déjà agrandie deux fois par le navigateur). 0,028 %, 0,028 %, 0,072 %.
- `bascule-cap-sequoia-geants.png` : géants de Cap-Séquoia (arbre 69 à 335 m) en Fine, proche en haut, lointain en
  bas, agrandis deux fois. 0,18 %.
- `avant-*.png` / `apres-*.png` : `54e98c9` contre cette branche, même pose, rien de forcé : piste de Val-Brûlé à
  1 500 m (regard le long de la piste), Haut-Col et Port-Sable à 250 m de l'arbre 90 et de l'arbre 22, Cap-Séquoia à
  335 m de l'arbre 69. 0,055 %, 0,030 %, 0,077 %, 0,121 %. Au bord de la piste de Val-Brûlé (1 200 m, vue non
  conservée) : 0,54 %, des cimes proches des deux côtés, agitées par le vent à un autre instant, et le chrono.

Des branches de conifère à trois faces s'allumaient en blanc à la bascule en Moyenne : elles ont repris les quatre
faces de la forme proche. Les plateaux du pin gardent leurs huit rayons : à six, leur bord changeait à la bascule.

## Reproduire

```sh
node docs/reprise/rapports/fluidite-2026-11-18/arbres/mesurer-arbres.mjs . 54e98c9 avant.json
node docs/reprise/rapports/fluidite-2026-11-18/arbres/mesurer-arbres.mjs . WORKTREE apres.json
node docs/reprise/rapports/fluidite-2026-11-18/arbres/mesurer-arbres.mjs . WORKTREE ombres.json ombres-lointaines
python3 construire.py
node <dépôt principal>/tools/page-essai.mjs dist/bitume.html docs/reprise/rapports/fluidite-2026-11-18/arbres/mesurer-navigateur.js --taille 1440,757 --dpr 2
node tools/budget-decor.mjs     # colonnes casesArbres et triArbresLoin ; sort en 1 sur islande et desert, comme à 54e98c9
```

`mesures-avant.json`, `mesures-apres.json` et `mesures-apres-ombres-lointaines.json` portent les empreintes des
sources mesurées. Node 24.18.0, macOS arm64.
