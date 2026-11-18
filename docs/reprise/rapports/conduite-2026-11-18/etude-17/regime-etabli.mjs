// Calculateur de régime établi pour le lot 17 : deux essieux, quatre charges, transferts entiers, point fixe sur la
// limite latérale. Il sert à choisir les valeurs de départ du plan (docs/reprise/17-CONDUITE.md), pas à remplacer le
// banc : validé contre banc-base.json, il s'en écarte de −2,0 % (R 30) à +3,5 % (R 180), si bien qu'on lit ses
// rapports et ses écarts, pas ses valeurs absolues.
const G = 9.81, RHO = 1.225, KMH = 3.6;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

// Modèle actuel (p9) : adherence(mu, fz) = mu·borne(1 − 0,06·(fz/1500 − 1), 0,6, 1,15)·fz, une voie de 1,75 m pour
// les deux essieux, SCz et SCx tirés de aero 0,0016 et coeffTrainee 0,00059 pour 600 kg.
export const ACTUEL = Object.freeze({ nom: 'actuel', m: 600, L: 2.85, rep: .44, h: .33, tAv: 1.75, tAr: 1.75, tlltd: .54,
  SCz: 2 * 600 * .0016 / RHO, aeroAv: .45, SCx: 2 * 600 * .00059 / RHO, mu: 1.72, gAr: 1.08, loi: 'lineaire', sens: .06, fz0: 1500 });

// Jeu p10 retenu comme point de départ du plan (§ 3) : 312 T5 de 665 kg pilote compris, voies 1,70 / 1,615 m, loi de
// charge en puissance normée sur la charge statique de chaque essieu.
export const P10 = Object.freeze({ nom: 'p10', m: 665, L: 2.70, rep: .44, h: .33, tAv: 1.70, tAr: 1.615, tlltd: .54,
  SCz: 1.9, aeroAv: .42, SCx: .88, mu: 1.85, gAr: 1.04, loi: 'puissance', q: .18 });

// Adhérence d'une roue (N) : loi actuelle, ou μ(Fz) = μs·(Fz/Fz0)^−q avec Fz0 la charge statique de la roue.
function capRoue(p, mu, fz, fz0) {
  if (fz <= 0) return 0;
  if (p.loi === 'lineaire') return mu * clamp(1 - p.sens * (fz / p.fz0 - 1), .6, 1.15) * fz;
  return mu * Math.pow(fz / fz0, -p.q) * fz;
}

// Capacités latérales des deux essieux à la vitesse v (m/s) et à l'accélération latérale a (m/s²). Transfert par
// roue : part du couple de roulis m·a·h prise par l'essieu, divisée par sa voie (c'est aussi la formule de
// conduite.js, dy = m·a·h/voie, puis 0,54·dy par roue à l'avant).
export function capacites(p, v, a) {
  const m = p.m, appui = .5 * RHO * p.SCz * v * v;
  const fzAv = m * G * p.rep + appui * p.aeroAv, fzAr = m * G * (1 - p.rep) + appui * (1 - p.aeroAv);
  const roulis = m * a * p.h, dAv = p.tlltd * roulis / p.tAv, dAr = (1 - p.tlltd) * roulis / p.tAr;
  const fz0Av = p.loi === 'lineaire' ? p.fz0 : m * G * p.rep / 2, fz0Ar = p.loi === 'lineaire' ? p.fz0 : m * G * (1 - p.rep) / 2;
  const capAv = capRoue(p, p.mu, fzAv / 2 + dAv, fz0Av) + capRoue(p, p.mu, Math.max(0, fzAv / 2 - dAv), fz0Av);
  const capAr = capRoue(p, p.mu * p.gAr, fzAr / 2 + dAr, fz0Ar) + capRoue(p, p.mu * p.gAr, Math.max(0, fzAr / 2 - dAr), fz0Ar);
  return { capAv, capAr, A: p.L * (1 - p.rep), BR: p.L * p.rep };
}

// Limite latérale (m/s²) à la vitesse v : le plus petit des deux essieux (moments autour du CG), point fixe sur le
// transfert. margeArSurAv > 1 : l'avant sature le premier (sous-virage à la limite).
export function limite(p, v) {
  let a = 15;
  for (let i = 0; i < 200; i++) {
    const c = capacites(p, v, a), aAv = c.capAv * p.L / (p.m * c.BR), aAr = c.capAr * p.L / (p.m * c.A), an = Math.min(aAv, aAr);
    if (Math.abs(an - a) < 1e-10) return { a: an, limitePar: aAv < aAr ? 'avant' : 'arrière', aAv, aAr };
    a += .5 * (an - a);
  }
  throw new Error('limite : pas de convergence');
}

// Vitesse limite d'adhérence d'un rayon R (traînée compensée : l'arrière ne pousse pas), par dichotomie.
export function vLimiteR(p, R) {
  let lo = 5, hi = 140;
  for (let i = 0; i < 80; i++) { const v = (lo + hi) / 2; if (v * v / R <= limite(p, v).a) lo = v; else hi = v; }
  const l = limite(p, lo);
  return { R, kmh: lo * KMH, g: lo * lo / R / G, limitePar: l.limitePar, margeArSurAv: l.aAr / l.aAv };
}
