import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
createRequire(import.meta.url)('../src/qualite.js');
createRequire(import.meta.url)('../src/graphismes.js');
createRequire(import.meta.url)('../src/pneus.js');
createRequire(import.meta.url)('../src/navigation-menu.js');
createRequire(import.meta.url)('../src/menu-arcade.js');
const Q = globalThis.BITUME.qualite;
const creer = n => ({ n, somme: 0, compte: 0, t: 0, aise: 0 });
function images(p, fps, n, options) { let changements = 0; for (let i = 0; i < n; i++) if (Q.avancer(p, 1 / fps, options)) changements++; return changements; }
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
verifier('49 FPS : aucune baisse avant trois secondes, puis un seul palier', () => {
  const p = creer(0);
  assert.equal(images(p, 49, 146), 0); assert.equal(p.n, 0);
  assert.equal(images(p, 49, 1), 1); assert.equal(p.n, 1);
  assert.equal(images(p, 49, 147), 1); assert.equal(p.n, 2);
});
verifier('50 et 60 FPS stables : ni baisse ni remontée', () => {
  for (const fps of [50, 60]) { const p = creer(2); assert.equal(images(p, fps, fps * 24), 0); assert.equal(p.n, 2); }
});
verifier('75 FPS : huit secondes avant une remontée, puis nouvelle observation complète', () => {
  const p = creer(3);
  assert.equal(images(p, 75, 599), 0); assert.equal(p.n, 3);
  assert.equal(images(p, 75, 1), 1); assert.equal(p.n, 2);
  assert.equal(images(p, 75, 599), 0); assert.equal(p.n, 2);
  assert.equal(images(p, 75, 1), 1); assert.equal(p.n, 1);
});
verifier('14 ms est la limite stricte de la remontée', () => {
  const p = creer(2);
  for (let i = 0; i < 1000; i++) assert.equal(Q.avancer(p, .014), false);
  assert.equal(p.n, 2);
});
verifier('très faible FPS et longues images restent pris en compte', () => {
  const p = creer(0);
  assert.equal(Q.avancer(p, 1.5), false);
  assert.equal(Q.avancer(p, 1.5), true); assert.equal(p.n, 1);
  assert.equal(Q.avancer(p, 12), true); assert.equal(p.n, 2, 'une seule baisse par image, pas quatre paliers d’un coup');
});
verifier('masquage ou mode inactif remet à zéro les deux fenêtres', () => {
  const p = creer(2);
  images(p, 75, 500);
  assert.ok(p.aise > 6);
  assert.equal(Q.avancer(p, 120, { actif: false }), false);
  assert.deepEqual(p, creer(2));
  assert.equal(images(p, 75, 599), 0);
  assert.equal(images(p, 75, 1), 1);
  images(p, 49, 146);
  Q.avancer(p, 0, { actif: false });
  assert.equal(images(p, 49, 146), 0);
  assert.equal(images(p, 49, 1), 1);
});
verifier('durées invalides ignorées sans contaminer une fenêtre', () => {
  const p = creer(1); images(p, 49, 100);
  const avant = { ...p };
  for (const dt of [0, -1, NaN, Infinity, -Infinity, undefined]) assert.equal(Q.avancer(p, dt), false);
  assert.deepEqual(p, avant);
  assert.equal(images(p, 49, 47), 1);
});
verifier('plancher GPU modeste et plafond de qualité respectés', () => {
  const modeste = creer(2);
  assert.equal(images(modeste, 75, 600, { min: 1 }), 1); assert.equal(modeste.n, 1);
  assert.equal(images(modeste, 75, 1200, { min: 1 }), 0); assert.equal(modeste.n, 1);
  const maximum = creer(4); assert.equal(images(maximum, 10, 1000, { max: 4 }), 0); assert.equal(maximum.n, 4);
  const hors = creer(0); assert.equal(Q.avancer(hors, 1 / 60, { min: 1 }), true); assert.equal(hors.n, 1);
});
verifier('une zone intermédiaire rompt la remontée, sans oscillation', () => {
  const p = creer(2); images(p, 75, 450); // six secondes confortables
  images(p, 60, 180); // trois secondes de fenêtre intermédiaire
  assert.equal(p.n, 2); assert.equal(p.aise, 0);
  assert.equal(images(p, 75, 599), 0); assert.equal(p.n, 2);
  assert.equal(images(p, 75, 1), 1); assert.equal(p.n, 1);
});

// ---------------------------------------------------------------- mode période (cadence d'affichage)
// periode : période de l'écran × diviseur de la cadence, en secondes ; travail : fil principal par image.
const P60 = 1 / 60, LENT = { periode: P60, travail: .012 }, AISE = { periode: P60, travail: .004 };
const proche = (t, attendu) => Math.abs(t - attendu) < 2 * P60;   // à une ou deux images près
// Motif d'intervalles, en périodes, répété pendant duree secondes : rend [instant, niveau avant, niveau après]
// de chaque changement, l'instant étant la somme des intervalles passés.
function periodes(p, motif, duree, options) {
  const changements = [];
  let t = 0;
  for (let i = 0; t < duree - 1e-9; i++) {
    const dt = motif[i % motif.length] * options.periode, avant = p.n;
    t += dt;
    if (Q.avancer(p, dt, options)) changements.push([t, avant, p.n]);
  }
  return changements;
}
// Joue le motif jusqu'au premier changement de niveau, au plus max secondes : rend l'instant, ou Infinity.
function jusqua(p, motif, max, options) {
  let t = 0;
  for (let i = 0; t < max - 1e-9; i++) {
    const dt = motif[i % motif.length] * options.periode;
    t += dt;
    if (Q.avancer(p, dt, options)) return t;
  }
  return Infinity;
}
verifier('période : intervalles réguliers, travail à 70 % de la période ou inconnu, la qualité ne bouge pas', () => {
  for (const travail of [.012, undefined, NaN, -1]) {
    const p = creer(2);
    assert.deepEqual(periodes(p, [1], 60, { periode: P60, travail }), [], 'travail ' + travail);
    assert.equal(p.n, 2);
  }
});
verifier('période : une image ratée sur quatre fait baisser au bout de 3 s, une sur six non', () => {
  // [1, 1, 1, 2] : 1,25 période de moyenne ; [1, 1, 1, 1, 1, 2] : 1,17
  const p = creer(1), c = periodes(p, [1, 1, 1, 2], 10, LENT);
  assert.deepEqual(c.map(x => x.slice(1)), [[1, 2], [2, 3], [3, 4]], 'une baisse par fenêtre de 3 s jusqu’au plafond');
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(c[i][0] - 3 * (i + 1)) < 2 * P60, 'baisse à ' + c[i][0] + ' s');
  assert.deepEqual(periodes(p, [1, 1, 1, 2], 10, LENT), [], 'plafond tenu');
  const q = creer(1);
  assert.deepEqual(periodes(q, [1, 1, 1, 1, 1, 2], 60, LENT), []);
  // la même charge jugée comme avant, sur 60 Hz supposés, ne baisserait pas non plus : 19,4 ms de moyenne
  const r = creer(1);
  for (let i = 0; i < 3600; i++) Q.avancer(r, [1, 1, 1, 1, 1, 2][i % 6] * P60);
  assert.equal(r.n, 1);
});
verifier('période : intervalle de plus de 3 périodes ou de 0,25 s écarté (accroc isolé, reprise)', () => {
  // Comptés, ces intervalles feraient 1,3 et 1,4 période de moyenne.
  const a = creer(1);
  assert.deepEqual(periodes(a, [1, 1, 1, 1, 1, 1, 1, 1, 1, 4], 30, LENT), [], 'quatre périodes à 60 Hz écartées');
  const b = creer(1);
  assert.deepEqual(periodes(b, [1, 1, 1, 1, 3], 30, { periode: .1, travail: .07 }), [], '0,3 s écartées à 10 images par seconde');
  // témoins : trois périodes de 33 ms comptent, et font baisser
  const c = creer(1);
  assert.equal(periodes(c, [1, 1, 1, 1, 3], 4, { periode: 1 / 30, travail: .024 }).length, 1);
  const d = creer(1);
  assert.equal(periodes(d, [1, 1, 1, 3], 4, LENT).length, 1);
});
verifier('période : remontée après 8 s de travail sous la moitié de la période, sans lenteur', () => {
  const p = creer(2), c = periodes(p, [1], 8.5, AISE);
  assert.equal(c.length, 1); assert.deepEqual(c[0].slice(1), [2, 1]);
  assert.ok(Math.abs(c[0][0] - 8) < 2 * P60, 'remontée à ' + c[0][0] + ' s');
  // 7,5 ms de travail sur 16,7 suffisent encore ; 9 ms, plus de la moitié, ne laissent pas de marge
  const q = creer(2);
  assert.ok(proche(jusqua(q, [1], 20, { periode: P60, travail: .0075 }), 8)); assert.equal(q.n, 1);
  assert.deepEqual(periodes(creer(2), [1], 60, { periode: P60, travail: .009 }), []);
  // au plafond, une image ratée sur quatre : le travail est faible, mais la fenêtre n'est pas tenue
  assert.deepEqual(periodes(creer(4), [1, 1, 1, 2], 60, AISE), []);
  // plancher respecté ; abaissé ensuite, il faut huit nouvelles secondes, pas celles passées au plancher
  const r = creer(1);
  assert.deepEqual(periodes(r, [1], 30, Object.assign({ min: 1 }, AISE)), []);
  assert.ok(proche(jusqua(r, [1], 20, AISE), 8)); assert.equal(r.n, 0);
});
verifier('période : un niveau qui a échoué attend 20 s, puis 40 s ; nouvelleSeance efface cette mémoire', () => {
  const p = creer(0);
  let t = jusqua(p, [1, 1, 1, 2], 10, LENT);
  assert.ok(proche(t, 3), 'baisse après ' + t + ' s'); assert.equal(p.n, 1);
  // une pause entre deux (vue inactive) ne rend pas le niveau essayable plus tôt
  assert.equal(Q.avancer(p, 1, { actif: false, periode: P60 }), false);
  t = jusqua(p, [1], 60, AISE);
  assert.ok(proche(t, 20), 'premier retour après ' + t + ' s'); assert.equal(p.n, 0);
  t = jusqua(p, [1, 1, 1, 2], 10, LENT);
  assert.ok(proche(t, 3), 'le niveau échoue de nouveau après ' + t + ' s'); assert.equal(p.n, 1);
  t = jusqua(p, [1], 60, AISE);
  assert.ok(proche(t, 40), 'second retour après ' + t + ' s'); assert.equal(p.n, 0);
  // la mémoire est par niveau : le niveau 1, qui n'a jamais échoué, se retrouve 8 s après le niveau 2
  const q = creer(2);
  assert.ok(proche(jusqua(q, [1, 1, 1, 2], 10, LENT), 3)); assert.equal(q.n, 3);
  const c = periodes(q, [1], 30, AISE);
  assert.deepEqual(c.map(x => x.slice(1)), [[3, 2], [2, 1]]);
  assert.ok(proche(c[0][0], 20) && proche(c[1][0], 28), c.map(x => x[0]).join(' '));
  // un échec du niveau 2 ne raccourcit pas l'attente du niveau 1, qui a échoué deux fois (40 s)
  const u = creer(1);
  jusqua(u, [1, 1, 1, 2], 10, LENT); jusqua(u, [1], 60, AISE);        // échec du niveau 1, retour après 20 s
  jusqua(u, [1, 1, 1, 2], 10, LENT); assert.equal(u.n, 2);             // second échec : 40 s
  assert.ok(proche(jusqua(u, [1, 1, 1, 2], 10, LENT), 3)); assert.equal(u.n, 3);   // échec du niveau 2 : 20 s
  const v = periodes(u, [1], 42, AISE);
  assert.deepEqual(v.map(x => x.slice(1)), [[3, 2], [2, 1]]);
  assert.ok(proche(v[0][0], 20) && proche(v[1][0], 37), 'retours après ' + v.map(x => x[0]).join(' et ') + ' s');
  // nouvelle séance : le niveau atteint est gardé, l'échec oublié
  const r = creer(0);
  jusqua(r, [1, 1, 1, 2], 10, LENT);
  Q.nouvelleSeance(r);
  assert.equal(r.n, 1);
  t = jusqua(r, [1], 60, AISE);
  assert.ok(proche(t, 8), 'après nouvelleSeance : retour après ' + t + ' s'); assert.equal(r.n, 0);
});
verifier('période : à k = 2, deux périodes d’écran par image ne sont pas des images ratées', () => {
  const p = creer(1), q = creer(1);
  for (let i = 0; i < 1800; i++) {
    // 20 ms de travail : plus de la moitié de la cible de 33 ms, ni baisse ni remontée attendue
    Q.avancer(p, 2 * P60, { periode: 2 * P60, travail: .02 });
    Q.avancer(q, 2 * P60, { periode: P60, travail: .02 });
  }
  assert.equal(p.n, 1, 'période visée = écran × diviseur : rien de lent');
  assert.equal(q.n, 4, 'jugés sur la période de l’écran, les mêmes intervalles feraient tout baisser');
});
verifier('période absente : cinq champs et logique d’avant ; période nulle, négative, infinie ou NaN : rien ne compte', () => {
  const avec = creer(0), sans = creer(0);
  for (let i = 0; i < 2000; i++) {
    const dt = i % 3 ? 1 / 49 : 1 / 75;
    assert.equal(Q.avancer(avec, dt, { travail: .001 }), Q.avancer(sans, dt));
  }
  assert.deepEqual(avec, sans, 'travail sans période ignoré');
  assert.deepEqual(Object.keys(sans).sort(), ['aise', 'compte', 'n', 'somme', 't']);
  Q.nouvelleSeance(sans);
  assert.deepEqual(Object.keys(sans).sort(), ['aise', 'compte', 'n', 'somme', 't']);
  for (const periode of [0, -P60, Infinity, NaN, null]) {
    const p = creer(1), avant = { ...p };
    for (let i = 0; i < 600; i++) assert.equal(Q.avancer(p, 1 / 20, { periode, travail: .001 }), false);
    assert.deepEqual(p, avant, 'période ' + periode);
  }
});

// Exécuter les vrais changements d'écran et le vrai gestionnaire de qualité de jeu.js. Le DOM et le renderer
// sont remplacés par leurs frontières minimales ; les transitions et le gouverneur ne sont pas réécrits ici.
// Passer un ancien jeu.js en argument permet de constater la régression avant correction.
const source = readFileSync(process.argv[2] || new URL('../src/jeu.js', import.meta.url), 'utf8');
function bloc(debut, fin) {
  const a = source.indexOf(debut), b = source.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, 'bloc du jeu disponible : ' + debut);
  return source.slice(a, b);
}
const integration = new Function('B', `
  const reglages = { qualite: 'auto' }, redimensions = [], ecouteurs = new Map(), elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { ownerDocument: document, hidden: false, dataset: {}, attributes: {},
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
      setAttribute(n, v) { this.attributes[n] = v; } });
    return elements.get(id);
  };
  const document = { hidden: false, activeElement: null, getElementById: $, querySelectorAll: () => [],
    addEventListener: (nom, f) => ecouteurs.set(nom, f), removeEventListener() {},
    defaultView: { addEventListener() {}, removeEventListener() {}, performance } };
  const rendu = { resize: valeur => redimensions.push(valeur) }, gpuModeste = false, estTactile = true;
  const texte = (element, valeur) => { element.textContent = valeur; }, NOMS_PNEUS = B.pneus.NOMS_PNEUS;
  const session = { type: 'course' }, son = null, hud2 = $('hud2'), pad2 = {}, EL = { role: null };
  const aDeux = () => session.type === 'duo', arreterManettes = () => {}, tactile = () => {};
  const appliquerVolumes = () => {}, remplirReglages = () => {}, sauverReglages = () => {}, appliquerCarte = () => {}, viderStock = () => {}, suspendreAnnoncesVirages = () => {};
  // stockage local et empreinte de la détection : le palier appris est rangé par machine
  const stockage = {}, lireStock = (k, d) => stockage[k] ?? d, ecrireStock = (k, v) => { stockage[k] = JSON.parse(JSON.stringify(v)); };
  let empreinte = 'machine';
  const empreinteDetection = () => empreinte;
  ${bloc('  function majPneusStands(', '  function preselectionnerPneus(')}
  ${bloc('  const palier = ', '  // effets permis par le profil résolu')}
  ${bloc('  function retour()', "  $('r-retour').addEventListener")}
  ${bloc("  let ecran = 'chargement';", "  document.addEventListener('click', e => {")}
  ${bloc("  document.addEventListener('change', e => {", "  for (const nom of ['general', 'moteur', 'effets'])")}
  ecran = 'course';
  return { palier, session, reglages, redimensions, aller, stockage, restaurerPalier, appliquerPalier, appliquerResolutionDifferee,
    set empreinte(v) { empreinte = v; },
    images: (fps, n) => { for (let i = 0; i < n; i++) majPalier(session, 1 / fps); },
    // images de la cadence : intervalle sur la grille, période de l'écran, diviseur et travail du fil principal (s)
    imagesCadence: (intervalle, n, f) => { for (let i = 0; i < n; i++) majPalier(session, intervalle, f); },
    choisir: valeur => ecouteurs.get('change')({ target: { name: 'qualite', value: valeur } }) };
`);

verifier('jeu : 2,9 s lentes puis pause exigent trois nouvelles secondes après reprise', () => {
  const jeu = integration(globalThis.BITUME); jeu.palier.n = 2;
  jeu.images(40, 116); // 2,9 s, sous le seuil de décision
  jeu.aller('pause'); jeu.aller('course');
  assert.equal(jeu.palier.n, 2, 'la pause conserve le niveau choisi');
  jeu.images(40, 119);
  assert.equal(jeu.palier.n, 2, 'aucune décision avec les images antérieures à la pause');
  assert.equal(jeu.redimensions.length, 0, 'la pause ne redimensionne pas le rendu');
  jeu.images(40, 1); assert.equal(jeu.palier.n, 3);
  assert.deepEqual(jeu.redimensions, ['auto']);
});
verifier('jeu : les réglages interrompent aussi une remontée presque acquise', () => {
  const jeu = integration(globalThis.BITUME); jeu.palier.n = 2;
  jeu.images(75, 590);
  jeu.aller('reglages'); jeu.aller('course');
  jeu.images(75, 599); assert.equal(jeu.palier.n, 2);
  jeu.images(75, 1); assert.equal(jeu.palier.n, 1);
});
verifier('jeu : un choix manuel de qualité efface la charge précédente', () => {
  const jeu = integration(globalThis.BITUME);
  jeu.images(40, 116); jeu.choisir('high'); jeu.choisir('auto');
  // Fine rend le ratio décidé par src/graphismes.js (borné par devicePixelRatio), Auto rend la main au
  // gouverneur du moteur : c'est lui qui tient les 1 800 000 pixels, plus le profil qui décide du reste.
  assert.equal(typeof jeu.redimensions[0], 'number', 'un choix nommé rend un ratio, pas un nom');
  assert.ok(jeu.redimensions[0] >= .5 && jeu.redimensions[0] <= 2, 'ratio dans les bornes du moteur');
  assert.deepEqual(jeu.redimensions.slice(1), ['auto']);
  jeu.images(40, 119); assert.equal(jeu.palier.n, 0);
  jeu.images(40, 1); assert.equal(jeu.palier.n, 1);
});
verifier('jeu : pause/reprise ne force ni qualité fixe ni banc ni référence', () => {
  for (const options of [{ qualite: 'high' }, { banc: {} }, { reference: {} }]) {
    const jeu = integration(globalThis.BITUME); jeu.palier.n = 2;
    if (options.qualite) jeu.reglages.qualite = options.qualite;
    if (options.banc) jeu.session.banc = options.banc;
    if (options.reference) jeu.session.reference = options.reference;
    jeu.aller('pause'); jeu.aller('course'); jeu.images(10, 100);
    assert.equal(jeu.palier.n, 2); assert.equal(jeu.redimensions.length, 0);
  }
});
// La boucle donne à majPalier l'image de la cadence (période de l'écran, diviseur, travail du fil principal).
verifier('jeu : avec la cadence, les seuils suivent la période visée et non 60 Hz', () => {
  const ancien = integration(globalThis.BITUME); ancien.palier.n = 1;
  ancien.images(30, 100);
  assert.equal(ancien.palier.n, 2, 'sans période, 30 images par seconde passaient pour une machine lente');
  const ecran30 = integration(globalThis.BITUME); ecran30.palier.n = 1;
  ecran30.imagesCadence(1 / 30, 300, { periode: 1 / 30, diviseur: 1, travail: .004 });
  assert.equal(ecran30.palier.n, 0, 'écran à 30 Hz tenu avec de la marge : la qualité remonte');
  const rate = integration(globalThis.BITUME); rate.palier.n = 1;
  rate.imagesCadence(2 / 60, 100, { periode: 1 / 60, diviseur: 1, travail: .02 });
  assert.equal(rate.palier.n, 2, 'écran à 60 Hz, une image sur deux ratée : la qualité baisse');
  const divise = integration(globalThis.BITUME); divise.palier.n = 1;
  divise.imagesCadence(2 / 60, 100, { periode: 1 / 60, diviseur: 2, travail: .02 });
  assert.equal(divise.palier.n, 1, 'diviseur 2 : deux périodes par image sont la cadence visée');
});
verifier('jeu : en pleine conduite, la résolution du palier 4 attend un arrêt ; les autres paliers suivent à l’image', () => {
  const jeu = integration(globalThis.BITUME);
  jeu.appliquerPalier(); assert.deepEqual(jeu.redimensions, ['auto']);
  jeu.session.course = { phase: 'course', termine: false, voitures: [] };
  jeu.palier.n = 2; jeu.images(40, 120);
  assert.equal(jeu.palier.n, 3); assert.deepEqual(jeu.redimensions, ['auto', 'auto'], 'palier 3 : même résolution, appliqué');
  jeu.images(40, 120);
  assert.equal(jeu.palier.n, 4);
  assert.deepEqual(jeu.redimensions, ['auto', 'auto'], 'aucune nouvelle taille d’image en roulant');
  jeu.appliquerResolutionDifferee(jeu.session);
  assert.equal(jeu.redimensions.length, 2, 'toujours en conduite');
  jeu.aller('pause'); jeu.appliquerResolutionDifferee(jeu.session);
  assert.deepEqual(jeu.redimensions, ['auto', 'auto', .75], 'la pause est un arrêt');
  jeu.appliquerResolutionDifferee(jeu.session);
  assert.equal(jeu.redimensions.length, 3, 'appliquée une seule fois');
  const grille = integration(globalThis.BITUME); grille.appliquerPalier();
  grille.session.course = { phase: 'grille', termine: false, voitures: [] }; grille.palier.n = 3; grille.images(40, 120);
  assert.equal(grille.palier.n, 4); assert.deepEqual(grille.redimensions, ['auto', .75], 'sur la grille, personne ne conduit');
});
verifier('jeu : le palier appris est rangé par machine et repris au démarrage', () => {
  const jeu = integration(globalThis.BITUME); jeu.palier.n = 1;
  jeu.images(40, 120);
  assert.equal(jeu.palier.n, 2); assert.deepEqual(jeu.stockage['bitume.palier.v1'], { empreinte: 'machine', n: 2 });
  const suivant = integration(globalThis.BITUME); Object.assign(suivant.stockage, jeu.stockage);
  assert.equal(suivant.restaurerPalier(), true); assert.equal(suivant.palier.n, 2);
  const ailleurs = integration(globalThis.BITUME); Object.assign(ailleurs.stockage, jeu.stockage); ailleurs.empreinte = 'autre écran';
  assert.equal(ailleurs.restaurerPalier(), false); assert.equal(ailleurs.palier.n, 0);
  const fixe = integration(globalThis.BITUME); Object.assign(fixe.stockage, jeu.stockage); fixe.reglages.qualite = 'high';
  assert.equal(fixe.restaurerPalier(), false);
  const abime = integration(globalThis.BITUME); abime.stockage['bitume.palier.v1'] = { empreinte: 'machine', n: 'deux' };
  assert.equal(abime.restaurerPalier(), false);
  const borne = integration(globalThis.BITUME); borne.stockage['bitume.palier.v1'] = { empreinte: 'machine', n: 9 };
  assert.equal(borne.restaurerPalier(), true); assert.equal(borne.palier.n, 4, 'borné au dernier palier');
  const banc = integration(globalThis.BITUME); banc.session.banc = {}; banc.palier.n = 1; banc.images(10, 100);
  assert.equal(banc.stockage['bitume.palier.v1'], undefined, 'un banc ne réécrit pas la mémoire');
});
console.log(`qualité : ${controles} contrôles passés`);
