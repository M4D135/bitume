#!/usr/bin/env node
// Preuve logique/temporelle du HTML exact. Aucun navigateur ni rendu WebGL n'est simulé.
// Les modules, commandes clavier et raccords viennent des scripts embarqués ; seuls les
// événements du DOM, Web Audio, l'état de course et l'horloge sont des dispositifs d'essai.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SHA = b => createHash('sha256').update(b).digest('hex');
const COPIE = x => JSON.parse(JSON.stringify(x));
const DT = 1 / 120;
const CHOIX = Object.freeze([{ geste: 'salut', klaxon: 'ancien' }, { geste: 'poing', klaxon: 'mariage' }]);
const MODULES = Object.freeze(['carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js',
  'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js',
  'voiture.js', 'expressions-pilote.js', 'son.js', 'menu-arcade.js', 'autoconfig.js', 'commandes-manette.js']);
const LIMITES = Object.freeze([
  'Modules et raccords extraits du HTML identifié, sans exécution de la page complète.',
  'Événements DOM, état de course, horloge et API Web Audio simulés ; aucun appui matériel ni audio entendu.',
  'Vraies géométries et poses procédurales, sans rasterisation, shaders, inspection WebGL ni contrôle visuel du naturel.',
  'Aucun essai PhysX, réseau entre machines, allocation en navigateur ou performance matérielle.',
  'Cette preuve complète les captures du candidat ; elle ne clôt pas la validation visuelle du jeu assemblé.'
]);

export function optionsTrollAssemble(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!['--html', '--sortie'].includes(k) || o[k.slice(2)] || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw new Error('Usage : --html candidat.html --sortie rapport.json (options uniques)');
    o[k.slice(2)] = path.resolve(argv[i + 1]);
  }
  if (!o.html || !o.sortie) throw new Error('--html et --sortie nécessaires');
  if (o.html === o.sortie) throw new Error('Le rapport ne doit pas écraser le HTML');
  return o;
}

export function modulesDuHtml(html) {
  const modules = new Map();
  for (const m of String(html).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const marque = m[1].match(/^\s*\/\/ ---- ([a-zA-Z0-9_./-]+\.js) ----\r?\n/);
    if (!marque) continue;
    if (modules.has(marque[1])) throw new Error('Module embarqué dupliqué : ' + marque[1]);
    modules.set(marque[1], m[1].slice(marque[0].length));
  }
  for (const nom of [...MODULES, 'jeu.js']) if (!modules.has(nom)) throw new Error('Module embarqué absent : ' + nom);
  return modules;
}

// Les fonctions concernées sont des déclarations de premier niveau indentées de deux espaces.
// Échec explicite si leur délimitation change ; aucun repli sur les sources du checkout.
function fonction(source, nom) {
  const debut = source.indexOf('  function ' + nom + '(');
  assert(debut >= 0, 'raccord embarqué absent : ' + nom);
  const ligne = source.indexOf('\n', debut), uneLigne = source.slice(debut, ligne);
  const fin = /\}\s*$/.test(uneLigne) ? ligne : source.indexOf('\n  }', debut) + 4;
  assert(fin > debut, 'fin de raccord embarqué absente : ' + nom);
  const extrait = source.slice(debut, fin);
  assert(!extrait.slice(extrait.indexOf('{') + 1).includes('\n  function '), 'délimitation de raccord ambiguë : ' + nom);
  return extrait;
}

function plage(source, debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a + debut.length);
  assert(a >= 0 && b > a, 'bloc embarqué absent : ' + debut);
  return source.slice(a, b);
}

// Même interface minimale que son.test.mjs ; chaque source retient ses vrais tampon,
// départ et arrêt demandés par son.js. Aucun substitut de klaxon ou de synthèse.
function audioSimule() {
  const contextes = [], sources = [];
  const param = (value = 0) => ({ value, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; },
    linearRampToValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { assert(v > 0); this.value = v; }, cancelScheduledValues() {} });
  const noeud = extra => Object.assign({ connect(n) { this.suite = n; return n; }, disconnect() { this.debranche = true; } }, extra);
  const source = extra => {
    const s = noeud({ debut: null, fin: Infinity, terminee: false, ...extra,
      start(t) { assert.equal(this.debut, null, 'une source Web Audio ne démarre qu’une fois'); this.debut = t; },
      stop(t) { this.fin = t; } });
    sources.push(s); return s;
  };
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.destination = noeud({}); contextes.push(this); }
    resume() { this.state = 'running'; }
    createGain() { return noeud({ gain: param(1) }); }
    createOscillator() { return source({ type: 'sine', frequency: param(440), detune: param(), setPeriodicWave(w) { this.onde = w; } }); }
    createPeriodicWave(re, im) { return { re, im }; }
    createDelay() { return noeud({ delayTime: param() }); }
    createBiquadFilter() { return noeud({ frequency: param(350), Q: param(1), gain: param() }); }
    createWaveShaper() { return noeud({ curve: null }); }
    createDynamicsCompressor() { return noeud(Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(k => [k, param()]))); }
    createStereoPanner() { return noeud({ pan: param() }); }
    createBuffer(canaux, longueur, frequence) {
      const donnees = Array.from({ length: canaux }, () => new Float32Array(longueur));
      return { length: longueur, sampleRate: frequence, duration: longueur / frequence, getChannelData: i => donnees[i] };
    }
    createBufferSource() { return source({ buffer: null, loop: false, playbackRate: param(1) }); }
  }
  return { Ctx, sources, avancer(t) {
    for (const c of contextes) c.currentTime = t;
    for (const s of sources) if (!s.terminee && s.fin <= t) { s.terminee = true; if (s.onended) s.onended(); }
  }, klaxons: () => sources.filter(s => s.buffer && !s.loop && s.debut !== null) };
}

function creerFabrique(modules) {
  const contexte = vm.createContext({ console, performance: { now: () => 10000 },
    navigator: { userAgent: 'Qualification du HTML BITUME', platform: '', maxTouchPoints: 0 } });
  for (const nom of MODULES) vm.runInContext(modules.get(nom), contexte, { filename: 'HTML/' + nom, timeout: 30000 });
  const source = modules.get('jeu.js');
  const declarations = plage(source, '  const touches =', '  // conduite par position physique');
  const ecouteurs = plage(source, "  addEventListener('keydown',", '  // Souris');
  const debutImage = plage(source, '  function rendreImage(S, alpha, dtImage)', '    if (B.sillage)') + '\n  }';
  const creation = source.match(/^\s+expressions: (.+),$/m)?.[1];
  const sortieEvenement = source.match(/^\s+trollEvenement: (\{.+\}),$/m)?.[1];
  const sortieAudio = source.match(/^\s+trollAudio: (\{.+\}),$/m)?.[1];
  const initLocaux = source.match(/    S\.locaux = [^\n]+\n    if \(joue && S\.expressions\) configurerTrollLocaux\(S\);/)?.[0];
  assert(creation && sortieEvenement && sortieAudio && initLocaux, 'création/configuration du raccord absente du HTML');
  const maths = ['DT', 'clamp', 'lerp', 'angle'].map(nom => {
    const ligne = source.match(new RegExp('^  const ' + nom + ' = [^\\n]+', 'm'))?.[0]; assert(ligne); return ligne;
  }).join('\n');
  const remplirPilote = plage(source, '      const pilote = ev.pilote, voiture = co.voitures[k], etatPilote = voiture.etat;', '      // Hystérésis');
  const fabriquer = vm.runInContext(`(function(course, reglages, son, audio) {
    let session = null, ecran = 'course', dernierGeste = 0, sonActif = false, muet = false;
    const B = BITUME, graineCourse = 19, joue = true;
    const enCourse = () => ecran === 'course', voixVirages = { annuler() {} };
    const changerVue = () => {}, changerVue2 = () => {}, retour = () => {}, couperSon = () => {};
    const basculerPause = () => { ecran = ecran === 'course' ? 'pause' : 'course'; }, sortirDemo = () => { ecran = 'titre'; };
    const ecouteurs = new Map(), addEventListener = (type, fn) => {
      if (!ecouteurs.has(type)) ecouteurs.set(type, []); ecouteurs.get(type).push(fn);
    };
    ${maths}
    ${declarations}
    ${ecouteurs}
    ${['choixTrollLocaux', 'activerSon', 'appliquerVolumes', 'consommerTroll', 'melange'].map(n => fonction(source, n)).join('\n')}
    const S = session = { type: 'duo', course, expressions: ${creation}, trollEvenement: ${sortieEvenement}, trollAudio: ${sortieAudio} };
    ${initLocaux}
    const poses = course.voitures.map(v => ({ x: v.progression, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, rebond: [0,0,0,0] }));
    S.prec = poses.map(p => ({ ...p })); S.cour = poses.map(p => ({ ...p }));
    const tampons = { poses: poses.map(p => ({ ...p })) }, appliquerCarte = () => {};
    const creationTardive = () => { throw Error('Allocation tardive inattendue dans le raccord'); };
    ${debutImage}
    return { S, reglages, son,
      event(type, code, repeat = false) { for (const fn of ecouteurs.get(type) || []) fn({ code, key: code === 'KeyG' ? 'g' : '.', repeat, preventDefault() {} }); },
      image(t) { audio.avancer(t); course.horloge = t; rendreImage(S, 1, DT); },
      pose(k) {
        const co = S.course, ev = { p:[0,0,0], cap:0, tangage:0, roulis:0, braquage:0, roule:0, v:co.voitures[k].etat.v, pilote:{} };
        ${remplirPilote}
        return ev;
      }
    };
  })`, contexte, { filename: 'HTML/jeu.js:raccords', timeout: 30000 });
  return locaux => {
    const audio = audioSimule(); contexte.window = { AudioContext: audio.Ctx };
    const B = contexte.BITUME, co = { phase: 'course', termine: false, horloge: 10,
      voitures: Array.from({ length: Math.max(8, ...locaux.map(n => n + 1)) }, (_, id) => ({ id,
        joueur: locaux.includes(id), humain: locaux.includes(id), progression: 100 + id * 50, rapportAvant: 3, tPassage: -100,
        etat: { v: 0, rapport: 3, regime: 9000, volant: 0, alat: 0, along: 0, repositionnements: 0 } })) };
    co.joueur = co.voitures[locaux[0]];
    Object.defineProperty(co, 'rng', { get() { throw Error('Le raccord consulte le hasard de conduite'); } });
    const reglages = { commandes: ['clavier', 'clavier'], trollPilotes: COPIE(CHOIX), general: .8, moteur: 0, effets: 1 };
    const api = fabriquer(co, reglages, B.son.creer(), audio);
    const modeles = new Map(locaux.map(id => [id, B.voiture.modele({ couleur: [.7, .15, .1], combinaison: [.8, .7, .6], numero: id + 1 })]));
    return { ...api, B, co, audio, modeles,
      appui(code, repeat = false) { api.event('keydown', code, repeat); if (!repeat) api.event('keyup', code); },
      choix(id) { return COPIE(B.expressionsPilote.lire(api.S.expressions, id)); },
      sons() { return api.son.stats().klaxons.joues; }
    };
  };
}

const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
function instantane(H) {
  return { articulations: Array.from(H.articulations), mains: H.mains.map(m => m.pieces.map(p =>
    [p.objet.shape, Array.from(p.o), Array.from(p.objet.s), Array.from(p.rep.m)])) };
}
function poserToutesVues(b, id, compter) {
  const V = b.B.voiture, m = b.modeles.get(id), ev = b.pose(id);
  V.poser(m, ev, [], { detail: 'complet' }); compter.n++;
  const H = m.objetsRendu.habitacle, original = instantane(H), cle = JSON.stringify(original);
  for (const detail of ['moyen', 'simple']) {
    V.poser(m, ev, [], { detail }); compter.n++;
    assert.equal(JSON.stringify(instantane(H)), cle, 'pose locale différente selon LOD');
  }
  V.cockpit(m, ev, [], { ...ev.pilote, regime: 9000, kmh: 0 }); compter.n++;
  assert.equal(JSON.stringify(instantane(H)), cle, 'pose locale cockpit différente');
  V.poserRetro(m, ev, []); compter.n++;
  assert.equal(JSON.stringify(instantane(H)), cle, 'pose locale rétroviseur différente');
  assert.equal(original.articulations.length, 18); assert(original.articulations.every(Number.isFinite));
  for (const j of [0, 9]) {
    assert(Math.abs(distance(original.articulations.slice(j, j + 3), original.articulations.slice(j + 3, j + 6)) - .27) < 1e-10, 'longueur humérus');
    assert(Math.abs(distance(original.articulations.slice(j + 3, j + 6), original.articulations.slice(j + 6, j + 9)) - .29) < 1e-10, 'longueur avant-bras');
  }
  return original;
}

function verifierDepart(b, ids, attendu) {
  assert.equal(b.sons(), attendu, 'exactement une source audio par départ accepté');
  assert.equal(b.audio.klaxons().length, attendu, 'nombre réel de BufferSource démarrées');
  const E = b.S.expressions;
  assert.equal(E.evenementsLu, E.evenementsN, 'file entièrement consommée avant les vues');
  for (const id of ids) {
    const n = b.S.locaux.indexOf(id), p = E.pilotes[id], e = p.evenement;
    assert.equal(e.geste, CHOIX[n].geste, 'choix du geste conservé par place locale');
    assert.equal(e.klaxon, CHOIX[n].klaxon, 'choix du klaxon conservé par place locale');
    assert.equal(e.temps, p.gesteA, 'même instant pour son et geste');
    assert.equal(e.temps, E.temps); assert.equal(p.evenementPret, false);
  }
}

function temporel(fabriquer, locaux) {
  const b = fabriquer(locaux), poses = { n: 0 }; b.image(10);
  const neutres = locaux.map(id => poserToutesVues(b, id, poses));
  b.appui('KeyG'); b.appui('NumpadDecimal');
  assert.equal(b.sons(), 0, 'aucun klaxon avant le démarrage effectif');
  for (const id of locaux) assert.equal(b.choix(id).geste, null);
  const debut = 10 + DT; b.image(debut); verifierDepart(b, locaux, 2);
  for (const [n, duree] of [.56, .96].entries())
    assert(Math.abs(b.audio.klaxons()[n].buffer.length / 48000 - duree) <= 1 / 48000 + 1e-12,
      'durée du vrai tampon ancien/mariage, à un échantillon près');
  for (const s of b.audio.klaxons()) assert.equal(s.debut, debut, 'source programmée dans le même pas que le geste');
  const etapes = new Set([0, .12, .36, .8, 1.24, 1.44, 1.64, 1.84, 2.1].map(t => Math.round(t * 120)));
  const mesures = [], phases = [-1, -1], amplitudes = [0, 0];
  for (let pas = 0; pas <= 252; pas++) {
    const age = pas * DT; b.image(debut + age);
    const observation = [];
    // Même ordre que le jeu : J2, puis J1. Plusieurs poses ne doivent consommer aucun événement.
    for (const n of [1, 0]) {
      const id = locaux[n], e = b.choix(id), duree = n === 0 ? 1.8 : 1.4;
      const rendu = poserToutesVues(b, id, poses), a = rendu.articulations, initial = neutres[n];
      if (age < duree - 1e-9) {
        assert.equal(e.geste, CHOIX[n].geste, 'geste actif jusqu’à sa durée propre');
        assert(e.gestePhase > phases[n] && e.gestePhase >= 0 && e.gestePhase < 1, 'phase temporelle strictement croissante');
        phases[n] = e.gestePhase;
        assert(e.gesteIntensite >= 0 && e.gesteIntensite <= 1, 'intensité bornée');
        if (age > .3 && age < .9) assert(e.gesteIntensite > .99, 'plateau du geste réellement atteint');
      } else {
        assert.equal(e.geste, null, 'retour terminé à la durée attendue');
        assert.equal(e.gesteIntensite, 0); assert.equal(e.gestePhase, 0);
        assert.deepEqual(rendu, initial, 'retour exact des doigts et articulations au volant');
      }
      const h = e.gesteCote < 0 ? 0 : 1, autre = 1 - h;
      assert.deepEqual(a.slice(autre * 9, autre * 9 + 9), initial.articulations.slice(autre * 9, autre * 9 + 9), 'autre bras inchangé');
      assert.deepEqual(rendu.mains[autre], initial.mains[autre], 'autre main conserve sa prise');
      const mouvement = distance(a.slice(h * 9 + 6, h * 9 + 9), initial.articulations.slice(h * 9 + 6, h * 9 + 9));
      amplitudes[n] = Math.max(amplitudes[n], mouvement);
      if (etapes.has(pas)) observation[n] = { id, ...e, poignetDistanceRepos: mouvement, articulations: a, mainsSha256: SHA(JSON.stringify(rendu.mains)) };
    }
    assert.equal(b.sons(), 2, 'aucun rejeu audio par image, vue, LOD ou rétroviseur');
    assert.equal(b.audio.klaxons().length, 2, 'aucune source supplémentaire');
    if (etapes.has(pas)) mesures.push({ age, joueurs: observation, klaxonsJoues: b.sons() });
  }
  assert(amplitudes.every(x => x > .1), 'les poignets des deux pilotes quittent réellement le volant');
  for (const n of [0, 1]) {
    assert(mesures[1].joueurs[n].gesteIntensite > 0 && mesures[1].joueurs[n].gesteIntensite < 1, 'montée intermédiaire');
    const retour = mesures.find(m => m.age > (n ? 1.2 : 1.6)).joueurs[n];
    assert(retour.gesteIntensite > 0 && retour.gesteIntensite < 1, 'retour intermédiaire');
  }
  assert.notEqual(b.S.expressions.pilotes[locaux[0]].evenement.sequence, b.S.expressions.pilotes[locaux[1]].evenement.sequence);
  return { locaux, choix: COPIE(CHOIX), pas: 253, poses: poses.n, amplitudesPoignets: amplitudes, mesures,
    sources: b.audio.klaxons().map(s => ({ debut: s.debut, fin: s.fin, echantillons: s.buffer.length })) };
}

function entrees(fabriquer) {
  const b = fabriquer([3, 7]); b.reglages.touches = [{ troll: ['KeyT'] }, { troll: ['KeyY'] }]; b.image(10);
  b.appui('KeyG'); b.appui('NumpadDecimal'); b.image(10.1); assert.equal(b.sons(), 0, 'anciens raccourcis retirés');
  b.event('keydown', 'KeyT'); b.image(10.2); verifierDepart(b, [3], 1);
  assert.equal(b.choix(7).geste, null, 'J1 ne déclenche pas J2');
  // Une demande trop précoce expire avant la fin du délai de réarmement.
  b.appui('KeyT'); b.image(10.3);
  for (let k = 1; k <= 320; k++) b.image(10.3 + k * DT);
  assert.equal(b.sons(), 1, 'pas de répétition tardive après demande expirée');
  b.event('keydown', 'KeyT', true); b.image(13.1);
  assert.equal(b.sons(), 1, 'répétition clavier ignorée même après réarmement');
  b.event('keyup', 'KeyT'); b.appui('KeyT'); b.image(13.2); verifierDepart(b, [3], 2);
  b.appui('KeyY'); b.image(13.3); verifierDepart(b, [7], 3);
  return { locaux: [3, 7], touches: ['KeyT', 'KeyY'], sources: b.sons(), repetitionIgnoree: true, delaiRespecte: true, joueursIndependants: true };
}

function rapportDiffere(fabriquer) {
  const b = fabriquer([0, 1]); b.image(10);
  b.co.voitures[0].etat.rapport = 4; b.co.voitures[0].tPassage = 10.1;
  b.appui('KeyG'); b.image(10.1);
  for (let k = 1; k <= 40; k++) {
    b.image(10.1 + k * DT); assert.equal(b.sons(), 0, 'rapport en cours : aucune source prématurée');
    assert.equal(b.choix(0).geste, null, 'rapport en cours : geste différé');
  }
  b.image(10.47); verifierDepart(b, [0], 1);
  assert.equal(b.choix(0).geste, CHOIX[0].geste);
  assert.equal(b.audio.klaxons()[0].debut, 10.47);
  return { demande: 10.1, departCommun: 10.47, sources: b.sons(), sonAvantGeste: false };
}

export function qualifierHtml(html) {
  const octets = Buffer.isBuffer(html) ? html : Buffer.from(html);
  const r = { schema: 1, format: 'bitume-troll-assemble-js-v1', date: new Date().toISOString(),
    html: { sha256: SHA(octets), octets: octets.length }, modules: {}, controles: [], echecs: 0,
    qualificationWebGL: false, ecouteAudio: false, limites: [...LIMITES] };
  try {
    const modules = modulesDuHtml(octets.toString('utf8'));
    for (const nom of [...MODULES, 'jeu.js']) r.modules[nom] = SHA(modules.get(nom));
    const fabriquer = creerFabrique(modules);
    for (const [nom, essai] of [
      ['J1-J2-temporalite-et-poses', () => temporel(fabriquer, [0, 1])],
      ['ID-locaux-non-contigus', () => temporel(fabriquer, [3, 7])],
      ['clavier-repetition-delai-independance', () => entrees(fabriquer)],
      ['rapport-differe-depart-commun', () => rapportDiffere(fabriquer)]
    ]) {
      try { r.controles.push({ nom, statut: 'ok', preuve: essai() }); }
      catch (e) { r.controles.push({ nom, statut: 'echec', erreur: String(e.message), pile: String(e.stack).split('\n').slice(0, 7) }); r.echecs++; }
    }
  } catch (e) { r.controles.push({ nom: 'chargement-HTML-exact', statut: 'echec', erreur: String(e.message) }); r.echecs++; }
  r.statut = r.echecs ? 'echec' : 'raccord-logique-et-geometrique-conforme-visuel-ouvert';
  return r;
}

function identiteGit(fichier) {
  try {
    const git = args => execFileSync('git', ['-C', path.dirname(fichier), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const racine = git(['rev-parse', '--show-toplevel']), relatif = path.relative(racine, fichier).split(path.sep).join('/');
    const commit = git(['rev-parse', 'HEAD']), blob = git(['hash-object', '--', fichier]);
    const blobCommit = git(['rev-parse', 'HEAD:' + relatif]);
    return { commit, chemin: relatif, blob, blobCommit, htmlIdentiqueAuCommit: blob === blobCommit };
  } catch { return { commit: null, htmlIdentiqueAuCommit: false, limite: 'HTML non rattachable à un blob du checkout ; son SHA256 reste identifié.' }; }
}

export function qualifierFichier(o) {
  const avant = readFileSync(o.html), rapport = qualifierHtml(avant);
  rapport.sourceHtml = identiteGit(o.html);
  rapport.outil = { sha256: SHA(readFileSync(fileURLToPath(import.meta.url))), fichier: 'tools/qualification/troll-assemble.mjs' };
  assert.equal(SHA(readFileSync(o.html)), rapport.html.sha256, 'HTML modifié pendant la qualification');
  mkdirSync(path.dirname(o.sortie), { recursive: true });
  writeFileSync(o.sortie, JSON.stringify(rapport, null, 2) + '\n');
  return rapport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const o = optionsTrollAssemble(process.argv.slice(2)), r = qualifierFichier(o);
    console.log(JSON.stringify({ htmlSha256: r.html.sha256, controles: r.controles.map(c => ({ nom: c.nom, statut: c.statut, erreur: c.erreur })), echecs: r.echecs, rapport: o.sortie }));
    process.exitCode = r.echecs ? 1 : 0;
  } catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
