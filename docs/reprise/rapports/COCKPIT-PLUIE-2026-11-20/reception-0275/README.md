# Réception et publication BITUME 0.2.75

La PR 51 est fusionnée sur main. Le reçu `PUBLICATION-0275.json` identifie le candidat, son HTML, les deux archives CI exactes et les dix PNG originaux.

Les cinq groupes HUD ont réussi avec leurs contrôles de présence, les six seuils inchangés et les 120 pas de chaque pose stabilisée. Les annonces sont activées dans les captures ; le jeu garde **Non** au premier lancement et conserve les choix enregistrés.

Les preuves négatives des versions précédentes restent dans les dossiers voisins. Les fichiers `CANDIDAT-PUBLIE.json` et `PERIMETRE-PREUVES.json` distinguent publication de la branche, qualification exacte du HUD et preuves historiques de pluie/Troll. Aucun PNG ancien n’est présenté comme une capture du nouveau HTML.

## Fichiers conservés

- `hud/` : dix PNG originaux, rapports natifs, identités, métadonnées GitHub et notes des revues visuelles.
- `ci/` : deux reçus, comparaisons exhaustives des 3 988 fichiers et modes, résumés et outils de réception.
- `diagnostic-decor/` : cinq mesures froides et un profil séparé ; réserve de 150 ms toujours ouverte.
- `incident-local/` : arrêt du lanceur Chromium avant rendu ; aucune image locale reçue comme preuve.

Les ZIP et archives de sources, identifiés par leurs digests dans les reçus et disponibles dans les artefacts GitHub cités, ne sont pas recopiés ici. Les chemins `files/qualification/bitume-sources.tar.gz` des reçus désignent leur extraction originale. Le script de mesure du décor est conservé tel qu’exécuté ; pour le rejouer ailleurs, adapter uniquement le chemin `repo` dans une copie et utiliser le commit qualifié.

## Limites et suite

Ces captures vérifient les poses prescrites, pas les performances matérielles ni une course complète. La réserve décor est reproduite une fois sur cinq ; ni sa cause exacte ni un gain d’optimisation ne sont établis. Le prochain petit levier proposé évite les couples d’indices temporaires de `nappesRoute`, avec identité stricte des données et comparaison avant/après à faire par le propriétaire 04.

Aucun seuil réduit, aucune relance destinée à effacer un échec, aucun déploiement du site. La PR 43 et les autres chantiers restent séparés.
