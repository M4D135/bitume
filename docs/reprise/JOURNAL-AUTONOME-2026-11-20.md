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
