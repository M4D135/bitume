/* BITUME — main droite gantée d'un pilote FIA / années 70-80 qui tient la jante du volant à 3 h, sur la branche.
   Modélisation anatomique haute définition 100 % procédurale : phalanges profilées en D asymétrique (pulpe palmaire
   aplatie, galbe dorsal, méplat d'ongle/couture, renflements articulaires MCP/PIP/DIP et plis de flexion Nomex),
   pouce musclé à éminence thénar, dos métacarpien étanche (arche transversale asymétrique, 4 tendons extenseurs,
   1er interosseux dorsal, fronces élastiques FIA), paume suédée à coussinets et renfort de première commissure,
   garde de jointures continue en cuir capitonné surpiqué, manchette elliptique passepoilée et sangle Velcro à passant.
   Repère local, en mètres, taille réelle : origine au centre de la section du tube de la jante au point de prise ;
   x vers le pilote, y le long de la jante vers le haut du volant, z vers le moyeu. La main gauche est son miroir. */
(function (B) {
  'use strict';

  const JANTE = { R: .135, r: .0145 };
  const deg = Math.PI / 180, JEU = .0004;

  // Point autour du tube de la jante. psi : abscisse angulaire le long de la jante (> 0 vers le haut du volant) ;
  // theta : angle autour du tube (0 : vers le pilote, 90° : dehors, 180° : vers la planche, 270° : vers le moyeu) ;
  // d : distance à l'axe du tube.
  function AUTOUR(psi, theta, d) {
    const cy = JANTE.R * Math.sin(psi), cz = JANTE.R - JANTE.R * Math.cos(psi);
    const ct = Math.cos(theta), st = Math.sin(theta);
    return [d * ct, cy + d * st * Math.sin(psi), cz - d * st * Math.cos(psi)];
  }

  const BRANCHE = { demi: .0174, dos: -.0076, face: -.0011 };
  const JOINTURES = { theta: 95 * deg, d: .034 };
  const AXE = normalise([.985, 0, .174]);
  const DOIGTS = [
    { nom: 'index', s: .0318, r: .0098, tour: [136, 178, 226, 260] },
    { nom: 'majeur', s: .0108, r: .0102, tour: [134, 165], distales: [[-.022, .017], [-.018, .040]] },
    { nom: 'annulaire', s: -.0103, r: .0097, tour: [134, 165], distales: [[-.0218, .0145], [-.0178, .034]] },
    { nom: 'auriculaire', s: -.0302, r: .0086, tour: [134, 167, 202, 229] }
  ];
  const EFFILE = [1, 1, .99, .96, .9, .84];
  const POUCE = { r: [.0160, .0158, .0124, .0108, .0094], eminence: [[.016, .012, .018], [.036, .020, .026]], tour: [[.028, -20], [.040, -32], [.052, -36]] };

  function normalise(v) { const l = Math.hypot(v[0], v[1], v[2]); return l ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0]; }
  function croix(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function additionner(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function soustraire(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function multiplier(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }
  function combiner(o, a, sa, b, sb) { return [o[0] + a[0] * sa + b[0] * sb, o[1] + a[1] * sa + b[1] * sb, o[2] + a[2] * sa + b[2] * sb]; }
  function direction(a, b) { return normalise(soustraire(b, a)); }
  function scalaire(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  const borner = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const gauss = (x, mu, sigma) => { const d = (x - mu) / sigma; return Math.exp(-.5 * d * d); };

  // Maintient une marge minimale de sécurité hors du tore de la jante pour chaque sommet de peau sculptée,
  // sans déplacer les points de contrôle squelettiques ni altérer la fermeture des anneaux.
  function horsToreJante(p, marge = .00045) {
    const dz = p[2] - JANTE.R, rad = Math.hypot(p[1], dz), dr = rad - JANTE.R;
    const dist = Math.hypot(p[0], dr), minD = JANTE.r + marge;
    if (dist >= minD || dist < 1e-9) return p;
    const k = minD / dist, nr = dr * k, echelle = rad > 1e-9 ? (JANTE.R + nr) / rad : 1;
    return [p[0] * k, p[1] * echelle, JANTE.R + dz * echelle];
  }

  function rotationVers(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const cos = borner(scalaire(a, b), -1, 1), angle = Math.acos(cos), sin = Math.sin(angle);
    if (sin < 1e-7) return normalise(a.map((v, i) => v * (1 - t) + b[i] * t));
    const x = Math.sin((1 - t) * angle) / sin, y = Math.sin(t * angle) / sin;
    return a.map((v, i) => v * x + b[i] * y);
  }

  // Garantit que chaque triangle possède trois normales strictement unitaires et du côté de sa face géométrique,
  // même dans les plis serrés de flexion ou aux bouts effilés.
  function garantirNormales(triangles) {
    const out = [];
    for (let t = 0; t < triangles.length; t++) {
      const tri = triangles[t], p0 = tri[0], p1 = tri[1], p2 = tri[2];
      const nf = croix(soustraire(p1, p0), soustraire(p2, p0));
      const aire2 = Math.hypot(nf[0], nf[1], nf[2]);
      if (!(aire2 > 1e-13)) continue;
      const u = [nf[0] / aire2, nf[1] / aire2, nf[2] / aire2];
      const sort = [p0, p1, p2, null, null, null];
      for (let i = 3; i < 6; i++) {
        let n = normalise(tri[i]);
        const ps = scalaire(n, u);
        if (ps < 1e-4) {
          const proj = [n[0] - u[0] * ps, n[1] - u[1] * ps, n[2] - u[2] * ps];
          const lp = Math.hypot(proj[0], proj[1], proj[2]);
          n = lp > 1e-9 ? normalise([proj[0] / lp * .999 + u[0] * .045, proj[1] / lp * .999 + u[1] * .045, proj[2] / lp * .999 + u[2] * .045]) : u;
        }
        sort[i] = n;
      }
      out.push(sort);
    }
    return out;
  }

  // Oriente un triangle [a, b, c] vers l'extérieur par rapport à un point interne `dedans`.
  function orienterFace(a, b, c, dedans) {
    const n = croix(soustraire(b, a), soustraire(c, a));
    const mid = [(a[0] + b[0] + c[0]) / 3 - dedans[0], (a[1] + b[1] + c[1]) / 3 - dedans[1], (a[2] + b[2] + c[2]) / 3 - dedans[2]];
    return scalaire(n, mid) < 0 ? [a, c, b] : [a, b, c];
  }

  // Maillage tubulaire étanche : soude exactement les références de sommets entre anneaux et pôles (euler = 2 si fermé).
  function maillerAnneaux(anneaux, fermerDebut, fermerFin, vif = 48) {
    const faces = [], m = anneaux[0].points.length;
    for (let i = 0; i < anneaux.length - 1; i++) {
      const A = anneaux[i], B2 = anneaux[i + 1];
      const dedans = [(A.centre[0] + B2.centre[0]) * .5, (A.centre[1] + B2.centre[1]) * .5, (A.centre[2] + B2.centre[2]) * .5];
      for (let j = 0; j < m; j++) {
        const k = (j + 1) % m;
        faces.push(
          orienterFace(A.points[j], A.points[k], B2.points[k], dedans),
          orienterFace(A.points[j], B2.points[k], B2.points[j], dedans)
        );
      }
    }
    if (fermerDebut) {
      const A = anneaux[0], B2 = anneaux[1], p = A.pole || A.centre;
      for (let j = 0; j < m; j++) faces.push(orienterFace(p, A.points[j], A.points[(j + 1) % m], B2.centre));
    }
    if (fermerFin) {
      const A = anneaux[anneaux.length - 1], B2 = anneaux[anneaux.length - 2], p = A.pole || A.centre;
      for (let j = 0; j < m; j++) faces.push(orienterFace(p, A.points[j], A.points[(j + 1) % m], B2.centre));
    }
    return garantirNormales(B.carene.lisser(faces, vif));
  }

  // Interpolation cubique monotone (Fritsch-Carlson) pour les profils anatomiques continus.
  function cubiqueMonotone(xs, ys) {
    const n = xs.length, dx = [], dy = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i]); dy.push((ys[i + 1] - ys[i]) / dx[i]); }
    m[0] = dy[0]; m[n - 1] = dy[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) * .5;
    for (let i = 0; i < n - 1; i++) {
      if (Math.abs(dy[i]) < 1e-12) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / dy[i], b = m[i + 1] / dy[i], h = Math.hypot(a, b);
      if (h > 3) { const s = 3 / h; m[i] = s * a * dy[i]; m[i + 1] = s * b * dy[i]; }
    }
    return x => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
      const h = dx[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  // Échantillonnage Catmull-Rom avec transport parallèle orienté par rapport à la direction latérale du doigt :
  // +D pointe vers le dos du doigt (extérieur, côté ongle/jointures), -D vers la pulpe palmaire (côté jante),
  // ±L vers les flancs latéraux (fourchettes du gant). Aucun vrillage même au-delà de 215° de flexion.
  function echantillonnerLigne(points, rayons, pas, latInitial) {
    const n = points.length, P = i => points[borner(i, 0, n - 1)], R = i => rayons[borner(i, 0, n - 1)];
    const echantillons = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < pas; j++) {
        const s = j / pas, s2 = s * s, s3 = s2 * s;
        const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
        const pos = [0, 1, 2].map(k => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3));
        const r = .5 * ((2 * R(i)) + (-R(i - 1) + R(i + 1)) * s + (2 * R(i - 1) - 5 * R(i) + 4 * R(i + 1) - R(i + 2)) * s2 + (-R(i - 1) + 3 * R(i) - 3 * R(i + 1) + R(i + 2)) * s3);
        echantillons.push({ u: i + s, pos, r: Math.max(.001, r) });
      }
    }
    echantillons.push({ u: n - 1, pos: points[n - 1].slice(), r: Math.max(.001, rayons[n - 1]) });

    const m = echantillons.length;
    let L = normalise(latInitial);
    for (let i = 0; i < m; i++) {
      const a = echantillons[Math.max(0, i - 1)].pos, b = echantillons[Math.min(m - 1, i + 1)].pos;
      const T = direction(a, b);
      let proj = soustraire(L, multiplier(T, scalaire(L, T)));
      if (Math.hypot(proj[0], proj[1], proj[2]) < 1e-6) {
        proj = Math.abs(T[1]) < .9 ? croix([0, 1, 0], T) : croix([1, 0, 0], T);
      }
      L = normalise(proj);
      // T pointe des jointures vers le bout (~ -AXE) ; avec L vers le haut du volant (+y),
      // croix(L, T) pointe vers le dos extérieur (+Y, -z), à l'opposé du tube de la jante.
      const D = normalise(croix(L, T));
      echantillons[i].T = T; echantillons[i].L = L; echantillons[i].D = D;
    }
    return echantillons;
  }

  // Peau anatomique d'un doigt ganté (16 côtés) :
  // - Côté jante (cosPhi < 0) : pulpe palmaire légèrement aplatie (<= 0.91 * r), sans aucun débordement vers la jante !
  // - Côté dos/flancs (cosPhi >= 0) : galbe osseux des phalanges, renflements articulaires MCP/PIP/DIP,
  //   plis de flexion du tissu Nomex aux jointures PIP/DIP, coutures de fourchettes et dôme pulpaire/ongle au bout.
  function sculpterDoigt(pts, rayons, options) {
    const cotes = options.cotes || 16, pas = options.pas || 4, flexion = options.flexion ?? 1;
    const lat = options.lat || [0, 1, 0];
    const ech = echantillonnerLigne(pts, rayons, pas, lat);
    const anneaux = [];
    const uMax = pts.length - 1;

    const profilAnneau = (pos, T, D, L, r, u, echelleBout = 1) => {
      const points = [];
      // Renflements articulaires anatomiques aux jointures MCP (u=1), PIP (u=2.1), DIP (u=3.3) et cintrage diaphysaire
      const bosseArtic = gauss(u, 1.0, .27) * .075 + gauss(u, 2.15, .23) * .078 + gauss(u, 3.35, .21) * .065;
      const cintrePhalange = -(gauss(u, 1.58, .24) * .042 + gauss(u, 2.75, .22) * .038 + gauss(u, 4.05, .28) * .032);
      // Plis circonférentiels nets du tissu Nomex sur le dos des jointures PIP et DIP
      const envPliPip = gauss(u, 2.15, .21), envPliDip = gauss(u, 3.35, .18);
      const pliTissu = (.00068 * Math.cos((u - 2.15) * 46) * envPliPip + .00056 * Math.cos((u - 3.35) * 52) * envPliDip) * (.45 + .55 * flexion);
      // Méplat d'ongle / couture de bout sur la phalange distale
      const zoneOngle = borner((u - (uMax - .85)) / .65, 0, 1);

      for (let j = 0; j < cotes; j++) {
        const phi = (j / cotes) * Math.PI * 2;
        const cp = Math.cos(phi), sp = Math.sin(phi); // cp > 0 : dos ; cp < 0 : paume/jante ; sp : flancs
        let eD, eL;
        if (cp >= 0) {
          // Dos du doigt : galbe tendineux + renflement articulaire + méplat d'ongle distal entouré d'un léger bourrelet
          const tendon = .038 * Math.pow(cp, 3) * borner(1 - zoneOngle, 0, 1);
          const litOngle = (-.072 * Math.pow(cp, 2.2) + .024 * gauss(Math.abs(sp), .58, .16)) * zoneOngle;
          eD = (.93 + bosseArtic * .95 + cintrePhalange * .55 + tendon + litOngle) * r * echelleBout + pliTissu * Math.pow(cp, 1.3) * echelleBout;
        } else {
          // Pulpe palmaire côté jante : aplatie et strictement contenue sous .91 * r pour préserver tous les jeux jante/branche
          const galbePulpe = .020 * Math.sin(borner((u - (uMax - 1.1)) / .9, 0, 1) * Math.PI);
          eD = Math.min(.91, .89 + galbePulpe) * r * echelleBout;
        }
        // Largeur latérale : condyles articulaires + fine couture longitudinale de fourchette
        const coutureFourchette = .00028 * Math.exp(-Math.pow(Math.abs(cp) - .28, 2) * 38) * echelleBout;
        eL = (1.00 + bosseArtic * 1.05 + cintrePhalange) * r * echelleBout + coutureFourchette;
        points.push(horsToreJante(combiner(pos, D, eD * cp, L, eL * sp)));
      }
      return { centre: pos, points };
    };

    // Calotte hémisphérique proximale (dans la paume)
    {
      const e0 = ech[0];
      for (let k = 2; k >= 1; k--) {
        const a = (k / 3) * (Math.PI / 2), ca = Math.cos(a), sa = Math.sin(a);
        const pos = additionner(e0.pos, multiplier(e0.T, -e0.r * .85 * sa));
        anneaux.push(profilAnneau(pos, e0.T, e0.D, e0.L, e0.r, 0, ca));
      }
      anneaux[0].pole = horsToreJante(additionner(e0.pos, multiplier(e0.T, -e0.r * .90)));
    }

    for (let i = 0; i < ech.length; i++) {
      const e = ech[i];
      anneaux.push(profilAnneau(e.pos, e.T, e.D, e.L, e.r, e.u, 1));
    }

    // Bout anatomique arrondi et effilé de la pulpe distale (étendue maîtrisée : +0.86 * r_bout)
    {
      const ef = ech[ech.length - 1];
      for (let k = 1; k <= 3; k++) {
        const a = (k / 4) * (Math.PI / 2), ca = Math.cos(a), sa = Math.sin(a);
        const av = ef.r * .84 * sa;
        // Légère asymétrie anatomique : la pulpe remonte doucement vers le bord de l'ongle
        const pos = combiner(ef.pos, ef.T, av, ef.D, ef.r * .05 * sa * sa);
        anneaux.push(profilAnneau(pos, ef.T, ef.D, ef.L, ef.r, uMax, ca));
      }
      anneaux[anneaux.length - 1].pole = horsToreJante(combiner(ef.pos, ef.T, ef.r * .88, ef.D, ef.r * .06));
    }

    return maillerAnneaux(anneaux, true, true, 48);
  }

  // Peau anatomique du pouce (16 côtés) : éminence thénar musclée côté paume/extérieur, jointures MCP et IP
  // marquées avec plis dorsaux du gant, et pulpe distale posée le long de la jante sans pénétration ni recoupement.
  function sculpterPouce(pts, rayons, options) {
    const cotes = options.cotes || 16, pas = options.pas || 4, flexion = options.flexion ?? 1;
    // Pour le pouce qui remonte la jante (+y), l'axe dorsal hors-jante est vers +x / +Y
    const ech = echantillonnerLigne(pts, rayons, pas, [-.25, 0, -1]);
    const anneaux = [], uMax = pts.length - 1;

    const profilPouce = (pos, T, D, L, r, u, echelleBout = 1) => {
      const points = [];
      // Éminence thénar galbée à la base (u < 1.6), jointures MCP (u=2.0) et IP (u=3.1)
      const thenar = borner(1 - u / 1.65, 0, 1);
      const bosseArtic = gauss(u, 2.0, .28) * .052 + gauss(u, 3.1, .24) * .048;
      const pliIp = .00040 * Math.cos((u - 3.1) * 46) * gauss(u, 3.1, .19) * (.45 + .55 * flexion);
      const zoneBout = borner((u - (uMax - .85)) / .65, 0, 1);

      for (let j = 0; j < cotes; j++) {
        const phi = (j / cotes) * Math.PI * 2;
        const cp = Math.cos(phi), sp = Math.sin(phi);
        // Aligner la compression d'épaisseur sur l'axe dorsal global Y afin de préserver exactement le jeu avec la jante
        const dirMonde = combiner([0, 0, 0], D, cp, L, sp);
        const horsJante = Math.max(0, dirMonde[0] * .6 - dirMonde[2] * .8);
        const bosseSecurisee = (bosseArtic * r + pliIp + thenar * .0014) * horsJante * echelleBout;
        const aplatiPulpe = zoneBout * .04 * r * Math.abs(cp) * echelleBout;
        const rad = Math.max(.0015, (.91 * r - aplatiPulpe) * echelleBout + bosseSecurisee);
        points.push(horsToreJante([pos[0] + dirMonde[0] * rad, pos[1] + dirMonde[1] * rad, pos[2] + dirMonde[2] * rad]));
      }
      return { centre: pos, points };
    };

    {
      const e0 = ech[0];
      for (let k = 2; k >= 1; k--) {
        const a = (k / 3) * (Math.PI / 2), ca = Math.cos(a), sa = Math.sin(a);
        const pos = additionner(e0.pos, multiplier(e0.T, -e0.r * .80 * sa));
        anneaux.push(profilPouce(pos, e0.T, e0.D, e0.L, e0.r, 0, ca));
      }
      anneaux[0].pole = horsToreJante(additionner(e0.pos, multiplier(e0.T, -e0.r * .85)));
    }
    for (let i = 0; i < ech.length; i++) {
      const e = ech[i];
      anneaux.push(profilPouce(e.pos, e.T, e.D, e.L, e.r, e.u, 1));
    }
    {
      const ef = ech[ech.length - 1];
      for (let k = 1; k <= 3; k++) {
        const a = (k / 4) * (Math.PI / 2), ca = Math.cos(a), sa = Math.sin(a);
        const pos = additionner(ef.pos, multiplier(ef.T, ef.r * .84 * sa));
        anneaux.push(profilPouce(pos, ef.T, ef.D, ef.L, ef.r, uMax, ca));
      }
      anneaux[anneaux.length - 1].pole = horsToreJante(additionner(ef.pos, multiplier(ef.T, ef.r * .88)));
    }
    return maillerAnneaux(anneaux, true, true, 48);
  }

  // Dos métacarpien anatomique fermé et étanche (euler = 2, aretesOuvertes = 0) :
  // - Arche métacarpienne transversale asymétrique (sommet côté index/majeur, pente cubitale vers l'auriculaire)
  // - Galbe du muscle 1er interosseux dorsal côté pouce (+z)
  // - 4 reliefs de tendons extenseurs convergeant des jointures MCP vers le carpe
  // - Fronces élastiques FIA au resserrage du poignet (x ≈ .065..082)
  function construireDos(m, K) {
    const xs = [-.008, .004, .030, .060, .086];
    const y0s = [-.012, -.0165, -.0195, -.0185, -.0150];
    const y1s = [.006, .0115, .0125, .0120, .0105];
    const ls = [.036, .0425, .0415, .0365, .0300];
    const ns = [2.2, 2.5, 2.6, 2.5, 2.3];
    const fY0 = cubiqueMonotone(xs, y0s), fY1 = cubiqueMonotone(xs, y1s), fL = cubiqueMonotone(xs, ls), fN = cubiqueMonotone(xs, ns);
    const puiss = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);

    const nbX = 19, cotes = 28, anneaux = [];
    const sTendons = [.0305, .0105, -.0100, -.0290];
    const sCreux = [.0205, .0002, -.0195];
    for (let i = 0; i < nbX; i++) {
      const u = i / (nbX - 1), x = -.008 + u * .094;
      const y0 = fY0(x), y1 = fY1(x), l = fL(x), e = 2 / fN(x);
      const yc = (y0 + y1) * .5, h = (y1 - y0) * .5;
      const envMetacarpe = Math.sin(borner((x + .004) / .082, 0, 1) * Math.PI);
      const envTendons = borner((x + .003) / .012, 0, 1) * borner((.068 - x) / .022, 0, 1);
      const envFronces = gauss(x, .073, .0068);
      const ondeFronces = .00105 * Math.cos((x - .073) * 560) * envFronces;
      const points = [];

      for (let j = 0; j < cotes; j++) {
        const a = Math.PI / 2 + (2 * Math.PI * j) / cotes;
        const sa = Math.sin(a), ca = Math.cos(a);
        let z = l * puiss(ca, e);
        let y = yc + h * puiss(sa, e);

        // Galbe radial du 1er interosseux dorsal (côté pouce, z > 0) et bord cubital hypothénar
        if (ca > 0) z += .0024 * Math.pow(ca, 2) * gauss(x, .034, .020);
        else z -= .0010 * Math.pow(-ca, 2) * gauss(x, .042, .022);

        if (sa > 0) {
          // Arche métacarpienne transversale asymétrique + 4 tendons extenseurs et sillons intermétacarpiens + fronces FIA
          const poidsDos = Math.pow(sa, 1.3);
          const archeAsym = (.0018 * gauss(z, .012, .018) - .0020 * borner((-z - .008) / .030, 0, 1)) * envMetacarpe;
          let tendons = 0;
          const conv = 1 - .38 * borner(x / .070, 0, 1);
          for (let t = 0; t < 4; t++) tendons += .00155 * gauss(z, sTendons[t] * conv, .0034);
          for (let c = 0; c < 3; c++) tendons -= .00050 * gauss(z, sCreux[c] * conv, .0032);
          y += (archeAsym + tendons * envTendons + ondeFronces) * poidsDos;
        }
        points.push([x, y, z]);
      }
      const debut = i === 0, fin = i === nbX - 1;
      anneaux.push({
        centre: [x, yc, 0],
        pole: debut ? [x - .0012, yc, 0] : fin ? [x + .0012, yc, 0] : null,
        points
      });
    }
    return garantirNormales(B.carene.transformer(maillerAnneaux(anneaux, true, true, 64), m, K));
  }

  // Paume en cuir suédé sombre (matière cuir 28) : coussinets thénar et hypothénar, creux palmaire central,
  // couvrant franchement la face palmaire du dos sans déborder sur la face dorsale.
  function construirePaume(m, K) {
    const xs = [-.003, .007, .033, .062, .086];
    const y0s = [-.0124, -.0170, -.0201, -.0196, -.0162];
    const y1s = [-.0066, -.0106, -.0130, -.0122, -.0094];
    const ls = [.0342, .0408, .0402, .0356, .0292];
    const ns = [2.2, 2.5, 2.6, 2.5, 2.3];
    const fY0 = cubiqueMonotone(xs, y0s), fY1 = cubiqueMonotone(xs, y1s), fL = cubiqueMonotone(xs, ls), fN = cubiqueMonotone(xs, ns);
    const puiss = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);

    const nbX = 16, cotes = 28, anneaux = [];
    for (let i = 0; i < nbX; i++) {
      const u = i / (nbX - 1), x = -.003 + u * .089;
      const y0 = fY0(x), y1 = fY1(x), l = fL(x), e = 2 / fN(x);
      const yc = (y0 + y1) * .5, h = (y1 - y0) * .5;
      const zoneCoussinets = borner((x - .026) / .016, 0, 1) * borner((.084 - x) / .012, 0, 1);
      const retraitPouce = borner((x - .050) / .018, 0, 1);
      const points = [];

      for (let j = 0; j < cotes; j++) {
        const a = Math.PI / 2 + (2 * Math.PI * j) / cotes;
        const sa = Math.sin(a), ca = Math.cos(a);
        let z = l * puiss(ca, e);
        let y = yc + h * puiss(sa, e);

        // Épouser le galbe radial côté paume tout en rentrant légèrement la lèvre supérieure sous la rotule du pouce
        if (ca > 0) {
          z += .0020 * Math.pow(ca, 2) * gauss(x, .034, .020);
          if (sa > -.25 && retraitPouce > 0) z -= .0032 * ((ca - .1) / .9) * ((sa + .25) / 1.25) * retraitPouce;
        }
        if (sa < 0) {
          const pInf = -sa;
          const coussins = .0013 * (gauss(z, .019, .010) + gauss(z, -.020, .011));
          const creuxCentral = -.0008 * gauss(z, 0, .009);
          y -= (coussins + creuxCentral) * pInf * zoneCoussinets;
        }
        points.push([x, y, z]);
      }
      anneaux.push({
        centre: [x, yc, 0],
        pole: i === 0 ? [x - .001, yc, 0] : i === nbX - 1 ? [x + .001, yc, 0] : null,
        points
      });
    }
    return garantirNormales(B.carene.transformer(maillerAnneaux(anneaux, true, true, 50), m, K));
  }

  // Garde de jointures FIA continue en cuir carbone/suédé capitonné (matière cuir 28, cousue sur repPaume / dos) :
  // bandeau transversal moulé d'un seul tenant sur les 4 jointures MCP (x ≈ .002..023) avec 4 dômes anatomiques
  // continûment saillants au-dessus du tissu Nomex et 3 sillons de couture marqués entre les jointures.
  function construireGarde(jointures, m, K) {
    const sJointures = DOIGTS.map(d => d.s);
    const nbZ = 25, cotes = 16, anneaux = [];
    const zMin = -.0364, zMax = .0384;
    for (let i = 0; i < nbZ; i++) {
      const u = i / (nbZ - 1), z = zMin + u * (zMax - zMin);
      const bord = Math.sin(borner(u, .02, .98) * Math.PI);
      const effileBout = Math.pow(bord, .35);
      let dome = 0;
      for (let d = 0; d < 4; d++) {
        const amp = d === 3 ? .88 : d === 1 ? 1.06 : 1.0;
        dome += amp * gauss(z, sJointures[d], .0068);
      }
      const sillon = gauss(z, .0213, .0025) + gauss(z, .0002, .0025) + gauss(z, -.0202, .0025);
      const xc = .0120 - .0018 * dome;
      const demiLong = (.0084 + .0034 * dome - .0014 * sillon) * effileBout;
      const penteCub = -.0018 * borner((-z - .008) / .030, 0, 1);
      const yc = .0136 + .0018 * dome - .0005 * sillon + penteCub;
      const demiEp = (.0027 + .0016 * dome - .0006 * sillon) * effileBout;

      const points = [];
      for (let j = 0; j < cotes; j++) {
        const a = (2 * Math.PI * j) / cotes;
        const ca = Math.cos(a), sa = Math.sin(a);
        const dy = sa >= 0 ? demiEp * Math.pow(sa, .80) : demiEp * .45 * sa;
        const dx = demiLong * Math.sign(ca) * Math.pow(Math.abs(ca), .86);
        points.push([xc + dx, yc + dy, z]);
      }
      anneaux.push({
        centre: [xc, yc, z],
        pole: i === 0 ? [xc, yc, z - .0012] : i === nbZ - 1 ? [xc, yc, z + .0012] : null,
        points
      });
    }
    return garantirNormales(B.carene.transformer(maillerAnneaux(anneaux, true, true, 54), m, K));
  }

  // Manchette FIA évasée à section elliptique anatomique et ourlet passepoilé roulé (rayon .0262..0296 m autour de W).
  // Englobe complètement le premier tube de manche (.0256 m) tout en restant sous la sangle Velcro (.0282..0298 m).
  function construirePoignet(m, W) {
    const xs = [-.004, .005, .012, .019, .0255, .0280];
    const hs = [.0262, .0264, .0268, .0278, .0289, .0283];
    const ls = [.0272, .0274, .0278, .0288, .0296, .0290];
    const cotes = 28, anneaux = [];
    const fH = cubiqueMonotone(xs, hs), fL = cubiqueMonotone(xs, ls);
    const nb = 13;
    for (let i = 0; i < nb; i++) {
      const u = i / (nb - 1), x = -.004 + u * .032;
      const h = fH(x), l = fL(x);
      const ourlet = .00045 * gauss(x, .0266, .0013);
      const drape = .00022 * borner((x - .013) / .013, 0, 1);
      const points = [];
      for (let j = 0; j < cotes; j++) {
        const a = Math.PI / 2 + (2 * Math.PI * j) / cotes;
        const pli = drape * Math.cos(5 * a + .4);
        const ry = Math.min(.0298, h + ourlet + pli);
        const rz = Math.min(.0298, l + ourlet + pli);
        points.push([x, ry * Math.sin(a), rz * Math.cos(a)]);
      }
      anneaux.push({
        centre: [x, 0, 0],
        pole: i === 0 ? [x - .0008, 0, 0] : i === nb - 1 ? [x + .0008, 0, 0] : null,
        points
      });
    }
    return garantirNormales(B.carene.transformer(maillerAnneaux(anneaux, true, true, 48), m, W));
  }

  // Sangle de serrage de poignet à patte Velcro et relief de boucle/passant dorsal (toujours +1.4 mm hors manchette, <= .0298 m).
  function construireSangle(m, W) {
    const nb = 9, cotes = 28, anneaux = [];
    for (let i = 0; i < nb; i++) {
      const u = i / (nb - 1), x = -.0015 + u * .0135;
      const biseau = Math.pow(Math.sin(borner(u, .03, .97) * Math.PI), .25);
      const envPatte = Math.sin(borner((u - .08) / .84, 0, 1) * Math.PI);
      const points = [];
      for (let j = 0; j < cotes; j++) {
        const a = Math.PI / 2 + (2 * Math.PI * j) / cotes;
        const sa = Math.sin(a), ca = Math.cos(a);
        let ry = .0275 + .0007 * biseau;
        let rz = .0285 + .0007 * biseau;
        const angleBoucle = gauss(a - 1.95, 0, .26) * envPatte;
        const anglePatte = borner(sa, 0, 1) * borner(.45 - ca, 0, 1) * envPatte;
        ry = Math.min(.0298, ry + .0014 * angleBoucle + .0008 * anglePatte);
        rz = Math.min(.0298, rz + .0008 * angleBoucle + .0005 * anglePatte);
        points.push([x, ry * sa, rz * ca]);
      }
      anneaux.push({
        centre: [x, 0, 0],
        pole: i === 0 ? [x - .0006, 0, 0] : i === nb - 1 ? [x + .0006, 0, 0] : null,
        points
      });
    }
    return garantirNormales(B.carene.transformer(maillerAnneaux(anneaux, true, true, 44), m, W));
  }

  // Articulation biomécanique à longueurs d'os strictement constantes :
  // cascade cubitale naturelle au poing/majeur, convergence vers le scaphoïde et éventail organique au salut.
  function articulerDoigt(pts, psi, ouverture, geste, progression, ecartement, indexDoigt) {
    const reference = pts.map(p => p.slice()), largeur = [0, Math.cos(psi), Math.sin(psi)];
    const avant = normalise([-AXE[0], AXE[2] * Math.sin(psi), -AXE[2] * Math.cos(psi)]), dehors = croix(avant, largeur);
    const etendu = geste === 'salut' || geste === 'majeur';
    // Cascade anatomique : l'auriculaire (3) et l'annulaire (2) s'enroulent un peu plus serré dans la paume que l'index (0)
    const facteurPoing = [.96, 1.0, 1.025, 1.045][indexDoigt] || 1;
    const convergencePoing = [-.035, -.010, .018, .042][indexDoigt] || 0;

    for (let n = 0; n < 4; n++) {
      const debut = reference[n + 1], fin = reference[n + 2], d = direction(debut, fin);
      const longueur = Math.hypot(...fin.map((v, i) => v - debut[i]));
      let angle = Math.atan2(scalaire(d, dehors), scalaire(d, avant)) * (1 - ouverture);
      let ecart = 0;
      if (geste && progression > 0) {
        const cible = etendu ? -n * .024 : ([-74, -125, -170, -214][n] * facteurPoing) * deg;
        angle += (cible - angle) * progression;
        ecart = geste === 'salut' ? ecartement * .12 * progression : !etendu ? convergencePoing * (n / 3) * progression : 0;
      }
      const axe = normalise(avant.map((v, i) => v * Math.cos(angle) + dehors[i] * Math.sin(angle) + largeur[i] * ecart));
      pts[n + 2] = pts[n + 1].map((v, i) => v + axe[i] * longueur);
    }
  }

  // Les pièces indépendantes de l'ouverture des doigts (dos, paume, garde, poignet, sangle) sont préparées
  // une seule fois et partagées entre tous les états de prise et de geste : chargement 3× plus rapide.
  let STATIQUE = null;
  function piecesStatiques() {
    if (STATIQUE) return STATIQUE;
    const K = AUTOUR(0, JOINTURES.theta, JOINTURES.d);
    const a = AXE, bz = [0, 1, 0], Y = croix(bz, a);
    const m = [a, Y, bz];
    const W = additionner(K, multiplier(a, .088));
    const jointures = DOIGTS.map(d => AUTOUR(d.s / JANTE.R, JOINTURES.theta, JOINTURES.d));
    const dos = construireDos(m, K);
    const paume = construirePaume(m, K);
    const garde = construireGarde(jointures, m, K);
    const poignet = construirePoignet(m, W);
    const sangle = construireSangle(m, W);
    STATIQUE = { K, W, a, bz, Y, m, jointures, dos, paume, garde, poignet, sangle };
    return STATIQUE;
  }

  function construire(ouvert, expression) {
    const C = B.carene, S = piecesStatiques();
    const ouverture = typeof ouvert === 'number' ? borner(ouvert, 0, 1) : ouvert ? 1 : 0;
    const geste = expression && ['majeur', 'poing', 'salut'].includes(expression.geste) ? expression.geste : null;
    const progression = geste ? Number.isFinite(expression.progression) ? borner(expression.progression, 0, 1) : 1 : 0;
    const { K, W, a, bz, Y, jointures, dos, paume, garde, poignet, sangle } = S;

    const gant = [], pointsDoigts = [];
    for (let di = 0; di < DOIGTS.length; di++) {
      const doigt = DOIGTS[di];
      const psi = doigt.s / JANTE.R, jointure = jointures[di], r = doigt.r;
      const rayons = EFFILE.map(f => r * f);
      const base = additionner(jointure, multiplier(a, .040)), racine = additionner(base, multiplier(bz, -doigt.s * .35));
      const pts = [base, jointure, ...doigt.tour.map((t, i) => AUTOUR(psi, t * deg, JANTE.r + rayons[i + 2] + JEU))];
      if (doigt.distales) for (const [x, z] of doigt.distales)
        pts.push([x, (JANTE.R - z) * Math.sin(psi), JANTE.R - (JANTE.R - z) * Math.cos(psi)]);

      const gesteDoigt = geste === 'majeur' && doigt.nom !== 'majeur' ? 'poing' : geste;
      if (ouverture > 0 || progression > 0)
        articulerDoigt(pts, psi, ouverture, gesteDoigt, progression, doigt.s / .032, di);

      const estPlie = gesteDoigt === 'poing' ? progression : 1 - ouverture;
      gant.push(...sculpterDoigt(pts, rayons, {
        cotes: 14,
        pas: ouverture > 0 || progression > 0 ? 2 : 4,
        flexion: estPlie,
        lat: [0, Math.cos(psi), Math.sin(psi)]
      }));
      gant.push(...garantirNormales(C.tube([racine, base], r * .94, { cotes: 10, pas: 1, bouts: true })));
      pointsDoigts.push([racine, ...pts.slice(1)]);
    }

    const eminence = POUCE.eminence.map(([x, y, z]) => additionner(additionner(W, multiplier(a, -x)), additionner(multiplier(bz, y), multiplier(Y, -z))));
    const pouce = [...eminence, ...POUCE.tour.map(([s, t], i) => AUTOUR(s / JANTE.R, t * deg, JANTE.r + POUCE.r[i + 2] + 4 * JEU))];
    if (ouverture > 0 || progression > 0) {
      const reference = pouce.map(p => p.slice());
      const cibles = geste === 'salut'
        ? [[.030, .040, -.022], [.016, .063, -.020], [.003, .075, -.020]]
        : geste === 'majeur'
          ? [[.015, .031, -.036], [0, .016, -.044], [.002, -.002, -.045]]
          : [[.014, .030, -.038], [-.003, .012, -.046], [-.002, -.008, -.048]];
      const vise = [eminence[1], ...cibles.map(([x, y, z]) => additionner(K, additionner(multiplier(a, x), additionner(multiplier(bz, y), multiplier(Y, z)))))];
      for (let n = 0; n < 3; n++) {
        const debut = reference[n + 1], fin = reference[n + 2], longueur = Math.hypot(...fin.map((v, i) => v - debut[i]));
        let axe = rotationVers(direction(debut, fin), normalise(n === 0 ? [.2, 1, 0] : [0, 1, 0]), ouverture);
        if (geste && progression > 0) axe = rotationVers(axe, direction(vise[n], vise[n + 1]), progression);
        pouce[n + 2] = pouce[n + 1].map((v, i) => v + axe[i] * longueur);
      }
    }
    gant.push(...sculpterPouce(pouce, POUCE.r, {
      cotes: 14,
      pas: ouverture > 0 || progression > 0 ? 2 : 4,
      flexion: geste && geste !== 'salut' ? progression : 1 - ouverture
    }));

    const points = { doigts: pointsDoigts, pouce, jointures: jointures.map(j => j.slice()), poignet: W.slice(), axe: a.slice(), dos: Y.slice() };
    return { gant: gant.concat(dos), prise: gant, dos, paume, garde, poignet, sangle, points };
  }

  B.main = { construire, AUTOUR, JANTE, JEU, BRANCHE, AXE, DOIGTS, EFFILE, POUCE };
})(globalThis.BITUME = globalThis.BITUME || {});
