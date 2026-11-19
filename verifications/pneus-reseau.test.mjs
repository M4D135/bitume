// 12F3 : instantanés de pneus autorisés, atomiques et réparables après une reprise par l'hôte.
import '../src/pneus-reseau.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const P = globalThis.BITUME.pneus, R = globalThis.BITUME.pneusReseau;
const SEANCE = 'essai|12F3', HUM = [0, 0, 1, 1].map(machine => ({ machine }));
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }
function monde(machine, humains = HUM, nombre = 8) {
  const ctx = R.creer({ seance: SEANCE, machine, humains, nombre });
  assert.ok(ctx);
  const voitures = Array.from({ length: nombre }, (_, id) => ({ id,
    distant: ctx.autorites[id] !== machine, joueur: ctx.autorites[id] === machine && id < humains.length,
    livree: { numero: id + 1, pneus: 'slicks' },
    etat: { ...P.creerEtat('slicks', { seance: SEANCE, voiture: id }), v: 41, volant: -.3, degats: { choc: .4 } }
  }));
  return { ctx, voitures };
}
function instantane(e) {
  return structuredClone({ versionPneus: e.versionPneus, pneus: e.pneus, servicePneus: e.servicePneus, etatPneus: e.etatPneus });
}
function user(v, base = .17) {
  for (const [i, r] of v.etat.etatPneus.entries()) Object.assign(r, {
    usure: base + .1 * i, salete: .07 + .11 * i, grainage: .23 + .06 * i,
    distance: 1037.452 + 23.19 * i, sollicitation: 84.264 + 17.05 * i
  });
}
function service(v, type, revision) {
  Object.assign(v.etat, P.normaliserEtat({ pneus: type, servicePneus: revision }, { seance: SEANCE, voiture: v.id }));
}
function proche(a, b, marge) { assert.ok(Math.abs(a - b) <= marge + 1e-10, `${a} / ${b} : marge ${marge}`); }
function conformes(source, cible) {
  assert.equal(cible.pneus, source.pneus); assert.equal(cible.servicePneus, source.servicePneus);
  for (let i = 0; i < 4; i++) {
    const a = source.etatPneus[i], b = cible.etatPneus[i];
    for (const k of ['usure', 'salete', 'grainage']) proche(a[k], b[k], .5 / R.QUANTIFICATION);
    for (const k of ['distance', 'sollicitation']) proche(a[k], b[k], .005);
    assert.equal(a.graine, b.graine);
  }
}

verifier('contextes 2+2, 2+1, 1+2 et quatre machines : autorités, IA et tableaux indépendants', () => {
  for (const origines of [[0, 0, 1, 1], [0, 0, 1], [0, 1, 1], [0, 1, 2, 3]]) {
    const humains = origines.map(machine => ({ machine }));
    const copie = structuredClone(humains);
    for (const machine of new Set(origines)) {
      const { ctx } = monde(machine, humains);
      assert.deepEqual(ctx.autorites, [...origines, ...new Array(8 - origines.length).fill(0)]);
      assert.notEqual(ctx.autorites, ctx.origines);
      assert.deepEqual(ctx.epochs, new Array(8).fill(0));
      assert.deepEqual([...ctx.reprises], []); assert.deepEqual([...ctx.resynchronisations], []);
    }
    assert.deepEqual(humains, copie);
  }
  const a = monde(0).ctx, b = monde(0).ctx;
  a.autorites[2] = 0; a.epochs[2] = 1; a.reprises.add(1);
  assert.equal(a.origines[2], 1); assert.equal(b.autorites[2], 1); assert.equal(b.epochs[2], 0);
  assert.equal(b.reprises.size, 0);
});

verifier('configuration refusée sans inventer une séance, un pilote ou un propriétaire', () => {
  const valide = { seance: SEANCE, machine: 0, humains: HUM, nombre: 8 };
  const invalide = [null, [], {}, ...['', 'x'.repeat(129), null, 32].map(seance => ({ ...valide, seance })),
    ...[-1, .5, 256, NaN, '0', 3].map(machine => ({ ...valide, machine })),
    ...[0, 3, 257, NaN, '8'].map(nombre => ({ ...valide, nombre })),
    ...[[], [null], [{ machine: 1 }], [{ machine: -1 }], [{ machine: 0 }, { machine: '__proto__' }],
      [{ machine: 0 }, { machine: 0 }, { machine: 0 }], new Array(2),
      [Object.create({ machine: 0 })]].map(humains => ({ ...valide, humains }))];
  for (const o of invalide) assert.equal(R.creer(o), null);
});

verifier('seules les voitures conduites par leur autorité partent ; aucune mutation de leur état', () => {
  const h = monde(0), i = monde(1), avantH = structuredClone(h.voitures), avantI = structuredClone(i.voitures);
  const mh = R.encoder(h.ctx, h.voitures), mi = R.encoder(i.ctx, i.voitures, 'pneus-service');
  assert.deepEqual(mh.voitures.map(l => l[0]), [0, 1, 4, 5, 6, 7]);
  assert.deepEqual(mi.voitures.map(l => l[0]), [2, 3]);
  assert.deepEqual(mh.reprises, []); assert.equal(Object.hasOwn(mi, 'reprises'), false);
  assert.equal(mh.t, 'pneus-etat'); assert.equal(mi.t, 'pneus-service'); assert.equal(mh.version, 1);
  assert.ok(mh.voitures.every(l => l.length === 29 && l[2] === 1 && l[3] === 0));
  assert.deepEqual(h.voitures, avantH); assert.deepEqual(i.voitures, avantI);
  assert.equal(R.encoder(i.ctx, [i.voitures[0]]), null);
  i.voitures[2].distant = true;
  assert.deepEqual(R.encoder(i.ctx, i.voitures).voitures.map(l => l[0]), [3]);
  assert.equal(R.encoder(i.ctx, i.voitures).voitures[0][2], 3, 'séquence propre à chaque voiture');
});

verifier('quatre types et quatre roues : graines exactes, facteurs sur 16 bits et compteurs au centième', () => {
  for (const type of P.TYPES_JOUABLES) {
    const h = monde(0), i = monde(1), a = h.voitures[0], b = i.voitures[0];
    service(a, type, 3); user(a); a.etat.etatPneus[0].graine = 0; a.etat.etatPneus[3].graine = 0xffffffff;
    const ancienEtat = b.etat, anciennesRoues = b.etat.etatPneus, copie = structuredClone(anciennesRoues);
    const degats = b.etat.degats, livree = b.livree;
    const m = JSON.parse(JSON.stringify(R.encoder(h.ctx, [a])));
    assert.deepEqual(R.recevoir(i.ctx, m, 0, i.voitures), [0]);
    conformes(a.etat, b.etat);
    assert.equal(b.etat, ancienEtat); assert.equal(b.etat.degats, degats); assert.equal(b.livree, livree);
    assert.equal(b.etat.v, 41); assert.equal(b.etat.volant, -.3); assert.equal(b.livree.pneus, type);
    assert.equal(Object.hasOwn(b.etat, 'stands'), false);
    assert.notEqual(b.etat.etatPneus, anciennesRoues); assert.deepEqual(anciennesRoues, copie);
    assert.equal(new Set(b.etat.etatPneus).size, 4);
    m.voitures[0][5] = 0; assert.ok(b.etat.etatPneus[0].usure > 0);
    b.etat.etatPneus[0].usure = 1; assert.notEqual(a.etat.etatPneus[0].usure, 1);
    assert.notEqual(b.etat.etatPneus[1].usure, 1);
  }
});

verifier('bornes exactes, aucun arrondi ne diminue une usure ou un cumul déjà présents', () => {
  const h = monde(0), i = monde(1), a = h.voitures[0], b = i.voitures[0];
  user(a); Object.assign(b.etat, structuredClone(a.etat));
  a.etat.etatPneus[0].usure = b.etat.etatPneus[0].usure = .40000001;
  a.etat.etatPneus[0].distance = b.etat.etatPneus[0].distance = 100.004;
  a.etat.etatPneus[0].sollicitation = b.etat.etatPneus[0].sollicitation = 80.004;
  Object.assign(a.etat.etatPneus[3], { usure: 1, salete: 1, grainage: 1, distance: P.DISTANCE_MAX, sollicitation: P.SOLLICITATION_MAX });
  const avant = instantane(b.etat), m = R.encoder(h.ctx, [a]);
  assert.deepEqual(R.recevoir(i.ctx, m, 0, i.voitures), [0]);
  for (let r = 0; r < 4; r++) for (const k of ['usure', 'distance', 'sollicitation']) assert.ok(b.etat.etatPneus[r][k] >= avant.etatPneus[r][k]);
  assert.equal(b.etat.etatPneus[3].usure, 1); assert.equal(b.etat.etatPneus[3].distance, P.DISTANCE_MAX);
  assert.equal(b.etat.etatPneus[3].sollicitation, P.SOLLICITATION_MAX);
});

verifier('un état source invalide ne consomme aucune séquence et ne normalise aucun pneu', () => {
  for (const changer of [e => { e.versionPneus = 2; }, e => { e.pneus = '__proto__'; }, e => { e.servicePneus = -1; },
    e => { e.etatPneus.pop(); }, e => { delete e.etatPneus[2]; }, e => { e.etatPneus[1].graine = 2 ** 32; },
    ...['usure', 'salete', 'grainage', 'distance', 'sollicitation'].flatMap(k =>
      [NaN, Infinity, -1, '0'].map(valeur => e => { e.etatPneus[3][k] = valeur; }))]) {
    const h = monde(0); changer(h.voitures[1].etat);
    const avant = structuredClone(h.voitures);
    assert.equal(R.encoder(h.ctx, h.voitures), null);
    assert.deepEqual(h.ctx.sequencesEnvoi, new Array(8).fill(0)); assert.deepEqual(h.voitures, avant);
  }
  const h = monde(0);
  assert.equal(R.encoder(h.ctx, h.voitures, 'pneus-inconnu'), null);
  assert.equal(R.encoder(h.ctx, [h.voitures[0], h.voitures[0]]), null);
  h.ctx.sequencesEnvoi[1] = Number.MAX_SAFE_INTEGER;
  assert.equal(R.encoder(h.ctx, h.voitures), null); assert.equal(h.ctx.sequencesEnvoi[0], 0);
});

verifier('paquet malformé : aucune roue, séquence ou reprise partiellement appliquée', () => {
  const mutations = [m => { m.version = 2; }, m => { m.seance += '-ancienne'; }, m => { m.t = 'etat'; },
    m => { delete m.reprises; }, m => { m.reprises = [0]; }, m => { m.reprises = [7]; },
    m => { m.reprises = [1, 1]; }, m => { m.reprises = ['1']; }, m => { m.reprises = new Array(1); },
    m => { m.voitures.push(structuredClone(m.voitures[0])); }, m => { m.voitures[1].pop(); },
    m => { m.voitures[1].push(0); }, m => { delete m.voitures[1][14]; }, m => { delete m.voitures[1]; },
    m => { m.voitures[1][0] = 8; }, m => { m.voitures[1][1] = -1; }, m => { m.voitures[1][2] = 0; },
    m => { m.voitures[1][2] = Number.MAX_SAFE_INTEGER + 1; }, m => { m.voitures[1][3] = 2; },
    m => { m.voitures[1][4] = 4; }, m => { m.voitures[1][5] = 65536; },
    m => { m.voitures[1][8] = P.DISTANCE_MAX * 100 + 1; }, m => { m.voitures[1][10] = 2 ** 32; },
    ...[NaN, Infinity, -.5, .5, '1', null, {}].map(valeur => m => { m.voitures[1][27] = valeur; })];
  for (const changer of mutations) {
    const h = monde(0), i = monde(1); user(h.voitures[0]); user(h.voitures[1]);
    const m = R.encoder(h.ctx, [h.voitures[0], h.voitures[1]]); m.reprises = [1]; changer(m);
    const contexte = structuredClone(i.ctx), voitures = structuredClone(i.voitures);
    assert.deepEqual(R.recevoir(i.ctx, m, 0, i.voitures), []);
    assert.deepEqual(i.ctx, contexte); assert.deepEqual(i.voitures, voitures);
  }
});

verifier('séance, expéditeur et autorité : ni autre invité, ni IA usurpée, ni humain local écrasé', () => {
  const humains = [0, 1, 2, 3].map(machine => ({ machine }));
  const h = monde(0, humains), a = monde(1, humains), b = monde(2, humains);
  user(a.voitures[1]);
  const m = R.encoder(a.ctx, a.voitures), avant = structuredClone(h.voitures);
  for (const de of [0, 2, 3, 7, -1, NaN, '1']) assert.deepEqual(R.recevoir(h.ctx, m, de, h.voitures), []);
  assert.deepEqual(h.voitures, avant);
  const usurpation = structuredClone(m); usurpation.voitures[0][0] = 4;
  assert.deepEqual(R.recevoir(h.ctx, usurpation, 1, h.voitures), []);
  assert.equal(h.voitures[4].etat.etatPneus[0].usure, 0);
  assert.deepEqual(R.recevoir(b.ctx, m, 1, b.voitures), [1]);
  assert.deepEqual(R.recevoir(a.ctx, m, 1, a.voitures), []);
  const local = h.voitures[1]; local.distant = false; const avantLocal = structuredClone(local);
  assert.deepEqual(R.recevoir(h.ctx, m, 1, h.voitures), []); assert.deepEqual(local, avantLocal);
  local.distant = true;
  const annonce = structuredClone(m); annonce.reprises = [2];
  assert.deepEqual(R.recevoir(h.ctx, annonce, 1, h.voitures), []); assert.equal(h.ctx.reprises.size, 0);
});

verifier('un même service garde type et graines ; l’usure et les cumuls avancent, la saleté peut partir', () => {
  const h = monde(0), i = monde(1); user(h.voitures[0]);
  assert.deepEqual(R.recevoir(i.ctx, R.encoder(h.ctx, [h.voitures[0]]), 0, i.voitures), [0]);
  const m = R.encoder(h.ctx, [h.voitures[0]]), avant = instantane(i.voitures[0].etat);
  for (const changer of [l => { l[4] = 3; }, l => { l[10] = (l[10] + 1) >>> 0; },
    ...[5, 8, 9, 23, 26, 27].map(k => l => { l[k]--; })]) {
    const interdit = structuredClone(m); changer(interdit.voitures[0]);
    assert.deepEqual(R.recevoir(i.ctx, interdit, 0, i.voitures), []);
    assert.deepEqual(instantane(i.voitures[0].etat), avant); assert.equal(i.ctx.sequencesRecues[0], 1);
  }
  for (let k = 5; k < 29; k += 6) { m.voitures[0][k]++; m.voitures[0][k + 1] = 0; m.voitures[0][k + 2] = 0; }
  assert.deepEqual(R.recevoir(i.ctx, m, 0, i.voitures), [0]);
  assert.ok(i.voitures[0].etat.etatPneus.every(r => r.salete === 0 && r.grainage === 0));
});

verifier('service et instantané dans les deux ordres, doublons et saut de plusieurs services', () => {
  for (const ordre of ['service-dabord', 'instantane-dabord']) {
    const h = monde(0), i = monde(1), a = h.voitures[0], b = i.voitures[0];
    user(a, .55); assert.deepEqual(R.recevoir(i.ctx, R.encoder(h.ctx, [a]), 0, i.voitures), [0]);
    service(a, 'neige', 4);
    const fini = R.encoder(h.ctx, [a], 'pneus-service'); user(a, .07);
    const suivant = R.encoder(h.ctx, [a]);
    b.etat.stands = { phase: 'voie', personnel: true }; const stands = b.etat.stands;
    if (ordre === 'service-dabord') assert.deepEqual(R.recevoir(i.ctx, fini, 0, i.voitures), [0]);
    assert.deepEqual(R.recevoir(i.ctx, suivant, 0, i.voitures), [0]);
    const avant = instantane(b.etat), roues = b.etat.etatPneus;
    for (const vieux of [fini, suivant, fini]) assert.deepEqual(R.recevoir(i.ctx, vieux, 0, i.voitures), []);
    assert.deepEqual(instantane(b.etat), avant); assert.equal(b.etat.etatPneus, roues); assert.equal(b.etat.stands, stands);
    conformes(a.etat, b.etat); assert.equal(b.etat.servicePneus, 4); assert.equal(b.etat.pneus, 'neige');
    const vieuxService = structuredClone(suivant); vieuxService.voitures[0][1] = 3; vieuxService.voitures[0][2] = 900;
    assert.deepEqual(R.recevoir(i.ctx, vieuxService, 0, i.voitures), []); assert.deepEqual(instantane(b.etat), avant);
  }
});

verifier('séquences indépendantes : une ligne périmée ne bloque pas une autre voiture valide', () => {
  const h = monde(0), i = monde(1); user(h.voitures[0]); user(h.voitures[1]);
  const m = R.encoder(h.ctx, [h.voitures[0], h.voitures[1]]);
  assert.deepEqual(R.recevoir(i.ctx, { ...m, voitures: [m.voitures[0]] }, 0, i.voitures), [0]);
  assert.deepEqual(R.recevoir(i.ctx, m, 0, i.voitures), [1]);
  assert.deepEqual(i.ctx.sequencesRecues.slice(0, 2), [1, 1]);
  assert.deepEqual(R.recevoir(i.ctx, m, 0, i.voitures), []);
});

verifier('reprise 2+2 : état reçu conservé, epoch nouveau, séquence 1 après une séquence ancienne élevée', () => {
  const h = monde(0), i = monde(1); service(i.voitures[2], 'pluie', 3); user(i.voitures[2]); user(i.voitures[3]);
  i.ctx.sequencesEnvoi[2] = 700; i.ctx.sequencesEnvoi[3] = 300;
  const ancienProprietaire = R.encoder(i.ctx, i.voitures);
  assert.deepEqual(R.recevoir(h.ctx, ancienProprietaire, 1, h.voitures), [2, 3]);
  const pneus = h.voitures.map(v => instantane(v.etat)), roues = h.voitures[2].etat.etatPneus;
  assert.deepEqual(R.reprendre(h.ctx, 1), [2, 3]);
  assert.deepEqual(h.voitures.map(v => instantane(v.etat)), pneus); assert.equal(h.voitures[2].etat.etatPneus, roues);
  assert.deepEqual(h.ctx.autorites, new Array(8).fill(0)); assert.deepEqual(h.ctx.epochs, [0, 0, 1, 1, 0, 0, 0, 0]);
  assert.equal(h.ctx.sequencesRecues[2], 0); assert.deepEqual(R.reprendre(h.ctx, 1), []);
  for (const id of [2, 3]) { h.voitures[id].distant = false; h.voitures[id].reprise = true; }
  const relais = R.encoder(h.ctx, h.voitures);
  assert.deepEqual(relais.reprises, [1]); assert.equal(relais.voitures.find(l => l[0] === 2)[2], 1);
  // Une nouvelle copie distante a déjà reçu la séquence 701 de l'ancien propriétaire.
  const peer = monde(1); peer.voitures[2].distant = peer.voitures[3].distant = true;
  Object.assign(peer.voitures[2].etat, structuredClone(h.voitures[2].etat));
  Object.assign(peer.voitures[3].etat, structuredClone(h.voitures[3].etat));
  peer.ctx.sequencesRecues[2] = 701; peer.ctx.sequencesRecues[3] = 301;
  assert.deepEqual(R.recevoir(peer.ctx, relais, 0, peer.voitures), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(peer.ctx.sequencesRecues[2], 1); assert.equal(peer.ctx.epochs[2], 1);
  const apres = instantane(peer.voitures[2].etat);
  assert.deepEqual(R.recevoir(peer.ctx, relais, 0, peer.voitures), []); assert.equal(peer.ctx.sequencesRecues[2], 1);
  ancienProprietaire.voitures[0][2] = 10000;
  assert.deepEqual(R.recevoir(h.ctx, ancienProprietaire, 1, h.voitures), []);
  assert.deepEqual(instantane(peer.voitures[2].etat), apres); conformes(i.voitures[2].etat, h.voitures[2].etat);
  assert.deepEqual(R.reprendre(i.ctx, 1), []); assert.deepEqual(R.reprendre(h.ctx, 0), []); assert.deepEqual(R.reprendre(h.ctx, 9), []);
});

verifier('trois machines : une reprise manquée est réparée par la liste cumulative ; ancien invité ignoré', () => {
  const humains = [0, 1, 1, 2].map(machine => ({ machine }));
  const h = monde(0, humains), a = monde(1, humains), b = monde(2, humains);
  service(a.voitures[1], 'inter', 2); user(a.voitures[1]); user(a.voitures[2]);
  const ancien = R.encoder(a.ctx, a.voitures);
  assert.deepEqual(R.recevoir(h.ctx, ancien, 1, h.voitures), [1, 2]);
  assert.deepEqual(R.recevoir(b.ctx, ancien, 1, b.voitures), [1, 2]);
  const avant = b.voitures.slice(1, 3).map(v => instantane(v.etat));
  assert.deepEqual(R.reprendre(h.ctx, 1), [1, 2]);
  for (const id of [1, 2]) { h.voitures[id].distant = false; h.voitures[id].reprise = true; }
  R.encoder(h.ctx, h.voitures); // premier avis perdu
  const arrive = R.encoder(h.ctx, h.voitures);
  assert.ok(R.recevoir(b.ctx, arrive, 0, b.voitures).includes(1));
  assert.deepEqual(b.voitures.slice(1, 3).map(v => instantane(v.etat)), avant);
  assert.equal(b.ctx.sequencesRecues[1], 2); assert.equal(b.ctx.autorites[1], 0);
  const vieux = structuredClone(ancien); vieux.voitures.forEach(l => { l[2] = 9999; });
  assert.deepEqual(R.recevoir(b.ctx, vieux, 1, b.voitures), []);
  const suite = R.encoder(h.ctx, h.voitures);
  assert.ok(R.recevoir(b.ctx, suite, 0, b.voitures).includes(1)); assert.equal(b.ctx.sequencesRecues[1], 3);
  assert.deepEqual([...b.ctx.reprises], [1]);
});

verifier('reprise conservatrice : service ou usure plus récents chez le pair préservés et signalés', () => {
  const humains = [0, 1, 2].map(machine => ({ machine }));
  for (const changer of [v => { service(v, 'neige', 4); user(v); }, v => { v.etat.etatPneus[3].usure += .1; },
    v => { v.etat.etatPneus[3].distance += 2; }, v => { v.etat.etatPneus[3].sollicitation += 2; }]) {
    const h = monde(0, humains), b = monde(2, humains);
    service(h.voitures[1], 'inter', 3); user(h.voitures[1]);
    Object.assign(b.voitures[1].etat, structuredClone(h.voitures[1].etat)); changer(b.voitures[1]);
    const avant = instantane(b.voitures[1].etat);
    R.reprendre(h.ctx, 1); h.voitures[1].distant = false;
    const m = R.encoder(h.ctx, [h.voitures[1]]);
    assert.deepEqual(R.recevoir(b.ctx, m, 0, b.voitures), []);
    assert.deepEqual(instantane(b.voitures[1].etat), avant); assert.equal(b.ctx.resynchronisations.has(1), true);
    assert.equal(b.ctx.autorites[1], 0); assert.equal(b.ctx.sequencesRecues[1], 0);
    Object.assign(h.voitures[1].etat, structuredClone(b.voitures[1].etat));
    assert.deepEqual(R.recevoir(b.ctx, R.encoder(h.ctx, [h.voitures[1]]), 0, b.voitures), [1]);
    assert.equal(b.ctx.resynchronisations.has(1), false); conformes(h.voitures[1].etat, b.voitures[1].etat);
  }
});

verifier('service perdu côté pair puis reprise : la chaîne invité → hôte → pair conserve la monte et son usure', () => {
  const humains = [0, 1, 1, 2].map(machine => ({ machine }));
  const h = monde(0, humains), a = monde(1, humains), b = monde(2, humains);
  user(a.voitures[1], .6);
  const avantService = R.encoder(a.ctx, [a.voitures[1]]);
  assert.deepEqual(R.recevoir(h.ctx, avantService, 1, h.voitures), [1]);
  assert.deepEqual(R.recevoir(b.ctx, avantService, 1, b.voitures), [1]); // relais validé par l'hôte
  assert.equal(P.remplacerEtat(a.voitures[1].etat, 'pluie', { seance: SEANCE, voiture: 1 }, 0), true);
  const fini = R.encoder(a.ctx, [a.voitures[1]], 'pneus-service');
  assert.deepEqual(R.recevoir(h.ctx, fini, 1, h.voitures), [1]); // relais perdu côté b
  user(a.voitures[1], .19);
  assert.deepEqual(R.recevoir(h.ctx, R.encoder(a.ctx, [a.voitures[1]]), 1, h.voitures), [1]);
  const monteReçue = instantane(h.voitures[1].etat);
  assert.equal(b.voitures[1].etat.servicePneus, 0); assert.equal(b.voitures[1].etat.pneus, 'slicks');
  assert.deepEqual(R.reprendre(h.ctx, 1), [1, 2]);
  h.voitures[1].distant = false; h.voitures[1].reprise = true;
  const reprise = R.encoder(h.ctx, [h.voitures[1]]);
  assert.deepEqual(instantane(h.voitures[1].etat), monteReçue);
  assert.deepEqual(R.recevoir(b.ctx, reprise, 0, b.voitures), [1]);
  conformes(a.voitures[1].etat, b.voitures[1].etat);
  assert.equal(b.voitures[1].etat.servicePneus, 1); assert.equal(b.voitures[1].etat.pneus, 'pluie');
  assert.ok(b.voitures[1].etat.etatPneus.every(r => r.usure > .18 && r.distance > 1000));
  assert.equal(b.ctx.resynchronisations.size, 0);
  const apres = instantane(b.voitures[1].etat);
  assert.deepEqual(R.recevoir(b.ctx, reprise, 0, b.voitures), []); assert.deepEqual(instantane(b.voitures[1].etat), apres);
});

verifier('voiture reprise devenue locale : une annonce ne peut écraser les pneus conduits ici', () => {
  const h = monde(0), i = monde(1), avant = structuredClone(i.voitures[2]);
  R.reprendre(h.ctx, 1); h.voitures[2].distant = false; service(h.voitures[2], 'neige', 8);
  const m = R.encoder(h.ctx, [h.voitures[2]]);
  assert.deepEqual(R.recevoir(i.ctx, m, 0, i.voitures), []);
  assert.deepEqual(i.voitures[2], avant); assert.equal(i.ctx.autorites[2], 0);
  assert.equal(R.encoder(i.ctx, i.voitures), null, 'ancien propriétaire exclu après annonce de reprise');
});

verifier('module pur sans DOM, horloge, hasard ni appel à remplacerEtat à la réception', () => {
  const contexte = vm.createContext({ BITUME: { pneus: { ...P, remplacerEtat() { throw new Error('service local interdit'); } } } });
  vm.runInContext('Math.random = () => { throw new Error("hasard interdit"); }; Date.now = () => { throw new Error("horloge interdite"); };', contexte);
  vm.runInContext(readFileSync(new URL('../src/pneus-reseau.js', import.meta.url), 'utf8'), contexte);
  const isolé = contexte.BITUME.pneusReseau, h = monde(0), i = monde(1);
  service(h.voitures[0], 'pluie', 9); user(h.voitures[0]);
  const ctx = isolé.creer({ seance: SEANCE, machine: 1, humains: HUM, nombre: 8 });
  assert.deepEqual(Array.from(isolé.recevoir(ctx, R.encoder(h.ctx, [h.voitures[0]]), 0, i.voitures)), [0]);
  assert.equal(i.voitures[0].etat.servicePneus, 9); conformes(h.voitures[0].etat, i.voitures[0].etat);
});

console.log(controles + ' contrôles pneus réseau réussis');
