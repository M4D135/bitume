# BITUME — reprise courte

## Point actif — 19 novembre 2026

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée du suivi ; ouvrir ensuite seulement la fiche active.

- Version publiée sur **main : 0.2.49**, commit `3dce3f8c40c4103fbf953c4b6ab9de8ce63eadba`.
- **12A–12F1 réalisés** : roues/sculptures, usure, chaussée, dégagement des rivaux, service réel et HUD par pilote.
- **12F2 — choix des pneus par pilote fusionné**, fiche `docs/reprise/12F2-CHOIX-PNEUS-PAR-PILOTE.md`.
  [PR n°3](https://github.com/M4D135/bitume/pull/3) fermée et fusionnée le **19 novembre à 12 h 17 (Paris)**,
  après l'autorisation explicite de David (« go »). **Lot actif : 12F3, en cours** — `docs/reprise/12F3-RESEAU-USURE-SERVICES.md`.
- Préférences séparées, Conseillés par pilote, confirmation 2+2/2+1/1+2, prochaine monte au stand en solo/duo.
  En ligne, les stands renouvellent encore la monte de départ ; le changement de monte attend **12F3**.
- La physique reste **p11** ; conserver toutes les fixtures p9/p10/p11. Ne jamais régénérer p11 pour masquer un écart.
- **Safari corrigé et clos**. FERRO **0.3.11**, modules inchangés. **WebGL et déploiement non validés** ici.

## Publication et prochaine action

La fusion est vérifiée : le tree `1149fcded082ccce45241938f2e3bb68fcebba75` du commit de fusion est identique à celui
de la tête revue `fb18a8358943576ab7b14b47383c5468bf8b2b62`. Reçu :
`docs/reprise/rapports/12F2-2026-11-19/FUSION-0249.json`. Le refus automatique initial reste dans l'historique ;
l'autorisation explicite a permis cette fusion. **Ne plus demander ni recommencer la fusion de la PR n°3.**

Preuve : `docs/reprise/rapports/12F2-2026-11-19/qualification-execution.json`. **102/103 suites** après 13 revalidations
ciblées, seul échec traces hérité identique ; **20 scénarios / 1 300 empreintes p11**, fixture inchangée. Deux builds
identiques, **14 024 804 octets**, SHA-256 `72b18fa2bc3aad3f0735296b5f56b98c67dcb75bcfc77cd3059d1404eb495c9c`.
Les deux contrôles GitHub finaux de `fb18a835` sont terminés : runs `44512608057` (PR) et `44512599093` (push),
**102/103 chacun**, seul échec traces hérité identique. Aucun contrôle obligatoire ni ruleset modifié.
Poursuivre **12F3**, branche `codex/bitume-12f3-20261119` : usure et services transmis à faible fréquence,
séance/pilote/service/séquence, autorité et reprise IA. La stratégie de stands des rivaux reste à qualifier
avant de rendre les longues courses dépendantes de ces arrêts.
Checkpoint initial : protocole et intégration en cours ; la 0.2.49 reste la dernière version qualifiée.

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
