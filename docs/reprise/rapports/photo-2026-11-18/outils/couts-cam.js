(async () => {
  // Lot 21 : coût de l'image principale par poste. Chaque image est encadrée par une lecture d'un pixel : le temps mesuré est
  // celui de la soumission plus l'exécution GPU de cette seule image. Les variantes alternent image par image pour
  // annuler la dérive de la scène (la course roule). Rétroviseurs coupés : leur second contexte fausserait l'attente.
  const J = BITUME_JEU;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const REF = __REF__;
  J.reference(REF);
  const B = globalThis.BITUME, c = J.scene.c, d = J.scene.decor;
  const ech = s => B.circuit.echantillon(c, ((s % c.longueur) + c.longueur) % c.longueur);
  const viser = (pos, cible, fov) => { const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2];
    return { pos, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fov }; };
  __CAM__
  await images(90);
  const R = J.rendu, gl = R.gl, orig = R.draw;
  const variantes = __VARIANTES__;
  const t = variantes.map(() => []), lum = variantes.map(() => []);
  const bande = new Uint8Array(64 * 4);
  let k = 0, fxVu = null;
  // gl.finish() ne bloque pas toujours dans Chrome : la lecture d'un pixel de l'image finale force l'attente du GPU.
  const px = new Uint8Array(4);
  const attendre = () => { const avant = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, avant); };
  R.draw = function (cam, sortie, fx) {
    const i = k % variantes.length;
    if (!fxVu) fxVu = { shadows: fx.shadows, bloom: fx.bloom, reflections: fx.reflections, msaa: fx.msaa, shadowMapScale: fx.shadowMapScale };
    const f = Object.assign({}, fx, variantes[i]);
    attendre();
    const t0 = performance.now();
    const r = orig.call(this, cam, sortie, f);
    attendre();
    t[i].push(performance.now() - t0);
    { const avant = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(Math.floor(gl.drawingBufferWidth / 2) - 32, Math.floor(gl.drawingBufferHeight * .6), 64, 1, gl.RGBA, gl.UNSIGNED_BYTE, bande);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, avant); let m = 0; for (let j = 0; j < bande.length; j += 4) m += bande[j] + bande[j + 1] + bande[j + 2]; lum[i].push(m / 192); }
    k++;
    return r;
  };
  await images(variantes.length * 50 + 1);
  R.draw = orig;
  const tri = a => [...a].sort((x, y) => x - y);
  const q = (a, p) => { const s = tri(a); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
  const s = R.stats;
  return { toile: gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight, fxDuJeu: fxVu, msaa: s.msaa, atlasOmbres: s.shadowMapSize, triangles: s.triangles, appels: s.drawCalls,
    variantes: variantes.map((v, i) => ({ v: JSON.stringify(v), n: t[i].length, p50: q(t[i], .5), p90: q(t[i], .9), niveauMoyen: +(lum[i].reduce((a, b) => a + b, 0) / lum[i].length).toFixed(1) })) };
})()
