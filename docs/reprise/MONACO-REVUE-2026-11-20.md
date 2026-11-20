# Monaco 14A — revue localisée, 20 novembre 2026

## Sous-lot et base

Suite de la préparation métrique, après livraison close **0.2.61 / p14 / FERRO 0.3.15**.
Base GitHub : `560646cf48fe85befafa80c1cf07cfd29e58fe0c`. Le jeu et le HTML restent identiques.
Les acquisitions OSM/IGN closes sont conservées ; aucune nouvelle course n’est ajoutée.

## Résultats de la revue

Les 32 écarts LiDAR − RGE supérieurs à 1 m en valeur absolue sont tous localisés :
**sept groupes**, avec 25 écarts négatifs et sept positifs. Ils concernent Mirabeau Bas,
le boulevard Louis-II et les quais/Tabac. Le maximum absolu reste **25,23 m**.
Les cinq alertes de pente LiDAR et les douze RGE concernent **17 arêtes distinctes** ;
le seuil de revue du terrain ne devient pas une règle de conduite.

Les tags OSM couvrent **31 arêtes / 33 points**, en deux ensembles de **18,008 m** et
**361,823 m**. Les huit arêtes intermédiaires, **85,190 m**, restent non taguées.
Quatre limites de tags sont référencées comme portails candidats ; aucune n’est mesurée.
Un accord local entre MNT ne prouve pas la chaussée, y compris dans le petit passage couvert.

## Outil, sources et portée

`tools/preparer-monaco-revue.py` produit uniquement `revue-chaussee.json` et
`revue-chaussee.svg` dans `docs/references/monaco-2026/`. Mode `--check` hors réseau,
validation des sources puis reconstruction de la géométrie et des observations brutes.
Les nouveaux fichiers conservent les voies, nœuds, abscisses, référentiels et attributions.

Les périodes de dalle sont conservées séparément des dates individuelles, qui restent
inconnues pour les échantillons du MNT. Le descriptif IGN de juillet 2026 précise l’origine
exogène possible de points et la portée des dates ; un sommet de tunnel peut être classé Sol.
Référence détaillée et pages : `../references/monaco-2026/REVUE-SOURCES-20261120.md`.

Deux nuages COPC sont référencés par les dalles réellement rattachées aux points :
1056_6303 et 1056_6304. Les requêtes bornées sur leurs URL exactes renvoient **HTTP 403** ;
la cause reste non établie. Aucun nuage n’a été acquis. Quatre emprises candidates et un
protocole d’extraction limitée préparent la suite, sans contourner le refus du service.

## Qualification et suite

Le reçu `../references/monaco-2026/qualification-revue.json` consigne les contrôles
ciblés, l’identité des fichiers historiques et du jeu, puis le constat de publication.
La revue indépendante confronte les 830 valeurs aux sources et recalcule les groupes.
La carte et les profils ont été rendus puis inspectés.

**14A complet reste ouvert.** Les altitudes de chaussée, limites, largeurs et dévers ne sont
pas qualifiés ; `readyForRuntime=false`, tous les champs routiers inconnus restent `null`.
Résoudre l’accès direct aux données publiques ou obtenir un relevé autorisé adapté, puis
vérifier les surfaces, portails et limites de course datés. Ne pas refaire la boucle OSM,
forcer sa longueur ni transformer un MNT en profil de chaussée.

Les réserves du jeu restent conservées : 188 ms Val-Brûlé, 154/167 ms Haut-Col pour 150 ms,
terrain clair à diagnostiquer, essais matériels et déploiement ouverts ; catalogue 8/17.
