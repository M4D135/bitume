// Lot 28 — calculs par image : course de référence du jeu (BITUME_JEU.banc, voiture du joueur à l'ordinateur), mesurée
// sous le profileur de V8 par le pilote. __OPTIONS__ est remplacé par le pilote ; la scène est bâtie avant (--avant).
(async () => {
  const o = __OPTIONS__;
  const r = await BITUME_JEU.banc(o);
  const m = BITUME_JEU.mesures;
  return { banc: r, cpu: m && m.cpu, cpuP95: m && m.cpuP95, vues: m && m.vues, stats: (() => { const s = BITUME_JEU.rendu.stats || {}, x = {}; for (const k in s) if (typeof s[k] === 'number') x[k] = s[k]; return x; })() };
})()
