#!/usr/bin/env node
/* BITUME — prototype du sous-lot 22A (relief et dévers), sans toucher aux sources du jeu.
   Pour chaque circuit du catalogue : relief actuel (circuit.js tel quel) et relief proposé, mesures avant/après,
   profils en long, pentes et charges verticales en SVG/PNG, et, sur demande, un script à injecter dans la page
   (tools/tour-captures.mjs --injecter) qui applique le même calcul au jeu construit pour le regarder en vrai.

     node tools/prototype-relief.mjs [--src ../bitume/src] [--sortie <dossier>] [--script-page <fichier.js>] [--sans-png]

   Le calcul (relief22A) est une fonction autonome : la même source tourne dans Node et dans la page.
   Règles du prototype :
   - le tracé en plan, les identifiants, les graines et tous les tirages actuels restent ; le fond reprend les trois
     harmoniques actuelles (mêmes tirages du générateur r) sans l'écrasement global à 6,8 % ;
   - les nouveautés tirent dans un générateur à elles (graine du circuit ^ 0x22A0BEEF), jamais dans r ni dans le
     hasard du décor ou de la course ;
   - pente bornée par thème ; courbure verticale bornée par la vitesse de référence (allègement et écrasement admis
     en g, la voiture ne décolle jamais à 1,05 fois la vitesse de référence) ; ligne droite des stands à plat ;
     tunnel régulier ; tour refermé exactement. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerBitume, lireCatalogue, creerCircuit, mesurerTrace, courbureVerticale, G, arrondi } from './circuits-commun.mjs';
import { svgAvantApres, svgPetitsMultiples, ecrireSvgEtPng, nombreFr } from './profil-svg.mjs';

// ---------------------------------------------------------------- le calcul (autonome : sérialisé tel quel dans la page)
export function relief22A(c, AMPLITUDE) {
  const REGLAGES = {
    // pente : plafond ; allegement / ecrasement : g admis à 1,05 × la vitesse de référence ; fond : part des harmoniques
    // actuelles non écrasées ; evenements : nombre [min, max] ; amp : hauteur d'un événement (m) ; ond : ondulations (m)
    foret:     { pente: .08, allegement: .35, ecrasement: .70, fond: 1,  evenements: [4, 6], amp: [2, 5],   ond: .35, releve: .55, contraire: .15, devMax: .09 },
    cote:      { pente: .06, allegement: .25, ecrasement: .50, fond: 1,  evenements: [2, 3], amp: [1, 2.5], ond: .20, releve: .70, contraire: .05, devMax: .07 },
    montagne:  { pente: .10, allegement: .45, ecrasement: .90, fond: .9, evenements: [5, 7], amp: [3, 8],   ond: .45, releve: .45, contraire: .30, devMax: .10 },
    islande:   { pente: .08, allegement: .40, ecrasement: .80, fond: 1,  evenements: [3, 5], amp: [2, 6],   ond: .50, releve: .45, contraire: .25, devMax: .09 },
    desert:    { pente: .08, allegement: .40, ecrasement: .80, fond: 1,  evenements: [4, 6], amp: [2, 6],   ond: .40, releve: .50, contraire: .20, devMax: .09 },
    asie:      { pente: .08, allegement: .35, ecrasement: .70, fond: 1,  evenements: [4, 6], amp: [2, 5],   ond: .35, releve: .60, contraire: .15, devMax: .10 },
    pacifique: { pente: .08, allegement: .35, ecrasement: .70, fond: 1,  evenements: [4, 6], amp: [2, 5],   ond: .35, releve: .60, contraire: .15, devMax: .09 }
  };
  const reg = REGLAGES[c.theme] || REGLAGES.foret, n = c.n, P = c.pas, L = c.longueur, g = 9.81;
  const borner = (v, a, b) => v < a ? a : v > b ? b : v;
  const lisse = (a, b, x) => { const t = borner((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const idx = i => ((i % n) + n) % n;
  const alea = graine => { let a = graine >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const dansTunnel = (i, marge) => { const t = c.tunnel; if (!t) return false; const s = i * P; return s > t.debut - marge && s < t.fin + marge; };

  // 0. fenêtre plate de la ligne droite des stands : même calcul que circuit.js
  const plat = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = i * P; if (s > L / 2) s -= L; plat[i] = 1 - lisse(0, 120, Math.max(c.ligneDroite.debut - s, s - c.ligneDroite.fin, 0)); }

  // 1. fond : les trois harmoniques de circuit.js, mêmes tirages (générateur r du tracé retenu), sans l'écrasement
  const r = alea((c.graine >>> 0) * 2654435761 + (c.essais - 1) * 40503), A = AMPLITUDE[c.theme] || 14, harm = [];
  for (let h = 0; h < 3; h++) harm.push({ k: 1 + Math.floor(r() * 5), a: .4 + r() * .6, phi: r() * 2 * Math.PI });
  const somme = harm.reduce((s, h) => s + h.a, 0), fond = new Float64Array(n);
  for (let i = 0; i < n; i++) { let v = 0; for (const h of harm) v += h.a * Math.sin(2 * Math.PI * h.k * i * P / L + h.phi); fond[i] = v / somme * A * (1 - plat[i]); }
  let pmaxFond = 0;
  for (let i = 0; i < n; i++) pmaxFond = Math.max(pmaxFond, Math.abs(fond[idx(i + 1)] - fond[idx(i - 1)]) / (2 * P));
  const facteurActuel = pmaxFond > .068 ? .068 / pmaxFond : 1;
  let ecartReproduction = 0;
  for (let i = 0; i < n; i++) ecartReproduction = Math.max(ecartReproduction, Math.abs(fond[i] * facteurActuel - c.y[i]));

  // vitesse de dimensionnement : 1,05 × la référence (le joueur rapide), jamais moins de 25 m/s
  const v2 = new Float64Array(n);
  for (let i = 0; i < n; i++) { const v = Math.max(25, c.vitesse[i] * 1.05); v2[i] = v * v; }
  const R = alea(((c.graine >>> 0) ^ 0x22A0BEEF) >>> 0);   // générateur propre au 22A
  const entre = (a, b) => a + R() * (b - a);

  // 2. événements : crêtes avant freinage et en sortie de virage lent, compressions dans les courbes rapides, bosses
  //    et creux de ligne droite
  const virages = [];
  { const dans = i => Math.abs(c.courbure[i]) > 1 / 500;
    let depart = 0; while (depart < n && dans(depart)) depart++;
    let cur = null;
    for (let j = 0; j < n; j++) { const i = idx(depart + j);
      if (dans(i)) { if (cur && j - cur.j1 <= 15) cur.j1 = j; else { cur = { j0: j, j1: j }; virages.push(cur); } } }
    for (const v of virages) { let kMax = 0; v.apex = v.j0; for (let j = v.j0; j <= v.j1; j++) { const k = Math.abs(c.courbure[idx(depart + j)]); if (k > kMax) { kMax = k; v.apex = j; } }
      v.debut = idx(depart + v.j0); v.fin = idx(depart + v.j1); v.apex = idx(depart + v.apex); v.rayon = 1 / kMax; }
    virages.forEach((v, k) => { const prec = virages[(k - 1 + virages.length) % virages.length]; v.approche = idx(v.debut - prec.fin) * P; }); }
  const candidats = [];
  for (const v of virages) {
    const sFrein = idx(v.debut - Math.round(entre(50, 110) / P));
    if (v.approche >= 160 && c.vitesse[sFrein] >= 45) candidats.push({ type: 'crête avant freinage', i: sFrein, sens: 1 });
    if (v.rayon >= 110 && v.rayon <= 700) candidats.push({ type: 'compression en courbe', i: idx(v.apex - Math.round(entre(10, 40) / P)), sens: -1 });
    if (c.vitesse[v.apex] < 42) candidats.push({ type: 'crête en sortie de virage', i: idx(v.fin + Math.round(entre(30, 80) / P)), sens: 1 });
    if (v.approche >= 360) candidats.push({ type: R() < .5 ? 'bosse de ligne droite' : 'creux de ligne droite', i: idx(v.debut - Math.round(v.approche * entre(.45, .65) / P)), sens: 0 });
  }
  for (let k = candidats.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [candidats[k], candidats[j]] = [candidats[j], candidats[k]]; }
  const voulu = reg.evenements[0] + Math.floor(R() * (reg.evenements[1] - reg.evenements[0] + 1)), evenements = [];
  const evts = new Float64Array(n);
  for (const e of candidats) {
    if (evenements.length >= voulu) break;
    const sens = e.sens || (e.type.startsWith('bosse') ? 1 : -1), alpha = sens > 0 ? reg.allegement : reg.ecrasement;
    const amp = entre(reg.amp[0], reg.amp[1]);
    // largeur dictée par la vitesse : au sommet, A/σ² ≤ 0,85 · α·g/v²
    const sigma = Math.max(28, Math.sqrt(amp * v2[e.i] / (.85 * alpha * g)));
    let libre = !dansTunnel(e.i, 2.5 * sigma + 40);
    for (let j = -Math.ceil(2.5 * sigma / P); j <= Math.ceil(2.5 * sigma / P) && libre; j++) if (plat[idx(e.i + j)] > .001) libre = false;
    for (const f of evenements) if (Math.abs(((e.i - f.i) * P + 1.5 * L) % L - L / 2) < 2.2 * Math.max(sigma, f.sigma) + 60) libre = false;
    if (!libre) continue;
    evenements.push({ type: e.type, i: e.i, s: e.i * P, amp: +(sens * amp).toFixed(2), sigma: Math.round(sigma) });
    const K = Math.ceil(3 * sigma / P);
    for (let j = -K; j <= K; j++) evts[idx(e.i + j)] += sens * amp * Math.exp(-.5 * (j * P / sigma) ** 2);
  }

  // 3. ondulations : cinq longueurs d'onde de 60 à 260 m, amplitude bornée sur place par la vitesse (chacune au quart
  //    de α·g·λ²/4π²v² : même en phase, les cinq restent sous la limite de charge)
  const ond = new Float64Array(n);
  for (let k = 0; k < 5; k++) {
    const lambda = entre(60, 260), a0 = reg.ond * entre(.4, 1) / Math.sqrt(5), phi = entre(0, 2 * Math.PI);
    for (let i = 0; i < n; i++) {
      const aMax = .25 * reg.allegement * g * lambda * lambda / (4 * Math.PI * Math.PI * v2[i]);
      ond[i] += Math.min(a0, aMax) * Math.sin(2 * Math.PI * i * P / lambda + phi);
    }
  }
  for (let i = 0; i < n; i++) if (dansTunnel(i, 40)) ond[i] = 0;

  // 4. profil visé puis contraintes sur la pente p = dy/ds : plafond, variation bornée (crête : −α·g/v², creux :
  //    +α·g/v²), plat sur la fenêtre des stands, tunnel régulier, somme nulle sur le tour
  const cible = new Float64Array(n);
  for (let i = 0; i < n; i++) cible[i] = (reg.fond * fond[i] + evts[i] + ond[i]) * (1 - plat[i]);
  const p = new Float64Array(n), pmax = new Float64Array(n), bas = new Float64Array(n), haut = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    p[i] = (cible[idx(i + 1)] - cible[idx(i - 1)]) / (2 * P);
    const tunnel = dansTunnel(i, 40);
    pmax[i] = (tunnel ? Math.min(reg.pente, .05) : reg.pente) * (plat[i] > .999 ? 0 : 1);
    bas[i] = tunnel ? -1 / 3000 : -reg.allegement * g / v2[i];
    haut[i] = tunnel ? 1 / 3000 : reg.ecrasement * g / v2[i];
  }
  for (let tour = 0; tour < 12; tour++) {
    for (let i = 0; i < n; i++) p[i] = borner(p[i], -pmax[i], pmax[i]);
    let s = 0, w = 0;
    for (let i = 0; i < n; i++) { s += p[i]; w += pmax[i] > 0 ? 1 - plat[i] : 0; }
    for (let i = 0; i < n; i++) if (pmax[i] > 0) p[i] -= s / w * (1 - plat[i]);
    // passes avant puis arrière, plafond compris (comme un profil de vitesse borné en accélération) : le plafond nul de
    // la fenêtre des stands se prépare en amont au lieu de casser la pente à son entrée
    for (let passe = 0; passe < 2; passe++) {
      for (let j = 1; j <= n; j++) { const i = idx(j), a = idx(j - 1); p[i] = borner(borner(p[i], p[a] + bas[i] * P, p[a] + haut[i] * P), -pmax[i], pmax[i]); }
      for (let j = n - 2; j >= -1; j--) { const i = idx(j), b = idx(j + 1); p[i] = borner(borner(p[i], p[b] - haut[i] * P, p[b] - bas[i] * P), -pmax[i], pmax[i]); }
    }
  }
  // intégration (trapèzes) puis fermeture : l'écart résiduel est repris par une pente constante hors fenêtre plate
  const y = new Float64Array(n);
  let ferme = 0;
  { let acc = 0; for (let j = 1; j <= n; j++) acc += (p[idx(j - 1)] + p[idx(j)]) / 2 * P; ferme = acc; }
  let poids = 0; for (let i = 0; i < n; i++) poids += pmax[i] > 0 ? 1 - plat[i] : 0;
  for (let i = 0; i < n; i++) if (pmax[i] > 0) p[i] -= ferme / (poids * P) * (1 - plat[i]);
  for (let j = 1; j < n; j++) y[j] = y[j - 1] + (p[j - 1] + p[j]) / 2 * P;
  const pente = new Float64Array(n);
  for (let i = 0; i < n; i++) pente[i] = (y[idx(i + 1)] - y[idx(i - 1)]) / (2 * P);

  // 5. dévers : les virages sont répartis relevés, contraires et plats selon les parts du thème (ordre tiré par le
  //    générateur propre), jusqu'à 10 % (5,7°, limite FIA) ; lignes droites hors stands : pente transversale
  //    d'écoulement de 1,5 à 2,5 %, côté tiré par droite
  const devVise = new Float64Array(n), type = new Int8Array(n);
  const ordre = virages.map((v, k) => ({ v, cle: R() })).sort((a, b) => a.cle - b.cle).map(o => o.v);
  const nReleve = Math.round(virages.length * reg.releve), nContraire = Math.max(reg.contraire >= .15 ? 1 : 0, Math.round(virages.length * reg.contraire));
  ordre.forEach((v, k) => { v.sorte = k < nReleve ? 'relevé' : k < nReleve + nContraire ? 'contraire' : 'plat'; });
  for (const v of virages) {
    for (let j = v.debut, k = 0; k <= idx(v.fin - v.debut); j = idx(j + 1), k++) {
      const k1 = c.courbure[j], sens = Math.sign(k1);
      devVise[j] = v.sorte === 'relevé' ? sens * reg.devMax * Math.max(.45, Math.min(1, Math.abs(k1) * 50))
        : v.sorte === 'contraire' ? -sens * Math.min(.035, Math.abs(k1) * 1.5 + .012) : 0;
      type[j] = 1;
    }
  }
  { let i = 0; while (i < n) { if (type[i]) { i++; continue; } let j = i; while (j < n && !type[j]) j++;
      const cote = R() < .5 ? -1 : 1, pct = entre(.015, .025);
      for (let k = i; k < j; k++) devVise[k] = cote * Math.atan(pct); i = j; } }
  for (let i = 0; i < n; i++) if (dansTunnel(i, 0)) devVise[i] = 0;
  const devers = new Float64Array(n), F = 20;
  { let s = 0; for (let j = -F; j <= F; j++) s += devVise[idx(j)];
    for (let i = 0; i < n; i++) { devers[i] = s / (2 * F + 1) * (1 - plat[i]); s += devVise[idx(i + F + 1)] - devVise[idx(i - F)]; } }

  return { y, pente, devers, plat, fond, facteurActuel, ecartReproduction, evenements,
    virages: virages.map(v => ({ s: v.apex * P, rayon: Math.round(v.rayon), sorte: v.sorte })), ferme };
}

// Distance de visibilité verticale (m) : œil du pilote à 1,05 m, cible à `cible` m au-dessus de la chaussée (1 m :
// le haut d'une monoplace qui précède), plan ignoré. Sous 120 m, une voiture disparaît derrière la crête.
export function visibilites(y, pas, portee = 300, cible = 1) {
  const n = y.length, d = new Float64Array(n), K = Math.round(portee / pas);
  for (let i = 0; i < n; i++) {
    const oeil = y[i] + 1.05; let vue = portee, pire = -Infinity;
    for (let k = 1; k <= K; k++) {
      const pente = (y[(i + k) % n] + cible - oeil) / (k * pas);
      if (k > 2 && pente < pire - 1e-12) { vue = k * pas; break; }
      pire = Math.max(pire, (y[(i + k) % n] - oeil) / (k * pas));
    }
    d[i] = vue;
  }
  return d;
}

// Talus entre deux portions voisines du tour : le terrain colle à l'altitude de la piste sur 30 m de part et d'autre
// (decor.js, hauteur()) ; entre deux branches, la différence d'altitude doit tenir dans l'écart restant.
export function talus(c, y, { distanceMax = 160, horsPiste = 30, saut = 200 } = {}) {
  const n = c.n, P = c.pas, pasI = 2, conflits = []; let pire = 0;
  for (let i = 0; i < n; i += pasI) for (let j = i + pasI; j < n; j += pasI) {
    const le = Math.min(j - i, n - j + i) * P; if (le < saut) continue;
    const d = Math.hypot(c.x[i] - c.x[j], c.z[i] - c.z[j]); if (d > distanceMax) continue;
    const pente = Math.abs(y[i] - y[j]) / Math.max(1, d - 2 * horsPiste);
    if (pente > pire) pire = pente;
    if (pente > .5) conflits.push({ s1: i * P, s2: j * P, distance: Math.round(d), ecart: +(y[i] - y[j]).toFixed(1) });
  }
  return { pire, conflits };
}

function lireAmplitudes(src) {
  const t = readFileSync(path.join(src, 'circuit.js'), 'utf8'), m = t.match(/const AMPLITUDE = (\{[^}]*\});/);
  if (!m) throw new Error('AMPLITUDE introuvable dans circuit.js');
  return new Function('return ' + m[1])();
}

// Script de page : enveloppe BITUME.circuit.creer dès sa déclaration et applique relief22A au circuit rendu.
export function scriptPage(AMPLITUDE) {
  return `/* prototype 22A injecté (tools/prototype-relief.mjs) : relief et dévers proposés, sources du jeu intactes */
(() => {
  const AMPLITUDE = ${JSON.stringify(AMPLITUDE)};
  const relief22A = ${relief22A.toString()};
  const B = globalThis.BITUME = globalThis.BITUME || {};
  let reel;
  Object.defineProperty(B, 'circuit', { configurable: true, enumerable: true, get() { return reel; }, set(v) {
    const creer = v.creer;
    v.creer = function (graine, options) {
      const c = creer.call(this, graine, options);
      try { const r = relief22A(c, AMPLITUDE); c.y = r.y; c.pente = r.pente; c.devers = r.devers; c.prototype22A = { evenements: r.evenements }; }
      catch (e) { console.error('prototype 22A', e); }
      return c;
    };
    reel = v;
  } });
})();
`;
}

// ---------------------------------------------------------------- programme
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
  const src = path.resolve(opt('src', path.join(RACINE, 'src')));
  const sortie = path.resolve(opt('sortie', path.join(RACINE, 'docs/reprise/rapports/procedural-2026-11-18/prototype-22a')));
  const sansPng = argv.includes('--sans-png');
  mkdirSync(sortie, { recursive: true });
  const AMPLITUDE = lireAmplitudes(src);
  if (opt('script-page')) { writeFileSync(path.resolve(opt('script-page')), scriptPage(AMPLITUDE)); console.log('script de page : ' + path.resolve(opt('script-page'))); }
  const { B } = chargerBitume(src), catalogue = lireCatalogue(src), resultats = [], petits = [];
  const ecrire = (nom, svg) => { const f = path.join(sortie, nom); if (sansPng) writeFileSync(f, svg); else ecrireSvgEtPng(f, svg); };
  const charge = (cc, y) => { const kv = courbureVerticale(y, cc.pas, 5); return Array.from(kv, (k, i) => cc.vitesse[i] ** 2 * k / G); };
  const resume = (m, vis, tal, cc) => {
    const n = cc.n; let aveugle = 0, p3 = 0;
    for (let i = 0; i < n; i++) { if (vis[i] < 120) aveugle++; if (Math.abs(cc.pente[i]) > .03) p3++; }
    return { denivele: m.relief.denivele, penteMaxPct: m.relief.penteMaxPct, penteMoyennePct: m.relief.penteMoyennePct, montee: m.relief.montéeCumulée,
      partPenteSup3Pct: arrondi(100 * p3 / n, 1), cretes: m.relief.cretes, cuvettes: m.relief.cuvettes,
      rvMinCrete: m.relief.rayonVerticalMinCrete, rvMinCuvette: m.relief.rayonVerticalMinCuvette,
      allegementMaxG: m.relief.allegementMaxG, ecrasementMaxG: m.relief.chargeVerticaleMaxG,
      partVoitureMasqueeSous120Pct: arrondi(100 * aveugle / n, 1), visibiliteMinM: Math.min(...vis),
      deversMaxDeg: m.devers.maxDeg, deversPartSup1Pct: m.devers.partSup1DegPct, deversPartNulPct: m.devers.partNulPct,
      virages: { releves: m.virages.filter(v => v.relation === 'relevé').length, contraires: m.virages.filter(v => v.relation === 'contraire').length, plats: m.virages.filter(v => v.relation === 'plat').length },
      talusPire: arrondi(tal.pire, 2), talusConflits: tal.conflits.length };
  };
  for (const k of catalogue) {
    const c = creerCircuit(B, k), r = relief22A(c, AMPLITUDE);
    const apres = Object.assign({}, c, { y: r.y, pente: r.pente, devers: r.devers });
    const mA = mesurerTrace(c), mB = mesurerTrace(apres);
    const avant = resume(mA, visibilites(c.y, c.pas), talus(c, c.y), c), propose = resume(mB, visibilites(r.y, c.pas), talus(c, r.y), apres);
    resultats.push({ id: k.id, nom: k.nom, theme: k.theme, graine: k.graine, facteurEcrasementActuel: arrondi(r.facteurActuel, 3),
      reproductionCircuitJs: r.ecartReproduction < 1e-6, fermeture: arrondi(r.ferme, 3), evenements: r.evenements, virages: r.virages, avant, propose,
      conflitsTalus: talus(c, r.y).conflits.slice(0, 12) });
    const sous = `${k.theme} · graine ${k.graine} · ${nombreFr(c.longueur)} m · dénivelé ${nombreFr(avant.denivele, 1)} → ${nombreFr(propose.denivele, 1)} m · pente max ${nombreFr(avant.penteMaxPct, 1)} → ${nombreFr(propose.penteMaxPct, 1)} % · voiture masquée à moins de 120 m : ${nombreFr(avant.partVoitureMasqueeSous120Pct, 1)} → ${nombreFr(propose.partVoitureMasqueeSous120Pct, 1)} % du tour`;
    ecrire(`${k.id}.svg`, svgAvantApres(c, { y: c.y, pente: c.pente }, { y: r.y, pente: r.pente }, {
      titre: `${k.nom} — relief actuel et proposé (prototype 22A)`, sousTitre: sous, chargeAvant: charge(c, c.y), chargeApres: charge(c, r.y),
      noteBas: `Événements : ${r.evenements.map(e => e.type.split(' ')[0] + ' ' + nombreFr(e.s) + ' m (' + (e.amp > 0 ? '+' : '') + nombreFr(e.amp, 1) + ')').join(' · ') || 'aucun'}. Fond gris : stands ; gris soutenu : tunnel.` }));
    petits.push({ c: apres, nom: k.nom, ligneBas: [`dénivelé ${nombreFr(propose.denivele, 1)} m (${nombreFr(avant.denivele, 1)} m)`, `pente max ${nombreFr(propose.penteMaxPct, 1)} % (${nombreFr(avant.penteMaxPct, 1)} %)`] });
    process.stderr.write(`${k.nom} : facteur actuel ${r.facteurActuel.toFixed(3)}, dénivelé ${avant.denivele} → ${propose.denivele} m, ${r.evenements.length} événements\n`);
  }
  ecrire('sept-circuits-propose.svg', svgPetitsMultiples(petits, { titre: 'Relief proposé (prototype 22A) — altitude de l’axe des sept circuits',
    sousTitre: 'Même tracé en plan, mêmes graines ; entre parenthèses, la valeur actuelle. Le fond reprend les harmoniques actuelles sans l’écrasement à 6,8 %.' }));
  writeFileSync(path.join(sortie, 'prototype-22a.json'), JSON.stringify({ date: new Date().toISOString(), src, resultats }, null, 1) + '\n');
  // tableau avant → après
  const l = ['| Circuit | Écrasement actuel | Dénivelé | Pente max | Part du tour > 3 % | Crêtes / cuvettes ≥ 1 m | R vertical mini crête / cuvette | Allègement / écrasement max | Voiture masquée par le relief à moins de 120 m | Dévers max | Tour > 1° de dévers | Virages relevés / contraires / plats | Talus le plus raide entre branches |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  const f = (a, b, d = 1, u = '') => `${nombreFr(a, d)} → **${nombreFr(b, d)}**${u}`;
  for (const x of resultats) {
    const a = x.avant, b = x.propose;
    l.push(`| ${x.nom} | × ${nombreFr(x.facteurEcrasementActuel, 2)} | ${f(a.denivele, b.denivele, 1, ' m')} | ${f(a.penteMaxPct, b.penteMaxPct, 1, ' %')} | ${f(a.partPenteSup3Pct, b.partPenteSup3Pct, 1, ' %')} | ${a.cretes}/${a.cuvettes} → **${b.cretes}/${b.cuvettes}** | ${nombreFr(a.rvMinCrete)}/${nombreFr(a.rvMinCuvette)} → **${nombreFr(b.rvMinCrete)}/${nombreFr(b.rvMinCuvette)}** m | ${nombreFr(a.allegementMaxG, 2)}/${nombreFr(a.ecrasementMaxG, 2)} → **${nombreFr(b.allegementMaxG, 2)}/${nombreFr(b.ecrasementMaxG, 2)}** g | ${f(a.partVoitureMasqueeSous120Pct, b.partVoitureMasqueeSous120Pct, 1, ' %')} | ${f(a.deversMaxDeg, b.deversMaxDeg, 1, '°')} | ${f(a.deversPartSup1Pct, b.deversPartSup1Pct, 1, ' %')} | ${a.virages.releves}/${a.virages.contraires}/${a.virages.plats} → **${b.virages.releves}/${b.virages.contraires}/${b.virages.plats}** | ${f(a.talusPire, b.talusPire, 2)} (${b.talusConflits} paires > 0,5) |`);
  }
  writeFileSync(path.join(sortie, 'tableau.md'), '# Prototype 22A — relief et dévers, avant → après\n\nProduit par `node tools/prototype-relief.mjs` (sources lues sans modification : `' + src + '`).\n\n' + l.join('\n') + '\n');
  console.log(l.join('\n'));
}
