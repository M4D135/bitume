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
  const nombre = (v, defaut = 0) => v != null && Number.isFinite(Number(v)) ? Number(v) : defaut;
  // Repère écran commun au Canvas et à l'optique : x vers la droite, y vers le bas.
  // deriveX/Y s'expriment en hauteurs d'écran par seconde (x est donc multiplié par h/w),
  // expansion en secondes inverses et graviteX/Y sont la projection de la verticale monde.
  // L'appelant conserve out : aucun vecteur ni objet transitoire dans les pas de simulation.
  function calculerFlux(c, out) {
    const yaw = nombre(c.cameraYaw), pitch = nombre(c.cameraPitch), roll = nombre(c.cameraRoll);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    const rx = cy * cr - sy * sp * sr, ry = cp * sr, rz = sy * cr + cy * sp * sr;
    const ux = -sy * sp * cr - cy * sr, uy = cp * cr, uz = cy * sp * cr - sy * sr;
    const fx = sy * cp, fy = sp, fz = -cy * cp;
    const vectoriel = (c.vitesseX != null && Number.isFinite(Number(c.vitesseX))) ||
      (c.vitesseY != null && Number.isFinite(Number(c.vitesseY))) || (c.vitesseZ != null && Number.isFinite(Number(c.vitesseZ)));
    // Compatibilité des anciens contextes : la vitesse signée suit leur axe de visée.
    const vitesse = clamp(nombre(c.vitesse), -120, 120);
    const vx = vectoriel ? nombre(c.vitesseX) : fx * vitesse;
    const vy = vectoriel ? nombre(c.vitesseY) : fy * vitesse;
    const vz = vectoriel ? nombre(c.vitesseZ) : fz * vitesse;
    const wx = clamp(nombre(c.ventX) - vx, -240, 240), wy = clamp(nombre(c.ventY) - vy, -240, 240), wz = clamp(nombre(c.ventZ) - vz, -240, 240);
    const norme = Math.hypot(wx, wy, wz), entrant = Math.max(0, -(wx * fx + wy * fy + wz * fz));
    const tangentX = wx * rx + wy * ry + wz * rz, tangentY = wx * ux + wy * uy + wz * uz;
    // Seule la normale entrante charge la face observée. Dos au vent, la composante
    // qui s'en éloigne ne devient ni pression frontale ni aspiration ; le cisaillement
    // tangent et la gravité restent présents, y compris en dérive ou avec du vent latéral.
    const expose = Math.hypot(entrant, tangentX, tangentY), incidence = norme > 1e-9 ? entrant / norme : 0;
    const air = Math.pow(clamp((expose - 8) / 100, 0, 1), 1.65);
    out.air = air; out.vitesseAir = norme; out.vitesseIncidente = entrant;
    out.expansion = .80 * air * incidence;
    out.deriveX = clamp(tangentX, -120, 120) * .0028;
    out.deriveY = -clamp(tangentY, -120, 120) * .0028;
    out.graviteX = -ry; out.graviteY = uy; out.centreX = .5; out.centreY = .45;
    return out;
  }
  // Mélange exact aux bornes : k = 0 rend l'état du pas précédent, k = 1 celui du dernier pas, au bit près.
  const melange = (a, b, k) => a * (1 - k) + b * k;
  const hache = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  function pool(nombre) {
    const p = new Array(nombre);
    // px, py, pa et pp gardent position, âge et poids d'avant le dernier pas, pour dessiner entre deux pas.
    for (let i = 0; i < nombre; i++) p[i] = { vivant: false, fusion: false, x: 0, y: 0, age: 0, duree: 0,
      taille: 0, vitesse: 0, phase: 0, frequence: 0, glisse: 0, poids: 0, fondu: false, cos: 1, sin: 0,
      px: 0, py: 0, pa: 0, pp: 0, pr: 0, fonte: 0, traceAge: 0,
      impactAge: 0, impactAvant: 0, impactDuree: 0, impactForce: 0, impactRayon: 0,
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
  const BANDES_FUSION = 24, MOTS_FUSION = Math.ceil(BUDGETS.ultra.gouttes / 32);
  // Neuf perles fines par arrivée d'eau dans le repli 2D.
  const FINES_PAR_ARRIVEE = 9, PAS_FINE = 7; // x, y, x précédent, y précédent, âge, durée, rayon CSS
  const GRILLE_FINES = 32, MAX_RAYON_FINE = 1.9;
  const celluleFine = x => clamp(Math.floor(x * GRILLE_FINES), 0, GRILLE_FINES - 1);
  function creerSimulation(options, canvas = null, contexte = null) {
    const e = { canvas, contexte, gouttes: pool(112), neige: pool(36), accumulateur: 0, temps: 0, sequence: 0, masquee: false,
      graine: options && Number.isInteger(options.graine) ? options.graine | 0 : 0,
      bandesFusion: new Uint32Array(BANDES_FUSION * MOTS_FUSION), motFusion: new Uint32Array(MOTS_FUSION),
      fines: contexte ? {
        points: new Float32Array(BUDGETS.ultra.gouttes * FINES_PAR_ARRIVEE * PAS_FINE),
        cellules: new Int16Array(GRILLE_FINES * GRILLE_FINES),
        suivants: new Int16Array(BUDGETS.ultra.gouttes * FINES_PAR_ARRIVEE),
        fin: 0, prochain: 0, sequence: 0
      } : null,
      creditEau: 0, creditNeige: 0, largeur: canvas ? canvas.clientWidth || canvas.width || 1 : 1280,
      hauteur: canvas ? canvas.clientHeight || canvas.height || 1 : 720, dpr: 1, dprPalier: null, propre: true, libere: false,
      flux: { air: 0, vitesseAir: 0, vitesseIncidente: 0, expansion: 0, deriveX: 0, deriveY: 0, graviteX: 0, graviteY: 1, centreX: .5, centreY: .45 },
      opacite: 1, opaciteAbri: 1, impactsActifs: false, impactTampon: new Float32Array(4),
      stats: { backend: 'canvas2d', pret: !!contexte, gouttes: 0, microgouttes: 0, neige: 0, dessins: 0, etapes: 0, largeur: 0, hauteur: 0, dpr: 1, pixels: 0, fraction: 0,
        fusionsEau: 0, fusionsNeige: 0, fonte: 0, expulses: 0, seches: 0, surfaceExpulsee: 0,
        depotsEau: 0, depotsEmbruns: 0, impactsEmis: 0, eauEvacuee: 0, paires: 0 } };
    montrer(e, false); // toile neuve, vide
    return e;
  }
  function viderPixels(e) {
    if (!e.contexte || !e.canvas) return;
    e.contexte.setTransform(1, 0, 0, 1, 0, 0); e.contexte.globalAlpha = 1;
    e.contexte.clearRect(0, 0, e.canvas.width, e.canvas.height); e.propre = true;
  }
  function viderDepots(e) {
    for (let i = 0; i < e.gouttes.length; i++) e.gouttes[i].vivant = e.gouttes[i].fusion = false;
    for (let i = 0; i < e.neige.length; i++) e.neige[i].vivant = e.neige[i].fusion = false;
    if (e.fines) e.fines.fin = e.fines.prochain = 0;
    e.stats.gouttes = e.stats.microgouttes = e.stats.neige = 0;
    e.creditEau = e.creditNeige = 0;
    e.impactsActifs = false; e.impactTampon.fill(0);
  }
  const sansApport = (c, pluie, neige) => c.abri || (!pluie && !neige && !(Number(c.embruns) > 0));
  // Une fusion reste dessinable jusqu'au pas suivant, même si son dépôt n'est plus compté.
  const depotsDessinables = e => e.stats.gouttes || e.stats.neige || e.fines?.fin ||
    e.gouttes.some(p => p.fusion) || e.neige.some(p => p.fusion);
  function effacer(e) {
    if (!e) return;
    if (e.optique) { B.visiereOptique.effacer(e); return; }
    if (!e.propre) viderPixels(e);
    montrer(e, false);
    viderDepots(e);
    e.accumulateur = 0;
    e.opaciteAbri = 1;
    e.dprPalier = null; // nouvelle séance : le prochain appel actif reprend la définition du palier courant
  }
  function liberer(e) {
    if (!e || e.libere) return;
    if (e.optique) { B.visiereOptique.liberer(e); return; }
    effacer(e); e.canvas = null; e.contexte = null; e.fines = null; e.libere = true;
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
  function deposer(e, neige, limite, x, y, taille, echelle = 1, impact = 0) {
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
    // L'arrivée se tasse en 180–280 ms, puis seule la perle transportée demeure.
    // Horloge distincte : une fusion ou la fonte ne doit jamais rejouer une éclaboussure.
    p.impactAge = p.impactAvant = 0; p.impactDuree = .18 + hache(seed + 53) * .10;
    p.impactForce = neige ? 0 : impact * (.8 + .2 * hache(seed + 59));
    // Même une perle fine éclate sur quelques pixels CSS avant de se rassembler.
    // Le plafond reste local ; une grande goutte ne peut pas blanchir toute la vue.
    p.impactRayon = Math.min(14, (p.taille + 2.5) * (.9 + .35 * Math.min(1, p.impactForce)));
    if (p.impactForce > 0) e.stats.impactsEmis++;
    p.traceX.fill(p.x); p.traceY.fill(p.y); return true;
  }
  const impactsExposes = c => !c.abri && !(Number(c.neige) > 0) && (Number(c.pluie) > 0 || Number(c.embruns) > 0);
  function deposerFines(e, limite, x, y) {
    if (!limite) return;
    const f = e.fines, points = f.points, enGerbe = Number.isFinite(x);
    for (let j = 0; j < FINES_PAR_ARRIVEE; j++) {
      if (f.prochain >= limite) f.prochain = 0;
      const i = f.prochain++ * PAS_FINE, graine = Math.imul(++f.sequence, 1597334677) ^ e.graine;
      const a = hache(graine), b = hache(graine + 13);
      points[i] = points[i + 2] = enGerbe ? x + (a - .5) * .17 * e.hauteur / e.largeur : a;
      points[i + 1] = points[i + 3] = enGerbe ? y + (b - .5) * .17 : b;
      points[i + 4] = 0; points[i + 5] = 8 + hache(graine + 29) * 13;
      points[i + 6] = .7 + hache(graine + 41) * (enGerbe ? 1.2 : .8);
      f.fin = Math.max(f.fin, f.prochain);
    }
  }
  function avancerFines(e, limite, mouille) {
    const f = e.fines, points = f.points, flux = e.flux, aspect = e.hauteur / e.largeur;
    const expansion = flux.expansion * .37, dx = flux.deriveX * .37 * aspect, dy = flux.deriveY * .37;
    const age = PAS * (mouille ? 1 : 1.55);
    f.fin = Math.min(f.fin, limite);
    if (f.prochain > limite) f.prochain = 0;
    let actives = 0;
    for (let j = 0; j < f.fin; j++) {
      const i = j * PAS_FINE;
      if (points[i + 5] <= 0) {
        points[i + 5] = 0;
        continue;
      }
      const x = points[i + 2] = points[i], y = points[i + 3] = points[i + 1];
      const poids = .8 * (points[i + 6] * .35 + 1.5) / 720;
      points[i] += PAS * (dx + flux.graviteX * poids * aspect + (x - flux.centreX) * expansion);
      points[i + 1] += PAS * (dy + flux.graviteY * poids + (y - flux.centreY) * expansion);
      points[i + 4] += age;
      if (points[i + 4] >= points[i + 5] || x < -.01 || x > 1.01 || y < -.01 || y > 1.01) points[i + 5] = 0;
      else actives++;
    }
    if (!actives) f.prochain = f.fin = 0;
    e.stats.microgouttes = actives;
  }
  // Même enveloppe interpolée pour le Canvas et WebGL. Le tampon appartient à la vue.
  function lireImpact(p, k, sortie, offset = 0, actif = true) {
    const phase = p.impactDuree > 0 ? clamp(melange(p.impactAvant, p.impactAge, k) / p.impactDuree, 0, 1) : 1;
    // L'impact cesse à la fin de sa brève enveloppe, même si sa perle subsiste plusieurs secondes.
    const force = actif && (p.vivant || p.fusion) && p.impactForce > 0 && phase < 1
      ? p.impactForce * Math.min(1, phase / .16) * Math.pow(1 - phase, 1.4) * (p.vivant ? 1 : 1 - k) : 0;
    sortie[offset] = phase; sortie[offset + 1] = force; sortie[offset + 2] = p.phase; sortie[offset + 3] = p.impactRayon;
    return force;
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
  // Indexer les bandes traversées entre les deux poses, rayon compris. Les masques
  // conservent l'ordre des indices quand plusieurs gouttes peuvent fusionner au même pas.
  const bandeFusion = y => clamp(Math.floor(y * BANDES_FUSION), 0, BANDES_FUSION - 1);
  function candidatesFusion(e, p, tailleY, mots) {
    const debut = bandeFusion(Math.min(p.y, p.py) - p.taille * tailleY);
    const fin = bandeFusion(Math.max(p.y, p.py) + p.taille * tailleY);
    e.motFusion.fill(0, 0, mots);
    for (let b = debut; b <= fin; b++)
      for (let m = 0; m < mots; m++) e.motFusion[m] |= e.bandesFusion[b * MOTS_FUSION + m];
  }
  function fusionner(e, liste, limite, neige) {
    if (!limite) return 0;
    // Chaque goutte peut absorber les fines rencontrées sur son trajet avant de fusionner.
    if (!neige && e.fines && e.stats.microgouttes) absorberFines(e, liste, limite);
    let nombre = 0;
    const maximum = neige ? MAX_RAYON_NEIGE : MAX_RAYON_EAU, facteur = neige ? .7 : .8;
    const tailleY = facteur / e.hauteur, mots = Math.ceil(limite / 32);
    e.bandesFusion.fill(0);
    for (let j = 0; j < limite; j++) {
      const p = liste[j]; if (!p.vivant) continue;
      const debut = bandeFusion(Math.min(p.y, p.py) - p.taille * tailleY);
      const fin = bandeFusion(Math.max(p.y, p.py) + p.taille * tailleY);
      for (let b = debut; b <= fin; b++) e.bandesFusion[b * MOTS_FUSION + (j >>> 5)] |= 1 << (j & 31);
    }
    for (let i = 0; i + 1 < limite; i++) {
      const a = liste[i]; if (!a.vivant) continue;
      candidatesFusion(e, a, tailleY, mots);
      for (let suivant = i + 1; suivant < limite;) {
        const mot = suivant >>> 5, reste = e.motFusion[mot] & (-1 << (suivant & 31));
        if (!reste) { suivant = (mot + 1) * 32; continue; }
        const j = mot * 32 + 31 - Math.clz32(reste & -reste), b = liste[j];
        suivant = j + 1;
        if (!b.vivant) continue;
        const r = (a.taille + b.taille) * facteur;
        if ((Math.min(a.x, a.px) - Math.max(b.x, b.px)) * e.largeur > r ||
            (Math.min(b.x, b.px) - Math.max(a.x, a.px)) * e.largeur > r) continue;
        e.stats.paires++;
        const dx = (a.px - b.px) * e.largeur, dy = (a.py - b.py) * e.hauteur;
        const vx = (a.x - a.px - b.x + b.px) * e.largeur, vy = (a.y - a.py - b.y + b.py) * e.hauteur;
        const vv = vx * vx + vy * vy, t = vv > 1e-9 ? clamp(-(dx * vx + dy * vy) / vv, 0, 1) : 0;
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
        // Le barycentre vient de bouger. Rechercher aussi les nouveaux voisins au-delà de j.
        candidatesFusion(e, a, tailleY, mots);
        if (neige) e.stats.fusionsNeige++; else e.stats.fusionsEau++;
      }
    }
    // Le déplacement du barycentre et la croissance peuvent recouvrir d’autres fines.
    if (nombre && !neige && e.fines && e.stats.microgouttes) absorberFines(e, liste, limite);
    return nombre;
  }
  function absorberFines(e, liste, limite) {
    const { points, cellules, suivants, fin } = e.fines;
    const w = e.largeur, h = e.hauteur;
    let deriveX = 0, deriveY = 0;
    cellules.fill(-1);
    for (let j = 0; j < fin; j++) {
      const i = j * PAS_FINE;
      if (points[i + 5] <= 0) continue;
      const cellule = celluleFine(points[i + 1]) * GRILLE_FINES + celluleFine(points[i]);
      suivants[j] = cellules[cellule]; cellules[cellule] = j;
      deriveX = Math.max(deriveX, Math.abs(points[i] - points[i + 2]));
      deriveY = Math.max(deriveY, Math.abs(points[i + 1] - points[i + 3]));
    }
    for (let j = 0; j < limite && e.stats.microgouttes; j++) {
      const p = liste[j]; if (!p.vivant) continue;
      let tailleAvant;
      do {
        tailleAvant = p.taille;
        // Le grand axe du ménisque borne son empreinte quelle que soit son orientation.
        const rayon = .45 * 1.36 * tailleAvant, portee = rayon + MAX_RAYON_FINE;
        // La grille indexe la pose finale des fines, y compris celles qui ont traversé le trajet.
        const margeX = portee / w + deriveX, margeY = portee / h + deriveY;
        const x0 = celluleFine(Math.min(p.px, p.x) - margeX), x1 = celluleFine(Math.max(p.px, p.x) + margeX);
        const y0 = celluleFine(Math.min(p.py, p.y) - margeY), y1 = celluleFine(Math.max(p.py, p.y) + margeY);
        let aire = 0;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            for (let n = cellules[y * GRILLE_FINES + x]; n >= 0; n = suivants[n]) {
              const i = n * PAS_FINE, duree = points[i + 5], age = points[i + 4];
              if (duree <= 0) continue;
              const dx = (p.px - points[i + 2]) * w, dy = (p.py - points[i + 3]) * h;
              const finX = (p.x - points[i]) * w, finY = (p.y - points[i + 1]) * h;
              const borne = rayon + points[i + 6];
              if (Math.min(dx, finX) > borne || Math.max(dx, finX) < -borne ||
                  Math.min(dy, finY) > borne || Math.max(dy, finY) < -borne) continue;
              const r = points[i + 6] * clamp(Math.min(age * 5, (duree - age) * 1.5), 0, 1);
              const vx = finX - dx, vy = finY - dy, vv = vx * vx + vy * vy;
              const t = vv > 1e-9 ? clamp(-(dx * vx + dy * vy) / vv, 0, 1) : 0;
              if ((dx + vx * t) ** 2 + (dy + vy * t) ** 2 > (rayon + r) ** 2) continue;
              // La durée négative garde le ménisque dessinable pendant le pas de fusion.
              points[i + 5] = -duree;
              aire += (r / .45) ** 2;
              e.stats.microgouttes--;
            }
          }
        }
        if (aire > 0) {
          const masse = tailleAvant * tailleAvant + aire;
          p.taille = Math.min(MAX_RAYON_EAU, Math.sqrt(masse));
          e.stats.eauEvacuee += Math.max(0, masse - MAX_RAYON_EAU * MAX_RAYON_EAU);
        }
        // La croissance peut mettre de nouvelles fines à portée pendant ce même pas.
      } while (p.taille > tailleAvant && e.stats.microgouttes);
    }
  }
  function avancer(e, c, budget, pluie, neige, intensite) {
    e.temps += PAS; e.stats.etapes++;
    const couvert = !!c.abri, eau = couvert || neige ? 0 : pluie, flocons = couvert ? 0 : neige;
    const spray = couvert || neige ? 0 : clamp(Number(c.embruns) || 0, 0, 1);
    const flux = e.flux, air = flux.air, aspect = e.hauteur / e.largeur;
    // L'arrivée sur cette face suit aussi la vitesse relative incidente : une lentille
    // tournée dos au vent ne reçoit pas un surcroît d'impacts par la seule vitesse du véhicule.
    const vitesse = Math.min(120, flux.vitesseIncidente), rythme = 3 + vitesse * .12;
    // L'air évacue la pluie libre ; les pneus de la voiture devant continuent d'envoyer de nouveaux impacts.
    // Le sillage a son propre flux, qui reste abondant à 300 km/h sans ralentir l'évacuation des gouttes présentes.
    const exposition = (c.cockpit === false ? .60 : 1) * intensite;
    const fluxPluie = eau * rythme / (1 + air * 3.5), fluxSpray = spray * (22 + vitesse * .36) / (1 + air * .55);
    e.creditEau = Math.min(4, e.creditEau + PAS * (fluxPluie + fluxSpray) * budget.gouttes / 24 * exposition);
    e.creditNeige = Math.min(2, e.creditNeige + PAS * flocons * (1 + vitesse * .035) * budget.neige / 12 * exposition / (1 + air * 3.5));
    while (e.creditEau >= 1) {
      // Impacts groupés du panache, renouvelés quatre fois par seconde. Le test balayé décide des fusions.
      const sequence = e.fines ? e.fines.sequence : e.sequence;
      const enSpray = spray > .05 && hache(sequence * 13 + 5) < fluxSpray / Math.max(.001, fluxPluie + fluxSpray);
      const gerbe = Math.floor(e.temps * 4) + e.graine * 739;
      const x = enSpray ? .12 + hache(gerbe * 37 + 91) * .76 + (hache(sequence * 43 + 7) - .5) * .075 : undefined;
      const y = enSpray ? .10 + hache(gerbe * 53 + 83) * .78 + (hache(sequence * 47 + 3) - .5) * .075 : undefined;
      const forceImpact = (.25 + .75 * Math.max(eau, spray)) * Math.min(1.35, intensite);
      if (deposer(e, false, budget.gouttes, x, y, undefined, budget.echelleEau || 1, forceImpact)) {
        e.stats.depotsEau++; if (enSpray) e.stats.depotsEmbruns++;
      }
      if (e.fines) deposerFines(e, budget.gouttes * FINES_PAR_ARRIVEE, x, y);
      e.creditEau--;
    }
    if (e.fines?.fin) avancerFines(e, budget.gouttes * FINES_PAR_ARRIVEE, eau || spray);
    while (e.creditNeige >= 1) { deposer(e, true, budget.neige); e.creditNeige--; }
    let gouttes = 0, restes = 0;
    for (let i = 0; i < e.gouttes.length; i++) {
      const p = e.gouttes[i]; p.fusion = false; if (!p.vivant) continue;
      p.px = p.x; p.py = p.y; p.pa = p.age; p.pp = p.poids; p.pr = p.taille;
      p.impactAvant = p.impactAge; p.impactAge += PAS;
      if (!e.contexte && !eau && !spray) p.impactForce = 0;
      garderTrajet(p);
      // La vitesse déplace l'eau jusqu'au bord ; elle ne simule plus son évacuation en accélérant son âge.
      p.age += PAS * (eau > .05 || spray > .05 ? 1 : 1.55);
      p.poids = clamp(p.poids + PAS * (i < budget.gouttes ? 5 : -2), 0, 1);
      const mobilite = Math.max(p.glisse, clamp((p.taille - 3.4) / 3, .04, 1));
      const gravite = mobilite * 8 * (p.taille * .35 + p.vitesse) / 720, entrainement = .30 + .70 * mobilite;
      const ondulation = Math.sin(e.temps * p.frequence + p.phase) * p.vitesse / 720;
      p.x += PAS * ((flux.deriveX * entrainement + flux.graviteX * gravite + ondulation) * aspect + (p.x - flux.centreX) * flux.expansion * entrainement);
      p.y += PAS * (flux.deriveY * entrainement + flux.graviteY * gravite + (p.y - flux.centreY) * flux.expansion * entrainement);
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
      garderTrajet(p);
      p.age += PAS * ((flocons > .05 ? 1 : 1.35) + air * 4);
      p.poids = clamp(p.poids + PAS * (i < budget.neige ? 4 : -2), 0, 1);
      const fraction = p.age / p.duree;
      const gravite = p.vitesse * Math.max(0, fraction - .22) * 7 / 720, entrainement = .60 + .40 * clamp(fraction, 0, 1);
      p.x += PAS * ((flux.deriveX * entrainement + flux.graviteX * gravite) * aspect + (p.x - flux.centreX) * flux.expansion * entrainement);
      p.y += PAS * (flux.deriveY * entrainement + flux.graviteY * gravite + (p.y - flux.centreY) * flux.expansion * entrainement);
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
    if (gouttes >= 2 || (gouttes && e.fines && e.stats.microgouttes)) {
      gouttes -= fusionner(e, e.gouttes, budget.gouttes, false);
    }
    if (restes >= 2) restes -= fusionner(e, e.neige, budget.neige, true);
    e.stats.gouttes = gouttes; e.stats.neige = restes;
  }
  function avancerSimulation(e, dt, c, budget, fluxPrepare) {
    if (!e || !c || c.pause || !Number.isFinite(dt) || dt <= 0) return e?.stats;
    const intensite = c.intensite == null || !Number.isFinite(Number(c.intensite)) ? 1 : clamp(Number(c.intensite), 0, 2);
    if (c.actif === false || c.retro || c.qualite === 'off' || !intensite) { effacer(e); return e.stats; }
    budget = budget || BUDGETS[c.qualite] || BUDGETS.high;
    e.impactsActifs = impactsExposes(c);
    e.largeur = Math.max(1, Number(c.largeur) || e.largeur); e.hauteur = Math.max(1, Number(c.hauteur) || e.hauteur);
    const pluie = clamp(Number(c.pluie) || 0, 0, 1), neige = clamp(Number(c.neige) || 0, 0, 1);
    // La visière optique vient de remplir ce même champ pour ses couches de réfraction.
    if (fluxPrepare !== e.flux) calculerFlux(c, e.flux);
    e.accumulateur += Math.min(.25, dt);
    if (sansApport(c, pluie, neige) && !depotsDessinables(e)) {
      e.creditEau = e.creditNeige = 0;
      e.stats.paires = 0;
      while (e.accumulateur + 1e-10 >= PAS) { e.temps += PAS; e.stats.etapes++; e.accumulateur -= PAS; }
      return e.stats;
    }
    while (e.accumulateur + 1e-10 >= PAS) { avancer(e, c, budget, pluie, neige, intensite); e.accumulateur -= PAS; }
    return e.stats;
  }
  // Dessin à la fraction k du pas en cours, entre l'état d'avant le dernier pas et celui d'après : la
  // simulation reste à 30 Hz, le mouvement suit la cadence d'affichage. À k = 1, tracés exacts de l'état du dernier pas.
  function dessiner(e, k) {
    const ctx = e.contexte, w = e.largeur, h = e.hauteur;
    viderPixels(e); ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
    // Quelques traits et contours : ni lecture de pixels, ni réfraction plein écran.
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (e.fines?.fin) {
      const f = e.fines, points = f.points;
      // Deux traits groupés pour tous les ménisques fins de cette vue, quel que soit le palier.
      ctx.globalAlpha = Math.min(1, e.opacite);
      for (let bord = 0; bord < 2; bord++) {
        ctx.strokeStyle = bord ? 'rgba(230,247,254,0.50)' : 'rgba(19,43,60,0.27)';
        ctx.lineWidth = bord ? .8 : 1; ctx.beginPath();
        for (let j = 0; j < f.fin; j++) {
          const i = j * PAS_FINE, duree = points[i + 5];
          if (!duree) continue;
          const age = Math.max(0, points[i + 4] - (1 - k) * PAS);
          const r = points[i + 6] * clamp(Math.min(age * 5, (Math.abs(duree) - age) * 1.5), 0, 1)
            * (duree < 0 ? Math.sqrt(1 - k) : 1);
          if (r < .15) continue;
          const x = melange(points[i + 2], points[i], k) * w, y = melange(points[i + 3], points[i + 1], k) * h;
          const d = bord ? -r : r;
          ctx.moveTo(x + d, y); ctx.quadraticCurveTo(x + d, y + d, x, y + d);
        }
        ctx.stroke();
      }
    }
    for (let i = 0; i < e.gouttes.length; i++) {
      const p = e.gouttes[i]; if (!p.vivant && !p.fusion) continue;
      const age = melange(p.pa, p.age, k), a = clamp(Math.min(1, age / .24, (p.duree - age) / 1.5) * melange(p.pp, p.poids, k) * e.opacite, 0, 1);
      const x = melange(p.px, p.x, k) * w, y = melange(p.py, p.y, k) * h;
      const r = .45 * Math.sqrt(melange(p.pr * p.pr, p.vivant ? p.taille * p.taille : 0, k));
      if (r < .05) continue;
      const impact = e.impactTampon;
      if (lireImpact(p, k, impact, 0, e.impactsActifs) > .005) {
        const phase = impact[0], rayon = .45 * impact[3] * (.65 + 1.7 * phase), aplati = .60 + .25 * phase;
        ctx.globalAlpha = Math.min(.95, impact[1] * e.opacite);
        // Couronne brisée et trois micro-éclaboussures, locales et orientées par la graine
        // de la goutte. Aucun aplat ni reprise d'une grille écran.
        ctx.strokeStyle = 'rgba(17,44,59,0.50)'; ctx.lineWidth = Math.max(.8, rayon * .12);
        ctx.beginPath(); ctx.ellipse(x, y, rayon, rayon * aplati, p.phase, .1, 5.4); ctx.stroke();
        ctx.strokeStyle = 'rgba(219,242,252,0.75)'; ctx.lineWidth = Math.max(.65, rayon * .075);
        ctx.beginPath(); ctx.ellipse(x - .35, y - .45, rayon, rayon * aplati, p.phase, 3.1, 5.8); ctx.stroke();
        ctx.fillStyle = 'rgba(209,237,249,0.55)'; ctx.beginPath();
        for (let j = 0; j < 3; j++) {
          const angle = p.phase + j * TAU / 3 + .23 * Math.sin(p.phase + j), distance = rayon * (1.15 + phase * .45);
          const petit = Math.max(.45, impact[3] * (.13 + .035 * j) * (1 - phase));
          ctx.ellipse(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * aplati, petit, petit * .72, angle, 0, TAU);
        }
        ctx.fill();
      }
      if (a <= .005) continue;
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
      const angle = dx * dx + dy * dy > .25 ? Math.atan2(dy, dx) - Math.PI / 2 : .12 * p.sin;
      ctx.fillStyle = 'rgba(23,48,61,0.06)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.36, angle, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(12,31,40,0.17)'; ctx.lineWidth = Math.max(.6, r * .22);
      ctx.beginPath(); ctx.ellipse(x + r * .08, y + r * .13, r * .82, r * 1.04, angle, -.1, 2.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(225,245,253,0.35)'; ctx.lineWidth = Math.max(.65, r * .17);
      ctx.beginPath(); ctx.ellipse(x - r * .13, y - r * .21, r * .73, r * .94, angle, 3.35, 5.8); ctx.stroke();
      ctx.fillStyle = 'rgba(242,252,255,0.28)'; ctx.beginPath();
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
    ctx.globalAlpha = 1;
    e.propre = !e.stats.gouttes && !e.fines?.fin && !e.stats.neige &&
      !e.gouttes.some(p => p.fusion) && !e.neige.some(p => p.fusion);
    e.stats.dessins++; e.stats.fraction = k;
    montrer(e, !e.propre);
  }
  function mettreAJour(e, dt, contexte) {
    if (!e || e.libere) return e ? e.stats : null;
    if (e.optique) return B.visiereOptique.mettreAJour(e, dt, contexte);
    const c = contexte || {}, budget = BUDGETS[c.qualite] || BUDGETS.high;
    const intensite = Number.isFinite(Number(c.intensite)) && c.intensite != null ? clamp(Number(c.intensite), 0, 2) : 1;
    if (!e.contexte || c.actif === false || c.retro === true || !intensite || budget === BUDGETS.off) { effacer(e); return e.stats; }
    if (c.pause === true) return e.stats;
    calculerFlux(c, e.flux);
    suivrePalier(e, budget);
    const pluie = clamp(Number(c.pluie) || 0, 0, 1), neige = clamp(Number(c.neige) || 0, 0, 1);
    if (!Number.isFinite(dt) || dt <= 0) return e.stats;
    const delta = Math.min(.25, dt);
    // Sous abri, les dépôts et les impacts en cours continuent d’évoluer pendant le fondu.
    e.opaciteAbri = clamp(e.opaciteAbri + (c.abri ? -delta : delta) / .45, 0, 1);
    e.opacite = Math.min(1.25, intensite) * (c.cockpit === false ? .55 : 1) * e.opaciteAbri;
    e.impactsActifs = true;
    e.accumulateur += delta;
    if (sansApport(c, pluie, neige) && !depotsDessinables(e)) {
      e.creditEau = e.creditNeige = 0;
      e.stats.paires = 0;
      if (!e.propre) viderPixels(e);
      montrer(e, false);
      // Sans dépôt ni nouvel apport, seuls les pas d'horloge restent à comptabiliser.
      while (e.accumulateur + 1e-10 >= PAS) { e.temps += PAS; e.stats.etapes++; e.accumulateur -= PAS; }
      return e.stats;
    }
    if (e.accumulateur + 1e-10 >= PAS) {
      dimensionner(e, c, budget);
      while (e.accumulateur + 1e-10 >= PAS) { avancer(e, c, budget, pluie, neige, intensite); e.accumulateur -= PAS; }
    }
    if (!e.propre || depotsDessinables(e)) dessiner(e, clamp(e.accumulateur / PAS, 0, 1));
    else montrer(e, false);
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
  B.vitre = { creer, creerSimulation, avancerSimulation, calculerFlux, lireImpact, mettreAJour, prechauffer, effacer, liberer, BUDGETS, MAX_PIXELS, FREQUENCE: 30 };
})(globalThis.BITUME = globalThis.BITUME || {});
