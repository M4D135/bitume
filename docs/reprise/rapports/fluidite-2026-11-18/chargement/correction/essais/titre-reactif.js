// après l'écran titre : intervalles des premières images (le titre répond-il, ou sa première image fige-t-elle le menu ?)
(async () => {
  const t0 = performance.now(), l = [];
  let prec = t0;
  await new Promise(fin => { const f = t => { l.push(+(t - prec).toFixed(0)); prec = t; if (t - t0 < 6000 && l.length < 400) requestAnimationFrame(f); else fin(); }; requestAnimationFrame(f); });
  const tri = l.slice().sort((a, b) => a - b);
  // instant où le titre devient réactif : fin de la dernière image de plus de 500 ms dans les 6 s
  let cumul = 0, reactif = 0; for (const d of l) { cumul += d; if (d > 500) reactif = cumul; }
  return { titre: Math.round(t0), premieres: l.slice(0, 8), images: l.length, mediane: tri[tri.length >> 1], pire: tri[tri.length - 1], reactifApresTitreMs: Math.round(reactif) };
})()
