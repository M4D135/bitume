// Sections partagées par chaussée, lumière, caméra et solides, y compris routes superposées.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const req = createRequire(import.meta.url);
for (const f of ['carene', 'circuit', 'couverts', 'ferro/vehicle-dynamics', 'conduite', 'chaussee', 'decor']) req('../src/' + f + '.js');
const B = globalThis.BITUME, C = B.couverts;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const a = source.indexOf('  function preparerTunnel(c)'), b = source.indexOf('  // ---------------------------------------------------------------- rétroviseurs', a);
assert.ok(a >= 0 && b > a);
const T = new Function('B', 'creationTardive', source.slice(a, b) + '\nreturn { preparerTunnel, sousLaVoute, lampesTunnel };')(B, (nom, v) => v);
const c = B.circuit.creer(47, { theme: 'montagne', longueur: 5200, nom: 'Haut-Col' }), ancien = c.tunnel;
const p = (s, h = 1.2, d = 0) => { const q = B.circuit.echantillon(c, s); return [q.x - Math.sin(q.cap) * d, q.y - d * Math.tan(q.devers) + h, q.z + Math.cos(q.cap) * d]; };
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
verifier('le tableau d’un seul ouvrage conserve exactement le décor historique', () => {
  const options = { qualite: 'low', vegetation: false }, avant = B.decor.construire(c, options);
  c.couverts = [ancien]; const apres = B.decor.construire(c, options);
  assert.equal(hash({ lots: avant.lots, nappes: avant.nappes, lampes: avant.tunnelLampes }), hash({ lots: apres.lots, nappes: apres.nappes, lampes: apres.tunnelLampes }));
});
c.couverts = [
  { ...ancien, id: 'premier', type: 'tunnel', fin: ancien.debut + 78 },
  { ...ancien, id: 'galerie', type: 'galerie', ouvert: 'G', debut: ancien.debut + 100, fin: ancien.debut + 154 },
  { ...ancien, id: 'second', type: 'tunnel', debut: ancien.debut + 186 }
];
verifier('plusieurs ouvrages, galerie et portails partagent la même chaussée sèche', () => {
  assert.equal(C.valider(c), true);
  for (const t of c.couverts) {
    const s = (t.debut + t.fin) / 2;
    assert.equal(B.circuit.dansCouvert(c, s), t);
    assert.equal(B.circuit.dansTunnel(c, s), t.type === 'tunnel');
    const m = Object.freeze({ pluie: 1, mouille: 1, neigeSol: .6 });
    assert.deepEqual(B.chaussee.lire(c, s, m), { eau: 0, neige: 0, abri: true });
    for (const x of [t.debut - .01, t.debut, t.fin, t.fin + .01]) {
      assert.equal(C.segment(c, x), null, 'portail abscisse ' + x);
      assert.equal(C.abri(c, p(x)), false, 'portail monde ' + x);
    }
    for (const x of [t.debut + .01, t.fin - .01]) assert.equal(C.abri(c, p(x)), true);
  }
});
verifier('abri à la hauteur réelle, galerie au jour, tunnel fermé avec écho', () => {
  for (const t of c.couverts) {
    const s = (t.debut + t.fin) / 2, q = C.position(c, p(s));
    assert.equal(q.couvert, t); assert.equal(q.abri, true);
    assert.equal(q.interieur, t.type === 'tunnel'); assert.equal(q.echo, t.type === 'tunnel');
    assert.equal(T.sousLaVoute(c, p(s)), true);
    assert.equal(T.sousLaVoute(c, p(s), true), t.type === 'tunnel');
    assert.equal(C.abri(c, p(s, t.hauteur + .01)), false, 'caméra au-dessus du toit');
    assert.equal(C.abri(c, p(s, -1)), false, 'route sous le tunnel');
    assert.equal(C.abri(c, p(s, 1.2, t.mur + .01)), false, 'caméra latérale dehors');
  }
});
verifier('une lecture ne conserve aucun abri entre J1, J2 et les rétros', () => {
  const q = {}, s = c.couverts[0].debut + 20;
  assert.equal(C.position(c, p(s), q), q); assert.equal(q.abri, true);
  assert.equal(C.position(c, p(s, 30), q), null); assert.equal(q.abri, false); assert.equal(q.couvert, null);
  assert.equal(C.position(c, p(s), q), q); assert.equal(q.abri, true);
  assert.equal(C.position(c, [NaN, 0, 0], q), null); assert.equal(q.interieur, false);
  const cache = C.preparer(c); assert.equal(C.preparer(c), cache); C.invalider(c); assert.notEqual(C.preparer(c), cache);
});
verifier('intervalles passant la ligne, marges et sortie de couverts chevauchants', () => {
  const tour = { longueur: 1000, couverts: [
    { id: 'boucle', type: 'tunnel', debut: 950, fin: 30, mur: 8, hauteur: 6 },
    { id: 'suivant', type: 'galerie', ouvert: 'D', debut: 20, fin: 80, mur: 8, hauteur: 6 }
  ] };
  assert.equal(C.longueur(tour, tour.couverts[0]), 80);
  for (const s of [-2, 2, 1002]) assert.equal(C.dansTunnel(tour, s), true);
  assert.equal(C.dansTunnel(tour, 30), false);
  assert.equal(C.dansTunnel(tour, 35, 10), true);
  assert.equal(C.sortie(tour, 960, 25), 110);
  tour.couverts.push({ type: 'tunnel', debut: 70, fin: 955, mur: 8, hauteur: 6 });
  assert.equal(C.sortie(tour, 960, 25), null, 'aucun faux poste caméra quand le tour entier est occupé');
});
verifier('les niveaux superposés ne partagent ni abri ni éclairage', () => {
  const lecteur = B.circuit.echantillon;
  const couches = { longueur: 1000, pas: 2, couverts: [{ type: 'tunnel', debut: 100, fin: 120, mur: 8, hauteur: 6 }, { type: 'galerie', ouvert: 'D', debut: 300, fin: 320, mur: 8, hauteur: 6 }] };
  B.circuit.echantillon = (c, s, out = {}) => Object.assign(out, { x: s % 200, y: s >= 300 ? 30 : 0, z: 0, cap: 0, devers: 0 });
  try {
    assert.equal(C.position(couches, [110, 1, 0]).type, 'tunnel');
    assert.equal(C.position(couches, [110, 31, 0]).type, 'galerie');
    assert.equal(C.position(couches, [110, 16, 0]), null);
    const LT = [[110, 4, 0]], bas = {}, haut = {};
    for (let i = 0; i < 60; i++) { T.lampesTunnel(bas, 'retro', LT, { pos: [110, 1, 0] }, 1/60, 1); T.lampesTunnel(haut, 'retro', LT, { pos: [110, 31, 0] }, 1/60, 1); }
    assert.ok(bas.retro.p[0] > 10); assert.equal(haut.retro.p[0], 0);
  } finally { B.circuit.echantillon = lecteur; }
});
verifier('décor complet de deux tunnels et galerie, mêmes primitives visibles et solides', () => {
  const d = B.decor.construire(c, { qualite: 'low', vegetation: false });
  const objets = d.lots.flatMap(l => l.objets), genres = new Set(objets.filter(o => o.solidePhysX).map(o => o.solidePhysX.genre));
  for (const nom of ['mur-tunnel', 'voute-tunnel', 'sol-tunnel', 'mur-galerie', 'voute-galerie', 'pilier-galerie', 'sol-galerie']) assert.ok(genres.has(nom), nom);
  const lampes = objets.filter(o => o.emissive > 2 && o.mat === 5);
  assert.equal(d.tunnelLampes.length, lampes.length, 'aucune remise à zéro des lampes à chaque ouvrage');
  for (const t of c.couverts) assert.ok(d.tunnelLampes.some(l => { const q = C.position(c, l); return q?.couvert === t; }), t.id);
  for (const o of objets) {
    assert.ok(o.p.every(Number.isFinite)); assert.ok(o.s.every(Number.isFinite));
    if (o.r) assert.ok(o.r.every(Number.isFinite));
    if (o.solidePhysX?.genre.includes('galerie')) assert.equal(Object.getOwnPropertyDescriptor(o, 'solidePhysX').enumerable, false);
  }
});
verifier('les descriptions invalides sont rejetées avant le rendu', () => {
  const t = c.couverts[0];
  for (const changement of [{ type: 'pont' }, { fin: t.debut }, { mur: 0 }, { hauteur: NaN }, { type: 'galerie', ouvert: 'X' }]) assert.throws(() => C.valider({ longueur: c.longueur, couverts: [{ ...t, ...changement }] }));
});
console.log(`couverts-multiples : ${n} vérifications passées`);
