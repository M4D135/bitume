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
    CARBONE = [.06, .065, .07], ARGENT = [.76, .77, .79], BLANC = [.95, .94, .9], GANT = [.9, .9, .87],
    ACIER = [.56, .57, .59], SOMBRE = [.17, .175, .19], CRAIE = [.82, .82, .78], IVOIRE = [.93, .92, .87];
  const VITESSE_FLOU = 30;   // m/s : au-delà, la rotation des roues ne se lit plus image par image

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
      P('cylinder', [.02, .602, k * .212], [.012, .56, .012], MAT, c1.map(v => v * .28), { m: VERS_AVANT });
      P('cylinder', [.16, .545, k * .295], [.11, .84, .11], PEINTURE, c1, { m: VERS_AVANT });      // arête haute arrondie du flanc
      // dessus du flanc : liseré de la seconde couleur et rangée de rivets, sous les yeux du pilote
      P('box', [.16, .6015, k * .322], [.84, .003, .018], PEINTURE, c2);
      for (let x = -.20; x < .56; x += .095) P('cylinder', [x, .601, k * .262], [.011, .004, .011], METAL_MAT, ACIER);
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
      P('bevel', [.55, .565, k * .47], [.05, .062, .152], PEINTURE, c1);
      P('box', [.524, .565, k * .47], [.004, .048, .132], METAL_MAT, [.2, .23, .27], { glace: true }); // en vue cockpit : glace vivante
      P('box', [.55, .515, k * .47], [.022, .05, .022], PEINTURE, c1);
    }
    // Suspension avant : basculeur supérieur en tôle, large à la coque et fin à la roue, triangle inférieur en tubes,
    // biellette de direction devant l'essieu. Suspension arrière : deux bras noirs.
    const tube = (a, b, d, mat, color, extra) => { const v = b.map((x, i) => x - a[i]); P('cylinder', a.map((x, i) => (x + b[i]) / 2), [d, Math.hypot(v[0], v[1], v[2]), d], mat, color, Object.assign({ m: selonAxe(v) }, extra)); };
    for (const k of [-1, 1]) {
      P('bevel', [1.35, .345, k * .355], [.115, .030, .31], METAL_MAT, ACIER);
      P('bevel', [1.35, .337, k * .60], [.062, .024, .24], METAL_MAT, ACIER);
      tube([1.50, .15, k * .20], [1.35, .17, k * .71], .022, METAL_MAT, SOMBRE);
      tube([1.20, .15, k * .20], [1.35, .17, k * .71], .022, METAL_MAT, SOMBRE);
      tube([1.47, .30, k * .21], [1.45, .30, k * .70], .016, METAL_MAT, ARGENT);
      P('box', [-1.35, .40, k * .45], [.05, .02, .32], MAT, CARBONE, AR());
      P('box', [-1.35, .22, k * .45], [.07, .02, .32], MAT, CARBONE, AR());
    }
    // Bourrelet du bord avant de l'habitacle, entrée d'air en pointe et deux rangées de rivets sur le nez
    P('cylinder', [.30, .602, 0], [.012, .43, .012], MAT, c1.map(v => v * .28), { m: ROUE_AXE });
    const pente = Math.atan2(.38, 1.63), surNez = x => .62 - (x - .53) * .38 / 1.63, e1 = [Math.cos(pente), -Math.sin(pente), 0];
    for (const k of [-1, 1]) P('wedge', [.80, surNez(.80) + .002, k * .024], [.22, .048, .004], MAT, NOIR, { m: [e1, [0, 0, k], [-k * Math.sin(pente), -k * Math.cos(pente), 0]] });
    for (let x = .68; x < 2.06; x += .135) for (const k of [-1, 1]) P('cylinder', [x, surNez(x) + .001, k * (.31 - (x - .53) / 1.63 * .15 - .028)], [.013, .004, .013], METAL_MAT, ACIER, { m: euler(0, 0, -pente) });
    // Numéro : noir sur fond blanc, sur le nez (lisible de face) et sur le panneau de chaque ponton
    if (livree.numero) {
      const texte = String(livree.numero).slice(0, 2), n = texte.length;
      const segments = (h, poser) => {
        const l = h * .52, t = h * .15, pas = l + h * .2;
        const places = { a: [0, h / 2, l + t, t], b: [l / 2, h / 4, t, h / 2 + t], c: [l / 2, -h / 4, t, h / 2 + t], d: [0, -h / 2, l + t, t], e: [-l / 2, -h / 4, t, h / 2 + t], f: [-l / 2, h / 4, t, h / 2 + t], g: [0, 0, l + t, t] };
        for (let i = 0; i < n; i++) for (const nom of SEGMENTS[texte[i]] || '') { const q = places[nom]; poser(q[0] + (i - (n - 1) / 2) * pas, q[1], q[2], q[3]); }
      };
      // nez : le haut du chiffre vers l'habitacle, sa droite vers la gauche de la voiture
      const mN = euler(0, 0, -pente), xN = 1.22, yN = surNez(xN);
      P('box', [xN, yN + .002, 0], [.30, .004, .30], PEINTURE, BLANC, { m: mN });
      segments(.20, (dx, dy, sx, sy) => P('box', [xN - e1[0] * dy, yN + .005 - e1[1] * dy, -dx], [sy, .004, sx], MAT, NOIR, { m: mN }));
      for (const k of [-1, 1]) segments(.20, (dx, dy, sx, sy) => P('box', [-.80 + k * dx, .31 + dy, k * .728], [sx, sy, .004], MAT, NOIR, AR()));
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
    // Disques de frein avant, dans la roue, côté coque. Puis les pièces qui dépendent de la vitesse, en fin de liste :
    // deux repères à la craie sur chaque flanc tant que l'œil suit la rotation, une bande plus claire au-delà.
    ROUES.forEach((w, i) => {
      const base = { roue: i, m: ROUE_AXE, arriere: !w.avant }, k = Math.sign(w.z), flanc = (JANTE_R + w.r) / 2;
      if (w.avant) P('cylinder', [w.x, w.r, w.z], [.27, .016, .27], METAL_MAT, [.40, .40, .42], Object.assign({ decale: [0, -k * (w.l / 2 + .03), 0] }, base));
      for (const cote of [-1, 1]) for (const a of [0, Math.PI]) P('box', [w.x, w.r, w.z], [.07, .004, .016], MAT, CRAIE, Object.assign({ tourne: a, decale: [flanc, cote * (w.l / 2 + .001), 0], lent: true }, base));
      P('cylinder', [w.x, w.r, w.z], [2 * flanc + .06, w.l + .006, 2 * flanc + .06], MAT, [.062, .062, .068], Object.assign({ vite: true }, base));
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
  //        roule (distance parcourue, m : fait tourner les roues), v (vitesse, m/s : repères ou flou des pneus) }
  // Rend la rotation d'une pièce de roue : braquage d'Ackermann à l'avant, rotation propre −distance/rayon.
  function rotationRoue(M, pc, braq, roule) {
    const w = ROUES[pc.roue];
    let m = pc.tourne === undefined ? pc.m : mulM(pc.m, euler(0, pc.tourne - roule / w.r, 0));
    if (w.avant) m = mulM(euler(0, -braq[pc.roue], 0), m);
    return mulM(M, m);
  }
  // Une pièce se dessine-t-elle ? En vue cockpit, ni le pilote, ni l'arrière, ni le capot et les glaces de la vue
  // extérieure ; les repères des pneus à basse vitesse seulement, leur bande floue au-delà.
  function visible(pc, cockpit, v) {
    if (cockpit && (pc.pilote || pc.arriere || pc.exterieur || pc.glace)) return false;
    return !(pc.lent && v > VITESSE_FLOU) && !(pc.vite && !(v > VITESSE_FLOU));
  }
  function poser(mod, ev, sortie, options = {}) {
    const M = attitude(ev.cap, ev.tangage || 0, ev.roulis || 0), rotM = angles(M), braq = braquages(ev.braquage || 0), roule = ev.roule || 0;
    const liste = options.simple ? mod.simples : mod.corps, v = ev.v || 0;
    for (const pc of liste) {
      if (!visible(pc, options.cockpit, v)) continue;
      let o = mul(M, pc.o), rot;
      if (pc.roue !== undefined) {
        // pièce de roue : elle tourne avec elle ; `decale` la place hors de l'axe, dans le repère de la roue
        const Rr = rotationRoue(M, pc, braq, roule);
        rot = angles(Rr);
        if (pc.decale) { const d = mul(Rr, pc.decale); o = [o[0] + d[0], o[1] + d[1], o[2] + d[2]]; }
      } else rot = pc.m ? angles(mulM(M, pc.m)) : rotM;
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
  // 16° sous l'horizon), puis ramenés vers l'œil par une homothétie de rapport K. L'image ne change pas et l'ensemble
  // tient dans l'habitacle, devant le capot.
  const K = .5;
  // Cadrage de vroom-unreal 0.35 : le volant est gros et bas, 16° sous l'horizon ; le bas de sa jante sort de l'image
  // (41,6° de champ vertical), les mains sont au premier plan et les manches quittent le champ dès le poignet.
  const VOLANT = { centre: [1.0, -.287, 0], rayon: .125, inclinaison: .436, course: 1.6, prise: 1.88 };   // prise : 108° du haut de la jante
  const PLANCHE = [1.12, -.21, 0];
  const COUDE = [.83, -.66, .15];
  const LEVIER = [.93, -.315, .262];           // pommeau du levier de vitesses, à droite du volant, au point mort
  const REGIME_LAMPE = 12000;                  // la lampe de la casquette s'allume : il est temps de monter un rapport
  // Afficheurs à sept segments : a en haut, puis b, c, d, e, f dans le sens des aiguilles d'une montre, g au milieu.
  const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', N: 'ceg', '-': 'g' };
  const AMBRE = [1, .56, .12], ETEINT = [.09, .035, .02];
  const borner = (x, a, b) => x < a ? a : x > b ? b : x, lisse = (a, b, x) => { const t = borner((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const clarte = c => .3 * c[0] + .59 * c[1] + .11 * c[2], ecart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Position du pommeau selon le rapport, grille en H : impairs vers l'avant, pairs vers l'arrière ; 1-2 à gauche.
  const grille = n => n > 0 ? [(n % 2 ? 1 : -1) * .024, (Math.floor((n - 1) / 2) - 1) * .017] : [0, 0];

  // etat = { regime (tr/min), volant (−1 à 1), rapport (0 = point mort), kmh (vitesse affichée),
  //          passage (0 à 1 : avancement du changement de rapport en cours, 1 ou absent : aucun), rapportAvant,
  //          derriere ([{ x, z, couleur }] : rivaux dans le repère de la voiture, du plus proche au plus loin),
  //          ciel, brume (couleurs du jour, pour les glaces des rétroviseurs) }
  function cockpit(mod, ev, sortie, etat) {
    const M = poser(mod, ev, sortie, { overlay: true, cockpit: true });
    const rotM = angles(M), liv = mod.livree, c1 = liv.couleur, c2 = liv.seconde || BLANC;
    const pousser = (shape, p, s, m, mat, color, extra) => sortie.push(Object.assign({ shape, p, s, r: m ? angles(mulM(M, m)) : rotM, mat, color, overlay: true, surface: 'object' }, extra));
    const monde = o => { const w = mul(M, o); return [ev.p[0] + w[0], ev.p[1] + w[1], ev.p[2] + w[2]]; };
    // dans : pièce à sa vraie place dans la voiture ; mettre : pièce composée vue de l'œil, ramenée vers lui
    const dans = (shape, o, s, mat, color, m, extra) => pousser(shape, monde(o), s, m, mat, color, extra);
    const mettre = (shape, v, s, mat, color, m, extra) => pousser(shape, monde([OEIL[0] + K * v[0], OEIL[1] + K * v[1], OEIL[2] + K * v[2]]), [s[0] * K, s[1] * K, s[2] * K], m, mat, color, extra);
    const plus = (a, ...termes) => a.map((v, k) => termes.reduce((s, [d, f]) => s + d[k] * f, v));

    // Capot bas et bombé de la vue cockpit (0,58 à 0,61 m) et saute-vent teinté à l'arête claire, au lieu de ceux de la vue extérieure
    dans('box', [.44, .565, 0], [.28, .03, .64], PEINTURE, c1);
    dans('sphere', [.60, .50, 0], [.74, .225, .60], PEINTURE, c1);                        // capot bombé devant la planche
    dans('box', [.322, .62, 0], [.008, .05, .40], METAL_MAT, [.45, .62, .78], euler(0, 0, .733), { fx: true, alpha: .12 });
    dans('box', [.3053, .6386, 0], [.004, .0025, .404], METAL_MAT, [.80, .86, .92], euler(0, 0, .733), { fx: true, alpha: .4 });

    // Repères du volant : plan incliné face au pilote (wu vers le haut de la jante, wn vers le pilote), rotation phi
    const regime = etat.regime || 0, tau = VOLANT.inclinaison, phi = borner(etat.volant || 0, -1, 1) * VOLANT.course;
    const wn = [-Math.cos(tau), Math.sin(tau), 0], wu = [Math.sin(tau), Math.cos(tau), 0], wr = [0, 0, 1];
    const u = wu.map((v, k) => v * Math.cos(phi) + wr[k] * Math.sin(phi)), r = wu.map((v, k) => -v * Math.sin(phi) + wr[k] * Math.cos(phi));
    const C = VOLANT.centre, R = VOLANT.rayon, jante = [u, wn, croix(u, wn)], cadre = [wr, wu, wn], rond = [wu, wn, wr], plat = [wn.map(v => -v), wu, wr];
    const cap = b => wu.map((v, k) => v * Math.cos(b) + wr[k] * Math.sin(b));           // direction dans le plan de la planche
    const sur = (a, b, d) => plus(PLANCHE, [wr, a], [wu, b], [wn, d]);                 // point de la planche : droite, haut, vers le pilote
    const trait = (centre, b, rayon, long, large, mat, color, extra) => { const d = cap(b); mettre('box', plus(centre, [d, rayon]), [long, .002, large], mat, color, [d, wn, croix(d, wn)], extra); };

    // Planche : tôle sombre, casquette noire et sa lampe de régime, fenêtres des afficheurs
    mettre('box', PLANCHE, [.018, .112, .384], MAT, [.075, .078, .085], plat);
    for (const a of [-.184, .184]) for (const b of [-.048, .048]) mettre('cylinder', sur(a, b, .0095), [.008, .004, .008], METAL_MAT, ARGENT, rond);   // vis des coins
    mettre('box', sur(0, .060, .028), [.074, .010, .400], MAT, NOIR, plat);
    const passe = regime > REGIME_LAMPE && etat.rapport > 0 && etat.rapport < 6;
    mettre('cylinder', sur(0, .068, .044), [.032, .008, .032], MAT, NOIR, rond);
    mettre('sphere', sur(0, .076, .046), [.024, .024, .024], 5, passe ? [1, .13, .04] : [.20, .03, .02], null, passe ? { emissive: 3.2 } : undefined);
    mettre('box', sur(-.125, .006, .0085), [.004, .054, .036], LAQUE, [.012, .012, .014], plat);
    mettre('box', sur(.142, .004, .0085), [.004, .042, .080], LAQUE, [.012, .012, .014], plat);
    // Compte-tours : lunette, cadran noir, graduations ivoire tous les 1 000 tr/min (longues aux milliers pairs),
    // zone rouge dès 12 000, aiguille orange
    const cadran = (a, b, d, fond) => { mettre('cylinder', sur(a, b, .009), [d + .010, .008, d + .010], METAL_MAT, ARGENT, rond); mettre('cylinder', sur(a, b, .012), [d, .006, d], MAT, fond, rond); return sur(a, b, .016); };
    const tours = cadran(0, 0, .089, [.02, .02, .022]);
    for (let g = 0; g <= 13; g++) {
      const long = g % 2 ? .006 : .011, rouge = g >= 12;
      trait(tours, -2.36 + 4.72 * g / 13, .041 - long / 2, long, .0028, rouge ? 5 : TISSU, rouge ? [1, .1, .05] : IVOIRE, rouge ? { emissive: .5 } : undefined);
    }
    trait(plus(tours, [wn, .002]), -2.36 + 4.72 * borner(regime / 13000, 0, 1), .014, .037, .0036, 5, [1, .40, .08], { emissive: .9 });
    mettre('cylinder', plus(tours, [wn, .003]), [.016, .006, .016], METAL_MAT, ARGENT, rond);
    // Deux petits cadrans : température d'eau à gauche, pression d'huile à droite (elle suit le régime)
    for (const [a, valeur] of [[-.074, .5 + .2 * borner(regime / 13000, 0, 1)], [.074, .12 + .78 * borner(regime / 11000, 0, 1)]]) {
      const centre = cadran(a, -.006, .040, [.02, .02, .022]);
      for (let g = 0; g < 5; g++) trait(centre, -1.2 + .6 * g, .0155, .005, .0022, TISSU, IVOIRE);
      trait(plus(centre, [wn, .0015]), -1.2 + 2.4 * valeur, .008, .017, .0026, 5, [1, .40, .08], { emissive: .7 });
      mettre('cylinder', plus(centre, [wn, .002]), [.008, .005, .008], METAL_MAT, ARGENT, rond);
    }
    // Rangée du bas : deux interrupteurs à levier, témoin vert du contact, témoin rouge (ralenti ou surrégime)
    for (const a of [-.046, -.034]) { mettre('cylinder', sur(a, -.043, .011), [.010, .006, .010], METAL_MAT, ARGENT, rond); mettre('box', sur(a, -.039, .019), [.003, .011, .003], METAL_MAT, ARGENT, cadre); }
    mettre('sphere', sur(.034, -.043, .012), [.009, .009, .009], 5, [.14, .9, .3], null, { emissive: 1.1 });
    const alerte = regime > 12600 || regime < 2500;
    mettre('sphere', sur(.046, -.043, .012), [.009, .009, .009], 5, alerte ? [1, .14, .05] : [.2, .03, .02], null, alerte ? { emissive: 1.8 } : undefined);
    // Rapport à gauche, vitesse à droite, en segments ambre
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

    // Volant : jante gainée, trois branches d'aluminium ajourées, flasque, cache et vis, ruban blanc en haut de la jante
    const e = R / .105, TUBE = .0225 * e, N_JANTE = 36, autour = a => u.map((v, k) => v * Math.cos(a) + r[k] * Math.sin(a));   // e : échelle du volant et des mains
    for (let i = 0; i < N_JANTE; i++) {
      const a = (i + .5) * 2 * Math.PI / N_JANTE, d = autour(a);
      mettre('cylinder', plus(C, [d, R]), [TUBE, 2 * Math.PI * R / N_JANTE * 1.12, TUBE], TISSU, [.045, .045, .05], selonAxe(autour(a + Math.PI / 2)));
    }
    for (const dir of [r, r.map(v => -v), u.map(v => -v)]) {
      const m = [dir, wn, croix(dir, wn)];
      mettre('box', plus(C, [dir, R * .52], [wn, -.004]), [R * .92, .006, .027 * e], METAL_MAT, ACIER, m);
      for (const f of [.40, .66]) mettre('box', plus(C, [dir, R * f], [wn, -.0005]), [R * .17, .003, .010 * e], MAT, NOIR, m);
    }
    mettre('cylinder', plus(C, [wn, .002]), [.060 * e, .012, .060 * e], METAL_MAT, ACIER, jante);
    mettre('cylinder', plus(C, [wn, .008]), [.040 * e, .012, .040 * e], MAT, NOIR, jante);
    for (let b = 0; b < 3; b++) { const a = b * 2.0944 + 1.0472, d = u.map((v, k) => v * Math.cos(a) + r[k] * Math.sin(a)); mettre('cylinder', plus(C, [d, .0245 * e], [wn, .009]), [.007 * e, .004, .007 * e], METAL_MAT, ARGENT, jante); }
    mettre('cylinder', plus(C, [u, R]), [TUBE + .003, .010, TUBE + .003], TISSU, IVOIRE, selonAxe(r));

    // Levier de vitesses à droite : tige et pommeau d'aluminium, qui passe d'une position de la grille à l'autre
    const t = borner(etat.passage === undefined ? 1 : etat.passage, 0, 1), gA = grille(etat.rapportAvant === undefined ? etat.rapport : etat.rapportAvant), gB = grille(etat.rapport), w = lisse(.25, .6, t);
    const pommeau = [LEVIER[0] + gA[0] + (gB[0] - gA[0]) * w, LEVIER[1], LEVIER[2] + gA[1] + (gB[1] - gA[1]) * w];
    const pied = [LEVIER[0], LEVIER[1] - .14, LEVIER[2] + .012], tige = pommeau.map((v, k) => v - pied[k]);
    mettre('cylinder', pied.map((v, k) => v + tige[k] * .5), [.011, Math.hypot(tige[0], tige[1], tige[2]), .011], METAL_MAT, ARGENT, selonAxe(tige));
    mettre('sphere', pommeau, [.040, .040, .040], METAL_MAT, [.80, .81, .83]);

    // Mains : gants blancs articulés, comme dans vroom-unreal, mais construits ici. Quatre doigts à trois phalanges
    // enroulés autour du tube de la jante, pouce posé le long de la jante, dos de main, garde noire sur les jointures,
    // sangle noire au poignet. Les manches suivent une courbe de Bézier du poignet au coude fixé à la caisse, avec un
    // pli au poignet. Les dimensions sont celles d'une main à l'échelle du volant (0,75).
    // Pendant un changement de rapport, la main droite va au pommeau et revient.
    const combi = liv.combinaison || c1.map(v => v * .7), cuir = [.05, .05, .055], gant = clarte(combi) > .5 || clarte(combi) < .2 ? GANT : IVOIRE;
    const tubeEntre = (a, b, d, mat, color) => { const v = b.map((x, i) => x - a[i]); mettre('cylinder', a.map((x, i) => (x + b[i]) / 2), [d, Math.hypot(v[0], v[1], v[2]), d], mat, color, selonAxe(v)); };
    const boule = (p, d, mat, color) => mettre('sphere', p, [d, d, d], mat, color);
    const versLevier = lisse(0, .3, t) * (1 - lisse(.65, 1, t)), PRISE = VOLANT.prise;
    for (const k of [-1, 1]) {
      const rk = r.map(v => v * k), ex = u.map((v, i) => v * Math.cos(PRISE) + rk[i] * Math.sin(PRISE)), haut = u.map((v, i) => v * Math.sin(PRISE) - rk[i] * Math.cos(PRISE));
      let G = plus(C, [ex, R]);
      if (k > 0 && versLevier > 0) { const cible = plus(pommeau, [wn, .006]); G = G.map((v, i) => v + (cible[i] - v) * versLevier); }
      // point autour du tube : angle compté depuis le côté du pilote (wn) vers l'extérieur (ex), à la distance d, décalé de l le long de la jante
      const tour = (angle, d, l) => plus(G, [wn, Math.cos(angle) * d * e], [ex, Math.sin(angle) * d * e], [haut, l * e]);
      // doigts : jointures à 50°, puis 140°, 210° et le bout à 265°, de l'index (vers le haut) à l'auriculaire
      for (let i = 0; i < 4; i++) {
        const l = (1.5 - i) * .0155, f = (i === 3 ? .88 : 1) * e;
        const j0 = tour(.87, .0215, l), j1 = tour(2.44, .0185, l), j2 = tour(3.67, .018, l), j3 = tour(4.62, .017, l);
        tubeEntre(j0, j1, .0138 * f, TISSU, gant); tubeEntre(j1, j2, .0130 * f, TISSU, gant); tubeEntre(j2, j3, .0122 * f, TISSU, gant);
        boule(j1, .0146 * f, TISSU, gant); boule(j2, .0136 * f, TISSU, gant); boule(j3, .0126 * f, TISSU, gant);
      }
      // garde des jointures, dos de la main et paume vers le poignet
      const poignet = tour(.49, .0725, -.012), jointures = tour(.87, .0225, 0);
      const versPoignet = norme(poignet.map((v, i) => v - jointures[i])), dos = [haut, versPoignet, croix(haut, versPoignet)];
      mettre('bevel', plus(jointures, [versPoignet, .002 * e]), [.066 * e, .016 * e, .019 * e], TISSU, cuir, dos);
      mettre('sphere', jointures.map((v, i) => (v + poignet[i]) / 2), [.064 * e, ecart(poignet, jointures) * 1.12, .030 * e], TISSU, gant, dos);
      boule(tour(.15, .024, .010), .028 * e, TISSU, gant);                                        // éminence du pouce
      // pouce : court, posé le long de la jante, vers le haut, du côté du pilote
      const p0 = tour(.25, .027, .014), p1 = tour(-.30, .0205, .033), p2 = tour(-.62, .0180, .047);
      tubeEntre(p0, p1, .0160 * e, TISSU, gant); tubeEntre(p1, p2, .0146 * e, TISSU, gant); boule(p1, .0166 * e, TISSU, gant); boule(p2, .0150 * e, TISSU, gant);
      // poignet : sangle noire, puis la manche en tronçons le long d'une courbe, vers le coude sous l'image
      const coude = [COUDE[0], COUDE[1], k * COUDE[2]], guide = plus(poignet, [versPoignet, .10 * e]);
      const bezier = f => poignet.map((v, i) => (1 - f) * (1 - f) * v + 2 * f * (1 - f) * guide[i] + f * f * coude[i]);
      tubeEntre(plus(poignet, [versPoignet, -.012 * e]), plus(poignet, [versPoignet, .012 * e]), .042 * e, TISSU, cuir);
      let avant = plus(poignet, [versPoignet, .008 * e]);
      for (let n = 1; n <= 6; n++) {
        const ici = bezier(n / 6), d = (.037 + .013 * n / 6) * e;
        tubeEntre(avant, ici, d, TISSU, combi); boule(ici, d, TISSU, combi);
        avant = ici;
      }
      tubeEntre(bezier(.06), bezier(.10), .046 * e, TISSU, combi);                               // pli de la manche sur la sangle
    }

    // Rétroviseurs : ciel, horizon et piste dans la glace, et les voitures qui suivent, à leur place et à leur taille.
    // Champ de 32° par glace, ouvert de 6° vers l'extérieur ; trois voitures au plus.
    const ciel = etat.ciel || [.66, .77, .88], brume = etat.brume || [.62, .70, .76], suiveurs = etat.derriere || [];
    const GL = .132, GH = .048;                                    // glace : largeur et hauteur
    for (const k of [-1, 1]) {
      const zc = k * .47, x = .5225, y = .565;
      dans('box', [x, y + GH * .25, zc], [.003, GH * .5, GL], LAQUE, ciel.map(v => v * .62));
      dans('box', [x, y - GH * .04, zc], [.003, GH * .1, GL], LAQUE, brume.map(v => v * .5));
      dans('box', [x, y - GH * .295, zc], [.003, GH * .41, GL], LAQUE, [.085, .09, .095]);
      let n = 0;
      for (const v of suiveurs) {
        if (n >= 3) break;
        const b = .55 - v.x, a = v.z - zc, f = (Math.atan2(a, b) - k * .105) / .28;
        if (b < 2 || b > 90 || Math.abs(f) > 1) continue;
        const dist = Math.hypot(a, b), large = borner(1.9 / dist / .56 * GL, .005, GL * .55), haut = borner(1.0 / dist / .23 * GH, .004, GH * .62);
        const zi = borner(zc + f * GL / 2, zc - GL / 2 + large / 2, zc + GL / 2 - large / 2), yi = y - GH * .08 - haut * .3;
        dans('box', [x - .0012, yi, zi], [.003, haut, large], LAQUE, v.couleur || c2);
        dans('box', [x - .0018, yi - haut * .34, zi], [.003, haut * .34, large * 1.08], MAT, [.03, .03, .035]);
        n++;
      }
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

  B.voiture = { modele, poser, cockpit, fantome, visible, attitude, angles, mul, mulM, euler, braquages, OEIL, K, VOLANT, PLANCHE, LEVIER, ROUES, EMPATTEMENT };
})(globalThis.BITUME = globalThis.BITUME || {});
