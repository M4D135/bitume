# BITUME — reprise courte

## Lot actif — 19 novembre 2026

**0.2.59 / p14 : cockpit extérieur unifié, qualification ciblée terminée.**
Branche : `codex/bitume-cockpit-pilotes-20261119`.
Lire `docs/reprise/ETAT.json`, puis `docs/reprise/COCKPIT-PILOTES-2026-11-19.md`.

- Demandes : levier traversant le cockpit et volant trop proche du pilote, joueur comme concurrents.
- Volant avancé de 10 cm ; levier dans l'ouverture, fixé sur une console procédurale ; mains raccordées.
- Saute-vent dégagé, trois niveaux de détail et rétroviseurs conservés ; cadrage intérieur identique.
- **6/6 suites : 71 contrôles cockpit/voitures et registre des formes ; 840 + 150 poses sans traversée détectée.**
- Jeu longitudinal jante/buste : environ 169 mm, contre 69 mm sur la 0.2.57.
- Deux builds identiques : `cb02e2250a2e4a7d06bd0fdea659fce641a016975e224bac2823574888439cd4`.
- Rapport : `docs/reprise/rapports/COCKPIT-PILOTES-2026-11-19/QUALIFICATION-0259.json`.

## Réconciliation des candidats 0.2.58

PR #16 : coque simplifiée ouverte et contrôle de chaque LOD réel. PR #17 : console fixée et tige visible dans chaque LOD.
Les deux apports sont réunis en 0.2.59. Le banc initial de la PR #17 manquait le dessus plein du modèle simplifié ;
le nouveau banc le détecte sur cet ancien candidat et passe sur l’union. Les deux reçus 0.2.58 restent conservés.

## Publication de la base 0.2.57

PR #15 ouverte : démos cinéma et regard arrière, tête corrigée `6527496`.
La CI initiale a révélé un contexte de test incomplet : `cam` manquait dans `nature-integration`.
Le test est corrigé, avec cas nature/retour course et pools J1/J2 ; 3/3 suites ciblées, 27 contrôles.
Code de production et build 0.2.57 inchangés. Nouvelles CI à constater avant fusion.
Dernier main vérifié : 0.2.56, clôture `6ed5606`. Les preuves des livraisons précédentes restent distinctes.

## Clôture à terminer

Publier la réconciliation 0.2.59 dans la PR #17, contrôler sa CI complète puis consigner les fusions réelles.
Réserves héritées : traces et temps de création du décor Val-Brûlé ; aucun seuil ni oracle modifié.
Géométrie inspectée dans trois vues par raster logiciel. Jeu complet en navigateur, manette physique et FPS
matériels restent à vérifier ; aucun déploiement du site effectué. Suivi compact, sans nouveaux journaux bruts.

## Ensuite

13B Baïkal : lac, berges, lieux signature, végétation/faune propres et saisons.
Conserver Monaco fidèle, Marseille avec relief, grand circuit montagne distinct et six propositions.
Un sous-lot à la fois ; reprise courte après publication ; aucun push forcé.
