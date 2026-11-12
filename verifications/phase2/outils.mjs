// Outils de mesure de la phase 2 (copie des aides du banc), sur src/conduite.js ou la conduite.js donnée par
// BITUME_CONDUITE. Scripts : gaz (S3), contre (S4), clavier (S5), divers (S9 à S11), lever. Voir SUIVI-PHASE-2.md.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const req = createRequire(import.meta.url);
delete globalThis.BITUME;
req(path.resolve(process.env.BITUME_CONDUITE || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'conduite.js')));
export const B = globalThis.BITUME, CD = B.conduite, P = CD.PARAMS, G = 9.81, DT = 1 / 120, deg = 180 / Math.PI;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// avant : droite d'approche (m) ; puis arc de rayon R sur arc mètres ; puis droite
export function circuit({ R = 0, arc = Infinity, pente = 0, largeur = 400, limite = 500, avant = 0 } = {}) {
  const L = R && arc === Infinity && !avant ? 2 * Math.PI * R : 1e6;
  B.circuit = {
    echantillon(c, s) {
      let ss = ((s % L) + L) % L;
      if (ss < avant) return { x: ss - avant, y: 0, z: 0, cap: 0, courbure: 0, pente: 0, devers: 0, ligne: 0, vitesse: 0 };
      ss -= avant;
      if (R && ss <= arc) { const th = ss / R; return { x: R * Math.sin(th), y: 0, z: R * (1 - Math.cos(th)), cap: th, courbure: 1 / R, pente: 0, devers: 0, ligne: 0, vitesse: 0 }; }
      const th = R ? arc / R : 0, s0 = R ? ss - arc : ss;
      return { x: s0, y: pente * s0, z: 0, cap: th, courbure: 0, pente, devers: 0, ligne: 0, vitesse: 0 };
    },
    vibreurA() { return false; }
  };
  return { longueur: L, largeur, limite };
}
export const commande = (o = {}) => Object.assign({ gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0, guidage: 0 }, o);
export const vRef = R => Math.min(86, Math.sqrt(1.55 * G / Math.max(1 / R - 1.55 * .00155, 1e-9)));
export function piloter(et, c, vc, cmd, cible = 0) {
  const e = B.circuit.echantillon(c, et.s), v = Math.max(et.v, 5), la = 8 + .45 * v;
  const psiC = Math.atan2(cible - et.d, la);
  const kDes = e.courbure + 2.2 * (psiC - et.psi) / 10;
  cmd.volant = clamp(CD.volantPour(et, kDes), -1, 1);
  cmd.gaz = clamp((vc - et.v) * .8 + .35, 0, 1);
  cmd.frein = clamp((et.v - vc - 1) * .3, 0, 1);
  return cmd;
}
export function rouler(et, c, cmd, duree, chaque) {
  const n = Math.round(duree / DT), evs = [];
  for (let i = 0; i < n; i++) { if (chaque) chaque(et, cmd, i * DT); for (const e of CD.pas(et, cmd, c, DT)) { e.t = i * DT; evs.push(e); } }
  return evs;
}
export function tenir(R, vc, duree = 8, opts = {}) {
  const c = circuit({ R, largeur: opts.largeur ?? 400, limite: opts.limite ?? 500 });
  const et = CD.creer(0, 0); et.v = vc; if (opts.rapport) et.rapport = opts.rapport;
  const cmd = commande({ boite: opts.rapport ? 'manuelle' : 'auto' });
  let pire = 0;
  rouler(et, c, cmd, duree, (et, cmd, t) => { piloter(et, c, vc, cmd); if (t > duree - 2) pire = Math.max(pire, Math.abs(et.d), Math.abs(et.v - vc) / 2); });
  return { et, c, cmd, tenu: pire < 1 && Math.abs(et.beta) < .15 };
}
const memo = new Map();
export function vLimite(R) {
  if (memo.has(R)) return memo.get(R);
  let lo = 15, hi = 90;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (tenir(R, m).tenu) lo = m; else hi = m; }
  memo.set(R, lo); return lo;
}
