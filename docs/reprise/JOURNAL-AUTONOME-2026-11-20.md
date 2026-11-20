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

## Correctifs de qualification — candidat 0.2.65

CI initiale conservée à151/152 et archive de3366sources vérifiée. Allocation du pilote corrigée sans mouvement ni seuil modifié;864comparaisons exactes. Contrôles aérien/poursuite raccordés au diagnostic public et au contrat caméra;29+48mutations rejetées.58PNG initiaux inspectés avec réserves. Reçu `rapports/DEMOS-PILOTES-METEO-2026-11-20/CANDIDAT-0265.json`. Nouvelle CI/captures nécessaires avant fusion;main reste0.2.62.
