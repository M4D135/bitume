// Découpe optionnelle des grands herbiers. Le C canonique et la recette se trouvent dans prototypes/calcul/herbier/.
(function () {
  'use strict';
  const PAGE = 65536, PAGES_MAX = 2048, SEUIL = 65536;
  const ARENE = 1 << 20, LISTE = 1 << 17;
  const ENTREES = [
    ['P', Float64Array], ['PL', Float64Array], ['LEN', Float64Array], ['VEG', Uint8Array], ['brutes', Int32Array],
    ['M', Float64Array], ['MOff', Int32Array], ['CM', Int32Array], ['CMO', Int32Array], ['CC', Int32Array], ['CCO', Int32Array]
  ];

  function creer(moduleWasm) {
    const debut = performance.now();
    const memoire = new WebAssembly.Memory({ initial: 2, maximum: PAGES_MAX });
    const instance = new WebAssembly.Instance(moduleWasm, { env: { memory: memoire } });
    const instanciationMs = performance.now() - debut;

    function noyau(D) {
      const nb = D.brutes.length, capSortie = 11 * Math.max(4096, 4 * nb);
      let fin = instance.exports.__heap_base.value;
      function reserver(octets) {
        const depart = Math.ceil(fin / 16) * 16;
        fin = depart + octets;
        // Calcul en Number : les décalages bit à bit signés rebouclent pour les grandes tables.
        if (!Number.isSafeInteger(fin) || fin > PAGES_MAX * PAGE) throw new RangeError('Mémoire de découpe dépassée');
        return depart;
      }
      const pos = {};
      for (const [nom, Type] of ENTREES) pos[nom] = reserver(D[nom].length * Type.BYTES_PER_ELEMENT);
      const arene = reserver(8 * ARENE), listes = reserver(8 * LISTE), sortie = reserver(8 * capSortie);
      const pages = Math.ceil(fin / PAGE) - memoire.buffer.byteLength / PAGE;
      if (pages > 0) memoire.grow(pages);
      const buf = memoire.buffer;
      for (const [nom, Type] of ENTREES) new Type(buf, pos[nom], D[nom].length).set(D[nom]);
      const eau = Number.isFinite(D.eau);
      const n = instance.exports.noyau(pos.P, pos.PL, pos.LEN, pos.VEG, pos.brutes, nb, pos.M, pos.MOff, pos.CM, pos.CMO,
        pos.CC, pos.CCO, eau ? D.eau : 0, eau ? 1 : 0, arene, ARENE, listes, LISTE, sortie, capSortie);
      if (!Number.isInteger(n) || n < 0 || n > capSortie || n % 11) throw new RangeError('Découpe WebAssembly incomplète');
      return new Float64Array(buf, sortie, n).slice();
    }
    noyau.instanciationMs = instanciationMs; // lu par le banc historique
    return noyau;
  }

  let moduleCompile, indisponible = false;
  function decouper(D) {
    if (D.brutes.length < SEUIL || indisponible) return null;
    if (!moduleCompile) {
      try {
        const octets = Uint8Array.from(atob('__BITUME_HERBIER_WASM__'), c => c.charCodeAt(0));
        moduleCompile = new WebAssembly.Module(octets);
      } catch {
        indisponible = true; return null;
      }
    }
    // Seul le module compilé survit. La mémoire, l'instance et les tableaux de travail sont propres à cette découpe.
    try { return creer(moduleCompile)(D); }
    catch { return null; }
  }

  (globalThis.BITUME ||= {}).herbierWasm = { decouper };
  if (typeof module !== 'undefined' && module.exports) module.exports = { creer };
})();
