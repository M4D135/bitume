# BITUME — reprise courte

## Point actif — 19 novembre 2026

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée du suivi ; ouvrir ensuite seulement la fiche active.

- Base publiée sur **main : 0.2.48**, commit `1df6f6872e9d6962d6561b9b371d41042567a915`.
- **12A–12F1 réalisés** : roues/sculptures, usure, chaussée, dégagement des rivaux, service réel et HUD par pilote.
- **Lot actif : 12F2 — choix des pneus par pilote**, fiche `docs/reprise/12F2-CHOIX-PNEUS-PAR-PILOTE.md`.
  **0.2.49 publiée sur la branche de revue**, commit `ba9f54bd` ; [PR n°3](https://github.com/M4D135/bitume/pull/3) en brouillon, non fusionnée.
- Préférences séparées, Conseillés par pilote, confirmation 2+2/2+1/1+2, prochaine monte au stand en solo/duo.
  En ligne, les stands renouvellent encore la monte de départ ; le changement de monte attend **12F3**.
- La physique reste **p11** ; conserver toutes les fixtures p9/p10/p11. Ne jamais régénérer p11 pour masquer un écart.
- **Safari corrigé et clos**. FERRO **0.3.11**, modules inchangés. **WebGL et déploiement non validés** ici.

## Publication et prochaine action

Le push direct de cette session sur main a été refusé par l'approbation automatique. Une **branche de revue**
avec sources, build et preuves a été publiée ; ne pas contourner ce refus. La 0.2.48 a été publiée par une autre session ; son tree
est identique à notre base locale. Reçu : `docs/reprise/rapports/12F2-2026-11-19/BASE-0248.json`.

Preuve : `docs/reprise/rapports/12F2-2026-11-19/qualification-execution.json`. **102/103 suites** après 13 revalidations
ciblées, seul échec traces hérité identique ; **20 scénarios / 1 300 empreintes p11**, fixture inchangée. Deux builds
identiques, **14 024 804 octets**, SHA-256 `72b18fa2bc3aad3f0735296b5f56b98c67dcb75bcfc77cd3059d1404eb495c9c`.
Publication vérifiée : `docs/reprise/rapports/12F2-2026-11-19/PUBLICATION-0249.json`. **Fusion de la PR n°3 dans main
en attente d’autorisation**, après refus automatique de cette session ; vérifier les contrôles GitHub au moment de la fusion. Puis **12F3** : usure et services transmis
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
