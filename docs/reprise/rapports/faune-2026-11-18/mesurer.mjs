import { createRequire } from 'node:module';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), racine = fileURLToPath(new URL('../../../../', import.meta.url));
for (const f of ['carene', 'circuit', 'decor', 'faune']) require(racine + 'src/' + f + '.js');
const B = globalThis.BITUME, catalogue = [['foret', 11, 4200], ['cote', 29, 3600], ['montagne', 47, 5200]];
const rapport = { protocole: 'Node CPU uniquement : vrais circuits/décors, végétation off, création paresseuse de surfaceHerbe comprise ; aucun rendu ni FPS GPU.', circuits: [], cpu: [] };
let temps = 0;
for (const [theme, graine, longueur] of catalogue) {
  const c = B.circuit.creer(graine, { theme, longueur }), d = B.decor.construire(c, { qualite: 'low', vegetation: false, vegetationQualite: 'off' });
  const t0 = performance.now(), e = B.faune.creer(c, d), ms = performance.now() - t0;
  const positions = [];
  for (let k = 0; k < 8; k++) {
    const s = c.longueur * (.14 + .095 * k), q = B.circuit.echantillon(c, s);
    const ctx = { qualite: 'ultra', nuit: 0, pluie: 0, vue: 0, pose: q }, out = [];
    for (let j = 0; j < 180; j++) { out.length = 0; B.faune.dessiner(e, temps += 1 / 60, ctx, out); }
    const distances = e.habitats.map(h => Math.hypot(h.x - q.x, h.z - q.z)).sort((a, b) => a - b);
    positions.push({ s, tunnel: B.circuit.dansTunnel(c, s, 30), min: distances[0], proches15m: distances.filter(n => n < 15).length,
      habitats90m: e.vues[0].stats.habitats, abeilles: e.vues[0].stats.abeilles, insectes: e.vues[0].stats.insectes,
      abeilles15m: out.filter(o => o.faune === 'abeille' && !o.fx && Math.hypot(o.p[0] - q.x, o.p[2] - q.z) < 15).length / 3 });
  }
  rapport.circuits.push({ theme, habitats: e.habitats.length, creationMs: ms, vegetation: d.vegetation || null, positions });
  if (theme !== 'montagne') continue;
  const meilleur = positions.filter(p => !p.tunnel).sort((a, b) => b.habitats90m - a.habitats90m || b.proches15m - a.proches15m)[0];
  for (const nuit of [0, 1]) for (const qualite of ['off', 'low', 'medium', 'high', 'ultra']) {
    const ctx = { qualite, nuit, pluie: 0, vue: 0, pose: B.circuit.echantillon(c, meilleur.s) }, out = [], mesures = [];
    for (let j = 0; j < 240; j++) { out.length = 0; B.faune.dessiner(e, temps += 1 / 60, ctx, out); }
    for (let j = 0; j < 3000; j++) {
      out.length = 0; const a = performance.now(); B.faune.dessiner(e, temps += 1 / 60, ctx, out); mesures.push(performance.now() - a);
    }
    mesures.sort((a, b) => a - b);
    rapport.cpu.push({ qualite, nuit, ...e.vues[0].stats, p50ms: mesures[1500], p95ms: mesures[2850], maxMs: mesures[2999] });
  }
}
fs.writeFileSync(new URL('./mesures.json', import.meta.url), JSON.stringify(rapport, null, 2) + '\n');
console.log(JSON.stringify({ circuits: rapport.circuits.map(c => ({ theme: c.theme, habitats: c.habitats, creationMs: Math.round(c.creationMs), positions: c.positions.map(p => ({ min: +p.min.toFixed(1), proches15m: p.proches15m, abeilles15m: p.abeilles15m, abeilles: p.abeilles, habitats: p.habitats90m, tunnel: p.tunnel })) })), cpu: rapport.cpu }, null, 2));
