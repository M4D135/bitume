# FERRO — référence commune 0.3.25

Décision de David du 16 novembre 2026 : entièrement procédural, aucun plafond de taille du code ni du build. Moteur prioritaire, atelier secondaire.

Référence : M4D135/FERRO, dossier src/ferro. Les 34 modules de FERRO.lock.json proviennent de cette source et doivent garder les mêmes empreintes dans les quatre jeux. Les règles et styles du jeu restent dans ses adaptateurs. Le build contrôle le verrou ; ne pas modifier les copies du moteur.

Propagation : depuis le checkout de référence, `python3 tools/install-ferro.py bitume <checkout>` recopie les modules identiques, régénère `FERRO.lock.json` et `tools/check-ferro-lock.py`. Le jeu ne retouche jamais une copie verrouillée.

Distribution et documentation : https://github.com/M4D135/FERRO/tree/main/dist

Le paquet contient les sources, les bundles optionnels, un installateur et le contrôleur des empreintes. Les tailles sont mesurées à titre informatif.

La version 0.3.4 ajoute quatre recettes de surface opt-in et un seuil de LOD adapté à chaque caméra. BITUME définit leur usage dans `decor.js` et ses formes dans `vegetation.js` ; les modules moteur restent copiés à l’identique. Qualification et limites : `docs/reprise/rapports/LOT5-2026-11-17.md`.

La version 0.3.5 (commit `7afe6d692f45892fc9fdf30ff46397a5ebe00498`) ajoute trois matières naturelles — `organicSoil` 25, `fibrousBark` 26, `botanicalFoliage` 27 — avec vent, mouillage et transmission solaire cohérents entre l’image et la passe d’ombres, et reporte l’allocation des cibles MSAA et SSR au premier rendu qui s’en sert. Le jeu choisit ces matières dans ses adaptateurs (`decor.js`, `vegetation.js`, `botanique.js`) ; les modules moteur ne sont pas touchés. Documentation du moteur : `docs/botanical-035/README.md` du dépôt FERRO.

La version 0.3.6 (commit `7d7f1018db33632ae448e6fd6e0b4f6b6f8fe5d1`) permet de régler à chaud `draw(..., {msaa, shadows, shadowMapScale})`. Le MSAA demandé explicitement fonctionne aussi sans halo. Les ombres changent de résolution sans recréer le contexte ; les limites GPU sont conservées et relues après restauration. BITUME applique ses options indépendantes dans `jeu.js`. Qualification et limites : `docs/reprise/07-OPTIONS-VEGETATION.md` et `docs/runtime-options-036/` du dépôt FERRO.

La version 0.3.7 (commit `0250a5750d10789976186a1491ffdf011fb19611`) ajoute le souffle local opt-in via `draw(..., {windSources})` et `windResponsive: true`, avec quatre sources GPU et des tableaux persistants. Les passes couleur et profondeur partagent la déformation ; WebGL2 et WebGPU utilisent les mêmes shaders de référence. Distances/LOD et bornes des lots sont réutilisés entre les passes d’une vue. Les 34 modules installés sont identiques à la référence ; le jeu fournit seulement ses sources de voitures et sa géométrie. Preuves moteur : `docs/local-wind-037/`. Qualification hôte : `docs/reprise/08-HERBE-SILLAGE-BRUME.md`.

La version 0.3.12 corrige les stries du SSR historique des flaques : lecture de profondeur explicitement `highp`, normales reconstruites au centre des texels, parcours du rayon en pixels avec raffinement et contrôle d’épaisseur, alpha prémultiplié pour les contours. Les 34 modules sont installés par le script canonique ; seuls le renderer et le numéro de version de l’API moteur diffèrent de 0.3.11. Les règles de conduite p13 restent dans le jeu et ne changent pas.

La qualification utilise les shaders réels sous EGL/Mesa sur des scènes analytiques. Elle ne vaut pas validation visuelle de BITUME dans un navigateur. Le SSR reste limité à la géométrie visible et son coût augmente dans le banc logiciel ; aucun gain FPS matériel n’est annoncé. Preuves canoniques : `M4D135/FERRO:docs/reflets-0312/`. Contrôles du jeu : `docs/reprise/rapports/VIRAGES-REFLETS-2026-11-19/`.

Canon 0.3.12 publié vérifié : `a22b738fbe2aa2b36b659fca94527acc2ffcd635`, arbre `c858dea55ae3b38c307910124936394671cfbf74`. Le reçu et les preuves exactes sont annexés dans `docs/reprise/rapports/VIRAGES-REFLETS-2026-11-19/ferro-canonique/`. EMPRISE : 9/11 contrats ciblés, deux échecs hérités, build complet bloqué par `src/city-data.js` indisponible ; aucune qualification complète du jeu EMPRISE revendiquée.

## Version 0.3.13 — PhysX et sols procéduraux

Canon publié : main `b09a4e82252dbcb43a363a19b3e43c0a90e9a41b`, PR #1, arbre
`4efb24f1cf2d8830b8f608cf859b2222ef08beca`. Adaptateur PhysX étendu pour les corps dynamiques de véhicules,
formes convexes, contacts, forces aux points et cycle de vie ; relief apparent plus riche pour `organicSoil`.
Les versions WebGL2 et WebGPU sont cohérentes ; le fragment world WGSL a été régénéré et validé avec Naga.
Le WASM PhysX 5.12.0 embarqué est inchangé. Les 34 modules ont été installés par le script canonique et
contrôlés à l’identique. Aucun calcul de conduite propre à BITUME n’est ajouté aux copies du moteur.

Qualification canonique : 208 réussis, aucun échec, un TODO hérité ; contrôles WASM et shaders EGL réels.
EMPRISE isolé : 9/11 contrats ciblés, deux échecs identiques avant/après ; 88 scripts valides, 34 modules exacts.
Le build complet d’EMPRISE reste bloqué par `city-data.js` indisponible. La sonde llvmpipe du shader de sol
mesure +14,5 % de coût dans ce cas logiciel ; aucune conclusion sur les FPS matériels du jeu.
Preuves : `M4D135/FERRO:docs/physx-sols-0313/`, `docs/physx-vehicles/`, `docs/sols-proceduraux/` et
`docs/reprise/rapports/PHYSX-SOLS-PILOTES-2026-11-19/PUBLICATION-FERRO-0313.json`.

## Version 0.3.14 — libération des vues PhysX

Main `85ba941709bb304cbc34f8beb7baab0639321919`, PR #2 fusionnée, arbre
`27c2f2dd23c57feedefc748213f22fd165a15635`. L’adaptateur retire les wrappers WebIDL empruntés de leurs caches
quand les mondes cessent de les utiliser ; le comptage des propriétaires protège les vues temporaires partagées.
Seuls `physx.js` et le numéro de version dans `engine.js` changent. WASM, lois, shaders, 32 autres modules identiques.

Canon : 210 réussis, 0 échec, 1 TODO ; 25 contrôles PhysX dont 72 destructions de mondes et deux mondes simultanés.
EMPRISE ciblé : 10/12 sur les deux versions (contrat PhysX ajouté aux onze précédents), deux échecs hérités identiques.
Ni tas natif ni FPS matériels mesurés. BITUME : 34 modules installés officiellement, douze reprises finales
réussies, 54 empreintes p14 exactes et fixture inchangée. Preuves et reçu sous
`docs/reprise/rapports/PHYSX-SOLS-PILOTES-2026-11-19/ferro-0314/` et `PUBLICATION-FERRO-0314.json`.

## Version 0.3.15 — cuir et textile procéduraux

Canon publié : main `47a1f7662028f9c84966b7c335b6cd10f3021086`,
[PR #4 fusionnée](https://github.com/M4D135/FERRO/pull/4), arbre
`11559c8e72320a99d171b9af3a8b67c90f3277d2`. Les recettes opt-in `fineLeather` 28 et `wovenFabric` 29
ajoutent un grain local irrégulier, une rugosité et un micro-relief filtrés à distance, sans changer les
matières 0–27 ni les maillages. Les quatre modules modifiés sont `renderer`, `webgpu-shaders`, `recipes`
et `engine` ; les 34 modules proviennent de l'installateur officiel et gardent les empreintes canoniques.
BITUME les choisit dans `cockpit-matieres.js`, chargé avant `voiture.js`. Les replis sont les matières 7 et 18.

Qualification locale canonique : 213 réussites, 0 échec, 1 TODO hérité. Les sondes GLSL sous EGL/Mesa
conservent exactement les pixels des 28 anciennes matières dans la scène analytique. EMPRISE isolé :
10/12 avant et après, deux échecs hérités identiques ; son build complet reste bloqué par `city-data.js`
indisponible. Ces mesures logicielles ne qualifient ni le rendu navigateur complet, ni les pixels WebGPU,
ni les FPS matériels. La CI GitHub n'a exécuté aucune étape : le compte est bloqué par un problème de
paiement ou de limite de dépenses, consigné sur la PR avant fusion. Notice et synthèse canoniques :
[`docs/upholstery-0315/`](https://github.com/M4D135/FERRO/tree/47a1f7662028f9c84966b7c335b6cd10f3021086/docs/upholstery-0315).


## Version 0.3.16 — fondu des modèles opaques

BITUME utilise le commit `eda17f82cfb33feda52cf4e3f730b4ab87ffc410` de la branche
`M4D135/FERRO:codex/ferro-opacity-reception-20261121`. Au contrôle du 22 novembre 2026,
la branche principale de FERRO référençait encore la version 0.3.15. L’installateur de ce
commit reproduit les 34 empreintes du verrou de BITUME. Le fondu conserve la géométrie
et la matière de l’animal. Le souffle des baleines utilise la passe d’effets.
[Qualification de l’opacité dans le dépôt FERRO](https://github.com/M4D135/FERRO/tree/eda17f82cfb33feda52cf4e3f730b4ab87ffc410/docs/opaque-opacity-0316).


## Version 0.3.17 — teintes du terrain

Le terrain de la Stura interpole la couleur aux sommets des versants relevés. Les deux niveaux de détail partagent leur teinte à la jonction de la couronne avec l'accotement. L'option agit dans les passes existantes de WebGL2 et WebGPU. [Canon et qualification des shaders](https://github.com/M4D135/FERRO/tree/767c0d5e50bedc9325c74ce7b1387b9bb352c8c1/docs/terrain-tint-0317)

## Version 0.3.18 — réutilisation des sommets

La scène et les rétroviseurs activent `indexRegisteredShapes`. Deux sommets d’une forme enregistrée partagent un index lorsque leurs six composantes flottantes, position et normale, ont exactement les mêmes bits. Le moteur conserve l’ordre et le nombre des triangles. Le pilote de WebGPU et WebGL2 prend aussi en charge le remplacement d’une forme et la restauration du contexte. [Commit canonique](https://github.com/M4D135/FERRO/commit/39e8e19f90efcfb791f17054e47c7aa798df9fb7)

## Version 0.3.21 — chargement à l’approche et surfaces naturelles

Les huit circuits utilisent les lots progressifs et les pigments interpolés du moteur. Chaque contexte graphique peut charger et libérer ses propres tampons. Le jeu prépare les lots voisins des caméras et des voitures. Les premiers plans de Pietraporzio et d’Argentera peuvent construire les détails de façade à la demande. [FERRO 0.3.21](https://github.com/M4D135/FERRO/commit/ba7d14cbfc1bed01a1f6ac4d5a764524edd42762)

## Version 0.3.22 — terrain, décor instancié et reflets

Les huit circuits déclarent les bornes fixes de leurs nappes au moteur. La vue principale et chaque rétroviseur peuvent écarter des secteurs entiers à partir de ces bornes. WebGL2 garde la configuration des lots de décor en mémoire et réutilise la même image pour les reflets et le halo quand la caméra dessine une vue sans habitacle superposé. [FERRO 0.3.22](https://github.com/M4D135/FERRO/commit/aae3fa19cf1c7fe0f8cb65dbd2e3c2e4ecba7a39)

## Version 0.3.23 — cockpit et reflets

Les deux vues principales de BITUME activent `cullRigidOverlay`. Les pièces rigides hors champ restent disponibles pour l’ombre proche. Les reflets de la chaussée peuvent ignorer les zones entièrement couvertes par l’habitacle à partir de la couleur finale. [FERRO 0.3.23](https://github.com/M4D135/FERRO/commit/0db8e73f2f0c66db85c4cc18198bcfba68310190)

La version 0.3.24 compacte les sommets des nappes de terrain rigides à 40 octets sur WebGL2 et WebGPU. Le cockpit WebGL2 écarte les objets qui ne peuvent projeter d’ombre dans la carte solaire et les fragments hors du volume de sa tuile locale. [Commit du moteur](https://github.com/M4D135/FERRO/commit/f9195273ceed7e0a01ed8dc221aa3cfdc554b03e)

La version 0.3.25 écarte les groupes d’instances hors du volume de l’ombre solaire proche sur WebGL2. Le calcul du contact de l’ombre partage la projection entre la caisse et les quatre pneus. [Commit du moteur](https://github.com/M4D135/FERRO/commit/5702caa5f3968a33bbe86b7a758c6c18cac4d3be)
