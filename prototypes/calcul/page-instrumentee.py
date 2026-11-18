#!/usr/bin/env python3
"""Lot 28 « calcul » — copie instrumentée de dist/bitume.html, écrite hors du dépôt (rien n'est modifié dans src/ ni dist/).

Ajoute une fonction globale __W(nom, f) (chronos à l'horloge de la page, rangés dans window.__chronos) et pose ses
chronos sur les fonctions internes de decor.js (chaussée, relief, herbier), comme prototypes/calcul/construction-node.mjs.

    python3 prototypes/calcul/page-instrumentee.py dist/bitume.html /private/tmp/calcul-28/bitume-instrumente.html
"""
import sys

entree, sortie = sys.argv[1], sys.argv[2]
page = open(entree, encoding='utf-8').read()
CHRONOS = """<script>
// ---- calcul28-chronos ----
(function () {
  const C = window.__chronos = new Map(), pile = [];
  window.__W = function (nom, f) { if (typeof f !== 'function' || f.__calcul28) return f; const g = function (...a) {
    const t0 = performance.now(); pile.push(0);
    try { return f.apply(this, a); } finally {
      const d = performance.now() - t0, enfants = pile.pop();
      let s = C.get(nom); if (!s) C.set(nom, s = { n: 0, total: 0, propre: 0, pire: 0 });
      s.n++; s.total += d; s.propre += d - enfants; if (d > s.pire) s.pire = d;
      if (pile.length) pile[pile.length - 1] += d;
    } }; g.__calcul28 = true; return g; };
  window.__chronosLire = function (raz) { const o = {}; for (const [k, s] of C) o[k] = { n: s.n, total: +s.total.toFixed(2), propre: +s.propre.toFixed(2), pire: +s.pire.toFixed(2) }; if (raz) C.clear(); return o; };
})();
</script>
"""
ancre_decor = '  B.decor = { construire,'
assert page.count(ancre_decor) == 1, 'decor.js introuvable dans la page'
page = page.replace(ancre_decor, "  nappesRoute = __W('decor.chaussee', nappesRoute); nappesTerrain = __W('decor.relief-terrain', nappesTerrain); creerHerbier = __W('decor.herbier', creerHerbier); indexAxe = __W('decor.indexAxe', indexAxe);\n" + ancre_decor)
premier = page.index('<script>')
page = page[:premier] + CHRONOS + page[premier:]
open(sortie, 'w', encoding='utf-8').write(page)
print(sortie, len(page.encode('utf-8')), 'octets')
