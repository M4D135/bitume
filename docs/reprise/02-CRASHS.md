# Lot 2 : crashs spectaculaires et pièces PhysX

Statut : **terminé le 17 novembre 2026**, commit `2766f01e2b7a8469ce61056b0ddbd2d652b8fe46`, client **0.2.22**.
Rapport brut et journaux : `docs/reprise/rapports/LOT2-2026-11-17.md`. Le style demandé est celui d'accidents de
course spectaculaires ; aucune ressource de Burnout ou Destruction Derby n'est à importer.

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

## Ce qui a été fait (17/11/2026)

- **PhysX réellement utilisé.** `FPhysX.init()` n'était appelé nulle part : les pièces détachées suivaient la parabole
  de repli et les 12 Mo de runtime embarqués ne servaient à rien. Initialisation lancée en tâche de fond au
  démarrage. Le choc réel vérifié dans Chrome crée 6 corps rigides et 5 dalles de sol (`FPhysX 5.12.0, ready`).
- **Budget de pièces.** Douze pièces par casse → **six** (4 roues + 2 panneaux), quota par voiture remis à zéro au
  remplacement, pool de 144 → **96** repris à la pièce la plus proche de sa fin de vie. Vérifié avec douze voitures
  (72 pièces) et par saturation répétée. Un choc violent sans casse perd un panneau, du côté de la normale ; le côté
  du choc est propagé de `contacts.js` jusqu'au choix des panneaux.
- **Corps qui s'éteignent.** Une pièce immobile depuis 0,4 s sort de la simulation et reste dessinée.
- **Sol adapté au relief.** Cinq dalles courtes suivant l'altitude échantillonnée du tracé, au lieu d'une dalle
  horizontale de 80 m qui traversait dévers et pente.
- **Libération sûre.** `B.traces.liberer(fx)` appelé à chaque nouvelle séance (la démo empilait un monde PhysX orphelin
  par course) et sur `webglcontextlost`. Vérifié : le compteur de mondes redescend à 0.
- **Dégâts persistants.** `reparerUrgence` (conduisible, pas neuve) au remplacement ; `reparer` (remise à neuf) réservé
  aux stands du lot 4. Records et fantômes passent à **p9**.
- **Autorité réseau.** Impacts et dégâts calculés par la machine qui conduit la voiture ; le paquet d'état ne
  transporte que la cinématique ; débris, fumée et étincelles restent locaux.

## Reste ouvert après ce lot

- **Spectacle et lisibilité à l'œil non validés** : capture Mac à prendre (mur à 45°, contact latéral à 130 km/h,
  tonneau, débris dans le tunnel). Les chiffres prouvent la mécanique, pas le rendu perçu.
- **Performances non qualifiées** (rendu logiciel sur le Spark) ; le critère Mac p95 ≤ 16,7 ms reste à mesurer.
- **Décision à confirmer par David** : `degats.js` annonçait une « réparation complète à la remise en piste (décision
  David 16/11) ». La décision du 16/11 porte sur le délai (moins d'une seconde), pas sur une remise à neuf, et
  `REPRISE.md` réserve la réparation complète aux stands. Le remplacement n'est donc plus une remise à neuf ; facile à
  annuler si David veut l'inverse.
- **Réseau réel non éprouvé** : l'autorité est définie et documentée, pas testée sur une vraie partie multi-machines.
