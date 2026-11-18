# Lot 10 — saisons visuelles

**Sources gelées et trois contrôles ciblés réussis** : contrat des profils, douze scènes (quatre saisons × trois circuits), puis conservation complète de la prairie 3D et de ses caches de sol entre été et hiver. Détails : `saisons-verification.json`, `saisons-final.log`, `saisons-sourcehashes.json`.

| Saison | Habillage des géométries existantes | Faune |
|---|---|---:|
| Printemps | Feuillus en bouquets blancs et roses ; herbe plus fraîche ; pins/conifères verts | 1 |
| Été, défaut | Végétation et sol plus secs ; soleil renforcé et plus chaud | 0,85 |
| Automne | Feuillus orange/cuivre/or, sol et plantes séchés ; sources de feuilles dans leurs couronnes | 0,48 |
| Hiver, forêt et montagne | Accotements, terrains herbeux et canopées enneigés ; route identifiable | 0 |
| Hiver, Port-Sable | Teintes plus froides, **jamais de neige** sur sol, plantes ou pins | 0,28 |

Sur les feuillus de Val-Brûlé, la représentation de test compte 909 canopées claires et 620 roses au printemps ; les 2 164 parties de canopée sont chaudes en automne. Les mêmes 1 082 arbres donnent 1 082 sources de chute, sans créer d’arbre supplémentaire. La floraison utilise un bruit spatial tourné et les poches florales du champ écologique : pas d’alternance imposée d’un côté de la route à l’autre.

## Contrat livré

`B.saisons.normaliser(id)` accepte printemps/ete/automne/hiver et retombe sur ete. `B.saisons.profil(id, theme)` renvoie un objet figé `{id,theme,neige,feuilles,faune,soleil,teinteSoleil}`. L’option `decor.construire(c,{saison:'hiver'})` reste une chaîne. `decor.saison` expose le profil ; `decor.sourcesFeuilles` expose en automne les sources `{x,y,z,rayon,sol}` des feuillus, y étant le centre de couronne et sol l’altitude vérifiée du sol. Les deux propriétés sont non énumérables.

`decor.atmosphere` est déjà saisonnier : ne pas multiplier une seconde fois soleil et teinte lors de l’intégration de l’ambiance. Le menu, la synchronisation réseau et les pools d’effets appartiennent aux autres sous-lots.

## Invariants et coût

Aucun sommet, indice, matériau, objet, lot, matrice, collision ou brin ajouté par la saison. Les racines, masques de surface et gains d’écologie restent identiques. La teinte est calculée seulement à la préparation, puis lue comme couleur d’instance ou de sommet par le rendu existant. Les versions proches et lointaines gardent exactement la même couleur. Les palettes globales du générateur restent intactes ; un changement de saison remplace la palette du cache de sol actif sans en accumuler quatre versions par clé.

Les bancs écologie/soumission précédents ont été pris **avant les saisons**, avec la palette historique sans saison explicite ; ils ne montrent pas les nouvelles couleurs d’été. Leur géométrie et leurs comptes restent ceux vérifiés par les tests de saisons. Aucun rendu navigateur ni FPS matériel n’est revendiqué.
