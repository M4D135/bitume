// BITUME lot 18 : le public des tribunes (src/public.js), de vrais corps d'EMPRISE à la place des boîtes.
// Ce que les captures ne prouvent pas, vérifié sans navigateur :
//   - provenance : les corps viennent des copies d'EMPRISE cc00482 (empreintes) ; ni Math.random, ni réseau ;
//   - maillages : os, parties et sens des faces valides, budget de triangles par niveau, corps détaillé de près ;
//   - placement : chaque spectateur assis ou debout est sur une marche du décor (primitives de collision du jeu),
//     aucun n'entre dans un pilier ni dans un objet solide, ceux des glissières restent derrière elles ; sous les
//     toits du décor, personne n'ouvre de parapluie ;
//   - nombre et variété sur les sept circuits, présence selon la météo, saison dans les tenues, pas de blanc sur blanc ;
//   - animation : fête au départ et à l'arrivée, abris sous la pluie, excitation au passage, même mouvement à
//     30, 60 et 120 images par seconde ; le hasard du public ne doit rien à la course ni au décor ;
//   - listes de niveaux : plafonds, trame qui partage [0, 1) sans trou ni recouvrement, paliers ;
//   - vue WebGPU simulée : rien n'est créé après la première image, appels de dessin bornés ;
//   - aucune allocation par image (processus fils : ramasse-miettes observé, nouvel espace mesuré).
// Fonctionne sans le branchement (decor.js, jeu.js : docs/reprise/rapports/public-2026-11-18/integration.patch) :
// les gradins viennent alors de public.decrireGradins, que les marches du décor contrôlent ici. Branchement appliqué,
// la description exportée par le décor est comparée à celle-ci et l'absence de collision nouvelle est vérifiée.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
for (const f of ['carene', 'circuit', 'decor', 'obstacles', 'humain-donnees', 'humain-corps', 'public-shaders', 'public-gpu', 'public']) require('../src/' + f + '.js');
const B = globalThis.BITUME, P = B.public;
const CATALOGUE = [[11, 'foret', 4200], [29, 'cote', 3600], [47, 'montagne', 5200], [83, 'islande', 4600], [107, 'desert', 4800], [131, 'asie', 5000], [157, 'pacifique', 5200]];
const circuitDe = ([graine, theme, longueur]) => B.circuit.creer(graine, { theme, longueur });
const decorDe = (c, plus = {}) => B.decor.construire(c, Object.assign({ matieres: false, vegetation: false }, plus));

// ------------------------------------------------------------------------------------------------------------------
// Processus fils : aucune allocation par image (animer, lister, listerOmbre), sur la scène de Val-Brûlé.
// ------------------------------------------------------------------------------------------------------------------
if (process.argv[2] === '--allocations') {
  const { PerformanceObserver, performance } = await import('node:perf_hooks');
  const v8 = await import('node:v8');
  const gcs = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) gcs.push(e.startTime); }).observe({ entryTypes: ['gc'] });
  const c = circuitDe(CATALOGUE[0]), pub = P.creer(c, decorDe(c), { qualite: 'high', saison: 'ete' }), liste = P.creerListe(pub);
  const reglage = { bande0: P.PALIERS.high.bande0, bande1: P.PALIERS.high.bande1, plafond0: 48, plafond1: 360, niveauMin: 0 };
  const t0 = pub.gradins.tribunes[0], s0 = t0.s - 250, N = 1500, piste = new Float64Array(N * 3);
  for (let k = 0; k < N; k++) { const f = B.decor.cadre(c, Math.round((s0 + k * .4) / c.pas)); piste[k * 3] = f.x; piste[k * 3 + 1] = f.y; piste[k * 3 + 2] = f.z; }
  const oeil = [t0.x - Math.sin(t0.a) * -7, t0.y + 2, t0.z + Math.cos(t0.a) * -7], avant = [-Math.sin(t0.a) * -1, 0, Math.cos(t0.a) * -1];
  const droite = [-avant[2], 0, avant[0]], haut = [0, 1, 0], dir = [.3, .85, .2], centre = [t0.x, t0.y, t0.z];
  // Le harnais ne range aucun nombre par image : voitures, ambiances et temps sont préparés d'avance, comme le jeu
  // passe des objets et une horloge déjà en mémoire. Ranger un flottant dans un objet peut allouer, selon les choix
  // de l'optimiseur (constaté environ une fois sur dix : 48 octets par image, tous dans le harnais) ; ce coût serait celui du
  // test, pas celui du module.
  const points = []; for (let k = 0; k < N; k++) points.push({ x: piste[k * 3], y: piste[k * 3 + 1], z: piste[k * 3 + 2] });
  const voitures = [points[0], points[20], points[40]];
  const ambiances = []; for (let k = 0; k < 500; k++) ambiances.push({ pluie: k / 500, neige: 0, mouille: 0, feux: 5, vert: true, termine: false });
  const temps = [null]; for (let k = 0; k < 24000; k++) temps[k] = k / 60;
  const cadrage = new Float64Array([.92, .577, 1121, 1]), cadrageOmbre = new Float64Array([60, .9, 0, 20]);
  const tour = k => {
    const j = (k * 7) % (N - 60);
    voitures[0] = points[j]; voitures[1] = points[j + 20]; voitures[2] = points[j + 40];
    P.animer(pub, temps[k], voitures, 3, ambiances[k % 500]);
    liste.lister(oeil, avant, droite, haut, cadrage, reglage);
    liste.listerOmbre(centre, dir, oeil, cadrageOmbre);
  };
  for (let k = 0; k < 4000; k++) tour(k);
  globalThis.gc();
  const nouvel = () => v8.getHeapSpaceStatistics().find(s => s.space_name === 'new_space').space_used_size;
  const a0 = nouvel(), d0 = performance.now(), TOURS = 20000;
  for (let k = 4000; k < 4000 + TOURS; k++) tour(k);
  const d1 = performance.now(), a1 = nouvel();
  await new Promise(r => setTimeout(r, 60));
  console.log(JSON.stringify({ ramassages: gcs.filter(t => t >= d0 && t <= d1).length, octets: a1 - a0, tours: TOURS, usParImage: +((d1 - d0) * 1000 / TOURS).toFixed(2) }));
  process.exit(0);
}

const rapport = {};

// ------------------------------------------------------------------------------------------------------------------
// 1. Provenance et hygiène du module
// ------------------------------------------------------------------------------------------------------------------
{
  const sha = f => createHash('sha256').update(readFileSync(new URL(f, import.meta.url))).digest('hex');
  // EMPRISE M4D135/emprise, commit cc004826a506e6979eaaec217748fe85d5cd6ac5 : src/human-data.js et src/body-data.js.
  assert.equal(sha('../src/humain-donnees.js'), '4477d881c01414c6b89c3d838210172f5b643bca200e869c31e301f4a6a9720e',
    'humain-donnees.js n’est plus la copie d’EMPRISE cc00482 (src/human-data.js) : revoir les profils de public.js');
  assert.equal(sha('../src/humain-corps.js'), '7eeccbe7ed7746b51921696045808dfe20f4025c7117fdec8f10951a4615d1ad',
    'humain-corps.js n’est plus la copie d’EMPRISE cc00482 (src/body-data.js) : revoir les profils de public.js');
  assert.equal(P.provenance.depot, 'M4D135/emprise');
  assert.equal(P.provenance.commit, 'cc004826a506e6979eaaec217748fe85d5cd6ac5');
  const source = readFileSync(new URL('../src/public.js', import.meta.url), 'utf8');
  assert.ok(source.slice(0, 4000).includes('cc004826a506e6979eaaec217748fe85d5cd6ac5'), 'provenance dans l’en-tête du module');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const interdit of ['Math.random', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'import(', 'localStorage', 'Date.now'])
    assert.ok(!code.includes(interdit), `public.js ne doit pas employer ${interdit}`);
  for (const shader of Object.values(B.shadersPublic)) {
    for (const name of ['uSections', 'uSections2']) assert.equal(shader.uniforms.fields.find(f => f.name === name).count, P.SECTIONS);
    assert.match(shader.vertex, /@vertex/);
  }
  assert.match(B.shadersPublic.couleur.fragment, /@fragment/);
  // Construction : public.js après les copies d'EMPRISE dont il appelle les fonctions (si le module est branché).
  const ordre = readFileSync(new URL('../construire.py', import.meta.url), 'utf8');
  if (ordre.includes("'public.js'")) assert.ok(ordre.indexOf("'public.js'") > ordre.indexOf("'humain-corps.js'"), 'public.js se construit après humain-corps.js');
}

// ------------------------------------------------------------------------------------------------------------------
// 2. Maillages : trois niveaux dans un tampon, os, parties, sens des faces, budget
// ------------------------------------------------------------------------------------------------------------------
const BUDGET = [{ triangles: 6200, corpsMin: 2500 }, { triangles: 1200, corpsMin: 400 }, { triangles: 150, corpsMin: 60 }];
const M = P.maillages();
{
  assert.equal(P.maillages(), M, 'maillages préparés une fois');
  const f32 = new Float32Array(M.sommets), u8 = new Uint8Array(M.sommets), S = P.SOMMET / 4;
  assert.equal(M.sommets.byteLength, M.nombre * P.SOMMET);
  const osValides = new Set(Object.values(P.OS));
  for (let i = 0; i < M.nombre; i++) {
    for (let k = 0; k < 8; k++) assert.ok(Number.isFinite(f32[i * S + k]), 'sommet fini');
    const ln = Math.hypot(f32[i * S + 3], f32[i * S + 4], f32[i * S + 5]);
    assert.ok(ln > .97 && ln < 1.03, `normale unitaire (sommet ${i} : ${ln})`);
    assert.ok(osValides.has(u8[i * P.SOMMET + 32]) && osValides.has(f32[i * S + 6]), `os valides (sommet ${i})`);
    assert.ok(f32[i * S + 7] >= 0 && f32[i * S + 7] <= 1, 'poids du second os');
    assert.ok(u8[i * P.SOMMET + 33] <= 10 && u8[i * P.SOMMET + 34] <= 16 && (u8[i * P.SOMMET + 35] & 31) <= 9, 'teinte, partie, matière');
  }
  let suite = 0;
  rapport.niveaux = [];
  for (const nv of M.niveaux) {
    assert.equal(nv.premier, suite, 'niveaux contigus'); assert.equal(nv.compte % 3, 0); suite += nv.compte;
    const b = BUDGET[nv.niveau], tri = nv.compte / 3, corps = M.parPartie[nv.niveau][P.PARTIE.CORPS];
    assert.ok(tri <= b.triangles, `budget du niveau ${nv.niveau} : ${tri} > ${b.triangles} triangles`);
    assert.ok(corps >= b.corpsMin, `corps du niveau ${nv.niveau} trop pauvre : ${corps} triangles`);
    assert.equal(P.trianglesDe(nv.niveau, 0xffffffff), tri); assert.equal(P.trianglesDe(nv.niveau, 0), corps);
    let directs = 0, utiles = 0, yMin = Infinity, yMax = -Infinity;
    for (let k = nv.premier; k < nv.premier + nv.compte; k += 3) {
      const t = [M.indices[k], M.indices[k + 1], M.indices[k + 2]];
      for (const i of t) assert.ok(i < M.nombre, 'indice dans le tampon');
      const parties = t.map(i => u8[i * P.SOMMET + 34]);
      assert.ok(parties[0] === parties[1] && parties[1] === parties[2], 'un triangle appartient à une seule partie (masquage par spectateur)');
      const p = t.map(i => [f32[i * S], f32[i * S + 1], f32[i * S + 2]]), n = t.map(i => [f32[i * S + 3], f32[i * S + 4], f32[i * S + 5]]);
      const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], v = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
      const g = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (Math.hypot(g[0], g[1], g[2]) < 1e-9) continue;
      utiles++;
      if (g[0] * (n[0][0] + n[1][0] + n[2][0]) + g[1] * (n[0][1] + n[1][1] + n[2][1]) + g[2] * (n[0][2] + n[1][2] + n[2][2]) > 0) directs++;
      if (parties[0] === P.PARTIE.CORPS) for (const q of p) { yMin = Math.min(yMin, q[1]); yMax = Math.max(yMax, q[1]); }
    }
    // Faces dans le sens direct vues de dehors : le moteur élimine les faces arrière.
    assert.ok(directs / utiles > .97, `sens des faces du niveau ${nv.niveau} : ${(100 * directs / utiles).toFixed(1)} % directs`);
    assert.ok(yMin > -.02 && yMax > 1.78 && yMax < 1.86, `taille du corps au repos (${yMin.toFixed(3)} à ${yMax.toFixed(3)} m)`);
    rapport.niveaux.push({ niveau: nv.niveau, triangles: tri, sommets: nv.sommets, corps, directs: +(directs / utiles).toFixed(4) });
  }
  assert.equal(suite, M.indices.length);
  assert.ok(M.niveaux[0].compte > M.niveaux[1].compte * 3 && M.niveaux[1].compte > M.niveaux[2].compte * 4, 'trois niveaux bien distincts');
}

// ------------------------------------------------------------------------------------------------------------------
// 3. Génération sur les sept circuits : nombre, placement sur les marches, piliers, objets, glissières
// ------------------------------------------------------------------------------------------------------------------
function hacher(pub) {
  const h = createHash('sha256');
  for (const t of [pub.flottants, pub.entiers, pub.cpu, pub.sections]) h.update(Buffer.from(t.buffer, t.byteOffset, t.byteLength));
  return h.digest('hex');
}
function empreinteDecor(d) {
  const h = createHash('sha256');
  const visiter = x => {
    if (typeof x === 'function') return;
    if (ArrayBuffer.isView(x)) { h.update(Buffer.from(x.buffer, x.byteOffset, x.byteLength)); return; }
    if (x && typeof x === 'object') { h.update(Array.isArray(x) ? '[' : '{'); for (const k of Object.keys(x)) { h.update(k + '='); visiter(x[k]); } h.update('}'); return; }
    h.update(typeof x + ':' + String(x) + ';');
  };
  visiter({ lots: d.lots.map(l => l.objets.map(o => [o.shape, o.p, o.s, o.r, o.collision, o.mat])), obstacles: d.obstacles });
  return h.digest('hex');
}
const lire = (pub, i) => {
  const f = pub.flottants, e = pub.entiers, o = i * 8;
  return { x: f[o], y: f[o + 1], z: f[o + 2], cap: f[o + 3], avance: f[o + 4], chute: f[o + 5], hauteur: f[o + 6], largeur: f[o + 7],
    g: e[o], masque: e[o + 1], traits: e[o + 2], section: e[o + 3] & 255, second: e[o + 3] >>> 8, haut: e[o + 4], bas: e[o + 5], coiffe: e[o + 6], accessoire: e[o + 7] };
};
// Collisions du décor près de la ligne droite : la primitive du jeu, son centre et un rayon englobant.
function voisins(decor, pub) {
  const xs = [], zs = [];
  for (let i = 0; i < pub.n; i++) { xs.push(pub.flottants[i * 8]); zs.push(pub.flottants[i * 8 + 2]); }
  const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30, z0 = Math.min(...zs) - 30, z1 = Math.max(...zs) + 30, l = [];
  for (const o of decor.obstacles) {
    const x = o.x ?? o.p[0], z = o.z ?? o.p[2], rayon = o.type === 'box' ? Math.hypot(o.hx, o.hz) : o.type === 'circle' ? o.r : Math.hypot(o.s[0], o.s[2]) / 2;
    if (x + rayon >= x0 && x - rayon <= x1 && z + rayon >= z0 && z - rayon <= z1) l.push({ o, x, z, rayon });
  }
  return l;
}
const touche = (proches, a, garder = null) => proches.some(({ o, x, z, rayon }) => (!garder || garder(o))
  && Math.hypot(x - a.x, z - a.z) <= rayon + Math.hypot(a.hx, a.hz) + .01 && B.obstacles.tester(a, o));
const scenes = [];
rapport.circuits = [];
for (const k of CATALOGUE) {
  const c = circuitDe(k), decor = decorDe(c), avantCreer = empreinteDecor(decor);
  const lim = B.decor.limites(c);
  const ligne = { circuit: k[1] };
  for (const q of ['high', 'medium', 'low']) {
    const pub = P.creer(c, decor, { qualite: q, saison: 'ete' }), pal = P.PALIERS[q];
    assert.ok(pub.n >= pal.cible * .88 && pub.n <= pal.cible * 1.12, `${k[1]} ${q} : ${pub.n} spectateurs pour ${pal.cible} voulus`);
    const voulus = pal.cible * pal.glissieres;
    assert.ok(pub.compte.glissiere >= voulus * .6 && pub.compte.glissiere <= voulus * 1.4, `${k[1]} ${q} : ${pub.compte.glissiere} aux glissières`);
    assert.ok(pub.compte.enfants >= pub.n * .025 && pub.compte.enfants <= pub.n * .1, `${k[1]} ${q} : ${pub.compte.enfants} enfants`);
    ligne[q] = pub.n;
    if (q === 'high') scenes.push({ k, c, decor, pub });
  }
  assert.equal(empreinteDecor(decor), avantCreer, `${k[1]} : creer ne touche pas au décor (ni objet ni collision)`);
  // Placement contrôlé par les primitives de collision du jeu (decor.obstacles, obstacles.tester).
  const { pub } = scenes[scenes.length - 1], proches = voisins(decor, pub);
  const gradins = decor.obstacles.filter(o => o.genre === 'gradin' && o.type === 'box' && Math.abs(o.hz - .575) < 1e-9);
  assert.ok(gradins.length >= 8 * pub.gradins.tribunes.length, `${k[1]} : marches du décor trouvées`);
  // Abris sous la pluie, d'après les toits du décor : rapport entre la distance de la tête au bord du toit et la hauteur
  // du toit au-dessus d'elle. Bien couvert (> 0,6) : au sec, sans parapluie ni capuche ; à découvert (< 0,3) : parapluie,
  // capuche ou rien. Entre les deux, la pente de la pluie du module décide.
  const toits = decor.obstacles.filter(o => o.genre === 'toit' && o.type === 'box');
  const couvert = (x, yTete, z) => {
    let q = -Infinity;
    for (const o of toits) {
      if (o.ymin < yTete + .3) continue;
      const dx = x - o.x, dz = z - o.z, ca = Math.cos(o.angle), sa = Math.sin(o.angle), lx = dx * ca + dz * sa, lz = -dx * sa + dz * ca;
      q = Math.max(q, Math.min(o.hx - Math.abs(lx), o.hz - Math.abs(lz)) / (o.ymin - yTete));
    }
    return q;
  };
  let assis = 0, debout = 0, rails = 0, secs = 0, exposes = 0;
  for (let i = 0; i < pub.n; i++) {
    const s = lire(pub, i), genre = s.traits & 3, abri = (s.traits >>> 22) & 3;
    const q = couvert(s.x, s.y + (genre === P.GENRE.ASSIS ? .85 : 1.6), s.z);
    if (q > .6) assert.equal(abri, P.ABRI.TOIT, `${k[1]} : spectateur ${i} sous le toit avec un parapluie ou une capuche`);
    if (q < .3) assert.notEqual(abri, P.ABRI.TOIT, `${k[1]} : spectateur ${i} au sec à découvert`);
    assert.equal(abri === P.ABRI.PARAPLUIE, !!(s.masque & 1 << P.PARTIE.PARAPLUIE), `${k[1]} : parapluie du spectateur ${i}`);
    assert.equal(abri === P.ABRI.CAPUCHE, !!(s.masque & 1 << P.PARTIE.CAPUCHE), `${k[1]} : capuche du spectateur ${i}`);
    abri === P.ABRI.TOIT ? secs++ : exposes++;
    if (genre === P.GENRE.GLISSIERE) {
      rails++;
      // derrière la glissière : plus loin de l'axe que la limite de piste de ce côté (point de l'axe le plus proche)
      let meilleur = Infinity, lat = 0, L = 0;
      for (let j = 0; j < c.n; j++) {
        const dx = s.x - c.x[j], dz = s.z - c.z[j], d2 = dx * dx + dz * dz;
        if (d2 < meilleur) { meilleur = d2; const f = B.decor.cadre(c, j); lat = dx * f.r[0] + dz * f.r[2]; L = (lat < 0 ? lim.G : lim.D)[f.i]; }
      }
      assert.ok(Math.abs(lat) >= L + .6, `${k[1]} : spectateur ${i} devant la glissière (${Math.abs(lat).toFixed(2)} m pour une limite à ${L.toFixed(2)} m)`);
      assert.ok(!touche(proches, { x: s.x, z: s.z, angle: 0, hx: .2, hz: .2, ymin: s.y + .15, ymax: s.y + 1.75 }), `${k[1]} : spectateur ${i} dans un objet solide`);
      continue;
    }
    const surface = genre === P.GENRE.ASSIS ? s.y - .10 : s.y;
    genre === P.GENRE.ASSIS ? assis++ : debout++;
    // posé sur une marche : une sonde juste sous le plan touche une marche, une sonde juste au-dessus ne touche rien
    assert.ok(gradins.some(o => B.obstacles.tester({ x: s.x, z: s.z, angle: 0, hx: .02, hz: .02, ymin: surface - .03, ymax: surface - .008 }, o)),
      `${k[1]} : spectateur ${i} (${genre === P.GENRE.ASSIS ? 'assis' : 'debout'}) hors des marches`);
    assert.ok(!touche(proches, { x: s.x, z: s.z, angle: 0, hx: .02, hz: .02, ymin: surface + .008, ymax: surface + .05 }), `${k[1]} : spectateur ${i} enfoncé dans une marche`);
    // le corps (torse) ne touche rien ; assis, les genoux passent à côté des piliers du toit et des poteaux
    assert.ok(!touche(proches, { x: s.x, z: s.z, angle: 0, hx: .14, hz: .1, ymin: surface + .2, ymax: surface + (genre === P.GENRE.ASSIS ? .8 : 1.5) }), `${k[1]} : spectateur ${i} dans un objet`);
    if (genre === P.GENRE.ASSIS) {
      const gx = s.x + Math.sin(s.cap) * s.avance * .9, gz = s.z + Math.cos(s.cap) * s.avance * .9;
      assert.ok(!touche(proches, { x: gx, z: gz, angle: -s.cap, hx: .16, hz: .08, ymin: surface - .05, ymax: surface + .25 }, o => o.genre !== 'gradin'),
        `${k[1]} : genoux du spectateur ${i} dans un objet`);
    }
  }
  assert.ok(assis > pub.n * .6 && debout > 0 && rails > 0, `${k[1]} : assis, debout et glissières`);
  assert.ok(secs > pub.n * .4 && exposes > pub.n * .1 && secs === pub.compte.abrites, `${k[1]} : ${secs} au sec sous les toits, ${exposes} à découvert`);
  // Branchement (patch d'intégration) : la description exportée par le décor égale celle du module, et le décor
  // garde ses collisions ; sans branchement, decrireGradins vient d'être contrôlé par les marches ci-dessus.
  if (k[0] === 11) {
    const branche = decorDe(c, { public: true });
    if (branche.gradins) {
      assert.ok(!Object.keys(branche).includes('gradins'), 'gradins non énumérable (empreinte du décor inchangée)');
      const ref = P.decrireGradins(c), arrondir = x => JSON.parse(JSON.stringify(x, (_, v) => typeof v === 'number' ? +v.toFixed(9) : v));
      assert.deepEqual(arrondir(branche.gradins), arrondir(ref), 'decor.gradins et public.decrireGradins décrivent les mêmes tribunes');
      assert.deepEqual(JSON.stringify(branche.obstacles), JSON.stringify(decor.obstacles), 'aucune collision nouvelle avec le public');
      rapport.branchement = 'appliqué';
    } else rapport.branchement = 'absent (decrireGradins contrôlé par les marches)';
  }
  ligne.assis = assis; ligne.debout = debout; ligne.glissieres = rails; ligne.auSec = secs;
  rapport.circuits.push(ligne);
}

// ------------------------------------------------------------------------------------------------------------------
// 4. Hasard propre, déterminisme, saisons et variété
// ------------------------------------------------------------------------------------------------------------------
const { c: c0, decor: d0, pub: pub0 } = scenes[0];
{
  const hasard = Math.random;
  Math.random = () => { throw new Error('Math.random employé par le public'); };
  try {
    const a = P.creer(c0, d0, { qualite: 'high', saison: 'ete' }), b = P.creer(c0, d0, { qualite: 'high', saison: 'ete' });
    assert.equal(hacher(a), hacher(b), 'même circuit, même public');
    assert.equal(hacher(a), hacher(pub0));
    const liste = P.creerListe(a);
    P.animer(a, 1, [{ x: 0, y: 0, z: 0 }], 1, { vert: true });
    liste.lister([0, 2, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 1000, 1], { bande0: [84, 106], bande1: [16, 21], plafond0: 48, plafond1: 360, niveauMin: 0 });
  } finally { Math.random = hasard; }
  // Autre graine : autre public ; la saison change les tenues, pas les places (tirages séparés).
  const autre = P.creer(c0, d0, { qualite: 'high', saison: 'ete', graine: 12345 });
  assert.notEqual(hacher(autre), hacher(pub0));
  const hiver = P.creer(c0, d0, { qualite: 'high', saison: 'hiver' });
  assert.equal(hiver.n, pub0.n);
  for (let i = 0; i < pub0.n; i++) for (let k = 0; k < 4; k++) assert.equal(hiver.flottants[i * 8 + k], pub0.flottants[i * 8 + k], 'places identiques d’une saison à l’autre');
  const tenues = pub => {
    const t = { n: pub.n, peaux: new Set(), cheveux: new Set(), motifs: new Set(), visages: new Set(), postures: new Set(), combos: new Set(), feminin: 0,
      casquette: 0, paille: 0, bonnet: 0, lunettes: 0, courtes: 0, echarpe: 0, gants: 0, parapluie: 0, capuche: 0, drapeau: 0, moustache: 0, hauteurs: [],
      exposes: 0, blancSurBlanc: 0 };
    // luminance d'une couleur empaquetée (8 bits par canal) ; le module corrige au-delà de 0,6, avant l'arrondi
    const lum = c => (.2126 * ((c >>> 16) & 255) + .7152 * ((c >>> 8) & 255) + .0722 * (c & 255)) / 255;
    for (let i = 0; i < pub.n; i++) {
      const s = lire(pub, i), m = s.masque, tr = s.traits, A = P.PARTIE;
      if (((tr >>> 22) & 3) !== P.ABRI.TOIT) t.exposes++;
      if (lum(s.haut) > .62 && lum(s.bas) > .62) t.blancSurBlanc++;
      t.peaux.add((tr >>> 2) & 7); t.cheveux.add((tr >>> 5) & 7); t.motifs.add((tr >>> 18) & 15); t.visages.add((tr >>> 24) & 15); t.postures.add((tr >>> 28) & 3);
      t.combos.add([s.haut, s.bas, s.coiffe, m, tr & ~3].join(','));
      if (tr & 1 << 10) t.feminin++;
      if (m & 1 << A.CASQUETTE) t.casquette++; if (m & 1 << A.CHAPEAU) t.paille++; if (m & 1 << A.BONNET) t.bonnet++; if (m & 1 << A.LUNETTES) t.lunettes++;
      if (m & 1 << A.ECHARPE) t.echarpe++; if (m & 1 << A.PARAPLUIE) t.parapluie++; if (m & 1 << A.CAPUCHE) t.capuche++; if (m & 1 << A.DRAPEAU) t.drapeau++;
      if (m & 1 << A.MOUSTACHE) t.moustache++; if (tr & 1 << 11) t.courtes++; if (tr & 1 << 13) t.gants++;
      if (s.hauteur > .9) t.hauteurs.push(s.hauteur);
    }
    return t;
  };
  const e = tenues(pub0), h = tenues(hiver), part = (x, t) => x / t.n;
  assert.ok(e.combos.size >= e.n * .97, `tenues presque toutes différentes (${e.combos.size} sur ${e.n})`);
  assert.ok(e.peaux.size >= 7 && e.cheveux.size >= 7 && e.motifs.size >= 7 && e.visages.size >= 15 && e.postures.size === 3, 'peaux, cheveux, motifs, visages et postures variés');
  assert.ok(part(e.feminin, e) > .28 && part(e.feminin, e) < .48, 'femmes et hommes');
  assert.ok(Math.max(...e.hauteurs) - Math.min(...e.hauteurs) > .12, 'tailles variées');
  assert.ok(part(e.casquette, e) > .2 && part(e.paille, e) > .03 && e.bonnet === 0 && part(e.lunettes, e) > .2 && part(e.courtes, e) > .45, 'tenues d’été');
  assert.ok(part(h.bonnet, h) > .3 && h.paille === 0 && h.courtes === 0 && part(h.echarpe, h) > .3 && part(h.gants, h) > .2, 'tenues d’hiver');
  // à découvert, presque la moitié a un parapluie et un tiers une capuche ; sous les toits, personne
  assert.ok(e.parapluie / e.exposes > .38 && e.capuche / e.exposes > .26 && part(e.drapeau, e) > .03 && part(e.moustache, e) > .08, 'abris, drapeaux, moustaches');
  assert.ok(e.blancSurBlanc === 0 && h.blancSurBlanc === 0, `blanc sur blanc : ${e.blancSurBlanc} l'été, ${h.blancSurBlanc} l'hiver`);
  rapport.variete = { tenues: e.combos.size, n: e.n, casquettes: e.casquette, paille: e.paille, bonnetsHiver: h.bonnet, aDecouvert: e.exposes,
    parapluies: e.parapluie, capuches: e.capuche, drapeaux: e.drapeau };
}

// ------------------------------------------------------------------------------------------------------------------
// 5. Présence selon la météo : les absents ne viennent pas, toujours les mêmes
// ------------------------------------------------------------------------------------------------------------------
{
  assert.equal(P.presencePour('soleil', 'ete', false), 1);
  assert.equal(P.presencePour('pluie', 'ete', false), .62);
  assert.equal(P.presencePour('variable', 'ete', false), .86);
  assert.ok(Math.abs(P.presencePour('pluie', 'hiver', true) - .62 * .82 * .9) < 1e-12);
  let presents = 0;
  for (let i = 0; i < pub0.n; i++) if (pub0.cpu[i * 4 + 3] < .62) presents++;
  assert.ok(presents / pub0.n > .56 && presents / pub0.n < .68, `présence sous la pluie : ${presents} sur ${pub0.n}`);
  const t = pub0.gradins.tribunes[1], liste = P.creerListe(pub0), reg = { bande0: [84, 106], bande1: [16, 21], plafond0: 48, plafond1: 360, niveauMin: 0 };
  // l'œil de l'autre côté de la piste, à 25 m du front de la tribune, qu'il regarde
  const oeil = [t.x - Math.sin(t.a) * 10, t.y + 3, t.z + Math.cos(t.a) * 10], avant = [Math.sin(t.a), -.05, -Math.cos(t.a)];
  const vus = p => { const r = liste.lister(oeil, avant, [-avant[2], 0, avant[0]], [0, 1, 0], [.92, .577, 1121, p], reg), s = new Set(); for (let k = 0; k < r.total; k++) s.add(r.liste[k] & 0xffff); return s; };
  const tous = vus(1), pluie = vus(.62);
  assert.ok(tous.size > 150, `tribune vue : ${tous.size}`);
  for (const i of pluie) assert.ok(tous.has(i), 'les présents sous la pluie étaient là au soleil');
  assert.ok(pluie.size / tous.size > .5 && pluie.size / tous.size < .74, `sous la pluie, ${pluie.size} sur ${tous.size}`);
}

// ------------------------------------------------------------------------------------------------------------------
// 6. Animation : fête, abris, excitation, regard, et même mouvement à 30, 60 et 120 images par seconde
// ------------------------------------------------------------------------------------------------------------------
function point(c, s, lat, o) {
  const L = c.longueur, ss = ((s % L) + L) % L, i0 = Math.floor(ss / c.pas), u = ss / c.pas - i0, a = B.decor.cadre(c, i0), b = B.decor.cadre(c, i0 + 1);
  o.x = a.x + (b.x - a.x) * u + a.r[0] * lat; o.y = a.y + (b.y - a.y) * u; o.z = a.z + (b.z - a.z) * u + a.r[2] * lat;
}
function simuler(fps, duree, ambianceDe, depart) {
  P.reinitialiser(pub0);
  const V = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], releves = [], pas = fps / 10;
  for (let k = 0; k <= duree * fps; k++) {
    const t = k / fps;
    for (let v = 0; v < 3; v++) point(c0, depart + 62 * t - v * 14, v === 1 ? 2 : -1.5, V[v]);
    P.animer(pub0, t, V, 3, ambianceDe(t));
    if (k % pas === 0) releves.push({ t, s1: pub0.etat.s1.slice(), s2: pub0.etat.s2.slice(), fete: pub0.etat.fete, couverture: pub0.etat.couverture });
  }
  return releves;
}
{
  const t1 = pub0.gradins.tribunes[1], depart = t1.s - 420;
  const ambianceDe = t => ({ pluie: t < 4 ? 0 : Math.min(1, (t - 4) / 3), neige: 0, feux: Math.min(5, Math.floor(t / .6)), vert: t >= 3, termine: false });
  const r = { 30: simuler(30, 16, ambianceDe, depart), 60: simuler(60, 16, ambianceDe, depart), 120: simuler(120, 16, ambianceDe, depart) };
  const ecart = { excitation: 0, regard: 0, poids: 0, fete: 0, couverture: 0 };
  for (const fps of [30, 60]) for (let j = 0; j < r[120].length; j++) {
    const a = r[fps][j], b = r[120][j];
    assert.equal(a.t, b.t);
    for (let s = 0; s < pub0.nSections; s++) {
      const o = s * 4;
      ecart.excitation = Math.max(ecart.excitation, Math.abs(a.s1[o + 3] - b.s1[o + 3]));
      ecart.regard = Math.max(ecart.regard, Math.hypot(a.s1[o] - b.s1[o], a.s1[o + 1] - b.s1[o + 1], a.s1[o + 2] - b.s1[o + 2]));
      ecart.poids = Math.max(ecart.poids, Math.abs(a.s2[o] - b.s2[o]));
    }
    ecart.fete = Math.max(ecart.fete, Math.abs(a.fete - b.fete)); ecart.couverture = Math.max(ecart.couverture, Math.abs(a.couverture - b.couverture));
  }
  // Seul l'échantillonnage des voitures diffère d'une cadence à l'autre : les lissages sont exacts. Le regard suit
  // une cible qui file à plus de 60 m/s : à 30 i/s, son retard diffère de moins de 3 m (un lissage compté par image,
  // lui, s'écarterait de plus de 10 m et l'excitation de plus de 0,2).
  assert.ok(ecart.excitation < .05 && ecart.poids < .05 && ecart.regard < 4 && ecart.fete < 1e-6 && ecart.couverture < .02,
    `même mouvement à 30, 60 et 120 i/s : ${JSON.stringify(ecart)}`);
  rapport.cadence = Object.fromEntries(Object.entries(ecart).map(([k, v]) => [k, +v.toFixed(4)]));
  const R = r[60], a = R.find(x => x.t === 2.5), vert = R.find(x => x.t === 3), apres = R.find(x => x.t === 8);
  assert.ok(Math.abs(a.fete - (.22 + .07 * 4)) < 1e-6, 'attente des feux : la tension monte avec les feux');
  assert.ok(Math.abs(vert.fete - 1) < 1e-9 && Math.abs(apres.fete - Math.exp(-1)) < 1e-6, 'fête au départ, qui retombe en cinq secondes');
  assert.ok(R.find(x => x.t === 7).couverture > .5 && R[R.length - 1].couverture > .98, 'abris ouverts sous la pluie');
  // Excitation : les voitures passent devant la tribune 1 vers 6,8 s ; la section en face s'enflamme puis retombe.
  const sec = Math.floor((t1.s - pub0.gradins.enceinte.debut) / P.LONG_SECTION), o = sec * 4;
  const avantPassage = R.find(x => x.t === 1).s1[o + 3], pendant = Math.max(...R.filter(x => x.t > 5 && x.t < 9).map(x => x.s1[o + 3])), fin = R[R.length - 1].s1[o + 3];
  assert.ok(avantPassage < .05 && pendant > .8 && fin < .25 && fin < pendant * .3, `excitation au passage : ${avantPassage.toFixed(2)} → ${pendant.toFixed(2)} → ${fin.toFixed(2)}`);
  // Regard : vers la voiture la plus proche pendant le passage
  const q = R.find(x => x.t === 6.8), v = { x: 0, y: 0, z: 0 };
  point(c0, depart + 62 * 6.8, -1.5, v);
  assert.ok(Math.hypot(q.s1[o] - v.x, q.s1[o + 2] - v.z) < 30 && q.s2[o] > .8, 'les têtes suivent les voitures');
  // Arrivée : la fête dure six secondes puis retombe en huit
  P.reinitialiser(pub0);
  const f = t => { P.animer(pub0, t, [], 0, { vert: true, termine: t >= 100 }); return pub0.etat.fete; };
  f(90); f(100);
  assert.ok(Math.abs(f(104) - 1) < 1e-9 && Math.abs(f(110) - Math.exp(-.5)) < 1e-6 && f(150) < .01, 'fête à l’arrivée');
  // Écran partagé : le jeu anime une fois par vue ; deux appels dans la même image valent un seul.
  const etatApres = doubler => {
    P.reinitialiser(pub0);
    const V = [{ x: 0, y: 0, z: 0 }];
    for (let k = 0; k <= 120; k++) {
      point(c0, depart + 300 + 62 * k / 60, 0, V[0]);
      const a = { pluie: k > 30 ? 1 : 0, vert: true };
      P.animer(pub0, k / 60, V, 1, a);
      if (doubler) P.animer(pub0, k / 60, V, 1, a);
    }
    return [...pub0.etat.s1, ...pub0.etat.s2, pub0.etat.couverture];
  };
  assert.deepEqual(etatApres(true), etatApres(false), 'deux vues dans la même image : même animation');
  P.reinitialiser(pub0);
  assert.equal(pub0.etat.version, 0); assert.equal(pub0.etat.fete, 0);
}

// ------------------------------------------------------------------------------------------------------------------
// 7. Listes de niveaux : plafonds, paliers, trame qui partage [0, 1), ombre
// ------------------------------------------------------------------------------------------------------------------
{
  const t = pub0.gradins.tribunes[1];
  const vues = [];
  for (const D of [3, 8, 18, 40, 90, 160]) for (const L of [0, -30, 60]) {
    const lat = t.recul + D, oeil = [t.x - Math.sin(t.a) * lat + Math.cos(t.a) * L, t.y + 1.6, t.z + Math.cos(t.a) * lat + Math.sin(t.a) * L];
    const cible = [t.x - Math.sin(t.a) * (t.recul - 4.6), t.y + 2, t.z + Math.cos(t.a) * (t.recul - 4.6)];
    const d = [cible[0] - oeil[0], cible[1] - oeil[1], cible[2] - oeil[2]], l = Math.hypot(...d), avant = d.map(x => x / l);
    const dr = Math.hypot(avant[0], avant[2]), droite = [-avant[2] / dr, 0, avant[0] / dr];
    const haut = [droite[1] * avant[2] - droite[2] * avant[1], droite[2] * avant[0] - droite[0] * avant[2], droite[0] * avant[1] - droite[1] * avant[0]];
    vues.push({ D, oeil, avant, droite, haut });
  }
  const bilan = {};
  for (const q of ['high', 'medium', 'low']) {
    const pub = q === 'high' ? pub0 : P.creer(c0, d0, { qualite: q, saison: 'ete' }), pal = P.PALIERS[q], liste = P.creerListe(pub);
    const reg = { bande0: pal.bande0, bande1: pal.bande1, plafond0: pal.plafond0, plafond1: pal.plafond1, niveauMin: pal.niveauMin };
    let maxN0 = 0, maxN1 = 0, maxTri = 0;
    for (const v of vues) {
      const r = liste.lister(v.oeil, v.avant, v.droite, v.haut, [.577 * 1390 / 1295, .577, 1121, 1], reg);
      assert.equal(r.total, r.compte[0] + r.compte[1] + r.compte[2]);
      if (pal.plafond0) assert.ok(r.compte[0] <= pal.plafond0, `${q} : ${r.compte[0]} corps fins > plafond ${pal.plafond0}`);
      if (pal.plafond1) assert.ok(r.compte[1] <= pal.plafond1, `${q} : ${r.compte[1]} corps allégés > plafond ${pal.plafond1}`);
      if (pal.niveauMin >= 1) assert.equal(r.compte[0], 0, `${q} : pas de corps fin`);
      if (pal.niveauMin >= 2) assert.equal(r.compte[1], 0, `${q} : silhouettes seules`);
      // Chaque spectateur vu reçoit des intervalles de trame qui couvrent [0, 1) exactement (8 bits).
      const parts = new Map();
      for (let k = 0; k < r.total; k++) {
        const x = r.liste[k], i = x & 0xffff, bas = (x >>> 16) & 255, h = x >>> 24;
        assert.ok(i < pub.n && h >= bas, 'entrée de liste valide');
        if (!parts.has(i)) parts.set(i, []);
        parts.get(i).push([bas, h]);
      }
      assert.equal(parts.size, r.vus, 'chaque spectateur vu est dessiné');
      for (const [i, l] of parts) {
        l.sort((a, b) => a[0] - b[0]);
        assert.equal(l[0][0], 0, `trame du spectateur ${i} sans trou au début`);
        for (let j = 1; j < l.length; j++) assert.equal(l[j][0], l[j - 1][1], `trame du spectateur ${i} continue`);
        assert.equal(l[l.length - 1][1], 255, `trame du spectateur ${i} complète`);
      }
      maxN0 = Math.max(maxN0, r.compte[0]); maxN1 = Math.max(maxN1, r.compte[1]);
      maxTri = Math.max(maxTri, r.compte[0] * M.niveaux[0].compte / 3 + r.compte[1] * M.niveaux[1].compte / 3 + r.compte[2] * M.niveaux[2].compte / 3);
      if (q === 'high' && v.D === 3) assert.ok(r.compte[0] > 0, 'de près, des corps fins');
      if (v.D === 160) assert.ok(r.vus > 100, `${q} : la tribune ne disparaît pas au loin (${r.vus} vus)`);
    }
    // Ombre : sphère de la boîte du soleil ; niveau allégé près de l'œil, silhouettes au-delà, aucun en Légère
    const v = vues[4], centre = [t.x, t.y, t.z], dir = [.35, .82, .2];
    const o = liste.listerOmbre(centre, dir, v.oeil, [70, 1, pal.niveauMin, 20]);
    for (let k = 0; k < o.total; k++) {
      const i = o.liste[k] & 0xffff, x = pub.cpu[i * 4], y = pub.cpu[i * 4 + 1], z = pub.cpu[i * 4 + 2];
      const proche = Math.hypot(x - v.oeil[0], y - v.oeil[1], z - v.oeil[2]) < 20;
      assert.equal(k < o.debut[2], proche && pal.niveauMin <= 1, 'niveau de l’ombre selon la distance');
    }
    bilan[q] = { n: pub.n, maxCorpsFins: maxN0, maxAlleges: maxN1, maxTrianglesCouleur: maxTri, ombre: o.total };
  }
  // Budget annoncé (docs/reprise/18-PUBLIC.md) : triangles de la passe couleur, au pire des vues essayées
  assert.ok(bilan.high.maxTrianglesCouleur <= 800000 && bilan.medium.maxTrianglesCouleur <= 300000 && bilan.low.maxTrianglesCouleur <= 60000,
    `budget de triangles : ${JSON.stringify(bilan)}`);
  rapport.listes = bilan;
  // Temps processeur, à titre indicatif (borne très large : seule une régression grossière échoue)
  const liste = P.creerListe(pub0), v = vues[1], reg = { bande0: [84, 106], bande1: [16, 21], plafond0: 48, plafond1: 360, niveauMin: 0 };
  const V = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 5 }], cad = new Float64Array([.62, .577, 1121, 1]), cadO = new Float64Array([70, 1, 0, 20]);
  for (let k = 0; k < 2000; k++) { P.animer(pub0, k / 60, V, 2, { vert: true }); liste.lister(v.oeil, v.avant, v.droite, v.haut, cad, reg); }
  const t0 = performance.now();
  for (let k = 0; k < 4000; k++) { P.animer(pub0, k / 60, V, 2, { vert: true }); liste.lister(v.oeil, v.avant, v.droite, v.haut, cad, reg); liste.listerOmbre([t.x, t.y, t.z], [.35, .82, .2], v.oeil, cadO); }
  const us = (performance.now() - t0) * 1000 / 4000;
  assert.ok(us < 1500, `processeur par image : ${us.toFixed(1)} µs`);
  rapport.processeurUsParImage = +us.toFixed(1);
}

// ------------------------------------------------------------------------------------------------------------------
// 8. Vue WebGPU simulée : ressources créées une fois, puis seulement des mises à jour et au plus 3 + 2 dessins
// ------------------------------------------------------------------------------------------------------------------
{
  const appels = new Map();
  const compter = nom => appels.set(nom, (appels.get(nom) || 0) + 1);
  const dispositif = Object.fromEntries(['Buffer', 'ShaderModule', 'Texture', 'RenderPipeline', 'BindGroup', 'BindGroupLayout', 'PipelineLayout', 'Sampler'].map(type =>
    ['create' + type, () => { compter('create' + type); return { createView: () => ({}), destroy: () => compter('destroy' + type) }; }]));
  dispositif.queue = { writeBuffer: () => compter('writeBuffer'), writeTexture: () => compter('writeTexture') };
  globalThis.GPUTextureUsage = globalThis.GPUBufferUsage = globalThis.GPUShaderStage = {};
  require('../src/ferro/webgpu-shaders.js'); require('../src/ferro/webgpu-renderer.js');
  const pass = Object.fromEntries(['setPipeline', 'setBindGroup', 'setVertexBuffer', 'setIndexBuffer', 'drawIndexed'].map(nom => [nom, () => compter(nom)]));
  const moteur = { gpu: { device: dispositif, format: 'rgba8unorm', depthFormat: 'depth32float' }, stats: { contextLost: false } };
  const vue = P.vue(moteur, pub0);
  assert.ok(vue.pret);
  const t = pub0.gradins.tribunes[1], oeil = [t.x - Math.sin(t.a) * -7, t.y + 2, t.z + Math.cos(t.a) * -7], avant = [-Math.sin(t.a) * -1, 0, Math.cos(t.a) * -1];
  const v = { vp: new Float32Array(16), oeil, avant, droite: [-avant[2], 0, avant[0]], haut: [0, 1, 0], tangente: .577, focale: 1121, largeur: 1390, hauteur: 1295 };
  const lumiere = { matrice: new Float32Array(16), direction: [.35, .82, .2], centre: [t.x, t.y, t.z], etendue: 60 };
  lumiere.viewport = [0, 0, 512, 512];
  v.ombre = { matrice: v.vp, textureView: {}, active: true }; v.lumieres = { nombre: 0 };
  const image = k => { P.animer(pub0, k / 60, [], 0, { vert: true }); vue.fx.gpuShadow(pass, lumiere); return vue.fx.gpuColor(pass, v); };
  image(0);
  const apres1 = new Map(appels);
  let dessins = 0;
  for (let k = 1; k <= 120; k++) { const avantDessins = appels.get('drawIndexed') || 0; const r = image(k); dessins = Math.max(dessins, (appels.get('drawIndexed') || 0) - avantDessins); assert.ok(r && r.instances === vue.mesure.niveaux.reduce((a, b) => a + b, 0)); }
  for (const nom of ['createBuffer', 'createTexture', 'createBindGroup', 'createRenderPipeline', 'createShaderModule', 'writeTexture'])
    assert.equal(appels.get(nom), apres1.get(nom), nom + ' appelé en course');
  assert.equal(appels.get('createRenderPipeline'), 2);
  assert.equal(appels.get('writeBuffer') - apres1.get('writeBuffer'), 480, 'uniformes et liste par passe');
  assert.ok(dessins >= 2 && dessins <= 5, 'nombre de dessins par image');
  assert.ok(vue.mesure.vus > 0 && vue.mesure.appels <= 3 && vue.mesure.ombreInstances > 0);
  moteur.stats.contextLost = true;
  assert.equal(image(122), null); moteur.stats.contextLost = false;
  vue.qualite('low'); image(123);
  assert.equal(vue.mesure.niveaux[0] + vue.mesure.niveaux[1], 0, 'palier Légère en course : silhouettes seules');
  vue.liberer();
  assert.equal(vue.pret, false);
  assert.equal(image(124), null); assert.equal(appels.get('destroyTexture'), 2);
  rapport.vue = { appelsParImage: dessins, pipelines: appels.get('createRenderPipeline') };
}

// ------------------------------------------------------------------------------------------------------------------
// 8 bis. Deux vues sur un même périphérique, comme le moteur principal et le rétroviseur (sharedGpu) : depuis FERRO
// 0.3.39 leurs cibles diffèrent (rgba16float avec reflets, rg11b10ufloat sans). Chaque vue dessine avec un pipeline au
// format et au nombre d'échantillons de sa propre cible, et non ceux de la première vue créée sur le périphérique.
// ------------------------------------------------------------------------------------------------------------------
{
  const crees = [];
  const dispositif = Object.fromEntries(['Buffer', 'ShaderModule', 'Texture', 'BindGroup', 'BindGroupLayout', 'PipelineLayout', 'Sampler'].map(type =>
    ['create' + type, () => ({ createView: () => ({}), destroy: () => {} })]));
  dispositif.createRenderPipeline = d => { const p = { d }; crees.push(p); return p; };
  dispositif.queue = { writeBuffer: () => {}, writeTexture: () => {} };
  let courant = null;
  const pass = { setPipeline: p => { courant = p; }, setBindGroup() {}, setVertexBuffer() {}, setIndexBuffer() {}, drawIndexed() {} };
  const moteur = (format, samples) => ({ gpu: { device: dispositif, format, depthFormat: 'depth32float', samples }, stats: { contextLost: false } });
  const vueP = P.vue(moteur('rgba16float', 4), pub0), vueR = P.vue(moteur('rg11b10ufloat', 1), pub0, { niveauMin: 1, ombre: false });
  const t = pub0.gradins.tribunes[1], oeil = [t.x - Math.sin(t.a) * -7, t.y + 2, t.z + Math.cos(t.a) * -7], avant = [-Math.sin(t.a) * -1, 0, Math.cos(t.a) * -1];
  const v = { vp: new Float32Array(16), oeil, avant, droite: [-avant[2], 0, avant[0]], haut: [0, 1, 0], tangente: .577, focale: 1121, largeur: 1390, hauteur: 1295,
    ombre: { matrice: new Float32Array(16), textureView: {}, active: true }, lumieres: { nombre: 0 } };
  const cible = vue => {
    courant = null; P.animer(pub0, 0, [], 0, { vert: true });
    assert.ok(vue.fx.gpuColor(pass, v) && courant, 'la vue dessine le public');
    return courant.d.fragment.targets[0].format + '/' + courant.d.multisample.count;
  };
  assert.equal(cible(vueP), 'rgba16float/4', 'moteur principal');
  assert.equal(cible(vueR), 'rg11b10ufloat/1', 'rétroviseur : sa propre cible');
  assert.equal(cible(vueP), 'rgba16float/4', 'moteur principal, après le rétroviseur');
  assert.equal(crees.length, 2, 'un pipeline par cible, créé une fois');
  vueP.liberer(); vueR.liberer();
  rapport.vuesPartagees = { pipelines: crees.length };
}

// ------------------------------------------------------------------------------------------------------------------
// 9. Aucune allocation par image (processus fils, ramasse-miettes observé)
// ------------------------------------------------------------------------------------------------------------------
{
  const r = spawnSync(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url), '--allocations'], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, 'processus fils : ' + (r.stderr || '').slice(0, 400));
  const m = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(m.ramassages, 0, `ramasse-miettes pendant ${m.tours} images : ${m.ramassages}`);
  assert.ok(m.octets < 64 * 1024, `${m.octets} octets alloués en ${m.tours} images`);
  rapport.allocations = m;
}

console.log('public des tribunes :', JSON.stringify(rapport));
