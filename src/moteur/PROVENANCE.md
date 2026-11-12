# Provenance du moteur de rendu

`renderer.js` vient de FERRO (`github.com/M4D135/FERRO`, dépôt privé), version METAL 0.6, commit `950f743` du
12 novembre 2026, par l'intermédiaire de Point de rupture : c'est la copie de `Jeu/src/moteur/renderer.js` au commit
`b695b51` (12 novembre 2026), qui porte déjà les retouches « PDR » décrites dans `Jeu/src/moteur/PROVENANCE.md` de
ce dépôt-là. Rien d'autre de FERRO ni de Point de rupture n'est copié : ni `audio.js`, ni `musique.js`. Le son de
BITUME est entièrement dans `src/son.js`. `construire.py` suit le modèle de celui de Point de rupture.

## Retouches de Point de rupture gardées

L'ombre du soleil sur tout l'atlas, les matières 13 à 18 (asphalte, façade, dallage, laque, tissu), la densité
minimale du brouillard, le vignettage adouci, le seuil du bloom relevé, l'anticrénelage MSAA ×4, l'atlas d'ombre
doublé, le soleil réglé par la caméra (`camera.sun`), le décor en un lot stable (`camera.allStatic`), les plans proche
et lointain (`camera.near`, `camera.far`), la lampe torche éteinte (`fx.torch === false`).

## Retouches de Point de rupture retirées, propres au jeu de stratégie

- Le voile du brouillard (`fx.voile`, uniformes `uVoile*`).
- La bibliothèque d'éclairage de la foule (`PDR_GLSL`, `PDR_INDOOR`, `PDR_UNIFORMS`, `renderer.pdr`, `renderer.gl`)
  et ses points d'accroche (`fx.foule`, `fx.lots`).

## Retouches BITUME, marquées « BITUME » dans le fichier

1. **En-tête** : origine et renvoi à ce fichier.
2. **Champ de vision de 10 à 110°** (FERRO : 40 à 110°), aux quatre endroits où il est borné (`FOV_MIN`) : la caméra
   de télévision filme au téléobjectif.
3. **Nappes** (`setNappes`) : chaussée, accotements et terrain en triangles continus, matière et couleur par sommet
   (52 octets par sommet), envoyés une fois au GPU.
4. **Lots** (`setLots`) : le décor par paquets, en version proche et lointaine, découpés au champ et à la portée de
   chaque lot.
5. **Ombres des lots** : les lots dont la sphère touche le volume du soleil projettent leur ombre.
6. **Perte de contexte** : nappes et lots rechargés à la restauration, leurs tampons libérés par `dispose`.
