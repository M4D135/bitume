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
for (const f of ['circuit.js', 'conduite.js', 'course.js', 'carene.js', 'main.js', 'voiture.js', 'traces.js']) charger(f);
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
