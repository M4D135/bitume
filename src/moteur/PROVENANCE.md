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
12. **Marque des index 32 bits** : la ligne qui construit le tampon d'index des formes libres porte désormais sa propre marque BITUME (constat rendu-2 de la relecture) ; sans elle, un report des retouches sur une nouvelle version de FERRO la laisserait en Uint16Array alors que la passe dessine en UNSIGNED_INT, et WebGL2 refuserait les appels.
13. **Boost de réflexion « photoréaliste » en qualité Fine** (`uPhoto`) : un uniforme booléen (0/1) passé par le jeu (`fx.photo`, 1 quand la qualité n'est pas Légère) active, dans la passe de fragment, un reflet net du soleil (Blinn-Phong borné), un renvoi chaud du sol et un reflet d'environnement renforcé sur les surfaces lisses ; l'asphalte (matière 14) passe de `roughness .9` à `.5` (humide, il renvoie le ciel) et le vernis des monoplaces (matière 17) de `.46` à `.3`. Tout est gated par `uPhoto` : en qualité Légère le rendu est identique à FERRO, et aucune passe render-to-texture n'est ajoutée (le moteur reste « pas de miroir de scène »).
14. **Météo pilotée par le jeu** (`fx.weather`) : le jeu passe `{pluie, nuage, eclair}` (0..1) et la passe de fragment voit ses valeurs d'uniformes modulées côté JS — assombrissement du ciel et du soleil, brouillard épaissi, ambiance relevée par un éclair lointain, vent accru (balancement du décor). Purement JS (aucun nouveau shader ni passe GPU) : la machine à états (clair → se couvre → pluie → orage) vit dans `jeu.js` (`majMeteo`). La pluie visible (particules) et les reflets plannaires restent à faire.
14. **Paquets d'instances sans tableau intermédiaire** (15/11/2026) : dans `pack()`, les 16 composantes sont écrites directement dans le `Float32Array`, au lieu de créer un tableau JavaScript de 16 valeurs par instance. Transfert ciblé de METAL `src/renderer.js`, commit `7f1d5589b7f5863e09369b0f55a21d4fe4334280` (voie rendu ; copie consultée SHA-256 `5b0e93723179e7dec07045e39a31e392f92c6ebe4e11a7116ab4375edc122c6f`). Le registre et l'ordre des formes libres BITUME restent ceux du jeu. Les octets des paquets et les captures Légère/Fine sont identiques ; le banc de 1 200 instances supprime 1 200 tableaux temporaires par appel, sans modifier les shaders ni ajouter de passe.
