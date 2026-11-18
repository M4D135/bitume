// Charges du relief (lot 17B, docs/reprise/17-CONDUITE.md § 3.1 ; demandes de la fiche des circuits de montagne :
// pentes de plus de 10 % à Haut-Col, de 20 à 30 % sur le grand circuit de montagne) :
// - pente et dévers : la charge normale vaut m·g·cos θ·cos φ ; sur le plat, m·g exactement (comme p9) ;
// - la pente ne déplace la charge que par les pneus : en montée à vitesse tenue, ils poussent contre la gravité et
//   l'arrière gagne m·g·sin θ·h/L (3,5 % du poids à 30 %) ;
// - relief : un creux de rayon vertical Rv ajoute m·u²/Rv à la charge, une crête l'ôte ; la courbure lue est lissée
//   sur courbureVLissage mètres ;
// - crête franchie trop vite : la charge et l'appui ne portent plus, les roues ne transmettent plus rien (aucune valeur
//   non finie), puis l'adhérence revient ;
// - freinage : plus long en descente qu'à plat, plus court en montée ;
// - tenue : deux minutes sur un profil de montagne (rampes de 20 à 30 %, crêtes et creux, virages), au pilote scripté :
//   état fini, ni tête-à-queue ni sortie, la rampe à 30 % se monte.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
req(path.join(ici, '..', 'src', 'conduite.js'));
const B = globalThis.BITUME, CD = B.conduite, P = CD.PARAMS, G = 9.81, DT = 1 / 120, m = P.masse;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const resultats = [];
function noter(nom, ok, valeur) {
  resultats.push(!!ok);
  console.log(`${ok ? 'ok ' : 'KO '} ${nom} : ${typeof valeur === 'number' ? +valeur.toPrecision(5) : JSON.stringify(valeur)}`);
}

// Tracé d'essai : courbure k(s) et pente p(s) données par fonctions, tabulées au mètre ; altitude et cap intégrés.
// Même contrat de lecture que circuit.js (lecture interpolée, objet de sortie rempli).
function trace({ longueur = 20000, k = () => 0, pente = () => 0, devers = () => 0 } = {}) {
  const n = Math.round(longueur), K = new Float64Array(n + 1), Pe = new Float64Array(n + 1), D = new Float64Array(n + 1);
  const Y = new Float64Array(n + 1), C = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) { K[i] = k(i); Pe[i] = pente(i); D[i] = devers(i); }
  for (let i = 1; i <= n; i++) { Y[i] = Y[i - 1] + (Pe[i - 1] + Pe[i]) / 2; C[i] = C[i - 1] + (K[i - 1] + K[i]) / 2; }
  const c = { longueur: n, largeur: 12, limite: 30 };
  B.circuit = {
    echantillon(_, s, o) {
      s = ((s % n) + n) % n;
      const i = Math.min(n - 1, Math.floor(s)), t = s - i, l = (A) => A[i] + (A[i + 1] - A[i]) * t;
      o = o || {};
      o.x = 0; o.z = 0; o.y = l(Y); o.cap = l(C); o.courbure = l(K); o.pente = l(Pe); o.devers = l(D); o.ligne = 0; o.vitesse = 0;
      return o;
    },
    vibreurA() { return false; }
  };
  return c;
}
const commande = (o = {}) => Object.assign({ gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0, guidage: 0 }, o);
// pilote de ligne : la loi des critères de la phase 2 (verifications/phase2/outils.mjs), vitesse visée vc
function piloter(et, c, vc, cmd) {
  const e = B.circuit.echantillon(c, et.s), v = Math.max(et.v, 5), la = 8 + .45 * v;
  const kDes = e.courbure + 2.2 * (Math.atan2(-et.d, la) - et.psi) / 10;
  cmd.volant = clamp(CD.volantPour(et, kDes), -1, 1);
  cmd.gaz = clamp((vc - et.v) * .8 + .35, 0, 1);
  cmd.frein = clamp((et.v - vc - 1) * .3, 0, 1);
}
function voiture(v, s = 0) { const et = CD.creer(s, 0); et.v = v; et._mesure = {}; return et; }
const fini = et => ['s', 'd', 'v', 'psi', 'beta', 'omega', 'chargeX', 'chargeY', 'capAv', 'capAr', 'xAv', 'xAr'].every(k => Number.isFinite(et[k]));

// ---------------------------------------------------------------- charge normale selon la pente et le dévers
{
  const cas = [[0, 0], [.1, 0], [.3, 0], [0, .08], [.25, -.035]];
  let pire = 0;
  for (const [p, d] of cas) {
    const c = trace({ pente: () => p, devers: () => d }), et = voiture(20, 1000);
    CD.pas(et, commande(), c, DT);
    const attendu = m * G * Math.cos(d) / Math.sqrt(1 + p * p);
    pire = Math.max(pire, Math.abs(et._mesure.fN - attendu) / (m * G));
  }
  noter('charge normale m·g·cos θ·cos φ (plat, 10 %, 30 %, dévers)', pire < 1e-12, pire);
  const c = trace(), et = voiture(20, 1000);
  CD.pas(et, commande(), c, DT);
  noter('sur le plat : m·g exactement', et._mesure.fN === m * G, et._mesure.fN);
}

// ---------------------------------------------------------------- transfert de la pente, par les pneus
{
  const mesure = p => {
    const c = trace({ pente: () => p }), et = voiture(20, 500), cmd = commande({ boite: 'auto' });
    for (let i = 0; i < 10 * 120; i++) { piloter(et, c, 20, cmd); CD.pas(et, cmd, c, DT); }
    return { fzAr: et._mesure.fzAr, fN: et._mesure.fN, chargeX: et.chargeX, v: et.v };
  };
  const plat = mesure(0), monte = mesure(.3), th = Math.atan(.3);
  const attendu = m * G * Math.sin(th) * P.hauteurCG / P.empattement;
  // à vitesse tenue, l'arrière reçoit la part statique de la charge normale, plus le report des pneus
  const gain = (monte.fzAr - monte.fN * (1 - P.repartition)) - (plat.fzAr - plat.fN * (1 - P.repartition));
  noter('montée à 30 %, vitesse tenue : report sur l’arrière = m·g·sin θ·h/L ± 5 %', Math.abs(gain / attendu - 1) < .05 && Math.abs(monte.v - 20) < .5, { report_N: gain, attendu_N: attendu, partDuPoids: gain / (m * G) });
}

// ---------------------------------------------------------------- creux et crête
{
  const Rv = 300, s0 = 2000, u = 50;
  const creux = trace({ pente: s => clamp((s - s0) / Rv, -.2, .2) });
  let et = voiture(u, s0 - .5 * u * DT);
  CD.pas(et, commande({ gaz: .5 }), creux, DT);
  const k1 = et._mesure.kv, attendu = m * (G + (et.v * Math.cos(et.beta)) ** 2 * k1);
  noter('creux de 300 m : courbure lue 1/Rv ± 1 %', Math.abs(k1 * Rv - 1) < .01, k1 * Rv);
  noter('creux de 300 m à 180 km/h : charge m·(g + u²/Rv)', Math.abs(et._mesure.fN / attendu - 1) < 1e-3 && et._mesure.fN > 1.8 * m * G, et._mesure.fN / (m * G));
  const crete = trace({ pente: s => clamp(-(s - s0) / Rv, -.2, .2) });
  et = voiture(u, s0 - .5 * u * DT);
  CD.pas(et, commande({ gaz: .5 }), crete, DT);
  noter('crête de 300 m à 180 km/h : charge m·(g − u²/Rv)', Math.abs(et._mesure.fN / (m * (G - u * u / Rv)) - 1) < .02, et._mesure.fN / (m * G));
}
{
  // crête de 60 m à 180 km/h : l'appui de la piste tombe sous 10 % du poids ; la voiture décolle, vole sur l'arc de
  // la gravité et de l'appui, se repose sur le profil sans accident ni gain de vitesse, et l'adhérence revient
  const Rv = 60, s0 = 3000, u = 50, c = trace({ pente: s => clamp(-(s - s0) / Rv, -.15, .15) });
  const et = voiture(u, s0 - 40), cmd = commande({ gaz: .6 });
  let vols = 0, pasEnVol = 0, finis = true, accident = false, vDecolle = 0, vPose = 0, retour = false, sautY = 0, yPrec = null;
  for (let i = 0; i < 4 * 120; i++) {
    const avant = !!(et.saut && et.saut.actif), v0 = et.v;
    CD.pas(et, cmd, c, DT);
    const vol = !!(et.saut && et.saut.actif);
    if (vol && !avant) { vols++; vDecolle = v0; }
    if (!vol && avant) vPose = et.v;
    if (vol) pasEnVol++;
    finis &&= fini(et) && Number.isFinite(et.y); accident ||= !!et.recuperation;
    if (yPrec != null) sautY = Math.max(sautY, Math.abs(et.y - yPrec));
    yPrec = et.y;
    if (vols && !vol && et.capAv > 0) retour = true;
  }
  noter('crête de 60 m à 180 km/h : décolle, vole, se pose sur le profil sans accident ni gain, état fini',
    vols >= 1 && pasEnVol > 0 && finis && !accident && retour && vPose <= vDecolle && sautY < .5,
    { vols, vol_s: +(pasEnVol / 120).toFixed(3), retour, vDecolle_kmh: +(vDecolle * 3.6).toFixed(1), vPose_kmh: +(vPose * 3.6).toFixed(1), plusGrandPasEnY_m: +sautY.toFixed(3) });
  // crête de 300 m à la même vitesse : l'appui garde la voiture au sol
  const c2 = trace({ pente: s => clamp(-(s - s0) / 300, -.15, .15) }), et2 = voiture(u, s0 - 40);
  let vole = false;
  for (let i = 0; i < 2 * 120; i++) { CD.pas(et2, cmd, c2, DT); vole ||= !!et2.saut; }
  noter('crête de 300 m à 180 km/h : reste au sol', !vole && fini(et2), vole ? 'vole' : 'au sol');
}
{
  // roue délestée : la charge se conserve (aucune charge créée), aucune roue sous zéro
  const c = trace(), et = voiture(15, 500);
  et.alat = et.chargeY = 3.2 * G; et.along = et.chargeX = -2 * G;
  CD.pas(et, commande({ frein: .5 }), c, DT);
  const R = et.roues, somme = R.reduce((a, r) => a + r.charge, 0), tot = et._mesure.fN + m * P.aero * 15 * 15;
  noter('roue délestée : somme des charges = charge totale, aucune sous zéro', Math.abs(somme / tot - 1) < 1e-12 && Math.min(...R.map(r => r.charge)) === 0 && R.every(r => r.charge >= 0),
    R.map(r => +r.charge.toFixed(1)));
}

// ---------------------------------------------------------------- freinage en pente
{
  const freinage = p => {
    const c = trace({ pente: () => p }), et = voiture(150 / 3.6, 500), cmd = commande({ frein: 1 }), s0 = et.distance;
    let t = 0;
    while (et.v > 50 / 3.6 && t < 20) { cmd.volant = 0; CD.pas(et, cmd, c, DT); t += DT; }
    return { d: et.distance - s0, fini: fini(et) && Math.abs(et.beta) < .05 };
  };
  const plat = freinage(0), haut = freinage(.25), bas = freinage(-.25);
  noter('150 → 50 km/h : descente à 25 % plus longue, montée plus courte, sans glisse', bas.d > plat.d && plat.d > haut.d && plat.fini && haut.fini && bas.fini,
    { plat_m: +plat.d.toFixed(2), montee_m: +haut.d.toFixed(2), descente_m: +bas.d.toFixed(2), descenteSurPlat: +(bas.d / plat.d).toFixed(3) });
}

// ---------------------------------------------------------------- tenue sur un profil de montagne
{
  // 8 km : virages de 60 à 400 m ; profil : rampe à 30 % (le Mur), rampes à 20 %, descentes à −10 %, raccords
  // paraboliques (crête et creux de 250 à 400 m de rayon vertical)
  const pentes = [[0, 0], [600, .30], [900, .30], [1200, .05], [1700, -.10], [2300, -.10], [2700, .20], [3300, .20], [3700, 0],
    [4300, -.08], [5000, .12], [5600, 0], [6300, -.06], [7000, .04], [8000, 0]];
  const lisse = (tab, s) => { // interpolation par morceaux, raccords en cosinus (pente continue, dérivée continue)
    for (let i = 0; i < tab.length - 1; i++) { const [a, pa] = tab[i], [b, pb] = tab[i + 1]; if (s <= b) { const t = (s - a) / (b - a); return pa + (pb - pa) * (1 - Math.cos(Math.PI * t)) / 2; } }
    return tab[tab.length - 1][1];
  };
  const virages = [[300, 700, 1 / 120], [1000, 1250, -1 / 60], [1900, 2300, 1 / 250], [2800, 3100, -1 / 90], [3900, 4400, 1 / 400],
    [4800, 5100, -1 / 70], [5800, 6400, 1 / 180], [7000, 7300, -1 / 100]];
  const k = s => { for (const [a, b, kk] of virages) if (s >= a && s <= b) return kk * Math.min(1, (s - a) / 40, (b - s) / 40); return 0; };
  const c = trace({ longueur: 8000, k, pente: s => lisse(pentes, s) });
  // vitesse visée : 85 % de la vitesse d'adhérence du virage (μ 1,5, appui), freinages anticipés à 6 m/s² (deux
  // passes arrière, le tour bouclant)
  const N = 8000, V = new Float64Array(N);
  for (let i = 0; i < N; i++) { const kk = Math.abs(k(i)); V[i] = Math.min(70, kk > 1e-6 ? .85 * Math.sqrt(1.5 * G / Math.max(kk - 1.5 * P.aero, 1e-6)) : 70); }
  for (let passe = 0; passe < 2; passe++) for (let i = N - 1; i >= 0; i--) V[i] = Math.min(V[i], Math.sqrt(V[(i + 1) % N] ** 2 + 2 * 6));
  const et = voiture(20, 0), cmd = commande({ boite: 'auto', aide: .35 });
  let ok = true, dMax = 0, bMax = 0, vMinMur = Infinity, gMax = 0, gMin = Infinity;
  for (let i = 0; i < 120 * 120; i++) {
    const vc = V[Math.floor(et.s) % N];
    piloter(et, c, vc, cmd); CD.pas(et, cmd, c, DT);
    ok &&= fini(et) && Math.abs(et.beta) < Math.PI / 2;
    dMax = Math.max(dMax, Math.abs(et.d)); bMax = Math.max(bMax, Math.abs(et.beta));
    if (et.s > 650 && et.s < 900) vMinMur = Math.min(vMinMur, et.v);
    const charge = (et._mesure.fN + m * P.aero * et.v * et.v) / (m * G); gMax = Math.max(gMax, charge); gMin = Math.min(gMin, charge);
  }
  noter('profil de montagne, 120 s : état fini, ni tête-à-queue ni sortie, le Mur à 30 % se monte', ok && dMax < 6 && vMinMur > 8,
    { dMax_m: +dMax.toFixed(2), betaMax_deg: +(bMax * 180 / Math.PI).toFixed(2), vMiniMur_kmh: +(vMinMur * 3.6).toFixed(1), charge_g: [+gMin.toFixed(2), +gMax.toFixed(2)], tour_m: +et.distance.toFixed(0) });
}

const n = resultats.length, ko = resultats.filter(x => !x).length;
if (ko) { console.log(`FAIL relief : ${ko} contrôle(s) sur ${n} en échec`); process.exit(1); }
console.log(`relief : ${n} contrôles tenus`);
