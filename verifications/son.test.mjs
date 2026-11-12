import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));

let nb = 0;
function verifier(nom, f) {
  try { f(); nb++; console.log('ok  ' + nom); }
  catch (e) { console.error('ECHEC ' + nom + ' : ' + e.message); process.exitCode = 1; }
}

charger('son.js');
const B = globalThis.BITUME;

verifier('module charge sans AudioContext', function () {
  assert.ok(B && B.son, 'BITUME.son absent');
  assert.equal(typeof B.son.creer, 'function');
});

verifier('creer sans demarrer : methodes sans effet', function () {
  const s = B.son.creer();
  s.demarrer();
  s.regler({ general: 0.5, moteur: 0.5, effets: 0.5 });
  s.mettreAJour({ pause: false, joueur: { regime: 8000, gaz: 0.8, rapport: 3, v: 50, glisse: 0.3, surface: 'piste', turbo: false, vue: 'cockpit' }, rivaux: [] }, 0.016);
  s.evenement('rapport', { haut: true });
  s.evenement('choc', { force: 0.8 });
  s.evenement('vert');
  s.evenement('turbo', { niveau: 1, parfait: true });
  s.suspendre();
  s.reprendre();
  const st = s.stats();
  assert.equal(st.actif, false);
  assert.equal(st.voix, 0);
});

verifier('frequenceAllumage(12000) = 800', function () {
  assert.equal(B.son.frequenceAllumage(12000), 800);
});

verifier('coupure bornee [600,6500]', function () {
  assert.equal(B.son.coupure(0, 0), 700);
  assert.equal(B.son.coupure(1, 100000), 6500);
  assert.equal(B.son.coupure(0, -100000), 600);
  assert.ok(B.son.coupure(0.5, 6000) >= 600 && B.son.coupure(0.5, 6000) <= 6500);
});

verifier('gainDistance(0)=1 et decroissant', function () {
  assert.equal(B.son.gainDistance(0), 1);
  assert.ok(B.son.gainDistance(14) < B.son.gainDistance(0));
  assert.ok(B.son.gainDistance(100) < B.son.gainDistance(14));
  assert.ok(B.son.gainDistance(1000) >= 0 && B.son.gainDistance(1000) <= 1);
});

verifier('doppler(0)=1 et >1 pour rapprochement', function () {
  assert.equal(B.son.doppler(0), 1);
  assert.ok(B.son.doppler(50) > 1);
  assert.ok(B.son.doppler(-50) < 1);
  assert.ok(B.son.doppler(1000) <= 343 / (343 - 120));
});

verifier('panoramique(pi/2)=1 et borne', function () {
  assert.equal(B.son.panoramique(Math.PI / 2), 1);
  assert.equal(B.son.panoramique(-Math.PI / 2), -1);
  assert.equal(B.son.panoramique(0), 0);
  assert.ok(B.son.panoramique(100) >= -1 && B.son.panoramique(100) <= 1);
});


// Faux Web Audio minimal : vérifie que tout le graphe se construit et que chaque méthode tourne.
function fauxAudio() {
  let noeuds = 0, actifs = 0;
  const param = v => ({ value: v, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('rampe exponentielle vers ' + x); }, cancelScheduledValues() {} });
  const noeud = extra => { noeuds++; return Object.assign({ connect(x) { return x; }, disconnect() {} }, extra); };
  const source = extra => noeud(Object.assign({ start() { actifs++; }, stop() {}, set onended(f) { this._fin = f; } }, extra));
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.destination = noeud({}); }
    resume() {}
    createGain() { return noeud({ gain: param(1) }); }
    createOscillator() { return source({ type: 'sine', frequency: param(440), detune: param(0) }); }
    createBiquadFilter() { return noeud({ type: 'lowpass', frequency: param(350), Q: param(1) }); }
    createWaveShaper() { return noeud({ curve: null, oversample: 'none' }); }
    createDynamicsCompressor() { return noeud({ threshold: param(-24), knee: param(30), ratio: param(12), attack: param(.003), release: param(.25) }); }
    createStereoPanner() { return noeud({ pan: param(0) }); }
    createBuffer(c, n) { const d = new Float32Array(n); return { getChannelData: () => d }; }
    createBufferSource() { return source({ buffer: null, loop: false }); }
  }
  return { Ctx, compte: () => ({ noeuds, actifs }) };
}

verifier('graphe complet avec un faux contexte audio', function () {
  const fa = fauxAudio();
  globalThis.window = { AudioContext: fa.Ctx };
  try {
    const son = B.son.creer();
    son.demarrer();
    assert.equal(son.stats().actif, true, 'actif apres demarrer');
    const avant = fa.compte().noeuds;
    const etat = { pause: false, joueur: { regime: 9000, gaz: 1, rapport: 3, v: 40, glisse: .6, surface: 'vibreur', turbo: true, vue: 'cockpit' },
      rivaux: [1, 2, 3, 4, 5].map(i => ({ id: i, distance: i * 9, angle: i - 3, regime: 8000 + i * 500, gaz: .8, vRel: 4 - i })) };
    for (let i = 0; i < 120; i++) son.mettreAJour(etat, 1 / 60);
    assert.equal(fa.compte().noeuds, avant, 'aucun noeud cree par mettreAJour');
    assert.equal(son.stats().voix, 4, 'joueur et trois rivaux');
    etat.rivaux.reverse(); etat.rivaux.forEach((r, i) => { r.distance = i * 9; });
    for (let i = 0; i < 30; i++) son.mettreAJour(etat, 1 / 60);
    for (const [nom, p] of [['rapport', { haut: true }], ['rupteur'], ['choc', { force: 12 }], ['contact', { force: 4 }], ['feu'], ['vert'], ['derive'],
      ['niveau', { niveau: 3 }], ['fenetre'], ['turbo', { niveau: 2, parfait: true }], ['deriveAnnulee'], ['tour', { meilleur: true }], ['tour', {}], ['arrivee'], ['clic']]) son.evenement(nom, p);
    son.regler({ general: 0, moteur: .5, effets: 1 });
    son.suspendre(); son.mettreAJour(etat, 1 / 60); son.reprendre(); son.mettreAJour(etat, 1 / 60);
  } finally { delete globalThis.window; }
});

console.log(nb + ' vérifications réussies');
process.exit(process.exitCode || 0);
