// 12F1 : quatre pneus neufs seulement au terme d'un vrai arrêt, transaction atomique et reprise déterministe.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const req = createRequire(import.meta.url);
for (const nom of ['circuit', 'conduite', 'degats', 'contacts', 'course']) req('../src/' + nom + '.js');
const B = globalThis.BITUME, P = B.pneus, dt = 1 / 120;
const NEUTRE = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
const GAZ = { ...NEUTRE, gaz: 1 };
const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 }), S = c.stands;
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok ' + nom); }
function copie(e) { return structuredClone({ versionPneus: e.versionPneus, pneus: e.pneus, servicePneus: e.servicePneus, etatPneus: e.etatPneus }); }
function user(e) {
  e.etatPneus.forEach((r, i) => Object.assign(r, { usure: .25 + .15 * i, salete: .12 + .1 * i,
    grainage: .05 + .11 * i, distance: 12000 + 100 * i, sollicitation: 23000 + 200 * i }));
}
function seance(type = 'slicks', o = {}) {
  const co = B.course.creer(c, { mode: 'course', rivaux: 0, graine: 734, tours: 99, ...o });
  co.phase = 'course'; co.feux.vert = true; co.temps = co.horloge = 20;
  for (const v of co.voitures) {
    v.etat.pneus = type; v.livree.pneus = type; user(v.etat);
    placer(v, S.debut - 100, 0, 0);
  }
  return co;
}
function placer(v, s = (S.garage0 + S.garage1) / 2, d = S.d, vitesse = 0) {
  const e = v.etat, q = B.circuit.echantillon(c, s);
  Object.assign(e, { s, d, v: vitesse, psi: 0, beta: 0, omega: 0, y: q.y, distance: s });
  v.progression = s; v.passages = v.maxPassages = 0;
}
function commencer(co, v = co.joueur) {
  placer(v);
  const ev = [];
  B.course.stands(co, v, dt, ev);
  assert.equal(v.etat.stands?.phase, 'voie');
  B.course.stands(co, v, dt, ev);
  assert.equal(v.etat.stands?.phase, 'service');
  assert.ok(v.etat.stands.duree > 0);
  return ev;
}
function finir(co, v = co.joueur) {
  const ev = [];
  for (let i = 0; i < 2400 && v.etat.stands?.phase === 'service'; i++) B.course.stands(co, v, dt, ev);
  assert.equal(v.etat.stands?.phase, 'sortie');
  return ev;
}
function quitter(co, v = co.joueur) {
  v.etat.d = 0;
  B.course.stands(co, v, dt, []);
  B.course.stands(co, v, dt, []);
  assert.equal(v.etat.stands, null);
  assert.equal(v.etat.standsSortie, false);
}

verifier('transaction des quatre roues : révision attendue, état indépendant et dégâts strictement inchangés', () => {
  const ids = { seance: 734, voiture: 2 }, e = P.creerEtat('pluie', ids);
  e.degats = B.degats.creer(); B.degats.choc(e.degats, 9); user(e);
  const dg = structuredClone(e.degats), vieux = e.etatPneus, avant = structuredClone(vieux);
  assert.equal(P.remplacerEtat(e, 'pluie', ids, 0), true);
  assert.equal(e.servicePneus, 1); assert.equal(e.pneus, 'pluie');
  assert.deepEqual(e.degats, dg, 'changer les pneus ne répare pas la carrosserie');
  assert.notEqual(e.etatPneus, vieux); assert.deepEqual(vieux, avant, 'aucune remise à zéro partielle des anciens objets');
  assert.equal(new Set(e.etatPneus).size, 4);
  for (let i = 0; i < 4; i++) {
    const r = e.etatPneus[i]; assert.notEqual(r, vieux[i]); assert.notEqual(r.graine, vieux[i].graine);
    assert.deepEqual([r.usure, r.salete, r.grainage, r.distance, r.sollicitation], [0, 0, 0, 0, 0]);
  }
  const fini = copie(e), roues = e.etatPneus;
  assert.equal(P.remplacerEtat(e, 'pluie', ids, 0), false, 'ordre de fin livré deux fois');
  assert.deepEqual(copie(e), fini); assert.equal(e.etatPneus, roues);
});

verifier('commandes invalides et compteur saturé : rejet sans changement, sans conversion vers des pneus neufs', () => {
  const ids = { seance: 4, voiture: 1 };
  const cas = [
    ...['', 'constructor', '__proto__', 'inconnu', null, 2].map(type => ({ type })),
    ...[-1, .5, NaN, Infinity, '0', undefined, P.SERVICE_MAX].map(revision => ({ revision })),
    ...[-1, .5, NaN, Infinity, '0', P.SERVICE_MAX].map(service => ({ service })),
    { version: 2 }, { ids: {} }, { ids: { seance: 4, voiture: -1 } },
    { ids: { seance: .5, voiture: 1 } }, { ids: { seance: 4, voiture: Infinity } },
    { ids: { seance: '', voiture: 1 } }, { roues: [] }
  ];
  for (const casTest of cas) {
    const e = P.creerEtat('inter', ids); user(e);
    if ('service' in casTest) e.servicePneus = casTest.service;
    if ('version' in casTest) e.versionPneus = casTest.version;
    if ('roues' in casTest) e.etatPneus = casTest.roues;
    const avant = copie(e), roues = e.etatPneus;
    const type = 'type' in casTest ? casTest.type : 'inter';
    const revision = 'revision' in casTest ? casTest.revision : 0;
    assert.equal(P.remplacerEtat(e, type, casTest.ids || ids, revision), false);
    assert.deepEqual(copie(e), avant); assert.equal(e.etatPneus, roues);
  }
  const e = P.creerEtat('neige', ids); e.servicePneus = P.SERVICE_MAX - 1;
  assert.equal(P.remplacerEtat(e, 'neige', ids, P.SERVICE_MAX - 1), true);
  assert.equal(e.servicePneus, P.SERVICE_MAX);
  const avant = copie(e);
  assert.equal(P.remplacerEtat(e, 'slicks', ids, P.SERVICE_MAX), false);
  assert.deepEqual(copie(e), avant, 'le compteur ne reboucle jamais sur zéro');
});

for (const type of P.TYPES_JOUABLES) verifier(type + ' : arrêt réel, aucun pneu neuf avant terme, quatre à la fin et une seule révision', () => {
  const co = seance(type), v = co.joueur, e = v.etat;
  B.degats.choc(v.degats, 9);
  const avant = copie(e), dg = structuredClone(v.degats), vieux = e.etatPneus;
  const adherAvant = B.conduite.adherenceVoiture(e, { eau: .65, neige: .2 });
  const eNeuf = { ...e, etatPneus: P.creerEtat(type).etatPneus };
  const adherNeuf = B.conduite.adherenceVoiture(eNeuf, { eau: .65, neige: .2 });
  const ev = commencer(co), debut = { s: e.s, d: e.d };
  assert.deepEqual(copie(e), avant, 'entrer et commencer ne donne pas de gomme neuve');
  for (let k = 0; k < 2400 && e.stands.phase === 'service'; k++) {
    ev.push(...B.course.pas(co, GAZ, dt));
    assert.equal(e.s, debut.s); assert.equal(e.d, debut.d); assert.equal(e.v, 0, 'le service maintient la voiture immobile malgré le gaz');
    if (e.stands.phase === 'service') {
      assert.deepEqual(copie(e), avant); assert.equal(e.etatPneus, vieux); assert.deepEqual(v.degats, dg);
    }
  }
  assert.equal(e.stands.phase, 'sortie'); assert.equal(e.servicePneus, 1);
  assert.equal(ev.filter(x => x.type === 'stand' && x.phase === 'repare').length, 1);
  assert.equal(ev.find(x => x.phase === 'repare').servicePneus, 1);
  assert.equal(e.pneus, type); assert.equal(v.livree.pneus, type);
  assert.ok(e.etatPneus.every(r => r.usure === 0 && r.salete === 0 && r.grainage === 0 && r.distance === 0 && r.sollicitation === 0));
  assert.ok(B.conduite.adherenceVoiture(e, { eau: .65, neige: .2 }) > adherAvant);
  assert.equal(B.conduite.adherenceVoiture(e, { eau: .65, neige: .2 }), adherNeuf);
  assert.equal(B.degats.sante(v.degats), 1, 'réparation carrosserie à la même fin de service');
  const apres = copie(e);
  for (let k = 0; k < 1200; k++) B.course.stands(co, v, dt, ev);
  assert.deepEqual(copie(e), apres, 'pas de deuxième service en restant au garage');
  assert.equal(ev.filter(x => x.phase === 'repare').length, 1);
});

verifier('deux vrais services : motifs déterministes par séance/voiture/révision, sans RNG partagé', () => {
  const parcours = (graine = 734) => {
    const co = seance('inter', { graine }), v = co.joueur, motifs = [];
    for (let service = 1; service <= 2; service++) {
      commencer(co); finir(co); assert.equal(v.etat.servicePneus, service);
      motifs.push(v.etat.etatPneus.map(r => r.graine));
      quitter(co); user(v.etat);
    }
    return motifs;
  };
  const a = parcours(); assert.deepEqual(a, parcours()); assert.notDeepEqual(a[0], a[1]);
  assert.notDeepEqual(a, parcours(735));
  const contexte = vm.createContext({});
  vm.runInContext('Math.random = () => { throw Error("RNG partagé interdit"); };', contexte);
  vm.runInContext(readFileSync(new URL('../src/pneus.js', import.meta.url), 'utf8'), contexte);
  assert.equal(vm.runInContext('const p = BITUME.pneus, e = p.creerEtat("inter", {seance:734,voiture:0}); p.remplacerEtat(e,"inter",{seance:734,voiture:0},0)', contexte), true);
});

verifier('la monte du début est figée ; une préférence ultérieure ne change pas le service engagé', () => {
  const co = seance('neige'), e = co.joueur.etat;
  commencer(co); assert.equal(e.stands.pneus, 'neige');
  e.pneus = 'slicks'; // simule une préférence extérieure arrivée après le début de l'arrêt
  finir(co);
  assert.equal(e.pneus, 'neige'); assert.equal(co.joueur.livree.pneus, 'neige'); assert.equal(e.servicePneus, 1);
});

verifier('entrée seule, sortie avant garage et arrêt loin après le garage : aucun renouvellement', () => {
  const co = seance(), v = co.joueur, e = v.etat, avant = copie(e);
  placer(v, S.debut + 5, S.d, 8); B.course.stands(co, v, dt, []);
  assert.equal(e.stands.phase, 'voie'); assert.deepEqual(copie(e), avant);
  e.d = 0; B.course.stands(co, v, dt, []); assert.equal(e.stands, null); assert.deepEqual(copie(e), avant);
  for (const s of [S.debut - 100, S.fin + 100]) {
    placer(v, s); B.course.stands(co, v, dt, []);
    assert.equal(e.stands, null, 'la voie a une borne longitudinale dans les deux sens');
    assert.equal(B.course.dansLeGarage(c, e, S), false);
  }
  assert.deepEqual(copie(e), avant);
});

for (const [nom, modifier] of [
  ['avant le garage', e => { e.s = S.garage0 - 2; }],
  ['après le garage', e => { e.s = S.garage1 + 2; }],
  ['hors de la voie', e => { e.d = 0; }],
  ['poussé dans le garage', e => { e.s += .2; }],
  ['mouvement avant', e => { e.v = 1; }],
  ['mouvement arrière', e => { e.v = -1; }],
  ['accident', e => { B.conduite.declencherAccident(e); }],
  ['récupération', e => { e.recuperation = { t: 0, cause: 'choc' }; }],
  ['saut', e => { e.saut = { actif: true }; }]
]) verifier(nom + ' juste avant la fin : arrêt annulé, pneus et carrosserie conservés', () => {
  const co = seance('pluie'), v = co.joueur, e = v.etat;
  B.degats.choc(v.degats, 9); commencer(co);
  while (e.stands.t + dt < e.stands.duree) B.course.stands(co, v, dt, []);
  const avant = copie(e), dg = structuredClone(v.degats), roues = e.etatPneus;
  modifier(e);
  const ev = []; B.course.stands(co, v, dt, ev);
  assert.equal(e.stands, null); assert.ok(ev.some(x => x.phase === 'annule'));
  assert.deepEqual(copie(e), avant); assert.equal(e.etatPneus, roues); assert.deepEqual(v.degats, dg);
});

verifier('mouvement détecté avant le pas complet : le frein ne masque pas une interruption', () => {
  const co = seance(), e = co.joueur.etat; commencer(co);
  const avant = copie(e); e.v = .4;
  const ev = B.course.pas(co, { ...NEUTRE, frein: 1 }, dt);
  assert.equal(e.stands, null); assert.ok(ev.some(x => x.phase === 'annule'));
  assert.equal(e.servicePneus, 0); assert.equal(e.etatPneus[0].graine, avant.etatPneus[0].graine);
  assert.ok(e.etatPneus.every((r, i) => r.usure >= avant.etatPneus[i].usure));
});

verifier('rivaux, voitures distantes et humains repris par l’IA : aucun service local gratuit', () => {
  for (const mode of ['rival', 'distant', 'reprise']) {
    const co = seance('pluie', { rivaux: 1 }), v = co.voitures[1], e = v.etat;
    if (mode !== 'rival') v.humain = true;
    if (mode === 'distant') v.distant = true;
    if (mode === 'reprise') v.reprise = true;
    placer(v); const avant = copie(e);
    for (let i = 0; i < 1200; i++) B.course.stands(co, v, dt, []);
    assert.equal(e.stands, null); assert.deepEqual(copie(e), avant);
  }
});

verifier('deux voitures locales : renouveler l’une laisse exactement les roues et la révision de l’autre', () => {
  const co = seance('inter', { rivaux: 1, humains: { noms: ['Un', 'Deux'], locaux: [0, 1], hote: true, enLigne: false } });
  const [a, b] = co.voitures, avantB = copie(b.etat), rouesB = b.etat.etatPneus;
  commencer(co, a); finir(co, a);
  assert.equal(a.etat.servicePneus, 1); assert.deepEqual(copie(b.etat), avantB); assert.equal(b.etat.etatPneus, rouesB);
  commencer(co, b); finir(co, b); assert.equal(b.etat.servicePneus, 1);
  assert.notDeepEqual(a.etat.etatPneus.map(r => r.graine), b.etat.etatPneus.map(r => r.graine));
});

verifier('replacement direct et récupération après un service conservent compteur, graines, usure et objets', () => {
  const co = seance('neige'), v = co.joueur, e = v.etat; commencer(co); finir(co); user(e);
  const avant = copie(e), roues = e.etatPneus;
  B.conduite.replacer(e, c);
  assert.deepEqual(copie(e), avant); assert.equal(e.etatPneus, roues);
  B.conduite.declencherAccident(e);
  for (let i = 0; i < 120 && e.recuperation; i++) B.conduite.pas(e, NEUTRE, c, dt);
  assert.equal(e.recuperation, null); assert.deepEqual(copie(e), avant); assert.equal(e.etatPneus, roues);
});

verifier('révision devenue obsolète pendant le service : aucun second renouvellement ni réparation partielle', () => {
  const co = seance(), v = co.joueur, e = v.etat; B.degats.choc(v.degats, 9); commencer(co);
  assert.equal(P.remplacerEtat(e, e.pneus, { seance: co.graine, voiture: v.id }, 0), true);
  user(e); const avant = copie(e), dg = structuredClone(v.degats);
  for (let i = 0; i < 2400 && e.stands; i++) B.course.stands(co, v, dt, []);
  assert.equal(e.stands, null); assert.deepEqual(copie(e), avant); assert.deepEqual(v.degats, dg);
});

console.log(controles + ' contrôles remplacement des pneus aux stands réussis');
