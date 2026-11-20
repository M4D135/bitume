/* BITUME — cadrages originaux des démos, préparés dans le décor réellement construit.
   Lecture seule : ni voiture, ni animal, ni horloge, ni tirage de simulation ne sont modifiés. */
(function (B) {
  'use strict';
  const VUES = Object.freeze(['panorama', 'flore', 'faune', 'pilote', 'peloton']);
  const NATURE = new Set(['panorama', 'flore', 'faune']), CACHE = new WeakMap();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lisse = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const BAS = Object.freeze([0, -1, 0]), PAS_TRAJET = 24;
  const fini = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
  function plusProche(c, x, z) {
    let d = Infinity, k = 0;
    for (let i = 0; i < c.n; i += 4) { const q = (c.x[i] - x) ** 2 + (c.z[i] - z) ** 2; if (q < d) { d = q; k = i; } }
    return k * c.pas;
  }
  function statiques(c, decor) {
    const cached = CACHE.get(decor); if (cached) return cached;
    const panorama = [], flore = [], candidats = [], cellules = new Set();
    let maxY = -Infinity, minY = Infinity;
    for (const n of decor.nappes || []) for (let k = 1; k < n.sommets.length; k += 13) {
      maxY = Math.max(maxY, n.sommets[k]); minY = Math.min(minY, n.sommets[k]);
    }
    if (!Number.isFinite(maxY)) { maxY = 300; minY = -100; }
    // Huit fenêtres du tracé : relief et courbes différents, sans inventer un lieu absent du décor.
    for (let secteur = 0; secteur < 8; secteur++) {
      let meilleur = null;
      for (let j = 0; j < 6; j++) {
        const s = (secteur + (j + .5) / 6) * c.longueur / 8;
        if (B.circuit.dansTunnel(c, s, 90)) continue;
        const q = B.circuit.echantillon(c, s), score = q.y + Math.abs(q.courbure) * 1800 + Math.abs(q.pente || 0) * 180;
        if (!meilleur || score > meilleur.score) meilleur = { type: 'panorama', s, cap: q.cap, cible: [q.x, q.y + 2, q.z], rayon: 105, hauteur: 48, label: 'Relief et tracé', score };
      }
      if (meilleur) panorama.push(meilleur);
    }
    // Les objets sont ceux des lots de dessin, pas une densité théorique du biome.
    const vus = new Set();
    for (const lot of (decor.lotsHerbier || []).concat(decor.lots || [])) for (const o of lot.objets || []) {
      if (vus.has(o)) continue; vus.add(o);
      const forme = String(o.shape || ''), arbre = o.collision === 'tronc';
      if (!arbre && !/fleur|fougere|fougère|taillis/.test(forme)) continue;
      if (!fini(o.p) || !fini(o.s)) continue;
      const taille = Math.max(.2, o.s[1]), priorite = /fleur/.test(forme) ? 4 : /fougere|fougère/.test(forme) ? 3 : arbre ? 1 : 2;
      candidats.push({ o, arbre, taille, priorite });
    }
    candidats.sort((a, b) => b.priorite - a.priorite || b.taille - a.taille);
    for (const v of candidats) {
      const { o, arbre, taille } = v, cle = Math.floor(o.p[0] / 120) + ':' + Math.floor(o.p[2] / 120);
      if (cellules.has(cle)) continue;
      const s = plusProche(c, o.p[0], o.p[2]); if (B.circuit.dansTunnel(c, s, 80)) continue;
      cellules.add(cle);
      flore.push({ type: 'flore', s, cap: B.circuit.echantillon(c, s).cap, cible: [o.p[0], o.p[1] + taille * (arbre ? .22 : .15), o.p[2]],
        rayon: arbre ? Math.max(20, taille * 1.6) : Math.max(5.5, taille * 4), hauteur: arbre ? Math.max(5, taille * .45) : 1.8,
        margeSujet: arbre ? Math.max(o.s[0], o.s[2]) * .7 : .15, objet: o,
        label: /fleur/.test(String(o.shape)) ? 'Fleurs des abords' : arbre ? 'Sous les arbres' : 'Végétation des abords' });
      if (flore.length === 12) break;
    }
    const data = { panorama, flore, maxY, minY }; CACHE.set(decor, data); return data;
  }
  function preparer(c, decor, animaux, monde) {
    const base = statiques(c, decor), faune = [];
    if (animaux && B.animaux) {
      for (const g of animaux.groupes) if (g.n > 0) faune.push({ type: 'faune', famille: 'sol', indice: g.debut, groupe: g,
        s: plusProche(c, g.hx, g.hz), cap: B.circuit.echantillon(c, plusProche(c, g.hx, g.hz)).cap,
        rayon: Math.max(22, g.hr * 1.8), hauteur: 4, label: g.e.nom, taille: g.md.rig?.hauteur || g.md.hauteur || 1 });
      // Les planeurs et côtiers ont une pose analytique sans mutation ; les migrateurs ont un cache de passage.
      for (const g of animaux.volants) if (g.n > 0 && (g.famille === 'plane' || g.famille === 'cotier'))
        faune.push({ type: 'faune', famille: 'vol', indice: 0, groupe: g, s: plusProche(c, g.cx, g.cz), cap: .7,
          rayon: 28, hauteur: 3, label: g.e.nom, taille: g.md.envergure || 2 });
    }
    const C = { c, decor, animaux, monde, ancres: { panorama: base.panorama, flore: base.flore, faune }, maxY: base.maxY, minY: base.minY,
      options: { faune: 'off', nuit: 0, pluie: 0 }, animal: {}, poseVue: { x: 0, y: 0, z: 0 },
      rayon: [0, 0, 0], origine: [0, 0, 0], cible: [0, 0, 0], position: [0, 0, 0], appui: [0, 0, 0], hit: {}, solHit: {}, requetes: 0,
      trajets: new WeakMap(), plans: new WeakMap() };
    // Les panoramas et les travellings de végétation sont contrôlés pour tout le plan pendant le chargement.
    // Aucun tronc qui entre ou sort d'un rayon ne change ensuite la distance de prise de vue.
    for (const a of base.panorama.concat(base.flore)) C.trajets.set(a, [preparerTrajet(C, a, -1), preparerTrajet(C, a, 1)]);
    return C;
  }
  function regler(C, options) { if (C) Object.assign(C.options, options); return C; }
  function animal(C, a, t, out) {
    const A = B.animaux, q = C.options.faune;
    // Légère réserve des silhouettes lointaines : aucun gros plan ne force leur détail ou leur présence.
    if (!A || !C.animaux || (q !== 'medium' && q !== 'high' && q !== 'ultra')) return false;
    if (a.famille === 'sol') {
      const p = A.poseAnimal(C.animaux, a.indice, t, C.animal);
      if (!p || p.enfoui > .43) return false;
      out[0] = p.x; out[1] = p.y + a.taille * p.echelle * .52; out[2] = p.z;
    } else {
      const g = a.groupe, nuit = C.options.nuit || 0, pluie = C.options.pluie || 0;
      if (g.famille === 'plane' && (nuit >= .6 || pluie >= .55) || g.famille === 'cotier' && (nuit >= .7 || g.e.cle === 'pelican' && nuit >= .5)) return false;
      if (!A.poseVolant(C.animaux, g, a.indice, t, C.animal)) return false;
      out[0] = C.animal.x; out[1] = C.animal.y; out[2] = C.animal.z;
    }
    return out.every(Number.isFinite);
  }
  function disponible(C, a, t) {
    return !!C && !!a && (a.type === 'faune' ? animal(C, a, t, C.cible) : !!C.trajets.get(a)?.some(Boolean));
  }
  function choisir(C, type, numero, t) {
    const liste = C?.ancres[type]; if (!liste?.length) return null;
    for (let i = 0; i < liste.length; i++) { const a = liste[(numero + i) % liste.length]; if (disponible(C, a, t)) return a; }
    return null;
  }
  function sol(C, x, z, y) {
    if (C.monde?.raycast) {
      const top = Math.max(C.maxY + 20, y + 30), from = C.origine; from[0] = x; from[1] = top; from[2] = z;
      C.requetes++;
      const h = C.monde.raycast(from, BAS, top - C.minY + 100, { mask: 1, staticOnly: true }, C.solHit);
      if (h.hit) return h.y;
    }
    const h = C.animaux && B.animaux ? B.animaux.solExact(C.animaux.G.T, x, z) : C.decor.sol?.(x, z);
    return Number.isFinite(h) ? h : y - 1;
  }
  // Contrôle seulement : un obstacle provoque une vraie coupe du montage, jamais un déplacement instantané
  // dans le même plan. Le rayon dépasse légèrement la caméra pour réserver son plan proche.
  function libre(C, pos, cible, margeSujet = .15) {
    if (!fini(pos) || !fini(cible) || pos[1] < sol(C, pos[0], pos[2], pos[1]) + .38) return false;
    return segmentLibre(C, pos, cible, margeSujet);
  }
  function segmentLibre(C, pos, cible, margeSujet) {
    if (!C.monde?.raycast) return true;
    const dir = C.rayon, origin = C.origine;
    for (let j = 0; j < 3; j++) dir[j] = pos[j] - cible[j];
    const d = Math.hypot(...dir); if (d < Math.max(.7, margeSujet + .4)) return false;
    for (let j = 0; j < 3; j++) { dir[j] /= d; origin[j] = cible[j] + dir[j] * margeSujet; }
    C.requetes++;
    const h = C.monde.raycast(origin, dir, d - margeSujet + .25, { mask: 3, staticOnly: true }, C.hit);
    return !h.hit;
  }
  function appuiVisible(C, a, pos) {
    // Voir le corps au-dessus d'une crête ne suffit pas : le pli de terrain peut cacher les pattes et
    // faire paraître la bête suspendue. Garder visible un petit morceau du vrai sol sous ses appuis.
    // Les oiseaux momentanément en vol n'ont naturellement pas d'appui à montrer.
    if (a.famille !== 'sol' || C.animal.vol || !C.animaux) return true;
    const p = C.animal, cible = C.appui, T = C.animaux.G.T;
    const r = Math.max(.25, Math.min(.7, a.taille * p.echelle * .4));
    for (let k = 0; k < 5; k++) {
      const dx = k === 1 ? r : k === 2 ? -r : 0, dz = k === 3 ? r : k === 4 ? -r : 0;
      cible[0] = p.x + dx; cible[2] = p.z + dz;
      cible[1] = B.animaux.solExact(T, cible[0], cible[2]) + .08;
      if (!segmentLibre(C, pos, cible, .02)) return false;
    }
    return true;
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
      if (elevation > (a.type === 'panorama' ? 80 : 5)) continue;
      trajet.elevation = elevation;
      let valide = true;
      for (let k = 0; k <= PAS_TRAJET; k++) if (!libre(C, placer(a, trajet, k / PAS_TRAJET, p), a.cible, marge)) { valide = false; break; }
      if (valide) return trajet;
    }
    return null;
  }
  function posteAnimal(C, a, cible, cote) {
    // Un poste fixe suit du regard l'animal vivant : le panoramique reste fluide et la caméra ne traverse
    // pas le décor en poursuivant un oiseau ou une bête en fuite. Sa disparition termine le plan.
    const p = [0, 0, 0];
    for (const offset of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const angle = a.cap + cote * 1.05 + offset;
      p[0] = cible[0] - Math.cos(angle) * a.rayon; p[2] = cible[2] - Math.sin(angle) * a.rayon;
      p[1] = Math.max(cible[1] + a.hauteur, sol(C, p[0], p[2], cible[1] + a.hauteur) + 1);
      if (libre(C, p, cible) && appuiVisible(C, a, p)) return p.slice();
    }
    return null;
  }
  function viser(pos, cible, fov, nature = false) {
    const dx = cible[0] - pos[0], dy = cible[1] - pos[1], dz = cible[2] - pos[2], d = Math.hypot(dx, dy, dz) || 1;
    return { pos: pos.slice(), cible: cible.slice(), yaw: Math.atan2(dx, -dz), pitch: Math.asin(clamp(dy / d, -1, 1)), roll: 0,
      fov: clamp(fov, 26, 64), near: .08, far: 6000, sujetNature: nature };
  }
  function camera(C, plan, poses, co, t) {
    if (!C || !plan || !VUES.includes(plan.vue)) return null;
    const p = poses[plan.sujet]; if (!p) return null;
    const cible = C.cible, pos = C.position, u = lisse((t - plan.debut) / Math.max(1, plan.fin - plan.debut));
    const cote = plan.cote || 1, ancre = plan.ancre;
    let fov = 42, marge = .15;
    if (NATURE.has(plan.vue)) {
      if (!disponible(C, ancre, t)) return null;
      if (ancre.type !== 'faune') for (let j = 0; j < 3; j++) cible[j] = ancre.cible[j];
      if (ancre.type === 'faune') {
        if (!C.plans.has(plan)) C.plans.set(plan, posteAnimal(C, ancre, cible, cote));
        const poste = C.plans.get(plan); if (!poste) return null;
        for (let j = 0; j < 3; j++) pos[j] = poste[j];
        if (Math.hypot(pos[0] - cible[0], pos[1] - cible[1], pos[2] - cible[2]) < 4) return null;
      } else {
        const trajets = C.trajets.get(ancre), trajet = trajets?.[cote < 0 ? 0 : 1] || trajets?.find(Boolean);
        if (!trajet) return null;
        placer(ancre, trajet, u, pos);
      }
      fov = plan.vue === 'panorama' ? 48 - 3 * u : plan.vue === 'flore' ? 42 : 34;
      marge = ancre.margeSujet || .15;
    } else if (plan.vue === 'pilote') {
      const M = B.voiture?.attitude(p.cap, p.tangage || 0, p.roulis || 0);
      const pt = (x, y, z, out) => {
        if (M) { const v = B.voiture.mul(M, [x, y, z]); out[0] = p.x + v[0]; out[1] = p.y + v[1]; out[2] = p.z + v[2]; }
        else { out[0] = p.x + Math.cos(p.cap) * x - Math.sin(p.cap) * z; out[1] = p.y + y; out[2] = p.z + Math.sin(p.cap) * x + Math.cos(p.cap) * z; }
      };
      pt(.8 - u * .35, 1.12, cote * 1.75, pos); pt(.12, .76, 0, cible); fov = 50;
    } else {
      // Le vrai groupe autour du sujet, avec un cadrage large adapté à son étendue, jamais des voitures déplacées.
      let n = 0, x = 0, y = 0, z = 0, rayon = 9;
      // Entrée/sortie du groupe progressive : le passage d'un rival à 65 m ne déplace plus le barycentre.
      const poids = q => q ? 1 - lisse((Math.hypot(q.x - p.x, q.z - p.z) - 35) / 55) : 0;
      for (const q of poses) { const w = poids(q); if (w > 0) { x += q.x * w; y += q.y * w; z += q.z * w; n += w; } }
      cible[0] = n ? x / n : p.x; cible[1] = (n ? y / n : p.y) + .7; cible[2] = n ? z / n : p.z;
      for (const q of poses) { const w = poids(q); if (w > 0) rayon = Math.max(rayon, Math.hypot(q.x - cible[0], q.z - cible[2]) * w); }
      const a = p.cap + cote * (.24 + .08 * u), recul = Math.max(36, rayon * 1.5);
      pos[0] = cible[0] - Math.cos(a) * recul; pos[2] = cible[2] - Math.sin(a) * recul; pos[1] = cible[1] + Math.max(22, rayon * .8);
      fov = 52;
    }
    if (!libre(C, pos, cible, marge) || ancre?.type === 'faune' && !appuiVisible(C, ancre, pos)) return null;
    const cam = viser(pos, cible, fov, NATURE.has(plan.vue));
    C.poseVue.x = cam.pos[0]; C.poseVue.y = cam.pos[1]; C.poseVue.z = cam.pos[2];
    return cam;
  }
  B.cinema = { VUES, NATURE, preparer, regler, choisir, disponible, camera, libre, viser };
})(globalThis.BITUME = globalThis.BITUME || {});
