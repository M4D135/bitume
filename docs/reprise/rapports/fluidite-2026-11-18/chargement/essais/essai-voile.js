(async () => {
  const J = BITUME_JEU;
  Object.assign(J.reglages, { qualite: 'high', meteo: 'soleil', meteoMode: 'manuel', saisonMode: 'manuel', momentMode: 'manuel', circuit: 0, vue: 'cockpit' });
  J.pilotageAuto = true;
  window.__prep = J.preparer({ type: 'course', circuit: 0 });
  const t0 = performance.now();
  while (J.chargement.etape !== 'code' && performance.now() - t0 < 20000) await new Promise(r => setTimeout(r, 2));
  const v = document.getElementById('chargement'), cs = getComputedStyle(v);
  return { etape: J.chargement.etape, voile: J.chargement.voile, classes: v.className, opacite: cs.opacity, visibilite: cs.visibility, texte: document.getElementById('chargement-etape').textContent,
    progres: document.getElementById('chargement-progres').value, inertes: ['titre', 'preparation', 'hud'].map(id => [id, document.getElementById(id).inert]) };
})()
