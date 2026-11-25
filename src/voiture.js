/* BITUME — monoplace de 1980 : carrosserie en reprise d'après la 126 CK RenderBlade,
   train roulant historique conservé ; livrée originale rouge à détails blancs,
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
  // Implantation relevée sur les vues 09/29, contrôlée par les profils 02/04/11.
  // Proportions de reconstruction sur l'empattement du jeu, pas cotes constructeur.
  const POSTE_126CK = Object.freeze({ ouvertureAvant: 1.30, ouvertureArriere: .42,
    volant: Object.freeze([1.10, .655, 0]), planche: Object.freeze([1.25, .68, 0]),
    assise: Object.freeze([.68, .29, 0]), arceauX: .32 });
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
  // Les variantes de doigts répètent leurs sommets entre triangles voisins.
  // Partager seulement les triplets strictement identiques réduit le stockage
  // JavaScript sans changer un triangle, une normale ni le tampon FERRO.
  // Le hachage porte sur les bits Float64 ; même une collision de hachage
  // exige ensuite l'égalité exacte, zéros signés compris. Aucun arrondi.
  function partagerCoordonneesMain(triangles) {
    const uniques = new Map(), nombres = new Float64Array(3), mots = new Uint32Array(nombres.buffer);
    for (const triangle of triangles) for (let i = 0; i < 6; i++) {
      const p = triangle[i]; nombres.set(p);
      let cle = 2166136261;
      for (let k = 0; k < 6; k++) cle = Math.imul(cle ^ mots[k], 16777619);
      const candidats = uniques.get(cle);
      let existant;
      if (candidats) for (const q of candidats)
        if (Object.is(p[0], q[0]) && Object.is(p[1], q[1]) && Object.is(p[2], q[2])) { existant = q; break; }
      if (existant) triangle[i] = existant;
      else {
        Object.freeze(p);
        if (candidats) candidats.push(p); else uniques.set(cle, [p]);
      }
    }
  }
  function forme(nom, triangles) {
    const n = C.normaliser(triangles), f = { nom: 'bitume-' + nom, centre: n.centre, taille: n.taille, triangles: n.triangles.length, tri: n.triangles };
    if (nom.startsWith('main-')) partagerCoordonneesMain(n.triangles);
    const R = globalThis.window && globalThis.window.FRender;
    if (R && R.forme) R.forme(f.nom, n.triangles);
    return (FORMES[nom] = f);
  }
  const deuxCotes = t => t.concat(C.miroir(t));
  // Tête procédurale d'EMPRISE (copies exactes du commit 509b2ec) sous un casque intégral : la coque est ouverte
  // devant les yeux, avec une visière et le visage derrière. Le thorax propre à l'assise est construit plus bas ;
  // il remplace le torse filtré qui conservait des fragments de bras rigides et des bords ouverts.
  const HUMAIN = (() => {
    const R = globalThis.RADE, h = R && R.humanData, b = R && R.bodyData;
    if (!h || !b) return null;
    // EMPRISE (visage vers +z, y du sol) → voiture (avant +x, droite +z, y du sol de la voiture) : une rotation, l'ordre
    // des indices d'EMPRISE est gardé (sens direct vu de dehors, comme les carènes ; l'ordre 0, 2, 1 retournait les
    // faces et le pilote se voyait de l'intérieur)
    const rot = q => [q[2], q[1], -q[0]], place = q => [q[2], q[1] - .781, -q[0]];
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
      visage: triangles(h.positions, h.normals, h.indices, (x, y, z) => z > -.01 && y > 1.6)
    };
  })();
  if (HUMAIN) for (const nom of ['casque', 'visiere', 'bande', 'visage']) if (HUMAIN[nom].length) forme('pilote-' + nom, HUMAIN[nom]);
  // Thorax fermé, sans bras dans le maillage. Même profil aux trois niveaux : bassin, taille, poitrine,
  // épaules et cou ; seuls le nombre de côtés et l'interpolation changent. Les dimensions sont en mètres,
  // dans le repère commun de la voiture. Le bassin repose dans l'assise ; les centres des sections
  // reculent vers le dossier en montant (environ 24°), sans incliner le casque ni changer la pose par vue.
  const SECTIONS_THORAX = [
    [.290, .680, .130, .120], [.330, .660, .132, .125], [.400, .630, .134, .130],
    [.470, .600, .132, .135], [.540, .570, .120, .140], [.600, .540, .105, .147],
    [.640, .522, .088, .158], [.670, .515, .077, .173], [.690, .499, .060, .090],
    [.714, .486, .055, .064], [.744, .515, .055, .064]
  ];
  function thoraxPilote(cotes, pas) {
    const sections = SECTIONS_THORAX.map(([y, x, profondeur, largeur]) =>
      ({ x: y, y0: x - profondeur, y1: x + profondeur, l: largeur, n: 2 }));
    const tourner = p => [p[1], p[0], p[2]];
    return C.carene(sections, { cotes, pas, bouts: true, vif: 70 }).map(t =>
      [tourner(t[0]), tourner(t[2]), tourner(t[1]), tourner(t[3]), tourner(t[5]), tourner(t[4])]);
  }
  forme('pilote-buste', thoraxPilote(32, 2));
  forme('pilote-buste-moyen', thoraxPilote(20, 1));
  forme('pilote-buste-simple', thoraxPilote(12, 1));
  // Les peaux de carrosserie avaient un fond plein sous le pilote. Retirer uniquement la cavité
  // intérieure, sous le jonc, laisse la vraie silhouette extérieure et ses normales intactes.
  // Découpe exacte des faces (pas un filtrage par leur centre) : aucune grande face ne traverse le siège.
  function creuserCellule(triangles, plans = [[0, .39, 1], [0, 1.35, -1], [1, .105, 1], [1, .755, -1], [2, -.25, 1], [2, .25, -1]]) {
    const sortie = [];
    const decouper = (poly, axe, limite, sens, dedans) => {
      const resultat = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], da = (a.p[axe] - limite) * sens, db = (b.p[axe] - limite) * sens;
        const ia = dedans ? da >= 0 : da <= 0, ib = dedans ? db >= 0 : db <= 0;
        if (ia) resultat.push(a);
        if (ia !== ib) {
          const t = da / (da - db);
          resultat.push({ p: a.p.map((v, k) => v + (b.p[k] - v) * t), n: norme(a.n.map((v, k) => v + (b.n[k] - v) * t)) });
        }
      }
      return resultat;
    };
    const ajouter = poly => {
      for (let i = 1; i + 1 < poly.length; i++) {
        const a = poly[0], b = poly[i], c = poly[i + 1], ab = b.p.map((v, k) => v - a.p[k]), ac = c.p.map((v, k) => v - a.p[k]);
        if (Math.hypot(...croix(ab, ac)) > 1e-12) sortie.push([a.p, b.p, c.p, a.n, b.n, c.n]);
      }
    };
    for (const t of triangles) {
      if (plans.some(([axe, limite, sens]) => t.slice(0, 3).every(p => (p[axe] - limite) * sens < 0))) { sortie.push(t); continue; }
      let poly = [0, 1, 2].map(i => ({ p: t[i], n: t[i + 3] }));
      for (const [axe, limite, sens] of plans) {
        ajouter(decouper(poly, axe, limite, sens, false));
        poly = decouper(poly, axe, limite, sens, true);
        if (poly.length < 3) break;
      }
    }
    return sortie;
  }
  // Quille sous la cuve 126 CK : derrière x = 0,94 les pontons ferment le flanc (on dégage la
  // cloison arrière de quille dans la cellule) ; entre x = 0,94 et 1,35 la carène basse
  // (y <= 0,145) enveloppe l'extérieur du fond de cuve (zQ > zC) sans jamais entrer dedans
  // ni laisser de fente de jour sous le châssis (voi-1).
  function creuserQuille(triangles) {
    let t = creuserCellule(triangles, [[0, .39, 1], [0, .94, -1], [1, .105, 1], [1, .755, -1], [2, -.25, 1], [2, .25, -1]]);
    t = creuserCellule(t, [[0, .94, 1], [0, 1.00, -1], [1, .128, 1], [1, .755, -1], [2, -.25, 1], [2, .25, -1]]);
    return creuserCellule(t, [[0, 1.00, 1], [0, 1.35, -1], [1, .145, 1], [1, .755, -1], [2, -.25, 1], [2, .25, -1]]);
  }

  // Sections (x : abscisse, y0–y1 : bas et haut, l : demi-largeur, n : exposant), de l'avant vers l'arrière.
  // Valeurs de modélisation : les références de rendu ne fournissent pas de cotes métriques.
  // Reprise 126 CK RenderBlade : nez étroit et écrasé devant, épaules entre les roues,
  // raccord sous la cellule. Le nez ne s'élargit plus jusqu'au bord des pontons.
  // Cotés RenderBlade 09/29 et 12/32 ; proportions adaptées au train roulant existant.
  const S_QUILLE = [{ x: 2.20, y0: .08, y1: .18, l: .08, n: 4 }, { x: 1.70, y0: .07, y1: .22, l: .12, n: 4 }, { x: .98, y0: .07, y1: .28, l: .16, n: 5 }, { x: .55, y0: .07, y1: .30, l: .20, n: 5 }];
  // 126 CK : nez étroit devançant pas d'élargissement avant les pontons ; profil en entonnoir
  // RenderBlade 09/29 (vue axiale) et 12/32 (vue profil). Adapté au train p15.
  const S_FLECHE = [{ x: 2.18, y0: .09, y1: .17, l: .04, n: 5.0 }, { x: 1.80, y0: .10, y1: .22, l: .12, n: 4.5 },
    { x: 1.50, y0: .13, y1: .30, l: .25, n: 4.0 }, { x: 1.10, y0: .15, y1: .35, l: .30, n: 4.0 }, { x: .70, y0: .18, y1: .38, l: .20, n: 4.0 }];
  // Pontons 126 CK RenderBlade : entrée d'air nette derrière les roues avant, flancs aux arêtes vives
  // (n ↓ = transition plus franche), puis resserrement vers les roues arrière.
  // Vu RenderBlade 02/22, 04/24, 11/31 : profil aigu, soubassement plat, arêtes vives sur le devant du ponton.
  const S_PONTONS = [{ x: .96, y0: .140, y1: .41, l: .62, n: 3.0 }, { x: .92, y0: .110, y1: .46, l: .68, n: 3.2 }, { x: -.28, y0: .110, y1: .48, l: .68, n: 3.0 },
    { x: -.60, y0: .100, y1: .44, l: .60, n: 2.8 }, { x: -.88, y0: .105, y1: .38, l: .48, n: 2.5 }];
  const S_GOUTTE = [{ x: 2.12, y0: .215, y1: .255, l: .055, n: 2.6 }, { x: 1.72, y0: .275, y1: .51, l: .195, n: 2.8 },
    { x: 1.40, y0: .295, y1: .68, l: .285, n: 3.4 }, { x: 1.30, y0: .28, y1: .705, l: .298, n: 3.5 },
    { x: .95, y0: .28, y1: .725, l: .30, n: 3.8 }, { x: .44, y0: .28, y1: .745, l: .298, n: 3.8 },
    { x: .35, y0: .35, y1: .84, l: .285, n: 3.6 }];
  const OUVERTURE = { de: POSTE_126CK.ouvertureAvant, a: POSTE_126CK.ouvertureArriere, angle: 1.35 };
  const S_MOTEUR = [{ x: -.35, y0: .40, y1: .70, l: .30, n: 3 }, { x: -1.00, y0: .42, y1: .60, l: .34, n: 4 }, { x: -1.40, y0: .38, y1: .51, l: .31, n: 4 }];
  // Ouïes latérales 126 CK (02/22, 04/24 et 11/31), décroissantes vers les roues avant.
  // Le contour est découpé dans les triangles : pas de panneau noir sur une peau pleine.
  const PONTON_OUIE = Object.freeze([[.10, .302], [.51, .302], [.73, .392], [.73, .416], [.10, .438]].map(Object.freeze));
// Coques d'écopes de refroidissement latérales 126 CK (vue profil et vue axiale) :
  const ECOPE_GAUCHE = Object.freeze(C.carene([{ x: .85, y0: .25, y1: .55, l: .15, n: 3 }, { x: .70, y0: .20, y1: .50, l: .20, n: 3 }, { x: .55, y0: .18, y1: .45, l: .25, n: 4 }, { x: .40, y0: .15, y1: .40, l: .22, n: 4 }]));
  const ECOPE_DROITE = Object.freeze(C.carene([{ x: .85, y0: .25, y1: .55, l: .15, n: 3 }, { x: .70, y0: .20, y1: .50, l: .20, n: 3 }, { x: .55, y0: .18, y1: .45, l: .25, n: 4 }, { x: .40, y0: .15, y1: .40, l: .22, n: 4 }]).map(t => t.map(v => v[0] * -1)));
// Ailerons avant et arrière 126 CK (vue dessus) :
  const AILERON_AVANT = Object.freeze(C.carene([{ x: 2.00, y0: .55, y1: .80, l: .10, n: 4 }, { x: 1.70, y0: .50, y1: .75, l: .15, n: 4 }, { x: 1.40, y0: .45, y1: .70, l: .20, n: 5 }, { x: 1.10, y0: .40, y1: .65, l: .22, n: 5 }]));
  const AILERON_ARRIERE = Object.freeze(C.carene([{ x: -.20, y0: .50, y1: .80, l: .10, n: 4 }, { x: -.50, y0: .45, y1: .75, l: .15, n: 4 }, { x: -.80, y0: .40, y1: .70, l: .20, n: 5 }, { x: -1.10, y0: .35, y1: .65, l: .22, n: 5 }]));
  const profilPonton = C.profil(S_PONTONS);
  const flancPonton = (x, y) => { const s = profilPonton(x), h = (s.y1 - s.y0) / 2,
    r = Math.min(1, Math.abs(y - (s.y0 + s.y1) / 2) / h) ** (s.n / 2);
    return s.l * Math.sqrt(Math.max(0, 1 - r * r)) ** (2 / s.n); };
  const dessusPonton = (x, z) => { const s = profilPonton(x), r = Math.min(1, Math.abs(z) / s.l) ** (s.n / 2);
    return (s.y0 + s.y1) / 2 + (s.y1 - s.y0) / 2 * Math.sqrt(Math.max(0, 1 - r * r)) ** (2 / s.n); };

  // La découpe garde ses proportions sur le dessus du ponton qui se resserre vers la roue arrière.
  // Les profondeurs suivent la peau, même sur la partie arrondie du plateau.
  const PONTON_PRISE = [[-.97, .425], [-.735, .488], [-.735, .512], [-.97, .575]]
    .map(([x, z]) => [x, z * profilPonton(x).l / .72]);
  const hautPrise = PONTON_PRISE.map(([x, z]) => [x, dessusPonton(x, z), z]);
  const basPrise = hautPrise.map(([x, y, z]) => [x, y - (.043 - .029 * (x + .97) / .235), z]);
  const plancherDecoupe = Math.min(...basPrise.map(p => p[1])) - .015;

  const plansPrisme = (contour, axes, min, max) => {
    const plans = [], axeLibre = 3 - axes[0] - axes[1];
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i], b = contour[(i + 1) % contour.length], n = [0, 0, 0];
      n[axes[0]] = -(b[1] - a[1]); n[axes[1]] = b[0] - a[0];
      plans.push([n, -n[axes[0]] * a[0] - n[axes[1]] * a[1]]);
    }
    const n = [0, 0, 0]; n[axeLibre] = 1; plans.push([n, -min]);
    const r = [0, 0, 0]; r[axeLibre] = -1; plans.push([r, max]);
    return plans;
  };
  function retirerVolumePonton(triangles, plans) {
    const sortie = [], distance = (p, plan) => plan[0].reduce((s, v, i) => s + v * p[i], plan[1]);
    const decoupe = (poly, plan, dedans) => {
      const resultat = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], da = distance(a.p, plan), db = distance(b.p, plan);
        const ia = dedans ? da >= 0 : da <= 0, ib = dedans ? db >= 0 : db <= 0;
        if (ia) resultat.push(a);
        if (ia !== ib) { const t = da / (da - db); resultat.push({p: a.p.map((v, k) => v + (b.p[k] - v) * t),
          n: norme(a.n.map((v, k) => v + (b.n[k] - v) * t))}); }
      }
      return resultat;
    };
    const ajouter = poly => {
      for (let i = 1; i + 1 < poly.length; i++) {
        const a = poly[0], b = poly[i], c = poly[i + 1];
        if (Math.hypot(...croix(b.p.map((v, k) => v - a.p[k]), c.p.map((v, k) => v - a.p[k]))) > 1e-12)
          sortie.push([a.p, b.p, c.p, a.n, b.n, c.n]);
      }
    };
    for (const t of triangles) {
      if (plans.some(p => t.slice(0, 3).every(v => distance(v, p) < 0))) { sortie.push(t); continue; }
      let poly = [0, 1, 2].map(i => ({p: t[i], n: t[i + 3]}));
      for (const plan of plans) { ajouter(decoupe(poly, plan, false)); poly = decoupe(poly, plan, true); if (poly.length < 3) break; }
    }
    return sortie;
  }
  function ouvrirFlancsPontons(triangles) {
    for (const k of [-1, 1]) {
      triangles = retirerVolumePonton(triangles, plansPrisme(PONTON_OUIE, [0, 1], k < 0 ? -.86 : .62, k < 0 ? -.62 : .86));
      const prise = k < 0 ? PONTON_PRISE.map(p => [p[0], -p[1]]).reverse() : PONTON_PRISE;
      triangles = retirerVolumePonton(triangles, plansPrisme(prise, [0, 2], plancherDecoupe, .56));
    }
    return triangles;
  }
  // Prises frontales sous les plateaux des pontons (vues 12/32). La peau est
  // réellement ouverte, avec quatre parois et un fond de radiateur en retrait.
  // Même découpe aux trois LOD : aucun rectangle noir collé sur une face pleine.
  function ouvrirPontons(triangles) {
    for (const k of [-1, 1]) triangles = creuserCellule(triangles,
      [[0, .755, 1], [0, 1.005, -1], [1, .175, 1], [1, .365, -1],
        [2, k < 0 ? -.640 : .335, 1], [2, k < 0 ? -.335 : .640, -1]]);
    return ouvrirFlancsPontons(triangles);
  }
  {
    const parois = [], ailettes = [], avant = [.982, .175, .365, .335, .640], arriere = [.760, .190, .350, .350, .625];
    const anneau = s => [[s[0], s[1], s[3]], [s[0], s[1], s[4]], [s[0], s[2], s[4]], [s[0], s[2], s[3]]];
    const a = anneau(avant), b = anneau(arriere), milieu = [.875, .27, .4875];
    const face = (p, q, r) => {
      const n = croix(q.map((v, i) => v - p[i]), r.map((v, i) => v - p[i]));
      parois.push(n.reduce((s, v, i) => s + v * (milieu[i] - p[i]), 0) < 0 ? [p, r, q] : [p, q, r]);
    };
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; face(a[i], b[i], b[j]); face(a[i], b[j], a[j]); }
    face(b[0], b[1], b[2]); face(b[0], b[2], b[3]);
    // Flanc ouvert, conduit de 7–9 cm et fond de radiateur ; même fond aux trois détails.
    const bord = PONTON_OUIE.map(p => [p[0], p[1], flancPonton(...p)]), fond = PONTON_OUIE.map(p => [p[0], p[1], .625]);
    const orientee = (dest, p, q, r, normale) => { const n = croix(q.map((v, i) => v - p[i]), r.map((v, i) => v - p[i]));
      dest.push(n.reduce((s, v, i) => s + v * normale[i], 0) < 0 ? [p, r, q] : [p, q, r]); };
    const quad = (dest, p, q, r, s, n) => { orientee(dest, p, q, r, n); orientee(dest, p, r, s, n); };
    for (let i = 0; i < bord.length; i++) { const j = (i + 1) % bord.length;
      quad(parois, bord[i], fond[i], fond[j], bord[j], [.40 - (bord[i][0] + bord[j][0]) / 2, .37 - (bord[i][1] + bord[j][1]) / 2, 0]); }
    for (let i = 1; i + 1 < fond.length; i++) orientee(parois, fond[0], fond[i], fond[i + 1], [0, 0, 1]);
    // Dépressions triangulaires à l'arrière du dessus (09/29) : rampe et parois,
    // la peau du ponton est réellement retirée au-dessus, jusqu'à un fond sous la lèvre.
    const haut = hautPrise, bas = basPrise;
    const milieuPrise = haut.reduce((centre, p) => [centre[0] + p[0] / haut.length, centre[1] + p[2] / haut.length], [0, 0]);
    for (let i = 0; i < haut.length; i++) { const j = (i + 1) % haut.length;
      quad(parois, haut[i], haut[j], bas[j], bas[i], [milieuPrise[0] - (haut[i][0] + haut[j][0]) / 2, 0, milieuPrise[1] - (haut[i][2] + haut[j][2]) / 2]); }
    for (let i = 1; i + 1 < bas.length; i++) orientee(parois, bas[0], bas[i], bas[i + 1], [0, 1, 0]);
    forme('pontons-conduits', deuxCotes(C.lisser(parois, 70)));
    // Montants de grille peints, réunis en un seul maillage. Aucun barreau au loin.
    const grille = [], joints = [];
    for (let i = 0; i < 22; i++) {
      const x = .113 + i * .0285, bas = x <= .51 ? .302 : .302 + (x - .51) * .09 / .22;
      const haut = .438 - (x - .10) * .022 / .63, zBas = flancPonton(x, bas), zHaut = flancPonton(x, haut);
      const points = [[x - .0032, bas, zBas], [x + .0032, bas, zBas], [x + .0032, haut, zHaut], [x - .0032, haut, zHaut]], fond = points.map(p => [p[0], p[1], p[2] - .025]);
      quad(grille, points[0], points[1], points[2], points[3], [0, 0, 1]);
      quad(grille, points[0], fond[0], fond[3], points[3], [-1, 0, 0]);
      quad(grille, points[1], points[2], fond[2], fond[1], [1, 0, 0]);
    }
    forme('pontons-grilles', deuxCotes(C.lisser(grille, 45)));
    // Joint vertical du panneau arrière et joint bas sous l'ouïe, posés sur la peau.
    const vertical = [], traverse = [], basJoint = [];
    for (let i = 0; i <= 12; i++) { const y = .115 + .365 * i / 12;
      vertical.push([-.30, y, flancPonton(-.30, y) + .0015]); }
    for (let i = 0; i <= 12; i++) { const z = .30 + .415 * i / 12;
      traverse.push([-.30, dessusPonton(-.30, z) + .0015, z]); }
    for (let i = 0; i <= 20; i++) { const x = -.965 + 1.86 * i / 20;
      basJoint.push([x, .195, flancPonton(x, .195) + .0015]); }
    for (const chemin of [vertical, traverse, basJoint]) joints.push(...C.tube(chemin, .0018, {cotes: 4, pas: 1}));
    forme('pontons-joints', deuxCotes(joints));
    for (let i = 0; i < 6; i++) ailettes.push(...C.tube([[.772, .205 + i * .025, .355], [.772, .205 + i * .025, .620]], .0025, { cotes: 4, pas: 1 }));
    forme('pontons-radiateurs', deuxCotes(ailettes));
  }
  forme('quille', creuserQuille(C.carene(S_QUILLE, { cotes: 16 })));
  forme('fleche', creuserCellule(C.carene(S_FLECHE, { cotes: 28, pas: 5 })));
  forme('pontons', ouvrirPontons(creuserCellule(C.carene(S_PONTONS, { cotes: 28 }))));
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
    const peau = creuserCellule(exterieur);
    forme('goutte', peau);
    // La doublure suit toute la vraie peau. Les anciennes cloisons en éventail fermaient la cavité
    // au niveau du ventre ; une peau intérieure complète les remplace sans trou vu depuis le siège.
    forme('goutte-dedans', peau.map(t => [t[0], t[2], t[1], t[3].map(v => -v), t[5].map(v => -v), t[4].map(v => -v)]));
    // jonc du bord de l'ouverture : il suit le bord gauche, l'arc arrière, le bord droit et l'arc avant de l'ouverture
    // (voi-4 : trois points par arc, sinon la corde de Catmull-Rom bombe hors de l'ouverture et passe sous la peau)
    const g = C.profil(S_GOUTTE), bord = [], w = OUVERTURE.angle / 2;
    for (let i = 0; i <= 6; i++) { const x = OUVERTURE.de + (OUVERTURE.a - OUVERTURE.de) * i / 6; bord.push(C.pointSection(g(x), Math.PI / 2 + w)); }
    for (let k = 1; k <= 3; k++) bord.push(C.pointSection(g(OUVERTURE.a), Math.PI / 2 + w - 2 * w * k / 4));
    for (let i = 6; i >= 0; i--) { const x = OUVERTURE.de + (OUVERTURE.a - OUVERTURE.de) * i / 6; bord.push(C.pointSection(g(x), Math.PI / 2 - w)); }
    for (let k = 1; k <= 3; k++) bord.push(C.pointSection(g(OUVERTURE.de), Math.PI / 2 - w + 2 * w * k / 4));
    const sauteVent = construireSauteVent(peau);
    forme('bulle', sauteVent.verre);
    forme('jonc', C.tube(bord, .012, { cotes: 8, ferme: true, pas: 3 })
      .concat(C.tube(sauteVent.embase, .0045, { cotes: 8, pas: 2 })));
  }

  // L'embase du saute-vent suit les triangles peints du nez et revient de chaque côté de l'ouverture.
  // Le bord supérieur reste libre devant le pilote. Le dessous de la vitre pénètre de 3 mm dans son joint.
  function construireSauteVent(peau) {
    const embase = [], faces = [], lignes = [], largeur = .268, arcs = 48, etages = 5;
    function dessus(x, z) {
      let haut = -Infinity;
      for (const [a, b, c] of peau) {
        const bx = b[0] - a[0], bz = b[2] - a[2], cx = c[0] - a[0], cz = c[2] - a[2];
        const det = bx * cz - cx * bz;
        if (Math.abs(det) < 1e-12) continue;
        const u = ((x - a[0]) * cz - (z - a[2]) * cx) / det;
        const v = (bx * (z - a[2]) - bz * (x - a[0])) / det;
        if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
          haut = Math.max(haut, a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]));
      }
      if (!Number.isFinite(haut)) throw Error('Saute-vent : fixation hors de la carrosserie');
      return haut;
    }
    const arriere = 1.245, avance = .255, levee = .82 - dessus(arriere + avance, 0);
    for (let i = 0; i <= arcs; i++) {
      const angle = Math.PI * (i / arcs - .5);
      const arrondi = i === 0 || i === arcs ? 0 : Math.pow(Math.cos(angle), .8);
      const x = arriere + avance * arrondi, z = largeur * Math.sin(angle), y = dessus(x, z);
      embase.push([x, y, z]);
      const ligne = [];
      for (let j = 0; j <= etages; j++) {
        const t = j / etages;
        ligne.push([x - avance * t * arrondi, y - .003 + levee * arrondi * Math.sin(t * Math.PI / 2), z]);
      }
      lignes.push(ligne);
    }
    for (let i = 0; i < arcs; i++) {
      const a = lignes[i], b = lignes[i + 1];
      for (let j = 0; j < etages; j++) {
        if (i > 0) faces.push([a[j], a[j + 1], b[j]]);
        if (i + 1 < arcs) faces.push([b[j], a[j + 1], b[j + 1]]);
      }
    }
    const interieur = faces.map(([a, b, c]) => [a, c, b]);
    return { verre: C.lisser(faces).concat(C.lisser(interieur)), embase };
  }
  // Une seule verrière : retirer le pilote ou changer de caméra ne change jamais sa peau.
  Object.defineProperty(FORMES, 'bulle-pilote', { value: FORMES.bulle });
  {
    // Deux filets posés sur leurs peaux respectives : aucune corde en l'air entre
    // le nez resserré et le ponton. La seconde couleur reste celle de la livrée originale.
    const f = C.profil(S_FLECHE), p = C.profil(S_PONTONS), nez = [], ponton = [];
    for (let x = 2.04; x > 1.00; x -= .12) { const s = f(x); nez.push([x, (s.y0 + s.y1) / 2, s.l + .002]); }
    for (const x of [.90, .50, -.15, -.52, -.85]) ponton.push([x, .208, p(x).l + .002]);
    forme('filet', deuxCotes(C.tube(nez, .008, { cotes: 6, pas: 2 }).concat(C.tube(ponton, .008, { cotes: 6, pas: 2 }))));
    forme('ecopes', deuxCotes(C.carene(ECOPE_GAUCHE.concat(ECOPE_DROITE))));
    forme('aileron-avant', deuxCotes(C.carene(AILERON_AVANT)));
    forme('aileron-arriere', deuxCotes(C.carene(AILERON_ARRIERE)));
  }
  // rétroviseurs : boîtier profilé, glace vers l'arrière, sur une patte fine fixée au flanc du carénage
  forme('retros', deuxCotes(C.carene([{ x: .61, y0: .560, y1: .575, l: .02, n: 2, z: .47 }, { x: .57, y0: .540, y1: .592, l: .072, n: 3, z: .47 }, { x: .53, y0: .538, y1: .594, l: .078, n: 4, z: .47 }], { cotes: 16, pas: 3 })
    .concat(C.tube([[.565, .53, .27], [.565, .55, .40]], .009, { cotes: 6 }))));
  // Rétroviseurs avancés et surélevés sur le carénage avant (décision David 21/11) :
  // entièrement visibles et lisibles dans le champ du cockpit dès 60–70°, alignés optiquement sur OEIL.
  const RETRO = { x: 1.13, y: .700, z: .390, l: .152, h: .062, angle: .295, inclinaison: .1120 };
  // Repère d'une glace (k = −1 à gauche, 1 à droite) : normale vers le pilote et le haut, droite, haut.
  // La glace et son boîtier s'inclinent ensemble ; un plan vertical renverrait les yeux sur le sol.
  function cadreGlace(k) {
    const a = k * RETRO.angle, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(RETRO.inclinaison), sb = Math.sin(RETRO.inclinaison);
    const n = [-ca * cb, sb, -sa * cb], w = [-sa, 0, ca], u = [ca * sb, cb, sa * sb];
    return { k, c: [RETRO.x, RETRO.y, k * RETRO.z], n, w, u, m: [[-n[0], -n[1], -n[2]], u, w] };
  }
  // Coins des deux glaces dans le monde (haut gauche, haut droit, bas droit, bas gauche, vus du pilote), leur centre,
  // leur normale et leur droite : jeu.js y pose l'image réelle de la scène arrière. dest : le résultat d'un appel
  // précédent, réécrit en place (aucun tableau neuf par image) ; sans lui, un résultat neuf. Les coins dans le repère
  // de la voiture ne dépendent que de RETRO : calculés une fois.
  const GLACES = [-1, 1].map(k => {
    // Face tournée vers le pilote du fond de glace : centre à +2 mm, demi-épaisseur de 1,5 mm.
    const g = cadreGlace(k), coin = (dz, dy) => g.c.map((v, i) => v + g.w[i] * dz + g.u[i] * dy + g.n[i] * .0035), l = RETRO.l / 2, h = RETRO.h / 2;
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
    // voi-7 : attaches intérieures posées sur la peau de la quille (x 1,52, z 0,145) et sur le flanc extérieur
    // de la cuve avancée 126 CK (x 1,18, z 0,198, sans traversée intérieure du plancher de cockpit).
    forme('triangles', deuxCotes([].concat(C.tube([[1.52, .15, .145], [1.35, .17, .71]], .011, { cotes: 6 }), C.tube([[1.18, .15, .198], [1.35, .17, .71]], .011, { cotes: 6 }),
      C.tube([[1.47, .29, .22], [1.45, .30, .70]], .008, { cotes: 6 }))));
  }
  // 126 CK — implantation estimée sur RenderBlade 09/29, 02/22 et photographies réelles.
  // Ces proportions visuelles restent adaptées au train roulant p15, pas des cotes constructeur.
  const ARRIERE_126CK = Object.freeze({ arceauX: .32, arceauY: 1.026, plateauAvant: .35,
    plateauArriere: -.30, plateauY: .84, capotArriere: -.80, sortieHauteX: -1.42,
    sortieHauteY: .575, sortieHauteZ: .215, sortieHauteRayon: .052,
    sortieBasseX: -1.82, sortieBasseY: .16, sortieBasseZ: .36, sortieBasseRayon: .033 });
  {
    const A = ARRIERE_126CK;
    const face = (dest, a, b, c, n) => {
      const v = croix(b.map((x, i) => x - a[i]), c.map((x, i) => x - a[i]));
      dest.push(v.reduce((s, x, i) => s + x * n[i], 0) < 0 ? [a, c, b] : [a, b, c]);
    };
    const quad = (dest, a, b, c, d, n) => { face(dest, a, b, c, n); face(dest, a, c, d, n); };
    const tube = (a, b, r = .012) => C.tube([a, b], r, { cotes: 8, pas: 1, bouts: false });
    const plaque = (points, z0, z1) => {
      const faces = [], p = (i, z) => [points[i][0], points[i][1], z];
      const aire = points.reduce((s, a, i) => { const b = points[(i + 1) % points.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
      if (aire < 0) points = points.slice().reverse();
      for (let i = 1; i < points.length - 1; i++) {
        face(faces, p(0, z0), p(i + 1, z0), p(i, z0), [0, 0, -1]);
        face(faces, p(0, z1), p(i, z1), p(i + 1, z1), [0, 0, 1]);
      }
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length, n = [points[j][1] - points[i][1], points[i][0] - points[j][0], 0];
        quad(faces, p(i, z0), p(j, z0), p(j, z1), p(i, z1), n);
      }
      return C.lisser(faces, 55);
    };
    // Plateau riveté derrière le dossier, deux jambes vers l'arrière et pieds porteurs.
    const arceau = C.tube([[A.arceauX, A.plateauY, -.185], [A.arceauX, .975, -.145],
      [A.arceauX, A.arceauY, -.07], [A.arceauX, A.arceauY, .07],
      [A.arceauX, .975, .145], [A.arceauX, A.plateauY, .185]], .017, { cotes: 10, pas: 3 });
    const renforts = deuxCotes(tube([A.arceauX, 1.016, .105], [-.255, A.plateauY + .01, .192], .014));
    forme('arceau', arceau);
    forme('arceau-renforts', renforts);
    const plateau = C.carene([{ x: A.plateauAvant, y0: A.plateauY - .010, y1: A.plateauY, l: .213, n: 12 },
      { x: A.plateauArriere, y0: A.plateauY - .010, y1: A.plateauY, l: .242, n: 12 }], { cotes: 16, pas: 1 });
    forme('plateau-arriere', plateau);
    const rivets = [], pieds = [], bouchon = [];
    for (const x of [.30, .20, .10, 0, -.10, -.20, -.27]) for (const k of [-1, 1]) {
      const z = k * (.205 + (.35 - x) * .044);
      rivets.push(...C.tube([[x, .840, z], [x, .844, z]], .004, { cotes: 6, pas: 1 }));
    }
    for (const x of [.32, -.255]) for (const k of [-1, 1]) {
      pieds.push(...C.carene([{ x: x - .029, y0: .84, y1: .851, l: .028, n: 4, z: k * .19 },
        { x: x + .029, y0: .84, y1: .851, l: .028, n: 4, z: k * .19 }], { cotes: 8, pas: 1 }));
    }
    bouchon.push(...C.tube([[-.12, .841, 0], [-.12, .852, 0]], .067, { cotes: 20, pas: 1 }),
      ...tube([-.15, .856, 0], [-.09, .856, 0], .006));
    forme('plateau-details', rivets.concat(pieds, bouchon));
    // Le coffre ne recouvre jamais le plateau ; ses flancs prolongent la cellule.
    const coffre = [];
    for (const k of [-1, 1]) {
      const lignes = [[.213, .84, .242, .84], [.267, .805, .29, .805], [.283, .43, .30, .43]];
      for (let i = 0; i + 1 < lignes.length; i++) {
        const u = lignes[i], v = lignes[i + 1];
        quad(coffre, [A.plateauAvant, u[1], k * u[0]], [A.plateauArriere, u[3], k * u[2]],
          [A.plateauArriere, v[3], k * v[2]], [A.plateauAvant, v[1], k * v[0]], [0, i ? 0 : 1, k]);
      }
    }
    // Capot ouvert dessous et derrière : bord arrière en arche, sans disque bouchant la mécanique.
    const capot = [], bord = [], NC = 20, NL = 5;
    const point = (i, j) => {
      const t = i / NL, a = Math.PI * j / NC, z = .30 * Math.cos(a), courbe = Math.pow(Math.max(0, Math.sin(a)), .48);
      const fin = A.capotArriere + .17 * Math.sin(a), x = A.plateauArriere + (fin - A.plateauArriere) * t;
      // La première section rejoint exactement le plateau et les deux plis du coffre.
      // Une ellipse uniforme laissait un jour de 6–10 cm sous ses coins arrière.
      const az = Math.abs(z), devant = az <= .242 ? A.plateauY : az <= .29
        ? A.plateauY - .035 * (az - .242) / .048 : .805 - .375 * (az - .29) / .01;
      const derriere = .43 + .255 * courbe, raccord = t * t * (3 - 2 * t);
      return [x, devant + (derriere - devant) * raccord, z];
    };
    for (let i = 0; i < NL; i++) for (let j = 0; j < NC; j++) {
      const a = point(i, j), b = point(i + 1, j), c = point(i + 1, j + 1), d = point(i, j + 1);
      quad(capot, a, b, c, d, [0, 1, (a[2] + c[2]) * 5]);
    }
    for (let j = 0; j <= NC; j++) bord.push(point(NL, j));
    const peauMoteur = C.lisser(coffre.concat(capot), 65);
    forme('moteur', peauMoteur);
    forme('moteur-dedans', peauMoteur.map(t => [t[0], t[2], t[1], t[3].map(v => -v), t[5].map(v => -v), t[4].map(v => -v)]));
    forme('capot-bord', C.tube(bord, .004, { cotes: 6, pas: 1 }));
    // Admission/turbos sous l'arche et carter longitudinal, visibles entre les deux gros tubes.
    const turb = [], collecteurs = [], brides = [];
    for (const k of [-1, 1]) {
      turb.push(...C.carene([{ x: -.56, y0: .485, y1: .695, l: .115, n: 2, z: k * .215 },
        { x: -.66, y0: .47, y1: .70, l: .13, n: 2, z: k * .215 },
        { x: -.73, y0: .485, y1: .68, l: .112, n: 2, z: k * .215 }], { cotes: 16, pas: 2 }));
      collecteurs.push(...C.tube([[-.40, .43, k * .19], [-.51, .48, k * .31], [-.61, .59, k * .22]], .032, { cotes: 8, pas: 2 }));
      brides.push(...C.tube([[-.734, .58, k * .215], [-.75, .58, k * .215]], .077, { cotes: 16, pas: 1 }));
    }
    forme('turbos', turb);
    forme('collecteurs', collecteurs);
    forme('brides-turbos', brides);
    const bloc = C.carene([{ x: -.51, y0: .22, y1: .47, l: .20, n: 4 },
      { x: -1.06, y0: .18, y1: .465, l: .25, n: 5 }, { x: -1.39, y0: .19, y1: .44, l: .27, n: 5 }], { cotes: 16, pas: 2 });
    forme('bloc-moteur', bloc);
    const carter = [{ x: -1.31, y0: .18, y1: .44, l: .24, n: 3 }, { x: -1.49, y0: .17, y1: .43, l: .22, n: 3 },
      { x: -1.65, y0: .18, y1: .41, l: .17, n: 2.8 }, { x: -1.78, y0: .21, y1: .37, l: .12, n: 2.4 }];
    const boite = C.carene([{ x: -1.15, y0: .19, y1: .40, l: .27, n: 4 },
      { x: -1.34, y0: .18, y1: .44, l: .31, n: 4 }, { x: -1.46, y0: .19, y1: .41, l: .27, n: 3 }], { cotes: 12, pas: 1 });
    const carterTri = C.carene(carter, { cotes: 16, pas: 2 });
    forme('boite-transversale', boite); forme('carter-arriere', carterTri);
    const nervures = [], profilCarter = C.profil(carter);
    for (const x of [-1.40, -1.49, -1.58, -1.67]) {
      const s = profilCarter(x), bord = Array.from({ length: 16 }, (_, i) => C.pointSection(s, i * Math.PI / 8));
      nervures.push(...C.tube(bord, .005, { cotes: 4, pas: 1, ferme: true }));
    }
    for (const z of [-.11, -.055, .055, .11]) nervures.push(...tube([-.72, .468, z], [-1.24, .46, z], .004));
    forme('nervures-boite', nervures);
    const auxiliaires = C.tube([[-.87, .49, 0], [-1.01, .49, 0]], .083, { cotes: 16, pas: 1 });
    auxiliaires.push(...C.tube([[-.82, .48, 0], [-.82, .66, 0]], .025, { cotes: 10, pas: 1, bouts: false }));
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4, y = .49 + .07 * Math.sin(a), z = .07 * Math.cos(a);
      auxiliaires.push(...C.tube([[-1.012, y, z], [-1.022, y, z]], .009, { cotes: 6, pas: 1 }));
    }
    forme('moteur-auxiliaires', auxiliaires);
    const bras = [], cardans = [], freins = [], ressorts = [], amortisseurs = [];
    for (const [a, b] of [
      [[-1.02, .20, .22], [-1.35, .18, .59]], [[-1.72, .20, .12], [-1.35, .18, .59]],
      [[-1.12, .40, .23], [-1.35, .43, .59]], [[-1.63, .39, .18], [-1.44, .37, .59]],
      [[-1.68, .20, .14], [-1.48, .40, .32]], [[-1.48, .40, .32], [-1.35, .43, .59]]
    ]) bras.push(...tube(a, b));
    cardans.push(...tube([-1.35, .335, .24], [-1.35, .335, .59], .019));
    const disque = C.carene([{ x: -.011, y0: -.105, y1: .105, l: .105, n: 2 },
      { x: .011, y0: -.105, y1: .105, l: .105, n: 2 }], { cotes: 18, pas: 1 });
    freins.push(...C.transformer(disque, euler(0, -Math.PI / 2, 0), [-1.35, .335, .53]));
    const ressortA = [-1.22, .36, .30], ressortB = [-1.41, .20, .52], axe = norme(ressortB.map((v, i) => v - ressortA[i])), cadre = selonAxe(axe);
    const spire = [];
    for (let i = 0; i <= 72; i++) { const t = i / 72, a = t * 14 * Math.PI;
      spire.push(ressortA.map((v, k) => v + t * (ressortB[k] - v) + .025 * (cadre[0][k] * Math.cos(a) + cadre[2][k] * Math.sin(a)))); }
    ressorts.push(...C.tube(spire, .004, { cotes: 4, pas: 1 }));
    amortisseurs.push(...tube(ressortA, ressortB, .015));
    forme('suspension-arriere', deuxCotes(bras)); forme('cardans-arriere', deuxCotes(cardans)); forme('freins-arriere', deuxCotes(freins));
    forme('ressorts-arriere', deuxCotes(ressorts)); forme('amortisseurs-arriere', deuxCotes(amortisseurs));
    // Platines ajourées ; une ouverture réelle, pas une pastille noire.
    const platines = [], cy = .31, cz = .305;
    const contour = [[.405, .31], [.39, .39], [.31, .46], [.245, .39], [.205, .31], [.245, .22], [.31, .19], [.365, .23]];
    const anneau = (i, x, interieur) => { const a = i * Math.PI / 4, q = contour[i % 8];
      return interieur ? [x, cy + .030 * Math.sin(a), cz + .030 * Math.cos(a)] : [x, q[0], q[1]]; };
    // L'anneau est dans le plan y/z : contour exprimé (y,z).
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      for (const sens of [-1, 1]) {
        const x = -1.49 + sens * .007;
        quad(platines, anneau(i, x, false), anneau(j, x, false), anneau(j, x, true), anneau(i, x, true), [sens, 0, 0]);
      }
      for (const interieur of [false, true]) {
        const a = anneau(i, -1.497, interieur), b = anneau(j, -1.497, interieur), c = anneau(j, -1.483, interieur), d = anneau(i, -1.483, interieur);
        const signe = interieur ? -1 : 1, n = [0, signe * ((a[1] + b[1]) / 2 - cy), signe * ((a[2] + b[2]) / 2 - cz)];
        quad(platines, a, b, c, d, n);
      }
    }
    forme('platines-arriere', deuxCotes(C.lisser(platines)));
    const dedans = [], levres = [], sorties = [];
    for (const [nom, points, rayon] of [
      ['hauts', [[-.73, A.sortieHauteY, A.sortieHauteZ], [-1.02, A.sortieHauteY, A.sortieHauteZ], [A.sortieHauteX, A.sortieHauteY, A.sortieHauteZ]], A.sortieHauteRayon],
      ['bas', [[-.62, .25, .31], [-.92, .19, .36], [-1.36, A.sortieBasseY, A.sortieBasseZ], [-1.62, A.sortieBasseY, A.sortieBasseZ], [A.sortieBasseX, A.sortieBasseY, A.sortieBasseZ]], A.sortieBasseRayon]
    ]) {
      const options = { cotes: 16, pas: 2, bouts: false }, interieur = rayon - .004;
      const tubeTri = deuxCotes(C.tube(points, rayon, options));
      forme('echappements-' + nom, tubeTri); sorties.push(...tubeTri);
      const peau = C.tube(points, interieur, options);
      dedans.push(...peau.map(t => [t[0], t[2], t[1], t[3].map(v => -v), t[5].map(v => -v), t[4].map(v => -v)]));
      const fin = points[points.length - 1], precedent = points[points.length - 2], axe = norme(fin.map((v, i) => v - precedent[i])), cadre = selonAxe(axe);
      const cercle = (i, r) => fin.map((v, k) => v + r * (cadre[0][k] * Math.cos(i * Math.PI / 8) + cadre[2][k] * Math.sin(i * Math.PI / 8)));
      for (let i = 0; i < 16; i++) quad(levres, cercle(i, rayon), cercle(i + 1, rayon), cercle(i + 1, interieur), cercle(i, interieur), axe);
    }
    forme('echappements-interieurs', deuxCotes(dedans)); forme('echappements-levres', deuxCotes(C.lisser(levres)));
    // Aileron arrière bi-plan + beam-wing + dérives en flèche + mât central affiné.
    const mat = plaque([[-1.72, .29], [-1.61, .33], [-1.81, .89], [-1.93, .89], [-1.85, .34]], -.012, .012);
    forme('mat-aileron', mat);
    const profilAile = (x, y, corde, pente, epaisseur) => {
      const p = []; for (let j = 0; j <= 12; j++) { const t = j / 12; p.push([x - corde * t, y + pente * t + epaisseur * Math.sin(Math.PI * t) ** .65]); }
      for (let j = 11; j >= 1; j--) { const t = j / 12; p.push([x - corde * t, y + pente * t - epaisseur * .45 * Math.sin(Math.PI * t) ** .65]); }
      return p;
    };
    // Aileron avant bi-plan (plan principal profilé + flap supérieur cambré) + 2 mâts profilés sous le nez.
    const aileAvant = plaque(profilAile(2.30, .112, .25, .024, .013), -.81, .81)
      .concat(plaque(profilAile(2.04, .144, .16, .062, .010), -.80, .80))
      .concat(deuxCotes(plaque([[2.14, .125], [1.96, .148], [1.98, .225], [2.11, .215]], .072, .086)));
    const derivesAvant = deuxCotes(plaque([[1.90, .068], [2.30, .068], [2.30, .155], [2.21, .225], [1.93, .238], [1.90, .195]], .805, .820));
    forme('aileron-avant', aileAvant); forme('derives-avant', derivesAvant);
    forme('aileron-avant-simple', aileAvant.concat(derivesAvant));
    // Aileron arrière bi-plan + petit beam-wing inférieur entre les roues arrière.
    const ailes = plaque(profilAile(-1.725, .855, .31, .052, .024), -.635, .635)
      .concat(plaque(profilAile(-2.040, .922, .17, .072, .016), -.635, .635))
      .concat(plaque(profilAile(-1.74, .445, .18, .048, .013), -.44, .44));
    forme('aileron-arriere', ailes);
    const derives = deuxCotes(plaque([[-1.705, .745], [-1.685, .81], [-1.690, .942], [-1.730, .972],
      [-2.175, 1.012], [-2.230, .978], [-2.230, .77], [-2.160, .725], [-1.92, .745]], .635, .650));
    forme('derives-arriere', derives);
    const levresAiles = [];
    for (const k of [-1, 1]) levresAiles.push(...C.tube([[-1.705, .80, k * .65], [-1.700, .935, k * .65],
      [-1.735, .962, k * .65], [-2.175, 1.000, k * .65], [-2.217, .970, k * .65], [-2.217, .78, k * .65]], .0045, { cotes: 6, pas: 2 }));
    forme('ailerons-levres', levresAiles);
    // Fond plat carbone + jupes latérales sous les pontons et diffuseur arrière à 4 dérives verticales.
    const fondPlat = plaque([[-1.04, .092], [.98, .092], [.98, .106], [-1.04, .106]], -.735, .735)
      .concat(deuxCotes(plaque([[-1.02, .082], [.96, .082], [.96, .112], [-1.02, .112]], .725, .740)));
    forme('fond-plat', fondPlat);
    const diffuseur = plaque([[-1.82, .195], [-1.14, .102], [-1.14, .122], [-1.82, .218]], -.46, .46);
    for (const z of [-.44, -.22, -.07, .07, .22, .44]) {
      diffuseur.push(...plaque([[-1.82, .102], [-1.20, .102], [-1.20, .130], [-1.82, .215]], z - .007, z + .007));
    }
    forme('diffuseur', diffuseur);
    // Feu stop centré sur le carter, lentille en saillie vers la voiture qui suit.
    forme('feu-stop-boitier', plaque([[-1.853, .252], [-1.765, .252], [-1.765, .390], [-1.853, .390]], -.112, .112));
    forme('feu-stop-lentille', plaque([[-1.863, .265], [-1.850, .265], [-1.850, .377], [-1.863, .377]], -.098, .098));
    // Étriers de freins sport (fixes sur chaque porte-moyeu, visibles derrière les rayons de jante).
    const etriers = [];
    for (const w of ROUES) {
      const k = Math.sign(w.z), zi = w.z - k * (w.l / 2 - .072);
      const bx = w.avant ? w.x - .11 : w.x + .12;
      etriers.push(...plaque([[bx - .042, w.r - .055], [bx + .042, w.r - .055], [bx + .048, w.r + .055], [bx - .048, w.r + .055]], zi - .022, zi + .022));
    }
    forme('etriers-freins', etriers);
    // Un lot métallique lointain conserve plateau, arceau/renforts, mécanique et aile.
    // Il n'ajoute aucune instance selon le nombre de petits boulons ou de spires.
    forme('arriere-metal-simple', plateau.concat(arceau, renforts, bloc, boite, carterTri, sorties, mat, ailes, derives));
  }
  // Version lointaine : mêmes sections, un seul lot. Les douze côtés des pontons préservent les lèvres des ouïes.
  // La bascule de détail ne rétablit pas l'ancienne flèche pleine entre les roues avant.
  forme('loin-caisse', ouvrirPontons(creuserCellule(C.carene(S_FLECHE, { cotes: 8, pas: 1 })
    .concat(C.carene(S_PONTONS, { cotes: 12, pas: 1 })))));
  forme('loin-dessus', creuserCellule(C.carene(S_GOUTTE,
    { cotes: 16, pas: 1, ouverture: OUVERTURE, interieur: true })));
  Object.defineProperty(FORMES, 'loin-dessus-pilote', { value: FORMES['loin-dessus'] });
  forme('loin-quille', creuserQuille(C.carene(S_QUILLE, { cotes: 8, pas: 1 })));
  // Pli du nez en coordonnées de la caisse. La cloison à x=.98 et le train roulant gardent leur pose.
  // Les petites variations de hauteur reproduisent un pli dans la peau, et le côté heurté soulève un bout d'aile.
  const PROFILS_NEZ = [[.38,0],[.82,0],[.62,-1],[.62,1]];
  function plierNez(p,n,force,cote,point=[]) {
    const u=Math.max(0,Math.min(1.25,(p[0]-.98)/1.20)), du=u>0&&u<1.25?1/1.20:0;
    const pli=Math.max(0,1-Math.abs(u-.49)/.27), dpli=pli>0?(u<.49?1:-1)/.27:0;
    const u2=u*u, recule=.57*force;
    const y=p[1]+force*(.11*pli*pli-.10*u2+cote*.12*p[2]*u),z=p[2]+cote*.29*force*u2;
    point[0]=p[0]-recule*u2;point[1]=y;point[2]=z;
    if(!n)return point;
    // Inverse transposée du jacobien local : pas de facette de lumière à la jonction du morceau intact.
    const xx=1-2*recule*u*du, yx=force*(.22*pli*dpli-.20*u+cote*.12*p[2])*du;
    const zx=cote*.58*force*u*du, yz=cote*.12*force*u, nz=n[2]-yz*n[1];
    return [point,[(n[0]-yx*n[1]-zx*nz)/xx,n[1],nz]];
  }
  const PIECES_NEZ = new Map();
  for(const nom of ['quille','fleche','filet','aileron-avant','derives-avant','aileron-avant-simple','loin-caisse','loin-quille']){
    const origine=FORMES[nom];
    const variantes=PROFILS_NEZ.map(([force,cote],k)=>{
      const triangles=origine.tri.map(tri=>{
        const pts=[],normales=[];
        for(let i=0;i<3;i++){
          const p=tri[i].map((q,j)=>origine.centre[j]+q*origine.taille[j]);
          const n=tri[i+3].map((q,j)=>q/origine.taille[j]);
          const [point,normale]=plierNez(p,n,force,cote);
          pts.push(point);normales.push(normale);
        }
        return pts.concat(normales);
      });
      const f=C.normaliser(triangles), shape=origine.nom+'-plie-'+k;
      globalThis.window?.FRender?.forme?.(shape,f.triangles);
      return {nom:shape,centre:f.centre,taille:f.taille};
    });
    PIECES_NEZ.set(origine.nom,variantes);
  }
  function profilImpact(z) {
    if(!z || !(z.avant>=.12))return 0;
    if(Math.abs(z.pli)>.13 && Math.abs(z.pli)>z.avant*.28)return z.pli<0?3:4;
    return z.avant<.53?1:2;
  }
  function pointSurNez(shape,profil,point) {
    if(profil && PIECES_NEZ.has(shape)){
      const [force,cote]=PROFILS_NEZ[profil-1];
      plierNez(point,null,force,cote,point);
    }
    return point;
  }
  function preparerNez(t,zones) {
    // En vue cockpit, la cuve et sa cloison masquent tout le nez sain (flèche et quille montent à
    // y 0,43, sous le haut de cloison 0,64) ; plié, il déborde de la cuve (z 0,24 contre 0,20) et
    // montre ses tranches rouges derrière la planche. L'habitacle garde donc le nez intact.
    const profil=t.cockpit?0:profilImpact(zones);
    if(profil===t.profilNez)return;
    t.profilNez=profil;
    if(profil && !t.originesNez)t.originesNez=t.o.slice();
    for(const element of t.nez){
      const {i,pc,formes}=element, o=t.objets[i];
      if(!profil){o.shape=pc.shape;o.s=pc.s;continue;}
      let centre;
      if(formes) {
        const f=formes[profil-1];o.shape=f.nom;o.s=f.taille;centre=f.centre;
      } else {
        const [force,cote]=PROFILS_NEZ[profil-1];
        centre=plierNez(pc.o,null,force,cote);
      }
      t.originesNez.set(centre,i*3);
    }
  }
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
  const S_CUVE = [{ x: .39, y0: .12, y1: .70, l: .25, n: 4 }, { x: 1.00, y0: .12, y1: .68, l: .25, n: 4 },
    { x: 1.30, y0: .13, y1: .66, l: .22, n: 4 }, { x: 1.345, y0: .135, y1: .64, l: .20, n: 4 }];
  // Cloison avant fermée en x = 1,345 (face intérieure doublée vers −x) : le pédalier reste clos en aluminium
  // sans laisser voir les tranches rouges de flèche/goutte/quille derrière la planche en vue cockpit.
  {
    const c = C.carene(S_CUVE, { cotes: 24, ouverture: { de: 1.30, a: .39, angle: 2.6 }, interieur: 'tout' });
    const cloison = c.filter(t => t.slice(0, 3).every(p => Math.abs(p[0] - 1.345) < 1e-6))
      .map(t => [t[0], t[2], t[1], t[3].map(v => -v), t[5].map(v => -v), t[4].map(v => -v)]);
    forme('cuve', c.concat(cloison));
  }
  const PROFIL_CUVE = C.profil(S_CUVE);
  function fondCuve(x, z) {
    const s = PROFIL_CUVE(x), h = (s.y1 - s.y0) / 2;
    return (s.y1 + s.y0) / 2 - h * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) / s.l, s.n)), 1 / s.n);
  }
  // Appui inférieur du thorax fermé. L'assise porte réellement cette surface et ses traverses
  // descendent dans le fond de cuve : ces pièces fixes restent communes à tous les niveaux de détail.
  const PILOTE_ASSISE = POSTE_126CK.assise;
  forme('assise-pilote', C.carene([
    { x: .530, y0: .261, y1: .282, l: .090, n: 4 },
    { x: .550, y0: .259, y1: PILOTE_ASSISE[1], l: .155, n: 4 },
    { x: .860, y0: .259, y1: PILOTE_ASSISE[1], l: .155, n: 4 },
    { x: .890, y0: .261, y1: .282, l: .090, n: 4 }
  ], { cotes: 24, pas: 1 }));
  forme('siege-supports', [].concat(...[.58, .81].map(x => C.carene([
    { x: x - .012, y0: fondCuve(x, 0) - .004, y1: .263, l: .100, n: 4 },
    { x: x + .012, y0: fondCuve(x, 0) - .004, y1: .263, l: .100, n: 4 }
  ], { cotes: 12, pas: 1 }))));
  // Dossier incliné et coussins striés de la vue 16. Ce siège appartient à la voiture,
  // y compris sans pilote ; les harnais posés sont préparés sur cette même surface.
  const DOSSIER = [[.275, .550], [.29, .550], [.40, .496], [.47, .468], [.54, .450],
    [.60, .435], [.64, .434], [.67, .438], [.70, .439]];
  const dossierSections = DOSSIER.map(([y, x]) => ({ x: y, y0: x - .028, y1: x - .004, l: .170, n: 4 }));
  const permuterDossier = p => [p[1], p[0], p[2]];
  forme('siege-dossier', C.carene(dossierSections, { cotes: 24, pas: 2 }).map(t =>
    [permuterDossier(t[0]), permuterDossier(t[2]), permuterDossier(t[1]),
      permuterDossier(t[3]), permuterDossier(t[5]), permuterDossier(t[4])]));
  {
    const cotes = [], couture = [], sangles = [];
    for (let i = 0; i < 8; i++) {
      const y = .325 + i * .047, x = C.profil(dossierSections)(y).y1 - .004;
      cotes.push(...C.tube([[x, y, -.143], [x, y, 0], [x, y, .143]], .003, { cotes: 6, pas: 2 }));
    }
    for (const k of [-1, 1]) {
      couture.push(...C.tube([[.86, .286, k * .148], [.55, .286, k * .155], [.442, .57, k * .166], [.430, .69, k * .155]], .003, { cotes: 6, pas: 2 }));
      // Sangles libres visibles dans le témoin sans pilote, épousant le dossier.
      sangles.push(...C.carene(DOSSIER.map(([y, x]) => ({ x: y,
        y0: x - .011, y1: x - .005, l: .021, z: k * (.060 + .035 * (y - .275) / .425), n: 4 })),
        { cotes: 8, pas: 2 }).map(t => [permuterDossier(t[0]), permuterDossier(t[2]), permuterDossier(t[1]),
          permuterDossier(t[3]), permuterDossier(t[5]), permuterDossier(t[4])]));
    }
    forme('siege-stries', cotes); forme('siege-coutures', couture); forme('harnais-poses', sangles);
  }
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

  const STOP_ETEINT = [.15, .008, .012], STOP_ALLUME = [1, .014, .006];
  function modele(livree) {
    const c1 = livree.couleur, c2 = livree.seconde || BLANC, casque = livree.casque || c2, combi = livree.combinaison || c1.map(v => v * .7);
    const corps = [], simples = [], moyennes = new Set();
    const P = (shape, o, s, mat, color, extra) => {
      const origine = extra && (extra.pilote || extra.tetePilote) ? originePilote(o, !!extra.tetePilote) : o;
      const p = piece(shape, origine, s, mat, color, extra); corps.push(p); return p;
    };
    // Version moyenne (voir detailPour) : la silhouette sans ses détails de quelques centimètres. Carènes de la caisse,
    // bande de la seconde couleur, cuve, capot moteur, ailerons et dérives, casque et visière, pneus, fonds de jante et
    // moyeux ; ni numéros, filets, suspensions, mécanique arrière, rayons ni repères des pneus.
    const Moy = p => { moyennes.add(p); return p; };
    const AR = extra => Object.assign({ arriere: true }, extra); // pièces du train et du carénage arrière, communes aux vues
    const pilote = { pilote: true }, tetePilote = { pilote: true, tetePilote: true };

    // Carrosserie : quille de nez, épaules distinctes des pontons ouverts, carénage du cockpit en goutte sur
    // l'axe, capot moteur, saute-vent en bulle teintée. Filet et bande basse de la seconde couleur.
    const L = (nom, mat, color, extra) => P(FORMES[nom].nom, FORMES[nom].centre, FORMES[nom].taille, mat, color, extra);
    Moy(L('quille', PEINTURE, c1));
    Moy(L('fleche', PEINTURE, c1));
    Moy(L('pontons', PEINTURE, c1));
    Moy(L('pontons-conduits', MAT, [.025, .027, .030]));
    L('pontons-radiateurs', METAL_MAT, [.12, .13, .14]);
    Moy(L('pontons-grilles', PEINTURE, c1));
    L('pontons-joints', MAT, [.07, .055, .05]);
    Moy(L('bande', PEINTURE, c2));
    L('filet', PEINTURE, c2);
    Moy(L('goutte', PEINTURE, c1));
    L('goutte-dedans', MAT, c1.map(v => v * .22));
    L('jonc', MAT, NOIR);
    const surfaceVerre = { id: livree.numero || 0, vitesse: 0, mouillage: 0 };
    Moy(L('bulle', METAL_MAT, [.30, .50, .86], { fx: true, alpha: .3, surfaceVerre }));
    Moy(L('fond-plat', MAT, CARBONE));
    Moy(L('moteur', PEINTURE, c1, AR()));
    Moy(L('moteur-dedans', MAT, [.08, .075, .07], AR()));
    L('capot-bord', PEINTURE, c1, AR());
    Moy(L('arceau', METAL_MAT, ARGENT, AR()));
    Moy(L('arceau-renforts', METAL_MAT, ARGENT, AR()));
    Moy(L('plateau-arriere', METAL_MAT, [.58, .60, .63], AR()));
    L('plateau-details', METAL_MAT, [.48, .50, .52], AR());
    L('basculeurs', MAT, NOIR);
    L('triangles', METAL_MAT, SOMBRE);
    // Aile avant bi-plan profilée + mâts carbone et dérives sculptées.
    Moy(L('aileron-avant', METAL_MAT, [.84, .85, .87]));
    Moy(L('derives-avant', MAT, CARBONE));
    L('etriers-freins', LAQUE, [.76, .09, .07]);
    // Cuve, coque, jonc et saute-vent sont identiques depuis le siège et depuis l'extérieur.
    Moy(L('cuve', METAL_MAT, [.27, .28, .29]));
    Moy(L('assise-pilote', TISSU, [.23, .035, .027]));
    Moy(L('siege-dossier', TISSU, [.23, .035, .027]));
    L('siege-stries', TISSU, [.19, .025, .020]);
    L('siege-coutures', TISSU, [.31, .055, .042]);
    L('harnais-poses', TISSU, [.60, .045, .025]);
    Moy(L('siege-supports', METAL_MAT, [.12, .125, .13]));
    // Thorax fermé commun ; la tête détaillée garde un repli en primitives pour les outils sans HUMAIN.
    L('pilote-buste', TISSU, combi, pilote);
    if (FORMES['pilote-casque']) {
      const PEAUX = [[.86, .66, .54], [.74, .54, .41], [.55, .38, .27], [.92, .76, .64]], peau = PEAUX[(livree.numero || 0) % PEAUX.length];
      Moy(L('pilote-casque', LAQUE, casque, tetePilote));
      if (FORMES['pilote-bande']) L('pilote-bande', LAQUE, c1, tetePilote);
      if (FORMES['pilote-visage']) L('pilote-visage', MAT, peau, tetePilote);
      if (FORMES['pilote-visiere']) Moy(L('pilote-visiere', METAL_MAT, [.05, .07, .11], { fx: true, alpha: .62, pilote: true, tetePilote: true }));
    } else {
      Moy(P('sphere', [.018, .914, 0], [.272, .33, .276], LAQUE, casque, tetePilote));
      Moy(P('box', [.13, .920, 0], [.07, .07, .2], METAL_MAT, [.05, .06, .09], tetePilote));
    }
    L('suspension-arriere', MAT, CARBONE, AR());
    L('cardans-arriere', METAL_MAT, SOMBRE, AR());
    L('freins-arriere', METAL_MAT, ACIER, AR());
    L('ressorts-arriere', METAL_MAT, ACIER, AR());
    L('amortisseurs-arriere', PEINTURE, [.42, .09, .06], AR());
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
      chiffres([xN, f(xN).y1, 0], [0, 0, -1], ey, .18, c => [c[0], dessus(f(c[0]), c[2]) + .004, c[2]], { numeroNez:true });
      const p = C.profil(S_PONTONS);
      // voi-3 : numéro de flanc calé entre la bande basse (haut y 0,17) et le filet (bas y 0,357)
      for (const k of [-1, 1]) chiffres([-.62, .262, k * .72], [k, 0, 0], [0, 1, 0], .15, c => [c[0], c[1], k * (flanc(p(c[0]), c[1]) + .004)], AR());
    }
    // Mécanique 126 CK apparente sous l'arche, même implantation aux trois détails.
    Moy(L('bloc-moteur', METAL_MAT, [.37, .38, .39], AR()));
    Moy(L('turbos', METAL_MAT, [.19, .18, .17], AR()));
    L('collecteurs', METAL_MAT, [.27, .23, .20], AR());
    L('brides-turbos', METAL_MAT, [.45, .44, .42], AR());
    L('moteur-auxiliaires', METAL_MAT, [.57, .58, .57], AR());
    Moy(L('boite-transversale', METAL_MAT, [.38, .39, .40], AR()));
    Moy(L('carter-arriere', METAL_MAT, [.43, .44, .44], AR()));
    L('nervures-boite', METAL_MAT, [.53, .54, .53], AR());
    L('platines-arriere', METAL_MAT, [.57, .58, .57], AR());
    Moy(L('echappements-hauts', METAL_MAT, [.50, .44, .37], AR()));
    Moy(L('echappements-bas', METAL_MAT, [.42, .37, .32], AR()));
    Moy(L('echappements-interieurs', MAT, [.018, .019, .021], AR()));
    Moy(L('echappements-levres', METAL_MAT, [.58, .51, .42], AR()));
    Moy(L('diffuseur', MAT, CARBONE, AR()));
    Moy(L('feu-stop-boitier', MAT, NOIR, AR()));
    const feuStop = Moy(L('feu-stop-lentille', LAQUE, STOP_ETEINT, AR({ feuStop: true })));
    simples.push(feuStop);
    Moy(L('mat-aileron', MAT, CARBONE, AR()));
    Moy(L('aileron-arriere', METAL_MAT, [.84, .85, .87], AR()));
    Moy(L('derives-arriere', MAT, CARBONE, AR()));
    L('ailerons-levres', METAL_MAT, [.64, .65, .67], AR());
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
      Moy(pieceRoue(jante.fut, METAL_MAT, [.24, .25, .27]));
      Moy(pieceRoue(jante.rayons, METAL_MAT, [.66, .56, .35]));
      Moy(pieceRoue(jante.moyeu, METAL_MAT, [.66, .16, .11]));
      pieceRoue(DISQUES_ROUE, METAL_MAT, [.40, .40, .42], { decale: [0, -k * (w.l / 2 - .055), 0], detailRoueMax: 1 });
      pieceRoue(jante.bague, MAT, pneus.cercle, { pneus: typePneus, detailRoueMax: 1 });
      const valve = FORMES['valve-roue'];
      P(valve.nom, [w.x, w.r, w.z], valve.taille, MAT, [.20, .18, .13],
        Object.assign({}, base, { decale: [.145, k * (w.l / 2 - .016), 0], detailRoueMax: 1 }));
    });

    // Version lointaine : trois carènes à huit côtés, les ailerons, le casque et les quatre roues
    const loin = nom => piece(FORMES[nom].nom, FORMES[nom].centre, FORMES[nom].taille, PEINTURE, c1);
    const casqueSimple = FORMES['pilote-casque'] || { centre: [.018, .914, 0], taille: [.272, .33, .276] };
    simples.push(loin('loin-caisse'), loin('loin-dessus'), loin('loin-quille'),
      piece(FORMES['pontons-conduits'].nom, FORMES['pontons-conduits'].centre, FORMES['pontons-conduits'].taille, MAT, [.025, .027, .030]),
      piece(FORMES.cuve.nom, FORMES.cuve.centre, FORMES.cuve.taille, METAL_MAT, [.27, .28, .29]),
      piece(FORMES['assise-pilote'].nom, FORMES['assise-pilote'].centre, FORMES['assise-pilote'].taille, TISSU, [.23, .035, .027]),
      piece(FORMES['siege-dossier'].nom, FORMES['siege-dossier'].centre, FORMES['siege-dossier'].taille, TISSU, [.23, .035, .027]),
      piece(FORMES['siege-supports'].nom, FORMES['siege-supports'].centre, FORMES['siege-supports'].taille, METAL_MAT, [.12, .125, .13]),
      piece(FORMES['aileron-avant-simple'].nom, FORMES['aileron-avant-simple'].centre, FORMES['aileron-avant-simple'].taille, METAL_MAT, ARGENT),
      piece(FORMES.moteur.nom, FORMES.moteur.centre, FORMES.moteur.taille, PEINTURE, c1, AR()),
      piece(FORMES['arriere-metal-simple'].nom, FORMES['arriere-metal-simple'].centre, FORMES['arriere-metal-simple'].taille, METAL_MAT, ARGENT, AR()),
      piece('sphere', originePilote(casqueSimple.centre, true), casqueSimple.taille, LAQUE, casque, { tetePilote: true }));
    ROUES.forEach((w, i) => {
      const formes = ROUES_FORMES[w.avant ? 'av' : 'ar'][typePneus], f = formes[3];
      simples.push(piece(f.nom, [w.x, w.r, w.z], f.taille, MAT, PNEU, { m: ROUE_AXE, roue: i, tourne: phasesRoues[i], formesRoues: formes, usureRoue: 1 }));
    });
    // Après casse, ne reste que la cellule du pilote et l'arceau ; roues et carrosserie sont des débris.
    const epave = corps.filter(p => p.pilote || ['cuve', 'goutte', 'goutte-dedans', 'arceau', 'arceau-renforts', 'plateau-arriere', 'assise-pilote', 'siege-dossier', 'siege-stries', 'siege-coutures', 'harnais-poses', 'siege-supports'].some(n => p.shape === FORMES[n].nom));
    const mod = { corps, simples, epave, surfaceVerre, moyens: corps.filter(p => moyennes.has(p)), livree };
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
        if (cockpit && p.tetePilote) continue;
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
  // Même voiture dans les deux vues. Seule la propre tête est masquée depuis ses yeux ;
  // les roues gardent leur sélection de détail et leur flou selon la vitesse.
  function visible(pc, cockpit, v) {
    if (pc.usureRoue > 1) return false; // supports réservés à la pose dynamique ; le modèle sans état est neuf
    if (cockpit && pc.tetePilote) return false;
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
      e = { M3: [trois(), trois(), trois()], tables: new Array(16).fill(null), retro: [null, null, null, null], habitacle: null, pilote: null,
        pose: { matrice: new Float64Array(9), epoque: 0, cap: 0, tangage: 0, roulis: 0,
          px: 0, py: 0, pz: 0, suspension: false, courses: new Float64Array(4), moyeux: [], pieces: new WeakMap(),
          centresLOD: new Float64Array(12), epoqueLOD: -1, orientation: 0, rotationsRoues: [], rotationsFixes: [],
          braquage: NaN, braquages: new Float64Array(2) },
        pneus: { cle: new Float64Array(16).fill(NaN), couleurs: new Float64Array(4 * 15), actifs: new Uint8Array(4) } };
      Object.defineProperty(mod, 'objetsRendu', { value: e });   // ni énuméré, ni copié, ni sérialisé avec le modèle
    }
    return e;
  }
  // La caisse et les suspensions ont la même pose pour toutes les caméras. Les valeurs sont
  // relues car la simulation réutilise ses tableaux et un appelant peut reposer le même modèle ailleurs.
  function actualiserPose(p, ev) {
    const cap = ev.cap, tangage = ev.tangage || 0, roulis = ev.roulis || 0;
    const rotation = !p.epoque || !Object.is(cap, p.cap) || !Object.is(tangage, p.tangage) || !Object.is(roulis, p.roulis);
    if (rotation) {
      p.cap = cap; p.tangage = tangage; p.roulis = roulis;
      attitudeDans(p.matrice, ev);
      p.orientation++;
    }
    const x = ev.p[0], y = ev.p[1], z = ev.p[2], suspension = !!ev.rebond;
    let change = rotation || !Object.is(x, p.px) || !Object.is(y, p.py) || !Object.is(z, p.pz) || suspension !== p.suspension;
    p.px = x; p.py = y; p.pz = z; p.suspension = suspension;
    for (let i = 0; i < p.courses.length; i++) {
      const h = suspension ? ev.rebond[i] || 0 : 0;
      if (!Object.is(p.courses[i], h)) { p.courses[i] = h; change = true; }
    }
    if (change) p.epoque++;
    return p.matrice;
  }
  // La projection d'une origine rigide est commune aux tables du modèle. La jante, le pneu,
  // le moyeu et la sculpture utilisent aussi le même axe. Une pièce décalée (disque, valve)
  // reprend seulement l'origine tournée : son décalage doit être ajouté AVANT la suspension.
  function ancrePiece(p, pc, o, roue) {
    const w = ROUES[roue], auMoyeu = w && Object.is(o[0], w.x) && Object.is(o[1], w.r) && Object.is(o[2], w.z);
    let a = auMoyeu ? p.moyeux[roue] : p.pieces.get(pc);
    if (!a || a.roue !== roue || !Object.is(a.x, o[0]) || !Object.is(a.y, o[1]) || !Object.is(a.z, o[2])) {
      a = { x: o[0], y: o[1], z: o[2], roue, epoque: -1, a: 0, b: 0, c: 0, X: 0, Y: 0, Z: 0 };
      if (auMoyeu) p.moyeux[roue] = a; else p.pieces.set(pc, a);
    }
    return a;
  }
  function placerAncre(p, a) {
    const M = p.matrice, x = a.x, y = a.y, z = a.z;
    let dx = M[0] * x + M[3] * y + M[6] * z, dy = M[1] * x + M[4] * y + M[7] * z, dz = M[2] * x + M[5] * y + M[8] * z;
    a.a = dx; a.b = dy; a.c = dz;
    if (p.suspension && a.roue >= 0) {
      const h = p.courses[a.roue];
      dx += M[3] * h; dy += M[4] * h; dz += M[5] * h;
    }
    a.X = p.px + dx; a.Y = p.py + dy; a.Z = p.pz + dz; a.epoque = p.epoque;
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
  function compiler(liste, overlay, cockpit, e) {
    const t = { liste, longueur: liste.length, n: 0, nez: [], profilNez: 0, originesNez: null, objets: [], formesRoues: [], formesUsees: [], usureRoue: [], profondeur: [], detailRoueMax: [],
      pose: e.pose, ancres: [], pneusCourants: e.pneus.couleurs, pneusActifs: e.pneus.actifs, clePneus: e.pneus.cle,
      o: null, roue: null, groupe: [], fixe: [], decale: null, d: null, portee: null,
      lent: null, vite: null, tete: null, buste: null, bulle: -1, dessusLoin: -1, cockpit, rotTete: trois(), rotM: trois(), fixes: [], groupes: [], faitG: null, faitF: null };
    const o = [], roues = [], decale = [], d = [], portee = [], lent = [], vite = [], tete = [], buste = [];
    for (const pc of liste) {
      if (cockpit && pc.tetePilote) continue;
      const objet = { shape: pc.shape, p: trois(), s: pc.s, r: t.rotM, mat: pc.mat, color: pc.color, surface: 'object' };
      const formesNez=PIECES_NEZ.get(pc.shape);
      if(formesNez || pc.numeroNez)t.nez.push({i:t.n,pc,formes:formesNez});
      if (pc.feuStop) t.feuStop = objet;
      if (pc.usureRoue) objet.color = pc.color.slice();
      if (pc.usureRoue === 5) objet.s = pc.s.slice();
      if (pc.fx) { objet.fx = true; objet.alpha = pc.alpha; }
      if (overlay) objet.overlay = true;
      const roue = pc.roue === undefined ? -1 : pc.roue;
      let groupe = null, fixe = null;
      if (roue >= 0) {
        const m = aplatir(pc.m), w = ROUES[roue];
        groupe = t.groupes.find(g => g.roue === roue && Object.is(g.tourne, pc.tourne) && memes(g.m, m)) || null;
        if (!groupe) {
          let commun = e.pose.rotationsRoues.find(g => g.roue === roue && Object.is(g.tourne, pc.tourne) && memes(g.m, m));
          if (!commun) e.pose.rotationsRoues.push(commun = { roue, tourne: pc.tourne, m, orientation: -1, roule: 0, braquage: 0, R: new Float64Array(9), r: trois() });
          t.groupes.push(groupe = { n: t.groupes.length, roue, avant: w.avant, rayon: w.r, tourne: pc.tourne, m, commun, R: commun.R, r: trois() });
        }
        objet.r = groupe.r;
      } else if (pc.m) {
        const m = aplatir(pc.m);
        fixe = t.fixes.find(x => memes(x.m, m)) || null;
        if (!fixe) {
          let commun = e.pose.rotationsFixes.find(f => memes(f.m, m));
          if (!commun) e.pose.rotationsFixes.push(commun = { m, orientation: -1, r: trois() });
          t.fixes.push(fixe = { n: t.fixes.length, m, commun, r: trois() });
        }
        objet.r = fixe.r;
      }
      const dc = roue >= 0 && pc.decale ? Float64Array.from(pc.decale) : null, oc = Float64Array.from(pc.o);
      t.ancres.push(formesNez || pc.numeroNez || pc.tetePilote ? null : ancrePiece(e.pose, pc, oc, roue));
      t.objets.push(objet); t.formesRoues.push(pc.formesRoues || null); t.detailRoueMax.push(pc.detailRoueMax === undefined ? 3 : pc.detailRoueMax);
      t.formesUsees.push(pc.formesUsees || null); t.usureRoue.push(pc.usureRoue || 0); t.profondeur.push(pc.profondeur || 0);
      t.groupe.push(groupe); t.fixe.push(fixe);
      if (pc.surfaceVerre) { objet.surfaceVerre = pc.surfaceVerre; t.bulle = t.n; }
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
    if (t === null || t.liste !== liste || t.longueur !== liste.length) t = e.tables[k] = compiler(liste, (variante & 1) !== 0, (variante & 2) !== 0, e);
    return t;
  }
  // Table du rétroviseur : les pièces de la vue extérieure, avec leurs propres objets et rotations
  function tableRetro(e, mod, li) {
    const liste = mod[NOMS_LISTES[li]] || mod.corps;
    let t = e.retro[li];
    if (t === null || t.liste !== liste || t.longueur !== liste.length) t = e.retro[li] = partager(compiler(liste, false, false, e), tableDe(e, mod, li, 0));
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
  const T_E = new Float64Array(9), T_F = new Float64Array(9), T_G = new Float64Array(9), T_H = new Float64Array(9), ANG_ROUE = new Float64Array(2);
  function braquagesDans(d, angles) {
    if (Math.abs(d) < 1e-5) { angles[0] = d; angles[1] = d; return; }
    const R = EMPATTEMENT / Math.tan(Math.abs(d));
    const interieur = Math.atan(EMPATTEMENT / (R - DEMI_VOIE_AV)), exterieur = Math.atan(EMPATTEMENT / (R + DEMI_VOIE_AV));
    if (d > 0) { angles[0] = exterieur; angles[1] = interieur; } else { angles[0] = -interieur; angles[1] = -exterieur; }
  }
  // Les objets des variantes gardent leurs propres angles publiés. Le produit matriciel et
  // sa décomposition, communs aux variantes, dépendent seulement des entrées de rotation.
  function tournerRoue(g, pose, ev) {
    const commun = g.commun, roule = g.tourne !== undefined ? ev.roule || 0 : 0, d = g.avant ? ev.braquage || 0 : 0;
    if (commun.orientation !== pose.orientation || !Object.is(roule, commun.roule) || !Object.is(d, commun.braquage)) {
      let m = g.m;
      if (g.tourne !== undefined) { ANG_ROUE[0] = g.tourne - roule / g.rayon; m = produitDans(T_E, m, eulerDe(T_F, ANG_ROUE, 0, 1)); }
      if (g.avant) {
        if (!Object.is(d, pose.braquage)) { braquagesDans(d, pose.braquages); pose.braquage = d; }
        ANG_ROUE[1] = -pose.braquages[g.roue]; m = produitDans(T_G, eulerDe(T_H, ANG_ROUE, 1, 1), m);
      }
      anglesDans(commun.r, produitDans(commun.R, pose.matrice, m));
      commun.orientation = pose.orientation; commun.roule = roule; commun.braquage = d;
    }
    g.r[0] = commun.r[0]; g.r[1] = commun.r[1]; g.r[2] = commun.r[2];
  }
  function tournerFixe(f, pose) {
    const commun = f.commun;
    if (commun.orientation !== pose.orientation) { anglesProduit(commun.r, pose.matrice, f.m); commun.orientation = pose.orientation; }
    f.r[0] = commun.r[0]; f.r[1] = commun.r[1]; f.r[2] = commun.r[2];
  }
  // Filtre des rétroviseurs de jeu.js (majGlaces) : près de l'essieu arrière (x) et hors de la caisse (z), dans le
  // repère du cap. Une pièce de roue décalée s'écarte de l'axe de sa roue d'au plus la longueur de son décalage, et
  // le rebond l'en écarte d'au plus |h| : loin du filtre de plus que cela (et d'une marge pour les arrondis), elle n'y
  // entre pas, sans qu'il faille calculer la rotation de sa roue.
  const X_ARRIERE = ROUES[2].x, MARGE_RETRO = 1e-6, LOIN_RETRO = 1e8;
  // Couleurs persistantes par modèle. La graine ne sert qu'à la matière : aucun hasard de simulation,
  // aucune réinitialisation d'usure en changeant de vue. Les données reçues restent en lecture seule.
  function preparerPneus(t, etats) {
    const valeurs = t.pneusCourants;
    for (let i = 0; i < 4; i++) {
      const e = etats && etats[i], j = i * 15;
      const u = e && Number.isFinite(e.usure) ? Math.max(0, Math.min(1, e.usure)) : 0;
      const s = e && Number.isFinite(e.salete) ? Math.max(0, Math.min(1, e.salete)) : 0;
      const g = e && Number.isFinite(e.grainage) ? Math.max(0, Math.min(1, e.grainage)) : 0;
      const graine = e && Number.isFinite(e.graine) ? e.graine >>> 0 : i + 1;
      const cle = t.clePneus, k = i * 4;
      if (cle[k] === u && cle[k + 1] === s && cle[k + 2] === g && cle[k + 3] === graine) continue;
      cle[k] = u; cle[k + 1] = s; cle[k + 2] = g; cle[k + 3] = graine;
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
  function poserTable(t, M, ev, sortie, roues, retro, detailRoues = 0, tete = null, sansPilote = false) {
    const px = ev.p[0], py = ev.p[1], pz = ev.p[2], v = ev.v || 0, rebond = ev.rebond;
    if (t.feuStop) {
      t.feuStop.color = ev.feuStop ? STOP_ALLUME : STOP_ETEINT;
      t.feuStop.emissive = ev.feuStop ? 4.5 : 0;
    }
    preparerNez(t,ev.zonesDegats);
    const origines=t.profilNez?t.originesNez:t.o;
    preparerPneus(t, ev.etatPneus);
    anglesDans(t.rotM, M);
    if (tete) anglesProduit(t.rotTete, M, tete);
    t.faitG.fill(0); t.faitF.fill(0);
    const ca = retro ? Math.cos(ev.cap) : 0, sa = retro ? Math.sin(ev.cap) : 0;
    const borne = retro && Math.abs(px) < LOIN_RETRO && Math.abs(pz) < LOIN_RETRO;   // arrondis de px + a − px négligeables
    for (let i = 0; i < t.n; i++) {
      if (sansPilote && (t.tete[i] || t.buste[i])) continue;
      if (t.tete[i] && t.cockpit && ev.pilote) continue;
      if (detailRoues > t.detailRoueMax[i]) continue;
      if ((t.lent[i] === 1 && v > VITESSE_FLOU) || (t.vite[i] === 1 && !(v > VITESSE_FLOU))) continue;
      const roue = t.roue[i];
      const usureRoue = t.usureRoue[i];
      if (usureRoue > 1 && !t.pneusActifs[roue]) continue;
      // Chantier 3 : une roue détachée (degats.roues[i]) n'est plus dessinée
      if (roue >= 0 && roues && roues[roue]) continue;
      const k = 3 * i;
      const ancre = t.ancres[i];
      let a, b, c, X, Y, Z;
      if (ancre) {
        if (ancre.epoque !== t.pose.epoque) placerAncre(t.pose, ancre);
        X = ancre.X; Y = ancre.Y; Z = ancre.Z;
      } else {
        let x = origines[k], y = origines[k + 1], z = origines[k + 2];
        if (t.tete[i]) {
          t.objets[i].r = tete ? t.rotTete : t.fixe[i] ? t.fixe[i].r : t.rotM;
          if (tete) {
            const dx = x - PILOTE_COU[0], dy = y - PILOTE_COU[1], dz = z - PILOTE_COU[2];
            x = PILOTE_COU[0] + tete[0] * dx + tete[3] * dy + tete[6] * dz;
            y = PILOTE_COU[1] + tete[1] * dx + tete[4] * dy + tete[7] * dz;
            z = PILOTE_COU[2] + tete[2] * dx + tete[5] * dy + tete[8] * dz;
          }
        }
        a = M[0] * x + M[3] * y + M[6] * z; b = M[1] * x + M[4] * y + M[7] * z; c = M[2] * x + M[5] * y + M[8] * z;
      }
      if (!ancre || t.decale[i]) {
        // `decale` place la pièce hors de l'axe, dans le repère de la roue ; `rebond` (m, par roue) : course de
        // suspension sur les bosses, purement visuelle
        if (t.decale[i] === 1) {
          if (ancre) { a = ancre.a; b = ancre.b; c = ancre.c; }
          const g = t.groupe[i];
          if (t.faitG[g.n] === 0) {
            if (borne) {
              const marge = t.portee[i] + (rebond ? Math.abs(rebond[roue] || 0) : 0) + MARGE_RETRO, xc = a * ca + c * sa, zc = c * ca - a * sa;
              if (Math.abs(xc - X_ARRIERE) >= .5 + marge || Math.abs(zc) <= .55 - marge) continue;
            }
            tournerRoue(g, t.pose, ev); t.faitG[g.n] = 1;
          }
          const R = g.R, dx = t.d[k], dy = t.d[k + 1], dz = t.d[k + 2];
          a = a + (R[0] * dx + R[3] * dy + R[6] * dz); b = b + (R[1] * dx + R[4] * dy + R[7] * dz); c = c + (R[2] * dx + R[5] * dy + R[8] * dz);
        }
        if (roue >= 0 && rebond) { const h = rebond[roue] || 0; a = a + M[3] * h; b = b + M[4] * h; c = c + M[5] * h; }
        X = px + a; Y = py + b; Z = pz + c;
      }
      if (retro) {
        const dx = X - px, dz = Z - pz, xc = dx * ca + dz * sa, zc = dz * ca - dx * sa;
        if (!(Math.abs(xc - X_ARRIERE) < .5 && Math.abs(zc) > .55)) continue;
      }
      if (roue >= 0) { const g = t.groupe[i]; if (t.faitG[g.n] === 0) { tournerRoue(g, t.pose, ev); t.faitG[g.n] = 1; } }
      else { const f = t.fixe[i]; if (f !== null && t.faitF[f.n] === 0) { tournerFixe(f, t.pose); t.faitF[f.n] = 1; } }
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
    const M = actualiserPose(e.pose, ev);
    const detailRoues = o.rouesDetail === undefined ? li === SIMPLES ? 3 : li === MOYENS ? 2 : 0 : Math.max(0, Math.min(3, o.rouesDetail | 0));
    const pilote = !o.cockpit && !o.casse ? e.pilote : null;
    if (pilote) preparerPiloteExterieur(pilote, ev.pilote || POSTE_NEUTRE);
    poserTable(t, M, ev, sortie, o.roues, false, detailRoues, pilote ? pilote.tete : null, !!mod.sansPilote);
    if (pilote) poserPiloteExterieur(pilote, li * 2 + (o.overlay ? 1 : 0), M, ev, sortie, false, !!mod.sansPilote);
    return imbriquee(e.M3, M);
  }
  // Rétroviseurs (jeu.js, majGlaces) : de la voiture suivie, vue de dehors, la glace ne garde que ce qui passe le
  // filtre de jeu.js, près de l'essieu arrière et hors de la caisse (|z| > 0,55 dans le repère du cap) : les pièces des
  // roues arrière, et d'autres quand la voiture se retourne (saut, tonneau). Même sortie que poser suivi de ce filtre,
  // pour toute attitude, sans pousser puis retirer aussitôt le reste de la caisse ni calculer ses rotations.
  // options = { roues, casse }, comme pour poser.
  function poserRetro(mod, ev, sortie, options) {
    const o = options || SANS_OPTIONS, e = etatRendu(mod), t = tableRetro(e, mod, o.casse ? EPAVE : CORPS);
    const M = actualiserPose(e.pose, ev);
    const pilote = !o.casse ? e.pilote : null;
    if (pilote) preparerPiloteExterieur(pilote, ev.pilote || POSTE_NEUTRE);
    poserTable(t, M, ev, sortie, o.roues, true, o.rouesDetail === undefined ? 0 : Math.max(0, Math.min(3, o.rouesDetail | 0)), pilote ? pilote.tete : null, !!mod.sansPilote);
    if (pilote) poserPiloteExterieur(pilote, 8, M, ev, sortie, true, !!mod.sansPilote);
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
  // Le LOD ajoute la course au rayon avant la rotation. Garder ses centres propres, communs aux
  // caméras pour cette pose ; seule la distance à leur œil varie, y compris au seuil d'hystérésis.
  const M_DISTANCE_ROUES = new Float64Array(9), CENTRES_DISTANCE_ROUES = new Float64Array(12);
  function placerCentresLOD(centres, M, ev) {
    const p = ev.p, rebond = ev.rebond;
    for (let i = 0; i < ROUES.length; i++) {
      const w = ROUES[i], y = w.r + (rebond ? rebond[i] || 0 : 0), k = i * 3;
      centres[k] = p[0] + M[0] * w.x + M[3] * y + M[6] * w.z;
      centres[k + 1] = p[1] + M[1] * w.x + M[4] * y + M[7] * w.z;
      centres[k + 2] = p[2] + M[2] * w.x + M[5] * y + M[8] * w.z;
    }
  }
  function distanceRoues2(ev, camera, mod) {
    let centres = CENTRES_DISTANCE_ROUES;
    if (mod) {
      const pose = etatRendu(mod).pose, M = actualiserPose(pose, ev);
      centres = pose.centresLOD;
      if (pose.epoqueLOD !== pose.epoque) {
        placerCentresLOD(centres, M, ev);
        pose.epoqueLOD = pose.epoque;
      }
    } else placerCentresLOD(centres, attitudeDans(M_DISTANCE_ROUES, ev), ev);
    let distance2 = Infinity;
    for (let k = 0; k < centres.length; k += 3) {
      const x = centres[k] - camera[0], h = centres[k + 1] - camera[1], z = centres[k + 2] - camera[2];
      distance2 = Math.min(distance2, x * x + h * h + z * z);
    }
    const distance = Math.max(.1, Math.sqrt(distance2) - ROUES[2].r);
    return distance * distance;
  }

  // ---------------------------------------------------------------- cockpit
  // Centre des yeux neutres du pilote dans le repère voiture, mesuré sur le modèle HUMAIN.
  // Ce point règle uniquement la caméra : il ne déplace ni ne redimensionne les pièces de l'habitacle.
  const OEIL = [.595, .886, 0];
  const POSTE_NEUTRE = Object.freeze({ volant: 0, rapport: 0, rapportAvant: 0, passage: 1, regime: 0, kmh: 0 });
  // Échelle de construction commune des commandes. Les coordonnées de leur dessin sont converties une fois
  // en mètres, autour de l'ancrage du volant dans la cellule. Les deux vues posent ces mêmes coordonnées.
  const K = .9, VOLANT_MONDE = POSTE_126CK.volant;
  // Géométrie de construction de la jante, avant conversion commune en mètres. Le haut s'écarte du pilote ;
  // mains à 9 h et 3 h sur les branches, avec l'axe de prise perpendiculaire à la jante.
  // Le cadrage depuis le siège se règle dans jeu.js, jamais en déformant ces pièces.
  // La face regarde vers le pilote et légèrement vers le haut ; la colonne descend vers la crémaillère.
  const VOLANT = { centre: [.88, -.244, 0], rayon: .14, inclinaison: .12, course: 1.6, prise: Math.PI / 2 };
  const ORIGINE_HABITACLE = VOLANT_MONDE.map((v, i) => v - K * VOLANT.centre[i]);
  // La planche a son propre ancrage métrique : avancer/abaisser la direction ne doit ni la rapprocher des yeux
  // ni l'entraîner sous l'écran. Les trois vues utilisent la même conversion dans le repère de construction.
  const PLANCHE_MONDE = POSTE_126CK.planche, PENTE_PLANCHE = .22;
  const PLANCHE = PLANCHE_MONDE.map((v, i) => (v - ORIGINE_HABITACLE[i]) / K);
  const COUDE = [.50, -.68, .19];              // repli statique pour les anciennes poses sans état pilote
  const LEVIER = [.818, -.27, .262];           // pommeau du levier de vitesses, à droite du volant, au point mort
  const REGIME_LAMPE = 12000;                  // la lampe de la casquette s'allume : il est temps de monter un rapport
  // Afficheurs à sept segments : a en haut, puis b, c, d, e, f dans le sens des aiguilles d'une montre, g au milieu.
  const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', N: 'ceg', R: 'abefg', '-': 'g' };
  const AMBRE = [1, .56, .12], ETEINT = [.09, .035, .02];
  // Formes libres des commandes, dans le repère de construction (voir K), commun à toutes les vues.
  // (x : vers la droite, y : vers le haut de la planche, z : vers le pilote) ; jante et branches dans celui du volant
  // (x : vers le haut de la jante, y : vers le pilote, z : vers la droite de la jante).
  {
    const R = VOLANT.rayon, e = R / .105;
    // Poste 126 CK, vues 16/36 : trois cadrans groupés sur un support compact derrière la jante.
    // Le bord reste arrondi, sans la grande arche haute du candidat précédent.
    const bord = [[-.166, .025], [-.146, .067], [-.100, .088], [0, .096],
      [.100, .088], [.146, .067], [.166, .025]];
    forme('planche', C.carene(bord.map(([x, haut]) => ({ x, y0: -.066, y1: haut, l: .007, n: 6 })), { cotes: 24, pas: 3 }));
    forme('casquette', C.carene(bord.map(([x, haut]) => ({ x, y0: haut + .002, y1: haut + .007, l: .010, n: 3, z: .008 })), { cotes: 20, pas: 3 }));
    // Bague sertie ouverte au centre. Les deux tailles conservent la même largeur de lèvre.
    for (const [nom, diametre] of [['compte-tours', .095], ['auxiliaire', .055]]) {
      const r = diametre / 2;
      forme('lunette-' + nom, revolutionRoue([
        [.005, r + .001], [.005, r + .004], [.007, r + .005], [.015, r + .005],
        [.018, r + .003], [.018, r - .0005], [.015, r - .0015], [.013, r + .001]
      ], 32, false));
    }
    // Même périmètre à 32 côtés que la bague dans tous les LOD, y compris au niveau léger.
    const disque = C.carene([-.5,.5].map(x => ({ x, y0: -.5, y1: .5, l: .5, n: 2 })), { cotes: 32, pas: 1 });
    forme('fond-cadran', C.transformer(disque, [[0,1,0],[1,0,0],[0,0,-1]]));
    // Diffuseur d'une barrette LED, biseaux visibles dans le plan de lecture.
    const contour = [[-.5, 0], [-.36, -.5], [.36, -.5], [.5, 0], [.36, .5], [-.36, .5]];
    const avant = contour.map(([x,y]) => [x,y,.5]), arriere = contour.map(([x,y]) => [x,y,-.5]), led = [];
    const faceLed = (a,b,c,n) => led.push([a,b,c,n,n,n]);
    for (let i = 1; i < contour.length-1; i++) {
      faceLed(avant[0], avant[i], avant[i+1], [0,0,1]);
      faceLed(arriere[0], arriere[i+1], arriere[i], [0,0,-1]);
    }
    for (let i = 0; i < contour.length; i++) {
      const j = (i+1) % contour.length, dx = contour[j][0]-contour[i][0], dy = contour[j][1]-contour[i][1];
      const longueur = Math.hypot(dx,dy), n = [dy/longueur,-dx/longueur,0];
      faceLed(arriere[i],arriere[j],avant[j],n);
      faceLed(arriere[i],avant[j],avant[i],n);
    }
    forme('segment-led', led);
    forme('jante', C.tube(Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12; return [R * Math.cos(a), 0, R * Math.sin(a)]; }), .0225 * e / 2, { cotes: 10, ferme: true, pas: 2 }));
    // Photo réelle fournie : branches noires pleines, légèrement effilées vers la jante.
    const branche = C.carene([{ x: .028 * e, y0: -.003, y1: .003, l: .016 * e, n: 4 },
      { x: .070 * e, y0: -.003, y1: .003, l: .014 * e, n: 4 },
      { x: R * .98, y0: -.003, y1: .003, l: .0115 * e, n: 4 }], { cotes: 12, pas: 2 });
    const autourY = a => [[Math.cos(a), 0, -Math.sin(a)], [0, 1, 0], [Math.sin(a), 0, Math.cos(a)]];
    forme('branches', [].concat(...[-Math.PI / 2, Math.PI / 2, Math.PI].map(a => C.transformer(branche, autourY(a)))));
    // Coussin circulaire épais, distinct du petit moyeu métallique de la variante RenderBlade.
    // La révolution en 48 côtés évite une tête hexagonale ; face centrale sobre, sans emblème importé.
    const coussin = [[-.010, .031], [-.004, .039], [.005, .040], [.018, .0385], [.026, .030]];
    forme('moyeu-capitonne', C.transformer(C.carene(coussin.map(([x, r]) =>
      ({ x, y0: -r * e, y1: r * e, l: r * e, n: 2 })), { cotes: 48, pas: 2 }), [[0, 1, 0], [1, 0, 0], [0, 0, -1]]));
  }
  // Mains : le maillage de src/main.js (main droite, taille réelle, repère de la prise) et son miroir pour la gauche
  const MAIN = B.main.construire(), MAIN_OUVERT = B.main.construire(true);
  for (const [cote, t] of [['d', x => x], ['g', C.miroir]]) for (const piece of ['gant', 'paume', 'garde', 'poignet', 'sangle', 'dos']) forme('main-' + piece + '-' + cote, t(MAIN[piece === 'gant' ? 'prise' : piece]));
  forme('main-gant-d-ouvert', MAIN_OUVERT.prise);                  // cockpit-3 : doigts ouverts pendant le trajet au pommeau
  // Treize états préparés, avec moins de subdivisions longitudinales hors prise :
  // transitions plus fines sans calcul de maillage ni allocation en course.
  const ETAPES_MAIN = 12, PRISES_MAIN = ['main-gant-d'], PRISES_GAUCHE = ['main-gant-g'];
  for (let n = 1; n <= ETAPES_MAIN; n++) {
    const gant = n === ETAPES_MAIN ? MAIN_OUVERT.prise : B.main.construire(n / ETAPES_MAIN).prise;
    const droite = n === ETAPES_MAIN ? 'main-gant-d-ouvert' : 'main-gant-d-prise-' + n, gauche = 'main-gant-g-prise-' + n;
    if (n < ETAPES_MAIN) forme(droite, gant);
    forme(gauche, C.miroir(gant)); PRISES_MAIN.push(droite); PRISES_GAUCHE.push(gauche);
  }
  // Les trois gestes partent exactement de la main ouverte. Partager ce même
  // maillage conserve leurs treize états et évite six copies CPU/GPU inutiles.
  const GESTES_MAIN = {};
  for (const geste of ['majeur', 'poing', 'salut']) GESTES_MAIN[geste] = {
    d: [PRISES_MAIN[ETAPES_MAIN]], g: [PRISES_GAUCHE[ETAPES_MAIN]]
  };
  for (const geste of ['majeur', 'poing', 'salut']) for (let n = 1; n <= ETAPES_MAIN; n++) {
    const gant = B.main.construire(1, { geste, progression: n / ETAPES_MAIN }).prise;
    for (const cote of ['d', 'g']) {
      const nom = 'main-geste-' + geste + '-' + cote + '-' + n;
      forme(nom, cote === 'd' ? gant : C.miroir(gant)); GESTES_MAIN[geste][cote].push(nom);
    }
  }
  const FORMES_EXPRESSIONS = [...new Set([...PRISES_MAIN, ...PRISES_GAUCHE, ...Object.values(GESTES_MAIN).flatMap(g => [...g.d, ...g.g])])];
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
    const e = etatRendu(mod), M = actualiserPose(e.pose, ev);
    if (ev.pilote) preparerPiloteExterieur(e.pilote, ev.pilote);
    poserTable(tableDe(e, mod, etat.casse ? EPAVE : CORPS, 3), M, ev, sortie, etat.roues, false,
      etat.rouesDetail === undefined ? 0 : Math.max(0, Math.min(3, etat.rouesDetail | 0)), ev.pilote ? e.pilote.tete : null, !!mod.sansPilote);
    const H = e.habitacle || (e.habitacle = construireHabitacle(mod));
    const articule = true;
    H.sansPilote = !!mod.sansPilote;
    if (H.piloteReel !== articule) { H.piloteReel = articule; H.pret = false; }
    habitacle(H, M, ev, sortie, etat);
    poserPiloteExterieur(e.pilote, 10, M, ev, sortie, false, !!mod.sansPilote);
    return imbriquee(e.M3, M);
  }

  // ---------------------------------------------------------------- habitacle de la vue cockpit
  // Repères du volant : plan incliné face au pilote (WU vers le haut de la jante, WN vers le pilote), rotation phi ;
  // repère de la planche : PU vers son haut, PN vers le pilote.
  const TAU = VOLANT.inclinaison, CV = VOLANT.centre, RV = VOLANT.rayon, E_VOLANT = RV / .105, PRISE = VOLANT.prise;
  const WN = [-Math.cos(TAU), Math.sin(TAU), 0], WU = [Math.sin(TAU), Math.cos(TAU), 0], WR = [0, 0, 1];
  const PN = [-Math.cos(PENTE_PLANCHE), Math.sin(PENTE_PLANCHE), 0], PU = [Math.sin(PENTE_PLANCHE), Math.cos(PENTE_PLANCHE), 0];
  const BRANCHES = CV.map((v, k) => v + WN[k] * -.004);
  const PIED = [LEVIER[0], LEVIER[1] - .14, LEVIER[2] + .012], ECHELLE = RV / B.main.JANTE.R, PIECES_MAIN = ['gant', 'paume', 'garde', 'poignet', 'sangle', 'dos'];
  const PIVOT_MAIN = MAIN.points.poignet.map((v, i) => (v - MAIN.points.axe[i] * .088) * ECHELLE);
  // La manchette part 4 mm plus bas sur l'axe du poignet : son bord glisse sous le gant au lieu de
  // laisser un jour au raccord, dans les deux vues et aux trois niveaux de détail.
  const VERS_A = MAIN.points.poignet.map((v, i) => v + MAIN.points.axe[i] * .008), VERS_B = MAIN.points.poignet.map((v, i) => v + MAIN.points.axe[i] * .03);
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
      piloteReel: false, sansPilote: false, articulations: new Float64Array(18), instrumentsPrets: false, instrumentsCle: new Float64Array(4) };
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
    // mettre : dessin converti dans le repère métrique commun ; dans : pièce déjà définie en mètres
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
    L.push(posee('planche', PLANCHE, cadre, MAT, [.025, .026, .029]));
    for (const a of [-.152, .152]) for (const b of [-.052, .008]) L.push(mettre('cylinder', sur(a, b, .0095), [.006, .004, .006], METAL_MAT, [.22, .22, .23], rond));
    L.push(posee('casquette', PLANCHE, cadre, MAT, NOIR));
    L.push(mettre('cylinder', sur(-.148, .016, .015), [.025, .008, .025], MAT, NOIR, rond));
    L.push(H.lampe = mettre('sphere', sur(-.148, .016, .021), [.018, .018, .018], 5, LAMPE_ETEINTE, null));
    L.push(mettre('box', sur(-.133, -.039, .0085), [.004, .033, .026], LAQUE, [.012, .012, .014], plat));
    L.push(mettre('box', sur(.120, -.039, .0085), [.004, .030, .068], LAQUE, [.012, .012, .014], plat));
    // cadrans : lunette, fond, graduations, aiguille (place et repère recalculés), cache central
    const cadran = (a, b, d, nom) => {
      L.push(posee('lunette-' + nom, sur(a, b, 0), rond, METAL_MAT, ARGENT));
      L.push(mettre(FORMES['fond-cadran'].nom, sur(a, b, .009), [d, .006, d], MAT, [.02, .02, .022], rond));
      // Fond à .012. Les graduations sont serties dedans et font saillie jusqu'à .0137.
      return sur(a, b, .0127);
    };
    const aiguille = (centre, rayon, long, large, emissive) => { const e = mettre('box', null, [long, .002, large], 5, [1, .40, .08], libre(), emissive); e.centre = centre; e.rayon = rayon; H.aiguilles.push(e); L.push(e); };
    const tours = cadran(0, .050, .095, 'compte-tours');
    for (let g = 0; g <= 13; g++) {
      const long = g % 2 ? .006 : .010, rouge = g >= 12;
      L.push(trait(tours, -2.36 + 4.72 * g / 13, .044 - long / 2, long, .0028, rouge ? 5 : TISSU, rouge ? [1, .1, .05] : IVOIRE, rouge ? .5 : undefined));
    }
    aiguille(plus(tours, [PN, .0045]), .014, .037, .0036, .9);
    L.push(mettre('cylinder', plus(tours, [PN, .0045]), [.016, .009, .016], METAL_MAT, ARGENT, rond));
    for (const a of [-.089, .089]) {
      const centre = cadran(a, .005, .055, 'auxiliaire');
      for (let g = 0; g < 5; g++) L.push(trait(centre, -1.2 + .6 * g, .0155, .005, .0022, TISSU, IVOIRE));
      aiguille(plus(centre, [PN, .0045]), .008, .017, .0026, .7);
      L.push(mettre('cylinder', plus(centre, [PN, .004]), [.008, .008, .008], METAL_MAT, ARGENT, rond));
    }
    for (const a of [-.046, -.034]) L.push(mettre('cylinder', sur(a, -.043, .011), [.010, .006, .010], METAL_MAT, ARGENT, rond), mettre('box', sur(a, -.039, .019), [.003, .011, .003], METAL_MAT, ARGENT, cadre));
    const voyant = (a, b, couleur, force) => { L.push(mettre('cylinder', sur(a, b, .012), [.0125, .005, .0125], METAL_MAT, [.32, .32, .34], rond)); const e = mettre('sphere', sur(a, b, .016), [.009, .009, .009], 5, couleur, null, force); L.push(e); return e; };
    voyant(.032, -.043, [.14, .9, .3], 1.1);                 // contact : toujours allumé
    H.alerte = voyant(.050, -.043, TEMOIN_ETEINT, undefined);
    // Afficheurs à sept segments : rapport (et sa diagonale pour R), trois chiffres de vitesse
    const barrette = (centre, x, y, dx, dy, longueur, largeur, mat, couleur, emission) => {
      const axe = WR.map((v,k) => v*dx + PU[k]*dy);
      return mettre(FORMES['segment-led'].nom, plus(centre,[WR,x],[PU,y],[PN,.0123]),
        [longueur,largeur,.004], mat,couleur,[axe,croix(PN,axe),PN],emission);
    };
    const chiffre = (centre, h) => {
      const l = h * .56, t = h * .13;
      const horizontale = y => barrette(centre,0,y,1,0,l-1.15*t,t,MAT,ETEINT);
      const verticale = (x,y) => barrette(centre,x,y,0,1,h/2-1.15*t,t,MAT,ETEINT);
      return [horizontale(h/2), verticale(l/2,h/4), verticale(l/2,-h/4), horizontale(-h/2),
        verticale(-l/2,-h/4), verticale(-l/2,h/4), horizontale(0)];
    };
    {
      const centre = plus(PLANCHE, [WR, -.133], [PU, -.039]), h = .025, l = h * .56, t = h * .13;
      H.rapport = chiffre(centre, h);
      // La patte du R a son propre logement, entre la traverse médiane et les LED du coin droit.
      const ax=-.55*t, ay=-.8*t, bx=l/2-t, by=-h/2+.85*t;
      const dx=bx-ax, dy=by-ay, long=Math.hypot(dx,dy);
      H.diagonale = barrette(centre,(ax+bx)/2,(ay+by)/2,dx/long,dy/long,long,.7*t,5,AMBRE,1.1);
    }
    for (let k = 0; k < 3; k++) H.vitesse.push(chiffre(plus(PLANCHE, [WR, .100 + k * .020], [PU, -.039]), .020));
    // Volant, levier et mains : places et repères posés par majVolant
    const V = H.volant;
    H.rJante = libre(); H.rCaches = [];
    V.push(H.jante = mettre(FORMES.jante.nom, null, FORMES.jante.taille, TISSU, [.045, .045, .05], H.rJante));
    V.push(H.branches = mettre(FORMES.branches.nom, null, FORMES.branches.taille, METAL_MAT, [.025, .025, .028], H.rJante));
    const coussin = FORMES['moyeu-capitonne'];
    H.moyeu.push(mettre(coussin.nom, plus(CV, [WN, coussin.centre[1]]), coussin.taille, TISSU, NOIR, H.rJante));
    // Écusson central course or/jaune + 2 boutons poussoirs (rouge boost / jaune radio) tournant avec le volant.
    const faceCoussin = coussin.centre[1] + coussin.taille[1]/2;
    H.moyeu.push(mettre('bevel', plus(CV, [WN, faceCoussin+.0015]), [.022, .005, .017], LAQUE, [.94, .74, .09], H.rJante));
    H.moyeu.push(mettre('cylinder', plus(CV, [WR, -.072], [WN, .012]), [.010, .008, .010], LAQUE, [.86, .11, .09], H.rJante));
    H.moyeu.push(mettre('cylinder', plus(CV, [WR, .072], [WN, .012]), [.010, .008, .010], LAQUE, [.94, .74, .09], H.rJante));
    V.push(...H.moyeu);
    // L'arbre suit l'axe du moyeu jusqu'à la vraie face de la planche ; le palier et les attaches sont fixes
    // et gardent leurs dimensions métriques dans les deux vues.
    const profondeurColonne = ((CV[0] - PLANCHE[0]) * PN[0] + (CV[1] - PLANCHE[1]) * PN[1]) / (WN[0] * PN[0] + WN[1] * PN[1]);
    const fondColonne = plus(CV, [WN, -profondeurColonne]), axeFixe = [WU, WN, WR];
    H.supportVolant.push(mettre('cylinder', plus(CV, [WN, -.5 * profondeurColonne]), [.029, profondeurColonne + .010, .029], METAL_MAT, ACIER, axeFixe));
    H.supportVolant.push(mettre('cylinder', plus(fondColonne, [WN, .012]), [.055, .034, .055], MAT, [.065, .065, .07], axeFixe));
    H.supportVolant.push(mettre('box', plus(fondColonne, [PN, -.004]), [.084, .028, .018], MAT, [.055, .055, .06], cadre));
    // Deux montants descendent de la planche dans la cuve. Leur place physique est partagée par les trois vues.
    for (const k of [-1, 1]) {
      const haut = sur(k * .14, -.036, -.008), bas = [1.19, fondCuve(1.19, .126) - .004, k * .126].map((v, i) => (v - ORIGINE_HABITACLE[i]) / K);
      const axe = haut.map((v, i) => v - bas[i]), centre = haut.map((v, i) => (v + bas[i]) * .5);
      H.supportVolant.push(mettre('cylinder', centre, [.026, Math.hypot(...axe) + .008, .026], MAT, [.045, .045, .05], selonAxe(axe)));
    }
    const TUBE = .0225 * E_VOLANT;
    // Repère central jaune racing à 12h pour sentir l'angle du volant d'un coup d'œil.
    V.push(H.ruban = mettre('cylinder', null, [TUBE + .0016, .012, TUBE + .0016], TISSU, [.95, .76, .08], libre()));
    V.push(H.tige = mettre('cylinder', null, [.011, 0, .011], METAL_MAT, ARGENT, libre()));
    V.push(H.pommeau = mettre('sphere', null, [.040, .040, .040], METAL_MAT, [.80, .81, .83], null));
    // gant de la couleur de la voiture (sombre si elle est très claire), paume de cuir, garde, élastique, sangle
    const combi = liv.combinaison || c1.map(v => v * .7), gant = clarte(c1) > .62 ? [.13, .13, .15] : c1, cuir = [.055, .05, .048];
    const couleurs = [gant, cuir, gant.map(v => v * .8), [.06, .06, .065], gant.map(v => v * .92), gant];
    const variante = nom => { const fo = FORMES[nom]; return { nom: fo.nom, c: fo.centre.map(v => v * ECHELLE), s: reduite(fo.taille.map(v => v * ECHELLE)) }; };
    H.mains = [-1, 1].map(k => {
      const cote = k > 0 ? 'd' : 'g', rep = libre(), repPaume = libre(), main = { k, rep, repPaume, prise: trois(), originePaume: trois(), pieces: [], tubes: [], boules: [], coude: Float64Array.of(COUDE[0], COUDE[1], k * COUDE[2]) };
      PIECES_MAIN.forEach((nom, q) => {
        const ferme = variante('main-' + nom + '-' + cote), e = emplacement(ferme.nom, ferme.s, TISSU, couleurs[q], ['paume', 'poignet', 'sangle', 'dos'].includes(nom) ? repPaume : rep, undefined);
        e.ferme = ferme; e.ouvert = k > 0 && nom === 'gant' ? variante('main-gant-d-ouvert') : ferme;
        e.prises = nom === 'gant' ? (k > 0 ? PRISES_MAIN : PRISES_GAUCHE).map(variante) : null;
        e.gestes = nom === 'gant' ? [null, GESTES_MAIN.majeur[cote].map(variante), GESTES_MAIN.poing[cote].map(variante), GESTES_MAIN.salut[cote].map(variante)] : null;
        e.pilote = true; main.pieces.push(e); V.push(e);
      });
      const c = main.pieces[3].ferme.c;
      main.longueurPaume = K * Math.hypot(c[0] - PIVOT_MAIN[0], c[1] - PIVOT_MAIN[1], c[2] - k * PIVOT_MAIN[2]);
      // Éminence du pouce : son extrémité reste dans la prise, sa racine suit
      // la paume. Cette pièce ferme le raccord pendant la rotation du poignet.
      const pouce = emplacement('sphere', trois(), TISSU, gant, libre());
      pouce.pilote = true; pouce.raccordPouce = true; main.pieces.push(pouce); V.push(pouce);
      for (let n = 1; n <= 6; n++) {
        // Profil anatomique de la manche, fixé à la construction (aucun calcul par pose) : manchette
        // ajustée au poignet, galbe plein de l'avant-bras, renflement d'olécrâne au coude. Le diamètre
        // maximal au coude reste celui de la base (.073) pour conserver tous les dégagements mesurés.
        const f = n / 6, d = (.046 + .018 * Math.sin(f * Math.PI * .55) + .009 * f * f * f * f * f * f) * ECHELLE,
          tube = mettre('cylinder', null, [d, 0, d], TISSU, combi, libre()), boule = mettre('sphere', null, [d, d, d], TISSU, combi, null);
        tube.pilote = boule.pilote = true;
        main.tubes.push(tube); main.boules.push(boule); V.push(tube, boule);
      }
      return main;
    });
    // Rétroviseurs : boîtier et patte fixes, glace vive, ou fond (ciel, horizon, piste) et cinq places de voitures
    const GL = RETRO.l, GH = RETRO.h, fb = FORMES['retro-boitier'];
    for (const k of [-1, 1]) {
      const g = cadreGlace(k), { c, n: nr, w, u, m } = g;
      const vers = (dx, dy, dz) => plus(c, [nr, -dx], [u, dy], [w, dz]);
      // Support aérodynamique incliné reliant le dessous du boîtier surélevé au flanc avant de la cellule.
      const attache = vers(.035, -GH * .45, -k * .042), pied = C.pointSection(C.profil(S_GOUTTE)(c[0] - .03), .46);
      pied[2] = k * (pied[2] - .006);
      const axe = pied.map((v, i) => v - attache[i]);
      const G = { k, c, n: nr, w, u, suiveurs: [],
        boitier: dans(fb.nom, plus(c, [m[0], fb.centre[0]], [m[1], fb.centre[1]], [m[2], fb.centre[2]]), fb.taille, PEINTURE, c1, m),
        patte: dans('cylinder', attache.map((v, i) => (v + pied[i]) / 2), [.016, Math.hypot(axe[0], axe[1], axe[2]), .016], MAT, CARBONE, selonAxe(axe)),
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

  // Pilote extérieur : copies de rendu de l'habitacle métrique commun, sans transformation propre à cette vue.
  // ev.pilote ajoute regard (rad, +droite), geste, gesteCote (-1 gauche), gestePhase et gesteIntensite.
  // Cet objet permanent est fourni par jeu.js. L'animation
  // est une fonction de cette pose : ni horloge cachée, ni avancement par caméra, ni écriture dans la simulation.
  // Sans ce champ, la même voiture reste statique pour les outils employant l'ancienne API de pose.
  const PILOTE_COU = [.486, .714, 0], PILOTE_TETE_ORIGINE = [.517, -.034, 0];
  const PILOTE_EPAULES = [.548, .670, .170];
  // Le thorax est construit directement dans le siège 126 CK. La tête source reste verticale pour regarder
  // la piste ; cette translation unique place le cou sous le casque et les yeux dans le vrai visage.
  // La pose statique, la pose animée, le cockpit et les LOD utilisent ces mêmes ancrages métriques.
  function originePilote(o, tete) { return tete ? o.map((v, i) => v + PILOTE_TETE_ORIGINE[i]) : o.slice(); }
  // Le levier commun est sous la jante et en avant du trajet de l'avant-bras droit : les rapports pairs
  // ne ramènent pas le pommeau sous la manche quand la main retrouve le volant abaissé.
  // La cible de la main suit ce même ancrage physique ; le gant garde sa forme et sa prise.
  const PILOTE_LEVIER = [.93, .55, .16];
  const PILOTE_LEVIER_DECALAGE = PILOTE_LEVIER.map((v, i) => v - ORIGINE_HABITACLE[i] - K * LEVIER[i]);
  // La tige descend du pommeau au pivot près du siège et au vrai fond de cuve.
  const PILOTE_PIED_LEVIER = [PILOTE_LEVIER[0], .32, PILOTE_LEVIER[2] + .0108];
  const FOND_CONSOLE = fondCuve(PILOTE_PIED_LEVIER[0], PILOTE_PIED_LEVIER[2]) - .004;
  // Le pied est fixé à une petite console arrondie, elle-même ancrée dans le fond de la cuve. Son sommet
  // reçoit les deux derniers millimètres de la tige ; le reste du débattement est libre dans l'habitacle.
  forme('console-levier-pilote', C.carene([
    { x: PILOTE_PIED_LEVIER[0] - .06, y0: FOND_CONSOLE, y1: PILOTE_PIED_LEVIER[1] - .012, l: .012, n: 3, z: PILOTE_PIED_LEVIER[2] },
    { x: PILOTE_PIED_LEVIER[0] - .025, y0: FOND_CONSOLE, y1: PILOTE_PIED_LEVIER[1] + .002, l: .030, n: 4, z: PILOTE_PIED_LEVIER[2] },
    { x: PILOTE_PIED_LEVIER[0] + .025, y0: FOND_CONSOLE, y1: PILOTE_PIED_LEVIER[1] + .002, l: .030, n: 4, z: PILOTE_PIED_LEVIER[2] },
    { x: PILOTE_PIED_LEVIER[0] + .06, y0: FOND_CONSOLE, y1: PILOTE_PIED_LEVIER[1] - .012, l: .012, n: 3, z: PILOTE_PIED_LEVIER[2] }
  ], { cotes: 16, pas: 3 }));

  function construirePiloteExterieur(mod, H) {
    const liv = mod.livree, combi = liv.combinaison || liv.couleur.map(v => v * .7);
    const tissuPilote = B.cockpitMatieres ? B.cockpitMatieres.tissu : TISSU;
    const R = { habitacle: H, tete: new Float64Array(9), articulations: H.articulations, variantes: [], cockpit: null };
    // Une réserve par LOD/overlay et par rétroviseur : aucune place, rotation ou taille ne passe d'une vue à l'autre.
    for (let variante = 0; variante < 11; variante++) {
      const li = variante < 8 ? variante >> 1 : (variante === 8 || variante === 10) ? CORPS : EPAVE;
      const niveau = li === SIMPLES ? 2 : li === MOYENS ? 1 : 0, overlay = variante === 10 || (variante < 8 && !!(variante & 1));
      const V = { niveau, rotM: trois(), pieces: [], epoque: 0 };
      const rotations = new Map();
      const objet = (shape, mat, color) => {
        const o = { shape, p: trois(), s: trois(), r: trois(), mat, color, surface: 'object' };
        if (overlay) o.overlay = true;
        return o;
      };
      const ajouter = (role, source, simple) => {
        const o = objet(simple || source.objet.shape, source.objet.mat, source.objet.color);
        // Comme dans l'habitacle, les segments de la planche, le volant et chaque gant
        // partagent leur repère. La rotation monde reste propre à cette variante.
        let rotation = null;
        if (source.rep) {
          rotation = rotations.get(source.rep);
          if (!rotation) { rotation = { r: o.r, epoque: -1 }; rotations.set(source.rep, rotation); }
          o.r = rotation.r;
        } else o.r = V.rotM;
        V.pieces.push({ role, source, simple, objet: o, rotation });
      };
      ajouter('volant', H.jante, niveau === 2 ? 'cylinder' : null);
      if (niveau < 2) ajouter('branches', H.branches, null);
      for (let i = 0; i < H.moyeu.length; i++) ajouter('moyeu-' + i, H.moyeu[i], null);
      for (let i = 0; i < H.planche.length; i++) {
        if (niveau > 0 && i !== 0 && i !== 5) continue;
        ajouter(i === 0 ? 'planche' : i === 5 ? 'casquette' : 'planche-' + i, H.planche[i], null);
      }
      if (niveau === 0) {
        for (let i = 0; i < H.rapport.length; i++) ajouter('rapport-' + i, H.rapport[i], null);
        ajouter('rapport-diagonale', H.diagonale, null);
        for (let k = 0; k < H.vitesse.length; k++) for (let i = 0; i < H.vitesse[k].length; i++)
          ajouter('vitesse-' + k + '-' + i, H.vitesse[k][i], null);
        for (let i = 0; i < H.caches.length; i++) ajouter('cache-volant-' + i, H.caches[i], null);
        for (let i = 0; i < H.vis.length; i++) ajouter('vis-volant-' + i, H.vis[i], null);
        ajouter('ruban-volant', H.ruban, null);
      }
      for (let i = 0; i < H.supportVolant.length; i++) ajouter('support-volant-' + i, H.supportVolant[i], null);
      ajouter('levier', H.tige, null); ajouter('pommeau', H.pommeau, null);
      for (let k = 0; k < H.glaces.length; k++) {
        const G = H.glaces[k];
        ajouter('retro-boitier-' + k, G.boitier, null);
        ajouter('retro-patte-' + k, G.patte, null);
        ajouter('retro-glace-' + k, G.vive, null);
      }
      {
        const f = FORMES['console-levier-pilote'], o = objet(f.nom, MAT, [.035, .035, .04]);
        o.s[0] = f.taille[0]; o.s[1] = f.taille[1]; o.s[2] = f.taille[2]; o.r = V.rotM;
        V.pieces.push({ role: 'console-levier', fixe: f.centre, objet: o });
      }
      if (niveau > 0) {
        const f = FORMES[niveau === 1 ? 'pilote-buste-moyen' : 'pilote-buste-simple'], o = objet(f.nom, tissuPilote, combi);
        o.s[0] = f.taille[0]; o.s[1] = f.taille[1]; o.s[2] = f.taille[2]; o.r = V.rotM;
        V.pieces.push({ role: 'buste', fixe: originePilote(f.centre, false), objet: o });
      }
      for (let h = 0; h < 2; h++) {
        const main = H.mains[h], j = h * 9;
        {
          // Raccord local du thorax à l'humérus : diamètre 50 mm, contenu dans la zone d'attache de 35 mm.
          // Léger amincissement : la rotule s'efface sous l'épaulette du thorax au lieu de la border.
          const o = objet('sphere', tissuPilote, combi); o.s[0] = o.s[1] = o.s[2] = .050; o.r = V.rotM;
          V.pieces.push({ role: 'epaule-' + h, joint: j, objet: o });
        }
        for (let q = 0; q < main.pieces.length; q++) if (niveau === 0 || q === 0 || q === 5 || q === 6)
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
        // Renflement d'olécrâne : +2 mm sur la rotule de coude, dans les dégagements mesurés vers la cuve.
        const o = objet('sphere', tissuPilote, combi); o.s[0] = o.s[1] = o.s[2] = .077; o.r = V.rotM;
        V.pieces.push({ role: 'coude-' + h, joint: j + 3, objet: o });
      }
      for (const p of V.pieces) p.corporel = p.role === 'buste' || p.de !== undefined || p.joint !== undefined || !!p.source?.pilote;
      if (variante === 10) {
        // Épaules, bras supérieurs, coudes et console sont aussi visibles depuis le siège ; buffers distincts.
        V.pieces = V.pieces.filter(p => !p.source && (p.de !== undefined || p.joint !== undefined || p.role === 'console-levier'));
        R.cockpit = V;
      } else R.variantes.push(V);
    }
    return R;
  }

  function preparerPiloteExterieur(R, etat) {
    const H = R.habitacle, cle = H.cle;
    actualiserInstruments(H, etat);
    if (!H.piloteReel) { H.piloteReel = true; H.pret = false; }
    let volant = Number.isFinite(etat.volant) ? etat.volant : 0;
    volant = volant < -1 ? -1 : volant > 1 ? 1 : volant;
    // Garder la phase dans le tampon numérique : réunir ici une propriété optionnelle et un
    // nombre à virgule créait un HeapNumber par pose sous V8, même après la chauffe.
    if (Number.isFinite(etat.passageVisuel)) CLE[1] = etat.passageVisuel;
    else if (Number.isFinite(etat.passage)) CLE[1] = etat.passage;
    else CLE[1] = 1;
    let t = CLE[1];
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

  function articulationPilote(H, h, prise = false) {
    const A = H.articulations, j = h * 9, cote = h === 0 ? -1 : 1;
    // Os constants de 27 et 29 cm, raccordés aux épaules du thorax assis. Le poignet est celui du gant
    // réellement posé sur la commande ; le coude est construit sur le cercle exact de l'IK à deux segments.
    const main = H.mains[h], poignet = prise ? main.prise : main.pieces[3].o, haut = .27, avant = .29 + (prise ? main.longueurPaume : 0);
    A[j] = PILOTE_EPAULES[0]; A[j + 1] = PILOTE_EPAULES[1]; A[j + 2] = cote * PILOTE_EPAULES[2];
    for (let k = 0; k < 3; k++) A[j + 6 + k] = poignet[k];
    const dx = A[j + 6] - A[j], dy = A[j + 7] - A[j + 1], dz = A[j + 8] - A[j + 2];
    const distance = Math.max(1e-9, Math.sqrt(dx * dx + dy * dy + dz * dz)), ux = dx / distance, uy = dy / distance, uz = dz / distance;
    const avance = (haut * haut - avant * avant + distance * distance) / (2 * distance);
    // Le pôle guide les gestes vers l'avant et le bas ; le passage au levier réduit l'écartement.
    // À la conduite, la cible latérale du coude laisse la place au thorax et à la paroi. Sa projection
    // sur le cercle épaule/poignet conserve les deux longueurs, puis se raccorde continûment au geste.
    const geste = H.cle[6] && H.cle[7] === cote ? portionGeste(H.cle[8], .44, .85) : 0;
    const passageLevier = h === 1 ? Math.max(0, Math.min(1, (PILOTE_LEVIER[0] + .09 - A[j + 6]) / .08)) * Math.max(0, Math.min(1, (PILOTE_LEVIER[1] + .18 - A[j + 7]) / .10)) : 0;
    const sansGeste = .30 * (1 - passageLevier);
    const poleGeste = -.60 + .25 * Math.max(0, Math.min(1, (.190 - Math.abs(A[j + 8])) / .030));
    const lateral = cote * (sansGeste + (poleGeste - sansGeste) * geste);
    const produit = .40 * ux - uy + lateral * uz;
    let bx = .40 - ux * produit, by = -1 - uy * produit, bz = lateral - uz * produit;
    // La main haute ramène le coude vers l'intérieur assez tôt pour garder toute la manche sous le jonc.
    const levee = Math.max(0, Math.min(1, (A[j + 7] - .75) / .08));
    const z = cote * (.190 + .015 * passageLevier - .075 * levee * levee * (3 - 2 * levee));
    // Cercle d'intersection des deux longueurs : sa projection latérale est bornée avant
    // de choisir la solution basse, sans basculer sur un autre pôle si la cible z est hors d'atteinte.
    const rayonCercle = Math.sqrt(Math.max(0, haut * haut - avance * avance));
    const projectionZ = Math.sqrt(Math.max(0, 1 - uz * uz));
    if (rayonCercle > 1e-9 && projectionZ > 1e-9) {
      // Approche douce de l'extrême latéral : la dérivée reste continue au raccord et la tangence
      // est évitée. Le coude suit toujours le cercle des deux os, sans saut quand la cible sature.
      const cibleCos = (z - A[j + 2] - uz * avance) / (rayonCercle * projectionZ), moduleCos = Math.abs(cibleCos);
      const excesCos = Math.max(0, moduleCos - .85);
      const cos = moduleCos <= .85 ? cibleCos : (cibleCos < 0 ? -1 : 1) * (.85 + .10 * excesCos / (.10 + excesCos));
      const sin = Math.sqrt(Math.max(0, 1 - cos * cos)), signe = ux >= 0 ? 1 : -1;
      const px = (-ux * uz * cos + uy * sin * signe) / projectionZ;
      const py = (-uy * uz * cos - ux * sin * signe) / projectionZ, pz = projectionZ * cos;
      const nb = Math.sqrt(bx * bx + by * by + bz * bz);
      if (nb > 1e-9) {
        bx = (1 - geste) * px + geste * bx / nb;
        by = (1 - geste) * py + geste * by / nb;
        bz = (1 - geste) * pz + geste * bz / nb;
      }
    }
    let norme = Math.sqrt(bx * bx + by * by + bz * bz);
    if (norme < 1e-9) { bx = -uz; by = 0; bz = ux; norme = Math.sqrt(bx * bx + bz * bz); }
    if (norme < 1e-9) { bx = 1; by = 0; bz = 0; norme = 1; }
    const rayon = rayonCercle / norme;
    A[j + 3] = A[j] + ux * avance + bx * rayon;
    A[j + 4] = A[j + 1] + uy * avance + by * rayon;
    A[j + 5] = A[j + 2] + uz * avance + bz * rayon;
    const co = H.mains[h].coude;
    for (let k = 0; k < 3; k++) co[k] = (A[j + 3 + k] - ORIGINE_HABITACLE[k]) / K;
  }

  function poserPiloteExterieur(R, variante, M, ev, sortie, retro, sansPilote = false) {
    const V = variante === 10 ? R.cockpit : R.variantes[variante], A = R.articulations;
    const px = ev.p[0], py = ev.p[1], pz = ev.p[2], ca = retro ? Math.cos(ev.cap) : 0, sa = retro ? Math.sin(ev.cap) : 0;
    V.epoque++;
    anglesDans(V.rotM, M);
    for (let i = 0; i < V.pieces.length; i++) {
      const e = V.pieces[i], objet = e.objet, p = objet.p;
      if (sansPilote && e.corporel) continue;
      let x, y, z;
      if (e.source) {
        const source = e.source, local = source.o;
        if (source.visible === false) continue;
        x = local[0]; y = local[1]; z = local[2];
      } else if (e.de !== undefined) {
        const a = e.de, b = e.a;
        x = (A[a] + A[b]) * .5; y = (A[a + 1] + A[b + 1]) * .5; z = (A[a + 2] + A[b + 2]) * .5;
      } else if (e.joint !== undefined) {
        const j = e.joint; x = A[j]; y = A[j + 1]; z = A[j + 2];
      } else { x = e.fixe[0]; y = e.fixe[1]; z = e.fixe[2]; }
      const X = px + (M[0] * x + M[3] * y + M[6] * z), Y = py + (M[1] * x + M[4] * y + M[7] * z), Z = pz + (M[2] * x + M[5] * y + M[8] * z);
      if (retro) {
        const dx = X - px, dz = Z - pz, xc = dx * ca + dz * sa, zc = dz * ca - dx * sa;
        if (!(Math.abs(xc - X_ARRIERE) < .5 && Math.abs(zc) > .55)) continue;
      }
      // Même filtre en coordonnées monde ; les rotations et copies ne servent qu'aux pièces retenues.
      if (e.source) {
        const source = e.source, taille = source.objet.s;
        objet.mat = source.objet.mat; objet.color = source.objet.color; objet.emissive = source.objet.emissive;
        objet.shape = e.simple || source.objet.shape;
        objet.s[0] = taille[0]; objet.s[1] = taille[1]; objet.s[2] = taille[2];
        const rotation = e.rotation;
        if (rotation && rotation.epoque !== V.epoque) {
          anglesPiloteProduit(rotation.r, M, source.rep.m); rotation.epoque = V.epoque;
        }
      } else if (e.de !== undefined) {
        const a = e.de, b = e.a;
        AXE[0] = A[b] - A[a]; AXE[1] = A[b + 1] - A[a + 1]; AXE[2] = A[b + 2] - A[a + 2];
        hypotDans(AXE, 3); objet.s[1] = AXE[3]; selonAxeDans(e.m, AXE); anglesProduit(objet.r, M, e.m);
      }
      p[0] = X; p[1] = Y; p[2] = Z;
      sortie.push(objet);
    }
  }

  // ---- calculs de chaque pose, sans objet neuf : mêmes opérations, dans le même ordre, que euler, mul, mulM, angles et
  // selonAxe, pour les mêmes nombres au bit près.
  // Les nombres y passent d'une fonction à l'autre par des Float64Array : un nombre à virgule passé à une fonction, ou
  // rendu par elle, que le compilateur ne développe pas en ligne serait emballé dans un objet neuf à chaque appel.
  // Coordonnées de construction → mètres dans la voiture. Cette opération ne dépend jamais de la caméra.
  function versVoiture(o) { o[0] = ORIGINE_HABITACLE[0] + K * o[0]; o[1] = ORIGINE_HABITACLE[1] + K * o[1]; o[2] = ORIGINE_HABITACLE[2] + K * o[2]; }
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
    const c = G.c, n = G.n, w = G.w, u = G.u, a = -o[0], dy = o[1], dz = o[2];
    o[0] = ((c[0] + n[0] * a) + u[0] * dy) + w[0] * dz; o[1] = ((c[1] + n[1] * a) + u[1] * dy) + w[1] * dz; o[2] = ((c[2] + n[2] * a) + u[2] * dy) + w[2] * dz;
  }
  function teinte(e, src, f) { // fond d'une glace : couleur du jour assombrie, dans le tableau de la pièce
    if (src.length === 3) { const c = e.couleur; c[0] = src[0] * f; c[1] = src[1] * f; c[2] = src[2] * f; e.objet.color = c; }
    else e.objet.color = src.map(v => v * f);   // couleur d'une autre longueur que trois : tableau neuf de sa longueur
  }
  // Pose d'une pièce de l'habitacle : place dans le monde (P : ev.p), rotation de son repère (une fois par pose et par repère)
  function placer(H, e, M, P, sortie) {
    if (e.visible === false) return;
    const o = e.o, p = e.objet.p, x = o[0], y = o[1], z = o[2], rep = e.rep;
    p[0] = P[0] + (M[0] * x + M[3] * y + M[6] * z); p[1] = P[1] + (M[1] * x + M[4] * y + M[7] * z); p[2] = P[2] + (M[2] * x + M[5] * y + M[8] * z);
    if (rep !== null && rep.epoque !== H.epoque) { if (H.piloteReel) anglesPiloteProduit(rep.r, M, rep.m); else anglesProduit(rep.r, M, rep.m); rep.epoque = H.epoque; }
    sortie.push(e.objet);
  }
  function placerTout(H, liste, M, P, sortie) { for (let i = 0; i < liste.length; i++) if (!(H.sansPilote && liste[i].pilote)) placer(H, liste[i], M, P, sortie); }

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
    if (H.moyeu.length >= 4) {
      const bg = H.moyeu[2].o, bd = H.moyeu[3].o;
      for (let k = 0; k < 3; k++) { bg[k] = CV[k] - RD[k] * .072 + WN[k] * .012; bd[k] = CV[k] + RD[k] * .072 + WN[k] * .012; }
      versVoiture(bg); versVoiture(bd);
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
        const mouvement = H.piloteReel ? retrait : ecart, dehors = H.piloteReel ? radial : ecart, degagement = H.piloteReel ? .025 : .016, reculPrise = H.piloteReel ? .080 : .016;
        // Le recul supplémentaire contourne aussi le pommeau par le haut :
        // garder sa hauteur initiale ferait passer la manchette sur la boule.
        const leveePrise = H.piloteReel ? .032 : 0;
        gx = gx + EX[0] * degagement * dehors + (WN[0] * reculPrise + WU[0] * leveePrise) * mouvement;
        gy = gy + EX[1] * degagement * dehors + (WN[1] * reculPrise + WU[1] * leveePrise) * mouvement;
        gz = gz + EX[2] * degagement * dehors + (WN[2] * reculPrise + WU[2] * leveePrise) * mouvement;
        // Point de contrôle surélevé du Bézier : la main contourne le pommeau avant de s'y poser.
        // Le cadrage isolé garde sa courbe historique ; le pilote commun porte cette courbe au poignet.
        // Quand la prise droite est sous le moyeu, contourner la jante par l'arrière au retour du levier.
        // Les doigts ouverts gardent leur longueur : dans le braquage qui place
        // la main droite en bas, leur retour contourne la jante côté pilote.
        const reculTrajet = H.piloteReel ? .125 * Math.max(0, sp) : 0, hauteurTrajet = H.piloteReel ? .23 : .15;
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
        const soX = cibleX + WU[0] * hauteurTrajet + WN[0] * reculTrajet, soY = cibleY + WU[1] * hauteurTrajet + WN[1] * reculTrajet;
        // Au neutre, le poignet rentre de 13,5 mm au milieu du trajet pour passer à l'intérieur du jonc.
        // Cette rentrée s'efface quand la prise tourne vers le bas de la jante, dont il faut rester écarté.
        // Les deux extrémités (prise de jante et paume sur le pommeau) restent inchangées.
        const soZ = cibleZ + WU[2] * hauteurTrajet + WN[2] * reculTrajet - (H.piloteReel ? .030 * cp * cp : 0);
        gx = gx * (1 - vl) ** 2 + soX * 2 * vl * (1 - vl) + cibleX * vl ** 2; gy = gy * (1 - vl) ** 2 + soY * 2 * vl * (1 - vl) + cibleY * vl ** 2; gz = gz * (1 - vl) ** 2 + soZ * 2 * vl * (1 - vl) + cibleZ * vl ** 2;
        // cockpit-4 : le repère de départ porte déjà −phi ; sans le +phi, la paume restait tournée du braquage au
        // pommeau (91,5° du bas volant à fond)
        // La main se dégage avant de pivoter et retrouve l'angle de la jante avant de s'en rapprocher.
        // Le pivot attend que les doigts de longueur conservée aient dépassé
        // la jante ; au retour il s'achève avant leur rapprochement du volant.
        let a = H.piloteReel ? (t - .28) / (.44 - .28) : t / .10; a = a < 0 ? 0 : a > 1 ? 1 : a;
        let b = H.piloteReel ? (t - .64) / (.76 - .64) : (t - .86) / (1 - .86); b = b < 0 ? 0 : b > 1 ? 1 : b;
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
        const releve = portionGeste(intensite, .36, .54);
        ecart = portionGeste(intensite, 0, .16);
        // Depuis la jante abaissée et avancée, dégager le poignet vers le haut et vers le pilote
        // avant le geste latéral ; la manche franchit le jonc avec la même portée physique des os.
        gx += EX[0] * .020 * dehors + (WN[0] * .105 + WU[0] * .045) * recul - .050 / K * releve;
        gy += EX[1] * .020 * dehors + (WN[1] * .105 + WU[1] * .045) * recul + .080 / K * releve;
        gz += EX[2] * .020 * dehors + (WN[2] * .105 + WU[2] * .045) * recul;
        const poignet = main.pieces[3].ferme.c;
        let wx = gx + F[0] * poignet[0] + F[3] * poignet[1] + F[6] * poignet[2];
        let wy = gy + F[1] * poignet[0] + F[4] * poignet[1] + F[7] * poignet[2];
        let wz = gz + F[2] * poignet[0] + F[5] * poignet[1] + F[8] * poignet[2];
        // La main haute est déjà devant la visière : son dégagement ne recule jamais la manchette dans le casque.
        wx = Math.max(wx, (.780 - ORIGINE_HABITACLE[0]) / K);
        // Poignet à côté du casque, au-dessus du jonc. Une seule main quitte le volant, l'autre garde sa prise.
        // Le salut oscille légèrement, le poing se lève de 8 mm : les modulations s'annulent avec le geste.
        const onde = Math.sin(cle[9] * Math.PI * 6) * mouvement;
        const cibleX = (.760 - ORIGINE_HABITACLE[0]) / K;
        const cibleY = (.930 + (cle[6] === 2 ? .008 * onde : 0) - ORIGINE_HABITACLE[1]) / K;
        const cibleZ = (k * (.240 + (cle[6] === 3 ? .010 * onde : 0)) - ORIGINE_HABITACLE[2]) / K;
        const contour = 4 * mouvement * (1 - mouvement);
        // Au braquage, la main basse passe derrière celle restée sur le haut de la jante.
        // Le détour cesse avant la pose haute, pour conserver la garde devant le casque.
        const croisement = Math.max(0, k * phi / VOLANT.course) * (1 - portionGeste(mouvement, .45, .65));
        wx += (cibleX - wx) * mouvement - (.015 + .040 * croisement) / K * contour;
        wy += (cibleY - wy) * mouvement;
        wz += (cibleZ - wz) * mouvement;
        // Annuler le braquage avant de redresser la main : matrices orthonormales et poignet fixe sous les doigts.
        ANGLE[0] = phi * mouvement; tournerColonnes(F, WN, ANGLE);
        AXE[0] = 0; AXE[1] = 0; AXE[2] = 1; ANGLE[0] = (Math.PI / 2 + TAU) * mouvement; tournerColonnes(F, AXE, ANGLE);
        AXE[0] = 1; AXE[1] = 0; AXE[2] = 0; ANGLE[0] = -k * Math.atan2(B.main.AXE[2], B.main.AXE[0]) * mouvement; tournerColonnes(F, AXE, ANGLE);
        AXE[0] = 0; AXE[1] = 1; AXE[2] = 0; ANGLE[0] = k * (.42 + (cle[6] === 3 ? .09 * onde : 0)) * mouvement; tournerColonnes(F, AXE, ANGLE);
        gx = wx - F[0] * poignet[0] - F[3] * poignet[1] - F[6] * poignet[2];
        gy = wy - F[1] * poignet[0] - F[4] * poignet[1] - F[7] * poignet[2];
        gz = wz - F[2] * poignet[0] - F[5] * poignet[1] - F[8] * poignet[2];
        if (intensite >= .48) doigtsGeste = Math.min(ETAPES_MAIN, Math.floor(portionGeste(intensite, .48, 1) * ETAPES_MAIN + 1e-8));
      }
      // Le contact des doigts ne tourne pas avec le poignet. L'IK vise d'abord
      // les jointures avec la longueur avant-bras + paume, puis aligne la paume
      // et sa manchette sur cette chaîne. Le relâchement rejoint continûment la
      // prise libre du levier ou du geste, qui conserve son trajet propre.
      const FP = main.repPaume.m, GP = main.originePaume;
      for (let i = 0; i < 9; i++) FP[i] = F[i];
      GP[0] = gx; GP[1] = gy; GP[2] = gz;
      const naturel = H.piloteReel ? 1 - Math.max(k > 0 ? ouverture : 0,
        cle[6] && k === cle[7] ? portionGeste(cle[8], 0, .16) : 0) : 0;
      if (naturel > 0) {
        const lx = PIVOT_MAIN[0], ly = PIVOT_MAIN[1], lz = k * PIVOT_MAIN[2];
        // La base des doigts reste devant le dos de la main : cette réserve
        // évite que le bord de la paume inclinée entre dans le tube du volant.
        const reculPaume = .018 * naturel / K;
        const px = gx + F[0] * (lx + reculPaume) + F[3] * ly + F[6] * lz,
          py = gy + F[1] * (lx + reculPaume) + F[4] * ly + F[7] * lz,
          pz = gz + F[2] * (lx + reculPaume) + F[5] * ly + F[8] * lz;
        main.prise[0] = px; main.prise[1] = py; main.prise[2] = pz; versVoiture(main.prise);
        articulationPilote(H, h, true);
        const c = main.pieces[3].ferme.c, dx = c[0] - lx, dy = c[1] - ly, dz = c[2] - lz,
          a0 = F[0] * dx + F[3] * dy + F[6] * dz,
          a1 = F[1] * dx + F[4] * dy + F[7] * dz,
          a2 = F[2] * dx + F[5] * dy + F[8] * dz,
          b0 = co[0] - px, b1 = co[1] - py, b2 = co[2] - pz;
        AXE[0] = a1 * b2 - a2 * b1; AXE[1] = a2 * b0 - a0 * b2; AXE[2] = a0 * b1 - a1 * b0; hypotDans(AXE, 3);
        const sinus = AXE[3];
        if (sinus > 1e-12) {
          AXE[0] /= sinus; AXE[1] /= sinus; AXE[2] /= sinus;
          ANGLE[0] = naturel * Math.atan2(sinus, a0 * b0 + a1 * b1 + a2 * b2);
          tournerColonnes(FP, AXE, ANGLE);
          GP[0] = px - FP[0] * lx - FP[3] * ly - FP[6] * lz;
          GP[1] = py - FP[1] * lx - FP[4] * ly - FP[7] * lz;
          GP[2] = pz - FP[2] * lx - FP[5] * ly - FP[8] * lz;
        }
        if (k > 0) {
          // Le poignet se remet dans l'axe après avoir quitté le pommeau. Son
          // enveloppe suit ce dégagement, commun aux vues, jusqu'à la jante.
          const wx = ORIGINE_HABITACLE[0] + K * (GP[0] + FP[0] * c[0] + FP[3] * c[1] + FP[6] * c[2]),
            wy = ORIGINE_HABITACLE[1] + K * (GP[1] + FP[1] * c[0] + FP[4] * c[1] + FP[7] * c[2]),
            wz = ORIGINE_HABITACLE[2] + K * (GP[2] + FP[2] * c[0] + FP[5] * c[1] + FP[8] * c[2]);
          // Enveloppe de toute la grille : la prise retrouvée sur le volant
          // reste identique quel que soit le rapport finalement engagé.
          const dx = wx - Math.max(PILOTE_LEVIER[0] - .024 * K, Math.min(PILOTE_LEVIER[0] + .024 * K, wx)),
            dy = wy - PILOTE_LEVIER[1],
            dz = wz - Math.max(PILOTE_LEVIER[2] - .017 * K, Math.min(PILOTE_LEVIER[2] + .017 * K, wz)),
            distance = Math.sqrt(dx * dx + dy * dy + dz * dz),
            garde = .033 * ECHELLE * K + H.pommeau.objet.s[0] / 2 + .001;
          if (distance > 1e-9 && distance < garde) {
            const d = (garde - distance) / (distance * K);
            GP[0] += dx * d; GP[1] += dy * d; GP[2] += dz * d;
          }
        }
      }
      for (let q = 0; q < main.pieces.length; q++) {
        const e = main.pieces[q]; if (e.raccordPouce) continue;
        const fo = doigtsGeste >= 0 && e.gestes ? e.gestes[cle[6]][doigtsGeste]
          : H.piloteReel && e.prises ? e.prises[Math.min(ETAPES_MAIN, Math.floor(ecart * ETAPES_MAIN + 1e-8))] : ecart >= .25 ? e.ouvert : e.ferme, c = fo.c, o = e.objet, p = e.o;
        const P = e.rep === main.repPaume ? GP : null, M = e.rep.m;
        p[0] = (((P ? P[0] : gx) + M[0] * c[0]) + M[3] * c[1]) + M[6] * c[2]; p[1] = (((P ? P[1] : gy) + M[1] * c[0]) + M[4] * c[1]) + M[7] * c[2]; p[2] = (((P ? P[2] : gz) + M[2] * c[0]) + M[5] * c[1]) + M[8] * c[2]; versVoiture(p);
        if (o.shape !== fo.nom) { o.shape = fo.nom; o.s = fo.s; }
      }
      {
        const e = main.pieces[6], rayon = .014 * ECHELLE;
        GC[0] = gx; GC[1] = gy; GC[2] = gz;
        localDans(BOUT, F, GC, MAIN.points.pouce[0], k);
        localDans(ICI, FP, GP, MAIN.points.pouce[0], k);
        e.o[0] = (BOUT[0] + ICI[0]) / 2; e.o[1] = (BOUT[1] + ICI[1]) / 2; e.o[2] = (BOUT[2] + ICI[2]) / 2; versVoiture(e.o);
        AXE[0] = ICI[0] - BOUT[0]; AXE[1] = ICI[1] - BOUT[1]; AXE[2] = ICI[2] - BOUT[2]; hypotDans(AXE, 3);
        e.objet.s[0] = e.objet.s[2] = 2 * rayon * K; e.objet.s[1] = (AXE[3] + 2 * rayon) * K;
        if (AXE[3] < 1e-9) { AXE[0] = 0; AXE[1] = 1; AXE[2] = 0; }
        selonAxeDans(e.rep.m, AXE);
      }
      if (H.piloteReel) articulationPilote(H, h);
      else { co[0] = COUDE[0]; co[1] = COUDE[1]; co[2] = k * COUDE[2]; }
      // Manche commune aux deux vues : du même poignet au même coude, plié dans la cuve.
      GC[0] = GP[0]; GC[1] = GP[1]; GC[2] = GP[2];
      localDans(BOUT, FP, GC, VERS_A, k); localDans(ICI, FP, GC, VERS_B, k);
      AXE[0] = ICI[0] - BOUT[0]; AXE[1] = ICI[1] - BOUT[1]; AXE[2] = ICI[2] - BOUT[2]; hypotDans(AXE, 3);
      const l = AXE[3] || 1, f8 = .08 * ECHELLE, d0 = AXE[0] / l, d1 = AXE[1] / l, d2 = AXE[2] / l;
      const creuxManche = -.019 * (1 - naturel);
      for (let i = 0; i < 3; i++) {
        P2[i] = BOUT[i] + (i === 0 ? d0 : i === 1 ? d1 : d2) * f8;
        P1[i] = (co[i] + (BOUT[i] - co[i]) * .48) + (i === 1 ? creuxManche : 0);
        AV[i] = BOUT[i];
      }
      const rPom = H.pommeau.objet.s[0] * .5;
      if (H.piloteReel && k > 0) {
        // Dégager la courbe de la manche droite par le haut et l'intérieur de toute la grille du levier.
        const gardeCtrl = main.tubes[3].objet.s[0] * .5 + rPom + .020;
        for (let pass = 0; pass < 2; pass++) {
          const C = pass === 0 ? P2 : P1;
          const wx = ORIGINE_HABITACLE[0] + K * C[0], wy = ORIGINE_HABITACLE[1] + K * C[1], wz = ORIGINE_HABITACLE[2] + K * C[2];
          const lx = Math.max(PILOTE_LEVIER[0] - .030 * K, Math.min(PILOTE_LEVIER[0] + .030 * K, wx));
          const lz = Math.max(PILOTE_LEVIER[2] - .022 * K, Math.min(PILOTE_LEVIER[2] + .022 * K, wz));
          const dx = wx - lx, dy = wy - PILOTE_LEVIER[1], dz = wz - lz;
          if (Math.sqrt(dx * dx + Math.max(0, dy) ** 2 + dz * dz) < gardeCtrl) {
            const ey = Math.max(0, wy - (PILOTE_LEVIER[1] - .045)), ez = Math.min(0, wz - (PILOTE_LEVIER[2] + .035));
            const ex = dx * .25, norm = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
            const ux = ex / norm, uy = ey / norm, uz = ez / norm;
            let lo = 0, hi = gardeCtrl + .07;
            for (let it = 0; it < 12; it++) {
              const mid = (lo + hi) * .5, tx = wx + ux * mid, ty = wy + uy * mid, tz = wz + uz * mid;
              const tlx = Math.max(PILOTE_LEVIER[0] - .030 * K, Math.min(PILOTE_LEVIER[0] + .030 * K, tx));
              const tlz = Math.max(PILOTE_LEVIER[2] - .022 * K, Math.min(PILOTE_LEVIER[2] + .022 * K, tz));
              if (Math.sqrt((tx - tlx) ** 2 + Math.max(0, ty - PILOTE_LEVIER[1]) ** 2 + (tz - tlz) ** 2) < gardeCtrl) lo = mid; else hi = mid;
            }
            C[0] += ux * hi / K; C[1] += uy * hi / K; C[2] += uz * hi / K;
          }
        }
      }
      for (let n = 1; n <= 6; n++) {
        const f = n / 6, tube = main.tubes[n - 1], o = tube.o, ob = main.boules[n - 1].o;
        for (let i = 0; i < 3; i++) ICI[i] = (1 - f) ** 3 * BOUT[i] + 3 * (1 - f) ** 2 * f * P2[i] + 3 * (1 - f) * f * f * P1[i] + f ** 3 * co[i];
        if (H.piloteReel && k > 0 && n < 6) {
          const wx = ORIGINE_HABITACLE[0] + K * ICI[0], wy = ORIGINE_HABITACLE[1] + K * ICI[1], wz = ORIGINE_HABITACLE[2] + K * ICI[2];
          const lx = Math.max(PILOTE_LEVIER[0] - .024 * K, Math.min(PILOTE_LEVIER[0] + .024 * K, wx));
          const lz = Math.max(PILOTE_LEVIER[2] - .017 * K, Math.min(PILOTE_LEVIER[2] + .017 * K, wz));
          const dx = wx - lx, dy = wy - PILOTE_LEVIER[1], dz = wz - lz;
          const garde = main.tubes[n].objet.s[0] * .5 + rPom + .007;
          if (Math.sqrt(dx * dx + Math.max(0, dy) ** 2 + dz * dz) < garde) {
            const ey = Math.max(0, wy - (PILOTE_LEVIER[1] - .045)), ez = Math.min(0, wz - (PILOTE_LEVIER[2] + .035));
            const ex = dx * .25, norm = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
            const ux = ex / norm, uy = ey / norm, uz = ez / norm;
            let lo = 0, hi = garde + .06;
            for (let it = 0; it < 12; it++) {
              const mid = (lo + hi) * .5, tx = wx + ux * mid, ty = wy + uy * mid, tz = wz + uz * mid;
              const tlx = Math.max(PILOTE_LEVIER[0] - .024 * K, Math.min(PILOTE_LEVIER[0] + .024 * K, tx));
              const tlz = Math.max(PILOTE_LEVIER[2] - .017 * K, Math.min(PILOTE_LEVIER[2] + .017 * K, tz));
              if (Math.sqrt((tx - tlx) ** 2 + Math.max(0, ty - PILOTE_LEVIER[1]) ** 2 + (tz - tlz) ** 2) < garde) lo = mid; else hi = mid;
            }
            ICI[0] += ux * hi / K; ICI[1] += uy * hi / K; ICI[2] += uz * hi / K;
          }
        }
        o[0] = (AV[0] + ICI[0]) / 2; o[1] = (AV[1] + ICI[1]) / 2; o[2] = (AV[2] + ICI[2]) / 2; versVoiture(o);
        AXE[0] = ICI[0] - AV[0]; AXE[1] = ICI[1] - AV[1]; AXE[2] = ICI[2] - AV[2]; hypotDans(AXE, 3);
        tube.objet.s[1] = AXE[3] * K;
        selonAxeDans(tube.rep.m, AXE);
        ob[0] = ICI[0]; ob[1] = ICI[1]; ob[2] = ICI[2]; versVoiture(ob);
        AV[0] = ICI[0]; AV[1] = ICI[1]; AV[2] = ICI[2];
      }
    }
  }

  function actualiserInstruments(H, etat) {
    const ralenti = B.conduite?.PARAMS.ralenti ?? 4000, regime = Number.isFinite(etat.regime) ? etat.regime : ralenti;
    const r = etat.rapport, kmh = Math.min(999, Math.max(0, Math.round(etat.kmh || 0))), cle = H.instrumentsCle;
    // La vue cockpit relit la même planche après la pose du pilote ; les glaces la relisent aussi.
    // Le cache ne garde que ses entrées, sans pose monde ni valeur propre à une caméra.
    if (H.instrumentsPrets && Object.is(cle[0], regime) && Object.is(cle[1], r) && Object.is(cle[2], kmh) && Object.is(cle[3], ralenti)) return;
    H.instrumentsPrets = typeof r === 'number';
    if (H.instrumentsPrets) { cle[0] = regime; cle[1] = r; cle[2] = kmh; cle[3] = ralenti; }
    // Planche : lampe de régime ; compte-tours (graduations ivoire tous les 1 000 tr/min, zone rouge dès 12 000,
    // aiguille orange) ; température d'eau à gauche, pression d'huile à droite (elle suit le régime) ; témoin vert du
    // contact, témoin rouge (ralenti ou surrégime ; voi-8 : jamais sous le ralenti de conduite.js, seuil pris dans PARAMS)
    allumer(H.lampe.objet, regime > REGIME_LAMPE && etat.rapport > 0 && etat.rapport < 6, LAMPE_ALLUMEE, LAMPE_ETEINTE, 3.2);
    allumer(H.alerte.objet, regime > 12600 || regime < ralenti + 300, ALERTE, TEMOIN_ETEINT, 1.8);
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
    // Rapport à gauche, vitesse à droite, en segments ambre
    afficher(H.rapport, masqueRapport(r));
    H.diagonale.visible = r < 0;
    for (let k = 0; k < 3; k++) {
      const diviseur = k === 0 ? 100 : k === 1 ? 10 : 1, visible = k === 2 || kmh >= diviseur;
      const groupe = H.vitesse[k];
      afficher(groupe, MASQUE_CHIFFRE[Math.floor(kmh / diviseur) % 10]);
      for (let n = 0; n < groupe.length; n++) groupe[n].visible = visible;
    }
  }

  function habitacle(H, M, ev, sortie, etat) {
    const P = ev.p;
    H.epoque++;
    anglesDans(H.rotM, M);
    actualiserInstruments(H, etat);
    placerTout(H, H.planche, M, P, sortie);
    placerTout(H, H.rapport, M, P, sortie);
    placer(H, H.diagonale, M, P, sortie);
    for (let k = 0; k < 3; k++) placerTout(H, H.vitesse[k], M, P, sortie);
    // Volant, levier et mains : recalculés seulement quand braquage, passage ou rapports changent
    let x = etat.volant || 0; x = x < -1 ? -1 : x > 1 ? 1 : x;
    const expression = ev.pilote || etat;
    let t = 1;
    if (H.piloteReel && Number.isFinite(expression.passageVisuel)) t = +expression.passageVisuel;
    else if (etat.passage !== undefined) t = +etat.passage;
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
      placer(H, G.vive, M, P, sortie);
      if (etat.glaceVive) continue;
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

  B.voiture = { modele, profilImpact, pointSurNez, preparerPneusService, preparerExpressions, changerPneus, poser, poserRetro, cockpit, fantome, objetsFantome, detailPour, detailRouesPour, distanceRoues2, hypotDans, visible, attitude, angles, mul, mulM, euler, braquages, glacesCockpit, cadreGlace, RETRO, OEIL, POSTE_126CK, ORIGINE_HABITACLE, PILOTE_ASSISE, PILOTE_EPAULES, K, VOLANT, PLANCHE, PENTE_PLANCHE, COUDE, LEVIER, ROUES, EMPATTEMENT, FORMES, SEGMENTS_ROUE, ROUES_FORMES, JANTES_FORMES, ARRIERE_126CK };
})(globalThis.BITUME = globalThis.BITUME || {});
