(async () => {
  // Chemin du joueur (réglages du menu, préparation sous le voile, départ), l'ordinateur au volant ; créations du
  // moteur comptées à la fin de la préparation, au départ et après 900 images de course.
  const J = BITUME_JEU, R = J.rendu, o = __CONF__;
  const attendre = async (f, ms, quoi) => { const fin = performance.now() + ms; while (!f()) { if (performance.now() > fin) throw new Error(quoi + ' (écran ' + J.ecran + ')'); await new Promise(r => setTimeout(r, 50)); } };
  const images = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  Object.assign(J.reglages, { circuit: o.circuit, qualite: o.qualite, vue: o.vue, vue2: o.vue, retro: o.retro, meteo: o.meteo, saison: 'ete', moment: o.moment,
    saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel', tours: 3, secousses: 0, vibrations: 'non' });
  try { R.resize(J.profil.rendu.resolution); } catch (e) {}
  J.pilotageAuto = true;
  const c0 = R.stats.creations;
  document.querySelector('[data-aller="' + (o.mode === 'duo' ? 'duo' : 'course') + '"]').click();
  await attendre(() => J.ecran === 'preparation' && !document.getElementById('b-depart').disabled, 45000, 'préparation jamais prête');
  const c1 = R.stats.creations;
  document.getElementById('b-depart').click();
  await attendre(() => J.ecran === 'course', 60000, 'la course ne part pas');
  const c2 = R.stats.creations;
  await images(900);
  const c3 = R.stats.creations, ch = J.chargement, P = J.profil, S = J.session;
  return { conf: o, moteur: window.FERRO && FERRO.version, creations: { preparation: c1 - c0, depart: c2 - c1, course: c3 - c2 },
    tardives: ch.tardives, etape: ch.etape, palier: P && P.palier, ombresProfil: P && P.effets ? !!P.effets.ombres : null,
    photo: R.stats.ombresPhoto ? Object.assign({}, R.stats.ombresPhoto) : null, ombres: R.stats.shadows, phase: S && S.course.phase,
    horloge: S && +S.course.horloge.toFixed(1), toile: R.gl.drawingBufferWidth + 'x' + R.gl.drawingBufferHeight };
})()
