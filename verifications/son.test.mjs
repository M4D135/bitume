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
  let noeuds = 0, actifs = 0, enRetard = 0;
  const oscillateurs = [], contextes = [];
  const param = v => ({ value: v, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('rampe exponentielle vers ' + x); }, cancelScheduledValues() {} });
  const noeud = extra => { noeuds++; return Object.assign({ connect(x) { return x; }, disconnect() {} }, extra); };
  const source = extra => noeud(Object.assign({ start(t) { actifs++; this.debut = t; if (t < contextes[contextes.length - 1].currentTime - 1e-9) enRetard++; }, stop() {}, set onended(f) { this._fin = f; } }, extra));
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.destination = noeud({}); contextes.push(this); }
    resume() {}
    createGain() { return noeud({ gain: param(1) }); }
    createOscillator() { const o = source({ type: 'sine', frequency: param(440), detune: param(0), setPeriodicWave(w) { o.type = 'custom'; o.onde = w; } }); oscillateurs.push(o); return o; }
    createPeriodicWave(re, im) { return { re, im }; }
    createDelay() { return noeud({ delayTime: param(0) }); }
    createBiquadFilter() { return noeud({ type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }); }
    createWaveShaper() { return noeud({ curve: null, oversample: 'none' }); }
    createDynamicsCompressor() { return noeud({ threshold: param(-24), knee: param(30), ratio: param(12), attack: param(.003), release: param(.25) }); }
    createStereoPanner() { return noeud({ pan: param(0) }); }
    createBuffer(c, n) { const d = new Float32Array(n); return { getChannelData: () => d }; }
    createBufferSource() { return source({ buffer: null, loop: false }); }
  }
  return { Ctx, compte: () => ({ noeuds, actifs, enRetard }), oscillateurs, contextes };
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

// David, 12/11/2026 : « pas de musique sauf à l'écran titre ». Un signal de course ne porte ni mélodie ni accord.
verifier('signaux de course sans musique : une seule hauteur au plus par signal', function () {
  const fa = fauxAudio();
  globalThis.window = { AudioContext: fa.Ctx };
  try {
    const son = B.son.creer();
    son.demarrer();
    for (const [nom, p] of [['rapport', { haut: true }], ['rupteur'], ['choc', { force: 12 }], ['contact', { force: 4 }], ['feu'], ['vert'], ['derive'], ['deriveAnnulee'],
      ['niveau', { niveau: 1 }], ['niveau', { niveau: 3 }], ['fenetre'], ['turbo', { niveau: 1 }], ['turbo', { niveau: 3, parfait: true }],
      ['tour', {}], ['tour', { meilleur: true }], ['arrivee'], ['clic']]) {
      const avant = fa.oscillateurs.length;
      son.evenement(nom, p);
      const hauteurs = new Set(fa.oscillateurs.slice(avant).map(o => o.frequency.value));
      assert.ok(hauteurs.size <= 1, nom + ' joue ' + [...hauteurs].join(' et ') + ' Hz');
    }
    assert.equal(son.stats().musique, false, 'aucun signal ne lance le thème');
  } finally { delete globalThis.window; }
});

verifier('thème du titre : huit mesures de mélodie en la mineur sur huit accords', function () {
  const T = B.son.THEME, gamme = [9, 11, 0, 2, 4, 5, 7];
  assert.equal(T.accords.length, 8);
  assert.equal(T.melodie.reduce((s, n) => s + n[1], 0), 128, 'huit mesures de seize doubles croches');
  for (const [n, d] of T.melodie) {
    assert.ok(Number.isInteger(d) && d > 0);
    if (n) assert.ok(gamme.includes(n % 12) && n >= 60 && n <= 84, 'note ' + n);
  }
  for (const [racine, ...iv] of T.accords) for (const v of [0, ...iv]) assert.ok(gamme.includes((racine + v) % 12), 'accord ' + racine + '+' + v);
  assert.equal(T.basse.length, 8);
  assert.ok(T.arpege.length === 8 && T.arpege.every(d => d >= 0 && d <= 3));
});

verifier('thème du titre : rien avant le premier geste, boucle entière, arrêt net, pas de rafale', function () {
  const fa = fauxAudio();
  globalThis.window = { AudioContext: fa.Ctx };
  const vrais = [globalThis.setInterval, globalThis.clearInterval];
  let rappel = null, coupes = 0;
  globalThis.setInterval = f => { rappel = f; return 7; };
  globalThis.clearInterval = h => { if (h === 7) coupes++; };
  try {
    const son = B.son.creer(), T = B.son.THEME, double = 60 / T.tempo / 4, depart = 0.06, hz = n => 440 * Math.pow(2, (n - 69) / 12);
    son.musique(true);
    assert.equal(son.stats().musique, false, 'sans effet avant demarrer');
    son.demarrer();
    const ctx = fa.contextes[0], repos = fa.compte().noeuds;
    son.musique(false);
    assert.ok(fa.compte().noeuds === repos && rappel === null, 'couper un thème arrêté ne fait rien');
    son.musique(true); son.musique(true);
    assert.equal(son.stats().musique, true);
    assert.ok(rappel, 'minuteur armé');
    // une boucle et une mesure, par pas de 50 ms
    while (ctx.currentTime < depart + (256 + 16) * double) { ctx.currentTime += 0.05; rappel(); }
    assert.equal(fa.compte().enRetard, 0, 'aucune note programmée dans le passé');
    const fin = depart + 256 * double - 1e-6, proche = (a, b) => Math.abs(a - b) < 1e-6 * b;
    const boucle = fa.oscillateurs.filter(o => o.debut >= depart - 1e-9 && o.debut < fin);
    const chant = boucle.filter(o => o.type === 'triangle'), attendu = T.melodie.filter(n => n[0]).map(n => hz(n[0]));
    assert.equal(chant.length, attendu.length, 'mélodie entière, une fois par boucle');
    chant.forEach((o, i) => assert.ok(proche(o.frequency.value, attendu[i]), 'note ' + i + ' : ' + o.frequency.value));
    assert.ok(Math.abs(chant[0].debut - (depart + 128 * double)) < 1e-6, 'la mélodie entre à la neuvième mesure');
    assert.equal(boucle.filter(o => o.type === 'sine').length, 16 * 3 + 8, 'grosse caisse : trois coups par mesure, un quatrième une mesure sur deux');
    const basses = boucle.filter(o => o.type === 'sawtooth' && o.detune.value === 0); // la nappe est désaccordée, pas la basse
    assert.equal(boucle.filter(o => o.type === 'sawtooth' && o.detune.value !== 0).length, 8 * 3, 'nappe : trois voix toutes les deux mesures');
    assert.equal(basses.length, 16 * 8, 'basse à chaque croche');
    assert.ok(proche(basses[0].frequency.value, 55), 'la boucle part sur un la');
    const reprise = fa.oscillateurs.find(o => o.type === 'sawtooth' && o.detune.value === 0 && Math.abs(o.debut - (depart + 256 * double)) < 1e-6);
    assert.ok(reprise && proche(reprise.frequency.value, 55), 'la boucle reprend au début');
    // arrêt : le minuteur est rendu, un rappel resté en file ne joue plus rien
    son.musique(false);
    assert.ok(son.stats().musique === false && coupes === 1);
    const apres = fa.compte().noeuds;
    ctx.currentTime += 1; rappel();
    assert.equal(fa.compte().noeuds, apres, 'plus une note après l’arrêt');
    // onglet ralenti : après cinq secondes sans minuteur, on reprend sans rattraper les notes manquées
    son.musique(true);
    ctx.currentTime += 5;
    const avant = fa.compte().actifs;
    rappel();
    assert.ok(fa.compte().actifs - avant <= 16, (fa.compte().actifs - avant) + ' sources d’un coup');
    assert.equal(fa.compte().enRetard, 0);
    son.musique(false);
  } finally { [globalThis.setInterval, globalThis.clearInterval] = vrais; delete globalThis.window; }
});

console.log(nb + ' vérifications réussies');
process.exit(process.exitCode || 0);
