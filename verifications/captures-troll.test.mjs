import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { horlogeCapture } from '../tools/controle-visuel.mjs';
import { CHOIX_TROLL, INSTANTS_TROLL, SCENARIOS_TROLL, optionsTroll, optionsScenarioTroll, verifierTroll, avantImageTroll } from '../tools/captures-troll.mjs';

const base = ['--url', 'file:///tmp/bitume.html', '--sortie', '/tmp/troll'];
test('la campagne exige un HTML identifié, deux vraies vues duo et tous les instants', () => {
  const o = optionsTroll(base);
  assert.equal(o.cas.length, 2);
  for (const s of SCENARIOS_TROLL) {
    const p = optionsScenarioTroll(s, o.url, o.sortie, o);
    assert.equal(p.referenceJeu.mode, 'duo'); assert.equal(p.referenceJeu.vue, s.vue); assert.equal(p.referenceJeu.vue2, s.vue);
    assert.equal(p.images, INSTANTS_TROLL.length); assert.equal(p.referenceJeu.vitesse, 0);
    assert.equal(p.referenceJeu.retro, s.vue === 'cockpit' ? 'oui' : 'non');
  }
  for (const ajout of [['--cas', 'duo-cockpit,duo-cockpit'], ['--cas', 'inconnu'], ['--taille', '1,2'],
    ['--url', 'file:///autre.html'], ['--inconnu', 'oui']]) assert.throws(() => optionsTroll([...base, ...ajout]));
  assert.throws(() => optionsTroll(['--url', 'https://example.org', '--sortie', '/tmp/troll']));
});

function rapport(s) {
  const mains = actif => [0, 1].map(() => ({ pieces: 5, empreinteLocale: actif ? 'bb000001' : 'aa000001' }));
  return {
    source: { commit: 'a'.repeat(40) }, build: { sha256: 'b'.repeat(64) },
    environnement: { webgpu: true, physx: { ready: true } }, erreurs: [], avertissements: [],
    initialisation: { entree: 'BITUME_JEU.reference', mode: 'duo', modulesRemplaces: false, cameraImposee: false, choix: structuredClone(CHOIX_TROLL) },
    images: INSTANTS_TROLL.map((instant, i) => {
      const joues = i === 0 ? 0 : i < 3 ? 1 : 2;
      const joueurs = [0, 1].map(n => {
        const age = instant.t - (n ? .2 : .05), duree = n ? 1.8 : 1.4, actif = age >= -1e-5 && age < duree - 1e-5;
        const intensite = !actif || Math.abs(age) < 1e-5 ? 0 : age < .24 || age > duree - .36 ? .4 : 1;
        return { local: n, id: n + 4, expression: { geste: actif ? CHOIX_TROLL[n].geste : null, gesteIntensite: intensite },
          articulations: Array(18).fill(intensite * .1), mains: mains(intensite > 0) };
      });
      const n = i < 3 ? 0 : 1, choix = CHOIX_TROLL[n];
      return { etat: { zones: Object.fromEntries(['scene', 'scene2', ...(s.vue === 'cockpit' ? ['glace-g', 'glace-d', 'glace-g2', 'glace-d2'] : [])].map(id => [id, {}])) },
        vues: { scene: { noir: .1, luminance: .5 }, scene2: { noir: .1, luminance: .5 } },
        observation: { index: i, t: instant.t, tempsRendu: 6 + instant.t, type: 'duo', ecran: 'course', vue: s.vue, vue2: s.vue, cameraImposee: false,
          gpuErreur: null, gpuPerdu: false, autresGestes: [], audio: { actif: true, joues, ignores: 0, voix: 5, budget: 5 }, joueurs,
          evenement: { pilote: n + 4, sequence: n + 1, geste: choix.geste, klaxon: choix.klaxon, instant: 6 + instant.t }, audioEvenement: { klaxon: choix.klaxon },
          entrees: [0, 1].map(n => ({ appuis: instant.t + 1e-5 >= (n ? .2 : .05) ? 1 : 0, repetitions: i >= 11 ? 2 : i >= 5 ? 1 : 0, relachements: i === 12 ? 1 : 0, nonFiables: 0 })) } };
    })
  };
}

test('les deux séquences cohérentes satisfont le contrat sans confondre identifiants et places', () => {
  for (const s of SCENARIOS_TROLL) assert.deepEqual(verifierTroll(rapport(s), s), [], s.id);
});

test('les faux succès audio et le déclenchement contournant les vrais appuis sont refusés', () => {
  const s = SCENARIOS_TROLL[0];
  for (const modifier of [
    r => { r.images[1].observation.audio.joues = 0; },
    r => { r.images[3].observation.audio.joues = 3; },
    r => { r.images[11].observation.audio.joues = 4; },
    r => { r.images[3].observation.audio.ignores = 1; },
    r => { r.images[1].observation.evenement.pilote = 5; },
    r => { r.images[3].observation.evenement.klaxon = 'ancien'; },
    r => { r.images[3].observation.evenement.instant -= .05; },
    r => { r.images[3].observation.audioEvenement.klaxon = 'ancien'; },
    r => { r.images[1].observation.joueurs[0].expression.gesteIntensite = .4; },
    r => { r.images[5].observation.entrees[0].nonFiables = 1; },
    r => { r.images[11].observation.entrees[1].repetitions = 1; },
    r => { r.initialisation.modulesRemplaces = true; },
    r => { r.images[3].observation.autresGestes.push(7); }
  ]) {
    const r = rapport(s); modifier(r); assert(verifierTroll(r, s).length, modifier.toString());
  }
});

test('une pose figée, une montée manquante et un retour incomplet ne closent pas le pilote', () => {
  const s = SCENARIOS_TROLL[0];
  for (const modifier of [
    r => { r.images.splice(2, 1); },
    r => { r.images[4].observation.t = .2; },
    r => { r.images[4].observation.joueurs[1].expression.geste = 'poing'; },
    r => { r.images[5].observation.joueurs[0].expression.gesteIntensite = .5; },
    r => { r.images[2].observation.joueurs[0].articulations.fill(0); },
    r => { r.images[7].observation.joueurs[0].expression.gesteIntensite = 1; },
    r => { r.images[10].observation.joueurs[0].articulations[6] = .1; },
    r => { r.images[10].observation.joueurs[1].mains[0].empreinteLocale = 'bb000001'; },
    r => { r.images[8].observation.joueurs[0].expression.geste = 'poing'; },
    r => { r.images[5].observation.joueurs[1].articulations[0] = NaN; }
  ]) {
    const r = rapport(s); modifier(r); assert(verifierTroll(r, s).length, modifier.toString());
  }
});

test('la seconde vue, les quatre rétros et le vrai WebGPU font partie de la preuve', () => {
  const s = SCENARIOS_TROLL[0];
  for (const modifier of [
    r => { r.build.sha256 = ''; }, r => { r.source.commit = ''; },
    r => { r.environnement.webgpu = false; }, r => { r.environnement.physx.ready = false; },
    r => { r.images[2].observation.vue2 = 'poursuite'; },
    r => { delete r.images[4].etat.zones['glace-d2']; },
    r => { delete r.images[0].etat.zones.scene2; },
    r => { r.images[0].vues.scene2 = { noir: 1, luminance: 0 }; },
    r => { r.images[0].observation.cameraImposee = true; },
    r => { r.images[2].observation.gpuErreur = 'GPUValidationError'; },
    r => { r.images[2].observation.gpuPerdu = true; }
  ]) {
    const r = rapport(s); modifier(r); assert(verifierTroll(r, s).length, modifier.toString());
  }
});

function bancHorlogeTroll() {
  const contexte = vm.createContext({});
  contexte.window = contexte;
  vm.runInContext(horlogeCapture(17017), contexte);
  vm.runInContext(`
    globalThis.BITUME_JEU = { session: { tRendu: 0 } };
    globalThis.__TROLL_CAPTURE = { origine: 6, index: 10 };
    let raf;
    function rendre(ms) { BITUME_JEU.session.tRendu = ms / 1000; raf = requestAnimationFrame(rendre); }
    raf = requestAnimationFrame(rendre);
    const avancer = __BITUME_CAPTURE.avancer;
    globalThis.pasNatifs = 0;
    __BITUME_CAPTURE.avancer = ms => { pasNatifs++; return avancer(ms); };
    __BITUME_CAPTURE.avancer(7150);
    pasNatifs = 0;
  `, contexte);
  const commandes = [], entrees = [], rapport = {};
  return {
    contexte, commandes, entrees, rapport,
    async evaluer(expression) {
      const avant = contexte.pasNatifs;
      try { return vm.runInContext(expression, contexte); }
      finally { commandes.push({ pas: contexte.pasNatifs - avant, temps: contexte.BITUME_JEU.session.tRendu }); }
    },
    async envoyer(method, params) { entrees.push({ method, params, temps: contexte.BITUME_JEU.session.tRendu }); },
    avancerCapture() { return this.evaluer('__BITUME_CAPTURE.avancer(50)'); }
  };
}

test('le vrai pilote avance la vraie horloge entre deux instants sans regrouper les rendus', async () => {
  const b = bancHorlogeTroll();
  await avantImageTroll({ ...b, i: 11 });
  assert(Math.abs(b.contexte.BITUME_JEU.session.tRendu - 8.75) < 1e-9);
  await b.avancerCapture();
  await avantImageTroll({ ...b, i: 12 });
  await b.avancerCapture();
  assert(Math.abs(b.contexte.BITUME_JEU.session.tRendu - 8.85) < 1e-9);
  assert.equal(b.contexte.__TROLL_CAPTURE.index, 12);
  assert(b.commandes.every(c => c.pas <= 1), 'Chaque commande DevTools doit exécuter zéro ou un pas natif');
  assert.equal(b.contexte.pasNatifs, 14);
  assert.deepEqual(b.entrees.map(e => [e.method, e.params.type, e.params.code, e.params.autoRepeat]), [
    ['Input.dispatchKeyEvent', 'keyDown', 'KeyG', true],
    ['Input.dispatchKeyEvent', 'keyDown', 'NumpadDecimal', true],
    ['Input.dispatchKeyEvent', 'keyUp', 'KeyG', false],
    ['Input.dispatchKeyEvent', 'keyUp', 'NumpadDecimal', false]
  ]);
  for (const [i, e] of b.entrees.entries()) assert(Math.abs(e.temps - (i < 2 ? 8.75 : 8.8)) < 1e-9);
  assert.deepEqual(b.rapport.progressionTroll.map(t => [t.instant, t.pasDemandes, t.pasTermines, t.phase]), [
    ['maintien-apres-delai', 12, 12, 'attente-capture'], ['relachement', 0, 0, 'attente-capture']
  ]);
});

test('une interruption du pilote interrompt les pas et empêche les événements suivants', async () => {
  const b = bancHorlogeTroll(), interruption = new Error('DevTools interrompu');
  let appels = 0;
  await assert.rejects(avantImageTroll({ ...b, i: 11, evaluer: expression => {
    if (++appels === 4) return Promise.reject(interruption);
    return b.evaluer(expression);
  } }), e => e === interruption);
  assert.equal(appels, 4);
  assert.equal(b.contexte.pasNatifs, 2);
  assert.deepEqual(b.entrees, []);
  const trace = b.rapport.progressionTroll[0];
  assert.equal(trace.phase, 'avance-horloge');
  assert.equal(trace.pasDemandes, 3); assert.equal(trace.pasTermines, 2);
  assert.match(trace.erreur, /DevTools interrompu/);
});

test('une horloge de rendu arrêtée conserve la borne de quatre-vingts pas', async () => {
  const b = bancHorlogeTroll();
  vm.runInContext('cancelAnimationFrame(raf)', b.contexte);
  await assert.rejects(avantImageTroll({ ...b, i: 11 }), /Horloge de rendu non atteinte/);
  assert.equal(b.contexte.pasNatifs, 80);
  assert(b.commandes.every(c => c.pas <= 1));
  assert.deepEqual(b.entrees, []);
});
