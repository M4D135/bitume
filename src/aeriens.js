'use strict';

(function () {
  const B = (globalThis.BITUME = globalThis.BITUME || {});

  // ─── Utilitaires géométriques ────────────────────────────────────────────
  const PI = Math.PI, TAU = PI * 2, cos = Math.cos, sin = Math.sin, sqrt = Math.sqrt;

  function norm3(x, y, z) {
    const l = sqrt(x * x + y * y + z * z) || 1;
    return [x / l, y / l, z / l];
  }

  function superElliptic(t, a, b, n) {
    // t ∈ [0, TAU), section super-elliptique
    const ct = cos(t), st = sin(t);
    const sgn = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
    return [a * sgn(ct, 2 / n), b * sgn(st, 2 / n)];
  }

  // ─── Génération des géométries ───────────────────────────────────────────
  const FORMES = {};

  function pushVert(arr, x, y, z, nx, ny, nz) {
    arr.push(x, y, z, nx, ny, nz);
  }

  // Fuselage hélicoptère : goutte d'eau effilée vers la queue
  function genFuselage() {
    const verts = [], idx = [];
    const N = 24, M = 16; // sections longitudinales × circonférence
    const L = 3.4, W = 1.25, H = 1.15;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = (t - 0.35) * L; // nez à -1.19, queue à +2.21
      // profil super-elliptique qui s'effile vers la queue
      const taper = t < 0.6 ? 1.0 : 1.0 - 0.85 * ((t - 0.6) / 0.4);
      const noseRound = t < 0.15 ? Math.sqrt(t / 0.15) : 1.0;
      const rw = (W / 2) * taper * noseRound;
      const rh = (H / 2) * taper * noseRound;
      // prise turbine dorsale (renflement à t≈0.5)
      const dorsal = (t > 0.35 && t < 0.65) ? 0.12 * sin(PI * (t - 0.35) / 0.3) : 0;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const [sy, sz] = superElliptic(a, rw, rh + dorsal, 2.6);
        const nx = cos(a) / (rw || 1);
        const ny = sin(a) / (rh + dorsal || 1);
        const n = norm3(0.15, ny, -nx * 0.3); // normale légèrement vers l'avant
        pushVert(verts, x, sy, sz, n[0], n[1], n[2]);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // bouchon nez
    const noseIdx = verts.length / 6;
    pushVert(verts, -1.19, 0, 0, -1, 0, 0);
    for (let j = 0; j < M; j++) idx.push(noseIdx, j, j + 1);
    // bouchon queue
    const tailIdx = verts.length / 6;
    pushVert(verts, 2.21, 0, 0, 1, 0, 0);
    const tailStart = N * (M + 1);
    for (let j = 0; j < M; j++) idx.push(tailIdx, tailStart + j + 1, tailStart + j);
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // Verrière panoramique
  function genVerriere() {
    const verts = [], idx = [];
    const N = 12, M = 10;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = -1.19 + t * 0.9;
      const r = 0.52 * sin(PI * t * 0.85);
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * PI; // demi-sphère (dessus)
        const y = r * sin(a) * 0.9;
        const z = r * cos(a) * 0.55;
        const n = norm3(-0.3, sin(a), cos(a) * 0.5);
        pushVert(verts, x, y, z, n[0], n[1], n[2]);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // Poutre de queue + dérive + stabilisateur
  function genQueue() {
    const verts = [], idx = [];
    // Poutre tubulaire conique
    const N = 14, M = 8;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = 2.21 + t * 1.6;
      const r = 0.14 * (1 - t * 0.6);
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const y = r * cos(a), z = r * sin(a);
        const n = norm3(0, cos(a), sin(a));
        pushVert(verts, x, y, z, n[0], n[1], n[2]);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // Dérive verticale asymétrique
    const finBase = verts.length / 6;
    const finPts = [
      [3.4, 0.1, 0], [3.8, 0.1, 0], [3.95, 0.1, 0.7], [3.5, 0.1, 0.55]
    ];
    const finPts2 = [
      [3.4, -0.1, 0], [3.8, -0.1, 0], [3.95, -0.1, 0.7], [3.5, -0.1, 0.55]
    ];
    for (const p of finPts) pushVert(verts, p[0], p[1], p[2], 0, 1, 0);
    for (const p of finPts2) pushVert(verts, p[0], p[1], p[2], 0, -1, 0);
    idx.push(finBase, finBase + 1, finBase + 2, finBase, finBase + 2, finBase + 3);
    idx.push(finBase + 4, finBase + 6, finBase + 5, finBase + 4, finBase + 7, finBase + 6);
    // Stabilisateur horizontal
    const stabBase = verts.length / 6;
    const stabPts = [
      [3.5, 0, -0.4], [3.85, 0, -0.4], [3.9, 0, 0.4], [3.55, 0, 0.4]
    ];
    for (const p of stabPts) pushVert(verts, p[0], p[1], p[2], 0, 1, 0);
    idx.push(stabBase, stabBase + 1, stabBase + 2, stabBase, stabBase + 2, stabBase + 3);
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // Patins d'atterrissage
  function genPatins() {
    const verts = [], idx = [];
    const tubeR = 0.035, N = 10, M = 6;
    function tube(x1, y1, z1, x2, y2, z2) {
      const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
      const len = sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const ux = dx / len, uy = dy / len, uz = dz / len;
      // vecteurs perpendiculaires
      let px = -uz, py = 0, pz = ux;
      const pl = sqrt(px * px + py * py + pz * pz) || 1;
      px /= pl; py /= pl; pz /= pl;
      const qx = uy * pz - uz * py, qy = uz * px - ux * pz, qz = ux * py - uy * px;
      const base = verts.length / 6;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const cx = x1 + dx * t, cy = y1 + dy * t, cz = z1 + dz * t;
        for (let j = 0; j <= M; j++) {
          const a = (j / M) * TAU;
          const nx = px * cos(a) + qx * sin(a);
          const ny = py * cos(a) + qy * sin(a);
          const nz = pz * cos(a) + qz * sin(a);
          pushVert(verts, cx + nx * tubeR, cy + ny * tubeR, cz + nz * tubeR, nx, ny, nz);
        }
      }
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < M; j++) {
          const a = base + i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    // Patin gauche
    tube(-0.6, -0.65, -0.55, 1.0, -0.65, -0.55);
    // Patin droit
    tube(-0.6, -0.65, 0.55, 1.0, -0.65, 0.55);
    // Arceaux transversaux
    tube(-0.3, -0.65, -0.55, -0.3, -0.65, 0.55);
    tube(0.6, -0.65, -0.55, 0.6, -0.65, 0.55);
    // Montants verticaux
    tube(-0.3, -0.65, -0.55, -0.1, -0.15, -0.4);
    tube(-0.3, -0.65, 0.55, -0.1, -0.15, 0.4);
    tube(0.6, -0.65, -0.55, 0.7, -0.15, -0.4);
    tube(0.6, -0.65, 0.55, 0.7, -0.15, 0.4);
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // Nacelle caméra gyro-stabilisée
  function genNacelle() {
    const verts = [], idx = [];
    const N = 12, M = 10;
    const cx = -1.35, cy = -0.35, cz = 0, r = 0.18;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const phi = t * PI;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const nx = sin(phi) * cos(a), ny = cos(phi), nz = sin(phi) * sin(a);
        pushVert(verts, cx + r * nx, cy + r * ny, cz + r * nz, nx, ny, nz);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // Lentille (petit cylindre frontal)
    const lensBase = verts.length / 6;
    const lr = 0.09, lN = 8, lM = 8;
    for (let i = 0; i <= lN; i++) {
      const t = i / lN;
      const x = cx - r - t * 0.06;
      for (let j = 0; j <= lM; j++) {
        const a = (j / lM) * TAU;
        const ny = lr * cos(a), nz = lr * sin(a);
        pushVert(verts, x, cy + ny, cz + nz, -1, 0, 0);
      }
    }
    for (let i = 0; i < lN; i++) {
      for (let j = 0; j < lM; j++) {
        const a = lensBase + i * (lM + 1) + j, b = a + 1, c = a + (lM + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // Rotor principal (moyeu + 4 pales)
  function genRotor() {
    const verts = [], idx = [];
    // Moyeu
    const N = 10, M = 8, mr = 0.12, mh = 0.08;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = (t - 0.5) * mh * 2;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const nx = cos(a), nz = sin(a);
        pushVert(verts, mr * nx, y, mr * nz, nx, 0, nz);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // 4 pales
    for (let p = 0; p < 4; p++) {
      const angle = (p / 4) * TAU;
      const ca = cos(angle), sa = sin(angle);
      const bladeLen = 4.2, bladeW = 0.18, bladeT = 0.02;
      const bBase = verts.length / 6;
      const segs = 12;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const r = mr + t * bladeLen;
        const w = bladeW * (1 - t * 0.4);
        // profil symétrique simplifié
        for (let s = 0; s < 2; s++) {
          const side = s === 0 ? 1 : -1;
          const localY = side * bladeT * (1 - t * 0.7);
          const localZ = side * w * (1 - t * 0.3);
          const wx = r * ca - localZ * sa;
          const wz = r * sa + localZ * ca;
          pushVert(verts, wx, localY, wz, 0, side, 0);
        }
      }
      for (let i = 0; i < segs; i++) {
        const a = bBase + i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // Rotor anticouple (queue)
  function genAnticouple() {
    const verts = [], idx = [];
    const N = 8, M = 6, mr = 0.06, mh = 0.05;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = (t - 0.5) * mh * 2;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const ny = cos(a), nz = sin(a);
        pushVert(verts, x, mr * ny, mr * nz, 1, 0, 0);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // 4 pales verticales
    for (let p = 0; p < 4; p++) {
      const angle = (p / 4) * TAU;
      const ca = cos(angle), sa = sin(angle);
      const bLen = 0.55, bW = 0.07, bT = 0.012;
      const bBase = verts.length / 6;
      const segs = 8;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const r = mr + t * bLen;
        const w = bW * (1 - t * 0.5);
        for (let s = 0; s < 2; s++) {
          const side = s === 0 ? 1 : -1;
          const localX = side * bT;
          const localZ = side * w * (1 - t * 0.3);
          const wy = r * ca - localZ * sa;
          const wz = r * sa + localZ * ca;
          pushVert(verts, localX, wy, wz, side, 0, 0);
        }
      }
      for (let i = 0; i < segs; i++) {
        const a = bBase + i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // Châssis drone quadricoptère
  function genChassisDrone() {
    const verts = [], idx = [];
    const armLen = 0.475, armW = 0.04, armT = 0.025;
    const bodyR = 0.14, bodyH = 0.07;
    // Corps central facetté (octogone extrudé)
    const N = 8, M = 2;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const r = bodyR * (1 + 0.08 * cos(4 * a)); // facetté
      for (let j = 0; j <= M; j++) {
        const t = j / M;
        const y = (t - 0.5) * bodyH * 2;
        const nx = cos(a), nz = sin(a);
        pushVert(verts, r * nx, y, r * nz, nx, 0, nz);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // 4 bras en X
    for (let p = 0; p < 4; p++) {
      const angle = (p / 4) * TAU + PI / 4;
      const ca = cos(angle), sa = sin(angle);
      const bBase = verts.length / 6;
      const segs = 6;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const r = bodyR * 0.8 + t * (armLen - bodyR * 0.8);
        const w = armW * (1 - t * 0.3);
        for (let s = 0; s < 4; s++) {
          const sx = (s === 0 || s === 3) ? -1 : 1;
          const sy = (s < 2) ? 1 : -1;
          const lx = sx * w, ly = sy * armT;
          const wx = r * ca - lx * sa;
          const wz = r * sa + lx * ca;
          pushVert(verts, wx, ly, wz, sx * ca - sy * 0, sy, sx * sa);
        }
      }
      for (let i = 0; i < segs; i++) {
        for (let s = 0; s < 4; s++) {
          const a = bBase + i * 4 + s, b = bBase + i * 4 + ((s + 1) % 4);
          const c = bBase + (i + 1) * 4 + s, d = bBase + (i + 1) * 4 + ((s + 1) % 4);
          idx.push(a, c, b, b, c, d);
        }
      }
      // Carénage moteur (petit cylindre au bout)
      const mBase = verts.length / 6;
      const mR = 0.055, mH = 0.04, mN = 8;
      const mx = armLen * ca, mz = armLen * sa;
      for (let i = 0; i <= mN; i++) {
        const t = i / mN;
        const y = (t - 0.5) * mH * 2;
        for (let j = 0; j <= mN; j++) {
          const a = (j / mN) * TAU;
          pushVert(verts, mx + mR * cos(a), y, mz + mR * sin(a), cos(a), 0, sin(a));
        }
      }
      for (let i = 0; i < mN; i++) {
        for (let j = 0; j < mN; j++) {
          const a = mBase + i * (mN + 1) + j, b = a + 1, c = a + (mN + 1), d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    // Nacelle caméra suspendue
    const camBase = verts.length / 6;
    const cN = 8, cM = 8, cR = 0.045;
    for (let i = 0; i <= cN; i++) {
      const phi = (i / cN) * PI;
      for (let j = 0; j <= cM; j++) {
        const a = (j / cM) * TAU;
        const nx = sin(phi) * cos(a), ny = cos(phi), nz = sin(phi) * sin(a);
        pushVert(verts, cR * nx, -bodyH - 0.06 + cR * ny, cR * nz, nx, ny, nz);
      }
    }
    for (let i = 0; i < cN; i++) {
      for (let j = 0; j < cM; j++) {
        const a = camBase + i * (cM + 1) + j, b = a + 1, c = a + (cM + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // Hélice bipale drone
  function genHelice() {
    const verts = [], idx = [];
    const hubR = 0.025, hubH = 0.015;
    const N = 6, M = 6;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = (t - 0.5) * hubH * 2;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        pushVert(verts, hubR * cos(a), y, hubR * sin(a), cos(a), 0, sin(a));
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // 2 pales
    for (let p = 0; p < 2; p++) {
      const angle = p * PI;
      const ca = cos(angle), sa = sin(angle);
      const bLen = 0.38, bW = 0.055, bT = 0.008;
      const bBase = verts.length / 6;
      const segs = 10;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const r = hubR + t * bLen;
        const w = bW * (1 - t * 0.5);
        for (let s = 0; s < 2; s++) {
          const side = s === 0 ? 1 : -1;
          const localY = side * bT * (1 - t * 0.6);
          const localZ = side * w * (1 - t * 0.4);
          const wx = r * ca - localZ * sa;
          const wz = r * sa + localZ * ca;
          pushVert(verts, wx, localY, wz, 0, side, 0);
        }
      }
      for (let i = 0; i < segs; i++) {
        const a = bBase + i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // Sphère LED (feux navigation)
  function genLed() {
    const verts = [], idx = [];
    const N = 8, M = 8, r = 0.025;
    for (let i = 0; i <= N; i++) {
      const phi = (i / N) * PI;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const nx = sin(phi) * cos(a), ny = cos(phi), nz = sin(phi) * sin(a);
        pushVert(verts, r * nx, r * ny, r * nz, nx, ny, nz);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    return { sommets: new Float32Array(verts), indices: new Uint16Array(idx) };
  }

  // ─── Enregistrement des formes ───────────────────────────────────────────
  const SHAPE_DEFS = {
    'bitume-aerien-helico-fuselage': genFuselage,
    'bitume-aerien-helico-verriere': genVerriere,
    'bitume-aerien-helico-queue': genQueue,
    'bitume-aerien-helico-patins': genPatins,
    'bitume-aerien-helico-nacelle': genNacelle,
    'bitume-aerien-helico-rotor': genRotor,
    'bitume-aerien-helico-anticouple': genAnticouple,
    'bitume-aerien-drone-chassis': genChassisDrone,
    'bitume-aerien-drone-helice': genHelice,
    'bitume-aerien-led': genLed
  };

  function versTriangles(geo) {
    const s = geo.sommets, idx = geo.indices, tris = [];
    for (let k = 0; k < idx.length; k += 3) {
      const i0 = idx[k] * 6, i1 = idx[k + 1] * 6, i2 = idx[k + 2] * 6;
      tris.push([
        [s[i0], s[i0 + 1], s[i0 + 2]],
        [s[i1], s[i1 + 1], s[i1 + 2]],
        [s[i2], s[i2 + 1], s[i2 + 2]],
        [s[i0 + 3], s[i0 + 4], s[i0 + 5]],
        [s[i1 + 3], s[i1 + 4], s[i1 + 5]],
        [s[i2 + 3], s[i2 + 4], s[i2 + 5]]
      ]);
    }
    return tris;
  }

  for (const [nom, gen] of Object.entries(SHAPE_DEFS)) {
    const geo = gen();
    geo.tris = versTriangles(geo);
    FORMES[nom] = geo;
    const R = (globalThis.window && globalThis.window.FRender) || globalThis.FRender;
    if (R && typeof R.forme === 'function') {
      try { R.forme(nom, geo.tris); } catch (_) { /* Node / pas de GL */ }
    }
  }

  // ─── Angles depuis base (convention Rz·Ry·Rx) ────────────────────────────
  function anglesDepuisBase(t, u) {
    // t = temps, u = paramètre de progression sur la trajectoire
    // Retourne [rx, ry, rz] pour Rz·Ry·Rx
    const bank = 0.35 * sin(t * 0.7 + u * 2.1);
    const pitch = 0.12 * sin(t * 1.3 + u * 0.8);
    const yaw = 0.2 * sin(t * 0.4 + u * 1.5);
    return [pitch, yaw, bank];
  }

  // ─── Module B.aeriens ────────────────────────────────────────────────────
  const ROTOR_SPEED = 24;    // rad/s
  const TAIL_SPEED = 55;     // rad/s
  const HELICE_SPEED = 90;   // rad/s

  B.aeriens = {
    FORMES,

    creer(circuit, options = {}) {
      const etat = {
        actif: options.actif !== false,
        objets: [],
        _rotorAngle: 0,
        _tailAngle: 0,
        _heliceAngles: [0, 0, 0, 0, 0, 0, 0, 0],
        _t: 0
      };

      // ── Hélicoptère ──
      const helicoParts = [
        { shape: 'bitume-aerien-helico-fuselage', mat: 17, color: [0.82, 0.16, 0.12], emissive: 0 },
        { shape: 'bitume-aerien-helico-verriere', mat: 16, color: [0.06, 0.08, 0.12], emissive: 0 },
        { shape: 'bitume-aerien-helico-queue', mat: 17, color: [0.90, 0.88, 0.84], emissive: 0 },
        { shape: 'bitume-aerien-helico-patins', mat: 0, color: [0.16, 0.17, 0.19], emissive: 0 },
        { shape: 'bitume-aerien-helico-nacelle', mat: 0, color: [0.14, 0.15, 0.17], emissive: 0 },
        { shape: 'bitume-aerien-helico-rotor', mat: 0, color: [0.18, 0.19, 0.21], emissive: 0, _rotor: true },
        { shape: 'bitume-aerien-helico-anticouple', mat: 0, color: [0.18, 0.19, 0.21], emissive: 0, _tail: true }
      ];

      for (const part of helicoParts) {
        etat.objets.push({
          shape: part.shape,
          p: [0, 0, 0],
          s: [1, 1, 1],
          r: [0, 0, 0],
          mat: part.mat,
          color: part.color,
          emissive: part.emissive,
          _rotor: part._rotor || false,
          _tail: part._tail || false,
          _helice: false,
          _heliceIdx: -1,
          _isHelico: true,
          _isDrone: false,
          _isLed: false
        });
      }

      // ── Drones (2 préalloués : 1 dessiné en medium, 2 en high/ultra) ──
      for (let d = 0; d < 2; d++) {
        // Châssis métal brossé
        etat.objets.push({
          shape: 'bitume-aerien-drone-chassis',
          p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0],
          mat: 0, color: [0.46, 0.48, 0.52], emissive: 0,
          _rotor: false, _tail: false, _helice: false, _heliceIdx: -1,
          _isHelico: false, _isDrone: true, _droneIdx: d, _isLed: false
        });
        // 4 hélices
        for (let h = 0; h < 4; h++) {
          etat.objets.push({
            shape: 'bitume-aerien-drone-helice',
            p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0],
            mat: 0, color: [0.22, 0.23, 0.26], emissive: 0,
            _rotor: false, _tail: false, _helice: true,
            _heliceIdx: d * 4 + h,
            _isHelico: false, _isDrone: true, _droneIdx: d, _isLed: false
          });
        }
        // LED verte (droite)
        etat.objets.push({
          shape: 'bitume-aerien-led',
          p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0],
          mat: 16, color: [0.1, 0.95, 0.25], emissive: 2.2,
          _rotor: false, _tail: false, _helice: false, _heliceIdx: -1,
          _isHelico: false, _isDrone: true, _droneIdx: d, _isLed: true, _ledSide: 'right'
        });
        // LED rouge (gauche)
        etat.objets.push({
          shape: 'bitume-aerien-led',
          p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0],
          mat: 16, color: [0.95, 0.15, 0.1], emissive: 2.2,
          _rotor: false, _tail: false, _helice: false, _heliceIdx: -1,
          _isHelico: false, _isDrone: true, _droneIdx: d, _isLed: true, _ledSide: 'left'
        });
      }

      return etat;
    },

    dessiner(etat, t, contexte, sortie) {
      if (!etat || !etat.actif) return;
      const qualite = contexte.qualite || 'medium';
      if (qualite === 'low') return;

      const cible = contexte.cible || [0, 0, 0];
      const cibleCap = contexte.cibleCap || 0;
      const cibleVitesse = contexte.cibleVitesse || 0;
      const sCible = contexte.sCible || 1;
      const nuit = contexte.nuit || false;
      const sol = contexte.sol || (() => 0);

      etat._t = t;

      // ── Trajectoire hélicoptère : orbite fluide ──
      const helicoRadius = 55 + 30 * sin(t * 0.13);
      const helicoAngle = t * 0.22;
      const hx = cible[0] + helicoRadius * cos(helicoAngle);
      const hz = cible[2] + helicoRadius * sin(helicoAngle);
      const solH = sol(hx, hz);
      const hy = Math.max(cible[1] + 34, solH + 28);

      // Tangage/roulis en virage
      const bankH = 0.3 * cos(helicoAngle + PI / 2);
      const pitchH = -0.08 * (cibleVitesse / 80);
      const yawH = helicoAngle + PI / 2;

      // Mise à jour des parties hélicoptère
      for (const obj of etat.objets) {
        if (!obj._isHelico) continue;

        obj.p[0] = hx;
        obj.p[1] = hy;
        obj.p[2] = hz;
        obj.r[0] = pitchH;
        obj.r[1] = yawH;
        obj.r[2] = bankH;

        // Rotor principal
        if (obj._rotor) {
          etat._rotorAngle = (t * ROTOR_SPEED) % TAU;
          obj.r[1] = yawH + etat._rotorAngle;
        }
        // Anticouple
        if (obj._tail) {
          etat._tailAngle = (t * TAIL_SPEED) % TAU;
          obj.r[1] = yawH + etat._tailAngle;
        }

        // Projecteur TV la nuit
        if (obj.shape === 'bitume-aerien-helico-nacelle') {
          obj.emissive = nuit > 0.2 ? 1.8 * nuit : 0;
        }

        sortie.push(obj);
      }

      // ── Trajectoires drones ──
      const nbDrones = (qualite === 'high' || qualite === 'ultra') ? 2 : 1;
      for (let d = 0; d < nbDrones; d++) {
        const phase = d * PI;
        const droneRadius = 12 + 12 * sin(t * 0.31 + phase);
        const droneAngle = t * 0.45 + phase;
        const dx = cible[0] + droneRadius * cos(droneAngle) + (d === 0 ? 18 : -18) * sin(cibleCap);
        const dz = cible[2] + droneRadius * sin(droneAngle) + (d === 0 ? 18 : -18) * cos(cibleCap);
        const solD = sol(dx, dz);
        let dy = Math.max(cible[1] + 15, solD + 12);

        // Éviter les couverts
        if (B.couverts && typeof B.couverts.abri === 'function') {
          const abri = B.couverts.abri(dx, dz);
          if (abri && abri.hauteur && dy < abri.hauteur + 3) {
            dy = abri.hauteur + 4;
          }
        }

        const bankD = 0.4 * sin(t * 0.9 + phase);
        const pitchD = -0.1 * (cibleVitesse / 100);
        const yawD = droneAngle + PI / 2;

        // Châssis
        let chassisObj = null;
        for (const obj of etat.objets) {
          if (obj._isDrone && obj._droneIdx === d && !obj._helice && !obj._isLed) {
            chassisObj = obj;
            obj.p[0] = dx; obj.p[1] = dy; obj.p[2] = dz;
            obj.r[0] = pitchD; obj.r[1] = yawD; obj.r[2] = bankD;
            sortie.push(obj);
            break;
          }
        }

        // Hélices (4 par drone)
        for (const obj of etat.objets) {
          if (obj._isDrone && obj._droneIdx === d && obj._helice) {
            const hi = obj._heliceIdx - d * 4;
            const armAngle = (hi / 4) * TAU + PI / 4;
            const armR = 0.475;
            obj.p[0] = dx + armR * cos(armAngle + yawD);
            obj.p[1] = dy + 0.04;
            obj.p[2] = dz + armR * sin(armAngle + yawD);
            etat._heliceAngles[obj._heliceIdx] = (t * HELICE_SPEED * (hi % 2 === 0 ? 1 : -1)) % TAU;
            obj.r[0] = pitchD;
            obj.r[1] = yawD + etat._heliceAngles[obj._heliceIdx];
            obj.r[2] = bankD;
            sortie.push(obj);
          }
        }

        // LEDs
        for (const obj of etat.objets) {
          if (obj._isDrone && obj._droneIdx === d && obj._isLed) {
            const side = obj._ledSide === 'right' ? 1 : -1;
            obj.p[0] = dx + side * 0.42 * cos(yawD + PI / 2);
            obj.p[1] = dy - 0.02;
            obj.p[2] = dz + side * 0.42 * sin(yawD + PI / 2);
            obj.r[0] = pitchD; obj.r[1] = yawD; obj.r[2] = bankD;
            sortie.push(obj);
          }
        }
      }
    }
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.aeriens;
