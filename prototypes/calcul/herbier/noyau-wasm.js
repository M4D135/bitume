// Lot 28 « calcul » — colle JavaScript du noyau C de l'herbier (herbier.c compilé en WebAssembly).
// Copie les tableaux préparés par herbier-serre.js (preparer) dans la mémoire linéaire, appelle noyau, relit la sortie.
'use strict';
function creer(module) {
  const memoire = new WebAssembly.Memory({ initial: 256 }); // 16 Mio, agrandie au besoin
  const t0 = performance.now();
  const inst = new WebAssembly.Instance(module, { env: { memory: memoire } });
  const instanciationMs = performance.now() - t0;
  const base = inst.exports.__heap_base.value;
  function noyau(D) {
    const nb = D.brutes.length;
    const tailles = [['P', 8, D.P.length], ['PL', 8, D.PL.length], ['LEN', 8, D.LEN.length], ['VEG', 1, D.VEG.length], ['brutes', 4, nb], ['M', 8, D.M.length],
      ['MOff', 4, D.MOff.length], ['CM', 4, D.CM.length], ['CMO', 4, D.CMO.length], ['CC', 4, D.CC.length], ['CCO', 4, D.CCO.length],
      ['arene', 8, 1 << 20], ['listes', 4, 2 * (1 << 17)], ['OUT', 8, 11 * Math.max(4096, 4 * nb)]];
    const pos = {}; let p = (base + 15) & ~15;
    for (const [nom, octet, n] of tailles) { pos[nom] = p; p = (p + octet * n + 15) & ~15; }
    const besoin = Math.ceil(p / 65536) - memoire.buffer.byteLength / 65536; if (besoin > 0) memoire.grow(besoin);
    const buf = memoire.buffer;
    new Float64Array(buf, pos.P, D.P.length).set(D.P); new Float64Array(buf, pos.PL, D.PL.length).set(D.PL); new Float64Array(buf, pos.LEN, D.LEN.length).set(D.LEN);
    new Uint8Array(buf, pos.VEG, D.VEG.length).set(D.VEG); new Int32Array(buf, pos.brutes, nb).set(D.brutes); new Float64Array(buf, pos.M, D.M.length).set(D.M);
    new Int32Array(buf, pos.MOff, D.MOff.length).set(D.MOff); new Int32Array(buf, pos.CM, D.CM.length).set(D.CM); new Int32Array(buf, pos.CMO, D.CMO.length).set(D.CMO);
    new Int32Array(buf, pos.CC, D.CC.length).set(D.CC); new Int32Array(buf, pos.CCO, D.CCO.length).set(D.CCO);
    const capOut = 11 * Math.max(4096, 4 * nb);
    const n = inst.exports.noyau(pos.P, pos.PL, pos.LEN, pos.VEG, pos.brutes, nb, pos.M, pos.MOff, pos.CM, pos.CMO, pos.CC, pos.CCO,
      D.eau === D.eau ? D.eau : 0, D.eau === D.eau ? 1 : 0, pos.arene, 1 << 20, pos.listes, 1 << 17, pos.OUT, capOut);
    if (n < 0) throw new Error('noyau WebAssembly : erreur ' + n);
    return new Float64Array(memoire.buffer, pos.OUT, n).slice();
  }
  noyau.instanciationMs = instanciationMs;
  return noyau;
}
module.exports = { creer };
