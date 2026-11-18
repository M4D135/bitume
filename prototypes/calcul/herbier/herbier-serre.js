// Lot 28 « calcul » — prototype : herbier de decor.js (creerHerbier) réécrit en JavaScript resserré.
// Même algorithme, mêmes opérations dans le même ordre (résultats identiques au bit près, vérifiés par
// prototypes/calcul/herbier/banc-herbier.mjs), mais : polygones dans une arène Float64Array au lieu de tableaux de
// tableaux, aucune fermeture ni tableau jeté dans les boucles, grilles à clés numériques au lieu de chaînes.
// Le noyau de découpe (decouper) est séparé : il existe aussi en C compilé en WebAssembly (herbier.c).
'use strict';

const EPS = 1e-7, MAILLE = 32;

// ---------------------------------------------------------------- grille à clés numériques (ordre conservé)
function cleCase(x, z) { return (x + 1048576) * 2097152 + (z + 1048576); }
function grille(n, BX) {
  const g = new Map();
  for (let k = 0; k < n; k++) {
    const x0 = Math.floor(BX[4 * k] / MAILLE), x1 = Math.floor(BX[4 * k + 1] / MAILLE), z0 = Math.floor(BX[4 * k + 2] / MAILLE), z1 = Math.floor(BX[4 * k + 3] / MAILLE);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const cle = cleCase(x, z), ids = g.get(cle); if (ids) ids.push(k); else g.set(cle, [k]); }
  }
  return g;
}
// candidats d'une boîte, dans l'ordre de l'original (x puis z, ids dans l'ordre d'insertion, sans doublon)
function candidats(g, marques, tour, bx0, bx1, bz0, bz1, sortie, n0) {
  let n = n0;
  for (let x = Math.floor(bx0 / MAILLE); x <= Math.floor(bx1 / MAILLE); x++) for (let z = Math.floor(bz0 / MAILLE); z <= Math.floor(bz1 / MAILLE); z++) {
    const ids = g.get(cleCase(x, z)); if (!ids) continue;
    for (let q = 0; q < ids.length; q++) { const id = ids[q]; if (marques[id] !== tour) { marques[id] = tour; sortie[n++] = id; } }
  }
  return n;
}

// ---------------------------------------------------------------- préparation (JS, partagée par les deux noyaux)
// Les calculs qui passent par Math.hypot, Math.sin, Math.cos et B.circuit restent ici, en JavaScript : le noyau
// n'emploie que + − × ÷ et des comparaisons, exactes partout (IEEE 754), en JS comme en WebAssembly.
function preparer(B, c, nappes, lots, lim, enceinte, niveauEau) {
  let total = 0; for (const nap of nappes) total += nap.indices.length / 3;
  const P = new Float64Array(9 * total), PL = new Float64Array(3 * total), LEN = new Float64Array(total), BX = new Float64Array(4 * total), VEG = new Uint8Array(total);
  const sources = []; // objets de sortie (plan, normale, couleur, type) des seules surfaces végétalisables
  let n = 0; const brutes = [];
  for (const nap of nappes) {
    const herbe = new Set(nap.herbeTriangles || []), S = nap.sommets, I = nap.indices;
    for (let offset = 0; offset < I.length; offset += 3) {
      const i0 = I[offset] * 13, i1 = I[offset + 1] * 13, i2 = I[offset + 2] * 13;
      let ax = S[i0], ay = S[i0 + 1], az = S[i0 + 2], bx = S[i1], by = S[i1 + 1], bz = S[i1 + 2], dx_ = S[i2], dy_ = S[i2 + 1], dz_ = S[i2 + 2];
      // orienter : aire2 de l'original, même ordre d'opérations
      let s = 0; s = s + ax * bz - bx * az; s = s + bx * dz_ - dx_ * bz; s = s + dx_ * az - ax * dz_;
      if (s < 0) { let t = ax; ax = dx_; dx_ = t; t = ay; ay = dy_; dy_ = t; t = az; az = dz_; dz_ = t; }
      // plan
      const ux = bx - ax, uz = bz - az, vx = dx_ - ax, vz = dz_ - az, det = ux * vz - uz * vx;
      if (Math.abs(det) < .00001) continue;
      const uy = by - ay, vy = dy_ - ay, pdx = (uy * vz - vy * uz) / det, pdz = (ux * vy - vx * uy) / det;
      const len = Math.hypot(pdx, 1, pdz), h = ay - pdx * ax - pdz * az, ny = 1 / len;
      const vegetalisable = herbe.has(offset) && ny >= .62;
      const k = n++;
      P[9 * k] = ax; P[9 * k + 1] = ay; P[9 * k + 2] = az; P[9 * k + 3] = bx; P[9 * k + 4] = by; P[9 * k + 5] = bz; P[9 * k + 6] = dx_; P[9 * k + 7] = dy_; P[9 * k + 8] = dz_;
      PL[3 * k] = pdx; PL[3 * k + 1] = pdz; PL[3 * k + 2] = h; LEN[k] = len;
      BX[4 * k] = Math.min(ax, bx, dx_); BX[4 * k + 1] = Math.max(ax, bx, dx_); BX[4 * k + 2] = Math.min(az, bz, dz_); BX[4 * k + 3] = Math.max(az, bz, dz_);
      if (vegetalisable) {
        VEG[k] = 1; brutes.push(k);
        const color = [0, 0, 0];
        for (let q = 0; q < 3; q++) { let sc = 0; sc = sc + S[i0 + 10 + q] / 3; sc = sc + S[i1 + 10 + q] / 3; sc = sc + S[i2 + 10 + q] / 3; color[q] = sc; }
        sources[k] = { plan: { dx: pdx, dz: pdz, h, normal: [-pdx / len, 1 / len, -pdz / len], len }, color, type: nap.surfaceType };
      }
    }
  }
  // masques (route et empreintes), comme l'original ; orientés, en (x, z)
  const MX = [], MO = [0], MBXl = [];
  const masquer = pts => {
    let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s = s + a[0] * b[2] - b[0] * a[2]; }
    if (s < 0) pts = pts.slice().reverse();
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of pts) { MX.push(p[0], p[2]); if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2]; }
    MO.push(MX.length / 2); MBXl.push(x0, x1, z0, z1);
  };
  const w = c.largeur / 2;
  for (let i = 0; i < c.n; i++) {
    const j = (i + 1) % c.n, s = B.circuit.ecart(c, 0, i * c.pas);
    const tunnel = B.circuit.dansTunnel && B.circuit.dansTunnel(c, i * c.pas, 25);
    const paddock = s > enceinte.debut - 20 && s < enceinte.fin + 20;
    const gauche = tunnel ? Math.max(lim.G[i], lim.G[j]) + 32 : w + 1.24;
    const droite = tunnel ? Math.max(lim.D[i], lim.D[j]) + 32 : paddock ? w + 28 : w + 1.24;
    const p = (k, d) => [c.x[k] - Math.sin(c.cap[k]) * d, 0, c.z[k] + Math.cos(c.cap[k]) * d];
    masquer([p(i, -gauche), p(i, droite), p(j, droite), p(j, -gauche)]);
  }
  for (const lot of lots) for (const o of lot.objets) {
    const m = Math.floor((o.mat || 0) + .01);
    if (!(o.collision && o.collision !== 'poutre') && m !== 9 && m !== 23 && m !== 13) continue;
    const a = -(o.r ? o.r[1] : 0), co = Math.cos(a), si = Math.sin(a);
    const hx = o.s[0] / 2 + .10, hz = o.s[2] / 2 + .10;
    const points = [];
    if (o.shape === 'cylinder' || o.shape === 'sphere' || o.shape === 'octa') {
      for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; points.push([o.p[0] + Math.cos(t) * hx * 1.08, 0, o.p[2] + Math.sin(t) * hz * 1.08]); }
    } else for (const [x, z] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) points.push([o.p[0] + co * x - si * z, 0, o.p[2] + si * x + co * z]);
    masquer(points);
  }
  const nM = MO.length - 1, M = new Float64Array(MX), MOff = new Int32Array(MO), MBX = new Float64Array(MBXl);
  // candidats de chaque surface végétalisable (format CSR), filtrés par recouvrement de boîtes
  const gM = grille(nM, MBX), gC = grille(n, BX);
  const marquesM = new Uint32Array(nM), marquesC = new Uint32Array(n);
  const nb = brutes.length, CMO = new Int32Array(nb + 1), CCO = new Int32Array(nb + 1);
  let CM = new Int32Array(1 << 16), CC = new Int32Array(1 << 16), nm = 0, nc = 0;
  const tmp = new Int32Array(Math.max(nM, n));
  for (let q = 0; q < nb; q++) {
    const k = brutes[q], bx0 = BX[4 * k], bx1 = BX[4 * k + 1], bz0 = BX[4 * k + 2], bz1 = BX[4 * k + 3];
    let t = candidats(gM, marquesM, q + 1, bx0, bx1, bz0, bz1, tmp, 0);
    if (nm + t > CM.length) { const x = new Int32Array(Math.max(CM.length * 2, nm + t)); x.set(CM); CM = x; }
    for (let u = 0; u < t; u++) { const id = tmp[u];
      if (bx0 < MBX[4 * id + 1] - EPS && bx1 > MBX[4 * id] + EPS && bz0 < MBX[4 * id + 3] - EPS && bz1 > MBX[4 * id + 2] + EPS) CM[nm++] = id; }
    CMO[q + 1] = nm;
    t = candidats(gC, marquesC, q + 1, bx0, bx1, bz0, bz1, tmp, 0);
    if (nc + t > CC.length) { const x = new Int32Array(Math.max(CC.length * 2, nc + t)); x.set(CC); CC = x; }
    for (let u = 0; u < t; u++) { const id = tmp[u]; if (id === k) continue;
      if (bx0 < BX[4 * id + 1] - EPS && bx1 > BX[4 * id] + EPS && bz0 < BX[4 * id + 3] - EPS && bz1 > BX[4 * id + 2] + EPS) CC[nc++] = id; }
    CCO[q + 1] = nc;
  }
  return { n, P, PL, LEN, BX, VEG, brutes: new Int32Array(brutes), sources, nM, M, MOff, MBX, CM: CM.subarray(0, nm), CMO, CC: CC.subarray(0, nc), CCO,
    eau: Number.isFinite(niveauEau) ? niveauEau : NaN };
}

// ---------------------------------------------------------------- noyau JavaScript (transcription directe en C : herbier.c)
// Arène : polygones de sommets (x, y, z) consécutifs. Deux listes de morceaux (début, nombre) en alternance.
function noyauJS(D) {
  let A = new Float64Array(1 << 20); let haut = 0;
  const assurer = m => { if (haut + m > A.length) { const x = new Float64Array(Math.max(A.length * 2, haut + m)); x.set(A); A = x; } };
  let L1 = new Int32Array(4096), L2 = new Int32Array(4096);
  let OUT = new Float64Array(1 << 18), no = 0;
  const DST = new Float64Array(256);
  // découpe du polygone (src, n) par d(v) = sg × (k0 + k1·x + k2·z + k3·(x − ex)·… ) : trois formes, comme l'original
  // mode 0 : eau, d = y − e − 0.08 ; mode 1 : arête, d = (bx − ax)(vz − az) − (bz − az)(vx − ax) ; mode 2 : dessus, d = dh + dx·x + dz·z − off
  function dist(mode, x, y, z, a0, a1, a2, a3) {
    if (mode === 0) return y - a0 - .08;
    if (mode === 1) return (a2 - a0) * (z - a1) - (a3 - a1) * (x - a0);
    return a0 + a1 * x + a2 * z - a3;
  }
  function couper(src, n, positif, mode, a0, a1, a2, a3) { // écrit à haut, rend le nombre de sommets
    if (n < 3) return 0;
    assurer(6 * n + 6);
    const dst = haut; let m = 0;
    const la = src + 3 * (n - 1); let ax = A[la], ay = A[la + 1], az = A[la + 2];
    let da = dist(mode, ax, ay, az, a0, a1, a2, a3) * (positif ? 1 : -1);
    for (let q = 0; q < n; q++) {
      const lb = src + 3 * q, bx = A[lb], by = A[lb + 1], bz = A[lb + 2];
      const db = dist(mode, bx, by, bz, a0, a1, a2, a3) * (positif ? 1 : -1), dA = da >= -EPS, dB = db >= -EPS;
      if (dA !== dB) { const t = da / (da - db); const o = dst + 3 * m++; A[o] = ax + (bx - ax) * t; A[o + 1] = ay + (by - ay) * t; A[o + 2] = az + (bz - az) * t; }
      if (dB) { const o = dst + 3 * m++; A[o] = bx; A[o + 1] = by; A[o + 2] = bz; }
      ax = bx; ay = by; az = bz; da = db;
    }
    haut = dst + 3 * m;
    return m;
  }
  function aire2(src, n) { let s = 0; for (let q = 0; q < n; q++) { const a = src + 3 * q, b = src + 3 * ((q + 1) % n); s = s + A[a] * A[b + 2] - A[b] * A[a + 2]; } return s; }
  function aire2M(M, o, n) { let s = 0; for (let q = 0; q < n; q++) { const a = 2 * (o + q), b = 2 * (o + (q + 1) % n); s = s + M[a] * M[b + 1] - M[b] * M[a + 1]; } return s; }
  // retirer : ajoute à la liste L (paires début, nombre) les morceaux de (src, n) hors du masque (MM, mo, mn) en (x, z)
  let nL2 = 0;
  function pousser(debut, n) { if (2 * nL2 + 2 > L2.length) { const x = new Int32Array(L2.length * 2); x.set(L2); L2 = x; } L2[2 * nL2] = debut; L2[2 * nL2 + 1] = n; nL2++; }
  function retirer(src, n, MM, mo, mn) {
    let inter = src, ni = n;
    for (let i = 0; i < mn && ni >= 3; i++) {
      const a = 2 * (mo + i), b = 2 * (mo + (i + 1) % mn);
      const nouveau = couper(inter, ni, true, 1, MM[a], MM[a + 1], MM[b], MM[b + 1]); inter = haut - 3 * nouveau; ni = nouveau;
    }
    if (ni < 3 || Math.abs(aire2(inter, ni)) < .002) { pousser(src, n); return; }
    if (Math.abs(aire2(inter, ni)) >= Math.abs(aire2(src, n)) - .002) return;
    let dedans = src, nd = n;
    for (let i = 0; i < mn && nd >= 3; i++) {
      const a = 2 * (mo + i), b = 2 * (mo + (i + 1) % mn);
      const nm = couper(dedans, nd, false, 1, MM[a], MM[a + 1], MM[b], MM[b + 1]), debutM = haut - 3 * nm;
      if (nm >= 3 && Math.abs(aire2(debutM, nm)) > .002) pousser(debutM, nm);
      const nn = couper(dedans, nd, true, 1, MM[a], MM[a + 1], MM[b], MM[b + 1]); dedans = haut - 3 * nn; nd = nn;
    }
  }
  const { P, PL, LEN, VEG, brutes, M, MOff, CM, CMO, CC, CCO, eau } = D;
  const MASQUE = new Float64Array(64); // masque issu d'une autre couche, en (x, z)
  for (let q = 0; q < brutes.length; q++) {
    const s = brutes[q]; haut = 0;
    assurer(9); for (let u = 0; u < 9; u++) A[u] = P[9 * s + u]; haut = 9;
    let nL1 = 0;
    if (eau === eau) { const m = couper(0, 3, true, 0, eau, 0, 0, 0); if (m >= 3) { L1[0] = haut - 3 * m; L1[1] = m; nL1 = 1; } }
    else { L1[0] = 0; L1[1] = 3; nL1 = 1; }
    for (let u = CMO[q]; u < CMO[q + 1] && nL1; u++) {
      const k = CM[u], mo = MOff[k], mn = MOff[k + 1] - mo;
      nL2 = 0; for (let v = 0; v < nL1; v++) retirer(L1[2 * v], L1[2 * v + 1], M, mo, mn);
      const t = L1; L1 = L2; L2 = t; nL1 = nL2;
    }
    const sdx = PL[3 * s], sdz = PL[3 * s + 1], sh = PL[3 * s + 2];
    for (let u = CCO[q]; u < CCO[q + 1] && nL1; u++) {
      const k = CC[u];
      const dh = PL[3 * k + 2] - sh, dx = PL[3 * k] - sdx, dz = PL[3 * k + 1] - sdz;
      if (VEG[k] && Math.abs(dx) + Math.abs(dz) < 1e-8 && Math.abs(dh) < .0005 && k > s) continue;
      assurer(9); const src = haut; for (let w = 0; w < 9; w++) A[src + w] = P[9 * k + w]; haut += 9;
      const mm = couper(src, 3, true, 2, dh, dx, dz, VEG[k] ? .0005 : -.0005), debut = haut - 3 * mm;
      if (mm < 3) continue;
      for (let w = 0; w < mm; w++) { MASQUE[2 * w] = A[debut + 3 * w]; MASQUE[2 * w + 1] = A[debut + 3 * w + 2]; }
      if (!(Math.abs(aire2M(MASQUE, 0, mm)) > .002)) continue;
      nL2 = 0; for (let v = 0; v < nL1; v++) retirer(L1[2 * v], L1[2 * v + 1], MASQUE, 0, mm);
      const t = L1; L1 = L2; L2 = t; nL1 = nL2;
    }
    const len = LEN[s];
    for (let v = 0; v < nL1; v++) {
      const p = L1[2 * v], n = L1[2 * v + 1];
      for (let k = 1; k < n - 1; k++) {
        const a = p, b = p + 3 * k, d = p + 3 * (k + 1);
        let s2 = 0; s2 = s2 + A[a] * A[b + 2] - A[b] * A[a + 2]; s2 = s2 + A[b] * A[d + 2] - A[d] * A[b + 2]; s2 = s2 + A[d] * A[a + 2] - A[a] * A[d + 2];
        const aire = Math.abs(s2) / 2 * len;
        if (aire < .02) continue;
        if (no + 11 > OUT.length) { const x = new Float64Array(OUT.length * 2); x.set(OUT); OUT = x; }
        OUT[no++] = s; for (const o of [a, b, d]) { OUT[no++] = A[o]; OUT[no++] = A[o + 1]; OUT[no++] = A[o + 2]; } OUT[no++] = aire;
      }
    }
  }
  return OUT.subarray(0, no);
}

// ---------------------------------------------------------------- objets de sortie, comme l'original
function finir(D, OUT) {
  const triangles = []; let aireAccotements = 0, aireTerrain = 0, aireBrute = 0;
  for (let q = 0; q < D.brutes.length; q++) {
    const s = D.brutes[q], P = D.P;
    let a = 0; a = a + P[9 * s] * P[9 * s + 5] - P[9 * s + 3] * P[9 * s + 2]; a = a + P[9 * s + 3] * P[9 * s + 8] - P[9 * s + 6] * P[9 * s + 5]; a = a + P[9 * s + 6] * P[9 * s + 2] - P[9 * s] * P[9 * s + 8];
    aireBrute += Math.abs(a) / 2 * D.LEN[s];
  }
  for (let o = 0; o < OUT.length; o += 11) {
    const src = D.sources[OUT[o]];
    const points = [[OUT[o + 1], OUT[o + 2], OUT[o + 3]], [OUT[o + 4], OUT[o + 5], OUT[o + 6]], [OUT[o + 7], OUT[o + 8], OUT[o + 9]]], aire = OUT[o + 10];
    const boite = { x0: Math.min(points[0][0], points[1][0], points[2][0]), x1: Math.max(points[0][0], points[1][0], points[2][0]), z0: Math.min(points[0][2], points[1][2], points[2][2]), z1: Math.max(points[0][2], points[1][2], points[2][2]) };
    triangles.push({ points, normal: src.plan.normal, color: src.color, type: src.type, aire, plan: src.plan, boite });
    if (src.type === 'accotement') aireAccotements += aire; else aireTerrain += aire;
  }
  // index et requête de surface à clés numériques (l'original concatène deux chaînes par case et par requête)
  const nT = triangles.length, BXT = new Float64Array(4 * nT);
  for (let k = 0; k < nT; k++) { const b = triangles[k].boite; BXT[4 * k] = b.x0; BXT[4 * k + 1] = b.x1; BXT[4 * k + 2] = b.z0; BXT[4 * k + 3] = b.z1; }
  const g = grille(nT, BXT);
  function surface(x, z, sortie = {}) {
    let meilleur = null, hauteur = -Infinity;
    const ids = g.get(cleCase(Math.floor(x / MAILLE), Math.floor(z / MAILLE)));
    if (ids) for (let q = 0; q < ids.length; q++) {
      const t = triangles[ids[q]], a = t.points[0], b = t.points[1], c = t.points[2];
      const abx = b[0] - a[0], abz = b[2] - a[2], acx = c[0] - a[0], acz = c[2] - a[2], det = abx * acz - abz * acx;
      const u = ((x - a[0]) * acz - (z - a[2]) * acx) / det, v = (abx * (z - a[2]) - abz * (x - a[0])) / det;
      if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
      const y = t.plan.h + t.plan.dx * x + t.plan.dz * z;
      if (y > hauteur) { hauteur = y; meilleur = t; }
    }
    if (!meilleur) return null;
    sortie.y = hauteur; sortie.normal = meilleur.normal; sortie.color = meilleur.color; sortie.type = meilleur.type;
    return sortie;
  }
  return { triangles, surface, aireBrute, aire: aireAccotements + aireTerrain, aireAccotements, aireTerrain, trianglesSources: D.brutes.length, masques: D.nM };
}

function creerHerbierSerre(B, noyau = noyauJS) {
  return (c, nappes, lots, lim, enceinte, niveauEau) => { const D = preparer(B, c, nappes, lots, lim, enceinte, niveauEau); return finir(D, noyau(D)); };
}
module.exports = { preparer, noyauJS, finir, creerHerbierSerre };
