#!/usr/bin/env node
// BITUME — banc de conduite (Claude, 18/11/2026).
// Demande de David : « la sensation de conduite doit être la plus fidèle et la plus logique et cohérente niveau
// physique », « réaliste et surtout ultra fun et arcade à la fois ». Avant de régler, il faut chiffrer : ce banc joue
// des manœuvres normalisées sur le vrai modèle (src/conduite.js) et rend un JSON et un tableau lisible.
//
// Ce qu'il mesure : départ arrêté, pointe, aspiration, freinages, frein moteur ; virages établis (vitesse tenue,
// accélération latérale, volant, braquage, dérive de la caisse : gradient de sous-virage) ; échelon de volant ; lever
// de pied, remise des gaz et freinage en appui ; chicane et slalom chronométrés ; dérive chargée (entrée, tenue,
// sortie, turbo) et son gain ; sortie dans l'herbe et retour. Sur le sec et sur le mouillé avec chaque type de pneu,
// et pour quatre chaînes de commande : la voiture seule, la manette, le clavier, la souris ou le doigt.
//
// Ce qu'il ne fait pas : il ne modifie aucun fichier du jeu. Il n'utilise que l'interface publique de B.conduite
// (creer, pas, PARAMS, volantPour, capaciteLaterale, braquageMax, adherencePneus, pneusConseilles) et des pistes
// d'essai au format des tableaux de src/circuit.js : la conduite les lit par les fonctions mêmes de la course. Aucun
// hasard : deux passages donnent les mêmes nombres au bit près, d'où l'empreinte qui compare deux versions du modèle.
//
//   node tools/banc-conduite.mjs                    tableau lisible
//   node tools/banc-conduite.mjs --json r.json      écrit aussi le JSON complet
//   node tools/banc-conduite.mjs --src dossier/src  mesure les sources d'un autre arbre (comparer les empreintes)
//   node tools/banc-conduite.mjs --regler freinMax=0.8,muPiste=1.8   mesure une variante de PARAMS (copie temporaire
//                                                   de conduite.js ; tableaux en JSON : --regler '{"vitessePointe":[…]}')
//   node tools/banc-conduite.mjs --court            sous-ensemble rapide (verifications/banc-conduite.test.mjs)
//   node tools/banc-conduite.mjs --script-page F    écrit dans F le script qui rejoue la partie pure du banc (--court)
//                                                   dans la page construite : node tools/page-essai.mjs dist/bitume.html F > S
//   node tools/banc-conduite.mjs --verifier-page S  compare cette sortie S aux nombres de Node, nombre par nombre
//   node tools/banc-conduite.mjs --rivaux [--json F] profil des rivaux seul : vitesses d'adhérence de R 20 à R 400,
//                                                   ajustement μ_eq, A_eq de la référence de circuit.js (lot 17)
//
// Banc v2 (lot 17, 17-CONDUITE.md § 5, 17A) : le banc complet joue aussi les essais du lot 17 (freinage pédale tenue,
// départ sans aide, échelons à 150 et 250 km/h, plein gaz en appui, deux roues dans l'herbe, vibreur, sillage en
// virage, x_ar en dérive, tenue de 10 s, régime, frein moteur par rapport, eau et neige, profil des rivaux). Leurs
// résultats ont leur propre empreinte (empreinteP10) : celle des essais v1 ne bouge pas avec eux.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(ICI, '..', 'src');
export const VERSION_BANC = 2;   // v2 : essais du lot 17 ajoutés, essais v1 inchangés (même empreinte)
const G = 9.81, DT = 1 / 120, DEG = 180 / Math.PI, KMH = 3.6, RHO = 1.225;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

// ---------------------------------------------------------------- chargement du modèle
// Le module de conduite se charge comme dans les tests : FERRO (équations partagées), la loi de pneu (pneu.js, lot 17 ;
// absente d'un arbre plus ancien), circuit.js (lecture des tableaux de piste), conduite.js. Rechargé à neuf à chaque
// appel, pour mesurer deux arbres dans le même processus.
// `reglages` { nom: valeur } : PARAMS est gelé et des constantes en sont tirées au chargement (poussées, géométrie,
// inertie) ; une variante se mesure donc sur une copie temporaire de conduite.js dont le bloc PARAMS est réécrit.
const FICHIERS = ['ferro/vehicle-dynamics.js', 'pneu.js', 'circuit.js', 'conduite.js'];
export function charger(src = SRC, reglages = null) {
  src = path.resolve(src);
  let dossier = src, tmp = null;
  const presents = FICHIERS.filter(f => f !== 'pneu.js' || existsSync(path.join(src, f)));
  if (reglages && Object.keys(reglages).length) {
    tmp = mkdtempSync(path.join(tmpdir(), 'bitume-banc-'));
    mkdirSync(path.join(tmp, 'ferro'));
    for (const f of presents) if (f !== 'conduite.js') copyFileSync(path.join(src, f), path.join(tmp, f));
    const t = readFileSync(path.join(src, 'conduite.js'), 'utf8'), i = t.indexOf('const PARAMS = Object.freeze({'), j = t.indexOf('});', i);
    if (i < 0 || j < 0) throw new Error('banc-conduite : bloc PARAMS introuvable dans conduite.js');
    let bloc = t.slice(i, j);
    for (const [k, v] of Object.entries(reglages)) {
      const re = Array.isArray(v) ? new RegExp('(\\b' + k + ':\\s*)\\[[^\\]]*\\]') : new RegExp('(\\b' + k + ':\\s*)-?[\\d.]+(?:e-?\\d+)?');
      if (!re.test(bloc) || (!Array.isArray(v) && !Number.isFinite(+v))) throw new Error('banc-conduite : réglage inconnu ou invalide ' + k + '=' + v);
      bloc = bloc.replace(re, '$1' + (Array.isArray(v) ? '[' + v.map(Number).join(', ') + ']' : String(+v)));
    }
    writeFileSync(path.join(tmp, 'conduite.js'), t.slice(0, i) + bloc + t.slice(j));
    dossier = tmp;
  }
  const req = createRequire(path.join(dossier, 'banc-conduite.cjs'));
  const fichiers = presents.map(f => path.join(dossier, f));
  const avant = globalThis.BITUME, avantF = globalThis.FVehicleDynamics;
  let B, h;
  try {
    for (const f of fichiers) delete req.cache[f];
    delete globalThis.BITUME; delete globalThis.FVehicleDynamics;
    for (const f of fichiers) req(f);
    B = globalThis.BITUME;
    h = createHash('sha256');
    for (const f of fichiers) h.update(readFileSync(f));
  } finally {
    if (avant) globalThis.BITUME = avant;
    if (avantF) globalThis.FVehicleDynamics = avantF;
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
  if (!B || !B.conduite || !B.circuit) throw new Error('banc-conduite : modèle introuvable dans ' + src);
  return { B, CD: B.conduite, CI: B.circuit, P: B.conduite.PARAMS, src, reglages: reglages || null, empreinteSources: h.digest('hex'), memo: new Map() };
}

// ---------------------------------------------------------------- pistes d'essai
// Une piste est décrite par son profil de courbure : tronçons { l (m), k (1/m, > 0 à droite) }. Elle est rendue aux
// formats de circuit.js (pas de 2 m), avec ses règles : vibreurs là où le rayon est sous 140 m (±15 m), herbe au-delà,
// glissières à 20 m resserrées à l'intérieur des virages serrés, adoucissement facultatif de la courbure sur ±F pas.
export function piste(ctx, troncons, o = {}) {
  const PAS = ctx.CI.PAS, largeur = o.largeur ?? ctx.CI.LARGEUR;
  const brut = troncons.reduce((a, t) => a + t.l, 0), n = Math.max(16, Math.round(brut / PAS)), L = n * PAS, f = L / brut;
  const bornes = [];
  let a = 0;
  for (const t of troncons) { bornes.push(a); a += t.l; }
  // les longueurs sont étirées de f pour tomber sur un nombre entier de pas : les courbures sont divisées d'autant,
  // si bien qu'un virage garde son angle (un cercle reste fermé)
  const k0 = new Float64Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    const s = i * PAS / f;
    while (j < troncons.length - 1 && s >= bornes[j + 1]) j++;
    k0[i] = troncons[j].k / f;
  }
  const F = o.lissage || 0, courbure = new Float64Array(n);
  if (F) for (let i = 0; i < n; i++) { let m = 0; for (let j = -F; j <= F; j++) m += k0[(i + j + n) % n]; courbure[i] = m / (2 * F + 1); }
  else courbure.set(k0);
  const cap = new Float64Array(n), x = new Float64Array(n), z = new Float64Array(n), y = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    cap[i] = cap[i - 1] + (courbure[i - 1] + courbure[i]) / 2 * PAS;
    const am = (cap[i - 1] + cap[i]) / 2;
    x[i] = x[i - 1] + Math.cos(am) * PAS; z[i] = z[i - 1] + Math.sin(am) * PAS; y[i] = y[i - 1] + (o.pente || 0) * PAS;
  }
  const vibreur = new Uint8Array(n);
  if (o.vibreurs !== false) for (let i = 0; i < n; i++) if (Math.abs(courbure[i]) > 1 / 140) for (let j = -8; j <= 8; j++) vibreur[(i + j + n) % n] = 3;
  const limiteG = new Float32Array(n), limiteD = new Float32Array(n);
  if (o.limite != null) { limiteG.fill(o.limite); limiteD.fill(o.limite); }
  else {
    const FL = Math.round(36 / PAS);
    for (let i = 0; i < n; i++) {
      let g = 20, d = 20;
      for (let j = -FL; j <= FL; j++) { const kk = courbure[(i + j + n) % n]; if (kk > 1e-6) d = Math.min(d, .62 / kk - 2); else if (kk < -1e-6) g = Math.min(g, .62 / -kk - 2); }
      limiteG[i] = Math.max(largeur / 2 + 3.2, g); limiteD[i] = Math.max(largeur / 2 + 3.2, d);
    }
  }
  return {
    graine: 0, nom: o.nom || 'banc', theme: 'banc', longueur: L, pas: PAS, n, x, y, z, cap, courbure,
    pente: new Float64Array(n).fill(o.pente || 0), devers: new Float64Array(n).fill(o.devers || 0), largeur, vibreur,
    ligne: new Float64Array(n), vitesse: new Float64Array(n), limite: o.limite ?? 20, limiteG, limiteD, depart: 0,
    tunnel: null, stands: null, echelle: f, bornes: bornes.map(b => b * f)
  };
}
const LARGE = Object.freeze({ largeur: 400, limite: 500 });   // aire d'essai : la voiture seule, rien à heurter
const droite = (ctx, l, o = {}) => piste(ctx, [{ l, k: 0 }], { vibreurs: false, ...o });
function cercle(ctx, R, o = {}) { const c = piste(ctx, [{ l: 2 * Math.PI * Math.abs(R), k: 1 / R }], o); c.rayon = Math.abs(R) * c.echelle; return c; }

// ---------------------------------------------------------------- conditions et commandes
// Eau sur la piste : 0,75 est l'averse de meteo.js (phase « pluie », celle du réglage Pluie) ; conduite.js la lit
// dans B.meteo.actuel. Les pneus sont ceux de conduite.js (PNEUS).
export const CONDITIONS = Object.freeze({
  sec: Object.freeze({ eau: 0, pneus: 'slicks' }),
  'mouille-slicks': Object.freeze({ eau: .75, pneus: 'slicks' }),
  'mouille-inter': Object.freeze({ eau: .75, pneus: 'inter' }),
  'mouille-pluie': Object.freeze({ eau: .75, pneus: 'pluie' })
});
const TOUTES = Object.keys(CONDITIONS), MOUILLEES = TOUTES.slice(1);
// niveaux d'eau des courbes de pneus, clés dans l'ordre voulu (un objet JavaScript range « 0 » et « 1 » avant « 0.2 »)
const EAUX = ['0', '0.2', '0.47', '0.75', '1'];
// Chaînes de commande du jeu (src/jeu.js, commandesJoueur et lireManette). Les commandes sont lues une fois par image
// (60 Hz) et servent à tous les pas de l'image. Clavier : tout ou rien, guidage 0,15. Manette, souris et doigt :
// volant progressif, sans guidage (le jeu le coupe dès qu'un appareil analogique sert). Aide au volant 0,35 : le
// réglage par défaut (« Légère »). « physique » est la voiture seule : commandes exactes à chaque pas, sans aide.
// Le manche de la manette passe par une zone morte de 0,06 et un exposant de 1,22 ; cette courbe est inversible, le
// pilote donne donc directement la valeur d'après la courbe. Au clavier et aux boutons de la souris, le pilote module
// ses appuis (sigma-delta) et tient chaque appui ou relâche au moins `tenue` secondes : 10 frappes par seconde au plus.
export const ENTREES = Object.freeze({
  physique: Object.freeze({ nom: 'physique', hz: 120, aide: 0, guidage: 0, volant: 'continu', pedales: 'continu', tenue: 0 }),
  manette: Object.freeze({ nom: 'manette', hz: 60, aide: .35, guidage: 0, volant: 'continu', pedales: 'continu', tenue: 0 }),
  clavier: Object.freeze({ nom: 'clavier', hz: 60, aide: .35, guidage: .15, volant: 'touches', pedales: 'touches', tenue: .05 }),
  souris: Object.freeze({ nom: 'souris', hz: 60, aide: .35, guidage: 0, volant: 'continu', pedales: 'touches', tenue: .05 })
});
const QUATRE = Object.keys(ENTREES);
const TAU_MOD = .05;
function modulateur(niveaux, tenue) { return { y: 0, acc: 0, t: Infinity, niveaux, tenue }; }
// Sigma-delta : la touche suit la commande voulue en moyenne (l'erreur cumulée décide du prochain appui).
function moduler(m, u, dt) {
  m.acc = clamp(m.acc + (u - m.y) * dt, -TAU_MOD, TAU_MOD); m.t += dt;
  if (m.t >= m.tenue - 1e-9) {
    const x = u + m.acc / TAU_MOD, y = m.niveaux === 3 ? (x > .5 ? 1 : x < -.5 ? -1 : 0) : (x > .5 ? 1 : 0);
    if (y !== m.y) { m.y = y; m.t = 0; }
  }
  return m.y;
}

function voiture(ctx, cond, s = 0, d = 0) {
  ctx.B.meteo = { actuel: cond.neige != null ? { pluie: cond.eau, mouille: 0, neige: cond.neige } : { pluie: cond.eau, mouille: 0 } };
  const et = ctx.CD.creer(s, d); et.pneus = cond.pneus; return et;
}
// État lancé : rapport que la boîte automatique tiendrait à cette vitesse et régime qui va avec, sans à-coup.
function lancer(ctx, et, v) {
  const P = ctx.P, VP = P.vitessePointe, monte = (P.monteeAuto - P.ralenti) / (P.maxUtile - P.ralenti);
  let r = 1;
  while (r < 6 && v >= monte * VP[r - 1]) r++;
  et.v = v; et.rapport = r; et.regime = clamp(P.ralenti + (P.maxUtile - P.ralenti) * v / VP[r - 1], P.ralenti, P.rupteur);
}

// Une séance : à chaque décision (cadence de l'entrée), le pilote rend son intention { volant, gaz, frein, derive } ;
// l'entrée la traduit en commandes du jeu ; chaque pas de 1/120 s appelle B.conduite.pas comme course.js. `chaque`
// reçoit l'état après le pas, les événements du pas (copiés : le modèle peut réutiliser son tableau) et la commande ;
// il arrête la séance en rendant false.
export function seance(ctx, c, et, entree, pilote, duree, chaque) {
  const E = typeof entree === 'string' ? ENTREES[entree] : entree, CD = ctx.CD;
  const pasN = Math.max(1, Math.round(120 / E.hz)), dtD = pasN * DT, n = Math.round(duree / DT);
  const cmd = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: E.boite || 'auto', aide: E.aide, guidage: E.guidage };
  const mV = modulateur(3, E.tenue), mG = modulateur(2, E.tenue), mF = modulateur(2, E.tenue), evs = [];
  let appuis = 0, i = 0;
  for (; i < n; i++) {
    const t = i * DT;
    if (i % pasN === 0) {
      const u = pilote(et, t), avant = cmd.volant;
      cmd.volant = E.volant === 'touches' ? moduler(mV, clamp(u.volant || 0, -1, 1), dtD) : clamp(u.volant || 0, -1, 1);
      if (E.volant === 'touches' && cmd.volant !== 0 && cmd.volant !== avant) appuis++;   // appuis sur gauche ou droite
      cmd.gaz = E.pedales === 'touches' ? moduler(mG, clamp(u.gaz || 0, 0, 1), dtD) : clamp(u.gaz || 0, 0, 1);
      cmd.frein = E.pedales === 'touches' ? moduler(mF, clamp(u.frein || 0, 0, 1), dtD) : clamp(u.frein || 0, 0, 1);
      cmd.derive = !!u.derive;
    }
    const ev = CD.pas(et, cmd, c, DT);
    evs.length = 0;
    for (let k = 0; k < ev.length; k++) { const e = ev[k]; evs.push({ type: e.type, niveau: e.niveau, duree: e.duree, parfait: e.parfait, force: e.force, rapport: e.rapport }); }
    if (chaque && chaque(et, t + DT, evs, cmd) === false) { i++; break; }
  }
  return { t: i * DT, appuis };
}

// ---------------------------------------------------------------- pilotes scriptés
// Pilote de ligne : la loi de l'IA de course.js (et de verifications/phase2/outils.mjs). La courbure voulue est celle
// de la piste au décalage de la voiture, plus un rappel vers le point visé à 8 + 0,45 v mètres ; le volant est celui que
// la conduite donne elle-même pour cette courbure (B.conduite.volantPour, partagé avec l'IA).
function volantLigne(ctx, c, et, cible = 0) {
  const e = ctx.CI.echantillon(c, et.s), v = Math.max(et.v, 5), la = 8 + .45 * v;
  const psiC = Math.atan2(cible - et.d, la), kOff = e.courbure / Math.max(1 - e.courbure * et.d, .3);
  return clamp(ctx.CD.volantPour(et, kOff + .22 * (psiC - et.psi)), -1, 1);
}
// Régulateur de vitesse : gaz proportionnel et intégral, frein dès 1 m/s de trop.
function regulateur() {
  const r = { i: .35 };
  r.pedales = (et, dt, vc) => {
    const e = vc - et.v;
    if (e < -1) { r.i = Math.max(0, r.i - .2 * dt); return { gaz: 0, frein: clamp(-(e + 1) * .3, 0, 1) }; }
    r.i = clamp(r.i + .4 * e * dt, 0, 1);
    return { gaz: clamp(.8 * e + r.i, 0, 1), frein: 0 };
  };
  return r;
}
const dtDecision = E => Math.max(1, Math.round(120 / E.hz)) * DT;
function piloteLigne(ctx, c, vc, E, cible = 0) {
  const reg = regulateur(), dtD = dtDecision(E);
  return et => { const p = reg.pedales(et, dtD, typeof vc === 'function' ? vc(et) : vc); return { volant: volantLigne(ctx, c, et, cible), gaz: p.gaz, frein: p.frein }; };
}
// Contre-braquage de dérive : la loi de référence des critères (conduite-criteres.test.mjs, S6) ; dn et vn sont le
// décalage et la vitesse latérale comptés vers l'intérieur du virage.
function loiDerive(et) {
  const s = et.derive.sens || 1, dn = s * et.d, vn = s * et.v * Math.sin(et.psi);
  return { volant: s * clamp(-.5 - .35 * dn - .2 * vn, -1, -.2), gaz: clamp(1 + .25 * dn + .25 * vn, 0, 1), frein: 0, derive: true };
}

// ---------------------------------------------------------------- outils de mesure
// Vitesse limite « franche » : balayage montant par pas de 2 % depuis lo, en passant les échecs du tout début (au
// clavier, à 30 km/h, les appuis font osciller la voiture plus qu'à 60), jusqu'au premier échec qui suit un succès,
// puis dichotomie dans ce dernier pas. Une dichotomie partie d'en haut tomberait parfois sur un succès isolé au-delà
// du premier échec : avec des commandes tout ou rien le seuil n'est pas monotone, et le joueur ne le retrouverait pas.
// Rien ne passe au-dessus de lo : on recommence depuis `plancher`.
function limiteFranche(lo, hi, ok, o = {}) {
  const iter = o.iter ?? 10, pas = o.pas ?? 1.02, plancher = o.plancher ?? 8;
  for (const depart of lo > plancher ? [lo, plancher] : [lo]) {
    let a = null;
    for (let v = depart; v <= hi * 1.0001; v = Math.min(v * pas, v < hi ? hi : Infinity)) {
      if (ok(v)) a = v;
      else if (a != null) {
        let b = v;
        for (let j = 0; j < iter; j++) { const m = (a + b) / 2; if (ok(m)) a = m; else b = m; }
        return { v: a };
      }
      if (v >= hi) break;
    }
    if (a != null) return { v: a, borne: 'haut' };
  }
  return { v: null, borne: 'bas' };
}
// vitesse de référence des rivaux dans un virage de rayon R : formule de circuit.js (vitesses), VMAX 86 m/s
const vRefRivaux = R => Math.min(86, Math.sqrt(1.55 * G / Math.max(1 / Math.abs(R) - 1.55 * .00155, 1e-9)));
// premier franchissement d'un seuil, interpolé dans le pas
const franchir = (t, x, xPrec, seuil) => t - DT + DT * (seuil - xPrec) / Math.max(x - xPrec, 1e-12);
const pente = pts => {   // moindres carrés y = a + b x
  const n = pts.length; if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const d = n * sxx - sx * sx; return d ? (n * sxy - sx * sy) / d : null;
};
function capVitesse(ctx, c, et) { return ctx.CI.echantillon(c, et.s).cap + et.psi; }

// ---------------------------------------------------------------- 1. constantes lues dans PARAMS
function constantes(ctx) {
  const { CD, P } = ctx, m = P.masse, V = { '100': 100 / KMH, '200': 200 / KMH, '300': 300 / KMH };
  const par = f => Object.fromEntries(Object.entries(V).map(([k, v]) => [k, f(v)]));
  const W = EAUX.map(Number);
  return {
    masse_kg: m, empattement_m: P.empattement, voie_m: P.voie, hauteurCG_m: P.hauteurCG, repartitionAvant: P.repartition,
    inertieLacet_kgm2: m * P.giration * P.giration,
    // ½ ρ S Cx v² = m · coeffTrainee · v², de même pour l'appui : surfaces équivalentes à ρ = 1,225 kg/m³
    SCx_m2: 2 * m * P.coeffTrainee / RHO, SCz_m2: 2 * m * P.aero / RHO, appuiAvant: P.aeroAvant,
    appuiSurPoids: par(v => P.aero * v * v / G), traineeN: par(v => m * P.coeffTrainee * v * v),
    capaciteLaterale_g: par(v => CD.capaciteLaterale(v) / G),
    braquageMax_deg: Object.fromEntries([50, 100, 200, 300].map(k => [String(k), CD.braquageMax(k / KMH) * DEG])),
    vitessesPointe_kmh: P.vitessePointe.map(v => v * KMH),
    mu: { piste: P.muPiste, vibreur: P.muVibreur, herbe: P.muHerbe, arriereSurAvant: P.gripArriere },
    adherencePneus: Object.fromEntries(Object.keys(CD.PNEUS).map(p => [p, Object.fromEntries(W.map(w => [String(w), CD.adherencePneus(p, w)]))])),
    pneusConseilles: Object.fromEntries(W.map(w => [String(w), CD.pneusConseilles(w)]))
  };
}

// ---------------------------------------------------------------- 2. ligne droite
function depart(ctx, cond, o = {}) {
  const { CD, P } = ctx, c = droite(ctx, 12000, LARGE), et = voiture(ctx, cond), E = ENTREES[o.entree || 'physique'];
  const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0, guidage: 0 };
  // grille et feux : 2 s plein gaz voiture retenue, le régime monte comme au départ d'une course
  if (o.lancement !== false) for (let i = 0; i < 240; i++) CD.pas(et, cmd, c, DT, true);
  const seuils = [50, 100, 150, 200, 250, 300], t = {}, rapports = [], acc = [0, 0, 0, 0, 0, 0], puis = [0, 0, 0, 0, 0, 0], serie = [];
  let vP = et.v, dP = 0, d400 = null, d1000 = null, patinage = 0, regimeMin = Infinity;
  seance(ctx, c, et, E, () => ({ volant: 0, gaz: 1, frein: 0 }), o.duree || 60, (e, tt, evs) => {
    if (o.aspiration) e.aspiration = o.aspiration;      // course.js la recalcule à chaque pas ; ici, sillage tenu
    for (const x of evs) if (x.type === 'rapport') rapports.push({ t: tt, kmh: e.v * KMH, rapport: x.rapport });
    for (const s of seuils) if (t[s] == null && e.v * KMH >= s) t[s] = franchir(tt, e.v * KMH, vP * KMH, s);
    if (!d400 && e.distance >= 400) d400 = { t: franchir(tt, e.distance, dP, 400), kmh: e.v * KMH };
    if (!d1000 && e.distance >= 1000) d1000 = { t: franchir(tt, e.distance, dP, 1000), kmh: e.v * KMH };
    const r = e.rapport - 1;
    acc[r] = Math.max(acc[r], e.along / G); puis[r] = Math.max(puis[r], P.masse * e.along * e.v / 1000);
    patinage = Math.max(patinage, e.patinage); if (tt <= .5) regimeMin = Math.min(regimeMin, e.regime);
    serie.push(e.v); vP = e.v; dP = e.distance;
  });
  const vmax = Math.max(...serie), i99 = serie.findIndex(v => v >= .99 * vmax);
  const pMax = Math.max(...puis);
  return {
    t_kmh: t, m400: d400, m1000: d1000, pointe_kmh: vmax * KMH, t99pointe_s: (i99 + 1) * DT, rapports,
    accelerationMax_g: acc, puissanceRoue_kW: puis, puissanceRoueMax_kW: pMax, puissanceRoueMax_ch: pMax / .7355,
    patinageMax: patinage, regimeMin05s: regimeMin
  };
}
function reprise(ctx, cond, v0kmh, v1kmh, aspiration) {
  const c = droite(ctx, 12000, LARGE), et = voiture(ctx, cond); lancer(ctx, et, v0kmh / KMH);
  let tt1 = null, vP = et.v;
  seance(ctx, c, et, ENTREES.physique, () => ({ volant: 0, gaz: 1, frein: 0 }), 40, (e, t) => {
    e.aspiration = aspiration;
    if (e.v * KMH >= v1kmh) { tt1 = franchir(t, e.v * KMH, vP * KMH, v1kmh); return false; }
    vP = e.v;
  });
  return tt1;
}
function freinage(ctx, cond, v0kmh, v1kmh, f = 1) {
  const c = droite(ctx, 6000, LARGE), et = voiture(ctx, cond), v0 = v0kmh / KMH, v1 = Math.max(v1kmh / KMH, .1);
  lancer(ctx, et, v0);
  seance(ctx, c, et, ENTREES.physique, piloteLigne(ctx, c, v0, ENTREES.physique), 1.5);   // charges et régime posés
  const vDepart = et.v, d0 = et.distance;
  let vP = et.v, dP = 0, tP = 0, decMax = 0, chargeAv = 0, blocage = 0, fin = null;
  seance(ctx, c, et, ENTREES.physique, () => ({ volant: 0, gaz: 0, frein: f }), 30, (e, t) => {
    const dec = (vP - e.v) / DT, d = e.distance - d0;
    if (dec > decMax) { decMax = dec; chargeAv = e.chargeAv; }
    blocage = Math.max(blocage, e.blocage);
    if (e.v <= v1) { const u = (vP - v1) / Math.max(vP - e.v, 1e-12); fin = { t: tP + u * DT, d: dP + u * (d - dP) }; return false; }
    vP = e.v; dP = d; tP = t;
  });
  // distance ramenée à la vitesse de départ exacte (le régulateur la tient à quelques cm/s près)
  const corr = (v0 * v0 - v1 * v1) / Math.max(vDepart * vDepart - v1 * v1, 1e-9);
  // (jusqu'à l'arrêt, le seuil est 0,1 m/s : sous 0,05 m/s les freins ne serrent plus, conduite.js)
  const d = fin ? fin.d * corr : null;
  return {
    distance_m: d, temps_s: fin ? fin.t : null, decelMax_g: decMax / G,
    decelMoyenne_g: d ? (v0 * v0 - v1 * v1) / (2 * d) / G : null, chargeAvantAuPic: chargeAv, blocageMax: blocage
  };
}
function freinMoteur(ctx, cond) {
  const c = droite(ctx, 12000, LARGE), et = voiture(ctx, cond); lancer(ctx, et, 300 / KMH);
  seance(ctx, c, et, ENTREES.physique, piloteLigne(ctx, c, 300 / KMH, ENTREES.physique), 1.5);
  const seuils = [290, 250, 200, 150, 100], dec = {}, d0 = et.distance;
  let vP = et.v, d200 = null;
  seance(ctx, c, et, ENTREES.physique, () => ({ volant: 0, gaz: 0, frein: 0 }), 40, (e) => {
    for (const s of seuils) if (dec[s] == null && e.v * KMH <= s) dec[s] = (vP - e.v) / DT / G;
    if (d200 == null && e.v * KMH <= 200) d200 = e.distance - d0;
    vP = e.v; if (e.v * KMH < 95) return false;
  });
  return { decel_g: dec, distance300a200_m: d200 };
}

// ---------------------------------------------------------------- 3. virages établis
// Tenue d'un rayon à vitesse donnée : le pilote de ligne tient l'axe et la vitesse. « tenu » : sur la fenêtre de fin,
// l'axe à moins de dTol, la vitesse à moins de vTol, la caisse à moins de 0,15 rad, jamais de tête-à-queue.
// `compense` : une pente descendante rend à la voiture sa traînée d'air et son roulement à cette vitesse. Dans
// conduite.js, la pente n'agit que le long de la piste (aucun report de charge) : l'essai sépare ainsi la limite
// d'adhérence de la limite de puissance, qui se confondent sinon dans les grands virages.
function tenir(ctx, cond, R, v, o = {}) {
  const E = typeof o.entree === 'object' ? o.entree : ENTREES[o.entree || 'physique'], P = ctx.P;
  let c = o.c;
  if (!c) {
    const po = { ...(o.piste || LARGE) };
    if (o.compense) { const a = (P.coeffTrainee * v * v + P.roulement) * (o.degats ? o.degats.trainee : 1); po.pente = -a / Math.sqrt(G * G - a * a); }
    c = cercle(ctx, R, po);
  }
  const et = voiture(ctx, cond);
  lancer(ctx, et, v); et.omega = v / c.rayon * Math.sign(R);
  if (o.aspiration != null) et.aspiration = o.aspiration;
  if (o.degats) et.degats = { adher: o.degats.adher, trainee: o.degats.trainee, roues: [false, false, false, false], casse: false };
  const duree = o.duree || 8, fen = o.fenetre || 2, sg = Math.sign(R);
  let dMax = 0, dvMax = 0, tq = false, n = 0, volCmd = 0;
  const m = { braquage: 0, beta: 0, volant: 0, aAv: 0, aAr: 0, ay: 0, gaz: 0, omega: 0, rapport: 0 };
  const r = seance(ctx, c, et, E, piloteLigne(ctx, c, v, E), duree, (e, t, evs, cmd) => {
    if (o.aspiration != null) e.aspiration = o.aspiration;   // course.js la recalcule à chaque pas ; ici, sillage tenu
    tq ||= Math.abs(e.beta) > Math.PI / 2;
    volCmd = cmd.volant;
    if (t > duree - fen) {
      dMax = Math.max(dMax, Math.abs(e.d)); dvMax = Math.max(dvMax, Math.abs(e.v - v)); n++;
      m.braquage += sg * e.braquage; m.beta += sg * e.beta; m.volant += sg * e.volant; m.aAv += sg * e.deriveAv; m.aAr += sg * e.deriveAr;
      m.ay += sg * e.alat; m.gaz += cmd.gaz; m.omega += sg * e.omega; m.rapport += e.rapport;
    }
    if (tq) return false;
  });
  for (const k in m) m[k] /= Math.max(n, 1);
  const tenu = !tq && n > 0 && dMax < (o.dTol ?? 1) && dvMax < (o.vTol ?? 1) && Math.abs(et.beta) < .15;
  return { tenu, dMax, dvMax, tq, et, c, volCmd, appuisParS: r.appuis / duree, ...m };
}
function vLimite(ctx, cond, R, o = {}) {
  return limiteFranche(Math.max(8, .6 * vRefRivaux(R)), 95, v => tenir(ctx, cond, R, v, o).tenu, { iter: o.iter }).v;
}
// Vitesse limite sur vraie piste (12 m, vibreurs, herbe, glissières) pour une chaîne de commande : l'écart à l'axe
// reste sous 2 m sur les 4 dernières des 10 s. Mémorisée : elle sert aussi d'allure d'approche des dérives et des
// remises des gaz, chaque chaîne abordant le virage à sa propre limite, comme un joueur.
export const REELLE = Object.freeze({ piste: Object.freeze({}), dTol: 2, vTol: 1.5, duree: 10, fenetre: 4 });
function vPiste(ctx, cond, R, entree) {
  const E = typeof entree === 'object' ? entree : ENTREES[entree], cle = [cond.eau, cond.pneus, R, E.nom, E.tenue].join('|');
  if (!ctx.memo.has(cle)) ctx.memo.set(cle, vLimite(ctx, cond, R, { ...REELLE, entree: E }));
  return ctx.memo.get(cle);
}
function virageEtabli(ctx, cond, R, o = {}) {
  const vl = vLimite(ctx, cond, R, o);
  if (vl == null) return { R, vLimite_kmh: null };
  const vA = vLimite(ctx, cond, R, { ...o, compense: true });
  const c = cercle(ctx, R, LARGE), L = ctx.P.empattement, ack = L / c.rayon * DEG, points = [];
  for (const f of o.fractions || [.2, .4, .6, .8, .9, 1]) {
    const v = Math.max(6, vl * Math.sqrt(f)), r = tenir(ctx, cond, R, v, { c });
    points.push({
      f, kmh: v * KMH, ay_g: v * v / c.rayon / G, volant: r.volant, braquage_deg: r.braquage * DEG, beta_deg: r.beta * DEG,
      deriveAv_deg: r.aAv * DEG, deriveAr_deg: r.aAr * DEG, gaz: r.gaz, rapport: r.rapport, tenu: r.tenu
    });
  }
  const lin = points.filter(p => p.f <= .8), haut = points.filter(p => p.f >= .8);
  const lim = points[points.length - 1];
  const tA = vA != null ? tenir(ctx, cond, R, vA, { compense: true }) : null;
  const vRef = vRefRivaux(c.rayon);
  return {
    R: c.rayon, vLimite_kmh: vl * KMH, ayLimite_g: lim.ay_g, gazLimite: lim.gaz, volantLimite: lim.volant, braquageLimite_deg: lim.braquage_deg,
    betaLimite_deg: lim.beta_deg, deriveAvLimite_deg: lim.deriveAv_deg, deriveArLimite_deg: lim.deriveAr_deg, rapportLimite: lim.rapport,
    // limite d'adhérence, traînée compensée par la pente : au-dessus de la vitesse tenue, la voiture manque de puissance
    vAdherence_kmh: vA != null ? vA * KMH : null, ayAdherence_g: vA != null ? vA * vA / c.rayon / G : null,
    // au régime maxi de la 6e, le moteur coupe : la limite d'adhérence est alors au-delà de ce qui est mesuré
    adherenceBornee: vA != null && vA >= ctx.P.vitessePointe[5] - .5 ? 'régime maxi en 6e' : null,
    volantAdherence: tA ? tA.volant : null, betaAdherence_deg: tA ? tA.beta * DEG : null, capaciteNominale_g: vA != null ? ctx.CD.capaciteLaterale(vA) / G : null,
    braquageCinematique_deg: ack,
    // gradient de sous-virage K = dδ/da_y (deg/g) : positif, la voiture sous-vire ; la pente de la dérive de la caisse
    sousVirage_deg_par_g: pente(lin.map(p => [p.ay_g, p.braquage_deg])), sousVirageProcheLimite_deg_par_g: pente(haut.map(p => [p.ay_g, p.braquage_deg])),
    deriveCaisse_deg_par_g: pente(lin.map(p => [p.ay_g, p.beta_deg])), volant_par_g: pente(lin.map(p => [p.ay_g, p.volant])),
    vRefRivaux_kmh: vRef * KMH, vRefSurVLimite: vRef / vl, points
  };
}

// ---------------------------------------------------------------- 4. échelon de volant
function echelon(ctx, cond, vkmh, entree, mode) {
  // gaz figé à sa valeur de croisière pour toutes les entrées : seul le volant diffère d'une chaîne à l'autre
  const E = { ...(typeof entree === 'object' ? entree : ENTREES[entree]), pedales: 'continu' }, c = droite(ctx, 30000, { largeur: 6000, limite: 6100 });
  const et = voiture(ctx, cond), v = vkmh / KMH;
  lancer(ctx, et, v);
  const reg = regulateur(); let gaz0 = .35;
  seance(ctx, c, et, ENTREES.physique, e => { const p = reg.pedales(e, DT, v); gaz0 = p.gaz; return { volant: 0, gaz: p.gaz, frein: p.frein }; }, 2);
  const A = mode === 'plein' ? 1 : clamp(ctx.CD.volantPour(et, .5 * ctx.CD.capaciteLaterale(v) / (v * v)), 0, 1);
  const S = [];
  let tq = false;
  seance(ctx, c, et, E, () => ({ volant: A, gaz: gaz0, frein: 0 }), 4, (e, t) => {
    S.push({ t, r: e.omega, ay: e.alat, beta: e.beta, volant: e.volant, braquage: e.braquage, v: e.v });
    if (Math.abs(e.beta) > Math.PI / 2) { tq = true; return false; }
  });
  const res = { amplitude: A, teteAQueue: tq };
  if (tq) return res;
  // gaz figé, la voiture ralentit dans le virage et son lacet dérive lentement : le régime établi est pris entre 1 et
  // 1,5 s, le pic cherché avant 1 s, le temps d'établissement à ±5 % compté jusqu'à 1,5 s
  const fen = S.filter(p => p.t > 1 && p.t <= 1.5), moy = k => fen.reduce((a, p) => a + p[k], 0) / fen.length;
  const rss = moy('r'), ayss = moy('ay'), sg = Math.sign(rss) || 1;
  const monte = (k, ss) => { const i = S.findIndex(p => p[k] * Math.sign(ss) >= .9 * Math.abs(ss)); return i < 0 ? null : (i ? franchir(S[i].t, S[i][k] * Math.sign(ss), S[i - 1][k] * Math.sign(ss), .9 * Math.abs(ss)) : S[0].t); };
  let pic = 0, tPic = 0;
  for (const p of S) if (p.t <= 1 && p.r * sg > pic) { pic = p.r * sg; tPic = p.t; }
  const dep = Math.max(0, (pic - Math.abs(rss)) / Math.abs(rss));
  let t5 = 0;
  for (const p of S) if (p.t <= 1.5 && Math.abs(p.r - rss) > .05 * Math.abs(rss)) t5 = p.t;
  const l = Math.log(Math.max(dep, 1e-9)), a15 = S.find(p => p.t >= 1.5 - 1e-9);
  return {
    ...res, volantT90_ms: (monte('volant', A) ?? 0) * 1000, lacetT90_ms: (monte('r', rss) ?? 0) * 1000, lacetPic_ms: tPic * 1000,
    depassement_pct: dep * 100, amortissement: dep > .005 ? -l / Math.sqrt(Math.PI * Math.PI + l * l) : null, etabli5pc_ms: t5 * 1000,
    ayT90_ms: (monte('ay', ayss) ?? 0) * 1000, lacet_degs: rss * DEG, ay_g: ayss / G, beta_deg: moy('beta') * DEG,
    braquage_deg: moy('braquage') * DEG, gainLacet_degs_par_volant: rss * DEG / A, TB_sdeg: tPic * Math.abs(moy('beta') * DEG),
    perteVitesse15s_kmh: (v - a15.v) * KMH, lacetA4s_sur_etabli: S[S.length - 1].r / rss
  };
}

// ---------------------------------------------------------------- 5. lever de pied, remise des gaz, freinage en appui
// Boucle ouverte : après 8 s de tenue au pilote de ligne, le volant est figé à sa dernière commande et seules les
// pédales changent. On lit le lacet, la courbure de la trajectoire (cap de la vitesse dérivé sur la distance), la
// dérive de la caisse et l'écart pris vers l'intérieur (> 0 : la voiture referme).
function boucleOuverte(ctx, cond, R, v0, pedales, aide, duree = 1.5) {
  const t0 = tenir(ctx, cond, R, v0), { et, c } = t0, E = { ...ENTREES.physique, aide };
  const w0 = et.omega, b0 = et.beta, d0 = et.d, k0 = 1 / (c.rayon - et.d);
  let thP = capVitesse(ctx, c, et), w05 = null, k05 = null, dB = 0, d1 = null, tq = false, v1 = null;
  const ks = [];
  seance(ctx, c, et, E, () => ({ volant: t0.volCmd, ...pedales }), duree, (e, t) => {
    const th = capVitesse(ctx, c, e), dth = th - thP; thP = th;
    ks.push(dth - 2 * Math.PI * Math.round(dth / (2 * Math.PI)));
    if (ks.length > 6) ks.shift();
    if (w05 == null && t >= .5 - 1e-9) { w05 = e.omega; k05 = ks.reduce((a, x) => a + x, 0) / (ks.length * Math.max(e.v, 1) * DT); }
    dB = Math.max(dB, e.beta - b0);
    if (d1 == null && t >= 1 - 1e-9) { d1 = e.d - d0; v1 = e.v; }
    if (Math.abs(e.beta) > Math.PI / 2) { tq = true; return false; }
  });
  return {
    tenueInitiale: t0.tenu, lacet05_sur_lacet0: w05 != null ? w05 / w0 : null, courbure05_sur_courbure0: k05 != null ? k05 / k0 : null,
    hausseBeta_deg: dB * DEG, ecartInterieur1s_m: d1, decel1s_g: v1 != null ? (v0 - v1) / G : null, teteAQueue: tq
  };
}
// Boucle fermée : le pilote de chaque entrée tient la ligne pendant l'action ; on lit ce qu'il a dû concéder.
function boucleFermee(ctx, cond, R, v0, entree, pedalesDe, duree = 1.5, piste = LARGE) {
  const E = ENTREES[entree], t0 = tenir(ctx, cond, R, v0, { entree, piste, dTol: 2, vTol: 1.5 }), { et, c } = t0;
  let dMax = 0, bMax = 0, tq = false, herbe = 0;
  const b0 = et.beta;
  seance(ctx, c, et, E, (e, t) => ({ volant: volantLigne(ctx, c, e), ...pedalesDe(t) }), duree, (e) => {
    dMax = Math.max(dMax, Math.abs(e.d)); bMax = Math.max(bMax, Math.abs(e.beta - b0)); if (e.surface === 'herbe') herbe += DT;
    if (Math.abs(e.beta) > Math.PI / 2) { tq = true; return false; }
  });
  return { tenueInitiale: t0.tenu, ecartMax_m: dMax, hausseBetaMax_deg: bMax * DEG, herbe_s: herbe, teteAQueue: tq };
}
// Remise des gaz en sortie de virage serré : un tour d'arc pour se poser à 92 % de la limite de la chaîne sur cette
// piste (vl), puis les gaz ; vraie piste (12 m, vibreurs, herbe, glissières), chrono jusqu'à 100 m après la sortie.
// Variantes : « 45 » plein gaz 45° avant la sortie (la manette presse la gâchette en 0,25 s, le clavier enfonce la
// touche) ; « 15 » de même 15° avant la sortie ; « progressif » 45° avant, les gaz montent en 1 s (au clavier, par
// appuis modulés).
function remiseGaz(ctx, cond, R, entree, vl, variante = '45') {
  const E = ENTREES[entree], c = piste(ctx, [{ l: R * (2 * Math.PI + Math.PI / 2), k: 1 / R }, { l: 600, k: 0 }], { lissage: 8 });
  const angle = (variante === '15' ? 15 : 45) / DEG, et = voiture(ctx, cond), v0 = .92 * vl;
  const sGaz = c.bornes[1] - R * c.echelle * angle, sMesure = c.bornes[1] + 100;
  lancer(ctx, et, v0); et.omega = v0 / (R * c.echelle);
  const reg = regulateur(), dtD = dtDecision(E);
  let tGaz = null, g0 = 0, tFin = null, vFin = null, bMax = 0, arMax = 0, dMax = 0, vib = 0, herbe = 0, tq = false, chocs = 0;
  seance(ctx, c, et, E, (e, t) => {
    if (tGaz == null && e.s >= sGaz) tGaz = t;
    if (tGaz == null) { const p = reg.pedales(e, dtD, v0); g0 = p.gaz; return { volant: volantLigne(ctx, c, e), gaz: p.gaz, frein: p.frein }; }
    const x = t - tGaz, gaz = variante === 'progressif' ? Math.min(1, g0 + (1 - g0) * x) : entree === 'manette' ? Math.min(1, g0 + (1 - g0) * x / .25) : 1;
    return { volant: volantLigne(ctx, c, e), gaz, frein: 0 };
  }, 40, (e, t, evs) => {
    if (tGaz == null) return;
    for (const x of evs) if (x.type === 'choc') chocs++;
    bMax = Math.max(bMax, e.beta); arMax = Math.max(arMax, e.deriveAr); dMax = Math.max(dMax, Math.abs(e.d));
    if (e.surface === 'vibreur') vib += DT; else if (e.surface === 'herbe') herbe += DT;
    if (Math.abs(e.beta) > Math.PI / 2) { tq = true; return false; }
    if (e.s >= sMesure) { tFin = t - tGaz; vFin = e.v; return false; }
  });
  return { vApproche_kmh: v0 * KMH, temps_s: tFin, sortie_kmh: vFin != null ? vFin * KMH : null, betaMax_deg: bMax * DEG, deriveArMax_deg: arMax * DEG, ecartMax_m: dMax, vibreur_s: vib, herbe_s: herbe, chocs, teteAQueue: tq };
}

// ---------------------------------------------------------------- 6. chicane et slalom chronométrés
// Chicane : 400 m de droite, un S de rayon 50 m (45° à droite, 90° à gauche, 45° à droite), 400 m de droite ; vraie
// piste adoucie comme circuit.js. Le pilote arrive à 250 km/h, freine sur une courbe calée sur ses freins (90 % de la
// décélération moyenne mesurée de 200 à 0 km/h dans la même condition), passe le S à vitesse constante, puis plein gaz.
// On cherche la plus grande vitesse de passage sans herbe, sans glissière ni tête-à-queue ; chrono de 100 m avant le
// freinage à 200 m après le S.
function chicane(ctx, cond, entree, decel) {
  const R = 50, c = piste(ctx, [{ l: 400, k: 0 }, { l: R * Math.PI / 4, k: 1 / R }, { l: R * Math.PI / 2, k: -1 / R }, { l: R * Math.PI / 4, k: 1 / R }, { l: 600, k: 0 }], { lissage: 8 });
  const sIn = c.bornes[1] - 16, sOut = c.bornes[4] + 16, s0 = 100, s1 = c.bornes[4] + 200, aB = .9 * decel;
  const essai = vIn => {
    const E = ENTREES[entree], et = voiture(ctx, cond), v0 = 250 / KMH, reg = regulateur(), dtD = dtDecision(E);
    lancer(ctx, et, v0);
    const vise = s => s < sIn ? Math.min(v0, Math.sqrt(vIn * vIn + 2 * aB * (sIn - s))) : s <= sOut ? vIn : 95;
    let ok = true, t0 = null, t1 = null, vMin = Infinity, bMax = 0, dMax = 0, ayMax = 0, raison = null;
    seance(ctx, c, et, E, e => {
      const vt = vise(e.s), volant = volantLigne(ctx, c, e);
      if (e.v > vt + .5) return { volant, gaz: 0, frein: clamp(.5 + .25 * (e.v - vt), 0, 1) };
      const p = reg.pedales(e, dtD, vt); return { volant, gaz: p.gaz, frein: p.frein };
    }, 20 + s1 / vIn, (e, t, evs) => {
      if (t0 == null && e.s >= s0) t0 = t;
      for (const x of evs) if (x.type === 'choc') raison = 'glissière';
      if (e.surface === 'herbe') raison = 'herbe';
      if (Math.abs(e.beta) > Math.PI / 2) raison = 'tête-à-queue';
      if (e.s >= sIn && e.s <= sOut) { vMin = Math.min(vMin, e.v); bMax = Math.max(bMax, Math.abs(e.beta)); dMax = Math.max(dMax, Math.abs(e.d)); ayMax = Math.max(ayMax, Math.abs(e.alat)); }
      if (raison) { ok = false; return false; }
      if (e.s >= s1) { t1 = t; return false; }
    });
    return { ok: ok && t1 != null, temps_s: t1 != null && t0 != null ? t1 - t0 : null, vMin_kmh: vMin * KMH, betaMax_deg: bMax * DEG, ecartMax_m: dMax, ayMax_g: ayMax / G, raison };
  };
  const b = limiteFranche(15, 75, v => essai(v).ok);
  if (b.v == null) return { vPassage_kmh: null };
  const juste = essai(b.v), echec = essai(Math.min(75, b.v + .05));
  return { vPassage_kmh: b.v * KMH, ...juste, raison: undefined, echecAuDela: echec.ok ? 'passe aussi (seuil non monotone)' : echec.raison };
}
// Slalom : neuf arcs alternés de rayon 40 m (portes tous les 20 m), à vitesse constante ; la voiture doit rester à
// moins d'un mètre du tracé. On cherche la plus grande vitesse tenue.
function slalom(ctx, cond, entree) {
  const R = 40, th = .5, arcs = [{ l: 150, k: 0 }, { l: R * th / 2, k: 1 / R }];
  for (let i = 0; i < 7; i++) arcs.push({ l: R * th, k: (i % 2 ? 1 : -1) / R });
  arcs.push({ l: R * th / 2, k: 1 / R }, { l: 400, k: 0 });
  const c = piste(ctx, arcs, { lissage: 2 }), sA = c.bornes[1] - 5, sB = c.bornes[10] + 5;
  const essai = v => {
    const E = ENTREES[entree], et = voiture(ctx, cond); lancer(ctx, et, v);
    let ok = true, tA = null, tB = null, ayMax = 0, bMax = 0, dMax = 0, appuis = 0;
    const r = seance(ctx, c, et, E, piloteLigne(ctx, c, v, E), 10 + sB / v, (e, t) => {
      if (Math.abs(e.beta) > Math.PI / 2) ok = false;
      if (e.s >= sA && tA == null) tA = t;
      if (tA != null && tB == null) { dMax = Math.max(dMax, Math.abs(e.d)); ayMax = Math.max(ayMax, Math.abs(e.alat)); bMax = Math.max(bMax, Math.abs(e.beta)); if (Math.abs(e.d) > 1) ok = false; }
      if (!ok) return false;
      if (e.s >= sB) { tB = t; return false; }
    });
    appuis = r.appuis;
    return { ok: ok && tB != null, temps_s: tB != null ? tB - tA : null, ayMax_g: ayMax / G, betaMax_deg: bMax * DEG, ecartMax_m: dMax, appuis };
  };
  const b = limiteFranche(12, 80, v => essai(v).ok);
  return b.v == null ? { v_kmh: null } : { v_kmh: b.v * KMH, ...essai(b.v) };
}

// ---------------------------------------------------------------- 7. dérive chargée
// Sur un cercle de vraie piste : 6 s d'approche au pilote de ligne (à vEntree), puis appui sur la dérive, volant plein
// vers l'intérieur et plein gaz jusqu'au départ (0,5 s au plus), 0,12 s de tirage à 0,7, puis la loi de
// contre-braquage. Lâcher 0,1 s après le palier III (dans sa fenêtre : lâcher parfait), ou au bout de `tenueMax`.
// Le cercle continue après le lâcher : le pilote de ligne reprend, pied levé (sans frein, qui couperait le turbo) ;
// la sortie vers une ligne droite, plein gaz et turbo, se mesure dans gainDerive. `jusquAuBout` : la dérive est tenue
// jusqu'à `tenueMax` (durée tenable : jusqu'où la loi de contre-braquage la garde sans annulation).
function derive(ctx, cond, R, entree, vEntree, o = {}) {
  const E = ENTREES[entree], c = cercle(ctx, R, {}), et = voiture(ctx, cond), reg = regulateur(), dtD = dtDecision(E);
  lancer(ctx, et, vEntree); et.omega = vEntree / c.rayon;
  if (o.xar) et._mesure = {};
  const xs = [], vit = [];
  const tenueMax = o.tenueMax ?? 4, approche = 6;
  let phase = 'approche', tAppui = -1, tDepart = -1, tLacher = -1, tN3 = -1, prec = null;
  const r = { niveaux: [null, null, null], chargeMax: 0, qualiteMoy: 0, betaMoy_deg: 0, betaMax_deg: 0, ecartMax_m: 0, vibreur_s: 0, herbe_s: 0, turbo: null, annulee: false, teteAQueue: null };
  let nq = 0, b03 = null, vLacher = null, stable = null, horsStable = 0, depasse = 0, dApres = 0, herbeApres = 0;
  seance(ctx, c, et, E, (e, t) => {
    if (phase === 'approche') {
      if (t < approche) { const p = reg.pedales(e, dtD, vEntree); return { volant: volantLigne(ctx, c, e), gaz: p.gaz, frein: p.frein }; }
      phase = 'appui'; tAppui = t;
    }
    if (phase === 'appui') { if (t - tAppui > .5) phase = 'refus'; else return { volant: 1, gaz: 1, frein: 0, derive: true }; }
    if (phase === 'tenue') {
      if ((tN3 >= 0 && t >= tN3 + .1 && !o.jusquAuBout) || t - tDepart >= tenueMax) { phase = 'lacher'; tLacher = t; vLacher = e.v; }
      else return t - tDepart < .12 ? { volant: .7, gaz: 1, frein: 0, derive: true } : loiDerive(e);
    }
    return { volant: volantLigne(ctx, c, e), gaz: 0, frein: 0, derive: false };
  }, approche + 1 + tenueMax + 3, (e, t, evs) => {
    for (const x of evs) {
      if (x.type === 'derive' && phase === 'appui') { phase = 'tenue'; tDepart = t; r.depart_s = t - tAppui; }
      if (x.type === 'niveau' && tDepart >= 0) { r.niveaux[x.niveau - 1] = t - tDepart; if (x.niveau === 3) tN3 = t; }
      if (x.type === 'deriveAnnulee' && phase === 'tenue') {
        phase = 'annulee'; r.annulee = true; tLacher = t; vLacher = e.v;
        r.annulation = prec ? { apres_s: t - tDepart, surface: prec.surface, ecart_m: prec.d, beta_deg: prec.beta * DEG, perte: prec.perte, qualite: prec.qualite, kmh: prec.v * KMH } : null;
      }
      if (x.type === 'turbo') r.turbo = { niveau: x.niveau, duree_s: x.duree, parfait: x.parfait };
    }
    if (phase === 'tenue') {
      const dt = t - tDepart, dr = e.derive;
      if (o.xar && e._mesure.xAr != null) xs.push(Math.abs(e._mesure.xAr));
      if (o.vitesses) vit.push([dt, e.v]);
      if (dt <= .3 + 1e-9) b03 = e.beta;
      r.chargeMax = Math.max(r.chargeMax, dr.charge); r.qualiteMoy += dr.qualite; r.betaMoy_deg += e.beta * DEG; nq++;
      r.betaMax_deg = Math.max(r.betaMax_deg, Math.abs(e.beta) * DEG); r.ecartMax_m = Math.max(r.ecartMax_m, Math.abs(e.d));
      if (e.surface === 'vibreur') r.vibreur_s += DT; else if (e.surface === 'herbe') r.herbe_s += DT;
      prec = { surface: e.surface, d: e.d, beta: e.beta, perte: dr.perte, qualite: dr.qualite, v: e.v };
    }
    if (tLacher >= 0 && t > tLacher) {
      const dt = t - tLacher;
      dApres = Math.max(dApres, Math.abs(e.d)); depasse = Math.max(depasse, -e.beta); if (e.surface === 'herbe') herbeApres += DT;
      if (Math.abs(e.beta) < 2 / DEG) { horsStable += DT; if (stable == null && horsStable >= .5) stable = dt - .5; } else horsStable = 0;
    }
    if (Math.abs(e.beta) > Math.PI / 2) { r.teteAQueue = phase === 'tenue' ? 'pendant' : phase === 'appui' ? 'au départ' : 'après'; return false; }
  });
  if (phase === 'appui' || phase === 'refus' || tDepart < 0) return { vEntree_kmh: vEntree * KMH, departRefuse: true };
  r.qualiteMoy /= Math.max(nq, 1); r.betaMoy_deg /= Math.max(nq, 1);
  const extra = {};
  if (o.xar) extra.xAr = quantiles(xs);
  if (o.vitesses) extra.vitesse_kmh = vit.filter(([dt]) => Math.abs(dt - Math.round(dt)) < DT / 2 && dt > .5).map(([dt, v]) => [Math.round(dt), v * KMH]);
  return {
    vEntree_kmh: vEntree * KMH, ...r, ...extra, betaA03s_deg: b03 != null ? b03 * DEG : null,
    tenue_s: tLacher >= 0 ? tLacher - tDepart : null, vAuLacher_kmh: vLacher != null ? vLacher * KMH : null,
    stableApres_s: stable, contreDepassement_deg: depasse * DEG, ecartMaxApres_m: dApres, herbeApres_s: herbeApres
  };
}
// Gain de la dérive (scénario S7 des critères, élargi) : 150 m de droite, demi-tour de rayon R, 200 m de droite.
// vl est la limite de la chaîne de commande sur vraie piste. Adhérence : meilleur temps propre entre 0,90 et 1,02 vl
// dans le virage. Dérive : même approche à vl, dérive tenue jusqu'à la sortie et lâchée là, puis plein gaz et turbo
// sur la droite ; on lit aussi comment la voiture se remet en ligne après le lâcher.
function gainDerive(ctx, cond, R, entree, vl) {
  const c = piste(ctx, [{ l: 150, k: 0 }, { l: Math.PI * R, k: 1 / R }, { l: 800, k: 0 }], { lissage: 8 });
  const sA = c.bornes[1], sB = c.bornes[2], sFin = sB + 200, E = ENTREES[entree];
  const tour = (k, enDerive) => {
    const et = voiture(ctx, cond), reg = regulateur(), dtD = dtDecision(E);
    lancer(ctx, et, vl);
    let raison = null, t1 = null, phase = 'ligne', turbo = null, tient = false, tLacher = -1, vLacher = 0, v1s = null, depasse = 0, stable = null, hs = 0, dMax = 0;
    seance(ctx, c, et, E, (e, t) => {
      const dansArc = e.s >= sA && e.s < sB - 2, vol = volantLigne(ctx, c, e);
      if (enDerive && dansArc && phase !== 'fini' && phase !== 'perdue') {
        if (phase === 'ligne') phase = 'appui';
        if (phase === 'appui') return { volant: 1, gaz: 1, frein: 0, derive: true };
        return loiDerive(e);
      }
      if (enDerive && (phase === 'tenue' || phase === 'appui')) { tient = phase === 'tenue'; phase = 'fini'; tLacher = t; vLacher = e.v; }
      if (enDerive && phase !== 'ligne') return { volant: vol, gaz: 1, frein: 0 };
      const p = reg.pedales(e, dtD, e.s < sA ? vl : dansArc ? k * vl : 95);
      return { volant: vol, gaz: p.gaz, frein: p.frein };
    }, 40, (e, t, evs) => {
      for (const x of evs) {
        if (x.type === 'derive' && phase === 'appui') phase = 'tenue';
        if (x.type === 'deriveAnnulee' && phase === 'tenue') phase = 'perdue';
        if (x.type === 'turbo') turbo = { niveau: x.niveau, duree_s: x.duree, parfait: x.parfait };
        if (x.type === 'choc') raison = 'glissière';
      }
      if (tLacher >= 0) {
        const dt = t - tLacher;
        if (v1s == null && dt >= 1) v1s = e.v;
        depasse = Math.max(depasse, -e.beta); dMax = Math.max(dMax, Math.abs(e.d));
        if (Math.abs(e.beta) < 2 / DEG) { hs += DT; if (stable == null && hs >= .5) stable = dt - .5; } else hs = 0;
      }
      if (e.surface === 'herbe') raison = 'herbe';
      if (Math.abs(e.beta) > Math.PI / 2) raison = 'tête-à-queue';
      if (raison) return false;
      if (e.s >= sFin) { t1 = t; return false; }
    });
    return {
      propre: !raison && t1 != null, raison: raison || (t1 == null ? 'temps' : null), temps_s: t1, turbo, tenueJusquALaSortie: tient, phase,
      gain1sApresLacher_kmh: v1s != null ? (v1s - vLacher) * KMH : null, contreDepassement_deg: depasse * DEG, stableApres_s: stable, ecartMaxApres_m: dMax
    };
  };
  let ref = null;
  for (const k of [.9, .94, .96, .98, 1, 1.02]) { const r = tour(k, false); if (r.propre && (!ref || r.temps_s < ref.temps_s)) ref = { ...r, fraction: k }; }
  const dr = tour(1, true);
  return {
    vApproche_kmh: vl * KMH, adherence_s: ref ? ref.temps_s : null, fractionAdherence: ref ? ref.fraction : null, derive_s: dr.propre ? dr.temps_s : null,
    deriveEchec: dr.propre ? null : dr.raison, deriveTenue: dr.tenueJusquALaSortie, deriveAnnulee: dr.phase === 'perdue', turbo: dr.turbo,
    gain_s: ref && dr.propre ? ref.temps_s - dr.temps_s : null, gain1sApresLacher_kmh: dr.gain1sApresLacher_kmh,
    contreDepassement_deg: dr.contreDepassement_deg, stableApres_s: dr.stableApres_s, ecartMaxApres_m: dr.ecartMaxApres_m
  };
}

// ---------------------------------------------------------------- 8. herbe
// Ligne droite de vraie piste (12 m, herbe au-delà de 6 m, glissière à 20 m). Le pilote vise un décalage qui glisse à
// 4 m/s jusqu'à 9 m (le centre de la voiture 3 m dans l'herbe), y reste 1,5 s, puis revient à l'axe ; il garde sa
// vitesse de départ au régulateur. Le temps perdu se compte contre le même pilote resté sur l'axe.
function herbe(ctx, cond, vkmh, entree) {
  const c = droite(ctx, 4000), v0 = vkmh / KMH, E = ENTREES[entree], duree = 9;
  const course = sortir => {
    const et = voiture(ctx, cond), reg = regulateur(), dtD = dtDecision(E);
    lancer(ctx, et, v0);
    let tIn = null, tOut = null, vIn = 0, vOut = 0, tHerbe = 0, tRetour = null, bMax = 0, wSaut = 0, tq = false, traverse = 0, wP = et.omega, cible = 0;
    seance(ctx, c, et, E, (e, t) => {
      if (sortir) {
        if (tRetour == null) { cible = Math.min(9, Math.max(0, 4 * (t - 1))); if (tIn != null && t - tIn >= 1.5) tRetour = t; }
        else cible = Math.max(0, 9 - 4 * (t - tRetour));
      }
      const p = reg.pedales(e, dtD, v0); return { volant: volantLigne(ctx, c, e, cible), gaz: p.gaz, frein: p.frein };
    }, duree, (e, t) => {
      const dW = Math.abs(e.omega - wP) / DT; wP = e.omega;
      if (e.surface === 'herbe') { tHerbe += DT; if (tIn == null) { tIn = t; vIn = e.v; } }
      else if (tIn != null && tOut == null && e.d < 6) { tOut = t; vOut = e.v; }
      if (tOut != null && t - tOut <= 1.5) { bMax = Math.max(bMax, Math.abs(e.beta)); wSaut = Math.max(wSaut, dW); }
      if (tOut != null) traverse = Math.max(traverse, -e.d);
      if (Math.abs(e.beta) > Math.PI / 2) { tq = true; return false; }
    });
    return { et, tIn, tOut, vIn, vOut, tHerbe, bMax, wSaut, tq, traverse };
  };
  const ref = course(false), s = course(true);
  return {
    herbe_s: s.tHerbe, decelHerbe_g: s.tOut != null ? (s.vIn - s.vOut) / (s.tOut - s.tIn) / G : null, betaMaxRetour_deg: s.bMax * DEG,
    accelLacetMaxRetour_rads2: s.wSaut, ecartAutreCote_m: s.traverse, teteAQueue: s.tq,
    tempsPerdu_s: s.tq ? null : (ref.et.distance - s.et.distance) / Math.max(ref.et.v, 1)
  };
}

// mesures élémentaires, pour les vérifications et les études ponctuelles
export const essais = { tenir, vLimite, vPiste, virageEtabli, depart, freinage, freinMoteur, echelon, boucleOuverte, boucleFermee, derive, gainDerive, remiseGaz, chicane, slalom, herbe };

// ---------------------------------------------------------------- exécution
const par = (cles, f) => Object.fromEntries(cles.map(k => [k, f(k)]));
// Toutes les manœuvres sur un modèle chargé ; résultats bruts (doubles complets). Partie pure, de « pistes d'essai »
// jusqu'ici : elle tourne aussi telle quelle dans la page du jeu, sur le B.conduite de la page (scriptPage).
export function mesurer(ctx, o = {}) {
  const court = !!o.court, sec = CONDITIONS.sec, R = {}, meteo = ctx.B.meteo;
  try {
    R.constantes = constantes(ctx);
    // ligne droite
    const conds = court ? ['sec'] : TOUTES;
    R.ligneDroite = {
      depart: par(conds, k => depart(ctx, CONDITIONS[k], { duree: court ? 30 : 60 })),
      freinages: {
        '200-0': par(conds, k => freinage(ctx, CONDITIONS[k], 200, 0)),
        ...(court ? {} : {
          '300-100': par(conds, k => freinage(ctx, CONDITIONS[k], 300, 100)),
          '100-0': par(conds, k => freinage(ctx, CONDITIONS[k], 100, 0)),
          pedale: { '200-0, pédale 0,9': freinage(ctx, sec, 200, 0, .9), '200-0, pédale 0,8': freinage(ctx, sec, 200, 0, .8), '200-0, pédale 0,6': freinage(ctx, sec, 200, 0, .6) }
        })
      }
    };
    if (!court) {
      R.ligneDroite.departSansLancement = depart(ctx, sec, { lancement: false, duree: 20 });
      R.ligneDroite.aspiration = {
        pointeAspirationPleine_kmh: depart(ctx, sec, { aspiration: 1, duree: 80 }).pointe_kmh,
        reprise200a280_libre_s: reprise(ctx, sec, 200, 280, 0), reprise200a280_aspire_s: reprise(ctx, sec, 200, 280, 1)
      };
      R.ligneDroite.freinMoteur = freinMoteur(ctx, sec);
    }
    // virages établis : la voiture seule, sur l'aire d'essai
    const rayons = court ? [120] : [30, 60, 120, 180, 250, 500], iter = court ? 10 : 12;
    R.virages = { etablis: par(rayons.map(String), r => virageEtabli(ctx, sec, +r, { iter, fractions: court ? [.5, 1] : undefined })) };
    const vl = r => R.virages.etablis[String(r)] ? R.virages.etablis[String(r)].vLimite_kmh / KMH : vLimite(ctx, sec, r);
    if (!court) {
      R.virages.mouille = par(MOUILLEES, k => par(['30', '120', '500'], r => { const v = vLimite(ctx, CONDITIONS[k], +r); return v == null ? null : v * KMH; }));
      R.virages.symetrieGaucheR120_kmh = vLimite(ctx, sec, -120) * KMH;
      R.virages.voitureAbimeeR120_kmh = vLimite(ctx, sec, 120, { degats: { adher: .92, trainee: 1.08 } }) * KMH;
      R.virages.pneusSelonEauR120_kmh = par(['slicks', 'inter', 'pluie'], p => par(EAUX, w => vLimite(ctx, { eau: +w, pneus: p }, 120) * KMH));
      // même rayon, vraie piste de 12 m, chaque chaîne de commande ; part de la voiture seule sur l'aire d'essai, même condition
      const large = (k, r) => k === 'sec' ? vl(+r) : R.virages.mouille[k][r] / KMH;
      R.virages.commandes = par(TOUTES, k => par(['30', '120', '500'], r => par(QUATRE, en => {
        const v = vPiste(ctx, CONDITIONS[k], +r, en);
        if (v == null) return null;
        const t = tenir(ctx, CONDITIONS[k], +r, v, { ...REELLE, entree: en });
        return { vLimite_kmh: v * KMH, surPhysiqueLarge: v / large(k, r), frappesParS: t.appuisParS, gaz: t.gaz, volant: t.volant };
      })));
      const vLent = vPiste(ctx, sec, 120, { ...ENTREES.clavier, tenue: .1 });
      R.virages.clavierLentR120_kmh = vLent == null ? null : vLent * KMH;
      // L'aide seule : même pilote, même cadence et mêmes pédales que la voiture seule, aide « Légère ». L'écart avec la
      // manette mêle sinon l'aide et la cadence de 60 Hz ; ici il n'y a plus que l'aide (elle entre sur |β| > 3,55°, et
      // la voiture tient ses grands rayons à 3,5–3,9° de dérive de caisse).
      const avecAide = { ...ENTREES.physique, aide: ENTREES.manette.aide, nom: 'physique+aide' };
      R.virages.aideSeule = par(['sec', 'mouille-slicks'], k => par(['30', '120', '180'], r => {
        const sans = vPiste(ctx, CONDITIONS[k], +r, 'physique'), avec = vPiste(ctx, CONDITIONS[k], +r, avecAide);
        return { sansAide_kmh: sans == null ? null : sans * KMH, avecAide_kmh: avec == null ? null : avec * KMH, rapport: sans && avec ? avec / sans : null };
      }));
    }
    // échelon de volant
    R.echelon = par(court ? ['100'] : ['100', '200'], v => {
      const o2 = { physique: ['mi', 'plein'], manette: ['mi', 'plein'], clavier: ['plein'] };
      const res = {};
      for (const [en, modes] of Object.entries(o2)) for (const m of modes) if (!court || en === 'physique') res[en + ' ' + m] = echelon(ctx, sec, +v, en, m);
      if (!court) for (const k of MOUILLEES) res['physique mi ' + k] = echelon(ctx, CONDITIONS[k], +v, 'physique', 'mi');
      return res;
    });
    if (!court) {
      // lever de pied, remise des gaz, freinage en appui
      const vp = (k, r, en) => vPiste(ctx, CONDITIONS[k], r, en), PR = {};
      R.leverDePied = {
        boucleOuverte: par(['60', '120', '250'], r => par(['0', '0.35'], a => boucleOuverte(ctx, sec, +r, .95 * vl(+r), { gaz: 0, frein: 0 }, +a))),
        boucleFermeeR120: par(TOUTES, k => par(QUATRE, en => { const v = vp(k, 120, en); return v == null ? null : boucleFermee(ctx, CONDITIONS[k], 120, .95 * v, en, () => ({ gaz: 0, frein: 0 }), 1.5, PR); }))
      };
      R.remiseDesGaz = {
        boucleOuverte: par(['30', '60'], r => par(['0', '0.35'], a => boucleOuverte(ctx, sec, +r, .92 * vl(+r), { gaz: 1, frein: 0 }, +a))),
        sortie: par(['30', '60'], r => par(TOUTES, k => par(k === 'sec' ? ['45', '15', 'progressif'] : ['45'], va => par(QUATRE, en => { const v = vp(k, +r, en); return v == null ? null : remiseGaz(ctx, CONDITIONS[k], +r, en, v, va); }))))
      };
      R.freinageEnAppui = {
        boucleOuverteR120: par(['0.3', '0.6', '1'], f => par(['0', '0.35'], a => boucleOuverte(ctx, sec, 120, .9 * vl(120), { gaz: 0, frein: +f }, +a, 1))),
        boucleFermeeR120: par(TOUTES, k => par(QUATRE, en => { const v = vp(k, 120, en); return v == null ? null : boucleFermee(ctx, CONDITIONS[k], 120, .9 * v, en, () => ({ gaz: 0, frein: 1 }), 1, PR); }))
      };
      // chicane et slalom
      R.chicane = par(TOUTES, k => { const dec = R.ligneDroite.freinages['200-0'][k].decelMoyenne_g * G; return par(QUATRE, en => chicane(ctx, CONDITIONS[k], en, dec)); });
      R.slalom = par(TOUTES, k => par(QUATRE, en => slalom(ctx, CONDITIONS[k], en)));
    }
    // dérive chargée : chaque chaîne aborde le virage à 95 % de sa propre limite sur vraie piste
    const entree95 = (cond, r, en) => { const v = vPiste(ctx, cond, r, en); return v == null ? null : .95 * v; };
    const deriver = (cond, r, en) => { const v = entree95(cond, r, en); return v == null ? { approcheImpossible: true } : derive(ctx, cond, r, en, v); };
    R.derive = {
      tenue: par(court ? ['120'] : ['40', '80', '120', '250', '400'], r => par(court ? ['manette', 'clavier'] : QUATRE, en => deriver(sec, +r, en)))
    };
    if (!court) {
      R.derive.tenable = par(['40', '80', '120', '250', '400'], r => par(QUATRE, en => { const v = entree95(sec, +r, en); if (v == null) return null; const d = derive(ctx, sec, +r, en, v, { tenueMax: 10, jusquAuBout: true }); return d.departRefuse ? null : { tenue_s: d.tenue_s, annulee: d.annulee, teteAQueue: d.teteAQueue, chargeMax: d.chargeMax, betaMoy_deg: d.betaMoy_deg, ecartMax_m: d.ecartMax_m, herbe_s: d.herbe_s }; }));
      R.derive.mouille = par(MOUILLEES, k => par(['80', '120'], r => par(QUATRE, en => deriver(CONDITIONS[k], +r, en))));
      R.derive.gain = par(['40', '80', '250'], r => par(QUATRE, en => { const v = vPiste(ctx, sec, +r, en); return v == null ? null : gainDerive(ctx, sec, +r, en, v); }));
      R.derive.gainMouille = par(MOUILLEES, k => par(['manette', 'clavier'], en => { const v = vPiste(ctx, CONDITIONS[k], 80, en); return v == null ? null : gainDerive(ctx, CONDITIONS[k], 80, en, v); }));
    }
    // herbe
    R.herbe = par(court ? ['100'] : ['100', '200'], v => par(court ? ['sec'] : TOUTES, k => par(court ? ['physique'] : QUATRE, en => herbe(ctx, CONDITIONS[k], +v, en))));
  } finally { ctx.B.meteo = meteo; }   // la page garde sa vraie météo
  return R;
}
// ---------------------------------------------------------------- 9. essais du lot 17 (docs/reprise/17-CONDUITE.md § 5)
// Ils s'ajoutent aux essais v1 sans les changer : leurs résultats ont leur propre empreinte (empreinteP10), et celle
// des essais v1 reste comparable d'une version du modèle à l'autre. Ils lisent le relevé `_mesure` que conduite.js
// remplit quand il est posé sur l'état : demandes et capacités des essieux, dérives rapportées à la dérive au pic.
// En p9, une roue ne bloque ni ne patine vraiment (MODELE.md § 3.9) : « bloque » et « patine » y veulent dire que la
// demande d'un essieu atteint sa capacité (la force transmise plafonne) ; quand la roue aura un état de rotation
// (17C, 17D), le relevé donnera son glissement.
function quantiles(xs) {
  if (!xs.length) return null;
  const s = Float64Array.from(xs).sort(), q = f => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1) + .5))];
  return { n: s.length, p10: q(.1), p50: q(.5), p90: q(.9), max: s[s.length - 1] };
}
function voitureMesuree(ctx, cond, s = 0, d = 0) { const et = voiture(ctx, cond, s, d); et._mesure = {}; return et; }
// Sollicitation longitudinale d'un essieu : demande / capacité (> 0 en traction, < 0 au freinage).
const sollicitation = (dem, cap) => dem / Math.max(cap, 1);

// Freinage pédale tenue : quel essieu atteint sa capacité le premier, et à quelle vitesse ; distance et temps.
function freinageBlocage(ctx, cond, v0kmh, v1kmh, o = {}) {
  const E = typeof o.entree === 'object' ? o.entree : ENTREES[o.entree || 'physique'], c = droite(ctx, 8000, LARGE), et = voitureMesuree(ctx, cond), v0 = v0kmh / KMH, v1 = Math.max(v1kmh / KMH, .1);
  lancer(ctx, et, v0);
  seance(ctx, c, et, ENTREES.physique, piloteLigne(ctx, c, v0, ENTREES.physique), 1.5);
  const d0 = et.distance, vDep = et.v, pedale = o.pedale ?? 1;
  let vP = et.v, dP = 0, tP = 0, fin = null, vAv = null, vAr = null, sAvMax = 0, sArMax = 0;
  seance(ctx, c, et, E, () => ({ volant: 0, gaz: 0, frein: pedale }), 40, (e, t) => {
    const M = e._mesure, sAv = -sollicitation(M.demAv, M.capAv), sAr = -sollicitation(M.demAr, M.capAr), d = e.distance - d0;
    sAvMax = Math.max(sAvMax, sAv); sArMax = Math.max(sArMax, sAr);
    if (vAv == null && sAv >= 1) vAv = e.v * KMH;
    if (vAr == null && sAr >= 1) vAr = e.v * KMH;
    if (e.v <= v1) { const u = (vP - v1) / Math.max(vP - e.v, 1e-12); fin = { t: tP + u * DT, d: dP + u * (d - dP) }; return false; }
    vP = e.v; dP = d; tP = t;
  });
  const corr = (v0 * v0 - v1 * v1) / Math.max(vDep * vDep - v1 * v1, 1e-9);
  const premier = vAv == null && vAr == null ? null : vAr == null || (vAv != null && vAv >= vAr) ? 'avant' : 'arrière';
  return { distance_m: fin ? fin.d * corr : null, temps_s: fin ? fin.t : null, premier, vBlocageAv_kmh: vAv, vBlocageAr_kmh: vAr, sollicitationAvMax: sAvMax, sollicitationArMax: sArMax };
}
// Départ arrêté plein gaz (2 s de grille au lancement) : sollicitation de l'arrière, durée du patinage, 0-100.
function departPatinage(ctx, cond, o = {}) {
  const c = droite(ctx, 3000, LARGE), et = voitureMesuree(ctx, cond), E = { ...ENTREES.physique, aide: o.aide ?? 0 };
  const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0, guidage: 0 };
  for (let i = 0; i < 240; i++) ctx.CD.pas(et, cmd, c, DT, true);
  let sMax = 0, patine = 0, t100 = null, vP = 0, regMin = Infinity;
  const gaz = o.gaz ?? 1;
  seance(ctx, c, et, E, () => ({ volant: 0, gaz, frein: 0 }), 6, (e, t) => {
    const M = e._mesure, s = sollicitation(M.demAr, M.capAr);
    if (t <= 3) { sMax = Math.max(sMax, s); if (s >= 1) patine += DT; }
    if (t <= .5 + 1e-9) regMin = Math.min(regMin, e.regime);
    if (t100 == null && e.v * KMH >= 100) t100 = franchir(t, e.v * KMH, vP * KMH, 100);
    vP = e.v;
  });
  return { sollicitationArMax: sMax, patinage_s: patine, t100_s: t100, regimeMin05s: regMin };
}
// Meilleur départ dosé : gaz constant de 0,5 à 1, le plus court 0-100.
function departDose(ctx, cond) {
  let mieux = null;
  for (const g of [.5, .6, .7, .8, .9, 1]) { const r = departPatinage(ctx, cond, { gaz: g }); if (r.t100_s != null && (!mieux || r.t100_s < mieux.t100_s)) mieux = { gaz: g, t100_s: r.t100_s }; }
  return mieux;
}
// Tenue d'un rayon à un décalage visé (m, > 0 à droite) : le pilote de ligne vise `cible` ; tenu à 0,6 m près.
function tenirDecale(ctx, cond, c, v, cible, duree = 8) {
  const E = ENTREES.physique, et = voitureMesuree(ctx, cond, 0, cible);
  lancer(ctx, et, v); et.omega = v / (c.rayon - cible);
  let dMax = 0, dvMax = 0, tq = false, cap = 0, n = 0;
  seance(ctx, c, et, E, piloteLigne(ctx, c, v, E, cible), duree, (e, t) => {
    tq ||= Math.abs(e.beta) > Math.PI / 2;
    if (t > duree - 2) { dMax = Math.max(dMax, Math.abs(e.d - cible)); dvMax = Math.max(dvMax, Math.abs(e.v - v)); cap += e.capAv + e.capAr; n++; }
    if (tq) return false;
  });
  return { tenu: !tq && dMax < .6 && dvMax < 1 && Math.abs(et.beta) < .15, capacite_N: cap / Math.max(n, 1), et };
}
// Deux roues dans l'herbe (R, roues extérieures `debord` m au-delà du bord, le centre sur la piste), à 0,9 × la
// limite tenue au même décalage sur une piste large : 6 s sur l'axe, la cible glisse vers le décalage à 2 m/s, puis
// 3 s au décalage. Capacité des essieux (capAv + capAr) sur la dernière seconde, vraie piste contre piste large (même
// vitesse, même trajectoire) ; écart de β pris pendant l'entrée sur la vraie piste.
function deuxRouesHerbe(ctx, cond, R, debord) {
  const demi = ctx.CI.LARGEUR / 2, voie = ctx.P.voieAv ?? ctx.P.voie, cible = -(demi + debord - voie / 2);
  const cH = cercle(ctx, R, { vibreurs: false, limite: 20 }), cL = cercle(ctx, R, { vibreurs: false, largeur: 40, limite: 20 });
  const vL = limiteFranche(Math.max(8, .6 * vRefRivaux(R)), 95, v => tenirDecale(ctx, cond, cL, v, cible).tenu, { iter: 12 }).v;
  if (vL == null) return null;
  const v = .9 * vL, duree = 6 + Math.abs(cible) / 2 + 3, E = ENTREES.physique;
  const entree = c => {
    const et = voitureMesuree(ctx, cond);
    lancer(ctx, et, v); et.omega = v / c.rayon;
    let tVise = null, b0 = 0, bMax = 0, herbe = 0, cap = 0, n = 0, dMax = 0, tq = false;
    seance(ctx, c, et, E, (e, t) => {
      if (t < 6) return piloteLigne(ctx, c, v, E, 0)(e);
      if (tVise == null) { tVise = t; b0 = e.beta; }
      return piloteLigne(ctx, c, v, E, Math.max(cible, -2 * (t - tVise)))(e);
    }, duree, (e, t) => {
      if (tVise != null) { bMax = Math.max(bMax, Math.abs(e.beta - b0)); if (e.surface === 'herbe') herbe += DT; }
      if (t > duree - 1) { cap += e.capAv + e.capAr; n++; dMax = Math.max(dMax, Math.abs(e.d - cible)); }
      if (Math.abs(e.beta) > Math.PI / 2) { tq = true; return false; }
    });
    return { cap: cap / Math.max(n, 1), bMax, herbe, dMax, tq };
  };
  const h = entree(cH), l = entree(cL);
  return {
    decalage_m: cible, v_kmh: v * KMH, vLimiteLarge_kmh: vL * KMH, capaciteRelative: h.cap / l.cap, betaEntree_deg: h.bMax * DEG,
    centreDansLHerbe_s: h.herbe, ecartFin_m: h.dMax, teteAQueue: h.tq
  };
}
// Passage de vibreur en ligne droite : capacité des essieux (capAv + capAr), roues d'un côté sur la bande (centre sur
// la piste), puis centre sur la bande, contre la même vitesse sur l'axe.
function vibreurPassage(ctx, cond, vkmh) {
  const c = droite(ctx, 3000, LARGE), demi = ctx.CI.LARGEUR / 2, voie = ctx.P.voieAv ?? ctx.P.voie, v = vkmh / KMH;
  c.vibreur.fill(3); c.largeur = ctx.CI.LARGEUR;
  const capa = d => {
    const et = voitureMesuree(ctx, cond, 0, d); lancer(ctx, et, v);
    let cap = 0, n = 0;
    seance(ctx, c, et, ENTREES.physique, piloteLigne(ctx, c, v, ENTREES.physique, d), 2, (e, t) => { if (t > 1.5) { cap += e.capAv + e.capAr; n++; } });
    return cap / Math.max(n, 1);
  };
  const ref = capa(0), roues = capa(demi + ctx.P.largeurVibreur / 2 - voie / 2), centre = capa(demi + ctx.P.largeurVibreur / 2);
  return { rouesSurVibreur: roues / ref, centreSurVibreur: centre / ref };
}
// Plein gaz en appui, volant figé : après 8 s de tenue à f × la limite, gaz à fond 1,5 s, aide nulle, rapport tenu
// (boîte manuelle) ; plus grande dérive arrière rapportée au pic.
function pleinGazAppui(ctx, cond, R, f, rapport = 2) {
  const vl = vLimite(ctx, cond, R), t0 = tenir(ctx, cond, R, f * vl), { et, c } = t0, P = ctx.P;
  // rapport imposé si la vitesse le permet sous le rupteur (sinon celui de la boîte automatique)
  if (et.v < .97 * P.vitessePointe[rapport - 1]) { et.rapport = rapport; et.regime = clamp(P.ralenti + (P.maxUtile - P.ralenti) * et.v / P.vitessePointe[rapport - 1], P.ralenti, P.rupteur); }
  et._mesure = {};
  let xMax = 0, aMax = 0, tq = false;
  seance(ctx, c, et, { ...ENTREES.physique, boite: 'manuelle' }, () => ({ volant: t0.volCmd, gaz: 1, frein: 0 }), 1.5, e => {
    if (e._mesure.xAr != null) xMax = Math.max(xMax, e._mesure.xAr);
    aMax = Math.max(aMax, e.deriveAr);
    if (Math.abs(e.beta) > Math.PI / 2) { tq = true; return false; }
  });
  return { rapport: et.rapport, xArMax: xMax, deriveArMax_deg: aMax * DEG, teteAQueue: tq };
}
// Sillage tenu en virage : limite de R à l'aspiration d'une voiture à `ds` mètres (part de course.js, 1 − ds/30),
// contre la même sans sillage.
function sillageVirage(ctx, cond, R, ds) {
  const part = Math.max(0, 1 - ds / 30), seul = vLimite(ctx, cond, R), derriere = vLimite(ctx, cond, R, { aspiration: part });
  return { part, seul_kmh: seul == null ? null : seul * KMH, derriere_kmh: derriere == null ? null : derriere * KMH, rapport: seul && derriere ? derriere / seul : null };
}
// Régime rapporté à la vitesse : régime × vPointe(rapport) / v pendant un départ plein gaz, hors passages.
function regimeSurVitesse(ctx, cond) {
  const c = droite(ctx, 12000, LARGE), et = voiture(ctx, cond), VP = ctx.P.vitessePointe, xs = [];
  seance(ctx, c, et, ENTREES.physique, () => ({ volant: 0, gaz: 1, frein: 0 }), 30, e => { if (e.v > 15 && e.coupure <= 0 && e.rapport >= 1) xs.push(e.regime * VP[e.rapport - 1] / e.v); });
  return quantiles(xs);
}
// Frein moteur à 10 000 tr/min en 2e et en 6e (boîte manuelle, pied levé) : force relevée et décélération.
function freinMoteurRapports(ctx, cond) {
  const c = droite(ctx, 12000, LARGE), VP = ctx.P.vitessePointe, E = { ...ENTREES.physique, boite: 'manuelle' };
  const regimeA = (r, v) => { const et = voitureMesuree(ctx, cond); et.v = v; et.rapport = r; et.regime = 10000; seance(ctx, c, et, E, () => ({ volant: 0, gaz: 0, frein: 0 }), .3); return et.regime; };
  const res = {};
  for (const r of [2, 6]) {
    let lo = .2 * VP[r - 1], hi = VP[r - 1];
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (regimeA(r, m) < 10000) lo = m; else hi = m; }
    const et = voitureMesuree(ctx, cond); et.v = lo; et.rapport = r; et.regime = 10000;
    let f = 0, a = 0, n = 0;
    seance(ctx, c, et, E, () => ({ volant: 0, gaz: 0, frein: 0 }), .5, (e, t) => { if (t > .25) { f += e._mesure.freinMoteur ?? 0; a += -e.along; n++; } });
    res[r] = { kmh: lo * KMH, freinMoteur_N: f / n, decelPneus_g: a / n / G };
  }
  return { ...res, rapport2sur6: res[2].freinMoteur_N / Math.max(res[6].freinMoteur_N, 1e-9) };
}
// Profil des rivaux : limite d'adhérence (traînée compensée) de R 20 à R 400, ajustement de
// v = √(μ·g / (k − μ·A)), soit a_y = μ·g + μ·A·v² (moindres carrés sur les rayons que la puissance ne borne pas),
// et rapports à la vitesse de référence actuelle des rivaux (circuit.js, MU 1,55, AERO 0,00155).
export const RAYONS_RIVAUX = Object.freeze([20, 30, 40, 60, 80, 120, 180, 250, 400]);
function profilRivaux(ctx, cond) {
  const pts = [], lignes = [];
  for (const R of RAYONS_RIVAUX) {
    const v = vLimite(ctx, cond, R, { compense: true }), r = cercle(ctx, R, LARGE).rayon, borne = v != null && v >= ctx.P.vitessePointe[5] - .5;
    lignes.push({ R: r, vAdherence_kmh: v == null ? null : v * KMH, borne, vRefRivaux_kmh: vRefRivaux(r) * KMH });
    if (v != null && !borne) pts.push([v * v, v * v / r]);
  }
  const b = pente(pts), n = pts.length, a = pts.reduce((s, p) => s + p[1], 0) / n - b * pts.reduce((s, p) => s + p[0], 0) / n;
  const muEq = a / G, aEq = b / muEq, vFit = R => Math.min(ctx.P.vitessePointe[5], Math.sqrt(muEq * G / Math.max(1 / R - muEq * aEq, 1e-9)));
  for (const l of lignes) { l.refSurAdherence = l.vAdherence_kmh ? l.vRefRivaux_kmh / l.vAdherence_kmh : null; l.vAjuste_kmh = vFit(l.R) * KMH; l.ajusteSurAdherence = l.vAdherence_kmh ? l.vAjuste_kmh / l.vAdherence_kmh : null; }
  return { muEq, aeroEq: aEq, points: n, rayons: lignes };
}
// Limite d'adhérence (traînée compensée) : quel essieu la fixe. Une seconde de plus à la limite, relevé `_mesure` :
// dérives rapportées au pic (x) et réserve de chaque essieu, 1 − |Fy| / ce que l'essieu peut donner en latéral.
function limiteEssieux(ctx, cond, R) {
  const v = vLimite(ctx, cond, R, { compense: true });
  if (v == null) return null;
  const t0 = tenir(ctx, cond, R, v, { compense: true }), { et, c } = t0, E = ENTREES.physique;
  et._mesure = {};
  let xAv = 0, xAr = 0, rAv = 0, rAr = 0, n = 0;
  seance(ctx, c, et, E, piloteLigne(ctx, c, v, E), 1, e => {
    const M = e._mesure;
    xAv += Math.abs(M.xAv); xAr += Math.abs(M.xAr); rAv += 1 - Math.abs(M.fyAv) / Math.max(M.latAv, 1); rAr += 1 - Math.abs(M.fyAr) / Math.max(M.latAr, 1); n++;
  });
  return { v_kmh: v * KMH, xAv: xAv / n, xAr: xAr / n, reserveAv: rAv / n, reserveAr: rAr / n, limitePar: rAv <= rAr ? 'avant' : 'arrière' };
}
// Tenue longue en R 80 : dérive gardée 10 s, puis lâchée ; turbo obtenu et vitesse au fil de la tenue.
function tenueLongue(ctx, cond, R, entree) {
  const v = vPiste(ctx, cond, R, entree);
  if (v == null) return null;
  const d = derive(ctx, cond, R, entree, .95 * v, { tenueMax: 10, jusquAuBout: true, vitesses: true });
  if (d.departRefuse) return { departRefuse: true };
  const at = s => { const p = (d.vitesse_kmh || []).find(([t]) => t === s); return p ? p[1] : null; };
  return { tenue_s: d.tenue_s, annulee: d.annulee, turbo: d.turbo, perte3a6s_kmh: at(3) != null && at(6) != null ? at(3) - at(6) : null, vitesse_kmh: d.vitesse_kmh };
}

export const essaisP10 = { freinageBlocage, departPatinage, departDose, deuxRouesHerbe, limiteEssieux, vibreurPassage, pleinGazAppui, sillageVirage, regimeSurVitesse, freinMoteurRapports, profilRivaux, tenueLongue, quantiles };
// Tous les essais du lot 17 ; résultats bruts (doubles complets).
export function mesurerP10(ctx, o = {}) {
  const sec = CONDITIONS.sec, R = {}, meteo = ctx.B.meteo;
  try {
    R.freinageBlocage = {
      '300-0': freinageBlocage(ctx, sec, 300, 0), '200-0': freinageBlocage(ctx, sec, 200, 0),
      '300-0 manette': freinageBlocage(ctx, sec, 300, 0, { entree: { ...ENTREES.manette, aide: 0 } }), '200-0 clavier': freinageBlocage(ctx, sec, 200, 0, { entree: 'clavier' })
    };
    R.depart = { sansAide: departPatinage(ctx, sec), legere: departPatinage(ctx, sec, { aide: ENTREES.manette.aide }), dose: departDose(ctx, sec) };
    R.echelon = par(['150', '250'], v => par(['mi', 'plein'], m => echelon(ctx, sec, +v, 'physique', m)));
    R.echelonAucune = { '200 plein': echelon(ctx, sec, 200, { ...ENTREES.manette, aide: 0, nom: 'manette aucune' }, 'plein') };
    R.limiteEssieux = par(['30', '60', '120', '180'], r => limiteEssieux(ctx, sec, +r));
    R.pleinGaz = { 'R60 0.92': pleinGazAppui(ctx, sec, 60, .92) };
    R.deuxRouesHerbe = { R120: deuxRouesHerbe(ctx, sec, 120, .5) };
    R.vibreur = { '150': vibreurPassage(ctx, sec, 150) };
    R.sillage = { 'R120 10 m': sillageVirage(ctx, sec, 120, 10) };
    R.deriveXar = par(['40', '80', '120', '250', '400'], r => par(['physique', 'manette', 'clavier'], en => {
      const v = vPiste(ctx, sec, +r, en); if (v == null) return null;
      const d = derive(ctx, sec, +r, en, .95 * v, { xar: true });
      return d.departRefuse ? null : { xAr: d.xAr, turbo: d.turbo, annulee: d.annulee };
    }));
    R.tenueLongue = { R80: par(['manette', 'clavier'], en => tenueLongue(ctx, sec, 80, en)) };
    R.regime = regimeSurVitesse(ctx, sec);
    R.freinMoteur = freinMoteurRapports(ctx, sec);
    R.eau = {
      // au-delà du régime maxi de la 6e, la limite n'est plus mesurée : la valeur est alors un minimum (bornee)
      aquaplanageR500: par(['slicks', 'pluie'], p => { const v = vLimite(ctx, { eau: 1, pneus: p }, 500, { compense: true }); return v == null ? null : { kmh: v * KMH, bornee: v >= ctx.P.vitessePointe[5] - .5 }; }),
      neigeR120: par(['slicks', 'pluie'], p => { const v = vLimite(ctx, { eau: 0, neige: 1, pneus: p }, 120); return v == null ? null : v * KMH; })
    };
    R.rivaux = profilRivaux(ctx, sec);
  } finally { ctx.B.meteo = meteo; }
  return R;
}
// ---------------------------------------------------------------- fin de la partie pure

export function executer(o = {}) {
  const ctx = charger(o.src || SRC, o.reglages), R = mesurer(ctx, o), court = !!o.court, brut = JSON.stringify(R);
  // essais du lot 17 : banc complet seulement, après les essais v1 (ils en reprennent les limites mémorisées) ;
  // `p10: false` les saute
  const R10 = court || o.p10 === false ? null : mesurerP10(ctx, o);
  return {
    banc: 'BITUME — banc de conduite', versionBanc: VERSION_BANC, court,
    reglages: { pas_s: DT, cadenceCommandes_hz: 60, clavierTenueMin_s: ENTREES.clavier.tenue, aideDefaut: ENTREES.manette.aide, guidageClavier: ENTREES.clavier.guidage, eauMouillee: CONDITIONS['mouille-slicks'].eau },
    reglagesPARAMS: ctx.reglages, empreinteSources: ctx.empreinteSources,
    // empreinte des résultats bruts (doubles complets) : identique si et seulement si le modèle rend les mêmes nombres
    empreinte: createHash('sha256').update(brut).digest('hex'),
    empreinteP10: R10 ? createHash('sha256').update(JSON.stringify(R10)).digest('hex') : null,
    resultats: arrondir(R),
    resultatsP10: R10 ? arrondir(R10) : null
  };
}
function arrondir(x) {
  if (typeof x === 'number') return Number.isFinite(x) ? (Number.isInteger(x) ? x : Number(x.toPrecision(5))) : null;
  if (Array.isArray(x)) return x.map(arrondir);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, arrondir(v)]));
  return x;
}

// ---------------------------------------------------------------- même banc dans la page du jeu
// Script pour tools/page-essai.mjs : la partie pure du banc, évaluée dans la page construite sur le B.conduite que le
// jeu fait rouler, rend les résultats bruts du sous-ensemble court ; --verifier-page les compare à ceux de Node, preuve
// que le banc mesure bien la voiture du jeu. Chrome et Node n'ont pas toujours le même Math.exp au dernier bit (Chrome
// 157 et Node 24.18 diffèrent sur exp(−2,9)) : les filtres du modèle en dépendent, la comparaison se fait donc nombre
// à nombre, à 1e-9 près en relatif, l'empreinte disant en plus si l'accord est exact.
export function scriptPage() {
  const t = readFileSync(fileURLToPath(import.meta.url), 'utf8'), i = t.indexOf('const G = 9.81');
  const tete = t.slice(i, t.indexOf('\n', t.indexOf('const clamp =', i)) + 1);
  const pur = t.slice(t.indexOf("// " + "-".repeat(64) + " pistes d'essai"), t.indexOf("// " + "-".repeat(64) + " fin de la partie pure")).replace(/^export /gm, '');
  return `(() => {\n${tete}${pur}\nconst B = window.BITUME, ctx = { B, CD: B.conduite, CI: B.circuit, P: B.conduite.PARAMS, memo: new Map() };\nreturn JSON.stringify(mesurer(ctx, { court: true }));\n})()\n`;
}

// ---------------------------------------------------------------- tableau lisible
const nb = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ',');
const col = (s, w) => { s = String(s); return s.length >= w ? s : s + ' '.repeat(w - s.length); };
export function tableau(out) {
  const R = out.resultats, L = [];
  const titre = s => L.push('', '== ' + s);
  L.push(`${out.banc} (banc v${out.versionBanc}${out.court ? ', court' : ''}) — empreinte ${out.empreinte.slice(0, 16)} · sources ${out.empreinteSources.slice(0, 12)}`);
  const C = R.constantes;
  titre('Voiture (PARAMS)');
  L.push(`masse ${C.masse_kg} kg · empattement ${nb(C.empattement_m, 2)} m · voie ${nb(C.voie_m, 2)} m · CG ${nb(C.hauteurCG_m, 2)} m · avant ${nb(C.repartitionAvant * 100, 0)} % · Iz ${nb(C.inertieLacet_kgm2, 0)} kg·m²`);
  L.push(`SCx ${nb(C.SCx_m2, 2)} m² · SCz ${nb(C.SCz_m2, 2)} m² · appui/poids ${nb(C.appuiSurPoids['100'], 2)} / ${nb(C.appuiSurPoids['200'], 2)} / ${nb(C.appuiSurPoids['300'], 2)} à 100/200/300 km/h`);
  L.push(`capacité latérale nominale ${nb(C.capaciteLaterale_g['100'], 2)} / ${nb(C.capaciteLaterale_g['200'], 2)} / ${nb(C.capaciteLaterale_g['300'], 2)} g · braquage maxi ${['50', '100', '200', '300'].map(k => nb(C.braquageMax_deg[k], 1)).join(' / ')}° à 50/100/200/300 km/h`);
  L.push('adhérence des pneus selon l’eau 0 / 0,2 / 0,47 / 0,75 / 1 : ' + Object.entries(C.adherencePneus).map(([p, t]) => p + ' ' + EAUX.map(w => nb(t[w], 3)).join('/')).join(' · '));
  const LD = R.ligneDroite;
  titre('Départ arrêté (2 s de grille plein gaz, boîte auto)');
  L.push(col('condition', 16) + col('0-100', 8) + col('0-200', 8) + col('0-300', 8) + col('400 m', 16) + col('1000 m', 16) + col('pointe', 10) + col('P roue', 10) + 'acc. maxi 1re');
  for (const [k, d] of Object.entries(LD.depart)) L.push(col(k, 16) + col(nb(d.t_kmh['100'], 2) + ' s', 8) + col(nb(d.t_kmh['200'], 2) + ' s', 8) + col(nb(d.t_kmh['300'], 1) + ' s', 8) +
    col(d.m400 ? nb(d.m400.t, 2) + ' s ' + nb(d.m400.kmh, 0) : '—', 16) + col(d.m1000 ? nb(d.m1000.t, 2) + ' s ' + nb(d.m1000.kmh, 0) : '—', 16) + col(nb(d.pointe_kmh, 1), 10) + col(nb(d.puissanceRoueMax_ch, 0) + ' ch', 10) + nb(d.accelerationMax_g[0], 2) + ' g');
  if (LD.depart.sec) L.push('puissance à la roue maxi par rapport (kW) : ' + LD.depart.sec.puissanceRoue_kW.map(x => nb(x, 0)).join(' / ') + ' · accélération maxi par rapport (g) : ' + LD.depart.sec.accelerationMax_g.map(x => nb(x, 2)).join(' / '));
  if (LD.departSansLancement) L.push(`sans lancement sur la grille : 0-100 ${nb(LD.departSansLancement.t_kmh['100'], 2)} s`);
  if (LD.aspiration) L.push(`aspiration pleine : pointe ${nb(LD.aspiration.pointeAspirationPleine_kmh, 1)} km/h ; 200→280 km/h ${nb(LD.aspiration.reprise200a280_libre_s, 2)} s libre, ${nb(LD.aspiration.reprise200a280_aspire_s, 2)} s aspiré`);
  titre('Freinages (pédale pleine sauf mention)');
  L.push(col('essai', 30) + col('distance', 11) + col('temps', 9) + col('décél. maxi', 13) + col('moyenne', 10) + 'blocage (indicateur)');
  for (const [nom, t] of Object.entries(LD.freinages)) for (const [k, f] of Object.entries(t))
    L.push(col(nom === 'pedale' ? k : nom + ' ' + k, 30) + col(nb(f.distance_m, 1) + ' m', 11) + col(nb(f.temps_s, 2) + ' s', 9) + col(nb(f.decelMax_g, 2) + ' g', 13) + col(nb(f.decelMoyenne_g, 2) + ' g', 10) + nb(f.blocageMax, 2));
  if (LD.freinMoteur) L.push('frein moteur seul (pied levé) : ' + Object.entries(LD.freinMoteur.decel_g).map(([v, g]) => v + ' km/h ' + nb(g, 2) + ' g').join(' · ') + ` · 300→200 km/h en ${nb(LD.freinMoteur.distance300a200_m, 0)} m`);
  titre('Virages établis (voiture seule, aire d’essai, virage à droite) : vitesse tenue, puis limite d’adhérence traînée compensée');
  L.push(col('R (m)', 7) + col('v tenue', 9) + col('a_y', 8) + col('gaz', 6) + col('volant', 8) + col('braquage', 10) + col('L/R', 7) + col('β caisse', 10) + col('α av/ar', 12) + col('K (°/g)', 9) + col('dβ/da_y', 9) + col('v adhérence', 13) + col('a_y', 10) + col('nominal', 9) + 'v réf. rivaux');
  for (const v of Object.values(R.virages.etablis)) L.push(col(nb(v.R, 0), 7) + col(nb(v.vLimite_kmh, 1), 9) + col(nb(v.ayLimite_g, 2) + ' g', 8) + col(nb(v.gazLimite, 2), 6) + col(nb(v.volantLimite, 2), 8) + col(nb(v.braquageLimite_deg, 2) + '°', 10) +
    col(nb(v.braquageCinematique_deg, 2) + '°', 7) + col(nb(v.betaLimite_deg, 2) + '°', 10) + col(nb(v.deriveAvLimite_deg, 1) + '/' + nb(v.deriveArLimite_deg, 1) + '°', 12) + col(nb(v.sousVirage_deg_par_g, 2), 9) + col(nb(v.deriveCaisse_deg_par_g, 2), 9) +
    col((v.adherenceBornee ? '≥ ' : '') + nb(v.vAdherence_kmh, 1), 13) + col((v.adherenceBornee ? '≥ ' : '') + nb(v.ayAdherence_g, 2) + ' g', 10) + col(nb(v.capaciteNominale_g, 2) + ' g', 9) + nb(v.vRefRivaux_kmh, 0) + ' (' + nb(v.vRefSurVLimite * 100, 0) + ' % de la tenue)');
  if (R.virages.mouille) {
    L.push('mouillé (eau 0,75), v tenue R 30 / 120 / 500 : ' + Object.entries(R.virages.mouille).map(([k, t]) => k + ' ' + Object.values(t).map(x => nb(x, 0)).join('/')).join(' · '));
    L.push(`symétrie R 120 à gauche ${nb(R.virages.symetrieGaucheR120_kmh, 2)} km/h · voiture abîmée au maximum R 120 ${nb(R.virages.voitureAbimeeR120_kmh, 1)} km/h`);
    L.push('R 120 selon l’eau 0 / 0,2 / 0,47 / 0,75 / 1 : ' + Object.entries(R.virages.pneusSelonEauR120_kmh).map(([p, t]) => p + ' ' + EAUX.map(w => nb(t[w], 0)).join('/')).join(' · '));
    titre('Vitesse tenue sur vraie piste selon la commande (|d| < 2 m) : km/h, part de la voiture seule, appuis de volant par seconde au clavier');
    L.push(col('condition', 16) + col('R', 6) + QUATRE.map(e => col(e, 22)).join(''));
    for (const [k, t] of Object.entries(R.virages.commandes)) for (const [r, u] of Object.entries(t))
      L.push(col(k, 16) + col(r, 6) + QUATRE.map(e => col(u[e] ? nb(u[e].vLimite_kmh, 1) + ' (' + nb(u[e].surPhysiqueLarge * 100, 0) + ' %)' + (e === 'clavier' ? ' ' + nb(u[e].frappesParS, 1) + '/s' : '') : '—', 22)).join(''));
    L.push(`clavier lent (appuis tenus 0,1 s) R 120 : ${nb(R.virages.clavierLentR120_kmh, 1)} km/h`);
    if (R.virages.aideSeule) L.push('aide « Légère » seule (voiture seule, même pilote) : ' + Object.entries(R.virages.aideSeule).map(([k, t]) =>
      k + ' ' + Object.entries(t).map(([r, u]) => 'R ' + r + ' ' + nb(u.sansAide_kmh, 1) + ' → ' + nb(u.avecAide_kmh, 1) + ' (' + nb(u.rapport == null ? null : u.rapport * 100, 1) + ' %)').join(', ')).join(' · '));
  }
  titre('Échelon de volant (gaz figé ; régime établi pris entre 1 et 1,5 s)');
  L.push(col('v / entrée', 36) + col('volant', 7) + col('t90 vol.', 10) + col('t90 lacet', 11) + col('pic', 8) + col('dépass.', 9) + col('ζ', 6) + col('±5 %', 8) + col('a_y', 8) + col('β', 8) + col('TB (s·°)', 10) + 'perte à 1,5 s');
  for (const [v, t] of Object.entries(R.echelon)) for (const [k, e] of Object.entries(t))
    L.push(col(v + ' km/h ' + k, 36) + col(nb(e.amplitude, 2), 7) + (e.teteAQueue ? 'tête-à-queue' : col(nb(e.volantT90_ms, 0) + ' ms', 10) + col(nb(e.lacetT90_ms, 0) + ' ms', 11) + col(nb(e.lacetPic_ms, 0), 8) + col(nb(e.depassement_pct, 1) + ' %', 9) + col(nb(e.amortissement, 2), 6) + col(nb(e.etabli5pc_ms, 0), 8) + col(nb(e.ay_g, 2) + ' g', 8) + col(nb(e.beta_deg, 2) + '°', 8) + col(nb(e.TB_sdeg, 2), 10) + nb(e.perteVitesse15s_kmh, 1) + ' km/h'));
  const bo = (nom, t) => { for (const [a, x] of Object.entries(t)) L.push(col(nom + ' aide ' + a, 28) + col('lacet ×' + nb(x.lacet05_sur_lacet0, 3), 14) + col('courbure ×' + nb(x.courbure05_sur_courbure0, 3), 17) + col('β +' + nb(x.hausseBeta_deg, 2) + '°', 11) + col('vers l’int. ' + nb(x.ecartInterieur1s_m, 2) + ' m', 20) + col('décél. ' + nb(x.decel1s_g, 2) + ' g', 14) + (x.teteAQueue ? 'TÊTE-À-QUEUE' : '')); };
  const bf = (t) => { for (const [k, u] of Object.entries(t)) L.push(col(k, 16) + QUATRE.map(e => col(u[e] ? (u[e].teteAQueue ? 'tête-à-queue' : 'écart ' + nb(u[e].ecartMax_m, 2) + ' β+' + nb(u[e].hausseBetaMax_deg, 1) + '°' + (u[e].herbe_s > 0 ? ' herbe' : '')) : '—', 24)).join('')); };
  if (R.leverDePied) {
    titre('Lever de pied en appui (0,95 × v tenue ; volant figé, puis pilote qui tient la ligne), après 0,5 s');
    for (const [r, t] of Object.entries(R.leverDePied.boucleOuverte)) bo('R ' + r, t);
    L.push('boucle fermée R 120 (vraie piste, 0,95 × limite de la chaîne) :'); L.push(col('', 16) + QUATRE.map(e => col(e, 24)).join('')); bf(R.leverDePied.boucleFermeeR120);
    titre('Remise des gaz (0,92 × limite)');
    for (const [r, t] of Object.entries(R.remiseDesGaz.boucleOuverte)) bo('R ' + r + ' volant figé', t);
    L.push(col('sortie de virage', 30) + QUATRE.map(e => col(e, 30)).join(''));
    for (const [r, t] of Object.entries(R.remiseDesGaz.sortie)) for (const [k, u] of Object.entries(t)) for (const [va, w] of Object.entries(u))
      L.push(col('R ' + r + ' ' + k + ' ' + (va === 'progressif' ? 'progressif' : va + '°'), 30) + QUATRE.map(e => col(!w[e] ? '—' : w[e].teteAQueue ? 'tête-à-queue' : nb(w[e].temps_s, 2) + ' s β' + nb(w[e].betaMax_deg, 1) + '° d' + nb(w[e].ecartMax_m, 1) + (w[e].herbe_s > 0 ? ' herbe' : ''), 30)).join(''));
    titre('Freinage en appui R 120 (0,9 × limite)');
    for (const [f, t] of Object.entries(R.freinageEnAppui.boucleOuverteR120)) bo('pédale ' + f, t);
    L.push('boucle fermée, pédale pleine (vraie piste) :'); L.push(col('', 16) + QUATRE.map(e => col(e, 24)).join('')); bf(R.freinageEnAppui.boucleFermeeR120);
  }
  if (R.chicane) {
    titre('Chicane R 50 (vitesse de passage km/h, chrono s) et slalom R 40 (vitesse tenue km/h, chrono s)');
    L.push(col('condition', 16) + QUATRE.map(e => col(e, 22)).join('') + ' | ' + QUATRE.map(e => col(e, 16)).join(''));
    for (const k of TOUTES) L.push(col(k, 16) + QUATRE.map(e => col(nb(R.chicane[k][e].vPassage_kmh, 1) + ' · ' + nb(R.chicane[k][e].temps_s, 3), 22)).join('') + ' | ' +
      QUATRE.map(e => col(nb(R.slalom[k][e].v_kmh, 1) + ' · ' + nb(R.slalom[k][e].temps_s, 2), 16)).join(''));
  }
  titre('Dérive chargée sur un cercle (approche à 95 % de la limite de la chaîne ; après le lâcher, pied levé)');
  L.push(col('R / entrée', 24) + col('v entrée', 9) + col('paliers I/II/III (s)', 21) + col('charge', 8) + col('β moy./maxi', 13) + col('|d| maxi', 9) + col('turbo', 18) + col('stable après', 13) + col('contre', 8) + 'fin');
  const lDer = (nom, d) => L.push(col(nom, 24) + col(nb(d.vEntree_kmh, 0), 9) + (d.approcheImpossible ? 'approche impossible' : d.departRefuse ? 'départ refusé' : col(d.niveaux.map(x => nb(x, 2)).join('/'), 21) + col(nb(d.chargeMax, 2), 8) + col(nb(d.betaMoy_deg, 1) + '/' + nb(d.betaMax_deg, 1) + '°', 13) + col(nb(d.ecartMax_m, 2), 9) +
    col(d.turbo ? 'III'.slice(0, d.turbo.niveau) + ' ' + nb(d.turbo.duree_s, 1) + ' s' + (d.turbo.parfait ? ' parfait' : '') : 'aucun', 18) + col(nb(d.stableApres_s, 2) + ' s', 13) + col(nb(d.contreDepassement_deg, 1) + '°', 8) +
    (d.teteAQueue ? 'tête-à-queue ' + d.teteAQueue : d.annulee ? 'annulée (' + (d.annulation ? d.annulation.surface + ', d ' + nb(d.annulation.ecart_m, 1) + ', perte ' + nb(d.annulation.perte, 2) : '?') + ')' : 'lâchée')));
  for (const [r, t] of Object.entries(R.derive.tenue)) for (const [e, d] of Object.entries(t)) lDer('R ' + r + ' ' + e, d);
  if (R.derive.mouille) for (const [k, t] of Object.entries(R.derive.mouille)) for (const [r, u] of Object.entries(t)) for (const [e, d] of Object.entries(u)) lDer(k.replace('mouille-', '') + ' R' + r + ' ' + e, d);
  if (R.derive.tenable) {
    L.push('durée tenable, dérive gardée jusqu’à 10 s (s ; « annulée » : perte de contrôle ou fin de virage) :');
    for (const [r, t] of Object.entries(R.derive.tenable)) L.push('  R ' + col(r, 5) + QUATRE.map(e => col(e + ' ' + (t[e] ? nb(t[e].tenue_s, 2) + (t[e].teteAQueue ? ' tête-à-queue' : t[e].annulee ? ' annulée' : '') + ' |d|' + nb(t[e].ecartMax_m, 1) : '—'), 30)).join(''));
  }
  if (R.derive.gain) {
    titre('Gain de la dérive sur un demi-tour, puis sortie en ligne droite (s ; > 0 : la dérive et son turbo vont plus vite)');
    L.push(col('R / entrée', 24) + col('v appr.', 9) + col('adhérence', 14) + col('dérive', 10) + col('gain', 9) + col('turbo', 9) + col('+km/h en 1 s', 14) + col('contre', 8) + col('stable', 9) + 'échec');
    const lg = (nom, g) => L.push(col(nom, 24) + (!g ? '—' : col(nb(g.vApproche_kmh, 0), 9) + col(nb(g.adherence_s, 3) + ' (' + nb(g.fractionAdherence, 2) + ')', 14) + col(nb(g.derive_s, 3), 10) + col(nb(g.gain_s, 3), 9) + col(g.turbo ? 'T' + g.turbo.niveau + (g.turbo.parfait ? ' p' : '') : '—', 9) +
      col(nb(g.gain1sApresLacher_kmh, 1), 14) + col(nb(g.contreDepassement_deg, 1) + '°', 8) + col(nb(g.stableApres_s, 2), 9) + (g.deriveEchec || (g.deriveAnnulee ? 'annulée' : g.deriveTenue ? '' : 'non tenue'))));
    for (const [r, t] of Object.entries(R.derive.gain)) for (const e of QUATRE) lg('R ' + r + ' ' + e, t[e]);
    for (const [k, t] of Object.entries(R.derive.gainMouille)) for (const [e, g] of Object.entries(t)) lg('R 80 ' + k.replace('mouille-', '') + ' ' + e, g);
  }
  titre('Sortie dans l’herbe (le centre 3 m dedans, 1,5 s) et retour, vitesse gardée au régulateur');
  L.push(col('v / condition', 24) + QUATRE.map(e => col(e, 36)).join(''));
  for (const [v, t] of Object.entries(R.herbe)) for (const [k, u] of Object.entries(t))
    L.push(col(v + ' ' + k, 24) + Object.keys(u).map(e => col(u[e].teteAQueue ? 'tête-à-queue' : 'perd ' + nb(u[e].tempsPerdu_s, 2) + ' s, ' + nb(u[e].herbe_s, 1) + ' s dedans, β' + nb(u[e].betaMaxRetour_deg, 1) + '°', 36)).join(''));
  if (out.resultatsP10) tableauP10(out, L, titre);
  return L.join('\n');
}
// Essais du lot 17 (17-CONDUITE.md § 5) ; « capacité » : la demande d'un essieu atteint ce qu'il peut transmettre.
function tableauP10(out, L, titre) {
  const T = out.resultatsP10;
  titre(`Essais du lot 17 — empreinte ${out.empreinteP10.slice(0, 16)}`);
  L.push(col('freinage, pédale tenue', 26) + col('distance', 11) + col('temps', 9) + col('essieu à la capacité le 1er', 29) + 'à (km/h) avant / arrière');
  for (const [k, f] of Object.entries(T.freinageBlocage)) L.push(col(k, 26) + col(nb(f.distance_m, 1) + ' m', 11) + col(nb(f.temps_s, 2) + ' s', 9) + col(f.premier || 'aucun', 29) + nb(f.vBlocageAv_kmh, 0) + ' / ' + nb(f.vBlocageAr_kmh, 0));
  const D = T.depart, d0 = D.sansAide;
  L.push(`départ plein gaz, aide 0 : sollicitation arrière maxi ${nb(d0.sollicitationArMax, 2)}, à la capacité ${nb(d0.patinage_s, 2)} s, 0-100 ${nb(d0.t100_s, 2)} s, régime mini sur 0,5 s ${nb(d0.regimeMin05s, 0)} tr/min · Légère : 0-100 ${nb(D.legere.t100_s, 2)} s · meilleur départ dosé ${D.dose ? nb(D.dose.t100_s, 2) + ' s (gaz ' + nb(D.dose.gaz, 1) + ')' : '—'}`);
  for (const [v, t] of Object.entries(T.echelon)) for (const [m, e] of Object.entries(t))
    L.push(col('échelon ' + v + ' km/h ' + m, 26) + (e.teteAQueue ? 'tête-à-queue' : `t90 lacet ${nb(e.lacetT90_ms, 0)} ms · dépassement ${nb(e.depassement_pct, 1)} % · a_y ${nb(e.ay_g, 2)} g · β ${nb(e.beta_deg, 2)}°`));
  for (const [k, e] of Object.entries(T.echelonAucune)) L.push(col('échelon ' + k + ', manette Aucune', 26) + (e.teteAQueue ? 'tête-à-queue' : `t90 lacet ${nb(e.lacetT90_ms, 0)} ms · dépassement ${nb(e.depassement_pct, 1)} %`));
  L.push('limite d’adhérence : ' + Object.entries(T.limiteEssieux).map(([r, x]) => !x ? 'R ' + r + ' —' : `R ${r} par l’${x.limitePar} (x av/ar ${nb(x.xAv, 2)}/${nb(x.xAr, 2)}, réserve ar ${nb(x.reserveAr * 100, 1)} %)`).join(' · '));
  for (const [k, p] of Object.entries(T.pleinGaz)) L.push(`plein gaz en appui ${k} (rapport ${p.rapport}, aide 0) : x_ar maxi ${nb(p.xArMax, 2)} (dérive arrière ${nb(p.deriveArMax_deg, 1)}°)${p.teteAQueue ? ', tête-à-queue' : ''}`);
  for (const [k, h] of Object.entries(T.deuxRouesHerbe)) L.push(!h ? `deux roues dans l’herbe ${k} : —` : `deux roues dans l’herbe ${k} (centre visé à ${nb(h.decalage_m, 2)} m, ${nb(h.v_kmh, 1)} km/h = 0,9 × la limite sur piste large) : capacité × ${nb(h.capaciteRelative, 3)} ; β à l’entrée ${nb(h.betaEntree_deg, 2)}° ; écart final ${nb(h.ecartFin_m, 2)} m${h.centreDansLHerbe_s > 0 ? ', centre dans l’herbe ' + nb(h.centreDansLHerbe_s, 2) + ' s' : ''}${h.teteAQueue ? ', tête-à-queue' : ''}`);
  for (const [k, b] of Object.entries(T.vibreur)) L.push(`vibreur à ${k} km/h : capacité × ${nb(b.rouesSurVibreur, 3)} (roues d’un côté dessus), × ${nb(b.centreSurVibreur, 3)} (centre dessus)`);
  for (const [k, s] of Object.entries(T.sillage)) L.push(`sillage ${k} (part ${nb(s.part, 2)}) : ${nb(s.derriere_kmh, 1)} km/h contre ${nb(s.seul_kmh, 1)} seul, × ${nb(s.rapport, 4)}`);
  L.push(col('x_ar en dérive (p10/p50/p90)', 30) + ['physique', 'manette', 'clavier'].map(e => col(e, 24)).join(''));
  for (const [r, t] of Object.entries(T.deriveXar)) L.push(col('R ' + r, 30) + ['physique', 'manette', 'clavier'].map(e => col(t[e] && t[e].xAr ? nb(t[e].xAr.p10, 2) + '/' + nb(t[e].xAr.p50, 2) + '/' + nb(t[e].xAr.p90, 2) + (t[e].turbo ? ' T' + t[e].turbo.niveau + (t[e].turbo.parfait ? 'p' : '') : '') : '—', 24)).join(''));
  for (const [e, x] of Object.entries(T.tenueLongue.R80)) L.push(`dérive tenue 10 s, R 80, ${e} : ${!x || x.departRefuse ? 'départ refusé' : 'tenue ' + nb(x.tenue_s, 1) + ' s' + (x.annulee ? ' (annulée)' : '') + ', turbo ' + (x.turbo ? 'T' + x.turbo.niveau : 'aucun') + ', perte de 3 à 6 s ' + nb(x.perte3a6s_kmh, 1) + ' km/h'}`);
  L.push(`régime × vPointe / v (départ plein gaz) : p10 ${nb(T.regime.p10, 0)} · p50 ${nb(T.regime.p50, 0)} · p90 ${nb(T.regime.p90, 0)}`);
  const F = T.freinMoteur;
  L.push(`frein moteur à 10 000 tr/min : 2e ${nb(F['2'].freinMoteur_N, 0)} N (${nb(F['2'].kmh, 0)} km/h), 6e ${nb(F['6'].freinMoteur_N, 0)} N (${nb(F['6'].kmh, 0)} km/h), rapport 2e/6e ${nb(F.rapport2sur6, 2)}`);
  const aq = x => !x ? '—' : (x.bornee ? '≥ ' : '') + nb(x.kmh, 1);
  L.push(`eau 1, R 500 (traînée compensée) : slicks ${aq(T.eau.aquaplanageR500.slicks)} km/h, pluie ${aq(T.eau.aquaplanageR500.pluie)} · neige 1, R 120 : slicks ${nb(T.eau.neigeR120.slicks, 1)}, pluie ${nb(T.eau.neigeR120.pluie, 1)} km/h`);
  tableauRivaux(T.rivaux, L);
}
function tableauRivaux(r, L) {
  L.push(`profil des rivaux : ajustement a_y = μ·g + μ·A·v² sur ${r.points} rayons → μ_eq ${nb(r.muEq, 3)}, A_eq ${nb(r.aeroEq * 1e5, 1)}e-5 (référence actuelle des rivaux : 1,55 et 155e-5)`);
  L.push(col('R (m)', 8) + col('v adhérence', 13) + col('v réf. rivaux', 15) + col('réf./adh.', 11) + col('v ajustée', 11) + 'ajustée/adh.');
  for (const x of r.rayons) L.push(col(nb(x.R, 0), 8) + col((x.borne ? '≥ ' : '') + nb(x.vAdherence_kmh, 1), 13) + col(nb(x.vRefRivaux_kmh, 1), 15) + col(nb(x.refSurAdherence, 3), 11) + col(nb(x.vAjuste_kmh, 1), 11) + nb(x.ajusteSurAdherence, 3));
}

// ---------------------------------------------------------------- ligne de commande
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = n => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true; };
  const r = opt('regler'), reglages = typeof r !== 'string' ? null : r.trim().startsWith('{') ? JSON.parse(r)
    : Object.fromEntries(r.split(',').map(x => x.split('=').map(y => y.trim())).map(([k, v]) => [k, Number(v)]));
  if (opt('script-page')) { writeFileSync(opt('script-page'), scriptPage()); console.log('script écrit : ' + opt('script-page')); process.exit(0); }
  if (opt('rivaux')) {
    // profil des rivaux seul : vitesses d'adhérence de R 20 à R 400 et ajustement (μ_eq, A_eq) pour circuit.js
    const ctx = charger(opt('src') || SRC, reglages), r = profilRivaux(ctx, CONDITIONS.sec), L = [];
    tableauRivaux(r, L); console.log(L.join('\n'));
    if (opt('json')) writeFileSync(opt('json'), JSON.stringify({ empreinteSources: ctx.empreinteSources, reglagesPARAMS: reglages, rivaux: arrondir(r) }, null, 1) + '\n');
    process.exit(0);
  }
  if (opt('verifier-page')) {
    // sortie de tools/page-essai.mjs sur le script ci-dessus, comparée au sous-ensemble court sous Node
    const page = JSON.parse(readFileSync(opt('verifier-page'), 'utf8')), node = executer({ src: opt('src') || SRC, court: true });
    if (typeof page.valeur !== 'string') { console.log('page : pas de résultat', JSON.stringify(page).slice(0, 400)); process.exit(1); }
    const e = createHash('sha256').update(page.valeur).digest('hex'), ctxN = charger(opt('src') || SRC), brutN = JSON.parse(JSON.stringify(mesurer(ctxN, { court: true })));
    let n = 0, differents = 0, pire = 0, autres = [];
    const comparer = (a, b, ch) => {
      if (typeof a === 'number' && typeof b === 'number') { n++; if (a !== b) { differents++; pire = Math.max(pire, Math.abs(a - b) / Math.max(Math.abs(b), 1e-12)); } }
      else if (a && b && typeof a === 'object' && typeof b === 'object') for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) comparer(a[k], b[k], ch + '.' + k);
      else if (a !== b) autres.push(ch);
    };
    comparer(JSON.parse(page.valeur), brutN, '');
    const ok = !autres.length && pire < 1e-9;
    console.log(`page ${e.slice(0, 16)} · Node ${node.empreinte.slice(0, 16)}${e === node.empreinte ? ' : mêmes nombres au bit près' : ''}`);
    console.log(`${n} nombres comparés, ${differents} diffèrent au dernier chiffre, écart relatif maxi ${pire.toExponential(2)}${autres.length ? ', valeurs non numériques différentes : ' + autres.slice(0, 5).join(' ') : ''} → ${ok ? 'même modèle' : 'MODÈLES DIFFÉRENTS'}${page.erreurs && page.erreurs.length ? ' · erreurs de la page : ' + page.erreurs.length : ''}`);
    process.exit(ok ? 0 : 1);
  }
  const t0 = Date.now(), out = executer({ src: opt('src') || SRC, court: !!opt('court'), reglages });
  out.calcul = { duree_s: (Date.now() - t0) / 1000, node: process.version };
  console.log(tableau(out));
  console.log(`\n(calcul ${nb(out.calcul.duree_s, 1)} s)${out.empreinteP10 ? ' · empreinte des essais du lot 17 ' + out.empreinteP10.slice(0, 16) : ''}`);
  if (opt('json')) writeFileSync(opt('json'), JSON.stringify(out, null, 1) + '\n');
}
