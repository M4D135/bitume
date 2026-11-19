/* BITUME — répartition spatiale déterministe des prairies, bosquets et petites espèces.
   Le champ est interrogé à la préparation du décor ; il ne dépend ni de la route ni du temps. */
(function (B) {
  'use strict';

  const BIOMES = Object.freeze({ foret: 0x25ab3d71, cote: 0x6c8e19f3, montagne: 0x438db527, baikal: 0x71cd923f });
  const lisse = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  function creer(graine, biome = 'foret') {
    const g = ((Number(graine) >>> 0) ^ (BIOMES[biome] || BIOMES.foret)) >>> 0;
    function hache(x, z, sel) {
      let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ g ^ sel;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function bruit(x, z, sel) {
      const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
      const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
      const v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
      const a = hache(ix, iz, sel), b = hache(ix + 1, iz, sel);
      const c = hache(ix, iz + 1, sel), d = hache(ix + 1, iz + 1, sel);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    // La rotation et la déformation du domaine effacent les axes de la maille de bruit.
    // Les coordonnées restent mondiales : deux côtés de route ne partagent aucun motif imposé.
    const co = g & 1 ? .8 : .6, si = (g & 2 ? -1 : 1) * (g & 1 ? .6 : .8);
    const ox = hache(17, 43, 5) * 8192, oz = hache(71, 11, 7) * 8192;
    function echantillonner(x, z, sortie) {
      const e = sortie || {};
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        e.herbe = e.fleurs = e.insectes = e.boisement = 0;
        return e;
      }
      const rx = x * co - z * si + ox, rz = x * si + z * co + oz;
      const px = rx + (bruit(rx / 510, rz / 510, 31) - .5) * 170;
      const pz = rz + (bruit((rx + 713) / 430, (rz - 319) / 430, 47) - .5) * 170;
      const paysage = .78 * bruit(px / 280, pz / 280, 101) + .22 * bruit(px / 610, pz / 610, 131);
      const ouverture = biome === 'foret' ? lisse(.20, .46, paysage)
        : biome === 'baikal' ? lisse(.24, .51, paysage) : lisse(.38, .62, paysage);
      const poche = bruit(px / 63, pz / 63, 173), fin = bruit(rx / 15, rz / 15, 211);
      const prairie = ouverture * lisse(.35, .65, poche * .83 + fin * .17);
      // Une plage entière vaut zéro : les clairières n'allouent ni brins ni habitats d'insectes.
      e.herbe = lisse(.20, .92, prairie);
      e.boisement = ouverture * lisse(.38, .65,
        .74 * bruit((px - 419) / 109, (pz + 227) / 109, 251) + .26 * bruit(rx / 39, rz / 39, 281));
      e.fleurs = e.herbe * lisse(.40, .68, bruit((px + 179) / 34, (pz - 311) / 34, 307)) * (1 - e.boisement * .40);
      e.insectes = e.herbe * (.16 + .84 * lisse(.35, .68, poche * .6 + fin * .4)) * (.65 + .35 * e.fleurs);
      return e;
    }
    return Object.freeze({ graine: Number(graine) >>> 0, biome, echantillonner });
  }

  B.ecologie = { creer };
})(globalThis.BITUME = globalThis.BITUME || {});
