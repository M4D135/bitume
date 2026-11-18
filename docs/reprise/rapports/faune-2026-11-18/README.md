# Faune des prairies — qualification du lot 09

Le module `src/faune.js` fournit `B.faune.creer(circuit, decor)` puis
`B.faune.dessiner(etat, tempsEnSecondes, contexte, sortie)`.
Le contexte contient `qualite` (`off`, `low`, `medium`, `high` ou `ultra`), `nuit` et
`pluie` entre 0 et 1, `pose` et `vue` (0 ou 1). La sortie reçoit des objets 3D réutilisés.
Le résultat renvoie les
compteurs réutilisés `abeilles`, `insectes`, `lucioles`, `objets`, `habitats`, `requetes`.
Un seul état est créé par session ; les vues possèdent des pools distincts. Le temps
absolu commun évite toute accélération entre J1, J2 et les miroirs.

## Habitats et image

L'échantillonnage du circuit et `decor.surfaceHerbe` préparent au plus 1 536 habitats.
Les mêmes habitats existent si la végétation est désactivée. Les trajectoires locales
et leur altitude sont contrôlées sur les triangles herbeux dessinés : chaussée, eau,
rochers, bâtiments, paddock et tunnel restent exclus. Les petites scènes sans axe de
circuit peuvent fournir des objets `groundCover` ou les anciennes formes d'herbe.
Les 64 sondes de chaque orbite ne servent qu'à la création ; aucune requête au terrain
n'est faite au dessin. Le hasard propre au module ne consomme pas celui de la course.

Les abeilles ont trois volumes de corps et deux ailes battantes ; les autres insectes
combinent papillons et libellules. Ils utilisent les huit habitats les plus proches.
Les lucioles, exclusivement pour le thème montagne de Haut-Col, occupent jusqu'à
48 habitats et plusieurs hauteurs. Chaque luciole comprend un cœur émissif et un
petit volume translucide. La taille reste exprimée en mètres : cœur inférieur à
2 cm, halo inférieur à 14 cm, aucune amplification selon la distance à l'écran.
Le moteur conserve le test de profondeur des effets ; les halos n'écrivent pas la
profondeur et utilisent son mélange alpha existant. Aucune lumière ponctuelle ni
promesse de mélange additif. L'occlusion finale en image n'a pas été qualifiée ici.

## Budgets par vue

| Qualité | Abeilles | Autres insectes | Objets de jour | Lucioles de nuit | Objets de nuit |
|---|---:|---:|---:|---:|---:|
| Off | 0 | 0 | 0 | 0 | 0 |
| Léger | 2 | 0 | 10 | 6 | 12 |
| Moyen | 5 | 3 | 34 | 16 | 32 |
| Haut | 12 | 8 | 84 | 64 | 128 |
| Maximum | 32 | 16 | 208 | 256 | 512 |

Les objets et leurs tableaux sont créés une seule fois : 720 objets de capacité par
vue pour les trois espèces, avec au plus 512 soumis simultanément. Le crépuscule,
la pluie, la distance et les changements d'habitat modulent les apparitions. Off
interrompt immédiatement les sélections et animations. Les affectations d'identité
ne sont recalculées qu'au changement de population entière ou de sélection ; un
fondu fractionnaire ne refait pas la table d'affectation à chaque image.

## Mesures conservées

`node verifications/faune.test.mjs` : **12 contrôles réussis**, dont déterminisme,
réutilisation sur 2 000 images, deux vues, animation à 30/120 Hz, transitions,
montagne seulement, limites de taille et construction des trois circuits réels
avec végétation off. Résultat complet dans `tests.log`.

`mesurer.mjs` mesure exclusivement le CPU Node du module. Après 240 appels de chauffe,
3 000 appels sont chronométrés par palier et par ambiance, sur un décor réel de
Haut-Col. Le rapport détaillé est `mesures.json`. Ce banc ne soumet aucune géométrie
à un GPU et ne mesure ni les FPS matériels, ni les coûts de rendu ou de tri des effets.

| Mesure CPU | p50 | p95 |
|---|---:|---:|
| Maximum jour, 208 objets | 0,012 ms | 0,017 ms |
| Maximum nuit, 512 objets | 0,055 ms | 0,095 ms |
| Haut nuit, 128 objets | 0,013 ms | 0,028 ms |
| Off nuit, 0 objet | 0,0001 ms | 0,0001 ms |

Les trois circuits produisent chacun 1 536 habitats. Aux 24 poses examinées, le plus
proche est à 8,4–9,1 m de l'axe ; pratiquement toutes les 32 abeilles Maximum sont à
moins de 15 m. Le test automatique exige au moins 24 corps proches et contrôle le sol
réel sous tous les objets. La création avec compilation paresseuse du sol comprise
prend 0,86–1,31 s sur cette exécution ; elle est réalisée une seule fois par session.
Les timings sont ceux de cet environnement partagé et ne constituent pas une limite
de performance matérielle. Commande de reproduction :

```sh
node docs/reprise/rapports/faune-2026-11-18/mesurer.mjs
```
