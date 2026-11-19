# BITUME — reprise courte

## Point actif — 19 novembre 2026

**12F4 qualifié CPU en 0.2.51 ; publication finale EN COURS. Aucune PR créée à ce stade.**
Fiche : `docs/reprise/12F4-STRATEGIE-STANDS-IA.md` ; branche `codex/bitume-12f4-20261119`.
Checkpoint sources distant **`cb023508` vérifié** ; sources, tests et build gelés.
**Main reste vérifié en 0.2.50 / `c8afbd49`**. La 0.2.51 n’est pas encore déclarée livrée sur main.

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée du suivi ; ouvrir seulement la fiche active.

- Rivaux locaux et humains repris par l’IA : usure forte ou monte durablement inadaptée, approche et file
  par commandes physiques, admission après contacts, vrai service puis sortie ; aucune remise à neuf cachée.
- Garage occupé dégagé physiquement ; voitures distantes sous leur autorité ; transport pneus 12F3 conservé.
- **p12 qualifiée**, nouvelle référence créée explicitement après les ciblés ; archives **p9/p10/p11 intactes**.
  Lois de conduite et d’usure inchangées. Safari corrigé et clos ; FERRO **0.3.11** inchangé.

## Preuves et prochaine action

Rapport : `docs/reprise/rapports/12F4-2026-11-19/qualification-execution.json`.
**106/107 suites**, seul `traces.test.mjs` hérité, signature identique ; aucun autre échec.
**21 scénarios / 1 375 empreintes p12**, référence inchangée pendant la qualification ; **211 empreintes suivies**.
Création initiale de p12 attestée séparément par `CREATION-P12.json` dans le même dossier.
Deux builds identiques : **14 056 780 octets**, SHA-256
`e349f073c872d129367b0d13d9c0b1e72e76fa67e1851663a0ac7e3f64aa7225`.
**53 scripts valides**, **34 modules FERRO inchangés**. Ciblés : 17 trajets, 6 décisions, 18 stands,
30 stands-pneus et 8 chaussée réussis ; sept circuits avec limites et solides réels.

Terminer la publication sources/tests/build/preuves, vérifier le distant et enregistrer le reçu.
**Prochain lot après publication : 13A — Russie, tracé et relief, NON COMMENCÉ.**
Le Baïkal reste la proposition de thème ; la demande ferme porte sur un circuit en Russie.

**Parties réelles entre navigateurs, WebGL, performances matérielles et déploiement non validés.**
Les essais réseau utilisent les vrais contrôleurs avec transport simulé ; le site n’est pas déclaré vérifié.
La variabilité CPU historique du décor reste une réserve distincte.

## Base publiée et demandes conservées

**12A–12F3 livrés jusqu’à 0.2.50** ; PR n°3 et n°4 fusionnées, ne pas les redemander.
Reçu précédent : `docs/reprise/rapports/12F3-2026-11-19/PUBLICATION-0250.json`.
**7 circuits jouables**. Conserver Russie, Monaco ultra fidèle, Marseille depuis EMPRISE avec relief mesuré,
huitième circuit de montagne distinct de Haut-Col et six propositions ; aucun retrait pour tenir 16.
Ensemble : `MASTER-LISTE-CLAUDE-FABLE.md` ; détails : `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`
et `docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md`.

## Méthode

Un sous-lot à la fois, sorties courtes, journal et preuves dans Git. Mac/Spark/amiga indisponibles ici ; reprendre
le Spark quand l’accès revient. Les branches Mac absentes de GitHub ne sont pas livrées. Préserver conditions de
l’hôte, manette, FPS démo, Faune et téléchargement m4d135. Moteur : FERRO canonique. Vérifier GitHub et site séparément.
