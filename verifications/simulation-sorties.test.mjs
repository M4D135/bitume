// Pas de simulation sans objets jetés : chaque chemin qui réutilise un objet ou un tableau de travail rend, au bit
// près, ce que rend le chemin qui alloue. Sorties fournies par l'appelant (troisième argument de
// circuit.echantillon, sortie de course.commandesIA, de conduite.pas et de course.pas), tri du classement par
// insertion, index des solides (cellules sans chaîne « x,z », boîtes de rejet), lectures des roues perdues, et forme
// fixe des objets lus à chaque pas. Les nombres se comparent par Object.is (−0 et +0 diffèrent), jamais à une
// tolérance près. verifications/determinisme-simulation.test.mjs garde, lui, les séances entières contre le code
// d'avant ces changements.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'obstacles', 'course', 'carene', 'decor']) req(path.join(ici, '..', 'src', f + '.js'));
const B = globalThis.BITUME, DT = 1 / 120;

let compte = 0;
const verifier = (nom, f) => {
  try { f(); compte++; console.log('ok  ' + nom); } catch (e) { console.error(`FAIL ${nom}: ${e.message}`); process.exit(1); }
};

// Égalité au bit près de deux états : nombres par Object.is, tableaux typés case par case, objets champ par champ.
// Les champs « _ » (caches internes des modules), les fonctions et les valeurs undefined ne comptent pas ; l'effet
// des caches sur la suite de la course, lui, compte.
function memes(a, b, chemin = '', vus = new WeakMap()) {
  if (typeof a === 'number' || typeof b === 'number') {
    if (!Object.is(a, b)) throw new Error(`${chemin || 'valeur'} : ${a} ≠ ${b}`);
    return;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (a !== b) throw new Error(`${chemin || 'valeur'} : ${String(a)} ≠ ${String(b)}`);
    return;
  }
  if (vus.get(a) === b) return;
  vus.set(a, b);
  if (ArrayBuffer.isView(a)) {
    if (!ArrayBuffer.isView(b) || a.length !== b.length) throw new Error(`${chemin} : tableaux typés de tailles différentes`);
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) throw new Error(`${chemin}[${i}] : ${a[i]} ≠ ${b[i]}`);
    return;
  }
  if (Array.isArray(a) !== Array.isArray(b)) throw new Error(`${chemin} : tableau d'un côté seulement`);
  const cles = o => Object.keys(o).filter(k => k[0] !== '_' && o[k] !== undefined && typeof o[k] !== 'function').sort();
  const ka = cles(a), kb = cles(b);
  if (ka.join() !== kb.join()) throw new Error(`${chemin} : champs ${ka.join()} ≠ ${kb.join()}`);
  for (const k of ka) memes(a[k], b[k], chemin + '.' + k, vus);
}
// état d'une course sans son tracé (deux tracés identiques construits à part, ou volontairement indexés autrement)
function etatCourse(co) {
  const r = {};
  for (const k of Object.keys(co)) if (k !== 'c' && k[0] !== '_') r[k] = co[k];
  return r;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const CIRCUITS = {
  'val-brule': [11, 'foret', 4200], 'haut-col': [47, 'montagne', 5200], 'cap-sequoia': [157, 'pacifique', 5200]
};
function circuit(nom, solidesSurPiste = false) {
  const [g, th, lg] = CIRCUITS[nom], c = B.circuit.creer(g, { theme: th, longueur: lg });
  const liste = [];
  if (solidesSurPiste) {
    // les solides de la séance « solides-sur-piste » du test de déterminisme : piles de pneus, murets, troncs
    const sol = (s, d) => B.circuit.point(c, s, d, 0), capA = s => B.circuit.echantillon(c, s).cap;
    [[150, 1.5], [240, -3], [330, 0], [470, 2.6], [640, -1.2], [820, .4], [1010, -2.2], [1230, 3.1], [1480, 0], [1760, -.6]].forEach(([s, d]) => {
      const p = sol(s, d); liste.push({ type: 'circle', x: p[0], z: p[2], r: .37, ymin: p[1], ymax: p[1] + .8, genre: 'pneus' });
    });
    [[200, 4.6, 0], [380, -4.4, 0], [560, 3.8, .35], [900, -3.6, -.4], [1350, 0, Math.PI / 2]].forEach(([s, d, tourne]) => {
      const p = sol(s, d); liste.push({ type: 'box', x: p[0], z: p[2], angle: capA(s) + tourne, hx: tourne === Math.PI / 2 ? 1.6 : 5, hz: .25, ymin: p[1], ymax: p[1] + 1, genre: 'muret' });
    });
    [[290, -1.8], [520, 2.2], [730, -2.8], [1120, 1.1], [1600, 2.4]].forEach(([s, d], i) => {
      const p = sol(s, d); liste.push({ type: 'prism', p: [p[0], p[1] + 6, p[2]], s: [.45, 12, .45], r: [.05 * (i - 2), .3 * i, -.04], sides: 16, genre: 'tronc' });
    });
  }
  c.obstacles = B.obstacles.creer(liste.concat(B.decor.construire(c).obstacles));
  return c;
}
function course(c, o = {}) {
  const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 1, rivaux: 11, graine: 7, placeJoueur: 8, ...o });
  for (const v of co.voitures) v.etat.pneus = B.conduite.pneusConseilles(0);
  return co;
}

verifier('circuit.echantillon : la sortie fournie reçoit les valeurs de l’objet neuf, au bit près', () => {
  const CHAMPS = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse'];
  for (const nom of Object.keys(CIRCUITS)) {
    const c = B.circuit.creer(...[CIRCUITS[nom][0], { theme: CIRCUITS[nom][1], longueur: CIRCUITS[nom][2] }]);
    const L = c.longueur, PAS = B.circuit.PAS;
    // déjà remplie de valeurs fausses (rien n'en est lu) ; un champ étranger n'est pas touché
    const sortie = { x: NaN, cap: 'faux', etranger: 'garde' };
    const abscisses = [0, -0, L, -L, 2 * L + .25, -1e-9, 1e7 + .3, L - 1e-9];
    for (let k = -300; k <= 3300; k++) abscisses.push(k * L / 3000 + (k % 7) * 1e-7, k * PAS);
    for (const s of abscisses) {
      const neuf = B.circuit.echantillon(c, s), rendu = B.circuit.echantillon(c, s, sortie);
      assert.equal(rendu, sortie, 'la sortie fournie est l’objet rendu');
      for (const f of CHAMPS) assert.ok(Object.is(neuf[f], sortie[f]), `${nom}, s = ${s}, ${f} : ${neuf[f]} ≠ ${sortie[f]}`);
    }
    assert.equal(sortie.etranger, 'garde');
    assert.notEqual(B.circuit.echantillon(c, 10), B.circuit.echantillon(c, 10), 'sans sortie, un objet neuf à chaque appel');
  }
});

verifier('conduite.pas : les événements versés dans la sortie sont ceux du tableau neuf, état identique', () => {
  const c = circuit('haut-col');
  const deux = () => { const e = B.conduite.creer(40, 0); e.pneus = B.conduite.pneusConseilles(0); e.degats = B.degats.creer(); return e; };
  const e1 = deux(), e2 = deux(), sortie = [], DEJA = { type: 'deja-la' }, types = new Set();
  for (let k = 0; k < 120 * 45; k++) {
    const t = k * DT, e = e1, kAv = B.circuit.echantillon(c, e.s + 15).courbure;
    // conduite d'essai : boîte auto puis manuelle tenue en deuxième (rupteur), dérive au bouton dans les virages,
    // freinage appuyé, puis marche arrière au frein tenu ; volant de suivi de la ligne médiane
    const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, haut: false, bas: false, boite: 'auto', aide: .35, guidage: 0, marcheArriere: false };
    cmd.volant = Math.max(-1, Math.min(1, B.conduite.volantPour(e, kAv - .08 * e.d - .6 * e.psi)));
    if (t >= 12 && t < 18) { cmd.boite = 'manuelle'; cmd.bas = e.rapport > 2; }
    if (t >= 18 && t < 34) cmd.derive = Math.abs(kAv) > 1 / 220 && e.v > 15;
    if (t >= 34 && t < 38) { cmd.gaz = 0; cmd.frein = 1; }
    if (t >= 38) { cmd.gaz = t < 41 ? 0 : .5; cmd.frein = t < 41 ? 1 : 0; cmd.marcheArriere = true; }
    const ev1 = B.conduite.pas(e1, cmd, c, DT);
    sortie.length = 0; sortie.push(DEJA);
    const ev2 = B.conduite.pas(e2, cmd, c, DT, false, sortie);
    assert.equal(ev2, sortie, 'la sortie fournie est le tableau rendu');
    assert.equal(sortie[0], DEJA, 'la sortie est complétée, jamais vidée par la conduite');
    memes(ev1, sortie.slice(1), `pas ${k}, événements`);
    for (const x of ev1) types.add(x.type);
    if (k % 120 === 119) memes(e1, e2, `pas ${k}, état`);
  }
  memes(e1, e2, 'état final');
  assert.ok(types.size >= 2, `événements rencontrés : ${[...types].join(', ') || 'aucun'} (au moins deux sortes attendues)`);
});

verifier('course.commandesIA et course.pas : sorties réutilisées = objets neufs, commandes, événements et états', () => {
  const co1 = course(circuit('val-brule')), co2 = course(circuit('val-brule'));
  const cmdSortie = {}, evSortie = [{ type: 'reste-du-pas-precedent' }], types = new Set();
  for (let k = 0; k < 120 * 50; k++) {
    const a = co1.joueur.fini ? null : B.course.commandesIA(co1, co1.joueur);
    const b = co2.joueur.fini ? null : B.course.commandesIA(co2, co2.joueur, cmdSortie);
    if (a) {
      // commandesIA rend la sortie remplie, ou ses commandes neutres partagées (figées) : l'appelant lit ce qu'elle rend
      assert.ok(b === cmdSortie || Object.isFrozen(b), `pas ${k} : commandes rendues ni dans la sortie ni neutres`);
      memes(a, b, `pas ${k}, commandes`);
    }
    const ev1 = B.course.pas(co1, a, DT), ev2 = B.course.pas(co2, b, DT, evSortie);
    assert.equal(ev2, evSortie, 'la sortie fournie est le tableau rendu');
    memes(ev1, ev2, `pas ${k}, événements`);
    for (const x of ev1) types.add(x.type);
    if (k % 120 === 119) memes(etatCourse(co1), etatCourse(co2), `pas ${k}, course`);
  }
  memes(etatCourse(co1), etatCourse(co2), 'course finale');
  for (const t of ['feu', 'vert', 'rapport']) assert.ok(types.has(t), `événement « ${t} » jamais vu : ${[...types].join(', ')}`);
  // au départ, un rival encore dans son temps de réaction rend les commandes neutres, pas la sortie
  const co = course(circuit('val-brule'));
  let neutre = null;
  for (let k = 0; k < 120 * 10 && !neutre; k++) {
    B.course.pas(co, B.course.commandesIA(co, co.joueur), DT);
    if (co.phase === 'course' && co.temps < co.voitures[1].ia.reaction - DT) {
      const sortie = {}, r = B.course.commandesIA(co, co.voitures[1], sortie);
      neutre = { r, sortie };
    }
  }
  assert.ok(neutre, 'aucun pas dans le temps de réaction d’un rival');
  assert.ok(Object.isFrozen(neutre.r) && neutre.r !== neutre.sortie && Object.keys(neutre.sortie).length === 0,
    'pendant la réaction : commandes neutres rendues, sortie laissée intacte');
});

verifier('classement : tri par insertion = tri stable de Array.prototype.sort, égalités comprises', () => {
  // la comparaison du classement d'avant le lot (src/course.js, commit 54e98c9), recopiée telle quelle
  const L = 4200, score = v => v.fini ? v.tours : v.progression / L;
  const avant = (a, b) => {
    if (a.abandon !== b.abandon) return a.abandon ? 1 : -1;
    const d = score(b) - score(a);
    if (d !== 0) return d;
    if (a.fini !== b.fini) return a.fini ? -1 : 1;
    return a.fini ? a.tempsFinal - b.tempsFinal : a.id - b.id;
  };
  const r = mulberry32(2026), choisir = t => t[Math.floor(r() * t.length)];
  let egalites = 0;
  for (let essai = 0; essai < 4000; essai++) {
    const n = 1 + essai % 14, V = [];
    for (let id = 0; id < n; id++) {
      const fini = r() < .35;
      V.push({ id, fini, abandon: r() < .1, tours: choisir([1, 2, 3]), progression: choisir([-10, 0, 100, 100.5, 4200, 8400, 2 * 4200 + 1e-9]),
        tempsFinal: fini ? choisir([181.25, 181.25, 182.5, 190]) : null });
    }
    // l'ordre d'entrée compte pour un tri stable : celui des voitures (par id), puis des ordres mélangés
    const entree = essai % 2 ? V : V.slice().sort(() => 0).reverse();
    const attendu = entree.slice().sort(avant).map(v => v.id), obtenu = B.course.classer(entree, L, [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]).map(v => v.id);
    assert.deepEqual(obtenu, attendu, `essai ${essai}`);
    for (let i = 1; i < n; i++) if (avant(entree.slice().sort(avant)[i - 1], entree.slice().sort(avant)[i]) === 0) { egalites++; break; }
  }
  assert.ok(egalites > 100, `égalités exactes rencontrées : ${egalites}`);
});

verifier('solides : cellules et boîtes de rejet donnent les mêmes contacts que la grille seule', () => {
  const c1 = circuit('val-brule', true), c2 = circuit('val-brule', true);
  assert.ok(c1.obstacles.cellules && c1.obstacles.boites, 'index sans cellules ni boîtes');
  assert.equal(c1.obstacles.boites.length, 4 * c1.obstacles.objets.length);
  delete c2.obstacles.cellules; delete c2.obstacles.boites;   // la grille « x,z » et tous ses voisins testés
  const co1 = course(c1, { difficulte: 2, graine: 99, placeJoueur: 4 }), co2 = course(c2, { difficulte: 2, graine: 99, placeJoueur: 4 });
  const types = {};
  for (let k = 0; k < 120 * 45; k++) {
    const ev1 = B.course.pas(co1, B.course.commandesIA(co1, co1.joueur), DT);
    const ev2 = B.course.pas(co2, B.course.commandesIA(co2, co2.joueur), DT);
    memes(ev1, ev2, `pas ${k}, événements`);
    for (const x of ev1) types[x.type] = (types[x.type] || 0) + 1;
    if (k % 120 === 119) memes(etatCourse(co1), etatCourse(co2), `pas ${k}, course`);
  }
  assert.ok((types.choc || 0) >= 5 && types.casse, `chocs contre les solides : ${types.choc || 0}, casses : ${types.casse || 0}`);
});

verifier('dégâts : roues perdues comptées par boucle = some(Boolean) et filter(Boolean).length', () => {
  const D = B.degats, P = D.PARAMS;
  for (let m = 0; m < 16; m++) for (const casse of [false, true]) for (const chocs of [0, 3, 40]) {
    const d = D.creer();
    d.roues = [0, 1, 2, 3].map(i => !!(m & 1 << i)); d.casse = casse; d.chocs = chocs; d.adher = .95; d.trainee = 1.03;
    const n = d.roues.filter(Boolean).length;
    assert.equal(D.uneRouePerdue(d), d.roues.some(Boolean));
    const sante = Math.max(0, Math.min(1, 1 - (.4 * ((1 - d.adher) / (1 - P.adherMin)) + .2 * ((d.trainee - 1) / (P.traineeMax - 1)) + .3 * (n / 4) + .1 * (casse ? 1 : 0))));
    assert.ok(Object.is(D.sante(d), sante), `santé, roues ${m}`);
    assert.ok(Object.is(D.chiffrerService(d), 2.5 + 1.2 * n + (casse ? 3 : 0) + Math.min(3, chocs * .12)), `service, roues ${m}`);
  }
});

verifier('formes fixes : IA et état de conduite gardent les mêmes champs, dans le même ordre, pour chaque voiture', () => {
  // Le moteur JavaScript compile le pas pour une forme d'objet : un champ ajouté en cours de course, dans un ordre
  // propre à chaque voiture, en fait autant de formes et fait recompiler commandesIA sans fin. Un champ neuf de l'IA
  // se déclare dans course.creer, un champ neuf de l'état dans conduite.creer.
  const co = course(circuit('cap-sequoia', true), { difficulte: 2 });
  const formes = () => ({ ia: co.voitures.map(v => Object.keys(v.ia).join()), etat: co.voitures.map(v => Object.keys(v.etat).join()) });
  const depart = formes();
  for (const k of ['ia', 'etat']) assert.equal(new Set(depart[k]).size, 1, `${k} : formes différentes dès la création`);
  for (const champ of ['dehors', 'entamee', 'retourBloque', 'bloque', 'attaque']) assert.ok(champ in co.voitures[3].ia, `ia.${champ} non déclaré à la création`);
  for (let k = 0; k < 120 * 60; k++) B.course.pas(co, B.course.commandesIA(co, co.joueur), DT);
  const apres = formes();
  for (const k of ['ia', 'etat']) {
    assert.equal(new Set(apres[k]).size, 1, `${k} : les voitures n'ont plus la même forme après une minute de course`);
    assert.equal(apres[k][0], depart[k][0], `${k} : champs ajoutés en course (${apres[k][0].split(',').filter(x => !depart[k][0].split(',').includes(x)).join(', ')})`);
  }
});

verifier('chauffe jetable : la vraie course qui suit est la même, au bit près ; tranches et météo respectées', () => {
  const avant = B.meteo;
  B.meteo = { actuel: { pluie: .3, mouille: .1 } };
  try {
    const meteo = JSON.stringify(B.meteo);
    const c1 = circuit('haut-col', true), c2 = circuit('haut-col', true);
    const ch = B.course.chauffe(c1, { secondes: 15 });
    assert.equal(ch.reste, 1800);
    let tranches = 0;
    while (ch.avancer(37)) tranches++;
    assert.equal(tranches, Math.ceil(1800 / 37) - 1);
    assert.equal(ch.reste, 0);
    assert.equal(ch.avancer(10), false, 'une chauffe finie ne repart pas');
    assert.equal(JSON.stringify(B.meteo), meteo, 'la chauffe ne touche pas à la météo');
    const co1 = course(c1), co2 = course(c2);
    for (let k = 0; k < 120 * 40; k++) {
      const ev1 = B.course.pas(co1, B.course.commandesIA(co1, co1.joueur), DT);
      const ev2 = B.course.pas(co2, B.course.commandesIA(co2, co2.joueur), DT);
      memes(ev1, ev2, `pas ${k}, événements`);
      if (k % 120 === 119) memes(etatCourse(co1), etatCourse(co2), `pas ${k}, course`);
    }
  } finally { if (avant === undefined) delete B.meteo; else B.meteo = avant; }
});

console.log(`sorties de simulation : ${compte} vérifications passées`);
