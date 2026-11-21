import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

createRequire(import.meta.url)('../src/son.js');
const Son = globalThis.BITUME.son;
let controles = 0;
const verifier = (nom, fn) => { fn(); controles++; console.log('ok  ' + nom); };

// Le faux contexte conserve les connexions du vrai graphe et calcule les transitions exponentielles des
// AudioParam. Les contrôles suivent ce qui parvient aux filtres et sorties, sans copier les courbes du jeu.
function fauxAudio() {
  const noeuds = [], sources = [], contextes = [];
  const param = initial => {
    let depart = initial, cible = initial, temps = 0, constante = 0;
    const a = t => constante ? cible + (depart - cible) * Math.exp(-Math.max(0, t - temps) / constante) : cible;
    const p = {
      cibles: [], valeurs: [], at: a,
      get value() { return a(contextes.at(-1)?.currentTime || 0); },
      set value(v) { depart = cible = v; constante = 0; },
      setTargetAtTime(v, t, tc) { depart = a(t); cible = v; temps = t; constante = tc; p.cibles.push({ v, t, tc }); },
      setValueAtTime(v, t) { depart = cible = v; temps = t; constante = 0; p.valeurs.push({ v, t }); },
      linearRampToValueAtTime(v, t) { p.valeurs.push({ v, t }); },
      exponentialRampToValueAtTime(v, t) { assert(v > 0); p.valeurs.push({ v, t }); },
      cancelScheduledValues() {}
    };
    return p;
  };
  const node = extra => {
    const n = Object.assign({ connections: [], connect(x) { n.connections.push(x); return x; }, disconnect() {} }, extra);
    noeuds.push(n); return n;
  };
  const source = extra => node({ ...extra, start(t, offset) { this.startAt = t; this.offset = offset; }, stop() {} });
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.destination = node({}); contextes.push(this); }
    resume() {}
    createGain() { return node({ gain: param(1) }); }
    createOscillator() { return source({ frequency: param(440), detune: param(0), setPeriodicWave() {} }); }
    createPeriodicWave() { return {}; }
    createDelay() { return node({ delayTime: param(0) }); }
    createBiquadFilter() { return node({ frequency: param(350), Q: param(1), gain: param(0) }); }
    createWaveShaper() { return node({}); }
    createDynamicsCompressor() { return node({ threshold: param(-24), knee: param(30), ratio: param(12), attack: param(.003), release: param(.25) }); }
    createStereoPanner() { return node({ pan: param(0) }); }
    createBuffer(c, n) { const data = new Float32Array(n); return { getChannelData: () => data }; }
    createBufferSource() { const s = source({ buffer: null, loop: false, playbackRate: param(1) }); sources.push(s); return s; }
  }
  return { Ctx, noeuds, sources, contextes };
}
function avecSon(fn) {
  const fa = fauxAudio(), ancien = globalThis.window;
  globalThis.window = { AudioContext: fa.Ctx };
  try {
    const son = Son.creer(); son.demarrer();
    const ctx = fa.contextes[0];
    const vents = fa.sources.filter(s => s.connections[0]?.type === 'highpass').map(s => {
      const ph = s.connections[0], [pb, grave] = ph.connections;
      const aiguG = pb.connections[0], graveG = grave.connections[0], pan = aiguG.connections[0];
      assert.equal(graveG.connections[0], pan);
      return { s, pb: pb.frequency, aigu: aiguG.gain, grave: graveG.gain, pan: pan.pan, bus: pan.connections[0] };
    });
    assert.equal(vents.length, 2, 'deux souffles préparés au premier geste');
    assert.notEqual(vents[0].s.offset, vents[1].s.offset, 'boucles décalées entre auditeurs');
    const avancer = dt => { ctx.currentTime += dt; };
    fn({ son, fa, ctx, vents, avancer });
  } finally { if (ancien === undefined) delete globalThis.window; else globalThis.window = ancien; }
}
const joueur = ajout => ({ id: 0, v: 75, regime: 10000, gaz: .8, vue: 'cockpit', ventActif: true, aspiration: 0, ...ajout });
const cible = p => p.cibles.at(-1)?.v ?? p.value;
const instantane = v => ({ aigu: cible(v.aigu), grave: cible(v.grave), filtre: cible(v.pb) });

verifier('entrée et sortie du sillage : timbre différencié, retour exact et transition sans saut', () => avecSon(({ son, ctx, vents, avancer }) => {
  const j = joueur(), e = { joueur: j }, v = vents[0];
  son.mettreAJour(e); avancer(3); const libre = instantane(v), niveauAvant = v.aigu.value;
  assert(libre.aigu > 0 && libre.grave > 0);
  j.aspiration = 1; son.mettreAJour(e); const abri = instantane(v);
  assert(abri.aigu < libre.aigu * .6 && abri.filtre < libre.filtre * .55, 'flux aigu assourdi dans le sillage');
  assert(abri.grave > libre.grave * 4, 'turbulence grave perceptible');
  assert(Math.abs(v.aigu.value - niveauAvant) < 1e-12, 'pas de saut de gain à l’entrée');
  const depart = ctx.currentTime; avancer(.1);
  assert(v.aigu.value < niveauAvant && v.aigu.value > abri.aigu);
  assert(v.grave.value > libre.grave && v.grave.value < abri.grave);
  avancer(2); const avantSortie = v.aigu.value;
  j.aspiration = 0; son.mettreAJour(e);
  assert.deepEqual(instantane(v), libre, 'le souffle revient à ses cibles initiales');
  assert(Math.abs(v.aigu.value - avantSortie) < 1e-12, 'pas de saut de gain à la sortie');
  avancer(.1); assert(v.aigu.value > avantSortie && v.aigu.value < libre.aigu);
  assert(v.aigu.cibles.every(p => p.tc > 0 && p.t >= 0));
  assert(depart > 0);
}));

verifier('absence de télémétrie, valeurs invalides et petite vitesse : niveaux finis et silence à l’arrêt', () => avecSon(({ son, vents }) => {
  const v = vents[0], j = joueur({ aspiration: undefined });
  son.mettreAJour({ joueur: j }); const sans = instantane(v);
  j.aspiration = 0; son.mettreAJour({ joueur: j }); assert.deepEqual(instantane(v), sans);
  for (const x of [undefined, NaN, Infinity, -Infinity, 'invalide']) {
    j.aspiration = x; son.mettreAJour({ joueur: j }); assert.deepEqual(instantane(v), sans);
  }
  for (const vitesse of [0, 5, -3, NaN, Infinity]) {
    j.v = vitesse; j.aspiration = 1; son.mettreAJour({ joueur: j });
    assert.equal(cible(v.aigu), 0); assert.equal(cible(v.grave), 0); assert(Number.isFinite(cible(v.pb)));
  }
  son.mettreAJour({}); assert.equal(cible(v.aigu), 0); assert.equal(cible(v.grave), 0);
}));

verifier('souffle seulement autorisé par le cadrage, indépendant du moteur muet de poursuite', () => avecSon(({ son, vents }) => {
  const v = vents[0];
  for (const vue of ['cockpit', 'poursuite']) {
    son.mettreAJour({ joueur: joueur({ vue, muet: true, aspiration: 1 }) });
    assert(cible(v.aigu) > 0 && cible(v.grave) > 0, vue);
  }
  for (const vue of ['cockpit', 'arceau', 'nez', 'aileron-avant', 'poursuite-proche', 'poursuite', 'helico', 'tele', 'faune']) {
    son.mettreAJour({ joueur: joueur({ vue, ventActif: false }) });
    assert.equal(cible(v.aigu), 0); assert.equal(cible(v.grave), 0);
  }
  for (const vue of ['helico', 'tele', undefined]) {
    son.mettreAJour({ joueur: joueur({ vue, ventActif: undefined }) });
    assert.equal(cible(v.aigu), 0); assert.equal(cible(v.grave), 0);
  }
}));

verifier('pause explicite, pause télémétrique et reprise coupent les deux bandes sans recréer le graphe', () => avecSon(({ son, fa, vents, avancer }) => {
  const e = { joueur: joueur({ aspiration: 1 }) }, v = vents[0], count = fa.noeuds.length;
  son.mettreAJour(e); avancer(2); assert(v.aigu.value > 0 && v.grave.value > 0);
  son.suspendre(); assert.equal(cible(v.aigu), 0); assert.equal(cible(v.grave), 0);
  son.mettreAJour(e); assert.equal(cible(v.aigu), 0); avancer(.5);
  assert(v.aigu.value < 1e-7 && v.grave.value < 1e-7);
  son.reprendre(); son.mettreAJour(e); assert(cible(v.aigu) > 0 && cible(v.grave) > 0);
  son.mettreAJour({ ...e, pause: true }); assert.equal(cible(v.aigu), 0); assert.equal(cible(v.grave), 0);
  son.mettreAJour(e); assert(cible(v.aigu) > 0); assert.equal(fa.noeuds.length, count);
}));

verifier('les deux auditeurs gardent leur sillage et J2 disparaît sans souffle fantôme', () => avecSon(({ son, fa, vents, avancer }) => {
  const j1 = joueur(), j2 = joueur({ id: 1, aspiration: 1 }), e = { joueur: j1, joueur2: j2 };
  son.mettreAJour(e); const n = fa.noeuds.length, ns = fa.sources.length;
  const [v1, v2] = vents, libre = instantane(v1), abri = instantane(v2);
  assert(libre.aigu > abri.aigu && libre.grave < abri.grave);
  assert(cible(v1.pan) < 0 && cible(v2.pan) > 0);
  j1.aspiration = 1; j2.aspiration = 0; son.mettreAJour(e);
  assert.deepEqual(instantane(v1), abri); assert.deepEqual(instantane(v2), libre);
  for (let i = 0; i < 120; i++) { avancer(1 / 60); son.mettreAJour(e); }
  assert.equal(fa.noeuds.length, n); assert.equal(fa.sources.length, ns);
  e.joueur2 = null; son.mettreAJour(e);
  assert.equal(cible(v2.aigu), 0); assert.equal(cible(v2.grave), 0); assert.equal(cible(v1.pan), 0);
  son.suspendre(); for (const v of vents) { assert.equal(cible(v.aigu), 0); assert.equal(cible(v.grave), 0); }
}));

verifier('changement de pilote suivi : aucune nouvelle impulsion, source ou note', () => avecSon(({ son, fa, vents }) => {
  const e = { joueur: joueur({ aspiration: .6 }) }, v = vents[0];
  son.mettreAJour(e); const avant = instantane(v), count = fa.noeuds.length, src = fa.sources.length;
  e.joueur.id = 7; son.mettreAJour(e); assert.deepEqual(instantane(v), avant);
  e.joueur.aspiration = 0; son.mettreAJour(e); assert(cible(v.aigu) > avant.aigu);
  assert.equal(fa.noeuds.length, count); assert.equal(fa.sources.length, src); assert.equal(son.stats().musique, false);
}));

verifier('les volumes Effets et Général contrôlent tout le souffle', () => avecSon(({ son, vents }) => {
  const bus = vents[0].bus, maitre = bus.connections[0];
  assert.equal(vents[1].bus, bus);
  son.regler({ effets: 0, general: 0 });
  assert.equal(bus.gain.valeurs.at(-1).v, 0); assert.equal(maitre.gain.valeurs.at(-1).v, 0);
  son.regler({ effets: .25, general: .5 });
  assert.equal(bus.gain.valeurs.at(-1).v, .25); assert.equal(maitre.gain.valeurs.at(-1).v, .4);
}));

verifier('le vrai raccord du jeu transmet l’aspiration du pilote suivi et autorise le souffle dans les bonnes vues', () => avecSon(({ son, vents }) => {
  const source = readFileSync(new URL('../src/jeu.js', import.meta.url), 'utf8');
  const debut = source.indexOf('  function decrireMoteur('), fin = source.indexOf('  // écoute des claquements', debut);
  assert(debut >= 0 && fin > debut);
  const description = new Function('ecran', 'VUES_DEHORS', 'sousLaVoute', 'clamp', source.match(/^  const VUES_COURSE = [^\n]+;/m)[0] + '\n' + source.slice(debut, fin) + '; return decrireMoteur;');
  const v = { id: 7, etat: { v: 300 / 3.6, regime: 10000, gaz: 1, rapport: 6, glisse: 0, surface: 0, turbo: { reste: 0 }, aspiration: .8 } };
  const avant = JSON.stringify(v), resultat = {};
  for (const ecran of ['titre', 'reglages', 'pause', 'course', 'demo']) {
    const decrire = description(ecran, new Set(['helico', 'tele', 'faune']), () => false, (x,a,b) => Math.max(a, Math.min(b,x)));
    for (const vue of ['cockpit', 'arceau', 'nez', 'aileron-avant', 'poursuite-proche', 'poursuite', 'helico', 'tele', 'faune']) {
      decrire(resultat, { vue, course: { c: {} } }, v, { pos: [0,1,0] });
      assert.equal(resultat.id, 7); assert.equal(resultat.aspiration, .8);
      son.mettreAJour({ joueur: resultat });
      const attendu = ['course','demo'].includes(ecran) && ['cockpit','arceau','nez','aileron-avant','poursuite-proche','poursuite'].includes(vue);
      assert.equal(cible(vents[0].aigu) > 0, attendu, ecran + '/' + vue);
    }
  }
  assert.equal(JSON.stringify(v), avant, 'le son ne doit modifier aucun état de conduite');
}));

console.log(`${controles} contrôles son aspiration réussis`);
