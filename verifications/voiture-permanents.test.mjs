// Objets de rendu permanents des voitures (src/voiture.js). poser, cockpit, fantome, poserRetro et glacesCockpit
// rendent d'une image à l'autre les mêmes objets, réécrits en place, sans drapeau passé d'une variante à l'autre ;
// niveaux de détail (options.detail, detailPour) ; pose réduite des rétroviseurs identique à la pose entière filtrée,
// voiture retournée comprise ; aucune allocation en régime permanent, mesurée dans un processus fils de deux façons :
// octets alloués (échantillonnage du tas, qui voit aussi ce que V8 range d'emblée dans la vieille génération) et
// ramasse-miettes mineurs avec une jeune génération réduite à 1 Mo.
//   node verifications/voiture-permanents.test.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const fichier = fileURLToPath(import.meta.url), ici = path.dirname(fichier), src = path.join(ici, '..', 'src');
const require = createRequire(import.meta.url);
for (const f of ['carene.js', 'main.js', 'ferro/vehicle-dynamics.js', 'conduite.js', 'voiture.js']) require(path.join(src, f));
const V = globalThis.BITUME.voiture;

const LIVREES = [{ couleur: [.86, .1, .08], seconde: [.95, .93, .88], casque: [.95, .93, .88], combinaison: [.95, .93, .88], numero: 27, pneus: 'slicks' },
  { couleur: [.1, .3, .8], numero: 1, pneus: 'pluie' }];
const ETAT = { regime: 9000, volant: .2, rapport: 3, kmh: 180, passage: 1, rapportAvant: 2, ciel: [.6, .7, .8], brume: [.5, .55, .6],
  derriere: [{ x: -8, z: -1.5, couleur: [.1, .3, .8] }, { x: -15, z: 1, couleur: [.9, .1, .1] }, { x: -30, z: 3 }] };
const pose = (k, extra) => Object.assign({ p: [10 + k * 3.7, 1 + k * .1, -20 + k * 2.1], cap: .3 + k * .21, tangage: .02 - k * .007, roulis: -.01 + k * .005,
  braquage: .05 * k, roule: 4 + 3.3 * k, v: 40 + 3 * k, rebond: [.001 * k, -.002, .0015, 0] }, extra);   // v > 30 m/s : mêmes pièces visibles
// photographie des valeurs lues par le moteur, zéros signés compris
const nombre = x => typeof x === 'number' ? (Object.is(x, -0) ? '-0' : String(x)) : x === undefined ? '~' : JSON.stringify(x);
const texte = o => ['shape', 'mat', 'surface', 'fx', 'alpha', 'overlay', 'emissive'].map(k => nombre(o[k])).join(';') + '|' +
  ['p', 's', 'r', 'color'].map(k => o[k] === undefined ? '~' : Array.from(o[k], nombre).join(',')).join('|');
const textes = l => l.map(texte).join('\n');
function alea(graine) {
  let a = graine >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- mesure dans le processus fils
if (process.argv[2] === '--mesure') {
  const { PerformanceObserver, constants } = await import('node:perf_hooks');
  const { Session } = await import('node:inspector');
  const { getHeapCodeStatistics } = await import('node:v8');
  const session = new Session(); session.connect();   // dans le processus même : aucun port ouvert
  const post = (m, p) => new Promise((ok, ko) => session.post(m, p || {}, (e, r) => e ? ko(e) : ok(r)));
  await post('HeapProfiler.enable');
  const mod = V.modele(LIVREES[1]);
  // liste de sortie sans croissance : on ne compte que ce qu'allouent les fonctions de voiture.js
  const puits = { n: 0, a: new Array(4096).fill(null), push(o) { this.a[this.n++] = o; } };
  const ev = pose(1), etat = Object.assign({}, ETAT), sansOptions = undefined, moyen = { detail: 'moyen' }, epave = { casse: true }, dessus = { cockpit: true, overlay: true };
  let dest;
  const cas = {                                       // [appel, appels par tour]
    poser: [() => { V.poser(mod, ev, puits, sansOptions); V.poser(mod, ev, puits, moyen); V.poser(mod, ev, puits, epave); V.poser(mod, ev, puits, dessus); }, 4],
    cockpit: [i => { etat.regime = 8000 + (i % 50) * 100; etat.volant = Math.sin(i * .01); etat.kmh = 100 + (i % 300); etat.passage = (i % 100) / 100; etat.rapport = 1 + (i >> 7) % 6; V.cockpit(mod, ev, puits, etat); }, 1],
    fantome: [() => V.fantome(ev, puits), 1],
    poserRetro: [() => V.poserRetro(mod, ev, puits), 1],
    glacesCockpit: [() => { dest = V.glacesCockpit(ev, dest); }, 1]
  };
  const mineurs = [], observateur = new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.detail.kind === constants.NODE_PERFORMANCE_GC_MINOR) mineurs.push(1); });
  observateur.observe({ entryTypes: ['gc'] });
  const somme = n => n.children.reduce((s, e) => s + somme(e), n.selfSize);
  const codeMachine = () => getHeapCodeStatistics().code_and_metadata_size;
  const pause = () => new Promise(r => setTimeout(r, 15));
  const resultat = {};
  for (const [nom, [f, parTour]] of Object.entries(cas)) {
    const tourner = n => { for (let i = 0; i < n; i++) { puits.n = 0; ev.p[0] = 10 + i * .01; ev.cap = .3 + i * 1e-4; ev.roule = i * .05; ev.braquage = Math.sin(i * .003) * .2; f(i); } };
    // Un GC après la chauffe peut jeter du code optimisé ; une chauffe synchrone ne laisse pas non plus
    // installer les compilations de fond. Ramasser avant, puis laisser deux phases stables de code machine.
    // Borne stricte : 30 phases au plus, une seule mesure, jamais un nouvel essai selon les octets obtenus.
    globalThis.gc();
    await pause();
    let phases = 0, stables = 0;
    for (; phases < 30 && (phases < 6 || stables < 2); phases++) {
      const avantCode = codeMachine();
      tourner(5000);
      await pause();
      stables = codeMachine() === avantCode ? stables + 1 : 0;
    }
    assert.ok(stables >= 2, `${nom} : code non stabilisé après ${phases} phases de chauffe`);
    const avant = mineurs.length, N = 150000;
    // un échantillon tous les 4 Kio alloués en moyenne, objets ramassés compris : estimation sans biais des octets
    await post('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true });
    const codeAvant = codeMachine();
    tourner(N);
    const codePendantMesure = codeMachine() - codeAvant;
    let octets;
    try { octets = somme((await post('HeapProfiler.stopSampling')).profile.head); } catch (e) { octets = Infinity; }   // profil trop gros pour être rendu
    await new Promise(r => setTimeout(r, 10));
    resultat[nom] = { appels: N * parTour, mineurs: mineurs.length - avant, octets: octets / (N * parTour), phasesChauffe: phases, codePendantMesure };
  }
  console.log(JSON.stringify(resultat));
  process.exit(0);
}

// ---------------------------------------------------------------- vérifications
let compte = 0;
function verifier(nom, f) {
  try { f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`FAIL ${nom}: ${e.message}`); process.exit(1); }
}
const t0 = performance.now();
const modeles = LIVREES.map(l => V.modele(l));

verifier('modèle : objets de rendu créés avec lui, hors de ses propriétés énumérées', () => {
  const mod = modeles[0];
  assert.deepEqual(Object.keys(mod), ['corps', 'simples', 'epave', 'moyens', 'livree']);
  assert.ok(mod.objetsRendu && mod.objetsRendu.habitacle, 'habitacle construit avec le modèle');
  const tables = mod.objetsRendu.tables.filter(Boolean).length;
  for (const options of [undefined, { simple: true }, { casse: true }, { detail: 'moyen' }, { cockpit: true, overlay: true }]) V.poser(mod, pose(0), [], options);
  V.cockpit(mod, pose(0), [], ETAT); V.poserRetro(mod, pose(0), []);
  assert.equal(mod.objetsRendu.tables.filter(Boolean).length, tables, 'aucune table créée pendant la course');
});

verifier('poser, cockpit, fantôme, rétroviseur : mêmes objets d\'une image à l\'autre, réécrits en place', () => {
  const mod = modeles[1];
  const appels = [['poser', s => V.poser(mod, ev, s)], ['poser simple', s => V.poser(mod, ev, s, { simple: true })], ['poser moyen', s => V.poser(mod, ev, s, { detail: 'moyen' })],
    ['poser épave', s => V.poser(mod, ev, s, { casse: true })], ['poser par-dessus', s => V.poser(mod, ev, s, { cockpit: true, overlay: true })],
    ['cockpit', s => V.cockpit(mod, ev, s, ETAT)], ['fantome', s => V.fantome(ev, s)], ['poserRetro', s => V.poserRetro(mod, ev, s)]];
  let ev;
  for (const [nom, f] of appels) {
    ev = pose(1); const a = []; f(a); const ta = textes(a);
    ev = pose(2); const b = []; f(b);
    assert.ok(a.length > 0, nom);
    assert.equal(b.length, a.length, `${nom} : autant d'objets`);
    for (let i = 0; i < a.length; i++) {
      assert.equal(b[i], a[i], `${nom} : objet ${i} réutilisé`);
      assert.equal(b[i].p, a[i].p, `${nom} : place ${i} réutilisée`);
      assert.equal(b[i].r, a[i].r, `${nom} : rotation ${i} réutilisée`);
    }
    assert.notEqual(textes(b), ta, `${nom} : valeurs réécrites`);
  }
});

verifier('attitude rendue : celle de la caisse au bit près, un tableau par voiture', () => {
  const mod = modeles[0], ev = pose(3), A = V.attitude(ev.cap, ev.tangage, ev.roulis);
  const M = V.poser(mod, ev, []), M2 = V.cockpit(mod, pose(3), [], ETAT), autre = V.poser(modeles[1], pose(4), []);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) assert.ok(Object.is(M[c][r], A[c][r]), `M[${c}][${r}]`);
  assert.equal(M2, M, 'même tableau pour la même voiture');
  assert.notEqual(autre, M, 'un tableau par voiture');
});

verifier('aucun drapeau ne passe d\'une variante à l\'autre', () => {
  const mod = modeles[0], ev = pose(1), dessus = [], dehors = [], cockpit = [], siege = [], encore = [];
  V.poser(mod, ev, dessus, { overlay: true });
  V.poser(mod, ev, dehors);
  V.cockpit(mod, ev, cockpit, ETAT);
  V.poser(mod, ev, siege, { cockpit: true });
  V.poser(mod, ev, encore, { overlay: true });
  assert.ok(dessus.every(o => o.overlay === true) && encore.every(o => o.overlay === true), 'par-dessus');
  assert.ok(dehors.every(o => o.overlay === undefined) && siege.every(o => o.overlay === undefined), 'sans overlay');
  assert.ok(cockpit.every(o => o.overlay === true), 'cockpit');
  const vus = new Set(dehors);
  assert.ok(![...dessus, ...cockpit, ...siege].some(o => vus.has(o)), 'aucun objet partagé avec la vue extérieure');
  assert.ok(dehors.every(o => (o.fx === true) === (o.alpha !== undefined)), 'fx et alpha ensemble');
});

verifier('voyants : émission allumée puis éteinte sur le même objet', () => {
  // La lampe a désormais sa dimension métrique commune aux vues. Identifier son rôle,
  // plutôt que l'ancien diamètre propre au cadrage intérieur, puis vérifier sa présence réelle.
  const mod = modeles[0], lampe = s => s.find(o => o === mod.objetsRendu.habitacle.lampe.objet);
  const a = []; V.cockpit(mod, pose(1), a, Object.assign({}, ETAT, { regime: 12500, rapport: 3 }));
  const b = []; V.cockpit(mod, pose(1), b, Object.assign({}, ETAT, { regime: 9000, rapport: 3 }));
  const la = lampe(a), lb = lampe(b);
  assert.ok(la && lb && la === lb, 'même objet');
  assert.equal(lb.emissive, undefined, 'éteinte : aucune émission');
  const c = []; V.cockpit(mod, pose(1), c, Object.assign({}, ETAT, { regime: 12500, rapport: 3 }));
  assert.equal(lampe(c).emissive, 3.2, 'rallumée');
});

verifier('niveaux de détail : complet par défaut, simple comme options.simple, moyen entre les deux', () => {
  const mod = modeles[0], ev = pose(1), liste = options => { const s = []; V.poser(mod, ev, s, options); return textes(s); };
  assert.equal(liste({ detail: 'complet' }), liste(undefined));
  assert.equal(liste({ detail: 'simple' }), liste({ simple: true }));
  assert.equal(liste({ simple: true, detail: 'complet' }), liste(undefined), 'detail l\'emporte sur simple');
  assert.equal(liste({ casse: true, detail: 'moyen' }), liste({ casse: true }), 'casse l\'emporte');
  const moyen = [], complet = [], simple = [];
  V.poser(mod, ev, moyen, { detail: 'moyen' }); V.poser(mod, ev, complet); V.poser(mod, ev, simple, { simple: true });
  assert.ok(simple.length < moyen.length && moyen.length < complet.length, `${simple.length} < ${moyen.length} < ${complet.length}`);
  assert.ok(mod.moyens.every(p => mod.corps.includes(p)) && mod.moyens.every((p, i, l) => i === 0 || mod.corps.indexOf(l[i - 1]) < mod.corps.indexOf(p)), 'pièces du modèle complet, dans son ordre');
  const formes = new Set(moyen.map(o => o.shape));
  for (const nom of ['quille', 'fleche', 'pontons', 'goutte', 'moteur', 'mat-aileron']) assert.ok(formes.has(V.FORMES[nom].nom), nom);
  assert.equal(moyen.filter(o => o.shape === V.ROUES_FORMES.av.slicks[2].nom || o.shape === V.ROUES_FORMES.ar.slicks[2].nom).length, 4, 'quatre pneus avec leur vrai maillage moyen');
  assert.equal(moyen.filter(o => o.shape === V.ROUES_FORMES.ar.slicks[2].nom).length, 2);
  const sansRoues = []; V.poser(mod, ev, sansRoues, { detail: 'moyen', roues: [true, false, false, true] });
  assert.equal(sansRoues.length, moyen.length - 8, 'roues détachées : pneu, fût creux, rayons et moyeu en moins');
});

verifier('detailPour : décision de jeu.js au bit près avec facteur 1, bande moyenne au-delà', () => {
  const a = alea(5), clamp = (x, l, h) => Math.max(l, Math.min(h, x));
  for (let n = 0; n < 20000; n++) {
    const fov = 5 + a() * 110, t = Math.tan(clamp(fov, 10, 110) * Math.PI / 360);
    const complet = 170 * Math.tan(20.8 * Math.PI / 180) / Math.tan(clamp(fov, 10, 110) * Math.PI / 360);   // jeu.js
    const d2 = n % 4 === 0 ? complet * complet : (a() * 2 * complet) ** 2, h = Math.floor(a() * 2400);
    assert.equal(V.detailPour(d2, t, h, 1) === 'complet', !(d2 > complet * complet), `fov ${fov} d2 ${d2}`);
    assert.equal(V.detailPour(d2, t, h) === 'complet', !(d2 > complet * complet));
    assert.notEqual(V.detailPour(d2, t, 0, 1), 'moyen', 'sans hauteur, aucune bande moyenne');
    assert.notEqual(V.detailPour(d2, t, undefined), 'moyen');
  }
  const t = Math.tan(41.6 * Math.PI / 360);
  assert.equal(V.detailPour(169 ** 2, t, 900), 'complet');
  assert.equal(V.detailPour(175 ** 2, t, 900), 'moyen');                // 4,53 m couvrent 30,7 pixels de 900
  assert.equal(V.detailPour(180 ** 2, t, 900), 'simple');               // 29,8 pixels
  assert.equal(V.detailPour(175 ** 2, t, 600), 'simple', 'toile basse : la voiture tient moins de 30 pixels au seuil');
  assert.equal(V.detailPour(100 ** 2, t, 900, .5), 'moyen', 'facteur 0,5 : modèle complet jusqu\'à 85 m');
  assert.equal(V.detailPour(84 ** 2, t, 900, .5), 'complet');
  assert.equal(V.detailPour(200 ** 2, t, 2160, .5), 'moyen', 'le critère des 30 pixels ne dépend pas du facteur');
});

verifier('rétroviseur : pose réduite identique à la pose entière filtrée, voiture retournée comprise', () => {
  const a = alea(11);
  let corps = 0;
  for (let n = 0; n < 3000; n++) {
    const mod = modeles[n % 2], ev = { p: [(a() - .5) * 4000, a() * 50, (a() - .5) * 4000], cap: (a() - .5) * 14, tangage: (a() - .5) * (n % 3 ? 7 : .3),
      roulis: (a() - .5) * (n % 3 ? 7 : .3), braquage: (a() - .5) * 1.2, roule: a() * 1e4, v: a() * 80, rebond: [0, 1, 2, 3].map(() => (a() - .5) * .01) };
    const options = { casse: n % 7 === 0, roues: n % 5 === 0 ? [a() < .5, a() < .5, a() < .5, a() < .5] : undefined };
    const entiere = [];
    V.poser(mod, ev, entiere, options);
    const ca = Math.cos(ev.cap), sa = Math.sin(ev.cap);   // filtre de jeu.js (majGlaces)
    for (let k = entiere.length - 1; k >= 0; k--) {
      const o = entiere[k], dx = o.p[0] - ev.p[0], dz = o.p[2] - ev.p[2], x = dx * ca + dz * sa, z = dz * ca - dx * sa;
      if (!(Math.abs(x - V.ROUES[2].x) < .5 && Math.abs(z) > .55)) entiere.splice(k, 1);
    }
    const attendu = textes(entiere), reduite = [];
    V.poserRetro(mod, ev, reduite, options);
    assert.equal(textes(reduite), attendu, `pose ${n}`);
    if (reduite.some(o => !o.shape.startsWith('bitume-pneu') && o.shape !== 'cylinder' && o.shape !== 'box')) corps++;
  }
  assert.ok(corps > 0, 'des pièces de caisse passent le filtre quand la voiture se retourne');
});

verifier('glacesCockpit : dest réécrit en place, mêmes valeurs qu\'un résultat neuf', () => {
  const ev = pose(2), neuf = V.glacesCockpit(ev), autre = V.glacesCockpit(ev);
  assert.notEqual(neuf, autre, 'sans dest, un résultat neuf (comme avant)');
  const dest = V.glacesCockpit(pose(1)), rendu = V.glacesCockpit(ev, dest);
  assert.equal(rendu, dest);
  const plat = g => g.map(q => [q.k, ...q.coins.flatMap(c => Array.from(c, nombre)), ...['centre', 'normale', 'droite'].flatMap(k => Array.from(q[k], nombre))].join(',')).join('\n');
  assert.equal(plat(rendu), plat(neuf));
});

verifier('objetsFantome : deux fantômes dans une même liste restent distincts', () => {
  const s = [], F = V.objetsFantome();
  V.fantome(pose(1), s); V.fantome(pose(2), s, F);
  const t1 = textes(s.slice(0, 11)), t2 = textes(s.slice(11)), r1 = [], r2 = [];
  V.fantome(pose(1), r1, V.objetsFantome()); V.fantome(pose(2), r2, V.objetsFantome());
  assert.equal(s.length, 22);
  assert.notEqual(s[0], s[11]);
  assert.equal(t1, textes(r1), 'le premier garde sa pose');
  assert.equal(t2, textes(r2));
  assert.notEqual(t1, t2);
});

verifier('hypotDans : Math.hypot de ce moteur au bit près', () => {
  const a = alea(3), v = new Float64Array(4), f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
  const brut = () => { u32[0] = (a() * 4294967296) >>> 0; u32[1] = (a() * 4294967296) >>> 0; return f64[0]; };
  const tirages = [() => (a() - .5) * 2, () => (a() - .5) * 1e-300, () => (a() - .5) * 1e300, () => 0, () => -0, () => NaN, () => Infinity, () => -Infinity, brut, () => Math.round((a() - .5) * 8)];
  for (let n = 0; n < 200000; n++) {
    const k = n % 2 ? 3 : 2;
    for (let i = 0; i < k; i++) v[i] = n % 3 ? (a() - .5) * 3 : tirages[Math.floor(a() * tirages.length)]();
    V.hypotDans(v, k);
    const attendu = k === 3 ? Math.hypot(v[0], v[1], v[2]) : Math.hypot(v[0], v[1]);
    if (!Object.is(v[3], attendu)) assert.fail(`hypot(${Array.from(v.subarray(0, k))}) : ${v[3]} au lieu de ${attendu}`);
  }
});

verifier('aucune allocation en régime permanent (octets alloués, ramasse-miettes mineurs)', () => {
  const sortie = execFileSync(process.execPath, ['--max-semi-space-size=1', '--expose-gc', fichier, '--mesure'], { encoding: 'utf8', timeout: 600000 });
  const r = JSON.parse(sortie.trim().split('\n').pop());
  console.log('    mesures ' + JSON.stringify(r));
  // Un seul nombre emballé (16 octets) par appel : 16 octets estimés par appel, et 2 ramasse-miettes mineurs en
  // 150 000 appels sur ce réglage. Seuils : 8 octets par appel (la boucle de mesure et une recompilation ponctuelle
  // pèsent jusqu'à 2 octets par appel), un ramasse-miettes.
  // Le compte des ramasse-miettes seul ne suffit pas : un littéral ([x], {…}) dont V8 voit survivre les objets est
  // alloué directement dans la vieille génération, sans aucun ramasse-miettes mineur.
  for (const [nom, { appels, mineurs, octets }] of Object.entries(r)) {
    assert.ok(octets <= 8, `${nom} : ${octets.toFixed(1)} octets alloués par appel`);
    assert.ok(mineurs <= 1, `${nom} : ${mineurs} ramasse-miettes mineurs en ${appels} appels`);
  }
  console.log(`    ${Object.entries(r).map(([nom, x]) => `${nom} ${x.octets.toFixed(2)} o/appel, ${x.mineurs} GC en ${x.appels}`).join(' ; ')}`);
});

console.log(`${compte} vérifications réussies (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
