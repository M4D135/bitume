// Lot 12E : domaines utiles, forces réellement transmises, anticipation IA et usure au pas fixe.
import '../src/circuit.js';
import '../src/conduite.js';
import '../src/degats.js';
import '../src/contacts.js';
import '../src/course.js';
import '../src/meteo.js';
import assert from 'node:assert/strict';

const B = globalThis.BITUME, C = B.conduite, P = B.pneus, dt = 1 / 120;
const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
const montagne = B.circuit.creer(29, { theme: 'montagne', longueur: 5200 });
const commande = { gaz: 0, frein: 0, volant: 0, aide: 0, guidage: 0, boite: 'auto' };
const surfaces = [{ eau: 0, neige: 0 }, { eau: .3, neige: 0 }, { eau: 1, neige: 0 }, { eau: 0, neige: .75 }];
let controles = 0;
const verifier = (nom, f) => { try { f(); controles++; console.log('ok ' + nom); } finally { B.meteo.actuel = null; } };
function etat(type = 'slicks', circuit = c, s = circuit.depart || 0) {
  return Object.assign(C.creer(s, 0), P.creerEtat(type, { seance: 2047, voiture: 2 }));
}
function rouler(e, cmd, pas, circuit = c) { for (let n = 0; n < pas; n++) C.pas(e, cmd, circuit, dt); return e; }
const presque = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-10, message || `${a} ≠ ${b}`);

verifier('les quatre familles ont chacune leur domaine de chaussée', () => {
  assert.deepEqual(surfaces.map(s => C.pneusConseilles(s)), ['slicks', 'inter', 'pluie', 'neige']);
  for (const s of surfaces) {
    const conseil = C.pneusConseilles(s), optimum = C.adherencePneus(conseil, s);
    for (const type of P.TYPES) if (type !== conseil) assert.ok(optimum > C.adherencePneus(type, s));
  }
  assert.ok(C.adherencePneus('neige', surfaces[0]) < C.adherencePneus('slicks', surfaces[0]));
});

verifier('les anciens appels eau seule conservent exactement leurs coefficients neufs', () => {
  const historiques = { slicks: [1, -.30], inter: [.96, -.10], pluie: [.88, .07] };
  for (const [type, p] of Object.entries(historiques)) for (const eau of [0, .1, .3, .7, 1]) {
    assert.equal(C.adherencePneus(type, eau), p[0] + p[1] * eau);
    assert.equal(C.adherencePneus(type, { eau, neige: 0 }), C.adherencePneus(type, eau));
  }
});

verifier('flocons seuls sans couverture ne deviennent pas une chaussée enneigée', () => {
  B.meteo.actuel = { pluie: .9, mouille: 0, reel: true, neige: true, neigeSol: 0 };
  const s = B.chaussee.lire(c, 0);
  assert.equal(C.eauSurPiste(), 0);
  assert.equal(C.pneusConseilles(s), 'slicks');
  B.meteo.actuel.neigeSol = .75;
  assert.equal(C.pneusConseilles(B.chaussee.lire(c, 0)), 'neige');
});

verifier('entrées invalides bornées et catalogue protégé contre les clés héritées', () => {
  for (const type of ['constructor', '__proto__', 'toString', null, {}, undefined]) {
    assert.equal(C.adherencePneus(type, .7, .2), C.adherencePneus('slicks', .7, .2));
  }
  for (const s of [NaN, Infinity, -1, 100, null, {}, { eau: NaN, neige: Infinity }, { eau: '1', neige: '1' }]) {
    for (const type of P.TYPES) for (const u of [NaN, Infinity, -100, 100, '1']) {
      const a = C.adherencePneus(type, s, u);
      assert.ok(Number.isFinite(a) && a > 0 && a <= 1);
    }
  }
});

verifier('usure progressive sans falaise, réponse bornée pour chaque type et chaque état de route', () => {
  for (const type of P.TYPES) for (const s of [...surfaces, { eau: 1, neige: 1 }]) {
    const neuf = C.adherencePneus(type, s); let avant = neuf;
    for (let i = 1; i <= 100; i++) {
      const a = C.adherencePneus(type, s, i / 100);
      assert.ok(a < avant && avant - a < .005, `${type} : progression continue`);
      assert.ok(a >= neuf * .68 - 1e-12, `${type} : minimum borné`);
      avant = a;
    }
  }
});

verifier('la lecture IA reste finie malgré des charges absentes, invalides ou débordantes', () => {
  for (const charges of [[0, 0, 0, 0], [NaN, Infinity, -1, undefined], Array(4).fill(Number.MAX_VALUE)]) {
    const e = etat('inter'); e.roues.forEach((r, i) => { r.charge = charges[i]; });
    e.etatPneus[0].usure = .7;
    for (const s of surfaces) {
      const a = C.adherenceVoiture(e, s);
      assert.ok(Number.isFinite(a) && a > 0 && a <= 1);
    }
  }
});

verifier('les vraies capacités distinguent chaque roue et chaque essieu', () => {
  const neuf = etat(), avant = etat(), arriere = etat();
  for (const e of [neuf, avant, arriere]) e.v = 30;
  avant.etatPneus[0].usure = 1; arriere.etatPneus[3].usure = 1;
  for (const e of [neuf, avant, arriere]) rouler(e, commande, 1);
  assert.ok(avant.capAv < neuf.capAv); assert.equal(avant.capAr, neuf.capAr);
  assert.ok(arriere.capAr < neuf.capAr); assert.equal(arriere.capAv, neuf.capAv);
  const gauche = etat(), droite = etat();
  for (const e of [gauche, droite]) { e.v = 30; e.chargeY = 8; }
  gauche.etatPneus[0].usure = 1; droite.etatPneus[1].usure = 1;
  for (const e of [gauche, droite]) rouler(e, commande, 1);
  assert.ok(gauche.capAv < droite.capAv, 'la roue extérieure chargée participe davantage');
});

verifier('le facteur IA reproduit les contributions de charge et protège l’essieu limitant', () => {
  const e = etat('pluie'); e.v = 35; e.chargeY = 7;
  e.etatPneus[0].usure = .9; e.etatPneus[1].usure = .1;
  e.etatPneus[2].usure = .2; e.etatPneus[3].usure = .4;
  const base = structuredClone(e); base.etatPneus.forEach(r => { r.usure = 0; });
  B.meteo.actuel = { pluie: .8, mouille: .3, neigeSol: .2 };
  const surface = B.chaussee.lire(c, e.s), avant = structuredClone(e);
  rouler(e, commande, 1); rouler(base, commande, 1);
  avant.roues = e.roues;
  const neuf = C.adherencePneus(e.pneus, surface);
  presque(C.adherenceVoiture(avant, surface), neuf * Math.min(e.capAv / base.capAv, e.capAr / base.capAr));
});

verifier('la neige change la traction réelle et des pneus usés allongent le freinage', () => {
  B.meteo.actuel = { pluie: 0, mouille: 0, neigeSol: 1 };
  const slick = etat('slicks'), neige = etat('neige');
  rouler(slick, { ...commande, gaz: 1 }, 120); rouler(neige, { ...commande, gaz: 1 }, 120);
  assert.ok(neige.v > slick.v + 1, 'le pneu neige transmet davantage de propulsion');
  B.meteo.actuel = { pluie: 0, mouille: 0, neigeSol: 0 };
  const neuf = etat(), use = etat();
  neuf.v = use.v = 45; use.etatPneus.forEach(r => { r.usure = 1; });
  rouler(neuf, { ...commande, frein: 1 }, 120); rouler(use, { ...commande, frein: 1 }, 120);
  assert.ok(use.v > neuf.v + .3, 'la gomme perdue réduit le freinage transmis');
  assert.ok(use.distance > neuf.distance, 'distance de freinage accrue');
});

verifier('l’usure reçoit la même surface que les forces, en marche avant, au recul et sous abri', () => {
  const original = B.usurePneus, appels = [];
  B.usurePneus = { ...original, pas(...args) { appels.push({ eau: args[3], neige: args[4], mode: args[5] }); return original.pas(...args); } };
  try {
    B.meteo.actuel = { pluie: .8, mouille: .5, neigeSol: .75 };
    const e = etat(); e.v = 20; rouler(e, commande, 1);
    assert.deepEqual(appels.pop(), { eau: .8, neige: .75, mode: undefined });
    e.v = -1; e.rapport = -1; rouler(e, { ...commande, frein: 1, marcheArriere: true }, 1);
    assert.deepEqual(appels.pop(), { eau: .8, neige: .75, mode: 'recul' });
    const tunnel = etat('slicks', montagne, (montagne.tunnel.debut + montagne.tunnel.fin) / 2); tunnel.v = 20;
    rouler(tunnel, commande, 1, montagne);
    assert.deepEqual(appels.pop(), { eau: 0, neige: 0, mode: undefined });
  } finally { B.usurePneus = original; }
});

verifier('l’IA lit aussi la chaussée après le portail avant de sortir du tunnel', () => {
  const co = B.course.creer(montagne, { mode: 'chrono', graine: 17 }), v = co.joueur;
  co.dt = dt; co.phase = 'course'; co.temps = 30;
  v.etat.s = montagne.tunnel.fin - 25; v.etat.v = 65;
  const original = B.chaussee, lectures = [];
  B.chaussee = { ...original, lire(c, s, m, out) { const r = original.lire(c, s, m, out); lectures.push({ s, neige: r.neige, abri: r.abri }); return r; } };
  try {
    B.meteo.actuel = { pluie: 0, mouille: 0, neigeSol: .75 };
    const cmd = B.course.commandesIA(co, v);
    assert.ok(lectures.some(r => r.abri && r.neige === 0));
    assert.ok(lectures.some(r => r.s >= montagne.tunnel.fin && r.neige === .75));
    assert.ok(Object.values(cmd).filter(x => typeof x === 'number').every(Number.isFinite));
  } finally { B.chaussee = original; }
});

verifier('l’anticipation réutilise les pneus tant que la chaussée reste identique', () => {
  const co = B.course.creer(c, { mode: 'chrono', graine: 31 }); co.dt = dt;
  co.joueur.etat.v = 30;
  const original = C.adherenceVoiture; let appels = 0;
  C.adherenceVoiture = (...args) => { appels++; return original(...args); };
  try {
    B.meteo.actuel = { pluie: .2, neigeSol: .75 };
    B.course.commandesIA(co, co.joueur);
    assert.equal(appels, 1, 'une seule lecture des pneus sur une surface homogène');
  } finally { C.adherenceVoiture = original; }
});

verifier('le nombre d’images ne change ni les forces ni l’usure pour les mêmes pas de conduite', () => {
  const simuler = groupes => {
    B.meteo.actuel = { pluie: .3, mouille: .2, neigeSol: .25 };
    const e = etat('inter'); let n = 0;
    for (const groupe of groupes) for (let k = 0; k < groupe; k++, n++) {
      C.pas(e, { ...commande, gaz: n < 180 ? 1 : .35, frein: n >= 360 ? .2 : 0, volant: .02 }, c, dt);
    }
    return e;
  };
  const a = simuler(Array(600).fill(1)), b = simuler(Array(100).fill(6));
  assert.deepEqual(a, b);
  assert.ok(a.etatPneus.every(r => r.distance > 0 && r.usure > 0));
});

console.log(controles + ' contrôles chaussée, adhérence et usure physique réussis');
