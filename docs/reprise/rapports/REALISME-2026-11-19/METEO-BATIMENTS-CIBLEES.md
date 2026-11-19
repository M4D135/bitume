# Pluie, neige, bâtiments et stands — reçu ciblé

Date : 19 novembre 2026. Sources intégrées dans le candidat de continuation, avant construction et
qualification complète. Ce reçu ne ferme ni la livraison ni les réserves de la 0.2.59.

| Sous-lot | Commit de préparation | Commit intégré |
|---|---|---|
| Vitre pluie/neige | `997ffb00d64cc0d440735d63a0e5a6bd4e31a602` | `65b51c483007cceb48bba2f1bf276784558e87ea` |
| Bâtiments et stands | `42f352424b81941dc04a5d88fd20138a8c9956d1` | `c84dc3c8daefa5c34dc0d79cdc27914e5863300f` |

## Vitre

Les gouttes de tailles variées fusionnent, ruissellent et laissent des traînées arrondies. Les amas de
neige gardent une empreinte humide, perdent leur cœur blanc puis fondent en eau. La vitesse évacue les
dépôts et réduit l'adhésion des nouveaux impacts. Les contours, positions et temps de vie varient par
graine ; les deux joueurs utilisent des graines distinctes.

Le curseur « Gouttes sur l'écran » conserve sa plage 0–2, sa valeur mémorisée, sa normalisation et sa
navigation à la manette. Les caméras extérieures atténuent l'effet ; les glaces sont composées au-dessus
des toiles de vitre. La pause fige les dépôts. Désactivation, palier nul et intensité nulle effacent
l'effet, y compris à temps nul. Chaque joueur possède son état et sa toile.

Calcul borné : 112 gouttes et 36 amas de neige au maximum, traces préallouées, simulation à 30 Hz et
interpolation entre les pas, plafond de 2 millions de pixels par toile. Le palier réduit les populations
et la définition ; une remontée de définition attend la séance suivante pour éviter de réallouer en course.

Validation ciblée effectuée avant intégration : **7 suites, 86 contrôles réussis**.

| Suite | Contrôles |
|---|---:|
| `vitre.test.mjs` | 8 |
| `vitre-cadence.test.mjs` | 10 |
| `vitre-meteo.test.mjs` | 15 |
| `vitre-integration.test.mjs` | 6 |
| `options-image.test.mjs` | 11 |
| `navigation-menu.test.mjs` | 11 |
| `meteo-toile.test.mjs` | 25 |

Les contrôles portent notamment sur la fusion, la fonte, l'évacuation, les cadences, les pools, la pause,
les réglages et l'indépendance des joueurs. Deux anciennes attentes de taille/durée de goutte ont été
adaptées aux fusions ; le test de mouvement continu isole une goutte pour ne pas confondre mouvement
et disparition par fusion. Le raster logiciel des commandes Canvas2D a été inspecté sur un fond de
contraste. Il ne simule pas le rendu complet du jeu. L'effet de lentille est peint : aucune réfraction
réelle du décor ni lecture du framebuffer n'est revendiquée.

## Bâtiments et stands

Les stands comportent six travées par module de 60 m : garages creusés, cloisons, piliers, étage vitré,
rideaux de hauteurs variées, auvents courbes, chéneaux et mobilier. Les maisons et postes reçoivent
pignons, ouvrants, volets, gouttières, porches, marches et cheminées. Le hasard local ne consomme pas
celui du décor. Le sens des pans de toiture et la sortie de cheminée du Baïkal ont aussi été corrigés.

Les repères de service suivent les bornes de la voie existante. Son muret, son passage et ses règles
PhysX restent conservés. Les garages de 12 m de profondeur forment un décor d'atelier derrière ce
muret ; ils n'ajoutent ni une nouvelle aire de réparation praticable ni une animation de mécaniciens.
Les contrôles vérifient entrée, arrêt et sortie des huit circuits, ainsi que les vrais triangles solides.

Les petits détails des maisons ont des lots séparés avec bascule à 180 m ; les stands suivent la bascule
du décor à 520 m. Murs et toitures restent présents au loin, sans nouvelle coupure de portée.
Les volumes physiques sont identiques entre les qualités ; seuls les accessoires visuels s'allègent.

Validation ciblée finale : **7 suites, 114 contrôles réussis**, sous Node `v24.22.3`.

| Suite | Contrôles |
|---|---:|
| `batiments-stands.test.mjs` | 23 |
| `baikal-decor.test.mjs` | 8 |
| `solides-physx-geometrie.test.mjs` | 42 |
| `physx-stands.test.mjs` | 11 |
| `decor-obstacles.test.mjs` | 3 |
| `decor-identite.test.mjs` | 9 |
| `decor.test.mjs` | 18 |

Aucun seuil ni empreinte de référence du décor n'a été changé. L'oracle historique utilise explicitement
`batiments: false` ; le nouveau banc contrôle séparément l'architecture et l'identité de la piste, du
terrain, des arbres et de la zone de service. Trois cadrages ont été inspectés par raster CPU à partir
des vrais triangles FERRO : stands, façades des garages, maisons. Aucun gain FPS matériel n'est affirmé.

## Relecture d'intégration et limites

La lecture du candidat réunissant ces commits et FERRO `0.3.15` n'a trouvé aucun défaut grossier de
chargement des modules, de séparation des toiles, de pause, de composition des rétroviseurs ou de LOD
des bâtiments. Les 34 fichiers du verrou FERRO correspondent à leurs empreintes. L'adaptateur des
nouvelles matières du cockpit reste un travail distinct en cours au moment de cette lecture.

La fondation `B.circuit.creerDepuisTrace` reste explicitement `pretPourCourse: false`, hors catalogue :
elle n'annonce ni Monaco jouable, ni prise en charge complète des largeurs variables par la course.

Ce reçu rassemble les qualifications ciblées de préparation ; elles n'ont pas été relancées pendant
les modifications concurrentes des bras. La qualification complète locale est préparée séparément.
La CI GitHub est bloquée par la limite de facturation signalée pour la session : une qualification
locale remplace cette exécution serveur, sans être présentée comme une réussite de la CI GitHub.
Le jeu complet en WebGL, la manette physique et les FPS matériels restent à vérifier.
