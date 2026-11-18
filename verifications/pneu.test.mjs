// Loi de pneu du lot 17 (src/pneu.js) : docs/reprise/17-CONDUITE.md § 3.2 à 3.4, cibles de 17A.
// - f(1) = 1 ; plateau avant 0,85 ± 0,005 à x = 50 ; 2 × la charge → force × 1,76 ± 0,01 ; angle du pic × 2^0,25
//   ± 0,5 % ; en glissement pur, Beckman rend la loi pure ; continuité au pic ;
// - la loi p9 rendue par pneu.p9 est celle de FERRO, mêmes fonctions ;
// - des mutants de la loi (sensibilité à la charge inversée, plateau effacé, chute discontinue, glissement combiné
//   pris au maximum au lieu de la norme) échouent chacun à au moins un contrôle.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ici = path.dirname(fileURLToPath(import.meta.url)), SRC = path.join(ici, '..', 'src');
const req = createRequire(import.meta.url);
const pneu = req(path.join(SRC, 'pneu.js'));
const FVD = globalThis.FVehicleDynamics;

// Valeurs du plan (§ 3.2) : avant c 0,15, l 1,0 ; arrière c 0,20, l 1,0 ; q 0,18 ; p 0,25 ; α_pic0 4,9° / 4,4°.
const AV = { c: .15, l: 1 }, AR = { c: .20, l: 1 }, Q = .18, PP = .25, A0 = 4.9 * Math.PI / 180, FZ0 = 1500, MU = 1.85;

function controles(N) {
  const r = [], noter = (nom, ok, valeur) => r.push({ nom, ok: !!ok, valeur });
  noter('f(1) = 1', Math.abs(N.courbe(1, AV.c, AV.l) - 1) < 1e-12, N.courbe(1, AV.c, AV.l));
  const plateau = N.courbe(50, AV.c, AV.l);
  noter('plateau avant à x = 50 : 0,85 ± 0,005', Math.abs(plateau - .85) <= .005, plateau);
  const plateauAr = N.courbe(50, AR.c, AR.l);
  noter('plateau arrière à x = 50 : 0,80 ± 0,005', Math.abs(plateauAr - .80) <= .005, plateauAr);
  const f2 = N.forceMax(MU, 2 * FZ0, FZ0, Q) / N.forceMax(MU, FZ0, FZ0, Q);
  noter('2 × la charge : force × 1,76 ± 0,01', Math.abs(f2 - 1.76) <= .01, f2);
  noter('adhérence à la charge statique : μ quel que soit q', [0, .1, .18, .25].every(q => Math.abs(N.mu(MU, FZ0, FZ0, q) - MU) < 1e-12), N.mu(MU, FZ0, FZ0, Q));
  const a2 = N.alphaPic(A0, 2 * FZ0, FZ0, PP) / N.alphaPic(A0, FZ0, FZ0, PP);
  noter('2 × la charge : angle du pic × 2^0,25 ± 0,5 %', Math.abs(a2 / Math.pow(2, .25) - 1) <= .005, a2);
  // continuité (et pente nulle) au pic, des deux côtés ; montée en sinus jusqu'au pic
  const e = 1e-7, g = N.courbe(1 - e, AV.c, AV.l), d = N.courbe(1 + e, AV.c, AV.l);
  noter('continuité au pic', Math.abs(g - 1) < 1e-9 && Math.abs(d - 1) < 1e-9, [g, d]);
  const pente = (N.courbe(1 + 1e-4, AV.c, AV.l) - N.courbe(1 - 1e-4, AV.c, AV.l)) / 2e-4;
  noter('pente nulle au pic', Math.abs(pente) < 1e-3, pente);
  noter('montée en sinus jusqu’au pic', [0, .1, .3, .5, .8, .99].every(x => Math.abs(N.courbe(x, AV.c, AV.l) - Math.sin(x * Math.PI / 2)) < 1e-12), N.courbe(.5, AV.c, AV.l));
  // décroissante au-delà du pic, jamais sous le plateau 1 − c ; impaire
  let dec = true, prec = 1;
  for (let x = 1; x <= 60; x += .05) { const y = N.courbe(x, AV.c, AV.l); if (y > prec + 1e-15 || y < 1 - AV.c - 1e-12) dec = false; prec = y; }
  noter('au-delà du pic : décroissante, au-dessus de 1 − c', dec, prec);
  noter('impaire', [.2, .9, 1.3, 4, 40].every(x => N.courbe(-x, AV.c, AV.l) === -N.courbe(x, AV.c, AV.l)), N.courbe(-2, AV.c, AV.l));
  // Beckman : en glissement pur, la loi pure ; la résultante suit f(ρ) dans toutes les directions
  const s = new Float64Array(2);
  let pur = true;
  for (const x of [-30, -3, -1.2, -1, -.4, 0, .3, .99, 1, 1.5, 2, 7, 50]) {
    N.combine(x, 0, 4000, AV.c, AV.l, 1, s);
    if (Math.abs(s[1] - 4000 * N.courbe(x, AV.c, AV.l)) > 1e-9 || Math.abs(s[0]) > 1e-12) pur = false;
    N.combine(0, x, 4000, AV.c, AV.l, 1.1, s);
    if (Math.abs(s[0] - 1.1 * 4000 * N.courbe(x, AV.c, AV.l)) > 1e-9 || Math.abs(s[1]) > 1e-12) pur = false;
  }
  noter('Beckman en glissement pur : la loi pure', pur, s[0]);
  let res = true;
  for (const rho of [.3, 1, 1.8, 6]) for (const th of [.3, .7, 1.1]) {
    N.combine(rho * Math.sin(th), rho * Math.cos(th), 4000, AV.c, AV.l, 1, s);
    if (Math.abs(Math.hypot(s[0], s[1]) - 4000 * N.courbe(rho, AV.c, AV.l)) > 1e-9) res = false;
  }
  noter('Beckman : résultante f(ρ)·Fmax quelle que soit la direction', res, Math.hypot(s[0], s[1]));
  N.combine(.05, 8, 4000, AV.c, AV.l, 1, s);
  noter('roue bloquée (κ ≫ α) : presque plus de force latérale', Math.abs(s[1]) < .01 * 4000, s[1]);
  const t = [9, 9, 9, 9];
  noter('combiné : écrit dans le tableau donné, à l’indice donné, et le rend', N.combine(1, 0, 100, AV.c, AV.l, 1, t, 2) === t && t[0] === 9 && t[1] === 9 && Math.abs(t[3] - 100) < 1e-12 && t[2] === 0, t);
  noter('combiné nul en glissement nul', N.combine(0, 0, 4000, AV.c, AV.l, 1, s)[0] === 0 && s[1] === 0, [s[0], s[1]]);
  // roue délestée : rien d'infini ni de NaN, force nulle sans charge
  const libre = [N.mu(MU, 0, FZ0, Q), N.forceMax(MU, 0, FZ0, Q), N.forceMax(MU, -50, FZ0, Q), N.alphaPic(A0, 0, FZ0, PP), N.alphaPic(A0, -5, FZ0, PP)];
  noter('roue délestée : force nulle, rien d’infini', libre.every(Number.isFinite) && libre[1] === 0 && libre[2] === 0, libre);
  // relaxation : sans longueur, la dérive géométrique ; au pas, τ = σ/u_r ; à 200 km/h, quasi immédiate
  const dt = 1 / 120;
  noter('relaxation coupée (σ = 0) : dérive géométrique', N.relaxer(0, .1, 30, dt, 0, 5) === .1, N.relaxer(0, .1, 30, dt, 0, 5));
  const r0 = N.relaxer(0, 1, 0, dt, .3, 5), r55 = N.relaxer(0, 1, 55.6, dt, .3, 5);
  noter('relaxation : 1 − e^(−u·dt/σ), u ≥ u_r', Math.abs(r0 - (1 - Math.exp(-5 * dt / .3))) < 1e-12 && Math.abs(r55 - (1 - Math.exp(-55.6 * dt / .3))) < 1e-12 && r55 > .75, [r0, r55]);
  // mémoire du pic : la chute retombe aussitôt, elle croît avec retard
  noter('mémoire du pic : l’adhérence revient aussitôt', N.suivreChute(.1, .02, .05) === .02, N.suivreChute(.1, .02, .05));
  const k = 1 - Math.exp(-dt / .15), m1 = N.suivreChute(0, .15, k);
  noter('mémoire du pic : la perte arrive en τ_pic', Math.abs(m1 - .15 * k) < 1e-15 && m1 < .15, m1);
  noter('courbe avec chute retenue : même plateau que la chute du moment', N.courbeAvec(3, N.chute(3, AV.c, AV.l)) === N.courbe(3, AV.c, AV.l), N.courbeAvec(3, .01));
  return r;
}

// ------------------------------------------------------------------ la loi elle-même
const echecs = controles(pneu).filter(c => !c.ok);
for (const c of controles(pneu)) console.log(`${c.ok ? 'ok ' : 'KO '} ${c.nom} : ${JSON.stringify(c.valeur)}`);

// ------------------------------------------------------------------ la loi p9 : celle de FERRO, à l'identique
const conduite = (() => { req(path.join(SRC, 'conduite.js')); return globalThis.BITUME.conduite; })();
const F = FVD.create(conduite.PARAMS), l9 = pneu.p9(F);
const memes = ['adherence', 'forme', 'retombee', 'pneu'].every(k => l9[k] === F[k]);
console.log(`${memes ? 'ok ' : 'KO '} pneu.p9 rend les fonctions mêmes de FERRO (adherence, forme, retombee, pneu)`);
let p9ok = memes;
try { pneu.p9({}); p9ok = false; } catch { /* refus attendu d'un objet qui n'est pas FERRO */ }
console.log(`${p9ok ? 'ok ' : 'KO '} pneu.p9 refuse un objet qui n'est pas une instance FVehicleDynamics`);

// ------------------------------------------------------------------ mutants
const texte = readFileSync(path.join(SRC, 'pneu.js'), 'utf8');
const MUTANTS = [
  ['sensibilité à la charge inversée', 'Math.pow(relative(fz, fz0), -q)', 'Math.pow(relative(fz, fz0), q)'],
  ['plateau effacé', 'if (x >= 1) return 1 - ch;', 'if (x >= 1) return 1;'],
  ['chute sans raccord au pic', 'return c * q / (q + l * l);', 'return c;'],
  ['glissement combiné au maximum, pas à la norme', 'const r = Math.sqrt(sa * sa + sk * sk);', 'const r = Math.max(Math.abs(sa), Math.abs(sk));']
];
let mutantsVivants = 0;
for (const [nom, a, b] of MUTANTS) {
  if (!texte.includes(a)) { console.log(`KO  mutant « ${nom} » : motif introuvable dans pneu.js`); mutantsVivants++; continue; }
  const bac = { Math, Float64Array, TypeError, Object };
  vm.runInNewContext(texte.replace(a, b), bac, { filename: 'pneu-mutant.js' });
  const tues = controles(bac.BITUME.pneu).filter(c => !c.ok).map(c => c.nom);
  console.log(`${tues.length ? 'ok ' : 'KO '} mutant « ${nom} » refusé par : ${tues.join(' ; ') || 'aucun contrôle'}`);
  if (!tues.length) mutantsVivants++;
}

const n = controles(pneu).length;
if (echecs.length || !memes || !p9ok || mutantsVivants) {
  console.log(`FAIL pneu : ${echecs.length} contrôle(s) en échec, ${mutantsVivants} mutant(s) non refusé(s)`);
  process.exit(1);
}
console.log(`pneu : ${n} contrôles de la loi p10 passés, loi p9 identique à FERRO, ${MUTANTS.length} mutants refusés`);
