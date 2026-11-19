# 12F1 — Service des pneus et affichage

## Périmètre de cette reprise

Reprise du 19 novembre 2026 dans une copie isolée. La session précédente termine la publication du lot 12E,
version 0.2.47 ; son code qualifié est la base de travail. Intégrer son commit distant avant publication de 12F1.
Un seul jalon fonctionnel ici : renouvellement des quatre pneus au stand et lecture de leur état par pilote.

## Contrat

- Le début du service fige le type déjà monté et la révision courante. Le remplacement des quatre pneus est
  atomique à la fin effective du service ; la réparation de carrosserie reste une opération distincte.
- Le numéro de service augmente exactement une fois. Les nouvelles graines de motif sont déterministes,
  dérivées de l'identité de séance, de voiture et de service, sans consommer le hasard partagé de la course.
- Entrer dans la voie, passer devant le garage, interrompre le service ou se faire replacer ne donne aucun pneu
  neuf. Un rival ou un véhicule distant ne reçoit aucun service local implicite.
- Les limites longitudinales de la voie et du garage doivent être vérifiées dans les deux sens. Une position
  après le garage n'est pas une position dans le garage.
- Le HUD lit l'état réel de la voiture de chaque pilote : type, usure maximale et quatre petites barres de gomme.
  Les descriptions accessibles nomment chaque roue ; les données absentes sont indiquées comme inconnues.
- Aucun nouveau choix de monte au stand dans ce sous-lot : il renouvelle la monte déjà équipée. Le choix séparé
  par pilote et le choix de monte de service appartiennent à la suite de 12F.
- La physique passe de p10 à p11 : le service et les limites des stands changent les états de course possibles.
  Les références p9 et p10 restent archivées, ainsi que leurs espaces de records et fantômes.

## Qualification ciblée

Services interrompus/complets/répétés, quatre types, état neuf et adhérence après service, conservation après
replacement, absence de service pour IA/distant, indépendance entre pilotes. Le vrai code HUD est exécuté avec
des nœuds DOM bornés ; vérifier l'absence de mutation de la simulation et d'écritures DOM répétées.
Rejouer les suites de conduite/stands/usure, préparation et écran partagé. Qualifier le déterminisme p11 avec
une fixture distincte, reconstruire deux fois, contrôler les modules FERRO et les empreintes distantes.
Les contrôles CPU et DOM ne valent pas inspection WebGL ni mesure de FPS.

## Suite : 12F2 puis 12F3

1. Choix de pneus par pilote humain, migration de la préférence existante, service et confirmation 2+2.
2. État des quatre pneus à faible fréquence, message versionné avec séance/pilote/service/séquence, événement
   fiable de remplacement et rejet des messages périmés ou non autorisés. Ne pas gonfler les positions à 60 Hz.
3. Reprise par l'IA depuis le dernier état accepté, sans remise à neuf, compatibilité circuit/protocole au départ.
   Une arrivée après le départ attend actuellement la course suivante ; ne pas annoncer une reconnexion complète.
4. Qualifier la stratégie de stands IA avant de rendre les courses longues dépendantes des changements de pneus.

Le réseau de la 0.2.47 ne transporte pas encore l'usure. Ce sous-lot ne prétend pas terminer tout 12F.
Les nouveaux circuits, Safari et les modules FERRO restent hors de ce jalon.
