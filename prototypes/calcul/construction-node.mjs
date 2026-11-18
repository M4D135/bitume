#!/usr/bin/env node
// Lot 28 « calcul » — temps de construction d'un niveau sous Node, étape par étape, et poids produit.
// Charge les vrais modules de src/ (comme les suites de verifications/), sans rien y écrire : les chronos des
// fonctions internes de decor.js sont posés sur une copie du texte, évaluée en mémoire. Le moteur de rendu tourne
// sur la doublure WebGL inerte du dépôt (docs/reprise/rapports/herbe-sillage-2026-11-18/fixture-webgl.js) : on mesure
// le travail du processeur pour préparer l'envoi (empaquetage), pas l'envoi réel au processeur graphique.
//
//   node --expose-gc prototypes/calcul/construction-node.mjs --circuits 0,2,3,6 --paliers medium,high --reps 3 --sortie f.json
//   (mode enfant, interne : --enfant circuit,palier)
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const CATALOGUE = [
  { id: 'val-brule', theme: 'foret', graine: 11, longueur: 4200 },
  { id: 'port-sable', theme: 'cote', graine: 29, longueur: 3600 },
  { id: 'haut-col', theme: 'montagne', graine: 47, longueur: 5200 },
  { id: 'lande-noire', theme: 'islande', graine: 83, longueur: 4600 },
  { id: 'roche-fauve', theme: 'desert', graine: 107, longueur: 4800 },
  { id: 'brume-de-jade', theme: 'asie', graine: 131, longueur: 5000 },
  { id: 'cap-sequoia', theme: 'pacifique', graine: 157, longueur: 5200 },
];

if (arg('enfant')) enfant(arg('enfant'));
else parent();

function parent() {
  const circuits = arg('circuits', '0,1,2,3,4,5,6').split(',').map(Number);
  const paliers = arg('paliers', 'medium,high').split(',');
  const reps = Number(arg('reps', 3)), sortie = arg('sortie', null);
  const essais = [];
  for (let r = 0; r < reps; r++) for (const p of paliers) for (const i of circuits) {
    const t0 = Date.now();
    const res = spawnSync(process.execPath, ['--expose-gc', '--max-old-space-size=4096', fileURLToPath(import.meta.url), '--enfant', i + ',' + p, ...(arg('saison') ? ['--saison', arg('saison')] : [])], { encoding: 'utf8', maxBuffer: 64e6 });
    if (res.status !== 0) { console.error(res.stderr.slice(-3000)); throw new Error('enfant en échec ' + i + ' ' + p); }
    const ligne = res.stdout.trim().split('\n').pop();
    const d = JSON.parse(ligne); d.rep = r; d.dureeProcessusMs = Date.now() - t0; d.charge = os.loadavg()[0];
    essais.push(d);
    console.error(`rep ${r} ${p} ${CATALOGUE[i].id}: processeur froid ${d.froid.totalMs.toFixed(0)} ms (mur ${d.froid.murMs.toFixed(0)}), chaud ${d.chaud.totalMs.toFixed(0)} ms, charge ${d.charge.toFixed(1)}`);
  }
  // médianes et écarts par (circuit, palier)
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const resume = [];
  for (const p of paliers) for (const i of circuits) {
    const e = essais.filter(x => x.circuit === i && x.palier === p);
    const etapes = {};
    for (const phase of ['froid', 'chaud']) {
      etapes[phase] = {};
      const noms = new Set(e.flatMap(x => Object.keys(x[phase].etapes)));
      for (const n of noms) {
        const v = e.map(x => x[phase].etapes[n] ? x[phase].etapes[n].propre : 0);
        const t = e.map(x => x[phase].etapes[n] ? x[phase].etapes[n].total : 0);
        etapes[phase][n] = { propreMed: +med(v).toFixed(2), propreMin: +Math.min(...v).toFixed(2), propreMax: +Math.max(...v).toFixed(2), totalMed: +med(t).toFixed(2), appels: e[0][phase].etapes[n] ? e[0][phase].etapes[n].n : 0 };
      }
      const tot = e.map(x => x[phase].totalMs), mur = e.map(x => x[phase].murMs);
      etapes[phase].TOTAL = { med: +med(tot).toFixed(1), min: +Math.min(...tot).toFixed(1), max: +Math.max(...tot).toFixed(1), murMed: +med(mur).toFixed(1) };
    }
    resume.push({ circuit: i, id: CATALOGUE[i].id, palier: p, essais: e.length, charges: e.map(x => +x.charge.toFixed(1)), etapes, poids: e[0].poids, memoire: e.map(x => x.memoire), chargementModulesMs: med(e.map(x => x.chargementModulesMs)) });
  }
  const rapport = { date: new Date().toISOString(), node: process.version, machine: os.cpus()[0].model + ' x' + os.cpus().length, memoireMachineGo: +(os.totalmem() / 2 ** 30).toFixed(1),
    methode: 'Un processus Node neuf par essai (froid = première construction du processus, JIT froid ; chaud = deuxième construction du même niveau dans le même processus). Temps processeur du fil principal (process.threadCpuUsage) autour des vraies fonctions, horloge murale à part (murMed) ; « propre » = temps hors étapes chronométrées imbriquées. Moteur sur doublure WebGL inerte : setNappes/setLots mesurent l’empaquetage processeur, pas le transfert au GPU.',
    resume, essais };
  if (sortie) writeFileSync(sortie, JSON.stringify(rapport, null, 1));
  for (const r of resume) {
    const f = r.etapes.froid;
    const top = Object.entries(f).filter(([n]) => n !== 'TOTAL').sort((a, b) => b[1].propreMed - a[1].propreMed).slice(0, 8).map(([n, v]) => n + ' ' + v.propreMed);
    console.log(`${r.id} ${r.palier}: froid ${f.TOTAL.med} ms [${f.TOTAL.min}-${f.TOTAL.max}] chaud ${r.etapes.chaud.TOTAL.med} ms | ${top.join(', ')}`);
  }
}

function enfant(spec) {
  const [ci, palier] = spec.split(','); const i = Number(ci), k = CATALOGUE[i];
  const saison = arg('saison', 'ete');
  // ---------------------------------------------------------------- chronos
  const stats = new Map(), pile = [];
  // Temps processeur du fil (process.threadCpuUsage, µs) : peu sensible à la charge de la machine, contrairement à
  // l'horloge murale (relevée aussi). Coût d'un relevé : environ 1,7 µs, d'où des étapes grossières seulement.
  const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
  const W = (nom, f) => { if (typeof f !== 'function') return f; return function (...a) {
    const t0 = cpu(), m0 = performance.now(); pile.push(0);
    try { return f.apply(this, a); } finally {
      const d = cpu() - t0, mur = performance.now() - m0, enfants = pile.pop();
      const s = stats.get(nom) || { n: 0, total: 0, propre: 0, mur: 0 }; s.n++; s.total += d; s.propre += d - enfants; s.mur += mur; stats.set(nom, s);
      if (pile.length) pile[pile.length - 1] += d;
    } }; };
  globalThis.__W = W;
  const lire = n => readFileSync(path.join(racine, n), 'utf8');
  const tModules = cpu();
  // moteur : évalué ici pour le registre des formes (FRender.forme), comme tools/mesurer-prairie.mjs
  const sourceRendu = lire('src/moteur/renderer.js');
  vm.runInThisContext(sourceRendu, { filename: 'renderer.js' });
  const registre = new Map(), enregistrer = globalThis.FRender.forme;
  globalThis.FRender.forme = (nom, t) => { registre.set(nom, t); return enregistrer(nom, t); };
  const MODULES = ['ferro/vehicle-dynamics', 'graphismes', 'carene', 'circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'botanique', 'ecologie', 'saisons', 'vegetation', 'decor', 'faune', 'effets-saison', 'aurores', 'humain-donnees', 'humain-corps', 'main', 'voiture', 'traces', 'sillage', 'ambiance'];
  const tempsModules = {};
  for (const m of MODULES) {
    let code = lire('src/' + m + '.js');
    if (m === 'decor') {
      const ancre = '  B.decor = { construire,';
      assert.ok(code.includes(ancre), 'point d’injection de decor.js introuvable');
      code = code.replace(ancre, "  nappesRoute = __W('decor.chaussee', nappesRoute); nappesTerrain = __W('decor.relief-terrain', nappesTerrain); creerHerbier = __W('decor.herbier', creerHerbier); indexAxe = __W('decor.indexAxe', indexAxe);\n" + ancre);
    }
    const t = cpu();
    vm.runInThisContext(code, { filename: m + '.js' });
    tempsModules[m] = +(cpu() - t).toFixed(2);
  }
  const chargementModulesMs = cpu() - tModules;
  const B = globalThis.BITUME;
  // fonctions publiques chronométrées
  const publiques = { circuit: ['creer'], decor: ['construire'], vegetation: ['construire'], botanique: ['installer'], ecologie: ['creer'], obstacles: ['creer'],
    faune: ['creer'], effetsSaison: ['creer'], aurores: ['creer'], course: ['creer'], voiture: ['modele'], traces: ['creer'], ambiance: ['creer'], saisons: ['profil', 'atmosphere'] };
  for (const [m, fs] of Object.entries(publiques)) if (B[m]) for (const f of fs) if (typeof B[m][f] === 'function') B[m][f] = W(m + '.' + f, B[m][f]);

  // doublure WebGL : deux moteurs comme dans le jeu (principal et rétroviseurs)
  const fixtureSource = lire('docs/reprise/rapports/herbe-sillage-2026-11-18/fixture-webgl.js');
  const fixture = new Function('assert', 'vm', 'source', 'registry', fixtureSource + '\nreturn fixture;')(assert, vm, sourceRendu, registre);

  function niveau() {
    stats.clear();
    const t0 = cpu(), m0 = performance.now();
    const c = B.circuit.creer(k.graine, { theme: k.theme, longueur: k.longueur, nom: k.id });
    const veut = B.graphismes.melange(palier, 0, { decor: palier, options: { vegetation: 'profil', faune: 'profil', ombres: 'profil', anticrenelage: 'profil' } }).decor;
    const decor = B.decor.construire(c, { qualite: palier, matieres: veut.matieres, vegetation: veut.vegetation, vegetationQualite: veut.vegetationQualite, saison });
    decor.atmosphere = W('graphismes.atmosphere', B.graphismes.atmosphere)(decor.atmosphere);
    if (B.obstacles) c.obstacles = B.obstacles.creer(decor.obstacles);
    // première image : faune (ouvre l'herbier), effets de saison, aurores
    const faune = palier === 'low' ? null : B.faune.creer(c, decor);
    const effets = B.effetsSaison.creer(c, decor);
    const aurores = B.aurores.creer(c);
    // séance : course, douze modèles de voitures, effets
    const course = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 1, rivaux: 11, graine: 1234, placeJoueur: 8, humains: null });
    const modeles = course.voitures.map(v => B.voiture.modele(v.livree));
    const fx = B.traces.creer(course.voitures.length, 1234);
    // moteur principal : envoi du décor (empaquetage processeur ; doublure inerte)
    const f = fixture({ creation: { msaa: 4, shadowMapScale: 2, reflections: palier === 'high', sea: false } });
    W('rendu.setWorld', f.renderer.setWorld)([], [], decor.atmosphere);
    W('rendu.setNappes', f.renderer.setNappes)(decor.nappes);
    W('rendu.setLots', f.renderer.setLots)(decor.lots);
    // moteur des rétroviseurs (jeu.js majGlaces : copies sans tampons)
    let g = null;
    if (palier !== 'low') {
      g = fixture({ creation: { msaa: 0, shadowMapScale: 1, reflections: false, sea: false } });
      W('retro.setNappes', g.renderer.setNappes)(decor.nappes.map(n => Object.assign({}, n)));
      W('retro.setLots', g.renderer.setLots)(decor.lots.map(l => Object.assign({}, l, { tampon: null, tamponLoin: null, paquet: null, paquetLoin: null })));
    }
    const totalMs = cpu() - t0, murMs = performance.now() - m0;
    const etapes = {}; for (const [n, s] of stats) etapes[n] = { n: s.n, total: +s.total.toFixed(3), propre: +s.propre.toFixed(3), mur: +s.mur.toFixed(3) };
    return { totalMs, murMs, etapes, c, decor, f, g, faune, effets, aurores, course, modeles, fx };
  }

  global.gc(); const avant = process.memoryUsage();
  const n1 = niveau();
  global.gc(); const apres = process.memoryUsage();
  // poids produit
  let sommets = 0, indices = 0, octetsNappes = 0;
  for (const n of n1.decor.nappes) { sommets += n.sommets.length / 13; indices += n.indices.length; octetsNappes += n.sommets.byteLength + n.indices.byteLength; }
  let objets = 0, objetsLoin = 0, octetsInstances = 0, trianglesFormes = 0;
  const formes = new Set();
  for (const l of n1.decor.lots) {
    objets += l.objets.length; objetsLoin += (l.loin || []).length;
    octetsInstances += (l.paquet?.values?.byteLength || 0) + (l.paquetLoin?.values?.byteLength || 0);
    for (const o of l.objets) formes.add(o.shape); for (const o of l.loin || []) formes.add(o.shape);
  }
  for (const s of formes) { const t = registre.get(s); if (t) trianglesFormes += t.length; }
  const tampons = r => r ? r.resources('Buffer').reduce((a, b) => a + (b.byteLength || 0), 0) : 0;
  const poids = {
    circuit: { points: n1.c.n, pas: n1.c.pas },
    nappes: { n: n1.decor.nappes.length, sommets, triangles: indices / 3, octets: octetsNappes },
    lots: { n: n1.decor.lots.length, objetsProches: objets, objetsLointains: objetsLoin, formesDistinctes: formes.size, trianglesDesFormes: trianglesFormes, octetsInstances },
    vegetation: n1.decor.vegetation ? { lots: n1.decor.vegetation.lots, herbes: n1.decor.vegetation.herbes, qualite: n1.decor.vegetation.qualite } : null,
    obstacles: Array.isArray(n1.decor.obstacles) ? n1.decor.obstacles.length : null,
    faune: n1.faune ? { habitats: n1.faune.habitats.length } : null,
    tamponsGpuOctets: { principal: tampons(n1.f), retro: tampons(n1.g) },
    formesEnregistrees: { n: registre.size, triangles: [...registre.values()].reduce((a, t) => a + t.length, 0) },
  };
  const memoire = { tasAvantMo: +(avant.heapUsed / 2 ** 20).toFixed(1), tasApresMo: +(apres.heapUsed / 2 ** 20).toFixed(1), deltaTasMo: +((apres.heapUsed - avant.heapUsed) / 2 ** 20).toFixed(1),
    tableauxTypesMo: +((apres.arrayBuffers - avant.arrayBuffers) / 2 ** 20).toFixed(1), rssMo: +(apres.rss / 2 ** 20).toFixed(1) };
  const froid = { totalMs: n1.totalMs, murMs: n1.murMs, etapes: n1.etapes, charge: os.loadavg()[0] };
  n1.f.renderer.dispose(); if (n1.g) n1.g.renderer.dispose();
  // une (--chaud n) autre construction dans le même processus : la dernière est « chaude »
  let chaud = null;
  for (let r = 0; r < Number(arg('chaud', 1)); r++) { const n = niveau(); chaud = { totalMs: n.totalMs, murMs: n.murMs, etapes: n.etapes }; n.f.renderer.dispose(); if (n.g) n.g.renderer.dispose(); }
  console.log(JSON.stringify({ circuit: i, id: k.id, palier, saison, froid, chaud, poids, memoire, chargementModulesMs, tempsModules }));
}
