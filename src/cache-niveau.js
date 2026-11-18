(function (B) {
  'use strict';

  // --- cle ---
  // Rend une chaîne stable à partir des paramètres qui influencent la géométrie.
  // Les clés des options sont triées alphabétiquement pour garantir la stabilité.
  function cle(version, circuit, palier, saison, options) {
    const parties = [version, circuit, palier, saison];
    if (options !== null && options !== undefined) {
      const cles = Object.keys(options).sort();
      for (let i = 0; i < cles.length; i++) {
        parties.push(cles[i] + '=' + String(options[cles[i]]));
      }
      // Garantit que {} et null produisent des clés différentes
      if (cles.length === 0) {
        parties.push('');
      }
    }
    return parties.join('|');
  }

  const FORMAT = 1;
  const TYPES = [Float32Array, Uint16Array, Uint32Array, Uint8Array];
  const CODE_TYPE = new Map([[Float32Array, 0], [Uint16Array, 1], [Uint32Array, 2], [Uint8Array, 3]]);

  function encoderNoms(noms) {
    const json = JSON.stringify(noms);
    const bytes = new TextEncoder().encode(json);
    return bytes;
  }

  function decoderNoms(bytes) {
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function emballer(niveau) {
    const noms = Object.keys(niveau.tableaux).sort();
    const N = noms.length;
    const nomsBytes = encoderNoms(noms);
    const padding = (4 - (nomsBytes.byteLength % 4)) % 4;
    // En-tête : format(4) + N(4) + nomsLen(4) + nomsBytes + padding + N×longueur(4) + N×type(4)
    let taille = 4 + 4 + 4 + nomsBytes.byteLength + padding + N * 4 + N * 4;
    for (let i = 0; i < N; i++) taille += niveau.tableaux[noms[i]].byteLength;
    const tampon = new ArrayBuffer(taille);
    const vue32 = new Uint32Array(tampon);
    const vue8 = new Uint8Array(tampon);
    let off32 = 0;
    vue32[off32++] = FORMAT;
    vue32[off32++] = N;
    vue32[off32++] = nomsBytes.byteLength;
    // nomsBytes
    const off8 = off32 * 4;
    vue8.set(nomsBytes, off8);
    let byteOff = off8 + nomsBytes.byteLength;
    // Aligner sur 4 pour les uint32 suivants
    while (byteOff % 4 !== 0) { vue8[byteOff++] = 0; }
    off32 = byteOff / 4;
    for (let i = 0; i < N; i++) vue32[off32++] = niveau.tableaux[noms[i]].length;
    for (let i = 0; i < N; i++) vue32[off32++] = CODE_TYPE.get(niveau.tableaux[noms[i]].constructor);
    byteOff = off32 * 4;
    for (let i = 0; i < N; i++) {
      const ta = niveau.tableaux[noms[i]];
      const src = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);
      vue8.set(src, byteOff);
      byteOff += src.byteLength;
    }
    return tampon;
  }

  function deballer(tampon) {
    if (!(tampon instanceof ArrayBuffer) || tampon.byteLength < 12) return null;
    if (tampon.byteLength % 4 !== 0) return null;
    const vue32 = new Uint32Array(tampon);
    const vue8 = new Uint8Array(tampon);
    if (vue32[0] !== FORMAT) return null;
    const N = vue32[1];
    const nomsLen = vue32[2];
    const nomsOff = 12;
    if (tampon.byteLength < nomsOff + nomsLen) return null;
    let noms;
    try { noms = decoderNoms(vue8.slice(nomsOff, nomsOff + nomsLen)); } catch (e) { return null; }
    if (!Array.isArray(noms) || noms.length !== N) return null;
    let byteOff = nomsOff + nomsLen;
    while (byteOff % 4 !== 0) byteOff++;
    const metaOff = byteOff / 4;
    if (tampon.byteLength < (metaOff + N * 2) * 4) return null;
    const longueurs = [];
    for (let i = 0; i < N; i++) longueurs.push(vue32[metaOff + i]);
    const codes = [];
    for (let i = 0; i < N; i++) codes.push(vue32[metaOff + N + i]);
    byteOff = (metaOff + N * 2) * 4;
    const tableaux = {};
    for (let i = 0; i < N; i++) {
      if (codes[i] < 0 || codes[i] > 3) return null;
      const Type = TYPES[codes[i]];
      const taille = longueurs[i] * Type.BYTES_PER_ELEMENT;
      if (byteOff + taille > tampon.byteLength) return null;
      tableaux[noms[i]] = new Type(tampon, byteOff, longueurs[i]);
      byteOff += taille;
    }
    return { tableaux: tableaux };
  }

  B.cacheNiveau = { cle: cle, emballer: emballer, deballer: deballer };
})(globalThis.BITUME = globalThis.BITUME || {});
