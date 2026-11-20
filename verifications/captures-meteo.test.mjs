import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { optionsMeteo, optionsScenario, preparerEtat, SCENARIOS, verifierContrasteSillage, verifierRapport } from '../tools/captures-meteo.mjs';
import { optionsCapture } from '../tools/controle-visuel.mjs';

test('options de capture bornées, cas explicites et URL valides', () => {
  const base = ['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/images'];
  assert.equal(optionsMeteo(base).cas.length, 14);
  assert.deepEqual(optionsMeteo([...base, '--cas', 'neige45,duo']).cas, ['neige45', 'duo']);
  for (const suite of [['--cas', 'inconnu'], ['--cas', 'duo,duo'], ['--taille', '9000,1'], ['--test', 'oui'], ['--chrome']])
    assert.throws(() => optionsMeteo([...base, ...suite]));
  assert.throws(() => optionsMeteo(['--url', 'javascript:alert(1)', '--sortie', '/tmp/a']));
  assert.ok(Math.abs(SCENARIOS.find(s => s.id === 'pluie-spray235').vitesse * 3.6 - 235) < 1e-10);
  assert.ok(SCENARIOS.every(s => s.chauffe >= 0 && s.chauffe <= 120 && (s.images || 2) <= 3));
  assert.equal(optionsCapture([...base, '--images', '2']).images, 2);
  assert.throws(() => optionsCapture([...base, '--images', '1']));
  for (const s of SCENARIOS) {
    const p = optionsScenario(s, 'file:///tmp/bitume.html', '/tmp/qa/' + s.id, { taille: '960,540' });
    assert.equal(p.images, s.pause ? 3 : 2, s.id);
    assert.equal(p.referenceJeu.vitesse, s.vitesse, s.id);
    assert.equal(p.referenceJeu.vue, s.vue || 'cockpit', s.id);
  }
});

function rapport(s, patch = {}) {
  const eau = s.sec || s.inactif ? 0 : .6;
  const optique = { backend: 'webgl2', pret: true, erreur: null, erreurs: [], perdu: false, dessins: 60, etapes: 720, copiesScene: 60, pixelsSource: 518400,
    eau, accumulationNeige: 0, embruns: s.spray ? .6 : 0, gouttes: 0, neige: 0 };
  const zones = { scene: {} };
  if (s.duo) zones.scene2 = {};
  if (!s.faune && (!s.vue || s.vue === 'cockpit') && s.qualite !== 'low') for (const id of ['glace-g', 'glace-d', ...(s.duo ? ['glace-g2', 'glace-d2'] : [])]) zones[id] = {};
  const positions = [{ id: 0, s: 280, d: 0, v: s.vitesse }, { id: 1, s: 298, d: 0, v: s.vitesse }];
  return { initialisation: { positions }, erreurs: [], avertissements: [], environnement: { gpu: 'ANGLE SwiftShader' }, images: Array.from({ length: s.images || 2 }, (_, i) => ({
    etat: { zones: structuredClone(zones) },
    observation: { glErreur: 0, glPerdu: false, vitres: { j1: structuredClone(optique), j2: structuredClone(optique) },
      j1: { pluie: s.pluie ?? (s.sec ? 0 : s.saison === 'hiver' ? 0 : 1), neige: s.saison === 'hiver' ? 1 : 0, embruns: s.spray ? .6 : 0, abri: !!s.tunnel, qualite: s.qualite || 'high',
        actif: !s.inactif, vitesse: s.vitesse },
      vue: s.vue || 'cockpit', precipitation: { pluie: s.pluie ?? (s.sec ? 0 : 1), mouille: s.mouille ?? (s.sec ? 0 : 1) },
      positions: structuredClone(positions), camera: { pos: [280, 1, 0], yaw: 0, pitch: 0, roll: 0, fov: 60 }, visieresVisibles: { j1: !s.sec && !s.inactif },
      j2: {}, ecran: s.pause && i < 2 ? 'pause' : 'course', temps: s.pause && i < 2 ? 9 : 9.1, ...structuredClone(patch) } })) };
}

test('erreurs de page, GL et repli optique silencieux empêchent la qualification', () => {
  const s = SCENARIOS[0];
  assert.deepEqual(verifierRapport(rapport(s), s, true), []);
  assert.ok(verifierRapport(rapport(s, { glErreur: 1282 }), s, true).some(e => e.includes('WebGL')));
  assert.ok(verifierRapport(rapport(s, { vitres: { j1: { backend: 'canvas2d' } } }), s, true).some(e => e.includes('inactive')));
  assert.ok(verifierRapport(rapport(s, { vitres: { j1: { backend: 'webgl2', erreurs: 1 } } }), s, true).some(e => e.includes('visière')));
  for (const mauvais of [{ erreur: 'shader invalid' }, { pret: false }, { dessins: 0 }, { copiesScene: 0 }, { pixelsSource: 0 }]) {
    const r = rapport(s); Object.assign(r.images[0].observation.vitres.j1, mauvais);
    assert.ok(verifierRapport(r, s, true).length, JSON.stringify(mauvais));
  }
  assert.ok(verifierRapport(rapport(s, { vitresGL: { j1: { present: true, erreur: 1282, perdu: false } } }), s, true).some(e => e.includes('WebGL')));
  const noir = rapport(s); noir.images[0].vues = { scene: { noir: 1, luminance: 0 } };
  assert.ok(verifierRapport(noir, s, true).some(e => e.includes('noire')));
  assert.deepEqual(verifierRapport(rapport(s, { vitres: null }), s, false), []); // le build ancien n'a pas le diagnostic
  const r = rapport(s); r.erreurs.push('Shader invalid');
  assert.ok(verifierRapport(r, s, true).some(e => e.includes('Erreur page')));
});

test('nuage rival, neige, tunnel et seconde vue sont vraiment exercés', () => {
  for (const s of SCENARIOS.filter(s => ['pluie-spray235', 'neige45', 'tunnel', 'duo'].includes(s.id))) {
    const r = rapport(s); assert.deepEqual(verifierRapport(r, s, true), []);
    if (s.spray) r.images[0].observation.j1.embruns = 0;
    if (s.tunnel) r.images[0].observation.j1.abri = false;
    if (s.saison === 'hiver') r.images[0].observation.j1.pluie = 1;
    if (s.duo) delete r.images[0].etat.zones['glace-g2'];
    assert.ok(verifierRapport(r, s, true).length > 0, s.id);
  }
});

test('pause figée puis reprise vérifiées sur l’horloge observée', () => {
  const s = SCENARIOS.find(s => s.pause), r = rapport(s);
  assert.deepEqual(verifierRapport(r, s, true), []);
  r.images[1].observation.temps += .1;
  assert.ok(verifierRapport(r, s, true).some(e => e.includes('Horloge')));
});

test('les rétroviseurs suivent le profil réel : absents en Légère, deux par joueur en Fine', () => {
  createRequire(import.meta.url)('../src/graphismes.js');
  const G = globalThis.BITUME.graphismes;
  assert.equal(G.PROFILS.low.effets.retroImages, false);
  assert.equal(G.PROFILS.low.secondaires.retroviseurs.glaces, 0);
  assert.equal(G.PROFILS.high.effets.retroImages, true);
  assert.equal(G.PROFILS.high.secondaires.retroviseurs.glaces, 2);
  const legere = SCENARIOS.find(s => s.id === 'legere'), r = rapport(legere);
  assert.deepEqual(verifierRapport(r, legere, true), []);
  for (const id of ['glace-g', 'glace-d', 'glace-g2', 'glace-d2']) {
    const parasite = structuredClone(r); parasite.images[0].etat.zones[id] = {};
    assert.ok(verifierRapport(parasite, legere, true).some(e => e.includes('inattendue')), id);
  }
  const mauvaisProfil = structuredClone(r); mauvaisProfil.images[0].observation.j1.qualite = 'high';
  assert.ok(verifierRapport(mauvaisProfil, legere, true).some(e => e.includes('Qualité')));
  for (const id of ['pluie-grille', 'duo']) {
    const s = SCENARIOS.find(s => s.id === id), complet = rapport(s);
    assert.deepEqual(verifierRapport(complet, s, true), []);
    for (const glace of ['glace-g', 'glace-d', ...(s.duo ? ['glace-g2', 'glace-d2'] : [])]) {
      const manque = structuredClone(complet); delete manque.images[0].etat.zones[glace];
      assert.ok(verifierRapport(manque, s, true).some(e => e.includes('Rétroviseurs incomplets')), id + '/' + glace);
    }
  }
});

test('sillage à 300 km/h : vitesse, humidité, vrais dépôts, vue et poses sont observés', () => {
  for (const s of SCENARIOS.filter(s => s.controleSillage)) {
    assert(Math.abs(s.vitesse * 3.6 - 300) < 1e-10);
    const r = rapport(s); assert.deepEqual(verifierRapport(r, s, true), [], s.id);
    for (const changer of [
      o => { o.j1.vitesse = 60; }, o => { o.vue = 'autre'; }, o => { o.positions[1].s += .1; },
      o => { o.camera = null; }, o => { o.camera.pos[1] = NaN; }
    ]) {
      const mauvais = structuredClone(r); changer(mauvais.images[0].observation);
      assert(verifierRapport(mauvais, s, true).length, s.id);
    }
    if (s.spray) for (const changer of [
      o => { o.j1.embruns = 0; }, o => { o.precipitation.mouille = 0; }, o => { o.precipitation.pluie = .1; },
      o => { o.vitres.j1.eau = 0; }, o => { o.visieresVisibles.j1 = false; }
    ]) {
      const mauvais = structuredClone(r); changer(mauvais.images[0].observation);
      assert(verifierRapport(mauvais, s, true).length, s.id);
    }
  }
});

test('le témoin sec et l’hélico sous pluie restent sans dépôts ; les autres contrôles graphiques demeurent', () => {
  for (const id of ['sillage300-sec', 'sillage300-helico']) {
    const s = SCENARIOS.find(s => s.id === id), r = rapport(s);
    // Le préchauffage peut avoir dessiné une fois, puis la visière vide reste masquée.
    for (const im of r.images) Object.assign(im.observation.vitres.j1, { dessins: 1, copiesScene: 1, etapes: 0 });
    assert.deepEqual(verifierRapport(r, s, true), []);
    for (const changer of [
      o => { o.vitres.j1.eau = .001; }, o => { o.vitres.j1.embruns = .001; },
      o => { o.vitres.j1.gouttes = 1; }, o => { o.visieresVisibles.j1 = true; },
      o => { o.vitres.j1.erreur = 'shader'; }, o => { o.glErreur = 1282; }
    ]) {
      const mauvais = structuredClone(r); changer(mauvais.images[0].observation);
      assert(verifierRapport(mauvais, s, true).length, id);
    }
    if (s.inactif) for (const changer of [o => { o.j1.actif = true; }, o => { o.precipitation.pluie = 0; }, o => { o.vitres.j1.pret = false; }]) {
      const mauvais = structuredClone(r); changer(mauvais.images[0].observation);
      assert(verifierRapport(mauvais, s, true).length, id);
    }
  }
});

test('contraste humide/sec : mêmes poses, même caméra, même horloge, apport distinct de la visière', () => {
  const a = rapport(SCENARIOS.find(s => s.id === 'sillage300')), b = rapport(SCENARIOS.find(s => s.id === 'sillage300-sec'));
  assert.deepEqual(verifierContrasteSillage(a, b), []);
  for (const changer of [
    r => { r.initialisation.positions[1].s++; }, r => { r.images[0].observation.positions[0].d = 2; },
    r => { r.images[0].observation.camera.pos[1] += 1; }, r => { r.images[0].observation.temps += .1; },
    r => { r.images[0].observation.vitres.j1.eau = .1; }, r => { r.images[0].observation.j1.embruns = .1; }
  ]) {
    const mauvais = structuredClone(b); changer(mauvais); assert(verifierContrasteSillage(a, mauvais).length);
  }
  assert(verifierContrasteSillage(a, null).length);
});

test('préparation du témoin : seule l’humidité change, aucune implantation d’effet n’est remplacée', () => {
  const preparer = id => {
    const voitures = Array.from({ length: 4 }, (_, i) => ({ id: i, etat: {} }));
    const S = { suivie: 0, locaux: [0], meteo: {}, course: { c: { longueur: 1000 }, voitures }, prec: voitures.map(() => ({})), cour: voitures.map(() => ({})) };
    const B = { circuit: { echantillon: (c, s) => ({ x: s, z: 0, y: 0, cap: 0, pente: 0, devers: 0 }) }, traces: { pas() {} } };
    const pas = B.traces.pas;
    const avancer = () => 1;
    const contexte = { BITUME_JEU: { session: S, reglages: {}, ecran: 'course' }, BITUME: B, __BITUME_CAPTURE: { avancer } };
    const c = vm.createContext(contexte), s = SCENARIOS.find(s => s.id === id);
    const initialisation = vm.runInContext(`(${preparerEtat.toString()})(${JSON.stringify(s)})`, c);
    assert.equal(B.traces.pas, pas);
    assert.equal(S.acc, -1); assert.equal(initialisation.poseFigee, true);
    assert.equal(S.course.voitures[1].etat.s, 298);
    return { initialisation: JSON.parse(JSON.stringify(initialisation)), S };
  };
  const a = preparer('sillage300'), b = preparer('sillage300-sec');
  assert.deepEqual(a.initialisation.positions, b.initialisation.positions);
  assert.equal(a.S.meteo.pluie, 0); assert.equal(b.S.meteo.pluie, 0);
  assert.equal(a.S.meteo.nuage, b.S.meteo.nuage);
  assert.equal(a.S.meteo.mouille, 1); assert.equal(b.S.meteo.mouille, 0);
});

test('la CI conserve les groupes historiques, couvre tous les scénarios une fois et fige la référence publiée', () => {
  const yaml = readFileSync(new URL('../.github/workflows/visuel-meteo.yml', import.meta.url), 'utf8');
  const cas = [...yaml.matchAll(/^\s+cas: ([a-z0-9,-]+)$/gm)].flatMap(m => m[1].split(','));
  assert.equal(new Set(cas).size, cas.length); assert.deepEqual([...cas].sort(), SCENARIOS.map(s => s.id).sort());
  for (const cas of ['pluie-grille', 'pluie-spray235', 'tunnel']) assert.ok(yaml.includes('cas: ' + cas + '\n'));
  assert.match(yaml, /cas: neige45,pause-reprise,legere/);
  assert.match(yaml, /cas: duo,sec,faune-haut-col-ete,faune-haut-col-hiver/);
  assert.match(yaml, /git show f41614e1f3887a79ebbd633df3fde754534f202e:dist\/bitume.html/);
  assert.match(yaml, /git diff --exit-code -- VERSION.json SIZE.json dist\/bitume.html/);
});
