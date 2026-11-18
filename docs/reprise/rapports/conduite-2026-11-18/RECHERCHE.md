# Conduite — ce que disent les sources (18/11/2026)

Matière des quatre recherches faites pour le lot 17 (pneu ; aéro, freins, transmission et moteur ; jeux « simcade »
et game design ; communautés de réglages), mise en forme pour le plan `docs/reprise/17-CONDUITE.md`. Chaque nombre
garde sa source et sa fiabilité. Ces recherches ont été menées en amont du plan ; **aucune source n'a été relue en
ligne pendant la rédaction** : ce document range et confronte, il ne revérifie pas.

Repères de fiabilité, en fin de ligne :

- **[S]** source technique : livre, article d'ingénieur, document d'un éditeur de simulateur ;
- **[F]** forum, guide ou réglage de joueurs (utile pour le ressenti, pas pour un chiffre physique) ;
- **[E]** estimation des chercheurs (calcul ou ordre de grandeur sans source directe) ;
- **[X]** page lue seulement en extrait (protégée, refusée ou tronquée) : à relire avant d'en tirer une valeur.

## En bref : ce que le plan en retient

1. **Une courbe de pneu à pic franc et à plateau** : force qui monte jusqu'au pic, puis retombe doucement vers 80 à
   90 % du pic, jamais en falaise. C'est le point d'accord des quatre recherches ; elles divergent sur l'angle du pic
   (3 à 9° selon le point de vue), que le banc tranche (plan § 3.2).
2. **Sensibilité à la charge** : l'adhérence par newton baisse quand la charge monte (deux fois la charge, 1,76 fois la
   force chez Milliken). C'est elle qui donne leur sens aux transferts : freiner en entrée fait tourner, lever le pied
   referme, mettre les gaz élargit.
3. **Transferts** : longitudinal m·a·h/L (environ 12 % du poids par g pour la T5), latéral réparti par essieu selon la
   raideur au roulis (50 à 60 % sur l'avant), une part immédiate (géométrique) et une part retardée (élastique, 50 à
   150 ms).
4. **Glissement combiné normalisé** (Beckman) : freiner ou accélérer prend de l'adhérence latérale, de façon continue.
5. **La 312 T5** : 515 ch à 12 300 tr/min, environ 320 N·m, 595 kg, empattement 2 700 mm, voies 1 700 / 1 615 mm,
   pneus radiaux Michelin, freins acier sans assistance ni ABS, voiture surtout « à ailerons » (le flat-12 gênait les
   venturis). Pas de victoire en 1980.
6. **Aéro de 1980** : appui en v², ordre de grandeur 1,1 à 1,3 fois le poids à 250 km/h pour la T5 (estimation),
   traînée CdA vers 1 m² ; le sillage ôte de la traînée **et** de l'appui à la voiture qui suit.
7. **Freins** : 2 à 2,5 g à haute vitesse ; le blocage de l'arrière fait partir la voiture, celui de l'avant la fait
   tirer tout droit ; la répartition se règle pour que l'avant bloque le premier.
8. **Côté jeu** : rattraper doit rester possible (plateau haut, fenêtre de 100 à 200 ms après la rupture), la
   direction doit se calmer avec la vitesse, le clavier a besoin d'une rampe, la dérive arcade se charge en 0,8 à
   2,4 s et rend 0,5 à 2 s de poussée, et la perte d'adhérence s'annonce (son qui baisse de hauteur après le pic,
   vibration basse quand l'avant arrive au pic, haute quand l'arrière patine).

## 1. Pneu

### Mécanismes et chiffres

| Sujet | Ce que disent les sources | Fiab. |
|---|---|---|
| Pic de force latérale | Ajustement de Beckman : pic à 3,273° en latéral et à 7,96 % de glissement en longitudinal. | [S] |
| Angle au pic selon les pneus | Pneus de F1 vers 3°, pneus de route 6 à 10° (Wikipédia d'après Milliken) ; pneus de course diagonaux et radiaux 3 à 6°. | [S] |
| Après le pic | Recommandation : garder 85 à 90 % du pic à trois fois l'angle du pic. | [E] |
| Sensibilité à la charge | Milliken, de 900 à 1 800 lbf : force × 1,76 (exposant ≈ 0,82) ; Fy/Fz passe de 1,10 à 0,97 (1,08 à 1 350 lbf) ; angle du pic de 5,6 à 6,7°. Wikipédia donne un exposant de 0,7 à 0,9, sans source (« citation nécessaire »). | [S] |
| Loi proposée | μ = μ0·(Fz/Fz0)^−0,18 et angle du pic = angle0·(Fz/Fz0)^0,25. | [E] |
| Transfert latéral | ΔW = a_y·h·W/t ; exemple : 0,9 g, voie 1 650 mm, CG 550 mm → environ 30 % du poids ; pour la T5, environ 40 % à 2 g (estimation). | [S] / [E] |
| Partage entre essieux (TLLTD) | Part élastique retardée, part géométrique immédiate (HP Academy) ; un seul paramètre 0 à 1 ; retard 0,05 à 0,15 s. | [S] |
| Transfert longitudinal | ΔW = m·a·h/L ; Beckman : environ 20 % par g pour h = 20 % de L ; la T5 (h/L ≈ 0,11) : environ 11 % par g ; filtre 0,05 à 0,1 s. | [S] |
| Glissement combiné | 0,6 g en longitudinal laisse environ 0,8 g en latéral ; normalisation de Beckman ; Brach (SAE) : l'ellipse n'est pas quantitative ; un léger freinage peut augmenter l'adhérence de braquage. | [S] |
| Radial ou diagonal | Radial 3 à 5°, diagonal 5 à 8° (forums, contradictoires). Ferrari roulait en radiaux Michelin dès 1978 ; Goodyear restait en diagonaux jusqu'au début des années 1980. Recommandation : pic à 3,5–4,5°, retombée lente. | [F] / [S] |
| Couple d'autoalignement | Mz = −t_p(α)·Fy culmine avant Fy (forums) ; il ne doit pas être le seul avertissement. | [F] |
| Relaxation | Longueur de 0,12 à 0,45 m, de l'ordre du rayon de la roue ; τ = L/v (environ 10 ms à 30 m/s, 30 ms à 10 m/s) ; recommandation 0,3 m avec un plancher de vitesse. | [S] |
| Freins | Blocage de l'arrière : tête-à-queue ; blocage de l'avant : sous-virage. Aucun pourcentage dans les sources. | [S] |
| Température | Fenêtre de travail de 10 à 15 °C de large autour de 105 °C ; μ ± 5 à 8 %. Cause du grainage contradictoire (froid ou chaud). | [F] |

### Ce que font les simulateurs

- rFactor 2 (TGM) : modèle à brosses, anneau rigide à six degrés de liberté, table de consultation, nœuds thermiques [S].
- iRacing : charge, température, usure, déformation de la carcasse [X].
- Assetto Corsa Competizione : cinq points de température [X] ; Assetto Corsa EVO : angle du pic réduit [X].
- Automobilista 2 : carcasse reprise, « plateau indulgent » discuté par les joueurs [F].
- BeamNG : pneu en nœuds et poutres [S].
- **Aucun éditeur ne publie ses coefficients.**

### Recommandations retenues (la recherche en comptait seize)

- Une courbe à pic et retombée lente, 85 à 90 % à trois fois le pic ; une loi de charge en puissance (−0,18 sur μ,
  +0,25 sur l'angle du pic) ; une part géométrique du transfert latéral ; un filtre de 50 à 100 ms sur le
  longitudinal ; la normalisation de Beckman pour le combiné ; une relaxation de 0,3 m avec plancher de vitesse.
- Une tolérance de ±2 à 4 % entre voitures si l'on veut des voitures qui diffèrent, et une validation au banc en °/g
  (gradient de sous-virage).

### Sources

- en.wikipedia.org/wiki/Tire_load_sensitivity · /Weight_transfer · /Relaxation_length · /Slip_(vehicle_dynamics)
- designjudges.com : articles « critical-specifications-for-balance », « reverse-engineering-tires »,
  « brake-bias-and-stability »
- hpacademy.com : « lateral-load-transfer-basics-total-lateral-load-transfer-distribution-and-tuning »
- cygnus-supra.duckdns.org/Supra/Library/PhysicsOfRacing/physics_of_racing_25.html, _07.html, _10.html (Beckman,
  *The Physics of Racing*)
- f1technical.net/forum/viewtopic.php?p=67293 [F]
- studio-397.com/wp-content/uploads/2016/12/rF2_TGM_TyreTool_QuickStart_V3.pdf
- bsimracing.com : « automobilista-2-v1-5-physics-development-update-part-2 »
- forum.reizastudios.com/threads/physics-discussion-thread.14874/page-39 [F]
- overtake.gg : « assetto-corsa-competizione-the-5-point-tyre-model-blog.171148 » [X, page refusée (403)]
- boxthislap.org : « assetto-corsa-evo-0-9-tyre-model » [X, page protégée]
- iracing.com/?p=3826 [X]
- beamng.com/game/news/patch/a-look-at-tire-development-in-beamng-part-1
- mozaracing.com : « self-aligning-torque-explained-how-force-feedback-tells-you-the-grip-limit »
- motorsportmagazine.com : « special-article race-to-road-ferrari/116 ferrari-312-t3-the-michelin-gamble »
- lfs.net/forum/post/475258 [X, F]

## 2. Aéro, freins, transmission, moteur

### La 312 T5 (fiche)

| Grandeur | Valeur | Fiab. |
|---|---|---|
| Moteur | flat-12 de 2 992 cm³, 80 × 49,6 mm, compression 11,5:1 | [S] |
| Puissance | 515 ch (379 kW) à 12 300 tr/min (510 selon d'autres sources) | [S] |
| Couple | environ 320 N·m ; 298 N·m au régime de puissance maxi, par le calcul | [E] |
| Masse | 595 kg avec eau et huile (ou à sec selon la source) ; châssis 048 pesé 598 kg | [S] |
| Empattement, voies | 2 700 mm ; 1 700 mm à l'avant, 1 615 mm à l'arrière | [S] |
| Réservoir | 182 à 185 L | [S] |
| Boîte | transversale, 5 rapports (6 selon les circuits) ; différentiel autobloquant à disques | [S] |
| Freins | disques ventilés en fonte Brembo, étriers Lockheed, sans assistance, sans ABS | [S] |
| Pneus | Michelin 23/59-13 à l'avant, 38/68-13 à l'arrière ; jantes 12 × 13 et 18 × 13 | [S] |
| Aéro | le flat-12 gênait les venturis (Scheckter) : surtout une voiture « à ailerons » | [S] |
| Saison | aucune victoire en 1980 | [S] |

Repères de 1980 (moyennes des poles) : Imola 1:33,988 (Arnoux, environ 191 km/h) ; Österreichring 1:30,270 (environ
237 km/h) ; Hockenheim 231 km/h (Jones) [S]. Estimation des chercheurs : la T5 à 5–8 % de la meilleure voiture [E].

### Aéro et sillage

- Appui en v² ; la Williams FW07 : environ 80 % de l'appui sous le fond, 20 % à l'aileron arrière, finesse 6 à 7
  (Dernie) [S].
- Jupes coulissantes d'environ 75 mm de course (15 mm de jupe souple en 1981) ; garde au sol de 6 cm en 1981 ;
  l'étanchéité compte plus que la hauteur ; courbe de hauteur avec une bosse et de l'hystérésis ; marsouinage [S].
- Désaccord : Wright juge la sensibilité faible avec des jupes coulissantes, d'autres décrivent des pertes brutales [S].
- Estimations : Williams environ 1,8 fois son poids d'appui à 250 km/h (3,5 g et plus), T5 1,1 à 1,3 fois ; ClA 4
  contre 2,5 à 3 m² ; CdA environ 1 m² [E]. Les 4,5 g de Surer sont une anecdote non vérifiée [F].
- Équilibre aéro réglé près de la répartition des masses, 2 à 3 points vers l'arrière pour un pilote confirmé, 5 à 10
  pour un amateur (HP Academy) [S].
- Sillage : −23 % de traînée et −36 % d'appui pour une monoplace des années 1990 (Durham) ; 55 % de l'appui gardé à
  10 m pour une F1 moderne (FIA) ; une source secondaire cite −37 % de traînée [S]. Plafonds recommandés : −20 % de
  traînée, −25 % d'appui avant [E].

### Freins

- Environ 0,6 g de la seule traînée à 300 km/h ; pic de 2 à 2,5 g à haute vitesse, environ 1,5 g à basse vitesse [E].
- Répartition de 55 à 62 % sur l'avant ; pic de force à 10–15 % de glissement ; −15 à −20 % de force roue bloquée ;
  58 % proposé par défaut [E].

### Différentiel, frein moteur, boîte

- Autobloquant : précharge plus rampes de puissance et de frein moteur ; moment de lacet ∝ différence de couple ×
  voie, de signe variable ; puissance 35–50 %, frein moteur 15–30 %, précharge 20–40 N·m [E] ;
  T_transfert = min(précharge + rampe·|T|, deux fois la limite d'adhérence) ; défauts proposés 40 % et 20 %, puissance
  jamais au-delà de 50 % [E].
- Frein moteur : 40 à 70 N·m à 10 000 tr/min ramenés par le rapport [E] ; loi c0 + c1·régime ; coup de gaz
  automatique au rétrogradage ; en boîte manuelle, surrégime à 1,05–1,1 fois la zone rouge.
- Boîte : plage utile 8 000 à 12 300 tr/min ; rapport de 1,15 à 1,25 entre deux vitesses ; chute de 1 800 à
  2 400 tr/min au passage ; pointe 290 à 310 km/h ; couple plat au-dessus de 8 500 tr/min et 30 à 35 % plus bas sous
  7 000 ; coupure d'allumage de 40 à 80 ms [E].

### Flammes et pétarades (pour le son et l'image, plus tard)

Causes : croisement des soupapes, faible contre-pression, essence aspirée pied levé, allumage retardé, rupteur qui
coupe l'étincelle sans couper l'essence ; aucune source propre à 1980 [S]. Estimation de conception : au-dessus de
70 % de la zone rouge, gaz refermé en moins de 0,15 s ; flamme de 0,2 à 1 m, orange-jaune à base bleue, 50 à 200 ms ;
série de 2 à 6 détonations espacées de 20 à 50 ms [E].

### Sources

- f1technical.net/f1db/cars/443/ferrari-312t5 · en.wikipedia.org/wiki/Ferrari_312T · ferrari.com/formula1/312-t5
- motorsportmagazine.com, archives : « november-2002/41/312t5-1980 », « november-2004/75/williams-sw07 »,
  « july-2004/134/venturi-capitalists »
- racingnews365.com : « exclusive-marc-surer-relives-the-dangers-of-the-previous-ground-effect-era »
- formula1.com : « re-writing-the-f1-rule-book-part-1-from-wing-cars-to-flat-bottoms »
- eprints.soton.ac.uk/509221 · durham-repository.worktribe.com/OutputFile/1374051
- the-race.com/formula-1/exclusive-new-data-f1-aero-losses-ruining-close-racing
- hpacademy.com : « aerodynamics-fundamentals / aero-balance », transfert latéral (§ 1)
- miata.net/sport/Physics/07-Circle.html · saemobilus.sae.org : article 2004-01-3530
- motor1.com/features/767719/limited-slip-differential-explained · designjudges.com : « differential-effects »
- classicmotorsports.com/forum/grm/learn-me-fwd-lsd-tuning/161370/page1 [F]
- flowracers.com/blog/f1-brake-bias [F] · en.wikipedia.org/wiki/Back-fire · f1technical.net/forum/viewtopic.php?p=81591 [F]
- gran-turismo.com/gb/gt7/apex/settings/08
- racing-reference.info/qual-results/1980-10/F · formulaonehistory.com/1980-italian-grand-prix
- thebrakereport.com : « formula-1-innovations-the-carbon-brake-revolution »

## 3. Jeux « simcade » et game design

### Courbe et charges, côté jeu

- Pic pointu : nerveux ; pic arrondi à queue relevée : la perte s'annonce (Lupine, mod BeamNG) [F]. Proposition : pic
  à 7–9°, 80–85 % à 2,5 fois le pic, jamais sous 70 % ; retombée de 15 à 25 % au plus ; avant plus raide que
  l'arrière [E].
- Sensibilité à la charge : facteur (Fz/Fz0)^(0,85 à 1) sur le pic (soit q de 0 à 0,15) [E].
- Transfert longitudinal (formule de Marco Monster) : 600 kg, h 0,30, L 2,70, 1,5 g → environ 1 000 N (17 %) ; filtre
  60 à 120 ms ; exagérer h de 10 à 20 % pour le ressenti [E].
- TLLTD 50 à 60 % sur l'avant ; relaxation 0,3 à 0,8 m (τ 10 à 50 ms) [E].

### Direction, clavier, manette

- Direction selon la vitesse : environ 10° de braquage à basse vitesse, environ 2° à haute vitesse (Game Developer) ;
  plafond à l'angle optimal plus environ 1° [S].
- BeamNG Advanced Steering, valeurs par défaut : réponse 0,35, amortissement 0,5, angle maxi 8°, autorité du joueur
  0,7, marge de contre-braquage 4°, vitesse de braquage 1,2 ; un préréglage de dérive presque automatique existe [S].
  Les joueurs de Gran Turismo disent aller plus vite sans l'aide au contre-braquage [F].
- Clavier : rampe de 0,3 à 0,5 s jusqu'au plein braquage, retour en 0,15 à 0,25 s, plus rapide que la montée (1,5 à
  2 fois) [E].
- Manette : zone morte radiale 5 à 10 %, exposant 1,5 à 2 (proposition sans source) [E].

### Dérive à la façon arcade

- Mario Kart : entrée au-delà de 55 % de la vitesse de pointe ; braquage doux ou appuyé chargent pareil, le
  contre-braquage charge plus lentement ; poussée de 28 à 188 images à 60 i/s (0,5 à 3 s), raideur de mini-turbo 1 à
  5,75 ; trois paliers [S].
- Recommandation : charge en 0,8 à 2,4 s, poussée de 0,5 à 2 s [E].
- Sega Rally : transferts et autres effets retirés, une glisse garde la vitesse ; Daytona : glisses à moitié
  accidentelles ; Hotshot Racing : dérive au tapotement de frein, poussée liée à la dérive [S].

### Sensation de vitesse et retours

- Caméra basse, objets proches, textures de sol grossières ; champ de vision vers 90°, élargi par MotoGP au-delà de
  100 mph [S]. Flou de mouvement contradictoire : Disney Research ne lui trouve aucun effet sur l'expérience [S].
- Vibration basse fréquence quand l'avant approche du pic, haute fréquence au patinage et à l'arrière ; résistance des
  gâchettes (F1 22, GT7) ; haptique de Dirt 5 [S].
- Le crissement baisse de fréquence passé la limite (Beckman) [S].

### Pièges, préréglages, nombres

- Pièges : latence d'entrée, voiture « sur rails », voiture qui flotte, survirage instantané. Recommandation 15 : queue
  jamais au-dessus de 85 % ; recommandation 14 : 100 à 200 ms de force latérale au-dessus de la courbe établie après une
  rupture [E].
- Préréglages : Vif, Stable, Dérive facile ; l'effet de sol en option du mode difficile [E].
- Nombres : glissement longitudinal au pic de 0,06 (Marco Monster) à 0,15 (ajustement de Beckman
  F = B·Fz·s/(1 + |A·s|^P), A 9,625, B 31,0, P 2,375, erreur sous 10 % du pic) ; Lupine D 1, C 1,35 en latéral, 1,65
  en longitudinal, B 10, E 0 ; μ de 1,0 (route) à 1,5 (course) ; exemple de Marco Monster : 2 940 N pour 1 500 kg,
  h 1,0, L 2,5, 0,5 g ; traînée égale au roulement vers 30 m/s dans cet exemple ; relaxation définie à 63 %
  (Springer) [S].

### Sources

- rsms.me/etc/car-physics (Marco Monster)
- cygnus-supra.duckdns.org : physics_of_racing_29, _10, _07 · en.wikipedia.org : Tire_load_sensitivity, Slip,
  Understeer_and_oversteer
- lupine-vidya.itch.io/gdsim/devlog/677587/workshop-iii-rays-go-round-lateral-force-mirror
- beamng.com/resources/grip-dynamics-mod.36559 [F] · beamng.com/posts/1098657 [F]
- github.com/adam10603/BeamNG-Advanced-Steering (Explanation.md, ConfigGuide.md)
- gdcvault.com/play/1026035/Vehicle-Physics-and-Tire-Dynamics (Just Cause 4) · gdcvault.com/browse/gdc-17/play/1024004
  (Uncharted 4) · gdcvault.com/play/1025295 (Criterion)
- gamedeveloper.com : « implementing-racing-games-an-intro-to-different-approaches-and-their-game-design-trade-offs »
- generationamiga.com/2026/09/02/sega-rally-championship-how-tetsuya-mizuguchi-crashed-a-rally-car-during-development
- itsfantastic.moe/outrun-2-development-stories · gamingbolt.com : entretiens Hotshot Racing, art of rally
- thesixthaxis.com/2019/01/28/interview-ross-gowing-on-dirt-rally-2-0s-push-for-realism
- racinggames.gg : « forza-horizon-5-major-handling-upgrades-revealed », « f1-2021-setups-how-to-tune-out-oversteer-understeer-from-your-car »
- wiki.mkwtas.com/wiki/Manual_drift · kotaku.com : « everything-you-didn-t-know-about-drifting-in-mario-kart-1819196173 »
- shawnhargreaves.com/blog/speed-is-a-matter-of-perspective.html · /vrrroom-whoosh.html
- studios.disneyresearch.com/2013/11/06/simulated-motion-blur-does-not-improve-player-experience-in-racing-game
- blog.playstation.com/?p=366243 · segmentnext.com/2020/10/22/dirt-5-dualsense-features-simulate
- pcgamer.com : « f1-2020-setup-car-monaco-spa » [F] · racer.com/racerpedia/technical-explainers/what-is-ground-effect
- hpacademy.com, forum : « why-tire-friction-coefficient-changes-with-load » [F]
- link.springer.com/doi/10.1007/s11012-023-01684-z · lfs.net/forum/post/394577 [F]

## 4. Communautés de réglages

### Mécanismes, d'après les joueurs et leurs références

- Beckman, partie 1 : 3 200 lb, CG à 20 pouces, empattement 100 pouces, 1 g → 640 lb transférés (20 %) [S].
- Sensibilité : μ0·(Fz/Fz0)^(−0,15 à −0,25) [S].
- TLLTD : partir de 5 points au-dessus de la répartition statique (anecdotique) ; plage 45 à 65 % ; environ 55 % sur
  l'avant par défaut [F].

### Réglages courants

| Réglage | Valeurs relevées | Fiab. |
|---|---|---|
| Différentiel, frein moteur | 50–60 % (base d'un champion 56 % ; F1 22 50–55 % ; rampe de 80° pour un faible blocage chez Clutch) | [F] |
| Différentiel, puissance | 65–70 (F1 22), 70–100 (champion), environ 10 à la manette (F1 25) | [F] |
| Ailerons, hauteur | 0 à 50 crans ; hauteur 5–6 sur 11 (F1 2021) ; le tangage au freinage avance le centre de poussée (blog, à vérifier) | [F] |
| Carrossage, pincement | carrossage −3,5 à −2,5 à l'avant, −2,0 à −1,0 à l'arrière (réel −2,5 / −1,0) ; pincement 0,05–0,15 avant, 0,20–0,50 arrière ; recommandation : les fondre dans la loi du pneu (+3 à 5 % de latéral, un peu de motricité en moins) | [F] |
| Répartition de freinage | 54–57 % (champion F1 2021), 50–52 % (F1 22), sous 50 % pour de gros pneus arrière (iRacing, à confirmer) ; pression 90–100 % ; recommandation : 55–58 %, seuil de blocage progressif et un peu d'ABS à la manette | [F] |
| Pneus | 90 à 100 °C ; 21–25 psi avant, 19,5–23,5 arrière (23,3 / 21,3 au départ) ; chauffe en 2–3 tours (3–4 selon les joueurs), puis usure | [F] |
| Courbe d'adhérence | pic à 6–10° (F1 à 3°, débattu) ; −30 % en quelques degrés pour un pneu GT, presque plat pour un slick diagonal ; recommandation : pic vers 7°, baisse de 10 à 15 % entre 7 et 14° | [F] |
| Manette (F1 25) | linéarité 30–40, vitesse 115–130 %, zone morte 0, linéarité du frein 25–30, antipatinage moyen (environ 0,5 s au tour pour le contrôle complet) | [F] |
| Manette (Coach Dave, Rennsport) | multiplicateur de vitesse 0,67 (0,96 par défaut), lissage 0,02, lissage du frein 0,10 | [F] |

### Les voitures de 1978–80 selon les joueurs (Automobilista 2, iRacing)

Sous-virage marqué à basse vitesse (surtout aux gaz), adhérence qui croît avec la vitesse, précises mais pointues à
haute vitesse, survirage soudain dans les virages rapides ; rotation au freinage dégressif, puis lever de pied
doux [F]. Les accidents de plateforme (vibreurs, talonnage, décrochage du diffuseur) sont la cause la plus citée du
survirage soudain [F].

### Leçons d'éditeurs

EA (F1 2023) : le patinage coupe la poussée sans ôter tout le latéral ; vibreurs indulgents [S].

### Désaccords relevés

- Répartition de freinage (voir le tableau).
- Barre avant plus raide : entrée plus vive en transitoire, plus de sous-virage établi — les deux sont vrais [F].
- Pneus diagonaux de 1980 « non documentés » : contredit par les recherches 1 et 2 (radiaux Michelin chez Ferrari).

### Recommandations (vingt dans la recherche ; celles qui touchent le plan)

Effet de sol modeste avec une perte d'appui arrière progressive (pas brutale) sur les vibreurs ; vibreurs qui
délestent brièvement la roue qui les touche, avec un signal ; chauffe puis usure ; vibration ou retour de force qui
s'allège au sous-virage, vibre près du pic et reste ferme au survirage ; préréglages d'appui comme ceux de la Lotus 79
d'iRacing ; assiette (rake) ; cas d'essai chiffrés.

### Sources

- f1laps.com/blog/f1-game-car-setups-explained · f1laps.com/blog/f1-25-controller-settings [F]
- racinggames.gg/f1/f1-2021-setup-guide-tips-from-f1-esports-champion-jarno-opmeer ·
  racinggames.gg/f1/f1-2021-setups-how-to-tune-out-oversteer-understeer-from-your-car [F]
- virtualracingschool.com/academy/tag/setup [F]
- forum.reizastudios.com : /goto/post?id=91108, /posts/84528, /goto/post?id=84328, /goto/post?id=331107 [F]
- iracing.com/lotus-79-stew · iracing.com/no-fear-dont-brake
- autosport.com/f1/news/how-f1-2023-has-better-balanced-the-handling-conundrum-of-racing-games/10507628
- gamedeveloper.com (§ 3) · coachdaveacademy.com/tutorials/ultimate-rennsport-controller-settings [F]
- cygnus-supra.duckdns.org : physics_of_racing_01, _10 · Wikipédia et HP Academy (§ 1)
- motorsport.com/f1/news/lotus-79-tech-analysis-piola/4794820 · motorsportmagazine.com (312 T5, § 2)
- rossbentley.substack.com/p/speed-secrets-how-to-rotate-your [F]

## 5. Contradictions, et ce que le plan en fait

| Sujet | Ce qui s'oppose | Choix du plan | Comment c'est tranché |
|---|---|---|---|
| Angle du pic | Radiaux 3 à 5° (§ 1, § 2) ; simcade 7 à 9° (§ 3) ; joueurs vers 7° (§ 4) ; jeu actuel 6,0 / 5,4° | 4,9 / 4,4° au départ, plage 4,0–6,0 / 3,6–5,4° | Au banc (étude E2) : un pic plus bas amortit le lacet sans ralentir la réponse ; la direction par part d'adhérence cache l'angle au joueur |
| Retombée | 85–90 % à 3 fois le pic (§ 1) ; 80–85 % à 2,5 fois, jamais sous 70 % (§ 3) ; −30 % en quelques degrés pour un pneu GT (§ 4) | Plateau 85 % à l'avant, 80 % à l'arrière, sans falaise ; « mémoire du pic » de 0,15 s | Recouvrement des recherches 1 et 3 ; le pneu GT ne ressemble pas à un slick de 1980 |
| Sensibilité à la charge | q 0,15–0,25 (§ 1, § 4) ; q 0 à 0,15 (§ 3) | q 0,18, plage 0,10–0,25 | Milliken (mesure) contre une proposition sans source |
| Répartition de freinage | 55–62 % (§ 2) ; 50–57 % dans les jeux (§ 4) | 70 % au départ (plage 62–76 %) | Calcul E1 : avec 44 % de masse sur l'avant, 2,3 à 2,6 g, le frein moteur sur l'arrière et la sensibilité à la charge, l'arrière bloque le premier en dessous de 70 % ; le banc refait la mesure sur le vrai modèle (17D) |
| Radial ou diagonal | « Non documenté » (§ 4) ; radiaux Michelin chez Ferrari dès 1978 (§ 1, § 2) | Radial | Sources historiques contre forum |
| Relaxation | 0,12–0,45 m (§ 1) ; 0,3–0,8 m (§ 3) | Option, 0,3 m avec plancher à 5 m/s | Phase 2 (SUIVI-PHASE-2.md) : un retard fixe de 30 à 80 ms a cassé S4, S5, S7, S9 et divergé au-delà de 40 ms ; τ = σ/u ne vaut que 5 ms à 200 km/h |
| Volant au clavier | Rampe de 0,3 à 0,5 s (§ 3) ; critère S9 de la phase 2 : 90 % en 120 ms au plus | S9 gardé ; rampe selon la vitesse en option | Question à David (S8) |
| Différentiel, frein moteur | 15–30 % (§ 2) ; 50–60 % dans les jeux (§ 4) | 25 % au départ, plage 10–35 % | Au banc, entrée de virage (17C) |
| Effet de sol de la T5 | Voiture surtout à ailerons (§ 2) ; perte brutale ou faible selon les auteurs | Perte sur vibreur en option, faible (−12 %) | Question à David |
| Flou de mouvement | Utile selon certains, sans effet selon Disney Research | Absent du plan | Pas de preuve d'effet |
| Grainage | Froid ou chaud selon les sources | Hors du lot (température : lot 12) | — |

## 6. Limites de ce document

- Les pages marquées [X] n'ont été lues qu'en extrait ; aucune valeur du plan n'en dépend seule.
- Les chiffres [E] sont des ordres de grandeur ; le plan les prend comme points de départ, jamais comme cibles
  imposées : les cibles du plan viennent du banc (`BANC-BASE.md`) et de l'étude chiffrée (`etude-17/`).
- Rien ici ne remplace l'essai de David au volant.
