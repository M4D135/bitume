# Lot 09 — prairies naturelles et montagne vivante

## Résultat — 18 novembre 2026

BITUME **0.2.32**, FERRO **0.3.8**. Base du jeu : 0.2.31 (`ff40baa98069ecb64dd7d263672b2c040d4adc09`), checkpoint de reprise `e4d3e74b76ed03222424077bad1939acbd5e60c0`. FERRO a été publié en premier : [`ef722c0`](https://github.com/M4D135/FERRO/commit/ef722c0c56e04a20574db53b057f339968d714c3), puis ses 34 modules exacts installés avec le verrou. Jeu publié et relu : [`e90b08f`](https://github.com/M4D135/bitume/commit/e90b08f550eae2bda47ad14d4093911d3fd793d2), arbre `557ba44aeb3f2dc92c2b64c9fc1ebdee11e11c8e`. [Reçu vérifié](rapports/prairies-vivantes-2026-11-18/publication.json).

### Choix avant la course

**Jour / Crépuscule / Nuit / Cycle** sont disponibles dans la préparation, à côté de la météo, ainsi que dans Réglages. Les deux groupes sont synchronisés et le choix est mémorisé. Jour est le défaut ; Cycle dure six minutes. Les trois circuits acceptent chaque moment. En ligne, l’hôte annonce et impose le moment pour la course sans écraser la préférence personnelle des invités. Les rétroviseurs, y compris simplifiés, suivent la lumière.

Les couleurs nocturnes ordinaires s’appliquent à tous les circuits. La palette féerique et les lucioles restent propres au **Haut-Col**, dernier circuit de montagne. Le ciel standard FERRO ajoute progressivement lune et étoiles ; son repli Canvas adapte la lumière sans ces astres.

### Prairie et vent

La plantation couvre les vrais triangles de terrain herbeux et d’accotement, avec un hasard déterministe indépendant de la simulation. Elle respecte les routes, stands, tunnel, eau, roches, bâtiments et couches de sol supérieures. Les motifs de plantation, hauteurs, orientations et tons varient ; les bandes de couleur régulières des sols sont adoucies aux paliers supérieurs. Les pieds suivent les triangles inclinés via `groundShear`, avec 5 mm d’enfouissement volontaire.

Le mode **Extrême** dépasse le ×10 supplémentaire demandé dans des disques locaux fixes comparés à la 0.2.31. Minima mesurés sur 28 disques : forêt **×14,87**, côte **×14,71**, montagne **×14,18** ; au moins 239,93 brins/m². La vérification du sol porte sur 278 972 ancrages d’instances. Ces mesures locales sont distinctes de l’extension de surface.

Le vent ambiant combine rafales, balancement, vent transversal et frémissement ; le sillage des voitures continue d’agir. Les racines restent ancrées, le calcul des ombres utilise les mêmes positions et le même masque de couverture. L’animation est effectuée dans les shaders ; aucun parcours JavaScript de chaque brin ni renvoi permanent des instances statiques.

### Faune et niveaux de détail

Les abeilles et autres insectes sont procéduraux en 3D : corps, ailes animées, trajectoires absolues et habitats validés sur l’herbe. La nuit à Haut-Col, les lucioles bougent et pulsent avec un halo, sans ajouter de sources lumineuses ponctuelles. La pluie et l’heure modulent l’activité. Les vues J1/J2 ont des réserves d’objets réutilisées ; les rétroviseurs reprennent les mêmes sorties. La faune reste disponible si l’herbe dessinée est désactivée.

| Faune | Abeilles | Autres insectes diurnes | Lucioles nocturnes |
|---|---:|---:|---:|
| Léger | 2 | 0 | 6 |
| Moyen | 5 | 3 | 16 |
| Élevé | 12 | 8 | 64 |
| Extrême | 32 | 16 | 256 |

Réglage séparé **Selon qualité / Désactivés / Discrets / Modérés / Nombreux / Foisonnants**. Le profil automatique le plus léger désactive la faune par défaut ; un choix manuel reste respecté. Les transitions ne cumulent pas les deux maxima diurne/nocturne.

### Coût et optimisations

Léger et Désactivé sont conservés. Les maillages sont partagés et regroupés en secteurs ; la densité se réduit progressivement à 1/8, puis se fond vers le sol avant la fin de portée. Le rejet des brins éteints précède leur animation. Les états lumineux et les tableaux d’instances sont réutilisés. Les secteurs Moyen/Élevé ont été réduits après mesure du premier candidat.

Banc reproductible : `node tools/mesurer-prairie.mjs REPO COMMIT_OU_WORKTREE SORTIE.json QUALITE`. Forêt, FOV 60°, 960 × 540, herbe seule, couleur + ombre, trois vues. **WebGL instrumenté inerte : il compte les soumissions et le CPU, sans exécuter le GPU.**

| Niveau | Triangles soumis selon la vue | Appels selon la vue | CPU médian du banc inerte |
|---|---:|---:|---:|
| Moyen | 0,183–0,234 million | 146–161 | 3,23–3,48 ms |
| Élevé | 0,692–0,964 million | 242–285 | 3,71–4,05 ms |
| Extrême | 34,194–35,371 millions | 775–1330 | 6,21–6,33 ms |

**Extrême est volontairement manuel et nettement plus coûteux que la 0.2.31.** Les triangles comptés incluent ceux éteints ensuite dans le shader. Les 129–167 millions de brins construits sur le territoire complet ne sont pas tous dessinés en même temps. La RSS du banc n’est ni la VRAM ni la mémoire réelle du navigateur. Aucun gain global de FPS ni résultat sur portable ou RTX 5090 n’est affirmé sans mesure matérielle.

## Qualification et preuves

- Jeu : **49 suites passées**, sources inchangées pendant leur exécution. Après ce passage, seule `vegetation.js` a évolué ; sa suite finale fournit **16 contrôles réussis** sur les sources gelées. Total : **50 suites**. Détails et empreintes archivés.
- Prairies : 15 couples qualité/biome ; densité locale, terrain réel, ancrage, bornes et sous-ensemble lointain vérifiés. Faune : 12 contrôles, trois circuits, végétation désactivée, vues multiples et réserves réutilisées.
- FERRO : 156 contrôles réussis, zéro échec, un TODO physique historique ; 18/18 étapes WGSL validées. Probes EGL/Mesa logiciel : vent visible, pieds fixes, accord couleur/profondeur et réduction de couverture. Aucun GPU matériel qualifié.
- Construction répétée identique : **13 075 203 octets**, SHA-256 `99f404b8df5dd6dc520545c79d572cd8af0254a71bd7e19a18a125909110b86b`. L’ancre m4d135 qui enregistre `BITUME.html` est conservée exactement.
- Rapports : [prairies et intégration](rapports/prairies-vivantes-2026-11-18/LISEZ-MOI.md), [faune](rapports/faune-2026-11-18/), [preuves FERRO](https://github.com/M4D135/FERRO/tree/ef722c0c56e04a20574db53b057f339968d714c3/docs/local-wind-038).

## Limites et prochain petit lot

La politique de sécurité CUA a refusé l’ouverture du fichier local ; aucun contournement n’a été tenté. Le rendu final du jeu, le placement visuel des commandes et les FPS sur le matériel de l’utilisateur restent à contrôler. La carte des racines du rapport est une visualisation de données, pas une capture du jeu.

Le déploiement est déjà autorisé, mais nécessite `./deposer.sh` depuis le Mac disposant de l’accès amiga. Cet environnement n’a pas cet accès. Vérifier la page servie séparément : publier Git ne signifie pas déployer. Prochaine étape bornée : déploiement, contrôle Haut-Col Jour/Nuit/Cycle, vent et choix de niveaux sur matériel réel ; corriger seulement les défauts constatés.
