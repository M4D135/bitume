# P04 — saisons et matières, 20 novembre 2026

## S1 — saisons qualifiées

Sources saisons : `722d732`. Contrôles élargis : `259ed2b`. Correction du
cadrage de contrôle des Cimes : `d93d239`. Branche de sources uniquement :
`codex/bitume-p04-saisons-matieres-20261120`.

Le lot sauvegardé est repris sans l'audio Troll. **Les neuf circuits passent
les quatre saisons** : 108 préparations avec les trois qualités, puis 44 scènes
visuelles représentatives. Sur 104 PNG examinés, 88 sont retenus ; 16 anciennes
vues des Cimes masquées par une autre couronne ont été remplacées. Les six jobs
de capture dédiée réussissent, sans erreur WebGL signalée.

| Circuit | Observation des quatre saisons |
| --- | --- |
| Val-Brûlé | Printemps clair fleuri, été olive, automne doré, caducs nus et sol enneigé en hiver. |
| Port-Sable | Pins persistants conservés ; aucun enneigement hivernal ajouté au climat méridional. |
| Haut-Col | Forêt basse mixte : feuillus colorés puis nus, aiguilles persistantes, neige hivernale. |
| Lande-Noire | Biome volcanique sans forêt inventée ; variations de sol et neige du profil hivernal. |
| Roche-Fauve | Sol ocre aux saisons chaudes et neige du profil existant ; pas d'arbres ajoutés. |
| Brume-de-Jade | Printemps pâle, été vert, automne orange/doré, ramure nue en hiver. |
| Cap-Séquoia | Couronnes persistantes conservées toute l'année, plus pâles sous la neige hivernale. |
| Baïkal | Caducs dorés parmi les persistants en automne ; branches nues et aiguilles conservées en hiver. |
| Route-des-Cimes | Même feuillu dégagé aux quatre saisons en high et low ; roche alpine estivale et neige hivernale. Route et rails restent alignés. |

### Identités et budgets

La comparaison au parent `1c71bb3` conserve **432/432 empreintes** de racines,
obstacles, troncs et géométrie du sol. Aucun des 108 cas n'augmente ses instances
ou triangles préparés, proches ou lointains. Les tests exercent les vrais lots,
avec distinction des troncs lointains et des couronnes.

Les caches de Baïkal et des Cimes passent été → automne → hiver → printemps →
été : une découpe d'herbier, quatre reprises, palettes précédentes intactes et
retour à l'été identique à une reconstruction neuve. Les suites élargies comptent
31 tests réussis, complétés par quatre tests du cadrage Cimes et treize suites
initiales du lot.

Le registre botanique ajoute six formes nues partagées : **269 472 octets**, soit
263,16 Kio de sommets et indices par renderer. Les 3 208 triangles enregistrés
pour ces six formes ne sont pas tous dessinés à chaque image. Un renderer de
rétroviseurs peut dupliquer cette géométrie. Les allocations temporaires JS et
la mémoire du pilote graphique ne sont pas incluses dans cette mesure.

### Preuves et reproduction

- [Reprise du patch](S0-REPRISE.json), [contrôles Node](S1-NODE.json),
  [comparaison des 108 cas](S1-COMPARAISON.json).
- [Inspection initiale, y compris les rejets](S1-CAPTURES-INITIALES.json),
  [reçu visuel final et empreintes des reprises](S1-VISUEL.json).
- [Registre des six formes nues](S1-FORMES-NUES.json), reproductible avec
  `node tools/qualification/mesurer-formes-nues.mjs DEPOT SORTIE.json`.
- [Campagne initiale](https://github.com/M4D135/bitume/actions/runs/44782100015)
  et [reprise Cimes](https://github.com/M4D135/bitume/actions/runs/44784594393).
  Les artefacts complets sont conservés 14 jours par ces jobs ; les empreintes,
  scripts et planches représentatives restent dans le dépôt.

Le même HTML temporaire est utilisé dans les deux campagnes :
`8aeb52151348c92dfef357d11f6d06684ec98a7ab3d7eaed9f8f6a69ee28a784`.
Il provient du constructeur inchangé, sans publication ni réservation de version.

| Planche de contrôle | Contenu |
| --- | --- |
| [Cimes, forêt high](images/S1-CIMES-FORET-HIGH.jpg) | Quatre saisons, sujet dégagé. |
| [Cimes, forêt low](images/S1-CIMES-FORET-LOW.jpg) | Quatre saisons, branches hivernales simplifiées. |
| [Cimes, zone alpine low](images/S1-CIMES-ALPIN-LOW.jpg) | Été et hiver, deux instants chacun. |
| [Port-Sable high](images/S1-PORT-SABLE-HIGH.jpg) | Quatre saisons du climat méridional. |

Ces images sont des preuves de contrôle, pas des textures chargées par le jeu.

### Limites et raccords

L'inspection porte sur des vues fixes de jour sec avec SwiftShader. Elle ne
qualifie ni chaque mètre du circuit ni les performances Xbox/Intel. Le compteur
10 FPS vient de l'horloge RAF commandée à 0,1 s et ne mesure pas le débit matériel.
Les feuillages facettés, la séparation du tronc et du squelette, ainsi que les
grandes facettes du terrain restent visibles ; aucune correction de shader n'est
revendiquée ici.

La CI commune s'arrête sur son garde de reconstruction, car VERSION, SIZE et
dist appartiennent à 00 et ne sont pas livrés par cette branche. La qualification
assemblée reste à 00. Les [raccords 04](../../PARALLELE-2026-11-20/raccordements/04.md)
détaillent aussi la demande à 02 sur l'interpolation du pigment du terrain.
Ni physique p15, ni climat, ni graine, ni cockpit, ni shader FERRO ne sont modifiés.

## M1 — essai de pierre, conservé en option

**L’activation automatique est rejetée**, retrait publié en `b015497`. Le défaut garde la matière 9 ; la
recette 23 reste disponible par `pierresProcedurales: true`, en high seulement.
Il s’agit d’un candidat à reprendre avec 02, pas d’une amélioration graphique
validée pour tous les joueurs.

Le raccord cible 278 pierres à Haut-Col et 682 aux Cimes. Le béton, l’eau, les
fossés et les autres objets restent exclus. Aucun sommet, collision, palette,
masque d’herbe, graine ou donnée climatique ne change. Les 22 tests finaux passent,
y compris l’égalité exacte défaut/false en high aux quatre saisons des deux
montagnes, avec herbiers indépendants. Les six tests finaux de l’outil passent aussi.
[Contrôles initiaux](M1-NODE.json) et
[décision finale, tests et limites](M1-DECISION.json).

| Vue A/B réelle | Résultat de l’inspection |
| --- | --- |
| [Portail sombre de Haut-Col](images/M1-HAUT-COL-PORTAIL.jpg) | Recette 23 plus lisse ; gain de grain/relief non démontré. |
| [Pont des Cimes à environ 109 m](images/M1-CIMES-PONT-DISTANT.jpg) | Effet discret, sans régression visible ; détail fin peu lisible à cette distance. |
| [Pierre éclairée des Cimes à environ 18 m](images/M1-CIMES-ROCHE-ECLAIREE.jpg) | Strates plus lisibles, mais perte de grain fin et pas de gain net de relief. |

Les 24 PNG été/hiver ont été inspectés. Les comparaisons utilisent les recettes
9/23 sur les mêmes objets du même candidat, pas deux builds historiques.
L’HTML est identique entre les deux campagnes :
`d66623243cfadbca3b0c896c76cb46b442e01c820282064dab84e23e243ad935`.

La [première campagne](https://github.com/M4D135/bitume/actions/runs/44786811877)
réussit les comptes et empreintes A/B ; ses temps `draw + finish` sont conservés
comme données brutes **non concluantes**. La
[reprise avec lecture CPU](https://github.com/M4D135/bitume/actions/runs/44788669375)
produit huit images mais échoue sur quatre expirations de mesure à 120 s.
Quatre observations runtime sont complètes ; les quatre seconds PNG sont écrits
avant l’observation interrompue. Aucune série de coût complète n’est disponible,
et aucun gain, absence de surcoût ou FPS matériel n’est revendiqué.

Le nouvel outil conserve l’observation avant de mesurer et limite cette mesure
à 15 s côté Node. Une série incomplète reste explicitement non qualifiée, sans
ratio. Les [preuves initiales](M1-CAPTURES-INITIALES.json), le
[choix physique de la vue éclairée](M1-VUE-ECLAIREE.json) et les échecs restent
conservés pour la reprise, avec les empreintes des images.

À reprendre par 02 : grain intermédiaire et relief normal utile après filtrage,
ainsi que le pigment continu du terrain. À 00 : garder le défaut sûr, intégrer
S1 et reconstruire/qualifier l’assemblage commun. Aucune fusion main ni
publication de build n’est faite par 04.
