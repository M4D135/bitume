(function (B) {
  'use strict';

  function alea(graine) {
    let t = graine >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hache(x, z, g) {
    let n = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(g | 0, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function bruit(x, z, g) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const a = hache(xi, zi, g);
    const b = hache(xi + 1, zi, g);
    const c = hache(xi, zi + 1, g);
    const d = hache(xi + 1, zi + 1, g);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fbm(x, z, g, octaves) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += amp * bruit(x * freq, z * freq, g + i);
      amp *= 0.5;
      freq *= 2;
    }
    return val;
  }

  function echantillonPiste(circuit, s) {
    const pas = circuit.pas;
    const longueur = circuit.longueur;
    const n = circuit.x.length;
    let sMod = s % longueur;
    if (sMod < 0) sMod += longueur;
    const idx = sMod / pas;
    const i0 = Math.floor(idx) % n;
    const i1 = (i0 + 1) % n;
    const t = idx - Math.floor(idx);
    const x = circuit.x[i0] + (circuit.x[i1] - circuit.x[i0]) * t;
    const z = circuit.z[i0] + (circuit.z[i1] - circuit.z[i0]) * t;
    const dx = circuit.x[i1] - circuit.x[i0];
    const dz = circuit.z[i1] - circuit.z[i0];
    const len = Math.sqrt(dx * dx + dz * dz);
    const cap = Math.atan2(dz, dx);
    const r0 = [dx / len, 0, dz / len];
    const r1 = [0, 1, 0];
    const r2 = [r0[2], 0, -r0[0]];
    return { x, z, r0, r1, r2, cap };
  }

  function boite(sommets) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < sommets.length; i++) {
      const p = sommets[i];
      if (p[0] < min[0]) min[0] = p[0];
      if (p[1] < min[1]) min[1] = p[1];
      if (p[2] < min[2]) min[2] = p[2];
      if (p[0] > max[0]) max[0] = p[0];
      if (p[1] > max[1]) max[1] = p[1];
      if (p[2] > max[2]) max[2] = p[2];
    }
    return { min, max };
  }

  function nappe() {
    return { s: [], i: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  }

  function sommet(n, p, no, mat, col) {
    n.s.push({ p, no, mat, col });
    if (p[0] < n.min[0]) n.min[0] = p[0];
    if (p[1] < n.min[1]) n.min[1] = p[1];
    if (p[2] < n.min[2]) n.min[2] = p[2];
    if (p[0] > n.max[0]) n.max[0] = p[0];
    if (p[1] > n.max[1]) n.max[1] = p[1];
    if (p[2] > n.max[2]) n.max[2] = p[2];
  }

  function finir(n) {
    return n;
  }

  function lot(nappes, type, meta) {
    return { nappes, type, meta };
  }

  B.lieux = { echantillonPiste, lot, nappe, sommet, finir, boite, alea, hache, bruit, fbm };
})(globalThis.BITUME = globalThis.BITUME || {});
