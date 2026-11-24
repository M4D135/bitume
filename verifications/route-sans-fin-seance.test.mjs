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
  let reprises = 0, dernierReprise = -1e9, c = s.cPorteur, station = JSON.stringify(s.cPorteur.stands);
  const DIST = 16500;
  for (let i = 0; i <= 120 * 300; i++) {
    const sAbs = Math.min(DIST, i * 55 * DT);
    const pos = [sAbs - s.cPorteur.sansFinFenetre.sOrigine];   // abscisses RELATIVES au monde bâti (comme etat.s en jeu)
    // invariant de sûreté : le monde construit couvre toujours le joueur et sa marge de tête
    const marge = s.fenetre.sOrigine + s.fenetre.longueur - sAbs;
    assert.ok(marge > 500, 'le joueur rejoint le bord construit à ' + sAbs + ' (marge ' + marge.toFixed(0) + ' m)');
    assert.ok(sAbs - s.fenetre.sOrigine >= -1e-6, 'joueur derrière la fenêtre à ' + sAbs);
    if (S.avancer(s, pos, DT)) {
      reprises++;
      const nouvelle = JSON.stringify(s.cPorteur.stands);
      assert.ok(s.cPorteur !== c || nouvelle !== station, 'rendu vrai sans rien de changé dans le monde bâti');
      assert.ok(sAbs - dernierReprise > 90, 'reprises harcelées à ' + sAbs + ' (à ' + (sAbs - dernierReprise).toFixed(0) + ' m de la précédente)');
      dernierReprise = sAbs; c = s.cPorteur; station = nouvelle;
    }
  }
  assert.ok(reprises >= DIST / 2500, 'jamais repris le décor sur ' + DIST + ' m : ' + reprises);
  assert.ok(reprises <= DIST / 300, 'reprises trop fréquentes : ' + reprises + ' sur ' + DIST + ' m');
  assert.ok(s.fenetre.sOrigine > 1000, 'origine jamais avancée : ' + s.fenetre.sOrigine);
  assert.ok(s.checkpoints.some(cp => cp.s > DIST), 'checkpoints non allongés devant le joueur');
});

verifier('la station active est posée et dérivée sur le circuit courant', () => {
  const s = S.creer({ graine: GRAINE });
  let trouvée = null;
  for (let i = 0; i < 120 * 90 && !trouvée; i++) {
    S.avancer(s, [Math.min(14000, i * 55 * DT) - (s.cPorteur ? s.cPorteur.sansFinFenetre.sOrigine : 0)], DT);
    if (s.cPorteur.stands && s.cPorteur.stands.sBox !== undefined) trouvée = { s: i * 55 * DT, stands: s.cPorteur.stands, origine: s.cPorteur.sansFinFenetre.sOrigine };
  }
  assert.ok(trouvée, 'aucune station active en 14 km de route');
  const st = trouvée.stands;
  assert.ok(st.fin - st.debut >= B.routeSansFin.LONG_STATION - 1e-6);
  assert.ok(st.sBox > st.debut && st.sBox < st.fin && Number.isFinite(st.dBox), 'préparerStands non appliqué à la station active');
});

verifier('mêmes positions, même monde autour des joueurs, quel que soit le chemin', () => {
  const a = S.creer({ graine: GRAINE }), b = S.creer({ graine: GRAINE });
  for (let i = 0; i <= 120 * 40; i++) S.avancer(a, [i * 55 * DT - a.cPorteur.sansFinFenetre.sOrigine], DT);
  S.avancer(b, [40 * 55 - b.cPorteur.sansFinFenetre.sOrigine], S.AVANCE_FENETRE);   // directement à la même position finale
  const sFinal = 40 * 55;
  for (const s of [a, b]) assert.ok(sFinal - s.fenetre.sOrigine >= 0 && sFinal - s.fenetre.sOrigine <= s.fenetre.longueur, 'joueur hors fenêtre');
  // la géométrie autour du joueur est la même, quoi que la fenêtre traîne derrière
  for (const d of [-400, 0, 500, 1200]) {
    const qa = B.circuit.echantillon(a.c, sFinal - a.fenetre.sOrigine + d);
    const qb = B.circuit.echantillon(b.c, sFinal - b.fenetre.sOrigine + d);
    assert.ok(Math.hypot(qa.x - qb.x, qa.y - qb.y, qa.z - qb.z) < 0.02 && Math.abs(qa.cap - qb.cap) < 1e-4, 'monde différent à ' + d + ' m du joueur');
  }
  assert.equal(JSON.stringify(a.checkpoints), JSON.stringify(b.checkpoints));
  const abs = f => f.cPorteur.stands ? (f.cPorteur.stands.debut + f.cPorteur.sansFinFenetre.sOrigine) + ':' + (f.cPorteur.stands.fin + f.cPorteur.sansFinFenetre.sOrigine) : null;
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
