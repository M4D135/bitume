// Oracle d'inspection, hors jeu livré. Seuils fixés avant les captures du correctif.
export const SEUILS_COCKPIT = Object.freeze({ routeCadreeMin: .90, routeOcculteeMax: .05,
  routeCentraleOcculteeMax: 0, largeurGlaceMax: .18, erreurDomMaxPx: 2, recouvrementMaxPx2: 1 });
export const DISTANCES_ROUTE = Object.freeze([12, 20, 35, 55]);
export const BANDES_ROUTE = Object.freeze([-.5, -.25, 0, .25, .5]);

// Cette fonction pure est sérialisée telle quelle dans la page et testée avec des scènes négatives.
// Les triangles sont ceux de la voiture envoyés au vrai draw ; aucune boîte englobante ne remplace sa peau.
export function mesurerLisibiliteCockpit(d, seuils) {
  const erreurs = [], finie = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
  const cam = d.camera, v = d.viewport, triangles = d.triangles || [];
  if (!finie(cam?.pos) || ![cam?.yaw, cam?.pitch, cam?.roll, cam?.fov, cam?.near, v?.x, v?.y, v?.width, v?.height].every(Number.isFinite) ||
      !(cam.near > 0 && cam.fov > 0 && cam.fov < 180 && v.width > 0 && v.height > 0)) return { erreurs: ['Caméra ou viewport invalide'] };
  if (!triangles.length || triangles.some(t => t.points?.length !== 3 || !t.points.every(finie))) return { erreurs: ['Triangles opaques réels absents ou invalides'] };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
  const r = [cy, 0, sy], u = [-sy * sp, cp, cy * sp], avant = [sy * cp, sp, -cy * cp];
  const droite = r.map((x, i) => x * cr + u[i] * sr), haut = u.map((x, i) => x * cr - r[i] * sr), tan = Math.tan(cam.fov * Math.PI / 360);
  const profondeur = p => dot(sub(p, cam.pos), avant);
  const projeter = p => { const q = sub(p, cam.pos), z = dot(q, avant); return [v.x + (1 + dot(q, droite) / (z * tan * v.width / v.height)) * v.width / 2,
    v.y + (1 - dot(q, haut) / (z * tan)) * v.height / 2, z]; };
  const dansVue = p => p[2] >= cam.near && p[0] >= v.x && p[0] <= v.x + v.width && p[1] >= v.y && p[1] <= v.y + v.height;
  const aireSignee = poly => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const cote = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const dansPoly = (p, poly) => { const signe = Math.sign(aireSignee(poly)); return !!signe && poly.every((a, i) => signe * cote(p, a, poly[(i + 1) % poly.length]) >= -1e-7); };
  const intersection = (sujet, coupe) => {
    let poly = sujet; const signe = Math.sign(aireSignee(coupe));
    for (let i = 0; i < coupe.length && poly.length; i++) {
      const a = coupe[i], b = coupe[(i + 1) % coupe.length], avantPoly = poly; poly = [];
      let p = avantPoly.at(-1), dp = signe * cote(p, a, b);
      for (const q of avantPoly) { const dq = signe * cote(q, a, b);
        if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); poly.push(p.map((x, k) => x + t * (q[k] - x))); }
        if (dq >= 0) poly.push(q); p = q; dp = dq;
      }
    }
    return poly;
  };
  const visibles = triangles.filter(t => dot(cross(sub(t.points[1], t.points[0]), sub(t.points[2], t.points[0])), sub(cam.pos, t.points[0])) > 1e-12);
  const polygone = t => {
    const points = []; let a = t.points.at(-1), za = profondeur(a) - cam.near;
    for (const b of t.points) { const zb = profondeur(b) - cam.near;
      if ((za >= 0) !== (zb >= 0)) { const f = za / (za - zb); points.push(a.map((x, k) => x + f * (b[k] - x))); }
      if (zb >= 0) points.push(b); a = b; za = zb;
    }
    return points.map(projeter);
  };
  const objets = visibles.filter(t => /^(volant|gant-[01])$/.test(t.role)).map(t => ({ role: t.role, poly: polygone(t) })).filter(t => t.poly.length >= 3);
  for (const role of ['volant', 'gant-0', 'gant-1']) if (!objets.some(t => t.role === role)) erreurs.push('Surface réelle absente : ' + role);
  const glaces = (d.glaces || []).map(g => {
    if (g.monde?.length !== 4 || !g.monde.every(finie) || g.dom?.length !== 4 || !g.dom.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) {
      erreurs.push('Quadrilatère de glace invalide : ' + g.id); return { id: g.id, valide: false };
    }
    const monde = g.monde.map(projeter), dom = g.dom;
    const erreurDomPx = Math.max(...monde.map((p, i) => Math.hypot(p[0] - dom[i][0], p[1] - dom[i][1])));
    const largeur = (Math.max(...dom.map(p => p[0])) - Math.min(...dom.map(p => p[0]))) / v.width;
    const recouvrements = objets.map(t => ({ role: t.role, airePx2: Math.abs(aireSignee(intersection(t.poly, dom))) })).filter(t => t.airePx2 > 1e-7);
    // Somme conservatrice : les triangles d'un même objet peuvent se chevaucher. Un total <=1 px² est sûr.
    const recouvrementPx2 = recouvrements.reduce((s, t) => s + t.airePx2, 0);
    const cadree = monde.every(dansVue) && dom.every(p => dansVue([...p, cam.near]));
    if (g.visible !== true || !cadree || Math.abs(aireSignee(dom)) < 4) erreurs.push('Glace absente, tronquée ou dégénérée : ' + g.id);
    if (erreurDomPx > seuils.erreurDomMaxPx) erreurs.push('Glace DOM désolidarisée du boîtier : ' + g.id);
    if (largeur > seuils.largeurGlaceMax) erreurs.push('Glace trop large : ' + g.id);
    if (recouvrementPx2 > seuils.recouvrementMaxPx2) erreurs.push('Glace superposée au volant/gant : ' + g.id);
    return { id: g.id, valide: true, monde, dom, cadree, largeur, erreurDomPx, recouvrementPx2,
      recouvrements: ['volant', 'gant-0', 'gant-1'].map(role => ({ role, airePx2: recouvrements.filter(t => t.role === role).reduce((s, t) => s + t.airePx2, 0) })) };
  });
  if (glaces.length !== 2 || new Set(glaces.map(g => g.id)).size !== 2) erreurs.push('Deux glaces distinctes requises');
  const coupeRayon = (cible, t) => {
    const direction = sub(cible, cam.pos), e1 = sub(t.points[1], t.points[0]), e2 = sub(t.points[2], t.points[0]);
    const h = cross(direction, e2), det = dot(e1, h);
    if (det <= 1e-12) return null; // le renderer élimine les faces arrière
    const s = sub(cam.pos, t.points[0]), u = dot(s, h) / det;
    if (u < 0 || u > 1) return null;
    const q = cross(s, e1), w = dot(direction, q) / det;
    if (w < 0 || u + w > 1) return null;
    const f = dot(e2, q) / det;
    return f > 0 && f < 1 && f * profondeur(cible) >= cam.near ? f : null;
  };
  const attendus = [12, 20, 35, 55].flatMap(distance => [-.5, -.25, 0, .25, .5].map(bande => distance + '/' + bande));
  if (d.route?.length !== 20 || d.route.some(p => !finie(p.point)) || new Set(d.route.map(p => p.distance + '/' + p.bande)).size !== 20 ||
      d.route.some(p => !attendus.includes(p.distance + '/' + p.bande))) return { erreurs: [...erreurs, 'Échantillons de chaussée incomplets'] };
  const route = d.route.map(p => {
    const ecran = projeter(p.point), cadree = dansVue(ecran); let touche = null, proche = 1;
    for (const t of visibles) { const f = coupeRayon(p.point, t); if (f !== null && f < proche) { touche = { role: t.role, shape: t.shape, distance: Math.hypot(...sub(p.point, cam.pos)) * f }; proche = f; } }
    const glaceDom = glaces.find(g => g.valide && dansPoly(ecran, g.dom))?.id || null;
    return { ...p, ecran, cadree, touche, glaceDom, occultee: !!touche || !!glaceDom };
  });
  const cadree = route.filter(p => p.cadree).length / route.length, occultee = route.filter(p => p.occultee).length / route.length;
  const centreOcculte = route.filter(p => p.bande === 0 && p.occultee).length / 4;
  if (cadree < seuils.routeCadreeMin || route.some(p => p.bande === 0 && !p.cadree)) erreurs.push('Chaussée utile hors champ');
  if (occultee > seuils.routeOcculteeMax || centreOcculte > seuils.routeCentraleOcculteeMax) erreurs.push('Chaussée utile occultée par le cockpit');
  return { erreurs, seuils, camera: cam, viewport: v, triangles: { opaques: triangles.length, facesAvant: visibles.length,
    commandes: Object.fromEntries(['volant', 'gant-0', 'gant-1'].map(role => [role, objets.filter(t => t.role === role).length])) },
    route: { cadree, occultee, centreOcculte, points: route }, glaces };
}

// Observation passive du draw original, nécessaire car J1/J2 réutilisent S.sortie et les objets du modèle.
// Seules les images demandées sont copiées ; aucun rendu, maillage ou pose n'est modifié.
export function installerObservationCockpit() {
  const J = BITUME_JEU, B = BITUME, S = J.session, F = __HABITACLE_CAPTURE;
  const geometre = FRender.shared.geometry(false), original = J.rendu.draw;
  F.releves = {}; F.relever = false;
  J.rendu.draw = function (camera, sortie, ...suite) {
    const resultat = original.call(this, camera, sortie, ...suite);
    if (!F.relever) return resultat;
    const locaux = S.locaux || [F.sujet];
    for (let joueur = 0; joueur < locaux.length; joueur++) {
      const id = locaux[joueur], E = S.modeles[id].objetsRendu, H = E?.habitacle || E?.pilote?.habitacle;
      if (!H?.jante?.objet || !sortie.includes(H.jante.objet)) continue;
      const roles = new Map([H.jante, H.branches, H.ruban, ...(H.moyeu || []), ...(H.caches || []), ...(H.vis || [])]
        .filter(Boolean).map(p => [p.objet, 'volant']));
      H.mains.forEach((m, h) => m.pieces.forEach(p => roles.set(p.objet, 'gant-' + h)));
      const propres = new Set((E.tables || []).flatMap(t => t?.objets || []));
      for (const t of E.pilote?.variantes || []) for (const p of t.pieces) propres.add(p.objet);
      for (const p of E.pilote?.cockpit?.pieces || []) propres.add(p.objet);
      // Les objets de H sont overlay, dans le draw de cette seule voiture ; les autres voitures ne le sont pas.
      const objets = sortie.filter(o => !o.fx && (o.overlay || propres.has(o))), triangles = [];
      for (const o of objets) {
        const range = geometre.ranges[o.shape]; if (!range) throw new Error('Géométrie absente : ' + o.shape);
        const M = B.voiture.euler(...o.r), points = new Map();
        const point = i => { if (points.has(i)) return points.get(i);
          const q = [0, 1, 2].map(k => geometre.vertices[i * 6 + k] * o.s[k]);
          const p = [0, 1, 2].map(k => o.p[k] + M[0][k] * q[0] + M[1][k] * q[1] + M[2][k] * q[2]); points.set(i, p); return p; };
        for (let n = range.offset / 4; n < range.offset / 4 + range.count; n += 3)
          triangles.push({ role: roles.get(o) || 'carrosserie', shape: o.shape, points: [0, 1, 2].map(k => point(geometre.indices[n + k])) });
      }
      const p = S.cour[id], e = S.course.voitures[id].etat;
      const glaces = B.voiture.glacesCockpit({ p: [p.x, p.y, p.z], cap: p.cap, tangage: p.tangage, roulis: p.roulis });
      const scene = document.getElementById('scene'), boite = scene.getBoundingClientRect();
      // J2 est rendu sur la même toile puis copié. La bordure décorative de scene2 ne change pas son frustum.
      const origine = joueur ? document.querySelector('.glaces2').getBoundingClientRect() : boite;
      F.releves[id] = { joueur: joueur + 1, sujet: id, vitesse: e.v, volant: e.volant,
        camera: { pos: Array.from(camera.pos), yaw: camera.yaw, pitch: camera.pitch, roll: camera.roll || 0, fov: camera.fov, near: camera.near || .1 },
        viewport: { x: origine.x, y: origine.y, width: scene.clientWidth, height: scene.clientHeight }, triangles,
        route: [12, 20, 35, 55].flatMap(distance => [-.5, -.25, 0, .25, .5].map(bande => ({ distance, bande,
          point: B.circuit.point(S.course.c, e.s + distance, bande * S.course.c.largeur / 2, .01) }))),
        glaces: glaces.map((g, k) => ({ id: 'glace-' + (k ? 'd' : 'g') + (joueur ? '2' : ''), monde: [1, 0, 3, 2].map(i => Array.from(g.coins[i])) })) };
    }
    return resultat;
  };
  return { methode: 'copie passive des triangles opaques transmis au draw original', joueurs: [...(S.locaux || [F.sujet])] };
}

export function observerLisibiliteCockpit(mesurer, seuils) {
  const F = __HABITACLE_CAPTURE; F.relever = false;
  return Object.values(F.releves).map(d => {
    for (const g of d.glaces) {
      const e = document.getElementById(g.id), s = getComputedStyle(e), M = new DOMMatrix(s.transform), parent = e.offsetParent.getBoundingClientRect();
      g.visible = !e.hidden && s.display !== 'none' && s.visibility !== 'hidden';
      g.dom = [[0, 0], [e.clientWidth, 0], [e.clientWidth, e.clientHeight], [0, e.clientHeight]].map(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(M); return [parent.x + e.offsetLeft + p.x / p.w, parent.y + e.offsetTop + p.y / p.w];
      });
    }
    return { joueur: d.joueur, sujet: d.sujet, vitesse: d.vitesse, volant: d.volant, ...mesurer(d, seuils) };
  });
}
