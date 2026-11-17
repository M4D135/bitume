# BITUME : reprise par lots courts

## Lire ceci en premier

Ce fichier permet de reprendre dans une nouvelle discussion sans recopier les conversations précédentes. Les rôles ci-dessous sont des périmètres de travail, pas des agents déjà lancés. Une discussion exécute un seul lot borné ; les intégrations sont séquentielles.

1. Vérifier la branche par défaut et sa tête distante. Lire `AGENTS.md`, `docs/reprise/ETAT.json`, puis uniquement la fiche du lot choisi et ses sources utiles.
2. Prendre le premier lot prêt dans l'ordre ci-dessous. Si un blocage administratif empêche le lot 0, le documenter et avancer sur le lot 1 sans supprimer de travail.
3. Livrer un correctif cohérent, ses tests et son point de reprise avant de changer de discussion. Un gros lot peut être subdivisé sans étendre son périmètre.
4. Relire la tête distante avant le push. En cas d'avancement concurrent, récupérer et réconcilier, sans force-push. Ne jamais faire écrire deux discussions simultanément sur les fichiers partagés.
5. Mettre à jour la fiche et `ETAT.json` : base, commit livré, fichiers, tests réellement exécutés, résultats, limites et prochaine action. L'identifiant du commit de code peut être inscrit dans une mise à jour documentaire suivante ; ne pas inventer de SHA autoréférentiel.

## État vérifié au 17 novembre 2026

Base distante : `main`, `d891fa24b6a2d00ffd01abb50989b2d9199698ee`, client **0.2.19**. Les PR 1 et 2 sont intégrées. Qualification historique de cette base : 34 suites et build reproductible ; voir les rapports versionnés de réconciliation. Ces résultats ne valident PAS les futurs changements.

Sept branches distantes étaient encore présentes lors du dernier inventaire. La demande de branche unique n'est donc pas encore exécutée. L'archive fournie est intégrée ; l'ancienne série locale `e074b55` reste non retrouvée. Ne pas la confondre avec l'archive portant les mêmes numéros de version.

**Cette livraison organise les reprises seulement. Les nouvelles corrections tunnel/crashs/IA/stands/performance ne sont pas encore réalisées. Aucun déploiement du site n'est effectué.**

## Répartition des discussions

| Lot | Fiche | Résultat attendu | Dépendance |
|---|---|---|---|
| 0 | [Dépôt unique](docs/reprise/00-DEPOT.md) | Travail conservé, une seule branche principale | Aucune |
| 1 | [Tunnel et mesures](docs/reprise/01-TUNNEL.md) | Reflets sans apparition brutale, référence de performance et overlay | Base vérifiée |
| 2 | [Crashs et PhysX](docs/reprise/02-CRASHS.md) | Accidents lisibles, pièces détachées bornées, récupération rapide | Lot 1 intégré |
| 3 | [Rivaux agressifs](docs/reprise/03-RIVAUX.md) | Manœuvres offensives contre joueur et autres IA | Lot 2 intégré |
| 4 | [Santé et stands](docs/reprise/04-STANDS.md) | Dégâts persistants visibles et réparations aux stands | Lots 2 et 3 intégrés |
| 5 | [Optimisation et qualification](docs/reprise/05-PERFORMANCE.md) | Gains mesurés, modes et plateformes contrôlés | Lots 1 à 4 intégrés |

`src/jeu.js`, `src/course.js`, `src/index.html`, `src/style.css`, `VERSION.json`, `SIZE.json` et `dist/bitume.html` sont des points de jonction : modifications et reconstructions séquentielles uniquement. Les analyses peuvent être indépendantes, pas les pushs concurrents sur la branche principale.

## Contraintes communes et décisions récentes

- Une seule page HTML autonome, hors ligne pour le jeu local, ressources visuelles et sonores procédurales. Préserver l'exception réseau nécessaire au mode en ligne.
- Respecter les empreintes de `FERRO.lock.json` (référence 0.3.3 à la base). Une correction moteur se fait dans le dépôt FERRO source, avec qualification puis propagation explicite, jamais en retouchant une copie verrouillée.
- Conserver la monoplace 1980, la dérive et le turbo, le cockpit détaillé, les commandes personnalisées, les deux joueurs locaux et les deux à quatre pilotes en ligne.
- La taille est mesurée, sans réintroduire l'ancien plafond de 1,4 Mo. `construire.py` gère normalement la version lorsque les sources changent.
- Les nouveaux crashs doivent être spectaculaires sans imposer une longue interruption : récupération en moins d'une seconde, débris pouvant poursuivre leur mouvement. Ne pas rendre la voiture totalement neuve à chaque replacement ; la réparation complète appartient aux stands.
- Aucun gain FPS inventé. Les mesures CPU, GPU et intervalle d'image sont distinctes ; une mesure indisponible reste N/D. Un test Node ne constitue pas une validation WebGL, PhysX navigateur, manette physique ou course WebRTC réelle.
- Cible mobile/Xbox Edge : 60 FPS, pas une garantie non mesurée. Ne pas supprimer du contenu au loin avec un seuil brutal pour atteindre cette cible.
- Pas de création de branches supplémentaires pour organiser les discussions. Pas de publication sur le site sans demande de déploiement.

## Fin de chaque lot

Mettre à jour le suivi puis répondre avec : ce qui est livré, commit et branche réels, tests passés/échoués/non exécutés, limite principale, prochain lot. Ne pas recopier l'audit complet ni les journaux dans le chat. Aucune tâche n'est supposée continuer entre deux messages.

## Message pour une nouvelle discussion

> Reprends BITUME dans le dépôt GitHub M4D135/bitume. Lis REPRISE.md et docs/reprise/ETAT.json sur la branche principale actuelle. Exécute uniquement le prochain lot prêt, conserve les contraintes et mets à jour le point de reprise. Ne recharge pas les anciennes discussions et ne crée pas de nouvelle branche.
