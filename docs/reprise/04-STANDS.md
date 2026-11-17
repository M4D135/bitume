# Lot 4 : santé de la voiture et arrêts aux stands

Statut : **à faire**, après intégration des lots 2 et 3.

## Objectif

Une jauge de santé compréhensible et des stands réellement utilisables pour réparer, en reprenant les mécanismes pertinents du projet original de l'utilisateur `M4D135/vroom-unreal`, sans copier de ressources tierces.

## Sources et référence déjà lue

BITUME : `src/degats.js`, `src/course.js`, `src/circuit.js`, `src/decor.js`, `src/jeu.js`, `src/index.html`, `src/style.css`, `src/reseau.js`.

Vroom Unreal : `Source/Vroom/Public/VroomDamageModel.h`, blob `d63d47c8383db954a8edd72f5046aaada9ec75ba`. Le modèle distingue avant/arrière/gauche/droite, les effets sur adhérence, traînée et biais de direction, la récupération d'urgence partielle et la réparation complète. Lire aussi les portions pertinentes des règles de course et de `VroomCar.cpp` avant d'affirmer que les stands sont reproduits.

## Travail

Afficher santé et avaries sans surcharger le cockpit. Deux joueurs : état propre à chacun. Ne pas confondre santé persistante et flash rouge d'un impact. La jauge doit provenir du même état que les pénalités et la réparation, sans simulation parallèle uniquement destinée au HUD.

Créer une entrée et une sortie de stands accessibles, une zone d'arrêt et une progression de service lisible. Entrée depuis la piste sans traverser une glissière ; vitesse et immobilisation vérifiées ; départ et annulation définis. Pas de réparation complète à distance, en roulant devant le garage ou par simple replacement après crash.

Réparation complète, durée liée au service et remise en état graphique cohérente avec les pièces perdues. Ajouter les pneus seulement si le circuit de service et le choix des pneus existant sont correctement raccordés. Les IA doivent pouvoir utiliser le service ou disposer d'une règle explicitement documentée, pas d'une réparation secrète sans coût.

En ligne : état de santé/service transmis selon l'autorité du jeu, pas confiance aveugle dans un message distant. Examiner les paquets et la compatibilité avant modification ; les inconnus ne doivent pas pouvoir réparer une autre voiture.

## Acceptation

Tests des dommages persistants, récupération partielle, entrée/sortie, interruption/reprise, réparation complète et pénalités. Tester en solo, à deux et en ligne avec indices locaux différents ; définir et vérifier la règle chrono et fantôme. Aucun joueur enfermé dans les stands, aucune sortie donnant un tour gratuit.

## Livraison

Jauge, service, commandes et documentation concise en français ; tests et parcours manuel. Préserver la miniature de carte, les rétroviseurs et l'accès aux commandes sur mobile.
