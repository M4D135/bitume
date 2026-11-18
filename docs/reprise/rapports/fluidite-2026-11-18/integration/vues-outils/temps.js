(async () => {
  // Contrôle du temps rendu (étape 5) : à 144 Hz, la simulation au pas de 1/120 s laisse une image sur six sans pas.
  // On relève à chaque image le temps des voitures (horloge − pas + alpha × pas), celui des effets et celui du dernier
  // pas : le premier doit avancer à chaque image, d'un intervalle régulier.
  const J = BITUME_JEU;
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  let h = 12345; Math.random = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const file = []; window.requestAnimationFrame = fn => { file.push(fn); return file.length; };
  await attendre(150);
  let t = performance.now();
  const releves = [];
  async function tourner(n, ms, relever) {
    for (let i = 0; i < n; i++) {
      t += ms; const f = file.splice(0); for (const cb of f) cb(t);
      if (relever) { const S = J.session; releves.push({ tRendu: S.tRendu, horloge: S.course.horloge, hEffets: S.hEffets, acc: S.fx.acc }); }
      await attendre(0);
    }
  }
  J.chronoGPU = false;
  J.reference({ circuit: 0, qualite: 'low', vue: 'cockpit', depart: 800 });
  await tourner(144, 1000 / 144, false);
  await tourner(144, 1000 / 144, true);
  const pas = (a, b) => b - a;
  const resume = cle => {
    const d = []; for (let i = 1; i < releves.length; i++) d.push(pas(releves[i - 1][cle], releves[i][cle]));
    const nuls = d.filter(x => Math.abs(x) < 1e-9).length, tri = d.slice().sort((a, b) => a - b);
    return { images: d.length, sansAvance: nuls, min: +(tri[0] * 1000).toFixed(3), max: +(tri[tri.length - 1] * 1000).toFixed(3) };
  };
  // effets : instant des effets compté depuis leur dernière mise à jour ; on le ramène au temps absolu de la mise à jour
  // (horloge − acc) + hEffets, qui doit suivre tRendu
  const ecartEffets = releves.map(r => Math.abs((r.horloge - r.acc + r.hEffets) - r.tRendu));
  return { horloge: resume('horloge'), tRendu: resume('tRendu'), ecartEffetsMaxMs: +(Math.max(...ecartEffets) * 1000).toFixed(6) };
})()
