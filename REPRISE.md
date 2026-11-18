# BITUME — reprise courte

## État — 18 novembre 2026

- Branche unique `main`, sans push forcé ; publications fréquentes du travail réel.
- **Jeu courant : 0.2.38**, commit de livraison **`baf4ddf`**, sept circuits ; sources/tests/build qualifiés. Production vérifiée identique le 18 novembre à 14 h 47 (Paris).
- Cap-Séquoia, FPS en démo et réglage **Faune** livrés ; reçu : `docs/reprise/rapports/cap-sequoia-2026-11-18/publication.json`.
- Qualification de cette base : **66/66 suites**, 34 modules FERRO 0.3.9 conformes, build reproductible. **WebGL et performances matérielles restent non validés ici** : Chromium bloque au démarrage.

## Nouveau chantier prioritaire

Demande de David : **circuit en Russie**, **Monaco ultra fidèle**, roues bien rondes et plus réalistes, slicks lisses, sculptures pluie/neige et usure progressive visible.

Le plan détaillé est dans **`docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`** ; `PLAN-MAITRE.md` pointe vers ce volet. **Implémentation non commencée.**
Russie : proposition de travail **Baïkal**, tracé original. Monaco : parcours réel de référence **2026**. Deux places de la cible de 16, soit neuf circuits après livraison de cette tranche.

## Reprendre au bon endroit

Lire `docs/reprise/ETAT.json`, puis le plan actif, sections 2 à 7 et 12. **Premier lot de code : 12A**, contrat commun des roues et catalogue des quatre pneus ; créer sa fiche courte avant de modifier le code.
Ordre : roues/pneus/usure → Russie → Monaco. Le relevé de référence Monaco peut être préparé indépendamment.
Conserver les sept IDs/graines, la monoplace, les conditions de l’hôte, les menus manette, les FPS démo, Faune et le lien **m4d135 → BITUME.html**.

## Méthode

Un seul sous-lot actif, sorties bornées, journaux sur disque ; checkpoints utiles puis sources/build qualifiés et reçu.
La physique actuelle est **p9** : visuel seul sans rupture de records ; incrémenter depuis la valeur réelle lors d’un changement de conduite.
FERRO canonique uniquement pour les changements moteur. Vérifier séparément GitHub et la page servie.
