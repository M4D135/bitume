# Mesures du lot 28 « calcul » (18/11/2026)

Machine : Apple M5 (10 cœurs, 24 Go), Chrome 157 sans interface (jamais de fenêtre visible), Node 24.18. La machine
était chargée par d'autres agents (charge 13 à 160, notée dans chaque fichier) : les temps muraux de la page varient
jusqu'à ×3 d'un essai à l'autre ; les temps processeur de Node sont plus stables. Page mesurée : `dist/bitume.html`
de l'arbre (0.2.39), ouverte en `file://`. Rien de `src/` ni de `verifications/` n'a été modifié.

| Fichier | Contenu | Produit par |
|---|---|---|
| `construction-node.json` | construction d'un niveau étape par étape, 7 circuits × Fine et Moyenne × 3 essais, temps processeur, poids produit | `node --expose-gc prototypes/calcul/construction-node.mjs --circuits 0,1,2,3,4,5,6 --paliers high,medium --reps 3 --sortie F` |
| `page-menu.json` | image figée au choix du circuit et à la première image de course, circuits 0, 2, 3, 6, ×1 et ×4, 3 essais | `python3 prototypes/calcul/page-instrumentee.py dist/bitume.html /private/tmp/calcul-28/bitume-instrumente.html` puis `sh prototypes/calcul/serie-page.sh` |
| `banc-image.json` | calculs par image (profileur de V8), une série de 8 courses de banc | `sh prototypes/calcul/serie-banc.sh`, puis `node prototypes/calcul/depouiller-banc.mjs` |
| `banc-image-medianes.json` | médianes de 3 séries pour Val-Brûlé soleil et Haut-Col pluie, ×1 et ×4 | `node prototypes/calcul/medianes-banc.mjs r0.json r1.json r2.json` |
| `herbier.json` | herbier original contre JavaScript resserré et WebAssembly (scalaire, SIMD), identité au bit | `node --expose-gc prototypes/calcul/herbier/banc-herbier.mjs --circuit 0 --reps 5 --wasm herbier.wasm` |
| `worker-cache.json` | Worker pendant le chargement, cache IndexedDB (graphe, JSON, binaire), OPFS, en `file://` | `sh prototypes/calcul/serie-worker-cache.sh /private/tmp/calcul-28/wc3 2,6 1 3 high` |
| `webgpu.json` | sonde WebGPU de la machine et banc de particules en calcul GPU contre JavaScript | `node prototypes/calcul/page-mesure.mjs --page dist/bitume.html --script prototypes/calcul/scenario-webgpu.js` |
| `determinisme.json` | monde rebâti avec Math.sin, cos, pow, exp… décalés d'un ulp | `node prototypes/calcul/sensibilite-ulp.mjs 0,2,3,6` |

Les résumés se refont depuis les mesures brutes (dans `/private/tmp/calcul-28`, non conservées dans le dépôt) avec
`node prototypes/calcul/rassembler-rapports.mjs`.

Noyau WebAssembly de l'herbier :

```sh
/opt/homebrew/opt/llvm/bin/clang --target=wasm32 -O3 -ffp-contract=off -nostdlib -Wl,--no-entry -Wl,--export=noyau \
  -Wl,--export=__heap_base -Wl,--import-memory prototypes/calcul/herbier/herbier.c -o herbier.wasm   # ajouter -msimd128 pour la variante SIMD
```

Pièges relevés pendant les mesures :
- `BITUME_JEU.mesures = true` ouvre le chronomètre GPU du moteur (lot 5B) : laissé éteint pour les courses profilées.
- Les chronos posés autour des fonctions appelées à chaque image coûtent environ 1,7 µs par appel : la page instrumentée
  sert aux étapes de construction et aux premières images, le profileur de V8 aux calculs par image.
- Le relevé de la « pire image » doit attendre l'image suivante (100 ms) : sinon il manque l'image retardée par le bloc.
- `worker-cache.json` garde trois séries : `wc` (premier scénario), `wc2` (variante à plat du Worker, bloc IndexedDB en
  échec), `wc3` (version finale, fait foi pour IndexedDB).
- L'essai à ×4 de la série `wc` (un seul) donne une régénération de 2,1 s, pas plus lente qu'à ×1 : non retenu.
