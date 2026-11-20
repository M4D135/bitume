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

## Coordination 00 : sources reçues, assemblage prêt à commencer

**Lot 05 reçu :** sources/outils Monaco et Marseille, tête `fa29088`,
code qualifié `d638652` ; CI `44783388788` réussie et trois suites ciblées
rejouées. Aucun changement du runtime ; mesures inconnues conservées,
Monaco et Marseille restent non jouables.
[Réception](docs/reprise/PARALLELE-2026-11-20/rapports/00-RECEPTION-05.json).

**À assembler :** PR41 pilote/Troll `d99d55c`, PR40 menu `e54b3cc`,
et saisons S1 `6cbfa7e`. Raccorder les sources puis qualifier le build exact.
Exclure les pierres M1 encore ouvertes ; FERRO reste0.3.15, P1 non publié.
[Contrats](docs/reprise/PARALLELE-2026-11-20/raccordements/00.md).

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

[Journal](docs/reprise/JOURNAL-AUTONOME-2026-11-20.md), entrée **029**.
Lecture minimale : ce fichier, `docs/reprise/ETAT.json` → `etat_courant`,
puis la fiche du lot traité. Sauvegarder les étapes et poursuivre sans redemander un go.
