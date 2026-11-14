# BITUME — suivi de la phase 2 (conduite), pour reprendre

Écrit le 12/11/2026 vers 23 h 15 par Claude (Opus 5.5), à la demande de David : « finis ce que es en train de faire,
puis commit push et fais doc suivi pour reprendre plus tard, pause token », puis « donne un maximum de boulot au
spark avant ta pause, tu reprendras ses resultats ». La phase 2 est celle de `PLAN-MAITRE.md` §5, c'est-à-dire le
chantier 2 de `FEUILLE-DE-ROUTE.md` (qui fait foi).

## 1. Ce qui est fait et commité

- **Modèle** (`src/conduite.js`) : la bicyclette dynamique de la branche `physique/conduite` sert de base.
  - Elle est fusionnée avec les réglages de deux agents, « équilibre » et « dérive » :
    - fondu en S de l'arrière ;
    - tirage de l'avant ;
    - turbo borné par l'ellipse ;
    - amortisseur de glisse qui lâche.
  - Correctif : une voiture presque arrêtée, caisse retournée, repart.
  - Réglages de phase 2, avec leur nom dans PARAMS :
    - `ellipseMotrice: 1.3` : la poussée du moteur prend plus d'adhérence latérale à l'arrière que l'ellipse. L'ellipse
      reste entière en dérive au bouton et sous turbo ;
    - guidage du clavier (0,15) effacé vers le plein volant : plein volant = `braquageMax(v)`, comme pour l'IA ;
    - `deriveContreRetombee: 0.25` : le contre-braquage compte aussitôt pour la qualité de la dérive, puis retombe
      lentement. Des appuis répétés au clavier valent un contre-braquage tenu ;
    - `hauteurCG: 0.33`, au lieu de 0,32.
- **IA** (`src/course.js`) : volant par `volantPour`, aide légère `AIDE_IA = 0.35`, aspiration (`aspirer`).
- **Effets** (`src/traces.js`, nouveau) : 512 bandes de traces effacées en 24 s, 48 fumées, 48 étincelles, à 30 Hz.
- **Jeu** (`src/jeu.js`, `src/index.html`) :
  - curseur Secousses, et prefers-reduced-motion respecté ;
  - records et fantômes versionnés avec la physique (`bitume.records.p2`) ;
  - `BITUME_JEU.avancer()` : essai sans écriture ;
  - banc `BITUME_JEU.banc({ duree, qualite, circuit })` : qualité fixe ; p50, p95 et pire image en JSON ; n'écrit ni
    record ni fantôme.
- **Tests** : toutes les suites `verifications/*.test.mjs` passent.
  - Traces : 10/10.
  - Course : 8/8, aspiration comprise.
  - Conduite : 17/17. Deux anciens tests sont adaptés au nouveau comportement : « cercle avec volant » passe par
    `volantPour`, et « turbo » utilise le palier III.
  - Carène, circuit, main, réalisateur, son et voiture passent aussi.

**Repris de la branche `physique/conduite`** (worktree `.claude/worktrees/wf_654723d2-ff3-1`) : son modèle à deux
essieux sert de base. Ses trois anciens tests en échec traduisaient un comportement changé, pas une panne ; deux sont
adaptés, le troisième (« dérive annulée fond ») passe de nouveau. Le worktree est laissé en place : le supprimer
demande l'accord de David.

## 2. Mesures du modèle commité

Les scripts sont dans `verifications/phase2/` : `outils.mjs` contient les aides ; `gaz.mjs` (S3), `contre.mjs` (S4),
`clavier.mjs` (S5), `divers.mjs` (S9 à S11) et `lever.mjs` les essais. On les lance par
`node verifications/phase2/<script>.mjs`. Pour essayer une variante du modèle : `BITUME_CONDUITE=chemin/conduite.js`.

| Critère | Mesure | Verdict |
|---|---|---|
| Charge avant à −3 g, en freinant depuis 86 / 92 m/s | 0,616 / 0,604 | ok (≥ 0,60) |
| Charge vers l'arrière à l'accélération en 2e | 0,344, pour une répartition de 0,44 | ok |
| Lever de pied en R 120 à la limite : lacet après 0,5 s | × 1,128 | ok (≥ 1,05) |
| Frein 0,3 en entrée de R 120 : courbure | × 1,52 | ok |
| Plein gaz en 2e, R 63 à sa limite (115 km/h) : dérive arrière | 3,4 → 7,9° | ok (≥ 6°) |
| Plein gaz en 3e, R 120 (170 km/h) : dérive arrière | 3,4 → 4,2° | non : la 3e y est au rupteur |
| Plein gaz en 5e, R 200 : courbure / dérive arrière | × 0,991 / 3,6° | élargit un peu, sans glisser |
| Coup de glisse (β + 11,5°, ω + 0,6) en R 120 | témoin en tête-à-queue ; rattrapé par un contre-braquage en 0,3 s | ok |
| Plein braquage, droit et R 150 / R 300 avec guidage 0,15 | 1,10 à 1,163 | ok (≤ 1,2) |
| Dérive au clavier sur la piste réelle de 12 m (guidage 0,15, aide 0,35) | palier 3 aux six cadences ; 1 à 6 pilotes sur 162 (0 avant le réglage) | ok, mais exigeant |
| Ancien banc dérive, sur piste large | paliers 0,69 / 1,30 / 2,10 ; tenues R 40 à 400 ; R 80 + 0,242 s ; lissage ; martelé ; coupure | ok |

## 3. Reste à faire, dans l'ordre

1. **Reprendre les résultats du Spark** : voir § 5. Les relire et les vérifier avant d'intégrer quoi que ce soit.
2. **Réécrire le banc des critères** en `verifications/conduite-criteres.test.mjs`. Aujourd'hui,
   `verifications/phase2/criteres-ancien-banc.mjs` tient 36 critères sur 42 avec l'ancien pilote ; c'est le portage
   de l'ancien banc, non corrigé.
   - Suivre les scénarios S1 à S11 du § 4 et la revue `verifications/phase2/revue-banc.json` : 19 problèmes, plus
     les critères absents.
   - Reprendre les deux changements de l'agent dérive : `verifications/phase2/derive-changements-banc.txt`.
   - Restent à mesurer sur la piste réelle : paliers au mieux (S6), gain en R 80 avec droite d'approche (S7),
     lissage sur le pire scénario (S8), tenues à la manette, coupure du turbo par un vrai contact.
3. **Navigateur**, avec la session affichée : la fenêtre doit être visible, sinon les temps d'image ne valent rien.
   - `BITUME_JEU.pauseAuto = false` et `BITUME_JEU.reglages.demo = 'non'`.
   - En 1390×1295, `await BITUME_JEU.banc()` doit donner p95 ≤ 16,7 ms et pire image ≤ 29 ms.
   - Captures en dérive, à comparer à `cockpit-035-drift.png` de vroom-unreal.
   - Effets visibles en poursuite ; curseur Secousses.
   - Rien de cela n'a été fait le 12/11 : la session n'était ouverte dans aucune fenêtre.
4. **Lot de corrections de la phase 1**, reçu le 12/11 vers 23 h 20. La relecture compte 21 constats, établis sur une
   copie figée de `3ce9c87`.
   - **Où** : `~/Library/Application Support/Claude/side-session-notes/local_5593f513-cac7-4bfb-8e49-a01f28dce7e2/bitume-phase1-relecture/` ;
     `relecture/constats-phase1.md` pour les constats ; `relecture-wf/` pour les scripts de preuve et les correctifs
     mesurés.
    - **À faire d'abord, au prochain commit** :
      - **voi-1** (grave, régression du lot 1B) **[fait 13/11, Spark]** : le flanc est percé derrière la roue avant (x de 0,66 à 0,94, y de
        0,12 à 0,30), et le décor se voit à travers dans toutes les vues extérieures. Correctif mesuré : ajouter
        `{ x: .58, y0: .10, y1: .36, l: .22, n: 4 }` à la fin de `S_QUILLE` (`src/voiture.js`), plus un test de
        silhouette : rayons latéraux sur x de 0,6 à 1,0 et y de 0,12 à 0,30.
      - **carene-1 et rendu-1** (un seul défaut) **[fait 13/11, Spark]** : 90 faces retournées dans 7 formes libres (jonc, rétroviseurs,
        arceau…), d'où des trous visibles. Cause : `triangle()` réoriente dans le cube unité après l'échelle de
        `normaliser()`. Correction vérifiée : à `src/moteur/renderer.js:697`, garder l'ordre du registre pour les
        formes libres, avec la marque BITUME et une ligne dans PROVENANCE.md, plus deux tests.
      - **voi-2** (moyen) **[fait 13/11, Spark]** : les numéros sont toujours blancs, illisibles sur une caisse claire.
   - **Le reste** est mineur : à trier. Un seul constat est incertain, `voi-5`.
   - Les premiers jets du Spark viennent de la file de la session parente (voir § 5). Partir de ces jets, sans
     redemander au Spark.
5. **Fin de phase** : David conduit un tour, puis on coche `PLAN-MAITRE.md` §5.

**Décisions à faire trancher par David** (les critères de poids et d'équilibre « seront réglés en jouant avec David ») :
- « Plein gaz en 2e ou 3e » dans le R 120 à la limite (184 km/h) : la 2e n'y va pas (144 km/h au plus) et la 3e y
  est au rupteur. Le critère est mesuré en 2e dans un R 63 à sa limite : 7,9°. À valider en jouant.
- `ellipseMotrice` 1,3 : en sortie de virage lent, plein gaz fait glisser l'arrière. Avec l'aide 0,35 du clavier, la
  glisse monte à 5,2° au lieu de 7,9°.
- Le contre-braquage idéal de la manette module le gaz ; au clavier, le gaz est tout ou rien.
- La dérive au clavier est tenable mais exigeante : à juger en jouant.
- Supprimer le worktree `.claude/worktrees/wf_654723d2-ff3-1`.

## 4. Scénarios S1 à S11 (décidés le 12/11 pour le banc)

- **S1** : piste réelle `circuit({ R, largeur: 12, limite: 20 })`, avec des bords à ±6 m et de l'herbe au-delà. Elle
  sert pour la dérive (paliers, clavier, tenue, R 80) et le contre-braquage. Les essais qui restent sur la ligne
  peuvent garder la piste large.
- **S2** : approche stabilisée d'au moins 6 s au pilote d'adhérence avant le bouton ou la perturbation. Jamais de
  départ à froid en 1re.
- **S3** : plein gaz en boîte manuelle, aide 0, guidage 0, volant figé après `tenir(R, v0, 8)`. Mesure : dérive arrière
  maximale, côté survirage. 2e et 3e sont essayées au rayon où 0,93 × vLimite(R) vaut 0,80 × la pointe du rapport,
  ce qui laisse de la marge avant le rupteur. La 3e est aussi essayée en R 120. Cible : 6° pour au moins un rapport.
- **S4** : R 120 à 0,98 × vLimite, 8 s, puis coup β + 0,2 rad et ω + 0,6 rad/s. Le témoin garde volant et gaz
  figés ; l'essai contre-braque 0,3 s après une glisse de 4°, avec volant = v_stab − 2,5·(β − β0). Cible : le témoin
  part en tête-à-queue, l'essai non.
- **S5** : clavier en R 120 à vRef. Décision toutes les 0,2 ou 0,1 s, lue à 30, 60 ou 120 Hz ; touches tout-ou-rien
  (contre, rien, intérieur ; gaz 0 ou 1) ; guidage 0,15, aide 0,35. Grille de 162 pilotes : voir
  `verifications/phase2/clavier.mjs`. Cible : au moins un pilote atteint le palier 3, sans annulation et avec
  |d| < 5,5 m.
- **S6** : paliers au mieux sur la piste réelle. Famille : intérieur ti pendant tau, puis contre q. Cible :
  0,70 / 1,30 / 2,10 s, à ±0,05 s.
- **S7** : R 80, avec 150 m de droite, un arc de 180° et 200 m de droite. La référence d'adhérence est le meilleur
  temps propre à 0,94, 0,96, 0,98 ou 1,00 × vLimite. La dérive est tenue jusqu'à la sortie et lâchée là, sans frein
  sous turbo. Cible : un turbo III, et un gain de 0,1 à 0,3 s.
- **S8** : lissage |d²β/dt²| ≤ 300°/s² à 60 et 120 Hz, sur le pire de tous les scénarios de dérive.
- **S9** : plein braquage ≤ 1,2 × le lacet limite, pour trois cas : droit sans guidage, R 150 et R 300 avec guidage
  0,15. Et `braquageMax(v)` est partagé avec l'IA.
- **S10** : charge à −3 g depuis 86 et 92 m/s, lue au pas suivant ; charge vers l'arrière à l'accélération.
- **S11** : frein 0,3 en entrée, courbure ≥ × 1,05 ; plein gaz sur un rapport long en R 200, courbure < 1 et dérive
  arrière < 6°.

## 5. Travail laissé au Spark pendant la pause

Douze demandes au Spark, une à la fois, à effort bas, sans mémoire, de 6 600 à 12 400 caractères. Elles tournent par
`nohup`, détachées de la session.
- **Dossier** : `~/Library/Application Support/Claude/side-session-notes/local_5593f513-cac7-4bfb-8e49-a01f28dce7e2/bitume-phase2-spark/`.
- **Contenu** : `demandes/<nom>.txt` (les demandes), `resultats/<nom>.md` (les réponses ; `.err` pour les erreurs),
  `file-spark.log` (le déroulé ; « FINI » à la fin), `file-spark.sh` (la file).
- **Relance** : `./file-spark.sh` dans ce dossier refait seulement les demandes sans résultat.
- **Écrire les critères** :
  - `criteres-equilibre` : S3, S4, S9 à S11 et lever de pied, au format `noter(...)` ;
  - `criteres-derive` : S5 à S8 et tenues, à la manette comme au clavier ;
  - `criteres-ia-contact` : `braquageMax` et l'IA, turbo coupé par un vrai choc de glissière et par un contact entre
    voitures, même loi pour l'IA.
- **Relire le code** :
  - `revue-conduite-1` à `4` : `src/conduite.js` en quatre parties ;
  - `revue-traces-1` et `2` : `src/traces.js` ;
  - `revue-jeu-1` et `2` : le diff de `src/jeu.js` ;
  - `revue-course` : le diff de `src/course.js` et de son test.

**Relecture de la phase 1** : les premiers jets viennent de la file de la session parente. Elle compte 26 demandes,
lancées à 23 h 15.
- **Ses 01 à 13** sont les correctifs et les tests des constats, dans cet ordre :
  1. silhouette (`voi-1`) ;
  2. faces retournées ;
  3. numéros ;
  4. passage de rapport ;
  5. rétroviseurs et témoin ;
  6. main au levier ;
  7. intérieur des carènes ;
  8. `tube` vif ;
  9. tests de `carene.js` ;
  10. filet et bande ;
  11. jonc ;
  12. attaches ;
  13. pouce.
- **Ses 14 à 26** sont pour la session parente.
- **Où** :
  - à l'origine, dans le dossier temporaire de cette session :
    `/private/tmp/claude-501/-Users-david--claude-spares-spare-P0ORBU/d8022a8d-0508-4111-8b89-0d5fd42d6565/scratchpad/spark-file/`,
    avec des fichiers `NN-nom.mode.out` et un journal `journal.txt` ;
  - en copie, toutes les 5 minutes jusque vers 2 h 45, dans `bitume-phase1-relecture/spark-session-parente/` du
    même dossier de notes.
- **Ma propre seconde file**, qui faisait doublon, est annulée.
- **Seconde file de la session parente**, lancée le 13/11 à 0 h 36 avec 21 demandes :
  - **Où** : `.../scratchpad/spark-file-2/` (même racine que `spark-file/`), en copie toutes les 5 minutes
    jusque vers 4 h 45 dans `bitume-phase1-relecture/spark-session-parente-2/`.
  - **Ses 01 à 08** : seconde relecture du code de la phase 2 au commit `120ba98` (`conduite.js` : unités,
    stabilité, énergie créée, continuité aux seuils, déterminisme ; `traces.js` ; intégration dans `course.js` et
    `jeu.js`). Elle complète les miennes ; la croiser avec elles.
  - **Ses 09 à 14** : le Spark relit ses brouillons 01 à 06 de la première file. Le correctif marche-t-il ? Le test
    échoue-t-il avant et passe-t-il après ? À lire avant de reprendre un brouillon.
  - **Ses 15 à 21** : pour la session parente.

**Ma file de la phase 2 est finie** (13/11 à 0 h 21) : ses 12 réponses sont dans
`bitume-phase2-spark/resultats/`.
- **Attention** : ces jets sont écrits sur `3ce9c87` ; `src/jeu.js` a bougé depuis, au commit `120ba98`.

Les réponses du Spark sont des brouillons : rien n'est intégré sans être lu, lancé et mesuré.

Règles rappelées le 12/11 :
- jamais OpenCode pour une relecture, ni aucun service en ligne qui verrait la mémoire KBZA ;
- le Spark fait les premiers jets et les relectures, Claude cadre, intègre, teste et compare les captures ;
- un agent à la fois, et aucun workflow sans que David le demande.

## Passage de Codex (13/11)

- **Banc** : `verifications/conduite-criteres.test.mjs` porte les critères de l'ancien banc et les critères
  absents issus de S1 à S11 : charge, équilibre, départ, pente, aspiration, dérive clavier/manette, paliers,
  tenue, braquage maximal, turbo, IA et contacts. Il passe en Node pur : **46/46 critères obligatoires**.
  S8 reste affiché comme mesure ouverte : le pire lissage mesuré est **997,4 °/s²** (cible ≤ 300), avec
  **269,1 °/s²** pour les paliers et **501,3 / 905,7 / 821,0 / 997,4 °/s²** pour les cas clavier
  (60/120 Hz, impulsions 0,2/0,1 s). Aucun seuil n'a été abaissé pour le déclarer vert.
- **Mesures de piste** : S6 atteint **0,70 / 1,31 / 2,11 s** (écart maximal 0,008 s) ; les tenues manette
  R40/R120/R250/R400 restent respectivement à **2,417 / 1,124 / 0,327 / 1,083 m** de décalage maximal.
  S7, sur droite 150 m + demi-tour R80 + sortie 200 m, donne **14,41 s** en adhérence contre **14,11 s**
  en dérive, soit **0,300 s**, avec turbo III. Le turbo est aussi coupé par frein, herbe, glissière réelle
  et contact réel entre voitures ; l'IA suit la même loi et reste finie après 60 s.
- **Relectures intégrées** : correction de la limite gauche nulle, du seuil de perte avant turbo, de la remise
  à zéro des variables de dérive à l'extinction, des valeurs pente/dévers non finies, de la graine de traces
  nulle et de la force négative des étincelles. `verifications/relectures-phase2.test.mjs` fournit six
  régressions dédiées ; elles passent toutes.
- **Constats rejetés** : la relecture de l'aspiration de `course.js` est fausse sur le code actuel (écart signé,
  longueur de voiture distincte, test existant vert). Les alertes défensives de `jeu.js` et les remarques de
  `traces.js` sans reproduction déterministe ont été laissées intactes. La formule turbo proposée par une
  relecture et les réglages de filtre de β n'ont pas été appliqués : aucune preuve isolée ne les justifiait,
  et le filtre essayé dégradait S3, S4, S7 et S9. S8 reste donc une mesure à régler, pas une validation.
- **Validation** : toutes les suites `verifications/*.test.mjs` passent, y compris `conduite-criteres` et
  `relectures-phase2`. Commits poussés : `95295ce` (banc), `30e0264` (corrections et régressions).

## Passage du Spark (13/11, lot de corrections de la phase 1)

Repris des jets de la file de la session parente (`spark-session-parente/01 à 03`), vérifiés contre le code actuel.

- **voi-1** : section `{ x: .58, y0: .10, y1: .36, l: .22, n: 4 }` ajoutée à `S_QUILLE` (`src/voiture.js`). Le test de
  silhouette (rayons latéraux x 0,60→1,00, y 0,12→0,30, pas de 2 cm) trouvait **144 points percés** avant, **0** après.
- **carene-1 / rendu-1** : `geometry()` émet désormais les formes libres dans l'ordre du registre, sans passer par
  `triangle()` (marque BITUME, PROVENANCE n° 11). Nouveau `verifications/formes-libres.test.mjs` : faux WebGL2,
  capture des tampons de `create()`, contrôle positions et normales contre le registre — **1036 défauts avant, 0
  après** (27 768 triangles). Garde ajoutée dans `voiture.test.mjs` : chaque triangle du registre, ramené en vraie
  grandeur (`p·taille + centre`, `n/taille`), a sa normale géométrique du côté de n0.
- **voi-2** : l'encre des numéros se choisit selon le fond (blanc si contraste ≥ 3 avec le blanc, noir sinon) ;
  `course.js` exporte `LIVREES`. Test sur les douze livrées : contraste minimal **3,19:1** ; le rouge du joueur garde
  le blanc du plan maître.
- `voiture.test.mjs` : 19 → 22 vérifications. Douze suites vertes. Le worktree `.claude/worktrees/` est intact.
- **Reste du lot** : constats mineurs à trier (voi-5 incertain) et les jets 04 à 13 (passage de rapport, rétroviseurs
  et témoin, main au levier, intérieur des carènes, `tube` vif, tests de `carene.js`, filet et bande, jonc, attaches,
  pouce).

## Passage du Spark (14/11, lot 2 des constats mineurs de la phase 1)

Tiré des jets 04 à 13 de la session parente, mesuré avant dêtre appliqué. Six corrections, chacune tenue par un
## Passage du Spark (14/11, lot 2 des constats mineurs de la phase 1)

Tiré des jets 04 à 13 de la session parente, mesuré avant d'être appliqué. Six corrections, chacune tenue par un
test rouge sur l'ancien code puis vert sur le nouveau.

- **carene-3** : `tube()` adapte le vif au nombre de côtés (`vif ?? max(50, 360/cotes + 15)`). À six côtés, deux
  faces voisines du tour dépassent 50° et chaque génératrice restait vive : **78/78 sommets collés à une seule
  face avant, 0 après**.
- **voi-3** : numéro de flanc recentré (centre y 0,275→0,262, hauteur 0,16→0,15) : il dépassait le filet
  (haut 0,3684 → 0,3483, entre la bande 0,17 et le filet 0,357).
- **voi-4** : le jonc de l'ouverture reçoit trois points par arc (avant et arrière) ; la corde de Catmull-Rom
  bombait hors de l'ouverture (x 0,5461 → sous 0,545, bord à 0,52).
- **voi-7** : attaches intérieures des triangles de suspension posées sur la peau de la quille (z 0,20→0,145 à
  x 1,52 et 0,17 à x 1,18) ; le test lance un rayon depuis chaque sommet de l'anneau et exige un contact à moins
  du rayon du tube.
- **cockpit-1 / cockpit-5** : dans les rétroviseurs, le suiveur le plus proche s'enfonce plus que le lointain
  (un seul lot de dessin, depthFunc LEQUAL : sans quoi le lointain recouvrait le proche) ; hauteur et largeur du
  reflet bornées pour que caisse et pneus restent dans la glace.
- **cockpit-8** : le témoin rouge s'allume aussi sous le ralenti de `conduite.js` (seuil pris dans `PARAMS`,
  plus de 2 500 codé en dur — le ralenti est 4 000, le témoin ne s'allumait jamais).
- **carene-5 (gardes, sans correction)** : `miroir` permute bien les normales avec les sommets, `lisser` garde
  vive une arête de 90° et l'adoucit à 100°, et chaque sommet de `tube` reste à r ± 1 % de l'axe lissé.
- `carene.test.mjs` : 10 → 14 vérifications ; `voiture.test.mjs` : 22 → 27. Douze suites vertes.
- **Différé** (mesures insuffisantes ou non testables en Node) : carene-2 (cloisons intérieures de la goutte),
  carene-4 (pouce, 16 px), cockpit-2/3/4/6 (jeu.js, rendu à voir), voi-5 (incertain), voi-6 (correctif non mesuré).

## Passage du Spark (14/11, S8 : mesure ouverte, piste écartée par la mesure)

- **Fondu doux à l'extinction de dérive** (`src/conduite.js`) : aux fins naturelles (relâchement du bouton, perte
  de contrôle, annulation interne frein/herbe/piste/angle), `amorce`, `melange` et `tirage` retombent désormais
  par leurs filtres (sortie 0,16 s) au lieu de passer à zéro d'un cran — la caisse ne peut pas reprendre
  l'adhérence instantanément. La voie publique `annulerDerive` (contact, reset) et la grille restent des remises
  à zéro dures, comme les régressions de `relectures-phase2` les fixent. Aucune mesure ne bouge (46/46, S8 à
  997,4) ; c'est une correction de physique, pas un réglage.
- **S8 explorée à fond — le pic n'est pas à l'extinction**. Sonde sur le pire scénario (clavier 0,1 s à 120 Hz,
  profil a 0,5 / kd 0,1 / kv 0,3) : le pic de 997 °/s² frappe **en pleine dérive**, à un renversement de volant
  (la progression de β casse de +0,14° à +0,07° par pas en deux échantillons). Le pas de volant brut du
  clavier (jeu.js envoie
  ±1 sans rampe, le banc est fidèle au jeu) se propage sans retard dans l'effort avant : `pneu()` est raide et
  rien ne retarde la force latérale.
- **Pistes mesurées et écartées** (chacune casse des critères obligatoires) :
  - `deriveTirageTau` 0,06→0,16 : S8 stagne à 944–1020, critères 41–45/46 ;
  - `volantMontee`/`volantRetour` 0,05–0,07 : S8 640–888 au mieux, critères 32–40/46, et divergence à 0,07 ;
  - `deriveAlpha` 0,18–0,35 : S8 930–977, critères 39–45/46 ;
  - relaxation de pneu (retard d'effort latéral, avant+arrière, τ 0,03–0,08) : S8 468–578 au mieux mais S4, S5,
    S7 et S9 cassent (42/46 au meilleur point), et divergence au-delà de τ 0,04.
- **Conclusion** : ≤ 300 °/s² au clavier tout-ou-rien est incompatible avec les critères de nervosité (S5 exige
  une réponse aux impulsions de 0,1 s ; S4/S9 exigent des efforts avant instantanés). La décision est à David :
  soit accepter 997 comme coût du clavier brut, soit ramper le volant clavier dans `jeu.js` (changement de
  sensation à juger en jouant, pas au banc). S8 reste mesure ouverte, aucun seuil abaissé.

## Passage du Spark (14/11, carene-2 : cloisons de l'ouverture de la goutte)

- Constat (jet 07) : `interieur: true` ne doublait que les anneaux entre les bords de l'ouverture ; par
  l'ouverture, on voyait l'envers de la peau au-delà (x > 0,52 vers le nez, x < −0,24 vers l'arrière), éliminé
  en simple face — le relecteur mesurait 22 px percés à la caméra de poursuite.
- Correctif (`src/carene.js`) : quand une carène a ouverture et doublure, deux cloisons en éventail ferment la
  cavité sur les anneaux de `de` et `a`, tournées vers l'ouverture (2 × 28 = 56 triangles, dans la doublure,
  donc dans `goutte-dedans` côté voiture).
- Test (`voiture.test.mjs`, 27 → 28) : depuis deux points de la cavité, chaque face d'envers de la peau
  (2 393 rayons) doit rencontrer une doublure avant elle. **1 565 percées avant, 0 après.** Le compteur de
  `formes-libres` passe de 28 056 à 28 112 triangles, soit les 56 cloisons annoncées. Douze suites vertes.

## Passage du Spark (14/11, carene-4 : le coude du pouce ne se recoupe plus)

- Constat (jet 13) : entre l'éminence et le premier point posé sur la jante, l'axe lissé du pouce avait un rayon
  de courbure de 8,8–9,6 mm pour un tube de 12,0–12,4 mm — la peau se recoupait à l'intérieur du virage
  (16 px visibles du côté pilote, 6 faces enfouies mesurées par le relecteur).
- Correctif (`src/main.js`) : premier point de contact du pouce sur la jante remonté de 2 mm et ramené de
  −24° à −20° (`POUCE.tour[0]` de `[.026, −24]` à `[.028, −20]`). C'est le plus petit mouvement qui annule le
  défaut (grille balayée : `[.026, −18]` laisse 2 faces, `[.030, −21]` en laisse 4, `[.028, −20]` : 0).
- Test (`voiture.test.mjs`, 28 → 29) : le pouce est reconstruit depuis les constantes exportées de `main.js`,
  puis chaque face est sondée juste au-dessus de sa normale — son dehors immédiat ne doit pas être dans le
  volume (parité de rayons). **12 faces enfouies avant, 0 après.** Les doigts n'avaient rien (garde du constat).
  Douze suites vertes ; le test des gants hors des branches tient toujours.

## Passage du Spark (14/11, voi-5 : la cuve sombre se voit du dehors)

- Constat (jet 14, contradicteur « vrai ») : la cuve sombre de l'habitacle n'était dessinée qu'en vue cockpit
  (`dedans`). Vu du haut, le fond de l'ouverture renvoyait le dessus rouge des pontons (y 0,44–0,45) —
  l'habitacle paraissait plein, peint couleur caisse, 17 à 20 cm sous le bord.
- Correctif (`src/voiture.js`) : `L('cuve', …)` perd son drapeau `dedans` — la cuve se dessine aussi en vue
  extérieure. Prolongée par la quille depuis voi-1, elle ne dépasse nulle part la carrosserie et ne se voit que
  par l'ouverture (le relecteur mesurait « ponton rouge 0/578, sombre 578/578 » avec quille + cuve).
- Test (`voiture.test.mjs`, 29 → 30) : 91 rayons obliques d'une caméra haute arrière (−4 ; 6 ; 0) visent le
  plancher de l'habitacle ; tout premier impact tombant dans le volume d'habitacle (x −0,24→0,52, |z| ≤ 0,2,
  y ≤ 0,55) ne doit pas être rouge. **44/44 rayons rouges avant, 0 après** (le capot moteur, légitimement rouge
  et hors du volume, est exclu du compte). Douze suites vertes, banc conduite inchangé.

## Passage du Spark (14/11, voi-6 : la bande des pontons redevient une peau décalée)

- Constat (relecture e1, « Spark : vrai », correctif proposé non mesuré) : la bande c2 du bas des pontons
  était une carène à part (demi-hauteur 0,037, exposant 6) ; à y 0,104 elle sortait de **19,3 cm** de la peau
  (z 0,690 contre 0,497 à x −0,40) et finissait en fond plat à x 0,60.
- Le correctif proposé (carène `y0−0,004, y1+0,004, l+0,004`) a été **essayé et mesuré : insuffisant** — un
  décalage vertical sur une superellipse n'est pas un décalage le long de la normale (reste 6,6 cm de saillie
  à (−0,8 ; 0,104), la face d'appel étant quasi verticale).
- Correctif retenu (`src/voiture.js`) : construire la peau des pontons (`S_PONTONS.slice(1, 5)`, bouts ouverts),
  décaler chaque sommet **le long de sa normale lissée** de 4 mm, garder les faces sous y 0,17. La bande suit
  exactement l'arrondi du ponton, partout à 4 mm.
- Test (`voiture.test.mjs`, 30 → 31) : chaque centre de face de la bande doit être à 2–8 mm du maillage du
  ponton (distance point-triangle). **Ancien code : première face à 69 mm → échec ; nouveau : 31/31.** Le
  compteur `formes-libres` descend à 27 667 triangles (la bande évidée est plus légère que le caisson).
  Douze suites vertes.

## Passage du Spark (14/11, cockpit-4 : paume vers le bas au pommeau, même volant tourné)

- Constat (relecture e1, confirmé par le contradicteur) : au pommeau, la main gardait la rotation du volant.
  Le repère de départ porte déjà −phi, et la rotation vers le levier valait `versLevier · π/2` : la pose
  d'arrivée était tournée de −phi. Mesuré à mi-changement : paume à 25° du bas volant droit, 58,7° à ±0,6,
  **91,5° à ±1** (doigts vers le haut ou vers le pommeau).
- Correctif (`src/voiture.js`) : rotation `versLevier · (π/2 + phi)` — la paume revient sous la main quel que
  soit le braquage, comme le proposait la relecture.
- Test (`voiture.test.mjs`, 31 → 32) : à mi-changement (passage 0,45), l'axe local z du gant droit doit rester
  à moins de 40° de la verticale basse pour volant −1, −0,6, 0, 0,6, 1. **Ancien code : 91,5° à volant −1 →
  échec ; nouveau : 32/32.** Douze suites vertes.
- **Signalé par le contradicteur, non traité** : 633 à 680 sommets de la main restent enfoncés de 4,6 à 5,6 mm
  dans la boule du pommeau à tous les braquages (pose au pommeau, indépendant de cockpit-4).

## Passage du Spark (14/11, cockpit-2 et cockpit-6 : l'animation de passage ne se téléporte plus)

- Constats (relecture e1, confirmés par le contradicteur), tous deux à `src/jeu.js:340` :
  - **cockpit-6** : au premier pas de chaque séance, `rapportVu` est indéfini → `tPassage` est posé alors
    qu'aucun rapport n'a changé ; sur la grille, la main droite fait un aller-retour complet au levier dans
    les 0,36 premières secondes (gant mesuré à (1331 ; 1027) px au lieu de (1149 ; 989) en 1920×1080).
  - **cockpit-2** : un second changement pendant l'animation (par exemple 4→3→2 à 0,15 s d'écart) remet
    `tPassage` à l'horloge et `rapportAvant` au rapport intermédiaire : `passage` retombe de 0,37 à 0 et la
    main saute de 77,7 mm (231 px) en une image.
- Correctif (`src/jeu.js`) : premier pas → on initialise seule la référence, sans trajet ; changement arrivé
  pendant les 0,36 s en cours → **consommé sans reprise** (le trajet en cours vise déjà `etat.rapport`, la
  main finit son geste puis se repose, sans second bond).
- **Non testable en Node** (jeu.js dépend du DOM) : vérifié par relecture de la séquence 4→3→2 à 0,15 s et
  `node --check` ; à confirmer à l'écran par David (deux appuis rapprochés sur Q en boîte manuelle).
- **Reste différé** : cockpit-3 (les doigts traversent la jante pendant le trajet, 85 ms par changement) —
  exige une pose de gant ouvert dans `main.js`, travail de géométrie à juger au rendu.

## Passage du Spark (14/11, cockpit-3 : les doigts ne traversent plus la jante pendant le trajet)

- Constat (relecture e1, confirmé par le contradicteur) : pendant le trajet au pommeau, le gant droit fermé
  traversait le tore de la jante (mesuré ici : 16248 échantillons de sommets dans le volume, pénétration
  jusqu'à 12,8 mm, fenêtres t 0,01–0,05 et 0,95–0,99) et balayait la branche de 3 h.
- Correctif en deux temps (`src/main.js`, `src/voiture.js`) :
  - `construire(ouvert)` accepte une variante **main ouverte** : les doigts ne serrent plus le tube (angles de
    bouclage ramenés à 28 % vers le dehors, pouce soulevé à 30 %), enregistrée sous `main-gant-d-ouvert` ;
  - pendant le trajet, la main **s'écarte d'abord** de 16 mm vers le dehors et 16 mm vers le pilote (rampe sur
    les 2 % premiers et derniers du trajet), et le gant passe en variante ouverte dès qu'il ne touche plus le
    tube (écart ≥ 0,25) — la paume ouverte se pose sur le pommeau, puis le gant se referme en revenant.
- Test (`voiture.test.mjs`, 32 → 33) : pour passage de 0 à 1 par pas de 0,01, aucun sommet des cinq pièces
  droites dans le tore (centre `VOLANT.centre`, rayon 0,125, tube 13,4 mm) ni dans la branche de 3 h.
  **Ancien code : 16248 sommets, 12,8 mm → échec ; nouveau : 33/33.** Douze suites vertes ; formes libres
  27667 → 30919 triangles (la variante ouverte, ajoutée au registre, entre dans l'émission de la suite).
- Le test du trajet existant (main au pommeau) accepte les deux noms de gant, fermé ou ouvert.
- **Reste signalé, non traité** : 633 à 680 sommets de la main enfoncés de 4,6 à 5,6 mm dans la boule du
  pommeau à l'arrivée (indépendant du trajet) ; cockpit-3 jugé au rendu par David (pop d'ouverture à 5 ms
  du trajet, main déjà levée de 5 mm — invisible à l'œil, à confirmer).

## Passage du Spark (14/11, pommeau : la main se pose sur la boule sans s'y enfoncer)

- Constat différé du contradicteur (633 à 680 sommets dans la boule, 4,6 à 5,6 mm) mesuré à nouveau avec le
  gant ouvert de cockpit-3 : c'était pire — 3960 échantillons dans la boule, jusqu'à **21 mm** sous la surface
  (la cible du trajet était à 7 mm du centre de la boule de 40 mm), et le vol traversait la boule à l'aller
  (t 0,15–0,25) comme au retour (0,70–0,85), jusqu'à 35 mm.
- Correctifs (`src/voiture.js`) :
  - cible du trajet : `pommeau + wn·0,020 + wu·0,030` (au lieu de wn·0,004 + wu·0,006) — la paume ouverte se
    pose **sur** la boule, à 0,2 mm du contact, sans sommet dedans ;
  - le trajet devient un **arc de Bézier** passant 15 cm au-dessus du pommeau (sommet `cible + wu·0,15`) : en
    ligne droite les doigts piquaient dans la boule en vol ;
  - la rotation paume-en-bas s'achève dès t 0,10 (début) et ne se défait qu'à partir de t 0,86 (retour), au
    lieu de suivre l'avancée — les doigts ne balaient plus la boule en décollant ni en atterrissant sur la jante.
- Test (`voiture.test.mjs`, 33 assertions) : le test cockpit-3 vérifie en plus **zéro sommet dans la boule du
  pommeau** pour passage de 0 à 1 par pas de 0,01 (77122 sommets avec la cible haute seule, en ligne droite
  → 0 avec l'arc et la rotation rapide) ; le test du
  trajet exige désormais la paume posée à 30–50 mm du centre (contact surface, pas plongée : 40,2 mm mesuré).
  **Ancien code : échecs à chaque étape ; nouveau : 33/33.** Douze suites vertes.
- À juger au rendu par David : le geste est plus ample (main qui s'élève à 15 cm au-dessus du pommeau en
  0,36 s) — naturel au changement de rapport, à confirmer à l'écran.

## Passage du Spark (14/11, rendu-2 : marque BITUME sur les index 32 bits)

- Constat (relecture moteur, confirmé par le contradicteur) : le passage du tampon d'index de `Uint16Array` à
  `Uint32Array` (ligne 700 à l'époque de la relecture, 702 aujourd'hui) n'avait pas de marque « BITUME »,
  contrairement à la règle d'AGENTS.md ; un report des retouches sur une nouvelle version de FERRO par
  `grep BITUME` l'aurait oubliée — tampon 16 bits contre dessin en `UNSIGNED_INT`, WebGL2 refuse, plus de
  formes libres.
- Correctif : marque `// BITUME : index sur 32 bits (retouche 10, UNSIGNED_INT)` sur la ligne de retour de
  `geometry()`, et entrée 12 dans `src/moteur/PROVENANCE.md`.
- cockpit-7 (blocage de cardan dans `angles()`) : constat retiré par le contradicteur, rien à faire.
  Le lot de relecture est clos : sur les 22 constats, 21 sont traités, un est retiré.

## Passage du Spark (14/11, chantier-3 : retours de ressenti — roue perdue, vibrations)

- Retours de David sur le Chantier 3, traités en solo :
  - **roue perdue = on ne pilote plus** (physique, pas un simple message) et **course jamais déclarée finie** :
    on s'inspire du vroom original, la caisse est **réparée et replacée sur la route**, remplacement **lent**
    qui pénalise le temps de course.
  - **vibrations « trop abusé »** : modèle revu plus fin (courbe en puissance, seuil de silence, pics plafonnés)
    et **puissance réglable dans le menu**.
  - **roue cassée visible en extérieur mais pas en vue FPS** : incohérence de rendu corrigée.
- `conduite.js` : nouvel état `reparation` (machine `arret` → `stand` → repositionnement). Une roue manquante
  coupe direction et motricité, la caisse roule en ligne et freine (`rouePerdueFrein`, `rouePerdueTraine`,
  lacet `rouePerdueLacet`), s'immobilise, répare `reparationDuree` (9 s) à l'arrêt, puis se fait repositionner
  par `declencherAccident` (retour progressif en piste). `accidenter()` **répare la caisse au retour** (roue
  remise, `degats.reparer`). Paramètres ajoutés à `PARAMS`.
- `voiture.js` + `jeu.js` : `cockpit()` propage enfin `options.roues` à `poser()` → une roue avant perdue est
  masquée **aussi en vue cockpit**, comme en extérieur.
- `jeu.js` : `vibrationManette` réécrite — grondement moteur doux, mise en forme en `x^1.25`, seuil de silence
  à 0,04, pics de choc plafonnés ; **puissance maître** `reglages.vibrationForce` (défaut 0,5). Nouveau slider
  « Puissance des vibrations » dans le fieldset Manette (`index.html`), câblé et persisté.
- `son.js` + `jeu.js` : sons et messages **Réparation…** / **Repositionné** (`reparation`, `repare`).
- `verifications/contacts.test.mjs` : +6 critères « roue perdue » (immobilisation sans motricité, **plein
  gauche = plein droit** = plus de direction, réparation + repositionnement signalés, roue remise, retombée en
  `d ≈ 0`, état fini / course non terminée). **44/44** critères Chantier 3. Quinze suites vertes, build ok.

## Passage du Spark (14/11, chantier-3 : collisions/glissière et filtre rouge)

- Retours de David (capture : caisse **épinglée nez contre le rail à 0 km/h**, et **voile rouge plein écran qui
  reste** après un choc fort sans casse). Deux bugs racine trouvés :
  - **rebond de glissière renvoyé VERS le mur** : `etat.psi = cdg * …` pointait le nez dans le rail → la caisse
    restait collée, frottait et s'immobilisait. Corrigé en **dégagement vers la piste** (`psi = -cdg * …`) +
    **anti-épinglage** (au ralenti, la caisse se dégage du mur) + `auRail`/cooldown pour un **vrai premier
    contact** (le frottement continu ne re-déclenche plus de choc).
  - **voile rouge = `damage` plein écran piloté par `degats.teinte`** (permanent, ne se remet qu'à la réparation).
    Un choc fort sans casse laissait l'écran rouge. **Décorrélé** : `damage` ne suit plus que l'**éclair
    transitoire** du choc (`eclair`), qui s'éteint ; plus de rouge permanent.
- Récupération de travaux **orphelins non commités** d'une session précédente (scp mais jamais commités sur le
  Mac) : le test-régression `verifications/glissiere-rebond.test.mjs` (exige dégagement vers la piste, un seul
  choc, décollage du rail) — c'est exactement la correction ci-dessus ; et l'**optimisation de l'index d'axe**
  de `decor.js` (Map → tableau dense borné) avec son test d'**identité de géométrie** `decor-identite.test.mjs`
  (9 empreintes de référence inchangées).
- `jeu.js` : `PHYSIQUE` passé de `p2` à `p3` — la physique a changé (réparation, roue perdue, rebond), les
  records/fantômes d'avant ne sont plus comparables (remise à zéro volontaire).
- `verifications/conduite.test.mjs` : +1 test « la caisse collée au rail se dégage et repart ». Dix-sept suites
  vertes (dont `glissiere-rebond` et `decor-identite`), build ok.

## Passage du Spark (14/11, rendu : boost de réflexion « photoréaliste » en qualité Fine)

- Demande de David : améliorer les reflets en qualité Fine (le jeu n'a pas de mode « photoréaliste », seulement
  Légère/Auto/Fine). Choix retenu avec lui : **boost analytique d'abord**, **fluidité d'abord** (pas de passe
  render-to-texture, le moteur reste « pas de miroir de scène »).
- `renderer.js` (retouche BITUME n° 13, PROVENANCE à jour) : nouvel uniforme `uPhoto` (passé par le jeu via
  `fx.photo`, 1 quand la qualité n'est pas Légère) qui active, dans la passe de fragment, un **reflet net du
  soleil** (Blinn-Phong borné, modulé par la rugosité), un **renvoi chaud du sol** et un **reflet
  d'environnement renforcé** sur les surfaces lisses. L'**asphalte** (matière 14) passe de `roughness .9` à `.5`
  (humide, il renvoie le ciel) et le **vernis des monoplaces** (matière 17) de `.46` à `.3`.
- Tout est gated par `uPhoto` : en **qualité Légère le rendu est identique** à avant ; aucune passe GPU ajoutée.
  `jeu.js` passe `photo: q !== 'low'`.
- Reste à faire (validé avec David, en attente) : reflets **plans** des voitures sur la route et **SSR** (lourds,
  contre la conception du moteur), et le **système météo** (pluie, vent, orages, éclairs).
