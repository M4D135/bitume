/* BITUME — faune des prairies, entièrement procédurale.
   Habitat préparé sur surfaceHerbe ; aucune requête de terrain ni création d'objet au dessin.
   Temps absolu commun aux vues, deux pools indépendants. Les halos sont de petits volumes 3D
   translucides : le moteur conserve leur test de profondeur, sans lumière ponctuelle. */
(function (B) {
  'use strict';
  const TAU = Math.PI * 2, MAX_VUES = 2, MAX_HABITATS = 1536, ANCRES = 48, ECHANTILLONS = 32;
  const PORTEE = 90, DEBUT_FONDU = 55, CELLULE = 48, MAX_OBJETS = 512;
  const BUDGETS = Object.freeze({
    off: Object.freeze({ abeilles: 0, insectes: 0, lucioles: 0, objetsJour: 0, objetsNuit: 0 }),
    low: Object.freeze({ abeilles: 2, insectes: 0, lucioles: 6, objetsJour: 10, objetsNuit: 12 }),
    medium: Object.freeze({ abeilles: 5, insectes: 3, lucioles: 16, objetsJour: 34, objetsNuit: 32 }),
    high: Object.freeze({ abeilles: 12, insectes: 8, lucioles: 64, objetsJour: 84, objetsNuit: 128 }),
    ultra: Object.freeze({ abeilles: 32, insectes: 16, lucioles: 256, objetsJour: 208, objetsNuit: 512 }),
  });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lisse = (a, b, n) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function melanger(n) { n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b); return (n ^ n >>> 16) >>> 0; }
  const hasard = n => melanger(n) / 4294967296;
  const herbe = o => o && (o.groundCover || typeof o.shape === 'string' && (o.shape.startsWith('prairie-val') || o.shape.startsWith('herbes-val')));

  function habitats(c, decor) {
    const resultat = [];
    if (!decor || typeof decor.surfaceHerbe !== 'function') return resultat;
    const cellules = new Map(), candidats = [], graine = c.graine >>> 0;
    function proposer(x, z, hauteurHerbe, proche, priorite) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const gx = Math.floor(x / 3), gz = Math.floor(z / 3), cle = gx + ':' + gz;
      if (cellules.has(cle)) return;
      const seed = melanger(graine ^ Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663));
      const h = { x, z, graine: seed, hauteurHerbe, proche, priorite };
      cellules.set(cle, h); candidats.push(h);
    }
    const axe = c.n > 0 && c.pas > 0 && c.x && c.z && c.cap;
    if (axe) {
      // L'habitat dépend du sol herbeux, jamais du palier de plantes affichées. Deux rubans
      // irréguliers longent chaque côté ; le plus proche permet de voir les insectes à l'arrêt.
      const pas = Math.max(1, Math.ceil(Math.max(6, c.longueur / 1400) / c.pas)), w = c.largeur / 2;
      for (let priorite = 0; priorite < 2; priorite++) for (let i = 0; i < c.n; i += pas) for (const cote of [-1, 1]) {
        const seed = melanger(graine ^ Math.imul(i + 1, 0x45d9f3b) ^ (cote > 0 ? 13 : 47) ^ priorite);
        const d = cote * (w + (priorite ? 7 + hasard(seed + 3) * 4 : 2.4 + hasard(seed + 3) * .25));
        const a = c.cap[i], longitudinal = (hasard(seed + 7) - .5) * 1.4;
        proposer(c.x[i] - Math.sin(a) * d + Math.cos(a) * longitudinal,
          c.z[i] + Math.cos(a) * d + Math.sin(a) * longitudinal, .35, !priorite, priorite);
      }
    } else for (const lot of decor.lots || []) for (const o of lot.objets || []) {
      // Compatibilité des petits décors sans axe de circuit : noms historiques ou marqueur
      // groundCover, quelle que soit la variante de maillage et sans dépendre du nom du lot.
      if (herbe(o) && o.p) proposer(o.p[0], o.p[2], clamp(Math.abs(o.s && o.s[1] || .35), .05, .9), false, 1);
    }
    // Répartir le plafond sur tout le tour, puis compléter dans les prairies plus éloignées.
    candidats.sort((a, b) => a.priorite - b.priorite || a.graine - b.graine || a.x - b.x || a.z - b.z);
    const sonde = { y: 0, normal: [0, 1, 0], color: [0, 0, 0] };
    for (const h of candidats) {
      if (resultat.length >= MAX_HABITATS) break;
      const centre = decor.surfaceHerbe(h.x, h.z, sonde);
      if (!centre || !Number.isFinite(centre.y)) continue;
      h.y = centre.y;
      h.rx = h.proche ? .28 + hasard(h.graine + 11) * .20 : .58 + hasard(h.graine + 11) * .64;
      h.rz = h.proche ? .26 + hasard(h.graine + 29) * .20 : .54 + hasard(h.graine + 29) * .68;
      const angle = hasard(h.graine + 41) * TAU; h.cos = Math.cos(angle); h.sin = Math.sin(angle);
      h.sols = new Float64Array(ECHANTILLONS); let valide = true;
      // Points et milieux de la trajectoire sont validés ; les grandes bandes route/eau/tunnel
      // ne peuvent être franchies par l'orbite locale. Les mêmes coordonnées servent au vol.
      for (let j = 0; j < ECHANTILLONS * 2; j++) {
        const a = j / (ECHANTILLONS * 2) * TAU;
        const lx = (Math.cos(a) + Math.sin(a * 3) * .14) * h.rx;
        const lz = (Math.sin(a) + Math.cos(a * 2) * .18) * h.rz;
        const q = decor.surfaceHerbe(h.x + h.cos * lx - h.sin * lz, h.z + h.sin * lx + h.cos * lz, sonde);
        if (!q || !Number.isFinite(q.y) || q.normal && q.normal[1] < .65) { valide = false; break; }
        if (!(j & 1)) h.sols[j / 2] = q.y;
      }
      if (valide) { h.id = resultat.length; resultat.push(h); }
    }
    return resultat;
  }
  function indexer(liste) {
    if (!liste.length) return { x: 0, z: 0, pas: CELLULE, colonnes: 0, lignes: 0, cases: [] };
    let x = Infinity, z = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const h of liste) { x = Math.min(x, h.x); z = Math.min(z, h.z); maxX = Math.max(maxX, h.x); maxZ = Math.max(maxZ, h.z); }
    const pas = Math.max(CELLULE, Math.ceil(Math.max(maxX - x, maxZ - z) / 255));
    const colonnes = Math.floor((maxX - x) / pas) + 1, lignes = Math.floor((maxZ - z) / pas) + 1;
    const cases = new Array(colonnes * lignes).fill(null);
    for (const h of liste) {
      const i = Math.floor((h.z - z) / pas) * colonnes + Math.floor((h.x - x) / pas);
      (cases[i] || (cases[i] = [])).push(h.id);
    }
    return { x, z, pas, colonnes, lignes, cases };
  }
  function objet(espece, fx = false) {
    return { shape: 'sphere', p: [0, 0, 0], s: [0, 0, 0], r: [0, 0, 0], color: [0, 0, 0],
      mat: 7, emissive: 0, surface: 'object', outdoor: true, overlay: false, windResponsive: false,
      fx, alpha: fx ? 0 : 1, faune: espece };
  }
  function pool(espece, nombre, composants) {
    const slots = new Array(nombre);
    for (let i = 0; i < nombre; i++) {
      const objets = new Array(composants);
      for (let j = 0; j < composants; j++) objets[j] = objet(espece, espece === 'luciole' ? j === 1 : j >= composants - 2);
      if (espece === 'luciole') { objets[0].shape = 'octa'; objets[0].mat = 5; }
      slots[i] = { cle: -1, cible: -1, poids: 0, demande: 0, epoque: -1, phase: 0, vitesse: 0, taille: 0, altitude: 0, battement: 0, teinte: 0, objets };
    }
    return { slots, limite: 0, especes: espece, composants, demande: -1, nombrePlan: -1, partiel: -1 };
  }
  function vue(nombreHabitats) {
    return { dernierTemps: null, selectionTemps: -Infinity, x: Infinity, z: Infinity, nombre: 0, generation: 0, epoque: 0,
      indices: new Int32Array(ANCRES).fill(-1), distances: new Float64Array(ANCRES), proprietaires: new Int32Array(nombreHabitats * 8),
      abeilles: pool('abeille', 32, 5), insectes: pool('insecte', 16, 3), lucioles: pool('luciole', 256, 2),
      stats: { abeilles: 0, insectes: 0, lucioles: 0, objets: 0, habitats: 0, requetes: 0 } };
  }
  function creer(c, decor) {
    const liste = habitats(c || {}, decor);
    return { habitats: liste, index: indexer(liste), montagne: !!c && c.theme === 'montagne',
      vues: [vue(liste.length), vue(liste.length)], temps: null, nuit: 0, pluie: 0 };
  }
  function selectionner(etat, v, x, z, temps) {
    const g = etat.index, indices = v.indices, distances = v.distances;
    indices.fill(-1); distances.fill(Infinity); v.nombre = 0;
    if (g.colonnes) {
      const x0 = Math.max(0, Math.floor((x - PORTEE - g.x) / g.pas)), x1 = Math.min(g.colonnes - 1, Math.floor((x + PORTEE - g.x) / g.pas));
      const z0 = Math.max(0, Math.floor((z - PORTEE - g.z) / g.pas)), z1 = Math.min(g.lignes - 1, Math.floor((z + PORTEE - g.z) / g.pas));
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
        const cellule = g.cases[iz * g.colonnes + ix]; if (!cellule) continue;
        for (const id of cellule) {
          const h = etat.habitats[id], dx = h.x - x, dz = h.z - z, d = dx * dx + dz * dz;
          if (d >= PORTEE * PORTEE || d >= distances[ANCRES - 1]) continue;
          let k = ANCRES - 1;
          while (k > 0 && (d < distances[k - 1] || d === distances[k - 1] && id < indices[k - 1])) {
            distances[k] = distances[k - 1]; indices[k] = indices[k - 1]; k--;
          }
          distances[k] = d; indices[k] = id;
        }
      }
      while (v.nombre < ANCRES && indices[v.nombre] >= 0) v.nombre++;
    }
    v.selectionTemps = temps; v.x = x; v.z = z; v.generation++; v.stats.requetes++;
  }
  function affecter(v, p, nombre, change) {
    if (!change && p.demande === nombre) return;
    // Les petits insectes restent groupés dans les huit habitats les plus proches. Les
    // lucioles occupent jusqu'à 48 habitats et huit individus distincts par habitat.
    const ancres = Math.min(v.nombre, p.especes === 'luciole' ? ANCRES : 8), n = Math.min(Math.ceil(nombre), ancres * 8);
    if (!change && p.demande >= 0 && p.nombrePlan === n) {
      if (p.partiel >= 0) p.slots[p.partiel].demande = Math.min(1, nombre - n + 1);
      p.demande = nombre; return;
    }
    p.demande = nombre;
    p.nombrePlan = n; p.partiel = -1;
    const slots = p.slots, proprietaires = v.proprietaires;
    proprietaires.fill(-1);
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]; s.cible = -1; s.demande = 0;
      if (s.epoque === v.epoque && s.cle >= 0) proprietaires[s.cle] = i;
    }
    // Retenir d'abord les identités déjà présentes ; l'ordre des plus proches peut changer
    // sans téléporter tous les insectes d'un essaim. Une identité = habitat + individu local.
    for (let i = 0; i < n; i++) {
      const cle = v.indices[i % ancres] * 8 + Math.floor(i / ancres), ancien = proprietaires[cle];
      if (ancien >= 0) {
        slots[ancien].cible = cle; slots[ancien].demande = Math.min(1, nombre - i);
        if (i === n - 1) p.partiel = ancien;
      }
    }
    for (let i = 0; i < n; i++) {
      const cle = v.indices[i % ancres] * 8 + Math.floor(i / ancres);
      if (proprietaires[cle] >= 0) continue;
      let meilleur = -1, poids = Infinity;
      for (let k = 0; k < slots.length; k++) {
        const s = slots[k]; if (s.cible >= 0) continue;
        const w = s.epoque === v.epoque ? s.poids : 0;
        if (w < poids) { poids = w; meilleur = k; }
      }
      if (meilleur >= 0) {
        const s = slots[meilleur]; s.cible = cle; s.demande = Math.min(1, nombre - i); p.limite = Math.max(p.limite, meilleur + 1);
        if (i === n - 1) p.partiel = meilleur;
      }
    }
  }
  function identifier(s, cle, espece, etat, epoque) {
    s.cle = cle; s.epoque = epoque;
    const h = etat.habitats[Math.floor(cle / 8)], seed = melanger(h.graine ^ Math.imul(cle % 8 + 1, 0x45d9f3b) ^ (espece === 'abeille' ? 17 : espece === 'insecte' ? 71 : 131));
    s.phase = hasard(seed) * TAU; s.vitesse = (espece === 'luciole' ? .28 : .58) + hasard(seed + 3) * .35;
    s.taille = .85 + hasard(seed + 7) * .3; s.altitude = h.hauteurHerbe + (espece === 'luciole' ? .3 + hasard(seed + 11) * .8 : .25 + hasard(seed + 11) * .35);
    s.battement = 47 + hasard(seed + 13) * 43; s.teinte = seed % 3;
  }
  function placer(o, x, y, z, sx, sy, sz, yaw, pitch = 0, roll = 0) {
    o.p[0] = x; o.p[1] = y; o.p[2] = z; o.s[0] = sx; o.s[1] = sy; o.s[2] = sz;
    o.r[0] = roll; o.r[1] = -yaw; o.r[2] = pitch;
  }
  function couleur(o, r, g, b) { o.color[0] = r; o.color[1] = g; o.color[2] = b; }
  function dessinerPool(etat, v, p, temps, dt, x, z, sortie) {
    let limite = 0;
    const melange = 1 - Math.exp(-dt / .24);
    for (let i = 0; i < p.limite; i++) {
      const s = p.slots[i];
      if (s.epoque !== v.epoque) { s.cle = -1; s.poids = 0; s.epoque = v.epoque; }
      if (s.cle !== s.cible && (s.poids < .008 || s.cle < 0)) {
        s.poids = 0;
        if (s.cible >= 0) identifier(s, s.cible, p.especes, etat, v.epoque); else s.cle = -1;
      }
      let cible = s.cle === s.cible && s.cle >= 0 ? s.demande : 0;
      let h = s.cle >= 0 ? etat.habitats[Math.floor(s.cle / 8)] : null;
      if (h) cible *= 1 - lisse(DEBUT_FONDU, PORTEE, Math.hypot(h.x - x, h.z - z));
      s.poids += (cible - s.poids) * melange;
      if (s.cible >= 0 || s.poids > .008) limite = i + 1;
      if (!h || s.poids < .008 || v.stats.objets + p.composants > MAX_OBJETS) continue;
      const a = temps * s.vitesse + s.phase, ca = Math.cos(a), sa = Math.sin(a);
      const lx = (ca + Math.sin(a * 3) * .14) * h.rx, lz = (sa + Math.cos(a * 2) * .18) * h.rz;
      const px = h.x + h.cos * lx - h.sin * lz, pz = h.z + h.sin * lx + h.cos * lz;
      const u = ((a / TAU % 1) + 1) % 1 * ECHANTILLONS, j = Math.floor(u), t = u - j;
      const sol = h.sols[j] + (h.sols[(j + 1) % ECHANTILLONS] - h.sols[j]) * t;
      const py = sol + s.altitude + Math.sin(a * 2 + s.phase) * .09 + Math.sin(temps * 1.7 + s.phase) * .045;
      const vx = (-sa + Math.cos(a * 3) * .42) * h.rx, vz = (ca - Math.sin(a * 2) * .36) * h.rz;
      const yaw = Math.atan2(h.sin * vx + h.cos * vz, h.cos * vx - h.sin * vz), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const e = Math.sqrt(clamp(s.poids, 0, 1)), taille = s.taille * e, o = s.objets;
      if (p.especes === 'luciole') {
        const souffle = .5 + Math.sin(temps * (1.15 + s.taille * .4) + s.phase) * .5, pulse = .25 + .75 * souffle * souffle * souffle;
        const coeur = (.012 + (s.taille - .85) * .022) * e, halo = (.085 + (s.taille - .85) * .16) * (.9 + .1 * pulse) * e;
        placer(o[0], px, py, pz, coeur, coeur, coeur, yaw); placer(o[1], px, py, pz, halo, halo, halo, 0);
        if (s.teinte === 0) { couleur(o[0], .9, 1, .27); couleur(o[1], .72, 1, .22); }
        else if (s.teinte === 1) { couleur(o[0], 1, .88, .35); couleur(o[1], 1, .78, .2); }
        else { couleur(o[0], .65, 1, .6); couleur(o[1], .45, 1, .48); }
        o[0].emissive = 1.8 + pulse * 2.1; o[1].emissive = 1.3 + pulse * 1.3; o[1].alpha = s.poids * (.11 + pulse * .2);
        v.stats.lucioles++;
      } else if (p.especes === 'abeille') {
        const vol = Math.sin(temps * s.battement + s.phase), pitch = Math.sin(a * 2) * .12;
        placer(o[0], px - cy * .012 * taille, py, pz - sy * .012 * taille, .044 * taille, .026 * taille, .028 * taille, yaw, pitch);
        placer(o[1], px + cy * .014 * taille, py, pz + sy * .014 * taille, .022 * taille, .025 * taille, .024 * taille, yaw, pitch);
        placer(o[2], px + cy * .032 * taille, py + .003 * taille, pz + sy * .032 * taille, .018 * taille, .018 * taille, .019 * taille, yaw, pitch);
        couleur(o[0], .94, .62, .055); couleur(o[1], .11, .075, .025); couleur(o[2], .075, .055, .025);
        for (let k = 0; k < 2; k++) {
          const cote = k ? 1 : -1, wing = o[k + 3], decalage = cote * .024 * taille;
          placer(wing, px - sy * decalage, py + .012 * taille, pz + cy * decalage, .038 * taille, .0024 * taille, .051 * taille, yaw, 0, cote * (.35 + vol * .82));
          couleur(wing, .82, .87, .76); wing.alpha = .46 * s.poids;
        }
        v.stats.abeilles++;
      } else {
        const papillon = s.teinte !== 2, bat = Math.sin(temps * (papillon ? 15 : 61) + s.phase);
        placer(o[0], px, py, pz, .033 * taille, .008 * taille, .008 * taille, yaw); couleur(o[0], .14, .18, .1);
        for (let k = 0; k < 2; k++) {
          const cote = k ? 1 : -1, wing = o[k + 1], decalage = cote * .022 * taille;
          placer(wing, px - sy * decalage, py + .003 * taille, pz + cy * decalage, (papillon ? .035 : .052) * taille, .002 * taille, (papillon ? .046 : .027) * taille, yaw, 0, cote * (.3 + bat * .9));
          if (s.teinte === 0) couleur(wing, .68, .33, .09); else if (s.teinte === 1) couleur(wing, .36, .65, .88); else couleur(wing, .76, .85, .72);
          wing.alpha = (papillon ? .8 : .4) * s.poids;
        }
        v.stats.insectes++;
      }
      for (let k = 0; k < o.length; k++) sortie.push(o[k]);
      v.stats.objets += p.composants;
    }
    p.limite = limite;
  }
  function dessiner(etat, temps, contexte, sortie) {
    const c = contexte || {}, qualite = Object.prototype.hasOwnProperty.call(BUDGETS, c.qualite) ? c.qualite : 'medium';
    const v = etat.vues[c.vue === 1 ? 1 : 0], stats = v.stats;
    stats.abeilles = stats.insectes = stats.lucioles = stats.objets = 0; stats.habitats = 0;
    temps = Number.isFinite(temps) ? temps : 0;
    if (qualite === 'off' || !etat.habitats.length) {
      if (v.dernierTemps !== null) v.epoque++;
      v.dernierTemps = null; v.abeilles.limite = v.insectes.limite = v.lucioles.limite = 0;
      v.abeilles.demande = v.insectes.demande = v.lucioles.demande = -1;
      return stats;
    }
    const pose = c.pose || c.position || c.camera && c.camera.pos;
    const px = pose ? (Number.isFinite(pose.x) ? pose.x : pose[0]) : 0;
    const pz = pose ? (Number.isFinite(pose.z) ? pose.z : pose[2]) : 0;
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return stats;
    const dt = v.dernierTemps === null ? 1 / 60 : clamp(temps - v.dernierTemps, 0, .25);
    if (v.dernierTemps !== null && temps < v.dernierTemps) { v.epoque++; v.selectionTemps = -Infinity; }
    v.dernierTemps = temps;
    const nuit = clamp(Number.isFinite(c.nuit) ? c.nuit : Number.isFinite(c.daylight) ? 1 - c.daylight : 0, 0, 1);
    const pluie = clamp(Number.isFinite(c.pluie) ? c.pluie : 0, 0, 1);
    if (etat.temps === null || temps < etat.temps) { etat.nuit = nuit; etat.pluie = pluie; }
    else if (temps !== etat.temps) {
      const a = 1 - Math.exp(-Math.min(.25, temps - etat.temps) / .32);
      etat.nuit += (nuit - etat.nuit) * a; etat.pluie += (pluie - etat.pluie) * a;
    }
    etat.temps = temps;
    const change = temps - v.selectionTemps > .3 || (px - v.x) ** 2 + (pz - v.z) ** 2 > 36;
    if (change) selectionner(etat, v, px, pz, temps);
    stats.habitats = v.nombre;
    const budget = BUDGETS[qualite], jour = (1 - lisse(.15, .65, etat.nuit)) * (1 - etat.pluie * .65);
    const nuitActive = etat.montagne ? lisse(.35, .85, etat.nuit) * (1 - etat.pluie * .45) : 0;
    affecter(v, v.abeilles, budget.abeilles * jour, change);
    affecter(v, v.insectes, budget.insectes * jour, change);
    affecter(v, v.lucioles, budget.lucioles * nuitActive, change);
    dessinerPool(etat, v, v.abeilles, temps, dt, px, pz, sortie);
    dessinerPool(etat, v, v.insectes, temps, dt, px, pz, sortie);
    dessinerPool(etat, v, v.lucioles, temps, dt, px, pz, sortie);
    return stats;
  }
  B.faune = { BUDGETS, MAX_VUES, MAX_HABITATS, MAX_OBJETS, PORTEE, creer, dessiner };
})(globalThis.BITUME = globalThis.BITUME || {});
