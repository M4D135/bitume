/* BITUME — circuits originaux générés à partir d'une graine.
   Tracé : polygone étoilé dont les sommets sont arrondis par de vrais arcs de cercle (les côtés deviennent de vraies
   lignes droites), transitions de courbure adoucies, puis relief, dévers, vibreurs, trajectoire idéale et vitesse
   de référence. Premier jet du Spark (QAD) pour l'interface, repris par Claude pour la génération du tracé. */
(function (B) {
  'use strict';

  const PAS = 2, LARGEUR = 12, LIMITE = 20;
  const AMPLITUDE = { foret: 14, cote: 6, montagne: 32, islande: 21, desert: 26, asie: 23, pacifique: 20 };

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
  const angle = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  const borner = (v, a, b) => v < a ? a : v > b ? b : v;
  const lisse = (a, b, x) => { const t = borner((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- tracé en plan
  function polygone(r, rayonBase) {
    const n = 7 + Math.floor(r() * 5), pasA = 2 * Math.PI / n, debut = r() * 2 * Math.PI, pts = [];
    for (let i = 0; i < n; i++) {
      const a = debut + i * pasA + (r() - .5) * pasA * .55;
      let rr = rayonBase * (.58 + r() * .42);
      if (r() < .24) rr *= .5 + r() * .15;            // sommet rentré : épingle ou enchaînement serré
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    if (r() < .5) pts.reverse();                        // la moitié des circuits tournent dans l'autre sens
    return pts;
  }

  // Arrondit chaque sommet ; renvoie la liste des segments (droites et arcs) ou null si un côté est trop court.
  function arrondir(pts, r) {
    const n = pts.length, coins = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const ux = p1[0] - p0[0], uz = p1[1] - p0[1], vx = p2[0] - p1[0], vz = p2[1] - p1[1];
      const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
      const ui = [ux / lu, uz / lu], uo = [vx / lv, vz / lv];
      const theta = Math.atan2(ui[0] * uo[1] - ui[1] * uo[0], ui[0] * uo[0] + ui[1] * uo[1]);
      const ab = Math.abs(theta);
      let R = ab > 1.7 ? 24 + r() * 22 : ab > 1.05 ? 32 + r() * 60 : ab > .55 ? 55 + r() * 110 : 120 + r() * 200;
      if (ab > .9 && r() < .3) R = 24 + r() * 16;
      coins.push({ p: p1, ui, uo, theta, R, lu, lv });
    }
    // Les tangentes de deux coins voisins doivent laisser une ligne droite d'au moins 24 m.
    for (let i = 0; i < n; i++) {
      const a = coins[i], b = coins[(i + 1) % n], cote = a.lv, ta = t => t.R * Math.tan(Math.abs(t.theta) / 2);
      let somme = ta(a) + ta(b);
      if (somme > cote - 24) {
        const f = (cote - 24) / somme;
        a.R *= f; b.R *= f; somme = ta(a) + ta(b);
      }
      if (a.R < 23.9 || b.R < 23.9) return null;
    }
    const segments = [];
    for (let i = 0; i < n; i++) {
      const c = coins[i], t = c.R * Math.tan(Math.abs(c.theta) / 2);
      c.entree = [c.p[0] - c.ui[0] * t, c.p[1] - c.ui[1] * t];
      c.sortie = [c.p[0] + c.uo[0] * t, c.p[1] + c.uo[1] * t];
    }
    for (let i = 0; i < n; i++) {
      const c = coins[i], d = coins[(i + 1) % n];
      segments.push({ arc: true, depart: c.entree, cap: Math.atan2(c.ui[1], c.ui[0]), k: Math.sign(c.theta) / c.R, longueur: c.R * Math.abs(c.theta) });
      const lx = d.entree[0] - c.sortie[0], lz = d.entree[1] - c.sortie[1];
      segments.push({ arc: false, depart: c.sortie, cap: Math.atan2(c.uo[1], c.uo[0]), k: 0, longueur: Math.hypot(lx, lz) });
    }
    return segments;
  }

  // Échantillonne les segments tous les PAS mètres (après mise à l'échelle qui rend L multiple de PAS),
  // adoucit la courbure sur ±16 m et réintègre le tracé en refermant la boucle.
  function echantillonner(segments) {
    let brut = 0;
    for (const s of segments) brut += s.longueur;
    const n = Math.round(brut / PAS), f = n * PAS / brut;
    const k = new Float64Array(n);
    let seg = 0, debutSeg = 0;
    for (let i = 0; i < n; i++) {
      const s = (i + .5) * PAS;
      while (seg < segments.length - 1 && s > (debutSeg + segments[seg].longueur) * f) { debutSeg += segments[seg].longueur; seg++; }
      k[i] = segments[seg].k / f;
    }
    // adoucissement circulaire : la somme des courbures (le tour complet) est conservée exactement
    const F = 8, lisseK = new Float64Array(n);
    for (let i = 0; i < n; i++) { let m = 0; for (let j = -F; j <= F; j++) m += k[(i + j + n) % n]; lisseK[i] = m / (2 * F + 1); }
    const capDepart = segments[0].cap, x = new Float64Array(n), z = new Float64Array(n);
    let a = capDepart, px = segments[0].depart[0] * f, pz = segments[0].depart[1] * f;
    for (let i = 0; i < n; i++) {
      x[i] = px; z[i] = pz;
      const am = a + lisseK[i] * PAS / 2;
      px += Math.cos(am) * PAS; pz += Math.sin(am) * PAS;
      a += lisseK[i] * PAS;
    }
    // fermeture : l'écart résiduel est réparti le long du tour
    const ex = px - x[0], ez = pz - z[0];
    for (let i = 0; i < n; i++) { x[i] -= ex * i / n; z[i] -= ez * i / n; }
    return { x, z, n };
  }

  function capsEtCourbures(x, z, n) {
    const cap = new Float64Array(n), courbure = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      cap[i] = Math.atan2(z[b] - z[a], x[b] - x[a]);
    }
    for (let i = 0; i < n; i++) courbure[i] = angle(cap[(i + 1) % n] - cap[(i - 1 + n) % n]) / (2 * PAS);
    return { cap, courbure };
  }

  function plusLongueDroite(courbure, n) {
    let meilleur = { debut: 0, longueur: 0 }, debut = -1;
    // deux tours pour gérer une droite qui chevauche l'indice 0
    for (let j = 0; j < 2 * n; j++) {
      const i = j % n, droit = Math.abs(courbure[i]) < 1 / 900;
      if (droit && debut < 0) debut = j;
      if ((!droit || j === 2 * n - 1) && debut >= 0) {
        const l = j - debut;
        if (l > meilleur.longueur && l <= n) meilleur = { debut: debut % n, longueur: l };
        debut = -1;
      }
    }
    return { debut: meilleur.debut, longueur: meilleur.longueur * PAS };
  }

  function separation(x, z, n) {
    // plus petite distance entre deux points séparés de plus de 150 m le long du tour
    const ecartMin = Math.ceil(150 / PAS);
    let min = Infinity;
    for (let i = 0; i < n; i += 2) for (let j = i + ecartMin; j < n; j += 2) {
      if (n - (j - i) < ecartMin) continue;
      const dx = x[i] - x[j], dz = z[i] - z[j], d2 = dx * dx + dz * dz;
      if (d2 < min) min = d2;
    }
    return Math.sqrt(min);
  }

  function nombreVirages(courbure, n, seuil) {
    let compte = 0, dans = false;
    for (let i = 0; i < n; i++) {
      const v = Math.abs(courbure[i]) > seuil;
      if (v && !dans) compte++;
      dans = v;
    }
    if (dans && Math.abs(courbure[0]) > seuil && compte > 1) compte--;
    return compte;
  }

  function tourner(tab, decalage) {
    const n = tab.length, r = new tab.constructor(n);
    for (let i = 0; i < n; i++) r[i] = tab[(i + decalage) % n];
    return r;
  }

  // ---------------------------------------------------------------- profils le long du tour
  function relief(n, L, theme, r, plat) {
    const y = new Float64Array(n), A = AMPLITUDE[theme] || 14, harm = [];
    for (let h = 0; h < 3; h++) harm.push({ k: 1 + Math.floor(r() * 5), a: .4 + r() * .6, phi: r() * 2 * Math.PI });
    const somme = harm.reduce((s, h) => s + h.a, 0);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (const h of harm) v += h.a * Math.sin(2 * Math.PI * h.k * i * PAS / L + h.phi);
      y[i] = v / somme * A * (1 - plat[i]);
    }
    let pmax = 0;
    for (let i = 0; i < n; i++) pmax = Math.max(pmax, Math.abs(y[(i + 1) % n] - y[(i - 1 + n) % n]) / (2 * PAS));
    if (pmax > .068) { const f = .068 / pmax; for (let i = 0; i < n; i++) y[i] *= f; }
    const pente = new Float64Array(n);
    for (let i = 0; i < n; i++) pente[i] = (y[(i + 1) % n] - y[(i - 1 + n) % n]) / (2 * PAS);
    return { y, pente };
  }

  function moyenneCirculaire(tab, F) {
    const n = tab.length, r = new Float64Array(n);
    let somme = 0;
    for (let j = -F; j <= F; j++) somme += tab[(j + n) % n];
    for (let i = 0; i < n; i++) { r[i] = somme / (2 * F + 1); somme += tab[(i + F + 1) % n] - tab[(i - F + n) % n]; }
    return r;
  }

  // Trajectoire idéale : bande élastique à plusieurs échelles (pas de 16, 8, 4, 2 m), bornée à la piste.
  function trajectoire(x, z, cap, n, largeur) {
    const d = new Float64Array(n), borne = largeur / 2 - 1.4;
    const rx = new Float64Array(n), rz = new Float64Array(n);
    for (let i = 0; i < n; i++) { rx[i] = -Math.sin(cap[i]); rz[i] = Math.cos(cap[i]); }
    for (const [h, tours] of [[24, 140], [12, 140], [6, 120], [3, 100], [1, 80]]) {
      for (let t = 0; t < tours; t++) for (let i = 0; i < n; i++) {
        const a = (i - h + n) % n, b = (i + h) % n;
        const mx = (x[a] + rx[a] * d[a] + x[b] + rx[b] * d[b]) / 2, mz = (z[a] + rz[a] * d[a] + z[b] + rz[b] * d[b]) / 2;
        const cible = (mx - x[i]) * rx[i] + (mz - z[i]) * rz[i];
        d[i] = borner(d[i] + .55 * (cible - d[i]), -borne, borne);
      }
    }
    return d;
  }

  function vitesses(x, z, cap, ligne, n) {
    const px = new Float64Array(n), pz = new Float64Array(n), v = new Float64Array(n);
    for (let i = 0; i < n; i++) { px[i] = x[i] - Math.sin(cap[i]) * ligne[i]; pz[i] = z[i] + Math.cos(cap[i]) * ligne[i]; }
    const MU = 1.55, AERO = .00155, VMAX = 86, H = 3;
    for (let i = 0; i < n; i++) {
      const a = (i - H + n) % n, b = (i + H) % n;
      const a1 = Math.atan2(pz[i] - pz[a], px[i] - px[a]), a2 = Math.atan2(pz[b] - pz[i], px[b] - px[i]);
      const ds = (Math.hypot(pz[i] - pz[a], px[i] - px[a]) + Math.hypot(pz[b] - pz[i], px[b] - px[i])) / 2;
      const k = Math.abs(angle(a2 - a1)) / Math.max(ds, .5);
      const den = k - MU * AERO;
      v[i] = den <= 0 ? VMAX : Math.min(VMAX, Math.sqrt(MU * 9.81 / den));
    }
    for (let j = 2 * n - 1; j >= 0; j--) { const i = j % n, s = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[s] * v[s] + 2 * 16 * PAS)); }
    // poussée à fond de la monoplace (enveloppe des six rapports mesurée sur conduite.js, boîte auto)
    const poussee = u => Math.max(.05, Math.min(12, 15.59 - .2592 * u + .000899 * u * u));
    for (let j = 1; j <= 2 * n; j++) { const i = j % n, p = (i - 1 + n) % n; v[i] = Math.min(v[i], Math.sqrt(v[p] * v[p] + 2 * poussee(v[p]) * PAS)); }
    return v;
  }

  // Limites latérales : glissières à 20 m, rapprochées à l'intérieur des virages serrés (repère valable : 1 − κd > 0,3).
  function limites(courbure, n, largeur) {
    const G = new Float32Array(n), D = new Float32Array(n), F = Math.round(36 / PAS);
    for (let i = 0; i < n; i++) {
      let g = LIMITE, d = LIMITE;
      for (let j = -F; j <= F; j++) {
        const k = courbure[(i + j + n) % n];
        if (k > 1e-6) d = Math.min(d, .62 / k - 2); else if (k < -1e-6) g = Math.min(g, .62 / -k - 2);
      }
      G[i] = Math.max(largeur / 2 + 3.2, g); D[i] = Math.max(largeur / 2 + 3.2, d);
    }
    return { G, D };
  }

  // ---------------------------------------------------------------- création
  function creer(graine, options = {}) {
    if (options.partition) return creerPartition(graine, options);
    const theme = options.theme || 'foret', vise = options.longueur || 4500, nom = options.nom || 'Circuit ' + graine;
    for (let essai = 0; essai < 400; essai++) {
      const r = alea((graine >>> 0) * 2654435761 + essai * 40503);
      let echelle = vise / (2 * Math.PI) * 1.02, trace = null;
      for (let ajustement = 0; ajustement < 4; ajustement++) {
        const rr = alea((graine >>> 0) * 2654435761 + essai * 40503 + 7);
        const pts = polygone(rr, echelle), segs = arrondir(pts, rr);
        if (!segs) { trace = null; break; }
        const L = segs.reduce((s, g) => s + g.longueur, 0);
        trace = segs;
        if (Math.abs(L / vise - 1) < .03) break;
        echelle *= vise / L;
      }
      if (!trace) continue;
      const { x, z, n } = echantillonner(trace);
      const L = n * PAS;
      if (Math.abs(L / vise - 1) > .08) continue;
      let { cap, courbure } = capsEtCourbures(x, z, n);
      let kmax = 0;
      for (let i = 0; i < n; i++) kmax = Math.max(kmax, Math.abs(courbure[i]));
      if (kmax > 1 / 24) continue;
      const droite = plusLongueDroite(courbure, n);
      if (droite.longueur < 450) continue;
      if (nombreVirages(courbure, n, 1 / 70) < 3) continue;
      if (separation(x, z, n) < 60) continue;
      // le départ à 35 % de la plus longue ligne droite : l'échantillon 0 devient la ligne
      const decalage = (droite.debut + Math.round(droite.longueur * .35 / PAS)) % n;
      const X = tourner(x, decalage), Z = tourner(z, decalage);
      ({ cap, courbure } = capsEtCourbures(X, Z, n));
      const debutDroite = -Math.round(droite.longueur * .35 / PAS) * PAS, finDroite = debutDroite + droite.longueur;
      // fenêtre de la ligne droite (1 sur la droite, raccord doux sur 120 m)
      const plat = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let s = i * PAS; if (s > L / 2) s -= L;
        const dehors = Math.max(debutDroite - s, s - finDroite, 0);
        plat[i] = 1 - lisse(0, 120, dehors);
      }
      const { y, pente } = relief(n, L, theme, r, plat);
      const devBrut = new Float64Array(n);
      for (let i = 0; i < n; i++) devBrut[i] = borner(courbure[i] * 1.6, -.045, .045);
      const devers = moyenneCirculaire(devBrut, 10);
      for (let i = 0; i < n; i++) devers[i] *= 1 - plat[i];
      const vibreur = new Uint8Array(n), V = Math.round(15 / PAS);
      for (let i = 0; i < n; i++) if (Math.abs(courbure[i]) > 1 / 140) for (let j = -V; j <= V; j++) vibreur[(i + j + n) % n] = 3;
      const ligne = trajectoire(X, Z, cap, n, LARGEUR);
      const vitesse = vitesses(X, Z, cap, ligne, n);
      const lim = limites(courbure, n, LARGEUR);
      // Tunnel (David, 16/11 : « dans le circuit Haut-Col, fais une partie dans un tunnel ») : en montagne, 260 m de
      // piste passent sous la roche, au milieu de la plus longue portion droite (rayon > 400 m), loin de la ligne des
      // stands. Le seuil écarte les courbures de l'ordre de 1e-15 dont le signe change d'un moteur JavaScript à l'autre :
      // le tunnel est au même endroit sur toutes les machines (jeu en ligne). Ses murs sont les limites ; 40 m avant et
      // après, les limites se resserrent en entonnoir jusqu'aux portails.
      let tunnel = null;
      if (theme === 'montagne' && options.tunnel !== false) {
        const N = Math.round(260 / PAS), i0 = choisirTunnel(courbure, n, N);
        if (i0 >= 0) {
          const mur = LARGEUR / 2 + 1.6, E = Math.round(40 / PAS);
          tunnel = { debut: i0 * PAS, fin: (i0 + N) * PAS, mur, hauteur: 6.4 };
          for (let i = i0 - E; i <= i0 + N + E; i++) {
            const dehors = Math.max(i0 - i, i - i0 - N, 0) * PAS, k = (i + n) % n;
            lim.G[k] = Math.min(lim.G[k], mur + dehors * .35); lim.D[k] = Math.min(lim.D[k], mur + dehors * .35);
          }
        }
      }
      // Stands (lot 4) : une voie le long du bord droit de la ligne droite principale, sous le bâtiment des stands
      // que dessine decor.js (même côté, même emprise). Elle est prise sur la chaussée elle-même : on y entre en
      // serrant à droite, sans avoir à franchir une glissière. `garage` est la zone d'arrêt où le service se fait.
      const av = Math.max(-300, debutDroite + 40), ap = Math.min(260, finDroite - 60);
      // La voie commence APRÈS la ligne : la grille est derrière, et une voiture qui rampe à l'arrêt du départ ne
      // doit pas se retrouver aux stands sans l'avoir voulu.
      const s0 = Math.max(av + 30, 30), g0 = s0 + 40, g1 = g0 + 48, s1 = ap - 20;
      const stands = (s1 - s0 > 140 && g1 + 20 < s1) ? {
        cote: 1, d: LARGEUR / 2 - 1.6, demi: 1.6,        // voie de 3,2 m collée au bord droit
        debut: s0, fin: s1, garage0: g0, garage1: g1,
        vitesse: 11,                                      // m/s : 40 km/h, au-delà le service n'est pas rendu
      } : null;
      return {
        graine, nom, theme, longueur: L, pas: PAS, n,
        x: X, y, z: Z, cap, courbure, pente, devers, largeur: LARGEUR, vibreur, ligne, vitesse,
        limite: LIMITE, limiteG: lim.G, limiteD: lim.D,
        depart: 0, ligneDroite: { debut: debutDroite, fin: finDroite }, secteurs: [Math.round(L / 3 / PAS) * PAS, Math.round(2 * L / 3 / PAS) * PAS], tunnel, stands,
        essais: essai + 1
      };
    }
    throw new Error('BITUME : aucun tracé valide pour la graine ' + graine);
  }

  // Premier échantillon du tunnel (N échantillons) : au milieu de la plus longue portion droite (rayon > 400 m) entre 30 et
  // 92 % du tour ; −1 s'il n'y en a pas d'assez longue.
  function choisirTunnel(courbure, n, N) {
    const i1 = Math.round(.3 * n), i2 = Math.round(.92 * n), droit = i => Math.abs(courbure[i]) < 1 / 400;
    let meilleur = null;
    for (let i = i1; i < i2;) {
      if (!droit(i)) { i++; continue; }
      let j = i;
      while (j < i2 && droit(j)) j++;
      if (j - i >= N && (!meilleur || j - i > meilleur.long)) meilleur = { debut: i, long: j - i };
      i = j;
    }
    return meilleur ? meilleur.debut + Math.floor((meilleur.long - N) / 2) : -1;
  }

  // ---------------------------------------------------------------- génération 3 : tracé dirigé par une partition
  // Lot 22F (David, 18/11/2026 : « fais des circuit pour tous, très mémorable et impressionnant dans leur conception
  // avec des lieux vraiment exceptionnels quelque soit le biome »). Le polygone étoilé ci-dessus ne sait pas poser un
  // lieu ; ici un circuit est écrit comme une partition (src/partitions.js), une suite de séquences typées (droite,
  // courbe à rayon et angle donnés) qui portent chacune leur pente, leur dévers, leurs limites, un passage couvert,
  // un pont, un bord dangereux ou un lieu. Le tracé est intégré exactement (courbure linéaire dans les raccords, qui
  // préservent l'angle total), refermé en cap par une courbe désignée et en position par deux droites désignées
  // (système linéaire 2 × 2, exact puisque le cap d'une droite est constant), puis le profil en long est posé en
  // paliers de pente reliés par des raccords paraboliques dont la longueur vient de la vitesse et de la charge
  // verticale admise (crête : 0,4 g ; creux : 0,7 g). Prototype de l'étude (tools/lieux-trace.mjs) rangé ici sans
  // réécriture ; les outils de l'étude lisent ce code-ci (B.circuit.trace). Les aides communes (trajectoire,
  // moyenneCirculaire, limites, nombreVirages) sont celles du générateur ci-dessus.
  // Aucun hasard, aucun seuil au ras d'un arrondi : les mêmes nombres sortent sur toutes les machines (jeu en ligne ;
  // verifications/route-des-cimes.test.mjs perturbe les sinus d'un ulp et retrouve le même tracé).
  const G = 9.81, RAD = Math.PI / 180;

  // ---------------------------------------------------------------- séquences
  // Une séquence : { t: 'D', l } ou { t: 'C', r, a } (a en degrés, > 0 = virage à droite, le cap croît).
  // Options : p (pente en %, ou 'a' = palier ajusté pour refermer le profil), dv (dévers imposé en degrés,
  // > 0 = côté droit plus bas), lg / ld (limite gauche / droite imposée, m depuis l'axe), vib (false : pas de
  // vibreurs), stands, couvert { type, nom }, pont { type, nom }, bord ({ cote: 'G'|'D', type, nom } ou liste),
  // croise (nom d'un croisement déclaré), lieu (numéro), ajuste (droite que la fermeture peut allonger).
  function longueurDe(q) { return q.t === 'D' ? q.l : q.r * Math.abs(q.a) * RAD; }
  function courbureDe(q) { return q.t === 'D' ? 0 : Math.sign(q.a) / q.r; }

  // Raccords de courbure : rampe linéaire centrée sur la jonction (clothoïde), plus longue pour un plus grand
  // saut de courbure, jamais plus de 45 % de chacune des deux séquences voisines.
  function raccordsPlan(seq) {
    const N = seq.length, T = new Float64Array(N);   // T[m] : raccord entre m - 1 et m
    for (let m = 0; m < N; m++) {
      const a = seq[(m - 1 + N) % N], b = seq[m], dk = Math.abs(b.k - a.k);
      T[m] = dk < 1e-9 ? 0 : Math.min(borner(26 + 520 * dk, 24, 48), .9 * Math.min(a.L, b.L));
    }
    return T;
  }

  // Valeur par morceaux avec raccords linéaires centrés : v[m] sur la séquence m, T[m] le raccord à son début.
  function fonctionRaccordee(seq, v, T) {
    const N = seq.length, B = new Float64Array(N + 1);
    for (let m = 0; m < N; m++) B[m + 1] = B[m] + seq[m].L;
    const S = B[N];
    let m = 0;
    // lecture monotone (s croissant) : l'index de séquence avance sans recherche
    return function (s) {
      if (s < B[m]) m = 0;
      while (m < N - 1 && s >= B[m + 1]) m++;
      const debut = B[m], fin = B[m + 1], Ta = T[m] / 2, Tb = T[(m + 1) % N] / 2;
      const prec = v[(m - 1 + N) % N], suiv = v[(m + 1) % N], ici = v[m];
      // (Ta, Tb nuls : pas de raccord ; s peut dépasser la fin du tour d'un epsilon d'arrondi)
      if (Ta > 0 && s < debut + Ta) return prec + (ici - prec) * (s - (debut - Ta)) / (2 * Ta);
      if (Tb > 0 && s > fin - Tb) return ici + (suiv - ici) * Math.min(1, (s - (fin - Tb)) / (2 * Tb));
      return ici;
    };
  }

  // Intègre le plan au pas fin h ; rend positions et caps aux abscisses j·h.
  function integrerPlan(seq, T, cap0) {
    const N = seq.length, S = seq.reduce((a, q) => a + q.L, 0);
    const nf = Math.ceil(S / .5), h = S / nf, k = fonctionRaccordee(seq, seq.map(q => q.k), T);
    const X = new Float64Array(nf + 1), Z = new Float64Array(nf + 1), A = new Float64Array(nf + 1), K = new Float64Array(nf + 1);
    A[0] = cap0; K[0] = k(0);
    for (let j = 0; j < nf; j++) {
      const s = j * h, k0 = K[j], k1 = k(s + h / 2), k2 = k(s + h);
      const am = A[j] + h / 2 * (k0 + k1) / 2, a2 = A[j] + h * (k0 + 4 * k1 + k2) / 6;
      X[j + 1] = X[j] + h * (Math.cos(A[j]) + 4 * Math.cos(am) + Math.cos(a2)) / 6;
      Z[j + 1] = Z[j] + h * (Math.sin(A[j]) + 4 * Math.sin(am) + Math.sin(a2)) / 6;
      A[j + 1] = a2; K[j + 1] = k2;
    }
    return { X, Z, A, K, nf, h, S };
  }

  // Fermeture : cap total imposé (± 360° × tours) par la courbe désignée, puis position par deux droites
  // désignées. Allonger une droite de δ décale tout ce qui suit de δ·(cos θ, sin θ) : le système est linéaire.
  function fermer(partition) {
    const seq = partition.seq.map(q => ({ ...q }));
    const total = seq.reduce((a, q) => a + (q.t === 'C' ? q.a : 0), 0);
    const vise = 360 * (partition.tours || 1) * Math.sign(total);
    const ic = seq.findIndex(q => q.ajusteCap);
    if (ic < 0) throw new Error(partition.id + ' : aucune courbe ajusteCap');
    seq[ic].a += vise - total;
    if (Math.sign(seq[ic].a) !== Math.sign(partition.seq[ic].a)) throw new Error(partition.id + ' : la courbe ajusteCap change de sens');
    // Groupes de droites ajustables : `ajuste: true` est un groupe à lui seul ; `ajuste: 'nom'` réunit plusieurs
    // droites à peu près parallèles qui se partagent l'allongement au prorata de leur longueur (aucune ne devient
    // démesurée). Direction d'un groupe : la moyenne de ses caps pondérée par les longueurs.
    const groupes = new Map();
    seq.forEach((q, i) => { if (q.t === 'D' && q.ajuste) { const cle = q.ajuste === true ? '#' + i : q.ajuste; if (!groupes.has(cle)) groupes.set(cle, []); groupes.get(cle).push(i); } });
    const listes = [...groupes.values()];
    for (let tour = 0; tour < 8; tour++) {
      for (const q of seq) { q.L = longueurDe(q); q.k = courbureDe(q); }
      const T = raccordsPlan(seq), P = integrerPlan(seq, T, 0);
      const rx = P.X[P.nf], rz = P.Z[P.nf];
      if (Math.hypot(rx, rz) < 1e-6) break;
      const B = [0]; for (const q of seq) B.push(B[B.length - 1] + q.L);
      const capMilieu = i => P.A[Math.round((B[i] + seq[i].L / 2) / P.h)];
      const dir = g => { const tot = g.reduce((t, i) => t + partition.seq[i].l, 0); let ux = 0, uz = 0; for (const i of g) { const w = partition.seq[i].l / tot; ux += w * Math.cos(capMilieu(i)); uz += w * Math.sin(capMilieu(i)); } return { ux, uz, tot }; };
      let choix = null;
      for (let u = 0; u < listes.length; u++) for (let v = u + 1; v < listes.length; v++) {
        const A = dir(listes[u]), Bd = dir(listes[v]), det = A.ux * Bd.uz - A.uz * Bd.ux;
        if (Math.abs(det) < .35) continue;
        const da = (-rx * Bd.uz + rz * Bd.ux) / det, db = (rx * A.uz - rz * A.ux) / det;
        const ok = (g, d, tot) => g.every(i => seq[i].l + d * partition.seq[i].l / tot >= 40);
        if (!ok(listes[u], da, A.tot) || !ok(listes[v], db, Bd.tot)) continue;
        const cout = Math.max(Math.abs(da) / A.tot, Math.abs(db) / Bd.tot);
        if (!choix || cout < choix.cout) choix = { u, v, da, db, ta: A.tot, tb: Bd.tot, cout };
      }
      if (!choix) throw new Error(partition.id + ' : fermeture impossible avec les droites ajustables (résidu ' + Math.hypot(rx, rz).toFixed(1) + ' m)');
      for (const i of listes[choix.u]) seq[i].l += choix.da * partition.seq[i].l / choix.ta;
      for (const i of listes[choix.v]) seq[i].l += choix.db * partition.seq[i].l / choix.tb;
    }
    for (const q of seq) { q.L = longueurDe(q); q.k = courbureDe(q); }
    const T = raccordsPlan(seq), P = integrerPlan(seq, T, 0);
    return { seq, T, P, angleAjuste: seq[ic].a - partition.seq[ic].a,
      allongements: seq.map((q, i) => q.t === 'D' ? q.l - partition.seq[i].l : 0) };
  }

  const poussee = u => Math.max(.05, Math.min(12, 15.59 - .2592 * u + .000899 * u * u));
  function courbureLigne(x, z, cap, ligne, n) {
    const px = new Float64Array(n), pz = new Float64Array(n), k = new Float64Array(n), H = 3;
    for (let i = 0; i < n; i++) { px[i] = x[i] - Math.sin(cap[i]) * ligne[i]; pz[i] = z[i] + Math.cos(cap[i]) * ligne[i]; }
    for (let i = 0; i < n; i++) {
      const a = (i - H + n) % n, b = (i + H) % n;
      const a1 = Math.atan2(pz[i] - pz[a], px[i] - px[a]), a2 = Math.atan2(pz[b] - pz[i], px[b] - px[i]);
      const ds = (Math.hypot(pz[i] - pz[a], px[i] - px[a]) + Math.hypot(pz[b] - pz[i], px[b] - px[i])) / 2;
      k[i] = angle(a2 - a1) / Math.max(ds, .5);
    }
    return k;
  }
  // Vitesse de référence du jeu actuel (p9) : plat, freinage constant de 16 m/s², poussée sans pente.
  function vitessesP9(kl, n) {
    const MU = 1.55, AERO = .00155, VMAX = 86, v = new Float64Array(n);
    for (let i = 0; i < n; i++) { const den = Math.abs(kl[i]) - MU * AERO; v[i] = den <= 0 ? VMAX : Math.min(VMAX, Math.sqrt(MU * G / den)); }
    for (let j = 2 * n - 1; j >= 0; j--) { const i = j % n, s = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[s] * v[s] + 2 * 16 * PAS)); }
    for (let j = 1; j <= 2 * n; j++) { const i = j % n, p = (i - 1 + n) % n; v[i] = Math.min(v[i], Math.sqrt(v[p] * v[p] + 2 * poussee(v[p]) * PAS)); }
    return v;
  }
  // Proposition p10 (exigence pour le lot physique) : charge normale g·cos θ·cos β + appui + v²·κv (crête :
  // κv < 0, la voiture s'allège ; creux : elle s'écrase), dévers qui aide ou qui gêne, garde au décollage
  // (au moins 10 % de charge sur une crête), freinage et poussée corrigés de la gravité le long de la pente.
  function vitessesP10(kl, pente, devers, kv, n) {
    const MU = 1.55, AERO = .00155, VMAX = 86, v = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const c = 1 / Math.sqrt(1 + pente[i] * pente[i]), sgn = Math.sign(kl[i]) || 1;
      const den = Math.abs(kl[i]) - MU * AERO - MU * kv[i];
      const num = MU * G * c * Math.cos(devers[i]) + G * Math.sin(devers[i]) * sgn;
      let vi = den <= 0 ? VMAX : Math.min(VMAX, Math.sqrt(Math.max(1, num) / den));
      if (kv[i] < -1e-6) vi = Math.min(vi, Math.sqrt(.9 * G * c / -kv[i]));
      v[i] = vi;
    }
    const sinus = p => p / Math.sqrt(1 + p * p);
    for (let j = 2 * n - 1; j >= 0; j--) {
      const i = j % n, s = (i + 1) % n, c = 1 / Math.sqrt(1 + pente[i] * pente[i]);
      const dec = Math.max(2, 16 * c + G * sinus(pente[i]));
      v[i] = Math.min(v[i], Math.sqrt(v[s] * v[s] + 2 * dec * PAS));
    }
    for (let j = 1; j <= 2 * n; j++) {
      const i = j % n, p = (i - 1 + n) % n, acc = poussee(v[p]) - G * sinus(pente[p]);
      v[i] = Math.min(v[i], Math.sqrt(Math.max(36, v[p] * v[p] + 2 * acc * PAS)));
    }
    return v;
  }
  // ---------------------------------------------------------------- construction complète
  function construirePartition(partition, options = {}) {
    const { seq, T: Tplan, P, angleAjuste, allongements } = fermer(partition);
    const S = P.S, n = Math.round(S / PAS), ds = S / n, w = LARGEUR / 2;
    const B = [0]; for (const q of seq) B.push(B[B.length - 1] + q.L);
    // rééchantillonnage au pas du jeu (≈ 2 m), résidu de fermeture réparti linéairement (de l'ordre du micron)
    const x = new Float64Array(n), z = new Float64Array(n), cap = new Float64Array(n), courbure = new Float64Array(n);
    const seqDe = new Uint16Array(n), ex = P.X[P.nf] - P.X[0], ez = P.Z[P.nf] - P.Z[0];
    const ea = P.A[P.nf] - P.A[0] - 2 * Math.PI * (partition.tours || 1) * Math.sign(P.A[P.nf] - P.A[0]);
    let m = 0;
    for (let i = 0; i < n; i++) {
      const s = i * ds, f = s / P.h, j = Math.min(P.nf - 1, Math.floor(f)), t = f - j, u = s / S;
      x[i] = P.X[j] + (P.X[j + 1] - P.X[j]) * t - ex * u;
      z[i] = P.Z[j] + (P.Z[j + 1] - P.Z[j]) * t - ez * u;
      cap[i] = angle(P.A[j] + (P.A[j + 1] - P.A[j]) * t - ea * u);
      courbure[i] = P.K[j] + (P.K[j + 1] - P.K[j]) * t;
      while (m < seq.length - 1 && s >= B[m + 1]) m++;
      seqDe[i] = m;
    }
    const iDe = s => ((Math.round(s / ds) % n) + n) % n;

    // ---- profil en long : paliers de pente et raccords paraboliques, deux passes avec la vitesse p10
    const auto = seq.map(q => q.p === 'a');
    const sommeFixe = seq.reduce((a, q, k) => a + (auto[k] ? 0 : (q.p || 0) / 100 * q.L), 0);
    const longueurAuto = seq.reduce((a, q, k) => a + (auto[k] ? q.L : 0), 0);
    if (!longueurAuto) throw new Error(partition.id + " : aucun palier de pente 'a' pour refermer le profil");
    const penteAuto = -sommeFixe / longueurAuto;
    const paliers = seq.map((q, k) => auto[k] ? penteAuto : (q.p || 0) / 100);
    let y = new Float64Array(n), pente = new Float64Array(n), kv = new Float64Array(n), vitesse = null, vitesse9 = null;
    let devers = new Float64Array(n), ligne = null, kl = null;
    const N = seq.length;
    const vitesseJonction = new Float64Array(N).fill(30);
    // dévers : automatique comme le jeu (borné à ± 2,6°), imposé par séquence, nul aux stands et sous couvert
    const devBrut = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const q = seq[seqDe[i]];
      devBrut[i] = q.dv != null ? q.dv * RAD : (q.stands || q.couvert) ? 0 : borner(courbure[i] * 1.6, -.045, .045);
    }
    devers = moyenneCirculaire(devBrut, 10);
    ligne = trajectoire(x, z, cap, n, LARGEUR);
    kl = courbureLigne(x, z, cap, ligne, n);
    vitesse9 = vitessesP9(kl, n);
    // vitesse de dimensionnement d'un raccord : la plus haute (p9 ou p10) à ± 40 m de la jonction. Prendre la
    // vitesse p10 à la jonction même tournerait en rond : la garde de crête l'abaisse justement là.
    const vitesseAutour = (s0, ...series) => {
      let v = 0;
      for (let d = -40; d <= 40; d += ds) { const i = iDe(s0 + d); for (const t of series) v = Math.max(v, t[i]); }
      return v;
    };
    for (let k = 0; k < N; k++) vitesseJonction[k] = vitesseAutour(B[k], vitesse9);
    let Tv = new Float64Array(N);
    for (let passe = 0; passe < 3; passe++) {
      for (let k = 0; k < N; k++) {
        const a = paliers[(k - 1 + N) % N], b = paliers[k], dp = b - a, v = vitesseJonction[k];
        const alpha = dp < 0 ? .4 : .7;   // crête : allègement ≤ 0,4 g ; creux : écrasement ≤ 0,7 g
        Tv[k] = Math.abs(dp) < 1e-6 ? 0 : Math.min(Math.max(60, Math.abs(dp) * v * v / (alpha * G)), .9 * Math.min(seq[(k - 1 + N) % N].L, seq[k].L));
      }
      const p = fonctionRaccordee(seq, paliers, Tv);
      for (let i = 0; i < n; i++) pente[i] = p(i * ds);
      y = new Float64Array(n);
      for (let i = 1; i < n; i++) y[i] = y[i - 1] + (pente[i - 1] + pente[i]) / 2 * ds;
      const ey = y[n - 1] + (pente[n - 1] + pente[0]) / 2 * ds;
      for (let i = 0; i < n; i++) y[i] -= ey * i / n;
      for (let i = 0; i < n; i++) {
        const dp = (pente[(i + 1) % n] - pente[(i - 1 + n) % n]) / (2 * ds);
        kv[i] = dp / Math.pow(1 + pente[i] * pente[i], 1.5);
      }
      vitesse = vitessesP10(kl, pente, devers, kv, n);
      for (let k = 0; k < N; k++) vitesseJonction[k] = vitesseAutour(B[k], vitesse9, vitesse);
    }

    // ---- rampes déclarées (`rampe: { nom }`) : là seulement la pente peut passer le plafond du thème. Une rampe
    // commence et finit au milieu de ses raccords verticaux d'entrée et de sortie, où la pente passe d'un palier à
    // l'autre ; `penteMax` est le plus raide de ses paliers.
    const rampes = [];
    for (let k = 0; k < N; k++) {
      const r = seq[k].rampe;
      if (!r || (k > 0 && seq[k - 1].rampe && seq[k - 1].rampe.nom === r.nom)) continue;
      let j = k, penteMax = Math.abs(paliers[k]);
      while (j + 1 < N && seq[j + 1].rampe && seq[j + 1].rampe.nom === r.nom) penteMax = Math.max(penteMax, Math.abs(paliers[++j]));
      rampes.push({ nom: r.nom, debut: B[k] - Tv[k] / 2, fin: B[j + 1] + Tv[(j + 1) % N] / 2, penteMax });
    }

    // ---- limites : automatiques comme le jeu, puis imposées par séquence (couverts, ponts, bords dangereux),
    // resserrées en entonnoir (pente latérale ≤ 0,35) pour qu'une glissière ne saute jamais.
    const lim = limites(courbure, n, LARGEUR), MUR = w + 1.6, PARAPET = w + 1.5;
    const imposeG = new Float32Array(n).fill(Infinity), imposeD = new Float32Array(n).fill(Infinity);
    for (let i = 0; i < n; i++) {
      const q = seq[seqDe[i]];
      let g = q.lg != null ? q.lg : Infinity, d = q.ld != null ? q.ld : Infinity;
      if (q.couvert) { g = Math.min(g, MUR); d = Math.min(d, MUR); }
      if (q.pont) { g = Math.min(g, PARAPET); d = Math.min(d, PARAPET); }
      for (const b of [].concat(q.bord || [])) {
        const v = b.type === 'vide' ? w + 1.4 : b.type === 'muret' ? w + 1.0 : b.type === 'fosse' ? w + 2.5 : Infinity;
        if (b.cote === 'G') g = Math.min(g, v); else d = Math.min(d, v);
      }
      imposeG[i] = g; imposeD[i] = d;
    }
    for (const [L, I] of [[lim.G, imposeG], [lim.D, imposeD]]) {
      for (let i = 0; i < n; i++) if (I[i] < L[i]) L[i] = I[i];
      for (let t = 0; t < 2; t++) {
        for (let j = 1; j <= 2 * n; j++) { const i = j % n, p = (i - 1 + n) % n; L[i] = Math.min(L[i], L[p] + .35 * ds); }
        for (let j = 2 * n - 1; j >= 0; j--) { const i = j % n, s = (i + 1) % n; L[i] = Math.min(L[i], L[s] + .35 * ds); }
      }
      for (let i = 0; i < n; i++) L[i] = Math.max(L[i], w + .9);
    }

    // ---- vibreurs comme le jeu, sauf où la séquence les refuse (route de montagne, corniche, pont, couvert)
    const vibreur = new Uint8Array(n), V = Math.round(15 / PAS);
    for (let i = 0; i < n; i++) if (Math.abs(courbure[i]) > 1 / 140) for (let j = -V; j <= V; j++) {
      const k = (i + j + n) % n, q = seq[seqDe[k]];
      if (q.vib !== false && !q.couvert && !q.pont) vibreur[k] = 3;
    }

    // ---- éléments nommés : plages d'abscisses fusionnées par nom
    function plages(cle) {
      const sortie = [];
      for (let k = 0; k < N; k++) for (const e of [].concat(seq[k][cle] || [])) {
        const nom = e.nom || cle, der = sortie[sortie.length - 1];
        if (der && der.nom === nom && Math.abs(der.fin - B[k]) < 1e-6) der.fin = B[k + 1];
        else sortie.push({ ...e, nom, debut: B[k], fin: B[k + 1] });
      }
      return sortie;
    }
    const couverts = plages('couvert'), ponts = plages('pont'), bords = plages('bord');
    const lieux = (partition.lieux || []).map(l => {
      const ks = seq.map((q, k) => q.lieu === l.n ? k : -1).filter(k => k >= 0);
      return { ...l, debut: ks.length ? B[ks[0]] : 0, fin: ks.length ? B[ks[ks.length - 1] + 1] : 0 };
    });

    // ---- tunnel au sens du jeu actuel (un seul, c.tunnel) : le premier passage couvert de type tunnel
    const premierTunnel = couverts.find(t => t.type === 'tunnel');
    const tunnel = premierTunnel ? { debut: Math.round(premierTunnel.debut / PAS) * PAS, fin: Math.round(premierTunnel.fin / PAS) * PAS, mur: MUR, hauteur: 6.4 } : null;

    // ---- ligne droite des stands : la première et la dernière séquence (le départ est entre les deux)
    const debutDroite = -Math.round(seq[N - 1].L / PAS) * PAS, finDroite = Math.round(seq[0].L / PAS) * PAS;
    const av = Math.max(-300, debutDroite + 40), ap = Math.min(260, finDroite - 60);
    const s0 = Math.max(av + 30, 30), g0 = s0 + 40, g1 = g0 + 48, s1 = ap - 20;
    const stands = (s1 - s0 > 140 && g1 + 20 < s1) ? { cote: 1, d: LARGEUR / 2 - 1.6, demi: 1.6, debut: s0, fin: s1, garage0: g0, garage1: g1, vitesse: 11 } : null;

    const c = {
      graine: options.graine ?? partition.graine, nom: options.nom || partition.nom, theme: options.theme || partition.theme, longueur: n * PAS, pas: PAS, n,
      x, y, z, cap, courbure, pente, devers, largeur: LARGEUR, vibreur, ligne, vitesse: options.vitesse === 'p9' ? vitesse9 : vitesse,
      limite: LIMITE, limiteG: lim.G, limiteD: lim.D,
      depart: 0, ligneDroite: { debut: debutDroite, fin: finDroite }, secteurs: [Math.round(n / 3) * PAS, Math.round(2 * n / 3) * PAS],
      tunnel, stands, essais: 1,
      generation: 3, id: partition.id, lieux, couverts, ponts, bords, rampes, croisements: [], seqDe, sequences: seq.map((q, k) => ({ ...q, debut: B[k], fin: B[k + 1] })),
      vitesseP9: vitesse9, vitesseP10: vitesse, kv, pasReel: ds,
      fermeture: { angleAjuste, allongements },
    };
    c.mesures = options.mesures === false ? null : mesurerPartition(c);
    return c;
  }

  // ---------------------------------------------------------------- mesures et contrôles
  function mesurerPartition(c) {
    const n = c.n, ds = c.pasReel;
    let ymin = Infinity, ymax = -Infinity, pmax = -Infinity, pmin = Infinity, kmax = 0, droit = 0;
    let au10 = 0, au20 = 0, chargeMin = Infinity, chargeMax = -Infinity, chargeMinOu = 0, chargeMaxOu = 0, t9 = 0, t10 = 0;
    for (let i = 0; i < n; i++) {
      ymin = Math.min(ymin, c.y[i]); ymax = Math.max(ymax, c.y[i]);
      pmax = Math.max(pmax, c.pente[i]); pmin = Math.min(pmin, c.pente[i]); kmax = Math.max(kmax, Math.abs(c.courbure[i]));
      if (Math.abs(c.courbure[i]) < 1 / 900) droit++;
      if (Math.abs(c.pente[i]) >= .10) au10 += ds;
      if (Math.abs(c.pente[i]) >= .20) au20 += ds;
      const v = c.vitesseP10[i], cos = 1 / Math.sqrt(1 + c.pente[i] * c.pente[i]);
      const charge = cos + v * v * c.kv[i] / G;   // en g, sans l'appui aérodynamique
      if (charge < chargeMin) { chargeMin = charge; chargeMinOu = i * ds; }
      if (charge > chargeMax) { chargeMax = charge; chargeMaxOu = i * ds; }
      t9 += ds / c.vitesseP9[i]; t10 += ds / c.vitesseP10[i];
    }
    // séparation : plus petite distance en plan entre deux points à plus de 150 m le long du tour, hors des
    // croisements déclarés (deux séquences « croise » du même nom, au moins 8 m l'une au-dessus de l'autre)
    const ecart = Math.ceil(150 / ds);
    let sep = Infinity, ouSep = null, croisements = new Map();
    for (let i = 0; i < n; i += 2) for (let j = i + ecart; j < n; j += 2) {
      if (n - (j - i) < ecart) continue;
      const dx = c.x[i] - c.x[j], dz = c.z[i] - c.z[j], d = Math.hypot(dx, dz);
      if (d >= 60) continue;
      const qi = c.sequences[c.seqDe[i]], qj = c.sequences[c.seqDe[j]], dy = Math.abs(c.y[i] - c.y[j]);
      if (qi.croise && qi.croise === qj.croise && dy >= 8) {
        const e = croisements.get(qi.croise);
        if (!e || d < e.distance) croisements.set(qi.croise, { nom: qi.croise, distance: d, ecartVertical: dy, s1: i * ds, s2: j * ds, x: (c.x[i] + c.x[j]) / 2, z: (c.z[i] + c.z[j]) / 2 });
        continue;
      }
      if (d < sep) { sep = d; ouSep = [i * ds, j * ds]; }
    }
    c.croisements = [...croisements.values()];
    return {
      longueur: c.longueur, denivele: ymax - ymin, altitudeMin: ymin, altitudeMax: ymax,
      penteMax: pmax * 100, penteMin: pmin * 100, longueurAu10: au10, longueurAu20: au20,
      rayonMin: 1 / kmax, partDroite: droit / n, virages: nombreVirages(c.courbure, n, 1 / 70),
      separation: sep, separationOu: ouSep, chargeMin, chargeMinOu, chargeMax, chargeMaxOu, tourP9: t9, tourP10: t10,
      couverts: c.couverts.length, longueurCouverte: c.couverts.reduce((a, t) => a + t.fin - t.debut, 0), ponts: c.ponts.length, bords: c.bords.length,
    };
  }

  // Contrôles d'une partition construite : ce que le jeu et l'étude exigent.
  function controlerPartition(c, attentes = {}) {
    const pb = [], M = c.mesures || (c.mesures = mesurerPartition(c));
    const finis = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse'].every(k => c[k].length === c.n && c[k].every(Number.isFinite));
    if (!finis) pb.push('valeurs non finies');
    const fx = c.x[0] - c.x[c.n - 1], fz = c.z[0] - c.z[c.n - 1];
    if (Math.abs(Math.hypot(fx, fz) - c.pasReel) > .05) pb.push('boucle mal refermée (' + Math.hypot(fx, fz).toFixed(3) + ' m)');
    const saut = c.y[0] - (c.y[c.n - 1] + (c.pente[c.n - 1] + c.pente[0]) / 2 * c.pasReel);
    if (Math.abs(saut) > .05) pb.push('profil mal refermé (' + saut.toFixed(3) + ' m)');
    if (M.rayonMin < 24) pb.push('rayon minimal inférieur à 24 m');
    if (M.separation < 60) pb.push('deux portions à ' + M.separation.toFixed(1) + ' m (s = ' + M.separationOu.map(v => v.toFixed(0)).join(' / ') + ')');
    if (attentes.penteMax != null && M.penteMax > attentes.penteMax + .01) pb.push('pente ' + M.penteMax.toFixed(1) + ' % > ' + attentes.penteMax + ' %');
    // règle validée : une crête n'allège pas de plus de 0,4 g ; le prototype tolère 0,5 g là où une séquence courte
    // borne le raccord, et le signale au-delà
    if (M.chargeMin < .5) pb.push('crête trop vive : charge ' + M.chargeMin.toFixed(2) + ' g');
    for (const t of c.couverts) if (t.type === 'tunnel' && t.fin - t.debut < 60) pb.push('tunnel ' + t.nom + ' trop court');
    if (!c.stands) pb.push('pas de place pour les stands');
    return pb;
  }

  // Esquisse sans fermeture en position : pour écrire une partition, voir où le tour arrive et d'où partent les
  // séquences (point, cap) avant de choisir les droites qui refermeront la boucle.
  function esquissePartition(partition) {
    const seq = partition.seq.map(q => ({ ...q, L: longueurDe(q), k: courbureDe(q) }));
    const T = raccordsPlan(seq), P = integrerPlan(seq, T, 0), B = [0];
    for (const q of seq) B.push(B[B.length - 1] + q.L);
    const departs = seq.map((q, k) => { const j = Math.round(B[k] / P.h); return { k, x: P.X[j], z: P.Z[j], cap: P.A[j] / RAD }; });
    return { P, B, seq, departs, fin: [P.X[P.nf], P.Z[P.nf]], capFin: P.A[P.nf] / RAD, longueur: P.S };
  }


  // Circuit dessiné du catalogue : `options.partition` est une partition ou son nom dans B.partitions
  // (src/partitions.js) ; graine, nom et thème viennent du catalogue. Les mesures de l'étude (charges, croisements)
  // ne servent qu'aux outils : le jeu ne les calcule pas. `separation` (plus petit écart en plan entre deux portions
  // à plus de 150 m l'une de l'autre le long du tour) règle l'épaisseur des traits du plan de l'affichage.
  // Vitesse de référence des rivaux : p9, celle de la conduite actuelle (conduite.js : la charge des roues ne dépend
  // ni de la pente ni de la courbure verticale). p10 compte l'appui d'un creux : à la sortie de la Scierie, au pied
  // du Mur, elle visait 10 km/h de plus que ce que la voiture tient (13 sorties en 5 courses, contre 2 avec p9,
  // toutes deux juste après un contact). p10 reste dans c.vitesseP10 pour une conduite qui compterait la charge.
  function creerPartition(graine, options) {
    const p = typeof options.partition === 'string' ? (B.partitions || {})[options.partition] : options.partition;
    if (!p || !p.seq) throw new Error('BITUME : partition inconnue « ' + options.partition + ' »');
    const c = construirePartition(p, { mesures: false, graine, nom: options.nom, theme: options.theme, vitesse: options.vitesse || 'p9' });
    c.separation = separation(c.x, c.z, c.n);
    return c;
  }
  const TRACE = { construire: construirePartition, controler: controlerPartition, mesurer: mesurerPartition, fermer, esquisse: esquissePartition, PAS, LARGEUR };

  // ---------------------------------------------------------------- lecture
  // dans le tunnel (marge en mètres de part et d'autre) ?
  function dansTunnel(c, s, marge = 0) {
    const t = c && c.tunnel;
    if (!t) return false;
    const L = c.longueur, x = ((s % L) + L) % L;
    return x > t.debut - marge && x < t.fin + marge;
  }
  const ramener = (c, s) => { const L = c.longueur; s %= L; return s < 0 ? s + L : s; };
  // `sortie`, facultatif : objet de l'appelant, rempli et rendu au lieu d'un objet neuf. Le pas de simulation lit
  // le tracé des dizaines de fois par voiture et par pas ; sans objet à remplir, chaque lecture est un objet jeté.
  // Les nombres sont les mêmes au bit près dans les deux cas (mêmes opérations, même ordre).
  function echantillon(c, s, sortie) {
    s = ramener(c, s);
    const f = s / PAS, i = Math.floor(f) % c.n, j = (i + 1) % c.n, t = f - Math.floor(f);
    const X = c.x, Y = c.y, Z = c.z, K = c.courbure, Pe = c.pente, D = c.devers, Li = c.ligne, V = c.vitesse;
    const x = X[i] + (X[j] - X[i]) * t, y = Y[i] + (Y[j] - Y[i]) * t, z = Z[i] + (Z[j] - Z[i]) * t;
    const cap = c.cap[i] + angle(c.cap[j] - c.cap[i]) * t, courbure = K[i] + (K[j] - K[i]) * t;
    const pente = Pe[i] + (Pe[j] - Pe[i]) * t, devers = D[i] + (D[j] - D[i]) * t;
    const ligne = Li[i] + (Li[j] - Li[i]) * t, vitesse = V[i] + (V[j] - V[i]) * t;
    if (!sortie) return { x, y, z, cap, courbure, pente, devers, ligne, vitesse };
    sortie.x = x; sortie.y = y; sortie.z = z; sortie.cap = cap; sortie.courbure = courbure;
    sortie.pente = pente; sortie.devers = devers; sortie.ligne = ligne; sortie.vitesse = vitesse;
    return sortie;
  }
  function point(c, s, d, h = 0) {
    const e = echantillon(c, s), sa = Math.sin(e.cap), ca = Math.cos(e.cap), sd = Math.sin(e.devers), cd = Math.cos(e.devers);
    // normale de la chaussée : verticale inclinée par le dévers (côté droit plus bas si dévers > 0)
    const n = [-sd * sa, cd, sd * ca];
    return [e.x - sa * d + n[0] * h, e.y - d * sd + n[1] * h, e.z + ca * d + n[2] * h];
  }
  function repere(c, s) {
    const e = echantillon(c, s), sa = Math.sin(e.cap), ca = Math.cos(e.cap), sd = Math.sin(e.devers), cd = Math.cos(e.devers);
    const lp = Math.hypot(1, e.pente);
    let t = [ca / lp, e.pente / lp, sa / lp];
    let r = [-sa * cd, -sd, ca * cd];
    // r orthogonal à t, puis n = r × t (vers le haut)
    const p = r[0] * t[0] + r[1] * t[1] + r[2] * t[2];
    r = [r[0] - p * t[0], r[1] - p * t[1], r[2] - p * t[2]];
    const lr = Math.hypot(r[0], r[1], r[2]); r = r.map(v => v / lr);
    const n = [r[1] * t[2] - r[2] * t[1], r[2] * t[0] - r[0] * t[2], r[0] * t[1] - r[1] * t[0]];
    return { t, r, n };
  }
  function ecart(c, s1, s2) {
    const L = c.longueur;
    let d = (s2 - s1) % L;
    if (d < -L / 2) d += L; else if (d >= L / 2) d -= L;
    return d;
  }
  function vibreurA(c, s, cote) {
    const i = Math.round(ramener(c, s) / PAS) % c.n;
    return !!(c.vibreur[i] & (cote < 0 ? 1 : 2));
  }
  function limiteA(c, s, cote) {
    const i = Math.round(ramener(c, s) / PAS) % c.n;
    return cote < 0 ? c.limiteG[i] : c.limiteD[i];
  }
  function valider(c) {
    const pb = [];
    const finis = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse'].every(k => c[k].length === c.n && c[k].every(Number.isFinite));
    if (!finis) pb.push('valeurs non finies ou tableaux de mauvaise taille');
    if (c.longueur !== c.n * PAS) pb.push('longueur différente de n × pas');
    const fx = c.x[0] - c.x[c.n - 1], fz = c.z[0] - c.z[c.n - 1];
    if (Math.abs(Math.hypot(fx, fz) - PAS) > .5) pb.push('boucle mal refermée');
    // Pentes : plafonds validés (lot 22, 18/11) de 7 %, 10 % en montagne ; au-delà, seulement dans une rampe déclarée
    // par la partition (c.rampes, raccords compris), et jamais plus raide que son palier le plus raide.
    const plafond = c.theme === 'montagne' ? .10 : .07, rampes = c.rampes || [];
    let kmax = 0, pmax = 0;
    for (let i = 0; i < c.n; i++) {
      kmax = Math.max(kmax, Math.abs(c.courbure[i]));
      const p = Math.abs(c.pente[i]), s = i * PAS;
      if (p <= plafond) continue;
      const r = rampes.find(r => s >= r.debut && s <= r.fin);
      if (!r || p > r.penteMax + 1e-9) pmax = Math.max(pmax, p);
    }
    if (kmax > 1 / 23.5) pb.push('rayon minimal inférieur à 24 m');
    if (pmax) pb.push('pente supérieure à ' + Math.round(plafond * 100) + ' %' + (rampes.length ? ' hors des rampes déclarées' : ''));
    if (separation(c.x, c.z, c.n) < 59) pb.push('deux portions du tracé trop proches');
    return pb;
  }

  B.circuit = { creer, echantillon, point, repere, ecart, vibreurA, limiteA, valider, dansTunnel, choisirTunnel, trace: TRACE, PAS, LARGEUR };
})(globalThis.BITUME = globalThis.BITUME || {});
