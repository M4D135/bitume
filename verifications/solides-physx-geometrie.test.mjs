// Contrat du monde physique : géométrie exacte, surfaces, orientation, couverture et libération.
// Le vrai moteur WASM est contrôlé séparément ; ce récepteur vérifie ce que l'hôte lui transmet.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
for (const f of ['circuit', 'route-des-cimes', 'carene', 'botanique', 'ecologie', 'saisons', 'vegetation', 'bords', 'decor', 'obstacles', 'solides-physx']) require('../src/' + f + '.js');
const B = globalThis.BITUME, S = B.solidesPhysX;
const catalogue = vm.runInNewContext(readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8').match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
let nombre = 0;
function verifier(nom, f) { f(); nombre++; console.log('ok  ' + nom); }
function monde() {
  return { next: 1, objets: new Map(), retires: [],
    addBox(pos, half, options) { const id = this.next++; this.objets.set(id, { pos, half, options }); return id; },
    addTriangleMesh(vertices, indices, options) { const id = this.next++; this.objets.set(id, { vertices, indices, options }); return id; },
    remove(id) { assert.ok(this.objets.has(id), 'acteur absent ou retiré deux fois'); this.objets.delete(id); this.retires.push(id); }
  };
}
function tourner(q, v) {
  const [x, y, z, w] = q, [a, b, c] = v, tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a);
  return [a + w * tx + y * tz - z * ty, b + w * ty + z * tx - x * tz, c + w * tz + x * ty - y * tx];
}
function tournerEuler(r, p) {
  const [x, y, z] = r || [0, 0, 0], [a, b, c] = p, b1 = Math.cos(x) * b - Math.sin(x) * c, c1 = Math.sin(x) * b + Math.cos(x) * c;
  const a2 = Math.cos(y) * a + Math.sin(y) * c1, c2 = -Math.sin(y) * a + Math.cos(y) * c1;
  return [Math.cos(z) * a2 - Math.sin(z) * b1, Math.sin(z) * a2 + Math.cos(z) * b1, c2];
}
const difference = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
function signatures(w) {
  return [...w.objets.values()].map(o => hash({ pos: o.pos, half: o.half, vertices: o.vertices && Array.from(o.vertices), indices: o.indices && Array.from(o.indices), options: o.options })).sort();
}

// Intersection verticale indépendante, sur les triangles effectivement transmis. Les boîtes de support sont
// triangulées par le test ; aucune lecture du profil analytique ne fabrique un contact manquant.
function rayonsSol(w) {
  const cellules = new Map(), taille = 32;
  function triangle(a, b, c, id, face) {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (ny <= 1e-10) return;
    const t = { a, b, c, id, face, nx, ny, nz };
    for (let x = Math.floor(Math.min(a[0], b[0], c[0]) / taille); x <= Math.floor(Math.max(a[0], b[0], c[0]) / taille); x++) {
      for (let z = Math.floor(Math.min(a[2], b[2], c[2]) / taille); z <= Math.floor(Math.max(a[2], b[2], c[2]) / taille); z++) {
        const cle = x + ',' + z, liste = cellules.get(cle) || []; if (!cellules.has(cle)) cellules.set(cle, liste); liste.push(t);
      }
    }
  }
  for (const [id, o] of w.objets) {
    if (o.options.queryGroup !== 1) continue;
    const pos = o.pos || o.options.pos, q = o.options.quaternion, mondePoint = p => tourner(q, p).map((v, i) => v + pos[i]);
    if (o.half) {
      for (let axe = 0; axe < 3; axe++) for (const signe of [-1, 1]) {
        const a = (axe + 1) % 3, b = (axe + 2) % 3;
        const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const p = [0, 0, 0]; p[axe] = signe * o.half[axe]; p[a] = u * o.half[a]; p[b] = v * o.half[b]; return mondePoint(p); });
        if (signe < 0) points.reverse(); triangle(points[0], points[1], points[2], id, -1); triangle(points[0], points[2], points[3], id, -1);
      }
    } else for (let j = 0; j < o.indices.length; j += 3) {
      const points = Array.from(o.indices.slice(j, j + 3), k => mondePoint(Array.from(o.vertices.slice(k * 3, k * 3 + 3))));
      triangle(...points, id, j / 3);
    }
  }
  return (x, z, plafond) => {
    let trouve = null;
    for (const t of cellules.get(Math.floor(x / taille) + ',' + Math.floor(z / taille)) || []) {
      const { a, b, c } = t, det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
      const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
      if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) continue;
      const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
      if (y <= plafond && (!trouve || y > trouve.y)) trouve = { ...t, y };
    }
    return trouve;
  };
}

const rapports = [];
for (const k of catalogue) {
  const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.nom, partition: k.partition }); B.bords.limites(c, B.bords.planifier(c));
  const options = { qualite: 'low', saison: 'ete', vegetation: false }, d = B.decor.construire(c, options);
  c.obstacles = B.obstacles.creer(d.obstacles);
  const avant = hash({ x: c.x, y: c.y, z: c.z, cap: c.cap, G: c.limiteG, D: c.limiteD, obstacles: d.obstacles });
  const w = monde(), m = S.installer(w, c, d), objets = (d.lotsHerbier || d.lots).flatMap(l => l.objets);
  verifier(k.nom + ' : chaque nappe transmet ses XYZ et triangles exacts, sans eau', () => {
    let triangles = 0;
    for (const [id, a] of m.acteurs) if (a.source === 'nappe') {
      const source = d.nappes[a.index], physique = w.objets.get(id);
      assert.equal(physique.vertices.length, source.sommets.length / 13 * 3);
      for (let i = 0; i < physique.vertices.length; i++) assert.equal(physique.vertices[i], source.sommets[Math.floor(i / 3) * 13 + i % 3]);
      assert.deepEqual(physique.indices, source.indices, 'aucune triangulation approchée');
      assert.equal(a.surfaces.length, physique.indices.length / 3);
      triangles += physique.indices.length / 3;
    }
    assert.equal(triangles, m.statistiques.trianglesSol);
    // Compter les triangles réellement dessinés avec la matière eau, y compris le nouveau lac du Baïkal.
    // La géométrie transmise plus haut reste contrôlée indépendamment pour chaque nappe solide.
    let trianglesEau = 0;
    for (const n of d.nappes) for (let t = 0; t < n.indices.length; t += 3) {
      if ([0, 1, 2].every(j => n.sommets[n.indices[t + j] * 13 + 9] === 12)) trianglesEau++;
    }
    assert.equal(m.statistiques.trianglesEauIgnores, trianglesEau);
    assert.equal(hash({ x: c.x, y: c.y, z: c.z, cap: c.cap, G: c.limiteG, D: c.limiteD, obstacles: d.obstacles }), avant);
  });
  verifier(k.nom + ' : tous les solides historiques et le mobilier marqué sont enregistrés une fois', () => {
    assert.equal(m.statistiques.obstaclesHistoriques, c.obstacles.objets.length);
    const marques = objets.filter(o => o.solidePhysX && !o.collision);
    assert.equal(m.statistiques.complements, marques.length);
    for (const [id, a] of m.acteurs) {
      const o = w.objets.get(id);
      assert.equal(o.options.type, 'static'); assert.equal(o.options.group, a.groupe);
      assert.equal(o.options.mask, 4 | 8); assert.equal(o.options.queryGroup, a.groupe);
      assert.ok(a.genre);
      if (a.source === 'primitive') {
        const source = marques[a.index];
        assert.equal(Object.getOwnPropertyDescriptor(source, 'solidePhysX').enumerable, false);
        assert.deepEqual(o.pos || o.options.pos, source.p);
        for (const axe of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) assert.ok(difference(tourner(o.options.quaternion, axe), tournerEuler(source.r, axe)) < 1e-10);
        if (source.shape === 'box') assert.deepEqual(o.half, source.s.map(v => v / 2));
      }
    }
    for (const genre of ['glissiere', 'poteau-glissiere', 'repere-virage']) assert.ok([...m.acteurs.values()].some(a => a.genre === genre));
    assert.ok(![...m.acteurs.values()].some(a => /^(eau|limite|mur-frenet)$/.test(a.genre)));
  });
  const rayon = rayonsSol(w);
  verifier(k.nom + ' : le sol reste présent sous la chaussée et les deux accotements', () => {
    const demi = c.largeur / 2;
    for (let i = 0; i < c.n; i += 17) for (const lateral of [-demi - 2, -demi + .4, 0, demi - .4, demi + 2]) {
      const q = B.circuit.echantillon(c, i * c.pas + .73), x = q.x - Math.sin(q.cap) * lateral, z = q.z + Math.cos(q.cap) * lateral;
      const attendu = q.y - Math.max(-demi, Math.min(demi, lateral)) * Math.sin(q.devers), hit = rayon(x, z, attendu + 2);
      assert.ok(hit, `trou à s=${i * c.pas + .73}, d=${lateral}`);
      assert.ok(hit.y > attendu - .3, 'support loin sous la route');
      assert.ok(S.surface(m, hit.id, hit.face));
    }
    // Les types proviennent de vrais triangles voisins ; ni la pente ni un plan de hauteur recréé.
    for (const type of ['piste', 'vibreur', 'herbe']) {
      let observe = false;
      for (const [id, a] of m.acteurs) if (a.surfaces && a.surfaces.includes(['', 'piste', 'vibreur', 'herbe'].indexOf(type))) {
        const face = a.surfaces.indexOf(['', 'piste', 'vibreur', 'herbe'].indexOf(type));
        assert.equal(S.surface(m, id, face), type); observe = true; break;
      }
      assert.ok(observe, 'surface absente : ' + type);
    }
  });
  if (c.tunnel) verifier('Haut-Col : revêtement du tunnel à sa vraie hauteur et murs complets', () => {
    const sols = [...m.acteurs].filter(([, a]) => a.genre === 'sol-tunnel'); assert.ok(sols.length > 30);
    for (const genre of ['mur-tunnel', 'voute-tunnel', 'portail-tunnel', 'roche-tunnel']) assert.ok([...m.acteurs.values()].some(a => a.genre === genre));
    for (const [id, a] of sols) {
      assert.equal(a.groupe, 1); assert.equal(S.surface(m, id, -1), 'piste');
      const o = w.objets.get(id), hit = rayon(o.pos[0], o.pos[2], o.pos[1] + 1);
      assert.ok(hit && hit.id === id, 'la nappe ancienne ne doit pas masquer le revêtement physique');
      const normale = tourner(o.options.quaternion, [0, 1, 0]);
      assert.ok(Math.abs(hit.y - (o.pos[1] + o.half[1] / normale[1])) < 1e-7);
    }
  });
  const fine = B.decor.construire(c, { ...options, qualite: 'high' }), wf = monde(), mf = S.installer(wf, c, fine);
  verifier(k.nom + ' : changer la qualité ne modifie aucun corps physique', () => {
    assert.deepEqual(signatures(wf), signatures(w));
    assert.deepEqual(mf.statistiques, m.statistiques);
  });
  rapports.push({ circuit: k.id, acteurs: m.ids.length, ...m.statistiques });
  verifier(k.nom + ' : libération complète et idempotente', () => {
    const n = m.ids.length; S.liberer(m); S.liberer(m);
    assert.equal(w.objets.size, 0); assert.equal(w.retires.length, n); assert.equal(m.acteurs.size, 0);
    S.liberer(mf); assert.equal(wf.objets.size, 0);
  });
}
verifier('une installation interrompue retire ses acteurs et préserve les corps préexistants', () => {
  const w = monde(), autre = w.addBox([0, 10, 0], [1, 1, 1], { group: 4 }), c = { obstacles: { objets: [] } };
  const sommets = new Float32Array(3 * 13); sommets.set([0, 0, 0], 0); sommets.set([1, 0, 0], 13); sommets.set([0, 0, 1], 26);
  const d = { nappes: [{ sommets, indices: new Uint32Array([0, 2, 1]) }], lots: [{ objets: [B.decor.marquerSolide({ shape: 'inconnue', p: [0, 0, 0], s: [1, 1, 1] }, 'inconnue')] }] };
  assert.throws(() => S.installer(w, c, d), /forme solide/); assert.deepEqual([...w.objets.keys()], [autre]);
});
console.log(JSON.stringify({ controles: nombre, rapports }));
