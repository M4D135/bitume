# BITUME — reprise courte

## Point actif — 19 novembre 2026

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée du suivi ; ouvrir ensuite seulement la fiche active.

- Base publiée sur **main : 0.2.48**, commit `1df6f6872e9d6962d6561b9b371d41042567a915`.
- **12A–12F1 réalisés** : roues/sculptures, usure, chaussée, dégagement des rivaux, service réel et HUD par pilote.
- **Lot actif : 12F2 — choix des pneus par pilote**, fiche `docs/reprise/12F2-CHOIX-PNEUS-PAR-PILOTE.md`.
  Sources raccordées ; qualification finale et reconstruction en cours. Le build versionné reste la 0.2.48 à ce checkpoint.
- Préférences séparées, Conseillés par pilote, confirmation 2+2/2+1/1+2, prochaine monte au stand en solo/duo.
  En ligne, les stands renouvellent encore la monte de départ ; le changement de monte attend **12F3**.
- La physique reste **p11** ; conserver toutes les fixtures p9/p10/p11. Ne jamais régénérer p11 pour masquer un écart.
- **Safari corrigé et clos**. FERRO **0.3.11**, modules inchangés. **WebGL et déploiement non validés** ici.

## Publication et prochaine action

Le push direct de cette session sur main a été refusé par l'approbation automatique. Préparer une **branche de revue**
avec sources, build et preuves ; ne pas contourner ce refus. La 0.2.48 a été publiée par une autre session ; son tree
est identique à notre base locale. Reçu : `docs/reprise/rapports/12F2-2026-11-19/BASE-0248.json`.

Terminer les contrôles ciblés après le passage général, reconstruire deux fois, vérifier les empreintes et publier
la revue. Lire ensuite son reçu distant avant toute fusion autorisée. Puis **12F3** : usure et services transmis
à faible fréquence, séance/pilote/service/séquence, autorité et reprise IA. La stratégie de stands des rivaux reste
à qualifier avant de rendre les longues courses dépendantes de ces arrêts.

## Demandes conservées

**7 circuits jouables**. Ajouts demandés : huitième circuit de montagne distinct de Haut-Col, Russie,
Monaco ultra fidèle et Spéciale Marseille issue d'EMPRISE avec relief mesuré. Six destinations restent proposées.
Ne supprimer aucun ajout pour tenir l'ancien objectif de 16.

- Ensemble : `MASTER-LISTE-CLAUDE-FABLE.md`.
- Pneus/circuits : `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`.
- Marseille : `docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md`.
- Autres travaux : `docs/reprise/PILOTAGE-2026-11-18.md`, seulement pour le lot concerné.

## Méthode

Un sous-lot à la fois, sorties courtes, journal et preuves dans Git. Mac/Spark/amiga indisponibles ici ; reprendre
le Spark d'abord quand l'accès revient. Les branches Mac absentes de GitHub ne sont pas livrées. Préserver les
conditions de l'hôte, la manette, les FPS démo, Faune et le téléchargement m4d135. Les modifications du moteur
passent par FERRO canonique. Vérifier GitHub et le site séparément.
