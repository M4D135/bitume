// Raccord réel météo/préparation : aucune toile ou horloge du navigateur nécessaire.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/conduite.js');
require('../src/meteo.js');
require('../src/saisons.js');
const B = globalThis.BITUME;
const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const catalogue = source.match(/  const CATALOGUE = \[[\s\S]*?\n  \];/)[0];
function fonction(nom) {
  const debut = source.indexOf('  function ' + nom + '(');
  const fin = source.indexOf('\n  }', debut);
  assert.ok(debut >= 0 && fin > debut, nom + ' présente dans le jeu');
  return source.slice(debut, fin + 4);
}
const aide = new Function('B', `${catalogue}
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  ${fonction('meteoPourConditions')}
  ${fonction('surfaceAnnoncee')}
  return { meteoPourConditions, surfaceAnnoncee, CATALOGUE };`)(B);
const foret = aide.CATALOGUE.findIndex(c => c.theme === 'foret');
const sud = aide.CATALOGUE.findIndex(c => c.theme === 'cote');
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

verifier('préparation et course choisissent neige même en hiver ensoleillé', () => {
  const k = { i: foret, saison: 'hiver', meteo: 'soleil', eau: 0 };
  const m = aide.meteoPourConditions(k, foret, 2047);
  assert.equal(m.pluie, 0);
  assert.equal(m.neigeSol, .75);
  assert.equal(B.conduite.pneusConseilles(aide.surfaceAnnoncee(k)), 'neige');
  assert.equal(B.conduite.pneusConseilles(B.chaussee.lire(null, 0, m)), 'neige');
});

verifier('Port-Sable garde une chaussée sans neige et conseille les trois montes liquides', () => {
  for (const [eau, type] of [[0, 'slicks'], [.3, 'inter'], [.9, 'pluie']]) {
    const surface = aide.surfaceAnnoncee({ i: sud, saison: 'hiver', meteo: 'aleatoire', eau });
    assert.equal(surface.neige, 0);
    assert.equal(B.conduite.pneusConseilles(surface), type);
  }
});

verifier('un invité emploie eau, saison et circuit de l’hôte', () => {
  const k = { i: foret, saison: 'ete', meteo: 'aleatoire', eau: .91 };
  assert.equal(B.conduite.pneusConseilles(aide.surfaceAnnoncee(k)), 'pluie');
  k.saison = 'hiver';
  assert.equal(B.conduite.pneusConseilles(aide.surfaceAnnoncee(k)), 'neige');
  k.i = sud;
  assert.equal(B.conduite.pneusConseilles(aide.surfaceAnnoncee(k)), 'pluie');
});

verifier('une observation de flocons ne prétend pas mesurer une couverture au sol', () => {
  const m = aide.meteoPourConditions({ saison: 'automne', meteo: 'pluie',
    mReelle: { reel: true, phase: 'pluie', pluie: .8, neige: true, mouille: 0 } }, foret, 1);
  assert.equal(m.precipitationsNeige, true);
  assert.equal(m.neigeSol, 0);
  assert.equal(B.chaussee.lire(null, 0, m).eau, 0);
});

verifier('les flocons ne créent pas d’eau liquide après 90 secondes, aux deux cadences', () => {
  for (const hz of [20, 120]) for (const reel of [false, true]) {
    const k = { saison: 'hiver', meteo: 'pluie', mReelle: reel
      ? { reel: true, phase: 'pluie', pluie: .8, neige: true, mouille: 0 } : null };
    const S = { meteo: aide.meteoPourConditions(k, foret, 1) };
    for (let i = 0; i < hz * 90; i++) B.meteo.avancer(S, 1 / hz);
    assert.ok(S.meteo.pluie > .5, 'les flocons continuent de tomber');
    assert.equal(S.meteo.mouille, 0);
    assert.equal(S.meteo.neigeSol, .75);
    assert.equal(B.chaussee.lire(null, 0, S.meteo).eau, 0);
    const avant = JSON.stringify(S.meteo);
    B.meteo.avancer(S, 0);
    assert.equal(JSON.stringify(S.meteo), avant, 'pause sans progression');
  }
});

verifier('la pluie reste liquide et le séchage conserve son fonctionnement', () => {
  const S = { meteo: aide.meteoPourConditions({ saison: 'ete', meteo: 'pluie' }, foret, 1) };
  for (let i = 0; i < 3600; i++) B.meteo.avancer(S, 1 / 120);
  assert.ok(S.meteo.mouille > .7);
  assert.equal(S.meteo.neigeSol, 0);
  const neige = { meteo: aide.meteoPourConditions({ saison: 'hiver', meteo: 'pluie' }, foret, 1) };
  neige.meteo.mouille = .6;
  for (let i = 0; i < 120; i++) B.meteo.avancer(neige, 1 / 120);
  assert.ok(neige.meteo.mouille > 0 && neige.meteo.mouille < .6, 'eau résiduelle distincte de neige');
});

verifier('quatre montes et conseil indépendants par pilote, records et fantômes isolés en p14', () => {
  for (const name of ['pneus', 'pneus2', 'pneusPret', 'pneusPret2']) {
    const valeurs = [...html.matchAll(new RegExp('name="' + name + '" value="([^"]+)"', 'g'))].map(m => m[1]);
    assert.deepEqual(valeurs, ['auto', ...B.pneus.TYPES_JOUABLES]);
  }
  const declaration = source.match(/  const PHYSIQUE = .*?;/)[0];
  const cles = new Function(declaration + 'return { PHYSIQUE, CLE_RECORDS, CLE_FANTOME };')();
  assert.equal(cles.PHYSIQUE, 'p14');
  assert.equal(cles.CLE_RECORDS, 'bitume.records.p14');
  assert.equal(cles.CLE_FANTOME, 'bitume.fantome.p14.');
});

verifier('les flocons seuls ne déclenchent ni ambiance de pluie ni reflets d’eau', () => {
  const reflets = new Function(`const REFLET_PRISE = .2, REFLET_LACHE = .12;
    ${fonction('avecReflets')} return avecReflets;`)();
  const m = aide.meteoPourConditions({ saison: 'hiver', meteo: 'pluie' }, foret, 1);
  const S = {}, P = { effets: { reflets: true } };
  assert.equal(B.meteo.ambiance(m).pluie, 0);
  assert.equal(reflets(S, P, m), false);
  m.mouille = .8;
  assert.equal(reflets(S, P, m), true, 'une eau résiduelle réelle reste visible');
  m.mouille = 0;
  assert.equal(reflets(S, P, m), false);
});

console.log(`Chaussée/préparation : ${controles} contrôles réussis.`);
