(async () => {
  // Coût des ombres photo par effet (d'après couts-cam.js du lot 21) : chaque image principale est encadrée par la
  // lecture d'un pixel de l'image finale (soumission + exécution GPU de cette seule image) ; les variantes alternent
  // image par image dans la même séance (la course roule), dans un ordre tiré au hasard par bloc ; rétroviseurs coupés par la référence.
  const J = BITUME_JEU;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const REF = __REF__;
  J.reference(REF);
  const B = globalThis.BITUME, c = J.scene.c, d = J.scene.decor;
  const ech = s => B.circuit.echantillon(c, ((s % c.longueur) + c.longueur) % c.longueur);
  const viser = (pos, cible, fov) => { const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2];
    return { pos, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fov }; };
  let info = {};
  __CAM__
  await images(90);
  const R = J.rendu, gl = R.gl, orig = R.draw;
  const variantes = __VARIANTES__;
  const t = variantes.map(() => []), etats = variantes.map(() => null), appels = variantes.map(() => 0);
  const px = new Uint8Array(4);
  const attendre = () => { const avant = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, avant); };
  // Coût processeur de B.ombres.preparer : les derniers arguments servent ensuite à une boucle de 5000 appels.
  const prep = B.ombres && B.ombres.preparer; let derniers = null;
  if (prep) B.ombres.preparer = function (...a) { derniers = a; return prep.apply(this, a); };
  let k = 0, fxVu = null;
  if (R.resetStats) R.resetStats();
  // Ordre des variantes tiré au hasard dans chaque bloc (chaque variante une fois par bloc) : un travail périodique du
  // jeu (une image sur deux, sur trois…) ne tombe plus toujours sur la même variante (biais de rang de l'alternance stricte).
  const V = variantes.length, ordre = variantes.map((_, j) => j); let place = V;
  const suivante = () => { if (place >= V) { for (let j = V - 1; j > 0; j--) { const r = Math.floor(Math.random() * (j + 1)), x = ordre[j]; ordre[j] = ordre[r]; ordre[r] = x; } place = 0; } return ordre[place++]; };
  R.draw = function (cam, sortie, fx) {
    const i = suivante();
    if (!fxVu) fxVu = { shadows: fx.shadows, bloom: fx.bloom, msaa: fx.msaa, contacts: fx.contacts ? fx.contacts.nombre : null,
      ombreProche: !!fx.ombreProche, penombre: fx.penombre || null };
    const f = Object.assign({}, fx, variantes[i]);
    attendre();
    const t0 = performance.now();
    const r = orig.call(this, cam, sortie, f);
    attendre();
    t[i].push(performance.now() - t0);
    if (!etats[i]) { etats[i] = R.stats.ombresPhoto ? Object.assign({}, R.stats.ombresPhoto) : null; appels[i] = R.stats.drawCalls; }
    k++;
    return r;
  };
  await images(variantes.length * __N__ + 1);
  R.draw = orig;
  if (prep) B.ombres.preparer = prep;
  const creations = R.stats.creations;
  let preparerUs = null;
  if (prep && derniers) { const N = 5000, t0 = performance.now(); for (let i = 0; i < N; i++) prep.apply(B.ombres, derniers); preparerUs = +((performance.now() - t0) / N * 1000).toFixed(2); }
  // Carte lointaine : même demande que le jeu, cible réutilisée, temps synchronisé (soumission + GPU), cinq fois.
  let carte = null;
  if (R.precalculerOmbre && B.ombres) {
    const ms = []; let rep = null;
    for (let i = 0; i < 5; i++) { attendre(); const t0 = performance.now(); rep = R.precalculerOmbre(B.ombres.DEMANDE_CARTE); attendre(); ms.push(performance.now() - t0); }
    ms.sort((x, y) => x - y);
    carte = rep && { taille: rep.taille, texel: +rep.texel.toFixed(3), etendue: Math.round(rep.etendue), profondeur: Math.round(rep.profondeur), appels: rep.appels, instances: rep.instances,
      cpuMs: +rep.ms.toFixed(2), synchroMs: ms.map(x => +x.toFixed(1)), medianeMs: +ms[2].toFixed(1) };
  }
  const tri = a => [...a].sort((x, y) => x - y);
  const q = (a, p) => { const s = tri(a); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
  const s = R.stats, dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return { gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?', toile: gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight, moteur: window.FERRO && FERRO.version,
    fxDuJeu: fxVu, msaa: s.msaa, atlasOmbres: s.shadowMapSize, triangles: s.triangles, creations, preparerUs, carte,
    journal: B.ombres && B.ombres.journal ? B.ombres.journal() : null,
    variantes: variantes.map((v, i) => ({ v: JSON.stringify(v), n: t[i].length, p50: q(t[i], .5), p90: q(t[i], .9), appels: appels[i], etat: etats[i] })) };
})()
