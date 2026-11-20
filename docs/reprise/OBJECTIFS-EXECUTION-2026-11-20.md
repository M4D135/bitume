# BITUME — objectifs et exécution autonome

## Mandat et base

David demande de terminer toute la feuille de route, en autonomie, avec des commits fréquents,
des points de reprise courts et une consommation de contexte maîtrisée. Le 20 novembre,
il demande de publier d'abord sur GitHub tous les modèles, objectifs et éléments de feuille de route.
Les six références exactes sont conservées dans
[`docs/references/objectifs-utilisateur-2026-11-20`](../references/objectifs-utilisateur-2026-11-20/README.md).

Base livrée : **0.2.62 / physique p15 / FERRO 0.3.15**, huit circuits jouables.
La campagne 148/148 et le dégagement natif PhysX sont clos et leurs reçus restent inchangés.
La feuille de route complète vise **17 destinations**, en conservant les huit actuelles :
Route-des-Cimes, Monaco, Marseille et six destinations originales s'ajoutent au catalogue.
Une documentation publiée ne signifie pas que tous les développements sont terminés.

## Modèle à préserver

- Simulation déterministe à 120 Hz, châssis et contacts PhysX réels, identités des pistes et records versionnés.
- La conduite actuelle est p15. Un lot visuel reste p15 ; une modification de conduite qualifiée change explicitement sa version.
- FERRO est canonique dans son dépôt. Toute évolution du moteur passe par ce dépôt puis par la mise à jour du verrou.
- Formes, matières, météo et sons du jeu sont procéduraux. Les images de référence ne deviennent pas des assets chargés.
- Cockpit et pilote partagent leurs dimensions et ancrages entre les vues ; pas de mains traversant volant ou cuve.
- Haut-Col conserve son identifiant, sa graine et son plan. Baïkal conserve l'indice 7 et la graine 179.
- Un circuit réel distingue terrain, chaussée, tablier et tunnel. Une valeur inconnue reste signalée ; aucune fidélité mesurée inventée.

## Ordre d'exécution et critères de clôture

La file structurée [`FILE-TRAVAIL.json`](FILE-TRAVAIL.json) donne les dépendances et les états.
Le tableau complet historique reste dans
[`CONTINUATION-AUTONOME-2026-11-19.md`](CONTINUATION-AUTONOME-2026-11-19.md) ;
[`BRANCHES-ET-LOTS-2026-11-20.md`](BRANCHES-ET-LOTS-2026-11-20.md) distingue les anciens jets du code livré.

| Ordre | Ensemble | Résultat attendu pour le fermer |
|---|---|---|
| 1 | Démos, sols, volant et pilotes | Caméras hors du terrain et des solides, volant ancré dans toutes les vues, regard lié aux rivaux, gestes expressifs/Troll ; contrôles géométriques et captures intégrées. |
| 1 | Pluie, panache et neige | Matière et mouvement conformes aux objectifs des trois images, fusion/évacuation des gouttes, abris/pause/J1/J2 corrects ; contrôle du shader et du jeu complet. |
| 2 | Passages couverts et niveaux | Plusieurs passages par piste, distinction tunnel/galerie/pont, même information pour simulation, météo, éclairage, caméra et rétroviseurs. |
| 2 | Route-des-Cimes | Circuit original distinct, plan proche de la référence 9,70 km/270 m/30 %, Lacets, trois couverts, pont/gorge ; boucle fermée et châssis/IA qualifiés avant catalogue. |
| 3 | Haut-Col 22A | Plan conservé, rampes >10 %, corniche et second tunnel ; appuis, vitesse IA, visibilité et dégagement qualifiés. |
| 3 | Monaco 14A–F | Sources routières datées et niveaux qualifiés, route/murs/épingle, stands/tunnel, port/ville ; rapport de fidélité, course et IA. |
| 3 | Marseille 15A–F | Corridor choisi dans l'emprise, relief densifié et provenance résolue, quais/tabliers distincts, ville et course jouable. |
| 4 | Six destinations 16A–F | Fjord-d'Argent, Crêtes-des-Carpates, Landes-d'Écosse, Sierra-Cuivrée, Baie-du-Corail, Col-des-Andes ; identités, biomes, reliefs et courses qualifiés. |
| 4 | Conduite 17 | Puissance 521 ch calibrée depuis p15, ABS selon aide, dérive fondée sur glisse réelle, guidage clavier/tactile séparé ; nouvelle identité physique et migration cohérente. |
| 4 | Rendu 21 et matières 23/25 | Sols sans défaut établi, ombres/eau/reflets/éclairage de nuit et tunnels, palier Photo/courbe conservant les teintes ; freins, chaleur, salissures et grain. |
| 4 | Invitations 27 | Invitation/code sans serveur dédié à administrer par David, signalisation et repli qualifiés ; salon actuel conservé jusqu'à qualification du remplacement. |
| 4 | Calcul 28 | Mesure des charges, précréation progressive, cache IndexedDB versionné/intègre avec repli ; Worker/WASM/WebGPU seulement pour un coût identifié. |
| 5 | Records et championnat | Records isolés par circuit/mode/boîte/modèle, migration compatible ; championnat de plusieurs courses avec sauvegarde/reprise. |
| 5 | Qualification finale | CI, builds reproductibles et captures sur versions exactes ; distinguer les essais logiciels des essais matériels, audio/manettes et réseaux réels. |

Les lots déjà livrés (roues/pneus/stands, Baïkal, public, échappement, vibrations,
faune, chargement de base, aspiration et dégagement p15) ne sont pas recréés.
Leurs extensions aux nouveaux circuits sont testées au moment de l'intégration.

## Travail fréquent, reprise courte

1. Lire `REPRISE.md`, puis l'état et le seul lot actif de la file ; ouvrir les extraits utiles.
2. Réserver des fichiers à chaque agent et utiliser des worktrees isolés. L'intégrateur possède les raccords partagés et le build.
3. Faire un commit dès qu'un sous-ensemble cohérent est sauvegardable. Publier aussi les branches préparées, avec leur qualification réelle ; intégrer seulement les candidats qualifiés.
4. Garder les journaux longs dans les rapports locaux ou les artefacts CI. Consigner dans Git le résultat, les empreintes, la commande et les limites pertinentes.
5. Faire d'abord les contrôles ciblés. Lancer une campagne intégrée quand le lot est cohérent ; répéter uniquement pour résoudre une régression ou une exigence précise.
6. Vérifier l'arbre distant, les contrôles et l'arbre de fusion. Ne pas pousser de force, écraser un travail parallèle ou abaisser un seuil pour obtenir du vert.
7. Actualiser la file, le journal et la reprise après chaque publication ; poursuivre le prochain lot réalisable sans nouvelle demande d'autorisation déjà couverte.

Les scripts `tools/spark/` sont présents. Leur présence ne prouve pas un accès au lanceur
local `kbza` de David : vérifier la capacité avant de revendiquer une délégation au Spark.
Les agents à contexte borné et les fichiers de reprise assurent la continuation dans cet environnement.
Aucune tâche n'est présentée comme continuant hors session sans exécution effective.

## Réserves et preuves nécessaires

- Les sources Monaco déjà acquises (415 points OSM, 830 observations de terrain) ne donnent pas encore les altitudes de chaussée, largeurs et dévers qualifiés. `readyForRuntime=false` demeure jusqu'à qualification.
- Les séquences de l'étude montagne ont été récupérées ; les ajustements du plan final doivent être reconstruits et identifiés comme nouveaux, puis mesurés.
- Les captures logicielles ne qualifient ni les FPS matériels ni le ressenti audio/manette ou une liaison entre réseaux distincts.
- Durées historiques à réduire/mesurer : 188 ms Val-Brûlé, 154/167 ms Haut-Col, cible 150 ms. Réserve facultative S8 : 1 031 °/s², cible 300 ; les 46 critères obligatoires restent réussis.
- Aucun déploiement externe n'est attesté par cette publication. Les nouveaux résultats doivent citer leurs reçus sans réattribuer les preuves d'une ancienne version.
