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
  const oscillateurs = [], contextes = [], parametres = [], sources = [], tampons = [];
  const param = v => {
    const p = { value: v, cibles: [], valeurs: [],
      setValueAtTime(v, t) { p.valeurs.push({ v, t }); }, setTargetAtTime(v, t, tc) { p.cibles.push({ v, t, tc }); },
      linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('rampe exponentielle vers ' + x); }, cancelScheduledValues() {} };
    parametres.push(p); return p;
  };
  // chaque nœud porte son rang de création et retient le nœud auquel il se branche (suite)
  const noeud = extra => Object.assign({ rang: noeuds++, connect(x) { (this.connexions ||= []).push(x); this.suite = x; return x; }, disconnect() { this.debranche = true; } }, extra);
  const source = extra => noeud(Object.assign({ start(t) { actifs++; this.debut = t; if (t < contextes[contextes.length - 1].currentTime - 1e-9) enRetard++; }, stop(t) { this.fin = t; }, set onended(f) { this._fin = f; } }, extra));
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
    createBuffer(c, n) { const d = new Float32Array(n), b = { getChannelData: () => d }; tampons.push(b); return b; }
    createBufferSource() { const s = source({ buffer: null, loop: false, playbackRate: param(1) }); sources.push(s); return s; }
  }
  return { Ctx, compte: () => ({ noeuds, actifs, enRetard }), oscillateurs, contextes, parametres, sources, tampons };
}

verifier('sélection bornée sans modifier ni recopier les rivaux', function () {
  const rivaux = [{ id: 9, distance: 1 }, { id: 1, distance: 1000 }, { id: 5, distance: 7 }, { id: 4, distance: 7 }, { id: 3, distance: 3 }, { id: 2, distance: 10 }];
  const ordre = rivaux.map(r => r.id), tampon = [];
  const retour = B.son.selectionnerRivaux(rivaux, tampon, 9, 1);
  assert.equal(retour, tampon, 'le tampon fourni est réutilisé');
  assert.deepEqual(tampon.map(r => r.id), [3, 4, 5]);
  assert.deepEqual(rivaux.map(r => r.id), ordre, 'le tableau source garde son ordre');
  assert.equal(tampon[0], rivaux[4], 'les objets sont partagés, pas clonés');
  rivaux.reverse(); B.son.selectionnerRivaux(rivaux, tampon, 9, 1);
  assert.deepEqual(tampon.map(r => r.id), [3, 4, 5], 'égalité départagée par id');
  B.son.selectionnerRivaux([{ id: 2, distance: NaN }, { id: 4, distance: Infinity }], tampon);
  assert.equal(tampon.length, 0, 'distances invalides ignorées');
});

verifier('deux moteurs humains conservés à toute distance et trois rivaux au maximum', function () {
  const fa = fauxAudio(); globalThis.window = { AudioContext: fa.Ctx };
  try {
    const s = B.son.creer();
    const joueur = { id: 0, regime: 9000, gaz: .8, vue: 'cockpit' }, joueur2 = { id: 1, regime: 11000, gaz: 1, vue: 'cockpit', distance: 4000 };
    const etat = { joueur, joueur2, rivaux: [1, 2, 3, 4, 5, 6].map(id => ({ id, distance: id === 1 ? 4000 : id, regime: 6000, gaz: .5, angle: 0, vRel: 0 })) };
    s.mettreAJour(etat);
    assert.equal(fa.contextes.length, 0, 'aucun contexte ni graphe avant le geste');
    s.demarrer(); const solo = fa.compte().noeuds;
    s.mettreAJour(etat); const duo = fa.compte().noeuds;
    assert.ok(duo > solo, 'second graphe préparé une fois');
    assert.equal(s.stats().joueurs, 2); assert.equal(s.stats().rivaux, 3); assert.equal(s.stats().voix, 5);
    for (let i = 0; i < 240; i++) { fa.contextes[0].currentTime += 1 / 60; s.mettreAJour(etat); }
    assert.equal(fa.compte().noeuds, duo, 'aucun nouveau nœud dans les images suivantes');
    assert.equal(s.stats().voix, 5); assert.equal(s.stats().budget, 5);
    assert.ok(fa.oscillateurs.some(o => o.frequency.cibles.some(p => p.v === 11000 / 120)), 'le régime de J2 atteint son moteur');
    etat.joueur2 = null; s.mettreAJour(etat);
    assert.equal(s.stats().joueurs, 2, 'le moteur de J2 finit son fondu');
    fa.contextes[0].currentTime += .2; s.mettreAJour(etat);
    assert.equal(s.stats().joueurs, 1); assert.equal(s.stats().voix, 4);
    etat.joueur2 = joueur2; s.mettreAJour(etat);
    assert.equal(fa.compte().noeuds, duo, 'retour au duo : même graphe réutilisé');
    assert.equal(s.stats().voix, 5);
    s.suspendre();
    assert.ok(fa.parametres.filter(p => p.cibles.at(-1)?.v === 0 && p.cibles.at(-1)?.tc === .03).length >= 9, 'pause : moteurs, échos et rivaux coupés en fondu');
    assert.equal(s.stats().musique, false);
  } finally { delete globalThis.window; }
});

verifier('pneus : quatre signatures, adhérence silencieuse et deux auditeurs indépendants', function () {
  const fa = fauxAudio(); globalThis.window = { AudioContext: fa.Ctx };
  try {
    const s = B.son.creer(); s.demarrer();
    const j = { v: 28, surface: 'piste', rapport: 2, contactPneus: true, deriveRelative: 0 };
    const j2 = { ...j, blocage: 1 }, e = { joueur: j, joueur2: j2 };
    s.mettreAJour(e);
    const bandes = fa.sources.filter(n => n.connexions?.length === 2 && n.connexions.every(f => f.type === 'bandpass'))
      .map(n => n.connexions);
    assert.equal(bandes.length, 2);
    const [[lat, lon], [lat2, lon2]] = bandes, cible = p => p.cibles.at(-1)?.v ?? p.value, niveau = f => cible(f.suite.gain);
    assert.equal(niveau(lat) + niveau(lon), 0);
    assert(niveau(lon2) > 0 && niveau(lat2) === 0);
    assert(cible(lat.suite.suite.pan) < 0 && cible(lat2.suite.suite.pan) > 0);
    j.deriveRelative = .94; s.mettreAJour(e);
    const approche = niveau(lat), frequenceApproche = cible(lat.frequency);
    assert(approche > 0 && niveau(lon) === 0);
    j.deriveRelative = 1.8; s.mettreAJour(e);
    const frequenceDerive = cible(lat.frequency);
    assert(niveau(lat) > approche * 4 && frequenceDerive > frequenceApproche * 1.8);
    j.deriveRelative = 0; j.patinage = 1; s.mettreAJour(e);
    assert(niveau(lon) > 0 && niveau(lat) === 0);
    assert(cible(lon.frequency) < frequenceDerive * .7 && cible(lon2.frequency) > frequenceDerive * 1.6);
    const avant = fa.compte().noeuds;
    for (let i = 0; i < 180; i++) { fa.contextes[0].currentTime += 1 / 60; s.mettreAJour(e); }
    assert.equal(fa.compte().noeuds, avant, 'deux sources de pneus continues, aucun nœud par image');
    j.v = 0; s.mettreAJour(e); assert(niveau(lon) > 0, 'patinage moteur au départ');
    j.patinage = 0; j.blocage = 1; j.deriveRelative = 2; s.mettreAJour(e);
    assert.equal(niveau(lat) + niveau(lon), 0, 'frein tenu à l’arrêt');
    j.v = 28;
    for (const [k,v] of [['surface','herbe'], ['muet',true], ['contactPneus',false]]) {
      const origine = j[k]; j[k] = v; s.mettreAJour(e); assert.equal(niveau(lat) + niveau(lon), 0, k);
      j[k] = origine;
    }
    s.suspendre(); s.mettreAJour(e); assert.equal(niveau(lat) + niveau(lon) + niveau(lon2), 0);
    s.reprendre(); s.mettreAJour(e); assert(niveau(lat) > 0 && niveau(lon) > 0 && niveau(lon2) > 0);
    e.pause = true; s.mettreAJour(e); assert.equal(niveau(lat) + niveau(lon) + niveau(lon2), 0);
    e.pause = false; e.joueur2 = null; s.mettreAJour(e);
    assert.equal(niveau(lon2), 0); assert.equal(cible(lat.suite.suite.pan), 0);
  } finally { delete globalThis.window; }
});

verifier('raclements indépendants, un seul coup au joint, extinction à la séparation et en pause', function () {
  const fa = fauxAudio(); globalThis.window = { AudioContext: fa.Ctx };
  try {
    const s = B.son.creer(); s.demarrer();
    const r = { duree:.4, matiere:'metal', vitesse:21, coupJoue:false }, r2 = { ...r, matiere:'mur' };
    const j = { raclement:r, id:0 }, j2 = { raclement:r2, id:1 };
    const e = { joueur:j, joueur2:j2 };
    s.mettreAJour(e);
    const voix = fa.sources.filter(v => v.loop && v.playbackRate.cibles.length);
    assert.equal(voix.length,2);
    const [a,b] = voix, cible = p => p.cibles.at(-1)?.v ?? p.value;
    const gain = v => cible(v.suite.suite.gain);
    assert(gain(a) > 0 && gain(b) > 0);
    assert(cible(a.suite.frequency) > 2 * cible(b.suite.frequency));
    assert(cible(a.suite.suite.suite.pan) < 0 && cible(b.suite.suite.suite.pan) > 0);
    const avant = fa.sources.length;
    for (let i = 0; i < 6; i++) s.evenement('choc',{force:2,obstacle:'glissiere',obstacleId:15+i},r);
    assert.equal(fa.sources.length,avant+1, 'un seul impact sonore le long des sections jointives');
    s.evenement('choc',{force:2,obstacle:'tronc'},r);
    assert.equal(fa.sources.length,avant+2, 'un impact avec un autre objet conserve son son');
    const noeuds = fa.compte().noeuds;
    for (let i = 0; i < 180; i++) s.mettreAJour(e);
    assert.equal(fa.compte().noeuds,noeuds);
    r.duree = .01; s.mettreAJour(e); assert.equal(gain(a),0, 'contact très bref'); assert(gain(b)>0);
    r.duree=.4; r.vitesse=0; s.mettreAJour(e); assert.equal(gain(a),0,'appui immobile');
    r.vitesse=21; j.muet=true; s.mettreAJour(e); assert.equal(gain(a),0);
    j.muet=false; s.mettreAJour(e); assert(gain(a)>0);
    s.suspendre();s.mettreAJour(e);assert.equal(gain(a)+gain(b),0);
    s.reprendre();s.mettreAJour(e);assert(gain(a)>0 && gain(b)>0);
    s.couperRaclements();assert.equal(gain(a)+gain(b),0,'onglet masqué');
    j.raclement=null; e.joueur2=null; s.mettreAJour(e);assert.equal(gain(a)+gain(b),0,'sortie de contact et du duo');
  } finally { delete globalThis.window; }
});

verifier('attribution stable puis fondu complet avant de réutiliser une voix rivale', function () {
  const fa = fauxAudio(); globalThis.window = { AudioContext: fa.Ctx };
  try {
    const s = B.son.creer(); s.demarrer();
    const etat = { joueur: { id: 0, regime: 9000, gaz: .8 }, rivaux: [1, 2, 3].map(id => ({ id, distance: id * 5, regime: 6000 + id * 100, gaz: .5 })) };
    s.mettreAJour(etat);
    const affectations = () => fa.oscillateurs.reduce((n, o) => n + o.frequency.valeurs.length, 0);
    const avant = affectations(); etat.rivaux.reverse(); s.mettreAJour(etat);
    assert.equal(affectations(), avant, 'changer l’ordre des rivaux ne réaffecte pas les voix');
    etat.rivaux = [4, 5, 6].map(id => ({ id, distance: id, regime: 6500, gaz: .5 }));
    s.mettreAJour(etat);
    assert.equal(s.stats().fondus, 3); assert.equal(s.stats().rivaux, 0);
    fa.contextes[0].currentTime += .1; s.mettreAJour(etat);
    assert.equal(affectations(), avant, 'fréquence inchangée tant que l’ancienne voix décroît');
    fa.contextes[0].currentTime += .03; s.mettreAJour(etat);
    assert.equal(affectations(), avant + 3); assert.equal(s.stats().fondus, 0); assert.equal(s.stats().rivaux, 3);
    assert.ok(s.stats().voix <= s.stats().budget);
  } finally { delete globalThis.window; }
});

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

// David, 12/11/2026 : « pas de musique sauf à l'écran titre ». Ces signaux de course restent inchangés.
// Le 20/11, il demande explicitement un bref klaxon mariage, testé séparément des signaux historiques.
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

// ---------------------------------------------------------------- claquements d'échappement (lot 20)
// File comme celle de src/echappement.js : circulaire, n événements écrits, horloge de la course au dernier pas.
function fileEch(evenements, horloge) {
  const F = { n: 0, taille: 64, horloge, liste: Array.from({ length: 64 }, () => ({})) };
  F.ajouter = (e, h) => { Object.assign(F.liste[F.n % F.taille], { voiture: 1, genre: 'detonation', t: F.horloge, force: 1, variante: 0, hauteur: 1 }, e); F.n++; if (h !== undefined) F.horloge = h; };
  for (const e of evenements) F.ajouter(e);
  return F;
}
const ecouteEch = (n = 12) => ({ dedans: new Uint8Array(n), distance: new Float64Array(n).fill(10), angle: new Float64Array(n) });
// voix d'une source jouée : la source se branche sur le passe-bas, puis gain, puis panoramique
const voixDe = s => { const pb = s.suite, g = pb.suite, pan = g.suite; return { pb, g, pan, gain: g.gain.valeurs.at(-1).v, frequence: pb.frequency.valeurs.at(-1).v, pan: pan.pan.valeurs.at(-1).v }; };
function avecSon(f) {
  const fa = fauxAudio(); globalThis.window = { AudioContext: fa.Ctx };
  try { const son = B.son.creer(); son.demarrer(); f(son, fa, fa.contextes[0]); } finally { delete globalThis.window; }
}

// ---------------------------------------------------------------- klaxons procéduraux du Troll
verifier('klaxons : trois timbres déterministes, brefs, bornés et silencieux aux extrémités', () => {
  const S = B.son, vrai = Math.random;
  Math.random = () => { throw new Error('hasard global audio interdit'); };
  try {
    assert.deepEqual(S.KLAXONS, ['classique', 'ancien', 'mariage']);
    for (const sr of [8000, 48000]) {
      const a = S.synthKlaxons(sr), b = S.synthKlaxons(sr);
      for (const type of S.KLAXONS) {
        const d = a[type]; let pic = 0, energie = 0;
        assert.equal(d.length, Math.ceil(S.DUREES_KLAXON[type] * sr));
        assert.ok(d.length / sr <= .96 && d.length / sr > .1, 'appel bref');
        assert.deepEqual(d, b[type]); assert.equal(d[0], 0); assert.equal(d.at(-1), 0);
        for (const x of d) { assert.ok(Number.isFinite(x)); pic = Math.max(pic, Math.abs(x)); energie += x * x; }
        assert.ok(pic > .5 && pic <= .85 + 1e-6); assert.ok(energie / d.length > .01, 'tampon audible');
      }
      assert.notDeepEqual(a.classique.slice(0, 800), a.ancien.slice(0, 800));
      assert.notDeepEqual(a.classique.slice(0, 800), a.mariage.slice(0, 800));
    }
    for (const sr of [0, NaN, 44100.5, 192001]) assert.throws(() => S.synthKlaxons(sr), /invalide/);
    assert.equal(S.normaliserKlaxon('ancien'), 'ancien'); assert.equal(S.normaliserKlaxon(2), 'mariage');
    for (const type of [null, 'inconnu', -1, 9]) assert.equal(S.normaliserKlaxon(type), 'classique');
  } finally { Math.random = vrai; }
});

function amplitudeKlaxon(d, sr, f, debut, fin) {
  const premier = Math.ceil(debut * sr), n = Math.floor(fin * sr) - premier;
  let re = 0, im = 0, poids = 0;
  for (let i = 0; i < n; i++) {
    const w = .5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)), p = 2 * Math.PI * f * (i + premier) / sr;
    re += d[i + premier] * w * Math.cos(p); im += d[i + premier] * w * Math.sin(p); poids += w;
  }
  return 2 * Math.hypot(re, im) / poids;
}

verifier('klaxon classique : deux trompes stables avec des harmoniques paires, pas deux bips purs', () => {
  const sr = 48000, d = B.son.synthKlaxons(sr).classique;
  for (const f of [400, 500]) {
    const fondamentale = amplitudeKlaxon(d, sr, f, .08, .32);
    assert(fondamentale > .06, 'la fondamentale de chaque trompe reste présente');
    assert(amplitudeKlaxon(d, sr, 2 * f, .08, .32) > fondamentale * .8, 'la membrane porte aussi le deuxième harmonique');
    assert(amplitudeKlaxon(d, sr, 3 * f, .08, .32) > fondamentale * .5, 'le pavillon conserve son mordant médium');
  }
});

verifier('klaxon aigu à 8 kHz : les harmoniques hors bande ne se replient pas dans le son', () => {
  const sr = 8000, f = 783.99, d = B.son.synthKlaxons(sr).mariage;
  const fondamentale = amplitudeKlaxon(d, sr, f, .62, .86);
  assert(fondamentale > .1);
  assert(amplitudeKlaxon(d, sr, sr - 6 * f, .62, .86) < fondamentale * .01, 'pas de sixième harmonique replié');
});

verifier('Troll sonore : cinq voix préparées, une source par départ et aucun thème musical', () => {
  const fa = fauxAudio(); globalThis.window = { AudioContext: fa.Ctx };
  try {
    const son = B.son.creer();
    assert.equal(son.klaxon('ancien'), false); assert.equal(fa.contextes.length, 0, 'aucun déblocage implicite');
    son.demarrer(); const ctx = fa.contextes[0], src = fa.sources.length, noeuds = fa.compte().noeuds;
    const tampons = new Set(fa.tampons), osc = fa.oscillateurs.length;
    assert.equal(son.stats().klaxons.budget, 5, 'quatre humains et une IA');
    for (let i = 0; i < 5; i++) assert.equal(son.evenement('troll', { klaxon: B.son.KLAXONS[i % 3], gain: .5, pan: i - 2 }), true);
    assert.equal(fa.sources.length - src, 5); assert.equal(fa.compte().noeuds - noeuds, 5, 'seules les sources sont créées');
    assert.equal(fa.oscillateurs.length, osc); assert.equal(son.stats().musique, false);
    assert.equal(son.klaxon('classique'), false, 'budget fixe sans croissance');
    assert.equal(son.stats().klaxons.actives, 5); assert.equal(son.stats().klaxons.joues, 5);
    fa.sources.slice(src).forEach(s => {
      assert.ok(tampons.has(s.buffer)); assert.equal(s.loop, false); assert.equal(s.debut, ctx.currentTime);
      assert.ok(s.fin > s.debut && s.fin - s.debut <= .965 + 1e-9);
      assert.equal(s.suite.gain.valeurs.at(-1).v, B.son.NIVEAU_KLAXON * .5);
      assert.ok(Math.abs(s.suite.suite.pan.valeurs.at(-1).v) <= 1);
    });
    const ancien = fa.sources[src]; ctx.currentTime += 1;
    assert.equal(son.klaxon('ancien'), true); assert.equal(son.stats().klaxons.actives, 1);
    ancien.onended(); assert.equal(son.stats().klaxons.actives, 1, 'fin ancienne sans effet sur la voix réutilisée');
  } finally { delete globalThis.window; }
});

verifier('klaxons : silence, contexte suspendu et pause sans son mis en attente', () => {
  avecSon((son, fa, ctx) => {
    const debut = fa.sources.length;
    son.regler({ general: 0 }); assert.equal(son.klaxon(), false);
    son.regler({ general: 1, effets: 0 }); assert.equal(son.klaxon(), false);
    son.regler({ effets: 1 });
    for (const state of ['suspended', 'interrupted', 'closed']) { ctx.state = state; assert.equal(son.klaxon(), false); }
    ctx.state = 'running';
    for (const gain of [0, -1, NaN]) assert.equal(son.klaxon('mariage', { gain }), false);
    assert.equal(fa.sources.length, debut, 'aucune source à rattraper');
    assert.equal(son.klaxon('mariage', { gain: 4, pan: Infinity }), true);
    const s = fa.sources.at(-1); assert.equal(s.suite.gain.valeurs.at(-1).v, B.son.NIVEAU_KLAXON);
    assert.equal(s.suite.suite.pan.valeurs.at(-1).v, 0);
    son.suspendre(); assert.ok(s.fin <= ctx.currentTime + .015 + 1e-9, 'arrêt bref en pause');
    ctx.currentTime += 1; son.reprendre(); assert.equal(son.stats().klaxons.actives, 0);
    assert.equal(fa.sources.length, debut + 1, 'la reprise ne rejoue rien');
    son.suspendre(); assert.equal(son.klaxon('ancien'), true, 'préécoute explicite autorisée au menu');
  });
});

verifier('un contexte suspendu pendant un klaxon libère immédiatement sa voix sans fin différée', () => {
  avecSon((son, fa, ctx) => {
    for (const state of ['suspended', 'interrupted']) {
      assert.equal(son.klaxon('mariage'), true);
      const source = fa.sources.at(-1); ctx.currentTime += .1;
      ctx.state = state; ctx.onstatechange();
      assert.equal(source.debranche, true, 'source physiquement détachée');
      assert.equal(source.fin, ctx.currentTime, 'aucune durée en attente sur l’horloge gelée');
      assert.equal(son.stats().klaxons.actives, 0);
      son.suspendre(); son.reprendre();
      ctx.state = 'running'; ctx.onstatechange();
      assert.equal(son.stats().klaxons.actives, 0, 'aucune ancienne voix au réveil');
    }
    assert.equal(son.klaxon('ancien'), true);
    const source = fa.sources.at(-1); ctx.state = 'suspended';
    // La pause protège aussi le cas où le callback du navigateur n'a pas encore été livré.
    son.suspendre(); assert.equal(source.debranche, true); assert.equal(son.stats().klaxons.actives, 0);
    ctx.state = 'running'; son.reprendre();
    assert.equal(son.stats().klaxons.actives, 0);
  });
});

verifier('préécoute vers course : aucune voix du menu ne prive les humains de leur Troll', () => {
  avecSon((son, fa, ctx) => {
    son.suspendre();
    const debut = fa.sources.length;
    for (let i = 0; i < 5; i++) assert.equal(son.klaxon('mariage'), true, 'préécoutes explicites acceptées en pause');
    const apercus = fa.sources.slice(debut), noeuds = fa.compte().noeuds;
    assert.equal(son.stats().klaxons.actives, 5);
    ctx.currentTime += .1;
    son.reprendre();
    assert.equal(son.stats().klaxons.actives, 0, 'aucune préécoute ne continue au départ');
    for (const s of apercus) {
      assert.equal(s.debranche, true, 'préécoute détachée du graphe');
      assert.equal(s.fin, ctx.currentTime, 'arrêt immédiat au départ, sans attendre sa fin naturelle');
    }
    assert.equal(fa.compte().noeuds, noeuds, 'la reprise ne crée aucun nœud');
    for (let i = 0; i < 4; i++) assert.equal(son.evenement('troll', { klaxon: 'ancien' }), true, 'chaque humain garde une voix');
    assert.equal(son.evenement('troll', { klaxon: 'mariage' }), true, 'la cinquième voix suffit à l’IA');
    assert.equal(son.stats().klaxons.actives, 5);
    assert.equal(fa.compte().noeuds - noeuds, 5, 'seules les cinq sources du nouveau départ sont créées');
    son.reprendre();
    assert.equal(son.stats().klaxons.actives, 5, 'reprendre une course déjà active ne coupe pas ses gestes');
    for (const s of apercus) s.onended();
    assert.equal(son.stats().klaxons.actives, 5, 'les callbacks des préécoutes ne libèrent pas les voix réattribuées');
    assert.equal(son.klaxon('classique'), false, 'le budget reste borné à cinq voix');
  });
});

verifier('Troll : les deux vrais modules lancent un son par geste accepté, jamais par demande ni par vue', () => {
  charger('expressions-pilote.js');
  const X = B.expressionsPilote;
  assert.deepEqual(X.KLAXONS, B.son.KLAXONS, 'même catalogue de timbres');
  avecSon((son, fa, ctx) => {
    const co = { phase: 'course', termine: false, voitures: [0, 1].map(id => ({ id, joueur: true,
      progression: 100, etat: { v: 30, rapport: 2 } })) };
    const poses = [{ x: 100, y: 0, z: 0, cap: 0 }, { x: 100, y: 0, z: 3, cap: 0 }];
    const E = X.creer(2, 17), depart = fa.sources.length, sortie = {};
    const e = { sequence: 0, pilote: -1, geste: null, klaxon: null, instant: 0, cote: 0 };
    X.configurer(E, 0, { geste: 'salut', klaxon: 'ancien' });
    X.configurer(E, 1, { geste: 'poing', klaxon: 'mariage' });
    X.actualiser(E, co, poses, 0);
    const consommer = () => {
      while (X.consommerEvenement(E, e)) {
        assert.equal(e.geste, X.lire(E, e.pilote).geste); assert.equal(e.instant, ctx.currentTime);
        assert.equal(son.evenement('troll', e), true);
        const source = fa.sources.at(-1);
        assert.equal(source.debut, ctx.currentTime);
        assert.equal(source.buffer.getChannelData(0).length, Math.ceil(B.son.DUREES_KLAXON[e.klaxon] * ctx.sampleRate));
      }
    };
    X.demander(E, 0, true); X.demander(E, 1, true); consommer();
    assert.equal(fa.sources.length, depart, 'une demande ne klaxonne jamais');
    co.voitures[0].etat.rapport = 3;
    ctx.currentTime = .01; X.actualiser(E, co, poses, .01); consommer();
    assert.equal(X.lire(E, 0).geste, null, 'J1 attend son rapport');
    assert.equal(X.lire(E, 1).geste, 'poing'); assert.equal(fa.sources.length, depart + 1);
    for (const id of [1, 0, 1, 0]) X.lire(E, id, sortie); consommer();
    assert.equal(fa.sources.length, depart + 1, 'J2/J1 et leurs miroirs restent des lectures');
    ctx.currentTime = .38; X.actualiser(E, co, poses, .38); consommer();
    assert.equal(X.lire(E, 0).geste, 'salut'); assert.equal(fa.sources.length, depart + 2);
    X.actualiser(E, co, poses, .38); consommer();
    assert.equal(fa.sources.length, depart + 2, 'même instant et bouton tenu ne redémarrent rien');
  });
});

verifier('échappement : tampons et voix préparés au démarrage ; ensuite une source par claquement joué, rien d’autre', () => {
  avecSon((son, fa, ctx) => {
    const st = son.stats().echappement, prets = new Set(fa.tampons), avant = fa.compte().noeuds, osc = fa.oscillateurs.length, src = fa.sources.length;
    assert.equal(st.voix, B.son.ECH_VOIX); assert.equal(st.budget, 6);
    assert.ok(fa.tampons.length >= 1 + 4 + 6 + 3, 'bruit, puis 4 détonations, 6 crépitements, 3 ratés');
    const F = fileEch([{ genre: 'detonation' }, { genre: 'crepitement', voiture: 2, variante: 5 }, { genre: 'rate', voiture: 3, variante: 4 }], 10);
    son.echappement(F, ecouteEch());
    const nouvelles = fa.sources.slice(src);
    assert.equal(nouvelles.length, 3); assert.equal(son.stats().echappement.joues, 3);
    assert.equal(fa.compte().noeuds - avant, 3, 'trois sources, aucun autre nœud');
    assert.equal(fa.oscillateurs.length, osc, 'aucun oscillateur : aucune hauteur jouée');
    for (const s of nouvelles) {
      assert.ok(prets.has(s.buffer), 'tampon préparé au démarrage');
      assert.ok(s.suite && s.suite.rang < avant, 'branchée sur une voix préparée');
      assert.ok(s.debut >= ctx.currentTime, 'jamais dans le passé');
    }
    for (let i = 0; i < 60; i++) { ctx.currentTime += 1 / 60; son.echappement(F, ecouteEch()); son.mettreAJour({ joueur: { regime: 9000, gaz: 1 }, rivaux: [] }); }
    assert.equal(fa.compte().noeuds - avant, 3, 'relire la file ne rejoue rien');
  });
});

verifier('échappement : six voix et six départs par image au plus ; la plus faible cède la place au plus fort', () => {
  avecSon((son, fa, ctx) => {
    const F = fileEch([], 5), ec = ecouteEch();
    for (let i = 0; i < 20; i++) F.ajouter({ genre: 'crepitement', voiture: i % 12, force: .3, t: 5 - .001 * i });
    const src = fa.sources.length;
    son.echappement(F, ec);
    assert.equal(fa.sources.length - src, 6, 'six départs');
    assert.equal(son.stats().echappement.actives, 6); assert.equal(son.stats().echappement.ignores, 14);
    // une détonation forte, toute proche : elle prend la voix la plus faible ; un crépitement faible lointain est ignoré
    ctx.currentTime += .01; ec.distance[4] = 0; ec.distance[5] = 200;
    F.ajouter({ genre: 'detonation', voiture: 4, force: 1 }); F.ajouter({ genre: 'crepitement', voiture: 5, force: .2 });
    son.echappement(F, ec);
    assert.equal(fa.sources.length - src, 7, 'la détonation passe, le crépitement lointain non');
    assert.ok(son.stats().echappement.actives <= 6);
    // les voix se libèrent quand leur son est fini
    ctx.currentTime += 1; son.echappement(F, ec);
    assert.equal(son.stats().echappement.actives, 0);
  });
});

verifier('échappement : proche plus fort et plus clair que lointain, placé par l’angle ; du cockpit, étouffé et au centre', () => {
  avecSon((son, fa, ctx) => {
    const F = fileEch([], 3), ec = ecouteEch();
    ec.distance[1] = 5; ec.angle[1] = Math.PI / 2; ec.distance[2] = 80; ec.angle[2] = -Math.PI / 2; ec.dedans[0] = 1;
    F.ajouter({ voiture: 1 }); F.ajouter({ voiture: 2 }); F.ajouter({ voiture: 0 });
    const src = fa.sources.length;
    son.echappement(F, ec);
    const [pres, loin, cockpit] = fa.sources.slice(src).map(voixDe);
    assert.ok(pres.gain > 4 * loin.gain, `gain ${pres.gain.toFixed(3)} contre ${loin.gain.toFixed(4)}`);
    assert.ok(pres.frequence > 2 * loin.frequence, 'l’air mange les aigus');
    assert.ok(pres.pan > .8 && loin.pan < -.8, 'à droite, puis à gauche');
    assert.equal(cockpit.pan, 0); assert.equal(cockpit.frequence, 2600);
    assert.ok(Math.abs(cockpit.gain - B.son.NIVEAU_ECH.detonation * .7) < 1e-9, 'étouffé par la caisse');
  });
});

verifier('échappement : niveaux bornés, écarts de la course gardés, rien en pause, la file qui déborde ne joue que le récent', () => {
  avecSon((son, fa, ctx) => {
    const F = fileEch([], 20), ec = ecouteEch();
    ec.dedans.fill(1);
    for (const genre of ['detonation', 'crepitement', 'rate']) F.ajouter({ genre, force: 5 });
    let src = fa.sources.length;
    son.echappement(F, ec);
    for (const s of fa.sources.slice(src)) assert.ok(voixDe(s).gain <= .42 * 1.2 * .7 + 1e-9, 'pas de claquement assourdissant');
    // deux claquements d'une même image, à 15 ms d'écart dans la course : 15 ms d'écart à l'oreille
    ctx.currentTime += 1; ec.dedans.fill(0);
    F.ajouter({ t: 20.98 }); F.ajouter({ t: 20.995 }, 21);
    src = fa.sources.length;
    son.echappement(F, ec);
    const [a, b] = fa.sources.slice(src);
    assert.ok(Math.abs(b.debut - a.debut - .015) < 1e-9 && a.debut >= ctx.currentTime, 'écart gardé, rien dans le passé');
    // trop vieux (image très lente) : ignoré
    ctx.currentTime += 1; F.ajouter({ t: 20 }, 22); src = fa.sources.length; son.echappement(F, ec);
    assert.equal(fa.sources.length, src, 'pas de rattrapage');
    // pause : rien ne part, les voix sont coupées en fondu
    son.suspendre(); F.ajouter({ t: 22 }); son.echappement(F, ec);
    assert.equal(fa.sources.length, src);
    son.reprendre();
    // la file déborde (cent claquements entre deux images) : seuls les plus récents comptent, sans erreur
    ctx.currentTime += 1;
    for (let i = 0; i < 100; i++) F.ajouter({ t: 23 + i * .001, voiture: i % 12 }, 23.1);
    const ign = son.stats().echappement.ignores;
    son.echappement(F, ec);
    assert.equal(fa.sources.length - src, 6);
    assert.equal(son.stats().echappement.ignores - ign, 64 - 6, 'les 36 plus anciens sont sortis de la file');
  });
});

verifier('échappement : quand la file mène, passage et rupteur ne doublent plus le claquement', () => {
  avecSon((son, fa, ctx) => {
    let src = fa.sources.length;
    son.evenement('rapport', { haut: true });
    assert.equal(fa.sources.length - src, 1, 'sans le module : la détonation d’avant');
    son.echappement(fileEch([], 1), ecouteEch());
    src = fa.sources.length;
    son.evenement('rapport', { haut: true }); son.evenement('rupteur');
    assert.equal(fa.sources.length, src, 'avec le module : la coupure du moteur seule');
    ctx.currentTime += .6;
    son.evenement('rupteur');
    assert.equal(fa.sources.length - src, 1, 'module muet depuis 0,6 s : retour à l’ancien claquement');
  });
});

verifier('tampons de claquements : identiques à chaque démarrage, sans Math.random, brefs, crêtes bornées, qui s’éteignent', () => {
  const vrai = Math.random;
  let appels = 0;
  Math.random = () => { appels++; return vrai(); };
  let a, b;
  try { a = B.son.synthEchappement(48000); b = B.son.synthEchappement(48000); } finally { Math.random = vrai; }
  assert.equal(appels, 0);
  for (const [genre, n, duree] of [['detonation', 4, .17], ['crepitement', 6, .07], ['rate', 3, .13]]) {
    assert.equal(a[genre].length, n);
    a[genre].forEach((d, i) => {
      assert.ok(Math.abs(d.length / 48000 - duree) < 1e-3, genre + ' bref');
      assert.deepEqual(d, b[genre][i], genre + ' identique');
      let crete = 0, debut = 0, fin = 0;
      d.forEach((v, j) => { assert.ok(Number.isFinite(v)); crete = Math.max(crete, Math.abs(v)); if (j < d.length / 5) debut += v * v; if (j >= d.length * .8) fin += v * v; });
      assert.ok(crete > .5 && crete <= .95 + 1e-6, genre + ' crête ' + crete);
      assert.ok(debut > 10 * fin, genre + ' ' + i + ' s’éteint');
    });
    assert.notDeepEqual(a[genre][0], a[genre][1], genre + ' : variantes distinctes');
  }
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
