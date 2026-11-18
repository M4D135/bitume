// Référence du test verifications/herbier-identite.test.mjs : creerHerbier de src/decor.js tel qu'il était avant
// le lot 28A, copié sans aucune retouche (commit e3f3ef1, lignes 430 à 585 ; sha256 de ce decor.js :
// c98ba69de1da3bed4cc4a5f9dddb150532e6c26fdad472c1df37d4ceb5a73c1e). Ne pas modifier : c'est l'« avant ».
'use strict';
module.exports = function (B) {
  // Surface réellement disponible pour les plantes et la petite faune. Les polygones sont découpés
  // une fois à la préparation : aucune recherche de sol, collision ou racine par image.
  function creerHerbier(c, nappes, lots, lim, enceinte, niveauEau) {
    const EPS = 1e-7, MAILLE = 32;
    const aire2 = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[2] - b[0] * a[2]; }, 0);
    const orienter = p => aire2(p) < 0 ? p.slice().reverse() : p;
    const boite = p => ({ x0: Math.min(...p.map(v => v[0])), x1: Math.max(...p.map(v => v[0])), z0: Math.min(...p.map(v => v[2])), z1: Math.max(...p.map(v => v[2])) });
    const recouvre = (a, b) => a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS;
    function couper(p, distance, positif = true) {
      if (p.length < 3) return [];
      const sortie = []; let a = p[p.length - 1], da = distance(a) * (positif ? 1 : -1);
      for (const b of p) {
        const db = distance(b) * (positif ? 1 : -1), dedansA = da >= -EPS, dedansB = db >= -EPS;
        if (dedansA !== dedansB) {
          const t = da / (da - db);
          sortie.push(a.map((v, k) => v + (b[k] - v) * t));
        }
        if (dedansB) sortie.push(b);
        a = b; da = db;
      }
      return sortie;
    }
    function retirer(p, masque) {
      // Une boîte commune ne prouve pas un recouvrement (notamment les deux moitiés d'une case de sol).
      // Sans ce test, les prolongements des arêtes créeraient beaucoup de fragments inutiles.
      let intersection = p;
      for (let i = 0; i < masque.length && intersection.length >= 3; i++) {
        const a = masque[i], b = masque[(i + 1) % masque.length];
        intersection = couper(intersection, v => (b[0] - a[0]) * (v[2] - a[2]) - (b[2] - a[2]) * (v[0] - a[0]));
      }
      if (intersection.length < 3 || Math.abs(aire2(intersection)) < .002) return [p];
      if (Math.abs(aire2(intersection)) >= Math.abs(aire2(p)) - .002) return [];
      const dehors = []; let dedans = p;
      for (let i = 0; i < masque.length && dedans.length >= 3; i++) {
        const a = masque[i], b = masque[(i + 1) % masque.length];
        const distance = v => (b[0] - a[0]) * (v[2] - a[2]) - (b[2] - a[2]) * (v[0] - a[0]);
        const morceau = couper(dedans, distance, false);
        if (morceau.length >= 3 && Math.abs(aire2(morceau)) > .002) dehors.push(morceau);
        dedans = couper(dedans, distance, true);
      }
      return dehors;
    }
    function indexer(liste) {
      const grille = new Map();
      for (let k = 0; k < liste.length; k++) {
        const b = liste[k].boite;
        for (let x = Math.floor(b.x0 / MAILLE); x <= Math.floor(b.x1 / MAILLE); x++) for (let z = Math.floor(b.z0 / MAILLE); z <= Math.floor(b.z1 / MAILLE); z++) {
          const cle = x + ',' + z, ids = grille.get(cle);
          if (ids) ids.push(k); else grille.set(cle, [k]);
        }
      }
      const marques = new Uint32Array(liste.length); let tour = 0;
      return b => {
        const ids = []; tour++;
        for (let x = Math.floor(b.x0 / MAILLE); x <= Math.floor(b.x1 / MAILLE); x++) for (let z = Math.floor(b.z0 / MAILLE); z <= Math.floor(b.z1 / MAILLE); z++) {
          for (const id of grille.get(x + ',' + z) || []) if (marques[id] !== tour) { marques[id] = tour; ids.push(id); }
        }
        return ids;
      };
    }
    function plan(p) {
      const [a, b, d] = p, ax = b[0] - a[0], az = b[2] - a[2], bx = d[0] - a[0], bz = d[2] - a[2];
      const det = ax * bz - az * bx;
      if (Math.abs(det) < .00001) return null;
      const ay = b[1] - a[1], by = d[1] - a[1], dx = (ay * bz - by * az) / det, dz = (ax * by - bx * ay) / det;
      const len = Math.hypot(dx, 1, dz);
      return { dx, dz, h: a[1] - dx * a[0] - dz * a[2], normal: [-dx / len, 1 / len, -dz / len], len };
    }
    const brutes = [], couches = [];
    for (const nap of nappes) {
      const herbe = new Set(nap.herbeTriangles || []);
      for (let offset = 0; offset < nap.indices.length; offset += 3) {
        const ids = [nap.indices[offset], nap.indices[offset + 1], nap.indices[offset + 2]].map(i => i * 13);
        const points = orienter(ids.map(i => Array.from(nap.sommets.slice(i, i + 3)))), pl = plan(points);
        if (!pl) continue;
        const vegetalisable = herbe.has(offset) && pl.normal[1] >= .62;
        const color = vegetalisable ? [0, 1, 2].map(k => ids.reduce((s, id) => s + nap.sommets[id + 10 + k] / 3, 0)) : null;
        const surface = { id: couches.length, points, plan: pl, color, type: nap.surfaceType, boite: boite(points), vegetalisable };
        couches.push(surface); if (vegetalisable) brutes.push(surface);
      }
    }
    const masques = [];
    const masquer = points => { points = orienter(points); masques.push({ points, boite: boite(points) }); };
    const w = c.largeur / 2;
    for (let i = 0; i < c.n; i++) {
      const j = (i + 1) % c.n, s = B.circuit.ecart(c, 0, i * c.pas);
      const tunnel = B.circuit.dansTunnel && B.circuit.dansTunnel(c, i * c.pas, 25);
      const paddock = s > enceinte.debut - 20 && s < enceinte.fin + 20;
      const gauche = tunnel ? Math.max(lim.G[i], lim.G[j]) + 32 : w + 1.24;
      const droite = tunnel ? Math.max(lim.D[i], lim.D[j]) + 32 : paddock ? w + 28 : w + 1.24;
      const p = (k, d) => [c.x[k] - Math.sin(c.cap[k]) * d, 0, c.z[k] + Math.cos(c.cap[k]) * d];
      masquer([p(i, -gauche), p(i, droite), p(j, droite), p(j, -gauche)]);
    }
    // Les troncs, bâtiments, rochers et gradins ne changent pas ; seule leur empreinte retire des plantes.
    for (const lot of lots) for (const o of lot.objets) {
      const m = Math.floor((o.mat || 0) + .01);
      if (!(o.collision && o.collision !== 'poutre') && m !== 9 && m !== 23 && m !== 13) continue;
      const a = -(o.r ? o.r[1] : 0), co = Math.cos(a), si = Math.sin(a);
      const hx = o.s[0] / 2 + .10, hz = o.s[2] / 2 + .10;
      const points = [];
      if (o.shape === 'cylinder' || o.shape === 'sphere' || o.shape === 'octa') {
        for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; points.push([o.p[0] + Math.cos(t) * hx * 1.08, 0, o.p[2] + Math.sin(t) * hz * 1.08]); }
      } else for (const [x, z] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) points.push([o.p[0] + co * x - si * z, 0, o.p[2] + si * x + co * z]);
      masquer(points);
    }
    const chercherMasques = indexer(masques), chercherBrutes = indexer(couches), triangles = [];
    let aireBrute = 0, aireAccotements = 0, aireTerrain = 0;
    for (let id = 0; id < brutes.length; id++) {
      const source = brutes[id];
      aireBrute += Math.abs(aire2(source.points)) / 2 * source.plan.len;
      const terre = Number.isFinite(niveauEau) ? couper(source.points, p => p[1] - niveauEau - .08) : source.points;
      let morceaux = terre.length >= 3 ? [terre] : [];
      for (const k of chercherMasques(source.boite)) {
        if (!morceaux.length) break;
        const masque = masques[k];
        if (!recouvre(source.boite, masque.boite)) continue;
        morceaux = morceaux.flatMap(p => retirer(p, masque.points));
      }
      // Quand l'accotement recouvre le terrain, garder uniquement le triangle réellement visible.
      // La différence entre deux plans est linéaire : son découpage ne crée ni trou ni racine flottante.
      for (const k of chercherBrutes(source.boite)) {
        if (!morceaux.length) break;
        if (k === source.id) continue;
        const autre = couches[k]; if (!recouvre(source.boite, autre.boite)) continue;
        const dh = autre.plan.h - source.plan.h, dx = autre.plan.dx - source.plan.dx, dz = autre.plan.dz - source.plan.dz;
        if (autre.vegetalisable && Math.abs(dx) + Math.abs(dz) < 1e-8 && Math.abs(dh) < .0005 && k > source.id) continue;
        const auDessus = p => dh + dx * p[0] + dz * p[2] - (autre.vegetalisable ? .0005 : -.0005);
        const masque = couper(autre.points, auDessus);
        if (masque.length >= 3 && Math.abs(aire2(masque)) > .002) morceaux = morceaux.flatMap(p => retirer(p, masque));
      }
      for (const p of morceaux) for (let k = 1; k < p.length - 1; k++) {
        const points = [p[0], p[k], p[k + 1]], aire = Math.abs(aire2(points)) / 2 * source.plan.len;
        if (aire < .02) continue;
        const tri = { points, normal: source.plan.normal, color: source.color, type: source.type, aire, plan: source.plan, boite: boite(points) };
        triangles.push(tri);
        if (source.type === 'accotement') aireAccotements += aire; else aireTerrain += aire;
      }
    }
    const chercher = indexer(triangles);
    function surface(x, z, sortie = {}) {
      const b = { x0: x, x1: x, z0: z, z1: z }; let meilleur = null, hauteur = -Infinity;
      for (const k of chercher(b)) {
        const t = triangles[k], [a, b, c] = t.points;
        const abx = b[0] - a[0], abz = b[2] - a[2], acx = c[0] - a[0], acz = c[2] - a[2], det = abx * acz - abz * acx;
        const u = ((x - a[0]) * acz - (z - a[2]) * acx) / det, v = (abx * (z - a[2]) - abz * (x - a[0])) / det;
        if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
        const y = t.plan.h + t.plan.dx * x + t.plan.dz * z;
        if (y > hauteur) { hauteur = y; meilleur = t; }
      }
      if (!meilleur) return null;
      sortie.y = hauteur; sortie.normal = meilleur.normal; sortie.color = meilleur.color; sortie.type = meilleur.type;
      return sortie;
    }
    return { triangles, surface, aireBrute, aire: aireAccotements + aireTerrain, aireAccotements, aireTerrain,
      trianglesSources: brutes.length, masques: masques.length };
  }
  return creerHerbier;
};
