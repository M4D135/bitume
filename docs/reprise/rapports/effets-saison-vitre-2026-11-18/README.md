# Effets saisonniers et vitre — 18 novembre 2026

## Contrats d’intégration

`B.effetsSaison.creer(circuit, decor)` crée un état par décor. Le profil figé
`decor.saison` et les sources `decor.sourcesFeuilles` ne sont jamais modifiés.
`B.effetsSaison.dessiner(etat, tempsAbsolu, contexte, sortie)` ajoute les objets à
la liste réutilisée du jeu et retourne les statistiques réutilisées de la vue.
Le contexte comprend `qualite`, `nuit`, `pluie`, `ventX`, `ventZ`, `pose`, `vue`
et `abri`. `pose` est la position mondiale de la **caméra**, objet `{x,y,z}` ou
tableau ; `vue` vaut 0 ou 1. Les miroirs peuvent soumettre la même sortie.

Le champ facultatif `contexte.neige` est une **intensité finale entre 0 et 1**,
prioritaire sur le profil et indépendante de `pluie`. S’il est absent, la neige
vaut `profil.neige ? pluie : 0`. Cela autorise une mesure météo réelle neigeuse
hors hiver sans reconstruire le décor. Le thème `cote` interdit toujours la
neige 3D. Un arrêt des précipitations laisse le fondu se terminer ; l’abri et
Off coupent immédiatement les objets, puis réamorcent un fondu à la sortie.

`B.vitre.creer(canvas)` crée un état indépendant par Canvas2D transparent.
`B.vitre.mettreAJour(etat, dtSecondes, contexte)` reçoit `qualite`, `actif`,
`abri`, `pluie`, `neige`, `vitesse` (m/s signés acceptés), `ventX`, `ventZ`.
`neige` est ici aussi l’intensité finale ; le jeu transmet la pluie liquide à
zéro si la précipitation est neigeuse. Les champs facultatifs `largeur`,
`hauteur` sont les dimensions CSS du viewport et `dpr` sa densité demandée.
À défaut, le module lit `clientWidth/clientHeight`. Le jeu place chaque canvas
sous le HUD, sans interception de pointeur, et ne l’affiche que pour sa vue.
`effacer(etat)` et `liberer(etat)` sont idempotents. L’état accepte aussi un
Canvas indisponible sans erreur.

`B.faune.creer` honore maintenant `decor.saison.faune` ; `dessiner` accepte
`contexte.activite` facultatif. Un profil à zéro ne prépare aucun habitat et
reste sans faune même si le contexte demande une valeur positive. Les profils
non nuls conservent le fondu de population. L’hiver enneigé de forêt/Haut-Col
vaut zéro ; Port-Sable garde 0,28. Les mesures de distribution du lot 10,
antérieures à cette modulation, restent figées dans le rapport voisin.

## Image, profondeur et abris

Les feuilles sont de petites octaèdres aplaties, aux couleurs orange, cuivre
et or, issues uniquement des couronnes de feuillus conservées par le décor.
Leur chute, rotation et balancement au vent sont continus et déphasés. Les
flocons sont de petites formes 3D dans des cellules mondiales fixes : ils ne
sont pas attachés à l’écran. Le temps absolu est commun aux deux vues ; chacune
possède ses propres objets et tableaux de positions.

Le moteur reçoit des FX transparents avec test de profondeur, sans lumière
ponctuelle, sans overlay 2D ni taille minimale en pixels. Les feuilles fondent
entre 18 et 34 m ; les flocons entre 14 et 24 m. Les fins de chute s’effacent
avant le retour en haut. Aucun de ces objets ne participe aux collisions.

Le masque conservateur exclut les cellules d’eau, le tunnel et ses portails,
ainsi que les grands volumes couverts. Les hauteurs sont préparées et mises
en cache, avec la hauteur de chaussée ; aucun parcours du terrain n’est fait
par particule et par image. Le masquage peut laisser une petite marge sèche
autour d’une rive ou d’un toit. Sous abri, la vitre ne reçoit plus de nouveaux
dépôts ; ceux déjà collés fondent, ruissellent et sèchent normalement.

La vitre dessine seulement quelques contours translucides, traces et petits
amas blancs. Elle ne lit aucun pixel, n’effectue aucune réfraction plein écran
et ne crée aucune texture ni image externe. Les amas fondent en gouttes ;
les gouttes ont des vitesses et trajectoires lentes différentes. Le centre
de l’image reste transparent entre les dépôts, le HUD étant au-dessus.

## Budgets et allocations

| Qualité | Population visée de feuilles | Population visée de flocons | Gouttes sur vitre | Amas de neige sur vitre | DPR maximal vitre |
|---|---:|---:|---:|---:|---:|
| Off | 0 | 0 | 0 | 0 | — |
| Léger | 6 | 24 | 10 | 4 | 1 |
| Moyen | 18 | 72 | 26 | 9 | 1 |
| Haut | 48 | 180 | 56 | 18 | 1,25 |
| Maximum / Extrême | 128 | 480 | 112 | 36 | 1,5 |

Les populations 3D sont des cibles : le fondu entre cellules peut garder
temporairement quelques anciennes particules en plus. Les pools imposent
toujours un maximum de 128 feuilles et 480 flocons par vue, soit 608 si une
neige réelle se superpose à l’automne. Le relevé en mouvement comprend ces
transitions : 29/83/212/307 objets au maximum observé en neige pour
Léger/Moyen/Haut/Maximum. Un changement vers Off est immédiat.

Objets, positions, rotations, couleurs, plans et tables de sélection sont
créés une fois. Le chemin actif n’alloue pas de nouvel objet par image ; les
tests vérifient les références des pools pendant plusieurs milliers d’images.
Une sélection a lieu après un déplacement de 3 m, avec réutilisation des
identités et des cellules. Les slots libres sont classés en 32 groupes par
poids de fondu, en temps linéaire dans la capacité du pool.

La vitre possède 148 emplacements par joueur, une simulation et un dessin
limités à **30 Hz**, et un backing store limité à **2 000 000 pixels**. Le DPR
peut descendre sous 1 sur les très grands écrans pour respecter ce plafond.
La création des effets 3D a pris 3,4–5,7 ms sur les deux scènes du banc, avec
environ 0,84–0,86 Mo de variation du tas après GC pour les deux vues, les
masques, les sources et les caches ; cette mesure mémoire reste indicative.

## Mesures CPU

Le script `mesurer.mjs` conserve 4 000 appels après 2 000 appels de chauffe.
Il utilise les vrais décors, sans herbe affichée, une pose fixe puis un trajet
préparé à 180 km/h avec appel à 60 Hz. La préparation des poses et du décor
est exclue du chronométrage des images. Le trajet neige inclut 922 sélections
de cellules et la traversée du tunnel.

| Effets 3D, Maximum | Objets moyens | Objets maximaux | Médiane CPU | p95 CPU |
|---|---:|---:|---:|---:|
| Feuilles, près des couronnes, immobile | 98,2 | 104 | 0,0088 ms | 0,0126 ms |
| Feuilles, trajet 180 km/h | 0,36 | 13 | 0,0002 ms | 0,0088 ms |
| Neige, caméra immobile | 163,0 | 173 | 0,0296 ms | 0,0432 ms |
| Neige, trajet 180 km/h | 64,6 | 307 | 0,0313 ms | 0,0765 ms |

Les feuilles restent localisées près des arbres, sans remplissage artificiel
du bord de piste. La première version de la recherche de slots mesurait
0,3293 ms de p95 sur le trajet neige ; le classement borné remplace son scan
quadratique. Ce relevé ne constitue pas une mesure de FPS matériel.

Pour la vitre en Maximum, 4 000 appels hôte à 120 Hz produisent 1 000 dessins.
Le banc instrumente les commandes Canvas2D **sans rasterisation** : p95 de
0,0070 ms en pluie et 0,0032 ms en neige, avec respectivement 112 et 71 dépôts
maximaux observés. Ces nombres ne mesurent pas le coût du vrai Canvas2D ni
le rendu GPU du jeu. Le backing store observé est de 1 998 100 pixels.

## Qualification

- `verifications/effets-saison.test.mjs` : **10 contrôles**, dont vrais décors,
  neige météo hors hiver, côte exclue, eau/tunnel/toits/abri, chutes, vent,
  arrêt progressif, 30/120 Hz, deux vues, budgets et pools sur 2 000 images.
- `verifications/vitre.test.mjs` : **8 contrôles**, dont ruissellement,
  fonte/séchage, plafonds, 30 Hz, DPR, deux vues, abri, Off et libération.
- `verifications/faune.test.mjs` : **15 contrôles**, dont profils saisonniers,
  création sans habitat sur neige, modulation progressive et sols réels.
- Revue indépendante de `grass_game` : aucun défaut bloquant relevé sur les
  transitions, abris et vues ; son observation sur la sélection de slots a
  été traitée et mesurée.

Les logs et les SHA256 qualifiés accompagnent `mesures.json`. Pas de navigateur
ni de capture visuelle dans cet environnement ; aucune construction, version
ou référence Git n’a été modifiée par cette sous-tâche.

```sh
node verifications/effets-saison.test.mjs
node verifications/vitre.test.mjs
node verifications/faune.test.mjs
node --expose-gc docs/reprise/rapports/effets-saison-vitre-2026-11-18/mesurer.mjs
```
