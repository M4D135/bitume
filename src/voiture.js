/* BITUME — monoplace de 1980 dessinée d'après la Ferrari 312 T5 : cotes, silhouette et livrée rouge à détails blancs,
   sans nom, emblème ni marque de commanditaire. Primitives du moteur : vue extérieure, cockpit vu du siège, fantôme.
   Repère local : x vers l'avant, y vers le haut, z vers la droite ; origine au sol, au milieu de l'empattement. */
(function (B) {
  'use strict';

  // ---------------------------------------------------------------- matrices 3×3 (colonnes : images de x, y, z)
  function euler(rx, ry, rz) { // même ordre que le moteur : Rz·Ry·Rx
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    return [[cz * cy, sz * cy, -sy], [cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx], [cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx]];
  }
  const mul = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
  const mulM = (a, b) => [mul(a, b[0]), mul(a, b[1]), mul(a, b[2])];
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norme = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  function angles(m) {
    const b = -Math.asin(Math.max(-1, Math.min(1, m[0][2])));
    return [Math.atan2(m[1][2], m[2][2]), b, Math.atan2(m[0][1], m[0][0])];
  }
  // Repère direct dont l'axe y suit `axe` (cylindre, bras) : colonnes x, y, z.
  function selonAxe(axe) {
    const y = norme(axe), aide = Math.abs(y[1]) < .9 ? [0, 1, 0] : [1, 0, 0], x = norme(croix(y, aide));
    return [x, y, croix(x, y)];
  }
  // Attitude de la caisse : cap h (tangente (cos h, sin h) dans le plan x, z), tangage p (nez vers le haut positif),
  // roulis q (côté droit vers le bas positif). M = Ry(−h)·Rz(p)·Rx(q).
  function attitude(h, p, q) { return mulM(euler(0, -h, 0), mulM(euler(0, 0, p), euler(q, 0, 0))); }

  // Mêmes calculs sans tableau neuf, pour la pose de chaque image. Une matrice y est un Float64Array de neuf nombres,
  // colonne après colonne (m[c][r] → m[3c + r]). Les opérations et leur ordre sont exactement ceux de euler, mul, mulM
  // et angles : les objets de rendu reçoivent les mêmes nombres au bit près, zéros signés compris (atan2 en dépend).
  // Les fonctions appelées à chaque pose ne reçoivent ni ne rendent de nombre à virgule calculé : un appel que le
  // compilateur ne développe pas en ligne emballerait ce nombre dans un objet neuf. Il passe par un Float64Array.
  // euler(a, 0, 0), euler(0, a, 0) ou euler(0, 0, a) (axe 0, 1 ou 2), a = A[i], dans o : cos 0 vaut exactement 1 et
  // sin 0 exactement 0 ; les produits par 0 et 1 restent (ils gardent zéros signés et NaN).
  function eulerDe(o, A, i, axe) {
    const a = A[i], c = Math.cos(a), s = Math.sin(a);
    const cx = axe === 0 ? c : 1, sx = axe === 0 ? s : 0, cy = axe === 1 ? c : 1, sy = axe === 1 ? s : 0, cz = axe === 2 ? c : 1, sz = axe === 2 ? s : 0;
    o[0] = cz * cy; o[1] = sz * cy; o[2] = -sy;
    o[3] = cz * sy * sx - sz * cx; o[4] = sz * sy * sx + cz * cx; o[5] = cy * sx;
    o[6] = cz * sy * cx + sz * sx; o[7] = sz * sy * cx - cz * sx; o[8] = cy * cx;
    return o;
  }
  function produitDans(o, a, b) { // mulM(a, b) ; o n'est ni a ni b
    for (let c = 0; c < 9; c += 3) {
      const x = b[c], y = b[c + 1], z = b[c + 2];
      o[c] = a[0] * x + a[3] * y + a[6] * z; o[c + 1] = a[1] * x + a[4] * y + a[7] * z; o[c + 2] = a[2] * x + a[5] * y + a[8] * z;
    }
    return o;
  }
  function anglesDans(r, m) {
    r[0] = Math.atan2(m[5], m[8]); r[1] = -Math.asin(Math.max(-1, Math.min(1, m[2]))); r[2] = Math.atan2(m[1], m[0]);
    return r;
  }
  // angles(mulM(M, m)) : cinq cases du produit suffisent
  function anglesProduit(r, M, m) {
    const x = m[0], y = m[1], z = m[2];
    const a00 = M[0] * x + M[3] * y + M[6] * z, a01 = M[1] * x + M[4] * y + M[7] * z, a02 = M[2] * x + M[5] * y + M[8] * z;
    const a12 = M[2] * m[3] + M[5] * m[4] + M[8] * m[5], a22 = M[2] * m[6] + M[5] * m[7] + M[8] * m[8];
    r[0] = Math.atan2(a12, a22); r[1] = -Math.asin(Math.max(-1, Math.min(1, a02))); r[2] = Math.atan2(a01, a00);
    return r;
  }
  function anglesPiloteProduit(r, M, m) {
    anglesProduit(r, M, m);
    const a02 = M[2] * m[0] + M[5] * m[1] + M[8] * m[2];
    // Planche transverse : à ±90° de lacet, les deux atan2(0,0) perdaient sa pente de 25°.
    // Fixer un angle libre et retrouver l'autre garde la vraie matrice, y compris voiture retournée.
    if (Math.abs(a02) > 1 - 1e-12) {
      const a10 = M[0] * m[3] + M[3] * m[4] + M[6] * m[5], a11 = M[1] * m[3] + M[4] * m[4] + M[7] * m[5];
      r[0] = Math.atan2(-a02 * a10, a11); r[2] = 0;
    }
    return r;
  }
  const T_A = new Float64Array(9), T_B = new Float64Array(9), T_C = new Float64Array(9), T_D = new Float64Array(9), ANG = new Float64Array(3);
  // attitude(ev.cap, ev.tangage || 0, ev.roulis || 0), dans M
  function attitudeDans(M, ev) {
    ANG[0] = -ev.cap; ANG[1] = ev.tangage || 0; ANG[2] = ev.roulis || 0;
    return produitDans(M, eulerDe(T_A, ANG, 0, 1), produitDans(T_B, eulerDe(T_C, ANG, 1, 2), eulerDe(T_D, ANG, 2, 0)));
  }
  // p = P + mul(M, o) (P : ev.p)
  function monde(p, M, o, P) {
    const x = o[0], y = o[1], z = o[2];
    p[0] = P[0] + (M[0] * x + M[3] * y + M[6] * z); p[1] = P[1] + (M[1] * x + M[4] * y + M[7] * z); p[2] = P[2] + (M[2] * x + M[5] * y + M[8] * z);
    return p;
  }
  const aplatir = m => Float64Array.of(m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]);
  const memes = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  // vecteur de trois nombres réécrit en place (rangé d'emblée en nombres à virgule : aucune conversion à la première pose)
  const trois = () => { const v = [.5, .5, .5]; v[0] = 0; v[1] = 0; v[2] = 0; return v; };

  const ROUE_AXE = euler(Math.PI / 2, 0, 0);       // cylindre couché : son axe suit z (la droite de la voiture)
  const VERS_AVANT = euler(0, 0, -Math.PI / 2);    // cylindre dont l'axe suit x

  // ---------------------------------------------------------------- cotes de la 312 T5
  // Empattement 2,70 m, voies 1,70 m à l'avant et 1,615 m à l'arrière, longueur 4,53 m, largeur 2,12 m, hauteur 1,02 m.
  const EMPATTEMENT = 2.70, DEMI_VOIE_AV = .85, DEMI_VOIE_AR = .8075, JANTE_R = .165; // jantes de 13 pouces
  const ROUES = B.pneus ? B.pneus.ROUES : [
    { x: 1.35, z: -DEMI_VOIE_AV, r: .29, l: .28, avant: true }, { x: 1.35, z: DEMI_VOIE_AV, r: .29, l: .28, avant: true },
    { x: -1.35, z: -DEMI_VOIE_AR, r: .335, l: .46, avant: false }, { x: -1.35, z: DEMI_VOIE_AR, r: .335, l: .46, avant: false }
  ];

  const LAQUE = 16, PEINTURE = 17, MAT = 7, METAL_MAT = 0, TISSU = 18;
  // Le catalogue commun peut être absent des outils qui chargent seulement le modèle.
  const PNEUS_TYPES = B.pneus ? B.pneus.CATALOGUE : { slicks: { cercle: [.95, .76, .08] }, inter: { cercle: [.16, .72, .30] }, pluie: { cercle: [.16, .46, .90] }, neige: { cercle: [.82, .85, .89] } };
  const PNEU = [.035, .035, .04], FOND_JANTE = [.11, .11, .12], JANTE = [.32, .33, .34], NOIR = [.03, .03, .035],
    CARBONE = [.06, .065, .07], ARGENT = [.76, .77, .79], BLANC = [.95, .94, .9], GANT = [.9, .9, .87],
    ACIER = [.56, .57, .59], SOMBRE = [.17, .175, .19], IVOIRE = [.93, .92, .87];
  const VITESSE_FLOU = 30;   // m/s : au-delà, la rotation des roues ne se lit plus image par image

  // Braquage d'Ackermann : la roue intérieure au virage braque plus que l'extérieure. d > 0 : virage à droite.
  // Rend les angles des roues 0 (avant gauche) et 1 (avant droite).
  function braquages(d) {
    if (Math.abs(d) < 1e-5) return [d, d];
    const R = EMPATTEMENT / Math.tan(Math.abs(d));
    const interieur = Math.atan(EMPATTEMENT / (R - DEMI_VOIE_AV)), exterieur = Math.atan(EMPATTEMENT / (R + DEMI_VOIE_AV));
    return d > 0 ? [exterieur, interieur] : [-interieur, -exterieur];
  }

  // ---------------------------------------------------------------- carènes de la 312 T5
  // Volumes lisses bâtis une fois au chargement (src/carene.js) et enregistrés comme formes libres du moteur. Une pièce
  // de carène porte le centre et la taille de sa forme (repère de la voiture) ; sa couleur est celle de la livrée.
  const C = B.carene, FORMES = {};
  function forme(nom, triangles) {
    const n = C.normaliser(triangles), f = { nom: 'bitume-' + nom, centre: n.centre, taille: n.taille, triangles: n.triangles.length, tri: n.triangles };
    const R = globalThis.window && globalThis.window.FRender;
    if (R && R.forme) R.forme(f.nom, n.triangles);
    return (FORMES[nom] = f);
  }
  const deuxCotes = t => t.concat(C.miroir(t));
  // Pilotes (David, 16/11 : « pour les pilotes, les modèles d'EMPRISE pour le buste et la tête, c'est parfait ») :
  // tête et buste du personnage procédural d'EMPRISE (src/humain-donnees.js et src/humain-corps.js, copies exactes
  // du commit 509b2ec d'EMPRISE), assis dans la monoplace. Casque intégral : la tête lissée et agrandie, ouverte
  // devant les yeux ; visière teintée, et derrière elle le visage. Sans ces modules (tests Node), les primitives
  // d'avant restent.
  const HUMAIN = (() => {
    const R = globalThis.RADE, h = R && R.humanData, b = R && R.bodyData;
    if (!h || !b) return null;
    // EMPRISE (visage vers +z, y du sol) → voiture (avant +x, droite +z, y du sol de la voiture) : une rotation, l'ordre
    // des indices d'EMPRISE est gardé (sens direct vu de dehors, comme les carènes ; l'ordre 0, 2, 1 retournait les
    // faces et le pilote se voyait de l'intérieur)
    const rot = q => [q[2], q[1], -q[0]], place = q => [q[2], q[1] - .781, -q[0]];
    const normales = (pos, ids) => {
      const n = pos.map(() => [0, 0, 0]);
      for (let i = 0; i < ids.length; i += 3) {
        const [a, c, d] = [ids[i], ids[i + 1], ids[i + 2]], u = pos[c].map((v, k) => v - pos[a][k]), v = pos[d].map((x, k) => x - pos[a][k]);
        const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        for (const j of [a, c, d]) for (let k = 0; k < 3; k++) n[j][k] += f[k];
      }
      return n.map(x => { const l = Math.hypot(x[0], x[1], x[2]) || 1; return x.map(v => v / l); });
    };
    const triangles = (pos, nor, ids, garder, filtre = pos) => {
      const t = [];
      for (let i = 0; i < ids.length; i += 3) {
        const a = ids[i], c = ids[i + 1], d = ids[i + 2], f = filtre;
        if (garder && !garder((f[a][0] + f[c][0] + f[d][0]) / 3, (f[a][1] + f[c][1] + f[d][1]) / 3, (f[a][2] + f[c][2] + f[d][2]) / 3, b.materials && b.materials[a])) continue;
        t.push([place(pos[a]), place(pos[c]), place(pos[d]), rot(nor[a]), rot(nor[c]), rot(nor[d])]);
      }
      return t;
    };
    // Casque intégral : une coque ellipsoïdale autour de la tête d'EMPRISE (27,6 cm de large, 3 cm de jeu), ouverte au
    // cou ; l'ouverture de la visière suit la grille (bords nets), à hauteur des yeux (1,701), et un bandeau aux
    // couleurs de la voiture fait le tour au-dessus. Même sens des triangles que ceux d'EMPRISE, mesuré sur le crâne.
    const cy = 1.695, cz = .018, rx = .138, ry = .165, rz = .136, N = 36, OUVERT = 5.5;
    const NIVEAUX = [1.545, 1.575, 1.61, 1.64, 1.664, 1.703, 1.742, 1.776, 1.804, 1.826, 1.843, 1.853, cy + ry];
    const point = (y, k, f = 1) => {
      const c = Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)), a = k / N * 2 * Math.PI;
      return [rx * c * Math.sin(a) * f, cy + (y - cy) * f, cz + rz * c * Math.cos(a) * f];
    };
    const normaleE = q => { const n = [q[0] / rx ** 2, (q[1] - cy) / ry ** 2, (q[2] - cz) / rz ** 2], l = Math.hypot(...n) || 1; return n.map(v => v / l); };
    const croix = (A, C, D) => { const u = A.map((v, k) => C[k] - v), v = A.map((x, k) => D[k] - x); return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
    const crane = triangles(h.positions, h.normals, h.indices, (x, y) => y > 1.79)[0];
    const sens = Math.sign(croix(crane[0], crane[1], crane[2]).reduce((m, v, k) => m + v * crane[3][k], 0)) || 1;
    const coque = [], visiere = [], bande = [];
    for (let j = 0; j + 1 < NIVEAUX.length; j++) for (let k = 0; k < N; k++) {
      const y0 = NIVEAUX[j], y1 = NIVEAUX[j + 1], dk = Math.min(k, N - k - 1) + .5;   // 0 : face avant
      const ouvert = y0 >= 1.664 && y1 <= 1.742 && dk <= OUVERT, colore = y0 >= 1.742 && y1 <= 1.776;
      const f = ouvert ? 1.006 : 1, q = [point(y0, k, f), point(y0, k + 1, f), point(y1, k + 1, f), point(y1, k, f)];
      const dest = ouvert ? visiere : colore ? bande : coque;
      for (const [a, c, d] of [[0, 1, 2], [0, 2, 3]]) {
        let A = q[a], C = q[c], D = q[d];
        const m = [0, 1, 2].map(i => (A[i] + C[i] + D[i]) / 3);
        if (Math.sign(croix(place(A), place(C), place(D)).reduce((s, v, i) => s + v * rot(normaleE(m))[i], 0)) !== sens) [C, D] = [D, C];
        if (Math.hypot(...croix(A, C, D)) < 1e-12) continue;
        dest.push([place(A), place(C), place(D), rot(normaleE(A)), rot(normaleE(C)), rot(normaleE(D))]);
      }
    }
    return {
      casque: coque, visiere, bande,
      visage: triangles(h.positions, h.normals, h.indices, (x, y, z) => z > -.01 && y > 1.6),
      // Buste sans le bas des bras (ils pendaient hors de la coque) : sous l'épaule, seulement le torse. Les épaules
      // (63 cm d'EMPRISE) traversaient le jonc du cockpit, large de 44 cm (David, 16/11 : « le perso est en collision
      // avec le cockpit niveau épaule ») : au-delà de 16 cm de l'axe, le buste est resserré au quart ; 40 cm au plus.
      buste: (() => {
        const serre = b.positions.map(q => { const x = Math.abs(q[0]); return x > .16 ? [Math.sign(q[0]) * (.16 + (x - .16) * .25), q[1], q[2]] : q; });
        return triangles(serre, normales(serre, b.indices), b.indices, (x, y) => y > 1.2 && (Math.abs(x) < .19 || y > 1.38), b.positions);
      })()
    };
  })();
  if (HUMAIN) for (const nom of ['casque', 'visiere', 'bande', 'visage', 'buste']) if (HUMAIN[nom].length) forme('pilote-' + nom, HUMAIN[nom]);
  // Sections (x : abscisse, y0–y1 : bas et haut, l : demi-largeur, n : exposant), de l'avant vers l'arrière, mesurées
  // sur les photos de la voiture de 1980 (trois quarts avant de haut).
  // BITUME (voi-1) : la dernière section prolonge la quille sous les pontons ; sans elle, le flanc reste percé derrière la roue avant
  const S_QUILLE = [{ x: 2.16, y0: .12, y1: .22, l: .10, n: 3 }, { x: 1.60, y0: .10, y1: .30, l: .15, n: 3 }, { x: .95, y0: .10, y1: .34, l: .20, n: 4 }, { x: .58, y0: .10, y1: .36, l: .22, n: 4 }];
  const S_FLECHE = [{ x: 2.08, y0: .22, y1: .25, l: .04, n: 3 }, { x: 1.60, y0: .27, y1: .34, l: .26, n: 4 }, { x: 1.05, y0: .30, y1: .40, l: .52, n: 5 }, { x: .60, y0: .30, y1: .43, l: .72, n: 5 }];
  // pontons : ils s'arrondissent devant, sous la flèche, et se resserrent derrière, à l'intérieur des roues arrière
  const S_PONTONS = [{ x: .66, y0: .14, y1: .40, l: .66, n: 6 }, { x: .60, y0: .10, y1: .43, l: .72, n: 6 }, { x: -.40, y0: .10, y1: .45, l: .72, n: 6 },
    { x: -.88, y0: .10, y1: .45, l: .70, n: 6 }, { x: -1.08, y0: .12, y1: .43, l: .50, n: 5 }, { x: -1.30, y0: .16, y1: .40, l: .30, n: 4 }];
  const S_GOUTTE = [{ x: 1.30, y0: .36, y1: .40, l: .03, n: 2 }, { x: .90, y0: .38, y1: .54, l: .20, n: 2.5 }, { x: .55, y0: .38, y1: .63, l: .29, n: 3 },
    { x: .10, y0: .38, y1: .65, l: .31, n: 3 }, { x: -.35, y0: .40, y1: .66, l: .27, n: 3 }];
  const OUVERTURE = { de: .52, a: -.24, angle: 1.2 };
  const S_MOTEUR = [{ x: -.35, y0: .40, y1: .70, l: .30, n: 3 }, { x: -1.00, y0: .42, y1: .60, l: .34, n: 4 }, { x: -1.40, y0: .38, y1: .51, l: .31, n: 4 }];
  const S_BULLE = [{ x: .64, y0: .60, y1: .62, l: .05, n: 2 }, { x: .50, y0: .58, y1: .76, l: .22, n: 2.2 }, { x: .34, y0: .58, y1: .80, l: .27, n: 2.4 }, { x: .16, y0: .58, y1: .78, l: .29, n: 2.4 }];
  forme('quille', C.carene(S_QUILLE, { cotes: 16 }));
  forme('fleche', C.carene(S_FLECHE, { cotes: 28, pas: 5 }));
  forme('pontons', C.carene(S_PONTONS, { cotes: 28 }));
  // voi-6 : la bande suit la peau des pontons, décalée de 4 mm le long des normales (une carène à part, à
  // flancs presque droits, sortait jusqu'à 19 cm de la peau), coupée sous y0 + 0,07
  {
    const peau = C.carene(S_PONTONS.slice(1, 5), { cotes: 28, bouts: false }), decalee = [];
    for (const t of peau) {
      if ((t[0][1] + t[1][1] + t[2][1]) / 3 >= .17) continue;
      decalee.push([0, 1, 2].map(r => [0, 1, 2].map(k => t[r][k] + t[3 + r][k] * .004)).concat([0, 1, 2].map(r => t[3 + r])));
    }
    forme('bande', decalee);
  }
  {
    const exterieur = C.carene(S_GOUTTE, { cotes: 28, pas: 5, ouverture: OUVERTURE });
    forme('goutte', exterieur);
    forme('goutte-dedans', C.carene(S_GOUTTE, { cotes: 28, pas: 5, ouverture: OUVERTURE, interieur: true }).slice(exterieur.length));
    // jonc du bord de l'ouverture : il suit le bord gauche, l'arc arrière, le bord droit et l'arc avant de l'ouverture
    // (voi-4 : trois points par arc, sinon la corde de Catmull-Rom bombe hors de l'ouverture et passe sous la peau)
    const g = C.profil(S_GOUTTE), bord = [], w = OUVERTURE.angle / 2;
    for (let i = 0; i <= 6; i++) { const x = OUVERTURE.de + (OUVERTURE.a - OUVERTURE.de) * i / 6; bord.push(C.pointSection(g(x), Math.PI / 2 + w)); }
    for (let k = 1; k <= 3; k++) bord.push(C.pointSection(g(OUVERTURE.a), Math.PI / 2 + w - 2 * w * k / 4));
    for (let i = 6; i >= 0; i--) { const x = OUVERTURE.de + (OUVERTURE.a - OUVERTURE.de) * i / 6; bord.push(C.pointSection(g(x), Math.PI / 2 - w)); }
    for (let k = 1; k <= 3; k++) bord.push(C.pointSection(g(OUVERTURE.de), Math.PI / 2 - w + 2 * w * k / 4));
    forme('jonc', C.tube(bord, .012, { cotes: 8, ferme: true, pas: 3 }));
  }
  forme('moteur', C.carene(S_MOTEUR, { cotes: 24 }));
  forme('bulle', C.carene(S_BULLE, { cotes: 24, bouts: false, interieur: 'tout' }));
  // Le poste animé dispose d'un vrai dégagement devant le volant : le saute-vent se termine devant la jante,
  // pas au milieu des mains. La silhouette historique reste disponible pour les poses sans pilote animé.
  const S_BULLE_PILOTE = [{ x: .64, y0: .60, y1: .62, l: .05, n: 2 }, { x: .54, y0: .58, y1: .76, l: .22, n: 2.2 },
    { x: .43, y0: .58, y1: .80, l: .27, n: 2.4 }, { x: .37, y0: .58, y1: .78, l: .29, n: 2.4 }];
  forme('bulle-pilote', C.carene(S_BULLE_PILOTE, { cotes: 24, bouts: false, interieur: 'tout' }));
  {
    // filet de la seconde couleur au bord de la flèche, puis le long du flanc des pontons
    const f = C.profil(S_FLECHE), p = C.profil(S_PONTONS), ligne = [];
    for (let x = 2.04; x > .62; x -= .12) { const s = f(x); ligne.push([x, (s.y0 + s.y1) / 2, s.l + .002]); }
    for (const x of [.50, -.20, -.80]) ligne.push([x, .365, p(x).l + .002]);
    forme('filet', deuxCotes(C.tube(ligne, .008, { cotes: 6, pas: 2 })));
  }
  // rétroviseurs : boîtier profilé, glace vers l'arrière (x = 0,53), sur une patte fine fixée au flanc du carénage
  forme('retros', deuxCotes(C.carene([{ x: .61, y0: .560, y1: .575, l: .02, n: 2, z: .47 }, { x: .57, y0: .540, y1: .592, l: .072, n: 3, z: .47 }, { x: .53, y0: .538, y1: .594, l: .078, n: 4, z: .47 }], { cotes: 16, pas: 3 })
    .concat(C.tube([[.565, .53, .27], [.565, .55, .40]], .009, { cotes: 6 }))));
  // Rétroviseurs de la vue cockpit (David, 16/11 : « les deux rétros bien visibles et bien foutus »). Sur la vraie
  // voiture, les glaces sont à 30° du regard, au bord de l'image, et petites. En vue cockpit, elles viennent à 17° de
  // part et d'autre, entre la planche et les pneus avant qu'elles ne cachent pas, plus grandes, un peu tournées vers
  // le pilote ; la vue extérieure garde les rétroviseurs à leur place. Glace : centre (x, y, ±z), largeur l, hauteur
  // h, rotation vers le pilote.
  // David, 16/11 au soir : « plus bas un peu, plus petits, plus écrasés les rétros » (avant : y .665, 19 × 7,4 cm)
  const RETRO = { x: .64, y: .64, z: .29, l: .165, h: .05, angle: .12 };
  // repère d'une glace (k = −1 à gauche, 1 à droite) : centre, normale vers le pilote, droite de la glace, rotation
  function cadreGlace(k) {
    const a = k * RETRO.angle, w = [-Math.sin(a), 0, Math.cos(a)];
    return { k, c: [RETRO.x, RETRO.y, k * RETRO.z], n: [-Math.cos(a), 0, -Math.sin(a)], w, m: [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], w] };
  }
  // Coins des deux glaces dans le monde (haut gauche, haut droit, bas droit, bas gauche, vus du pilote), leur centre,
  // leur normale et leur droite : jeu.js y pose l'image réelle de la scène arrière. dest : le résultat d'un appel
  // précédent, réécrit en place (aucun tableau neuf par image) ; sans lui, un résultat neuf. Les coins dans le repère
  // de la voiture ne dépendent que de RETRO : calculés une fois.
  const GLACES = [-1, 1].map(k => {
    const g = cadreGlace(k), coin = (dz, dy) => g.c.map((v, i) => v + g.w[i] * dz + (i === 1 ? dy : 0) - g.n[i] * .0035), l = RETRO.l / 2, h = RETRO.h / 2;
    return { k, coins: [coin(-l, h), coin(l, h), coin(l, -h), coin(-l, -h)], c: g.c, n: g.n, w: g.w };
  });
  function tourne(o, M, v) { o[0] = M[0] * v[0] + M[3] * v[1] + M[6] * v[2]; o[1] = M[1] * v[0] + M[4] * v[1] + M[7] * v[2]; o[2] = M[2] * v[0] + M[5] * v[1] + M[8] * v[2]; return o; }
  function glacesCockpit(ev, dest) {
    const M = attitudeDans(MS, ev), P = ev.p;
    const glaces = dest || GLACES.map(G => ({ k: G.k, coins: [trois(), trois(), trois(), trois()], centre: trois(), normale: trois(), droite: trois() }));
    for (let i = 0; i < 2; i++) {
      const G = GLACES[i], q = glaces[i];
      q.k = G.k;
      for (let j = 0; j < 4; j++) monde(q.coins[j], M, G.coins[j], P);
      monde(q.centre, M, G.c, P); tourne(q.normale, M, G.n); tourne(q.droite, M, G.w);
    }
    return glaces;
  }
  // boîtier : face arrière autour de la glace (cadre de 8 mm), nez effilé vers l'avant
  { const h = RETRO.h / 2, l = RETRO.l / 2;
    forme('retro-boitier', C.carene([{ x: 0, y0: -h - .011, y1: h + .011, l: l + .017, n: 4.5 }, { x: .02, y0: -h - .013, y1: h + .013, l: l + .02, n: 4 },
      { x: .07, y0: -h, y1: h, l: l - .007, n: 3 }, { x: .118, y0: -.011, y1: .011, l: .03, n: 2 }], { cotes: 24, pas: 3 })); }
  {
    // suspension avant : basculeur supérieur noir, large à la coque et fin à la roue ; triangle inférieur et biellette
    const versZ = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
    forme('basculeurs', deuxCotes(C.transformer(C.carene([{ x: 0, y0: .325, y1: .365, l: .075, n: 4 }, { x: .43, y0: .330, y1: .350, l: .028, n: 3 }], { cotes: 12, pas: 2 }), versZ, [1.35, 0, .28])));
    // voi-7 : attaches intérieures posées sur la peau de la quille (demi-largeur ≈ 0,143 à x 1,52 et 0,167 à x 1,18, y 0,15)
    forme('triangles', deuxCotes([].concat(C.tube([[1.52, .15, .145], [1.35, .17, .71]], .011, { cotes: 6 }), C.tube([[1.18, .15, .17], [1.35, .17, .71]], .011, { cotes: 6 }),
      C.tube([[1.47, .29, .22], [1.45, .30, .70]], .008, { cotes: 6 }))));
  }
  // arceau de sécurité derrière le casque
  forme('arceau', C.tube([[-.28, .62, -.17], [-.27, .88, -.14], [-.265, .995, 0], [-.27, .88, .14], [-.28, .62, .17]], .015, { cotes: 8 }));
  // Arrière 312 T5 : photos Bonhams du châssis 046 (vues 65 et 79), références dans la fiche 12.
  // Boîte transversale près de l'essieu, carter terminal moulé, platines ajourées et QUATRE sorties creuses.
  // Chaque groupe de même matière est un seul maillage partagé par les douze livrées, construit ici une fois.
  {
    const carter = [
      { x: -1.35, y0: .18, y1: .40, l: .25, n: 3 }, { x: -1.52, y0: .16, y1: .41, l: .23, n: 3 },
      { x: -1.70, y0: .18, y1: .39, l: .18, n: 2.8 }, { x: -1.86, y0: .22, y1: .35, l: .10, n: 2.4 }
    ];
    forme('boite-transversale', C.carene([
      { x: -1.07, y0: .18, y1: .37, l: .28, n: 3 }, { x: -1.22, y0: .16, y1: .39, l: .34, n: 3 },
      { x: -1.40, y0: .18, y1: .39, l: .30, n: 3 }
    ], { cotes: 12, pas: 1 }));
    forme('carter-arriere', C.carene(carter, { cotes: 12, pas: 2 }));
    const nervures = [], profilCarter = C.profil(carter);
    for (const x of [-1.46, -1.56, -1.66, -1.76]) {
      const s = profilCarter(x), bord = Array.from({ length: 12 }, (_, i) => C.pointSection(s, i * Math.PI / 6));
      nervures.push(...C.tube(bord, .007, { cotes: 4, pas: 1, ferme: true }));
    }
    forme('nervures-boite', nervures);

    const bras = [], cardans = [], freins = [];
    const tube = (a, b, r = .012) => C.tube([a, b], r, { cotes: 6, pas: 1, bouts: false });
    // Triangles inférieurs et bras supérieurs, au lieu des quatre lattes rectangulaires.
    for (const [a, b] of [
      [[-1.10, .21, .25], [-1.35, .23, .59]], [[-1.67, .22, .155], [-1.35, .23, .59]],
      [[-1.30, .40, .26], [-1.35, .42, .59]], [[-1.62, .35, .17], [-1.46, .33, .59]]
    ]) bras.push(...tube(a, b));
    cardans.push(...tube([-1.35, .335, .24], [-1.35, .335, .59], .022));
    const disque = C.carene([{ x: -.012, y0: -.105, y1: .105, l: .105, n: 2 },
      { x: .012, y0: -.105, y1: .105, l: .105, n: 2 }], { cotes: 12, pas: 1 });
    freins.push(...C.transformer(disque, euler(0, -Math.PI / 2, 0), [-1.35, .335, .34]));
    forme('suspension-arriere', deuxCotes(bras));
    forme('cardans-arriere', deuxCotes(cardans));
    forme('freins-arriere', deuxCotes(freins));

    const face = (dest, a, b, c, n) => {
      const v = croix(b.map((x, i) => x - a[i]), c.map((x, i) => x - a[i]));
      dest.push(v.reduce((s, x, i) => s + x * n[i], 0) < 0 ? [a, c, b] : [a, b, c]);
    };
    // Deux platines en aluminium : le trou central est réellement ouvert, avec sa paroi intérieure.
    const platines = [], cy = .335, cz = .30;
    const contour = [[.45, .335], [.40, .42], [.30, .53], [.235, .40], [.16, .335], [.205, .25], [.30, .23], [.35, .28]];
    const anneau = (i, x, interieur) => {
      const a = i * Math.PI / 4, q = contour[i % 8];
      return interieur ? [x, cy + .035 * Math.sin(a), cz + .035 * Math.cos(a)] : [x, q[1], q[0]];
    };
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      for (const sens of [-1, 1]) {
        const x = -1.72 + sens * .009, a = anneau(i, x, false), b = anneau(j, x, false), c = anneau(j, x, true), d = anneau(i, x, true);
        face(platines, a, b, c, [sens, 0, 0]); face(platines, a, c, d, [sens, 0, 0]);
      }
      for (const interieur of [false, true]) {
        const a = anneau(i, -1.729, interieur), b = anneau(j, -1.729, interieur), c = anneau(j, -1.711, interieur), d = anneau(i, -1.711, interieur);
        const signe = interieur ? -1 : 1, n = [0, signe * ((a[1] + b[1]) / 2 - cy), signe * ((a[2] + b[2]) / 2 - cz)];
        face(platines, a, b, c, n); face(platines, a, c, d, n);
      }
    }
    forme('platines-arriere', deuxCotes(C.lisser(platines)));

    const dedans = [], levres = [];
    for (const [nom, points, rayon] of [
      ['hauts', [[-1.09, .32, .37], [-1.28, .53, .32], [-1.60, .54, .29], [-1.82, .54, .29], [-2.03, .54, .29]], .043],
      ['bas', [[-1.12, .18, .38], [-1.52, .16, .29], [-1.76, .16, .29], [-2.00, .16, .29]], .039]
    ]) {
      const options = { cotes: 10, pas: 2, bouts: false }, interieur = rayon - .005;
      forme('echappements-' + nom, deuxCotes(C.tube(points, rayon, options)));
      // Retourner la peau intérieure, normales comprises ; aucun disque ne bouche les quatre embouchures.
      const peau = C.tube(points, interieur, options);
      dedans.push(...peau.map(t => [t[0], t[2], t[1], t[3].map(v => -v), t[5].map(v => -v), t[4].map(v => -v)]));
      const fin = points[points.length - 1], precedent = points[points.length - 2];
      const axe = norme(fin.map((v, i) => v - precedent[i])), cadre = selonAxe(axe);
      const cercle = (i, r) => fin.map((v, k) => v + r * (cadre[0][k] * Math.cos(i * Math.PI / 5) + cadre[2][k] * Math.sin(i * Math.PI / 5)));
      for (let i = 0; i < 10; i++) {
        const a = cercle(i, rayon), b = cercle(i + 1, rayon), c = cercle(i + 1, interieur), d = cercle(i, interieur);
        face(levres, a, b, c, axe); face(levres, a, c, d, axe);
      }
    }
    forme('echappements-interieurs', deuxCotes(dedans));
    forme('echappements-levres', deuxCotes(C.lisser(levres)));

    // Plaques extrudées suivant z, contour convexe antihoraire : mât profilé et joues aux coins arrondis.
    const plaque = (points, z0, z1) => {
      const faces = [], p = (i, z) => [points[i][0], points[i][1], z];
      for (let i = 1; i < points.length - 1; i++) {
        faces.push([p(0, z0), p(i + 1, z0), p(i, z0)], [p(0, z1), p(i, z1), p(i + 1, z1)]);
      }
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        faces.push([p(i, z0), p(j, z0), p(j, z1)], [p(i, z0), p(j, z1), p(i, z1)]);
      }
      return C.lisser(faces);
    };
    forme('mat-aileron', plaque([[-1.89, .30], [-1.78, .36], [-1.95, .88], [-2.10, .88], [-2.05, .38]], -.018, .018));
    forme('derives-arriere', deuxCotes(plaque([[-1.87, .74], [-1.85, .78], [-1.85, 1.02], [-2.13, 1.02],
      [-2.23, .98], [-2.23, .79], [-2.20, .74], [-2.13, .72]], .55, .57)));
  }
  // version lointaine : trois carènes à huit côtés
  forme('loin-caisse', C.carene([{ x: 2.08, y0: .20, y1: .25, l: .05, n: 3 }, { x: 1.60, y0: .12, y1: .34, l: .26, n: 4 }, { x: 1.05, y0: .11, y1: .40, l: .52, n: 5 },
    { x: .60, y0: .10, y1: .43, l: .72, n: 5 }, { x: -.88, y0: .10, y1: .45, l: .70, n: 5 }, { x: -1.08, y0: .12, y1: .43, l: .50, n: 5 }, { x: -1.30, y0: .16, y1: .40, l: .30, n: 4 }], { cotes: 8, pas: 1 }));
  forme('loin-dessus', C.carene([S_GOUTTE[0], S_GOUTTE[2], S_GOUTTE[3], S_MOTEUR[0], S_MOTEUR[1], S_MOTEUR[2]], { cotes: 8, pas: 1 }));
  // Le niveau lointain garde lui aussi une cellule ouverte : son ancien dessus plein coupait les mains et les
  // avant-bras du pilote animé, même quand le modèle détaillé était dégagé. Même ouverture que la goutte proche.
  forme('loin-dessus-pilote', C.carene([S_GOUTTE[0], S_GOUTTE[2], S_GOUTTE[3], S_MOTEUR[0], S_MOTEUR[1], S_MOTEUR[2]],
    { cotes: 8, pas: 1, ouverture: OUVERTURE, interieur: true }));
  forme('loin-quille', C.carene(S_QUILLE, { cotes: 8, pas: 1 }));
  // Roues : formes partagées, préparées avant le moteur. Aucun cylindre générique du décor n'est alourdi.
  // L'axe local y traverse la jante. Le profil est annulaire : aucune face en éventail ne bouche le moyeu.
  const SEGMENTS_ROUE = Object.freeze([96, 64, 32, 16]);
  const LIMITES_ROUE_PIXELS = Object.freeze([Infinity, 360, 84, 20]);
  const ROUES_FORMES = { av: {}, ar: {} }, JANTES_FORMES = { av: {}, ar: {} };
  const MATIERES_PNEUS = { av: {}, ar: {} };
  function revolutionRoue(profil, segments, lisse = true) {
    const faces = [], n = profil.length;
    const tangente = (a, b) => { const y = b[0] - a[0], r = b[1] - a[1], h = Math.hypot(y, r); return [y / h, r / h]; };
    const directions = profil.map((p, i) => {
      const a = tangente(profil[(i + n - 1) % n], p), b = tangente(p, profil[(i + 1) % n]);
      const h = Math.hypot(a[0] + b[0], a[1] + b[1]);
      return [(a[0] + b[0]) / h, (a[1] + b[1]) / h];
    });
    const point = (p, j) => { const a = 2 * Math.PI * (j % segments) / segments; return [p[1] * Math.cos(a), p[0], p[1] * Math.sin(a)]; };
    const normale = (t, j) => { const a = 2 * Math.PI * (j % segments) / segments; return [t[0] * Math.cos(a), -t[1], t[0] * Math.sin(a)]; };
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n, t = tangente(profil[i], profil[k]), A = lisse ? directions[i] : t, D = lisse ? directions[k] : t;
      for (let j = 0; j < segments; j++) {
        const a = point(profil[i], j), b = point(profil[k], j), c = point(profil[k], j + 1), d = point(profil[i], j + 1);
        const na = normale(A, j), nb = normale(D, j), nc = normale(D, j + 1), nd = normale(A, j + 1);
        faces.push([a, b, c, na, nb, nc], [a, c, d, na, nc, nd]);
      }
    }
    return faces;
  }
  // Pavé courbe, avec ses quatre parois et son sommet à la vraie hauteur du pneu. Les fonds des rainures font
  // partie du profil de base ; pas de boîtes noires superposées ni de géométrie sous la surface qui scintille.
  function pavePneu(faces, r, profondeur, y0, y1, a0, a1, biais, pas) {
    const point = (a, y, rayon) => [rayon * Math.cos(a), y, rayon * Math.sin(a)];
    const normal = a => [Math.cos(a), 0, Math.sin(a)];
    const triangle = (a, b, c, dehors, na, nb, nc) => {
      const u = b.map((x, i) => x - a[i]), v = c.map((x, i) => x - a[i]);
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (n[0] * dehors[0] + n[1] * dehors[1] + n[2] * dehors[2] < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; n = n.map(x => -x); }
      const h = Math.hypot(...n); if (h < 1e-12) return;
      n = n.map(x => x / h); faces.push([a, b, c, na || n, nb || n, nc || n]);
    };
    const quad = (a, b, c, d, dehors) => { triangle(a, b, c, dehors); triangle(a, c, d, dehors); };
    for (let j = 0; j < pas; j++) {
      const t0 = a0 + (a1 - a0) * j / pas, t1 = a0 + (a1 - a0) * (j + 1) / pas;
      const a = point(t0, y0, r), b = point(t0 + biais, y1, r), c = point(t1 + biais, y1, r), d = point(t1, y0, r);
      const na = normal(t0), nb = normal(t0 + biais), nc = normal(t1 + biais), nd = normal(t1);
      triangle(a, b, c, normal((t0 + t1 + biais) / 2), na, nb, nc);
      triangle(a, c, d, normal((t0 + t1) / 2), na, nc, nd);
      quad(point(t0, y0, r - profondeur), a, d, point(t1, y0, r - profondeur), [0, -1, 0]);
      quad(b, point(t0 + biais, y1, r - profondeur), point(t1 + biais, y1, r - profondeur), c, [0, 1, 0]);
    }
    for (const [a, signe] of [[a0, -1], [a1, 1]]) quad(point(a, y0, r), point(a, y0, r - profondeur),
      point(a + biais, y1, r - profondeur), point(a + biais, y1, r), [-signe * Math.sin(a), 0, signe * Math.cos(a)]);
  }
  function pneu(r, w, segments, type) {
    const h = w / 2, b = h - .049, detail = segments >= 64, sculpte = detail && type !== 'slicks';
    const profondeur = sculpte ? type === 'neige' ? .009 : type === 'pluie' ? .007 : .004 : 0;
    // La peau lisse est découpée finement dans sa largeur pour porter des traces courbes. Les subdivisions
    // restent sur le même cylindre : aucune bosse, aucune surépaisseur, aucun pavé ajouté au slick neuf.
    const bande = [-1, -.78, -.43, -.16, .11, .39, .67, 1].map(f => [f * b, r - profondeur]);
    const profil = segments >= 64 ? [[-h, JANTE_R + .009], [-h, r - .060], [-h + .007, r - .036], [-h + .021, r - .014],
      [-h + .035, r - .003], [-b - .006, r], ...bande, [b + .006, r],
      [h - .035, r - .003], [h - .021, r - .014], [h - .007, r - .036], [h, r - .060], [h, JANTE_R + .009],
      [h - .009, JANTE_R + .005], [-h + .009, JANTE_R + .005]]
      : [[-h, JANTE_R + .009], [-h, r - .060], [-h + .013, r - .026], [-b, r], [b, r], [h - .013, r - .026],
        [h, r - .060], [h, JANTE_R + .009], [h - .009, JANTE_R + .005], [-h + .009, JANTE_R + .005]];
    const faces = revolutionRoue(profil, segments);
    if (!sculpte) return faces;
    const lignes = type === 'neige' ? 5 : type === 'pluie' ? 4 : 3;
    const repetitions = type === 'neige' ? 20 : type === 'pluie' ? 24 : 16, periode = 2 * Math.PI / repetitions;
    const canal = type === 'neige' ? .012 : type === 'pluie' ? .009 : .005, coupure = (type === 'neige' ? .018 : type === 'pluie' ? .012 : .006) / r;
    const largeur = 2 * b / lignes, lamelles = type === 'neige' && segments >= 96 ? 2 : 1;
    for (let ligne = 0; ligne < lignes; ligne++) {
      const y0 = -b + ligne * largeur + canal / 2, y1 = y0 + largeur - canal;
      const biais = (ligne < lignes / 2 ? 1 : -1) * periode * (type === 'inter' ? .36 : .2);
      for (let k = 0; k < repetitions; k++) for (let s = 0; s < lamelles; s++) {
        const debut = (k + (ligne % 2) * .22) * periode + coupure / 2, fin = debut + periode - coupure;
        const a0 = debut + (fin - debut) * s / lamelles + (s ? .0015 / r : 0);
        const a1 = debut + (fin - debut) * (s + 1) / lamelles;
        pavePneu(faces, r, profondeur, y0, y1, a0, a1, biais, Math.max(2, Math.ceil(segments / repetitions / lamelles)));
      }
    }
    return faces;
  }
  for (const [essieu, roue] of [['av', ROUES[0]], ['ar', ROUES[2]]]) {
    const { r, l: w } = roue, h = w / 2, f = JANTES_FORMES[essieu];
    const lointains = SEGMENTS_ROUE.map((segments, niveau) => niveau >= 2 ? forme('pneu-' + essieu + '-' + niveau, pneu(r, w, segments, 'slicks')) : null);
    for (const type of ['slicks', 'inter', 'pluie', 'neige']) ROUES_FORMES[essieu][type] = SEGMENTS_ROUE.map((segments, niveau) => lointains[niveau] ||
      forme('pneu-' + essieu + (type === 'slicks' && niveau === 0 ? '' : '-' + type + '-' + niveau), pneu(r, w, segments, type)));
    f.fut = SEGMENTS_ROUE.map((segments, n) => forme('jante-' + essieu + '-' + n, revolutionRoue([
      [-h - .005, .155], [-h - .004, .174], [-h + .006, .174], [-h + .013, .158],
      [h - .013, .158], [h - .006, .174], [h + .004, .174], [h + .005, .155]], segments)));
    f.rayons = SEGMENTS_ROUE.map((segments, n) => {
      const tris = [];
      for (const cote of [-1, 1]) for (let j = 0; j < 6; j++) {
        const a = 2 * Math.PI * j / 6, ca = Math.cos(a), sa = Math.sin(a);
        // Six branches moulées équilibrées : profil ovale et raccords galbés, sans lattes plates claires.
        const sections = [[.031, .012, .038, 0], [.052, .018, .034, .002], [.088, .014, .026, .004],
          [.125, .010, .020, .002], [.160, .014, .016, 0]].map(([x, l, creux, z]) =>
          ({ x, y0: cote * (h - creux) - .008, y1: cote * (h - creux) + .008, l, n: 2, z }));
        tris.push(...C.transformer(C.carene(sections, { cotes: n < 2 ? 8 : 6, pas: n < 2 ? 2 : 1 }), [[ca, 0, sa], [0, 1, 0], [-sa, 0, ca]]));
      }
      return forme('rayons-' + essieu + '-' + n, tris);
    });
    // Axe aminci dans l'ombre, écrous arrondis aux extrémités. Le cylindre argenté qui traversait toute
    // la largeur donnait une barre blanche dans le creux de la roue, particulièrement depuis le cockpit.
    f.moyeu = SEGMENTS_ROUE.map((segments, n) => forme('moyeu-roue-' + essieu + '-' + n, revolutionRoue([
      [-h - .010, .012], [-h - .010, .025], [-h - .006, .034], [-h + .007, .038], [-h + .025, .035],
      [-h + .037, .023], [h - .037, .023], [h - .025, .035], [h - .007, .038], [h + .006, .034],
      [h + .010, .025], [h + .010, .012]], [32, 24, 16, 12][n])));
    f.bague = SEGMENTS_ROUE.map((segments, n) => {
      const tris = [];
      for (const cote of [-1, 1]) {
        const y = cote * (h + .001), q = r - .073;
        tris.push(...revolutionRoue([[y - .0003, q - .004], [y - .0003, q], [y + .0003, q], [y + .0003, q - .004]], segments, false));
      }
      return forme('bague-pneu-' + essieu + '-' + n, tris);
    });
  }
  forme('valve-roue', C.carene([
    { x: -.007, y0: -.0025, y1: .0025, l: .0025, n: 2 },
    { x: -.004, y0: -.0045, y1: .0045, l: .0045, n: 2 },
    { x: .004, y0: -.0045, y1: .0045, l: .0045, n: 2 },
    { x: .007, y0: -.0025, y1: .0025, l: .0025, n: 2 }
  ], { cotes: 8, pas: 2 }));
  // 12D : les surfaces usées sont une partition des triangles d'origine. Ni décalque flottant, ni
  // seconde peau coplanaire : coordonnées, normales et diamètre restent strictement les mêmes.
  // Les quatre pièces gardent le même repère normalisé que le pneu entier, même si leur boîte est plus petite.
  function surfacePneu(nom, tri, reference) {
    const f = { nom: 'bitume-' + nom, centre: reference.centre, taille: reference.taille, triangles: tri.length, tri };
    const R = globalThis.window && globalThis.window.FRender;
    if (R && R.forme) R.forme(f.nom, tri);
    FORMES[nom] = f; return f;
  }
  for (const [essieu, w] of [['av', ROUES[0]], ['ar', ROUES[2]]]) {
    const b = w.l / 2 - .049;
    for (const type of ['slicks', 'inter', 'pluie', 'neige']) {
      const parties = [[], [], [], [], []], profondeur = type === 'neige' ? .009 : type === 'pluie' ? .007 : type === 'inter' ? .004 : 0;
      for (let niveau = 0; niveau < 2; niveau++) {
        const reference = ROUES_FORMES[essieu][type][niveau], groupes = [[], [], [], [], []];
        for (const tri of reference.tri) {
          const a = tri[0], c = tri[1], d = tri[2], x = (a[0] + c[0] + d[0]) / 3,
            y = (a[1] + c[1] + d[1]) * reference.taille[1] / 3, z = (a[2] + c[2] + d[2]) / 3;
          // Seulement la bande qui touche le sol ; les flancs et les parois des sculptures restent d'un bloc.
          const dessus = Math.abs(y) <= b + 1e-9 && tri.slice(0, 3).every(p =>
            Math.abs(Math.hypot(p[0] * reference.taille[0], p[2] * reference.taille[2]) - w.r) < 1e-8);
          const fond = profondeur > 0 && Math.abs(y) <= b + 1e-9 && tri.slice(0, 3).every(p =>
            Math.abs(Math.hypot(p[0] * reference.taille[0], p[2] * reference.taille[2]) - (w.r - profondeur)) < 1e-8);
          let groupe = 0;
          if (fond) groupe = 4;
          else if (dessus) {
            // Champ continu autour du pneu, gauchi dans la largeur : pas de damier secteur × voie ni de
            // répétition en miroir. Calculé une fois au chargement, il reste fixe dans le caoutchouc qui tourne.
            const angle = Math.atan2(z, x), travers = y / b, phase = essieu === 'av' ? .73 : 2.17;
            const grain = Math.sin(3 * angle + phase + 2.1 * travers)
              + .48 * Math.sin(7 * angle - 5.3 * travers + 2 * phase)
              + .22 * Math.cos(13 * angle + 3 * travers + 3 * phase);
            groupe = grain < -.38 ? 1 : grain > .42 ? 3 : 2;
          }
          groupes[groupe].push(tri);
        }
        for (let j = 0; j < (profondeur > 0 ? 5 : 4); j++) parties[j].push(surfacePneu(
          (j === 4 ? 'fond-sculpture-' : 'matiere-pneu-') + essieu + '-' + type + '-' + j + '-' + niveau, groupes[j], reference));
      }
      MATIERES_PNEUS[essieu][type] = parties;
    }
  }
  const DISQUES_ROUE = SEGMENTS_ROUE.map((segments, n) => forme('disque-roue-' + n,
    revolutionRoue([[-.008, .045], [-.008, .135], [.008, .135], [.008, .045]], segments, false)));
  // Habitacle de la vue cockpit. L'œil du cockpit est plus bas et plus en arrière que celui du pilote : la goutte de la
  // vue extérieure boucherait la vue. À sa place, deux épaules galbées qui montent des coins du bas vers la planche et
  // se rejoignent devant elle, un dôme devant la planche, une cuve sombre entre les épaules, un saute-vent en arc.
  const S_EPAULE = [{ x: -.40, y0: .30, y1: .60, l: .10, n: 3, z: .30 }, { x: .00, y0: .30, y1: .62, l: .10, n: 3, z: .28 },
    { x: .30, y0: .32, y1: .64, l: .10, n: 3, z: .22 }, { x: .55, y0: .36, y1: .64, l: .08, n: 3, z: .14 }, { x: .75, y0: .40, y1: .60, l: .05, n: 3, z: .08 }];
  forme('epaules', deuxCotes(C.carene(S_EPAULE, { cotes: 24 })));
  // flanc intérieur sombre sous le jonc : l'épaule n'est rouge que dessus et dehors
  forme('flancs', deuxCotes(C.carene(S_EPAULE.map(sc => Object.assign({}, sc, { z: sc.z - .03, l: sc.l * .75, y1: sc.y1 - .035 })), { cotes: 16 })));
  {
    const e = C.profil(S_EPAULE), bord = [];
    for (let x = -.30; x <= .70; x += .1) bord.push(C.pointSection(e(x), 2.25));
    forme('epaules-jonc', deuxCotes(C.tube(bord, .008, { cotes: 8, pas: 3 })));
  }
  forme('dome', C.carene([{ x: .40, y0: .40, y1: .60, l: .14, n: 2.5 }, { x: .70, y0: .40, y1: .645, l: .19, n: 2.5 }, { x: 1.00, y0: .40, y1: .58, l: .17, n: 2.5 }, { x: 1.30, y0: .38, y1: .42, l: .04, n: 2.5 }], { cotes: 28 }));
  forme('cuve', C.carene([{ x: -.45, y0: .12, y1: .48, l: .26, n: 4 }, { x: .30, y0: .12, y1: .48, l: .22, n: 4 }, { x: .80, y0: .15, y1: .47, l: .10, n: 3 }], { cotes: 16 }));
  {
    // saute-vent : ruban mince en arc devant l'ouverture, vu des deux côtés, et son arête claire
    const haut = [], bas = [];
    for (let i = 0; i <= 16; i++) {
      const f = -1.25 + 2.5 * i / 16, x = .27 + .20 * Math.cos(f), z = .24 * Math.sin(f), y = .675 + .025 * Math.cos(f);
      haut.push([x, y, z]); bas.push([x - .015, y - .07, z]);
    }
    const faces = [];
    for (let i = 0; i < 16; i++) faces.push([bas[i], bas[i + 1], haut[i + 1]], [bas[i], haut[i + 1], haut[i]]);
    forme('pare-brise', C.lisser(faces).concat(C.lisser(faces.map(t => [t[0], t[2], t[1]]))));
    forme('pare-brise-arete', C.tube(haut, .003, { cotes: 6, pas: 2 }));
  }
  // ---------------------------------------------------------------- modèle
  function piece(shape, o, s, mat, color, extra) { return Object.assign({ shape, o, s, mat, color }, extra || {}); }

  function modele(livree) {
    const c1 = livree.couleur, c2 = livree.seconde || BLANC, casque = livree.casque || c2, combi = livree.combinaison || c1.map(v => v * .7);
    const corps = [], simples = [], moyennes = new Set();
    const P = (shape, o, s, mat, color, extra) => { const p = piece(shape, o, s, mat, color, extra); corps.push(p); return p; };
    // Version moyenne (voir detailPour) : la silhouette sans ses détails de quelques centimètres. Carènes de la caisse,
    // bande de la seconde couleur, cuve, capot moteur, ailerons et dérives, casque et visière, pneus, fonds de jante et
    // moyeux ; ni numéros, filets, suspensions, mécanique arrière, rayons ni repères des pneus.
    const Moy = p => { moyennes.add(p); return p; };
    const AR = extra => Object.assign({ arriere: true }, extra); // derrière l'œil du cockpit : pas dessiné dans cette vue
    const pilote = { pilote: true }, tetePilote = { pilote: true, tetePilote: true };

    // Carrosserie : quille de nez, grand capot en flèche qui devient les pontons, carénage du cockpit en goutte sur
    // l'axe, capot moteur, saute-vent en bulle teintée. Filet et bande basse de la seconde couleur.
    const L = (nom, mat, color, extra) => P(FORMES[nom].nom, FORMES[nom].centre, FORMES[nom].taille, mat, color, extra);
    const dehors = { exterieur: true }; // remplacé en vue cockpit (voir cockpit)
    Moy(L('quille', PEINTURE, c1));
    Moy(L('fleche', PEINTURE, c1));
    Moy(L('pontons', PEINTURE, c1));
    Moy(L('bande', PEINTURE, c2));
    L('filet', PEINTURE, c2);
    Moy(L('goutte', PEINTURE, c1, dehors));
    L('goutte-dedans', MAT, c1.map(v => v * .22), dehors);
    L('jonc', MAT, NOIR, dehors);
    L('bulle', METAL_MAT, [.30, .50, .86], { fx: true, alpha: .3, exterieur: true });
    Moy(L('moteur', PEINTURE, c1, AR()));
    L('arceau', METAL_MAT, ARGENT, AR());
    L('retros', PEINTURE, c1, dehors);                 // vue cockpit : rétroviseurs dédiés (voir RETRO)
    L('basculeurs', MAT, NOIR);
    L('triangles', METAL_MAT, SOMBRE);
    // Aileron avant argent de 1,62 m, bord de fuite relevé, et ses deux dérives rouges
    Moy(P('box', [2.11, .13, 0], [.38, .025, 1.62], LAQUE, ARGENT, { m: euler(0, 0, -.08) }));
    for (const k of [-1, 1]) Moy(P('box', [2.11, .17, k * .81], [.38, .19, .02], PEINTURE, c1));
    // Habitacle de la vue cockpit (dessiné seulement dans cette vue) : épaules, jonc, dôme, saute-vent.
    // voi-5 : la cuve sombre se dessine aussi en vue extérieure — sans elle, vu du dessus, l'habitacle paraît
    // plein couleur caisse ; prolongée par la quille (voi-1), elle ne se voit de dehors que par l'ouverture.
    const dedans = { dedans: true };
    L('epaules', PEINTURE, c1, dedans);
    L('epaules-jonc', MAT, NOIR, dedans);
    L('flancs', MAT, [.05, .05, .055], dedans);
    L('dome', PEINTURE, c1, dedans);
    Moy(L('cuve', MAT, [.035, .035, .04]));
    L('pare-brise', METAL_MAT, [.30, .50, .86], { fx: true, alpha: .2, dedans: true });
    L('pare-brise-arete', METAL_MAT, [.86, .9, .94], { fx: true, alpha: .5, dedans: true });
    // Pilote : buste et tête d'EMPRISE sous un casque intégral (voir HUMAIN), sinon casque, visière et épaules simples
    if (FORMES['pilote-buste'] && FORMES['pilote-casque']) {
      const PEAUX = [[.86, .66, .54], [.74, .54, .41], [.55, .38, .27], [.92, .76, .64]], peau = PEAUX[(livree.numero || 0) % PEAUX.length];
      L('pilote-buste', TISSU, combi, pilote);
      Moy(L('pilote-casque', LAQUE, casque, tetePilote));
      if (FORMES['pilote-bande']) L('pilote-bande', LAQUE, c1, tetePilote);
      if (FORMES['pilote-visage']) L('pilote-visage', MAT, peau, tetePilote);
      if (FORMES['pilote-visiere']) Moy(L('pilote-visiere', METAL_MAT, [.05, .07, .11], { fx: true, alpha: .62, pilote: true, tetePilote: true }));
    } else {
      Moy(P('sphere', [0, .865, 0], [.27, .29, .27], LAQUE, casque, tetePilote));
      Moy(P('box', [.11, .875, 0], [.07, .07, .2], METAL_MAT, [.05, .06, .09], tetePilote));
      P('sphere', [-.04, .66, 0], [.30, .20, .38], TISSU, combi, pilote);
    }
    // Glaces des rétroviseurs, tournées vers le pilote (en vue cockpit : glace vivante)
    for (const k of [-1, 1]) P('box', [.527, .566, k * .47], [.004, .048, .132], METAL_MAT, [.2, .23, .27], { glace: true });
    L('suspension-arriere', MAT, CARBONE, AR());
    L('cardans-arriere', METAL_MAT, SOMBRE, AR());
    L('freins-arriere', METAL_MAT, ACIER, AR());
    // Numéro : grand chiffre penché, posé directement sur la caisse (lisible de face) et sur les flancs des pontons.
    // BITUME (voi-2) : blanc sur le rouge du joueur, noir sur les caisses claires — encre choisie pour un contraste ≥ 3
    if (livree.numero) {
      const lum = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2], encre = (lum(BLANC) + .05) / (lum(c1) + .05) >= 3 ? BLANC : NOIR;
      const texte = String(livree.numero).slice(0, 2), n = texte.length, penche = .21;
      // chiffre dans le plan (ex : sa droite, ey : son haut), centré en o, hauteur h ; colle(c) pose chaque segment sur
      // la peau
      const chiffres = (o, ex, ey, h, colle, extra) => {
        const l = h * .5, t = h * .15, pas = l + h * .24, nz = croix(ex, ey), eyp = norme(ey.map((v, k) => v + ex[k] * Math.tan(penche))), exp = croix(eyp, nz);
        const places = { a: [0, h / 2, l + t, t, 0], b: [l / 2, h / 4, t, h / 2 + t, 1], c: [l / 2, -h / 4, t, h / 2 + t, 1], d: [0, -h / 2, l + t, t, 0], e: [-l / 2, -h / 4, t, h / 2 + t, 1], f: [-l / 2, h / 4, t, h / 2 + t, 1], g: [0, 0, l + t, t, 0] };
        for (let i = 0; i < n; i++) for (const nom of SEGMENTS[texte[i]] || '') {
          const [x, y, sx, sy, vertical] = places[nom], dx = x + (i - (n - 1) / 2) * pas + y * Math.tan(penche);
          const c = colle(o.map((v, k) => v + ex[k] * dx + ey[k] * y));
          P('box', c, [sx, sy, .003], MAT, encre, Object.assign({ m: vertical ? [exp, eyp, nz] : [ex, ey, nz] }, extra));
        }
      };
      // nez : devant la pointe du carénage, le haut du chiffre vers l'habitacle ; flancs : sur la partie droite du ponton
      // hauteur du dessus d'une section en z, et largeur d'une section à la hauteur y (superellipse)
      const dessus = (sc, z) => { const c = Math.min(1, Math.abs(z - (sc.z || 0)) / sc.l) ** (sc.n / 2); return (sc.y0 + sc.y1) / 2 + (sc.y1 - sc.y0) / 2 * Math.sqrt(1 - c * c) ** (2 / sc.n); };
      const flanc = (sc, y) => { const h = (sc.y1 - sc.y0) / 2, t = Math.min(1, Math.abs(y - (sc.y0 + sc.y1) / 2) / h) ** (sc.n / 2); return sc.l * Math.sqrt(1 - t * t) ** (2 / sc.n); };
      const f = C.profil(S_FLECHE), xN = 1.62, s0 = f(xN + .1), s1 = f(xN - .1), ey = norme([-.2, s1.y1 - s0.y1, 0]);
      chiffres([xN, f(xN).y1, 0], [0, 0, -1], ey, .18, c => [c[0], dessus(f(c[0]), c[2]) + .004, c[2]]);
      const p = C.profil(S_PONTONS);
      // voi-3 : numéro de flanc calé entre la bande basse (haut y 0,17) et le filet (bas y 0,357)
      for (const k of [-1, 1]) chiffres([-.62, .262, k * .72], [k, 0, 0], [0, 1, 0], .15, c => [c[0], c[1], k * (flanc(p(c[0]), c[1]) + .004)], AR());
    }
    // Mécanique arrière visible : carter moulé, quatre sorties creuses, mât métallique et dérives arrondies.
    L('boite-transversale', METAL_MAT, [.38, .39, .40], AR());
    L('carter-arriere', METAL_MAT, [.43, .44, .44], AR());
    L('nervures-boite', METAL_MAT, [.53, .54, .53], AR());
    L('platines-arriere', METAL_MAT, [.57, .58, .57], AR());
    L('echappements-hauts', METAL_MAT, [.53, .52, .50], AR());
    L('echappements-bas', METAL_MAT, [.28, .27, .25], AR());
    L('echappements-interieurs', MAT, [.018, .019, .021], AR());
    L('echappements-levres', METAL_MAT, [.46, .44, .40], AR());
    Moy(L('mat-aileron', METAL_MAT, ARGENT, AR()));
    Moy(P('box', [-2.05, .90, 0], [.32, .035, 1.10], PEINTURE, c2, AR({ m: euler(0, 0, -.12) })));
    Moy(P('box', [-2.18, .95, 0], [.12, .025, 1.08], PEINTURE, c2, AR({ m: euler(0, 0, -.5) })));
    Moy(L('derives-arriere', PEINTURE, c1, AR()));
    // Chaque pneu porte sa vraie sculpture. La bande neuve d'un slick reste lisse ; pas de barrettes de craie
    // blanches sur ses flancs. Une petite valve arrondie reste un repère de rotation sur le côté extérieur.
    // L'orientation de montage varie d'une roue à l'autre, déterministe pour la livrée et sans hasard par image.
    const phasesRoues = ROUES.map((w, i) => (Math.imul((livree.numero || 0) ^ Math.imul(i + 1, 0x9e3779b9), 0x85ebca6b) >>> 0) / 4294967296 * 2 * Math.PI);
    const typePneus = B.pneus ? B.pneus.normaliserType(livree.pneus)
      : typeof livree.pneus === 'string' && Object.prototype.hasOwnProperty.call(PNEUS_TYPES, livree.pneus) ? livree.pneus : 'slicks';
    const pneus = PNEUS_TYPES[typePneus];
    ROUES.forEach((w, i) => {
      const base = { roue: i, m: ROUE_AXE, arriere: !w.avant, tourne: phasesRoues[i] }, essieu = w.avant ? 'av' : 'ar';
      const jante = JANTES_FORMES[essieu], k = Math.sign(w.z);
      const pieceRoue = (formes, mat, couleur, extra) => P(formes[0].nom, [w.x, w.r, w.z], formes[0].taille, mat, couleur,
        Object.assign({ formesRoues: formes }, base, extra));
      const surfaces = MATIERES_PNEUS[essieu][typePneus];
      Moy(pieceRoue(ROUES_FORMES[essieu][typePneus], MAT, PNEU,
        { pneu: typePneus, usureRoue: 1, formesUsees: surfaces[0] }));
      for (let j = 1; j < 4; j++) Moy(pieceRoue(surfaces[j], MAT, PNEU,
        { pneu: typePneus, usureRoue: j + 1, detailRoueMax: 1 }));
      if (typePneus !== 'slicks') Moy(pieceRoue(surfaces[4], MAT, PNEU,
        { pneu: typePneus, usureRoue: 5, profondeur: typePneus === 'neige' ? .009 : typePneus === 'pluie' ? .007 : .004, detailRoueMax: 1 }));
      Moy(pieceRoue(jante.fut, METAL_MAT, SOMBRE));
      Moy(pieceRoue(jante.rayons, METAL_MAT, JANTE));
      Moy(pieceRoue(jante.moyeu, METAL_MAT, FOND_JANTE));
      pieceRoue(DISQUES_ROUE, METAL_MAT, [.40, .40, .42], { decale: [0, -k * (w.l / 2 - .055), 0], detailRoueMax: 1 });
      pieceRoue(jante.bague, MAT, pneus.cercle, { pneus: typePneus, detailRoueMax: 1 });
      const valve = FORMES['valve-roue'];
      P(valve.nom, [w.x, w.r, w.z], valve.taille, MAT, [.20, .18, .13],
        Object.assign({}, base, { decale: [.145, k * (w.l / 2 - .016), 0], detailRoueMax: 1 }));
    });

    // Version lointaine : trois carènes à huit côtés, les ailerons, le casque et les quatre roues
    const loin = nom => piece(FORMES[nom].nom, FORMES[nom].centre, FORMES[nom].taille, PEINTURE, c1);
    simples.push(loin('loin-caisse'), loin('loin-dessus'), loin('loin-quille'),
      piece('box', [2.11, .13, 0], [.38, .04, 1.62], LAQUE, ARGENT),
      piece('box', [-2.05, .90, 0], [.34, .06, 1.10], PEINTURE, c2),
      piece(FORMES['mat-aileron'].nom, FORMES['mat-aileron'].centre, FORMES['mat-aileron'].taille, METAL_MAT, ARGENT),
      piece('sphere', [0, .865, 0], [.27, .29, .27], LAQUE, casque, { tetePilote: true }));
    ROUES.forEach((w, i) => {
      const formes = ROUES_FORMES[w.avant ? 'av' : 'ar'][typePneus], f = formes[3];
      simples.push(piece(f.nom, [w.x, w.r, w.z], f.taille, MAT, PNEU, { m: ROUE_AXE, roue: i, tourne: phasesRoues[i], formesRoues: formes, usureRoue: 1 }));
    });
    // Après casse, ne reste que la cellule du pilote et l'arceau ; roues et carrosserie sont des débris.
    const epave = corps.filter(p => p.pilote || ['cuve', 'goutte', 'goutte-dedans', 'arceau'].some(n => p.shape === FORMES[n].nom));
    const mod = { corps, simples, epave, moyens: corps.filter(p => moyennes.has(p)), livree };
    B.cockpitMatieres?.pilote(corps);
    preparer(mod);
    return mod;
  }
  // Objets de rendu de toutes les variantes dont le jeu se sert, créés avec le modèle, au début du niveau : vue
  // extérieure aux trois niveaux de détail et en épave, vue cockpit entière et en épave, rétroviseur, habitacle.
  function preparer(mod) {
    const e = etatRendu(mod);
    for (const li of [CORPS, SIMPLES, EPAVE, MOYENS]) tableDe(e, mod, li, 0);
    for (const li of [CORPS, EPAVE]) { tableDe(e, mod, li, 3); tableRetro(e, mod, li); }
    e.habitacle = construireHabitacle(mod);
    e.pilote = construirePiloteExterieur(mod, e.habitacle);
  }

  // 12F2 : préparer les montes pendant le chargement, puis ne changer que leurs références et couleurs.
  // Les maillages des quatre types existent déjà. Aucun modèle, habitacle ni tableau de rendu n'est reconstruit
  // au stand ; les pièces de carrosserie et les objets permanents gardent leur identité pendant la course.
  function preparerPneusService(mod) {
    if (!mod || !Array.isArray(mod.corps) || !Array.isArray(mod.moyens) || !Array.isArray(mod.simples)) return false;
    const e = etatRendu(mod);
    if (e.pneusService) return true;
    const premier = mod.corps.find(p => p.usureRoue === 1), type = premier && premier.pneu;
    if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(PNEUS_TYPES, type)) return false;
    // Les slicks n'avaient pas besoin de fond de sculpture. Réserver ces quatre supports une seule fois,
    // avant la première image de course ; detailRoueMax = -1 les masque tant que la monte reste lisse.
    for (let i = 0; i < ROUES.length; i++) {
      if (mod.corps.some(p => p.roue === i && p.usureRoue === 5)) continue;
      const w = ROUES[i], surfaces = MATIERES_PNEUS[w.avant ? 'av' : 'ar'].slicks[0];
      const pneu = mod.corps.find(p => p.roue === i && p.usureRoue === 1);
      const support = piece(surfaces[0].nom, [w.x, w.r, w.z], surfaces[0].taille, MAT, PNEU,
        { roue: i, m: ROUE_AXE, arriere: !w.avant, tourne: pneu.tourne, formesRoues: surfaces,
          pneu: 'slicks', usureRoue: 5, profondeur: 0, detailRoueMax: -1 });
      for (const liste of [mod.corps, mod.moyens]) {
        const k = liste.findIndex(p => p.roue === i && p.usureRoue === 4);
        liste.splice(k + 1, 0, support);
      }
    }
    const pieces = [...mod.corps, ...mod.simples].filter(p => p.usureRoue || p.pneus !== undefined);
    const indices = new Map(pieces.map((p, i) => [p, i])), variantes = Object.create(null), liens = [];
    for (const monte of Object.keys(PNEUS_TYPES)) variantes[monte] = pieces.map(p => {
      const essieu = ROUES[p.roue].avant ? 'av' : 'ar', role = p.usureRoue || 0;
      const surfaces = MATIERES_PNEUS[essieu][monte], lointain = mod.simples.includes(p);
      const formes = role === 1 ? ROUES_FORMES[essieu][monte]
        : role ? surfaces[role - 1].length ? surfaces[role - 1] : surfaces[0] : p.formesRoues;
      const f = formes[lointain ? 3 : 0];
      return { shape: f.nom, taille: f.taille, formes, usees: role === 1 && p.formesUsees ? surfaces[0] : null,
        detailMax: role === 5 && monte === 'slicks' ? -1 : p.detailRoueMax === -1 ? 1 : p.detailRoueMax ?? 3,
        profondeur: role === 5 ? monte === 'neige' ? .009 : monte === 'pluie' ? .007 : monte === 'inter' ? .004 : 0 : 0,
        couleur: role ? PNEU : PNEUS_TYPES[monte].cercle };
    });
    const lier = (t, cockpit) => {
      let i = 0;
      for (const p of t.liste) {
        if (cockpit ? p.pilote || p.arriere || p.exterieur || p.glace : p.dedans) continue;
        const index = indices.get(p);
        if (index !== undefined) liens.push({ table: t, indexObjet: i, indexPiece: index });
        i++;
      }
    };
    // Préparer aussi les variantes moins fréquentes (overlay, vue du siège sans overlay et leurs LOD) :
    // un changement de caméra après le service ne doit ni compiler ni retrouver les anciennes sculptures.
    for (let li = 0; li < NOMS_LISTES.length; li++) {
      for (let variante = 0; variante < 4; variante++) lier(tableDe(e, mod, li, variante), !!(variante & 2));
      lier(tableRetro(e, mod, li), false);
    }
    e.pneusService = { type, pieces, variantes, liens };
    return true;
  }

  // Transaction de rendu seulement : la simulation décide quand le service est terminé. Sans préparation,
  // refuser la bascule plutôt que provoquer une allocation imprévue au milieu d'une course.
  function changerPneus(mod, type) {
    const service = mod && mod.objetsRendu && mod.objetsRendu.pneusService;
    if (!service || typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(service.variantes, type)) return false;
    if (service.type === type) return true;
    const changements = service.variantes[type], pieces = service.pieces, liens = service.liens;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i], c = changements[i];
      p.shape = c.shape; p.s = c.taille; p.formesRoues = c.formes; p.formesUsees = c.usees;
      p.profondeur = c.profondeur; p.detailRoueMax = c.detailMax; p.color = c.couleur;
      if (p.usureRoue) p.pneu = type; else p.pneus = type;
    }
    for (let i = 0; i < liens.length; i++) {
      const lien = liens[i], t = lien.table, k = lien.indexObjet, c = changements[lien.indexPiece], objet = t.objets[k];
      t.formesRoues[k] = c.formes; t.formesUsees[k] = c.usees;
      t.profondeur[k] = c.profondeur; t.detailRoueMax[k] = c.detailMax; objet.shape = c.shape;
      if (t.usureRoue[k] === 5) { objet.s[0] = c.taille[0]; objet.s[1] = c.taille[1]; objet.s[2] = c.taille[2]; }
      else objet.s = c.taille;
      if (t.usureRoue[k]) { objet.color[0] = c.couleur[0]; objet.color[1] = c.couleur[1]; objet.color[2] = c.couleur[2]; }
      else objet.color = c.couleur;
    }
    service.type = type;
    return true;
  }

  // ---------------------------------------------------------------- pose dans le monde
  // ev = { p: [x, y, z] (sol sous le milieu de l'empattement), cap, tangage, roulis, braquage (rad, droite positive),
  //        roule (distance parcourue, m : fait tourner les roues), v (vitesse, m/s : repères ou flou des pneus) }
  // Une pièce se dessine-t-elle ? En vue cockpit, ni le pilote, ni l'arrière, ni le carénage et les glaces de la vue
  // extérieure ; l'habitacle (dedans) seulement dans cette vue ; les repères des pneus à basse vitesse seulement, leur
  // bande floue au-delà.
  function visible(pc, cockpit, v) {
    if (pc.usureRoue > 1) return false; // supports réservés à la pose dynamique ; le modèle sans état est neuf
    if (cockpit && (pc.pilote || pc.arriere || pc.exterieur || pc.glace)) return false;
    if (!cockpit && pc.dedans) return false;
    return !(pc.lent && v > VITESSE_FLOU) && !(pc.vite && !(v > VITESSE_FLOU));
  }

  // Objets de rendu permanents : aucune allocation par image (fluidité, aucun ramasse-miettes en course). Le moteur
  // lit la liste au dessin (renderer.js : il la répartit, puis copie les valeurs dans ses tampons) et n'en garde rien
  // pour l'image suivante. Chaque voiture garde donc ses objets, créés avec son modèle : forme, taille, matière,
  // couleur et drapeaux y sont posés une fois ; place et rotation y sont réécrites en place à chaque pose. Chaque
  // variante a ses objets, pour qu'aucun drapeau ne passe de l'une à l'autre : vue extérieure (vue principale, glaces
  // et vue du joueur 2), vue cockpit (par-dessus la scène), rétroviseur, autres jeux d'options. Un objet vaut jusqu'à
  // la pose suivante de la même voiture dans la même variante : deux poses de la même voiture dans la même variante,
  // dans une même liste, se recouvriraient. jeu.js dessine chaque liste (vue du joueur 2, vue du joueur 1, glace)
  // avant de reposer la même voiture.
  const CORPS = 0, SIMPLES = 1, EPAVE = 2, MOYENS = 3, NOMS_LISTES = ['corps', 'simples', 'epave', 'moyens'];
  const SANS_OPTIONS = Object.freeze({}), MS = new Float64Array(9);   // MS : attitude de la pose en cours
  function etatRendu(mod) {
    let e = mod.objetsRendu;
    if (e === undefined) {
      e = { M3: [trois(), trois(), trois()], tables: new Array(16).fill(null), retro: [null, null, null, null], habitacle: null, pilote: null };
      Object.defineProperty(mod, 'objetsRendu', { value: e });   // ni énuméré, ni copié, ni sérialisé avec le modèle
    }
    return e;
  }
  // Attitude rendue par poser et cockpit, en tableaux imbriqués comme attitude() : une par voiture, réécrite à chaque
  // pose de cette voiture.
  function imbriquee(N, M) {
    const a = N[0], b = N[1], c = N[2];
    a[0] = M[0]; a[1] = M[1]; a[2] = M[2]; b[0] = M[3]; b[1] = M[4]; b[2] = M[5]; c[0] = M[6]; c[1] = M[7]; c[2] = M[8];
    return N;
  }
  // Pièces d'une liste visibles dans une variante (overlay : par-dessus la scène ; cockpit : vue du siège), dans l'ordre
  // de la liste, chacune avec son objet. Les pièces d'une même roue qui tournent du même angle partagent leur rotation,
  // les pièces fixes de même repère la leur : chaque rotation est calculée une fois par pose, aux mêmes opérations que
  // pour une pièce seule. Les données de lecture seule sont rangées à plat (o, d : trois nombres par pièce) : un
  // tableau typé par table plutôt qu'un par pièce, quelques dizaines de Kio de moins par voiture.
  function compiler(liste, overlay, cockpit) {
    const t = { liste, longueur: liste.length, n: 0, objets: [], formesRoues: [], formesUsees: [], usureRoue: [], profondeur: [], detailRoueMax: [],
      pneusCourants: new Float64Array(4 * 15), pneusActifs: new Uint8Array(4), o: null, roue: null, groupe: [], fixe: [], decale: null, d: null, portee: null,
      lent: null, vite: null, tete: null, buste: null, bulle: -1, dessusLoin: -1, cockpit, rotTete: trois(), rotM: trois(), fixes: [], groupes: [], faitG: null, faitF: null };
    const o = [], roues = [], decale = [], d = [], portee = [], lent = [], vite = [], tete = [], buste = [];
    for (const pc of liste) {
      if (cockpit && (pc.pilote || pc.arriere || pc.exterieur || pc.glace)) continue;
      if (!cockpit && pc.dedans) continue;
      const objet = { shape: pc.shape, p: trois(), s: pc.s, r: t.rotM, mat: pc.mat, color: pc.color, surface: 'object' };
      if (pc.usureRoue) objet.color = pc.color.slice();
      if (pc.usureRoue === 5) objet.s = pc.s.slice();
      if (pc.fx) { objet.fx = true; objet.alpha = pc.alpha; }
      if (overlay) objet.overlay = true;
      const roue = pc.roue === undefined ? -1 : pc.roue;
      let groupe = null, fixe = null;
      if (roue >= 0) {
        const m = aplatir(pc.m), w = ROUES[roue];
        groupe = t.groupes.find(g => g.roue === roue && Object.is(g.tourne, pc.tourne) && memes(g.m, m)) || null;
        if (!groupe) t.groupes.push(groupe = { n: t.groupes.length, roue, avant: w.avant, rayon: w.r, tourne: pc.tourne, m, R: new Float64Array(9), r: trois() });
        objet.r = groupe.r;
      } else if (pc.m) {
        const m = aplatir(pc.m);
        fixe = t.fixes.find(x => memes(x.m, m)) || null;
        if (!fixe) t.fixes.push(fixe = { n: t.fixes.length, m, r: trois() });
        objet.r = fixe.r;
      }
      const dc = roue >= 0 && pc.decale ? Float64Array.from(pc.decale) : null, oc = Float64Array.from(pc.o);
      t.objets.push(objet); t.formesRoues.push(pc.formesRoues || null); t.detailRoueMax.push(pc.detailRoueMax === undefined ? 3 : pc.detailRoueMax);
      t.formesUsees.push(pc.formesUsees || null); t.usureRoue.push(pc.usureRoue || 0); t.profondeur.push(pc.profondeur || 0);
      t.groupe.push(groupe); t.fixe.push(fixe);
      if (pc.shape === FORMES.bulle.nom) t.bulle = t.n;
      if (pc.shape === FORMES['loin-dessus'].nom) t.dessusLoin = t.n;
      o.push(oc[0], oc[1], oc[2]); roues.push(roue); decale.push(dc === null ? 0 : 1);
      if (dc === null) d.push(0, 0, 0); else d.push(dc[0], dc[1], dc[2]);
      portee.push(dc === null ? 0 : Math.hypot(dc[0], dc[1], dc[2]));
      lent.push(pc.lent ? 1 : 0); vite.push(pc.vite ? 1 : 0); tete.push(pc.tetePilote ? 1 : 0); buste.push(pc.pilote && !pc.tetePilote ? 1 : 0); t.n++;
    }
    t.o = Float64Array.from(o); t.roue = Int8Array.from(roues); t.decale = Uint8Array.from(decale); t.d = Float64Array.from(d);
    t.portee = Float64Array.from(portee); t.lent = Uint8Array.from(lent); t.vite = Uint8Array.from(vite);
    t.tete = Uint8Array.from(tete);
    t.buste = Uint8Array.from(buste);
    t.faitG = new Uint8Array(t.groupes.length); t.faitF = new Uint8Array(t.fixes.length);
    return t;
  }
  // Table d'une liste du modèle dans une variante (1 : overlay, 2 : cockpit), refaite si la liste a été remplacée
  function tableDe(e, mod, li, variante) {
    const liste = mod[NOMS_LISTES[li]] || mod.corps, k = li * 4 + variante;
    let t = e.tables[k];
    if (t === null || t.liste !== liste || t.longueur !== liste.length) t = e.tables[k] = compiler(liste, (variante & 1) !== 0, (variante & 2) !== 0);
    return t;
  }
  // Table du rétroviseur : les pièces de la vue extérieure, avec leurs propres objets et rotations
  function tableRetro(e, mod, li) {
    const liste = mod[NOMS_LISTES[li]] || mod.corps;
    let t = e.retro[li];
    if (t === null || t.liste !== liste || t.longueur !== liste.length) t = e.retro[li] = partager(compiler(liste, false, false), tableDe(e, mod, li, 0));
    return t;
  }
  // Deux tables compilées de la même liste dans la même variante ont les mêmes données de lecture seule (places
  // locales, décalages, drapeaux, matrices des pièces), dans le même ordre : t prend celles de source. Ses objets et
  // les rotations qu'elle calcule restent à elle.
  function partager(t, source) {
    t.o = source.o; t.roue = source.roue; t.decale = source.decale; t.d = source.d; t.portee = source.portee; t.lent = source.lent; t.vite = source.vite; t.tete = source.tete; t.buste = source.buste;
    for (let k = 0; k < t.groupes.length; k++) t.groupes[k].m = source.groupes[k].m;
    for (let k = 0; k < t.fixes.length; k++) t.fixes[k].m = source.fixes[k].m;
    return t;
  }
  const BRAQ = new Float64Array(2), T_E = new Float64Array(9), T_F = new Float64Array(9), T_G = new Float64Array(9), T_H = new Float64Array(9), ANG_ROUE = new Float64Array(2);
  function braquagesDans(ev) { // braquages(ev.braquage || 0), rangés dans BRAQ
    const d = ev.braquage || 0;
    if (Math.abs(d) < 1e-5) { BRAQ[0] = d; BRAQ[1] = d; return; }
    const R = EMPATTEMENT / Math.tan(Math.abs(d));
    const interieur = Math.atan(EMPATTEMENT / (R - DEMI_VOIE_AV)), exterieur = Math.atan(EMPATTEMENT / (R + DEMI_VOIE_AV));
    if (d > 0) { BRAQ[0] = exterieur; BRAQ[1] = interieur; } else { BRAQ[0] = -interieur; BRAQ[1] = -exterieur; }
  }
  // Rotation d'un groupe de pièces de roue : braquage d'Ackermann à l'avant (BRAQ), rotation propre −distance/rayon
  function tournerRoue(g, M, ev) {
    let m = g.m;
    if (g.tourne !== undefined) { ANG_ROUE[0] = g.tourne - (ev.roule || 0) / g.rayon; m = produitDans(T_E, m, eulerDe(T_F, ANG_ROUE, 0, 1)); }
    if (g.avant) { ANG_ROUE[1] = -BRAQ[g.roue]; m = produitDans(T_G, eulerDe(T_H, ANG_ROUE, 1, 1), m); }
    anglesDans(g.r, produitDans(g.R, M, m));
  }
  // Filtre des rétroviseurs de jeu.js (majGlaces) : près de l'essieu arrière (x) et hors de la caisse (z), dans le
  // repère du cap. Une pièce de roue décalée s'écarte de l'axe de sa roue d'au plus la longueur de son décalage, et
  // le rebond l'en écarte d'au plus |h| : loin du filtre de plus que cela (et d'une marge pour les arrondis), elle n'y
  // entre pas, sans qu'il faille calculer la rotation de sa roue.
  const X_ARRIERE = ROUES[2].x, MARGE_RETRO = 1e-6, LOIN_RETRO = 1e8;
  // Couleurs persistantes par table/caméra. La graine ne sert qu'à la matière : aucun hasard de simulation,
  // aucune réinitialisation d'usure en changeant de vue. Les données reçues restent en lecture seule.
  function preparerPneus(t, etats) {
    const valeurs = t.pneusCourants;
    for (let i = 0; i < 4; i++) {
      const e = etats && etats[i], j = i * 15;
      const u = e && Number.isFinite(e.usure) ? Math.max(0, Math.min(1, e.usure)) : 0;
      const s = e && Number.isFinite(e.salete) ? Math.max(0, Math.min(1, e.salete)) : 0;
      const g = e && Number.isFinite(e.grainage) ? Math.max(0, Math.min(1, e.grainage)) : 0;
      const graine = e && Number.isFinite(e.graine) ? e.graine >>> 0 : i + 1;
      let h = Math.imul(graine ^ graine >>> 16, 0x45d9f3b); h = (h ^ h >>> 16) >>> 0;
      const a = .7 + (h & 255) / 425, b = .7 + (h >>> 8 & 255) / 425, c = .7 + (h >>> 16 & 255) / 425;
      t.pneusActifs[i] = u > 0 || s > 0 || g > 0 ? 1 : 0; valeurs[j] = u;
      // Le pneu neuf retrouve exactement la couleur historique ; les pigments restent gris/brun doux.
      for (let k = 0; k < 3; k++) {
        const base = PNEU[k] + .012 * u + (k === 0 ? .052 : k === 1 ? .042 : .025) * s;
        valeurs[j + 1 + k] = base;
        valeurs[j + 4 + k] = base + .012 * u * (1 - .5 * g) * a;
        valeurs[j + 7 + k] = base + (.018 * u + .012 * g) * b;
        valeurs[j + 10 + k] = base + (k === 0 ? .040 : k === 1 ? .030 : .017) * s * c - .003 * u * c;
      }
    }
  }
  // Pose d'une table : rotations partagées, puis place de chaque pièce. retro : seules les pièces qui passent le
  // filtre des rétroviseurs sont rendues, et seules leurs rotations sont calculées.
  function poserTable(t, M, ev, sortie, roues, retro, detailRoues = 0, tete = null) {
    const px = ev.p[0], py = ev.p[1], pz = ev.p[2], v = ev.v || 0, rebond = ev.rebond, fixes = t.fixes, groupes = t.groupes;
    preparerPneus(t, ev.etatPneus);
    anglesDans(t.rotM, M);
    if (tete) anglesProduit(t.rotTete, M, tete);
    if (groupes.length > 0) braquagesDans(ev);
    if (!retro) {
      for (let i = 0; i < fixes.length; i++) anglesProduit(fixes[i].r, M, fixes[i].m);
      for (let i = 0; i < groupes.length; i++) if (!(roues && roues[groupes[i].roue])) tournerRoue(groupes[i], M, ev);
    } else { t.faitG.fill(0); t.faitF.fill(0); }
    const ca = retro ? Math.cos(ev.cap) : 0, sa = retro ? Math.sin(ev.cap) : 0;
    const borne = retro && Math.abs(px) < LOIN_RETRO && Math.abs(pz) < LOIN_RETRO;   // arrondis de px + a − px négligeables
    for (let i = 0; i < t.n; i++) {
      if (t.tete[i] && t.cockpit && ev.pilote) continue;
      if (detailRoues > t.detailRoueMax[i]) continue;
      if ((t.lent[i] === 1 && v > VITESSE_FLOU) || (t.vite[i] === 1 && !(v > VITESSE_FLOU))) continue;
      const roue = t.roue[i];
      const usureRoue = t.usureRoue[i];
      if (usureRoue > 1 && !t.pneusActifs[roue]) continue;
      // Chantier 3 : une roue détachée (degats.roues[i]) n'est plus dessinée
      if (roue >= 0 && roues && roues[roue]) continue;
      const k = 3 * i;
      let x = t.o[k], y = t.o[k + 1], z = t.o[k + 2];
      if (i === t.bulle || i === t.dessusLoin) {
        const forme = i === t.bulle ? (tete ? FORMES['bulle-pilote'] : FORMES.bulle)
          : (tete ? FORMES['loin-dessus-pilote'] : FORMES['loin-dessus']);
        x = forme.centre[0]; y = forme.centre[1]; z = forme.centre[2];
        t.objets[i].shape = forme.nom; t.objets[i].s = forme.taille;
      }
      if (t.tete[i]) {
        t.objets[i].r = tete ? t.rotTete : t.fixe[i] ? t.fixe[i].r : t.rotM;
        if (tete) {
          const dx = x - PILOTE_COU[0], dy = y - PILOTE_COU[1], dz = z - PILOTE_COU[2];
          x = PILOTE_COU[0] + tete[0] * dx + tete[3] * dy + tete[6] * dz;
          y = PILOTE_COU[1] + tete[1] * dx + tete[4] * dy + tete[7] * dz;
          z = PILOTE_COU[2] + tete[2] * dx + tete[5] * dy + tete[8] * dz;
        }
      }
      if (tete && (t.tete[i] || t.buste[i])) x += PILOTE_RECUL;
      let a = M[0] * x + M[3] * y + M[6] * z, b = M[1] * x + M[4] * y + M[7] * z, c = M[2] * x + M[5] * y + M[8] * z;
      if (roue >= 0) {
        // `decale` place la pièce hors de l'axe, dans le repère de la roue ; `rebond` (m, par roue) : course de
        // suspension sur les bosses, purement visuelle
        if (t.decale[i] === 1) {
          const g = t.groupe[i];
          if (retro && t.faitG[g.n] === 0) {
            if (borne) {
              const marge = t.portee[i] + (rebond ? Math.abs(rebond[roue] || 0) : 0) + MARGE_RETRO, xc = a * ca + c * sa, zc = c * ca - a * sa;
              if (Math.abs(xc - X_ARRIERE) >= .5 + marge || Math.abs(zc) <= .55 - marge) continue;
            }
            tournerRoue(g, M, ev); t.faitG[g.n] = 1;
          }
          const R = g.R, dx = t.d[k], dy = t.d[k + 1], dz = t.d[k + 2];
          a = a + (R[0] * dx + R[3] * dy + R[6] * dz); b = b + (R[1] * dx + R[4] * dy + R[7] * dz); c = c + (R[2] * dx + R[5] * dy + R[8] * dz);
        }
        if (rebond) { const h = rebond[roue] || 0; a = a + M[3] * h; b = b + M[4] * h; c = c + M[5] * h; }
      }
      const X = px + a, Y = py + b, Z = pz + c;
      if (retro) {
        const dx = X - px, dz = Z - pz, xc = dx * ca + dz * sa, zc = dz * ca - dx * sa;
        if (!(Math.abs(xc - X_ARRIERE) < .5 && Math.abs(zc) > .55)) continue;
        if (roue >= 0) { const g = t.groupe[i]; if (t.faitG[g.n] === 0) { tournerRoue(g, M, ev); t.faitG[g.n] = 1; } }
        else { const f = t.fixe[i]; if (f !== null && t.faitF[f.n] === 0) { anglesProduit(f.r, M, f.m); t.faitF[f.n] = 1; } }
      }
      const objet = t.objets[i], p = objet.p;
      const variantes = t.formesRoues[i];
      if (variantes) {
        const surfaces = t.formesUsees[i], f = surfaces && detailRoues < 2 && t.pneusActifs[roue] ? surfaces[detailRoues] : variantes[detailRoues];
        objet.shape = f.nom;
        if (usureRoue === 5) {
          // Le fond remonte vers le sommet des pavés, sans atteindre celui-ci : au moins 16 % de creux.
          const rayon = ROUES[roue].r, radial = (rayon - t.profondeur[i] * (1 - .84 * t.pneusCourants[roue * 15])) / (rayon - t.profondeur[i]);
          objet.s[0] = f.taille[0] * radial; objet.s[1] = f.taille[1]; objet.s[2] = f.taille[2] * radial;
        } else objet.s = f.taille;
      }
      if (usureRoue) {
        const j = roue * 15 + (usureRoue === 5 ? 1 : (usureRoue - 1) * 3 + 1), color = objet.color, valeurs = t.pneusCourants;
        color[0] = valeurs[j]; color[1] = valeurs[j + 1]; color[2] = valeurs[j + 2];
      }
      p[0] = X; p[1] = Y; p[2] = Z;
      sortie.push(objet);
    }
  }
  // options = { simple, detail, rouesDetail, casse, roues, cockpit, overlay } ; rouesDetail : 0/1/2/3 = 96/64/32/16
  // segments, choisi par caméra avec detailRouesPour ; sans indication, suit le niveau de la voiture.
  // detail ('complet', 'moyen' ou 'simple', voir
  // detailPour) l'emporte sur simple quand il est donné. Rend l'attitude de la caisse (valable jusqu'à la pose
  // suivante de cette voiture).
  function poser(mod, ev, sortie, options) {
    const o = options || SANS_OPTIONS, e = etatRendu(mod);
    const detail = o.detail !== undefined ? o.detail : o.simple ? 'simple' : 'complet';
    const li = o.casse ? EPAVE : detail === 'simple' ? SIMPLES : detail === 'moyen' ? MOYENS : CORPS;
    const t = tableDe(e, mod, li, (o.overlay ? 1 : 0) + (o.cockpit ? 2 : 0));
    const M = attitudeDans(MS, ev);
    const detailRoues = o.rouesDetail === undefined ? li === SIMPLES ? 3 : li === MOYENS ? 2 : 0 : Math.max(0, Math.min(3, o.rouesDetail | 0));
    const pilote = ev.pilote && !o.cockpit ? e.pilote : null;
    if (pilote) preparerPiloteExterieur(pilote, ev.pilote);
    poserTable(t, M, ev, sortie, o.roues, false, detailRoues, pilote ? pilote.tete : null);
    if (pilote) poserPiloteExterieur(pilote, li * 2 + (o.overlay ? 1 : 0), M, ev, sortie, false);
    return imbriquee(e.M3, M);
  }
  // Rétroviseurs (jeu.js, majGlaces) : de la voiture suivie, vue de dehors, la glace ne garde que ce qui passe le
  // filtre de jeu.js, près de l'essieu arrière et hors de la caisse (|z| > 0,55 dans le repère du cap) : les pièces des
  // roues arrière, et d'autres quand la voiture se retourne (saut, tonneau). Même sortie que poser suivi de ce filtre,
  // pour toute attitude, sans pousser puis retirer aussitôt le reste de la caisse ni calculer ses rotations.
  // options = { roues, casse }, comme pour poser.
  function poserRetro(mod, ev, sortie, options) {
    const o = options || SANS_OPTIONS, e = etatRendu(mod), t = tableRetro(e, mod, o.casse ? EPAVE : CORPS);
    const M = attitudeDans(MS, ev);
    const pilote = ev.pilote ? e.pilote : null;
    if (pilote) preparerPiloteExterieur(pilote, ev.pilote);
    poserTable(t, M, ev, sortie, o.roues, true, o.rouesDetail === undefined ? 0 : Math.max(0, Math.min(3, o.rouesDetail | 0)), pilote ? pilote.tete : null);
    if (pilote) poserPiloteExterieur(pilote, o.casse ? 9 : 8, M, ev, sortie, true);
    return imbriquee(e.M3, M);
  }
  // Niveau de détail d'une voiture à l'écran. d2 : carré de sa distance horizontale à la caméra (m²) ; t : tangente du
  // demi-champ vertical de la caméra (jeu.js : Math.tan(clamp(cam.fov, 10, 110) * Math.PI / 360)) ; hauteur : hauteur
  // de la toile en pixels ; facteur (1 par défaut ; sous 1, allège) : rapproche le seuil du modèle complet.
  // « complet » jusqu'au seuil de jeu.js (170 m à 41,6° de champ, au prorata du champ), fois facteur : avec facteur 1,
  // la même décision au bit près. Au-delà, « moyen » tant que la voiture, longue de 4,53 m, couvre encore 30 pixels de
  // la toile (critère d'écran : il ne dépend pas de facteur), « simple » ensuite. Sans hauteur (ou 0), aucune bande
  // moyenne : la décision de jeu.js telle quelle.
  const COMPLET_TAN = 170 * Math.tan(20.8 * Math.PI / 180), LONGUEUR = 4.53, PIXELS_MOYEN = 30;
  function detailPour(d2, t, hauteur, facteur) {
    const complet = facteur > 0 ? COMPLET_TAN / t * facteur : COMPLET_TAN / t;
    if (!(d2 > complet * complet)) return 'complet';
    const moyen = LONGUEUR * hauteur / (2 * t * PIXELS_MOYEN);
    return d2 <= moyen * moyen ? 'moyen' : 'simple';
  }
  // Taille du plus grand pneu à l'écran. Les seuils gardent une erreur de corde inférieure à 0,5 px ; une marge
  // de 15 % évite les bascules répétées. L'état précédent appartient à la caméra (jamais partagé entre les vues).
  function detailRouesPour(d2, t, hauteur, precedent) {
    const rayonPixels = ROUES[2].r * hauteur / (2 * Math.max(.001, t) * Math.sqrt(Math.max(.01, d2)));
    const limites = LIMITES_ROUE_PIXELS;
    let niveau = rayonPixels > limites[1] ? 0 : rayonPixels > limites[2] ? 1 : rayonPixels > limites[3] ? 2 : 3;
    if (precedent >= 0 && precedent <= 3) {
      if (niveau > precedent && rayonPixels > limites[precedent + 1] * .85) niveau = precedent;
      if (niveau < precedent && rayonPixels < limites[precedent] * 1.15) niveau = precedent;
    }
    return niveau;
  }
  // Distance minorée à la roue la plus proche, dans les trois dimensions. Le cap, la pente, le roulis et
  // la suspension déplacent les centres ; retrancher le rayon maximal garde du détail sur le bord proche du pneu.
  // Tableau de calcul partagé seulement pendant cet appel : aucune allocation dans les six vues possibles.
  const M_DISTANCE_ROUES = new Float64Array(9);
  function distanceRoues2(ev, camera) {
    const M = attitudeDans(M_DISTANCE_ROUES, ev), p = ev.p, rebond = ev.rebond;
    let distance2 = Infinity;
    for (let i = 0; i < ROUES.length; i++) {
      const w = ROUES[i], y = w.r + (rebond ? rebond[i] || 0 : 0);
      const x = p[0] + M[0] * w.x + M[3] * y + M[6] * w.z - camera[0];
      const h = p[1] + M[1] * w.x + M[4] * y + M[7] * w.z - camera[1];
      const z = p[2] + M[2] * w.x + M[5] * y + M[8] * w.z - camera[2];
      distance2 = Math.min(distance2, x * x + h * h + z * z);
    }
    const distance = Math.max(.1, Math.sqrt(distance2) - ROUES[2].r);
    return distance * distance;
  }

  // ---------------------------------------------------------------- cockpit
  // Œil du cockpit dans le repère de la voiture. Ce n'est pas l'œil du pilote : il est plus bas et 0,30 m plus en
  // arrière, 16 cm au-dessus des pneus avant pour les cadrer aux coins du bas, comme dans vroom-unreal 0.35. Pour la
  // même raison, le capot de l'habitacle y est plus bas que sur la voiture vue de dehors : le nez se voit au milieu.
  const OEIL = [-.30, .74, 0];
  // Volant, planche, gants et avant-bras sont composés à leur place apparente vue de l'œil (VOLANT.centre : 1 m devant,
  // 16° sous l'horizon), puis ramenés vers l'œil par une homothétie de rapport K. L'image ne change pas et l'ensemble
  // tient dans l'habitacle, devant le capot.
  const K = .5;
  // Cadrage de vroom-unreal 0.35 : le volant est gros et bas, 16,8° sous l'horizon ; le bas de sa jante sort de l'image
  // (41,6° de champ vertical), les mains sont au premier plan et les manches quittent le champ dès le poignet.
  // Comme dans vroom-unreal, la face du volant regarde le pilote et un peu le bas (inclinaison négative : le haut de la
  // jante vient vers lui) : l'axe des mains, perpendiculaire au volant, prolonge celui des avant-bras qui montent du bas
  // de l'image, sans casser le poignet. Mains à 9 h et 3 h, sur les branches (prise : angle depuis le haut de la jante).
  // David (16/11 : « rapproche le pilote du volant, il a des bras de 10 km ») : l'ensemble volant, planche et levier
  // est 12 % plus près de l'œil, 15,5° sous l'horizon pour garder les mains dans un cadre 16:9 de 60°, et les coudes
  // plus bas : les manches sortent de l'image juste après les poignets, même dans une fenêtre presque carrée.
  const VOLANT = { centre: [.88, -.244, 0], rayon: .125, inclinaison: -.436, course: 1.6, prise: Math.PI / 2 };
  // Planche : face au pilote, inclinée de 25° vers l'arrière ; elle ne suit pas l'inclinaison du volant.
  const PLANCHE = [.986, -.163, 0], PENTE_PLANCHE = .436;
  const COUDE = [.50, -.68, .19];              // coude du pilote, bras repliés près du corps, sous l'image (vroom-unreal)
  const LEVIER = [.818, -.27, .262];           // pommeau du levier de vitesses, à droite du volant, au point mort
  const REGIME_LAMPE = 12000;                  // la lampe de la casquette s'allume : il est temps de monter un rapport
  // Afficheurs à sept segments : a en haut, puis b, c, d, e, f dans le sens des aiguilles d'une montre, g au milieu.
  const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', N: 'ceg', R: 'abefg', '-': 'g' };
  const AMBRE = [1, .56, .12], ETEINT = [.09, .035, .02];
  // Formes libres du cockpit, en positions apparentes (voir K). Planche et casquette dans le repère de la planche
  // (x : vers la droite, y : vers le haut de la planche, z : vers le pilote) ; jante et branches dans celui du volant
  // (x : vers le haut de la jante, y : vers le pilote, z : vers la droite de la jante).
  {
    const R = VOLANT.rayon, e = R / .105, sym = (sec, ...xs) => xs.map(x => Object.assign({}, sec, { x }));
    forme('planche', C.carene([{ x: -.200, y0: -.044, y1: .044, l: .005, n: 6 }, ...sym({ y0: -.056, y1: .056, l: .009, n: 6 }, -.192, .192), { x: .200, y0: -.044, y1: .044, l: .005, n: 6 }], { cotes: 20, pas: 2 }));
    forme('casquette', C.carene([{ x: -.206, y0: .049, y1: .055, l: .016, n: 4, z: .026 }, { x: -.19, y0: .051, y1: .064, l: .036, n: 4, z: .028 }, { x: 0, y0: .056, y1: .070, l: .040, n: 4, z: .030 },
      { x: .19, y0: .051, y1: .064, l: .036, n: 4, z: .028 }, { x: .206, y0: .049, y1: .055, l: .016, n: 4, z: .026 }], { cotes: 20, pas: 3 }));
    forme('jante', C.tube(Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12; return [R * Math.cos(a), 0, R * Math.sin(a)]; }), .0225 * e / 2, { cotes: 10, ferme: true, pas: 2 }));
    // une branche le long de x, de la flasque à la jante, aux bords arrondis ; trois copies : 3 h, 9 h et 6 h
    const branche = C.carene([{ x: .028 * e, y0: -.003, y1: .003, l: .0135 * e, n: 4 }, { x: R * .98, y0: -.003, y1: .003, l: .0135 * e, n: 4 }], { cotes: 12, pas: 1 });
    const autourY = a => [[Math.cos(a), 0, -Math.sin(a)], [0, 1, 0], [Math.sin(a), 0, Math.cos(a)]];
    forme('branches', [].concat(...[-Math.PI / 2, Math.PI / 2, Math.PI].map(a => C.transformer(branche, autourY(a)))));
  }
  // Mains : le maillage de src/main.js (main droite, taille réelle, repère de la prise) et son miroir pour la gauche
  const MAIN = B.main.construire(), MAIN_OUVERT = B.main.construire(true);
  for (const [cote, t] of [['d', x => x], ['g', C.miroir]]) for (const piece of ['gant', 'paume', 'garde', 'poignet', 'sangle']) forme('main-' + piece + '-' + cote, t(MAIN[piece]));
  forme('main-gant-d-ouvert', MAIN_OUVERT.gant);                  // cockpit-3 : doigts ouverts pendant le trajet au pommeau
  // Quatre prises intermédiaires, préparées une fois : les doigts se délient avant que le poignet recule.
  const PRISES_MAIN = ['main-gant-d'];
  for (let n = 1; n < 5; n++) { const nom = 'main-gant-d-prise-' + n; forme(nom, B.main.construire(n / 5).gant); PRISES_MAIN.push(nom); }
  PRISES_MAIN.push('main-gant-d-ouvert');
  // Variantes préparées une fois : les deux mains savent quitter la jante, puis déplier des doigts lisibles.
  const PRISES_GAUCHE = ['main-gant-g'], GESTES_MAIN = { majeur: { d: [], g: [] }, poing: { d: [], g: [] }, salut: { d: [], g: [] } };
  for (let n = 1; n <= 5; n++) { const nom = 'main-gant-g-prise-' + n; forme(nom, C.miroir(B.main.construire(n / 5).gant)); PRISES_GAUCHE.push(nom); }
  for (const geste of ['majeur', 'poing', 'salut']) for (let n = 0; n <= 5; n++) {
    const gant = B.main.construire(1, { geste, progression: n / 5 }).gant;
    for (const cote of ['d', 'g']) {
      const nom = 'main-geste-' + geste + '-' + cote + '-' + n;
      forme(nom, cote === 'd' ? gant : C.miroir(gant)); GESTES_MAIN[geste][cote].push(nom);
    }
  }
  const FORMES_EXPRESSIONS = [...PRISES_MAIN, ...PRISES_GAUCHE, ...Object.values(GESTES_MAIN).flatMap(g => [...g.d, ...g.g])];
  // Appel sous le voile : les sommets sont déjà dans le buffer GPU global, mais chaque packer d'instances
  // prépare aussi ici ses groupes de formes (vue extérieure et overlay), avant le premier geste en démo.
  function preparerExpressions(sortie, p) {
    const mat = B.cockpitMatieres ? B.cockpitMatieres.tissu : TISSU;
    for (const nom of FORMES_EXPRESSIONS) for (const overlay of [false, true]) {
      const f = FORMES[nom];
      sortie.push({ shape: f.nom, p: Array.from(p), s: f.taille.map(v => v * .9 * ECHELLE), r: [0, 0, 0], mat, color: IVOIRE, surface: 'object', overlay });
    }
    return FORMES_EXPRESSIONS.length * 2;
  }
  const clarte = c => .3 * c[0] + .59 * c[1] + .11 * c[2], ecart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Courbes de l'habitacle, écrites en place dans habitacle et majVolant (aucun appel par pose) : borner(x, a, b) vaut
  // x < a ? a : x > b ? b : x ; lisse(a, b, x) vaut u·u·(3 − 2u), u = borner((x − a) / (b − a), 0, 1). Position du
  // pommeau selon le rapport n, grille en H (impairs vers l'avant, pairs vers l'arrière ; 1-2 à gauche) : pour n > 0,
  // ((n % 2 ? 1 : −1)·0,024 ; (⌊(n − 1) / 2⌋ − 1)·0,017), sinon (0 ; 0).

  // etat = { regime (tr/min), volant (−1 à 1), rapport (0 = point mort, −1 = marche arrière), kmh (vitesse affichée),
  //          passage (0 à 1 : avancement du changement de rapport en cours, 1 ou absent : aucun), rapportAvant,
  //          derriere ([{ x, z, couleur }] : rivaux dans le repère de la voiture, du plus proche au plus loin),
  //          ciel, brume (couleurs du jour, pour les glaces des rétroviseurs) }
  function cockpit(mod, ev, sortie, etat) {
    const e = etatRendu(mod), M = attitudeDans(MS, ev);
    poserTable(tableDe(e, mod, etat.casse ? EPAVE : CORPS, 3), M, ev, sortie, etat.roues, false,
      etat.rouesDetail === undefined ? 0 : Math.max(0, Math.min(3, etat.rouesDetail | 0)));
    const H = e.habitacle || (e.habitacle = construireHabitacle(mod));
    const articule = !!ev.pilote;
    if (H.piloteReel !== articule) { H.piloteReel = articule; H.pret = false; }
    habitacle(H, M, ev, sortie, etat);
    return imbriquee(e.M3, M);
  }

  // ---------------------------------------------------------------- habitacle de la vue cockpit
  // Repères du volant : plan incliné face au pilote (WU vers le haut de la jante, WN vers le pilote), rotation phi ;
  // repère de la planche : PU vers son haut, PN vers le pilote.
  const TAU = VOLANT.inclinaison, CV = VOLANT.centre, RV = VOLANT.rayon, E_VOLANT = RV / .105, PRISE = VOLANT.prise;
  const WN = [-Math.cos(TAU), Math.sin(TAU), 0], WU = [Math.sin(TAU), Math.cos(TAU), 0], WR = [0, 0, 1];
  const PN = [-Math.cos(PENTE_PLANCHE), Math.sin(PENTE_PLANCHE), 0], PU = [Math.sin(PENTE_PLANCHE), Math.cos(PENTE_PLANCHE), 0];
  const BRANCHES = CV.map((v, k) => v + WN[k] * -.004), VIS_R = .0245 * E_VOLANT;
  const VIS = [0, 1, 2].map(b => { const a = b * 2.0944 + 1.0472; return [Math.cos(a), Math.sin(a)]; });
  const PIED = [LEVIER[0], LEVIER[1] - .14, LEVIER[2] + .012], ECHELLE = RV / B.main.JANTE.R, PIECES_MAIN = ['gant', 'paume', 'garde', 'poignet', 'sangle'];
  const VERS_A = MAIN.points.poignet.map((v, i) => v + MAIN.points.axe[i] * .012), VERS_B = MAIN.points.poignet.map((v, i) => v + MAIN.points.axe[i] * .03);
  const LAMPE_ALLUMEE = [1, .13, .04], LAMPE_ETEINTE = [.20, .03, .02], ALERTE = [1, .14, .05], TEMOIN_ETEINT = [.2, .03, .02];
  const CIEL = [.66, .77, .88], BRUME = [.62, .70, .76], PERSONNE = Object.freeze([]);
  // Segments allumés d'un caractère des afficheurs : bit s pour le segment LETTRES[s]
  const LETTRES = 'abcdefg';
  function masqueTexte(texte) {
    const seg = SEGMENTS[texte] || '';
    let m = 0;
    for (let s = 0; s < 7; s++) if (seg.includes(LETTRES[s])) m |= 1 << s;
    return m;
  }
  const MASQUE_CHIFFRE = Array.from({ length: 10 }, (_, d) => masqueTexte(String(d))), MASQUE_R = masqueTexte('R'), MASQUE_N = masqueTexte('N');
  // rapport affiché (R, N ou son numéro), sans chaîne neuve pour les rapports de 1 à 9
  function masqueRapport(r) {
    if (r < 0) return MASQUE_R;
    if (r > 0) return typeof r === 'number' && r <= 9 && Math.floor(r) === r ? MASQUE_CHIFFRE[r] : masqueTexte(String(r));
    return MASQUE_N;
  }

  // L'habitacle d'une voiture : les pièces de la vue cockpit dans l'ordre où elles sont posées, chacune avec son objet
  // de rendu, sa place dans le repère de la voiture (o) et son repère de rotation (rep, null : celui de la caisse).
  // Planche, cadrans, interrupteurs, boîtiers et pattes des rétroviseurs ne bougent pas : calculés ici, une fois.
  // À chaque pose ne changent que les aiguilles, la lampe et le témoin d'alerte, les segments des afficheurs (matière,
  // couleur, émission), le fond et les voitures des glaces ; volant, levier et mains seulement quand le braquage, le
  // passage ou les rapports changent (majVolant). Ce qui est gardé d'une pose à l'autre est recalculé, quand il
  // change, par les mêmes opérations dans le même ordre : l'image ne dépend pas de ce qui a été gardé.
  function construireHabitacle(mod) {
    const liv = mod.livree, c1 = liv.couleur, c2 = liv.seconde || BLANC;
    const H = { rotM: trois(), epoque: 0, c2, pret: false, cle: new Float64Array(10), planche: [], lampe: null, alerte: null, aiguilles: [],
      rapport: null, diagonale: null, vitesse: [], volant: [], rJante: null, jante: null, branches: null, rCaches: null, caches: [], vis: [],
      ruban: null, moyeu: [], supportVolant: [], tige: null, pommeau: null, mains: null, glaces: [],
      piloteReel: false, articulations: new Float64Array(18) };
    const reperes = [];
    const repere = m => {   // repère fixe, partagé par les pièces de même rotation
      const f = aplatir(m);
      let r = reperes.find(x => memes(x.m, f));
      if (!r) reperes.push(r = { m: f, r: trois(), epoque: -1 });
      return r;
    };
    const libre = () => ({ m: new Float64Array(9), r: trois(), epoque: -1 });   // repère recalculé (aiguilles, volant, mains)
    const emplacement = (shape, s, mat, color, m, emissive) => {
      const rep = m === null || m === undefined ? null : Array.isArray(m) ? repere(m) : m;
      return { objet: { shape, p: trois(), s, r: rep ? rep.r : H.rotM, mat, color, overlay: true, surface: 'object', emissive }, o: new Float64Array(3), rep };
    };
    const reduite = s => { const q = trois(); q[0] = s[0] * K; q[1] = s[1] * K; q[2] = s[2] * K; return q; };
    // mettre : pièce composée vue de l'œil (place apparente v, ramenée vers lui) ; dans : pièce à sa vraie place
    const mettre = (shape, v, s, mat, color, m, emissive) => { const e = emplacement(shape, reduite(s), mat, color, m, emissive); if (v) { e.o[0] = v[0]; e.o[1] = v[1]; e.o[2] = v[2]; versVoiture(e.o); } return e; };
    const dans = (shape, o, s, mat, color, m) => { const e = emplacement(shape, s, mat, color, m, undefined); if (o) { e.o[0] = o[0]; e.o[1] = o[1]; e.o[2] = o[2]; } return e; };
    const cadre = [WR, PU, PN], rond = [PU, PN, WR], plat = [PN.map(v => -v), PU, WR];
    const plus = (a, ...termes) => a.map((v, k) => termes.reduce((s, [d, f]) => s + d[k] * f, v));
    const cap = b => PU.map((v, k) => v * Math.cos(b) + WR[k] * Math.sin(b));           // direction dans le plan de la planche
    const sur = (a, b, d) => plus(PLANCHE, [WR, a], [PU, b], [PN, d]);                 // point de la planche : droite, haut, vers le pilote
    const trait = (centre, b, rayon, long, large, mat, color, emissive) => { const d = cap(b); return mettre('box', plus(centre, [d, rayon]), [long, .002, large], mat, color, [d, PN, croix(d, PN)], emissive); };
    const posee = (nom, origine, m, mat, color) => { const f = FORMES[nom]; return mettre(f.nom, plus(origine, [m[0], f.centre[0]], [m[1], f.centre[1]], [m[2], f.centre[2]]), f.taille, mat, color, m); };

    // Planche : tôle sombre, vis des coins, casquette noire, lampe de régime, fenêtres des afficheurs
    const L = H.planche;
    L.push(posee('planche', PLANCHE, cadre, MAT, [.075, .078, .085]));
    for (const a of [-.184, .184]) for (const b of [-.048, .048]) L.push(mettre('cylinder', sur(a, b, .0095), [.008, .004, .008], METAL_MAT, ARGENT, rond));
    L.push(posee('casquette', PLANCHE, cadre, MAT, NOIR));
    L.push(mettre('cylinder', sur(-.164, 0, .024), [.032, .008, .032], MAT, NOIR, rond));
    L.push(H.lampe = mettre('sphere', sur(-.164, 0, .030), [.024, .024, .024], 5, LAMPE_ETEINTE, null));
    L.push(mettre('box', sur(-.125, .006, .0085), [.004, .054, .036], LAQUE, [.012, .012, .014], plat));
    L.push(mettre('box', sur(.142, .004, .0085), [.004, .042, .080], LAQUE, [.012, .012, .014], plat));
    // cadrans : lunette, fond, graduations, aiguille (place et repère recalculés), cache central
    const cadran = (a, b, d, fond) => { L.push(mettre('cylinder', sur(a, b, .009), [d + .010, .008, d + .010], METAL_MAT, ARGENT, rond), mettre('cylinder', sur(a, b, .012), [d, .006, d], MAT, fond, rond)); return sur(a, b, .016); };
    const aiguille = (centre, rayon, long, large, emissive) => { const e = mettre('box', null, [long, .002, large], 5, [1, .40, .08], libre(), emissive); e.centre = centre; e.rayon = rayon; H.aiguilles.push(e); L.push(e); };
    const tours = cadran(0, 0, .089, [.02, .02, .022]);
    for (let g = 0; g <= 13; g++) {
      const long = g % 2 ? .006 : .011, rouge = g >= 12;
      L.push(trait(tours, -2.36 + 4.72 * g / 13, .041 - long / 2, long, .0028, rouge ? 5 : TISSU, rouge ? [1, .1, .05] : IVOIRE, rouge ? .5 : undefined));
    }
    aiguille(plus(tours, [PN, .002]), .014, .037, .0036, .9);
    L.push(mettre('cylinder', plus(tours, [PN, .003]), [.016, .006, .016], METAL_MAT, ARGENT, rond));
    for (const a of [-.074, .074]) {
      const centre = cadran(a, -.006, .040, [.02, .02, .022]);
      for (let g = 0; g < 5; g++) L.push(trait(centre, -1.2 + .6 * g, .0155, .005, .0022, TISSU, IVOIRE));
      aiguille(plus(centre, [PN, .0015]), .008, .017, .0026, .7);
      L.push(mettre('cylinder', plus(centre, [PN, .002]), [.008, .005, .008], METAL_MAT, ARGENT, rond));
    }
    for (const a of [-.046, -.034]) L.push(mettre('cylinder', sur(a, -.043, .011), [.010, .006, .010], METAL_MAT, ARGENT, rond), mettre('box', sur(a, -.039, .019), [.003, .011, .003], METAL_MAT, ARGENT, cadre));
    const voyant = (a, b, couleur, force) => { L.push(mettre('cylinder', sur(a, b, .012), [.0125, .005, .0125], METAL_MAT, [.32, .32, .34], rond)); const e = mettre('sphere', sur(a, b, .016), [.009, .009, .009], 5, couleur, null, force); L.push(e); return e; };
    voyant(.032, -.043, [.14, .9, .3], 1.1);                 // contact : toujours allumé
    H.alerte = voyant(.050, -.043, TEMOIN_ETEINT, undefined);
    // Afficheurs à sept segments : rapport (et sa diagonale pour R), trois chiffres de vitesse
    const chiffre = (centre, h) => {
      const l = h * .56, t = h * .13, places = [[0, h / 2, l, t], [l / 2, h / 4, t, h / 2], [l / 2, -h / 4, t, h / 2], [0, -h / 2, l, t], [-l / 2, -h / 4, t, h / 2], [-l / 2, h / 4, t, h / 2], [0, 0, l, t]];
      return places.map(([x, y, sx, sy]) => mettre('box', plus(centre, [WR, x], [PU, y], [PN, .011]), [sx, sy, .002], MAT, ETEINT, cadre));
    };
    {
      const centre = plus(PLANCHE, [WR, -.125], [PU, .006]), h = .036, l = h * .56, t = h * .13;
      H.rapport = chiffre(centre, h);
      const long = Math.hypot(l / 2, h / 2), d = WR.map((v, k) => (v * l / 2 - PU[k] * h / 2) / long);
      H.diagonale = mettre('box', plus(centre, [WR, l / 4], [PU, -h / 4], [PN, .011]), [t, long, .002], 5, AMBRE, [croix(d, PN), d, PN], 1.1);
    }
    for (let k = 0; k < 3; k++) H.vitesse.push(chiffre(plus(PLANCHE, [WR, .118 + k * .024], [PU, .004]), .026));
    // Volant, levier et mains : places et repères posés par majVolant
    const V = H.volant;
    H.rJante = libre(); H.rCaches = [libre(), libre(), libre()];
    V.push(H.jante = mettre(FORMES.jante.nom, null, FORMES.jante.taille, TISSU, [.045, .045, .05], H.rJante));
    V.push(H.branches = mettre(FORMES.branches.nom, null, FORMES.branches.taille, METAL_MAT, ACIER, H.rJante));
    for (let j = 0; j < 3; j++) for (let q = 0; q < 2; q++) { const b = mettre('box', null, [RV * .17, .003, .010 * E_VOLANT], MAT, NOIR, H.rCaches[j]); H.caches.push(b); V.push(b); }
    H.moyeu.push(mettre('cylinder', plus(CV, [WN, .002]), [.060 * E_VOLANT, .012, .060 * E_VOLANT], METAL_MAT, ACIER, H.rJante));
    H.moyeu.push(mettre('cylinder', plus(CV, [WN, .008]), [.040 * E_VOLANT, .012, .040 * E_VOLANT], MAT, NOIR, H.rJante));
    V.push(...H.moyeu);
    // L'arbre suit l'axe du moyeu jusqu'à la vraie face de la planche ; le palier et les attaches sont fixes.
    // La copie extérieure conservait seulement jante/branches : ni cette liaison, ni même la planche n'existaient.
    const profondeurColonne = ((CV[0] - PLANCHE[0]) * PN[0] + (CV[1] - PLANCHE[1]) * PN[1]) / (WN[0] * PN[0] + WN[1] * PN[1]);
    const fondColonne = plus(CV, [WN, -profondeurColonne]), axeFixe = [WU, WN, WR];
    H.supportVolant.push(mettre('cylinder', plus(CV, [WN, -.5 * profondeurColonne]), [.029, profondeurColonne + .010, .029], METAL_MAT, ACIER, axeFixe));
    H.supportVolant.push(mettre('cylinder', plus(fondColonne, [WN, .012]), [.055, .034, .055], MAT, [.065, .065, .07], axeFixe));
    H.supportVolant.push(mettre('box', plus(fondColonne, [PN, -.004]), [.084, .028, .018], MAT, [.055, .055, .06], cadre));
    // Deux montants descendent de la planche dans la cuve. Leur place physique est partagée par les trois vues.
    for (const k of [-1, 1]) {
      const haut = sur(k * .14, -.036, -.008), bas = [.40, .415, k * .126].map((v, i) => ((v - PILOTE_DECALAGE[i]) / PILOTE_ECHELLE - OEIL[i]) / K);
      const axe = haut.map((v, i) => v - bas[i]), centre = haut.map((v, i) => (v + bas[i]) * .5);
      H.supportVolant.push(mettre('cylinder', centre, [.026, Math.hypot(...axe) + .008, .026], MAT, [.045, .045, .05], selonAxe(axe)));
    }
    for (let b = 0; b < 3; b++) { const v = mettre('cylinder', null, [.007 * E_VOLANT, .004, .007 * E_VOLANT], METAL_MAT, ARGENT, H.rJante); H.vis.push(v); V.push(v); }
    const TUBE = .0225 * E_VOLANT;
    V.push(H.ruban = mettre('cylinder', null, [TUBE + .003, .010, TUBE + .003], TISSU, IVOIRE, libre()));
    V.push(H.tige = mettre('cylinder', null, [.011, 0, .011], METAL_MAT, ARGENT, libre()));
    V.push(H.pommeau = mettre('sphere', null, [.040, .040, .040], METAL_MAT, [.80, .81, .83], null));
    // gant de la couleur de la voiture (sombre si elle est très claire), paume de cuir, garde, élastique, sangle
    const combi = liv.combinaison || c1.map(v => v * .7), gant = clarte(c1) > .62 ? [.13, .13, .15] : c1, cuir = [.055, .05, .048];
    const couleurs = [gant, cuir, gant.map(v => v * .8), [.06, .06, .065], gant.map(v => v * .92)];
    const variante = nom => { const fo = FORMES[nom]; return { nom: fo.nom, c: fo.centre.map(v => v * ECHELLE), s: reduite(fo.taille.map(v => v * ECHELLE)) }; };
    H.mains = [-1, 1].map(k => {
      const cote = k > 0 ? 'd' : 'g', rep = libre(), main = { k, rep, pieces: [], tubes: [], boules: [], coude: Float64Array.of(COUDE[0], COUDE[1], k * COUDE[2]) };
      PIECES_MAIN.forEach((nom, q) => {
        const ferme = variante('main-' + nom + '-' + cote), e = emplacement(ferme.nom, ferme.s, TISSU, couleurs[q], rep, undefined);
        e.ferme = ferme; e.ouvert = k > 0 && nom === 'gant' ? variante('main-gant-d-ouvert') : ferme;
        e.prises = nom === 'gant' ? (k > 0 ? PRISES_MAIN : PRISES_GAUCHE).map(variante) : null;
        e.gestes = nom === 'gant' ? [null, GESTES_MAIN.majeur[cote].map(variante), GESTES_MAIN.poing[cote].map(variante), GESTES_MAIN.salut[cote].map(variante)] : null;
        main.pieces.push(e); V.push(e);
      });
      for (let n = 1; n <= 6; n++) {
        const d = (.050 + .022 * n / 6) * ECHELLE, tube = mettre('cylinder', null, [d, 0, d], TISSU, combi, libre()), boule = mettre('sphere', null, [d, d, d], TISSU, combi, null);
        main.tubes.push(tube); main.boules.push(boule); V.push(tube, boule);
      }
      return main;
    });
    // Rétroviseurs : boîtier et patte fixes, glace vive, ou fond (ciel, horizon, piste) et cinq places de voitures
    const GL = RETRO.l, GH = RETRO.h, fb = FORMES['retro-boitier'];
    for (const k of [-1, 1]) {
      const g = cadreGlace(k), { c, n: nr, w, m } = g;
      const vers = (dx, dy, dz) => plus(c, [nr, -dx], [[0, 1, 0], dy], [w, dz]);
      const attache = vers(.06, -GH * .45, -k * .03), pied = [c[0] + .07, .56, k * .29], axe = pied.map((v, i) => v - attache[i]);
      const G = { k, c, n: nr, w, suiveurs: [],
        boitier: dans(fb.nom, plus(c, [m[0], fb.centre[0]], [m[1], fb.centre[1]], [m[2], fb.centre[2]]), fb.taille, PEINTURE, c1, m),
        patte: dans('cylinder', attache.map((v, i) => (v + pied[i]) / 2), [.018, Math.hypot(axe[0], axe[1], axe[2]), .018], PEINTURE, c1, selonAxe(axe)),
        vive: dans('box', vers(-.002, 0, 0), [.003, GH, GL], LAQUE, [.05, .055, .06], m),
        ciel: dans('box', vers(-.002, GH * .25, 0), [.003, GH * .5, GL], LAQUE, trois(), m),
        brume: dans('box', vers(-.002, -GH * .04, 0), [.003, GH * .1, GL], LAQUE, trois(), m),
        fond: dans('box', vers(-.002, -GH * .295, 0), [.003, GH * .41, GL], LAQUE, [.10, .105, .11], m) };
      G.ciel.couleur = G.ciel.objet.color; G.brume.couleur = G.brume.objet.color;
      for (let n = 0; n < 5; n++) {
        const s1 = trois(), s2 = trois(); s1[0] = .003; s2[0] = .003;
        G.suiveurs.push(dans('box', null, s1, LAQUE, c2, m), dans('box', null, s2, MAT, [.03, .03, .035], m));
      }
      H.glaces.push(G);
    }
    return B.cockpitMatieres ? B.cockpitMatieres.habitacle(H) : H;
  }

  // Pilote extérieur : la même cinématique de prise/levier que le cockpit, ramenée à la taille du corps réel.
  // ev.pilote ajoute regard (rad, +droite), geste, gesteCote (-1 gauche), gestePhase et gesteIntensite.
  // Cet objet permanent est fourni par jeu.js. L'animation
  // est une fonction de cette pose : ni horloge cachée, ni avancement par caméra, ni écriture dans la simulation.
  // Sans ce champ, les anciennes poses et leurs empreintes restent strictement inchangées.
  const PILOTE_COU = [0, .772, 0], PILOTE_RECUL = -.10, PILOTE_VOLANT = [.25, .70, 0], PILOTE_ECHELLE = .9 / K;
  const PILOTE_DECALAGE = PILOTE_VOLANT.map((v, i) => v - (OEIL[i] + K * CV[i]) * PILOTE_ECHELLE);
  // Les places du cockpit sont choisies pour son cadrage. Leur homothétie seule plaçait le pied du levier dans
  // le flanc droit. Les ancrages extérieurs sont mesurés dans la cellule : volant avancé, levier à l'intérieur
  // du jonc. La main droite applique le même déplacement à la cible de sa courbe, sans déformer le gant.
  const PILOTE_LEVIER = [.18, .57, .16];
  const PILOTE_LEVIER_DECALAGE = PILOTE_LEVIER.map((v, i) => v - PILOTE_DECALAGE[i] - PILOTE_ECHELLE * (OEIL[i] + K * LEVIER[i]));
  // Pied au-dessus du fond réel de la cuve (y ≈ .48), serti dans la console à y .50.
  const PILOTE_PIED_LEVIER = [PILOTE_LEVIER[0], .50, PILOTE_LEVIER[2] + .0108];
  // Le pied est fixé à une petite console arrondie, elle-même ancrée dans le fond de la cuve. Son sommet
  // reçoit les deux derniers millimètres de la tige ; le reste du débattement est libre dans l'habitacle.
  forme('console-levier-pilote', C.carene([
    { x: PILOTE_PIED_LEVIER[0] - .06, y0: .415, y1: PILOTE_PIED_LEVIER[1] - .012, l: .012, n: 3, z: PILOTE_PIED_LEVIER[2] },
    { x: PILOTE_PIED_LEVIER[0] - .025, y0: .415, y1: PILOTE_PIED_LEVIER[1] + .002, l: .030, n: 4, z: PILOTE_PIED_LEVIER[2] },
    { x: PILOTE_PIED_LEVIER[0] + .025, y0: .415, y1: PILOTE_PIED_LEVIER[1] + .002, l: .030, n: 4, z: PILOTE_PIED_LEVIER[2] },
    { x: PILOTE_PIED_LEVIER[0] + .06, y0: .415, y1: PILOTE_PIED_LEVIER[1] - .012, l: .012, n: 3, z: PILOTE_PIED_LEVIER[2] }
  ], { cotes: 16, pas: 3 }));

  function construirePiloteExterieur(mod, H) {
    const liv = mod.livree, combi = liv.combinaison || liv.couleur.map(v => v * .7);
    const tissuPilote = B.cockpitMatieres ? B.cockpitMatieres.tissu : TISSU;
    const R = { habitacle: H, tete: new Float64Array(9), articulations: H.articulations, variantes: [] };
    // Une réserve par LOD/overlay et par rétroviseur : aucune place, rotation ou taille ne passe d'une vue à l'autre.
    for (let variante = 0; variante < 10; variante++) {
      const li = variante < 8 ? variante >> 1 : variante === 8 ? CORPS : EPAVE;
      const niveau = li === SIMPLES ? 2 : li === MOYENS ? 1 : 0, overlay = variante < 8 && !!(variante & 1);
      const V = { niveau, rotM: trois(), pieces: [] };
      const objet = (shape, mat, color) => {
        const o = { shape, p: trois(), s: trois(), r: trois(), mat, color, surface: 'object' };
        if (overlay) o.overlay = true;
        return o;
      };
      const ajouter = (role, source, simple) => {
        const o = objet(simple || source.objet.shape, source.objet.mat, source.objet.color);
        if (!source.rep) o.r = V.rotM;
        V.pieces.push({ role, source, simple, objet: o });
      };
      ajouter('volant', H.jante, niveau === 2 ? 'cylinder' : null);
      if (niveau < 2) ajouter('branches', H.branches, null);
      for (let i = 0; i < H.moyeu.length; i++) ajouter('moyeu-' + i, H.moyeu[i], null);
      ajouter('planche', H.planche[0], null); ajouter('casquette', H.planche[5], null);
      for (let i = 0; i < H.supportVolant.length; i++) ajouter('support-volant-' + i, H.supportVolant[i], null);
      ajouter('levier', H.tige, null); ajouter('pommeau', H.pommeau, null);
      {
        const f = FORMES['console-levier-pilote'], o = objet(f.nom, MAT, [.035, .035, .04]);
        o.s[0] = f.taille[0]; o.s[1] = f.taille[1]; o.s[2] = f.taille[2]; o.r = V.rotM;
        V.pieces.push({ role: 'console-levier', fixe: f.centre, objet: o });
      }
      if (niveau > 0) {
        const o = objet('sphere', tissuPilote, combi); o.s[0] = .30; o.s[1] = .20; o.s[2] = .38; o.r = V.rotM;
        V.pieces.push({ role: 'buste', fixe: [-.04 + PILOTE_RECUL, .66, 0], objet: o });
      }
      for (let h = 0; h < 2; h++) {
        const main = H.mains[h], j = h * 9;
        for (let q = 0; q < (niveau === 0 ? main.pieces.length : 1); q++)
          ajouter('gant-' + h + '-' + q, main.pieces[q], niveau === 2 ? 'sphere' : null);
        {
          const o = objet('sphere', tissuPilote, combi); o.s[0] = o.s[2] = .075;
          V.pieces.push({ role: 'bras-' + h, de: j, a: j + 3,
            m: new Float64Array(9), objet: o });
        }
        // Les avant-bras sont les mêmes manches articulées que dans l'habitacle : aucune seconde pose IK.
        for (let n = 0; n < main.tubes.length; n++) {
          ajouter(n === 0 ? 'avant-bras-' + h : 'avant-bras-' + h + '-' + n, main.tubes[n], null);
          ajouter('manche-joint-' + h + '-' + n, main.boules[n], null);
        }
        const o = objet('sphere', tissuPilote, combi); o.s[0] = o.s[1] = o.s[2] = .075; o.r = V.rotM;
        V.pieces.push({ role: 'coude-' + h, joint: j + 3, objet: o });
      }
      R.variantes.push(V);
    }
    return R;
  }

  function preparerPiloteExterieur(R, etat) {
    const H = R.habitacle, cle = H.cle;
    if (!H.piloteReel) { H.piloteReel = true; H.pret = false; }
    let volant = Number.isFinite(etat.volant) ? etat.volant : 0;
    volant = volant < -1 ? -1 : volant > 1 ? 1 : volant;
    let t = Number.isFinite(etat.passageVisuel) ? etat.passageVisuel : Number.isFinite(etat.passage) ? etat.passage : 1;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const nB = Number.isFinite(etat.rapport) ? Math.max(-1, Math.min(6, Math.trunc(etat.rapport))) : 0;
    const nA = Number.isFinite(etat.rapportAvant) ? Math.max(-1, Math.min(6, Math.trunc(etat.rapportAvant))) : nB;
    CLE[0] = volant * VOLANT.course; CLE[1] = t;
    CLE[2] = nA > 0 ? (nA % 2 ? 1 : -1) * .024 : 0; CLE[3] = nA > 0 ? (Math.floor((nA - 1) / 2) - 1) * .017 : 0;
    CLE[4] = nB > 0 ? (nB % 2 ? 1 : -1) * .024 : 0; CLE[5] = nB > 0 ? (Math.floor((nB - 1) / 2) - 1) * .017 : 0;
    cleExpressions(etat, true);
    let change = !H.pret;
    for (let i = 0; i < 10; i++) if (!Object.is(cle[i], CLE[i])) { cle[i] = CLE[i]; change = true; }
    if (change) { majVolant(H); H.pret = true; }

    // Même aller/retour au levier que les mains. Le regard anticipe doucement le braquage et accompagne le passage,
    // sans secouer le casque ni ajouter de mouvement aléatoire à l'arrêt. Toute la tête partage le même pivot.
    let u = t / .3, retour = (t - .65) / .35;
    u = u < 0 ? 0 : u > 1 ? 1 : u; retour = retour < 0 ? 0 : retour > 1 ? 1 : retour;
    const prise = u * u * (3 - 2 * u) * (1 - retour * retour * (3 - 2 * retour));
    const regard = Number.isFinite(etat.regard) ? Math.max(-.32, Math.min(.32, etat.regard)) : 0;
    ANG[0] = -Math.max(-.46, Math.min(.46, .22 * volant + .10 * prise + regard)); ANG[1] = -.10 * prise; ANG[2] = -.035 * volant;
    produitDans(R.tete, eulerDe(T_A, ANG, 0, 1), produitDans(T_B, eulerDe(T_C, ANG, 1, 2), eulerDe(T_D, ANG, 2, 0)));

    // Les articulations sont calculées dans majVolant, en même temps que les mains et les manches.
    // R partage directement les tableaux de l'habitacle : changer de vue ne peut pas inverser les coudes.
  }

  function articulationPilote(H, h) {
    const A = H.articulations, j = h * 9, cote = h === 0 ? -1 : 1;
    // La prise dégagée demande jusqu'à 43,6 cm de portée. Ces 21/23 cm gardent les os constants,
    // avec le coude au-dessus du fond réel de la cuve ; aucun allongement pendant le geste.
    const poignet = H.mains[h].pieces[3].o, haut = .21, avant = .23;
    A[j] = -.025 + PILOTE_RECUL; A[j + 1] = .73; A[j + 2] = cote * .14;
    for (let k = 0; k < 3; k++) A[j + 6 + k] = PILOTE_DECALAGE[k] + PILOTE_ECHELLE * poignet[k];
    const dx = A[j + 6] - A[j], dy = A[j + 7] - A[j + 1], dz = A[j + 8] - A[j + 2];
    const distance = Math.max(1e-9, Math.sqrt(dx * dx + dy * dy + dz * dz)), ux = dx / distance, uy = dy / distance, uz = dz / distance;
    // Pli vers le bas de la cuve. L'ancien pôle positif (.65, ±1) levait et écartait les coudes.
    // À la jante, le pôle historique reste inchangé. Quand la main se lève, ramener le coude vers le buste
    // empêche l'humérus de traverser le jonc ; les deux os conservent exactement leurs longueurs.
    const versBuste = H.cle[6] && H.cle[7] === cote ? .9 * portionGeste(H.cle[8], .44, .85) : 0;
    const lateral = -cote * versBuste, produit = -uy + lateral * uz;
    let bx = versBuste ? -ux * produit : ux * uy, by = versBuste ? -1 - uy * produit : -1 + uy * uy, bz = versBuste ? lateral - uz * produit : uz * uy;
    let norme = Math.sqrt(bx * bx + by * by + bz * bz);
    if (norme < 1e-9) { bx = -uz; by = 0; bz = ux; norme = Math.sqrt(bx * bx + bz * bz); }
    if (norme < 1e-9) { bx = 1; by = 0; bz = 0; norme = 1; }
    const avance = (haut * haut - avant * avant + distance * distance) / (2 * distance);
    const rayon = Math.sqrt(Math.max(0, haut * haut - avance * avance)) / norme;
    A[j + 3] = A[j] + ux * avance + bx * rayon;
    A[j + 4] = A[j + 1] + uy * avance + by * rayon;
    A[j + 5] = A[j + 2] + uz * avance + bz * rayon;
    const co = H.mains[h].coude;
    for (let k = 0; k < 3; k++) co[k] = ((A[j + 3 + k] - PILOTE_DECALAGE[k]) / PILOTE_ECHELLE - OEIL[k]) / K;
  }

  function poserPiloteExterieur(R, variante, M, ev, sortie, retro) {
    const V = R.variantes[variante], A = R.articulations;
    const px = ev.p[0], py = ev.p[1], pz = ev.p[2], ca = retro ? Math.cos(ev.cap) : 0, sa = retro ? Math.sin(ev.cap) : 0;
    anglesDans(V.rotM, M);
    for (let i = 0; i < V.pieces.length; i++) {
      const e = V.pieces[i], objet = e.objet, p = objet.p;
      let x, y, z;
      if (e.source) {
        const source = e.source, local = source.o, taille = source.objet.s;
        x = PILOTE_DECALAGE[0] + PILOTE_ECHELLE * local[0];
        y = PILOTE_DECALAGE[1] + PILOTE_ECHELLE * local[1];
        z = PILOTE_DECALAGE[2] + PILOTE_ECHELLE * local[2];
        // Les décalages de commandes appartiennent désormais au modèle commun préparé dans majVolant.
        // Ici il ne reste que le changement d'échelle/cadrage global de la vue extérieure.
        objet.shape = e.simple || source.objet.shape;
        objet.s[0] = PILOTE_ECHELLE * taille[0]; objet.s[1] = PILOTE_ECHELLE * taille[1]; objet.s[2] = PILOTE_ECHELLE * taille[2];
        if (source.rep) anglesPiloteProduit(objet.r, M, source.rep.m);
      } else if (e.de !== undefined) {
        const a = e.de, b = e.a;
        x = (A[a] + A[b]) * .5; y = (A[a + 1] + A[b + 1]) * .5; z = (A[a + 2] + A[b + 2]) * .5;
        AXE[0] = A[b] - A[a]; AXE[1] = A[b + 1] - A[a + 1]; AXE[2] = A[b + 2] - A[a + 2];
        hypotDans(AXE, 3); objet.s[1] = AXE[3]; selonAxeDans(e.m, AXE); anglesProduit(objet.r, M, e.m);
      } else if (e.joint !== undefined) {
        const j = e.joint; x = A[j]; y = A[j + 1]; z = A[j + 2];
      } else { x = e.fixe[0]; y = e.fixe[1]; z = e.fixe[2]; }
      const X = px + (M[0] * x + M[3] * y + M[6] * z), Y = py + (M[1] * x + M[4] * y + M[7] * z), Z = pz + (M[2] * x + M[5] * y + M[8] * z);
      if (retro) {
        const dx = X - px, dz = Z - pz, xc = dx * ca + dz * sa, zc = dz * ca - dx * sa;
        if (!(Math.abs(xc - X_ARRIERE) < .5 && Math.abs(zc) > .55)) continue;
      }
      p[0] = X; p[1] = Y; p[2] = Z;
      sortie.push(objet);
    }
  }

  // ---- calculs de chaque pose, sans objet neuf : mêmes opérations, dans le même ordre, que euler, mul, mulM, angles et
  // selonAxe, pour les mêmes nombres au bit près.
  // Les nombres y passent d'une fonction à l'autre par des Float64Array : un nombre à virgule passé à une fonction, ou
  // rendu par elle, que le compilateur ne développe pas en ligne serait emballé dans un objet neuf à chaque appel.
  // Place apparente vue de l'œil → place dans la voiture, en place dans o
  function versVoiture(o) { o[0] = OEIL[0] + K * o[0]; o[1] = OEIL[1] + K * o[1]; o[2] = OEIL[2] + K * o[2]; }
  // forme libre posée : origine a + m0·c0 + m1·c1 + m2·c2 (m à plat, c : centre de la forme)
  function poseeDans(o, a, m, c) {
    o[0] = ((a[0] + m[0] * c[0]) + m[3] * c[1]) + m[6] * c[2]; o[1] = ((a[1] + m[1] * c[0]) + m[4] * c[1]) + m[7] * c[2]; o[2] = ((a[2] + m[2] * c[0]) + m[5] * c[1]) + m[8] * c[2];
    versVoiture(o);
  }
  // Math.hypot(v[0], v[1], v[2]) (n = 3) ou Math.hypot(v[0], v[1]) (n = 2), rangé dans v[3]. Math.hypot alloue à chaque
  // appel ; c'est ici le même calcul que celui de V8 (plus grande valeur absolue, somme de Kahan des carrés rapportés à
  // elle, racine fois elle), au bit près (verifications/voiture-permanents.test.mjs le vérifie).
  function hypotDans(v, n) {
    let max = 0, nan = false;
    for (let i = 0; i < n; i++) { const x = v[i]; if (x !== x) nan = true; else { const a = Math.abs(x); if (a > max) max = a; } }
    if (max === Infinity) { v[3] = Infinity; return; }
    if (nan) { v[3] = NaN; return; }
    if (max === 0) { v[3] = 0; return; }
    let somme = 0, reste = 0;
    for (let i = 0; i < n; i++) { const q = Math.abs(v[i]) / max, terme = q * q - reste, s = somme + terme; reste = (s - somme) - terme; somme = s; }
    v[3] = Math.sqrt(somme) * max;
  }
  const AXE = new Float64Array(4);   // axe ou vecteur à mesurer (0 à 2), sa longueur (3)
  // selonAxe([A[0], A[1], A[2]]), à plat dans m ; A[3] puis A[0 à 2] servent ensuite aux longueurs
  function selonAxeDans(m, A) {
    hypotDans(A, 3);
    const l = A[3] || 1, y0 = A[0] / l, y1 = A[1] / l, y2 = A[2] / l, droit = Math.abs(y1) < .9, h0 = droit ? 0 : 1, h1 = droit ? 1 : 0, h2 = 0;
    const x0 = y1 * h2 - y2 * h1, x1 = y2 * h0 - y0 * h2, x2 = y0 * h1 - y1 * h0;
    A[0] = x0; A[1] = x1; A[2] = x2; hypotDans(A, 3);
    const lx = A[3] || 1, X0 = x0 / lx, X1 = x1 / lx, X2 = x2 / lx;
    m[0] = X0; m[1] = X1; m[2] = X2; m[3] = y0; m[4] = y1; m[5] = y2;
    m[6] = X1 * y2 - X2 * y1; m[7] = X2 * y0 - X0 * y2; m[8] = X0 * y1 - X1 * y0;
  }
  function tournerColonnes(m, n, A) { // rotation d'angle A[0] autour de l'axe unitaire n, de chaque colonne de m
    const c = Math.cos(A[0]), s = Math.sin(A[0]);
    for (let j = 0; j < 9; j += 3) {
      const v0 = m[j], v1 = m[j + 1], v2 = m[j + 2];
      const x0 = n[1] * v2 - n[2] * v1, x1 = n[2] * v0 - n[0] * v2, x2 = n[0] * v1 - n[1] * v0, d = n[0] * v0 + n[1] * v1 + n[2] * v2;
      m[j] = v0 * c + x0 * s + n[0] * d * (1 - c); m[j + 1] = v1 * c + x1 * s + n[1] * d * (1 - c); m[j + 2] = v2 * c + x2 * s + n[2] * d * (1 - c);
    }
  }
  function localDans(o, m, G, q, k) { // point q du maillage de la main : repère de la prise m, centre G, miroir k
    const a = q[0] * ECHELLE, b = q[1] * ECHELLE, c = k * q[2] * ECHELLE;
    o[0] = ((G[0] + m[0] * a) + m[3] * b) + m[6] * c; o[1] = ((G[1] + m[1] * a) + m[4] * b) + m[7] * c; o[2] = ((G[2] + m[2] * a) + m[5] * b) + m[8] * c;
  }
  // lampe ou témoin : couleur, et émission seulement allumé (éteint, aucune émission : le champ reste indéfini)
  function allumer(o, allume, couleur, eteint, force) {
    o.color = allume ? couleur : eteint;
    if (allume) { if (o.emissive !== force) o.emissive = force; } else if (o.emissive !== undefined) o.emissive = undefined;
  }
  function afficher(segments, masque) { // les sept segments d'un chiffre, de a à g
    for (let s = 0; s < 7; s++) {
      const o = segments[s].objet, allume = (masque >> s & 1) === 1;
      o.mat = allume ? 5 : MAT; o.color = allume ? AMBRE : ETEINT;
      if (allume) { if (o.emissive !== 1.1) o.emissive = 1.1; } else if (o.emissive !== undefined) o.emissive = undefined;
    }
  }
  // point d'une glace, en place dans o : (dx vers l'avant, le boîtier est devant la glace ; dy vers le haut ; dz vers
  // sa droite) → repère de la voiture
  function versGlace(o, G) {
    const c = G.c, n = G.n, w = G.w, a = -o[0], dy = o[1], dz = o[2];
    o[0] = ((c[0] + n[0] * a) + 0 * dy) + w[0] * dz; o[1] = ((c[1] + n[1] * a) + 1 * dy) + w[1] * dz; o[2] = ((c[2] + n[2] * a) + 0 * dy) + w[2] * dz;
  }
  function teinte(e, src, f) { // fond d'une glace : couleur du jour assombrie, dans le tableau de la pièce
    if (src.length === 3) { const c = e.couleur; c[0] = src[0] * f; c[1] = src[1] * f; c[2] = src[2] * f; e.objet.color = c; }
    else e.objet.color = src.map(v => v * f);   // couleur d'une autre longueur que trois : tableau neuf de sa longueur
  }
  // Pose d'une pièce de l'habitacle : place dans le monde (P : ev.p), rotation de son repère (une fois par pose et par repère)
  function placer(H, e, M, P, sortie) {
    const o = e.o, p = e.objet.p, x = o[0], y = o[1], z = o[2], rep = e.rep;
    p[0] = P[0] + (M[0] * x + M[3] * y + M[6] * z); p[1] = P[1] + (M[1] * x + M[4] * y + M[7] * z); p[2] = P[2] + (M[2] * x + M[5] * y + M[8] * z);
    if (rep !== null && rep.epoque !== H.epoque) { if (H.piloteReel) anglesPiloteProduit(rep.r, M, rep.m); else anglesProduit(rep.r, M, rep.m); rep.epoque = H.epoque; }
    sortie.push(e.objet);
  }
  function placerTout(H, liste, M, P, sortie) { for (let i = 0; i < liste.length; i++) placer(H, liste[i], M, P, sortie); }

  const U = new Float64Array(3), RD = new Float64Array(3), EX = new Float64Array(3), HT = new Float64Array(3), GC = new Float64Array(3), ANGLE = new Float64Array(1),
    BOUT = new Float64Array(3), ICI = new Float64Array(3), AV = new Float64Array(3), P1 = new Float64Array(3), P2 = new Float64Array(3), CLE = new Float64Array(10);
  function cleExpressions(etat, reel) {
    // L'état d'expression porte déjà le retour amorti lorsqu'un rapport change. Le couper ici
    // téléportait le poignet levé de presque 30 cm ; les deux mains doivent consommer cette enveloppe.
    const geste = reel ? etat.geste : null;
    CLE[6] = geste === 'majeur' ? 1 : geste === 'poing' ? 2 : geste === 'salut' ? 3 : 0;
    CLE[7] = etat.gesteCote === -1 ? -1 : 1;
    CLE[8] = CLE[6] && Number.isFinite(etat.gesteIntensite) ? Math.max(0, Math.min(1, etat.gesteIntensite)) : 0;
    CLE[9] = CLE[6] && Number.isFinite(etat.gestePhase) ? Math.max(0, Math.min(1, etat.gestePhase)) : 0;
  }
  // L'intensité déjà lissée est le paramètre du trajet. Ces portions placent seulement ses étapes mécaniques :
  // délier les doigts, dégager la jante, lever le poignet et enfin former le geste ; retour par le même chemin.
  function portionGeste(x, a, b) { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); }
  // Volant (braquage phi), levier (passage t, grille de départ gA et d'arrivée gB) et mains, d'après H.cle = (phi, t,
  // gAx, gAy, gBx, gBy). lisse(a, b, x) et borner(x, a, b) (voir plus haut) y sont écrits en place, mêmes opérations.
  // Volant : jante gainée, trois branches d'aluminium ajourées, flasque, cache et vis, ruban blanc en haut de la jante.
  // Mains : un seul maillage par main (src/main.js), fixe dans le repère de la jante, à 9 h et 3 h sur les branches,
  // comme dans vroom-unreal : doigts serrés autour du tube, pouce couché le long de la jante. La manche de la
  // combinaison sort de la manchette dans l'axe de la main, puis descend vers le coude articulé dans la cuve.
  // L'ancien cadrage isolé conserve son coude sous l'image. Pendant un changement de rapport, la main droite
  // va au pommeau, s'y pose paume vers le bas, puis revient.
  function majVolant(H) {
    const cle = H.cle, phi = cle[0], t = cle[1], gAx = cle[2], gAy = cle[3], gBx = cle[4], gBy = cle[5];
    const cp = Math.cos(phi), sp = Math.sin(phi), J = H.rJante.m;
    for (let k = 0; k < 3; k++) { U[k] = WU[k] * cp + WR[k] * sp; RD[k] = -WU[k] * sp + WR[k] * cp; }
    J[0] = U[0]; J[1] = U[1]; J[2] = U[2]; J[3] = WN[0]; J[4] = WN[1]; J[5] = WN[2];                 // jante : [u, wn, u × wn]
    J[6] = U[1] * WN[2] - U[2] * WN[1]; J[7] = U[2] * WN[0] - U[0] * WN[2]; J[8] = U[0] * WN[1] - U[1] * WN[0];
    poseeDans(H.jante.o, CV, J, FORMES.jante.centre);
    poseeDans(H.branches.o, BRANCHES, J, FORMES.branches.centre);
    for (let j = 0; j < 3; j++) {   // caches noirs des branches de 3 h, 9 h et 6 h : dir = r, −r, −u
      const d0 = j === 0 ? RD[0] : j === 1 ? -RD[0] : -U[0], d1 = j === 0 ? RD[1] : j === 1 ? -RD[1] : -U[1], d2 = j === 0 ? RD[2] : j === 1 ? -RD[2] : -U[2], F = H.rCaches[j].m;
      F[0] = d0; F[1] = d1; F[2] = d2; F[3] = WN[0]; F[4] = WN[1]; F[5] = WN[2];
      F[6] = d1 * WN[2] - d2 * WN[1]; F[7] = d2 * WN[0] - d0 * WN[2]; F[8] = d0 * WN[1] - d1 * WN[0];
      for (let q = 0; q < 2; q++) {
        const rf = RV * (q === 0 ? .40 : .66), o = H.caches[2 * j + q].o;
        o[0] = (CV[0] + d0 * rf) + WN[0] * -.0005; o[1] = (CV[1] + d1 * rf) + WN[1] * -.0005; o[2] = (CV[2] + d2 * rf) + WN[2] * -.0005; versVoiture(o);
      }
    }
    for (let b = 0; b < 3; b++) {   // vis du cache
      const ca = VIS[b][0], sa = VIS[b][1], d0 = U[0] * ca + RD[0] * sa, d1 = U[1] * ca + RD[1] * sa, d2 = U[2] * ca + RD[2] * sa, o = H.vis[b].o;
      o[0] = (CV[0] + d0 * VIS_R) + WN[0] * .009; o[1] = (CV[1] + d1 * VIS_R) + WN[1] * .009; o[2] = (CV[2] + d2 * VIS_R) + WN[2] * .009; versVoiture(o);
    }
    { const o = H.ruban.o; o[0] = CV[0] + U[0] * RV; o[1] = CV[1] + U[1] * RV; o[2] = CV[2] + U[2] * RV; versVoiture(o); }
    AXE[0] = RD[0]; AXE[1] = RD[1]; AXE[2] = RD[2]; selonAxeDans(H.ruban.rep.m, AXE);
    // Levier de vitesses à droite : tige et pommeau d'aluminium, qui passe d'une position de la grille à l'autre
    let u = H.piloteReel ? (t - .46) / (.62 - .46) : (t - .25) / (.6 - .25); u = u < 0 ? 0 : u > 1 ? 1 : u;
    const ax = H.piloteReel ? PILOTE_LEVIER_DECALAGE[0] / .9 : 0;
    const ay = H.piloteReel ? PILOTE_LEVIER_DECALAGE[1] / .9 : 0;
    const az = H.piloteReel ? PILOTE_LEVIER_DECALAGE[2] / .9 : 0;
    const w = u * u * (3 - 2 * u), pX = LEVIER[0] + gAx + (gBx - gAx) * w + ax, pY = LEVIER[1] + ay, pZ = LEVIER[2] + gAy + (gBy - gAy) * w + az;
    const piedY = H.piloteReel ? LEVIER[1] + ay + (PILOTE_PIED_LEVIER[1] - PILOTE_LEVIER[1]) / .9 : PIED[1];
    const tx = pX - (PIED[0] + ax), ty = pY - piedY, tz = pZ - (PIED[2] + az);
    { const o = H.tige.o; o[0] = PIED[0] + ax + tx * .5; o[1] = piedY + ty * .5; o[2] = PIED[2] + az + tz * .5; versVoiture(o); }
    AXE[0] = tx; AXE[1] = ty; AXE[2] = tz; hypotDans(AXE, 3);
    H.tige.objet.s[1] = AXE[3] * K;
    selonAxeDans(H.tige.rep.m, AXE);
    { const o = H.pommeau.o; o[0] = pX; o[1] = pY; o[2] = pZ; versVoiture(o); }
    u = H.piloteReel ? (t - .24) / (.44 - .24) : t / .3; u = u < 0 ? 0 : u > 1 ? 1 : u;
    let u2 = H.piloteReel ? (t - .64) / (.80 - .64) : (t - .65) / (1 - .65); u2 = u2 < 0 ? 0 : u2 > 1 ? 1 : u2;
    const vl = u * u * (3 - 2 * u) * (1 - u2 * u2 * (3 - 2 * u2)), cP = Math.cos(PRISE), sP = Math.sin(PRISE);
    // Un passage dure .36 s : 36 ms pour déplier les doigts, puis recul doux du poignet avant son trajet.
    // Au retour, la main rejoint la jante avant de refermer la prise. Les deux vues lisent ces mêmes phases.
    let ouvrir = t / .10, fermer = (t - .94) / .06, sortir = (t - .10) / .04, rentrer = (t - .90) / .04;
    ouvrir = ouvrir < 0 ? 0 : ouvrir > 1 ? 1 : ouvrir; fermer = fermer < 0 ? 0 : fermer > 1 ? 1 : fermer;
    sortir = sortir < 0 ? 0 : sortir > 1 ? 1 : sortir; rentrer = rentrer < 0 ? 0 : rentrer > 1 ? 1 : rentrer;
    const ouverture = ouvrir * ouvrir * (3 - 2 * ouvrir) * (1 - fermer * fermer * (3 - 2 * fermer));
    const radial = sortir * sortir * (3 - 2 * sortir) * (1 - rentrer * rentrer * (3 - 2 * rentrer));
    let reculer = (t - .14) / .10, avancer = (t - .80) / .10;
    reculer = reculer < 0 ? 0 : reculer > 1 ? 1 : reculer; avancer = avancer < 0 ? 0 : avancer > 1 ? 1 : avancer;
    const retrait = reculer * reculer * (3 - 2 * reculer) * (1 - avancer * avancer * (3 - 2 * avancer));
    for (let h = 0; h < 2; h++) {
      const main = H.mains[h], k = main.k, F = main.rep.m, co = main.coude;
      // repère de la prise : x vers le pilote, y le long de la jante vers le haut, z vers le moyeu (miroir à gauche)
      for (let i = 0; i < 3; i++) { const rk = RD[i] * k; EX[i] = U[i] * cP + rk * sP; HT[i] = U[i] * sP - rk * cP; }
      let gx = CV[0] + EX[0] * RV, gy = CV[1] + EX[1] * RV, gz = CV[2] + EX[2] * RV, ecart = 0, doigtsGeste = -1;
      F[0] = WN[0]; F[1] = WN[1]; F[2] = WN[2]; F[3] = HT[0]; F[4] = HT[1]; F[5] = HT[2]; F[6] = -k * EX[0]; F[7] = -k * EX[1]; F[8] = -k * EX[2];
      if (k > 0 && (vl > 0 || H.piloteReel && ouverture > 0)) {
        // La paume rejoint réellement le pommeau (jeu de 0,9 mm), au lieu de flotter 18 mm au-dessus.
        const reculPaume = H.piloteReel ? 0 : .020, leveePaume = H.piloteReel ? .008 : .030;
        const ciX = (pX + WN[0] * reculPaume) + WU[0] * leveePaume, ciY = (pY + WN[1] * reculPaume) + WU[1] * leveePaume, ciZ = (pZ + WN[2] * reculPaume) + WU[2] * leveePaume;
        // cockpit-3 : doigts fermés, ils traversaient le tore de la jante (jusqu'à 12,5 mm) et la branche de 3 h
        // pendant le trajet ; la main s'écarte d'abord vers le dehors et vers le pilote avant de tourner, et le
        // gant passe en variante doigts ouverts dès qu'il ne touche plus le tube (ecart à fond)
        ecart = H.piloteReel ? ouverture : Math.min(t, 1 - t) / .02; ecart = ecart < 0 ? 0 : ecart > 1 ? 1 : ecart;
        const mouvement = H.piloteReel ? retrait : ecart, dehors = H.piloteReel ? radial : ecart, degagement = H.piloteReel ? .020 : .016, reculPrise = H.piloteReel ? .060 : .016;
        gx = gx + EX[0] * degagement * dehors + WN[0] * reculPrise * mouvement; gy = gy + EX[1] * degagement * dehors + WN[1] * reculPrise * mouvement; gz = gz + EX[2] * degagement * dehors + WN[2] * reculPrise * mouvement;
        // Point de contrôle surélevé du Bézier : la main contourne le pommeau avant de s'y poser.
        // Le cadrage isolé garde sa courbe historique ; le pilote commun porte cette courbe au poignet.
        const reculTrajet = 0, hauteurTrajet = H.piloteReel ? .28 : .15;
        // Courbe du poignet, puis pose du gant autour de ce poignet. La courbe de l'ancien cadrage portait
        // le point de prise : le pivot du gant emportait alors la manchette au travers du pommeau.
        const poignet = main.pieces[3].ferme.c;
        let cibleX = ciX, cibleY = ciY, cibleZ = ciZ;
        if (H.piloteReel) {
          const wx = F[0] * poignet[0] + F[3] * poignet[1] + F[6] * poignet[2], wy = F[1] * poignet[0] + F[4] * poignet[1] + F[7] * poignet[2], wz = F[2] * poignet[0] + F[5] * poignet[1] + F[8] * poignet[2];
          const c = Math.cos(Math.PI / 2 + phi), s = Math.sin(Math.PI / 2 + phi), d = WN[0] * wx + WN[1] * wy;
          gx += wx; gy += wy; gz += wz;
          cibleX += wx * c + WN[1] * wz * s + WN[0] * d * (1 - c);
          cibleY += wy * c - WN[0] * wz * s + WN[1] * d * (1 - c);
          cibleZ += wz * c + (WN[0] * wy - WN[1] * wx) * s;
        }
        // La main passe au-dessus et à l'intérieur du pommeau, puis repose sa paume dessus.
        const soX = cibleX + WU[0] * hauteurTrajet + WN[0] * reculTrajet, soY = cibleY + WU[1] * hauteurTrajet + WN[1] * reculTrajet, soZ = cibleZ + WU[2] * hauteurTrajet + WN[2] * reculTrajet - (H.piloteReel ? .10 : 0);
        gx = gx * (1 - vl) ** 2 + soX * 2 * vl * (1 - vl) + cibleX * vl ** 2; gy = gy * (1 - vl) ** 2 + soY * 2 * vl * (1 - vl) + cibleY * vl ** 2; gz = gz * (1 - vl) ** 2 + soZ * 2 * vl * (1 - vl) + cibleZ * vl ** 2;
        // cockpit-4 : le repère de départ porte déjà −phi ; sans le +phi, la paume restait tournée du braquage au
        // pommeau (91,5° du bas volant à fond)
        // La main se dégage avant de pivoter et retrouve l'angle de la jante avant de s'en rapprocher.
        let a = H.piloteReel ? (t - .24) / (.42 - .24) : t / .10; a = a < 0 ? 0 : a > 1 ? 1 : a;
        let b = H.piloteReel ? (t - .66) / (.79 - .66) : (t - .86) / (1 - .86); b = b < 0 ? 0 : b > 1 ? 1 : b;
        ANGLE[0] = a * a * (3 - 2 * a) * (1 - b * b * (3 - 2 * b)) * (Math.PI / 2 + phi);
        tournerColonnes(F, WN, ANGLE);
        if (H.piloteReel) {
          gx -= F[0] * poignet[0] + F[3] * poignet[1] + F[6] * poignet[2];
          gy -= F[1] * poignet[0] + F[4] * poignet[1] + F[7] * poignet[2];
          gz -= F[2] * poignet[0] + F[5] * poignet[1] + F[8] * poignet[2];
        }
      }
      if (cle[6] && k === cle[7] && cle[8] > 0) {
        const intensite = cle[8], mouvement = portionGeste(intensite, .42, 1), dehors = portionGeste(intensite, .06, .26), recul = portionGeste(intensite, .20, .44);
        ecart = portionGeste(intensite, 0, .16);
        gx += EX[0] * .020 * dehors + (WN[0] * .060 + WU[0] * .045) * recul;
        gy += EX[1] * .020 * dehors + (WN[1] * .060 + WU[1] * .045) * recul;
        gz += EX[2] * .020 * dehors + (WN[2] * .060 + WU[2] * .045) * recul;
        const poignet = main.pieces[3].ferme.c;
        let wx = gx + F[0] * poignet[0] + F[3] * poignet[1] + F[6] * poignet[2];
        let wy = gy + F[1] * poignet[0] + F[4] * poignet[1] + F[7] * poignet[2];
        let wz = gz + F[2] * poignet[0] + F[5] * poignet[1] + F[8] * poignet[2];
        // La main haute est déjà devant la visière : son dégagement ne recule jamais la manchette dans le casque.
        wx = Math.max(wx, ((.100 - PILOTE_DECALAGE[0]) / PILOTE_ECHELLE - OEIL[0]) / K);
        // Poignet à côté du casque, au-dessus du jonc. Une seule main quitte le volant, l'autre garde sa prise.
        // Le salut oscille légèrement, le poing se lève de 8 mm : les modulations s'annulent avec le geste.
        const onde = Math.sin(cle[9] * Math.PI * 6) * mouvement;
        const cibleX = ((.080 - PILOTE_DECALAGE[0]) / PILOTE_ECHELLE - OEIL[0]) / K;
        const cibleY = ((.920 + (cle[6] === 2 ? .008 * onde : 0) - PILOTE_DECALAGE[1]) / PILOTE_ECHELLE - OEIL[1]) / K;
        const cibleZ = ((k * (.240 + (cle[6] === 3 ? .010 * onde : 0)) - PILOTE_DECALAGE[2]) / PILOTE_ECHELLE - OEIL[2]) / K;
        const contour = 4 * mouvement * (1 - mouvement);
        wx += (cibleX - wx) * mouvement - .015 / .9 * contour;
        wy += (cibleY - wy) * mouvement;
        wz += (cibleZ - wz) * mouvement + k * .055 / .9 * contour;
        // Annuler le braquage avant de redresser la main : matrices orthonormales et poignet fixe sous les doigts.
        ANGLE[0] = phi * mouvement; tournerColonnes(F, WN, ANGLE);
        AXE[0] = 0; AXE[1] = 0; AXE[2] = 1; ANGLE[0] = (Math.PI / 2 + TAU) * mouvement; tournerColonnes(F, AXE, ANGLE);
        AXE[0] = 1; AXE[1] = 0; AXE[2] = 0; ANGLE[0] = -k * Math.atan2(B.main.AXE[2], B.main.AXE[0]) * mouvement; tournerColonnes(F, AXE, ANGLE);
        AXE[0] = 0; AXE[1] = 1; AXE[2] = 0; ANGLE[0] = k * (.42 + (cle[6] === 3 ? .09 * onde : 0)) * mouvement; tournerColonnes(F, AXE, ANGLE);
        gx = wx - F[0] * poignet[0] - F[3] * poignet[1] - F[6] * poignet[2];
        gy = wy - F[1] * poignet[0] - F[4] * poignet[1] - F[7] * poignet[2];
        gz = wz - F[2] * poignet[0] - F[5] * poignet[1] - F[8] * poignet[2];
        if (intensite >= .48) doigtsGeste = Math.min(5, Math.floor(portionGeste(intensite, .48, 1) * 5 + 1e-8));
      }
      for (let q = 0; q < 5; q++) {
        const e = main.pieces[q], fo = doigtsGeste >= 0 && e.gestes ? e.gestes[cle[6]][doigtsGeste]
          : H.piloteReel && e.prises ? e.prises[Math.min(5, Math.floor(ecart * 5 + 1e-8))] : ecart >= .25 ? e.ouvert : e.ferme, c = fo.c, o = e.objet, p = e.o;
        p[0] = ((gx + F[0] * c[0]) + F[3] * c[1]) + F[6] * c[2]; p[1] = ((gy + F[1] * c[0]) + F[4] * c[1]) + F[7] * c[2]; p[2] = ((gz + F[2] * c[0]) + F[5] * c[1]) + F[8] * c[2]; versVoiture(p);
        if (o.shape !== fo.nom) { o.shape = fo.nom; o.s = fo.s; }
      }
      if (H.piloteReel) articulationPilote(H, h);
      else { co[0] = COUDE[0]; co[1] = COUDE[1]; co[2] = k * COUDE[2]; }
      // Manche commune aux deux vues : du même poignet au même coude, plié dans la cuve.
      GC[0] = gx; GC[1] = gy; GC[2] = gz;
      localDans(BOUT, F, GC, VERS_A, k); localDans(ICI, F, GC, VERS_B, k);
      AXE[0] = ICI[0] - BOUT[0]; AXE[1] = ICI[1] - BOUT[1]; AXE[2] = ICI[2] - BOUT[2]; hypotDans(AXE, 3);
      const l = AXE[3] || 1, f8 = .08 * ECHELLE, d0 = AXE[0] / l, d1 = AXE[1] / l, d2 = AXE[2] / l;
      for (let i = 0; i < 3; i++) {
        P2[i] = BOUT[i] + (i === 0 ? d0 : i === 1 ? d1 : d2) * f8;
        P1[i] = (co[i] + (BOUT[i] - co[i]) * .48) + (i === 1 ? 1 : 0) * -.019;
        AV[i] = BOUT[i];
      }
      for (let n = 1; n <= 6; n++) {
        const f = n / 6, tube = main.tubes[n - 1], o = tube.o, ob = main.boules[n - 1].o;
        for (let i = 0; i < 3; i++) ICI[i] = (1 - f) ** 3 * BOUT[i] + 3 * (1 - f) ** 2 * f * P2[i] + 3 * (1 - f) * f * f * P1[i] + f ** 3 * co[i];
        o[0] = (AV[0] + ICI[0]) / 2; o[1] = (AV[1] + ICI[1]) / 2; o[2] = (AV[2] + ICI[2]) / 2; versVoiture(o);
        AXE[0] = ICI[0] - AV[0]; AXE[1] = ICI[1] - AV[1]; AXE[2] = ICI[2] - AV[2]; hypotDans(AXE, 3);
        tube.objet.s[1] = AXE[3] * K;
        selonAxeDans(tube.rep.m, AXE);
        ob[0] = ICI[0]; ob[1] = ICI[1]; ob[2] = ICI[2]; versVoiture(ob);
        AV[0] = ICI[0]; AV[1] = ICI[1]; AV[2] = ICI[2];
      }
    }
  }

  function habitacle(H, M, ev, sortie, etat) {
    const P = ev.p, regime = etat.regime || 0;
    H.epoque++;
    anglesDans(H.rotM, M);
    // Planche : lampe de régime ; compte-tours (graduations ivoire tous les 1 000 tr/min, zone rouge dès 12 000,
    // aiguille orange) ; température d'eau à gauche, pression d'huile à droite (elle suit le régime) ; témoin vert du
    // contact, témoin rouge (ralenti ou surrégime ; voi-8 : jamais sous le ralenti de conduite.js, seuil pris dans PARAMS)
    allumer(H.lampe.objet, regime > REGIME_LAMPE && etat.rapport > 0 && etat.rapport < 6, LAMPE_ALLUMEE, LAMPE_ETEINTE, 3.2);
    allumer(H.alerte.objet, regime > 12600 || regime < B.conduite.PARAMS.ralenti + 300, ALERTE, TEMOIN_ETEINT, 1.8);
    // aiguilles : trait d'angle b depuis le centre de son cadran (compte-tours, eau, huile)
    for (let k = 0; k < 3; k++) {
      let v = regime / (k === 2 ? 11000 : 13000); v = v < 0 ? 0 : v > 1 ? 1 : v;
      const b = k === 0 ? -2.36 + 4.72 * v : k === 1 ? -1.2 + 2.4 * (.5 + .2 * v) : -1.2 + 2.4 * (.12 + .78 * v);
      const e = H.aiguilles[k], cb = Math.cos(b), sb = Math.sin(b), d0 = PU[0] * cb + WR[0] * sb, d1 = PU[1] * cb + WR[1] * sb, d2 = PU[2] * cb + WR[2] * sb;
      const c = e.centre, r = e.rayon, m = e.rep.m, o = e.o;
      o[0] = c[0] + d0 * r; o[1] = c[1] + d1 * r; o[2] = c[2] + d2 * r; versVoiture(o);
      m[0] = d0; m[1] = d1; m[2] = d2; m[3] = PN[0]; m[4] = PN[1]; m[5] = PN[2];
      m[6] = d1 * PN[2] - d2 * PN[1]; m[7] = d2 * PN[0] - d0 * PN[2]; m[8] = d0 * PN[1] - d1 * PN[0];
    }
    placerTout(H, H.planche, M, P, sortie);
    // Rapport à gauche, vitesse à droite, en segments ambre
    const r = etat.rapport;
    afficher(H.rapport, masqueRapport(r));
    placerTout(H, H.rapport, M, P, sortie);
    if (r < 0) placer(H, H.diagonale, M, P, sortie);
    const kmh = Math.min(999, Math.max(0, Math.round(etat.kmh || 0)));
    if (kmh === kmh) {   // entier de 0 à 999 : centaines et dizaines seulement quand elles s'écrivent
      if (kmh >= 100) { afficher(H.vitesse[0], MASQUE_CHIFFRE[Math.floor(kmh / 100)]); placerTout(H, H.vitesse[0], M, P, sortie); }
      if (kmh >= 10) { afficher(H.vitesse[1], MASQUE_CHIFFRE[Math.floor(kmh / 10) % 10]); placerTout(H, H.vitesse[1], M, P, sortie); }
      afficher(H.vitesse[2], MASQUE_CHIFFRE[kmh % 10]); placerTout(H, H.vitesse[2], M, P, sortie);
    } else {             // vitesse illisible (NaN) : son texte, caractère par caractère
      const texte = String(kmh).padStart(3, ' ');
      for (let k = 0; k < 3; k++) if (texte[k] !== ' ' || k === 2) { afficher(H.vitesse[k], masqueTexte(texte[k])); placerTout(H, H.vitesse[k], M, P, sortie); }
    }
    // Volant, levier et mains : recalculés seulement quand braquage, passage ou rapports changent
    let x = etat.volant || 0; x = x < -1 ? -1 : x > 1 ? 1 : x;
    const expression = ev.pilote || etat;
    let t = H.piloteReel && Number.isFinite(expression.passageVisuel) ? expression.passageVisuel : etat.passage === undefined ? 1 : etat.passage;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const nA = etat.rapportAvant === undefined ? etat.rapport : etat.rapportAvant, nB = etat.rapport, cle = H.cle;
    CLE[0] = x * VOLANT.course; CLE[1] = t;
    CLE[2] = nA > 0 ? (nA % 2 ? 1 : -1) * .024 : 0; CLE[3] = nA > 0 ? (Math.floor((nA - 1) / 2) - 1) * .017 : 0;   // grille(nA)
    CLE[4] = nB > 0 ? (nB % 2 ? 1 : -1) * .024 : 0; CLE[5] = nB > 0 ? (Math.floor((nB - 1) / 2) - 1) * .017 : 0;   // grille(nB)
    cleExpressions(ev.pilote || etat, H.piloteReel);
    let change = !H.pret;
    for (let i = 0; i < 10; i++) if (!Object.is(cle[i], CLE[i])) { cle[i] = CLE[i]; change = true; }
    if (change) { majVolant(H); H.pret = true; }
    placerTout(H, H.volant, M, P, sortie);
    if (H.piloteReel) placerTout(H, H.supportVolant, M, P, sortie);
    // Rétroviseurs (voir RETRO) : boîtier de la couleur de la voiture, patte vers le flanc de l'habitacle, glace. Le
    // fond de la glace montre ciel, horizon et piste, et les voitures qui suivent à leur place ; quand le jeu pose
    // dessus l'image réelle de la scène arrière (jeu.js, majGlaces), ce fond reste dessous.
    const ciel = etat.ciel || CIEL, brume = etat.brume || BRUME, suiveurs = etat.derriere || PERSONNE, GL = RETRO.l, GH = RETRO.h;
    for (let j = 0; j < 2; j++) {
      const G = H.glaces[j];
      placer(H, G.boitier, M, P, sortie); placer(H, G.patte, M, P, sortie);
      // image réelle posée par le jeu : la glace n'est plus qu'un fond sombre sous elle
      if (etat.glaceVive) { placer(H, G.vive, M, P, sortie); continue; }
      teinte(G.ciel, ciel, .75); placer(H, G.ciel, M, P, sortie);
      teinte(G.brume, brume, .6); placer(H, G.brume, M, P, sortie);
      placer(H, G.fond, M, P, sortie);
      let n = 0;
      for (let i = 0; i < suiveurs.length; i++) {
        if (n >= 5) break;
        const v = suiveurs[i], b = G.c[0] - v.x, a = v.z - G.c[2], f = (Math.atan2(a, b) - G.k * .075) / .30;
        if (b < 2 || b > 90 || Math.abs(f) > 1) continue;
        AXE[0] = a; AXE[1] = b; hypotDans(AXE, 2);
        // cockpit-1 : le suiveur le plus proche est enfoncé plus profond dans la glace (un seul lot, depthFunc LEQUAL) ;
        // cockpit-5 : hauteur et largeur bornées pour que caisse et pneus restent dans la glace
        const dist = AXE[3];
        let large = 1.9 / dist / .6 * GL; large = large < .005 ? .005 : large > GL * .55 ? GL * .55 : large;
        let haut = 1.0 / dist / .24 * GH; haut = haut < .004 ? .004 : haut > GH * .62 ? GH * .62 : haut;
        let zi = f * GL / 2; { const lo = -GL / 2 + .54 * large, hi = GL / 2 - .54 * large; zi = zi < lo ? lo : zi > hi ? hi : zi; }
        let yi = -GH * .08 - haut * .3; { const lo = -GH / 2 + .51 * haut, hi = GH / 2 - haut / 2; yi = yi < lo ? lo : yi > hi ? hi : yi; }
        const xi = -.0032 - .001 * (2 - n);
        const caisse = G.suiveurs[2 * n], pneus = G.suiveurs[2 * n + 1], sc = caisse.objet.s, sp = pneus.objet.s, oc = caisse.o, op = pneus.o;
        oc[0] = xi; oc[1] = yi; oc[2] = zi; versGlace(oc, G); sc[1] = haut; sc[2] = large; caisse.objet.color = v.couleur || H.c2;
        placer(H, caisse, M, P, sortie);
        op[0] = xi - .0006; op[1] = yi - haut * .34; op[2] = zi; versGlace(op, G); sp[1] = haut * .34; sp[2] = large * 1.08;
        placer(H, pneus, M, P, sortie);
        n++;
      }
    }
  }

  // Fantôme du meilleur tour : silhouette translucide, en onze objets permanents. objetsFantome() en rend un jeu à
  // soi : il en faut un par fantôme posé dans une même liste.
  const ROUE_AXE_PLAT = aplatir(ROUE_AXE);
  function objetsFantome() {
    const bleu = [.45, .85, 1], rotM = trois(), rot = trois(), objets = [], o = [];
    for (const nom of ['quille', 'fleche', 'pontons', 'goutte', 'moteur']) {
      objets.push({ shape: FORMES[nom].nom, p: trois(), s: FORMES[nom].taille, r: rotM, fx: true, alpha: .26, color: bleu }); o.push(Float64Array.from(FORMES[nom].centre));
    }
    for (const [c, s] of [[[2.11, .13, 0], [.38, .04, 1.62]], [[-2.05, .90, 0], [.34, .06, 1.10]]]) {
      objets.push({ shape: 'box', p: trois(), s, r: rotM, fx: true, alpha: .26, color: bleu }); o.push(Float64Array.from(c));
    }
    for (const w of ROUES) {
      const f = ROUES_FORMES[w.avant ? 'av' : 'ar'].slicks[2];
      objets.push({ shape: f.nom, p: trois(), s: f.taille, r: rot, fx: true, alpha: .22, color: bleu });
      o.push(Float64Array.of(w.x, w.r, w.z));
    }
    return { objets, o, rotM, rot };
  }
  const FANTOME = objetsFantome();
  function fantome(ev, sortie, objets) {
    const F = objets || FANTOME, M = attitudeDans(MS, ev), P = ev.p;
    anglesDans(F.rotM, M); anglesProduit(F.rot, M, ROUE_AXE_PLAT);
    for (let i = 0; i < F.objets.length; i++) { monde(F.objets[i].p, M, F.o[i], P); sortie.push(F.objets[i]); }
  }

  B.voiture = { modele, preparerPneusService, preparerExpressions, changerPneus, poser, poserRetro, cockpit, fantome, objetsFantome, detailPour, detailRouesPour, distanceRoues2, hypotDans, visible, attitude, angles, mul, mulM, euler, braquages, glacesCockpit, cadreGlace, RETRO, OEIL, K, VOLANT, PLANCHE, PENTE_PLANCHE, COUDE, LEVIER, ROUES, EMPATTEMENT, FORMES, SEGMENTS_ROUE, ROUES_FORMES, JANTES_FORMES };
})(globalThis.BITUME = globalThis.BITUME || {});
