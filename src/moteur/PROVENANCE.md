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


15. **Backend WebGL2 EMPRISE repris le 16/11/2026** : remplacement du socle par `rade/src/ferro/renderer.js`,
    snapshot de travail lu deux fois à l’identique le 15/11/2026 à 23:21:13 UTC. HEAD du dépôt source :
    `22a330f2dbbdc7ee359ce03da785e0cbeca495d4` ; le renderer source était modifié, il ne faut donc pas attribuer
    son contenu au seul commit. SHA-256 exact du fichier importé :
    `c268957562dba93843a4f017be5ae46210136161bd307c8fd0bb8a6a284a2e00` (181 174 octets).
    Sa provenance conservée au moment de la lecture a l’empreinte
    `5625b5fc0047eaf03a1bf3d0fe3f50dbd487c3b1e6d4fafeeab82f7d21c613ff` ; elle situe le socle à PDR `1e8b6351`,
    complété par les formes libres, coins et indices 32 bits de BITUME `e9a5e7f9`.
    Le snapshot reprend réellement le backend, ses shaders procéduraux, ses empaqueteurs réutilisables,
    son filtrage du métal et des reflets, ses ombres PCF continues, ses nuages et ses matériaux humides.
    Aucun fichier WebGPU, image, texture externe, asset ou dépendance réseau n’est embarqué.

    Adaptations marquées BITUME dans la copie :
    - API `FRender.create(canvas)`, `setNappes`, `setLots`, `forme` et export `window.FRender` conservés ;
      peinture satinée 17, reflet analytique `photo` et ombres du cockpit rétablis, sans lumière d’arme.
    - MSAA 4 et atlas solaire 4 096/2 048 conservés par défaut ; SSR disponible uniquement sur option de création
      explicite `reflections:true`, sans cibles ni passe supplémentaires dans le jeu. Les reflets analytiques et
      flaques EMPRISE fonctionnent sans SSR. L’eau du circuit ne prend pas le niveau marin imposé du port RADE.
    - `bitumeWeather` traduit `{pluie,nuage,eclair,mouille,ventX,ventZ}` en vec4 EMPRISE
      `[humidité,nuages,pluie,éclair]`, accepte l’ancien objet et le vec4 natif, réutilise ses tableaux et n’altère
      pas l’environnement du circuit. Soleil, ciel, brouillard, vent, route humide et nuages partagent l’ambiance.
    - `indexPrimitiveVertices`, présent dans le snapshot, raccordé au WebGL2 : 2 352 références de primitives
      utilisent 618 sommets distincts à détail maximal. Les 30 919 triangles des carènes/mains gardent leurs
      index développés et leur ordre. `updateShape` restaure les index d’une primitive avant de l’éditer.
    - Perte de contexte : anciennes poignées de nappes/lots oubliées avant recharge ; les index éventuellement
      restaurés et les sommets modifiés survivent. Le contrôle WebGL réel rend à nouveau les mêmes nappes/lots
      et ne produit plus INVALID_OPERATION sur ces anciennes poignées.

    Vérifications : `verifications/moteur-emprise.test.mjs` contrôle les triangles bit à bit aux trois LOD,
    les formes libres, les mutations et restaurations GPU simulées, la météo et le SSR optionnel ;
    `formes-libres.test.mjs` et `voiture.test.mjs` passent. Dans Chrome WebGL2 sur Mac, mêmes images figées
    des trois circuits : appels/triangles identiques au socle `2eccd78`, cockpit complet, qualités Fine/Légère,
    restauration de contexte réelle et zéro erreur GL. Banc CPU de soumission, 1 280 × 720, qualité Fine
    avec MSAA 4, 20 images de chauffe et 60 mesures espacées : p95 ancien/nouveau 1,4/1,4 ms (forêt),
    1,6/1,6 ms (côte), 1,3/1,4 ms (montagne). Ces mesures headless ne prouvent ni FPS visibles ni Xbox réelle.
    La caméra, le FOV mobile, l’ATH et la simulation ne changent pas dans ce portage.


## FERRO commun 0.3.0 — 16 novembre 2026

Migration vers le renderer de référence EMPRISE/src/ferro/renderer.js, identique dans les quatre jeux et contrôlé par FERRO.lock.json. Les apports BITUME et PDR sont conservés dans le moteur commun ; le jeu fournit ses réglages et son style. Aucun plafond de taille (décision explicite de David). Voir FERRO-REFERENCE.md.

## FERRO 0.3.21 — 22 novembre 2026

Le verrou de BITUME provient de [FERRO 0.3.21](https://github.com/M4D135/FERRO/commit/ba7d14cbfc1bed01a1f6ac4d5a764524edd42762). Le runtime WebGL2 et les modules WebGPU sont installés avec l’installateur canonique. Les règles de préparation des circuits et la géométrie des décors restent dans le jeu.

## FERRO 0.3.22 — 22 novembre 2026

Les 34 modules et leur verrou ont été installés depuis le dépôt canonique. Cet apport couvre l’index du terrain, le cache WebGL2 des lots instanciés et la gestion des images multisample. [FERRO 0.3.22](https://github.com/M4D135/FERRO/commit/aae3fa19cf1c7fe0f8cb65dbd2e3c2e4ecba7a39)

## FERRO 0.3.23 — 22 novembre 2026

Les 34 modules et leur verrou viennent de l’installateur canonique. Les shaders WebGPU des reflets et du halo sont générés à partir des sources GLSL du moteur. [Commit FERRO](https://github.com/M4D135/FERRO/commit/0db8e73f2f0c66db85c4cc18198bcfba68310190)

## FERRO 0.3.24 — 22 novembre 2026

Les 34 modules et leur verrou viennent de l’installateur canonique. Les nappes rigides occupent 40 octets par sommet. Le moteur partage le classement des objets dynamiques entre les passes et réduit les calculs des ombres du cockpit. [Commit du moteur](https://github.com/M4D135/FERRO/commit/f9195273ceed7e0a01ed8dc221aa3cfdc554b03e)

## FERRO 0.3.25 — 22 novembre 2026

Les 34 modules et leur verrou viennent de l’installateur canonique. La passe solaire WebGL2 utilise les bornes des groupes du décor et le shader de contact partage la normale des deux pneus de chaque essieu. [Commit du moteur](https://github.com/M4D135/FERRO/commit/5702caa5f3968a33bbe86b7a758c6c18cac4d3be)
