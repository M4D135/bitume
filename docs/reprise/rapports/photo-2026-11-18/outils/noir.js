(async () => {
  // Lot 21, constat annexe : Légère + MSAA 4× manuel donne une image noire. Quelle erreur GL ?
  const J = BITUME_JEU;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  J.reference({ circuit: 0, qualite: 'low', vue: 'cockpit', anticrenelage: 'msaa4' });
  await images(20);
  const R = J.rendu, gl = R.gl, orig = R.draw, erreurs = [];
  const blit = gl.blitFramebuffer.bind(gl);
  gl.blitFramebuffer = function (...a) { while (gl.getError()) {} blit(...a); const e = gl.getError(); if (e) erreurs.push({ blit: a.slice(0, 8), erreur: e, lecture: !!gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), ecriture: !!gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) }); };
  await images(3);
  gl.blitFramebuffer = blit;
  const attrs = gl.getContextAttributes();
  return { erreurs: erreurs.slice(0, 2), INVALID_OPERATION: gl.INVALID_OPERATION, alpha: attrs.alpha, antialias: attrs.antialias, msaa: R.stats.msaa, halo: R.stats.bloom };
})()
