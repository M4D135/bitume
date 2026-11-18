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

  B.cacheNiveau = { cle: cle };
})(globalThis.BITUME = globalThis.BITUME || {});
