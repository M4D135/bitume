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

## M1 — premier lot de pierres proches

Sources publiées en `26e7c56` après clôture de S1 : raccord ciblé de la recette
pierre 23 existante sur les rochers et ouvrages de montagne, en qualité high
seulement. [Le reçu Node](M1-NODE.json) conserve les invariants et les comptes
exacts. Les captures A/B et leur coût doivent encore être examinés avant de
conclure ce lot.
