(async () => {
  const J = BITUME_JEU;
  Object.assign(J.reglages, { qualite: 'low', circuit: 0, meteo: 'soleil', meteoMode: 'manuel' });
  try { J.rendu.resize(J.profil.rendu.resolution); } catch (e) {}
  const t0 = performance.now();
  const r = await J.preparer({ type: 'course', circuit: 0 });
  const total = performance.now() - t0;
  await new Promise(f => setTimeout(f, 1500));
  return { total: Math.round(total), etapes: r.etapes, rendu: r.rendu, code: r.code, leger: r.leger, tardives: J.chargement.tardives, ecran: J.ecran, profil: J.profil.qualite, palier: J.palier };
})()
