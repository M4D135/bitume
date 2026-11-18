// Ombres photo (src/ombres.js, lot 21 étape 1, option ombresPhoto de FERRO 0.3.11) : ce que le jeu donne au moteur à
// chaque vue. Contact des voitures proches (boîtes de 24 nombres dans l'ordre lu par le shader, axes de la caisse comme
// src/voiture.js, choix sans saut), tuile de la voiture filmée, pénombre et réglages selon le palier, journal du
// gouverneur, carte lointaine au chargement ; et aucune allocation à l'image (mesure de effets-allocation.test.mjs).
// Processus à part, la mesure d'allocation d'abord : les essais suivants donnent à preparer des formes que le jeu ne
// lui donne jamais.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import inspector from 'node:inspector';
import path from 'node:path';
import v8 from 'node:v8';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));
for (const f of ['carene.js', 'main.js', 'voiture.js', 'ombres.js']) charger(f);
const B = globalThis.BITUME, O = B.ombres, V = B.voiture;

let compte = 0;
async function verifier(nom, f) {
  try { await f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`KO  ${nom}`); console.error(e); process.exit(1); }
}

// ---------------------------------------------------------------- mesure d'allocation (reprise de effets-allocation)
const pause = ms => new Promise(r => setTimeout(r, ms));
const codeMachine = () => v8.getHeapCodeStatistics().code_and_metadata_size;
function ramasser() { const s = new inspector.Session(); s.connect(); s.post('HeapProfiler.collectGarbage'); s.disconnect(); }
async function profil(f, args) {
  await pause(40);
  const session = new inspector.Session(); session.connect();
  let p = null, code = 0;
  const code0 = codeMachine();
  session.post('HeapProfiler.startSampling', { samplingInterval: 32, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  try { f(...args); code = codeMachine() - code0; }
  finally { session.post('HeapProfiler.stopSampling', (e, r) => { p = r && r.profile; }); session.disconnect(); }
  const lieux = {};
  let octets = 0;
  const visiter = (n, parent) => {
    const lieu = n.callFrame.url ? n.callFrame : parent;
    const nom = `${path.basename(lieu.url)}:${lieu.functionName || '(anonyme)'}:${lieu.lineNumber + 1}`;
    if (n.selfSize) { octets += n.selfSize; const l = lieux[nom] || (lieux[nom] = { octets: 0 }); l.octets += n.selfSize; }
    for (const e of n.children) visiter(e, lieu);
  };
  (function chercher(n) {
    if (n.callFrame.functionName === f.name && n.callFrame.url === import.meta.url) visiter(n, n.callFrame);
    else for (const e of n.children) chercher(e);
  })(p.head);
  return { octets, lieux, code };
}
async function octetsAlloues({ chauffe, rodage, prete }, f) {
  let r = null;
  for (let essai = 1; essai <= 5; essai++) {
    ramasser(); chauffe();
    for (let stables = 0, k = 0; stables < 2 && k < 30; k++) {
      const c0 = codeMachine(); rodage(); await pause(15);
      stables = codeMachine() === c0 ? stables + 1 : 0;
    }
    r = await profil(f, prete());
    r.essais = essai;
    if (!r.code) return r;
  }
  assert.fail('du code est compilé ou jeté pendant chacune des cinq mesures : ' + JSON.stringify(r.lieux) + ', code ' + r.code);
}
const chauffer = (f, ...args) => { for (let t = 0; t < 10; t++) f(...args); };

// ---------------------------------------------------------------- scène d'essai
// Caméra à l'origine (à hauteur du sol : les distances sont celles du plan), regard vers −z (lacet 0) ; poses au sol
// comme celles du jeu (x, y, z, cap, tangage, roulis).
const FINE = { palier: 'high', effets: { ombres: true } }, MOYENNE = { palier: 'medium', effets: { ombres: true } },
  LEGERE = { palier: 'low', effets: { ombres: false } };
const camera = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, fov: 60 });
const pose = (x, z, cap = 0, tangage = 0, roulis = 0, y = 0) => ({ x, y, z, cap, tangage, roulis });
const devant = d => pose(0, -d);
// Force donnée à chaque voiture (0 si elle n'a pas de place) : la voiture d'une boîte est retrouvée par son centre.
function forces(etat, poses) {
  const b = etat.contacts.boites, f = poses.map(() => 0);
  for (let i = 0; i < etat.contacts.nombre; i++) {
    const o = i * 24;
    let best = -1, bd = Infinity;
    poses.forEach((p, k) => { const d = Math.hypot(b[o] - p.x, b[o + 2] - p.z); if (d < bd) { bd = d; best = k; } });
    assert.ok(bd < .2, 'boîte sans voiture');
    f[best] = b[o + 3];
  }
  return f;
}

await verifier('preparer : une image sans allocation (douze voitures en mouvement, trois paliers, journal)', async () => {
  const etat = O.creer(), cam = camera(), n = 12, poses = [];
  for (let k = 0; k < n; k++) poses.push(pose(.5, .5, .5, .01, .02, .5));
  // instants et niveaux tirés de tables déjà en boîte (null garde des cases quelconques) : l'essai ne passe aucun
  // nombre à virgule calculé
  const INSTANTS = Array.from({ length: 64 }, (_, j) => 10.5 + j / 60).concat([null]);
  const PROFILS = [FINE, FINE, MOYENNE, LEGERE], NIVEAUX = [3, 3, 2, 0];
  const compteurs = new Int32Array(1);
  const image = () => {
    const j = compteurs[0]++, a0 = j * .013;
    for (let k = 0; k < n; k++) { const p = poses[k], a = a0 + k * .52, r = 8 + k * 6; p.x = r * Math.cos(a); p.z = r * Math.sin(a); p.cap = a + 1.5; }
    const m = (j >> 7) & 3;
    O.preparer(etat, PROFILS[m], cam, poses, n, 2, 40, 61, NIVEAUX[m], INSTANTS[j & 63]);
  };
  const fenetre = k => { for (let i = 0; i < k; i++) image(); };
  for (let i = 0; i < 20000; i++) image();
  const { octets, lieux, essais } = await octetsAlloues({ chauffe: () => chauffer(fenetre, 2000), rodage: () => fenetre(256), prete: () => [2048] }, fenetre);
  assert.ok(etat.contacts.nombre > 0 && O.journal(etat).changements > 10, 'la mesure a fait le vrai travail');
  assert.equal(octets, 0, 'octets alloués pendant la mesure : ' + JSON.stringify(lieux));
  const temoin = await octetsAlloues({ chauffe: () => chauffer(() => O.journal(etat)), rodage: () => O.journal(etat), prete: () => [etat] }, function lire(e) { for (let i = 0; i < 20; i++) O.journal(e); });
  assert.ok(temoin.octets > 0, 'témoin : journal() alloue ses lignes, la mesure doit le voir');
  console.log(`    0 octet alloué en 2 048 images (mesure ${essais}/5) ; témoin journal() : ${temoin.octets} octets`);
});

await verifier('axes : avant et haut de la caisse comme B.voiture.attitude (cap, tangage, roulis)', async () => {
  const A = new Float64Array(6);
  let graine = 7;
  const hasard = () => { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; return graine / 4294967296; };
  for (let i = 0; i < 500; i++) {
    const h = (hasard() - .5) * 14, p = (hasard() - .5) * .6, q = (hasard() - .5) * .6;
    O.axes(A, { cap: h, tangage: p, roulis: q });
    const M = V.attitude(h, p, q);
    for (let c = 0; c < 3; c++) {
      assert.ok(Math.abs(A[c] - M[0][c]) < 1e-12, 'avant ' + c);
      assert.ok(Math.abs(A[3 + c] - M[1][c]) < 1e-12, 'haut ' + c);
    }
  }
  O.axes(A, {});                                                     // pose sans angles : la voiture à plat, cap 0
  assert.deepEqual(Array.from(A), [1, 0, 0, -0, 1, 0]);
});

await verifier('boîte : centre, axes et cotes de la caisse et des roues dans l\'ordre lu par FERRO', async () => {
  const etat = O.creer(), h = .7, t = .05, q = -.03, p = pose(3, -12, h, t, q, 1.5);
  O.preparer(etat, FINE, camera(), [p], 1, -1, 0, 0, -1, 0);
  const b = etat.contacts.boites, M = V.attitude(h, t, q), F = M[0], U = M[1], R = V.ROUES, X = -.10, Y = .38;
  const proche = (a, e, m) => assert.ok(Math.abs(a - e) < 1e-5, m + ' : ' + a + ' au lieu de ' + e);
  assert.equal(etat.contacts.nombre, 1);
  for (let c = 0; c < 3; c++) {
    proche(b[c], [p.x, p.y, p.z][c] + F[c] * X + U[c] * Y, 'centre ' + c);
    proche(b[4 + c], F[c], 'avant ' + c); proche(b[8 + c], U[c], 'haut ' + c);
  }
  proche(b[3], 1, 'force à 12 m'); proche(b[7], 2.10, 'demi-longueur'); proche(b[11], .34, 'demi-hauteur');
  proche(b[12], .63, 'demi-largeur'); proche(b[13], .38, 'hauteur du centre');
  proche(b[14], R[0].x - X, 'essieu avant'); proche(b[15], R[2].x - X, 'essieu arrière');
  proche(b[16], R[0].r, 'rayon avant'); proche(b[17], Math.abs(R[0].z), 'demi-voie avant'); proche(b[18], R[0].l / 2, 'demi-largeur avant');
  proche(b[20], R[2].r, 'rayon arrière'); proche(b[21], Math.abs(R[2].z), 'demi-voie arrière'); proche(b[22], R[2].l / 2, 'demi-largeur arrière');
  assert.equal(b[19], 0); assert.equal(b[23], 0);
});

await verifier('choix : six places (quatre en Légère), portée 60 m, voitures de derrière après celles de devant', async () => {
  const etat = O.creer(), cam = camera();
  const poses = [10, 15, 20, 25, 30, 35, 40].map(devant);
  O.preparer(etat, FINE, cam, poses, poses.length, -1, 0, 0, -1, 0);
  let f = forces(etat, poses);
  assert.equal(etat.contacts.nombre, 6);
  assert.deepEqual(f.slice(0, 5), [1, 1, 1, 1, 1]);
  assert.ok(Math.abs(f[5] - 5 / 6) < 1e-6, 'sixième place selon l\'écart avec la septième (5 m sur 6) : ' + f[5]);
  assert.equal(f[6], 0);
  O.preparer(etat, LEGERE, cam, poses, poses.length, -1, 0, 0, -1, 0);
  f = forces(etat, poses);
  assert.equal(etat.contacts.nombre, 4);
  assert.ok(Math.abs(f[3] - 5 / 6) < 1e-6 && f[4] === 0, 'Légère : quatre places');
  // portée : entière jusqu'à 45 m, moitié à 52,5 m, rien à 60 m et au-delà
  O.preparer(etat, FINE, cam, [devant(44), devant(52.5), devant(60), devant(80)], 4, -1, 0, 0, -1, 0);
  f = forces(etat, [devant(44), devant(52.5), devant(60), devant(80)]);
  assert.ok(f[0] === 1 && Math.abs(f[1] - .5) < 1e-6 && f[2] === 0 && f[3] === 0, JSON.stringify(f));
  // derrière la caméra à 20 m : 30 m de pénalité, après une voiture de devant à 45 m (Légère : quatre places pour cinq)
  const mixte = [devant(10), devant(20), devant(30), devant(45), pose(0, 20)];
  O.preparer(etat, LEGERE, cam, mixte, 5, -1, 0, 0, -1, 0);
  f = forces(etat, mixte);
  assert.ok(f[3] > 0 && f[4] === 0, 'la voiture de derrière passe après celle de devant : ' + JSON.stringify(f));
  // poses invalides ignorées
  O.preparer(etat, FINE, cam, [pose(NaN, 0), null, devant(12)], 3, -1, 0, 0, -1, 0);
  assert.equal(etat.contacts.nombre, 1);
  // réglage : contact coupé en Légère, gardé ailleurs
  try {
    O.reglages.contactLegere = false;
    O.preparer(etat, LEGERE, cam, poses, poses.length, -1, 0, 0, -1, 0); assert.equal(etat.contacts.nombre, 0, 'Légère sans contact');
    O.preparer(etat, MOYENNE, cam, poses, poses.length, -1, 0, 0, -1, 0); assert.equal(etat.contacts.nombre, 6);
  } finally { O.reglages.contactLegere = true; }
});

await verifier('continuité : aucune force ne saute quand une voiture double, sort de portée ou passe derrière la caméra', async () => {
  const etat = O.creer(), cam = camera();
  const pire = (P, poses, bouger, pas) => {
    let avant = null, max = 0;
    for (let i = 0; i <= pas; i++) {
      bouger(poses, i / pas);
      O.preparer(etat, P, cam, poses, poses.length, -1, 0, 0, -1, 0);
      const f = forces(etat, poses);
      if (avant) for (let k = 0; k < f.length; k++) max = Math.max(max, Math.abs(f[k] - avant[k]));
      avant = f;
    }
    return max;
  };
  // une septième voiture, 2 m à côté de la file, double les deux dernières (26 et 30 m) en passant de 36 à 20 m
  const sept = [10, 14, 18, 22, 26, 30].map(devant).concat([pose(2, -36)]);
  const m1 = pire(FINE, sept, (p, u) => { p[6].z = -(36 - 16 * u); }, 1600);
  assert.ok(m1 < .005, 'dépassement aux dernières places : saut de ' + m1);
  // une voiture seule s'éloigne de 40 à 70 m
  const m2 = pire(FINE, [devant(40)], (p, u) => { p[0].z = -(40 + 30 * u); }, 3000);
  assert.ok(m2 < .005, 'sortie de portée : saut de ' + m2);
  // Légère, quatre voitures devant (12 à 33 m), une cinquième tourne autour de la caméra à 18 m, par pas de 6 mm : la
  // pénalité de derrière monte vite entre 90° et 120° du regard (hors champ), sans saut (au plus 90 m de score par
  // radian, soit 0,005 de force par pas)
  const tour = [12, 19, 26, 33].map(devant).concat([pose(0, -18)]);
  const m3 = pire(LEGERE, tour, (p, u) => { const a = u * Math.PI * 2; p[4].x = 18 * Math.sin(a); p[4].z = -18 * Math.cos(a); }, 20000);
  assert.ok(m3 < .005, 'voiture qui passe derrière la caméra : saut de ' + m3);
});

await verifier('paliers : réglages du contact, tuile et pénombre (Fine, Moyenne, Légère)', async () => {
  const etat = O.creer(), cam = camera(), poses = [devant(8), devant(14)];
  const c = etat.contacts;
  O.preparer(etat, LEGERE, cam, poses, 2, 0, 3, 9, 0, 0);
  assert.deepEqual([c.ambiance, c.soleil, c.exposant, c.marge], [.85, .85, 1, 1.6]);
  assert.equal(etat.ombreProche, null, 'Légère : pas de tuile sans ombres');
  assert.equal(etat.penombre, null);
  O.preparer(etat, MOYENNE, cam, poses, 2, 0, 3, 9, 1, 0);
  assert.deepEqual([c.ambiance, c.soleil, c.exposant, c.marge], [.85, .6, 4, 1.6]);
  assert.ok(etat.ombreProche, 'Moyenne : tuile');
  assert.equal(etat.penombre, 'meteo');
  O.preparer(etat, FINE, cam, poses, 2, 0, 3, 9, 2, 0);
  assert.equal(etat.penombre, O.reglages.pcssFine ? 'pcss' : 'meteo');
  const garde = O.reglages.pcssFine;
  try {
    O.reglages.pcssFine = false; O.preparer(etat, FINE, cam, poses, 2, 0, 3, 9, 2, 0); assert.equal(etat.penombre, 'meteo');
    O.reglages.pcssFine = true; O.preparer(etat, FINE, cam, poses, 2, 0, 3, 9, 2, 0); assert.equal(etat.penombre, 'pcss');
  } finally { O.reglages.pcssFine = garde; }
  // mêmes objets d'une image à l'autre : le moteur ne reçoit jamais de tableau neuf
  const boites = c.boites, proche = etat.ombreProche;
  O.preparer(etat, FINE, cam, poses, 2, 0, 3, 9, 2, 0);
  assert.ok(etat.contacts.boites === boites && etat.ombreProche === proche);
});

await verifier('tuile : milieu de la caisse à 45 cm, axe avant de la voiture filmée, intervalle de ses objets', async () => {
  const etat = O.creer(), cam = camera(), h = 2.2, t = .04, q = .02, poses = [devant(30), pose(4, -9, h, t, q, 2)];
  O.preparer(etat, FINE, cam, poses, 2, 1, 17, 52, -1, 0);
  const o = etat.ombreProche, M = V.attitude(h, t, q), F = M[0], U = M[1], p = poses[1];
  assert.ok(o && o.debut === 17 && o.fin === 52 && o.etendue === O.TUILE);
  for (let c = 0; c < 3; c++) {
    assert.ok(Math.abs(o.centre[c] - ([p.x, p.y, p.z][c] - .10 * F[c] + .45 * U[c])) < 1e-9, 'centre ' + c);
    assert.ok(Math.abs(o.axe[c] - F[c]) < 1e-12, 'axe ' + c);
  }
  O.preparer(etat, FINE, cam, poses, 2, 1, 20, 20, -1, 0); assert.equal(etat.ombreProche, null, 'intervalle vide');
  O.preparer(etat, FINE, cam, poses, 2, -1, 0, 9, -1, 0); assert.equal(etat.ombreProche, null, 'pas de voiture filmée');
  O.preparer(etat, FINE, cam, [devant(30), pose(NaN, 0)], 2, 1, 0, 9, -1, 0); assert.equal(etat.ombreProche, null, 'pose invalide');
});

await verifier('journal : une ligne par changement du niveau Auto ou des ombres, les 64 dernières', async () => {
  const etat = O.creer(), cam = camera(), poses = [devant(10)];
  const suite = [[3, FINE, 1], [3, FINE, 2], [2, FINE, 3], [2, LEGERE, 4], [2, LEGERE, 5], [-1, LEGERE, 6]];
  for (const [niveau, P, t] of suite) O.preparer(etat, P, cam, poses, 1, -1, 0, 0, niveau, t);
  const j = O.journal(etat);
  assert.equal(j.changements, 4);
  assert.deepEqual(j.lignes, [{ t: 1, niveau: 3, ombres: true }, { t: 3, niveau: 2, ombres: true }, { t: 4, niveau: 2, ombres: false }, { t: 6, niveau: -1, ombres: false }]);
  for (let i = 0; i < 100; i++) O.preparer(etat, i % 2 ? FINE : MOYENNE, cam, poses, 1, -1, 0, 0, i % 5, 10 + i);
  const k = O.journal(etat);
  assert.equal(k.lignes.length, 64);
  assert.deepEqual(k.lignes[63], { t: 109, niveau: 4, ombres: true });
  assert.ok(k.changements > 64);
  assert.equal(O.journal().changements, k.changements, 'sans état : celui du dernier créé (le jeu n\'en crée qu\'un)');
});

await verifier('carte lointaine : demandée au moteur au chargement, libérée sur un GPU modeste', async () => {
  const etat = O.creer(), demandes = [];
  const rendu = { precalculerOmbre(d) { demandes.push(d); return d ? { taille: d.taille, ms: 1 } : null; } };
  const r = O.carte(rendu, false);
  assert.deepEqual(demandes[0], { taille: 2048, marge: 20, dessous: 300 });
  assert.ok(r && r.taille === 2048 && etat.carte === r);
  assert.equal(O.carte(rendu, true), null); assert.equal(demandes[1], null);
  assert.equal(O.carte({}, false), null, 'moteur sans l\'option (WebGPU, ancien FERRO)');
  assert.equal(O.carte(null, false), null);
});

console.log('---');
console.log(compte + ' tests passes');
process.exit(0);
