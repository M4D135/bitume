# BITUME — répartition en discussions parallèles

## Départ

Demande du 20 novembre 2026 : avancer par petits lots, économiser le contexte et fournir un prompt par discussion. Cette fiche organise le travail ; elle ne déclare aucune nouvelle fonctionnalité livrée.

Base GitHub vérifiée : **d8f02cae45443ae6a1120dc93125d8adfae94422**, arbre **859b95aa2389da28eb7fb2f96088ca6fa1b46f97**. Runtime : **0.2.68 / p15 / FERRO 0.3.15 / neuf circuits**. L'eau qualifiée reste close. Au relevé, aucune PR ouverte et aucune branche distante habitacle/arcade/saisons/Troll parmi les 52 branches retournées. Revérifier au démarrage.

**Lancer 01, 02, 03 et 04 en parallèle ; utiliser 00 pour les intégrer.** 05 prépare les sources des circuits après ce premier groupe, ou indépendamment si une place est disponible. Un seul auteur par fichier ; un seul candidat assemblé à la fois.

| Discussion | Mission | Premier jalon | Fiche |
|---|---|---|---|
| 00 | Coordination, raccords, builds, publication | Relever les branches et figer les interfaces | [00-INTEGRATION.md](00-INTEGRATION.md) |
| 01 | Habitacle/pilote, puis Troll | Finir les contacts et la continuité du coude du candidat | [01-PILOTE-TROLL.md](01-PILOTE-TROLL.md) |
| 02 | Performance, mémoire, FERRO, visibilité, rendu fovéal | Mesurer une scène et retrouver les optimisations préparées | [02-PERFORMANCE.md](02-PERFORMANCE.md) |
| 03 | Menu arcade et manette | Reprendre les écrans et le vrai tracé tournant | [03-MENU.md](03-MENU.md) |
| 04 | Saisons puis matières | Qualifier les neuf circuits et quatre saisons | [04-SAISON-MATIERES.md](04-SAISON-MATIERES.md) |
| 05 | Sources Monaco/Marseille, suite des circuits | Qualifier les données routières manquantes | [05-CIRCUITS.md](05-CIRCUITS.md) |

## Fonctionnement commun

1. Lire AGENTS.md, REPRISE.md, cette page, puis seulement sa fiche et son état dans etat/NN.json. Dans le grand ETAT.json, privilégier etat_courant et les reçus exacts ; les sections historiques peuvent décrire une ancienne version.
2. Vérifier main distant, sa branche/PR et les [reprises existantes](REPRISES-EXISTANTES.md). Utiliser un checkout isolé. Ne pas réinitialiser le worktree d'une autre discussion, ni réappliquer un patch déjà intégré.
3. Un sous-lot mesurable à la fois **par discussion**. Écrire seulement dans son périmètre. Pour un fichier partagé, proposer le changement dans raccordements/NN.md avec points d'appel, entrées/sorties, ordre et contrôles ; 00 l'intègre.
4. Commit/push sur sa branche à chaque étape concrète. Limiter le commit à la tâche, sans push forcé. Un checkpoint incomplet reste explicitement non qualifié ; une PR de sources ne vaut pas version jouable livrée.
5. Mettre à jour son seul etat/NN.json sur sa branche : base, HEAD, sous-lot, preuves, limites et prochaine action. 00 récupère ces états et consolide le suivi global. Les discussions ne partagent pas automatiquement leur contexte : GitHub est le relais.
6. Garder logs/captures sur disque et citer les preuves utiles. Ne pas recharger discussions, HTML généré, archives et rapports entiers. Ne pas refaire une campagne close sans risque nouveau identifié.
7. Après un jalon, poursuivre le prochain sous-lot autorisé si le contexte le permet. Avant saturation, publier le point de reprise et répondre avec branche, SHA/PR, résultat, réserves et prochaine action. Le même prompt dans une nouvelle discussion reprend cet état.
8. Les lots visuels conservent p15. Les copies de FERRO.lock.json, dont src/carene.js, se corrigent dans FERRO canonique puis s'importent après qualification. Tout changement réel de conduite suit son lot physique et ses records/fantômes.
9. Conserver contenu procédural et choix manuels. Distinguer mesures logicielles et matérielles. Aucun FPS Xbox/Intel ni manette/audio/réseau réel déclaré qualifié sans l'essai correspondant. La mission publie sur GitHub ; elle ne déploie pas le site.

## Propriété des fichiers

| Propriétaire | Périmètre |
|---|---|
| 00 | src/jeu.js ; construire.py ; VERSION.json, SIZE.json, dist/ ; FERRO.lock.json et imports canoniques ; raccords course/conduite/circuit/reseau/realisateur ; suivi global |
| 01 | src/voiture.js, src/main.js, src/expressions-pilote.js, src/son.js |
| 02 | src/mesures.js, src/scene-bench.js, src/qualite.js, src/autoconfig.js, src/graphismes.js, src/cadence.js ; nouveaux modules ressources/importance justifiés ; dépôt canonique M4D135/FERRO |
| 03 | src/index.html, src/style.css, src/navigation-menu.js, src/menu-arcade.js |
| 04 | src/saisons.js, src/botanique.js, src/decor.js, src/bords.js, src/route-des-cimes-decor.js ; éventuel module de matières procédurales |
| 05 | Sources Monaco/Marseille, outils et tests de préparation dédiés ; aucun runtime au premier jalon |

Un nouveau module n'est exécuté par le jeu qu'après inclusion dans construire.py et raccord de ses appels par 00. Le travailleur peut le tester isolément ; cela ne qualifie pas la fonctionnalité intégrée. 00 raccorde chaque petit lot prêt sans attendre la fin des quatre discussions.

Tests/outils propres à un module suivent leur auteur ; les tests d'intégration partagés passent par 00. Les fichiers d'une phase future ne sont pas acquis : transfert explicite dans le [registre](REPARTITION.json) avant reprise. Les matières du cockpit restent à 01, celles du terrain à 04, les shaders canoniques à 02.

## Assemblage

1. Qualifier l'habitacle et ses raccords ; en parallèle, mesurer le moteur, préparer le menu et qualifier les saisons.
2. Intégrer saisons et menu quand prêts. Un lot bloqué n'empêche pas la publication d'un autre lot indépendant.
3. Intégrer Troll après le pilote commun et le contrat des choix par joueur du menu.
4. Intégrer les optimisations mesurées une à une. Comparer parent immédiat et candidat à scène/configuration identiques.
5. Enrichir les matières après stabilisation des saisons/habitacle et budgets.
6. Données qualifiées puis nouveaux circuits. Route-des-Cimes est déjà le neuvième : poursuivre ses lieux.

La file complète reste [FILE-TRAVAIL.json](../FILE-TRAVAIL.json) et [CONTINUATION-AUTONOME](../CONTINUATION-AUTONOME-2026-11-19.md). Pluie extérieure depuis abri, démos, relief/couverts, lieux signature, Baïkal, Monaco, Marseille, conduite depuis p15, réseau sans salon à gérer, calcul GPU/Worker/WASM et les autres destinations sont conservés. Cette répartition ne les clôt pas.

## Disponibilité des préparations

Le checkpoint habitacle déjà publié reste accessible. Des travaux locaux plus récents ont été inventoriés, mais leurs nouvelles captures n'ont pas pu être transférées avant la perte de l'environnement de travail. **Leur code n'est pas inclus dans ce dossier.** L'inventaire indique les SHA, périmètres et empreintes pour les retrouver sans les confondre avec une livraison. Rechercher d'abord une publication plus récente ; en l'absence de récupération possible, repartir du checkpoint publié ou des spécifications, en notant ce qui manque.
