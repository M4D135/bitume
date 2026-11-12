# BITUME — plan maître

Écrit le 12 novembre 2026 au soir, à la demande de David : « fais un gros master plan pour le boulot avec Fable 5.2
puis passe en Opus 5.5 pour l'exécution ». Ce plan commande ; `FEUILLE-DE-ROUTE.md` garde le détail des chantiers de
conduite et de chocs. Qui exécute coche les cases, date ce qu'il finit et n'efface rien.

## 1. Où on en est

| Fait | Commit | En ligne |
|---|---|---|
| Essai 0.1 | `9886f92` | oui, <https://bitume.estrasse.fr> |
| 312 T5, thème du titre, démo sans fin, fin du clipping | `3f9787e` | non |
| Cockpit recadré, gants articulés, planche, levier, rétroviseurs à suiveurs | `1379601` | non |

Les six suites de `verifications/` passent au commit `1379601` : circuit, conduite (17), course (7), réalisateur (7),
son (11), voiture (16). Commande : `for t in verifications/*.test.mjs; do node "$t" | tail -1; done`.

**Ce que David a dit du cockpit `1379601`, dans l'ordre, mot pour mot :**
1. « c pas encore ça le cockpit, faut niveau mains faut retrouver ce qu'on avait sur la version unreal au minimum »
2. « ça fait pas sérieux le cockpit, faut rapprocher la vue du volant afin de voir que les mains et pas tous le
   bras, putain regarde la version unreal engine que j'avais fait » — le cadrage est corrigé dans `1379601`.
3. « c trop carré pour un cockpit, une f1 c bien arrondi courbé etc, regarde des photos de cockpit de ce modele de f1 »
4. « regarde les positions des mains sur le volant dans la réalité, là c du warner bros que tu fais lol c pourri »

Les points 3 et 4 ne sont **pas** traités. Ils ouvrent ce plan : phase 1.

## 2. Règles d'exécution

- **Modèle** : Opus 5.5 exécute. Un agent à la fois, pas de workflow à plusieurs agents sans que David le demande
  (le lot en agents du 12/11 s'est arrêté sur la limite hebdomadaire, retour le 18/11 à 15 h).
- **Juger sur image, pas sur le code.** Chaque lot visuel se termine par une capture dans le volet navigateur
  (`.claude/launch.json`, port 8781), posée à côté de la référence. Si la capture ne tient pas la comparaison, le lot
  n'est pas fini, même si les tests passent. Outils : `BITUME_JEU.pauseAuto = false`, `BITUME_JEU.camera = (pose,
  cam) => ({ pos: cam.pos, yaw: cam.yaw, pitch: cam.pitch - .2, fov: 17 })` pour un gros plan, `BITUME_JEU.demo(i)`.
  La première capture après une navigation est souvent périmée : en prendre deux.
- **Références.**
  - vroom-unreal 0.35 : `docs/images/cockpit-035-neutral.png` et `cockpit-035-drift.png` du dépôt privé
    `M4D135/vroom-unreal` (`gh repo clone M4D135/vroom-unreal` dans le dossier de brouillon ; ne jamais le modifier).
  - 312 T5 réelle, Wikimedia Commons : `FERRARI_312T5_RETROMOBILE_2023_(52679552657).jpg` (trois quarts avant, de
    haut : la meilleure pour les volumes), `Ferrari_312T5_at_Mont_Tremblant_01` à `04.jpg` (en piste),
    `Torino_Museo_Nazionale_dell'Automobile_Ferrari_312_T5.jpg`. Adresse d'une image :
    `https://commons.wikimedia.org/wiki/Special:FilePath/<nom>?width=800`.
  - On regarde, on mesure des proportions, on ne copie aucune image, aucun logo, aucun maillage. Le maillage des gants
    de vroom-unreal vient de Valve : il ne se copie pas.
- **Jeu original** : ni nom Ferrari, ni cheval cabré, ni commanditaire ; rien du Vroom de Lankhor.
- **Moteur** : toute retouche de `src/moteur/renderer.js` porte la marque « BITUME » et une ligne dans
  `src/moteur/PROVENANCE.md`.
- **Commits** : limités aux fichiers de la tâche (jamais `.claude/worktrees/`), en français, poussés à chaque version
  qui marche : `git -c credential.helper= -c credential.helper='!/Users/david/bin/gh auth git-credential' push origin main`.
- **Mise en ligne** : seulement quand David le demande (`./deposer.sh`).
- **Budget** : page de 1,4 Mo au plus (360 Ko aujourd'hui). Viser 60 images par seconde en qualité « auto ».
- **Décisions à tenir** : voir « Décisions de David à tenir » dans `AGENTS.md` (musique du titre seulement, cadrage du
  cockpit, pas de coupe à distance, démo sans fin).

## 3. Ce que montrent les références

### La vraie 312 T5 (photos)

- **Une seule grande peau lisse.** Le dessus de la voiture est un capot rouge large, bas et presque plat, en forme
  de flèche : sa pointe est juste derrière l'aileron avant, ses bords partent en diagonale vers l'arrière en frôlant
  l'intérieur des roues avant, puis il devient les pontons, de toute la largeur de la caisse. Un filet blanc suit ses
  bords. Rien n'est une boîte : les arêtes sont des rayons de 3 à 8 cm, le dessus est légèrement bombé.
- **Le carénage du cockpit** est une goutte d'eau posée sur ce capot, sur l'axe : pointe vers l'avant (elle se
  prolonge en arête jusqu'au nez), 62 cm de large au plus, flancs galbés, sommet arrondi.
- **Le saute-vent** est une bulle teintée bleue, haute et très galbée, qui entoure l'avant de l'ouverture et revient
  sur les côtés. Le casque dépasse au-dessus.
- **Rétroviseurs** : petits boîtiers rouges profilés, sur des pattes courtes, fixés aux flancs du carénage.
- **Numéro** : grand chiffre **blanc**, penché, posé directement sur le rouge du nez (pas de panneau).
- **Avant** : aileron pleine largeur en aluminium poli, sur un pylône au bout du nez, petites dérives ; sous le capot,
  une quille de nez rouge, étroite ; basculeurs supérieurs noirs, larges ; triangles inférieurs en tubes.
- **Planche** : aluminium nu, un grand compte-tours central, deux petits cadrans, interrupteurs à levier ; petit volant
  à trois branches, jante noire, moyeu jaune (chez nous : une couleur neutre, pas d'emblème).

### Le cockpit de vroom-unreal 0.35 (capture)

- Volant gros et bas, bas de la jante hors de l'image ; planche noire juste au-dessus du moyeu ; **déjà fait**.
- **Volumes ronds et brillants** : deux grandes masses rouges galbées montent des coins du bas vers le centre, un dôme
  rouge devant la planche, saute-vent en arc fin. C'est ce qui manque le plus à BITUME.
- **Gants réalistes** : ajustés, blancs à empiècements noirs, doigts serrés les uns contre les autres, sangle au
  poignet. Manches fines qui sortent du bas de l'image.
- Pneus avant grands, jante visible ; rétroviseurs rouges à image vivante.

### Des mains de pilote sur un volant, en vrai

- Prise à **9 h et 3 h**, juste au-dessus des branches horizontales. Poignets droits, dans l'axe des avant-bras ;
  avant-bras presque parallèles, coudes bas et serrés (le cockpit fait 41 cm de large).
- Vu du pilote, on voit surtout **le dos de la main** : un trapèze plat et incliné, large de 8,5 cm aux jointures,
  qui se resserre vers le poignet ; la **rangée des quatre jointures** sur le bord extérieur de la jante ; la première
  phalange qui passe par-dessus la jante et disparaît derrière.
- Les **pouces** sont couchés sur la face avant de la jante ou crochetés sur la branche, pointés vers le centre du
  volant et un peu vers le haut. Jamais dressés.
- Le bout des doigts ne se voit presque pas : il est derrière la jante. Les doigts sont **serrés**, sans jour entre eux.
- Un gant de course est **ajusté** : pas de boule aux articulations, pas de doigts en saucisse. Tissu ignifugé de
  couleur (rouge, bleu, noir ; blanc seulement avec des empiècements sombres), paume et intérieur des doigts en cuir
  plus sombre, coutures, poignet élastique court pris sous le revers de la manche.
- Proportions : main de 18,5 cm de long, largeur aux jointures 8,5 cm, doigts de 1,8 cm de diamètre ; volant de 27 cm,
  tube de jante de 2,8 à 3 cm. La main fait donc 31 % du diamètre du volant.

### Pourquoi le cockpit actuel fait « Warner Bros »

Gants blancs unis, sphères plus grosses que les doigts à chaque articulation, bouts de doigts ronds bien visibles
dans la jante, pouce droit comme un bâton, dos de main en ballon. Et autour : des boîtes à angles vifs.

## 4. Phase 1 — Un cockpit crédible

Ordre imposé : A, B, C, D. E est facultatif. Chaque lot se termine par ses tests, une capture comparée et un commit
poussé.

### Lot 1A — Formes libres dans le moteur et outils de carène

But : dessiner des volumes courbes, lisses, au lieu d'empiler des boîtes.

- [x] **Moteur** (`src/moteur/renderer.js`, marque « BITUME », PROVENANCE n° 10). Aujourd'hui `names` (ligne ~590)
  liste les formes et `geometry(low)` (ligne ~591) les construit avec `begin(nom)`, `triangle(p0, p1, p2, n0, n1, n2)`
  et `end(nom)` ; les normales par sommet donnent un ombrage lisse. Ajouter un registre :
  `window.FRender.forme(nom, triangles)` où `triangles` est une liste de `[p0, p1, p2, n0, n1, n2]`. L'appel ajoute
  `nom` à `names` et garde les triangles ; `geometry()` les émet après les formes d'origine, aux trois niveaux de
  détail (`geometry()`, `geometry(true)`, `geometry(2)` : mêmes triangles partout, c'est suffisant). À appeler avant
  `FRender.create`. Vérifier chaque endroit qui énumère les formes : `shadowCaster` (ligne ~1276) doit accepter les
  formes libres ; `packIndexed`, `pack` et le rendu logiciel ne doivent pas casser.
- [x] **Convention** : une forme libre est normalisée dans le cube unité (de −0,5 à 0,5) ; l'instance porte la vraie
  taille dans `s` et le centre de la boîte dans `p`. Le rayon de tri (`hypot(s)/2`) et les seuils d'ombre restent
  justes. Les normales sont celles du volume **à sa vraie taille**, ramenées dans le cube par l'inverse transposée
  (sinon l'ombrage se déforme).
- [x] **Nouveau module `src/carene.js`** (pur, chargé après le moteur, testable dans Node) :
  - `carene(sections, { cotes = 20, bouts = true })` : peau tendue entre des sections en superellipse. Une section :
    `{ x, y0, y1, l, n, z = 0 }` — abscisse, bas, haut, demi-largeur, exposant (2 : ellipse ; 4 à 6 : rectangle aux
    coins ronds). Point d'angle a : `z + l·sgn(cos a)·|cos a|^(2/n)`, `(y0+y1)/2 + (y1−y0)/2·sgn(sin a)·|sin a|^(2/n)`.
    Option `ouverture: { de, a, angle }` : entre les abscisses `de` et `a`, ne pas fermer le haut (arc d'ouverture
    `angle`) : c'est le trou du cockpit.
  - `tube(points, rayons, { cotes = 10 })` : cercle balayé le long d'une ligne brisée lissée, rayon par point, bouts en
    demi-sphère. Sert aux doigts, aux manches, aux bras de suspension, à l'arceau, aux échappements.
  - `normaliser(triangles)` : rend `{ triangles, centre, taille }` pour la convention ci-dessus.
  - Normales lisses : moyenne des faces autour de chaque sommet (souder les sommets à 1e-6 près), sauf aux arêtes
    voulues vives (angle de plus de 50° entre faces).
- [x] **Tests** `verifications/carene.test.mjs` : volume fermé (chaque arête partagée par deux triangles, sauf
  ouverture), normales unitaires vers l'extérieur, boîte englobante égale aux cotes demandées, nombre de triangles
  attendu, symétrie gauche-droite.
- [x] `construire.py` : `carene.js` entre `decor.js` et `voiture.js`. `AGENTS.md` : structure et ordre de chargement.

Fini quand : une carène d'essai s'affiche lisse, éclairée et ombrée dans le jeu, et jette son ombre.

Fait le 12/11/2026 : registre `FRender.forme`, index sur 32 bits, `src/carene.js` (`carene`, `tube`, `normaliser`,
`lisser`, `miroir`), dix vérifications ; carène d'essai vue lisse et éclairée sur les douze voitures, puis retirée.

### Lot 1B — La 312 T5 en carènes

But : la silhouette lisse des photos, une instance par volume au lieu de dizaines de boîtes. Repère de la voiture :
x vers l'avant, y vers le haut, z vers la droite, origine au sol au milieu de l'empattement. Cotes à tenir (testées) :
longueur 4,53 m, largeur 2,12 m, hauteur 1,02 m, empattement 2,70 m, voies 1,70 et 1,615 m.

Volumes, de l'avant vers l'arrière. Les valeurs sont un point de départ : les ajuster sur la capture comparée à la
photo de Rétromobile, pas à l'œil sur le code.

| Forme | Sections (x : y0–y1, demi-largeur, exposant) |
|---|---|
| Quille de nez | 2,16 : 0,12–0,22, 0,10, 3 → 1,60 : 0,10–0,30, 0,15, 3 → 0,95 : 0,10–0,34, 0,20, 4 |
| Capot en flèche (dessus) | 2,08 : 0,22–0,25, 0,04, 3 → 1,60 : 0,27–0,34, 0,26, 4 → 1,05 : 0,30–0,40, 0,52, 5 → 0,60 : 0,30–0,43, 0,72, 5 |
| Pontons et dessus de caisse | 0,60 : 0,10–0,43, 0,72, 6 → −0,40 : 0,10–0,45, 0,72, 6 → −1,25 : 0,10–0,46, 0,70, 5 |
| Carénage du cockpit (goutte) | 1,30 : 0,36–0,40, 0,03, 2 → 0,90 : 0,38–0,54, 0,20, 2,5 → 0,55 : 0,38–0,63, 0,29, 3 → 0,10 : 0,38–0,65, 0,31, 3 → −0,35 : 0,40–0,66, 0,27, 3 ; ouverture du cockpit de 0,52 à −0,24 |
| Capot moteur | −0,35 : 0,40–0,70, 0,30, 3 → −1,00 : 0,42–0,60, 0,34, 4 → −1,65 : 0,30–0,50, 0,26, 4 |
| Saute-vent (translucide) | demi-bulle : base de x 0,62 à 0,10 sur le bord de l'ouverture, sommet à y 0,80 vers x 0,40 |

- [x] Garder en primitives du moteur ce qui est déjà bon : roues, jantes, disques, aileron avant (plaque et dérives),
  aileron arrière, boîte, échappements, rivets. Refaire en `tube` : basculeurs, triangles, biellettes, arceau.
- [x] Filet blanc le long des bords du capot en flèche ; bande basse des pontons de la seconde couleur.
- [x] **Numéro blanc posé sur le rouge**, sans panneau, sur le nez et les pontons (aujourd'hui : noir sur panneau blanc).
- [x] Rétroviseurs : boîtier profilé (carène courte) sur patte fine.
- [x] Version lointaine (`simples`, au-delà de 170 m ramenés au champ) : trois carènes à 8 côtés et les quatre roues.
- [x] Fantôme du chrono : mêmes carènes, translucides.
- [x] Vérifier la poursuite, la télévision et l'hélicoptère de la démo : captures des trois, à côté de la photo.

Fini quand : de trois quarts avant, la voiture se confond en silhouette avec la photo de Rétromobile (hors
commanditaires), sans une arête vive sur la peau.

Fait le 12/11/2026 : quille, flèche, pontons (resserrés à −1,08 m pour ne pas toucher les roues arrière, où la table
les faisait entrer), goutte ouverte doublée de sombre avec son jonc, capot moteur, bulle teintée, filet et bande de la
seconde couleur, rétroviseurs, basculeurs, triangles et arceau en formes libres ; numéro blanc penché collé à la peau
(nez devant la pointe de la goutte, flancs des pontons). L'habitacle en boîtes ne sert plus qu'à la vue cockpit
(drapeau `dedans`) jusqu'au lot 1C. Captures : trois quarts avant, poursuite, bord de piste, hélicoptère.

### Lot 1C — L'habitacle vu du pilote

But : la capture `cockpit-035-neutral.png`, en plus juste pour la 312 T5. Cadrage inchangé (`VOLANT`, `PLANCHE`,
`COUDE`, `LEVIER` de `src/voiture.js`, œil `OEIL`).

- [ ] Carène « intérieur » propre à la vue cockpit (l'œil est 30 cm derrière la tête et plus bas que le vrai pilote :
  la coque extérieure boucherait la vue, d'où un capot plus bas). Elle remplace les flancs en boîte, les cylindres
  d'arête et le dôme actuels : deux épaules galbées qui montent des coins du bas vers la planche, un dôme devant la
  planche, bord d'ouverture arrondi avec un jonc sombre fin.
- [ ] Saute-vent : arc galbé teinté bleu (`fx`, alpha 0,15 à 0,25), arête supérieure claire, visible devant le dôme
  comme sur la capture.
- [ ] Planche : garder cadrans, afficheurs, lampe, témoins ; fond en aluminium brossé sombre ou noir selon la
  capture comparée ; casquette arrondie (carène), pas une planche à angles vifs.
- [ ] Volant : jante en un seul `tube` fermé (plus de 36 tronçons), branches à bords arrondis, moyeu.
- [ ] Rétroviseurs : boîtiers profilés ; garder les suiveurs dans la glace.
- [ ] Pneus avant : épaules arrondies (carène de révolution), flanc et bande de roulement distincts.
- [ ] Mettre à jour `verifications/voiture.test.mjs` : cadrage, coque creuse (rien entre l'œil et le volant), nombre
  de pièces.

Fini quand : posée à côté de `cockpit-035-neutral.png`, la capture de BITUME montre les mêmes masses rondes aux mêmes
endroits, et David ne peut plus dire « trop carré ».

### Lot 1D — Des mains de pilote

But : plus rien de dessin animé. Une main = **un seul maillage** fixe dans le repère du volant (la prise ne change pas
quand la jante tourne), bâti une fois par `carene` et `tube`, enregistré en forme libre ; son miroir pour l'autre main.

- [ ] **Prise à 9 h et 3 h** : `VOLANT.prise` à 1,50 rad (86° du haut), mains juste au-dessus des branches.
- [ ] **Dos de la main** : carène plate et inclinée, des jointures au poignet, 8,5 cm de large aux jointures, 6 cm au
  poignet, 2,6 cm d'épaisseur, exposant 3. Pas d'ellipsoïde.
- [ ] **Doigts** : quatre `tube` à trois phalanges, rayon 0,9 cm qui s'affine à 0,75 cm, **sans renflement** aux
  articulations, **serrés** (entraxe 2,0 cm pour 1,8 cm de diamètre), enroulés autour du tube de la jante. La première
  phalange passe par-dessus la jante, bien visible ; le bout finit côté intérieur, à peine visible.
- [ ] **Pouce** : `tube` à deux phalanges, couché sur la face avant de la jante, pointé vers le moyeu et un peu vers
  le haut, son bout sur la branche. Jamais dressé.
- [ ] **Couleur** : gant de la couleur de la voiture (rouge pour le joueur), paume et dessous des doigts en cuir sombre
  (une seconde forme libre « paume »), garde de jointures ton sur ton plus sombre. Si la voiture est très claire :
  gant sombre. Pas de gant blanc uni.
- [ ] **Poignet** : élastique court sombre, puis revers de la manche de la combinaison. Manche en `tube` le long de la
  courbe de Bézier actuelle, 5,5 cm au poignet, 7 cm au coude ; coudes bas et serrés.
- [ ] Échelle : main à 31 % du diamètre du volant (facteur `e` actuel).
- [ ] Changement de rapport : garder le geste de la main droite vers le pommeau ; la main s'y pose paume vers le bas.
- [ ] Au-delà de 100° de rotation de la jante, la main du haut lâche et se replace (deux prises), comme dans
  vroom-unreal. Facultatif si le reste est bon : la rotation est bornée à 92°.
- [ ] Tests : main dans le cadre, doigts qui touchent le tube sans le traverser de plus de 2 mm, pouce sous la jante
  haute, aucune sphère d'articulation.

Fini quand : en gros plan (champ de 9°), on reconnaît une main gantée qui serre une jante, et David ne dit plus
« Warner Bros ». Lui montrer la capture avant d'aller plus loin.

### Lot 1E — Rétroviseurs en vraie image (facultatif, après accord de David)

Rendu de la scène vers une texture 512 × 128 depuis une caméra tournée vers l'arrière, plaquée sur les deux glaces ;
une image sur deux en qualité « auto ». Demande une passe et une matière de plus dans le moteur : le chiffrer avant.

## 5. Phase 2 — Conduite : poids, équilibre, dérapages contrôlés

Détail dans « Chantier 2 » de `FEUILLE-DE-ROUTE.md` : il fait foi. Avant de commencer :

- [ ] Lire le travail laissé dans `.claude/worktrees/wf_654723d2-ff3-1` (branche `physique/conduite`, réécriture
  partielle de `src/conduite.js`, 377 lignes ajoutées, rien de commité ni de vérifié). Le reprendre s'il tient les
  tests de `verifications/conduite.test.mjs`, sinon repartir de `main`. Dire à David ce qui a été gardé.
- [ ] Écrire le banc `BITUME_JEU.banc()` prévu au chantier 1 : il sert à juger la conduite sans la jouer.
- [ ] Suivre l'ordre du chantier 2 : transfert de charge, sous-virage et survirage, dérive tenue au contre-braquage,
  reprise d'adhérence, frein à l'entrée de virage.

Fini quand : les critères chiffrés du chantier 2 passent en test, et David a conduit un tour.

## 6. Phase 3 — Chocs entre voitures et sauts roue contre roue

Détail dans « Chantier 3 » de `FEUILLE-DE-ROUTE.md`. Le saut roue contre roue est une mécanique du genre que David a
demandée le 12/11 : la refaire avec nos constantes, rien de Lankhor.

## 7. Phase 4 — Lots suivants

Dans l'ordre de `FEUILLE-DE-ROUTE.md` : lumière, matière et forêt ; bords de piste ; relief, horizon et caractère des
circuits (les massifs de Haut-Col sont aujourd'hui de grands pavés gris : les refaire en carènes dès que le lot 1A
existe) ; voiture vivante ; peloton et voix des rivaux ; tours propres, records et saison.

## 8. Restes connus

- Ombre des voitures en gros pavés en qualité « auto » (texel de 10 cm) : essayer 2 048 par défaut si les
  performances suivent.
- Caméra de bord de piste : elle peut encore se trouver derrière un arbre ou un pilier de passerelle.
- La première note du thème du titre n'arrive qu'au premier geste (règle des navigateurs) : rien à faire.
- `README.md` dit « environ 360 Ko » : à remettre à jour après la phase 1.

## 9. Journal

- 12/11/2026 — Plan écrit. Phase 1 à commencer par le lot 1A.
- 12/11/2026 — Lot 1A fini (Opus 5.5).
- 12/11/2026 — Lot 1B fini (Opus 5.5).
