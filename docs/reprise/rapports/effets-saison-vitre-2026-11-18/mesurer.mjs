import { createRequire } from 'node:module';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), root = fileURLToPath(new URL('../../../../', import.meta.url));
for (const n of ['circuit', 'carene', 'ecologie', 'saisons', 'vegetation', 'decor', 'effets-saison', 'vitre']) require(root + 'src/' + n + '.js');
const B = globalThis.BITUME, E = B.effetsSaison, V = B.vitre, N = 4000;
const quantiles = valeurs => {
  valeurs.sort((a, b) => a - b);
  return { p50ms: valeurs[Math.floor(valeurs.length * .5)], p95ms: valeurs[Math.floor(valeurs.length * .95)], maximumMs: valeurs.at(-1) };
};
const rapport = {
  protocole: 'CPU Node, 4000 appels après chauffe. Effets 3D : vrais décors, caméra fixe puis trajet préparé à 180 km/h, animation à 60 Hz. Vitre : Canvas2D instrumenté sans rasterisation, appel hôte 120 Hz et simulation 30 Hz ; les timings ne mesurent ni le GPU, ni la rasterisation Canvas2D, ni le débit d’un appareil de jeu.',
  node: process.version, hashes: {}, scenes: [], effets: [], vitre: [],
  budgets3D: E.BUDGETS, budgetsVitre: V.BUDGETS, pixelsVitreMax: V.MAX_PIXELS
};
for (const n of ['faune', 'effets-saison', 'vitre', 'circuit', 'ecologie', 'saisons', 'decor'])
  rapport.hashes[n] = crypto.createHash('sha256').update(fs.readFileSync(root + 'src/' + n + '.js')).digest('hex');
for (const [theme, graine, longueur, saison] of [['foret', 11, 4200, 'automne'], ['montagne', 47, 5200, 'hiver']]) {
  const c = B.circuit.creer(graine, { theme, longueur }), decor = B.decor.construire(c, { vegetation: false, qualite: 'low', saison });
  globalThis.gc?.(); const memoire = process.memoryUsage().heapUsed, debut = performance.now(), e = E.creer(c, decor), creationMs = performance.now() - debut;
  globalThis.gc?.();
  rapport.scenes.push({ theme, saison, creationMs, variationHeapApresGc: globalThis.gc ? process.memoryUsage().heapUsed - memoire : null,
    sourcesArbres: decor.sourcesFeuilles.length, sourcesFeuillesAdmissibles: e.sources.length, objetsPoolesParVue: 608, vues: 2 });
  const point = theme === 'foret' ? e.sources[Math.floor(e.sources.length / 2)] : B.circuit.echantillon(c, c.longueur * .14);
  const fixe = { x: point.x, y: theme === 'foret' ? point.sol + 2 : point.y + 2, z: point.z };
  const poses = Array.from({ length: N }, (_, i) => {
    const s = c.longueur * .14 + i * 50 / 60, p = B.circuit.echantillon(c, s);
    p.y += 2; p.abri = B.circuit.dansTunnel(c, s); return p;
  });
  for (const qualite of ['off', 'low', 'medium', 'high', 'ultra']) for (const trajet of [false, true]) {
    const ctx = { qualite, nuit: .2, pluie: .9, ventX: 8, ventZ: 3, pose: trajet ? poses[0] : fixe, vue: 0, abri: false }, out = [];
    let t = 0;
    for (let i = 0; i < 2000; i++) { out.length = 0; E.dessiner(e, t += 1 / 60, ctx, out); }
    const mesures = new Array(N); let objets = 0, maximumObjets = 0; const requetes = e.vues[0].stats.requetes;
    for (let i = 0; i < N; i++) {
      if (trajet) { ctx.pose = poses[i]; ctx.abri = poses[i].abri; }
      out.length = 0; const debut = performance.now(); E.dessiner(e, t += 1 / 60, ctx, out); mesures[i] = performance.now() - debut;
      objets += out.length; maximumObjets = Math.max(maximumObjets, out.length);
    }
    rapport.effets.push({ theme, qualite, camera: trajet ? 'trajet_180kmh' : 'fixe', images: N, moyenneObjets: objets / N,
      maximumObjets, selections: e.vues[0].stats.requetes - requetes, ...quantiles(mesures) });
  }
}
function canvas() {
  const compte = { commandes: 0 };
  const contexte = { setTransform() { compte.commandes++; }, clearRect() { compte.commandes++; }, beginPath() { compte.commandes++; },
    moveTo() { compte.commandes++; }, lineTo() { compte.commandes++; }, quadraticCurveTo() { compte.commandes++; },
    stroke() { compte.commandes++; }, fill() { compte.commandes++; }, ellipse() { compte.commandes++; } };
  return { width: 1920, height: 1080, clientWidth: 1920, clientHeight: 1080, compte, getContext() { return contexte; } };
}
for (const qualite of ['off', 'low', 'medium', 'high', 'ultra']) for (const type of ['pluie', 'neige']) {
  const surface = canvas(), e = V.creer(surface), ctx = { actif: true, qualite, pluie: type === 'pluie' ? 1 : 0, neige: type === 'neige' ? 1 : 0,
    vitesse: 50, ventX: 8, ventZ: 3, dpr: 2 }, mesures = new Array(N);
  for (let i = 0; i < 2000; i++) V.mettreAJour(e, 1 / 120, ctx);
  const dessins = e.stats.dessins, commandes = surface.compte.commandes;
  let total = 0, maximum = 0;
  for (let i = 0; i < N; i++) {
    const debut = performance.now(); V.mettreAJour(e, 1 / 120, ctx); mesures[i] = performance.now() - debut;
    const n = e.stats.gouttes + e.stats.neige; total += n; maximum = Math.max(maximum, n);
  }
  rapport.vitre.push({ qualite, type, appelsHote: N, dessins: e.stats.dessins - dessins, pixels: e.stats.pixels,
    moyenneDepots: total / N, maximumDepots: maximum, commandesCanvas: surface.compte.commandes - commandes, ...quantiles(mesures) });
}
fs.writeFileSync(new URL('./mesures.json', import.meta.url), JSON.stringify(rapport, null, 2) + '\n');
console.log(JSON.stringify({ scenes: rapport.scenes, effets: rapport.effets.filter(x => x.qualite === 'ultra'), vitre: rapport.vitre.filter(x => x.qualite === 'ultra') }, null, 2));
