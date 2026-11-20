# Monaco 14A — revue des écarts et passages couverts

## But du sous-lot

Après la clôture de la 0.2.61, examiner les observations déjà acquises pour préparer les
mesures de chaussée. La revue couvre tous les écarts supérieurs à un mètre et tous les
points associés aux arêtes OSM `tunnel=yes`, avec leur localisation et leur provenance.
Elle ne transforme pas une altitude de terrain en altitude routière.

## Résultat du croisement indépendant

Les deux jeux de 415 valeurs de terrain produisent **32 écarts absolus > 1 m**. Les arêtes
couvertes touchent **33 points**, extrémités comprises. Leur intersection contient **20 points** :
l'union comporte donc **45 points distincts**, dont **12 écarts hors tunnel** et **13 points
de tunnel sans écart supérieur à un mètre**. L'accord entre produits ne qualifie pas la chaussée.

Les douze points hors tunnel se trouvent aux indices **194–195** près de Mirabeau Bas,
**278–283** aux abords de Tabac et **286–289** dans ce virage, dans l'ordre de reconnaissance
OSM. Les noms sont des repères candidats déjà enregistrés, pas une nouvelle mesure FIA.

Deux ensembles restent séparés : points **206–211** et **219–245**. Les arêtes taguées
sont respectivement **206–210** et **219–244** ; le point terminal n'est pas le début
d'une arête couverte supplémentaire. Les transitions des tags désignent des extrémités
OSM candidates, pas des portails géométriques mesurés. L'intervalle non tagué entre les
deux ensembles n'est pas rempli automatiquement.

Les **17 variations de terrain** déjà signalées par le préparateur portent la revue à
**49 points distincts**. Le seuil de tri de 0,35 ne devient ni une pente de chaussée ni une limite physique.

## Sorties et reproduction

L'outil `tools/examiner-monaco-mesures.py` produit la revue JSON et sa lecture Markdown
dans `docs/references/monaco-2026/`. Il vérifie les sources et l'association des points,
et conserve les empreintes de ses entrées. Le mode `--check` compare sans écriture.

```sh
python3 tools/examiner-monaco-mesures.py
python3 tools/examiner-monaco-mesures.py --check
node --test verifications/monaco-revue.test.mjs verifications/monaco-mesures.test.mjs verifications/monaco-altimetrie.test.mjs verifications/monaco-sources.test.mjs
```

La revue s'ajoute aux acquisitions closes ; elle ne les télécharge pas à nouveau. Les fichiers
OSM, les 830 observations, les registres existants et le HTML autonome restent inchangés.
**35/35 contrôles ciblés réussissent**, dont neuf nouveaux, dans quatre fichiers de tests.
Le contrôle hors réseau retrouve les sorties et les 15 empreintes d'entrée. Dix gardes
de fichiers historiques, version, moteur et HTML restent identiques. Reçu :
`../references/monaco-2026/qualification-revue.json`. Publication encore à constater.

Une sonde WFS IGN supplémentaire, distincte des acquisitions closes, conserve sept objets
de voirie autour du boulevard Louis-II, dont deux voies souterraines distinctes.
Elle fournit une piste de relevé 3D à confronter aux secteurs signalés. Date de mesure et
datum vertical ne sont pas établis ; aucune cote n'entre dans le profil du circuit.
Voir `../references/monaco-2026/PISTE-BDTOPO.md` et le reçu `bdtopo-sonde.json` associé.

## Suite de 14A

Acquérir des observations localisées de la **surface de chaussée**, en commençant par
Mirabeau Bas, les deux passages couverts et Tabac. Pour chaque observation : coordonnées,
source, date de mesure, datum, unité, incertitude et identification explicite de la surface.
Un passage couvert exige une confirmation du niveau de la route et de ses véritables portails.

Les limites de course, largeurs gauche/droite, dévers et lignes FIA restent à mesurer.
Les **415 valeurs de chacun des champs `y`, `leftWidthM`, `rightWidthM` et `bankRadians` restent `null`** ;
`readyForRuntime=false`. La longueur OSM de **3 323,610 m** et son écart FIA de
**−13,390 m** sont conservés sans correction d'échelle. **14A n'est pas clos.**

Jeu livré : **0.2.61 / p14 / FERRO 0.3.15**, huit circuits jouables et dix-sept destinations
prévues. Les réserves historiques et le programme complet restent dans la reprise courte.
Attribution : © les contributeurs d'OpenStreetMap, ODbL 1.0 ; observations IGN, Licence Ouverte 2.0.
