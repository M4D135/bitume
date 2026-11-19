import '../src/pneus.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const P = globalThis.BITUME.pneus;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

verifier('ordre AVG, AVD, ARG, ARD : gauche/droite et essieux gardent les indices du jeu', () => {
  assert.deepEqual(P.ORDRE_ROUES, ['AVG', 'AVD', 'ARG', 'ARD']);
  assert.deepEqual(P.NOMS_ROUES, ['roue avant gauche', 'roue avant droite', 'roue arrière gauche', 'roue arrière droite']);
  for (const [i, r] of P.ROUES.entries()) {
    assert.equal(r.indice, i);
    assert.equal(P.INDICES_ROUES[r.id], i);
    assert.equal(Math.sign(r.z), i % 2 ? 1 : -1);
    assert.equal(r.cote, Math.sign(r.z));
    assert.equal(r.avant, i < 2);
  }
  assert.equal(P.ROUES[0].x - P.ROUES[2].x, 2.7);
  assert.equal(P.ROUES[0].r, .29);
  assert.equal(P.ROUES[0].l, .28);
  assert.equal(P.ROUES[2].r, .335);
  assert.equal(P.ROUES[2].l, .46);
});

verifier('quatre types définis ; anciennes préférences intactes et neige réservée au lot physique', () => {
  assert.deepEqual(P.TYPES, ['slicks', 'inter', 'pluie', 'neige']);
  assert.deepEqual(P.TYPES_JOUABLES, ['slicks', 'inter', 'pluie']);
  for (const type of P.TYPES) {
    assert.equal(P.normaliserType(type), type);
    assert.equal(P.lire(type).id, type);
    assert.equal(P.NOMS_PNEUS[type], P.lire(type).nom);
    assert.equal(P.creerEtat(type).pneus, type);
  }
  assert.equal(P.lire('slicks').rainures, 0);
  assert.equal(P.lire('neige').adherence, null);
  assert.equal(P.estJouable('neige'), false);
  assert.equal(P.estJouable('inter'), true);
});

verifier('les trois coefficients de p9 restent identiques au catalogue publié', () => {
  assert.deepEqual(P.PNEUS, { slicks: [1, -.30], inter: [.96, -.10], pluie: [.88, .07] });
  assert.deepEqual(Object.keys(P.PNEUS), ['slicks', 'inter', 'pluie']);
  for (const type of P.TYPES_JOUABLES) assert.equal(P.lire(type).adherence, P.PNEUS[type]);
});

verifier('catalogue partagé immuable et types invalides sans accès au prototype', () => {
  for (const type of [null, undefined, 3, {}, 'constructor', '__proto__', 'toString', '']) {
    assert.equal(P.estType(type), false);
    assert.equal(P.normaliserType(type), 'slicks');
    assert.equal(P.lire(type).id, 'slicks');
    assert.equal(P.estJouable(type), false);
  }
  assert.equal(P.normaliserType('inconnu', 'pluie'), 'pluie');
  assert.equal(P.normaliserType('inconnu', 'constructor'), 'slicks');
  assert.throws(() => { P.CATALOGUE.slicks.cercle[0] = 0; }, TypeError);
  assert.throws(() => { P.ROUES[0].nom = 'droite'; }, TypeError);
  assert.throws(() => { P.PNEUS.slicks[0] = .5; }, TypeError);
});

verifier('quatre pneus neufs indépendants ; modifier une roue ne restaure ni ne salit les autres', () => {
  const e = P.creerEtat('inter', { seance: 81, voiture: 3 });
  assert.equal(e.versionPneus, 1);
  assert.equal(e.servicePneus, 0);
  assert.equal(new Set(e.etatPneus).size, 4);
  for (const r of e.etatPneus) assert.deepEqual([r.usure, r.salete, r.grainage, r.distance, r.sollicitation], [0, 0, 0, 0, 0]);
  e.etatPneus[0].usure = .7;
  e.etatPneus[0].salete = .4;
  assert.equal(e.etatPneus[1].usure, 0);
  assert.equal(e.etatPneus[1].salete, 0);
  assert.equal(P.creerEtat('inter', { seance: 81, voiture: 3 }).etatPneus[0].usure, 0);
});

verifier('motifs reproductibles, différents par roue, séance, voiture et révision de service', () => {
  const ids = { seance: 'course|12', voiture: 6 };
  const a = P.creerEtat('slicks', ids), b = P.creerEtat('slicks', ids);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.etatPneus.map(r => r.graine)).size, 4);
  assert.notDeepEqual(a.etatPneus, P.creerEtat('slicks', { ...ids, voiture: 7 }).etatPneus);
  assert.notDeepEqual(a.etatPneus, P.creerEtat('slicks', { ...ids, seance: 'autre' }).etatPneus);
  assert.notDeepEqual(a.etatPneus, P.normaliserEtat({ pneus: 'slicks', servicePneus: 1 }, ids).etatPneus);
  assert.notDeepEqual(P.creerEtat('slicks', { seance: 'a', voiture: 'b|c' }).etatPneus,
    P.creerEtat('slicks', { seance: 'a|b', voiture: 'c' }).etatPneus);
});

verifier('ancienne préférence migrée et sauvegarde JSON reproduite sans remise à neuf', () => {
  const ids = { seance: 42, voiture: 2 };
  const e = P.normaliserEtat('pluie', ids);
  assert.equal(e.pneus, 'pluie');
  e.servicePneus = 3;
  e.etatPneus[0].usure = .63;
  e.etatPneus[1].salete = .38;
  e.etatPneus[2].grainage = .12;
  e.etatPneus[3].distance = 5102;
  const copie = P.normaliserEtat(JSON.parse(JSON.stringify(e)), ids);
  assert.deepEqual(copie, e);
  assert.notEqual(copie.etatPneus[0], e.etatPneus[0]);
  copie.etatPneus[0].salete = 1;
  assert.equal(e.etatPneus[0].salete, 0);
});

verifier('état malformé borné, quatre roues finies, aucune mutation de la source', () => {
  const source = { pneus: '__proto__', servicePneus: 8.9, etatPneus: [
    { usure: 8, salete: -4, grainage: NaN, distance: Infinity, sollicitation: 9e15, graine: -1 },
    { usure: '0.4', distance: -20, graine: 0 }, null, { graine: 4294967295 }, { usure: .5 }
  ] };
  const e = P.normaliserEtat(source, { seance: 3, voiture: 4 });
  assert.equal(e.pneus, 'slicks');
  assert.equal(e.servicePneus, 8);
  assert.equal(e.etatPneus.length, 4);
  assert.deepEqual([e.etatPneus[0].usure, e.etatPneus[0].salete, e.etatPneus[0].grainage, e.etatPneus[0].distance, e.etatPneus[0].sollicitation], [1, 0, 0, 0, P.SOLLICITATION_MAX]);
  assert.equal(e.etatPneus[1].graine, 0);
  assert.equal(e.etatPneus[3].graine, 4294967295);
  assert.equal(source.etatPneus[0].usure, 8);
  assert.ok(Number.isNaN(source.etatPneus[0].grainage));
  for (const r of e.etatPneus) assert.ok(Object.values(r).every(Number.isFinite));
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(e)));
  assert.equal(P.normaliserEtat({ servicePneus: Infinity }).servicePneus, 0);
});

verifier('création et normalisation sans Math.random, générateur partagé ni accès au navigateur', () => {
  const contexte = vm.createContext({});
  vm.runInContext('Math.random = () => { throw new Error("tirage interdit"); };', contexte);
  vm.runInContext(readFileSync(new URL('../src/pneus.js', import.meta.url), 'utf8'), contexte);
  const sortie = vm.runInContext('JSON.stringify(BITUME.pneus.normaliserEtat(BITUME.pneus.creerEtat("pluie", { seance: 9, voiture: 4 })))', contexte);
  assert.equal(JSON.parse(sortie).etatPneus.length, 4);
});

await import('../src/circuit.js');
await import('../src/conduite.js');
await import('../src/degats.js');
await import('../src/course.js');
verifier('contrat commun branché dans la conduite, les avaries et chaque voiture de la grille', () => {
  const B = globalThis.BITUME;
  assert.equal(B.conduite.PNEUS, P.PNEUS);
  assert.equal(B.degats.NOMS_ROUES, P.NOMS_ROUES);
  const circuit = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const a = B.course.creer(circuit, { graine: 4242 }), b = B.course.creer(circuit, { graine: 4242 });
  assert.equal(a.voitures.length, 12);
  for (const v of a.voitures) {
    assert.equal(v.etat.etatPneus.length, 4);
    assert.deepEqual(v.etat.etatPneus, b.voitures[v.id].etat.etatPneus);
    assert.equal(v.etat.servicePneus, 0);
    assert.ok(v.etat.etatPneus.every(r => r.usure === 0 && r.distance === 0));
    assert.equal(new Set(v.etat.etatPneus.map(r => r.graine)).size, 4);
  }
  a.voitures[0].etat.etatPneus[0].usure = .4;
  assert.equal(a.voitures[1].etat.etatPneus[0].usure, 0);
  assert.equal(a.voitures[0].etat.etatPneus[1].usure, 0);
  for (let i = 0; i < 4; i++) {
    const d = B.degats.creer(); d.roues[i] = true;
    assert.ok(B.degats.avaries(d).includes(P.NOMS_ROUES[i]));
  }
});

console.log(controles + ' contrôles pneus réussis');
