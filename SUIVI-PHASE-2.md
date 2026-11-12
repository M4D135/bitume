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
     - **voi-1** (grave, régression du lot 1B) : le flanc est percé derrière la roue avant (x de 0,66 à 0,94, y de
       0,12 à 0,30), et le décor se voit à travers dans toutes les vues extérieures. Correctif mesuré : ajouter
       `{ x: .58, y0: .10, y1: .36, l: .22, n: 4 }` à la fin de `S_QUILLE` (`src/voiture.js`), plus un test de
       silhouette : rayons latéraux sur x de 0,6 à 1,0 et y de 0,12 à 0,30.
     - **carene-1 et rendu-1** (un seul défaut) : 90 faces retournées dans 7 formes libres (jonc, rétroviseurs,
       arceau…), d'où des trous visibles. Cause : `triangle()` réoriente dans le cube unité après l'échelle de
       `normaliser()`. Correction vérifiée : à `src/moteur/renderer.js:697`, garder l'ordre du registre pour les
       formes libres, avec la marque BITUME et une ligne dans PROVENANCE.md, plus deux tests.
     - **voi-2** (moyen) : les numéros sont toujours blancs, illisibles sur une caisse claire.
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
- **Attention** : ces jets sont écrits sur `3ce9c87` ; `src/jeu.js` a bougé depuis, au commit `120ba98`.

Les réponses du Spark sont des brouillons : rien n'est intégré sans être lu, lancé et mesuré.

Règles rappelées le 12/11 :
- jamais OpenCode pour une relecture, ni aucun service en ligne qui verrait la mémoire KBZA ;
- le Spark fait les premiers jets et les relectures, Claude cadre, intègre, teste et compare les captures ;
- un agent à la fois, et aucun workflow sans que David le demande.
