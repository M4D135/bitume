/* BITUME — cadrages originaux des démos, préparés dans le décor réellement construit.
   Lecture seule : ni voiture, ni animal, ni horloge, ni tirage de simulation ne sont modifiés. */
(function (B) {
  'use strict';
  const VUES = Object.freeze(['panorama', 'lieu', 'peloton']);
  const NATURE = new Set(['panorama', 'lieu']), CACHE = new WeakMap();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lisse = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const BAS = Object.freeze([0, -1, 0]), PAS_TRAJET = 24;
  const fini = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
  const GEOMETRIES = new Map();
  function rochersVisuels(decor) {
    // Ces rochers sont dessinés mais ne participent pas à la conduite. La caméra lit leurs triangles,
    // sans ajouter de corps au monde PhysX ni transformer les houppiers en murs opaques.
    const resultat = [], vus = new Set();
    let primitives = null;
    for (const lot of (decor.lotsHerbier || []).concat(decor.lots || [])) for (const o of lot.objets || []) {
      if (vus.has(o)) continue; vus.add(o);
      if (o.collision || o.solidePhysX || Math.floor(o.mat) !== 9 || !(['sphere', 'octa'].includes(o.shape) || String(o.shape).startsWith('bitume-lieu-')) || !fini(o.p) || !fini(o.s)) continue;
      if (!GEOMETRIES.has(o.shape)) {
        const triangles = [], libres = globalThis.FRender?.shared?.shapes?.get(o.shape) || B.lieux?.FORMES?.[o.shape];
        if (libres) {
          // Les formes procédurales exposent déjà leurs triangles. Ne pas reconstruire tout
          // le catalogue de géométrie pour chaque rocher, notamment pendant le chargement Cimes.
          for (const t of libres) for (let j = 0; j < 3; j++) triangles.push(...t[j]);
        } else {
          primitives ||= globalThis.FRender?.shared?.geometry();
          const plage = primitives?.ranges[o.shape];
          if (plage) for (let k = 0; k < plage.count; k++) {
            const v = primitives.indices[plage.offset / 4 + k] * 6;
            triangles.push(primitives.vertices[v], primitives.vertices[v + 1], primitives.vertices[v + 2]);
          }
        }
        GEOMETRIES.set(o.shape, triangles.length ? new Float32Array(triangles) : null);
      }
      const r = o.r || [0, 0, 0], rayon = Math.hypot(...o.s) / 2;
      resultat.push({ p: o.p, s: o.s, rayon, triangles: GEOMETRIES.get(o.shape),
        cx: Math.cos(r[0]), sx: Math.sin(r[0]), cy: Math.cos(r[1]), sy: Math.sin(r[1]), cz: Math.cos(r[2]), sz: Math.sin(r[2]) });
    }
    return resultat;
  }
  function localRocher(o, v, point) {
    const x = v[0] - (point ? o.p[0] : 0), y = v[1] - (point ? o.p[1] : 0), z = v[2] - (point ? o.p[2] : 0);
    const xz = o.cz * x + o.sz * y, yz = -o.sz * x + o.cz * y;
    const xy = o.cy * xz - o.sy * z, zy = o.sy * xz + o.cy * z;
    return [xy / o.s[0], (o.cx * yz + o.sx * zy) / o.s[1], (-o.sx * yz + o.cx * zy) / o.s[2]];
  }
  function impactVisuel(C, origine, direction, longueur) {
    let premier = Infinity;
    for (const o of C.visuels || []) {
      const qx = origine[0] - o.p[0], qy = origine[1] - o.p[1], qz = origine[2] - o.p[2];
      const b = qx * direction[0] + qy * direction[1] + qz * direction[2];
      const discriminant = b * b - (qx ** 2 + qy ** 2 + qz ** 2 - o.rayon ** 2);
      if (discriminant < 0) continue;
      const r = Math.sqrt(discriminant);
      if (-b + r < 0 || -b - r > Math.min(longueur, premier)) continue;
      // Un contexte sans géométrie FERRO peut seulement refuser l'enveloppe ; le jeu utilise les triangles.
      if (!o.triangles) { premier = Math.min(premier, Math.max(0, -b - r)); continue; }
      const p = localRocher(o, origine, true), d = localRocher(o, direction, false), T = o.triangles;
      for (let k = 0; k < T.length; k += 9) {
        const ax = T[k + 3] - T[k], ay = T[k + 4] - T[k + 1], az = T[k + 5] - T[k + 2];
        const bx = T[k + 6] - T[k], by = T[k + 7] - T[k + 1], bz = T[k + 8] - T[k + 2];
        const hx = d[1] * bz - d[2] * by, hy = d[2] * bx - d[0] * bz, hz = d[0] * by - d[1] * bx;
        const det = ax * hx + ay * hy + az * hz; if (Math.abs(det) < 1e-12) continue;
        const sx = p[0] - T[k], sy = p[1] - T[k + 1], sz = p[2] - T[k + 2];
        const u = (sx * hx + sy * hy + sz * hz) / det; if (u < 0 || u > 1) continue;
        const qx = sy * az - sz * ay, qy = sz * ax - sx * az, qz = sx * ay - sy * ax;
        const v = (d[0] * qx + d[1] * qy + d[2] * qz) / det; if (v < 0 || u + v > 1) continue;
        const t = (bx * qx + by * qy + bz * qz) / det;
        if (t >= 0 && t <= longueur) premier = Math.min(premier, t);
      }
    }
    return premier;
  }
  function impact(C, de, vers, depart = 0, suite = 0) {
    const dir = C.rayon, origine = C.origine;
    const dx = vers[0] - de[0], dy = vers[1] - de[1], dz = vers[2] - de[2], d = Math.hypot(dx, dy, dz);
    if (d < 1e-7) return Infinity;
    depart = Math.min(depart, d * .45);
    dir[0] = dx / d; dir[1] = dy / d; dir[2] = dz / d;
    for (let j = 0; j < 3; j++) origine[j] = de[j] + dir[j] * depart;
    const longueur = d - depart + suite;
    let distance = impactVisuel(C, origine, dir, longueur);
    if (C.monde?.raycast) {
      C.requetes++;
      const h = C.monde.raycast(origine, dir, longueur, { mask: 3, staticOnly: true }, C.hit);
      if (h.hit) distance = Math.min(distance, Number.isFinite(h.distance) ? h.distance : 0);
    }
    return distance + depart;
  }
  function plusProche(c, x, z) {
    let d = Infinity, k = 0;
    for (let i = 0; i < c.n; i += 4) { const q = (c.x[i] - x) ** 2 + (c.z[i] - z) ** 2; if (q < d) { d = q; k = i; } }
    return k * c.pas;
  }
  function fenetresPanorama(c, arrivee) {
    const sections = B.saisons?.secteurs?.(c);
    if (!sections) return null;
    // Une première fenêtre par portion ; attribuer le reste aux plus grandes distances
    // encore couvertes par une seule prise. Huit trajectoires en tout, comme sur une piste simple.
    const frequences = sections.plages.map(() => 1);
    for (let n=frequences.length; n<8; n++) {
      let indice=0, maximum=-1;
      for (let i=0; i<frequences.length; i++) {
        const p=sections.plages[i], largeur=(p.fin-p.debut)/frequences[i];
        if (largeur>maximum) { maximum=largeur; indice=i; }
      }
      frequences[indice]++;
    }
    const fenetres=[];
    for (let i=0; i<frequences.length; i++) {
      const p=sections.plages[i], fin=Math.min(p.fin,arrivee), largeur=(fin-p.debut)/frequences[i];
      if (!(largeur>0)) continue;
      for (let j=0; j<frequences[i]; j++) fenetres.push([p.debut+j*largeur,p.debut+(j+1)*largeur]);
    }
    return fenetres;
  }
  function statiques(c, decor) {
    const cached = CACHE.get(decor); if (cached) return cached;
    const panorama = [], lieu = [], virages = B.virages?.planifier(c) || [];
    let maxY = -Infinity, minY = Infinity;
    for (const n of decor.nappes || []) for (let k = 1; k < n.sommets.length; k += 13) {
      maxY = Math.max(maxY, n.sommets[k]); minY = Math.min(minY, n.sommets[k]);
    }
    if (!Number.isFinite(maxY)) { maxY = 300; minY = -100; }
    // Huit fenêtres du tracé : relief et courbes différents, sans inventer un lieu absent du décor.
    const arrivee = c.ouvert ? (c.arrivee ?? c.longueur) : c.longueur;
    const fenetres = fenetresPanorama(c, arrivee);
    for (let secteur = 0; secteur < (fenetres ? fenetres.length : 8); secteur++) {
      const debut = fenetres ? fenetres[secteur][0] : secteur * arrivee / 8;
      const fin = fenetres ? fenetres[secteur][1] : (secteur + 1) * arrivee / 8;
      let courbe = null;
      for (const v of virages) {
        if (v.sommet < debut || v.sommet >= fin || B.circuit.dansCouvert(c, v.sommet, 90)) continue;
        if (!courbe || v.angle > courbe.angle) courbe = v;
      }
      if (courbe) {
        const q = B.circuit.echantillon(c, courbe.sommet);
        // Lot J : cadrage bas centré sur la route et la courbe (fini les vues lointaines à 48 m / 105 m).
        panorama.push({ type: 'panorama', s: courbe.sommet, cap: q.cap, cible: [q.x,q.y+2,q.z],
          rayon: 64, hauteur: 19, label: courbe.libelle, virage: courbe.id });
        continue;
      }
      let meilleur = null;
      for (let j = 0; j < 6; j++) {
        const s = debut + (j + .5) * (fin - debut) / 6;
        if (B.circuit.dansCouvert(c, s, 90)) continue;
        const q = B.circuit.echantillon(c, s), score = q.y + Math.abs(q.courbure) * 1800 + Math.abs(q.pente || 0) * 180;
        if (!meilleur || score > meilleur.score) meilleur = { type: 'panorama', s, cap: q.cap, cible: [q.x, q.y + 2, q.z], rayon: 64, hauteur: 19, label: 'Relief et tracé', score };
      }
      if (meilleur) panorama.push(meilleur);
    }
    // Lieux réellement posés dans ce décor (et pas seulement un nom associé au biome).
    // Le marqueur surplombe l'ouvrage ; une visée à cet endroit montre sa silhouette sans partir
    // de l'intérieur d'une paroi. Le recul garde aussi son contexte routier dans le cadre.
    for (const marqueur of decor.lieux?.marqueurs || []) {
      if (![marqueur.x, marqueur.y, marqueur.z].every(Number.isFinite)) continue;
      const s = plusProche(c, marqueur.x, marqueur.z), q = B.circuit.echantillon(c, s);
      const ecart = Math.hypot(marqueur.x - q.x, marqueur.z - q.z);
      lieu.push({ type: 'lieu', marqueur, s, cap: q.cap, cible: [marqueur.x, marqueur.y + 1.5, marqueur.z],
        route: [q.x, q.y + 1, q.z], rayon: clamp(54 + ecart * .7, 54, 135),
        hauteur: clamp(16 + Math.max(0, marqueur.y - q.y) * .14, 16, 30), label: marqueur.nom });
    }
    const data = { panorama, lieu, maxY, minY, visuels: rochersVisuels(decor) }; CACHE.set(decor, data); return data;
  }
  function preparer(c, decor, animaux, monde) {
    // L'argument historique animaux est ignoré : aucune population ni pose animale ne prépare un plan.
    const base = statiques(c, decor);
    const C = { c, decor, monde, ancres: { panorama: base.panorama, lieu: base.lieu }, maxY: base.maxY, minY: base.minY,
      options: {}, poseVue: { x: 0, y: 0, z: 0 },
      rayon: [0, 0, 0], origine: [0, 0, 0], cible: [0, 0, 0], position: [0, 0, 0], hit: {}, solHit: {}, requetes: 0,
      trajets: new WeakMap(), cadres: new WeakMap(), bras: new WeakMap(), visuels: base.visuels, dernierCadre: null };
    // Les deux côtés de chaque plan sont contrôlés sur toute leur trajectoire au chargement.
    // Le relief ne repousse jamais la caméra en cours de prise ; une perte de visibilité fait couper.
    for (const a of base.panorama.concat(base.lieu)) C.trajets.set(a, [preparerTrajet(C, a, -1), preparerTrajet(C, a, 1)]);
    return C;
  }
  function regler(C, options) { if (C) Object.assign(C.options, options); return C; }
  function disponible(C, a, t) {
    return !!C && !!a && NATURE.has(a.type) && !!C.trajets.get(a)?.some(Boolean);
  }
  function choisir(C, type, numero, t, position) {
    const liste = C?.ancres[type]; if (!liste?.length) return null;
    let meilleure = null, distance = Infinity;
    for (let i = 0; i < liste.length; i++) {
      const a = liste[(numero + i) % liste.length];
      if (!disponible(C, a, t)) continue;
      if (!Number.isFinite(position)) return a;
      const ecart = Math.abs(B.circuit.ecart(C.c, a.s, position));
      if (type === 'lieu' && ecart > Math.min(800, C.c.longueur * .18)) continue;
      if (ecart < distance) { meilleure = a; distance = ecart; }
    }
    return meilleure;
  }
  function sol(C, x, z, y) {
    if (C.monde?.raycast) {
      const top = Math.max(C.maxY + 20, y + 30), from = C.origine; from[0] = x; from[1] = top; from[2] = z;
      C.requetes++;
      const h = C.monde.raycast(from, BAS, top - C.minY + 100, { mask: 1, staticOnly: true }, C.solHit);
      if (h.hit) return h.y;
    }
    const h = C.decor.sol?.(x, z);
    return Number.isFinite(h) ? h : y - 1;
  }
  // Contrôle seulement : un obstacle provoque une vraie coupe du montage, jamais un déplacement instantané
  // dans le même plan. Le rayon dépasse légèrement la caméra pour réserver son plan proche.
  function libre(C, pos, cible, margeSujet = .15) {
    if (!fini(pos) || !fini(cible) || pos[1] < sol(C, pos[0], pos[2], pos[1]) + .38) return false;
    return segmentLibre(C, pos, cible, margeSujet);
  }
  function segmentLibre(C, pos, cible, margeSujet) {
    const d = Math.hypot(...pos.map((v, j) => v - cible[j]));
    return d >= Math.max(.7, margeSujet + .4) && impact(C, cible, pos, margeSujet, .25) === Infinity;
  }
  function placer(a, trajet, u, out) {
    const angle = trajet.angle + trajet.cote * (u - .5) * .22, r = a.rayon * (1.08 - .16 * u);
    out[0] = a.cible[0] - Math.cos(angle) * r; out[2] = a.cible[2] - Math.sin(angle) * r;
    out[1] = a.cible[1] + a.hauteur * (1.13 - .18 * u) + trajet.elevation;
    return out;
  }
  function preparerTrajet(C, a, cote) {
    const p = [0, 0, 0], marge = a.margeSujet || .15;
    // Le choix du côté se fait une seule fois. Les alternatives gardent le sujet et le décor réel.
    for (const offset of [0, Math.PI / 3, -Math.PI / 3, 2 * Math.PI / 3, -2 * Math.PI / 3, Math.PI]) {
      const trajet = { angle: a.cap + cote * 1.05 + offset, cote, elevation: 0 };
      let elevation = 0;
      for (let k = 0; k <= PAS_TRAJET; k++) {
        placer(a, trajet, k / PAS_TRAJET, p);
        elevation = Math.max(elevation, sol(C, p[0], p[2], p[1]) + .6 - p[1]);
      }
      if (elevation > 80) continue;
      trajet.elevation = elevation;
      let valide = true;
      for (let k = 0; k <= PAS_TRAJET; k++) if (!libre(C, placer(a, trajet, k / PAS_TRAJET, p), a.cible, marge)) { valide = false; break; }
      if (valide) return trajet;
    }
    return null;
  }
  function viser(pos, cible, fov, nature = false) {
    const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2], d = Math.hypot(dx, dy, dz) || 1;
    return { pos: pos.slice(), cible: cible.slice(), yaw: Math.atan2(dx, -dz), pitch: Math.asin(clamp(dy / d, -1, 1)), roll: 0,
      fov: clamp(fov, 26, 64), near: .08, far: 6000, sujetNature: nature };
  }
  function objectif(cam, aspect) {
    if (!cam || !fini(cam.pos) || ![cam.yaw, cam.pitch, cam.fov, aspect].every(Number.isFinite) || aspect <= 0 || cam.fov <= 0 || cam.fov >= 150) return null;
    const near = cam.near ?? .1, roll = cam.roll || 0;
    if (!Number.isFinite(near) || near <= 0 || !Number.isFinite(roll)) return null;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), sp = Math.sin(cam.pitch), cp = Math.cos(cam.pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll), droite = [cy, 0, sy], haut = [-sy * sp, cp, cy * sp];
    const h = near * Math.tan(cam.fov * Math.PI / 360) + .06, w = (h - .06) * aspect + .06;
    const centre = [cam.pos[0] + sy * cp * near, cam.pos[1] + sp * near, cam.pos[2] - cy * cp * near];
    const points = [cam.pos.slice()];
    for (const x of [-1, 1]) for (const y of [-1, 1]) points.push(centre.map((v, k) =>
      v + x * w * (droite[k] * cr + haut[k] * sr) + y * h * (haut[k] * cr - droite[k] * sr)));
    return points;
  }
  function valider(C, cam, cible, plan, t, aspect = 16 / 9) {
    if (!C || !fini(cible)) return false;
    const points = objectif(cam, aspect); if (!points) return false;
    const marge = plan?.ancre?.margeSujet || .15;
    // Une hauteur depuis le ciel confondrait le toit du tunnel avec son sol. Les cinq rayons partent
    // du sujet réel : la visée et tout le plan proche doivent rester dans le même espace libre.
    for (const p of points) if (impact(C, cible, p, marge, .04) !== Infinity) return false;
    const avant = plan && C.cadres.get(plan);
    if (avant && Number.isFinite(t) && t > avant.t) {
      for (let k = 0; k < points.length; k++) if (impact(C, avant.points[k], points[k], 0, .04) !== Infinity) return false;
    }
    if (plan) C.cadres.set(plan, { points, t });
    C.dernierCadre = { cam: { ...cam, pos: cam.pos.slice(), cible: cible.slice() }, aspect };
    return true;
  }
  function secours(C, aspect = 16 / 9) {
    if (!C) return null;
    const dernier = C.dernierCadre;
    // Le monde statique est inchangé pendant la séance. Conserver aussi l'ancienne cible numérique
    // évite de réorienter ce poste sûr vers une voiture désormais derrière un mur.
    if (dernier && (dernier.aspect === aspect || valider(C, dernier.cam, dernier.cam.cible, null, 0, aspect)))
      return { ...dernier.cam, pos: dernier.cam.pos.slice(), cible: dernier.cam.cible.slice(), secours: true };
    for (const a of C.ancres.panorama) {
      const trajet = C.trajets.get(a)?.find(Boolean); if (!trajet) continue;
      const cam = viser(placer(a, trajet, .5, [0, 0, 0]), a.cible, 46, true);
      if (!valider(C, cam, cam.cible, null, 0, aspect)) continue;
      C.poseVue.x = cam.pos[0]; C.poseVue.y = cam.pos[1]; C.poseVue.z = cam.pos[2];
      return { ...cam, secours: true };
    }
    return null; // le raccord conserve alors l'image précédente, il n'invente pas de poste
  }
  function poursuite(C, cam, p, plan, t, aspect = 16 / 9) {
    if (!C || !cam || !p || ![p.x, p.y, p.z].every(Number.isFinite)) return null;
    const cible = [p.x, p.y + .65, p.z], souhaite = [cam.pos[0], p.y + 2.45, cam.pos[2]];
    const direction = souhaite.map((v, k) => v - cible[k]), longueur = Math.hypot(...direction);
    if (!Number.isFinite(longueur) || longueur < 1.2) return null;
    for (let k = 0; k < 3; k++) direction[k] /= longueur;
    const cadre = { ...cam, pos: souhaite, cible, yaw: Math.atan2(-direction[0], direction[2]), pitch: Math.asin(-direction[1]), roll: 0 };
    const points = objectif(cadre, aspect); if (!points) return null;
    let libre = longueur;
    // Un bras de caméra, indépendant de la conduite : cinq rayons parallèles réservent aussi les
    // coins de l'objectif. Le décor proche raccourcit le bras ; il ne le pousse pas sur une montagne.
    for (const q of points) {
      const de = cible.map((v, k) => v + q[k] - souhaite[k]);
      libre = Math.min(libre, impact(C, de, q, 0, .2) - .2);
    }
    const avant = plan && C.bras.get(plan);
    if (avant && Number.isFinite(t) && t >= avant.t) libre = Math.min(libre, avant.longueur + (t - avant.t) * 3);
    if (libre < 1.2) return null;
    cadre.pos = cible.map((v, k) => v + direction[k] * libre);
    if (!valider(C, cadre, cible, plan, t, aspect)) return null;
    if (plan) C.bras.set(plan, { longueur: libre, t });
    return cadre;
  }
  function souffle(C, cam, plan, poses, co, t, intensite, aspect = 16 / 9) {
    if (!C || !cam || !['tele', 'sol'].includes(plan?.vue) || !(intensite > 0)) return cam;
    let yaw = 0, pitch = 0, roll = 0;
    for (const v of co?.voitures || []) {
      const p = poses[v.id], e = v.etat; if (!p || !e) continue;
      const vitesse = e._physx?.velocity, vx = vitesse ? vitesse[0] : Math.cos(p.cap) * e.v, vz = vitesse ? vitesse[2] : Math.sin(p.cap) * e.v;
      const norme = Math.hypot(vx, vz); if (!Number.isFinite(norme) || norme < 12) continue;
      const dx = p.x - cam.pos[0], dz = p.z - cam.pos[2], temps = (dx * vx + dz * vz) / (norme * norme);
      if (temps <= 0 || temps >= 1) continue;
      const lateral = (dz * vx - dx * vz) / norme, distance = Math.hypot(lateral, p.y + .5 - cam.pos[1]);
      if (distance >= 20) continue;
      // Réponse amortie au passage : fonction de la pose/vitesse réelle, identique à 30/60/120 Hz.
      // Aucun oscillateur au repos, aucune impulsion avant le passage ou loin du poste.
      const force = Math.min(1.6, (norme / 70) ** 2) * (1 - distance / 20) ** 2;
      const impulsion = force * Math.sin(temps * 20) * Math.exp(-temps * 6) * (1 - lisse((temps - .7) / .3));
      yaw += Math.sign(lateral) * impulsion * .003; pitch += impulsion * .0015; roll += Math.sign(lateral) * impulsion * .002;
    }
    const gain = clamp(intensite, 0, 1);
    yaw = clamp(yaw, -.004, .004) * gain; pitch = clamp(pitch, -.002, .002) * gain; roll = clamp(roll, -.003, .003) * gain;
    if (Math.abs(yaw) + Math.abs(pitch) + Math.abs(roll) < 1e-8) return cam;
    const final = { ...cam, yaw: cam.yaw + yaw, pitch: cam.pitch + pitch, roll: (cam.roll || 0) + roll };
    const p = poses[plan.sujet], cible = cam.cible || (p && [p.x, p.y + .65, p.z]);
    return valider(C, final, cible, plan, t, aspect) ? final : cam;
  }
  function camera(C, plan, poses, co, t) {
    if (!C || !plan || !VUES.includes(plan.vue)) return null;
    const p = poses[plan.sujet]; if (!p) return null;
    const cible = C.cible, pos = C.position, u = lisse((t - plan.debut) / Math.max(1, plan.fin - plan.debut));
    const cote = plan.cote || 1, ancre = plan.ancre;
    let fov = 42, marge = .15;
    if (NATURE.has(plan.vue)) {
      if (!disponible(C, ancre, t)) return null;
      for (let j = 0; j < 3; j++) cible[j] = ancre.cible[j];
      const trajets = C.trajets.get(ancre), trajet = trajets?.[cote < 0 ? 0 : 1] || trajets?.find(Boolean);
      if (!trajet) return null;
      placer(ancre, trajet, u, pos);
      fov = plan.vue === 'panorama' ? 48 - 3 * u : 52 - 2 * u;
      marge = ancre.margeSujet || .15;
    } else {
      // Le vrai groupe autour du sujet, avec un cadrage large adapté à son étendue, jamais des voitures déplacées.
      let n = 0, x = 0, y = 0, z = 0, rayon = 9;
      // Entrée/sortie du groupe progressive : le passage d'un rival à 65 m ne déplace plus le barycentre.
      const poids = q => q ? 1 - lisse((Math.hypot(q.x - p.x, q.z - p.z) - 35) / 55) : 0;
      for (const q of poses) { const w = poids(q); if (w > 0) { x += q.x * w; y += q.y * w; z += q.z * w; n += w; } }
      cible[0] = n ? x / n : p.x; cible[1] = (n ? y / n : p.y) + .7; cible[2] = n ? z / n : p.z;
      for (const q of poses) { const w = poids(q); if (w > 0) rayon = Math.max(rayon, Math.hypot(q.x - cible[0], q.z - cible[2]) * w); }
      const a = p.cap + cote * (.24 + .08 * u), recul = Math.max(24, rayon * 1.25);
      pos[0] = cible[0] - Math.cos(a) * recul; pos[2] = cible[2] - Math.sin(a) * recul; pos[1] = cible[1] + Math.max(12, rayon * .45);
      fov = 50;
    }
    if (!libre(C, pos, cible, marge)) return null;
    const cam = viser(pos, cible, fov, NATURE.has(plan.vue));
    C.poseVue.x = cam.pos[0]; C.poseVue.y = cam.pos[1]; C.poseVue.z = cam.pos[2];
    return cam;
  }
  B.cinema = { VUES, NATURE, preparer, regler, choisir, disponible, camera, libre, viser, valider, poursuite, souffle, secours };
})(globalThis.BITUME = globalThis.BITUME || {});
