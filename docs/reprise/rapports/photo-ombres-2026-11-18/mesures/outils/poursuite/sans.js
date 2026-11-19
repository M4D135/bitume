(async () => {
  const J = BITUME_JEU, B = globalThis.BITUME, R = J.rendu;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  J.reference({ circuit: 0, qualite: 'high', vue: 'poursuite', retro: 'non', depart: 2300, vitesse: 60, pilote: false });
  const c = J.scene.c;
  for (const v of J.session.course.voitures) if (!v.joueur) {
    const et = v.etat; et.s = (et.s + c.longueur / 2) % c.longueur; et.v = 0;
    const e = B.circuit.echantillon(c, et.s); et.y = e.y - et.d * Math.sin(e.devers); et.tangage = Math.atan(e.pente || 0); et.roulis = e.devers || 0;
    v.roule = et.s; v.progression = ((et.s - (c.depart || 0)) % c.longueur + c.longueur) % c.longueur; J.session.course.sAvant[v.id] = et.s;
  }
  for (const id of ['hud', 'h-fps', 'classement', 'zone-carte', 'message', 'sous-message', 'feux', 'jauge-derive', 'tactile', 'b-pause', 'aide-console', 'vignette']) {
    const el = document.getElementById(id); if (el) el.style.visibility = 'hidden';
  }
  const retouche = { ombreProche: null }, orig = R.draw;
  R.draw = function (cam, sortie, fx) { return orig.call(this, cam, sortie, Object.assign({}, fx, retouche)); };
  await images(60);
  return { photo: R.stats.ombresPhoto ? Object.assign({}, R.stats.ombresPhoto) : null, s: +J.session.course.joueur.etat.s.toFixed(1) };
})()
