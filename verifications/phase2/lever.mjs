// lever de pied en R 120 à la limite : lacet après 0,5 s / avant
import { CD, DT, deg, commande, rouler, tenir, vLimite } from './outils.mjs';
const vl = vLimite(120), { et, c, cmd } = tenir(120, vl * .98, 8);
const w0 = et.omega, k = commande({ volant: cmd.volant, gaz: 0 });
rouler(et, c, k, .5);
console.log(`lever de pied R 120 : vLimite ${(vl * 3.6).toFixed(0)} km/h, lacet ${(et.omega / w0).toFixed(3)}, β fin ${(et.beta * deg).toFixed(1)}°`);
