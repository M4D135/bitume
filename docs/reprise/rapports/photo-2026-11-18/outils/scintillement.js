(async () => {
  // Lot 21 : indice de scintillement des ombres. Après chaque image, lecture de régions de l'image finale ; pour chaque
  // pixel, on suit sa luminance d'une image à l'autre. d1 = variation moyenne entre deux images ; d2 = écart à la droite
  // passant par les voisines (une dérive lente de l'éclairage s'annule, un aller-retour reste) ; allers-retours = part
  // des pixels qui montent puis redescendent (ou l'inverse) d'au moins 4 niveaux sur 255 en deux images.
  const J = BITUME_JEU, B = globalThis.BITUME;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const REF = __REF__;
  J.reference(REF);
  let info = {};
  const viser = (pos, cible, fov) => { const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2];
    return { pos, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fov }; };
  const c = J.scene.c, d = J.scene.decor;
  const ech = s => B.circuit.echantillon(c, ((s % c.longueur) + c.longueur) % c.longueur);
  const sol = (x, z, y) => { const h = d.sol ? d.sol(x, z) : null; return Number.isFinite(h) ? h : y; };
  const cote = (s, lateral, hauteur, lacet, tangage, fov) => {
    const e = ech(s), ca = Math.cos(e.cap), sa = Math.sin(e.cap);
    const x = e.x - sa * lateral, z = e.z + ca * lateral;
    return { pos: [x, sol(x, z, e.y) + hauteur, z], yaw: e.cap + Math.PI / 2 + lacet, pitch: tangage, fov };
  };
  __CAM__
  for (const id of ['hud', 'h-fps', 'classement', 'zone-carte', 'message', 'sous-message', 'feux', 'jauge-derive', 'tactile', 'b-pause', 'aide-console']) {
    const el = document.getElementById(id); if (el) el.style.visibility = 'hidden';
  }
  await images(__CHAUFFE__);
  const R = J.rendu, gl = R.gl, orig = R.draw, figer = __FIGER__, retouche = __OVERRIDE__;
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const regions = __REGIONS__.map(([x0, y0, x1, y1]) => {
    const x = Math.round(x0 * W), w = Math.round((x1 - x0) * W), h = Math.round((y1 - y0) * H), y = Math.round((1 - y1) * H);
    return { x, y, w, h, data: new Uint8Array(w * h * 4), seq: [] };
  });
  const N = __N__, temps = [], abscisses = [];
  let t0 = null, k = 0;
  R.draw = function (cam, sortie, fx) {
    if (t0 === null) t0 = fx.time;
    const f = Object.assign({}, fx, retouche, figer ? { time: t0 } : null);
    const r = orig.call(this, cam, sortie, f);
    if (k < N) {
      const avant = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      for (const g of regions) {
        gl.readPixels(g.x, g.y, g.w, g.h, gl.RGBA, gl.UNSIGNED_BYTE, g.data);
        const L = new Float32Array(Math.ceil(g.w / 2) * Math.ceil(g.h / 2));
        let j = 0;
        for (let yy = 0; yy < g.h; yy += 2) for (let xx = 0; xx < g.w; xx += 2) {
          const i = (yy * g.w + xx) * 4; L[j++] = .2126 * g.data[i] + .7152 * g.data[i + 1] + .0722 * g.data[i + 2];
        }
        g.seq.push(L);
      }
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, avant);
      temps.push(performance.now());
      const S = J.session; abscisses.push(S && S.course ? S.course.joueur.etat.s : 0);
    }
    k++;
    return r;
  };
  await images(N + 2);
  R.draw = orig;
  const res = regions.map(g => {
    let d1 = 0, d2 = 0, n1 = 0, n2 = 0, flips = 0, moy = 0;
    const P = g.seq[0].length;
    for (let t = 1; t < g.seq.length; t++) for (let p = 0; p < P; p++) { d1 += Math.abs(g.seq[t][p] - g.seq[t - 1][p]); n1++; }
    for (let t = 1; t < g.seq.length - 1; t++) for (let p = 0; p < P; p++) {
      const a = g.seq[t - 1][p], b = g.seq[t][p], e = g.seq[t + 1][p];
      d2 += Math.abs(b - (a + e) / 2); n2++;
      const u = b - a, v = e - b; if (u * v < 0 && Math.min(Math.abs(u), Math.abs(v)) >= 4) flips++;
    }
    for (const L of g.seq) for (let p = 0; p < P; p++) moy += L[p];
    return { region: [g.x, g.y, g.w, g.h], images: g.seq.length, niveauMoyen: +(moy / (P * g.seq.length)).toFixed(1),
      d1: +(d1 / n1).toFixed(3), d2: +(d2 / n2).toFixed(3), allersRetoursPourMille: +(1000 * flips / n2).toFixed(2) };
  });
  const dt = temps.slice(1).map((v, i) => v - temps[i]), ds = abscisses.slice(1).map((v, i) => v - abscisses[i]).filter(v => v > -100);
  const s = R.stats;
  return { image: W + 'x' + H, atlas: s.shadowMapSize, tuile: s.shadowTileSize, ombres: s.shadows, intervalleMoyenMs: +(dt.reduce((a, b) => a + b, 0) / dt.length).toFixed(1),
    metresParImage: +(ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length)).toFixed(2), info, regions: res };
})()
