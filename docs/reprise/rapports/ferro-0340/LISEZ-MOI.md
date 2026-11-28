# FERRO 0.3.40 dans BITUME 0.2.351 — captures à soumettre à David

Chrome sans interface, GPU du Mac (Apple Metal-3, WebGPU), 1280×720, qualité Fine, 28/11/2026.

## Tonemap (choix de David)

BITUME 0.2.351 garde `tonemap: 'ferro'`, la courbe de 0.2.350. AgX est le tonemap par défaut de FERRO.
Chaque paire montre la même image figée, rendue d'abord avec ferro puis avec AgX. Seul `fx.tonemap` change entre
les deux images.

- `longues-ombres-ferro.jpg`, `longues-ombres-agx.jpg` : Circuit des Longues Ombres, temps sec ;
- `eaux-dormantes-pluie-ferro.jpg`, `eaux-dormantes-pluie-agx.jpg` : Boucle des Eaux Dormantes, pluie ;
- `glace-vive-ferro.jpg`, `glace-vive-agx.jpg` : Circuit de la Glace Vive.

Ces captures datent d'avant la correction du verre (build `b8a6cf8a`). La correction ne touche que le saute-vent.

## Halo (choix de David)

Le halo de FERRO 0.3.39 est ajouté en radiance avant la courbe. Il éclaircit l'habitacle sombre et auréole la manche,
les cadres des rétroviseurs et les feux. Les trois recadrages montrent la même image à horloge commandée :
`tools/controle-visuel.mjs --scenario piste`, image 0.

- `halo-habitacle-0350.jpg` : 0.2.350, FERRO 0.3.36, halo gaussien en valeurs affichées ;
- `halo-habitacle-force1.jpg` : 0.2.351, `bloomStrength` 1, défaut de FERRO, gardé ;
- `halo-habitacle-force05.jpg` : 0.2.351, `bloomStrength` 0,5. Il s'agit d'une copie d'essai : l'option n'est pas
  dans le jeu.

Les écarts de luminance mesurés sur les huit images sont dans `../FERRO-0340-0351-MAC.json`, rubrique `image`.
