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
