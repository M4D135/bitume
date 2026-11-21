/* BITUME — matières du cockpit, sans texture ni changement de maillage.
   Les recettes FERRO sont opt-in ; les outils sans moteur gardent un cuir mat
   et un tissu non métallique. Le métal brossé et la peinture restent ceux du moteur. */
(function (B) {
  'use strict';
  const moteur = globalThis.FRender || globalThis.window?.FRender;
  const recettes = moteur?.materials || {};
  const cuir = Number.isFinite(recettes.fineLeather) ? recettes.fineLeather : 7;
  const tissu = Number.isFinite(recettes.wovenFabric) ? recettes.wovenFabric : 18;
  const metal = 0;

  // Seulement à la préparation du modèle. L'animation réutilise ensuite les
  // mêmes objets, matières et tableaux dans le cockpit et tous les LOD extérieurs.
  function habitacle(H) {
    H.planche[0].objet.mat = cuir;
    H.jante.objet.mat = cuir;
    H.ruban.objet.mat = tissu;
    for (const main of H.mains) {
      main.pieces.forEach((piece, i) => { piece.objet.mat = i === 1 || i === 2 ? cuir : tissu; });
      for (const piece of main.tubes) piece.objet.mat = tissu;
      for (const piece of main.boules) piece.objet.mat = tissu;
    }
    return H;
  }
  function pilote(corps) {
    for (const piece of corps) if (piece.pilote && piece.mat === 18) piece.mat = tissu;
  }
  B.cockpitMatieres = Object.freeze({ cuir, tissu, metal, habitacle, pilote });
})(globalThis.BITUME = globalThis.BITUME || {});
