// S3 révisé : rayon où 0,93 × vLimite = FRAC × pointe du rapport (marge avant le rupteur), 2e et 3e.
import { CD, P, DT, deg, clamp, commande, rouler, tenir, vLimite } from './outils.mjs';
const FRAC = +(process.env.FRAC || .8);
const pointe = r => P.vitessePointe[r - 1];
function rayon(rap) {
  let lo = 20, hi = 300;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (.93 * vLimite(m) < FRAC * pointe(rap)) lo = m; else hi = m; }
  return Math.round((lo + hi) / 2);
}
function essai(rap, R, contre, aide = 0) {
  const v0 = .93 * vLimite(R);
  const { et, c, cmd } = tenir(R, v0, 8, { rapport: rap });
  const vol = cmd.volant, b0 = et.beta, a0 = et.deriveAr;
  const k = commande({ volant: vol, gaz: 1, boite: 'manuelle', aide });
  let arMax = 0, bMax = 0, tq = false, t4 = -1, t6 = -1, dMin = 0;
  const evs = rouler(et, c, k, contre ? 4 : 1.5, (et, k, t) => {
    if (t4 < 0 && et.deriveAr - a0 > 4 / deg) t4 = t;
    if (t6 < 0 && et.deriveAr > 6 / deg) t6 = t;
    if (contre && t4 >= 0 && t >= t4 + .3) k.volant = clamp(vol - 2.5 * (et.beta - b0), -1, 1);
    arMax = Math.max(arMax, et.deriveAr); bMax = Math.max(bMax, et.beta);
    tq ||= Math.abs(et.beta) > Math.PI / 2; dMin = Math.min(dMin, et.d);
  });
  const r1 = evs.find(e => e.type === 'rupteur');
  return `${rap}e R ${R} ${(v0 * 3.6).toFixed(0)} km/h aide ${aide}${contre ? ' +contre' : ''} : arrière ${(a0 * deg).toFixed(1)}→${(arMax * deg).toFixed(1)}° caisse ${(bMax * deg).toFixed(1)}° tq ${tq} t6 ${t6.toFixed(2)} rupteur ${r1 ? r1.t.toFixed(2) : '-'} fin β ${(et.beta * deg).toFixed(1)}° dMin ${dMin.toFixed(1)}`;
}
for (const rap of [2, 3]) {
  const R = rayon(rap);
  console.log(essai(rap, R, false)); console.log(essai(rap, R, true)); console.log(essai(rap, R, false, .35));
}
console.log(essai(3, 120, false));
