# Lot 2 : crashs spectaculaires et pièces PhysX

Statut : **à faire**, après intégration du lot 1. Le style demandé est celui d'accidents de course spectaculaires ; aucune ressource de Burnout ou Destruction Derby n'est à importer.

## Sources utiles

`src/degats.js`, `src/contacts.js`, `src/course.js`, `src/conduite.js`, `src/traces.js`, `src/voiture.js`, `src/obstacles.js` ; lire l'API PhysX de FERRO sans modifier les copies verrouillées.

Observation de la base : `src/traces.js` utilise déjà `FPhysX` pour certains débris, avec des boîtes dynamiques et des sols temporaires ; le repli sans PhysX suit une parabole. Cela ne prouve ni une dynamique complète de la voiture ni une destruction crédible. Vérifier en navigateur que PhysX est chargé et réellement utilisé.

## Travail

Rendre l'impact lisible : impulsion, lacet, bascule ou tonneau selon contact, déformation ou séparation cohérente d'éléments existants. Éviter les cubes décoratifs ajoutés sans rapport avec la monoplace. La pièce séparée ne doit pas rester simultanément intacte sur le véhicule.

Budget cible : quatre à six pièces détachées par voiture, plus un plafond global vérifié avec douze voitures. Réutilisation des objets, extinction/sommeil des corps au repos, libération sûre lors des reprises de course et pertes de contexte. Adapter les contacts au relief et aux murs : la dalle horizontale actuelle ne suffit pas à démontrer le comportement dans toutes les situations.

Garder le retour au contrôle en moins d'une seconde sans téléportation dangereuse ni pic de calcul. Les débris peuvent vivre plus longtemps que la récupération du pilote. Respecter le réglage de secousses et le mouvement réduit ; ne pas imposer un ralenti global qui pénaliserait J2 ou le mode en ligne.

Conserver un état de dégâts persistant exploitable par la jauge et les stands. La récupération d'urgence rend la voiture jouable mais ne remplace pas le service complet. Si la simulation change, versionner records/fantômes et examiner la compatibilité réseau.

## Réseau et tests

Définir l'autorité des impacts et dégâts. Les débris purement visuels peuvent rester locaux ; ne pas synchroniser inutilement chaque fragment. Tester répétition de contact, collisions simultanées, rebonds, sorties de piste et absence de NaN/soft-lock.

Régressions utiles : `crash.test.mjs`, `contacts.test.mjs`, `collisions-orientees.test.mjs`, `traces.test.mjs`, `reprise-recul.test.mjs`, `ia-epaves.test.mjs`, `voiture.test.mjs`. Ajouter un scénario de collisions multiples avec mesure du temps image et des corps actifs. Les tests Node seuls ne qualifient pas PhysX navigateur.

## Livraison

API de dégâts et contrat de récupération documentés pour les lots 3 et 4 ; budget effectivement mesuré ; captures/tests manuels réels ou limites explicites. Ne pas attaquer simultanément la refonte des stands.
