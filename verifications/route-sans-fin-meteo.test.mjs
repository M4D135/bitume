// Météo cyclique de la Route sans fin : la cible vient du relief du monde bâti, avec hystérésis ;
// le moteur météo respecte la cible à la transition suivante et garde son cycle sans cible.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const req = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const m of ['circuit', 'route-sans-fin', 'route-sans-fin-fenetre', 'route-sans-fin-seance', 'meteo'])
  req(path.join(ROOT, 'src', m + '.js'));
const B = globalThis.BITUME, S = B.routeSansFinSeance;
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok ' + nom); };
const DT = 1 / 120, GRAINE = 314159;
const PHASES = ['clair', 'couvre', 'pluie', 'orage'];

function faireAvancer(s, metres) {
  const pas = Math.round(metres / 55 * 120);
  for (let i = 0; i < pas; i++) S.avancer(s, [Math.min(metres, i * 55 * DT) - s.cPorteur.sansFinFenetre.sOrigine], DT);
}

verifier('la cible naît valide et suit le littoral de départ', () => {
  const s = S.creer({ graine: GRAINE });
  const c = S.meteoCible(s);
  assert.ok(PHASES.includes(c.phase), 'phase inconnue : ' + c.phase);
  assert.equal(typeof c.neige, 'boolean');
  assert.equal(c.phase, 'couvre', 'la plage (1er biome du cycle) doit mener au ciel couvert');
});

verifier('mêmes positions, même cible météo', () => {
  const a = S.creer({ graine: GRAINE }), b = S.creer({ graine: GRAINE });
  faireAvancer(a, 9000);
  faireAvancer(b, 9000);
  assert.deepEqual(S.meteoCible(a), S.meteoCible(b));
});

verifier('hystérésis : une couture courte ne fait pas basculer la cible', () => {
  const s = S.creer({ graine: GRAINE });
  faireAvancer(s, 4000);
  const avant = S.meteoCible(s);
  // on recule le joueur de 40 m à cheval sur une frontière : la cible doit tenir
  S.avancer(s, [4000 - 40 - s.cPorteur.sansFinFenetre.sOrigine], S.AVANCE_FENETRE);
  const apres = S.meteoCible(s);
  assert.deepEqual(apres, avant, 'la cible a clignoté sur une couture de 40 m');
});

verifier('le moteur météo suit la cible imposée à la transition suivante', () => {
  const Ss = { meteo: { t: 0, phase: 'clair', tp: 0, pluie: 0, nuage: .12, eclair: 0, prochainEclair: 0, mouille: 0, ventX: 0, ventZ: 0 } };
  Ss.meteo.cible = 'orage';
  for (let i = 0; i < Math.round(27 / DT); i++) B.meteo.avancer(Ss, DT);   // au-delà de DUREES[0] = 26 s
  assert.equal(Ss.meteo.phase, 'orage', 'la cible n’a pas pris le pas sur le cycle : ' + Ss.meteo.phase);
});

verifier('sans cible, le cycle garde son ordre (garde-fou de non-régression)', () => {
  const Ss = { meteo: { t: 0, phase: 'clair', tp: 0, pluie: 0, nuage: .12, eclair: 0, prochainEclair: 0, mouille: 0, ventX: 0, ventZ: 0 } };
  for (let i = 0; i < Math.round(27 / DT); i++) B.meteo.avancer(Ss, DT);
  assert.equal(Ss.meteo.phase, 'couvre', 'le cycle sans cible a changé : ' + Ss.meteo.phase);
});

verifier('la neige des hautes montagnes descend jusqu’à l’ambiance', () => {
  const Ss = { meteo: { t: 0, phase: 'pluie', tp: 0, pluie: 1, nuage: .9, eclair: 0, prochainEclair: 0, mouille: 0, ventX: 0, ventZ: 0 } };
  Ss.meteo.precipitationsNeige = true;
  const a = B.meteo.ambiance(Ss.meteo, {});
  assert.equal(a.pluie, 0, 'des gouttes sous la neige : pluie ' + a.pluie);
  Ss.meteo.precipitationsNeige = false;
  assert.ok(B.meteo.ambiance(Ss.meteo, {}).pluie > .5, 'plus de gouttes sans neige ?');
});

console.log(n + ' contrôles de météo sans fin passés');
