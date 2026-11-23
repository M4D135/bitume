import {toileWebGPU} from './support-visiere-webgpu.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/vitre.js'); require('../src/visiere-optique.js');
const V = globalThis.BITUME.vitre, O = globalThis.BITUME.visiereOptique;
const contexte = ajout => ({ actif: true, qualite: 'high', pluie: 1, neige: 0, embruns: 0, intensite: 1,
  cockpit: true, largeur: 960, hauteur: 540, vitesse: 0, ...ajout });
const avancer = (e, c, secondes, hz = 120) => { for (let i = 0; i < Math.round(secondes * hz); i++) O.avancerEtat(e, 1 / hz, c); };
function premiere(e, c) {
  for (let i = 0; i < 2400 && !e.depots.stats.impactsEmis; i++) O.avancerEtat(e, 1 / 120, c);
  const p = e.depots.gouttes.find(p => p.vivant && p.impactForce > 0); assert(p, 'une vraie arrivée de pluie'); return p;
}
const forces = e => Array.from(e.impactsUniformes).filter((_, i) => i % 4 === 1);
function toile() {
  const appels = { ellipses: [], uniformes: {}, dessins: 0, copies: 0, clears: 0 };
  const ctx = { globalAlpha: 1, setTransform() {}, clearRect() { appels.ellipses.length = 0; },
    beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {},
    ellipse(...p) { appels.ellipses.push([...p, ctx.globalAlpha]); }, drawImage() { appels.copies++; } };
  const canvas = { width: 960, height: 540, clientWidth: 960, clientHeight: 540, style: {},
    getContext: type => type === '2d' ? ctx : null,
    getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {},
    ownerDocument: { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) } };
  return { canvas, appels };
}

test('arrivée brève puis perle persistante : âge d’impact distinct et aucun nouveau pool', () => {
  const e = O.creerEtat({ graine: 4 }), c = contexte(), pool = e.depots.gouttes.slice(), buffer = e.impactsUniformes;
  const p = premiere(e, c), u = new Float64Array(4);
  assert(p.impactDuree >= .18 && p.impactDuree <= .28);
  assert.equal(V.lireImpact(p, 0, u), 0, 'arrivée interpolée sans flash instantané');
  avancer(e, c, .075); assert(V.lireImpact(p, 1, u) > .1, 'couronne visible pendant le choc');
  assert(forces(e).some(x => x > .1), 'phase courte transmise au GPU');
  avancer(e, c, .35); assert.equal(V.lireImpact(p, 1, u), 0, 'couronne terminée avant 0,5 s');
  assert(p.vivant && p.poids > .9 && p.age < p.duree, 'la même perle reste, sans réapparition');
  assert.equal(e.impactsUniformes, buffer); pool.forEach((p, i) => assert.equal(e.depots.gouttes[i], p));
  assert.equal(buffer.byteLength, 512); assert(e.nbGouttes <= 24);
});

test('pluie fine, modérée, forte et très forte : davantage d’arrivées et impacts plus marqués', () => {
  const mesures = [.2, .45, .75, 1].map(pluie => {
    const e = O.creerEtat({ graine: 4 }), c = contexte({ pluie }), p = premiere(e, c), force = p.impactForce;
    // Même durée totale pour comparer les nombres d'arrivées, même graine pour la force du premier impact.
    const complet = O.creerEtat({ graine: 4 }); avancer(complet, c, 4);
    return [complet.depots.stats.impactsEmis, force];
  });
  for (let i = 1; i < mesures.length; i++) {
    assert(mesures[i][0] > mesures[i - 1][0]); assert(mesures[i][1] > mesures[i - 1][1]);
  }
  console.log('impacts en 4 s / force initiale : ' + JSON.stringify(mesures));
});

test('sec, abri, neige et fonte ne créent aucun impact ; eau présente conservée sous abri', () => {
  for (const ajout of [{ pluie: 0 }, { abri: true }, { pluie: 0, neige: 1 }]) {
    const e = O.creerEtat({ graine: 4 }); avancer(e, contexte(ajout), 14);
    assert.equal(e.depots.stats.impactsEmis, 0); assert(forces(e).every(x => x === 0));
    if (ajout.neige) assert(e.neige > 0 && e.eau > 0, 'neige humide et fonte conservées');
  }
  const e = O.creerEtat({ graine: 4 }), c = contexte(); premiere(e, c); avancer(e, c, .075);
  const emis = e.depots.stats.impactsEmis; assert(forces(e).some(x => x > 0));
  O.avancerEtat(e, 1 / 120, { ...c, abri: true });
  assert(forces(e).every(x => x === 0)); assert(e.depots.stats.gouttes > 0 && e.nbGouttes > 0);
  avancer(e, { ...c, abri: true }, 1); assert.equal(e.depots.stats.impactsEmis, emis);
});

test('impacts identiques à 30/47/60/120/144 Hz, pause exacte et graines J1/J2 indépendantes', () => {
  const references = new Map(), c = contexte({ vitesse: 300 / 3.6, embruns: .8, cameraYaw: .4, ventX: 6 });
  for (const hz of [30, 47, 60, 120, 144]) {
    const e = O.creerEtat({ graine: 4 });
    for (let i = 1; i <= hz * 3; i++) {
      O.avancerEtat(e, 1 / hz, c);
      if (i % hz) continue;
      const valeurs = [...e.impactsUniformes, ...e.gouttesUniformes, e.depots.stats.impactsEmis];
      const temps = i / hz;
      if (!references.has(temps)) references.set(temps, valeurs);
      else valeurs.forEach((v, k) => assert(Math.abs(v - references.get(temps)[k]) < 1e-4, `${hz} Hz, ${temps} s, ${k}`));
    }
    const avant = JSON.stringify(e); avancer(e, { ...c, pause: true }, 2); assert.equal(JSON.stringify(e), avant);
  }
  const a = O.creerEtat({ graine: 1 }), b = O.creerEtat({ graine: 2 });
  premiere(a, c); premiere(b, c); assert.notEqual(a.depots.gouttes[0].phase, b.depots.gouttes[0].phase);
  const avant = JSON.stringify(a); avancer(b, c, 1); assert.equal(JSON.stringify(a), avant);
});

test('l’impact suit la perle, gravité à l’arrêt et expulsion radiale à 300 km/h conservées', () => {
  for (const vitesse of [0, 300 / 3.6]) {
    const e = O.creerEtat({ graine: 4 }), c = contexte({ vitesse }), p = premiere(e, c);
    p.x = p.px = .2; p.y = p.py = .2; p.traceX.fill(.2); p.traceY.fill(.2);
    avancer(e, c, .1);
    assert(p.vivant && p.impactAge < .2, 'phase d’arrivée encore en cours');
    if (vitesse) assert(p.x < .2 && p.y < .2, 'flux dirigé vers le bord supérieur gauche');
    else assert(p.y > .2, 'gravité sans vitesse');
    const k = Math.max(0, Math.min(1, e.depots.accumulateur * 30));
    assert(Math.abs(e.gouttesUniformes[0] / 960 - (p.px * (1 - k) + p.x * k)) < 1e-6);
    assert(Math.abs(e.gouttesUniformes[1] / 540 - (1 - p.py * (1 - k) - p.y * k)) < 1e-6);
  }
});

test('Canvas2D dessine une couronne locale avant le ruissellement, sans lecture de pixels', () => {
  const t = toile(), e = V.creer(t.canvas, { graine: 4 }), c = contexte();
  let p;
  for (let i = 0; i < 1000 && !p; i++) { V.mettreAJour(e, 1 / 120, c); p = e.gouttes.find(p => p.vivant && p.impactForce > 0); }
  assert(p);
  for (let i = 0; i < 10; i++) V.mettreAJour(e, 1 / 120, c);
  const couronnes = t.appels.ellipses.filter(q => q[2] > p.taille && q[3] < q[2]);
  assert(couronnes.length >= 2 && couronnes.every(q => q[2] < 32), 'anneau local aplati et borné');
  assert.equal(t.canvas.getImageData, undefined); assert.equal(e.contexte.globalAlpha, 1);
});

test('le raccord WebGPU reçoit les impacts en Légère et Fine, avec ses plafonds et sa source de vue', () => {
  for (const qualite of ['low', 'high']) {
    const t = toileWebGPU(), e = V.creer(t.canvas, { gpu:t.gpu, graine:4 });
    const c = contexte({ qualite, sourceScene: { width: 960, height: 540 } }); let trouve = false;
    for (let i = 0; i < 1200 && !trouve; i++) {
      V.mettreAJour(e, 1 / 120, c);
      trouve = t.appels.uniformes.uImpacts?.some((x, k) => k % 4 === 1 && x > .1);
    }
    assert(trouve, 'impact effectivement transmis au tampon GPU');
    assert.deepEqual(t.appels.uniformes.uImpacts, Array.from(e.simulation.impactsUniformes));
    assert(t.appels.uniformes.uNbGouttes <= (qualite === 'low' ? 6 : 24));
    assert.equal(t.appels.uniformes.uAvecScene, qualite !== 'low');
    assert.equal(t.appels.copies > 0, qualite !== 'low');
    assert(e.stats.impactsEmis > 0 && e.stats.pixels <= O.MAX_PIXELS);
    V.mettreAJour(e, 0, { ...c, actif: false });
    assert(e.simulation.impactsUniformes.every(x => x === 0)); assert(e.propre && e.masquee);
  }
});
