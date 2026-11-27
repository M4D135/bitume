/* BITUME — occultation par lancer de rayons (horizon du relief + carrosserie du cockpit)
   et suivi fovéal dynamique du regard vers la corde du virage. Zéro allocation en course. */
(function (B) {
  'use strict';

  const NB_RAYONS = 64;
  const PAS_DIST = Float32Array.of(28, 46, 70, 100, 138, 185, 245, 320, 415, 530);
  const N_PAS = PAS_DIST.length;

  function creer(decor) {
    const lots = (decor && decor.lots) || [];
    const nappes = (decor && decor.nappes) || [];
    const sol = (decor && typeof decor.sol === 'function') ? decor.sol : null;

    const nLots = lots.length;
    const lotCx = new Float32Array(nLots);
    const lotCy = new Float32Array(nLots);
    const lotCz = new Float32Array(nLots);
    const lotRayon = new Float32Array(nLots);
    const lotYTop = new Float32Array(nLots);
    const lotEligible = new Uint8Array(nLots);
    const masqueLots = new Uint8Array(nLots);

    for (let i = 0; i < nLots; i++) {
      const L = lots[i] || {};
      const c = L.centre;
      const r = L.rayon;
      let elig = 0;
      let cx = 0, cy = 0, cz = 0, rr = 0, yTop = 0;
      if (c && c.length >= 3 && Number.isFinite(r) && r > 0 && r < 450) {
        cx = c[0]; cy = c[1]; cz = c[2]; rr = r;
        elig = 1;
        yTop = cy + r;
      }
      lotCx[i] = cx; lotCy[i] = cy; lotCz[i] = cz;
      lotRayon[i] = rr; lotYTop[i] = yTop;
      lotEligible[i] = elig;
    }

    const nNappes = nappes.length;
    const nappeCx = new Float32Array(nNappes);
    const nappeCy = new Float32Array(nNappes);
    const nappeCz = new Float32Array(nNappes);
    const nappeRayon = new Float32Array(nNappes);
    const nappeYTop = new Float32Array(nNappes);
    const nappeEligible = new Uint8Array(nNappes);
    const masqueNappes = new Uint8Array(nNappes);

    for (let i = 0; i < nNappes; i++) {
      const N = nappes[i] || {};
      const elig = (N.surfaceType === 'terrain' && !N.horizon) ? 1 : 0;
      let cx = 0, cy = 0, cz = 0, rr = 0, yTop = 0;

      const hasCentre = N.centre && N.centre.length >= 3 &&
        Number.isFinite(N.centre[0]) && Number.isFinite(N.centre[1]) && Number.isFinite(N.centre[2]);
      const hasRayon = Number.isFinite(N.rayon) && N.rayon > 0;

      if (hasCentre && hasRayon) {
        cx = N.centre[0]; cy = N.centre[1]; cz = N.centre[2]; rr = N.rayon;
        yTop = cy + rr;
      } else {
        const sommets = N.sommets;
        if (sommets && sommets.length >= 3) {
          let minX = Infinity, minY = Infinity, minZ = Infinity;
          let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
          const n = sommets.length;
          const pas = n % 13 === 0 ? 13 : 3;
          for (let k = 0; k + 2 < n; k += pas) {
            const x = sommets[k], y = sommets[k + 1], z = sommets[k + 2];
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
          }
          if (minX !== Infinity) {
            cx = (minX + maxX) * 0.5;
            cy = (minY + maxY) * 0.5;
            cz = (minZ + maxZ) * 0.5;
            const ex = (maxX - minX) * 0.5;
            const ey = (maxY - minY) * 0.5;
            const ez = (maxZ - minZ) * 0.5;
            rr = Math.sqrt(ex * ex + ey * ey + ez * ez);
            yTop = maxY;
          }
        }
      }

      nappeCx[i] = cx; nappeCy[i] = cy; nappeCz[i] = cz;
      nappeRayon[i] = rr; nappeYTop[i] = yTop;
      nappeEligible[i] = elig;
    }

    return {
      NB_RAYONS,
      PAS_DIST,
      pentes: new Float32Array(NB_RAYONS * N_PAS),
      fovea: new Float32Array([0.5, 0.52, 0.20, 0.64]),
      directionRegard: new Float32Array([0, -1]),
      cible: { x: 0, y: 0, z: 0, cap: 0, pente: 0, devers: 0, courbure: 0 },
      stats: { lotsOccultes: 0, nappesOccultees: 0, lotsTestes: 0 },
      masqueLots,
      masqueNappes,
      lotCx, lotCy, lotCz, lotRayon, lotYTop, lotEligible,
      nappeCx, nappeCy, nappeCz, nappeRayon, nappeYTop, nappeEligible,
      nLots, nNappes,
      sol,
      _rayonsLances: false,
      _azCentre: 0,
      _demiAz: 0
    };
  }

  function calculerFovea(etat, circuit, voitureEtat, cam, aspect, options) {
    if (!etat || !cam || !cam.pos) {
      return (etat && etat.fovea) ? etat.fovea : null;
    }

    const fovea = etat.fovea;
    const dir = etat.directionRegard;

    const yaw = cam.yaw || 0;
    const pitch = cam.pitch || 0;
    const roll = cam.roll || 0;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    const sr = Math.sin(roll), cr = Math.cos(roll);

    const fx = sy * cp, fy = sp, fz = -cy * cp;
    const rx = cy * cr - sy * sp * sr, ry = cp * sr, rz = sy * cr + cy * sp * sr;
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;

    const ox = cam.pos[0], oy = cam.pos[1], oz = cam.pos[2];

    const flen = Math.sqrt(fx * fx + fz * fz);
    if (flen > 1e-6) {
      dir[0] = fx / flen;
      dir[1] = fz / flen;
    }

    if (circuit && B.circuit && typeof B.circuit.echantillon === 'function' &&
        voitureEtat && Number.isFinite(voitureEtat.s)) {
      const avance = Math.max(32, Math.min(145, Math.abs(voitureEtat.v || 0) * 1.38));
      const sens = (voitureEtat.v || 0) < -1 ? -1 : 1;
      const cible = etat.cible;
      B.circuit.echantillon(circuit, voitureEtat.s + sens * avance, cible);

      const dx = cible.x - ox;
      const dy = (cible.y || oy) + 0.85 - oy;
      const dz = cible.z - oz;

      const cx = dx * rx + dy * ry + dz * rz;
      const cyCam = dx * ux + dy * uy + dz * uz;
      const czCam = dx * fx + dy * fy + dz * fz;

      if (czCam > 5) {
        const tanDemi = Math.tan(((cam.fov || 75) * Math.PI) / 360);
        const asp = Math.max(0.5, aspect || 1.77);
        let u = 0.5 + 0.5 * (cx / (czCam * tanDemi * asp));
        let v = 0.5 + 0.5 * (cyCam / (czCam * tanDemi));

        if (u < 0.22) u = 0.22; else if (u > 0.78) u = 0.78;
        if (v < 0.30) v = 0.30; else if (v > 0.72) v = 0.72;

        fovea[0] += (u - fovea[0]) * 0.28;
        fovea[1] += (v - fovea[1]) * 0.28;

        const tx = cible.x - ox, tz = cible.z - oz;
        const tlen = Math.sqrt(tx * tx + tz * tz);
        if (tlen > 1e-6 && flen > 1e-6) {
          const tnx = tx / tlen, tnz = tz / tlen;
          const fnx = fx / flen, fnz = fz / flen;
          const mx = tnx * 0.65 + fnx * 0.35;
          const mz = tnz * 0.65 + fnz * 0.35;
          const mlen = Math.sqrt(mx * mx + mz * mz);
          if (mlen > 1e-6) {
            dir[0] = mx / mlen;
            dir[1] = mz / mlen;
          }
        }
      }
    } else {
      fovea[0] += (0.5 - fovea[0]) * 0.28;
      fovea[1] += (0.52 - fovea[1]) * 0.28;
    }

    fovea[2] = (options && options.rInterne != null) ? options.rInterne : 0.20;
    fovea[3] = (options && options.rExterne != null) ? options.rExterne : 0.64;

    return fovea;
  }

  function occulter(etat, cam, aspect, options) {
    if (!etat) return etat;

    const masqueLots = etat.masqueLots;
    const masqueNappes = etat.masqueNappes;
    masqueLots.fill(0);
    masqueNappes.fill(0);
    etat.stats.lotsOccultes = 0;
    etat.stats.nappesOccultees = 0;
    etat.stats.lotsTestes = 0;

    if (!cam || !cam.pos || (options && options.actif === false)) {
      return etat;
    }

    const yaw = cam.yaw || 0;
    const pitch = cam.pitch || 0;
    const roll = cam.roll || 0;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    const sr = Math.sin(roll), cr = Math.cos(roll);

    const fx = sy * cp, fy = sp, fz = -cy * cp;
    const rx = cy * cr - sy * sp * sr, ry = cp * sr, rz = sy * cr + cy * sp * sr;
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;

    const ox = cam.pos[0], oy = cam.pos[1], oz = cam.pos[2];

    const tanDemi = Math.tan(((cam.fov || 75) * Math.PI) / 360);
    const asp = Math.max(0.5, aspect || 1.77);

    const enCockpit = !!(options && options.vue === 'cockpit') &&
      Math.abs(roll) < 0.26 && Math.abs(pitch) < 0.35;
    const sousCouvert = !!(options && options.sousCouvert);
    const sol = etat.sol;

    let rayonsLances = false;
    let azCentre = 0, demiAz = 0;
    const pentes = etat.pentes;

    if (typeof sol === 'function' && !sousCouvert && oy < sol(ox, oz) + 85) {
      azCentre = Math.atan2(fx, -fz);
      demiAz = Math.min(1.42, Math.atan(tanDemi * asp) + 0.20);
      const pasAz = (2 * demiAz) / NB_RAYONS;

      for (let b = 0; b < NB_RAYONS; b++) {
        const az = azCentre - demiAz + (b + 0.5) * pasAz;
        const dxR = Math.sin(az);
        const dzR = -Math.cos(az);
        let maxP = -Infinity;
        for (let s = 0; s < N_PAS; s++) {
          const d = PAS_DIST[s];
          const h = sol(ox + dxR * d, oz + dzR * d) - 3.0;
          const pente = (h - oy) / d;
          if (s === 0 || pente > maxP) maxP = pente;
          pentes[b * N_PAS + s] = maxP;
        }
      }
      rayonsLances = true;
    }

    etat._rayonsLances = rayonsLances;
    etat._azCentre = azCentre;
    etat._demiAz = demiAz;

    function testSphere(cx, cy, cz, r, yTop) {
      const dx = cx - ox, dy = cy - oy, dz = cz - oz;
      const distXZ = Math.hypot(dx, dz);
      const distProche = distXZ - r;

      if (distProche < 96) return 0;

      const czCam = dx * fx + dy * fy + dz * fz;
      if (czCam + r <= 0) return 0;

      if (enCockpit && czCam - r > 40) {
        const cyMax = dx * ux + dy * uy + dz * uz + r;
        const cxAbs = Math.abs(dx * rx + dy * ry + dz * rz) + r;
        if (cyMax < -0.58 * (czCam - r) * tanDemi &&
            cxAbs < 0.52 * (czCam - r) * tanDemi * asp) {
          return 1;
        }
      }

      if (!rayonsLances) return 0;

      let s = -1;
      for (let k = N_PAS - 1; k >= 0; k--) {
        if (PAS_DIST[k] <= distProche - 20) { s = k; break; }
      }
      if (s < 0) return 0;

      let dAz = Math.atan2(dx, -dz) - azCentre;
      while (dAz > Math.PI) dAz -= 2 * Math.PI;
      while (dAz < -Math.PI) dAz += 2 * Math.PI;

      const ouv = Math.asin(Math.min(0.99, r / distXZ)) + 0.025;
      const u0 = (dAz - ouv + demiAz) / (2 * demiAz) * NB_RAYONS;
      const u1 = (dAz + ouv + demiAz) / (2 * demiAz) * NB_RAYONS;

      if (u0 < 0 || u1 >= NB_RAYONS) return 0;

      const b0 = Math.max(0, u0 | 0);
      const b1 = Math.min(NB_RAYONS - 1, u1 | 0);

      let minPenteHorizon = Infinity;
      for (let b = b0; b <= b1; b++) {
        const p = pentes[b * N_PAS + s];
        if (p < minPenteHorizon) minPenteHorizon = p;
      }

      const penteSommetObjet = (yTop + 4.0 - oy) / distProche;
      if (penteSommetObjet < minPenteHorizon) return 1;
      return 0;
    }

    const lotCx = etat.lotCx, lotCy = etat.lotCy, lotCz = etat.lotCz;
    const lotRayon = etat.lotRayon, lotYTop = etat.lotYTop, lotEligible = etat.lotEligible;
    for (let i = 0; i < etat.nLots; i++) {
      if (lotEligible[i]) {
        etat.stats.lotsTestes++;
        if (testSphere(lotCx[i], lotCy[i], lotCz[i], lotRayon[i], lotYTop[i])) {
          masqueLots[i] = 1;
          etat.stats.lotsOccultes++;
        }
      }
    }

    const nappeCx = etat.nappeCx, nappeCy = etat.nappeCy, nappeCz = etat.nappeCz;
    const nappeRayon = etat.nappeRayon, nappeYTop = etat.nappeYTop, nappeEligible = etat.nappeEligible;
    for (let i = 0; i < etat.nNappes; i++) {
      if (nappeEligible[i]) {
        if (testSphere(nappeCx[i], nappeCy[i], nappeCz[i], nappeRayon[i], nappeYTop[i])) {
          masqueNappes[i] = 1;
          etat.stats.nappesOccultees++;
        }
      }
    }

    return etat;
  }

  B.visibiliteRaycast = { creer, calculerFovea, occulter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = B.visibiliteRaycast;
  }
})(globalThis.BITUME = globalThis.BITUME || {});
