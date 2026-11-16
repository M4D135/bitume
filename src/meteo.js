(function (B) {
  'use strict';
  // BITUME : pluie volumique projetée en 2D, sans nouvelle passe du moteur.
  // EMPRISE inspire les graines stables, les rafales et le mouillage ; voir docs/METEO.md.
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const modulo = (x, n) => x - Math.floor(x / n) * n;
  const PHASES = ['clair', 'couvre', 'pluie', 'orage'];
  const DUREES = [26, 12, 22, 16], PLUIE = [0, 0, .75, 1], NUAGES = [.12, .6, .85, 1];
  function hasard(n) {
    n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function avancer(S, dt) {
    const m = S.meteo || (S.meteo = { t: 0, phase: 'clair', tp: 0, pluie: 0, nuage: .12,
      eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9 });
    if (!(dt > 0) || !Number.isFinite(dt)) return m;
    const fixe = m.fixe === true;
    let reste = Math.min(.1, dt);
    if (!Number.isFinite(m.mouille)) m.mouille = 0;
    // Découper aux frontières conserve le reliquat et la même évolution à 30, 60 et 120 Hz.
    while (reste > 1e-12) {
      const p = Math.max(0, PHASES.indexOf(m.phase));
      const pas = fixe ? reste : Math.min(reste, Math.max(0, DUREES[p] - m.tp));
      const k = -Math.expm1(-pas / 2.5), anciennePluie = m.pluie;
      m.pluie += (PLUIE[p] - m.pluie) * k;
      m.nuage += (NUAGES[p] - m.nuage) * k;
      // Intégrale de la pluie pendant le pas (pas une somme dépendant du nombre d'images).
      const eau = PLUIE[p] * pas + (anciennePluie - PLUIE[p]) * 2.5 * k;
      const sechage = PLUIE[p] > 0 ? .004 : .012;
      m.mouille = clamp(m.mouille + eau * .039 - pas * sechage, 0, 1);
      m.t += pas; m.tp += pas; reste -= pas;
      m.eclair = Math.max(0, m.eclair - pas * 6);
      if (p === 3 && m.prochainEclair > 0 && m.t + 1e-10 >= m.prochainEclair) {
        const frappe = m.prochainEclair;
        m.eclair = Math.max(0, 1 - (m.t - frappe) * 6);
        m.prochainEclair = frappe + 2.8 + hasard(Math.round(frappe * 1000)) * 4.2;
      }
      if (!fixe && m.tp + 1e-10 >= DUREES[p]) {
        m.tp = 0; m.phase = PHASES[(p + 1) % PHASES.length];
        if (m.phase === 'orage') m.prochainEclair = m.t + 1.2;
      }
    }
    m.ventX = 1.8 + .9 * Math.sin(m.t * .61) + .5 * Math.sin(m.t * 1.47);
    m.ventZ = .55 + .35 * Math.cos(m.t * .43);
    return m;
  }
  function ambiance(m) {
    // Humidité résiduelle = brume légère ; aucun reflet de sol n'est simulé par cet overlay.
    return { pluie: Math.max(m.pluie * .72, (m.mouille || 0) * .14), nuage: m.nuage * .86,
      eclair: m.eclair * .30, mouille: m.mouille || 0, ventX: m.ventX || 0, ventZ: m.ventZ || 0 };
  }

  const N = 840, LARGEUR = 48, HAUTEUR = 18, EXPOSITION = 1 / 90;
  function creerPluie(canvas) {
    const ctx = canvas && canvas.getContext('2d');
    const graines = new Float64Array(N * 4), segments = new Float32Array(N * 4);
    const lots = new Uint8Array(N), stats = { candidats: 0, visibles: 0, traits: 0, lots: 0 };
    for (let i = 0; i < N; i++) {
      graines[i * 4] = hasard(i * 4 + 1) * LARGEUR;
      graines[i * 4 + 1] = hasard(i * 4 + 2) * HAUTEUR;
      graines[i * 4 + 2] = hasard(i * 4 + 3) * LARGEUR;
      graines[i * 4 + 3] = 12 + hasard(i * 4 + 4) * 4;
    }
    let px = 0, py = 0, pz = 0, ancienYaw = 0, vx = 0, vy = 0, vz = 0, precedente = false;
    function dessiner(m, cam, dt, options = {}) {
      stats.candidats = stats.visibles = stats.traits = stats.lots = 0;
      if (!ctx || !cam) return stats;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!(w > 0 && h > 0)) return stats;
      const dpr = clamp(options.dpr || 1, 1, 1.5);
      const largeur = Math.round(w * dpr), hauteur = Math.round(h * dpr);
      if (canvas.width !== largeur || canvas.height !== hauteur) { canvas.width = largeur; canvas.height = hauteur; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const pos = cam.pos, yaw = cam.yaw || 0, pitch = cam.pitch || 0, roll = cam.roll || 0;
      if (dt > 0 && precedente) {
        const dx = pos[0] - px, dy = pos[1] - py, dz = pos[2] - pz;
        const distance = Math.hypot(dx, dy, dz), virage = Math.abs(Math.atan2(Math.sin(yaw - ancienYaw), Math.cos(yaw - ancienYaw)));
        // Une coupe de caméra ne devient pas une rafale. La pause conserve le dernier flou de mouvement.
        if (distance > 20 || distance / dt > 150 || virage > .7) vx = vy = vz = 0;
        else { vx = dx / dt; vy = dy / dt; vz = dz / dt; }
      }
      if (dt > 0 || !precedente) { px = pos[0]; py = pos[1]; pz = pos[2]; ancienYaw = yaw; precedente = true; }
      const pluie = clamp(m.pluie || 0, 0, 1);
      if (pluie < .025) return stats;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      // Convention exacte FERRO (projection verticale, y vers le haut).
      const rx = cy * cr - sy * sp * sr, ry = cp * sr, rz = sy * cr + cy * sp * sr;
      const ux = -sy * sp * cr - cy * sr, uy = cp * cr, uz = cy * sp * cr - sy * sr;
      const fx = sy * cp, fy = sp, fz = -cy * cp;
      const focale = h / (2 * Math.tan(clamp(cam.fov || 60, 10, 110) * Math.PI / 360));
      const t = m.t || 0;
      // Intégrales analytiques du vent, sans saut lorsque sa vitesse change.
      const ventX = 1.8 + .9 * Math.sin(t * .61) + .5 * Math.sin(t * 1.47), ventZ = .55 + .35 * Math.cos(t * .43);
      const deriveX = 1.8 * t + .9 / .61 * (1 - Math.cos(t * .61)) + .5 / 1.47 * (1 - Math.cos(t * 1.47));
      const deriveZ = .55 * t + .35 / .43 * Math.sin(t * .43);
      const cible = Math.round(N * pluie);
      stats.candidats = cible;
      for (let i = 0; i < cible; i++) {
        const k = i * 4, chute = graines[k + 3];
        // Champ périodique ancré au monde, recentré par cellules autour de la caméra.
        const x = modulo(graines[k] + deriveX - pos[0] + LARGEUR / 2, LARGEUR) - LARGEUR / 2;
        const y = modulo(graines[k + 1] - chute * t - pos[1] + HAUTEUR / 2, HAUTEUR) - HAUTEUR / 2;
        const z = modulo(graines[k + 2] + deriveZ - pos[2] + LARGEUR / 2, LARGEUR) - LARGEUR / 2;
        const profondeur = x * fx + y * fy + z * fz;
        if (profondeur < .8) continue;
        const ex = w * .5 + (x * rx + y * ry + z * rz) * focale / profondeur;
        const ey = h * .5 - (x * ux + y * uy + z * uz) * focale / profondeur;
        if (ex < -20 || ex > w + 20 || ey < -20 || ey > h + 20) continue;
        // Amincissement progressif : planche, mains et route restent dégagées, sans barre de coupure.
        const bas = options.cockpit ? clamp((ey / h - .49) / .37, 0, 1) : 0;
        const masque = 1 - bas * bas * (3 - 2 * bas);
        const proche = clamp((profondeur - .8) / 2, 0, 1);
        const loin = clamp((30 - profondeur) / 10, 0, 1);
        if (hasard(i + 4001) > masque * proche * loin) continue;
        // La vitesse relative produit une vraie expansion à grande vitesse, même droit devant.
        const tx = x - (ventX - vx) * EXPOSITION, ty = y + (chute + vy) * EXPOSITION, tz = z - (ventZ - vz) * EXPOSITION;
        const dp = tx * fx + ty * fy + tz * fz;
        if (dp < .8) continue;
        let dx = w * .5 + (tx * rx + ty * ry + tz * rz) * focale / dp - ex;
        let dy = h * .5 - (tx * ux + ty * uy + tz * uz) * focale / dp - ey;
        const longueur = Math.hypot(dx, dy), maximum = Math.min(18, h * .025);
        if (longueur > maximum) { dx *= maximum / longueur; dy *= maximum / longueur; }
        const j = stats.visibles++, o = j * 4;
        segments[o] = ex; segments[o + 1] = ey; segments[o + 2] = ex + dx; segments[o + 3] = ey + dy;
        lots[j] = profondeur < 8 ? 0 : profondeur < 17 ? 1 : 2;
      }
      ctx.lineCap = 'round';
      for (let lot = 2; lot >= 0; lot--) {
        ctx.lineWidth = lot === 0 ? 1 : lot === 1 ? .75 : .5;
        const alpha = (lot === 0 ? .28 : lot === 1 ? .21 : .14) * (.55 + pluie * .45);
        ctx.strokeStyle = 'rgba(190,210,225,' + alpha + ')'; ctx.beginPath();
        let n = 0;
        for (let j = 0; j < stats.visibles; j++) if (lots[j] === lot) {
          const o = j * 4; ctx.moveTo(segments[o], segments[o + 1]); ctx.lineTo(segments[o + 2], segments[o + 3]); n++;
        }
        if (n) { ctx.stroke(); stats.lots++; stats.traits += n; }
      }
      return stats;
    }
    return { dessiner, stats };
  }
  function initial(graine) {
    const r = hasard((graine >>> 0) + 1);
    const phase = r < 1 / 3 ? 'clair' : r < 2 / 3 ? 'pluie' : 'clair';
    const fixe = r >= 2 / 3 ? false : true;
    // variable (ni soleil ni pluie fixe) : cycle complet, départ clair
    const phaseFinale = fixe ? phase : 'clair';
    const idx = Math.max(0, PHASES.indexOf(phaseFinale));
    return { t: 0, phase: phaseFinale, tp: 0, pluie: PLUIE[idx], nuage: NUAGES[idx],
      eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9, fixe };
  }
  function pour(mode) {
    if (mode === 'soleil') return { t: 0, phase: 'clair', tp: 0, pluie: 0, nuage: .12, eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9, fixe: true };
    if (mode === 'pluie') return { t: 0, phase: 'pluie', tp: 0, pluie: .75, nuage: .85, eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9, fixe: true };
    if (mode === 'variable') return { t: 0, phase: 'clair', tp: 0, pluie: 0, nuage: .12, eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9, fixe: false };
    return null;
  }
  B.meteo = { avancer, ambiance, creerPluie, initial, pour };
})(globalThis.BITUME = globalThis.BITUME || {});
