// Critères chiffrés du chantier 2 (FEUILLE-DE-ROUTE.md) : poids, équilibre, glisse, direction, départ, pente,
// dérive et turbo, mesurés sur src/conduite.js avec des circuits d'essai (ligne droite, cercle, arc puis droite).
// Tous les critères sont mesurés, puis la liste des échecs est donnée ; le code de sortie vaut 1 s'il y en a un.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
createRequire(import.meta.url)(path.join(ici, '..', '..', 'src', 'conduite.js'));
const B = globalThis.BITUME, CD = B.conduite, P = CD.PARAMS, G = 9.81, DT = 1 / 120, deg = 180 / Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------------------------------------------------------------- circuits d'essai
// Arc de rayon R sur `arc` mètres puis ligne droite ; arc infini : cercle complet ; R nul : ligne droite.
function circuit({ R = 0, arc = Infinity, pente = 0, largeur = 400, limite = 500 } = {}) {
  const L = R && arc === Infinity ? 2 * Math.PI * R : 1e6;
  B.circuit = {
    echantillon(c, s) {
      const ss = ((s % L) + L) % L;
      if (R && ss <= arc) {
        const th = ss / R;
        return { x: R * Math.sin(th), y: 0, z: R * (1 - Math.cos(th)), cap: th, courbure: 1 / R, pente: 0, devers: 0, ligne: 0, vitesse: 0 };
      }
      const th = R ? arc / R : 0, s0 = R ? ss - arc : ss;
      return { x: s0, y: pente * s0, z: 0, cap: th, courbure: 0, pente, devers: 0, ligne: 0, vitesse: 0 };
    },
    vibreurA() { return false; }
  };
  return { longueur: L, largeur, limite };
}
const commande = (o = {}) => Object.assign({ gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0, guidage: 0 }, o);
// vitesse de référence des circuits (circuit.js) : adhérence 1,55, appui 0,00155, pointe 86 m/s
const vRef = R => Math.min(86, Math.sqrt(1.55 * G / Math.max(1 / R - 1.55 * .00155, 1e-9)));

// Pilote d'essai : poursuite d'un point de la ligne d = cible, à la vitesse vc ; le volant tient la courbure voulue.
function piloter(et, c, vc, cmd, cible = 0) {
  const e = B.circuit.echantillon(c, et.s), v = Math.max(et.v, 5), la = 8 + .45 * v;
  const psiC = Math.atan2(cible - et.d, la);
  cmd.volant = clamp(CD.volantPour(et, e.courbure + 2.2 * (psiC - et.psi) / 10), -1, 1);
  cmd.gaz = clamp((vc - et.v) * .8 + .35, 0, 1);
  cmd.frein = clamp((et.v - vc - 1) * .3, 0, 1);
  return cmd;
}
function rouler(et, c, cmd, duree, chaque) {
  const n = Math.round(duree / DT), evs = [];
  for (let i = 0; i < n; i++) {
    if (chaque) chaque(et, cmd, i * DT);
    for (const e of CD.pas(et, cmd, c, DT)) { e.t = i * DT; evs.push(e); }
  }
  return evs;
}
// Tient le cercle de rayon R à la vitesse vc ; « tenu » : ligne et vitesse gardées, sans glisse, les 2 dernières s.
function tenir(R, vc, duree = 8, opts = {}) {
  const c = circuit({ R });
  const et = CD.creer(0, 0); et.v = vc; if (opts.rapport) et.rapport = opts.rapport;
  const cmd = commande({ boite: opts.rapport ? 'manuelle' : 'auto' });
  let pire = 0;
  rouler(et, c, cmd, duree, (et, cmd, t) => { piloter(et, c, vc, cmd); if (t > duree - 2) pire = Math.max(pire, Math.abs(et.d), Math.abs(et.v - vc) / 2); });
  return { et, c, cmd, tenu: pire < 1 && Math.abs(et.beta) < .15 };
}
function vLimite(R) {
  let lo = 15, hi = 90;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (tenir(R, m).tenu) lo = m; else hi = m; }
  return lo;
}

const resultats = [];
function critere(nom, valeur, cible, ok, info = '') {
  resultats.push({ nom, ok: !!ok });
  const v = typeof valeur === 'number' ? (Math.abs(valeur) >= 100 ? valeur.toFixed(0) : valeur.toFixed(3)) : valeur;
  console.log(`${ok ? 'ok ' : 'KO '} ${nom} : ${v} (cible ${cible})${info ? ' — ' + info : ''}`);
}

// ---------------------------------------------------------------- poids
{
  const c = circuit({});
  const et = CD.creer(0, 0); et.v = 78; et.chargeX = -3 * G;
  CD.pas(et, commande({ frein: 1 }), c, DT);
  critere('charge avant à −3 g', et.chargeAv, '≥ 0,60', et.chargeAv >= .6);
}
{
  const c = circuit({});
  const cap = cy => { const et = CD.creer(0, 0); et.v = 50; et.chargeY = cy; CD.pas(et, commande({ gaz: .3 }), c, DT); return et.capAv + et.capAr; };
  const r = cap(2 * G) / cap(0);
  critere('adhérence totale avec 2 g de transfert latéral / sans', r, '0,90 à 0,995', r >= .9 && r <= .995);
}

// ---------------------------------------------------------------- équilibre et glisse, R 120 m à la limite
const vl120 = vLimite(120);
console.log(`     vitesse limite tenue en R 120 m : ${(vl120 * 3.6).toFixed(0)} km/h (référence des circuits ${(vRef(120) * 3.6).toFixed(0)})`);
{
  const { et, c, cmd } = tenir(120, vl120 * .98, 8);
  const w0 = Math.abs(et.omega), vol = cmd.volant; let wMax = 0;
  rouler(et, c, commande({ volant: vol }), .5, et => { wMax = Math.max(wMax, Math.abs(et.omega)); });
  critere('R 120 à la limite : lacet après lever de pied (0,5 s) / avant', wMax / w0, '≥ 1,05', wMax / w0 >= 1.05);
}
let pireRapport = 2, pireBeta = 0, gazOk = false;
for (const rap of [2, 3]) {
  const vg = Math.min(vl120 * .98, P.vitessePointe[rap - 1] * .92);
  const { et, c, cmd } = tenir(120, vg, 8, { rapport: rap });
  const vol = cmd.volant; let bMax = 0;
  rouler(et, c, commande({ volant: vol, gaz: 1, boite: 'manuelle' }), 1.5, et => { bMax = Math.max(bMax, Math.abs(et.beta)); });
  console.log(`     plein gaz en ${rap}e à ${(vg * 3.6).toFixed(0)} km/h : glisse de caisse maxi ${(bMax * deg).toFixed(1)}°`);
  if (bMax * deg >= 6) gazOk = true;
  if (bMax > pireBeta) { pireBeta = bMax; pireRapport = rap; }
}
critere('R 120 : plein gaz en 2e ou 3e, l\'arrière glisse (°)', pireBeta * deg, '≥ 6', gazOk);
{
  // contre-braquage donné 0,3 s après le départ de la glisse (β > 4°), gaz ramené à 0,5
  const rap = pireRapport, vg = Math.min(vl120 * .98, P.vitessePointe[rap - 1] * .92);
  const { et, c, cmd } = tenir(120, vg, 8, { rapport: rap });
  const k = commande({ volant: cmd.volant, gaz: 1, boite: 'manuelle' });
  let t0 = -1, bMax = 0, bFin = 0, tq = false;
  rouler(et, c, k, 4, (et, k, t) => {
    if (t0 < 0 && Math.abs(et.beta) > 4 / deg) t0 = t;
    if (t0 >= 0 && t >= t0 + .3) { k.volant = clamp(-et.beta / .25, -.8, .8); k.gaz = .5; }
    bMax = Math.max(bMax, Math.abs(et.beta)); bFin = Math.abs(et.beta); if (Math.abs(et.beta) > Math.PI / 2) tq = true;
  });
  critere('contre-braquage en 0,3 s : rattrapé sans tête-à-queue (glisse maxi, °)', bMax * deg, '< 45, finale < 3', t0 >= 0 && !tq && bMax * deg < 45 && bFin * deg < 3,
    t0 < 0 ? 'pas de glisse provoquée' : 'glisse finale ' + (bFin * deg).toFixed(1) + '°');
}
for (const aide of [0, .35, .7]) {
  const { et, c, cmd } = tenir(120, vl120 * .9, 6);
  const vol = cmd.volant; et.beta = .35; et.omega += .6;
  let bMax = 0, bFin = 0, tq = false;
  rouler(et, c, commande({ volant: vol, gaz: 1, aide }), 4, et => { bMax = Math.max(bMax, Math.abs(et.beta)); bFin = Math.abs(et.beta); if (Math.abs(et.beta) > Math.PI / 2) tq = true; });
  if (aide === 0) critere('forte glisse (20°) sans correction ni aide : tête-à-queue', tq ? 'oui' : 'non', 'oui', tq, 'glisse maxi ' + (bMax * deg).toFixed(0) + '°');
  else critere(`forte glisse, aide ${aide} : rattrapée (glisse maxi, °)`, bMax * deg, '< 60, finale < 5', !tq && bMax * deg < 60 && bFin * deg < 5, 'glisse finale ' + (bFin * deg).toFixed(1) + '°');
}

// ---------------------------------------------------------------- direction
{
  const mesure = (v, de, vers, seuil, monte) => {
    const c = circuit({}), et = CD.creer(0, 0); et.v = v; et.volant = de;
    const cmd = commande({ volant: vers, gaz: v ? .5 : 0 });
    for (let i = 1; i <= 120; i++) {
      CD.pas(et, cmd, c, DT, v === 0);
      if (monte ? et.volant >= seuil : (de > 0 ? et.volant <= seuil : et.volant >= seuil)) return i * DT * 1000;
    }
    return Infinity;
  };
  for (const v of [0, 83]) {
    const a = mesure(v, 0, 1, .9, true), b = mesure(v, 1, 0, .1, false), d = mesure(v, 1, -1, 0, false), kmh = Math.round(v * 3.6);
    critere(`volant clavier à ${kmh} km/h : 0 → 90 % (ms)`, a, '≤ 120', a <= 120);
    critere(`volant clavier à ${kmh} km/h : relâché 1 → 0,1 (ms)`, b, '≤ 80', b <= 80);
    critere(`volant clavier à ${kmh} km/h : contre-braquage 1 → 0 (ms)`, d, '≤ 30', d <= 30);
  }
}
for (const kmh of [120, 200, 300]) {
  const v = kmh / 3.6, c = circuit({}), et = CD.creer(0, 0); et.v = v;
  let wMax = 0;
  rouler(et, c, commande({ volant: 1 }), 2, (et, cmd) => { cmd.gaz = clamp((v - et.v) * .8 + .4, 0, 1); wMax = Math.max(wMax, Math.abs(et.omega)); });
  const r = wMax / (CD.capaciteLaterale(v) / v);
  critere(`plein braquage à ${kmh} km/h : lacet maxi / lacet limite`, r, '≤ 1,2', r <= 1.2);
}
{
  // l'IA et le joueur partagent la même butée de braquage
  const v = 50, b = CD.braquageMax(v);
  critere('braquageMax(v) exporté, borné et décroissant', b, '> 0', b > 0 && b < .6 && CD.braquageMax(80) <= b && CD.braquageMax(20) >= b);
}

// ---------------------------------------------------------------- départ, pente
{
  const c = circuit({}), et = CD.creer(0, 0), cmd = commande({ gaz: 1 });
  for (let i = 0; i < 240; i++) CD.pas(et, cmd, c, DT, true);
  let rMin = Infinity, t = 0, t100 = -1;
  for (let i = 0; i < 1200; i++) {
    CD.pas(et, cmd, c, DT); t += DT;
    if (t <= .5) rMin = Math.min(rMin, et.regime);
    if (t100 < 0 && et.v * 3.6 >= 100) t100 = t;
  }
  critere('départ : régime mini dans les 0,5 s après le vert (tr/min)', rMin, '≥ 9 000', rMin >= 9000);
  critere('départ : 0-100 km/h (s)', t100, '2,2 à 3,4', t100 >= 2.2 && t100 <= 3.4);
}
{
  const pointe = pente => { const c = circuit({ pente }), et = CD.creer(0, 0); rouler(et, c, commande({ gaz: 1 }), 60); return et.v; };
  const v0 = pointe(0), v6 = pointe(.06);
  critere('montée à 6 % : pointe / pointe à plat', v6 / v0, '≤ 0,98', v6 / v0 <= .98, (v6 * 3.6).toFixed(0) + ' / ' + (v0 * 3.6).toFixed(0) + ' km/h');
  const acc = pente => { const c = circuit({ pente }), et = CD.creer(0, 0); et.v = 30; et.rapport = 3; CD.pas(et, commande({ boite: 'manuelle' }), c, DT); return (et.v - 30) / DT; };
  const dA = acc(0) - acc(.06), att = G * Math.sin(Math.atan(.06));
  critere('pente 6 % : écart d\'accélération = g·sin(pente) (m/s²)', dA, att.toFixed(3) + ' ± 5 %', Math.abs(dA - att) <= .05 * att);
}

// ---------------------------------------------------------------- dérive et turbo
// Dérive au bouton dans un virage de rayon R à la vitesse v ; contre(et, cmd, t, c) règle le volant après le départ.
function deriver(Rv, v, duree, contre, opts = {}) {
  const c = circuit({ R: Rv, arc: opts.arc ?? Infinity }), et = CD.creer(0, 0); et.v = v;
  const cmd = commande();
  let t0 = -1, dMax = 0;
  const betas = [];
  rouler(et, c, cmd, 1, (et, cmd) => piloter(et, c, v, cmd));          // approche tenue 1 s, puis bouton
  const evs = rouler(et, c, cmd, duree, (et, cmd, t) => {
    if (t0 < 0) { piloter(et, c, v, cmd); cmd.volant = Math.max(cmd.volant, .45); cmd.derive = true; cmd.gaz = 1; }
    if (t0 < 0 && et.derive.actif) t0 = t;
    if (t0 >= 0) { contre(et, cmd, t - t0, c); if (t - t0 > .3 && t - t0 < 3.3) dMax = Math.max(dMax, Math.abs(et.d)); }
    betas.push(et.beta);
  });
  return { et, evs, t0, betas, dMax };
}
const contreFixe = q => (et, cmd) => { cmd.volant = -et.derive.sens * q; cmd.gaz = 1; };
// contre-braquage « idéal » : garde la ligne (d ≈ 0) en dosant l'angle opposé
const contreIdeal = (et, cmd) => {
  const s = et.derive.sens || 1, dn = s * et.d, psin = s * et.psi;
  cmd.volant = s * clamp(-.5 - .06 * dn - 1.2 * psin, -1, .3); cmd.gaz = 1;
};
{
  const r = deriver(120, vRef(120), 4, contreFixe(.5));
  const niv = [1, 2, 3].map(n => { const e = r.evs.find(e => e.type === 'niveau' && e.niveau === n); return e && r.t0 >= 0 ? e.t - r.t0 : Infinity; });
  critere('paliers de dérive au mieux (s)', niv.map(x => x.toFixed(2)).join(' / '), '0,7 / 1,3 / 2,1', niv[0] <= .75 && niv[1] <= 1.35 && niv[2] <= 2.15);
  const fen = r.evs.filter(e => e.type === 'fenetre').length;
  critere('une fenêtre de lâcher à chaque palier', fen, '3', fen === 3, 'durée ' + P.deriveFenDur + ' s');
  for (const hz of [120, 60]) {
    const pasN = 120 / hz, b = r.betas.filter((_, i) => i % pasN === 0), h = pasN * DT;
    let m = 0; for (let i = 2; i < b.length; i++) m = Math.max(m, Math.abs(b[i] - 2 * b[i - 1] + b[i - 2]) / (h * h));
    critere(`lissage de la glisse à ${hz} Hz : |d²β/dt²| maxi (°/s²)`, m * deg, '≤ 300', m * deg <= 300);
  }
}
for (const Rv of [40, 120, 250, 400]) {
  const r = deriver(Rv, vRef(Rv), 4, contreIdeal);
  critere(`dérive tenue en R ${Rv} à ${(vRef(Rv) * 3.6).toFixed(0)} km/h : |d| maxi sur 3 s (m)`, r.t0 < 0 ? NaN : r.dMax, '< 5,5', r.t0 >= 0 && r.dMax < 5.5 && r.et.derive.actif,
    r.t0 < 0 ? 'pas de départ' : (r.et.derive.actif ? 'toujours en dérive' : 'dérive perdue'));
}
{
  const c = circuit({ R: 120 }), et = CD.creer(0, 0), v = vRef(120); et.v = v;
  const cmd = commande();
  rouler(et, c, cmd, 1, (et, cmd) => piloter(et, c, v, cmd));
  const evs = rouler(et, c, cmd, 3, (et, cmd, t) => { piloter(et, c, v, cmd); cmd.volant = Math.max(cmd.volant, .45); cmd.derive = Math.floor(t / .05) % 2 === 0; });
  const n = evs.filter(e => e.type === 'derive').length;
  critere('30 appuis martelés : départs de dérive', n, '≤ 1', n <= 1);
}
for (const [on, off] of [[.2, .2], [.1, .1]]) for (const hz of [30, 60, 120]) {
  // contre-braquage au clavier par impulsions, commandes lues à chaque image ; le filtrage est dans pas()
  const pasN = 120 / hz;
  let cible = 0;
  const r = deriver(120, vRef(120), 7, (et, cmd, t) => {
    if (Math.round(t / DT) % pasN === 0) cible = (t % (on + off)) < on ? -et.derive.sens || 0 : 0;
    cmd.volant = cible; cmd.gaz = 1;
  });
  const n3 = r.evs.some(e => e.type === 'niveau' && e.niveau === 3);
  critere(`clavier, impulsions ${on}/${off} s à ${hz} Hz : palier 3 atteint`, n3 ? 'oui' : 'non', 'oui', n3, r.et.derive.actif ? '' : 'dérive finie');
}
{
  // R 80 : virage de 180° puis 200 m de ligne droite ; adhérence seule contre dérive puis turbo III
  const Rv = 80, arc = Math.PI * Rv, v = vRef(Rv), fin = arc + 200;
  const temps = avecDerive => {
    const c = circuit({ R: Rv, arc }), et = CD.creer(0, 0); et.v = v;
    const cmd = commande(); let t = 0, lache = false, niv = 0;
    while (et.s < fin && t < 30) {
      const enVirage = et.s < arc - 2;
      piloter(et, c, enVirage ? v : 90, cmd);
      if (avecDerive && enVirage && !lache) {
        cmd.derive = true; cmd.gaz = 1;
        if (et.derive.actif) { contreIdeal(et, cmd); niv = et.derive.niveau; if (niv >= 3) { cmd.derive = false; lache = true; } }
        else cmd.volant = Math.max(cmd.volant, .45);
      } else cmd.derive = false;
      if (!enVirage) cmd.gaz = 1;
      CD.pas(et, cmd, c, DT); t += DT;
    }
    return { t, niv: Math.max(niv, et.turbo.niveau || 0) };
  };
  const a = temps(false), b = temps(true), g = a.t - b.t;
  critere('R 80 : dérive puis turbo III, gain sur l\'adhérence (s)', g, '0,1 à 0,3', g >= .1 && g <= .3, `adhérence ${a.t.toFixed(2)} s, dérive ${b.t.toFixed(2)} s, palier ${b.niv}`);
}
{
  const c = circuit({}), base = () => { const et = CD.creer(0, 0); et.v = 50; et.turbo.reste = 1; et.turbo.niveau = 3; et.turbo.duree = 1; return et; };
  let et = base(); CD.pas(et, commande({ gaz: 1, frein: .5 }), c, DT); const f = et.turbo.reste === 0;
  et = base(); et.d = 220; CD.pas(et, commande({ gaz: 1 }), c, DT); const h = et.turbo.reste === 0;
  et = base(); CD.annulerDerive(et); const k = et.turbo.reste === 0;
  critere('turbo coupé par le frein / l\'herbe / le contact', [f, h, k].map(x => x ? 'oui' : 'non').join(' / '), 'oui / oui / oui', f && h && k);
  et = base(); const e0 = CD.creer(0, 0); e0.v = 50;
  for (let i = 0; i < 60; i++) { CD.pas(et, commande({ gaz: 1 }), c, DT); CD.pas(e0, commande({ gaz: 1 }), c, DT); }
  critere('turbo III : vitesse gagnée en 0,5 s (m/s)', et.v - e0.v, '> 0', et.v - e0.v > 0);
}
{
  // une voiture arrêtée caisse retournée par rapport à sa vitesse repart vers l'avant de sa caisse, sur la piste
  // comme dans l'herbe (où la poussée, faible, ne la sortait pas de l'arrêt)
  for (const [lieu, d] of [['piste', 0], ['herbe', 220]]) {
    const c = circuit({}), et = CD.creer(0, 0);
    et.v = 0; et.beta = Math.PI; et.psi = -.5; et.d = d;
    rouler(et, c, commande({ gaz: 1 }), 2);
    critere(`arrêtée caisse retournée dans l'${lieu === 'piste' ? 'asphalte' : 'herbe'}, plein gaz : elle repart (m/s en 2 s)`, et.v, '> 3', et.v > 3);
  }
}

const echecs = resultats.filter(r => !r.ok);
console.log('---');
console.log(`${resultats.length - echecs.length}/${resultats.length} critères tenus`);
if (echecs.length) { for (const r of echecs) console.log('KO  ' + r.nom); process.exit(1); }
process.exit(0);
