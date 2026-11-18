// Cibles de la conduite p10 (docs/reprise/17-CONDUITE.md § 5, sous-lots 17B à 17J), mesurées sur le banc de conduite
// (tools/banc-conduite.mjs, essais v1 et essais du lot 17) et sur les critères de la phase 2
// (conduite-criteres.test.mjs, lus dans sa sortie). Chaque ligne donne la valeur p9 du plan (BANC-BASE.md), la cible
// et la mesure du code présent.
//
// Une cible n'est obligatoire qu'une fois son sous-lot livré : OBLIGATOIRES ci-dessous en garde la liste, chaque
// sous-lot y ajoute le sien. Les autres sont des mesures (« mesure »), affichées sans faire échouer le test.
//
//   node verifications/conduite-p10.test.mjs                 joue le banc complet (une demi-minute à une minute)
//   node verifications/conduite-p10.test.mjs --json r.json   reprend une sortie du banc (banc-conduite.mjs --json)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { executer, charger, CONDITIONS, essaisP10, SRC } from '../tools/banc-conduite.mjs';

// Sous-lots livrés : leurs cibles sont obligatoires.
export const OBLIGATOIRES = new Set([]);

const ici = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), iJ = a.indexOf('--json');
const out = iJ >= 0 ? JSON.parse(readFileSync(a[iJ + 1], 'utf8')) : executer({});
if (!out.resultatsP10) { console.log('FAIL conduite p10 : sortie du banc sans les essais du lot 17 (banc v2 complet requis)'); process.exit(1); }
const R = out.resultats, T = out.resultatsP10;

// critères de la phase 2, lus dans la sortie de leur test (nom → valeur, état)
const C = new Map();
{
  let texte = '';
  try { texte = execFileSync(process.execPath, [path.join(ici, 'conduite-criteres.test.mjs')], { encoding: 'utf8', maxBuffer: 1 << 24 }); }
  catch (e) { texte = String(e.stdout || ''); }
  for (const l of texte.split('\n')) {
    // le nom d'un critère peut contenir « : » : il va jusqu'au dernier « : » avant « (cible »
    const m = /^(ok|KO|mesure) (.+) : (.+?) \(cible (.+?)\)(?: — (.*))?$/.exec(l);
    if (m) C.set(m[2], { ok: m[1] === 'ok', valeur: Number.isFinite(parseFloat(m[3])) ? parseFloat(m[3]) : m[3], info: m[5] || '' });
  }
  const bilan = /(\d+)\/(\d+) critères obligatoires tenus/.exec(texte);
  C.set('bilan', bilan ? { tenus: +bilan[1], total: +bilan[2] } : null);
}
const crit = nom => { const c = C.get(nom); return c ? c.valeur : null; };
const critOk = nom => { const c = C.get(nom); return c ? c.ok : null; };

// mesures qui ne sont pas dans la sortie du banc : variante de répartition, croisements des pneus
const ctx = charger(SRC), P = ctx.P;
const croisement = (p1, p2) => { let lo = 0, hi = 1; const d = w => ctx.CD.adherencePneus(p1, w) - ctx.CD.adherencePneus(p2, w); if (d(lo) * d(hi) > 0) return null; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (d(lo) * d(m) <= 0) hi = m; else lo = m; } return (lo + hi) / 2; };
let repartition60 = null;
try { repartition60 = essaisP10.freinageBlocage(charger(SRC, { freinAvant: .6 }), CONDITIONS.sec, 300, 0); } catch { /* paramètre renommé (17D) : la mesure passe au banc */ }
const physique = /const\s+PHYSIQUE\s*=\s*'([^']+)'/.exec(readFileSync(path.join(SRC, 'jeu.js'), 'utf8'));

const et = r => R.virages.etablis[r], ech = (v, k) => R.echelon[v][k], dans = (x, lo, hi) => x != null && x >= lo && x <= hi;
const fin = x => x != null && Number.isFinite(x);
const min = xs => xs.some(x => x == null) ? null : Math.min(...xs), max = xs => xs.some(x => x == null) ? null : Math.max(...xs);
const pc = x => x == null ? null : 100 * x;
const ENTREES3 = ['manette', 'clavier', 'souris'];
const parfaits = (() => { let n = 0, p = 0; for (const t of Object.values(R.derive.tenue)) for (const d of Object.values(t)) if (d && d.turbo) { n++; if (d.turbo.parfait) p++; } return n ? p / n : null; })();
const remise45 = (r, en) => R.remiseDesGaz.sortie[r].sec['45'][en];

// [lot, nom, p9 (plan), cible, valeur, ok(valeur)] ; ok rend null pour une ligne d'information (rien à atteindre)
const CIBLES = [
  // ---- 17B châssis, charges, pneus latéraux
  ...[['30', 84.9], ['60', 121.7], ['120', 185.9], ['180', 249.8]].map(([r, p9]) =>
    ['17B', `vitesse d'adhérence R ${r} (km/h)`, p9, `${p9} ± 3 %`, et(r).vAdherence_kmh, v => fin(v) && Math.abs(v / p9 - 1) <= .03]),
  ['17B', 'limite fixée par l’avant, R 30 à R 180', 'l’avant partout', 'l’avant partout', Object.values(T.limiteEssieux).map(x => x && x.limitePar).join(' / '), v => v.split(' / ').every(x => x === 'avant')],
  ['17B', 'réserve arrière à la limite, R 30 à R 180 (%)', '4,6 à 7,4 (mesure 17A)', '6 à 13', [min(Object.values(T.limiteEssieux).map(x => pc(x && x.reserveAr))), max(Object.values(T.limiteEssieux).map(x => pc(x && x.reserveAr)))], v => dans(v[0], 6, 13) && dans(v[1], 6, 13)],
  ['17B', 'gradient K, R 30 à R 180 (°/g)', '0,43 à 0,21', '0,1 à 0,6, positif', [min(['30', '60', '120', '180'].map(r => et(r).sousVirage_deg_par_g)), max(['30', '60', '120', '180'].map(r => et(r).sousVirage_deg_par_g))], v => dans(v[0], .1, .6) && dans(v[1], .1, .6)],
  ['17B', 'β à la limite, R 30 à R 180 (°)', '2,0 à 3,9', '1,5 à 3,5', [min(['30', '60', '120', '180'].map(r => et(r).betaLimite_deg)), max(['30', '60', '120', '180'].map(r => et(r).betaLimite_deg))], v => dans(v[0], 1.5, 3.5) && dans(v[1], 1.5, 3.5)],
  ['17B', 'échelon 200 km/h mi-volant : dépassement (%)', 17.1, '≤ 10 (+2)', ech('200', 'physique mi').depassement_pct, v => fin(v) && v <= 12],
  ['17B', 'échelon 200 km/h plein volant, voiture seule : dépassement (%)', 21.1, '≤ 15 (+2)', ech('200', 'physique plein').depassement_pct, v => fin(v) && v <= 17],
  ['17B', 'échelon 200 km/h plein volant, manette : dépassement (%)', 24.5, '≤ 18 (+2)', ech('200', 'manette plein').depassement_pct, v => fin(v) && v <= 20],
  ['17B', 't90 du lacet, 200 km/h mi-volant (ms)', 79, '≤ 90 (+5)', ech('200', 'physique mi').lacetT90_ms, v => fin(v) && v <= 95],
  ['17B', 't90 du lacet, 100 km/h mi-volant (ms)', 113, '≤ 125 (+5)', ech('100', 'physique mi').lacetT90_ms, v => fin(v) && v <= 130],
  ['17B', 'lever de pied R 120 (S3, lacet après / avant)', 1.13, '1,05 à 1,20', crit('S3 lever de pied R120 : lacet après/avant'), v => dans(v, 1.05, 1.2)],
  ['17B', 'frein 0,3 en entrée de R 120 (S11, courbure après / avant)', 1.53, '≥ 1,15', crit('S11 frein 0,3 entrée R120 : courbure après/avant'), v => fin(v) && v >= 1.15],
  ['17B', 'clavier R 30, part de la voiture seule (%)', 90, 'pas moins (≥ 89,5)', pc(R.virages.commandes.sec['30'].clavier && R.virages.commandes.sec['30'].clavier.surPhysiqueLarge), v => fin(v) && v >= 89.5],
  ['17B', 'clavier R 120, part de la voiture seule (%)', 95, 'pas moins (≥ 94,5)', pc(R.virages.commandes.sec['120'].clavier && R.virages.commandes.sec['120'].clavier.surPhysiqueLarge), v => fin(v) && v >= 94.5],
  ['17B', 'critères de la phase 2 tenus', '46/46', '46/46', C.get('bilan') ? `${C.get('bilan').tenus}/${C.get('bilan').total}` : null, v => v === '46/46'],
  ['17B', 'plein gaz en 2e, R 60, 0,92 × limite : x_ar maxi (S3 en fois le pic)', '1,36 (mesure 17A)', '≥ 1,25', T.pleinGaz['R60 0.92'].xArMax, v => fin(v) && v >= 1.25],
  // ---- 17C moteur, boîte, roues motrices
  ['17C', 'puissance à la roue, 1re à 6e (kW)', '182 → 233', '233 ± 4 % à chaque rapport', [min(R.ligneDroite.depart.sec.puissanceRoue_kW), max(R.ligneDroite.depart.sec.puissanceRoue_kW)], v => dans(v[0], 233 * .96, 233 * 1.04) && dans(v[1], 233 * .96, 233 * 1.04)],
  ['17C', 'régime × vPointe / v, p10 à p90 (tr/min)', 'affine', '12 800 ± 1 %', [T.regime && T.regime.p10, T.regime && T.regime.p90], v => dans(v[0], 12672, 12928) && dans(v[1], 12672, 12928)],
  ['17C', '0-100 km/h (s)', 2.53, '2,2 à 2,9', R.ligneDroite.depart.sec.t_kmh['100'], v => dans(v, 2.2, 2.9)],
  ['17C', '0-200 km/h (s)', 7.30, '6,8 à 7,8', R.ligneDroite.depart.sec.t_kmh['200'], v => dans(v, 6.8, 7.8)],
  ['17C', 'pointe (km/h)', 307.1, '295 à 310, sous le rupteur', R.ligneDroite.depart.sec.pointe_kmh, v => dans(v, 295, 310)],
  ['17C', 'pied levé à 290 km/h (g)', .58, '0,45 à 0,60', R.ligneDroite.freinMoteur.decel_g['290'], v => dans(v, .45, .6)],
  ['17C', 'frein moteur à 10 000 tr/min, 2e / 6e', 'identique (1,00)', '≥ 2', T.freinMoteur.rapport2sur6, v => fin(v) && v >= 2],
  ['17C', 'départ plein gaz sans aide : arrière au-delà du pic (s)', '1,33 à la capacité (mesure 17A)', '0,2 à 1,0', T.depart.sansAide.patinage_s, v => dans(v, .2, 1)],
  ['17C', 'départ : régime mini sur 0,5 s (tr/min)', 10309, '≥ 9 000', T.depart.sansAide.regimeMin05s, v => fin(v) && v >= 9000],
  ['17C', 'départ Légère / meilleur départ dosé (0-100)', '1,00', '≤ 1,03', T.depart.dose ? T.depart.legere.t100_s / T.depart.dose.t100_s : null, v => fin(v) && v <= 1.03],
  ...['30', '60'].map(r => ['17C', `remise des gaz à 45°, R ${r}, Légère (manette) : écart maxi (m)`, r === '30' ? 15.8 : 8.1, '≤ 4, sans tête-à-queue', remise45(r, 'manette') && !remise45(r, 'manette').teteAQueue ? remise45(r, 'manette').ecartMax_m : null, v => fin(v) && v <= 4]),
  ['17C', 'remise des gaz à 15°, R 30, voiture seule', 'passe (β 13,4°)', 'passe', R.remiseDesGaz.sortie['30'].sec['15'].physique.teteAQueue ? 'tête-à-queue' : 'passe', v => v === 'passe'],
  ...['120', '180'].map(r => ['17C', `aide seule R ${r} (%)`, r === '120' ? -1.7 : -3.4, '≥ −0,5', pc(R.virages.aideSeule.sec[r].rapport - 1), v => fin(v) && v >= -.5]),
  ['17C', 'clavier R 120, part de la voiture seule (%)', 95, '≥ 97', pc(R.virages.commandes.sec['120'].clavier && R.virages.commandes.sec['120'].clavier.surPhysiqueLarge), v => fin(v) && v >= 97],
  ['17C', 'slalom au clavier, vitesse face à la voiture seule (%)', -13, '≥ −9', pc(R.slalom.sec.clavier.v_kmh / R.slalom.sec.physique.v_kmh - 1), v => fin(v) && v >= -9],
  // ---- 17D freins et blocage
  ['17D', '200-0 au mieux (m)', 75.6, '66 à 76', R.ligneDroite.freinages['200-0'].sec.distance_m, v => dans(v, 66, 76)],
  ['17D', '300-100 au mieux (m)', 116.2, '112 à 126', R.ligneDroite.freinages['300-100'].sec.distance_m, v => dans(v, 112, 126)],
  ['17D', '100-0 au mieux (m)', 22.3, '19 à 23', R.ligneDroite.freinages['100-0'].sec.distance_m, v => dans(v, 19, 23)],
  ['17D', 'pédale pleine, manette Aucune, 300-0 : premier essieu bloqué, à (km/h)', 'antiblocage parfait', 'l’avant, 140 à 200', `${T.freinageBlocage['300-0 manette'].premier || 'aucun'} ${T.freinageBlocage['300-0 manette'].vBlocageAv_kmh == null ? '' : Math.round(T.freinageBlocage['300-0 manette'].vBlocageAv_kmh)}`.trim(), v => { const [q, k] = v.split(' '); return q === 'avant' && dans(+k, 140, 200); }],
  ['17D', 'pédale pleine, manette Aucune, 300-0 : distance / au mieux', '1,00', '≤ 1,12', T.freinageBlocage['300-0 manette'].distance_m / T.freinageBlocage['300-0'].distance_m, v => fin(v) && v <= 1.12],
  ['17D', 'répartition 60 % : premier essieu bloqué', '—', 'l’arrière', repartition60 ? repartition60.premier || 'aucun' : null, v => v === 'arrière'],
  ['17D', 'freinage plein en appui R 120, 0,9 × limite, aide 0 : hausse de β (°)', 75.4, '≤ 20', R.freinageEnAppui.boucleOuverteR120['1']['0'].hausseBeta_deg, v => fin(v) && v <= 20],
  ['17D', 'même essai, Légère : hausse de β (°)', 7.9, '≤ 8', R.freinageEnAppui.boucleOuverteR120['1']['0.35'].hausseBeta_deg, v => fin(v) && v <= 8],
  ['17D', 'même essai, Légère : écart vers l’extérieur à 1 s (m)', 4.5, '≤ 3', -R.freinageEnAppui.boucleOuverteR120['1']['0.35'].ecartInterieur1s_m, v => fin(v) && v <= 3],
  ['17D', 'clavier, 200-0 / au mieux', '1,00', '≤ 1,03', T.freinageBlocage['200-0 clavier'].distance_m / R.ligneDroite.freinages['200-0'].sec.distance_m, v => fin(v) && v <= 1.03],
  ...[86, 92].map(v0 => ['17D', `S10 charge avant à −3 g depuis ${v0} m/s`, v0 === 86 ? .614 : .601, '≥ 0,60', crit(`S10 charge avant à −3 g depuis ${v0} m/s`), v => fin(v) && v >= .6]),
  // ---- 17E aérodynamique et sillage
  ['17E', 'aspiration S3 : gain à 10 m en 4 s (m)', 4.06, '≥ 3', crit('S3 aspiration à 10 m : gain en 4 s'), v => fin(v) && v >= 3],
  ['17E', 'pointe en plein sillage (%)', .8, '+2 à +4', pc(R.ligneDroite.aspiration.pointeAspirationPleine_kmh / R.ligneDroite.depart.sec.pointe_kmh - 1), v => dans(v, 2, 4)],
  ['17E', 'R 120 derrière une voiture à 10 m : vitesse tenue (%)', '+0,4 (mesure 17A)', '−2 à −5', pc(T.sillage['R120 10 m'].rapport - 1), v => dans(v, -5, -2)],
  ['17E', 'gradient K à R 500 (°/g)', .10, '≥ 0,05', et('500').sousVirage_deg_par_g, v => fin(v) && v >= .05],
  ['17E', 'échelon 200 km/h mi-volant : dépassement (%)', 'celui de 17B', 'pas plus de 2 points au-dessus', ech('200', 'physique mi').depassement_pct, () => null],
  // ---- 17F direction et Aide
  ...['30', '120', '180'].map(r => ['17F', `aide seule (Légère) R ${r} (%)`, { 30: 100, 120: 98.3, 180: 96.6 }[r], '≥ 99', pc(R.virages.aideSeule.sec[r].rapport), v => fin(v) && v >= 99]),
  ['17F', 'S4 : témoin, contre-braquage, forte glisse (Aucune en tête-à-queue, Légère et Forte β ≤ 5°)', 'tenus', 'tenus', ['S4 coup de glisse : témoin tête-à-queue', 'S4 contre-braquage après 0,3 s', 'S4 forte glisse sans aide : tête-à-queue', 'S4 forte glisse avec aide 0.35', 'S4 forte glisse avec aide 0.7'].every(n => critOk(n)) ? 'tenus' : 'non', v => v === 'tenus'],
  ['17F', 'échelon 200 km/h plein volant, manette Aucune : dépassement (%)', '24,5 avec Légère', '≤ 18', T.echelonAucune['200 plein'].depassement_pct, v => fin(v) && v <= 18],
  ['17F', 'S9 plein braquage : lacet / limite', 1.161, '≤ 1,2', crit('S9 plein braquage : lacet / limite'), v => fin(v) && v <= 1.2],
  ['17F', 'S9 clavier 0 → 90 %, pire vitesse (ms)', '75 à 117', '≤ 120', max(['0', '310', '331'].map(k => crit(`S9 clavier 0→90 % à ${k} km/h`))), v => fin(v) && v <= 120],
  ['17F', 'S8 lissage de β (°/s²)', 1031, 'selon la réponse de David', crit('S8 lissage β à 60 et 120 Hz, pire scénario'), () => null],
  // ---- 17G dérive chargée physique
  ['17G', 'S6 paliers à qualité pleine : écart au mieux (s)', '0,70 / 1,31 / 2,11 s', '±0,05', crit('S6 paliers au mieux sur piste réelle'), v => fin(v) && v <= .05],
  ['17G', 'S6 tenue manette R 40 / 120 / 250 / 400 : écart maxi (m)', '2,4 / 1,1 / 0,3 / 1,1', '< 5,5 pendant 3 s', max(['40', '120', '250', '400'].map(r => crit(`S6 tenue manette R${r}`))), v => fin(v) && v < 5.5],
  ['17G', 'S5 clavier : au moins un pilote par cadence', 'au moins un', 'au moins un', [...C.keys()].filter(k => k.startsWith('S5 ')).every(k => critOk(k)) ? 'tenu' : 'non', v => v === 'tenu'],
  ...ENTREES3.map(en => ['17G', `gain d’une dérive (turbo), R 80, ${en} (s)`, { manette: .025, clavier: .175, souris: .425 }[en], '0,10 à 0,30', R.derive.gain['80'][en] && R.derive.gain['80'][en].gain_s, v => dans(v, .1, .3)]),
  ['17G', 'gain au clavier, R 40 (s)', .85, '≤ 0,40', R.derive.gain['40'].clavier && R.derive.gain['40'].clavier.gain_s, v => fin(v) && v <= .4],
  ['17G', 'gain le plus bas, R 250 (s)', -.075, '≥ −0,05', min(Object.values(R.derive.gain['250']).map(g => g && g.gain_s)), v => fin(v) && v >= -.05],
  ...['manette', 'clavier'].map(en => ['17G', `dérive tenue 10 s, R 80, ${en} : turbo, perte de 3 à 6 s (km/h)`, 'gratuite', 'turbo ≤ II ; 3 à 8 km/h', T.tenueLongue.R80[en] && !T.tenueLongue.R80[en].departRefuse ? `T${T.tenueLongue.R80[en].turbo ? T.tenueLongue.R80[en].turbo.niveau : 0} ${T.tenueLongue.R80[en].perte3a6s_kmh == null ? '' : T.tenueLongue.R80[en].perte3a6s_kmh.toFixed(1)}` : null, v => { if (!v) return false; const [tt, p] = v.split(' '); return +tt.slice(1) <= 2 && dans(+p, 3, 8); }]),
  ['17G', '« parfait » des pilotes scriptés (%)', 100, '≤ 70', pc(parfaits), v => fin(v) && v <= 70],
  ['17G', 'tirage de l’avant (PARAMS.deriveTirage)', P.deriveTirage, '0 (repli ≤ 0,6)', P.deriveTirage, v => fin(v) && v <= .6],
  ['17G', 'S7 : turbo coupé par frein, herbe, choc, contact ; IA même loi', 'tenus', 'tenus', [...C.keys()].filter(k => k.startsWith('S7 ')).every(k => critOk(k)) ? 'tenus' : 'non', v => v === 'tenus'],
  ['17G', 'slicks mouillés, R 80, clavier', 'annulée à 48,8°', 'annulée proprement, ou palier I', (() => { const d = R.derive.mouille['mouille-slicks']['80'].clavier; return !d || d.departRefuse ? 'départ refusé' : d.teteAQueue ? 'tête-à-queue' : d.annulee ? `annulée à ${d.annulation ? d.annulation.beta_deg.toFixed(1) : '?'}°` : d.turbo ? 'palier ' + d.turbo.niveau : 'lâchée'; })(), v => /^palier/.test(v) || (/^annulée/.test(v) && parseFloat(v.replace(/^annulée à /, '')) <= 30)],
  // ---- 17H surfaces et météo
  ['17H', 'herbe, centre 3 m dedans 1,5 s, à 100 km/h : temps perdu (s)', .05, '0,3 à 0,6', R.herbe['100'].sec.physique.tempsPerdu_s, v => dans(v, .3, .6)],
  ['17H', 'herbe, même essai à 200 km/h (s)', .35, '0,6 à 1,0', R.herbe['200'].sec.physique.tempsPerdu_s, v => dans(v, .6, 1)],
  ['17H', 'deux roues dans l’herbe, R 120 (bord + 0,5 m) : capacité (%)', 'tout ou rien au CG (100)', '85 à 92', pc(T.deuxRouesHerbe.R120 && T.deuxRouesHerbe.R120.capaciteRelative), v => dans(v, 85, 92)],
  ['17H', 'deux roues dans l’herbe, R 120 : β transitoire (°)', '1,0 (mesure 17A)', '≤ 4', T.deuxRouesHerbe.R120 && T.deuxRouesHerbe.R120.betaEntree_deg, v => fin(v) && v <= 4],
  ['17H', 'vibreur à 150 km/h, roues d’un côté dessus : capacité (%)', '100 (−8 % au CG)', '90 à 95', pc(T.vibreur['150'].rouesSurVibreur), v => dans(v, 90, 95)],
  ['17H', 'croisement des pneus slicks / intermédiaires (eau)', .2, '0,2 ± 0,05', croisement('slicks', 'inter'), v => dans(v, .15, .25)],
  ['17H', 'croisement des pneus intermédiaires / pluie (eau)', .47, '0,47 ± 0,05', croisement('inter', 'pluie'), v => dans(v, .42, .52)],
  ['17H', 'aquaplanage, eau 1, R 500 : adhérence des slicks sous les pneus pluie (%)', 'aucun écart (bornées par la pointe)', '≥ 25', (() => { const q = T.eau.aquaplanageR500; return q.slicks && q.pluie && !q.pluie.bornee ? pc(1 - (q.slicks.kmh / q.pluie.kmh) ** 2) : null; })(), v => fin(v) && v >= 25],
  ['17H', 'neige 1, R 120, slicks : adhérence perdue face au sec (%)', 'ignorée (0)', '30 à 45, pneus pluie meilleurs', pc(1 - (T.eau.neigeR120.slicks / et('120').vLimite_kmh) ** 2), v => dans(v, 30, 45) && T.eau.neigeR120.pluie > T.eau.neigeR120.slicks],
  // ---- 17I sensations : tests de son.js, vibrations.js, traces.js (créés en 17I)
  ...['hauteur du crissement (1 à x = 1, 0,80 ± 0,05 à x = 3)', 'bande de blocage seulement si κ < −κ_pic', 'vibration lourde / légère selon x_av, le patinage et la glisse arrière', 'hasard de course identique avec son et vibration coupés ou non']
    .map(n => ['17I', n, '—', 'test de 17I', 'à mesurer en 17I', () => null]),
  // ---- 17J rivaux, version, en ligne
  ['17J', 'référence des rivaux / vitesse d’adhérence, R 30 à R 180 (non bornés)', '0,94 à 1,13 (tenue) ; 0,938 à 1,000 (adhérence)', '0,97 à 1,03', (() => { const xs = T.rivaux.rayons.filter(x => x.R >= 25 && x.R <= 260 && !x.borne).map(x => x.refSurAdherence); return [min(xs), max(xs)]; })(), v => dans(v[0], .97, 1.03) && dans(v[1], .97, 1.03)],
  ['17J', 'profil des rivaux ajusté : μ_eq, A_eq', '1,735, 115e-5 (mesure 17A)', 'repris par circuit.js', `${T.rivaux.muEq.toFixed(3)} ; ${(T.rivaux.aeroEq * 1e5).toFixed(1)}e-5`, () => null],
  ['17J', 'difficultés 1 / 2 / 3 : tour des rivaux face au pilote scripté', 'à mesurer', 'mêmes rapports ±2 %', 'à mesurer en 17J (course.js)', () => null],
  ['17J', 'PHYSIQUE (src/jeu.js)', 'p9', 'p10', physique ? physique[1] : null, v => v === 'p10'],
  ['17J', 'empreinte du banc (v1)', '52a7484e7589dd23', 'nouvelle empreinte notée', out.empreinte.slice(0, 16), () => null]
];

const txt = v => v == null ? '—' : Array.isArray(v) ? v.map(txt).join(' à ') : typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 10 ? v.toFixed(2) : v.toFixed(3)).replace('.', ',') : String(v);
let obligatoires = 0, rouges = 0, tenues = 0, cibles = 0;
let lot = null;
for (const [l, nom, p9, cible, valeur, ok] of CIBLES) {
  if (l !== lot) { console.log(`--- ${l}${OBLIGATOIRES.has(l) ? ' (obligatoire)' : ' (mesure)'}`); lot = l; }
  let bon = false;
  try { bon = ok(valeur); } catch { bon = false; }
  if (bon === null) { console.log(`info ${nom} : ${txt(valeur)} (p9 ${txt(p9)} ; cible ${cible})`); continue; }
  bon = !!bon; cibles++;
  const oblig = OBLIGATOIRES.has(l);
  if (oblig) { obligatoires++; if (!bon) rouges++; }
  if (bon) tenues++;
  console.log(`${bon ? 'ok ' : oblig ? 'KO ' : 'mesure '}${nom} : ${txt(valeur)} (p9 ${txt(p9)} ; cible ${cible})`);
}
console.log(`banc ${out.empreinte.slice(0, 16)} · essais du lot 17 ${out.empreinteP10.slice(0, 16)} · sources ${out.empreinteSources.slice(0, 12)}`);
if (rouges) { console.log(`FAIL conduite p10 : ${rouges} cible(s) obligatoire(s) sur ${obligatoires} en échec`); process.exit(1); }
console.log(`conduite p10 : ${cibles} cibles, ${tenues} atteintes ; ${obligatoires} obligatoires (${[...OBLIGATOIRES].join(', ') || 'aucun sous-lot livré'}) tenues`);
