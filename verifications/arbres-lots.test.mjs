// Lots d'arbres de Moyenne et Fine : cases de CASE_ARBRES mètres qui basculent sur la taille projetée de leurs
// arbres. L'image change de découpage, pas de contenu : chaque objet proche dans un seul lot, un tronc par arbre,
// solides (dans le même ordre) et positions d'arbres identiques au palier Légère, dont les lots restent
// historiques. Vrais décors, sans WebGL.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
// Même décor dans Node et dans la VM sans botanique. decor.js charge ces quatre dépendances
// automatiquement en CommonJS ; la VM ne possède pas require et doit les recevoir explicitement.
const MODULES = ['graphismes', 'carene', 'circuit', 'ecologie', 'saisons', 'vegetation',
  'chaussee', 'virages', 'baikal', 'batiments', 'decor', 'botanique'];
for (const n of MODULES) require('../src/' + n + '.js');
const B = globalThis.BITUME, D = B.decor;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };

const CIRCUITS = [[11, 'foret', 4200], [47, 'montagne', 5200], [29, 'cote', 3600], [131, 'asie', 5000], [157, 'pacifique', 5200]];
const construire = (graine, theme, longueur, qualite, options = {}) =>
  D.construire(B.circuit.creer(graine, { theme, longueur }), { qualite, vegetation: false, ...options });
const recul = h => h * 1080 / (2 * Math.tan(Math.PI / 6) * D.PIXELS_BASCULE);
const cases = d => d.lots.filter(l => l.arbres === true);
const DECORS = CIRCUITS.map(([g, th, L]) => ({ theme: th, low: construire(g, th, L, 'low'),
  medium: construire(g, th, L, 'medium'), high: construire(g, th, L, 'high') }));

verifier('constantes exportées : cases de 60 m, éparses de 120 m sous trois arbres, bascule à 80 m, 150 pixels', () => {
  assert.equal(D.CASE_ARBRES, 60);
  assert.equal(D.CASE_EPARSE, 120);
  assert.equal(D.ARBRES_EPARS, 3);
  assert.equal(D.BASCULE_ARBRES, 80);
  assert.equal(D.PIXELS_BASCULE, 150);
});
verifier('Légère garde ses lots historiques : aucune case d\'arbres, aucune référence de champ', () => {
  for (const d of DECORS) {
    assert.equal(cases(d.low).length, 0, d.theme);
    for (const l of d.low.lots) assert.ok(!('lodReferenceFov' in l) && !('arbres' in l), d.theme);
  }
});
verifier('solides et positions des arbres identiques à Légère, dans le même ordre', () => {
  for (const d of DECORS) for (const q of ['medium', 'high']) {
    assert.deepEqual(d[q].obstacles, d.low.obstacles, `${d.theme} ${q} : solides`);
    assert.deepEqual(d[q].arbres, d.low.arbres, `${d.theme} ${q} : positions des arbres`);
  }
});
verifier('chaque objet proche une seule fois ; aucun tronc hors des cases ; un tronc par position d\'arbre', () => {
  for (const d of DECORS) for (const q of ['medium', 'high']) {
    const tous = d[q].lots.flatMap(l => l.objets), uniques = new Set(tous);
    assert.equal(uniques.size, tous.length, `${d.theme} ${q} : objet partagé entre deux lots`);
    for (const l of d[q].lots) if (l.arbres !== true)
      assert.ok(!l.objets.some(o => o.collision === 'tronc'), `${d.theme} ${q} : tronc resté dans un lot de mobilier`);
    const troncs = cases(d[q]).flatMap(l => l.objets.filter(o => o.collision === 'tronc'));
    assert.equal(troncs.length, d[q].arbres.length, `${d.theme} ${q} : troncs`);
    assert.equal(troncs.length, d[q].obstacles.filter(o => o.genre === 'tronc').length, `${d.theme} ${q} : solides de tronc`);
  }
});
// Une case dense tient au moins ARBRES_EPARS arbres dans un même carré de CASE_ARBRES mètres ; une case éparse réunit
// des carrés de moins de ARBRES_EPARS arbres dans un même carré de CASE_EPARSE mètres. Un carré n'est jamais partagé.
verifier('cases denses de 60 m, cases éparses de 120 m, aucun carré partagé, sphère qui contient tout', () => {
  const carre = (o, cote) => Math.floor(o.p[0] / cote) + ',' + Math.floor(o.p[2] / cote);
  let eparses = 0;
  for (const d of DECORS) for (const q of ['medium', 'high']) {
    assert.ok(cases(d[q]).length > 0, `${d.theme} ${q} : aucune case`);
    const proprietaire = new Map(), grandsCarres = new Set();
    for (const l of cases(d[q])) {
      const troncs = l.objets.filter(o => o.collision === 'tronc');
      assert.ok(troncs.length > 0, `${d.theme} ${q} : case sans arbre`);
      const parCarre = new Map();
      for (const o of troncs) parCarre.set(carre(o, D.CASE_ARBRES), (parCarre.get(carre(o, D.CASE_ARBRES)) || 0) + 1);
      for (const k of parCarre.keys()) {
        assert.ok(!proprietaire.has(k) || proprietaire.get(k) === l, `${d.theme} ${q} : carré ${k} partagé`);
        proprietaire.set(k, l);
      }
      const dense = parCarre.size === 1 && troncs.length >= D.ARBRES_EPARS;
      if (!dense) {
        eparses++;
        for (const n of parCarre.values()) assert.ok(n < D.ARBRES_EPARS, `${d.theme} ${q} : carré dense dans une case éparse`);
        const grand = new Set(troncs.map(o => carre(o, D.CASE_EPARSE)));
        assert.equal(grand.size, 1, `${d.theme} ${q} : case éparse à cheval`);
        // Tous les arbres isolés d'un carré de 120 m vont dans la même case éparse.
        assert.ok(!grandsCarres.has([...grand][0]), `${d.theme} ${q} : deux cases éparses dans le même carré de 120 m`);
        grandsCarres.add([...grand][0]);
      }
      for (const o of l.objets.concat(l.loin)) {
        const dist = Math.hypot(o.p[0] - l.centre[0], o.p[1] - l.centre[1], o.p[2] - l.centre[2]);
        assert.ok(dist + Math.hypot(...o.s) / 2 <= l.rayon + 1e-9, `${d.theme} ${q} : objet hors de la sphère`);
      }
    }
  }
  assert.ok(eparses > 0, 'aucune case éparse : le regroupement n\'est pas exercé');
});
verifier('bascule par taille projetée : au moins BASCULE_ARBRES, reculée pour les grands arbres, sans portée', () => {
  let geants = 0;
  for (const d of DECORS) for (const q of ['medium', 'high']) for (const l of cases(d[q])) {
    const hauteur = Math.max(...l.objets.filter(o => o.collision === 'tronc').map(o => o.s[1] / .84));
    assert.equal(l.hauteurArbres, hauteur, d.theme);
    assert.equal(l.bascule, Math.max(D.BASCULE_ARBRES, recul(hauteur)), d.theme);
    // À la bascule, l'arbre le plus haut de la case tient au plus PIXELS_BASCULE pixels sur 1 080 à 60°.
    assert.ok(hauteur * 1080 / (2 * Math.tan(Math.PI / 6) * l.bascule) <= D.PIXELS_BASCULE + 1e-9, d.theme);
    assert.equal(l.portee, Infinity, d.theme);
    assert.equal(l.lodReferenceFov, 60);
    assert.equal(l.lodReferenceHeight, 1080);
    if (l.bascule > D.BASCULE_ARBRES) geants++;
  }
  assert.ok(geants > 0, 'aucune case de grands arbres : le recul n\'est pas exercé');
});
verifier('version lointaine : silhouette de la même essence et tronc allégé, mêmes position, taille et rotation', () => {
  const memePose = (a, b) => JSON.stringify([a.p, a.s, a.r]) === JSON.stringify([b.p, b.s, b.r]);
  for (const d of DECORS) for (const q of ['medium', 'high']) for (const l of cases(d[q])) {
    for (const o of l.objets) {
      if (/^arbre-.*-proche-/.test(o.shape)) {
        const nom = o.shape.replace('-proche-', '-loin-');
        assert.ok(l.loin.some(x => x.shape === nom && memePose(x, o) && x.mat === o.mat
          && JSON.stringify(x.color) === JSON.stringify(o.color)), `${d.theme} ${q} : couronne lointaine absente`);
      } else if (o.collision === 'tronc') {
        // Le tronc d'un géant de Cap-Séquoia est déjà dans la version lointaine historique ; les autres troncs
        // d'écorce y reçoivent le prisme allégé, même matière, même couleur.
        assert.ok(l.loin.includes(o) || l.loin.some(x => x.shape === B.botanique.TRONC_LOINTAIN && memePose(x, o)
          && x.mat === o.mat && JSON.stringify(x.color) === JSON.stringify(o.color)), `${d.theme} ${q} : tronc lointain absent`);
      } else assert.fail(`${d.theme} ${q} : objet étranger dans une case d'arbres (${o.shape})`);
    }
    assert.ok(l.loin.length <= l.objets.length, `${d.theme} ${q} : version lointaine plus chargée que la proche`);
  }
});
verifier('mobilier : bascules historiques conservées, seuils propres aux seuls lots d\'architecture identifiés', () => {
  let detailsVerifies = 0, voiesVerifiees = 0;
  for (const d of DECORS) for (const q of ['medium', 'high']) {
    const meubles = d[q].lots.filter(l => l.arbres !== true);
    assert.ok(meubles.length > 0 && meubles.length <= d.low.lots.length, d.theme);
    assert.ok(d[q].architecture, `${d.theme} ${q} : architecture active`);
    let details = 0;
    for (const l of meubles) {
      assert.ok(l.objets.length > 0, `${d.theme} ${q} : lot vide conservé`);
      assert.ok(l.portee === Infinity && !('lodReferenceFov' in l), `${d.theme} ${q} : portée du mobilier`);
      const genres = new Set(l.objets.concat(l.loin).map(o => o.architecture));
      if (genres.has('maison') || genres.has('commissaires')) {
        // Un lot dédié de détails, jamais un lot historique mélangé auquel on accorderait 180 m.
        assert.equal(genres.size, 1, `${d.theme} ${q} : détails architecturaux mélangés au mobilier`);
        assert.equal(l.bascule, 180, `${d.theme} ${q} : détails des maisons/postes`);
        details++; detailsVerifies++;
      } else if (genres.has('voie-service')) {
        assert.equal(genres.size, 1, `${d.theme} ${q} : voie de service mélangée au mobilier`);
        assert.equal(l.bascule, 260, `${d.theme} ${q} : repères de la voie de service`);
        voiesVerifiees++;
      } else {
        // Les stands restent dans les lots de mobilier historiques : aucun élargissement global des seuils.
        assert.ok([520, 900].includes(l.bascule), `${d.theme} ${q} : bascule du mobilier historique`);
      }
    }
    assert.equal(details, d[q].architecture.maisons.length, `${d.theme} ${q} : un lot dédié par maison/poste`);
  }
  assert.ok(detailsVerifies > 0 && voiesVerifiees > 0, 'les contrats architecturaux doivent être exercés');
});
verifier('basculeArbres règle les seules cases d\'arbres et garde le recul des grands arbres', () => {
  // Cap-Séquoia : ses géants (jusqu'à 47 m) reculent la bascule bien au-delà de 120 m.
  const lots = DECORS[4].high.lots.map(l => Object.assign({}, l));
  const avant = lots.map(l => l.bascule);
  assert.equal(D.basculeArbres(lots, 0), 0);
  assert.equal(D.basculeArbres(lots, NaN), 0);
  assert.equal(D.basculeArbres(null, 120), 0);
  assert.deepEqual(lots.map(l => l.bascule), avant);
  assert.equal(D.basculeArbres(lots, 120), cases({ lots }).length);
  lots.forEach((l, i) => assert.equal(l.bascule, l.arbres === true ? Math.max(120, recul(l.hauteurArbres)) : avant[i]));
  assert.ok(lots.some(l => l.arbres === true && l.bascule > 120), 'aucun grand arbre au-delà de 120 m');
  assert.deepEqual(DECORS[4].high.lots.map(l => l.bascule), avant, 'les lots du décor ne sont pas touchés');
});
verifier('lotsSecondMoteur : copies sans tampons ; version lointaine seule pour les arbres sur demande', () => {
  const d = DECORS[0].medium;
  for (const options of [undefined, { arbresLointains: true }]) {
    const copie = D.lotsSecondMoteur(d, options);
    assert.equal(copie.length, d.lots.length);
    copie.forEach((l, i) => {
      assert.notEqual(l, d.lots[i]);
      for (const cle of ['tampon', 'tamponLoin', 'paquet', 'paquetLoin']) assert.equal(l[cle], null);
      assert.equal(l.objets, options && d.lots[i].arbres === true ? d.lots[i].loin : d.lots[i].objets);
      assert.equal(l.loin, d.lots[i].loin);
      assert.equal(l.bascule, d.lots[i].bascule);
    });
  }
  assert.deepEqual(D.lotsSecondMoteur(null), []);
});
verifier('massifs de végétation basse ajoutés à la fin, après les cases ; solides inchangés', () => {
  const [g, th, L] = CIRCUITS[0];
  const avecVegetation = construire(g, th, L, 'medium', { vegetation: undefined });
  const n = avecVegetation.vegetation.lots, lots = avecVegetation.lots;
  assert.ok(n > 0);
  assert.equal(lots.length, DECORS[0].medium.lots.length + n);
  assert.ok(lots.slice(-n).every(l => l.arbres !== true));
  assert.deepEqual(avecVegetation.obstacles, DECORS[0].low.obstacles);
});
verifier('sans module botanique, les cases se font quand même et aucun tronc allégé n\'est posé', () => {
  const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const n of MODULES.filter(m => m !== 'botanique'))
    vm.runInContext(readFileSync(new URL('../src/' + n + '.js', import.meta.url), 'utf8'), ctx, { filename: n + '.js' });
  const [g, th, L] = CIRCUITS[0], X = ctx.BITUME;
  const d = X.decor.construire(X.circuit.creer(g, { theme: th, longueur: L }), { qualite: 'medium', vegetation: false });
  assert.ok(X.baikal && X.batiments && d.architecture, 'les modules de décor sont présents aussi dans la VM');
  assert.equal(JSON.stringify(d.architecture), JSON.stringify(DECORS[0].low.architecture), 'mêmes sites architecturaux Node/VM');
  assert.ok(d.lots.some(l => l.arbres === true));
  assert.ok(!d.lots.some(l => l.loin.some(o => o.shape === 'arbre-tronc-loin')));
  assert.equal(JSON.stringify(d.obstacles), JSON.stringify(DECORS[0].low.obstacles));
});
console.log(JSON.stringify({ controles, cases: Object.fromEntries(DECORS.map(d => [d.theme, cases(d.high).length])) }));
