# BITUME — reprise courte

## Point actif — 19 novembre 2026

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée de `docs/reprise/SUIVI-2026-11-19.md`.
N'ouvrir ensuite que la fiche du lot actif ; ne pas recharger les anciens journaux ni le HTML compilé.

- Branche unique **main**, publications fréquentes, aucun push forcé.
- **12A–12C publiés** en 0.2.45 (`71354f0`) ; **12D publié** en 0.2.46 (`9c49abad`).
- **12E publié** en **0.2.47 / p10**, commit **`c55cde23e8d14d3f579e2f1f5d2bea03abc14c71`**.
- **12F1 — service des pneus et affichage**, **0.2.48 / p11**, **publié sur main**, commit **`1df6f6872e9d6962d6561b9b371d41042567a915`**.
  Le tree distant correspond exactement au lot qualifié récupéré à `fbd8098` ; le brouillon 12F2 reste séparé.
- **Safari corrigé**, chantier clos. **FERRO 0.3.11**, 34 modules inchangés.

## Qualification et prochaine action

Fiche : `docs/reprise/12F1-SERVICE-PNEUS-ET-AFFICHAGE.md`.
Preuve : `docs/reprise/rapports/12F1-2026-11-19/qualification-execution.json`.
**99/100 suites** : seul l'échec traces hérité demeure. **199 empreintes** sources/tests/fixtures concordantes.
**20 scénarios / 1 300 empreintes p11** ; fixtures p9 et p10 intactes. Build reproductible : **14 006 845 octets**,
SHA-256 `716f9f85873b490e92cea5c3684a0c0133ec2541dd0ab8235b223511e5680d5b` ; 51 scripts valides.

Les quatre pneus sont renouvelés ensemble à la fin d'un service valide, avec annulation en cas d'interruption.
Le HUD affiche l'usure réelle propre à chaque pilote. Ce jalon renouvelle la monte équipée ; il n'ajoute pas
encore le choix d'une autre monte au stand ni la transmission réseau de l'usure.

Publication vérifiée : `docs/reprise/rapports/12F1-2026-11-19/PUBLICATION-0248.json`.
Main, tree des sources et blob du build contrôlés sur GitHub ; aucune nouvelle exécution de tests lors de cette publication.
**Prochain sous-lot unique : 12F2 — choix des pneus par pilote et au prochain arrêt**, avec migration des
préférences et confirmation 2+2. Un brouillon 12F2 est actif dans une autre session : examiner son checkpoint
avant toute nouvelle implémentation, sans modifier cette copie pendant son travail. **12F3** traitera ensuite le réseau de l'usure.
Ne pas reprendre 12A–12F1 au début. Le dégagement 12E reste limité à deux essais avant le secours historique.

**WebGL reste à valider**, aucune mesure FPS ni mise en ligne revendiquée. Le décor réussit dans le passage
12F1 ; la variabilité constatée en 12E (Haut-Col 194 ms > 150 ms) reste une réserve de performance.
La neige demeure une couverture explicite statique ; tunnels secs, sans accumulation ni fonte simulées.

## Catalogue et demandes conservés

**7 circuits jouables**, identifiants et graines conservés. David a confirmé un **huitième circuit de montagne**
distinct de Haut-Col (Route-des-Cimes, nom de travail), avec long parcours, fortes pentes, forêt et tunnels.
S'ajoutent **Russie**, **Monaco ultra fidèle** et **Spéciale Marseille depuis EMPRISE avec relief mesuré**.
Les six autres destinations restent des propositions. Réconcilier l'ancien objectif de 16 avec l'ajout montagne
sans supprimer de demande.

- Ensemble : `MASTER-LISTE-CLAUDE-FABLE.md` ; pneus/Russie/Monaco : `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`.
- Marseille : `docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md`, EMPRISE 0.6.8, `cc004826a506e6979eaaec217748fe85d5cd6ac5`.
- Autres lots : `docs/reprise/PILOTAGE-2026-11-18.md`, à ouvrir seulement pour le chantier concerné.

## Méthode et accès

Un sous-lot à la fois ; sorties courtes, preuves dans les rapports, journal et prochaine action à chaque publication.
Mac/Spark/amiga indisponibles ici. Les branches locales non fusionnées du pilotage restent hors livraison ;
reprendre le Spark d'abord lorsque l'accès est rétabli. Publication via la connexion GitHub, avec contrôle des
empreintes et de main. Préserver monoplace, conditions de l'hôte, menus manette, FPS démo, Faune et téléchargement
**m4d135 → BITUME.html**. Les modifications moteur passent par FERRO canonique.
Vérifier GitHub et le site séparément : aucune mise en ligne de 0.2.48 n'est déclarée par cette reprise.
