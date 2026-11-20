# Préparations et historique réunis — 20 novembre 2026

Le jeu actif demeure **BITUME 0.2.66, physique p15**, à partir de main `fd92eec1058f61e6191cc5ce090f5fbbd366e8e9`.
Ce dossier conserve les travaux non ancêtres de cette tête sans activer les anciennes physiques, géométries ou validations.

L’inventaire GitHub a trouvé **50 branches**, dont **34 références secondaires déjà contenues** et **15 têtes non contenues**.
Les anciennes branches d’étude signalées introuvables dans un état précédent sont désormais présentes ; ce manifeste corrige ce constat ancien.
La PR #37 était la seule PR ouverte lors de l’inventaire.

## Travaux conservés

| Dossier | Branche d’origine | État | Conservation |
|---|---|---|---|
| [demos-pilotes](demos-pilotes/README.md) | `backup/demos-pilotes-20261120` | historique_supplante | notice + objets |
| [meteo-matiere](meteo-matiere/README.md) | `backup/meteo-matiere-20261120` | historique_supplante | notice + objets |
| [pluie-abris](pluie-abris/README.md) | `backup/pluie-abris-20261120` | preparation_active_non_qualifiee | patch + objets |
| [circuits-lot22](circuits-lot22/README.md) | `circuits/lot22` | historique_a_adapter_p15 | patch + objets |
| [conduite-etude](conduite-etude/README.md) | `conduite/etude` | historique_a_adapter_p15 | patch + objets |
| [enligne-etude](enligne-etude/README.md) | `etude/enligne` | prototype_a_reprendre | patch + objets |
| [photo-etude](photo-etude/README.md) | `etude/photo` | etude_documentaire | patch + objets |
| [procedural-etude](procedural-etude/README.md) | `etude/procedural` | etude_documents_et_outils | patch + objets |
| [vitre-etude](vitre-etude/README.md) | `etude/vitre` | etude_documents_et_tests | patch + objets |
| [pr37-demos-meteo](pr37-demos-meteo/README.md) | `feat/bitume-0263-demos-meteo-20261120` | historique_supplante_avec_preuves | notice + objets |
| [couverts-cimes](couverts-cimes/README.md) | `feat/bitume-couverts-cimes-20261120` | historique_supplante_avec_preuves | notice + objets |
| [monaco-revue](monaco-revue/README.md) | `feat/monaco-revue-mesures-20261120` | historique_supplante | notice + objets |
| [spark-calcul](spark-calcul/README.md) | `spark/calcul` | prototype_a_reprendre | patch + objets |
| [spark-circuits](spark-circuits/README.md) | `spark/circuits` | historique_a_adapter_p15 | patch + objets |
| [spark-conduite](spark-conduite/README.md) | `spark/conduite` | historique_a_adapter_p15 | patch + objets |

## Conservation et vérification

`MANIFESTE.json` donne les **50 références exactes**, les **15 têtes à rendre ancêtres** du commit final,
les bases communes et les empreintes des patches. Chaque dossier possède une notice et l’inventaire complet des objets modifiés.

Les dix patches conservent le code, les tests, outils et textes d’étude utiles, depuis leur vraie base commune.
Leur application a été contrôlée dans un index temporaire, en comparant tous les objets et modes produits.
Les captures, graphes, journaux historiques, builds et contenus déjà identiques ne sont pas dupliqués : leurs objets Git sont listés.
Les quinze commits d’origine doivent rester atteignables dans l’historique final pour assurer cette conservation.

Le delta brut aurait représenté 56 997 235 octets, surtout des captures répétées. Les dix patches retenus totalisent
6 227 297 octets ; cinq notices suffisent pour les variantes supplantées.

Cette opération est documentaire. Aucun patch n’est appliqué au jeu, aucun build ni test actif n’est remplacé,
et aucune validation antérieure n’est transformée en preuve d’un prototype futur. La pluie sous abri et les autres
préparations se reprennent selon le plan courant, avec une qualification adaptée à chaque modification.
