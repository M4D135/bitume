/* BITUME — rochers organiques, pyramides du désert et lieux emblématiques des neuf circuits.
   Toutes les formes sont bâties en code au chargement, fermées, normalisées dans [−0,5 ; +0,5]³ avec normales
   cohérentes, et enregistrées dans FRender.forme. Zéro asset externe, zéro Math.random(). */
(function (B) {
  'use strict';
  const TAU = Math.PI * 2;

  // ================================================================ hasard déterministe et vecteurs
  function prng(graine) {
    let s = (graine >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  // ================================================================ construction de maillages fermés
  function maillageLisse(verts, faces, plat = false) {
    // Assurer un volume signé positif (normales sortantes pour le backface culling)
    let vol = 0;
    for (let i = 0; i < faces.length; i++) {
      const a = verts[faces[i][0]], b = verts[faces[i][1]], c = verts[faces[i][2]];
      vol += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    const inverser = vol < 0;
    const ns = plat ? null : verts.map(() => [0, 0, 0]);
    const trisBruts = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const i0 = f[0], i1 = inverser ? f[2] : f[1], i2 = inverser ? f[1] : f[2];
      const a = verts[i0], b = verts[i1], c = verts[i2];
      const fn = cross(sub(b, a), sub(c, a));
      const aire = Math.hypot(fn[0], fn[1], fn[2]);
      if (aire < 1e-11) continue;
      if (ns) {
        for (const idx of [i0, i1, i2]) { ns[idx][0] += fn[0]; ns[idx][1] += fn[1]; ns[idx][2] += fn[2]; }
        trisBruts.push([i0, i1, i2]);
      } else {
        const u = [fn[0] / aire, fn[1] / aire, fn[2] / aire];
        trisBruts.push([a.slice(), b.slice(), c.slice(), u.slice(), u.slice(), u.slice()]);
      }
    }
    if (!ns) return trisBruts;
    const normV = ns.map(v => unit(v));
    const tris = [];
    for (let i = 0; i < trisBruts.length; i++) {
      const [i0, i1, i2] = trisBruts[i];
      tris.push([verts[i0].slice(), verts[i1].slice(), verts[i2].slice(), normV[i0].slice(), normV[i1].slice(), normV[i2].slice()]);
    }
    return tris;
  }

  function normaliserBoite(tris) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
        if (t[j][k] < lo[k]) lo[k] = t[j][k];
        if (t[j][k] > hi[k]) hi[k] = t[j][k];
      }
    }
    const c = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2);
    const s = [0, 1, 2].map(k => Math.max(1e-4, hi[k] - lo[k]));
    const out = [];
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      const p0 = [(t[0][0] - c[0]) / s[0], (t[0][1] - c[1]) / s[1], (t[0][2] - c[2]) / s[2]];
      const p1 = [(t[1][0] - c[0]) / s[0], (t[1][1] - c[1]) / s[1], (t[1][2] - c[2]) / s[2]];
      const p2 = [(t[2][0] - c[0]) / s[0], (t[2][1] - c[1]) / s[1], (t[2][2] - c[2]) / s[2]];
      const n0 = unit([t[3][0] * s[0], t[3][1] * s[1], t[3][2] * s[2]]);
      const n1 = unit([t[4][0] * s[0], t[4][1] * s[1], t[4][2] * s[2]]);
      const n2 = unit([t[5][0] * s[0], t[5][1] * s[1], t[5][2] * s[2]]);
      const fn = cross(sub(p1, p0), sub(p2, p0));
      if (Math.hypot(fn[0], fn[1], fn[2]) < 1e-12) continue;
      if (dot(fn, add(add(n0, n1), n2)) <= 0) out.push([p0, p2, p1, n0, n2, n1]);
      else out.push([p0, p1, p2, n0, n1, n2]);
    }
    return out;
  }

  function icosphere(subdiv) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const verts = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ].map(unit);
    let faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];
    const cache = new Map();
    const mid = (a, b) => {
      const k = a < b ? a * 65536 + b : b * 65536 + a;
      let m = cache.get(k);
      if (m !== undefined) return m;
      m = verts.length;
      verts.push(unit([(verts[a][0] + verts[b][0]) * .5, (verts[a][1] + verts[b][1]) * .5, (verts[a][2] + verts[b][2]) * .5]));
      cache.set(k, m);
      return m;
    };
    for (let s = 0; s < subdiv; s++) {
      const nf = [];
      for (let i = 0; i < faces.length; i++) {
        const [a, b, c] = faces[i], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      }
      faces = nf;
    }
    return { verts, faces };
  }

  function harmonique(x, y, z, f, ph) {
    return Math.sin(f * x + ph) * Math.cos(f * .85 * y - ph * .7) * Math.cos(f * .75 * z + ph * 1.1)
         + .55 * Math.cos(f * 1.25 * z + ph * 1.4) * Math.sin(f * 1.1 * y + ph * .5);
  }

  function rocherOrganique(ondes, aplatBas, ratioY = 1, subdiv = 2) {
    const { verts, faces } = icosphere(subdiv);
    const def = verts.map(v => {
      let r = 1;
      for (let k = 0; k < ondes.length; k++) {
        const [f, ph, amp] = ondes[k];
        r += amp * harmonique(v[0], v[1], v[2], f, ph);
      }
      r = Math.max(.42, r);
      let x = v[0] * r, y = v[1] * r * ratioY, z = v[2] * r;
      if (y < 0) y *= aplatBas;
      return [x, y, z];
    });
    return normaliserBoite(maillageLisse(def, faces, false));
  }

  // Tube fermé le long d'une courbe 3D (utilisé pour arches naturelles, ponts, palmes)
  function tubeFerme(centres, rayons, segs, ref = [1, 0, 0], deform = null) {
    const K = centres.length, verts = [], faces = [], anneaux = [];
    const T = new Array(K);
    for (let k = 0; k < K; k++) T[k] = unit(sub(centres[Math.min(K - 1, k + 1)], centres[Math.max(0, k - 1)]));
    let n = sub(ref, mul(T[0], dot(ref, T[0])));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-6) { n = Math.abs(T[0][1]) < .9 ? [0, 1, 0] : [1, 0, 0]; n = sub(n, mul(T[0], dot(n, T[0]))); }
    n = unit(n);
    for (let k = 0; k < K; k++) {
      if (k) { const q = sub(n, mul(T[k], dot(n, T[k]))); if (Math.hypot(q[0], q[1], q[2]) > 1e-9) n = unit(q); }
      const b = cross(T[k], n), r = rayons[k], rx = Array.isArray(r) ? r[0] : r, ry = Array.isArray(r) ? r[1] : r;
      const ann = new Array(segs);
      for (let j = 0; j < segs; j++) {
        const a = j / segs * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const g = deform ? deform(k, j, a) : 1;
        const c = centres[k];
        ann[j] = verts.length;
        verts.push([c[0] + (n[0] * ca * rx + b[0] * sa * ry) * g, c[1] + (n[1] * ca * rx + b[1] * sa * ry) * g, c[2] + (n[2] * ca * rx + b[2] * sa * ry) * g]);
      }
      anneaux.push(ann);
    }
    for (let k = 0; k < K - 1; k++) for (let j = 0; j < segs; j++) {
      const a = anneaux[k][j], bb = anneaux[k + 1][j], cc = anneaux[k + 1][(j + 1) % segs], d = anneaux[k][(j + 1) % segs];
      faces.push([a, cc, bb], [a, d, cc]);
    }
    const pa = verts.length; verts.push(centres[0].slice());
    const pb = verts.length; verts.push(centres[K - 1].slice());
    for (let j = 0; j < segs; j++) {
      faces.push([pa, anneaux[0][(j + 1) % segs], anneaux[0][j]]);
      faces.push([pb, anneaux[K - 1][j], anneaux[K - 1][(j + 1) % segs]]);
    }
    return maillageLisse(verts, faces, false);
  }

  // Révolution fermée autour de Y (bulbe, fumerolle, cône arrondi)
  function revolution(profil, segsU, plat = false) {
    const verts = [], faces = [], K = profil.length, anneaux = [];
    for (let k = 0; k < K; k++) {
      const [r, y] = profil[k], ann = [];
      for (let j = 0; j < segsU; j++) {
        const a = j / segsU * TAU;
        ann.push(verts.length);
        verts.push([r * Math.cos(a), y, r * Math.sin(a)]);
      }
      anneaux.push(ann);
    }
    for (let k = 0; k < K - 1; k++) for (let j = 0; j < segsU; j++) {
      const a = anneaux[k][j], b = anneaux[k + 1][j], c = anneaux[k + 1][(j + 1) % segsU], d = anneaux[k][(j + 1) % segsU];
      faces.push([a, b, c], [a, c, d]);
    }
    const pBas = verts.length; verts.push([0, profil[0][1], 0]);
    const pHaut = verts.length; verts.push([0, profil[K - 1][1], 0]);
    for (let j = 0; j < segsU; j++) {
      faces.push([pBas, anneaux[0][j], anneaux[0][(j + 1) % segsU]]);
      faces.push([pHaut, anneaux[K - 1][(j + 1) % segsU], anneaux[K - 1][j]]);
    }
    return normaliserBoite(maillageLisse(verts, faces, plat));
  }

  // ================================================================ PARTIE 1 : FORMES PROCÉDURALES
  const FORMES = {}, sectionsArche = [];
  function enregistrer(nom, tris) {
    const R = globalThis.window && globalThis.window.FRender;
    if (R && R.forme) R.forme(nom, tris);
    FORMES[nom] = tris;
    return tris;
  }

  // 1-3. Trois galets / blocs naturels arrondis (aucun angle droit)
  enregistrer('bitume-lieu-galet-a', rocherOrganique([[2.2, .7, .22], [3.6, 1.9, .14], [5.4, .4, .08]], .48, .85, 2));
  enregistrer('bitume-lieu-galet-b', rocherOrganique([[2.7, 1.4, .24], [4.1, .6, .13], [6.2, 2.3, .07]], .52, .72, 2));
  enregistrer('bitume-lieu-galet-c', rocherOrganique([[1.9, 2.2, .26], [3.3, .9, .15], [5.0, 1.7, .09]], .45, 1.05, 2));

  // 4. Dôme volcanique arrondi (Islande : lave refroidie lissée)
  enregistrer('bitume-lieu-rocher-volcan', rocherOrganique([[2.4, .5, .20], [4.4, 2.1, .14], [6.8, 1.1, .08]], .32, .68, 2));

  // 5. Rocher alpin érodé (arrondi et dissymétrique)
  enregistrer('bitume-lieu-rocher-alpin', rocherOrganique([[2.1, 1.1, .28], [3.9, 2.6, .16], [5.7, .8, .09]], .38, 1.18, 2));

  // 5b. Lac / bassin organique asymétrique (18 sommets, 3 harmoniques déphasées, fermé)
  enregistrer('bitume-lieu-lac-organique', (function () {
    const N = 18, rand = prng(0xAC1D0001), verts = [], faces = [];
    const amp1 = .34 + rand() * .10, amp2 = .13 + rand() * .07, amp3 = .06 + rand() * .04;
    const ph1 = rand() * TAU, ph2 = rand() * TAU, ph3 = rand() * TAU;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const r = .52 + amp1 * Math.sin(a + ph1) * .45 + amp2 * Math.sin(3 * a + ph2) + amp3 * Math.sin(5 * a + ph3);
      const x = Math.cos(a) * r, z = Math.sin(a) * r * (.76 + .18 * Math.sin(2 * a + ph2));
      verts.push([x, .04, z]);
      verts.push([x * .96, -.04, z * .96]);
    }
    const cTop = verts.length; verts.push([0, .05, 0]);
    const cBot = verts.length; verts.push([0, -.05, 0]);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const t0 = i * 2, b0 = t0 + 1, t1 = j * 2, b1 = t1 + 1;
      faces.push([cTop, t1, t0], [cBot, b0, b1]);
      faces.push([t0, t1, b1], [t0, b1, b0]);
    }
    return normaliserBoite(maillageLisse(verts, faces, false));
  })());

  // 5c. Cascade organique asymétrique (rideau d'eau incurvé à largeur variable, fermé)
  enregistrer('bitume-lieu-cascade', (function () {
    const rand = prng(0xCA5C0002), SH = 12, SW = 8, verts = [], faces = [];
    const larg = [], cx = [], cz = [];
    for (let j = 0; j <= SH; j++) {
      const t = j / SH;
      larg.push(Math.max(.18, .36 + .11 * Math.sin(t * Math.PI * 2.3 + .4) + .05 * Math.sin(t * Math.PI * 5.2)));
      cx.push(.07 * Math.sin(t * Math.PI * 1.7 + .4) + .03 * Math.sin(t * Math.PI * 4.1));
      cz.push(.06 * Math.cos(t * Math.PI * 1.9 + .7) + .03 * Math.sin(t * Math.PI * 3.3));
    }
    const stride = SW + 1, frontCount = (SH + 1) * stride;
    for (let face = 0; face < 2; face++) {
      const zOff = face === 0 ? -.05 : .05;
      for (let j = 0; j <= SH; j++) {
        const y = .5 - j / SH, w = larg[j];
        for (let i = 0; i <= SW; i++) {
          const u = (i / SW) * 2 - 1;
          verts.push([u * w + cx[j] + (rand() - .5) * .018, y + (rand() - .5) * .012, cz[j] + zOff + Math.cos(u * Math.PI * .5) * (face === 0 ? -.04 : .02)]);
        }
      }
    }
    for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
      const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
      faces.push([a, c, b], [b, c, d]);
      const ba = frontCount + a, bb = frontCount + b, bc = frontCount + c, bd = frontCount + d;
      faces.push([ba, bb, bc], [bb, bd, bc]);
    }
    for (let j = 0; j < SH; j++) {
      const l0 = j * stride, l1 = (j + 1) * stride;
      faces.push([l0, frontCount + l0, l1], [l1, frontCount + l0, frontCount + l1]);
      const r0 = j * stride + SW, r1 = (j + 1) * stride + SW;
      faces.push([r0, r1, frontCount + r0], [r1, frontCount + r1, frontCount + r0]);
    }
    for (let i = 0; i < SW; i++) {
      faces.push([i, i + 1, frontCount + i], [i + 1, frontCount + i + 1, frontCount + i]);
      const b0 = SH * stride + i, b1 = b0 + 1;
      faces.push([b0, frontCount + b0, b1], [b1, frontCount + b0, frontCount + b1]);
    }
    return normaliserBoite(maillageLisse(verts, faces, false));
  })());

  // 6. Piton calcaire karstique (pain de sucre arrondi fuselé)
  enregistrer('bitume-lieu-rocher-calcaire', (function () {
    const { verts, faces } = icosphere(2);
    const def = verts.map(v => {
      const t = (v[1] + 1) * .5;
      const fuseau = .96 - .62 * t * t;
      const onde = 1 + .16 * harmonique(v[0], v[1], v[2], 3.1, .8) + .09 * harmonique(v[0], v[1], v[2], 5.4, 2.1);
      const r = Math.max(.22, fuseau * onde);
      let y = v[1] * 1.45;
      if (y < 0) y *= .32;
      return [v[0] * r, y, v[2] * r];
    });
    return normaliserBoite(maillageLisse(def, faces, false));
  })());

  // 7. Dune de sable organique (crête courbée dissymétrique en croissant, fermée dessous)
  enregistrer('bitume-lieu-dune', (function () {
    const { verts, faces } = icosphere(2);
    const def = verts.map(v => {
      const a = Math.atan2(v[2], v[0]);
      const asym = 1 + .26 * Math.sin(a + .4) + .14 * Math.cos(2 * a - .6);
      const x = v[0] * 1.35 * asym;
      const z = (v[2] + .28 * v[0] * v[0]) * .92;
      let y = v[1] > 0 ? Math.pow(v[1], 1.25) * (.55 + .18 * Math.cos(a - .3)) : v[1] * .12;
      return [x, y, z];
    });
    return normaliserBoite(maillageLisse(def, faces, false));
  })());

  // 8. Pyramide lisse du désert (faces nettes monumentales + socle fermé)
  enregistrer('bitume-lieu-pyramide', (function () {
    const verts = [
      [-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5],
      [0, .5, 0],
    ];
    const faces = [
      [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0],
      [0, 1, 2], [0, 2, 3],
    ];
    return normaliserBoite(maillageLisse(verts, faces, true));
  })());

  // 9. Pyramide à degrés (5 gradins type Saqqara, fermée)
  enregistrer('bitume-lieu-pyramide-degres', (function () {
    const verts = [], faces = [], N = 5;
    for (let d = 0; d < N; d++) {
      const y0 = -.5 + d / N, y1 = -.5 + (d + 1) / N;
      const w0 = .5 * (1 - d / N * .78), w1 = w0 * .93;
      const o = verts.length;
      verts.push([-w0, y0, -w0], [w0, y0, -w0], [w0, y0, w0], [-w0, y0, w0],
                 [-w1, y1, -w1], [w1, y1, -w1], [w1, y1, w1], [-w1, y1, w1]);
      for (let s = 0; s < 4; s++) {
        const s1 = (s + 1) % 4;
        faces.push([o + s, o + 4 + s1, o + s1], [o + s, o + 4 + s, o + 4 + s1]);
      }
      // Terrasse supérieure de chaque degré
      faces.push([o + 4, o + 7, o + 6], [o + 4, o + 6, o + 5]);
      if (d === 0) faces.push([o + 0, o + 1, o + 2], [o + 0, o + 2, o + 3]);
    }
    return normaliserBoite(maillageLisse(verts, faces, true));
  })());

  // 10. Obélisque effilé avec pyramidion
  enregistrer('bitume-lieu-obelisque', (function () {
    const b = .5, t = .32;
    const verts = [
      [-b, -.5, -b], [b, -.5, -b], [b, -.5, b], [-b, -.5, b],
      [-t, .36, -t], [t, .36, -t], [t, .36, t], [-t, .36, t],
      [0, .5, 0],
    ];
    const faces = [];
    for (let s = 0; s < 4; s++) {
      const s1 = (s + 1) % 4;
      faces.push([s, 4 + s1, s1], [s, 4 + s, 4 + s1], [4 + s, 8, 4 + s1]);
    }
    faces.push([0, 1, 2], [0, 2, 3]);
    return normaliserBoite(maillageLisse(verts, faces, true));
  })());

  // 11. Arche naturelle en roche (enjambe Z ∈ [−0,5 ; +0,5], pieds solides en bas, ouverture libre au centre)
  enregistrer('bitume-lieu-arche-naturelle', (function () {
    const K = 18, pts = [], rads = [];
    for (let k = 0; k <= K; k++) {
      const s = k / K, u = s * 2 - 1; // −1 → +1
      const z = Math.sign(u) * Math.pow(Math.abs(u), .72) * .46;
      const y = -.5 + Math.pow(Math.max(0, 1 - u * u), .62) * .92;
      pts.push([.025 * Math.sin(s * Math.PI * 3), y, z]);
      const epais = .085 + .075 * Math.pow(Math.abs(u), 1.6);
      rads.push([epais * 1.15, epais * .88]);
    }
    const deform = (k, j, a) => 1 + .16 * Math.sin(k * 1.3 + a * 2) + .09 * Math.cos(k * 2.1 - a * 3);
    const facesParSection = 20; // deux triangles entre deux anneaux pour chacune des dix faces
    const triangles = normaliserBoite(tubeFerme(pts, rads, 10, [1, 0, 0], deform));
    for (let k = 0; k < K; k++) {
      const points = new Map();
      for (const face of triangles.slice(k * facesParSection, (k + 1) * facesParSection))
        for (let coin = 0; coin < 3; coin++) points.set(face[coin].join(','), face[coin]);
      sectionsArche.push(Array.from(points.values()));
    }
    return triangles;
  })());

  // 12. Arche de pont architecturale (enjambe Z ∈ [−0,5 ; +0,5], courbe tendue régulière)
  enregistrer('bitume-lieu-arche-pont', (function () {
    const K = 18, pts = [], rads = [];
    for (let k = 0; k <= K; k++) {
      const s = k / K, u = s * 2 - 1;
      const z = u * .47;
      const y = -.5 + Math.sqrt(Math.max(0, 1 - u * u * .96)) * .94;
      pts.push([0, y, z]);
      const ep = .055 + .032 * u * u;
      rads.push([.14, ep]);
    }
    return normaliserBoite(tubeFerme(pts, rads, 8, [1, 0, 0], null));
  })());

  // 13. Toit de pagode concave aux quatre coins relevés (fermé dessus et dessous)
  enregistrer('bitume-lieu-toit-pagode', (function () {
    const verts = [], faces = [], R = 6;
    const anneaux = [];
    for (let r = 0; r <= R; r++) {
      const t = r / R, w = .04 + .46 * t;
      // Courbe concave : pente forte près du faîte, avant-toits qui se relèvent aux angles
      const yMil = .45 * Math.pow(1 - t, 1.55) - .35;
      const yCoin = yMil + .13 * Math.pow(t, 2.4);
      const o = verts.length;
      // 8 points par anneau (4 coins + 4 milieux) pour marquer la courbe relevée aux angles
      verts.push(
        [-w, yCoin, -w], [0, yMil, -w * .94], [w, yCoin, -w], [w * .94, yMil, 0],
        [w, yCoin, w], [0, yMil, w * .94], [-w, yCoin, w], [-w * .94, yMil, 0]
      );
      anneaux.push(o);
    }
    for (let r = 0; r < R; r++) for (let j = 0; j < 8; j++) {
      const j1 = (j + 1) % 8, a = anneaux[r] + j, b = anneaux[r + 1] + j, c = anneaux[r + 1] + j1, d = anneaux[r] + j1;
      faces.push([a, c, b], [a, d, c]);
    }
    const sommet = verts.length; verts.push([0, .5, 0]);
    const bas = verts.length; verts.push([0, -.42, 0]);
    for (let j = 0; j < 8; j++) {
      const j1 = (j + 1) % 8;
      faces.push([sommet, anneaux[0] + j1, anneaux[0] + j]);
      faces.push([bas, anneaux[R] + j, anneaux[R] + j1]);
    }
    return normaliserBoite(maillageLisse(verts, faces, true));
  })());

  // 14. Bulbe doré sibérien (clocher orthodoxe du lac Baïkal)
  enregistrer('bitume-lieu-bulbe', revolution([
    [.24, -.50], [.30, -.38], [.46, -.20], [.50, -.02], [.42, .14], [.22, .28], [.08, .40], [.02, .50]
  ], 12, false));

  // 15. Voile gonflée par le vent (voiliers de Port-Sable, volume fin fermé)
  enregistrer('bitume-lieu-voile', (function () {
    const K = 10, pts = [], rads = [];
    for (let k = 0; k <= K; k++) {
      const s = k / K;
      const y = -.48 + s * .96;
      const large = .38 * (1 - s * .88) + .02;
      const ventre = .14 * Math.sin(Math.PI * s);
      pts.push([ventre, y, -.12 * (1 - s)]);
      rads.push([.028, large]);
    }
    return normaliserBoite(tubeFerme(pts, rads, 8, [1, 0, 0], null));
  })());

  // 16. Couronne de 7 palmes recourbées (oasis du désert)
  enregistrer('bitume-lieu-palme', (function () {
    let tris = [];
    for (let p = 0; p < 7; p++) {
      const a = p / 7 * TAU + .25, ca = Math.cos(a), sa = Math.sin(a);
      const pts = [], rads = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6, dist = .04 + t * .46;
        const y = .12 + .18 * Math.sin(t * Math.PI * .75) - .32 * t * t;
        pts.push([ca * dist, y, sa * dist]);
        rads.push([.022 * (1 - .6 * t), .078 * Math.sin(Math.PI * (.12 + .82 * t))]);
      }
      tris = tris.concat(tubeFerme(pts, rads, 6, [0, 1, 0], null));
    }
    return normaliserBoite(tris);
  })());

  // 17. Fumerolle géothermale (vasque volcanique arrondie)
  enregistrer('bitume-lieu-fumerolle', revolution([
    [.50, -.50], [.44, -.22], [.34, .06], [.26, .30], [.22, .48], [.14, .42]
  ], 12, false));

  // 18. Cône de clocher / flèche (solide fermé à 12 pans)
  enregistrer('bitume-lieu-cone', revolution([
    [.50, -.50], [.36, -.15], [.20, .18], [.02, .50]
  ], 12, true));

  // ================================================================ sélection de rochers et pyramides
  const ROCHERS_THEME = Object.freeze({
    desert: Object.freeze(['bitume-lieu-galet-a', 'bitume-lieu-galet-b', 'bitume-lieu-galet-c', 'bitume-lieu-dune']),
    islande: Object.freeze(['bitume-lieu-rocher-volcan', 'bitume-lieu-galet-b', 'bitume-lieu-galet-c']),
    montagne: Object.freeze(['bitume-lieu-rocher-alpin', 'bitume-lieu-galet-a', 'bitume-lieu-galet-c']),
    asie: Object.freeze(['bitume-lieu-rocher-calcaire', 'bitume-lieu-galet-b', 'bitume-lieu-galet-a']),
    pacifique: Object.freeze(['bitume-lieu-galet-a', 'bitume-lieu-galet-b', 'bitume-lieu-galet-c']),
    cote: Object.freeze(['bitume-lieu-galet-a', 'bitume-lieu-galet-b', 'bitume-lieu-galet-c']),
    foret: Object.freeze(['bitume-lieu-galet-a', 'bitume-lieu-galet-b', 'bitume-lieu-galet-c']),
    baikal: Object.freeze(['bitume-lieu-galet-a', 'bitume-lieu-galet-b', 'bitume-lieu-rocher-alpin']),
  });
  function rocherPour(theme, graine) {
    const liste = ROCHERS_THEME[theme] || ROCHERS_THEME.foret;
    const h = Math.imul((graine | 0) ^ 0x45d9f3b, 0x27d4eb2d) >>> 0;
    return liste[h % liste.length];
  }
  function pyramidePour(graine) {
    const h = Math.imul((graine | 0) ^ 0x1b873593, 0x85ebca6b) >>> 0;
    return (h & 3) === 0 ? 'bitume-lieu-pyramide-degres' : 'bitume-lieu-pyramide';
  }

  // ================================================================ PARTIE 2 : lieux emblématiques des 9 circuits
  function obj(shape, p, s, r, mat, color, extra) {
    const o = { shape, p: [p[0], p[1], p[2]], s: [s[0], s[1], s[2]], r: r ? [r[0], r[1], r[2]] : [0, 0, 0], mat, color: color.slice() };
    if (extra) Object.assign(o, extra);
    return o;
  }
  function solide(o, genre) {
    if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(o, genre, 2);
    return o;
  }
  function basEmprise(terrain, x, z, rayon) {
    let b = terrain.sol(x, z);
    if (rayon > 1) {
      b = Math.min(b, terrain.sol(x + rayon, z), terrain.sol(x - rayon, z), terrain.sol(x, z + rayon), terrain.sol(x, z - rayon));
    }
    return b;
  }
  function librePiste(interroger, lim, x, z, rayon) {
    const q = interroger(x, z, 220, true);
    if (q.i < 0) return true;
    const limMax = Math.max(lim.G[q.i] || 14, lim.D[q.i] || 14);
    return q.d >= limMax + rayon + 10;
  }
  function surPont(c, s) {
    if (!c.ponts || !c.ponts.length) return false;
    for (const p of c.ponts) {
      const d0 = p.debut !== undefined ? p.debut : p.s0, d1 = p.fin !== undefined ? p.fin : p.s1;
      if (s >= d0 - 45 && s <= d1 + 45) return true;
    }
    return false;
  }
  function choisirPassage(c, secteur, fractionCible, courbureMax = .012) {
    const n = secteur?.n ?? c.n, centre = Math.floor(fractionCible * n) % n, plage = Math.floor(n * .16);
    for (let off = 0; off < plage; off++) {
      for (const sgn of off === 0 ? [0] : [1, -1]) {
        const i = secteur ? secteur.indice(fractionCible, sgn * off) : (centre + sgn * off + n) % n;
        const f = B.decor.cadre(c, i);
        if (Math.abs(B.circuit.ecart(c, 0, f.s)) < 360) continue;
        if (B.circuit.dansCouvert && B.circuit.dansCouvert(c, f.s, 75)) continue;
        if (surPont(c, f.s)) continue;
        if (Math.abs(f.k) > courbureMax) continue;
        return f;
      }
    }
    return secteur ? null : B.decor.cadre(c, centre);
  }
  function choisirSite(c, secteur, terrain, interroger, lim, fractionCible, cotePref, distMin, distMax, rayon, eauMin) {
    const n = secteur?.n ?? c.n, centre = Math.floor(fractionCible * n) % n;
    for (const cote of [cotePref, -cotePref]) {
      for (let off = 0; off < Math.floor(n * .18); off += 3) {
        const i = secteur ? secteur.indice(fractionCible, off) : (centre + off) % n, f = B.decor.cadre(c, i);
        if (Math.abs(B.circuit.ecart(c, 0, f.s)) < 320) continue;
        for (let d = distMin; d <= distMax; d += 12) {
          const x = f.x + f.r[0] * cote * d, z = f.z + f.r[2] * cote * d;
          if (!librePiste(interroger, lim, x, z, rayon)) continue;
          const y = terrain.sol(x, z);
          if (eauMin !== undefined && y < eauMin) continue;
          return { x, y, z, i, f, cote, d };
        }
      }
    }
    return null;
  }
  function choisirSiteEau(c, secteur, terrain, interroger, lim, fractionCible, niveauEau, rayon) {
    const n = secteur?.n ?? c.n, centre = Math.floor(fractionCible * n) % n;
    for (let off = 0; off < n; off += 4) {
      const i = secteur ? secteur.indice(fractionCible, off) : (centre + off) % n, f = B.decor.cadre(c, i);
      if (Math.abs(B.circuit.ecart(c, 0, f.s)) < 320) continue;
      for (const cote of [-1, 1]) {
        for (let d = 55; d <= 165; d += 18) {
          const x = f.x + f.r[0] * cote * d, z = f.z + f.r[2] * cote * d;
          if (!librePiste(interroger, lim, x, z, rayon)) continue;
          const y = terrain.sol(x, z);
          if (y < niveauEau - .8 && y > niveauEau - 16) return { x, y: niveauEau, z, i, f, cote, d };
        }
      }
    }
    return null;
  }
  function deposer(ajouter, objets, loin, x, z) {
    if (objets.length) ajouter(objets, loin.length ? loin : objets.slice(), x, z);
  }
  function poserArcheRoute(f, lim, terrain, shape, haut, epais, mat, color, pilierMat, pilierColor) {
    const limG = (lim.G[f.i] || 13) + 3.2, limD = (lim.D[f.i] || 13) + 3.2;
    const dec = (limD - limG) * .5, span = limG + limD + 6.5;
    const cx = f.x + f.r[0] * dec, cz = f.z + f.r[2] * dec;
    const rot = [0, -f.a, 0];
    const ySol = Math.min(f.y, terrain.sol(f.x - f.r[0] * limG, f.z - f.r[2] * limG), terrain.sol(f.x + f.r[0] * limD, f.z + f.r[2] * limD));
    const hTot = Math.max(haut, (f.y - ySol) + 12.5);
    const ySommet = ySol + hTot - 1.2;
    const objets = [obj(shape, [cx, ySol + hTot * .5 - .6, cz], [epais, hTot, span], rot, mat, color)];
    if (shape === 'bitume-lieu-arche-naturelle') {
      const arche = objets[0], ca = Math.cos(f.a), sa = Math.sin(f.a);
      // Relever les appuis sous les deux vrais pieds de la voûte, y compris sur un versant incliné.
      let basLibre = -Infinity;
      for (const section of [sectionsArche[0], sectionsArche[sectionsArche.length-1]]) {
        for (const sommet of section) {
          const dx = sommet[0] * epais, dz = sommet[2] * span;
          const sol = terrain.sol(cx + ca*dx - sa*dz, cz + sa*dx + ca*dz);
          basLibre = Math.max(basLibre, sol - sommet[1] * hTot);
        }
      }
      arche.p[1] = basLibre + .04;
      arche.mobilePhysX = { genre: 'arche-rocheuse', masse: epais * hTot * span * 340, sections: sectionsArche };
    }
    if (pilierMat !== undefined) {
      for (const [sgn, limC] of [[-1, limG], [1, limD]]) {
        const px = f.x + f.r[0] * sgn * (limC + 2.2), pz = f.z + f.r[2] * sgn * (limC + 2.2);
        const py = Math.min(f.y, terrain.sol(px, pz)) - 2.0;
        const ph = (ySommet + .4) - py;
        objets.push(solide(obj('box', [px, py + ph * .5, pz], [epais * 1.25, ph, 5.2], rot, pilierMat, pilierColor), 'pilier-lieu'));
        // Culée / talus latéral ancré dans le terrain (pas de tablier suspendu dans le vide)
        const ax = f.x + f.r[0] * sgn * (limC + 8.0), az = f.z + f.r[2] * sgn * (limC + 8.0);
        const ay = Math.min(f.y, terrain.sol(ax, az)) - 2.5, ah = Math.max(4, (ySommet - 2.2) - ay);
        objets.push(solide(obj('bitume-lieu-galet-a', [ax, ay + ah * .5, az], [epais * 2.2, ah, 11.5], rot, 9, pilierColor), 'culée-lieu'));
      }
    }
    return { objets, cx, cz, span, hTot, ySommet };
  }

  function poser(c, outils) {
    const { terrain, limites: lim, interroger, qualite, saison, ajouter, th, secteur } = outils;
    const rng = prng((secteur?.graine ?? c.graine ?? 1) ^ 0x51a7c9e3);
    const theme = secteur?.theme || c.theme || 'foret';
    const estCimes = c.id === 'route-des-cimes';
    const low = qualite === 'low';
    const neige = !!(saison && saison.neige);
    const marqueurs = [];

    // ─── 1. ROUTE DES CIMES : Arche-Portique du Col + Belvédère Panoramique ───
    if (estCimes) {
      const f = choisirPassage(c, secteur, .22, .012);
      if (f) {
        const { objets, cx, cz, span, hTot, ySommet } = poserArcheRoute(f, lim, terrain, 'bitume-lieu-arche-pont', 15.5, 4.4, 3, [.52, .50, .47], 9, [.44, .42, .39]);
        const tab = obj('box', [cx, ySommet + .45, cz], [5.4, 1.1, span + 4], [0, -f.a, 0], 3, [.58, .56, .52]);
        objets.push(tab);
        deposer(ajouter, objets, objets.slice(), cx, cz);
        marqueurs.push({ nom: 'Arche du Col des Cimes', type: 'arche', x: cx, y: f.y + hTot, z: cz });
      }
      const site = choisirSite(c, secteur, terrain, interroger, lim, .62, 1, 36, 95, 16);
      if (site) {
        const yb = basEmprise(terrain, site.x, site.z, 9) - .8, objets = [];
        objets.push(solide(obj('bitume-lieu-rocher-alpin', [site.x, yb + 3.2, site.z], [20, 8, 18], [0, rng() * TAU, 0], 9, [.45, .44, .41]), 'roche-lieu'));
        objets.push(solide(obj('cylinder', [site.x, yb + 9.2, site.z], [11, 5.2, 11], [0, 0, 0], 3, [.62, .60, .56]), 'belvedere'));
        objets.push(obj('cylinder', [site.x, yb + 12.1, site.z], [12.4, .65, 12.4], [0, 0, 0], 3, neige ? [.90, .93, .96] : [.42, .40, .38]));
        objets.push(obj('cylinder', [site.x, yb + 13.2, site.z], [2.4, 1.5, 2.4], [0, 0, 0], 17, [.74, .58, .26]));
        deposer(ajouter, objets, objets.slice(), site.x, site.z);
        marqueurs.push({ nom: 'Belvédère Panoramique des Cimes', type: 'belvedere', x: site.x, y: yb + 13.5, z: site.z });
      }
      return { marqueurs };
    }

    // ─── 2. VAL-BRÛLÉ (foret) : Viaduc des Chênes + Beffroi / Tour de l'Horloge ───
    if (theme === 'foret') {
      const f = choisirPassage(c, secteur, .26, .012);
      if (f) {
        const { objets, cx, cz, span, ySommet } = poserArcheRoute(f, lim, terrain, 'bitume-lieu-arche-pont', 15, 4.6, 3, [.58, .54, .48], 3, [.50, .47, .42]);
        objets.push(obj('box', [cx, ySommet + .45, cz], [5.8, 1.2, span + 6], [0, -f.a, 0], 3, [.54, .50, .44]));
        for (const sgn of [-1, 1]) {
          objets.push(obj('box', [cx + f.t[0] * sgn * 2.6, ySommet + 1.5, cz + f.t[2] * sgn * 2.6], [.45, 1.1, span + 6], [0, -f.a, 0], 3, [.62, .58, .51]));
        }
        deposer(ajouter, objets, objets.slice(), cx, cz);
        marqueurs.push({ nom: 'Viaduc des Chênes', type: 'viaduc', x: cx, y: ySommet + 1.5, z: cz });
      }
      const siteT = choisirSite(c, secteur, terrain, interroger, lim, .62, 1, 38, 92, 12);
      if (siteT) {
        const yb = basEmprise(terrain, siteT.x, siteT.z, 6) - .8, H = 24, a = -siteT.f.a, objets = [];
        objets.push(solide(obj('box', [siteT.x, yb + H * .5, siteT.z], [6.4, H, 6.4], [0, a, 0], 3, [.68, .63, .54]), 'tour-horloge'));
        objets.push(obj('bitume-lieu-cone', [siteT.x, yb + H + 4.2, siteT.z], [7.8, 8.5, 7.8], [0, a, 0], 1, neige ? [.90, .93, .96] : [.22, .25, .30]));
        // Quatre cadrans lumineux visibles depuis la piste
        for (const [dx, dz, rotY] of [[3.28, 0, a], [-3.28, 0, a], [0, 3.28, a + Math.PI / 2], [0, -3.28, a + Math.PI / 2]]) {
          const cx = siteT.x + dx * Math.cos(-a) - dz * Math.sin(-a), cz = siteT.z + dx * Math.sin(-a) + dz * Math.cos(-a);
          objets.push(obj('box', [cx, yb + H - 4.2, cz], [.14, 3.2, 3.2], [0, rotY, 0], 5, [.98, .95, .84], { emissive: 1.2 }));
        }
        deposer(ajouter, objets, objets.slice(0, 3), siteT.x, siteT.z);
        marqueurs.push({ nom: 'Tour de l’Horloge', type: 'monument', x: siteT.x, y: yb + H + 8, z: siteT.z });
      }
      return { marqueurs };
    }

    // ─── 3. PORT-SABLE (cote) : Grand Phare du Cap + Port aux Voiliers + Arche Maritime ───
    if (theme === 'cote') {
      const eau = terrain.niveauEau !== undefined ? terrain.niveauEau : -4;
      const siteP = choisirSite(c, secteur, terrain, interroger, lim, .28, 1, 40, 105, 16, eau + 1.5);
      if (siteP) {
        const yb = basEmprise(terrain, siteP.x, siteP.z, 7) - 1.2, H = 34, objets = [];
        objets.push(solide(obj('bitume-lieu-galet-b', [siteP.x, yb + 2.2, siteP.z], [15, 5.5, 14], [0, rng() * TAU, 0], 9, [.44, .41, .36]), 'roche-lieu'));
        objets.push(solide(obj('cylinder', [siteP.x, yb + 3 + H * .5, siteP.z], [5.8, H, 5.8], [0, 0, 0], 16, [.94, .93, .90]), 'phare'));
        for (let b = 0; b < (low ? 3 : 4); b++) {
          objets.push(obj('cylinder', [siteP.x, yb + 7.5 + b * 7.2, siteP.z], [6.05, 2.8, 6.05], [0, 0, 0], 16, [.84, .14, .10]));
        }
        objets.push(obj('cylinder', [siteP.x, yb + 3 + H + 2.1, siteP.z], [4.2, 3.6, 4.2], [0, 0, 0], 5, [1.0, .88, .42], { emissive: 2.2 }));
        objets.push(obj('bitume-lieu-cone', [siteP.x, yb + 3 + H + 5.2, siteP.z], [5.0, 2.8, 5.0], [0, 0, 0], 16, [.78, .14, .10]));
        deposer(ajouter, objets, objets.slice(0, 5), siteP.x, siteP.z);
        marqueurs.push({ nom: 'Grand Phare du Cap', type: 'phare', x: siteP.x, y: yb + H + 6, z: siteP.z });
      }
      const sitePort = choisirSiteEau(c, secteur, terrain, interroger, lim, .68, eau, 22);
      if (sitePort) {
        const a = -sitePort.f.a, objets = [];
        objets.push(obj('box', [sitePort.x, eau + .9, sitePort.z], [28, 1.4, 4.2], [0, a, 0], 10, [.42, .30, .18]));
        for (let v = 0; v < (low ? 2 : 3); v++) {
          const dec = (v - 1) * 11, vx = sitePort.x + sitePort.f.t[0] * dec + sitePort.f.r[0] * 10, vz = sitePort.z + sitePort.f.t[2] * dec + sitePort.f.r[2] * 10;
          ajouterVoilier(objets, vx, vz, eau, a + .15 * v, a + .35);
        }
        deposer(ajouter, objets, objets.slice(), sitePort.x, sitePort.z);
        marqueurs.push({ nom: 'Port aux Voiliers', type: 'port', x: sitePort.x, y: eau + 10, z: sitePort.z });
      }
      const fa = choisirPassage(c, secteur, .50, .012);
      if (fa) {
        const { objets, cx, cz, hTot } = poserArcheRoute(fa, lim, terrain, 'bitume-lieu-arche-naturelle', 17, 6.5, 9, [.64, .58, .48]);
        deposer(ajouter, objets, objets.slice(), cx, cz);
        marqueurs.push({ nom: 'Arche Calcaire de la Côte', type: 'arche', x: cx, y: fa.y + hTot, z: cz });
      }
      return { marqueurs };
    }

    // ─── 4. HAUT-COL (montagne) : Galerie Paravalanche + Téléphérique des Aiguilles ───
    if (theme === 'montagne') {
      const fg = choisirPassage(c, secteur, .32, .009);
      if (fg) {
        const limG = (lim.G[fg.i] || 12) + 2.8, limD = (lim.D[fg.i] || 12) + 2.8;
        const dec = (limD - limG) * .5, span = limG + limD + 3.2, galLen = 54, rot = [0, -fg.a, 0];
        const cx = fg.x + fg.r[0] * dec, cz = fg.z + fg.r[2] * dec, objets = [];
        // Mur massif côté amont (gauche) + colonnade ouverte côté aval (droite) + dalle pare-neige inclinée
        const mx = fg.x - fg.r[0] * (limG + 1.2), mz = fg.z - fg.r[2] * (limG + 1.2);
        objets.push(solide(obj('box', [mx, fg.y + 4.8, mz], [galLen, 11, 2.2], rot, 3, [.52, .51, .49]), 'galerie-paravalanche'));
        for (let k = -3; k <= 3; k++) {
          const px = fg.x + fg.t[0] * k * 8.2 + fg.r[0] * (limD + 1.1);
          const pz = fg.z + fg.t[2] * k * 8.2 + fg.r[2] * (limD + 1.1);
          objets.push(solide(obj('box', [px, fg.y + 4.6, pz], [1.4, 10.6, 1.5], rot, 3, [.55, .54, .51]), 'pilier-galerie'));
        }
        objets.push(obj('box', [cx, fg.y + 10.4, cz], [galLen + 2, 1.0, span + 2.5], [0, -fg.a, 0], 3, neige ? [.92, .95, .98] : [.46, .45, .43]));
        deposer(ajouter, objets, objets.slice(), cx, cz);
        marqueurs.push({ nom: 'Galerie Paravalanche', type: 'galerie', x: cx, y: fg.y + 11, z: cz });
      }
      const ft = choisirPassage(c, secteur, .70, .012);
      if (ft) {
        const limG = (lim.G[ft.i] || 12) + 6.5, limD = (lim.D[ft.i] || 12) + 6.5;
        const pL = [ft.x - ft.r[0] * limG, Math.min(ft.y, terrain.sol(ft.x - ft.r[0] * limG, ft.z - ft.r[2] * limG)), ft.z - ft.r[2] * limG];
        const pR = [ft.x + ft.r[0] * limD, Math.min(ft.y, terrain.sol(ft.x + ft.r[0] * limD, ft.z + ft.r[2] * limD)), ft.z + ft.r[2] * limD];
        const topY = ft.y + 26, rot = [0, -ft.a, 0], objets = [];
        for (const p of [pL, pR]) {
          const h = topY - p[1] + 2;
          objets.push(solide(obj('box', [p[0], p[1] + h * .5 - 1, p[2]], [2.2, h, 2.2], rot, 0, [.42, .44, .46]), 'pylone-telepherique'));
          objets.push(obj('box', [p[0], topY, p[2]], [6.5, .9, 1.4], rot, 0, [.45, .47, .50]));
        }
        const span = limG + limD + 2, dec = (limD - limG) * .5, cx = ft.x + ft.r[0] * dec, cz = ft.z + ft.r[2] * dec;
        for (const off of [-2.2, 2.2]) {
          objets.push(obj('box', [cx + ft.t[0] * off, topY - .2, cz + ft.t[2] * off], [.22, .22, span], rot, 0, [.18, .19, .21]));
        }
        if (!low) {
          objets.push(obj('box', [cx - ft.r[0] * 4 + ft.t[0] * 2.2, topY - 4.2, cz - ft.r[2] * 4 + ft.t[2] * 2.2], [3.6, 3.2, 2.6], rot, 16, [.86, .12, .10]));
          objets.push(obj('box', [cx + ft.r[0] * 6 - ft.t[0] * 2.2, topY - 4.8, cz + ft.r[2] * 6 - ft.t[2] * 2.2], [3.6, 3.2, 2.6], rot, 16, [.94, .76, .12]));
        }
        deposer(ajouter, objets, objets.slice(0, 6), cx, cz);
        marqueurs.push({ nom: 'Téléphérique des Aiguilles', type: 'telepherique', x: cx, y: topY, z: cz });
      }
      return { marqueurs };
    }

    // ─── 5. LANDE-NOIRE (islande) : Pont-Arche Noir + Kirkja Nordique + Lagon Géothermal ───
    if (theme === 'islande') {
      const fp = choisirPassage(c, secteur, .24, .012);
      if (fp) {
        const { objets, cx, cz, span, ySommet } = poserArcheRoute(fp, lim, terrain, 'bitume-lieu-arche-pont', 16, 3.6, 0, [.13, .14, .16], 9, [.14, .15, .17]);
        objets.push(obj('box', [cx, ySommet + .45, cz], [5.4, .95, span + 5], [0, -fp.a, 0], 0, [.16, .17, .19]));
        deposer(ajouter, objets, objets.slice(), cx, cz);
        marqueurs.push({ nom: 'Pont-Arche Noir de la Faille', type: 'pont', x: cx, y: ySommet + 1.5, z: cz });
      }
      const siteK = choisirSite(c, secteur, terrain, interroger, lim, .55, 1, 38, 92, 14);
      if (siteK) {
        const yb = basEmprise(terrain, siteK.x, siteK.z, 8) - .8, a = -siteK.f.a, objets = [];
        objets.push(solide(obj('box', [siteK.x, yb + 4.2, siteK.z], [9, 8.4, 15], [0, a, 0], 7, [.12, .12, .13]), 'kirkja'));
        objets.push(obj('bitume-lieu-cone', [siteK.x, yb + 12.2, siteK.z], [11.5, 9.2, 16.5], [0, a, 0], 7, neige ? [.92, .94, .97] : [.10, .10, .12]));
        objets.push(obj('cylinder', [siteK.x, yb + 18.8, siteK.z], [1.4, 9.5, 1.4], [0, 0, 0], 16, [.92, .93, .95]));
        objets.push(obj('box', [siteK.x, yb + 22.0, siteK.z], [3.6, .5, .5], [0, a, 0], 16, [.92, .93, .95]));
        deposer(ajouter, objets, objets.slice(), siteK.x, siteK.z);
        marqueurs.push({ nom: 'Kirkja Nordique', type: 'monument', x: siteK.x, y: yb + 23, z: siteK.z });
      }
      const siteL = choisirSite(c, secteur, terrain, interroger, lim, .80, -1, 44, 105, 22);
      if (siteL) {
        const yb = terrain.sol(siteL.x, siteL.z), objets = [];
        objets.push(obj('cylinder', [siteL.x, yb + .25, siteL.z], [28, .8, 22], [0, rng() * TAU, 0], 5, [.28, .82, .88], { emissive: .45 }));
        for (let f = 0; f < (low ? 4 : 7); f++) {
          const ang = f / (low ? 4 : 7) * TAU + rng() * .4, rr = 11 + rng() * 5;
          const fx = siteL.x + Math.cos(ang) * rr, fz = siteL.z + Math.sin(ang) * rr, fy = terrain.sol(fx, fz);
          objets.push(obj(f % 2 === 0 ? 'bitume-lieu-fumerolle' : 'bitume-lieu-rocher-volcan', [fx, fy + 1.4, fz], [4.5 + rng() * 3, 2.8 + rng() * 2.2, 4.5 + rng() * 3], [0, rng() * TAU, 0], 9, [.24, .25, .26]));
        }
        deposer(ajouter, objets, objets.slice(0, 5), siteL.x, siteL.z);
        marqueurs.push({ nom: 'Lagon Géothermal', type: 'lagon', x: siteL.x, y: yb + 2, z: siteL.z });
      }
      return { marqueurs };
    }

    // ─── 6. ROCHE-FAUVE (desert) : Nécropole des Pyramides + Grande Arche en Grès + Oasis ───
    if (theme === 'desert') {
      const sitePyr = choisirSite(c, secteur, terrain, interroger, lim, .18, 1, 68, 140, 38);
      if (sitePyr) {
        const yb1 = basEmprise(terrain, sitePyr.x, sitePyr.z, 26) - 2.2, objets = [];
        objets.push(solide(obj('bitume-lieu-pyramide', [sitePyr.x, yb1 + 22, sitePyr.z], [64, 44, 64], [0, .28, 0], 9, [.78, .61, .36]), 'pyramide'));
        const x2 = sitePyr.x + sitePyr.f.t[0] * 58 + sitePyr.f.r[0] * sitePyr.cote * 18;
        const z2 = sitePyr.z + sitePyr.f.t[2] * 58 + sitePyr.f.r[2] * sitePyr.cote * 18;
        if (librePiste(interroger, lim, x2, z2, 24)) {
          const yb2 = basEmprise(terrain, x2, z2, 18) - 1.8;
          objets.push(solide(obj('bitume-lieu-pyramide-degres', [x2, yb2 + 15, z2], [44, 30, 44], [0, .42, 0], 9, [.72, .54, .31]), 'pyramide'));
        }
        const x3 = sitePyr.x - sitePyr.f.t[0] * 48 + sitePyr.f.r[0] * sitePyr.cote * 12;
        const z3 = sitePyr.z - sitePyr.f.t[2] * 48 + sitePyr.f.r[2] * sitePyr.cote * 12;
        if (librePiste(interroger, lim, x3, z3, 18)) {
          const yb3 = basEmprise(terrain, x3, z3, 12) - 1.5;
          objets.push(solide(obj('bitume-lieu-pyramide', [x3, yb3 + 11, z3], [32, 22, 32], [0, .18, 0], 9, [.75, .58, .34]), 'pyramide'));
        }
        const xo = sitePyr.x + sitePyr.f.t[0] * 32 - sitePyr.f.r[0] * sitePyr.cote * 12;
        const zo = sitePyr.z + sitePyr.f.t[2] * 32 - sitePyr.f.r[2] * sitePyr.cote * 12;
        if (librePiste(interroger, lim, xo, zo, 6)) {
          const yo = basEmprise(terrain, xo, zo, 3) - 1.0;
          objets.push(solide(obj('bitume-lieu-obelisque', [xo, yo + 14, zo], [4.4, 28, 4.4], [0, .28, 0], 9, [.70, .52, .30]), 'obelisque'));
        }
        deposer(ajouter, objets, objets.slice(), sitePyr.x, sitePyr.z);
        marqueurs.push({ nom: 'Nécropole des Pyramides', type: 'pyramides', x: sitePyr.x, y: yb1 + 44, z: sitePyr.z });
      }
      const fa = choisirPassage(c, secteur, .50, .012);
      if (fa) {
        const { objets, cx, cz, hTot } = poserArcheRoute(fa, lim, terrain, 'bitume-lieu-arche-naturelle', 18, 7.5, 9, [.64, .34, .18]);
        deposer(ajouter, objets, objets.slice(), cx, cz);
        marqueurs.push({ nom: 'Grande Arche Naturelle en Grès', type: 'arche', x: cx, y: fa.y + hTot, z: cz });
      }
      const siteO = choisirSite(c, secteur, terrain, interroger, lim, .76, -1, 46, 115, 22);
      if (siteO) {
        const yb = terrain.sol(siteO.x, siteO.z), objets = [];
        objets.push(obj('cylinder', [siteO.x, yb + .25, siteO.z], [24, .7, 19], [0, rng() * TAU, 0], 5, [.16, .62, .68], { emissive: .22 }));
        for (let d = 0; d < (low ? 3 : 5); d++) {
          const ang = d / (low ? 3 : 5) * TAU, dx = siteO.x + Math.cos(ang) * 18, dz = siteO.z + Math.sin(ang) * 15;
          objets.push(obj('bitume-lieu-dune', [dx, terrain.sol(dx, dz) + 1.8, dz], [16, 4.8, 12], [0, ang, 0], 8, [.80, .63, .38]));
        }
        for (let p = 0; p < (low ? 4 : 6); p++) {
          const ang = p / (low ? 4 : 6) * TAU + .3, px = siteO.x + Math.cos(ang) * 11, pz = siteO.z + Math.sin(ang) * 9, py = terrain.sol(px, pz);
          const h = 9 + rng() * 3.5;
          objets.push(obj('cylinder', [px, py + h * .5, pz], [.85, h, .85], [0, 0, .08], 10, [.40, .27, .15]));
          objets.push(obj('bitume-lieu-palme', [px, py + h + .8, pz], [7.5, 3.8, 7.5], [0, rng() * TAU, 0], 11, [.18, .44, .14]));
        }
        deposer(ajouter, objets, objets.slice(0, 7), siteO.x, siteO.z);
        marqueurs.push({ nom: 'Oasis du Désert', type: 'oasis', x: siteO.x, y: yb + 10, z: siteO.z });
      }
      return { marqueurs };
    }

    // ─── 7. BRUME-DE-JADE (asie) : Grand Portail Torii Vermillon + Pagode des Brumes ───
    if (theme === 'asie') {
      const ft = choisirPassage(c, secteur, .28, .010);
      if (ft) {
        const limG = (lim.G[ft.i] || 12) + 3.2, limD = (lim.D[ft.i] || 12) + 3.2;
        const dec = (limD - limG) * .5, span = limG + limD + 4, rot = [0, -ft.a, 0];
        const cx = ft.x + ft.r[0] * dec, cz = ft.z + ft.r[2] * dec, objets = [];
        for (const [sgn, limC] of [[-1, limG], [1, limD]]) {
          const px = ft.x + ft.r[0] * sgn * (limC + 1.0), pz = ft.z + ft.r[2] * sgn * (limC + 1.0);
          const py = Math.min(ft.y, terrain.sol(px, pz)) - 1.2, h = (ft.y + 13.5) - py;
          objets.push(solide(obj('cylinder', [px, py + h * .5, pz], [1.8, h, 1.8], [0, 0, 0], 16, [.82, .14, .09]), 'torii'));
          objets.push(solide(obj('bitume-lieu-galet-a', [px, py + 1.6, pz], [3.6, 2.4, 3.6], [0, 0, 0], 9, [.26, .27, .28]), 'socle-torii'));
        }
        // Double linteau traditionnel (nuki + kasagi débordant + chapeau noir)
        objets.push(obj('box', [cx, ft.y + 11.4, cz], [1.2, .95, span + 2.4], rot, 16, [.82, .14, .09]));
        objets.push(obj('box', [cx, ft.y + 13.8, cz], [1.8, 1.25, span + 6.8], rot, 16, [.82, .14, .09]));
        objets.push(obj('box', [cx, ft.y + 14.65, cz], [2.1, .55, span + 7.2], rot, 7, [.12, .12, .13]));
        objets.push(obj('box', [cx, ft.y + 12.6, cz], [1.1, 1.6, 2.2], rot, 7, [.12, .12, .13]));
        deposer(ajouter, objets, objets.slice(), cx, cz);
        marqueurs.push({ nom: 'Grand Portail Torii Vermillon', type: 'torii', x: cx, y: ft.y + 15, z: cz });
      }
      const sitePag = choisirSite(c, secteur, terrain, interroger, lim, .64, 1, 40, 96, 16);
      if (sitePag) {
        const yb = basEmprise(terrain, sitePag.x, sitePag.z, 9) - 1.0, etages = low ? 3 : 4, objets = [];
        objets.push(solide(obj('box', [sitePag.x, yb + 1.2, sitePag.z], [14, 2.4, 14], [0, 0, 0], 9, [.44, .46, .45]), 'pagode'));
        for (let e = 0; e < etages; e++) {
          const ey = yb + 2.4 + e * 5.6, ew = 12 - e * 1.9;
          objets.push(solide(obj('box', [sitePag.x, ey + 2.2, sitePag.z], [ew * .66, 4.4, ew * .66], [0, 0, 0], 16, [.78, .15, .10]), 'pagode'));
          objets.push(obj('bitume-lieu-toit-pagode', [sitePag.x, ey + 5.2, sitePag.z], [ew * 1.18, 3.2, ew * 1.18], [0, 0, 0], 1, [.16, .28, .25]));
        }
        objets.push(obj('cylinder', [sitePag.x, yb + 2.4 + etages * 5.6 + 2.8, sitePag.z], [.7, 6.2, .7], [0, 0, 0], 5, [.94, .78, .24], { emissive: 1.2 }));
        deposer(ajouter, objets, objets.slice(), sitePag.x, sitePag.z);
        marqueurs.push({ nom: 'Pagode des Brumes', type: 'pagode', x: sitePag.x, y: yb + etages * 5.6 + 8, z: sitePag.z });
      }
      return { marqueurs };
    }

    // ─── 8. CAP-SÉQUOIA (pacifique) : Grand Pont Suspendu Vermillon + Arche Séquoia Géant ───
    if (theme === 'pacifique') {
      const fp = choisirPassage(c, secteur, .26, .006);
      if (fp) {
        const limG = (lim.G[fp.i] || 13) + 3.6, limD = (lim.D[fp.i] || 13) + 3.6;
        const dec = (limD - limG) * .5, span = limG + limD + 2.4, rot = [0, -fp.a, 0];
        const cx = fp.x + fp.r[0] * dec, cz = fp.z + fp.r[2] * dec, pylH = 30, objets = [];
        // Deux paires de grands pylônes vermillon encadrant la piste (style Golden Gate)
        for (const along of [-34, 34]) {
          const bx = fp.x + fp.t[0] * along, bz = fp.z + fp.t[2] * along;
          for (const [sgn, limC] of [[-1, limG], [1, limD]]) {
            const px = bx + fp.r[0] * sgn * (limC + 1.4), pz = bz + fp.r[2] * sgn * (limC + 1.4);
            const py = Math.min(fp.y, terrain.sol(px, pz)) - 2.0, h = (fp.y + pylH) - py;
            objets.push(solide(obj('box', [px, py + h * .5, pz], [2.8, h, 2.8], rot, 16, [.78, .22, .10]), 'pylone-pont'));
          }
          // Entretoises hautes largement au-dessus du gabarit routier (13 m et 25 m)
          objets.push(obj('box', [bx + fp.r[0] * dec, fp.y + 13.5, bz + fp.r[2] * dec], [2.0, 1.5, span + 2.5], rot, 16, [.78, .22, .10]));
          objets.push(obj('box', [bx + fp.r[0] * dec, fp.y + 25.5, bz + fp.r[2] * dec], [2.0, 1.6, span + 2.5], rot, 16, [.78, .22, .10]));
        }
        // Câbles porteurs en chaînette + suspentes STRICTEMENT hors limites de piste (côtés gauche et droit)
        for (const [sgn, limC] of [[-1, limG], [1, limD]]) {
          const segs = low ? 6 : 10;
          for (let k = 0; k < segs; k++) {
            const u0 = -1 + 2 * k / segs, u1 = -1 + 2 * (k + 1) / segs, um = (u0 + u1) * .5;
            const y0 = fp.y + 16 + 13 * u0 * u0, y1 = fp.y + 16 + 13 * u1 * u1, ym = (y0 + y1) * .5;
            const sx = fp.x + fp.t[0] * um * 34 + fp.r[0] * sgn * (limC + 1.4);
            const sz = fp.z + fp.t[2] * um * 34 + fp.r[2] * sgn * (limC + 1.4);
            const dx = fp.t[0] * (u1 - u0) * 34, dy = y1 - y0, dz = fp.t[2] * (u1 - u0) * 34, Lc = Math.hypot(dx, dy, dz);
            const rCab = B.decor.angles(...B.decor.base([dx, dy, dz], [0, 1, 0]));
            objets.push(obj('box', [sx, ym, sz], [Lc + .35, .48, .48], rCab, 16, [.74, .20, .09]));
            if (!low && k > 0) {
              const hs = y0 - (fp.y + .4);
              const vx = fp.x + fp.t[0] * u0 * 34 + fp.r[0] * sgn * (limC + 1.4);
              const vz = fp.z + fp.t[2] * u0 * 34 + fp.r[2] * sgn * (limC + 1.4);
              objets.push(obj('box', [vx, fp.y + .4 + hs * .5, vz], [.22, hs, .22], rot, 0, [.68, .22, .11]));
            }
          }
        }
        deposer(ajouter, objets, objets.slice(0, 14), cx, cz);
        marqueurs.push({ nom: 'Grand Pont Suspendu Vermillon', type: 'pont-suspendu', x: cx, y: fp.y + pylH, z: cz });
      }
      const fs = choisirPassage(c, secteur, .66, .012);
      if (fs) {
        const { objets, cx, cz, hTot } = poserArcheRoute(fs, lim, terrain, 'bitume-lieu-arche-naturelle', 17, 6.2, 10, [.38, .19, .10]);
        deposer(ajouter, objets, objets.slice(), cx, cz);
        marqueurs.push({ nom: 'Arche du Séquoia Géant', type: 'arche', x: cx, y: fs.y + hTot, z: cz });
      }
      return { marqueurs };
    }

    // ─── 9. BAÏKAL (baikal) : Chapelle aux Bulbes Dorés + Phare-Jetée + Portique Sibérien ───
    if (theme === 'baikal') {
      const eau = terrain.niveauEau !== undefined ? terrain.niveauEau : -8;
      const siteCh = choisirSite(c, secteur, terrain, interroger, lim, .30, 1, 36, 90, 14, eau + 2);
      if (siteCh) {
        const yb = basEmprise(terrain, siteCh.x, siteCh.z, 8) - 1.0, a = -siteCh.f.a, objets = [];
        objets.push(solide(obj('box', [siteCh.x, yb + 1.2, siteCh.z], [11.5, 2.4, 15.5], [0, a, 0], 9, [.44, .45, .46]), 'chapelle'));
        objets.push(solide(obj('box', [siteCh.x, yb + 5.8, siteCh.z], [9.5, 7.6, 13.5], [0, a, 0], 10, [.42, .26, .14]), 'chapelle'));
        objets.push(obj('bitume-lieu-cone', [siteCh.x, yb + 11.4, siteCh.z], [11, 4.2, 15], [0, a, 0], 1, neige ? [.92, .94, .97] : [.18, .32, .28]));
        // Trois bulbes dorés sur tambours blancs
        for (const [dz, hB, sB] of [[0, 16.5, 4.4], [-4.2, 14.5, 3.1], [4.2, 14.5, 3.1]]) {
          const bx = siteCh.x + siteCh.f.r[0] * dz, bz = siteCh.z + siteCh.f.r[2] * dz;
          objets.push(obj('cylinder', [bx, yb + hB - 2.6, bz], [sB * .58, 3.2, sB * .58], [0, 0, 0], 16, [.92, .92, .90]));
          objets.push(obj('bitume-lieu-bulbe', [bx, yb + hB, bz], [sB, sB * 1.25, sB], [0, 0, 0], 5, [.92, .72, .18], { emissive: .32 }));
        }
        deposer(ajouter, objets, objets.slice(), siteCh.x, siteCh.z);
        marqueurs.push({ nom: 'Chapelle Sibérienne aux Bulbes Dorés', type: 'chapelle', x: siteCh.x, y: yb + 19, z: siteCh.z });
      }
      const sitePJ = choisirSiteEau(c, secteur, terrain, interroger, lim, .62, eau, 18);
      if (sitePJ) {
        const a = -sitePJ.f.a, objets = [];
        objets.push(obj('box', [sitePJ.x, eau + .9, sitePJ.z], [22, 1.2, 3.6], [0, a, 0], 10, [.38, .26, .15]));
        const tx = sitePJ.x + sitePJ.f.t[0] * 8, tz = sitePJ.z + sitePJ.f.t[2] * 8;
        objets.push(solide(obj('cylinder', [tx, eau + 6.5, tz], [3.6, 12, 3.6], [0, 0, 0], 16, [.92, .93, .95]), 'phare-lac'));
        objets.push(obj('cylinder', [tx, eau + 7.2, tz], [3.8, 2.8, 3.8], [0, 0, 0], 16, [.14, .32, .68]));
        objets.push(obj('cylinder', [tx, eau + 13.4, tz], [2.6, 2.4, 2.6], [0, 0, 0], 5, [1.0, .90, .44], { emissive: 2.0 }));
        deposer(ajouter, objets, objets.slice(), sitePJ.x, sitePJ.z);
        marqueurs.push({ nom: 'Phare-Jetée du Lac Baïkal', type: 'phare', x: tx, y: eau + 15, z: tz });
      }
      const fpq = choisirPassage(c, secteur, .82, .012);
      if (fpq) {
        const limG = (lim.G[fpq.i] || 12) + 3.0, limD = (lim.D[fpq.i] || 12) + 3.0;
        const dec = (limD - limG) * .5, span = limG + limD + 3.6, rot = [0, -fpq.a, 0];
        const cx = fpq.x + fpq.r[0] * dec, cz = fpq.z + fpq.r[2] * dec, objets = [];
        for (const [sgn, limC] of [[-1, limG], [1, limD]]) {
          const px = fpq.x + fpq.r[0] * sgn * (limC + 1.0), pz = fpq.z + fpq.r[2] * sgn * (limC + 1.0);
          const py = Math.min(fpq.y, terrain.sol(px, pz)) - 1.0, h = (fpq.y + 12.2) - py;
          objets.push(solide(obj('cylinder', [px, py + h * .5, pz], [1.6, h, 1.6], [0, 0, 0], 10, [.38, .24, .13]), 'portique-bois'));
        }
        objets.push(obj('box', [cx, fpq.y + 12.2, cz], [2.2, 1.3, span + 3.2], rot, 10, [.36, .22, .12]));
        objets.push(obj('bitume-lieu-cone', [cx, fpq.y + 14.0, cz], [3.6, 2.6, span + 4.4], rot, 1, neige ? [.92, .94, .97] : [.18, .26, .22]));
        deposer(ajouter, objets, objets.slice(), cx, cz);
        marqueurs.push({ nom: 'Portique Sibérien en Rondins', type: 'portique', x: cx, y: fpq.y + 15, z: cz });
      }
      return { marqueurs };
    }

    return { marqueurs };
  }

  function ajouterVoilier(objets, x, z, eau, coque, voile) {
    objets.push(obj('bitume-lieu-galet-a', [x, eau + .6, z], [8.5, 1.8, 3.0], [0, coque, 0], 16, [.92, .91, .88]));
    objets.push(obj('cylinder', [x, eau + 6.4, z], [.22, 11, .22], [0, 0, 0], 0, [.72, .74, .76]));
    objets.push(obj('bitume-lieu-voile', [x, eau + 6.8, z], [1.4, 9.5, 5.6], [0, voile, 0], 16, [.97, .96, .93]));
  }

  B.lieux = { FORMES, poserArcheRoute, rocherPour, pyramidePour, poser, ajouterVoilier };
})(globalThis.BITUME = globalThis.BITUME || {});
