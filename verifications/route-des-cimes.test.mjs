import { generateurHistorique } from './helpers/generateur-historique.mjs';
import { definitionHistorique } from './helpers/catalogue-historique.mjs';
// Route-des-Cimes : identité distincte, géométrie métrique issue de l'étude, reconstruction déclarée,
// raccord aux lecteurs p15 et conservation stricte des huit circuits déjà livrés.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { TRACE } from '../tools/lieux-trace.mjs';
import { PARTITION } from '../tools/lieux-partitions.mjs';
const require = createRequire(import.meta.url);
require('../src/circuit.js'); require('../src/route-des-cimes.js');
const B = globalThis.BITUME, c = B.circuit.creer(181, { partition: 'route-des-cimes' });
let n = 0;
const verifier = (nom, f) => { f(); n++; console.log('ok  ' + nom); };
const proche = (a, b, seuil = 1e-7) => assert.ok(Math.abs(a - b) <= seuil, `${a} ≠ ${b}`);
const champs = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse', 'limiteG', 'limiteD', 'vibreur'];

verifier('identité indépendante et provenance explicite, sans prétendre avoir récupéré la révision finale', () => {
  assert.equal(c.id, 'route-des-cimes'); assert.equal(c.graine, 181); assert.equal(c.nom, 'Route-des-Cimes');
  assert.equal(c.provenance.sequencesFinalesRetrouvees, false); assert.equal(c.provenance.variante, 'reconstruction-2026-11-20');
  assert.equal(c.pretPourCourse, false); assert.equal(c.provenance.qualificationCatalogue, false);
  const h = createHash('sha256').update(readFileSync(new URL('../tools/lieux-partitions.mjs', import.meta.url))).digest('hex');
  assert.equal(h, c.provenance.sourceSHA256);
  assert.throws(() => B.circuit.creer(47, { partition: 'route-des-cimes' }), /identité/);
  assert.throws(() => B.circuit.creer(181, { partition: 'inconnue' }), /partition/);
});

verifier('l’étude métrique reste reproductible, avec ses positions et profils historiques', () => {
  const source = TRACE.construire(PARTITION['haut-col']), temoin = B.routeDesCimes.creer({ etude: true });
  assert.equal(temoin.provenance.variante, 'etude-temoin'); assert.equal(temoin.n, source.n);
  proche(temoin.longueur, source.n * source.pasReel);
  for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'devers']) assert.deepEqual(temoin[k], source[k], k);
  for (let i = 0; i < temoin.n; i++) proche(temoin.pente[i], source.pente[i], 1e-7);
  assert.equal(temoin.vitesseP9, undefined); assert.equal(temoin.vitesseP10, undefined);
});

verifier('reconstruction bornée : 9,698 km, 270 m, rayon 32 m et palier doux avant trois épingles', () => {
  const m = c.mesures;
  proche(m.longueur, 9697.52858032384, .001); proche(m.denivele, 270.28, .01);
  proche(m.penteMin, -.1, 1e-6); proche(m.penteMax, .3, 1e-6); proche(m.rayonMin, 32);
  assert.ok(m.longueurAu20 > 300 && m.longueurAu20 < 350);
  assert.equal(c.sequences[16].l, 150); assert.equal(c.sequences[20].l, 100); assert.equal(c.sequences[22].p, 3);
  const epingles = c.sequences.filter(q => q.lieu === 3 && Math.abs(q.a || 0) === 180);
  assert.deepEqual(epingles.map(q => [q.r, q.a]), [[32, -180], [32, 180], [34, -180]]);
  assert.deepEqual(c.lieux.map(l => Math.round(l.debut / 100) / 10), [.8, 2.3, 2.9, 4.6, 5.5, 7.9, 8.6]);
  assert.deepEqual(B.circuit.valider(c), []);
});

verifier('fermeture du plan, du cap et de l’altitude, sans discontinuité des lecteurs p15', () => {
  // Résidus du solveur AVANT répartition périodique : moins de 5 cm sur 9,7 km.
  // Les lectures ci-dessous vérifient ensuite la fermeture du circuit réellement fourni au jeu.
  assert.ok(c.fermeture.residuPlan < .05); assert.ok(Math.abs(c.fermeture.residuCap) < 1e-5);
  for (const s of [-17.3, 0, 2.6, 1234.2, c.longueur - .01, c.longueur + 12]) {
    const a = B.circuit.echantillon(c, s), b = B.circuit.echantillon(c, s + c.longueur);
    for (const k of Object.keys(a)) proche(a[k], b[k], 1e-8);
  }
  for (let i = 0; i < c.n; i += 97) {
    const e = B.circuit.echantillon(c, i * c.pas);
    for (const k of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'ligne', 'vitesse']) proche(e[k], c[k][i], 1e-8);
  }
  const f = B.circuit.echantillon(c, c.longueur - .001), d = B.circuit.echantillon(c, .001);
  assert.ok(Math.hypot(f.x - d.x, f.y - d.y, f.z - d.z) < .003);
});

verifier('aucun recroisement ou rapprochement sous 60 m des branches distinctes', () => {
  const ecart = Math.ceil(150 / c.pas); let min = Infinity;
  for (let i = 0; i < c.n; i += 2) for (let j = i + ecart; j < c.n; j += 2) {
    if (c.n - (j - i) < ecart) continue;
    const d = Math.hypot(c.x[i] - c.x[j], c.z[i] - c.z[j]); min = Math.min(min, d);
  }
  assert.ok(min >= 60, `deux branches ne sont séparées que de ${min} m`);
});

verifier('trois couverts indépendants, deux tunnels et une galerie ouverte, plus un pont de 130 m', () => {
  assert.deepEqual(c.couverts.map(t => t.type), ['tunnel', 'galerie', 'tunnel']);
  assert.equal(c.couverts[1].ouvert, 'G'); assert.equal(c.tunnel, c.couverts[0]);
  for (const t of c.couverts) {
    const s = (t.debut + t.fin) / 2;
    for (const tour of [-2, 0, 2]) assert.equal(B.circuit.dansCouvert(c, s + tour * c.longueur), t);
    assert.equal(B.circuit.dansTunnel(c, s), t.type === 'tunnel');
    assert.equal(B.circuit.dansCouvert(c, t.debut - 1), null);
    assert.equal(B.circuit.dansCouvert(c, t.fin + 1), null);
    assert.equal(B.circuit.dansCouvert(c, t.debut - 1, 2), t);
  }
  assert.equal(c.ponts.length, 1); proche(c.ponts[0].fin - c.ponts[0].debut, 130);
  assert.ok(c.stands && c.stands.fin - c.stands.debut > 140);
});

verifier('géométrie et consigne IA déterministes ; rayon de Frenet et limites continus', () => {
  const d = B.routeDesCimes.creer();
  for (const k of champs) assert.deepEqual(c[k], d[k], k);
  for (let i = 0; i < c.n; i++) {
    const j = (i + 1) % c.n;
    assert.ok(c.vitesse[i] >= 5 && c.vitesse[i] <= 86);
    for (const cote of [-1, 1]) {
      const limites = cote < 0 ? c.limiteG : c.limiteD;
      assert.ok(Math.abs(limites[i] - limites[j]) <= .35 * c.pas + 1e-5);
      assert.ok(1 - c.courbure[i] * cote * limites[i] > .3);
    }
  }
});

verifier('huit circuits historiques identiques au bit près et identités de catalogue conservées', () => {
  const avant = JSON.parse(readFileSync(new URL('fixtures/route-des-cimes-circuits-p15.json', import.meta.url), 'utf8'));
  const catalogue = vm.runInNewContext(readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8').match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
  assert.equal(new Set(avant.circuits.map(k => k.id)).size, 8);
  const base = generateurHistorique('0266');
  for (const a of avant.circuits) {
    const k = definitionHistorique(catalogue, a.id), options = { theme: k.theme, longueur: k.longueur, nom: k.nom };
    const b = B.circuit.creer(k.graine, options), ancien = base.creer(k.graine, options);
    for (const champ of champs) {
      const octets = t => Buffer.from(t.buffer, t.byteOffset, t.byteLength);
      assert.deepEqual(octets(b[champ]), octets(ancien[champ]), k.id + ' ' + champ);
      if (process.platform === 'linux' && process.arch === 'x64')
        assert.equal(createHash('sha256').update(octets(ancien[champ])).digest('hex'), a.champsSHA256[champ]);
    }
    assert.equal(a.longueur, b.longueur); assert.deepEqual(a.tunnel, b.tunnel);
    for (const q of a.lectures) {
      const lu = structuredClone(base.echantillon(ancien, q.s));
      assert.deepEqual(lu, B.circuit.echantillon(b, q.s));
      if (process.platform === 'linux' && process.arch === 'x64') assert.deepEqual(lu, q.valeur);
    }
  }
});

verifier('catalogue de jeu raccordé au tracé dirigé sans écraser Haut-Col ou Baïkal', () => {
  const jeu = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
  const catalogue = vm.runInNewContext(jeu.match(/const CATALOGUE = (\[[\s\S]*?\n  \]);/)[1]);
  const circuitDuJeu = new Function('B', 'CATALOGUE', 'const circuits = []; ' +
    jeu.match(/  function circuit\(i\) \{[\s\S]*?\n  \}/)[0] + '; return circuit;')(B, catalogue);
  assert.ok(catalogue.some(k => k.id === 'baikal'));
  const index = catalogue.findIndex(k => k.id === c.id);
  assert.equal(catalogue.filter(k => k.id === c.id).length, 1);
  const livre = circuitDuJeu(index);
  assert.equal(livre.id, 'route-des-cimes'); assert.equal(livre.partition, 'route-des-cimes');
  assert.equal(livre.longueur, c.longueur); assert.equal(livre.couverts.length, 3);
  assert.equal(circuitDuJeu(index), livre, 'la préparation conserve le circuit déjà créé');
  const build = readFileSync(new URL('../construire.py', import.meta.url), 'utf8');
  assert.ok(build.indexOf("'route-des-cimes.js'") > build.indexOf("'circuit.js'"));
  assert.ok(build.indexOf("'route-des-cimes.js'") < build.indexOf("'jeu.js'"));
});
console.log(`${n} vérifications Route-des-Cimes réussies`);
