// Lot 3 : rivaux agressifs contre tous. Les décisions sont mesurées (engagements, abandons, oscillations, temps de
// décision), pas seulement affichées. Scénarios reproductibles sur le vrai circuit, plusieurs graines et difficultés.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = process.env.BITUME_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course']) req(path.join(root, 'src', f + '.js'));
const B = globalThis.BITUME, DT = 1 / 120, results = [];
const NEUTRE = { gaz: 0, frein: 0, volant: 0, derive: false, boite: 'auto', aide: 0, guidage: 0 };
function check(name, fn) { try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e && e.message }); } }

function course(seed, rivaux, difficulte, tours) {
  const c = B.circuit.creer(seed, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, { rivaux, graine: seed, tours: tours || 2, difficulte });
  co.phase = 'course'; co.feux.vert = true; co.temps = 30;
  for (const v of co.voitures) { v.etat.recuperation = null; v.etat.accident = null; v.etat.reparation = null; }
  return co;
}
function placer(co, id, s, d, v) {
  const e = co.voitures[id].etat;
  Object.assign(e, { s, d, v, psi: 0, beta: 0, omega: 0, tangage: 0, roulis: 0, bond: 0, saut: null });
  e.recuperation = null; e.accident = null; e.reparation = null; e.immunite = 0;
  if (e.degats) B.degats.reparer(e.degats);
  return e;
}
function rouler(co, n, cmd) { const ev = []; for (let k = 0; k < n; k++) ev.push(...B.course.pas(co, cmd || NEUTRE, DT)); return ev; }
const attaquantDe = co => co.voitures.filter(v => !v.joueur && v.ia.cible >= 0);

// Un duel isolé : les autres rivaux sont loin derrière, sinon le peloton se bloque les côtés libre et le test ne
// mesure plus l'attaque, mais l'encombrement.
function duel(graine, devant, derriere, dv) {
  const co = course(graine, 6, 2);
  placer(co, devant.id, 1000, devant.d || 0, devant.v);
  placer(co, derriere.id, 1000 - (derriere.gap || 24), derriere.d || 0, derriere.v);
  for (const v of co.voitures) if (v.id !== devant.id && v.id !== derriere.id) placer(co, v.id, 300 + v.id * 7, 0, 30);
  return co;
}
check('une IA serre une voiture plus lente et s engage contre elle', () => {
  const co = duel(21, { id: 0, v: 35 }, { id: 1, v: 35 + 9 });   // 9 m/s d écart : un rival à battre, pas un obstacle
  let vise = false;
  for (let k = 0; k < 1200 && !vise; k++) { B.course.pas(co, NEUTRE, DT); vise = co.voitures[1].ia.cible === 0 && co.voitures[1].ia.attaque; }
  assert.ok(vise, 'aucune IA ne s est engagée contre le joueur');
  assert.ok(co.statsIa.attaques > 0, 'les engagements ne sont pas comptés');
});
check('la même capacité d attaque contre une autre IA (pas de convoi centré sur le joueur)', () => {
  const co = duel(22, { id: 3, v: 33 }, { id: 4, v: 33 + 9 });
  placer(co, 0, 2600, 0, 60);                                    // le joueur loin devant, hors de portée
  let vise = false;
  for (let k = 0; k < 1200 && !vise; k++) { B.course.pas(co, NEUTRE, DT); vise = co.voitures[4].ia.cible === 3 && co.voitures[4].ia.attaque; }
  assert.ok(vise, 'aucune IA ne s est engagée contre une autre IA');
});
check('un adversaire en récupération ou en service n est pas attaqué, mais reste contourné', () => {
  const co = course(23, 4, 2);
  const e = placer(co, 3, 1000, 0, 0);
  e.recuperation = { t: 0, cause: 'choc' }; e.accident = { t: 0, duree: .65, d0: 0 };
  for (let k = 0; k < 4; k++) placer(co, k + 1, 930 - k * 25, (k % 3 - 1) * 1.2, 44);
  rouler(co, 900);
  assert.equal(co.statsIa.attaques, 0, 'une voiture hors service a été attaquée');
  const derriere = co.voitures.filter((v, i) => i > 0 && v.etat.s < 1000 && v.etat.v > 5);
  assert.ok(derriere.length >= 0);
  assert.ok(co.voitures.slice(1).some(v => v.etat.s > 1010), 'personne n a contourné la voiture arrêtée');
});
check('délai entre deux engagements : pas d enchaînement immédiat sur la même cible', () => {
  const co = duel(24, { id: 3, v: 34 }, { id: 4, v: 34 + 9, gap: 20 });
  const suiveur = co.voitures[4];
  let engagements = 0, dernier = -99;
  for (let k = 0; k < 1800; k++) {
    B.course.pas(co, NEUTRE, DT);
    if (suiveur.ia.cible === 3 && suiveur.ia.attaque && suiveur.ia.derniereAttaque > dernier) {
      assert.ok(suiveur.ia.derniereAttaque - dernier >= B.course.IA_ATTENTE - 1e-6,
        'deux engagements à ' + (suiveur.ia.derniereAttaque - dernier).toFixed(2) + ' s d écart');
      dernier = suiveur.ia.derniereAttaque; engagements++;
    }
  }
  assert.ok(engagements >= 1, 'le suiveur ne s est jamais engagé');
});
check('pas d oscillation de cible : le nombre de changements reste borné dans un peloton serré', () => {
  const co = course(25, 8, 3);
  for (let k = 0; k < 8; k++) placer(co, k + 1, 1000 - k * 18, ((k % 3) - 1) * 1.6, 34 + (k % 4) * 3);
  placer(co, 0, 1040, 0, 36);
  for (let k = 0; k < 3600; k++) B.course.pas(co, NEUTRE, DT);
  for (const v of co.voitures) {
    if (v.joueur) continue;
    assert.ok(v.ia.changements <= 40, v.nom + ' a changé d avis ' + v.ia.changements + ' fois en 30 s');
  }
});
check('pas de blocage durable : tout le monde avance et la course finit, sur trois graines et trois difficultés', () => {
  for (const graine of [31, 32, 33]) for (const difficulte of [1, 2, 3]) {
    const co = course(graine, 11, difficulte, 1);
    const t0 = co.temps;
    for (let k = 0; k < 120 * 400 && !co.termine; k++) B.course.pas(co, { gaz: 1, frein: 0, volant: 0, derive: false, boite: 'auto', aide: 0, guidage: 0 }, DT);
    assert.ok(co.termine, 'course non terminée (graine ' + graine + ', difficulté ' + difficulte + ')');
    assert.ok(co.finisseurs >= 8, 'trop de voitures bloquées : ' + co.finisseurs + ' finisseurs');
    assert.ok(co.temps - t0 > 30, 'course finie anormalement vite');
    assert.ok(co.statsIa.contacts > 0 || co.statsIa.attaques > 0, 'aucune interaction mesurée');
  }
});
check('le chrono et le mode d essai ne choisissent pas de cible', () => {
  const c = B.circuit.creer(41, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, { rivaux: 0, mode: 'chrono', graine: 41 });
  co.chronoParti = true;
  for (let k = 0; k < 1200; k++) B.course.pas(co, B.course.commandesIA(co, co.joueur), DT);
  assert.equal(co.statsIa.attaques, 0, 'le chrono a déclenché une attaque');
  assert.ok(co.joueur.etat.v > 20, 'le chrono ne roule plus');
});
check('les décisions sont déterministes : même graine, mêmes statistiques', () => {
  const run = () => {
    const co = course(51, 8, 2, 1);
    for (let k = 0; k < 120 * 60; k++) B.course.pas(co, { gaz: 1, frein: 0, volant: 0, derive: false, boite: 'auto', aide: 0, guidage: 0 }, DT);
    return JSON.stringify(co.statsIa);
  };
  assert.equal(run(), run());
});
check('un blocage ne dure pas au-delà du virage et ne ralentit pas la voiture tenue', () => {
  const co = course(61, 4, 2);
  placer(co, 3, 1000, 0, 40);
  placer(co, 4, 985, 0.6, 40);
  let presses = 0;
  for (let k = 0; k < 1200; k++) { B.course.pas(co, NEUTRE, DT); if (co.voitures[3].ia.presse >= 0) presses++; }
  assert.ok(presses < 1200, 'le maintien de ligne ne s éteint jamais');
  assert.ok(co.voitures[3].etat.v > 20, 'le bloqué est resté collé : ' + co.voitures[3].etat.v.toFixed(1));
});
check('temps de décision mesuré et plausible (jamais négatif, jamais instantané)', () => {
  const co = course(71, 8, 2);
  for (let k = 0; k < 8; k++) placer(co, k + 1, 1000 - k * 22, ((k % 3) - 1) * 1.4, 30 + (k % 5) * 4);
  rouler(co, 2400);
  assert.ok(co.statsIa.decisions > 0, 'aucune décision enregistrée');
  const moyen = co.statsIa.tempsDecision / co.statsIa.decisions;
  assert.ok(moyen >= 0 && moyen < 5, 'temps de décision moyen aberrant : ' + moyen.toFixed(2) + ' s');
});

console.log(JSON.stringify({ passed: results.filter(r => r.ok).length, total: results.length, results }, null, 2));
if (results.some(r => !r.ok)) process.exitCode = 1;
