// Adaptateur des sondes CPU (traits et signatures historiques, sans pilote graphique).
// Les anciennes révisions de meteo.js utilisent la toile factice directement.
// La version WebGPU livre ici les coordonnées exactes envoyées à sa présentation.
export function pluieMesuree(meteo, canvas) {
  const contexte = canvas.getContext('2d');
  function effacer() { contexte.clearRect(0, 0, canvas.width, canvas.height); }
  function tracer(segments, lots, n, comptes, largeurs, opacites, dpr, ancienneImage, transparences) {
    if (ancienneImage) effacer();
    contexte.setTransform(dpr, 0, 0, dpr, 0, 0);
    contexte.lineCap = 'round'; contexte.strokeStyle = 'rgb(190,210,225)';
    for (let lot = 2; lot >= 0; lot--) {
      if (!comptes[lot]) continue;
      contexte.lineWidth = largeurs[lot]; contexte.globalAlpha = opacites[lot];
      function segment(i) {
        const k = 4 * i;
        contexte.moveTo(segments[k], segments[k + 1]); contexte.lineTo(segments[k + 2], segments[k + 3]);
      }
      let pleins = 0;
      for (let i = 0; i < n; i++) if (lots[i] === lot) {
        if (!transparences || transparences[i] === 63) { pleins++; continue; }
        contexte.globalAlpha = opacites[lot] * transparences[i] / 63;
        contexte.beginPath(); segment(i); contexte.stroke();
      }
      if (pleins) {
        contexte.globalAlpha = opacites[lot]; contexte.beginPath();
        for (let i = 0; i < n; i++) if (lots[i] === lot && (!transparences || transparences[i] === 63)) segment(i);
        contexte.stroke();
      }
    }
    contexte.globalAlpha = 1;
    return true;
  }
  return meteo.creerPluie(canvas, { presentation: { effacer, tracer } });
}
