(function (B) {
  'use strict';
  // BITUME : pluie volumique projetée en 2D, sans nouvelle passe du moteur.
  // EMPRISE inspire les graines stables, les rafales et le mouillage ; voir docs/METEO.md.
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const modulo = (x, n) => x - Math.floor(x / n) * n;
  const PHASES = ['clair', 'couvre', 'pluie', 'orage'];
  const DUREES = [26, 12, 22, 16], PLUIE = [0, 0, .75, 1], NUAGES = [.12, .6, .85, 1];
  function hasard(n) {
    n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  // Copie bornée des seules observations utiles au jeu ; aucun lieu ni coordonnées dans l’état de course.
  function depuisReel(source) {
    if (!source || source.reel !== true) return null;
    const nombre = (cle, a, b, defaut) => Number.isFinite(source[cle]) ? clamp(source[cle], a, b) : defaut;
    return { reel: true, fixe: true, phase: PHASES.includes(source.phase) ? source.phase : 'couvre',
      pluie: nombre('pluie', 0, 1, 0), nuage: nombre('nuage', 0, 1, .4), mouille: nombre('mouille', 0, 1, 0),
      ventX: nombre('ventX', -60, 60, 0), ventZ: nombre('ventZ', -60, 60, 0),
      neige: source.neige === true, t: 0, tp: 0, eclair: 0,
      prochainEclair: source.phase === 'orage' ? 3 : 0 };
  }
  function avancer(S, dt) {
    const m = S.meteo || (S.meteo = { t: 0, phase: 'clair', tp: 0, pluie: 0, nuage: .12,
      eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9 });
    if (!(dt > 0) || !Number.isFinite(dt)) return m;
    if (m.reel) {
      // Le temps et l’eau évoluent ; les observations ne deviennent pas une météo variable de jeu.
      const pas = Math.min(.1, dt);
      m.t += pas; m.tp += pas; m.eclair = Math.max(0, m.eclair - pas * 6);
      const flocons = typeof m.precipitationsNeige === 'boolean' ? m.precipitationsNeige : m.neige === true;
      const pluieLiquide = flocons ? 0 : m.pluie;
      const apport = pluieLiquide * .039;
      const sechage = pluieLiquide > 0 ? Math.min(.004, apport) : .012;
      m.mouille = clamp((m.mouille || 0) + pas * (apport - sechage), 0, 1);
      if (m.phase === 'orage' && m.t >= m.prochainEclair) {
        m.eclair = 1; m.prochainEclair = m.t + 2.8 + hasard(Math.round(m.t * 1000)) * 4.2;
      }
      return m;
    }
    const fixe = m.fixe === true;
    let reste = Math.min(.1, dt);
    if (!Number.isFinite(m.mouille)) m.mouille = 0;
    // Découper aux frontières conserve le reliquat et la même évolution à 30, 60 et 120 Hz.
    while (reste > 1e-12) {
      const p = Math.max(0, PHASES.indexOf(m.phase));
      const pas = fixe ? reste : Math.min(reste, Math.max(0, DUREES[p] - m.tp));
      // La force manuelle reste constante toute la course ; le cycle variable garde ses cibles.
      const ciblePluie = fixe && Number.isFinite(m.pluieFixe) ? clamp(m.pluieFixe, 0, 1) : PLUIE[p];
      const k = -Math.expm1(-pas / 2.5), anciennePluie = m.pluie;
      m.pluie += (ciblePluie - m.pluie) * k;
      m.nuage += (NUAGES[p] - m.nuage) * k;
      // Intégrale de la pluie interpolée, avec un poids positif pour chaque intensité.
      const pluieLiquide = m.precipitationsNeige !== true;
      const poidsAncien = clamp(2.5 * k, 0, pas);
      const eau = pluieLiquide ? anciennePluie * poidsAncien + ciblePluie * (pas - poidsAncien) : 0;
      const apport = eau * .039;
      const sechageSousPluie = Math.min(apport, .004 * pas);
      // Après l'averse, reprendre le séchage à sec sous le seuil d'affichage des gouttes.
      const fractionSeche = !pluieLiquide ? 1 : ciblePluie > 0 ? 0 : clamp(1 - eau / (.025 * pas), 0, 1);
      const sechage = sechageSousPluie + fractionSeche * (.012 * pas - sechageSousPluie);
      m.mouille = clamp(m.mouille + (apport - sechage), 0, 1);
      m.t += pas; m.tp += pas; reste -= pas;
      m.eclair = Math.max(0, m.eclair - pas * 6);
      if (p === 3 && m.prochainEclair > 0 && m.t + 1e-10 >= m.prochainEclair) {
        const frappe = m.prochainEclair;
        m.eclair = Math.max(0, 1 - (m.t - frappe) * 6);
        m.prochainEclair = frappe + 2.8 + hasard(Math.round(frappe * 1000)) * 4.2;
      }
      if (!fixe && m.tp + 1e-10 >= DUREES[p]) {
        m.tp = 0; m.phase = PHASES[(p + 1) % PHASES.length];
        if (m.phase === 'orage') m.prochainEclair = m.t + 1.2;
      }
    }
    m.ventX = 1.8 + .9 * Math.sin(m.t * .61) + .5 * Math.sin(m.t * 1.47);
    m.ventZ = .55 + .35 * Math.cos(m.t * .43);
    return m;
  }
  function ambiance(m, sortie = {}) {
    // Humidité résiduelle = brume légère ; aucun reflet de sol n'est simulé par cet overlay.
    const flocons = typeof m.precipitationsNeige === 'boolean' ? m.precipitationsNeige : m.reel && m.neige;
    sortie.pluie = Math.max(flocons ? 0 : m.pluie * .72, (m.mouille || 0) * .14); sortie.nuage = m.nuage * .86;
    sortie.eclair = m.eclair * .30; sortie.mouille = m.mouille || 0;
    sortie.ventX = m.ventX || 0; sortie.ventZ = m.ventZ || 0;
    return sortie;
  }

  const N = 840, LARGEUR = 48, HAUTEUR = 18, EXPOSITION = 1 / 90, MAX_PIXELS = 2000000;
  // Gouttes par palier graphique, seulement si l'appelant le donne : les premières graines sont gardées,
  // un palier bas montre donc une partie des mêmes gouttes. Sans palier : les 840 gouttes.
  const BUDGETS = Object.freeze(Object.assign(Object.create(null), { low: 420, medium: 630, high: N, ultra: N }));
  const SANS_OPTIONS = Object.freeze({});
  // Couleur constante : l'opacité de chaque lot passe par globalAlpha, sans chaîne rgba à réanalyser.
  const COULEUR = 'rgb(190,210,225)';
  const BOITES_COUVERTS = new WeakMap(), VIDE = Object.freeze([]), HAUT = Object.freeze([0, 1, 0]);
  const RAYON_TOIT = Object.freeze({ mask: 2, staticOnly: true }), RAYON_VUE = Object.freeze({ mask: 3, staticOnly: true });
  const GENRE_TOIT = /^(voute-(tunnel|galerie)|portail-tunnel)$/;
  const HIT_CAMERA = {};
  // Ces boîtes servent uniquement à éviter les requêtes loin des ouvrages. Elles ne décident
  // jamais qu'une paroi est opaque : cette décision vient des primitives visibles installées dans PhysX.
  function boitesCouverts(c) {
    if (!B.couverts || !c || !B.couverts.liste(c).length) return VIDE;
    const prepare = B.couverts.preparer(c), ancien = BOITES_COUVERTS.get(c);
    if (ancien?.prepare === prepare) return ancien.boites;
    const boites = prepare.blocs.map(({ t, axe }) => {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      let devers = 0;
      for (let k = 0; k < axe.length; k += 5) {
        for (let j = 0; j < 3; j++) { min[j] = Math.min(min[j], axe[k + j]); max[j] = Math.max(max[j], axe[k + j]); }
        devers = Math.max(devers, Math.abs(Math.sin(axe[k + 4])) * t.mur);
      }
      const marge = t.mur + 3; min[0] -= marge; max[0] += marge; min[2] -= marge; max[2] += marge;
      min[1] -= .12 + devers; max[1] += t.hauteur + 2 + devers;
      return { min, max, logique: true };
    });
    // Les façades des tunnels sont plus larges et hautes que la voûte.
    // Enveloppes des primitives de decor.js (portails : côtés M+7,3 ±7,
    // sommet H+4,5 ±3,5 et côtés 7,5 ±7,75). Elles ne masquent rien :
    // elles garantissent seulement que le vrai raycast ne sera pas sauté.
    const q = {};
    for (let i = 0; i < prepare.blocs.length; i++) {
      const { t, axe } = prepare.blocs[i];
      if (B.couverts.type(t) !== 'tunnel') continue;
      for (let bout = 0; bout < 2; bout++) {
        B.circuit.echantillon(c, axe[bout ? axe.length - 2 : 3], q);
        const ca = Math.abs(Math.cos(q.cap)), sa = Math.abs(Math.sin(q.cap));
        const lateral = t.mur + 14.3, longitudinal = 2.01;
        const ex = ca * longitudinal + sa * lateral, ez = sa * longitudinal + ca * lateral;
        boites.push({ min: [q.x - ex, q.y - .26, q.z - ez],
          max: [q.x + ex, q.y + Math.max(t.hauteur + 8, 15.25) + .01, q.z + ez] });
      }
    }
    BOITES_COUVERTS.set(c, { prepare, boites }); return boites;
  }
  function contient(p, b) {
    return p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && p[2] >= b.min[2] && p[2] <= b.max[2];
  }
  function sousCouvert(c, p, boites) {
    // Un rayon peut partir d'un abri et finir loin dehors. Dans ce cas il n'est
    // pas nécessaire de parcourir tout l'axe des ouvrages pour sa destination.
    for (let i = 0; i < boites.length; i++) if (boites[i].logique && contient(p, boites[i])) return B.couverts.abri(c, p);
    return false;
  }
  function presDuCouvert(cam, point, queue, boites) {
    // Rejet conservateur du faisceau entier. Deux seuls rayons de bord peuvent
    // manquer un coin de boîte alors qu'il coupe le milieu du trait affiché.
    const minX = Math.min(cam[0], point[0], queue[0]), maxX = Math.max(cam[0], point[0], queue[0]);
    const minY = Math.min(cam[1], point[1], queue[1]), maxY = Math.max(cam[1], point[1], queue[1]);
    const minZ = Math.min(cam[2], point[2], queue[2]), maxZ = Math.max(cam[2], point[2], queue[2]);
    for (let i = 0; i < boites.length; i++) {
      const b = boites[i];
      if (maxX >= b.min[0] && minX <= b.max[0] && maxY >= b.min[1] && minY <= b.max[1] && maxZ >= b.min[2] && minZ <= b.max[2]) return true;
    }
    return false;
  }
  function sousToitReel(p, physique, boites, hit, stats) {
    if (!physique?.world?.raycast || !physique.solids?.acteurs) return false;
    let distance = 0;
    for (let i = 0; i < boites.length; i++) if (contient(p, boites[i])) distance = Math.max(distance, boites[i].max[1] - p[1]);
    if (!(distance > .01)) return false;
    if (stats) stats.rayons++;
    physique.world.raycast(p, HAUT, distance, RAYON_TOIT, hit);
    const genre = hit.hit && physique.solids.acteurs.get(hit.body)?.genre;
    return !!genre && GENRE_TOIT.test(genre);
  }
  // L'abri logique reste la référence de l'intérieur. La sonde complète seulement les débords
  // réellement dessinés (linteaux et rives du toit) ; géométrie et éclairage anciens sont conservés.
  function abriCouverts(c, p, physique) {
    return !!B.couverts?.abri(c, p) || sousToitReel(p, physique, boitesCouverts(c), HIT_CAMERA);
  }
  function creerPluie(canvas) {
    const ctx = canvas && canvas.getContext('2d');
    const graines = new Float64Array(N * 4), graineMasque = new Float64Array(N), segments = new Float32Array(N * 4);
    const lots = new Uint8Array(N);
    const stats = { candidats: 0, visibles: 0, traits: 0, lots: 0, lectures: 0, pixels: 0, propre: true, masquee: false,
      spatiaux: 0, abrites: 0, occultes: 0, rayons: 0 };
    const point = [0, 0, 0], queue = [0, 0, 0], milieu = [0, 0, 0], direction = [0, 0, 0], hit = {};
    const boitesLocales = [];
    function occulte(a, b, physique) {
      if (!physique?.world?.raycast) return false;
      for (let k = 0; k < 3; k++) direction[k] = b[k] - a[k];
      const distance = Math.hypot(direction[0], direction[1], direction[2]);
      if (!(distance > 0)) return false;
      stats.rayons++; physique.world.raycast(a, direction, distance, RAYON_VUE, hit);
      return hit.hit;
    }
    for (let i = 0; i < N; i++) {
      graines[i * 4] = hasard(i * 4 + 1) * LARGEUR;
      graines[i * 4 + 1] = hasard(i * 4 + 2) * HAUTEUR;
      graines[i * 4 + 2] = hasard(i * 4 + 3) * LARGEUR;
      graines[i * 4 + 3] = 12 + hasard(i * 4 + 4) * 4;
      graineMasque[i] = hasard(i + 4001);
    }
    let px = 0, py = 0, pz = 0, ancienYaw = 0, vx = 0, vy = 0, vz = 0, precedente = false;
    // propre : la toile ne contient aucun pixel. Masquée (visibility et non display, qui annulerait la taille
    // lue), elle n'est plus composée au-dessus de la scène ; elle ne réapparaît qu'avec un premier trait.
    let propre = true, masquee = false, w = 0, h = 0, dpr = 1;
    function montrer(visible) {
      if (masquee === !visible) return;
      masquee = !visible; stats.masquee = masquee;
      if (canvas && canvas.style) canvas.style.visibility = visible ? '' : 'hidden';
    }
    function vider() {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, canvas.width, canvas.height);
      propre = true;
    }
    // Taille CSS donnée par l'appelant (relevée au redimensionnement) ou, à défaut, relue sur la toile ;
    // sec, la dernière taille connue suffit, puisqu'elle ne sert alors qu'à garder le suivi de vitesse.
    function mesurer(o, sec) {
      const lw = Number(o.largeur), lh = Number(o.hauteur);
      if (lw > 0 && lh > 0) { w = lw; h = lh; return; }
      if (sec && w > 0 && h > 0) return;
      w = canvas.clientWidth; h = canvas.clientHeight; stats.lectures++;
    }
    // Définition : devicePixelRatio borné à 1,5, puis plafond de 2 Mpx commun avec la visière.
    function dimensionner(o) {
      dpr = clamp(o.dpr || 1, 1, 1.5);
      const plafond = Math.sqrt(MAX_PIXELS / (w * h));
      let largeur = Math.round(w * dpr), hauteur = Math.round(h * dpr);
      if (dpr > plafond) { dpr = plafond; largeur = Math.max(1, Math.floor(w * dpr)); hauteur = Math.max(1, Math.floor(h * dpr)); }
      if (canvas.width !== largeur || canvas.height !== hauteur) { canvas.width = largeur; canvas.height = hauteur; propre = true; }
      stats.pixels = canvas.width * canvas.height;
    }
    montrer(false); // toile neuve, vide : rien à composer avant la première goutte
    function dessiner(m, cam, dt, options) {
      const o = options || SANS_OPTIONS;
      stats.candidats = stats.visibles = stats.traits = stats.lots = stats.spatiaux = stats.abrites = stats.occultes = stats.rayons = 0;
      if (!ctx || !cam) return stats;
      const pluie = clamp(m.pluie || 0, 0, 1), sec = pluie < .025;
      mesurer(o, sec);
      if (!(w > 0 && h > 0)) return stats;
      const pos = cam.pos, yaw = cam.yaw || 0, pitch = cam.pitch || 0, roll = cam.roll || 0;
      if (dt > 0 && precedente) {
        const dx = pos[0] - px, dy = pos[1] - py, dz = pos[2] - pz;
        const distance = Math.hypot(dx, dy, dz), virage = Math.abs(Math.atan2(Math.sin(yaw - ancienYaw), Math.cos(yaw - ancienYaw)));
        // Une coupe de caméra ne devient pas une rafale. La pause conserve le dernier flou de mouvement.
        if (distance > 20 || distance / dt > 150 || virage > .7) vx = vy = vz = 0;
        else { vx = dx / dt; vy = dy / dt; vz = dz / dt; }
      }
      if (dt > 0 || !precedente) { px = pos[0]; py = pos[1]; pz = pos[2]; ancienYaw = yaw; precedente = true; }
      // Au sec : effacer une seule fois puis masquer ; ensuite ni mise en page, ni effacement, ni composition.
      if (sec) { if (!propre) vider(); montrer(false); stats.propre = propre; return stats; }
      dimensionner(o);
      if (!propre) vider();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      // Convention exacte FERRO (projection verticale, y vers le haut).
      const rx = cy * cr - sy * sp * sr, ry = cp * sr, rz = sy * cr + cy * sp * sr;
      const ux = -sy * sp * cr - cy * sr, uy = cp * cr, uz = cy * sp * cr - sy * sr;
      const fx = sy * cp, fy = sp, fz = -cy * cp;
      const focale = h / (2 * Math.tan(clamp(cam.fov || 60, 10, 110) * Math.PI / 360));
      const t = m.t || 0;
      // Intégrales analytiques du vent, sans saut lorsque sa vitesse change.
      const ventX = m.reel ? m.ventX || 0 : 1.8 + .9 * Math.sin(t * .61) + .5 * Math.sin(t * 1.47);
      const ventZ = m.reel ? m.ventZ || 0 : .55 + .35 * Math.cos(t * .43);
      const deriveX = m.reel ? t * ventX : 1.8 * t + .9 / .61 * (1 - Math.cos(t * .61)) + .5 / 1.47 * (1 - Math.cos(t * 1.47));
      const deriveZ = m.reel ? t * ventZ : .55 * t + .35 / .43 * Math.sin(t * .43);
      const intensite = clamp((pluie - .35) / .65, 0, 1), averse = intensite * intensite * (3 - 2 * intensite);
      const exposition = EXPOSITION * (1 + .45 * averse), maximum = Math.min(18, h * .025) * (1 + .30 * averse);
      const cible = Math.round((BUDGETS[o.palier] || N) * pluie);
      // L'enveloppe inclut la caméra, toutes les têtes et l'exposition entière des queues,
      // même en marche arrière. Hors de ce volume, aucun trait ni rayon ne peut toucher l'ouvrage.
      const ouvrages = boitesCouverts(o.circuit), boites = boitesLocales;
      const mx = LARGEUR / 2 + Math.abs(ventX - vx) * exposition, mz = LARGEUR / 2 + Math.abs(ventZ - vz) * exposition;
      const my = HAUTEUR / 2 + (16 + Math.abs(vy)) * exposition;
      let nbBoites = 0;
      for (let j = 0; j < ouvrages.length; j++) {
        const b = ouvrages[j];
        if (b.max[0] >= pos[0]-mx && b.min[0] <= pos[0]+mx && b.max[2] >= pos[2]-mz && b.min[2] <= pos[2]+mz &&
            b.max[1] >= pos[1]-my && b.min[1] <= pos[1]+my) boites[nbBoites++] = b;
      }
      boites.length = nbBoites;
      stats.candidats = cible;
      for (let i = 0; i < cible; i++) {
        const k = i * 4, chute = graines[k + 3];
        // Champ périodique ancré au monde, recentré par cellules autour de la caméra.
        const x = modulo(graines[k] + deriveX - pos[0] + LARGEUR / 2, LARGEUR) - LARGEUR / 2;
        const y = modulo(graines[k + 1] - chute * t - pos[1] + HAUTEUR / 2, HAUTEUR) - HAUTEUR / 2;
        const z = modulo(graines[k + 2] + deriveZ - pos[2] + LARGEUR / 2, LARGEUR) - LARGEUR / 2;
        const profondeur = x * fx + y * fy + z * fz;
        if (profondeur < .8) continue;
        const ex = w * .5 + (x * rx + y * ry + z * rz) * focale / profondeur;
        const ey = h * .5 - (x * ux + y * uy + z * uz) * focale / profondeur;
        if (ex < -20 || ex > w + 20 || ey < -20 || ey > h + 20) continue;
        const proche = clamp((profondeur - .8) / 2, 0, 1);
        const loin = clamp((30 - profondeur) / 10, 0, 1);
        if (graineMasque[i] >= proche * loin || (o.cockpit && ey >= h * .86)) continue;
        if (boites.length) {
          point[0] = pos[0] + x; point[1] = pos[1] + y; point[2] = pos[2] + z;
          if (sousCouvert(o.circuit, point, boites)) {
            stats.spatiaux++; stats.abrites++; continue;
          }
        }
        // La vitesse relative produit une vraie expansion à grande vitesse, même droit devant.
        const tx = x - (ventX - vx) * exposition, ty = y + (chute + vy) * exposition, tz = z - (ventZ - vz) * exposition;
        const dp = tx * fx + ty * fy + tz * fz;
        if (dp < .8) continue;
        let dx = w * .5 + (tx * rx + ty * ry + tz * rz) * focale / dp - ex;
        let dy = h * .5 - (tx * ux + ty * uy + tz * uz) * focale / dp - ey;
        const longueur = Math.hypot(dx, dy);
        const fractionEcran = longueur > maximum ? maximum / longueur : 1;
        if (fractionEcran < 1) { dx *= fractionEcran; dy *= fractionEcran; }
        if (o.cockpit) {
          // La partie la plus basse du trait gouverne le masque, également sous forte averse.
          const bas = clamp(((ey + Math.max(0, dy)) / h - .49) / .37, 0, 1);
          if (graineMasque[i] >= (1 - bas * bas * (3 - 2 * bas)) * proche * loin) continue;
        }
        // Ne requêter que des traits déjà projetés dans le cadre et dont le rayon rencontre un
        // couvert. Aucun quota aléatoire : tous ces traits ont la même protection, même en Légère.
        // Deux extrémités sèches et trois lignes de vue protègent aussi le flou près d'un pilier.
        if (boites.length) {
          // La limite en pixels raccourcit le trait. Sa fraction dans le monde n'est pas
          // linéaire en perspective : sonder la queue entière manquerait un portail situé
          // au milieu de la seule portion réellement dessinée, surtout à grande vitesse.
          const fractionMonde = fractionEcran * profondeur / (dp * (1 - fractionEcran) + fractionEcran * profondeur);
          const profondeurQueue = profondeur + (dp - profondeur) * fractionMonde;
          queue[0] = point[0] + (tx - x) * fractionMonde;
          queue[1] = point[1] + (ty - y) * fractionMonde;
          queue[2] = point[2] + (tz - z) * fractionMonde;
          if (presDuCouvert(pos, point, queue, boites)) {
            stats.spatiaux++;
            if (sousCouvert(o.circuit, queue, boites)) { stats.abrites++; continue; }
            // Une paroi coupe le trait avant toute sonde verticale ou supplémentaire.
            if (occulte(pos, point, o.physique)) { stats.occultes++; continue; }
            if (sousToitReel(point, o.physique, boites, hit, stats) || sousToitReel(queue, o.physique, boites, hit, stats)) { stats.abrites++; continue; }
            const fractionMilieu = profondeur / (profondeur + profondeurQueue);
            for (let k = 0; k < 3; k++) milieu[k] = point[k] + (queue[k] - point[k]) * fractionMilieu;
            if (occulte(pos, queue, o.physique) || occulte(pos, milieu, o.physique)) { stats.occultes++; continue; }
          }
        }
        const j = stats.visibles++, o4 = j * 4;
        segments[o4] = ex; segments[o4 + 1] = ey; segments[o4 + 2] = ex + dx; segments[o4 + 3] = ey + dy;
        lots[j] = profondeur < 8 ? 0 : profondeur < 17 ? 1 : 2;
      }
      // Couleur et bouts ronds reposés à chaque tracé : une valeur inchangée ne coûte rien, et un contexte
      // réinitialisé (redimensionnement, perte de contexte) ne peut pas tracer en noir.
      ctx.lineCap = 'round'; ctx.strokeStyle = COULEUR;
      for (let lot = 2; lot >= 0; lot--) {
        let n = 0;
        for (let j = 0; j < stats.visibles; j++) if (lots[j] === lot) {
          if (!n) {
            ctx.lineWidth = (lot === 0 ? 1 : lot === 1 ? .75 : .5) + .25 * averse;
            ctx.globalAlpha = ((lot === 0 ? .28 : lot === 1 ? .21 : .14) + (lot === 2 ? .17 : .21) * averse) * (.55 + pluie * .45);
            ctx.beginPath();
          }
          const o4 = j * 4; ctx.moveTo(segments[o4], segments[o4 + 1]); ctx.lineTo(segments[o4 + 2], segments[o4 + 3]); n++;
        }
        if (n) { ctx.stroke(); stats.lots++; stats.traits += n; }
      }
      ctx.globalAlpha = 1;
      if (stats.traits) { propre = false; montrer(true); } else montrer(false);
      stats.propre = propre;
      return stats;
    }
    // Sous le voile de chargement : un trait presque transparent, composé une fois, pour que la première
    // pluie ne paie pas la création de la surface et du tracé 2D. L'appel suivant au sec l'efface et masque.
    function prechauffer(options) {
      const o = options || SANS_OPTIONS;
      if (!ctx) return false;
      mesurer(o, false);
      if (!(w > 0 && h > 0)) return false;
      dimensionner(o);
      if (!propre) vider();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = 'round'; ctx.strokeStyle = COULEUR;
      ctx.lineWidth = 1; ctx.globalAlpha = 1 / 255; ctx.beginPath();
      ctx.moveTo(w * .5, h * .5); ctx.lineTo(w * .5 + 1, h * .5 + 8); ctx.stroke(); ctx.globalAlpha = 1;
      propre = false; stats.propre = false; montrer(true);
      return true;
    }
    return { dessiner, prechauffer, stats };
  }
  function initial(graine) {
    const r = hasard((graine >>> 0) + 1);
    const phase = r < 1 / 3 ? 'clair' : r < 2 / 3 ? 'pluie' : 'clair';
    const fixe = r >= 2 / 3 ? false : true;
    // variable (ni soleil ni pluie fixe) : cycle complet, départ clair
    const phaseFinale = fixe ? phase : 'clair';
    const idx = Math.max(0, PHASES.indexOf(phaseFinale));
    return { t: 0, phase: phaseFinale, tp: 0, pluie: PLUIE[idx], nuage: NUAGES[idx],
      eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9, fixe };
  }
  function pour(mode) {
    if (mode === 'soleil') return { t: 0, phase: 'clair', tp: 0, pluie: 0, nuage: .12, eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9, fixe: true };
    if (mode === 'pluie') return { t: 0, phase: 'pluie', tp: 0, pluie: .75, nuage: .85, eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9, fixe: true };
    if (mode === 'variable') return { t: 0, phase: 'clair', tp: 0, pluie: 0, nuage: .12, eclair: 0, prochainEclair: 0, mouille: 0, ventX: 1.8, ventZ: .9, fixe: false };
    return null;
  }
  B.meteo = { avancer, ambiance, creerPluie, abriCouverts, initial, pour, depuisReel, GOUTTES: BUDGETS, MAX_PIXELS };
})(globalThis.BITUME = globalThis.BITUME || {});
