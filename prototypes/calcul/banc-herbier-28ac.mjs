#!/usr/bin/env node
// Lot 28A-28C — herbier dans Node, temps processeur du fil (process.threadCpuUsage), essais alternés : historique
// (fixture d'avant 28A), découpe de decor.js (28A) et reprise d'une autre saison (28C), Fine.
//   node --expose-gc prototypes/calcul/banc-herbier-28ac.mjs 2,6,0 5 > r.json
import { createRequire } from 'node:module';
import os from 'node:os';
const require = createRequire(import.meta.url), R = new URL('../../', import.meta.url).pathname;
for (const n of ['circuit', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'decor']) require(R + 'src/' + n + '.js');
const B = globalThis.BITUME, historique = require(R + 'verifications/fixtures/herbier-historique.cjs')(B);
const CAT = { 0: ['Val-Brûlé', 'foret', 11, 4200], 2: ['Haut-Col', 'montagne', 47, 5200], 6: ['Cap-Séquoia', 'pacifique', 157, 5200] };
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const o = { qualite: 'high', matieres: true, vegetation: false }, sortie = { node: process.version, charge: [], cas: {} };
for (const ci of (process.argv[2] || '2,6,0').split(',')) {
  const [nom, theme, graine, longueur] = CAT[ci], t = { historique: [], decoupe: [], reprise: [] };
  for (let r = 0; r < Number(process.argv[3] || 5); r++) {
    sortie.charge.push(+os.loadavg()[0].toFixed(1));
    const c = B.circuit.creer(graine, { theme, longueur }), d = B.decor.construire(c, { ...o, saison: 'ete' });
    global.gc(); let t0 = cpu(); historique(c, d.nappes, d.lots, d.limites, d.enceinte, d.niveauEau); t.historique.push(cpu() - t0);
    global.gc(); t0 = cpu(); void d.herbier; t.decoupe.push(cpu() - t0);
    const d2 = B.decor.construire(c, { ...o, saison: 'automne' });
    global.gc(); t0 = cpu(); void d2.herbier; t.reprise.push(cpu() - t0);
  }
  sortie.cas[nom] = Object.fromEntries(Object.entries(t).map(([k, a]) => [k, { med: +med(a).toFixed(1), min: +Math.min(...a).toFixed(1), max: +Math.max(...a).toFixed(1) }]));
}
console.log(JSON.stringify(sortie, null, 1));
