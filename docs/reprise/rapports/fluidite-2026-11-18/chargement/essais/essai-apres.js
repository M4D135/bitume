(async () => {
  const J = BITUME_JEU, dormir = ms => new Promise(r => setTimeout(r, ms));
  Object.assign(J.reglages, { qualite: 'high', meteo: 'soleil', meteoMode: 'manuel', saisonMode: 'manuel', momentMode: 'manuel', circuit: 0, vue: 'cockpit' });
  J.pilotageAuto = true;
  const r = await J.preparer({ type: 'course', circuit: 0 });
  const v = document.getElementById('chargement'), juste = { classes: v.className, opacite: getComputedStyle(v).opacity, hud: !document.getElementById('hud').hidden };
  await dormir(1200);
  const cs = getComputedStyle(v);
  return { totalMs: r.totalMs, ecran: J.ecran, juste, ensuite: { classes: v.className, opacite: cs.opacity, visibilite: cs.visibility }, inertes: ['titre', 'hud'].map(id => [id, document.getElementById(id).inert]), tardives: J.chargement.tardives };
})()
