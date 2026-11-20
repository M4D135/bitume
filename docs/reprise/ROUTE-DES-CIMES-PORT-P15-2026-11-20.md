# Route-des-Cimes — tracé et première preuve p15

## Source et identité

Circuit **distinct de Haut-Col et du Baïkal**, identifiant `route-des-cimes`, graine **181**.
Les huit circuits existants restent identiques au bit près et dans le même ordre.
Aucun ajout au catalogue dans ce lot. Deux tours conseillés à l’intégration.

La partition et le constructeur de l’étude sont récupérés dans `tools/lieux-partitions.mjs`
et `tools/lieux-trace.mjs`, base `f41614e`. Les 78 copies locales de la partition ont toutes
l’empreinte `4e6ef531f90ee49518cd92ffe171297252534d723072c60863158b9fbeefa279`.
Les objets historiques `d30ff56` et `df14675`, `src/partitions.js` et `src/lieux.js` ne sont
pas retrouvés. Cette réserve n’est pas une affirmation de perte sur le poste d’origine.

Le plan utilisateur `4908D265-7549-4C8F-A002-8CA343A6EF90.png` présente Route-des-Cimes
à 9,70 km et 270 m. `7D874AF1-E839-4EC0-8626-2152AFE2408F.png` et
`5D16C74C-6461-486E-8034-C3AE2E2C6917.png` présentent l’étude précédente, encore nommée
Haut-Col, à 9,62 km et 271 m. Les vitesses p9/p10 de ces planches ne sont pas un oracle p15.

## Reconstruction déclarée

Le témoin historique conserve exactement ses positions et son profil. La reconstruction
est une nouvelle conception depuis cette étude et l’objectif utilisateur ; **elle ne
revendique pas l’identité du commit historique final**. Trois modifications explicites :

- premier palier du Mur à 22 % : 110 → 150 m ;
- bascule haute à 7 % : 70 → 100 m ;
- première branche des Lacets : 6,5 → 3 % sur 320 m.

La fermeture ajuste les droites désignées de l’étude, sans homothétie globale. Le solveur
conserve un résidu de 4,773 cm en plan avant répartition périodique et 0,000478° en cap.
Le circuit fourni aux lecteurs est fermé en position, cap et altitude. Son pas métrique
est conservé, sans arrondir artificiellement sa longueur à un multiple de deux mètres.

| Mesure | Témoin historique | Reconstruction |
|---|---:|---:|
| Longueur en plan | 9 618,689 m | **9 697,529 m** |
| Amplitude altimétrique | 270,580 m | **270,280 m** |
| Pentes extrêmes | −10 à +30 % | **−10 à +30 %** |
| Longueur ≥20 % | 290,021 m | **329,984 m** |
| Rayon minimal | 32 m | **32 m** |
| Passages couverts | 3 | **3, soit 774,720 m** |
| Pont | 130 m | **130 m** |

Les trois épingles ont les rayons et angles 32 m/−180°, 32 m/+180°, 34 m/−180°.
Les sept lieux se situent aux kilomètres 0,8 ; 2,3 ; 2,9 ; 4,6 ; 5,5 ; 7,9 ; 8,6,
conformément aux repères arrondis du plan final reçu.

## Interface pour l’intégration

Charger `route-des-cimes.js` après `circuit.js`. Puis :

```js
const c = BITUME.circuit.creer(181, { partition: 'route-des-cimes' });
const temoin = BITUME.routeDesCimes.creer({ etude: true });
```

`c.couverts` porte trois objets `{id,type,nom,debut,fin,mur,hauteur,ouvert?}`.
`c.tunnel` est le premier objet de cette liste. `dansCouvert(c,s,marge)` rend l’objet ou
`null`, sans allocation ; `dansTunnel` rend le booléen pour les deux tunnels. La galerie
ouverte à gauche est à distinguer dans l’éclairage et les caméras.
`c.ponts`, `c.bords` et `c.lieux` conservent les plages métriques nommées.
`c.pretPourCourse=false` et `provenance.qualificationCatalogue=false` restent explicites.

Les consignes IA sont recalculées par les fonctions de la base p15. Une garde des crêtes
et un freinage anticipé tenant compte de la pente les bornent pour cette seule partition.
Aucune force de conduite, masse, puissance ou règle de records n’est modifiée.

## Vérifications et portée de la preuve

`verifications/route-des-cimes.test.mjs` : **8/8**. Source témoin, reconstruction, fermeture,
séparation des branches ≥60 m, épingles, ouvrages, déterminisme, lecteurs au pas métrique,
limites et empreintes des huit anciens circuits contrôlés.
Les suites `circuit`, `trace-explicite` et `tunnel` passent également.

`tools/qualification/route-des-cimes-physx.mjs` exécute les véritables triangles du décor
et le WASM PhysX. Première exécution au sec, une voiture : **10 197,742 m en 203,367 s**
simulées, zéro replacement, zéro appel de correction de pose/vitesse, 2 034 sondes de sol
sans absence ni traversée, aucune perte complète d’appui ; écart latéral maximal 4,889 m.
La marge caisse/sol visible mesurée va de −4,60 à +3,79 cm.

Cette première preuve utilise une copie temporaire du décor avec le seul arrondi de
l’indice des anciens repères de freinage. Sans `Math.round(entree-metres/c.pas)`, six
solides possèdent des coordonnées NaN car le nouveau pas métrique n’est pas exactement 2.
Le reçu conserve le chemin et l’empreinte de ce candidat. L’intégration partagée doit
reprendre ce correctif et relancer la preuve sur ses sources réelles.

Le décor de cette preuve ne construit que le premier tunnel. Passer les trois plages
n’est **pas** une preuve de galerie, de second tunnel ou d’arche effectivement construits.
Le pont, la gorge, les lieux, les couverts multiples et leur intégration visuelle/physique
font l’objet des sous-lots suivants. Aucun FPS matériel ni rendu final n’est qualifié ici.

Reçus : `rapports/ROUTE-DES-CIMES-2026-11-20/geometrie.json` et
`rapports/ROUTE-DES-CIMES-2026-11-20/physx-seul-preintegration.json`.


## Raccord de catalogue préparé le 20 novembre

Le constructeur et le neuvième élément du catalogue sont raccordés dans un candidat
séparé de la livraison démos/météo. Baïkal reste à l’index 7, Route-des-Cimes à l’index 8.
Le build charge le module après `circuit.js` ; le jeu transmet explicitement `partition`.
Le contrôle appelle la vraie fonction `circuit(i)` du jeu et vérifie qu’elle retourne
le tracé métrique de 9 697,529 m, et non un circuit aléatoire de graine 181.
**9/9 contrôles ciblés**. Aucune reconstruction ni incrémentation de version dans ce checkpoint.
L’intégration n’est pas encore qualifiée : le décor doit construire les trois couverts et
les preuves PhysX doivent alors être refaites sur les fichiers versionnés.


### Lieux spécifiques préparés

`route-des-cimes-decor.js` prépare une gorge creusée sous le pont, une arche réellement
ouverte (44 voussoirs sur 130 m), les corniches et un refuge au col. Le sol, les formes
et les détails restent procéduraux ; la silhouette du pont n’est pas un bloc plein.
Les raccords du décor et leur qualification sont encore en cours dans ce checkpoint.
Le lac du col, la cascade et l’enrichissement complet des sept lieux ne sont pas déclarés
terminés par ces premiers ouvrages. Le contrôle natif des stands inclut désormais
Route-des-Cimes dans les trois conditions (sec, pluie et neige).
