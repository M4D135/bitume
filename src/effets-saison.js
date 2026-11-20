/* BITUME — feuilles et neige proches, procédurales, en coordonnées du monde. */
(function (B) {
  'use strict';
  const TAU = Math.PI * 2, CELLULE = 12, HAUTEUR = 10, PORTEE_NEIGE = 24, PORTEE_FEUILLES = 34;
  const BUDGETS = Object.freeze({
    off: Object.freeze({ feuilles: 0, neige: 0 }), low: Object.freeze({ feuilles: 6, neige: 24 }),
    medium: Object.freeze({ feuilles: 18, neige: 72 }), high: Object.freeze({ feuilles: 48, neige: 180 }),
    ultra: Object.freeze({ feuilles: 128, neige: 480 })
  });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lisse = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const melanger = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; };
  const hasard = n => melanger(n) / 4294967296;
  const cleSol = (x, z) => (x + 32768) * 65536 + z + 32768;
  const hache = cle => melanger((cle | 0) ^ Math.floor(cle / 4294967296));
  const PALETTES = [[.68, .20, .035], [.86, .43, .065], [.51, .13, .04], [.72, .50, .09]];
  const PREPARATION = 'effets-saison';
  function objet(type) {
    return { shape: 'octa', p: [0, 0, 0], s: [0, 0, 0], r: [0, 0, 0], color: [1, 1, 1],
      alpha: 0, emissive: 0, mat: 7, fx: true, overlay: false, outdoor: true, surface: 'object',
      windResponsive: false, effetSaison: type };
  }
  function pool(type, n) {
    const slots = new Array(n);
    for (let i = 0; i < n; i++) slots[i] = { objet: objet(type), cle: -1, cible: -1, poids: 0, demande: 0,
      x: 0, z: 0, bas: 0, haut: 0, rayon: 0, phase: 0, phase2: 0, duree: 0, taille: 0 };
    return { type, slots, plan: new Float64Array(n), sols: new Float64Array(n), nombre: 0, limite: 0,
      demande: -1, entier: -1, partiel: -1, proprietaires: new Float64Array(2048).fill(-1), indices: new Int16Array(2048),
      positions: new Uint16Array(n), nPositions: 0,
      libres: new Uint16Array(n), comptes: new Uint16Array(32), debuts: new Uint16Array(32) };
  }
  function vue() {
    return { dernierTemps: null, x: Infinity, y: Infinity, z: Infinity, change: false, neigeActive: false,
      feuilles: pool('feuille', 128), neige: pool('neige', 480), candidats: new Float64Array(125),
      distances: new Float64Array(125), sols: new Float64Array(125), nombre: 0,
      stats: { feuilles: 0, neige: 0, objets: 0, requetes: 0 } };
  }
  // Préparation statique d'une scène : masques de route, de tunnel et de toits, sources de feuilles et cache des
  // hauteurs de sol. Rien n'y dépend du palier, de la vue ni de l'horloge ; le cache des sols, rempli au fil des
  // sélections, ne mémorise que des valeurs exactes du décor et se partage donc sans risque entre vues et séances.
  // Le circuit et le décor d'origine sont gardés pour que creer() refuse une préparation d'une autre scène.
  function preparer(c, decor) {
    const circuit = c, source = decor;
    c = c || {}; decor = decor || {};
    const profil = decor.saison || {}, interdits = new Set(), route = new Map(), sources = [];
    // Un masque conservateur couvre aussi les portails vus depuis l'extérieur.
    if (c.x && c.z && c.y) for (let i = 0; i < c.x.length; i++) {
      const cx = Math.floor(c.x[i] / CELLULE), cz = Math.floor(c.z[i] / CELLULE);
      const tunnel = B.circuit && (B.circuit.dansCouvert || B.circuit.dansTunnel)?.(c, i * (c.pas || 4), 18);
      const rayon = tunnel ? 2 : 1;
      for (let dz = -rayon; dz <= rayon; dz++) for (let dx = -rayon; dx <= rayon; dx++) {
        const cle = cleSol(cx + dx, cz + dz);
        if (tunnel) interdits.add(cle);
        else route.set(cle, Math.max(route.get(cle) ?? -Infinity, c.y[i] + .08));
      }
    }
    // Les grands solides ne doivent pas recevoir de précipitations sous leurs toits.
    for (const o of decor.obstacles || []) {
      if (o.type !== 'box' || !Number.isFinite(o.hx) || !Number.isFinite(o.hz) || Math.min(o.hx, o.hz) < 1.8) continue;
      const r = Math.hypot(o.hx, o.hz) + 2.2;
      for (let z = Math.floor((o.z - r) / CELLULE); z <= Math.floor((o.z + r) / CELLULE); z++)
        for (let x = Math.floor((o.x - r) / CELLULE); x <= Math.floor((o.x + r) / CELLULE); x++) interdits.add(cleSol(x, z));
    }
    const statique = { type: PREPARATION, circuit, source, saison: profil, cote: c.theme === 'cote', graine: c.graine || 1, decor,
      interdits, route, sources, cacheCles: new Float64Array(4096).fill(-1), cacheSols: new Float64Array(4096) };
    if (profil.feuilles) for (const s of decor.sourcesFeuilles || []) {
      if (![s.x, s.y, s.z, s.rayon, s.sol].every(Number.isFinite) || s.y <= s.sol + .3) continue;
      const r = Math.max(.2, s.rayon), cx = Math.floor(s.x / CELLULE), cz = Math.floor(s.z / CELLULE);
      let valide = true, sol = s.sol;
      for (let z = Math.floor((s.z - r - 2.2) / CELLULE); z <= Math.floor((s.z + r + 2.2) / CELLULE); z++)
        for (let x = Math.floor((s.x - r - 2.2) / CELLULE); x <= Math.floor((s.x + r + 2.2) / CELLULE); x++) {
          const h = solCellule(statique, x, z); if (!Number.isFinite(h)) valide = false;
          else sol = Math.max(sol, h);
        }
      if (valide && s.y > sol + .4 && !interdits.has(cleSol(cx, cz))) sources.push({ x: s.x, z: s.z, y: s.y, sol, rayon: r,
        nombre: 3 + melanger(sources.length + statique.graine) % 6 });
    }
    return Object.freeze(statique);
  }
  const preparationDe = (p, c, decor) => !!p && p.type === PREPARATION && p.circuit === c && p.source === decor;
  // creer(c, decor) seul prépare puis crée ; creer(c, decor, preparation) reprend la partie
  // statique de la même scène et ne crée que l'état de la séance : pools des deux vues et vent lissé.
  function creer(c, decor, preparation) {
    const p = preparationDe(preparation, c, decor) ? preparation : preparer(c, decor);
    return { saison: p.saison, cote: p.cote, graine: p.graine, decor: p.decor, interdits: p.interdits, route: p.route, sources: p.sources,
      cacheCles: p.cacheCles, cacheSols: p.cacheSols, preparation: p, vues: [vue(), vue()], temps: null, ventX: 0, ventZ: 0 };
  }
  function solCellule(e, cx, cz) {
    const cle = cleSol(cx, cz), cache = hache(cle) & 4095;
    if (e.cacheCles[cache] === cle) return e.cacheSols[cache];
    let sol = -Infinity, valide = !e.interdits.has(cle) && typeof e.decor.sol === 'function';
    if (valide) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const h = e.decor.sol(cx * CELLULE - 2.2 + i * (CELLULE + 4.4) / 2,
        cz * CELLULE - 2.2 + j * (CELLULE + 4.4) / 2);
      if (!Number.isFinite(h) || Number.isFinite(e.decor.niveauEau) && h <= e.decor.niveauEau + .05) valide = false;
      sol = Math.max(sol, h);
    }
    sol = valide ? Math.max(sol, e.route.get(cle) ?? -Infinity) + .04 : NaN;
    e.cacheCles[cache] = cle; e.cacheSols[cache] = sol; return sol;
  }
  function inserer(v, cle, d, sol) {
    let i = Math.min(v.nombre, v.candidats.length - 1);
    if (v.nombre === v.candidats.length && d >= v.distances[i]) return;
    while (i > 0 && d < v.distances[i - 1]) {
      v.candidats[i] = v.candidats[i - 1]; v.distances[i] = v.distances[i - 1]; v.sols[i] = v.sols[i - 1]; i--;
    }
    v.candidats[i] = cle; v.distances[i] = d; v.sols[i] = sol; v.nombre = Math.min(v.candidats.length, v.nombre + 1);
  }
  function selectionner(e, v, x, y, z, neigeActive) {
    v.feuilles.nombre = v.neige.nombre = 0; v.nombre = 0; v.stats.requetes++;
    if (e.saison.feuilles) {
      for (let i = 0; i < e.sources.length; i++) {
        const s = e.sources[i], d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if (d < (PORTEE_FEUILLES + s.rayon + 2) ** 2) inserer(v, i, d, s.sol);
      }
      const p = v.feuilles;
      for (let j = 0; j < 8 && p.nombre < p.plan.length; j++) for (let i = 0; i < v.nombre && p.nombre < p.plan.length; i++) {
        const id = v.candidats[i]; if (j >= e.sources[id].nombre) continue;
        p.plan[p.nombre++] = id * 8 + j;
      }
    }
    v.nombre = 0;
    if (neigeActive) {
      const cx = Math.floor(x / CELLULE), cz = Math.floor(z / CELLULE), cy = Math.floor(y / HAUTEUR);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const gx = cx + dx, gz = cz + dz, sol = solCellule(e, gx, gz);
        if (!Number.isFinite(sol)) continue;
        for (let dy = -1; dy <= 2; dy++) {
          const gy = cy + dy; if ((gy + 1) * HAUTEUR < sol + .3) continue;
          const d = ((gx + .5) * CELLULE - x) ** 2 + ((gz + .5) * CELLULE - z) ** 2 + ((gy + .5) * HAUTEUR - y) ** 2;
          if (d <= (PORTEE_NEIGE + 10) ** 2) inserer(v, cleSol(gx, gz) * 512 + gy + 256, d, sol);
        }
      }
      const p = v.neige;
      for (let j = 0; j < 32 && p.nombre < p.plan.length; j++) for (let i = 0; i < v.nombre && p.nombre < p.plan.length; i++) {
        p.plan[p.nombre] = v.candidats[i] * 32 + j; p.sols[p.nombre++] = v.sols[i];
      }
    }
    v.x = x; v.y = y; v.z = z; v.neigeActive = neigeActive; v.change = true;
  }
  function proprietaire(p, cle) {
    let i = hache(cle) & 2047;
    while (p.proprietaires[i] >= 0 && p.proprietaires[i] !== cle) i = (i + 1) & 2047;
    return i;
  }
  function planifier(p, nombre, change) {
    nombre = Math.min(p.nombre, nombre); const n = Math.ceil(nombre);
    if (!change && n === p.entier) { if (p.partiel >= 0) p.slots[p.partiel].demande = Math.min(1, nombre - n + 1); return; }
    p.entier = n; p.partiel = -1;
    // La table n'a été écrite qu'aux positions notées au plan précédent : les remettre à −1 la vide aussi
    // sûrement qu'un fill des 2 048 cases, et la suite la remplit dans le même ordre, donc aux mêmes places.
    for (let k = 0; k < p.nPositions; k++) p.proprietaires[p.positions[k]] = -1;
    p.nPositions = 0;
    if (n <= 0) { // Plan vide (pas de neige, ou pas de feuilles) : éteindre les slots suffit, rien ne serait réservé.
      for (let i = 0; i < p.slots.length; i++) { const s = p.slots[i]; s.cible = -1; s.demande = 0; }
      return;
    }
    for (let i = 0; i < p.slots.length; i++) {
      const s = p.slots[i]; s.cible = -1; s.demande = 0;
      if (s.cle >= 0) { const k = proprietaire(p, s.cle); p.proprietaires[k] = s.cle; p.indices[k] = i; p.positions[p.nPositions++] = k; }
    }
    let nouveaux = 0;
    for (let i = 0; i < n; i++) {
      const cle = p.plan[i], k = proprietaire(p, cle);
      if (p.proprietaires[k] !== cle) { nouveaux++; continue; }
      const id = p.indices[k], s = p.slots[id]; s.cible = cle; s.demande = Math.min(1, nombre - i);
      if (i === n - 1) p.partiel = id;
    }
    if (!nouveaux) return; // Toutes les clés gardent leur slot : le tri des slots libres ne servirait pas.
    // Réserver d'abord les slots déjà invisibles, puis les autres par poids croissant.
    // Tri par 32 classes en O(capacité), au lieu d'un scan de 480 slots par nouveau flocon.
    p.comptes.fill(0);
    for (let i = 0; i < p.slots.length; i++) if (p.slots[i].cible < 0) p.comptes[Math.min(31, Math.floor(p.slots[i].poids * 32))]++;
    let total = 0;
    for (let i = 0; i < 32; i++) { p.debuts[i] = total; total += p.comptes[i]; }
    for (let i = 0; i < p.slots.length; i++) if (p.slots[i].cible < 0) {
      const classe = Math.min(31, Math.floor(p.slots[i].poids * 32)); p.libres[p.debuts[classe]++] = i;
    }
    let libre = 0;
    for (let i = 0; i < n; i++) {
      const cle = p.plan[i]; if (p.proprietaires[proprietaire(p, cle)] === cle) continue;
      if (libre >= total) continue;
      const id = p.libres[libre++];
      const s = p.slots[id]; s.cible = cle; s.demande = Math.min(1, nombre - i);
      if (i === n - 1) p.partiel = id;
      p.limite = Math.max(p.limite, id + 1);
    }
  }
  function identifier(e, s, cle, type) {
    s.cle = cle; s.poids = 0;
    const seed = hache(cle) ^ e.graine;
    s.phase = hasard(seed); s.phase2 = hasard(seed + 17) * TAU;
    s.duree = type === 'neige' ? 6 + hasard(seed + 23) * 7 : 9 + hasard(seed + 23) * 11;
    s.taille = type === 'neige' ? .018 + hasard(seed + 31) * .043 : .065 + hasard(seed + 31) * .095;
    const o = s.objet;
    if (type === 'feuille') {
      const source = e.sources[Math.floor(cle / 8)], angle = hasard(seed + 37) * TAU;
      const rayon = Math.sqrt(hasard(seed + 43)) * source.rayon * .68;
      s.x = source.x + Math.cos(angle) * rayon; s.z = source.z + Math.sin(angle) * rayon;
      s.bas = source.sol + .02; s.haut = source.y; s.rayon = .45 + hasard(seed + 47) * .65;
      const c = PALETTES[melanger(seed + 51) % PALETTES.length]; o.color[0] = c[0]; o.color[1] = c[1]; o.color[2] = c[2];
    } else {
      const cellule = Math.floor(cle / 32), gy = cellule % 512 - 256, horizontal = Math.floor(cellule / 512);
      const gx = Math.floor(horizontal / 65536) - 32768, gz = horizontal % 65536 - 32768;
      s.x = (gx + hasard(seed + 37)) * CELLULE; s.z = (gz + hasard(seed + 43)) * CELLULE;
      s.bas = Math.max(gy * HAUTEUR, solCellule(e, gx, gz)); s.haut = (gy + 1) * HAUTEUR;
      s.rayon = .3 + hasard(seed + 47) * .8; o.color[0] = .86; o.color[1] = .92; o.color[2] = 1;
    }
  }
  function dessinerPool(e, v, p, t, dt, x, y, z, nuit, sortie) {
    const fondu = 1 - Math.exp(-dt / .30), neige = p.type === 'neige'; let limite = 0;
    for (let i = 0; i < p.limite; i++) {
      const s = p.slots[i];
      if (s.cle !== s.cible && (s.poids < .007 || s.cle < 0)) {
        if (s.cible >= 0) identifier(e, s, s.cible, p.type); else { s.cle = -1; s.poids = 0; }
      }
      s.poids += ((s.cle === s.cible && s.cle >= 0 ? s.demande : 0) - s.poids) * fondu;
      if (s.cible >= 0 || s.poids > .007) limite = i + 1;
      if (s.cle < 0 || s.poids < .007) continue;
      const phase = ((t / s.duree + s.phase) % 1 + 1) % 1;
      const a = t * (neige ? .57 : 1.23) + s.phase2;
      const px = s.x + Math.sin(a) * s.rayon + e.ventX * phase * .055;
      const pz = s.z + Math.cos(a * .731 + s.phase2) * s.rayon + e.ventZ * phase * .055;
      const py = s.haut + (s.bas - s.haut) * phase;
      const distance = neige ? Math.hypot(px - x, py - y, pz - z) : Math.hypot(px - x, pz - z);
      const visible = (1 - lisse(neige ? 14 : 18, neige ? PORTEE_NEIGE : PORTEE_FEUILLES, distance))
        * lisse(0, .065, phase) * (1 - lisse(.78, .99, phase)) * s.poids;
      if (visible < .006) continue;
      const o = s.objet; o.p[0] = px; o.p[1] = py; o.p[2] = pz;
      const taille = s.taille * Math.sqrt(visible);
      o.s[0] = taille; o.s[1] = taille * (neige ? .8 : .075); o.s[2] = taille * (neige ? 1 : 1.7);
      o.r[0] = a * .8; o.r[1] = a * .51; o.r[2] = Math.sin(a * 1.31) * 1.2;
      o.alpha = Math.min(1, visible * (neige ? .78 : 1)); o.emissive = neige ? .08 + nuit * .15 : 0;
      sortie.push(o); v.stats[neige ? 'neige' : 'feuilles']++; v.stats.objets++;
    }
    p.limite = limite;
  }
  function effacerPool(p) { // Seulement à l'arrêt, jamais dans la boucle des particules.
    for (let i = 0; i < p.slots.length; i++) { const s = p.slots[i]; s.cle = s.cible = -1; s.poids = s.demande = 0; }
    p.limite = p.nombre = 0; p.entier = -1;
  }
  function effacer(v) {
    effacerPool(v.feuilles); effacerPool(v.neige);
    v.x = Infinity; v.dernierTemps = null;
  }
  function dessiner(etat, temps, contexte, sortie) {
    const c = contexte || {}, v = etat.vues[c.vue === 1 ? 1 : 0], stats = v.stats;
    stats.feuilles = stats.neige = stats.objets = 0;
    const budget = BUDGETS[c.qualite] || BUDGETS.high, pose = c.pose;
    const pluie = clamp(Number(c.pluie) || 0, 0, 1), nuit = clamp(Number(c.nuit) || 0, 0, 1);
    // Une mesure météo réelle peut commander la neige hors hiver, jamais sur Port-Sable.
    const neige = etat.cote ? 0 : Number.isFinite(c.neige) ? clamp(c.neige, 0, 1) : etat.saison.neige ? pluie : 0;
    if (budget === BUDGETS.off || c.abri || !pose || !etat.saison.feuilles && !neige && !v.neige.limite) {
      if (v.feuilles.limite || v.neige.limite) effacer(v); return stats;
    }
    const x = Number.isFinite(pose.x) ? pose.x : pose[0], y = Number.isFinite(pose.y) ? pose.y : pose[1], z = Number.isFinite(pose.z) ? pose.z : pose[2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(temps)) return stats;
    const dt = v.dernierTemps === null ? 0 : Math.max(0, Math.min(.2, temps - v.dernierTemps));
    if (v.dernierTemps !== null && temps < v.dernierTemps) effacer(v);
    v.dernierTemps = temps;
    if (etat.temps !== temps) {
      const d = etat.temps === null ? 0 : Math.max(0, Math.min(.2, temps - etat.temps)), f = 1 - Math.exp(-d / .6);
      etat.ventX += (clamp(Number(c.ventX) || 0, -20, 20) - etat.ventX) * f;
      etat.ventZ += (clamp(Number(c.ventZ) || 0, -20, 20) - etat.ventZ) * f; etat.temps = temps;
    }
    v.change = false;
    if ((x - v.x) ** 2 + (y - v.y) ** 2 + (z - v.z) ** 2 > 9 || v.neigeActive !== (neige > 0)) selectionner(etat, v, x, y, z, neige > 0);
    planifier(v.feuilles, etat.saison.feuilles ? budget.feuilles : 0, v.change);
    planifier(v.neige, budget.neige * neige, v.change);
    dessinerPool(etat, v, v.feuilles, temps, dt, x, y, z, nuit, sortie);
    dessinerPool(etat, v, v.neige, temps, dt, x, y, z, nuit, sortie);
    return stats;
  }
  B.effetsSaison = { preparer, creer, dessiner, BUDGETS, MAX_OBJETS: 608, PORTEE_NEIGE, PORTEE_FEUILLES };
})(globalThis.BITUME = globalThis.BITUME || {});
