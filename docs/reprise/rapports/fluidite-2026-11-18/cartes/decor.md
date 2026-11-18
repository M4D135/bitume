# Carte des accrocs — decor

Lecture seule du 18 novembre 2026 (BITUME 0.2.38, FERRO 0.3.9). Ces constats viennent d’une lecture du code ; la contre-vérification prévue a été arrêtée avant de rendre : vérifier chaque constat dans le code avant d’agir.

## Fonctionnement

Racine : /Users/david/Projects/bitume. Les cinq fichiers ne tournent qu'au chargement de la page (formes d'arbres et de végétation : src/botanique.js:281-290, src/vegetation.js:286-325 et 570) et pendant la construction du décor. Par image, seule la fermeture `decor.sol` (src/decor.js:421-426, sans allocation) est appelée. Aucune minuterie, aucun DOM, aucun stockage dans ces fichiers.

Construction : `B.decor.construire(c, options)` (decor.js:676-1251), synchrone, appelée par `installer` (src/jeu.js:134-163) depuis `lancer` (jeu.js:181). Scène unique, réutilisée si la clé (circuit, enrichi, palier d'ancre, végétation, saison) est identique (jeu.js:141).

Ordre : limites et index d'axe (109-158) ; `nappesRoute` (193-252 : tronçons de 60 échantillons, 9 bandes) ; `nappesTerrain` (255-428 : grille de 24 m, tuiles de 14 × 14 cases, eau, fonction `sol`) ; teinte de saison des sommets (693-711) ; objets rangés par lots de 150 m de piste ou cases de 420 m (712-722) : glissières (724-750), tunnel (756-834), repères, pneus, postes, départ, tribunes, stands, passerelle (836-934), arbres (936-1052), villages et rochers (1054-1160) ; finition des lots, bascule à 520 ou 900 m (1162-1180) ; obstacles (1181-1189) ; herbier (`creerHerbier` 432-585, cache `HERBIERS` 675 et 1198-1210) ; végétation (`B.vegetation.construire`, vegetation.js:329-565 : massifs par 420 m, tuiles de prairie par cases de 24, 16 ou 64 m, bascule à 60 m) ; teinte de saison (1228-1238).

Puis `installer` : `setWorld`, `setNappes` (un seul VBO, src/moteur/renderer.js:2699-2721), `setLots` (par lot : deux `pack`, deux tampons, un plan de couverture ; renderer.js:2731-2741), carte 2D.

Après le chargement, rien n'est rebâti en course. Humidité et pluie passent par l'uniforme `weather` ; l'herbe proche par `groundCover` et `prepareGroundCover` (renderer.js:1447-1488), sans téléversement ; le palier Auto ne déplace que l'ancre de la séance suivante (src/graphismes.js:313-318) ; la saison impose une reconstruction complète, toujours hors course.

Par image, le moteur parcourt tous les lots (renderer.js:38-48, 2742-2758) et toutes les nappes (2722-2730).

Volumes mesurés dans le dépôt (forêt, Fine ; docs/reprise/rapports/nature-conditions-menus-2026-11-18/budget-final.json et soumission-033-final-*.json, banc Node à WebGL inerte) : 2 394 lots, 47 609 objets proches, 38 951 tuiles, `setLots` 57 à 106 ms CPU, 336 à 373 Mo de tas après construction. Aucune durée de `construire` n'est mesurée dans le dépôt, et je n'ai rien exécuté.

Lancement d'une course (jeu.js:2364-2373) : voile `#chargement`, 30 ms, puis dans le même rappel : retrait du voile, `lancer` (installer, course, modèles, traces, nature vide), `aller('course')`. Les premières images créent encore la faune (1714), les effets de saison (1722), les aurores (1735) et le second moteur des rétroviseurs avec sa copie du décor (1545-1556). En parcours normal, la scène est déjà bâtie par la vitrine de l'écran de préparation (jeu.js:2149).

## Constats

### decor-01 — gravité 5, confiance 0.85
- Où : /Users/david/Projects/bitume/src/jeu.js : src/jeu.js:1529-1556 (création 1545-1547, copie 1550-1555), 1512-1516, 678-679 (création paresseuse et allocation GPU)
- Quand : En course : première image en vue cockpit après chaque nouvelle scène ; touche « Vue » (poursuite vers cockpit) ; retour du gouverneur Auto au niveau 0.
- Mécanisme : `majGlaces` crée le second moteur dans l'image (`FRender.create` : géométrie de toutes les formes, programmes), puis y recharge tout le décor : `setNappes` et `setLots` sur des copies, soit un nouveau `pack` d'environ 90 000 instances, près de 4 800 tampons GPU et 2 353 plans de couverture. `setLots` seul coûte 57 à 106 ms CPU au banc Node du dépôt (WebGL inerte).
- Correctif proposé : Créer `retro.rendu` une fois au démarrage, hors course. Dans `installer`, sous le voile, charger nappes et lots dans ce second moteur et y tirer une image de chauffe. `majGlaces` ne fait plus que dessiner ; si la copie n'est pas prête, garder la glace peinte et la préparer hors de l'image.
- Risque : Chargement allongé et tampons d'instances doublés en permanence, même pour qui roule en vue poursuite. Durée réelle de `FRender.create` non mesurée.

### decor-02 — gravité 5, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : src/jeu.js:1712-1714, 215-217 ; src/faune.js:22-97, 135-141 ; src/decor.js:1197-1216, 1226-1227, 432-585 ; src/graphismes.js:240 (création paresseuse)
- Quand : Première image de chaque séance, voile déjà retiré. En pleine course en qualité Auto avec faune « Selon qualité », quand le palier quitte Légère. Première image après reconstruction sur Brume-de-Jade et Cap-Séquoia (démo, invité en ligne, vitrine).
- Mécanisme : `nature.faune` repart à null à chaque `lancer` ; `B.faune.creer` recalcule alors dans l'image les habitats : jusqu'à 1 536 × 65 appels à `surfaceHerbe`, chacun allouant boîte, tableau et clés texte. Si l'herbier n'existe pas (décor Légère, thèmes asie et pacifique), le premier appel exécute `creerHerbier` : découpe de tous les triangles des nappes. En Auto, `P.faune` passe de off à medium en pleine course.
- Correctif proposé : Dans `installer` : forcer `decor.herbier` quand la faune peut s'activer, puis calculer habitats et index une seule fois par scène (`scene.faune`) ; par séance, ne réinitialiser que les deux vues. Retirer la création de la ligne 1714 : sans faune prête, ne rien dessiner. En palier Légère, renoncer à la faune plutôt que bâtir l'herbier en course.
- Risque : Durées non mesurées : habitats estimés à quelques dizaines de ms, herbier de plusieurs centaines de ms à plusieurs secondes selon la machine. Après une détection réussie, qualité et faune sont fixes : le cas en course ne touche que le mode Auto.

### decor-03 — gravité 4, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : src/jeu.js:2364-2373, 1115-1123, 2089-2095, 1621, 1714, 1722, 1735, 1531-1549 ; src/moteur/renderer.js:42, 2527-2572 (préchargement absent)
- Quand : Premières images de chaque course et de chaque course de démo, pendant que le voile s'efface.
- Mécanisme : Le voile est retiré dans le rappel même qui appelle `lancer` (classe « fini » posée ligne 2368, avant la construction). Les premières images visibles paient donc : faune, effets de saison, aurores, second moteur des rétroviseurs, enregistrements de lots du moteur (renderer.js:42), cibles d'ombre, de MSAA et de reflets allouées au premier usage. Aucune image de chauffe n'existe hors du banc.
- Correctif proposé : Fonction asynchrone `preparerNiveau` : décor, caches de nature, second moteur, puis quelques images dessinées sous le voile avec les options exactes de la course (ombres, MSAA, halo, reflets, lampes), en cockpit puis en balayant le tour pour toucher chaque lot proche et lointain ; finir par `readPixels` d'un pixel et `oublierIntervalle()`, puis lever le voile.
- Risque : Chargement visible plus long. La chauffe doit employer les mêmes options que la course, sinon elle ne couvre rien. `readPixels` est synchrone : à garder sous le voile.

### decor-04 — gravité 4, confiance 0.8
- Où : /Users/david/Projects/bitume/src/jeu.js : src/jeu.js:2482-2484, 2522, 1400-1406, 2023-2024, 2471-2476 ; src/qualite.js:16-27 (cadence)
- Quand : Trois secondes après le départ, en qualité Auto seulement ; à chaque course de la démo.
- Mécanisme : `tBrut` de la première image contient toute la durée de `lancer` (aucun plafond, `tPrec` jamais remis à zéro) et entre dans la fenêtre du gouverneur. À 60 Hz, plus de 0,52 s de blocage cumulé porte la moyenne des trois secondes au-delà de 1/50 : palier +1 (glaces peintes, `rendu.resize`), remontée huit secondes plus tard. En démo, `aller('demo')` ne vide pas la fenêtre.
- Correctif proposé : Appeler `oublierIntervalle()` à la fin de `lancer` et après la chauffe. Dans `majPalier`, écarter tout intervalle supérieur à 0,25 s : il ne compte ni dans la somme ni dans le nombre d'images.
- Risque : Le seuil de 0,52 s vient du calcul sur le code (1,76 s à 120 Hz) ; le dépassement réel dépend de durées non mesurées. Un vrai gel long ne fera plus baisser la qualité, ce qui est voulu.

### decor-05 — gravité 4, confiance 0.6
- Où : /Users/david/Projects/bitume/src/vegetation.js : src/vegetation.js:24, 466-467, 483, 550-561 ; src/moteur/renderer.js:38-48, 2742-2758, 2939, 3068, 3166 (coût permanent par image)
- Quand : Chaque image et chaque vue (principale, glace de rétroviseur, joueur 2), aux paliers de végétation Moyenne, Fine et Extrême sur forêt, côte et montagne.
- Mécanisme : La prairie est regroupée par cases de 24 m (16 m en Extrême) près de la piste et de 64 m au loin : 2 353 lots en forêt ; `LOT_TAPIS = 48` n'est pas utilisé. Le moteur parcourt tous les lots deux à trois fois par rendu. Banc Node : draw() ≈ 0,3 ms à 84 lots, 2,1–3,0 ms à 2 362, 3,2–4,4 ms à 3 489, même avec trois lots visibles.
- Correctif proposé : Regrouper par 48 m près de la piste et 192 m au loin, en visant moins de 500 lots, puis remesurer avec `tools/mesurer-prairie.mjs`. Dans FERRO de référence : grille grossière dans `lotViewState.prepare` pour ne visiter que les cases à portée de couverture.
- Risque : Corrélation relevée sur trois versions au banc Node, non isolée dans un navigateur. Lots plus gros : culling et bascule moins fins, davantage de tests d'instances ; vegetation.test à requalifier.

### decor-06 — gravité 4, confiance 0.7
- Où : /Users/david/Projects/bitume/src/decor.js : src/decor.js:712-722, 952, 1172-1179 ; src/moteur/renderer.js:43-45, 2931-2939 (niveaux de détail, coût GPU permanent)
- Quand : Chaque image, passe couleur et passe d'ombre du soleil, surtout aux paliers Moyenne et Fine.
- Mécanisme : Tout objet à moins de 330 m de l'axe rejoint le lot de son tronçon de 150 m, arbres compris : sphère d'environ 340 m (estimée). Le moteur décide par lot, sur distance moins rayon : version proche jusqu'à 860 m, culling quasi inopérant, et la passe d'ombre dessine le lot entier dès que sa sphère touche le carré de 200 m. Mesuré, cockpit Fine : 2,75 M de triangles par image.
- Correctif proposé : Aux paliers Moyenne et Fine, séparer les arbres du mobilier de piste : lots d'arbres par cases de 120 à 200 m, glissières et bâtiments par tronçon. Construire la liste des obstacles avant ce regroupement pour garder son ordre, et laisser le profil historique (Légère) inchangé pour les empreintes.
- Risque : verifications/decor-identite.test.mjs empreinte le décor historique ; l'ordre des obstacles touche la physique p9 et le jeu en ligne. Une centaine de lots et d'appels de dessin en plus. Rayon réel des lots à mesurer.

### decor-07 — gravité 3, confiance 0.8
- Où : /Users/david/Projects/bitume/src/botanique.js : src/botanique.js:14-33, 244-255 ; src/decor.js:599-612, 1179 ; src/graphismes.js:59, 78, 96, 250 (niveaux de détail)
- Quand : Chaque image, paliers Moyenne et Fine.
- Mécanisme : La forme lointaine d'un arbre ne retire aucun organe, seulement des segments : feuillu Fine 2 022 triangles en proche, 1 410 en lointain ; Moyenne 1 074 et 810 ; conifère Fine 3 702 et 2 514. À 520 m, un arbre de 7 m tient en 12 pixels. `P.lod.bascule` (380, 520, 760 m) n'est lu nulle part : la bascule reste 520 ou 900 m à tous les paliers.
- Correctif proposé : Générer une vraie forme lointaine (tronc à trois faces, houppier en trois ou quatre amas, moins de 100 triangles) partageant pied et cime. Appliquer `P.lod.bascule` en écrivant `lot.bascule` sur les lots d'arbres des deux moteurs : le moteur relit cette valeur à chaque image (renderer.js:26), sans reconstruction.
- Risque : Comptes calculés d'après le code ; 2 022 recoupe le rapport budget-final.json. Silhouette lointaine à valider à l'œil ; botanique.test vérifie les organes des formes actuelles. Gain GPU non mesuré.

### decor-08 — gravité 3, confiance 0.85
- Où : /Users/david/Projects/bitume/src/jeu.js : src/jeu.js:134-163 (clé 141), 2035, 2089-2095, 2149, 2193, 2381 ; src/graphismes.js:313-318 (calcul en rafale non étalé)
- Quand : Hors course : choix d'un circuit, saison résolue à la préparation, retour au titre, « Recommencer » en Auto, chaque course de la démo.
- Mécanisme : Une seule scène existe : changer de circuit, de saison, de végétation ou d'ancre rebâtit nappes, lots, herbier et tampons en une seule tâche, sans voile au retour au titre ni au choix d'un circuit. En Auto, l'ancre suit le gouverneur (verrou de 5 s) : « Recommencer » peut rebâtir le même circuit. La démo rebâtit un circuit tous les trois tours et jette le précédent.
- Correctif proposé : Découper `construire` en étapes qui rendent la main (modèle des tranches de 4 ms de `finirClassement`, jeu.js:2414-2428), toujours sous le voile. Figer l'ancre du décor pour la page, sauf choix du menu. Garder par circuit les données indépendantes de la saison pour ne refaire que les couleurs.
- Risque : `lancer` devient asynchrone : les départs en ligne, la démo et la préparation doivent attendre la scène. Durée de construction non mesurée dans le dépôt.

### decor-09 — gravité 3, confiance 0.6
- Où : /Users/david/Projects/bitume/src/decor.js : src/decor.js:432-585 (434-437, 472-489, 499-509, 514-522, 537-567, 569-582), 139-156 ; src/vegetation.js:421-489 (durée de chargement et ramasse-miettes)
- Quand : Au chargement ; en pleine image dans le cas decor-02.
- Mécanisme : Chaque triangle de nappe (environ 18 par échantillon de piste, plus la grille de terrain) passe par `Array.from(slice)`, `map`, `reduce`, quatre `Math.min(...p.map())`, des objets plan et boîte, puis `flatMap` et une fermeture par arête de masque ; les index utilisent des clés texte. `interroger` rend un objet et calcule une hauteur pondérée à chaque appel, y compris pour les 39 000 tuiles de `planter`.
- Correctif proposé : Réécrire en tableaux typés : boîtes et plans en Float64Array, index par cases entières (CSR Int32), découpe dans des tampons réutilisés ; donner à `interroger` un objet de sortie et une variante sans pondération. Chronométrer d'abord chaque étape avec `performance.now()` pour confirmer que l'herbier domine.
- Risque : Que l'herbier soit l'étape dominante est une supposition non chronométrée. Les empreintes et vegetation.test exigent des flottants identiques : garder l'ordre des opérations.

### decor-10 — gravité 3, confiance 0.45
- Où : /Users/david/Projects/bitume/src/decor.js : src/decor.js:563, 675, 1198-1208 ; src/vegetation.js:370-375, 479-484 ; src/jeu.js:79-83 ; src/moteur/renderer.js:3211-3216 (ramasse-miettes)
- Quand : Toute la séance ; s'aggrave à chaque circuit visité (la démo les enchaîne tous).
- Mécanisme : Le banc du dépôt relève 336 à 373 Mo de tas utilisé après construction (9 Mo avant, 56 Mo en 0.2.31 ; sans GC forcé, borne haute). Restent vivants : environ 90 000 objets d'instances avec leurs petits tableaux, les triangles d'herbier de chaque circuit visité (`HERBIERS`, indexé par des circuits jamais libérés) et les listes de triangles des formes. Tout GC majeur doit les marquer.
- Correctif proposé : Ne garder l'herbier que pour la scène courante, ou le libérer après habitats et plantation ; partager entre tuiles les tableaux identiques ; à terme produire les tuiles directement en Float32Array. Mesurer le tas vivant et les pauses de GC sur un tour complet (trace Chrome) avant d'aller plus loin.
- Risque : Tas vivant réel et pauses de GC non mesurés. Le moteur relit `lot.objets` pour restaurer un contexte perdu (renderer.js:3215) : on ne peut pas les jeter sans changer FERRO.

### decor-11 — gravité 2, confiance 0.8
- Où : /Users/david/Projects/bitume/src/decor.js : src/decor.js:1201-1208, 506 ; src/faune.js:75-92 ; verifications/saisons.test.mjs:109-115 (travail refait)
- Quand : Au chargement, à chaque changement de saison (modes Aléatoire et Réel compris).
- Mécanisme : `HERBIERS` ne garde qu'une entrée par clé et la rejette si la saison diffère, alors que seule la couleur moyenne de chaque triangle (ligne 506) dépend de la saison : toute la découpe géométrique est refaite. Le jeu ne lit d'ailleurs que `y` et `normal` de `surfaceHerbe` (faune.js:75-92).
- Correctif proposé : Séparer la géométrie (triangles, plans, index : par circuit et clé) des couleurs (un tableau par saison, recalculé en un passage sur les nappes). Conserver le contrat de couleur vérifié par verifications/saisons.test.mjs:109-115.
- Risque : Faible. Vérifier que les chapeaux enneigés des rochers (matière 3 au lieu de 8 ou 9) ne changent pas l'emprise des masques.

### decor-12 — gravité 2, confiance 0.85
- Où : /Users/david/Projects/bitume/src/jeu.js : src/jeu.js:1387-1390, 1397, 1515, 1534, 1540, 1661, 1691, 1761 ; src/graphismes.js:113-126, 205-256, 319-338 (allocations par image)
- Quand : Chaque image.
- Mécanisme : `profilDe` est appelé cinq fois par image en cockpit (1661, 1691, 1534 et 1761 via `retroVoulu`, 1540) et `stabiliser` une fois. Chaque `melange` normalise des chaînes (`normalize('NFD')` et expression régulière), crée une dizaine d'objets et les fige récursivement avec `Object.keys`. Ordre de 100 à 150 allocations par image pour un résultat qui ne change qu'avec le palier ou les réglages.
- Correctif proposé : Mémoriser le profil résolu sur la clé (qualité, `palier.n`, `etatProfils.decor`, identité de `capacitesRendu`, compteur de révision des réglages) et le passer en paramètre à `retroVoulu` et `majGlaces`.
- Risque : Invalider le cache à chaque écriture de `reglages` (menu, détection, outil de référence, banc). Nombre d'allocations estimé à la lecture.

### decor-13 — gravité 2, confiance 0.8
- Où : /Users/david/Projects/bitume/src/moteur/renderer.js : src/moteur/renderer.js:1528-1546 (1529), 2731-2741 (ramasse-miettes au chargement)
- Quand : À chaque `setLots` : chargement, restauration de contexte, et dans l'image dans le cas decor-01.
- Mécanisme : `pack` commence par `names.map(() => [])` : un tableau par forme connue (environ 125 : primitives, 48 formes de végétation, 18 d'arbres, 6 d'aurores, carènes) pour chaque lot et chaque version. Soit près de 4 800 appels et plus d'un demi-million de tableaux jetés par `setLots`, autant pour le second moteur.
- Correctif proposé : Dans FERRO de référence : compter par forme puis écrire directement, comme `instancePacker` (renderer.js:1549-1563). Réduire le nombre de lots (decor-05) divise déjà ce coût.
- Risque : Module verrouillé : corriger la référence FERRO puis propager. Nombre de formes estimé par comptage des enregistrements.

### decor-14 — gravité 1, confiance 0.9
- Où : /Users/david/Projects/bitume/src/moteur/renderer.js : src/moteur/renderer.js:2722-2730 (2726) ; src/jeu.js:1707-1709, 1584 ; src/decor.js:194-198, 341, 381 (allocations par image)
- Quand : Chaque image et chaque vue.
- Mécanisme : `dessinerNappes` crée un objet `{p, radius}` par nappe et par rendu : 35 à 44 tronçons de route (60 échantillons chacun) plus les tuiles de terrain de 14 × 14 cases, soit une centaine d'objets par vue. `rendreVue` ajoute `fwd`, `center` et une copie de `scene.ombre` (1707-1709), la glace autant (1584).
- Correctif proposé : Dans FERRO de référence : ranger les bornes dans la nappe à `chargerNappes`. Côté jeu : un objet `sun` réutilisé par vue, dont on écrit `center[0..2]`.
- Risque : Module verrouillé pour la partie moteur. Nombre de tuiles de terrain estimé, non compté.

## Points d’entrée utiles

- `installer(i, saison)` — /Users/david/Projects/bitume/src/jeu.js:134-163 : construit et téléverse le décor, réutilise la scène si la clé est identique (ligne 141). Point d'insertion naturel pour les caches de nature et le second moteur.
- `lancer(type, i, enl, conditions)` — src/jeu.js:172-237 ; les trois poses du voile `#chargement` : `demarrerSeance` (2364-2374), `lancerEnLigne` (1115-1124), `demoSuivante` (2089-2096). Voile : src/index.html:471, src/style.css:227-228 (fondu de 0,3 s).
- `oublierIntervalle()` — src/jeu.js:2471-2476 : remet à zéro l'intervalle d'image, la fenêtre du gouverneur et les mesures. Aujourd'hui appelé seulement au changement de visibilité, au retour du focus et après la détection.
- `decor.herbier` (accesseur, src/decor.js:1215) et `decor.surfaceHerbe` (1216) : forcent l'herbier à la demande ; cache `HERBIERS` par circuit et par clé (675, 1198-1210).
- `B.faune.creer(c, decor)` (src/faune.js:135-141), `B.effetsSaison.creer(c, decor)` (src/effets-saison.js:36-73), `B.aurores.creer(c)` (src/aurores.js:57) : sans effet de bord, appelables dans `installer` ; les habitats de la faune ne sont plus modifiés après création.
- `rendu.setWorld`, `setNappes`, `setLots` (src/moteur/renderer.js:2785, 2721, 2741) et `rendu.calibrate(camera, dynamic, fx, frames)` (3233-3243) : N images avec `readPixels`, réutilisable comme chauffe sous le voile. `rendu.stats` donne lots, lotsVisibles, lotDistanceTests, lotInstanceTests, uploadBytes, drawCalls, triangles.
- `B.sceneBench.creer(rendu, capacites)` puis `preparer(id, options)` et `dessiner(temps, vue)` (src/scene-bench.js:29-59) : modèle existant « bâtir un décor par palier puis dessiner des images », utilisé par la détection graphique.
- `lot.bascule`, `lot.lodReferenceFov`, `lot.lodReferenceHeight` sont relus à chaque image (renderer.js:25-33, 43-45) ; `fx.groundCover` {density, distance} aussi (renderer.js:54-66, valeurs dans src/graphismes.js:23-28) : le détail se règle sans reconstruction ni téléversement.
- Formes enregistrées une fois au chargement de la page : `B.vegetation.installer` (src/vegetation.js:316-325, appel ligne 570), `B.botanique.installer` (src/botanique.js:281-290), caches `PLANS` et `CACHE` (119, 243). Aucune forme n'est créée en course.
- `circuits[]` (src/jeu.js:79-83) garde les circuits générés. `B.decor.construire` tourne sans DOM (il s'exécute dans Node pour les tests), donc aussi dans un Worker si l'on veut sortir la construction du fil principal.
- `finirClassement` (src/jeu.js:2409-2429) : tranches de 4 ms enchaînées par `setTimeout`, modèle prêt à copier pour étaler la construction.
- Mesure : `BITUME_JEU.banc({ duree, qualite, circuit })` (src/jeu.js:2818-2856, une seconde de chauffe), `B.mesures.section(nom, ms)`, /Users/david/Projects/bitume/tools/mesurer-prairie.mjs et /Users/david/Projects/bitume/tools/budget-decor.mjs.

## À mesurer

- Durée de chaque étape de `B.decor.construire` dans un navigateur (nappesRoute, nappesTerrain, objets, `creerHerbier`, `vegetation.construire`), puis de `setNappes` et `setLots`, par circuit et par palier, sur une petite machine. Le dépôt ne contient que `setLots` (57 à 106 ms CPU au banc Node, WebGL inerte).
- Durée réelle de la première image d'une course en cockpit : `FRender.create` du second moteur, copie du décor, `B.faune.creer`, `B.effetsSaison.creer`. Même mesure en basculant de poursuite à cockpit en pleine course.
- Coût, dans un navigateur, du parcours des lots par draw() (environ 1 µs par lot au banc Node) à 2 394 lots, puis après regroupement ; part due à la glace de rétroviseur et à la vue du joueur 2.
- Tas JS réellement vivant après le chargement d'un circuit, puis après les sept (démo) ; durée des GC majeurs pendant un tour dans Chrome, Firefox et Safari. Les 336 à 373 Mo du banc sont relevés sans GC forcé.
- Rayon réel des lots de tronçon et part des arbres dessinés en version proche au-delà de 520 m ; triangles et temps GPU par image en Fine sur un GPU intégré, avant et après regroupement par cases et forme lointaine légère.
- Le premier dessin de chaque tampon de lot (près de 4 800) coûte-t-il pendant le premier tour (ANGLE/D3D11, Metal) ? Comparer le p99 des intervalles du tour 1 et du tour 2. Supposition non vérifiée.
- Répartition exacte des lots de prairie entre cases proches (24 m) et lointaines (64 m), et part des lots lointains jamais à portée de couverture en vue cockpit à 60° et 1080p.
- En qualité Auto : fréquence réelle de la baisse de palier trois secondes après le départ (journal de `palier.n`), à 60 Hz et à 120 Hz.
