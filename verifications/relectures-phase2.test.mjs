// Régressions ciblées des relectures Spark retenues après vérification du code actuel.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));
for (const f of ['circuit.js', 'conduite.js', 'carene.js', 'main.js', 'voiture.js', 'traces.js', 'course.js']) charger(f);
const B = globalThis.BITUME, CD = B.conduite, T = B.traces, DT = 1 / 120;

let passes = 0;
function verifier(nom, f) {
  try { f(); passes++; console.log('ok  ' + nom); }
  catch (e) { console.error('KO  ' + nom); console.error(e); process.exit(1); }
}

function ligne({ largeur = 12, limite = 20 } = {}) {
  const c = { longueur: 10000, largeur, limite };
  B.circuit = { echantillon: () => ({ x: 0, y: 0, z: 0, cap: 0, courbure: 0, pente: 0, devers: 0, ligne: 0, vitesse: 0 }), vibreurA: () => false };
  return c;
}

verifier('conduite : une limite gauche nulle reste une limite', () => {
  const c = ligne(); c.limiteG = 0;
  B.circuit.limiteA = (circuit, s, cote) => cote < 0 ? circuit.limiteG : 20;
  assert.equal(CD.limiteCote(c, 0, -1), 0);
  delete B.circuit.limiteA;
});

verifier('conduite : perte de dérive et seuil de turbo sont distincts', () => {
  const c = ligne(), et = CD.creer(0, 0);
  et.v = 30;
  Object.assign(et.derive, { actif: true, sens: 1, niveau: 1, palier: 1, perte: .25, fenetre: 0, grace: .18 });
  const ev = CD.pas(et, { gaz: 1, frein: 0, volant: 0, derive: false, boite: 'auto', aide: 0 }, c, DT);
  assert.ok(ev.some(e => e.type === 'turbo'), 'un niveau 1 encore récupérable doit donner un turbo');
});

verifier('conduite : une nouvelle dérive repart sans fondu résiduel', () => {
  const et = CD.creer(0, 0);
  Object.assign(et.derive, { actif: true, amorce: .7, melange: .8, tirage: .9 });
  CD.annulerDerive(et);
  assert.deepEqual([et.derive.amorce, et.derive.melange, et.derive.tirage], [0, 0, 0]);
});

verifier('conduite : pente et dévers invalides ne contaminent pas la voiture', () => {
  const c = { longueur: 10000, largeur: 12, limite: 20 };
  B.circuit = { echantillon: () => ({ x: 0, y: 0, z: 0, cap: 0, courbure: 0, pente: NaN, devers: NaN, ligne: 0, vitesse: 0 }), vibreurA: () => false };
  const et = CD.creer(0, 0); et.v = 30;
  CD.pas(et, { gaz: 1, frein: 0, volant: 0, derive: false, boite: 'auto', aide: 0 }, c, DT);
  for (const k of ['s', 'd', 'v', 'psi', 'omega', 'chargeX', 'chargeY']) assert.ok(Number.isFinite(et[k]), k);
});

verifier('traces : la graine zéro est distincte de la graine un', () => {
  const a = T.creer(1, 0), b = T.creer(1, 1);
  assert.notEqual(a.alea(), b.alea());
});

verifier('traces : une force de contact négative garde une gerbe minimale', () => {
  const fx = T.creer(2, 7), co = { longueur: 1000, voitures: [{ etat: { v: 20, beta: 0 } }, { etat: { v: 20, beta: 0 } }] };
  const poses = [{ x: 0, y: 0, z: 0, cap: 0 }, { x: 1, y: 0, z: 0, cap: 0 }];
  T.pas(fx, co, poses, 0, DT, [{ type: 'contact', a: 0, b: 1, force: -10 }]);
  assert.equal(T.compter(fx).etincelles, 10); // gerbe minimale portée à 10 par 7dfc247 (chocs plus spectaculaires)
});

console.log('---');
console.log(passes + '/6 tests passes');
