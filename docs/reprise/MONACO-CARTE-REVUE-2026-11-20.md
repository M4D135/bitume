# Monaco 14A — complément cartographique, 20 novembre 2026

## Base commune préservée

La PR #26 est fusionnée : `ed32c88e0878e57cd5e64476360047d2354f4816`.
Sa CI réussit 144/144 suites ; archive et 3 319 sources vérifiées. Elle apporte la revue
`revue-mesures.json/.md`, ses neuf contrôles et une sonde routière BD TOPO de sept objets.
La clôture documentaire #28 est également fusionnée. Ces travaux restent intacts. La PR #27, préparée en parallèle, est fermée comme redondante ;
son apport distinct est repris ici, avec une suite et un reçu séparés.

## Apport du complément

`tools/preparer-monaco-revue.py` reconstruit la géométrie OSM et les observations depuis
leurs sources figées, vérifie 18 entrées historiques et produit `revue-chaussee.json/.svg`.
La carte et les profils localisent les **32 écarts >1 m dans sept groupes**, les **17 arêtes
de pente terrain à relire**, deux ensembles de tunnel et quatre portails candidats.
Les **85,190 m non tagués** entre ces ensembles sont conservés. La revue de la PR #26
fournit aussi le complément cyclique complet des intervalles non tagués.

Les périodes des deux dalles réellement utilisées sont conservées : 140 points associés
à une date de dalle unique, 275 à une période. `individualMeasurementDate` reste `null` :
les dates recopiées du registre historique ne certifient pas l’âge individuel des cellules MNT.
Le descriptif IGN de juillet 2026 précise la portée des métadonnées et les points exogènes.
Références : `../references/monaco-2026/REVUE-SOURCES-20261120.md`.

Les requêtes bornées sur les deux nuages COPC référencés renvoient HTTP 403, cause non établie.
Aucun nuage acquis. Cette piste complète la sonde BD TOPO déjà reçue ; elle ne la remplace pas.

## Qualification et suite

**8/8 nouveaux contrôles réussis**, génération puis `--check` concordants. Le cas d’un tunnel
atteignant la fermeture est contrôlé ; les mutations des sources et des dérivés sont rejetées.
Revue indépendante et inspection du SVG terminées. La suite de la PR #26 reste distincte :
`monaco-revue.test.mjs` ; nouveau complément : `monaco-revue-cartographie.test.mjs`.
Reçu : `../references/monaco-2026/qualification-revue-cartographie.json`.
La publication/CI de ce complément reste à constater avant de clore ce sous-lot.

Jeu **0.2.61 / p14 / FERRO 0.3.15** et HTML inchangés. Aucune ancienne campagne locale ni
construction relancée. Altitudes de chaussée, largeurs et dévers restent inconnus ; aucun
portail mesuré, `readyForRuntime=false`, Monaco non jouable. **14A complet reste ouvert.**
Suite : acquisition ciblée des objets routiers BD TOPO, comparaison des niveaux et ruptures,
qualification des datums/dates et des limites de course. Ne pas interpoler automatiquement
les lignes 3D candidates ni corriger la longueur OSM par une mise à l’échelle.

Les réserves du jeu restent conservées : 188 ms Val-Brûlé, 154/167 ms Haut-Col pour 150 ms,
terrain clair à diagnostiquer, essais matériels et déploiement ouverts ; catalogue 8/17.
