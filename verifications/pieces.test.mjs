// Lot 2 : pièces détachées sous budget, corps qui s'éteignent, libération sûre, dégâts persistants.
// Les pièces roulent avec FPhysX en navigateur ; ici un faux monde tient la comptabilité des corps, ce qui ne
// qualifie pas la physique du navigateur (le dit la fiche) mais bien la gestion des corps par le jeu.
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

// ------------------------------------------------------------------ budget de pièces
check('budget : douze voitures en casse simultanée tiennent sous le plafond du pool', () => {
  const fx = B.traces.creer(12, 5), co = courseDe(12), poses = posesDe(12);
  B.traces.pas(fx, co, poses, 0, DT, evements(12));
  const n = B.traces.compter(fx).debris;
  assert.equal(n, 12 * B.traces.PIECES_PAR_VOITURE);
  assert.ok(n <= B.traces.DEBRIS, n + ' > ' + B.traces.DEBRIS);
  assert.equal(fx.debris.filter(d => d.actif && d.objet.shape === 'cylinder').length, 48);
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
check('libération : corps retirés, monde détruit, effets éteints, plus rien ne bouge', () => {
  const monde = fauxMonde(), debrancher = brancherPhysX(monde);
  try {
    const fx = B.traces.creer(2, 13), co = courseDe(2), poses = posesDe(2);
    B.traces.pas(fx, co, poses, 0, DT, evements(2));
    assert.ok(monde.corps.size > 0 && monde.statiques.length > 0);
    B.traces.liberer(fx);
    assert.equal(monde.corps.size, 0); assert.equal(monde.detruit, true);
    assert.equal(fx.monde, null); assert.equal(fx.sols.length, 0);
    assert.equal(B.traces.compter(fx).debris + B.traces.compter(fx).bandes + B.traces.compter(fx).fumees + B.traces.compter(fx).etincelles, 0);
    B.traces.pas(fx, co, poses, 0, DT, evements(2));                                // plus rien ne doit vivre
    assert.equal(B.traces.compter(fx).debris, 0);
    B.traces.liberer(fx);                                                            // idempotent
  } finally { debrancher(); }
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

console.log(JSON.stringify({ passed: results.filter(r => r.ok).length, total: results.length, results }, null, 2));
if (results.some(r => !r.ok)) process.exitCode = 1;
