// Tracés proposés du lot 22F (tools/lieux-trace.mjs, partitions de tools/lieux-partitions.mjs). Demandes de David du
// 18/11/2026 consignées dans AGENTS.md (lot 22A) : un circuit de montagne long avec une portion à 20-30 %, des tunnels,
// une forêt dense, une corniche le long d'un grand virage ; cadre du lot 22F : 8 à 10 km dessinés sur Haut-Col, devenus
// le huitième circuit Route-des-Cimes (David, 18/11 : « Huitième circuit »), des lieux mémorables sur chaque circuit. Les tracés en plan
// actuels restent tant que David n'en décide pas autrement : ce sont des propositions. Chaque partition doit se
// refermer exactement, passer les contrôles que le jeu exige (rayon ≥ 24 m, portions à 60 m au moins l'une de l'autre
// hors croisements déclarés, crêtes tenables, place pour les stands) et donner un circuit lisible par les fonctions du
// jeu. Aucune source du jeu n'est modifiée par ces tracés.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { TRACE } from '../tools/lieux-trace.mjs';
import { PARTITIONS, PARTITION } from '../tools/lieux-partitions.mjs';
const require = createRequire(import.meta.url);
require('../src/circuit.js');
const B = globalThis.BITUME;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok  ' + nom); };
const traces = new Map(PARTITIONS.map(p => [p.id, TRACE.construire(p)]));
const CHAMPS = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD', 'vibreur'];

verifier('sept partitions : Route-des-Cimes et les brouillons des six autres circuits, mêmes graines et mêmes caractères de lieu', () => {
  const attendu = { 'val-brule': [11, 'foret'], 'port-sable': [29, 'cote'], 'route-des-cimes': [181, 'montagne'], 'lande-noire': [83, 'islande'], 'roche-fauve': [107, 'desert'], 'brume-de-jade': [131, 'asie'], 'cap-sequoia': [157, 'pacifique'] };
  assert.deepEqual(PARTITIONS.map(p => p.id).sort(), Object.keys(attendu).sort());
  for (const p of PARTITIONS) assert.deepEqual([p.graine, p.theme], attendu[p.id], p.id);
});

verifier('chaque tracé se referme et passe les contrôles du jeu et de l\'étude', () => {
  for (const [id, c] of traces) {
    assert.deepEqual(TRACE.controler(c, PARTITION[id].attentes || {}), [], id);
    assert.ok(c.mesures.rayonMin >= 24, `${id} : rayon ${c.mesures.rayonMin}`);
    assert.ok(!Number.isFinite(c.mesures.separation) || c.mesures.separation >= 60, `${id} : séparation ${c.mesures.separation}`);
    assert.ok(c.mesures.chargeMin >= (id === 'route-des-cimes' ? .6 : .5) && c.mesures.chargeMax <= 1.8, `${id} : charge ${c.mesures.chargeMin}–${c.mesures.chargeMax} g`);
    assert.ok(c.stands && c.stands.fin - c.stands.debut > 140, `${id} : stands`);
    assert.ok(c.lieux.length >= 4 && c.lieux.every(l => l.fin > l.debut), `${id} : lieux`);
  }
});

verifier('le même tracé à chaque construction (aucun hasard)', () => {
  for (const p of PARTITIONS.slice(0, 3)) {
    const a = traces.get(p.id), b = TRACE.construire(p);
    for (const k of CHAMPS) assert.deepEqual(b[k], a[k], `${p.id} : ${k}`);
  }
});

verifier('Route-des-Cimes : 9 à 10 km, Le Mur entre 20 et 30 %, trois passages couverts dont deux tunnels, corniche sur un grand virage', () => {
  const c = traces.get('route-des-cimes'), M = c.mesures;
  assert.ok(M.longueur >= 9000 && M.longueur <= 10000, `${M.longueur} m`);
  assert.ok(M.penteMax >= 20 && M.penteMax <= 30 + 1e-6, `pente max ${M.penteMax} %`);
  assert.ok(M.longueurAu20 >= 250, `${M.longueurAu20} m au-delà de 20 %`);
  assert.ok(M.penteMin >= -12, `descente ${M.penteMin} %`);
  const mur = c.lieux.find(l => l.nom === 'Le Mur');
  let auDela = 0; for (let i = 0; i < c.n; i++) if (c.pente[i] >= .2) { const s = i * c.pasReel; assert.ok(s >= mur.debut && s <= mur.fin, 'pente de plus de 20 % hors du Mur'); auDela++; }
  assert.ok(auDela > 0);
  assert.ok(c.couverts.length >= 3 && c.couverts.filter(t => t.type === 'tunnel').length >= 2);
  assert.ok(c.tunnel && c.tunnel.fin - c.tunnel.debut >= 200, 'le premier tunnel est celui que le jeu sait bâtir');
  const balcon = c.bords.find(b => b.type === 'vide' && b.nom.includes('Balcon'));
  assert.ok(balcon, 'corniche du Balcon du Cirque');
  let k = 0; for (let s = balcon.debut; s <= balcon.fin; s += 10) k = Math.max(k, Math.abs(c.courbure[Math.round(s / c.pasReel) % c.n]));
  assert.ok(k > 0 && 1 / k >= 150, `rayon de la corniche ${1 / k}`);
  assert.ok(M.tourP10 > M.tourP9, 'les pentes coûtent du temps au tour de référence p10');
});

verifier('Brume-de-Jade : la Spirale repasse sous son approche, 8 m au moins plus bas', () => {
  const c = traces.get('brume-de-jade');
  assert.equal(c.croisements.length, 1);
  assert.ok(c.croisements[0].ecartVertical >= 8, `${c.croisements[0].ecartVertical} m`);
});

verifier('un tracé proposé se lit avec les fonctions du jeu (échantillon, tunnel, limites)', () => {
  for (const [id, c] of traces) {
    for (const k of CHAMPS) { assert.equal(c[k].length, c.n, `${id} : ${k}`); assert.ok(Array.prototype.every.call(c[k], Number.isFinite), `${id} : ${k} non fini`); }
    assert.equal(c.depart, 0); assert.equal(c.pas, 2); assert.equal(c.longueur, c.n * c.pas);
    for (let s = 0; s < c.longueur; s += 97) {
      const e = B.circuit.echantillon(c, s);
      assert.ok([e.x, e.y, e.z, e.cap, e.pente, e.vitesse].every(Number.isFinite), `${id} : échantillon ${s}`);
      for (const cote of [-1, 1]) assert.ok(B.circuit.limiteA(c, s, cote) >= c.largeur / 2 + .9 - 1e-6, `${id} : limite à ${s}`);
    }
    if (c.tunnel) assert.ok(B.circuit.dansTunnel(c, (c.tunnel.debut + c.tunnel.fin) / 2) && !B.circuit.dansTunnel(c, c.tunnel.debut - 30), id);
    for (let i = 0; i < c.n; i++) assert.ok(c.vitesse[i] > 8 && c.vitesse[i] < 95, `${id} : vitesse ${c.vitesse[i]} en ${i}`);
  }
});

console.log(`${n} vérifications des tracés proposés`);
