// Vraies primitives rendues et installées dans PhysX : deux tunnels et une galerie ouverte.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'carene', 'decor', 'obstacles', 'solides-physx']) req('../src/' + f + '.js');
const B = globalThis.BITUME, X = await chargerPhysX();
const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200 }), t = c.tunnel;
c.couverts = [
  { ...t, id: 'premier', type: 'tunnel', fin: t.debut + 78 },
  { ...t, id: 'galerie', type: 'galerie', ouvert: 'G', debut: t.debut + 100, fin: t.debut + 154 },
  { ...t, id: 'second', type: 'tunnel', debut: t.debut + 186 }
];
const d = B.decor.construire(c, { qualite: 'low', vegetation: false }); c.obstacles = B.obstacles.creer(d.obstacles);
const w = X.createWorld({ fixedStep: 1/120, maxSubSteps: 1, contacts: true }), m = B.solidesPhysX.installer(w, c, d);
let n = 0, rayons = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok '+nom); };
const rayon = (p, direction, distance, mask) => { rayons++; return w.raycast(p, direction, distance, { mask, staticOnly: true }); };
try {
  verifier('chaussée continue avant, sous et après chacun des trois ouvrages', () => {
    for (const t of c.couverts) for (let s = t.debut - 3; s <= t.fin + 3; s += .7) {
      const e = B.circuit.echantillon(c, s), hit = rayon([e.x, e.y + 1, e.z], [0, -1, 0], 2, 1);
      assert.ok(hit.hit, 'trou à '+s); assert.ok(Math.abs(hit.y - e.y) < .12, 'marche ou sol incohérent');
      assert.equal(B.solidesPhysX.surface(m, hit.body, hit.faceIndex), 'piste');
    }
  });
  verifier('murs et toit physiques des deux tunnels et de la galerie', () => {
    for (const t of c.couverts) {
      const e = B.circuit.echantillon(c, t.debut + 26), p = [e.x, e.y + 2, e.z];
      const toit = rayon(p, [0, 1, 0], t.hauteur + 1, 2);
      assert.ok(toit.hit); assert.equal(m.acteurs.get(toit.body)?.genre, t.type === 'galerie' ? 'voute-galerie' : 'voute-tunnel');
      for (const cote of t.type === 'galerie' ? [1] : [-1, 1]) {
        const mur = rayon(p, [-Math.sin(e.cap) * cote, 0, Math.cos(e.cap) * cote], t.mur + .9, 2);
        assert.ok(mur.hit); assert.equal(m.acteurs.get(mur.body)?.genre, t.type === 'galerie' ? 'mur-galerie' : 'mur-tunnel');
      }
    }
  });
  verifier('côté ouvert de la galerie et ses piliers restent distincts', () => {
    const t = c.couverts[1];
    for (const [offset, attendu] of [[6, false], [12, true], [18, false], [24, true]]) {
      const e = B.circuit.echantillon(c, t.debut + offset), hit = rayon([e.x, e.y + 2, e.z], [Math.sin(e.cap), 0, -Math.cos(e.cap)], t.mur + .7, 2);
      assert.equal(hit.hit, attendu, 'galerie à '+offset);
      if (attendu) assert.equal(m.acteurs.get(hit.body)?.genre, 'pilier-galerie');
    }
  });
  verifier('le toit n’est jamais utilisé comme sol par les suspensions', () => {
    for (const t of c.couverts) {
      const e = B.circuit.echantillon(c, t.debut + 26), hit = rayon([e.x, e.y + t.hauteur + 2, e.z], [0, -1, 0], t.hauteur + 4, 1);
      assert.ok(hit.hit); assert.ok(hit.y < e.y + .12);
    }
  });
} finally { B.solidesPhysX.liberer(m); w.dispose(); }
console.log(`couverts-physx : ${n} vérifications passées, ${rayons} rayons natifs`);
