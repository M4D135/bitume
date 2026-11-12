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

  const ROUE_AXE = euler(Math.PI / 2, 0, 0);       // cylindre couché : son axe suit z (la droite de la voiture)
  const VERS_AVANT = euler(0, 0, -Math.PI / 2);    // cylindre dont l'axe suit x

  // ---------------------------------------------------------------- cotes de la 312 T5
  // Empattement 2,70 m, voies 1,70 m à l'avant et 1,615 m à l'arrière, longueur 4,53 m, largeur 2,12 m, hauteur 1,02 m.
  const EMPATTEMENT = 2.70, DEMI_VOIE_AV = .85, DEMI_VOIE_AR = .8075, JANTE_R = .165; // jantes de 13 pouces
  const ROUES = [
    { x: 1.35, z: -DEMI_VOIE_AV, r: .29, l: .28, avant: true }, { x: 1.35, z: DEMI_VOIE_AV, r: .29, l: .28, avant: true },
    { x: -1.35, z: -DEMI_VOIE_AR, r: .335, l: .46, avant: false }, { x: -1.35, z: DEMI_VOIE_AR, r: .335, l: .46, avant: false }
  ];

  const LAQUE = 16, PEINTURE = 17, MAT = 7, METAL_MAT = 0, TISSU = 18;
  const PNEU = [.035, .035, .04], FOND_JANTE = [.11, .11, .12], JANTE = [.72, .73, .74], NOIR = [.03, .03, .035],
    CARBONE = [.06, .065, .07], ARGENT = [.76, .77, .79], BLANC = [.95, .94, .9], GANT = [.9, .9, .87];

  // Braquage d'Ackermann : la roue intérieure au virage braque plus que l'extérieure. d > 0 : virage à droite.
  // Rend les angles des roues 0 (avant gauche) et 1 (avant droite).
  function braquages(d) {
    if (Math.abs(d) < 1e-5) return [d, d];
    const R = EMPATTEMENT / Math.tan(Math.abs(d));
    const interieur = Math.atan(EMPATTEMENT / (R - DEMI_VOIE_AV)), exterieur = Math.atan(EMPATTEMENT / (R + DEMI_VOIE_AV));
    return d > 0 ? [exterieur, interieur] : [-interieur, -exterieur];
  }

  // ---------------------------------------------------------------- modèle
  function piece(shape, o, s, mat, color, extra) { return Object.assign({ shape, o, s, mat, color }, extra || {}); }

  function modele(livree) {
    const c1 = livree.couleur, c2 = livree.seconde || BLANC, casque = livree.casque || c2, combi = livree.combinaison || c1.map(v => v * .7);
    const corps = [], simples = [];
    const P = (shape, o, s, mat, color, extra) => { const p = piece(shape, o, s, mat, color, extra); corps.push(p); return p; };
    const AR = extra => Object.assign({ arriere: true }, extra); // derrière l'œil du cockpit : pas dessiné dans cette vue
    const pilote = { pilote: true };

    // Nez : deux demi-coques effilées de 5,3° (0,62 m de large au cockpit, 0,32 m à la pointe), caisson bas et pente
    // de 13° qui descend de 0,62 m au cockpit à 0,24 m à la pointe.
    const fleche = Math.atan2(.15, 1.62);
    for (const k of [-1, 1]) {
      const m = euler(0, k * fleche, 0), z = k * .0757;
      P('box', [1.345, .16, z], [1.63, .16, .32], PEINTURE, c1, { m });
      P('wedge', [1.345, .43, z], [1.63, .38, .32], PEINTURE, c1, { m });
    }
    // Aileron avant argent de 1,62 m, bord de fuite relevé, et ses deux dérives
    P('box', [2.11, .13, 0], [.38, .025, 1.62], LAQUE, ARGENT, { m: euler(0, 0, -.08) });
    for (const k of [-1, 1]) P('box', [2.11, .17, k * .81], [.38, .19, .02], LAQUE, ARGENT);
    // Capot avant mince au-dessus des jambes, qui remonte de 0,62 à 0,66 m jusqu'au saute-vent teinté incliné de 42°,
    // et cloison noire du fond du baquet
    const dehors = { exterieur: true }; // remplacé en vue cockpit par un capot plus bas (voir cockpit)
    P('box', [.44, .60, 0], [.28, .04, .64], PEINTURE, c1, dehors);
    P('wedge', [.44, .64, 0], [.28, .04, .64], PEINTURE, c1, dehors);
    P('box', [.335, .69, 0], [.01, .075, .44], METAL_MAT, [.45, .62, .78], { m: euler(0, 0, .733), fx: true, alpha: .16, exterieur: true });
    P('box', [.51, .34, 0], [.02, .52, .60], MAT, NOIR);
    // Habitacle creux : flancs rouges doublés de sombre, boudin rembourré, plancher et dossier
    for (const k of [-1, 1]) {
      P('box', [.16, .34, k * .28], [.84, .52, .14], PEINTURE, c1);
      P('box', [.16, .34, k * .2045], [.84, .48, .01], MAT, c1.map(v => v * .3));
      P('cylinder', [.16, .604, k * .214], [.024, .84, .024], MAT, CARBONE, { m: VERS_AVANT });
    }
    P('box', [.13, .11, 0], [.78, .06, .42], MAT, NOIR);
    P('box', [-.22, .40, 0], [.06, .50, .44], MAT, NOIR, AR());
    // Pontons : longs caissons plats de 0,72 m de demi-largeur, long bord d'attaque en pente, bande blanche en bas et
    // panneau blanc du numéro à l'arrière
    for (const k of [-1, 1]) {
      P('bevel', [-.25, .28, k * .53], [1.50, .44, .38], PEINTURE, c1);
      P('wedge', [.75, .28, k * .53], [.50, .44, .38], PEINTURE, c1);
      P('box', [-.045, .105, k * .531], [1.87, .09, .392], PEINTURE, c2);
      P('box', [-.80, .31, k * .531], [.36, .30, .392], PEINTURE, c2, AR());
    }
    // Capot moteur large et plat, de 0,86 m derrière l'arceau à 0,50 m au-dessus de la boîte ; arceau argent
    P('box', [-.925, .29, 0], [1.35, .42, .68], PEINTURE, c1, AR());
    P('wedge', [-.925, .68, 0], [1.35, .36, .64], PEINTURE, c1, AR({ m: euler(0, Math.PI, 0) }));
    P('ring', [-.24, .80, 0], [.42, .42, .42], METAL_MAT, ARGENT, AR({ m: euler(0, 0, Math.PI / 2) }));
    // Pilote : casque, visière, épaules
    P('sphere', [0, .865, 0], [.27, .29, .27], LAQUE, casque, pilote);
    P('box', [.11, .875, 0], [.07, .07, .2], METAL_MAT, [.05, .06, .09], pilote);
    P('box', [-.04, .68, 0], [.26, .16, .40], TISSU, combi, pilote);
    // Rétroviseurs sur supports rouges, de part et d'autre de l'habitacle, glace tournée vers le pilote
    for (const k of [-1, 1]) {
      P('bevel', [.55, .565, k * .47], [.05, .05, .11], PEINTURE, c1);
      P('box', [.524, .565, k * .47], [.004, .038, .092], METAL_MAT, [.2, .23, .27]);
      P('box', [.55, .52, k * .47], [.022, .05, .022], PEINTURE, c1);
    }
    // Suspensions : triangles noirs
    for (const k of [-1, 1]) {
      P('box', [1.35, .34, k * .47], [.05, .02, .56], MAT, CARBONE);
      P('box', [1.35, .18, k * .47], [.07, .02, .56], MAT, CARBONE);
      P('box', [-1.35, .40, k * .45], [.05, .02, .32], MAT, CARBONE, AR());
      P('box', [-1.35, .22, k * .45], [.07, .02, .32], MAT, CARBONE, AR());
    }
    // Boîte, échappements du douze-cylindres à plat, aileron arrière blanc sur mât central, dérives rouges
    P('box', [-1.80, .28, 0], [.50, .28, .34], METAL_MAT, [.3, .31, .33], AR());
    for (const k of [-1, 1]) P('cylinder', [-1.85, .38, k * .22], [.09, .36, .09], METAL_MAT, [.34, .31, .28], AR({ m: VERS_AVANT }));
    P('box', [-2.02, .66, 0], [.20, .48, .05], PEINTURE, c1, AR());
    P('box', [-2.05, .90, 0], [.32, .035, 1.10], PEINTURE, c2, AR({ m: euler(0, 0, -.12) }));
    P('box', [-2.18, .95, 0], [.12, .025, 1.08], PEINTURE, c2, AR({ m: euler(0, 0, -.5) }));
    for (const k of [-1, 1]) P('box', [-2.05, .87, k * .56], [.36, .30, .02], PEINTURE, c1, AR());
    // Roues : pneu, jante sombre, six rayons qui tournent, moyeu ; les avant braquent
    ROUES.forEach((w, i) => {
      const base = { roue: i, m: ROUE_AXE, arriere: !w.avant };
      P('cylinder', [w.x, w.r, w.z], [2 * w.r, w.l, 2 * w.r], MAT, PNEU, base);
      P('cylinder', [w.x, w.r, w.z], [2 * JANTE_R, w.l + .012, 2 * JANTE_R], METAL_MAT, FOND_JANTE, base);
      for (let b = 0; b < 3; b++) P('box', [w.x, w.r, w.z], [2 * JANTE_R * .94, w.l + .02, .04], METAL_MAT, JANTE, Object.assign({ tourne: b * Math.PI / 3 }, base));
      P('cylinder', [w.x, w.r, w.z], [.09, w.l + .05, .09], METAL_MAT, JANTE, base);
    });

    // Version lointaine : onze volumes
    simples.push(
      piece('wedge', [1.35, .35, 0], [1.62, .54, .52], PEINTURE, c1),
      piece('box', [-.10, .28, 0], [1.80, .44, 1.44], PEINTURE, c1),
      piece('box', [.44, .39, 0], [.28, .62, .64], PEINTURE, c1),
      piece('wedge', [-.925, .47, 0], [1.35, .78, .66], PEINTURE, c1, { m: euler(0, Math.PI, 0) }),
      piece('box', [2.11, .13, 0], [.38, .04, 1.62], LAQUE, ARGENT),
      piece('box', [-2.05, .90, 0], [.34, .06, 1.10], PEINTURE, c2),
      piece('box', [-2.02, .66, 0], [.20, .48, .05], PEINTURE, c1),
      piece('sphere', [0, .865, 0], [.27, .29, .27], LAQUE, casque));
    for (const w of ROUES) simples.push(piece('cylinder', [w.x, w.r, w.z], [2 * w.r, w.l, 2 * w.r], MAT, PNEU, { m: ROUE_AXE }));
    return { corps, simples, livree };
  }

  // ---------------------------------------------------------------- pose dans le monde
  // ev = { p: [x, y, z] (sol sous le milieu de l'empattement), cap, tangage, roulis, braquage (rad, droite positive),
  //        roule (distance parcourue, m : fait tourner les roues) }
  // Rend la rotation d'une pièce de roue : braquage d'Ackermann à l'avant, rotation propre −distance/rayon.
  function rotationRoue(M, pc, braq, roule) {
    const w = ROUES[pc.roue];
    let m = pc.tourne === undefined ? pc.m : mulM(pc.m, euler(0, pc.tourne - roule / w.r, 0));
    if (w.avant) m = mulM(euler(0, -braq[pc.roue], 0), m);
    return mulM(M, m);
  }
  function poser(mod, ev, sortie, options = {}) {
    const M = attitude(ev.cap, ev.tangage || 0, ev.roulis || 0), rotM = angles(M), braq = braquages(ev.braquage || 0), roule = ev.roule || 0;
    const liste = options.simple ? mod.simples : mod.corps;
    for (const pc of liste) {
      if (options.cockpit && (pc.pilote || pc.arriere || pc.exterieur)) continue;
      const o = mul(M, pc.o);
      const rot = pc.roue !== undefined ? angles(rotationRoue(M, pc, braq, roule)) : pc.m ? angles(mulM(M, pc.m)) : rotM;
      const m = { shape: pc.shape, p: [ev.p[0] + o[0], ev.p[1] + o[1], ev.p[2] + o[2]], s: pc.s, r: rot, mat: pc.mat, color: pc.color, surface: 'object' };
      if (pc.fx) { m.fx = true; m.alpha = pc.alpha; }
      if (options.overlay) m.overlay = true;
      sortie.push(m);
    }
    return M;
  }

  // ---------------------------------------------------------------- cockpit
  // Œil du cockpit dans le repère de la voiture. Ce n'est pas l'œil du pilote : il est plus bas et 0,30 m plus en
  // arrière, 16 cm au-dessus des pneus avant pour les cadrer aux coins du bas, comme dans vroom-unreal 0.35. Pour la
  // même raison, le capot de l'habitacle y est plus bas que sur la voiture vue de dehors : le nez se voit au milieu.
  const OEIL = [-.30, .74, 0];
  // Volant, planche, gants et avant-bras sont composés à leur place apparente vue de l'œil (VOLANT.centre : 1 m devant,
  // 13,8° sous l'horizon), puis ramenés vers l'œil par une homothétie de rapport K. L'image ne change pas et l'ensemble
  // tient dans l'habitacle, devant le capot.
  const K = .5;
  const VOLANT = { centre: [1.0, -.245, 0], rayon: .105, inclinaison: .436, course: 1.6 };
  const PLANCHE = [1.12, -.19, 0];
  const COUDE = [.90, -.47, .16];
  // Afficheurs à sept segments : a en haut, puis b, c, d, e, f dans le sens des aiguilles d'une montre, g au milieu.
  const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', N: 'ceg', '-': 'g' };
  const AMBRE = [1, .56, .12], ETEINT = [.09, .035, .02];

  // etat = { regime (tr/min), volant (−1 à 1), rapport (0 = point mort), kmh (vitesse affichée) }
  function cockpit(mod, ev, sortie, etat) {
    const M = poser(mod, ev, sortie, { overlay: true, cockpit: true });
    const rotM = angles(M), c1 = mod.livree.couleur;
    const dans = (shape, o, s, mat, color, m, extra) => { const w = mul(M, o); sortie.push(Object.assign({ shape, p: [ev.p[0] + w[0], ev.p[1] + w[1], ev.p[2] + w[2]], s, r: m ? angles(mulM(M, m)) : rotM, mat, color, overlay: true, surface: 'object' }, extra)); };
    // Capot bas de la vue cockpit (0,58 à 0,60 m) et saute-vent, au lieu de ceux de la vue extérieure
    dans('box', [.44, .565, 0], [.28, .03, .64], PEINTURE, c1);
    dans('wedge', [.44, .59, 0], [.28, .02, .64], PEINTURE, c1);
    dans('box', [.322, .62, 0], [.008, .05, .40], METAL_MAT, [.45, .62, .78], euler(0, 0, .733), { fx: true, alpha: .12 });
    const P = v => { const w = mul(M, [OEIL[0] + K * v[0], OEIL[1] + K * v[1], OEIL[2] + K * v[2]]); return [ev.p[0] + w[0], ev.p[1] + w[1], ev.p[2] + w[2]]; };
    const mettre = (shape, v, s, mat, color, m, extra) => sortie.push(Object.assign({ shape, p: P(v), s: [s[0] * K, s[1] * K, s[2] * K], r: m ? angles(mulM(M, m)) : rotM, mat, color, overlay: true, surface: 'object' }, extra));
    const plus = (a, ...termes) => a.map((v, k) => termes.reduce((s, [d, f]) => s + d[k] * f, v));

    // Volant : plan incliné face au pilote (haut de la jante vers l'avant), rotation propre phi, 92° au plus
    const tau = VOLANT.inclinaison, phi = Math.max(-1, Math.min(1, etat.volant || 0)) * VOLANT.course;
    const wn = [-Math.cos(tau), Math.sin(tau), 0], wu = [Math.sin(tau), Math.cos(tau), 0], wr = [0, 0, 1];
    const u = wu.map((v, k) => v * Math.cos(phi) + wr[k] * Math.sin(phi)), r = wu.map((v, k) => -v * Math.sin(phi) + wr[k] * Math.cos(phi));
    const C = VOLANT.centre, R = VOLANT.rayon, jante = [u, wn, croix(u, wn)], cadre = [wr, wu, wn];

    // Planche fixée à la caisse, derrière le volant : compte-tours au centre, rapport à gauche, vitesse à droite
    mettre('box', PLANCHE, [.02, .11, .38], MAT, CARBONE, [wn.map(v => -v), wu, wr]);
    const face = plus(PLANCHE, [wn, .012]);
    mettre('cylinder', face, [.088, .006, .088], LAQUE, [.9, .89, .84], [wu, wn, wr]);
    mettre('cylinder', plus(face, [wn, .002]), [.02, .006, .02], MAT, NOIR, [wu, wn, wr]);
    for (let g = 0; g <= 13; g++) {                       // graduations tous les 1 000 tr/min, zone rouge dès 12 000
      const b = -2.36 + 4.72 * g / 13, d = plus([0, 0, 0], [wu, Math.cos(b)], [wr, Math.sin(b)]);
      mettre('box', plus(face, [d, .036], [wn, .004]), [.009, .002, .003], g >= 12 ? 5 : MAT, g >= 12 ? [1, .1, .05] : NOIR, [d, wn, croix(d, wn)], g >= 12 ? { emissive: .4 } : undefined);
    }
    const b = -2.36 + 4.72 * Math.max(0, Math.min(1, (etat.regime || 0) / 13000));
    const aiguille = plus([0, 0, 0], [wu, Math.cos(b)], [wr, Math.sin(b)]), cote = croix(aiguille, wn);
    mettre('box', plus(face, [aiguille, .017], [wn, .005]), [.034, .0025, .004], 5, [1, .16, .05], [aiguille, wn, cote], { emissive: .6 });
    const chiffre = (texte, centre, h) => {
      const l = h * .56, t = h * .13, seg = SEGMENTS[texte] || '';
      const places = { a: [0, h / 2, l, t], b: [l / 2, h / 4, t, h / 2], c: [l / 2, -h / 4, t, h / 2], d: [0, -h / 2, l, t], e: [-l / 2, -h / 4, t, h / 2], f: [-l / 2, h / 4, t, h / 2], g: [0, 0, l, t] };
      for (const nom in places) {
        const [x, y, sx, sy] = places[nom], allume = seg.includes(nom);
        mettre('box', plus(centre, [wr, x], [wu, y], [wn, .011]), [sx, sy, .002], allume ? 5 : MAT, allume ? AMBRE : ETEINT, cadre, allume ? { emissive: 1.1 } : undefined);
      }
    };
    chiffre(etat.rapport > 0 ? String(etat.rapport) : 'N', plus(PLANCHE, [wr, -.125], [wu, .006]), .036);
    const kmh = String(Math.min(999, Math.max(0, Math.round(etat.kmh || 0)))).padStart(3, ' ');
    for (let k = 0; k < 3; k++) if (kmh[k] !== ' ' || k === 2) chiffre(kmh[k], plus(PLANCHE, [wr, .118 + k * .024], [wu, .004]), .026);

    // Jante noire, trois branches métalliques, moyeu, repère blanc en haut de la jante
    const s = R / .435;
    mettre('ring', C, [s, s, s], TISSU, [.055, .055, .06], jante);
    for (const dir of [r, r.map(v => -v), u.map(v => -v)]) mettre('box', plus(C, [dir, R * .5], [wn, -.004]), [R * .96, .007, .022], METAL_MAT, [.42, .43, .45], [dir, wn, croix(dir, wn)]);
    mettre('cylinder', plus(C, [wn, .004]), [.048, .02, .048], MAT, NOIR, jante);
    mettre('box', plus(C, [u, R]), [.036, .036, .014], TISSU, [.92, .92, .9], jante);

    // Gants blancs à 9 h 15, poignets, avant-bras jusqu'aux coudes fixés à la caisse
    for (const k of [-1, 1]) {
      const prise = plus(C, [r, R * k]);
      mettre('bevel', plus(prise, [wn, .008]), [.09, .05, .07], TISSU, GANT, jante);
      const poignet = plus(prise, [wn, .03], [u, -.03], [r, k * .012]);
      mettre('sphere', poignet, [.052, .052, .052], TISSU, GANT);
      const coude = [COUDE[0], COUDE[1], k * COUDE[2]], d = coude.map((v, i) => v - poignet[i]), long = Math.hypot(d[0], d[1], d[2]);
      mettre('cylinder', poignet.map((v, i) => (v + coude[i]) / 2), [.075, long, .075], TISSU, mod.livree.combinaison || mod.livree.couleur.map(v => v * .7), selonAxe(d));
    }
    return M;
  }

  // Fantôme du meilleur tour : silhouette translucide.
  function fantome(ev, sortie) {
    const M = attitude(ev.cap, ev.tangage || 0, ev.roulis || 0), rotM = angles(M);
    const P = o => { const w = mul(M, o); return [ev.p[0] + w[0], ev.p[1] + w[1], ev.p[2] + w[2]]; };
    const bleu = [.45, .85, 1];
    for (const [forme, o, s, m] of [['wedge', [1.35, .35, 0], [1.62, .54, .52]], ['box', [-.10, .28, 0], [1.80, .44, 1.44]], ['box', [.44, .39, 0], [.28, .62, .64]],
      ['wedge', [-.925, .47, 0], [1.35, .78, .66], euler(0, Math.PI, 0)], ['box', [2.11, .13, 0], [.38, .04, 1.62]], ['box', [-2.05, .90, 0], [.34, .06, 1.10]]])
      sortie.push({ shape: forme, p: P(o), s, r: m ? angles(mulM(M, m)) : rotM, fx: true, alpha: .26, color: bleu });
    const rot = angles(mulM(M, ROUE_AXE));
    for (const w of ROUES) sortie.push({ shape: 'cylinder', p: P([w.x, w.r, w.z]), s: [2 * w.r, w.l, 2 * w.r], r: rot, fx: true, alpha: .22, color: bleu });
  }

  B.voiture = { modele, poser, cockpit, fantome, attitude, angles, mul, mulM, euler, braquages, OEIL, K, VOLANT, PLANCHE, ROUES, EMPATTEMENT };
})(globalThis.BITUME = globalThis.BITUME || {});
