# Reconstruction du noyau de découpe des prairies

`herbier.c` est la transcription C originale de la découpe JavaScript. Le jeu et le banc historique utilisent le même pont mémoire dans `src/herbier-wasm.js`. La compilation ordinaire du jeu avec `python3 construire.py` incorpore `src/herbier/noyau.wasm` dans le HTML et fonctionne sans outil LLVM. La page fonctionne hors ligne.

Pour reproduire le module depuis la racine du dépôt avec clang et wasm-ld LLVM 23.1.2 sur le PATH, exécuter

```sh
clang --target=wasm32 -O3 -ffp-contract=off -nostdlib -Wl,--no-entry \
  -Wl,--export=noyau -Wl,--export=__heap_base -Wl,--import-memory \
  prototypes/calcul/herbier/herbier.c -o src/herbier/noyau.wasm
node --test verifications/herbier-wasm.test.mjs
```

Le nom de sortie `noyau.wasm` figure dans la section de noms du module. L'édition vérifiée avec Homebrew clang et LLD 23.1.2 mesure 5 961 octets. L'empreinte SHA-256 du binaire est `b829b98a06dfa5ebd9b3a3376da5f19195674338cbf66c3060b1b96fb0511760` et celle du C est `3ff4e61fa2c75044a4dbf42ece4ae736db8b72702f6373e81411cbae0dff1166`.

La vitrine du menu et les herbiers de moins de 65 536 triangles sources conservent le chemin JavaScript. Quand les couleurs saisonnières réutilisent une découpe existante, aucun noyau ne tourne. Un premier grand herbier à découper en séance décode le binaire et compile le module une fois, puis crée une instance et une mémoire privées. La mémoire linéaire importe au plus 2 048 pages de 64 Kio, soit 128 Mio. Un refus de compilation ou d'allocation, un dépassement de cette limite ou une saturation des tableaux du noyau déclenche la découpe JavaScript sur les mêmes données. La sortie complète est copiée en Float64 avant la finition. Seul le module compilé reste référencé entre deux découpes.
