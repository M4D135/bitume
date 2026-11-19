# BITUME — reprise courte

## Point actif — 19 novembre 2026

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée de `docs/reprise/SUIVI-2026-11-19.md`,
puis seulement la fiche `docs/reprise/12E-CHAUSSEE-ADHERENCE.md` lorsqu'elle existe.

- Branche unique **main**, publications fréquentes, aucun push forcé.
- **12A–12C publiés** en 0.2.45 (`71354f0`) ; **12D publié et vérifié** en **0.2.46** (`9c49abad`).
- Sources/build 0.2.46 récupérés au checkpoint `834d270`, preuves vérifiées et jointes à cette publication.
- **Safari corrigé**, chantier clos. **FERRO 0.3.11**, 34 modules inchangés. **Physique p9 conservée**.
- Usure et saleté visibles par roue ; la neige est préparée mais son choix attend le lot physique **12E**.

## Prochaine action précise

**12E — chaussée et adhérence** est ouvert ; lire sa fiche, terminer le code, qualifier puis publier.
Reçu 0.2.46 : `docs/reprise/rapports/12D-2026-11-19/PUBLICATION-0246.json`.
Preuves : `docs/reprise/rapports/12D-2026-11-19/qualification-finale.json`.
**91/93 suites**, deux échecs hérités identiques, **19 scénarios / 1 259 empreintes p9 identiques**.
Build reproductible SHA-256 `9ab9097c7493d8260677022cef528f4a70fb9293372ecd61628c9e81abb52641`.
Aperçu CPU contrôlé ; **WebGL reste à valider** (Chromium bloqué au démarrage dans cette session).
Ensuite : **12F** stands/interface/réseau, puis Russie, Monaco et Marseille. Aucun déploiement revendiqué.

## Catalogue et demandes conservés

**7 circuits jouables**, identifiants et graines conservés. David a confirmé un **huitième circuit de montagne**
distinct de Haut-Col (Route-des-Cimes, nom de travail), avec long parcours, fortes pentes, forêt et tunnels.
S'ajoutent **Russie**, **Monaco ultra fidèle** et **Spéciale Marseille depuis EMPRISE avec relief mesuré**.
Les six autres destinations restent des propositions. Le catalogue initial de 16 doit être réconcilié avec
l'ajout montagne ; ne supprimer aucune demande pour tenir l'ancien compte.

- Ensemble des demandes : `MASTER-LISTE-CLAUDE-FABLE.md` ; plan roues/Russie/Monaco : `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`.
- Marseille : `docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md` ; source EMPRISE 0.6.8, `cc004826a506e6979eaaec217748fe85d5cd6ac5`.
- Autres lots et études : `docs/reprise/PILOTAGE-2026-11-18.md`, à ouvrir seulement pour le chantier concerné.

## Méthode et accès

Un sous-lot à la fois ; sorties courtes, preuves dans les rapports, journal et prochaine action à chaque publication.
Mac/Spark indisponibles ici. Les branches locales non fusionnées du pilotage ne sont pas publiées sur GitHub ;
conserver leurs références sans les compter livrées. Reprendre le Spark d'abord lorsque l'accès est rétabli.
Les modifications moteur passent par FERRO canonique. Préserver monoplace, conditions de l'hôte, menus manette,
FPS démo, Faune et téléchargement **m4d135 → BITUME.html**. Vérifier GitHub et le site séparément :
aucun déploiement de la version visée n'est déclaré par cette reprise.
