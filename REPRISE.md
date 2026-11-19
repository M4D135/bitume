# BITUME — reprise courte

## Point actif — 19 novembre 2026

Lire `git status`, `docs/reprise/SUIVI-2026-11-19.md` et sa dernière entrée, puis seulement
`docs/reprise/12ABC-CONTRAT-ET-VISUEL-ROUES.md`. Les résultats courants sont dans `docs/reprise/ETAT.json`.

- Branche unique **main**, publications fréquentes, aucun push forcé.
- Base récupérée : **e47fb22**, jeu **0.2.44**, moteur **FERRO 0.3.11**.
- Checkpoint de récupération publié : **8665af0** ; sources 12A/12B/12C sauvegardées, build encore 0.2.44 à ce jalon.
- Lot actif : **12A–12C, contrat commun et visuel des roues**, build **0.2.45** qualifié côté code, réserve WebGL.
- **Safari corrigé, confirmé par David.** Ce chantier reste clos.
- **Physique p9 conservée** : aucun nouveau comportement d'adhérence dans ce lot visuel.
- Catalogue et visuel neige préparés ; choix en course fermé jusqu'au lot physique **12E**.

## Prochaine action précise

Vérifier le reçu de publication 12A–12C, puis ouvrir **12D : usure visible par roue**.
Qualification : **88/90 suites**, deux échecs hérités identiques, **19 scénarios / 1 259 empreintes p9 identiques**,
six suites ciblées réussies après correctif des types invalides ; build reproductible, 34 modules FERRO inchangés.
Le rendu WebGL reste à contrôler sur une machine utilisable (Chromium bloqué par les sockets ici).
Son brouillon récupéré est conservé dans le patch du checkpoint ; il n'est pas intégré au jeu.
Ensuite : **12E** chaussée/adhérence, **12F** stands/interface/réseau, puis Russie, Monaco et Marseille.
Ne pas marquer 0.2.45 livrée avant les contrôles et la vérification de sa publication distante.

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
