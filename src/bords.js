/* BITUME — bords de route (lot 22F, demande de David du 18/11/2026 : « un peu plus de panneaux de publicité au bord
   de la route aussi, quelques bords de routes dangereux »).

   Deux familles, tirées d'un générateur propre au circuit (jamais le hasard du décor ni celui de la course) :
   - publicités : séries de bandeaux de 3 à 6 panneaux d'une même marque sur les glissières des droites (comme sur les
     circuits de la fin des années 1970), grands panneaux sur pieds en retrait derrière la glissière, une passerelle
     publicitaire au bout de la ligne des stands. Les marques sont imaginaires ; leur identité visuelle (fond, bande,
     emblème, faux lettrage) découle de leur nom, la même partout ;
   - bords dangereux : deux à quatre portions par circuit, choisies selon le caractère du lieu (vide derrière un
     parapet, arbres ou rochers à quelques mètres du bord, muret au ras de la chaussée, fossé), annoncées par le décor
     (panneau triangulaire, balises, chevrons, bandes blanches sur les troncs).

   Ce module ne fait que planifier et poser : `limites(c, plan)` resserre les limites du circuit à la création (vide,
   muret, fossé) ; `poser(c, plan, outils)` ajoute les objets aux lots du décor APRÈS tous les autres, de sorte que les
   solides historiques gardent leur ordre et leurs identifiants. Rien n'est créé en course. */
(function (B) {
  'use strict';

  function alea(graine) {
    let a = graine >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // graine propre : distincte de celle du décor ((graine × 7919 + 13) et ses dérivées) et de la course
  const graineBords = c => (((c.graine >>> 0) * 2246822519) ^ 0x5b0e2d1f) >>> 0;
  const hacher = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // Marques imaginaires (aucune n'existe à notre connaissance ; ni tabac ni alcool).
  const MARQUES = Object.freeze([
    ['BRAVELIN', 'pneus'], ['CARBOLÈNE', 'huiles'], ['VIRAGEX', 'bougies'], ['MARMOTTE', 'eau de source'],
    ['OCRANE', 'carburant'], ['GRIFFAL', 'freins'], ['LUMENOR', 'phares'], ['PIVOLINE', 'lubrifiants'],
    ['ZÉNOBE', 'montres'], ['FLAMMÈCHE', 'allumage'], ['NORDALE', 'batteries'], ['ASTRAN', 'autoradios'],
    ['VELUDOR', 'sièges'], ['KÉRIAN', 'jantes'], ['FULGOR', 'essence'], ['PAMPILLE', 'confiserie'],
    ['SIROCCAN', 'climatisation'], ['BOURRASQUE', 'pneus pluie'], ['ÉCLISSE', 'cycles'], ['MÉRIDALE', 'cartes routières'],
    ['TRAMONTE', 'amortisseurs'], ['CALISTRE', 'peintures'], ['OPALINE', 'pare-brise'], ['GRANVAL', 'assurances'],
  ].map(([nom, produit]) => Object.freeze({ nom, produit })));
  // teintes franches de l'époque, les mêmes que les publicités historiques du décor
  const TEINTES = [[.86, .12, .08], [.98, .78, .10], [.10, .28, .70], [.06, .52, .30], [.95, .95, .92], [.08, .08, .09], [.92, .40, .06], [.40, .14, .55]];
  const EMBLEMES = ['disque', 'losange', 'chevron', 'bandes', 'soleil'];
  function identite(nom) {
    const h = hacher(nom), fond = TEINTES[h % 8];
    let accent = TEINTES[(h >>> 3) % 8];
    if (accent === fond) accent = TEINTES[(h % 8 + 3) % 8];
    const clair = fond[0] * .3 + fond[1] * .59 + fond[2] * .11 > .5;
    const lettres = []; for (let i = 0; i < Math.min(6, nom.length); i++) lettres.push(.16 + (nom.charCodeAt(i) % 5) * .05);
    return { fond, accent, texte: clair ? [.07, .07, .08] : [.96, .96, .94], embleme: EMBLEMES[(h >>> 7) % EMBLEMES.length], lettres };
  }

  // Densité des publicités par caractère de lieu (un port en est couvert, la lande islandaise presque vide) et types
  // de bords dangereux, dans l'ordre où on les essaie.
  const DENSITE = { foret: 1, cote: 1.5, montagne: .8, islande: .45, desert: .8, asie: 1, pacifique: .8, baikal: .7 };
  const DANGERS = { foret: ['arbres', 'fosse', 'arbres'], cote: ['vide', 'muret', 'fosse'], montagne: ['vide', 'rochers', 'muret'], islande: ['rochers', 'vide', 'fosse'],
    desert: ['rochers', 'fosse', 'rochers'], asie: ['muret', 'vide', 'arbres'], pacifique: ['vide', 'arbres', 'muret'], baikal: ['rochers', 'arbres', 'fosse'] };
  // limite (m depuis l'axe, au-delà de la demi-largeur) imposée par un bord : le parapet ou le muret est la limite
  const LIMITE_BORD = { vide: 1.4, muret: 1.0, fosse: 2.5 };

  const borner = (v, a, b) => v < a ? a : v > b ? b : v;
  const ramener = (c, s) => ((s % c.longueur) + c.longueur) % c.longueur;
  // ligne des stands (abscisses signées autour du départ), passages couverts et ponts : ni publicité ni bord dangereux
  function interdit(c, s, marge) {
    const ld = c.ligneDroite || { debut: -150, fin: 150 }, L = c.longueur, x = ramener(c, s);
    if (x <= ld.fin + marge || x >= L + ld.debut - marge) return true;
    for (const t of (c.couverts || (c.tunnel ? [c.tunnel] : []))) if (x > t.debut - marge && x < t.fin + marge) return true;
    for (const p of (c.ponts || [])) if (x > p.debut - 20 && x < p.fin + 20) return true;
    return false;
  }

  // ---------------------------------------------------------------- plan
  function planifier(c) {
    if (c._bords) return c._bords;
    const r = alea(graineBords(c)), n = c.n, pas = c.pas, L = c.longueur, theme = c.theme || 'foret';
    // -- bords dangereux : ceux que le tracé déclare (génération 3), sinon choisis à l'extérieur des courbes rapides
    let dangers = [];
    if (c.bords && c.bords.length) dangers = c.bords.map(b => ({ type: b.type, cote: b.cote === 'G' ? -1 : 1, debut: b.debut, fin: b.fin, nom: b.nom }));
    else {
      const candidats = [], libre = (debut, fin) => !interdit(c, debut, 80) && !interdit(c, fin, 80) && !interdit(c, (debut + fin) / 2, 80);
      for (let i = 0; i < n;) {
        const k = c.courbure[i], a = Math.abs(k);
        if (a < 1 / 600) {
          // droite d'au moins 260 m : ses 200 m du milieu (allée d'arbres, fossé, muret, rochers ; jamais le vide)
          let j = i; while (j < n && Math.abs(c.courbure[j]) < 1 / 600) j++;
          const milieu = (i + j) / 2 * pas, cote = r() < .5 ? -1 : 1;
          if ((j - i) * pas >= 260 && libre(milieu - 100, milieu + 100)) candidats.push({ debut: milieu - 100, fin: milieu + 100, cote, courbe: false });
          i = j; continue;
        }
        // courbes rapides seulement (rayon de 100 à 600 m) : le décor pose ses murs de pneus devant la glissière des
        // virages de moins de 95 m, ils ne doivent pas se retrouver au ras d'un muret
        if (a > 1 / 100) { i++; continue; }
        let j = i; while (j < n && Math.abs(c.courbure[j]) >= 1 / 600 && Math.abs(c.courbure[j]) <= 1 / 100 && Math.sign(c.courbure[j]) === Math.sign(k)) j++;
        const debut = i * pas - 50, fin = Math.min(j * pas + 30, debut + 260);
        if (fin - debut >= 120 && libre(debut, fin)) candidats.push({ debut, fin, cote: k > 0 ? -1 : 1, courbe: true });   // l'extérieur : à gauche d'un virage à droite
        i = j;
      }
      // deux à quatre portions, à 500 m au moins l'une de l'autre ; le vide ne se met qu'à l'extérieur d'une courbe
      // (à défaut, un muret le remplace)
      const voulus = 2 + Math.floor(r() * 3), types = DANGERS[theme] || DANGERS.foret;
      const loin = k => !dangers.some(d => Math.abs(ramener(c, d.debut - k.debut + L / 2) - L / 2) < 500);
      for (let essai = 0; essai < 8 && dangers.length < voulus; essai++) {
        const voulu = types[dangers.length % types.length], courbes = candidats.filter(k => k.courbe && loin(k));
        const type = voulu === 'vide' && !courbes.length ? 'muret' : voulu, possibles = type === 'vide' ? courbes : candidats.filter(loin);
        if (!possibles.length) break;
        const cand = possibles[Math.floor(r() * possibles.length)];
        candidats.splice(candidats.indexOf(cand), 1);
        dangers.push({ type, cote: cand.cote, debut: cand.debut, fin: cand.fin, nom: type });
      }
      dangers.sort((a, b) => a.debut - b.debut);
    }
    const dansDanger = (s, cote) => dangers.some(d => d.cote === cote && ramener(c, s - d.debut + 40) < d.fin - d.debut + 80);
    // -- marques du circuit : 8 à 12, tirées une fois
    const ordre = MARQUES.map((m, i) => [r(), i]).sort((a, b) => a[0] - b[0]).map(([, i]) => MARQUES[i]);
    const marques = ordre.slice(0, 8 + Math.floor(r() * 5));
    const densite = DENSITE[theme] || 1;
    // -- bandeaux en séries sur les glissières des droites et des courbes rapides (segments de 8 m comme les glissières
    // du décor ; jamais sur l'index où le décor pose déjà son panneau isolé, (i / 4) % 9 === 4)
    const bandeaux = [];
    for (const cote of [-1, 1]) {
      let attente = 0;
      for (let i = 0; i + 4 < n; i += 4) {
        const s = i * pas, k = Math.abs(c.courbure[i]);
        if (attente > 0) { attente--; continue; }
        if (k > 1 / 300 || interdit(c, s, 40) || dansDanger(s, cote) || (i / 4) % 9 === 4) continue;
        // « un peu plus » (David) : une série de 3 à 6 bandeaux tous les 250 m de droite environ et par côté, en plus
        // des panneaux isolés du décor (un tous les 100 m environ)
        if (r() > .07 * densite) continue;
        const marque = marques[Math.floor(r() * marques.length)], nb = 3 + Math.floor(r() * 4), pose = [];
        for (let j = i; pose.length < nb && j + 4 < n; j += 4) {
          if ((j / 4) % 9 === 4) continue;   // le panneau isolé du décor est déjà là : la série l'enjambe
          if (Math.abs(c.courbure[j]) > 1 / 300 || interdit(c, j * pas, 40) || dansDanger(j * pas, cote)) break;
          pose.push(j);
        }
        if (pose.length < 3) continue;       // jamais de série de moins de trois bandeaux
        for (const j of pose) bandeaux.push({ i: j, cote, marque: marque.nom });
        attente = 10 + Math.floor(r() * 15);
      }
    }
    // -- grands panneaux sur pieds, derrière la glissière des longues droites, un tous les 220 à 300 m, côté alterné
    const affiches = [];
    let cote = r() < .5 ? -1 : 1, prochain = 0;
    for (let i = 0; i < n; i++) {
      const s = i * pas;
      if (s < prochain || Math.abs(c.courbure[i]) > 1 / 800 || interdit(c, s, 60)) continue;
      let j = i; while (j < n && Math.abs(c.courbure[j]) <= 1 / 800) j++;
      if ((j - i) * pas < 300) { i = j; continue; }
      if (dansDanger(s + 80, cote)) cote = -cote;
      affiches.push({ s: s + 80, cote, marque: marques[Math.floor(r() * marques.length)].nom });
      prochain = s + 80 + 220 + r() * 80; cote = -cote;
    }
    // -- une passerelle publicitaire au bout de la ligne des stands (le portique du départ est à s = 0)
    const ld = c.ligneDroite, passerelles = [];
    if (ld && ld.fin - 120 > 160) passerelles.push({ s: ld.fin - 120, marque: marques[0].nom });
    const plan = { graine: graineBords(c), marques: marques.map(m => m.nom), dangers, bandeaux, affiches, passerelles };
    Object.defineProperty(c, '_bords', { value: plan, enumerable: false, configurable: true });
    return plan;
  }

  // Échantillons d'une portion, calés sur les segments de 8 m des glissières du décor (multiples de 4) : le parapet, le
  // muret ou les balises du fossé couvrent les segments i0 … i1 (chacun jusqu'à i + 4), exactement ceux dont la
  // glissière est retirée ; la limite resserrée couvre la même étendue.
  const bornes = (c, d) => ({ i0: Math.round(d.debut / c.pas / 4) * 4, i1: Math.round(d.fin / c.pas / 4) * 4 });

  // ---------------------------------------------------------------- limites (à la création du circuit)
  // Le parapet d'un vide, le muret, le bord d'un fossé deviennent la limite ; on y arrive en entonnoir (pente latérale
  // 0,35 au plus), comme aux portails du tunnel, pour que la glissière ne saute jamais.
  function limites(c, plan) {
    if (!c.limiteG || !c.limiteD) return 0;
    const w = c.largeur / 2, n = c.n, pas = c.pas;
    let touches = 0;
    for (const d of plan.dangers) {
      const marge = LIMITE_BORD[d.type];
      if (marge == null) continue;
      const tab = d.cote < 0 ? c.limiteG : c.limiteD, cible = w + marge;
      const { i0 } = bornes(c, d), i1 = bornes(c, d).i1 + 4, E = Math.ceil((LIMITE_BORD.vide + 20) / .35 / pas);
      for (let i = i0 - E; i <= i1 + E; i++) {
        const k = ((i % n) + n) % n, dehors = Math.max(i0 - i, i - i1, 0) * pas;
        const v = Math.min(tab[k], cible + dehors * .35);
        if (v < tab[k]) { tab[k] = v; touches++; }
      }
    }
    return touches;
  }
  // le parapet (vide), le muret et les balises du fossé remplacent la glissière sur leur portion : le danger se voit
  function sansGlissiere(c, i, cote) {
    const plan = c._bords;
    if (!plan) return false;
    const k = ((i % c.n) + c.n) % c.n;
    return plan.dangers.some(d => { const b = bornes(c, d); return d.cote === cote && (d.type === 'vide' || d.type === 'muret' || d.type === 'fosse') && k >= b.i0 && k <= b.i1; });
  }

  // ---------------------------------------------------------------- pose (à la construction du décor)
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norme = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  function poser(c, plan, outils) {
    const D = B.decor, w = c.largeur / 2, lim = outils.limites || { G: c.limiteG, D: c.limiteD };
    // Légère : panneaux sans emblème ni lettrage, arbres en volumes simples ; Moyenne et Fine : arbres de la botanique
    const legere = outils.qualite !== 'medium' && outils.qualite !== 'high', fine = !legere, stats = { bandeaux: 0, affiches: 0, passerelles: 0, dangers: plan.dangers.length, objets: 0, solides: 0 };
    const angles = D.angles, base = D.base, cadre = D.cadre, hauteur = D.hauteurRoute;
    const pointPlan = (f, d, y) => [f.x + f.r[0] * d, y, f.z + f.r[2] * d];
    const limiteA = (f, cote) => (cote < 0 ? lim.G : lim.D)[f.i];
    const ajouter = (objets, loin, p) => { outils.ajouter(objets, loin, p[0], p[2]); stats.objets += objets.length; stats.solides += objets.filter(o => o.collision).length; };
    const identites = new Map();
    const id = nom => { let v = identites.get(nom); if (!v) identites.set(nom, v = identite(nom)); return v; };
    // face d'une marque sur un panneau : repère (ax le long, ay vers le haut, az vers la droite de la piste), centre,
    // longueur, hauteur, cote (la face regarde la piste : côté -cote·az)
    function face(objets, loin, m, centre, ax, ay, az, long, haut, cote) {
      const I = id(m), vers = (u, v, e) => [centre[0] + ax[0] * u + ay[0] * v - az[0] * cote * e, centre[1] + ax[1] * u + ay[1] * v - az[1] * cote * e, centre[2] + ax[2] * u + ay[2] * v - az[2] * cote * e];
      const rot = angles(ax, ay, az);
      const fond = { shape: 'box', p: centre, s: [long, haut, .06], r: rot, mat: 16, color: I.fond };
      objets.push(fond); loin.push(fond);
      objets.push({ shape: 'box', p: vers(0, -haut * .38, .035), s: [long, haut * .16, .02], r: rot, mat: 16, color: I.accent });
      if (legere) return;
      const e = haut * .52, x0 = -long / 2 + haut * .55;
      // emblème à gauche
      if (I.embleme === 'disque' || I.embleme === 'soleil') {
        const yy = norme(croix(az, ax)), rr = angles(ax, az, yy.map(v => -v));
        objets.push({ shape: I.embleme === 'disque' ? 'cylinder' : 'octa', p: vers(x0, haut * .05, .05), s: [e, .04, e], r: rr, mat: 16, color: I.accent });
      } else if (I.embleme === 'losange') {
        const c45 = Math.SQRT1_2, xr = ax.map((v, k) => c45 * v + c45 * ay[k]), yr = ax.map((v, k) => -c45 * v + c45 * ay[k]);
        objets.push({ shape: 'box', p: vers(x0, haut * .05, .05), s: [e * .7, e * .7, .03], r: angles(xr, yr, az), mat: 16, color: I.accent });
      } else if (I.embleme === 'chevron') {
        for (const sg of [-1, 1]) {
          const ca = Math.cos(.7), sa = Math.sin(.7) * sg, xr = ax.map((v, k) => ca * v + sa * ay[k]), yr = ax.map((v, k) => -sa * v + ca * ay[k]);
          objets.push({ shape: 'box', p: vers(x0 + sg * e * .18, haut * .05, .05), s: [e * .62, e * .2, .03], r: angles(xr, yr, az), mat: 16, color: I.accent });
        }
      } else for (let b = -1; b <= 1; b++) objets.push({ shape: 'box', p: vers(x0 + b * e * .3, haut * .05, .05), s: [e * .16, e, .03], r: rot, mat: 16, color: I.accent });
      // faux lettrage : un mot en blocs, lisible comme une marque de loin sans police de caractères
      let u = x0 + e * .75;
      for (const lw of I.lettres.slice(0, 5)) {
        const largeur = lw * haut * 1.25;
        if (u + largeur > long / 2 - haut * .2) break;
        objets.push({ shape: 'box', p: vers(u + largeur / 2, haut * .06, .045), s: [largeur, haut * .4, .02], r: rot, mat: 16, color: I.texte });
        u += largeur + haut * .09;
      }
    }

    // -- bandeaux sur les glissières (8 m, 0,9 m de haut, comme les panneaux isolés du décor)
    for (const b of plan.bandeaux) {
      const f0 = cadre(c, b.i), f1 = cadre(c, b.i + 4), L0 = limiteA(f0, b.cote), L1 = limiteA(f1, b.cote);
      const y0 = hauteur(f0, b.cote * w, w) - .02 * (L0 - w - 1.2), y1 = hauteur(f1, b.cote * w, w) - .02 * (L1 - w - 1.2);
      const p0 = pointPlan(f0, b.cote * L0, y0), p1 = pointPlan(f1, b.cote * L1, y1);
      const [ax, ay, az] = base([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], [0, 1, 0]), long = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      const centre = [(p0[0] + p1[0]) / 2 - az[0] * b.cote * .18, (p0[1] + p1[1]) / 2 + 1.25, (p0[2] + p1[2]) / 2 - az[2] * b.cote * .18];
      const objets = [], loin = [];
      face(objets, loin, b.marque, centre, ax, ay, az, long * .94, .9, b.cote);
      ajouter(objets, loin, centre); stats.bandeaux++;
    }
    // -- grands panneaux sur deux pieds, 3,5 m derrière la glissière, face 7 × 2,8 m à 2,2 m du sol
    for (const a of plan.affiches) {
      const i = Math.round(a.s / c.pas), f = cadre(c, i), Lc = limiteA(f, a.cote) + 3.5, y = hauteur(f, a.cote * w, w) - .02 * (Lc - w - 1.2);
      const p = pointPlan(f, a.cote * Lc, y), ax = f.t, ay = [0, 1, 0], az = f.r, rot = angles(ax, ay, az);
      const centre = [p[0], y + 2.2 + 1.4, p[2]], objets = [], loin = [];
      for (const sg of [-1, 1]) objets.push({ shape: 'box', p: [p[0] + ax[0] * sg * 2.6, y + 1.8, p[2] + ax[2] * sg * 2.6], s: [.22, 3.6, .22], r: rot, mat: 0, color: [.45, .46, .47] });
      objets.push({ shape: 'box', p: [centre[0] + az[0] * a.cote * .08, centre[1], centre[2] + az[2] * a.cote * .08], s: [7.3, 3.1, .08], r: rot, mat: 0, color: [.32, .33, .34] });
      face(objets, loin, a.marque, centre, ax, ay, az, 7, 2.8, a.cote);
      loin.push(objets[2]);
      ajouter(objets, loin, centre); stats.affiches++;
    }
    // -- passerelle publicitaire : deux pylônes hors des limites, une poutre à 7,4 m, la marque des deux côtés
    for (const pa of plan.passerelles) {
      const i = Math.round(pa.s / c.pas), f = cadre(c, i), y = hauteur(f, 0, w), LG = limiteA(f, -1) + 1.2, LD = limiteA(f, 1) + 1.2;
      const ax = f.r, ay = [0, 1, 0], az = [-f.t[0], 0, -f.t[2]], rot = angles(ax, ay, az), objets = [], loin = [];
      for (const d of [-LG, LD]) { const p = pointPlan(f, d, y); objets.push({ shape: 'box', p: [p[0], y + 4.4, p[2]], s: [.6, 8.8, .6], r: rot, mat: 0, color: [.40, .41, .43] }); }
      const milieu = pointPlan(f, (LD - LG) / 2, y + 8.2), long = LG + LD;
      objets.push({ shape: 'box', p: milieu, s: [long, 1.8, .5], r: rot, mat: 0, color: [.30, .31, .33] });
      for (const sens of [-1, 1]) face(objets, loin, pa.marque, [milieu[0] - az[0] * sens * .3, milieu[1], milieu[2] - az[2] * sens * .3], ax, ay, az, Math.min(long - 2, 30), 1.6, sens);
      loin.push(objets[2]);
      ajouter(objets, loin, milieu); stats.passerelles++;
    }

    // -- bords dangereux et leur signalisation
    const ra = alea(graineBords(c) ^ 0x7f4a7c15), roche = ((D.THEMES && D.THEMES[c.theme]) || {}).roche || [.40, .37, .33];
    for (const d of plan.dangers) {
      const { i0, i1 } = bornes(c, d), cote = d.cote;
      // panneau triangulaire « danger » 120 m avant, du côté concerné, hors des limites : deux coins (prismes à base
      // de triangle rectangle) dos à dos font un triangle isocèle, rouge bordant un triangle blanc, face aux voitures
      {
        const f = cadre(c, i0 - Math.round(120 / c.pas)), Lc = limiteA(f, cote) + 1.4, y = hauteur(f, cote * w, w) - .02 * (Lc - w - 1.2);
        const p = pointPlan(f, cote * Lc, y), objets = [{ shape: 'cylinder', p: [p[0], y + 1.1, p[2]], s: [.08, 2.2, .08], mat: 0, color: [.55, .56, .57] }];
        for (const [haut, demi, couleur, avance] of [[1.0, .58, [.86, .12, .08], 0], [.62, .36, [.95, .95, .92], .03]]) for (const sg of [-1, 1]) {
          const x = f.r.map(v => v * sg), z = croix(x, [0, 1, 0]), cy = y + 2.35 + (1 - haut) * .25;
          objets.push({ shape: 'wedge', p: [p[0] + x[0] * demi / 2 - f.t[0] * avance, cy + haut / 2 - .5 + .5 * (1 - haut), p[2] + x[2] * demi / 2 - f.t[2] * avance], s: [demi, haut, .05], r: angles(x, [0, 1, 0], z), mat: 16, color: couleur });
        }
        ajouter(objets, [objets[1], objets[2]], p);
      }
      // k compte les pas de 8 m depuis le début de la portion (i0 n'est pas toujours un multiple de 4)
      for (let i = i0, k = 0; i <= i1; i += 4, k++) {
        const f = cadre(c, i), Lc = limiteA(f, cote), y = hauteur(f, cote * w, w), objets = [], loin = [];
        if (d.type === 'vide' || d.type === 'muret') {
          // parapet de pierre (vide) ou muret blanc (muret) posé à la limite : il remplace la glissière
          const f1 = cadre(c, i + 4), L1 = limiteA(f1, cote), p0 = pointPlan(f, cote * (Lc + .25), y), p1 = pointPlan(f1, cote * (L1 + .25), hauteur(f1, cote * w, w));
          const dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], [ax, ay, az] = base(dir, [0, 1, 0]), long = Math.hypot(...dir) + .05;
          const h = d.type === 'vide' ? .75 : .9, m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + h / 2, (p0[2] + p1[2]) / 2];
          const mur = { shape: 'box', p: m, s: [long, h, .5], r: angles(ax, ay, az), mat: 3, color: d.type === 'vide' ? [.56, .54, .5] : [.9, .9, .88] };
          objets.push(mur); loin.push(mur);
          // balise rouge et blanche tous les 8 m sur le parapet, bande peinte sur le muret
          if (!legere) objets.push({ shape: 'box', p: [m[0], m[1] + h / 2 + .25, m[2]], s: [.12, .5, .12], r: angles(ax, ay, az), mat: 16, color: k % 2 ? [.86, .12, .08] : [.95, .95, .92] });
        } else if (d.type === 'arbres' && k % 2 === 0) {
          // un tronc tous les 16 m environ, à 2,6 à 6 m du bord : on le touche dès qu'on élargit. Résineux en montagne,
          // en Islande et sur le Pacifique (sapins, séquoias), grands feuillus ailleurs (l'allée de platanes) ; le
          // même nombre de tirages dans les deux cas
          const resineux = c.theme === 'montagne' || c.theme === 'pacifique' || c.theme === 'islande' || c.theme === 'baikal';
          const dd = cote * (w + 2.6 + ra() * 3.4), h = (resineux ? 17 : 14) + ra() * 8, p = pointPlan(f, dd, hauteur(f, dd, w) - .3);
          const tronc = { shape: 'cylinder', collision: 'tronc', p: [p[0], p[1] + h * .42, p[2]], s: [h * .045, h * .84, h * .045], r: [0, 0, 0], mat: 10, color: [.30, .22, .15], detail: 1 };
          objets.push(tronc, { shape: 'cylinder', p: [p[0], p[1] + 1.1, p[2]], s: [h * .047, .45, h * .047], mat: 16, color: [.95, .95, .92] });
          loin.push(tronc);
          if (B.botanique && fine && resineux) {
            // Moyenne et Fine : la couronne procédurale et l'écorce des résineux du décor (decor.js, habiller), pour que
            // l'allée ressemble à la forêt qui l'entoure ; le tronc garde sa taille, donc le même solide. Les feuillus
            // gardent leur houppier simple : le modèle botanique y dessine son propre tronc à côté du nôtre
            const e = 'conifere', v = c.theme === 'pacifique' ? [.11, .22, .1] : [.10, .24, .11];
            tronc.mat = B.botanique.matiere('ecorce');
            objets.push({ shape: B.botanique.nomForme(e, false, outils.qualite), p: [p[0], p[1] + h * .5, p[2]], s: [h, h, h], r: [0, 0, 0], mat: B.botanique.matiere('feuillage'), color: v });
            loin.push({ shape: B.botanique.nomForme(e, true, outils.qualite), p: [p[0], p[1] + h * .5, p[2]], s: [h, h, h], r: [0, 0, 0], mat: B.botanique.matiere('feuillage'), color: v });
          } else if (resineux) {
            const vert = c.theme === 'pacifique' ? [.11, .22, .1] : [.10, .24, .11];
            for (let e = 0; e < 3; e++) objets.push({ shape: 'foliage', p: [p[0], p[1] + h * (.38 + e * .22), p[2]], s: [h * (.42 - e * .1), h * .34, h * (.42 - e * .1)], mat: 11, color: vert.map(q => q * (1 - e * .06)) });
            loin.push({ shape: 'foliage', p: [p[0], p[1] + h * .56, p[2]], s: [h * .4, h * .8, h * .4], mat: 11, color: vert });
          } else {
            const houppe = { shape: 'foliage', p: [p[0], p[1] + h * .8, p[2]], s: [h * .68, h * .4, h * .68], mat: 11, color: [.16, .3, .11] };
            objets.push(houppe); loin.push(houppe);
          }
        } else if (d.type === 'rochers' && ra() < .6) {
          // blocs à demi enterrés, de la couleur de la roche du lieu, un peu plus ou un peu moins clairs
          const dd = cote * (w + 2.6 + ra() * 3.6), t = 1.2 + ra() * 1.6, p = pointPlan(f, dd, hauteur(f, dd, w) - .3), a = ra() * 6.28, e = .85 + ra() * .3;
          const roc = { shape: 'bevel', collision: 'roche', p: [p[0], p[1] + t * .3, p[2]], s: [t * 1.5, t, t * 1.15], r: [0, a, 0], mat: 9, color: roche.map(v => Math.min(1, v * e)) };
          objets.push(roc); loin.push(roc);
        } else if (d.type === 'fosse') {
          // fossé d'eau juste au-delà de la limite (w + 2,5) : on ne creuse pas le terrain ; une eau sombre affleure le
          // niveau de l'accotement (qui descend de 2 % depuis le bord) entre deux berges de terre ; balises blanches à
          // réflecteur rouge sur la limite, tous les 8 m, à la place de la glissière
          const f1 = cadre(c, i + 4), y1 = hauteur(f1, cote * w, w), sol = (yb, dl) => yb - .02 * (dl - 1.2);
          const bande = (dl, large, epais, haut, mat, couleur) => {
            const p0 = pointPlan(f, cote * (w + dl), sol(y, dl) + haut), p1 = pointPlan(f1, cote * (w + dl), sol(y1, dl) + haut);
            const dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], [ax, ay, az] = base(dir, [0, 1, 0]);
            return { shape: 'box', p: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2], s: [Math.hypot(...dir) + .05, epais, large], r: angles(ax, ay, az), mat, color: couleur };
          };
          // un mètre de profondeur : au-delà de la limite le terrain descend (jupe du décor), le fossé ne flotte jamais
          const eau = bande(3.6, 1.6, 1, -.48, 9, [.07, .11, .10]);
          objets.push(eau, bande(2.7, .2, 1, -.46, 9, [.26, .2, .13]), bande(4.5, .2, 1, -.46, 9, [.26, .2, .13])); loin.push(eau);
          const pb = pointPlan(f, cote * (w + 2.6), y);
          objets.push({ shape: 'box', p: [pb[0], y + .5, pb[2]], s: [.12, 1.0, .12], mat: 16, color: [.95, .95, .92] }, { shape: 'box', p: [pb[0], y + .85, pb[2]], s: [.13, .12, .13], mat: 16, color: [.86, .12, .08] });
        }
        if (objets.length) ajouter(objets, loin, objets[0].p);
      }
      // chevrons à l'extérieur, au début de la portion, sur les vides et les murets
      if (d.type === 'vide' || d.type === 'muret') for (let k = 0; k < 3; k++) {
        const f = cadre(c, i0 + k * 6), Lc = limiteA(f, cote) + .9, y = hauteur(f, cote * w, w), p = pointPlan(f, cote * Lc, y);
        const ax = f.t, rot = angles(ax, [0, 1, 0], f.r), objets = [{ shape: 'box', p: [p[0], y + 1.4, p[2]], s: [1.2, .8, .05], r: rot, mat: 16, color: [.08, .08, .09] }];
        // un chevron blanc (deux bandes inclinées) pointé dans le sens du virage
        for (const sg of [-1, 1]) { const ca = Math.cos(.8), sa = Math.sin(.8) * sg; objets.push({ shape: 'box', p: [p[0] - f.r[0] * cote * .04, y + 1.4 + sg * .14, p[2] - f.r[2] * cote * .04], s: [.46, .1, .03], r: angles([ca * ax[0], sa, ca * ax[2]], [-sa * ax[0], ca, -sa * ax[2]], f.r), mat: 16, color: [.95, .95, .92] }); }
        ajouter(objets, [objets[0]], p);
      }
    }
    return stats;
  }

  B.bords = { MARQUES, identite, planifier, limites, sansGlissiere, poser, bornes, graineBords, LIMITE_BORD };
})(globalThis.BITUME = globalThis.BITUME || {});
