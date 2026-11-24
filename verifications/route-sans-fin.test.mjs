// Route sans fin : cycle obligatoire, raccords sans bosse ni trou, déterminisme indépendant
// de l'ordre de chargement, bornes de pente et de courbure par biome.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const req = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const m of ['circuit', 'route-sans-fin']) req(path.join(ROOT, 'src', m + '.js'));
const B = globalThis.BITUME, R = B.routeSansFin;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };
const GRAINE = 20261124;

verifier('le cycle obligatoire se répète à l’infini', () => {
  assert.deepEqual([...R.CYCLE], ['plage', 'plaine', 'petite-montagne', 'grande-montagne', 'petite-montagne', 'plaine']);
  for (let k = 0; k < 60; k++) assert.equal(R.biomePour(k), R.CYCLE[k % 6], 'tronçon ' + k);
});

verifier('les paysages varient à l’intérieur du cycle', () => {
  const themes = k => R.pointsSegment(k, GRAINE).profil.theme;
  for (let k = 0; k < 24; k++) assert.ok(R.VARIANTES[R.biomePour(k)].includes(themes(k)), 'theme hors palette en ' + k + ' : ' + themes(k));
  let variantes = 0;
  for (let k = 0; k < 60; k += 6) if (themes(k) !== themes(k + 6)) variantes++;
  assert.ok(variantes >= 4, 'trop peu de variantes entre cycles voisins : ' + variantes);
  const autre = k => R.pointsSegment(k, GRAINE ^ 0x5eed).profil;
  assert.notEqual(JSON.stringify(autre(1)), JSON.stringify(R.pointsSegment(1, GRAINE).profil));
});

verifier('la somme des déplacements reproduit l’état de bord', () => {
  let x = 0, y = 0, z = 0, cap = 0;
  for (let k = 0; k < 12; k++) {
    const e = R.etatBord(k, GRAINE);
    assert.ok(Math.abs(e.x - x) < 1e-9 && Math.abs(e.y - y) < 1e-9 && Math.abs(e.z - z) < 1e-9, 'bord ' + k);
    assert.ok(Math.abs(((cap - e.cap + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 1e-9, 'cap ' + k);
    const d = R.pointsSegment(k, GRAINE).deplacement;
    const c = Math.cos(cap), s = Math.sin(cap);
    x += c * d.dx - s * d.dz; z += s * d.dx + c * d.dz; y += d.dy; cap += d.dcap;
  }
});

verifier('la trace est identique quel que soit l’ordre de chargement', () => {
  const attendu = JSON.stringify(R.creerTrace(0, 8, GRAINE));
  // on interroge d’abord le loin et le désordre : la fenêtre glissante fait exactement cela
  for (const k of [41, 7, 19, 0, 33, 12]) { R.pointsSegment(k, GRAINE); R.etatBord(k, GRAINE); }
  assert.equal(JSON.stringify(R.creerTrace(0, 8, GRAINE)), attendu);
  // et depuis une autre fenêtre qui recouvre les mêmes tronçons
  const partiel = R.creerTrace(3, 8, GRAINE).points;
  const entier = R.creerTrace(0, 8, GRAINE).points;
  const s0 = R.etatBord(3, GRAINE);
  assert.ok(Math.hypot(partiel[0].x - entier.find(p => Math.abs(p.x - s0.x) < 1e-6 && Math.abs(p.z - s0.z) < 1e-6).x, 0) < 1e-6);
});

function releves(trace) {
  const p = trace.points, out = [];
  for (let i = 1; i < p.length - 1; i++) {
    const ax = p[i].x - p[i - 1].x, az = p[i].z - p[i - 1].z, bx = p[i + 1].x - p[i].x, bz = p[i + 1].z - p[i].z;
    const na = Math.hypot(ax, az), nb = Math.hypot(bx, bz);
    const tourne = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz));
    const pente = (p[i + 1].y - p[i - 1].y) / (na + nb);
    out.push({ i, pas: na + nb, tourne, pente });
  }
  return out;
}

verifier('aucune bosse ni trou aux coutures des tronçons', () => {
  const trace = R.creerTrace(0, 12, GRAINE), rs = releves(trace);
  for (const r of rs) {
    assert.ok(Math.abs(r.pas - 2 * R.PAS) < 0.05, 'pas anormal à ' + r.i + ' : ' + r.pas);
    assert.ok(r.tourne < 0.2, 'angle anormal à ' + r.i + ' : ' + r.tourne);
  }
  // aux coutures mêmes : l’angle ne doit pas dépasser celui des voisins (pas de cassure)
  let s = 0;
  for (let k = 0; k < 12; k++) {
    const L = R.pointsSegment(k, GRAINE).profil.L;
    const idx = Math.round(s / R.PAS);
    const r = rs.find(v => v.i === idx);
    if (r) {
      const regle = Math.max(R.REGLES[R.biomePour(k)].courbure, R.REGLES[R.biomePour(k - 1)].courbure);
      assert.ok(r.tourne <= regle * R.PAS * 1.6 + 1e-6, 'cassure à la couture du tronçon ' + k + ' : ' + r.tourne);
    }
    s += L;
  }
});

verifier('pente et courbure restent dans les bornes du biome', () => {
  const trace = R.creerTrace(0, 18, GRAINE), rs = releves(trace);
  let s = 0, k = 0, borneS = R.pointsSegment(0, GRAINE).profil.L;
  for (const r of rs) {
    while (r.i * R.PAS > borneS && k < 17) { k++; borneS += R.pointsSegment(k, GRAINE).profil.L; }
    const regle = R.REGLES[R.biomePour(k)];
    assert.ok(Math.abs(r.pente) <= regle.pente * 1.5 + 0.02, 'pente hors borne (' + R.biomePour(k) + ') à ' + r.i + ' : ' + r.pente);
    assert.ok(r.tourne <= regle.courbure * R.PAS * 1.6 + 1e-6, 'courbure hors borne (' + R.biomePour(k) + ') à ' + r.i + ' : ' + r.tourne);
  }
});

verifier('la trace se charge comme parcours ouvert du circuit', () => {
  const trace = R.creerTrace(0, 4, GRAINE);
  const c = B.circuit.creerDepuisTrace(trace, { topologie: 'ouvert' });
  assert.equal(c.ouvert, true);
  assert.equal(c.topologie, 'ouvert');
  assert.ok(Math.abs(c.longueur - trace.arrivee) < 2 * R.PAS, 'longueur ' + c.longueur + ' contre ' + trace.arrivee);
  const q = B.circuit.echantillon(c, c.longueur / 2);
  assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.cap) && Number.isFinite(q.courbure));
  const r0 = B.circuit.echantillon(c, 0), r1 = B.circuit.echantillon(c, c.longueur);
  assert.ok(r1.x > r0.x - c.longueur && r1.z > -1e9, 'bornes de lecture ouvertes');
});

console.log(n + ' contrôles de route sans fin passés');
