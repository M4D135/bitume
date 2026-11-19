# BITUME — reprise courte

## Point actif — 19 novembre 2026

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée du suivi ; ouvrir ensuite seulement la fiche active.

- **12F3 qualifié CPU en 0.2.50 ; publication finale EN COURS**, sources et build gelés.
  Fiche : `docs/reprise/12F3-RESEAU-USURE-SERVICES.md`. Ne pas recommencer le lot.
- Dernier **main vérifié : 0.2.49 / `56086ecc`**. Checkpoint sources 12F3 distant vérifié : `7c908b17`,
  branche `codex/bitume-12f3-20261119`. La 0.2.50 n’est pas encore déclarée publiée sur main.
- **12A–12F2 publiés** ; PR n°3 fusionnée après le « go » de David. Fusion close : ne pas la redemander.
- **Choix de prochaine monte actif en ligne**, par pilote. Type et quatre états de pneus à **2 Hz**,
  service immédiat fiable, validation puis relais par l’hôte ; reprise IA sans remise à neuf.
- Compatibilité de préparation : protocole et identifiant de circuit/empreinte complète des sources.
  Une liaison tardive retrouve l’état ; un joueur absent de la grille attend la prochaine course.
- **p11 conservée**, fixtures p9/p10/p11 intactes. Safari corrigé et clos. FERRO **0.3.11** inchangé.

## Preuves et prochaine action

Rapport : `docs/reprise/rapports/12F3-2026-11-19/qualification-execution.json`.
**104/105 suites**, seul `traces.test.mjs` hérité et identique : `reserve-traces.json` dans le même dossier.
**20 scénarios / 1 300 empreintes p11** identiques ; aucune fixture régénérée. **52 scripts valides**,
**34 modules FERRO inchangés**. Deux builds identiques : **14 042 272 octets**, SHA-256
`b1154b9b8a03641f2b166c44bd7cd191589e2375a9cc490733edd90934d5dc21`.

Terminer la publication sources/tests/build/preuves, vérifier le distant puis enregistrer le reçu.
**Prochain sous-lot : stratégie de stands IA**, non commencé ; le borner avant toute modification.
Ne pas rendre les longues courses dépendantes de ces arrêts avant qualification des rivaux.
**Parties réelles entre navigateurs, WebGL, matériel et déploiement non validés.**
Les tests utilisent les vrais contrôleurs avec transport simulé ; le site n’est pas déclaré vérifié.
La variabilité CPU historique du décor reste une réserve distincte.

## Demandes conservées

**7 circuits jouables**. Conserver Russie, Monaco ultra fidèle, Spéciale Marseille issue d’EMPRISE avec
relief mesuré, huitième circuit de montagne distinct de Haut-Col et six destinations proposées.
Ne supprimer aucun ajout pour tenir l’ancien objectif de 16.

- Ensemble : `MASTER-LISTE-CLAUDE-FABLE.md`.
- Pneus/circuits : `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`.
- Marseille : `docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md`.
- Autres travaux : `docs/reprise/PILOTAGE-2026-11-18.md`, seulement pour le lot concerné.

## Méthode

Un sous-lot à la fois, sorties courtes, journal et preuves dans Git. Mac/Spark/amiga indisponibles ici ; reprendre
le Spark d’abord quand l’accès revient. Les branches Mac absentes de GitHub ne sont pas livrées. Préserver les
conditions de l’hôte, la manette, les FPS démo, Faune et le téléchargement m4d135. Les modifications du moteur
passent par FERRO canonique. Vérifier GitHub et le site séparément.
