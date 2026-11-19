# BITUME — reprise courte

## Point actif — 19 novembre 2026

**12F4 en cours : stratégie de stands IA**, non qualifiée. Fiche `docs/reprise/12F4-STRATEGIE-STANDS-IA.md`.
Base vérifiée `c8afbd49` / **0.2.50** ; branche `codex/bitume-12f4-20261119`.
Prochaine action : décisions, guidage réel, service partagé puis qualification sur les sept circuits.
**p12 prévue** pour ce changement de simulation ; conserver les références p9/p10/p11 intactes.

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée du suivi ; ouvrir ensuite seulement la fiche active.

- **12F3 livré sur main en 0.2.50**, sources, tests, build et preuves publiés.
  Fiche : `docs/reprise/12F3-RESEAU-USURE-SERVICES.md`. Ne pas recommencer le lot.
- **Livraison vérifiée sur main : 0.2.50 / `9857f627`**. PR n°4 fermée et fusionnée le **19 novembre à 13 h 01 (Paris)** ;
  tree du commit de fusion identique à la tête revue `baeea490`. Publication et fusion terminées.
- **12A–12F3 publiés** ; PR n°3 et n°4 fusionnées. Ne pas redemander ni recommencer ces fusions.
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

Reçu : `docs/reprise/rapports/12F3-2026-11-19/PUBLICATION-0250.json`.
Les deux CI finales sont terminées : runs `44519375789` et `44519295768`, **104/105 chacune**,
seul échec traces hérité identique ; aucune CI entièrement verte annoncée.
**Sous-lot actif : 12F4 stratégie de stands IA**, périmètre fixé dans sa fiche ; source/build 0.2.51 non qualifiés.
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
