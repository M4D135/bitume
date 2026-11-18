(async () => {
  const J = BITUME_JEU, dormir = ms => new Promise(r => setTimeout(r, ms));
  const touche = async code => { dispatchEvent(new KeyboardEvent('keydown', { code, key: code.slice(-1).toLowerCase(), bubbles: true })); await dormir(60); dispatchEvent(new KeyboardEvent('keyup', { code, key: code.slice(-1).toLowerCase(), bubbles: true })); };
  const res = [];
  J.pilotageAuto = true;
  const essai = async (nom, reglages, lancer, apres, attente = 4000) => {
    Object.assign(J.reglages, { saisonMode: 'manuel', momentMode: 'manuel', meteoMode: 'manuel' }, reglages);
    try { J.rendu.resize(J.profil.rendu.resolution); } catch (e) {}
    const t0 = performance.now();
    const r = await lancer();
    const ms = Math.round(performance.now() - t0);
    const leve = { ecran: J.ecran, tardives: J.chargement.tardives };
    await dormir(1500);
    if (apres) await apres();
    await dormir(attente);
    const S = J.session;
    res.push({ nom, ms, totalMs: r && r.totalMs, leger: r && r.leger, etapes: r && r.etapes && r.etapes.filter(e => e.ms >= 1).map(e => e.nom + ' ' + e.ms),
      rendu: r && r.rendu, code: r && r.code && { images: r.code.images, lent: r.code.lent, simulation: r.code.simulation && r.code.simulation.ms },
      tardivesSousVoile: r && r.tardives, alaLevee: leve, ensuite: J.chargement.tardives, ecran: J.ecran, horloge: S && +S.course.horloge.toFixed(2), vue: J.reglages.vue });
  };
  await essai('course Val-Brûlé haute, sec, vues changées', { qualite: 'high', meteo: 'soleil', vue: 'cockpit', circuit: 0, moment: 'jour' },
    () => J.preparer({ type: 'course', circuit: 0 }), async () => { for (let k = 0; k < 3; k++) { await touche('KeyC'); await dormir(700); } });
  await essai('recommencer (même scène)', {}, () => J.preparer({ type: 'course', circuit: 0 }), null, 2000);
  await essai('course Haut-Col (tunnel), pluie', { qualite: 'high', meteo: 'pluie', vue: 'cockpit', circuit: 2 },
    () => J.preparer({ type: 'course', circuit: 2 }), async () => { await touche('KeyC'); }, 5000);
  await essai('duo Val-Brûlé', { qualite: 'high', meteo: 'soleil', vue: 'cockpit', vue2: 'cockpit', circuit: 0 },
    () => J.preparer({ type: 'duo', circuit: 0 }), null, 4000);
  await essai('course Lande-Noire nuit (aurores)', { qualite: 'high', meteo: 'soleil', vue: 'cockpit', circuit: 3, moment: 'nuit' },
    () => J.preparer({ type: 'course', circuit: 3 }), null, 3000);
  await essai('chrono Port-Sable, auto', { qualite: 'auto', meteo: 'variable', vue: 'cockpit', circuit: 1, moment: 'jour' },
    () => J.preparer({ type: 'chrono', circuit: 1 }), null, 3000);
  await essai('démo Port-Sable', { qualite: 'high' }, () => J.demo(1), null, 9000);
  return res;
})()
