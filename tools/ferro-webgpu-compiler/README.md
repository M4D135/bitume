# Compilateur de shaders — outil de développement

Ce petit programme convertit un shader GLSL de sommets (`vert`) ou de fragments
(`frag`) en WGSL, ou relit et valide un shader WGSL (`wgsl`). Il utilise
**Naga 30.0.1**, avec les dépendances fixées dans `Cargo.lock`.

`Cargo.toml`, `Cargo.lock` et `src/main.rs` sont les copies identiques de l'outil
canonique FERRO. Ce dossier contient uniquement le programme de conversion :
aucun shader de jeu, source de moteur, asset ou identifiant d'accès.

## Construire et exécuter

```sh
cargo build --release --locked \
  --manifest-path tools/ferro-webgpu-compiler/Cargo.toml \
  --target-dir build/ferro-webgpu-compiler-target

build/ferro-webgpu-compiler-target/release/ferro-webgpu-compiler \
  vert entree.vert sortie.wgsl

build/ferro-webgpu-compiler-target/release/ferro-webgpu-compiler \
  wgsl sortie.wgsl sortie-validee.wgsl
```

La préparation des dépendances Cargo peut nécessiter le réseau. Le binaire
produit fonctionne ensuite localement, sans téléchargement. Il reste extérieur
au jeu distribué : lancer BITUME ne demande ni Rust ni compilateur de shaders.

## Binaire Linux autonome

Le workflow `preparer-compilateur-ferro.yml` se déclenche sur une branche
`codex/**` avec le marqueur `[build-ferro-compiler]`, ou manuellement. Il construit
la cible `x86_64-unknown-linux-musl` sous Ubuntu 22.04 et vérifie que le binaire
n'a ni interpréteur ELF ni bibliothèque dynamique requise.

L'artefact contient le binaire, une archive conservant son droit d'exécution,
les sources de cet outil, les journaux, les petits shaders de contrôle et leurs
résultats. `manifest.json` indique le commit exact et la réussite de chaque
étape ; `SHA256SUMS.json` donne les empreintes des fichiers livrés. Un échec
conserve les preuves disponibles avec `qualified: false`.

Le workflow utilise seulement les fichiers de ce dépôt et les dépendances
publiques Cargo. Il ne consulte aucun dépôt privé et ne publie aucun commit.
Les exemples de contrôle sont des shaders minimaux créés pour tester l'outil ;
leur compilation ne qualifie pas le rendu du jeu ou les performances d'un GPU.

Naga provient de [gfx-rs/wgpu](https://github.com/gfx-rs/wgpu/tree/trunk/naga)
et est distribué sous MIT ou Apache-2.0. Les dépendances conservent leurs
licences respectives.
