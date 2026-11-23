// Exécuté par tools/page-essai.mjs, qui attend le titre dans un profil Chrome neuf.
(async () => {
  const jeu = window.BITUME_JEU;
  const moteur = jeu.rendu;
  if (moteur.stats.backend !== 'webgpu' || !moteur.gpu?.device) throw new Error('Moteur WebGPU absent');
  document.querySelector('[data-ouvrir-titre="solo"]').click();
  document.querySelector('[data-aller="course"]').click();
  const depart = document.getElementById('b-depart');
  const erreur = document.getElementById('erreur');
  const attendre = async (condition, message) => {
    const limite = performance.now() + 90000;
    while (!condition()) {
      if (!erreur.hidden) throw new Error(erreur.textContent);
      if (moteur.stats.deviceLost) throw new Error('Périphérique WebGPU perdu');
      if (performance.now() > limite) throw new Error(message);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  await attendre(() => jeu.ecran === 'preparation' && !depart.disabled, 'Départ indisponible');
  depart.click();
  await attendre(() => jeu.ecran === 'course' && jeu.session?.course, 'Course inaccessible');
  const course = jeu.session.course;
  if (course.voitures.length !== 12) throw new Error('Grille de départ incomplète');
  const debut = course.horloge;
  await attendre(() => course.horloge > debut + 0.1, 'Simulation immobile après le départ');
  await moteur.gpu.device.queue.onSubmittedWorkDone();
  if (moteur.stats.errorEvents.length) throw new Error(moteur.stats.errorEvents.join(' / '));
  if (window.contextesWebGLDemandes?.length) throw new Error('Le jeu a demandé un contexte WebGL');
  if (moteur.stats.triangles < 1) throw new Error('Aucun triangle dessiné');
  const info = moteur.gpu.adapter.info;
  return { ecran: jeu.ecran, voitures: course.voitures.length, horloge: course.horloge, backend: moteur.stats.backend,
    adaptateur: [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' '),
    triangles: moteur.stats.triangles };
})()
