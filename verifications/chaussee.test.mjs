import '../src/circuit.js';
import '../src/saisons.js';
import '../src/chaussee.js';
import assert from 'node:assert/strict';

const B = globalThis.BITUME, C = B.chaussee;
const route = { longueur: 1000, tunnel: { debut: 200, fin: 460 } };
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };

verifier('sans météo, la chaussée est sèche ; lire ne déduit rien de la saison du circuit', () => {
  assert.deepEqual(C.lire(null, 0), { eau: 0, neige: 0, abri: false });
  assert.deepEqual(C.lire({ saison: 'hiver', theme: 'montagne' }, 0, {}), { eau: 0, neige: 0, abri: false });
  assert.deepEqual(C.lire(null, 0, { neige: true, hiver: true }), { eau: 0, neige: 0, abri: false });
});

verifier('pluie liquide et humidité résiduelle gardent leur pondération historique', () => {
  assert.equal(C.lire(route, 0, { pluie: .75, mouille: .4 }).eau, .75);
  assert.equal(C.lire(route, 0, { pluie: .1, mouille: .8 }).eau, .48);
  assert.equal(C.lire(route, 0, { pluie: 0, mouille: 1 }).eau, .6);
  assert.equal(C.lire(route, 0, { pluie: 1, mouille: 1 }).eau, 1);
});

verifier('flocons saisonniers et neige observée ne deviennent pas pluie liquide ni couverture inventée', () => {
  for (const m of [{ precipitationsNeige: true }, { reel: true, neige: true }]) {
    assert.deepEqual(C.lire(route, 0, { ...m, pluie: .9 }), { eau: 0, neige: 0, abri: false });
    assert.equal(C.lire(route, 0, { ...m, pluie: .9, mouille: .5 }).eau, .3);
  }
  assert.equal(C.lire(route, 0, { reel: true, neige: false, pluie: .9 }).eau, .9);
});

verifier('couverture explicite sans précipitation et coexistence eau/neige restent indépendantes', () => {
  assert.deepEqual(C.lire(route, 0, { neigeSol: .4 }), { eau: 0, neige: .4, abri: false });
  assert.deepEqual(C.lire(route, 0, { pluie: .5, neigeSol: .4 }), { eau: .5, neige: .4, abri: false });
  assert.deepEqual(C.lire(route, 0, { neigeSol: 0, precipitationsNeige: true, pluie: 1 }), { eau: 0, neige: 0, abri: false });
});

verifier('sous un tunnel, eau et neige sont nulles sans modifier la météo de la séance', () => {
  const m = Object.freeze({ pluie: 1, mouille: 1, neigeSol: .75 });
  assert.deepEqual(C.lire(route, 201, m), { eau: 0, neige: 0, abri: true });
  assert.deepEqual(C.lire(route, 1201, m), { eau: 0, neige: 0, abri: true });
  assert.deepEqual(C.lire(route, -799, m), { eau: 0, neige: 0, abri: true });
  assert.deepEqual(C.lire(route, 461, m), { eau: 1, neige: .75, abri: false });
});

verifier('les deux portails conservent exactement la frontière binaire historique', () => {
  const m = { pluie: .5, neigeSol: .5 };
  for (const s of [199.99, 200, 200.01, 459.99, 460, 460.01]) {
    const couvert = B.circuit.dansTunnel(route, s);
    assert.equal(C.lire(route, s, m).abri, couvert);
    assert.equal(C.lire(route, s, m).eau, couvert ? 0 : .5);
    assert.equal(C.lire(route, s, m).neige, couvert ? 0 : .5);
  }
});

verifier('valeurs invalides ignorées, nombres hors limites bornés, sans coercition implicite', () => {
  for (const invalide of [NaN, Infinity, -Infinity, '1', null, undefined, {}, true]) {
    assert.deepEqual(C.lire(route, 0, { pluie: invalide, mouille: invalide, neigeSol: invalide }),
      { eau: 0, neige: 0, abri: false });
  }
  assert.deepEqual(C.lire(route, 0, { pluie: 2, mouille: 3, neigeSol: 4 }), { eau: 1, neige: 1, abri: false });
  assert.deepEqual(C.lire(route, 0, { pluie: -1, mouille: -1, neigeSol: -1 }), { eau: 0, neige: 0, abri: false });
  for (const s of [NaN, Infinity, undefined, '250']) assert.equal(C.lire(route, s, {}).abri, false);
  for (const m of [null, undefined, false, 'pluie']) assert.deepEqual(C.lire(null, 0, m), { eau: 0, neige: 0, abri: false });
});

verifier('sortie réutilisée sans conserver une ancienne surface ; absence de mémoire entre appels', () => {
  const out = { eau: 9, neige: 9, abri: 9 }, m = Object.freeze({ pluie: .75, neigeSol: .5 });
  assert.equal(C.lire(route, 0, m, out), out);
  assert.deepEqual(out, { eau: .75, neige: .5, abri: false });
  assert.equal(C.lire(route, 250, m, out), out);
  assert.deepEqual(out, { eau: 0, neige: 0, abri: true });
  assert.equal(C.lire(route, 0, {}, out), out);
  assert.deepEqual(out, { eau: 0, neige: 0, abri: false });
  assert.notEqual(C.lire(route, 0, m), C.lire(route, 0, m));
});

verifier('sans argument météo, lecture de l’état actif ; une météo explicite garde priorité', () => {
  const ancien = B.meteo;
  try {
    B.meteo = { actuel: { pluie: .75, neigeSol: .25 } };
    assert.deepEqual(C.lire(route, 0), { eau: .75, neige: .25, abri: false });
    assert.deepEqual(C.lire(route, 0, { pluie: .2 }), { eau: .2, neige: 0, abri: false });
    assert.deepEqual(C.lire(route, 0, null), { eau: 0, neige: 0, abri: false });
  } finally { B.meteo = ancien; }
});

verifier('préparation hivernale initialise la couverture du paysage ; les autres saisons restent sans neige', () => {
  for (const theme of ['foret', 'montagne', 'islande', 'desert', 'asie', 'pacifique']) {
    const m = { pluie: .75 }, p = B.saisons.profil('hiver', theme);
    assert.equal(C.preparer(m, p), m);
    assert.equal(m.neigeSol, .75);
    assert.equal(m.precipitationsNeige, true);
    assert.deepEqual(C.lire(route, 0, m), { eau: 0, neige: .75, abri: false });
  }
  for (const saison of ['printemps', 'ete', 'automne']) {
    const m = C.preparer({}, B.saisons.profil(saison, 'montagne'));
    assert.equal(m.neigeSol, 0);
    assert.equal(m.precipitationsNeige, false);
  }
});

verifier('Port-Sable reste sans couverture et sans neige saisonnière, même avec un état reçu enneigé', () => {
  for (const m of [{}, { neigeSol: 1 }, { reel: true, neige: true, neigeSol: .9 }]) {
    C.preparer(m, B.saisons.profil('hiver', 'cote'));
    assert.equal(m.neigeSol, 0);
    assert.equal(m.precipitationsNeige, false);
    assert.equal(C.lire(null, 0, m).neige, 0);
  }
  const pluieSud = C.preparer({ reel: true, neige: true, pluie: .75 }, B.saisons.profil('hiver', 'cote'));
  assert.equal(C.lire(null, 0, pluieSud).eau, .75, 'l’interdiction explicite des flocons prime au Sud');
});

verifier('météo réelle : flocons observés sans inventer une couverture ; hiver sans flocons garde son paysage', () => {
  const ete = C.preparer({ reel: true, neige: true, pluie: .7 }, B.saisons.profil('ete', 'foret'));
  assert.deepEqual(C.lire(route, 0, ete), { eau: 0, neige: 0, abri: false });
  assert.equal(ete.precipitationsNeige, true);
  const hiver = C.preparer({ reel: true, neige: false, pluie: .7 }, B.saisons.profil('hiver', 'foret'));
  assert.deepEqual(C.lire(route, 0, hiver), { eau: .7, neige: .75, abri: false });
  assert.equal(hiver.precipitationsNeige, false);
});

verifier('couverture explicite de l’hôte conservée, y compris zéro, avec une reprise JSON déterministe', () => {
  for (const [source, attendu] of [[0, 0], [.3, .3], [1.7, 1], [-.2, 0]]) {
    const hote = C.preparer({ neigeSol: source }, B.saisons.profil('hiver', 'foret'));
    const invite = C.preparer(JSON.parse(JSON.stringify(hote)), B.saisons.profil('hiver', 'foret'));
    assert.equal(hote.neigeSol, attendu);
    assert.deepEqual(C.lire(route, 0, invite), C.lire(route, 0, hote));
  }
  for (const neigeSol of [NaN, Infinity, '0.3', null]) {
    assert.equal(C.preparer({ neigeSol }, B.saisons.profil('hiver', 'montagne')).neigeSol, .75);
  }
  assert.deepEqual(C.preparer(null, null), { precipitationsNeige: false, neigeSol: 0 });
});

verifier('une lecture répétée ne fait ni fondre ni accumuler la neige et ne fait pas avancer la météo', () => {
  const m = Object.freeze({ pluie: .75, mouille: .2, neigeSol: .6, precipitationsNeige: true, t: 37 });
  const out = {};
  for (let i = 0; i < 10000; i++) C.lire(route, i % 200, m, out);
  assert.deepEqual(out, { eau: .12, neige: .6, abri: false });
  assert.equal(m.t, 37);
});

console.log(`chaussee : ${n} vérifications passées`);
