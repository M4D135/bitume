// Mode « Route sans fin » : compte à rebours, checkpoints qui rendent du temps, élimination
// à zéro sans bloquer les autres, chrono par joueur, aucun bonus répété par marche arrière.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const req = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const m of ['circuit', 'route-sans-fin', 'chaussee', 'pneus', 'usure-pneus', 'conduite', 'degats', 'contacts', 'strategie-stands', 'course'])
  req(path.join(ROOT, 'src', m + '.js'));
const B = globalThis.BITUME, R = B.routeSansFin;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };
const DT = 1 / 120;

function creerCourse(opts = {}) {
  const trace = R.creerTrace(0, 4, 4242);
  const c = B.circuit.creerDepuisTrace(trace, { topologie: 'ouvert' });
  B.circuit.preparerParcours(c);
  const checkpoints = opts.checkpoints || [{ s: 400 }, { s: 800 }, { s: 1200 }];
  const co = B.course.creer(c, {
    mode: 'sans-fin', rivaux: 0, graine: 7, checkpoints,
    humains: { noms: ['A', 'B'], locaux: [0, 1], hote: true, enLigne: false },
    sansFin: Object.assign({ temps: 20, bonus: 15 }, opts.sansFin || {}),
  });
  return { c, co };
}
const GAZ = { gaz: 1, frein: 0, embrayage: 0, derive: false, rapport: 2 };
const RIEN = { gaz: 0, frein: 0, embrayage: 0, derive: false, rapport: 2 };
const RECUL = { gaz: 0, frein: 1, embrayage: 0, derive: false, rapport: 2 };

function avancer(co, cmds, secondes, ev) {
  const pas = Math.round(secondes / DT);
  for (let i = 0; i < pas; i++) {
    const rendus = B.course.pas(co, cmds, DT);
    for (const e of rendus) ev.push(e);
  }
}

verifier('le compte à rebours court pendant la course et pas avant', () => {
  const { co } = creerCourse();
  const ev = [];
  avancer(co, [GAZ, GAZ], 1.0, ev);   // grille : rien ne décompte
  const a = co.voitures[0].sansFin;
  assert.equal(a.restant, 20, 'décompte pendant la grille : ' + a.restant);
  assert.equal(co.phase, 'grille');
});

verifier('un checkpoint franchi rend du temps, une seule fois', () => {
  const { co } = creerCourse();
  const ev = [], v = co.voitures[0];
  avancer(co, [GAZ, GAZ], 30, ev);
  const cp = ev.filter(e => e.type === 'checkpoint' && e.id === 0);
  assert.ok(cp.length >= 1, 'aucun checkpoint validé : ' + JSON.stringify(ev.map(e => e.type)));
  assert.equal(cp[0].checkpoint, 0);
  assert.ok(cp[0].reste > 15 - 1 && cp[0].reste < 20 + 15, 'temps rendu incohérent : ' + cp[0].reste);
  assert.equal(v.sansFin.checkpoint, cp.length - 1 < 3 ? cp.length - 1 : 2);
  // marche arrière sous le checkpoint, puis retour : aucun second bonus
  const avant = v.sansFin.restant, index = v.sansFin.checkpoint;
  avancer(co, [RECUL, GAZ], 12, ev);
  assert.ok(v.sansFin.sAbsolu < v.sansFin.sMax, 'la marche arrière ne recule pas sAbsolu — test à revoir');
  const apres = v.sansFin.restant;
  avancer(co, [GAZ, GAZ], 15, ev);
  assert.equal(v.sansFin.checkpoint, index, 'checkpoint revalidé par un retour');
  assert.ok(ev.filter(e => e.type === 'checkpoint' && e.id === 0).length === cp.length, 'bonus répété');
  void avant; void apres;
});

verifier('à zéro seconde le joueur est éliminé sans bloquer l’autre', () => {
  const { co } = creerCourse();
  const ev = [];
  avancer(co, [GAZ, RIEN], 34, ev);
  const b = co.voitures[1], a = co.voitures[0];
  const el = ev.find(e => e.type === 'elimine' && e.id === 1);
  assert.ok(el, 'B jamais éliminé');
  assert.equal(b.sansFin.elimine, true);
  assert.equal(b.abandon, true);
  assert.equal(a.sansFin.elimine, false, 'A éliminé à tort');
  assert.equal(co.termine, false, 'la course s’est arrêtée alors qu’un joueur roule');
  assert.ok(a.sansFin.temps > b.sansFin.temps, 'chronos par joueur identiques');
});

verifier('la progression ne recule jamais et la course finit quand tous sont éliminés', () => {
  const { co } = creerCourse();
  const ev = [], a = co.voitures[0];
  let dernier = -1;
  for (let i = 0; i < 120 * 90; i++) {
    for (const e of B.course.pas(co, [i < 120 * 30 ? GAZ : RIEN, RIEN], DT)) ev.push(e);
    assert.ok(a.progression >= dernier, 'progression régressive à ' + i);
    dernier = a.progression;
    if (co.termine) break;
  }
  assert.equal(co.termine, true, 'course non terminée après élimination de tous');
  assert.equal(a.sansFin.elimine, true);
  assert.equal(co.voitures[1].sansFin.elimine, true);
});

verifier('le mode reste un parcours ouvert sans ligne d’arrivée', () => {
  const { co } = creerCourse();
  assert.equal(co.mode, 'sans-fin');
  assert.equal(co.sansFin.checkpoints.length, 3);
  assert.equal(co.voitures[0].fini, false);
  const ev = [];
  avancer(co, [GAZ, GAZ], 40, ev);
  assert.equal(co.voitures[0].fini, false, 'une ligne d’arrivée a été franchie');
  assert.equal(ev.find(e => e.type === 'arrivee'), undefined);
});

console.log(n + ' contrôles de mode sans fin passés');
