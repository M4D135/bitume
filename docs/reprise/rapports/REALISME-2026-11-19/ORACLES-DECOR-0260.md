# Oracles de décor — qualification ciblée du 19 novembre 2026

Base vérifiée : `90d43108660d5b4fb12a52613a1824c49f334970`, candidat BITUME 0.2.60.
Ce lot corrige quatre bancs après le passage local complet à 129/136 suites.
Il ne modifie ni le jeu, ni les seuils d'arbres, ni les fixtures, ni leurs empreintes.

## Causes et contrats conservés

- **arbres-lots** : l'ancien oracle supposait une bascule de 520/900 m pour tout mobilier.
  Les lots entièrement identifiés `maison`/`commissaires` exigent désormais exactement 180 m,
  ceux de `voie-service` exactement 260 m ; les autres gardent 520/900 m. Les mélanges sont
  rejetés, les détails sont dénombrés face aux sites architecturaux, les contrats sont exercés.
  Les portées infinies et toutes les exigences propres aux arbres restent inchangées.
- **arbres-lots et pacifique** : Node chargeait implicitement chaussée, virages, Baïkal et
  bâtiments, contrairement aux contextes VM. Les deux côtés chargent maintenant la même
  liste explicite. L'égalité exacte des collisions reste exigée ; la présence des modules
  et l'identité des sites architecturaux sont contrôlées aussi.
- **reperes-virages** : la comparaison à 0.2.53 reçoit une configuration historique isolée :
  bâtiments désactivés, thème Baïkal exact de la fixture, écologie de Baïkal avant son ajout
  au catalogue des biomes. Ce dernier profil correspond au repli existant d'un biome inconnu
  (graine forêt, ouverture générique), appliqué aux deux contextes historiques seulement.
  La fixture et les huit comptes/empreintes Linux restent inchangés. Une première tentative
  avait encore injecté le biome récent dans la fixture (1204 solides au lieu des 1134
  historiques de Baïkal) ; l'isolation de ce profil résout cet écart sans nouvel oracle.
  Le décor actuel conserve bâtiments et paysage 13B actifs : une comparaison supplémentaire
  avec/sans repères exige exactement les mêmes solides dans le même ordre, arbres et
  géométries de nappes. Tous les contrôles de placement, sens, couleurs, LOD et hiver restent
  exécutés, ainsi que l'identité des tableaux du circuit.
- **troncs** : les poteaux en bois ne sont plus identifiés comme arbres par leur seule
  matière. Le banc sélectionne `collision === 'tronc'`, recoupe le nombre avec `decor.arbres`,
  exige des cylindres, puis conserve l'égalité exacte position/taille/rotation et les
  16 faces des vrais troncs. L'absence de feuillage solide et les trois accidents réels
  suivis de leur replacement restent contrôlés.

## Résultat ciblé local

Commandes : `node verifications/<suite>.test.mjs`, Node **24.22.3**, Linux x64.
Les durées ci-dessous sont des temps d'exécution observés, pas des mesures de performance du jeu.

| Suite | Contrôles réussis | Durée |
|---|---:|---:|
| arbres-lots | 12/12 | 7,581 s |
| pacifique | 11/11 | 8,568 s |
| reperes-virages | 58/58 | 62,698 s |
| troncs | 18/18 | 0,861 s |
| **Total** | **99/99** | **79,708 s** |

Empreintes SHA-256 des journaux finaux conservés hors dépôt :

| Journal | SHA-256 |
|---|---|
| arbres-lots.log | `8b2ef431d51cb1f57a4700377586e6d52335d3ce52f4115ead5889cdd5fc6743` |
| pacifique.log | `d7c9791d194882f8154f90c491c5512fe5efa518b553df02ece7bacef76e7cfc` |
| reperes-virages.log | `9e3b52e76633a9f3db015c03012548974e1e232724c8c9d0965a3fcd274011a5` |
| troncs.log | `5aaf97f33eaec88243b9cbadea22c62747910e83255e26c78a1ab59b2b5f7b1d` |

`git diff --check` est propre. `git diff --exit-code 90d4310 -- src construire.py VERSION.json
FERRO.lock.json verifications/fixtures` confirme l'identité de ces fichiers avec la base.
Aucune construction ni publication n'a été effectuée dans ce lot. Ce résultat ciblé ne constitue
ni un second passage complet ni une exécution de GitHub Actions.
