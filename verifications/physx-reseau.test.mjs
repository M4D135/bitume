// Paquets PhysX optionnels : transport réel, prédiction bornée et compatibilité du réseau historique.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/reseau.js';

const B = globalThis.BITUME, R = B.reseau, c = { longueur: 120, cap: .4, courbure: .007 };
B.circuit = { echantillon: circuit => ({ cap: circuit.cap, courbure: circuit.courbure }) };
const champs = ['s', 'd', 'v', 'psi', 'beta', 'omega', 'y', 'tangage', 'roulis', 'regime', 'volant', 'rapport', 'gaz', 'frein', 'braquage'];
const etat = () => ({ s: 39, d: 1.2, v: 27.5, psi: .2, beta: .04, omega: .3, y: 4, tangage: .12, roulis: -.08,
  regime: 7500, volant: .3, rapport: 3, gaz: .8, frein: .1, braquage: .05 });
const physique = () => [24, 2, -3, .1, -.2, .3, -.18, -.07, .06, .14, 4];
const source = valeurs => ({ velocity: valeurs.slice(0, 3), angular: valeurs.slice(3, 6), offsets: valeurs.slice(6, 10), groundCount: valeurs[10] });
const vehicule = (id, ph) => ({ id, etat: { ...etat(), ...(ph ? { _physx: source(ph) } : {}) } });
const proches = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const historique = r => Object.fromEntries(champs.map(k => [k, r[k]]));

test('ancien paquet et CHAMPS inchangés octet pour octet, aucune donnée pneu ajoutée', () => {
  assert.deepEqual(R.CHAMPS, champs);
  const v = vehicule(7); v.etat.pneus = 'neige'; v.etat.etatPneus = [{ usure: .37 }];
  const buf = R.emballer(1234.5, [v]);
  assert.equal(Buffer.from(buf).toString('hex'), '0100000000004a9340010700001c429a99993f0000dc41cdcc4c3e0ad7233d9a99993e000080408fc2f53d0ad7a3bd0060ea459a99993e00004040cdcc4c3fcdcccc3dcdcc4c3d');
  const p = R.deballer(buf);
  assert.equal(p.t, 1234.5); assert.equal(p.voitures[0].id, 7);
  assert.deepEqual(Object.keys(p.voitures[0]), ['id', ...champs]);
});

test('roundtrip mixte : extension float32 de onze nombres, positions de voitures et préfixe historique conservés', () => {
  const a = physique(), b = physique(); b[1] = -4; b[10] = 0;
  const voitures = [vehicule(7), vehicule(42, a), vehicule(1, b)];
  const legacy = R.emballer(1234.5, voitures.map(v => ({ ...v, etat: { ...v.etat, _physx: undefined } })));
  const buf = R.emballer(1234.5, voitures), p = R.deballer(buf);
  assert.equal(buf.byteLength, legacy.byteLength + 3 + 2 * 45);
  assert.deepEqual(Buffer.from(buf, 0, legacy.byteLength), Buffer.from(legacy));
  assert.deepEqual(R.deballer(buf.slice(0, legacy.byteLength)), R.deballer(legacy), 'un ancien lecteur voit exactement les quinze valeurs');
  assert.equal(p.voitures[0].physx, undefined);
  assert.deepEqual(p.voitures.map(v => v.id), [7, 42, 1]);
  assert.deepEqual(Array.from(p.voitures[1].physx), a.map(Math.fround));
  assert.deepEqual(Array.from(p.voitures[2].physx), b.map(Math.fround));
  assert.equal(R.prolonger(p.voitures[1], 0, c).physx.length, 11, 'les deux bornes de suspension passent après conversion float32');
});

test('saut : hauteur et vitesse verticale prédites, gravité uniquement sans appui', () => {
  const ph = physique(); ph[1] = 8; ph[10] = 0;
  const e = { ...etat(), physx: ph }, r = R.prolonger(e, .2, c);
  proches(r.y, 4 + 8 * .2 - .5 * 9.81 * .2 ** 2);
  proches(r.physx[1], 8 - 9.81 * .2);
  assert.equal(r.physx[0], 24); assert.equal(r.physx[2], -3);
  assert.equal(e.y, 4); assert.equal(e.physx[1], 8, 'le paquet reçu reste immuable');
  for (const groundCount of [1, 2, 3, 4]) {
    e.physx[10] = groundCount; const sol = R.prolonger(e, .2, c);
    proches(sol.y, 5.6); assert.equal(sol.physx[1], 8);
  }
});

test('horizon historique +350/-100 ms conservé, y et vy correspondent au même instant', () => {
  const ph = physique(); ph[10] = 0;
  const e = { ...etat(), physx: ph };
  for (const [dt, h] of [[9, .35], [-9, -.1], [.08, .08], [-.05, -.05], [NaN, 0]]) {
    const r = R.prolonger(e, dt, c);
    proches(r.y, e.y + ph[1] * h - .5 * 9.81 * h * h);
    proches(r.physx[1], ph[1] - 9.81 * h);
    const reference = R.prolonger(etat(), dt, c);
    for (const k of ['s', 'd', 'psi']) assert.equal(r[k], reference[k]);
  }
});

test('projection angulaire monde : tangage autour de la droite et roulis autour de l’avant incliné', () => {
  for (const cap of [0, Math.PI / 2, Math.PI, .73]) {
    const circuit = { longueur: 120, cap, courbure: 0 }, e = { ...etat(), psi: 0, beta: 0, v: 0, omega: 0, tangage: .23, roulis: -.16 };
    const ph = physique(); ph[3] = -.6 * Math.sin(cap); ph[4] = 0; ph[5] = .6 * Math.cos(cap); e.physx = ph;
    const pitch = R.prolonger(e, .2, circuit);
    proches(pitch.tangage, .23 + .6 * .2); proches(pitch.roulis, -.16);
    ph[3] = .6 * Math.cos(cap) * Math.cos(.23); ph[4] = .6 * Math.sin(.23); ph[5] = .6 * Math.sin(cap) * Math.cos(.23);
    const roll = R.prolonger(e, .2, circuit);
    proches(roll.tangage, .23); proches(roll.roulis, -.16 + .6 * .2);
  }
});

test('lacet pur ne change pas l’assiette ; rotation et tangage presque vertical restent finis', () => {
  const e = { ...etat(), tangage: .8, roulis: -.6, physx: physique() };
  e.physx[3] = e.physx[5] = 0; e.physx[4] = -2;
  const r = R.prolonger(e, .3, c); proches(r.tangage, e.tangage); proches(r.roulis, e.roulis);
  e.tangage = Math.PI / 2 - 1e-12; e.physx[3] = 100; e.physx[4] = -100; e.physx[5] = 100;
  const vertical = R.prolonger(e, 5, c);
  assert.ok(Number.isFinite(vertical.tangage) && Number.isFinite(vertical.roulis));
  assert.ok(Math.abs(vertical.tangage) <= Math.PI / 2 && Math.abs(vertical.roulis) <= Math.PI);
});

test('quatre suspensions et tampon de sortie réutilisés sans partage entre voitures ni avec le paquet', () => {
  const e = { ...etat(), physx: physique() }, out = {}, autre = {};
  const a = R.prolonger(e, .1, c, out).physx;
  assert.ok(a instanceof Float64Array); assert.notEqual(a, e.physx);
  assert.deepEqual(Array.from(a.slice(6)), e.physx.slice(6));
  for (let i = 0; i < 100; i++) assert.equal(R.prolonger(e, i / 1000, c, out).physx, a);
  assert.notEqual(R.prolonger(e, .1, c, autre).physx, a);
  assert.equal(R.prolonger(etat(), .1, c, out).physx, null, 'aucun état physique périmé après un paquet ancien');
  assert.equal(R.prolonger(e, .1, c, out).physx, a, 'le tampon est conservé même après un état sans extension');
});

test('validation stricte des onze valeurs : types, longueur, finitude, vitesses, courses et nombre entier d’appuis', () => {
  const invalides = [null, {}, '01234567890', { ...physique(), length: 11 }, physique().slice(1), [...physique(), 0]];
  for (let i = 0; i < 11; i++) for (const x of [NaN, Infinity, -Infinity, '0', null]) {
    const ph = physique(); ph[i] = x; invalides.push(ph);
  }
  for (let i = 0; i < 11; i++) for (const x of i < 3 ? [-500.01, 500.01] : i < 6 ? [-100.01, 100.01] : i < 10 ? [-.18001, .14001] : [-1, 5, .5]) {
    const ph = physique(); ph[i] = x; invalides.push(ph);
  }
  const reference = R.prolonger(etat(), .175, c), out = {};
  R.prolonger({ ...etat(), physx: physique() }, .175, c, out);
  for (const physx of invalides) {
    const r = R.prolonger({ ...etat(), physx }, .175, c, out);
    assert.equal(r.physx, null); assert.deepEqual(historique(r), historique(reference));
  }
  for (const physx of [physique(), new Float32Array(physique()), new Float64Array(physique())]) assert.ok(R.prolonger({ ...etat(), physx }, 0, c).physx);
});

test('source PhysX malformée et payload altéré ne contaminent pas le paquet historique', () => {
  const reference = R.emballer(100, [vehicule(7)]);
  for (const ph of [null, {}, { ...source(physique()), offsets: [0] }, { ...source(physique()), groundCount: 1.5 }, { ...source(physique()), velocity: [NaN, 0, 0] }]) {
    const v = vehicule(7); v.etat._physx = ph;
    assert.deepEqual(Buffer.from(R.emballer(100, [v])), Buffer.from(reference));
  }
  for (let i = 0; i < 11; i++) {
    const buf = R.emballer(100, [vehicule(7, physique())]);
    new DataView(buf).setFloat32(reference.byteLength + 4 + 4 * i, NaN, true);
    const e = R.deballer(buf).voitures[0];
    assert.equal(e.physx, undefined); assert.equal(R.prolonger(e, .1, c).physx, null);
  }
});

test('queue tronquée, inconnue, indices hors borne ou dupliqués : retour au préfixe intact', () => {
  const voitures = [vehicule(7, physique()), vehicule(3, physique())], buf = R.emballer(100, voitures), base = 10 + 2 * 61;
  const legacy = R.deballer(buf.slice(0, base));
  for (const fin of [base + 1, base + 2, base + 3, buf.byteLength - 1]) assert.deepEqual(R.deballer(buf.slice(0, fin)), legacy);
  for (const [offset, valeur] of [[base, 0], [base + 1, 2], [base + 2, 3], [base + 3, 2], [base + 3 + 45, 0]]) {
    const mauvais = buf.slice(0); new DataView(mauvais).setUint8(offset, valeur);
    assert.deepEqual(R.deballer(mauvais), legacy);
  }
});

test('prédictions historiques figées : aucun écart numérique sans extension ou après rejet', () => {
  const attendus = [
    [.175, 43.76320430849944, 2.199107244648409, .21915756984050416],
    [-.065, 37.23410370734183, .8503469990343351, .1928612740486069],
    [9, 48.54148815745168, 3.287980304704788, .23820958289783878],
    [-9, 36.283987706256454, .6672353928501339, .18901208605620448]
  ];
  for (const [dt, s, d, psi] of attendus) for (const physx of [undefined, [1, 2]]) {
    const original = etat(), r = R.prolonger({ ...original, physx }, dt, c);
    assert.deepEqual(historique(r), { ...original, s, d, psi }); assert.equal(r.physx, null);
  }
});
