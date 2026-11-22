(function (B) {
  'use strict';
const PAS_L = 32;
const OFFSETS = [-260, -160, -90, -42, -16, -9, 9, 16, 42, 90, 160, 260];
const N_LAT = OFFSETS.length;
const SKIP_COL = 5; // quad -9 <-> +9 (sous la chaussée)
const NAPPES_SIZE = 40;
const FLOATS_VERT = 13;
const PI = Math.PI;
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

function hache(a, b) {
  let h = (a * 2654435761 ^ b * 40503) >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b >>> 0;
  h = (h >> 16) ^ h;
  return (h & 0x7fffffff) / 0x7fffffff;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

function fbm(x, z, octaves, graine) {
  let val = 0, amp = 1, freq = 0.004, total = 0;
  for (let o = 0; o < octaves; o++) {
    const ix = Math.floor(x * freq), iz = Math.floor(z * freq);
    const fx = x * freq - ix, fz = z * freq - iz;
    const a = hache(ix + graine, iz);
    const b = hache(ix + 1 + graine, iz);
    const c = hache(ix + graine, iz + 1);
    const d = hache(ix + 1 + graine, iz + 1);
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const v = lerp(lerp(a, b, sx), lerp(c, d, sx), sz);
    val += v * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return (val / total) * 2 - 1;
}

function couperAccotement(c, s, type) {
  if (!c || c.id !== 'larche') return false;
  if (type !== 'herbe' && type !== 'jupe') return false;
  if (!c.ponts) return false;
  for (const p of c.ponts) {
    if (s > p.debut + 2 && s < p.fin - 2) return true;
  }
  return false;
}

function findNearestIdx(c, x, z) {
  let best = 0, bestD = Infinity;
  const step = Math.max(1, Math.floor(c.n / 2000));
  for (let i = 0; i < c.n; i += step) {
    const dx = c.x[i] - x, dz = c.z[i] - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  // Raffinement
  for (let i = Math.max(0, best - step); i <= Math.min(c.n - 1, best + step); i++) {
    const dx = c.x[i] - x, dz = c.z[i] - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function precalcLisse(c) {
  const n = c.n, pas = c.pas, halfW = Math.round(220 / pas);
  const preSin = new Float64Array(n + 1), preCos = new Float64Array(n + 1);
  const preY = new Float64Array(n + 1), preC = new Float64Array(n + 1);
  const preG15 = new Float64Array(n + 1), preD15 = new Float64Array(n + 1);
  const preG40 = new Float64Array(n + 1), preD40 = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    preSin[i + 1] = preSin[i] + Math.sin(c.cap[i]);
    preCos[i + 1] = preCos[i] + Math.cos(c.cap[i]);
    preY[i + 1] = preY[i] + c.y[i];
    preC[i + 1] = preC[i] + Math.abs(c.courbure[i]);
    preG15[i + 1] = preG15[i] + clamp(c.coupeTerrain.g15[i], -6, 6);
    preD15[i + 1] = preD15[i] + clamp(c.coupeTerrain.d15[i], -6, 6);
    preG40[i + 1] = preG40[i] + clamp(c.coupeTerrain.g40[i], -14, 16);
    preD40[i + 1] = preD40[i] + clamp(c.coupeTerrain.d40[i], -14, 16);
  }
  const capLisse = new Float64Array(n), yLisse = new Float64Array(n), courbLisse = new Float64Array(n);
  const g15L = new Float32Array(n), d15L = new Float32Array(n), g40L = new Float32Array(n), d40L = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - halfW), hi = Math.min(n - 1, i + halfW), cnt = hi - lo + 1;
    capLisse[i] = Math.atan2(preSin[hi + 1] - preSin[lo], preCos[hi + 1] - preCos[lo]);
    yLisse[i] = (preY[hi + 1] - preY[lo]) / cnt;
    courbLisse[i] = (preC[hi + 1] - preC[lo]) / cnt;
    g15L[i] = (preG15[hi + 1] - preG15[lo]) / cnt;
    d15L[i] = (preD15[hi + 1] - preD15[lo]) / cnt;
    g40L[i] = (preG40[hi + 1] - preG40[lo]) / cnt;
    d40L[i] = (preD40[hi + 1] - preD40[lo]) / cnt;
  }
  return { capLisse, yLisse, courbLisse, g15L, d15L, g40L, d40L };
}

function hauteurCorridor(c, idx, d, x, z, lisse, tBout) {
  const yRoute = c.y[idx];
  const devers = (c.devers && c.devers[idx]) || 0;
  const g15 = d < 0 ? lisse.g15L[idx] : lisse.d15L[idx];
  const g40 = d < 0 ? lisse.g40L[idx] : lisse.d40L[idx];
  const absD = Math.abs(d);
  const graine = c.graine || 210;

  if (absD <= 16) {
    const yBord = yRoute - d * Math.sin(devers) - 0.14 * smoothstep(6, 16, absD);
    const tG = smoothstep(9, 16, absD);
    return yBord + clamp(g15, -3.5, 3.5) * 0.22 * tG;
  }
  const y16 = yRoute - Math.sign(d) * 16 * Math.sin(devers) - 0.14 + clamp(g15, -3.5, 3.5) * 0.22;
  const y42 = yRoute + clamp(g40, -10, 12) * 0.58;
  if (absD <= 42) {
    const t = smoothstep(16, 42, absD);
    const undul = fbm(x * 0.5 + graine, z * 0.5 - graine, 2, graine) * 0.8 * t;
    return lerp(y16, y42, t) + undul;
  }
  const excess = absD - 42;
  const penteRaw = clamp((g40 - g15) / 30, -0.32, 0.36);
  const penteAmortie = penteRaw * Math.tanh(excess / 95);
  const reliefExt = clamp(penteAmortie * excess * 0.42, -44, 58);
  const crete = fbm(x * 0.20 + graine * 2, z * 0.20 - graine * 2, 3, graine + 7) * 12 * smoothstep(42, 165, absD);
  const yBase = lerp(y42, lisse.yLisse[idx], smoothstep(42, 165, absD) * 0.62);
  return yBase + (reliefExt + crete) * tBout;
}

function terrain(c, th, interroger, g, ecologie, organique) {
  if (!c || c.id !== 'larche') return null;
  const graine = c.graine || 210;
  const n = c.n, altBase = c.altitudeBaseM || 880;
  const lisse = precalcLisse(c);
  const { capLisse, yLisse, courbLisse } = lisse;
  const nCoupes = Math.ceil(c.longueur / PAS_L) + 1;
  const nNappes = Math.ceil((nCoupes - 1) / (NAPPES_SIZE - 1));
  const liste = [];

  let xMin = Infinity, zMin = Infinity, xMax = -Infinity, zMax = -Infinity;

  for (let nappe = 0; nappe < nNappes; nappe++) {
    const kStart = nappe * (NAPPES_SIZE - 1);
    const kEnd = Math.min(kStart + NAPPES_SIZE, nCoupes);
    const nK = kEnd - kStart;
    if (nK < 2) continue;

    const nVerts = nK * N_LAT;
    const sommets = new Float32Array(nVerts * FLOATS_VERT);
    const nQuads = (nK - 1) * (N_LAT - 2);
    const indices = new Uint32Array(nQuads * 6);
    let vi = 0, ii = 0;
    let nxMin = Infinity, nyMin = Infinity, nzMin = Infinity;
    let nxMax = -Infinity, nyMax = -Infinity, nzMax = -Infinity;

    for (let k = 0; k < nK; k++) {
      const kGlobal = kStart + k;
      const s = Math.min(kGlobal * PAS_L, c.longueur);
      const idx = Math.min(Math.round(s / c.pas), n - 1);
      const rx = c.x[idx], rz = c.z[idx];
      const capLoc = c.cap[idx], capL = capLisse[idx];
      const txLoc = -Math.sin(capLoc), tzLoc = Math.cos(capLoc);
      const txL = -Math.sin(capL), tzL = Math.cos(capL);
      const cL = courbLisse[idx];
      const tBout = smoothstep(0, 260, s) * smoothstep(0, 260, c.longueur - s);

      for (let j = 0; j < N_LAT; j++) {
        const dRaw = OFFSETS[j], absD = Math.abs(dRaw);
        const tNorm = smoothstep(28, 95, absD);
        let tx = lerp(txLoc, txL, tNorm), tz = lerp(tzLoc, tzL, tNorm);
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl; tz /= tl;
        const dMax = absD <= 24 ? absD : Math.min(absD, 0.56 / (cL + 0.0024));
        const dEff = Math.sign(dRaw) * Math.max(Math.min(absD, 24), dMax);
        const px = rx + tx * dEff;
        const pz = rz + tz * dEff;
        let py = hauteurCorridor(c, idx, dEff, px, pz, lisse, tBout);

        // Ne jamais traverser une autre branche d'épingle
        if (absD >= 30 && interroger) {
          const q = interroger(px, pz, 85, true);
          if (q && q.i >= 0 && q.d < 34) {
            py = Math.min(py, c.y[q.i] - 1.8);
          }
        }

        const eps = 3;
        const hL = hauteurCorridor(c, idx, dEff - eps, px - tx * eps, pz - tz * eps, lisse, tBout);
        const hR = hauteurCorridor(c, idx, dEff + eps, px + tx * eps, pz + tz * eps, lisse, tBout);
        const idxF = Math.min(idx + 2, n - 1), idxB = Math.max(idx - 2, 0);
        const hF = hauteurCorridor(c, idxF, dEff, px, pz, lisse, tBout);
        const hB = hauteurCorridor(c, idxB, dEff, px, pz, lisse, tBout);
        const dhLat = (hR - hL) / (2 * eps);
        const dhLon = (hF - hB) / Math.max(1, (idxF - idxB) * c.pas);
        const cosC = Math.cos(capLoc), sinC = Math.sin(capLoc);
        let nx = -(dhLat * tx + dhLon * cosC);
        let nz = -(dhLat * tz + dhLon * sinC);
        let ny = 1;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        // Coloration 100 % organique continue (domain warp 2 échelles, zéro bande/facette géométrique)
        const altReal = py + altBase;
        const wx = px + fbm(px * 0.018, pz * 0.018, 2, graine + 31) * 48;
        const wz = pz + fbm(px * 0.018 + 7.3, pz * 0.018 - 5.1, 2, graine + 37) * 48;
        const n1 = 0.5 + 0.5 * fbm(wx * 0.025, wz * 0.025, 3, graine + 19);
        const n2 = 0.5 + 0.5 * fbm(wx * 0.075, wz * 0.075, 2, graine + 43);
        const pAlt = smoothstep(1250, 2020, altReal);
        const pRoche = Math.max(1 - smoothstep(0.66, 0.88, ny), smoothstep(1900 + 60 * n1, 2120 + 60 * n1, altReal) * 0.75);
        const pNeve = smoothstep(2140 + 45 * n1, 2240 + 45 * n1, altReal) * smoothstep(0.58, 0.78, ny);
        let r = lerp(0.20, 0.29, pAlt) + (n1 - 0.5) * 0.07 + (n2 - 0.5) * 0.04;
        let gr = lerp(0.37, 0.39, pAlt) + (n1 - 0.5) * 0.07 + (n2 - 0.5) * 0.04;
        let b = lerp(0.14, 0.19, pAlt) + (n1 - 0.5) * 0.04;
        const rRoc = 0.43 + (n1 - 0.5) * 0.08 + (n2 - 0.5) * 0.05;
        const gRoc = 0.41 + (n1 - 0.5) * 0.07 + (n2 - 0.5) * 0.04;
        const bRoc = 0.37 + (n1 - 0.5) * 0.06;
        r = lerp(r, rRoc, pRoche); gr = lerp(gr, gRoc, pRoche); b = lerp(b, bRoc, pRoche);
        r = lerp(r, 0.90, pNeve); gr = lerp(gr, 0.92, pNeve); b = lerp(b, 0.95, pNeve);
        const mat = 8; // unifié sur 25 par solsProceduraux : zéro coupure 23↔24↔25

        const off = vi * FLOATS_VERT;
        sommets[off] = px;
        sommets[off + 1] = py;
        sommets[off + 2] = pz;
        sommets[off + 3] = nx;
        sommets[off + 4] = ny;
        sommets[off + 5] = nz;
        sommets[off + 6] = j / (N_LAT - 1);
        sommets[off + 7] = kGlobal / nCoupes;
        sommets[off + 8] = 0;
        sommets[off + 9] = mat;
        sommets[off + 10] = clamp(r, 0.04, 0.96);
        sommets[off + 11] = clamp(gr, 0.04, 0.96);
        sommets[off + 12] = clamp(b, 0.04, 0.96);
        vi++;

        if (px < xMin) xMin = px; if (px > xMax) xMax = px;
        if (pz < zMin) zMin = pz; if (pz > zMax) zMax = pz;
        if (px < nxMin) nxMin = px; if (px > nxMax) nxMax = px;
        if (py < nyMin) nyMin = py; if (py > nyMax) nyMax = py;
        if (pz < nzMin) nzMin = pz; if (pz > nzMax) nzMax = pz;
      }
    }

    // Indices quads avec diagonales alternées (enroulement +Y strict, sauter -9 <-> +9 sous la chaussée)
    ii = 0;
    const herbeTri = [];
    for (let k = 0; k < nK - 1; k++) {
      for (let j = 0; j < N_LAT - 1; j++) {
        if (j === SKIP_COL) continue;
        const v00 = k * N_LAT + j;
        const v10 = (k + 1) * N_LAT + j;
        const v01 = k * N_LAT + j + 1;
        const v11 = (k + 1) * N_LAT + j + 1;
        if ((k + j) & 1) {
          indices[ii++] = v00; indices[ii++] = v01; indices[ii++] = v11;
          indices[ii++] = v00; indices[ii++] = v11; indices[ii++] = v10;
        } else {
          indices[ii++] = v00; indices[ii++] = v01; indices[ii++] = v10;
          indices[ii++] = v10; indices[ii++] = v01; indices[ii++] = v11;
        }
        if (sommets[v00 * FLOATS_VERT + 4] >= 0.72 && sommets[v01 * FLOATS_VERT + 4] >= 0.72) {
          herbeTri.push(ii - 6, ii - 3);
        }
      }
    }

    const nappeObj = {
      sommets: sommets.subarray(0, vi * FLOATS_VERT),
      indices: indices.subarray(0, ii),
      centre: [(nxMin + nxMax) / 2, (nyMin + nyMax) / 2, (nzMin + nzMax) / 2],
      rayon: Math.hypot(nxMax - nxMin, nyMax - nyMin, nzMax - nzMin) / 2
    };
    Object.defineProperty(nappeObj, 'herbeTriangles', { enumerable: false, value: herbeTri });
    Object.defineProperty(nappeObj, 'surfaceType', { enumerable: false, value: 'terrain' });
    liste.push(nappeObj);
  }

  // Lac de la Maddalena
  if (c.larche && c.larche.lac) {
    const lac = c.larche.lac;
    const poly = lac.poly;
    const nPts = poly.length / 2;
    if (nPts >= 3) {
      let cx = 0, cz = 0, aire2 = 0;
      let lxMin = Infinity, lxMax = -Infinity, lzMin = Infinity, lzMax = -Infinity;
      for (let i = 0; i < nPts; i++) {
        const x0 = poly[i * 2], z0 = poly[i * 2 + 1];
        const j = (i + 1) % nPts, x1 = poly[j * 2], z1 = poly[j * 2 + 1];
        cx += x0; cz += z0;
        aire2 += x0 * z1 - x1 * z0;
        if (x0 < lxMin) lxMin = x0; if (x0 > lxMax) lxMax = x0;
        if (z0 < lzMin) lzMin = z0; if (z0 > lzMax) lzMax = z0;
      }
      cx /= nPts; cz /= nPts;
      const nLac = nPts + 1;
      const sommetsLac = new Float32Array(nLac * FLOATS_VERT);
      const indicesLac = new Uint32Array(nPts * 3);

      // Centroïde
      sommetsLac[0] = cx; sommetsLac[1] = lac.y; sommetsLac[2] = cz;
      sommetsLac[3] = 0; sommetsLac[4] = 1; sommetsLac[5] = 0;
      sommetsLac[6] = 0.5; sommetsLac[7] = 0.5; sommetsLac[8] = 0;
      sommetsLac[9] = 12; sommetsLac[10] = 0.06; sommetsLac[11] = 0.24; sommetsLac[12] = 0.34;

      const inv = aire2 > 0;
      for (let i = 0; i < nPts; i++) {
        const off = (i + 1) * FLOATS_VERT;
        sommetsLac[off] = poly[i * 2];
        sommetsLac[off + 1] = lac.y;
        sommetsLac[off + 2] = poly[i * 2 + 1];
        sommetsLac[off + 3] = 0; sommetsLac[off + 4] = 1; sommetsLac[off + 5] = 0;
        sommetsLac[off + 6] = poly[i * 2] / 2000; sommetsLac[off + 7] = poly[i * 2 + 1] / 2000;
        sommetsLac[off + 8] = 0;
        sommetsLac[off + 9] = 12; sommetsLac[off + 10] = 0.06; sommetsLac[off + 11] = 0.24; sommetsLac[off + 12] = 0.34;
        const a = i + 1, b = (i + 1) % nPts + 1;
        indicesLac[i * 3] = 0;
        indicesLac[i * 3 + 1] = inv ? b : a;
        indicesLac[i * 3 + 2] = inv ? a : b;
      }

      const nappeLac = {
        sommets: sommetsLac,
        indices: indicesLac,
        centre: [(lxMin + lxMax) / 2, lac.y, (lzMin + lzMax) / 2],
        rayon: Math.hypot(lxMax - lxMin, 4, lzMax - lzMin) / 2
      };
      Object.defineProperty(nappeLac, 'herbeTriangles', { enumerable: false, value: [] });
      Object.defineProperty(nappeLac, 'surfaceType', { enumerable: false, value: 'eau' });
      liste.push(nappeLac);
    }
  }

  // Fonction sol exacte (spectateurs, bâtiments, arbres parfaitement ancrés)
  function sol(x, z) {
    const q = interroger ? interroger(x, z, 220, true) : null;
    const idx = q && q.i >= 0 ? q.i : findNearestIdx(c, x, z);
    const rx = c.x[idx], rz = c.z[idx];
    const capI = c.cap[idx];
    const tx = -Math.sin(capI), tz = Math.cos(capI);
    const d = (x - rx) * tx + (z - rz) * tz;
    const s = idx * c.pas;
    const tBout = smoothstep(0, 260, s) * smoothstep(0, 260, c.longueur - s);
    return hauteurCorridor(c, idx, d, x, z, lisse, tBout);
  }

  return {
    liste,
    sol,
    bornes: [xMin - 400, zMin - 400, xMax + 400, zMax + 400],
    niveauEau: undefined,
    paysageBaikal: null
  };
}

function poser(c, outils) {
  if (!c || c.id !== 'larche') return null;
  const { terrain: terr, limites, qualite, saison, ajouter } = outils;
  const graine = c.graine || 210;
  const objets = [];
  const isLow = qualite === 'low';

  const MAT_MAP = { pierre: 9, roche: 9, beton: 9, lauze: 1, ardoise: 1, bois: 1, metal: 0, acier: 0, eau: 12, neige: 3, enduit: 13.2 };
  function add(objetsArr, loin, x, z, obj) {
    if (!obj) return;
    if (obj.forme && !obj.shape) {
      obj.shape = obj.forme; delete obj.forme;
      obj.p = obj.pos; delete obj.pos;
      obj.s = obj.taille; delete obj.taille;
      obj.r = obj.angles || [0, 0, 0]; delete obj.angles;
      obj.color = obj.couleur || [.5, .5, .5]; delete obj.couleur;
      if (typeof obj.mat === 'string') obj.mat = MAT_MAP[obj.mat] ?? 9;
    }
    objetsArr.push(obj);
    if (ajouter) ajouter([obj], loin ? [obj] : [], x, z);
  }

  function getPos(s) {
    const idx = Math.min(Math.round(s / c.pas), c.n - 1);
    return { x: c.x[idx], y: c.y[idx], z: c.z[idx], cap: c.cap[idx], idx };
  }

  function estSurRoute(x, z) {
    const idx = findNearestIdx(c, x, z);
    const rx = c.x[idx], rz = c.z[idx];
    const capI = c.cap[idx];
    const tx = -Math.sin(capI), tz = Math.cos(capI);
    const d = (x - rx) * tx + (z - rz) * tz;
    return Math.abs(d) < (c.largeur / 2 + 1.5);
  }

  // 1. Col de Larche / Frontière (s = 0..60)
  {
    const p = getPos(30);
    const tx = -Math.sin(p.cap), tz = Math.cos(p.cap);
    const bx = p.x + tx * 14, bz = p.z + tz * 14;
    if (!estSurRoute(bx, bz)) {
      const borne = { forme: 'box', taille: [0.8, 1.6, 0.8], pos: [bx, p.y + 0.8, bz], angles: [0, 0, 0], mat: 'pierre', couleur: [0.55, 0.52, 0.48] };
      add(objets, false, bx, bz, borne);
      if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(borne, 'box', 2);
    }
    // Portique altitude
    const px1 = p.x + tx * 12, pz1 = p.z + tz * 12;
    const px2 = p.x - tx * 12, pz2 = p.z - tz * 12;
    if (!estSurRoute(px1, pz1) && !estSurRoute(px2, pz2)) {
      const pilier1 = { forme: 'box', taille: [0.5, 4.5, 0.5], pos: [px1, p.y + 2.25, pz1], angles: [0, 0, 0], mat: 'pierre', couleur: [0.5, 0.48, 0.44] };
      const pilier2 = { forme: 'box', taille: [0.5, 4.5, 0.5], pos: [px2, p.y + 2.25, pz2], angles: [0, 0, 0], mat: 'pierre', couleur: [0.5, 0.48, 0.44] };
      const traverse = { forme: 'box', taille: [24, 0.6, 1.2], pos: [(px1 + px2) / 2, p.y + 4.8, (pz1 + pz2) / 2], angles: [0, -p.cap, 0], mat: 'pierre', couleur: [0.5, 0.48, 0.44] };
      add(objets, false, px1, pz1, pilier1);
      add(objets, false, px2, pz2, pilier2);
      add(objets, false, (px1 + px2) / 2, (pz1 + pz2) / 2, traverse);
      if (B.decor && B.decor.marquerSolide) {
        B.decor.marquerSolide(pilier1, 'box', 2);
        B.decor.marquerSolide(pilier2, 'box', 2);
      }
    }
    // Refuge/douane
    if (!isLow) {
      const rx2 = p.x + tx * 22, rz2 = p.z + tz * 22;
      if (!estSurRoute(rx2, rz2)) {
        const refuge = { forme: 'box', taille: [8, 4, 6], pos: [rx2, p.y + 2, rz2], angles: [0, -p.cap, 0], mat: 'pierre', couleur: [0.6, 0.55, 0.48] };
        const toit = { forme: 'bevel', taille: [9, 2.5, 7], pos: [rx2, p.y + 5.2, rz2], angles: [0, -p.cap, 0], mat: 'lauze', couleur: [0.35, 0.33, 0.32] };
        add(objets, false, rx2, rz2, refuge);
        add(objets, false, rx2, rz2, toit);
        if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(refuge, 'box', 2);
      }
    }
  }

  // 2. Lac de la Maddalena (s ≈ 750..1200)
  {
    const lac = c.larche && c.larche.lac;
    if (lac && lac.poly) {
      const nPts = lac.poly.length / 2;
      let cx = 0, cz = 0;
      for (let i = 0; i < nPts; i++) { cx += lac.poly[i * 2]; cz += lac.poly[i * 2 + 1]; }
      cx /= nPts; cz /= nPts;
      // Rive : galets/rochers
      const nGalets = isLow ? 8 : 24;
      for (let i = 0; i < nGalets; i++) {
        const ang = (i / nGalets) * PI * 2;
        const r = 45 + hache(i, graine) * 20;
        const gx = cx + Math.cos(ang) * r;
        const gz = cz + Math.sin(ang) * r;
        const gy = terr ? terr.sol(gx, gz) : lac.y;
        const taille = 1.5 + hache(i + 100, graine) * 3;
        const galet = { forme: 'octa', taille: [taille, taille * 0.6, taille], pos: [gx, gy + taille * 0.3, gz], angles: [0, ang, 0], mat: 'roche', couleur: [0.52, 0.50, 0.46] };
        add(objets, true, gx, gz, galet);
      }
      // Ponton bois
      if (!isLow) {
        const pIdx = Math.round(900 / c.pas);
        const px = c.x[pIdx], pz = c.z[pIdx];
        const ponton = { forme: 'box', taille: [2, 0.3, 12], pos: [px + 8, lac.y + 0.15, pz], angles: [0, -c.cap[pIdx], 0], mat: 'bois', couleur: [0.45, 0.32, 0.18] };
        add(objets, true, px + 8, pz, ponton);
      }
    }
  }

  // 3. Ponts alpins (16)
  if (c.ponts) {
    for (let pi = 0; pi < c.ponts.length; pi++) {
      const p = c.ponts[pi];
      const sMid = (p.debut + p.fin) / 2;
      const pos = getPos(sMid);
      const capI = pos.cap;
      const tx = -Math.sin(capI), tz = Math.cos(capI);
      const demiL = (p.fin - p.debut) / 2;
      const anglesPont = B.decor && B.decor.angles ? B.decor.angles(...B.decor.base([Math.cos(capI), c.pente[pos.idx] || 0, Math.sin(capI)], [0, 1, 0])) : [0, -capI, 0];

      // Garde-corps
      for (const cote of [-1, 1]) {
        const gx = pos.x + tx * (c.largeur / 2 + 0.4) * cote;
        const gz = pos.z + tz * (c.largeur / 2 + 0.4) * cote;
        const gc = { forme: 'box', taille: [demiL * 2, 1.1, 0.25], pos: [gx, pos.y + 0.55, gz], angles: anglesPont, mat: 'acier', couleur: [0.4, 0.42, 0.45] };
        add(objets, false, gx, gz, gc);
        if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(gc, 'box', 2);
      }

      // Piles / arche
      if (!isLow) {
        const nPiles = Math.max(1, Math.floor((p.fin - p.debut) / 18));
        for (let pp = 0; pp < nPiles; pp++) {
          const sP = p.debut + (pp + 0.5) * (p.fin - p.debut) / nPiles;
          const ppIdx = Math.min(Math.round(sP / c.pas), c.n - 1);
          const px = c.x[ppIdx], pz = c.z[ppIdx];
          const solY = terr ? terr.sol(px, pz) : c.y[ppIdx] - 12;
          const hPile = c.y[ppIdx] - solY + 1;
          const pile = { forme: 'cylinder', taille: [1.2, hPile, 1.2], pos: [px, solY + hPile / 2, pz], angles: [0, 0, 0], mat: 'pierre', couleur: [0.5, 0.47, 0.42] };
          add(objets, false, px, pz, pile);
          if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(pile, 'cylinder', 2);
        }
      }
    }
  }

  // 4. Villages alpins
  const villages = [
    { nom: 'Argentera', s: 6552.6 },
    { nom: 'Bersezio', s: 9844.8 },
    { nom: 'Pontebernardo', s: 16042.5 },
    { nom: 'Pietraporzio', s: 18206.6 },
    { nom: 'Sambuco', s: 22089.0 },
    { nom: 'Pianche', s: 26753.6 }
  ];
  const nMaisons = isLow ? 2 : 5;
  for (const v of villages) {
    const pos = getPos(v.s);
    const tx = -Math.sin(pos.cap), tz = Math.cos(pos.cap);
    for (let m = 0; m < nMaisons; m++) {
      const cote = (m % 2 === 0) ? 1 : -1;
      const dist = 20 + hache(m, v.s | 0) * 12;
      const along = (hache(m + 50, v.s | 0) - 0.5) * 40;
      const mx = pos.x + tx * dist * cote + Math.cos(pos.cap) * along;
      const mz = pos.z + tz * dist * cote + Math.sin(pos.cap) * along;
      if (estSurRoute(mx, mz)) continue;
      const my = terr ? terr.sol(mx, mz) : pos.y;
      const w = 5 + hache(m + 200, v.s | 0) * 3;
      const h = 4 + hache(m + 300, v.s | 0) * 2;
      const d = 4 + hache(m + 400, v.s | 0) * 2;
      const maison = { forme: 'box', taille: [w, h + 2.4, d], pos: [mx, my + h / 2 - 1.2, mz], angles: [0, -pos.cap + (hache(m, 7) - 0.5) * 0.3, 0], mat: 'pierre', couleur: [0.62, 0.58, 0.50] };
      const toit = { forme: 'bevel', taille: [w + 0.6, 2.2, d + 0.6], pos: [mx, my + h + 0.9, mz], angles: [0, -pos.cap + (hache(m, 7) - 0.5) * 0.3, 0], mat: 'ardoise', couleur: [0.3, 0.28, 0.30] };
      add(objets, true, mx, mz, maison);
      add(objets, true, mx, mz, toit);
      if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(maison, 'box', 2);
    }
    // Clocher à Bersezio et Sambuco
    if (!isLow && (v.nom === 'Bersezio' || v.nom === 'Sambuco')) {
      const cx2 = pos.x + tx * 26, cz2 = pos.z + tz * 26;
      if (!estSurRoute(cx2, cz2)) {
        const cy = terr ? terr.sol(cx2, cz2) : pos.y;
        const clocher = { forme: 'cylinder', taille: [1.5, 10, 1.5], pos: [cx2, cy + 5, cz2], angles: [0, 0, 0], mat: 'pierre', couleur: [0.58, 0.55, 0.50] };
        const flèche = { forme: 'octa', taille: [1.2, 4, 1.2], pos: [cx2, cy + 12, cz2], angles: [0, 0, 0], mat: 'ardoise', couleur: [0.28, 0.26, 0.28] };
        add(objets, true, cx2, cz2, clocher);
        add(objets, true, cx2, cz2, flèche);
        if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(clocher, 'cylinder', 2);
      }
    }
  }

  // 5. Vinadio & Fort Albertino (s ≈ 32100..32450)
  {
    const sFort = 32250;
    const pos = getPos(sFort);
    const tx = -Math.sin(pos.cap), tz = Math.cos(pos.cap);
    const fx = pos.x + tx * 35, fz = pos.z + tz * 35;
    if (!estSurRoute(fx, fz)) {
      const fy = terr ? terr.sol(fx, fz) : pos.y;
      // Muraille bastionnée
      const muraille = { forme: 'box', taille: [60, 8, 4], pos: [fx, fy + 4, fz], angles: [0, -pos.cap, 0], mat: 'pierre', couleur: [0.68, 0.62, 0.48] };
      add(objets, true, fx, fz, muraille);
      if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(muraille, 'box', 2);
      // Tours d'angle
      for (const cote of [-1, 1]) {
        const tX = fx + Math.cos(pos.cap) * 30 * cote;
        const tZ = fz + Math.sin(pos.cap) * 30 * cote;
        const tY = terr ? terr.sol(tX, tZ) : fy;
        const tour = { forme: 'cylinder', taille: [3, 12, 3], pos: [tX, tY + 6, tZ], angles: [0, 0, 0], mat: 'pierre', couleur: [0.65, 0.60, 0.46] };
        add(objets, true, tX, tZ, tour);
        if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(tour, 'cylinder', 2);
      }
      // Créneaux
      if (!isLow) {
        for (let cr = 0; cr < 12; cr++) {
          const crX = fx + Math.cos(pos.cap) * (cr - 6) * 5;
          const crZ = fz + Math.sin(pos.cap) * (cr - 6) * 5;
          const crY = terr ? terr.sol(crX, crZ) : fy;
          const creneau = { forme: 'box', taille: [1.5, 1.5, 1.5], pos: [crX, crY + 8.75, crZ], angles: [0, -pos.cap, 0], mat: 'pierre', couleur: [0.65, 0.60, 0.46] };
          add(objets, true, crX, crZ, creneau);
        }
      }
    }
    // Portique d'arrivée
    const sArr = c.arrivee;
    const posA = getPos(sArr);
    const txA = -Math.sin(posA.cap), tzA = Math.cos(posA.cap);
    const aX1 = posA.x + txA * 10, aZ1 = posA.z + tzA * 10;
    const aX2 = posA.x - txA * 10, aZ2 = posA.z - tzA * 10;
    if (!estSurRoute(aX1, aZ1) && !estSurRoute(aX2, aZ2)) {
      const ap1 = { forme: 'box', taille: [0.6, 6, 0.6], pos: [aX1, posA.y + 3, aZ1], angles: [0, 0, 0], mat: 'metal', couleur: [0.3, 0.3, 0.35] };
      const ap2 = { forme: 'box', taille: [0.6, 6, 0.6], pos: [aX2, posA.y + 3, aZ2], angles: [0, 0, 0], mat: 'metal', couleur: [0.3, 0.3, 0.35] };
      const atr = { forme: 'box', taille: [20, 1, 1], pos: [(aX1 + aX2) / 2, posA.y + 6.5, (aZ1 + aZ2) / 2], angles: [0, -posA.cap, 0], mat: 'metal', couleur: [0.3, 0.3, 0.35] };
      add(objets, false, aX1, aZ1, ap1);
      add(objets, false, aX2, aZ2, ap2);
      add(objets, false, (aX1 + aX2) / 2, (aZ1 + aZ2) / 2, atr);
    }
  }

  // 6. Rochers alpins organiques
  if (!isLow) {
    const nRochers = 80;
    for (let r = 0; r < nRochers; r++) {
      const s = hache(r, graine) * c.longueur;
      const idx = Math.min(Math.round(s / c.pas), c.n - 1);
      const capI = c.cap[idx];
      const tx = -Math.sin(capI), tz = Math.cos(capI);
      const cote = hache(r + 500, graine) > 0.5 ? 1 : -1;
      const dist = 30 + hache(r + 600, graine) * 120;
      const rx = c.x[idx] + tx * dist * cote;
      const rz = c.z[idx] + tz * dist * cote;
      if (estSurRoute(rx, rz)) continue;
      const ry = terr ? terr.sol(rx, rz) : c.y[idx];
      const taille = 2 + hache(r + 700, graine) * 6;
      const rocher = { forme: 'octa', taille: [taille, taille * 0.7, taille * 0.9], pos: [rx, ry + taille * 0.35, rz], angles: [0, hache(r, 99) * PI * 2, 0], mat: 'roche', couleur: [0.42, 0.40, 0.37] };
      add(objets, true, rx, rz, rocher);
    }
  }

  const posCol = getPos(320), posViaduc = getPos(Math.min(18200, c.longueur * 0.52)), posFort = getPos(Math.min(32250, c.longueur - 400));
  const marqueurs = [
    { nom: 'Col de Larche · Lac de la Maddalena', x: posCol.x, y: posCol.y + 8, z: posCol.z, rayon: 110, hauteur: 44 },
    { nom: 'Vallée de la Stura · Pietraporzio', x: posViaduc.x, y: posViaduc.y + 8, z: posViaduc.z, rayon: 115, hauteur: 48 },
    { nom: 'Fort Albertino de Vinadio', x: posFort.x - Math.sin(posFort.cap) * 35, y: posFort.y + 10, z: posFort.z + Math.cos(posFort.cap) * 35, rayon: 105, hauteur: 42 }
  ];
  return { objets, marqueurs };
}

B.larcheDecor = { terrain, couperAccotement, poser };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.larcheDecor;
