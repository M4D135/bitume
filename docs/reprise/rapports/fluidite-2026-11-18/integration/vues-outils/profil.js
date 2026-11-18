(async () => {
  // Contrôle du profil mémorisé (étape 6) : appels à melange et à stabiliser par image, en solo et à deux, puis
  // changement d'une option (le profil doit suivre aussitôt).
  const J = BITUME_JEU, G = BITUME.graphismes;
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  let h = 12345; Math.random = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const file = []; window.requestAnimationFrame = fn => { file.push(fn); return file.length; };
  await attendre(150);
  let t = performance.now();
  async function tourner(n, ms) { for (let i = 0; i < n; i++) { t += ms; const f = file.splice(0); for (const cb of f) cb(t); await attendre(0); } }
  let melanges = 0, stabilisations = 0;
  const m0 = G.melange, s0 = G.stabiliser;
  G.melange = function () { melanges++; return m0.apply(this, arguments); };
  G.stabiliser = function () { stabilisations++; return s0.apply(this, arguments); };
  J.chronoGPU = false;
  const sortie = {};
  for (const mode of ['solo', 'duo']) {
    J.reference({ circuit: 0, qualite: 'high', vue: 'cockpit', depart: 800, mode });
    await tourner(30, 1000 / 60);
    melanges = stabilisations = 0;
    await tourner(60, 1000 / 60);
    sortie[mode] = { melangesParImage: +(melanges / 60).toFixed(2), stabilisationsParImage: +(stabilisations / 60).toFixed(2) };
  }
  const p1 = J.profil, p2 = J.profil;
  const ombresAvant = J.reglages.ombres;
  J.reglages.ombres = 'off';
  const p3 = J.profil;
  J.reglages.ombres = ombresAvant;
  const p4 = J.profil;
  sortie.memeObjet = p1 === p2;
  sortie.ombresCoupees = { avant: p1.effets.ombres, apres: p3.effets.ombres, rendu: p4.effets.ombres === p1.effets.ombres };
  return sortie;
})()
