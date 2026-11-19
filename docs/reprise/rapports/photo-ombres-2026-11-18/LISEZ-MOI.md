# Ombres photo — lot 21, étape 1, 18 novembre 2026 (corrigé le 19 novembre)

**BITUME 0.2.41 sur FERRO 0.3.11 corrigé** (option `ombresPhoto`), sur la base `fluidite/integration` `4b994c4`, qui
porte le public des tribunes (lot 18). C'est l'étape 1 du plan du lot 21 (`docs/reprise/21-PHOTOREALISME.md`, commit
`a9ac32e`) : effets O1 à O5 (O6 est écarté par la consigne). Tout reste local : rien n'est poussé, fusionné ni mis en
ligne.

## Corrections après la relecture du 19 novembre

Une relecture adverse a relevé sept points. Chacun est repris ci-dessous, avec sa preuve. Deux restent ouverts en
partie : un coût fixe probable de l'option en Légère (point 1) et EMPRISE, qui n'est pas requalifié (point 6). Le
rebasage a fait apparaître un huitième point, plus grave que les sept autres (point 8), corrigé.

1. **Le coût n'était pas mesuré contre 0.3.10** (gravité 2). Le premier rapport ne comparait que des variantes d'une
   même séance : il ne voyait pas ce que l'option coûte effets coupés. Reproduit sur l'ancienne base, comme la
   relecture : en Fine cockpit, 0.3.11 tel que relu coûtait +1,95 ms tout allumé (la relecture : +1,8) et +0,80 ms
   tout coupé (8 tours). Le shader ne calcule plus que ce qu'un effet allumé demande : la projection dans la tuile
   seulement quand la tuile sert, la moyenne des bloqueurs seulement dans le bloc PCSS, et ce bloc n'est plus compilé
   (BITUME ne le demande plus) ; le contact est borné par une sphère. Sur la nouvelle base, 16 tours, 0.3.10 contre
   0.3.11 corrigé, tout coupé : de −1,5 à +0,45 ms selon la scène, des intervalles qui contiennent tous 0. Un témoin
   (la même page sans l'option, qui fait le travail du GPU de 0.3.10) et des passages en carré latin, jusqu'à 84 tours,
   précisent : sans l'option, 0.3.11 coûte ce que coûte 0.3.10 ; avec l'option, effets coupés, rien de mesurable en
   Fine, mais en Légère un fixe probable de 0,3 à 0,65 ms, côté GPU. Retirer du shader le code du contact ou celui du
   soleil ne l'a pas isolé : sa cause n'est pas trouvée et il n'est pas corrigé (voir « Ce qui reste »). Chiffres dans
   « Ce que ça coûte », dans `mesures/couts.txt` (§ 1 et 1 bis) et dans les deux README de FERRO.
2. **La base était périmée** (gravité 2). La branche est rebasée sur `fluidite/integration` (`4b994c4`). Tout est
   refait sur cette base : suites, contrôle des ombres, prises, cadrages, coûts. Les créations sont vérifiées par le
   chemin du joueur (`preparerSeance`, celle de `BITUME_JEU.preparer`) dans sept configurations : Fine cockpit avec
   rétroviseurs, duo, pluie, nuit, Moyenne poursuite, Légère, Auto. Rien n'est créé en course, rien après le voile.
   Les numéros de ligne des retouches de `src/jeu.js` sont ceux de la nouvelle base (voir plus bas).
3. **Coût mesuré contre coût prévu** (gravité 1). Une ligne par effet, avec son explication, dans « Ce que ça
   coûte ».
4. **La carte lointaine était calculée en Légère**, qui n'a pas d'ombres du soleil (gravité 1). Elle ne l'est plus
   quand aucun palier possible de la séance n'a d'ombres du soleil (Légère, ombres coupées dans le menu, rendu
   logiciel, GPU modeste) : 8 Mo et une passe de 97 appels (0,3 ms) en moins au lancement. Elle n'est plus refaite
   quand le décor ne change pas.
5. **Une fonction était créée à chaque image** dans FERRO (`photoBind`, gravité 1). Elle est au niveau du module ;
   FERRO est reconstruit, verrouillé et réinstallé. Mesure honnête : sous Node, `photoBind` alloue 56 octets de moins
   par image, mais le total du moteur ne baisse pas ; dans Chrome, rien ne change (180 puis 181 octets par image dans
   `photoBind`) : V8 ne l'allouait déjà pas. Le premier jet de cette correction annonçait « 56 octets en moins » : ce
   n'était vrai que sous Node. En cherchant, deux tableaux réalloués à chaque image ont été trouvés et corrigés : la
   page alloue 247 320 octets par image, contre 248 421 en 0.3.10 et 259 417 avant la correction.
6. **EMPRISE n'était pas requalifié** (gravité 1). C'est écrit dans `FERRO.json` de FERRO. Les empreintes du chemin
   par défaut couvrent huit jeux de réglages de création, dont ceux d'EMPRISE, de Point de rupture et de METAL, avec et
   sans foule de l'hôte.
7. **Une région du contrôle n'avait pas de verdict** (gravité 1). Deux scènes sont ajoutées : le cockpit sans rivaux
   (la région 3 passe : d2 +0,019 pour un seuil de 0,05) et la poursuite (la tuile tient l'ombre de la voiture :
   d2 −1,74). Le contrôle entre dans `tools/serie-fluidite.sh` (groupe `ombres`).
8. **Trouvé en rebasant : la foule effaçait l'habitacle** (grave). Le public du lot 18 dessine ses spectateurs au
   milieu du rendu de FERRO, avec ses propres textures sur les unités 8 et 9. 0.3.11 tel que relu y laissait son
   échantillonneur d'ombres : les tribunes étaient vides, et dès qu'un spectateur était à l'écran, l'habitacle
   disparaissait. Voir `foule-1-tribune-relu` contre `foule-1-tribune-corrige`, et `foule-2-habitacle-relu` contre
   `foule-2-habitacle-corrige`. FERRO rend ces unités à la foule pendant ses appels, puis reprend les siennes. Un test
   de FERRO le prouve (il échoue sur 0.3.11 tel que relu) ; sans l'option, les appels GL restent ceux de 0.3.10, foule
   comprise.

## Ce qui est plus beau

Le dossier `images/` contient onze vues en 1280 × 720. Chacune est prise avant (FERRO 0.3.10) et après (0.3.11
corrigé), à la même pose. Les fichiers `zoom-*` agrandissent la même zone des deux prises. Les vues 10 et 11 sont deux
des 80 cadrages du plan (voir « Contrôles »).

- **L'ombre de la voiture filmée est nette** (O3, tuile de 512²). On reconnaît les roues, l'aileron, l'arceau et les
  échappements dans l'ombre portée sur la piste. Avant, c'était une tache floue. Voir `2-poursuite-fine` et
  `zoom-a-poursuite-ombre`. En mouvement, elle ne bat plus : `zoom-i-poursuite-avec-tuile` et `-sans-tuile`.
- **La voiture filmée s'ombre elle-même** (O3). De près, le casque et l'arceau dessinent leur ombre sur le ponton, et
  les roues et l'aileron avant la leur sur la piste. Voir `10-voiture-34` et `11-voiture-haut`.
- **Le bras et la main ombrent l'habitacle** (O3). En cockpit, l'ombre du bras tombe sur le flanc. Voir
  `9-cockpit-fine-volant` et `zoom-g-cockpit-bras`.
- **Les arbres lointains ont une ombre** (O2). Avant, les ombres s'arrêtaient à 176 m devant le pilote. La carte
  lointaine est calculée une fois au lancement et couvre tout le circuit. Elle se fond dans le carré proche, sans
  couture. Voir `7-vue-haute`, `zoom-d-arbres-loin` et `zoom-b-cockpit-horizon`.
- **Les voitures touchent la piste** (O1) : un contact sombre sous la caisse et autour des pneus, dans les trois
  paliers. En Légère, où il n'y a pas d'ombres du soleil, c'est la seule ombre sous la voiture. Voir
  `4-exterieur-legere` et `zoom-c-legere-contact`. Sur la grille, l'effet est discret (`5-depart-grille`,
  `zoom-e-grille`).
- **Les ombres s'éclaircissent quand le ciel se couvre** (O4, part météo, gratuite). Sous la pluie, l'ombre de la
  voiture est plus claire, mais elle reste nette, alors qu'un ciel de pluie la voudrait floue (voir « Ce qui reste »).
  Voir `8-poursuite-pluie` et `zoom-f-pluie-ombre`.
- Le cockpit en Moyenne et la tribune changent peu : 2,4 % et 0,7 % des pixels, surtout par le contact et les arbres
  lointains.

`mesures/ecarts.txt` chiffre les onze paires. Dans sept des neuf premières vues, de 98,2 à 100 % des pixels qui
changent s'assombrissent. Les deux autres cas :

- en poursuite Fine, 72 % seulement s'assombrissent : l'ombre nette rend la lumière à ce que couvrait l'ancienne
  tache floue ;
- sous la pluie, 37 % seulement, car les ombres s'éclaircissent.

Les voitures vues de près (vues 10 et 11) changent sur 18 et 15 % des pixels, dont 81 et 76 % s'assombrissent.

Les prises sont refaites le 19/11 avec un outil corrigé : le voile de chargement et l'apparition de la vue de course
s'effacent en 0,3 s de temps réel, et une prise pouvait tomber pendant ce fondu (toute l'image plus claire ou plus
sombre de 3 à 12 niveaux d'une prise à l'autre). `mesures/outils/prise.js` cache le voile et fige les transitions.
Deux prises de la même page sont maintenant identiques au pixel près dans huit vues sur onze avant et neuf sur onze
après. Restent : 157 et 140 pixels (0,02 %) sur les vues 5 et 6 de 0.3.10 ; sous la pluie (vue 8), 1,5 % des pixels pour
0.3.10 et 0,1 % pour 0.3.11 ; 2,1 % en poursuite Fine pour 0.3.11, sur les contours des arbres de l'horizon et des voitures, deux états d'une prise à
l'autre dont la cause n'est pas trouvée (pas l'ombre : le motif suit les bords de tout le décor). Le zoom
`zoom-h-casquette-*`, pris le 18/11 sur l'ancienne base, explique le choix de la tuile de 512² (voir « Choix »).

## Ce que ça coûte

Mesures sur le Mac de David (M5, 24 Go, macOS 27.2.1), avec Chrome 157 sans fenêtre, à Val-Brûlé, au soleil,
rétroviseurs coupés, la machine partagée avec d'autres travaux. On mesure le temps de l'image principale en attendant
la fin du GPU. Méthode des séances alternées (§ 2.5 du plan) : dans une séance, les variantes se mêlent image par image
dans un ordre tiré au hasard ; d'une construction à l'autre, une séance par page à chaque tour, dans l'ordre inverse un
tour sur deux. On donne la médiane des tours et, entre crochets, l'intervalle où tombent 90 % des médianes
ré-échantillonnées : ce que le nombre de tours permet de séparer. Écarts en millisecondes par image. Détails dans
`mesures/couts.txt` ; une ligne par séance dans `mesures/couts-seances.log`.

**0.3.10 contre 0.3.11 corrigé**, 16 tours (page finale) :

| Palier (toile) | Vue | Image 0.3.10 | Tout allumé | Tout coupé (coût fixe) | Les quatre effets, même séance |
|---|---|---|---|---|---|
| Fine (2880 × 1514) | cockpit | 14,3 ms | +0,45 [+0,20 ; +1,60] | −0,35 [−0,75 ; +0,30] | +0,90 [+0,80 ; +1,00] |
| Fine | poursuite | 14,9 ms | +0,40 [−0,90 ; +1,15] | −1,50 [−1,85 ; +0,45] | +0,85 [+0,65 ; +1,00] |
| Moyenne (1440 × 757) | cockpit | 13,9 ms | +0,65 [−0,45 ; +1,95] | 0,00 [−0,60 ; +1,30] | +0,50 [+0,45 ; +0,75] |
| Légère (1152 × 606) | cockpit | 7,3 ms | +0,30 [−0,75 ; +1,65] | +0,45 [−0,30 ; +1,15] | +0,20 [+0,20 ; +0,30] |

- Le coût des effets se mesure bien dans une même séance (dernière colonne, intervalles étroits). D'une construction à
  l'autre, une séance sur dix tombe dans un état plus lent ou plus rapide de la machine, et les intervalles sont
  larges : à 16 tours, on ne sépare pas un coût fixe de moins d'environ 1 ms.
- En Moyenne, le coût des quatre effets dans une même séance change d'une campagne à l'autre, selon l'état de la
  machine : +0,50 ms ici, +0,85 et +1,10 ms dans les deux passages du témoin (tableau suivant).

**Témoin et coût fixe** (`mesures/couts.txt`, § 1 bis). Une troisième page sert de témoin : la page finale sans
`ombresPhoto` dans ses options de création. FERRO 0.3.11 y fait les shaders et les appels GL de 0.3.10. Les pages
passent dans un ordre en carré latin : chacune autant de fois à chaque place du bloc (un premier passage, dans l'ordre
ABC puis CBA, laissait le témoin toujours au milieu). Réunion des passages, en ms par image, avec le nombre de tours :

| Palier | Témoin : sans l'option − 0.3.10 | Avec − sans l'option, tout coupé | Avec l'option − 0.3.10, tout coupé | Avec l'option − 0.3.10, tout allumé |
|---|---|---|---|---|
| Moyenne cockpit | +0,40 [−0,35 ; +1,10] (44) | +0,25 [−0,10 ; +0,85] (44) | +0,65 [0,00 ; +1,00] (60) | +1,40 [+0,65 ; +1,80] (60) |
| Légère cockpit | −0,05 [−0,50 ; +0,30] (44) | +0,65 [+0,20 ; +1,00] (44) | +0,35 [0,00 ; +0,80] (84) | +0,45 [+0,20 ; +0,90] (84) |

- Sans l'option, 0.3.11 coûte ce que coûte 0.3.10 : le témoin vaut 0. Un jeu qui ne demande pas l'option ne paie rien.
- En Légère, l'option coûte probablement un fixe de 0,3 à 0,65 ms selon le contraste, en plus du contact (+0,2 ms) :
  contact allumé, +0,45 ms contre 0.3.10, environ 5 % de l'image sur le M5.
- Ce fixe se paie côté GPU : le temps processeur de `rendu.draw`, mesuré sans attendre le GPU, est le même sur les
  trois pages (0,8 ms en Légère, 1,2 ms en Moyenne). Deux pages de diagnostic, sans le code du soleil ou sans celui du
  contact dans le shader, ne l'ont pas isolé (24 tours) : sa cause n'est pas trouvée.
- En Moyenne, le fixe ne se sépare pas du bruit. En Fine cockpit, il n'y en a pas (−0,35 [−0,75 ; +0,30]).

**Effet par effet**, même séance (coût = image avec tout − image sans cet effet), 8 tours, comparé au plan :

| Effet | Prévu (plan, en Fine) | Fine cockpit | Fine poursuite | Moyenne | Légère | Pourquoi |
|---|---|---|---|---|---|---|
| O1 contact | 0,1 à 0,3 ms (estimé) | +0,45 [+0,20 ; +0,75] | +1,05 [+0,20 ; +1,20] | +0,25 [−0,45 ; +0,75] | +0,30 [+0,20 ; +0,45] | au-dessus du plan, voir plus bas |
| O3 tuile 512² | 0,1 à 0,2 ms (estimé) | +0,30 [+0,05 ; +0,65] | +0,55 [−0,05 ; +1,00] | +0,50 [+0,20 ; +1,05] | — | au-dessus du plan, voir plus bas |
| O2 carte lointaine | une lecture, 8 Mo | 0,00 [−0,30 ; +0,25] | +0,30 [−0,20 ; +0,45] | +0,05 [−0,20 ; +0,30] | — | comme prévu ; 0,9 ms au lancement |
| O4 pénombre météo | gratuite (PCSS : 0,3 à 0,6) | +0,10 [−0,10 ; +0,15] | +0,45 [−0,20 ; +0,85] | +0,05 [−0,30 ; +0,65] | — | comme prévu ; PCSS coupée |

- **Contact (O1)** : le plan comptait environ 20 opérations par voiture et par pixel de sol proche. FERRO calcule
  l'occlusion de cinq ellipsoïdes par voiture (la caisse et les quatre roues), jusqu'à six voitures, sur tous les
  pixels du monde à leur portée, pas seulement le sol : en poursuite, les voitures proches couvrent une grande part de
  l'écran, d'où +1 ms. La sphère ajoutée par la correction évite le calcul loin des voitures, pas près d'elles. Pour le
  réduire : une seule ellipsoïde pour les voitures lointaines, ou moins de voitures en Fine. Pas fait dans ce lot.
- **Tuile (O3)** : le plan comptait la passe d'une voiture et neuf lectures sur ses seuls pixels. La passe trace la
  voiture et tout l'habitacle (31 appels en cockpit, 35 en poursuite), et la tuile est lue sur tous les pixels de sa
  boîte de 7 m : en cockpit, presque toute la moitié basse de l'écran.
- **Carte lointaine (O2)** : rien de mesurable en course. Au lancement : 0,9 ms (de 0,4 à 1,9 ms sur 236 séances),
  386 appels, 8 Mo.
- **Pénombre (O4)** : seule la part météo, gratuite, est allumée. PCSS n'est plus compilée.
- En Légère, seul le contact est actif (quatre voitures) : +0,2 à +0,3 ms dans une même séance sur le M5, soit 3 à 4 %
  de l'image ; avec le fixe probable de l'option, environ +0,45 ms contre 0.3.10 (tableau du témoin). Une machine
  modeste n'est pas mesurée (voir « Ce qui reste »).
- La préparation côté jeu (`B.ombres.preparer`) prend 1,0 µs par vue, sans allocation. Mémoire graphique : 8 Mo pour
  la carte lointaine (2048², profondeur 16 bits) et 0,5 Mo pour la tuile.
- Appels de dessin, à image identique (`mesures/appels.txt`) : tout coupé, 0.3.11 fait exactement les appels de 0.3.10
  (416 en Fine cockpit, 413 en Fine poursuite, 382 en Moyenne, 181 en Légère) ; seule la tuile en ajoute.

## Contrôles

- **Image stable** (O5, `tools/controle-ombres.mjs`, lancé par `tools/serie-fluidite.sh <page> <dossier> ombres` ;
  résultats dans `mesures/controle-ombres.json`, essais dans `mesures/diagnostics.txt`) :
  - un arbre à 33 m de la piste, décor immobile, caméra fixe, la voiture qui passe avec le carré d'ombre et la tuile
    qui la suivent : **d1 = 0,0079** en Fine pour un seuil de 0,01, autant que sans aucune ombre (0,0080) ; FERRO
    0.3.10 donnait 0,0085 ; en Moyenne, 0,0053 ;
  - habitacle immobile à l'écran, en ligne droite : la tuile ajoute de +0,003 à +0,024 en d2 selon la région, pour un
    seuil de 0,05. Avec les rivaux, la région 3 (le flanc droit) bouge sous leurs ombres, avec ou sans tuile : elle
    est relevée sans verdict. Sans rivaux, elle passe (+0,019) ;
  - en poursuite, sans rivaux : sans la tuile, le bord flou de l'ombre de la voiture bat d'une image à l'autre
    (d2 3,20) ; avec elle, il tient (d2 1,46, le reste vient du grain de la piste qui défile).
- **Journal du gouverneur Auto** : `B.ombres.journal()` note chaque changement de niveau ou d'ombres. Sur 10 s de
  course, il note un changement : niveau 0, ombres allumées.
- **Rien n'est créé en course** : par le chemin du joueur (menu, préparation sous le voile et préchauffage, départ,
  15 s de course), `stats.creations` vaut 0 en course et aucune variante n'est créée après le voile, dans les sept
  configurations, comme en 0.3.10 (`mesures/creations-fin2.log` et `creations-a2.log`). Pendant les 744 séances de
  mesure du coût, 0 aussi.
- **Allocations** : la page entière dans Chrome (Fine cockpit, 300 images) alloue 247 320 octets par image, contre
  248 421 en 0.3.10 ; les fonctions photo de FERRO environ 250 (des nombres mis en boîte aux appels GL). Le reste vient
  du jeu et du rendu de 0.3.10 (`mesures/diagnostics.txt`, point 6). `verifications/ombres.test.mjs` vérifie que la
  préparation côté jeu n'alloue rien, et le test de FERRO que la répartition de la tuile n'alloue rien.
- **Les 80 cadrages du plan** (§ 7.3, `mesures/cadrages-plan.txt`), pris avant et après avec le même outil, sans
  erreur de page :
  - de jour, en cockpit et en bord de piste : de 0,7 à 4,9 % des pixels changent, tous plus sombres ;
  - crépuscule et nuit : de 0,03 à 2,8 % ; saisons : de 2 à 5,9 % ;
  - pluie et piste mouillée : de 0,6 à 6 %, dont 18 à 89 % seulement s'assombrissent (la part météo éclaircit) ;
  - eau et falaises : aucun pixel ; tunnel : de 1 à 11 pixels ; voitures vues de près : de 11 à 19 % ;
  - deux passages sur la même page 0.3.10 : 74 cadrages sur 80 identiques au pixel près, les six autres à 0,16 % au
    plus.
- **Sans l'option, FERRO 0.3.11 donne exactement l'image de 0.3.10** : mêmes shaders et mêmes appels GL, pour huit
  jeux de réglages de création, avec et sans foule de l'hôte. Un test de FERRO le prouve par empreintes
  (`tests/ferro/renderer-ombres-photo.test.mjs`).
- **Suites** (`mesures/verifications.txt`, `mesures/suites-hote.log`) :
  - FERRO : 195 tests, 194 réussis, 0 échec, 1 « todo » déjà présent en 0.3.10 ; le fichier des ombres photo :
    13 tests sur 13 ;
  - BITUME : 88 suites sur 88, dont `ombres.test.mjs` (10 tests) ;
  - parcours `smoke` sans fenêtre : 7 contrôles, 0 erreur, 0 avertissement.

## Retouches de src/jeu.js

`src/jeu.js` est modifié en même temps par d'autres lots : ce lot y touche le moins possible. Écart avec la base
`4b994c4`, numéros de ligne de la branche :

- l. 264–265, dans `lancer()` : la carte lointaine, une passe par décor, sautée quand aucune ombre du soleil n'est
  possible (`B.ombres.carte` et `B.ombres.ombresPossibles`). Le premier jet l'avait mise dans `installer()` ;
- l. 1995, au niveau du module : `const etatOmbres = B.ombres.creer();` ;
- l. 2220, 2224, 2235 et 2245, dans `rendreVue()` : les bornes `ombreDebut` et `ombreFin` des objets de la voiture
  filmée dans la liste de l'image ;
- l. 2304, dans `rendreVue()` : `B.ombres.preparer(…)`, une fois par vue ;
- l. 2309, dans `rendreVue()` : `rendu.draw` reçoit `contacts`, `ombreProche` et `penombre` ;
- l. 4038–4040, dans `demarrer()` : les options de création `ombresPhoto: { tuile: 512, pcss: … }`, le bloc PCSS
  seulement si `B.ombres.reglages.pcssFine` le demande.

Dix lignes ajoutées, deux remplacées. Le reste est dans `src/ombres.js`.

## Choix

- **Tuile de 512²** et non de 1024². À 1024² (texels de 7 mm), la casquette de la planche, mince et à facettes,
  projette des dents de scie qui rampent quand la caisse tangue : +0,11 en d2, au-dessus du seuil. À 512²
  (texels de 14 mm), les dents disparaissent et l'ombre du bras reste nette. Comparer `zoom-h-casquette-tuile1024`
  et `zoom-h-casquette-tuile512` (prises du 18/11, gardées comme preuve de ce choix).
- **Pénombre variable (PCSS) coupée, et plus compilée.** Elle faisait trembler l'ombre d'un arbre au passage de la
  voiture : d1 = 0,033 dans la première version, 0,012 une fois sa grille accrochée au monde, toujours au-dessus du
  seuil de 0,01. Seule la part météo, gratuite, est allumée, en Moyenne et en Fine. Depuis la correction, BITUME
  demande à FERRO un shader sans le bloc PCSS (`ombresPhoto.pcss: false`). Pour la rallumer en Fine, mettre
  `B.ombres.reglages.pcssFine = true` avant la création du rendu. Le plan (§ 7.4) la faisait de toute façon attendre
  les gains du lot 5B.
- **Contact allumé en Légère**, avec quatre voitures au plus : +0,2 à +0,3 ms dans une même séance sur le M5, environ
  +0,45 ms contre 0.3.10 avec le fixe probable de l'option. Le plan en fait une décision de David (question 6).
  `B.ombres.reglages.contactLegere = false` coupe le contact, pas le fixe.
- **Pas de carte lointaine sans ombres du soleil.** La carte n'est calculée que si un des paliers que la séance peut
  prendre a des ombres du soleil (`B.ombres.ombresPossibles`). Elle ne l'est donc pas en Légère (sauf si le menu force
  les ombres), avec les ombres coupées dans le menu, en rendu logiciel ni sur un GPU modeste. En Auto, elle l'est :
  les paliers hauts restent atteignables.

Le détail des essais écartés est dans `mesures/diagnostics.txt`.

## Ce qui reste

- **Fine dépasse déjà son budget** : le rapport de fluidité du 18/11 montre qu'elle rate une image sur quatre en cockpit
  avec les rétroviseurs. Ce lot y ajoute environ 0,9 ms (même séance), et de 0,5 à 1,1 ms en Moyenne (+1,4 ms contre
  0.3.10 tout allumé, sur 60 tours). Le seul effet de ce lot que
  le § 7.4 réserve à l'après-5B est O4 : seule sa part gratuite (météo) est allumée. Il faudra remesurer après le 5B.
- **Contact et tuile coûtent plus que prévu** en Fine (voir « Ce que ça coûte ») ; pistes de réduction non faites.
- **Coût fixe probable en Légère**, effets coupés : de 0,3 à 0,65 ms côté GPU, cause non trouvée, non corrigé. Le
  contact de la Légère coûte donc, contre 0.3.10, environ 0,45 ms et non 0,2. Couper le contact
  (`B.ombres.reglages.contactLegere = false`) n'enlève pas ce fixe : l'option est prise à la création du rendu. À
  remesurer sur une machine calme, puis sur une machine modeste ; s'il se confirme, chercher sa cause côté GPU avant de
  compiler une variante du shader.
- **Pas mesuré** :
  - sur une machine modeste, en particulier le contact en Légère ;
  - en fenêtre visible, à cadence réelle (`tools/profil-accrocs.mjs`) : la consigne interdisait d'ouvrir une fenêtre
    Chrome ;
  - au chronomètre GPU, effet par effet : les requêtes de temps GPU de Chrome se contredisaient sur ce Mac
    (`mesures/diagnostics.txt`, point 4). Les coûts sont des temps synchronisés ;
  - en mode duo, où le contact et la tuile sont préparés pour chacune des deux vues (les créations, elles, sont
    vérifiées en duo) ;
  - le temps de compilation des nouveaux shaders au lancement.
- **Allocations restantes** : environ 250 octets par image dans les fonctions photo de FERRO (nombres mis en boîte aux
  appels GL), et ce que la base allouait déjà (environ 153 000 octets par image dans la préparation des objets du jeu).
- **La tuile ne s'adoucit pas sous un ciel couvert.** Sous la pluie, l'ombre de la voiture filmée reste nette, plus
  claire seulement. Il faudra l'élargir avec la couverture nuageuse.
- **PCSS** : il faudra accrocher au monde la profondeur de l'atlas, comme sa grille, puis remesurer le tremblement.
- **EMPRISE** n'est pas requalifié sur 0.3.11 (ses suites ne sont pas lancées) ; les empreintes prouvent seulement que
  son chemin par défaut ne change pas.
- **La carte lointaine** ignore le vent et suppose un soleil fixe : BITUME garde la même direction du soleil pour
  chaque circuit.
- L'ombre d'une autre voiture sur la voiture filmée vient encore de l'atlas, pas de la tuile.
- WebGPU n'est pas porté : l'image y reste celle de 0.3.10.
- Les scènes du banc (`scene-bench.js`) posent leurs propres lots de décor : elles n'ont pas de carte lointaine.
- O6 n'est pas traité : il était écarté par la consigne.

## Contenu du dossier

- `images/` : les onze paires avant/après, leurs zooms, la poursuite en mouvement avec et sans la tuile (`zoom-i-*`)
  et les deux paires de la foule (JPEG ; provenance et empreintes des prises dans `mesures/prises.json`). Tout est
  refait le 19/11 sur la nouvelle base, sauf `zoom-h-casquette-*` (18/11, ancienne base, preuve du choix de la tuile).
- `mesures/` :
  - `couts.txt` et `couts-seances.log` : les coûts (et, en fin de fichier, ceux du 18/11 pour mémoire) ;
  - `appels.txt`, `creations-fin2.log` et `creations-a2.log` : les appels de dessin et les créations ;
  - `controle-ombres.json` et `diagnostics.txt` : la stabilité, les essais écartés et les points 5 à 10 de la
    correction (coût fixe, allocations, ordre des variantes, carte en Légère, foule, prises) ;
  - `ecarts.txt` et `prises.json` : les écarts des onze paires, avec les témoins, et la provenance des prises ;
  - `cadrages-plan.txt` : les 80 cadrages du plan, avant et après ;
  - `verifications.txt` et `suites-hote.log` : les suites, la construction, l'installation et le parcours `smoke` ;
  - `outils/` :
    - prises : `prendre.py`, `prise.js` et `images.py`, avec leurs listes `vues11.json` et `cadrages-plan.json` ;
      comparaison : `comparer.mjs` et `ecarts_cadrages.py` ;
    - coûts : `seances.py` (pages dans l'ordre ABC puis CBA) et `seances_latin.py` (carré latin), leurs modèles de
      séance, `modele.js` (alternance stricte), `modele2.js` et `modele3.js` (ordre au hasard), `modele4.js` (plus le
      temps processeur de `rendu.draw`), avec les plans `plan-*.json` ; `resume.py` et `resume_effets.py` les
      résument ;
    - `creations/` (créations par le chemin du joueur), `sonde/` (la foule dans les scènes chronométrées),
      `poursuite/` (la poursuite avec et sans la tuile) ;
    - allocations : `allocations-page.mjs` (Chrome) et `resume_allocations.py`, `fermeture.test.mjs` (Node) ;
    - `faire_couts.py` (avec `couts-entete.txt`, `couts-temoin.txt` et `couts-annexe.txt`), `faire_prises.py` et
      `faire_cadrages.py` composent `couts.txt`, `ecarts.txt`, `prises.json` et `cadrages-plan.txt` à partir du
      dossier de travail du 19/11, qui n'est pas gardé : ils montrent comment ces fichiers sont faits ;
    - les scripts du 18/11 (`couts.py`, `couts.js`, `resume_couts.py`, `plan-couts.json`, `vues.json`), pour les
      mesures gardées en fin de `couts.txt` ;
    - exemple : `python3 mesures/outils/prendre.py dist/bitume.html mesures/outils/vues11.json /tmp/prises`.
