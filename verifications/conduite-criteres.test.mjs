// Banc des critères de conduite de la phase 2.
// Les essais restent déterministes et exécutables par Node, sans navigateur.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { B, CD, P, G, DT, deg, clamp, circuit, commande, piloter, rouler, tenir, vRef, vLimite } from './phase2/outils.mjs';

const ici = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
// Le banc de conduite utilise aussi l'aspiration et les contacts du vrai module de course.
req(path.join(ici, '..', 'src', 'course.js'));

const resultats = [];
function noter(nom, valeur, cible, ok, info = '', options = {}) {
  const texte = typeof valeur === 'number' ? (Number.isFinite(valeur) ? valeur.toFixed(Math.abs(valeur) >= 100 ? 0 : 3) : '∞') : String(valeur);
  const obligatoire = options.obligatoire !== false;
  resultats.push({ nom, ok: !!ok, obligatoire });
  const marque = ok ? 'ok ' : (obligatoire ? 'KO ' : 'mesure ');
  console.log(`${marque}${nom} : ${texte} (cible ${cible})${info ? ' — ' + info : ''}`);
}

const courbure = et => et.omega / Math.max(et.v, 1);

// Approche stabilisée S1/S2 : six secondes d'adhérence, jamais un bouton pressé à froid.
function approche(R, options = {}) {
  const c = circuit({ R, largeur: options.largeur ?? 12, limite: options.limite ?? 20 });
  const v = options.v ?? vRef(R);
  const et = CD.creer(0, 0); et.v = v;
  const cmd = commande();
  rouler(et, c, cmd, options.duree ?? 6, (e, k) => piloter(e, c, v, k));
  return { c, et: structuredClone(et), v };
}

function vitesseLimite(R) { return vLimite(R); }

// S4 : perturbation indépendante du critère de motricité, puis réponse après 0,3 s.
function coupGlisse(contre) {
  const vl = vitesseLimite(120), { et, c, cmd } = tenir(120, vl * .98, 8);
  const b0 = et.beta, vol = cmd.volant, gaz = cmd.gaz;
  et.beta += .2; et.omega += .6;
  const k = commande({ volant: vol, gaz });
  let t0 = -1, tq = false, bMax = 0, dMin = 0;
  rouler(et, c, k, 4, (e, q, t) => {
    if (t0 < 0 && e.beta - b0 > 4 / deg) t0 = t;
    if (contre && t0 >= 0 && t >= t0 + .3) q.volant = clamp(vol - 2.5 * (e.beta - b0), -1, 1);
    bMax = Math.max(bMax, Math.abs(e.beta)); dMin = Math.min(dMin, e.d);
    tq ||= Math.abs(e.beta) > Math.PI / 2;
  });
  return { t0, tq, bMax, dMin, beta: Math.abs(et.beta) };
}

// Pire cas de glisse provoquée pour les critères « sans aide / avec aide ».
function forteGlisse(aide) {
  const vl = vitesseLimite(120), { et, c, cmd } = tenir(120, vl * .9, 6);
  et.beta = .35; et.omega += .6;
  let bMax = 0, bFin = 0, tq = false;
  rouler(et, c, commande({ volant: cmd.volant, gaz: 1, aide }), 4, e => {
    bMax = Math.max(bMax, Math.abs(e.beta)); bFin = Math.abs(e.beta);
    tq ||= Math.abs(e.beta) > Math.PI / 2;
  });
  return { bMax, bFin, tq };
}

function tracker(hz) {
  const n = Math.round(120 / hz), h = n * DT, beta = [];
  return {
    add(e, i) { if (i % n === 0) beta.push(e.beta); },
    max() {
      let m = 0;
      for (let i = 2; i < beta.length; i++) m = Math.max(m, Math.abs(beta[i] - 2 * beta[i - 1] + beta[i - 2]) / (h * h));
      return m * deg;
    }
  };
}

// S5 : commandes tout-ou-rien lues à la cadence d'image, sur la piste de 12 m.
function essaiClavier(depart, profil, impulsion, hz, suivi) {
  const { c } = depart, et = structuredClone(depart.et), pasN = 120 / hz;
  const cmd = commande({ guidage: .15, aide: .35, derive: true });
  let t = 0, i = 0, dMax = 0, annule = false, n3 = -1, depart0 = -1, prochaine = 0;
  while (t < 5) {
    suivi?.add(et, i);
    if (i % pasN === 0) {
      const dr = et.derive;
      if (!dr.actif && depart0 < 0) { cmd.volant = 1; cmd.gaz = 1; }
      else if (dr.actif && t >= prochaine) {
        const s = dr.sens || 1, dn = s * et.d, vn = s * et.v * Math.sin(et.psi);
        const u = -profil.a - profil.kd * dn - profil.kv * vn;
        cmd.volant = u < -profil.seuil ? -s : (u > profil.seuil ? s : 0);
        cmd.gaz = profil.g[0] + profil.g[1] * dn + profil.g[2] * vn > .5 ? 1 : 0;
        prochaine = t + impulsion - 1e-9;
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
  return { ok: n3 >= 0 && !annule && dMax < 5.5, n3: n3 < 0 ? -1 : n3 - depart0, annule, dMax };
}

const grilleClavier = [];
for (const a of [0, .5, 1]) for (const kd of [.1, .3, .6]) for (const kv of [0, .1, .3]) for (const seuil of [.2, .5])
  for (const g of [[1, 0, 0], [1, .3, .3], [.5, .5, .5]]) grilleClavier.push({ a, kd, kv, seuil, g });

function mesurerClavier(dep, impulsion, hz, suivi) {
  let mieux = null, ok = 0, pireLissage = 0;
  for (const profil of grilleClavier) {
    const local = suivi || tracker(hz);
    const r = essaiClavier(dep, profil, impulsion, hz, local);
    pireLissage = Math.max(pireLissage, local.max());
    if (r.ok) ok++;
    const note = r.ok ? 100 - r.dMax : (r.n3 >= 0 ? 50 - r.dMax : (r.annule ? 0 : 10));
    if (!mieux || note > mieux.note) mieux = { note, profil, r };
  }
  return { ok, mieux, lissage: pireLissage };
}

function paliers() {
  const dep = approche(120), c = dep.c, cibles = [.7, 1.3, 2.1];
  let meilleur = null, pireLissage = 0;
  for (const ti of [.45, .7, 1]) for (const tau of [0, .05, .1, .15, .2]) for (const q of [.25, .4, .5, .6, .75]) {
    const et = structuredClone(dep.et), cmd = commande({ derive: true });
    const suivi = tracker(120);
    let t = 0, depart0 = -1, annule = false, dMax = 0, phase = 0;
    const niveaux = [-1, -1, -1];
    while (t < 5) {
      suivi.add(et, Math.round(t / DT));
      if (depart0 < 0 || phase === 1) { cmd.volant = ti; cmd.gaz = 1; if (depart0 >= 0 && t - depart0 >= tau) phase = 2; }
      else { cmd.volant = -(et.derive.sens || 1) * q; cmd.gaz = 1; }
      for (const e of CD.pas(et, cmd, c, DT)) {
        if (e.type === 'derive' && depart0 < 0) { depart0 = t; phase = 1; }
        if (e.type === 'deriveAnnulee') annule = true;
        if (e.type === 'niveau' && e.niveau <= 3 && niveaux[e.niveau - 1] < 0) niveaux[e.niveau - 1] = t - depart0;
      }
      if (depart0 >= 0) dMax = Math.max(dMax, Math.abs(et.d));
      if (annule || niveaux[2] >= 0) break;
      t += DT;
    }
    if (annule || dMax >= 5.5 || niveaux.some(x => x < 0)) continue;
    const ecart = Math.max(...niveaux.map((x, i) => Math.abs(x - cibles[i])));
    pireLissage = Math.max(pireLissage, suivi.max());
    if (!meilleur || ecart < meilleur.ecart) meilleur = { ti, tau, q, niveaux, ecart, dMax };
  }
  return { meilleur, lissage: pireLissage };
}

// S7 : piste réelle, droite d'approche, demi-tour, puis sortie. Aucun frein ne coupe le turbo.
function gainR80() {
  const R = 80, arc = Math.PI * R, avant = 150, fin = avant + arc + 200;
  const vl = vLimite(R);
  // vLimite() utilise son propre circuit d'essai et laisse B.circuit sur ce stub : recréer la piste ensuite.
  const c = circuit({ R, arc, avant, largeur: 12, limite: 20 });
  const depart = () => { const e = CD.creer(0, 0); e.v = vl; return e; };
  const tour = (derive) => {
    const et = depart(), cmd = commande({ derive: false }); let t = 0, depart0 = -1, turbo3 = false;
    while (et.s < fin && t < 30) {
      const enVirage = et.s >= avant && et.s < avant + arc - 2;
      piloter(et, c, enVirage ? vl * .98 : (et.s < avant ? vl : 90), cmd);
      if (derive && enVirage) {
        cmd.derive = true; cmd.gaz = 1; cmd.frein = 0;
        if (et.derive.actif) {
          const s = et.derive.sens || 1, dn = s * et.d, vn = s * et.v * Math.sin(et.psi);
          cmd.volant = s * clamp(-.5 - .35 * dn - .2 * vn, -1, -.2);
          cmd.gaz = clamp(1 + .25 * dn + .25 * vn, 0, 1);
        } else cmd.volant = Math.max(cmd.volant, .45);
      } else {
        cmd.derive = false;
        if (et.turbo.reste > 0) { cmd.frein = 0; cmd.gaz = 1; }
      }
      for (const e of CD.pas(et, cmd, c, DT)) {
        if (e.type === 'derive') depart0 = t;
        if (e.type === 'turbo' && e.niveau === 3) turbo3 = true;
      }
      t += DT;
    }
    return { t, turbo3, depart0 };
  };
  const ref = tour(false), drift = tour(true);
  return { ref, drift, gain: ref.t - drift.t };
}

// S10 poids, S11 équilibre.
for (const v0 of [86, 92]) {
  const et = CD.creer(0, 0); et.v = v0; et.rapport = 6; let avant = null, arme = false;
  for (let i = 0; i < 300 && avant === null; i++) {
    CD.pas(et, commande({ frein: 1 }), circuit(), DT);
    if (arme) avant = et.chargeAv;
    arme = et.chargeX <= -3 * G;
  }
  noter(`S10 charge avant à −3 g depuis ${v0} m/s`, avant ?? 0, '≥ 0,60', avant !== null && avant >= .6);
}
{
  const c = circuit(), et = CD.creer(0, 0); et.v = 20; et.rapport = 2; let mini = 1;
  rouler(et, c, commande({ gaz: 1, boite: 'manuelle' }), 1, e => { mini = Math.min(mini, e.chargeAv); });
  noter('S10 charge vers l’arrière en accélération 2e', mini, '< répartition', mini < P.repartition);
}
{
  const c = circuit(), charge = cy => { const et = CD.creer(0, 0); et.v = 50; et.chargeY = cy; CD.pas(et, commande({ gaz: .3 }), c, DT); return et.capAv + et.capAr; };
  const ratio = charge(2 * G) / charge(0);
  noter('S10 transfert latéral : adhérence totale', ratio, '0,90 à 0,995', ratio >= .9 && ratio <= .995);
}
{
  const vl = vitesseLimite(120), { et, c, cmd } = tenir(120, vl * .98, 8), w0 = et.omega;
  rouler(et, c, commande({ volant: cmd.volant, gaz: 0 }), .5);
  noter('S3 lever de pied R120 : lacet après/avant', et.omega / w0, '≥ 1,05', et.omega / w0 >= 1.05);
}
{
  const vl = vitesseLimite(120), { et, c, cmd } = tenir(120, vl * .98, 8), k0 = courbure(et);
  rouler(et, c, commande({ volant: cmd.volant, frein: .3 }), .5);
  noter('S11 frein 0,3 entrée R120 : courbure après/avant', courbure(et) / k0, '≥ 1,05', courbure(et) / k0 >= 1.05);
}
{
  const pointe = r => P.vitessePointe[r - 1];
  const rayon = rap => { let lo = 20, hi = 300; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (.93 * vLimite(m) < .8 * pointe(rap)) lo = m; else hi = m; } return Math.round((lo + hi) / 2); };
  // Lot 17B (docs/reprise/17-CONDUITE.md § 5) : la dérive arrière se compte en fois l'angle du pic de l'essieu (x_ar,
  // qui suit la charge en p10) et non plus en degrés : ≥ 1,25 × α_pic,ar au lieu de ≥ 6° (1,11 × le pic de p9).
  // Sur une conduite qui n'expose pas x_ar (p9), il se lit sur la dérive et le pic fixe.
  let maxAr = 0, details = [];
  for (const [rap, R] of [[2, rayon(2)], [3, rayon(3)], [3, 120]]) {
    const { et, c, cmd } = tenir(R, .93 * vLimite(R), 8, { rapport: rap }); let ar = 0, deg0 = 0;
    rouler(et, c, commande({ volant: cmd.volant, gaz: 1, boite: 'manuelle' }), 1.5, e => {
      const x = Number.isFinite(e.xAr) ? e.xAr : e.deriveAr / P.alphaAr;
      if (x > ar) { ar = x; deg0 = e.deriveAr * deg; }
    });
    maxAr = Math.max(maxAr, ar); details.push(`${rap}e/R${R} ${ar.toFixed(2)} × le pic (${deg0.toFixed(1)}°)`);
  }
  noter('S3 plein gaz 2e/3e : dérive arrière maximale, en fois le pic', maxAr, '≥ 1,25 pour un cas', maxAr >= 1.25, details.join(' · '));
}
{
  const sans = coupGlisse(false), avec = coupGlisse(true);
  noter('S4 coup de glisse : témoin tête-à-queue', sans.tq ? 'oui' : 'non', 'oui', sans.tq);
  noter('S4 contre-braquage après 0,3 s', avec.tq ? 'tête-à-queue' : 'rattrapée', 'rattrapée', sans.tq && withIn(avec.t0, 0, 1) && !avec.tq && avec.dMin > -8);
}
function withIn(x, a, b) { return x >= a && x <= b; }
{
  for (const aide of [0, .35, .7]) {
    const r = forteGlisse(aide);
    if (aide === 0) noter('S4 forte glisse sans aide : tête-à-queue', r.tq ? 'oui' : 'non', 'oui', r.tq);
    else noter(`S4 forte glisse avec aide ${aide}`, r.bFin * deg, '< 5° et sans tête-à-queue', !r.tq && r.bFin * deg < 5);
  }
}

// Direction : montée au pire régime de la voiture, retour, contre-braquage.
{
  const mesure = (v, depart, cible, sens) => { const et = CD.creer(0, 0); et.v = v; et.volant = depart; const c = circuit(), cmd = commande({ volant: cible, gaz: .5 });
    for (let i = 1; i <= 120; i++) { CD.pas(et, cmd, c, DT); if (sens === 'monte' ? et.volant >= .9 : et.volant <= .1) return i * DT * 1000; } return Infinity; };
  for (const v of [0, 86, 92]) {
    noter(`S9 clavier 0→90 % à ${Math.round(v * 3.6)} km/h`, mesure(v, 0, 1, 'monte'), '≤ 120 ms', mesure(v, 0, 1, 'monte') <= 120);
    noter(`S9 clavier relâché à ${Math.round(v * 3.6)} km/h`, mesure(v, 1, 0, 'retour'), '≤ 80 ms', mesure(v, 1, 0, 'retour') <= 80);
    noter(`S9 clavier contre à ${Math.round(v * 3.6)} km/h`, mesure(v, 1, -1, 'retour'), '≤ 30 ms', mesure(v, 1, -1, 'retour') <= 30);
  }
}
{
  let pire = 0, details = [];
  for (const [R, guidage] of [[0, 0], [150, .15], [300, .15]]) for (const kmh of [120, 200, 300]) {
    const c = circuit({ R }), et = CD.creer(0, 0); et.v = kmh / 3.6; et.rapport = 6; let cas = 0;
    rouler(et, c, commande({ volant: 1, gaz: .5, guidage }), 2, e => { cas = Math.max(cas, Math.abs(e.omega) / (CD.capaciteLaterale(e.v) / Math.max(e.v, 1))); });
    pire = Math.max(pire, cas); details.push(`${R || 'droit'}/${kmh}:${cas.toFixed(3)}`);
  }
  noter('S9 plein braquage : lacet / limite', pire, '≤ 1,2', pire <= 1.2, details.join(' · '));
}
{
  const b = CD.braquageMax(50);
  noter('S9 braquageMax exporté et borné', b, '> 0, monotone', b > 0 && b < .6 && CD.braquageMax(80) <= b && CD.braquageMax(20) >= b);
}

// Départ, pente, aspiration : critères explicitement absents de l'ancien banc sont portés ici.
{
  const c = circuit(), et = CD.creer(0, 0), cmd = commande({ gaz: 1 }); let minReg = Infinity, t100 = -1;
  for (let i = 0; i < 240; i++) CD.pas(et, cmd, c, DT, true);
  for (let i = 0; i < 1200; i++) { CD.pas(et, cmd, c, DT); const t = (i + 1) * DT; if (t <= .5 + 1e-9) minReg = Math.min(minReg, et.regime); if (t100 < 0 && et.v * 3.6 >= 100) t100 = t; }
  noter('S3 départ : régime dans les 0,5 s', minReg, '≥ 9 000 tr/min', minReg >= 9000);
  noter('S3 départ : 0–100 km/h', t100, '2,2 à 3,4 s', t100 >= 2.2 && t100 <= 3.4);
}
{
  const pointe = pente => { const c = circuit({ pente }), et = CD.creer(0, 0); rouler(et, c, commande({ gaz: 1 }), 60); return et.v; };
  const plat = pointe(0), monte = pointe(.06);
  const acc = pente => { const c = circuit({ pente }), et = CD.creer(0, 0); et.v = 30; et.rapport = 3; CD.pas(et, commande({ boite: 'manuelle' }), c, DT); return (et.v - 30) / DT; };
  noter('S3 pente 6 % : pointe / plat', monte / plat, '≤ 0,98', monte / plat <= .98);
  noter('S3 pente 6 % : écart g·sin(pente)', acc(0) - acc(.06), (G * Math.sin(Math.atan(.06))).toFixed(3) + ' ± 5 %', Math.abs(acc(0) - acc(.06) - G * Math.sin(Math.atan(.06))) <= .05 * G * Math.sin(Math.atan(.06)));
}
{
  const vrai = B.circuit;
  B.circuit = { echantillon: () => ({ x: 0, y: 0, z: 0, cap: 0, courbure: 0, pente: 0, devers: 0, ligne: 0, vitesse: 0 }), vibreurA: () => false, ecart: (c, a, b) => a - b };
  const c = { longueur: 1e6, largeur: 12, limite: 20 }, v0 = 250 / 3.6, cmd = commande({ gaz: 1 }), gain = (derriere, cote) => {
    const rival = CD.creer(1000, 0), suiveur = CD.creer(1000 - derriere, cote), seul = CD.creer(0, 0);
    for (const e of [rival, suiveur, seul]) { e.v = v0; e.rapport = 6; }
    const V = [{ etat: rival }, { etat: suiveur }];
    for (let i = 0; i < 480; i++) { B.course.aspirer(c, V); CD.pas(suiveur, cmd, c, DT); CD.pas(seul, cmd, c, DT); rival.s += v0 * DT; }
    return (suiveur.s - (1000 - derriere)) - seul.s;
  };
  const g10 = gain(10, 0), gCote = gain(10, 2.1);
  const part = (d, cote) => { const V = [{ etat: CD.creer(1000, 0) }, { etat: CD.creer(1000 - d, cote) }]; B.course.aspirer(c, V); return V[1].etat.aspiration; };
  noter('S3 aspiration à 10 m : gain en 4 s', g10, '≥ 3 m', g10 >= 3);
  noter('S3 aspiration hors couloir', gCote, 'nul', Math.abs(gCote) < .01 && part(29, 0) > 0 && part(30.5, 0) === 0 && part(10, 2.05) === 0);
  B.circuit = vrai;
}

// S5 clavier sur la piste réelle : au moins un pilote robuste pour chaque cadence.
{
  const dep = approche(120), essais = [];
  for (const impulsion of [.2, .1]) for (const hz of [30, 60, 120]) {
    const r = mesurerClavier(dep, impulsion, hz, null); essais.push(r);
    noter(`S5 clavier impulsions ${impulsion}s à ${hz} Hz`, r.ok, `${grilleClavier.length} dont au moins 1`, r.ok > 0,
      `meilleur palier ${r.mieux.r.n3 < 0 ? 'non' : r.mieux.r.n3.toFixed(2) + ' s'}, |d| ${r.mieux.r.dMax.toFixed(2)} m`);
  }
  const depMartel = approche(120), et = structuredClone(depMartel.et), cmd = commande({ derive: true }); let departs = 0;
  for (let i = 0; i < 3 * 120; i++) {
    const t = i * DT; piloter(et, depMartel.c, depMartel.v, cmd); cmd.derive = Math.floor(t / .1) % 2 === 0;
    for (const e of CD.pas(et, cmd, depMartel.c, DT)) if (e.type === 'derive') departs++;
  }
  noter('S5 30 appuis martelés : un seul départ', departs, 'exactement 1', departs === 1);
}

// S6 paliers et tenue, S8 pire lissage. Les deux modes de manche appliquent la zone morte et l'exposant du jeu.
{
  const p = paliers();
  noter('S6 paliers au mieux sur piste réelle', p.meilleur?.ecart ?? Infinity, '≤ 0,05 s', !!p.meilleur && p.meilleur.ecart <= .05,
    p.meilleur ? `niveaux ${p.meilleur.niveaux.map(x => x.toFixed(2)).join(' / ')} s, |d| ${p.meilleur.dMax.toFixed(2)} m` : 'aucun essai');
  for (const R of [40, 120, 250, 400]) {
    const dep = approche(R), et = structuredClone(dep.et), cmd = commande({ derive: true }); let depart0 = -1, dMax = 0, actif = true;
    for (let i = 0; i < 600; i++) {
      const t = i * DT;
      if (depart0 < 0) { cmd.volant = 1; cmd.gaz = 1; }
      else {
        const s = et.derive.sens || 1, dn = s * et.d, vn = s * et.v * Math.sin(et.psi), x = s * clamp(-.5 - .35 * dn - .2 * vn, -1, -.2);
        // `cmd.volant` est la sortie de la courbe de la manette (la zone morte et
        // l'exposant sont appliqués dans jeu.js avant conduite.pas()).
        cmd.volant = x; cmd.gaz = clamp(1 + .25 * dn + .25 * vn, 0, 1);
        if (t - depart0 >= 3) break;
        if (!et.derive.actif) { actif = false; break; }
      }
      for (const e of CD.pas(et, cmd, dep.c, DT)) if (e.type === 'derive' && depart0 < 0) depart0 = t;
      if (depart0 >= 0) dMax = Math.max(dMax, Math.abs(et.d));
    }
    noter(`S6 tenue manette R${R}`, dMax, '< 5,5 m pendant 3 s', depart0 >= 0 && actif && dMax < 5.5);
  }
}
{
  const p = paliers();
  const dep = approche(120), l = [];
  for (const impulsion of [.2, .1]) for (const hz of [60, 120]) l.push(mesurerClavier(dep, impulsion, hz).lissage);
  const pire = Math.max(p.lissage, ...l);
  noter('S8 lissage β à 60 et 120 Hz, pire scénario', pire, '≤ 300°/s²', pire <= 300, `paliers ${p.lissage.toFixed(1)} · clavier ${l.map(x => x.toFixed(1)).join(' / ')}`, { obligatoire: false });
}
{
  const r = gainR80();
  noter('S7 R80 : dérive puis turbo III et gain', r.gain, '0,1 à 0,3 s', r.drift.turbo3 && r.gain >= .1 && r.gain <= .3,
    `adhérence ${r.ref.t.toFixed(2)} s, dérive ${r.drift.t.toFixed(2)} s, turbo III ${r.drift.turbo3}`);
}

// Coupure : frein, herbe, vraie glissière, puis vrai contact course.js.
{
  const base = () => { const e = CD.creer(0, 0); e.v = 50; e.turbo = { ...e.turbo, reste: 1, niveau: 3, duree: 1 }; return e; };
  let e = base(); CD.pas(e, commande({ gaz: 1, frein: .5 }), circuit(), DT); const frein = e.turbo.reste === 0;
  e = base(); e.d = 220; CD.pas(e, commande({ gaz: 1 }), circuit(), DT); const herbe = e.turbo.reste === 0;
  const cMur = circuit({ largeur: 44, limite: 20 }), mur = base(); mur.d = -19.9; mur.psi = -.3;
  let choc = false; for (let i = 0; i < 4; i++) for (const x of CD.pas(mur, commande({ gaz: 1 }), cMur, DT)) choc ||= x.type === 'choc';
  noter('S7 turbo coupé par frein / herbe / vrai choc de glissière', [frein, herbe, choc && mur.turbo.reste === 0].map(x => x ? 'oui' : 'non').join(' / '), 'oui / oui / oui', frein && herbe && choc && mur.turbo.reste === 0);
}

// Les critères de course sont exécutés ici contre le vrai module, pas contre un stub de contacts.
{
  req(path.join(ici, '..', 'src', 'circuit.js'));
  req(path.join(ici, '..', 'src', 'course.js'));
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 1, rivaux: 11, graine: 5, placeJoueur: 8 });
  const joueur = co.voitures.find(v => v.joueur), rival = co.voitures.find(v => !v.joueur);
  rival.etat.s = joueur.etat.s; rival.etat.d = joueur.etat.d + .8; rival.etat.v = joueur.etat.v;
  joueur.etat.turbo = { reste: 1, niveau: 3, duree: 1 };
  const ev = B.course.pas(co, B.course.commandesIA(co, co.joueur), DT);
  const contact = ev.some(x => x.type === 'contact'), coupe = joueur.etat.turbo.reste === 0;
  noter('S7 contact réel entre voitures coupe le turbo du joueur', coupe ? 1 : 0, '1', contact && coupe, `contact=${contact}`);
  const co2 = B.course.creer(c, { mode: 'course', tours: 1, difficulte: 1, rivaux: 11, graine: 5, placeJoueur: 8 });
  let fini = false;
  for (let i = 0; i < 60 * 120; i++) { B.course.pas(co2, B.course.commandesIA(co2, co2.joueur), DT); if (co2.voitures.every(v => Number.isFinite(v.etat.s + v.etat.d + v.etat.v + v.etat.beta + v.etat.braquage))) fini = true; }
  noter('S7 IA : même loi, état fini après 60 s', fini ? 1 : 0, '1', fini);
}

// Même effet de turbo en 0,5 s : garde le critère historique sans tricher sur le contact.
{
  const c = circuit(), base = () => { const e = CD.creer(0, 0); e.v = 50; e.turbo.reste = 1; e.turbo.niveau = 3; e.turbo.duree = 1; return e; };
  const e = base(), sans = CD.creer(0, 0); e.v = sans.v = 50; for (let i = 0; i < 60; i++) { CD.pas(e, commande({ gaz: 1 }), c, DT); CD.pas(sans, commande({ gaz: 1 }), c, DT); }
  noter('S7 turbo III : poussée positive', e.v - sans.v, '> 0 m/s', e.v - sans.v > 0);
}

const obligatoires = resultats.filter(r => r.obligatoire);
const echecs = obligatoires.filter(r => !r.ok);
const ouvertes = resultats.filter(r => !r.obligatoire);
console.log('---');
console.log(`${obligatoires.length - echecs.length}/${obligatoires.length} critères obligatoires tenus; ${ouvertes.length} mesure(s) ouverte(s)`);
if (echecs.length) { for (const r of echecs) console.log('KO  ' + r.nom); process.exit(1); }
process.exit(0);
