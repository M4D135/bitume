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

  function parapets(circuit) {
    const troncons = [
      { s0: 4511, s1: 5478, cote: -1, nom: 'balcon' },
      { s0: 8523, s1: 8719, cote: 1, nom: 'virage-du-vide' }
    ];
    const pas_parapet = 3;
    const hauteur_base = 0.65;
    const epaisseur = 0.30;
    const decalage = circuit.largeur / 2 + 0.15;
    const col = [0.55, 0.53, 0.50];
    const lots = [];
    for (let t = 0; t < troncons.length; t++) {
      const tr = troncons[t];
      const nSeg = Math.ceil((tr.s1 - tr.s0) / pas_parapet);
      for (let i = 0; i < nSeg; i++) {
        const s = tr.s0 + i * pas_parapet;
        const piste = echantillonPiste(circuit, s);
        const x = piste.x;
        const z = piste.z;
        const r0 = piste.r0;
        const r1 = piste.r1;
        const r2 = piste.r2;
        const lat = tr.cote * decalage;
        const cx = x + r2[0] * lat;
        const cz = z + r2[2] * lat;
        const hVar = (hache(s, tr.cote, circuit.graine) - 0.5) * 0.08;
        const h = hauteur_base + hVar;
        const hl = pas_parapet / 2;
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
              sommet(n, [px, py, pz], no, 'parapet', col);
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
        lots.push(lot([n], 'parapet', { s0: tr.s0, s1: tr.s1, cote: tr.cote, nom: tr.nom }));
      }
    }
    return lots;
  }

  function piliersGalerie(circuit) {
    const s0 = 6000;
    const s1 = 6300;
    const pas_pilier = 15;
    const rayon = 0.4;
    const hauteur = 5;
    const nb_faces = 8;
    const decalage = circuit.largeur / 2 + 0.2;
    const col = [0.45, 0.43, 0.40];
    const lots = [];
    const nSeg = Math.ceil((s1 - s0) / pas_pilier);
    for (let i = 0; i < nSeg; i++) {
      const s = s0 + i * pas_pilier;
      const piste = echantillonPiste(circuit, s);
      const x = piste.x;
      const z = piste.z;
      const r0 = piste.r0;
      const r1 = piste.r1;
      const r2 = piste.r2;
      const lat = -1 * decalage;
      const cx = x + r2[0] * lat;
      const cz = z + r2[2] * lat;
      const n = nappe();
      const hh = hauteur / 2;
      const y_bot = hh + r1[1] * hh * (-1);
      const y_top = hh + r1[1] * hh * 1;
      for (let f = 0; f < nb_faces; f++) {
        const a1 = (f / nb_faces) * Math.PI * 2;
        const a2 = ((f + 1) % nb_faces) / nb_faces * Math.PI * 2;
        const c1 = Math.cos(a1), sn1 = Math.sin(a1);
        const c2 = Math.cos(a2), sn2 = Math.sin(a2);
        const v0 = [cx + r0[0]*rayon*c1 + r2[0]*rayon*sn1, y_bot, cz + r0[2]*rayon*c1 + r2[2]*rayon*sn1];
        const v1 = [cx + r0[0]*rayon*c2 + r2[0]*rayon*sn2, y_bot, cz + r0[2]*rayon*c2 + r2[2]*rayon*sn2];
        const v2 = [cx + r0[0]*rayon*c2 + r2[0]*rayon*sn2, y_top, cz + r0[2]*rayon*c2 + r2[2]*rayon*sn2];
        const v3 = [cx + r0[0]*rayon*c1 + r2[0]*rayon*sn1, y_top, cz + r0[2]*rayon*c1 + r2[2]*rayon*sn1];
        const nm = (a1 + a2) / 2;
        const nc = Math.cos(nm), ns = Math.sin(nm);
        const no = [r0[0]*nc + r2[0]*ns, 0, r0[2]*nc + r2[2]*ns];
        sommet(n, v0, no, 'pierre', col);
        sommet(n, v1, no, 'pierre', col);
        sommet(n, v2, no, 'pierre', col);
        sommet(n, v3, no, 'pierre', col);
        const base = n.s.length - 4;
        n.i.push(base, base+1, base+2, base, base+2, base+3);
      }
      sommet(n, [cx, y_bot, cz], [0, -1, 0], 'pierre', col);
      const base_bot = n.s.length - 1;
      for (let f = 0; f < nb_faces; f++) {
        const a1 = (f / nb_faces) * Math.PI * 2;
        const a2 = ((f + 1) % nb_faces) / nb_faces * Math.PI * 2;
        const v1 = [cx + r0[0]*rayon*Math.cos(a1) + r2[0]*rayon*Math.sin(a1), y_bot, cz + r0[2]*rayon*Math.cos(a1) + r2[2]*rayon*Math.sin(a1)];
        const v2 = [cx + r0[0]*rayon*Math.cos(a2) + r2[0]*rayon*Math.sin(a2), y_bot, cz + r0[2]*rayon*Math.cos(a2) + r2[2]*rayon*Math.sin(a2)];
        sommet(n, v1, [0, -1, 0], 'pierre', col);
        sommet(n, v2, [0, -1, 0], 'pierre', col);
        const b = n.s.length - 2;
        n.i.push(base_bot, b, b+1);
      }
      sommet(n, [cx, y_top, cz], [0, 1, 0], 'pierre', col);
      const base_top = n.s.length - 1;
      for (let f = 0; f < nb_faces; f++) {
        const a1 = (f / nb_faces) * Math.PI * 2;
        const a2 = ((f + 1) % nb_faces) / nb_faces * Math.PI * 2;
        const v1 = [cx + r0[0]*rayon*Math.cos(a1) + r2[0]*rayon*Math.sin(a1), y_top, cz + r0[2]*rayon*Math.cos(a1) + r2[2]*rayon*Math.sin(a1)];
        const v2 = [cx + r0[0]*rayon*Math.cos(a2) + r2[0]*rayon*Math.sin(a2), y_top, cz + r0[2]*rayon*Math.cos(a2) + r2[2]*rayon*Math.sin(a2)];
        sommet(n, v1, [0, 1, 0], 'pierre', col);
        sommet(n, v2, [0, 1, 0], 'pierre', col);
        const b = n.s.length - 2;
        n.i.push(base_top, b+1, b);
      }
      finir(n);
      lots.push(lot([n], 'pilier', { s, cote: -1 }));
    }
    return lots;
  }

  function portailsTunnels(circuit) {
    const tunnels = [
      { nom: 'rocher', s_entree: 4200, s_sortie: 4505 },
      { nom: 'echelles', s_entree: 6500, s_sortie: 6670 }
    ];
    const largeur_ouverture = circuit.largeur + 2;
    const hauteur_ouverture = 5.5;
    const epaisseur = 1.2;
    const col = [0.38, 0.36, 0.34];
    const lots = [];
    for (let t = 0; t < tunnels.length; t++) {
      const tun = tunnels[t];
      const faces = [
        { nom: 'entree', s: tun.s_entree },
        { nom: 'sortie', s: tun.s_sortie }
      ];
      for (let f = 0; f < faces.length; f++) {
        const face = faces[f];
        const piste = echantillonPiste(circuit, face.s);
        const x = piste.x;
        const z = piste.z;
        const r0 = piste.r0;
        const r1 = piste.r1;
        const r2 = piste.r2;
        const n = nappe();
        const he = epaisseur / 2;
        const demi_larg = largeur_ouverture / 2;
        const demi_haut = hauteur_ouverture / 2;
        const poutres = [
          { lat: -(demi_larg - he), y: demi_haut, hl: he, hh: demi_haut, he: he },
          { lat: (demi_larg - he), y: demi_haut, hl: he, hh: demi_haut, he: he },
          { lat: 0, y: hauteur_ouverture + he, hl: he, hh: he, he: demi_larg },
          { lat: 0, y: -he, hl: he, hh: he, he: demi_larg }
        ];
        for (let p = 0; p < poutres.length; p++) {
          const poutre = poutres[p];
          const pcx = x + r2[0] * poutre.lat;
          const pcz = z + r2[2] * poutre.lat;
          const pcy = poutre.y;
          const p_hl = poutre.hl;
          const p_hh = poutre.hh;
          const p_he = poutre.he;
          for (let a = -1; a <= 1; a += 2) {
            for (let b = -1; b <= 1; b += 2) {
              for (let c = -1; c <= 1; c += 2) {
                const vx = pcx + r0[0] * p_hl * a + r1[0] * p_hh * b + r2[0] * p_he * c;
                const vy = pcy + r1[1] * p_hh * b;
                const vz = pcz + r0[2] * p_hl * a + r1[2] * p_hh * b + r2[2] * p_he * c;
                const no = [
                  r0[0] * a + r1[0] * b + r2[0] * c,
                  r0[1] * a + r1[1] * b + r2[1] * c,
                  r0[2] * a + r1[2] * b + r2[2] * c
                ];
                sommet(n, [vx, vy, vz], no, 'pierre', col);
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
          const base = n.s.length - 8;
          for (let k = 0; k < idx.length; k++) {
            n.i.push(base + idx[k]);
          }
        }
        finir(n);
        lots.push(lot([n], 'portail', { s: face.s, tunnel: tun.nom, face: face.nom }));
      }
    }
    return lots;
  }

  function sapinsBoisNoir(circuit) {
    const troncons = [
      { s0: 790, s1: 970, cote: +1 },
      { s0: 1146, s1: 1366, cote: -1 },
      { s0: 1766, s1: 2026, cote: +1 }
    ];
    const pas_sapin = 2.5;
    const lots = [];
    const col_tronc = [0.30, 0.20, 0.12];
    const col_houppier = [0.12, 0.28, 0.10];
    const rayon_tronc = 0.15;
    const h_tronc = 1.2;
    const rayon_houppier = 1.4;
    const h_houppier_base = 5.5;
    const nb_faces_tronc = 4;
    const nb_faces_houppier = 8;

    for (let t = 0; t < troncons.length; t++) {
      const tr = troncons[t];
      const nSeg = Math.ceil((tr.s1 - tr.s0) / pas_sapin);
      for (let i = 0; i < nSeg; i++) {
        const s = tr.s0 + i * pas_sapin;
        const piste = echantillonPiste(circuit, s);
        const x = piste.x;
        const z = piste.z;
        const r0 = piste.r0;
        const r1 = piste.r1;
        const r2 = piste.r2;

        const h_lat = hache(s, tr.cote, circuit.graine);
        const distance_bord = 2.6 + h_lat * (6.0 - 2.6);
        const lat = tr.cote * (circuit.largeur / 2 + distance_bord);
        const cx = x + r2[0] * lat;
        const cz = z + r2[2] * lat;

        const h_var = (hache(s, tr.cote + 1000, circuit.graine) - 0.5) * 1.5;
        const h_houppier = h_houppier_base + h_var;

        // Tronc : cylindre 4 faces, de y=0 à y=h_tronc
        const n_tronc = nappe();
        const hh_t = h_tronc / 2;
        const y_bot = hh_t + r1[1] * hh_t * (-1);
        const y_top = hh_t + r1[1] * hh_t * 1;
        for (let f = 0; f < nb_faces_tronc; f++) {
          const a1 = (f / nb_faces_tronc) * Math.PI * 2;
          const a2 = ((f + 1) % nb_faces_tronc) / nb_faces_tronc * Math.PI * 2;
          const c1 = Math.cos(a1), sn1 = Math.sin(a1);
          const c2 = Math.cos(a2), sn2 = Math.sin(a2);
          const v0 = [cx + r0[0]*rayon_tronc*c1 + r2[0]*rayon_tronc*sn1, y_bot, cz + r0[2]*rayon_tronc*c1 + r2[2]*rayon_tronc*sn1];
          const v1 = [cx + r0[0]*rayon_tronc*c2 + r2[0]*rayon_tronc*sn2, y_bot, cz + r0[2]*rayon_tronc*c2 + r2[2]*rayon_tronc*sn2];
          const v2 = [cx + r0[0]*rayon_tronc*c2 + r2[0]*rayon_tronc*sn2, y_top, cz + r0[2]*rayon_tronc*c2 + r2[2]*rayon_tronc*sn2];
          const v3 = [cx + r0[0]*rayon_tronc*c1 + r2[0]*rayon_tronc*sn1, y_top, cz + r0[2]*rayon_tronc*c1 + r2[2]*rayon_tronc*sn1];
          const nm = (a1 + a2) / 2;
          const nc = Math.cos(nm), ns = Math.sin(nm);
          const no = [r0[0]*nc + r2[0]*ns, 0, r0[2]*nc + r2[2]*ns];
          sommet(n_tronc, v0, no, 'bois', col_tronc);
          sommet(n_tronc, v1, no, 'bois', col_tronc);
          sommet(n_tronc, v2, no, 'bois', col_tronc);
          sommet(n_tronc, v3, no, 'bois', col_tronc);
          const base = n_tronc.s.length - 4;
          n_tronc.i.push(base, base+1, base+2, base, base+2, base+3);
        }
        finir(n_tronc);

        // Houppier : cône 8 segments, base à y=h_tronc, sommet à y=h_tronc+h_houppier
        const n_houppier = nappe();
        const y_base = h_tronc;
        const y_apex = h_tronc + h_houppier;
        for (let f = 0; f < nb_faces_houppier; f++) {
          const a1 = (f / nb_faces_houppier) * Math.PI * 2;
          const a2 = ((f + 1) % nb_faces_houppier) / nb_faces_houppier * Math.PI * 2;
          const c1 = Math.cos(a1), sn1 = Math.sin(a1);
          const c2 = Math.cos(a2), sn2 = Math.sin(a2);
          const vb1 = [cx + r0[0]*rayon_houppier*c1 + r2[0]*rayon_houppier*sn1, y_base, cz + r0[2]*rayon_houppier*c1 + r2[2]*rayon_houppier*sn1];
          const vb2 = [cx + r0[0]*rayon_houppier*c2 + r2[0]*rayon_houppier*sn2, y_base, cz + r0[2]*rayon_houppier*c2 + r2[2]*rayon_houppier*sn2];
          const va = [cx, y_apex, cz];
          const nm = (a1 + a2) / 2;
          const nc = Math.cos(nm), ns = Math.sin(nm);
          const no = [r0[0]*nc + r2[0]*ns, 0.3, r0[2]*nc + r2[2]*ns];
          sommet(n_houppier, vb1, no, 'conifere', col_houppier);
          sommet(n_houppier, vb2, no, 'conifere', col_houppier);
          sommet(n_houppier, va, no, 'conifere', col_houppier);
          const base = n_houppier.s.length - 3;
          n_houppier.i.push(base, base+1, base+2);
        }
        finir(n_houppier);

        lots.push(lot([n_tronc, n_houppier], 'sapin', { s, cote: tr.cote, distance_bord }));
      }
    }
    return lots;
  }

  B.lieux = { echantillonPiste, lot, nappe, sommet, finir, boite, alea, hache, bruit, fbm, muretsLacets, parapets, piliersGalerie, portailsTunnels, sapinsBoisNoir };
})(globalThis.BITUME = globalThis.BITUME || {});
