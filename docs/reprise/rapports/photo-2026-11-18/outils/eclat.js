(async () => {
  // Lot 21 : l'adaptation de l'œil du tunnel (fx.brightness) agit-elle sur l'image ?
  // Une image sur deux reçoit brightness 2, l'autre 0,5 ; on compare la luminance moyenne de l'image finale.
  const J = BITUME_JEU;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  J.reference({ circuit: 2, qualite: 'high', vue: 'cockpit', depart: 'tunnel', retro: 'non' });
  await images(70);
  const R = J.rendu, gl = R.gl, orig = R.draw;
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const w = Math.floor(W / 2), h = Math.floor(H / 3), x = Math.floor(W / 4), y = Math.floor(H / 2);
  const buf = new Uint8Array(w * h * 4);
  const lum = { fort: [], faible: [] }, vus = [];
  let k = 0;
  R.draw = function (cam, sortie, fx) {
    const fort = k % 2 === 0;
    vus.push(fx.brightness);
    const r = orig.call(this, cam, sortie, Object.assign({}, fx, { brightness: fort ? 2 : .5 }));
    const avant = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, avant);
    let s = 0;
    for (let i = 0; i < buf.length; i += 16) s += .2126 * buf[i] + .7152 * buf[i + 1] + .0722 * buf[i + 2];
    (fort ? lum.fort : lum.faible).push(s / (buf.length / 16));
    k++;
    return r;
  };
  await images(40);
  R.draw = orig;
  const moy = a => a.reduce((p, q) => p + q, 0) / a.length;
  return { image: W + 'x' + H, appels: k, brightnessDuJeu: [Math.min(...vus), Math.max(...vus)],
    luminanceBrightness2: +moy(lum.fort).toFixed(2), luminanceBrightness05: +moy(lum.faible).toFixed(2),
    rapport: +(moy(lum.fort) / moy(lum.faible)).toFixed(4), sousVoute: J.session && J.session.lumiere };
})()
