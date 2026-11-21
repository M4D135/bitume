# Référence race — pistes enregistrées le 21 novembre 2026

**État : demande de David enregistrée et huit pistes intégrées au programme du chantier. Étude documentaire ; aucune de ces pistes n’est annoncée comme implémentée ou qualifiée.** La réalisation reste découpée en petits lots, selon les propriétaires ci-dessous. Rattachement documentaire principal dans `FILE-TRAVAIL` : **`references`** ; les autres identifiants cités sont ceux du programme existant, sans nouveau lot runtime dans cette livraison.

## Référence et limites de la lecture

Référence fournie par David : [satyam-fp/race](https://github.com/satyam-fp/race/tree/4a2a65f146aa0e70547c191c77a2490511db44a8), commit **`4a2a65f146aa0e70547c191c77a2490511db44a8`**, « Tachyon Sprint: v0 and v1 web builds ». Le [point d’entrée](https://github.com/satyam-fp/race/blob/4a2a65f146aa0e70547c191c77a2490511db44a8/index.html) ouvre v0 ; cette étude examine explicitement **v1**.

Le dépôt publie des builds : [game.js](https://github.com/satyam-fp/race/blob/4a2a65f146aa0e70547c191c77a2490511db44a8/v1/game.js) expose l’interface, [car.js](https://github.com/satyam-fp/race/blob/4a2a65f146aa0e70547c191c77a2490511db44a8/v1/car.js) est la colle wasm-bindgen. **Les sources Rust de simulation, de terrain et de placement sont absentes.** La lecture ne permet pas de reprendre ni de certifier leurs lois physiques ou leur composition spatiale. Certains shaders sont néanmoins présents textuellement dans [car_bg.wasm](https://github.com/satyam-fp/race/blob/4a2a65f146aa0e70547c191c77a2490511db44a8/v1/car_bg.wasm) : extraction ASCII statique, sans exécution ni désassemblage.

**Licence non identifiée** dans l’arbre suivi examiné. Le [manifeste des ressources](https://github.com/satyam-fp/race/blob/4a2a65f146aa0e70547c191c77a2490511db44a8/v1/assets/bc/list.txt) ne fournit pas une autorisation de reprise. Aucun code, asset, modèle, texture, cubemap ou enregistrement importé ; les adaptations envisagées sont originales et procédurales. Aucun jeu de la référence exécuté, aucune mesure de sa performance ou appréciation de conduite revendiquée.

## Huit pistes rattachées aux lots

### Décor et réalisation

Les fonctions citées dans ce tableau appartiennent aux shaders embarqués, identifiés précisément plus bas.

| Piste | Observation attestée | Déjà dans BITUME / apport encore à faire | Lot et portée | Critère d’acceptation proposé |
|---|---|---|---|---|
| **R1 — Chaussée posée en bandes** | `ground.wesl`, `fragment`/`patches` : joints, tronçons décalés et rugosité organisés longitudinalement. | Granulat, fissures, reprises et bruit lent existent (`decor.nappesRoute`, matériaux). Ajouter une logique de pose suivant le circuit, sans refaire ces effets génériques. | `matieres` / `rendu` — **04**, raccord **02 FERRO** ; présentation, **p15 inchangé**. | Joints et reprises suivent la route sans répétition gênante ; comparaison sec/mouillé et soleil rasant ; mêmes reliefs, graines, surfaces de conduite et seuils de coût. |
| **R2 — Contacts entre sols** | `ground.wesl`, `by_height`/`fragment` : le relief des couches découpe les bords terre–gravier–herbe. | Écologie, poches de couleur et continuité sol/végétation existent. Ajouter des contacts proches irréguliers, au lieu d’un simple fondu, avec des hauteurs procédurales propres. | `matieres` / `rendu` — **04**, raccord **02 FERRO** ; présentation, **p15 inchangé**. | Zéro trou, scintillement ou décalage de surface ; aucun gravier visuel contradictoire avec la conduite ; deux couches au plus dans la transition, coût GPU comparé. |
| **R3 — Évaluation distante allégée** | `ground.wesl::fragment` réserve normales/couches/grain fins aux pixels proches ; dérivées préparées avant les branches. | `surfaceNoise`/`fineDetail` filtrent déjà le résultat. Étudier l’arrêt explicite des calculs dont le poids est nul, avec seuil en pixels. | `calcul_conditionnel` / `rendu` — **02**, lot 5 ; présentation, **p15 inchangé**. | Image stable aux transitions ; mesure GPU avant/après à scène identique, médiane et p95 consignées. Retenir seulement un gain reproductible ; aucune nouvelle passe ni allocation en course. |
| **R4 — Silhouettes de forêt très lointaines** | `woods.wesl::vertex` tourne une carte autour du pied ; `woods_prepass.wesl::vertex` reproduit sa profondeur. | Les arbres ont déjà LOD, lots et bascules en pixels. Étudier un niveau supplémentaire pour les massifs denses, généré depuis la botanique BITUME. | `rendu` / `matieres` — **02 + 04** ; piste secondaire, **p15 inchangé**. | Pieds et silhouettes conservés, pas de saut lors des bascules ; cohérence couleur/profondeur/ombres/rétros/duo. Mesurer remplissage alpha et mémoire : moins de triangles ne suffit pas. |

### Réactions, son et compréhension du véhicule

| Piste | Observation attestée | Déjà dans BITUME / apport encore à faire | Lot et portée | Critère d’acceptation proposé |
|---|---|---|---|---|
| **R5 — Pneus audibles par état** | [sound.js, `play()`](https://github.com/satyam-fp/race/blob/4a2a65f146aa0e70547c191c77a2490511db44a8/v1/sound.js#L295-L342) distingue approche de limite, blocage, patinage et dérive, avec deux côtés. | Son de glisse et vibrations différenciées existent. Séparer les timbres procéduraux avec la télémétrie disponible, sans inventer quatre mesures de roues indépendantes. | `conduite` — retour sonore **5C**, raccords **01/00** ; présentation, **p15 inchangé**. | Sur mêmes rejeux, reconnaître blocage, patinage et dérive à l’écoute ; silence aux volumes nuls, budget de voix et allocations respecté ; états physiques identiques. |
| **R6 — Impact puis raclement** | [sound.js, `play()`](https://github.com/satyam-fp/race/blob/4a2a65f146aa0e70547c191c77a2490511db44a8/v1/sound.js#L353-L380) sépare coup initial et contact prolongé. | Les coups `choc`/`contact` existent. Ajouter un raclement original piloté par la persistance et le matériau réellement exposés ; vérifier cette télémétrie d’abord. | `conduite` — retour sonore **5C / lot 2**, raccord **00** ; présentation, **p15 inchangé**. | Même comportement à 30/60/120 images/s, durée en secondes ; zéro rafale de coups pendant le contact, extinction à la séparation. Ne pas convertir implicitement les N·s de la référence en m/s BITUME. |
| **R7 — Avaries compréhensibles** | [game.js, `damage()`](https://github.com/satyam-fp/race/blob/4a2a65f146aa0e70547c191c77a2490511db44a8/v1/game.js#L799-L817) présente une vue localisée des dégâts fournis. | `degats.sante()`/`avaries()` et jauge existent. Prévoir un résumé en pause/stands, limité aux informations réellement conservées. | `conduite` / `menu_arcade_profils_modestes` — **lot 2 / 03**, raccord **00** ; présentation, **p15 inchangé**. | Chaque indication correspond à une avarie et suit sa vraie réparation ; zéro point d’impact ou pourcentage de puissance inventé ; aucune nouvelle pénalité mécanique. |
| **R8 — Expliquer une récupération** | [game.js, `wayBack()`](https://github.com/satyam-fp/race/blob/4a2a65f146aa0e70547c191c77a2490511db44a8/v1/game.js#L752-L788) explique un blocage et rappelle la commande configurée. | Blocage, contresens et remise en piste automatique existent. Réutiliser ces états pour une indication courte, sans détecteur parallèle. | `menu_arcade_profils_modestes` / `conduite` — **03**, raccord **00** ; présentation seule. Changer le délai ou la remise en piste serait un **lot de conduite distinct**. | Zéro invite pendant arrêt volontaire ou aux stands ; commande exacte clavier/manette ; disparition au redémarrage ; cadence et résultat de récupération inchangés. |

## Preuves des shaders embarqués

Les noms `src/ground.rs` et `src/country.rs` apparaissent dans le binaire ; ils ne désignent pas des fichiers Rust publiés. Les offsets ci-dessous sont des positions d’octets dans **v1/car_bg.wasm**, au commit cité. Aucun texte de shader n’est recopié dans la documentation ni les rapports.

| Chaîne embarquée | Fonctions utiles | Offset / longueur, octets | SHA-256 de la chaîne ASCII |
|---|---|---|---|
| `ground.wesl` | `fragment`, `patches`, `by_height` | 61617614 / 17173 | `47b3020681b85ea4fc510769aef14327b68e79377eab1c40e02f8e6b4b603b54` |
| `woods.wesl` | `vertex` | 61635023 / 1989 | `0815ef0ac014e3460d77f2b835a02155b7247401cd460f792e027856a1aaf1b1` |
| `woods_prepass.wesl` | `vertex` | 61637048 / 1896 | `665eed0b740001e8d1e22c469aa4e16f7053acb87f7720442be35984e3cbd55e` |

## Cadre de réalisation et reçus

Les vibrations différenciées, la zone morte remappée, le mix selon la caméra, l’écologie, les LOD, le mobilier des stands et les repères de freinage **sont déjà présents** : cette référence ne les transforme pas en nouveautés. Elle ne justifie ni un nouveau cadrage cockpit, ni une importation d’aides ABS/TC/stabilité. Changer adhérence, suspension, restitution, commandes, effets des dégâts ou règles de récupération imposerait un lot distinct avec nouveau modèle/version de physique ; ces huit pistes n’en proposent pas la modification.

Les travaux shader passent par le **dépôt FERRO canonique**, puis une version qualifiée et la mise à jour du verrou ; aucune retouche locale des copies `src/ferro` ni d’un autre module verrouillé. Préserver p15, les neuf circuits, graines, reliefs, budgets et le seuil décor strict **< 150 ms**. Les métriques ci-dessus sont des critères futurs, pas des résultats obtenus. Aucun gain FPS/Xbox/CPU/GPU affirmé.

Rattachements : [04 saisons/matières](PARALLELE-2026-11-20/04-SAISON-MATIERES.md), [02 performance](PARALLELE-2026-11-20/02-PERFORMANCE.md), [lot 5 dont 5C audio](05-PERFORMANCE.md), [lot 2 crashs](02-CRASHS.md), [03 menu/manette](PARALLELE-2026-11-20/03-MENU.md), [programme mémoire/géométrie/matières](OPTIMISATION-MEMOIRE-GEOMETRIE-MATIERES-2026-11-20.md). Ces rattachements enregistrent le travail ; ils ne déplacent pas la priorité du correctif en cours.

Reçus statiques recopiés à l’identique : [décor](rapports/REFERENCE-RACE-2026-11-21/decor.json) et [véhicule](rapports/REFERENCE-RACE-2026-11-21/vehicule.json). Ils conservent les constats, fonctions, limites, empreintes et comparaisons BITUME. Ce lot ne modifie ni runtime, ni tests, ni build ; aucun commit, push ou appel GitHub effectué.
