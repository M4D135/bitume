# EMPRISE — qualification locale ciblée FERRO 0.3.12

## Résultat

**9 contrôles réussis sur 11 ; les 2 échecs existaient sur EMPRISE/FERRO 0.3.3 et sur le canon 0.3.11. Aucun nouvel échec isolé au correctif 0.3.12.**
88 sources JavaScript sur 88 passent `node --check`. Les 34 modules installés passent le verrou et correspondent aux SHA256 canoniques.
La qualification est limitée aux contrats exécutés ; aucune scène navigateur ni mesure FPS n'a été effectuée.

## Provenance exacte

- EMPRISE main : `cc004826a506e6979eaaec217748fe85d5cd6ac5` ; arbre `8251fffbe0d5d92f6ed65d0810c68c48141614cd`.
- Checkout sparse : 124 fichiers récupérés/vérifiés par leur SHA Git ; commit Git exact, HEAD détachée ; aucun changement distant.
- Aucun AGENTS.md/CLAUDE.md suivi dans cet arbre. Instructions lues : README.md, FERRO-REFERENCE.md, build.py, docs/VERIFICATION.md et docs/WEBGPU.md ; règles canoniques FERRO également lues.
- Canon installé : `97939de3c8fe71848ae95893ebed2eff1331bb16` ; FERRO **0.3.12**.
- Installateur SHA256 : `47d166c4376396930f67987cbc522505753a8b9d0a4263dd7034d83b30c4afce`.
- Verrou hôte SHA256 : `ad918246626e3d16c2f3a06ef7adfd5c074e38fc947c1ba97eff3399711d2190`.
- Renderer SHA256 : `c93f4727e4922d176c7bd70f3ebb556c8c4f96538484b48bdb8cdd95ee386982`.
- Engine SHA256 : `3cb56d0ba2bf98a9b4e62a0b440949751aa71f8ea8bc58ab4953e8baa0053c2f`.
- Depuis le verrou EMPRISE 0.3.3, cinq modules diffèrent : renderer, webgpu-shaders, webgpu-renderer, recipes, engine. Depuis le canon 0.3.11, seuls renderer et engine changent.
- 88 fichiers hôte hors verrou/modules/installateur sont demeurés strictement identiques à la base récupérée.

## Contrôles exécutés

| Contrôle | Résultat |
|---|---|
| render-backends | Réussi |
| render-backends-handoff | Réussi |
| webgpu-renderer | Échec hérité, comparé ci-dessous |
| shadow-bias | Réussi |
| renderer-overlay | Échec hérité, comparé ci-dessous |
| renderer-recovery-lifecycle | Réussi |
| frame-timestamp | Réussi |
| weather | Réussi |
| day-night | Réussi |
| options-host | Réussi |
| ferro-lock | Réussi |

Commande reproductible : `python3 /workspace/scratch/1b28de5a23b5/emprise-qualif-reflets-evidence/qualifier.py`. Les commandes unitaires exactes, durées et journaux sont dans `qualification.json` et `logs/`.
Les sept tests directs sont les fichiers EMPRISE non modifiés, exécutés avec Node. Météo et jour/nuit conservent toutes leurs assertions ; leur import général de toute la ville est remplacé **dans un chargeur de qualification externe** par le vrai module `src/weather.js`, sans donnée de ville substituée.
Le contrat options exécute les handlers et l'appel `renderer.draw` extraits de `src/game.js`, dans douze combinaisons : reflets activés/coupés, ombres, pluie extérieure/abri ; humidité et dérive nuageuse arrivent au renderer, MSAA demeure demandé. Ce contrôle de branchement n'est pas un rendu GPU.

## Échecs comparés

- `webgpu-renderer.mjs`, ligne 57 : attente 0, valeur 128. Même assertion/valeur sur FERRO **0.3.3, 0.3.11 et 0.3.12**.
- `renderer-overlay.mjs` : son extraction de source ne fournit pas tous les noms du renderer. Échec `packOverlay is not defined` sur la base **0.3.3** ; `photoOverlay is not defined` sur **0.3.11 et 0.3.12**. Aucune modification de test pour masquer l'échec.
- Comparaisons exécutées dans des répertoires locaux séparés avec les vrais modules base/canon et les tests identiques. Journaux complets : `comparison.json`, `logs/*-0.3.3.log`, `logs/*-0.3.11.log`.

## Limites concrètes

`python3 build.py` a réellement été lancé après installation. Le verrou passe ; l'assemblage s'arrête sur **src/city-data.js absent**, sans produire de build complet qualifié.
Blob requis : `e4da08a8a5984db10b704ec181ecfc82338774b1`, **13975402 octets**. GitHub Contents renvoie un contenu vide, Raw est refusé, les appels Git Blob ferment le transport. Aucun nouvel essai après confirmation du blocage. `coast-data.js` et `places-data.js` ont été récupérés et vérifiés exactement ; seule la donnée city-data manque.
Aucune donnée géographique ni physique n'a été régénérée ou remplacée. Les tests navigateur du jeu/options, une scène WebGL/WebGPU et les FPS matériels restent non exécutés. Aucun déploiement, publication ou changement de référence distante EMPRISE.
