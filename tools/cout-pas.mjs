#!/usr/bin/env node
// BITUME — coût d'un pas de simulation (Claude, 18/11/2026, lot 17).
// Règle du lot Fluidité (5B) reprise par le lot 17 : le pas de course (douze voitures) ne doit pas coûter plus de
// 30 % de plus à la fin du lot qu'avant, et ne fabrique aucun objet jeté. La mesure est celle de 5B-7 : Val-Brûlé
// (graine 11, forêt, 4 200 m), une course de douze voitures, la voiture du joueur à l'IA, 300 s simulées au pas de
// 1/120 s, après 5 s de chauffe non comptées ; temps par pas et ramasse-miettes mineurs du processus.
//
//   node tools/cout-pas.mjs                                   un essai sur src/
//   node tools/cout-pas.mjs --src A --contre B [--essais 7]   essais alternés A, B, A, B… chacun dans un processus
//                                                             neuf ; médianes (machine chargée : comparer des médianes)
//   node tools/cout-pas.mjs --un --src A                      un essai, sortie JSON (utilisé par les essais alternés)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { PerformanceObserver, constants } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url)), SRC = path.resolve(ICI, '..', 'src');
const DT = 1 / 120, CHAUFFE = 5 * 120, PAS = 300 * 120;

function essai(src) {
  const req = createRequire(path.join(src, 'cout-pas.cjs'));
  for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'carene', 'decor']) req(path.join(src, f + '.js'));
  const B = globalThis.BITUME;
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const decor = B.decor.construire(c);
  c.obstacles = B.obstacles.creer(decor.obstacles);
  const co = B.course.creer(c, { mode: 'course', tours: 8, difficulte: 2, rivaux: 11, graine: 7, placeJoueur: 8 });
  for (const v of co.voitures) v.etat.pneus = 'slicks';
  const pas = () => B.course.pas(co, co.joueur.fini ? null : B.course.commandesIA(co, co.joueur), DT);
  for (let k = 0; k < CHAUFFE; k++) pas();
  let mineurs = 0, majeurs = 0;
  const obs = new PerformanceObserver(l => { for (const e of l.getEntries()) { const k = e.detail ? e.detail.kind : e.kind; if (k === constants.NODE_PERFORMANCE_GC_MINOR) mineurs++; else majeurs++; } });
  obs.observe({ entryTypes: ['gc'] });
  const t0 = process.hrtime.bigint();
  for (let k = 0; k < PAS; k++) pas();
  const t1 = process.hrtime.bigint();
  return new Promise(res => setTimeout(() => {   // les entrées gc arrivent en différé, après quelques millisecondes
    obs.disconnect();
    res({ us_par_pas: Number(t1 - t0) / 1000 / PAS, gcMineurs: mineurs, gcMajeurs: majeurs, phase: co.phase, tours: co.joueur.tours });
  }, 200));
}

const mediane = xs => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = n => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true; };
  const src = path.resolve(typeof opt('src') === 'string' ? opt('src') : SRC);
  if (opt('un')) { console.log(JSON.stringify(await essai(src))); process.exit(0); }
  const contre = typeof opt('contre') === 'string' ? path.resolve(opt('contre')) : null, n = +(opt('essais') || (contre ? 7 : 1));
  const un = s => JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--un', '--src', s], { encoding: 'utf8' }).trim().split('\n').pop());
  const A = [], Bs = [];
  for (let i = 0; i < n; i++) { A.push(un(src)); if (contre) Bs.push(un(contre)); }
  const bilan = (nom, xs) => `${nom} : ${mediane(xs.map(x => x.us_par_pas)).toFixed(1)} µs par pas (médiane de ${xs.length} ; ${xs.map(x => x.us_par_pas.toFixed(1)).join(' ')}), ramasse-miettes mineurs ${mediane(xs.map(x => x.gcMineurs))}, majeurs ${mediane(xs.map(x => x.gcMajeurs))}`;
  console.log(bilan(path.relative(process.cwd(), src) || src, A));
  if (contre) {
    console.log(bilan(path.relative(process.cwd(), contre) || contre, Bs));
    console.log(`rapport ${(mediane(A.map(x => x.us_par_pas)) / mediane(Bs.map(x => x.us_par_pas))).toFixed(3)} (${path.basename(path.dirname(src))}/${path.basename(src)} sur ${path.basename(path.dirname(contre))}/${path.basename(contre)})`);
  }
}
