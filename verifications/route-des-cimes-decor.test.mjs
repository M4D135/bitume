// Géométrie réellement envoyée au rendu : pont ouvert, gorge, corniches et refuge.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'route-des-cimes', 'carene', 'botanique', 'ecologie', 'saisons', 'bords', 'decor']) req('../src/' + f + '.js');
const B = globalThis.BITUME;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };
const hash = c => createHash('sha256').update(JSON.stringify(['x','y','z','courbure','pente','devers','limiteG','limiteD','vitesse'].map(k => Array.from(c[k])))).digest('hex');
function hauteurTriangle(a, b, c, x, z) {
  const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(det) < 1e-10) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det, w = 1 - u - v;
  return Math.min(u, v, w) < -1e-6 ? null : u * a[1] + v * b[1] + w * c[1];
}
function solDessine(nappes, x, z) {
  let h = -Infinity;
  for (const nap of nappes) {
    if (nap.surfaceType !== 'accotement') continue;
    const v = nap.sommets, idx = nap.indices;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 13, b = idx[i + 1] * 13, c = idx[i + 2] * 13;
      if (x < Math.min(v[a],v[b],v[c]) - .001 || x > Math.max(v[a],v[b],v[c]) + .001
        || z < Math.min(v[a+2],v[b+2],v[c+2]) - .001 || z > Math.max(v[a+2],v[b+2],v[c+2]) + .001) continue;
      const y = hauteurTriangle(v.subarray(a,a+3),v.subarray(b,b+3),v.subarray(c,c+3),x,z);
      if (y !== null) h = Math.max(h, y);
    }
  }
  return h;
}
for (const qualite of ['low', 'high']) {
  const c = B.routeDesCimes.creer(); B.bords.limites(c, B.bords.planifier(c));
  const avant = hash(c), d = B.decor.construire(c, { qualite, vegetation: false, saison: 'ete' });
  const objets = (d.lotsHerbier || d.lots).flatMap(l => l.objets), pont = c.ponts[0], milieu = (pont.debut + pont.fin) / 2;
  verifier(qualite + ' : tracé et consignes p15 conservés, solides et sommets tous finis', () => {
    assert.equal(hash(c), avant);
    for (const nap of d.nappes) assert.ok(nap.sommets.every(Number.isFinite));
    for (const o of objets) {
      assert.ok(o.p.every(Number.isFinite), 'position ' + o.partie);
      if (o.s) assert.ok(o.s.every(x => Number.isFinite(x) && x > 0), 'taille ' + o.partie);
      if (o.r) assert.ok(o.r.every(Number.isFinite), 'rotation ' + o.partie);
    }
  });
  verifier(qualite + ' : les trois couverts et la maçonnerie de l’arche sont réellement construits', () => {
    const genres = objets.filter(o => o.solidePhysX).map(o => o.solidePhysX.genre);
    assert.equal(d.cimes.pont.voussoirs, 44);
    assert.equal(genres.filter(g => g === 'arche-cimes').length, 44);
    assert.ok(genres.includes('sol-tunnel') && genres.includes('sol-galerie') && genres.includes('pilier-galerie'));
    const refuge = objets.filter(o => o.lieuCimes === 'Refuge de l’Aiglière');
    assert.ok(refuge.length > 15); assert.ok(refuge.some(o => o.partie === 'toiture' || /toit/.test(o.partie)));
    assert.ok(d.cimes.refuge && d.cimes.corniches.length === 2);
  });
  verifier(qualite + ' : le tablier et ses raccords restent continus sur toute la largeur roulable', () => {
    for (let s = pont.debut - 4; s < pont.fin + 4; s += 7) for (const decalage of [-6, 0, 6]) {
      const q = B.circuit.echantillon(c, s), x = q.x - Math.sin(q.cap) * decalage, z = q.z + Math.cos(q.cap) * decalage;
      const y = solDessine(d.nappes, x, z), attendu = q.y - Math.tan(q.devers) * decalage;
      assert.ok(Number.isFinite(y) && Math.abs(y - attendu) < .06, 'trou du tablier à ' + s + ', d=' + decalage);
    }
  });
  verifier(qualite + ' : la gorge est creusée dans le terrain dessiné sous le pont', () => {
    const q = B.circuit.echantillon(c, milieu);
    for (const decalage of [-36, 36]) {
      const x = q.x - Math.sin(q.cap) * decalage, z = q.z + Math.cos(q.cap) * decalage;
      assert.ok(d.sol(x,z) < q.y - 35, 'gorge absente au-delà du tablier');
    }
    // L’ancienne bande d’herbe n’occulte plus l’arche juste après le parapet.
    const x = q.x - Math.sin(q.cap) * 11, z = q.z + Math.cos(q.cap) * 11;
    assert.equal(solDessine(d.nappes, x, z), -Infinity);
  });
}
verifier('le module de lieux ne modifie aucun autre circuit', () => {
  const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200 });
  assert.equal(B.cimesDecor.planifier(c), null);
  assert.equal(B.cimesDecor.relief(c,0,0,{i:0,d:0},42),42);
  assert.equal(B.cimesDecor.couperAccotement(c,10,'herbe'),false);
});
console.log(`Route-des-Cimes décor : ${n} vérifications réussies`);
