(async () => {
  const J = BITUME_JEU, dormir = ms => new Promise(r => setTimeout(r, ms)), res = {};
  // 1. un geste pendant la préparation de la démo rend le titre
  const p = J.demo(2);
  await dormir(30);
  res.pendant = { ecran: J.ecran, enCours: J.chargement.enCours, etape: J.chargement.etape };
  dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', key: 'x', bubbles: true }));
  dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', key: 'x', bubbles: true }));
  const r = await p;
  await dormir(1200);
  const v = document.getElementById('chargement');
  res.demo = { annule: !!(r && r.annule), ecran: J.ecran, enCours: J.chargement.enCours, voile: getComputedStyle(v).visibility, hudCache: document.getElementById('hud').hidden,
    titreInerte: document.getElementById('titre').inert, session: J.session && { type: J.session.type, i: J.session.i }, scene: J.scene && J.scene.index };
  // 2. Échap et pause sous le voile d'un départ : rien ne se quitte ; la course part normalement
  const q = J.preparer({ type: 'course', circuit: 2 });
  await dormir(20);
  dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
  dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape', bubbles: true }));
  const pendant2 = { ecran: J.ecran, voile: J.chargement.voile };
  const r2 = await q;
  await dormir(800);
  res.echap = { pendant: pendant2, annule: !!(r2 && r2.annule), ecran: J.ecran, tardives: J.chargement.tardives };
  // 3. une préparation remplacée par une autre : la première s'arrête, la seconde aboutit
  const a = J.preparer({ type: 'course', circuit: 0 }); await dormir(15);
  const b = J.preparer({ type: 'chrono', circuit: 0 });
  const [ra, rb] = await Promise.all([a, b]);
  await dormir(800);
  res.remplacee = { a: { annule: !!ra.annule, type: ra.type }, b: { annule: !!rb.annule, type: rb.type, totalMs: rb.totalMs }, ecran: J.ecran, type: J.session.type, tardives: J.chargement.tardives,
    voile: getComputedStyle(v).visibility, hud: !document.getElementById('hud').hidden };
  return res;
})()
