# BITUME 0.2.352 — essai d'AgX (28/11/2026)

Chrome sans interface, GPU du Mac (Apple Metal-3, WebGPU), 1280×720, qualité Fine, `tools/controle-visuel.mjs`,
horloge commandée, image 0. Chaque fichier montre le même instant deux fois : à gauche le tonemap `ferro` (défaut, sans
paramètre), à droite AgX (`?rendu=agx`).

- `piste-ferro-agx.jpg` : scénario `piste`, au sec ;
- `pluie-ferro-agx.jpg` : scénario `pluie`.

Le verre du saute-vent suit la courbe active : ces captures sont faites après cette correction, contrairement aux paires
AgX de `../ferro-0340/` (build `b8a6cf8a`). Les écarts mesurés sont dans `../AGX-0352-MAC.json`.
