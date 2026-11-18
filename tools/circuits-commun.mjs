/* BITUME — outils communs de l'étude 22 (circuits et génération procédurale).
   Chargement des modules du jeu dans Node sans les modifier, lecture du catalogue de jeu.js, mesures du tracé
   (relief, crêtes et cuvettes, dévers, courbures, lignes droites) et inventaire du décor par famille d'objets.
   Aucune dépendance, aucun appel réseau, rien n'est écrit sur disque ici. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const G = 9.81;
const DEG = 180 / Math.PI;

// ---------------------------------------------------------------- chargement
// Les modules s'écrivent (function (B) { … })(globalThis.BITUME) : ils s'exécutent tels quels dans Node. Le faux
// FRender ne sert qu'à enregistrer les formes libres de la botanique et de la végétation (aucun rendu).
export function chargerBitume(src) {
  const require = createRequire(import.meta.url);
  const formes = new Map();
  if (!globalThis.FRender) globalThis.FRender = { forme: (nom, triangles) => { formes.set(nom, triangles); return nom; } };
  for (const n of ['graphismes', 'carene', 'circuit', 'ecologie', 'saisons', 'botanique', 'vegetation', 'decor'])
    require(path.join(src, n + '.js'));
  return { B: globalThis.BITUME, formes };
}

// Le catalogue vit dans jeu.js (coque du navigateur, non chargeable dans Node) : on n'en lit que le tableau littéral.
export function lireCatalogue(src) {
  const texte = readFileSync(path.join(src, 'jeu.js'), 'utf8');
  const m = texte.match(/const CATALOGUE = \[([\s\S]*?)\n  \];/);
  if (!m) throw new Error('CATALOGUE introuvable dans ' + path.join(src, 'jeu.js'));
  return new Function('return [' + m[1] + ']')();
}

export const creerCircuit = (B, k, options = {}) => B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom, ...options });

// Même résolution du profil que jeu.js : le palier « high » (Fine) avec ses matières et sa végétation.
export function construireDecor(B, c, qualite = 'high', saison = 'ete') {
  const profil = B.graphismes.melange(qualite, 0, { decor: qualite, options: {} });
  return B.decor.construire(c, { qualite: profil.palier, ...profil.decor, saison });
}

// ---------------------------------------------------------------- mesures du tracé
export const CLASSES_RAYON = [
  ['droite', 900, Infinity], ['rapide', 400, 900], ['moyen', 150, 400], ['lent', 70, 150], ['serré', 35, 70], ['épingle', 0, 35]
];
const idx = (i, n) => ((i % n) + n) % n;
const arrondi = (v, d = 1) => Number.isFinite(v) ? +v.toFixed(d) : v;

// Courbure verticale (1/m) par différence seconde sur ±h échantillons : > 0 = cuvette (compression), < 0 = crête.
export function courbureVerticale(y, pas, h = 5) {
  const n = y.length, kv = new Float64Array(n), e = h * pas;
  for (let i = 0; i < n; i++) kv[i] = (y[idx(i + h, n)] - 2 * y[i] + y[idx(i - h, n)]) / (e * e);
  return kv;
}
export function pentes(y, pas) {
  const n = y.length, p = new Float64Array(n);
  for (let i = 0; i < n; i++) p[i] = (y[idx(i + 1, n)] - y[idx(i - 1, n)]) / (2 * pas);
  return p;
}

// Crêtes (sens 1) et cuvettes (sens −1) : extremum local sur ±fenetre m, proéminence d'au moins `minimum` m mesurée
// contre le plus haut des deux creux (ou le plus bas des deux sommets) à ±portee m.
export function extremums(y, pas, sens, { fenetre = 80, portee = 400, minimum = 1 } = {}) {
  const n = y.length, W = Math.round(fenetre / pas), K = Math.round(portee / pas), liste = [];
  for (let i = 0; i < n; i++) {
    const v = sens * y[i];
    let extremum = true;
    for (let j = -W; j <= W && extremum; j++) if (j && sens * y[idx(i + j, n)] > v) extremum = false;
    if (!extremum) continue;
    // plateau : ne garder que le premier échantillon d'un palier égal
    if (sens * y[idx(i - 1, n)] === v) continue;
    let g2 = 0, d2 = 0;
    for (let j = 1; j <= K; j++) { g2 = Math.max(g2, v - sens * y[idx(i - j, n)]); d2 = Math.max(d2, v - sens * y[idx(i + j, n)]); }
    const proeminence = Math.min(g2, d2);
    if (proeminence >= minimum) liste.push({ i, s: i * pas, y: y[i], proeminence });
  }
  return liste;
}

function segmentsCourbes(k, pas, seuil = 1 / 500, trou = 30) {
  const n = k.length, dans = i => Math.abs(k[i]) > seuil;
  // départ sur un échantillon droit pour ne pas couper un virage qui chevauche l'indice 0
  let depart = 0; while (depart < n && dans(depart)) depart++;
  const brut = [];
  for (let j = 0; j < n; j++) {
    const i = idx(depart + j, n);
    if (!dans(i)) continue;
    const sens = Math.sign(k[i]), dernier = brut[brut.length - 1];
    if (dernier && dernier.sens === sens && (j - dernier.jFin) * pas <= trou) dernier.jFin = j;
    else brut.push({ jDebut: j, jFin: j, sens });
  }
  return brut.map(b => ({ debut: idx(depart + b.jDebut, n), fin: idx(depart + b.jFin, n), longueur: (b.jFin - b.jDebut + 1) * pas, sens: b.sens, j0: depart + b.jDebut, j1: depart + b.jFin }));
}

export function mesurerTrace(c) {
  const n = c.n, P = c.pas, L = c.longueur, y = c.y, w = c.largeur / 2;
  let yMin = Infinity, yMax = -Infinity, sMin = 0, sMax = 0, monte = 0;
  for (let i = 0; i < n; i++) {
    if (y[i] < yMin) { yMin = y[i]; sMin = i * P; }
    if (y[i] > yMax) { yMax = y[i]; sMax = i * P; }
    const dy = y[idx(i + 1, n)] - y[i]; if (dy > 0) monte += dy;
  }
  const p = c.pente, absP = Array.from(p, Math.abs).sort((a, b) => a - b);
  let pMonte = 0, pDescend = 0, somme = 0;
  for (let i = 0; i < n; i++) { pMonte = Math.max(pMonte, p[i]); pDescend = Math.min(pDescend, p[i]); somme += Math.abs(p[i]); }
  const kv = courbureVerticale(y, P, 5);
  // charge verticale ressentie à la vitesse de référence : v²·κv/g (> 0 : écrasement, < 0 : allègement)
  let chargeMax = 0, allegementMax = 0, rvMinCrete = Infinity, rvMinCuvette = Infinity;
  for (let i = 0; i < n; i++) {
    const v = c.vitesse[i], q = v * v * kv[i] / G;
    chargeMax = Math.max(chargeMax, q); allegementMax = Math.min(allegementMax, q);
    if (kv[i] < 0) rvMinCrete = Math.min(rvMinCrete, -1 / kv[i]); else if (kv[i] > 0) rvMinCuvette = Math.min(rvMinCuvette, 1 / kv[i]);
  }
  const fiche = (e, sens) => {
    const v = c.vitesse[e.i], k = kv[e.i];
    return { s: e.s, y: arrondi(e.y, 2), proeminence: arrondi(e.proeminence, 2), rayonVertical: arrondi(Math.abs(1 / k), 0),
      vitesseKmh: arrondi(v * 3.6, 0), chargeG: arrondi(v * v * k / G, 3), sens };
  };
  const cretes = extremums(y, P, 1).map(e => fiche(e, 'crête'));
  const cuvettes = extremums(y, P, -1).map(e => fiche(e, 'cuvette'));

  // courbures en plan : part du tour par classe de rayon
  const classes = Object.fromEntries(CLASSES_RAYON.map(([nom]) => [nom, 0]));
  for (let i = 0; i < n; i++) {
    const R = 1 / Math.max(Math.abs(c.courbure[i]), 1e-9);
    for (const [nom, a, b] of CLASSES_RAYON) if (R >= a && R < b) { classes[nom] += P; break; }
  }
  for (const k of Object.keys(classes)) classes[k] = arrondi(100 * classes[k] / L, 1);

  // virages : rayon < 500 m, deux morceaux de même sens séparés de moins de 30 m n'en font qu'un
  const virages = segmentsCourbes(c.courbure, P).map(v => {
    let iMax = v.debut, kMax = 0, angle = 0, devMax = 0;
    for (let j = v.j0; j <= v.j1; j++) {
      const i = idx(j, n), k = c.courbure[i];
      angle += k * P;
      if (Math.abs(k) > kMax) { kMax = Math.abs(k); iMax = i; }
      if (Math.abs(c.devers[i]) > Math.abs(devMax)) devMax = c.devers[i];
    }
    const dApex = c.devers[iMax], relation = Math.abs(dApex) < .2 / DEG ? 'plat' : Math.sign(dApex) === v.sens ? 'relevé' : 'contraire';
    return { debut: v.debut * P, longueur: v.longueur, sens: v.sens > 0 ? 'droite' : 'gauche', rayonMin: arrondi(1 / kMax, 0),
      angle: arrondi(Math.abs(angle) * DEG, 0), deversApexDeg: arrondi(dApex * DEG, 2), deversApexPct: arrondi(Math.tan(dApex) * 100, 2),
      deversMaxDeg: arrondi(devMax * DEG, 2), relation, penteApexPct: arrondi(c.pente[iMax] * 100, 2),
      vitesseApexKmh: arrondi(c.vitesse[iMax] * 3.6, 0), apex: iMax * P };
  });
  let devAbsMax = 0, devSup1 = 0, devNul = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(c.devers[i]) * DEG; devAbsMax = Math.max(devAbsMax, d);
    if (d > 1) devSup1 += P; if (d < .05) devNul += P;
  }

  // lignes droites : rayon > 900 m sur au moins 100 m
  const droites = [];
  {
    const droit = i => Math.abs(c.courbure[i]) < 1 / 900;
    let depart = 0; while (depart < n && droit(depart)) depart++;
    let debut = -1;
    for (let j = 0; j <= n; j++) {
      const i = idx(depart + j, n), d = j < n && droit(i);
      if (d && debut < 0) debut = j;
      if (!d && debut >= 0) { const l = (j - debut) * P; if (l >= 100) droites.push({ debut: idx(depart + debut, n) * P, longueur: l }); debut = -1; }
    }
    droites.sort((a, b) => b.longueur - a.longueur);
  }

  // dégagements latéraux (limite = glissière, depuis le bord de la chaussée)
  const degag = [];
  for (let i = 0; i < n; i++) degag.push(c.limiteG[i] - w, c.limiteD[i] - w);
  degag.sort((a, b) => a - b);
  let tempsRef = 0, vMin = Infinity, vMax = 0;
  for (let i = 0; i < n; i++) { tempsRef += P / c.vitesse[i]; vMin = Math.min(vMin, c.vitesse[i]); vMax = Math.max(vMax, c.vitesse[i]); }

  return {
    relief: {
      altitudeMin: arrondi(yMin, 2), sAltitudeMin: sMin, altitudeMax: arrondi(yMax, 2), sAltitudeMax: sMax,
      denivele: arrondi(yMax - yMin, 2), montéeCumulée: arrondi(monte, 1),
      penteMaxPct: arrondi(absP[absP.length - 1] * 100, 2), penteMonteeMaxPct: arrondi(pMonte * 100, 2), penteDescenteMaxPct: arrondi(pDescend * 100, 2),
      penteMoyennePct: arrondi(somme / n * 100, 2), penteP95Pct: arrondi(absP[Math.floor(.95 * (n - 1))] * 100, 2),
      cretes: cretes.length, cuvettes: cuvettes.length, listeCretes: cretes, listeCuvettes: cuvettes,
      rayonVerticalMinCrete: arrondi(rvMinCrete, 0), rayonVerticalMinCuvette: arrondi(rvMinCuvette, 0),
      chargeVerticaleMaxG: arrondi(chargeMax, 3), allegementMaxG: arrondi(allegementMax, 3)
    },
    devers: { maxDeg: arrondi(devAbsMax, 2), partSup1DegPct: arrondi(100 * devSup1 / L, 1), partNulPct: arrondi(100 * devNul / L, 1) },
    virages, nombreVirages: virages.length,
    courbures: classes,
    droites: { nombre: droites.length, plusLongue: droites[0] ? droites[0].longueur : 0, total: droites.reduce((s, d) => s + d.longueur, 0), liste: droites },
    largeur: c.largeur,
    degagement: { min: arrondi(degag[0], 1), p10: arrondi(degag[Math.floor(.1 * degag.length)], 1), median: arrondi(degag[degag.length >> 1], 1), max: arrondi(degag[degag.length - 1], 1) },
    vitesse: { minKmh: arrondi(vMin * 3.6, 0), maxKmh: arrondi(vMax * 3.6, 0), tempsReference: arrondi(tempsRef, 2) },
    tunnel: c.tunnel ? { debut: c.tunnel.debut, fin: c.tunnel.fin, longueur: c.tunnel.fin - c.tunnel.debut } : null,
    stands: c.stands ? { debut: c.stands.debut, fin: c.stands.fin } : null,
    ligneDroiteDepart: c.ligneDroite
  };
}

// ---------------------------------------------------------------- inventaire du décor
export const NOMS_MATIERES = {
  0: 'métal (glissières, portiques)', 1: 'métal cuivré (toits des villages)', 3: 'béton', 5: 'lampe émissive', 7: 'caoutchouc, noir',
  8: 'sol herbeux', 9: 'roche', 10: 'écorce (historique)', 11: 'feuillage (historique)', 12: 'eau', 13: 'façade enduite (13,x)',
  14: 'asphalte PDR (et peintures de piste)', 16: 'laque (panneaux, bandeaux)', 18: 'tissu (public)', 21: 'recette asphalte',
  22: 'recette béton', 23: 'recette roche', 24: 'recette métal peint', 25: 'recette sol (humus)', 26: 'recette écorce', 27: 'recette feuillage'
};
// une décimale : les façades 13,1 à 13,6 se distinguent (le shader range 13,5 ≤ m < 14,5 dans l'asphalte)
const matiereCle = m => Math.round(m * 10) / 10;
const proche = (a, b, e = .005) => Math.abs(a - b) < e;
const couleur = (o, rgb) => o.color && rgb.every((v, k) => proche(o.color[k], v, .011));
const taille = (o, s) => o.s && s.every((v, k) => v === null || proche(o.s[k], v, .011));

// Famille d'un objet, d'après la façon dont decor.js le fabrique (formes, matières, couleurs et tailles exactes).
export function famille(o, lot, dansTunnel) {
  if (lot.vegetation) {
    const s = String(o.shape || '');
    if (s.startsWith('prairie') || s.startsWith('herbes')) return 'végétation : herbe';
    if (s.startsWith('taillis')) return 'végétation : taillis';
    if (s.startsWith('fougere')) return 'végétation : fougères';
    if (s.startsWith('fleur')) return 'végétation : fleurs';
    if (s.startsWith('humus') || s.startsWith('terreau')) return 'végétation : humus';
    return 'végétation : ' + s;
  }
  const m = o.mat || 0, forme = o.shape;
  if (o.outdoor === false) return 'tunnel : structure';
  if (o.collision === 'tronc' || forme === 'foliage' || String(forme).startsWith('arbre-')) return 'arbres';
  if (o.collision === 'pneus') return 'murs de pneus';
  if (o.collision === 'cabane' || (o.collision === 'toit' && couleur(o, [.9, .42, .06])) || (forme === 'cylinder' && taille(o, [.05, 4.4, .05]))
    || (m === 16 && taille(o, [.02, .55, .8]))) return 'postes de commissaires';
  if (o.collision === 'gradin' || m === 18 || (m === 0 && couleur(o, [.8, .82, .84])) || (o.collision === 'pilier' && forme === 'cylinder' && taille(o, [.22, 7.4, .22]))
    || (m === 16 && o.s && proche(o.s[1], .9) && proche(o.s[2], .12))) return 'tribunes et public';
  if (o.collision === 'batiment' || o.collision === 'muret' || (o.collision === 'toit' && couleur(o, [.30, .32, .34])) || (m === 7 && taille(o, [4.4, 3.2, .12]))
    || (proche(m, 13.2) && taille(o, [null, 8, 12]))) return 'stands';
  if ((o.collision === 'poutre' && (m === 0)) || (o.collision === 'pilier' && taille(o, [.5, 7.2, .5])) || (m === 7 && taille(o, [.12, .78, .78]))
    || (m === 16 && taille(o, [.04, .5, null]))) return 'portique des feux';
  if (m === 14 && o.s && proche(o.s[1], .024)) return 'marquages de grille';
  if ((o.collision === 'pilier' && taille(o, [1.4, 6.8, 1.4])) || (o.collision === 'poutre' && (m === 3 || m === 22)) || (m === 16 && taille(o, [.05, .8, null])))
    return 'passerelle';
  if (m === 0 && forme === 'box' && o.s && proche(o.s[1], .34) && proche(o.s[2], .07)) return 'glissières : lisses';
  if (m === 0 && forme === 'box' && taille(o, [.09, .8, .09])) return 'glissières : poteaux';
  if (m === 16 && o.s && ((proche(o.s[1], .9) && proche(o.s[2], .06)) || (proche(o.s[1], .26) && proche(o.s[2], .03)))) return 'panneaux publicitaires';
  if ((m === 16 && (taille(o, [.08, 1.5, 1.2]) || taille(o, [.03, .18, 1])))) return 'repères de freinage';
  if (forme === 'cylinder' && m === 0 && taille(o, [.08, .6, .08])) return 'repères de freinage';
  if (m > 12.5 && m < 14 && !o.collision) return 'villages : maisons';
  if (m === 1) return 'villages : maisons';
  if ((forme === 'cylinder' && (m === 16 || m === 5) && o.s && o.s[0] >= 2)) return 'villages : phare';
  const rocheuse = m === 9 || m === 23;
  if (rocheuse && dansTunnel) return 'tunnel : colline';
  if ((m === 3 || m === 22) && dansTunnel) return 'tunnel : structure';
  if (o.collision === 'roche' || rocheuse) return 'rochers';
  if (o.s && proche(o.s[1], .07) && (m === 3 || m === 8 || m === 9)) return 'rochers';
  if (forme === 'bevel' && (m === 8 || m === 3)) return 'rochers';
  return 'autres : ' + [forme, m, o.collision || '-', o.s && o.s.map(v => v.toFixed(2)).join('×')].join(' ');
}

// Index spatial des échantillons de l'axe (cases de 20 m), pour retrouver (s, d) d'un point du décor.
export function indexAxe(c) {
  const T = 20, cases = new Map();
  for (let i = 0; i < c.n; i++) {
    const cle = Math.floor(c.x[i] / T) + ',' + Math.floor(c.z[i] / T);
    let l = cases.get(cle); if (!l) cases.set(cle, l = []); l.push(i);
  }
  return function situer(x, z, rayonMax = 600) {
    const cx = Math.floor(x / T), cz = Math.floor(z / T);
    let meilleur = -1, d2 = Infinity;
    for (let r = 0; r * T <= rayonMax + T; r++) {
      for (let a = cx - r; a <= cx + r; a++) for (let b = cz - r; b <= cz + r; b++) {
        if (Math.max(Math.abs(a - cx), Math.abs(b - cz)) !== r) continue;
        const l = cases.get(a + ',' + b); if (!l) continue;
        for (const i of l) { const dx = c.x[i] - x, dz = c.z[i] - z, e = dx * dx + dz * dz; if (e < d2) { d2 = e; meilleur = i; } }
      }
      if (meilleur >= 0 && (r - 1) * T > Math.sqrt(d2)) break;
    }
    if (meilleur < 0) return null;
    const a = c.cap[meilleur], d = (x - c.x[meilleur]) * -Math.sin(a) + (z - c.z[meilleur]) * Math.cos(a);
    return { i: meilleur, s: meilleur * c.pas, distance: Math.sqrt(d2), d };
  };
}

export const FAMILLES_MOBILIER = ['panneaux publicitaires', 'repères de freinage', 'murs de pneus', 'postes de commissaires', 'tribunes et public',
  'stands', 'portique des feux', 'marquages de grille', 'passerelle'];

export function inventaireDecor(c, d, { pasCase = 100 } = {}) {
  const situer = indexAxe(c), nCases = Math.ceil(c.longueur / pasCase), familles = new Map(), autres = new Map();
  const tunnel = c.tunnel;
  const entree = nom => {
    let f = familles.get(nom);
    if (!f) familles.set(nom, f = { objets: 0, loin: 0, solides: 0, matieres: {}, formes: new Set(), cases: new Uint32Array(nCases), casesLarges: new Uint32Array(nCases), distances: [] });
    return f;
  };
  for (const lot of d.lots) {
    const veg = !!lot.vegetation;
    // la version lointaine d'un lot reprend parfois les mêmes objets : elle est comptée à part, en « loin »
    for (const [liste, loin] of [[lot.objets, false], [lot.loin || [], true]]) for (const o of liste) {
      const pos = o.p ? situer(o.p[0], o.p[2]) : null;
      const dansT = !!(tunnel && pos && pos.s > tunnel.debut - 30 && pos.s < tunnel.fin + 30 && Math.abs(pos.d) < 80);
      const nom = famille(o, lot, dansT);
      if (nom.startsWith('autres')) autres.set(nom, (autres.get(nom) || 0) + 1);
      const f = entree(nom);
      if (loin) { f.loin++; continue; }
      f.objets++; if (o.collision) f.solides++;
      const m = matiereCle(o.mat || 0); f.matieres[m] = (f.matieres[m] || 0) + 1;
      f.formes.add(String(o.shape));
      if (pos) {
        const k = Math.min(nCases - 1, Math.floor(pos.s / pasCase));
        if (Math.abs(pos.d) <= 40) f.cases[k]++;
        if (Math.abs(pos.d) <= 120) f.casesLarges[k]++;
        if (!veg || f.distances.length < 20000) f.distances.push(Math.abs(pos.d));
      }
    }
  }
  // zones vides : cases de 100 m sans aucun mobilier de course à moins de 40 m de l'axe (glissières non comptées),
  // puis sans arbre ni rocher à moins de 120 m
  const mobilier = new Uint32Array(nCases), nature = new Uint32Array(nCases), vegetationProche = new Uint32Array(nCases), diversite = new Uint8Array(nCases);
  for (const [nom, f] of familles) for (let k = 0; k < nCases; k++) {
    if (FAMILLES_MOBILIER.includes(nom)) { mobilier[k] += f.cases[k]; if (f.cases[k]) diversite[k]++; }
    if (nom === 'arbres' || nom === 'rochers' || nom.startsWith('villages')) nature[k] += f.casesLarges[k];
    if (nom.startsWith('végétation')) vegetationProche[k] += f.cases[k];
  }
  const suites = tableau => {
    const liste = []; let debut = -1;
    // départ sur une case pleine pour ne pas couper une suite qui chevauche la ligne
    let k0 = 0; while (k0 < nCases && tableau(k0)) k0++;
    if (k0 === nCases) return [{ debut: 0, longueur: c.longueur }];
    for (let j = 0; j <= nCases; j++) {
      const k = (k0 + j) % nCases, vide = j < nCases && tableau(k);
      if (vide && debut < 0) debut = j;
      if (!vide && debut >= 0) { liste.push({ debut: ((k0 + debut) % nCases) * pasCase, longueur: (j - debut) * pasCase }); debut = -1; }
    }
    return liste.sort((a, b) => b.longueur - a.longueur);
  };
  const sansMobilier = suites(k => mobilier[k] === 0), sansRien = suites(k => mobilier[k] === 0 && nature[k] === 0);
  const sansVegetation = suites(k => vegetationProche[k] === 0);
  const total = l => l.reduce((s, z) => s + z.longueur, 0);

  // nappes : sommets par type de surface et matière
  const nappes = {};
  for (const n of d.nappes) {
    const type = n.surfaceType || 'eau', t = nappes[type] || (nappes[type] = { sommets: 0, triangles: 0, matieres: {} });
    const s = n.sommets, nv = s.length / 13;
    t.sommets += nv; t.triangles += n.indices.length / 3;
    for (let v = 0; v < nv; v++) { const m = matiereCle(s[v * 13 + 9]); t.matieres[m] = (t.matieres[m] || 0) + 1; }
  }
  const sortie = {};
  for (const [nom, f] of [...familles].sort((a, b) => a[0].localeCompare(b[0], 'fr'))) {
    const dist = f.distances.sort((a, b) => a - b);
    sortie[nom] = { objets: f.objets, loin: f.loin, solides: f.solides, formes: [...f.formes].length, matieres: f.matieres,
      distanceMedianeAxe: dist.length ? arrondi(dist[dist.length >> 1], 0) : null,
      casesOccupees40m: Array.from(f.cases).filter(v => v > 0).length };
  }
  return {
    familles: sortie, autres: Object.fromEntries(autres), cases: nCases, pasCase,
    mobilierParCase: Array.from(mobilier), natureParCase: Array.from(nature), vegetationParCase: Array.from(vegetationProche),
    diversiteParCase: Array.from(diversite),
    partCasesAuPlusUneFamillePct: arrondi(100 * Array.from(diversite).filter(v => v <= 1).length / nCases, 1),
    zonesSansMobilier: { total: total(sansMobilier), partPct: arrondi(100 * total(sansMobilier) / c.longueur, 1), plusLongues: sansMobilier.slice(0, 6) },
    zonesVides: { total: total(sansRien), partPct: arrondi(100 * total(sansRien) / c.longueur, 1), plusLongues: sansRien.slice(0, 6) },
    zonesSansVegetationProche: { total: total(sansVegetation), partPct: arrondi(100 * total(sansVegetation) / c.longueur, 1) },
    nappes, lots: d.lots.length, vegetation: d.vegetation || null
  };
}

export { arrondi, idx };
