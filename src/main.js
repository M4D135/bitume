/* BITUME — main droite gantée d'un pilote qui tient la jante du volant à 3 h, sur la branche, comme dans vroom-unreal.
   Une forme par pièce (gant, paume, garde des jointures, manchette, sangle), en carènes et tubes (src/carene.js).
   Prise : la main est à l'extérieur de la jante, dos tourné vers le dehors, axe de la main perpendiculaire au plan du
   volant, vers le pilote ; la jante passe dans la paume, juste sous les jointures. Les doigts font le tour du tube
   par la planche : l'index au-dessus de la branche et l'auriculaire au-dessous reviennent côté moyeu, le majeur et
   l'annulaire se posent le long du dos de la branche. Le pouce remonte la jante sur sa face tournée vers le pilote.
   Le poignet reste dans l'axe : la manche le prolonge, puis descend vers le coude (src/voiture.js).
   Repère local, en mètres, taille réelle : origine au centre de la section du tube de la jante au point de prise ;
   x vers le pilote, y le long de la jante vers le haut du volant, z vers le moyeu. La main gauche est son miroir. */
(function (B) {
  'use strict';

  const JANTE = { R: .135, r: .0145 };
  const deg = Math.PI / 180, JEU = .0004;                       // jeu entre le gant et le gainage de la jante

  // Point autour du tube de la jante. psi : abscisse angulaire le long de la jante (> 0 vers le haut du volant) ;
  // theta : angle autour du tube (0 : vers le pilote, 90° : dehors, 180° : vers la planche, 270° : vers le moyeu) ;
  // d : distance à l'axe du tube.
  function AUTOUR(psi, theta, d) {
    const cy = JANTE.R * Math.sin(psi), cz = JANTE.R - JANTE.R * Math.cos(psi);
    const ct = Math.cos(theta), st = Math.sin(theta);
    return [d * ct, cy + d * st * Math.sin(psi), cz - d * st * Math.cos(psi)];
  }

  // Branche de 3 h du volant (src/voiture.js), dans ce repère : demi-largeur le long de la jante, faces côté planche et
  // côté pilote. Elle part du tube vers le moyeu, dans le plan du volant.
  const BRANCHE = { demi: .0174, dos: -.0076, face: -.0011 };
  // Jointures sur le flanc extérieur de la jante, un peu vers la planche
  const JOINTURES = { theta: 95 * deg, d: .034 };
  // Axe de la main, des jointures vers le poignet : vers le pilote, un peu vers le moyeu (dos tourné de 80° vers le
  // dehors, comme dans vroom-unreal)
  const AXE = normalise([.985, 0, .174]);
  // Doigts : place le long de la jante, rayon et contacts autour du tube.
  // Les deux doigts centraux poursuivent leur prise sur le dos de la branche :
  // les arrêter au bord du tube les rendait plus courts que l'auriculaire.
  // Les deux contrôles distaux sont exprimés dans la section de la jante
  // [vers le pilote, vers le moyeu]. Leurs longueurs servent à toutes les poses.
  const DOIGTS = [
    { nom: 'index', s: .0318, r: .0098, tour: [136, 178, 226, 260] },
    { nom: 'majeur', s: .0108, r: .0102, tour: [134, 165], distales: [[-.022, .017], [-.018, .040]] },
    { nom: 'annulaire', s: -.0103, r: .0097, tour: [134, 165], distales: [[-.0218, .0145], [-.0178, .034]] },
    { nom: 'auriculaire', s: -.0302, r: .0086, tour: [134, 167, 202, 229] }
  ];
  const EFFILE = [1, 1, .99, .96, .9, .84];
  // Pouce : éminence charnue du poignet au bas de l'index, côté paume, puis le long de la jante vers le haut, couché sur
  // sa face tournée vers le pilote, devant la branche. Éminence : [vers les jointures depuis le poignet, vers
  // l'index, vers la paume] ; pouce : [abscisse le long de la jante, angle autour du tube] ; rayons de la base au bout.
  // carene-4 : la base du pouce était trop serrée (rayon de courbure de l'axe 8,8 mm sous le rayon du tube,
  // 12,4 mm : la peau se recoupait) ; le premier point de contact est un peu plus haut sur la jante.
  const POUCE = { r: [.0160, .0158, .0124, .0108, .0094], eminence: [[.016, .012, .018], [.036, .020, .026]], tour: [[.028, -20], [.040, -32], [.052, -36]] };

  // Les segments sont mesurés sur cette prise, et non étirés vers des points
  // cibles. Les proportions sont des choix de modèle, pas des cotes humaines
  // certifiées. Les racines et le poignet conservent leurs ancrages R4b.
  function direction(a, b) { return normalise(b.map((v, i) => v - a[i])); }
  function scalaire(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }
  function rotationVers(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const cos = Math.max(-1, Math.min(1, scalaire(a, b))), angle = Math.acos(cos), sin = Math.sin(angle);
    if (sin < 1e-7) return normalise(a.map((v, i) => v * (1 - t) + b[i] * t));
    const x = Math.sin((1 - t) * angle) / sin, y = Math.sin(t * angle) / sin;
    return a.map((v, i) => v * x + b[i] * y);
  }
  function articulerDoigt(pts, psi, ouverture, geste, progression, ecartement) {
    const reference = pts.map(p => p.slice()), largeur = [0, Math.cos(psi), Math.sin(psi)];
    const avant = normalise([-AXE[0], AXE[2] * Math.sin(psi), -AXE[2] * Math.cos(psi)]), dehors = croix(avant, largeur);
    const etendu = geste === 'salut' || geste === 'majeur';
    for (let n = 0; n < 4; n++) {
      const debut = reference[n + 1], fin = reference[n + 2], d = direction(debut, fin);
      const longueur = Math.hypot(...fin.map((v, i) => v - debut[i]));
      let angle = Math.atan2(scalaire(d, dehors), scalaire(d, avant)) * (1 - ouverture);
      if (geste) {
        // Angles déroulés : le dernier segment du poing continue à fléchir au-delà
        // de 180°, au lieu de repartir en sens inverse lors de l'interpolation.
        const cible = etendu ? -n * .025 : [-75, -125, -170, -215][n] * deg;
        angle += (cible - angle) * progression;
      }
      const ecart = geste === 'salut' ? ecartement * .12 * progression : 0;
      const axe = normalise(avant.map((v, i) => v * Math.cos(angle) + dehors[i] * Math.sin(angle) + largeur[i] * ecart));
      pts[n + 2] = pts[n + 1].map((v, i) => v + axe[i] * longueur);
    }
  }

  // Le gant a une section légèrement ovale dans son épaisseur, plutôt qu'un
  // boudin rond. L'affine inverse sur la ligne, puis directe sur la peau,
  // conserve toute la ligne Catmull-Rom et ses centres : aucun doigt n'est
  // déplacé ni raccourci. Les normales suivent l'inverse transposée, y compris
  // aux bouts arrondis. Préparation uniquement, sans ajouter de triangles.
  function tubeOvale(points, rayons, options, axe) {
    const rapport = .92, origine = points[1], inverse = 1 / rapport - 1;
    const projection = p => p.reduce((s, v, k) => s + (v - origine[k]) * axe[k], 0);
    const ligne = points.map(p => {
      const d = projection(p) * inverse;
      return p.map((v, k) => v + axe[k] * d);
    });
    return B.carene.tube(ligne, rayons, options).map(t => t.map((p, i) => {
      if (i < 3) {
        const d = projection(p) * (rapport - 1);
        return p.map((v, k) => v + axe[k] * d);
      }
      const d = scalaire(p, axe) * inverse;
      return normalise(p.map((v, k) => v + axe[k] * d));
    }));
  }

  function construire(ouvert, expression) {
    const C = B.carene;
    // Chaque état est préparé au chargement : aucun sommet n'est reconstruit en course.
    // Le fermé tient jante et branche ; l'ouverture déplie des longueurs fixes.
    const ouverture = typeof ouvert === 'number' ? Math.max(0, Math.min(1, ouvert)) : ouvert ? 1 : 0;
    const geste = expression && ['majeur', 'poing', 'salut'].includes(expression.geste) ? expression.geste : null;
    const progression = geste ? Number.isFinite(expression.progression) ? Math.max(0, Math.min(1, expression.progression)) : 1 : 0;
    const K = AUTOUR(0, JOINTURES.theta, JOINTURES.d);            // jointure du majeur et de l'annulaire : origine du dos
    const a = AXE, bz = [0, 1, 0], Y = croix(bz, a);              // Y : normale au dos de la main, vers le dehors
    const m = [a, Y, bz];
    const W = additionner(K, multiplier(a, .088));                // centre du poignet

    // --- Doigts : de l'intérieur du dos à la jointure, puis autour du tube ---
    // Déplier vers le dehors libère la jante sans contracter les doigts autour
    // d'elle. La première phalange garde son point de départ dans la paume.
    const gant = [], pointsDoigts = [], jointures = [];
    for (const doigt of DOIGTS) {
      const psi = doigt.s / JANTE.R, jointure = AUTOUR(psi, JOINTURES.theta, JOINTURES.d), r = doigt.r;
      const rayons = EFFILE.map(f => r * f);
      const base = additionner(jointure, multiplier(a, .040)), racine = additionner(base, multiplier(bz, -doigt.s * .35));
      const pts = [base, jointure, ...doigt.tour.map((t, i) => AUTOUR(psi, t * deg, JANTE.r + rayons[i + 2] + JEU))];
      if (doigt.distales) for (const [x, z] of doigt.distales)
        pts.push([x, (JANTE.R - z) * Math.sin(psi), JANTE.R - (JANTE.R - z) * Math.cos(psi)]);
      if (ouverture > 0 || progression > 0)
        articulerDoigt(pts, psi, ouverture, geste === 'majeur' && doigt.nom !== 'majeur' ? 'poing' : geste, progression, doigt.s / .032);
      gant.push(...tubeOvale(pts, rayons, { cotes: 10, pas: ouverture > 0 || progression > 0 ? 2 : 4, bouts: true }, Y));
      // Les racines convergent dans la paume. Leur raccord est séparé de la
      // courbe de prise pour conserver exactement la tangente autour du tube.
      gant.push(...C.tube([racine, base], r, { cotes: 10, pas: 1, bouts: true }));
      pointsDoigts.push([racine, ...pts.slice(1)]); jointures.push(jointure);
    }

    // --- Dos de la main : carène bombée, large aux jointures, effilée vers le poignet ---
    const SECTIONS = [
      { x: -.008, y0: -.012, y1: .006, l: .036, n: 2.2 },
      { x: .004, y0: -.0165, y1: .0115, l: .0425, n: 2.5 },
      { x: .030, y0: -.0195, y1: .0125, l: .0415, n: 2.6 },
      { x: .060, y0: -.0185, y1: .0120, l: .0365, n: 2.5 },
      { x: .086, y0: -.0150, y1: .0105, l: .0300, n: 2.3 }
    ];
    const dos = C.transformer(C.carene(SECTIONS, { cotes: 22, pas: 4, bouts: true }), m, K);

    // --- Pouce : de l'éminence, côté index et paume, jusque sur la face de la jante tournée vers le pilote ---
    const eminence = POUCE.eminence.map(([x, y, z]) => additionner(additionner(W, multiplier(a, -x)), additionner(multiplier(bz, y), multiplier(Y, -z))));
    const pouce = [...eminence, ...POUCE.tour.map(([s, t], i) => AUTOUR(s / JANTE.R, t * deg, JANTE.r + POUCE.r[i + 2] + 4 * JEU))];
    if (ouverture > 0 || progression > 0) {
      const reference = pouce.map(p => p.slice());
      const cibles = geste === 'salut' ? [[.030, .040, -.022], [.016, .063, -.020], [.003, .075, -.020]]
        : [[.014, .030, -.038], [-.003, .012, -.046], [-.002, -.008, -.048]];
      const vise = [eminence[1], ...cibles.map(([x, y, z]) => additionner(K, additionner(multiplier(a, x), additionner(multiplier(bz, y), multiplier(Y, z)))))];
      for (let n = 0; n < 3; n++) {
        const debut = reference[n + 1], fin = reference[n + 2], longueur = Math.hypot(...fin.map((v, i) => v - debut[i]));
        let axe = rotationVers(direction(debut, fin), normalise(n === 0 ? [.2, 1, 0] : [0, 1, 0]), ouverture);
        if (geste) axe = rotationVers(axe, direction(vise[n], vise[n + 1]), progression);
        pouce[n + 2] = pouce[n + 1].map((v, i) => v + axe[i] * longueur);
      }
    }
    gant.push(...tubeOvale(pouce, POUCE.r, { cotes: 12, pas: ouverture > 0 || progression > 0 ? 2 : 4, bouts: true }, Y));

    // --- Paume : cuir sombre côté jante, sous le dos ---
    const paume = C.transformer(C.carene(SECTIONS.map(q => ({ x: q.x + .003, y0: q.y0 - .0012, y1: q.y0 + .008, l: q.l * .97, n: q.n })),
      { cotes: 22, pas: 4, bouts: true }), m, K);

    // --- Garde : une bosse de cuir sur chaque jointure, dans l'axe du doigt ---
    const garde = [];
    jointures.forEach((j, i) => {
      const p = additionner(j, multiplier(Y, .0045));
      garde.push(...C.tube([additionner(p, multiplier(a, .014)), additionner(p, multiplier(a, -.003))], i === 3 ? .0085 : .0098, { cotes: 10, pas: 2, bouts: true }));
    });

    // --- Manchette évasée, qui recouvre le bout de la manche, et sangle à sa base ---
    // (bouts plats : la manche entre dans la manchette)
    const rond = (x, r) => ({ x, y0: -r, y1: r, l: r, n: 2 });
    const poignet = C.transformer(C.carene([rond(-.004, .0262), rond(.014, .0282), rond(.028, .0298)], { cotes: 18, pas: 3 }), m, W);
    const sangle = C.transformer(C.carene([rond(-.002, .0292), rond(.012, .0292)], { cotes: 18, pas: 1 }), m, W);

    const points = { doigts: pointsDoigts, pouce, jointures, poignet: W, axe: a, dos: Y };
    // Les doigts de prise restent sur le tube ; le dos et la manchette peuvent
    // suivre le poignet sans entraîner ces contacts dans le plan du volant.
    return { gant: gant.concat(dos), prise: gant, dos, paume, garde, poignet, sangle, points };
  }

  // --- Outils vectoriels ---
  function normalise(v) { const l = Math.hypot(v[0], v[1], v[2]); return l ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0]; }
  function croix(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function additionner(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function multiplier(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }

  B.main = { construire, AUTOUR, JANTE, JEU, BRANCHE, AXE, DOIGTS, EFFILE, POUCE };
})(globalThis.BITUME = globalThis.BITUME || {});
