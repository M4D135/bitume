// Étude E1 du lot 17, virages établis : (1) le calculateur contre le banc sur le modèle actuel, (2) sensibilité d'un
// premier jeu proposé, (3) jeu p10 retenu et son équilibre (marge de l'arrière sur l'avant).
// node etude-regime.mjs [resultats/regime.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { ACTUEL, P10, vLimiteR } from './regime-etabli.mjs';

const ICI = new URL('.', import.meta.url);
const banc = JSON.parse(readFileSync(new URL('../banc-base.json', ICI), 'utf8')).resultats.virages.etablis;
const Rs = [30, 60, 120, 180, 250];
const sortie = { validation: [], sensibilite: [], equilibre: [] };
const ligne = p => Rs.map(R => { const r = vLimiteR(p, R); return `R${R} ${r.kmh.toFixed(1)} (${r.g.toFixed(2)} g, ${r.limitePar[0]} ${r.margeArSurAv.toFixed(3)})`; }).join(' · ');

console.log('1. Calculateur contre banc (modèle actuel, vitesse d\'adhérence, traînée compensée)');
for (const R of [30, 60, 120, 180]) {
  const c = vLimiteR(ACTUEL, R), b = banc[R].vAdherence_kmh, ecart = c.kmh / b - 1;
  sortie.validation.push({ R, calcul_kmh: c.kmh, banc_kmh: b, ecart, limitePar: c.limitePar, margeArSurAv: c.margeArSurAv });
  console.log(`   R ${R} : calcul ${c.kmh.toFixed(1)} km/h, banc ${b} km/h, écart ${(ecart * 100).toFixed(1)} %, limité par l'${c.limitePar}, marge ${c.margeArSurAv.toFixed(3)}`);
}

console.log('2. Sensibilité d\'un premier jeu (SCz 2,2 m², gAr 1,08) : trop d\'adhérence à haute vitesse');
const premier = { ...P10, SCz: 2.2, gAr: 1.08 };
for (const [nom, v] of [['premier jeu', {}], ['mu 1,80', { mu: 1.80 }], ['mu 1,90', { mu: 1.90 }], ['q 0,12', { q: .12 }], ['q 0,25', { q: .25 }],
  ['SCz 1,8', { SCz: 1.8 }], ['SCz 2,6', { SCz: 2.6 }], ['aeroAv 0,45', { aeroAv: .45 }], ['aeroAv 0,40', { aeroAv: .40 }],
  ['m 600', { m: 600 }], ['tlltd 0,50', { tlltd: .50 }], ['tlltd 0,60', { tlltd: .60 }]]) {
  const p = { ...premier, ...v };
  sortie.sensibilite.push({ nom, reglages: v, R: Rs.map(R => vLimiteR(p, R)) });
  console.log('  ', nom.padEnd(14), ligne(p));
}

console.log('3. Jeu p10 (SCz 1,9 m², mu 1,85, q 0,18, 665 kg, 2,70 m) : équilibre selon gripArriere, appui avant, mu, SCz');
for (const [nom, v] of [['actuel', null], ['p10 gAr 1,08', { gAr: 1.08 }], ['p10 gAr 1,02', { gAr: 1.02 }], ['p10 gAr 1,04 (retenu)', {}],
  ['p10 gAr 1,06', { gAr: 1.06 }], ['p10 aeroAv 0,44', { aeroAv: .44 }], ['p10 mu 1,82', { mu: 1.82 }], ['p10 SCz 1,8', { SCz: 1.8 }]]) {
  const p = v ? { ...P10, ...v } : ACTUEL;
  // Lecture « équivalent banc » : la vitesse calculée corrigée de l'écart mesuré du calculateur à ce rayon.
  const R = Rs.map(R => { const r = vLimiteR(p, R), val = sortie.validation.find(x => x.R === R); return { ...r, equivalentBanc_kmh: val ? r.kmh / (1 + val.ecart) : null }; });
  sortie.equilibre.push({ nom, reglages: v, R });
  console.log('  ', nom.padEnd(22), ligne(p), '| équivalent banc', R.filter(x => x.equivalentBanc_kmh).map(x => `R${x.R} ${x.equivalentBanc_kmh.toFixed(1)}`).join(' '));
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(sortie, null, 1) + '\n');
