# BITUME — reprise courte

## Publié sur main : eau 0.2.68

PR #39 fusionnée : `4a04c090535f0c11d3db9900284c31e244a0c79c` ; arbre `b84d8553` relu,
exactement celui du candidat qualifié. **0.2.68 / p15 / FERRO 0.3.15 / neuf circuits.**
HTML : 14 383 155 octets, SHA256 `60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`.

L’eau suit le flux relatif et la caméra : gravité à l’arrêt, écartement/évacuation
à vitesse élevée, perles/nappes/grosses gouttes raccordées.
**160/160 suites Node, 8/8 tests Python ; 24/24 intervalles PNG indépendants,
2076 mesures ; 122 PNG du jeu inspectés** (98 candidat, 24 référence 0.2.62).
Démos 48, météo 41, couverts 24, portrait/duo 9 ; 45 rapports conformes.
L’unique échec de démarrage Chromium est conservé ; seul son job a été repris.
[Publication et preuves](docs/reprise/rapports/EAU-VITESSE-2026-11-20/PUBLICATION-0268.json).
Les anciens tests/images ne sont pas à relancer.

## Répartition en discussions parallèles

[Plan et prompts par discussion](docs/reprise/PARALLELE-2026-11-20/README.md) : **01 pilote/Troll,
02 performance/FERRO, 03 menu arcade, 04 saisons/matières** peuvent avancer
ensemble. **00** conserve les raccords partagés et la publication ; **05** prépare
ensuite les sources Monaco/Marseille. Un sous-lot par discussion, un état court
sur sa branche, une intégration à la fois. Les reprises déjà préparées sont
inventoriées ; quatre patches portables sont sauvegardés avec leurs empreintes,
sans application au runtime.

## Coordination 00 : inventaire et contrats

Relevés du 20/11 sur main `1c71bb3` : 52 branches historiques déjà contenues, puis
**trois checkpoints 01/02/03** apparus avant publication ; aucune PR ouverte.
Le **P0 documentaire de 02** (`0e42588`) est intégré avec ses trois fichiers exacts.
**00 publié sur main : `a8a6435`**, arbre reçu identique au candidat ;
[reçu de publication](docs/reprise/PARALLELE-2026-11-20/rapports/00-PUBLICATION-20261120.json).
Habitacle, menu et optimisation P1 restent non qualifiés ; 04/05 sans branche au relevé.
[Inventaire exact](docs/reprise/PARALLELE-2026-11-20/rapports/00-INVENTAIRE-20261120.json) ·
[Contrats de raccordement, révision 1](docs/reprise/PARALLELE-2026-11-20/raccordements/00.md).
Menu, Troll, caches saisonniers, budgets par vue et imports FERRO sont cadrés.
Les sources préparées restent non qualifiées ; aucun nouveau build. À la prochaine
reprise, intégrer le premier petit lot distant prêt, sans attendre tous les autres.

## Travaux actifs

1. **Habitacle/pilote** : géométrie métrique commune, vraie cuve et assise abaissée
   préparées ; contrôles fins des bras et du coude encore ouverts avant build.
   [Fiche](docs/reprise/PILOTE-HABITACLE-COMMUN-2026-11-20.md) ·
   [checkpoint réapplicable, non qualifié](docs/reprise/preparations/habitacle-commun-2026-11-20/README.md).
2. **Saisons sur les neuf circuits**, demande ajoutée pendant ce travail : vérifier
   couleurs/feuilles/neige et générateurs spécifiques, particulièrement Route-des-Cimes.
   [Fiche](docs/reprise/SAISONS-CATALOGUE-2026-11-20.md).
3. **Menu arcade et configurations modestes** : plusieurs écrans, sélection facile
   des circuits avec tracé 3D rotatif, navigation manette ; profil adapté Xbox/Edge
   et GPU intégré Intel. Priorité aux coûts réels du moteur. Chaque joueur choisit
   geste et klaxon avant course ; les IA les tirent au hasard après dépassement. [Fiche](docs/reprise/MENU-ARCADE-PROFILS-2026-11-20.md).

[Toutes les dernières demandes, y compris Troll son + geste](docs/reprise/DEMANDES-ARCADE-PERFORMANCE-TROLL-2026-11-20.md).

[Nouvelles demandes moteur : mémoire, géométrie, matières, rendu fovéal et visibilité](docs/reprise/OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES-2026-11-20.md).

## Réserves et reprise

Coût logiciel de l’optique conservé ; FPS matériels, audio, manettes réelles et
réseau entre machines non qualifiés. La préparation pluie extérieure sous abri
reste distincte. Les autres lots et 17 destinations restent dans FILE-TRAVAIL.

[Journal](docs/reprise/JOURNAL-AUTONOME-2026-11-20.md), entrée **028**.
Lecture minimale : ce fichier, `docs/reprise/ETAT.json` → `etat_courant`,
puis la fiche du lot traité. Sauvegarder les étapes et poursuivre sans redemander un go.
