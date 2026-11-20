# Eau carrosserie : coût au sec

La première version parcourait 192 perles pour chacune des douze voitures à chaque
image, même lorsque leur humidité était déjà nulle. Le correctif termine alors
après mise à jour de l'âge, de la révision et de l'instant partagé. Le dernier pas
de séchage restaure encore attaches, couleur et déplacement. Une prochaine pluie
reprend les mêmes objets, les mêmes graines et le même transport.

## Mesure locale du composant

Cinq séries alternées, 180 images chacune, 60 images de chauffe par météo,
12 modèles réels à 35 m/s. Médianes des p50/p95 des cinq séries, en millisecondes
pour la mise à jour des **douze** carrosseries :

| Source | Météo | p50 ms | p95 ms |
|---|---|---:|---:|
| avant | sec | 1.378154 | 1.702636 |
| avant | pluie | 1.910395 | 2.979851 |
| apres | sec | 0.010816 | 0.012439 |
| apres | pluie | 1.895472 | 2.974333 |

Le parcours mouillé est conservé. Ces mesures concernent le seul composant CPU
sous Node : pas de rendu, pas de physique, pas de FPS jeu ni Xbox/Intel. La charge
de l'hôte partagé n'est pas isolée ; l'ordre avant/après alterne. Préparation des
modèles exclue des intervalles (mesurée séparément dans le JSON, sous le voile).

## Vérification et reproduction

Les quatre tests de `verifications/eau-carrosserie-integration.test.mjs` passent.
Les deux ajouts vérifient l'absence d'accès aux pools d'une carrosserie déjà sèche,
les cas sec/neige/toit, pause et doublon d'instant, puis le séchage complet et une
reprise identique à une carrosserie neuve de même graine. Les identités des objets
sont conservées. Le log est `eau-sec-tests.log`.

`eau-sec-mesures.json` conserve environnement, empreintes et résultats de chaque
série. `eau-sec-correctif.patch` permet de reconstruire la source antérieure à
partir de la source après, en l'appliquant à l'envers sur une **copie temporaire**.
Depuis la racine du dépôt :

```sh
cp src/eau-carrosserie.js /tmp/bitume-eau-avant.js
patch -R /tmp/bitume-eau-avant.js docs/reprise/rapports/COCKPIT-PLUIE-2026-11-20/eau-sec-correctif.patch
node docs/reprise/rapports/COCKPIT-PLUIE-2026-11-20/banc-eau-sec.mjs /tmp/bitume-eau-avant.js src/eau-carrosserie.js /tmp/bitume-eau-mesures.json
```

Aucun changement FERRO, de conduite ou de budget de perles.
