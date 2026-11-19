(async () => {
  const J = BITUME_JEU;
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  J.reference({"circuit": 0, "qualite": "low", "vue": "cockpit", "retro": "non", "depart": 800, "vitesse": 60});
  await images(90);
  const R = J.rendu, orig = R.draw; let n = 0, foule = 0, couleur = 0, ombre = 0, sMin = 1e9, sMax = -1e9; const S0 = J.session.course.joueur.etat;
  R.draw = function (cam, sortie, fx) { n++; if (fx && fx.foule) foule++; const r = orig.call(this, cam, sortie, fx); const m = J.public.mesure; if (m && m.appels > 0) couleur++; if (m && m.ombreInstances > 0) ombre++; sMin = Math.min(sMin, S0.s); sMax = Math.max(sMax, S0.s); return r; };
  await images(400);
  R.draw = orig;
  return { scene: "legere-cockpit", images: n, avecFoule: foule, fouleDessinee: couleur, fouleOmbre: ombre, s: [+sMin.toFixed(1), +sMax.toFixed(1)] };
})();
