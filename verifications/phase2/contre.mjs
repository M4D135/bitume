// S4 : coup de glisse en R 120 à 0,98 × vLimite ; témoin figé contre contre-braquage donné 0,3 s après 4°.
import { CD, DT, deg, clamp, commande, rouler, tenir, vLimite } from './outils.mjs';
const vl = vLimite(120);
function essai(KB, KW, Kc, contre, aide = 0) {
  const { et, c, cmd } = tenir(120, vl * .98, 8);
  const b0 = et.beta, vol = cmd.volant, gaz = cmd.gaz;
  et.beta += KB; et.omega += KW;
  const k = commande({ volant: vol, gaz, aide });
  let tdet = -1, bMax = 0, tq = false, dMin = 0;
  rouler(et, c, k, 4, (et, k, t) => {
    if (tdet < 0 && et.beta - b0 > 4 / deg) tdet = t;
    if (contre && tdet >= 0 && t >= tdet + .3) k.volant = clamp(vol - Kc * (et.beta - b0), -1, 1);
    bMax = Math.max(bMax, Math.abs(et.beta)); tq ||= Math.abs(et.beta) > Math.PI / 2; dMin = Math.min(dMin, et.d);
  });
  return { tq, bMax: +(bMax * deg).toFixed(1), fin: +((et.beta - b0) * deg).toFixed(2), tdet: +tdet.toFixed(3), dMin: +dMin.toFixed(1), gaz: +gaz.toFixed(2) };
}
for (const [KB, KW] of [[.2, .6]]) {
  const t = essai(KB, KW, 0, false);
  const r = [1.5, 2.5, 4].map(Kc => `Kc ${Kc} ${JSON.stringify(essai(KB, KW, Kc, true))}`).join(' | ');
  console.log(`coup β ${(KB * deg).toFixed(1)}° ω ${KW} : témoin ${JSON.stringify(t)}\n   ${r}`);
}
