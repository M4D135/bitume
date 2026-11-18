// Vérifications des flammes et détonations d'échappement (src/echappement.js, lot 20) : embouchures prises sur les
// tubes de voiture.js, détonation dans sa fenêtre après un passage, crépitements du pied levé à haut régime et rien à
// bas régime, flammes répétées au rupteur, même suite et mêmes flammes à 30, 60, 120 images/s et à cadence variable,
// hasard propre (ni Math.random ni celui de la course), objets réutilisés, coût borné, même flamme de près et de
// loin ; puis une vraie course de 60 s où chaque passage montant à haut régime claque.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ici = path.dirname(fileURLToPath(import.meta.url));
const charger = f => createRequire(import.meta.url)(path.join(ici, '..', 'src', f));
for (const f of ['circuit.js', 'conduite.js', 'course.js', 'carene.js', 'main.js', 'voiture.js']) charger(f);
// les formes de flamme s'enregistrent auprès du moteur au chargement, comme celles de voiture.js
const enregistrees = [];
globalThis.window = { FRender: { forme: (nom, triangles) => enregistrees.push({ nom, n: triangles.length }) } };
charger('echappement.js');
delete globalThis.window;

const B = globalThis.BITUME, X = B.echappement, V = B.voiture, PC = B.conduite.PARAMS, DT = 1 / 120;

let compte = 0;
function verifier(nom, f) {
  try { f(); compte++; console.log(`ok  ${nom}`); } catch (e) { console.error(`KO  ${nom}`); console.error(e); process.exit(1); }
}

// ------------------------------------------------------------------ outils
// Voiture « nue » : l'état que lit echappement.js, mené pas à pas comme conduite.js (la coupure est décomptée avant un
// éventuel passage, qui la remet à rapportDuree).
const nue = o => ({ etat: Object.assign({ regime: 5000, gaz: 0, rapport: 3, v: 40, coupure: 0 }, o) });
const passer = (et, sens) => { et.rapport += sens; et.coupure = PC.rapportDuree; };
const POSE = { x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0 };

// File des sons lue au fil (elle est circulaire) : copies des événements
function lecteur(E) {
  const tout = []; let lu = 0;
  return () => {
    const F = E.son;
    for (; lu < F.n; lu++) { const e = F.liste[lu % F.taille]; tout.push({ voiture: e.voiture, genre: e.genre, t: e.t, force: e.force, variante: e.variante, hauteur: e.hauteur }); }
    return tout;
  };
}
// Joue `pasN` pas de simulation : programme(i, voitures) règle les états au pas i (temps t0 + i·DT)
function jouer(E, voitures, pasN, programme, t0 = 0, lire = lecteur(E)) {
  for (let i = 1; i <= pasN; i++) {
    for (const v of voitures) if (v.etat.coupure > 0) v.etat.coupure -= DT;
    programme(i, voitures);
    X.pas(E, voitures, t0 + i * DT);
    lire();
  }
  return lire();
}
// Montée de 3e en 4e au pas iPassage, pied à fond, après une montée en régime jusqu'à `regime`
const montee = (iPassage, regime = PC.monteeAuto) => (i, [v]) => {
  const et = v.etat;
  et.gaz = 1;
  if (i < iPassage) et.regime = Math.min(regime, 9000 + 30 * i);
  else if (i === iPassage) { passer(et, 1); et.regime = regime * .82; }
  else et.regime = Math.min(regime, et.regime + 10);
};
const dessin = (E, t, poses = [POSE], exclure = -1) => { const s = []; X.dessiner(E, s, poses, t, exclure); return s; };
// rôle d'un objet dessiné, d'après sa place parmi les objets préparés : 0 cœur, 1 langue, 2 bouffée
const role = (E, o) => E.objets.indexOf(o) % 3;
const langues = (E, s) => s.filter(o => role(E, o) === 1);
const dans = (x, a, b) => x >= a - 1e-9 && x <= b + 1e-9;
// Joue comme `jouer` et dessine chaque événement `delai` après lui, au premier pas qui le permet : l'anneau des
// flammes ne garde que les plus récentes, on dessine donc pendant la partie et non après.
function suivre(E, voitures, pasN, programme, delai, rappel) {
  const lire = lecteur(E);
  let j = 0;
  for (let i = 1; i <= pasN; i++) {
    for (const v of voitures) if (v.etat.coupure > 0) v.etat.coupure -= DT;
    programme(i, voitures);
    X.pas(E, voitures, i * DT);
    const tout = lire();
    while (j < tout.length && tout[j].t + delai <= i * DT) { rappel(tout[j], dessin(E, tout[j].t + delai)); j++; }
  }
  return lire();
}

// ------------------------------------------------------------------ géométrie
verifier('embouchures : le bout des quatre tubes de voiture.js', () => {
  for (const [nom, haut] of [['echappements-hauts', true], ['echappements-bas', false]]) {
    const f = V.FORMES[nom], sommets = [];
    for (const t of f.tri) for (let k = 0; k < 3; k++) sommets.push([0, 1, 2].map(a => f.centre[a] + f.taille[a] * t[k][a]));
    const xmin = Math.min(...sommets.map(p => p[0]));
    for (const cote of [-1, 1]) {
      const bout = sommets.filter(p => p[0] < xmin + .002 && Math.sign(p[2]) === cote);
      const y = bout.reduce((a, p) => a + p[1], 0) / bout.length, z = bout.reduce((a, p) => a + p[2], 0) / bout.length;
      const r = Math.max(...bout.map(p => Math.hypot(p[1] - y, p[2] - z)));
      const S = X.SORTIES.find(s => s.haut === haut && Math.sign(s.z) === cote);
      assert.ok(Math.abs(S.x - xmin) < .003 && Math.abs(S.y - y) < .003 && Math.abs(S.z - z) < .003, `${nom} ${cote} : ${xmin.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
      assert.ok(Math.abs(S.r - r) < .003, `rayon ${r.toFixed(4)} contre ${S.r}`);
    }
  }
});

verifier('repères : euler, attitude et angles comme voiture.js, sans allocation', () => {
  const m = new Float64Array(9), r = [0, 0, 0];
  let x = 12345;
  const alea = () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x / 4294967296; };
  for (let n = 0; n < 200; n++) {
    const a = (alea() - .5) * 7, b = (alea() - .5) * 1.2, c = (alea() - .5) * 1.2;
    const ref = V.euler(a, b, c).flat();
    X.eulerDans(a, b, c, m).forEach((v, i) => assert.ok(Math.abs(v - ref[i]) < 1e-12, 'euler'));
    const att = V.attitude(a, b, c).flat();
    X.attitudeDans(a, b, c, m).forEach((v, i) => assert.ok(Math.abs(v - att[i]) < 1e-12, 'attitude'));
    const ang = V.angles(V.attitude(a, b, c));
    X.anglesDans(m, r).forEach((v, i) => assert.ok(Math.abs(v - ang[i]) < 1e-9, 'angles'));
  }
});

verifier('formes : trois fuseaux fermés, normales vers dehors, enregistrés auprès du moteur', () => {
  assert.equal(X.FORMES.length, 3);
  assert.deepEqual(enregistrees.map(e => e.nom), ['bitume-flamme-0', 'bitume-flamme-1', 'bitume-flamme-2']);
  const sous = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const F of X.FORMES) {
    assert.ok(F.triangles > 200 && F.tri.length === F.triangles);
    // retour au repère d'origine : sommets p = centre + taille ∘ q, normales ∝ n ⊘ taille
    const P = q => q.map((v, a) => F.centre[a] + F.taille[a] * v), N = n => n.map((v, a) => v / F.taille[a]);
    const cle = p => p.map(v => Math.round(v * 1e5)).join(','), aretes = new Map();
    let volume = 0, accord = 0;
    for (const t of F.tri) {
      for (let k = 0; k < 3; k++) {
        for (const v of t[k]) assert.ok(v >= -.5 - 1e-9 && v <= .5 + 1e-9, 'dans le cube unité');
        const a = cle(t[k]), b = cle(t[(k + 1) % 3]), e = a < b ? a + '|' + b : b + '|' + a;
        aretes.set(e, (aretes.get(e) || 0) + 1);
      }
      const a = P(t[0]), b = P(t[1]), c = P(t[2]), n = [N(t[3]), N(t[4]), N(t[5])].reduce((m, v) => [m[0] + v[0], m[1] + v[1], m[2] + v[2]]);
      volume += scal(a, croix(b, c)) / 6;
      if (scal(n, croix(sous(b, a), sous(c, a))) > 0) accord++;
    }
    assert.ok([...aretes.values()].every(c => c === 2), 'chaque arête partagée par deux triangles : volume fermé');
    assert.ok(volume > .05, `${F.nom} : volume ${volume.toFixed(3)}, triangles tournés vers dehors`);
    assert.ok(accord / F.tri.length > .97, `${F.nom} : ${(100 * accord / F.tri.length).toFixed(1)} % de normales dans le sens des faces`);
  }
});

verifier('placement : la base de la langue sort de l’embouchure, voiture tournée, cabrée et penchée', () => {
  const E = X.creer(1, 3), v = nue({ regime: 9000, gaz: 1 });
  const tDet = jouer(E, [v], 240, montee(120)).find(e => e.genre === 'detonation').t;
  const pose = { x: 12, y: 3, z: -40, cap: 2.3, tangage: .08, roulis: -.12 };
  const s = langues(E, dessin(E, tDet + .02, [pose]));
  assert.equal(s.length, 4, 'quatre langues à la détonation');
  const M = V.attitude(pose.cap, pose.tangage, pose.roulis);
  for (const o of s) {
    const F = X.FORMES.find(f => f.nom === o.shape), R = V.euler(o.r[0], o.r[1], o.r[2]);
    // le moteur pose un sommet normalisé q en p + R·(s ∘ q) ; la base du fuseau est le point x = 0 de l'axe
    const q = [0, 1, 2].map(a => (0 - F.centre[a]) / F.taille[a]), base = V.mul(R, [0, 1, 2].map(a => o.s[a] * q[a])).map((w, a) => w + o.p[a]);
    const S = X.SORTIES.reduce((m, S) => {
      const w = V.mul(M, [S.x + X.RENTREE, S.y, S.z]).map((w, a) => w + [pose.x, pose.y, pose.z][a]);
      const d = Math.hypot(w[0] - base[0], w[1] - base[1], w[2] - base[2]);
      return d < m.d ? { d, S } : m;
    }, { d: Infinity });
    assert.ok(S.d < 1e-6, `base à ${S.d} m de l'embouchure`);
    // la langue part vers l'arrière de la voiture
    const axe = V.mul(R, [-1, 0, 0]), arriere = V.mul(M, [-1, 0, 0]);
    assert.ok(axe[0] * arriere[0] + axe[1] * arriere[1] + axe[2] * arriere[2] > .93, 'langue vers l’arrière');
  }
});

// ------------------------------------------------------------------ décisions
verifier('passage montant à haut régime : détonation 12 à 55 ms après, quatre langues lisibles', () => {
  let seconds = 0;
  for (let g = 0; g < 200; g++) {
    const E = X.creer(1, g), tP = 240 * DT;
    const ev = jouer(E, [nue({ regime: 9000, gaz: 1 })], 420, montee(240));
    const det = ev.filter(e => e.genre === 'detonation');
    assert.equal(det.length, 1, 'une détonation, graine ' + g);
    assert.ok(dans(det[0].t, tP + X.PARAMS.fenetre[0], tP + X.PARAMS.fenetre[1]), `détonation à ${(det[0].t - tP) * 1000} ms`);
    assert.ok(det[0].force > .9, 'pied à fond au plein régime : la plus forte');
    const second = ev.filter(e => e.genre === 'crepitement' && e.t < tP + .2);
    if (second.length) { seconds++; assert.ok(dans(second[0].t, tP + X.PARAMS.second[0], tP + X.PARAMS.second[1])); }
    assert.equal(dessin(E, tP + X.PARAMS.fenetre[0] - .001).length, 0, 'rien avant la fenêtre');
    if (g < 40) {
      const s = langues(E, dessin(E, det[0].t + .015));
      assert.equal(s.length, 4, 'une langue par sortie');
      for (const o of s) { assert.ok(o.alpha > .5 && o.emissive > 2, 'vive'); assert.ok(o.s[0] > .4, `longue : ${o.s[0].toFixed(2)} m`); }
      assert.equal(langues(E, dessin(E, det[0].t + .2)).length, 0, 'éteinte 0,2 s après');
    }
  }
  assert.ok(seconds > 60 && seconds < 120, seconds + ' seconds claquements sur 200');
});

verifier('passages sans flamme : bas régime, au pas, marche arrière, saut de rapport', () => {
  for (let g = 0; g < 50; g++) {
    assert.equal(jouer(X.creer(1, g), [nue({ gaz: 1 })], 300, montee(200, 6500)).length, 0, 'passage à 6 500 tr/min');
    assert.equal(jouer(X.creer(1, g), [nue({ v: 3 })], 300, montee(200)).length, 0, 'à 3 m/s');
    const recul = (i, [v]) => { v.etat.gaz = 1; v.etat.regime = 12300; if (i === 200) { v.etat.rapport = -1; v.etat.coupure = 0; } };
    assert.equal(jouer(X.creer(1, g), [nue({ rapport: 1 })], 300, recul).filter(e => e.genre === 'detonation').length, 0, 'vers la marche arrière');
    // saut de deux rapports d'un pas à l'autre (état repris, pas un passage de la boîte) : rien ne claque, même à
    // 12 300 tr/min pied à fond, où un vrai passage claque toujours
    const saut = (i, [v]) => { v.etat.gaz = 1; v.etat.regime = 12300; if (i === 200) { v.etat.rapport = 5; v.etat.coupure = PC.rapportDuree; } };
    assert.equal(jouer(X.creer(1, g), [nue({ rapport: 3 })], 300, saut).filter(e => e.genre === 'detonation').length, 0, 'saut de 3e en 5e');
  }
});

verifier('rétrogradage pied levé : claque moins souvent et relance les crépitements', () => {
  let claque = 0;
  for (let g = 0; g < 200; g++) {
    const prog = (i, [v]) => {
      const et = v.etat;
      if (i <= 120) { et.gaz = 1; et.regime = 11000; return; }
      et.gaz = 0;
      if (i === 400) { passer(et, -1); et.regime = 11000; } else et.regime = Math.max(9000, et.regime - 5);
    };
    const ev = jouer(X.creer(1, g), [nue({ rapport: 4 })], 520, prog), t = 400 * DT;
    if (ev.some(e => e.genre === 'detonation' && dans(e.t, t + .012, t + .055))) claque++;
    assert.ok(ev.some(e => e.genre === 'crepitement' && e.t > t + .01 && e.t < t + .2), 'crépitements relancés, graine ' + g);
  }
  assert.ok(claque > 80 && claque < 160, claque + ' rétrogradages sur 200 claquent');
});

verifier('lever de pied à haut régime : crépitements irréguliers, bleus ou orangés, des deux bancs ; rien à bas régime', () => {
  let n = 0, bleus = 0, orange = 0, gauche = 0, droite = 0, vus = 0;
  const intervalles = new Set();
  // pied à fond 1 s à 11 000 tr/min, puis levé : le régime retombe lentement sans passer sous 8 600
  const prog = (i, [v]) => { const et = v.etat; if (i <= 120) { et.gaz = 1; et.regime = 11000; } else { et.gaz = 0; et.regime = Math.max(8600, 11000 - 10 * (i - 120)); } };
  for (let g = 0; g < 100; g++) {
    const E = X.creer(1, g);
    const ev = suivre(E, [nue({ rapport: 4 })], 360, prog, .012, (e, s) => {
      if (e.genre !== 'crepitement') return;
      const l = langues(E, s);
      if (l.length) vus++;
      for (const o of l) { if (o.color[2] > o.color[0]) bleus++; else orange++; if (o.p[2] < 0) gauche++; else droite++; }
    }).filter(e => e.genre === 'crepitement');
    assert.ok(ev.length >= 3, ev.length + ' crépitements, graine ' + g);
    assert.ok(dans(ev[0].t, 1 + .016, 1 + .066 + DT), 'le premier part 16 à 66 ms après le lever');
    assert.ok(ev.every(e => e.t < 1 + X.PARAMS.crepitementDuree + .01), 'l’épisode s’éteint');
    for (let i = 1; i < ev.length; i++) intervalles.add(Math.round((ev[i].t - ev[i - 1].t) * 1000));
    n += ev.length;
  }
  assert.ok(vus > .95 * n, `une flamme à chaque crépitement : ${vus} sur ${n}`);
  assert.ok(intervalles.size > 20, 'intervalles irréguliers : ' + intervalles.size + ' valeurs');
  assert.ok(bleus / (bleus + orange) > .12 && bleus / (bleus + orange) < .4, `bleus ${bleus}, orangés ${orange}`);
  assert.ok(gauche > .3 * (gauche + droite) && droite > .3 * (gauche + droite), `gauche ${gauche}, droite ${droite}`);
  console.log(`    ${(n / 100).toFixed(1)} crépitements par lever de pied en moyenne`);
  for (const [regime, gaz] of [[6000, 0], [8000, 0], [11000, .3]]) {
    for (let g = 0; g < 30; g++) {
      const p = (i, [v]) => { v.etat.gaz = i <= 120 ? 1 : gaz; v.etat.regime = regime; };
      assert.equal(jouer(X.creer(1, g), [nue({ rapport: 4 })], 400, p).length, 0, `rien à ${regime} tr/min, gaz ${gaz}`);
    }
  }
});

verifier('rupteur entretenu : flammes répétées au rythme des coupures ; moins fortes à l’arrêt ; un épisode par séjour', () => {
  const tenir = (vit, bascule) => (i, [v]) => { const et = v.etat; et.gaz = 1; et.v = vit; et.regime = bascule ? (Math.floor(i / 8) % 2 ? 12420 : 12800) : 12800; };
  let lance = 0, arret = 0, rebond = 0;
  for (let g = 0; g < 50; g++) {
    const E = X.creer(1, g), ev = jouer(E, [nue({ rapport: 5 })], 360, tenir(50)).filter(e => e.genre === 'rate');
    assert.ok(ev.length >= 10, ev.length + ' ratés en 3 s, graine ' + g);
    for (let i = 1; i < ev.length; i++) {
      const d = (ev[i].t - ev[i - 1].t) / X.PARAMS.cadenceRupteur;
      assert.ok(d > .6 && Math.abs(d - Math.round(d)) < .35, 'au rythme des coupures : ' + d.toFixed(2));
    }
    // une flamme à chaque raté, dans deux sorties au moins (un banc, ou les quatre)
    const E2 = X.creer(1, g);
    suivre(E2, [nue({ rapport: 5 })], 360, tenir(50), .015, (e, s) => { if (e.genre === 'rate') assert.ok(langues(E2, s).length >= 2, 'flammes au raté de ' + e.t.toFixed(3) + ' s'); });
    lance += ev.length;
    const ea = jouer(X.creer(1, g), [nue({ rapport: 1 })], 360, tenir(0)).filter(e => e.genre === 'rate');
    arret += ea.length;
    assert.ok(ea.every(e => e.force <= .75 * .95 + 1e-6), 'à l’arrêt, plus faibles');
    const eb = jouer(X.creer(1, g), [nue({ rapport: 1 })], 360, tenir(0, true)).filter(e => e.genre === 'rate');
    for (let i = 1; i < eb.length; i++) assert.ok(eb[i].t - eb[i - 1].t > .06, 'le rebond du rupteur (66 ms) n’ouvre pas d’épisode');
    rebond += eb.length;
  }
  assert.ok(lance / 50 > 16 && lance / 50 < 26, `${(lance / 50).toFixed(1)} ratés en 3 s lancé`);
  assert.ok(arret / 50 > 9 && arret / 50 < 18 && arret < lance, `${(arret / 50).toFixed(1)} ratés en 3 s à l'arrêt`);
  assert.ok(rebond / 50 < 18, `${(rebond / 50).toFixed(1)} ratés en 3 s sur le rebond`);
});

verifier('voiture hors course : accident, remise en piste, abandon, épave ; rien, et la détonation en attente s’annule', () => {
  for (const panne of [et => { et.accident = { t: 0 }; }, et => { et.recuperation = { t: 0 }; }, (et, v) => { v.abandon = true; }, et => { et.degats = { casse: true }; }, et => { et.reparation = 1; }]) {
    const E = X.creer(1, 9), v = nue({ regime: 9000, gaz: 1 });
    const prog = (i, vs) => { montee(120)(i, vs); if (i === 121) panne(v.etat, v); };
    const ev = jouer(E, [v], 400, prog);
    assert.equal(ev.length, 0, 'aucun événement');
    assert.equal(dessin(E, 121 * DT + .03).length, 0);
  }
});

verifier('horloge reprise en arrière : nouvelle séance, rien ne reste en attente', () => {
  const E = X.creer(1, 4), v = nue({ regime: 9000, gaz: 1 });
  jouer(E, [v], 121, montee(120));
  assert.ok(E.attT[0] < Infinity, 'détonation en attente');
  X.pas(E, [v], .5);
  assert.equal(E.attT[0], Infinity); assert.equal(dessin(E, 1.03).length, 0);
});

// ------------------------------------------------------------------ cadence, hasard, mémoire
// Boucle du jeu (jeu.js) en temps entier, unités de 1/240 s : pas fixe de 2 unités, une image toutes les `image(n)`
// unités ; à chaque pas, la course puis l'échappement ; à chaque image, le dessin à l'instant interpolé
// (horloge − DT + reste), sur les poses de la course.
function boucle(scenario, image, secondes) {
  const sc = scenario(), E = X.creer(sc.voitures.length, 77), lire = lecteur(E), images = new Map();
  let acc = 0, pas = 0, n = 0;
  while (pas * 2 < secondes * 240) {
    acc += image(n++);
    while (acc >= 2) { pas++; sc.pas(pas); X.pas(E, sc.voitures, sc.horloge()); lire(); acc -= 2; }
    const u = pas * 2 - 2 + acc, s = [];
    X.dessiner(E, s, sc.poses(), u / 240);
    images.set(u, s.map(o => [o.shape, ...o.p, ...o.s, ...o.r, o.alpha, ...o.color, o.emissive].join(' ')).join('\n'));
  }
  return { evenements: lire(), images };
}
function vraieCourse(graine = 5) {
  return () => {
    const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
    const co = B.course.creer(c, { mode: 'course', tours: 3, difficulte: 1, rivaux: 11, graine, placeJoueur: 8 });
    const poses = co.voitures.map(() => ({}));
    return {
      co, voitures: co.voitures,
      pas: () => { B.course.pas(co, B.course.commandesIA(co, co.joueur), DT); },
      horloge: () => co.horloge,
      poses: () => {
        co.voitures.forEach((v, k) => {
          const et = v.etat, e = B.circuit.echantillon(c, et.s), p = poses[k];
          p.x = e.x - Math.sin(e.cap) * et.d; p.y = et.y; p.z = e.z + Math.cos(e.cap) * et.d;
          p.cap = e.cap + et.psi + et.beta; p.tangage = et.tangage; p.roulis = et.roulis;
        });
        return poses;
      }
    };
  };
}

verifier('30, 60, 120 images/s et cadence variable : même suite d’événements, mêmes flammes aux mêmes instants', () => {
  const duree = 24, ref = boucle(vraieCourse(), () => 1, duree);
  assert.ok(ref.evenements.length > 100, ref.evenements.length + ' événements en ' + duree + ' s');
  for (const g of ['detonation', 'crepitement', 'rate']) assert.ok(ref.evenements.some(e => e.genre === g), g + ' présent');
  let x = 99;
  const variable = () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return 1 + (x >>> 8) % 13; };   // de 1/240 à 1/18 s
  for (const [nom, image] of [['30', () => 8], ['60', () => 4], ['120', () => 2], ['variable', variable]]) {
    const r = boucle(vraieCourse(), image, duree);
    assert.deepEqual(r.evenements, ref.evenements, nom + ' images/s : même suite');
    let comparees = 0, flammes = 0;
    for (const [u, s] of r.images) if (ref.images.has(u)) { assert.equal(s, ref.images.get(u), nom + ' : même dessin à ' + u / 240 + ' s'); comparees++; if (s) flammes++; }
    assert.ok(comparees > duree * 15 && flammes > 20, `${nom} : ${comparees} images comparées, ${flammes} avec des flammes`);
  }
});

verifier('hasard propre : ni Math.random ni le hasard de la course ; chaque voiture ne dépend que d’elle et de la graine', () => {
  // la course seule, puis la course avec l'échappement à chaque pas et un dessin par image : mêmes voitures au bout
  const etats = avec => {
    const sc = vraieCourse(8)(), E = avec ? X.creer(12, 8) : null, s = [], vrai = Math.random;
    let dedans = false, appels = 0;
    Math.random = function () { if (dedans) appels++; return vrai.apply(this, arguments); };
    try {
      for (let i = 1; i <= 120 * 20; i++) {
        sc.pas(i);
        if (E) { dedans = true; X.pas(E, sc.voitures, sc.horloge()); if (i % 2 === 0) { s.length = 0; X.dessiner(E, s, sc.poses(), sc.horloge()); } dedans = false; }
      }
    } finally { Math.random = vrai; }
    if (E) assert.ok(E.son.n > 50, 'l’échappement a travaillé : ' + E.son.n);
    assert.equal(appels, 0, 'Math.random appelé ' + appels + ' fois');
    return sc.voitures.map(v => [v.etat.s, v.etat.d, v.etat.v, v.etat.regime, v.etat.rapport, v.etat.psi].join(' '));
  };
  assert.deepEqual(etats(true), etats(false), 'la course est la même avec ou sans échappement');
  // une voiture seule, ou parmi onze autres qui crachent : sa suite ne change pas
  const prog = (i, vs) => vs.forEach((v, k) => {
    const et = v.etat, ph = (i + 37 * k) % 300;
    et.gaz = ph < 200 ? 1 : 0; et.regime = ph < 200 ? Math.min(12800, 9000 + 25 * ph) : 11000 - 5 * (ph - 200);
    if (ph === 160) passer(et, 1);
  });
  const seule = jouer(X.creer(12, 21), [nue({ rapport: 3 })], 1500, prog);
  const flotte = jouer(X.creer(12, 21), Array.from({ length: 12 }, () => nue({ rapport: 3 })), 1500, prog).filter(e => e.voiture === 0);
  assert.ok(seule.length > 20);
  assert.deepEqual(flotte, seule, 'la voiture 0 garde sa suite');
  const autre = jouer(X.creer(12, 22), [nue({ rapport: 3 })], 1500, prog);
  assert.notDeepEqual(autre.map(e => e.t), seule.map(e => e.t), 'une autre graine, une autre suite');
  assert.deepEqual(jouer(X.creer(12, 21), [nue({ rapport: 3 })], 1500, prog), seule, 'même graine, même suite');
});

// douze voitures qui crachent tout le temps : rupteur, passages, levers de pied décalés
function flotteEnFeu() {
  const voitures = Array.from({ length: 12 }, (_, k) => nue({ rapport: 3, v: 20 + 4 * k })), poses = voitures.map((v, k) => ({ x: 6 * k, y: 0, z: 3 * (k % 3), cap: .3 * k, tangage: 0, roulis: 0 }));
  const prog = i => voitures.forEach((v, k) => {
    const et = v.etat, ph = (i + 23 * k) % 120;
    if (et.coupure > 0) et.coupure -= DT;
    et.gaz = ph < 70 ? 1 : 0; et.regime = ph < 70 ? 12800 : 11500;
    if (ph === 60) { passer(et, et.rapport < 5 ? 1 : -1); }
  });
  return { voitures, poses, prog };
}

verifier('mémoire : mêmes objets d’une image à l’autre, rien d’ajouté ni de recréé', () => {
  const f = flotteEnFeu(), E = X.creer(12, 5), objets = new Set(E.objets), n0 = E.objets.length;
  const tableaux = E.objets.map(o => [o.p, o.s, o.r, o.color]), cles = E.objets.map(o => Object.keys(o).join()), file = E.son.liste.slice();
  const sortie = [];
  let max = 0;
  for (let i = 1; i <= 1200; i++) {
    f.prog(i); X.pas(E, f.voitures, i * DT);
    sortie.length = 0; X.dessiner(E, sortie, f.poses, i * DT - DT / 2);
    max = Math.max(max, sortie.length);
    for (const o of sortie) assert.ok(objets.has(o), 'objet préparé');
  }
  assert.ok(max > 60, max + ' objets au plus');
  assert.equal(E.objets.length, n0);
  E.objets.forEach((o, i) => { assert.ok(o.p === tableaux[i][0] && o.s === tableaux[i][1] && o.r === tableaux[i][2] && o.color === tableaux[i][3], 'tableaux gardés'); assert.equal(Object.keys(o).join(), cles[i], 'aucune propriété ajoutée'); });
  assert.ok(E.son.liste.every((e, i) => e === file[i]), 'file des sons gardée');
  assert.equal(E.objets.length, 12 * X.OBJETS_PAR_VOITURE);
});

verifier('coût borné : douze voitures en feu, au plus trois objets par sortie', () => {
  const f = flotteEnFeu(), E = X.creer(12, 6), sortie = [];
  for (let i = 1; i <= 240; i++) { f.prog(i); X.pas(E, f.voitures, i * DT); }
  let tPas = 0, tDessin = 0, max = 0, somme = 0;
  const N = 3000;
  for (let i = 241; i < 241 + N; i++) {
    f.prog(i);
    let t = performance.now(); X.pas(E, f.voitures, i * DT); tPas += performance.now() - t;
    sortie.length = 0;
    t = performance.now(); X.dessiner(E, sortie, f.poses, i * DT); tDessin += performance.now() - t;
    max = Math.max(max, sortie.length); somme += sortie.length;
  }
  assert.ok(max <= 12 * X.OBJETS_PAR_VOITURE, max + ' objets');
  console.log(`    pas : ${(1000 * tPas / N).toFixed(1)} µs pour 12 voitures ; dessin : ${(1000 * tDessin / N).toFixed(1)} µs, ${(somme / N).toFixed(1)} objets en moyenne, ${max} au plus`);
  assert.ok(tPas / N < .2 && tDessin / N < 1, 'coût par pas et par image');
});

verifier('de près comme au loin, la même flamme, cœur et bouffée compris ; cockpit : la voiture du pilote n’est pas dessinée', () => {
  const E = X.creer(2, 11), vs = [nue({ regime: 9000, gaz: 1 }), nue({ regime: 9000, gaz: 1 })];
  const ev = jouer(E, vs, 300, (i, l) => l.forEach(v => montee(120)(i, [v]))).filter(e => e.genre === 'detonation');
  assert.equal(ev.length, 2);
  // rien ne s'efface au loin (règle du lot 5B) : les deux voitures posées à 10 m, 45 m, 150 m puis 1 km de l'origine
  // donnent les mêmes objets, à la même place par rapport à la voiture. Les objets sont réutilisés d'un dessin à
  // l'autre : relever leurs valeurs aussitôt.
  const t = Math.max(ev[0].t, ev[1].t) + .02, poses = d => [{ ...POSE, x: d }, { ...POSE, x: d, z: 4 }];
  const releve = d => dessin(E, t, poses(d)).map(o => [o.shape, role(E, o), o.alpha, o.emissive, ...o.s, ...o.r, ...o.color, o.p[0] - d, o.p[1], o.p[2]]
    .map(v => typeof v === 'number' ? v.toFixed(6) : v).join(' ')).sort().join('\n');
  const pres = releve(10), roles = dessin(E, t, poses(10)).map(o => role(E, o));
  assert.equal(roles.filter(r => r === 1).length, 8, 'quatre langues par voiture');
  assert.equal(roles.filter(r => r === 0).length, 8, 'un cœur dans chaque langue');
  for (const d of [45, 150, 1000]) assert.equal(releve(d), pres, `la même flamme à ${d} m`);
  const cockpit = dessin(E, t, poses(10), 0);
  assert.ok(cockpit.length > 0 && cockpit.every(o => o.p[2] > 2), 'exclure : seule la voiture 1 reste');
});

verifier('vraie course de 60 s : chaque passage montant à haut régime claque, valeurs finies', () => {
  const sc = vraieCourse(5)(), co = sc.co, E = X.creer(co.voitures.length, 5), lire = lecteur(E), sortie = [];
  const montees = [], avant = co.voitures.map(v => v.etat.regime);
  let max = 0, somme = 0, images = 0;
  for (let i = 1; i <= 60 * 120; i++) {
    co.voitures.forEach((v, k) => { avant[k] = v.etat.regime; });
    const ev = B.course.pas(co, B.course.commandesIA(co, co.joueur), DT);
    for (const e of ev) if (e.type === 'rapport' && e.haut) {
      const v = co.voitures[e.id], et = v.etat;
      if (avant[e.id] >= 12000 && Math.abs(et.v) > 4 && !et.accident && !et.recuperation && !v.abandon) montees.push({ k: e.id, t: co.horloge });
    }
    X.pas(E, co.voitures, co.horloge); lire();
    if (i % 2 === 0) {
      sortie.length = 0; X.dessiner(E, sortie, sc.poses(), co.horloge - DT / 2);
      max = Math.max(max, sortie.length); somme += sortie.length; images++;
      for (const o of sortie) for (const x of [...o.p, ...o.s, ...o.r, o.alpha, ...o.color, o.emissive]) assert.ok(Number.isFinite(x), 'valeur finie');
    }
  }
  const ev = lire(), det = ev.filter(e => e.genre === 'detonation');
  assert.ok(montees.length > 40, montees.length + ' passages montants');
  for (const m of montees) assert.ok(det.some(d => d.voiture === m.k && dans(d.t, m.t + X.PARAMS.fenetre[0], m.t + X.PARAMS.fenetre[1])), `passage de la voiture ${m.k} à ${m.t.toFixed(3)} s sans détonation`);
  const n = g => ev.filter(e => e.genre === g).length;
  assert.ok(n('crepitement') > 0 && n('rate') > 0);
  console.log(`    ${montees.length} passages montants, ${det.length} détonations, ${n('crepitement')} crépitements, ${n('rate')} ratés en 60 s ; ${(somme / images).toFixed(1)} objets par image en moyenne, ${max} au plus`);
});

console.log('---');
console.log(compte + ' tests passes');
process.exit(0);
