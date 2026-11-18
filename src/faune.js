/* BITUME — faune des prairies, entièrement procédurale.
   Habitat préparé sur surfaceHerbe ; aucune requête de terrain ni création d'objet au dessin.
   Temps absolu commun aux vues, deux pools indépendants. Les halos sont de petits volumes 3D
   translucides : le moteur conserve leur test de profondeur, sans lumière ponctuelle. */
(function (B) {
  'use strict';
  const TAU = Math.PI * 2, MAX_VUES = 2, MAX_HABITATS = 1536, ANCRES = 48, ECHANTILLONS = 32;
  const PORTEE = 90, DEBUT_FONDU = 55, PORTEE_JOUR = 38, CELLULE = 48, MAX_OBJETS = 512;
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
    const ecologie = decor.ecologie || B.ecologie && B.ecologie.creer(graine, c.theme);
    const milieu = { herbe: 0, fleurs: 0, insectes: 0, boisement: 0 };
    function proposer(x, z, hauteurHerbe) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const gx = Math.floor(x / 3), gz = Math.floor(z / 3), cle = gx + ':' + gz;
      if (cellules.has(cle)) return;
      const seed = melanger(graine ^ Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663));
      if (ecologie) ecologie.echantillonner(x, z, milieu);
      else {
        // Repli pour un petit décor ancien sans module écologique : des poches fixes,
        // jamais du hasard consommé au dessin ni une présence garantie partout.
        const poche = hasard(graine ^ Math.imul(Math.floor(x / 83), 18181) ^ Math.imul(Math.floor(z / 83), 73939));
        milieu.herbe = milieu.insectes = poche > .46 ? poche : 0; milieu.fleurs = hasard(seed + 79);
      }
      const herbage = clamp(Number(milieu.herbe) || 0, 0, 1), insectes = clamp(Number(milieu.insectes) || 0, 0, 1);
      const fleurs = clamp(Number(milieu.fleurs) || 0, 0, 1);
      if (herbage <= .015 || insectes <= .025) return;
      const activite = lisse(.04, .72, insectes), floraison = lisse(.05, .75, fleurs);
      const h = { x, z, graine: seed, hauteurHerbe, richesse: insectes, fleurs,
        abeilles: Math.min(8, Math.floor(activite * floraison * (2 + hasard(seed + 97) * 7) + .5)),
        insectes: Math.min(8, Math.floor(activite * (.35 + floraison * .65) * (1 + hasard(seed + 101) * 4) + .5)),
        lucioles: Math.min(8, Math.floor(lisse(.12, .76, insectes) * (4 + hasard(seed + 109) * 5) + .5)) };
      if (!h.abeilles && !h.insectes && !h.lucioles) return;
      cellules.set(cle, h); candidats.push(h);
    }
    const axe = c.n > 0 && c.x && c.z;
    if (axe) {
      // Les centres sont tirés dans l'espace du monde, sans rubans parallèles, paires
      // gauche/droite ou stations régulières le long de la route. Le champ écologique
      // conserve ses clairières vides et ses foyers fleuris, y compris végétation Off.
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (let i = 0; i < c.n; i++) { x0 = Math.min(x0, c.x[i]); x1 = Math.max(x1, c.x[i]); z0 = Math.min(z0, c.z[i]); z1 = Math.max(z1, c.z[i]); }
      // Le bord du domaine reste au-delà du fondu, même pour une vue de bord de piste.
      const marge = PORTEE + 48; x0 -= marge; z0 -= marge; x1 += marge; z1 += marge;
      const pas = Math.max(13, Math.sqrt((x1 - x0) * (z1 - z0) / 12000));
      for (let iz = Math.floor(z0 / pas); iz <= Math.ceil(z1 / pas); iz++) for (let ix = Math.floor(x0 / pas); ix <= Math.ceil(x1 / pas); ix++) {
        const seed = melanger(graine ^ Math.imul(ix, 83492791) ^ Math.imul(iz, 2654435761));
        if (hasard(seed + 3) < .22) continue;
        proposer((ix + .07 + hasard(seed + 7) * .86) * pas, (iz + .07 + hasard(seed + 11) * .86) * pas, .35);
      }
    } else for (const lot of decor.lots || []) for (const o of lot.objets || []) {
      // Compatibilité des petits décors sans axe de circuit : noms historiques ou marqueur
      // groundCover, quelle que soit la variante de maillage et sans dépendre du nom du lot.
      if (herbe(o) && o.p) proposer(o.p[0], o.p[2], clamp(Math.abs(o.s && o.s[1] || .35), .05, .9));
    }
    candidats.sort((a, b) => a.graine - b.graine || a.x - b.x || a.z - b.z);
    const sonde = { y: 0, normal: [0, 1, 0], color: [0, 0, 0] };
    for (const h of candidats) {
      if (resultat.length >= MAX_HABITATS) break;
      const centre = decor.surfaceHerbe(h.x, h.z, sonde);
      if (!centre || !Number.isFinite(centre.y)) continue;
      h.y = centre.y;
      h.rx = .32 + hasard(h.graine + 11) * 1.45; h.rz = .30 + hasard(h.graine + 29) * 1.50;
      h.pliX = .04 + hasard(h.graine + 43) * .21; h.pliZ = .05 + hasard(h.graine + 47) * .22;
      h.phaseX = hasard(h.graine + 53) * TAU; h.phaseZ = hasard(h.graine + 59) * TAU;
      h.freqX = 2 + h.graine % 3; h.freqZ = 2 + (h.graine >>> 4) % 2;
      const angle = hasard(h.graine + 41) * TAU; h.cos = Math.cos(angle); h.sin = Math.sin(angle);
      h.sols = new Float64Array(ECHANTILLONS); let valide = true;
      // Points et milieux de la trajectoire sont validés ; les grandes bandes route/eau/tunnel
      // ne peuvent être franchies par l'orbite locale. Les mêmes coordonnées servent au vol.
      for (let j = 0; j < ECHANTILLONS * 2; j++) {
        const a = j / (ECHANTILLONS * 2) * TAU;
        const lx = (Math.cos(a) + Math.sin(a * h.freqX + h.phaseX) * h.pliX) * h.rx;
        const lz = (Math.sin(a) + Math.cos(a * h.freqZ + h.phaseZ) * h.pliZ) * h.rz;
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
      slots[i] = { cle: -1, cible: -1, poids: 0, demande: 0, epoque: -1, phase: 0, phase2: 0, phase3: 0,
        vitesse: 0, flotte: 0, souffle: 0, hausse: 0, lueur: 0, impulsion: 0, taille: 0, altitude: 0, battement: 0, teinte: 0, objets };
    }
    return { slots, limite: 0, especes: espece, capacite: espece === 'abeille' ? 'abeilles' : espece === 'insecte' ? 'insectes' : 'lucioles',
      portee: espece === 'luciole' ? PORTEE : PORTEE_JOUR, debutFondu: espece === 'luciole' ? DEBUT_FONDU : 22,
      disponibles: new Int32Array(nombre), population: 0, composants, demande: -1, nombrePlan: -1, partiel: -1 };
  }
  function vue(nombreHabitats) {
    return { dernierTemps: null, selectionTemps: -Infinity, x: Infinity, z: Infinity, nombre: 0, generation: 0, epoque: 0,
      indices: new Int32Array(ANCRES).fill(-1), distances: new Float64Array(ANCRES), proprietaires: new Int32Array(nombreHabitats * 8),
      abeilles: pool('abeille', 32, 5), insectes: pool('insecte', 16, 3), lucioles: pool('luciole', 256, 2),
      stats: { abeilles: 0, insectes: 0, lucioles: 0, objets: 0, habitats: 0, requetes: 0 } };
  }
  function creer(c, decor) {
    const activite = decor && decor.saison && Number.isFinite(decor.saison.faune) ? clamp(decor.saison.faune, 0, 1) : 1;
    const liste = activite === 0 ? [] : habitats(c || {}, decor);
    return { habitats: liste, index: indexer(liste), montagne: !!c && c.theme === 'montagne',
      activite,
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
    peupler(etat, v, v.abeilles); peupler(etat, v, v.insectes); peupler(etat, v, v.lucioles);
    v.selectionTemps = temps; v.x = x; v.z = z; v.generation++; v.stats.requetes++;
  }
  function peupler(etat, v, p) {
    p.population = 0;
    // Une poche possède sa population propre. Le réglage est un plafond, il ne remplit
    // pas artificiellement les zones pauvres et ne crée jamais d'individus hors habitat.
    for (let individu = 0; individu < 8; individu++) {
      let foyers = 0;
      for (let j = 0; j < v.nombre; j++) {
        if (v.distances[j] >= p.portee * p.portee) break;
        const id = v.indices[j], h = etat.habitats[id];
        if (!h[p.capacite]) continue;
        if (p.especes !== 'luciole' && ++foyers > 8) break;
        if (individu >= h[p.capacite]) continue;
        p.disponibles[p.population++] = id * 8 + individu;
        if (p.population === p.slots.length) return;
      }
    }
  }
  function affecter(v, p, nombre, change) {
    nombre *= p.population / p.slots.length;
    if (!change && p.demande === nombre) return;
    const n = Math.min(Math.ceil(nombre), p.population);
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
      const cle = p.disponibles[i], ancien = proprietaires[cle];
      if (ancien >= 0) {
        slots[ancien].cible = cle; slots[ancien].demande = Math.min(1, nombre - i);
        if (i === n - 1) p.partiel = ancien;
      }
    }
    for (let i = 0; i < n; i++) {
      const cle = p.disponibles[i];
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
    s.phase = hasard(seed) * TAU; s.phase2 = hasard(seed + 17) * TAU; s.phase3 = hasard(seed + 19) * TAU;
    s.vitesse = (espece === 'luciole' ? .24 : .43) + hasard(seed + 3) * (espece === 'luciole' ? .53 : .85);
    s.taille = .72 + hasard(seed + 7) * .46; s.altitude = h.hauteurHerbe + (espece === 'luciole' ? .35 + hasard(seed + 11) * 1.35 : .31 + hasard(seed + 11) * .68);
    s.flotte = .13 + hasard(seed + 23) * .34; s.souffle = .035 + hasard(seed + 29) * .075; s.hausse = .02 + hasard(seed + 31) * .05;
    s.lueur = .65 + hasard(seed + 37) * 1.85; s.impulsion = seed % 3;
    s.teinte = seed % 3; s.battement = espece === 'insecte' && s.teinte !== 2 ? 8 + hasard(seed + 13) * 12 : 47 + hasard(seed + 13) * 48;
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
      if (h) cible *= 1 - lisse(p.debutFondu, p.portee, Math.hypot(h.x - x, h.z - z));
      s.poids += (cible - s.poids) * melange;
      if (s.cible >= 0 || s.poids > .008) limite = i + 1;
      if (!h || s.poids < .008 || v.stats.objets + p.composants > MAX_OBJETS) continue;
      const flottement = Math.sin(temps * s.flotte + s.phase2), souffleLent = Math.sin(temps * s.flotte * .371 + s.phase3);
      const a = temps * s.vitesse + s.phase + flottement * .28 + souffleLent * .12, ca = Math.cos(a), sa = Math.sin(a);
      const lx = (ca + Math.sin(a * h.freqX + h.phaseX) * h.pliX) * h.rx, lz = (sa + Math.cos(a * h.freqZ + h.phaseZ) * h.pliZ) * h.rz;
      const px = h.x + h.cos * lx - h.sin * lz, pz = h.z + h.sin * lx + h.cos * lz;
      const u = ((a / TAU % 1) + 1) % 1 * ECHANTILLONS, j = Math.floor(u), t = u - j;
      const sol = h.sols[j] + (h.sols[(j + 1) % ECHANTILLONS] - h.sols[j]) * t;
      const py = sol + s.altitude + Math.sin(a * 1.73 + s.phase2) * s.souffle + souffleLent * s.hausse;
      const vx = (-sa + Math.cos(a * h.freqX + h.phaseX) * h.pliX * h.freqX) * h.rx;
      const vz = (ca - Math.sin(a * h.freqZ + h.phaseZ) * h.pliZ * h.freqZ) * h.rz;
      const yaw = Math.atan2(h.sin * vx + h.cos * vz, h.cos * vx - h.sin * vz), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const e = Math.sqrt(clamp(s.poids, 0, 1)), taille = s.taille * e, o = s.objets;
      if (p.especes === 'luciole') {
        const onde = .5 + Math.sin(temps * s.lueur + s.phase + souffleLent * .21) * .5;
        let flash = onde * onde; if (s.impulsion > 0) flash *= flash; if (s.impulsion > 1) flash *= flash;
        const pulse = .16 + .84 * flash;
        const coeur = (.012 + (s.taille - .85) * .022) * e, halo = (.085 + (s.taille - .85) * .16) * (.9 + .1 * pulse) * e;
        placer(o[0], px, py, pz, coeur, coeur, coeur, yaw); placer(o[1], px, py, pz, halo, halo, halo, 0);
        if (s.teinte === 0) { couleur(o[0], .9, 1, .27); couleur(o[1], .72, 1, .22); }
        else if (s.teinte === 1) { couleur(o[0], 1, .88, .35); couleur(o[1], 1, .78, .2); }
        else { couleur(o[0], .65, 1, .6); couleur(o[1], .45, 1, .48); }
        o[0].emissive = 1.8 + pulse * 2.1; o[1].emissive = 1.3 + pulse * 1.3; o[1].alpha = s.poids * (.11 + pulse * .2);
        v.stats.lucioles++;
      } else if (p.especes === 'abeille') {
        const vol = Math.sin(temps * s.battement + s.phase + flottement * .3), pitch = Math.sin(a * 2 + s.phase3) * .12;
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
        const papillon = s.teinte !== 2, bat = Math.sin(temps * s.battement + s.phase + flottement * .3);
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
    const activite = etat.activite === 0 ? 0 : Number.isFinite(c.activite) ? clamp(c.activite, 0, 1) : etat.activite;
    stats.abeilles = stats.insectes = stats.lucioles = stats.objets = 0; stats.habitats = 0;
    temps = Number.isFinite(temps) ? temps : 0;
    if (qualite === 'off' || !etat.habitats.length || activite === 0 && !v.abeilles.limite && !v.insectes.limite && !v.lucioles.limite) {
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
    // Les habitats sont immuables : à l'arrêt, garder la sélection. Les distances et
    // fondus restent évalués chaque image ; un déplacement de 6 m renouvelle les foyers.
    const change = v.selectionTemps === -Infinity || (px - v.x) ** 2 + (pz - v.z) ** 2 > 36;
    if (change) selectionner(etat, v, px, pz, temps);
    stats.habitats = v.nombre;
    const budget = BUDGETS[qualite], jour = activite * (1 - lisse(.15, .65, etat.nuit)) * (1 - etat.pluie * .65);
    const nuitActive = etat.montagne ? activite * lisse(.35, .85, etat.nuit) * (1 - etat.pluie * .45) : 0;
    affecter(v, v.abeilles, budget.abeilles * jour, change);
    affecter(v, v.insectes, budget.insectes * jour, change);
    affecter(v, v.lucioles, budget.lucioles * nuitActive, change);
    dessinerPool(etat, v, v.abeilles, temps, dt, px, pz, sortie);
    dessinerPool(etat, v, v.insectes, temps, dt, px, pz, sortie);
    dessinerPool(etat, v, v.lucioles, temps, dt, px, pz, sortie);
    return stats;
  }
  B.faune = { BUDGETS, MAX_VUES, MAX_HABITATS, MAX_OBJETS, PORTEE, PORTEE_JOUR, creer, dessiner };
})(globalThis.BITUME = globalThis.BITUME || {});
