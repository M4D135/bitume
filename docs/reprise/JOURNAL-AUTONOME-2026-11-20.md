# Journal autonome — 20 novembre 2026

## 001 — modèles, objectifs et file complète

Demande prioritaire de David : publier sur GitHub avant de continuer les développements.
Six originaux conservés avec empreintes ; distinction explicite entre objectifs, études p9/p10
et preuves du runtime p15. Programme de 17 destinations et lots transversaux conservés.
File de travail structurée et méthode de reprise par petits lots ajoutées.

Base : `f41614e1f3887a79ebbd633df3fde754534f202e`, jeu 0.2.62/p15.
Vérification de ce lot : empreintes des six originaux, JSON, liens locaux et périmètre documentation.
Aucun changement du runtime, du build ou de sa version.

Travaux parallèles préparés à cette date : démos/pilotes `b928fe7`, météo `b98bad5`.
Ce sont des checkpoints locaux, pas des livraisons. Leur sauvegarde distante et leur qualification
intégrée seront consignées séparément. Route-des-Cimes est en reconstruction documentée.

## 002 — socle et checkpoints publiés

PR #36 fusionnée : `fb6384cb1b3407eecdb72cf9471f137a459334d9`, arbre exact vérifié.
Les branches `backup/demos-pilotes-20261120` et `backup/meteo-matiere-20261120`
sauvegardent les premiers lots de code, avec arbres identiques aux checkpoints locaux.
Reçu : `rapports/REFERENCES-OBJECTIFS-2026-11-20/PUBLICATION.json`.
Raccords démo intégrés localement ; qualification intégrée et captures à poursuivre.
La matrice météo sépare les trois scènes pluie pour réduire le risque de timeout,
sans enlever un scénario ni réduire la résolution ; comparaison à la version publiée 0.2.62.

## 003 — candidat 0.2.63 intégré et repris

Les deux lots sont réunis et le build de 14 316 546 octets est reproductible.
150/152 suites dans la campagne récupérée ; le simulateur du regard arrière a été adapté
à la nouvelle poursuite, puis les deux échecs ont passé leur reprise ciblée. Le dépassement
initial Val-Brûlé à 165 ms reste déclaré, seuil 150 ms inchangé. FERRO : 34 modules exacts.
Les 11 rendus natifs de météo correspondent à la source intégrée. CI/captures à suivre.
Reçu : `rapports/DEMOS-PILOTES-METEO-2026-11-20/QUALIFICATION-0263.json`.

## 004 — retour geste/rapport et candidat 0.2.64

Checkpoint 0.2.63 sauvegardé : `0c438413a111113801c568e9fb5b331c759848ac`, arbre exact.
La revue du vrai rig a trouvé un saut de poignet à l’interruption d’un geste.
Retour amorti puis trajet du levier sont maintenant partagés entre les vues, sans changer
la boîte physique. 810 poses sans traversée et 21 tests ciblés réussis. Le build 0.2.64
est reproductible. CI complète et captures intégrées à contrôler avant fusion.

## 005 — Raccords finaux, revue intégrée et candidat 0.2.65

Le checkpoint 9cc701a sauvegarde les raccords et leurs échecs initiaux. Douze voitures passent sec/pluie/neige,
les trois couverts et le pont, sans replacement. La revue de 0.2.64 a refusé une fermeture prématurée :
CI 151/152, poing trop ouvert, projections poursuite trop faibles et contrôle aérien inadapté.
Le poing est replié dès les premières phalanges ; le panache visuel monte avec la vitesse et l'eau.
L'allocation V8 de 16 octets par pose est supprimée via le tampon numérique préalloué ; seuil inchangé.
Build 0.2.65 reproductible ; CI et images exactes à terminer avant fusion. Les traces des essais restent conservées.
Reçu : `rapports/COUVERTS-CIMES-2026-11-20/CANDIDAT-0265.json`.

## 006 — CI 0.2.65 examinée, candidat 0.2.66 corrigé

La PR #38 à `4cbbe874` a fourni 3 397 fichiers exactement conformes au candidat,
mais sa campagne termine à 155/159. Les quatre échecs sont conservés dans
`rapports/COUVERTS-CIMES-2026-11-20/CI-0265-INITIAL.json`.
Le catalogue cinéma attendait huit circuits ; le test des sols confondait les bords du pont
avec les accotements pleins et exigeait la même dalle au premier impact dans un raccord.
Les neuf circuits restent contrôlés, avec mutations de trou et de faux sol rejetées.
Une allocation réelle venait de l’itération des listes gelées de couverts : boucle indexée,
379 764 retours identiques, zéro octet pour les traces dans le banc ciblé.
La chauffe du banc des glaces est bornée et stabilisée ; seuils inchangés, témoin positif rejeté.
L’origine exacte de son pic CI reste inconnue ; la nouvelle campagne doit confirmer.
Les 48 images démos, 41 météo et cinq vues du Tunnel du Rocher de la 0.2.65 sont inspectées.
Pluie extérieure vue depuis un abri et réserves de composition restent explicitement ouvertes.
La 0.2.66 est construite deux fois à l’identique ; CI et captures exactes requises avant fusion.

## 007 — candidat 0.2.66 distant retrouvé et validation suivie

La PR #38 porte maintenant `1c1ac0c9e190368a02101263ddceb6be0b77240d` ; son arbre
`1f05e9b399e4584b814c4050bad9f5652261b097` correspond exactement au candidat local.
Les 326 empreintes sources et le HTML de 14 370 823 octets sont conformes au reçu.
Revue indépendante : aucun seuil relâché ; géométrie, conduite p15 et FERRO inchangés.
La campagne complète 44743369726 et les captures 44743369792 (démos), 44743369751
(météo), 44743369605 (couverts) sont suivies sans les relancer. Ce checkpoint ne
déclare ni leur réussite ni la fusion. Les preuves finales seront ajoutées après inspection.
Les changements en préparation sur la pluie sous abri restent dans leur lot suivant.
Reçu courant : `rapports/COUVERTS-CIMES-2026-11-20/SUIVI-PUBLICATION-0266.json`.

## 008 — démos exactes 0.2.66 inspectées

Le run 44743369792 réussit ses sept groupes. Les 48 PNG sont inspectés : 36 candidats
et 12 références ; chaque archive porte la bonne tête, le bon arbre et le bon build.
Aucune nouvelle anomalie bloquante observée. Montagne dégagée, volant raccordé, bras
contenus ; gouttes et panache en cockpit/poursuite, aucun dépôt sur l’écran aérien.
Bandeaux masquant certains sujets et neige claire restent des réserves. Il s’agit de
captures figées SwiftShader, sans mesure FPS matérielle. Campagne, météo et couverts
restent à terminer. Reçu : `rapports/COUVERTS-CIMES-2026-11-20/REVUE-DEMOS-0266.json`.

## 009 — campagne entière 0.2.66 réussie et archive contrôlée

Run 44743369726, job 136312371617 : 159/159 suites, zéro échec, 159 journaux présents.
L’artefact 14631793804 correspond à son digest GitHub ; ses 3 405 fichiers sources
ont exactement les contenus et modes du candidat. Le build est identique aux deux
constructions qualifiées. Les quatre échecs 0.2.65 restent dans le reçu historique.
Reçu : `rapports/COUVERTS-CIMES-2026-11-20/CI-0266-FINALE.json`. Les images météo
et couverts doivent encore être inspectées avant la fusion. Aucune campagne relancée.

## 010 — échec du scénario aérien conservé, fusion suspendue

La campagne générale reste à 159/159 et les premières vues tunnel passent. Le groupe
`cimes-dessus-toit` échoue : la voiture suivie sous le tunnel déclenche le repli normal
en poursuite, puis une caméra libre est posée dans le relief. Elle reçoit donc une
visière et ne montre pas le survol attendu. Les deux PNG et leurs observations sont
attribués au candidat exact. Le correctif porte sur la scène de capture et sa régression,
avec les mêmes rayons de route/voûte et les mêmes exigences d’absence de dépôt aérien.
Reçu : `rapports/COUVERTS-CIMES-2026-11-20/ECHEC-CAPTURE-AERIENNE-0266.json`.
La fusion attend cette reprise et les autres images. Aucun changement runtime annoncé.

## 011 — reprise aérienne réussie et toutes les images inspectées

Le correctif d’outil 40774189 conserve le jeu et son HTML. Les 10 tests ciblés incluent
la vraie géométrie PhysX : ancienne scène dans le relief, nouvelle caméra dégagée,
sujet après le portail et sondes toujours sur la voûte. Le run 44747519881 réussit
ses 2 images aériennes : vraie vue helico, eau/embruns/gouttes nuls, regard et cadre libres.
Les 22 images de couverts initiales retenues gardent leur provenance ; les 2 refusées restent
dans la revue initiale. Météo : 7/7 groupes et 41 PNG inspectés. Total retenu : 113 PNG,
références comprises, avec réserves explicites de pluie sous abri, bandeaux et relief/neige.
La campagne complète 44747519912 des outils corrigés reste en cours. Les travaux suivants
(pluie préparée, bandeaux encore sans correctif, PR #37 distincte) sont inventoriés dans
`rapports/COUVERTS-CIMES-2026-11-20/APRES-0266-PREPARATIONS.json` sans les déclarer intégrés.

## 012 — qualification finale complète, prête pour main

Run 44747519912 sur 40774189 : 159/159 suites, zéro échec. Artefact 14634652050
vérifié par digest ; 3 405 fichiers et modes conformes, 159 journaux présents, HTML identique.
Les 113 images retenues sont inspectées ; les 2 aériennes rejetées et la CI 0.2.65
à 155/159 restent attribuées à leur version. Les preuves finales ne changent que les documents
après la tête qualifiée. Reçu principal : `rapports/COUVERTS-CIMES-2026-11-20/PUBLICATION-0266.json`.
Le prototype pluie est également sauvegardé sur `backup/pluie-abris-20261120`, arbre exact
65442e90, commit d3bd240a ; il reste non intégré et non qualifié. La PR #37 reste conservée.
Prochaine opération : réunir ces preuves dans la PR #38, fusionner puis vérifier main.

## 013 — PR #38 fusionnée, main reçu et vérifié

Fusion `f3fb3eaa801494c4a2b0b9c0d22baf6eae2bd1a8`, tête de PR `5b83dddd` :
l’arbre distant `d370309f` est strictement celui du candidat final. Le HTML reçu garde
14 370 823 octets et son empreinte 18b15fd0…adf3b. Après la tête qualifiée 40774189,
les seuls écarts sont les documents et reçus. La version 0.2.66 est publiée sur main.
REPRISE, ETAT, FILE-TRAVAIL et les reçus sont réconciliés : neuf circuits livrés,
159/159 suites, 113 images retenues, deux captures refusées et quatre échecs 0.2.65
conservés. La suite vise pluie extérieure/composition ; le prototype est sauvegardé,
la PR #37 préservée, et les autres destinations restent au programme. Cette clôture
ne relance aucune campagne et ne modifie ni jeu, ni outils, ni build.

## 014 — consolidation vérifiée, avant publication du plan

Demande de David : fusionner et pousser tout sur une branche, puis ajouter le plan.
Inventaire : 50 références distantes, 34 secondaires déjà contenues dans main fd92eec1
et 15 têtes à préserver par ascendance. Dix patches de sources/études se réappliquent
exactement depuis leurs vraies bases ; 15 notices et les objets de chaque delta sont
réunis dans `preparations/`. Les anciens builds, captures et physiques ne sont pas
activés. Les études historiques auparavant signalées introuvables sont bien retrouvées.

PR #37 : dix reçus propres conservés (un seul chemin obsolète normalisé), contrôles
WebGL/pluie/rival/lentille repris. L'ancien seuil de poursuite à 0,05 est refusé :
le panache courant reste fort. 8/8 tests ciblés, 16/16 rapports et 48/48 empreintes
d'images passent, sans nouveau rendu. Runtime, version, p15, FERRO et HTML inchangés.
La campagne générale 159/159 conserve l'attribution à son candidat ; aucune relance.

Les précisions suivantes de David sont à réunir dans le plan après cette publication :
bras en collision avec le buste, un seul cockpit pour les deux vues et pilote assis
plus bas dans la cuve. La lecture confirme des transformations propres aux vues et
l'absence de régression bras/buste ; la pénétration précise reste à reproduire.
La publication et l'ascendance des 15 têtes doivent encore être vérifiées avant de
déclarer la consolidation terminée. Aucun nettoyage de références effectué.

## 015 — consolidation reçue et plans complets prêts à publier

Main distant vérifié : `9f2246df61c6503ea8fa0f71a28813b15b17f51c`, arbre
`4e9d600ebd8b5d60ae533941e87a21e16cc1e952`, identique à la consolidation locale.
Le commit conserve les 15 têtes historiques comme parents, en plus de la base main.
Les 50 références restent attribuées et les dix patches conservés ; aucun prototype
n’est activé par cette fusion. Le runtime 0.2.66/p15/FERRO 0.3.15 reste inchangé.

Le plan habitacle/pilote réunit H0–H2 et B0–B5 : géométrie unique en coordonnées
réelles dans toutes les vues, assise commune plus basse et plus enfoncée, contrôle
des bras contre le buste et la coque, mouvements et trois niveaux de détail.
Les sources primaires MotionBricks, codepawl/CMU et leurs conditions sont reconsultées ;
elles documentent une étude, sans importer de modèles ni d’animations dans le jeu.

Le plan eau/vitesse E0–E3 formalise la dernière précision : les gouttes peuvent
descendre à l’arrêt ; en roulant, le flux doit les écarter et les chasser visiblement.
Direction et trajectoire sont mesurées dans chaque vue cockpit/poursuite ; les sorties
par les bords, leur surface, le séchage et les nouveaux impacts restent distincts.
Les petites perles, nappes, grosses gouttes et traces sont toutes concernées.

Ces deux fiches sont prêtes à publier avant l’implémentation. Prochain lot météo :
E0/E1 ; chantier habitacle toujours ouvert H0/B0. Cette préparation documentaire
ne relance ni campagne ni capture, ne modifie aucun runtime et ne clôt aucun défaut.

## 016 — plans réconciliés, point d’entrée et reçus publiés

Main a avancé pendant la préparation documentaire : `72f92e2c` a publié les deux
fiches et le contrat d’écoulement mesurable. La réconciliation conserve ce travail,
son ordre E0/E1 et son journal 015 ; elle garde un seul nom canonique pour le pilote,
`PILOTE-HABITACLE-COMMUN-2026-11-20.md`. Elle ajoute l’index des quatre demandes,
les consignes et FILE-TRAVAIL, les sources de code de l’eau et le reçu de consolidation.
Le garde de publication sur SHA attendu a détecté cette avance ; aucun push forcé.


Main distant relu : `9f2246df61c6503ea8fa0f71a28813b15b17f51c`, arbre `4e9d600e`,
identique au local. Les 16 parents ordonnés sont vérifiés : main précédent et les
15 têtes historiques. Les 50 références/SHA avant publication étaient exactement
ceux du manifeste ; les 34 autres secondaires étaient déjà contenues. PR #37 marquée
closed/merged avec ce commit. Les anciennes branches restent des références d’archive ;
main est la branche de travail. Les prototypes ne sont pas activés par cette fusion.

Après ce push, ajout de `PLAN-CORRECTIFS-VISUELS-2026-11-20.md` et des deux fiches
complètes habitacle/pilote et eau/vitesse. Quatre demandes enregistrées : même cockpit
entre vues, pilote plus bas/enfoncé, bras hors buste, gouttes écartées par la vitesse.
Lecture confirmée : coque/échelles propres aux vues et test d’équivalence après
transformation ; absence de contrôle bras/buste ; transport des dépôts sans vecteur
caméra, descente renforcée par la vitesse et tests anciens imposant encore cette descente.
L’attribution visuelle précise et les mesures restent à faire ; aucune correction
runtime annoncée. MotionBricks et CMU sont documentés, sans importer de modèle/clip.

Le point courant reprend E0/E1 pour l’eau, selon la première publication des fiches ;
H0/B0 habitacle reste ouvert avec assise commune, silhouette/IK/gestes et qualification. FILE-TRAVAIL garde les autres travaux et les
17 destinations. Les preuves 159/159, 113 images, quatre échecs 0.2.65 et deux images
aériennes refusées conservent leur attribution. Plan/documentation seulement après
la consolidation : aucun build, test ou rendu supplémentaire n’est nécessaire ici.

Note de reprise Git : la publication utilise les objets GitHub avec arbre local
strictement égal et déplacement de main sans force sous SHA attendu. L’ancien dépôt
local reconstruit possède des trous d’objets historiques : deux fetchs ont échoué
(deltas puis ancien parent absent). Les objets du main distant ont néanmoins été
reçus ; leur commit, arbre et 16 parents ont été contrôlés avant d’aligner la référence
locale et main sans changer les fichiers. Ne pas confondre ce défaut de récupération
locale avec un échec du push ou des validations du jeu.

Le checkout local est borné en shallow au commit de consolidation 9f2246df pour représenter les objets historiques absents ; les 16 parents du vrai commit distant restent intacts. Les arbres et blobs reçus du commit documentaire concurrent sont vérifiés par leurs SHA avant réconciliation.

## 017 — candidat eau 0.2.67 retrouvé et sauvegardé

Reprise du calcul annoncé par David : candidat non commité basé sur 72f92e2,
17 fichiers récupérés à empreintes stables sur le main documentaire 092a00b.
Deux builds 0.2.67 identiques : 14 382 450 octets, SHA-256
4a10ce1b93c15214ab72de9416801d47d545074291fd5788bee2b9f04c8341d7.
Les sources de trajectoire sont exactes : 56 scénarios/112 contrôles conformes ;
à 300 km/h, haut-gauche après 1 s = -206,106 px/-84,073 px ; arrêt = +24,8 px
vers le bas. Quatre quadrants sortis, zéro séchage dans ces cas isolés.
Le reçu initial porte encore VERSION 0.2.66 : preuve de sources, pas du build 0.2.67.

Dix suites ciblées passent, dernier test optique 23 contrôles (résumé ancien à22).
Raster initial : 35 cas/70 PNG, huit intervalles conformes, huit insuffisants de
nappes ; le verdict initial EGL n'incluait pas cette analyse. GLSL inchangé déclaré
après un bornage JS des dimensions. Coût llvmpipe 19,66 ms contre16,10 : réserve
logicielle conservée. Capture du vrai jeu local bloquée par Chromium, zéro image.

La revue corrige le repli cinématique hors PhysX et raccorde un verdict directionnel
fiable avant reconstruction/qualification. Ce checkpoint préserve l'original ; les
éditions de reprise restent séparées. Prochaines preuves : campagne complète et
captures du candidat final exact. Le pilote/habitacle n'est pas modifié ici.

## 018 — repli de vitesse physique et build final 0.2.68

Le checkpoint 0.2.67 est publié dans la PR39 (`a8a2369`, arbre938b6d10), avec
validation partielle explicite. Main reste092a00b/0.2.66. La revue du repli hors
PhysX a révélé une vitesse verticale artificielle issue du tangage visuel. Le
correctif dérive le mouvement des deux poses physiques au pas fixe ; les retours
en piste les égalisent déjà. Les contextes sans historique gardent seulement une
vitesse horizontale signée. Dix-huit contrôles passent : route plate, pente20%,
recul, dérive, changements de regard/cadence et véritable replacement. Le premier
échec et une erreur de fixture sont conservés dans le reçu de correction.

Deux builds identiques0.2.68 :14383155octets, SHA256
`60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`.
Aucune modification FERRO ni physique p15. Le calcul CPU des trajectoires reste
exactement celui des112contrôles précédents. Le suivi des nappes est désormais
mesuré dans les pixels ; l’extension aux fines/moyennes a détecté un faux positif
de l’appariement prédit sur PNG identique. L’identité des perles doit donc venir
des voisinages observés et les négatifs doivent rester bloquants. Cette entrée
précède le verdict natif final et la campagne CI : ne pas les supposer réussis.

## 019 — verdict des pixels indépendant ; campagne finale prête

La 0.2.68 est poussée en checkpoint `da4ac263`, arbre `440eec59`, sans déclencher
une campagne intermédiaire. Le suivi des fines/moyennes compare les voisinages
géométriques observés ; celui des grandes perles/nappes compare les motifs alpha
avec unicité, corrélation et retour mutuel. Aucun transport annoncé ne choisit
l’identité. L’ancienne méthode produisait un faux positif sur PNG identique ;
ce cas est désormais bloquant. Les seuils de suffisance restent 12 mesures par
intervalle, deux par quadrant et 90 % conformes dans chacun.

La réanalyse des mêmes PNG natifs exacts donne 24/24 intervalles conformes et
2 076 mesures hors centre. Les huit tests dédiés passent. Sur de vrais PNG,
huit intervalles répétés, huit avec opacité seule et huit inversés sont refusés ;
la suppression des métadonnées de transport laisse huit résultats inchangés.
Les rasters initiaux et leurs verdicts insuffisants ne sont pas réécrits.

Le workflow ajoute séparément ces tests Python aux 160 suites Node. La prochaine
publication sans skip-ci lance la campagne générale et les 20 groupes d’images
de la PR39. Le HTML garde exactement le SHA60184ddf de l’entrée018. Cette preuve
native sur mire ne remplace pas les images du jeu ni les essais de performance
matérielle ; le surcoût logiciel initial reste une réserve explicite.


## 020 — tests complets conformes et compléments portrait/duo

Le candidat PR39 `3daefb7c` est qualifié par la CI générale `44761148529` :
160/160 suites Node et 8/8 tests Python. Le commit de fusion testé `4343db0e`
porte exactement l’arbre `b84d8553` du candidat ; reconstruction propre, HTML
0.2.68 SHA256 `60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`.

Les 48 PNG de démo sont inspectés, leurs 16 rapports conformes, et les 7 archives
vérifiées. L’avant est explicitement 0.2.62. Les réserves pilote/habitacle et
bandeaux proches de tête/doigts restent ouvertes. Le complément E3 publié
`073b70dd` ajoute seulement outils/tests/workflow : portraits cockpit et poursuite
à 300 km/h, duo cockpit/poursuite indépendant. Run 44762219230 réussi, neuf PNG
inspectés, trois rapports conformes ; HTML strictement identique.

Les reçus portables des trajectoires natives, des négatifs et de leur revue
indépendante sont conservés avec les preuves CI et de composition. Ils ne
qualifient pas les FPS matériels et ne réécrivent pas les verdicts initiaux.
La campagne météo/couverts poursuit ses derniers groupes. Le premier
`cimes-rocher` échoue avant le chargement du jeu (port DevTools absent, zéro PNG) ;
une reprise ciblée attend la fin de la campagne, GitHub refusant la reprise d’un
job tant que son run est actif. Main demeure 0.2.66 jusqu’à cette clôture.

H1+B2 est préparé séparément : pièces de l’habitacle métriques et communes,
cavité ouverte à fond conservé, planche abaissée 65 mm. L’assise, le thorax, les
trajectoires des bras et la caméra réelle ne sont pas encore acceptés ; aucun
build habitacle ni changement de physique p15/FERRO n’est publié comme terminé.


## 020 bis — clôture publiée sur main398959e

Cette clôture complémentaire est conservée de la publication parallèle ; les neuf images E3 supplémentaires sont comptées dans021.

PR #39 fusionnée sur main : `4a04c090535f0c11d3db9900284c31e244a0c79c`.
Tête qualifiée `3daefb7c9d7decaf77beb94219abcf16d907bb38`, arbre
`b84d8553d1a53de3258a56e2036b8b16669723f5`, identique au commit CI `4343db0e`
et au commit de fusion. HTML 0.2.68 : 14 383 155 octets, SHA256
`60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`.
Deux constructions locales identiques ; reconstructions CI concordantes.

Campagne 44761148529, job 136373697930, artefact 14642116718 : 160/160 suites
Node et 8/8 tests Python. Digest ZIP 21c001b5 vérifié  ; 3 485 fichiers d’archive
contrôlés en contenu et mode, HTML exact et tous les journaux présents.
Le suivi natif indépendant reste à 24/24 intervalles et 2 076 mesures sur les
mêmes 47 rasters ; l’ancien verdict insuffisant n’est pas réécrit.

Démos 44761148653 :7/7 groupes,48 PNG inspectés. Météo 44761148719 :7/7,41 PNG.
Couverts 44761148534 :6/6 après reprise,24 PNG. Total113 :89 candidat 0.2.68 et
24 références historiques 0.2.62. Pause figée, J1/J2, air/sec, sillage renouvelé
à 300 km/h et résidus sous abri concordent avec les rapports et les images.
Les 21 checks GitHub finaux sont tous réussis sur la tête `3daefb7`.

Premier Cimes-rocher : job 136373698503, artefact 14641565877, port DevTools
absent avant navigation ; 0 image et aucun runtime exercé. Le workflow parent
devait finir avant reprise. L’état effectif de tentative 2 a été vérifié même
si la commande a renvoyé « already running » : seul Cimes-rocher s’exécutait,
job 136389895636, artefact 14646073492. Cinq PNG réussis ajoutés aux 19 précédents.
Les 92 empreintes de l’essai 1 restent inchangées ; aucun seuil/code modifié pour
cette reprise. Les délais de lecture API sont consignés séparément des résultats.

Les reçus complets, inventaires et limites sont dans
`rapports/EAU-VITESSE-2026-11-20/`, point d’entrée `PUBLICATION-0268.json`.
Les quatre échecs 0.2.65, les anciennes images aériennes refusées et les analyses
PNG rejetées sont conservés. Surcoût logiciel initial, FPS matériels non mesurés,
pluie extérieure depuis abri, bandeaux, neige et alertes miroir historiques restent
explicites. La publication qui suit cette fusion ne change que preuves/reprise ;
elle ne modifie ni source, ni outil, ni HTML déjà qualifiés.

Prochaine étape préparée : **H0/B0 habitacle/pilote communs**. Mesurer géométrie
monde, assise/bassin/yeux et pénétrations bras/buste, conserver les poses fautives,
puis H1. Les trois demandes du pilote restent ouvertes ; autres travaux et
17 destinations préservés. Lire REPRISE, etat_courant et la seule fiche active.

## 021 — eau0.2.68 fusionnée ; saisons et menu ajoutés

Les dernières images exactes sont inspectées : démo48, météo41, couverts24 et
portrait/duo9, soit122 PNG (98 candidat et24 références0.2.62),45 rapports
conformes plus contraste humide/sec. Le premier démarrage cimes-rocher avait
échoué avant le jeu ; le seul job repris réussit, même arbre et même HTML.
PR39 est fusionnée en4a04c090535f0c11d3db9900284c31e244a0c79c ; son arbre
b84d8553 est relu et identique au candidat/commit CI4343db0. Les160 suites Node
et8 tests Python restent clos. Le coût logiciel et les échecs antérieurs sont
conservés. Les outils E3 déjà vérifiés et reçus portables sont consolidés ensuite,
sans modifier le HTML.

L’habitacle métrique/assise/yeux réels, cuve, thorax fermé, siège et outils de
qualification sont sauvegardés comme préparation réapplicable. Les défauts
restants des contacts extrêmes et de continuité du coude ne sont pas déclarés
corrigés par ce checkpoint ; aucun build habitacle ne lui est attribué.

Deux demandes ajoutées pendant le travail : saisons appliquées aux neuf circuits
(couleurs/feuilles/terrain, notamment Cimes), puis menu arcade multi-écrans avec
tracé3D rotatif et navigation manette, plus optimisation Xbox/Edge et GPU intégrés
Intel. Les fiches et la file conservent les trois chantiers sans abandonner les
précédents. Aucun résultat de performance sur ces appareils n’est inventé.

## 022 — priorité moteur, arcade, saisons et emotes

Demandes ajoutées : optimiser les coûts du moteur sur Xbox Edge et petits PC/GPU Intel, avec mesures comparables et profils cohérents ; menu arcade en plusieurs écrans, tracé réel en 3D rotatif et navigation manette ; appliquer les saisons sur les neuf circuits. Chaque joueur choisit avant course son geste et son klaxon (classique, ancien, mariage). Les IA choisissent les deux au hasard, notamment lorsqu’elles dépassent le joueur, avec délai entre réactions. Les tâches préparées du pilote restent conservées et à qualifier.

Réconciliation de main398959e : tous ses reçus complets sont conservés. Le complément E3 porte le total à122 PNG du jeu (98 candidat,24 référence), HTML0.2.68 inchangé. Aucune nouvelle performance matérielle n’est supposée.

## 023 — toutes les demandes récentes conservées ; Troll unique

L’utilisateur demande explicitement de pousser toutes ses dernières demandes sur Git, puis de continuer. La fiche DEMANDES-ARCADE-PERFORMANCE-TROLL-2026-11-20 rassemble saisons, menu arcade, navigation manette, petites configurations, optimisation intrinsèque du moteur et emotes. Précision finale : le même bouton Troll joue simultanément le klaxon choisi et le geste choisi par chaque joueur ; les IA tirent les deux au hasard, notamment après dépassement. Les états en préparation restent distincts des corrections qualifiées. Main2815b16 conserve déjà les preuves eau E3 et les préparations ; cette entrée complète le contrat sans modifier le build0.2.68.

## 024 — mémoire, géométrie, matières, rendu fovéal et visibilité

L’utilisateur demande une analyse technique actionnable et des améliorations : préchargement en RAM/GPU, streaming/pooling/gestion mémoire, réduction des triangles, shaders et alternatives géométriques, qualité des montagnes/terrain/matières proches/cockpit. Il ajoute un rendu « fovéal » suivant vitesse/vue et priorité de course, puis « genre ray tracing » pour privilégier ce qui est visible, et demande de pousser toutes ces demandes dans le suivi. La fiche OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES-2026-11-20 distingue visibilité/occlusion du ray tracing d’éclairage et conserve les critères de performance, de continuité et de moteur canonique. Les travaux sont préparés ou ouverts ; aucune performance matérielle ni nouvelle matière n’est déclarée validée.

## 025 — répartition en discussions parallèles et prompts de reprise

L'utilisateur demande de préparer le travail par petits lots et de fournir les prompts de nouvelles discussions, pour économiser le contexte. La base distante d8f02ca et son arbre 859b95aa ont été relus. Runtime 0.2.68/p15/FERRO 0.3.15, neuf circuits, conservé sans changement.

Le dossier PARALLELE-2026-11-20 définit quatre discussions de réalisation (01 pilote puis Troll, 02 performance/mémoire/FERRO/visibilité/importance visuelle, 03 menu arcade/manette, 04 saisons puis matières), une coordination 00 des fichiers partagés et une préparation 05 des sources de circuits. Chaque rôle a un prompt, une branche proposée, un état propre, des sous-lots, dépendances et contrôles. Les sources/builds et le suivi global ne sont plus écrits simultanément par plusieurs discussions. Les autres demandes de la file sont conservées.

Les préparations locales habitacle, arcade, saisons et audio ont été inventoriées avec SHA et périmètres ; le worktree Troll recopie le candidat habitacle. Les nouveaux patches capturés localement n'ont pas pu être transférés avant indisponibilité de l'environnement : ils ne sont pas fournis et ne sont pas déclarés publiés. Le checkpoint habitacle déjà présent sur main reste accessible. Les missions commencent par rechercher les travaux plus récents avant toute réécriture.

Publication documentaire uniquement : aucun code du jeu ou de FERRO modifié, aucune nouvelle performance matérielle annoncée, aucun déploiement. L'ancienne règle « un seul sous-lot » devient « un sous-lot par discussion » avec intégrations sérialisées, conformément à cette nouvelle demande.

## 026 — quatre préparations récupérées et rendues portables

Le dossier de répartition et ses prompts ont été publiés puis relus sur main5ed310787cd4e184869c8ac4a54783ddaf55e553 (21 fichiers identiques aux contenus préparés). L'environnement de travail est ensuite redevenu disponible. Les quatre captures locales habitacle, arcade, saisons et audio Troll ont été récupérées ; les empreintes correspondent à l'inventaire. Chacune passe git apply --cached --check sur l'arbre de base859b95aa, sans appliquer de changement au runtime.

Les patches sont conservés dans PARALLELE-2026-11-20/preparations avec un manifeste de provenance et un mode de reprise. Le nouveau menu-arcade.js auparavant non suivi est inclus ; l'audio Troll est séparé du lot saisons ; le diff du worktree Troll, identique à l'habitacle, n'est pas dupliqué. Dist, VERSION/SIZE, images et anciens rapports ne sont pas recopiés.

Ces contrôles attestent la conservation et l'applicabilité individuelle des préparations. Ils ne qualifient ni leur assemblage, ni leurs performances, ni les nouveaux comportements du jeu. Les raccords jeu.js/construire.py restent au coordinateur00. La livraison0.2.68, p15 et FERRO0.3.15 restent inchangés.


## 027 — coordination 00 : inventaire, contrats et premier lot documentaire 02

Mission reprise sur main `1c71bb341d20df4328e5178497503ee4ad26a131`, arbre
`409499e1631489b667f34bf83e37682cd18657ae`, dans un checkout isolé. Premier relevé :
52 têtes distantes déjà contenues dans main, aucune PR ouverte. Relecture avant
publication : 55 branches ; checkpoints 01 `007970e`, 02 `0e42588`, 03 `1d09794`.
01 et 03 annoncent encore leur qualification en cours ; P1 moteur n'est pas
qualifié. 04/05 sans branche au relevé. Aucune conclusion sur leurs travaux locaux.

Le P0 de 02 est un petit lot documentaire indépendant : état, raccord et inventaire
repris exactement du commit `0e42588fa03a10cf12444af81193dbc7458e601e`, avec leurs
blobs GitHub vérifiés. Son commit source est conservé comme parent du candidat
00. Ses mesures historiques de rétroviseurs ne sont pas des gains sur main ; la
préparation habitacle les contient déjà. Aucun import FERRO ni code de 01/03.

Les contrats révision 1 fixent les choix Troll par joueur, l'événement de début
réel consommé une fois avant J2/J1, les limites audio et l'exception étroite du
klaxon mariage ; le menu arcade, son vrai tracé, l'arrêt caché et le départ ; les
caches saisonniers, les budgets par vue et l'import d'un SHA FERRO qualifié.
Le patch arcade seul cache le départ sans raccord jeu.js : il reste préparatoire.
Livraisons attendues et SHA dans l'inventaire, aucun comportement déclaré intégré.

Vérification légère : HTML 0.2.68, 14 383 155 octets et SHA256 `60184ddf…` conservés,
34 modules FERRO et quatre empreintes de patches conformes. Sources/builds,
anciens reçus et états 01/03/04/05 préservés ; état 02 importé sans réécriture.
Les alias courants sont réconciliés avec le reçu canonique 0.2.68 : neuf circuits
et 122 images. Les anciens alias 0.2.66 et la réserve pré-E0–E3 sont conservés
comme historiques. Campagnes closes non relancées, aucun déploiement du site.

Prochaine action : relire main/branches/PR et intégrer le premier petit lot
runtime prêt, sur son SHA et ses preuves, sans attendre la fin des autres chantiers.
Le présent jalon publie inventaire, contrats, suivi 00 et P0 documentaire de 02.


## 028 — publication vérifiée de la coordination 00 et du P0 de 02

Le jalon documentaire est publié sur main au commit
`a8a6435c529fe326e9f26124f25ba0911d3b70fb`, arbre
`d2a766837812905aa9ab421fd77d80c7625d25f2`, identique au candidat local vérifié.
Les deux parents sont la base main `1c71bb3` et le P0 de 02 `0e42588` ; son auteur
et son historique sont conservés. Avance conditionnelle sans force, puis tête
main relue et ascendance du P0 confirmée. Les autres branches restent intactes.

Treize fichiers documentaires : contrats 00, inventaire daté, suivi et trois
fichiers P0 exacts. Contrôles de structure/liens, empreintes, périmètre et arbre
conformes. Runtime 0.2.68/p15/FERRO 0.3.15 inchangé, preuves historiques conservées,
aucun nouveau build ni campagne complète, aucun déploiement.

Le reçu `PARALLELE-2026-11-20/rapports/00-PUBLICATION-20261120.json` et l'état 00
actualisent cette publication. Les checkpoints 01/03 et le moteur P1 restent à
qualifier ; les livraisons attendues par rôle sont consignées. Reprendre par une
lecture des têtes/états, sans attente en boucle ni réapplication des préparations.

## 029 — réception des sources 05 et préparation de l'assemblage

Les trois jalons de sources Monaco/Marseille sont reçus depuis fa29088. La CI44783388788 est réussie sur le code d638652 ; seules trois clôtures documentaires suivent. Les trois suites sources ont été rejouées dans l'assemblage sans modifier le runtime0.2.68/p15/FERRO0.3.15. Les inconnues et les statuts non jouables sont conservés.

Les PR41 (pilote/Troll) et40 (menu) sont maintenant recevables pour raccordement par00. Le jalon saisonsS1 6cbfa7e est retenu, hors M1 pierres en cours. Les tests de raccord des branches vérifient leurs bases temporaires, pas encore le futur jeu.js assemblé ; ils seront adaptés au fichier réellement intégré avant qualification. Aucun nouveau moteur FERRO qualifié : ne pas importer P1.

## 030 — candidat commun0.2.69 construit

Les sources PR41 pilote/Troll, PR40 menu et le seul jalon saisonsS1 6cbfa7e sont assemblées. Les raccords s'appliquent au vrai jeu.js ; les nouvelles vérifications lisent ce fichier intégré. Les choix Troll J1/J2 sont figés à la séance ; les préférences en ligne sont négociées dans le protocole existant. Le transport des événements distants reste absent et explicitement indiqué.

Un défaut audio a été reproduit puis corrigé : les préécoutes encore actives occupaient les cinq voix au départ. La reprise depuis pause les purge ; les reprises répétées en course ne coupent pas les emotes. Les quatre suites ciblées réussissent (19 intégration,26 audio,39 manette,47 commandes partagées). Les suites de raccord/prêts et les contrôles caméra sont aussi conservés.

La construction0.2.69 est identique deux fois, verrou FERRO conforme. Les tentatives de captures locales échouent avant démarrage du jeu à cause du refus système de socket Chromium ; aucune image locale n'est acceptée. Le workflow d'assemblage cible le commit/HTML exact et garde l'inspection visuelle ouverte. Aucun nouveau gain moteur, mesure matérielle ou déploiement n'est annoncé.
## 031 — candidat 0.2.69 publié sur branche, qualification commune en cours

L'arbre complet `dfd28246470fc8a1d58c800dace8409fc24d1c74` du candidat local
`11dd51e` a été récupéré sur GitHub. Le commit local lui-même n'avait pas été
publié. Les sources, les raccords et les fichiers de build ont été conservés ;
les preuves/outils T3 de `224bae1` et l'exécution sur l'HTML réel dans la CI générale
complètent le candidat. Publication sur la branche `codex/bitume-0269-publication-20261120` :
`7999de565e2c643f7723462caf7683b570c75e8b`,
arbre `31059af44e77aac5b733c9e4b29e9b9efe25ee57`,
base main `fee69c521eccc0e64cc29f762a6d2244b5ade759`,
[PR #42](https://github.com/M4D135/bitume/pull/42).

L'HTML reste exactement celui de T3 : **0.2.69 / p15 / FERRO 0.3.15 / neuf circuits**,
14 472 625 octets, SHA256
`bd1e5c2eeb45638dac825c9c49f5ae52f6136cbb1785f4bca76adce771d86a10`.
Les quatre sources saisons sont identiques au jalon S1 `6cbfa7e` ; les pierres
M1 sont exclues. Le verrou et ses 34 modules sont identiques à main.
Les autres lots, les sources 05 déjà reçues et les états propriétaires restent conservés.

[T3 44795943660](https://github.com/M4D135/bitume/actions/runs/44795943660) est clos
sur cet HTML : 5 080 poses et 26 PNG inspectés. Le reçu est repris sans relancer
la campagne. Les contrôles ciblés prêts en ligne 63/63 et intégration 19/19
passent ; les deux contrôles caméra figurent dans ces 19 et ne s'ajoutent pas au total.
Les contrats reflètent les cinq voix fixes et la correction audio déjà assemblée.

Au relevé du 20 novembre à 19:20:31 UTC, la
[CI générale 44801006792](https://github.com/M4D135/bitume/actions/runs/44801006792)
est en cours et les
[images assemblées 44801007532](https://github.com/M4D135/bitume/actions/runs/44801007532)
sont en file d'attente, sur ce même commit. Restent la fin des contrôles,
l'inspection des parcours/images, puis la fusion et la vérification de la réception
sur main. Les anciennes campagnes closes ne sont pas relancées.

**Main livré reste 0.2.68.** Ce jalon publie un candidat sur branche, pas un runtime
qualifié sur main. Les événements Troll distants ne sont pas synchronisés ; les
limites d'écoute audio, de manettes physiques, de réseau réel et de performances
matérielles sont conservées. Aucun déploiement du site.

Complément d'inspection de 031 : à 960×540 et 540×960, depuis la caméra réelle
du siège, le volant occulte une partie centrale de la chaussée. L'audit
géométrique situe l'œil à 0,790 m et le haut de jante à 0,813807 m. Les tests
dits « route visible » contrôlent la projection de l'horizon et n'évaluent pas
l'occultation. Aucune nouvelle régression d'assemblage n'est établie ; géométrie
commune et T3 restent acquis. Le suivi de lisibilité cockpit reste ouvert,
sans certification d'une chaussée dégagée ni nouveau blocage des entrées Troll.

Les quatre PNG LOD extérieurs présentent une coque d'environ 25–30 pixels :
silhouette validée, détails des bras non lisibles. Les reçus d'inspection
précisent cette portée ; ces vues ne certifient pas les contacts fins des bras.


## 032 — Réception des images assemblées et réconciliation des bancs

La campagne `44801007532` réussit ses huit groupes : **49 PNG originaux inspectés**,
dont 14 images et 19 parcours du menu. Réserve cockpit conservée ; vues LOD
lointaines limitées à la silhouette. L'HTML reste `bd1e5c2e…`, identique à T3.

La CI générale initiale `44801006792` donne 169 suites réussies et sept échecs.
Les bancs anciens ne chargeaient pas toutes les dépendances menu/Troll ; une
attente météo concernait encore la vitrine cachée, et les références géométriques
précédaient le pilote commun. Le correctif `7a8a53e` est poussé sur PR42 : huit
fichiers de tests/fixture, 90 contrôles ciblés réussis, aucune modification du
runtime/build/verrou. Comparaison stricte de 134 groupes dans deux configurations,
tolérance 1e-9 et entrelacements conservés. Les roues gardent formes et cotes.

Les diagnostics initiaux, dont un démarrage Chromium sans port DevTools dans
la campagne démos/volant, sont conservés avec les reçus et images.
CI générales du correctif : `44803588903` (push), `44803603591` (PR).
La fusion attend leur résultat ; main livré reste 0.2.68.


## 033 — Publication 0.2.69 sur main, réserves conservées

La PR 42 est fusionnée normalement le 20 novembre à 19:52:30 UTC :
`89aa13299221ebc8b5f0474ae5a662680dd6fe32`, arbre `18b147cb15a5900a1257686b211ddb7c9769b29d`.
La tête et VERSION.json ont été relues après fusion. L’arbre reçu est identique
au candidat `7a8a53e` et au merge technique `40e8c621` testé par la CI PR. Les PR
40 et 41 sont fusionnées par ascendance ; leurs branches sont conservées.

CI PR 44803603591 réussie : **176 suites Node, 8 tests Python**. L’archive ZIP
contient 80 816 454 octets, SHA256 `72627b9e…` ; comparaison indépendante des
**3 777 fichiers et modes** (138 871 550 octets) sans écart. HTML 0.2.69 :
**14 472 625 octets**, SHA256 `bd1e5c2e…` ; p15, FERRO 0.3.15 et neuf circuits.
49 PNG assemblés inspectés et 26 PNG T3 réutilisés.

Le push parallèle 44803588903 finit à 19:53:04 UTC avec **175 suites réussies**
et **un échec de budget décor** : Val-Brûlé, **172 ms affichés**, seuil strict
**< 150 ms**. Python n’a pas été exécuté dans ce run après l’échec Node.
La même suite passe dans la PR sur l’arbre identique ; sa durée exacte n’est
pas enregistrée. Cause de l’écart non déterminée : aucun seuil changé, aucune
relance pour obtenir un résultat vert. Ce résultat tardif est conservé dans le
reçu de publication et dans le suivi actif.

La visibilité centrale en cockpit et le budget de construction du décor restent
ouverts. Les limites LOD, réseau, audio, manettes et FPS matériels sont explicites.
Les documents de clôture conservent ces réserves sans changer le runtime publié.
Aucun déploiement du site.

Reçu : `docs/reprise/PARALLELE-2026-11-20/rapports/00-PUBLICATION-0269.json`.

## 034 — Réception 0.2.70, défaut HUD et préparation 0.2.71

La CI complète `44818836125` réussit sur `3d9825d4` : 179 suites JavaScript,
huit tests Python. L’archive des 3 852 fichiers reconstruit exactement l’arbre
`5ca64577b6044672a61feda146c405e18e6294c6` ; HTML 0.2.70 inchangé, SHA256
`b0f1b5d9…`, 14 502 704 octets. Les quatre bancs réparés importent leurs vrais
modules sans alléger les assertions. Les alertes décor 172/152 ms sont conservées.

Les PNG cockpit montrent un défaut distinct de la géométrie : classement sur
glace gauche, carte sur glace droite et annonce sur route centrale en duo haut/bas.
Le grand format Mac est incomplet après la référence, arrêté par la limite globale
de 18 minutes. La poursuite Troll s’arrête à 11/13 PNG. Les cinq instants d’impact
sont reçus et inspectés ; la campagne météo historique reste privée du cas `legere`.
Les autres images disponibles sont consignées individuellement dans les reçus.

La fusion de PR44 reste bloquée. Le correctif HUD suivant conserve les yeux,
le siège, le modèle commun, les roues, p15 et FERRO. La carte reste en haut et
garde ses préférences. Le banc contrôle désormais les masques visibles du HUD
contre les vraies glaces, commandes et points de chaussée, sans changer ses seuils.
Deux cas compacts avec rival à 18 m complètent les neuf scènes candidat ; la
référence a son propre job. Les pas Troll sont séparés entre commandes DevTools,
en conservant instants, événements, borne et délai. Nouvelles preuves à recevoir
après construction 0.2.71 ; aucun déploiement du site ni intégration de PR 43.

Construction du correctif : 0.2.71, 14 507 449 octets, SHA256 `0e4cdb72…`,
deux reconstructions identiques et 60 contrôles ciblés réussis. La référence
négative exige désormais un recouvrement HUD/glace réel aux deux poses ; les
données manquantes font échouer candidat et référence. Branche de validation
prévue : `codex/bitume-0271-hud-20261120`. Les PNG de ce nouvel HTML restent attendus.

## 035 — Gardes de présence, deux masques compacts et candidat 0.2.72

La réception 0.2.71 confirme la CI push verte (179 suites Node, huit tests Python,
3 901 fichiers/modes conformes), mais deux chevauchements réels en 960 × 540 :
classement sur gant gauche en braquage et régime complet sur main droite au
neutre. Dix PNG inspectés attestent carte haute et annonce à vitesse élevée.
Le profil n’a aucune image après expiration DevTools ; autres jobs encore en
cours au reçu intermédiaire. PR47 reste bloquée par les images, sans relance
pour effacer les échecs.

Le garde ee3bb57 est repris. La correction CSS suivante limite le classement
avec la hauteur locale et réserve une colonne aux compteurs complets. L’annonce
garde sa largeur ; le mode réduit est protégé en solo et par joueur en duo.
Les témoins des compteurs sélectionnés sont également requis par l’oracle.
25 contrôles de capture, 13 HUD et 11 options passent ; les 34 copies FERRO
sont conformes. Deux builds 0.2.72 identiques : 14 509 186 octets, SHA256
391db2defe23308f88500fdd138d3b8573596d1ca0f53e058ef5c66c0c510a90.
La nouvelle CI et les images exactes restent requises avant fusion.
PR 43, réserves de performance et six demandes vidéo/survol conservées.

Réserve tardive 0.2.71 : la CI PR `44825452386` termine à **178/179** suites,
Val-Brûlé **168 ms** pour un seuil strict de **150 ms**. Son archive de
3 901 fichiers/modes est identique à la CI push verte ; les huit tests Python
sont sautés en PR après cet échec. Résultat conservé, sans changer le seuil.

## 036 — Candidat 0.2.73, petit duo et annonces désactivées par défaut

Le reçu 0.2.72 conserve les deux archives CI identiques (PR 179/179, push
178/179 avec Val-Brûlé 155 ms/150) et les masques constatés chez J1/J2.
Le CSS réduit les espaces et marges du petit partage haut/bas, élargit les noms
sans réduire les textes. Le défaut des annonces passe à Non dans le runtime
et l'interface ; les trois préférences déjà enregistrées restent conservées.
Deux reconstructions identiques et verrou FERRO conforme. L'outil active
explicitement les annonces pour les captures ; aucune disparition ne peut
valider leur placement. Le virage stabilisé précédent est incomplet, non reçu
comme preuve. CI et PNG 0.2.73 sont requis avant fusion ; PR 43 et réserves
historiques restent séparées. Aucun déploiement du site.

## 037 — Réception 0.2.73 et candidat 0.2.74 en braquages stabilisés

Le petit duo corrigé garde les noms lisibles et dégage annonces, compteurs et
glaces. Les deux CI complètes .73 réussissent (179 suites Node et huit tests
Python chacune) ; leurs 3 927 fichiers et modes correspondent exactement à
l'arbre f0ce14c0. Les 43 PNG pluie/Troll ont été reçus et inspectés.

Le complément stabilisé est cette fois complet : 120 pas pour chaque pose,
deux PNG, mais le gant droit est recouvert à −0,35 par le régime (1 366,34 px²)
et deux lignes du classement (704,56 px²). La PR 49 reste bloquée et son échec
est conservé. Le profil .73 a expiré dans Page.captureScreenshot avant tout PNG ;
ce n'est pas une preuve de défaut géométrique. La preuve profil .72 utilise le
même modèle et les mêmes modules FERRO.

Le CSS .74 conserve polices et largeurs, retire les espacements verticaux du
classement et remonte son bas de 42 px tout en gardant le haut de l'annonce.
La seule barre de régime est bornée à 12 cqh. Portée : cockpit non tactile,
ratio de 6/5 à 2 et hauteur locale de 400 à 600 px. Les autres formats conservent
leur disposition. Les vrais triangles et caméras reproduisent l'échec .73 ; le
calcul des nouveaux rectangles donne zéro recouvrement sur six poses, sans
remplacer la réception navigateur attendue. Un miroir stabilisé +0,35 est ajouté.

0.2.74 construite deux fois à l'identique, 60 contrôles ciblés réussis et 34 copies
FERRO conformes. CI exacte et dix nouveaux PNG requis avant fusion. Aucun seuil
ni pas de simulation retiré, défaut Non et choix mémorisés conservés. Réserves
décor historiques inchangées ; aucun déploiement du site.

## 038 — 21 novembre : badge FPS, candidat 0.2.75

Les deux CI de la 0.2.74 passent 179 suites Node et huit tests Python ; les deux
archives de 3 935 fichiers/modes sont exactes. Huit PNG inspectés : petit duo et
compacts conformes, mais badge FPS sur gant gauche à +0,35 (75,6178301613 px²,
seuil 1). Le cas gauche échoue avant rendu au démarrage de Chrome ; incident
conservé. PR 50 reste bloquée ; aucune relance pour effacer un défaut visuel.

0.2.75 : seul le placement vertical du badge change dans le bloc cockpit paysage
400–600 px, ratio 6/5–2. Il reste sous le classement, visible et à taille inchangée.
La garde de présence FPS refuse disparition, taille nulle, sortie et duplication
aux deux instants des deux cas stabilisés. Les 120 pas et tous les seuils restent.
61 contrôles ciblés ; deux builds identiques, HTML SHA256
a19ec4e8ee7f5c9c672cf27ac780c14ab3ebec126d2b80939c025e602594e225.
Revue indépendante favorable ; marge préparatoire de 56,002 px aux commandes et
19 px au classement sur huit poses. CI et dix nouveaux PNG requis avant fusion.
Aucun déploiement ; p15, FERRO 0.3.15, PR 43 et travaux parallèles préservés.


## 039 — 21 novembre : publication 0.2.75 et réserve décor ouverte

La PR 51 est fusionnée sur main au commit
`b1e5e98b9029f6254b86dcfb49780883315a9418`. L’arbre reçu
`2d019e71d09ea31be7588cde0f401606cbf934af` est strictement identique au
candidat `5d59cae6630c49ae62c47303100d61dd63daea56`.
Les CI push 44845571993 et PR 44845586813 passent chacune 179 suites Node,
zéro échec et huit tests Python. Deux ZIP reçus et rapprochés : 3 988 fichiers
et modes identiques ; HTML 14 511 184 octets, SHA256
`a19ec4e8ee7f5c9c672cf27ac780c14ab3ebec126d2b80939c025e602594e225`.

Les dix PNG des cinq groupes du run 44845571914 sont reçus et inspectés :
petit duo J1/J2, compacts et deux braquages maintenus −0,35/+0,35 avec 120 pas
par pose. Badge FPS visible et dégagé, annonces présentes aux instants requis,
glaces/commandes/chaussée conformes sur ces cas. Le défaut .74 et les échecs
.70–.73 restent archivés ; aucun seuil ni témoin n’est retiré.
[Publication et preuves](rapports/COCKPIT-PLUIE-2026-11-20/reception-0275/PUBLICATION-0275.json).

Réserve décor toujours ouverte : cinq appels locaux donnent 151,87 / 138,20 /
141,13 / 84,43 / 85,68 ms, dont un échec au seuil strict <150 ms. Les anciennes
mesures 172/152/168/155 ms restent conservées ; aucun gain n’est démontré.
Piste préparée pour 04 : stockage fixe des indices des nappes Route pour éviter
19 323 couples temporaires ; identité géométrique et mesures alternées à qualifier.
Aucun code de cette optimisation appliqué. [Diagnostic](rapports/COCKPIT-PLUIE-2026-11-20/reception-0275/diagnostic-decor/DIAGNOSTIC.json).

Clôture documentaire uniquement : p15, FERRO 0.3.15, neuf circuits, « Planche seule »,
annonces Non au premier lancement et préférences enregistrées préservés.
PR 43, états propriétaires 01–05, M1 et programme restant conservés. Aucun déploiement.


## 040 — 21 novembre : référence 126 CK, galerie complète et étude race

David refuse à nouveau le cockpit montré (.76) et fournit la galerie RenderBlade
comme objectif. La 126 CK devient la cible visuelle, en remplacement de la 312 T5.
Les 40 vues 1920×1920 et la couverture 400×400 sont reçues sans modification,
9 270 341 octets, toutes décodables et identifiées par SHA256.
[Galerie et manifeste](../references/ferrari-126ck-renderblade-2026-11-21/README.md).
Les formes ne sont pas annoncées corrigées ; le jalon publie les références.

La PR 52 (.76, 02afea62…) reste bloquée : volant/tableau refusés, reflets vers le
sol et le pneu, deux CI générales en échec dont la réception précise se poursuit.
Les préparations miroirs, pluie arrière, klaxons et FOV 70° sont conservées hors main.
Aucun build ni changement de p15/FERRO dans cette publication documentaire.

Autre demande : [étude de satyam-fp/race](REFERENCE-RACE-2026-11-21.md) au commit
4a2a65f146aa0e70547c191c77a2490511db44a8. Huit idées précises raccordées aux lots
existants ; sources Rust absentes, shaders embarqués et interfaces JS examinés,
aucun code ou asset repris, aucune performance ni qualité de conduite jouée revendiquée.
PR 43, autres préparations et réserve décor préservés. Aucun déploiement.

Publication documentaire confirmée : PR 53 fusionnée, main `eb10c539749a1d0a978ba3b2a78c128e368db194`,
arbre `b27b05f195cc93c0c1c4ad18d98e63ef5e7cd128`. Les 41 images relues depuis Git
sont identiques aux originaux. Runtime .75 inchangé. PR 52 close sans fusion ; branche
conservée. [Reçu](../references/ferrari-126ck-renderblade-2026-11-21/PUBLICATION.json).

## 041 — 21 novembre : poste .77 pour essai sur main

David demande de pousser main pour tester, puis de poursuivre le projet. Le lot
[poste .77](POSTE-126CK-0277.md) réunit le volant repris depuis sa photo, les cadrans,
les miroirs, le FOV 70°, la météo arrière et les timbres de klaxon préparés. Le contrat
textuel obsolète de pitch est retiré du test Troll ; la couverture réelle de projection
reste. La forme complète 126 CK continue séparément. Qualification du nouveau candidat
et publication à consigner ; les reçus .76 restent historiques et ne le valident pas.
