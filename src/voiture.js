/* BITUME — monoplace de style années 1970 en primitives du moteur, vue extérieure, cockpit et fantôme.
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
  function angles(m) {
    const b = -Math.asin(Math.max(-1, Math.min(1, m[0][2])));
    return [Math.atan2(m[1][2], m[2][2]), b, Math.atan2(m[0][1], m[0][0])];
  }
  // Attitude de la caisse : cap h (tangente (cos h, sin h) dans le plan x, z), tangage p (nez vers le haut positif),
  // roulis q (côté droit vers le bas positif). M = Ry(−h)·Rz(p)·Rx(q).
  function attitude(h, p, q) { return mulM(euler(0, -h, 0), mulM(euler(0, 0, p), euler(q, 0, 0))); }

  const ROUE_AXE = euler(Math.PI / 2, 0, 0);       // cylindre couché : son axe suit z (la droite de la voiture)
  const VERS_AVANT = euler(0, 0, -Math.PI / 2);    // cylindre dont l'axe suit x

  const PNEU = [.035, .035, .04], JANTE = [.62, .63, .64], NOIR = [.03, .03, .035], CARBONE = [.06, .065, .07], METAL = [.56, .58, .6];

  // ---------------------------------------------------------------- modèle
  function piece(shape, o, s, mat, color, extra) { return Object.assign({ shape, o, s, mat, color }, extra || {}); }

  function modele(livree) {
    const c1 = livree.couleur, c2 = livree.seconde || [.95, .95, .92], casque = livree.casque || c2, combi = livree.combinaison || c1.map(v => v * .7);
    const corps = [], simples = [];
    const P = (shape, o, s, mat, color, extra) => { const p = piece(shape, o, s, mat, color, extra); corps.push(p); return p; };
    // coque et nez effilé
    P('bevel', [1.88, .34, 0], [.92, .2, .32], 16, c1);
    P('bevel', [1.08, .41, 0], [1.02, .34, .56], 16, c1);
    P('bevel', [.08, .47, 0], [1.16, .48, .8], 16, c1);
    P('box', [1.25, .52, 0], [1.9, .012, .12], 16, c2);                   // bande sur le nez
    P('cylinder', [1.22, .585, 0], [.3, .01, .3], 16, [.95, .95, .93]);    // pastille de numéro
    P('cylinder', [1.22, .59, 0], [.17, .01, .17], 16, c2.map(v => v * .4));
    // aileron avant et dérives
    P('box', [2.16, .2, 0], [.42, .04, 1.72], 16, c2);
    for (const z of [-.86, .86]) P('box', [2.16, .27, z], [.48, .2, .03], 16, c1);
    // pontons
    for (const z of [-.57, .57]) P('bevel', [-.42, .38, z], [1.55, .38, .42], 16, c1);
    for (const z of [-.79, .79]) P('box', [.3, .38, z], [.06, .3, .03], 7, CARBONE);
    // capot moteur, prise d'air haute, arceau
    P('bevel', [-.98, .7, 0], [1.3, .44, .52], 16, c1);
    P('bevel', [-.42, 1.02, 0], [.4, .28, .42], 16, c2);
    P('box', [-.21, 1.02, 0], [.03, .2, .32], 7, NOIR);
    P('box', [-.36, .92, 0], [.08, .38, .28], 0, METAL);
    // mécanique apparente à l'arrière
    P('box', [-1.62, .46, 0], [.72, .34, .5], 0, METAL);
    P('box', [-2.02, .4, 0], [.46, .26, .3], 0, [.38, .4, .42]);
    for (const z of [-.25, .25]) P('cylinder', [-2.16, .5, z], [.09, .52, .09], 0, [.32, .3, .28], { m: VERS_AVANT });
    // aileron arrière sur ses mâts
    P('box', [-2.32, 1.06, 0], [.52, .05, 1.12], 16, c2);
    P('box', [-2.2, 1.12, 0], [.28, .035, 1.08], 16, c1);
    for (const z of [-.57, .57]) P('box', [-2.3, .95, z], [.6, .42, .03], 16, c1);
    for (const z of [-.18, .18]) P('box', [-2.12, .76, z], [.07, .56, .06], 7, CARBONE);
    // suspensions
    for (const z of [-.48, .48]) { P('box', [1.4, .36, z], [.06, .035, .62], 7, CARBONE); P('box', [-1.36, .38, z], [.07, .04, .5], 7, CARBONE); }
    // pilote : casque, visière, épaules
    const pilote = [P('sphere', [-.06, .87, 0], [.29, .3, .31], 16, casque), P('box', [.06, .88, 0], [.08, .08, .22], 16, [.05, .06, .08]),
      P('box', [-.03, .66, 0], [.3, .14, .46], 18, combi)];
    for (const p of pilote) p.pilote = true;
    // rétroviseurs
    for (const z of [-.43, .43]) { P('box', [.36, .7, z], [.05, .09, .15], 16, c1); P('box', [.33, .64, z * .92], [.03, .1, .03], 7, CARBONE); }
    // roues : pneu, jante, moyeu (les avant braquent)
    const roues = [];
    for (const [x, z, r, l, avant] of [[1.4, -.8, .33, .3, true], [1.4, .8, .33, .3, true], [-1.4, -.78, .38, .46, false], [-1.4, .78, .38, .46, false]]) {
      const ext = Math.sign(z);
      roues.push(P('cylinder', [x, r, z], [2 * r, l, 2 * r], 7, PNEU, { m: ROUE_AXE, roue: avant }));
      roues.push(P('cylinder', [x, r, z + ext * .012], [1.2 * r, l + .01, 1.2 * r], 0, JANTE, { m: ROUE_AXE, roue: avant }));
      roues.push(P('cylinder', [x, r, z + ext * (l / 2 + .006)], [.36 * r, .02, .36 * r], 16, c2, { m: ROUE_AXE, roue: avant }));
    }
    // version lointaine : neuf volumes
    simples.push(piece('bevel', [.6, .44, 0], [3.2, .42, .66], 16, c1), piece('box', [2.16, .2, 0], [.42, .05, 1.72], 16, c2),
      piece('box', [-2.32, 1.04, 0], [.5, .08, 1.12], 16, c2), piece('bevel', [-.5, .78, 0], [1.4, .5, .5], 16, c1),
      piece('sphere', [-.06, .87, 0], [.3, .3, .3], 16, casque));
    for (const [x, z, r, l] of [[1.4, -.8, .33, .3], [1.4, .8, .33, .3], [-1.4, -.78, .38, .46], [-1.4, .78, .38, .46]]) simples.push(piece('cylinder', [x, r, z], [2 * r, l, 2 * r], 7, PNEU, { m: ROUE_AXE }));
    return { corps, simples, livree, roues };
  }

  // ---------------------------------------------------------------- pose dans le monde
  // ev = { p: [x, y, z] (sol sous le milieu de l'empattement), cap, tangage, roulis, braquage (rad, droite positive) }
  function poser(mod, ev, sortie, options = {}) {
    const M = attitude(ev.cap, ev.tangage || 0, ev.roulis || 0), rotM = angles(M), braq = euler(0, -(ev.braquage || 0), 0);
    const liste = options.simple ? mod.simples : mod.corps;
    for (const pc of liste) {
      if (options.sansPilote && pc.pilote) continue;
      const o = mul(M, pc.o);
      let rot = rotM;
      if (pc.m) rot = angles(mulM(M, pc.roue ? mulM(braq, pc.m) : pc.m));
      const m = { shape: pc.shape, p: [ev.p[0] + o[0], ev.p[1] + o[1], ev.p[2] + o[2]], s: pc.s, r: rot, mat: pc.mat, color: pc.color, surface: 'object' };
      if (options.overlay) m.overlay = true;
      sortie.push(m);
    }
    return M;
  }

  // Point de vue du pilote, dans le repère de la voiture.
  const OEIL = [-.13, .98, 0];

  // Habitacle vu du siège : rebords, planche de bord, compte-tours, volant à trois branches et gants.
  function cockpit(mod, ev, sortie, regime, volant) {
    const M = poser(mod, ev, sortie, { overlay: true, sansPilote: true });
    const c1 = mod.livree.couleur, P = (o) => { const w = mul(M, o); return [ev.p[0] + w[0], ev.p[1] + w[1], ev.p[2] + w[2]]; };
    const rotM = angles(M), loc = m => angles(mulM(M, m));
    for (const z of [-.39, .39]) sortie.push({ shape: 'bevel', p: P([.1, .66, z]), s: [1.0, .12, .1], r: rotM, mat: 16, color: c1, overlay: true, surface: 'object' });
    sortie.push({ shape: 'box', p: P([.52, .66, 0]), s: [.03, .1, .5], r: rotM, mat: 7, color: NOIR, overlay: true, surface: 'object' });
    sortie.push({ shape: 'bevel', p: P([.46, .6, 0]), s: [.14, .17, .5], r: rotM, mat: 7, color: CARBONE, overlay: true, surface: 'object' });
    // compte-tours : cadran face au pilote, aiguille de 4 000 (à gauche) à 13 000 tr/min
    const cadran = [.385, .66, -.07];
    sortie.push({ shape: 'cylinder', p: P(cadran), s: [.13, .012, .13], r: loc(VERS_AVANT), mat: 16, color: [.9, .9, .86], overlay: true, surface: 'object' });
    const angle = -2.1 + 4.2 * Math.max(0, Math.min(1, (regime - 4000) / 9000));
    const aiguille = mulM(euler(angle, 0, 0), euler(0, 0, 0));
    const centre = [cadran[0] - .008, cadran[1], cadran[2]], bout = mul(aiguille, [0, .028, 0]);
    sortie.push({ shape: 'box', p: P([centre[0], centre[1] + bout[1], centre[2] + bout[2]]), s: [.004, .056, .006], r: loc(aiguille), mat: 6, color: [.9, .1, .05], emissive: .3, overlay: true, surface: 'object' });
    sortie.push({ shape: 'cylinder', p: P([.39, .66, .1]), s: [.08, .01, .08], r: loc(VERS_AVANT), mat: 16, color: [.85, .85, .8], overlay: true, surface: 'object' });
    // volant : plan incliné face au pilote, rotation propre phi
    const tau = .42, phi = volant * 2.0, centreV = [.25, .64, 0];
    const wn = [-Math.cos(tau), Math.sin(tau), 0], wu = [Math.sin(tau), Math.cos(tau), 0], wr = [0, 0, 1];
    const u = wu.map((v, k) => v * Math.cos(phi) + wr[k] * Math.sin(phi)), r = wu.map((v, k) => -v * Math.sin(phi) + wr[k] * Math.cos(phi));
    const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const anneau = [u, wn, croix(u, wn)];
    const RAYON = .135;
    sortie.push({ shape: 'ring', p: P(centreV), s: [RAYON * 2.06, RAYON * 2.06, RAYON * 2.06], r: loc(anneau), mat: 18, color: [.07, .07, .075], overlay: true, surface: 'object' });
    sortie.push({ shape: 'cylinder', p: P(centreV.map((v, k) => v + wn[k] * .005)), s: [.05, .03, .05], r: loc(anneau), mat: 0, color: METAL, overlay: true, surface: 'object' });
    for (const dir of [r, r.map(v => -v), u.map(v => -v)]) {
      const pied = centreV.map((v, k) => v + dir[k] * RAYON * .5);
      const axe = [dir, wn, croix(dir, wn)];
      sortie.push({ shape: 'box', p: P(pied), s: [RAYON * .98, .012, .02], r: loc(axe), mat: 0, color: METAL, overlay: true, surface: 'object' });
    }
    // gants blancs à 9 h et 3 h, avant-bras vers les épaules
    for (const cote of [-1, 1]) {
      const prise = centreV.map((v, k) => v + r[k] * RAYON * cote + wn[k] * .012);
      const axe = [u, wn, croix(u, wn)];
      sortie.push({ shape: 'bevel', p: P(prise), s: [.085, .1, .065], r: loc(axe), mat: 18, color: [.9, .9, .87], overlay: true, surface: 'object' });
      sortie.push({ shape: 'sphere', p: P(prise.map((v, k) => v + wn[k] * .035 - u[k] * .02)), s: [.06, .06, .06], mat: 18, color: [.88, .88, .85], overlay: true, surface: 'object' });
      const epaule = [-.2, .62, cote * .22], milieu = prise.map((v, k) => (v + epaule[k]) / 2), dir = epaule.map((v, k) => v - prise[k]);
      const long = Math.hypot(dir[0], dir[1], dir[2]), ax = dir.map(v => v / long);
      const ay = croix(croix(ax, [0, 1, 0]), ax), ly = Math.hypot(...ay) || 1, axY = ay.map(v => v / ly);
      sortie.push({ shape: 'cylinder', p: P(milieu), s: [.075, long, .075], r: loc([axY.map(v => -v), ax, croix(axY.map(v => -v), ax)]), mat: 18, color: mod.livree.combinaison || c1.map(v => v * .7), overlay: true, surface: 'object' });
    }
    return M;
  }

  // Fantôme du meilleur tour : silhouette translucente.
  function fantome(ev, sortie) {
    const M = attitude(ev.cap, ev.tangage || 0, ev.roulis || 0), rotM = angles(M);
    const P = o => { const w = mul(M, o); return [ev.p[0] + w[0], ev.p[1] + w[1], ev.p[2] + w[2]]; };
    const bleu = [.45, .85, 1];
    for (const [o, s] of [[[.6, .44, 0], [3.2, .4, .66]], [[2.16, .2, 0], [.42, .05, 1.7]], [[-2.32, 1.04, 0], [.5, .08, 1.1]], [[-.5, .8, 0], [1.4, .48, .5]]])
      sortie.push({ shape: 'box', p: P(o), s, r: rotM, fx: true, alpha: .26, color: bleu });
    const rot = angles(mulM(M, ROUE_AXE));
    for (const [x, z, r, l] of [[1.4, -.8, .33, .3], [1.4, .8, .33, .3], [-1.4, -.78, .38, .46], [-1.4, .78, .38, .46]])
      sortie.push({ shape: 'cylinder', p: P([x, r, z]), s: [2 * r, l, 2 * r], r: rot, fx: true, alpha: .22, color: bleu });
  }

  B.voiture = { modele, poser, cockpit, fantome, attitude, angles, mul, OEIL, euler };
})(globalThis.BITUME = globalThis.BITUME || {});
