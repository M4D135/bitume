(function (B) {
  'use strict';
if (!B.larcheRelief && typeof require === 'function') require('./larche-relief.js');
if (!B.coniferesAlpins && typeof require === 'function') require('./coniferes-alpins.js');
if (!B.pietraporzio && typeof require === 'function') require('./pietraporzio.js');
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

// Col de Larche → Vinadio · champ de hauteur 2D monovalué H(x,z) · FERRO 0.3.15 · zéro dépendance · zéro Math.random()


/* ──────────────────────────────────────────────
   BRUIT DÉTERMINISTE (aucun Math.random)
   ────────────────────────────────────────────── */
function _hash(ix, iz) {
  let n = (ix * 1619 + iz * 31337) | 0;
  n = (n << 13) ^ n;
  return (((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0);
}
function _noise2(x, z, hash = _hash) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz);
  const c2 = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a * (1 - sx) * (1 - sz) + b * sx * (1 - sz) + c2 * (1 - sx) * sz + d * sx * sz;
}
function _fbm(x, z, oct, hash = _hash) {
  let v = 0, a = 1, f = 1, t = 0;
  for (let o = 0; o < oct; o++) { v += a * _noise2(x * f, z * f, hash); t += a; a *= 0.5; f *= 2.03; }
  return v / t;
}
function _ridge(x, z, oct) {
  let v = 0, a = 1, f = 1, t = 0;
  for (let o = 0; o < oct; o++) { v += a * (1 - Math.abs(_noise2(x * f, z * f) * 2 - 1)); t += a; a *= 0.5; f *= 2.07; }
  return v / t;
}
function _smoothstep(lo, hi, x) {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}
function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function _lerp(a, b, t) { return a + (b - a) * t; }

/* ──────────────────────────────────────────────
   INDEX SPATIAL DES ÉCHANTILLONS DE ROUTE
   cellules 160 m + repli grossier → toujours exact même à 480 m
   ────────────────────────────────────────────── */
function _buildGrilleRoute(c) {
  const P = c.pas, n = c.n;
  const CELL = 240;
  const map = new Map();
  for (let i = 0; i < n; i += 2) {
    const x = c.x[i], z = c.z[i];
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const key = cx + ',' + cz;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(i);
  }
  return { map, CELL, P, n, c };
}

function _queryRoute(gr, x, z) {
  const { map, CELL, P, n, c } = gr;
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  let bestIdx = -1, bestD2 = 1e18;
  let sumY = 0, sumW = 0;
  // Recherche ±2 cellules (±480 m > RANGE=420 m) : rapide et toujours exact !
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const arr = map.get((cx + dx) + ',' + (cz + dz));
      if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const i = arr[k];
        const ddx = c.x[i] - x, ddz = c.z[i] - z;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
        if (d2 < 320 * 320) {
          const w = 1 / ((d2 + 180) * (d2 + 180));
          sumY += c.y[i] * w; sumW += w;
        }
      }
    }
  }
  if (bestIdx < 0) {
    // Repli global rapide (pas 16) si hors bandeau 640 m
    for (let i = 0; i < n; i += 16) {
      const ddx = c.x[i] - x, ddz = c.z[i] - z, d2 = ddx * ddx + ddz * ddz;
      if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
    }
    if (bestIdx < 0) bestIdx = 0;
  }
  const i = bestIdx;
  const iNext = Math.min(n - 1, i + 1), iPrev = Math.max(0, i - 1);
  const tx = c.x[iNext] - c.x[iPrev], tz = c.z[iNext] - c.z[iPrev];
  const tl = Math.hypot(tx, tz) || 1;
  const nx = -tz / tl, nz = tx / tl;
  const dSigned = (x - c.x[i]) * nx + (z - c.z[i]) * nz;
  const absD = Math.sqrt(bestD2);
  const yRoute = c.y[i];
  const ySmooth = sumW > 0 ? (sumY / sumW) : yRoute;
  const ds = Math.hypot(c.x[iNext] - c.x[iPrev], c.z[iNext] - c.z[iPrev]);
  const pente = ds > 0.1 ? (c.y[iNext] - c.y[iPrev]) / ds : 0;
  return { idx: i, d: dSigned, absD, yRoute, ySmooth, pente, s: i * P };
}

/* ──────────────────────────────────────────────
   GÉOMORPHOLOGIE RELATIVE PAR SECTEUR (Valle Stura — deltas doux autour de ySmooth)
   ────────────────────────────────────────────── */
function _geomorphoDelta(s, absD, signD, x, z, c) {
  const sKm = s / 1000;
  const fMont = _smoothstep(35, 360, absD);
  const fCr = _smoothstep(110, 420, absD);
  const ridge = _ridge(x * 0.00095 + 2.7, z * 0.00095 - 3.1, 5);
  const detail = (_fbm(x * 0.0032 + 5.1, z * 0.0032 + 1.9, 4) - 0.5) * 32;

  // Bassin ouvert du col (km 0..2.5) + cuvette du Lac de la Maddalena
  const wCol = 1 - _smoothstep(1.8, 3.2, sKm);
  const hCol = -6 * (1 - fCr) + ridge * 240 * fCr + detail * fMont;

  // Tornanti + haute vallée Stura (km 2.5..14) : versant amont élevé, vallée creusée en contrebas
  const wVal = _smoothstep(1.8, 3.2, sKm) * (1 - _smoothstep(13.0, 14.5, sKm));
  const versantAmont = (ridge * 290 + 45) * fMont;
  const versantAval = -58 * _smoothstep(24, 150, absD) + ridge * 210 * _smoothstep(180, 420, absD);
  const hVal = (signD > 0 ? versantAmont : versantAval) + detail * fMont;

  // Gole delle Barricate (km 14..20) : canyon calcaire encaissé des deux côtés
  const wGole = _smoothstep(13.0, 14.5, sKm) * (1 - _smoothstep(19.0, 21.0, sKm));
  const hGole = (ridge * 310 + 75) * _smoothstep(24, 210, absD) + detail * fMont;

  // Basse vallée Sambuco → Vinadio (km 20..32.8) : vallée alpine boisée puis bassin de Vinadio
  const wBas = _smoothstep(19.0, 21.0, sKm);
  const ouvre = _smoothstep(27.5, 32.5, sKm);
  const hBas = _lerp((signD > 0 ? ridge * 220 : -35 * _smoothstep(25, 130, absD) + ridge * 170 * fCr), ridge * 110 * fCr, ouvre) * fMont + detail * fMont;

  const wSum = wCol + wVal + wGole + wBas || 1;
  return (hCol * wCol + hVal * wVal + hGole * wGole + hBas * wBas) / wSum;
}

/* ──────────────────────────────────────────────
   COLORATION MULTI-STRATES
   ────────────────────────────────────────────── */
// Le pigment utilise des produits entiers 32 bits. Le bruit historique de hauteur,
// partagé avec les accotements, garde exactement ses coordonnées et ses valeurs.
function pigment(ix, iz) {
  let n = Math.imul(ix, 0x1f1f1f1f) ^ Math.imul(iz, 0x68bc21eb);
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function _colorTerrain(x, z, y, ny, route, saison, versant, pigmentMesure) {
  const prairie = _fbm(x * .004 + 1.1, z * .004 - .7, 3, pigment);
  const veine = _noise2(x * .014 + y * .026, z * .006 + 19, pigment);
  const herbe = _smoothstep(.26, .73, prairie);
  const roche = _smoothstep(.92, .63, ny - (veine - .5) * .17);
  const eboulis = _smoothstep(.77, .47, ny) + .38 * _smoothstep(.62, .83, prairie);
  const sec = _smoothstep(.34, .71, veine + (1 - ny) * .28);
  // Pâturages ras, poches d'herbe sèche et strates claires des versants exposés.
  let r = _lerp(.19, .37, herbe) + sec * .090;
  let g = _lerp(.235, .405, herbe) + sec * .024;
  let b = _lerp(.125, .215, herbe) - sec * .018;
  const pierre = .30 + veine * .21 + eboulis * .09;
  r = _lerp(r, pierre * 1.05, roche);
  g = _lerp(g, pierre * 1.01, roche);
  b = _lerp(b, pierre * .94, roche);
  // Le bord de piste garde son sol de proximité. À flanc de vallée, la même
  // répartition de prairie, forêt et roche habille les tuiles proches et le panorama.
  const part = _smoothstep(20,145,route.absD);
  if (part > 0 && versant && versant(x,z,pigmentMesure)) {
    const grain = 1 + .11*(veine-.5);
    r = _lerp(r, pigmentMesure[0]*grain, part);
    g = _lerp(g, pigmentMesure[1]*grain, part);
    b = _lerp(b, pigmentMesure[2]*grain, part);
  }
  const niveau = y - route.yRoute;
  const neve = (1 - _smoothstep(1000, 9000, route.s)) * _smoothstep(145, 245, niveau + 52 * (prairie - .5));
  const hiver = saison?.neige ? _smoothstep(740, 1060, y + (veine - .5) * 90) : 0;
  const neige = Math.max(neve, hiver) * _smoothstep(.47, .83, ny);
  return [_lerp(r, .87, neige), _lerp(g, .89, neige), _lerp(b, .92, neige)];
}

/* ──────────────────────────────────────────────
   HAUTEUR DU TERRAIN H(x,z) — monovalué, continu, garanti SOUS la chaussée & les ponts
   ────────────────────────────────────────────── */
function _H(x, z, gr, c, q = _queryRoute(gr, x, z)) {
  const { absD, d, yRoute, ySmooth, s } = q;

  // Sous les 16 ponts : creuser le ravin sous le tablier (absD <= 54 m) pour zéro herbe sur le pont !
  let sousPont = 0;
  if (c.ponts && absD < 64) {
    for (let pi = 0; pi < c.ponts.length; pi++) {
      const pt = c.ponts[pi];
      if (s >= pt.debut - 28 && s <= pt.fin + 28) {
        const uS = _smoothstep(pt.debut - 28, pt.debut + 4, s) * (1 - _smoothstep(pt.fin - 4, pt.fin + 28, s));
        const uD = 1 - _smoothstep(24, 64, absD);
        if (uS * uD > sousPont) sousPont = uS * uD;
      }
    }
  }

  // Profil de la prairie au voisinage de l’axe, avant le dégagement du maillage triangulé.
  if (absD <= 34) {
    const tBord = _smoothstep(12, 34, absD);
    const hBase = yRoute - 0.55 - tBord * 0.65;
    return hBase - sousPont * 13.5;
  }

  // Coupe DTM réelle (g15/g40 = gauche d<0, d15/d40 = droite d>=0) au-delà de 34 m
  const droite = d >= 0;
  const ct = c.coupeTerrain;
  const delta40 = ct ? _clamp(lire(c, droite ? ct.d40 : ct.g40, s) || 0, -26, 38) : 0;
  const yBase = _lerp(yRoute, ySmooth, _smoothstep(34, 72, absD));
  const geoDelta = _geomorphoDelta(s, absD, droite ? 1 : -1, x, z, c);
  const tMonte = _smoothstep(34, 88, absD);
  let h = _lerp(yRoute - 1.2, yBase + delta40 * 0.45 + geoDelta, tMonte) - sousPont * 13.5;

  // Cuvette naturelle du Lac de la Maddalena au col (km 0..1.5)
  if (c.larche && c.larche.lac && s < 2200) {
    const lac = c.larche.lac;
    const dLac = Math.hypot(x - (lac.cx || 0), z - (lac.cz || 0));
    if (dLac < 260) {
      const mLac = (1 - _smoothstep(90, 260, dLac)) * _smoothstep(24, 42, absD);
      h = _lerp(h, lac.y - 2.2, mLac);
    }
  }
  return h;
}

/* ──────────────────────────────────────────────
   LECTURE DE TABLE (helper interne)
   ────────────────────────────────────────────── */
function lire(c, tab, s) {
  if (!tab) return 0;
  const n = tab.length;
  if (n === 0) return 0;
  const P = c.pas || 1;
  const f = ((s / P) % n + n) % n;
  const i0 = Math.floor(f) % n;
  const i1 = (i0 + 1) % n;
  const t = f - Math.floor(f);
  return tab[i0] * (1 - t) + tab[i1] * t;
}

// Les deux plans des triangles d'une maille, exprimés depuis son coin (0,0).
// La même diagonale sert au dégagement et aux lectures de sol du décor.
function hauteurMaille(h00, h10, h01, h11, impaire, premier, u, v) {
  if (impaire) return premier
    ? h00 + u * (h10 - h00) + v * (h11 - h10)
    : h00 + u * (h11 - h01) + v * (h01 - h00);
  return premier
    ? h00 + u * (h10 - h00) + v * (h01 - h00)
    : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
}

// Intersection en plan d'un triangle de chaussée avec le demi-plan à gauche de l’arête orientée a → b.
// L'altitude de chaussée est interpolée sur chaque nouveau sommet du polygone.
function couperPolygone(points, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, sortie = [];
  let precedent = points[points.length - 1];
  let avant = dx * (precedent.z - a.z) - dz * (precedent.x - a.x);
  for (const p of points) {
    const apres = dx * (p.z - a.z) - dz * (p.x - a.x);
    if ((avant < 0) !== (apres < 0)) {
      const t = avant / (avant - apres);
      sortie.push({ x: lerp(precedent.x, p.x, t), y: lerp(precedent.y, p.y, t), z: lerp(precedent.z, p.z, t) });
    }
    if (apres >= 0) sortie.push(p);
    precedent = p; avant = apres;
  }
  return sortie;
}

function degagerChaussee(c, pas, gr) {
  const sommets = new Map(), demi = c.largeur / 2;
  function sommet(i, j) {
    const cle = i + ',' + j;
    let v = sommets.get(cle);
    if (!v) {
      const x = i * pas, z = j * pas, q = _queryRoute(gr, x, z);
      v = { x: i, z: j, s: q.s, absD: q.absD, yRoute: q.yRoute, h: _H(x,z,gr,c,q), retrait: 0 };
      sommets.set(cle, v);
    }
    return v;
  }
  function section(i) {
    const rx = -Math.sin(c.cap[i]), rz = Math.cos(c.cap[i]), sinD = Math.sin(c.devers[i]);
    return [-demi - 1.2, -demi, -demi + .3, demi - .3, demi, demi + 1.2].map(d => ({
      x: (c.x[i] + rx * d) / pas, z: (c.z[i] + rz * d) / pas,
      y: c.y[i] - clamp(d, -demi, demi) * sinD - .015
    }));
  }
  let debut = section(0);
  for (let k = 1; k < c.n; k++) {
    const fin = section(k), bords = debut.concat(fin);
    const xs = bords.map(p => p.x), zs = bords.map(p => p.z);
    const iMax = Math.floor(Math.max(...xs)), jMax = Math.floor(Math.max(...zs));
    for (let j = Math.floor(Math.min(...zs)); j <= jMax; j++) {
      for (let i = Math.floor(Math.min(...xs)); i <= iMax; i++) {
        const a = sommet(i, j), b = sommet(i + 1, j), d = sommet(i, j + 1), e = sommet(i + 1, j + 1);
        const impaire = (i + j) & 1;
        let retrait = 0;
        for (const premier of [true, false]) {
          const hauteur = p => hauteurMaille(a.h, b.h, d.h, e.h, impaire, premier, p.x - i, p.z - j);
          if (!bords.some(p => hauteur(p) - p.y + .12 > 0)) continue;
          const triangle = impaire ? (premier ? [a, b, e] : [a, e, d]) : (premier ? [a, b, d] : [b, e, d]);
          // Une différence de deux plans atteint son maximum à l'un des sommets
          // de leur intersection. Cela conserve aussi les ravins au droit des ponts.
          for (let l = 0; l < debut.length - 1; l++) {
            for (let polygone of [[debut[l], debut[l + 1], fin[l + 1]], [debut[l], fin[l + 1], fin[l]]]) {
              for (let t = 0; t < 3 && polygone.length; t++)
                polygone = couperPolygone(polygone, triangle[t], triangle[(t + 1) % 3]);
              for (const p of polygone) retrait = Math.max(retrait, hauteur(p) - p.y + .12);
            }
          }
        }
        // Un sommet commun prend le retrait maximal de ses mailles et de
        // toutes les branches d'épingle qui y passent, indépendamment des tuiles.
        if (retrait > 0) for (const point of [a, b, d, e]) point.retrait = Math.max(point.retrait, retrait);
      }
    }
    debut = fin;
  }
  return sommet;
}

/* ──────────────────────────────────────────────
   FONCTION PRINCIPALE terrain()
   ────────────────────────────────────────────── */
function terrain(c, th, interroger, g, ecologie, organique) {
  if (!c || c.id !== 'larche') return null;
  const saison = (g && typeof g === 'object' && g.saison) || null;
  const versant = saison?.neige ? null : B.larcheRelief?.pigmentsRelief(B.larcheData?.reliefVallee);
  const pigmentMesure = [0,0,0];
  const G = 32;
  const TILE = 256;
  const RANGE = 420;

  const gr = _buildGrilleRoute(c);
  const sommetGrille = degagerChaussee(c, G, gr);
  const hauteurSommet = (x,z) => {
    const v = sommetGrille(x/G,z/G);
    return v.h - v.retrait;
  };
  const maillages = new Map(), liste = [];

  let bxMin = Infinity, bxMax = -Infinity, bzMin = Infinity, bzMax = -Infinity;
  const tuilesActives = new Map();
  const rTuiles = Math.ceil(RANGE / TILE);
  for (let i = 0; i < c.n; i++) {
    const cx = c.x[i], cz = c.z[i];
    if (cx < bxMin) bxMin = cx; if (cx > bxMax) bxMax = cx;
    if (cz < bzMin) bzMin = cz; if (cz > bzMax) bzMax = cz;
    if (i % 4 === 0 || i === c.n - 1) {
      const tcx = Math.floor(cx / TILE), tcz = Math.floor(cz / TILE);
      for (let dx = -rTuiles; dx <= rTuiles; dx++) {
        for (let dz = -rTuiles; dz <= rTuiles; dz++) {
          const nx = tcx + dx, nz = tcz + dz;
          const cle = nx + ',' + nz;
          if (!tuilesActives.has(cle)) tuilesActives.set(cle, [nx, nz]);
        }
      }
    }
  }
  bxMin -= RANGE; bxMax += RANGE; bzMin -= RANGE; bzMax += RANGE;

  for (const [nx, nz] of tuilesActives.values()) {
    {
      const tileX0 = nx * TILE, tileZ0 = nz * TILE;
      const tileX1 = tileX0 + TILE, tileZ1 = tileZ0 + TILE;

      const N_LAT = Math.round(TILE / G) + 1;
      const N_LON = N_LAT;
      const nVerts = N_LAT * N_LON;
      const sommets = new Float32Array(nVerts * FLOATS_VERT);
      const indices = new Uint32Array((N_LAT - 1) * (N_LON - 1) * 6);
      const herbeTri = [];

      // pré-calculer les hauteurs
      const hArr = new Float32Array(nVerts);
      for (let k = 0; k < N_LON; k++) {
        for (let j = 0; j < N_LAT; j++) {
          const wx = tileX0 + j * G, wz = tileZ0 + k * G;
          hArr[k * N_LAT + j] = hauteurSommet(wx, wz);
        }
      }

      // remplir sommets
      let vi = 0;
      let nyMin = Infinity, nyMax = -Infinity;
      for (let k = 0; k < N_LON; k++) {
        for (let j = 0; j < N_LAT; j++) {
          const idx = k * N_LAT + j;
          const wx = tileX0 + j * G, wz = tileZ0 + k * G;
          const wy = hArr[idx];
          if (wy < nyMin) nyMin = wy; if (wy > nyMax) nyMax = wy;

          // normale continue aux bords de tuiles
          const hL = j > 0 ? hArr[idx - 1] : hauteurSommet(wx - G, wz);
          const hR = j < N_LAT - 1 ? hArr[idx + 1] : hauteurSommet(wx + G, wz);
          const hD = k > 0 ? hArr[idx - N_LAT] : hauteurSommet(wx, wz - G);
          const hU = k < N_LON - 1 ? hArr[idx + N_LAT] : hauteurSommet(wx, wz + G);
          let dnx = (hL - hR), dny = 2 * G, dnz = (hD - hU);
          const nl = Math.hypot(dnx, dny, dnz) || 1;
          dnx /= nl; dny /= nl; dnz /= nl;

          const off = idx * FLOATS_VERT;
          sommets[off] = wx; sommets[off + 1] = wy; sommets[off + 2] = wz;
          sommets[off + 3] = dnx; sommets[off + 4] = dny; sommets[off + 5] = dnz;
          sommets[off + 6] = 0; sommets[off + 7] = 0; sommets[off + 8] = 0;
          sommets[off + 9] = 25; // organicSoil unifié

          // couleur
          const col = _colorTerrain(wx, wz, wy, dny, sommetGrille(wx/G,wz/G), saison, versant, pigmentMesure);
          sommets[off + 10] = col[0]; sommets[off + 11] = col[1]; sommets[off + 12] = col[2];
          vi++;
        }
      }

      // indices (triangles alternés)
      let ii = 0;
      for (let k = 0; k < N_LON - 1; k++) {
        for (let j = 0; j < N_LAT - 1; j++) {
          const v00 = k * N_LAT + j;
          const v10 = (k + 1) * N_LAT + j;
          const v01 = k * N_LAT + j + 1;
          const v11 = (k + 1) * N_LAT + j + 1;
          if ((k + j) & 1) {
            indices[ii++] = v00; indices[ii++] = v11; indices[ii++] = v01;
            indices[ii++] = v00; indices[ii++] = v10; indices[ii++] = v11;
          } else {
            indices[ii++] = v00; indices[ii++] = v10; indices[ii++] = v01;
            indices[ii++] = v10; indices[ii++] = v11; indices[ii++] = v01;
          }
          if (sommets[v00 * FLOATS_VERT + 4] >= 0.72 && sommets[v01 * FLOATS_VERT + 4] >= 0.72) {
            herbeTri.push(ii - 6, ii - 3);
          }
        }
      }

      const nappeObj = {
        sommets: sommets.subarray(0, vi * FLOATS_VERT),
        indices: indices.subarray(0, ii),
        centre: [(tileX0 + tileX1) / 2, (nyMin + nyMax) / 2, (tileZ0 + tileZ1) / 2],
        rayon: Math.hypot(tileX1 - tileX0, nyMax - nyMin, tileZ1 - tileZ0) / 2
      };
      Object.defineProperty(nappeObj, 'herbeTriangles', { enumerable: false, value: herbeTri });
      Object.defineProperty(nappeObj, 'surfaceType', { enumerable: false, value: 'terrain' });
      if (versant) nappeObj.vertexTint='smooth';
      liste.push(nappeObj);
      maillages.set(nx + ',' + nz, sommets);
    }
  }

  let raccorderPigments;
  if (B.larcheData?.reliefVallee && B.larcheRelief) {
    const bord=versant ? B.larcheRelief.sommetsRaccord(maillages,TILE,G) : undefined;
    const construire = () => B.larcheRelief.construire(B.larcheData.reliefVallee, maillages, TILE, G, saison, bord);
    const panorama = g?.cachePanorama ? B.panoramaCache.obtenir(g.cachePanorama, construire) : construire();
    if (bord) raccorderPigments = () => B.larcheRelief.raccorderPigments(panorama,bord);
    for (const nappe of panorama) {
      if (versant) nappe.vertexTint='smooth';
      liste.push(nappe);
    }
  }

  /* ── Lac de la Maddalena ── */
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

  /* ── Ruban du torrent Stura di Demonte (fond de vallée) ── */
  if (c.stura && c.stura.poly) {
    const stura = c.stura;
    const poly = stura.poly;
    const nPts = poly.length / 2;
    if (nPts >= 3) {
      const nS = nPts;
      const sommetsS = new Float32Array(nS * FLOATS_VERT);
      const indicesS = new Uint32Array(Math.max(0, (nS - 2) * 3));
      let si = 0;
      for (let i = 0; i < nS; i++) {
        const off = i * FLOATS_VERT;
        sommetsS[off] = poly[i * 2];
        sommetsS[off + 1] = stura.y || 0;
        sommetsS[off + 2] = poly[i * 2 + 1];
        sommetsS[off + 3] = 0; sommetsS[off + 4] = 1; sommetsS[off + 5] = 0;
        sommetsS[off + 6] = poly[i * 2] / 2000; sommetsS[off + 7] = poly[i * 2 + 1] / 2000;
        sommetsS[off + 8] = 0;
        sommetsS[off + 9] = 12; sommetsS[off + 10] = 0.10; sommetsS[off + 11] = 0.30; sommetsS[off + 12] = 0.42;
      }
      for (let i = 1; i < nS - 1; i++) {
        indicesS[si++] = 0; indicesS[si++] = i; indicesS[si++] = i + 1;
      }
      let sxMin = Infinity, sxMax = -Infinity, szMin = Infinity, szMax = -Infinity;
      for (let i = 0; i < nPts; i++) {
        if (poly[i*2] < sxMin) sxMin = poly[i*2]; if (poly[i*2] > sxMax) sxMax = poly[i*2];
        if (poly[i*2+1] < szMin) szMin = poly[i*2+1]; if (poly[i*2+1] > szMax) szMax = poly[i*2+1];
      }
      const nappeS = {
        sommets: sommetsS, indices: indicesS.subarray(0, si),
        centre: [(sxMin + sxMax) / 2, stura.y || 0, (szMin + szMax) / 2],
        rayon: Math.hypot(sxMax - sxMin, 4, szMax - szMin) / 2
      };
      Object.defineProperty(nappeS, 'herbeTriangles', { enumerable: false, value: [] });
      Object.defineProperty(nappeS, 'surfaceType', { enumerable: false, value: 'eau' });
      liste.push(nappeS);
    }
  }

  function sol(x, z) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    const sommets = maillages.get(tx + ',' + tz);
    if (!sommets) return _H(x, z, gr, c);
    const gx = (x - tx * TILE) / G, gz = (z - tz * TILE) / G;
    const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
    const ligne = TILE / G + 1, a = (j * ligne + i) * FLOATS_VERT + 1;
    const b = a + FLOATS_VERT, d = a + ligne * FLOATS_VERT, e = d + FLOATS_VERT;
    const impaire = (i + j) & 1;
    return hauteurMaille(sommets[a], sommets[b], sommets[d], sommets[e],
      impaire, impaire ? u >= v : u + v <= 1, u, v);
  }

  return {
    liste,
    sol,
    raccorderPigments,
    bornes: [bxMin, bzMin, bxMax, bzMax],
    niveauEau: undefined,
    paysageBaikal: null
  };
}


// Maillages communs aux bourgs de la Stura. La pente et la largeur réelles sont portées par l'instance.
function formesMaisons(rendu) {
  if (!rendu?.forme) return;
  const toiture = [], pignons = [], cadre = [];
  function face(liste, points) {
    const [a,b,c] = points, u = b.map((v,k) => v-a[k]), v = c.map((q,k) => q-a[k]);
    const n = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const l = Math.hypot(...n); for (let k=0;k<3;k++) n[k] /= l;
    for (let k=1;k+1<points.length;k++) liste.push([a,points[k],points[k+1],n,n,n]);
  }
  for (const cote of [-1,1]) {
    const z=cote*.5, fetage=.5, rive=-.43;
    const pan=[[-.5,fetage,0],[-.5,rive,z],[.5,rive,z],[.5,fetage,0]];
    face(toiture,cote>0?pan:pan.reverse());
    const tranche=[[-.5,-.5,z],[.5,-.5,z],[.5,rive,z],[-.5,rive,z]];
    face(toiture,cote>0?tranche:tranche.reverse());
    const dessous=[[-.5,-.5,z],[-.5,.43,0],[.5,.43,0],[.5,-.5,z]];
    face(toiture,cote>0?dessous:dessous.reverse());
    const x=cote*.5;
    const bout=[[x,-.5,-.5],[x,.5,0],[x,-.5,.5]];
    face(pignons,cote>0?bout:bout.reverse());
    for (const signZ of [-1,1]) {
      const z=signZ*.5, chant=[[x,.43,0],[x,-.5,z],[x,rive,z],[x,.5,0]];
      face(toiture,cote*signZ<0?chant:chant.reverse());
    }
  }
  // La feuillure et ses quatre retours entourent une vitre placée 8 cm derrière le nez du cadre.
  const quad=(x0,y0,x1,y1)=>face(cadre,[[x0,y0,.5],[x1,y0,.5],[x1,y1,.5],[x0,y1,.5]]);
  quad(-.5,-.5,.5,-.41);quad(-.5,.41,.5,.5);quad(-.5,-.41,-.43,.41);quad(.43,-.41,.5,.41);
  quad(-.026,-.41,.026,.41);quad(-.43,.10,.43,.14);
  const trou=[[-.43,-.41],[.43,-.41],[.43,.41],[-.43,.41]];
  for(let i=0;i<4;i++){const [x,y]=trou[i],[u,v]=trou[(i+1)%4];face(cadre,[[x,y,.5],[u,v,.5],[u,v,-.5],[x,y,-.5]]);}
  rendu.forme('stura-couverture',toiture);rendu.forme('stura-pignons',pignons);rendu.forme('stura-cadre',cadre);
}
formesMaisons(globalThis.FRender);

function maisonStura(mx,my,mz,w,h,d,yaw,cote,variante,neige,detail) {
  const proche=[], loin=[], co=Math.cos(yaw), si=Math.sin(yaw);
  const enduits=[[.65,.61,.52],[.76,.70,.58],[.62,.65,.60],[.69,.55,.42]];
  const cadres=[[.33,.24,.17],[.36,.40,.34],[.39,.31,.23],[.42,.27,.19]];
  const bois=[.34,.26,.18], pierre=[.51,.49,.43], zinc=[.34,.36,.35], vitre=[.16,.22,.24];
  const ton=variante%4, direction=-cote;
  function objet(shape,partie,x,y,z,taille,mat,color,distant=false,angle=0) {
    const o={shape, p:[mx+co*x+si*z,my+y,mz-si*x+co*z],r:[0,yaw+angle,0],s:taille,mat,color,architecture:'haute-stura',partie};
    proche.push(o);if(distant)loin.push(o);return o;
  }
  const mur=objet('box','mur',0,h/2-1.2,0,[w,h+2.4,d],ton===0?23:22,enduits[ton],true);
  mur.p[1]=my+h/2-1.2; // Même ordre d’opérations que le centre du solide historique.
  const hauteur=1.65+.14*(variante%5), couverture=objet('stura-couverture','toit',0,h+hauteur/2,0,[w+.6,hauteur,d+.6],
    neige?25:24,neige?[.86,.89,.90]:ton%2?zinc:[.38,.34,.30],true);
  // Même empreinte au sol que les deux silhouettes antérieures, y compris pour un enduit ou de la tôle.
  mur.masqueHerbier=couverture.masqueHerbier=true;
  if (B.decor?.marquerSolide) B.decor.marquerSolide(mur,'box',2);
  objet('stura-pignons','pignons',0,h+hauteur*.44,0,[w,hauteur*.88,d],26,bois,true);
  const chemineeX=(ton%2?-.22:.22)*w, chemineeZ=.12*d;
  objet('box','cheminee',chemineeX,h+hauteur*.86,chemineeZ,[.45,.96,.46],22,pierre,true);
  // Faces latérales vers le col et vers Vinadio, façade principale vers la route. Les détails entrent
  // dans les lots instanciés existants ; le palier léger et les vues lointaines gardent la silhouette.
  function applique(face,leLong,y,sortie,taille,shape,mat,couleur,partie,distant=false) {
    const nx=Math.sin(face), nz=Math.cos(face), demi=Math.abs(nx)>.5?w/2:d/2;
    return objet(shape,partie,nz*leLong+nx*(demi+sortie),y,-nx*leLong+nz*(demi+sortie),taille,mat,couleur,distant,face);
  }
  const rue=direction>0?0:Math.PI;
  function fenetre(face,u,y,l,ha,volets) {
    applique(face,u,y,.035,[l*.92,ha*.91,.06],'box',19.1,vitre,'vitrage');
    applique(face,u,y,.09,[l,ha,.11],'stura-cadre',10,cadres[ton],'menuiserie');
    if(!detail)return;
    applique(face,u,y-ha/2-.025,.115,[l+.12,.095,.24],'box',22,pierre,'appui');
    if(volets)for(const sens of [-1,1])applique(face,u+sens*l*.69,y,.065,[l*.33,ha*.91,.08],'box',10,cadres[ton],'volet');
  }
  const porte=(ton%2?-.15:.16)*w;
  applique(rue,porte,1.04,.04,[ton===0?1.46:1.04,2.08,.09],'box',10,bois,'porte');
  for(const u of [-.26,.26])fenetre(rue,u*w,h-1.05,1.02,1.24,ton!==0);
  fenetre(rue,-porte*1.6,1.25,.84,1.02,false);
  for(const sens of [-1,1]){
    const face=sens*Math.PI/2;
    fenetre(face,(ton%2?.13:-.13)*d,h-1.18,.92,1.16,false);
    if(detail) fenetre(face,-.17*d,1.15,.66,.82,false);
    if(detail && ton%2===0) for(const u of [-.20,0,.20]){
      const haut=hauteur*(.78-Math.abs(u)*1.5);
      applique(face,u*d,h+haut/2,.016,[.105,haut,.035],'box',10,[.17,.145,.12],'jour-fenil');
    }
  }
  return {proche,loin};
}

function poser(c, outils) {
  if (!c || c.id !== 'larche') return null;
  const { terrain: terr, limites, qualite, saison, ajouter } = outils;
  const graine = c.graine || 210;
  const objets = [];
  const isLow = qualite === 'low';

  const MAT_MAP = { pierre: 23, roche: 23, beton: 22, lauze: 23, ardoise: 23, bois: 26, herbe: 25, feuille: 27, metal: 0, acier: 0, eau: 12, neige: 25, enduit: 13.2 };
  const rocheForme = gr => (B.lieux && B.lieux.rocherPour ? B.lieux.rocherPour('montagne', gr >>> 0) : 'octa');
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
    // Portique altitude (traverse orientée EN TRAVERS de la route : local Z = portée, local X = épaisseur)
    const px1 = p.x + tx * 11.2, pz1 = p.z + tz * 11.2;
    const px2 = p.x - tx * 11.2, pz2 = p.z - tz * 11.2;
    if (!estSurRoute(px1, pz1) && !estSurRoute(px2, pz2)) {
      const y1 = Math.min(p.y, terr ? terr.sol(px1, pz1) : p.y) - 1.5;
      const y2 = Math.min(p.y, terr ? terr.sol(px2, pz2) : p.y) - 1.5;
      const yHaut = p.y + 5.6;
      const pilier1 = { forme: 'box', taille: [0.85, yHaut - y1, 0.85], pos: [px1, (yHaut + y1) / 2, pz1], angles: [0, -p.cap, 0], mat: 'pierre', couleur: [0.5, 0.48, 0.44] };
      const pilier2 = { forme: 'box', taille: [0.85, yHaut - y2, 0.85], pos: [px2, (yHaut + y2) / 2, pz2], angles: [0, -p.cap, 0], mat: 'pierre', couleur: [0.5, 0.48, 0.44] };
      const traverse = { forme: 'box', taille: [1.1, 0.85, 23.2], pos: [(px1 + px2) / 2, yHaut + 0.35, (pz1 + pz2) / 2], angles: [0, -p.cap, 0], mat: 'pierre', couleur: [0.52, 0.50, 0.46] };
      add(objets, false, px1, pz1, pilier1);
      add(objets, false, px2, pz2, pilier2);
      add(objets, false, (px1 + px2) / 2, (pz1 + pz2) / 2, traverse);
      if (B.decor && B.decor.marquerSolide) {
        B.decor.marquerSolide(pilier1, 'box', 2);
        B.decor.marquerSolide(pilier2, 'box', 2);
      }
    }
    // Refuge/douane (fondation enfouie sous le sol pour ne jamais flotter en pente)
    if (!isLow) {
      const rx2 = p.x + tx * 22, rz2 = p.z + tz * 22;
      if (!estSurRoute(rx2, rz2)) {
        const yRef = terr ? terr.sol(rx2, rz2) : p.y;
        const refuge = { forme: 'box', taille: [8, 6.4, 6], pos: [rx2, yRef + 1.8, rz2], angles: [0, -p.cap, 0], mat: 'pierre', couleur: [0.6, 0.55, 0.48] };
        const toit = { forme: 'bevel', taille: [9, 2.5, 7], pos: [rx2, yRef + 5.8, rz2], angles: [0, -p.cap, 0], mat: 'lauze', couleur: [0.35, 0.33, 0.32] };
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
      // Rive : blocs rocheux asymétriques irréguliers et texturés (zéro octaèdre symétrique)
      const nGalets = isLow ? 8 : 24;
      for (let i = 0; i < nGalets; i++) {
        const ang = (i / nGalets) * PI * 2 + (hache(i + 17, graine) - 0.5) * 0.42;
        const r = 42 + hache(i, graine) * 28;
        const gx = cx + Math.cos(ang) * r;
        const gz = cz + Math.sin(ang) * r;
        if (estSurRoute(gx, gz)) continue;
        const gy = terr ? terr.sol(gx, gz) : lac.y;
        const taille = 1.6 + hache(i + 100, graine) * 3.4;
        const sx = taille * (0.78 + hache(i + 201, graine) * 0.55);
        const sy = taille * (0.48 + hache(i + 303, graine) * 0.45);
        const sz = taille * (0.72 + hache(i + 409, graine) * 0.62);
        const galet = {
          forme: rocheForme(graine ^ Math.imul(i + 1, 2654435761)),
          taille: [sx, sy, sz],
          pos: [gx, gy + sy * 0.25, gz],
          angles: [(hache(i + 501, graine) - 0.5) * 0.35, hache(i + 601, graine) * PI * 2, (hache(i + 701, graine) - 0.5) * 0.35],
          mat: 'roche',
          couleur: [0.48 + hache(i + 809, graine) * 0.08, 0.46 + hache(i + 811, graine) * 0.07, 0.42 + hache(i + 821, graine) * 0.07]
        };
        add(objets, true, gx, gz, galet);
      }
      // Ponton bois ancré sur la rive du lac (jamais sur la route ni en l'air)
      if (!isLow && !estSurRoute(cx, cz)) {
        const px = cx + 22, pz = cz + 14;
        if (!estSurRoute(px, pz)) {
          const ponton = { forme: 'box', taille: [2.2, 0.35, 10], pos: [px, lac.y + 0.18, pz], angles: [0, 0.45, 0], mat: 'bois', couleur: [0.45, 0.32, 0.18] };
          add(objets, true, px, pz, ponton);
        }
      }
    }
  }

  // 3. Ponts alpins (16) — garde-corps segmentés suivant la courbe et piles strictement SOUS le tablier
  if (c.ponts) {
    for (let pi = 0; pi < c.ponts.length; pi++) {
      const p = c.ponts[pi];
      const lenPont = Math.max(4, p.fin - p.debut);
      const nSeg = Math.max(1, Math.ceil(lenPont / 10));
      const segLen = lenPont / nSeg;

      // Garde-corps segmentés pour épouser parfaitement la courbe du pont sans jamais mordre la chaussée
      for (let si = 0; si < nSeg; si++) {
        const sSeg = p.debut + (si + 0.5) * segLen;
        const pos = getPos(sSeg);
        const capI = pos.cap;
        const tx = -Math.sin(capI), tz = Math.cos(capI);
        const anglesPont = B.decor && B.decor.angles ? B.decor.angles(...B.decor.base([Math.cos(capI), c.pente[pos.idx] || 0, Math.sin(capI)], [0, 1, 0])) : [0, -capI, 0];
        for (const cote of [-1, 1]) {
          const gx = pos.x + tx * (c.largeur / 2 + 0.55) * cote;
          const gz = pos.z + tz * (c.largeur / 2 + 0.55) * cote;
          const gc = { forme: 'box', taille: [segLen + 0.15, 1.05, 0.28], pos: [gx, pos.y + 0.52, gz], angles: anglesPont, mat: 'acier', couleur: [0.42, 0.44, 0.47] };
          add(objets, false, gx, gz, gc);
          if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(gc, 'box', 2);
        }
      }

      // Piles strictement SOUS le tablier (jamais au-dessus de c.y - 0.65 !)
      if (!isLow) {
        const nPiles = Math.max(1, Math.floor(lenPont / 18));
        for (let pp = 0; pp < nPiles; pp++) {
          const sP = p.debut + (pp + 0.5) * lenPont / nPiles;
          const ppIdx = Math.min(Math.round(sP / c.pas), c.n - 1);
          const capP = c.cap[ppIdx], txP = -Math.sin(capP), tzP = Math.cos(capP);
          const topY = c.y[ppIdx] - 0.65;
          for (const cote of [-1, 1]) {
            const px = c.x[ppIdx] + txP * (c.largeur / 2 - 1.4) * cote;
            const pz = c.z[ppIdx] + tzP * (c.largeur / 2 - 1.4) * cote;
            const solY = terr ? terr.sol(px, pz) : topY - 12;
            const botY = Math.min(solY - 2.0, topY - 1.5);
            if (topY - solY < 1.2) continue;
            const hPile = topY - botY;
            const pile = { forme: 'cylinder', taille: [1.1, hPile, 1.1], pos: [px, (topY + botY) / 2, pz], angles: [0, 0, 0], mat: 'pierre', couleur: [0.50, 0.47, 0.42] };
            add(objets, false, px, pz, pile);
          }
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
    if (v.nom === 'Pietraporzio') {
      const ajouterBati=(proche,loin,x,z)=>{
        objets.push(...proche);
        if (ajouter) ajouter(proche,loin,x,z);
      };
      B.pietraporzio.poser(terr,getPos,!!saison?.neige,!isLow,ajouterBati);
      B.pietraporzio.poserCouronne(!!saison?.neige,ajouterBati);
      continue;
    }
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
      const yaw=-pos.cap+(hache(m,7)-.5)*.3;
      const maison=maisonStura(mx,my,mz,w,h,d,yaw,cote,Math.floor(hache(m+701,v.s|0)*32),!!saison?.neige,!isLow);
      objets.push(...maison.proche);
      if(ajouter)ajouter(maison.proche,maison.loin,mx,mz);
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
    // Portique d'arrivée (traverse EN TRAVERS de la route : local Z = portée, piliers ancrés au sol)
    const sArr = c.arrivee;
    const posA = getPos(sArr);
    const txA = -Math.sin(posA.cap), tzA = Math.cos(posA.cap);
    const aX1 = posA.x + txA * 10.4, aZ1 = posA.z + tzA * 10.4;
    const aX2 = posA.x - txA * 10.4, aZ2 = posA.z - tzA * 10.4;
    if (!estSurRoute(aX1, aZ1) && !estSurRoute(aX2, aZ2)) {
      const ya1 = Math.min(posA.y, terr ? terr.sol(aX1, aZ1) : posA.y) - 1.5;
      const ya2 = Math.min(posA.y, terr ? terr.sol(aX2, aZ2) : posA.y) - 1.5;
      const yHautA = posA.y + 6.2;
      const ap1 = { forme: 'box', taille: [0.7, yHautA - ya1, 0.7], pos: [aX1, (yHautA + ya1) / 2, aZ1], angles: [0, -posA.cap, 0], mat: 'metal', couleur: [0.3, 0.3, 0.35] };
      const ap2 = { forme: 'box', taille: [0.7, yHautA - ya2, 0.7], pos: [aX2, (yHautA + ya2) / 2, aZ2], angles: [0, -posA.cap, 0], mat: 'metal', couleur: [0.3, 0.3, 0.35] };
      const atr = { forme: 'box', taille: [1.0, 0.95, 21.6], pos: [(aX1 + aX2) / 2, yHautA + 0.4, (aZ1 + aZ2) / 2], angles: [0, -posA.cap, 0], mat: 'metal', couleur: [0.3, 0.3, 0.35] };
      add(objets, false, aX1, aZ1, ap1);
      add(objets, false, aX2, aZ2, ap2);
      add(objets, false, (aX1 + aX2) / 2, (aZ1 + aZ2) / 2, atr);
    }
  }

  // 6. Rochers alpins organiques asymétriques et texturés (zéro octaèdre symétrique)
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
      const ry = terr ? Math.min(terr.sol(rx, rz), terr.sol(rx - 5, rz), terr.sol(rx + 5, rz), terr.sol(rx, rz - 5), terr.sol(rx, rz + 5)) : c.y[idx];
      const taille = 2.2 + hache(r + 700, graine) * 6.5;
      const sx = taille * (0.75 + hache(r + 711, graine) * 0.65);
      const sy = taille * (0.45 + hache(r + 723, graine) * 0.55);
      const sz = taille * (0.70 + hache(r + 739, graine) * 0.68);
      if (s >= 17800 && s <= 18600 && B.pietraporzio.recouvre(rx,rz,Math.hypot(sx,sz)/2)) continue;
      const rocher = {
        forme: rocheForme(graine ^ Math.imul(r + 13, 1597334677)),
        taille: [sx, sy, sz],
        pos: [rx, ry + sy * 0.10 - 0.55, rz],
        angles: [(hache(r + 801, graine) - 0.5) * 0.42, hache(r, 99) * PI * 2, (hache(r + 853, graine) - 0.5) * 0.42],
        mat: 'roche',
        couleur: [0.38 + hache(r + 901, graine) * 0.10, 0.37 + hache(r + 911, graine) * 0.09, 0.35 + hache(r + 921, graine) * 0.08]
      };
      add(objets, true, rx, rz, rocher);
    }
  }


  // 7. Forêts alpines de mélèzes et conifères le long de la Valle Stura (dès s > 2200 m, ancrées sur terr.sol)
  if (B.coniferesAlpins && ajouter) {
    const detail = qualite === 'high' || qualite === 'ultra' ? 'proche' : 'leger';
    const pasArbre = isLow ? 65 : 28;
    const grF = _buildGrilleRoute(c);
    for (let s = 2200; s < c.longueur - 180; s += pasArbre) {
      const idx = Math.min(Math.round(s / c.pas), c.n - 1);
      const capI = c.cap[idx], txA = -Math.sin(capI), tzA = Math.cos(capI);
      const nb = isLow ? 2 : 6;
      for (let m = 0; m < nb; m++) {
        const h1 = hache(Math.round(s) + m * 31, graine + 17);
        const h2 = hache(Math.round(s) + m * 59, graine + 43);
        const h3 = hache(Math.round(s) + m * 83, graine + 71);
        const cote = (m & 1) ? 1 : -1;
        const dist = 24 + h1 * 110;
        const wx = c.x[idx] + txA * dist * cote + (h2 - 0.5) * 26;
        const wz = c.z[idx] + tzA * dist * cote + (h3 - 0.5) * 26;
        const qr = _queryRoute(grF, wx, wz);
        if (qr.absD < 18) continue;
        const centre = terr ? terr.sol(wx, wz) : c.y[idx];
        const hL = terr ? terr.sol(wx - 4, wz) : centre, hR = terr ? terr.sol(wx + 4, wz) : centre;
        const hD = terr ? terr.sol(wx, wz - 4) : centre, hU = terr ? terr.sol(wx, wz + 4) : centre;
        const wy = Math.min(centre, hL, hR, hD, hU);
        if (Math.hypot((hL - hR) / 8, (hD - hU) / 8) > 0.65) continue;
        // Sous 1780 m (ou s > 2200) : conifères & mélèzes verts/dorés réalistes
        const estMeleze = (h3 > 0.62 && s > 4200 && s < 27000);
        const nu = estMeleze && saison?.id === 'hiver';
        const essence = nu ? 'meleze-nu' : estMeleze ? 'meleze' : 'sapin';
        const taille = (estMeleze ? 9.5 : 12.0) + h2 * 8.5;
        const rL = taille * (estMeleze ? 0.85 : 0.68);
        if (s >= 17800 && s <= 18600 && B.pietraporzio.recouvre(wx,wz,rL/2)) continue;
        const ang = h1 * PI * 2;
        const bois = [0.24, 0.16, 0.10];
        const col = nu ? bois : estMeleze
          ? (saison?.id === 'automne' ? [0.56, 0.35, 0.095] : [0.22 + h1*.07, 0.34 + h2*.08, 0.16 + h3*.04])
          : [0.10 + h2*.055, 0.19 + h3*.075, 0.14 + h1*.045];
        const tronc = { shape: 'cylinder', p: [wx, wy + taille * 0.18 - 0.6, wz], s: [0.42, taille * 0.44 + 1.2, 0.42], r: [0, 0, 0], mat: 26, color: bois };
        // Le pied du fût partagé par les deux silhouettes pénètre le sol de 50 cm.
        const oProche = { shape: B.coniferesAlpins.nom(essence, detail), p: [wx, wy + taille * 0.49 - 0.5, wz], s: [rL, taille * 0.98, rL], r: [0, ang, 0], mat: nu ? 26 : 27, color: col };
        const oLoin = { ...oProche, shape: B.coniferesAlpins.nom(essence, 'loin') };
        ajouter([tronc, oProche], [oLoin], wx, wz);
      }
    }
  }

  // Le quartier est cadré sur la mairie si son empreinte BDTRE est disponible.
  const mairie = B.pietraporzioData?.find(v => v.usage === 'municipio');
  const routeBourg = getPos(mairie?.s ?? villages.find(v => v.nom === 'Pietraporzio').s);
  const pointBourg = mairie ? { x: mairie.x, y: (terr?.sol(mairie.x,mairie.z) ?? routeBourg.y) + mairie.h * .5, z: mairie.z }
    : { x: routeBourg.x, y: routeBourg.y + 8, z: routeBourg.z };
  const posCol = getPos(320), posFort = getPos(Math.min(32250, c.longueur - 400));
  const marqueurs = [
    { nom: 'Col de Larche · Lac de la Maddalena', x: posCol.x, y: posCol.y + 8, z: posCol.z, rayon: 110, hauteur: 44 },
    { nom: 'Vallée de la Stura · Pietraporzio', ...pointBourg, rayon: 115, hauteur: 48 },
    { nom: 'Fort Albertino de Vinadio', x: posFort.x - Math.sin(posFort.cap) * 35, y: posFort.y + 10, z: posFort.z + Math.cos(posFort.cap) * 35, rayon: 105, hauteur: 42 }
  ];
  return { objets, marqueurs };
}

B.larcheDecor = { terrain, couperAccotement, poser };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.larcheDecor;
