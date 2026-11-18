// Étude E1 du lot 17, ligne droite et freinage : (1) le calculateur sur un jeu proche de l'actuel, face au banc,
// (2) les deux jeux cohérents du plan (niveau actuel, fidèle) sur le châssis p10, (3) grilles de freinage :
// force de pédale × répartition, répartition qui fait bloquer l'avant le premier, jeu retenu.
// node etude-ligne.mjs [resultats/ligne.json]
import { writeFileSync } from 'node:fs';
import { depart, piedLeve, freiner, pedaleLimite, freinMoteur } from './longitudinal.mjs';

const sortie = {};
const f1 = x => x == null ? '-' : x.toFixed(1), f2 = x => x == null ? '-' : x.toFixed(2);

// 1. Proche de l'actuel : 216 N·m pour 233 kW à la roue, 600 kg, SCx 0,58 ; la loi de charge linéaire du jeu est
// approchée par la loi en puissance (q 0,06), d'où une validation seulement grossière.
const actuelProche = { m: 600, L: 2.85, rep: .44, h: .33, SCz: 1.567, aeroAv: .45, SCx: .578, mu: 1.72, gAr: 1.08, q: .06, ex: 1, rr: .25,
  Tmax: 216, eta: .9, fm0: 20, fm1: .0035 };
const d0 = depart(actuelProche);
sortie.validation = { calcul: d0, banc: { t100: 2.53, t200: 7.30, m400: 9.88, pointe: 307.1, pRoueMax_kW: 233 } };
console.log(`1. Proche de l'actuel : 0-100 ${f2(d0.t100)} s (banc 2,53) · 0-200 ${f2(d0.t200)} s (banc 7,30) · 400 m ${f2(d0.m400)} s (banc 9,88) · pointe ${f1(d0.pointe)} km/h (banc 307,1, rupteur) · P roue ${d0.pRoueMax_kW.toFixed(0)} kW`);

// 2. Deux jeux cohérents sur le châssis p10 ; freins du jeu retenu (Fb 2,3 g, répartition 0,70, montée 0,15 s).
const chassis = { m: 665, L: 2.70, rep: .44, h: .33, SCz: 1.9, aeroAv: .42, mu: 1.85, gAr: 1.04, q: .18, ex: 1.05, rr: .25, eta: .9,
  fm0: 15, fm1: .0030, FbMax_g: 2.3, b: .70, glisse: .82 };
const jeux = { 'niveau actuel (216 N·m, SCx 0,58)': { Tmax: 216, SCx: .58 }, 'niveau actuel, SCx 0,70': { Tmax: 216, SCx: .70 },
  'intermédiaire (270 N·m, SCx 0,74)': { Tmax: 270, SCx: .74 }, 'fidèle (320 N·m, SCx 0,88)': { Tmax: 320, SCx: .88 }, 'fidèle, SCx 0,80': { Tmax: 320, SCx: .80 } };
sortie.jeux = {};
console.log('2. Châssis p10, deux jeux cohérents (puissance et traînée vont ensemble)');
for (const [nom, v] of Object.entries(jeux)) {
  const p = { ...chassis, ...v }, d = depart(p), a = freiner(p, 200, 0, { pilote: 'abs', rampe: .15 }), b = freiner(p, 300, 100, { pilote: 'abs', rampe: .15 });
  const o = { ...d, piedLeve290_g: piedLeve(p, 290, 6), piedLeve200_g: piedLeve(p, 200, 5), piedLeve120_g: piedLeve(p, 120, 3), f200_0_m: a.d, f300_100_m: b.d };
  sortie.jeux[nom] = { reglages: v, ...o };
  console.log(`   ${nom.padEnd(36)} 0-100 ${f2(d.t100)} · 0-200 ${f2(d.t200)} · 0-300 ${f1(d.t300)} · 400 m ${f2(d.m400)} · pointe ${f1(d.pointe)} · P roue ${d.pRoueMax_kW.toFixed(0)} kW · pied levé 290/200/120 ${f2(o.piedLeve290_g)}/${f2(o.piedLeve200_g)}/${f2(o.piedLeve120_g)} g · 200-0 ${f1(a.d)} m · 300-100 ${f1(b.d)} m`);
}

// 3a. Grille de freinage (frein moteur 20 + 0,0035·n N·m, montée 0,1 s) : ABS idéal, pédale pleine, pédale sans montée.
const fidele = { ...chassis, Tmax: 320, SCx: .88, gAr: 1.08, fm0: 20, fm1: .0035 };
sortie.grille = [];
console.log('3a. Grille Fb × répartition (frein moteur 55 N·m à 10 000 tr/min, montée 0,1 s)');
for (const Fb of [2.2, 2.4, 2.6]) for (const b of [.58, .62, .66]) {
  const p = { ...fidele, FbMax_g: Fb, b };
  for (const [a, c] of [[200, 0], [300, 100], [100, 0]]) {
    const abs = freiner(p, a, c, { pilote: 'abs', rampe: .1 }), plein = freiner(p, a, c, { pilote: 'plein', rampe: .1 }), sec = freiner(p, a, c, { pilote: 'plein', rampe: 0 });
    sortie.grille.push({ Fb, b, essai: `${a}-${c}`, abs_m: abs.d, abs_g: abs.moy_g, plein_m: plein.d, plein_bloqueAv_kmh: plein.vBlocAv, plein_bloqueAr_kmh: plein.vBlocAr, sansMontee_m: sec.d, sansMontee_bloqueAv_kmh: sec.vBlocAv });
    console.log(`   Fb ${Fb} g, b ${b}, ${`${a}-${c}`.padEnd(7)} ABS ${f1(abs.d)} m (${f2(abs.moy_g)} g) · pédale pleine ${f1(plein.d)} m, bloque av ${plein.vBlocAv == null ? '-' : plein.vBlocAv.toFixed(0)} / ar ${plein.vBlocAr == null ? '-' : plein.vBlocAr.toFixed(0)} km/h · sans montée ${f1(sec.d)} m, av ${sec.vBlocAv == null ? '-' : sec.vBlocAv.toFixed(0)}`);
  }
}
// 3b. Quelle répartition fait bloquer l'avant le premier, frein moteur compris (300-0, montée 0,15 s) ?
sortie.repartition = [];
console.log('3b. Premier essieu bloqué à pédale pleine, 300-0, selon la force du frein moteur et la répartition');
for (const fm of [1, .7, .5]) for (const Fb of [2.2, 2.4]) {
  const l = [];
  for (const b of [.58, .60, .62, .64, .66, .68, .70, .72]) {
    const r = freiner({ ...fidele, FbMax_g: Fb, b, fm0: 20 * fm, fm1: .0035 * fm }, 300, 0, { pilote: 'plein', rampe: .15 });
    sortie.repartition.push({ freinMoteur: fm, Fb, b, premier: r.premier, vBlocAv: r.vBlocAv, vBlocAr: r.vBlocAr });
    l.push(`b ${b.toFixed(2)} ${r.premier === 'avant' ? 'av' : 'AR'}@${(r.premier === 'avant' ? r.vBlocAv : r.vBlocAr).toFixed(0)}`);
  }
  console.log(`   frein moteur ×${fm}, Fb ${Fb} g : ${l.join(' · ')}`);
}
// 3c. Jeu retenu pour le plan : Fb 2,3 g, frein moteur 15 + 0,0030·n N·m (45 N·m à 10 000 tr/min).
sortie.retenu = [];
const retenu = { ...chassis, Tmax: 320, SCx: .88 };
console.log('3c. Jeu retenu (Fb 2,3 g, frein moteur 45 N·m à 10 000 tr/min, montée 0,15 s)');
for (const b of [.60, .64, .66, .68, .70]) {
  const p = { ...retenu, b }, o = { b };
  for (const [a, c] of [[300, 0], [200, 0], [300, 100], [100, 0]]) {
    const abs = freiner(p, a, c, { pilote: 'abs', rampe: .15 }), plein = freiner(p, a, c, { pilote: 'plein', rampe: .15 });
    o[`${a}-${c}`] = { abs_m: abs.d, abs_g: abs.moy_g, plein_m: plein.d, premier: plein.premier, vBlocAv: plein.vBlocAv, vBlocAr: plein.vBlocAr };
  }
  sortie.retenu.push(o);
  console.log(`   b ${b} : ` + Object.entries(o).filter(([k]) => k !== 'b').map(([k, v]) => `${k} ABS ${f1(v.abs_m)} m · plein ${f1(v.plein_m)} m, 1er ${v.premier}`).join(' · '));
}
const p = { ...retenu };
sortie.pedaleLimite = [300, 250, 200, 150, 100, 60].map(k => ({ kmh: k, part: pedaleLimite(p, k) }));
sortie.freinMoteur = [300, 200, 100, 50].map(k => ({ kmh: k, N: freinMoteur(p, k / 3.6), g: freinMoteur(p, k / 3.6) / p.m / 9.81 }));
console.log('   part de pédale à la limite de l\'avant :', sortie.pedaleLimite.map(x => `${x.kmh} km/h ${(x.part * 100).toFixed(0)} %`).join(' · '));
console.log('   frein moteur seul :', sortie.freinMoteur.map(x => `${x.kmh} km/h ${x.N.toFixed(0)} N (${x.g.toFixed(2)} g)`).join(' · '));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(sortie, null, 1) + '\n');
