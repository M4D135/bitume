// Lot 2 : pièces détachées sous budget, corps qui s'éteignent, libération sûre, dégâts persistants.
// Les pièces roulent avec FPhysX en navigateur ; ici un faux monde tient la comptabilité des corps, ce qui ne
// qualifie pas la physique du navigateur (le dit la fiche) mais bien la gestion des corps par le jeu.
// Fluidité : un seul monde PhysX pour la page, chauffé à sa naissance, vidé (jamais détruit) d'une séance à l'autre ;
// le vrai module FERRO est essayé à part (physx-monde.test.mjs).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = process.env.BITUME_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
for (const f of ['circuit', 'conduite', 'degats', 'contacts', 'course', 'carene', 'main', 'voiture', 'traces']) req(path.join(root, 'src', f + '.js'));
const B = globalThis.BITUME, DG = B.degats, DT = 1 / 120, results = [];
const vraiEchantillon = B.circuit.echantillon;
function check(name, fn) { try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e && e.message }); } }
const plat = (c, s) => ({ x: s, y: 0, z: 0, cap: 0, courbure: 0, pente: 0, devers: 0, ligne: 0, vitesse: 50 });
B.circuit.echantillon = plat;                       // les séances fabriquées à la main n'ont pas de vrai tracé
const c10 = { longueur: 10000, largeur: 40, limite: 20 };
function posesDe(n, s = 100) { return Array.from({ length: n }, (_, k) => ({ x: s + k * 40, y: 0, z: k * 40, cap: 0, tangage: 0, roulis: 0, s: s + k * 40 })); }
function courseDe(n) {
  return { c: c10, horloge: 0, voitures: Array.from({ length: n }, (_, k) => ({ id: k, couleur: [.7, .1, .08], etat: { s: 100 + k * 40, d: 0, v: 40, psi: 0, beta: 0, degats: DG.creer() } })) };
}
function evements(n, type = 'casse') {
  const ev = [];
  for (let k = 0; k < n; k++) {
    if (type === 'casse') { for (let w = 0; w < 4; w++) ev.push({ type: 'roue', roue: w, id: k }); ev.push({ type: 'casse', force: 40, id: k, cote: 1, avant: true }); }
    else ev.push({ type: 'roue', roue: 0, id: k });
  }
  return ev;
}

// ------------------------------------------------------------------ faux monde PhysX
function fauxMonde() {
  const w = { corps: new Map(), next: 1, statiques: [], pas: 0, detruit: false, poses: new Map(), vitesses: new Map() };
  w.addBox = (pos, demi, o) => { const id = w.next++; w.corps.set(id, { pos, demi, o }); return id; };
  w.remove = id => { if (!w.corps.has(id)) throw new Error('corps inconnu ' + id); w.corps.delete(id); };
  w.setVelocity = (id, v) => { if (w.corps.has(id)) w.vitesses.set(id, v.slice()); };
  w.readPose = id => { const e = w.corps.get(id); if (!e) return null; const p = w.poses.get(id) || e.pos; return [p[0], p[1], p[2], 0, 0, 0, 1]; };
  w.readVelocity = id => (w.corps.has(id) ? (w.vitesses.get(id) || [0, 0, 0]) : null);
  w.setStatics = l => { w.statiques = l.slice(); };
  w.step = () => { w.pas++; };
  w.dispose = () => { if (w.detruit) throw new Error('monde déjà détruit'); w.detruit = true; w.corps.clear(); };
  return w;
}
function brancherPhysX(monde) {
  globalThis.FPhysX = { isReady: () => true, createWorld: () => monde };
  return () => { delete globalThis.FPhysX; };
}
// Module factice qui garde les mondes qu'il a créés ; fabrique() en rend un neuf à chaque création.
function modulePhysX(fabrique = fauxMonde) {
  const X = { mondes: [], isReady: () => true, createWorld: () => { const w = fabrique(); X.mondes.push(w); return w; } };
  globalThis.FPhysX = X;
  return X;
}
const PIECES = B.traces.PIECES_PAR_VOITURE;
const dalles = fx => fx.sols.reduce((a, g) => a.concat(g.boites), []);

// ------------------------------------------------------------------ budget de pièces
check('budget : douze voitures en casse simultanée tiennent sous le plafond du pool', () => {
  const fx = B.traces.creer(12, 5), co = courseDe(12), poses = posesDe(12);
  B.traces.pas(fx, co, poses, 0, DT, evements(12));
  const n = B.traces.compter(fx).debris;
  assert.equal(n, 12 * B.traces.PIECES_PAR_VOITURE);
  assert.ok(n <= B.traces.DEBRIS, n + ' > ' + B.traces.DEBRIS);
  // Les débris de 12ABC portent les vraies formes du pneu : 24 avant + 24 arrière, aux mêmes cotes.
  const roues = fx.debris.filter(d => d.actif && d.objet.shape.startsWith('bitume-pneu-'));
  const attendues = Array.from({ length: 12 }, () => B.voiture.ROUES.map(w =>
    B.voiture.ROUES_FORMES[w.avant ? 'av' : 'ar'].slicks[1])).flat();
  assert.equal(roues.length, 48);
  assert.deepEqual(roues.map(d => [d.objet.shape, ...d.objet.s]).sort(), attendues.map(f => [f.nom, ...f.taille]).sort());
});
check('budget : une voiture ne peut pas déborder sur le quota d une autre', () => {
  const fx = B.traces.creer(2, 6), co = courseDe(2), poses = posesDe(2);
  for (let k = 0; k < 6; k++) B.traces.pas(fx, co, poses, 0, DT, evements(1));   // six casses de la voiture 0
  assert.equal(fx.pieces[0], B.traces.PIECES_PAR_VOITURE);
  assert.equal(fx.pieces[1], 0);
  assert.equal(B.traces.compter(fx).debris, B.traces.PIECES_PAR_VOITURE);
});
check('budget : le remplacement d une voiture rouvre son quota', () => {
  const fx = B.traces.creer(1, 7), co = courseDe(1), poses = posesDe(1);
  B.traces.pas(fx, co, poses, 0, DT, evements(1));
  assert.equal(fx.pieces[0], B.traces.PIECES_PAR_VOITURE);
  B.traces.pas(fx, co, poses, 0, DT, [{ repositionnement: true, id: 0 }]);
  assert.equal(fx.pieces[0], 0);
  B.traces.pas(fx, co, poses, 0, DT, evements(1));
  assert.equal(fx.pieces[0], B.traces.PIECES_PAR_VOITURE);
});
check('plafond : mille pièces réclamées ne dépassent jamais la taille du pool', () => {
  const fx = B.traces.creer(12, 8), co = courseDe(12), poses = posesDe(12);
  for (let k = 0; k < 40; k++) {
    for (const v of co.voitures) { v.etat.s += 200; fx.pieces[v.id] = 0; }        // on vide le quota pour saturer le pool
    B.traces.pas(fx, co, poses, 0, DT, evements(12));
    assert.ok(B.traces.compter(fx).debris <= B.traces.DEBRIS);
  }
});
check('plafond : quand il faut sacrifier, c est la pièce la plus vieille qui cède', () => {
  const fx = B.traces.creer(12, 9), co = courseDe(12), poses = posesDe(12);
  const vagues = ids => ids.map(k => ({ type: 'roue', roue: 0, id: k })).concat(ids.map(k => ({ type: 'panneau', id: k })));
  B.traces.pas(fx, co, poses, 0, DT, vagues([0, 1, 2, 3, 4, 5]));                 // première vague
  for (let k = 0; k < 600; k++) B.traces.pas(fx, co, poses, 0, DT, []);           // 5 s : elle vieillit
  B.traces.pas(fx, co, poses, 0, DT, evements(6));                                // seconde vague, fraîche
  const vieilles = fx.debris.filter(d => d.actif && d.age > 4).length;
  assert.equal(vieilles, 12, 'la première vague devrait être là');
  for (const v of co.voitures) fx.pieces[v.id] = 0;
  B.traces.pas(fx, co, poses, 0, DT, evements(12));                               // de quoi saturer le pool
  assert.ok(B.traces.compter(fx).debris <= B.traces.DEBRIS);
  assert.equal(fx.debris.filter(d => d.actif && d.age > 4).length, 0, 'aucune vieille pièce n a été sacrifiée');
});
check('panneau arraché sur choc violent, du côté de la normale, sans dépasser le budget', () => {
  const fx = B.traces.creer(2, 10), co = courseDe(2), poses = posesDe(2);
  B.traces.pas(fx, co, poses, 0, DT, [{ type: 'contact', a: 0, b: 1, force: 25 }]);
  assert.equal(B.traces.compter(fx).debris, 2);                                    // un panneau par voiture
  assert.equal(fx.pieces[0], 1); assert.equal(fx.pieces[1], 1);
});

// ------------------------------------------------------------------ pièces et caisse cohérentes
check('cohérence : une pièce détachée ne reste pas dessinée sur la voiture', () => {
  const mod = B.voiture.modele({ couleur: [.7, .1, .08], seconde: [.9, .9, .9], casque: [1, 1, 1], combinaison: [.5, .5, .5], numero: 7 });
  const pose = { p: [0, 0, 0], cap: 0 }, intact = [], sansRoues = [], epave = [];
  B.voiture.poser(mod, pose, intact);
  B.voiture.poser(mod, pose, sansRoues, { roues: [true, false, false, true] });
  B.voiture.poser(mod, pose, epave, { casse: true, roues: [true, true, true, true] });
  assert.ok(sansRoues.length < intact.length, 'des pièces de roue se dessinent encore');
  assert.ok(epave.length < intact.length / 4);
  assert.ok(mod.epave.some(p => p.pilote), 'la cellule du pilote doit rester');
});

// ------------------------------------------------------------------ corps qui s'éteignent
check('repos : la pièce posée quitte la simulation et reste dessinée', () => {
  const monde = fauxMonde(), debrancher = brancherPhysX(monde);
  try {
    const fx = B.traces.creer(1, 11), co = courseDe(1), poses = posesDe(1);
    B.traces.pas(fx, co, poses, 0, DT, evements(1));
    assert.equal(monde.corps.size, B.traces.PIECES_PAR_VOITURE);
    for (const id of monde.corps.keys()) monde.vitesses.set(id, [0, 0, 0]);        // toutes posées
    for (let k = 0; k < 90; k++) B.traces.pas(fx, co, poses, 0, DT, []);           // 3 s à 30 Hz
    assert.equal(monde.corps.size, 0, 'les corps au repos devraient être sortis du monde');
    assert.equal(B.traces.compter(fx).debris, B.traces.PIECES_PAR_VOITURE, 'la pièce doit rester dessinée');
  } finally { debrancher(); }
});
check('repos : une pièce encore en mouvement garde son corps', () => {
  const monde = fauxMonde(), debrancher = brancherPhysX(monde);
  try {
    const fx = B.traces.creer(1, 12), co = courseDe(1), poses = posesDe(1);
    B.traces.pas(fx, co, poses, 0, DT, evements(1));
    for (const id of monde.corps.keys()) monde.vitesses.set(id, [6, 0, 6]);
    for (let k = 0; k < 90; k++) B.traces.pas(fx, co, poses, 0, DT, []);
    assert.equal(monde.corps.size, B.traces.PIECES_PAR_VOITURE);
  } finally { debrancher(); }
});

// ------------------------------------------------------------------ libération
// Le monde n'est plus détruit avec la séance : il appartient à la page, qui le garde vide pour la suivante (un monde
// par séance faisait payer à chaque course sa naissance au premier débris, au moment du choc). Ce qui ne doit pas
// survivre à la séance, ce sont ses corps et ses dalles.
check('libération : corps et dalles rendus, le monde de la page reste vide pour la suivante, effets éteints, plus rien ne bouge', () => {
  const monde = fauxMonde(), debrancher = brancherPhysX(monde);
  try {
    const fx = B.traces.creer(2, 13), co = courseDe(2), poses = posesDe(2);
    B.traces.pas(fx, co, poses, 0, DT, evements(2));
    assert.ok(monde.corps.size > 0 && monde.statiques.length > 0);
    B.traces.liberer(fx);
    assert.equal(monde.corps.size, 0); assert.equal(monde.statiques.length, 0);
    assert.equal(monde.detruit, false); assert.strictEqual(B.traces.mondePage(), monde);
    assert.equal(fx.monde, null); assert.equal(fx.sols.length, 0);
    assert.equal(B.traces.compter(fx).debris + B.traces.compter(fx).bandes + B.traces.compter(fx).fumees + B.traces.compter(fx).etincelles, 0);
    B.traces.pas(fx, co, poses, 0, DT, evements(2));                                // plus rien ne doit vivre
    assert.equal(B.traces.compter(fx).debris, 0);
    B.traces.liberer(fx);                                                            // idempotent
  } finally { debrancher(); }
});
check('monde unique : les séances se suivent dans un seul monde, chauffé une fois, sans corps ni dalle de l une chez l autre', () => {
  const X = modulePhysX();
  try {
    const co = courseDe(2), poses = posesDe(2), a = B.traces.creer(2, 20), monde = X.mondes[0];
    assert.equal(X.mondes.length, 1); assert.strictEqual(a.monde, monde);
    assert.equal(monde.pas, 10, 'chauffé à sa naissance'); assert.equal(monde.corps.size, 0); assert.equal(monde.statiques.length, 0);
    B.traces.pas(a, co, poses, 0, DT, evements(2));
    const corpsA = [...monde.corps.keys()];
    assert.equal(corpsA.length, 2 * PIECES); assert.ok(monde.statiques.length > 0);
    B.traces.liberer(a);
    assert.equal(monde.corps.size, 0); assert.equal(monde.statiques.length, 0);
    const b = B.traces.creer(2, 21);
    assert.equal(X.mondes.length, 1, 'aucun monde neuf'); assert.strictEqual(b.monde, monde); assert.equal(monde.pas, 10, 'une seule chauffe pour la page');
    for (const v of co.voitures) v.etat.s += 3000;
    B.traces.pas(b, co, poses, 0, DT, evements(2));
    assert.equal(monde.corps.size, 2 * PIECES); assert.ok([...monde.corps.keys()].every(id => !corpsA.includes(id)));
    assert.deepEqual(monde.statiques, dalles(b), 'les seules dalles de la séance en cours');
    // une séance qui en remplace une autre sans qu'on l'ait libérée (essais, perte de contexte) prend le monde vide
    const c = B.traces.creer(2, 22);
    assert.equal(b.monde, null); assert.strictEqual(c.monde, monde);
    assert.equal(monde.corps.size, 0); assert.equal(monde.statiques.length, 0); assert.ok(b.debris.every(d => d.corps === 0));
    B.traces.pas(c, co, poses, 0, DT, evements(1));
    const n = monde.corps.size;
    B.traces.liberer(b);                                                             // libérée trop tard : sans effet sur c
    assert.equal(monde.corps.size, n); assert.ok(n > 0); assert.deepEqual(monde.statiques, dalles(c));
    B.traces.liberer(c);
    assert.equal(monde.corps.size, 0); assert.equal(monde.statiques.length, 0); assert.equal(X.mondes.length, 1); assert.equal(monde.detruit, false);
  } finally { delete globalThis.FPhysX; }
});
check('préchauffage : une boîte lancée sur une dalle 5 km sous le circuit, puis plus rien ; la séance n en voit rien', () => {
  const X = modulePhysX();
  try {
    const co = courseDe(1), poses = posesDe(1), fx = B.traces.creer(1, 23), monde = X.mondes[0];
    B.traces.pas(fx, co, poses, 0, DT, evements(1));
    assert.equal(B.traces.prechauffer(fx), false, 'pièces en vol : les pas de chauffe les feraient avancer');
    for (const id of monde.corps.keys()) monde.vitesses.set(id, [0, 0, 0]);
    for (let k = 0; k < 90; k++) B.traces.pas(fx, co, poses, 0, DT, []);
    assert.equal(monde.corps.size, 0); assert.ok(fx.sols.length > 0);
    const instantane = () => JSON.stringify({ d: fx.debris, b: fx.bandes, f: fx.fumees, e: fx.etincelles, m: fx.embruns, sols: fx.sols, pieces: [...fx.pieces], acc: fx.acc, graine: fx.graine[0] });
    const avant = instantane(), statiques = JSON.stringify(monde.statiques), pas0 = monde.pas, ids0 = monde.next, vues = [];
    const poser = monde.setStatics;
    monde.setStatics = l => { vues.push(l); poser(l); };
    assert.equal(B.traces.prechauffer(fx), true);
    assert.equal(B.traces.prechauffer(), true, 'sans séance donnée : le monde de la page et sa séance');
    monde.setStatics = poser;
    assert.equal(instantane(), avant, 'pièces, effets, dalles et tirage de la séance intacts');
    assert.equal(JSON.stringify(monde.statiques), statiques, 'les dalles de la séance sont remises');
    assert.equal(monde.corps.size, 0); assert.equal(monde.next - ids0, 2, 'une boîte par chauffe'); assert.equal(monde.pas - pas0, 20);
    assert.ok(vues[0].length === 1 && vues[0][0].center[1] < -4000, 'la chauffe se fait loin sous le circuit');
    delete globalThis.FPhysX;
    assert.equal(B.traces.prechauffer(B.traces.creer(1, 24)), false, 'PhysX absent : rien à chauffer');
    assert.equal(B.traces.prechauffer(), false);
  } finally { delete globalThis.FPhysX; }
});
check('monde perdu : un pas PhysX qui échoue rend le monde, les pièces restent dessinées, le débris suivant en a un neuf', () => {
  let panne = false;
  const X = modulePhysX(() => { const w = fauxMonde(), pas = w.step; w.step = h => { if (panne) throw new Error('mémoire du module'); pas(h); }; return w; });
  try {
    const co = courseDe(1), poses = posesDe(1), fx = B.traces.creer(1, 27), m1 = X.mondes[0];
    B.traces.pas(fx, co, poses, 0, DT, evements(1));
    assert.equal(m1.corps.size, PIECES);
    panne = true;
    for (let k = 0; k < 4; k++) B.traces.pas(fx, co, poses, 0, DT, []);           // une passe à 30 Hz
    assert.equal(fx.monde, null); assert.equal(m1.detruit, true); assert.equal(B.traces.mondePage(), null);
    const vivants = B.traces.compter(fx);
    assert.equal(vivants.debris, PIECES); assert.equal(vivants.corps, 0);
    for (const d of fx.debris) if (d.actif) assert.ok(Number.isFinite(d.x + d.y + d.z));
    panne = false; fx.pieces[0] = 0;
    B.traces.pas(fx, co, poses, 0, DT, evements(1));
    assert.equal(X.mondes.length, 2); assert.strictEqual(fx.monde, X.mondes[1]); assert.equal(X.mondes[1].corps.size, PIECES);
  } finally { delete globalThis.FPhysX; }
});
// Une création de monde qui échoue une fois (mémoire du module, contexte passager) ne doit couper PhysX que pour la
// séance en cours : elle n'insiste pas à chaque débris, la suivante retente une fois.
check('création refusée une fois : la séance garde ses paraboles sans insister, la suivante retente et roule en PhysX', () => {
  let refus = 1, essais = 0;
  const X = { mondes: [], isReady: () => true,
    createWorld: () => { essais++; if (refus > 0) { refus--; throw new Error('mémoire du module'); } const w = fauxMonde(); X.mondes.push(w); return w; } };
  globalThis.FPhysX = X;
  try {
    const co = courseDe(2), poses = posesDe(2), fx = B.traces.creer(2, 33);
    assert.equal(fx.monde, null); assert.equal(essais, 1);
    B.traces.pas(fx, co, poses, 0, DT, evements(1));
    B.traces.pas(fx, co, poses, 0, DT, [{ type: 'roue', roue: 0, id: 1 }]);
    assert.equal(essais, 1, 'la séance n insiste pas à chaque débris');
    assert.equal(B.traces.compter(fx).corps, 0); assert.ok(B.traces.compter(fx).debris > 0, 'pièces en parabole');
    B.traces.liberer(fx);
    const g = B.traces.creer(2, 34);
    assert.equal(essais, 2, 'la séance suivante retente'); assert.equal(X.mondes.length, 1); assert.strictEqual(g.monde, X.mondes[0]);
    B.traces.pas(g, co, poses, 0, DT, evements(1));
    assert.equal(X.mondes[0].corps.size, PIECES, 'ses pièces roulent dans PhysX');
    B.traces.liberer(g);
  } finally { delete globalThis.FPhysX; }
});
// Pose factice qui tourne autour de la verticale à omega rad/s (temps du monde) ; la pièce ne s'arrête pas tant que
// `vitesse` n'est pas nulle. Rend les orientations dessinées à 0 et à 20 ms après la dernière pose, et l'angle vrai.
function rotation(omega, graine) {
  const X = modulePhysX(() => {
    const w = fauxMonde(), pas = w.step; w.t = 0; w.vitesse = [6, 0, 6];
    w.step = h => { pas(h); w.t += h; };
    w.readPose = id => { const e = w.corps.get(id); if (!e) return null; const a = omega * w.t / 2; return [e.pos[0], e.pos[1], e.pos[2], 0, Math.sin(a), 0, Math.cos(a)]; };
    w.readVelocity = id => (w.corps.has(id) ? w.vitesse : null);
    return w;
  });
  const co = courseDe(1), poses = posesDe(1), fx = B.traces.creer(1, graine), w = X.mondes[0];
  B.traces.pas(fx, co, poses, 0, DT, evements(1));
  for (let k = 0; k < 12; k++) B.traces.pas(fx, co, poses, 0, DT, []);              // trois poses lues
  const angles = h => { const s = []; B.traces.dessiner(fx, s, [0, 0, 0], h); return s.filter(o => o.mat === 7).map(o => o.r.slice()); };
  return { fx, w, co, poses, angles, vrai: h => omega * (w.t + h) };
}
check('rotation : l orientation d une pièce PhysX se prolonge au dessin ; trop rapide, elle tient sa dernière pose ; posée, elle se fige', () => {
  try {
    const r = rotation(3, 28), a0 = r.angles(0), a2 = r.angles(.02);
    assert.equal(a0.length, PIECES);
    for (let i = 0; i < a0.length; i++) {
      assert.ok(Math.abs(a0[i][1] - r.vrai(0)) < 1e-9, a0[i][1] + ' pour ' + r.vrai(0));
      assert.ok(Math.abs(a2[i][1] - r.vrai(.02)) < 1e-9, a2[i][1] + ' pour ' + r.vrai(.02));
      assert.ok(Math.abs(a2[i][0]) < 1e-9 && Math.abs(a2[i][2]) < 1e-9);
    }
    // posée : la pièce sort du monde, son orientation reste celle de la dernière pose, à tout instant dessiné
    r.w.vitesse = [0, 0, 0];
    for (let k = 0; k < 4 * 16; k++) B.traces.pas(r.fx, r.co, r.poses, 0, DT, []);
    assert.equal(r.w.corps.size, 0);
    const p0 = r.angles(0), p1 = r.angles(.03);
    assert.deepEqual(p1, p0); assert.ok(Math.abs(p0[0][1]) > .5, 'la dernière pose lue, pas l orientation de départ');
    // un quart de tour par trentième de seconde ou plus : la vitesse déduite n'est plus sûre, pas de prolongement
    const vite = rotation(60, 29);
    assert.deepEqual(vite.angles(.02), vite.angles(0));
  } finally { delete globalThis.FPhysX; }
});
check('sans PhysX, la pièce suit sa parabole et rien ne lève une exception', () => {
  delete globalThis.FPhysX;
  const fx = B.traces.creer(1, 14), co = courseDe(1), poses = posesDe(1);
  B.traces.pas(fx, co, poses, 0, DT, evements(1));
  for (let k = 0; k < 60; k++) B.traces.pas(fx, co, poses, 0, DT, []);
  assert.equal(B.traces.compter(fx).debris, B.traces.PIECES_PAR_VOITURE);
  for (const d of fx.debris) if (d.actif) { assert.ok(Number.isFinite(d.x) && Number.isFinite(d.y) && Number.isFinite(d.z)); assert.equal(d.corps, 0); }
});

// ------------------------------------------------------------------ sol adapté au relief
check('sol : les dalles suivent l altitude réelle du tracé autour de l accident', () => {
  const monde = fauxMonde(), debrancher = brancherPhysX(monde);
  try {
    B.circuit.echantillon = (c, s) => { const q = plat(c, s); q.y = Math.sin(s / 100) * 6; return q; };
    const fx = B.traces.creer(1, 15), co = courseDe(1), poses = posesDe(1);
    B.traces.pas(fx, co, poses, 0, DT, evements(1));
    assert.ok(monde.statiques.length >= 5, 'une seule dalle horizontale ne suit ni pente ni dévers');
    const hauteurs = monde.statiques.map(q => q.center[1]);
    assert.ok(Math.max(...hauteurs) - Math.min(...hauteurs) > 1, 'toutes les dalles sont à la même altitude');
    for (const q of monde.statiques) assert.ok(q.half.every(v => v > 0 && Number.isFinite(v)));
  } finally { B.circuit.echantillon = vraiEchantillon; debrancher(); }
});

// ------------------------------------------------------------------ dégâts persistants
check('récupération d urgence : jouable mais pas neuve ; la réparation complète reste aux stands', () => {
  const d = DG.creer();
  DG.choc(d, 40, { cote: 1, front: false });
  assert.ok(d.casse && DG.uneRouePerdue(d));
  const avant = { trainee: d.trainee, pire: d.pire, chocs: d.chocs, teinte: d.teinte };
  DG.reparerUrgence(d);
  assert.equal(d.casse, false); assert.deepEqual(d.roues, [false, false, false, false]);
  assert.ok(d.adher >= DG.PARAMS.urgenceAdher && d.adher < 1, 'adhérence ' + d.adher);
  assert.equal(d.trainee, avant.trainee); assert.equal(d.pire, avant.pire); assert.equal(d.chocs, avant.chocs);
  assert.ok(d.teinte > 0 && d.teinte < avant.teinte);
  assert.equal(d.cote, 1); assert.equal(d.avant, false);
  DG.reparer(d);
  assert.equal(d.adher, 1); assert.equal(d.trainee, 1); assert.equal(d.pire, 0); assert.equal(d.teinte, 0);
});
check('vraie course : après un gros choc, la voiture repart et garde la trace du choc', () => {
  const c = B.circuit.creer(11, { theme: 'foret', longueur: 4200 });
  const co = B.course.creer(c, { rivaux: 1, mode: 'course', graine: 3 });
  co.phase = 'course'; co.feux.vert = true;
  const j = co.joueur, dg = j.degats;
  DG.choc(dg, 40, { cote: 1, front: true });
  for (let k = 0; k < 120; k++) B.course.pas(co, { gaz: 0, frein: 0, volant: 0, derive: false, boite: 'auto', aide: 0, guidage: 0 }, DT);
  assert.ok(!j.etat.recuperation && !dg.casse && !DG.uneRouePerdue(dg));
  assert.ok(dg.pire > 0 && dg.chocs > 0 && dg.trainee > 1, 'le choc a été effacé par le remplacement');
  for (let k = 0; k < 240; k++) B.course.pas(co, { gaz: 1, frein: 0, volant: 0, derive: false, boite: 'auto', aide: 0, guidage: 0 }, DT);
  assert.ok(j.etat.v > 1, 'la voiture doit être repartie');
});

// ------------------------------------------------------------------ collisions multiples, sans NaN
check('collisions multiples en chaîne : pas de NaN, pas de blocage, corps bornés', () => {
  const monde = fauxMonde(), debrancher = brancherPhysX(monde);
  try {
    const c = B.circuit.creer(5, { theme: 'foret', longueur: 4200 });
    const co = B.course.creer(c, { rivaux: 11, mode: 'course', graine: 9 });
    co.phase = 'course'; co.feux.vert = true;
    for (const v of co.voitures) Object.assign(v.etat, { s: 1000 + Math.round((v.id % 4) * 1.2), d: (v.id % 3 - 1) * 1.4, v: 45, psi: 0 });
    const cmd = { gaz: 1, frein: 0, volant: 0, derive: false, boite: 'auto', aide: 0, guidage: 0 };
    const fx = B.traces.creer(co.voitures.length, 4), cour = [], t0 = process.hrtime.bigint();
    for (let k = 0; k < 1200; k++) {
      const ev = B.course.pas(co, cmd, DT);
      B.traces.pas(fx, co, cour, 0, DT, ev);
      for (const v of co.voitures) for (const x of [v.etat.s, v.etat.d, v.etat.v, v.etat.psi]) assert.ok(Number.isFinite(x), 'NaN en vue à l image ' + k);
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 1200;
    assert.ok(ms < 3, 'simulation + effets : ' + ms.toFixed(2) + ' ms par pas de 1/120 s');
    assert.ok(B.traces.compter(fx).debris <= B.traces.DEBRIS);
    assert.ok(monde.corps.size <= B.traces.DEBRIS);
    assert.ok(co.voitures.some(v => v.etat.v > 1), 'toutes les voitures sont bloquées');
  } finally { debrancher(); }
});

// ------------------------------------------------------------------ module PhysX encore en chargement
// Le module se décode en tâche de fond au démarrage : une séance née avant (vitrine) s'attache au monde dès qu'il est
// prêt, et le chauffe ; un module refusé, ou remplacé entre-temps, laisse les pièces en parabole.
async function checkAsync(name, fn) { try { await fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e && e.message }); } }
await checkAsync('attente : une séance née avant PhysX s y attache dès que le module est prêt ; refusé ou remplacé, rien ne casse', async () => {
  const attendre = () => new Promise(r => setTimeout(r, 0));
  try {
    let pret = false, ouvrir = null;
    const X = { mondes: [], isReady: () => pret, init: () => new Promise(r => { ouvrir = () => { pret = true; r(); }; }), createWorld: () => { const w = fauxMonde(); X.mondes.push(w); return w; } };
    globalThis.FPhysX = X;
    const fx = B.traces.creer(1, 30);
    assert.equal(fx.monde, null); assert.equal(X.mondes.length, 0);
    ouvrir(); await attendre();
    assert.equal(X.mondes.length, 1); assert.strictEqual(fx.monde, X.mondes[0]); assert.equal(X.mondes[0].pas, 10, 'chauffé dès le rattachement');
    const co = courseDe(1), poses = posesDe(1);
    B.traces.pas(fx, co, poses, 0, DT, evements(1));
    assert.equal(X.mondes[0].corps.size, PIECES);
    B.traces.liberer(fx);
    // refusé : la séance garde ses paraboles
    globalThis.FPhysX = { isReady: () => false, init: () => Promise.reject(new Error('module refusé')), createWorld: () => { throw new Error('jamais'); } };
    const g = B.traces.creer(1, 31);
    await attendre();
    B.traces.pas(g, co, poses, 0, DT, evements(1));
    assert.equal(g.monde, null); assert.equal(B.traces.compter(g).debris, PIECES); assert.equal(B.traces.compter(g).corps, 0);
    // remplacé avant d'être prêt : l'ancien module ne rattache plus rien
    let ouvrirY = null;
    const Y = { mondes: [], isReady: () => false, init: () => new Promise(r => { ouvrirY = r; }), createWorld: () => { const w = fauxMonde(); Y.mondes.push(w); return w; } };
    globalThis.FPhysX = Y;
    const h = B.traces.creer(1, 32);
    globalThis.FPhysX = undefined;
    ouvrirY(); await attendre();
    assert.equal(h.monde, null); assert.equal(Y.mondes.length, 0);
  } finally { delete globalThis.FPhysX; }
});

console.log(JSON.stringify({ passed: results.filter(r => r.ok).length, total: results.length, results }, null, 2));
if (results.some(r => !r.ok)) process.exitCode = 1;
