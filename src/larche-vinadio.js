(function (B) {
  'use strict';
if (typeof require === 'function') {
  if (!B.larcheData) { try { require('./larche-vinadio-data.js'); } catch (_) {} }
  if (!B.circuit) { try { require('./circuit.js'); } catch (_) {} }
}

const PAS = 4;
const LARGEUR = 11;
const DEMI_L = LARGEUR / 2;
const PI = Math.PI;
const TWO_PI = PI * 2;

function hache(a, b) {
  let h = (a * 2654435761 ^ b * 40503) >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b >>> 0;
  h = (h >> 16) ^ h;
  return (h & 0x7fffffff) / 0x7fffffff;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function lerp(a, b, t) { return a + (b - a) * t; }

function catmullRomCentripetal(p0, p1, p2, p3, t, alpha) {
  alpha = alpha || 0.5;
  function dist(a, b) { const dx = a[0] - b[0], dz = a[1] - b[1]; return Math.sqrt(dx * dx + dz * dz); }
  function knot(k0, k1, pk, pk1) {
    const d = dist(pk, pk1);
    return k0 + Math.pow(Math.max(d, 1e-6), alpha);
  }
  const t0 = 0;
  const t1 = knot(t0, 0, p0, p1);
  const t2 = knot(t1, 0, p1, p2);
  const t3 = knot(t2, 0, p2, p3);
  const tt = lerp(t1, t2, t);
  function lerp2(ta, tb, pa, pb, t) {
    const f = (t - ta) / (tb - ta + 1e-12);
    return [pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f];
  }
  const A1 = lerp2(t0, t1, p0, p1, tt);
  const A2 = lerp2(t1, t2, p1, p2, tt);
  const A3 = lerp2(t2, t3, p2, p3, tt);
  const B1 = lerp2(t0, t2, A1, A2, tt);
  const B2 = lerp2(t1, t3, A2, A3, tt);
  const C = lerp2(t1, t2, B1, B2, tt);
  return C;
}

function resampleUniform(x10, z10, nRaw, pas) {
  const xs = new Float64Array(nRaw);
  const zs = new Float64Array(nRaw);
  const sRaw = new Float64Array(nRaw);
  for (let i = 0; i < nRaw; i++) { xs[i] = x10[i] / 10; zs[i] = z10[i] / 10; }
  sRaw[0] = 0;
  for (let i = 1; i < nRaw; i++) {
    const dx = xs[i] - xs[i - 1], dz = zs[i] - zs[i - 1];
    sRaw[i] = sRaw[i - 1] + Math.sqrt(dx * dx + dz * dz);
  }
  const longueurTotale = sRaw[nRaw - 1];
  const n = Math.round(longueurTotale / pas) + 1;
  const outX = new Float32Array(n);
  const outZ = new Float32Array(n);
  const outS = new Float32Array(n);

  let idx = 0;
  for (let k = 0; k < n; k++) {
    const s = k * pas;
    while (idx < nRaw - 2 && sRaw[idx + 1] < s) idx++;
    const t = (s - sRaw[idx]) / (sRaw[idx + 1] - sRaw[idx] + 1e-12);
    const i0 = Math.max(0, idx - 1);
    const i1 = idx;
    const i2 = Math.min(nRaw - 1, idx + 1);
    const i3 = Math.min(nRaw - 1, idx + 2);
    const p0 = [xs[i0], zs[i0]];
    const p1 = [xs[i1], zs[i1]];
    const p2 = [xs[i2], zs[i2]];
    const p3 = [xs[i3], zs[i3]];
    const pt = catmullRomCentripetal(p0, p1, p2, p3, clamp(t, 0, 1), 0.5);
    outX[k] = pt[0];
    outZ[k] = pt[1];
    outS[k] = s;
  }
  return { outX, outZ, outS, n, longueurTotale, sRaw };
}

function interpLinear(src, nSrc, nDst) {
  const out = new Float32Array(nDst);
  for (let k = 0; k < nDst; k++) {
    const t = k * (nSrc - 1) / (nDst - 1);
    const i = Math.floor(t);
    const f = t - i;
    const i0 = Math.min(i, nSrc - 1);
    const i1 = Math.min(i + 1, nSrc - 1);
    out[k] = lerp(src[i0], src[i1], f);
  }
  return out;
}

function interpLinearRaw(src, nSrc, nDst) {
  const out = new Float32Array(nDst);
  for (let k = 0; k < nDst; k++) {
    const t = k * (nSrc - 1) / (nDst - 1);
    const i = Math.floor(t);
    const f = t - i;
    const i0 = Math.min(i, nSrc - 1);
    const i1 = Math.min(i + 1, nSrc - 1);
    out[k] = lerp(src[i0], src[i1], f);
  }
  return out;
}

function creer(graine, options) {
  graine = graine || 210;
  options = options || {};
  const D = B.larcheData;
  if (!D) throw new Error('B.larcheData manquant');

  const nRaw = D.x10.length;
  const { outX, outZ, outS, n, longueurTotale, sRaw } = resampleUniform(D.x10, D.z10, nRaw, PAS);
  const longueur = longueurTotale;

  // Interpoler y (altitude relative)
  const yRaw = new Float64Array(nRaw);
  for (let i = 0; i < nRaw; i++) yRaw[i] = D.y10[i] / 10;
  const y = interpLinear(yRaw, nRaw, n);

  // Interpoler coupes terrain
  const g15Raw = new Float64Array(nRaw);
  const d15Raw = new Float64Array(nRaw);
  const g40Raw = new Float64Array(nRaw);
  const d40Raw = new Float64Array(nRaw);
  for (let i = 0; i < nRaw; i++) {
    g15Raw[i] = D.g15[i] / 2;
    d15Raw[i] = D.d15[i] / 2;
    g40Raw[i] = D.g40[i] / 2;
    d40Raw[i] = D.d40[i] / 2;
  }
  const g15 = interpLinear(g15Raw, nRaw, n);
  const d15 = interpLinear(d15Raw, nRaw, n);
  const g40 = interpLinear(g40Raw, nRaw, n);
  const d40 = interpLinear(d40Raw, nRaw, n);

  // Cap, courbure, pente
  const cap = new Float32Array(n);
  const courbure = new Float32Array(n);
  const pente = new Float32Array(n);
  const devers = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const dx = outX[b] - outX[a];
    const dz = outZ[b] - outZ[a];
    cap[i] = Math.atan2(dz, dx);
  }

  // Courbure = dcap/ds, lissée 3 points non-circulaire, plafonnée
  const courbureRaw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    let dc = cap[b] - cap[a];
    while (dc > PI) dc -= TWO_PI;
    while (dc < -PI) dc += TWO_PI;
    const ds = (b - a) * PAS;
    courbureRaw[i] = ds > 0 ? dc / ds : 0;
  }
  // Lissage 3 points non-circulaire
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    courbure[i] = (courbureRaw[a] + courbureRaw[i] + courbureRaw[b]) / 3;
    courbure[i] = clamp(courbure[i], -1 / 14, 1 / 14);
  }

  // Pente
  const penteRaw = new Float32Array(n);
  // Lissage doux anti-overshoot sur y : garantit une pente jouable (<= 16 %) sans casser le dénivelé global
  for (let pass = 0; pass < 400; pass++) {
    let mod = false;
    for (let i = 1; i < n - 1; i++) {
      if (Math.abs(y[i] - y[i - 1]) > PAS * 0.155 || Math.abs(y[i + 1] - y[i]) > PAS * 0.155) {
        y[i] = (y[i - 1] + 2 * y[i] + y[i + 1]) * 0.25;
        mod = true;
      }
    }
    if (!mod) break;
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const ds = (b - a) * PAS;
    penteRaw[i] = ds > 0 ? (y[b] - y[a]) / ds : 0;
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    pente[i] = (penteRaw[a] + penteRaw[i] + penteRaw[b]) / 3;
  }

  // Devers
  const arriveeS = Math.min(longueur - 200, D.longueurCourseM);
  for (let i = 0; i < n; i++) {
    const s = outS[i];
    let dv = -courbure[i] * 1.4;
    dv = clamp(dv, -0.045, 0.045);
    if (s < 80 || s > arriveeS - 40) dv = 0;
    // Sur les ponts → 0
    for (const ov of D.ouvrages) {
      if (ov[0] === 'pont' && s >= ov[1] && s <= ov[2]) { dv = 0; break; }
    }
    devers[i] = dv;
  }

  // Vibreur
  const vibreur = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const s = outS[i];
    if (s < 80 || s > arriveeS) { vibreur[i] = 0; continue; }
    vibreur[i] = Math.abs(courbure[i]) > 0.012 ? 1 : 0;
  }

  // Limites
  const limiteG = new Float32Array(n);
  const limiteD = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = outS[i];
    let lg = DEMI_L + 2.8;
    let ld = DEMI_L + 2.8;
    // Épingles : élargir
    for (const ep of D.epingles) {
      const ds = Math.abs(s - ep[0]);
      if (ds < 60) {
        const f = 1 - ds / 60;
        lg = Math.max(lg, DEMI_L + 2.8 + f * 1.2);
        ld = Math.max(ld, DEMI_L + 2.8 + f * 1.2);
      }
    }
    // Ponts / tunnels / paravalanches : resserrer
    for (const ov of D.ouvrages) {
      if (s >= ov[1] && s <= ov[2]) {
        lg = DEMI_L + 1.1;
        ld = DEMI_L + 1.1;
        break;
      }
    }
    limiteG[i] = lg;
    limiteD[i] = ld;
  }

  // Couverts (tunnels + paravalanches)
  const couverts = [];
  let tunnelPrincipal = null;
  for (const ov of D.ouvrages) {
    const [type, sDebut, sFin, nom] = ov;
    if (type === 'tunnel') {
      const c = { type: 'tunnel', debut: sDebut, fin: sFin, hauteur: 6.2, mur: DEMI_L + 1.8, nom, cote: 'G' };
      couverts.push(c);
      if (!tunnelPrincipal || (sFin - sDebut) > (tunnelPrincipal.fin - tunnelPrincipal.debut)) {
        tunnelPrincipal = c;
      }
    } else if (type === 'paravalanche') {
      const idx = Math.round(sDebut / PAS);
      const cote = (g15[idx] > d15[idx]) ? 'G' : 'D';
      const ouvert = cote === 'G' ? 'D' : 'G';
      couverts.push({ type: 'galerie', debut: sDebut, fin: sFin, hauteur: 6.2, mur: DEMI_L + 1.8, nom, cote, ouvert });
    }
  }

  // Ponts
  const ponts = [];
  for (const ov of D.ouvrages) {
    if (ov[0] === 'pont') {
      ponts.push({ debut: ov[1], fin: ov[2], nom: ov[3], longueur: ov[2] - ov[1] });
    }
  }

  // Lieux
  const lieux = D.reperes.map(r => ({ nom: r[0], categorie: r[1], s: r[2], x: r[3], z: r[4] }));

  // Construire l'objet circuit
  const c = {
    id: 'larche',
    nom: 'Col de Larche → Vinadio',
    graine: graine || 210,
    theme: 'montagne',
    ouvert: true,
    topologie: 'ouvert',
    depart: 0,
    arrivee: arriveeS,
    zoneDeceleration: [arriveeS, longueur],
    altitudeBaseM: D.altitudeBaseM,
    n, pas: PAS, longueur, largeur: LARGEUR,
    x: outX, y, z: outZ, cap, courbure, pente, devers, vibreur, limiteG, limiteD,
    ligne: new Float32Array(n), vitesse: new Float32Array(n),
    tunnel: tunnelPrincipal,
    couverts,
    ponts,
    bords: [],
    lieux,
    coupeTerrain: { g15, d15, g40, d40 },
    larche: {
      reperes: D.reperes,
      epingles: D.epingles,
      lac: D.lac,
      provenance: D.provenance
    }
  };

  // Préparer parcours via B.circuit
  if (B.circuit && B.circuit.preparerParcours) {
    B.circuit.preparerParcours(c);
  }

  // Bornes vitesse descente alpine
  for (let i = 0; i < n; i++) {
    c.vitesse[i] = clamp(c.vitesse[i], 14, 78);
    if (outS[i] > arriveeS) {
      const f = (outS[i] - arriveeS) / (longueur - arriveeS + 1);
      c.vitesse[i] = lerp(c.vitesse[i], 8, f);
    }
  }

  return c;
}

function valider(c) {
  const problems = [];
  if (!c) { problems.push('circuit null'); return problems; }
  if (c.ouvert !== true) problems.push('c.ouvert !== true');
  if (c.depart !== 0) problems.push('c.depart !== 0');
  if (c.arrivee <= 30000) problems.push('c.arrivee <= 30000');
  if (c.longueur <= c.arrivee + 200) problems.push('c.longueur <= c.arrivee + 200');
  if (!c.couverts || c.couverts.length !== 6) problems.push('c.couverts.length !== 6');
  if (!c.ponts || c.ponts.length !== 16) problems.push('c.ponts.length !== 16');
  if (!c.x || !c.y || !c.z || !c.cap || !c.courbure || !c.pente) problems.push('tableaux manquants');
  for (let i = 0; i < c.n; i++) {
    if (!isFinite(c.x[i]) || !isFinite(c.y[i]) || !isFinite(c.z[i])) { problems.push('non-fini à i=' + i); break; }
    if (Math.abs(c.pente[i]) > 0.21) { problems.push('pente excessive à i=' + i); break; }
  }
  return problems;
}

const PROVENANCE = (B.larcheData && B.larcheData.provenance) || {
  source: 'IGN / OpenStreetMap / DTM 5m Alpes-Maritimes & Cuneo',
  format: 'polyligne 2D + coupes transversales DTM',
  mesuresReelles: true,
  conventionsRuntime: 'y = altitude - altitudeBaseM, x/z en mètres locaux'
};

B.larche = { creer, valider, PROVENANCE };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.larche;
