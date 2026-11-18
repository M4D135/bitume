/* BITUME — dépôts et ruissellement sur la visière, Canvas2D transparent sous le HUD. */
(function (B) {
  'use strict';
  const PAS = 1 / 30, MAX_PIXELS = 2000000, TAU = Math.PI * 2;
  const BUDGETS = Object.freeze({
    off: Object.freeze({ gouttes: 0, neige: 0, dpr: 1 }),
    low: Object.freeze({ gouttes: 10, neige: 4, dpr: 1 }),
    medium: Object.freeze({ gouttes: 26, neige: 9, dpr: 1 }),
    high: Object.freeze({ gouttes: 56, neige: 18, dpr: 1.25 }),
    ultra: Object.freeze({ gouttes: 112, neige: 36, dpr: 1.5 })
  });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const hache = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  function pool(nombre) {
    const p = new Array(nombre);
    for (let i = 0; i < nombre; i++) p[i] = { vivant: false, x: 0, y: 0, age: 0, duree: 0,
      taille: 0, vitesse: 0, phase: 0, frequence: 0, glisse: 0, poids: 0, fondu: false, cos: 1, sin: 0 };
    return p;
  }
  function creer(canvas) {
    const contexte = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d', { alpha: true }) : null;
    return { canvas, contexte, gouttes: pool(112), neige: pool(36), accumulateur: 0, temps: 0, sequence: 0,
      creditEau: 0, creditNeige: 0, largeur: canvas ? canvas.clientWidth || canvas.width || 1 : 1,
      hauteur: canvas ? canvas.clientHeight || canvas.height || 1 : 1, dpr: 1, propre: true, libere: false,
      stats: { gouttes: 0, neige: 0, dessins: 0, etapes: 0, largeur: 0, hauteur: 0, dpr: 1, pixels: 0 } };
  }
  function viderPixels(e) {
    if (!e.contexte || !e.canvas) return;
    e.contexte.setTransform(1, 0, 0, 1, 0, 0); e.contexte.globalAlpha = 1;
    e.contexte.clearRect(0, 0, e.canvas.width, e.canvas.height); e.propre = true;
  }
  function effacer(e) {
    if (!e) return;
    if (!e.propre) viderPixels(e);
    for (let i = 0; i < e.gouttes.length; i++) e.gouttes[i].vivant = false;
    for (let i = 0; i < e.neige.length; i++) e.neige[i].vivant = false;
    e.stats.gouttes = e.stats.neige = 0; e.accumulateur = e.creditEau = e.creditNeige = 0;
  }
  function liberer(e) {
    if (!e || e.libere) return;
    effacer(e); e.canvas = null; e.contexte = null; e.libere = true;
  }
  function dimensionner(e, c, budget) {
    const largeur = Math.max(1, Number(c.largeur) || e.canvas.clientWidth || e.largeur);
    const hauteur = Math.max(1, Number(c.hauteur) || e.canvas.clientHeight || e.hauteur);
    const dpr = Math.min(budget.dpr, Math.max(.25, Number(c.dpr) || Number(globalThis.devicePixelRatio) || 1), Math.sqrt(MAX_PIXELS / (largeur * hauteur)));
    const w = Math.max(1, Math.floor(largeur * dpr)), h = Math.max(1, Math.floor(hauteur * dpr));
    if (e.canvas.width !== w || e.canvas.height !== h) { e.canvas.width = w; e.canvas.height = h; e.propre = true; }
    e.largeur = largeur; e.hauteur = hauteur; e.dpr = dpr;
    e.stats.largeur = w; e.stats.hauteur = h; e.stats.dpr = dpr; e.stats.pixels = w * h;
  }
  function deposer(e, neige, limite, x, y, taille) {
    const liste = neige ? e.neige : e.gouttes;
    let p = null;
    for (let i = 0; i < limite; i++) if (!liste[i].vivant) { p = liste[i]; break; }
    if (!p) return false;
    const seed = Math.imul(++e.sequence, 2654435761) ^ 731;
    p.vivant = true; p.x = Number.isFinite(x) ? x : .025 + hache(seed) * .95;
    p.y = Number.isFinite(y) ? y : .025 + hache(seed + 17) * .93;
    p.age = 0; p.duree = (neige ? 7 : 8) + hache(seed + 23) * (neige ? 10 : 13);
    p.taille = Number.isFinite(taille) ? taille : neige ? 2.4 + hache(seed + 31) * 5.5 : .8 + hache(seed + 31) * 2.6;
    p.vitesse = .5 + hache(seed + 37) * 2.5; p.phase = hache(seed + 41) * TAU;
    p.frequence = .27 + hache(seed + 43) * .65; p.glisse = hache(seed + 47) > .68 ? 1 : .04;
    p.poids = 0; p.fondu = false; p.cos = Math.cos(p.phase); p.sin = Math.sin(p.phase); return true;
  }
  function avancer(e, c, budget, pluie, neige, vitesse, vent) {
    e.temps += PAS; e.stats.etapes++;
    const couvert = !!c.abri, eau = couvert || neige ? 0 : pluie, flocons = couvert ? 0 : neige;
    const rythme = 2 + vitesse * .10;
    e.creditEau = Math.min(3, e.creditEau + PAS * eau * rythme * budget.gouttes / 24);
    e.creditNeige = Math.min(2, e.creditNeige + PAS * flocons * (1 + vitesse * .045) * budget.neige / 12);
    while (e.creditEau >= 1) { deposer(e, false, budget.gouttes); e.creditEau--; }
    while (e.creditNeige >= 1) { deposer(e, true, budget.neige); e.creditNeige--; }
    let gouttes = 0, restes = 0;
    for (let i = 0; i < e.gouttes.length; i++) {
      const p = e.gouttes[i]; if (!p.vivant) continue;
      p.age += PAS * (eau > .05 ? 1 : 1.55);
      p.poids = clamp(p.poids + PAS * (i < budget.gouttes ? 5 : -2), 0, 1);
      const ruisselle = p.glisse * (8 + vitesse * .42) * (p.taille * .35 + p.vitesse);
      p.y += PAS * ruisselle / e.hauteur;
      p.x += PAS * (vent * (.5 + p.glisse) + Math.sin(e.temps * p.frequence + p.phase) * p.vitesse) / e.largeur;
      if (p.age >= p.duree || p.y > 1.04 || p.x < -.04 || p.x > 1.04 || i >= budget.gouttes && !p.poids) p.vivant = false;
      else gouttes++;
    }
    for (let i = 0; i < e.neige.length; i++) {
      const p = e.neige[i]; if (!p.vivant) continue;
      p.age += PAS * (flocons > .05 ? 1 : 1.35);
      p.poids = clamp(p.poids + PAS * (i < budget.neige ? 4 : -2), 0, 1);
      const fraction = p.age / p.duree;
      p.y += PAS * p.vitesse * Math.max(0, fraction - .3) * 4 / e.hauteur;
      p.x += PAS * vent * .07 / e.largeur;
      if (fraction > .62 && !p.fondu) { if (deposer(e, false, budget.gouttes, p.x, p.y, p.taille * .32)) gouttes++; p.fondu = true; }
      if (fraction >= 1 || p.y > 1.03 || i >= budget.neige && !p.poids) p.vivant = false;
      else restes++;
    }
    e.stats.gouttes = gouttes; e.stats.neige = restes;
  }
  function dessiner(e) {
    const ctx = e.contexte, w = e.largeur, h = e.hauteur;
    viderPixels(e); ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
    // Quelques traits et contours : ni lecture de pixels, ni réfraction plein écran.
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < e.gouttes.length; i++) {
      const p = e.gouttes[i]; if (!p.vivant) continue;
      const a = Math.min(1, p.age / .24, (p.duree - p.age) / 1.5) * p.poids;
      if (a <= .005) continue;
      const x = p.x * w, y = p.y * h, r = p.taille, longueur = p.glisse * Math.min(34, 7 + p.age * p.vitesse * 2);
      ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(182,213,230,0.13)'; ctx.lineWidth = Math.max(.5, r * .55);
      ctx.beginPath(); ctx.moveTo(x - Math.sin(p.phase) * r, y - longueur);
      ctx.quadraticCurveTo(x + Math.sin(e.temps * p.frequence + p.phase) * r * 1.8, y - longueur * .45, x, y); ctx.stroke();
      ctx.fillStyle = 'rgba(32,63,78,0.10)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.36, .12 * p.sin, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(222,241,249,0.28)'; ctx.lineWidth = .65; ctx.beginPath(); ctx.ellipse(x - r * .16, y - r * .24, r * .72, r * .87, .12 * p.sin, 3.4, 5.9); ctx.stroke();
    }
    for (let i = 0; i < e.neige.length; i++) {
      const p = e.neige[i]; if (!p.vivant) continue;
      const f = p.age / p.duree, a = Math.min(1, p.age / .3, (1 - f) * 3) * p.poids;
      if (a <= .005) continue;
      const x = p.x * w, y = p.y * h, r = p.taille * (1 - f * .72);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(232,242,249,0.43)'; ctx.beginPath();
      ctx.ellipse(x, y, r, r * .63, p.phase, 0, TAU);
      ctx.ellipse(x + p.cos * r * .62, y + p.sin * r * .62, r * .48, r * .55, p.phase + .7, 0, TAU);
      ctx.ellipse(x - p.sin * r * .4, y + p.cos * r * .4, r * .5, r * .36, p.phase - .9, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = .55; ctx.beginPath();
      ctx.moveTo(x - p.cos * r * .8, y - p.sin * r * .8); ctx.lineTo(x + p.cos * r * .8, y + p.sin * r * .8);
      ctx.moveTo(x - p.sin * r * .65, y + p.cos * r * .65); ctx.lineTo(x + p.sin * r * .65, y - p.cos * r * .65); ctx.stroke();
    }
    ctx.globalAlpha = 1; e.propre = e.stats.gouttes === 0 && e.stats.neige === 0; e.stats.dessins++;
  }
  function mettreAJour(e, dt, contexte) {
    if (!e || e.libere) return e ? e.stats : null;
    const c = contexte || {}, budget = BUDGETS[c.qualite] || BUDGETS.high;
    if (!e.contexte || c.actif === false || budget === BUDGETS.off) { effacer(e); return e.stats; }
    if (!Number.isFinite(dt) || dt <= 0) return e.stats;
    e.accumulateur += Math.min(.25, dt);
    if (e.accumulateur + 1e-10 < PAS) return e.stats;
    dimensionner(e, c, budget);
    const pluie = clamp(Number(c.pluie) || 0, 0, 1), neige = clamp(Number(c.neige) || 0, 0, 1);
    const vitesse = clamp(Math.abs(Number(c.vitesse) || 0), 0, 120);
    const vent = clamp((Number(c.ventX) || 0) * .20 + (Number(c.ventZ) || 0) * .08, -8, 8);
    while (e.accumulateur + 1e-10 >= PAS) { avancer(e, c, budget, pluie, neige, vitesse, vent); e.accumulateur -= PAS; }
    if (e.stats.gouttes || e.stats.neige || !e.propre) dessiner(e);
    return e.stats;
  }
  B.vitre = { creer, mettreAJour, effacer, liberer, BUDGETS, MAX_PIXELS, FREQUENCE: 30 };
})(globalThis.BITUME = globalThis.BITUME || {});
