# Lot 10 — clairières et poches vivantes

> Mise à jour saisons : les comptes et bancs ci-dessous précèdent les teintes saisonnières. Ils utilisent la palette historique sans saison explicite, pas les nouvelles couleurs d’été. Les tests de saisons confirment une géométrie et des comptes identiques ; voir `saisons-rapport.md`.


**Sources gelées.** Champ écologique déterministe partagé, plantations réellement omises dans les clairières, poches riches conservées et sol coloré pour remplacer les brins devenus lointains. Référence : BITUME 0.2.32 (`5292baf`). Les fichiers et leurs empreintes sont dans `prairie-sourcehashes.json`.

## Répartition naturelle

`B.ecologie.creer(graine, biome).echantillonner(x, z, sortie)` fournit herbe, fleurs, insectes et boisement dans [0,1], sans allocation de sortie si elle est fournie. Le champ est mondial, tourné et déformé : paysage à 280/610 m, poches à 63 m, détails à 15 m, fleurs à 34 m et bosquets à 109/39 m. Les côtés de route ne sont ni alternés ni recopiés. `decor.ecologie` est non énumérable, présent indépendamment de la densité et en Off.

| Circuit | Points du champ nus près de piste | Points riches | Surface admissible plantée | Densité minimale dans les disques riches | Arbres conservés / 2 600 |
|---|---:|---:|---:|---:|---:|
| foret | 64.8 % | 12.0 % | 47.9 % | 247.5 brins/m² | 1082 |
| cote | 59.8 % | 21.0 % | 38.9 % | 302.2 brins/m² | 453 |
| montagne | 54.3 % | 23.2 % | 38.3 % | 248.3 brins/m² | 799 |

Les pourcentages près de piste viennent de sondes tous les 6 m à ±10 m de l’axe, hors la zone immédiate du départ. Les séries de points nus atteignent 522 m en forêt, 480 m sur la côte et 432 m en montagne. Les disques de contrôle sélectionnés au cœur des clairières contiennent **exactement zéro brin**. Les anciens 28 disques fixes sont conservés dans le rapport détaillé pour montrer aussi les endroits devenus nus ; le minimum uniforme du lot précédent n’est plus un objectif.

Les fleurs, fougères et taillis suivent leur habitat. Les arbres sont filtrés sans changer les candidats, leur géométrie ou la consommation de hasard : les troncs survivants et leurs solides sont identiques, aucun obstacle invisible ne subsiste, et les objets fixes/villages/rochers ne bougent pas. Les obstacles restent identiques entre qualités graphiques.

## Géométrie et coût

| Circuit | Brins MAX construits | Baisse depuis .32 | Instances de tapis | Baisse des instances | Lots végétaux |
|---|---:|---:|---:|---:|---:|
| foret | 49 134 826 | 69.9 % | 41 410 | 59.3 % | 3 057 |
| cote | 44 840 175 | 65.3 % | 30 697 | 63.2 % | 2 172 |
| montagne | 53 396 992 | 68.1 % | 37 370 | 60.2 % | 2 325 |

Les racines restent sur les vrais triangles du sol, à 5 mm sous leur surface. Les formes/rangs GPU, le LOD, le cisaillement et la marge du vent restent compatibles. Aucun parcours CPU par brin à chaque image. Les grands vides ne créent aucune instance ni aucun lot de prairie.

Les poches lointaines sont peintes dans les couleurs des nappes déjà présentes : sol nu, vert dense et faibles nuances florales. Preuve sur les trois circuits : **0 sommet, 0 indice, 0 nappe et donc 0 appel de nappe ajouté**. Géométrie, normales et matières restent identiques ; route, roche et sable gardent leurs couleurs. Les portées raccourcies et le fondu sont intégrés séparément par le responsable.

## Soumissions avec le même FERRO 0.3.8

Ces comparaisons incluent le champ écologique et les portées raccourcies 45/80/110/150 m. Elles isolent ces changements du futur travail moteur. Forêt, 960 × 540, FOV 60°, herbe seule, couleur + ombre. Les rangs éventuellement rejetés par le shader restent comptés comme soumis.

| Palier et vue | Triangles .32 → candidat | Appels .32 → candidat | CPU médian inerte .32 → candidat |
|---|---:|---:|---:|
| medium · cockpit | 233 514 → 104 060 | 161 → 48 | 3.72 → 2.16 ms |
| medium · poursuite | 196 728 → 113 616 | 153 → 61 | 3.69 → 2.16 ms |
| medium · bord-sol | 182 616 → 144 | 146 → 2 | 3.54 → 2.22 ms |
| high · cockpit | 963 792 → 405 208 | 285 → 64 | 3.96 → 2.75 ms |
| high · poursuite | 774 144 → 593 416 | 242 → 77 | 4.15 → 2.76 ms |
| high · bord-sol | 692 386 → 504 | 251 → 3 | 4.14 → 2.47 ms |
| ultra · cockpit | 35 371 278 → 8 018 336 | 1330 → 200 | 7.74 → 4.91 ms |
| ultra · poursuite | 34 868 044 → 10 562 046 | 775 → 271 | 6.32 → 3.93 ms |
| ultra · bord-sol | 34 194 206 → 504 | 909 → 3 | 6.49 → 4.02 ms |

La vue bord-sol tombe désormais dans une clairière ; son résultat proche de zéro ne représente pas les zones chargées. En cockpit/poursuite, le MAX passe de 34–35 M à 8,02–10,56 M triangles soumis. Les temps CPU incluent l’instrumentation Node et ne constituent pas des FPS. Le processus du banc candidat MAX atteint environ 523 Mio de RSS ; cette valeur n’est pas une mesure de VRAM ni de mémoire navigateur.

## Qualification et portée

17 contrôles végétation, 3 contrôles écologie/décor, 9 empreintes du chemin historique et 15 combinaisons du budget réussis. Les derniers changements de couleur ont ensuite été vérifiés par le test écologie/décor : aucun changement géométrique. Le rapport complet conserve les comptes par palier, contrôles de sol, disques et empreintes. Aucun rendu navigateur, aucun FPS matériel ni aperçu du jeu ne sont revendiqués.

La relecture en lecture seule de l’autodétection est dans `relecture-autoconfig.md` : restauration après perte de contexte, hotspot exclu près des stands et conservation d’un palier déjà validé en cas de délai global. Les corrections appartiennent au responsable.
