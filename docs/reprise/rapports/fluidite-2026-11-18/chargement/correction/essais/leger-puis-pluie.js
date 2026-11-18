(async () => {
  const J = BITUME_JEU, dormir = ms => new Promise(r => setTimeout(r, ms));
  const v = document.getElementById('chargement');
  const res = {};
  Object.assign(J.reglages, { saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel', qualite: 'high', meteo: 'soleil', vue: 'cockpit', circuit: 0, moment: 'jour' });
  // 1. première course, sèche
  let r = await J.preparer({ type: 'course', circuit: 0 });
  const S1 = J.session;
  res.premiere = { leger: r.leger, total: r.totalMs, rendu: r.rendu, horlogeALaLevee: S1.course.horloge, phase: S1.course.phase, feux: JSON.stringify(S1.course.feux), meteo: JSON.stringify(S1.meteo).slice(0, 200) };
  await dormir(2500);
  res.premiere.apres2s = { horloge: +S1.course.horloge.toFixed(3), phase: S1.course.phase, tardives: J.chargement.tardives };
  // 2. retour en préparation puis même circuit, sous la pluie
  J.reglages.meteo = 'pluie';
  const classes = [];
  let fini = false;
  const obs = (async () => { while (!fini) { classes.push(v.className + ' op=' + getComputedStyle(v).opacity); await new Promise(q => requestAnimationFrame(q)); } })();
  const t0 = performance.now();
  r = await J.preparer({ type: 'course', circuit: 0, conditions: { saison: J.reglages.saison, moment: 'jour', meteo: 'pluie', mReelle: null, horlogeReelle: null } });
  fini = true; await obs;
  res.pluie = { leger: r.leger, promu: !!r.promu, total: r.totalMs, ms: Math.round(performance.now() - t0), etapes: r.etapes, rendu: r.rendu, code: r.code && { images: r.code.images }, voile: classes.slice(0, 12), meteo: JSON.stringify(J.session.meteo).slice(0, 160) };
  await dormir(3000);
  res.pluie.tardives = J.chargement.tardives;
  return res;
})()
