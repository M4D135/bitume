#!/usr/bin/env node
// Lot 28 « calcul » — sensibilité du monde généré aux derniers bits de Math.sin, cos, pow, exp, atan2 et hypot.
// Ces fonctions ne sont pas spécifiées au bit près par ECMAScript : deux navigateurs peuvent différer d'une unité au
// dernier rang (ulp). On simule cet écart en décalant leurs résultats d'un ulp, puis on compare le monde produit
// (tracé, objets, obstacles) au monde de référence. Lecture seule de src/.
//   node prototypes/calcul/sensibilite-ulp.mjs [circuits 0,2,3,6]
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CATALOGUE = [['foret', 11, 4200], ['cote', 29, 3600], ['montagne', 47, 5200], ['islande', 83, 4600], ['desert', 107, 4800], ['asie', 131, 5000], ['pacifique', 157, 5200]];
const circuits = (process.argv[2] || '0,2,3,6').split(',').map(Number);
vm.runInThisContext(readFileSync(path.join(racine, 'src/moteur/renderer.js'), 'utf8'));
for (const m of ['graphismes', 'carene', 'circuit', 'botanique', 'ecologie', 'saisons', 'vegetation', 'decor', 'obstacles']) vm.runInThisContext(readFileSync(path.join(racine, 'src', m + '.js'), 'utf8'), { filename: m });
const B = globalThis.BITUME;
const origine = {}; for (const f of ['sin', 'cos', 'pow', 'exp', 'atan2', 'hypot', 'tan', 'log', 'acos', 'asin', 'atan']) origine[f] = Math[f];
const f64 = new Float64Array(1), u64 = new BigInt64Array(f64.buffer);
const ulp = x => { if (!Number.isFinite(x) || x === 0) return x; f64[0] = x; u64[0] += 1n; return f64[0]; };
function perturber(oui) { for (const f in origine) Math[f] = oui ? (...a) => ulp(origine[f](...a)) : origine[f]; }
function monde(i) {
  const [theme, graine, longueur] = CATALOGUE[i];
  const c = B.circuit.creer(graine, { theme, longueur });
  const d = B.decor.construire(c, { qualite: 'high', vegetation: true, vegetationQualite: 'high', saison: 'ete' });
  const obs = d.obstacles || [];
  let objets = 0; for (const l of d.lots) objets += l.objets.length;
  return { c, d, longueur: c.longueur, n: c.n, objets, obstacles: obs.length, tunnel: c.tunnel ? [c.tunnel.debut, c.tunnel.fin] : null, x: c.x, obs, arbres: d.arbres ? d.arbres.length : 0 };
}
for (const i of circuits) {
  perturber(false); const a = monde(i);
  perturber(true); const b = monde(i);
  perturber(false);
  let ecartMax = 0; for (let k = 0; k < Math.min(a.x.length, b.x.length); k++) ecartMax = Math.max(ecartMax, Math.abs(a.x[k] - b.x[k]));
  // obstacles : même nombre, et écart de position du pire
  let ecartObs = 0; const n = Math.min(a.obs.length, b.obs.length);
  for (let k = 0; k < n; k++) { const p = a.obs[k].p || a.obs[k].centre || [0, 0, 0], q = b.obs[k].p || b.obs[k].centre || [0, 0, 0]; ecartObs = Math.max(ecartObs, Math.hypot(p[0] - q[0], p[2] - q[2])); }
  console.log(JSON.stringify({ circuit: i, theme: CATALOGUE[i][0], longueurRef: a.longueur, longueurUlp: b.longueur, pointsRef: a.n, pointsUlp: b.n, ecartTraceMaxM: ecartMax,
    objetsRef: a.objets, objetsUlp: b.objets, obstaclesRef: a.obstacles, obstaclesUlp: b.obstacles, arbresRef: a.arbres, arbresUlp: b.arbres, ecartObstacleMaxM: +ecartObs.toExponential(2), tunnelRef: a.tunnel, tunnelUlp: b.tunnel }));
}
