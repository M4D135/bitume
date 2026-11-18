# Lot 26 — animaux des abords

David, 18/11 : « fais aussi des animaux PNJ pour décorer, ils font leur vie, bougent etc ; selon le biome animaux
différents pour marquer l endroit, identité etc ». En plus de la petite faune de `src/faune.js` (insectes, lucioles),
des bêtes visibles, propres à chaque biome, qui vivent leur vie hors de la chaussée et réagissent au peloton.

## Résultat — 18 novembre 2026

Étude livrée sur la branche `etude/animaux` (base `268ec0f`), **sans toucher aux sources existantes** :

- `src/animaux.js` : le module (bestiaire, formes, placement, cerveau, dessin) ;
- `verifications/animaux.test.mjs` : 13 contrôles ;
- `tools/planche-animaux.mjs` : les captures et les chiffres du rendu dans le vrai jeu ;
- `docs/reprise/rapports/animaux-2026-11-18/` : 37 captures, `mesures.json`, `integration.patch`, `tests.log`.

Le branchement dans le jeu tient en 33 lignes (`src/jeu.js` et une ligne de `construire.py`), livrées en
`integration.patch` et **non appliquées** au dépôt. La démonstration a été faite dans le vrai jeu avec ce patch
appliqué localement (page 0.2.40 reconstruite), puis retirée. Le patch s'applique tel quel sur `268ec0f` et sur
`86b1735` (tête de `deploy-origin-main` le 18/11 au soir).

En chiffres, au palier Élevé :

- 23 espèces sur 18 modèles, soit 196 formes et 46 810 triangles bâtis une fois au chargement de la page (63 à 70 ms) ;
- par circuit, 23 à 34 bêtes au sol en 3 à 7 groupes, et 1 à 24 volants (oiseaux, et la baleine au Pacifique) ;
- aucune bête à moins de 34 m de l'axe, ni dans le dégagement, l'enceinte des stands ou les abords du tunnel ;
- en 75 s de course, chaque biome montre au moins un groupe qui fuit devant le peloton ;
- coût en course : 0,02 à 0,06 ms par pas du cerveau (10 pas par seconde) et 0,03 à 0,07 ms de dessin par image ;
- de +6 à +28 appels de dessin par image, jusqu'à +57 000 triangles (ombres comprises) quand un troupeau est tout près
  de la caméra ;
- Légère : au plus 14 silhouettes lointaines d'une pièce chacune (+3 appels de dessin mesurés).

## Bestiaire : une identité par biome

| Circuit | Biome | Au sol | En l'air, en mer | Ce qu'il dit du lieu |
|---|---|---|---|---|
| Val-Brûlé | forêt | cerf élaphe, sanglier | buse variable | forêt tempérée, lisières et sous-bois |
| Port-Sable | côte | cheval de Camargue, flamant rose (dans l'eau peu profonde) | goéland | Camargue, étangs et littoral |
| Haut-Col | montagne | bouquetin des Alpes, marmotte (sauf l'hiver) | aigle royal | alpages et pentes rocheuses |
| Lande-Noire | islande | cheval islandais, mouton islandais (sauf l'hiver) | oie cendrée en vol migrateur (sauf l'hiver) | lande volcanique |
| Roche-Fauve | désert | girafe, oryx gazelle, autruche | vautour | hauts plateaux d'Afrique |
| Brume-de-Jade | asie | buffle d'eau, grande aigrette | milan noir | terrasses et rizières d'Asie |
| Cap-Séquoia | pacifique | wapiti de Roosevelt | pélican brun le long de la côte, baleine au large, urubu à tête rouge | côte Pacifique nord-américaine |

Les espèces proches partagent un modèle, ce qui fait 18 modèles. Le wapiti est un cerf plus grand et le cheval
islandais un camarguais plus trapu, à la crinière épaisse.

Chaque bête est un individu, tiré une fois au placement :

- robe ou plumage pris dans une palette (six robes d'islandais, cinq laines de mouton) ;
- taille de 0,9 à 1,08 ;
- mâles plus grands, avec bois ou cornes ;
- jeunes à la belle saison ;
- pelage d'hiver plus terne ;
- cerfs et wapitis sans bois au printemps.

Tout est bâti en code : fuseaux lissés en super-ellipses, tubes le long de courbes et formes libres du moteur
(`FRender.forme`). Il n'y a ni fichier d'image ni dépendance.

## Vie au calme

Chaque bête tire ses activités au hasard du groupe : brouter (tête au sol, petits pas), guetter (tête haute), marcher
vers un point de son domaine, ou se coucher. Trois activités sont propres à une espèce :

- la sentinelle : une marmotte du groupe dressée sur ses pattes arrière, à tour de rôle ;
- le repos sur une patte : le flamant ;
- le terrier : la marmotte.

Les poids changent selon la famille. Les échassiers broutent plus et ne se couchent pas ; les autruches se couchent
rarement.

- **Nuit** : les diurnes se couchent (26 % de bêtes au repos le jour, 74 % la nuit), les marmottes rentrent au terrier
  et les sangliers se réveillent ; le jour, ces derniers dorment au couvert. Sauf chez le sanglier, les yeux des
  quadrupèdes tournés vers la caméra brillent dans les 140 m (tapis clair).
- **Averse et nuit** : les rapaces quittent le ciel sous l'averse et la nuit. Les migrateurs et les pélicans ne volent
  pas de nuit ; les goélands ne disparaissent qu'en pleine nuit ; la baleine est toujours là.
- **Saisons** : le réglage de saison du jeu décide des absents, des jeunes, des bois et des robes (voir plus haut).

Le cerveau avance par pas fixes de 0,1 s sur l'horloge de la course, avec son propre hasard : jamais `Math.random`,
jamais celui de la course. L'affichage interpole entre deux pas, avec un pas de retard. Les bêtes font donc les mêmes
trajets à 30, 60 ou 120 images par seconde, sans double pas ni arrêt à chaque dixième de seconde.

## Le peloton passe : alerte, fuite, refuge, retour

Chaque groupe suit cinq états :

1. **Calme** : les activités ci-dessus.
2. **Alerte** : têtes hautes, tournées vers le bruit ; certaines bêtes couchées restent couchées, la tête levée ; les
   échassiers s'éloignent au pas ; les marmottes se dressent.
3. **Fuite** : galop vers un refuge choisi au placement, plus loin de la piste et atteignable en ligne droite. Les
   bouquetins montent, les sangliers rentrent sous les arbres, les marmottes plongent au terrier. Les échassiers
   (flamants, aigrettes) s'envolent si leur refuge le permet sans repasser au-dessus du dégagement.
4. **Refuge** : 8 s de méfiance, puis de nouveau le broutage, la tête relevée souvent, pendant 16 à 32 s de calme.
5. **Retour** : au pas, vers le domaine. Le délai de garde suit la distance du refuge (40 s plus 1 s par mètre), pour
   qu'un troupeau dont le refuge est à 165 m ne redevienne pas calme à mi-chemin.

Les distances d'alerte et de fuite sont celles d'un promeneur :

| Espèce | Alerte | Fuite | Espèce | Alerte | Fuite |
|---|---:|---:|---|---:|---:|
| cerf | 150 m | 85 m | girafe | 170 m | 80 m |
| sanglier | 90 m | 55 m | oryx | 170 m | 100 m |
| camarguais | 120 m | 60 m | autruche | 160 m | 90 m |
| flamant | 140 m | 90 m | buffle | 60 m | 32 m |
| bouquetin | 110 m | 55 m | aigrette | 90 m | 55 m |
| marmotte | 110 m | 75 m | wapiti | 130 m | 70 m |
| islandais | 110 m | 55 m | mouton | 80 m | 42 m |

Une monoplace lancée effraie de plus loin qu'un promeneur. Le facteur est de 1 + (v − 20 m/s) / 70, borné entre 1 et
1,6 : ×1,5 à 200 km/h, ×1,6 au-delà de 230 km/h. Une voiture arrêtée (moins de 3 m/s) n'effraie plus.

L'**accoutumance** suit les fuites. Chaque fuite rapproche les seuils de 14 %, jusqu'à 45 % des distances d'origine ;
le calme les rétablit lentement (0,2 % par seconde). Au fil des tours, les bêtes fuient donc moins souvent sans cesser
de lever la tête.

Mesuré sur Val-Brûlé (contrôle 4) : les cerfs gagnent 39 m vers leur refuge en 8 s et retrouvent le calme 116 s après
le passage. Le galop atteint 11 m/s.

## Oiseaux et baleine

- **Rapaces** (buse, aigle, vautour, milan, urubu) : ils tournent en thermique à 40-160 m.
- **Migrateurs** (oies) : un vol en V traverse le ciel du circuit.
- **Oiseaux de côte** (goélands, pélicans) : ils longent le rivage à 4-22 m.
- **Baleine** : au large, à plus de 120 m de la piste et par plus de 8 m d'eau, elle fait surface, souffle et replonge.

Les oiseaux en vol ne sont pas touchés par le peloton ; les échassiers au sol fuient comme les troupeaux.

## Où elles vivent (placement)

Le placement est fait une fois par scène, sur une grille de 4 m qui couvre le circuit plus 440 m de marge. Pour chaque
case, la grille calcule :

- la distance exacte à l'axe jusqu'à 64 m, puis un chanfrein au-delà ;
- la hauteur et la pente du sol réel, c'est-à-dire du maillage rendu, pour que les sabots ne flottent pas ;
- l'eau et la densité d'arbres ;
- les obstacles posés au sol par le décor : bâtiments, tribunes, murets, glissières, troncs et roches.

Chaque espèce a son habitat : une bande de distance à la piste, une pente, de l'eau ou non, la densité d'arbres
voulue, un rayon de domaine et un espacement entre groupes.

Sont interdits :

- moins de 34 m de l'axe ;
- le dégagement, plus 14 m au-delà de sa limite ;
- l'enceinte des stands et des tribunes (140 m) ;
- les abords et le dessus du tunnel (70 m, et 60 m au-delà de ses bouches).

Le premier groupe de chaque espèce est cherché d'abord dans la bande où le peloton le dérange, c'est-à-dire entre le
bord de l'habitat et 1,45 fois sa distance de fuite. Chaque biome montre ainsi au moins une fuite depuis la piste. Les
autres groupes vont partout dans l'habitat. Le placement est reproductible, sans `Math.random`, et ne retouche pas le
décor.

Groupes vus dans la vraie page (Élevé, été) et leur réaction pendant les 75 premières secondes de course
(F : fuite, A : alerte, — : calme) :

| Circuit | Groupes (espèce, distance à l'axe, réaction) |
|---|---|
| Val-Brûlé | cerf 63 m F, 97 m F, 172 m A ; sanglier 71 m F, 74 m F, 64 m — |
| Port-Sable | camarguais 50 m F, 67 m F, 313 m — ; flamant 162 m A |
| Haut-Col | bouquetin 323 à 436 m — (quatre groupes) ; marmotte 66 m F, 55 m F |
| Lande-Noire | islandais 57 m F, 68 m F, 259 m — ; mouton 48 m F, 279 m —, 150 m — |
| Roche-Fauve | girafe 82 m A, 126 m F ; oryx 106 m F, 78 m F, 93 m F ; autruche 63 m F, 144 m F |
| Brume-de-Jade | buffle 59 m A, 84 m A, 141 m — ; aigrette 60 m F, 197 m —, 169 m — |
| Cap-Séquoia | wapiti 52 m F, 254 m —, 131 m A |

## Coût

Tout est préparé au chargement de la page et à la création de la scène. En course, rien n'est alloué au dessin, et
rien n'est coupé à cause de la distance : le détail suit la taille à l'écran, jusqu'à la silhouette d'une seule pièce.
Seules disparaissent les bêtes de moins de 0,6 à 0,9 pixel de haut.

### Chargement et scène

- **Formes** : 196 formes, 46 810 triangles, bâties au chargement du module en 63 à 70 ms dans la page (30 à 45 ms
  dans Node).
- **Création par scène** (`creation-page.json`, deux séries) :
  - code chaud : de 27 à 47 ms par circuit dans la première série, où tout était 2 à 3 fois plus lent, décor compris ;
    de 11 à 25 ms dans la seconde ;
  - toute première création de la page, qui paie la compilation : 86 ms dans la première série, 47 ms dans la seconde ;
  - construction de la scène elle-même, pour comparer : 217 à 1 885 ms dans la première série, 85 à 694 ms dans la
    seconde ;
  - pendant la planche, qui enchaîne prises et courses sans répit : de 34 à 90 ms, et une fois 214 ms (Port-Sable,
    premier passage).
- **Une seule création par scène** : `jeu.js` garde l'état avec le décor (`sc.animaux`). À chaque séance (course,
  chrono, démo), `repartir` remet les bêtes à leurs places de départ sans rien rebâtir. Une séance entière sur une
  scène déjà bâtie se prépare en 1 à 6 ms, animaux compris. Le résultat est identique à une création neuve
  (contrôle 13).
- **Mémoire** : la grille des habitats pèse 2,7 à 4,4 Mio par scène (250 000 à 410 000 cases de 11 octets) ; le reste
  de l'état, une vingtaine de Kio. Elle est libérée avec la scène.

### En course

- **Cerveau** : 0,02 à 0,06 ms par pas en moyenne, au plus 0,2 ms, soit 0,2 à 0,6 ms par seconde de course. Deux pics
  isolés d'environ 5 ms ont été vus, une fois à Lande-Noire et une fois à Cap-Séquoia, jamais au même pas d'une série
  à l'autre. Un ramasse-miettes ou une recompilation tombée pendant l'appel est probable ; c'est à surveiller sur
  matériel réel.
- **Dessin** : 0,03 à 0,07 ms par vue et par image, sans allocation. Mesuré dans Node, deux vues et 70 objets par vue
  à 60 images/s : 385 octets par image pour le harnais seul, 417 avec le dessin. Le cerveau ajoute environ 0,3 Kio par
  image (726 octets avec cerveau et dessin) : quelques nombres emboîtés par V8, à chasser.
- **Réserve** : chaque vue a sa réserve d'objets, réutilisée d'une image à l'autre dans le même ordre (contrôle 9).

### Rendu : la même image avec et sans animaux

Chaque capture est redessinée au même instant, animaux coupés. L'écart vient de `rendu.stats` ; les triangles y sont
comptés deux fois, vue et ombres. Palier Élevé, 1280 × 720 :

| Prise | Bêtes (proches / moyennes / lointaines) | Objets | Appels (sans) | Triangles | Instances |
|---|---|---:|---:|---:|---:|
| `val-brule-proche` | 13 (7 / 0 / 6) | 105 | +22 (125) | +45 180 (+1,8 %) | +105 |
| `val-brule-loin` | 25 (0 / 7 / 18) | 67 | +18 (175) | +22 648 (+0,7 %) | +67 |
| `val-brule-fuite` | 13 (7 / 0 / 6) | 105 | +22 (132) | +45 180 (+1,8 %) | +105 |
| `val-brule-passage` | 23 (0 / 7 / 16) | 65 | +16 (294) | +20 368 (+0,5 %) | +65 |
| `val-brule-vol` | 9 (1 / 1 / 7) | 17 | +16 (109) | +9 876 (+0,8 %) | +17 |
| `port-sable-proche` | 6 (6 / 0 / 0) | 84 | +18 (124) | +35 688 (+6,5 %) | +84 |
| `port-sable-loin` | 21 (0 / 10 / 11) | 51 | +8 (104) | +16 512 (+4,6 %) | +51 |
| `port-sable-fuite` | 7 (3 / 4 / 0) | 66 | +24 (232) | +22 516 (+3,1 %) | +66 |
| `port-sable-passage` | 21 (0 / 7 / 14) | 56 | +8 (255) | +16 072 (+1,2 %) | +56 |
| `port-sable-vol` | 32 (1 / 1 / 30) | 42 | +20 (106) | +17 796 (+4,1 %) | +42 |
| `haut-col-proche` | 8 (2 / 2 / 4) | 42 | +26 (166) | +17 128 (+0,8 %) | +42 |
| `haut-col-loin` | 8 (0 / 5 / 3) | 38 | +16 (70) | +10 724 (+7,2 %) | +38 |
| `haut-col-fuite` | 9 (0 / 5 / 4) | 34 | +10 (166) | +9 232 (+0,3 %) | +34 |
| `haut-col-passage` | 12 (0 / 0 / 12) | 12 | +6 (335) | +8 756 (+0,3 %) | +12 |
| `haut-col-vol` | 5 (1 / 0 / 4) | 11 | +14 (79) | +5 936 (+0,4 %) | +11 |
| `lande-noire-proche` | 26 (7 / 0 / 19) | 117 | +26 (133) | +51 236 (+45,9 %) | +117 |
| `lande-noire-loin` | 15 (0 / 4 / 11) | 35 | +12 (61) | +11 436 (+21,4 %) | +35 |
| `lande-noire-fuite` | 23 (4 / 3 / 16) | 90 | +28 (203) | +34 868 (+18,3 %) | +90 |
| `lande-noire-passage` | 7 (0 / 7 / 0) | 42 | +6 (121) | +8 176 (+5,2 %) | +42 |
| `lande-noire-vol` | 17 (5 / 5 / 7) | 67 | +16 (84) | +20 828 (+33,0 %) | +67 |
| `roche-fauve-proche` | 8 (8 / 0 / 0) | 128 | +24 (66) | +57 312 (+111,9 %) | +128 |
| `roche-fauve-loin` | 22 (0 / 7 / 15) | 56 | +22 (116) | +23 824 (+25,5 %) | +56 |
| `roche-fauve-fuite` | 7 (7 / 0 / 0) | 112 | +24 (70) | +50 148 (+90,5 %) | +112 |
| `roche-fauve-passage` | 21 (0 / 8 / 13) | 77 | +18 (186) | +23 648 (+6,7 %) | +77 |
| `roche-fauve-vol` | 9 (1 / 0 / 8) | 15 | +14 (97) | +8 940 (+8,4 %) | +15 |
| `brume-de-jade-proche` | 12 (6 / 0 / 6) | 54 | +16 (203) | +13 896 (+6,5 %) | +54 |
| `brume-de-jade-loin` | 4 (0 / 4 / 0) | 24 | +10 (81) | +5 392 (+6,2 %) | +24 |
| `brume-de-jade-fuite` | 12 (5 / 1 / 6) | 60 | +22 (291) | +17 192 (+3,9 %) | +60 |
| `brume-de-jade-passage` | 6 (0 / 6 / 0) | 24 | +6 (175) | +7 248 (+1,3 %) | +24 |
| `brume-de-jade-vol` | 1 (1 / 0 / 0) | 7 | +10 (77) | +2 424 (+1,7 %) | +7 |
| `cap-sequoia-proche` | 7 (7 / 0 / 0) | 99 | +20 (68) | +41 796 (+7,3 %) | +99 |
| `cap-sequoia-loin` | 36 (0 / 8 / 28) | 84 | +18 (178) | +33 932 (+3,0 %) | +84 |
| `cap-sequoia-fuite` | 7 (6 / 1 / 0) | 92 | +28 (178) | +37 168 (+3,2 %) | +92 |
| `cap-sequoia-passage` | 15 (0 / 7 / 8) | 57 | +14 (260) | +14 776 (+0,9 %) | +57 |
| `cap-sequoia-vol` | 19 (1 / 0 / 18) | 25 | +16 (149) | +16 884 (+2,4 %) | +25 |
| `cap-sequoia-baleine` | 1 (1 / 0 / 0) | 3 | +6 (91) | +2 796 (+0,5 %) | +4 |
| `val-brule-legere` (Légère) | 9 (0 / 0 / 9) | 9 | +3 (99) | +3 906 (+1,9 %) | +9 |

Comment lire le tableau :

- Sur les images de plus d'un million de triangles (forêt, Haut-Col, Cap-Séquoia, Port-Sable au passage), les animaux
  en ajoutent au plus 3,2 %.
- Sur les images légères (désert, Islande, quelques plans de loin : 50 000 à 250 000 triangles), un troupeau à 15 m de
  la caméra peut doubler les triangles de l'image. En valeur absolue, c'est +57 000 au plus.
- Les appels de dessin restent sous +28, car les pièces sont regroupées par forme.

### Temps d'image en vue cockpit

Pour chaque circuit, la même course est rejouée en vue cockpit pendant 8 s (240 images), rétroviseurs compris. Après
une course d'échauffement jetée, elle tourne quatre fois en alternance : avec, sans, avec, sans. Résultat (Chrome sans
interface, Apple M5) :

| Circuit | Avec (moyenne / p95) | Sans (moyenne / p95) | Écart | Bruit entre deux courses identiques | Bêtes vues (moy. / max) |
|---|---:|---:|---:|---:|---:|
| Val-Brûlé | 14,27 / 26,4 ms | 12,63 / 22,8 ms | +1,64 ms | 4,61 ms | 20,2 / 22 |
| Port-Sable | 8,83 / 17,0 ms | 9,78 / 18,1 ms | −0,95 ms | 5,25 ms | 7,8 / 17 |
| Haut-Col | 13,31 / 32,0 ms | 14,93 / 31,8 ms | −1,62 ms | 0,98 ms | 2,6 / 6 |
| Lande-Noire | 6,26 / 11,5 ms | 6,33 / 12,5 ms | −0,06 ms | 1,39 ms | 15,2 / 18 |
| Roche-Fauve | 5,17 / 7,3 ms | 5,03 / 7,3 ms | +0,14 ms | 0,66 ms | 15 / 15 |
| Brume-de-Jade | 6,50 / 13,3 ms | 8,20 / 14,5 ms | −1,70 ms | 5,81 ms | 9,4 / 11 |
| Cap-Séquoia | 13,83 / 32,4 ms | 14,24 / 34,0 ms | −0,41 ms | 1,46 ms | 7,1 / 9 |

**L'écart reste dans le bruit sur les sept circuits.** Avec une horloge d'images commandée, sans attendre l'écran, ce
banc ne sait pas voir un coût de l'ordre de 0,1 ms. Il faut s'en tenir aux chiffres directs : cerveau et dessin ci-dessus.

Une première série, sans échauffement ni alternance, donnait +11 ms à Val-Brûlé. C'était le coût de la première course
en cockpit, pas celui des bêtes, d'où ce protocole. La fluidité sur la machine du joueur reste à mesurer avec
`tools/banc-navigateur.mjs` et `tools/profil-accrocs.mjs`.

### Paliers

| Palier | Bêtes proches | Moyennes | Total | Objets | Seuils (px de haut : proche / moyen / minimum) |
|---|---:|---:|---:|---:|---|
| off | 0 | 0 | 0 | 0 | — |
| low (Légère) | 0 | 0 | 14 | 32 | silhouettes d'une pièce seulement, ≥ 0,9 px |
| medium | 5 | 36 | 400 | 700 | 48 / 9 / 0,8 |
| high | 14 | 90 | 400 | 1 400 | 30 / 6 / 0,7 |
| ultra | 28 | 170 | 400 | 2 400 | 22 / 4,5 / 0,6 |

Une bête proche compte jusqu'à 18 pièces, une moyenne jusqu'à 8, une lointaine une seule. Au-delà du budget d'un
niveau, les bêtes les plus petites à l'écran descendent d'un niveau. Seul le total en écarte, les plus petites
d'abord : 14 en Légère, 400 ailleurs, un nombre qu'aucun circuit n'atteint (54 bêtes et oiseaux au plus).

Objets posés à 20, 60, 180 et 320 m (contrôle 11) :

| Palier | 20 m | 60 m | 180 m | 320 m |
|---|---:|---:|---:|---:|
| low | 14 | 14 | 14 | 14 |
| medium | 45 | 43 | 33 | 40 |
| high | 53 | 53 | 33 | 40 |
| ultra | 74 | 53 | 33 | 40 |

**Légère** reste celle des petites machines. Les groupes au sol à moins de 150 m de la piste n'y sont pas dessinés du
tout, et rien ne l'est à moins de 120 m de la caméra. Il reste au plus 14 silhouettes d'une pièce (bêtes lointaines,
oiseaux, baleine sans son souffle). La capture `val-brule-legere` en montre 9, dont les 7 cerfs visés à 145 m, pour
+3 appels de dessin et +3 906 triangles. Le cerveau tourne quand même : 0,2 à 0,6 ms par seconde de course.

Le réglage est celui de la **Faune** du menu, sans nouvelle entrée : `B.animaux.qualite(reglages.faune, palier)`.

- « Selon qualité » suit le palier. En Légère, il garde les silhouettes lointaines, alors que `faune.js` y coupe les
  insectes.
- « Désactivée » coupe aussi les animaux.
- Les autres choix (Discrète, Modérée, Abondante, Très abondante) valent low, medium, high et ultra.

## Intégration : `integration.patch`

```sh
git apply docs/reprise/rapports/animaux-2026-11-18/integration.patch
python3 construire.py
node tools/planche-animaux.mjs dist/bitume.html <dossier neuf>
```

Ce que fait le patch :

1. **`construire.py`** : `animaux.js` entre `voiture.js` et `traces.js`, après le moteur (`FRender.forme`) et avant
   `jeu.js`.
2. **`animauxDe(sc, nature)`** dans `jeu.js` : l'état est créé une fois par scène (`sc.animaux`, comme le décor qu'il
   habite), puis `repartir` le remet au départ à chaque séance.
   - Le moment de la journée suit la séance.
   - À l'horloge réelle, la nuit du départ vaut pour toute la course (`B.conditionsCourse.nuitReelle`).
3. **Séance** : `S.animaux` et `S.animauxVue`. En duo, la vue du joueur 2 a son propre `animauxVue` (vue 1, sa propre
   réserve d'objets).
4. **`pasSimulation`** : `B.animaux.pas(S.animaux, co.horloge, S.cour)` juste après `remplirPoses`. Les bêtes lisent
   les poses des voitures ; leur cerveau n'avance qu'aux instants k × 0,1 s de l'horloge de course et ne touche ni au
   hasard de la course, ni aux voitures, ni aux obstacles.
5. **`rendreVue`** : `B.animaux.dessiner(...)` après la faune, avec les règles suivantes.
   - Horloge : l'instant affiché des voitures, `co.horloge - DT + clamp(S.acc, 0, DT)`.
   - Palier : celui de la vue.
   - Nuit et pluie : celles de la scène.
   - Rétroviseurs : `arriere = retroVoulu(S, vue, P)` garde derrière la caméra, à moins de 160 m, ce que les glaces
     reflètent. `retroVoulu` reçoit désormais le profil `P` de l'image ; sinon, il le recalculait.

Ce que le patch ne change pas :

- **Reprise du départ** : si l'horloge recule, `pas` remet l'état initial. Un retour arrière ou une course rejouée
  retrouvent les mêmes bêtes sur les mêmes trajets (contrôle 13).
- **En ligne** : les bêtes sont purement visuelles. Chaque machine les calcule à partir de l'horloge de course et des
  voitures qu'elle affiche. Un léger écart entre deux machines (une voiture distante interpolée, un palier de décor
  différent qui déplace un groupe) est sans effet sur la course.

## Ce qu'il faudrait pour une bête qui traverse

Rien de cela n'est fait : aucune bête n'approche à moins de 34 m de l'axe. Une traversée de piste est un autre lot,
qui touche à la course :

- **Obstacle dans la simulation** : `obstacles.js` ne connaît que des obstacles fixes, créés avec la scène dans un
  ordre stable. Une bête qui traverse serait un obstacle mobile, ajouté après les fixes pour ne pas décaler leur ordre,
  avec contacts et dégâts (`contacts.js`, `degats.js`).
- **Déterminisme** : sa position devrait venir de la seule horloge de course et d'une graine tirée de celle de la
  course, sans consommer le hasard de la course. Elle ne pourrait pas dépendre des voitures affichées, qui diffèrent
  d'une machine à l'autre en ligne. Le cerveau actuel lit ces voitures : il faudrait un trajet de traversée écrit
  d'avance (instant, abscisse, côté).
- **Pilotes** : l'IA devrait voir la bête, freiner ou l'éviter, sans casser le rythme des courses.
- **Ton du jeu** : heurter un animal, et ce qu'on montre alors, demande une décision de David.

## Captures et outil

`docs/reprise/rapports/animaux-2026-11-18/index.html` présente les 37 prises, chacune avec ses chiffres :

- de près (`-proche`), avant le passage ;
- de loin (`-loin`, 120 m au téléobjectif) ;
- en fuite (`-fuite`) ;
- au passage du peloton vu en hauteur de l'autre côté de la piste (`-passage`) ;
- un oiseau en vol (`-vol`) ;
- la baleine (`cap-sequoia-baleine`) ;
- Légère (`val-brule-legere`).

```sh
node tools/planche-animaux.mjs dist/bitume.html <dossier neuf> [--circuits 0,1,2,3,4,5,6] [--taille 1280,720] \
     [--qualite high] [--saison ete] [--format jpeg|png] [--legere 0|non] [--chrome <binaire>]
```

L'outil fonctionne ainsi :

- Il ouvre la page dans Chrome sans interface, avec un profil temporaire isolé, effacé à la fin.
- Il commande l'horloge d'images (celle de `tools/controle-visuel.mjs`).
- Il simule 75 s de course pour savoir quel groupe s'alarme et quand, puis rejoue la même course jusqu'à l'instant
  voulu.
- Il place l'œil du côté opposé à la route, sur l'angle le moins caché par le relief, les obstacles et les arbres.

Les images sont reproductibles : deux passages ont donné 37 images identiques à l'octet.

## Vérifications

`node verifications/animaux.test.mjs` passe ses 13 contrôles en 5 à 12 s selon la charge de la machine. Ses bornes de
durée se mesurent en temps processeur, pour qu'une machine chargée ne les fasse pas échouer :

- **Formes** : finies, dans le cube unité, faces dans le sens des normales.
- **Placement** : sept circuits, chaque espèce trouve un habitat, placement reproductible.
- **Sécurité de la piste** : 240 s de course sans bête sur la route, son dégagement, l'enceinte ou le tunnel. Au plus
  près de l'axe, on trouve 37 à 56 m selon le circuit.
- **Réactions** : fuite, refuge, retour, accoutumance.
- **Indépendance de la cadence** : mêmes images à 30, 60 et 120 images/s ; mouvement continu en pleine fuite.
- **Mémoire** : réserve réutilisée, aucune allocation au dessin.
- **Paliers** : budgets par palier.
- **Conditions** : saisons, nuit et averse.
- **Sol** : la hauteur suit le maillage rendu.
- **Reprise** : course reprise du départ, `repartir` identique à une création neuve.

La suite complète, 67 fichiers, passe sans échec après le retrait des retouches locales (`tests.log`).

## Reste à faire et limites

- **Intégrer** : appliquer le patch, reconstruire et regarder sur la vraie machine en cockpit, en TV et en duo. Puis
  actualiser le point court (`ETAT.json`, `REPRISE.md`) au moment de la publication. Ces deux fichiers existants ne
  sont pas modifiés par cette étude.
- **Fluidité réelle** : non mesurée, voir plus haut. Les deux pics d'environ 5 ms dans un pas du cerveau sont à
  surveiller avec `tools/profil-accrocs.mjs`.
- **Bouquetins de Haut-Col** : faute de pentes de bouquetin près de la piste, les quatre groupes vivent entre 323 et
  436 m, ne réagissent jamais et se voient à peine de loin. Les rampes et la corniche prévues pour Haut-Col (lot 22A)
  peuvent changer cela ; il faudra repasser la planche.
- **Aigrettes de Brume-de-Jade** : elles sont posées au sec, faute de rizière en eau près de la piste. Elles iront
  dans l'eau si le décor en gagne (leur habitat se règle par une ligne).
- **Sanglier couché** : les pattes dépassent un peu du corps. C'est un défaut de modèle mineur.
- **Placement et palier de décor** : le placement dépend du décor de la scène (arbres et obstacles du palier ancre).
  Deux machines à paliers différents ne voient donc pas exactement les mêmes places. C'est sans effet sur la course.
- **Allocation du cerveau** : environ 0,3 Kio par image dans V8, à chasser.
- **Mémoire de la grille** : 2,7 à 4,4 Mio par scène. On peut la diviser par deux environ, avec une bande autour de la
  piste au lieu du rectangle, ou des distances et hauteurs sur 16 bits.
- **Huitième circuit** (grand circuit de montagne, décidé le 18/11) : son thème choisira le biome, et un thème inconnu
  retombe sur la forêt. À vérifier avec `--circuits 7` quand il existera.
- **Bords de route (lot 22C)** : la demande de David arrivée pendant ce lot (« un peu plus de panneaux de publicité au
  bord de la route aussi, quelques bords de routes dangereux ») relève du lot 22C et n'est pas traitée ici. Si des
  portions perdent leur dégagement, les bêtes restent quand même à 34 m de l'axe au moins. Les murets, roches et arbres
  que ce lot ajoutera au décor seront évités d'office, puisque la grille lit les obstacles du décor.

## Constats hors du lot

- **`src/jeu.js:1698`** : `sortie.length = 0` à chaque image dans `rendreVue`. V8 libère alors la mémoire du tableau,
  que les `push` suivants réallouent en plusieurs fois, à chaque image et pour chaque vue. Un remplissage par indice
  l'éviterait ; c'est à mesurer avant de toucher.
- **`src/jeu.js:1393`** : `profilDe(S)` appelle `B.graphismes.melange`, qui bâtit un objet neuf à chaque appel. Il est
  appelé à plusieurs endroits, dont `retroVoulu` à chaque image ; le patch lui passe le profil déjà calculé.
