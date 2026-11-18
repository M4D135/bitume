# BITUME — reprise courte

## Base publiée — 18 novembre 2026

- Branche unique `main`, sans push forcé ; publications fréquentes du travail réel.
- **0.2.38**, livraison **`baf4ddf`**, sept circuits ; Cap-Séquoia, FPS en démo et **Faune** livrés.
- Production vérifiée identique le 18 novembre à 14 h 47 (Paris) ; reçu `docs/reprise/rapports/cap-sequoia-2026-11-18/publication.json`.
- Qualification de la base : **66/66 suites**, 34 modules FERRO 0.3.9 conformes, build reproductible. WebGL et performances matérielles restent à contrôler : Chromium bloque ici.

## Passation Claude Fable

**Entrée : `MASTER-LISTE-CLAUDE-FABLE.md`.** Catalogue complet : **7 livrés + Russie + Monaco + Spéciale Marseille + 6 propositions = 16**.
Demandes : roues rondes/réalistes ; slicks lisses, sculptures intermédiaire/pluie/neige ; usure progressive ; Russie ; Monaco ultra fidèle ; **Marseille depuis EMPRISE avec ajout de relief**.

**Implémentation non commencée. Premier lot de code : 12A**, contrat commun des roues et catalogue des quatre pneus. Lire `ETAT.json`, la master liste, puis la section utile du plan détaillé et créer la fiche courte du sous-lot.

- Plan roues/Russie/Monaco : `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`.
- Plan Marseille : `docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md`.
- Source Marseille : **M4D135/emprise 0.6.8**, commit **`cc004826a506e6979eaaec217748fe85d5cd6ac5`**. Centre plat, relief périphérique synthétique ; préparer un MNT mesuré et des raccords cohérents.
- Ordre : roues/pneus/usure → Russie → Monaco → Marseille → six propositions restantes.

## Méthode

Un seul sous-lot actif ; sorties bornées, preuves sur disque, checkpoint réel puis sources/build qualifiés et reçu.
Physique actuelle **p9** ; visuel seul sans rupture de records. FERRO canonique pour les changements moteur.
Conserver sept IDs/graines, monoplace, conditions de l’hôte, menus manette, FPS démo, Faune et téléchargement **m4d135 → BITUME.html**. Vérifier séparément GitHub et le site servi.
