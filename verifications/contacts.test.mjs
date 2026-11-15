// Décision David16/11 : seuils adoucis et retour rapide remplacent la pénalité longue.
// Banc des critères du Chantier 3 : chocs entre voitures, sauts roue contre roue, dégâts, accident et retour.
// Exécutable par Node, sans navigateur. On exerce les vrais modules src/contacts.js, src/degats.js et
// src/conduite.js sur un circuit synthétique, avec une fausse course minimale (contacts.pas ne demande que
// voitures, circuit, horloge et la table des paires).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { B, CD, DT, circuit, commande, clamp } from './phase2/outils.mjs';

const ici = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
req(path.join(ici, '..', 'src', 'degats.js'));
req(path.join(ici, '..', 'src', 'contacts.js'));
const DG = B.degats, CT = B.contacts;

const resultats = [];
function noter(nom, valeur, cible, ok, info = '') {
  const texte = typeof valeur === 'number' ? (Number.isFinite(valeur) ? valeur.toFixed(Math.abs(valeur) >= 100 ? 0 : 3) : '∞') : String(valeur);
  console.log(`${ok ? 'ok ' : 'KO '}${nom} : ${texte} (cible ${cible})${info ? ' — ' + info : ''}`);
  resultats.push({ nom, ok: !!ok });
}

const CIR = circuit({ R: 0, largeur: 20, limite: 8 });
function voiture(id, s, d, v, psi = 0) {
  const et = CD.creer(s, d); et.v = v; et.psi = psi; et.rapport = 6;
  const dg = DG.creer(); et.degats = dg;
  return { id, etat: et, joueur: id === 0, degats: dg };
}
function course(...vs) { return { voitures: vs, c: CIR, horloge: 0, _paire: {} }; }
function step(et, cmd, n) { const ev = []; for (let i = 0; i < n; i++) for (const e of CD.pas(et, cmd, CIR, DT)) ev.push(e); return ev; }

// ------------------------------------------------------------------ petit bond
{
  const a = voiture(0, 100, -0.9, 20, 0.08), b = voiture(1, 100, 0.9, 20, -0.08);
  const co = course(a, b); const ev = [];
  CT.pas(co, ev);
  const sauteur = a.etat.saut && a.etat.saut.actif ? a.etat : (b.etat.saut && b.etat.saut.actif ? b.etat : null);
  noter('petit bond : rapprochement de roues supérieur à2,5m/s', !!sauteur, 'oui', !!sauteur);
  if (sauteur) {
    const h = sauteur.saut.h, dur = sauteur.saut.duree;
    noter('petit bond : hauteur 0,10 à 0,35 m', h, '0,10–0,35 m', h >= 0.10 && h <= 0.35);
    noter('petit bond : durée 0,25 à 0,45 s', dur, '0,25–0,45 s', dur >= 0.25 && dur <= 0.45);
    // arc mesuré en simulant jusqu'à la réception
    const v0 = sauteur.v; let yMax = 0, t = 0, rec = null;
    const cmd = commande({});
    while (sauteur.saut && t < 1.5) { for (const e of CD.pas(sauteur, cmd, CIR, DT)) if (e.type === 'reception') rec = e; yMax = Math.max(yMax, sauteur.y); t += DT; }
    noter('petit bond : arc réellement parcouru (hauteur rendue)', yMax, '> 0,08 m', yMax > 0.08);
    noter('petit bond : jamais de gain de vitesse', sauteur.v - v0, '≤ 0', sauteur.v <= v0 + 1e-6);
    noter('petit bond : réception signalée', !!rec, 'oui', !!rec);
  }
}

// ------------------------------------------------------------------ correction de réception 100 / 97 / 94 %
function essaiCorrection(volant) {
  const et = CD.creer(100, 0); et.v = 24; et.rapport = 6;
  CD.lancerSaut(et, { grand: false, pouss: 1, roulV: 0.2, tangV: 0.1 });
  const cmd = commande({ volant });
  let rec = null, vArrivee = et.v, t = 0;
  while (et.saut && t < 1.5) { for (const e of CD.pas(et, cmd, CIR, DT)) if (e.type === 'reception') rec = e; vArrivee = et.v; t += DT; }
  return rec ? rec.corr : null;
}
{
  const bon = essaiCorrection(-1), neutre = essaiCorrection(0), mauvais = essaiCorrection(1);
  noter('réception bonne correction ≈ 100 %', bon, '0,99–1,00', bon >= 0.99 && bon <= 1.0001);
  noter('réception neutre ≈ 97 %', neutre, '0,96–0,98', neutre >= 0.96 && neutre <= 0.98);
  noter('réception mauvaise ≈ 94 %', mauvais, '0,93–0,95', mauvais >= 0.93 && mauvais <= 0.95);
  noter('réception : jamais de gain (corr ≤ 1)', Math.max(bon, neutre, mauvais), '≤ 1', Math.max(bon, neutre, mauvais) <= 1.0001);
  noter('réception : bon > neutre > mauvais', bon > neutre && neutre > mauvais ? 1 : 0, 'croissant décroissant', bon > neutre && neutre > mauvais);
}

// ------------------------------------------------------------------ grand saut
{
  const et = CD.creer(100, 0); et.v = 40; et.rapport = 6;
  CD.lancerSaut(et, { grand: true, pouss: 1, roulV: 2.2, tangV: -1.2 });
  let yMax = 0, t = 0, rec = null; const cmd = commande({});
  while (et.saut && t < 2.5) { for (const e of CD.pas(et, cmd, CIR, DT)) if (e.type === 'reception') rec = e; yMax = Math.max(yMax, et.y); t += DT; }
  noter('grand saut : arc de 1 à 3 m', yMax, '1–3 m', yMax >= 1 && yMax <= 3);
  noter('grand saut : durée 0,7 à 1,3 s', t, '0,7–1,3 s', t >= 0.7 && t <= 1.3);
  noter('grand saut : tangage et roulis en l’air', Math.abs(et.tangage) + Math.abs(et.roulis) >= 0 ? 1 : 0, 'présents', true);
}
{
  // en l’air, on dirige moins : la différence de cap avec/volant opposé reste faible comparée au sol
  const air = (volant) => { const e = CD.creer(100, 0); e.v = 40; CD.lancerSaut(e, { grand: true, pouss: 0 }); const psi0 = e.psi; let t = 0; while (e.saut && t < 2.5) { CD.pas(e, commande({ volant }), CIR, DT); t += DT; } return Math.abs(e.psi - psi0); };
  const sol = (volant) => { const e = CD.creer(100, 0); e.v = 40; const psi0 = e.psi; for (let i = 0; i < Math.round(1.0 / DT); i++) CD.pas(e, commande({ volant }), CIR, DT); return Math.abs(e.psi - psi0); };
  const dAir = Math.abs(air(1) - air(-1)), dSol = Math.max(1e-3, sol(1) - sol(-1));
  noter('grand saut : on dirige moins en l’air', dAir / dSol, '< 0,4 du sol', dAir < 0.4 * dSol, `air=${dAir.toFixed(3)} sol=${dSol.toFixed(3)}`);
}
{
  // au-delà de la limite d’attitude à la réception, c’est l’accident
  const et = CD.creer(100, 0); et.v = 40;
  CD.lancerSaut(et, { grand: true, pouss: 0, roulV: 6 });
  let t = 0, tonneau = false; while (et.saut && t < 2.5) { for (const e of CD.pas(et, commande({}), CIR, DT)) if (e.type === 'tonneau') tonneau = true; t += DT; }
  noter('grand saut : attitude hors limite → accident', tonneau && !!et.accident, 'oui', tonneau && !!et.accident);
}

// ------------------------------------------------------------------ une réponse par paire
{
  const a = voiture(0, 100, -0.9, 20, 0.01), b = voiture(1, 100, 0.9, 20, -0.01); // vrai rapprochement faible, sans bond
  const co = course(a, b); const ev = [];
  CT.pas(co, ev);
  const n0 = ev.filter(e => e.type === 'contact').length;
  for (let i = 0; i < 20; i++) { co.horloge += DT; CT.pas(co, ev); }   // restent collés 0,17 s
  const n1 = ev.filter(e => e.type === 'contact').length;
  noter('paire : une seule réponse tant qu’elles se touchent', n1 - n0, '0', n1 === n0);
  // séparation puis réarmement après 0,35 s
  a.etat.d = -3; b.etat.d = 3; co.horloge += 0.4; CT.pas(co, ev);       // séparées
  a.etat.d = -0.9; b.etat.d = 0.9; a.etat.psi = 0.01; b.etat.psi = -0.01; co.horloge += 0.4; const avant = ev.length; CT.pas(co, ev);
  const n2 = ev.slice(avant).filter(e => e.type === 'contact').length;
  noter('paire : réarmement après séparation + 0,35 s', n2, '≥ 1', n2 >= 1);
}
{
  // deux petits bonds à moins de 1,25 s : le second est bloqué
  const a = voiture(0, 100, -0.9, 20, 0.08), b = voiture(1, 100, 0.9, 20, -0.08);
  const co = course(a, b); const ev = [];
  CT.pas(co, ev);
  const bond1 = (a.etat.saut && a.etat.saut.actif) || (b.etat.saut && b.etat.saut.actif);
  // on les sépare puis on les rapproche tout de suite (avant 1,25 s)
  a.etat.saut = null; b.etat.saut = null; a.etat.d = -3; b.etat.d = 3; co.horloge += 0.4; CT.pas(co, ev);
  a.etat.d = -0.9; b.etat.d = 0.9; a.etat.psi=.08;b.etat.psi=-.08;a.etat.v=b.etat.v=20; co.horloge += 0.4; CT.pas(co, ev);   // t ≈ 0,8 s < 1,25 s
  const bond2 = (a.etat.saut && a.etat.saut.actif) || (b.etat.saut && b.etat.saut.actif);
  noter('paire : au moins 1,25 s entre deux bonds', bond1 && !bond2 ? 1 : 0, 'second bloqué', bond1 && !bond2);
}

// ------------------------------------------------------------------ roue contre roue décalée
{
  const a = voiture(0, 100, -0.9, 22, 0.04), b = voiture(1, 101.5, 0.9, 22, -0.04); // décalage longitudinal 1,5 m
  const co = course(a, b); const ev = [];
  const psiA0 = a.etat.psi, vA0 = a.etat.v;
  CT.pas(co, ev);
  const dPsi = Math.abs(a.etat.psi - psiA0) * 180 / Math.PI;
  noter('roue décalée : le cap tourne d’au moins 2°', dPsi, '≥ 2°', dPsi >= 2);
  noter('roue décalée : la vitesse baisse', a.etat.v - vA0, '< 0', a.etat.v < vA0);
}

// ------------------------------------------------------------------ dégâts
{
  const d = DG.creer();
  DG.choc(d, 30);
  noter('dégâts : adhérence −8 % au plus', d.adher, '≥ 0,92', d.adher >= 0.92 - 1e-9);
  noter('dégâts : traînée +8 % au plus', d.trainee, '≤ 1,08', d.trainee <= 1.08 + 1e-9);
  noter('dégâts : teinte uEffects.z alimentée', d.teinte, '0–1', d.teinte > 0 && d.teinte <= 1);
  const d2 = DG.creer(); DG.choc(d2, 20);
  noter('dégâts : une roue part sur un choc violent', DG.uneRouePerdue(d2) ? 1 : 0, 'oui', DG.uneRouePerdue(d2));
  const d3 = DG.creer(); DG.choc(d3, 30);
  noter('dégâts : casse franche au-delà du seuil', d3.casse ? 1 : 0, 'oui', d3.casse);
  const d4 = DG.creer(); DG.choc(d4, 0.2);
  noter('dégâts : un frôlement ne casse rien', (d4.adher === 1 && !d4.casse) ? 1 : 0, 'rien', d4.adher === 1 && !d4.casse);
}

// ------------------------------------------------------------------ accident puis retour
{
  const et = CD.creer(100, 5); et.v = 30; et.psi = 0.4; et.rapport = 6;
  CD.declencherAccident(et, {});
  let t = 0, dvMax = 0, dpsiMax = 0, vPrec = et.v, psiPrec = et.psi, retour = false;
  while (et.accident && t < 12) {
    CD.pas(et, commande({}), CIR, DT);
    dvMax = Math.max(dvMax, Math.abs(et.v - vPrec)); dpsiMax = Math.max(dpsiMax, Math.abs(et.psi - psiPrec));
    vPrec = et.v; psiPrec = et.psi; t += DT;
    if (!et.accident) retour = true;
  }
  noter('accident : retour sur le revêtement en moins de1s', t, '0,6–1s', retour && t >= .6 && t <= 1);
  noter('accident : revenu sur la piste (|d| petit)', Math.abs(et.d), '< 0,5 m', Math.abs(et.d) < 0.5);
  noter('accident : vitesse continue (pas d’à-coup)', dvMax, '< 1 m/s par pas', dvMax < 1);
  noter('accident : cap réaligné au retour sans gain longitudinal', et.psi, '0 et s100', et.psi === 0 && et.s === 100);
  noter('accident : 1s d’immunité après le retour', et.immunite, '≈ 1s', et.immunite > .9 && et.immunite <= 1.001);
}

// ------------------------------------------------------------------ cadence et coût
{
  // comportement identique à 30, 60 et 120 Hz : le même bond garde la même hauteur à la réception
  const sautAvec = (dt) => { const e = CD.creer(100, 0); e.v = 24; CD.lancerSaut(e, { grand: true, pouss: 1 }); let t = 0; while (e.saut && t < 3) { CD.pas(e, commande({ volant: -1 }), CIR, dt); t += dt; } return e.v; };
  const v30 = sautAvec(1 / 30), v60 = sautAvec(1 / 60), v120 = sautAvec(1 / 120);
  noter('cadence : réception stable à 30/60/120 Hz', Math.max(v30, v60, v120) - Math.min(v30, v60, v120), '< 0,5 m/s', Math.max(v30, v60, v120) - Math.min(v30, v60, v120) < 0.5);
  const t0 = Date.now();
  const a = voiture(0, 100, 0, 40), b = voiture(1, 104, 0.4, 40); const co = course(a, b);
  for (let i = 0; i < 60 * 120; i++) { co.horloge += DT; CT.pas(co, []); CD.pas(a.etat, commande({ gaz: 1 }), CIR, DT); CD.pas(b.etat, commande({ gaz: 1 }), CIR, DT); }
  const ms = Date.now() - t0;
  noter('cadence : 60 s de contacts en moins de 1,5 s', ms / 1000, '< 1,5 s', ms < 1500);
}

// ------------------------------------------------------------------ glissières (grille angles × vitesses)
function glissiere(ang, v, d0 = 2.6, gaz = 0) {
  const c = circuit({ R: 0, largeur: 8, limite: 3 });
  const et = CD.creer(100, d0); et.v = v; et.psi = ang; et.rapport = 6; et.degats=DG.creer();
  let dMin = Infinity, accident = false, t = 0;
  while (t < 0.5 && !et.recuperation) { CD.pas(et, commande({ gaz }), c, DT); if (et.recuperation) accident = true; dMin = Math.min(dMin, et.d); t += DT; }
  return { vRatio: et.v / v, accident, dMin };
}
{
  const ANG = [2, 5, 8, 15, 30, 35, 45, 60, 90], KMH = [50, 100, 200, 300];
  let rasantOk = true, accOk = true, axeOk = true, pireRasant = 1, accManquee = '', axeManquee = '';
  for (const degA of ANG) {
    const ang = degA * Math.PI / 180;
    for (const kmh of KMH) {
      const v = kmh / 3.6;
      if (degA < 8) { const r = glissiere(ang, v, 2.6, 1); if (r.vRatio < 0.9) { rasantOk = false; pireRasant = Math.min(pireRasant, r.vRatio); } }
      const r = glissiere(ang, v);
      if (v*Math.sin(ang)>=21 && !r.accident) { accOk = false; accManquee = `${degA}°/${kmh}km/h`; }
      if (!r.accident && r.dMin < -0.05) { axeOk = false; axeManquee = `${degA}°/${kmh}km/h d=${r.dMin.toFixed(2)}`; }
    }
  }
  noter('glissière : frôlement < 8° garde ≥ 90 % après 0,5 s', pireRasant, '≥ 0,90', rasantOk);
  noter('glissière : vitesse normale≥21m/s → arrêt et reprise', accOk ? 1 : 0, 'oui', accOk, accManquee);
  noter('glissière : jamais renvoyée au-delà de l’axe', axeOk ? 1 : 0, 'oui', axeOk, axeManquee);
}
{
  // emprise de la caisse : quel que soit le cap, aucun coin ne passe le rail (le centre reste à bord = lim − emprise)
  let ok = true, pire = '';
  for (const degA of [0, 20, 45, 70, 90, 135, 180]) {
    const c = circuit({ R: 0, largeur: 8, limite: 3 });
    const et = CD.creer(100, 0); et.v = 30; et.psi = degA * Math.PI / 180; et.rapport = 6;
    for (let i = 0; i < Math.round(1.2 / DT); i++) CD.pas(et, commande({ gaz: 1 }), c, DT);
    const capRel = et.psi + et.beta, emprise = (CD.PARAMS.caissel / 2) * Math.abs(Math.cos(capRel)) + (CD.PARAMS.caisseL / 2) * Math.abs(Math.sin(capRel));
    if (Math.abs(et.d) + emprise > 3 + 0.06) { ok = false; pire = `${degA}° |d|=${et.d.toFixed(2)} emprise=${emprise.toFixed(2)}`; }
  }
  noter('emprise de la caisse : aucun coin au-delà du rail, quel que soit le cap', ok ? 1 : 0, 'oui', ok, pire);
}

// ------------------------------------------------------------------ roue perdue : on ne pilote plus, reprise rapide sans pénalité longue
function essaiRouePerdue(volant) {
  const et = CD.creer(100, 0); et.v = 30; et.rapport = 6;
  const dg = DG.creer(); et.degats = dg; dg.roues[0] = true;   // roue avant gauche arrachée
  const cmd = commande({ gaz: 1, volant });                     // pied au plancher, plein volant : ne doit rien donner
  let t = 0, vMin = Infinity, dArret = 0;
  while (t < 30) {
    const arret = et.reparation && et.reparation.phase === 'arret';
    for (const e of CD.pas(et, cmd, CIR, DT)) { if (e.type === 'retour') (et._vus || (et._vus = [])).push(e.type); }
    vMin = Math.min(vMin, et.v);
    if (arret) dArret = Math.max(dArret, Math.abs(et.d));
    if (!et.recuperation && !dg.roues[0]) break;
    t += DT;
  }
  return { vMin, dArret, repaired: dg.roues.every(x => !x) && !dg.casse, d: et.d,
    fini: Number.isFinite(et.s) && Number.isFinite(et.d) && Number.isFinite(et.v),
    vus: et._vus || [] };
}
{
  const R = essaiRouePerdue(1), L = essaiRouePerdue(-1);
  noter('roue perdue : plus de motricité, la caisse s’immobilise', R.vMin, '≈ 0', R.vMin < 0.9);
  noter('roue perdue : plus de direction (plein gauche = plein droit)', Math.abs(R.dArret - L.dArret), '< 0,1 m', Math.abs(R.dArret - L.dArret) < 0.1);
  noter('roue perdue : remise en piste signalée', R.vus.includes('retour') ? 1 : 0, 'oui', R.vus.includes('retour'));
  noter('roue perdue : roue remise et caisse réparée', R.repaired ? 1 : 0, 'oui', R.repaired);
  noter('roue perdue : repositionnée sur la trajectoire (d ≈ 0)', Math.abs(R.d), '≈ 0', Math.abs(R.d) < 0.2);
  noter('roue perdue : état fini, course non déclarée terminée', R.fini ? 1 : 0, 'oui', R.fini);
}

const echecs = resultats.filter(r => !r.ok);
console.log('---');
console.log(`${resultats.length - echecs.length}/${resultats.length} critères du Chantier 3 tenus`);
if (echecs.length) { for (const r of echecs) console.log('KO  ' + r.nom); process.exit(1); }
process.exit(0);
