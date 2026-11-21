# Nouveau parcours — sommet du col de Larche → Vinadio

## Périmètre demandé, corrigé pendant la session

Le 21 novembre 2026, David demande d’abord Barcelonnette → col de Larche → Vinadio,
avec le vrai tracé et les vrais reliefs. Il précise ensuite : **faire plus court,
garder l’arrivée à Vinadio et partir du haut du col**. La présente fiche retient
cette dernière décision et remplace le départ de Barcelonnette.

- **Départ :** sommet routier du col de Larche, appelé Colle della Maddalena
  côté italien, près de la frontière. Positionner la ligne sur la vraie chaussée.
- **Arrivée :** Vinadio, sur le corridor routier vérifié ; placer la ligne et sa
  zone de décélération à partir des données, sans inventer une traversée du fort.
- **Sens :** descente vers l’Italie, en suivant la **SS21** jusqu’à Vinadio.
- **Longueur indicative :** **32,2 km** selon Ubaye Tourisme [S1]. La longueur
  livrée sera calculée sur la polyligne et les deux lignes retenues.
- **Échelle :** 1:1 pour les distances et les altitudes. Le raccourcissement
  demandé consiste à enlever la montée française, pas à comprimer la géographie.
- **Type :** parcours ouvert avec une arrivée, et non boucle raccordée à travers
  les montagnes. Identifiant proposé : `larche`, à réserver sans déplacer les
  identifiants ou indices des circuits existants.

Le col est proche de 2 000 m d’altitude [S1]. Les altitudes exactes du départ,
de l’arrivée, le dénivelé cumulé et les pentes restent à mesurer sur les données
retenues. Ne pas transformer une altitude touristique en cote de chaussée.

**État (21/11, soir) : L0 acquis et L1 reconstruit hors ligne** dans
[`docs/references/larche-vinadio-2026/`](../references/larche-vinadio-2026/README.md) :
chaîne OSM SS21 unique (84 voies, aucun trou), DTM 5 m Regione Piemonte (CC BY 4.0)
sur les 1 042 nœuds, contrôle IGN RGE ALTI à la frontière (écart moyen +0,023 m),
**32 249 m en plan** du sommet (1 992,97 m) à Vinadio (889,46 m), sans remise à
l’échelle, 6 tunnels/paravalanches, 16 ponts, 21 épingles. Largeurs, dévers et
radiers d’ouvrages restent `null` (registre `inconnus.json`). Reproduction :
`python3 tools/preparer-larche-vinadio.py --check`, test
`verifications/larche-vinadio-sources.test.mjs`. **Aucun trajet jouable** : L2
(contrat de parcours ouvert) est le prochain lot.

## Sources primaires et usage prévu

Sources consultées le **21 novembre 2026**. Conserver URL, producteur, date de
collecte, version du jeu de données, licence, emprise, système de coordonnées,
référence verticale, résolution, empreinte et commande d’extraction dans le
futur manifeste. Une page consultée n’est pas un paquet géographique acquis.

| Référence | Donnée ou contrôle | Usage et limite |
|---|---|---|
| S1 — [Ubaye Tourisme, itinéraire Larche/Vinadio](https://www.ubaye.com/itineraire/cols-secrets-et-citadelles-larche-vinadio-esischie-et-fauniera/) | Le tronçon 2 donne col de Larche → Vinadio, SS21, 32,2 km ; le parcours touristique complet est une autre boucle | Contrôle d’itinéraire et ordre de grandeur. Le GPX complet proposé sur la page ne doit pas être importé entier ni redistribué sans vérifier ses conditions |
| S2 — [OpenStreetMap : données et licence](https://www.openstreetmap.org/copyright/fr) | Axe routier, connexions, attributs de route, ponts, tunnels, cours d’eau et bâtiments lorsqu’ils sont renseignés | Extraire un instantané des voies de SS21 ; garder les identifiants et versions des objets. Prévoir les attributions et la licence ODbL des données dérivées |
| S3 — [Regione Piemonte, DTM 5 ICE 2009–2011](https://www.geoportale.piemonte.it/geonetwork/auth/api/records/r_piemon:224de2ac-023e-441c-9ae0-ea493b217a8e) | Terrain régional issu du LiDAR, grille de 5 m ; licence CC BY 4.0 indiquée par le producteur | Source principale côté italien. Métadonnées datées du 19/02/2026, acquisition ancienne : vérifier les ouvrages et changements routiers récents séparément |
| S4 — [IGN, RGE ALTI sur data.gouv.fr](https://www.data.gouv.fr/datasets/rge-alti-r) et [catalogue IGN](https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_RGE-ALTI) | Terrain français à 1 m ou 5 m, Licence Ouverte 2.0 | Complément de terrain pour la frontière et les reliefs visibles à l’ouest ; aucune montée française à ajouter au tracé jouable |
| S5 — [Unione Montana Valle Stura, col et lac de la Maddalena](https://www.visitstura.it/sport-e-natura/attrattive-naturalistiche/argentera-colle-e-lago-della-maddalena/) | Repères géographiques du sommet et du lac | Référence de paysage ; pas de photo ou texture importée dans le jeu |

Les licences et crédits doivent accompagner les acquisitions effectivement
retenues. Séparer le jeu de données géographiques du code du jeu. Les photos et
cartes de tourisme servent à la comparaison ; les maillages et matières du
runtime restent construits en code. Ne pas décalquer une carte commerciale.

## L0 — acquérir et figer les sources

1. Réserver un dossier `docs/references/larche-vinadio-2026/` avec un README,
   un manifeste, les droits de réutilisation et un registre des inconnus.
2. Relever les coordonnées WGS84 des deux lignes envisagées et extraire un
   corridor OSM assez large pour vérifier les intersections et ouvrages voisins.
3. Suivre les voies routières de la SS21 entre les deux extrémités ; contrôler
   les connexions, sens, embranchements et portions couvertes. Une trace de
   randonnée ou de vélo voisine n’est pas le tracé de la chaussée.
4. Acquérir les dalles DTM piémontaises nécessaires. Ajouter le terrain français
   visible depuis le sommet et les vues extérieures, sans charger tout un département.
5. Conserver les sources brutes utiles, ou un paquet de référence téléchargeable
   et vérifiable si leur volume est trop grand pour le dépôt. Versionner les
   extraits nécessaires, les scripts, les paramètres et leurs empreintes.

**Sortie L0 :** acquisition reproductible, licences et couverture connues,
extrémités proposées visibles sur une carte de contrôle. Les données absentes
restent explicitement inconnues ; pas de relief aléatoire présenté comme réel.

## L1 — reconstruire le vrai tracé et le profil

- Travailler en coordonnées métriques projetées communes, puis en repère local
  du jeu. Documenter la projection, l’origine et la conversion vers `x/y/z`.
  Garder les coordonnées et altitudes d’origine pour pouvoir vérifier le résultat.
- Choisir un système vertical cohérent. Vérifier les métadonnées de hauteur et
  les transformations nécessaires entre sources ; ne pas souder deux terrains
  en ajoutant à la main une constante non justifiée.
- Construire une polyligne orientée du col à Vinadio, une abscisse curviligne
  monotone, les tangentes et le profil de route. Échantillonner plus finement les
  lacets et raccords ; conserver les rayons réellement observés.
- Séparer l’altitude du **terrain** de celle de la **chaussée** : un MNT ne donne
  pas le tablier d’un pont ni la route sous un tunnel. Utiliser des mesures ou
  sources routières pour ces ouvrages, en conservant incertitude et provenance.
- Renseigner largeur, accotements, murs, glissières et dévers à partir de sources
  vérifiables. OSM peut manquer de largeur ou de dévers : noter les inconnus et
  les hypothèses de reconstruction, sans les publier comme mesures réelles.
- Lisser seulement le bruit de mesure. Conserver les bosses, ruptures de pente,
  lacets et passages caractéristiques ; tracer l’écart avant/après chaque filtre.

**Repères de lecture à vérifier sur la chaussée :** sommet et lac, descente vers
Argentera et Bersezio, secteur de Pontebernardo/Pietraporzio, Sambuco, Pianche,
puis Vinadio. Ce sont des jalons de contrôle du corridor, pas une consigne de
détour par le centre de chaque village. Le fort Albertino sert de repère d’arrivée
lorsque sa visibilité depuis le tracé est confirmée [S1].

**Sortie L1 :** superposition 2D source/reconstruction, profil en long, longueur
mesurée, D+/D−, pentes, liste des ouvrages et carte des zones encore incertaines.
La distance de 32,2 km est un contrôle grossier, jamais un facteur de remise à l’échelle.

## L2 — rendre le moteur de parcours compatible avec une descente ouverte

Le jeu actuel possède des circuits fermés. Auditer tous les retours modulo la
longueur, raccords dernier/premier point et calculs de distance autour de la boucle.

### Raccords identifiés dans le dépôt

| Fichier | Modification à préparer |
|---|---|
| `src/circuit.js`, `creerDepuisTrace()` | Réutiliser les points métriques `{x,y,z,largeurG,largeurD,devers,limiteG,limiteD}` et les tableaux `Float64Array`. Le contrat actuel exige la répétition du premier point à la fin et retourne `pretPourCourse:false` : ajouter une topologie ouverte et les données nécessaires à la course |
| `src/course.js`, `src/conduite.js` | Retirer les hypothèses périodiques pour ce nouveau type seulement ; arrivée, progression, distances entre voitures, IA et replacement |
| `src/decor.js`, `src/solides-physx.js` | Produire route/terrain dans `decor.nappes`, puis reprendre leurs vrais triangles pour les collisions ; ne pas modifier les modules FERRO |
| `src/jeu.js`, `construire.py` | Catalogue, menus, carte, chrono, fantômes, réseau et ordre des modules ; intégration possédée par la coordination |
| Nouveaux `src/larche-vinadio-data.js`, `src/larche-vinadio.js`, `src/larche-vinadio-decor.js` | Données compactes, constructeur déterministe et décor propres au parcours, avec identifiant/graine réservés |
| Nouvel outil `tools/preparer-larche-vinadio.py` | Acquisition/prétraitement reproductible, génération et mode `--check` sans écriture ; s’appuyer sur les outils Monaco/Marseille |

Ces nouveaux chemins sont des destinations proposées, pas des fichiers déjà
créés. Le `s` actuel de BITUME est mesuré **en plan** : distinguer dans les données
et les rapports longueur horizontale et longueur de chaussée en 3D. Les tuiles de
terrain porteront origine, pas, dimensions, altitudes, masque des valeurs absentes
et référence verticale.

`src/route-des-cimes.js` illustre une construction autonome, mais sa fonction
`fermer()` modifie angles/longueurs et ses pentes referment le parcours. Ne pas
utiliser cette fermeture pour fabriquer la descente réelle de la SS21.

1. Ajouter un contrat de parcours ouvert tout en préservant le comportement
   actuel des circuits fermés. Aux extrémités, borner la progression ; ne pas
   téléporter la voiture de Vinadio au col.
2. Prévoir une grille ou un départ individuel sur la chaussée réelle au sommet,
   puis une ligne d’arrivée et une zone de décélération cohérentes à Vinadio.
3. Adapter checkpoints, chrono, classement et fin de course à une seule traversée.
   Le placement automatique après accident doit rester sur un segment déjà
   admissible et ne pas faire sauter un contrôle ni créer un raccourci chronométré.
4. Adapter IA, freinages, dépassements, regard vers l’avant, distances entre
   concurrents et aspiration aux bornes du parcours. Vérifier la distinction
   entre lacets proches dans l’espace mais éloignés sur la route.
5. Adapter carte, aperçu 3D, distance restante, records, fantômes, duo, échanges
   réseau, démos et relance de course. La clé du record inclut l’identifiant,
   le sens, la révision du tracé et la version de physique pertinente.

**Sortie L2 :** petit parcours ouvert technique qualifié sans changer les tracés
existants. Si un changement de conduite est nécessaire, le traiter explicitement
selon la règle de version physique, pas comme un simple ajout de décor.

## L3 — premier secteur réel jouable

Construire d’abord une section contiguë du haut du col jusqu’au premier ensemble
de lacets représentatif ; ses limites sont prises sur les données, sans fabriquer
de raccord de fermeture. Ce secteur est un banc de qualification, pas le parcours
final demandé par David.

Créer le ruban de chaussée et le terrain correspondant depuis le même référentiel.
Comparer profils, déblais/remblais et sommets du paysage aux données. Faire rouler
le joueur et l’IA pour contrôler appuis, contacts, garde au sol, freinage en pente,
glissières et replacement. Les triangles de collision doivent correspondre aux
surfaces visibles ; distinguer clairement sol, tabliers, murs et ouvertures.

**Sortie L3 :** secteur court qualifié dans les six vues, y compris sous la pluie,
avec coût de construction, mémoire et fluidité mesurés.

## L4 — toute la descente et son paysage

- Étendre le corridor jusqu’à Vinadio sans couper de portion réelle. Ajouter
  les vallées, crêtes, versants et cours d’eau à leur bonne place depuis les données.
- Terrain proche fidèle, relief intermédiaire simplifié avec une erreur mesurée,
  silhouettes lointaines issues de la même source. Le bruit procédural apporte
  du grain et de petits détails ; il ne remplace pas les massifs réels.
- Modéliser les ouvrages routiers confirmés : ponts, tunnels/galeries s’ils sont
  présents dans le corridor, soutènements, protections, panneaux et zones bâties.
  Préserver les dimensions roulables et les dégagements.
- Placer les repères vérifiés, dont le lac et les abords de Vinadio. Conserver
  la diversité des villages sans répéter un bâtiment ou une montagne en miroir.
- Distribuer végétation et neige par altitude, pente, exposition et saison avec
  des espèces cohérentes. Préserver les options de qualité et de faune existantes.
- Construire toutes les matières en code ; les données de relief sont des
  données géographiques, pas des textures photographiques.

**Sortie L4 :** parcours complet reconnaissable depuis la route et les vues
extérieures, avec atlas de comparaison des repères et zones d’incertitude restantes.

## L5 — coûts, précision et usage dans le jeu

Environ 32 km exigent une préparation par tronçons et une mémoire bornée. Ne pas
multiplier le coût du circuit actuel par sa longueur ni compter sur une baisse de
qualité générale pour masquer les ralentissements.

- Prétraiter hors navigateur les données lourdes, le profil et les niveaux de
  terrain ; livrer des paquets compacts déterministes, sans appel cartographique
  pendant une course et avec fonctionnement hors connexion.
- Mettre en cache les tronçons proches et anticiper ceux qui arrivent. Mesurer
  l’apparition/disparition des objets et conserver les contributions visibles
  aux miroirs, ombres et caméras de démo.
- Tester la précision des coordonnées et de PhysX loin du point de départ.
  N’ajouter une origine mobile qu’après mesure d’un défaut, puis déplacer tous
  les systèmes concernés de façon cohérente.
- Maintenir la cohérence des intersections proches, tunnels, ponts et lacets
  superposés dans la projection sur la route, les collisions et les replacements.
- Intégrer le choix du parcours, son vrai aperçu 3D, son profil et sa longueur
  mesurée. Préserver les neuf circuits existants et les préparations Monaco/Marseille.

## L6 — critères de réception avant livraison

| Domaine | Preuve exigée |
|---|---|
| Tracé | Ligne continue de la SS21, bon sens, extrémités au sommet et à Vinadio, pas de détour parasite ni fermeture artificielle |
| Fidélité en plan | Comparaison métrique avec les voies sources ; tolérances choisies d’après leur précision, erreurs et corrections consignées |
| Altitudes et terrain | Profil vérifié, datums documentés, pas de marche à la frontière, absence de chaussée plaquée au fond d’un pont ou au-dessus d’un tunnel |
| Reconnaissance | Captures repérées au col/lac, dans les lacets, aux villages et à l’arrivée ; reliefs et vues vérifiés contre les sources |
| Course | Départ, contrôles ordonnés, chrono, arrivée unique, classement et relance ; pas de tour fictif ni retour modulo |
| Physique/IA | Traversée complète, contacts et freinage en pente, collisions, replacement, absence de saut entre deux lacets voisins |
| Interfaces | Six caméras, arrière, portrait, manette, duo, carte et distance restante ; compatibilité des fantômes et du réseau |
| Conditions | Jour/nuit, pluie/neige et quatre saisons ; abris et eau cohérents avec les surfaces |
| Performance | Mémoire CPU/GPU, temps de chargement, allocations, p50/p95/pire et transitions mesurés à scène identique ; petits PC et Xbox Edge à vérifier sur matériel |
| Reproductibilité | Sources et licences, scripts, empreintes, build reproductible, version de tracé explicite et preuve de publication |

Contrôles existants à préserver : `verifications/physx-circuits.test.mjs`,
`verifications/route-des-cimes.test.mjs` et
`verifications/route-des-cimes-decor.test.mjs`. Reprendre les méthodes de
`verifications/monaco-altimetrie.test.mjs` pour provenance, emprises, datum et
valeurs absentes. Ajouter les cas propres au parcours ouvert, notamment le recul
aux extrémités et le franchissement d’arrivée une seule fois.

Finir l’acquisition et la validation du tracé avant de promettre une précision
métrique ou une longueur définitive. La feuille de route prépare le travail pour
la suite ; elle ne certifie pas encore une reproduction géographique livrée.

## Prochaine action et responsabilités

**Prochain petit lot : L0**, acquisition bornée du sommet à Vinadio et proposition
des deux lignes. Rôle 05 pour les données, coordination 00 pour le contrat de
parcours ouvert/catalogue/build, rôle décor pour terrain et repères une fois les
données reçues. Un seul auteur à la fois sur les raccords partagés.

Références de reprise : [feuille de route générale](FEUILLE-DE-ROUTE-2026-11-21.md),
[rôle 05](PARALLELE-2026-11-20/05-CIRCUITS.md) et programme existant. Aucun nouveau
trajet n’est ajouté au catalogue tant que ses données et son parcours ouvert ne
sont pas qualifiés. Aucun déploiement du site dans ce jalon documentaire.
