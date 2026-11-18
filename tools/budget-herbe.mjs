#!/usr/bin/env node
/* Comptage des vrais brins et de leur densité locale. Aucune exécution GPU, aucun réseau. */
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const option = (cle, defaut) => { const i = args.indexOf(cle); return i < 0 ? defaut : args[i + 1]; };
const reference = option('--reference', null), qualite = option('--qualite', 'ultra'), sortie = option('--sortie', null);
const carteSortie = option('--carte', null), biomeDemande = option('--biome', null);
const comparaison = option('--baseline', null), precedent = comparaison ? JSON.parse(readFileSync(comparaison, 'utf8')) : null;
const referenceComplete = reference ? execFileSync('git', ['-C', root, 'rev-parse', reference], { encoding: 'utf8' }).trim() : 'WORKTREE';
const avecEcologie = reference ? !!execFileSync('git', ['-C', root, 'ls-tree', '--name-only', referenceComplete, 'src/ecologie.js'], { encoding: 'utf8' }).trim()
  : existsSync(path.join(root, 'src/ecologie.js'));
const avecSaisons = reference ? !!execFileSync('git', ['-C', root, 'ls-tree', '--name-only', referenceComplete, 'src/saisons.js'], { encoding: 'utf8' }).trim()
  : existsSync(path.join(root, 'src/saisons.js'));
const sources = Object.fromEntries(['circuit', ...(avecEcologie ? ['ecologie'] : []), ...(avecSaisons ? ['saisons'] : []), 'vegetation', 'decor'].map(n => [n, reference
  ? execFileSync('git', ['-C', root, 'show', referenceComplete + ':src/' + n + '.js'], { encoding: 'utf8', maxBuffer: 3000000 })
  : readFileSync(path.join(root, 'src', n + '.js'), 'utf8')]));
const graines = [[11, 'foret', 4200], [29, 'cote', 3600], [47, 'montagne', 5200]], lignes = [];
for (const [graine, theme, longueur] of graines) {
  if (biomeDemande && theme !== biomeDemande) continue;
  const contexte = vm.createContext({ console, performance });
  for (const [nom, code] of Object.entries(sources)) vm.runInContext(code, contexte, { filename: nom + '.js' });
  const B = contexte.BITUME, c = B.circuit.creer(graine, { theme, longueur });
  const debut = performance.now(), decor = B.decor.construire(c, { qualite: 'high', vegetationQualite: qualite });
  const constructionMs = performance.now() - debut, cache = new Map(), disques = [];
  const pointCarte = B.circuit.echantillon(c, c.longueur * .37), coCarte = Math.cos(pointCarte.cap), siCarte = Math.sin(pointCarte.cap);
  const projeterCarte = (x, z) => [(x - pointCarte.x) * coCarte + (z - pointCarte.z) * siCarte, -(x - pointCarte.x) * siCarte + (z - pointCarte.z) * coCarte];
  const carte = carteSortie ? { biome: theme, qualite, source: referenceComplete, longueur: 40, largeur: 70, racines: [], route: [] } : null;
  if (carte) for (const cote of [-1, 1]) {
    const bord = [];
    for (let s = -25; s <= 25; s++) { const e = B.circuit.echantillon(c, c.longueur * .37 + s); bord.push(projeterCarte(e.x - Math.sin(e.cap) * cote * c.largeur / 2, e.z + Math.cos(e.cap) * cote * c.largeur / 2)); }
    carte.route.push(...(cote > 0 ? bord.reverse() : bord));
  }
  for (const fraction of [.20, .37, .53, .69, .84]) for (const cote of [-1, 1]) {
    const s = fraction * c.longueur, e = B.circuit.echantillon(c, s), i = Math.floor(s / c.pas), rayon = 2;
    const limite = cote < 0 ? decor.limites.G[i] : decor.limites.D[i];
    if (limite < 12.5 || B.circuit.dansTunnel(c, s, 40) || Math.abs(B.circuit.ecart(c, 0, s)) < 400) continue;
    disques.push({ id: fraction + ':' + cote, s, cote, x: e.x - Math.sin(e.cap) * cote * 10,
      z: e.z + Math.cos(e.cap) * cote * 10, rayon, aire: Math.PI * rayon * rayon, brins: 0 });
  }
  function racines(nom) {
    let p = cache.get(nom); if (p) return p;
    const ancien = nom === 'herbes-val', tri = B.vegetation.forme(ancien ? nom + '-loin' : nom);
    const pas = ancien ? 8 : 6, n = tri.length / pas; p = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      const t = tri[i * pas];
      p[i * 2] = ancien ? t[0][0] : (t[0][0] + t[1][0]) / 2;
      p[i * 2 + 1] = ancien ? t[0][2] : (t[0][2] + t[1][2]) / 2;
    }
    cache.set(nom, p); return p;
  }
  let brins = 0, instances = 0, aire = 0, trianglesProches = 0, trianglesLointains = 0;
  for (const lot of decor.lots) if (lot.vegetation) for (const o of lot.objets) {
    if (o.shape !== 'herbes-val' && !o.shape.startsWith('prairie-val')) continue;
    const pieds = racines(o.shape); brins += pieds.length / 2; instances++; aire += o.grassArea || 0;
    trianglesProches += B.vegetation.forme(o.shape).length; trianglesLointains += B.vegetation.forme(o.shape + '-loin').length;
    const [rx, ry, rz] = o.r, cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    const rotation = v => {
      let [x, y, z] = v; [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      return [x * cz - y * sz, x * sz + y * cz, z];
    };
    const x = rotation([1, 0, 0]), y = rotation([0, 1, 0]), z = rotation([0, 0, 1]), shear = o.groundShear || 0;
    const bx = o.p[0] - y[0] * o.s[1] / 2, bz = o.p[2] - y[2] * o.s[1] / 2;
    const ax = x[0] * o.s[0], az = x[2] * o.s[0], zx = x[0] * shear + z[0] * o.s[2], zz = x[2] * shear + z[2] * o.s[2];
    const rayon = Math.hypot(o.s[0] + Math.abs(shear), o.s[2]) / 2;
    if (carte) {
      const p = projeterCarte(o.p[0], o.p[2]);
      if (Math.abs(p[0]) < 20 + rayon && Math.abs(p[1]) < 35 + rayon) for (let k = 0; k < pieds.length; k += 2) {
        const point = projeterCarte(bx + pieds[k] * ax + pieds[k + 1] * zx, bz + pieds[k] * az + pieds[k + 1] * zz);
        if (Math.abs(point[0]) <= 20 && Math.abs(point[1]) <= 35) carte.racines.push(point.map(v => Math.round(v * 1000) / 1000));
      }
    }
    for (const disque of disques) {
      if ((o.p[0] - disque.x) ** 2 + (o.p[2] - disque.z) ** 2 > (rayon + disque.rayon) ** 2) continue;
      for (let k = 0; k < pieds.length; k += 2) {
        const dx = bx + pieds[k] * ax + pieds[k + 1] * zx - disque.x;
        const dz = bz + pieds[k] * az + pieds[k + 1] * zz - disque.z;
        if (dx * dx + dz * dz <= disque.rayon * disque.rayon) disque.brins++;
      }
    }
  }
  for (const d of disques) {
    d.brinsParMetreCarre = d.brins / d.aire;
    const avant = precedent?.lignes.find(l => l.biome === theme)?.disques.find(v => v.id === d.id);
    if (avant) { d.brinsReference = avant.brins; d.facteurDepuisReference = avant.brins ? d.brins / avant.brins : null; }
  }
  const avant = precedent?.lignes.find(l => l.biome === theme);
  lignes.push({ biome: theme, graine, longueur: c.longueur, qualite, constructionMs, brins, instances,
    instanceBufferBytesTheoriques: instances * 16 * 4 * 2, trianglesProches, trianglesLointains,
    lotsPrairie: decor.lots.filter(l => l.groundCover || l.tapis).length, surfaceCouverte: aire,
    vegetation: decor.vegetation, surfaceDisponible: decor.herbier?.aire ?? null,
    facteurTotalDepuisReference: avant ? brins / avant.brins : null, disques, memoireProcessus: process.memoryUsage() });
  if (carte) writeFileSync(carteSortie, JSON.stringify(carte));
  console.log(JSON.stringify({ biome: theme, brins, instances, localMin: Math.min(...disques.map(d => d.brinsParMetreCarre)),
    facteurLocalMin: avant ? Math.min(...disques.map(d => d.facteurDepuisReference).filter(Number.isFinite)) : null }));
}
const rapport = { source: referenceComplete, referenceComparee: precedent?.source || null, qualite,
  mesure: 'Brins des maillages réellement instanciés, racines transformées dans des disques fixes de 2 m. Totaux géométriques et buffers théoriques ; aucune mesure FPS ou rasterisation GPU.', lignes };
if (sortie) { mkdirSync(path.dirname(path.resolve(sortie)), { recursive: true }); writeFileSync(sortie, JSON.stringify(rapport, null, 2) + '\n'); }
else console.log(JSON.stringify(rapport, null, 2));
