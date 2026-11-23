# BITUME — Circuit transparent vu par-dessous · patch FERRO (23 novembre 2026)

Date : 2026-11-23 · Base : `main` `c08fa1a` / `0.2.293` · `FERRO 0.3.32` verrouillé.
Navigateur signalé par David : **Chrome** (donc chemin **WebGPU**). Preuve : `captures-20261123/bug3-11.34.03.png` (voiture sortie, caméra regardant la chaussée **par en dessous**, pente grise translucide sur le ciel).

## Symptôme

Quand la caméra se retrouve sous une nappe de terrain (chaussée, accotement, terrain, eau) — sortie de route, voiture retournée sur un dévers, caméra ras le sol — la surface disparaît : on voit le ciel / l'autre versant **à travers** la route au lieu d'un dessous plein.

## Cause (vérifiée dans le code)

Les nappes sont dessinées par le programme **`world`** avec le pipeline « nappe » :

- `src/ferro/webgpu-renderer.js:529` — `pass.setPipeline(pipeline('world',{nappe: mode?'rigid':true}))`.
- `src/ferro/webgpu-renderer.js:138` — `mesh = name==='world' || name==='depth' || name==='fx'` → **vrai** pour les nappes aussi.
- `src/ferro/webgpu-renderer.js:139` — `cullMode: front?'front':mesh?'back':'none'`.

Le paramètre `nappe` ne pilote **que** la disposition des buffers de sommets, **pas** le cull. Comme `mesh` est vrai pour `world`, toute nappe est rendue en **`cullMode:'back'`** = simple face → éliminée par en dessous.

Le chemin **WebGL2** cull pareil en global (`src/moteur/renderer.js:3514` `gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK)`), donc le comportement est cohérent entre les deux backends : les nappes sont simple-face partout.

Le fragment `world` (`src/ferro/webgpu-shaders.js`) n'a **aucun** `@builtin(front_facing)` : la normale d'une face arrière pointe à l'opposé, `dot(n,l)` est écrêté à 0 → seule l'ambiance éclaire. Rendre les nappes double-face sans toucher au shader donne donc un dessous **plein mais sombre** (acceptable sous la route), et non plus transparent.

## Correctif — référence `M4D135/FERRO:src/ferro`, module `webgpu-renderer`

`src/ferro/webgpu-renderer.js`, fonction `pipeline(...)`, ligne 139 :

```diff
-   const descriptor={label:'FERRO '+key,layout:p.pipelineLayout,vertex:{module:p.vertex,entryPoint:p.descriptor.vertexEntryPoint||'main',buffers:mesh?(nappe==='rigid'?RIGID_TERRAIN:nappe?[GEOMETRY[0],{...GEOMETRY[1],stepMode:'vertex'}]:GEOMETRY):[]},primitive:{topology:'triangle-list',frontFace:'ccw',cullMode:front?'front':mesh?'back':'none'},multisample:{count:samples}};
+   const descriptor={label:'FERRO '+key,layout:p.pipelineLayout,vertex:{module:p.vertex,entryPoint:p.descriptor.vertexEntryPoint||'main',buffers:mesh?(nappe==='rigid'?RIGID_TERRAIN:nappe?[GEOMETRY[0],{...GEOMETRY[1],stepMode:'vertex'}]:GEOMETRY):[]},primitive:{topology:'triangle-list',frontFace:'ccw',cullMode:front?'front':(mesh&&!nappe)?'back':'none'},multisample:{count:samples}};
```

Effet : les pipelines « nappe » (`nappe:true` et `nappe:'rigid'`) passent en **`cullMode:'none'`** (double face) ; les maillages (`nappe:false`) gardent `'back'`. Aucun nouveau pipeline à préchauffer : la clé de cache inclut déjà `nappe` et les deux variantes sont pré-créées (`webgpu-renderer.js:771`).

### Coût et garde-fous

- Les nappes sont la plus grande géométrie : le double-face rasterise aussi les faces arrière. Les faces arrière sont le plus souvent hors champ ou rejetées en profondeur ; le surcoût est surtout de la configuration de rastérisation. **Mesurer** p95/`pire` avant/après à scène identique (cible Xbox et GPU intégré, cf. décisions 20/11).
- Le dessous devient sombre (pas de `front_facing`). Si David veut un dessous éclairé, raffinement optionnel dans le module verrouillé `webgpu-shaders` : ajouter `@builtin(front_facing) ffront : bool` à l'entrée fragment `world` et retourner `n_14`/`geometricNormal` quand `!ffront` pour les nappes. À décider séparément (touche le shader compilé).

### Parité WebGL2 (secondaire — David est en Chrome/WebGPU)

Pour aligner le chemin WebGL2, il faudrait désactiver `CULL_FACE` autour des draws de nappes dans la passe principale (`renderer.js`, draws `nappe`). Non bloquant pour le cas signalé ; à traiter en même temps que la qualification de la référence si on veut la cohérence stricte.

## Propagation (règle du dépôt)

`webgpu-renderer.js` est un module verrouillé (`FERRO.lock.json`, référence `M4D135/FERRO:src/ferro`). **Ne pas retoucher localement.** La marche à suivre, côté Mac (identifiants FERRO) :

1. Appliquer le diff ci-dessus à la référence `M4D135/FERRO:src/ferro/webgpu-renderer.js`.
2. Qualifier la référence (banc FERRO + une scène avec caméra sous la chaussée pour confirmer le dessous plein).
3. Publier une version FERRO qualifiée, mettre à jour `FERRO.lock.json` (`version` + `sha256` du module `webgpu-renderer`).
4. `python3 construire.py` (contrôle des empreintes FERRO), tests, commit `main`.

## Validation (à faire sur le Mac — le Spark n'a pas de WebGPU)

- Reprendre la scène de `bug3` (voiture sortie sur le dévers, caméra sous la chaussée) : la pente doit être **pleine** (sombre) au lieu de transparente.
- Vérifier qu'aucune nappe ne se voile en conduite normale (aucun z-fighting, aucune face qui clignote).
- Mesurer p95/`pire` avant/après à scène identique.

## État

- Diagnostic : **fait** (cause localisée, reproductible en lecture de code).
- Patch : **préparé** (diff ci-dessus).
- Application référence + qualification + push : **à faire sur le Mac** (identifiants FERRO requis ; le Spark n'a ni WebGPU ni accès à la référence).
