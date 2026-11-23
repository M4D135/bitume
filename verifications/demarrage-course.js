// Exécuté par tools/page-essai.mjs, qui attend le titre dans un profil Chrome neuf.
(async () => {
  const jeu = window.BITUME_JEU;
  const gl = jeu.rendu.gl;
  if (!(gl instanceof WebGL2RenderingContext)) throw new Error('Contexte WebGL2 absent');
  document.querySelector('[data-ouvrir-titre="solo"]').click();
  document.querySelector('[data-aller="course"]').click();
  const depart = document.getElementById('b-depart');
  const erreur = document.getElementById('erreur');
  const attendre = async (condition, message) => {
    const limite = performance.now() + 90000;
    while (!condition()) {
      if (!erreur.hidden) throw new Error(erreur.textContent);
      if (gl.isContextLost()) throw new Error('Perte du contexte WebGL2');
      if (performance.now() > limite) throw new Error(message);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  await attendre(() => jeu.ecran === 'preparation' && !depart.disabled, 'Départ indisponible');
  depart.click();
  await attendre(() => jeu.ecran === 'course' && jeu.session?.course, 'Course inaccessible');
  const course = jeu.session.course;
  const debut = course.horloge;
  await attendre(() => course.horloge > debut + 0.1, 'Simulation immobile après le départ');
  if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) throw new Error('Erreur WebGL2 en course');
  return { ecran: jeu.ecran, voitures: course.voitures.length, horloge: course.horloge };
})()
