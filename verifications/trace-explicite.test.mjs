import { generateurHistorique } from './helpers/generateur-historique.mjs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

createRequire(import.meta.url)('../src/circuit.js');
const C = globalThis.BITUME.circuit;
let controles = 0;
function verifier(nom, f) { f(); controles++; console.log('ok  ' + nom); }
const proche = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≠ ${b} (±${tolerance})`);
const angle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function point(x, z, y = 0) { return { x, y, z, largeurG: 4, largeurD: 5 }; }
function rectangle(w = 1000, h = 668.5, profil = (x, z) => point(x, z)) {
  return { unite: 'm', points: [[0, 0], [w, 0], [w, h], [0, h], [0, 0]].map(([x, z]) => profil(x, z)) };
}
// Oracle analytique indépendant : parcours d'un rectangle dans son ordre, sans utiliser les segments du constructeur.
function surRectangle(s, w, h) {
  if (s <= w) return [s, 0];
  if (s <= w + h) return [w, s - w];
  if (s <= 2 * w + h) return [2 * w + h - s, h];
  return [0, 2 * (w + h) - s];
}

verifier('3337 m conservés sans arrondi ni déformation ; grille uniforme propre au tracé', () => {
  const entree = rectangle(), c = C.creerDepuisTrace(entree);
  assert.equal(c.longueur, 3337);
  assert.equal(c.n, 1669);
  assert.equal(c.pas, 3337 / 1669);
  assert.notEqual(c.pas, C.PAS);
  assert.equal(c.pretPourCourse, false);
  assert.equal(c.largeur, undefined); // aucune moyenne trompeuse pour les consommateurs à largeur fixe
  assert.equal(c.ligne, undefined);
  assert.equal(c.vitesse, undefined);
  assert.equal(c.stands, undefined);
  assert.deepEqual(C.valider(c), []);
  for (let i = 0; i < c.n; i++) {
    const [x, z] = surRectangle(i * 3337 / c.n, 1000, 668.5);
    proche(c.x[i], x); proche(c.z[i], z); proche(c.y[i], 0);
  }
  for (let i = 0; i < entree.points.length; i++) {
    const p = entree.points[i], q = c.sourceTrace[i];
    assert.deepEqual([q.x, q.y, q.z], [p.x, p.y, p.z]);
  }
  assert.deepEqual([...c.abscissesSource], [0, 1000, 1668.5, 2668.5, 3337]);
});

verifier('distances en plan, pente de 12 %, dévers et bords asymétriques interpolés en mètres', () => {
  const devers = .04;
  const profil = (x, z) => ({ x, y: 40 + .12 * x, z, largeurG: 3 + x / 1000,
    largeurD: 4 + x / 500, limiteG: 6 + x / 1000, limiteD: 7 + x / 500, devers });
  const donnees = rectangle(1000, 668.5, profil);
  donnees.pasMax = 7;
  // Les relevés peuvent avoir des espacements très différents sans changer l'abscisse métrique.
  donnees.points.splice(1, 0, ...[17, 93, 400, 801].map(x => profil(x, 0)));
  const c = C.creerDepuisTrace(donnees), s = 123.456;
  assert.equal(c.longueur, 3337); // le relief ne rallonge pas l'abscisse planimétrique
  const e = C.echantillon(c, s), reutilise = { extra: 'gardé' };
  assert.equal(C.echantillon(c, s, reutilise), reutilise);
  proche(e.x, s); proche(e.z, 0); proche(e.y, 40 + .12 * s);
  proche(e.cap, 0); proche(e.courbure, 0); proche(e.pente, .12); proche(e.devers, devers);
  proche(C.largeurA(c, s, -1), 3 + s / 1000);
  proche(C.largeurA(c, s, 1), 4 + s / 500);
  proche(C.limiteA(c, s, -1), 6 + s / 1000);
  proche(C.limiteA(c, s, 1), 7 + s / 500);
  assert.equal(reutilise.extra, 'gardé');
  assert.deepEqual(C.valider(c), []); // aucune contrainte héritée de 7 % ou rayon de 24 m
  const p = C.point(c, s, 2, 0);
  proche(p[0], s); proche(p[1], e.y - 2 * Math.sin(devers)); proche(p[2], 2);
  const r = C.repere(c, s), dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
  for (const v of [r.t, r.r, r.n]) proche(dot(v, v), 1);
  proche(dot(r.t, r.r), 0); proche(dot(r.t, r.n), 0); proche(dot(r.r, r.n), 0);
  assert.equal(C.vibreurA(c, s, 1), false);
});

function cercle(sens = 1, rayon = 40, hauteur = 8) {
  const m = 4096, points = [];
  for (let i = 0; i < m; i++) {
    const a = sens * 2 * Math.PI * i / m;
    points.push(point(rayon * Math.cos(a), rayon * Math.sin(a), hauteur * Math.sin(a)));
  }
  points.push({ ...points[0] });
  return { unite: 'm', points, pasMax: .5 };
}
for (const sens of [1, -1]) verifier(`cercle analytique, sens ${sens} : cap, courbure et pente, y compris à la couture`, () => {
  const c = C.creerDepuisTrace(cercle(sens));
  proche(c.longueur, 2 * 4096 * 40 * Math.sin(Math.PI / 4096), 1e-9);
  for (let i = 0; i < c.n; i++) {
    const a = sens * 2 * Math.PI * i / c.n;
    proche(c.x[i], 40 * Math.cos(a), 1.3e-5);
    proche(c.z[i], 40 * Math.sin(a), 1.3e-5);
    proche(c.y[i], 8 * Math.sin(a), 3e-6);
    proche(angle(c.cap[i], a + sens * Math.PI / 2), 0, 2e-5);
    proche(c.courbure[i], sens / 40, 3e-5);
    proche(c.pente[i], sens * .2 * Math.cos(a), 1e-5);
  }
  for (const s of [0, .015, c.longueur - .015, c.longueur / 2]) {
    const a = C.echantillon(c, s), b = C.echantillon(c, s + c.longueur), d = C.echantillon(c, s - c.longueur);
    for (const k of ['x', 'y', 'z', 'courbure', 'pente', 'devers', 'largeurG', 'largeurD']) { proche(a[k], b[k]); proche(a[k], d[k]); }
    proche(angle(a.cap, b.cap), 0); proche(angle(a.cap, d.cap), 0);
  }
  const avant = C.echantillon(c, -.001), apres = C.echantillon(c, .001);
  assert.ok(Math.hypot(apres.x - avant.x, apres.z - avant.z) < .00201);
  assert.ok(Math.abs(angle(apres.cap, avant.cap)) < .000051);
});

verifier('rayon serré explicite accepté sans les restrictions du générateur original', () => {
  const c = C.creerDepuisTrace(cercle(1, 8, 0));
  assert.deepEqual(C.valider(c), []);
  assert.ok(c.courbure.every(k => k > 1 / 24));
});

verifier('les données fournies restent intactes et indépendantes de la copie de travail', () => {
  const entree = rectangle(), avant = JSON.stringify(entree);
  const c = C.creerDepuisTrace(entree), bis = C.creerDepuisTrace(entree);
  assert.equal(JSON.stringify(entree), avant);
  for (const champ of ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'largeurG', 'largeurD']) assert.deepEqual(c[champ], bis[champ]);
  entree.points[1].x = -99;
  assert.equal(c.sourceTrace[1].x, 1000);
  assert.equal(c.x[1], c.pas);
});

verifier('translation du repère sans effet sur longueurs, caps et profils', () => {
  const a = rectangle(100, 70), b = structuredClone(a);
  for (const p of b.points) { p.x += 13000; p.y += 240; p.z -= 9000; }
  const ca = C.creerDepuisTrace(a), cb = C.creerDepuisTrace(b);
  assert.equal(ca.longueur, cb.longueur); assert.equal(ca.pas, cb.pas);
  for (let i = 0; i < ca.n; i++) {
    proche(cb.x[i] - ca.x[i], 13000); proche(cb.y[i] - ca.y[i], 240); proche(cb.z[i] - ca.z[i], -9000);
    proche(angle(cb.cap[i], ca.cap[i]), 0); proche(cb.courbure[i], ca.courbure[i]); proche(cb.pente[i], ca.pente[i]);
  }
});

const rejets = [
  ['unité absente', d => delete d.unite, /unité/],
  ['degrés géographiques refusés', d => d.unite = 'deg', /unité/],
  ['point manquant', d => d.points[1] = null, /point 1/],
  ['coordonnée non finie', d => d.points[1].x = NaN, /non finis/],
  ['coordonnée texte', d => d.points[1].y = '0', /non finis/],
  ['fermeture géométrique manquante', d => d.points.pop(), /boucle non fermée/],
  ['discontinuité de largeur à la fermeture', d => d.points.at(-1).largeurG = 9, /boucle non fermée/],
  ['discontinuité d’altitude à la fermeture', d => d.points.at(-1).y = .01, /boucle non fermée/],
  ['segment nul', d => d.points.splice(1, 0, { ...d.points[0] }), /segment 0 nul/],
  ['segment vertical sans abscisse', d => d.points.splice(1, 0, { ...d.points[0], y: 5 }), /vertical/],
  ['largeur négative', d => d.points[1].largeurD = -1, /largeurs positives/],
  ['mur à l’intérieur de la chaussée', d => d.points[1].limiteG = 1, /limites au-delà/],
  ['dévers vertical', d => d.points[1].devers = Math.PI / 2, /dévers/],
  ['résolution nulle', d => d.pasMax = 0, /pasMax/],
  ['résolution infinie', d => d.pasMax = Infinity, /pasMax/],
  ['résolution démesurée', d => d.pasMax = 1e-10, /250 000 échantillons/],
  ['demi-tour ponctuel', d => d.points.splice(2, 0, point(900, 0)), /demi-tour/],
  ['longueur non finie', d => { d.points[1].x = 1e308; d.points[2].x = -1e308; }, /non fini/],
];
for (const [nom, changer, motif] of rejets) verifier('rejet explicite : ' + nom, () => {
  const d = rectangle(); changer(d); assert.throws(() => C.creerDepuisTrace(d), motif);
});

verifier('validation géométrique détecte les données corrompues sans imposer les règles des anciens circuits', () => {
  const c = C.creerDepuisTrace(rectangle());
  c.pente[12] = NaN;
  assert.ok(C.valider(c).some(x => /non finies/.test(x)));
  c.pente[12] = 0; c.limiteG[12] = -1;
  assert.ok(C.valider(c).some(x => /profil/.test(x)));
});

// Empreintes capturées AVANT modification sur src/circuit.js de 0.2.59, commit
// 891efb10d19f89b0b367f4d46ad82ea81d788690 : toutes les propriétés du circuit et les lectures
// aux abscisses négatives/fractionnaires/à la couture. Ce sont des oracles gelés, jamais régénérés par ce test.
const historiques = [
  [11, 'foret', 4200, '7ec18af3b04af7f7958736d26e5b31f2c3557147a15f8df8e3269a3e25ee006f'],
  [29, 'cote', 3600, '9dc1e60373aadfcb09a482a5a1b2effbcfd5a6bba7aec6fe4f6c656b51ab0377'],
  [47, 'montagne', 5200, 'd4688c7ab7b4034c51bccf626f0358444511b2a2a0307c659d1d9a77441376aa'],
  [83, 'islande', 4600, '6b64ec1e1df56cdbf110c3e4285d515ad67b21a819a46478161b21ac45fe64dc'],
  [107, 'desert', 4800, 'cff94b337097b32e87a5aceb8811a0969429dbe1731dafe6c52055334b33e481'],
  [131, 'asie', 5000, 'e8dc9af69530235bfc0658e3a73a9042873de2c2c6bc5ce8bbe090b86d4427c7'],
  [157, 'pacifique', 5200, '08ad95d862545741a5271699362ffbe4dbe47db7723cc107998a918f7c5be15d'],
  [179, 'baikal', 5400, '899070e99ecdb30c2ed8ae93206d27293e285a0994981f33af168cbb8f157fea'],
];
function empreinteComplete(C, c) {
  const h = createHash('sha256');
  for (const cle of Object.keys(c).sort()) {
    h.update(cle);
    const v = c[cle];
    h.update(ArrayBuffer.isView(v) ? Buffer.from(v.buffer, v.byteOffset, v.byteLength) : JSON.stringify(v));
  }
  for (const s of [-7.25, -.3, 0, .5, 17.875, c.longueur - 1.25, c.longueur, c.longueur * 2 + 2.75]) {
    h.update(JSON.stringify([C.echantillon(c, s), C.echantillon(c, s, {}), C.point(c, s, 1.25, .3), C.repere(c, s),
      C.limiteA(c, s, -1), C.limiteA(c, s, 1), C.vibreurA(c, s, -1), C.vibreurA(c, s, 1)]));
  }
  return h.digest('hex');
}
const avantTrace = generateurHistorique('0259');
for (const [graine, theme, longueur, attendu] of historiques) verifier('identité complète 0.2.59 : ' + theme, () => {
  const options = { theme, longueur }, c = C.creer(graine, options);
  const reference = empreinteComplete(avantTrace, avantTrace.creer(graine, options));
  if (process.platform === 'linux' && process.arch === 'x64') assert.equal(reference, attendu);
  assert.equal(empreinteComplete(C, c), reference);
  for (const s of [-7.25, -.3, 0, .5, 17.875, c.longueur - 1.25, c.longueur, c.longueur * 2 + 2.75])
    for (const cote of [-1, 1]) assert.equal(C.largeurA(c, s, cote), c.largeur / 2);
});
console.log(`${controles}/${controles} contrôles de fondation tracé explicite et identité historique`);
