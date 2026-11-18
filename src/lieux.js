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

  function muretsLacets(circuit) {
    const troncons = [
      { s0: 3339, s1: 3569, cote: 1 },
      { s0: 3670, s1: 3900, cote: -1 }
    ];
    const pas_muret = 4;
    const hauteur_base = 0.85;
    const epaisseur = 0.55;
    const decalage = circuit.largeur / 2 + 0.3;
    const col = [0.42, 0.40, 0.38];
    const lots = [];
    for (let t = 0; t < troncons.length; t++) {
      const tr = troncons[t];
      const nSeg = Math.ceil((tr.s1 - tr.s0) / pas_muret);
      for (let i = 0; i < nSeg; i++) {
        const s = tr.s0 + i * pas_muret;
        const piste = echantillonPiste(circuit, s);
        const x = piste.x;
        const z = piste.z;
        const r0 = piste.r0;
        const r1 = piste.r1;
        const r2 = piste.r2;
        const lat = tr.cote * decalage;
        const cx = x + r2[0] * lat;
        const cz = z + r2[2] * lat;
        const hVar = (hache(s, tr.cote, circuit.graine) - 0.5) * 0.12;
        const h = hauteur_base + hVar;
        const hl = pas_muret / 2;
        const hh = h / 2;
        const he = epaisseur / 2;
        const n = nappe();
        for (let a = -1; a <= 1; a += 2) {
          for (let b = -1; b <= 1; b += 2) {
            for (let c = -1; c <= 1; c += 2) {
              const px = cx + r0[0] * hl * a + r1[0] * hh * b + r2[0] * he * c;
              const py = hh + r1[1] * hh * b;
              const pz = cz + r0[2] * hl * a + r1[2] * hh * b + r2[2] * he * c;
              const no = [
                r0[0] * a + r1[0] * b + r2[0] * c,
                r0[1] * a + r1[1] * b + r2[1] * c,
                r0[2] * a + r1[2] * b + r2[2] * c
              ];
              sommet(n, [px, py, pz], no, 'pierre', col);
            }
          }
        }
        const idx = [
          0,1,3, 0,3,2,
          4,6,7, 4,7,5,
          0,4,5, 0,5,1,
          2,3,7, 2,7,6,
          0,2,6, 0,6,4,
          1,5,7, 1,7,3
        ];
        for (let k = 0; k < idx.length; k++) {
          n.i.push(idx[k]);
        }
        finir(n);
        lots.push(lot([n], 'muret', { s0: tr.s0, s1: tr.s1, cote: tr.cote }));
      }
    }
    return lots;
  }

  B.lieux = { echantillonPiste, lot, nappe, sommet, finir, boite, alea, hache, bruit, fbm, muretsLacets };
})(globalThis.BITUME = globalThis.BITUME || {});
