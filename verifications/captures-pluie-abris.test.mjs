// Les gardes de qualification refusent un compteur positif sans vrais pixels composés,
// un abri faux, un masque inefficace ou des preuves portant un autre scénario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS_PLUIE_ABRIS, optionsPluieAbris, optionsScenarioPluieAbris, mesurerComposition, verifierPluieAbris } from '../tools/captures-pluie-abris.mjs';

const cas = id => SCENARIOS_PLUIE_ABRIS.find(s => s.id === id);
function rapport(s) {
  const visible = s.pluieVisible;
  return { build: { sha256: 'a'.repeat(64) }, source: { commit: 'b'.repeat(40) },
    environnement: { webgl2: true, physx: { ready: true }, resolution: (s.taille || '960,540').split(',').map(Number) },
    initialisation: { posePrescrite: true, circuitId: s.circuitId }, erreurs: [], avertissements: [],
    images: Array.from({ length: 2 }, () => ({ etat: { zones: { scene: {} } }, vues: { scene: { noir: .2, luminance: .3 } },
      observation: { glErreur: 0, glPerdu: false, pluie: 1, qualite: s.qualite || 'high', vue: s.vue,
        abri: true, abriVisiere: true, abriLogique: s.pose !== 'linteau', camera: { pos: [0, 1.2, 0] },
        pilier: s.pose === 'pilier' ? { hit: true, genre: 'pilier-galerie' } : null,
        statistiques: { candidats: s.qualite === 'low' ? 420 : 840, traits: visible ? 50 : 0, spatiaux: 150, rayons: 240, masquee: !visible },
        composition: { pixelsPluie: visible ? 130 : 0, surPluie: visible ? 110 : 0, modifies: visible ? 110 : 0, horsPluie: 0 },
        toileVisible: visible, visiere: { eau: 0, gouttes: 0, embruns: 0 },
        masque: { sha256: 'c'.repeat(64) }, temoin: { sha256: 'd'.repeat(64) } } })) };
}

test('huit scènes, deux vues, deux paliers et vrai portrait, sans changer les campagnes existantes', () => {
  const o = optionsPluieAbris(['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/pluie']);
  assert.equal(o.cas.length, 8);
  assert.deepEqual(new Set(SCENARIOS_PLUIE_ABRIS.map(s => s.vue)), new Set(['cockpit', 'poursuite']));
  assert.deepEqual(new Set(SCENARIOS_PLUIE_ABRIS.map(s => s.qualite || 'high')), new Set(['high', 'low']));
  for (const s of SCENARIOS_PLUIE_ABRIS) {
    const p = optionsScenarioPluieAbris(s, o);
    assert.equal(p.images, 2); assert.equal(p.referenceJeu.circuit, s.circuit);
    assert.equal(p.referenceJeu.vue, s.vue); assert.equal(p.referenceJeu.qualite, s.qualite || 'high');
    if (s.taille) assert.deepEqual(p.taille, [540, 960]);
  }
  for (const extra of [['--cas', 'inconnu'], ['--cas', 'haut-col-portail,haut-col-portail'], ['--angle', 'faux'],
    ['--taille', '9000,1'], ['--sortie', '/tmp/autre'], ['--chrome']])
    assert.throws(() => optionsPluieAbris(['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/pluie', ...extra]));
  assert.throws(() => optionsPluieAbris(['--url', 'https://example.test/', '--sortie', '/tmp/pluie']));
});

test('les huit rapports exercés sont acceptés', () => {
  for (const s of SCENARIOS_PLUIE_ABRIS) assert.deepEqual(verifierPluieAbris(rapport(s), s), [], s.id);
});

test('le contrôle du pilier exige la primitive réellement affichée au centre du cadre', () => {
  const s = cas('cimes-pilier');
  for (const pilier of [null, { hit: false, genre: null }, { hit: true, genre: 'mur-galerie' }]) {
    const r = rapport(s); r.images[0].observation.pilier = pilier; assert.ok(verifierPluieAbris(r, s).length);
  }
});

test('un compteur de traits seul ne prouve pas que la pluie est affichée', () => {
  const s = cas('haut-col-portail');
  for (const changer of [o => { o.composition.pixelsPluie = 0; }, o => { o.composition.surPluie = 0; },
    o => { o.toileVisible = false; }, o => { o.statistiques.masquee = true; },
    o => { o.composition = null; }, o => { o.temoin = null; }, o => { o.masque.sha256 = ''; }]) {
    const r = rapport(s); changer(r.images[0].observation); assert.ok(verifierPluieAbris(r, s).length);
  }
});

test('une pluie dessinée sur le mur ou au fond du tunnel est refusée', () => {
  for (const id of ['haut-col-fond', 'cimes-galerie-fermee']) {
    const s = cas(id);
    for (const changer of [o => { o.statistiques.traits = 1; }, o => { o.composition.pixelsPluie = 1; },
      o => { o.composition.surPluie = 1; }, o => { o.toileVisible = true; }, o => { o.statistiques.masquee = false; }]) {
      const r = rapport(s); changer(r.images[0].observation); assert.ok(verifierPluieAbris(r, s).length);
    }
  }
});

test('abri réel, linteau, sécheresse de visière et budgets restent nécessaires', () => {
  for (const id of ['haut-col-linteau', 'cimes-galerie-legere']) {
    const s = cas(id);
    for (const changer of [o => { o.abri = false; }, o => { o.abriVisiere = false; }, o => { o.abriLogique = !o.abriLogique; },
      o => { o.visiere.eau = .1; }, o => { o.visiere.gouttes = 1; }, o => { o.visiere.embruns = .1; },
      o => { o.statistiques.rayons = 99999; }, o => { o.statistiques.rayons = -1; },
      o => { o.statistiques.spatiaux = 0; }, o => { o.statistiques.candidats = 841; }, o => { o.qualite = 'medium'; }]) {
      const r = rapport(s); changer(r.images[0].observation); assert.ok(verifierPluieAbris(r, s).length);
    }
  }
});

test('des preuves incomplètes, un moteur absent et une autre résolution sont refusés', () => {
  const s = cas('cimes-galerie-portrait');
  for (const changer of [r => { r.build = null; }, r => { r.source = null; }, r => { r.images.pop(); },
    r => { r.environnement.physx.ready = false; }, r => { r.environnement.webgl2 = false; },
    r => { r.environnement.resolution = [960, 540]; }, r => { r.initialisation.circuitId = 'autre'; },
    r => { r.erreurs.push('exception'); }, r => { r.avertissements.push('GL_INVALID_OPERATION'); },
    r => { r.images[0].vues.scene = { noir: 1, luminance: 0 }; }]) {
    const r = rapport(s); changer(r); assert.ok(verifierPluieAbris(r, s).length);
  }
});

test('le témoin compte uniquement les différences coïncidant avec le raster pluie', () => {
  const sans = { width: 4, height: 1, canaux: 4, pixels: Buffer.alloc(16) };
  const avec = { ...sans, pixels: Buffer.alloc(16) }, masque = { ...sans, pixels: Buffer.alloc(16) };
  avec.pixels[4] = 20; masque.pixels[7] = 90; // goutte visible au deuxième pixel
  avec.pixels[12] = 30; // changement étranger à la pluie
  assert.deepEqual(mesurerComposition(avec, sans, masque, { x: 0, y: 0, width: 4, height: 1 }),
    { pixelsPluie: 1, alphaTotal: 90, modifies: 2, surPluie: 1, horsPluie: 1 });
  assert.deepEqual(mesurerComposition(sans, sans, masque, { x: 0, y: 0, width: 4, height: 1 }),
    { pixelsPluie: 1, alphaTotal: 90, modifies: 0, surPluie: 0, horsPluie: 0 });
  assert.throws(() => mesurerComposition(avec, { ...sans, width: 3 }, masque, { x: 0, y: 0, width: 4, height: 1 }));
});
