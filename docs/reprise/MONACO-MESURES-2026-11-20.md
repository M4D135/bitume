# Monaco 14A — mesures traçables, 20 novembre 2026

## Périmètre

Préparer le relevé métrique de Monaco après la livraison close 0.2.60. Ce sous-lot ajoute
des acquisitions IGN et un import contrôlé hors réseau. Il ne modifie aucun module du jeu,
aucun circuit jouable, la physique p14, le moteur FERRO 0.3.15 ou le HTML autonome.
Le lot 14A complet reste ouvert : les observations de terrain ne constituent pas un relevé de chaussée.

## Acquisitions nouvelles

Les coordonnées exactes des 415 points OSM sont interrogées auprès des deux ressources
`ign_lidar_hd_mnt_multi_wld` et `ign_rge_alti_par_territoires`. Les deux réponses complètes,
les deux descriptifs de ressources et les métadonnées WFS des dalles sont figés avec leurs
URLs, corps de requêtes, dates HTTP, tailles et SHA-256 dans
`docs/references/monaco-2026/sources-mesures.json`.

Les 830 valeurs reçues ont une provenance exploitable pour l'étude du terrain. La résolution
annoncée du LiDAR est 50 cm ; cela n'établit pas l'incertitude de chacun des points de route.
Les cinq dalles renvoyées sur l'emprise indiquent le système vertical IGN69 et des acquisitions
en mai–juin 2021. Le rattachement est spatial : une dalle qui coupe l'emprise ne certifie pas
à elle seule tous les points du circuit. Une plage de dates n'est pas réduite à un jour inventé.

Le registre FIA du 4 novembre 2026 porte la valeur `10` dans sa colonne de largeur de référence
pour Monaco. Ni la station ni l'unité ne sont explicitées dans l'extrait conservé : aucune largeur
gauche/droite n'en est déduite. Les Competition Notes V3 (§30) documentent des modifications
de limites et revêtements en 2026 sans fournir les cotes manquantes. Les relevés IGN de 2021
ne sont donc pas présentés comme une mesure des aménagements de course de 2026.

## Contrats de traitement

- Vérifier les fichiers sources et les six fichiers de géométrie figés avant toute préparation.
- Associer chaque réponse au bon point, dans le bon ordre ; conserver sa mesure France et sa provenance.
- Écarter la sentinelle d'absence de données ainsi qu'une provenance « sans données », même si un nombre est présent.
- Conserver les observations terrain, les observations de chaussée et les estimations comme catégories explicites.
- Exiger un identifiant de source, un localisateur, une unité, une date ou un inconnu explicite, et une incertitude ou `null`.
- Garder les datums inconnus et les contradictions ; ne pas moyenner ni choisir silencieusement une observation.
- Pour les largeurs, exiger le sens du parcours ; pour le dévers, côté droit abaissé = signe positif.
- Une observation de chaussée située dans un tunnel exige une confirmation spécifique de la surface routière.

Le registre annoté reste `readyForRuntime:false`, même si une observation de chaussée synthétique
passe les contrats de validation. Le préparateur ne remplit jamais les champs `y`, `leftWidthM`,
`rightWidthM` ou `bankRadians` des données OSM. Les alertes de divergence entre produits et de
pente du terrain servent à ordonner la revue ; elles ne modifient aucune règle physique.

## Reproduction et preuves

```sh
python3 tools/preparer-monaco-mesures.py
python3 tools/preparer-monaco-mesures.py --check
node --test verifications/monaco-mesures.test.mjs verifications/monaco-altimetrie.test.mjs verifications/monaco-sources.test.mjs
```

Le mode normal écrit uniquement les nouveaux fichiers dérivés du relevé. Le mode `--check`
compare les sorties sans écrire ni accéder au réseau. La préparation OSM historique et ses
trois sorties restent identiques ; l'écart de longueur de −13,390 m n'est pas corrigé artificiellement.
Le reçu du sous-lot consigne les contrôles exécutés, leurs résultats et la publication constatée.
La campagne locale 0.2.60 et son build ne sont pas relancés pour cette préparation documentaire et métrique.

## Résultats de qualification locale

**26 contrôles ciblés réussis sur 26**, répartis entre le registre (12), l'acquisition/traitement (8)
et la reconnaissance OSM historique (6). La reproduction hors réseau retrouve les trois sorties
exactes. Une seconde méthode spatiale (nombre d'enroulement angulaire) retrouve les rattachements
de l'importeur (rayon pair/impair), ainsi que les 830 valeurs et les 415 paires de coordonnées.

Les 415 points occupent deux dalles sur les cinq retournées : 140 dans la première, 275 dans la seconde.
Le bilan conserve 33 points de tunnel, 32 écarts inter-produits supérieurs à 1 m et un écart absolu
maximal de 25,23 m. Les variations de terrain à relire concernent 5 segments LiDAR et 12 segments RGE ;
le seuil de 0,35 sert au tri des observations, pas au réglage d'une pente du circuit.

Les **830 observations restent non éligibles au profil routier**. Le datum/date individuel du RGE
et l'incertitude propre à chaque observation restent inconnus. La vérification d'empreintes est
réalisée par le préparateur (`importProvenance`), le validateur du registre étant une fonction pure.
Reçu détaillé : `../references/monaco-2026/qualification-mesures.json`.

## Publication constatée

[PR #22](https://github.com/M4D135/bitume/pull/22), fusion `f09c7008979103a7d2885f43407614ce58958e85`.
CI PR #22 : **139/139 suites réussies**, aucun échec, archive vérifiée.
Sources archivées identiques à l'arbre qualifié ; HTML 0.2.60 identique.
Reçu : `../references/monaco-2026/PUBLICATION-MESURES-20261120.json`.
Les résultats ciblés locaux et la CI complète sont distingués ; aucun succès n'est déduit d'un autre passage.

## Prochaine étape

Examiner les points où les deux produits diffèrent, les passages couverts et les niveaux superposés.
Acquérir ou établir des observations localisées de chaussée et de limites, avec leur précision et
leur date. Les largeurs, dévers, lignes FIA, portails et limites de course restent à qualifier avant
de raccorder Monaco au catalogue. Aucun accès SIGM restreint, PDF FIA ou texture externe n'est embarqué.

Références et attribution : sources IGN sous Licence Ouverte 2.0 ; coordonnées et sélection OSM
sous ODbL 1.0, © les contributeurs d'OpenStreetMap. Les documents FIA servent de références factuelles.
