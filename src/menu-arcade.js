// MENU_ARCADE_JS — src/menu-arcade.js (remplacement complet)
(function (B) {
  'use strict';
  const ETAPES = Object.freeze(['p-piste', 'p-conditions', 'p-pilotes', 'p-bilan']);
  const MAX_POINTS = 240, CACHE = new WeakMap(), INSTALLATIONS = new WeakMap();
  const GESTES = Object.freeze(['majeur', 'poing', 'salut']), KLAXONS = Object.freeze(['classique', 'ancien', 'mariage']);
  const borner = (v, a, b) => Math.max(a, Math.min(b, v));

  const THEMES = Object.freeze({
    foret:    { bg0:'#0a1f14', bg1:'#041208', halo:'#1aff6e', grid:'#0f4a2a', accent:'#39ff8e' },
    cote:     { bg0:'#081a2e', bg1:'#030d1a', halo:'#00cfff', grid:'#0a3355', accent:'#00e5ff' },
    marseille:{ bg0:'#071d32', bg1:'#030f1e', halo:'#00c8ff', grid:'#0a3b64', accent:'#ffd166' },
    corail:   { bg0:'#06152a', bg1:'#020a18', halo:'#00b4d8', grid:'#083050', accent:'#48cae4' },
    montagne: { bg0:'#0c1520', bg1:'#050a10', halo:'#7ec8e3', grid:'#1a3050', accent:'#a8dadc' },
    larche:   { bg0:'#0b1422', bg1:'#040912', halo:'#6db3f2', grid:'#162d4a', accent:'#90caf9' },
    andes:    { bg0:'#0a1220', bg1:'#040810', halo:'#5b9bd5', grid:'#142840', accent:'#82b1ff' },
    islande:  { bg0:'#1a0a0a', bg1:'#0d0404', halo:'#ff4500', grid:'#3d1515', accent:'#ff6b35' },
    desert:   { bg0:'#1f1508', bg1:'#0f0a03', halo:'#ffb347', grid:'#3d2a10', accent:'#ffd166' },
    sierra:   { bg0:'#1c1206', bg1:'#0e0903', halo:'#e6a817', grid:'#382510', accent:'#f4c430' },
    asie:     { bg0:'#0a1a14', bg1:'#040d0a', halo:'#00e676', grid:'#0d3328', accent:'#69f0ae' },
    baikal:   { bg0:'#06101e', bg1:'#020810', halo:'#4fc3f7', grid:'#0a2540', accent:'#81d4fa' },
    fjord:    { bg0:'#081a12', bg1:'#030d08', halo:'#26a69a', grid:'#0d3328', accent:'#4db6ac' },
    ecosse:   { bg0:'#0a1810', bg1:'#040c08', halo:'#66bb6a', grid:'#103320', accent:'#81c784' },
    carpates: { bg0:'#0c1a10', bg1:'#050d08', halo:'#4caf50', grid:'#123320', accent:'#a5d6a7' }
  });
  const THEME_DEFAUT = THEMES.foret;
  function themeDe(source) {
    if (!source) return THEME_DEFAUT;
    if (source.id && THEMES[source.id]) return THEMES[source.id];
    if (!source.theme) return THEME_DEFAUT;
    return THEMES[source.theme] || THEME_DEFAUT;
  }

  function normaliserTroll(source) {
    const choix = source && Array.isArray(source.trollPilotes) ? source.trollPilotes : [];
    return [0, 1].map(i => ({
      geste: choix[i] && GESTES.includes(choix[i].geste) ? choix[i].geste : 'majeur',
      klaxon: choix[i] && KLAXONS.includes(choix[i].klaxon) ? choix[i].klaxon : 'classique'
    }));
  }

  // Le jeu garde la zone de décélération dans son circuit. Les cartes s'arrêtent aux
  // coordonnées exactes du drapeau, même si la ligne tombe entre deux échantillons.
  const parcoursDessines = new WeakMap();
  function parcoursChronometre(c) {
    if (!c?.ouvert || !Number.isFinite(c.arrivee) || !(c.pas > 0) || !(c.arrivee > (c.depart || 0))) return c;
    let trace = parcoursDessines.get(c);
    if (trace) return trace;
    const debut = Math.max(0, (c.depart || 0) / c.pas), fin = Math.min(c.n - 1, c.arrivee / c.pas);
    if (fin <= debut) return c;
    const premier = Math.floor(debut) + 1, dernier = Math.ceil(fin) - 1, n = dernier - premier + 3;
    trace = { n, ouvert: true, depart: 0, arrivee: c.arrivee - (c.depart || 0), longueur: c.arrivee - (c.depart || 0),
      theme: c.theme, ligneDroite: c.ligneDroite };
    for (const nom of ['x','y','z','cap','courbure']) {
      const valeurs = c[nom];
      if (!valeurs) continue;
      const t = new Float64Array(n);
      for (let j = premier; j <= dernier; j++) t[j - premier + 1] = valeurs[j];
      for (const [k, f] of [[0,debut],[n-1,fin]]) {
        const i = Math.floor(f), j = Math.min(c.n - 1, i + 1);
        let ecart = valeurs[j] - valeurs[i];
        if (nom === 'cap') ecart -= 2 * Math.PI * Math.round(ecart / (2 * Math.PI));
        t[k] = valeurs[i] + (f - i) * ecart;
      }
      trace[nom] = t;
    }
    parcoursDessines.set(c, trace);
    return trace;
  }

  function preparerTrace(c, maximum = MAX_POINTS) {
    if (!c || !Number.isInteger(c.n) || c.n < 3 || !c.x || !c.z || c.x.length < c.n || c.z.length < c.n || (c.y && c.y.length < c.n)) throw new TypeError('Tracé de circuit incomplet');
    c = parcoursChronometre(c);
    const n = Math.min(c.n, borner(Math.floor(maximum) || MAX_POINTS, 12, MAX_POINTS));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < c.n; i++) {
      const x = c.x[i], y = c.y ? c.y[i] : 0, z = c.z[i];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw new TypeError('Coordonnées de circuit non finies');
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    let rayon = 1;
    for (let i = 0; i < c.n; i++) rayon = Math.max(rayon, Math.hypot(c.x[i] - cx, c.z[i] - cz));
    const diametre = rayon * 2, points = new Float64Array(n * 3), indices = new Uint32Array(n);
    const courbures = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const j = c.ouvert ? Math.round(i * (c.n - 1) / (n - 1)) : Math.floor(i * c.n / n); indices[i] = j;
      points[i * 3] = (c.x[j] - cx) / diametre;
      points[i * 3 + 1] = ((c.y ? c.y[j] : 0) - y0) / diametre;
      points[i * 3 + 2] = (c.z[j] - cz) / diametre;
    }
    // Courbure locale (déterministe, pas de Math.random)
    for (let i = c.ouvert ? 1 : 0; i < (c.ouvert ? n - 1 : n); i++) {
      const p = (i - 1 + n) % n, s = (i + 1) % n;
      const dx1 = points[i*3]-points[p*3], dz1 = points[i*3+2]-points[p*3+2];
      const dx2 = points[s*3]-points[i*3], dz2 = points[s*3+2]-points[i*3+2];
      const cross = dx1*dz2 - dz1*dx2;
      const len = Math.hypot(dx1,dz1)*Math.hypot(dx2,dz2) || 1;
      courbures[i] = Math.abs(cross) / len;
    }
    // Sommet (point le plus haut)
    let sommet = 0;
    for (let i = 1; i < n; i++) if (points[i*3+1] > points[sommet*3+1]) sommet = i;
    return Object.freeze({ n, points, indices, diametre, centre: Object.freeze([cx, y0, cz]),
      relief: (y1 - y0) / diametre, altitudeMin: y0, altitudeMax: y1, longueur: c.longueur || 0,
      ouvert: !!c.ouvert, courbures, sommet, theme: c.theme || 'foret',
      depart: 0 });
  }

  function cadrer(trace, largeur, hauteur, cadre) {
    if (!(Number.isFinite(largeur) && largeur > 0 && Number.isFinite(hauteur) && hauteur > 0)) throw new RangeError('Taille de projection invalide');
    const distance = 2.8 + trace.relief * .704, proche = distance - .355 - trace.relief * .704;
    const haut = (-.352 - trace.relief * .71) / proche, bas = .352 / (distance + .355);
    const zoom = Math.min(largeur * .84 * proche, hauteur * .77 / (bas - haut));
    cadre[0] = zoom; cadre[1] = hauteur * .535 - (haut + bas) * zoom / 2; cadre[2] = distance;
    return cadre;
  }

  function projeter(trace, rotation, largeur, sortie, cadre) {
    if (!Number.isFinite(rotation)) throw new RangeError('Rotation de projection invalide');
    if (sortie.length < trace.n * 3) throw new RangeError('Tampon de projection trop petit');
    const co = Math.cos(rotation), si = Math.sin(rotation), zoom = cadre[0], centreY = cadre[1], distance = cadre[2];
    for (let i = 0; i < trace.n; i++) {
      const x = trace.points[i * 3], y = trace.points[i * 3 + 1], z = trace.points[i * 3 + 2];
      const rx = x * co - z * si, rz = x * si + z * co, profondeur = distance + rz * .71 - y * .704;
      sortie[i * 3] = largeur / 2 + rx * zoom / profondeur;
      sortie[i * 3 + 1] = centreY + (rz * .704 - y * .71) * zoom / profondeur;
      sortie[i * 3 + 2] = profondeur;
    }
    return sortie;
  }

  function projeterTrace(trace, rotation, largeur, hauteur, sortie = new Float64Array(trace.n * 3)) {
    return projeter(trace, rotation, largeur, sortie, cadrer(trace, largeur, hauteur, new Float64Array(3)));
  }

  // ─── APERÇU CANVAS 2D ARCADE ───────────────────────────────────────────────
  function creerApercu(canvas) {
    const doc = canvas.ownerDocument, vue = doc.defaultView;
    let ctx = null, source = null, affiche = null, trace = null, proj = null, ordre = [], rotation = -.7, dernier = -Infinity, largeur = 720, hauteur = 400;
    let tailleSale = true, imageSale = true, pause = false, visible = false, reduit = false, fond = null, detruit = false, sansContexte = false, ancienLeger = null;
    const media = vue.matchMedia && vue.matchMedia('(prefers-reduced-motion: reduce)');
    reduit = !!(media && media.matches);
    const compte = { images: 0, points: 0, preparations: 0, derniereMs: 0, maximumMs: 0, resolution: [720, 400] };
    const trier = (a, b) => proj[b * 3 + 2] - proj[a * 3 + 2];
    const redimensionner = () => { tailleSale = imageSale = true; };
    const suspendre = () => { visible = false; dernier = -Infinity; };
    const visibilite = () => { suspendre(); imageSale = true; };
    const mouvement = e => { reduit = !!e.matches; imageSale = true; dernier = -Infinity; };
    const observer = typeof vue.ResizeObserver === 'function' ? new vue.ResizeObserver(redimensionner) : null;
    if (observer) observer.observe(canvas);
    vue.addEventListener('resize', redimensionner); doc.addEventListener('visibilitychange', visibilite);
    if (media && media.addEventListener) media.addEventListener('change', mouvement);
    else if (media && media.addListener) media.addListener(mouvement);
    const sol = new Float64Array(6), cadre = new Float64Array(3);
    let co = 1, si = 0;
    function pointSol(x, z, offset) {
      const rx = x * co - z * si, rz = x * si + z * co, y = -.035, p = cadre[2] + rz * .71 - y * .704;
      sol[offset] = largeur / 2 + rx * cadre[0] / p;
      sol[offset + 1] = cadre[1] + (rz * .704 - y * .71) * cadre[0] / p;
    }
    function dimensionner(leger, r) {
      const facteur = Math.min(vue.devicePixelRatio || 1, leger ? 1 : 1.25, (leger ? 640 : 960) / r.width, (leger ? 360 : 540) / r.height);
      largeur = Math.max(1, Math.round(r.width * facteur)); hauteur = Math.max(1, Math.round(r.height * facteur));
      if (canvas.width !== largeur) canvas.width = largeur;
      if (canvas.height !== hauteur) canvas.height = hauteur;
      compte.resolution[0] = largeur; compte.resolution[1] = hauteur;
      cadrer(trace, largeur, hauteur, cadre); tailleSale = false;
    }

    function dessiner(t, actif, leger = false) {
      if (detruit || !actif || doc.hidden || !source || sansContexte || canvas.closest('[hidden],[inert],[aria-hidden="true"]')) { suspendre(); return false; }
      t = Number.isFinite(t) ? t : vue.performance.now();
      if (t < dernier) dernier = -Infinity;
      if (t - dernier + .000001 < (leger ? 50 : 1000 / 30)) return false;
      if (visible && source === affiche && (pause || reduit) && !imageSale && !tailleSale && ancienLeger === !!leger) return false;
      const rectangle = canvas.getBoundingClientRect();
      const style = vue.getComputedStyle && vue.getComputedStyle(canvas);
      if (!(rectangle.width > 0 && rectangle.height > 0) || style && (style.visibility === 'hidden' || style.visibility === 'collapse') ||
          rectangle.bottom <= 0 || rectangle.right <= 0 || rectangle.top >= vue.innerHeight || rectangle.left >= vue.innerWidth) { suspendre(); return false; }
      if (!ctx) { ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) { sansContexte = true; suspendre(); return false; } }
      const debut = vue.performance.now();
      if (source !== affiche) {
        let prochain = CACHE.get(source);
        if (!prochain) { prochain = preparerTrace(source); if (!prochain) return false; CACHE.set(source, prochain); compte.preparations++; }
        trace = prochain; affiche = source;
        proj = new Float64Array(trace.n * 3); ordre = Array.from({ length: trace.n }, (_, i) => i);
        rotation = -.7; compte.points = trace.n; tailleSale = imageSale = true; dernier = -Infinity;
      }
      if (!visible) { visible = true; tailleSale = imageSale = true; dernier = -Infinity; }
      if (ancienLeger !== !!leger) { ancienLeger = !!leger; tailleSale = imageSale = true; }
      if ((pause || reduit) && !imageSale && !tailleSale) return false;
      if (!pause && !reduit && Number.isFinite(dernier)) rotation = (rotation + Math.min(.1, Math.max(0, (t - dernier) / 1000)) * .19) % (Math.PI * 2);
      if (tailleSale) dimensionner(leger, rectangle);
      co = Math.cos(rotation); si = Math.sin(rotation);
      dernier = t; imageSale = false;

      const th = themeDe(source);
      const tNorm = (t / 1000) % 100; // temps normalisé pour animations

      // ── FOND ATMOSPHÉRIQUE DYNAMIQUE ──
      const grad = ctx.createLinearGradient(0, 0, 0, hauteur);
      grad.addColorStop(0, th.bg0); grad.addColorStop(1, th.bg1);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, largeur, hauteur);
      // Halo radial néon
      if (typeof ctx.createRadialGradient === 'function') {
        const hx = largeur * .5, hy = hauteur * .38;
        const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, largeur * .55);
        halo.addColorStop(0, th.halo + '22'); halo.addColorStop(.6, th.halo + '0a'); halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo; ctx.fillRect(0, 0, largeur, hauteur);
      }

      // ── GRILLE PERSPECTIVE ARCADE ──
      const scrollOff = (pause || reduit) ? 0 : (tNorm * .04) % .12;
      ctx.strokeStyle = th.grid + '55'; ctx.lineWidth = Math.max(.5, largeur / 1400); ctx.beginPath();
      for (let k = -6; k <= 6; k++) {
        const off = k * .12 + scrollOff;
        pointSol(off, -.7, 0); pointSol(off, .7, 3);
        ctx.moveTo(sol[0], sol[1]); ctx.lineTo(sol[3], sol[4]);
        pointSol(-.7, off, 0); pointSol(.7, off, 3);
        ctx.moveTo(sol[0], sol[1]); ctx.lineTo(sol[3], sol[4]);
      }
      ctx.stroke();

      // ── PROJECTION ──
      projeter(trace, rotation, largeur, proj, cadre);
      const limiteSol = trace.ouvert ? trace.n - 1 : trace.n;

      // ── RIDEAU TOPOGRAPHIQUE 3D (facettes verticales) ──
      ctx.globalAlpha = .18;
      for (let i = 0; i < limiteSol; i++) {
        const j = (i + 1) % trace.n;
        pointSol(trace.points[i*3], trace.points[i*3+2], 0);
        const sx0 = sol[0], sy0 = sol[1];
        pointSol(trace.points[j*3], trace.points[j*3+2], 0);
        const sx1 = sol[0], sy1 = sol[1];
        ctx.fillStyle = th.accent + '30';
        ctx.beginPath();
        ctx.moveTo(proj[i*3], proj[i*3+1]);
        ctx.lineTo(proj[j*3], proj[j*3+1]);
        ctx.lineTo(sx1, sy1);
        ctx.lineTo(sx0, sy0);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── OMBRE PORTÉE AU SOL ──
      ctx.strokeStyle = 'rgba(0,0,0,.42)'; ctx.lineWidth = Math.max(6, largeur / 55); ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i <= limiteSol; i++) {
        const j = i % trace.n; pointSol(trace.points[j*3], trace.points[j*3+2], 0);
        if (i) ctx.lineTo(sol[0], sol[1]); else ctx.moveTo(sol[0], sol[1]);
      }
      if (!trace.ouvert) ctx.closePath();
      ctx.stroke();

      // ── SUPPORTS VERTICAUX ──
      ctx.strokeStyle = th.accent + '35'; ctx.lineWidth = Math.max(1, largeur / 800); ctx.beginPath();
      for (let i = 0; i < trace.n; i += Math.max(1, Math.floor(trace.n / 22))) {
        pointSol(trace.points[i*3], trace.points[i*3+2], 0);
        ctx.moveTo(proj[i*3], proj[i*3+1]); ctx.lineTo(sol[0], sol[1]);
      }
      ctx.stroke();

      // ── TRI PROFONDEUR ──
      ordre.sort(trier);
      ctx.lineCap = 'round';

      // ── RUBAN NÉON MULTICOUCHE ──
      for (const i of ordre) {
        if (trace.ouvert && i >= trace.n - 1) continue;
        const j = (i + 1) % trace.n;
        const e = Math.min(largeur, hauteur * 2) / 100 * cadre[2] / proj[i * 3 + 2];
        const courb = trace.courbures ? trace.courbures[i] : 0;
        const rapide = courb < .12;

        // Couche 1 : Halo lumineux
        ctx.beginPath(); ctx.moveTo(proj[i*3], proj[i*3+1]); ctx.lineTo(proj[j*3], proj[j*3+1]);
        ctx.strokeStyle = rapide ? 'rgba(0,255,220,.25)' : 'rgba(255,100,30,.3)';
        ctx.lineWidth = Math.max(10, e * 2.8); ctx.stroke();

        // Couche 2 : Chaussée + vibreurs
        ctx.beginPath(); ctx.moveTo(proj[i*3], proj[i*3+1]); ctx.lineTo(proj[j*3], proj[j*3+1]);
        ctx.strokeStyle = '#1a1e24'; ctx.lineWidth = Math.max(6, e * 1.6); ctx.stroke();
        // Vibreurs
        ctx.strokeStyle = i % 12 < 6 ? '#e63946' : '#f1faee';
        ctx.lineWidth = Math.max(4, e); ctx.stroke();
        // Bordure brillante
        ctx.strokeStyle = th.accent + '99'; ctx.lineWidth = Math.max(2, e * .45); ctx.stroke();

        // Couche 3 : Ligne centrale lumineuse
        ctx.beginPath(); ctx.moveTo(proj[i*3], proj[i*3+1]); ctx.lineTo(proj[j*3], proj[j*3+1]);
        ctx.strokeStyle = rapide ? 'rgba(0,255,200,.7)' : 'rgba(255,200,50,.6)';
        ctx.lineWidth = Math.max(1.5, e * .3); ctx.stroke();
      }

      // ── 3 BOLIDES LUMINEUX AVEC TRAÎNÉE COMÈTE ──
      const bolides = [0, .333, .666];
      const couleursBolide = ['#ff3860', '#00e5ff', '#ffd600'];
      for (let b = 0; b < 3; b++) {
        const frac = (((rotation / (Math.PI * 2) + bolides[b]) % 1) + 1) % 1;
        const idx = Math.floor(frac * trace.n) % trace.n;
        const px = proj[idx * 3], py = proj[idx * 3 + 1];
        const r = Math.max(3.5, largeur / 120);
        // Traînée comète (5 segments derrière, sans saut entre fin et départ sur parcours ouvert)
        ctx.lineCap = 'round';
        for (let s = 5; s >= 1; s--) {
          if (trace.ouvert && idx - s < 0) continue;
          const si2 = ((idx - s) % trace.n + trace.n) % trace.n;
          const prev = ((idx - s + 1) % trace.n + trace.n) % trace.n;
          const alpha = (.6 - s * .1).toFixed(2);
          ctx.beginPath(); ctx.moveTo(proj[si2 * 3], proj[si2 * 3 + 1]);
          ctx.lineTo(proj[prev * 3], proj[prev * 3 + 1]);
          ctx.strokeStyle = couleursBolide[b] + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = Math.max(2, r * (1 - s * .15)); ctx.stroke();
        }
        // Bolide
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = couleursBolide[b]; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, r * .45, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
      }

      // ── BALISES ANIMÉES ──
      const pulse = (pause || reduit) ? 1 : .7 + .3 * Math.sin(tNorm * 4);
      // DÉPART (or pulsant)
      const dx = proj[0], dy = proj[1], dr = Math.max(4, largeur / 130) * pulse;
      ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fillStyle = '#f5bc5b'; ctx.fill();
      ctx.strokeStyle = '#f5bc5b'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(dx, dy - dr); ctx.lineTo(dx, dy - dr - hauteur * .07); ctx.stroke();
      ctx.fillStyle = '#f5bc5b'; ctx.font = '700 ' + Math.max(9, largeur / 70) + 'px system-ui';
      ctx.textAlign = 'center'; ctx.fillText('DÉPART', dx, Math.max(12, dy - dr - hauteur * .085));

      // SOMMET (cyan si dénivelé > 15m)
      if (trace.altitudeMax - trace.altitudeMin > 15 && trace.sommet > 0) {
        const sx = proj[trace.sommet*3], sy = proj[trace.sommet*3+1];
        const sr = Math.max(3.5, largeur / 150) * pulse;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff'; ctx.fill();
        ctx.fillStyle = '#00e5ff'; ctx.font = '700 ' + Math.max(8, largeur / 80) + 'px system-ui';
        ctx.textAlign = 'center'; ctx.fillText('SOMMET', sx, sy - sr - 6);
      }

      // ARRIVÉE (rouge/blanc si ouvert)
      if (trace.ouvert) {
        const ai = trace.n - 1;
        const ax = proj[ai*3], ay = proj[ai*3+1];
        const ar = Math.max(4, largeur / 130) * pulse;
        ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2);
        ctx.fillStyle = '#e63946'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.max(9, largeur / 70) + 'px system-ui';
        ctx.textAlign = 'center'; ctx.fillText('ARRIVÉE', ax, ay - ar - 8);
      }

      ctx.lineCap = 'butt';
      compte.images++; compte.derniereMs = vue.performance.now() - debut; compte.maximumMs = Math.max(compte.maximumMs, compte.derniereMs);
      return true;
    }

    return Object.freeze({
      choisir(c) {
        if (detruit || source === c) return;
        if (!c || typeof c !== 'object') throw new TypeError('Tracé incomplet');
        source = c; imageSale = true;
      },
      dessiner, suspendre,
      pause(value) { if (pause !== !!value) { pause = !!value; imageSale = true; dernier = -Infinity; } },
      detruire() {
        if (detruit) return;
        detruit = true; suspendre();
        if (observer) observer.disconnect();
        vue.removeEventListener('resize', redimensionner); doc.removeEventListener('visibilitychange', visibilite);
        if (media && media.removeEventListener) media.removeEventListener('change', mouvement);
        else if (media && media.removeListener) media.removeListener(mouvement);
        source = affiche = trace = proj = fond = ctx = null; ordre.length = 0;
      },
      get enPause() { return pause; },
      get mouvementReduit() { return reduit; },
      stats() { return { ...compte, resolution: [...compte.resolution], rotation, actif: visible, pause: pause || reduit,
        altitudeMin: trace ? trace.altitudeMin : null, altitudeMax: trace ? trace.altitudeMax : null, detruit }; }
    });
  }

  // ─── INSTALLATION MENU ─────────────────────────────────────────────────────
  function installer(zone, options = {}) {
    if (INSTALLATIONS.has(zone)) return INSTALLATIONS.get(zone);
    const doc = zone.ownerDocument, $ = id => doc.getElementById(id), apercu = creerApercu($('p-trace-3d'));
    let etape = 0, version = 0, reliefSale = false, detruit = false, mouvementAffiche = null;
    const retirer = [], ecouter = (el, type, f) => { el.addEventListener(type, f); retirer.push(() => el.removeEventListener(type, f)); };
    const avancer = (sens, focus = true) => ouvrir(borner(etape + sens, 0, ETAPES.length - 1), focus);
    function actualiser() {
      if (detruit) return;
      version++;
      const actif = zone.querySelector('[data-menu-tab][aria-selected="true"]');
      const precedente = etape;
      etape = Math.max(0, ETAPES.indexOf(actif && actif.dataset.menuTab));
      if (etape !== precedente) {
        const contenu = zone.querySelector('.panneaux-menu');
        if (contenu) contenu.scrollTop = 0;
      }
      zone.dataset.etape = String(etape);
      $('p-etape').textContent = '0' + (etape + 1) + ' / 04';
      $('b-precedent').textContent = etape ? 'Précédent' : 'Menu';
      $('b-suivant').hidden = etape === 3; $('b-depart').hidden = false;
      $('b-suivant').textContent = ['Conditions →', 'Pilotes →', 'Récapitulatif →'][etape] || 'Continuer';
      if (etape !== 0) apercu.suspendre();
      if (options.actualiser) options.actualiser(etape);
    }
    function disponible(el) {
      if (!el || el.disabled || el.matches(':disabled') || el.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]') || !el.getClientRects().length) return false;
      const style = doc.defaultView.getComputedStyle(el);
      return style.visibility !== 'hidden' && style.visibility !== 'collapse';
    }
    function focaliser() {
      const panneau = $(ETAPES[etape]);
      const selection = Array.from(panneau.querySelectorAll('[role="radio"][aria-checked="true"],input:checked')).find(disponible);
      const cible = selection || Array.from(panneau.querySelectorAll('select,button,input')).find(disponible) || (etape === 3 ? $('b-depart') : $('b-suivant'));
      if (disponible(cible)) {
        cible.focus({ preventScroll: true });
        const voyant = cible.type === 'radio' || cible.type === 'checkbox' ? cible.closest('label') || cible : cible;
        voyant.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
    }
    function ouvrir(index, focus = true) {
      if (detruit) return false;
      const avant = version, cible = ETAPES[borner(Number.isFinite(index) ? Math.trunc(index) : 0, 0, ETAPES.length - 1)];
      if (!B.navigationMenu.ouvrirOnglet(zone, cible)) return false;
      if (version === avant) actualiser();
      if (focus) focaliser();
      return true;
    }
    ecouter(zone, 'menuongletchange', actualiser);
    ecouter($('b-suivant'), 'click', () => avancer(1));
    ecouter($('b-precedent'), 'click', () => options.retour && options.retour());
    ecouter($('p-retour'), 'click', () => options.retour && options.retour());
    function rotation() {
      const bouton = $('p-rotation'), r = apercu.mouvementReduit;
      mouvementAffiche = r; bouton.disabled = r;
      bouton.setAttribute('aria-pressed', String(apercu.enPause || r));
      bouton.textContent = r ? 'Rotation désactivée' : apercu.enPause ? 'Reprendre la rotation' : 'Figer le tracé';
      bouton.title = r ? 'Mouvement réduit demandé dans le système' : '';
    }
    rotation();
    ecouter($('p-rotation'), 'click', () => { apercu.pause(!apercu.enPause); rotation(); });
    const grille = $('circuits');
    function alignerNavigationGrille() {
      if (!grille.getClientRects().length) return;
      const style = doc.defaultView.getComputedStyle(grille);
      const colonnes = style.display === 'grid' ? style.gridTemplateColumns.trim().split(/\s+/).length : 1;
      grille.dataset.menuCols = String(colonnes);
      grille.dataset.menuAxis = colonnes === 1 ? 'vertical' : 'horizontal';
    }
    ecouter(grille, 'focusin', alignerNavigationGrille);
    ecouter(doc.defaultView, 'resize', () => { if (grille.contains(doc.activeElement)) alignerNavigationGrille(); });
    ecouter(grille, 'keydown', e => {
      const carte = e.target.closest('[role="radio"]'); if (!carte || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !disponible(carte)) return;
      const liste = Array.from($('circuits').querySelectorAll('[role="radio"]')).filter(disponible), i = liste.indexOf(carte);
      if (i < 0) return;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
        e.preventDefault();
        const cols = Number.parseInt($('circuits').dataset.menuCols || '1', 10) || 1;
        let j = i;
        if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = liste.length - 1;
        else if (e.key === 'ArrowLeft') j = (i - 1 + liste.length) % liste.length;
        else if (e.key === 'ArrowRight') j = (i + 1) % liste.length;
        else if (e.key === 'ArrowUp') {
          const colonne = i % cols;
          j = i >= cols ? i - cols : colonne + Math.floor((liste.length - 1 - colonne) / cols) * cols;
        } else if (e.key === 'ArrowDown') j = i + cols < liste.length ? i + cols : i % cols;
        liste[j].click(); liste[j].focus({ preventScroll: true }); liste[j].scrollIntoView({ block: 'nearest', behavior: 'auto' });
      } else if (e.key === 'Enter' && carte.getAttribute('aria-checked') === 'true') {
        e.preventDefault(); if (!e.repeat) { const dep = $('b-depart'); if (dep && !dep.disabled) dep.click(); else avancer(1); }
      }
    });
    const api = Object.freeze({
      ouvrir, actualiser,
      retour() { if (detruit || !etape) return false; avancer(-1); return true; },
      valider(el) { if (!detruit && etape === 0 && disponible(el) && zone.contains(el) && el.closest('#circuits') && el.getAttribute('aria-checked') === 'true') { const dep = $('b-depart'); if (dep && !dep.disabled) { dep.click(); return true; } avancer(1); return true; } return false; },
      trace(c, fiche, catalogue, index, total) {
        if (detruit) return;
        apercu.choisir(c); $('p-trace-3d').setAttribute('aria-label', 'Tracé en trois dimensions de ' + catalogue.nom + ', avec son relief réel');
        $('p-circuit-nom').textContent = catalogue.nom; $('p-circuit-lieu').textContent = catalogue.lieu;
        $('p-circuit-numero').textContent = String(index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
        $('p-circuit-km').textContent = fiche.km; $('p-circuit-virages').textContent = String(fiche.virages);
        const tr = CACHE.get(c); reliefSale = !tr;
        $('p-circuit-relief').textContent = tr ? String(Math.round(tr.altitudeMax - tr.altitudeMin)) : '…';
      },
      image(t, actif, leger) {
        if (detruit) return false;
        if (mouvementAffiche !== apercu.mouvementReduit) rotation();
        const dessine = apercu.dessiner(t, actif && etape === 0, leger);
        if (dessine && reliefSale) { const s = apercu.stats(); $('p-circuit-relief').textContent = String(Math.round(s.altitudeMax - s.altitudeMin)); reliefSale = false; }
        return dessine;
      },
      suspendre: apercu.suspendre,
      detruire() { if (!detruit) { detruit = true; retirer.forEach(f => f()); apercu.detruire(); INSTALLATIONS.delete(zone); } },
      get etape() { return etape; },
      stats: () => ({ etape, ...apercu.stats() })
    });
    INSTALLATIONS.set(zone, api);
    return api;
  }

  B.menuArcade = Object.freeze({ ETAPES, MAX_POINTS, parcoursChronometre, preparerTrace, cadrer, projeter, projeterTrace, creerApercu, installer, normaliserTroll });
})(globalThis.BITUME = globalThis.BITUME || {});
