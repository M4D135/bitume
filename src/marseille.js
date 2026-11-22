/* BITUME — Circuit réel Marseille · Vieux-Port → Corniche Kennedy → Statue de David.
   Polyligne côtière réelle issue d'OpenStreetMap (projet emprise), rééchantillonnée à 4 m.
   Zéro dépendance externe, zéro Math.random(). */
(function (B) {
  'use strict';
  if (typeof require === 'function' && !B.circuit) {
    try { require('./circuit.js'); } catch (_) {}
  }

  const PAS = 4;
  const LARGEUR = 12;
  const DEMI_L = LARGEUR / 2;
  const PI = Math.PI;
  const TWO_PI = PI * 2;

  const PROVENANCE = Object.freeze({
    source: 'Données routières © OpenStreetMap contributors (ODbL) — extrait Marseille Vieux-Port → Corniche Kennedy → Statue de David (emprise)',
    origine: { lat: 43.2962, lon: 5.3734 },
    format: 'polyligne côtière métrique locale (x Est, z Sud, y Haut)',
    mesuresReelles: true
  });

  // 74 sommets métriques réels [x, z] : Quai de Rive-Neuve → Pharo → Catalans →
  // Viaduc du Vallon des Auffes → Corniche Président John Fitzgerald Kennedy →
  // Promenade Georges Pompidou (Plages du Prado) → Rond-Point du David.
  const POINTS_BRUTS = [
    [-100, 355], [-260, 382], [-420, 405], [-550, 413], [-591.3, 422.6],
    [-649.6, 433.5], [-729.7, 441.3], [-782, 442.1], [-979.6, 438.9], [-1026.6, 440],
    [-1119.8, 453.9], [-1171.1, 463.4], [-1326.6, 484.7], [-1389.7, 491.6], [-1424.9, 524.6],
    [-1411.4, 665.5], [-1464.1, 725.4], [-1506.8, 762.3], [-1650.4, 871.2], [-1694, 898.9],
    [-1720.5, 974.4], [-1744.9, 1024], [-1798.9, 1105.9], [-1840.7, 1171.4], [-1865.3, 1209.3],
    [-1918.1, 1289.4], [-1874.2, 1433], [-1832.3, 1536], [-1794.1, 1630], [-1754.5, 1676.4],
    [-1716.2, 1711.1], [-1675.2, 1731.1], [-1634.3, 1750.2], [-1603.8, 1791.4], [-1608.2, 1837.8],
    [-1626.5, 1884.2], [-1565.1, 1929.8], [-1519, 1982.3], [-1471.1, 2034.8], [-1388.4, 2080.8],
    [-1351.3, 2110.3], [-1307.8, 2150.6], [-1248.2, 2185.8], [-1161.6, 2282.5], [-1121.1, 2298.6],
    [-1085, 2329.4], [-1071, 2377.6], [-1024, 2404.9], [-979.6, 2418], [-939.1, 2432.2],
    [-860.8, 2540.7], [-871.7, 2641], [-865.1, 2723], [-862.1, 2766.4], [-841.2, 2805.4],
    [-809.4, 2844.5], [-768, 2868.8], [-678.4, 2890.9], [-631.8, 2910], [-579.6, 2944.7],
    [-544.7, 2971.6], [-407.2, 3035], [-329.3, 3031.9], [-233.9, 3066.2], [-186.9, 3098.8],
    [-137.7, 3141.3], [-94.2, 3200.8], [-71.1, 3248.5], [-48.9, 3349.2], [-38.9, 3423.4],
    [-1, 3530.6], [13.3, 3579.6], [110.1, 3887.8], [130, 3951.6]
  ];

  // Repères géographiques marseillais (même repère métrique local)
  const LANDMARKS_REF = [
    { nom: 'Vieux-Port · Quai de Rive-Neuve', categorie: 'port', x: -100, z: 355 },
    { nom: 'Fort Saint-Nicolas & Palais du Pharo', categorie: 'monument', x: -1100, z: 440 },
    { nom: 'Plage des Catalans', categorie: 'plage', x: -1450, z: 620 },
    { nom: 'Viaduc du Vallon des Auffes', categorie: 'pont', x: -1841, z: 1171 },
    { nom: 'Malmousque · Anse de la Fausse-Monnaie', categorie: 'anse', x: -1832, z: 1536 },
    { nom: 'Plage du Prophète', categorie: 'plage', x: -1162, z: 2283 },
    { nom: 'Parc Valmer & Roucas-Blanc', categorie: 'belvedere', x: -865, z: 2723 },
    { nom: 'Plages du Prado · Promenade Georges Pompidou', categorie: 'plage', x: -1, z: 3531 },
    { nom: 'Rond-Point du David · Statue de David', categorie: 'monument', x: 115, z: 3948 }
  ];

  // Profil altimétrique réaliste de la côte marseillaise : [s_m, y_m]
  const PROFIL_ALT = [
    [0, 2.4],
    [420, 2.4],
    [680, 7.5],
    [960, 20.5],
    [1120, 22.8],
    [1310, 14.0],
    [1490, 5.8],
    [1720, 11.5],
    [1980, 18.2],
    [2260, 18.4],
    [2550, 21.5],
    [2950, 23.6],
    [3320, 17.8],
    [3640, 13.5],
    [3980, 19.6],
    [4320, 21.8],
    [4680, 14.5],
    [5040, 6.2],
    [5380, 3.4],
    [6100, 3.2]
  ];

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function catmullRomCentripetal(p0, p1, p2, p3, t) {
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const t0 = 0;
    const t1 = t0 + Math.sqrt(Math.max(dist(p0, p1), 1e-6));
    const t2 = t1 + Math.sqrt(Math.max(dist(p1, p2), 1e-6));
    const t3 = t2 + Math.sqrt(Math.max(dist(p2, p3), 1e-6));
    const tt = lerp(t1, t2, t);
    const l2 = (ta, tb, pa, pb) => {
      const f = (tt - ta) / (tb - ta + 1e-12);
      return [pa[0] + (pb[0] - pa[0]) * f, pa[1] + (pb[1] - pa[1]) * f];
    };
    const A1 = l2(t0, t1, p0, p1);
    const A2 = l2(t1, t2, p1, p2);
    const A3 = l2(t2, t3, p2, p3);
    const B1 = l2(t0, t2, A1, A2);
    const B2 = l2(t1, t3, A2, A3);
    return l2(t1, t2, B1, B2);
  }

  function resampleUniform(points, pas) {
    const nRaw = points.length;
    const sRaw = new Float64Array(nRaw);
    for (let i = 1; i < nRaw; i++) {
      sRaw[i] = sRaw[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    const longueurBrute = sRaw[nRaw - 1];
    const n = Math.round(longueurBrute / pas) + 1;
    const outX = new Float32Array(n);
    const outZ = new Float32Array(n);
    const outS = new Float32Array(n);

    let idx = 0;
    for (let k = 0; k < n; k++) {
      const s = Math.min(longueurBrute, k * pas);
      while (idx < nRaw - 2 && sRaw[idx + 1] < s) idx++;
      const t = (s - sRaw[idx]) / (sRaw[idx + 1] - sRaw[idx] + 1e-12);
      const i0 = Math.max(0, idx - 1);
      const i1 = idx;
      const i2 = Math.min(nRaw - 1, idx + 1);
      const i3 = Math.min(nRaw - 1, idx + 2);
      const pt = catmullRomCentripetal(points[i0], points[i1], points[i2], points[i3], clamp(t, 0, 1));
      outX[k] = pt[0];
      outZ[k] = pt[1];
      outS[k] = k * pas;
    }
    return { outX, outZ, outS, n };
  }

  // Adoucit les cassures locales (R >= 30 m partout) tout en préservant l'emprise côtière exacte.
  function lisserCourbes(rawX, rawZ, n, pas) {
    const th = new Float64Array(n);
    for (let i = 0; i < n - 1; i++) {
      let a = Math.atan2(rawZ[i + 1] - rawZ[i], rawX[i + 1] - rawX[i]);
      if (i > 0) {
        while (a - th[i - 1] > PI) a -= TWO_PI;
        while (a - th[i - 1] < -PI) a += TWO_PI;
      }
      th[i] = a;
    }
    th[n - 1] = th[n - 2];

    const MAX_DTH = pas / 30;
    const tmp = new Float64Array(n);
    for (let pass = 0; pass < 160; pass++) {
      let worst = 0;
      tmp.set(th);
      for (let i = 1; i < n - 1; i++) {
        const d1 = Math.abs(th[i] - th[i - 1]);
        const d2 = Math.abs(th[i + 1] - th[i]);
        if (d1 > worst) worst = d1;
        if (d1 > MAX_DTH || d2 > MAX_DTH || pass < 10) {
          tmp[i] = 0.25 * th[i - 1] + 0.5 * th[i] + 0.25 * th[i + 1];
        }
      }
      th.set(tmp);
      if (pass >= 10 && worst <= MAX_DTH * 1.01) break;
    }

    const rX = new Float32Array(n);
    const rZ = new Float32Array(n);
    const rS = new Float32Array(n);
    let cx = rawX[0], cz = rawZ[0];
    rX[0] = cx; rZ[0] = cz; rS[0] = 0;
    for (let i = 1; i < n; i++) {
      const a = 0.5 * (th[i - 1] + th[i]);
      cx += Math.cos(a) * pas;
      cz += Math.sin(a) * pas;
      rX[i] = cx; rZ[i] = cz; rS[i] = i * pas;
    }
    return { outX: rX, outZ: rZ, outS: rS, longueur: (n - 1) * pas };
  }

  function altitudeProfil(s) {
    if (s <= PROFIL_ALT[0][0]) return PROFIL_ALT[0][1];
    for (let i = 0; i < PROFIL_ALT.length - 1; i++) {
      const s0 = PROFIL_ALT[i][0], y0 = PROFIL_ALT[i][1];
      const s1 = PROFIL_ALT[i + 1][0], y1 = PROFIL_ALT[i + 1][1];
      if (s <= s1) {
        const u = clamp((s - s0) / Math.max(1e-6, s1 - s0), 0, 1);
        const sm = u * u * (3 - 2 * u);
        return lerp(y0, y1, sm);
      }
    }
    return PROFIL_ALT[PROFIL_ALT.length - 1][1];
  }

  function creer(graine, options) {
    graine = graine || 313;
    options = options || {};

    const brut = resampleUniform(POINTS_BRUTS, PAS);
    const { outX, outZ, outS, longueur } = lisserCourbes(brut.outX, brut.outZ, brut.n, PAS);
    const n = brut.n;

    // Élévation côtière fluide et lissée (pente douce <= 8 %)
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = altitudeProfil(outS[i]);
    const yTmp = new Float32Array(n);
    for (let pass = 0; pass < 18; pass++) {
      yTmp[0] = y[0]; yTmp[n - 1] = y[n - 1];
      for (let i = 1; i < n - 1; i++) yTmp[i] = 0.25 * y[i - 1] + 0.5 * y[i] + 0.25 * y[i + 1];
      y.set(yTmp);
    }

    // Localiser exactement le Viaduc du Vallon des Auffes sur la polyligne lissée
    let idxVallon = Math.round(2150 / PAS);
    let bestDVallon = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(outX[i] - (-1840.7), outZ[i] - 1171.4);
      if (d < bestDVallon) { bestDVallon = d; idxVallon = i; }
    }
    const sVallon = idxVallon * PAS;
    const pontDebut = Math.max(1800, Math.round((sVallon - 72) / PAS) * PAS);
    const pontFin = pontDebut + 144;
    const ponts = [{ debut: pontDebut, fin: pontFin, nom: 'Viaduc du Vallon des Auffes', longueur: pontFin - pontDebut }];

    // Aplanir délicatement le tablier du Viaduc du Vallon des Auffes
    const yPont = y[Math.min(n - 1, Math.round((pontDebut + pontFin) * 0.5 / PAS))];
    for (let i = 0; i < n; i++) {
      const s = outS[i];
      if (s >= pontDebut - 32 && s <= pontFin + 32) {
        const dBord = s < pontDebut ? (pontDebut - s) : (s > pontFin ? s - pontFin : 0);
        const wP = dBord <= 0 ? 1 : (1 - dBord / 32) * (1 - dBord / 32) * (3 - 2 * (1 - dBord / 32));
        y[i] = lerp(y[i], yPont, wP);
      }
    }

    // Cap, courbure, pente, dévers
    const cap = new Float32Array(n);
    const courbureRaw = new Float32Array(n);
    const courbure = new Float32Array(n);
    const penteRaw = new Float32Array(n);
    const pente = new Float32Array(n);
    const devers = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      cap[i] = Math.atan2(outZ[b] - outZ[a], outX[b] - outX[a]);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let dc = cap[b] - cap[a];
      while (dc > PI) dc -= TWO_PI;
      while (dc < -PI) dc += TWO_PI;
      courbureRaw[i] = dc / ((b - a) * PAS);
    }
    for (let i = 0; i < n; i++) {
      const a2 = Math.max(0, i - 2), a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), b2 = Math.min(n - 1, i + 2);
      courbure[i] = clamp((courbureRaw[a2] + 2 * courbureRaw[a] + 3 * courbureRaw[i] + 2 * courbureRaw[b] + courbureRaw[b2]) / 9, -1 / 24, 1 / 24);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      penteRaw[i] = (y[b] - y[a]) / ((b - a) * PAS);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      pente[i] = (penteRaw[a] + penteRaw[i] + penteRaw[b]) / 3;
    }

    const arriveeS = Math.round((longueur - 240) / PAS) * PAS;
    for (let i = 0; i < n; i++) {
      const s = outS[i];
      let dv = clamp(-courbure[i] * 1.15, -0.035, 0.035);
      if (s < 140 || s > arriveeS - 40 || (s >= pontDebut - 8 && s <= pontFin + 8)) dv = 0;
      devers[i] = dv;
    }

    // Vibreurs urbains sur les virages marqués de la Corniche
    const vibreur = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const s = outS[i];
      if (s < 140 || s > arriveeS) continue;
      if (Math.abs(courbure[i]) > 0.0085) vibreur[i] = 3;
    }

    // Limites latérales urbaines côtières (glissières/parapets propres)
    const limiteG = new Float32Array(n);
    const limiteD = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = outS[i];
      let lg = DEMI_L + 2.4;
      let ld = DEMI_L + 2.2;
      if (s >= pontDebut && s <= pontFin) {
        lg = DEMI_L + 1.1;
        ld = DEMI_L + 1.1;
      }
      limiteG[i] = lg;
      limiteD[i] = ld;
    }

    // Projeter chaque repère sur son s exact
    const lieux = LANDMARKS_REF.map(lm => {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(outX[i] - lm.x, outZ[i] - lm.z);
        if (d < bd) { bd = d; bi = i; }
      }
      return { nom: lm.nom, categorie: lm.categorie, s: bi * PAS, x: outX[bi], z: outZ[bi] };
    });

    const c = {
      id: 'marseille',
      nom: 'Marseille · Vieux-Port → Corniche',
      graine: graine || 313,
      theme: 'cote',
      ouvert: true,
      topologie: 'ouvert',
      depart: 0,
      arrivee: arriveeS,
      zoneDeceleration: [arriveeS, longueur],
      n, pas: PAS, longueur, largeur: LARGEUR,
      x: outX, y, z: outZ, cap, courbure, pente, devers, vibreur, limiteG, limiteD,
      ligne: new Float32Array(n), vitesse: new Float32Array(n),
      tunnel: null,
      couverts: [],
      ponts,
      bords: [],
      lieux,
      marseille: {
        ndlg: { x: -193, z: 1347, y: 148, nom: 'Notre-Dame de la Garde' },
        viaduc: ponts[0],
        provenance: PROVENANCE
      }
    };

    if (B.circuit && B.circuit.preparerParcours) {
      B.circuit.preparerParcours(c);
    }

    // Vitesses fluides Grand Prix urbain côtier
    for (let i = 0; i < n; i++) {
      c.vitesse[i] = clamp(c.vitesse[i], 18, 84);
      if (outS[i] > arriveeS) {
        const f = (outS[i] - arriveeS) / (longueur - arriveeS + 1);
        c.vitesse[i] = lerp(c.vitesse[i], 8, f);
      }
    }

    return c;
  }

  function valider(c) {
    const problems = [];
    if (!c) return ['circuit null'];
    if (c.id !== 'marseille') problems.push('c.id !== marseille');
    if (c.ouvert !== true) problems.push('c.ouvert !== true');
    if (c.depart !== 0) problems.push('c.depart !== 0');
    if (c.longueur < 5500 || c.longueur > 6500) problems.push('longueur hors plage: ' + c.longueur);
    if (c.arrivee <= 5000 || c.longueur <= c.arrivee + 180) problems.push('arrivee invalide');
    if (!c.ponts || c.ponts.length !== 1) problems.push('Viaduc du Vallon des Auffes manquant');
    if (!c.x || !c.y || !c.z || !c.cap || !c.courbure || !c.pente) problems.push('tableaux manquants');
    for (let i = 0; i < c.n; i++) {
      if (!isFinite(c.x[i]) || !isFinite(c.y[i]) || !isFinite(c.z[i])) { problems.push('non-fini i=' + i); break; }
      if (Math.abs(c.pente[i]) > 0.12) { problems.push('pente excessive i=' + i + ': ' + c.pente[i]); break; }
    }
    return problems;
  }

  B.marseille = { creer, valider, PROVENANCE };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.marseille;
