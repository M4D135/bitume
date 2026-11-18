// Monde PhysX de la page, avec le vrai module de FERRO (PhysX 5 en WebAssembly) : un seul monde, né et chauffé dès
// que le module est prêt, vidé (jamais détruit) d'une séance à l'autre ; aucun corps ni aucune dalle ne passe d'une
// séance à la suivante, la démo peut enchaîner les courses sans fin.
// Le chargeur du module refuse Node (il y cherche `process`) : il tourne ici dans un contexte à part, sans `process`,
// comme dans une page. Ce que la scène contient vraiment se lit dans les champs du monde (_bodies, _statics) ; le banc
// du jeu, lui, compte les mondes (FPhysX.status) et les corps de la séance (B.traces.compter).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'course', 'carene', 'main', 'voiture', 'traces']) req(path.join(racine, 'src', f + '.js'));
const B = globalThis.BITUME, T = B.traces, DT = 1 / 120, PIECES = T.PIECES_PAR_VOITURE;

let compte = 0;
async function verifier(nom, f) {
  try { await f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`KO  ${nom}`); console.error(e); process.exit(1); }
}
// Module neuf dans son propre contexte (pas encore initialisé)
function module() {
  const bac = { console, TextDecoder, TextEncoder, atob, btoa, setTimeout, clearTimeout, performance, queueMicrotask, URL, fetch: undefined };
  bac.globalThis = bac; bac.self = bac; bac.window = bac;
  vm.createContext(bac);
  for (const f of ['physx-runtime.js', 'physx.js']) vm.runInContext(fs.readFileSync(path.join(racine, 'src', 'ferro', f), 'utf8'), bac, { filename: f });
  return bac.FPhysX;
}
const ms = (a, b) => (b - a).toFixed(2) + ' ms';
const tour = () => new Promise(r => setTimeout(r, 0));

// Une séance de n voitures sur un vrai tracé (altitudes réelles sous les dalles), garées de 30 m en 30 m
const circuit = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
function seance(n, graine, s0) {
  const voitures = Array.from({ length: n }, (_, k) => ({ id: k, couleur: [.7, .1, .08], etat: { s: s0 + 30 * k, d: 0, v: 40, psi: 0, beta: 0, degats: B.degats.creer() } }));
  const poses = voitures.map(v => { const q = B.circuit.echantillon(circuit, v.etat.s); return { x: q.x, y: q.y + .3, z: q.z, cap: q.cap, tangage: 0, roulis: 0 }; });
  return { fx: T.creer(n, graine), co: { c: circuit, voitures }, poses };
}
const casse = ids => ids.flatMap(k => [0, 1, 2, 3].map(w => ({ type: 'roue', roue: w, id: k })).concat([{ type: 'casse', force: 40, id: k, cote: 1, avant: true }]));
const courir = (s, pas) => { for (let k = 0; k < pas; k++) T.pas(s.fx, s.co, s.poses, 0, DT, null); };
const dalles = fx => T.compter(fx).dalles;

// Ce que coûte à PhysX le premier débris d'une course : cinq dalles, six boîtes lancées, puis le premier pas et la
// première lecture des poses ; dans un monde né à cet instant (code WebAssembly froid, comme avant le monde de la
// page), ou dans le monde de la page déjà chauffé. Chiffres affichés, pas jugés : ils dépendent de la machine.
function premierChoc(w) {
  const t0 = performance.now();
  w.setStatics(Array.from({ length: 5 }, (_, k) => ({ center: [k * 12, -.6, 0], half: [6, 1.2, 11] })));
  const ids = Array.from({ length: PIECES }, (_, k) => { const id = w.addBox([k * .5, 1, 0], [.3, .2, .5], { mass: 4, friction: .75, restitution: .28, ccd: true }); w.setVelocity(id, [5, 4, 1]); return id; });
  const t1 = performance.now();
  w.step(1 / 30); for (const id of ids) { w.readPose(id); w.readVelocity(id); }
  const t2 = performance.now();
  for (const id of ids) w.remove(id);
  w.setStatics([]);
  return `choc ${ms(t0, t1)}, premier pas ${ms(t1, t2)}`;
}
await verifier('repère : premier choc dans un monde neuf, code froid (module à part)', async () => {
  const X0 = module();
  await X0.init();
  const t0 = performance.now(), w = X0.createWorld({ fixedStep: 1 / 60, maxSubSteps: 4 }), t1 = performance.now();
  const chiffres = premierChoc(w);
  w.dispose();
  assert.equal(X0.status().worlds, 0);
  console.log(`    monde né au premier débris : naissance ${ms(t0, t1)}, ${chiffres}`);
});

const X = module();
let monde = null;
await verifier('naissance : une séance née avant le module s y attache dès qu il est prêt ; le monde chauffé reste vide', async () => {
  globalThis.FPhysX = X;
  assert.equal(X.isReady(), false);
  const vitrine = seance(12, 3, 400);
  assert.equal(vitrine.fx.monde, null);
  const t0 = performance.now();
  await X.init(); await tour();
  const t1 = performance.now();
  monde = T.mondePage();
  assert.ok(monde, 'monde de la page créé'); assert.strictEqual(vitrine.fx.monde, monde);
  assert.equal(X.status().worlds, 1);
  assert.equal(monde._bodies.size, 0, 'la boîte de chauffe est retirée'); assert.equal(monde._statics.length, 0, 'la dalle de chauffe aussi');
  assert.equal(monde._acc, 0, 'pas de reliquat de temps');
  const t2 = performance.now(); assert.equal(T.prechauffer(), true); const t3 = performance.now();
  assert.equal(monde._bodies.size, 0); assert.equal(monde._statics.length, 0);
  console.log(`    module prêt et monde chauffé ${ms(t0, t1)} (initialisation du module comprise) ; nouvelle chauffe ${ms(t2, t3)}`);
  console.log(`    monde de la page chauffé : ${premierChoc(monde)}`);
  assert.equal(monde._bodies.size, 0); assert.equal(monde._statics.length, 0); assert.equal(monde._acc, 0);
  T.liberer(vitrine.fx);
});

await verifier('séance : le choc pose corps et dalles dans le monde de la page ; libérée en plein vol, elle n y laisse rien', async () => {
  const s = seance(12, 5, 900);
  assert.strictEqual(s.fx.monde, monde);
  const t0 = performance.now();
  T.pas(s.fx, s.co, s.poses, 0, DT, casse([2, 7]));
  const t1 = performance.now();
  courir(s, 4);                                                        // première passe à 30 Hz : pas et poses
  const t2 = performance.now();
  assert.equal(monde._bodies.size, 2 * PIECES); assert.equal(T.compter(s.fx).corps, 2 * PIECES);
  assert.equal(monde._statics.length, dalles(s.fx)); assert.equal(dalles(s.fx), 10, 'cinq dalles par accident');
  courir(s, 120);                                                      // une seconde de vol
  for (const d of s.fx.debris) if (d.actif) assert.ok(Number.isFinite(d.x + d.y + d.z) && d.y > -50, 'pièce perdue : ' + d.y);
  assert.ok(T.compter(s.fx).corps > 0, 'encore des pièces en vol');
  T.liberer(s.fx);
  assert.equal(monde._bodies.size, 0); assert.equal(monde._statics.length, 0); assert.equal(X.status().worlds, 1);
  assert.strictEqual(T.mondePage(), monde);
  console.log(`    premier choc d'une séance (effets compris, code JavaScript encore froid) : ${ms(t0, t1)}, première passe avec corps ${ms(t1, t2)}`);
});

await verifier('pièces posées : elles quittent la scène et restent où elles sont tombées ; à leur fin de vie, plus rien', async () => {
  const s = seance(4, 6, 1500);
  T.pas(s.fx, s.co, s.poses, 0, DT, casse([1]));
  let posees = 0;
  for (let k = 0; k < 120 * 8 && !posees; k++) { courir(s, 1); posees = s.fx.debris.filter(d => d.actif && !d.corps).length; }
  assert.ok(posees > 0, 'aucune pièce posée en 8 s');
  const d = s.fx.debris.find(e => e.actif && !e.corps), ici = [d.x, d.y, d.z];
  assert.equal(monde._bodies.size, T.compter(s.fx).corps);
  courir(s, 120);
  assert.deepEqual([d.x, d.y, d.z], ici, 'une pièce posée ne bouge plus');
  courir(s, 120 * 13);
  assert.equal(T.compter(s.fx).debris, 0); assert.equal(monde._bodies.size, 0);
  assert.equal(monde._statics.length, dalles(s.fx), 'les dalles restent jusqu à la fin de la séance');
  assert.equal(T.prechauffer(s.fx), true, 'plus de pièce en vol : la chauffe est permise');
  assert.equal(monde._statics.length, dalles(s.fx), 'chauffe : dalles de la séance remises'); assert.equal(monde._bodies.size, 0);
  T.liberer(s.fx);
  assert.equal(monde._statics.length, 0);
});

await verifier('vingt séances de suite : un seul monde, aucun corps ni aucune dalle de reste', async () => {
  let ids = 0;
  for (let n = 0; n < 20; n++) {
    const s = seance(6, 100 + n, 200 + 150 * n);
    assert.strictEqual(s.fx.monde, monde);
    assert.equal(monde._bodies.size, 0); assert.equal(monde._statics.length, 0);
    T.pas(s.fx, s.co, s.poses, 0, DT, casse([n % 6]));
    courir(s, 60);
    ids += T.compter(s.fx).corps;
    if (n % 2) T.liberer(s.fx);                                        // une sur deux est remplacée sans être libérée
  }
  T.liberer(T.creer(1, 1));
  assert.ok(ids > 0);
  assert.equal(X.status().worlds, 1); assert.equal(monde._bodies.size, 0); assert.equal(monde._statics.length, 0);
});

await verifier('argument refusé par PhysX (position non finie) : la pièce garde sa parabole, le monde reste', async () => {
  const s = seance(2, 7, 2600);
  s.poses[0].x = NaN;
  T.pas(s.fx, s.co, s.poses, 0, DT, casse([0, 1]));
  assert.strictEqual(T.mondePage(), monde); assert.strictEqual(s.fx.monde, monde); assert.equal(X.status().worlds, 1);
  assert.equal(T.compter(s.fx).corps, PIECES, 'les pièces de la voiture valide ont leur corps');
  courir(s, 8);
  T.liberer(s.fx);
  assert.equal(monde._bodies.size, 0); assert.equal(monde._statics.length, 0);
});

console.log('---');
console.log(compte + ' tests passes');
process.exit(0);
