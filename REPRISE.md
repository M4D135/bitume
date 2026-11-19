# BITUME — reprise courte

## Point actif — 19 novembre 2026

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée de `docs/reprise/SUIVI-2026-11-19.md`.
N'ouvrir ensuite que la fiche du lot actif ; ne pas recharger les anciens journaux ni le HTML compilé.

- Branche unique **main**, publications fréquentes, aucun push forcé.
- **12A–12C publiés** en 0.2.45 (`71354f0`) ; **12D publié** en 0.2.46 (`9c49abad`).
- **12E — chaussée et adhérence**, version **0.2.47**, physique **p10** : qualification CPU achevée avec réserves, publication en cours.
- Le rival contre l'arbre se dégage par un recul physique, sans replacement ni remise à neuf de ses pneus.
  Deux essais au maximum au même endroit ; après deux échecs, le secours historique reste disponible.
  Un déplacement réel de 8 m réarme les essais. La grille et les attentes de trafic restent exclues.
- **Safari corrigé**, chantier clos. **FERRO 0.3.11**, 34 modules inchangés.

## Qualification et prochaine action

Référence active : `docs/reprise/rapports/12E-2026-11-19/qualification-finale.json`.
Les preuves après bornage des manœuvres sont dans le sous-dossier `cloture/` ; les rapports à la racine
du dossier 12E sont le passage récupéré avant ce dernier correctif, conservé pour la traçabilité.
Ne pas réutiliser leurs anciennes empreintes pour qualifier le build final.
**96/98 suites au premier passage final** : échec traces hérité identique ; décor Haut-Col **194 ms >150 ms**, réserve
performance non levée. Déterminisme p10 **20 scénarios / 1 300 empreintes**, neuf parcours sans anomalie ni stagnant
sans accident ≥15 s ; trois replacements historiques au total. Les 196 empreintes sources/tests/fixtures ont été
vérifiées après récupération, sans relancer de test. Build **14 001 233 octets**, SHA-256
`90afbee41f4d080a7b464572ce5464a9c91c53a560be8458f748229f955135b7`.

Terminer la publication des sources, tests, jeu compilé et preuves, puis enregistrer le reçu distant
`docs/reprise/rapports/12E-2026-11-19/PUBLICATION-0247.json`.
Ensuite, ouvrir **12F — stands/interface/réseau** : remplacement réel des quatre pneus, affichage détaillé,
transmission versionnée de l'usure et stratégie IA pour les courses longues. Les changements de physique
de 12E sont déjà en p10 ; ne pas réécrire la fixture historique p9 ni rouvrir le chantier visuel 12D.

La neige est jouable et la chaussée commune fournit eau, neige au sol et abri ; les tunnels restent secs.
La couverture neigeuse est explicite et statique dans ce lot, sans accumulation ni fonte simulées.
**WebGL reste à valider** sur une machine utilisable ; aucun gain FPS ni déploiement annoncé.

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
Vérifier GitHub et le site séparément : aucune mise en ligne de 0.2.47 n'est déclarée par cette reprise.
