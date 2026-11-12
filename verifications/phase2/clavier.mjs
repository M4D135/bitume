// S5 : dérive au clavier sur la piste réelle (12 m, glissière à 20 m), réglages du clavier (guidage 0,15, aide 0,35)
import { CD, DT, deg, clamp, circuit, commande, rouler, piloter, vRef } from './outils.mjs';
const LARG = +(process.env.LARG || 12), GUID = +(process.env.GUID ?? .15), AIDE = +(process.env.AIDE ?? .35);
function approche(R) {
  const c = circuit({ R, largeur: LARG, limite: LARG === 12 ? 20 : 500 }), v = vRef(R), et = CD.creer(0, 0); et.v = v;
  const cmd = commande();
  rouler(et, c, cmd, 6, (et, cmd) => piloter(et, c, v, cmd));
  return { c, et: structuredClone(et) };
}
// pilote tout-ou-rien : u = −a − kd·dn − kv·vn ; contre si u < −seuil, intérieur si u > seuil ; gaz selon g
function essai(depart, { a, kd, kv, seuil, g }, imp, hz) {
  const { c } = depart, et = structuredClone(depart.et), pasN = 120 / hz;
  const cmd = commande({ guidage: GUID, aide: AIDE, derive: true });
  let t = 0, i = 0, dMax = 0, annule = false, n3 = -1, depart0 = -1, prochaine = 0, sens = 0;
  while (t < 5) {
    if (i % pasN === 0) {
      const dr = et.derive;
      if (!dr.actif && depart0 < 0) { sens = Math.sign(1 / 120); cmd.volant = sens; cmd.gaz = 1; }
      else if (dr.actif && t >= prochaine) {
        const s = dr.sens || 1, dn = s * et.d, vn = s * et.v * Math.sin(et.psi), u = -a - kd * dn - kv * vn;
        cmd.volant = u < -seuil ? -s : (u > seuil ? s : 0);
        cmd.gaz = g[0] + g[1] * dn + g[2] * vn > .5 ? 1 : 0;
        prochaine = t + imp - 1e-9;
      }
    }
    for (const e of CD.pas(et, cmd, c, DT)) {
      if (e.type === 'derive' && depart0 < 0) { depart0 = t; prochaine = t; }
      if (e.type === 'deriveAnnulee') annule = true;
      if (e.type === 'niveau' && e.niveau === 3 && n3 < 0) n3 = t;
    }
    if (depart0 >= 0 && n3 < 0) dMax = Math.max(dMax, Math.abs(et.d));
    if (annule || n3 >= 0) break;
    t += DT; i++;
  }
  return { ok: n3 >= 0 && !annule && dMax < 5.5, n3: n3 - depart0, annule, dMax, depart0 };
}
const GRILLE = [];
for (const a of [0, .5, 1]) for (const kd of [.1, .3, .6]) for (const kv of [0, .1, .3]) for (const seuil of [.2, .5])
  for (const g of [[1, 0, 0], [1, .3, .3], [.5, .5, .5]]) GRILLE.push({ a, kd, kv, seuil, g });
for (const R of (process.env.RAYONS || '120').split(',').map(Number)) {
  const dep = approche(R);
  console.log(`R ${R} : approche à ${(vRef(R) * 3.6).toFixed(0)} km/h, d ${dep.et.d.toFixed(2)} psi ${(dep.et.psi * deg).toFixed(2)}° rapport ${dep.et.rapport}`);
  for (const imp of [.2, .1]) for (const hz of [30, 60, 120]) {
    let mieux = null, nOk = 0;
    for (const p of GRILLE) {
      const r = essai(dep, p, imp, hz);
      if (r.ok) nOk++;
      const note = r.ok ? 100 - r.dMax : (r.n3 >= 0 ? 50 - r.dMax : (r.annule ? 0 : 10));
      if (!mieux || note > mieux.note) mieux = { note, p, r };
    }
    const m = mieux.r;
    console.log(`  impulsions ${imp} s à ${hz} Hz : ${nOk}/${GRILLE.length} pilotes ok ; meilleur ${JSON.stringify(mieux.p)} palier 3 ${m.n3 >= 0 ? m.n3.toFixed(2) + ' s' : 'non'} |d| ${m.dMax.toFixed(2)} m ${m.annule ? 'annulée' : ''}`);
  }
}
