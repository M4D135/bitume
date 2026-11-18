(async () => {
  // Mesure des vues (lot Fluidité, intégration) : horloge rAF commandée, hasard semé, simulation figée après
  // 240 pas déterministes. Même point de vue d'un build à l'autre. CONF est posée en tête par le lanceur.
  const J = BITUME_JEU, R = J.rendu;
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  let h = 12345; Math.random = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const file = []; window.requestAnimationFrame = fn => { file.push(fn); return file.length; };
  await attendre(150);
  let t = performance.now(), image = 0;
  const cpu = [];
  async function tourner(n, ms) {
    for (let i = 0; i < n; i++) {
      t += ms; image++;
      const f = file.splice(0), t0 = performance.now();
      for (const cb of f) cb(t);
      cpu.push(performance.now() - t0);
      await attendre(0);
    }
  }
  const journal = [];
  const CLES = ['drawCalls', 'triangles', 'instances', 'staticVisible', 'staticCulled', 'visibleChunks', 'shadowChunks', 'shadowStatic', 'lotsVisibles',
    'actorsConsidered', 'actorsCulled', 'shadowMaps', 'fxInstances', 'width', 'height', 'pixelRatio'];
  const choisir = s => { const o = {}; for (const k of CLES) if (typeof s[k] === 'number' || typeof s[k] === 'boolean') o[k] = s[k]; return o; };
  const envelopper = (m, nom) => {
    const d = m.draw;
    m.draw = function (cam, liste) {
      const r = d.apply(this, arguments);
      journal.push({ nom, image, objets: liste.length, cle: cam.pos.map(v => v.toFixed(2)).join(','), ...choisir(m.stats) });
      return r;
    };
  };
  envelopper(R, 'principal');
  const creer = FRender.create; let glace = null;
  FRender.create = function () {
    const m = creer.apply(this, arguments);
    if (!glace) {
      glace = m; envelopper(m, 'glace');
      // essai du filtre : luminosité passée au rendu des glaces au lieu du filtre CSS
      if (CONF.luminositeGlaces) { const d = m.draw; m.draw = function (cam, liste, o) { o.brightness = CONF.luminositeGlaces; return d.apply(this, arguments); }; }
    }
    return m;
  };
  if (CONF.luminositeGlaces) { const st = document.createElement('style'); st.textContent = '.glace { filter: none !important; }'; document.head.appendChild(st); }
  J.chronoGPU = false;
  const ref = J.reference(Object.assign({ circuit: 0, qualite: 'high', vue: 'cockpit', depart: 800 }, CONF.reference || {}));
  J.session.acc = -1;
  J.avancer(2, true);
  await tourner(40, 1000 / 60);
  const resume = liste => {
    const groupes = {};
    for (const e of liste) {
      const k = e.nom === 'glace' ? 'glace ' + e.cle : e.nom;
      (groupes[k] || (groupes[k] = [])).push(e);
    }
    const sortie = {};
    for (const [k, l] of Object.entries(groupes)) {
      const o = { rendus: l.length };
      for (const c of ['objets', ...CLES]) {
        const v = l.map(e => e[c]).filter(x => typeof x === 'number').sort((a, b) => a - b);
        if (v.length) o[c] = v[Math.floor(v.length / 2)];
      }
      sortie[k] = o;
    }
    return sortie;
  };
  journal.length = 0; cpu.length = 0;
  await tourner(60, 1000 / 60);
  const cpuTri = cpu.slice().sort((a, b) => a - b);
  const fige = { parImage: resume(journal), cpuMsMediane: +cpuTri[Math.floor(cpuTri.length / 2)].toFixed(2), images: 60 };
  if (CONF.capture) return { ref, fige, glaces: ['glace-g', 'glace-d', 'glace-g2', 'glace-d2', 'scene', 'scene2'].map(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { id, x: r.x, y: r.y, l: r.width, h: r.height, cache: e.hidden || getComputedStyle(e).visibility === 'hidden' }; }) };
  // cadence : rendus par seconde selon la fréquence de l'écran (mêmes réglages, simulation figée)
  const cadence = {};
  for (const F of CONF.frequences || [60, 120, 144, 30]) {
    // séance neuve à chaque fréquence : la cadence repart de zéro (aucun diviseur hérité de la fréquence précédente)
    J.reference(Object.assign({ circuit: 0, qualite: 'high', vue: 'cockpit', depart: 800 }, CONF.reference || {}));
    J.session.acc = -1;
    J.avancer(2, true);
    await tourner(F, 1000 / F);
    journal.length = 0;
    const avant = image;
    await tourner(F * 2, 1000 / F);
    const n = image - avant, par = {};
    for (const e of journal) par[e.nom] = (par[e.nom] || 0) + 1;
    const parImage = {};
    for (const e of journal) if (e.nom === 'principal') parImage[e.image] = (parImage[e.image] || 0) + 1;
    const doubles = Object.values(parImage).filter(x => x === 2).length;
    cadence[F + ' Hz'] = { images: n, etatCadence: J.cadence, principalParS: par.principal / 2, glaceParS: (par.glace || 0) / 2, vueJ2ParS: CONF.reference && CONF.reference.mode === 'duo' ? doubles / 2 : undefined };
  }
  return { ref, fige, cadence };
})()
