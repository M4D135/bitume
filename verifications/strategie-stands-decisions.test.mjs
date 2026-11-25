// 12F4 : décisions uniquement. Les trajets au pas physique et les services sont exercés dans strategie-stands.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
for (const nom of ['circuit', 'conduite', 'degats', 'contacts', 'course', 'meteo']) req('../src/' + nom + '.js');
const B = globalThis.BITUME;
const modulo = (x, L) => ((x % L) + L) % L;

function preparer({ use = .1, vitesse = 25, montagne = false } = {}) {
  const c = B.circuit.creer(montagne ? 47 : 11, { theme: montagne ? 'montagne' : 'foret', longueur: montagne ? 5200 : 4200 });
  const co = B.course.creer(c, { rivaux: 1, graine: 44, tours: 12 });
  co.phase = 'course'; co.feux.vert = true; co.temps = co.horloge = 30;
  const v = co.voitures[1], e = v.etat;
  e.s = modulo(c.stands.debut - 350, c.longueur); e.d = 0; e.v = vitesse; e.psi = 0; e.beta = 0;
  e.pneus = 'slicks'; e.etatPneus.forEach(p => { p.usure = use; });
  v.maxPassages = v.passages = v.tours = 0;
  B.meteo.actuel = { pluie: 0, mouille: 0, neigeSol: 0 };
  return { co, v, e, c };
}
function observer(co, v, secondes) {
  let commande = null;
  for (let t = 0; t < secondes; t += .5) {
    co.temps += .5;
    commande = B.strategieStands.commandes(co, v, {});
  }
  return commande;
}
function physique(e) {
  const copie = structuredClone(e);
  delete copie.pneusProchainArret;
  return copie;
}

test('une pluie brève ne programme rien ; une amélioration durable de monte programme le prochain arrêt', () => {
  const { co, v, e } = preparer(); const avant = physique(e);
  B.meteo.actuel = { pluie: 1, mouille: 1, neigeSol: 0 };
  assert.equal(observer(co, v, 3), null);
  B.meteo.actuel = { pluie: 0, mouille: 0, neigeSol: 0 };
  assert.equal(observer(co, v, 2), null);
  B.meteo.actuel = { pluie: 1, mouille: 1, neigeSol: 0 };
  assert.equal(observer(co, v, 3), null, 'la première averse ne fournit pas le délai de la seconde');
  assert.ok(observer(co, v, 9), 'une condition durable conduit à une décision');
  assert.equal(e.pneusProchainArret, 'pluie');
  assert.equal(e.pneus, 'slicks');
  assert.deepEqual(physique(e), avant, 'la décision ne déplace, répare ni remplace quoi que ce soit');
});

test('le passage sous tunnel ne choisit pas une monte sèche sur une chaussée enneigée', () => {
  const { co, v, e, c } = preparer({ use: .95, montagne: true });
  assert.ok(c.tunnel);
  e.s = (c.tunnel.debut + c.tunnel.fin) / 2;
  B.meteo.actuel = { pluie: 0, mouille: 0, neigeSol: .75, precipitationsNeige: true };
  const avant = physique(e);
  assert.equal(observer(co, v, 12), null);
  assert.deepEqual(physique(e), avant);
  // Second état d'entrée de la décision, hors du tunnel, devant les stands ; ce test ne simule pas un trajet.
  e.s = modulo(c.stands.debut - 350, c.longueur);
  assert.ok(observer(co, v, 1));
  assert.equal(e.pneusProchainArret, 'neige');
  assert.equal(e.pneus, 'slicks');
});

test('une entrée trop proche ou trop rapide est reportée sans freinage d’urgence vers le garage', () => {
  for (const [distance, vitesse] of [[5, 15], [50, 80]]) {
    const { co, v, e, c } = preparer({ use: .95, vitesse });
    e.s = modulo(c.stands.debut - distance, c.longueur);
    const avant = physique(e);
    assert.equal(observer(co, v, 2), null);
    assert.equal(B.strategieStands.autorise(co, v), false);
    assert.deepEqual(physique(e), avant);
  }
});

test('un drapeau apparu après la décision empêche une nouvelle entrée sans renouveler les pneus', () => {
  const { co, v, e, c } = preparer({ use: .95 });
  e.d = c.stands.d; // l'approche a déjà serré à droite : il reste réellement un dégagement à conduire.
  assert.ok(observer(co, v, 1));
  const avant = physique(e);
  co.drapeau = co.temps;
  const cmd = B.strategieStands.commandes(co, v, {});
  assert.ok(cmd, 'le dégagement reste conduit physiquement');
  assert.equal(B.strategieStands.autorise(co, v), false);
  const ev = []; B.course.stands(co, v, co.dt, ev);
  assert.equal(e.stands, null); assert.equal(ev.length, 0);
  assert.deepEqual(physique(e), avant);
});

test('absence de stands et voiture étrangère ne donnent aucune autorisation', () => {
  const { co, v, e, c } = preparer({ use: .95 }); const avant = physique(e);
  const etranger = { ...v, ia: { ...v.ia, stand: B.strategieStands.creer() } };
  assert.equal(B.strategieStands.commandes(co, etranger, {}), null);
  assert.equal(B.strategieStands.autorise(co, etranger), false);
  c.stands = null;
  assert.equal(B.strategieStands.commandes(co, v, {}), null);
  assert.equal(B.strategieStands.autorise(co, v), false);
  assert.deepEqual(physique(e), avant);
});

test('l’admission relit une occupation humaine apparue depuis le guidage', () => {
  const { co, v, e, c } = preparer({ use: .95 });
  assert.ok(observer(co, v, 1));
  e.s = c.stands.garage0 + 10; e.d = c.stands.dBox; e.v = 0;
  e.stands = { phase: 'voie', t: 0, repare: false }; v.ia.stand.phase = 'voie';
  co.joueur.etat.s = modulo(e.s - 500, c.longueur);
  assert.equal(B.strategieStands.servicePossible(co, v), true);
  // Arrivée de l'autre pilote entre la décision de guidage et l'admission, comme après les contacts d'un pas.
  Object.assign(co.joueur.etat, { s: c.stands.garage0 + 30, d: c.stands.dBox, v: 0 });
  const avant = physique(e); const ev = [];
  assert.equal(B.strategieStands.servicePossible(co, v), false);
  B.course.stands(co, v, co.dt, ev);
  assert.equal(e.stands.phase, 'voie'); assert.equal(ev.length, 0);
  assert.equal(e.servicePneus, avant.servicePneus); assert.deepEqual(e.etatPneus, avant.etatPneus);
});
