// Le tunnel historique est droit : sonder aussi les joints extérieurs de vrais ouvrages courbes,
// montants et descendants, avec un pas et des portails non entiers. La nappe routière n'est pas
// installée dans ce monde : elle ne peut pas masquer une fente du revêtement intérieur dessiné.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { chargerPhysX } from './helpers/physx-runtime.mjs';
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'carene', 'decor', 'solides-physx']) req('../src/' + f + '.js');
const B = globalThis.BITUME, X = await chargerPhysX();
let controles = 0, rayons = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

function circuit(sens) {
  const points = Array.from({ length: 720 }, (_, i) => {
    const a = i * Math.PI / 360;
    return { x: 120 * Math.cos(a), y: 50 + 14 * Math.sin(a), z: sens * 120 * Math.sin(a), largeurG: 6, largeurD: 6, limiteG: 7.6, limiteD: 7.6 };
  });
  points.push({ ...points[0] });
  const c = B.circuit.creerDepuisTrace({ unite: 'm', pasMax: 1.73, points });
  // Ces métadonnées ne rendent pas le banc jouable : elles permettent au décor de construire
  // ses vraies primitives à largeur fixe autour de la polyligne explicite.
  Object.assign(c, { graine: 47, theme: 'montagne', largeur: 12, limite: 20, vibreur: new Uint8Array(c.n),
    couverts: [
      { id: 'courbe-montante', type: 'tunnel', debut: 40.13, fin: 220.51, mur: 7.6, hauteur: 6.4 },
      { id: 'courbe-descendante', type: 'tunnel', debut: 430.39, fin: 610.67, mur: 7.6, hauteur: 6.4 }
    ] });
  return c;
}

try {
  for (const sens of [-1, 1]) {
    const c = circuit(sens), d = B.decor.construire(c, { qualite: 'low', vegetation: false });
    const objets = d.lots.flatMap(l => l.objets).filter(o => /^(sol|mur|voute)-tunnel$/.test(o.solidePhysX?.genre));
    const w = X.createWorld({ fixedStep: 1 / 120, maxSubSteps: 1, contacts: true });
    const m = B.solidesPhysX.installer(w, c, { nappes: [], obstacles: [], lots: [{ objets }] });
    const rayon = (p, direction, distance, mask) => { rayons++; return w.raycast(p, direction, distance, { mask, staticOnly: true }); };
    const pose = (s, lat, h) => {
      const q = B.circuit.echantillon(c, s);
      return { q, p: [q.x - Math.sin(q.cap) * lat, q.y + h, q.z + Math.cos(q.cap) * lat] };
    };
    try {
      verifier('revêtement et voûte continus aux joints courbes, sens ' + sens, () => {
        for (const t of c.couverts) for (let s = t.debut + 3 * c.pas; s < t.fin - .2; s += 3 * c.pas) {
          for (const ds of [-.04, 0, .04]) for (const lat of [-6, -4, 0, 4, 6]) {
            const { q, p } = pose(s + ds, lat, 1.2);
            const sol = rayon(p, [0, -1, 0], 2, 1), toit = rayon(p, [0, 1, 0], t.hauteur + 1, 2);
            const detail = `${t.id}, s=${s + ds}, d=${lat}, sens=${sens}`;
            assert.ok(sol.hit, 'fente dans le revêtement : ' + detail);
            assert.equal(m.acteurs.get(sol.body)?.genre, 'sol-tunnel', detail);
            assert.ok(Math.abs(sol.y - q.y - .04) < .08, 'marche du revêtement : ' + detail);
            assert.ok(toit.hit, 'fente dans la voûte : ' + detail);
            assert.equal(m.acteurs.get(toit.body)?.genre, 'voute-tunnel', detail);
            assert.ok(Math.abs(toit.y - q.y - t.hauteur) < .08, 'voûte à mauvaise hauteur : ' + detail);
          }
        }
      });
      verifier('murs sans trou latéral aux joints courbes, sens ' + sens, () => {
        for (const t of c.couverts) for (let s = t.debut + 3 * c.pas; s < t.fin - .2; s += 3 * c.pas) {
          for (const ds of [-.04, 0, .04]) for (const cote of [-1, 1]) for (const h of [1.2, 3.2, 5.8]) {
            const { q, p } = pose(s + ds, 0, h);
            const hit = rayon(p, [-Math.sin(q.cap) * cote, 0, Math.cos(q.cap) * cote], t.mur + 1, 2);
            assert.ok(hit.hit, `fente mur ${t.id}, s=${s + ds}, côté=${cote}, h=${h}, sens=${sens}`);
            assert.equal(m.acteurs.get(hit.body)?.genre, 'mur-tunnel');
          }
        }
      });
      verifier('les raccords intérieurs ne prolongent pas les portails, sens ' + sens, () => {
        for (const t of c.couverts) for (const [borne, direction] of [[t.debut, 1], [t.fin, -1]]) {
          for (const lat of [-6, 0, 6]) for (const [distance, dedans] of [[-1, false], [1, true]]) {
            const { p } = pose(borne + direction * distance, lat, 1.2);
            assert.equal(rayon(p, [0, 1, 0], t.hauteur + 1, 2).hit, dedans);
            assert.equal(B.couverts.abri(c, p), dedans);
          }
        }
      });
    } finally { B.solidesPhysX.liberer(m); w.dispose(); }
  }
} finally { X.dispose(); }
console.log(`couverts-joints-courbes : ${controles} vérifications passées, ${rayons} rayons natifs`);
