import { createRequire } from 'node:module';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), root = fileURLToPath(new URL('../../../../', import.meta.url));
for (const f of ['carene', 'circuit', 'ecologie', 'decor']) require(root + 'src/' + f + '.js');
const B = globalThis.BITUME, avantCode = fs.readFileSync(new URL('./faune-032.js', import.meta.url), 'utf8');
// Photographie qualifiée avant l'extension saisonnière ; conserver les empreintes du relevé.
const apresCode = fs.readFileSync(new URL('./faune-lot10-mesuree.js', import.meta.url), 'utf8');
const charger = code => new Function('globalThis', code + '; return globalThis.BITUME.faune;')({ BITUME: { ...B } });
const versions = [{ nom: '0.2.32', F: charger(avantCode) }, { nom: 'lot10', F: charger(apresCode) }];
const sha = code => crypto.createHash('sha256').update(code).digest('hex');
const resume = values => {
  const a = values.slice().sort((a, b) => a - b), mean = a.reduce((s, x) => s + x, 0) / a.length;
  return { n: a.length, zeros: a.filter(x => x === 0).length, min: a[0], p50: a[Math.floor(a.length / 2)], p90: a[Math.floor(a.length * .9)], max: a.at(-1),
    moyenne: mean, coefficientVariation: mean ? Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length) / mean : 0 };
};
const rapport = { protocole: 'Même décor courant sans végétation affichée pour les deux modules. Source .32 figée comparée au lot10. 64 poses régulièrement espacées sur le tour, hors tunnel. Temps absolu et pools réutilisés. CPU Node, aucun GPU ni navigateur.',
  baselineSha256: sha(avantCode), candidateSha256: sha(apresCode), dependencies: Object.fromEntries(['circuit', 'ecologie', 'decor'].map(n => [n, sha(fs.readFileSync(root + 'src/' + n + '.js', 'utf8'))])), circuits: [], cpu: [] };
let temps = 0;
function stabiliser(F, e, ctx, out, n = 90) { for (let j = 0; j < n; j++) { out.length = 0; F.dessiner(e, temps += 1 / 30, ctx, out); } }
function bench(F, e, ctx, tag) {
  const out = []; stabiliser(F, e, ctx, out, 180);
  const mesures = [];
  for (let i = 0; i < 4000; i++) { out.length = 0; const debut = performance.now(); F.dessiner(e, temps += 1 / 60, ctx, out); mesures.push(performance.now() - debut); }
  mesures.sort((a, b) => a - b);
  return { ...tag, qualite: ctx.qualite, nuit: ctx.nuit, abeilles: e.vues[0].stats.abeilles, insectes: e.vues[0].stats.insectes, lucioles: e.vues[0].stats.lucioles,
    objets: out.length, p50ms: mesures[2000], p95ms: mesures[3800], maximumMs: mesures.at(-1) };
}
function benchTour(F, e, c, ctx, tag) {
  // Préparer la conduite hors chronométrage : seule la soumission de faune est mesurée.
  const poses = Array.from({ length: 4000 }, (_, i) => B.circuit.echantillon(c, c.longueur * .14 + i * 50 / 60));
  const out = []; ctx.pose = poses[0]; stabiliser(F, e, ctx, out, 180);
  const mesures = []; let objets = 0, maximumObjets = 0;
  for (let i = 0; i < poses.length; i++) {
    ctx.pose = poses[i]; out.length = 0; const debut = performance.now();
    F.dessiner(e, temps += 1 / 60, ctx, out); mesures.push(performance.now() - debut);
    objets += out.length; maximumObjets = Math.max(maximumObjets, out.length);
  }
  mesures.sort((a, b) => a - b);
  return { ...tag, site: 'trajet_180kmh', qualite: ctx.qualite, nuit: ctx.nuit, vitesseKmh: 180, images: poses.length,
    moyenneObjets: objets / poses.length, maximumObjets, p50ms: mesures[2000], p95ms: mesures[3800], maximumMs: mesures.at(-1) };
}
const carte = [];
for (const [theme, graine, longueur] of [['foret', 11, 4200], ['cote', 29, 3600], ['montagne', 47, 5200]]) {
  const c = B.circuit.creer(graine, { theme, longueur }), decor = B.decor.construire(c, { vegetation: false, vegetationQualite: 'off', qualite: 'low' });
  const debutSol = performance.now(); decor.surfaceHerbe(c.x[0], c.z[0], {}); const preparationSolMs = performance.now() - debutSol;
  const poses = [];
  for (let k = 0; k < 64; k++) { const s = c.longueur * (k + .5) / 64; if (!B.circuit.dansTunnel(c, s, 30)) poses.push({ s, ...B.circuit.echantillon(c, s) }); }
  const plans = [];
  for (const version of versions) {
    const debut = performance.now(), e = version.F.creer(c, decor), creationModuleMs = performance.now() - debut;
    const rec = { theme, version: version.nom, habitats: e.habitats.length, preparationSolMs, creationModuleMs, distribution: {}, poses: [] };
    for (const nuit of [0, 1]) {
      if (nuit && theme !== 'montagne') continue;
      const ctx = { qualite: 'ultra', nuit, pluie: 0, vue: 0, pose: poses[0] }, out = [], populations = [];
      for (const pose of poses) {
        ctx.pose = pose; stabiliser(version.F, e, ctx, out);
        const st = e.vues[0].stats;
        const point = { s: pose.s, nuit, abeilles: st.abeilles, insectes: st.insectes, lucioles: st.lucioles, objets: st.objets };
        rec.poses.push(point); populations.push(nuit ? st.lucioles : st.abeilles + st.insectes);
      }
      rec.distribution[nuit ? 'nuit' : 'jour'] = resume(populations);
    }
    plans.push({ version, e, rec }); rapport.circuits.push(rec);
    if (theme === 'montagne') carte.push({ version: version.nom, circuit: Array.from(c.x).filter((_, i) => i % 4 === 0).map((x, k) => [x, c.z[k * 4]]),
      habitats: e.habitats.map(h => [h.x, h.z, h.lucioles === undefined ? 8 : h.lucioles, h.abeilles === undefined ? 8 : h.abeilles]) });
  }
  // Comparaison sur les mêmes poses : le foyer le plus riche du nouveau module, et une clairière.
  const actuel = plans[1].rec;
  for (const nuit of [0, 1]) {
    if (nuit && theme !== 'montagne' || !nuit && theme !== 'foret') continue;
    const ordre = actuel.poses.filter(p => p.nuit === nuit).sort((a, b) => b.objets - a.objets), choix = [ordre[0], ordre.at(-1)];
    for (let k = 0; k < choix.length; k++) for (const qualite of ['off', 'low', 'high', 'ultra']) for (const { version, e } of plans) {
      const pose = B.circuit.echantillon(c, choix[k].s), ctx = { qualite, nuit, pluie: 0, vue: 0, pose };
      rapport.cpu.push(bench(version.F, e, ctx, { theme, version: version.nom, site: k ? 'clairiere' : 'foyer_riche', s: choix[k].s }));
    }
    for (const qualite of ['high', 'ultra']) for (const { version, e } of plans) {
      rapport.cpu.push(benchTour(version.F, e, c, { qualite, nuit, pluie: 0, vue: 0, pose: null }, { theme, version: version.nom }));
    }
  }
}
// Le plafond reste testable même si la carte réelle ne remplit pas tous les slots au même endroit.
const objets = [];
for (let x = -96; x <= 96; x += 12) for (let z = -96; z <= 96; z += 12) objets.push({ shape: 'prairie-val-a', p: [x, 0, z], s: [1, .35, 1] });
const decor = { lots: [{ vegetation: true, objets }], surfaceHerbe(x, z, o = {}) { o.y = 0; o.normal = [0, 1, 0]; return o; },
  ecologie: { echantillonner(x, z, o) { o.herbe = o.fleurs = o.insectes = 1; o.boisement = 0; return o; } } };
for (const { nom, F } of versions) {
  const e = F.creer({ theme: 'montagne', graine: 47 }, decor);
  for (const nuit of [0, 1]) rapport.cpu.push(bench(F, e, { qualite: 'ultra', nuit, pluie: 0, vue: 0, pose: { x: 0, z: 30 } }, { version: nom, site: 'charge_maximale_synthetique' }));
}
fs.writeFileSync(new URL('./mesures.json', import.meta.url), JSON.stringify(rapport, null, 2) + '\n');
fs.writeFileSync(new URL('./carte.json', import.meta.url), JSON.stringify(carte) + '\n');
console.log(JSON.stringify({ distributions: rapport.circuits.map(c => ({ theme: c.theme, version: c.version, habitats: c.habitats, distribution: c.distribution })), cpu: rapport.cpu.filter(c => c.qualite === 'ultra') }, null, 2));
