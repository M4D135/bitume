# Plan des correctifs visuels — 20 novembre 2026

## Point de départ : consolidation publiée avant ce plan

Au point de départ, la 0.2.66 est livrée sur `main` : physique **p15**, FERRO **0.3.15**, neuf circuits.
La PR #38 a été fusionnée, puis la consolidation `9f2246df61c6503ea8fa0f71a28813b15b17f51c`
a réuni l’historique des 50 références inventoriées. Les 15 têtes auparavant non contenues
sont des parents de ce commit ; les 34 autres références secondaires étaient déjà contenues.
La PR #37 est marquée fusionnée dans cette consolidation. Les branches historiques restent
comme références d’archive ; **main est la branche de travail et de publication**.

Les contrôles compatibles de #37 et ses dix reçus sont repris. Dix patches d’études/prototypes
sont conservés et leur réapplication exacte est vérifiée. Les physiques anciennes et prototypes
non qualifiés restent des préparations. [Manifeste](preparations/MANIFESTE.json),
[notice](preparations/README.md), [publication vérifiée](rapports/CONSOLIDATION-2026-11-20/PUBLICATION.json).

Le jeu et son build n’ont pas changé pendant cette consolidation : 14 370 823 octets,
SHA-256 `18b15fd06d758cc5cb760a6ad90697a860d0b7a03b819c92a2891033e95adf3b`.
Les premières fiches ont été poussées **après** cette fusion dans `72f92e2c761dc0ead696033e6be06cb9df891695`. Cette réconciliation conserve les deux fiches et ajoute le présent point d’entrée, les consignes et les reçus complets.

## Les quatre demandes et leur état

| Demande de David | Contrat à tenir | Fiche complète |
|---|---|---|
| Même cockpit en intérieur et extérieur | Une seule géométrie métrique, mêmes commandes, instruments, matériaux et ancrages ; le changement de caméra ne transforme pas la voiture. | [Habitacle et pilote communs](PILOTE-HABITACLE-COMMUN-2026-11-20.md), H0–H2 |
| Pilote plus bas et plus enfoncé | Assise/bassin communs abaissés, épaules/casque/yeux mesurés par rapport à la cuve et au jonc ; caméra au regard réel, contacts de mains conservés. | Même fiche, complément assise et B1–B2 |
| Bras en collision avec le buste | Mesurer la silhouette et les pénétrations, corriger buste/ancrages/coudes/manches et vérifier le cycle entier des gestes aux trois LOD. | Même fiche, B0–B5 et références MotionBricks/CMU |
| Vitesse qui écarte les gouttes | Flux relatif projeté dans chaque caméra, gravité basse vitesse puis écoulement et évacuation vers les bords ; toutes les couches optiques suivent ce flux. | [Eau et vitesse](EAU-VITESSE-2026-11-20.md), E0–E3 |

**État exact :** l’eau et la vitesse sont livrées en **0.2.68**, PR #39 fusionnée
(`4a04c09`) : 160/160 suites, 8/8 tests Python et 113 images inspectées.
[Publication et limites](rapports/EAU-VITESSE-2026-11-20/PUBLICATION-0268.json).
Les trois demandes habitacle/assise/bras restent à implémenter et qualifier. Les
validations d’eau ne démontrent ni l’identité géométrique monde de l’habitacle,
ni l’absence de collision bras/buste.

## Ordre de travail et preuves

Le correctif eau est publié. Le prochain petit lot est **H0/B0** ; ses mesures précèdent toute modification d’habitacle ou de pilote. Les preuves d’eau distinguent positions signées, sorties par les bords et séchage.

Le chantier habitacle/pilote est préparé à **H0 / B0** : inventorier les écarts de géométrie et les repères d’assise, puis reproduire les pénétrations sur les surfaces réellement affichées. Conserver les poses qui échouent ; ne pas attribuer leur cause sans mesure.

H1 établit l’habitacle et l’assise communs. B1–B3 règlent silhouette, bras et mouvements ;
H2/B4 requalifient l’identité monde, les LOD, les contacts et les allocations. B5 assemble
et publie un candidat vérifié. Les anciens artifices de cadrage sont remplacés par le réglage
de caméra ; les anciennes références restent des preuves historiques.

E0–E3 ont corrigé et qualifié le transport des gouttes dans les cas prescrits, en distinguant pluie dans le monde,
perles, nappes, grosses gouttes et traces. Les tests suivent des trajectoires signées et des
séquences ; compter des expulsions ou regarder une seule image ne suffit pas. La pluie vue
depuis un abri reste un autre problème déjà préparé, à raccorder avec ses propres validations.

Après chaque petit lot : commit limité, reçu synthétique avec version/commit/build,
échecs conservés, `REPRISE.md`, `ETAT.json` et journal actualisés. Les sorties lourdes ne
sont pas rechargées dans le contexte ; ouvrir seulement la fiche active et les sources utiles.
Ne pas relancer une campagne déjà terminée : qualifier les changements du nouveau candidat.

## Références et limites

[MotionBricks](https://github.com/NVlabs/motionbricks) et
[CMU mocap GLB](https://huggingface.co/datasets/codepawl/cmu-mocap-glb) sont documentés dans
la fiche habitacle/pilote, avec leurs usages envisagés, limites et licences distinctes.
Aucun de leurs modèles, poids, maillages ou clips n’est ajouté au runtime par ce plan.
La géométrie et le son restent procéduraux ; FERRO conserve sa référence canonique.

Les preuves 0.2.66 restent attribuées à leur candidat : 159/159 suites générales,
113 images retenues inspectées. La réconciliation d’outils ajoute 8/8 tests ciblés,
16/16 rapports et 48/48 empreintes d’images vérifiées, sans nouveau rendu.
Les quatre échecs 0.2.65 et les deux captures aériennes refusées restent conservés.

[FILE-TRAVAIL.json](FILE-TRAVAIL.json) conserve la pluie sous abri, les bandeaux de démo,
les finitions Cimes, Monaco/Marseille et les 17 destinations prévues. Les demandes ci-dessus
passent en tête ; les autres travaux ne sont ni effacés ni annoncés terminés.
