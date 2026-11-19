// Identité de la pose des voitures (src/voiture.js) : poser, cockpit, fantôme et glaces du cockpit, sur un jeu de
// poses et d'états variés, en empreinte arrondie au nanomètre (1e-9), comparée à verifications/fixtures/voiture-identite.json.
// L'empreinte a été figée avec src/voiture.js du commit 54e98c9, qui créait des objets neufs à chaque pose : ce que
// le moteur lit de chaque objet (forme, place, taille, rotation, matière, couleur, drapeaux, émission) ne doit pas
// changer, même quand les appels s'entrelacent entre voitures et variantes (cockpit, rétroviseur, vue extérieure,
// épave) comme dans jeu.js.
//   node verifications/voiture-identite.test.mjs                  vérifier
//   BITUME_FIGER=1 node verifications/voiture-identite.test.mjs   réécrire l'empreinte : seulement pour un changement
//                                                                 d'image voulu, à dire dans le commit
// Deux configurations : sans les modules du pilote d'EMPRISE (comme les autres tests Node) et avec (comme la page).
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url)), src = path.join(ici, '..', 'src');
const FIXTURE = path.join(ici, 'fixtures', 'voiture-identite.json');
const figer = process.env.BITUME_FIGER === '1';

function charger(fichiers) {
  const ctx = vm.createContext({ console });
  for (const f of fichiers) vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f });
  return ctx.BITUME;
}
const CONFIGURATIONS = {
  primitives: ['carene.js', 'main.js', 'ferro/vehicle-dynamics.js', 'pneus.js', 'conduite.js', 'voiture.js'],
  emprise: ['carene.js', 'main.js', 'humain-donnees.js', 'humain-corps.js', 'ferro/vehicle-dynamics.js', 'pneus.js', 'conduite.js', 'voiture.js']
};

// ---------------------------------------------------------------- empreinte
// Propriétés lues par le moteur (renderer.js : répartition, empaquetage des instances et des effets). Une propriété
// absente et une propriété valant undefined se lisent pareil ; toute autre propriété définie entre dans l'empreinte.
const CLES = ['shape', 'mat', 'surface', 'fx', 'alpha', 'overlay', 'emissive'], VECTEURS = ['p', 's', 'r', 'color'];
const CONNUES = new Set([...CLES, ...VECTEURS]);
const nombre = x => typeof x === 'number' ? String(Math.round(x * 1e9)) : x === undefined ? '~' : JSON.stringify(x);
function texte(o) {
  let t = CLES.map(k => nombre(o[k])).join(';');
  for (const k of VECTEURS) t += '|' + (o[k] === undefined ? '~' : Array.from(o[k], nombre).join(','));
  for (const k of Object.keys(o).sort()) if (!CONNUES.has(k) && o[k] !== undefined) t += '|' + k + '=' + JSON.stringify(o[k]);
  return t;
}
const textes = liste => liste.map(texte).join('\n');
function groupe() {
  const h = crypto.createHash('sha256'); let n = 0, appels = 0;
  return { ajouter(liste) { h.update(textes(liste) + '\n#\n'); n += liste.length; appels++; }, fin() { return { appels, objets: n, h: h.digest('hex').slice(0, 24) }; } };
}

// ---------------------------------------------------------------- jeu d'essai
function alea(graine) {
  let a = graine >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function poseAuHasard(a) {
  const ev = { p: [(a() - .5) * 4000, (a() - .3) * 200, (a() - .5) * 4000], cap: (a() - .5) * 20, tangage: (a() - .5) * .3, roulis: (a() - .5) * .3,
    braquage: (a() - .5) * 1.1, roule: a() * 5000, v: a() * 90 };
  if (a() < .6) ev.rebond = [0, 1, 2, 3].map(() => (a() - .5) * .008);
  return ev;
}
// Poses particulières : zéros signés (cap 0 et −0 ne donnent pas les mêmes zéros dans les matrices), quarts de tour,
// braquage sous et sur le seuil d'Ackermann, champs absents, rebond partiel, vitesses sous et au-dessus du flou (30 m/s).
const POSES_FIXES = [
  { p: [0, 0, 0], cap: 0 },
  { p: [0, 0, 0], cap: 0, tangage: 0, roulis: 0, braquage: 0, roule: 0, v: 0 },
  { p: [0, 0, 0], cap: -0, tangage: -0, roulis: -0, braquage: -0, roule: -0, v: 0 },
  { p: [12.5, 3, -7], cap: Math.PI, tangage: 0, roulis: 0, braquage: 5e-6, roule: .07, v: 10 },
  { p: [-300, 40, 250], cap: -Math.PI, tangage: .02, roulis: -.04, braquage: -5e-6, roule: 1.3, v: 30 },
  { p: [1000, -20, -1000], cap: Math.PI / 2, tangage: -.05, roulis: .08, braquage: 1e-5, roule: 250, v: 31, rebond: [.003] },
  { p: [5, 0, 5], cap: -Math.PI / 2, tangage: .1, roulis: .1, braquage: .6, roule: 12, v: 50, rebond: [.001, -.002, .0035, -.0035] },
  { p: [-1500, 120, 1800], cap: 31.4, tangage: -.12, roulis: -.12, braquage: -.45, roule: 4321.5, v: 88 }
];
const OPTIONS_POSER = [undefined, {}, { simple: true }, { casse: true }, { roues: [true, false, false, true] }, { roues: [false, true, true, false], simple: true },
  { casse: true, roues: [true, true, true, true] }, { cockpit: true, overlay: true }, { overlay: true }, { cockpit: true },
  { cockpit: true, overlay: true, roues: [false, false, false, true] }, { cockpit: true, overlay: true, casse: true }];
const SUIVEURS = [{ x: -8, z: -1.5, couleur: [.1, .3, .8] }, { x: -12, z: 0, couleur: [.9, .1, .1] }, { x: -30, z: 4, couleur: [.2, .8, .2] },
  { x: -200, z: 0, couleur: [1, 1, 0] }, { x: -1.5, z: 0, couleur: [0, 0, 0] }, { x: -5, z: -2.5 }, { x: -60, z: -9, couleur: [.5, .5, .5] },
  { x: -18, z: 2, couleur: [.7, .2, .7] }, { x: -25, z: -3, couleur: [.3, .3, .9] }, { x: -9, z: 1.2, couleur: [.95, .6, .1] }];
const ETATS = [
  { regime: 9000, volant: 0, rapport: 3, kmh: 180 },
  { regime: 3000, volant: -1, rapport: 0, kmh: 0 },
  { regime: 12400, volant: .7, rapport: 4, kmh: 245.6 },
  { regime: 12400, volant: .7, rapport: 6, kmh: 300 },
  { regime: 12700, volant: 1.5, rapport: -1, kmh: 7 },
  { regime: 8000, volant: -.4, rapport: 2, kmh: 42, passage: .45, rapportAvant: 1 },
  { regime: 8000, volant: .3, rapport: 3, kmh: 99.6, passage: .1, rapportAvant: 2 },
  { regime: 8000, volant: -1, rapport: 3, kmh: 120, passage: .8, rapportAvant: 2 },
  { regime: 8000, volant: 0, rapport: 5, kmh: 1500, passage: 0, rapportAvant: 4 },
  { regime: 6000, volant: .2, rapport: 1, kmh: -3, passage: .2 },
  { regime: 8000, volant: .6, rapport: 3, kmh: 160, passage: .3, rapportAvant: 4 },
  { regime: 10000, volant: 0, rapport: 3, kmh: 150, derriere: SUIVEURS.slice(0, 5) },
  { regime: 10000, volant: -.2, rapport: 4, kmh: 151, derriere: SUIVEURS },
  { regime: 10000, volant: .1, rapport: 4, kmh: 10, derriere: SUIVEURS.slice(4), ciel: [.5, .6, .7], brume: [.4, .45, .5] },
  { regime: 10000, volant: 0, rapport: 3, kmh: 150, derriere: SUIVEURS, glaceVive: true },
  { regime: 7000, volant: .5, rapport: 2, kmh: 90, roues: [true, false, false, false] },
  { regime: 7000, volant: -.5, rapport: 2, kmh: 90, casse: true, roues: [true, true, true, true] },
  { regime: 9500, volant: 0, rapport: 7, kmh: 9 },
  {},
  { regime: NaN, volant: NaN, rapport: NaN, kmh: NaN }
];
const LIVREES = [
  { couleur: [.86, .1, .08], seconde: [.95, .93, .88], casque: [.95, .93, .88], combinaison: [.95, .93, .88], numero: 27, pneus: 'slicks' },
  { couleur: [.92, .9, .84], seconde: [.1, .1, .12], numero: 1, pneus: 'pluie' },          // claire : gants sombres
  { couleur: [.1, .3, .8], numero: 108, pneus: 'inter' },                                   // sans seconde couleur
  { couleur: [.2, .6, .2], casque: [.9, .8, .1], pneus: 'neige' }                           // visuel préparé, hors choix p9, sans numéro
];
// Filtre des rétroviseurs de jeu.js (majGlaces) : ne garder de la voiture suivie que ce qui est près de l'essieu arrière.
function filtreRetro(V, objets, n0, ev) {
  const ca = Math.cos(ev.cap), sa = Math.sin(ev.cap);
  for (let k = objets.length - 1; k >= n0; k--) {
    const o = objets[k], dx = o.p[0] - ev.p[0], dz = o.p[2] - ev.p[2], x = dx * ca + dz * sa, z = dz * ca - dx * sa;
    if (!(Math.abs(x - V.ROUES[2].x) < .5 && Math.abs(z) > .55)) objets.splice(k, 1);
  }
}

function empreintes(B) {
  const V = B.voiture, R = {}, a = alea(20261118);
  const modeles = LIVREES.map(l => V.modele(l));
  const poses = POSES_FIXES.concat(Array.from({ length: 8 }, () => poseAuHasard(a)));
  // poser : chaque voiture, chaque pose, chaque jeu d'options
  modeles.forEach((mod, i) => OPTIONS_POSER.forEach((options, j) => {
    const g = groupe();
    for (const ev of poses) { const sortie = []; options === undefined ? V.poser(mod, ev, sortie) : V.poser(mod, ev, sortie, options); g.ajouter(sortie); }
    R[`poser/${i}/${j}`] = g.fin();
  }));
  // cockpit : chaque voiture, chaque état, quelques poses
  const posesCockpit = poses.slice(0, 3).concat(poses.slice(-3));
  modeles.forEach((mod, i) => ETATS.forEach((etat, j) => {
    const g = groupe();
    for (const ev of posesCockpit) { const sortie = []; V.cockpit(mod, ev, sortie, etat); g.ajouter(sortie); }
    R[`cockpit/${i}/${j}`] = g.fin();
  }));
  // fantôme et glaces du cockpit
  { const g = groupe(); for (const ev of poses) { const sortie = []; V.fantome(ev, sortie); g.ajouter(sortie); } R.fantome = g.fin(); }
  { const g = groupe(); for (const ev of poses) g.ajouter(V.glacesCockpit(ev).flatMap(q => [{ shape: 'k' + q.k, p: q.centre, s: q.normale, r: q.droite }, ...q.coins.map(c => ({ shape: 'coin', p: c }))])); R.glaces = g.fin(); }
  // Images entrelacées, dans l'ordre de jeu.js : vue du joueur 2 (voiture du joueur 1 vue de dehors), vue du joueur 1 en
  // cockpit, puis sa glace (objets de la vue hors habitacle et roue arrière de sa voiture), d'image en image.
  const b = alea(77), vue = groupe(), glace = groupe(), glaceNeuve = groupe(), vueJ2 = groupe();
  for (let f = 0; f < 10; f++) {
    const ev = modeles.map(() => poseAuHasard(b)), etat = ETATS[(f * 7) % ETATS.length];
    const j2 = [];
    V.poser(modeles[0], ev[0], j2, { simple: f % 3 === 2 });
    V.cockpit(modeles[1], ev[1], j2, ETATS[(f * 3 + 1) % ETATS.length]);
    V.poser(modeles[2], ev[2], j2, { casse: f === 4 });
    V.poser(modeles[3], ev[3], j2, { roues: [f % 2 === 0, false, f === 5, false] });
    vueJ2.ajouter(j2);
    const sortie = [];
    V.cockpit(modeles[0], ev[0], sortie, etat);
    for (let k = 1; k < 4; k++) V.poser(modeles[k], ev[k], sortie, { simple: (f + k) % 4 === 0, casse: f === 7 && k === 2 });
    V.fantome(poseAuHasard(b), sortie);
    vue.ajouter(sortie);
    const objets = sortie.filter(o => !o.overlay), n0 = objets.length;
    V.poser(modeles[0], ev[0], objets, { roues: etat.roues, casse: !!etat.casse });
    filtreRetro(V, objets, n0, ev[0]);
    glace.ajouter(objets);
    // la pose réduite des rétroviseurs, quand elle existe, doit rendre exactement les mêmes objets
    if (V.poserRetro) {
      const neuve = sortie.filter(o => !o.overlay);
      V.poserRetro(modeles[0], ev[0], neuve, { roues: etat.roues, casse: !!etat.casse });
      glaceNeuve.ajouter(neuve);
    }
  }
  R['images/vue'] = vue.fin(); R['images/glace'] = glace.fin(); R['images/joueur2'] = vueJ2.fin();
  const neuve = glaceNeuve.fin();
  // Entrelacement d'une même voiture : dehors, cockpit, par-dessus, dehors encore ; la dernière pose rend la première.
  {
    const mod = modeles[0], ev1 = poses[9], ev2 = poses[10], g = groupe(), l1 = [], l2 = [], l3 = [], l4 = [], l5 = [];
    V.poser(mod, ev1, l1); const t1 = textes(l1); g.ajouter(l1);
    V.cockpit(mod, ev2, l2, ETATS[4]); g.ajouter(l2);
    V.poser(mod, ev1, l3, { overlay: true }); g.ajouter(l3);
    V.cockpit(mod, ev2, l5, ETATS[0]); g.ajouter(l5);
    V.poser(mod, ev1, l4); g.ajouter(l4);
    assert.equal(textes(l4), t1, 'la même pose rend la même sortie');
    R['entrelacement'] = g.fin();
  }
  return { R, verif: { V, modeles, poses, neuve } };
}

// ---------------------------------------------------------------- vérification
let compte = 0;
function verifier(nom, f) {
  try { f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`FAIL ${nom}: ${e.message}`); process.exit(1); }
}
const t0 = performance.now(), calcul = {};
for (const [nom, fichiers] of Object.entries(CONFIGURATIONS)) calcul[nom] = empreintes(charger(fichiers));

// La pose réduite des rétroviseurs est comparée à la pose entière filtrée, image par image, dans la même exécution.
for (const [nom, { R, verif }] of Object.entries(calcul)) {
  const { V, modeles, neuve } = verif;
  if (!V.poserRetro) continue;
  verifier(`${nom} : glace des images entrelacées, pose réduite identique à la pose entière filtrée`, () => {
    assert.equal(neuve.appels, R['images/glace'].appels);
    assert.equal(neuve.objets, R['images/glace'].objets);
    assert.equal(neuve.h, R['images/glace'].h);
  });
  verifier(`${nom} : la pose réduite des rétroviseurs rend la roue arrière de la pose entière filtrée`, () => {
    const b = alea(99);
    for (let f = 0; f < 60; f++) {
      const mod = modeles[f % modeles.length], ev = poseAuHasard(b), etat = ETATS[f % ETATS.length];
      const entiere = [];
      V.poser(mod, ev, entiere, { roues: etat.roues, casse: !!etat.casse });
      filtreRetro(V, entiere, 0, ev);
      const attendu = textes(entiere), reduite = [];
      V.poserRetro(mod, ev, reduite, { roues: etat.roues, casse: !!etat.casse });
      assert.equal(textes(reduite), attendu, `image ${f}`);
    }
  });
}

const obtenu = Object.fromEntries(Object.entries(calcul).map(([nom, { R }]) => [nom, Object.fromEntries(Object.entries(R).filter(([, v]) => v))]));
if (figer) {
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(FIXTURE, JSON.stringify({ arrondi: 1e-9, configurations: obtenu }, null, 1) + '\n');
  console.log(`empreinte écrite : ${FIXTURE}`);
}
const attendu = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
for (const nom of Object.keys(CONFIGURATIONS)) {
  verifier(`${nom} : ${Object.keys(attendu.configurations[nom]).length} groupes de poses identiques à l'empreinte`, () => {
    const a = attendu.configurations[nom], o = obtenu[nom], differents = [];
    for (const cle of Object.keys(a)) if (!o[cle] || o[cle].h !== a[cle].h || o[cle].objets !== a[cle].objets) differents.push(`${cle} (${o[cle] ? o[cle].objets : '—'} objets, ${a[cle].objets} attendus)`);
    assert.deepEqual(Object.keys(o).sort(), Object.keys(a).sort(), 'mêmes groupes');
    assert.equal(differents.length, 0, `${differents.length} groupes différents : ${differents.slice(0, 8).join(', ')}`);
  });
}
console.log(`${compte} vérifications réussies (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
