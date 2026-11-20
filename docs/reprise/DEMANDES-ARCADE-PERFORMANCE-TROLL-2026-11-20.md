# BITUME — demandes du 20 novembre 2026

Ces demandes complètent le programme et les correctifs eau/habitacle/pilote. Elles ne remplacent ni les circuits déjà prévus ni les préparations conservées. La demande de poursuite et de publication sur main reste active.

| Sujet | Demande à réaliser | État au présent checkpoint |
|---|---|---|
| Saisons | Vérifier les neuf circuits, particulièrement le dernier, et appliquer les couleurs des arbres, le feuillage, les fleurs et la neige selon la saison et les espèces. | Correction en préparation ; validation catalogue ouverte. |
| Menu arcade | Plusieurs écrans de choix simples, sélection facile des circuits, aperçu du vrai tracé en 3D qui tourne. | Intégration en cours ; image finale non validée. |
| Manette | Tout le parcours de préparation accessible à la manette : parcourir, régler, valider et revenir. | À vérifier sur les nouveaux écrans. |
| Configurations modestes | Xbox via Edge, petits PC sans carte graphique dédiée, GPU intégrés Intel. Profils cohérents, choix manuels conservés. | Audit et optimisations en cours ; aucun FPS matériel promis. |
| Moteur | Réduire les coûts intrinsèques du moteur, jugé trop lourd ; mesurer les gains à scène identique. | Calculs de pose/rétroviseurs et travail des menus ciblés ; audit FERRO canonique prévu. |
| Troll des IA | Les concurrents IA font aussi des emotes, notamment quand ils dépassent le joueur. Geste ET klaxon aléatoires. | Déclenchement en cours ; fréquence à limiter. |
| Troll des joueurs | Avant course, chaque joueur choisit séparément le geste et le son du klaxon : classique, ancien, mariage… | Choix à intégrer aux écrans Pilotes, indépendants pour J1 et J2. |
| Bouton unique | **Un seul appui sur l’action/bouton Troll déclenche simultanément le son choisi et le mouvement du pilote.** | Contrat fonctionnel confirmé ; aucun second bouton klaxon. |
| Suivi Git | Pousser toutes ces demandes afin de les conserver dans le suivi, puis continuer le travail. | Présente fiche, reprise courte, file de travail et journal mis à jour. |

## Critères de réalisation

- Le tracé de l’aperçu reprend les coordonnées et le relief du circuit sélectionné. Son animation s’arrête hors écran ; il ne doit pas imposer une course complète en arrière-plan.
- Les saisons conservent les tracés, collisions, graines et identifiants. Les conifères restent cohérents ; le coût des branches d’hiver reste borné.
- Les optimisations conservent la conduite p15 et sont mesurées séparément des réductions de qualité. Toute modification des modules FERRO se fait dans leur dépôt canonique puis est propagée avec son verrou.
- Le Troll est un événement commun son/geste. Les humains gardent leur sélection mémorisée ; les IA tirent les deux au hasard. Pas de rafale lors d’un duel de positions ou d’un bouton maintenu.
- La publication d’une demande ou d’un checkpoint ne vaut pas validation visuelle, audio ou matérielle. Les preuves et les réserves accompagnent chaque livraison.

## Fiches de travail

- [Menu, profils et emotes](MENU-ARCADE-PROFILS-2026-11-20.md).
- [Saisons du catalogue](SAISONS-CATALOGUE-2026-11-20.md).
- [Habitacle et pilote communs](PILOTE-HABITACLE-COMMUN-2026-11-20.md).
- [File complète](FILE-TRAVAIL.json) et [journal](JOURNAL-AUTONOME-2026-11-20.md).
