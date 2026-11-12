import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));

charger('conduite.js');
const B = globalThis.BITUME;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function creerFauxCircuit(type, rayon, largeur, limite) {
  const L = type === 'cercle' ? 2 * Math.PI * rayon : 10000;
  const pas = 2;
  const n = Math.round(L / pas);
  const c = { longueur: L, largeur, limite };
  B.circuit = {
    echantillon(c, s) {
      const ss = ((s % L) + L) % L;
      if (type === 'cercle') {
        const th = ss / rayon;
        return { x: rayon * Math.sin(th), y: 0, z: rayon * (1 - Math.cos(th)), cap: th, courbure: 1 / rayon, pente: 0, devers: 0, ligne: 0, vitesse: 0 };
      }
      return { x: ss, y: 0, z: 0, cap: 0, courbure: 0, pente: 0, devers: 0, ligne: 0, vitesse: 0 };
    },
    vibreurA(c, s, cote) { return false; }
  };
  return c;
}

let nbOk = 0;
function verifier(nom, f) {
  try { f(); console.log('ok  ' + nom); nbOk++; }
  catch (e) { console.error('FAIL ' + nom + ' : ' + e.message); process.exit(1); }
}

verifier('départ arrêté', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  const et = B.conduite.creer(0, 0);
  const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  const dt = 1 / 120;
  let t = 0, t100 = -1, t200 = -1, rapports = 0;
  while (t < 60) {
    const ev = B.conduite.pas(et, cmd, c, dt);
    for (const e of ev) if (e.type === 'rapport') rapports++;
    if (t100 < 0 && et.v * 3.6 >= 100) t100 = t;
    if (t200 < 0 && et.v * 3.6 >= 200) t200 = t;
    t += dt;
  }
  assert(t100 >= 2.2 && t100 <= 3.4, '100km/h ' + t100);
  assert(t200 < 9, '200km/h ' + t200);
  assert(et.v * 3.6 >= 300 && et.v * 3.6 <= 315, 'vmax ' + et.v * 3.6);
  assert(et.rapport === 6, 'rapport ' + et.rapport);
  assert(rapports === 5, 'rapports ' + rapports);
});

verifier('freinage', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  const et = B.conduite.creer(0, 0);
  et.v = 280 / 3.6;
  const cmd = { gaz: 0, frein: 1, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  const dt = 1 / 120;
  let t = 0;
  while (et.v > 0 && t < 30) { B.conduite.pas(et, cmd, c, dt); t += dt; }
  assert(et.distance < 200, 'dist ' + et.distance);
});

verifier('cercle sans braquer', () => {
  const c = creerFauxCircuit('cercle', 150, 12, 20);
  const et = B.conduite.creer(0, 0);
  et.v = 140 / 3.6;
  const cmd = { gaz: 0.5, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  const dt = 1 / 120;
  let t = 0;
  while (t < 5) { B.conduite.pas(et, cmd, c, dt); t += dt; }
  assert(et.d < 0, 'd ' + et.d);
});

verifier('cercle avec volant', () => {
  const c = creerFauxCircuit('cercle', 150, 12, 20);
  const et = B.conduite.creer(0, 0);
  et.v = 140 / 3.6;
  const cmd = { gaz: 0.5, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  const dt = 1 / 120, vc = 140 / 3.6;
  let t = 0;
  while (t < 10) {
    // phase 2 : le volant commande une part de l'adhérence avant ; celui qui tient la courbure vient de volantPour
    cmd.volant = B.conduite.volantPour(et, 1 / 150);
    cmd.gaz = Math.min(1, Math.max(0, (vc - et.v) * 0.8 + 0.35));
    cmd.frein = Math.min(1, Math.max(0, (et.v - vc) * 0.3));
    B.conduite.pas(et, cmd, c, dt); t += dt;
  }
  assert(Math.abs(et.v - vc) < 1.5, 'v ' + et.v);
  assert(Math.abs(et.d) < 3, 'd ' + et.d);
});

verifier('retenue', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  const et = B.conduite.creer(0, 0);
  const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  const dt = 1 / 120;
  let t = 0;
  while (t < 2) {
    B.conduite.pas(et, cmd, c, dt, true);
    assert(et.s === 0 && et.v === 0);
    assert(et.regime <= 13000);
    t += dt;
  }
});

verifier('dérive niveaux', () => {
  const c = creerFauxCircuit('cercle', 60, 400, 500);
  const et = B.conduite.creer(0, 0);
  et.v = 120 / 3.6;
  const dt = 1 / 120;
  let t = 0, evs = [];
  let cmd = { gaz: 1, frein: 0, volant: 1, derive: true, haut: false, bas: false, boite: 'auto', aide: 0 };
  while (t < 0.5) { evs.push(...B.conduite.pas(et, cmd, c, dt)); t += dt; }
  assert(evs.some(e => e.type === 'derive'), 'derive');
  cmd = { gaz: 1, frein: 0, volant: -0.5, derive: true, haut: false, bas: false, boite: 'auto', aide: 0 };
  evs = [];
  while (t < 6.5) { evs.push(...B.conduite.pas(et, cmd, c, dt)); t += dt; }
  const nivs = evs.filter(e => e.type === 'niveau').map(e => e.niveau);
  assert(nivs[0] === 1 && nivs[1] === 2 && nivs[2] === 3, 'nivs ' + nivs);
  cmd = { gaz: 1, frein: 0, volant: -0.5, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  evs = [];
  while (t < 7) { evs.push(...B.conduite.pas(et, cmd, c, dt)); t += dt; }
  const turbos = evs.filter(e => e.type === 'turbo');
  assert(turbos.length === 1 && turbos[0].niveau === 3, 'turbo ' + JSON.stringify(turbos));
});

verifier('dérive annulée fond', () => {
  const c = creerFauxCircuit('cercle', 60, 400, 500);
  const et = B.conduite.creer(0, 0);
  et.v = 120 / 3.6;
  const dt = 1 / 120;
  let t = 0, evs = [];
  let cmd = { gaz: 1, frein: 0, volant: 1, derive: true, haut: false, bas: false, boite: 'auto', aide: 0 };
  while (t < 0.5) { evs.push(...B.conduite.pas(et, cmd, c, dt)); t += dt; }
  cmd = { gaz: 1, frein: 0, volant: -1, derive: true, haut: false, bas: false, boite: 'auto', aide: 0 };
  evs = [];
  while (t < 1.5) { evs.push(...B.conduite.pas(et, cmd, c, dt)); t += dt; }
  assert(evs.some(e => e.type === 'deriveAnnulee'), 'annulee');
});

verifier('dérive annulée frein', () => {
  const c = creerFauxCircuit('cercle', 60, 400, 500);
  const et = B.conduite.creer(0, 0);
  et.v = 120 / 3.6;
  const dt = 1 / 120;
  let t = 0, evs = [];
  let cmd = { gaz: 1, frein: 0, volant: 1, derive: true, haut: false, bas: false, boite: 'auto', aide: 0 };
  while (t < 0.5) { evs.push(...B.conduite.pas(et, cmd, c, dt)); t += dt; }
  cmd = { gaz: 1, frein: 0.5, volant: 1, derive: true, haut: false, bas: false, boite: 'auto', aide: 0 };
  evs = [];
  while (t < 1) { evs.push(...B.conduite.pas(et, cmd, c, dt)); t += dt; }
  assert(evs.some(e => e.type === 'deriveAnnulee'), 'annulee frein');
});

verifier('dérive ligne droite', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  const et = B.conduite.creer(0, 0);
  et.v = 120 / 3.6;
  const dt = 1 / 120;
  let t = 0, evs = [];
  const cmd = { gaz: 1, frein: 0, volant: 1, derive: true, haut: false, bas: false, boite: 'auto', aide: 0 };
  while (t < 1) { evs.push(...B.conduite.pas(et, cmd, c, dt)); t += dt; }
  assert(!evs.some(e => e.type === 'derive'), 'pas de derive');
});

verifier('herbe', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  const et = B.conduite.creer(0, 10);
  const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  const dt = 1 / 120;
  let t = 0;
  while (t < 10) { B.conduite.pas(et, cmd, c, dt); t += dt; }
  assert(et.v * 3.6 < 200, 'vmax herbe ' + et.v * 3.6);
});

verifier('glissière', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  const et = B.conduite.creer(0, 0);
  et.v = 200 / 3.6;
  et.psi = 0.3;
  const cmd = { gaz: 0, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  const dt = 1 / 120;
  let t = 0, evs = [];
  while (t < 5) { evs.push(...B.conduite.pas(et, cmd, c, dt)); t += dt; }
  assert(evs.some(e => e.type === 'choc'), 'choc');
  assert(Math.abs(et.d) <= 19.9, 'd ' + et.d);
});

verifier('100000 pas aléatoires', () => {
  const c = creerFauxCircuit('cercle', 150, 12, 20);
  const et = B.conduite.creer(0, 0);
  const rng = mulberry32(42);
  const dt = 1 / 120;
  for (let i = 0; i < 100000; i++) {
    const cmd = { gaz: rng(), frein: rng(), volant: rng() * 2 - 1, derive: rng() > 0.5, haut: rng() > 0.9, bas: rng() > 0.9, boite: 'auto', aide: rng() };
    B.conduite.pas(et, cmd, c, dt);
    for (const k in et) {
      if (typeof et[k] === 'number') assert(Number.isFinite(et[k]), k);
      if (k === 'derive') for (const k2 in et.derive) if (typeof et.derive[k2] === 'number') assert(Number.isFinite(et.derive[k2]), 'derive.' + k2);
      if (k === 'turbo') assert(Number.isFinite(et.turbo.reste), 'turbo');
    }
  }
});

verifier('glissière propre à chaque côté', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  c.limiteG = new Float64Array(5000).fill(9.2); c.limiteD = new Float64Array(5000).fill(20);
  B.circuit.limiteA = (c, s, cote) => cote < 0 ? c.limiteG[0] : c.limiteD[0];
  const et = B.conduite.creer(0, 0);
  et.v = 50; et.psi = -0.25;
  const cmd = { gaz: 0.6, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  let evs = [], dmin = 0;
  for (let i = 0; i < 240; i++) { evs.push(...B.conduite.pas(et, cmd, c, 1 / 120)); dmin = Math.min(dmin, et.d); }
  delete B.circuit.limiteA;
  assert(evs.filter(e => e.type === 'choc').length === 1, 'un seul choc');
  assert(dmin >= -9.2, 'd min ' + dmin);
});

verifier('boîte manuelle et rupteur', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  const et = B.conduite.creer(0, 0);
  const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'manuelle', aide: 0 };
  let rupteurs = 0;
  for (let i = 0; i < 600; i++) for (const e of B.conduite.pas(et, cmd, c, 1 / 120)) if (e.type === 'rupteur') rupteurs++;
  assert(et.rapport === 1, 'reste en première');
  assert(et.v <= 27.2 && et.v > 26, 'v ' + et.v);
  assert(rupteurs >= 10, 'rupteur ' + rupteurs);
  cmd.haut = true; B.conduite.pas(et, cmd, c, 1 / 120); cmd.haut = false;
  assert(et.rapport === 2, 'montée manuelle');
});

verifier('turbo', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  const a = B.conduite.creer(0, 0), b = B.conduite.creer(0, 0);
  // phase 2 : la poussée dépend du palier du turbo (ici le III)
  a.v = b.v = 60; a.rapport = b.rapport = 5; b.turbo.reste = 1.5; b.turbo.duree = 1.5; b.turbo.niveau = 3;
  const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  for (let i = 0; i < 180; i++) { B.conduite.pas(a, cmd, c, 1 / 120); B.conduite.pas(b, cmd, c, 1 / 120); }
  assert(b.v - a.v > 6, 'gain ' + (b.v - a.v));
  assert(b.turbo.reste === 0, 'turbo épuisé');
});

verifier('grille : rupteur', () => {
  const c = creerFauxCircuit('ligne', 0, 12, 20);
  const et = B.conduite.creer(0, 0);
  const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: 0 };
  let n = 0;
  for (let i = 0; i < 240; i++) for (const e of B.conduite.pas(et, cmd, c, 1 / 120, true)) if (e.type === 'rupteur') n++;
  assert(n >= 10, 'rebonds ' + n);
  cmd.gaz = 0;
  for (let i = 0; i < 240; i++) B.conduite.pas(et, cmd, c, 1 / 120, true);
  assert(et.regime < 4300, 'retour au ralenti ' + et.regime);
});

verifier('déterminisme', () => {
  const c = creerFauxCircuit('cercle', 150, 12, 20);
  const dt = 1 / 120;
  const run = () => {
    const et = B.conduite.creer(0, 0);
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const cmd = { gaz: rng(), frein: rng(), volant: rng() * 2 - 1, derive: rng() > 0.5, haut: false, bas: false, boite: 'auto', aide: rng() };
      B.conduite.pas(et, cmd, c, dt);
    }
    return JSON.stringify(et);
  };
  assert(run() === run());
});

console.log(nbOk + ' vérifications réussies');
process.exit(0);
