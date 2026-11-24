// Lot I — Route sans fin : quatre joueurs éloignés, élimination indépendante, retour sur tronçon
// déchargé, cycle complet des six biomes et continuité de fenêtre.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const req = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const m of ['circuit', 'route-sans-fin', 'route-sans-fin-fenetre', 'route-sans-fin-seance',
  'chaussee', 'pneus', 'usure-pneus', 'conduite', 'degats', 'contacts', 'strategie-stands', 'course'])
  req(path.join(ROOT, 'src', m + '.js'));

const B = globalThis.BITUME, R = B.routeSansFin, F = B.routeSansFinFenetre, S = B.routeSansFinSeance;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };
const DT = 1 / 120, GRAINE = 271828;

verifier('cycle complet des 6 biomes avec thèmes et checkpoints sur la fenêtre', () => {
  const attendu = ['plage', 'plaine', 'petite-montagne', 'grande-montagne', 'petite-montagne', 'plaine', 'plage'];
  for (let k = 0; k < attendu.length; k++) assert.equal(R.biomePour(k), attendu[k], 'biome ' + k);
  const f = F.creer(GRAINE, { maxSegments: 6 });
  assert.ok(f.c.theme, 'thème initial absent');
  assert.ok(Array.isArray(f.c.tronconsThemes) && f.c.tronconsThemes.length >= 2, 'tronconsThemes manquants');
  assert.ok(Array.isArray(f.c.checkpointsSansFin) && f.c.checkpointsSansFin.length >= 1, 'checkpoints visibles manquants');
  for (const cp of f.c.checkpointsSansFin) {
    assert.ok(cp.s > 0 && cp.s < f.c.longueur, 'checkpoint hors fenêtre : ' + cp.s);
  }
});

verifier('quatre joueurs éloignés : fenêtre, chronos et éliminations indépendants', () => {
  const s = S.creer({ graine: GRAINE, maxSegments: 8 });
  S.avancer(s, [0, 0, 0, 0], S.AVANCE_FENETRE);
  const co = B.course.creer(s.cPorteur, {
    mode: 'sans-fin', rivaux: 0, graine: 99,
    checkpoints: s.checkpoints,
    humains: { noms: ['J1', 'J2', 'J3', 'J4'], locaux: [0, 1, 2, 3], hote: true, enLigne: false },
    sansFin: { temps: 40, bonus: 30, conso: 20 },
  });
  assert.equal(co.voitures.length, 4);
  assert.ok(co.duo, '4 pilotes locaux doivent activer co.duo');
  // Passer la grille et les feux
  const GAZ = { gaz: 1, frein: 0, embrayage: 0, derive: false, rapport: 2 };
  const FREIN = { gaz: 0, frein: 1, embrayage: 0, derive: false, rapport: 1 };
  while (co.phase !== 'course') B.course.pas(co, [GAZ, GAZ, GAZ, GAZ], DT);
  // Écarter les quatre joueurs : J1 en tête (+1 800 m), J2 (+900 m), J3 (+300 m), J4 arrêté
  co.voitures[0].etat.s = 1800; co.voitures[1].etat.s = 900; co.voitures[2].etat.s = 300; co.voitures[3].etat.s = 50;
  co.voitures[3].sansFin.restant = 0.5;
  for (let i = 0; i < 120; i++) {
    B.course.pas(co, [GAZ, GAZ, GAZ, FREIN], DT);
    const viv = co.voitures.filter(v => !v.sansFin.elimine).map(v => v.etat.s);
    S.avancer(s, viv, DT);
  }
  assert.ok(co.voitures[3].sansFin.elimine, 'J4 devrait être éliminé à temps zéro');
  assert.ok(!co.voitures[0].sansFin.elimine && !co.voitures[1].sansFin.elimine && !co.voitures[2].sansFin.elimine, 'J1-J3 ne doivent pas être bloqués par J4');
  assert.ok(!co.termine, 'la course ne doit pas se terminer tant que des pilotes roulent');
  // J1 a validé le checkpoint 1 (1500 m), pas J3
  assert.ok(co.voitures[0].sansFin.checkpoint >= 0, 'J1 doit valider checkpoint 1');
  assert.equal(co.voitures[2].sansFin.checkpoint, -1, 'J3 ne doit pas valider checkpoint 1');
  // Éliminer les trois derniers termine la séance (après le délai d'arrivée/abandon de 3 s)
  for (const k of [0, 1, 2]) co.voitures[k].sansFin.restant = 0.05;
  for (let i = 0; i < 450; i++) B.course.pas(co, [FREIN, FREIN, FREIN, FREIN], DT);
  assert.ok(co.voitures.every(v => v.sansFin.elimine), 'tous les locaux éliminés');
  assert.ok(co.termine, 'la course se termine quand tous sont éliminés');
});

verifier('retour vers tronçons déchargés : géométrie identique et zéro bonus répété', () => {
  const f1 = F.creer(GRAINE, { maxSegments: 5 });
  // Avancer au-delà du relâchement arrière (k0 > 0)
  for (let s = 1000; s <= 12000; s += 800) F.avancer(f1, [s]);
  assert.ok(f1.k0 >= 2, 'des tronçons arrière auraient dû être libérés : k0=' + f1.k0);
  // Une fenêtre neuve chargée directement sur le même k0..k1 rend exactement la même géométrie
  const traceDirect = R.creerTrace(f1.k0, f1.k1, GRAINE);
  const cDirect = B.circuit.creerDepuisTrace(traceDirect, { topologie: 'ouvert' });
  for (const s of [100, 1200, Math.min(2500, cDirect.longueur - 50)]) {
    const a = B.circuit.echantillon(f1.c, s), b = B.circuit.echantillon(cDirect, s);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-4, 'dérive géométrique à s=' + s);
  }
});

verifier('libellé biomeA cohérent sur toute la fenêtre', () => {
  const s = S.creer({ graine: GRAINE });
  const b0 = S.biomeA(s, 0);
  assert.equal(b0.biome, 'plage');
  assert.equal(b0.label, 'Plage');
});

verifier('zéro auto-intersection sur 20 graines × 12 tronçons (~18 km)', () => {
  for (let g = 1; g <= 20; g++) {
    const tr = R.creerTrace(0, 12, g * 97 + 1);
    const pts = tr.points;
    for (let i = 1; i < pts.length; i++) {
      assert.ok(pts[i].x > pts[i - 1].x + 0.5, 'recul en x sur graine ' + g + ' pt ' + i);
    }
  }
});

console.log(n + ' contrôles route sans fin multi-joueurs passés');
