// Séance « Route sans fin » : fenêtre pilotée, checkpoints allongés à mesure, station active
// posée sur le circuit courant, abscisse absolue lue du repère de fenêtre (pas d'accumulation).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const req = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const m of ['circuit', 'route-sans-fin', 'route-sans-fin-fenetre', 'route-sans-fin-seance',
  'chaussee', 'pneus', 'usure-pneus', 'conduite', 'degats', 'contacts', 'strategie-stands', 'course'])
  req(path.join(ROOT, 'src', m + '.js'));
const B = globalThis.BITUME, S = B.routeSansFinSeance;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };
const DT = 1 / 120, GRAINE = 161803;

verifier('la séance naît avec la fenêtre et les checkpoints de tête', () => {
  const s = S.creer({ graine: GRAINE });
  assert.ok(s.c && s.c.ouvert, 'pas de circuit ouvert');
  assert.ok(s.checkpoints.length >= 4, 'checkpoints de tête manquants : ' + s.checkpoints.length);
  assert.equal(s.checkpoints[0].s, S.PAS_CHECKPOINT);
  assert.equal(s.station, null, 'une station dès le départ ?');
});

verifier('la fenêtre glisse et le circuit est rendu changant', () => {
  const s = S.creer({ graine: GRAINE });
  let glissements = 0, c = s.c, station = JSON.stringify(s.c.stands);
  for (let i = 0; i < 120 * 60; i++) {
    const pos = [Math.min(9000, i * 55 * DT) - s.fenetre.sOrigine];   // abscisses RELATIVES à la fenêtre
    if (S.avancer(s, pos, DT)) {
      glissements++;
      const nouvelle = JSON.stringify(s.c.stands);
      assert.ok(s.c !== c || nouvelle !== station, 'rendu vrai sans rien de changé');
      c = s.c; station = nouvelle;
    }
  }
  assert.ok(glissements >= 3, 'la fenêtre n’a jamais glissé en 60 s à 55 m/s');
  assert.ok(s.fenetre.sOrigine > 1000, 'origine jamais avancée : ' + s.fenetre.sOrigine);
  assert.ok(s.checkpoints.some(cp => cp.s > 3300), 'checkpoints non allongés devant le joueur');
});

verifier('la station active est posée et dérivée sur le circuit courant', () => {
  const s = S.creer({ graine: GRAINE });
  let trouvée = null;
  for (let i = 0; i < 120 * 90 && !trouvée; i++) {
    S.avancer(s, [Math.min(14000, i * 55 * DT) - s.fenetre.sOrigine], DT);
    if (s.c.stands && s.c.stands.sBox !== undefined) trouvée = { s: i * 55 * DT, stands: s.c.stands, origine: s.c.sansFinFenetre.sOrigine };
  }
  assert.ok(trouvée, 'aucune station active en 14 km de route');
  const st = trouvée.stands;
  assert.ok(st.fin - st.debut >= B.routeSansFin.LONG_STATION - 1e-6);
  assert.ok(st.sBox > st.debut && st.sBox < st.fin && Number.isFinite(st.dBox), 'préparerStands non appliqué à la station active');
});

verifier('mêmes positions, même monde autour des joueurs, quel que soit le chemin', () => {
  const a = S.creer({ graine: GRAINE }), b = S.creer({ graine: GRAINE });
  for (let i = 0; i <= 120 * 40; i++) S.avancer(a, [i * 55 * DT - a.fenetre.sOrigine], DT);
  S.avancer(b, [40 * 55 - b.fenetre.sOrigine], S.AVANCE_FENETRE);   // directement à la même position finale
  const sFinal = 40 * 55;
  for (const s of [a, b]) assert.ok(sFinal - s.fenetre.sOrigine >= 0 && sFinal - s.fenetre.sOrigine <= s.fenetre.longueur, 'joueur hors fenêtre');
  // la géométrie autour du joueur est la même, quoi que la fenêtre traîne derrière
  for (const d of [-400, 0, 500, 1200]) {
    const qa = B.circuit.echantillon(a.c, sFinal - a.fenetre.sOrigine + d);
    const qb = B.circuit.echantillon(b.c, sFinal - b.fenetre.sOrigine + d);
    assert.ok(Math.hypot(qa.x - qb.x, qa.y - qb.y, qa.z - qb.z) < 0.02 && Math.abs(qa.cap - qb.cap) < 1e-4, 'monde différent à ' + d + ' m du joueur');
  }
  assert.equal(JSON.stringify(a.checkpoints), JSON.stringify(b.checkpoints));
  const abs = f => f.c.stands ? (f.c.stands.debut + f.c.sansFinFenetre.sOrigine) + ':' + (f.c.stands.fin + f.c.sansFinFenetre.sOrigine) : null;
  assert.equal(abs(a), abs(b), 'station active absolue différente');
});

const GAZ = { gaz: 1, frein: 0, embrayage: 0, derive: false, rapport: 2 };
const RIEN = { gaz: 0, frein: 0, embrayage: 0, derive: false, rapport: 2 };

verifier('un décalage de fenêtre ne fausse ni l’abscisse ni les checkpoints', () => {
  const f = B.routeSansFinFenetre.creer(GRAINE, { maxSegments: 8 });
  const c = f.c;
  c.sansFinFenetre = { k0: f.k0, k1: f.k1, sOrigine: f.sOrigine };
  const co = B.course.creer(c, {
    mode: 'sans-fin', rivaux: 0, graine: 3, checkpoints: [{ s: 900 }, { s: 1800 }],
    humains: { noms: ['A'], locaux: [0], hote: true, enLigne: false },
    sansFin: { temps: 400, bonus: 30, conso: 20 },
  });
  const v = co.voitures[0], e = v.etat;
  for (let i = 0; i < Math.round(10 / DT); i++) B.course.pas(co, [GAZ], DT);   // feux + départ
  const avant = v.sansFin.sAbsolu;
  assert.ok(avant > 10, 'le joueur n’a pas avancé : ' + avant);
  // décalage de fenêtre : 1 000 m libérés derrière, le joueur garde sa position absolue
  c.sansFinFenetre.sOrigine += 1000;
  e.s -= 1000;
  for (let i = 0; i < Math.round(2 / DT); i++) B.course.pas(co, [RIEN], DT);
  assert.ok(Math.abs(v.sansFin.sAbsolu - (avant + (v.sansFin.sMax - avant) * 0)) >= avant - 1, 'abscisse absolue perdue au décalage');
  assert.ok(v.sansFin.sAbsolu >= avant, 'l’abscisse absolue a reculé au décalage de fenêtre');
  // checkpoint validé une seule fois malgré un retour en arrière
  const cp1 = v.sansFin.checkpoint;
  e.v = -12;
  for (let i = 0; i < Math.round(6 / DT); i++) B.course.pas(co, [RIEN], DT);
  assert.equal(v.sansFin.checkpoint, cp1, 'checkpoint perdu ou revalidé par un retour');
});

console.log(n + ' contrôles de séance sans fin passés');
