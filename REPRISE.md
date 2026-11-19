# BITUME — reprise courte

## Lot actif — 19 novembre 2026

**0.2.58 / p14 : cockpit extérieur corrigé, qualification ciblée terminée.**
Branche : `codex/bitume-cockpit-pilotes-20261119`.
Lire `docs/reprise/ETAT.json`, puis `docs/reprise/COCKPIT-PILOTES-2026-11-19.md`.

- Demandes : levier traversant le cockpit et volant trop proche du pilote, joueur comme concurrents.
- Volant avancé de 10 cm ; levier dans l'ouverture, fixé sur une console procédurale ; mains raccordées.
- Saute-vent dégagé, trois niveaux de détail et rétroviseurs conservés ; cadrage intérieur identique.
- **5/5 suites cockpit/voitures, 71 contrôles ; 840 poses sans traversée détectée.**
- Jeu longitudinal jante/buste : environ 169 mm, contre 69 mm sur la 0.2.57.
- Deux builds identiques : `773273ccaeba8ea7395d44f8e6a8b940feb595ddea89a56b393c09cb974704e9`.
- Rapport : `docs/reprise/rapports/COCKPIT-PILOTES-2026-11-19/QUALIFICATION-0258.json`.

## Publication de la base 0.2.57

PR #15 ouverte : démos cinéma et regard arrière, tête corrigée `6527496`.
La CI initiale a révélé un contexte de test incomplet : `cam` manquait dans `nature-integration`.
Le test est corrigé, avec cas nature/retour course et pools J1/J2 ; 3/3 suites ciblées, 27 contrôles.
Code de production et build 0.2.57 inchangés. Nouvelles CI à constater avant fusion.
Dernier main vérifié : 0.2.56, clôture `6ed5606`. Les preuves des livraisons précédentes restent distinctes.

## Clôture à terminer

Publier la 0.2.58, contrôler la CI complète et consigner les commits/fusions réels.
Réserves héritées : traces et temps de création du décor Val-Brûlé ; aucun seuil ni oracle modifié.
Géométrie inspectée dans trois vues par raster logiciel. Jeu complet en navigateur, manette physique et FPS
matériels restent à vérifier ; aucun déploiement du site effectué. Suivi compact, sans nouveaux journaux bruts.

## Ensuite

13B Baïkal : lac, berges, lieux signature, végétation/faune propres et saisons.
Conserver Monaco fidèle, Marseille avec relief, grand circuit montagne distinct et six propositions.
Un sous-lot à la fois ; reprise courte après publication ; aucun push forcé.
