// Stations-service de la Route sans fin : atteignables et régulières, droites et plates,
// déterministes à l'index ; le service rend essence, pneus et réparations pendant que
// le compte à rebours continue.
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

verifier('les stations sont régulières, droites, plates et atteignables', () => {
  for (const graine of [GRAINE, 7, 99991]) {
    const st = R.stationsEntre(0, 40000, graine);
    assert.ok(st.length >= 10, 'trop peu de stations sur 40 km : ' + st.length);
    assert.ok(st[0].debutAbs <= 2500, 'première station trop loin : ' + st[0].debutAbs);
    for (let i = 1; i < st.length; i++) {
      const d = st[i].debutAbs - st[i - 1].debutAbs;
      assert.ok(d >= 1800 - 1e-6 && d <= 3600 + 1e-6, 'écart hors bornes à la station ' + i + ' : ' + d);
    }
    for (const s of st) {
      assert.ok(s.garage0 > s.debutAbs && s.garage1 < s.finAbs && s.finAbs - s.debutAbs >= R.LONG_STATION - 1e-6, 'garage hors emprise');
      assert.ok(s.cote === -1 || s.cote === 1, 'côté invalide');
    }
  }
});

verifier('une portion droite et plate reçoit chaque station', () => {
  const trace = R.creerTrace(0, 24, GRAINE);
  const pts = trace.points, pas = R.PAS;
  const st = R.stationsEntre(0, 40000, GRAINE);
  for (const s of st) {
    if (s.finAbs >= trace.arrivee) continue;
    const i0 = Math.round(s.debutAbs / pas), i1 = Math.round(s.finAbs / pas);
    let kap = 0, pen = 0;
    for (let i = i0 + 1; i <= i1 && i < pts.length; i++) {
      const ax = pts[i].x - pts[i - 1].x, az = pts[i].z - pts[i - 1].z;
      const bx = pts[Math.min(i + 1, pts.length - 1)].x - pts[i].x, bz = pts[Math.min(i + 1, pts.length - 1)].z - pts[i].z;
      const na = Math.hypot(ax, az), nb = Math.hypot(bx, bz);
      kap = Math.max(kap, Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz)) / ((na + nb) / 2));
      pen = Math.max(pen, Math.abs(pts[i].y - pts[i - 1].y) / na);
    }
    assert.ok(kap <= 1 / 60, 'courbure sous la station ' + s.debutAbs + ' : ' + kap);
    assert.ok(pen <= 0.10, 'pente sous la station ' + s.debutAbs + ' : ' + pen);
  }
});

verifier('les stations ne dépendent pas de l’ordre des requêtes', () => {
  const attendu = JSON.stringify(R.stationsEntre(0, 30000, GRAINE));
  R.stationsEntre(18000, 26000, GRAINE); R.stationsEntre(0, 4000, GRAINE);
  assert.equal(JSON.stringify(R.stationsEntre(0, 30000, GRAINE)), attendu);
  const autre = JSON.stringify(R.stationsEntre(0, 30000, GRAINE ^ 0x51ed));
  assert.notEqual(autre, attendu, 'la graine ne change rien aux stations');
});

verifier('l’essence dure assez pour atteindre la station la plus éloignée', () => {
  // à l'allure de course (55 m/s plein gaz), la portée doit dépasser l'écart maximal garanti
  const debit = 20 * (0.0008 + 55 * (0.00024 + 0.00048));
  const portee = 72 / debit * 55;
  assert.ok(portee >= 3600 * 1.2, 'portée d’essence insuffisante : ' + portee.toFixed(0) + ' m');
});

const GAZ = { gaz: 1, frein: 0, embrayage: 0, derive: false, rapport: 2 };
const FREIN = { gaz: 0, frein: 1, embrayage: 0, derive: false, rapport: 2 };

verifier('le service rend essence, pneus et réparations, chrono couru', () => {
  const trace = R.creerTrace(0, 4, GRAINE);
  const c = B.circuit.creerDepuisTrace(trace, { topologie: 'ouvert' });
  B.circuit.preparerParcours(c);
  const st = R.stationsEntre(0, c.longueur, GRAINE)[0];
  assert.ok(st, 'aucune station dans la trace d’essai');
  c.stands = { debut: st.debutAbs, fin: st.finAbs, garage0: st.garage0, garage1: st.garage1, cote: st.cote, vitesse: 11 };
  B.circuit.preparerStands(c);
  const S = c.stands;
  assert.ok(S.sBox !== undefined && S.dBox !== undefined, 'préparerStands n’a pas dérivé la station');

  const co = B.course.creer(c, {
    mode: 'sans-fin', rivaux: 0, graine: 5, checkpoints: [{ s: Math.max(50, st.debutAbs - 150) }],
    humains: { noms: ['A'], locaux: [0], hote: true, enLigne: false },
    sansFin: { temps: 300, bonus: 30, conso: 20 },
  });
  const v = co.voitures[0], e = v.etat;
  // feux passés, puis placement direct dans le garage (la conduite jusqu'à la voie est couverte par stands.test)
  const ev = [];
  for (let i = 0; i < Math.round(14 / DT); i++) for (const x of B.course.pas(co, [FREIN], DT)) ev.push(x);
  assert.equal(co.phase, 'course');
  e.s = S.sBox; e.d = S.dBox; e.v = 0.2; e.psi = 0;
  e.carburant = 30;
  for (const p of e.etatPneus) p.usure = 0.5;
  B.degats.choc(v.degats, 10, {});
  assert.ok(B.degats.sante(v.degats) < 1, 'dégâts de test non appliqués');
  const restantAvant = v.sansFin.restant;

  let essenceReparee = -1;
  for (let i = 0; i < Math.round(60 / DT); i++) for (const x of B.course.pas(co, [FREIN], DT)) { ev.push(x); if (x.type === 'stand' && x.phase === 'repare') essenceReparee = e.carburant; }
  for (let i = 0; i < Math.round(30 / DT); i++) for (const x of B.course.pas(co, [GAZ], DT)) ev.push(x);   // sortir de la voie
  const phases = ev.filter(x => x.type === 'stand' && x.id === 0).map(x => x.phase);
  for (const p of ['entree', 'service', 'repare', 'sortie']) assert.ok(phases.includes(p), 'phase ' + p + ' manquante : ' + phases.join(','));
  assert.ok(essenceReparee > 71.5, 'réservoir non refait à la réparation : ' + essenceReparee);
  assert.ok(e.etatPneus.every(p => p.usure < 0.05), 'pneus non changés');
  assert.ok(B.degats.sante(v.degats) > 0.99, 'carrosserie non réparée : ' + B.degats.sante(v.degats));
  assert.ok(restantAvant - v.sansFin.restant >= 20, 'le compte à rebours ne tourne pas pendant le service');
});

console.log(n + ' contrôles de stations-service passés');
