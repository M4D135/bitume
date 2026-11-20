# Marseille — métadonnées locales du terrain

Le 20 novembre 2026, une **nouvelle requête WFS ciblée**, distincte de la grille close du
19 novembre, a acquis quatre emprises de dalles LiDAR HD. Réponse IGN complète :
4 objets sur 4, 7 620 octets ; heure HTTP **17:10:07 UTC**. L’URL et les paramètres,
les en-têtes reçus et le SHA-256 sont conservés dans
[`sources-metadonnees.json`](sources-metadonnees.json) ; la réponse brute se trouve
dans `sources/metadonnees-20261120/lidar-tiles.geojson`.

## Ce qui est maintenant documenté

| Objet WFS | Dalle | Points de la grille dans son emprise |
|---|---|---:|
| `metadata.382027` | `0893-6247` | 515 |
| `metadata.382726` | `0893-6248` | 530 |
| `metadata.382861` | `0892-6248` | 1 618 |
| `metadata.62963` | `0892-6247` | 1 562 |

Les **4 225 points** appartiennent chacun à une seule de ces quatre emprises. Les
rattachements par indices sont publiés dans
[`metadonnees-grille.json`](metadonnees-grille.json). Une méthode indépendante fondée
sur le nombre d’enroulement retrouve les mêmes associations que le test par rayons.

Chaque objet annonce `IGN69`, `LAMB93`, la mission `21LHD7PQ` et un intervalle
d’acquisition **du 26 juin au 17 octobre 2021**. La date d’édition **14 mars 2025**
est conservée séparément. Les chaînes source terminées par `Z` restent intactes.
L’intervalle de vol n’est pas remplacé par un jour de mesure inventé.

## Portée et inconnus

Le rapprochement est **spatial** : il établit l’existence de métadonnées locales,
mais la réponse API close ne donne pas d’identifiant de dalle par échantillon.
Son datum, sa date exacte et son incertitude individuelle restent donc inconnus.
La contradiction entre la bbox du descriptif historique et les valeurs reçues
reste consignée ; sa cause n’est pas établie. Les nouvelles emprises ne permettent
pas de réécrire le descriptif historique comme s’il avait été correct.

Aucune altitude, largeur, pente, valeur de dévers ou position de portail de
chaussée n’est déduite de ce terrain. La grille, ses 14 altitudes négatives et ses
4 225 valeurs restent identiques. Les neuf acquisitions historiques, leur manifeste
et les quatre JSON dérivés sont vérifiés par empreintes. Le cœur EMPRISE garde
le commit `cc004826a506e6979eaaec217748fe85d5cd6ac5` ; les lots 15A/15B restent ouverts.

## Corridor proposé pour la reconnaissance suivante

Une chaîne ouverte de treize polylignes présentes dans le cœur suit les quais du
Vieux-Port. Elle constitue une **proposition de relevé**, sans choix de parcours de
course, de fermeture ou de sens de course. Elle n’ajoute aucune rue.

Indices de `coeur.json#/donnees/rues`, dans l’ordre de reconnaissance :

`970+, 1017−, 1016+, 715+, 719+, 677+, 673+, 668+, 642+, 633+, 631+, 489+, 477+`.

`+` suit l’ordre des points ; `−` l’inverse. La seule inversion concerne la
polyligne 1017, dont `sens` vaut zéro dans la source. Les douze jonctions X/Z
coïncident exactement. Les deux extrémités atteignent le bord `x = −610 m` du
cœur, à des Z différents ; **aucune fermeture n’est acquise**. L’égalité en plan
ne prouve pas la continuité routière, le niveau, la largeur utile ou les dévers.

La source EMPRISE exclut les tunnels : l’absence de tunnel dans cette chaîne ne
constitue pas une preuve d’absence de passage couvert. La prochaine acquisition
doit documenter la surface des chaussées et des quais, leurs limites et les
éventuels niveaux superposés, sans projeter automatiquement les routes sur le MNT.

## Reproduction

```sh
node tools/preparer-marseille-metadonnees.mjs --check
node --test verifications/marseille-metadonnees.test.mjs
```

Le mode sans `--check` régénère uniquement `metadonnees-grille.json`, sans réseau.
Les cinq tests dédiés contrôlent les rattachements avec une méthode indépendante,
les trous/frontières/recouvrements, les valeurs absentes, les empreintes et les
inconnus conservés. Aucun build ni contrôle de course n’est revendiqué.

Sources : **IGN**, métadonnées LiDAR HD WFS du 20 novembre 2026, Licence Ouverte
2.0 ; [fiche officielle MNT LiDAR HD](https://www.data.gouv.fr/datasets/mnt-lidar-hd).
Géographie EMPRISE : **© les contributeurs d’OpenStreetMap**, ODbL 1.0, tuiles
OpenFreeMap et schéma OpenMapTiles. Le MNT décrit le terrain issu des classes sol,
eau et points virtuels ; il ne qualifie pas automatiquement les tabliers et chaussées.
