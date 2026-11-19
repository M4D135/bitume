// Vérifications des effets (src/traces.js) : plafonds de 512 bandes, 48 fumées et 48 étincelles, effacement en 24 s,
// cadence de 30 Hz, bandes sous les roues, coût par image, déterminisme ; puis une vraie course de 60 s.
// Fluidité : formules d'attitude identiques à celles de B.voiture, temps de dessin continu, tri derrière la caméra.
// L'absence d'allocation par image se vérifie à part (effets-allocation.test.mjs), dans un processus neuf.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));
for (const f of ['circuit.js', 'conduite.js', 'degats.js', 'course.js', 'carene.js', 'main.js', 'voiture.js', 'traces.js']) charger(f);
const B = globalThis.BITUME, T = B.traces, DT = 1 / 120;

let compte = 0;
function verifier(nom, f) {
  try { f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`KO  ${nom}`); console.error(e); process.exit(1); }
}

// Douze voitures sur un grand cercle, toutes en glisse sur leurs quatre roues ; contre la glissière si `mur`.
function scene(n = 12, options = {}) {
  const R = 300, voitures = [], poses = [];
  for (let k = 0; k < n; k++) {
    voitures.push({ etat: { s: k * 8, d: 2, v: 40, beta: .3, bond: 0, surface: 'piste', choc: 0, roues: [0, 1, 2, 3].map(() => ({ glisse: options.glisse ?? 1 })) } });
    poses.push({ x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 });
  }
  const co = { c: { longueur: 2 * Math.PI * R }, voitures };
  const placer = () => voitures.forEach((v, k) => {
    const et = v.etat, a = et.s / R, p = poses[k];
    p.x = R * Math.cos(a); p.z = R * Math.sin(a); p.cap = a + Math.PI / 2 + et.beta;
  });
  const avancer = (fx, secondes, ev) => {
    for (let i = 0, m = Math.round(secondes / DT); i < m; i++) {
      for (const v of voitures) { v.etat.s += v.etat.v * DT; if (options.mur) v.etat.choc = B.conduite.PARAMS.chocDuree; }
      placer();
      T.pas(fx, co, poses, 0, DT, ev ? ev(i) : null);
    }
  };
  placer();
  return { co, poses, voitures, avancer };
}

verifier('plafonds : 512 bandes, 48 fumées, 48 étincelles, sans jamais grandir', () => {
  const sc = scene(12, { mur: true }), fx = T.creer(12, 7);
  let max = { bandes: 0, fumees: 0, etincelles: 0 };
  for (let s = 0; s < 40; s++) {
    sc.avancer(fx, 1, i => i % 30 === 0 ? [{ type: 'contact', a: 1, b: 2, force: 9 }] : null);
    const c = T.compter(fx);
    for (const k in max) max[k] = Math.max(max[k], c[k]);
  }
  assert.ok(max.bandes <= 512 && max.fumees <= 48 && max.etincelles <= 48, JSON.stringify(max));
  assert.equal(max.bandes, 512, 'douze voitures en glisse remplissent les bandes');
  assert.ok(max.fumees > 30 && max.etincelles > 30, JSON.stringify(max));
  assert.equal(fx.bandes.length, T.BANDES); assert.equal(fx.fumees.length, T.FUMEES); assert.equal(fx.etincelles.length, T.ETINCELLES);
});

verifier('traces effacées en 24 s, fumée et étincelles éteintes avant', () => {
  const sc = scene(12, { mur: true }), fx = T.creer(12, 3);
  sc.avancer(fx, 5);
  assert.ok(T.compter(fx).bandes > 100);
  for (const v of sc.voitures) { v.etat.roues.forEach(r => { r.glisse = 0; }); }
  const sans = scene(12);
  // plus de glisse ni de mur : on laisse vieillir
  for (const v of sc.voitures) v.etat.choc = 0;
  const vieillir = (s) => { for (let i = 0, m = Math.round(s / DT); i < m; i++) T.pas(fx, sc.co, sc.poses, 0, DT, null); };
  vieillir(2);
  const deux = T.compter(fx);
  assert.equal(deux.fumees, 0, 'fumée éteinte en 2 s'); assert.equal(deux.etincelles, 0, 'étincelles éteintes en 2 s');
  assert.ok(deux.bandes > 100, 'les traces restent');
  vieillir(22.1);
  assert.equal(T.compter(fx).bandes, 0, 'traces effacées en 24 s');
  void sans;
});

verifier('pâleur : une trace pâlit avec l\'âge et ne se dessine plus après 24 s', () => {
  const sc = scene(1), fx = T.creer(1, 1);
  sc.avancer(fx, .5);
  sc.voitures[0].etat.roues.forEach(r => { r.glisse = 0; });
  const alphas = [];
  for (const age of [0, 12, 20, 23.9]) {
    while (fx.bandes.find(b => b.actif) && fx.bandes.find(b => b.actif).age < age) T.pas(fx, sc.co, sc.poses, 0, DT, null);
    const sortie = []; T.dessiner(fx, sortie, [0, 0, 0], 0);
    alphas.push(sortie.length ? Math.max(...sortie.map(o => o.alpha)) : 0);
  }
  for (let i = 1; i < alphas.length; i++) assert.ok(alphas[i] < alphas[i - 1] + 1e-9, 'pâlit : ' + alphas.map(a => a.toFixed(3)).join(' '));
  assert.ok(alphas[3] < .02, 'presque effacée à 23,9 s : ' + alphas[3]);
});

verifier('cadence : une mise à jour tous les 4 pas de 1/120 s (30 Hz)', () => {
  const sc = scene(1, { glisse: 0 }), fx = T.creer(1, 1);
  sc.voitures[0].etat.choc = 0;
  // une étincelle unique, suivie : son âge n'avance que par trentièmes de seconde
  T.pas(fx, sc.co, sc.poses, 0, DT, [{ type: 'contact', a: 0, b: 0, force: 0 }]);
  const e = fx.etincelles.find(x => x.actif), ages = [];
  for (let i = 0; i < 12; i++) { T.pas(fx, sc.co, sc.poses, 0, DT, null); ages.push(e.age); }
  const sauts = ages.map((a, i) => i > 0 && a !== ages[i - 1] ? i : -1).filter(i => i > 0), texte = 'ages ' + ages.map(a => a.toFixed(4)).join(' ');
  assert.equal(sauts.length, 3, texte);
  for (let i = 1; i < sauts.length; i++) assert.equal(sauts[i] - sauts[i - 1], 4, texte);
  for (const i of sauts) assert.ok(Math.abs(ages[i] - ages[i - 1] - T.PAS) < 1e-9, texte);
});

verifier('bandes sous les roues arrière, prolongées en ligne droite', () => {
  const sc = scene(1), fx = T.creer(1, 1), et = sc.voitures[0].etat;
  et.roues[0].glisse = et.roues[1].glisse = 0;      // seules les roues arrière glissent
  et.beta = 0;
  // ligne droite : la voiture file le long de x
  const p = sc.poses[0];
  for (let i = 0; i < 240; i++) {
    p.x += et.v * DT; p.z = 0; p.cap = 0;
    T.pas(fx, { c: { longueur: 1e6 }, voitures: sc.voitures }, sc.poses, 0, DT, null);
  }
  const actives = fx.bandes.filter(b => b.actif);
  // 2 s à 40 m/s : 80 m par roue, en bandes de 6 m au plus
  assert.ok(actives.length >= 2 * 13 && actives.length <= 2 * 16, 'bandes : ' + actives.length);
  for (const b of actives) {
    assert.ok(Math.abs(Math.abs(b.z0) - B.voiture.ROUES[2].z * -1) < 1e-6 || Math.abs(Math.abs(b.z0) - Math.abs(B.voiture.ROUES[2].z)) < 1e-6, 'sous une roue arrière : z ' + b.z0);
    assert.ok(Math.abs(b.y0 - .018) < 1e-6, 'posée sur la piste');
    assert.ok(b.objet.s[2] > .3 && b.objet.s[2] < .4, 'largeur du pneu arrière');
  }
});

verifier('pas de bande à travers un replacement', () => {
  const sc = scene(1), fx = T.creer(1, 1);
  sc.avancer(fx, .5);
  sc.voitures[0].etat.s += 200;                    // la voiture est replacée 200 m plus loin
  sc.avancer(fx, .1);
  for (const b of fx.bandes) if (b.actif) assert.ok(Math.hypot(b.x1 - b.x0, b.z1 - b.z0) <= 6.0001, 'bande de ' + Math.hypot(b.x1 - b.x0, b.z1 - b.z0).toFixed(1) + ' m');
});

verifier('voitures loin de celle que l\'on regarde : rien', () => {
  const sc = scene(2), fx = T.creer(2, 1);
  sc.voitures[1].etat.s = 900;                     // 900 m devant, sur un cercle de 1 885 m
  sc.avancer(fx, 1);
  const deLoin = fx.bandes.filter(b => b.actif && Math.hypot(b.x0 - sc.poses[1].x, b.z0 - sc.poses[1].z) < 60).length;
  assert.equal(deLoin, 0);
});

verifier('coût : au plus 0,3 ms par image à 60 Hz, tout plein', () => {
  const sc = scene(12, { mur: true }), fx = T.creer(12, 5), sortie = [];
  sc.avancer(fx, 30, i => i % 36 === 0 ? [{ type: 'contact', a: 3, b: 4, force: 5 }] : null);
  const image = () => { sc.avancer(fx, 2 * DT); sortie.length = 0; T.dessiner(fx, sortie, [sc.poses[0].x, 1, sc.poses[0].z], fx.acc); };
  for (let i = 0; i < 600; i++) image();
  const n = 3000, t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) image();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  console.log(`    ${ms.toFixed(3)} ms par image, ${sortie.length} objets dessinés`);
  assert.ok(ms <= .3, ms.toFixed(3) + ' ms');
});

verifier('déterminisme : même graine, mêmes effets', () => {
  const tirer = () => {
    const sc = scene(12, { mur: true }), fx = T.creer(12, 42);
    sc.avancer(fx, 3, i => i % 50 === 0 ? [{ type: 'contact', a: 0, b: 1, force: 4 }] : null);
    const sortie = []; T.dessiner(fx, sortie, [0, 0, 0], fx.acc);
    return JSON.stringify(sortie.map(o => [o.p, o.s, o.alpha]));
  };
  assert.equal(tirer(), tirer());
});

// Le hash brut ajouté en 99b32cc9 n'est pas reproductible avec sa propre source de référence 54e98c9 : sous
// Node 24.22.3, l'ancien et l'actuel rendent les mêmes 10 071 valeurs au bit près (reçu TRACES-FIABILITE-2026-11-19).
// On garde le scénario et ses contrats observables : naissances indépendantes ci-dessous, géométrie, vie, dessin,
// ordre des tirages et relecture exacte de tous les champs, sans remplacer le hash par celui de la machine courante.
function sceneComplete(graine = 20261118) {
  const R = 300, n = 12, voitures = [], poses = [];
  for (let k = 0; k < n; k++) {
    voitures.push({ id: k, couleur: [.1 + .05 * k, .2, .3], etat: { s: k * 9, d: 2, v: 32 + 2 * k, beta: .25 + .01 * k, bond: 0,
      surface: k % 4 === 3 ? 'herbe' : 'piste', choc: 0, roues: [0, 1, 2, 3].map(r => ({ glisse: .3 + .7 * (((k + r) % 4) / 3) })) } });
    poses.push({ x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 });
  }
  const co = { c: { longueur: 2 * Math.PI * R }, voitures };
  const fx = T.creer(n, graine), eauAvant = B.conduite.eauSurPiste;
  B.conduite.eauSurPiste = () => .6;
  try {
    for (let i = 0; i < 12 * 120; i++) {
      for (let k = 0; k < n; k++) {
        const et = voitures[k].etat, p = poses[k], a = et.s / R;
        et.s += et.v * DT;
        et.bond = (i + k) % 97 < 6 ? .05 : 0;
        if (k % 3 === 0 && i % 180 < 40) et.choc = B.conduite.PARAMS.chocDuree;
        p.x = R * Math.cos(a); p.z = R * Math.sin(a); p.y = .1 * Math.sin(a * 3);
        p.cap = a + Math.PI / 2 + et.beta; p.tangage = .02 * Math.sin(i / 50 + k); p.roulis = -.03 * Math.cos(i / 70 + k);
      }
      let ev = null;
      if (i % 50 === 7) ev = [{ type: 'contact', a: i % n, b: (i + 1) % n, force: 4 + i % 30 }];
      else if (i % 300 === 120) { const k = (i / 300 | 0) % n; ev = [0, 1, 2, 3].map(w => ({ type: 'roue', roue: w, id: k })); ev.push({ type: 'casse', id: k, force: 40, cote: k % 2 ? 1 : -1, avant: k % 3 === 0 }); }
      else if (i % 300 === 220) ev = [{ type: 'panneau', id: (i / 300 | 0) % n, cote: 1, avant: true }];
      else if (i % 400 === 333) ev = [{ type: 'retour', id: 2, repositionnement: true }];
      T.pas(fx, co, poses, 0, DT, ev);
    }
  } finally { B.conduite.eauSurPiste = eauAvant; }
  return { fx, co, poses };
}

function etatEffets(fx) {
  const valeurs = {};
  const champs = (nom, noms) => { for (const [i, o] of fx[nom].entries()) for (const k of noms) valeurs[`${nom}[${i}].${k}`] = o[k] === undefined ? 0 : +o[k]; };
  champs('bandes', ['actif', 'age', 'a0', 'larg', 'roulis', 'x0', 'y0', 'z0', 'x1', 'y1', 'z1']);
  for (const l of ['fumees', 'etincelles', 'embruns']) champs(l, ['actif', 'age', 'vie', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'sol', 'taille', 'a0']);
  champs('debris', ['actif', 'age', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'sol', 'spin', 'repos']);
  for (const k of ['prochaine', 'prochaineFumee', 'prochaineEtincelle', 'prochainEmbrun', 'prochainDebris', 'acc']) valeurs[k] = fx[k];
  for (const nom of ['pieces', 'ouverte', 'genOuverte', 'valide', 'dernier']) for (const [i, x] of fx[nom].entries()) valeurs[`${nom}[${i}]`] = x;
  return valeurs;
}

function proche(obtenu, attendu, nom) {
  assert.ok(Number.isFinite(obtenu) && Math.abs(obtenu - attendu) <= 1e-12, `${nom} : ${obtenu}, attendu ${attendu}`);
}

verifier('déterminisme complet : pools rejoués, géométrie, durées et suite des tirages conservés', () => {
  const { fx, poses } = sceneComplete(), relu = sceneComplete().fx;
  const a = etatEffets(fx), b = etatEffets(relu);
  assert.equal(Object.keys(a).length, 10066, 'tous les champs de l’ancien oracle restent couverts');
  for (const [nom, x] of Object.entries(a)) { assert.ok(Number.isFinite(x), nom); assert.equal(x, b[nom], nom); }
  // Les cinq entiers suivants ont été relus dans 54e98c9, indépendamment du runtime actuel. La position dans la
  // suite entière est exacte ; les arrondis des fonctions trigonométriques n'y entrent pas.
  const suite = Array.from({ length: 5 }, () => fx.alea() * 4294967296);
  assert.deepEqual(suite, [2777511388, 2130241367, 2295214947, 1862808525, 2124726866]);
  assert.deepEqual(suite, Array.from({ length: 5 }, () => relu.alea() * 4294967296));
  assert.notDeepEqual(etatEffets(sceneComplete(20261119).fx), a, 'la graine doit effectivement agir');
  const c = T.compter(fx);
  assert.deepEqual([c.bandes, c.fumees, c.etincelles, c.debris, c.embruns], [512, 48, 48, 54, 160], 'tous les effets servent');
  for (const nom of ['fumees', 'etincelles', 'embruns', 'debris']) for (const f of fx[nom]) if (f.actif) {
    assert.ok(f.age >= 0 && f.age < (nom === 'debris' ? 12 : f.vie), nom + ' vivant dans sa durée');
  }
  for (const b of fx.bandes) if (b.actif) {
    assert.ok(b.age >= 0 && b.age < 24 && b.a0 > 0 && b.a0 <= .62, 'vie et opacité de la gomme');
    assert.ok(Math.hypot(b.x1 - b.x0, b.z1 - b.z0) <= 6 + 1e-12, 'aucune bande ne franchit un replacement');
    assert.ok(Math.abs(b.larg - .224) < 1e-12 || Math.abs(b.larg - .368) < 1e-12, 'largeur sous le pneu');
    for (const [k, axe] of ['x', 'y', 'z'].entries()) proche(b.objet.p[k], (b[axe + '0'] + b[axe + '1']) / 2, 'centre de bande ' + axe);
    proche(b.objet.s[0], Math.hypot(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) + b.larg / 2, 'longueur de gomme');
    proche(b.objet.s[1], .004, 'épaisseur de gomme'); proche(b.objet.s[2], b.larg, 'largeur dessinée');
  }
  const sortie = []; T.dessiner(fx, sortie, [poses[0].x, 1, poses[0].z], 0);
  for (const nom of ['bandes', 'fumees', 'etincelles', 'embruns', 'debris']) assert.ok(fx[nom].some(f => sortie.includes(f.objet)), nom + ' réellement dessiné');
  for (const o of sortie) {
    assert.ok([...o.p, ...o.r, ...o.s, o.alpha].every(Number.isFinite), 'dessin fini');
    assert.ok(o.s.every(x => x > 0) && o.alpha > 0 && o.alpha <= 1, 'volume et opacité du dessin');
  }
});

// Contrats de naissance, hors trigonométrie (cap, tangage et roulis nuls) : une seule source à (10, 2, −3),
// graine 7. Les valeurs viennent du code historique et des cotes de roue, pas d'un appel au code sous test pour
// fabriquer l'attendu. Elles distinguent notamment les tirages de durée, vx, vy et vz : les permuter doit échouer.
const NAISSANCES = {
  fumees: { nombre: 1, suivant: 1741702388, etat: { x: 11.35, y: 2.218, z: -3.85, vie: 1.1309791287872941,
    vx: 3.763052212446928, vy: .7495143528562039, vz: .03431242965161801, taille: 1.2, a0: .38 } },
  etincelles: { nombre: 10, suivant: 1826717127, etat: { x: 10, y: 2.3, z: -3, vie: .2535114259459078,
    vx: 4.4956660605967045, vy: 6.189156637340784, vz: 1.5922296456992626, sol: 2 } },
  embruns: { nombre: 1, suivant: 3134562008, etat: { x: 8.059236946888268, y: 2.25, z: -3.794757176428102, vie: .8107226342661307,
    vx: 11.816565064154567, vy: 1.3583506227051838, vz: -.10130210244096816, sol: 2, taille: .7713302415795624, a0: .244 } },
  debris: { nombre: 1, suivant: 2002453909, etat: { x: 11.35, y: 2.29, z: -3.85, vx: 3.0585237657651305,
    vy: 5.607226342661306, vz: -2.205827765725553, sol: 2.14, spin: -1.1337397433817387 } }
};
for (const [nom, attendu] of Object.entries(NAISSANCES)) verifier(`naissance ${nom} : position, tirages, dessin et expiration`, () => {
  const sc = scene(1, { glisse: 0 }), fx = T.creer(1, 7), et = sc.voitures[0].etat;
  Object.assign(et, { s: 0, v: nom === 'embruns' ? 22 : 10, beta: 0 }); sc.voitures[0].id = 0;
  Object.assign(sc.poses[0], { x: 10, y: 2, z: -3, cap: 0, tangage: 0, roulis: 0 });
  if (nom === 'fumees') et.roues[0].glisse = 1;
  const ev = nom === 'etincelles' ? [{ type: 'contact', a: 0, b: 0, force: 0 }] : nom === 'debris' ? [{ type: 'roue', id: 0, roue: 0 }] : null;
  const eauAvant = B.conduite.eauSurPiste; B.conduite.eauSurPiste = () => nom === 'embruns' ? .6 : 0;
  try { T.pas(fx, sc.co, sc.poses, 0, ev ? 0 : T.PAS, ev); } finally { B.conduite.eauSurPiste = eauAvant; }
  for (const pool of Object.keys(NAISSANCES)) assert.equal(T.compter(fx)[pool], pool === nom ? attendu.nombre : 0, pool + ' à la naissance');
  const f = fx[nom][0]; assert.equal(f.actif, true); assert.equal(f.age, 0);
  for (const [champ, valeur] of Object.entries(attendu.etat)) proche(f[champ], valeur, nom + '.' + champ);
  assert.equal(fx.alea() * 4294967296, attendu.suivant, 'nombre exact de tirages consommés');
  const h = nom === 'debris' ? .1 : f.vie / 8, sortie = [];
  T.dessiner(fx, sortie, [10, 3, -3], h);
  assert.ok(sortie.includes(f.objet), 'la particule née est visible');
  for (const [i, axe] of ['x', 'y', 'z'].entries()) proche(f.objet.p[i], attendu.etat[axe] + attendu.etat['v' + axe] * h, 'position dessinée ' + axe);
  const alpha = nom === 'fumees' ? .38 * Math.pow(7 / 8, 1.6) : nom === 'embruns' ? .244 * 7 / 8 * .75 : nom === 'etincelles' ? 7 / 8 : 1;
  proche(f.objet.alpha, alpha, 'opacité à un huitième de vie');
  if (nom === 'fumees') { proche(f.objet.s[0], 1.359375, 'bouffée qui s’élargit'); proche(f.objet.s[1], 1.0875, 'bouffée aplatie'); }
  if (nom === 'embruns') for (const s of f.objet.s) proche(s, attendu.etat.taille * 1.325, 'gerbe qui s’élargit');
  if (nom === 'etincelles') { proche(f.objet.s[1], .028, 'épaisseur d’étincelle'); proche(f.objet.s[2], .028, 'épaisseur d’étincelle'); }
  if (nom === 'debris') assert.deepEqual(f.objet.s, [.58, .28, .58], 'cotes de la roue détachée');
  et.v = 0; et.roues.forEach(r => { r.glisse = 0; });
  const duree = Math.max(...fx[nom].filter(f => f.actif).map(f => nom === 'debris' ? 12 : f.vie));
  for (let i = 0; i <= Math.ceil(duree / T.PAS); i++) T.pas(fx, sc.co, sc.poses, 0, T.PAS, null);
  assert.equal(T.compter(fx)[nom], 0, 'les effets expirent sans nouvelle émission');
  const apres = []; T.dessiner(fx, apres, [10, 3, -3], 0); assert.equal(apres.length, 0, 'rien de périmé ne reste dessiné');
});

verifier('vraie course de 60 s : traces des voitures proches, rien ne casse', () => {
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 1, rivaux: 11, graine: 5, placeJoueur: 8 });
  const fx = T.creer(co.voitures.length, 5), poses = co.voitures.map(() => ({}));
  const poser = () => co.voitures.forEach((v, k) => {
    const et = v.etat, e = B.circuit.echantillon(c, et.s), p = poses[k];
    p.x = e.x - Math.sin(e.cap) * et.d; p.y = et.y; p.z = e.z + Math.cos(e.cap) * et.d;
    p.cap = e.cap + et.psi + et.beta; p.tangage = et.tangage; p.roulis = et.roulis;
  });
  let max = 0;
  for (let i = 0; i < 60 * 120; i++) {
    const ev = B.course.pas(co, B.course.commandesIA(co, co.joueur), DT);
    poser();
    T.pas(fx, co, poses, 0, DT, ev);
    max = Math.max(max, T.compter(fx).bandes);
  }
  const sortie = []; T.dessiner(fx, sortie, [poses[0].x, poses[0].y + 1, poses[0].z], fx.acc);
  for (const o of sortie) for (const x of [...o.p, ...o.s, ...o.r, o.alpha]) assert.ok(Number.isFinite(x), 'valeur finie');
  console.log(`    ${max} bandes au plus, ${sortie.length} objets dessinés à la fin`);
});

verifier('replacement : les traces coupent immédiatement, sans effacer les effets existants', () => {
  const sc = scene(2), fx = T.creer(2, 51);
  sc.avancer(fx, 1);
  const avant = T.compter(fx);
  assert.ok(avant.bandes > 0);
  assert.ok(fx.valide[0]); assert.ok(fx.valide[4]);
  T.pas(fx, sc.co, sc.poses, 0, 0, [{ type: 'retour', id: 0, repositionnement: true }]);
  assert.ok(Array.from(fx.valide.slice(0, 4)).every(v => v === 0));
  assert.ok(Array.from(fx.ouverte.slice(0, 4)).every(v => v === -1));
  assert.ok(fx.valide[4], 'les autres voitures continuent leurs traces');
  assert.deepEqual(T.compter(fx), avant, 'pas d’effacement des traces et particules');
});

// ------------------------------------------------------------------ fluidité
// L'attitude est développée terme à terme dans traces.js (plus de matrice en tableaux) : elle doit rendre ce que
// rendent B.voiture.attitude, mul et angles, au dernier chiffre près, voitures en tangage et en roulis.
verifier('formules : contacts de roue, bandes et étincelles comme B.voiture.attitude, mul et angles', () => {
  const sc = scene(3, { mur: true }), fx = T.creer(3, 9), V = B.voiture;
  sc.poses.forEach((p, k) => { p.y = .5 * k; p.tangage = .04 * (k + 1); p.roulis = -.03 * (k + 1); });
  let vues = null;
  for (let i = 0; i < 240; i++) {
    for (const v of sc.voitures) { v.etat.s += v.etat.v * DT; v.etat.choc = B.conduite.PARAMS.chocDuree; }
    sc.poses.forEach((p, k) => { const a = sc.voitures[k].etat.s / 300; p.x = 300 * Math.cos(a); p.z = 300 * Math.sin(a); p.cap = a + Math.PI / 2 + .3; });
    T.pas(fx, sc.co, sc.poses, 0, DT, null);
    if (fx.acc < 1e-9) vues = sc.poses.map(p => ({ ...p }));     // poses de la dernière mise à jour
  }
  const ecart = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
  for (let k = 0; k < 3; k++) {
    const p = vues[k], M = V.attitude(p.cap, p.tangage, p.roulis);
    for (let w = 0; w < 4; w++) {
      const R = V.ROUES[w], o = V.mul(M, [R.x, .018, R.z]), j = (k * 4 + w) * 3;
      assert.ok(ecart([p.x + o[0], p.y + o[1], p.z + o[2]], Array.from(fx.dernier.slice(j, j + 3))) < 1e-12, `contact de la roue ${w} de la voiture ${k}`);
    }
  }
  const bandes = fx.bandes.filter(b => b.actif), etincelles = fx.etincelles.filter(e => e.actif);
  assert.ok(bandes.length > 20 && etincelles.length > 10, bandes.length + ' bandes, ' + etincelles.length + ' étincelles');
  for (const b of bandes) {
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0, lh = Math.hypot(dx, dz);
    assert.ok(ecart(b.objet.r, V.angles(V.attitude(Math.atan2(dz, dx), Math.atan2(dy, lh), b.roulis))) < 1e-12, 'orientation de bande');
    assert.ok(Math.abs(b.objet.s[0] - (Math.hypot(lh, dy) + b.larg * .5)) < 1e-12, 'longueur de bande');
    assert.ok(b.roulis !== 0, 'la bande garde le dévers de la voiture');
  }
  for (const e of etincelles) assert.ok(ecart(e.objet.r, V.angles(V.attitude(Math.atan2(e.vz, e.vx), Math.atan2(e.vy, Math.hypot(e.vx, e.vz)), 0))) < 1e-12, 'orientation d’étincelle');
});

verifier('temps par défaut : sans temps fourni, le dessin est celui de fx.acc (comportement d’avant)', () => {
  const sc = scene(12, { mur: true }), fx = T.creer(12, 4);
  sc.avancer(fx, 2 + 3 * DT, i => i % 40 === 0 ? [{ type: 'contact', a: 1, b: 2, force: 6 }] : null);
  assert.ok(fx.acc > 0, 'il faut un reliquat de temps pour que la comparaison dise quelque chose');
  const oeil = [sc.poses[0].x, 1, sc.poses[0].z], a = [], b = [];
  T.dessiner(fx, a, oeil); const ja = JSON.stringify(a.map(o => [o.p, o.s, o.r, o.alpha]));
  T.dessiner(fx, b, oeil, fx.acc); const jb = JSON.stringify(b.map(o => [o.p, o.s, o.r, o.alpha]));
  assert.ok(a.length > 100, a.length + ' objets');
  assert.equal(ja, jb);
});

// Boucle d'images du jeu : pas fixes de 1/120 s, voitures dessinées entre leurs deux dernières poses (alpha = reste du
// pas / DT). À 144 Hz, une image sur six ne voit aucun pas : prolongés de fx.acc, les effets s'y figent ; avec
// l'instant continu de B.traces.extrapolation, ils avancent à chaque image, sans saut à la mise à jour de 30 Hz.
verifier('temps continu : à 144 Hz, chaque image avance les effets, sans saut à la mise à jour de 30 Hz', () => {
  const fx = T.creer(1, 3), co = { c: { longueur: 1000 }, voitures: [] }, f = fx.fumees[0];
  Object.assign(f, { actif: true, age: .2, vie: 3, x: 0, y: 1, z: 0, vx: 6, vy: .5, vz: 0, taille: 1, a0: .3 });
  let reste = 0;
  const continu = [], fige = [];
  for (let image = 0; image < 2 * 144; image++) {
    reste += 1 / 144;
    while (reste >= DT) { T.pas(fx, co, [], 0, DT, null); reste -= DT; }
    T.dessiner(fx, [], [0, 0, 0], T.extrapolation(fx, (1 - reste / DT) * DT)); continu.push(f.objet.p[0]);
    T.dessiner(fx, [], [0, 0, 0]); fige.push(f.objet.p[0]);
  }
  const pas = l => l.slice(1).map((x, i) => x - l[i]);
  const pc = pas(continu), pf = pas(fige);
  assert.ok(pc.every(d => d > 0), 'une image sans mouvement avec le temps continu');
  // La vitesse ne change qu'à la mise à jour (fumée amortie de 5 % par trentième de seconde). Juste après, l'instant
  // dessiné précède encore la mise à jour d'au plus un pas (h < 0) et se prolonge en arrière avec la vitesse neuve :
  // l'image de la mise à jour avance d'au plus DT × 5 % de vitesse en plus (6 % d'un pas d'image à 144 Hz), la
  // suivante de 5 % en moins. Un effet figé ou un saut d'un pas de simulation sortiraient de ±15 %.
  for (let i = 1; i < pc.length; i++) assert.ok(pc[i] >= .85 * pc[i - 1] && pc[i] <= 1.15 * pc[i - 1], `saut à l'image ${i} : ${pc[i - 1]} puis ${pc[i]}`);
  const figees = pf.filter(d => d === 0).length;
  assert.ok(figees >= 40, figees + ' images figées sur ' + pf.length + ' avec fx.acc (une sur six attendue)');
});

verifier('tri arrière : sans axe rien n’est écarté ; avec axe, seuls les effets loin derrière la caméra', () => {
  const fx = T.creer(1, 4);
  for (let i = 0; i < 41; i++) {
    Object.assign(fx.fumees[i], { actif: true, age: .5, vie: 3, x: i - 20, y: 1, z: 3, vx: 0, vy: 0, vz: 0, taille: 1, a0: .3 });
    const b = fx.bandes[i];
    Object.assign(b, { actif: true, age: 0, a0: .5 }); b.objet.p[0] = 2 * i - 40; b.objet.p[1] = 0; b.objet.p[2] = -3;
  }
  const oeil = [0, 1, 0], tous = [], devant = [], retro = [];
  T.dessiner(fx, tous, oeil, 0);
  T.dessiner(fx, devant, oeil, 0, [1, 0, 0]);
  T.dessiner(fx, retro, oeil, 0, [1, 0, 0], 10);
  assert.equal(tous.length, 82);
  for (const o of tous) {
    assert.equal(devant.includes(o), o.p[0] >= -4, 'marge de 4 m derrière le plan de la caméra : x = ' + o.p[0]);
    assert.equal(retro.includes(o), o.p[0] >= -14, 'rétroviseurs : 10 m de plus : x = ' + o.p[0]);
  }
});

verifier('compter : corps et dalles comptés, objet fourni rempli sans en créer', () => {
  const sc = scene(2), fx = T.creer(2, 1), c = {};
  sc.avancer(fx, .5);
  assert.strictEqual(T.compter(fx, c), c);
  assert.deepEqual(Object.keys(c).sort(), ['bandes', 'corps', 'dalles', 'debris', 'embruns', 'etincelles', 'fumees']);
  assert.ok(c.bandes > 0); assert.equal(c.corps, 0); assert.equal(c.dalles, 0);
  assert.deepEqual(T.compter(fx), c);
});

verifier('pièces en parabole : leur rotation suit le temps dessiné, comme leur position', () => {
  const sc = scene(1), fx = T.creer(1, 8);
  T.pas(fx, sc.co, sc.poses, 0, DT, [{ type: 'roue', roue: 0, id: 0 }]);
  const d = fx.debris.find(x => x.actif), r = d.objet.r;
  assert.ok(Math.abs(d.spin) > .1, 'rotation propre ' + d.spin);
  T.dessiner(fx, [], [0, 0, 0], 0); const r0 = r.slice();
  T.dessiner(fx, [], [0, 0, 0], .02);
  assert.ok(Math.abs(r[0] - r0[0] - d.spin * .02) < 1e-12 && Math.abs(r[2] - r0[2] - d.spin * .7 * .02) < 1e-12 && r[1] === r0[1]);
  // à la mise à jour suivante (un trentième de seconde après l'état des effets), l'état rattrape ce que le dessin
  // montrait pour cet instant (pièce encore en l'air : pas de rebond)
  T.dessiner(fx, [], [0, 0, 0], T.PAS); const prevu = r.slice(), p = d.objet.p.slice();
  while (fx.acc > 1e-9 || d.age === 0) T.pas(fx, sc.co, sc.poses, 0, DT, null);
  T.dessiner(fx, [], [0, 0, 0], 0);
  for (let k = 0; k < 3; k++) { assert.ok(Math.abs(r[k] - prevu[k]) < 1e-9, 'rotation ' + k); assert.ok(Math.abs(d.objet.p[k] - p[k]) < 1e-9, 'position ' + k); }
});

console.log('---');
console.log(compte + ' tests passes');
process.exit(0);
