(async () => {
  const J = BITUME_JEU, dormir = ms => new Promise(r => setTimeout(r, ms));
  await dormir(1500);
  const err = document.getElementById('erreur');
  const r = { perte: window.__perte, ecran: J.ecran, session: J.session && J.session.type, scene: J.scene && J.scene.index,
    perdu: J.rendu.gl.isContextLost(), dernier: J.chargement.rapport && { annule: J.chargement.rapport.annule, erreur: J.chargement.rapport.erreur } };
  // la vitrine tourne-t-elle et dessine-t-elle ? horloge de la course et compte de tracés
  const h0 = J.session.course.horloge; await dormir(1000);
  r.horlogeAvance = +(J.session.course.horloge - h0).toFixed(2);
  r.stats = J.rendu.stats && { drawCalls: J.rendu.stats.drawCalls, triangles: J.rendu.stats.triangles };
  // une course après coup
  const R = await J.preparer({ type: 'course', circuit: 0 });
  r.course = { annule: R.annule, erreur: R.erreur, total: R.totalMs, ecran: J.ecran };
  return r;
})()
