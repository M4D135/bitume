// Animaux des sept circuits (lot 26) : formes bâties au chargement, habitats tirés du décor, bêtes hors de la route
// et de son dégagement, fuite puis retour, mêmes images à 30, 60 et 120 images par seconde, mouvement continu, hasard
// propre, mêmes objets d'une image à l'autre sans allocation, budgets par palier, saisons, nuit, sol exact du maillage.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
for (const f of ['carene', 'circuit', 'ecologie', 'saisons', 'botanique', 'vegetation', 'decor', 'ambiance', 'animaux']) require('../src/' + f + '.js');
const B = globalThis.BITUME, A = B.animaux;
let controles = 0;
const verifier = (nom, f) => { f(); controles++; console.log('ok ' + nom); };
const CATALOGUE = [['foret', 11, 4200], ['cote', 29, 3600], ['montagne', 47, 5200], ['islande', 83, 4600], ['desert', 107, 4800], ['asie', 131, 5000], ['pacifique', 157, 5200]];
const circuits = new Map();
function circuit(theme, saison = 'ete') {
  const cle = theme + ':' + saison;
  if (!circuits.has(cle)) {
    const [, graine, longueur] = CATALOGUE.find(e => e[0] === theme);
    const c = B.circuit.creer(graine, { theme, longueur });
    circuits.set(cle, { c, decor: B.decor.construire(c, { vegetation: false, vegetationQualite: 'off', qualite: 'low', saison }) });
  }
  return circuits.get(cle);
}
// Les tests de locomotion observent explicitement tout le circuit depuis une caméra
// aérienne. Le runtime, lui, commence avec zéro vue et dort tant que rien n'est visible.
function creerObservable(c, decor, options = {}) {
  const e = A.creer(c, decor, options);
  const x = (Math.min(...c.x) + Math.max(...c.x)) / 2, z = (Math.min(...c.z) + Math.max(...c.z)) / 2;
  A.selectionnerVues(e, [{ qualite: 'ultra', camera: { pos: [x, 2500, z], yaw: 0, pitch: -Math.PI / 2, fov: 150 }, aspect: 2, hauteur: 720, portee: 12000 }]);
  return e;
}
// Index indépendant du module (seaux de 64 m) : distance exacte aux échantillons du tracé et dégagement à cet endroit.
function indexAxe(c) {
  const seaux = new Map(), cle = (i, j) => i * 100003 + j;
  for (let s = 0; s < c.n; s++) { const k = cle(Math.floor(c.x[s] / 64), Math.floor(c.z[s] / 64)); if (!seaux.has(k)) seaux.set(k, []); seaux.get(k).push(s); }
  return (x, z) => {
    const i = Math.floor(x / 64), j = Math.floor(z / 64);
    let best = Infinity, lim = 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const s of seaux.get(cle(i + di, j + dj)) || []) {
      const d = Math.hypot(x - c.x[s], z - c.z[s]); if (d < best) { best = d; lim = Math.max(c.limiteG[s], c.limiteD[s]); }
    }
    return { d: best, limite: lim };
  };
}
// Peloton : 12 voitures espacées de 40 m à 55 m/s sur l'axe (le cerveau ne lit que x et z).
function peloton(c) {
  const v = Array.from({ length: 12 }, () => ({ x: 0, y: 0, z: 0 }));
  v.placer = t => { for (let k = 0; k < 12; k++) { const s = ((t * 55 - k * 40) % c.longueur + c.longueur) % c.longueur, i = Math.round(s / c.pas) % c.n; v[k].x = c.x[i]; v[k].z = c.z[i]; } };
  return v;
}
const DT = 1 / 120, NP = 17, PALT = 11, PCOUCHE = 7, PENF = 9, NG = 10;
// Temps processeur du processus (utilisateur et système), en ms. Les bornes de durée s'y mesurent : une machine
// chargée par d'autres programmes allonge le temps écoulé, pas celui-ci, et ces bornes n'ont à attraper qu'un
// algorithme qui dérape.
const processeur = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
function camera(x, y, z, versX, versZ, fov = 50) { return { pos: [x, y, z], yaw: Math.atan2(versX - x, -(versZ - z)), fov }; }
function contexte(cam, qualite = 'high', vue = 0) { return { vue, qualite, camera: cam, hauteur: 720, aspect: 16 / 9, arriere: false, nuit: 0, pluie: 0 }; }
const empreinte = sortie => sortie.map(o => [o.shape, ...o.p, ...o.s, ...o.r, ...o.color, o.mat, o.emissive, o.alpha]);
// Une voiture à 50 m/s arrive du côté opposé au refuge du groupe, passe à 25 m de son domaine, puis s'éloigne.
function passage(grp, voit, k) {
  const dx = grp.rx - grp.hx, dz = grp.rz - grp.hz, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, s = -260 + 50 * k * DT;
  voit[0].x = grp.hx - ux * 25 - uz * s + (s < 0 ? ux * s * .8 : 0); voit[0].z = grp.hz - uz * 25 + ux * s + (s < 0 ? uz * s * .8 : 0);
}

verifier('formes bâties au chargement : finies, dans le cube unité, faces dans le sens des normales, noms propres', () => {
  assert(A.FORMES.size > 150 && A.FORMES.size < 260, 'formes : ' + A.FORMES.size);
  assert(A.trianglesFormes > 30000 && A.trianglesFormes < 60000, 'triangles : ' + A.trianglesFormes);
  const reserves = new Set(['box', 'sphere', 'cylinder', 'octa', 'ring', 'bevel', 'foliage', 'wedge']);
  for (const f of A.FORMES.values()) {
    assert(f.nom.startsWith('bitume-animal-') && !reserves.has(f.nom), f.nom);
    assert(f.tri && f.tri.length === f.triangles && f.triangles > 0, f.nom);
    let accord = 0;
    for (const t of f.tri) {
      for (const v of t) for (const x of v) assert(Number.isFinite(x), f.nom + ' : coordonnée non finie');
      for (let k = 0; k < 3; k++) for (let s = 0; s < 3; s++) assert(Math.abs(t[s][k]) <= .5001, f.nom + ' hors du cube unité');
      const e1 = [0, 1, 2].map(k => t[1][k] - t[0][k]), e2 = [0, 1, 2].map(k => t[2][k] - t[0][k]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (n[0] * (t[3][0] + t[4][0] + t[5][0]) + n[1] * (t[3][1] + t[4][1] + t[5][1]) + n[2] * (t[3][2] + t[4][2] + t[5][2]) > 0) accord++;
    }
    // le moteur élimine les faces arrière : l'ordre des sommets doit suivre les normales lissées (les rares désaccords
    // sont des pôles et des plis serrés de tubes, jamais une forme retournée)
    assert(accord >= f.triangles * .93, f.nom + ' : ' + accord + '/' + f.triangles + ' faces dans le sens des normales');
  }
  for (const [theme, liste] of Object.entries(A.BIOMES)) for (const cle of liste) assert(A.ESPECES[cle] && A.MODELES[A.ESPECES[cle].modele], theme + ' : ' + cle);
  console.log('   ' + A.FORMES.size + ' formes, ' + A.trianglesFormes + ' triangles, bâties en ' + A.dureeChargement.toFixed(0) + ' ms');
});

verifier('sept circuits : habitats proches admissibles, absence explicite sinon ; placement reproductible, sans Math.random ni retouche du décor', () => {
  for (const [theme] of CATALOGUE) {
    const { c, decor } = circuit(theme), avant = [c.x[17], c.z[17], c.n, decor.obstacles.length, decor.lots.length].join();
    const alea = Math.random;
    let a, b, cpu = 0;
    try {
      Math.random = () => { throw Error('hasard partagé interdit'); };
      const p0 = processeur(); a = creerObservable(c, decor, { saison: 'ete' }); cpu = processeur() - p0;
      b = creerObservable(c, decor, { saison: 'ete' });
    } finally { Math.random = alea; }
    assert.equal([c.x[17], c.z[17], c.n, decor.obstacles.length, decor.lots.length].join(), avant);
    assert.deepEqual(Array.from(a.cour), Array.from(b.cour), theme + ' : placement reproductible');
    const s = A.stats(a);
    assert(s.groupes >= 2 && s.animaux >= 8, theme + ' : ' + JSON.stringify(s));
    for (const cle of A.BIOMES[theme]) assert(s.especes.some(e => e.cle === cle && e.groupes > 0) || s.absentes.some(e => e.cle === cle && e.raison === 'habitat'), theme + ' : ' + cle + ' sans état explicite');
    assert(cpu < 400, theme + ' : création ' + cpu.toFixed(0) + ' ms de processeur');
    console.log('   ' + theme + ' : ' + s.groupes + ' groupes, ' + s.animaux + ' bêtes au sol, ' + s.volants + ' volants, ' + s.refuges + ' refuges, créé en ' + s.creationMs.toFixed(0) + ' ms (' + cpu.toFixed(0) + ' ms de processeur)');
  }
});

verifier('240 s de course : aucune bête sur la route, son dégagement, l’enceinte ou le tunnel ; volants bas loin de la piste', () => {
  for (const [theme] of CATALOGUE) {
    const { c, decor } = circuit(theme), etat = creerObservable(c, decor, { saison: 'ete' }), axe = indexAxe(c), voit = peloton(c);
    const ps = {}, G = etat.G;
    let pire = Infinity, fuites = 0, envols = 0, cerveau = 0;
    for (let n = 0; n <= 120 * 240; n++) {
      const t = n * DT; voit.placer(t);
      const t0 = performance.now(); A.pas(etat, t, voit); cerveau += performance.now() - t0;
      if (n % 24) continue;
      for (let i = 0; i < etat.nAnimaux; i++) {
        const x = etat.cour[i * NP], z = etat.cour[i * NP + 1], alt = etat.cour[i * NP + PALT], q = axe(x, z), k = A.cellule(G, x, z);
        if (alt > .5) envols++;
        if (alt >= 25) continue;
        assert(q.d >= Math.max(A.D_MIN, q.limite + A.GARDE_BORD), theme + ' : bête à ' + q.d.toFixed(1) + ' m de l’axe (dégagement ' + q.limite.toFixed(1) + ' m)');
        if (alt < .5) assert(k >= 0 && !(G.drap[k] & (2 | 4 | 8)), theme + ' : bête dans une zone interdite');
        pire = Math.min(pire, q.d);
      }
      for (const f of etat.volants) for (let k = 0; k < f.n; k++) {
        if (!A.poseVolant(etat, f, k, t, ps)) continue;
        const sol = Math.max(A.solExact(G.T, ps.x, ps.z), G.eau);
        if (ps.y - sol < 25) { const q = axe(ps.x, ps.z); assert(q.d >= A.D_MIN, theme + ' : ' + f.cle + ' bas au-dessus de la piste (' + q.d.toFixed(1) + ' m)'); }
      }
      for (let g = 0; g < etat.groupes.length; g++) if (etat.gs[g * NG] === 2) fuites++;
    }
    assert(pire >= A.D_MIN, theme);
    // la même course rejouée, cerveau seul, pour la borne en temps processeur
    const bis = creerObservable(c, decor, { saison: 'ete' }), p0 = processeur();
    for (let n = 0; n <= 120 * 240; n++) { voit.placer(n * DT); A.pas(bis, n * DT, voit); }
    const cpu = processeur() - p0;
    assert(cpu < 400, theme + ' : cerveau ' + cpu.toFixed(0) + ' ms de processeur pour 240 s');
    console.log('   ' + theme + ' : plus près de l’axe ' + pire.toFixed(1) + ' m ; échantillons en fuite ' + fuites + ', en vol ' + envols + ' ; cerveau ' + cerveau.toFixed(0) + ' ms pour 240 s (' + cpu.toFixed(0) + ' ms de processeur)');
  }
});

verifier('fuite devant une voiture, refuge, puis retour au domaine ; accoutumance', () => {
  const { c, decor } = circuit('foret'), etat = creerObservable(c, decor, { saison: 'ete' });
  const g = etat.groupes.findIndex(x => x.cle === 'cerf' && x.refuge), grp = etat.groupes[g];
  assert(g >= 0, 'un groupe de cerfs avec refuge');
  const voit = [{ x: 0, y: 0, z: 0 }], loin = () => { voit[0].x = grp.hx + 5000; voit[0].z = grp.hz; };
  const centre = () => { let x = 0, z = 0; for (let a = grp.debut; a < grp.debut + grp.n; a++) { x += etat.cour[a * NP]; z += etat.cour[a * NP + 1]; } return [x / grp.n, z / grp.n]; };
  const ux = (grp.rx - grp.hx) / Math.hypot(grp.rx - grp.hx, grp.rz - grp.hz), uz = (grp.rz - grp.hz) / Math.hypot(grp.rx - grp.hx, grp.rz - grp.hz);
  let t = 0;
  const vu = new Set(), avance = (s, f) => { for (let k = 0; k < 120 * s; k++, t += DT) { f(k); A.pas(etat, t, voit); vu.add(etat.gs[g * NG]); } };
  loin(); avance(5, () => {});
  assert.equal(etat.gs[g * NG], 0, 'calme au départ');
  vu.clear();
  avance(8, k => passage(grp, voit, k));
  assert(vu.has(1) && vu.has(2), 'alerte puis fuite : ' + [...vu]);
  const [fx, fz] = centre(), parcouru = (fx - grp.hx) * ux + (fz - grp.hz) * uz;
  assert(parcouru > 6, 'le groupe s’éloigne vers son refuge : ' + parcouru.toFixed(1) + ' m');
  assert(etat.gs[g * NG + 3] < 1, 'accoutumance : seuils rapprochés après une fuite');
  loin();
  let retour = -1, refuge = false;
  // le refuge peut être à 165 m : 30 s de fuite et d'attente, puis le retour au pas
  avance(240, () => { if (etat.gs[g * NG] === 3) refuge = true; if (refuge && retour < 0 && etat.gs[g * NG] === 0) retour = t; });
  assert(refuge && retour > 0, 'refuge puis retour au calme : ' + [...vu]);
  const [rx, rz] = centre();
  assert(Math.hypot(rx - grp.hx, rz - grp.hz) < grp.hr, 'revenu au domaine : ' + Math.hypot(rx - grp.hx, rz - grp.hz).toFixed(1) + ' m');
  console.log('   cerfs : ' + parcouru.toFixed(0) + ' m vers le refuge en 8 s, calme retrouvé ' + (retour - 13).toFixed(0) + ' s après le passage');
});

verifier('mêmes images à 30, 60 et 120 images par seconde ; le dessin ne touche pas au cerveau', () => {
  const { c, decor } = circuit('desert'), voitP = peloton(c);
  const etats = [30, 60, 120].map(() => creerObservable(c, decor, { saison: 'ete' }));
  const g0 = etats[0].groupes[0];
  const cam = camera(g0.hx + 30, A.solExact(etats[0].G.T, g0.hx + 30, g0.hz) + 2, g0.hz, g0.hx, g0.hz, 60);
  const releves = [[], [], []];
  [30, 60, 120].forEach((ips, e) => {
    const etat = etats[e], ctx = contexte(cam, 'ultra'), sortie = [];
    let horloge = 0, acc = 0;
    for (let image = 0; image < ips * 40; image++) {
      acc += 1 / ips;
      while (acc >= DT - 1e-12) { horloge += DT; voitP.placer(horloge); A.pas(etat, horloge, voitP); acc -= DT; }
      const echantillon = (image + 1) % (ips / 2) === 0, avant = echantillon ? etat.cour.slice() : null;
      sortie.length = 0;
      A.dessiner(etat, horloge - DT + acc, ctx, sortie); // instant de l'image, entre deux pas de simulation
      if (echantillon) { assert.deepEqual(etat.cour, avant, 'dessiner ne modifie pas le cerveau'); releves[e].push(empreinte(sortie)); }
    }
  });
  assert(releves[0].length === 80 && releves[0].some(r => r.length > 20), 'objets rendus : ' + releves[0].map(r => r.length));
  for (const e of [1, 2]) {
    assert.equal(releves[e].length, releves[0].length);
    releves[e].forEach((r, i) => {
      assert.equal(r.length, releves[0][i].length, 'même nombre d’objets à l’instant ' + i);
      r.forEach((o, j) => o.forEach((v, k) => { if (typeof v === 'number') assert(Math.abs(v - releves[0][i][j][k]) < 1e-6, 'écart ' + v + ' / ' + releves[0][i][j][k]); else assert.equal(v, releves[0][i][j][k]); }));
    });
  }
  assert.deepEqual(Array.from(etats[1].cour), Array.from(etats[0].cour), 'cerveaux identiques');
  assert.deepEqual(Array.from(etats[2].cour), Array.from(etats[0].cour), 'cerveaux identiques');
});

verifier('mouvement continu en pleine fuite : ni double pas ni arrêt aux pas du cerveau', () => {
  const { c, decor } = circuit('foret'), etat = creerObservable(c, decor, { saison: 'ete' });
  const grp = etat.groupes.find(x => x.cle === 'cerf' && x.refuge), voit = [{ x: grp.hx + 5000, y: 0, z: grp.hz }], ps = {};
  let horloge = 0, px = NaN, pz = NaN, vmax = 0;
  const pas = [];
  for (let n = 0; n < 120 * 13; n++) {
    horloge += DT; if (n >= 600) passage(grp, voit, n - 600); A.pas(etat, horloge, voit);
    A.poseAnimal(etat, grp.debut, horloge - DT, ps); // image à 120 Hz : l'horloge de simulation a un pas d'avance
    if (n) { const d = Math.hypot(ps.x - px, ps.z - pz); pas.push(d); vmax = Math.max(vmax, d / DT); }
    px = ps.x; pz = ps.z;
  }
  // sur chaque fenêtre d'un dixième de seconde (douze images) en pleine course, le plus court déplacement d'une image
  // reste proche du plus long : un arrêt de 8 ms à chaque pas du cerveau y mettrait un déplacement nul
  let pire = 1, fenetres = 0;
  for (let k = 0; k + 12 <= pas.length; k += 6) {
    let mn = Infinity, mx = 0;
    for (let j = k; j < k + 12; j++) { mn = Math.min(mn, pas[j]); mx = Math.max(mx, pas[j]); }
    if (mx / DT < 4) continue;
    pire = Math.min(pire, mn / mx); fenetres++;
  }
  assert(fenetres > 20 && vmax > 8, 'fuite au galop : ' + fenetres + ' fenêtres, ' + vmax.toFixed(1) + ' m/s');
  assert(pire > .5, 'à-coup : déplacement réduit à ' + (pire * 100).toFixed(0) + ' % du plus long dans un dixième de seconde');
  console.log('   galop à ' + vmax.toFixed(1) + ' m/s ; dans chaque dixième de seconde, pas d’image le plus court ' + (pire * 100).toFixed(0) + ' % du plus long');
});

verifier('réserve réutilisée : mêmes objets d’une image à l’autre, dans le même ordre', () => {
  const { c, decor } = circuit('cote'), etat = creerObservable(c, decor, { saison: 'ete' });
  const g = etat.groupes.find(x => x.cle === 'flamant') || etat.groupes[0];
  const cam = camera(g.hx + 25, Math.max(A.solExact(etat.G.T, g.hx + 25, g.hz), etat.G.eau) + 3, g.hz + 5, g.hx, g.hz, 55);
  const ctx = contexte(cam, 'ultra'), sortie = [], V = etat.vues[0], reserve = new Set([...V.objets, ...V.fx]), taille = V.objets.length;
  const vus = new Set();
  for (let n = 0; n < 600; n++) {
    const t = n / 60; A.pas(etat, t, []); sortie.length = 0; A.dessiner(etat, t, ctx, sortie);
    for (const o of sortie) { assert(reserve.has(o), 'objet hors réserve'); vus.add(o); }
  }
  assert(vus.size > 20 && V.objets.length === taille, 'objets vus ' + vus.size);
  sortie.length = 0; A.dessiner(etat, 9.95, ctx, sortie); const a = sortie.slice(), ea = empreinte(sortie);
  sortie.length = 0; A.dessiner(etat, 9.95, ctx, sortie);
  assert(a.length === sortie.length && a.every((o, i) => o === sortie[i])); assert.deepEqual(empreinte(sortie), ea);
});

// Mesure dans un processus neuf par cas : les essais précédents ont entraîné le compilateur sur d'autres formes
// d'appels. Le tas jeune ne grossit que par ce qui est alloué tant qu'aucun ramassage ne passe (vérifié par
// GCProfiler). Le harnais (voitures, horloge, tableau de sortie vidé par pop pour garder son stockage) n'alloue rien
// une fois optimisé, mais le moment où le compilateur s'en charge varie d'un processus à l'autre : les seuils portent
// sur les totaux, harnais compris.
const MESURE_TAS = (src, cas) => `
import { createRequire } from 'node:module';
import v8 from 'node:v8';
const require = createRequire(${JSON.stringify(src)});
for (const f of ['carene', 'circuit', 'ecologie', 'saisons', 'botanique', 'vegetation', 'decor', 'ambiance', 'animaux']) require(${JSON.stringify(src)} + f + '.js');
const B = globalThis.BITUME, A = B.animaux, DT = 1 / 120, CAS = ${JSON.stringify(cas)};
const c = B.circuit.creer(83, { theme: 'islande', longueur: 4600 });
const decor = B.decor.construire(c, { vegetation: false, vegetationQualite: 'off', qualite: 'low', saison: 'ete' });
const etat = A.creer(c, decor, { saison: 'ete' }), g = etat.groupes[0];
const voit = Array.from({ length: 12 }, () => ({ x: .5, y: .5, z: .5 })), H = new Float64Array(1), N = { objets: 0 };
function placer() { const t = H[0]; for (let k = 0; k < 12; k++) { const s = ((t * 55 - k * 40) % c.longueur + c.longueur) % c.longueur, i = Math.round(s / c.pas) % c.n; voit[k].x = c.x[i]; voit[k].z = c.z[i]; } }
const cam = { pos: [g.hx + 40, A.solExact(etat.G.T, g.hx + 40, g.hz) + 2, g.hz], yaw: Math.atan2(-40, 0), fov: 60 };
const ctx = [{ vue: 0, qualite: 'ultra', camera: cam, hauteur: 720, aspect: 16 / 9, arriere: false, nuit: 0, pluie: 0 },
  { vue: 1, qualite: 'medium', camera: cam, hauteur: 360, aspect: 4, arriere: true, nuit: 0, pluie: 0 }];
A.selectionnerVues(etat, ctx);
const sortie = [], cerveau = CAS === 'tout', dessin = CAS !== 'harnais';
// cas « dessin » : bêtes figées au départ, deux vues dessinées ; cas « tout » : le cerveau avance en plus
function image() {
  for (let s = 0; s < 2; s++) { H[0] += DT; placer(); if (cerveau) A.pas(etat, H[0], voit); }
  for (let v = 0; v < 2; v++) { while (sortie.length) sortie.pop(); if (dessin) { A.dessiner(etat, H[0] - DT, ctx[v], sortie); N.objets += sortie.length; } }
}
for (let n = 0; n < 20000; n++) image(); // mise en route : le cerveau passe au compilateur optimisant après quelques milliers de pas
const jeune = () => v8.getHeapSpaceStatistics().find(s => s.space_name === 'new_space').space_used_size;
let octets = NaN;
N.objets = 0;
for (let essai = 0; essai < 4 && !Number.isFinite(octets); essai++) {
  globalThis.gc(); const p = new v8.GCProfiler(); p.start();
  const a = jeune(); for (let n = 0; n < 3000; n++) image(); const b = jeune();
  if (!p.stop().statistics.length) octets = (b - a) / 3000;
}
console.log(JSON.stringify({ octets, objets: N.objets / 6000 }));
`;
const mesureTas = cas => {
  // La compilation synchrone évite que la charge de la machine décide quelles interpolations V8 intègre.
  const r = spawnSync(process.execPath, ['--expose-gc', '--no-concurrent-recompilation', '--input-type=module', '-e', MESURE_TAS(new URL('../src/', import.meta.url).pathname, cas)], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const m = JSON.parse(r.stdout.trim().split('\n').pop());
  assert(Number.isFinite(m.octets), 'mesure troublée par le ramasse-miettes (' + cas + ')');
  return m;
};
verifier('sans allocation en course : le dessin n’alloue rien, le cerveau presque rien', () => {
  const h = mesureTas('harnais'), d = mesureTas('dessin'), t = mesureTas('tout');
  assert(d.objets > 20 && t.objets > 20, 'des bêtes à l’écran : ' + d.objets + ' / ' + t.objets);
  // dessin : deux vues de 30 à 60 objets ; seul l'instant passé en argument est emboîté (16 octets par appel). Une
  // allocation par bête et par image (un tableau de trois nombres) y ajouterait déjà plus de 3 000 octets.
  assert(d.octets < 600, 'dessin : ' + d.octets.toFixed(0) + ' octets par image');
  // cerveau : quelques flottants emboîtés par V8 aux appels non intégrés (quelques centaines d’octets par image une
  // fois le cerveau optimisé, davantage tant qu’il tourne au compilateur intermédiaire)
  assert(t.octets < 3000, 'cerveau et dessin : ' + t.octets.toFixed(0) + ' octets par image');
  console.log('   octets par image à 60 i/s (deux vues, ' + d.objets.toFixed(0) + ' objets par vue) : harnais seul ' + h.octets.toFixed(0) + ', dessin ' + d.octets.toFixed(0) + ', cerveau et dessin ' + t.octets.toFixed(0));
});

verifier('budgets par palier : rien en off, Légère privilégie quelques silhouettes proches', () => {
  const { c, decor } = circuit('islande'), etat = creerObservable(c, decor, { saison: 'ete' });
  A.pas(etat, 0, []); A.pas(etat, 1, []);
  const g = etat.groupes.reduce((m, x) => x.dAxe > m.dAxe ? x : m, etat.groupes[0]);
  const parPalier = {};
  for (const q of ['off', 'low', 'medium', 'high', 'ultra']) {
    const res = [];
    for (const d of [20, 60, 180, 320]) {
      const cam = camera(g.hx + d, A.solExact(etat.G.T, g.hx + d, g.hz) + 2, g.hz, g.hx, g.hz, 55), sortie = [];
      A.dessiner(etat, 1, contexte(cam, q), sortie);
      const s = etat.vues[0].stats, b = A.BUDGETS[q];
      assert(s.proches <= b.proches && s.moyens <= b.moyens && s.objets <= b.objets && s.animaux <= b.individus, q + ' ' + JSON.stringify(s));
      if (q === 'off') assert.equal(sortie.length, 0);
      if (q === 'low') for (const o of sortie) assert(/-loin(-|$)|loin-vol|loin-pose/.test(o.shape), 'Légère : ' + o.shape);
      res.push(s.objets);
    }
    parPalier[q] = res;
  }
  for (let i = 0; i < 4; i++) assert(parPalier.low[i] <= parPalier.medium[i] && parPalier.medium[i] <= parPalier.high[i] && parPalier.high[i] <= parPalier.ultra[i], JSON.stringify(parPalier));
  assert(parPalier.low.some(n => n > 0) && Math.max(...parPalier.low) <= A.BUDGETS.low.individus, 'Légère : ' + parPalier.low);
  assert.equal(A.qualite('profil', 'low'), 'low'); assert.equal(A.qualite('off', 'high'), 'off'); assert.equal(A.qualite('ultra', 'low'), 'ultra');
  console.log('   objets à 20/60/180/320 m : ' + JSON.stringify(parPalier));
});

verifier('saisons : marmottes, moutons et oies absents l’hiver ; cerfs sans bois au printemps ; jeunes et robes d’hiver', () => {
  const mh = circuit('montagne', 'hiver'), m = A.stats(creerObservable(mh.c, mh.decor, { saison: 'hiver' }));
  assert(m.absentes.some(a => a.cle === 'marmotte' && a.raison === 'saison') && m.especes.some(e => e.cle === 'bouquetin' && e.groupes));
  const ih = circuit('islande', 'hiver'), i = A.stats(creerObservable(ih.c, ih.decor, { saison: 'hiver' }));
  assert(['mouton', 'oie'].every(k => i.absentes.some(a => a.cle === k && a.raison === 'saison')) && i.especes.some(e => e.cle === 'islandais' && e.groupes));
  const fp = circuit('foret', 'printemps'), p = creerObservable(fp.c, fp.decor, { saison: 'printemps' });
  const cerfs = p.animaux.filter(a => p.groupes[a.g].cle === 'cerf');
  assert(cerfs.some(a => a.male) && cerfs.every(a => a.cornes === 0), 'cerfs sans bois au printemps');
  const fe = circuit('foret'), e = creerObservable(fe.c, fe.decor, { saison: 'ete' });
  assert(e.animaux.some(a => a.jeune) && e.animaux.some(a => a.male && a.cornes === 1));
  const fh = circuit('foret', 'hiver'), h = creerObservable(fh.c, fh.decor, { saison: 'hiver' });
  assert(h.animaux.some(a => h.groupes[a.g].cle === 'cerf' && a.couleurs === A.ESPECES.cerf.hiver[0]), 'pelage d’hiver');
});

verifier('nuit et averse : diurnes couchés, marmottes au terrier, rapaces posés', () => {
  const { c, decor } = circuit('montagne'), jour = creerObservable(c, decor, { nuit: 0 }), nuit = creerObservable(c, decor, { nuit: 1 });
  for (let n = 0; n <= 120 * 120; n++) { A.pas(jour, n * DT, []); A.pas(nuit, n * DT, []); }
  const repos = e => { let k = 0; for (let i = 0; i < e.nAnimaux; i++) if (e.cour[i * NP + PCOUCHE] > .5 || e.cour[i * NP + PENF] > .5) k++; return k / e.nAnimaux; };
  assert(repos(nuit) > repos(jour) + .2, 'repos nocturne : ' + repos(jour).toFixed(2) + ' / ' + repos(nuit).toFixed(2));
  const terrier = jour.groupes.findIndex(g => g.cle === 'marmotte');
  if (terrier >= 0) { const gm = nuit.groupes[terrier]; for (let a = gm.debut; a < gm.debut + gm.n; a++) assert(nuit.cour[a * NP + PENF] > .9, 'marmotte dehors la nuit'); }
  const aigle = jour.volants.find(f => f.cle === 'aigle'), ps = {}, sortie = [];
  assert(aigle, 'un aigle au-dessus de la montagne');
  const vus = [0, 0, 0];
  for (let t = 100; t < 160; t += 5) {
    A.poseVolant(jour, aigle, 0, t, ps);
    const cam = camera(ps.x + 50, ps.y + 5, ps.z, ps.x, ps.z, 60);
    for (let k = 0; k < 3; k++) {
      const ctx = contexte(cam, 'ultra'); ctx.nuit = k === 1 ? 1 : 0; ctx.pluie = k === 2 ? 1 : 0;
      sortie.length = 0; A.dessiner(jour, t, ctx, sortie); vus[k] += sortie.filter(o => /-rapace-/.test(o.shape)).length;
    }
  }
  assert(vus[0] > 0 && vus[1] === 0 && vus[2] === 0, 'aigle en vol le jour seulement, au sec : ' + vus);
  console.log('   bêtes au repos : ' + Math.round(repos(jour) * 100) + ' % le jour, ' + Math.round(repos(nuit) * 100) + ' % la nuit');
});

verifier('sol exact : la hauteur suit les triangles du maillage rendu', () => {
  for (const theme of ['montagne', 'pacifique']) for (const saison of ['ete', 'hiver']) {
    const { c, decor } = circuit(theme, saison), etat = creerObservable(c, decor, {}), T = etat.G.T;
    const terrains = decor.nappes.filter(n => n.surfaceType === 'terrain');
    let essais = 0, pire = 0;
    for (const g of etat.groupes) for (let q = 0; q < 12; q++) {
      const x = g.hx + (q - 4.5) * 3.7, z = g.hz + (q % 3 - 1) * 5.3;
      for (const n of terrains) {
        const S = n.sommets, I = n.indices;
        for (let k = 0; k < I.length; k += 3) {
          const a = I[k] * 13, b = I[k + 1] * 13, cc = I[k + 2] * 13;
          const ax = S[a], az = S[a + 2], bx = S[b], bz = S[b + 2], cx = S[cc], cz = S[cc + 2];
          if (Math.min(ax, bx, cx) > x || Math.max(ax, bx, cx) < x || Math.min(az, bz, cz) > z || Math.max(az, bz, cz) < z) continue;
          const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz), l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, l3 = 1 - l1 - l2;
          if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
          pire = Math.max(pire, Math.abs(l1 * S[a + 1] + l2 * S[b + 1] + l3 * S[cc + 1] - A.solExact(T, x, z))); essais++;
        }
      }
    }
    assert(essais > 20 && pire < 2e-3, theme + ' : écart ' + pire + ' sur ' + essais + ' points');
  }
});

verifier('course reprise du départ : mêmes bêtes, mêmes trajets', () => {
  const { c, decor } = circuit('asie'), a = creerObservable(c, decor, {}), b = creerObservable(c, decor, {}), voit = peloton(c);
  for (let n = 0; n < 120 * 30; n++) { voit.placer(n * DT); A.pas(a, n * DT, voit); }
  for (let n = 0; n < 120 * 20; n++) { voit.placer(n * DT); A.pas(a, n * DT, voit); A.pas(b, n * DT, voit); }
  assert.equal(a.k, b.k); assert.deepEqual(Array.from(a.cour), Array.from(b.cour)); assert.deepEqual(Array.from(a.gs), Array.from(b.gs));
  // séance suivante sur la même scène, horloge en avant (la vitrine a tourné moins longtemps que le départ de la
  // course d'essai, qui part à 6 s) : repartir rend l'état d'une création neuve, moment compris
  const nuit = creerObservable(c, decor, { moment: 'nuit' });
  A.repartir(a, { moment: 'nuit' });
  assert.equal(a.moment, 'nuit'); assert.equal(A.nuitA(a, 12), 1);
  for (let n = 0; n < 120 * 20; n++) { const t = 52 + n * DT; voit.placer(t); A.pas(a, t, voit); A.pas(nuit, t, voit); }
  assert.equal(a.k, nuit.k); assert.deepEqual(Array.from(a.cour), Array.from(nuit.cour)); assert.deepEqual(Array.from(a.cer), Array.from(nuit.cer));
});

console.log(controles + ' contrôles animaux');
