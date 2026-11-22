/* BITUME — Hélicoptère TV réaliste (Airbus H135 / Bell 429) volant bas + 2 drones métal de tournage.
   Formes 3D procédurales via FRender.forme, 0 allocation en course, actif sur toutes les qualités. */
(function (B) {
  'use strict';

  const FORMES = {};
  const PI = Math.PI, PI2 = PI * 2;
  let formesEnregistrees = false;

  function tri(p0, p1, p2) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    return [p0.slice(), p1.slice(), p2.slice(), [nx, ny, nz], [nx, ny, nz], [nx, ny, nz]];
  }
  function quad(p0, p1, p2, p3) { return [tri(p0, p1, p2), tri(p0, p2, p3)]; }
  function box(cx, cy, cz, sx, sy, sz) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const v = [
      [cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz], [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz],
      [cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz]
    ];
    return [
      ...quad(v[4], v[5], v[6], v[7]), ...quad(v[1], v[0], v[3], v[2]),
      ...quad(v[5], v[1], v[2], v[6]), ...quad(v[0], v[4], v[7], v[3]),
      ...quad(v[3], v[7], v[6], v[2]), ...quad(v[0], v[1], v[5], v[4])
    ];
  }
  function cylX(x0, x1, r0, r1, seg, cy, cz) {
    const out = [];
    for (let i = 0; i < seg; i++) {
      const a0 = PI2 * i / seg, a1 = PI2 * (i + 1) / seg;
      const p00 = [x0, cy + r0 * Math.cos(a0), cz + r0 * Math.sin(a0)];
      const p01 = [x0, cy + r0 * Math.cos(a1), cz + r0 * Math.sin(a1)];
      const p10 = [x1, cy + r1 * Math.cos(a0), cz + r1 * Math.sin(a0)];
      const p11 = [x1, cy + r1 * Math.cos(a1), cz + r1 * Math.sin(a1)];
      out.push(tri(p00, p11, p10), tri(p00, p01, p11));
    }
    return out;
  }
  function cylY(y0, y1, r0, r1, seg, cx, cz) {
    const out = [];
    for (let i = 0; i < seg; i++) {
      const a0 = PI2 * i / seg, a1 = PI2 * (i + 1) / seg;
      const p00 = [cx + r0 * Math.cos(a0), y0, cz + r0 * Math.sin(a0)];
      const p01 = [cx + r0 * Math.cos(a1), y0, cz + r0 * Math.sin(a1)];
      const p10 = [cx + r1 * Math.cos(a0), y1, cz + r1 * Math.sin(a0)];
      const p11 = [cx + r1 * Math.cos(a1), y1, cz + r1 * Math.sin(a1)];
      out.push(tri(p00, p10, p11), tri(p00, p11, p01));
    }
    return out;
  }
  function cylZ(z0, z1, r0, r1, seg, cx, cy) {
    const out = [];
    for (let i = 0; i < seg; i++) {
      const a0 = PI2 * i / seg, a1 = PI2 * (i + 1) / seg;
      const p00 = [cx + r0 * Math.cos(a0), cy + r0 * Math.sin(a0), z0];
      const p01 = [cx + r0 * Math.cos(a1), cy + r0 * Math.sin(a1), z0];
      const p10 = [cx + r1 * Math.cos(a0), cy + r1 * Math.sin(a0), z1];
      const p11 = [cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1), z1];
      out.push(tri(p00, p10, p11), tri(p00, p11, p01));
    }
    return out;
  }

  function buildFuselage() {
    const out = [], seg = 10;
    const prof = [
      [-1.35, 0.22, 0.24], [-0.95, 0.42, 0.44], [-0.40, 0.64, 0.58],
      [0.15, 0.72, 0.62], [0.75, 0.70, 0.58], [1.30, 0.56, 0.46],
      [1.72, 0.36, 0.30], [1.95, 0.16, 0.14]
    ];
    const sections = prof.map(([px, hw, hh]) =>
      Array.from({ length: seg }, (_, i) => {
        const a = PI2 * i / seg;
        return [px, hh * Math.sin(a), hw * Math.cos(a)];
      })
    );
    for (let j = 0; j < sections.length - 1; j++) {
      for (let i = 0; i < seg; i++) {
        const i2 = (i + 1) % seg;
        out.push(tri(sections[j][i], sections[j + 1][i], sections[j + 1][i2]));
        out.push(tri(sections[j][i], sections[j + 1][i2], sections[j][i2]));
      }
    }
    const front = sections[sections.length - 1], fc = [2.02, -0.04, 0];
    const rear = sections[0], rc = [-1.42, 0.04, 0];
    for (let i = 0; i < seg; i++) {
      const i2 = (i + 1) % seg;
      out.push(tri(fc, front[i], front[i2]), tri(rc, rear[i2], rear[i]));
    }
    // Capot biturbine supérieur profilé (carénage aérodynamique affiné vers l'avant et l'arrière) + mât rotor
    const capotProf = [
      [-1.18, 0.24, 0.16, 0.44], [-0.72, 0.38, 0.22, 0.64], [0.05, 0.40, 0.24, 0.72],
      [0.62, 0.34, 0.20, 0.66], [0.98, 0.18, 0.10, 0.50]
    ];
    const cSeg = 8;
    const cSec = capotProf.map(([px, hw, hh, cy]) =>
      Array.from({ length: cSeg }, (_, i) => {
        const a = PI2 * i / cSeg;
        return [px, cy + hh * Math.sin(a), hw * Math.cos(a)];
      })
    );
    for (let j = 0; j < cSec.length - 1; j++) {
      for (let i = 0; i < cSeg; i++) {
        const i2 = (i + 1) % cSeg;
        out.push(tri(cSec[j][i], cSec[j + 1][i], cSec[j + 1][i2]), tri(cSec[j][i], cSec[j + 1][i2], cSec[j][i2]));
      }
    }
    for (let i = 0; i < cSeg; i++) {
      const i2 = (i + 1) % cSeg;
      out.push(tri([1.06, 0.48, 0], cSec[cSec.length - 1][i], cSec[cSec.length - 1][i2]));
      out.push(tri([-1.24, 0.42, 0], cSec[0][i2], cSec[0][i]));
    }
    out.push(...cylY(0.78, 1.24, 0.10, 0.075, 8, 0.15, 0));
    return out;
  }

  function buildCanopy() {
    const out = [], seg = 10;
    const prof = [
      [0.45, 0.66, 0.54], [0.85, 0.74, 0.58], [1.25, 0.68, 0.54],
      [1.62, 0.52, 0.42], [1.90, 0.30, 0.24], [2.08, 0.12, 0.10]
    ];
    const sections = prof.map(([px, hw, hh]) =>
      Array.from({ length: seg }, (_, i) => {
        const a = -0.15 + (PI + 0.30) * (i / (seg - 1));
        return [px, hh * Math.sin(a) + 0.04, hw * Math.cos(a)];
      })
    );
    for (let j = 0; j < sections.length - 1; j++) {
      for (let i = 0; i < seg - 1; i++) {
        out.push(tri(sections[j][i], sections[j + 1][i], sections[j + 1][i + 1]));
        out.push(tri(sections[j][i], sections[j + 1][i + 1], sections[j][i + 1]));
      }
    }
    return out;
  }

  function sweptFin(x0b, x1b, yb, x0t, x1t, yt, hzB, hzT) {
    // Trapèze profilé 3D en flèche (faces gauche, droite, bord d'attaque, bord de fuite, sommet, base)
    const lb0 = [x0b, yb, hzB], lb1 = [x1b, yb, hzB], lt0 = [x0t, yt, hzT], lt1 = [x1t, yt, hzT];
    const rb0 = [x0b, yb, -hzB], rb1 = [x1b, yb, -hzB], rt0 = [x0t, yt, -hzT], rt1 = [x1t, yt, -hzT];
    return [
      ...quad(lb1, lb0, lt0, lt1),
      ...quad(rb0, rb1, rt1, rt0),
      ...quad(lb0, rb0, rt0, lt0),
      ...quad(rb1, lb1, lt1, rt1),
      ...quad(lt0, rt0, rt1, lt1),
      ...quad(rb0, lb0, lb1, rb1)
    ];
  }

  function buildTail() {
    const out = [];
    // Longue poutre de queue fine et effilée (distincte du fuselage)
    out.push(...cylX(-1.15, -5.75, 0.21, 0.082, 8, 0.14, 0));
    out.push(...box(-3.35, 0.25, 0, 3.60, 0.07, 0.14));
    // Empennage horizontal large + winglets
    out.push(...box(-4.62, 0.16, 0, 0.56, 0.042, 2.28));
    out.push(...box(-4.68, 0.24, 1.13, 0.46, 0.30, 0.036));
    out.push(...box(-4.68, 0.24, -1.13, 0.46, 0.30, 0.036));
    // Haute dérive verticale profilée en flèche (style Bell 429 / Airbus H135) + quille ventrale
    out.push(...sweptFin(-5.02, -5.78, 0.10, -5.58, -6.12, 1.44, 0.065, 0.032));
    out.push(...sweptFin(-5.08, -5.58, 0.10, -5.36, -5.72, -0.46, 0.055, 0.028));
    return out;
  }

  function buildSkids() {
    const out = [];
    for (const sz of [0.92, -0.92]) {
      out.push(...cylX(-1.45, 1.65, 0.048, 0.048, 6, -1.04, sz));
      out.push(...cylX(1.65, 2.02, 0.045, 0.036, 6, -0.96, sz));
      for (const lx of [-0.75, 0.72]) {
        out.push(...cylY(-1.04, -0.36, 0.038, 0.038, 6, lx, sz * 0.82));
      }
    }
    // Traverses reliant les deux patins sous le ventre
    out.push(...cylZ(-0.92, 0.92, 0.036, 0.036, 6, -0.75, -0.58));
    out.push(...cylZ(-0.92, 0.92, 0.036, 0.036, 6, 0.72, -0.58));
    return out;
  }

  function buildNacelle() {
    const out = [];
    // Boule caméra gyro-stabilisée Wescam sous le nez
    out.push(...box(1.72, -0.38, 0, 0.28, 0.14, 0.14));
    out.push(...cylY(-0.76, -0.44, 0.18, 0.22, 8, 1.88, 0));
    out.push(...cylX(1.88, 2.16, 0.13, 0.11, 8, -0.60, 0));
    return out;
  }

  function buildRotor() {
    const out = [];
    const hubR = 0.26, bladeLen = 3.25, bladeW = 0.17, bladeT = 0.03;
    out.push(...cylY(-0.07, 0.09, hubR, hubR * 0.82, 10, 0, 0));
    for (let b = 0; b < 4; b++) {
      const ang = PI2 * b / 4, ca = Math.cos(ang), sa = Math.sin(ang);
      const toW = (lx, ly, lz) => [lx * ca - lz * sa, ly, lx * sa + lz * ca];
      const segs = 4;
      for (let i = 0; i < segs; i++) {
        const t0 = hubR + (i / segs) * bladeLen, t1 = hubR + ((i + 1) / segs) * bladeLen;
        const w0 = bladeW * (1 - 0.22 * i / segs), w1 = bladeW * (1 - 0.22 * (i + 1) / segs);
        out.push(
          tri(toW(t0, bladeT / 2, -w0 / 2), toW(t1, bladeT / 2, -w1 / 2), toW(t1, bladeT / 2, w1 / 2)),
          tri(toW(t0, bladeT / 2, -w0 / 2), toW(t1, bladeT / 2, w1 / 2), toW(t0, bladeT / 2, w0 / 2)),
          tri(toW(t0, -bladeT / 2, w0 / 2), toW(t1, -bladeT / 2, w1 / 2), toW(t1, -bladeT / 2, -w1 / 2)),
          tri(toW(t0, -bladeT / 2, w0 / 2), toW(t1, -bladeT / 2, -w1 / 2), toW(t0, -bladeT / 2, -w0 / 2))
        );
      }
    }
    return out;
  }

  function buildTailRotor() {
    const out = [];
    // Construit dans le plan (Y, Z), moyeu selon X : r = [spin, yawH + PI/2, 0] tourne autour de l'axe latéral exact
    out.push(...cylX(-0.05, 0.05, 0.07, 0.07, 6, 0, 0));
    out.push(...box(0.02, 0, 0, 0.024, 1.24, 0.11));
    out.push(...box(0.02, 0, 0, 0.024, 0.11, 1.24));
    return out;
  }

  function buildDroneChassis() {
    const out = [];
    out.push(...box(0, 0, 0, 0.42, 0.11, 0.42));
    const armLen = 0.56;
    for (const [dx, dz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const ang = Math.atan2(dz, dx), ca = Math.cos(ang), sa = Math.sin(ang);
      const mx = dx * armLen * 0.5, mz = dz * armLen * 0.5;
      const hw = armLen * 0.56, hh = 0.022, hd = 0.028;
      const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([sx, sy, sz]) => {
        const lx = sx * hw, ly = sy * hh, lz = sz * hd;
        return [lx * ca - lz * sa + mx, ly, lx * sa + lz * ca + mz];
      });
      out.push(...quad(v[4], v[5], v[6], v[7]), ...quad(v[1], v[0], v[3], v[2]), ...quad(v[3], v[7], v[6], v[2]), ...quad(v[0], v[1], v[5], v[4]));
      out.push(...cylY(0.02, 0.11, 0.045, 0.04, 6, dx * armLen, dz * armLen));
    }
    out.push(...box(0.06, -0.12, 0, 0.14, 0.09, 0.12));
    return out;
  }

  function buildDroneProp() {
    return box(0, 0, 0, 0.46, 0.012, 0.048);
  }
  function buildDroneLED() {
    return box(0, 0, 0, 0.06, 0.04, 0.06);
  }

  function attitudeAngles(cap, pitch, roll, out) {
    const cy = Math.cos(-cap), sy = Math.sin(-cap);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const a00 = cy * cp, a01 = sp, a02 = -sy * cp;
    const a12 = sy * sp * cr + cy * sr;
    const a22 = -sy * sp * sr + cy * cr;
    if (Math.abs(a02) > 1 - 1e-12) {
      const a10 = -cy * sp * cr + sy * sr, a11 = cp * cr;
      out[0] = Math.atan2(-a02 * a10, a11);
      out[1] = -Math.asin(Math.max(-1, Math.min(1, a02)));
      out[2] = 0;
    } else {
      out[0] = Math.atan2(a12, a22);
      out[1] = -Math.asin(Math.max(-1, Math.min(1, a02)));
      out[2] = Math.atan2(a01, a00);
    }
    return out;
  }

  function preparerFormes() {
    if (!FORMES['bitume-aerien-helico-corps']) {
      FORMES['bitume-aerien-helico-corps'] = { tris: buildFuselage() };
      FORMES['bitume-aerien-helico-bulle'] = { tris: buildCanopy() };
      FORMES['bitume-aerien-helico-poutre'] = { tris: buildTail() };
      FORMES['bitume-aerien-helico-patins'] = { tris: buildSkids() };
      FORMES['bitume-aerien-helico-nacelle'] = { tris: buildNacelle() };
      FORMES['bitume-aerien-helico-rotor'] = { tris: buildRotor() };
      FORMES['bitume-aerien-helico-anticouple'] = { tris: buildTailRotor() };
      FORMES['bitume-aerien-drone-chassis'] = { tris: buildDroneChassis() };
      FORMES['bitume-aerien-drone-helice'] = { tris: buildDroneProp() };
      FORMES['bitume-aerien-drone-led'] = { tris: buildDroneLED() };
    }
    const R = (globalThis.window && globalThis.window.FRender) || globalThis.FRender;
    if (!formesEnregistrees && R && typeof R.forme === 'function') {
      for (const k in FORMES) {
        try { R.forme(k, FORMES[k].tris); } catch (_) { /* Node / pas de GL */ }
      }
      formesEnregistrees = true;
    }
  }

  function creer() {
    preparerFormes();
    const helico = {
      corps: { shape: 'bitume-aerien-helico-corps', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], mat: 1, color: [0.94, 0.95, 0.97], emissive: 0 },
      bulle: { shape: 'bitume-aerien-helico-bulle', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], mat: 18, color: [0.06, 0.11, 0.18], emissive: 0 },
      poutre: { shape: 'bitume-aerien-helico-poutre', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], mat: 1, color: [0.84, 0.10, 0.08], emissive: 0 },
      patins: { shape: 'bitume-aerien-helico-patins', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], mat: 0, color: [0.22, 0.24, 0.27], emissive: 0 },
      nacelle: { shape: 'bitume-aerien-helico-nacelle', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], mat: 0, color: [0.08, 0.09, 0.10], emissive: 0.25 },
      rotor: { shape: 'bitume-aerien-helico-rotor', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], mat: 0, color: [0.10, 0.11, 0.13], emissive: 0 },
      anticouple: { shape: 'bitume-aerien-helico-anticouple', p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0], mat: 0, color: [0.14, 0.15, 0.17], emissive: 0 },
      balise: { shape: 'bitume-aerien-drone-led', p: [0, 0, 0], s: [2.4, 2.4, 2.4], r: [0, 0, 0], mat: 16, color: [1.0, 0.08, 0.05], emissive: 1.4 }
    };
    const drones = [0, 1].map(() => ({
      chassis: { shape: 'bitume-aerien-drone-chassis', p: [0, 0, 0], s: [1.15, 1.15, 1.15], r: [0, 0, 0], mat: 0, color: [0.58, 0.62, 0.68], emissive: 0 },
      helices: [0, 1, 2, 3].map(() => ({ shape: 'bitume-aerien-drone-helice', p: [0, 0, 0], s: [1.15, 1.15, 1.15], r: [0, 0, 0], mat: 0, color: [0.12, 0.13, 0.15], emissive: 0 })),
      leds: [
        { shape: 'bitume-aerien-drone-led', p: [0, 0, 0], s: [1.2, 1.2, 1.2], r: [0, 0, 0], mat: 16, color: [1.0, 0.08, 0.05], emissive: 1.5 },
        { shape: 'bitume-aerien-drone-led', p: [0, 0, 0], s: [1.2, 1.2, 1.2], r: [0, 0, 0], mat: 16, color: [0.08, 0.98, 0.25], emissive: 1.5 }
      ]
    }));
    const objets = [helico.corps, helico.bulle, helico.poutre, helico.patins, helico.nacelle, helico.rotor, helico.anticouple, helico.balise];
    for (const d of drones) objets.push(d.chassis, ...d.helices, ...d.leds);
    return { actif: true, helico, drones, objets };
  }

  const PROP_OFF = [[0.64, 0.64], [-0.64, 0.64], [-0.64, -0.64], [0.64, -0.64]];
  const LED_OFF = [[0.64, 0.64], [-0.64, -0.64]];

  function dessiner(etat, t, contexte, sortie) {
    if (!etat || !etat.actif || !sortie) return;
    preparerFormes();
    const qualite = (contexte && contexte.qualite) || 'medium';
    const cible = (contexte && contexte.cible) || [0, 0, 0];
    const cibleCap = (contexte && contexte.cibleCap) || 0;
    const cibleVitesse = (contexte && contexte.cibleVitesse) || 0;
    const nuit = (contexte && contexte.nuit) || 0;
    const sol = (contexte && contexte.sol) || (() => 0);
    const cosC = Math.cos(cibleCap), sinC = Math.sin(cibleCap);

    // ── Hélicoptère TV réaliste volant BAS (10–14 m au-dessus de la piste, devant & côté) ──
    const aheadH = 30 + 14 * Math.sin(t * 0.24);
    const latH = 15 * Math.sin(t * 0.31);
    const hx = cible[0] + aheadH * cosC - latH * sinC;
    const hz = cible[2] + aheadH * sinC + latH * cosC;
    const solH = sol(hx, hz);
    let hy = Math.max(cible[1] + 11.2 + 2.2 * Math.sin(t * 0.41), solH + 9.2);
    if (B.couverts && typeof B.couverts.abri === 'function') {
      const abri = B.couverts.abri(hx, hz);
      if (abri && abri.hauteur && hy < abri.hauteur + 5) hy = abri.hauteur + 6;
    }

    const capH = cibleCap + 0.24 * Math.cos(t * 0.31);
    const yawH = -capH;
    const pitchH = -0.10 * Math.min(1, Math.max(0.25, cibleVitesse / 65));
    const rollH = 0.16 * Math.cos(t * 0.31);
    const cosH = Math.cos(capH), sinH = Math.sin(capH);
    const H = etat.helico;
    attitudeAngles(capH, pitchH, rollH, H.corps.r);

    for (const part of [H.corps, H.bulle, H.poutre, H.patins, H.nacelle]) {
      part.p[0] = hx; part.p[1] = hy; part.p[2] = hz;
      if (part !== H.corps) { part.r[0] = H.corps.r[0]; part.r[1] = H.corps.r[1]; part.r[2] = H.corps.r[2]; }
    }
    H.nacelle.emissive = nuit > 0.2 ? 1.8 * nuit : 0.2;
    // Rotor principal 4 pales au sommet du mât (+0.15 avant, +1.22 haut)
    H.rotor.p[0] = hx + 0.15 * cosH;
    H.rotor.p[1] = hy + 1.22;
    H.rotor.p[2] = hz + 0.15 * sinH;
    attitudeAngles(capH - (t * 22) % PI2, 0, 0, H.rotor.r);
    // Rotor anticouple au bout exact de la poutre de queue (-5.65 m derrière, +0.62 m haut, +0.16 m latéral)
    H.anticouple.p[0] = hx - 5.65 * cosH - 0.16 * sinH;
    H.anticouple.p[1] = hy + 0.62;
    H.anticouple.p[2] = hz - 5.65 * sinH + 0.16 * cosH;
    H.anticouple.r[0] = (t * 38) % PI2; H.anticouple.r[1] = yawH + PI * 0.5; H.anticouple.r[2] = 0;
    // Balise rouge clignotante au sommet de la dérive (-5.80 m, +1.42 m)
    H.balise.p[0] = hx - 5.80 * cosH;
    H.balise.p[1] = hy + 1.42;
    H.balise.p[2] = hz - 5.80 * sinH;
    H.balise.emissive = Math.sin(t * 6.5) > 0.2 ? 1.8 : 0.1;

    sortie.push(H.corps, H.bulle, H.poutre, H.patins, H.nacelle, H.rotor, H.anticouple, H.balise);

    // ── 2 Drones métal de tournage (1 en low, 2 en medium/high/ultra) ──
    const nbDrones = qualite === 'low' ? 1 : 2;
    for (let d = 0; d < nbDrones; d++) {
      const D = etat.drones[d], phase = d * PI;
      const dAhead = 18 + 10 * Math.sin(t * 0.35 + phase);
      const dLat = (d === 0 ? 1 : -1) * (9.5 + 5.5 * Math.sin(t * 0.44 + phase));
      const dx = cible[0] + dAhead * cosC - dLat * sinC;
      const dz = cible[2] + dAhead * sinC + dLat * cosC;
      const solD = sol(dx, dz);
      let dy = Math.max(cible[1] + 7.8 + 1.8 * Math.sin(t * 0.55 + phase), solD + 6.8);
      if (B.couverts && typeof B.couverts.abri === 'function') {
        const abri = B.couverts.abri(dx, dz);
        if (abri && abri.hauteur && dy < abri.hauteur + 3.5) dy = abri.hauteur + 4.5;
      }
      const capD = cibleCap + 0.22 * Math.cos(t * 0.44 + phase);
      const yawD = -capD;
      const rollD = 0.24 * Math.sin(t * 0.72 + phase);
      const pitchD = -0.14 * Math.min(1, Math.max(0.2, cibleVitesse / 75));
      const ca = Math.cos(capD), sa = Math.sin(capD);

      D.chassis.p[0] = dx; D.chassis.p[1] = dy; D.chassis.p[2] = dz;
      attitudeAngles(capD, pitchD, rollD, D.chassis.r);
      sortie.push(D.chassis);

      for (let p = 0; p < 4; p++) {
        const lx = PROP_OFF[p][0], lz = PROP_OFF[p][1];
        const pr = D.helices[p];
        pr.p[0] = dx + lx * ca - lz * sa;
        pr.p[1] = dy + 0.13;
        pr.p[2] = dz + lx * sa + lz * ca;
        pr.r[0] = 0; pr.r[1] = yawD + (p % 2 === 0 ? (t * 46) % PI2 : -(t * 46) % PI2); pr.r[2] = 0;
        sortie.push(pr);
      }
      for (let l = 0; l < 2; l++) {
        const lx = LED_OFF[l][0], lz = LED_OFF[l][1];
        const led = D.leds[l];
        led.p[0] = dx + lx * ca - lz * sa;
        led.p[1] = dy - 0.06;
        led.p[2] = dz + lx * sa + lz * ca;
        led.emissive = Math.sin(t * 8 + l * PI) > 0 ? 1.6 : 0.25;
        sortie.push(led);
      }
    }
  }

  preparerFormes();
  B.aeriens = { FORMES, creer, dessiner, preparerFormes };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.aeriens;
