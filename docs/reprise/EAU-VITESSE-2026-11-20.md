# Eau, vitesse et orientation des gouttes — plan E0 à E3

Demande du 20 novembre 2026 : en **cockpit et poursuite**, l’écoulement dépend de la vitesse et du flux d’air. **À l’arrêt, les gouttes peuvent descendre ; en roulant, elles doivent s’écarter et être évacuées visiblement.** Vérifier la direction et la trajectoire dans chaque vue, en plus de la quantité réellement évacuée. Une disparition par séchage ne remplace pas une sortie visible par le bord.
Base consolidée vérifiée : `main` à `9f2246df61c6503ea8fa0f71a28813b15b17f51c`, BITUME **0.2.66**, physique **p15**, FERRO **0.3.15**. Cette fiche est prête à publier ; elle ne modifie pas le runtime et ne constitue pas une qualification du correctif.

## Diagnostic confirmé dans le code

- `src/jeu.js`, `dessinerMeteo` : les gouttes reçoivent `abs(voiture.etat.v)` et les composantes mondiales `ventX/ventZ`. Le contexte ne transmet ni vecteur de vitesse, ni orientation caméra. Cockpit/poursuite partagent donc le transport ; leurs différences concernent surtout exposition et opacité. L’abri et le sillage sont déjà évalués à la position de la caméra.
- `src/vitre.js`, `avancer` : la vitesse évacue les dépôts, augmente leur vieillissement et ajoute une dispersion autour d’un centre écran fixe. Mais le ruissellement descendant conserve le facteur **`8 + vitesse * .42`**. Le vent devient un scalaire écran (`.20*ventX + .08*ventZ`), sans projection caméra. La vitesse ne produit donc pas encore un transport cohérent avec la direction du déplacement et du regard.
- `src/visiere-optique.js` : les couches procédurales `perles` et `nappe` déplacent leurs centres sur leur axe vertical et renforcent coulure/étirement avec l’air. Les grosses gouttes mobiles utilisent le modèle partagé et son historique réel ; elles ne représentent pas toutes les couches visibles. `ventZ` est transmis dans le quatrième uniforme de mouvement, mais ce composant n’est pas lu dans le shader actuel.
- `src/meteo.js`, `creerPluie` : les précipitations dans le monde disposent déjà d’une vitesse relative à la caméra et d’une projection yaw/pitch/roll, avec protection contre les coupes. Cette couche est distincte des gouttes collées ; sa bonne expansion ne valide pas leur trajectoire.

**Hypothèse à vérifier en images :** les perles/nappes verticales et la composante descendante croissante des grosses gouttes expliquent le signalement. Leur contribution respective, selon vitesse, cadrage et qualité, n’est pas encore mesurée. Il serait incorrect de conclure que toutes les gouttes actuelles sont strictement verticales : une dispersion radiale existe déjà.

## Ce que la validation actuelle établit

Les tests `visiere-optique`, `vitre-meteo`, `vitre-integration` et `vitre-cadence` couvrent charge d’eau, évacuation à vitesse élevée, continuité temporelle, sillage, pause, séparation J1/J2, abris et absence de dépôts en aérien. Le test des traces inclinées de `vitre-meteo` vérifie un déplacement sous vent imposé et son historique ; il ne prouve pas une direction issue du repère caméra. Une baisse d’eau ou un nombre de gouttes expulsées ne suffit pas à établir une trajectoire convaincante.

Plus précisément, `vitre.test.mjs` exige encore qu’au moins une goutte descende à **40 m/s (144 km/h)** ; `vitre-cadence.test.mjs` impose la descente image par image d’une goutte à **45 m/s (162 km/h)**. Ce dernier critère doit devenir une continuité du déplacement dans la direction attendue, plutôt qu’une descente obligatoire à grande vitesse. Le faux objet caméra de `vitre-integration` ne contient que `pos` : aucun raccord yaw/pitch/roll n’y est testé. Les tests météo et sillage valident la projection du monde et l’exposition au panache, pas l’orientation des dépôts collés.

## E0 — Reproduire et attribuer

Conserver le build 0.2.66 comme référence. Préparer des séquences déterministes cockpit/poursuite à 0, 30, 100, 200 et 300 km/h, pluie libre puis sillage humide. Distinguer précipitations du monde, petites perles, nappes, grosses gouttes et traces. Relever des positions au fil du temps, directions, temps de séjour et eau restante ; une image fixe ne prouve pas un mouvement. Comparer les mêmes conditions avec regard avant, latéral et arrière, vent latéral, pente et roulis. Identifier la couche qui reste verticale avant de modifier son modèle.

## E1 — Flux d’air orienté par le mouvement et la caméra

Calculer un flux relatif à partir du vent et du **vecteur de vitesse réel du support**, puis le projeter dans la base droite/haut/avant de la caméra. Distinguer la visière du pilote et la lentille de poursuite ; éviter qu’une coupe ou un changement de voiture filmée crée une rafale artificielle. Traiter dérive, marche arrière et regard arrière sans réduire le mouvement à une valeur absolue.

À faible vitesse, conserver adhérence et gravité projetée. Avec la vitesse, faire dominer un écoulement cohérent vers les bords, dont direction et point de stagnation suivent l’incidence du flux ; ne pas accélérer simplement la descente verticale. Définir une convention commune aux dépôts CPU, au shader et au repli Canvas, propre à chaque vue J1/J2.

## E2 — Trajectoires, traces et évacuation cohérentes

Orienter déplacement, allongement, ménisque, film et traces à partir de ce même flux. Garder les traces des grosses gouttes attachées à leur historique réel ; traiter aussi les petites perles/nappes procédurales pour qu’elles ne conservent pas un mouvement vertical contradictoire. Préserver fusion, adhérence, fonte et transition progressive entre gravité et souffle.

Mesurer séparément **transport**, **sortie par les bords**, **séchage** et **nouveaux impacts**. La vitesse doit chasser l’eau présente sans effacer artificiellement le sillage dense qu’un rival renouvelle. Sous abri, arrêter les nouveaux dépôts et laisser évoluer les gouttes existantes ; raccorder ce travail au prototype pluie-abris sans le déclarer qualifié par anticipation.

## E3 — Vérifier la direction, puis l’image

- Tests déterministes de trajectoires : gravité à l’arrêt, dispersion à grande vitesse, réponse aux deux signes du vent, rotation du regard, dérive et marche arrière ; comparer des déplacements signés de gouttes identifiées, pas seulement leur quantité finale. Remplacer les anciens oracles de descente rapide par des directions attendues explicites, en conservant leurs exigences de continuité et d’interpolation.
- Cohérence des couches : direction des traces égale au déplacement, CPU/shader/repli concordants, absence de saut au changement de caméra ou de vitesse et invariance aux cadences 30/60/120/144 Hz.
- Contrats conservés : pause sans avance ni rattrapage, J1/J2 indépendants y compris caméras différentes, abri/portail avec dépôts résiduels, rétroviseurs nets, aérien et plans distants sans overlay, retour cockpit/poursuite correct.
- Séquences visuelles comparées au même seed et au même build : faible/grande vitesse, pluie libre/sillage, cockpit/poursuite, portrait/duo et qualités basse/haute. Mesurer CPU/raster et allocations ; conserver les exigences de densité du sillage déjà qualifié.

Sortie attendue : preuves de trajectoires et revue d’images concordantes, puis validation ciblée du nouveau candidat. Une réussite ancienne sur la quantité d’eau ne clôt pas ce lot.

## Contrat mesurable commun aux deux vues

| Situation | Direction et trajectoire attendues | Mesures distinctes |
|---|---|---|
| Arrêt, air calme | Gouttes mobiles descendant sous la gravité projetée ; petites perles encore adhérentes possibles | Positions horodatées, déplacement vertical signé, rayon, fusion |
| Accélération en regard avant | Transition continue vers l’écartement et la sortie par le pourtour ; aucune accélération artificielle de la seule gravité | Déplacement radial signé dans les quatre quadrants, direction instantanée, temps jusqu’au bord |
| Vent latéral, dérive, regard latéral/arrière | Flux reprojeté dans la caméra ; changement de direction cohérent avec vent relatif et mouvement réels | Composantes du flux, positions de mêmes gouttes, continuité de la trajectoire |
| Décélération et arrêt | Retour progressif à la gravité et à l’adhérence, sans téléportation des dépôts | Séquence continue avant/pendant/après, direction et vitesse des gouttes |
| Sillage humide à grande vitesse | Eau présente chassée vers les bords tandis que de nouveaux impacts alimentent le panache | Nouveaux dépôts, transport, expulsions, surface expulsée et séchage séparés |
| Entrée sous abri puis sortie | Fin des impacts sous le toit ; gouttes résiduelles encore transportées ; retour des dépôts dehors | Trajectoires continues, âge, nouveaux impacts par intervalle et état d’abri |

Répéter les trajectoires identifiées en cockpit et en poursuite, avec la caméra de chaque joueur. La projection écran du modèle CPU utilise `y` vers le bas ; les uniformes de l’optique inversent cet axe pour le repère GL. Les témoins de direction doivent vérifier ce signe, et non uniquement un nombre de gouttes restantes. Les couches fines, nappes, grosses gouttes et traces visibles suivent toutes le même flux, avec leurs mobilités propres.

## Reprise et publication

Publier ce plan avec le [plan habitacle/pilote](PILOTE-HABITACLE-COMMUN-2026-11-20.md), puis commencer E0 et E1. Chaque lot conserve son échec initial et son reçu de correction, avec commit source, empreinte du build et prochaines actions. Mettre à jour la reprise courte à chaque publication. Les contrôles de direction/trajectoire et les images du candidat exact conditionnent la clôture E3.

Le prototype pluie extérieure sous abri reste une préparation distincte ; la correction de transport des gouttes collées ne permet pas de le déclarer intégré. Le chantier habitacle H0/B0 reste ouvert, avec assise commune plus basse et contrôle bras/buste. Les autres lots sont conservés dans `FILE-TRAVAIL.json`.
