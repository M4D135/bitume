# Eau et vitesse — livraison 0.2.68

La PR #39 est fusionnée sur main. Le [reçu de publication](PUBLICATION-0268.json) est le point d’entrée : tête et arbre qualifiés, fusion, empreinte HTML, campagnes, images et limites.

## Preuves

| Sujet | Reçu | Résultat |
|---|---|---|
| Compilation et tests | [Qualification générale](QUALIFICATION-GENERALE-0268.json) et [état final CI](CI-FINALE-0268.json) |160/160 suites Node, 8/8 tests Python, 21/21 checks  ; 3 485 sources vérifiées |
| Trajectoires CPU | [Candidat](TRAJECTOIRES-CANDIDAT.json), [référence 0.2.66](TRAJECTOIRES-0266.json) |56 scénarios,112 contrôles conformes ; quatre quadrants évacués |
| Matière et mouvement dans les pixels | [Qualification native](QUALIFICATION-VISIERE-0268.json), [directions](DIRECTION-PNG-0268.json), [négatifs](NEGATIFS-PNG-0268.json) |47 rasters,24 intervalles,2 076 mesures ; contre-épreuves refusées |
| Démos | [Revue](visuel-demo/REVUE-DEMOS-0268.md), [inventaire](visuel-demo/INVENTAIRE-PNG-0268.json) |48 images inspectées |
| Météo | [Revue](REVUE-METEO-0268.json) |41 images inspectées |
| Portrait et duo | [Revue E3](REVUE-EAU-CAMERAS-0268.json) | 9 images inspectées sur le même HTML |
| Passages couverts | [Revue](REVUE-COUVERTS-0268.json) |24 images inspectées ; reprise Cimes-rocher sur le même build |

Les 122 captures comprennent 98 images du candidat et 24 références historiques 0.2.62. Les rapports conservent les identifiants/digests des artefacts, les empreintes PNG, les observations et leur portée. Les chemins d’images dans ces reçus désignent les fichiers des archives de capture ; ces images ne sont pas des assets du jeu.

## Échecs conservés et limites

Le [premier démarrage Chrome refusé](couverts/ECHEC-CIMES-ROCHER-INITIAL.json), les [92 empreintes de l’essai 1](couverts/essai-1/RECU-SAUVEGARDE.json), le [verdict natif initial insuffisant](EGL-INITIAL-0268.json) et les quatre échecs historiques0.2.65 restent attribués à leurs essais. La réussite finale provient des mesures et des images inspectées, sans modifier les seuils pour masquer un échec.

Les mesures logicielles ne qualifient pas les FPS matériels. Pluie extérieure depuis un abri, bandeaux, neige et deux alertes miroir historiques restent des réserves. Le prochain lot est l’habitacle/pilote commun ; aucun de ses défauts n’est déclaré corrigé par cette livraison d’eau.
