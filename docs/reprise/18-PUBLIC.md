# Lot 18 — un vrai public dans les tribunes

## Demande et périmètre

David, 18 novembre 2026 : « je veux que tu prennes les beaux modèles human body de notre jeu emprise et que tu
remplaces les cubes dans le public par des vrais modèles humains, animés etc ».

Étude menée sur la branche `etude/public`. Le commit contient seulement des fichiers nouveaux :

- `src/public.js` ;
- `verifications/public.test.mjs` ;
- cette fiche ;
- le rapport `rapports/public-2026-11-18/`.

Le branchement dans le jeu (`src/decor.js`, `src/jeu.js`, `construire.py`) n'est pas commité. Il est livré à part
dans `rapports/public-2026-11-18/integration.patch` ; c'est lui qui a servi aux captures et aux mesures.

Restent inchangés :

- la physique p9 et les collisions : `decor.obstacles` est identique, ce que le test vérifie ;
- le hasard de la course et celui du décor ;
- le moteur FERRO : ni `renderer.js` ni les modules verrouillés ne sont touchés.

## Provenance

Tout a été lu en lecture seule, et aucun fichier n'est chargé en plus de ceux que BITUME a déjà.

- **EMPRISE** (`M4D135/emprise`, commit `cc004826a506e6979eaaec217748fe85d5cd6ac5`, version 0.6.8).
  - `src/human-data.js` décrit la tête : profil, nez, pommettes, orbites, bouche, oreilles, cou, yeux et sourcils.
    Il est identique octet pour octet à `src/humain-donnees.js` de BITUME
    (sha256 `4477d881c01414c6b89c3d838210172f5b643bca200e869c31e301f4a6a9720e`).
  - `src/body-data.js` décrit le corps : chemise, bassin, bras, mains et doigts, jambes, chaussures, avec des poids
    sur deux os. Il est identique à `src/humain-corps.js`
    (sha256 `7eeccbe7ed7746b51921696045808dfe20f4025c7117fdec8f10951a4615d1ad`).
  - `public.js` appelle leurs fonctions (`RADE.proceduralHuman` : `surface`, `ellipsoid`, `profile`, `normalise`)
    avec leurs profils. Seuls changent les résolutions, une par niveau de détail, et les fonds cachés dans le corps.
- **EMPRISE `src/human.js`** fournit :
  - trois visages, obtenus par déformation de la mâchoire et du nez (repris en continu dans le shader) ;
  - les cheveux tirés du crâne, avec un gonflement de 2,5 % ;
  - l'ajustement féminin des épaules ;
  - la palette de peaux, les tailles et les carrures.
- **FERRO `src/ferro/crowd.js`** (identique dans EMPRISE et BITUME) fournit les conventions :
  - le sommet de 36 octets ;
  - les pivots des os ;
  - la liste des visibles faite par le processeur, sans allocation ;
  - le plafond par histogramme ;
  - les points d'accroche `fx.foule` du moteur, avec l'éclairage du monde (`renderer.pdr`).

  `crowd.js` n'est pas chargé, pour deux raisons :
  - il pose ses unités sur un sol codé de 0 à 2,55 m, alors que les gradins montent à 4 m au-dessus d'un relief
    quelconque ;
  - il dessine les lointains en points, alors que le lointain doit rester un corps.

Le test contrôle ces empreintes, le commit cité dans l'en-tête du module, l'absence de `Math.random` et l'absence de
réseau.

## Conception

### Placement

Les tribunes viennent de `decor.gradins` quand le branchement est appliqué, sinon de `public.decrireGradins(c)`.
Les deux descriptions sont identiques, et le test les compare. Une tribune compte 8 marches de 1,15 m, monte de
0,5 m par marche, mesure 64 m de long, porte un toit à 7,4 m et des piliers tous les 12 m devant.

- **Les assis** sont au bord de chaque marche. Ils viennent en grappes, un peu plus nombreux aux rangs du milieu et
  près de la ligne de départ.
- **Les debout** occupent la dernière marche, en Fine surtout. Les enfants représentent 5 à 6 %.
- **Les spectateurs des glissières** se tiennent derrière la limite de piste, sur un ou deux rangs. On n'en met ni
  devant les tribunes ni devant les stands.
- **Évitements :**
  - personne n'est placé dans un pilier du toit ni dans un solide du décor ;
  - le corps est contrôlé, et pour les assis aussi les genoux ;
  - aux glissières, rien ne doit se trouver dans un disque de 0,32 m.
- **Nombre :** il est fixé par palier, quel que soit le nombre de tribunes du circuit : 1000 en Fine, 450 en
  Moyenne, 300 en Légère, dont 16, 15 et 12 % aux glissières. Le choix se fait par bissection sur les poids, sans
  autre tirage.

Le test contrôle chaque spectateur avec les primitives de collision du jeu (`decor.obstacles`,
`obstacles.tester`) :

- il est posé sur une marche, sans y être enfoncé ;
- son torse est libre, et ses genoux le sont aussi ;
- aux glissières, il reste au-delà de la limite de piste, hors de tout solide.

### Corps et niveaux de détail

Les triangles comptés sont ceux soumis au moteur : les parties cachées (cheveux, parapluie, etc.) en font partie.

| Niveau | Contenu | Triangles soumis | Dont corps |
|---|---|---:|---:|
| N0 | corps et tête d'EMPRISE à pleine résolution, yeux, sourcils, mains et doigts | 6 144 | 3 068 |
| N1 | les mêmes formes, allégées | 1 144 | 520 |
| N2 | silhouette articulée | 138 | 118 |

Les accessoires sont des parties montrées ou cachées par un masque de 32 bits propre à chaque spectateur :

- cheveux (dessus, longs, queue, tour, volume) et moustache ;
- casquette, bob, bonnet, chapeau de paille, capuche ;
- parapluie, drapeau, écharpe, lunettes, yeux.

**Passage d'un niveau à l'autre.** Il se fait par un fondu tramé sur une bande de taille à l'écran, en pixels de
hauteur :

- Fine : de N0 à N1 entre 84 et 106 px, de N1 à N2 entre 16 et 21 px ;
- Moyenne : de N1 à N2 entre 19 et 25 px ;
- Légère : N2 seul.

La trame de 8 bits partage [0, 1) exactement entre les niveaux. Chaque pixel appartient donc à un seul niveau, sans
trou ni double, et la bascule ne se voit pas.

**Plafonds par niveau.** Ils sont de 48 en N0 et 360 en N1 pour la Fine, de 220 en N1 pour la Moyenne. Quand un
plafond serait dépassé, un histogramme log2 remonte la bande par huitièmes d'octave, pour tout le public à la fois.

**Au loin**, N2 est dessiné à toute distance dans le champ : personne ne disparaît et rien ne se coupe.

### Tenues et variété

Chaque spectateur a son propre tirage. Les tenues dépendent de la saison :

| Saison | Ce qu'on voit |
|---|---|
| Été | manches courtes, shorts, lunettes, casquettes (dont 12 % à l'envers), bobs, paille |
| Hiver | bonnets, écharpes, gants, hauts sombres |

S'y ajoutent, en toute saison :

- 8 peaux, 8 couleurs de cheveux, 16 visages et 7 motifs (rayures, carreaux, etc.) ;
- 3 postures, 38 % de femmes, une moustache pour 26 % des hommes ;
- des tailles et carrures tirées ;
- quelques maillots du rouge des monoplaces.

Sur Val-Brûlé, en Fine, on compte 983 tenues différentes pour 983 spectateurs. Le blanc sur blanc (haut et bas
clairs) passe au bas en jean sans tirage supplémentaire : il touchait 31 spectateurs sur 983 avant correction.

### Animation sur le processeur graphique

La pose se calcule dans le vertex shader, à partir du temps, des traits du spectateur et de sa section de 16 m
(96 vec4 par image). Le comportement :

- **Au repos :** les spectateurs respirent, bougent un peu et suivent les voitures de la tête. Le regard vise une
  cible continue, pondérée par la proximité des voitures au cube.
- **Au passage :** l'excitation de la section monte entre 170 m et 22 m. Chacun se lève à son propre seuil, agite
  un ou deux bras, applaudit ou sautille. Les drapeaux ne sortent qu'à ce moment.
- **Au départ :** la tension monte avec les feux, la fête valant 0,22 + 0,07 par feu allumé. Elle vaut 1 au vert,
  puis retombe (e⁻¹ en 5 s). Tout le public se lève et salue.
- **À l'arrivée :** la fête est pleine dans les secondes qui suivent le drapeau à damier (1 à 4 s après). Elle vaut
  e⁻⁰ᐧ⁵ à 10 s et tombe sous 0,01 à 50 s.
- **Lissage :** il est exact en temps (`-expm1(-dt/τ)`). Le mouvement est donc le même à 30, 60 et 120 images par
  seconde ; les écarts mesurés sont 0,0125 pour l'excitation, 2,8 m pour le regard et 0 pour la fête.
- **Écran partagé :** les deux vues animent une seule fois par image ; le second appel, de dt nul, ne change rien.

### Météo, saison et présence

**Présence.** Elle vaut :

| Conditions | Présence |
|---|---:|
| Soleil | 1 |
| Variable | 0,86 |
| Pluie | 0,62 |
| Hiver | × 0,82 |
| Nuit | × 0,9 |

Les absents sont toujours les mêmes, par un tirage propre. Ils ne sont ni dessinés ni ombrés.

**Abris sous la pluie ou la neige.** Ils sont lissés sur 1,6 s.

- Sous un toit, assez loin du bord, le spectateur reste au sec et sans parapluie. La pluie poussée par le vent
  avance de 0,45 m par mètre de chute. Sur Val-Brûlé, cela fait 727 spectateurs sur 983.
- Le premier rang, les bouts de rangée et les glissières sont à découvert. Là, 46 % ont un parapluie, 34 % une
  capuche, et les autres se mouillent : leurs tissus deviennent plus sombres et plus brillants.

### Rendu

**Au chargement**, tout est préparé :

- les trois maillages, dans un seul tampon : 190 Ko de sommets et 89 Ko d'indices ;
- les spectateurs, dans deux textures (RGBA32F et RGBA32UI, deux texels chacun : 64 Kio pour 1000) ;
- deux programmes, couleur et ombre, avec l'éclairage du monde `renderer.pdr` ;
- deux tampons d'instances, pour que l'ombre et la couleur ne réécrivent pas un tampon lu dans la même image.

**À chaque image**, rien n'est alloué :

- la liste des indices par niveau, dans des tableaux préalloués ;
- un `bufferSubData` par passe ;
- les uniformes.

**Les appels de dessin :**

- `fx.foule.couleur` fait un appel par niveau visible, de 1 à 3 ;
- `fx.foule.ombre` en fait un ou deux : N1 à moins de 20 m, N2 au-delà ; en Légère, il n'y a pas d'ombre.

**Ailleurs que dans la vue principale :**

- les rétroviseurs ont leur propre contexte WebGL et leur propre vue, sans N0 ni ombre ;
- une perte de contexte change la génération du moteur, et les ressources sont recréées ;
- le gouverneur ne change que les bandes, les plafonds et les ombres (`vue.qualite`). Le public est bâti au palier
  ancre, comme le décor.

## Budget annoncé et tenu

| Palier | Spectateurs (7 circuits) | Niveaux | Triangles couleur (pire mesuré / borne testée) | Ombre | Appels ajoutés (mesurés) |
|---|---|---|---|---|---|
| Fine | 983 à 1 044 | N0 ≤ 48, N1 ≤ 360, N2 | 638 448 / 800 000 | oui | +4 à +5 |
| Moyenne | 446 à 485 | N1 ≤ 220, N2 | 184 608 / 300 000 | oui | +3 |
| Légère | 286 à 326 | N2 | 35 052 / 60 000 | non | +1 |

Le pire mesuré porte sur 18 vues par palier.

**Processeur, par image :** liste des niveaux et animation prennent 13 à 42 µs dans node, selon la charge de la
machine ; la borne testée est 1,5 ms. Dans le jeu, `listeMs` reste au plus à 0,1 ms, la résolution de l'horloge
de la page. Aucune allocation : 0 ramasse-miettes et 4 312 octets en tout sur 20 000 images.

**Chargement :** les maillages prennent 12 ms, une fois. Le public prend 17 à 18 ms au premier appel en Fine, puis
9 à 10 ms ; en Moyenne et en Légère, 6 à 7 ms.

## Mesures dans le jeu

Les captures ont été faites avec `tools/page-essai.mjs`, dans Chrome sans fenêtre sur le GPU du Mac, en 1440×900 :

- sur Val-Brûlé ;
- en Fine, sauf mention ;
- 3 s après le départ, quand la fête du départ vaut environ 0,55.

Le tableau donne les appels de dessin et les triangles de `rendu.stats`, ombre comprise, dans trois cas :

- **0.2.38** : les boîtes d'avant ;
- **sans** : le branchement appliqué, public caché ;
- **avec** : le public visible.

| Vue | 0.2.38 | Sans | Avec | Public : vus [N0, N1, N2] |
|---|---|---|---|---|
| 8 m d'une tribune | 124 / 390 579 | 124 / 314 787 | 128 / 803 689 | 74 [40, 59, 0], plafond N0 atteint |
| 40 m | 163 / 919 699 | 163 / 843 907 | 168 / 1 293 393 | 810 [3, 207, 661] |
| 150 m | 247 / 683 819 | 247 / 607 163 | 252 / 1 071 113 | 613 [5, 181, 495] |
| Passage en cockpit | 311 / 1 854 021 | 311 / 1 778 229 | 315 / 2 249 955 | 785 [0, 245, 630] |
| Pluie, 12 m | 134 / 426 655 | 134 / 350 863 | 138 / 716 187 | 59 [34, 54, 0] |
| Moyenne, 8 m | 108 / 284 301 | 108 / 208 509 | 111 / 342 065 | 43 [0, 43, 0] |
| Légère, 8 m | 71 / 117 689 | 71 / 79 793 | 72 / 84 359 | 31 [0, 0, 31] |

**Ce que coûtaient les boîtes :** environ 76 000 triangles et 3 150 instances par vue, sans appel de plus.

**Ce que coûte le public, en Fine :** de +365 000 à +489 000 triangles, couleur et ombre ensemble. La vue à 8 m
passe ainsi de 391 000 à 804 000 triangles, le passage en cockpit de 1,85 à 2,25 millions.

- En Moyenne, la vue à 8 m compte 20 % de triangles de plus qu'avec les boîtes.
- En Légère, elle en compte 28 % de moins.

**Temps GPU et cadence : aucune conclusion, aucun gain ni perte de FPS annoncé.**

- Les requêtes de temps d'ANGLE/Metal sont bruitées ici. Au profileur du moteur, à 8 m, la médiane donne 30,1 ms
  avec le public et 30,5 ms sans.
- Une requête placée autour des seuls appels du public donne 5,7 ms en médiane et 111 ms au pire, ce qui n'est pas
  crédible.
- Sur le même passage rejoué six fois, la médiane vaut 16,7 ms partout. Le p95 atteint 33 ms dans 5 passages sur 6,
  avec comme sans public : la machine était chargée.
- Le JavaScript du rendu prend de 0 à 0,4 ms de plus (médianes de 2,2 à 2,4 ms avec, de 2,0 à 2,2 ms sans).

Le détail est dans `mesures.json`.

## Qualification

**`node verifications/public.test.mjs`** (2 à 6 s). Il contrôle :

- la provenance ;
- les maillages ;
- le placement par les collisions du jeu sur les 7 circuits et les 3 paliers ;
- les toits et les abris ;
- le hasard propre et le déterminisme ;
- la variété ;
- la présence ;
- l'animation à 30, 60 et 120 images par seconde, et en écran partagé ;
- les listes et les plafonds ;
- la trame ;
- une vue WebGL simulée : rien n'est créé après la première image, et une perte de contexte est rétablie ;
- les allocations, dans un processus fils.

**Le test peut échouer.** Onze mutations du module le font toutes échouer, sur la version finale :

- allocation par image, dans la liste et dans l'animation ;
- faces inversées ;
- lissage par image ;
- `Math.random` ;
- neuf marches ;
- piliers ignorés ;
- toits ignorés ;
- glissières à l'abri ;
- pluie verticale ;
- blanc sur blanc.

**Contrôle des allocations.** Il était instable : environ une fois sur dix, il relevait 48 octets par image. Une
mesure séparée par partie a montré que ces octets venaient du harnais du test, qui rangeait des flottants à chaque
image, et pas du module. Le harnais passe désormais des objets préparés d'avance : 40 exécutions propres sur 40.

**Suite complète :** 67 suites vertes sur l'état commité, et 67 avec le branchement appliqué.

- Le branchement cassait d'abord `meteo.test.mjs` et `nature-integration.test.mjs`, qui évaluent de vraies lignes de
  `jeu.js`. C'est corrigé : la foule passe par `S.foulePublic` et `retro.foulePublic`.
- `decor.test.mjs` a échoué une fois sous forte charge, sur son critère de 150 ms. Les mesures de construction à
  froid sont les mêmes avec et sans le branchement (52 à 62 ms).

Le tout est dans `rapports/public-2026-11-18/mutations-et-suite.txt`.

## Contenu du rapport

Tout se trouve dans `rapports/public-2026-11-18/`.

**Captures** (JPEG). Elles ont été faites avec la construction 0.2.39 branchée (sha256 `66f78d4a…`). Le correctif
final ne déplace qu'une ligne du code des rétroviseurs ; le passage rejoué avec lui donne les mêmes statistiques.

- `avant-cubes-8m.jpg` et `avant-cubes-40m.jpg` : les boîtes de 0.2.38.
- `public-8m.jpg` et `public-8m-gros-plan.jpg`.
- `public-40m.jpg`.
- `public-150m.jpg`.
- `public-passage-cockpit.jpg`.
- `public-pluie-tribune-12m.jpg` : on est au sec sous le toit, avec des parapluies au premier rang.
- `public-pluie-glissieres.jpg` : à découvert, 43 parapluies, 38 capuches et 19 têtes nues sur 100 présents.
- `public-hiver-8m.jpg`.
- `public-moyenne-8m.jpg`.
- `public-legere-8m.jpg`.

**Données :**

- `rendu-stats.json` : `rendu.stats` avec et sans le public, et avec les boîtes de 0.2.38, vue par vue.
- `mesures.json` : temps GPU, cadence, chargement et allocations, avec leurs réserves.
- `test-public.txt` : le test sur l'état commité ; `test-public-avec-branchement.txt` : le même, branchement appliqué.
- `mutations-et-suite.txt` : les mutations et la suite complète.
- `integration.patch` : le correctif de branchement.

## Appliquer le branchement

Depuis la racine du dépôt :

```sh
git apply docs/reprise/rapports/public-2026-11-18/integration.patch
python3 construire.py
```

Dans la console du jeu :

- `BITUME_JEU.public.visible = false` puis `= true` compare l'image avec et sans le public ;
- `BITUME_JEU.public.mesure` donne la dernière image : vus, niveaux, triangles, ombre, plafond.

Ce que le correctif change :

- **`decor.js`** : avec `options.public`, les boîtes des marches ne sont plus posées, mais les mêmes nombres sont
  tirés. Le lointain garde la marche seule, et `decor.gradins` n'est pas énumérable.
- **`jeu.js`** :
  - création au chargement du circuit, et réglage de la présence par séance ;
  - animation et point d'accroche dans la vue principale, et rétroviseurs ;
  - `BITUME_JEU.public`.
- **`construire.py`** : `public.js` est ajouté après `humain-corps.js`.

## Ce qui reste

1. **Banc officiel non passé.** Il se fait sur le Mac, volet visible, en 1390×1295 : p95 ≤ 16,7 ms, pire ≤ 29 ms.
   Il faut le passer avec et sans public, en Fine, sur la ligne droite, avant toute publication.
2. **Réglages à confirmer selon le résultat du banc et à l'œil :**
   - le plafond N0 (48) ;
   - la distance « proche » de l'ombre (20 m) ;
   - les bandes de fondu.
3. **Coût GPU du public non isolé.** Les minuteries de cette machine ne le permettent pas.
4. **Nuit :** il n'y a pas d'éclairage propre au public (ni lampes ni téléphones), seulement la présence × 0,9.
5. **Neige :** pas de neige sur les épaules. Sous la neige, les abris sont ceux de la pluie.
6. **Stands :** ils n'ont pas de public, faute de terrasse dans le décor.
7. **Visages :** pas d'animation, pas de lèvres qui bougent.
8. **Branchement non commité.** Ni version, ni `dist`, ni publication.
