// S9 plein braquage (guidage), S10 charge à −3 g, S11 frein en entrée et accélération sur rapport long
import { CD, P, G, DT, deg, clamp, circuit, commande, rouler, tenir, vLimite } from './outils.mjs';
// S9
for (const [R, guidage] of [[0, 0], [150, .15], [300, .15]]) {
  const l = [];
  for (const kmh of [120, 200, 300]) {
    const c = circuit({ R }), et = CD.creer(0, 0); et.v = kmh / 3.6; et.rapport = 6;
    let pire = 0, depasse = 0;
    rouler(et, c, commande({ volant: 1, gaz: .5, guidage }), 2, et => {
      const lim = CD.capaciteLaterale(et.v) / Math.max(et.v, 1);
      pire = Math.max(pire, Math.abs(et.omega) / lim);
      depasse = Math.max(depasse, Math.abs(et.braquage) - CD.braquageMax(et.v));
    });
    l.push(`${kmh} : ${pire.toFixed(3)}${depasse > 1e-9 ? ' (braquage > braquageMax de ' + (depasse * deg).toFixed(2) + '°)' : ''}`);
  }
  console.log(`S9 R ${R || 'droit'} guidage ${guidage} : ${l.join(' | ')}`);
}
// S10
for (const v0 of [78, 86, 92]) {
  const c = circuit(), et = CD.creer(0, 0); et.v = v0; et.rapport = 6;
  let av = null, arme = false, i = 0;
  for (; i < 300 && av === null; i++) { CD.pas(et, commande({ frein: 1 }), c, DT); if (arme) av = et.chargeAv; arme = et.chargeX <= -3 * G; }
  console.log(`S10 freinage depuis ${v0} m/s : charge avant à −3 g ${av === null ? 'jamais −3 g' : av.toFixed(3)} (v ${et.v.toFixed(1)})`);
}
{ const c = circuit(), et = CD.creer(0, 0); et.v = 20; et.rapport = 2; let mini = 1;
  rouler(et, c, commande({ gaz: 1, boite: 'manuelle' }), 1, et => { mini = Math.min(mini, et.chargeAv); });
  console.log(`S10 accélération en 2e : charge avant mini ${mini.toFixed(3)} (répartition ${P.repartition})`); }
// S11
const courbure = et => et.omega / Math.max(et.v, 1);
{ const vl = vLimite(120), { et, c, cmd } = tenir(120, vl * .98, 8); const k0 = courbure(et);
  rouler(et, c, commande({ volant: cmd.volant, frein: .3 }), .5);
  console.log(`S11 frein 0,3 en entrée R 120 : courbure après/avant ${(courbure(et) / k0).toFixed(3)} β ${(et.beta * deg).toFixed(1)}°`); }
{ const vl = vLimite(200), { et, c, cmd } = tenir(200, vl * .95, 8); const k0 = courbure(et), a0 = et.deriveAr; let ar = 0;
  const rap = et.rapport;
  rouler(et, c, commande({ volant: cmd.volant, gaz: 1, boite: 'manuelle' }), 1, et => { ar = Math.max(ar, et.deriveAr); });
  console.log(`S11 plein gaz R 200 à ${(vl * .95 * 3.6).toFixed(0)} km/h en ${rap}e : courbure après/avant ${(courbure(et) / k0).toFixed(3)}, dérive arrière ${(a0 * deg).toFixed(1)}→${(ar * deg).toFixed(1)}°`); }
