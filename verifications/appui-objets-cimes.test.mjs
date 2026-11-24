// Les rochers de la Route-des-Cimes se posent sur le relief ou sur la voûte : aucun ventre exposé.
// Capture 19.43.34 (23/11) : rangée de rochers du tunnel flottant au-dessus de la bande et de la nappe grise.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'couverts', 'route-des-cimes', 'carene', 'botanique', 'ecologie', 'saisons', 'bords', 'decor']) req('../src/' + f + '.js');
const B = globalThis.BITUME;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };

const OUVRAGES = new Set(['tympan-cimes', 'portail-tunnel', 'arche-cimes', 'rive-pont-cimes']);
const ENFONCE = 4.0, TOLERANCE = 1.2;

function hauteurTriangle(a, b, c, x, z) {
  const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(det) < 1e-10) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det, w = 1 - u - v;
  return Math.min(u, v, w) < -1e-6 ? null : u * a[1] + v * b[1] + w * c[1];
}
function supportSous(nappes, caisses, x, z, depuis) {
  let h = -Infinity;
  for (const nap of nappes) {
    if (nap.surfaceType === 'eau' || nap.surfaceType === 'peinture' || !nap.sommets) continue;
    const v = nap.sommets, idx = nap.indices;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 13, b = idx[i + 1] * 13, c = idx[i + 2] * 13;
      if (x < Math.min(v[a], v[b], v[c]) - .001 || x > Math.max(v[a], v[b], v[c]) + .001
        || z < Math.min(v[a + 2], v[b + 2], v[c + 2]) - .001 || z > Math.max(v[a + 2], v[b + 2], v[c + 2]) + .001) continue;
      const y = hauteurTriangle(v.subarray(a, a + 3), v.subarray(b, b + 3), v.subarray(c, c + 3), x, z);
      if (y !== null && y <= depuis && y > h) h = y;
    }
  }
  for (const q of caisses) {
    if (x < q.x0 || x > q.x1 || z < q.z0 || z > q.z1) continue;
    if (q.top <= depuis && q.top > h) h = q.top;
  }
  return h;
}

const c = B.routeDesCimes.creer();
B.bords.limites(c, B.bords.planifier(c));
const d = B.decor.construire(c, { qualite: 'low', vegetation: false, saison: 'ete' });
const lots = d.lotsHerbier || d.lots;
const rochers = lots.flatMap(l => l.objets).filter(o => o.solidePhysX && o.solidePhysX.genre === 'roche-tunnel' && o.p && o.s);
const caisses = lots.flatMap(l => l.objets)
  .filter(o => o.shape === 'box' && o.solidePhysX && o.p && o.s)
  .map(o => ({ x0: o.p[0] - o.s[0] / 2, x1: o.p[0] + o.s[0] / 2, z0: o.p[2] - o.s[2] / 2, z1: o.p[2] + o.s[2] / 2, top: o.p[1] + o.s[1] / 2 }));

verifier('la génération produit les rochers du tunnel', () => {
  assert.ok(rochers.length >= 400, 'attendu >= 400 rochers, obtenu ' + rochers.length);
});

verifier('aucun rocher du tunnel ne montre un ventre exposé', () => {
  const suspects = [];
  for (const o of rochers) {
    const base = o.p[1] - o.s[1] / 2, hx = o.s[0] / 2, hz = o.s[2] / 2;
    let appuis = 0, gapCentre = Infinity;
    for (const [dx, dz] of [[0, 0], [hx, 0], [-hx, 0], [0, hz], [0, -hz]]) {
      const y = supportSous(d.nappes, caisses, o.p[0] + dx, o.p[2] + dz, base + ENFONCE);
      if (Number.isFinite(y) && y <= base + TOLERANCE) appuis++;
      if (dx === 0 && dz === 0 && Number.isFinite(y)) gapCentre = base - y;
    }
    if (appuis === 0 && gapCentre > TOLERANCE) suspects.push({ x: +o.p[0].toFixed(1), z: +o.p[2].toFixed(1), base: +base.toFixed(1), gapCentre: +gapCentre.toFixed(1) });
  }
  assert.equal(suspects.length, 0, suspects.length + ' rocher(s) flottant(s) : ' + JSON.stringify(suspects.slice(0, 6)));
});

verifier('les tympans de portail restent des ouvrages à jambes (non mesurés)', () => {
  const tympans = lots.flatMap(l => l.objets).filter(o => o.solidePhysX && OUVRAGES.has(o.solidePhysX.genre));
  assert.ok(tympans.length >= 30, 'attendu >= 30 ouvrages de portail, obtenu ' + tympans.length);
});

console.log(n + ' contrôles d’appui passés');
