# Implantation 126 CK — lecture des références, 21 novembre 2026

## Portée

Mesures de reconstruction sur les rendus RenderBlade déjà reçus, principalement
[09](../../../references/ferrari-126ck-renderblade-2026-11-21/images/ferrari-f1-126-ck-1980-09.jpg)
et sa vue filaire
[29](../../../references/ferrari-126ck-renderblade-2026-11-21/images/ferrari-f1-126-ck-1980-29.jpg),
recoupées avec les profils 02/04/11/31, l'habitacle 16, les vues 14/15/17 et les
photos réelles ASMONZA 10/11. Ce sont des **estimations de modélisation** ; aucune
cote constructeur ni calibration photogrammétrique n'est revendiquée.

Les essieux du jeu restent à `x=+1,35` et `x=−1,35`, soit 2,70 m. Les pneus,
leurs dimensions, la conduite et les collisions ne sont pas redimensionnés.

## Longueur : repères communs sur la vue de dessus

Dans les fichiers 1920 × 1920, le centre d'essieu avant se lit vers la ligne 540
et celui de l'arrière vers 1480. Le rapport utilisé est
`u=(ligne−540)/940`, puis `x=1,35−2,70×u` ; `u=0` désigne l'essieu avant et `u=1`
l'arrière. Les petits écarts de perspective et de lecture justifient une plage
d'environ ±0,04 à ±0,08 m, selon le point. Les centimètres ci-dessous facilitent
les raccordements du code ; ils ne constituent pas une précision physique.

| Repère | Ligne image approximative | u | x calculé | Cible arrondie |
|---|---:|---:|---:|---:|
| Avant de l'ouverture sous le saute-vent | 552 | 0,013 | +1,316 | +1,30 |
| Planche des instruments | 574 | 0,036 | +1,252 | +1,25 |
| Centre du volant | 623 | 0,088 | +1,112 | +1,10 |
| Centres des rétroviseurs | 722 | 0,194 | +0,827 | +0,82 |
| Bord arrière de l'ouverture / dossier | 858 | 0,338 | +0,437 | +0,44 |
| Arceau principal | 900 | 0,383 | +0,316 | +0,32 |
| Avant du plateau métallique | 890 | 0,372 | +0,345 | +0,35 |
| Arrière du plateau métallique | 1113 | 0,610 | −0,296 | −0,30 |
| Arche de sortie du capot central | 1280 | 0,787 | −0,776 | −0,78 |
| Avant des pontons | 651 | 0,118 | +1,031 | +1,03 |
| Arrière des pontons | 1362 | 0,874 | −1,011 | −1,01 |

L'ouverture de la base .78 occupe `x=−0,24…+0,52`, le volant `x=+0,33`, la
planche `x=+0,48` et l'arceau `x≈−0,27`. L'écart principal est donc un cockpit
trop reculé d'environ **0,7 m**, avec une ouverture également trop courte.
Déplacer seulement le regard conserverait cette erreur. L'avant des pontons
déjà préparé à `x=+0,98` est beaucoup plus proche de la référence.

Les rétroviseurs de la cible sont **derrière le volant** longitudinalement,
près de la partie médiane de l'ouverture. Le montage actuel `RETRO.x=+0,66`
devant le volant à `+0,33` ne doit pas être translaté tel quel : sa relation au
volant est inversée. Les corps des miroirs restent attachés aux flancs.

## Hauteurs proposées pour l'assemblage

Les profils 02/04 sont en perspective : le sol sous les pneus proches n'est pas
la projection du sol dans le plan médian de la cellule. Le gros plan 11 agrandit
encore le pneu proche par rapport au cockpit. Utiliser directement son diamètre
pour toutes les pièces sous-estimerait la cellule. Les valeurs suivantes sont
un recoupement visuel, à contrôler sur le rendu commun et sur ses surfaces.

| Élément | y proposé dans le jeu | Remarque |
|---|---:|---|
| Bord avant de l'ouverture | 0,66–0,69 | Sous le saute-vent |
| Bord longitudinal près du dossier | 0,70–0,73 | Plus haut vers l'arrière |
| Plateau métallique | 0,84–0,87 | Rehausse après le dossier, pas prolongement plat du bord |
| Sommet de l'arceau | 1,03–1,08 | Pieds sur plateau, jambes descendant vers son arrière |
| Centre du volant | 0,65–0,67 | Rayon monde proposé 0,12–0,13 ; sommet 0,78–0,80 |
| Centre de la planche | 0,67–0,69 | Cadran central culminant vers 0,76–0,78 |
| Centre des rétroviseurs | environ 0,66 | `x≈0,82`, `z≈±0,29…0,32` ; patte courte au bord réel |
| Coussin d'assise | 0,27–0,30 | Vérifier bassin, cuve et plancher ensemble |
| Haut du dossier | environ 0,70 | Vers `x≈0,44`, pente vers le bassin |

Incertitude pratique des hauteurs : de l'ordre de ±0,04 à ±0,06 m. L'assemblage
doit conserver un seul modèle pour toutes les vues ; aucune hauteur ne doit
être choisie pour garantir arbitrairement que tous les cadrans soient visibles.

## Conséquences pour le pilote et le rendu

Un premier placement anatomique cohérent est un bassin vers `(0,67;0,28;0)`,
des épaules vers `(0,52;0,67;±0,16)` et des yeux vers `(0,58;0,88;0)` : il décrit
un buste incliné vers l'arrière d'environ 20–25°, à affiner avec le siège réel et
les longueurs des membres. Ce placement est une proposition, pas une mesure
du pilote des photographies. Translater l'ancien buste vertical ne suffit pas.

Le plateau, les renforts d'arceau et l'arche ouverte du capot restent visibles
sans pilote et dans tous les LOD. La vue sans pilote conserve les commandes,
siège, dossier, saute-vent et miroirs. Les photos ASMONZA précisent aluminium,
rivets et assemblages ; leur siège beige et leurs harnais bleus ne remplacent
pas les teintes de la configuration RenderBlade rouge retenue.

Aucun fichier runtime modifié dans ce relevé. Le rapport propose les repères ;
il ne valide ni la fidélité du candidat ni les captures de son intégration.
