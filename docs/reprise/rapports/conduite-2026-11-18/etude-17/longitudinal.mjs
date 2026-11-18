// Calculateur de ligne droite pour le lot 17 : départ (motricité arrière avec transfert, puis puissance), pointe,
// pied levé, freinage. Mêmes réserves que regime-etabli.mjs : il sert à comparer des jeux de paramètres. Son jeu
// « niveau actuel » donne 0-200 en 6,5 s quand le banc mesure 7,30 s sur le vrai modèle (embrayage, boîte et
// transfert simplifiés ici) : on en lit les écarts entre jeux, pas les temps absolus.
const G = 9.81, RHO = 1.225, KMH = 3.6, DT = 1 / 120;
// Boîte du jeu (vitesse à 12 800 tr/min par rapport), passage à 12 300 tr/min, coupure 0,08 s.
const VP = [27, 40, 52, 63, 75, 86], NMAX = 12800, MONTE = 12300;
// Courbe de couple proposée (§ 3.5 du plan) : plate au-dessus de 8 500 tr/min, 30 % plus basse sous 7 000.
const COUPLE = [[4000, .62], [7000, .80], [8500, .95], [10500, 1], [12300, .93], [12800, .80]];
const tau = n => {
  const c = COUPLE; if (n <= c[0][0]) return c[0][1];
  for (let i = 0; i < c.length - 1; i++) if (n <= c[i + 1][0]) return c[i][1] + (c[i + 1][1] - c[i][1]) * (n - c[i][0]) / (c[i + 1][0] - c[i][0]);
  return c[c.length - 1][1];
};
const muEff = (p, fz, fz0) => p.mu * Math.pow(fz / fz0, -p.q);
// Un paramètre absent rendrait NaN et la boucle s'arrêterait sans rien dire (« aucun blocage ») : on refuse.
function exiger(p, noms) { for (const n of noms) if (!Number.isFinite(p[n])) throw new TypeError(`longitudinal : paramètre ${n} manquant ou invalide`); }
const CHASSIS = ['m', 'L', 'rep', 'h', 'SCz', 'aeroAv', 'SCx', 'mu', 'gAr', 'q', 'ex', 'rr'];
function charges(p, v, ax) {
  const appui = .5 * RHO * p.SCz * v * v, dx = p.m * ax * p.h / p.L;
  return { av: p.m * G * p.rep + appui * p.aeroAv - dx, ar: p.m * G * (1 - p.rep) + appui * (1 - p.aeroAv) + dx };
}
const capAvDe = (p, c) => 2 * muEff(p, c.av / 2, p.m * G * p.rep / 2) * c.av / 2 * p.ex;
const capArDe = (p, c) => 2 * muEff(p, c.ar / 2, p.m * G * (1 - p.rep) / 2) * p.gAr * c.ar / 2 * p.ex;

// Départ arrêté plein gaz, boîte automatique. Poussée = couple·η·(rapport de démultiplication)/rayon, soit
// Tmax·τ(n)·η·(NMAX·2π/60)/vPointe : la puissance à la roue ne dépend plus du rapport.
export function depart(p) {
  exiger(p, [...CHASSIS, 'Tmax', 'eta']);
  let v = .1, x = 0, t = 0, r = 0, ax = 0, patine = 0, pMax = 0; const out = {};
  while (t < 60) {
    let n = NMAX * v / VP[r]; if (n >= MONTE && r < 5) { r++; n = NMAX * v / VP[r]; t += .08; }   // coupure, vitesse gardée
    n = Math.max(n, r === 0 ? 4000 + 9000 * .7 : 4000);                                        // embrayage qui patine au départ
    const fMot = p.Tmax * tau(Math.min(n, NMAX)) * p.eta * (NMAX * 2 * Math.PI / 60) / VP[r] * (NMAX * v / VP[r] >= NMAX + 200 ? 0 : 1);
    const capAr = capArDe(p, charges(p, v, ax)), fx = Math.min(fMot, .97 * capAr);
    if (fMot > capAr) patine += DT;
    const a = (fx - .5 * RHO * p.SCx * v * v - p.m * p.rr) / p.m;
    ax += (a - ax) * (1 - Math.exp(-DT / .062));
    pMax = Math.max(pMax, fx * v); v += a * DT; x += v * DT; t += DT;
    for (const s of [100, 200, 300]) if (out[s] == null && v * KMH >= s) out[s] = t;
    if (out.m400 == null && x >= 400) out.m400 = t;
    if (a < 1e-3 && t > 20) break;
  }
  return { t100: out[100], t200: out[200], t300: out[300] ?? null, m400: out.m400, pointe: v * KMH, patine_s: patine, pRoueMax_kW: pMax / 1000 };
}

// Rapport tenu entre 8 000 et 12 300 tr/min (boîte auto qui rétrograde) et frein moteur (N) à la roue : couple de
// pertes c0 + c1·n ramené par le rapport (et par η, les pertes de la transmission s'y ajoutent).
function rapportPour(v) { for (let r = 0; r < 6; r++) if (NMAX * v / VP[r] <= MONTE) return r; return 5; }
export function freinMoteur(p, v) {
  const r = rapportPour(v), n = Math.max(4000, NMAX * v / VP[r]);
  return (p.fm0 + p.fm1 * n) * (NMAX * 2 * Math.PI / 60) / VP[r] / p.eta;
}
// Décélération pied levé (g) à une vitesse et sur un rapport donnés : traînée, roulement, frein moteur.
export function piedLeve(p, kmh, rapport) {
  const v = kmh / KMH, n = NMAX * v / VP[rapport - 1], fm = (p.fm0 + p.fm1 * n) * (NMAX * 2 * Math.PI / 60) / VP[rapport - 1] / p.eta;
  return (.5 * RHO * p.SCx * v * v + p.m * p.rr + fm) / p.m / G;
}

// Freinage en ligne droite. La pédale commande une force (FbMax_g fois le poids), répartie b sur l'avant, montée
// linéaire en `rampe` s ; le frein moteur s'ajoute à l'arrière. Deux pilotes :
// - « abs » : chaque essieu plafonné à 0,98 de son adhérence (le meilleur freinage possible) ;
// - « plein » : pédale pleine tenue ; une roue qui dépasse son adhérence se bloque et ne garde que le plateau de
//   glisse (p.glisse) jusqu'à l'arrêt. L'écart entre les deux est le prix d'un blocage.
// Le transfert est filtré (62 ms, comme conduite.js) et part de axInit g : partir de zéro fait « bloquer » l'avant au
// premier pas d'une pédale instantanée, ce qui est réel (le transfert n'est pas encore là), pas un défaut du calcul.
export function freiner(p, v0kmh, v1kmh, { pilote = 'abs', rampe = 0, moteur = true } = {}) {
  exiger(p, [...CHASSIS, 'FbMax_g', 'b', 'glisse', 'eta', 'fm0', 'fm1']);
  let v = v0kmh / KMH, x = 0, t = 0, ax = -(p.axInit || 0) * G, blocAv = false, blocAr = false, vBlocAv = null, vBlocAr = null;
  while (v > v1kmh / KMH && t < 30) {
    const c = charges(p, v, ax), capAv = capAvDe(p, c), capAr = capArDe(p, c);
    const ped = rampe > 0 ? Math.min(1, t / rampe) : 1, fb = ped * p.FbMax_g * p.m * G, fm = moteur ? freinMoteur(p, v) : 0;
    let fAv = p.b * fb, fAr = (1 - p.b) * fb + fm;
    if (pilote === 'abs') { fAv = Math.min(fAv, .98 * capAv); fAr = Math.min(fAr, .98 * capAr); }
    else {
      if (!blocAv && fAv > capAv) { blocAv = true; vBlocAv = v * KMH; }
      if (!blocAr && fAr > capAr) { blocAr = true; vBlocAr = v * KMH; }
      if (blocAv) fAv = p.glisse * capAv;
      if (blocAr) fAr = p.glisse * capAr;
    }
    const a = -(fAv + fAr + .5 * RHO * p.SCx * v * v + p.m * p.rr) / p.m;
    ax += (a - ax) * (1 - Math.exp(-DT / .062));
    v += a * DT; x += Math.max(v, 0) * DT; t += DT;
  }
  const v0 = v0kmh / KMH, v1 = v1kmh / KMH;
  const premier = vBlocAv == null && vBlocAr == null ? 'aucun' : (vBlocAr == null || (vBlocAv ?? -1) > vBlocAr) ? 'avant' : 'arrière';
  return { d: x, t, moy_g: (v0 * v0 - v1 * v1) / (2 * x) / G, vBlocAv, vBlocAr, premier };
}

// Part de la pédale qui amène l'avant juste à son adhérence en freinage établi à `kmh` : ce que le joueur doit
// relâcher en fin de freinage, quand l'appui tombe.
export function pedaleLimite(p, kmh) {
  const v = kmh / KMH; let ax = -2 * G;
  for (let i = 0; i < 80; i++) {
    const capAv = capAvDe(p, charges(p, v, ax)), a = -(capAv / p.b + .5 * RHO * p.SCx * v * v) / p.m;
    ax += .5 * (a - ax);
  }
  return Math.min(1, capAvDe(p, charges(p, v, ax)) / p.b / (p.FbMax_g * p.m * G));
}
