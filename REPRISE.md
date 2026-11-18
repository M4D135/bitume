# BITUME — reprise courte

## Base publiée — 18 novembre 2026

- Branche unique `main`, sans push forcé ; publications fréquentes du travail réel.
- **0.2.38**, livraison **`baf4ddf`**, sept circuits ; Cap-Séquoia, FPS en démo et **Faune** livrés.
- Production vérifiée identique le 18 novembre à 14 h 47 (Paris) ; reçu `docs/reprise/rapports/cap-sequoia-2026-11-18/publication.json`.
- Qualification de la base : **66/66 suites**, 34 modules FERRO 0.3.9 conformes, build reproductible. WebGL et performances matérielles restent à contrôler : Chromium bloque ici.

## Lot actif — 5B fluidité (18 novembre 2026)

Demande de David du 18/11 : moteur le plus fluide possible, aucun accroc en jeu, précache en début de niveau, 30/60/120 images par seconde tenues. **Ce lot passe avant 12A.** Fiche : `docs/reprise/05B-FLUIDITE.md` ; mesures : `docs/reprise/rapports/fluidite-2026-11-18/MESURES-BASE.md` ; cartes du code : `…/cartes/`.
Constats mesurés sur le M5 : une image sur quatre ratée en Fine (rétroviseurs), 3,6 M de triangles d'arbres sur 4,2 M, première image du départ de 150 à 480 ms, qualité Auto calée sur 60 Hz, détection qui choisit « Légère ».
En cours : vague 1 dans `~/Projects/bitume-wt/<lot>` (branches locales `fluidite/<lot>`) et moteur FERRO 0.3.10 dans `~/Projects/ferro`. Rien n'est fusionné dans les sources du jeu. Suite : intégrer, installer le moteur, vague 2 dans `jeu.js`, mesurer avant/après, publier.

## Demandes du 18 novembre au soir et ordre de travail

Mots exacts de David dans `AGENTS.md` (dernière section). Ordre retenu, dicté par les fichiers partagés :
1. **5B fluidité** (en cours) : intégrer, mesurer, publier.
2. **Moteur** : pluie et neige sur l'écran (lot 19), puis lumière, ombres et eau (lot 21), dans FERRO après la 0.3.10.
3. **17 conduite** (physique `p10`), **18 public** en humains d'EMPRISE, **20 échappements** (flammes et pétarades).
4. Reprise de la master liste : **12A** roues et pneus, puis Russie, Monaco, Marseille.
Fait : **0.2.39** en ligne (`8bd3d86`), plus de vibration de manette dans les menus.
Études lancées le 18/11 au soir dans `~/Projects/bitume-wt/{conduite,public,vitre,son,echappement,photo}` (branches locales `conduite/etude`, `etude/*`) : elles rendent un plan, un prototype et des captures par lot, rien n'est fusionné.

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
