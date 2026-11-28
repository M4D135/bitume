// Route sans fin, panne sèche (David, 28/11, à sec à 5,86 km : « je ne peux plus accélérer, juste reculer ») :
// à sec, ni moteur ni marche arrière, la voiture roule en roue libre ; arrêtée hors d'une station, la route finit
// (« panne ») ; dans la voie d'une station, l'équipe la pousse jusqu'au box, qui refait le plein ; la voiture que
// conduit l'ordinateur (démo, banc) roule sans consommer ; la liste des stations s'allonge sans se refaire.
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
const DT = 1 / 120, GRAINE = 31415;
// marcheArriere : celle du joueur, toujours vraie (le recul s'engage au frein maintenu à l'arrêt)
const GAZ = { gaz: 1, frein: 0, embrayage: 0, derive: false, rapport: 2, marcheArriere: true };
const RIEN = { gaz: 0, frein: 0, embrayage: 0, derive: false, rapport: 2, marcheArriere: true };
const FREIN = { gaz: 0, frein: 1, embrayage: 0, derive: false, rapport: 2, marcheArriere: true };

function avancer(co, cmd, secondes, ev, chaquePas) {
  for (let i = 0; i < Math.round(secondes / DT); i++) {
    for (const x of B.course.pas(co, [cmd], DT)) if (ev) ev.push(x);
    if (chaquePas) chaquePas();
  }
}
function creer() {
  const trace = R.creerTrace(0, 4, GRAINE);
  const c = B.circuit.creerDepuisTrace(trace, { topologie: 'ouvert' });
  B.circuit.preparerParcours(c);
  const st = R.stationsEntre(0, c.longueur, GRAINE)[0];
  assert.ok(st, 'aucune station dans la trace d’essai');
  c.stands = { debut: st.debutAbs, fin: st.finAbs, garage0: st.garage0, garage1: st.garage1, cote: st.cote, vitesse: 11 };
  B.circuit.preparerStands(c);
  const co = B.course.creer(c, {
    mode: 'sans-fin', rivaux: 0, graine: 5, checkpoints: [{ s: 3000 }],
    humains: { noms: ['A'], locaux: [0], hote: true, enLigne: false },
    sansFin: { temps: 300, bonus: 30, conso: 20 },
  });
  // grille, feux, puis cinq secondes de course : avant, le stand n'accueille personne
  avancer(co, FREIN, 20);
  assert.equal(co.phase, 'course');
  return { c, co, v: co.voitures[0], e: co.voitures[0].etat, S: c.stands };
}
// le frein maintenu sur la grille a engagé le recul : la voiture posée repart en marche avant
function poser(e, s, d, v, carburant) {
  e.s = s; e.d = d; e.psi = 0; e.v = v; e.rapport = 1; e.freinRecul = 0;
  if (carburant !== undefined) e.carburant = carburant;
}

verifier('à sec, la voiture n’accélère plus, roule en roue libre et ne recule plus', () => {
  const { co, v, e, S } = creer();
  poser(e, Math.max(200, S.debut - 900), 0, 25, 0);
  const ev = [];
  avancer(co, GAZ, 1, ev);
  assert.ok(e.v < 25 && e.v > 15, 'à sec, plein gaz : ' + e.v.toFixed(2) + ' m/s');
  avancer(co, RIEN, 1, ev);
  assert.ok(e.v > 1, 'la roue libre s’arrête trop vite : ' + e.v.toFixed(2));
  assert.ok(!ev.some(x => x.type === 'elimine'), 'éliminée alors qu’elle roule');
  // frein jusqu'à l'arrêt, puis frein maintenu : le recul ne s'engage pas
  let vMin = Infinity, rapportMin = Infinity;
  avancer(co, FREIN, 2, ev, () => { vMin = Math.min(vMin, e.v); rapportMin = Math.min(rapportMin, e.rapport); });
  assert.ok(Math.abs(e.v) < .5, 'pas arrêtée après deux secondes de frein : ' + e.v.toFixed(2));
  avancer(co, FREIN, 2, ev, () => { vMin = Math.min(vMin, e.v); rapportMin = Math.min(rapportMin, e.rapport); });
  assert.ok(vMin > -.1 && rapportMin >= 0, 'marche arrière à sec : v ' + vMin.toFixed(2) + ', rapport ' + rapportMin);
  // arrêtée depuis plus de 2,5 s : la route est finie, pour panne
  assert.equal(v.sansFin.cause, 'panne');
});

verifier('arrêtée à sec hors d’une station, la route finit en panne sèche', () => {
  const { co, v, e, S } = creer();
  poser(e, Math.max(200, S.debut - 900), 0, 0, 0);
  const ev = [];
  avancer(co, FREIN, 2.4, ev);
  assert.equal(v.sansFin.elimine, false, 'panne déclarée avant 2,5 s');
  avancer(co, FREIN, .3, ev);
  const el = ev.find(x => x.type === 'elimine' && x.id === v.id);
  assert.ok(el, 'aucune élimination après 2,7 s à l’arrêt et à sec');
  assert.equal(el.cause, 'panne');
  assert.equal(v.sansFin.cause, 'panne');
  assert.equal(v.abandon, true);
  assert.ok(v.sansFin.restant > 200, 'le compte à rebours a été vidé : ' + v.sansFin.restant);
});

verifier('le compte à rebours qui tombe à zéro donne la cause « temps »', () => {
  const { co, v, e, S } = creer();
  poser(e, Math.max(200, S.debut - 900), 0, 0);
  v.sansFin.restant = .5;
  const ev = [];
  avancer(co, FREIN, 1, ev);
  const el = ev.find(x => x.type === 'elimine' && x.id === v.id);
  assert.ok(el && el.cause === 'temps' && v.sansFin.cause === 'temps', 'cause : ' + (el && el.cause));
});

verifier('dans la voie d’une station, l’équipe pousse la voiture à sec jusqu’au box, qui refait le plein', () => {
  const { co, v, e, S } = creer();
  poser(e, S.garage0 + 2, S.dBox, 0, 0);
  const ev = [];
  let service = false, poussee = 0;
  for (let i = 0; i < Math.round(30 / DT) && !service; i++) {
    const reste = B.circuit.ecart(co.c, e.s, S.sBox);
    for (const x of B.course.pas(co, [reste > 1.2 ? GAZ : FREIN], DT)) {
      ev.push(x);
      if (x.type === 'stand' && x.phase === 'service') service = true;
    }
    poussee = Math.max(poussee, e.v);
  }
  assert.ok(!ev.some(x => x.type === 'elimine'), 'panne sèche dans la voie de la station');
  assert.ok(service, 'la voiture poussée n’a pas atteint le service (vitesse max ' + poussee.toFixed(2) + ' m/s)');
  assert.ok(poussee <= S.vitesse + .5, 'poussée au-delà du limiteur de la voie : ' + poussee.toFixed(2));
  avancer(co, FREIN, 50, ev);
  assert.ok(e.carburant > 71.5, 'plein non fait : ' + e.carburant.toFixed(1));
  assert.equal(v.sansFin.elimine, false);
});

verifier('la voiture que conduit l’ordinateur roule sans consommer', () => {
  const { co, e, S } = creer();
  poser(e, Math.max(200, S.debut - 900), 0, 30);
  const l0 = e.carburant;
  co.sansFin.essenceLibre = true;
  avancer(co, GAZ, 3);
  assert.equal(e.carburant, l0, 'consommation en essence libre');
  co.sansFin.essenceLibre = false;
  avancer(co, GAZ, 3);
  assert.ok(e.carburant < l0 - 1, 'la consommation ne reprend pas : ' + e.carburant.toFixed(2));
});

verifier('la liste des stations s’allonge sans se refaire et ne dépend pas des requêtes', () => {
  const graine = 271828;
  const pasAPas = [];
  for (let s = 0; s < 40000; s += 350) for (const st of R.stationsEntre(s - R.LONG_STATION, s + 5000, graine))
    if (!pasAPas.some(x => x.debutAbs === st.debutAbs)) pasAPas.push(st);
  pasAPas.sort((a, b) => a.debutAbs - b.debutAbs);
  const dUnCoup = R.stationsEntre(-R.LONG_STATION, 45000, graine);
  assert.equal(JSON.stringify(pasAPas), JSON.stringify(dUnCoup), 'les requêtes glissantes ne voient pas les mêmes stations');
  const t = performance.now();
  for (let s = 20000; s < 40000; s += 50) R.stationsEntre(s - R.LONG_STATION, s + 5000, graine);
  console.log('  400 requêtes glissantes dans des tronçons calculés : ' + (performance.now() - t).toFixed(1) + ' ms');
});

console.log(n + ' contrôles de panne sèche passés');
