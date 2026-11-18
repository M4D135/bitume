(async () => {
  const J = BITUME_JEU, dormir = ms => new Promise(r => setTimeout(r, ms));
  Object.assign(J.reglages, { qualite: 'high' });
  await J.demo(0);
  await dormir(800);
  const S0 = J.session, i0 = S0.i;
  const etat = J.avancer(900, true);
  const t0 = performance.now(); let vuVoile = false, vuAttente = false, etapes = new Set();
  while (J.session === S0 && performance.now() - t0 < 30000) { const c = J.chargement; if (c.voile) vuVoile = true; if (c.etape) etapes.add(c.etape); await dormir(5); }
  const t1 = performance.now();
  while (J.chargement.enCours && performance.now() - t1 < 30000) { const c = J.chargement; if (c.etape) etapes.add(c.etape); await dormir(5); }
  const r = J.chargement.rapport;
  await dormir(2000);
  return { avance: etat, change: J.session !== S0, i0, i1: J.session.i, ecran: J.ecran, type: J.session.type, vuVoile, etapes: [...etapes],
    rapport: r && { type: r.type, leger: r.leger, totalMs: r.totalMs, etapes: r.etapes.map(e => e.nom + ' ' + e.ms) }, tardives: J.chargement.tardives,
    voile: getComputedStyle(document.getElementById('chargement')).opacity, horloge: +J.session.course.horloge.toFixed(2) };
})()
