# Provenance du moteur de rendu

`renderer.js` vient du moteur de METAL 0.6, commit `950f743` du 12 novembre 2026. Ce commit est dans le dépôt du jeu,
`github.com/M4D135/METAL` (privé), qui s'appelait `M4D135/FERRO` jusqu'au 12 novembre 2026. Depuis, `M4D135/FERRO`
(privé) est le dépôt de référence du moteur, où cette version porte l'étiquette `metal-0.6`. Le commentaire d'en-tête
de Point de rupture, en ligne 2 de `renderer.js`, garde l'ancien nom. La copie est passée par Point de rupture : c'est
`Jeu/src/moteur/renderer.js` au commit `b695b51` (12 novembre 2026), qui porte déjà les retouches « PDR » décrites
dans `Jeu/src/moteur/PROVENANCE.md` de ce dépôt-là. Rien d'autre de FERRO ni de Point de rupture n'est copié : ni `audio.js`, ni `musique.js`. Le son de
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
7. **Coin** (`wedge`) : prisme droit à base triangulaire (dessous, dos vertical, pente du haut du dos au bas de
   l'avant), pour les nez, pontons et capots en pente des monoplaces. Il porte ombre comme les autres formes pleines.
8. **Cockpit éclairé comme le monde** : la passe de premier plan (`overlay`) ne reçoit plus la lumière ajoutée de
   FERRO, faite pour l'arme d'un jeu de tir, qui rosissait la laque rouge, et elle reçoit les ombres du décor. Le
   cockpit de BITUME est posé à sa vraie place dans le monde, l'ombre y tombe donc juste.
9. **Peinture satinée** (matière 17) : la matière 17 n'est plus une seconde laque mais la peinture des monoplaces,
   plus mate (rugosité 0,46, métal 0,04). La laque brillante de FERRO reflétait le ciel en incidence rasante et
   rosissait le rouge vu du cockpit.
10. **Formes libres** (`FRender.forme(nom, triangles)`) : registre de formes faites de triangles, tenues dans le cube
    unité, émises après les formes d'origine aux trois niveaux de détail, pour les carènes lisses et les mains des
    monoplaces (`src/carene.js`). Les index passent sur 32 bits (`UNSIGNED_INT`) ; `shadowCaster` accepte les formes
    libres de plus de 45 cm de long ou de large et de plus de 20 cm de haut.
11. **Formes libres émises dans l'ordre du registre** : le registre garde l'ordre des sommets choisi en vraie grandeur
    par `src/carene.js` ; `geometry()` ne passe plus par `triangle()` pour elles, car son test d'orientation se fait
    dans le cube unité, où l'échelle inégale de `normaliser()` ne conserve pas les angles — 90 faces fines (jonc,
    rétros, arceau, épaules, filet, pare-brise, casquette) étaient retournées puis éliminées par `CULL_FACE`, d'où des
    trous dans la peau. `verifications/formes-libres.test.mjs` contrôle l'ordre émis contre le registre.
