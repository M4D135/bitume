// Étude E2 du lot 17 : leviers de l'amortissement du lacet, mesurés sur le vrai modèle (p9) par le banc de
// conduite (copie temporaire de conduite.js par variante, src/ de l'arbre jamais touché). Échelons de volant de
// tools/banc-conduite.mjs (gaz figé, entrée « physique ») à 200 et 100 km/h, mi-adhérence et plein volant ; plus la
// vitesse limite d'adhérence des cercles R 30, 120 et 180 pour la seconde passe.
// node etude-lacet.mjs [resultats/lacet.json]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RACINE = new URL('../../../../../', import.meta.url);
const { charger, essais, CONDITIONS } = await import(new URL('tools/banc-conduite.mjs', RACINE).href);
const SRC = fileURLToPath(new URL('src', RACINE));

function mesurer(reglages, modes, rayons = []) {
  const ctx = charger(SRC, Object.keys(reglages).length ? reglages : null), o = { reglages, empreinteSources: ctx.empreinteSources.slice(0, 12) };
  for (const [v, mode] of modes) {
    const e = essais.echelon(ctx, CONDITIONS.sec, v, 'physique', mode);
    o[`${v}-${mode}`] = e.teteAQueue ? { teteAQueue: true } : {
      depassement_pct: e.depassement_pct, amortissement: e.amortissement, lacetT90_ms: e.lacetT90_ms, lacetPic_ms: e.lacetPic_ms,
      etabli5pc_ms: e.etabli5pc_ms, ay_g: e.ay_g, beta_deg: e.beta_deg };
  }
  for (const R of rayons) { const l = essais.vLimite(ctx, CONDITIONS.sec, R); o[`vLimite${R}_kmh`] = l == null ? null : l * 3.6; }
  return o;
}
const txt = (o, k) => { const x = o[k]; if (!x) return ''; if (x.teteAQueue) return `${k} tête-à-queue`;
  return `${k} dép ${x.depassement_pct.toFixed(1)} % ζ ${x.amortissement == null ? '-' : x.amortissement.toFixed(2)} t90 ${x.lacetT90_ms.toFixed(0)} ms ét5 ${x.etabli5pc_ms.toFixed(0)} β ${x.beta_deg.toFixed(2)}°`; };

const sortie = { premiere: [], seconde: [] };
console.log('E2a. Un levier à la fois (empattement 2,85 sauf mention)');
const MODES1 = [[200, 'mi'], [200, 'plein'], [100, 'mi']];
for (const [nom, r] of [['base (p9)', {}], ['pic 4,3/3,9°', { alphaAv: 0.075, alphaAr: 0.068 }], ['pic 6,9/6,2°', { alphaAv: 0.120, alphaAr: 0.108 }],
  ['amortGlisse 0,8', { amortGlisse: 0.8 }], ['amortGlisse 1,1', { amortGlisse: 1.1 }], ['giration 1,15', { giration: 1.15 }], ['giration 1,45', { giration: 1.45 }],
  ['aeroAvant 0,42', { aeroAvant: 0.42 }], ['aeroAvant 0,40', { aeroAvant: 0.40 }], ['roulisAvant 0,60', { roulisAvant: 0.60 }], ['roulisAvant 0,48', { roulisAvant: 0.48 }],
  ['empattement 2,70', { empattement: 2.70 }], ['2,70 + pic 4,9/4,4° + amort 0,8', { empattement: 2.70, alphaAv: 0.085, alphaAr: 0.077, amortGlisse: 0.8 }]]) {
  const o = { nom, ...mesurer(r, MODES1) }; sortie.premiere.push(o);
  console.log('  ', nom.padEnd(32), MODES1.map(([v, m]) => txt(o, `${v}-${m}`)).join(' | '));
}
console.log('E2b. Dérive au pic × amortisseur de glisse, empattement 2,70');
const MODES2 = [[200, 'mi'], [200, 'plein'], [100, 'mi'], [100, 'plein']];
for (const [aAv, aAr, pic] of [[0.105, 0.095, '6,0/5,4°'], [0.094, 0.085, '5,4/4,9°'], [0.085, 0.077, '4,9/4,4°'], [0.075, 0.068, '4,3/3,9°']])
  for (const am of [0.5, 0.6, 0.7]) {
    const o = { nom: `${pic} amort ${am}`, ...mesurer({ empattement: 2.70, alphaAv: aAv, alphaAr: aAr, amortGlisse: am }, MODES2, [30, 120, 180]) };
    sortie.seconde.push(o);
    console.log('  ', o.nom.padEnd(20), MODES2.map(([v, m]) => txt(o, `${v}-${m}`)).join(' | '), `| vLimite R30/120/180 ${[30, 120, 180].map(R => o[`vLimite${R}_kmh`].toFixed(1)).join(' / ')} km/h`);
  }
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(sortie, null, 1) + '\n');
