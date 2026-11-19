// Régression du comparateur : une nouvelle scène ne doit jamais autoriser un nouvel état physique p14.
// Ces contrôles légers complètent le replay WASM réel de determinisme-simulation.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { comparerDeterminismePhysX as comparer, validerScenesPhysX } from './helpers/reference-physx.mjs';

const contenu = readFileSync(new URL('./fixtures/determinisme-p14.json', import.meta.url));
const reference = JSON.parse(contenu);
const scenes = JSON.parse(readFileSync(new URL('./fixtures/determinisme-scenes-0260.json', import.meta.url), 'utf8'));
function actuel() {
  const r = structuredClone(reference);
  for (const nom of Object.keys(r.cas)) r.cas[nom].scene = structuredClone(scenes.cas[nom]);
  return r;
}
function suivant(x) { const f = new Float64Array([x]); new BigUint64Array(f.buffer)[0]++; return f[0]; }
const fauxHash = 'f'.repeat(64);

test('la référence de scène conserve la fixture p14 intégrale et nomme toutes ses entrées géométriques', () => {
  assert.equal(validerScenesPhysX(reference, scenes, contenu), scenes);
  assert.equal(Object.keys(scenes.cas).length, 3);
  assert.equal(Object.values(reference.cas).reduce((n, c) => n + c.empreintes.length, 0), 54);
  assert.ok(Object.values(reference.cas).every(c => c.couches.length === c.empreintes.length));
});

test('seules les trois scènes explicitement qualifiées peuvent remplacer les scènes historiques', () => {
  comparer(reference, reference, 'historique intégral');
  assert.throws(() => comparer(reference, actuel(), 'historique intégral'), /scène ou bilan différent/);
  comparer(reference, actuel(), 'scènes qualifiées', scenes);
});

test('une divergence de la dernière seconde est refusée sur chacun des trois scénarios', () => {
  for (const nom of Object.keys(reference.cas)) {
    const r = actuel(); r.cas[nom].empreintes[17] = fauxHash;
    assert.throws(() => comparer(reference, r, 'mutation', scenes), new RegExp('divergence PhysX ' + nom + ', seconde 18'));
  }
});

test('état, natif, événements et contacts restent stricts même si le hash agrégé est laissé intact', () => {
  let controles = 0;
  for (const nom of Object.keys(reference.cas)) for (const couche of ['etat', 'natif', 'evenements', 'contacts']) {
    const r = actuel(); r.cas[nom].couches[17][couche] = fauxHash;
    assert.throws(() => comparer(reference, r, 'mutation', scenes), /état, couche, configuration ou bilan différent/);
    controles++;
  }
  assert.equal(controles, 12);
});

test('bilans, configurations et champs supplémentaires restent comparés à la référence p14', () => {
  for (const nom of Object.keys(reference.cas)) for (const changer of [
    c => { c.resume.vitesseMax = suivant(c.resume.vitesseMax); },
    c => { c.resume.contactsNatifs++; },
    c => { c.resume.evenements.contact = (c.resume.evenements.contact || 0) + 1; },
    c => { c.configuration.meteo.mouille += .01; },
    c => { c.secondes++; },
    c => { c.champNonPrevu = 1; }
  ]) {
    const r = actuel(); changer(r.cas[nom]);
    assert.throws(() => comparer(reference, r, 'mutation', scenes), /état, couche, configuration ou bilan différent/);
  }
});

test('le hash, chaque compteur et les champs supplémentaires de scène restent contrôlés', () => {
  for (const nom of Object.keys(reference.cas)) {
    for (const compteur of Object.keys(scenes.cas[nom].statistiques)) {
      const r = actuel(); r.cas[nom].scene.statistiques[compteur]++;
      assert.throws(() => comparer(reference, r, 'mutation', scenes), /géométrie de scène différente/);
    }
    for (const changer of [s => { s.empreinte = fauxHash; }, s => { s.champNonPrevu = 1; }, s => { delete s.empreinte; }]) {
      const r = actuel(); changer(r.cas[nom].scene);
      assert.throws(() => comparer(reference, r, 'mutation', scenes), /géométrie de scène différente/);
    }
  }
});

test('aucune perte de scénario, de durée ou de provenance ne passe silencieusement', () => {
  for (const nom of Object.keys(reference.cas)) {
    const incomplet = actuel(); delete incomplet.cas[nom];
    assert.throws(() => comparer(reference, incomplet, 'mutation', scenes), /cas différents/);
    const court = actuel(); court.cas[nom].empreintes.pop();
    assert.throws(() => comparer(reference, court, 'mutation', scenes), /durée différente/);
    const sansScene = structuredClone(scenes); delete sansScene.cas[nom];
    assert.throws(() => validerScenesPhysX(reference, sansScene, contenu), /tous les cas p14/);
  }
  for (const nom of ['baikal.js', 'batiments.js']) {
    const incomplet = structuredClone(scenes); delete incomplet.sources[nom];
    assert.throws(() => validerScenesPhysX(reference, incomplet, contenu), /provenance géométrique absente/);
  }
  assert.throws(() => validerScenesPhysX(reference, scenes, Buffer.concat([contenu, Buffer.from('\n')])), /fixture p14 historique a changé/);
});
