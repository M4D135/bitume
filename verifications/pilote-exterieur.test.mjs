// Animation du pilote extérieur : géométrie réellement posée, mêmes gants/levier que le cockpit,
// articulations cohérentes dans les LOD, aucun état de simulation modifié ni objet créé par image.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const fichier = fileURLToPath(import.meta.url), racine = path.resolve(path.dirname(fichier), '..');
function charger(humain = true) {
  const contexte = vm.createContext({ console });
  const fichiers = ['carene.js', 'main.js', ...(humain ? ['humain-donnees.js', 'humain-corps.js'] : []),
    'ferro/vehicle-dynamics.js', 'pneus.js', 'usure-pneus.js', 'chaussee.js', 'conduite.js', 'voiture.js'];
  for (const nom of fichiers) vm.runInContext(fs.readFileSync(path.join(racine, 'src', nom), 'utf8'), contexte, { filename: nom });
  return contexte.BITUME.voiture;
}
const livree = { couleur: [.82, .12, .08], combinaison: [.88, .84, .72], numero: 27 };
const pose = () => ({ p: [8, 2, -3], cap: .4, tangage: .09, roulis: -.06, braquage: .12, roule: 6, v: 35,
  rebond: [.01, -.02, .03, 0], pilote: { volant: 0, rapport: 3, rapportAvant: 2, passage: 1 } });
const options = [{ detail: 'complet' }, { detail: 'moyen' }, { detail: 'simple' }];
const snapshot = liste => JSON.stringify(liste.map(o => [o.shape, ...['p', 's', 'r', 'color'].map(k => Array.from(o[k] || [])), o.mat, o.fx, o.alpha, o.overlay]));
const proche = (a, b, marge = 1e-11) => { assert.ok(Math.abs(a - b) <= marge, `${a} != ${b}`); };
const distance = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
const point = (A, i) => Array.from(A.slice(i, i + 3));
const role = (rig, variante, nom) => rig.variantes[variante].pieces.find(p => p.role === nom).objet;

if (process.argv.includes('--allocation')) {
  const { Session } = await import('node:inspector');
  const { PerformanceObserver, constants } = await import('node:perf_hooks');
  const V = charger(), mod = V.modele(livree), ev = pose();
  const puits = { n: 0, cases: new Array(4096).fill(null), push(o) { this.cases[this.n++] = o; } };
  const session = new Session(); session.connect();
  const post = (m, p) => new Promise((ok, ko) => session.post(m, p || {}, (e, r) => e ? ko(e) : ok(r)));
  await post('HeapProfiler.enable');
  let mineurs = 0;
  const observateur = new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.detail.kind === constants.NODE_PERFORMANCE_GC_MINOR) mineurs++; });
  observateur.observe({ entryTypes: ['gc'] });
  function tourner(n) {
    for (let i = 0; i < n; i++) {
      puits.n = 0; ev.pilote.volant = Math.sin(i * .009); ev.pilote.passage = (i % 101) / 100;
      ev.pilote.rapport = 1 + ((i >> 7) % 6); ev.pilote.rapportAvant = Math.max(1, ev.pilote.rapport - 1);
      ev.cap = .4 + i * 1e-5; ev.roule = i * .1;
      V.poser(mod, ev, puits, options[i % 3]);
    }
  }
  for (let i = 0; i < 4; i++) tourner(10000);
  globalThis.gc(); await new Promise(r => setTimeout(r, 20));
  const avant = mineurs, appels = 60000;
  await post('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true });
  tourner(appels);
  const profil = (await post('HeapProfiler.stopSampling')).profile;
  const taille = n => n.selfSize + n.children.reduce((s, c) => s + taille(c), 0);
  await new Promise(r => setTimeout(r, 20));
  console.log(JSON.stringify({ appels, octets_par_pose: taille(profil.head) / appels, gc_mineurs: mineurs - avant }));
  observateur.disconnect(); session.disconnect(); process.exit(0);
}

const V = charger(), modele = () => V.modele(livree);
// Bornes larges de la vraie cuve ouverte ; les traversées de ses triangles sont contrôlées dans pilote-habitacle.
// Le fond plein historique à y=.48 n'est plus la limite inférieure de l'assise.
const fondCuve = V.FORMES.cuve.centre[1] - V.FORMES.cuve.taille[1] / 2;
const bordCuve = V.FORMES.jonc.centre[1] + V.FORMES.jonc.taille[1] / 2;
const demiLargeurCuve = V.FORMES.cuve.taille[2] / 2;
function dessiner(mod, ev, o) { const sortie = []; V.poser(mod, ev, sortie, o); return sortie; }

test('le contrat de pose reste en lecture seule et le rendu historique revient sans résidu', () => {
  const mod = modele(), ev = pose();
  delete ev.pilote;
  const ancien = snapshot(dessiner(mod, ev));
  const donnees = Object.freeze({ volant: .7, rapport: 4, rapportAvant: 3, passage: .45 });
  const actif = Object.freeze({ ...ev, p: Object.freeze(ev.p), rebond: Object.freeze(ev.rebond), pilote: donnees });
  assert.notEqual(snapshot(dessiner(mod, actif)), ancien);
  assert.equal(snapshot(dessiner(mod, ev)), ancien);
  assert.deepEqual(donnees, { volant: .7, rapport: 4, rapportAvant: 3, passage: .45 });
});

test('main droite au levier puis retour ; main gauche reste au volant', () => {
  const mod = modele(), ev = pose(); ev.cap = ev.tangage = ev.roulis = 0; ev.p.fill(0);
  ev.pilote.passage = 0; dessiner(mod, ev);
  const rig = mod.objetsRendu.pilote, debut = Array.from(rig.articulations);
  const gant = Array.from(role(rig, 0, 'gant-1-0').p);
  ev.pilote.passage = .5; dessiner(mod, ev);
  const milieu = Array.from(rig.articulations);
  assert.deepEqual(milieu.slice(0, 9), debut.slice(0, 9), 'bras gauche indépendant du passage');
  assert.ok(distance(point(milieu, 15), point(debut, 15)) > .045, 'main droite quitte sa prise pour le levier rapproché');
  assert.ok(distance(Array.from(role(rig, 0, 'gant-1-0').p), Array.from(role(rig, 0, 'pommeau').p)) < .09, 'gant rejoint le pommeau');
  assert.ok(rig.tete[1] < 0, 'regard accompagne le levier vers le bas');
  ev.pilote.passage = 1; dessiner(mod, ev);
  assert.deepEqual(Array.from(rig.articulations), debut);
  assert.deepEqual(Array.from(role(rig, 0, 'gant-1-0').p), gant);
});

test('le volant entraîne les deux mains et le regard suit la direction', () => {
  const mod = modele(), ev = pose();
  dessiner(mod, ev); const rig = mod.objetsRendu.pilote, droit = Array.from(rig.articulations);
  ev.pilote.volant = .8; dessiner(mod, ev);
  assert.ok(distance(point(rig.articulations, 6), point(droit, 6)) > .07);
  assert.ok(distance(point(rig.articulations, 15), point(droit, 15)) > .07);
  assert.ok(rig.tete[2] > 0, 'avant du casque vers la droite');
  ev.pilote.volant = -.8; dessiner(mod, ev);
  assert.ok(rig.tete[2] < 0, 'avant du casque vers la gauche');
});

test('630 poses : segments de 21/23 cm, coudes repliés dans la cuve et matrices finies', () => {
  const mod = modele(), ev = pose();
  for (const volant of [-1, -.5, 0, .5, 1]) for (let rapport = 1; rapport <= 6; rapport++) for (let f = 0; f <= 20; f++) {
    Object.assign(ev.pilote, { volant, rapport, rapportAvant: rapport - 1, passage: f / 20 });
    const sortie = dessiner(mod, ev), A = mod.objetsRendu.pilote.articulations;
    for (let h = 0; h < 2; h++) {
      const j = h * 9;
      proche(distance(point(A, j), point(A, j + 3)), .21);
      proche(distance(point(A, j + 3), point(A, j + 6)), .23);
      assert.ok(A[j + 4] - .0375 > fondCuve && A[j + 4] + .0375 < bordCuve &&
        A[j + 4] < Math.max(A[j + 1], A[j + 7]) && Math.abs(A[j + 5]) + .0375 < demiLargeurCuve,
        'coude replié sous le haut de la chaîne et dans la vraie profondeur de cuve : ' + JSON.stringify({ volant, rapport, phase: f / 20, joints: Array.from(A.slice(j, j + 9)), fondCuve, bordCuve, demiLargeurCuve }));
    }
    for (const o of sortie) for (const k of ['p', 'r', 's', 'color']) assert.ok(Array.from(o[k]).every(Number.isFinite), k);
  }
});

test('les trois LOD conservent les mêmes articulations et transformations des bras', () => {
  const mod = modele(), ev = pose(); ev.pilote.volant = -.6; ev.pilote.passage = .42;
  const valeurs = [], tetes = [];
  for (let n = 0; n < options.length; n++) {
    dessiner(mod, ev, options[n]);
    const rig = mod.objetsRendu.pilote, variante = [0, 6, 2][n], table = mod.objetsRendu.tables[[0, 12, 4][n]];
    valeurs.push(['bras-0', 'avant-bras-0', 'coude-0', 'bras-1', 'avant-bras-1', 'coude-1'].map(nom => {
      const o = role(rig, variante, nom); return [Array.from(o.p), Array.from(o.r), Array.from(o.s)];
    }));
    const index = Array.from(table.tete).findIndex(Boolean);
    assert.ok(index >= 0); tetes.push(Array.from(table.objets[index].r));
  }
  assert.deepEqual(valeurs[1], valeurs[0]); assert.deepEqual(valeurs[2], valeurs[0]);
  assert.deepEqual(tetes[1], tetes[0]); assert.deepEqual(tetes[2], tetes[0]);
});

test('les volumes des bras rejoignent les articulations sous toute attitude de caisse', () => {
  const mod = modele(), ev = pose(); ev.pilote.volant = .7; ev.pilote.passage = .55;
  dessiner(mod, ev);
  const R = mod.objetsRendu.pilote, caisse = V.attitude(ev.cap, ev.tangage, ev.roulis);
  for (const piece of R.variantes[0].pieces.filter(p => p.de !== undefined)) {
    const o = piece.objet, m = V.euler(...o.r);
    for (const [index, signe] of [[piece.de, -1], [piece.a, 1]]) {
      const attendu = V.mul(caisse, point(R.articulations, index));
      for (let k = 0; k < 3; k++) proche(o.p[k] + signe * m[1][k] * o.s[1] / 2, ev.p[k] + attendu[k]);
    }
  }
});

test('les gants gardent formes, repères et prises autour des ancrages extérieurs', () => {
  const mod = modele(), ev = pose(); ev.cap = ev.tangage = ev.roulis = 0; ev.p.fill(0);
  for (const passage of [0, .45, 1]) {
    const etat = { regime: 9000, volant: .4, rapport: 4, rapportAvant: 3, passage, kmh: 160 };
    Object.assign(ev.pilote, etat); dessiner(mod, ev);
    const R = mod.objetsRendu.pilote;
    for (let h = 0; h < 2; h++) {
      const auLevier = h === 1 && passage === .45, nomAncrage = auLevier ? 'pommeau' : 'volant';
      const main = role(R, 0, 'gant-' + h + '-0'), ancrage = Array.from(role(R, 0, nomAncrage).p);
      const dehors = [Array.from(main.p), Array.from(main.r), Array.from(main.s), main.shape];
      const out = []; V.cockpit(mod, ev, out, etat);
      const H = mod.objetsRendu.habitacle, source = H.mains[h].pieces[0], sourceAncrage = auLevier ? H.pommeau : H.jante;
      assert.equal(dehors[3], source.objet.shape);
      for (let k = 0; k < 3; k++) {
        // Mêmes positions et dimensions métriques dans les deux vues : aucune remise à l'échelle.
        proche(dehors[0][k] - ancrage[k], source.o[k] - sourceAncrage.o[k]);
        proche(dehors[1][k], source.objet.r[k]); proche(dehors[2][k], source.objet.s[k]);
      }
    }
  }
});

test('bras contenus au centre et au levier : coudes abaissés et prise naturelle', () => {
  const mod = modele(), ev = pose();
  for (const passage of [0, .15, .3, .45, .65, .82, 1]) {
    ev.pilote.passage = passage; dessiner(mod, ev); const A = mod.objetsRendu.pilote.articulations;
    for (const j of [0, 9]) {
      assert.ok(A[j + 4] + .0375 < bordCuve && A[j + 4] - .0375 > fondCuve, 'coude dans la profondeur utile de la cuve');
      assert.ok(Math.abs(A[j + 8]) < .18 && A[j + 7] < .74, 'prise contenue près du volant ou du levier');
    }
  }
});

test('cockpit, J2 et voitures distinctes ne contaminent pas la pose extérieure', () => {
  const a = modele(), b = V.modele({ couleur: [.1, .2, .8] }), ev = pose();
  ev.pilote.volant = .3; ev.pilote.passage = .2;
  const initial = snapshot(dessiner(a, ev));
  const autre = pose(); autre.pilote.volant = -1; autre.pilote.passage = .8;
  dessiner(b, autre); const cockpit = []; V.cockpit(a, autre, cockpit, { regime: 8000, volant: -.9, passage: .7, rapport: 2, rapportAvant: 3, kmh: 90 });
  assert.ok(!cockpit.some(o => a.objetsRendu.pilote.variantes.some(v => v.pieces.some(p => p.objet === o))), 'pas de doublon du pilote extérieur dans le cockpit');
  assert.equal(snapshot(dessiner(a, ev)), initial);
  for (let i = 0; i < 20; i++) assert.equal(snapshot(dessiner(a, ev)), initial, 'aucune avance cachée par appel');
});

test('rétroviseur : même géométrie animée que la pose complète filtrée, voiture retournée comprise', () => {
  const mod = modele(), ev = pose();
  for (const cap of [0, .8, Math.PI]) for (const tangage of [0, .5, Math.PI / 2, Math.PI]) for (const roulis of [0, .9, Math.PI]) {
    Object.assign(ev, { cap, tangage, roulis }); ev.pilote.volant = .6; ev.pilote.passage = .4;
    const ca = Math.cos(cap), sa = Math.sin(cap);
    const ensemble = dessiner(mod, ev).filter(o => {
      const dx = o.p[0] - ev.p[0], dz = o.p[2] - ev.p[2];
      return Math.abs(dx * ca + dz * sa - V.ROUES[2].x) < .5 && Math.abs(dz * ca - dx * sa) > .55;
    });
    const attendu = snapshot(ensemble), miroir = [];
    V.poserRetro(mod, ev, miroir); assert.equal(snapshot(miroir), attendu);
  }
});

test('entrées absentes ou non finies restent bornées, sans transmettre NaN aux bras', () => {
  const mod = modele(), ev = pose();
  for (const pilote of [{}, { volant: NaN, rapport: NaN, passage: NaN }, { volant: Infinity, rapport: -Infinity, rapportAvant: Infinity, passage: Infinity },
    { volant: 100, rapport: 1000, rapportAvant: -1000, passage: -4 }]) {
    ev.pilote = pilote;
    for (const o of dessiner(mod, ev)) for (const k of ['p', 'r', 's']) assert.ok(Array.from(o[k]).every(Number.isFinite));
  }
});

test('les objets et buffers restent permanents, y compris après service pneus', () => {
  const mod = modele(), ev = pose(), rig = mod.objetsRendu.pilote;
  assert.equal(rig.variantes.length, 10);
  const identites = rig.variantes.map(v => v.pieces.map(p => [p.objet, p.objet.p, p.objet.r, p.objet.s]));
  V.preparerPneusService(mod); assert.equal(V.changerPneus(mod, 'pluie'), true);
  for (let i = 0; i < 80; i++) { ev.pilote.volant = Math.sin(i); ev.pilote.passage = (i % 11) / 10; dessiner(mod, ev, options[i % 3]); }
  assert.equal(mod.objetsRendu.pilote, rig);
  rig.variantes.forEach((v, i) => v.pieces.forEach((p, j) => {
    const objets = [p.objet, p.objet.p, p.objet.r, p.objet.s];
    objets.forEach((o, k) => assert.equal(o, identites[i][j][k]));
  }));
});

test('le repli sans modèles humains garde aussi tête et bras animés', () => {
  const P = charger(false), mod = P.modele(livree), ev = pose(), debut = [];
  P.poser(mod, ev, debut); const avant = snapshot(debut);
  ev.pilote.passage = .5; const suite = []; P.poser(mod, ev, suite);
  assert.notEqual(snapshot(suite), avant); assert.equal(suite.length, debut.length);
  assert.ok(Array.from(mod.objetsRendu.pilote.articulations).every(Number.isFinite));
});

test('préallocation active : aucun flot d’objets ou de GC pendant 60 000 poses', () => {
  const sortie = execFileSync(process.execPath, ['--expose-gc', '--max-semi-space-size=1', fichier, '--allocation'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const mesures = JSON.parse(sortie.trim().split('\n').at(-1));
  assert.ok(mesures.octets_par_pose < 4, JSON.stringify(mesures));
  assert.ok(mesures.gc_mineurs <= 2, JSON.stringify(mesures));
  console.log('mesure pilote extérieur : ' + JSON.stringify(mesures));
});
