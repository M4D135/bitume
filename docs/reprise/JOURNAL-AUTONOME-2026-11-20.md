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
