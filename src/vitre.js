/* BITUME — dépôts et ruissellement sur la visière, Canvas2D transparent sous le HUD. */
(function (B) {
  'use strict';
  const PAS = 1 / 30, MAX_PIXELS = 2000000, TAU = Math.PI * 2, MAX_RAYON_EAU = 12, MAX_RAYON_NEIGE = 19;
  const BUDGETS = Object.freeze({
    off: Object.freeze({ gouttes: 0, neige: 0, dpr: 1 }),
    low: Object.freeze({ gouttes: 10, neige: 4, dpr: 1 }),
    medium: Object.freeze({ gouttes: 26, neige: 9, dpr: 1 }),
    high: Object.freeze({ gouttes: 56, neige: 18, dpr: 1.25 }),
    ultra: Object.freeze({ gouttes: 112, neige: 36, dpr: 1.5 })
  });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  // Mélange exact aux bornes : k = 0 rend l'état du pas précédent, k = 1 celui du dernier pas, au bit près.
  const melange = (a, b, k) => a * (1 - k) + b * k;
  const hache = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  function pool(nombre) {
    const p = new Array(nombre);
    // px, py, pa et pp gardent position, âge et poids d'avant le dernier pas, pour dessiner entre deux pas.
    for (let i = 0; i < nombre; i++) p[i] = { vivant: false, fusion: false, x: 0, y: 0, age: 0, duree: 0,
      taille: 0, vitesse: 0, phase: 0, frequence: 0, glisse: 0, poids: 0, fondu: false, cos: 1, sin: 0,
      px: 0, py: 0, pa: 0, pp: 0, pr: 0, fonte: 0, traceAge: 0,
      traceX: new Float64Array(6), traceY: new Float64Array(6) };
    return p;
  }
  // Toile propre (aucun pixel) : masquée par visibility, qui garde sa taille, elle n'est plus composée au-dessus
  // de la scène. L'état est suivi pour n'écrire le style qu'au changement, jamais à chaque image.
  function montrer(e, visible) {
    if (e.masquee === !visible) return;
    e.masquee = !visible;
    if (e.canvas && e.canvas.style) e.canvas.style.visibility = visible ? '' : 'hidden';
  }
  function creer(canvas, options) {
    // Un contexte WebGL2 dédié compose les lentilles de la vue courante. Le Canvas2D reste le repli
    // des navigateurs sans WebGL2 et des bancs de simulation : aucune modification du FERRO verrouillé.
    const optique = B.visiereOptique && B.visiereOptique.creer(canvas, options);
    if (optique) { optique.optique = true; return optique; }
    const contexte = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d', { alpha: true }) : null;
    return creerSimulation(options, canvas, contexte);
  }
  // Même dépôt mobile pour la réfraction WebGL et le repli Canvas ; aucun contexte ni pixel requis ici.
  function creerSimulation(options, canvas = null, contexte = null) {
    const e = { canvas, contexte, gouttes: pool(112), neige: pool(36), accumulateur: 0, temps: 0, sequence: 0, masquee: false,
      graine: options && Number.isInteger(options.graine) ? options.graine | 0 : 0,
      creditEau: 0, creditNeige: 0, largeur: canvas ? canvas.clientWidth || canvas.width || 1 : 1280,
      hauteur: canvas ? canvas.clientHeight || canvas.height || 1 : 720, dpr: 1, dprPalier: null, propre: true, libere: false,
      opacite: 1, stats: { backend: 'canvas2d', pret: !!contexte, gouttes: 0, neige: 0, dessins: 0, etapes: 0, largeur: 0, hauteur: 0, dpr: 1, pixels: 0, fraction: 0,
        fusionsEau: 0, fusionsNeige: 0, fonte: 0, expulses: 0, seches: 0, surfaceExpulsee: 0,
        depotsEau: 0, depotsEmbruns: 0, eauEvacuee: 0, paires: 0 } };
    montrer(e, false); // toile neuve, vide
    return e;
  }
  function viderPixels(e) {
    if (!e.contexte || !e.canvas) return;
    e.contexte.setTransform(1, 0, 0, 1, 0, 0); e.contexte.globalAlpha = 1;
    e.contexte.clearRect(0, 0, e.canvas.width, e.canvas.height); e.propre = true;
  }
  function effacer(e) {
    if (!e) return;
    if (e.optique) { B.visiereOptique.effacer(e); return; }
    if (!e.propre) viderPixels(e);
    montrer(e, false);
    for (let i = 0; i < e.gouttes.length; i++) e.gouttes[i].vivant = e.gouttes[i].fusion = false;
    for (let i = 0; i < e.neige.length; i++) e.neige[i].vivant = e.neige[i].fusion = false;
    e.stats.gouttes = e.stats.neige = 0; e.accumulateur = e.creditEau = e.creditNeige = 0;
    e.dprPalier = null; // nouvelle séance : le prochain appel actif reprend la définition du palier courant
  }
  function liberer(e) {
    if (!e || e.libere) return;
    if (e.optique) { B.visiereOptique.liberer(e); return; }
    effacer(e); e.canvas = null; e.contexte = null; e.libere = true;
  }
  // La part du palier dans la définition ne fait que descendre pendant une séance : le premier appel actif la
  // fixe, même au sec, et chaque baisse de palier (qualité Auto qui allège) la réduit aussitôt, puisque la visière
  // se redessine à chaque image et que ses pixels coûtent justement sur la machine qui peine. Une remontée ne
  // réalloue pas la toile en pleine course : elle ne rend que le nombre de gouttes, la définition revient à la
  // séance suivante (effacer). Taille de fenêtre et devicePixelRatio restent suivis, avec le même plafond.
  function suivrePalier(e, budget) {
    e.dprPalier = e.dprPalier === null ? budget.dpr : Math.min(e.dprPalier, budget.dpr);
  }
  function dimensionner(e, c, budget) {
    if (e.dprPalier === null) e.dprPalier = budget.dpr;
    const largeur = Math.max(1, Number(c.largeur) || e.canvas.clientWidth || e.largeur);
    const hauteur = Math.max(1, Number(c.hauteur) || e.canvas.clientHeight || e.hauteur);
    const dpr = Math.min(e.dprPalier, Math.max(.25, Number(c.dpr) || Number(globalThis.devicePixelRatio) || 1), Math.sqrt(MAX_PIXELS / (largeur * hauteur)));
    const w = Math.max(1, Math.floor(largeur * dpr)), h = Math.max(1, Math.floor(hauteur * dpr));
    if (e.canvas.width !== w || e.canvas.height !== h) { e.canvas.width = w; e.canvas.height = h; e.propre = true; }
    e.largeur = largeur; e.hauteur = hauteur; e.dpr = dpr;
    e.stats.largeur = w; e.stats.hauteur = h; e.stats.dpr = dpr; e.stats.pixels = w * h;
  }
  function deposer(e, neige, limite, x, y, taille, echelle = 1) {
    const liste = neige ? e.neige : e.gouttes;
    let p = null;
    for (let i = 0; i < limite; i++) if (!liste[i].vivant) { p = liste[i]; break; }
    if (!p) return false;
    const seed = Math.imul(++e.sequence, 2654435761) ^ 731 ^ Math.imul(e.graine, 374761393);
    p.vivant = true; p.fusion = false; p.x = Number.isFinite(x) ? x : .025 + hache(seed) * .95;
    p.y = Number.isFinite(y) ? y : .025 + hache(seed + 17) * .93;
    p.age = 0; p.duree = (neige ? 7 : 8) + hache(seed + 23) * (neige ? 10 : 13);
    // Beaucoup de perles fines et quelques impacts larges, sans agrandir toute la pluie uniformément.
    p.taille = Number.isFinite(taille) ? taille : neige ? 4 + hache(seed + 31) * 7 : (1.1 + hache(seed + 31) ** 2 * 6.4) * echelle;
    p.taille = clamp(p.taille, .5, neige ? MAX_RAYON_NEIGE : MAX_RAYON_EAU);
    p.vitesse = .5 + hache(seed + 37) * 2.5; p.phase = hache(seed + 41) * TAU;
    p.frequence = .27 + hache(seed + 43) * .65; p.glisse = hache(seed + 47) > .68 ? 1 : .04;
    p.poids = 0; p.fondu = false; p.cos = Math.cos(p.phase); p.sin = Math.sin(p.phase);
    p.px = p.x; p.py = p.y; p.pa = 0; p.pp = 0; p.pr = p.taille; p.fonte = 0; p.traceAge = 0;
    p.traceX.fill(p.x); p.traceY.fill(p.y); return true;
  }
  // Six points d'une coulure réelle, gardés dans le pool. L'histoire suit le vent et les fusions ; elle ne
  // dépend pas du nombre d'images dessinées. Les gouttes immobiles ne se voient pas affublées d'un trait vertical.
  function garderTrajet(p) {
    p.traceAge += PAS;
    if (p.traceAge < .1 - 1e-10) return;
    p.traceAge -= .1;
    for (let j = 5; j > 0; j--) { p.traceX[j] = p.traceX[j - 1]; p.traceY[j] = p.traceY[j - 1]; }
    p.traceX[0] = p.px; p.traceY[0] = p.py;
  }
  // Une rencontre rassemble la surface d'eau et son centre de masse. Test balayé : une coulure rapide peut
  // ramasser une perle entre deux pas. 112 gouttes et 36 amas au plus, donc 6 846 paires au pire par pas.
  // Le rayon est plafonné : l'excédent s'écoule hors du dépôt, au lieu de former une lentille géante sur l'écran.
  function fusionner(e, liste, limite, neige) {
    let nombre = 0;
    const maximum = neige ? MAX_RAYON_NEIGE : MAX_RAYON_EAU;
    for (let i = 0; i < limite; i++) {
      const a = liste[i]; if (!a.vivant) continue;
      for (let j = i + 1; j < limite; j++) {
        const b = liste[j]; if (!b.vivant) continue;
        e.stats.paires++;
        const dx = (a.px - b.px) * e.largeur, dy = (a.py - b.py) * e.hauteur;
        const vx = (a.x - a.px - b.x + b.px) * e.largeur, vy = (a.y - a.py - b.y + b.py) * e.hauteur;
        const vv = vx * vx + vy * vy, t = vv > 1e-9 ? clamp(-(dx * vx + dy * vy) / vv, 0, 1) : 0;
        const r = (a.taille + b.taille) * (neige ? .7 : .8);
        if ((dx + vx * t) ** 2 + (dy + vy * t) ** 2 > r * r) continue;
        const ma = a.taille * a.taille, mb = b.taille * b.taille, masse = ma + mb;
        a.x = (a.x * ma + b.x * mb) / masse; a.y = (a.y * ma + b.y * mb) / masse;
        a.taille = Math.min(maximum, Math.sqrt(masse));
        a.vitesse = (a.vitesse * ma + b.vitesse * mb) / masse;
        a.poids = Math.max(a.poids, b.poids); a.glisse = 1;
        // L'amas conserve la part fondue des deux dépôts. Une fusion ne fait pas renaître de neige sèche.
        const fraction = (a.age / a.duree * ma + b.age / b.duree * mb) / masse;
        a.age = fraction * a.duree;
        a.fonte = Math.max(a.fonte, b.fonte); a.fondu = a.fonte > 0;
        e.stats.eauEvacuee += Math.max(0, masse - maximum * maximum);
        // Le dépôt absorbé reste dessinable pendant le pas interpolé : son aire décroît pendant que
        // celle du receveur grandit. À 144 Hz, la fusion ne perd donc pas une perle durant quatre images.
        b.vivant = false; b.fusion = true; nombre++;
        if (neige) e.stats.fusionsNeige++; else e.stats.fusionsEau++;
      }
    }
    return nombre;
  }
  function avancer(e, c, budget, pluie, neige, vitesse, vent, intensite) {
    e.temps += PAS; e.stats.etapes++;
    const couvert = !!c.abri, eau = couvert || neige ? 0 : pluie, flocons = couvert ? 0 : neige;
    const spray = couvert || neige ? 0 : clamp(Number(c.embruns) || 0, 0, 1);
    const air = clamp((vitesse - 18) / 102, 0, 1) ** 2, rythme = 3 + vitesse * .12;
    // L'air évacue la pluie libre ; les pneus de la voiture devant continuent d'envoyer de nouveaux impacts.
    // Le sillage a son propre flux, qui reste abondant à 300 km/h sans ralentir l'évacuation des gouttes présentes.
    const exposition = (c.cockpit === false ? .60 : 1) * intensite;
    const fluxPluie = eau * rythme / (1 + air * 3.5), fluxSpray = spray * (22 + vitesse * .36) / (1 + air * .55);
    e.creditEau = Math.min(4, e.creditEau + PAS * (fluxPluie + fluxSpray) * budget.gouttes / 24 * exposition);
    e.creditNeige = Math.min(2, e.creditNeige + PAS * flocons * (1 + vitesse * .035) * budget.neige / 12 * exposition / (1 + air * 3.5));
    while (e.creditEau >= 1) {
      // Impacts groupés du panache, renouvelés quatre fois par seconde. Le test balayé décide des fusions.
      const enSpray = spray > .05 && hache(e.sequence * 13 + 5) < fluxSpray / Math.max(.001, fluxPluie + fluxSpray);
      const gerbe = Math.floor(e.temps * 4) + e.graine * 739;
      const x = enSpray ? .12 + hache(gerbe * 37 + 91) * .76 + (hache(e.sequence * 43 + 7) - .5) * .075 : undefined;
      const y = enSpray ? .10 + hache(gerbe * 53 + 83) * .78 + (hache(e.sequence * 47 + 3) - .5) * .075 : undefined;
      if (deposer(e, false, budget.gouttes, x, y, undefined, budget.echelleEau || 1)) {
        e.stats.depotsEau++; if (enSpray) e.stats.depotsEmbruns++;
      }
      e.creditEau--;
    }
    while (e.creditNeige >= 1) { deposer(e, true, budget.neige); e.creditNeige--; }
    let gouttes = 0, restes = 0;
    for (let i = 0; i < e.gouttes.length; i++) {
      const p = e.gouttes[i]; p.fusion = false; if (!p.vivant) continue;
      p.px = p.x; p.py = p.y; p.pa = p.age; p.pp = p.poids; p.pr = p.taille;
      garderTrajet(p);
      p.age += PAS * ((eau > .05 || spray > .05 ? 1 : 1.55) + air * 5);
      p.poids = clamp(p.poids + PAS * (i < budget.gouttes ? 5 : -2), 0, 1);
      const mobilite = Math.max(p.glisse, clamp((p.taille - 3.4) / 3, .04, 1));
      const ruisselle = mobilite * (8 + vitesse * .42) * (p.taille * .35 + p.vitesse);
      p.y += PAS * (ruisselle + (p.y - .45) * air * 130) / e.hauteur;
      p.x += PAS * (vent * (.5 + mobilite) + Math.sin(e.temps * p.frequence + p.phase) * p.vitesse + (p.x - .5) * air * 210) / e.largeur;
      const dehors = p.y < -.04 || p.y > 1.04 || p.x < -.04 || p.x > 1.04;
      if (p.age >= p.duree || dehors || i >= budget.gouttes && !p.poids) {
        p.vivant = false;
        if (dehors) { e.stats.expulses++; e.stats.surfaceExpulsee += p.taille * p.taille; }
        else if (p.age >= p.duree) e.stats.seches++;
      }
      else gouttes++;
    }
    for (let i = 0; i < e.neige.length; i++) {
      const p = e.neige[i]; p.fusion = false; if (!p.vivant) continue;
      p.px = p.x; p.py = p.y; p.pa = p.age; p.pp = p.poids; p.pr = p.taille;
      p.age += PAS * ((flocons > .05 ? 1 : 1.35) + air * 4);
      p.poids = clamp(p.poids + PAS * (i < budget.neige ? 4 : -2), 0, 1);
      const fraction = p.age / p.duree;
      p.y += PAS * (p.vitesse * Math.max(0, fraction - .22) * 7 + (p.y - .4) * air * 220) / e.hauteur;
      p.x += PAS * (vent * .12 + (p.x - .5) * air * 280) / e.largeur;
      // Deux écoulements distincts : la neige devient d'abord humide, puis transparente et ruisselante.
      if (fraction > (p.fonte ? .72 : .42) && p.fonte < 2) {
        if (deposer(e, false, budget.gouttes, p.x, p.y, p.taille * (p.fonte ? .48 : .34))) { gouttes++; p.fonte++; p.fondu = true; e.stats.fonte++; }
      }
      const dehors = p.y < -.03 || p.y > 1.03 || p.x < -.03 || p.x > 1.03;
      if (fraction >= 1 || dehors || i >= budget.neige && !p.poids) {
        p.vivant = false;
        if (dehors) { e.stats.expulses++; e.stats.surfaceExpulsee += p.taille * p.taille; }
        else if (fraction >= 1) e.stats.seches++;
      }
      else restes++;
    }
    e.stats.paires = 0;
    gouttes -= fusionner(e, e.gouttes, budget.gouttes, false);
    restes -= fusionner(e, e.neige, budget.neige, true);
    e.stats.gouttes = gouttes; e.stats.neige = restes;
  }
  function avancerSimulation(e, dt, c, budget) {
    if (!e || !c || c.pause || !Number.isFinite(dt) || dt <= 0) return e?.stats;
    const intensite = c.intensite == null || !Number.isFinite(Number(c.intensite)) ? 1 : clamp(Number(c.intensite), 0, 2);
    if (c.actif === false || c.retro || c.qualite === 'off' || !intensite) { effacer(e); return e.stats; }
    budget = budget || BUDGETS[c.qualite] || BUDGETS.high;
    e.largeur = Math.max(1, Number(c.largeur) || e.largeur); e.hauteur = Math.max(1, Number(c.hauteur) || e.hauteur);
    const pluie = clamp(Number(c.pluie) || 0, 0, 1), neige = clamp(Number(c.neige) || 0, 0, 1);
    const vitesse = clamp(Math.abs(Number(c.vitesse) || 0), 0, 120);
    const vent = clamp((Number(c.ventX) || 0) * .20 + (Number(c.ventZ) || 0) * .08, -8, 8);
    e.accumulateur += Math.min(.25, dt);
    while (e.accumulateur + 1e-10 >= PAS) { avancer(e, c, budget, pluie, neige, vitesse, vent, intensite); e.accumulateur -= PAS; }
    return e.stats;
  }
  // Dessin à la fraction k du pas en cours, entre l'état d'avant le dernier pas et celui d'après : la
  // simulation reste à 30 Hz, le mouvement suit la cadence d'affichage. À k = 1, tracés exacts de l'état du dernier pas.
  function dessiner(e, k) {
    const ctx = e.contexte, w = e.largeur, h = e.hauteur;
    viderPixels(e); ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
    // Quelques traits et contours : ni lecture de pixels, ni réfraction plein écran.
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < e.gouttes.length; i++) {
      const p = e.gouttes[i]; if (!p.vivant && !p.fusion) continue;
      const age = melange(p.pa, p.age, k), a = clamp(Math.min(1, age / .24, (p.duree - age) / 1.5) * melange(p.pp, p.poids, k) * e.opacite, 0, 1);
      if (a <= .005) continue;
      const x = melange(p.px, p.x, k) * w, y = melange(p.py, p.y, k) * h;
      const r = Math.sqrt(melange(p.pr * p.pr, p.vivant ? p.taille * p.taille : 0, k));
      if (r < .05) continue;
      ctx.globalAlpha = a;
      const dx = x - p.traceX[5] * w, dy = y - p.traceY[5] * h;
      if (dx * dx + dy * dy > r * r) {
        // Deux bords d'un film d'eau, suivant la trajectoire des six derniers échantillons. Pas de
        // lecture du framebuffer : l'effet de lentille vient des bords clairs/sombres, pas d'une réfraction.
        for (let bord = 0; bord < 2; bord++) {
          ctx.strokeStyle = bord ? 'rgba(221,241,250,0.20)' : 'rgba(21,43,53,0.14)';
          ctx.lineWidth = Math.max(.55, r * (bord ? .20 : .65));
          const decale = bord ? -r * .24 : 0;
          ctx.beginPath(); ctx.moveTo(p.traceX[5] * w + decale, p.traceY[5] * h);
          for (let j = 4; j >= 0; j--) {
            const tx = p.traceX[j] * w, ty = p.traceY[j] * h;
            const nx = j ? p.traceX[j - 1] * w : x, ny = j ? p.traceY[j - 1] * h : y;
            ctx.quadraticCurveTo(tx + decale, ty, (tx + nx) * .5 + decale, (ty + ny) * .5);
          }
          ctx.lineTo(x + decale, y); ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(23,48,61,0.16)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.36, .12 * p.sin, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(12,31,40,0.35)'; ctx.lineWidth = Math.max(.6, r * .22);
      ctx.beginPath(); ctx.ellipse(x + r * .08, y + r * .13, r * .82, r * 1.04, .12 * p.sin, -.1, 2.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(225,245,253,0.61)'; ctx.lineWidth = Math.max(.65, r * .17);
      ctx.beginPath(); ctx.ellipse(x - r * .13, y - r * .21, r * .73, r * .94, .12 * p.sin, 3.35, 5.8); ctx.stroke();
      ctx.fillStyle = 'rgba(242,252,255,0.48)'; ctx.beginPath();
      ctx.ellipse(x - r * .28, y - r * .55, Math.max(.32, r * .14), Math.max(.4, r * .22), -.3, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < e.neige.length; i++) {
      const p = e.neige[i]; if (!p.vivant && !p.fusion) continue;
      const age = melange(p.pa, p.age, k), f = age / p.duree, a = clamp(Math.min(1, age / .3, (1 - f) * 3) * melange(p.pp, p.poids, k) * e.opacite, 0, 1);
      if (a <= .005) continue;
      const x = melange(p.px, p.x, k) * w, y = melange(p.py, p.y, k) * h;
      const rayon = Math.sqrt(melange(p.pr * p.pr, p.vivant ? p.taille * p.taille : 0, k));
      if (rayon < .05) continue;
      const humide = clamp((f - .18) / .66, 0, 1), r = rayon * (1 - humide * .68), impact = 1 + Math.max(0, 1 - age / .24) * .32;
      // L'impact s'étale en une empreinte humide ; le cœur granuleux se réduit et laisse un ménisque
      // transparent pendant la fonte. La neige ne se transforme pas en croix dessinées sur le verre.
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(71,103,117,0.14)'; ctx.beginPath();
      ctx.ellipse(x, y + rayon * .12, rayon * (1 + humide * .15) * impact, rayon * .72 * impact, p.phase, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(217,237,247,0.38)'; ctx.lineWidth = .75; ctx.beginPath();
      ctx.ellipse(x - rayon * .12, y - rayon * .10, rayon * .92, rayon * .65, p.phase, 3.2, 5.8); ctx.stroke();
      ctx.globalAlpha = a * (1 - humide * .83); ctx.fillStyle = 'rgba(239,247,251,0.72)'; ctx.beginPath();
      ctx.ellipse(x, y, r, r * .63, p.phase, 0, TAU);
      ctx.ellipse(x + p.cos * r * .62, y + p.sin * r * .62, r * .48, r * .55, p.phase + .7, 0, TAU);
      ctx.ellipse(x - p.sin * r * .4, y + p.cos * r * .4, r * .5, r * .36, p.phase - .9, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath();
      ctx.ellipse(x - p.cos * r * .38, y - p.sin * r * .38, r * .24, r * .16, p.phase, 0, TAU);
      ctx.ellipse(x + p.sin * r * .35, y - p.cos * r * .35, r * .18, r * .22, p.phase, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; e.propre = e.stats.gouttes === 0 && e.stats.neige === 0; e.stats.dessins++; e.stats.fraction = k;
    montrer(e, !e.propre);
  }
  function mettreAJour(e, dt, contexte) {
    if (!e || e.libere) return e ? e.stats : null;
    if (e.optique) return B.visiereOptique.mettreAJour(e, dt, contexte);
    const c = contexte || {}, budget = BUDGETS[c.qualite] || BUDGETS.high;
    const intensite = Number.isFinite(Number(c.intensite)) && c.intensite != null ? clamp(Number(c.intensite), 0, 2) : 1;
    if (!e.contexte || c.actif === false || c.retro === true || !intensite || budget === BUDGETS.off) { effacer(e); return e.stats; }
    if (c.pause === true) return e.stats;
    e.opacite = Math.min(1.25, intensite) * (c.cockpit === false ? .55 : 1);
    suivrePalier(e, budget);
    if (!Number.isFinite(dt) || dt <= 0) return e.stats;
    e.accumulateur += Math.min(.25, dt);
    const vide = !e.stats.gouttes && !e.stats.neige;
    if (e.accumulateur + 1e-10 >= PAS) {
      const pluie = clamp(Number(c.pluie) || 0, 0, 1), neige = clamp(Number(c.neige) || 0, 0, 1);
      // Au sec, sous abri ou sans précipitation, visière vide et propre : un pas ne ferait qu'avancer l'horloge
      // (aucun crédit ne peut atteindre un dépôt). On l'avance sans mesurer la toile ni parcourir les pools.
      if (vide && e.propre && !(c.abri ? 0 : neige || pluie || Number(c.embruns) > 0)) {
        while (e.accumulateur + 1e-10 >= PAS) { e.temps += PAS; e.stats.etapes++; e.accumulateur -= PAS; }
        return e.stats;
      }
      dimensionner(e, c, budget);
      const vitesse = clamp(Math.abs(Number(c.vitesse) || 0), 0, 120);
      const vent = clamp((Number(c.ventX) || 0) * .20 + (Number(c.ventZ) || 0) * .08, -8, 8);
      while (e.accumulateur + 1e-10 >= PAS) { avancer(e, c, budget, pluie, neige, vitesse, vent, intensite); e.accumulateur -= PAS; }
    } else if (vide && e.propre) return e.stats;
    if (e.stats.gouttes || e.stats.neige || !e.propre) dessiner(e, clamp(e.accumulateur / PAS, 0, 1));
    return e.stats;
  }
  // Sous le voile de chargement : une goutte et un flocon presque transparents, pour que la première averse ne
  // paie pas la création de la surface et des tracés 2D. Le prochain appel actif les efface.
  function prechauffer(e, contexte) {
    if (!e || e.libere || !e.contexte || !e.canvas) return false;
    if (e.optique) return B.visiereOptique.prechauffer(e, contexte);
    const c = contexte || {}, budget = BUDGETS[c.qualite] || BUDGETS.high;
    if (budget === BUDGETS.off || c.actif === false || c.retro === true || c.intensite === 0) return false;
    suivrePalier(e, budget); dimensionner(e, c, budget); viderPixels(e);
    const ctx = e.contexte, x = e.largeur * .5, y = e.hauteur * .5;
    ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 1 / 255;
    ctx.strokeStyle = 'rgba(182,213,230,0.13)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 9);
    ctx.quadraticCurveTo(x + 1, y - 4, x, y); ctx.stroke();
    ctx.fillStyle = 'rgba(32,63,78,0.10)'; ctx.beginPath(); ctx.ellipse(x, y, 2, 2.7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(232,242,249,0.43)'; ctx.beginPath(); ctx.ellipse(x + 8, y, 3, 1.9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = .55; ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 10, y); ctx.stroke();
    ctx.globalAlpha = 1; e.propre = false; montrer(e, true);
    return true;
  }
  B.vitre = { creer, creerSimulation, avancerSimulation, mettreAJour, prechauffer, effacer, liberer, BUDGETS, MAX_PIXELS, FREQUENCE: 30 };
})(globalThis.BITUME = globalThis.BITUME || {});
