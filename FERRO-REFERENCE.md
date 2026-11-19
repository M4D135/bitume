# FERRO — référence commune 0.3.12

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

Canon publié vérifié : `a22b738fbe2aa2b36b659fca94527acc2ffcd635`, arbre `c858dea55ae3b38c307910124936394671cfbf74`. Le reçu et les preuves exactes sont annexés dans `docs/reprise/rapports/VIRAGES-REFLETS-2026-11-19/ferro-canonique/`. EMPRISE : 9/11 contrats ciblés, deux échecs hérités, build complet bloqué par `src/city-data.js` indisponible ; aucune qualification complète du jeu EMPRISE revendiquée.
