// injecté avant la page : perd le contexte WebGL pendant l'étape « voile » de la vitrine du démarrage, le rend 800 ms après
(() => {
  window.__perte = null;
  const id = setInterval(() => {
    const J = window.BITUME_JEU;
    if (!J || !J.rendu || !J.chargement || !J.chargement.enCours || J.chargement.etape !== 'voile') return;
    clearInterval(id);
    const ext = J.rendu.gl.getExtension('WEBGL_lose_context');
    window.__perte = { etape: J.chargement.etape, type: J.chargement.type, session: !!J.session, scene: !!J.scene, t: performance.now() };
    ext.loseContext();
    setTimeout(() => { ext.restoreContext(); window.__perte.restaure = performance.now(); }, 800);
  }, 1);
})();
