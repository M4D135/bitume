# BITUME — reprise courte

## Base publiée — 19 novembre 2026, 4 h 05

- Branche unique `main`, sans push forcé ; publications fréquentes du travail réel.
- **0.2.43** (`8b6c91f`, 19/11 au matin) : correctif Safari, plus d'image principale noire (reçu `docs/reprise/rapports/safari-2026-11-19/publication.json`).
- **0.2.42**, livraison **`52d8bd0`** : ombres (contact sous les voitures, ombres lointaines, habitacle), moteur FERRO **0.3.11**. Reçu `docs/reprise/rapports/photo-ombres-2026-11-18/publication.json`.
- Avant elle, la même nuit : **0.2.41** (détection corrigée, animaux, bords de route, flammes d'échappement, public humain ; reçu `docs/reprise/rapports/publication-0241/publication.json`) et **0.2.40** (lot 5B « fluidité » ; reçu `docs/reprise/rapports/fluidite-2026-11-18/publication.json`).
- Production vérifiée identique par `./deposer.sh`. Qualification : **88/88 suites**, parcours smoke à 7 contrôles.

## En cours — suite du 18 novembre au soir

**Lire `docs/reprise/PILOTAGE-2026-11-18.md`** : il tient l'état de tous les chantiers, des branches locales et des arbres de travail (`~/Projects/bitume-wt`).
Suite : relire les branches `spark/*` du pilote autonome, puis jeu en ligne par invitation, Route-des-Cimes quand son terrain sera fait, reflets et grain (étape 2 du lot 21), conduite p10.
Le Spark d'abord (`tools/spark/LISEZ-MOI.md`) : un pilote autonome mène les lots restants sur des branches `spark/*`, à relire avant toute intégration.

## Demandes du 18 novembre au soir et ordre de travail

Mots exacts de David dans `AGENTS.md` (dernière section). Ordre retenu, dicté par les fichiers partagés :
1. **5B fluidité** : publié en **0.2.40** ; restes dans le pilotage (détection, gel au choix du circuit, Fine sous la pluie).
2. **Moteur** : pluie et neige sur l'écran (lot 19), puis lumière, ombres et eau (lot 21), dans FERRO après la 0.3.10.
3. **17 conduite** (physique `p10`), **18 public** en humains d'EMPRISE, **20 échappements** (flammes et pétarades).
   Puis **23 cockpit** (matières, reflets, relief, netteté ; s'appuie sur le lot 21) et **22 circuits et génération procédurale** (relief, irrégularités de chaussée, aménagements de course, matières, diversité). **24 vibrations de manette** avec la conduite.
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
