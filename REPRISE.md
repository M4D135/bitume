# BITUME — reprise courte

## État actuel — 18 novembre 2026

- Branche : `main`. Base vérifiée : `b094dc4d25bf9a16d0c21044226d29879ab93dab` (0.2.28).
- Lot repris : **0.2.29**, herbe plus dense et choix séparés anticrénelage, ombres, végétation.
- Moteur **FERRO 0.3.6 publié** : `7d7f1018db33632ae448e6fd6e0b4f6b6f8fe5d1`.
- **Sources et build 0.2.29 publiés** : `40b31d582e434b8d87379c360648997e940f6d64`. Reçus dans `docs/reprise/ETAT.json`.
- Preuves existantes : 46/46 suites jeu ; 136 contrôles moteur réussis et 1 TODO historique.
- Reprise : 4 suites ciblées, verrou 34/34, build identique. Voir `publication-validation.json` dans le dossier de preuves.
- Limite : image du build final et performances GPU réelles non validées.
- Déploiement 0.2.29 autorisé, non exécuté ici : accès Mac/amiga indisponible. Production revérifiée dans cette reprise : 0.2.28.

## Prochain petit lot

Depuis le Mac : suivre la fiche **07-OPTIONS-VEGETATION.md**, tester les trois réglages et les densités en solo/à deux, puis `./deposer.sh` et comparer l'empreinte servie.

## Méthode pour ne pas remplir le contexte

1. Lire ce fichier, `docs/reprise/ETAT.json` et les consignes applicables. Vérifier la tête distante avant toute écriture.
2. Lire seulement la fiche du lot actif et les extraits de source utiles. Ne pas charger tout l'historique ni `dist/bitume.html` dans la conversation.
3. Un lot borné à la fois ; résultat complet des outils conservé sur disque, résumé court dans le chat.
4. Après qualification : commit/push sans forcer, vérifier la tête, actualiser ce point court. Ne jamais annoncer un déploiement sur la seule preuve du push.

Fiche : `docs/reprise/07-OPTIONS-VEGETATION.md`. Preuves : `docs/reprise/rapports/options-vegetation-2026-11-18/`.
Historique conservé dans `docs/reprise/archives/` ; l'ouvrir seulement pour répondre à une question précise.
