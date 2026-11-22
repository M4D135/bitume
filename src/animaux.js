/* BITUME — animaux des sept circuits (lot 26, David, 18/11 : « fais aussi des animaux PNJ pour décorer, ils font leur
   vie, bougent etc ; selon le biome animaux différents pour marquer l endroit, identité etc »).
   Les bêtes sont bâties en code au chargement (fuseaux lissés en super-ellipses, tubes le long de courbes, formes libres
   du moteur), posées dans une bande proche des bords réels de la route, hors de son dégagement, et vivent : elles broutent, marchent, se couchent, lèvent la
   tête, se figent puis fuient quand le peloton approche, et reviennent ensuite. Les oiseaux planent, longent la côte ou
   traversent le ciel ; la baleine souffle au large.
   Coût tenu : tout est préparé au chargement (formes) et au départ (habitats). Au dessin, aucun objet n'est créé : les
   pièces viennent d'une réserve par vue, réutilisée d'une image à l'autre. Le cerveau avance à pas fixes de 0,1 s sur
   l'horloge de la course, avec son propre hasard (jamais Math.random ni celui de la course) : mêmes trajectoires à 30,
   60 ou 120 images par seconde. Le détail suit la taille à l'écran ; au loin, une silhouette d'une seule pièce. */
(function (B) {
  'use strict';
  const TAU = Math.PI * 2, PAS = .1, MAX_VUES = 2, MAX_VOITURES = 32, D_MIN = 8, CASE = 4, DEMI_CASE = 2.9;
  const BANDES_ABORDS = Object.freeze({ foret: 38, cote: 50, montagne: 42, islande: 42, desert: 42, asie: 38, pacifique: 42, baikal: 42, fjord: 42, sierra: 42, corail: 45, marseille: 40 });
  const GARDE_BORD = 4, PORTEE_VUES = 360, MAX_CHAMPS = 6;
  const QUALITES = Object.freeze(['off', 'low', 'medium', 'high', 'ultra']);
  const BUDGETS = Object.freeze({
    off: Object.freeze({ individus: 0, proches: 0, moyens: 0, objets: 0, seuilProche: Infinity, seuilMoyen: Infinity, seuilMin: Infinity, lointainsSeuls: false }),
    low: Object.freeze({ individus: 10, proches: 0, moyens: 0, objets: 10, seuilProche: Infinity, seuilMoyen: Infinity, seuilMin: .9, lointainsSeuls: true }),
    medium: Object.freeze({ individus: 400, proches: 5, moyens: 36, objets: 700, seuilProche: 48, seuilMoyen: 9, seuilMin: .8, lointainsSeuls: false }),
    high: Object.freeze({ individus: 400, proches: 14, moyens: 90, objets: 1400, seuilProche: 30, seuilMoyen: 6, seuilMin: .7, lointainsSeuls: false }),
    ultra: Object.freeze({ individus: 400, proches: 28, moyens: 170, objets: 2400, seuilProche: 22, seuilMoyen: 4.5, seuilMin: .6, lointainsSeuls: false }),
  });
  const clamp = (n, a, b) => n < a ? a : n > b ? b : n;
  const lisse = (a, b, n) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const angle = a => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };
  function melanger(n) { n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b); return (n ^ n >>> 16) >>> 0; }
  const hasard = n => melanger(n >>> 0) / 4294967296;

  // ================================================================ géométrie de chargement
  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vunit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const MX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const MY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const MZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  function mm(a, b) {
    const o = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    return o;
  }
  const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

  function courbe(us, vs) {
    const n = us.length, m = new Float64Array(n), d = new Float64Array(Math.max(1, n - 1));
    for (let k = 0; k < n - 1; k++) d[k] = (vs[k + 1] - vs[k]) / (us[k + 1] - us[k]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
    for (let k = 0; k < n - 1; k++) {
      if (d[k] === 0) { m[k] = m[k + 1] = 0; continue; }
      const a = m[k] / d[k], b = m[k + 1] / d[k], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
    }
    return u => {
      if (u <= us[0]) return vs[0];
      if (u >= us[n - 1]) return vs[n - 1];
      let k = 0; while (u > us[k + 1]) k++;
      const h = us[k + 1] - us[k], t = (u - us[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }
  function triangles(m) {
    const p = m.p, f = m.f, n = new Float64Array(p.length);
    let volume = 0;
    for (let k = 0; k < f.length; k += 3) {
      const a = f[k] * 3, b = f[k + 1] * 3, c = f[k + 2] * 3;
      volume += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    if (volume < 0) for (let k = 0; k < f.length; k += 3) { const t = f[k + 1]; f[k + 1] = f[k + 2]; f[k + 2] = t; }
    for (let k = 0; k < f.length; k += 3) {
      const a = f[k] * 3, b = f[k + 1] * 3, c = f[k + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
    }
    const sortie = [];
    for (let k = 0; k < f.length; k += 3) {
      const a = f[k] * 3, b = f[k + 1] * 3, c = f[k + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-12) continue;
      const t = [[p[a], p[a + 1], p[a + 2]], [p[b], p[b + 1], p[b + 2]], [p[c], p[c + 1], p[c + 2]]];
      for (const i of [a, b, c]) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; t.push([n[i] / l, n[i + 1] / l, n[i + 2] / l]); }
      sortie.push(t);
    }
    return sortie;
  }
  function fuseau(sections, S, ref = [0, 1, 0], o = {}) {
    const m = { p: [], f: [] }, K = sections.length, T = new Array(K);
    const sommet = (x, y, z) => { m.p.push(x, y, z); return m.p.length / 3 - 1; };
    for (let k = 0; k < K; k++) T[k] = vunit(vsub(sections[Math.min(K - 1, k + 1)].c, sections[Math.max(0, k - 1)].c));
    let n = vsub(ref, vmul(T[0], vdot(ref, T[0])));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-6) { n = Math.abs(T[0][1]) < .9 ? [0, 1, 0] : [1, 0, 0]; n = vsub(n, vmul(T[0], vdot(n, T[0]))); }
    n = vunit(n);
    const anneaux = [];
    for (let k = 0; k < K; k++) {
      if (k) { const q = vsub(n, vmul(T[k], vdot(n, T[k]))); if (Math.hypot(q[0], q[1], q[2]) > 1e-9) n = vunit(q); }
      const b = vcross(T[k], n), s = sections[k], anneau = new Array(S);
      for (let j = 0; j < S; j++) {
        const th = j / S * TAU, c = Math.cos(th), si = Math.sin(th), e = c >= 0 ? s.eh || 2 : s.eb || 2, r = c >= 0 ? s.h : s.b;
        const fy = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * r, fz = Math.sign(si) * Math.pow(Math.abs(si), 2 / e) * s.l;
        const g = o.bosse ? o.bosse(k, j, th, s) : 1;
        anneau[j] = sommet(s.c[0] + (n[0] * fy + b[0] * fz) * g, s.c[1] + (n[1] * fy + b[1] * fz) * g, s.c[2] + (n[2] * fy + b[2] * fz) * g);
      }
      anneaux.push(anneau);
    }
    for (let k = 0; k < K - 1; k++) for (let j = 0; j < S; j++) {
      const a = anneaux[k][j], bb = anneaux[k + 1][j], cc = anneaux[k + 1][(j + 1) % S], d = anneaux[k][(j + 1) % S];
      m.f.push(a, cc, bb, a, d, cc);
    }
    const c0 = sections[0].c, c1 = sections[K - 1].c, ca = o.capA || 0, cb = o.capB || 0;
    const pa = sommet(c0[0] - T[0][0] * ca, c0[1] - T[0][1] * ca, c0[2] - T[0][2] * ca);
    const pb = sommet(c1[0] + T[K - 1][0] * cb, c1[1] + T[K - 1][1] * cb, c1[2] + T[K - 1][2] * cb);
    for (let j = 0; j < S; j++) { m.f.push(pa, anneaux[0][(j + 1) % S], anneaux[0][j]); m.f.push(pb, anneaux[K - 1][j], anneaux[K - 1][(j + 1) % S]); }
    return triangles(m);
  }
  function ovoide(c, rx, ry, rz, K = 7, S = 8, M = null) {
    const sections = [];
    for (let k = 1; k < K; k++) { const a = Math.PI * k / K, f = Math.sin(a); sections.push({ c: [-Math.cos(a) * rx, 0, 0], h: ry * f, b: ry * f, l: rz * f }); }
    const t = fuseau(sections, S, [0, 1, 0], { capA: rx + sections[0].c[0], capB: rx - sections[sections.length - 1].c[0] });
    return deplacer(t, M || [1, 0, 0, 0, 1, 0, 0, 0, 1], c);
  }
  function tube(points, rayons, S = 6, ref = [0, 1, 0], o = {}) {
    const sections = points.map((c, k) => { const r = rayons[k], ar = Array.isArray(r); return { c, h: ar ? r[0] : r, b: ar ? r[1] : r, l: ar ? r[2] : r, eh: o.e || 2, eb: o.e || 2 }; });
    return fuseau(sections, S, ref, { capA: o.capA ?? rayon0(rayons[0]) * .5, capB: o.capB ?? rayon0(rayons[rayons.length - 1]) * .6, bosse: o.bosse });
  }
  const rayon0 = r => Array.isArray(r) ? Math.max(r[0], r[2]) : r;
  const ligne = (f, K) => Array.from({ length: K }, (_, k) => f(k / (K - 1)));
  function deplacer(tris, M, o = [0, 0, 0]) {
    return tris.map(t => [vadd(mv(M, t[0]), o), vadd(mv(M, t[1]), o), vadd(mv(M, t[2]), o), vunit(mv(M, t[3])), vunit(mv(M, t[4])), vunit(mv(M, t[5]))]);
  }
  function miroirZ(tris) { const z = v => [v[0], v[1], -v[2]]; return tris.map(t => [z(t[0]), z(t[2]), z(t[1]), z(t[3]), z(t[5]), z(t[4])]); }
  const paire = t => t.concat(miroirZ(t));
  function decouper(tris, f) {
    const neg = [], pos = [];
    for (const t of tris) {
      const v = [f(t[0]), f(t[1]), f(t[2])], s = [v[0] >= 0, v[1] >= 0, v[2] >= 0];
      if (s[0] === s[1] && s[1] === s[2]) { (s[0] ? pos : neg).push(t); continue; }
      const a = s[0] !== s[1] && s[0] !== s[2] ? 0 : s[1] !== s[0] && s[1] !== s[2] ? 1 : 2, b = (a + 1) % 3, c = (a + 2) % 3;
      const tab = v[a] / (v[a] - v[b]), tac = v[a] / (v[a] - v[c]);
      const pab = vlerp(t[a], t[b], tab), pac = vlerp(t[a], t[c], tac), nab = vunit(vlerp(t[3 + a], t[3 + b], tab)), nac = vunit(vlerp(t[3 + a], t[3 + c], tac));
      const seul = s[a] ? pos : neg, autres = s[a] ? neg : pos;
      seul.push([t[a], pab, pac, t[3 + a], nab, nac]);
      autres.push([pab, t[b], t[c], nab, t[3 + b], t[3 + c]], [pab, t[c], pac, nab, t[3 + c], nac]);
    }
    return [neg, pos];
  }
  function voronoi(taille, largeur, graine) {
    return p => {
      const gx = Math.floor(p[0] / taille), gy = Math.floor(p[1] / taille), gz = Math.floor(p[2] / taille);
      let d1 = Infinity, d2 = Infinity;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
        const h = melanger(graine ^ Math.imul(gx + i, 73856093) ^ Math.imul(gy + j, 19349663) ^ Math.imul(gz + k, 83492791));
        const x = (gx + i + .15 + hasard(h) * .7) * taille, y = (gy + j + .15 + hasard(h + 1) * .7) * taille, z = (gz + k + .15 + hasard(h + 2) * .7) * taille;
        const d = Math.hypot(p[0] - x, p[1] - y, p[2] - z);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      return d2 - d1 - largeur;
    };
  }

  const FORMES = new Map(), PREFIXE = 'bitume-animal-';
  let trianglesFormes = 0;
  function enregistrer(nom, tris) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const t of tris) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { const v = t[j][k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
    const centre = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2), taille = [0, 1, 2].map(k => Math.max(1e-4, hi[k] - lo[k]));
    const p = q => [(q[0] - centre[0]) / taille[0], (q[1] - centre[1]) / taille[1], (q[2] - centre[2]) / taille[2]];
    const n = q => vunit([q[0] * taille[0], q[1] * taille[1], q[2] * taille[2]]);
    const normes = tris.map(t => [p(t[0]), p(t[1]), p(t[2]), n(t[3]), n(t[4]), n(t[5])]);
    const R = globalThis.window && globalThis.window.FRender;
    if (R && R.forme) R.forme(PREFIXE + nom, normes);
    const f = { nom: PREFIXE + nom, centre, taille, triangles: normes.length, tri: R && R.forme ? null : normes, image: -1 };
    FORMES.set(f.nom, f); trianglesFormes += normes.length;
    return f;
  }

  // ================================================================ pattes communes — familles anatomiques
  // Trois familles : fin (cerf, cheval, oryx, girafe), trapu (sanglier, buffle, bouquetin, mouton), court (marmotte).
  // Chaque famille a un bras (épaule→carpe), une cuisse (hanche→jarret) et un canon (bas de patte→sabot).
  // Longueur 1 le long de −y ; rayons relatifs. Le sabot est à y=−1 (bas de la forme).
  const PATTES = {
    // --- famille FIN (épaule/cuisse fondue dans le torse, genou/jarret marqués, boulet + sabot évasé) ---
    brasFin: [[0, .22, .19, .11], [.14, .24, .21, .125], [.34, .19, .16, .11], [.55, .14, .11, .09], [.72, .10, .085, .072], [.86, .09, .08, .07], [.94, .096, .086, .076], [1, .084, .076, .068]],
    cuisseFine: [[0, .31, .38, .17], [.16, .33, .40, .185], [.36, .25, .31, .15], [.56, .155, .19, .105], [.74, .096, .15, .08], [.86, .084, .13, .072], [.94, .08, .112, .068], [1, .076, .098, .066]],
    canonSabot: [[0, .094, .094, .082], [.16, .064, .064, .056], [.46, .058, .058, .052], [.66, .068, .078, .062], [.76, .086, .074, .078], [.85, .074, .066, .068], [.93, .112, .092, .098], [1, .132, .104, .112]],
    // --- famille TRAPU (musculature puissante fondue au poitrail, jarret net, sabot large) ---
    brasTrapu: [[0, .24, .21, .135], [.16, .27, .23, .155], [.36, .21, .18, .13], [.56, .15, .125, .10], [.74, .112, .098, .084], [.86, .102, .09, .08], [.94, .108, .096, .088], [1, .098, .088, .08]],
    cuisseTrapue: [[0, .33, .40, .195], [.18, .35, .42, .21], [.40, .27, .32, .175], [.58, .17, .21, .13], [.74, .114, .162, .092], [.86, .096, .14, .082], [.94, .09, .122, .078], [1, .086, .108, .075]],
    canonTrapu: [[0, .108, .108, .095], [.20, .08, .08, .072], [.48, .072, .072, .065], [.68, .084, .092, .075], [.79, .102, .09, .094], [.88, .092, .084, .086], [.95, .128, .108, .115], [1, .144, .118, .126]],
    // --- famille COURT (marmotte : membre court musclé et patte élargie) ---
    patteCourte: [[0, .17, .17, .15], [.25, .18, .18, .16], [.52, .14, .14, .12], [.78, .11, .11, .096], [.92, .115, .105, .102], [1, .125, .10, .11]],
    // --- moyen (LOD 2, toutes espèces) ---
    moyenne: [[0, .19, .19, .15], [.52, .105, .105, .09], [.88, .09, .09, .082], [1, .115, .10, .10]],
    // --- oiseau (pilon musclé emplumé + articulation) ---
    oiseau: [[0, .24, .22, .20], [.18, .25, .23, .21], [.46, .16, .15, .135], [.76, .095, .095, .088], [1, .086, .086, .08]],
    // --- tarse d'oiseau (tige solide + talon évasé) ---
    oiseauPied: [[0, .09, .09, .084], [.22, .07, .07, .066], [.72, .068, .068, .064], [.90, .096, .088, .092], [1, .092, .08, .092]],
  };
  function patte(cles, K, S, pli = 0) {
    const us = cles.map(c => c[0]), h = courbe(us, cles.map(c => c[1])), b = courbe(us, cles.map(c => c[2])), l = courbe(us, cles.map(c => c[3]));
    const sections = [];
    for (let k = 0; k < K; k++) { const s = k / (K - 1); sections.push({ c: [pli * Math.sin(Math.PI * s), -s, 0], h: h(s), b: b(s), l: l(s) }); }
    return fuseau(sections, S, [1, 0, 0], { capA: .05, capB: .012 });
  }
  function piedOiseau() {
    let tris = patte(PATTES.oiseauPied, 7, 7);
    // Trois doigts étalés vers l'avant + éperon arrière posés au sol (y ≈ −0,98)
    tris = tris.concat(
      tube([[.04, -.96, 0], [.52, -.98, 0], [.96, -.985, 0]], [.068, .052, .024], 5, [0, 1, 0]),
      tube([[.02, -.96, .04], [.40, -.98, .26], [.72, -.985, .44]], [.058, .044, .02], 5, [0, 1, 0]),
      tube([[.02, -.96, -.04], [.40, -.98, -.26], [.72, -.985, -.44]], [.058, .044, .02], 5, [0, 1, 0]),
      tube([[-.03, -.96, 0], [-.28, -.975, 0], [-.44, -.985, 0]], [.048, .034, .016], 4, [0, 1, 0])
    );
    return tris;
  }
  const FP = {
    brasFin: enregistrer('bras-fin', patte(PATTES.brasFin, 12, 9)),
    cuisseFine: enregistrer('cuisse-fine', patte(PATTES.cuisseFine, 12, 9, -.05)),
    canonSabot: enregistrer('canon-sabot', patte(PATTES.canonSabot, 12, 8)),
    brasTrapu: enregistrer('bras-trapu', patte(PATTES.brasTrapu, 11, 9)),
    cuisseTrapue: enregistrer('cuisse-trapue', patte(PATTES.cuisseTrapue, 11, 9, -.04)),
    canonTrapu: enregistrer('canon-trapu', patte(PATTES.canonTrapu, 11, 8)),
    patteCourte: enregistrer('patte-courte', patte(PATTES.patteCourte, 8, 7)),
    moyenne: enregistrer('patte-moyenne', patte(PATTES.moyenne, 5, 6)),
    oiseau: enregistrer('patte-oiseau', patte(PATTES.oiseau, 6, 7)),
    oiseauPied: enregistrer('pied-oiseau', piedOiseau()),
  };
  const PF_FIN = Object.freeze({ bras: FP.brasFin, cuisse: FP.cuisseFine, canon: FP.canonSabot });
  const PF_COURT = Object.freeze({ bras: FP.patteCourte, cuisse: FP.patteCourte, canon: FP.patteCourte });
  const PF_TRAPU = Object.freeze({ bras: FP.brasTrapu, cuisse: FP.cuisseTrapue, canon: FP.canonTrapu });
  function pattesPour(q) {
    if (q.pattes === 'fin') return PF_FIN;
    if (q.pattes === 'court') return PF_COURT;
    return PF_TRAPU;
  }

  // ================================================================ modèles de quadrupèdes
  const MODELES_Q = {
    cervide: { L: 1.50, H: 1.14, P: .50, W: .205, croupe: .96, bosse: .025, ventre: -.03, hanches: 1.02, rond: 2, pattes: 'fin',
      cou: { long: .64, angle: 1.0, arc: -.28, h: [.16, .072], b: [.19, .072], l: [.10, .058], base: [.40, .30] },
      tete: { long: .41, haut: .17, large: .08, angle: -.94, haut7: [.30, .46, .52, .40, .28, .25, .14], bas7: [-.30, -.46, -.48, -.35, -.28, -.26, -.14], larg7: [.46, .88, 1, .68, .48, .44, .28], oreille: [.19, .072, .013, .55, .42] },
      queue: 'courte', regions: 'croupe', epaisseur: [1.28, 1.32, 1.18], broute: 'sol' },
    equide: { L: 1.68, H: 1.44, P: .64, W: .27, croupe: 1.01, bosse: .045, ventre: .04, hanches: 1.10, rond: 2.2, pattes: 'fin',
      cou: { long: .82, angle: .86, arc: -.34, h: [.29, .13], b: [.27, .105], l: [.148, .08], base: [.40, .30] },
      tete: { long: .60, haut: .245, large: .105, angle: -.92, haut7: [.30, .44, .48, .40, .35, .34, .23], bas7: [-.30, -.52, -.58, -.42, -.34, -.36, -.24], larg7: [.48, .88, 1, .64, .54, .64, .42], oreille: [.15, .046, .013, .22, .24] },
      queue: 'crins', criniere: true, epaisseur: [1.45, 1.52, 1.35], broute: 'sol' },
    caprin: { L: 1.20, H: .88, P: .47, W: .22, croupe: .97, bosse: .05, ventre: .04, hanches: 1.02, rond: 2.2, pattes: 'trapu',
      cou: { long: .41, angle: .82, arc: -.14, h: [.16, .08], b: [.17, .075], l: [.118, .064], base: [.40, .30] },
      tete: { long: .31, haut: .155, large: .074, angle: -1.0, haut7: [.30, .46, .54, .44, .32, .27, .15], bas7: [-.30, -.46, -.46, -.35, -.30, -.30, -.16], larg7: [.48, .88, 1, .72, .50, .44, .28], oreille: [.12, .038, .011, .92, .65] },
      queue: 'courte', regions: 'ventre', epaisseur: [1.45, 1.48, 1.32], broute: 'sol', barbe: true },
    ovin: { L: 1.00, H: .75, P: .50, W: .29, croupe: 1.0, bosse: .02, ventre: .12, hanches: 1.08, rond: 2.3, laine: .15, pattes: 'trapu',
      cou: { long: .26, angle: .58, arc: -.08, h: [.21, .125], b: [.22, .12], l: [.19, .11], base: [.40, .35] },
      tete: { long: .26, haut: .135, large: .066, angle: -1.0, haut7: [.36, .54, .58, .48, .38, .30, .17], bas7: [-.30, -.44, -.44, -.34, -.28, -.26, -.15], larg7: [.52, .92, 1, .74, .54, .46, .30], oreille: [.11, .038, .011, 1.42, .52] },
      queue: 'laine', epaisseur: [1.65, 1.60, 1.35], broute: 'sol' },
    suide: { L: 1.24, H: .88, P: .62, W: .26, croupe: .80, bosse: .11, ventre: .02, hanches: .78, rond: 2.25, pattes: 'trapu',
      cou: { long: .22, angle: .14, arc: 0, h: [.31, .24], b: [.32, .24], l: [.21, .16], base: [.42, .45] },
      tete: { long: .52, haut: .38, large: .165, angle: -.40, haut7: [.42, .56, .52, .38, .26, .22, .24], bas7: [-.36, -.52, -.48, -.34, -.24, -.20, -.22], larg7: [.62, .98, 1, .68, .48, .44, .48], oreille: [.14, .062, .014, .32, .22], nez: true },
      queue: 'fine', epaisseur: [1.95, 1.90, 1.75], broute: 'sol', soies: true },
    bovin: { L: 2.06, H: 1.44, P: .85, W: .44, croupe: .94, bosse: .13, ventre: .14, hanches: 1.04, rond: 2.55, pattes: 'trapu',
      cou: { long: .44, angle: .24, arc: .04, h: [.38, .25], b: [.46, .28], l: [.28, .19], base: [.40, .46] },
      tete: { long: .56, haut: .32, large: .175, angle: -.76, haut7: [.34, .50, .54, .46, .40, .38, .28], bas7: [-.32, -.50, -.54, -.44, -.40, -.40, -.30], larg7: [.54, .92, 1, .84, .78, .82, .66], oreille: [.19, .068, .013, 1.42, .28] },
      queue: 'fine', epaisseur: [1.95, 1.90, 1.70], broute: 'sol', fanon: true },
    girafe: { L: 2.08, H: 2.96, P: .96, W: .35, croupe: .72, bosse: .12, ventre: .04, hanches: .92, rond: 2, pattes: 'fin',
      cou: { long: 2.15, angle: 1.06, arc: -.10, h: [.32, .12], b: [.38, .11], l: [.21, .08], base: [.36, .25] },
      tete: { long: .62, haut: .24, large: .105, angle: -1.08, haut7: [.30, .46, .52, .40, .30, .27, .16], bas7: [-.30, -.44, -.44, -.34, -.30, -.30, -.16], larg7: [.46, .86, 1, .66, .46, .42, .30], oreille: [.20, .056, .013, 1.18, .48] },
      queue: 'fine', regions: 'taches', criniere: true, epaisseur: [.76, .80, .74], broute: 1.7 },
    antilope: { L: 1.62, H: 1.22, P: .56, W: .24, croupe: .96, bosse: .04, ventre: .01, hanches: 1.02, rond: 2.1, pattes: 'fin',
      cou: { long: .60, angle: .88, arc: -.18, h: [.185, .088], b: [.20, .08], l: [.12, .065], base: [.40, .30] },
      tete: { long: .43, haut: .175, large: .078, angle: -.96, haut7: [.30, .46, .52, .42, .30, .26, .15], bas7: [-.30, -.46, -.48, -.36, -.30, -.27, -.15], larg7: [.46, .86, 1, .70, .48, .44, .28], oreille: [.17, .052, .013, .58, .48] },
      queue: 'touffe', regions: 'bande', epaisseur: [1.28, 1.32, 1.16], broute: 'sol' },
    marmotte: { L: .52, H: .25, P: .21, W: .12, croupe: 1.06, bosse: 0, ventre: .24, hanches: 1.18, rond: 2, pattes: 'court',
      cou: { long: .07, angle: .5, arc: 0, h: [.078, .06], b: [.08, .06], l: [.068, .055], base: [.40, .30] },
      tete: { long: .12, haut: .092, large: .056, angle: -.34, haut7: [.38, .52, .54, .48, .38, .30, .18], bas7: [-.38, -.50, -.50, -.42, -.32, -.26, -.14], larg7: [.58, .94, 1, .88, .66, .48, .30], oreille: [.028, .025, .011, 1.0, .48] },
      queue: 'touffue', epaisseur: [2.6, 2.6, 2.3], broute: 'sol' },
  };
  const CORNES = {
    bois(t, taille, femelle, S = 6) {
      const k = taille / .8, base = [.07 * t.long / .4, t.haut * .48, .038];
      const merrain = [[0, 0, 0], [-.02, .24, .11], [-.10, .46, .20], [-.12, .66, .24], [-.08, .82, .22], [-.01, .94, .17]].map(p => vmul(p, k));
      const branches = [
        { de: .08, pts: [[0, .02, .02], [.16, .09, .05], [.28, .19, .06]], r: [.022, .008] },
        { de: .24, pts: [[0, 0, 0], [.14, .08, .04], [.22, .19, .05]], r: [.019, .007] },
        { de: .55, pts: [[0, 0, 0], [.13, .10, .06], [.20, .20, .08]], r: [.017, .007] },
        { de: .85, pts: [[0, 0, 0], [-.07, .15, .04]], r: [.014, .006] },
        { de: .93, pts: [[0, 0, 0], [.05, .15, .03]], r: [.014, .006] },
        { de: 1, pts: [[0, 0, 0], [.08, .12, -.05]], r: [.013, .005] },
      ].slice(0, S < 4 ? 3 : 6);
      let tris = tube(merrain, merrain.map((_, i) => (.038 - .021 * i / 5) * k), Math.max(3, S - 1));
      for (const br of branches) {
        const u = br.de * (merrain.length - 1), i = Math.min(merrain.length - 2, Math.floor(u)), o = vlerp(merrain[i], merrain[i + 1], u - i);
        const pts = br.pts.map(p => vadd(o, vmul(p, k)));
        tris = tris.concat(tube(pts, pts.map((_, j) => mix(br.r[0], br.r[1], j / (pts.length - 1)) * k), Math.max(3, S - 2)));
      }
      return { base, tris: paire(tris) };
    },
    cimeterre(t, taille, femelle, S = 6) {
      const R = taille * .52, base = [.10 * t.long / .3, t.haut * .5, .032], arc = femelle ? .95 : 2.05, K = S < 6 ? 7 : 15;
      const pts = ligne(s => [-R * (1 - Math.cos(arc * s)), R * Math.sin(arc * s), .024 + .12 * taille * s], K);
      const r0 = femelle ? .026 : .054, r1 = femelle ? .01 : .014, nod = femelle || S < 6 ? null : (k, j) => 1 + (k > 1 && k < K - 2 && (j < 2 || j > S - 1) ? .22 * Math.max(0, Math.sin(k * 2.5)) : 0);
      return { base, tris: paire(tube(pts, pts.map((_, i) => mix(r0, r1, i / (K - 1))), S + 1, [1, 0, 0], { bosse: nod })) };
    },
    droites(t, taille, femelle, S = 6) {
      const base = [.12 * t.long / .42, t.haut * .5, .03], a = 1.24, K = S < 6 ? 4 : 11;
      const pts = ligne(s => [-Math.cos(a) * taille * s - .05 * s * s, Math.sin(a) * taille * s, .016 + .05 * s], K);
      return { base, tris: paire(tube(pts, pts.map((_, i) => mix(.032, .008, i / (K - 1))), S, [1, 0, 0], { bosse: S < 6 ? null : (k) => 1 + (k < 6 ? .18 * Math.max(0, Math.sin(k * 3.1)) : 0) })) };
    },
    croissant(t, taille, femelle, S = 6) {
      const k = taille / .7, base = [.10 * t.long / .55, t.haut * .48, .085];
      const pts = [[0, 0, 0], [-.04, .03, .20], [-.18, .10, .38], [-.36, .20, .45], [-.54, .30, .40], [-.66, .36, .30]].map(p => vmul(p, k));
      const ann = S < 6 ? null : k0 => 1 + (k0 > 0 && k0 < 4 ? .12 * (k0 & 1 ? 1 : -1) : 0);
      return { base, tris: paire(tube(pts, pts.map((_, i) => [mix(.064, .014, i / 5) * k, mix(.064, .014, i / 5) * k, mix(.092, .018, i / 5) * k]), S + 1, [0, 1, 0], { bosse: ann })) };
    },
    volute(t, taille, femelle, S = 6) {
      const base = [.09 * t.long / .26, t.haut * .5, .038], r = .105 * taille / .3, K = S < 6 ? 7 : 14;
      const pts = ligne(s => { const p = s * 1.6 * Math.PI, rr = r * (1 - .30 * s); return [-rr * Math.sin(p), rr * (Math.cos(p) - 1) * .95, .022 + .12 * taille * s]; }, K);
      return { base, tris: paire(tube(pts, pts.map((_, i) => mix(.044, .014, i / (K - 1))), S, [1, 0, 0])) };
    },
    ossicones(t, taille, femelle, S = 6) {
      const base = [.12 * t.long / .62, t.haut * .5, .048];
      const pts = [[0, 0, 0], [-.02, .08, .012], [-.038, .15, .018]];
      return { base, tris: paire(tube(pts, [.034, .026, .038], S).concat(ovoide([-.038, .16, .018], .038, .034, .038, S < 6 ? 3 : 5, S))) };
    },
    defenses(t, taille, femelle, S = 6) {
      const k = taille, base = [t.long * .68, -t.haut * .12, t.large * .42];
      // Défenses inférieures recourbées vers le dehors et le haut (ivoire brillant)
      const pts = [[0, 0, 0], [.055 * k, .025 * k, .055 * k], [.085 * k, .078 * k, .078 * k], [.072 * k, .128 * k, .062 * k]];
      const gr = [[0, .03 * k, -.006], [.035 * k, .048 * k, .038 * k], [.052 * k, .065 * k, .045 * k]];
      const tris = tube(pts, [.024 * k, .020 * k, .014 * k, .005 * k], Math.max(4, S), [0, 1, 0])
        .concat(S < 5 ? [] : tube(gr, [.016 * k, .012 * k, .005 * k], 4, [0, 1, 0]));
      return { base, tris: paire(tris), dansTete: true };
    },
  };
  function profilTorse(q) {
    const us = [0, .05, .16, .34, .55, .74, .87, .955, 1], cr = u => mix(q.croupe, 1, lisse(.3, .8, u));
    const dos = courbe(us, [.84, .95, .985, .962, .955, .98, 1, .955, .85].map((v, k) => (v * cr(us[k]) + q.bosse * Math.exp(-(((us[k] - .84) / .11) ** 2))) * q.H));
    const prof = courbe(us, [.36, .66, .80, .76 + q.ventre, .86 + q.ventre * .6, .96, 1, .86, .44].map(v => v * q.P));
    const larg = courbe(us, [.34, .80 * q.hanches, .94 * q.hanches, .95, 1, .97, .86, .64, .30].map(v => v * q.W));
    return { dos, prof, larg };
  }
  // Sculpture anatomique symétrique du torse : ta ∈ [−π, π] (0 = échine, ±π/2 = flancs, ±π = ventre), u = 0 arrière → 1 avant
  function bosseTorse(q, K, S) {
    const ux = k => (1 - Math.cos(Math.PI * k / (K - 1))) / 2;
    if (q.laine) return (k, j, th, s) => {
      const u = ux(k), ta = th > Math.PI ? th - TAU : th;
      const mouton = .52 * Math.sin(k * 2.2 + j * 1.9) * Math.cos(k * 1.5 - j * 2.7) + .36 * Math.sin(j * 3.1 + k * 1.1) + .18 * Math.cos(k * 3.7 + ta * 4);
      const col = u > .78 ? .10 * Math.sin(Math.PI * (u - .78) / .22) : 0;
      return 1 + q.laine * mouton + col;
    };
    if (q.soies) return (k, j, th, s) => {
      const u = ux(k), ta = th > Math.PI ? th - TAU : th, cote = Math.abs(ta) - Math.PI / 2;
      // avant-main puissante (épaules/poitrail u > 0,55), arrière-main fuyante (u < 0,35)
      const epaules = Math.exp(-((u - .76) ** 2) * 16) * (.14 * Math.exp(-(cote * cote) * 2.5) + .12 * Math.exp(-(ta * ta) * 5));
      const croupeFuyante = u < .32 ? -.08 * (1 - u / .32) : 0;
      const crete = Math.exp(-(ta * ta) * 10) * Math.exp(-((u - .66) ** 2) * 8) * .16;
      return 1 + epaules + croupeFuyante + crete;
    };
    if (q.fanon) return (k, j, th, s) => {
      const u = ux(k), ta = th > Math.PI ? th - TAU : th, bas = Math.PI - Math.abs(ta), cote = Math.abs(ta) - Math.PI / 2;
      // bosse de garrot imposante (u ≈ 0,82, échine) + épaules massives
      const bosse = Math.exp(-((u - .82) ** 2) * 32) * Math.exp(-(ta * ta) * 4.5) * .16;
      const epaule = Math.exp(-((u - .78) ** 2) * 22) * Math.exp(-(cote * cote) * 2.4) * .09;
      // fanon profond sous le poitrail (u > 0,72, bas)
      const fanon = u > .70 && bas < .9 ? .18 * Math.sin(Math.PI * (u - .70) / .30) * Math.cos(bas * 1.4) : 0;
      return 1 + bosse + epaule + Math.max(0, fanon);
    };
    // générique (cheval, cerf, bouquetin, girafe, oryx, marmotte) : garrot, épaule, poitrail, flanc creusé, croupe galbée
    return (k, j, th, s) => {
      const u = ux(k), ta = th > Math.PI ? th - TAU : th, bas = Math.PI - Math.abs(ta), cote = Math.abs(ta) - Math.PI / 2;
      let g = 1;
      // garrot et échine marquée (u ≈ 0,82)
      if (q.bosse > 0) g += (.06 + q.bosse * .9) * Math.exp(-((u - .83) ** 2) * 42) * Math.exp(-(ta * ta) * 4.5);
      // musculature d'épaule / omoplate (u ≈ 0,78, deux flancs symétriques)
      g += .085 * Math.exp(-((u - .79) ** 2) * 26) * Math.exp(-(cote * cote) * 2.8);
      // poitrail profond (u > 0,84, bas)
      if (u > .84 && bas < 1.1) g += .10 * Math.sin(Math.PI * (u - .84) / .16) * Math.cos(bas * 1.1);
      // creux du flanc devant la cuisse (u ≈ 0,20–0,38, deux côtés)
      if (u > .18 && u < .40) g -= .065 * Math.sin(Math.PI * (u - .18) / .22) * Math.exp(-(cote * cote) * 3.2);
      // croupe et fesse musclées (u ≈ 0,06–0,22, dos + côtés)
      if (u < .24) g += .08 * Math.exp(-((u - .11) ** 2) * 90) * Math.exp(-(cote * cote) * 2.0);
      return g;
    };
  }
  function torse(q, K, S) {
    const { dos, prof, larg } = profilTorse(q), sections = [];
    for (let k = 0; k < K; k++) {
      const u = (1 - Math.cos(Math.PI * k / (K - 1))) / 2, haut = dos(u), bas = haut - prof(u);
      sections.push({ c: [-q.L / 2 + u * q.L, (haut + bas) / 2, 0], h: (haut - bas) / 2, b: (haut - bas) / 2, l: larg(u), eh: q.rond + .35, eb: q.rond });
    }
    const o = { capA: q.L * .035, capB: q.L * .03, bosse: K > 10 ? bosseTorse(q, K, S) : null };
    let t = fuseau(sections, S, [0, 1, 0], o);
    if (q.soies && K > 10) {
      // Crinière de soies hérissées sur le garrot et l'échine du sanglier
      const pts = ligne(s => { const u = .18 + .78 * s; return [-q.L / 2 + u * q.L, dos(u) + .01, 0]; }, 11);
      t = t.concat(tube(pts, pts.map((_, i) => {
        const s = i / 10, pic = Math.sin(Math.PI * Math.pow(s, .65)) * (.82 + .18 * Math.sin(i * 2.5));
        return [.095 * pic, .016, .026 * (.6 + .4 * pic)];
      }), 5, [0, 1, 0]));
    }
    return t;
  }
  function ligneCou(c, K) {
    const pts = [[0, 0, 0]], hauts = [];
    let x = 0, y = 0;
    for (let k = 1; k < K; k++) {
      const s = (k - .5) / (K - 1), a = c.angle + c.arc * (s - .5);
      x += Math.cos(a) * c.long / (K - 1); y += Math.sin(a) * c.long / (K - 1); pts.push([x, y, 0]);
    }
    for (let k = 0; k < K; k++) { const s = k / (K - 1), a = c.angle + c.arc * (s - .5); hauts.push([-Math.sin(a), Math.cos(a), 0]); }
    return { pts, hauts };
  }
  function cou(q, K, S) {
    const c = q.cou, { pts } = ligneCou(c, K), r = (v, s) => mix(v[0], v[1], Math.pow(s, .8));
    const sections = pts.map((p, k) => { const s = k / (K - 1); return { c: p, h: r(c.h, s), b: r(c.b, s), l: r(c.l, s), eh: 2.1, eb: 2 }; });
    sections.unshift({ c: vmul(vunit(vsub(pts[0], pts[1])), c.b[0] * .8), h: c.h[0] * .8, b: c.b[0] * .8, l: c.l[0] * .85 });
    const bosseCou = K > 6 && q.laine ? (k, j, th) => 1 + q.laine * .7 * Math.sin(k * 2.3 + j * 1.8)
      : K > 6 && q.fanon ? (k, j, th) => {
        const ta = th > Math.PI ? th - TAU : th, bas = Math.PI - Math.abs(ta);
        return 1 + (bas < .85 ? .24 * Math.sin(Math.PI * k / K) * Math.cos(bas * 1.4) : 0);
      } : null;
    return fuseau(sections, S, [0, 1, 0], { capA: c.b[0] * .4, capB: c.h[1] * .6, bosse: bosseCou });
  }
  function criniere(q, K, S, epais = 1) {
    const c = q.cou, { pts, hauts } = ligneCou(c, K), r = (v, s) => mix(v[0], v[1], Math.pow(s, .8));
    const cheval = q.cou.long < 1.2;
    const sections = pts.map((p, k) => {
      const s = k / (K - 1), h = r(c.h, s) * .84;
      const retombe = cheval ? .038 * Math.sin(Math.PI * (.15 + .8 * s)) * epais : 0;
      const cPt = vadd(p, vmul(hauts[k], h));
      cPt[2] += retombe * .55; // retombe naturellement d'un côté de l'encolure
      return { c: cPt, h: (.048 + .072 * Math.sin(Math.PI * (.08 + .88 * s))) * epais, b: (.022 + retombe * .7), l: (.030 + retombe * .55) * epais, eh: 2, eb: 2 };
    });
    let tris = fuseau(sections.slice(1), S, [0, 1, 0], { capA: .035, capB: .045 });
    // Toupet retombant sur le front du cheval entre les oreilles
    if (cheval) {
      const fin = pts[pts.length - 1], hFin = hauts[hauts.length - 1];
      const o = vadd(fin, vmul(hFin, c.h[1] * .88));
      tris = tris.concat(tube([o, [o[0] + .06, o[1] + .01, .01], [o[0] + .12, o[1] - .09, .018]], [.036 * epais, .03 * epais, .01 * epais], 5, [0, 1, 0]));
    }
    return tris;
  }
  function tete(q, K, S, avecOreilles = true) {
    const t = q.tete, us = [0, .08, .25, .45, .7, .9, 1];
    const haut = courbe(us, t.haut7.map(v => v * t.haut)), bas = courbe(us, t.bas7.map(v => v * t.haut)), larg = courbe(us, t.larg7.map(v => v * t.large));
    // Sculpture anatomique symétrique de la tête : arcades, joues/ganaches, chanfrein, mufle et menton
    const bosseTete = K > 10 ? (k, j, th, s) => {
      const u = (1 - Math.cos(Math.PI * k / (K - 1))) / 2, ta = th > Math.PI ? th - TAU : th, basA = Math.PI - Math.abs(ta), cote = Math.abs(ta) - Math.PI / 2;
      let g = 1;
      // arcades sourcilières au-dessus des yeux (u ≈ 0,18–0,34, haut-côté symétrique)
      if (u > .14 && u < .36) g += .12 * Math.sin(Math.PI * (u - .14) / .22) * Math.exp(-((Math.abs(ta) - .55) ** 2) * 5);
      // joues / ganache profonde (u ≈ 0,18–0,46, côtés et bas)
      if (u > .15 && u < .48) g += (q.criniere || q.fanon ? .14 : .09) * Math.sin(Math.PI * (u - .15) / .33) * Math.exp(-(cote * cote) * 2.5);
      // chanfrein affiné (u ≈ 0,48–0,78, dessus)
      if (u > .46 && u < .80 && !t.nez) g -= .06 * Math.sin(Math.PI * (u - .46) / .34) * Math.exp(-(ta * ta) * 6);
      // narines / mufle épanoui (u > 0,78, côtés)
      if (u > .78) g += (t.nez ? .18 : .10) * Math.sin(Math.PI * Math.min(1, (u - .78) / .22)) * Math.exp(-(cote * cote) * 2.8);
      // lèvre inférieure / menton (u > 0,80, bas)
      if (u > .80 && basA < .9) g += .07 * Math.sin(Math.PI * (u - .80) / .20) * Math.cos(basA * 1.3);
      return g;
    } : null;
    const sections = [];
    for (let k = 0; k < K; k++) {
      const u = -.06 + 1.06 * (1 - Math.cos(Math.PI * k / (K - 1))) / 2, hu = haut(u), bu = bas(u);
      sections.push({ c: [u * t.long, (hu + bu) / 2, 0], h: (hu - bu) / 2, b: (hu - bu) / 2, l: larg(u), eh: 2.15, eb: 2 });
    }
    let tris = fuseau(sections, S, [0, 1, 0], { capA: t.haut * .12, capB: t.nez ? .005 : t.long * .045, bosse: bosseTete });
    // Groin plat circulaire évasé du sanglier (disque boutoir au bout du museau)
    if (t.nez && K > 8) {
      const hu = haut(1), bu = bas(1), ym = (hu + bu) / 2, rm = Math.max(.058, (hu - bu) * .62), lm = Math.max(.066, larg(1) * 1.05);
      const secG = [
        { c: [t.long * .94, ym, 0], h: rm * .86, b: rm * .84, l: lm * .90, eh: 2.4, eb: 2.2 },
        { c: [t.long * 1.01, ym + .006, 0], h: rm * 1.08, b: rm * 1.02, l: lm * 1.12, eh: 2.6, eb: 2.4 },
        { c: [t.long * 1.045, ym + .008, 0], h: rm * .98, b: rm * .92, l: lm * 1.02, eh: 2.6, eb: 2.4 },
      ];
      tris = tris.concat(fuseau(secG, 10, [0, 1, 0], { capA: .01, capB: .004 }));
    }
    // Touffe de laine sur le sommet du crâne du mouton
    if (q.laine && K > 8) {
      tris = tris.concat(ovoide([t.long * .16, haut(.16) * 1.05, 0], t.long * .22, t.haut * .28, t.large * .92, 6, 7));
    }
    if (avecOreilles) {
      const [lo, la, ep, ecart, recul] = t.oreille, sec = [];
      // Oreille profilée en cornet incurvé avec pointe fine
      for (let k = 0; k < 7; k++) {
        const s = k / 6;
        const incurvation = .20 * Math.sin(Math.PI * s);
        sec.push({ c: [incurvation * la, s * lo, 0], h: ep * (1.15 - .55 * s), b: ep * (1.15 - .55 * s), l: la * Math.pow(Math.sin(Math.PI * (.08 + .88 * s)), .72) });
      }
      const o = fuseau(sec, 7, [1, 0, 0], { capA: ep, capB: lo * .06 });
      tris = tris.concat(paire(deplacer(o, mm(MZ(recul), MX(ecart)), [t.long * .12, haut(.12) * .84, t.large * .54])));
    }
    // Barbichette bien visible du bouquetin
    if (q.barbe) tris = tris.concat(tube([[t.long * .56, bas(.56) * .9, 0], [t.long * .50, bas(.50) - .09, 0], [t.long * .43, bas(.44) - .16, 0]], [.030, .024, .010], 5));
    // Fanon du buffle (pendant massif sous la gorge)
    if (q.fanon) {
      const pts = [[t.long * .34, bas(.34) - .01, 0], [t.long * .24, bas(.24) - .10, 0], [t.long * .16, bas(.16) - .18, 0], [t.long * .10, bas(.10) - .24, 0]];
      tris = tris.concat(tube(pts, [.055, .048, .036, .016], 6, [0, 1, 0]));
    }
    return tris;
  }
  function yeux(q) {
    const t = q.tete, us = [0, .08, .25, .45, .7, .9, 1], haut = courbe(us, t.haut7.map(v => v * t.haut)), larg = courbe(us, t.larg7.map(v => v * t.large));
    const r = Math.max(.009, t.haut * .095);
    return paire(ovoide([t.long * .28, haut(.28) * .42, larg(.28) * .92], r, r, r * .78, 5, 6));
  }
  function queue(q, type, S) {
    const x0 = -q.L / 2 + q.L * .03, y0 = q.H * q.croupe * .93;
    let pts, r;
    if (type === 'crins') {
      pts = [[0, 0, 0], [-.14, -.04, 0], [-.24, -.24, 0], [-.27, -.54, 0], [-.24, -.78, 0], [-.18, -.92, 0]];
      r = [[.055, .055, .048], [.072, .072, .062], [.095, .095, .088], [.11, .11, .105], [.082, .082, .08], [.032, .032, .035]];
    }
    else if (type === 'courte') { pts = [[0, 0, 0], [-.045, -.06, 0], [-.065, -.16, 0]]; r = [[.036, .036, .042], [.038, .036, .044], [.024, .022, .03]]; }
    else if (type === 'laine') { pts = [[0, 0, 0], [-.06, -.07, 0], [-.085, -.18, 0]]; r = [.072, .076, .048]; }
    else if (type === 'touffue') { pts = [[0, 0, 0], [-.07, -.01, 0], [-.15, -.04, 0]]; r = [.032, .046, .030]; }
    else {
      const l = type === 'touffe' ? .48 : q.L * .34;
      pts = [[0, 0, 0], [-.05, -l * .3, 0], [-.08, -l * .7, 0], [-.08, -l, 0]]; r = [.026, .020, .015, .012];
      const t = tube(pts, r, S).concat(ovoide([-.08, -l - .07, 0], .038, .105, .038, 5, 6, null));
      return { pos: [x0, y0], tris: t };
    }
    return { pos: [x0, y0], tris: tube(pts, r, S) };
  }
  function squelette(q) {
    const t = q.tete, c = q.cou, { pts } = ligneCou(c, 9), E = pts[pts.length - 1];
    const B0 = [q.L / 2 - q.L * .12, q.H - q.P * (c.base ? c.base[1] : .3)];
    const av = { x: q.L * .34, y: q.H - .62 * q.P, z: q.W * .58, r: .5, t1: .03, t2: -.05 }, ar = { x: -q.L * .33, y: q.H * q.croupe - .44 * q.P, z: q.W * .52 * q.hanches, r: .54, t1: -.2, t2: .34 };
    for (const p of [av, ar]) { const lt = p.y / (p.r * Math.cos(p.t1) + (1 - p.r) * Math.cos(p.t1 + p.t2)); p.l1 = p.r * lt; p.l2 = (1 - p.r) * lt; }
    const museau = (d, e) => { const R = MZ(d), n = mv(R, E), h = mv(mm(R, MZ(t.angle + e)), [t.long, 0, 0]); return B0[1] + n[1] + h[1]; };
    const teteBroute = -.35, cible = q.broute === 'sol' ? .05 : q.broute;
    let a = -2.2, b = .4;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (museau(m, teteBroute) > cible) b = m; else a = m; }
    const couBroute = Math.max(-1.9, (a + b) / 2);
    const sommet = Math.max(q.H, B0[1] + E[1] + t.haut * .6);
    return { B: B0, E, av, ar, couBroute, teteBroute, couAlerte: .22, teteAlerte: .3, hauteur: sommet, longueur: q.L + c.long * Math.cos(c.angle) + t.long * .5, rayon: (q.L + c.long * Math.cos(c.angle)) * .55 + .2 };
  }
  function regions(q, nom, tris) {
    if (!nom) return [tris];
    const { dos, prof } = profilTorse(q), u = p => clamp((p[0] + q.L / 2) / q.L, 0, 1);
    if (nom === 'croupe') { const [a, b] = decouper(tris, p => 1 - ((p[0] + q.L * .5) / (q.L * .16)) ** 2 - ((p[1] - q.H * .82) / (q.H * .2)) ** 2); return [a, b]; }
    if (nom === 'ventre') { const [a, b] = decouper(tris, p => (dos(u(p)) - prof(u(p)) + q.P * .2) - p[1]); return [a, b]; }
    if (nom === 'bande') {
      const [haut, bas] = decouper(tris, p => (dos(u(p)) - prof(u(p)) + q.P * .32) - p[1]);
      const [bande, ventre] = decouper(bas, p => (dos(u(p)) - prof(u(p)) + q.P * .19) - p[1]);
      return [haut, bande, ventre];
    }
    if (nom === 'taches') { const [lignes, taches] = decouper(tris, voronoi(.24, .034, 977)); return [taches, lignes]; }
    return [tris];
  }
  function modeleQuadrupede(nom, q) {
    const r = squelette(q), f = n => nom + '-' + n;
    const corps = regions(q, q.regions, torse(q, 22, 16)).map((t, k) => enregistrer(f('torse' + k), t));
    const corpsM = regions(q, q.regions, torse(q, 10, 8)).map((t, k) => enregistrer(f('torse-moyen' + k), t));
    const couT = cou(q, 9, 12), couM = cou(q, 4, 6);
    const cous = q.regions === 'taches' ? decouper(couT, voronoi(.24, .034, 977)).reverse() : [couT];
    const md = { nom, q, rig: r, torse: corps, torseM: corpsM, cou: cous.map((t, k) => enregistrer(f('cou' + k), t)),
      tete: enregistrer(f('tete'), tete(q, 16, 12)), yeux: enregistrer(f('yeux'), yeux(q)), cornes: null, cornesFemelle: null, criniere: null };
    if (q.criniere) md.criniere = enregistrer(f('criniere'), criniere(q, 9, 6, nom === 'girafe' ? .75 : 1.05));
    const qu = queue(q, q.queue, 7); md.queue = enregistrer(f('queue'), qu.tris); md.queuePos = qu.pos;
    md.couteteSans = couM.concat(deplacer(tete(q, 6, 7), MZ(q.tete.angle), r.E));
    md.f = f;
    return md;
  }
  function cornesDe(md, type, taille, femelle, S) {
    const d = CORNES[type](md.q.tete, taille, femelle, S);
    return deplacer(d.tris, d.dansTete ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : MZ(-md.q.tete.angle), d.base);
  }
  function silhouetteQ(md, cornes) {
    const q = md.q, r = md.rig, B0 = [r.B[0], r.B[1], 0];
    let s = torse(q, 8, 6).concat(deplacer(cou(q, 3, 5).concat(deplacer(tete(q, 5, 5, false), MZ(q.tete.angle), r.E)), [1, 0, 0, 0, 1, 0, 0, 0, 1], B0));
    if (cornes) s = s.concat(deplacer(cornes, MZ(q.tete.angle), vadd(r.E, B0)));
    for (const p of [r.av, r.ar]) for (const z of [-p.z, p.z]) {
      const g = q.epaisseur[0] * (p === r.av ? .14 : .2) * (p.l1 + p.l2) * .5;
      s = s.concat(tube([[p.x, p.y, z], [p.x + Math.sin(p.t1) * p.l1, p.y - Math.cos(p.t1) * p.l1, z], [p.x + Math.sin(p.t1) * p.l1 + Math.sin(p.t1 + p.t2) * p.l2, .01, z]], [g, g * .55, g * .5], 4, [1, 0, 0], { capA: 0, capB: 0 }));
    }
    return s;
  }
  function finirQuadrupede(md, cornes) {
    const q = md.q, r = md.rig, f = md.f, A = q.tete.angle;
    md.couteteNue = enregistrer(f('coutete'), md.couteteSans);
    md.loinNue = enregistrer(f('loin'), silhouetteQ(md, null));
    md.coutete = md.couteteF = md.couteteNue; md.loin = md.loinF = md.loinNue;
    if (cornes) {
      md.cornes = enregistrer(f('cornes'), cornesDe(md, cornes.type, cornes.taille, false, 6));
      md.coutete = enregistrer(f('coutete-cornes'), md.couteteSans.concat(deplacer(cornesDe(md, cornes.type, cornes.taille, false, 4), MZ(A), r.E)));
      md.loin = enregistrer(f('loin-cornes'), silhouetteQ(md, cornesDe(md, cornes.type, cornes.taille, false, 3)));
      md.cornesFemelle = md.cornes; md.couteteF = md.coutete; md.loinF = md.loin;
      if (cornes.femelle && cornes.femelle !== cornes.taille) {
        md.cornesFemelle = enregistrer(f('cornes-f'), cornesDe(md, cornes.type, cornes.femelle, true, 6));
        md.couteteF = enregistrer(f('coutete-cornes-f'), md.couteteSans.concat(deplacer(cornesDe(md, cornes.type, cornes.femelle, true, 4), MZ(A), r.E)));
        md.loinF = enregistrer(f('loin-cornes-f'), silhouetteQ(md, cornesDe(md, cornes.type, cornes.femelle, true, 3)));
      }
    }
    delete md.couteteSans;
    return md;
  }

  // ================================================================ oiseaux
  const MODELES_O = {
    rapace: { corps: { long: .42, rayon: .056 }, queue: { long: .24, large: .145 }, tete: { r: .042, bec: [.048, .013], crochu: true },
      aile: { int: [.34, .26, .25], ext: [.34, .24, .14], doigts: 5, fleche: .02 }, pattes: null },
    milan: { corps: { long: .38, rayon: .050 }, queue: { long: .30, large: .11, fourche: true }, tete: { r: .038, bec: [.042, .011], crochu: true },
      aile: { int: [.34, .22, .21], ext: [.38, .20, .11], doigts: 4, fleche: .08 }, pattes: null },
    goeland: { corps: { long: .34, rayon: .056 }, queue: { long: .10, large: .06 }, tete: { r: .035, bec: [.054, .010] },
      aile: { int: [.26, .16, .15], ext: [.42, .15, .032], doigts: 0, fleche: .12, bout: .3 }, pattes: { tibia: .065, tarse: .06, epais: 1.9 }, pliee: true },
    flamant: { corps: { long: .48, rayon: .102 }, queue: { long: .08, large: .075 }, tete: { r: .050, bec: [.12, .024], coude: true },
      cou: { long: .68, rayon: .030, s: true }, aile: { int: [.35, .30, .27], ext: [.44, .27, .07], doigts: 0, fleche: .1, bout: .55 }, pattes: { tibia: .40, tarse: .46, epais: .72 } },
    aigrette: { corps: { long: .32, rayon: .062 }, queue: { long: .075, large: .055 }, tete: { r: .032, bec: [.11, .010] },
      cou: { long: .46, rayon: .020, s: true }, aile: { int: [.33, .24, .23], ext: [.36, .23, .07], doigts: 0, fleche: .06 }, pattes: { tibia: .22, tarse: .27, epais: .65 } },
    oie: { corps: { long: .54, rayon: .118 }, queue: { long: .11, large: .085 }, tete: { r: .052, bec: [.066, .022] },
      cou: { long: .32, rayon: .038, s: false }, aile: { int: [.37, .27, .25], ext: [.46, .24, .07], doigts: 0, fleche: .1 }, pattes: { tibia: .095, tarse: .08, epais: 2.1 }, pliee: true },
    pelican: { corps: { long: .74, rayon: .142 }, queue: { long: .13, large: .11 }, tete: { r: .062, bec: [.34, .034], poche: true },
      cou: { long: .46, rayon: .048, s: true }, aile: { int: [.52, .36, .34], ext: [.54, .32, .10], doigts: 4, fleche: .06 }, pattes: { tibia: .11, tarse: .11, epais: 2.3 }, pliee: true },
    autruche: { corps: { long: 1.06, rayon: .265 }, queue: null, tete: { r: .064, bec: [.082, .026] },
      cou: { long: .96, rayon: .048, s: false, droit: true }, aile: null, pattes: { tibia: .52, tarse: .56, epais: 2.0 }, plumes: true },
  };
  function corpsOiseau(o, K, S) {
    const L = o.corps.long, R = o.corps.rayon, us = [0, .12, .35, .6, .82, .95, 1];
    const r = o.plumes ? courbe(us, [.20, .62, .96, 1, .88, .58, .22]) : courbe(us, [.18, .48, .86, 1, .84, .54, .22]);
    const sections = [];
    for (let k = 0; k < K; k++) {
      const u = (1 - Math.cos(Math.PI * k / (K - 1))) / 2, x = -L / 2 + u * L, rr = R * r(u);
      const yOff = o.plumes ? (u - .48) * R * .48 : (u - .58) * R * .22;
      sections.push({ c: [x, yOff, 0], h: rr * (o.plumes ? .88 : .90), b: rr * (o.plumes ? 1.08 : 1.06), l: rr * (o.plumes ? .92 : 1.0), eh: 2.1, eb: 2 });
    }
    let t = fuseau(sections, S, [0, 1, 0], { capA: L * .035, capB: L * .035 });
    if (o.queue) {
      const q = o.queue, x0 = -L * .38;
      if (q.fourche) for (const z of [-1, 1]) t = t.concat(tube([[x0, 0, z * .012], [x0 - q.long * .5, -.004, z * q.large * .45], [x0 - q.long, -.01, z * q.large * .85]], [[.007, .007, .036], [.006, .006, .032], [.004, .004, .016]], 5));
      else {
        const sec = ligne(s => [x0 - q.long * s, -.006 * s, 0], 6).map((c, k) => ({ c, h: .009, b: .009, l: mix(R * .48, q.large, Math.pow(k / 5, .75)) }));
        t = t.concat(fuseau(sec, 6, [0, 1, 0], { capA: 0, capB: .012 }));
      }
    }
    if (o.plumes) {
      // Croupion noir emplumé d'autruche relevé à l'arrière
      t = t.concat(ovoide([-L * .36, R * .18, 0], R * .58, R * .48, R * .56, 6, 8, MZ(.22)));
    }
    return t;
  }
  function plumesAutruche(o) {
    const L = o.corps.long, R = o.corps.rayon;
    // Panache d'ailes bouffantes + queue de grandes plumes blanches retombantes en éventail
    let tris = paire(
      ovoide([-L * .08, R * .16, R * .84], L * .36, R * .40, R * .22, 6, 8, MZ(-.18))
      .concat(ovoide([-L * .28, R * .02, R * .72], L * .22, R * .30, R * .20, 5, 7, MZ(-.42)))
    );
    for (const z of [-.22, 0, .22]) {
      const pts = [[-L * .38, R * .26, z * R], [-L * .56, R * .16, z * R * 1.4], [-L * .66, -R * .14, z * R * 1.6]];
      tris = tris.concat(tube(pts, [[.06, .06, .09], [.075, .075, .11], [.03, .03, .06]], 6, [0, 1, 0]));
    }
    return tris;
  }
  function teteOiseau(o, K, S) {
    const t = o.tete, [lb, rb] = t.bec, r = t.r;
    const crane = ovoide([0, 0, 0], r * 1.16, r, r * .92, K || 7, S || 9);
    let pts;
    if (t.crochu) pts = [[r * .78, r * .08, 0], [r * .78 + lb * .55, r * .04, 0], [r * .78 + lb * .92, -lb * .30, 0], [r * .78 + lb * .86, -lb * .66, 0]];
    else if (t.coude) pts = [[r * .78, -r * .08, 0], [r * .78 + lb * .45, -r * .15, 0], [r * .78 + lb * .72, -r * .55, 0], [r * .78 + lb * .88, -r * 1.38, 0]];
    else pts = ligne(s => [r * .78 + lb * s, -r * .14 * s, 0], 4);
    const rayons = pts.map((_, i) => { const s = i / (pts.length - 1); return [rb * (1 - .68 * s), rb * (1 - .62 * s) * (t.poche ? 2.3 - s : 1), rb * (1 - .58 * s) * .88]; });
    const bec = tube(pts, rayons, 6, [0, 1, 0], { capA: rb * .3, capB: rb * .18 });
    const yeuxOis = paire(ovoide([r * .32, r * .22, r * .76], r * .20, r * .20, r * .15, 4, 5));
    return { crane: crane.concat(yeuxOis), bec, xBec: r * .78 };
  }
  function couOiseau(o, vol, K = 9, S = 7) {
    const c = o.cou, L = c.long;
    let pts;
    // Cou d'autruche élancé avec légère courbe en S naturelle
    if (c.droit) pts = ligne(s => [.06 * L * Math.sin(Math.PI * s) - .04 * L * Math.sin(TAU * s), s * L, 0], K);
    else if (!c.s) pts = ligne(s => vol ? [s * L, s * L * .08, 0] : [s * L * .45, s * L * .9, 0], K);
    else if (vol) pts = o === MODELES_O.flamant ? ligne(s => [s * L, -.02 * Math.sin(Math.PI * s), 0], K) : ligne(s => [L * .45 * Math.sin(Math.PI * s * .9) * .5 + s * L * .22, L * .18 * Math.sin(Math.PI * s * 1.6), 0], K);
    else pts = ligne(s => [L * .16 * Math.sin(TAU * s * .9), L * .82 * s + L * .06 * Math.sin(Math.PI * s), 0], K);
    const rr = pts.map((_, i) => c.rayon * (1.38 - .52 * i / (K - 1)));
    return { tris: tube(pts, rr, S, [1, 0, 0]), bout: pts[K - 1] };
  }
  function aileOiseau(o, quoi, K, S) {
    const a = o.aile, [span, c0, c1] = a[quoi], sections = [];
    for (let k = 0; k < K; k++) {
      const s = k / (K - 1), z = s * span, ch = quoi === 'ext' ? mix(c0, c1, Math.pow(s, 1.25)) : mix(c0, c1, s);
      // Profil cambré aérodynamique : bord d'attaque épais, cambrure marquée, bord de fuite effilé
      const bord = .08 - a.fleche * (quoi === 'ext' ? s * s : s * .3);
      const cambrure = (quoi === 'int' ? .022 : .018) * Math.sin(Math.PI * s) + (quoi === 'ext' ? .020 * s * s : 0);
      sections.push({ c: [bord - ch / 2, cambrure, z], h: Math.max(.006, ch * .095), b: Math.max(.003, ch * .045), l: ch / 2 });
    }
    let t = fuseau(sections, S, [0, 1, 0], { capA: .012, capB: quoi === 'ext' ? .022 : .006 });
    // Rémiges primaires digitées longues et bien écartées en bout d'aile (rapaces, milan, pélican)
    if (quoi === 'ext' && a.doigts) for (let d = 0; d < a.doigts; d++) {
      const frac = d / Math.max(1, a.doigts - 1);
      const x = .08 - a.fleche - c1 * (.08 + .82 * frac), lg = span * (.34 + .10 * Math.sin(Math.PI * frac)), ang = -.08 + .32 * frac;
      const releve = .035 * (1 - .5 * frac);
      t = t.concat(tube([
        [x, .016, span * .78],
        [x - Math.sin(ang) * lg * .5, .018 + releve * .5, span * .78 + Math.cos(ang) * lg * .5],
        [x - Math.sin(ang) * lg, .018 + releve, span * .78 + Math.cos(ang) * lg],
      ], [[.007, .005, .022], [.006, .004, .018], [.003, .003, .008]], 5));
    }
    return t;
  }
  function modeleOiseau(nom, o) {
    const f = n => nom + '-' + n, md = { nom, o };
    md.corps = enregistrer(f('corps'), corpsOiseau(o, 14, 12));
    const t = teteOiseau(o, 7, 9);
    md.tete = enregistrer(f('tete'), t.crane); md.bec = enregistrer(f('bec'), t.bec);
    if (o.cou) {
      const cp = couOiseau(o, false), cv = couOiseau(o, true);
      md.couPose = enregistrer(f('cou'), cp.tris); md.boutPose = cp.bout;
      md.couVol = enregistrer(f('cou-vol'), cv.tris); md.boutVol = cv.bout;
    }
    if (o.aile) {
      const ext = aileOiseau(o, 'ext', 8, 8);
      md.aileInt = enregistrer(f('aile-int'), aileOiseau(o, 'int', 6, 8));
      if (o.aile.bout) { const [a, b] = decouper(ext, p => p[2] - o.aile.ext[0] * o.aile.bout); md.aileExt = enregistrer(f('aile-ext'), a); md.aileBout = enregistrer(f('aile-bout'), b); }
      else md.aileExt = enregistrer(f('aile-ext'), ext);
      const entier = aileOiseau(o, 'int', 3, 4).concat(deplacer(aileOiseau(o, 'ext', 3, 4), [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, o.aile.int[0]]));
      md.aileLoin = enregistrer(f('aile-loin'), entier);
      const epaule = [o.corps.long * .08, o.corps.rayon * .35, o.corps.rayon * .55];
      md.epaule = epaule;
      md.loinVol = enregistrer(f('loin-vol'), corpsOiseau(o, 6, 5).concat(deplacer(entier, MX(-.08), epaule), deplacer(entier, MX(Math.PI + .08), [epaule[0], epaule[1], -epaule[2]])));
    }
    if (o.pliee) md.pliee = enregistrer(f('ailes-pliees'), paire(ovoide([-o.corps.long * .08, o.corps.rayon * .25, o.corps.rayon * .62], o.corps.long * .42, o.corps.rayon * .5, o.corps.rayon * .32, 6, 8, MZ(-.08))));
    if (o.plumes) md.plumes = enregistrer(f('plumes'), plumesAutruche(o));
    if (o.pattes) {
      const p = o.pattes, h = p.tibia + p.tarse, sil = deplacer(corpsOiseau(o, 6, 5), [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, h + o.corps.rayon * .6, 0]);
      let haut = [0, h + o.corps.rayon * .6, 0];
      if (o.cou) { const cp = couOiseau(o, false, 4, 4); sil.push(...deplacer(cp.tris, [1, 0, 0, 0, 1, 0, 0, 0, 1], vadd(haut, [o.corps.long * .4, o.corps.rayon * .2, 0]))); haut = vadd(vadd(haut, [o.corps.long * .4, o.corps.rayon * .2, 0]), cp.bout); }
      else haut = vadd(haut, [o.corps.long * .5, o.corps.rayon * .4, 0]);
      sil.push(...ovoide(haut, o.tete.r * 1.1, o.tete.r, o.tete.r, 4, 5));
      for (const z of [-1, 1]) sil.push(...tube([[0, h, z * o.corps.rayon * .3], [0, .01, z * o.corps.rayon * .3]], [.04 * p.epais * h * .2 + .008, .009 * p.epais], 3, [1, 0, 0]));
      md.loinPose = enregistrer(f('loin-pose'), sil);
      md.hauteur = h + o.corps.rayon * 1.6 + (o.cou && !o.cou.s ? o.cou.long * .9 : o.cou ? o.cou.long * .8 : 0);
    } else md.hauteur = o.corps.rayon * 2;
    md.envergure = o.aile ? 2 * (o.aile.int[0] + o.aile.ext[0] + o.corps.rayon * .55) : o.corps.long;
    return md;
  }

  // ================================================================ baleine
  function modeleBaleine() {
    const L = 13.4, us = [0, .08, .2, .35, .55, .72, .86, 1], rh = courbe(us, [.26, .66, .92, 1, .9, .54, .22, .1]), rl = courbe(us, [.28, .66, .94, 1, .86, .48, .2, .09]);
    const sections = [];
    for (let k = 0; k < 22; k++) {
      const u = (1 - Math.cos(Math.PI * k / 21)) / 2, x = L * (.5 - u);
      sections.push({ c: [x, -.15 * u, 0], h: 1.38 * rh(u) * .84, b: 1.42 * rh(u), l: 1.35 * rl(u), eh: 2.25, eb: 2.0 });
    }
    // Sillons ventraux (gorge plissée symétrique) et crête des évents
    const bosseBaleine = (k, j, th, s) => {
      const u = (1 - Math.cos(Math.PI * k / 21)) / 2, ta = th > Math.PI ? th - TAU : th, bas = Math.PI - Math.abs(ta);
      let g = 1;
      if (u < .52 && bas < 1.35) g += .075 * Math.sin(ta * 10) * Math.sin(Math.PI * u / .52) * Math.cos(bas * .9);
      if (u > .12 && u < .26 && Math.abs(ta) < .45) g += .09 * Math.sin(Math.PI * (u - .12) / .14) * Math.exp(-(ta * ta) * 6);
      return g;
    };
    let corps = fuseau(sections, 14, [0, 1, 0], { capA: .35, capB: .22, bosse: bosseBaleine });
    // Aileron dorsal plein et falciforme (profil plein de la base jusqu'à la pointe recourbée)
    const aileron = [
      { c: [-.60, .82, 0], h: .85, b: .85, l: .22, eh: 2.2, eb: 2 },
      { c: [-.78, 1.08, 0], h: .64, b: .64, l: .16, eh: 2.2, eb: 2 },
      { c: [-1.02, 1.34, 0], h: .40, b: .40, l: .11, eh: 2.2, eb: 2 },
      { c: [-1.28, 1.54, 0], h: .20, b: .20, l: .065, eh: 2.2, eb: 2 },
      { c: [-1.52, 1.64, 0], h: .07, b: .07, l: .03, eh: 2.2, eb: 2 },
    ];
    corps = corps.concat(fuseau(aileron, 8, [1, 0, 0], { capA: .08, capB: .06 }));
    // Grandes nageoires pectorales de baleine à bosse (envergure ~7,4 m) arquées vers l'arrière
    for (const z of [-1, 1]) {
      const pts = [[2.0, -.25, z * .95], [1.3, -.42, z * 2.05], [.2, -.52, z * 3.10], [-.75, -.46, z * 3.75]];
      corps = corps.concat(tube(pts, [[.11, .07, .52], [.09, .055, .44], [.065, .04, .30], [.035, .02, .11]], 6, [0, 1, 0]));
    }
    const md = { nom: 'baleine' };
    const [a, b] = decouper(corps, voronoi(.95, .13, 4111));
    md.corps = enregistrer('baleine-corps', a); md.marbre = enregistrer('baleine-marbre', b);
    // Caudale large échancrée aux lobes arqués
    const caud = [];
    for (let k = 0; k < 13; k++) {
      const s = k / 12, d = Math.abs(s - .5) * 2, z = (s - .5) * 4.3;
      const echancrure = Math.exp(-((d / .14) ** 2)) * -.24;
      caud.push({ c: [-.75 * Math.pow(d, 1.25) + echancrure, .04 * d, z], h: .10 * (1 - d * .75), b: .10 * (1 - d * .75), l: .66 * (1 - d * d * .68) });
    }
    md.caudale = enregistrer('baleine-caudale', fuseau(caud, 8, [0, 1, 0], { capA: .06, capB: .06 }));
    md.loin = enregistrer('baleine-loin', fuseau(sections.filter((_, k) => k % 4 === 0 || k === 21), 6, [0, 1, 0], { capA: .3, capB: .2 }));
    md.longueur = L;
    return md;
  }

  // ================================================================ bestiaire
  const C = (r, g, b) => Object.freeze([r, g, b]);
  const ESPECES = {
    cerf: { nom: 'Cerf élaphe', modele: 'cervide', famille: 'troupeau', cornes: { type: 'bois', taille: .82 },
      couleurs: [{ torse: [C(.43, .27, .15), C(.80, .70, .52)], cou: C(.37, .24, .14), tete: C(.42, .28, .17), pattes: C(.36, .24, .14), bas: C(.27, .19, .12), queue: C(.62, .52, .38), cornes: C(.56, .48, .37) }],
      hiver: [{ torse: [C(.33, .27, .21), C(.74, .66, .52)], cou: C(.27, .22, .17), tete: C(.34, .27, .2), pattes: C(.29, .23, .17), bas: C(.22, .18, .14), queue: C(.58, .5, .4), cornes: C(.56, .48, .37) }],
      male: { part: .25, echelle: 1.12, cou: C(.27, .17, .10), sansBoisAu: 'printemps' }, jeunes: { part: .2, echelle: .62, saisons: ['ete'] },
      taille: [.92, 1.06], groupes: [3, 4], effectif: [4, 7], habitat: { d: [45, 230], ny: [.9, 1], eau: [-1e9, -.6], arbres: [1, 40], rayon: 22, espace: 320 },
      vitesses: [1.15, 3.2, 11], foulees: [1.25, 2.3, 4.2], alerte: 150, fuite: 85, nuit: 'actif' },
    sanglier: { nom: 'Sanglier', modele: 'suide', famille: 'troupeau', cornes: { type: 'defenses', taille: 1 }, cornesDeuxSexes: true,
      couleurs: [{ torse: [C(.20, .17, .14)], cou: C(.19, .16, .13), tete: C(.24, .20, .16), pattes: C(.14, .12, .10), bas: C(.10, .09, .08), queue: C(.16, .14, .12), soies: C(.10, .09, .08), cornes: C(.92, .88, .76) }],
      jeunes: { part: .45, echelle: .5, saisons: ['printemps', 'ete'], couleurs: { torse: [C(.42, .30, .18)], cou: C(.4, .29, .18), tete: C(.42, .31, .2), pattes: C(.3, .22, .14), bas: C(.2, .15, .1), queue: C(.3, .22, .14) } },
      taille: [.9, 1.08], groupes: [2, 3], effectif: [4, 7], habitat: { d: [40, 170], ny: [.88, 1], eau: [-1e9, -.6], arbres: [4, 255], rayon: 18, espace: 300 },
      vitesses: [1.0, 2.8, 9], foulees: [.8, 1.5, 2.6], alerte: 90, fuite: 55, nuit: 'nocturne' },
    buse: { nom: 'Buse variable', modele: 'rapace', famille: 'plane', echelle: 1, couleurs: [{ corps: C(.36, .26, .17), ailes: C(.31, .23, .15), bec: C(.25, .22, .18) }], groupes: [2, 3], effectif: [1, 2], altitude: [45, 120], rayon: [28, 55] },
    camarguais: { nom: 'Cheval de Camargue', modele: 'equide', famille: 'troupeau', echelle: .94,
      couleurs: [{ torse: [C(.84, .84, .81)], cou: C(.83, .83, .8), tete: C(.8, .8, .77), pattes: C(.74, .74, .7), bas: C(.5, .5, .48), queue: C(.92, .92, .9), crins: C(.93, .93, .91) },
        { torse: [C(.74, .74, .72)], cou: C(.72, .72, .7), tete: C(.66, .66, .64), pattes: C(.6, .6, .58), bas: C(.36, .36, .35), queue: C(.88, .88, .86), crins: C(.9, .9, .88) }],
      jeunes: { part: .18, echelle: .6, saisons: ['printemps', 'ete'], couleurs: { torse: [C(.24, .2, .17)], cou: C(.24, .2, .17), tete: C(.22, .19, .16), pattes: C(.2, .17, .14), bas: C(.12, .1, .09), queue: C(.18, .15, .13), crins: C(.18, .15, .13) } },
      taille: [.95, 1.04], groupes: [2, 3], effectif: [5, 8], habitat: { d: [45, 300], ny: [.93, 1], eau: [-6, -.5], arbres: [0, 255], rayon: 26, espace: 300 },
      vitesses: [1.5, 3.8, 11], foulees: [1.6, 2.8, 5], alerte: 120, fuite: 60, nuit: 'actif' },
    flamant: { nom: 'Flamant rose', modele: 'flamant', famille: 'echassier', couleurs: [{ corps: C(.95, .62, .66), ailes: C(.93, .5, .55), bout: C(.06, .05, .06), cou: C(.96, .66, .7), tete: C(.96, .7, .73), bec: C(.92, .82, .8), pattes: C(.88, .45, .48) }],
      taille: [.9, 1.08], groupes: [2, 3], effectif: [8, 16], habitat: { d: [50, 420], ny: [.9, 1], eau: [-.3, .7], arbres: [0, 255], rayon: 14, espace: 160, etroit: true },
      vitesses: [.5, 1.0, 11], alerte: 140, fuite: 90, vol: 12, unePatte: .35 },
    goeland: { nom: 'Goéland', modele: 'goeland', famille: 'cotier', couleurs: [{ corps: C(.94, .94, .93), ailes: C(.64, .67, .72), bout: C(.07, .07, .08), tete: C(.95, .95, .94), bec: C(.95, .8, .2), pattes: C(.86, .62, .55), dos: C(.64, .67, .72) }],
      groupes: [2, 2], effectif: [4, 7], altitude: [6, 22] },
    bouquetin: { nom: 'Bouquetin des Alpes', modele: 'caprin', famille: 'troupeau', cornes: { type: 'cimeterre', taille: .78, femelle: .26 }, cornesDeuxSexes: true,
      couleurs: [{ torse: [C(.47, .41, .33), C(.76, .72, .64)], cou: C(.44, .38, .31), tete: C(.45, .39, .32), pattes: C(.3, .26, .21), bas: C(.2, .18, .15), queue: C(.3, .26, .21), cornes: C(.34, .3, .24) }],
      hiver: [{ torse: [C(.36, .31, .25), C(.66, .62, .55)], cou: C(.33, .28, .23), tete: C(.36, .31, .25), pattes: C(.24, .2, .17), bas: C(.17, .15, .13), queue: C(.24, .2, .17), cornes: C(.34, .3, .24) }],
      male: { part: .4, echelle: 1.14, cou: C(.36, .31, .25) }, jeunes: { part: .15, echelle: .6, saisons: ['ete'] },
      taille: [.92, 1.06], groupes: [3, 4], effectif: [3, 6], habitat: { d: [60, 420], ny: [.5, .93], eau: [-1e9, -.6], arbres: [0, 255], rayon: 16, espace: 300, monter: true },
      vitesses: [.9, 2.6, 7], foulees: [.9, 1.6, 2.6], alerte: 110, fuite: 55, nuit: 'actif' },
    marmotte: { nom: 'Marmotte des Alpes', modele: 'marmotte', famille: 'terrier', saisons: ['printemps', 'ete', 'automne'],
      couleurs: [{ torse: [C(.50, .40, .27)], cou: C(.46, .37, .26), tete: C(.36, .29, .21), pattes: C(.34, .27, .19), bas: C(.25, .2, .15), queue: C(.3, .24, .17) }],
      taille: [.9, 1.08], groupes: [2, 4], effectif: [3, 5], habitat: { d: [40, 230], ny: [.86, 1], eau: [-1e9, -.6], arbres: [0, 6], rayon: 9, espace: 160 },
      vitesses: [.6, 2.2, 4.2], foulees: [.25, .4, .6], alerte: 110, fuite: 75, nuit: 'terrier' },
    aigle: { nom: 'Aigle royal', modele: 'rapace', famille: 'plane', echelle: 1.75, couleurs: [{ corps: C(.24, .16, .10), ailes: C(.2, .14, .09), bec: C(.25, .22, .18) }], groupes: [1, 2], effectif: [1, 1], altitude: [70, 160], rayon: [40, 80] },
    islandais: { nom: 'Cheval islandais', modele: 'equide', famille: 'troupeau', echelle: .86, crinEpais: 1.6,
      couleurs: [
        { torse: [C(.48, .26, .12)], cou: C(.47, .26, .12), tete: C(.45, .25, .12), pattes: C(.42, .23, .11), bas: C(.3, .17, .09), queue: C(.82, .72, .55), crins: C(.84, .74, .56) },
        { torse: [C(.08, .07, .07)], cou: C(.08, .07, .07), tete: C(.08, .07, .07), pattes: C(.07, .06, .06), bas: C(.05, .05, .05), queue: C(.06, .05, .05), crins: C(.06, .05, .05) },
        { torse: [C(.40, .22, .12)], cou: C(.38, .21, .12), tete: C(.37, .21, .12), pattes: C(.15, .1, .07), bas: C(.08, .06, .05), queue: C(.06, .05, .05), crins: C(.06, .05, .05) },
        { torse: [C(.68, .56, .37)], cou: C(.66, .54, .36), tete: C(.6, .5, .34), pattes: C(.3, .24, .17), bas: C(.14, .11, .08), queue: C(.12, .1, .08), crins: C(.12, .1, .08) },
        { torse: [C(.70, .70, .68)], cou: C(.62, .62, .6), tete: C(.55, .55, .53), pattes: C(.5, .5, .48), bas: C(.3, .3, .29), queue: C(.85, .85, .83), crins: C(.85, .85, .83) },
        { torse: [C(.78, .64, .40)], cou: C(.76, .62, .39), tete: C(.72, .6, .38), pattes: C(.66, .55, .35), bas: C(.4, .33, .22), queue: C(.93, .9, .8), crins: C(.93, .9, .8) }],
      taille: [.94, 1.05], groupes: [2, 3], effectif: [5, 9], habitat: { d: [45, 320], ny: [.92, 1], eau: [-1e9, -.6], arbres: [0, 255], rayon: 26, espace: 320 },
      vitesses: [1.4, 3.6, 10], foulees: [1.4, 2.5, 4.4], alerte: 110, fuite: 55, nuit: 'actif' },
    mouton: { nom: 'Mouton islandais', modele: 'ovin', famille: 'troupeau', saisons: ['printemps', 'ete', 'automne'], cornes: { type: 'volute', taille: .3 },
      couleurs: [
        { torse: [C(.86, .84, .78)], cou: C(.85, .83, .77), tete: C(.88, .86, .8), pattes: C(.84, .82, .76), bas: C(.8, .78, .72), queue: C(.85, .83, .77), cornes: C(.62, .56, .46) },
        { torse: [C(.88, .86, .8)], cou: C(.86, .84, .78), tete: C(.16, .14, .13), pattes: C(.18, .16, .14), bas: C(.12, .11, .1), queue: C(.86, .84, .78), cornes: C(.62, .56, .46) },
        { torse: [C(.34, .24, .16)], cou: C(.33, .23, .15), tete: C(.3, .21, .14), pattes: C(.26, .19, .13), bas: C(.2, .15, .1), queue: C(.33, .23, .15), cornes: C(.55, .5, .42) },
        { torse: [C(.12, .11, .1)], cou: C(.12, .11, .1), tete: C(.1, .09, .09), pattes: C(.1, .09, .09), bas: C(.08, .07, .07), queue: C(.12, .11, .1), cornes: C(.5, .45, .38) },
        { torse: [C(.56, .54, .5)], cou: C(.54, .52, .48), tete: C(.86, .84, .8), pattes: C(.8, .78, .74), bas: C(.7, .68, .64), queue: C(.56, .54, .5), cornes: C(.6, .55, .45) }],
      male: { part: .2, echelle: 1.06 }, jeunes: { part: .3, echelle: .6, saisons: ['printemps', 'ete'] },
      taille: [.92, 1.06], groupes: [3, 4], effectif: [2, 5], habitat: { d: [40, 300], ny: [.85, 1], eau: [-1e9, -.6], arbres: [0, 255], rayon: 16, espace: 220 },
      vitesses: [.8, 2.4, 6.5], foulees: [.7, 1.3, 2.2], alerte: 80, fuite: 42, nuit: 'actif' },
    oie: { nom: 'Oie cendrée', modele: 'oie', famille: 'migrateur', saisons: ['printemps', 'ete', 'automne'],
      couleurs: [{ corps: C(.52, .5, .46), ailes: C(.42, .4, .37), bout: C(.3, .29, .28), cou: C(.42, .4, .36), tete: C(.44, .42, .38), bec: C(.92, .5, .22), pattes: C(.92, .6, .5), dos: C(.4, .38, .35) }],
      groupes: [2, 2], effectif: [9, 13], altitude: [70, 110] },
    girafe: { nom: 'Girafe', modele: 'girafe', famille: 'troupeau', cornes: { type: 'ossicones', taille: 1, femelle: 1 }, cornesDeuxSexes: true,
      couleurs: [{ torse: [C(.60, .34, .14), C(.90, .83, .68)], cou: [C(.60, .34, .14), C(.90, .83, .68)], tete: C(.78, .6, .38), pattes: C(.86, .76, .58), bas: C(.88, .82, .7), queue: C(.7, .5, .3), cornes: C(.35, .24, .14), crins: C(.42, .25, .12) }],
      jeunes: { part: .2, echelle: .62, saisons: ['printemps', 'ete', 'automne', 'hiver'] },
      taille: [.9, 1.06], groupes: [2, 2], effectif: [2, 4], habitat: { d: [55, 330], ny: [.9, 1], eau: [-1e9, -.6], arbres: [0, 255], rayon: 24, espace: 320 },
      vitesses: [1.3, 3.2, 9], foulees: [2.4, 3.6, 5.4], alerte: 170, fuite: 80, nuit: 'actif' },
    oryx: { nom: 'Oryx gazelle', modele: 'antilope', famille: 'troupeau', cornes: { type: 'droites', taille: .82, femelle: .78 }, cornesDeuxSexes: true, male: { part: .4, echelle: 1.03 },
      couleurs: [{ torse: [C(.72, .67, .58), C(.07, .07, .07), C(.93, .92, .89)], cou: C(.72, .67, .58), tete: C(.88, .87, .84), pattes: C(.12, .11, .1), bas: C(.88, .87, .84), queue: C(.08, .08, .08), cornes: C(.09, .08, .08) }],
      taille: [.93, 1.05], groupes: [2, 3], effectif: [4, 8], habitat: { d: [50, 300], ny: [.9, 1], eau: [-1e9, -.6], arbres: [0, 255], rayon: 22, espace: 300 },
      vitesses: [1.2, 3.4, 12], foulees: [1.3, 2.4, 4.5], alerte: 170, fuite: 100, nuit: 'actif' },
    autruche: { nom: 'Autruche', modele: 'autruche', famille: 'coureur',
      couleurs: [{ corps: C(.08, .07, .07), plumes: C(.94, .93, .9), cou: C(.78, .62, .58), tete: C(.74, .6, .56), bec: C(.7, .62, .5), pattes: C(.82, .64, .6) },
        { corps: C(.42, .36, .3), plumes: C(.6, .55, .48), cou: C(.72, .62, .56), tete: C(.7, .6, .55), bec: C(.7, .62, .5), pattes: C(.72, .6, .55) }],
      taille: [.94, 1.05], groupes: [2, 2], effectif: [2, 4], habitat: { d: [45, 280], ny: [.92, 1], eau: [-1e9, -.6], arbres: [0, 255], rayon: 20, espace: 280 },
      vitesses: [1.2, 4, 15], foulees: [1.4, 2.6, 4.6], alerte: 160, fuite: 90, nuit: 'actif' },
    vautour: { nom: 'Vautour', modele: 'rapace', famille: 'plane', echelle: 2.1, couleurs: [{ corps: C(.40, .31, .22), ailes: C(.30, .23, .16), bec: C(.72, .68, .6) }], groupes: [2, 3], effectif: [2, 3], altitude: [60, 150], rayon: [45, 90] },
    buffle: { nom: 'Buffle d’eau', modele: 'bovin', famille: 'troupeau', cornes: { type: 'croissant', taille: .7, femelle: .55 }, cornesDeuxSexes: true, male: { part: .3, echelle: 1.08 },
      couleurs: [{ torse: [C(.21, .21, .23)], cou: C(.2, .2, .22), tete: C(.22, .22, .24), pattes: C(.24, .23, .24), bas: C(.42, .4, .38), queue: C(.18, .18, .2), cornes: C(.2, .19, .18) }],
      jeunes: { part: .2, echelle: .58, saisons: ['printemps', 'ete', 'automne', 'hiver'] },
      taille: [.93, 1.05], groupes: [2, 3], effectif: [2, 4], habitat: { d: [40, 260], ny: [.95, 1], eau: [-1e9, -.6], arbres: [0, 255], rayon: 18, espace: 280 },
      vitesses: [.9, 2.4, 6], foulees: [1.2, 2.0, 3.2], alerte: 60, fuite: 32, nuit: 'actif' },
    aigrette: { nom: 'Grande aigrette', modele: 'aigrette', famille: 'echassier', couleurs: [{ corps: C(.95, .95, .94), ailes: C(.95, .95, .94), cou: C(.95, .95, .94), tete: C(.95, .95, .94), bec: C(.86, .72, .22), pattes: C(.1, .1, .1) }],
      taille: [.92, 1.06], groupes: [2, 3], effectif: [3, 7], habitat: { d: [42, 300], ny: [.95, 1], eau: [-1e9, -.6], arbres: [0, 255], rayon: 14, espace: 200 },
      vitesses: [.35, .8, 9], alerte: 90, fuite: 55, vol: 8, unePatte: 0 },
    milan: { nom: 'Milan noir', modele: 'milan', famille: 'plane', echelle: 1.05, couleurs: [{ corps: C(.30, .22, .15), ailes: C(.26, .19, .13), bec: C(.25, .22, .18) }], groupes: [2, 2], effectif: [1, 2], altitude: [40, 110], rayon: [30, 60] },
    wapiti: { nom: 'Wapiti de Roosevelt', modele: 'cervide', famille: 'troupeau', echelle: 1.3, cornes: { type: 'bois', taille: 1.05 },
      couleurs: [{ torse: [C(.60, .47, .31), C(.86, .78, .6)], cou: C(.25, .17, .11), tete: C(.38, .28, .18), pattes: C(.27, .19, .12), bas: C(.2, .15, .1), queue: C(.8, .72, .55), cornes: C(.6, .52, .4) }],
      male: { part: .2, echelle: 1.1, cou: C(.18, .12, .08), sansBoisAu: 'printemps' }, jeunes: { part: .18, echelle: .6, saisons: ['ete'] },
      taille: [.93, 1.05], groupes: [3, 3], effectif: [5, 9], habitat: { d: [45, 300], ny: [.9, 1], eau: [-1e9, -.6], arbres: [0, 255], rayon: 26, espace: 320 },
      vitesses: [1.3, 3.4, 11], foulees: [1.5, 2.6, 4.8], alerte: 130, fuite: 70, nuit: 'actif' },
    pelican: { nom: 'Pélican brun', modele: 'pelican', famille: 'cotier', couleurs: [{ corps: C(.42, .4, .38), ailes: C(.36, .34, .32), cou: C(.86, .84, .78), tete: C(.92, .9, .82), bec: C(.62, .56, .46), pattes: C(.15, .14, .13), dos: C(.4, .38, .36) }],
      groupes: [2, 2], effectif: [4, 7], altitude: [4, 14] },
    baleine: { nom: 'Baleine', modele: 'baleine', famille: 'marin', groupes: [1, 2], effectif: [1, 1],
      couleurs: [{ corps: C(.30, .32, .34), marbre: C(.52, .54, .56), caudale: C(.26, .28, .3) }] },
    urubu: { nom: 'Urubu à tête rouge', modele: 'rapace', famille: 'plane', echelle: 1.5, couleurs: [{ corps: C(.13, .11, .1), ailes: C(.11, .09, .08), bec: C(.62, .2, .16) }], groupes: [2, 2], effectif: [1, 2], altitude: [40, 120], rayon: [35, 70] },
  };
  // Les goélands fréquentent aussi les quais et les plages, où ils se posent en bande.
  ESPECES.goelandPose = {
    nom: 'Goéland posé', modele: 'goeland', famille: 'echassier', couleurs: ESPECES.goeland.couleurs,
    taille: [.9, 1.1], groupes: [2, 4], effectif: [3, 6], habitat: {
      d: [14, 40], ny: [.83, 1], eau: [-1e9, .15], arbres: [0, 8], rayon: 6, espace: 120, etroit: true },
    vitesses: [.5, 1, 10], alerte: 60, fuite: 35, vol: 8, unePatte: .06,
  };
  const BIOMES = Object.freeze({
    marseille: Object.freeze(['goelandPose', 'goeland']),
    corail: Object.freeze(['goelandPose', 'aigrette', 'pelican']),
    fjord: Object.freeze(['cerf', 'mouton', 'aigle']),
    sierra: Object.freeze(['wapiti', 'urubu']),
    foret: Object.freeze(['cerf', 'sanglier', 'buse']),
    cote: Object.freeze(['camarguais', 'flamant', 'goeland']),
    montagne: Object.freeze(['bouquetin', 'marmotte', 'aigle']),
    islande: Object.freeze(['islandais', 'mouton', 'oie']),
    desert: Object.freeze(['girafe', 'oryx', 'autruche', 'vautour']),
    asie: Object.freeze(['buffle', 'aigrette', 'milan']),
    pacifique: Object.freeze(['wapiti', 'pelican', 'baleine', 'urubu']),
    baikal: Object.freeze(['cerf', 'sanglier', 'aigle', 'oie']),
  });

  const MODELES = {};
  const tChargement = (globalThis.performance && performance.now) ? performance.now() : 0;
  {
    const cornesPar = {};
    for (const e of Object.values(ESPECES)) if (e.cornes && !cornesPar[e.modele]) cornesPar[e.modele] = e.cornes;
    for (const [nom, q] of Object.entries(MODELES_Q)) MODELES[nom] = finirQuadrupede(modeleQuadrupede(nom, q), cornesPar[nom] || null);
    MODELES.equide.criniereEpaisse = enregistrer('equide-criniere-epaisse', criniere(MODELES_Q.equide, 9, 6, 1.6));
    for (const [nom, o] of Object.entries(MODELES_O)) MODELES[nom] = modeleOiseau(nom, o);
    MODELES.baleine = modeleBaleine();
    for (const e of Object.values(ESPECES)) if (e.modele === 'cervide' && e.cornes && e.cornes.taille !== cornesPar.cervide.taille) e.echelleBois = e.cornes.taille / cornesPar.cervide.taille;
  }
  const dureeChargement = (globalThis.performance && performance.now) ? performance.now() - tChargement : 0;

  // ================================================================ pose : matrices et pièces (sans allocation)
  function mRepere(o, A) {
    const cap = A[0], tangage = A[1], roulis = A[2], ca = Math.cos(cap), sa = Math.sin(cap), ct = Math.cos(tangage), st = Math.sin(tangage), cr = Math.cos(roulis), sr = Math.sin(roulis);
    const a00 = ca * ct, a01 = -ca * st, a02 = -sa, a10 = st, a11 = ct, a12 = 0, a20 = sa * ct, a21 = -sa * st, a22 = ca;
    o[0] = a00; o[1] = a01 * cr + a02 * sr; o[2] = -a01 * sr + a02 * cr;
    o[3] = a10; o[4] = a11 * cr + a12 * sr; o[5] = -a11 * sr + a12 * cr;
    o[6] = a20; o[7] = a21 * cr + a22 * sr; o[8] = -a21 * sr + a22 * cr;
    return o;
  }
  function mCopier(o, a) { for (let i = 0; i < 9; i++) o[i] = a[i]; return o; }
  function mFoisZ(o, a, T) {
    const t = T[0], c = Math.cos(t), s = Math.sin(t);
    for (let r = 0; r < 9; r += 3) { const x = a[r], y = a[r + 1]; o[r] = x * c + y * s; o[r + 1] = -x * s + y * c; o[r + 2] = a[r + 2]; }
    return o;
  }
  function mFoisX(o, a, T) {
    const t = T[0], c = Math.cos(t), s = Math.sin(t);
    for (let r = 0; r < 9; r += 3) { const y = a[r + 1], z = a[r + 2]; o[r] = a[r]; o[r + 1] = y * c + z * s; o[r + 2] = -y * s + z * c; }
    return o;
  }
  function mFoisY(o, a, T) {
    const t = T[0], c = Math.cos(t), s = Math.sin(t);
    for (let r = 0; r < 9; r += 3) { const x = a[r], z = a[r + 2]; o[r] = x * c - z * s; o[r + 1] = a[r + 1]; o[r + 2] = x * s + z * c; }
    return o;
  }
  function mPoint(o, base, M, V) { const x = V[0], y = V[1], z = V[2]; o[0] = base[0] + M[0] * x + M[1] * y + M[2] * z; o[1] = base[1] + M[3] * x + M[4] * y + M[5] * z; o[2] = base[2] + M[6] * x + M[7] * y + M[8] * z; return o; }
  function piece(o, f, M, j, K, col, mat, emissive) {
    const kx = K[0], ky = K[1], kz = K[2], cx = f.centre[0] * kx, cy = f.centre[1] * ky, cz = f.centre[2] * kz;
    o.shape = f.nom; o.forme = f;
    o.p[0] = j[0] + M[0] * cx + M[1] * cy + M[2] * cz; o.p[1] = j[1] + M[3] * cx + M[4] * cy + M[5] * cz; o.p[2] = j[2] + M[6] * cx + M[7] * cy + M[8] * cz;
    o.s[0] = f.taille[0] * kx; o.s[1] = f.taille[1] * ky; o.s[2] = f.taille[2] * kz;
    const m20 = M[6];
    if (m20 < .999999 && m20 > -.999999) { o.r[1] = -Math.asin(m20); o.r[0] = Math.atan2(M[7], M[8]); o.r[2] = Math.atan2(M[3], M[0]); }
    else { o.r[1] = m20 > 0 ? -Math.PI / 2 : Math.PI / 2; o.r[2] = 0; o.r[0] = Math.atan2(-M[5], M[4]); }
    o.color[0] = col[0]; o.color[1] = col[1]; o.color[2] = col[2]; o.mat = mat; o.emissive = emissive;
    return o;
  }
  const KS = new Float64Array(3), KB = new Float64Array(3), KL = new Float64Array(3);
  const VP = new Float64Array(3), VR = new Float64Array(3), A1 = new Float64Array(1);
  const kv = (o, a, b, c) => { o[0] = a; o[1] = b; o[2] = c; return o; }, k1 = a => { A1[0] = a; return A1; };
  function objetVide() {
    return { shape: 'box', forme: null, p: [0, 0, 0], s: [0, 0, 0], r: [0, 0, 0], color: [0, 0, 0], mat: 18, emissive: 0,
      surface: 'object', outdoor: true, overlay: false, windResponsive: false, fx: false, fxPriority: undefined, alpha: 1, opacity: 1, animal: '' };
  }
  const POIL = 18, CORNE = 17;
  const ALLURES = [
    { A: 0, beta: 1, F: 0, Fh: 0, dec: [0, 0, 0, 0], bob: 0, tang: 0 },
    { A: .30, beta: .64, F: .8, Fh: .6, dec: [.25, .75, 0, .5], bob: .012, tang: 0 },
    { A: .40, beta: .46, F: 1.1, Fh: .8, dec: [0, .5, .5, 0], bob: .03, tang: .015 },
    { A: .62, beta: .36, F: 1.5, Fh: 1.1, dec: [.52, .62, 0, .1], bob: .07, tang: .06 },
  ];
  const BOND = { A: .7, beta: .4, F: 1.2, Fh: 1.0, dec: [0, .06, .5, .56], bob: .05, tang: .1 };
  const jambeTampon = [0, 0];
  function cycle(P, al, avant, o) {
    let p = P[0]; p -= Math.floor(p);
    if (p < al.beta) { o[0] = al.A * (1 - 2 * p / al.beta); o[1] = 0; }
    else { const s = (p - al.beta) / (1 - al.beta), e = s * s * (3 - 2 * s); o[0] = -al.A + 2 * al.A * e; o[1] = (avant ? -al.F : al.Fh) * Math.sin(Math.PI * s); }
    return o;
  }
  function poidsAllures(V, vit, o) {
    const v = V[0];
    o[0] = o[1] = o[2] = o[3] = 0;
    if (v < .12) { o[0] = 1; return o; }
    const t = vit[1] * .82, g = vit[2] * .7;
    if (v < t) { const k = lisse(.12, Math.min(.5, vit[0] * .5), v); o[0] = 1 - k; o[1] = k; }
    else if (v < vit[1] * 1.15) { const k = lisse(t, vit[1] * 1.15, v); o[1] = 1 - k; o[2] = k; }
    else if (v < g) o[2] = 1;
    else { const k = lisse(g, vit[2] * .92, v); o[2] = 1 - k; o[3] = k; }
    return o;
  }
  const PA = [0, 0, 0, 0], MB = new Float64Array(9), MN = new Float64Array(9), MT = new Float64Array(9), M1 = new Float64Array(9), M2 = new Float64Array(9);
  const J0 = [0, 0, 0], J1 = [0, 0, 0], J2 = [0, 0, 0], J3 = [0, 0, 0];

  function poserQuadrupede(ps, e, md, lod, r, k, couleurs) {
    const q = md.q, R = md.rig, sc = ps.echelle, ter = e.famille === 'terrier';
    KS[0] = KS[1] = KS[2] = sc;
    const al = poidsAllures(k1(ps.v), e.vitesses, PA);
    const couche = ps.couche, debout = ps.debout;
    let bob = 0, tang = 0;
    for (let a = 1; a < 4; a++) if (al[a]) { const A = ter && a === 3 ? BOND : ALLURES[a]; bob += al[a] * A.bob * (.5 - .5 * Math.cos(TAU * 2 * ps.phase)); tang += al[a] * A.tang * Math.sin(TAU * ps.phase); }
    const bas = (q.H - q.P - .02) * couche;
    const tg = ps.tangage + tang, rl = ps.roulis * (1 - couche);
    mRepere(MB, kv(VR, ps.cap, tg + debout * DEBOUT, rl));
    J0[0] = ps.x; J0[1] = ps.y - (bob * q.H + bas + ps.enfoui) * sc; J0[2] = ps.z;
    if (debout) {
      mRepere(M1, kv(VR, ps.cap, tg, rl));
      const hx = R.ar.x * sc, hy = R.ar.y * sc * .5;
      J0[0] += (M1[0] - MB[0]) * hx + (M1[1] - MB[1]) * hy;
      J0[1] += (M1[3] - MB[3]) * hx + (M1[4] - MB[4]) * hy - R.ar.y * sc * .5 * debout;
      J0[2] += (M1[6] - MB[6]) * hx + (M1[7] - MB[7]) * hy;
    }
    const nom = e.cle;
    if (lod === 1) { piece(r[k], ps.cornes === 2 ? md.loinF : ps.cornes ? md.loin : md.loinNue, MB, J0, KS, couleurs.torse[0], POIL, 0).animal = nom; return 1; }
    let n = 0;
    const tor = lod === 3 ? md.torse : md.torseM;
    for (let i = 0; i < tor.length; i++) piece(r[k + n++], tor[i], MB, J0, KS, couleurs.torse[i] || couleurs.torse[0], POIL, 0).animal = nom;
    const c = ps.cou, nod = al[1] * .045 * Math.sin(TAU * 2 * ps.phase) - al[3] * .3;
    const dc = (c < 0 ? R.couBroute * -c : R.couAlerte * c) * (1 - couche * .6) + nod + couche * .1, dt = (c < 0 ? R.teteBroute * -c : R.teteAlerte * c);
    mPoint(J1, J0, MB, kv(VP, R.B[0] * sc, R.B[1] * sc, 0));
    mFoisY(MN, MB, k1(ps.regard * .55)); mFoisZ(MN, MN, k1(dc - debout * DEBOUT * .85));
    const couCol = couleurs.cou, uni = Array.isArray(couCol[0]) ? couCol[0] : couCol;
    if (lod === 3) {
      for (let i = 0; i < md.cou.length; i++) piece(r[k + n++], md.cou[i], MN, J1, KS, Array.isArray(couCol[0]) ? couCol[i] : couCol, POIL, 0).animal = nom;
      if (md.criniere) piece(r[k + n++], e.crinEpais ? MODELES.equide.criniereEpaisse : md.criniere, MN, J1, KS, couleurs.crins || uni, POIL, 0).animal = nom;
      mPoint(J2, J1, MN, kv(VP, R.E[0] * sc, R.E[1] * sc, 0));
      mFoisY(MT, MN, k1(ps.regard * .45)); mFoisZ(MT, MT, k1(q.tete.angle + dt + debout * .5));
      piece(r[k + n++], md.tete, MT, J2, KS, couleurs.tete, POIL, 0).animal = nom;
      piece(r[k + n++], md.yeux, MT, J2, KS, ps.lueur > .05 ? LUEUR : NOIR, CORNE, ps.lueur * 2.4).animal = nom;
      if (ps.cornes) { const kb = e.echelleBois && ps.cornes === 1 ? e.echelleBois : 1; KB[0] = KB[1] = KB[2] = sc * kb; piece(r[k + n++], ps.cornes === 2 ? md.cornesFemelle : md.cornes, MT, J2, KB, couleurs.cornes, CORNE, 0).animal = nom; }
    } else piece(r[k + n++], ps.cornes === 2 ? md.couteteF : ps.cornes ? md.coutete : md.couteteNue, MN, J1, KS, uni, POIL, 0).animal = nom;
    const ep = q.epaisseur, pf = pattesPour(q);
    for (let p = 0; p < 4; p++) {
      const avant = p < 2, P = avant ? R.av : R.ar, z = (p & 1 ? 1 : -1) * P.z;
      let t1 = 0, t2 = 0;
      for (let a = 1; a < 4; a++) if (al[a]) {
        const A = ter && a === 3 ? BOND : ALLURES[a];
        cycle(k1(ps.phase + A.dec[p]), A, avant, jambeTampon);
        let f1 = jambeTampon[0], f2 = jambeTampon[1];
        if (f2 === 0) f2 = -f1 * .85;
        t1 += al[a] * f1; t2 += al[a] * f2;
      }
      t1 += P.t1 - tg * (1 - couche); t2 += P.t2;
      if (couche) { t1 = mix(t1, avant ? -1.05 : -1.1, couche); t2 = mix(t2, avant ? 2.95 : 2.66, couche); }
      if (debout) { if (avant) { t1 = mix(t1, .3 - DEBOUT, debout); t2 = mix(t2, -.6, debout); } else { t1 = mix(t1, Math.PI / 2 - DEBOUT, debout); t2 = mix(t2, 0, debout); } }
      mPoint(J3, J0, MB, kv(VP, P.x * sc, P.y * sc, z * sc));
      if (lod === 3) {
        mFoisZ(M1, MB, k1(t1));
        const l1 = P.l1 * sc, l2 = P.l2 * sc, g1 = l1 * (avant ? ep[0] : ep[1]), g2 = l2 * ep[2];
        piece(r[k + n++], avant ? pf.bras : pf.cuisse, M1, J3, kv(KL, g1, l1, g1), couleurs.pattes, POIL, 0).animal = nom;
        mPoint(J2, J3, M1, kv(VP, 0, -l1, 0)); mFoisZ(M2, MB, k1(t1 + t2));
        piece(r[k + n++], pf.canon, M2, J2, kv(KL, g2, l2, g2), couleurs.bas, POIL, 0).animal = nom;
      } else {
        mFoisZ(M1, MB, k1(t1 + t2 * .45));
        const l = (P.l1 + P.l2) * sc * (1 - .45 * couche), g = l * (avant ? ep[0] : ep[1]) * .62;
        piece(r[k + n++], FP.moyenne, M1, J3, kv(KL, g, l, g), couleurs.pattes, POIL, 0).animal = nom;
      }
    }
    if (lod === 3) {
      const lift = -(.25 + .95 * al[3]) * (1 - couche);
      mPoint(J1, J0, MB, kv(VP, md.queuePos[0] * sc, md.queuePos[1] * sc, 0));
      mFoisY(M1, MB, k1(ps.queue * (1 - al[3]))); mFoisZ(M1, M1, k1(lift));
      piece(r[k + n++], md.queue, M1, J1, KS, couleurs.queue, POIL, 0).animal = nom;
    }
    return n;
  }
  const DEBOUT = 1.22;
  const NOIR = C(.025, .022, .02), LUEUR = C(.55, .85, .42);

  function poserOiseau(ps, e, md, lod, r, k, col) {
    const o = md.o, sc = ps.echelle, nom = e.cle;
    KS[0] = KS[1] = KS[2] = sc;
    if (ps.vol) {
      mRepere(MB, kv(VR, ps.cap, ps.tangage, ps.roulis));
      J0[0] = ps.x; J0[1] = ps.y; J0[2] = ps.z;
      if (lod === 1 && md.loinVol) { piece(r[k], md.loinVol, MB, J0, KS, col.ailes || col.corps, POIL, 0).animal = nom; return 1; }
      let n = 0;
      piece(r[k + n++], md.corps, MB, J0, KS, col.corps, POIL, 0).animal = nom;
      const ph = TAU * ps.battement, a1 = ps.diedre + ps.bat * Math.sin(ph), a2 = ps.bat * .55 * Math.sin(ph - .7) + ps.diedre * .3;
      const ep = md.epaule;
      for (let cote = -1; cote <= 1; cote += 2) {
        mPoint(J1, J0, MB, kv(VP, ep[0] * sc, ep[1] * sc, cote * ep[2] * sc));
        if (lod === 2) { mFoisX(M1, MB, k1(cote > 0 ? -a1 : Math.PI + a1)); piece(r[k + n++], md.aileLoin, M1, J1, KS, col.ailes, POIL, 0).animal = nom; continue; }
        mFoisX(M1, MB, k1(cote > 0 ? -a1 : Math.PI + a1));
        piece(r[k + n++], md.aileInt, M1, J1, KS, col.ailes, POIL, 0).animal = nom;
        mPoint(J2, J1, M1, kv(VP, 0, 0, o.aile.int[0] * sc));
        mFoisX(M2, M1, k1(cote > 0 ? -a2 : a2));
        piece(r[k + n++], md.aileExt, M2, J2, KS, col.ailes, POIL, 0).animal = nom;
        if (md.aileBout) piece(r[k + n++], md.aileBout, M2, J2, KS, col.bout, POIL, 0).animal = nom;
      }
      if (lod === 3 || md.couVol) {
        let cx = o.corps.long * .44 * sc, cy = o.corps.rayon * .25 * sc;
        if (md.couVol) {
          mPoint(J1, J0, MB, kv(VP, cx, cy, 0));
          piece(r[k + n++], md.couVol, MB, J1, KS, col.cou || col.corps, POIL, 0).animal = nom;
          mPoint(J2, J1, MB, kv(VP, md.boutVol[0] * sc, md.boutVol[1] * sc, 0));
        } else mPoint(J2, J0, MB, kv(VP, cx + o.tete.r * .6 * sc, cy + o.tete.r * .3 * sc, 0));
        if (lod === 3) {
          piece(r[k + n++], md.tete, MB, J2, KS, col.tete || col.corps, POIL, 0).animal = nom;
          piece(r[k + n++], md.bec, MB, J2, KS, col.bec, CORNE, 0).animal = nom;
          if (o.pattes && o.pattes.tibia > .2) for (let cote = -1; cote <= 1; cote += 2) {
            mPoint(J1, J0, MB, kv(VP, -o.corps.long * .2 * sc, -o.corps.rayon * .2 * sc, cote * o.corps.rayon * .25 * sc));
            mFoisZ(M1, MB, k1(-1.5));
            const l = (o.pattes.tibia + o.pattes.tarse) * sc, g = l * .06 * o.pattes.epais;
            piece(r[k + n++], FP.oiseau, M1, J1, kv(KL, g, l, g), col.pattes, POIL, 0).animal = nom;
          }
        }
      }
      return n;
    }
    const p = o.pattes, h = (p.tibia + p.tarse) * sc, al = poidsAllures(k1(ps.v), e.vitesses, PA);
    mRepere(MB, kv(VR, ps.cap, ps.tangage * .3 + (ps.cou < 0 ? .12 * ps.cou : 0), ps.roulis * .3));
    J0[0] = ps.x; J0[1] = ps.y + h + o.corps.rayon * .55 * sc - (ps.couche * h * .9); J0[2] = ps.z;
    if (lod === 1) { mRepere(M1, kv(VR, ps.cap, 0, 0)); J1[0] = ps.x; J1[1] = ps.y; J1[2] = ps.z; piece(r[k], md.loinPose, M1, J1, KS, col.corps, POIL, 0).animal = nom; return 1; }
    let n = 0;
    piece(r[k + n++], md.corps, MB, J0, KS, col.corps, POIL, 0).animal = nom;
    if (md.plumes) piece(r[k + n++], md.plumes, MB, J0, KS, col.plumes, POIL, 0).animal = nom;
    if (md.pliee && lod === 3) piece(r[k + n++], md.pliee, MB, J0, KS, col.dos || col.ailes, POIL, 0).animal = nom;
    const bx = o.corps.long * .4 * sc, by = o.corps.rayon * .2 * sc;
    const c = ps.cou, dc = c < 0 ? -1.25 * -c : .12 * c;
    if (md.couPose) {
      mPoint(J1, J0, MB, kv(VP, bx, by, 0)); mFoisY(MN, MB, k1(ps.regard * .5)); mFoisZ(MN, MN, k1(dc));
      piece(r[k + n++], md.couPose, MN, J1, KS, col.cou || col.corps, POIL, 0).animal = nom;
      mPoint(J2, J1, MN, kv(VP, md.boutPose[0] * sc, md.boutPose[1] * sc, 0));
      mFoisZ(MT, MN, k1(c < 0 ? -1.1 * -c : 0));
    } else { mPoint(J2, J0, MB, kv(VP, (o.corps.long * .5 + o.tete.r * .4) * sc, o.corps.rayon * .45 * sc, 0)); mFoisY(MT, MB, k1(ps.regard * .6)); mFoisZ(MT, MT, k1(c < 0 ? -.9 * -c : 0)); }
    if (lod === 3) {
      piece(r[k + n++], md.tete, MT, J2, KS, col.tete || col.corps, POIL, 0).animal = nom;
      piece(r[k + n++], md.bec, MT, J2, KS, col.bec, CORNE, 0).animal = nom;
    }
    for (let cote = -1; cote <= 1; cote += 2) {
      const pied = cote < 0 ? 0 : .5;
      let t1 = 0, t2 = 0;
      if (al[1] + al[2] + al[3] > 0) { const ph = (ps.phase + pied) % 1, sw = Math.sin(TAU * ph); t1 = .38 * sw * (1 - al[0]); t2 = -Math.max(0, -Math.cos(TAU * ph)) * .9 * (1 - al[0]); }
      if (ps.patte && cote > 0) { t1 = mix(t1, .95, ps.patte); t2 = mix(t2, -2.7, ps.patte); }
      if (ps.couche) { t1 = mix(t1, 1.2, ps.couche); t2 = mix(t2, -2.5, ps.couche); }
      mPoint(J3, J0, MB, kv(VP, -o.corps.long * .06 * sc, -o.corps.rayon * .55 * sc, cote * o.corps.rayon * .3 * sc));
      mFoisZ(M1, MB, k1(t1 - (ps.tangage * .3)));
      const l1 = p.tibia * sc, l2 = p.tarse * sc, g1 = Math.max(l1, .16 * sc) * .28 * p.epais * (md.plumes ? 1.35 : 1), g2 = Math.max(l2, .18 * sc) * .20 * p.epais * (md.plumes ? 1.18 : 1);
      if (lod === 3) {
        piece(r[k + n++], FP.oiseau, M1, J3, kv(KL, g1, l1, g1), col.pattes, POIL, 0).animal = nom;
        mPoint(J2, J3, M1, kv(VP, 0, -l1, 0)); mFoisZ(M2, M1, k1(t2)); piece(r[k + n++], FP.oiseauPied, M2, J2, kv(KL, g2, l2, g2), col.pattes, POIL, 0).animal = nom;
      } else {
        const l = (l1 + l2) * (1 - .45 * Math.max(ps.patte, ps.couche)), g = (g1 + g2) * .5;
        piece(r[k + n++], FP.oiseau, M1, J3, kv(KL, g, l, g), col.pattes, POIL, 0).animal = nom;
      }
    }
    return n;
  }
  function poserBaleine(ps, e, md, lod, r, k, col, fx) {
    const sc = ps.echelle, nom = e.cle;
    // Un souffle du niveau détaillé ne doit pas survivre dans le pool après
    // le retour à la silhouette, qui sort avant la préparation de cet effet.
    if (fx) fx.alpha = 0;
    KS[0] = KS[1] = KS[2] = sc;
    mRepere(MB, kv(VR, ps.cap, ps.tangage, 0));
    J0[0] = ps.x; J0[1] = ps.y; J0[2] = ps.z;
    if (lod === 1) { piece(r[k], md.loin, MB, J0, KS, col.corps, POIL, 0).animal = nom; return 1; }
    let n = 0;
    piece(r[k + n++], md.corps, MB, J0, KS, col.corps, POIL, 0).animal = nom;
    piece(r[k + n++], md.marbre, MB, J0, KS, col.marbre, POIL, 0).animal = nom;
    mPoint(J1, J0, MB, kv(VP, -md.longueur * .5 * sc, -.2 * sc, 0)); mFoisZ(M1, MB, k1(-ps.caudale));
    piece(r[k + n++], md.caudale, M1, J1, KS, col.caudale, POIL, 0).animal = nom;
    if (fx && ps.souffle > .02) {
      mPoint(J2, J0, MB, kv(VP, md.longueur * .3 * sc, 1.3 * sc, 0));
      const h = 3 + 4 * ps.souffle;
      fx.shape = 'sphere'; fx.p[0] = J2[0]; fx.p[1] = J2[1] + h * .5; fx.p[2] = J2[2]; fx.s[0] = 1.4 + ps.souffle * 1.6; fx.s[1] = h; fx.s[2] = fx.s[0];
      fx.r[0] = fx.r[1] = fx.r[2] = 0; fx.color[0] = .93; fx.color[1] = .95; fx.color[2] = .97; fx.alpha = .38 * Math.sin(Math.PI * Math.min(1, ps.souffle)); fx.mat = 7;
    } else if (fx) fx.alpha = 0;
    return n;
  }

  // ================================================================ relief exact et grille d'habitat
  // La pose interroge le triangle du décor qui porte l'animal. Chaque circuit fournit
  // son propre pas et sa diagonale (terrains organiques, tuiles urbaines et cols réels).
  function solExact(T, x, z) {
    if (!T.H) return T.sol(x, z);
    const fi = (x - T.x0) / T.pas, fj = (z - T.z0) / T.pas;
    const i = clamp(Math.floor(fi), 0, T.nx - 2), j = clamp(Math.floor(fj), 0, T.nz - 2);
    const u = clamp(fi - i, 0, 1), v = clamp(fj - j, 0, 1), k = j * T.nx + i;
    const a = T.H[k], b = T.H[k + 1], d = T.H[k + T.nx], e = T.H[k + T.nx + 1];
    if (T.alterne && ((i + j) & 1)) return u + v <= 1
      ? a + (b - a) * u + (d - a) * v : e + (d - e) * (1 - u) + (b - e) * (1 - v);
    return u >= v ? a + (b - a) * u + (e - b) * v : a + (e - d) * u + (d - a) * v;
  }

  // Grille de 4 m autour du tracé (jusqu'à 180 m de l'axe), calculée une fois au départ : distance à l'axe (exacte
  // jusqu'à 96 m, propagée au-delà par chanfrein), relief, pente, densité d'arbres, obstacles du décor (troncs, roches,
  // bâtiments, gradins) et deux zones interdites : l'enceinte des stands et les abords du tunnel. Une bête n'avance
  // que de case praticable en case praticable : elle ne peut pas atteindre la route ni son dégagement.
  const PORTEE_HABITAT = 180, R_EXACT = 96, MARGE_OBST = .7, OBST = 1, ENCEINTE = 2, TUNNEL = 4, DEGAGEMENT = 8, R_ENCEINTE = 140, R_TUNNEL = 70;
  const FORMES_DECOR = new Set(['box', 'cylinder', 'bevel', 'octa', 'sphere', 'wedge', 'ring']);
  function grille(c, decor) {
    const T = decor.maillageSol || { sol: decor.solRendu || decor.sol };
    let ax0 = Infinity, ax1 = -Infinity, az0 = Infinity, az1 = -Infinity;
    for (let i = 0; i < c.n; i++) { const x = c.x[i], z = c.z[i]; if (x < ax0) ax0 = x; if (x > ax1) ax1 = x; if (z < az0) az0 = z; if (z > az1) az1 = z; }
    const x0 = ax0 - PORTEE_HABITAT, z0 = az0 - PORTEE_HABITAT;
    const nx = Math.ceil((ax1 - ax0 + 2 * PORTEE_HABITAT) / CASE), nz = Math.ceil((az1 - az0 + 2 * PORTEE_HABITAT) / CASE), premier = new Int32Array(nz).fill(nx), fin = new Int32Array(nz);
    // Chaque ligne ne garde que le corridor utile. Sur une longue vallée en diagonale,
    // les cases de montagne très éloignées n'occupent plus un rectangle de plusieurs centaines de Mo.
    const rayonCases = Math.ceil(PORTEE_HABITAT / CASE) + 1;
    for (let s = 0; s < c.n; s++) {
      const i = Math.floor((c.x[s] - x0) / CASE), j = Math.floor((c.z[s] - z0) / CASE);
      const gauche = Math.max(0, i - rayonCases), droite = Math.min(nx, i + rayonCases + 1);
      for (let l = Math.max(0, j - rayonCases); l < Math.min(nz, j + rayonCases + 1); l++) {
        if (gauche < premier[l]) premier[l] = gauche;
        if (droite > fin[l]) fin[l] = droite;
      }
    }
    const lignes = new Int32Array(nz);
    let N = 0;
    for (let j = 0; j < nz; j++) {
      lignes[j] = N - premier[j];
      N += Math.max(0, fin[j] - premier[j]);
    }
    const d = new Float32Array(N).fill(1e10), bords = new Float32Array(N).fill(c.largeur / 2 || 5), h = new Float32Array(N), ny = new Uint8Array(N), arbres = new Uint8Array(N), drap = new Uint8Array(N);
    const G = { x0, z0, nx, nz, N, premier, fin, lignes, d, bords, h, ny, arbres, drap, T, eau: Number.isFinite(decor.niveauEau) ? decor.niveauEau : -1e5 };
    // Distance exacte aux échantillons de l'axe, tous les 2 m, jusqu'à 96 m ; bord du côté correspondant.
    const r = Math.ceil(R_EXACT / CASE), R2 = R_EXACT * R_EXACT;
    for (let s = 0; s < c.n; s++) {
      const px = c.x[s], pz = c.z[s], ci = Math.floor((px - x0) / CASE), cj = Math.floor((pz - z0) / CASE), sa = Math.sin(c.cap[s]), ca = Math.cos(c.cap[s]);
      for (let j = Math.max(0, cj - r), jn = Math.min(nz - 1, cj + r); j <= jn; j++) {
        const dz = z0 + (j + .5) * CASE - pz, dz2 = dz * dz, ligne = lignes[j];
        for (let i = Math.max(0, ci - r), in_ = Math.min(nx - 1, ci + r); i <= in_; i++) {
          const dx = x0 + (i + .5) * CASE - px, dd = dx * dx + dz2;
          if (dd < R2 && dd < d[ligne + i]) {
            d[ligne + i] = dd;
            const droite = -sa * dx + ca * dz >= 0;
            bords[ligne + i] = droite ? (c.largeurD ? c.largeurD[s] : c.largeur / 2 || 5) : (c.largeurG ? c.largeurG[s] : c.largeur / 2 || 5);
          }
        }
      }
    }
    for (let k = 0; k < N; k++) d[k] = d[k] < R2 ? Math.sqrt(d[k]) : 1e5;
    // Garde au-delà des limites réelles de conduite, sans distance arbitraire de 34 m à l'axe.
    // Le rayon de chaque animal ajoute sa propre marge dans praticable().
    for (let s = 0; s < c.n; s++) {
      const lim = Math.max(c.limiteG ? c.limiteG[s] : c.largeur / 2 || 5, c.limiteD ? c.limiteD[s] : c.largeur / 2 || 5) + GARDE_BORD + DEMI_CASE;
      if (lim <= D_MIN + DEMI_CASE) continue;
      const px = c.x[s], pz = c.z[s], ci = Math.floor((px - x0) / CASE), cj = Math.floor((pz - z0) / CASE), rr = Math.ceil(lim / CASE);
      for (let j = Math.max(0, cj - rr); j <= Math.min(nz - 1, cj + rr); j++) for (let i = Math.max(premier[j], ci - rr); i <= Math.min(fin[j] - 1, ci + rr); i++) {
        const dx = x0 + (i + .5) * CASE - px, dz = z0 + (j + .5) * CASE - pz;
        if (dx * dx + dz * dz < lim * lim) drap[lignes[j] + i] |= DEGAGEMENT;
      }
    }
    // au-delà : chanfrein en deux passes (erreur de quelques pour cent, sans effet sur les distances exactes)
    const W1 = CASE, W2 = CASE * Math.SQRT2;
    for (const sens of [1, -1]) {
      for (let j = sens === 1 ? 0 : nz - 1; j >= 0 && j < nz; j += sens) {
        const jm = j - sens, voisin = jm >= 0 && jm < nz;
        const debut = sens === 1 ? premier[j] : fin[j] - 1;
        for (let i = debut; i >= premier[j] && i < fin[j]; i += sens) {
          const k = lignes[j] + i;
          let v = d[k];
          if (i !== debut) v = Math.min(v, d[k - sens] + W1);
          if (voisin) {
            const km = lignes[jm] + i;
            if (i >= premier[jm] && i < fin[jm]) v = Math.min(v, d[km] + W1);
            if (i - 1 >= premier[jm] && i - 1 < fin[jm]) v = Math.min(v, d[km - 1] + W2);
            if (i + 1 >= premier[jm] && i + 1 < fin[jm]) v = Math.min(v, d[km + 1] + W2);
          }
          d[k] = v;
        }
      }
    }
    for (let j = 0; j < nz; j++) for (let i = premier[j]; i < fin[j]; i++) {
      const k = lignes[j] + i;
      if (d[k] <= PORTEE_HABITAT) h[k] = solExact(T, x0 + (i + .5) * CASE, z0 + (j + .5) * CASE);
    }
    // Pente à partir du sol échantillonné, sans nouveau sondage par case.
    for (let j = 0; j + 1 < nz; j++) for (let i = Math.max(premier[j], premier[j + 1]); i < Math.min(fin[j] - 1, fin[j + 1]); i++) {
      const k = lignes[j] + i, voisin = lignes[j + 1] + i;
      if (Math.max(d[k], d[k + 1], d[voisin]) > PORTEE_HABITAT) continue;
      ny[k] = Math.round(255 / Math.hypot(1, (h[k + 1] - h[k]) / CASE, (h[voisin] - h[k]) / CASE));
    }
    // obstacles posés au sol : boîtes tournées (bâtiments, gradins, murets, glissières), cylindres (troncs, piliers),
    // blocs (roches) ; ni les houppiers, ni les toits en hauteur, ni les marquages à plat
    const marquer = (cx, cz, rayon, ex, ez, angleY) => {
      const i0 = Math.max(0, Math.floor((cx - rayon - x0) / CASE)), i1 = Math.min(nx - 1, Math.floor((cx + rayon - x0) / CASE));
      const j0 = Math.max(0, Math.floor((cz - rayon - z0) / CASE)), j1 = Math.min(nz - 1, Math.floor((cz + rayon - z0) / CASE));
      const ca = Math.cos(angleY), sa = Math.sin(angleY);
      for (let j = j0; j <= j1; j++) for (let i = Math.max(i0, premier[j]); i <= Math.min(i1, fin[j] - 1); i++) {
        const dx = x0 + (i + .5) * CASE - cx, dz = z0 + (j + .5) * CASE - cz;
        if (ex < 0) { if (dx * dx + dz * dz > rayon * rayon) continue; }
        else if (Math.abs(dx * ca - dz * sa) > ex || Math.abs(dx * sa + dz * ca) > ez) continue;
        drap[lignes[j] + i] |= OBST;
      }
    };
    const m = MARGE_OBST + CASE * .5;
    for (const lot of decor.lots || []) for (const o of lot.objets || []) {
      if (!o || !(FORMES_DECOR.has(o.shape) || o.collision === 'roche' || typeof o.shape === 'string' && o.shape.startsWith('bitume-lieu-')) || o.mat === 11 || o.groundCover || !o.s || !o.p) continue;
      const sx = o.s[0], sz = o.s[2]; if (Math.max(sx, sz) < .35) continue;
      if (o.p[0] < x0 - 20 || o.p[2] < z0 - 20 || o.p[0] > x0 + nx * CASE + 20 || o.p[2] > z0 + nz * CASE + 20) continue;
      const sol = solExact(T, o.p[0], o.p[2]);
      if (o.p[1] - o.s[1] / 2 > sol + 2.2 || o.p[1] + o.s[1] / 2 < sol + .15) continue;
      if (o.shape === 'box' || o.shape === 'wedge') marquer(o.p[0], o.p[2], Math.hypot(sx, sz) / 2 + m, sx / 2 + m, sz / 2 + m, o.r ? o.r[1] || 0 : 0);
      else marquer(o.p[0], o.p[2], Math.max(sx, sz) / 2 + m, -1, -1, 0);
    }
    // densité d'arbres : troncs à moins de 24 m (le sanglier veut le couvert, la marmotte l'alpage ouvert)
    const ra = Math.ceil(24 / CASE);
    for (const t of decor.arbres || []) {
      const ci = Math.floor((t[0] - x0) / CASE), cj = Math.floor((t[1] - z0) / CASE);
      for (let j = Math.max(0, cj - ra); j <= Math.min(nz - 1, cj + ra); j++) for (let i = Math.max(premier[j], ci - ra); i <= Math.min(fin[j] - 1, ci + ra); i++) {
        if ((i - ci) * (i - ci) + (j - cj) * (j - cj) > ra * ra) continue;
        const k = lignes[j] + i; if (arbres[k] < 255) arbres[k]++;
      }
    }
    // zones interdites : enceinte des stands et des tribunes, abords et dessus du tunnel
    const L = c.longueur || c.n * (c.pas || 2), pasC = c.pas || L / c.n;
    const disque = (s, rayon, bit) => {
      const i = c.ouvert ? clamp(Math.round(s / pasC), 0, c.n - 1) : ((Math.round(s / pasC) % c.n) + c.n) % c.n, cx = c.x[i], cz = c.z[i], rr = Math.ceil(rayon / CASE);
      const ci = Math.floor((cx - x0) / CASE), cj = Math.floor((cz - z0) / CASE);
      for (let j = Math.max(0, cj - rr); j <= Math.min(nz - 1, cj + rr); j++) for (let ii = Math.max(0, ci - rr); ii <= Math.min(nx - 1, ci + rr); ii++) {
        const dx = x0 + (ii + .5) * CASE - cx, dz = z0 + (j + .5) * CASE - cz;
        if (dx * dx + dz * dz <= rayon * rayon) drap[lignes[j] + ii] |= bit;
      }
    };
    const enc = decor.enceinte || { debut: -160, fin: 310 };
    for (let s = enc.debut; s <= enc.fin; s += 8) disque((c.depart || 0) + s, R_ENCEINTE, ENCEINTE);
    for (const t of (B.couverts ? B.couverts.liste(c) : c.tunnel ? [c.tunnel] : [])) {
      const fin = t.debut + (B.couverts ? B.couverts.longueur(c, t) : t.fin - t.debut);
      for (let s = t.debut - 60; s <= fin + 60; s += 8) disque(s, R_TUNNEL, TUNNEL);
    }
    return G;
  }
  function cellule(G, x, z) {
    const i = Math.floor((x - G.x0) / CASE), j = Math.floor((z - G.z0) / CASE);
    return j < 0 || j >= G.nz || i < G.premier[j] || i >= G.fin[j] ? -1 : G.lignes[j] + i;
  }
  // Case praticable pour un habitat : hors obstacles et zones interdites, au-delà du vrai bord en tout point de la
  // case, pente et profondeur d'eau dans les bornes de l'espèce ; « strict » ajoute la densité d'arbres (choix du
  // domaine seulement : une bête traverse une clairière pour fuir).
  function praticable(G, hab, k, strict) {
    if (k < 0 || G.drap[k] || G.d[k] < Math.max(D_MIN, G.bords[k] + GARDE_BORD + (hab.marge || 2)) + DEMI_CASE) return false;
    if (hab.bande && G.d[k] - G.bords[k] > hab.bande - DEMI_CASE) return false;
    const n = G.ny[k] * (1 / 255);
    if (n < hab.ny[0] || n > hab.ny[1]) return false;
    const p = G.eau - G.h[k];
    if (p < hab.eau[0] || p > hab.eau[1]) return false;
    if (strict) { const a = G.arbres[k]; if (a < hab.arbres[0] || a > hab.arbres[1]) return false; }
    return true;
  }

  // ================================================================ temps propre : nuit et hasard
  // La nuit vient du moment choisi et de l'horloge de course, comme dans ambiance.js, sans en modifier l'état ; le
  // hasard est un générateur par groupe (mulberry32) dans un tableau typé : rien n'est tiré ailleurs.
  function nuitA(etat, t) {
    if (Number.isFinite(etat.nuitFixe)) return etat.nuitFixe;
    const m = etat.moment;
    if (m === 'jour') return 0; if (m === 'nuit') return 1; if (m === 'crepuscule') return .5;
    const D = (B.ambiance && B.ambiance.DUREE_CYCLE) || 360, el = Math.cos((Math.max(0, t) % D) * TAU / D);
    const x = clamp((el + .25) / .8, 0, 1); return 1 - x * x * (3 - 2 * x);
  }
  function alea(etat, g) {
    let t = (etat.graines[g] = (etat.graines[g] + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function generateur(graine) { // pour la création seulement (fermeture permise au départ)
    let a = graine >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const hacher = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  // ================================================================ création : groupes, membres, volants
  // Champs de pose interpolés entre deux pas du cerveau (cumulés pour le cycle des pattes et des ailes).
  const PX = 0, PZ = 1, PCAP = 2, PV = 3, PPHASE = 4, PCOU = 5, PREG = 6, PCOUCHE = 7, PDEB = 8, PENF = 9, PPATTE = 10, PALT = 11, PVOL = 12, PBAT = 13, PBATA = 14, PTANG = 15, PROUL = 16, NP = 17;
  // Champs du cerveau (non interpolés).
  const CACT = 0, CFIN = 1, CTX = 2, CTZ = 3, COX = 4, COZ = 5, CREG = 6, NC = 7;
  // État des groupes.
  const GETAT = 0, GTETAT = 1, GCALME = 2, GHAB = 3, GDMIN = 4, GDX = 5, GDZ = 6, GCX = 7, GCZ = 8, GRETOUR = 9, NG = 10;
  const CALME = 0, ALERTE = 1, FUITE = 2, REFUGE = 3, RETOUR = 4, NOMS_ETATS = Object.freeze(['calme', 'alerte', 'fuite', 'refuge', 'retour']);
  const BROUTER = 0, OBSERVER = 1, MARCHER = 2, COUCHER = 3, SENTINELLE = 4, REPOS = 5, TERRIER = 6;
  const AU_SOL = new Set(['troupeau', 'terrier', 'echassier', 'coureur']);
  const DEVIATIONS = new Float64Array([.5, -.5, 1, -1, 1.6, -1.6, 2.4, -2.4]);
  const FOULEES_OISEAU = Object.freeze([.45, .7, 1.1]);

  // Premier groupe de chaque espèce : d'abord dans la bande où le peloton le dérange (distance de fuite, bruit des
  // voitures lancées compris), pour que chaque biome montre au moins une fuite depuis la piste ; partout ensuite.
  function bandeDe(e, hab) {
    if (!(e.fuite > 0)) return null;
    // les échassiers fuient en vol : leur envol demande de la place côté piste (voir chercherRefuge)
    const d0 = e.famille === 'echassier' ? Math.max(hab.d[0], D_MIN + 10 + hab.rayon) : hab.d[0];
    return [d0, Math.max(d0 + 25, Math.min(hab.d[1], e.fuite * 1.45))];
  }
  function choisirDomaine(etat, e, cle, rnd, hab, bande, debut, fin) {
    const c = etat.c, G = etat.G;
    for (let essai = 0; essai < 700; essai++) {
      const relache = essai >= 450, hb = relache ? hab.relache : hab, serre = bande && essai < 300, b = serre ? bande : hab.d;
      const i = Math.floor(debut + rnd() * (fin - debut)), cote = rnd() < .5 ? -1 : 1;
      const bord = cote > 0 ? (c.largeurD ? c.largeurD[i] : c.largeur / 2 || 5) : (c.largeurG ? c.largeurG[i] : c.largeur / 2 || 5);
      const dist = bord + mix(b[0], b[1], Math.pow(rnd(), 1.6));
      const x = c.x[i] - Math.sin(c.cap[i]) * cote * dist, z = c.z[i] + Math.cos(c.cap[i]) * cote * dist, k = cellule(G, x, z);
      if (k < 0 || G.d[k] - G.bords[k] < b[0] || G.d[k] - G.bords[k] > b[1] || !praticable(G, hb, k, !relache)) continue;
      let bons = 0;
      for (let q = 0; q < 12; q++) { const a = q / 12 * TAU, rr = hab.rayon * (q & 1 ? .45 : .85); if (praticable(G, hb, cellule(G, x + Math.cos(a) * rr, z + Math.sin(a) * rr), false)) bons++; }
      if (bons < (hab.etroit ? 5 : 9)) continue; // les échassiers suivent une bande de rivage étroite
      let loin = true;
      for (const g of etat.groupes) { const dd = Math.hypot(g.hx - x, g.hz - z); if (dd < (g.cle === cle ? hab.espace : g.hr + hab.rayon + 25)) { loin = false; break; } }
      if (!loin) continue;
      // Préférer un pré ou un talus que le pilote voit depuis son approche.
      const derriere = i - Math.round(65 / c.pas);
      const j = c.ouvert ? Math.max(0, derriere) : (derriere + c.n) % c.n;
      const hauteur = G.h[k] + .55, oeil = c.y[j] + 1.25;
      let visible = true;
      for (let p = 1; p < 8; p++) {
        const u = p / 8;
        if (solExact(G.T, mix(c.x[j], x, u), mix(c.z[j], z, u)) > mix(oeil, hauteur, u)) { visible = false; break; }
      }
      if (visible) return { x, z, d: G.d[k], hab: hb, s: i * c.pas };
    }
    return null;
  }
  // Refuge : un point plus loin de la piste, atteignable en ligne droite par des cases praticables (en vol : sans
  // repasser au-dessus du dégagement) ; le bouquetin préfère monter, le sanglier rentrer sous les arbres.
  function chercherRefuge(etat, g) {
    const G = etat.G, hab = g.hab, vole = g.famille === 'echassier';
    if (g.famille === 'terrier') return null;
    const k0 = cellule(G, g.hx, g.hz), d0 = G.d[k0];
    let best = -1e9, bx = 0, bz = 0;
    for (let q = 0; q < 24; q++) {
      const a = q / 24 * TAU, ca = Math.cos(a), sa = Math.sin(a);
      for (const r of [16, 24, 36, 48]) {
        const x = g.hx + ca * r, z = g.hz + sa * r, k = cellule(G, x, z);
        if (!praticable(G, hab, k, false) || G.d[k] < d0 + 7) continue;
        let ok = true;
        // en vol, le groupe s'étale de part et d'autre de la ligne : la garde à l'axe compte sa largeur
        for (let s = 4; s < r && ok; s += 3) { const kk = cellule(G, g.hx + ca * s, g.hz + sa * s); ok = vole ? kk >= 0 && G.d[kk] >= D_MIN + 6 + g.hr && !(G.drap[kk] & (ENCEINTE | TUNNEL | DEGAGEMENT)) : praticable(G, hab, kk, false); }
        if (!ok) continue;
        let place = 0;
        for (let p = 0; p < 6; p++) { const b = p / 6 * TAU; if (praticable(G, hab, cellule(G, x + Math.cos(b) * g.hr * .6, z + Math.sin(b) * g.hr * .6), false)) place++; }
        if (place < 4) continue;
        let score = G.d[k] - d0 - .25 * r;
        if (g.e.habitat.monter) score += 1.5 * (G.h[k] - G.h[k0]);
        if (g.e.habitat.arbres[0] >= 4) score += .6 * Math.min(40, G.arbres[k]);
        if (score > best) { best = score; bx = x; bz = z; }
      }
    }
    return best > -1e9 ? [bx, bz] : null;
  }
  function relacher(h) {
    return Object.assign({}, h, { ny: [Math.max(.3, h.ny[0] - .08), 1], arbres: [0, 255], eau: h.eau[0] > 0 ? h.eau : [h.eau[0], h.eau[1]] });
  }
  function couleursMembre(e, saison, rnd, male, jeune) {
    const palettes = saison === 'hiver' && e.hiver ? e.hiver : e.couleurs;
    let p = palettes[Math.floor(rnd() * palettes.length)];
    if (jeune && e.jeunes && e.jeunes.couleurs) p = e.jeunes.couleurs;
    if (male && e.male && e.male.cou) p = Object.assign({}, p, { cou: e.male.cou });
    return p;
  }

  // Six champs au maximum : deux joueurs et leurs deux glaces. Copie numérique stable,
  // jamais de conservation d'une caméra temporaire qui sera réutilisée par le moteur.
  const NB_CHAMP = 16;
  function ecrireChamp(table, offset, contexte) {
    const cam = contexte && contexte.camera;
    if (!cam || !cam.pos || contexte.qualite === 'off' || !Number.isFinite(cam.pos[0] + cam.pos[1] + cam.pos[2])) return false;
    const yaw = Number(cam.yaw) || 0, pitch = Number(cam.pitch) || 0, roll = Number(cam.roll) || 0;
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch), sr = Math.sin(roll), cr = Math.cos(roll);
    table[offset] = cam.pos[0]; table[offset + 1] = cam.pos[1]; table[offset + 2] = cam.pos[2];
    table[offset + 3] = sy * cp; table[offset + 4] = sp; table[offset + 5] = -cy * cp;
    table[offset + 6] = cy * cr - sy * sp * sr; table[offset + 7] = cp * sr; table[offset + 8] = sy * cr + cy * sp * sr;
    table[offset + 9] = -cy * sr - sy * sp * cr; table[offset + 10] = cp * cr; table[offset + 11] = -sy * sr + cy * sp * cr;
    const tv = Math.tan(clamp(Number(cam.fov) || 60, 5, 150) * Math.PI / 360), aspect = contexte.aspect > 0 ? contexte.aspect : 16 / 9;
    table[offset + 12] = tv * aspect; table[offset + 13] = tv;
    table[offset + 14] = contexte.portee > 0 ? Math.min(12000, contexte.portee) : contexte.qualite === 'low' ? 180 : PORTEE_VUES;
    table[offset + 15] = contexte.hauteur > 0 ? contexte.hauteur * .5 / tv : 360 / tv;
    return true;
  }
  function dansChamp(table, offset, x, y, z, rayon) {
    const dx = x - table[offset], dy = y - table[offset + 1], dz = z - table[offset + 2];
    const profondeur = dx * table[offset + 3] + dy * table[offset + 4] + dz * table[offset + 5];
    if (profondeur < -rayon || profondeur > table[offset + 14] + rayon) return false;
    const horizontal = dx * table[offset + 6] + dy * table[offset + 7] + dz * table[offset + 8], th = table[offset + 12];
    if (Math.abs(horizontal) > profondeur * th + rayon * Math.sqrt(1 + th * th)) return false;
    const vertical = dx * table[offset + 9] + dy * table[offset + 10] + dz * table[offset + 11], tv = table[offset + 13];
    return Math.abs(vertical) <= profondeur * tv + rayon * Math.sqrt(1 + tv * tv);
  }
  function dansChamps(table, nombre, x, y, z, rayon) {
    for (let i = 0; i < nombre; i++) if (dansChamp(table, i * NB_CHAMP, x, y, z, rayon)) return true;
    return false;
  }
  function selectionnerVues(etat, vues, nombre = vues ? vues.length : 0) {
    if (!etat) return 0;
    const v = etat.visibilite; v.nombre = 0;
    for (let i = 0, n = Math.min(MAX_CHAMPS, nombre); i < n; i++)
      if (ecrireChamp(v.champs, v.nombre * NB_CHAMP, vues[i])) v.nombre++;
    v.stats.vues = v.nombre;
    return v.nombre;
  }
  function creer(c, decor, options = {}) {
    const t0 = (globalThis.performance && performance.now) ? performance.now() : 0;
    const theme = c.id === 'marseille' ? 'marseille' : BIOMES[c.theme] ? c.theme : 'foret', saison = (B.saisons && B.saisons.normaliser) ? B.saisons.normaliser(options.saison) : (options.saison || 'ete');
    const graine = ((options.graine === undefined ? (c.graine || 1) : options.graine) ^ hacher('animaux:' + theme)) >>> 0, rnd = generateur(graine);
    const etat = { c, theme, saison, moment: options.moment || 'jour', nuitFixe: options.nuit,
      G: grille(c, decor), groupes: [], volants: [], animaux: [], especes: [], absentes: [], k: 0, depart: true };
    const G = etat.G;
    const debutCourse = c.ouvert ? c.depart || 0 : 0;
    const finCourse = c.ouvert ? c.arrivee ?? c.longueur : c.longueur;
    const longueur = finCourse - debutCourse;
    const terrestres = BIOMES[theme].filter(cle => AU_SOL.has(ESPECES[cle].famille)
      && (!ESPECES[cle].saisons || ESPECES[cle].saisons.includes(saison)));
    // Un habitat par secteur de 155 m en moyenne, lorsqu'une espèce peut y vivre.
    // Les espèces alternent pour éviter qu'un troupeau unique peuple tout un versant.
    const rotations = Math.max(1, Math.round(longueur / (155 * Math.max(1, terrestres.length))));
    for (const cle of BIOMES[theme]) {
      const e = ESPECES[cle]; e.cle = cle;
      if (e.saisons && !e.saisons.includes(saison)) { etat.absentes.push({ cle, raison: 'saison' }); continue; }
      const md = MODELES[e.modele];
      if (AU_SOL.has(e.famille)) {
        const marge = Math.max(2, (md.rig ? md.rig.longueur * .5 : md.envergure ? md.envergure * .35 : 1) * (e.echelle || 1));
        const hab = Object.assign({}, e.habitat, { bande: BANDES_ABORDS[theme], marge,
          d: [GARDE_BORD + marge + DEMI_CASE + 4, BANDES_ABORDS[theme] - 6], rayon: Math.min(6, e.habitat.rayon), espace: Math.min(180, e.habitat.espace) });
        hab.relache = relacher(hab);
        let places = 0;
        const pasSecteur = longueur / (rotations * terrestres.length);
        for (let g = 0; g < rotations; g++) {
          const secteur = g * terrestres.length + terrestres.indexOf(cle);
          const debut = Math.min(c.n - 1, Math.floor((debutCourse + secteur * pasSecteur) / c.pas));
          const fin = Math.min(c.n, Math.ceil((debutCourse + (secteur + 1) * pasSecteur) / c.pas));
          const dom = choisirDomaine(etat, e, cle, rnd, hab, g === 0 ? bandeDe(e, hab) : null, debut, fin);
          if (!dom) continue;
          const n = Math.min(6, e.effectif[0] + Math.floor(rnd() * (e.effectif[1] - e.effectif[0] + 1)));
          const grp = { e, cle, md, famille: e.famille, hx: dom.x, hz: dom.z, s: dom.s, hr: hab.rayon, dAxe: dom.d, hab: dom.hab, rx: dom.x, rz: dom.z, refuge: false, debut: 0, n, index: etat.groupes.length,
            espacement: (e.famille === 'echassier' || e.famille === 'coureur' ? .9 : md.rig.longueur * .75) * (e.echelle || 1) };
          const ref = chercherRefuge(etat, grp);
          if (ref) { grp.rx = ref[0]; grp.rz = ref[1]; grp.refuge = true; }
          grp.dRefuge = Math.hypot(grp.rx - grp.hx, grp.rz - grp.hz);
          etat.groupes.push(grp); places++;
        }
        etat.especes.push({ cle, groupes: places });
        if (!places) etat.absentes.push({ cle, raison: 'habitat' });
      } else {
        const nombre = e.famille === 'migrateur' || e.famille === 'marin' ? 2 : Math.max(2, Math.round(longueur / 650));
        const v = placerVolants(etat, e, cle, md, nombre, rnd, debutCourse, finCourse);
        etat.especes.push({ cle, groupes: v });
        if (!v) etat.absentes.push({ cle, raison: 'habitat' });
      }
    }
    // membres : positions en tournesol autour du centre, sexe, âge, taille, robe ; activités décalées
    let total = 0;
    for (const g of etat.groupes) { g.debut = total; total += g.n; }
    etat.nAnimaux = total;
    etat.prec = new Float64Array(total * NP); etat.cour = new Float64Array(total * NP); etat.cer = new Float64Array(total * NC);
    etat.gs = new Float64Array(etat.groupes.length * NG); etat.graines = new Uint32Array(etat.groupes.length);
    for (const g of etat.groupes) {
      const e = g.e, o = g.index * NG, jeunes = e.jeunes && e.jeunes.saisons.includes(saison);
      etat.graines[g.index] = (graine ^ Math.imul(g.index + 1, 0x9E3779B1)) >>> 0;
      etat.gs[o + GHAB] = 1; etat.gs[o + GDMIN] = 1e9; etat.gs[o + GCX] = g.hx; etat.gs[o + GCZ] = g.hz; etat.gs[o + GRETOUR] = 16 + rnd() * 14;
      for (let m = 0; m < g.n; m++) {
        const a = g.debut + m, b = a * NP, cc = a * NC;
        const jeune = jeunes && m > 0 && rnd() < e.jeunes.part, male = !jeune && e.male ? (m === 0 || rnd() < e.male.part) : false;
        let echelle = mix(e.taille ? e.taille[0] : .95, e.taille ? e.taille[1] : 1.05, rnd()) * (e.echelle || 1);
        if (male) echelle *= e.male.echelle; if (jeune) echelle *= e.jeunes.echelle;
        // cornes : 0 aucune (femelles des cervidés et des moutons, jeunes, cerfs au printemps qui ont perdu leurs bois),
        // 1 celles du mâle, 2 celles de la femelle quand les deux sexes en portent
        let cornes = 0;
        if (e.cornes && !jeune) {
          if (male) cornes = e.male.sansBoisAu === saison ? 0 : 1;
          else if (e.cornesDeuxSexes) cornes = e.cornes.femelle && e.cornes.femelle !== e.cornes.taille ? 2 : 1;
          else if (!e.male) cornes = 1;
        }
        etat.animaux.push({ g: g.index, echelle, cornes, jeune, male, couleurs: couleursMembre(e, saison, rnd, male, jeune), graine: hasard(graine + a * 7919) });
        // place en tournesol (angle d'or), resserrée pour les jeunes qui collent aux mères
        let x = g.hx, z = g.hz;
        for (let essai = 0; essai < 12; essai++) {
          const rr = Math.min(g.hr * .9, g.espacement * 1.15 * Math.sqrt(m + .5 + essai * 3)), th = (m + essai * .37) * 2.39996 + rnd() * .4;
          const px = g.hx + Math.cos(th) * rr, pz = g.hz + Math.sin(th) * rr;
          if (praticable(G, g.hab, cellule(G, px, pz), false)) { x = px; z = pz; break; }
        }
        etat.cer[cc + COX] = x - g.hx; etat.cer[cc + COZ] = z - g.hz;
        etat.cour[b + PX] = x; etat.cour[b + PZ] = z; etat.cour[b + PCAP] = rnd() * TAU - Math.PI;
        etat.cour[b + PPHASE] = rnd(); etat.cour[b + PCOU] = -1;
        etat.cer[cc + CACT] = rnd() < .2 && g.famille === 'troupeau' ? COUCHER : BROUTER; etat.cer[cc + CFIN] = rnd() * 12;
        if (etat.cer[cc + CACT] === COUCHER) etat.cour[b + PCOUCHE] = 1;
        etat.cer[cc + CTX] = x; etat.cer[cc + CTZ] = z;
      }
    }
    etat.prec.set(etat.cour); etat.prec2 = etat.cour.slice();
    // état de départ gardé : une course reprise du début retrouve les mêmes bêtes aux mêmes places
    etat.initial = { cour: etat.cour.slice(), cer: etat.cer.slice(), gs: etat.gs.slice(), graines: etat.graines.slice() };
    // vues : réserves d'objets et tampons de tri, allouées une fois pour le palier le plus riche
    const entites = total + etat.volants.reduce((s, v) => s + v.n, 0);
    etat.nEntites = entites;
    etat.volParOiseau = new Uint16Array(entites - total);
    etat.volants.forEach((f, index) => etat.volParOiseau.fill(index, f.premier, f.premier + f.n));
    etat.vues = [];
    for (let v = 0; v < MAX_VUES; v++) etat.vues.push(creerVue(entites));
    etat.visibilite = { nombre: 0, champs: new Float64Array(MAX_CHAMPS * NB_CHAMP),
      actifs: new Uint8Array(etat.groupes.length), horloges: new Float64Array(etat.groupes.length),
      reveil: new Float64Array(etat.groupes.length).fill(-Infinity),
      stats: { vues: 0, groupesActifs: 0, groupesEndormis: etat.groupes.length, pasGroupes: 0, reveils: 0, posesPreparees: 0 } };
    etat.voit = new Float64Array(MAX_VOITURES * 3).fill(-1); etat.vitesseVoit = new Float64Array(MAX_VOITURES); etat.nVoit = 0;
    etat.dureeCreation = ((globalThis.performance && performance.now) ? performance.now() : 0) - t0;
    return etat;
  }
  function creerVue(entites) {
    const objets = [], fx = [];
    for (let i = 0; i < BUDGETS.ultra.objets; i++) objets.push(objetVide());
    for (let i = 0; i < 4; i++) { const o = objetVide(); o.fx = true; o.alpha = 0; o.mat = 7; o.shape = 'sphere'; fx.push(o); }
    return { champs: new Float64Array(3 * NB_CHAMP), objets, fx, px: new Float32Array(entites), dist: new Float32Array(entites), opacites: new Float32Array(entites), lod: new Uint8Array(entites), top: new Int32Array(BUDGETS.ultra.individus + 1),
      stats: { qualite: 'off', animaux: 0, proches: 0, moyens: 0, lointains: 0, objets: 0, horsChamp: 0, minuscules: 0, coupes: 0, triangles: 0 } };
  }

  // Volants : trajectoires fermées, fonctions du seul temps (planeurs en thermique, côtiers en boucle au-dessus de
  // l'eau, oies en V qui traversent le ciel, baleines qui sondent au large).
  function placerVolants(etat, e, cle, md, nG, rnd, debutCourse, finCourse) {
    const c = etat.c, G = etat.G;
    let places = 0;
    for (let g = 0; g < nG; g++) {
      const secteur = (finCourse - debutCourse) / nG;
      const point = () => Math.min(c.n - 1, Math.floor((debutCourse + (g + rnd()) * secteur) / c.pas));
      const n = Math.min(6, e.effectif[0] + Math.floor(rnd() * (e.effectif[1] - e.effectif[0] + 1)));
      const f = { e, cle, md, famille: e.famille, n, phase: rnd() * 1000, sens: rnd() < .5 ? -1 : 1, oiseaux: [] };
      if (e.famille === 'plane') {
        const i = point(), cote = rnd() < .5 ? -1 : 1, d = 22 + rnd() * 32;
        f.cx = c.x[i] - Math.sin(c.cap[i]) * cote * d; f.cz = c.z[i] + Math.cos(c.cap[i]) * cote * d;
        f.ax = 8 + rnd() * 14; f.az = 8 + rnd() * 14; f.wx = TAU / (220 + rnd() * 160); f.wz = TAU / (260 + rnd() * 160);
        f.h = e.altitude[0] + rnd() * (e.altitude[1] - e.altitude[0]); f.r = 16 + rnd() * 16; f.v = 9 + rnd() * 3;
        for (let k = 0; k < n; k++) f.oiseaux.push({ r: f.r * (.75 + .5 * rnd()), th: rnd() * TAU, dh: (rnd() - .5) * 20, ech: .94 + .12 * rnd(), flap: rnd() * 100 });
      } else if (e.famille === 'cotier' || e.famille === 'marin') {
        const marin = e.famille === 'marin';
        let trouve = null;
        for (let essai = 0; essai < 900 && !trouve; essai++) {
          const i = point(), cote = rnd() < .5 ? -1 : 1, d = marin ? 55 + rnd() * 65 : 24 + rnd() * 48;
          const x = c.x[i] - Math.sin(c.cap[i]) * cote * d, z = c.z[i] + Math.cos(c.cap[i]) * cote * d, k = cellule(G, x, z);
          if (k < 0 || G.eau - G.h[k] < (marin ? 12 : .6)) continue;
          const A = marin ? 22 + rnd() * 16 : 14 + rnd() * 14, Bm = marin ? 12 + rnd() * 8 : 7 + rnd() * 7, psi = c.cap[i];
          let ok = true;
          for (let q = 0; q < 16 && ok; q++) {
            const a = q / 16 * TAU, px = x + A * Math.cos(a) * Math.cos(psi) - Bm * Math.sin(a) * Math.sin(psi), pz = z + A * Math.cos(a) * Math.sin(psi) + Bm * Math.sin(a) * Math.cos(psi);
            const kk = cellule(G, px, pz);
            ok = kk >= 0 && G.d[kk] >= (marin ? 24 : 18) && (!marin || G.eau - G.h[kk] > 8);
          }
          if (ok) trouve = { x, z, A, B: Bm, psi };
        }
        if (!trouve) continue;
        Object.assign(f, { cx: trouve.x, cz: trouve.z, A: trouve.A, B: trouve.B, psi: trouve.psi, v: marin ? 1.6 : e.cle === 'pelican' ? 10 : 8.5, h: e.altitude ? e.altitude[0] + rnd() * (e.altitude[1] - e.altitude[0]) : 0 });
        f.periode = marin ? 48 + rnd() * 20 : 0;
        for (let k = 0; k < n; k++) f.oiseaux.push({ th: e.cle === 'pelican' ? -k * 8 / Math.max(1, trouve.A) : rnd() * TAU, dh: (rnd() - .5) * 6, ech: .94 + .12 * rnd(), flap: rnd() * 100 });
      } else if (e.famille === 'migrateur') {
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (let i = 0; i < c.n; i++) { x0 = Math.min(x0, c.x[i]); x1 = Math.max(x1, c.x[i]); z0 = Math.min(z0, c.z[i]); z1 = Math.max(z1, c.z[i]); }
        Object.assign(f, { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, D: Math.hypot(x1 - x0, z1 - z0) * .5 + 500, v: 14, periode: 170 + rnd() * 60, h: e.altitude[0] + rnd() * (e.altitude[1] - e.altitude[0]), graine: Math.floor(rnd() * 1e9), passe: -1, ang: .5, decal: .5 });
        for (let k = 0; k < n; k++) f.oiseaux.push({ rang: Math.ceil(k / 2), cote: k === 0 ? 0 : k & 1 ? 1 : -1, ech: .94 + .12 * rnd(), flap: rnd() * .3 });
      }
      f.premier = etat.volants.reduce((s, v) => s + v.n, 0);
      etat.volants.push(f); places++;
    }
    return places;
  }

  // ================================================================ cerveau : pas fixes de 0,1 s sur l'horloge de course
  // Appelé à chaque pas de simulation (1/120 s) avec l'horloge de course et les poses des voitures : il n'avance qu'aux
  // instants k × 0,1 s, quel que soit le nombre d'images affichées. Rien n'est alloué : tout vit dans des tableaux typés.
  const PA2 = [0, 0, 0, 0];
  function remettre(etat) {
    const I = etat.initial;
    etat.cour.set(I.cour); etat.prec.set(I.cour); etat.prec2.set(I.cour); etat.cer.set(I.cer); etat.gs.set(I.gs); etat.graines.set(I.graines);
    const v = etat.visibilite;
    if (v) { v.actifs.fill(0); v.horloges.fill(0); v.reveil.fill(-Infinity); v.stats.groupesActifs = v.stats.pasGroupes = v.stats.reveils = v.stats.posesPreparees = 0; v.stats.groupesEndormis = etat.groupes.length; }
  }
  // Nouvelle séance sur la même scène : jeu.js garde l'état avec le décor (la création coûte 12 à 90 ms dans la page,
  // une saccade entre deux courses de la démo). Les bêtes reprennent leurs places de départ et le moment suit la
  // séance : le résultat est celui de creer avec les mêmes options, sans rien rebâtir.
  function repartir(etat, options = {}) {
    if (!etat) return etat;
    remettre(etat);
    etat.moment = options.moment || 'jour'; etat.nuitFixe = options.nuit; etat.depart = true;
    return etat;
  }
  function pas(etat, temps, voitures) {
    if (!etat || !Number.isFinite(temps)) return;
    if (etat.depart || temps < etat.k * PAS - 1) { // départ, ou course reprise depuis le début : état initial
      if (!etat.depart) remettre(etat);
      etat.depart = false; etat.k = Math.floor(temps / PAS + 1e-7);
      lireVoitures(etat, voitures, false);
      return;
    }
    if (!etat.visibilite.nombre && temps >= (etat.k + 1) * PAS) {
      etat.k = Math.floor(temps / PAS + 1e-7); tick(etat, etat.k * PAS, voitures); return;
    }
    let n = 0;
    while (temps >= (etat.k + 1) * PAS - 1e-7 && n < 60) { etat.k++; tick(etat, etat.k * PAS, voitures); n++; }
    if (n === 60) { etat.k = Math.floor(temps / PAS + 1e-7); etat.prec.set(etat.cour); etat.prec2.set(etat.cour); }
  }
  function lireVoitures(etat, voitures, vitesse) {
    const nv = Math.min(voitures ? voitures.length : 0, MAX_VOITURES), V = etat.voit;
    for (let k = 0; k < nv; k++) {
      const p = voitures[k], o = k * 3;
      if (!p || !Number.isFinite(p.x)) { V[o + 2] = -1; etat.vitesseVoit[k] = 0; continue; }
      if (vitesse && V[o + 2] > 0) { const dx = p.x - V[o], dz = p.z - V[o + 1]; etat.vitesseVoit[k] = Math.sqrt(dx * dx + dz * dz) / PAS; }
      else etat.vitesseVoit[k] = 0;
      V[o] = p.x; V[o + 1] = p.z; V[o + 2] = 1;
    }
    etat.nVoit = nv;
  }
  function tick(etat, T, voitures) {
    const v = etat.visibilite, S = v.stats, G = etat.G;
    S.groupesActifs = 0;
    lireVoitures(etat, voitures, true);
    TK[1] = nuitA(etat, T);
    for (let g = 0; g < etat.groupes.length; g++) {
      const grp = etat.groupes[g], o = g * NG, x = etat.gs[o + GCX], z = etat.gs[o + GCZ], k = cellule(G, x, z);
      const y = k >= 0 ? G.h[k] : 0, rayon = grp.hr + 3;
      const actif = v.nombre && dansChamps(v.champs, v.nombre, x, y + 2, z, rayon);
      const debut = grp.debut * NP, fin = (grp.debut + grp.n) * NP;
      if (!actif) {
        // Un seul raccord à l'endormissement ; rien à simuler, ni terrain à sonder ensuite.
        if (v.actifs[g]) for (let j = debut; j < fin; j++) etat.prec2[j] = etat.prec[j] = etat.cour[j];
        v.actifs[g] = 0; continue;
      }
      S.groupesActifs++;
      if (!v.actifs[g]) { v.reveil[g] = T; S.reveils++; }
      v.actifs[g] = 1;
      for (let j = debut; j < fin; j++) { etat.prec2[j] = etat.prec[j]; etat.prec[j] = etat.cour[j]; }
      // L'horloge locale ne rattrape jamais les secondes passées hors champ.
      TK[0] = (v.horloges[g] += PAS); tickGroupe(etat, grp, g); S.pasGroupes++;
    }
    S.groupesEndormis = etat.groupes.length - S.groupesActifs;
  }

  const TK = new Float64Array(2);
  function tickGroupe(etat, grp, g) {
    const T = TK[0], e = grp.e, gs = etat.gs, o = g * NG, P = etat.cour;
    let cx = 0, cz = 0;
    for (let a = grp.debut; a < grp.debut + grp.n; a++) { cx += P[a * NP + PX]; cz += P[a * NP + PZ]; }
    cx /= grp.n; cz /= grp.n; gs[o + GCX] = cx; gs[o + GCZ] = cz;
    // danger : la voiture en mouvement la plus menaçante (une voiture arrêtée aux stands n'effraie plus). Les distances
    // d'alerte et de fuite des espèces valent pour un promeneur ; une monoplace lancée hurle : elle effraie d'une fois
    // et demie plus loin à 200 km/h (1,6 fois au-delà de 230 km/h), pas plus qu'un promeneur à l'allure des stands.
    let d2 = 1e18, dx = 0, dz = 0;
    for (let k = 0; k < etat.nVoit; k++) {
      const vit = etat.vitesseVoit[k];
      if (vit < 3 || etat.voit[k * 3 + 2] < 0) continue;
      const bruit = 1 + clamp((vit - 20) / 70, 0, .6), vx = etat.voit[k * 3] - cx, vz = etat.voit[k * 3 + 1] - cz, q = (vx * vx + vz * vz) / (bruit * bruit);
      if (q < d2) { d2 = q; dx = vx; dz = vz; }
    }
    const dmin = Math.sqrt(d2), dvraie = Math.sqrt(dx * dx + dz * dz); // dmin : distance ressentie
    gs[o + GDMIN] = dmin;
    if (dmin < 1e8 && dvraie > 1e-6) { gs[o + GDX] = dx / dvraie; gs[o + GDZ] = dz / dvraie; }
    // accoutumance : chaque fuite rapproche les seuils (jusqu'à 45 %), le calme les rétablit lentement
    const hab = gs[o + GHAB], alerte = e.alerte * hab, fuite = e.fuite * hab;
    if (dmin > alerte * 1.25) gs[o + GCALME] += PAS; else gs[o + GCALME] = 0;
    const calme = gs[o + GCALME], depuis = T - gs[o + GTETAT];
    let st = gs[o + GETAT], nouveau = -1;
    if (st === CALME) { if (dmin < fuite) nouveau = FUITE; else if (dmin < alerte) nouveau = ALERTE; else gs[o + GHAB] = Math.min(1, hab + PAS * .002); }
    else if (st === ALERTE) { if (dmin < fuite) nouveau = FUITE; else if (calme > 4) nouveau = CALME; }
    else if (st === FUITE) {
      const terrier = grp.famille === 'terrier', ex = cx - (terrier ? grp.hx : grp.rx), ez = cz - (terrier ? grp.hz : grp.rz);
      if (ex * ex + ez * ez < grp.hr * grp.hr * .3 || depuis > 30) nouveau = REFUGE;
    } else if (st === REFUGE) { if (calme > gs[o + GRETOUR]) nouveau = RETOUR; }
    else if (st === RETOUR) {
      if (dmin < fuite) nouveau = FUITE; else if (dmin < alerte) nouveau = ALERTE;
      // retour au pas (1,3 m/s) : le délai de garde suit la distance du refuge, sinon un troupeau dont le refuge est loin
      // redevenait calme à mi-chemin
      else { const ex = cx - grp.hx, ez = cz - grp.hz; if (ex * ex + ez * ez < grp.hr * grp.hr * .4 || depuis > 40 + grp.dRefuge) nouveau = CALME; }
    }
    if (nouveau >= 0) {
      if (nouveau === FUITE) { gs[o + GHAB] = Math.max(.45, hab * .86); gs[o + GRETOUR] = 16 + alea(etat, g) * 16; }
      st = nouveau; gs[o + GETAT] = nouveau; gs[o + GTETAT] = T;
    }
    for (let a = grp.debut; a < grp.debut + grp.n; a++) membre(etat, grp, g, a, st);
    separer(etat, grp);
  }

  // Activités au calme, tirées au hasard du groupe : brouter (tête au sol, petits pas), guetter, marcher vers un point
  // du domaine, se coucher, faire la sentinelle (marmotte dressée), se reposer sur une patte (flamant), rester au
  // terrier. La nuit couche les diurnes et réveille les sangliers ; le jour les sangliers dorment au couvert.
  function choisirActivite(etat, grp, g, a, auDomaine) {
    const T = TK[0], nuit = TK[1], zx = auDomaine ? grp.hx : grp.rx, zz = auDomaine ? grp.hz : grp.rz, e = grp.e, fam = grp.famille, C = etat.cer, c = a * NC, P = etat.cour, b = a * NP;
    let wB = .52, wO = .14, wM = .24, wC = .10, wR = 0;
    if (fam === 'echassier') { wB = .58; wO = .16; wM = .16; wC = 0; wR = e.unePatte || 0; }
    else if (fam === 'terrier') { wB = .55; wO = .25; wM = .2; wC = 0; }
    else if (fam === 'coureur') wC = .04;
    const sombre = nuit > .55;
    if (e.nuit === 'nocturne') { if (sombre) { wM *= 1.6; wC *= .4; } else { wC *= 4; wM *= .5; } }
    else if (sombre) { wC *= 4; wM *= .45; wR *= 2; }
    let act;
    if (fam === 'terrier' && sombre) act = TERRIER;
    else {
      let u = alea(etat, g) * (wB + wO + wM + wC + wR);
      act = (u -= wB) < 0 ? BROUTER : (u -= wO) < 0 ? OBSERVER : (u -= wM) < 0 ? MARCHER : (u -= wC) < 0 ? COUCHER : REPOS;
      if (fam === 'terrier' && a === grp.debut + Math.floor(T / 40) % grp.n && alea(etat, g) < .75) act = SENTINELLE;
    }
    const r = alea(etat, g);
    let duree = act === BROUTER ? 6 + 14 * r : act === OBSERVER ? 2 + 4 * r : act === MARCHER ? 22 : act === COUCHER ? 35 + 70 * r : act === SENTINELLE ? 10 + 15 * r : act === REPOS ? 20 + 40 * r : 30 + 40 * r;
    let tx = P[b + PX], tz = P[b + PZ];
    if (act === MARCHER) {
      let trouve = false;
      for (let essai = 0; essai < 4 && !trouve; essai++) {
        const an = alea(etat, g) * TAU, ra = grp.hr * Math.sqrt(alea(etat, g)), x = zx + Math.cos(an) * ra, z = zz + Math.sin(an) * ra;
        if (praticable(etat.G, grp.hab, cellule(etat.G, x, z), false)) { tx = x; tz = z; trouve = true; }
      }
      if (!trouve) { act = BROUTER; duree = 6; }
    }
    if (act === BROUTER) { // dérive lente vers l'avant, ramenée vers le centre du domaine si l'on s'en écarte
      const ex = zx - tx, ez = zz - tz, loin = ex * ex + ez * ez > grp.hr * grp.hr * .7;
      const cap = loin ? Math.atan2(ez, ex) : P[b + PCAP] + (alea(etat, g) - .5) * 1.4, l = 1.5 + 3 * alea(etat, g);
      tx += Math.cos(cap) * l; tz += Math.sin(cap) * l;
    }
    C[c + CACT] = act; C[c + CFIN] = T + duree; C[c + CTX] = tx; C[c + CTZ] = tz; C[c + CREG] = (alea(etat, g) - .5) * 1.8;
  }

  function membre(etat, grp, g, a, st) {
    const T = TK[0], nuit = TK[1], e = grp.e, fam = grp.famille, P = etat.cour, b = a * NP, C = etat.cer, c = a * NC, gs = etat.gs, o = g * NG, G = etat.G;
    let x = P[b + PX], z = P[b + PZ], cap = P[b + PCAP], v = P[b + PV];
    const vit = e.vitesses, dmin = gs[o + GDMIN], dirX = gs[o + GDX], dirZ = gs[o + GDZ];
    const versDanger = Math.atan2(dirZ, dirX), regDanger = -clamp(angle(versDanger - cap), -1.35, 1.35);
    const ox = C[c + COX], oz = C[c + COZ];
    let vV = 0, cible = false, tx = x, tz = z, couV = 0, regV = 0, coucheV = 0, debV = 0, enfV = 0, patteV = 0, volV = 0, capFixe = NaN;
    const auRefuge = st === REFUGE && T - gs[o + GTETAT] > 8;
    if (fam === 'terrier' && (st === FUITE || st === REFUGE)) { // course au terrier, puis on y reste
      tx = grp.hx + ox; tz = grp.hz + oz; cible = st === FUITE; vV = vit[2];
      const ex = tx - x, ez = tz - z;
      if (st === REFUGE || ex * ex + ez * ez < .5) { enfV = 1; vV = 0; cible = false; }
    } else if (st === CALME || auRefuge) {
      if (T >= C[c + CFIN]) choisirActivite(etat, grp, g, a, st === CALME);
      const act = C[c + CACT];
      tx = C[c + CTX]; tz = C[c + CTZ];
      if (act === BROUTER) { vV = fam === 'echassier' ? .2 : .15; cible = true; couV = -1; }
      else if (act === OBSERVER) { couV = .65; regV = C[c + CREG]; }
      else if (act === MARCHER) { vV = vit[0]; cible = true; couV = .15; }
      else if (act === COUCHER) { coucheV = 1; couV = .35; regV = C[c + CREG] * .5; }
      else if (act === SENTINELLE) { debV = 1; couV = .5; regV = Math.sin(T * .7 + a) * 1.1; }
      else if (act === REPOS) { patteV = 1; couV = .25; }
      else if (act === TERRIER) enfV = 1;
      if (auRefuge && couV < .3) couV = Math.max(couV, -.6); // encore méfiants : la tête se relève plus souvent
    } else if (st === ALERTE || st === REFUGE) {
      couV = 1; regV = regDanger;
      if (fam === 'terrier') debV = 1;
      coucheV = P[b + PCOUCHE] > .9 && (a & 1) ? 1 : 0; // certains restent couchés, tête haute
      if (fam === 'echassier' && st === ALERTE) { vV = vit[0] * .8; cible = true; tx = x - dirX * 8; tz = z - dirZ * 8; couV = .9; }
      else if (Math.abs(angle(versDanger - cap)) > 1.35 && !coucheV) capFixe = versDanger; // se retourner face au bruit
    } else if (st === FUITE) {
      couV = .55; cible = true; tx = grp.rx + ox * .8; tz = grp.rz + oz * .8;
      if (!praticable(G, grp.hab, cellule(G, tx, tz), false)) { tx = grp.rx; tz = grp.rz; } // le centre du refuge l'est toujours
      vV = dmin < e.fuite * 1.1 ? vit[2] : vit[1];
      if (fam === 'echassier' && grp.refuge) volV = 1;
    } else if (st === RETOUR) {
      cible = true; tx = grp.hx + ox; tz = grp.hz + oz; vV = vit[0] * 1.15; couV = .2;
      if (fam === 'echassier') { const ex = tx - x, ez = tz - z; if (ex * ex + ez * ez > 2500) volV = 1; }
    }
    let alt = P[b + PALT];
    if (fam === 'echassier' && (volV || alt > .02)) {
      // vol : cap vers la cible, montée à 11 m, descente à l'approche, posé quand on y est ; on ne se pose que sur une
      // case praticable (sinon la place du membre au domaine, ou le centre du refuge), jamais au hasard d'un changement
      // d'état en l'air
      if (!cible || !praticable(G, grp.hab, cellule(G, tx, tz), false)) {
        if (st === FUITE || st === REFUGE) { tx = grp.rx; tz = grp.rz; } else { tx = grp.hx + ox; tz = grp.hz + oz; }
      }
      const ex = tx - x, ez = tz - z, d = Math.sqrt(ex * ex + ez * ez);
      const capV = d > .5 ? Math.atan2(ez, ex) : cap, err = angle(capV - cap);
      cap = angle(cap + clamp(err, -1.2 * PAS, 1.2 * PAS));
      const vH = d < 3 && alt < .4 ? 0 : clamp(d * .45, 1.5, e.vol);
      v += clamp(vH - v, -3 * PAS, 4 * PAS); if (v < 0) v = 0;
      const nx = x + Math.cos(cap) * v * PAS, nz = z + Math.sin(cap) * v * PAS, solCible = cellule(G, nx, nz);
      // L'envol près de la piste reste du même côté. La courbe de braquage peut
      // déborder la ligne du refuge : elle doit elle aussi respecter le dégagement.
      if (solCible >= 0 && !(G.drap[solCible] & (ENCEINTE | TUNNEL | DEGAGEMENT)) &&
          G.d[solCible] >= G.bords[solCible] + GARDE_BORD + grp.hab.marge + DEMI_CASE &&
          G.d[solCible] - G.bords[solCible] <= grp.hab.bande - DEMI_CASE) { x = nx; z = nz; }
      else v = 0;
      const altV = d > 12 ? 11 : 0;
      alt += clamp(altV - alt, -1.7 * PAS, 2.4 * PAS); if (alt < 0) alt = 0;
      P[b + PBAT] += PAS * 2.6;
      P[b + PBATA] = alt < 3 && altV > alt ? .95 : altV > alt + .5 ? .85 : altV < alt - .5 ? (alt < 2 ? .7 : .2) : .55;
      P[b + PTANG] = altV > alt + .3 ? .18 : alt < 2.5 && altV < alt ? .32 : 0;
      P[b + PROUL] = clamp(err * 1.5, -.5, .5);
      if (alt === 0 && d < 4) { v = 0; volV = 0; }
      P[b + PALT] = alt; P[b + PVOL] = alt > .02 || volV ? 1 : 0;
      P[b + PCOU] += clamp(.8 - P[b + PCOU], -1.2 * PAS, 1.2 * PAS); P[b + PPATTE] = Math.max(0, P[b + PPATTE] - 2 * PAS);
      if (!P[b + PVOL]) { P[b + PTANG] = 0; P[b + PROUL] = 0; P[b + PBATA] = 0; }
      P[b + PX] = x; P[b + PZ] = z; P[b + PCAP] = cap; P[b + PV] = v; P[b + PPHASE] += v * PAS * .05;
      return;
    }
    // au sol : cap borné, vitesse bornée, pas contraint aux cases praticables (on longe l'obstacle, sinon on s'arrête)
    if (cible) {
      const ex = tx - x, ez = tz - z, d = Math.sqrt(ex * ex + ez * ez);
      if (d > .25) capFixe = Math.atan2(ez, ex); else vV = 0;
      vV = Math.min(vV, d * 1.5 + .05);
    }
    const debout = P[b + PDEB], couche = P[b + PCOUCHE];
    if (couche > .05 || P[b + PENF] > .3 || (debout > .3 && debV === 0 && st !== FUITE) || (debout > .3 && st === FUITE)) vV = 0; // se relever d'abord
    const err = Number.isNaN(capFixe) ? 0 : angle(capFixe - cap), w = (v > vit[1] ? 2.4 : 1.5) * PAS, dcap = couche > .3 ? 0 : clamp(err, -w, w);
    cap = angle(cap + dcap);
    if (Math.abs(err) > 1.2) vV *= .3;
    v += clamp(vV - v, -5 * PAS, (st === FUITE ? 8 : 2.5) * PAS); if (v < 0) v = 0;
    if (v > .005) {
      let nx = x + Math.cos(cap) * v * PAS, nz = z + Math.sin(cap) * v * PAS;
      if (!praticable(G, grp.hab, cellule(G, nx, nz), false)) {
        let trouve = false;
        for (let q = 0; q < DEVIATIONS.length && !trouve; q++) {
          const c2 = cap + DEVIATIONS[q], mx = x + Math.cos(c2) * v * PAS, mz = z + Math.sin(c2) * v * PAS;
          if (praticable(G, grp.hab, cellule(G, mx, mz), false)) { cap = angle(cap + DEVIATIONS[q] * .6); nx = mx; nz = mz; trouve = true; v *= .85; }
        }
        if (!trouve) { nx = x; nz = z; v = 0; if (st === CALME) C[c + CFIN] = T; }
      }
      x = nx; z = nz;
    }
    const f = e.foulees || FOULEES_OISEAU, al = poidsAllures(k1(v), vit, PA2);
    P[b + PPHASE] += v * PAS / ((al[0] + al[1]) * f[0] + al[2] * f[1] + al[3] * f[2]) + Math.abs(dcap) * (v < .2 ? .18 : 0);
    P[b + PCOU] += clamp(couV - P[b + PCOU], -1.2 * PAS, 1.2 * PAS);
    P[b + PREG] += clamp(regV - P[b + PREG], -2.2 * PAS, 2.2 * PAS);
    if (coucheV > couche) { if (v < .05) P[b + PCOUCHE] = Math.min(coucheV, couche + .45 * PAS); }
    else P[b + PCOUCHE] = Math.max(coucheV, couche - (st === FUITE ? 2.5 : .9) * PAS);
    P[b + PDEB] += clamp(debV - debout, -3 * PAS, 2 * PAS);
    P[b + PENF] += clamp(enfV - P[b + PENF], -1.5 * PAS, 3 * PAS);
    P[b + PPATTE] += clamp(patteV - P[b + PPATTE], -1.5 * PAS, .8 * PAS);
    P[b + PX] = x; P[b + PZ] = z; P[b + PCAP] = cap; P[b + PV] = v;
  }
  // Séparation dans le groupe : deux bêtes ne se traversent pas (déplacement seulement vers des cases praticables).
  function separer(etat, grp) {
    const P = etat.cour, G = etat.G, minD = grp.espacement;
    for (let i = grp.debut; i < grp.debut + grp.n; i++) {
      const bi = i * NP; if (P[bi + PENF] > .5 || P[bi + PALT] > .5) continue;
      for (let j = i + 1; j < grp.debut + grp.n; j++) {
        const bj = j * NP; if (P[bj + PENF] > .5 || P[bj + PALT] > .5) continue;
        const dx = P[bj + PX] - P[bi + PX], dz = P[bj + PZ] - P[bi + PZ], d2 = dx * dx + dz * dz;
        if (d2 >= minD * minD || d2 < 1e-10) continue;
        const d = Math.sqrt(d2), k = (minD - d) * .25 / d;
        const ix = P[bi + PX] - dx * k, iz = P[bi + PZ] - dz * k, jx = P[bj + PX] + dx * k, jz = P[bj + PZ] + dz * k;
        if (praticable(G, grp.hab, cellule(G, ix, iz), false)) { P[bi + PX] = ix; P[bi + PZ] = iz; }
        if (praticable(G, grp.hab, cellule(G, jx, jz), false)) { P[bj + PX] = jx; P[bj + PZ] = jz; }
      }
    }
  }

  // ================================================================ volants : pose en fonction du seul temps
  // Valeurs de l'image passées par tampon typé (voir KS) : IMG = alpha d'interpolation, temps, nuit, x et z de la
  // caméra, pluie. Hauteurs du sol lues par lots : PTS (x, z) → HTS, en un seul appel.
  const IMG = new Float64Array(6), PTS = new Float64Array(10), HTS = new Float64Array(5);
  function solPoints(T, n) { for (let q = 0; q < n; q++) HTS[q] = solExact(T, PTS[2 * q], PTS[2 * q + 1]); }
  // Rend faux quand la bête n'est pas à l'air (baleine en plongée, oies entre deux passages).
  function poseVolant(etat, f, k, t, ps) { IMG[1] = t; return poseVolantT(etat, f, k, ps); }
  function poseVolantT(etat, f, k, ps) {
    const e = f.e, ois = f.oiseaux[k], T = etat.G.T, eau = etat.G.eau, tt = IMG[1] + f.phase;
    ps.echelle = ois.ech * (e.echelle || 1); ps.vol = 1; ps.v = 10; ps.cou = .8; ps.regard = 0; ps.patte = 0; ps.couche = 0; ps.debout = 0; ps.enfoui = 0;
    ps.souffle = 0; ps.caudale = 0; ps.lueur = 0; ps.queue = 0; ps.cornes = 0; ps.phase = 0;
    if (f.famille === 'plane') { // spirale de thermique dont le centre dérive lentement sur le paysage
      const cx = f.cx + f.ax * Math.sin(f.wx * tt), cz = f.cz + f.az * Math.sin(f.wz * tt + 1.3);
      const th = ois.th + f.sens * f.v / ois.r * tt, x = cx + ois.r * Math.cos(th), z = cz + ois.r * Math.sin(th);
      PTS[0] = x; PTS[1] = z; PTS[2] = cx; PTS[3] = cz; solPoints(T, 2);
      ps.x = x; ps.z = z; ps.y = Math.max(HTS[0], HTS[1], eau) + f.h + ois.dh + 7 * Math.sin(.05 * tt + k);
      ps.cap = th + f.sens * Math.PI / 2; ps.roulis = f.sens * Math.atan(f.v * f.v / (9.81 * ois.r)) * .9; ps.tangage = .03 * Math.sin(.4 * tt + k);
      const flap = lisse(.9, .97, Math.sin(.11 * tt + ois.flap));
      ps.bat = .5 * flap; ps.battement = tt * 3.1; ps.diedre = (e.cle === 'urubu' ? .24 : e.cle === 'vautour' ? .16 : .1) - .08 * flap;
      return true;
    }
    if (f.famille === 'cotier' || f.famille === 'marin') { // boucle allongée au-dessus de l'eau, le long du rivage
      const rayon = Math.sqrt((f.A * f.A + f.B * f.B) / 2), th = ois.th + f.sens * f.v / rayon * tt;
      const ca = Math.cos(th), sa = Math.sin(th), cp = Math.cos(f.psi), sp = Math.sin(f.psi), lx = f.A * ca, lz = f.B * sa;
      ps.x = f.cx + lx * cp - lz * sp; ps.z = f.cz + lx * sp + lz * cp;
      const vx = (-f.A * sa * cp - f.B * ca * sp) * f.sens, vz = (-f.A * sa * sp + f.B * ca * cp) * f.sens;
      ps.cap = Math.atan2(vz, vx);
      const q = f.A * f.A * sa * sa + f.B * f.B * ca * ca, courbure = f.A * f.B / (q * Math.sqrt(q));
      if (f.famille === 'marin') { // respire en surface, souffle, sonde caudale levée, reste en bas le plus clair du temps
        const u = (tt % f.periode) / f.periode;
        ps.vol = 0; ps.roulis = 0;
        if (u < .14) { ps.y = eau - .45 + .12 * Math.sin(tt * 1.3); ps.tangage = .02 * Math.sin(tt); ps.souffle = u < .07 ? u / .07 : 0; }
        else if (u < .24) { const s = (u - .14) / .1; ps.tangage = -.42 * lisse(0, .6, s); ps.y = eau - .45 - 7 * s * s; ps.caudale = 1.1 * lisse(.2, .7, s); }
        else return false;
        return true;
      }
      const pelican = e.cle === 'pelican';
      PTS[0] = ps.x; PTS[1] = ps.z; solPoints(T, 1);
      ps.y = Math.max(eau, HTS[0]) + f.h + ois.dh * (pelican ? .2 : 1) + (pelican ? .5 * Math.sin(.4 * tt) : 4 * Math.sin(.3 * tt + k * 1.7));
      ps.roulis = f.sens * Math.atan(f.v * f.v * courbure / 9.81); ps.tangage = 0;
      ps.bat = pelican ? .6 * lisse(.3, .6, Math.sin(.55 * (tt + k * .35))) : Math.sin(.8 * tt + ois.flap) > 0 ? .7 : .08;
      ps.battement = tt * (pelican ? 1.9 : 3.4); ps.diedre = pelican ? .02 : .07;
      return true;
    }
    // migrateurs : un V traverse le ciel du circuit à chaque passage, sur une ligne tirée pour ce passage
    const passe = Math.floor(tt / f.periode), dist = f.v * (tt - passe * f.periode) - f.D;
    if (dist > f.D) return false;
    if (f.passe !== passe) { f.passe = passe; f.ang = hasard(f.graine + passe * 131) * TAU; f.decal = (hasard(f.graine + passe * 131 + 7) - .5) * f.D * .6; }
    const ang = f.ang, ca = Math.cos(ang), sa = Math.sin(ang), decal = f.decal;
    const lx = f.cx + ca * dist - sa * decal, lz = f.cz + sa * dist + ca * decal, back = -ois.rang * 4.6, lat = ois.cote * ois.rang * 3.4;
    ps.x = lx + ca * back - sa * lat; ps.z = lz + sa * back + ca * lat;
    PTS[0] = lx; PTS[1] = lz; solPoints(T, 1);
    ps.y = Math.max(HTS[0], eau) + f.h + ois.rang * .4 + .6 * Math.sin(tt * .7 + k);
    ps.cap = ang; ps.roulis = .03 * Math.sin(tt * .5 + k); ps.tangage = 0;
    ps.bat = .62; ps.battement = tt * 2.9 + ois.flap + ois.rang * .12; ps.diedre = .04;
    return true;
  }
  // Les rapaces ne chassent ni de nuit ni sous l'averse ; oies, pélicans et goélands rentrent à la nuit.
  function volantVisible(f) {
    const nuit = IMG[2], pluie = IMG[5];
    if (f.famille === 'plane') return nuit < .6 && pluie < .55;
    if (f.famille === 'migrateur' || f.e.cle === 'pelican') return nuit < .5;
    if (f.famille === 'cotier') return nuit < .7;
    return true;
  }

  // ================================================================ dessin
  const PS = { x: 0, y: 0, z: 0, cap: 0, tangage: 0, roulis: 0, echelle: 1, v: 0, phase: 0, cou: 0, regard: 0, couche: 0, debout: 0, enfoui: 0, queue: 0, lueur: 0,
    cornes: 0, vol: 0, alt: 0, battement: 0, bat: 0, diedre: 0, patte: 0, souffle: 0, caudale: 0 };
  const MAX_PIECES = [0, 1, 8, 18];
  const QUALITE_DE = Object.freeze({ off: 'off', low: 'low', medium: 'medium', high: 'high', ultra: 'ultra' });
  // Réglage du menu (faune : profil, off, low…) et palier graphique courant → palier des animaux. « Profil » suit le
  // palier : Légère (low) garde quelques animaux proches sous forme simplifiée.
  function qualite(reglage, palier) {
    if (reglage === 'off') return 'off';
    if (reglage === 'profil' || !QUALITE_DE[reglage]) return QUALITE_DE[palier] || 'medium';
    return reglage;
  }
  function poseSol(etat, A, Bc, i, ps) {
    const b = i * NP, an = etat.animaux[i], grp = etat.groupes[an.g], T = etat.G.T, t = IMG[0], temps = IMG[1], nuit = IMG[2], ex = IMG[3], ez = IMG[4];
    ps.x = A[b + PX] + (Bc[b + PX] - A[b + PX]) * t; ps.z = A[b + PZ] + (Bc[b + PZ] - A[b + PZ]) * t;
    ps.cap = A[b + PCAP] + angle(Bc[b + PCAP] - A[b + PCAP]) * t;
    ps.v = A[b + PV] + (Bc[b + PV] - A[b + PV]) * t; ps.phase = A[b + PPHASE] + (Bc[b + PPHASE] - A[b + PPHASE]) * t;
    ps.cou = A[b + PCOU] + (Bc[b + PCOU] - A[b + PCOU]) * t; ps.regard = A[b + PREG] + (Bc[b + PREG] - A[b + PREG]) * t;
    ps.couche = A[b + PCOUCHE] + (Bc[b + PCOUCHE] - A[b + PCOUCHE]) * t; ps.debout = A[b + PDEB] + (Bc[b + PDEB] - A[b + PDEB]) * t;
    ps.enfoui = (A[b + PENF] + (Bc[b + PENF] - A[b + PENF]) * t) * .45; ps.patte = A[b + PPATTE] + (Bc[b + PPATTE] - A[b + PPATTE]) * t;
    ps.alt = A[b + PALT] + (Bc[b + PALT] - A[b + PALT]) * t; ps.vol = ps.alt > .3 ? 1 : 0;
    ps.battement = A[b + PBAT] + (Bc[b + PBAT] - A[b + PBAT]) * t; ps.bat = A[b + PBATA] + (Bc[b + PBATA] - A[b + PBATA]) * t; ps.diedre = .05;
    ps.echelle = an.echelle; ps.cornes = an.cornes; ps.souffle = 0; ps.caudale = 0;
    if (ps.vol) {
      PTS[0] = ps.x; PTS[1] = ps.z; solPoints(T, 1);
      ps.y = HTS[0] + ps.alt; ps.tangage = A[b + PTANG] + (Bc[b + PTANG] - A[b + PTANG]) * t; ps.roulis = A[b + PROUL] + (Bc[b + PROUL] - A[b + PROUL]) * t;
    } else { // pente sous le corps : tangage et roulis bornés, le sol rendu reste sous les sabots
      const md = grp.md, L = (md.q ? md.q.L : md.o.corps.long) * an.echelle * .5, W = (md.q ? md.q.W : md.o.corps.rayon) * an.echelle * 1.2;
      const c = Math.cos(ps.cap), s = Math.sin(ps.cap);
      PTS[0] = ps.x; PTS[1] = ps.z; PTS[2] = ps.x + c * L; PTS[3] = ps.z + s * L; PTS[4] = ps.x - c * L; PTS[5] = ps.z - s * L;
      PTS[6] = ps.x - s * W; PTS[7] = ps.z + c * W; PTS[8] = ps.x + s * W; PTS[9] = ps.z - c * W; solPoints(T, 5);
      const hF = HTS[1], hB = HTS[2], hR = HTS[3], hL = HTS[4];
      ps.y = HTS[0]; ps.tangage = clamp(Math.atan2(hF - hB, 2 * L), -.45, .45); ps.roulis = clamp(Math.atan2(hL - hR, 2 * W), -.3, .3);
    }
    ps.queue = .38 * Math.sin(temps * (1.7 + an.graine) + an.graine * 40) * (1 - clamp(ps.v * .5, 0, 1));
    ps.lueur = 0;
    if (nuit > .4 && grp.md.q && grp.e.modele !== 'suide') { // tapis clair des yeux pris dans les phares
      const dx = ex - ps.x, dz = ez - ps.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < 140) { const f = Math.cos(Math.atan2(dz, dx) - (ps.cap - ps.regard)); if (f > 0) { const f2 = f * f; ps.lueur = lisse(.4, .8, nuit) * f2 * f2 * f2 * (1 - d / 140); } }
    }
  }
  // Affichage en retard d'un pas du cerveau et fonction du seul temps : entre les états j−1 et j, j = ⌊temps / PAS⌋.
  // L'horloge de simulation devance l'image d'au plus un pas de 1/120 s : quand le cerveau a déjà calculé l'état j+1,
  // on lit la paire précédente (sans elle, la bête ferait un double pas puis un arrêt à chaque dixième de seconde).
  const PAIRE = [null, null];
  function paireEtats(etat, temps) {
    let alpha = (temps - etat.k * PAS) / PAS;
    if (alpha < 0) { PAIRE[0] = etat.prec2; PAIRE[1] = etat.prec; alpha += 1; } else { PAIRE[0] = etat.prec; PAIRE[1] = etat.cour; }
    return clamp(alpha, 0, 1);
  }
  // Pose d'une bête au sol à l'instant `temps` (cadrage des captures, vérifications), sans rien dessiner.
  function poseAnimal(etat, i, temps, ps = {}) {
    if (!etat || !(i >= 0 && i < etat.nAnimaux)) return null;
    IMG[0] = paireEtats(etat, temps); IMG[1] = temps; IMG[2] = 0; IMG[3] = 0; IMG[4] = 0;
    poseSol(etat, PAIRE[0], PAIRE[1], i, ps);
    return ps;
  }
  function volantDe(etat, j) { // entité j (comptée après les bêtes au sol) → groupe volant
    return etat.volants[etat.volParOiseau[j]];
  }
  // Position analytique sommaire : aucune articulation ni interrogation du maillage.
  // Les cellules préchargées suffisent au rejet, la pose précise ne sera faite qu'après sélection.
  function positionVolantSimple(etat, f, k, temps, ps) {
    const o = f.oiseaux[k], tt = temps + f.phase, G = etat.G;
    if (f.famille === 'plane') {
      const cx = f.cx + f.ax * Math.sin(f.wx * tt), cz = f.cz + f.az * Math.sin(f.wz * tt + 1.3), a = o.th + f.sens * f.v / o.r * tt;
      ps.x = cx + o.r * Math.cos(a); ps.z = cz + o.r * Math.sin(a);
    } else if (f.famille === 'cotier' || f.famille === 'marin') {
      if (f.famille === 'marin' && (tt % f.periode) / f.periode >= .24) return false;
      const a = o.th + f.sens * f.v / Math.sqrt((f.A * f.A + f.B * f.B) / 2) * tt, ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(f.psi), sp = Math.sin(f.psi);
      ps.x = f.cx + f.A * ca * cp - f.B * sa * sp; ps.z = f.cz + f.A * ca * sp + f.B * sa * cp;
    } else {
      const passe = Math.floor(tt / f.periode), dist = f.v * (tt - passe * f.periode) - f.D;
      if (dist > f.D) return false;
      const a = hasard(f.graine + passe * 131) * TAU, ca = Math.cos(a), sa = Math.sin(a), decal = (hasard(f.graine + passe * 131 + 7) - .5) * f.D * .6;
      const back = -o.rang * 4.6, lat = o.cote * o.rang * 3.4;
      ps.x = f.cx + ca * dist - sa * decal + ca * back - sa * lat; ps.z = f.cz + sa * dist + ca * decal + sa * back + ca * lat;
    }
    const celluleSol = cellule(G, ps.x, ps.z), sol = celluleSol >= 0 ? G.h[celluleSol] : 0;
    ps.y = f.famille === 'marin' ? G.eau : Math.max(G.eau, sol) + f.h;
    ps.echelle = o.ech * (f.e.echelle || 1);
    return true;
  }
  // Garde au niveau `cible` les `budget` bêtes les plus grandes à l'écran ; les autres descendent d'un niveau.
  function garder(V, n, cible, nouveau, budget) {
    const px = V.px, lod = V.lod, top = V.top;
    let m = 0;
    for (let i = 0; i < n; i++) {
      if (lod[i] !== cible) continue;
      if (budget <= 0) { lod[i] = nouveau; continue; }
      if (m < budget) { let j = m++; while (j > 0 && px[top[j - 1]] < px[i]) { top[j] = top[j - 1]; j--; } top[j] = i; continue; }
      const dernier = top[m - 1];
      if (px[i] <= px[dernier]) { lod[i] = nouveau; continue; }
      lod[dernier] = nouveau;
      let j = m - 1; while (j > 0 && px[top[j - 1]] < px[i]) { top[j] = top[j - 1]; j--; } top[j] = i;
    }
  }
  // Une image d'une vue : taille à l'écran de chaque bête (px de haut), champ de vision, budgets du palier, puis poses
  // dans la réserve de la vue. vuesSecondaires contient les champs exacts des glaces réellement actives.
  // Le booléen historique arriere ne réactive plus la moitié arrière du monde.
  function dessiner(etat, temps, contexte, sortie) {
    if (!etat || !contexte || !sortie) return 0;
    const V = etat.vues[(contexte.vue | 0) % MAX_VUES], S = V.stats, q = QUALITE_DE[contexte.qualite] || 'off', bud = BUDGETS[q];
    S.qualite = q; S.animaux = S.proches = S.moyens = S.lointains = S.objets = S.horsChamp = S.minuscules = S.coupes = S.triangles = 0;
    if (!bud.objets || !contexte.camera || !contexte.camera.pos) return 0;
    const cam = contexte.camera, ex = cam.pos[0], ey = cam.pos[1], ez = cam.pos[2];
    const fov = clamp(Number.isFinite(cam.fov) ? cam.fov : 60, 5, 150) * Math.PI / 180, tanV = Math.tan(fov / 2);
    const hpx = contexte.hauteur > 0 ? contexte.hauteur : 720, aspect = contexte.aspect > 0 ? contexte.aspect : 16 / 9, focal = hpx * .5 / tanV;
    let nombreChamps = ecrireChamp(V.champs, 0, contexte) ? 1 : 0;
    const secondaires = contexte.vuesSecondaires;
    if (secondaires) for (let i = 0; i < Math.min(2, secondaires.length); i++)
      if (ecrireChamp(V.champs, nombreChamps * NB_CHAMP, secondaires[i])) nombreChamps++;
    const nuit = contexte.nuit || 0, pluie = contexte.pluie || 0, loinSeuls = bud.lointainsSeuls;
    const alpha = paireEtats(etat, temps), A = PAIRE[0], Bc = PAIRE[1];
    IMG[0] = alpha; IMG[1] = temps; IMG[2] = nuit; IMG[3] = ex; IMG[4] = ez; IMG[5] = pluie;
    const T = etat.G.T, nA = etat.nAnimaux, N = etat.nEntites, px = V.px, dist = V.dist, opacites = V.opacites, lod = V.lod;
    for (let i = 0; i < N; i++) {
      lod[i] = 0;
      let x, y, z, taille;
      if (i < nA) {
        const b = i * NP;
        if (Bc[b + PENF] > .97 && A[b + PENF] > .97) continue; // au terrier
        const an = etat.animaux[i], grp = etat.groupes[an.g];
        // En Légère aussi, les proches sont prioritaires.
        x = A[b + PX] + (Bc[b + PX] - A[b + PX]) * alpha; z = A[b + PZ] + (Bc[b + PZ] - A[b + PZ]) * alpha;
        const alt = A[b + PALT] + (Bc[b + PALT] - A[b + PALT]) * alpha;
        const celluleSol = cellule(etat.G, x, z); y = (celluleSol >= 0 ? etat.G.h[celluleSol] : 0) + alt;
        taille = (grp.md.rig ? grp.md.rig.hauteur : alt > .3 ? grp.md.envergure * .5 : grp.md.hauteur) * an.echelle;
      } else {
        const f = volantDe(etat, i - nA);
        if (!f || !volantVisible(f) || !positionVolantSimple(etat, f, i - nA - f.premier, temps, PS)) continue;
        x = PS.x; y = PS.y; z = PS.z; taille = (f.famille === 'marin' ? f.md.longueur * .3 : f.md.envergure * .5) * PS.echelle;
      }
      let p = 0, d = Infinity, principal = false, opacite = 0;
      const rayon = taille * 1.5 + (i < nA ? 1 : 12);
      for (let v = 0; v < nombreChamps; v++) {
        const o = v * NB_CHAMP;
        if (!dansChamp(V.champs, o, x, y + taille * .5, z, rayon)) continue;
        const dx = x - V.champs[o], dy = y - V.champs[o + 1], dz = z - V.champs[o + 2], dv = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
        // Fondu sur les 20 % finaux de chaque portée, avant le rejet spatial. L'union
        // garde l'opacité de la vue la plus utile, notamment lorsqu'une glace voit encore
        // l'animal proche. Aucun historique ni objet temporaire par animal et par image.
        const portee = V.champs[o + 14], fondu = clamp((portee - dv) / (portee * .2), 0, 1);
        opacite = Math.max(opacite, fondu * fondu * (3 - 2 * fondu));
        p = Math.max(p, taille * V.champs[o + 15] / dv); d = Math.min(d, dv); if (v === 0) principal = true;
      }
      if (!Number.isFinite(d) || opacite <= .004) { S.horsChamp++; continue; }
      if (p < bud.seuilMin) { S.minuscules++; continue; }
      px[i] = p; dist[i] = d; opacites[i] = opacite;
      lod[i] = loinSeuls ? 1 : p >= bud.seuilProche && principal ? 3 : p >= bud.seuilMoyen ? 2 : 1;
    }
    if (loinSeuls) garder(V, N, 1, 0, bud.individus);
    else { garder(V, N, 3, 2, bud.proches); garder(V, N, 2, 1, bud.moyens); garder(V, N, 1, 0, bud.individus); }
    const r = V.objets, maxObj = Math.min(bud.objets, r.length);
    let k = 0, kfx = 0;
    for (let i = 0; i < N; i++) {
      let L = lod[i];
      if (!L) continue;
      while (L > 1 && k + MAX_PIECES[L] > maxObj) L--;
      if (k + 1 > maxObj) { S.coupes++; continue; }
      let n = 0;
      const opacite = opacites[i];
      if (i < nA) {
        const an = etat.animaux[i], grp = etat.groupes[an.g];
        poseSol(etat, A, Bc, i, PS);
        n = grp.md.q ? poserQuadrupede(PS, grp.e, grp.md, L, r, k, an.couleurs) : poserOiseau(PS, grp.e, grp.md, L, r, k, an.couleurs);
      } else {
        const f = volantDe(etat, i - nA);
        poseVolantT(etat, f, i - nA - f.premier, PS);
        if (f.famille === 'marin') {
          const fxo = !loinSeuls && kfx < V.fx.length ? V.fx[kfx] : null; // Légère : la silhouette seule, sans souffle
          n = poserBaleine(PS, f.e, f.md, L, r, k, f.e.couleurs[0], fxo);
          if (fxo) fxo.alpha *= opacite;
          if (fxo && fxo.alpha > .003) { sortie.push(fxo); kfx++; }
        } else n = poserOiseau(PS, f.e, f.md, L, r, k, f.e.couleurs[0]);
      }
      etat.visibilite.stats.posesPreparees++;
      for (let j = k; j < k + n; j++) {
        const o = r[j];
        // FERRO 0.3.16 réduit la couverture dans la passe opaque : la matière,
        // le modelé et la profondeur restent ceux de l'animal pendant le fondu.
        // Restaurer tous les champs du pool, y compris au retour à pleine opacité.
        o.opacity = opacite; o.alpha = 1; o.fx = false; o.fxPriority = undefined;
        sortie.push(o); S.triangles += o.forme.triangles;
      }
      k += n; S.animaux++;
      if (L === 3) S.proches++; else if (L === 2) S.moyens++; else S.lointains++;
    }
    S.objets = k;
    return k;
  }

  // ================================================================ planche (outil de mise au point)
  // Toutes les espèces demandées en rang, dans les poses demandées, pour juger les modèles à l'œil dans le vrai
  // moteur. Hors course : la réserve n'est créée qu'au premier appel.
  let reservePlanche = null;
  function planche(sortie, o = {}) {
    if (!reservePlanche) { reservePlanche = []; for (let i = 0; i < 2000; i++) reservePlanche.push(objetVide()); }
    const liste = o.especes || Object.keys(ESPECES), poses = o.poses || ['repos'], lod = o.lod || 3, sol = o.sol || (() => o.y || 0);
    const cap = o.cap || 0, dirX = Math.cos(cap + Math.PI / 2), dirZ = Math.sin(cap + Math.PI / 2), t = o.temps || 0;
    let k = 0, pos = 0;
    for (const cle of liste) {
      const e = ESPECES[cle]; if (!e) continue; e.cle = cle;
      const md = MODELES[e.modele], large = md.longueur ? md.longueur * .4 : md.q ? md.q.L * 1.2 + .6 : md.envergure || 1;
      for (const p of poses) {
        const ech = (e.echelle || 1) * (o.echelle || 1);
        pos += large * ech * .5 + (o.ecart || 1.2);
        const x = (o.x || 0) + dirX * pos, z = (o.z || 0) + dirZ * pos;
        Object.assign(PS, { x, z, y: sol(x, z), cap, tangage: 0, roulis: 0, echelle: ech, v: 0, phase: t * .8, cou: 0, regard: 0, couche: 0, debout: 0, enfoui: 0, queue: .3 * Math.sin(t * 2),
          lueur: 0, cornes: e.cornes ? 1 : 0, vol: 0, alt: 0, battement: t * 3, bat: 0, diedre: .1, patte: 0, souffle: 0, caudale: 0 });
        if (p === 'broute') PS.cou = -1; else if (p === 'guet') { PS.cou = 1; PS.regard = .8; } else if (p === 'couche') PS.couche = 1;
        else if (p === 'marche' && e.vitesses) PS.v = e.vitesses[0]; else if (p === 'trot' && e.vitesses) PS.v = e.vitesses[1]; else if (p === 'galop' && e.vitesses) PS.v = e.vitesses[2];
        else if (p === 'debout') PS.debout = 1; else if (p === 'patte') PS.patte = 1; else if (p === 'femelle') PS.cornes = e.cornesDeuxSexes ? 2 : 0;
        else if ((p === 'vol' || p === 'bat') && md.o && md.o.aile) { PS.vol = 1; PS.y += 2.5; PS.bat = p === 'bat' ? .8 : 0; }
        else if (p === 'souffle') { PS.souffle = .6; } else if (p === 'sonde') { PS.tangage = -.35; PS.caudale = 1; }
        // les rapaces n'existent qu'en vol (aucune patte modelée) : toute pose les montre planant
        if (md.o && !md.o.pattes) { PS.vol = 1; PS.y += 2.5; }
        if (e.famille === 'marin' && Number.isFinite(o.eau)) PS.y = o.eau - .45;
        const couleurs = e.couleurs[0];
        let n;
        if (md.q) n = poserQuadrupede(PS, e, md, lod, reservePlanche, k, couleurs);
        else if (md.o) n = poserOiseau(PS, e, md, PS.vol && !md.o.aile ? 3 : lod, reservePlanche, k, couleurs);
        else n = poserBaleine(PS, e, md, lod, reservePlanche, k, couleurs, null);
        for (let j = k; j < k + n; j++) sortie.push(reservePlanche[j]);
        k += n; pos += large * ech * .5;
      }
    }
    return k;
  }

  function stats(etat, vue = 0) {
    if (!etat) return null;
    const etats = [0, 0, 0, 0, 0];
    for (let g = 0; g < etat.groupes.length; g++) etats[etat.gs[g * NG + GETAT]]++;
    return { theme: etat.theme, saison: etat.saison, especes: etat.especes.slice(), absentes: etat.absentes.slice(), groupes: etat.groupes.length,
      animaux: etat.nAnimaux, volants: etat.nEntites - etat.nAnimaux, refuges: etat.groupes.filter(g => g.refuge).length,
      etats: Object.fromEntries(NOMS_ETATS.map((n, k) => [n, etats[k]])), creationMs: etat.dureeCreation, vue: Object.assign({}, etat.vues[vue % MAX_VUES].stats),
      activite: Object.assign({}, etat.visibilite.stats), formes: FORMES.size, trianglesFormes, chargementMs: dureeChargement, cases: etat.G.N };
  }

  B.animaux = { PAS, MAX_VUES, D_MIN, QUALITES, BUDGETS, ESPECES, BIOMES, MODELES, FORMES, NOMS_ETATS, PIECES_MAX: MAX_PIECES,
    BANDES_ABORDS, GARDE_BORD, PORTEE_VUES, MAX_CHAMPS, selectionnerVues, creer, repartir, pas, dessiner, qualite, stats, planche, solExact, praticable, cellule, nuitA, poseVolant, poseAnimal,
    get trianglesFormes() { return trianglesFormes; }, dureeChargement };
})(globalThis.BITUME = globalThis.BITUME || {});
