/* BITUME — Décor côtier réel Marseille · Vieux-Port → Pharo → Viaduc du Vallon des Auffes →
   Corniche Kennedy → Notre-Dame de la Garde → Plages du Prado → Statue de David.
   Champ de hauteur 2D monovalué (13 floats/sommet FERRO 0.3.15), mer Méditerranée mat=12,
   zéro dépendance, zéro Math.random(). */
(function (B) {
  'use strict';

  const FLOATS_VERT = 13;
  const PI = Math.PI;
  const NIVEAU_MER = -0.35;

  function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function _lerp(a, b, t) { return a + (b - a) * t; }
  function _smoothstep(lo, hi, x) {
    const t = _clamp((x - lo) / (hi - lo), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function hache(a, b) {
    let h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 40503)) >>> 0;
    h = Math.imul((h >>> 16) ^ h, 0x45d9f3b) >>> 0;
    h = Math.imul((h >>> 16) ^ h, 0x45d9f3b) >>> 0;
    h = (h >>> 16) ^ h;
    return (h & 0x7fffffff) / 0x7fffffff;
  }

  function _noise2(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = hache(ix, iz), b = hache(ix + 1, iz);
    const c2 = hache(ix, iz + 1), d = hache(ix + 1, iz + 1);
    return a * (1 - sx) * (1 - sz) + b * sx * (1 - sz) + c2 * (1 - sx) * sz + d * sx * sz;
  }

  function _fbm(x, z, oct) {
    let v = 0, a = 1, f = 1, t = 0;
    for (let o = 0; o < oct; o++) { v += a * _noise2(x * f, z * f); t += a; a *= 0.5; f *= 2.03; }
    return v / t;
  }

  function _ridge(x, z, oct) {
    let v = 0, a = 1, f = 1, t = 0;
    for (let o = 0; o < oct; o++) { v += a * (1 - Math.abs(_noise2(x * f, z * f) * 2 - 1)); t += a; a *= 0.5; f *= 2.07; }
    return v / t;
  }

  function couperAccotement(c, s, type) {
    if (!c || c.id !== 'marseille') return false;
    if (type !== 'herbe' && type !== 'jupe') return false;
    if (!c.ponts) return false;
    for (let i = 0; i < c.ponts.length; i++) {
      const p = c.ponts[i];
      if (s > p.debut + 2 && s < p.fin - 2) return true;
    }
    return false;
  }

  // Index spatial des échantillons de route (CELL = 360, recherche ±3 → couvre ±1080 m sans saut)
  function _buildGrilleRoute(c) {
    const P = c.pas, n = c.n, CELL = 360;
    const map = new Map();
    for (let i = 0; i < n; i += 2) {
      const cx = Math.floor(c.x[i] / CELL), cz = Math.floor(c.z[i] / CELL);
      const key = cx + ',' + cz;
      let arr = map.get(key);
      if (!arr) { arr = []; map.set(key, arr); }
      arr.push(i);
    }
    return { map, CELL, P, n, c };
  }

  function _queryRoute(gr, x, z) {
    const { map, CELL, P, n, c } = gr;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let bestIdx = -1, bestD2 = 1e18;
    let sumY = 0, sumW = 0;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const arr = map.get((cx + dx) + ',' + (cz + dz));
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) {
          const i = arr[k];
          const ddx = c.x[i] - x, ddz = c.z[i] - z;
          const d2 = ddx * ddx + ddz * ddz;
          if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
          if (d2 < 320 * 320) {
            const w = 1 / ((d2 + 160) * (d2 + 160));
            sumY += c.y[i] * w; sumW += w;
          }
        }
      }
    }
    if (bestIdx < 0) {
      for (let i = 0; i < n; i += 4) {
        const ddx = c.x[i] - x, ddz = c.z[i] - z, d2 = ddx * ddx + ddz * ddz;
        if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
      }
      if (bestIdx < 0) bestIdx = 0;
    }
    // Raffinement local autour de bestIdx
    for (let i = Math.max(0, bestIdx - 2); i <= Math.min(n - 1, bestIdx + 2); i++) {
      const ddx = c.x[i] - x, ddz = c.z[i] - z, d2 = ddx * ddx + ddz * ddz;
      if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
    }
    const i = bestIdx;
    const iNext = Math.min(n - 1, i + 1), iPrev = Math.max(0, i - 1);
    const tx = c.x[iNext] - c.x[iPrev], tz = c.z[iNext] - c.z[iPrev];
    const tl = Math.hypot(tx, tz) || 1;
    // Vecteur droit route : d > 0 = côté MER (Nord/Ouest), d < 0 = côté TERRE (Est/collines)
    const rx = -tz / tl, rz = tx / tl;
    const dSigned = (x - c.x[i]) * rx + (z - c.z[i]) * rz;
    const absD = Math.sqrt(bestD2);
    const yRoute = c.y[i];
    const ySmooth = sumW > 0 ? (sumY / sumW) : yRoute;
    return { idx: i, d: dSigned, absD, yRoute, ySmooth, s: i * P };
  }

  // Champ de hauteur 2D monovalué H(x, z) — garanti SOUS la chaussée & creusé sous le Viaduc du Vallon des Auffes
  function _H(x, z, gr, c) {
    const q = _queryRoute(gr, x, z);
    const { absD, d, yRoute, ySmooth, s } = q;
    const pont = c.ponts && c.ponts[0];

    // Calanque du Vallon des Auffes sous le viaduc : creusée sous la mer (-4.2 m)
    let sousPont = 0;
    if (pont && absD < 74 && s >= pont.debut - 26 && s <= pont.fin + 26) {
      const uS = _smoothstep(pont.debut - 24, pont.debut + 8, s) * (1 - _smoothstep(pont.fin - 8, pont.fin + 24, s));
      const uD = 1 - _smoothstep(24, 74, absD);
      sousPont = uS * uD;
    }

    // Une maille du relief fait 24 m : garder aussi ses sommets extérieurs sous le plateau du box.
    if (c.stands && s >= c.stands.debut-48 && s <= c.stands.fin+48 && d > -34 && d < c.stands.dFond+36) {
      return yRoute - 1.4 - 36*Math.abs(c.pente[q.idx] || 0);
    }
    // Bandeau de sécurité chaussée (G = 24 m → absD <= 28 m toujours <= yRoute - 0.55 m !)
    if (absD <= 28) {
      const tB = _smoothstep(10, 28, absD);
      let hApron = yRoute - 0.58 - tB * 0.65;
      // Côté mer au Vieux-Port / plages : pente douce vers l'eau dès 15 m
      if (d > 14 && s < 750) {
        hApron = _lerp(hApron, -3.6, _smoothstep(14, 28, d));
      }
      if (sousPont > 0) hApron = _lerp(hApron, -4.4, sousPont);
      return hApron;
    }

    const noise = (_fbm(x * 0.0028 + 3.1, z * 0.0028 - 1.7, 4) - 0.5) * 14;
    const calanque = _ridge(x * 0.0018 + 1.4, z * 0.0018 + 2.9, 4);

    // 1. Côté MER (d > 0) : falaises calcaires de la Corniche, plages des Catalans / Prophète / Prado, bassin du Vieux-Port
    if (d > 0) {
      // Plages sableuses douces : Catalans (1380..1680), Prophète (3450..3850), Prado (4900..6100)
      const estPlage =
        _smoothstep(1340, 1440, s) * (1 - _smoothstep(1620, 1740, s)) +
        _smoothstep(3400, 3520, s) * (1 - _smoothstep(3780, 3900, s)) +
        _smoothstep(4860, 5150, s);
      const plageT = _clamp(estPlage, 0, 1);

      // Promontoire rocheux du Pharo (s = 820..1260) : reste au-dessus de l'eau jusqu'à d = 105 m
      const wPharo = _smoothstep(780, 920, s) * (1 - _smoothstep(1180, 1320, s));
      const limiteCote = _lerp(56, 118, Math.max(plageT * 0.75, wPharo));

      const fDescente = _smoothstep(26, limiteCote, d);
      const hPlage = _lerp(yRoute - 0.9, -4.4, fDescente) + Math.sin(d * 0.05) * 0.3 * (1 - fDescente);
      const hFalaise = _lerp(yRoute - 0.9, -5.0, _smoothstep(26, 72 + wPharo * 48, d)) +
        (calanque * 7.5 - 2.0) * (1 - _smoothstep(55, 115, d)) * _smoothstep(28, 42, d);
      let hMer = _lerp(hFalaise, hPlage, plageT);

      // Bassin du Vieux-Port (s < 760) : quai net tombant dans le port
      if (s < 780) {
        const wPort = 1 - _smoothstep(680, 780, s);
        const hPort = _lerp(yRoute - 0.6, -4.0, _smoothstep(16, 36, d));
        hMer = _lerp(hMer, hPort, wPort);
      }

      if (sousPont > 0) hMer = _lerp(hMer, -4.6, sousPont);
      return hMer;
    }

    // 2. Côté TERRE (d <= 0) : relief 100 % continu en coordonnées monde (x, z) — zéro couture de Voronoi !
    const distTerre = -d;
    const fColline = _smoothstep(28, 360, distTerre);
    // Plaine du Prado / Parc Borély (Sud-Est, z > 3150) douce ; relief calcaire marseillais ailleurs
    const wPrado = _smoothstep(3050, 3550, z);
    // Colline du Roucas-Blanc / Parc Valmer (monde [-420, 2550])
    const dRoucas = Math.hypot(x - (-420), z - 2550);
    const hRoucas = 52 * Math.exp(-(dRoucas * dRoucas) / (2 * 480 * 480));
    // Colline de Notre-Dame de la Garde (pic exact à x = -193, z = 1347, y ≈ 148 m)
    const nd = c.marseille && c.marseille.ndlg ? c.marseille.ndlg : { x: -193, z: 1347, y: 148 };
    const dND = Math.hypot(x - nd.x, z - nd.z);
    const hND = (nd.y - 16) * Math.exp(-(dND * dND) / (2 * 330 * 330));

    const hMonde = _lerp(18 + hRoucas + hND + calanque * 28 + noise, 5 + calanque * 6 + noise * 0.3, wPrado);
    let hTerre = _lerp(yRoute - 1.1, _lerp(ySmooth, hMonde, fColline), _smoothstep(28, 88, distTerre));
    if (dND < 900) {
      // Garantir la hauteur exacte du sommet NDG sans écraser la chaussée
      const mRoute = _smoothstep(34, 120, absD);
      const hSommet = 16 + hND + calanque * 8 * (1 - _smoothstep(100, 30, dND));
      hTerre = Math.max(hTerre, _lerp(hTerre, hSommet, mRoute));
    }

    if (sousPont > 0) hTerre = _lerp(hTerre, -4.4, sousPont);
    return hTerre;
  }

  function _colorTerrain(x, z, y, ny, q, saison) {
    const { s, d } = q;
    const n1 = _fbm(x * 0.008 + 2.3, z * 0.008 - 4.1, 3);
    // La même plage de couleur relie la garrigue, le calcaire et le sable entre les sommets espacés de 24 m.
    const derive = (n1 - .5) * 12;
    const calcaire = Math.max(_smoothstep(.90, .62, ny),
      .72 * _smoothstep(48, 125, y), .55 * _smoothstep(5, 28, d + derive));
    let r = .35 + n1 * .14, g = .41 + n1 * .11, b = .19 + n1 * .06;
    if (calcaire > 0) {
      const cn = _fbm(x * .011 + 9.2, z * .011 + 5.7, 3);
      r = _lerp(r, .76 + cn * .14, calcaire);
      g = _lerp(g, .73 + cn * .13, calcaire);
      b = _lerp(b, .65 + cn * .11, calcaire);
    }

    const parc = .60 * _smoothstep(4950, 5300, s) * _smoothstep(0, 4, y)
      * (1 - _smoothstep(10, 34, d + derive));
    r = _lerp(r, .24 + n1 * .08, parc);
    g = _lerp(g, .44 + n1 * .09, parc);
    b = _lerp(b, .18 + n1 * .05, parc);

    const sable = (1 - _smoothstep(.6, 5.2, y + (n1 - .5))) * _smoothstep(3, 21, d + derive);
    r = _lerp(r, .78 + n1 * .10, sable);
    g = _lerp(g, .70 + n1 * .08, sable);
    b = _lerp(b, .48 + n1 * .06 - (1 - _smoothstep(-1.5, 2.6, y)) * .08, sable);

    if (saison && saison.automne) { r *= 1.06; g *= 0.96; b *= 0.90; }
    return [r, g, b];
  }

  function terrain(c, th, interroger, g, ecologie, organique) {
    if (!c || c.id !== 'marseille') return null;
    const saison = (g && typeof g === 'object' && g.saison) || null;
    const G = 24;
    const TILE = 192;
    const RANGE = 420;
    const gr = _buildGrilleRoute(c);
    const liste = [];

    const tuilesActives = new Map(), solParTuile = new Map();
    const activer = (nx, nz) => {
      const cle = nx + ',' + nz;
      if (!tuilesActives.has(cle)) tuilesActives.set(cle, [nx, nz]);
    };

    const rTuiles = Math.ceil(RANGE / TILE);
    let bxMin = Infinity, bxMax = -Infinity, bzMin = Infinity, bzMax = -Infinity;
    for (let i = 0; i < c.n; i++) {
      const cx = c.x[i], cz = c.z[i];
      if (cx < bxMin) bxMin = cx; if (cx > bxMax) bxMax = cx;
      if (cz < bzMin) bzMin = cz; if (cz > bzMax) bzMax = cz;
      if (i % 4 === 0 || i === c.n - 1) {
        const tcx = Math.floor(cx / TILE), tcz = Math.floor(cz / TILE);
        for (let dx = -rTuiles; dx <= rTuiles; dx++) {
          for (let dz = -rTuiles; dz <= rTuiles; dz++) activer(tcx + dx, tcz + dz);
        }
      }
    }
    // Couvrir continûment la colline de Notre-Dame de la Garde et le versant urbain entre Vieux-Port & Corniche
    const nd = c.marseille && c.marseille.ndlg ? c.marseille.ndlg : { x: -193, z: 1347, y: 148 };
    const tx0 = Math.floor(-1500 / TILE), tx1 = Math.floor(450 / TILE);
    const tz0 = Math.floor(350 / TILE), tz1 = Math.floor(2550 / TILE);
    for (let nx = tx0; nx <= tx1; nx++) {
      for (let nz = tz0; nz <= tz1; nz++) activer(nx, nz);
    }
    const ndx = Math.floor(nd.x / TILE), ndz = Math.floor(nd.z / TILE);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) activer(ndx + dx, ndz + dz);

    bxMin = Math.min(bxMin - RANGE, -2600);
    bxMax = Math.max(bxMax + RANGE, 700);
    bzMin = Math.min(bzMin - RANGE, -300);
    bzMax = Math.max(bzMax + RANGE, 4500);

    const N_SIDE = Math.round(TILE / G) + 1;
    const nVerts = N_SIDE * N_SIDE;
    const nIdx = (N_SIDE - 1) * (N_SIDE - 1) * 6;

    for (const [nx, nz] of tuilesActives.values()) {
      const tileX0 = nx * TILE, tileZ0 = nz * TILE;
      const tileX1 = tileX0 + TILE, tileZ1 = tileZ0 + TILE;
      const hArr = new Float32Array(nVerts);
      let nyMin = Infinity, nyMax = -Infinity;

      for (let k = 0; k < N_SIDE; k++) {
        for (let j = 0; j < N_SIDE; j++) {
          const wy = _H(tileX0 + j * G, tileZ0 + k * G, gr, c);
          hArr[k * N_SIDE + j] = wy;
          if (wy < nyMin) nyMin = wy;
          if (wy > nyMax) nyMax = wy;
        }
      }
      // Inutile d'émettre une tuile entièrement immergée sous la mer
      if (nyMax < NIVEAU_MER - 1.8) continue;

      const sommets = new Float32Array(nVerts * FLOATS_VERT);
      const indices = new Uint32Array(nIdx);
      const herbeTri = [];

      for (let k = 0; k < N_SIDE; k++) {
        for (let j = 0; j < N_SIDE; j++) {
          const idx = k * N_SIDE + j;
          const wx = tileX0 + j * G, wz = tileZ0 + k * G;
          const wy = hArr[idx];
          const hL = j > 0 ? hArr[idx - 1] : _H(wx - G, wz, gr, c);
          const hR = j < N_SIDE - 1 ? hArr[idx + 1] : _H(wx + G, wz, gr, c);
          const hD = k > 0 ? hArr[idx - N_SIDE] : _H(wx, wz - G, gr, c);
          const hU = k < N_SIDE - 1 ? hArr[idx + N_SIDE] : _H(wx, wz + G, gr, c);
          let dnx = hL - hR, dny = 2 * G, dnz = hD - hU;
          const nl = Math.hypot(dnx, dny, dnz) || 1;
          dnx /= nl; dny /= nl; dnz /= nl;

          const q = _queryRoute(gr, wx, wz);
          const col = _colorTerrain(wx, wz, wy, dny, q, saison);
          const off = idx * FLOATS_VERT;
          sommets[off] = wx; sommets[off + 1] = wy; sommets[off + 2] = wz;
          sommets[off + 3] = dnx; sommets[off + 4] = dny; sommets[off + 5] = dnz;
          sommets[off + 6] = 0; sommets[off + 7] = 0; sommets[off + 8] = 0;
          sommets[off + 9] = 25; // organicSoil unifié FERRO
          sommets[off + 10] = col[0]; sommets[off + 11] = col[1]; sommets[off + 12] = col[2];
        }
      }

      let ii = 0;
      for (let k = 0; k < N_SIDE - 1; k++) {
        for (let j = 0; j < N_SIDE - 1; j++) {
          const v00 = k * N_SIDE + j;
          const v10 = (k + 1) * N_SIDE + j;
          const v01 = k * N_SIDE + j + 1;
          const v11 = (k + 1) * N_SIDE + j + 1;
          if ((k + j) & 1) {
            indices[ii++] = v00; indices[ii++] = v11; indices[ii++] = v01;
            indices[ii++] = v00; indices[ii++] = v10; indices[ii++] = v11;
          } else {
            indices[ii++] = v00; indices[ii++] = v10; indices[ii++] = v01;
            indices[ii++] = v10; indices[ii++] = v11; indices[ii++] = v01;
          }
          if (hArr[v00] > 2.2 && sommets[v00 * FLOATS_VERT + 4] >= 0.78 && sommets[v01 * FLOATS_VERT + 4] >= 0.78) {
            herbeTri.push(ii - 6, ii - 3);
          }
        }
      }

      const nappeObj = {
        sommets,
        indices,
        centre: [(tileX0 + tileX1) * 0.5, (nyMin + nyMax) * 0.5, (tileZ0 + tileZ1) * 0.5],
        rayon: Math.hypot(TILE, nyMax - nyMin, TILE) * 0.5
      };
      Object.defineProperty(nappeObj, 'herbeTriangles', { enumerable: false, value: herbeTri });
      Object.defineProperty(nappeObj, 'surfaceType', { enumerable: false, value: 'terrain' });
      if (!solParTuile.has(nx)) solParTuile.set(nx, new Map());
      solParTuile.get(nx).set(nz, sommets);
      liste.push(nappeObj);
    }

    // Mer Méditerranée turquoise tuilée (mat = 12 → zéro collision PhysX, reflets FERRO)
    const SEA_TILE = 512;
    const SEA_SUB = 4;
    const SEA_STEP = SEA_TILE / SEA_SUB;
    const SN = SEA_SUB + 1;
    for (let sx = -4608; sx < 1024; sx += SEA_TILE) {
      for (let sz = -1536; sz < 5632; sz += SEA_TILE) {
        // Sauter les tuiles purement dans les terres hautes (Est de la côte et Sud du Vieux-Port)
        const cx = sx + SEA_TILE * 0.5, cz = sz + SEA_TILE * 0.5;
        const qC = _queryRoute(gr, cx, cz);
        if (qC.d < -380 && cz > 520) continue;

        const sommets = new Float32Array(SN * SN * FLOATS_VERT);
        const indices = new Uint32Array(SEA_SUB * SEA_SUB * 6);
        for (let k = 0; k < SN; k++) {
          for (let j = 0; j < SN; j++) {
            const wx = sx + j * SEA_STEP, wz = sz + k * SEA_STEP;
            const qW = _queryRoute(gr, wx, wz);
            // Turquoise calanques lumineux près des plages et criques, bleu azur profond au large
            const prof = _smoothstep(25, 480, Math.max(0, qW.d));
            const off = (k * SN + j) * FLOATS_VERT;
            sommets[off] = wx; sommets[off + 1] = NIVEAU_MER; sommets[off + 2] = wz;
            sommets[off + 3] = 0; sommets[off + 4] = 1; sommets[off + 5] = 0;
            sommets[off + 6] = wx / 1600; sommets[off + 7] = wz / 1600; sommets[off + 8] = 0;
            sommets[off + 9] = 12; // eau
            sommets[off + 10] = _lerp(0.012, 0.008, prof);
            sommets[off + 11] = _lerp(0.26, 0.11, prof);
            sommets[off + 12] = _lerp(0.45, 0.30, prof);
          }
        }
        let ii = 0;
        for (let k = 0; k < SEA_SUB; k++) {
          for (let j = 0; j < SEA_SUB; j++) {
            const v00 = k * SN + j, v10 = (k + 1) * SN + j, v01 = v00 + 1, v11 = v10 + 1;
            indices[ii++] = v00; indices[ii++] = v10; indices[ii++] = v01;
            indices[ii++] = v10; indices[ii++] = v11; indices[ii++] = v01;
          }
        }
        const nappeMer = {
          sommets,
          indices,
          centre: [cx, NIVEAU_MER, cz],
          rayon: Math.hypot(SEA_TILE, 4, SEA_TILE) * 0.5
        };
        Object.defineProperty(nappeMer, 'herbeTriangles', { enumerable: false, value: [] });
        Object.defineProperty(nappeMer, 'surfaceType', { enumerable: false, value: 'eau' });
        liste.push(nappeMer);
      }
    }

    function sol(x, z) { return _H(x, z, gr, c); }

    function solRendu(x, z) {
      const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
      const ligne = solParTuile.get(tx), sommets = ligne && ligne.get(tz);
      if (!sommets) return sol(x, z);
      const gx = (x - tx * TILE) / G, gz = (z - tz * TILE) / G;
      const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
      const a = (j * N_SIDE + i) * FLOATS_VERT + 1, b = a + FLOATS_VERT, d = a + N_SIDE * FLOATS_VERT, e = d + FLOATS_VERT;
      if ((i + j) & 1) return u >= v ? sommets[a] + (sommets[b] - sommets[a]) * u + (sommets[e] - sommets[b]) * v
        : sommets[a] + (sommets[e] - sommets[d]) * u + (sommets[d] - sommets[a]) * v;
      return u + v <= 1 ? sommets[a] + (sommets[b] - sommets[a]) * u + (sommets[d] - sommets[a]) * v
        : sommets[e] + (sommets[d] - sommets[e]) * (1 - u) + (sommets[b] - sommets[e]) * (1 - v);
    }
    return {
      liste,
      sol, solRendu,
      bornes: [bxMin, bzMin, bxMax, bzMax],
      niveauEau: NIVEAU_MER,
      paysageBaikal: null
    };
  }

  function poser(c, outils) {
    if (!c || c.id !== 'marseille') return null;
    const { terrain: terr, qualite, saison, ajouter } = outils;
    const graine = c.graine || 313;
    const isLow = qualite === 'low';
    const gr = _buildGrilleRoute(c);
    const objets = [];
    const w = (c.largeur || 12) * 0.5;
    const rocheForme = g => (B.lieux && B.lieux.rocherPour ? B.lieux.rocherPour('cote', g >>> 0) : 'bitume-lieu-rocher-alpin');

    function add(obj, loin, x, z) {
      if (!obj) return;
      objets.push(obj);
      if (ajouter) ajouter([obj], loin ? [obj] : [], x !== undefined ? x : obj.p[0], z !== undefined ? z : obj.p[2]);
    }

    function getPos(s) {
      const idx = Math.max(0, Math.min(c.n - 1, Math.round(s / c.pas)));
      const a = c.cap[idx];
      return {
        x: c.x[idx], y: c.y[idx], z: c.z[idx], cap: a, idx,
        tx: Math.cos(a), tz: Math.sin(a),
        rx: -Math.sin(a), rz: Math.cos(a)
      };
    }

    function degage(x, z, marge) {
      const q = _queryRoute(gr, x, z);
      return q.absD >= w + (marge || 2.5) && !B.circuit.empriseStands(c,q.s,q.d,marge || 2.5);
    }

    function solMin5(x, z, r) {
      if (!terr) return 2;
      r = r || 4;
      return Math.min(
        terr.sol(x, z),
        terr.sol(x - r, z), terr.sol(x + r, z),
        terr.sol(x, z - r), terr.sol(x, z + r)
      );
    }

    // Palette provençale ensoleillée (façades marseillaises)
    const FACADES = [
      [0.92, 0.84, 0.68], [0.89, 0.74, 0.54], [0.94, 0.88, 0.78],
      [0.86, 0.66, 0.52], [0.90, 0.79, 0.62], [0.88, 0.82, 0.74]
    ];
    const TOITS = [
      [0.72, 0.34, 0.22], [0.66, 0.31, 0.20], [0.76, 0.40, 0.25]
    ];
    const VOLETS = [
      [0.24, 0.48, 0.68], [0.22, 0.42, 0.28], [0.46, 0.58, 0.64]
    ];

    function immeubleProvencal(x, z, yaw, L, H, P, seed, detail) {
      const cos = Math.cos(-yaw), sin = Math.sin(-yaw);
      const demiL = L * 0.5, demiP = P * 0.5;
      const solAuCoin = (lx, lz) => terr.sol(x + cos * lx - sin * lz, z + sin * lx + cos * lz);
      const ySol = terr ? Math.min(
        solAuCoin(-demiL, -demiP), solAuCoin(-demiL, demiP),
        solAuCoin(demiL, -demiP), solAuCoin(demiL, demiP)
      ) : 2;
      const yFond = ySol - 2.6;
      const hTot = H + 2.6;
      const fCol = FACADES[Math.floor(hache(seed, 11) * FACADES.length)];
      const tCol = TOITS[Math.floor(hache(seed, 23) * TOITS.length)];
      const vCol = VOLETS[Math.floor(hache(seed, 37) * VOLETS.length)];
      const corps = { shape: 'box', p: [x, yFond + hTot * 0.5, z], s: [L, hTot, P], r: [0, yaw, 0], mat: 13.2, color: fCol };
      const toit = { shape: 'bevel', p: [x, ySol + H + 1.0, z], s: [L + 0.5, 2.1, P + 0.5], r: [0, yaw, 0], mat: 23, color: tCol };
      add(corps, true, x, z);
      add(toit, true, x, z);
      if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(corps, 'batiment', 2);
      if (detail && !isLow) {
        // Fenêtres et volets provençaux sur la façade face route
        const cos = Math.cos(-yaw), sin = Math.sin(-yaw);
        const nbEtages = Math.max(1, Math.min(4, Math.floor(H / 3.1)));
        const nbCols = Math.max(2, Math.min(4, Math.floor(L / 3.2)));
        for (let e = 0; e < nbEtages; e++) {
          const fy = ySol + 2.1 + e * 2.9;
          for (let col = 0; col < nbCols; col++) {
            const lx = ((col + 0.5) / nbCols - 0.5) * (L - 1.6);
            const lz = P * 0.5 + 0.08;
            const wx = x + cos * lx + sin * lz;
            const wz = z - sin * lx + cos * lz;
            add({ shape: 'box', p: [wx, fy, wz], s: [1.05, 1.45, 0.14], r: [0, yaw, 0], mat: 7, color: [0.10, 0.14, 0.18] }, false, x, z);
            add({ shape: 'box', p: [wx, fy, wz + 0.02], s: [1.55, 1.48, 0.08], r: [0, yaw, 0], mat: 16, color: vCol }, false, x, z);
          }
        }
      }
    }

    function bateau(x, z, yaw, longueur, voilier, seed) {
      const yEau = NIVEAU_MER + 0.14;
      const cCoque = voilier ? [0.95, 0.96, 0.98] : (hache(seed, 5) > 0.5 ? [0.92, 0.94, 0.96] : [0.12, 0.36, 0.68]);
      const cBande = [[0.06, 0.42, 0.82], [0.84, 0.16, 0.14], [0.12, 0.56, 0.42], [0.94, 0.68, 0.12]][Math.floor(hache(seed, 17) * 4)];
      const larg = longueur * 0.30;
      add({ shape: 'bevel', p: [x, yEau + 0.42, z], s: [longueur, 0.95, larg], r: [0, yaw, 0], mat: 1, color: cCoque }, true, x, z);
      add({ shape: 'box', p: [x, yEau + 0.72, z], s: [longueur * 0.86, 0.18, larg + 0.06], r: [0, yaw, 0], mat: 16, color: cBande }, false, x, z);
      add({ shape: 'box', p: [x - Math.cos(yaw) * longueur * 0.08, yEau + 1.12, z + Math.sin(yaw) * longueur * 0.08], s: [longueur * 0.44, 0.68, larg * 0.72], r: [0, yaw, 0], mat: 1, color: [0.96, 0.96, 0.94] }, false, x, z);
      if (voilier) {
        const hMat = 8.5 + hache(seed, 29) * 5.5;
        add({ shape: 'cylinder', p: [x, yEau + 0.9 + hMat * 0.5, z], s: [0.14, hMat, 0.14], r: [0, 0, 0], mat: 0, color: [0.86, 0.88, 0.90] }, true, x, z);
        // Bôme & voile ferlée blanche
        add({ shape: 'box', p: [x - Math.cos(yaw) * 1.4, yEau + 2.4, z + Math.sin(yaw) * 1.4], s: [3.2, 0.26, 0.24], r: [0, yaw, 0], mat: 13.2, color: [0.96, 0.95, 0.90] }, false, x, z);
      }
    }

    // 1. VIEUX-PORT (s = 0..720) — Portique bleu/blanc Marseille, Ombrière, quais, voiliers & façades Quai de Rive-Neuve
    {
      // Portique de bienvenue Vieux-Port après la grille de départ (s = 118 m, traverse EN TRAVERS s[2] = 21.4 m)
      const pArc = getPos(118);
      const latP = w + 3.4;
      const p1x = pArc.x + pArc.rx * latP, p1z = pArc.z + pArc.rz * latP;
      const p2x = pArc.x - pArc.rx * latP, p2z = pArc.z - pArc.rz * latP;
      const yTop = pArc.y + 6.4;
      const y1 = Math.min(pArc.y, terr ? terr.sol(p1x, p1z) : pArc.y) - 1.5;
      const y2 = Math.min(pArc.y, terr ? terr.sol(p2x, p2z) : pArc.y) - 1.5;
      const pil1 = { shape: 'box', p: [p1x, (yTop + y1) * 0.5, p1z], s: [0.85, yTop - y1, 0.85], r: [0, -pArc.cap, 0], mat: 22, color: [0.92, 0.92, 0.90] };
      const pil2 = { shape: 'box', p: [p2x, (yTop + y2) * 0.5, p2z], s: [0.85, yTop - y2, 0.85], r: [0, -pArc.cap, 0], mat: 22, color: [0.92, 0.92, 0.90] };
      const poutre = { shape: 'box', p: [pArc.x, yTop + 0.45, pArc.z], s: [1.05, 1.0, latP * 2 + 1.4], r: [0, -pArc.cap, 0], mat: 1, color: [0.05, 0.56, 0.92] };
      const bande = { shape: 'box', p: [pArc.x - pArc.tx * 0.55, yTop + 0.45, pArc.z - pArc.tz * 0.55], s: [0.06, 0.46, latP * 2 + 0.6], r: [0, -pArc.cap, 0], mat: 16, color: [0.96, 0.98, 1.0], emissive: 0.45 };
      add(pil1, true, p1x, p1z);
      add(pil2, true, p2x, p2z);
      add(poutre, true, pArc.x, pArc.z);
      add(bande, true, pArc.x, pArc.z);
      if (B.decor && B.decor.marquerSolide) { B.decor.marquerSolide(pil1, 'pilier', 2); B.decor.marquerSolide(pil2, 'pilier', 2); }

      // Ombrière du Vieux-Port (miroir inoxemblématique côté port au départ)
      const pOmb = getPos(24);
      const ox = pOmb.x + pOmb.rx * 20, oz = pOmb.z + pOmb.rz * 20;
      if (degage(ox, oz, 6)) {
        add({ shape: 'box', p: [ox, pOmb.y + 5.6, oz], s: [28, 0.28, 13], r: [0, -pOmb.cap, 0], mat: 0, color: [0.88, 0.92, 0.96] }, true, ox, oz);
        for (let k = -1; k <= 1; k++) {
          for (const dz of [-5, 5]) {
            const cx = ox + pOmb.tx * k * 11 + pOmb.rx * dz;
            const cz = oz + pOmb.tz * k * 11 + pOmb.rz * dz;
            add({ shape: 'cylinder', p: [cx, pOmb.y + 2.8, cz], s: [0.22, 5.6, 0.22], r: [0, 0, 0], mat: 0, color: [0.78, 0.80, 0.84] }, false, cx, cz);
          }
        }
      }

      // Quai en pierre du Vieux-Port + pontons + flotte de voiliers amarrés (côté mer d > 0)
      for (let s = 20; s <= 680; s += 24) {
        const p = getPos(s);
        const qx = p.x + p.rx * 11.2, qz = p.z + p.rz * 11.2;
        if (degage(qx, qz, 2.2)) {
          add({ shape: 'box', p: [qx, 0.4, qz], s: [24.5, 3.2, 4.4], r: [0, -p.cap, 0], mat: 23, color: [0.82, 0.79, 0.72] }, true, qx, qz);
        }
      }
      // Pontons bois dans le bassin du Vieux-Port
      for (let s = 70; s <= 620; s += 110) {
        const p = getPos(s);
        const px = p.x + p.rx * 36, pz = p.z + p.rz * 36;
        if (degage(px, pz, 12)) {
          add({ shape: 'box', p: [px, NIVEAU_MER + 0.35, pz], s: [2.4, 0.35, 44], r: [0, -p.cap, 0], mat: 26, color: [0.46, 0.34, 0.22] }, false, px, pz);
        }
      }
      // 28 voiliers et yachts du Vieux-Port (strictement dans l'eau d >= 18 m)
      const nbBateaux = isLow ? 10 : 28;
      for (let b = 0; b < nbBateaux; b++) {
        const s = 35 + (b / nbBateaux) * 640 + (hache(b, 91) - 0.5) * 14;
        const p = getPos(s);
        const dist = 20 + hache(b, 113) * 58;
        const bx = p.x + p.rx * dist, bz = p.z + p.rz * dist;
        if (!degage(bx, bz, 10)) continue;
        const long = 7.5 + hache(b, 127) * 6.0;
        const yaw = -p.cap + (b % 2 === 0 ? PI * 0.5 : -PI * 0.5) + (hache(b, 149) - 0.5) * 0.22;
        bateau(bx, bz, yaw, long, hache(b, 157) > 0.25, b * 19 + graine);
      }

      // Façades provençales du Quai de Rive-Neuve (côté TERRE d < 0)
      for (let s = 20; s <= 740; s += isLow ? 34 : 21) {
        const p = getPos(s);
        const dist = 21 + hache(s, 31) * 5;
        const mx = p.x - p.rx * dist, mz = p.z - p.rz * dist;
        if (!degage(mx, mz, 9)) continue;
        const L = 14 + hache(s, 41) * 5;
        const H = 10 + hache(s, 53) * 6;
        const P = 10 + hache(s, 67) * 4;
        immeubleProvencal(mx, mz, -p.cap, L, H, P, s + graine, true);
      }
    }

    // 2. FORT SAINT-NICOLAS & PALAIS DU PHARO (s = 820..1280)
    {
      const pFort = getPos(960);
      const fx = pFort.x + pFort.rx * 38, fz = pFort.z + pFort.rz * 38;
      if (degage(fx, fz, 18)) {
        const fy = solMin5(fx, fz, 12);
        add({ shape: 'box', p: [fx, fy + 4.5, fz], s: [56, 13, 24], r: [0, -pFort.cap, 0], mat: 23, color: [0.80, 0.74, 0.58] }, true, fx, fz);
        for (const k of [-24, 24]) {
          const tx = fx + pFort.tx * k, tz = fz + pFort.tz * k;
          add({ shape: 'cylinder', p: [tx, fy + 6.5, tz], s: [5.5, 16, 5.5], r: [0, 0, 0], mat: 23, color: [0.78, 0.72, 0.56] }, true, tx, tz);
        }
      }
      // Palais du Pharo surplombant l'entrée du Vieux-Port
      const pPh = getPos(1160);
      const px = pPh.x + pPh.rx * 44, pz = pPh.z + pPh.rz * 44;
      if (degage(px, pz, 20)) {
        const py = solMin5(px, pz, 12);
        add({ shape: 'box', p: [px, py + 4.5, pz], s: [42, 11, 16], r: [0, -pPh.cap + 0.18, 0], mat: 23, color: [0.86, 0.79, 0.64] }, true, px, pz);
        add({ shape: 'bevel', p: [px, py + 11.2, pz], s: [43, 3.2, 17], r: [0, -pPh.cap + 0.18, 0], mat: 22, color: [0.32, 0.35, 0.40] }, true, px, pz);
      }
    }

    // 3. VIADUC DU VALLON DES AUFFES (c.ponts[0]) — Parapets pierre, arches maçonnées sous tablier, cabanons & pointus
    if (c.ponts && c.ponts[0]) {
      const p = c.ponts[0];
      const lenPont = Math.max(20, p.fin - p.debut);
      const nSeg = Math.max(4, Math.ceil(lenPont / 10));
      const segLen = lenPont / nSeg;

      // Garde-corps / parapets en pierre de taille suivant parfaitement le tablier
      for (let si = 0; si < nSeg; si++) {
        const pos = getPos(p.debut + (si + 0.5) * segLen);
        const anglesPont = B.decor && B.decor.angles
          ? B.decor.angles(...B.decor.base([pos.tx, c.pente[pos.idx] || 0, pos.tz], [0, 1, 0]))
          : [0, -pos.cap, 0];
        for (const cote of [-1, 1]) {
          const gx = pos.x + pos.rx * (w + 0.58) * cote;
          const gz = pos.z + pos.rz * (w + 0.58) * cote;
          const par = { shape: 'box', p: [gx, pos.y + 0.55, gz], s: [segLen + 0.2, 1.15, 0.42], r: anglesPont, mat: 23, color: [0.84, 0.80, 0.72] };
          add(par, true, gx, gz);
          if (B.decor && B.decor.marquerSolide) B.decor.marquerSolide(par, 'muret', 2);
        }
        // Corniche pierre sous le tablier (strictement sous pos.y - 0.55)
        add({ shape: 'box', p: [pos.x, pos.y - 0.95, pos.z], s: [segLen + 0.25, 0.95, c.largeur + 1.4], r: anglesPont, mat: 23, color: [0.80, 0.76, 0.68] }, true, pos.x, pos.z);
      }

      // 4 piles monumentales en pierre strictement SOUS le tablier (plongeant dans la crique)
      const nPiles = 4;
      for (let pp = 0; pp < nPiles; pp++) {
        const pos = getPos(p.debut + (pp + 0.5) * (lenPont / nPiles));
        const topY = pos.y - 1.1;
        const botY = -5.5;
        const hPile = topY - botY;
        const pile = { shape: 'box', p: [pos.x, (topY + botY) * 0.5, pos.z], s: [4.2, hPile, c.largeur + 1.8], r: [0, -pos.cap, 0], mat: 23, color: [0.78, 0.74, 0.65] };
        add(pile, true, pos.x, pos.z);
        // Chapiteaux / retombées d'arches latérales (sous le tablier)
        if (!isLow) {
          for (const sens of [-1, 1]) {
            const ax = pos.x + pos.tx * sens * 4.5, az = pos.z + pos.tz * sens * 4.5;
            add({ shape: 'bevel', p: [ax, topY - 2.6, az], s: [5.5, 4.4, c.largeur + 0.8], r: [0, -pos.cap, 0], mat: 23, color: [0.76, 0.72, 0.63] }, false, ax, az);
          }
        }
      }

      // Port de pêche du Vallon des Auffes dans la crique : pointus colorés + cabanons
      const pMid = getPos((p.debut + p.fin) * 0.5);
      for (let b = 0; b < (isLow ? 3 : 7); b++) {
        const cote = b < 4 ? 1 : -1;
        const dist = (cote > 0 ? 16 : 18) + hache(b, 401) * 26;
        const along = (hache(b, 419) - 0.5) * 44;
        const bx = pMid.x + pMid.rx * dist * cote + pMid.tx * along;
        const bz = pMid.z + pMid.rz * dist * cote + pMid.tz * along;
        bateau(bx, bz, -pMid.cap + hache(b, 431) * PI, 5.2 + hache(b, 439) * 2.4, false, b * 31 + 700);
      }
      // Cabanons colorés blottis au ras de l'eau DANS la crique sous le viaduc (jamais sur le haut de falaise)
      const COUL_CAB = [[0.90, 0.55, 0.36], [0.94, 0.86, 0.62], [0.34, 0.68, 0.76], [0.92, 0.72, 0.68]];
      for (let k = 0; k < (isLow ? 2 : 6); k++) {
        const sCab = p.debut + 18 + (k / 5) * (lenPont - 36);
        const pos = getPos(sCab);
        const cote = (k & 1) ? 1 : -1;
        const dist = 24 + hache(k, 509) * 14;
        const cx = pos.x + pos.rx * dist * cote, cz = pos.z + pos.rz * dist * cote;
        if (!degage(cx, cz, 12)) continue;
        const cy = 0.25;
        add({ shape: 'box', p: [cx, cy + 1.8, cz], s: [5.5, 4.6, 4.8], r: [0, -pos.cap, 0], mat: 13.2, color: COUL_CAB[k % COUL_CAB.length] }, false, cx, cz);
        add({ shape: 'bevel', p: [cx, cy + 4.5, cz], s: [6.0, 1.4, 5.3], r: [0, -pos.cap, 0], mat: 23, color: TOITS[k % TOITS.length] }, false, cx, cz);
      }
    }

    // 4. CORNICHE PRÉSIDENT JOHN FITZGERALD KENNEDY (s = 1400..4900)
    // Banc mythique blanc côté mer + lampadaires boules méditerranéens + villas provençales côté terre
    {
      const pont = c.ponts && c.ponts[0];
      // Banc / parapet blanc de la Corniche côté mer (d = +(w + 1.9), segmenté 12 m)
      for (let s = 1520; s < 4880; s += 12) {
        if (pont && s >= pont.debut - 6 && s <= pont.fin + 6) continue;
        const p = getPos(s);
        const bx = p.x + p.rx * (w + 1.95), bz = p.z + p.rz * (w + 1.95);
        if (!degage(bx, bz, 1.3)) continue;
        add({ shape: 'box', p: [bx, p.y + 0.42, bz], s: [12.1, 0.84, 0.56], r: [0, -p.cap, 0], mat: 22, color: [0.90, 0.89, 0.86] }, false, bx, bz);
      }

      // Lampadaires de la promenade (du Vieux-Port jusqu'au Prado) — globes chauds visibles de nuit !
      const pasLampe = isLow ? 88 : 48;
      for (let s = 60; s < c.arrivee + 80; s += pasLampe) {
        if (pont && s >= pont.debut - 4 && s <= pont.fin + 4) continue;
        const p = getPos(s);
        const lx = p.x + p.rx * (w + 2.45), lz = p.z + p.rz * (w + 2.45);
        if (!degage(lx, lz, 1.8)) continue;
        add({ shape: 'cylinder', p: [lx, p.y + 3.1, lz], s: [0.14, 6.2, 0.14], r: [0, 0, 0], mat: 0, color: [0.16, 0.19, 0.22] }, false, lx, lz);
        const gx = lx - p.rx * 0.75, gz = lz - p.rz * 0.75;
        add({ shape: 'box', p: [lx - p.rx * 0.35, p.y + 6.1, lz - p.rz * 0.35], s: [0.10, 0.10, 0.9], r: [0, -p.cap, 0], mat: 0, color: [0.16, 0.19, 0.22] }, false, lx, lz);
        add({ shape: 'sphere', p: [gx, p.y + 6.0, gz], s: [0.46, 0.46, 0.46], r: [0, 0, 0], mat: 5, color: [1.0, 0.88, 0.62], emissive: 1.55 }, false, lx, lz);
      }

      // Villas provençales sur les collines d'Endoume / Malmousque / Roucas-Blanc (côté TERRE d < 0)
      const pasVilla = isLow ? 130 : 62;
      for (let s = 1480; s < 4850; s += pasVilla) {
        const p = getPos(s);
        const nb = isLow ? 1 : 2;
        for (let m = 0; m < nb; m++) {
          const dist = 24 + m * 36 + hache(s + m * 71, 613) * 24;
          const vx = p.x - p.rx * dist, vz = p.z - p.rz * dist;
          if (!degage(vx, vz, 11)) continue;
          const L = 10 + hache(s + m * 17, 631) * 7;
          const H = 6.5 + hache(s + m * 29, 641) * 5.5;
          const P = 8 + hache(s + m * 43, 653) * 4;
          immeubleProvencal(vx, vz, -p.cap + (hache(s + m, 661) - 0.5) * 0.35, L, H, P, s * 3 + m * 47 + graine, m === 0);
        }
      }

      // Rochers calcaires côtiers des calanques (côté mer & pied de falaise, zéro octaèdre symétrique)
      if (!isLow) {
        for (let r = 0; r < 68; r++) {
          const s = 900 + hache(r, 701) * 4050;
          const p = getPos(s);
          const dist = 19 + hache(r, 709) * 34;
          const rx = p.x + p.rx * dist, rz = p.z + p.rz * dist;
          if (!degage(rx, rz, 8)) continue;
          const ry = solMin5(rx, rz, 3.5);
          if (ry < NIVEAU_MER - 1.2) continue;
          const t = 2.0 + hache(r, 719) * 4.5;
          const sx = t * (0.85 + hache(r, 727) * 0.65);
          const sy = t * (0.45 + hache(r, 733) * 0.45);
          const sz = t * (0.80 + hache(r, 739) * 0.60);
          add({
            shape: rocheForme(graine ^ Math.imul(r + 7, 1597334677)),
            p: [rx, ry + sy * 0.14 - 0.45, rz],
            s: [sx, sy, sz],
            r: [(hache(r, 743) - 0.5) * 0.3, hache(r, 751) * PI * 2, (hache(r, 757) - 0.5) * 0.3],
            mat: 23,
            color: [0.80 + hache(r, 761) * 0.08, 0.77 + hache(r, 769) * 0.08, 0.70 + hache(r, 773) * 0.07]
          }, true, rx, rz);
        }
      }
    }

    // 5. NOTRE-DAME DE LA GARDE ([-193, H, 1347]) — La Bonne Mère dominant toute la baie de Marseille !
    {
      const nd = c.marseille && c.marseille.ndlg ? c.marseille.ndlg : { x: -193, z: 1347, y: 148 };
      const yBase = terr ? terr.sol(nd.x, nd.z) : nd.y;
      const yawND = 0.42; // orientée vers la mer / le Vieux-Port
      const cos = Math.cos(yawND), sin = Math.sin(yawND);
      const pt = (lx, ly, lz) => [nd.x + cos * lx - sin * lz, yBase + ly, nd.z + sin * lx + cos * lz];

      // Bastion fortifié en pierre calcaire ancré profondément dans le sommet
      add({ shape: 'box', p: pt(0, 2.0, 0), s: [58, 22, 36], r: [0, -yawND, 0], mat: 23, color: [0.84, 0.80, 0.72] }, true, nd.x, nd.z);
      add({ shape: 'box', p: pt(0, 14.2, 0), s: [48, 3.2, 28], r: [0, -yawND, 0], mat: 22, color: [0.88, 0.85, 0.78] }, true, nd.x, nd.z);
      // Nef romano-byzantine rayée blanc calcaire & vert/gris sombre
      const yNef = 15.8;
      for (let b = 0; b < 5; b++) {
        const col = b % 2 === 0 ? [0.92, 0.90, 0.85] : [0.32, 0.37, 0.35];
        add({ shape: 'box', p: pt(3, yNef + b * 2.8 + 1.4, 0), s: [34, 2.82, 16], r: [0, -yawND, 0], mat: 23, color: col }, true, nd.x, nd.z);
      }
      // Coupoles byzantines sur la nef
      for (const lx of [-5, 5, 14]) {
        add({ shape: 'sphere', p: pt(lx, yNef + 14.5, 0), s: [9.5, 7.2, 9.5], r: [0, 0, 0], mat: 23, color: [0.78, 0.76, 0.72] }, true, nd.x, nd.z);
      }
      // Clocher carré monumental (hauteur totale +40 m au-dessus du bastion)
      const yCl = yNef + 16;
      for (let b = 0; b < 6; b++) {
        const col = b % 2 === 0 ? [0.93, 0.91, 0.86] : [0.30, 0.35, 0.33];
        add({ shape: 'box', p: pt(-13, yNef + b * 5.2 + 2.6, 0), s: [10.4, 5.22, 10.4], r: [0, -yawND, 0], mat: 23, color: col }, true, nd.x, nd.z);
      }
      // Beffroi & piédestal octogonal
      add({ shape: 'cylinder', p: pt(-13, yCl + 20, 0), s: [7.2, 10.5, 7.2], r: [0, 0, 0], mat: 23, color: [0.90, 0.88, 0.82] }, true, nd.x, nd.z);
      // LA BONNE MÈRE DORÉE (statue monumentale 12 m brillante visible de partout jour et nuit !)
      const yStat = yCl + 25.5;
      const or = [1.0, 0.84, 0.20];
      add({ shape: 'cylinder', p: pt(-13, yStat + 4.8, 0), s: [2.6, 9.6, 2.6], r: [0, 0, 0], mat: 0, color: or, emissive: 1.05 }, true, nd.x, nd.z);
      add({ shape: 'sphere', p: pt(-13, yStat + 10.6, 0), s: [2.4, 2.8, 2.4], r: [0, 0, 0], mat: 0, color: or, emissive: 1.25 }, true, nd.x, nd.z);
      add({ shape: 'sphere', p: pt(-11.4, yStat + 8.6, 0.6), s: [1.5, 2.1, 1.5], r: [0, 0, 0], mat: 0, color: or, emissive: 1.15 }, true, nd.x, nd.z);
    }

    // 6. ÎLES DU FRIOUL & CHÂTEAU D'IF au large de la baie (horizon authentique)
    {
      const iles = [
        { x: -2920, z: 1680, sx: 140, sy: 26, sz: 105, ifFort: true },
        { x: -3480, z: 1320, sx: 360, sy: 54, sz: 180, ifFort: false },
        { x: -3280, z: 1960, sx: 310, sy: 48, sz: 165, ifFort: false }
      ];
      for (let i = 0; i < iles.length; i++) {
        const il = iles[i];
        add({ shape: rocheForme(graine + i * 97), p: [il.x, il.sy * 0.25 - 2, il.z], s: [il.sx, il.sy, il.sz], r: [0, i * 0.9, 0], mat: 23, color: [0.82, 0.80, 0.74] }, true, il.x, il.z);
        if (il.ifFort) {
          add({ shape: 'box', p: [il.x, il.sy * 0.62 + 5, il.z], s: [32, 16, 28], r: [0, 0.3, 0], mat: 23, color: [0.80, 0.74, 0.60] }, true, il.x, il.z);
          add({ shape: 'cylinder', p: [il.x + 12, il.sy * 0.62 + 12, il.z - 10], s: [8, 22, 8], r: [0, 0, 0], mat: 23, color: [0.82, 0.76, 0.62] }, true, il.x, il.z);
        }
      }
    }

    // 7. PLAGES DU PRADO, PORTIQUE D'ARRIVÉE & STATUE DE DAVID (Rond-Point du David)
    {
      // Parasols & cabines colorées sur les plages du Prado (s = 5050..5680, côté mer)
      if (!isLow) {
        const COUL_P = [[0.06, 0.58, 0.94], [0.96, 0.78, 0.14], [0.92, 0.22, 0.18], [0.96, 0.96, 0.94]];
        for (let k = 0; k < 18; k++) {
          const s = 5060 + k * 34;
          const p = getPos(s);
          const dist = 24 + hache(k, 809) * 24;
          const px = p.x + p.rx * dist, pz = p.z + p.rz * dist;
          if (!degage(px, pz, 12)) continue;
          const py = terr ? terr.sol(px, pz) : 1.0;
          if (py < 0.2) continue;
          add({ shape: 'cylinder', p: [px, py + 1.3, pz], s: [0.12, 2.6, 0.12], r: [0, 0, 0], mat: 0, color: [0.86, 0.86, 0.84] }, false, px, pz);
          add({ shape: 'bevel', p: [px, py + 2.65, pz], s: [3.2, 0.55, 3.2], r: [0, hache(k, 811) * PI, 0], mat: 16, color: COUL_P[k % COUL_P.length] }, false, px, pz);
        }
      }

      // Portique d'arrivée (s = c.arrivee, traverse EN TRAVERS s[2] = 22 m)
      const pArr = getPos(c.arrivee);
      const latA = w + 3.4;
      const a1x = pArr.x + pArr.rx * latA, a1z = pArr.z + pArr.rz * latA;
      const a2x = pArr.x - pArr.rx * latA, a2z = pArr.z - pArr.rz * latA;
      const yTopA = pArr.y + 6.5;
      add({ shape: 'box', p: [a1x, pArr.y + 3.0, a1z], s: [0.85, 7.5, 0.85], r: [0, -pArr.cap, 0], mat: 0, color: [0.22, 0.24, 0.28] }, true, a1x, a1z);
      add({ shape: 'box', p: [a2x, pArr.y + 3.0, a2z], s: [0.85, 7.5, 0.85], r: [0, -pArr.cap, 0], mat: 0, color: [0.22, 0.24, 0.28] }, true, a2x, a2z);
      add({ shape: 'box', p: [pArr.x, yTopA + 0.45, pArr.z], s: [1.05, 1.05, latA * 2 + 1.4], r: [0, -pArr.cap, 0], mat: 1, color: [0.04, 0.54, 0.90] }, true, pArr.x, pArr.z);
      // Damier d'arrivée peint sur l'asphalte
      for (let k = 0; k < 12; k++) {
        for (let rg = 0; rg < 2; rg++) {
          const d = -w + 0.4 + (k + 0.5) * (2 * w - 0.8) / 12;
          const ds = (rg - 0.5) * 1.1;
          add({
            shape: 'box',
            p: [pArr.x + pArr.rx * d + pArr.tx * ds, pArr.y + 0.015, pArr.z + pArr.rz * d + pArr.tz * ds],
            s: [1.1, 0.025, (2 * w - 0.8) / 12],
            r: [0, -pArr.cap, 0],
            mat: 14,
            color: (k + rg) % 2 ? [0.06, 0.06, 0.07] : [0.94, 0.94, 0.92]
          }, false, pArr.x, pArr.z);
        }
      }

      // ROND-POINT DU DAVID & STATUE DE DAVID (monument iconique de marbre blanc face à la mer !)
      // Placé juste après la ligne d'arrivée côté droit/mer (d = +20 m → 100 % dégagé de la zone de décélération !)
      const pDav = getPos(Math.min(c.longueur - 40, c.arrivee + 56));
      const dx = pDav.x + pDav.rx * 20.5, dz = pDav.z + pDav.rz * 20.5;
      if (degage(dx, dz, 9)) {
        const dy = Math.max(2.0, solMin5(dx, dz, 6));
        const aD = pDav.cap - 0.35;
        const yawD = -aD;
        const marbre = [0.95, 0.94, 0.91];
        const socleC = [0.89, 0.87, 0.82];
        // Esplanade circulaire + bassin bleu méditerranéen
        add({ shape: 'cylinder', p: [dx, dy + 0.25, dz], s: [16.5, 1.8, 16.5], r: [0, 0, 0], mat: 22, color: socleC }, true, dx, dz);
        add({ shape: 'cylinder', p: [dx, dy + 1.18, dz], s: [13.2, 0.24, 13.2], r: [0, 0, 0], mat: 12, color: [0.06, 0.48, 0.66] }, true, dx, dz);
        // Piédestal monumental à degrés en pierre blanche
        add({ shape: 'box', p: [dx, dy + 2.3, dz], s: [5.2, 2.2, 5.2], r: [0, yawD, 0], mat: 22, color: socleC }, true, dx, dz);
        add({ shape: 'box', p: [dx, dy + 4.8, dz], s: [3.2, 3.0, 3.2], r: [0, yawD, 0], mat: 23, color: [0.92, 0.91, 0.88] }, true, dx, dz);
        add({ shape: 'box', p: [dx, dy + 6.45, dz], s: [3.7, 0.42, 3.7], r: [0, yawD, 0], mat: 22, color: socleC }, true, dx, dz);
        // Statue de David (5.8 m de marbre blanc lumineux : jambes contrapposto, torse, épaules, bras, tête)
        const yS = dy + 6.66;
        const cs = Math.cos(aD), sn = Math.sin(aD);
        const dp = (lx, ly, lz) => [dx + cs * lx - sn * lz, yS + ly, dz + sn * lx + cs * lz];
        // Jambe d'appui + jambe fléchie
        add({ shape: 'cylinder', p: dp(0, 1.35, -0.34), s: [0.56, 2.7, 0.56], r: [0.04, yawD, 0], mat: 23, color: marbre }, true, dx, dz);
        add({ shape: 'cylinder', p: dp(0.14, 1.32, 0.42), s: [0.52, 2.65, 0.52], r: [-0.08, yawD, 0.12], mat: 23, color: marbre }, true, dx, dz);
        // Bassin & torse athlétique
        add({ shape: 'bevel', p: dp(0, 2.9, 0), s: [0.85, 0.95, 1.32], r: [0, yawD, 0], mat: 23, color: marbre }, true, dx, dz);
        add({ shape: 'bevel', p: dp(0, 4.05, 0), s: [0.92, 1.55, 1.56], r: [0, yawD, 0.04], mat: 23, color: marbre }, true, dx, dz);
        // Bras droit le long du corps, bras gauche replié à l'épaule (fronde)
        add({ shape: 'cylinder', p: dp(-0.08, 3.7, -0.95), s: [0.36, 1.75, 0.36], r: [0.08, yawD, -0.05], mat: 23, color: marbre }, true, dx, dz);
        add({ shape: 'cylinder', p: dp(0.18, 4.15, 0.92), s: [0.35, 1.15, 0.35], r: [-0.45, yawD, 0.35], mat: 23, color: marbre }, true, dx, dz);
        // Cou et tête sculptée tournée vers la mer
        add({ shape: 'cylinder', p: dp(0, 4.95, 0), s: [0.42, 0.45, 0.42], r: [0, yawD, 0], mat: 23, color: marbre }, true, dx, dz);
        add({ shape: 'sphere', p: dp(0.05, 5.55, 0.05), s: [0.88, 1.02, 0.84], r: [0, yawD + 0.4, 0], mat: 23, color: marbre }, true, dx, dz);
        // 4 projecteurs monumentaux chauds illuminant le David de nuit
        for (let l = 0; l < 4; l++) {
          const ang = yawD + l * PI * 0.5 + 0.4;
          add({ shape: 'sphere', p: [dx + Math.cos(ang) * 4.4, dy + 1.5, dz + Math.sin(ang) * 4.4], s: [0.42, 0.42, 0.42], r: [0, 0, 0], mat: 5, color: [1.0, 0.92, 0.72], emissive: 1.85 }, false, dx, dz);
        }
      }
    }

    // 8. PINS PARASOLS & CYPRÈS MÉDITERRANÉENS (collines, Parc Valmer, Promenade du Prado — strictement sur terre y > 1.8 m)
    if (B.botanique && typeof B.botanique.nomForme === 'function' && ajouter) {
      const qArbre = qualite === 'low' ? 'low' : qualite === 'high' || qualite === 'ultra' ? 'high' : 'medium';
      const pasArbre = isLow ? 72 : 34;
      for (let s = 780; s < c.longueur - 80; s += pasArbre) {
        const p = getPos(s);
        const nb = isLow ? 2 : 5;
        for (let m = 0; m < nb; m++) {
          const h1 = hache(Math.round(s) + m * 31, graine + 17);
          const h2 = hache(Math.round(s) + m * 59, graine + 43);
          const h3 = hache(Math.round(s) + m * 83, graine + 71);
          // Principalement côté terre (-1), et côté Prado (s > 4950) des deux côtés
          const cote = (s > 4950 && m === 0) ? 1 : -1;
          const dist = 19 + h1 * 95;
          const wx = p.x + p.rx * dist * cote + (h2 - 0.5) * 22;
          const wz = p.z + p.rz * dist * cote + (h3 - 0.5) * 22;
          const qr = _queryRoute(gr, wx, wz);
          if (qr.absD < 16) continue;
          const wy = solMin5(wx, wz, 3.5);
          if (wy < 1.8) continue; // jamais dans la mer !
          const hL = terr ? terr.sol(wx - 4, wz) : wy, hR = terr ? terr.sol(wx + 4, wz) : wy;
          const hD = terr ? terr.sol(wx, wz - 4) : wy, hU = terr ? terr.sol(wx, wz + 4) : wy;
          if (Math.hypot((hL - hR) / 8, (hD - hU) / 8) > 0.65) continue;

          const estCypres = h3 > 0.76;
          const estPin = !estCypres && h3 > 0.42;
          const essence = estCypres ? 'conifere' : estPin ? 'pin' : 'feuillu';
          const taille = (estCypres ? 11.0 : estPin ? 11.5 : 9.8) + h2 * 5.2;
          const rL = taille * (estCypres ? 0.36 : estPin ? 0.92 : 0.88);
          const col = estCypres
            ? [0.10 + h2 * 0.04, 0.24 + h3 * 0.05, 0.09 + h1 * 0.03]
            : estPin
              ? [0.15 + h2 * 0.06, 0.33 + h3 * 0.07, 0.12 + h1 * 0.04]
              : [0.18 + h2 * 0.06, 0.36 + h3 * 0.06, 0.14 + h1 * 0.04];
          const tronc = { shape: 'cylinder', p: [wx, wy + taille * 0.22 - 0.55, wz], s: [0.42, taille * 0.52 + 1.1, 0.42], r: [0, 0, 0], mat: 26, color: [0.34, 0.22, 0.14] };
          const oProche = { shape: B.botanique.nomForme(essence, false, qArbre), p: [wx, wy + taille * 0.62 - 0.4, wz], s: [rL, taille * 0.72, rL], r: [0, h1 * PI * 2, 0], mat: 27, color: col };
          const oLoin = { shape: B.botanique.nomForme(essence, true, qArbre), p: [wx, wy + taille * 0.62 - 0.4, wz], s: [rL, taille * 0.72, rL], r: [0, h1 * PI * 2, 0], mat: 27, color: col };
          ajouter([tronc, oProche], [oLoin], wx, wz);
        }
      }
    }

    const posPort = getPos(80);
    const posViaduc = getPos(c.ponts && c.ponts[0] ? (c.ponts[0].debut + c.ponts[0].fin) * 0.5 : 2150);
    const posDav = getPos(Math.min(c.longueur - 40, c.arrivee + 56));
    const nd = c.marseille && c.marseille.ndlg ? c.marseille.ndlg : { x: -193, z: 1347, y: 148 };
    const marqueurs = [
      { nom: 'Vieux-Port de Marseille', x: posPort.x, y: posPort.y + 8, z: posPort.z, rayon: 110, hauteur: 42 },
      { nom: 'Viaduc du Vallon des Auffes', x: posViaduc.x, y: posViaduc.y + 10, z: posViaduc.z, rayon: 110, hauteur: 44 },
      { nom: 'Notre-Dame de la Garde', x: nd.x, y: (terr ? terr.sol(nd.x, nd.z) : nd.y) + 46, z: nd.z, rayon: 135, hauteur: 58 },
      { nom: 'Rond-Point du David · Statue de David', x: posDav.x + posDav.rx * 20.5, y: posDav.y + 10, z: posDav.z + posDav.rz * 20.5, rayon: 95, hauteur: 36 }
    ];
    return { objets, marqueurs };
  }

  B.marseilleDecor = { terrain, couperAccotement, poser };
})(globalThis.BITUME = globalThis.BITUME || {});
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.marseilleDecor;
