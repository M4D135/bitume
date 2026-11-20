/* BITUME — circuits originaux générés à partir d'une graine.
   Tracé : polygone étoilé dont les sommets sont arrondis par de vrais arcs de cercle (les côtés deviennent de vraies
   lignes droites), transitions de courbure adoucies, puis relief, dévers, vibreurs, trajectoire idéale et vitesse
   de référence. Premier jet du Spark (QAD) pour l'interface, repris par Claude pour la génération du tracé. */
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.couverts) require('./couverts.js');
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
  // Baïkal : rive basse, forêt, montée vers le promontoire puis retour ouvert. Ce profil ne concerne que
  // le nouveau circuit : ni les tirages ni les tableaux des sept tracés historiques ne changent.
  function reliefBaikal(n, L, plat) {
    const y = new Float64Array(n), points = [[0, 0], [.12, 0], [.30, 12], [.64, 64], [.96, 0], [1, 0]];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = i * PAS / L;
      while (j < points.length - 2 && s > points[j + 1][0]) j++;
      const a = points[j], b = points[j + 1], t = (s - a[0]) / (b[0] - a[0]);
      // Raccord quintique : pente et courbure verticale nulles aux jonctions, sans cassure à la crête.
      const u = t * t * t * (10 + t * (-15 + 6 * t));
      y[i] = (a[1] + (b[1] - a[1]) * u) * (1 - plat[i]);
    }
    return y;
  }
  function relief(n, L, theme, r, plat) {
    const y = theme === 'baikal' ? reliefBaikal(n, L, plat) : new Float64Array(n);
    if (theme !== 'baikal') {
      const A = AMPLITUDE[theme] || 14, harm = [];
      for (let h = 0; h < 3; h++) harm.push({ k: 1 + Math.floor(r() * 5), a: .4 + r() * .6, phi: r() * 2 * Math.PI });
      const somme = harm.reduce((s, h) => s + h.a, 0);
      for (let i = 0; i < n; i++) {
        let v = 0;
        for (const h of harm) v += h.a * Math.sin(2 * Math.PI * h.k * i * PAS / L + h.phi);
        y[i] = v / somme * A * (1 - plat[i]);
      }
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

  function vitesses(x, z, cap, ligne, n, pas = PAS) {
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
    for (let j = 2 * n - 1; j >= 0; j--) { const i = j % n, s = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[s] * v[s] + 2 * 16 * pas)); }
    // poussée à fond de la monoplace (enveloppe des six rapports mesurée sur conduite.js, boîte auto)
    const poussee = u => Math.max(.05, Math.min(12, 15.59 - .2592 * u + .000899 * u * u));
    for (let j = 1; j <= 2 * n; j++) { const i = j % n, p = (i - 1 + n) % n; v[i] = Math.min(v[i], Math.sqrt(v[p] * v[p] + 2 * poussee(v[p]) * pas)); }
    return v;
  }

  // Préparation explicite des seules partitions qualifiées séparément. Les huit générateurs historiques
  // conservent leurs appels et leurs résultats ; aucune table de vitesses issue d'une ancienne étude n'est importée.
  function preparerParcours(c) {
    c.ligne = trajectoire(c.x, c.z, c.cap, c.n, c.largeur);
    c.vitesse = vitesses(c.x, c.z, c.cap, c.ligne, c.n, c.pas);
    return c;
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
    if (options.partition !== undefined) {
      if (options.partition !== 'route-des-cimes' || graine !== 181 || !B.routeDesCimes) throw new Error('BITUME : partition absente ou identité invalide');
      return B.routeDesCimes.creer();
    }
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

  // ---------------------------------------------------------------- tracé métrique fourni (fondation 14B1)
  // Contrat v1 : { unite: 'm', points: [{ x, y, z, largeurG, largeurD, devers?, limiteG?, limiteD? }], pasMax?: 2 }.
  // x/z sont des coordonnées locales métriques, y une altitude dans le même repère ; dévers en radians,
  // largeurs et limites des distances positives depuis l'axe. Le dernier point répète exactement le premier,
  // profils compris : aucune fermeture forcée, transformation géographique, mise à l'échelle ou lissage caché.
  // L'abscisse est la distance EN PLAN de cette polyligne (pente = dy/ds). Les sommets source sont conservés
  // séparément pour le futur raffinement visuel : la grille uniforme ne prétend pas passer par chaque sommet.
  // Géométrie seulement : pas de largeur scalaire, de ligne idéale, de vitesse, de grille ni de stands inventés.
  // Les consommateurs de course/décor à largeur fixe, les croisements et couches restent à raccorder et qualifier.
  const CHAMPS_TRACE = Object.freeze(['x', 'y', 'z', 'largeurG', 'largeurD', 'devers', 'limiteG', 'limiteD']);
  const CHAMPS_LECTURE_TRACE = Object.freeze([...CHAMPS_TRACE, 'courbure', 'pente']);
  function creerDepuisTrace(donnees) {
    const erreur = message => { throw new RangeError('BITUME : tracé explicite — ' + message); };
    if (!donnees || donnees.unite !== 'm') erreur('unité locale métrique « m » requise');
    const points = donnees.points;
    if (!Array.isArray(points) || points.length < 4 || points.length > 250001) erreur('au moins trois sommets et leur fermeture explicite requis (250 000 segments maximum)');
    const pasMax = donnees.pasMax === undefined ? PAS : donnees.pasMax;
    if (!Number.isFinite(pasMax) || pasMax <= 0) erreur('pasMax doit être strictement positif et fini');
    if (donnees.nom !== undefined && (typeof donnees.nom !== 'string' || !donnees.nom.trim())) erreur('nom invalide');
    const champs = CHAMPS_TRACE;
    const source = points.map((p, i) => {
      if (!p || typeof p !== 'object') erreur('point ' + i + ' invalide');
      const q = { x: p.x, y: p.y, z: p.z, largeurG: p.largeurG, largeurD: p.largeurD,
        devers: p.devers === undefined ? 0 : p.devers,
        limiteG: p.limiteG === undefined ? p.largeurG : p.limiteG,
        limiteD: p.limiteD === undefined ? p.largeurD : p.limiteD };
      if (!champs.every(k => Number.isFinite(q[k]))) erreur('point ' + i + ' : coordonnées/profils non finis ou manquants');
      if (q.largeurG <= 0 || q.largeurD <= 0 || q.limiteG < q.largeurG || q.limiteD < q.largeurD) erreur('point ' + i + ' : largeurs positives et limites au-delà des bords requises');
      if (Math.abs(q.devers) >= Math.PI / 2) erreur('point ' + i + ' : dévers hors du domaine de la chaussée');
      return Object.freeze(q);
    });
    const m = source.length - 1;
    if (!champs.every(k => source[0][k] === source[m][k])) erreur('boucle non fermée : dernier point et profils différents du premier');
    const abscisses = new Float64Array(m + 1);
    for (let i = 0; i < m; i++) {
      const a = source[i], b = source[i + 1], ds = Math.hypot(b.x - a.x, b.z - a.z);
      if (!Number.isFinite(ds) || ds <= 1e-9) erreur('segment ' + i + ' nul, vertical ou non fini');
      abscisses[i + 1] = abscisses[i] + ds;
      if (!Number.isFinite(abscisses[i + 1]) || abscisses[i + 1] <= abscisses[i]) erreur('longueur non représentable');
    }
    for (let i = 0; i < m; i++) {
      const a = source[(i + m - 1) % m], b = source[i], d = source[i + 1];
      const ux = b.x - a.x, uz = b.z - a.z, vx = d.x - b.x, vz = d.z - b.z;
      const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
      if (Math.hypot(ux / lu + vx / lv, uz / lu + vz / lv) < 1e-8) erreur('demi-tour ponctuel au sommet ' + i);
    }
    const L = abscisses[m], n = Math.max(8, Math.ceil(L / pasMax));
    if (!Number.isSafeInteger(n) || n > 250000) erreur('résolution supérieure à 250 000 échantillons');
    const pas = L / n, c = { type: 'trace-explicite', formatTrace: 1, unite: 'm', pretPourCourse: false,
      nom: donnees.nom || 'Tracé explicite', longueur: L, pas, n, depart: 0,
      sourceTrace: Object.freeze(source), abscissesSource: abscisses };
    for (const k of champs) c[k] = new Float64Array(n);
    let segment = 0;
    for (let i = 0; i < n; i++) {
      const s = i * pas;
      while (segment < m - 1 && s >= abscisses[segment + 1]) segment++;
      const a = source[segment], b = source[segment + 1];
      const t = (s - abscisses[segment]) / (abscisses[segment + 1] - abscisses[segment]);
      for (const k of champs) c[k][i] = a[k] + (b[k] - a[k]) * t;
    }
    c.cap = new Float64Array(n); c.courbure = new Float64Array(n); c.pente = new Float64Array(n);
    // Dérivées centrées sur la grille périodique. Le cap est une direction, sa différence est donc repliée à ±π.
    // Une résolution qui écrase une boucle ou un demi-tour est rejetée, pas réparée en déplaçant les points.
    for (let i = 0; i < n; i++) {
      const a = (i + n - 1) % n, b = (i + 1) % n, dx = c.x[b] - c.x[a], dz = c.z[b] - c.z[a];
      if (Math.hypot(dx, dz) < 1e-9 || Math.hypot(c.x[b] - c.x[i], c.z[b] - c.z[i]) < 1e-9) erreur('tangente dégénérée : diminuer pasMax ou corriger le relevé');
      c.cap[i] = Math.atan2(dz, dx);
      c.pente[i] = (c.y[b] - c.y[a]) / (2 * pas);
    }
    for (let i = 0; i < n; i++) c.courbure[i] = angle(c.cap[(i + 1) % n] - c.cap[(i + n - 1) % n]) / (2 * pas);
    const problemes = validerTrace(c);
    if (problemes.length) erreur(problemes.join(' ; '));
    return c;
  }

  function validerTrace(c) {
    const pb = [], n = c && c.n;
    if (!Number.isSafeInteger(n) || n < 8 || n > 250000 || !Number.isFinite(c.pas) || c.pas <= 0 || !Number.isFinite(c.longueur) || c.longueur <= 0) return ['grille métrique invalide'];
    if (Math.abs(c.longueur - n * c.pas) > Math.max(1e-9, c.longueur * 1e-12)) pb.push('longueur différente de n × pas');
    const champs = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'largeurG', 'largeurD', 'limiteG', 'limiteD'];
    if (!champs.every(k => c[k] && c[k].length === n && c[k].every(Number.isFinite))) return pb.concat('valeurs non finies ou tableaux de mauvaise taille');
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (Math.hypot(c.x[j] - c.x[i], c.z[j] - c.z[i]) < 1e-9) { pb.push('segment échantillonné nul'); break; }
      if (c.largeurG[i] <= 0 || c.largeurD[i] <= 0 || c.limiteG[i] < c.largeurG[i] || c.limiteD[i] < c.largeurD[i] || Math.abs(c.devers[i]) >= Math.PI / 2) { pb.push('profil de chaussée invalide'); break; }
    }
    return pb;
  }

  function lireTrace(c, s, champ) {
    const f = ramener(c, s) / c.pas, entier = Math.floor(f), i = entier % c.n, j = (i + 1) % c.n;
    return c[champ][i] + (c[champ][j] - c[champ][i]) * (f - entier);
  }
  function echantillonTrace(c, s, sortie) {
    if (!sortie) sortie = {};
    const f = ramener(c, s) / c.pas, entier = Math.floor(f), i = entier % c.n, j = (i + 1) % c.n;
    for (const k of CHAMPS_LECTURE_TRACE) sortie[k] = c[k][i] + (c[k][j] - c[k][i]) * (f - entier);
    sortie.cap = c.cap[i] + angle(c.cap[j] - c.cap[i]) * (f - entier);
    return sortie;
  }
  // Demi-largeur gauche/droite ; le générateur historique reste à largeur constante.
  function largeurA(c, s, cote) {
    return c.type === 'trace-explicite' ? lireTrace(c, s, cote < 0 ? 'largeurG' : 'largeurD') : c.largeur / 2;
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

  // ---------------------------------------------------------------- lecture
  // dans le tunnel (marge en mètres de part et d'autre) ?
  function dansTunnel(c, s, marge = 0) {
    if (B.couverts) return B.couverts.dansTunnel(c, s, marge);
    if (c && c.couverts) {
      const t = dansCouvert(c, s, marge);
      return !!t && t.type === 'tunnel';
    }
    const t = c && c.tunnel;
    if (!t) return false;
    const L = c.longueur, x = ((s % L) + L) % L;
    return x > t.debut - marge && x < t.fin + marge;
  }
  // Retourne l'ouvrage lui-même, sans allocation, pour la chaussée, la lumière et les caméras.
  // Le premier tunnel reste exposé par c.tunnel pour les consommateurs historiques.
  function dansCouvert(c, s, marge = 0) {
    if (B.couverts) return B.couverts.segment(c, s, marge);
    if (!c) return null;
    const x = ((s % c.longueur) + c.longueur) % c.longueur;
    if (c.couverts) {
      for (let i = 0; i < c.couverts.length; i++) {
        const t = c.couverts[i];
        if (x > t.debut - marge && x < t.fin + marge) return t;
      }
      return null;
    }
    const t = c.tunnel;
    return t && x > t.debut - marge && x < t.fin + marge ? t : null;
  }
  const ramener = (c, s) => { const L = c.longueur; s %= L; return s < 0 ? s + L : s; };
  // `sortie`, facultatif : objet de l'appelant, rempli et rendu au lieu d'un objet neuf. Le pas de simulation lit
  // le tracé des dizaines de fois par voiture et par pas ; sans objet à remplir, chaque lecture est un objet jeté.
  // Les nombres sont les mêmes au bit près dans les deux cas (mêmes opérations, même ordre).
  function echantillon(c, s, sortie) {
    if (c.type === 'trace-explicite') return echantillonTrace(c, s, sortie);
    s = ramener(c, s);
    const f = s / c.pas, i = Math.floor(f) % c.n, j = (i + 1) % c.n, t = f - Math.floor(f);
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
    if (c.type === 'trace-explicite') return false; // aucun vibreur déduit du seul relevé de l'axe
    const i = Math.round(ramener(c, s) / c.pas) % c.n;
    return !!(c.vibreur[i] & (cote < 0 ? 1 : 2));
  }
  function limiteA(c, s, cote) {
    if (c.type === 'trace-explicite') return lireTrace(c, s, cote < 0 ? 'limiteG' : 'limiteD');
    const i = Math.round(ramener(c, s) / c.pas) % c.n;
    return cote < 0 ? c.limiteG[i] : c.limiteD[i];
  }
  function valider(c) {
    if (c && c.partition === 'route-des-cimes') return B.routeDesCimes.valider(c);
    if (c && c.type === 'trace-explicite') return validerTrace(c);
    const pb = [];
    const finis = ['x', 'y', 'z', 'cap', 'courbure', 'pente', 'devers', 'ligne', 'vitesse'].every(k => c[k].length === c.n && c[k].every(Number.isFinite));
    if (!finis) pb.push('valeurs non finies ou tableaux de mauvaise taille');
    if (c.longueur !== c.n * PAS) pb.push('longueur différente de n × pas');
    const fx = c.x[0] - c.x[c.n - 1], fz = c.z[0] - c.z[c.n - 1];
    if (Math.abs(Math.hypot(fx, fz) - PAS) > .5) pb.push('boucle mal refermée');
    let kmax = 0, pmax = 0;
    for (let i = 0; i < c.n; i++) { kmax = Math.max(kmax, Math.abs(c.courbure[i])); pmax = Math.max(pmax, Math.abs(c.pente[i])); }
    if (kmax > 1 / 23.5) pb.push('rayon minimal inférieur à 24 m');
    if (pmax > .07) pb.push('pente supérieure à 7 %');
    if (separation(c.x, c.z, c.n) < 59) pb.push('deux portions du tracé trop proches');
    return pb;
  }

  B.circuit = { creer, creerDepuisTrace, preparerParcours, echantillon, point, repere, ecart, vibreurA, limiteA, largeurA, valider, dansTunnel, dansCouvert, choisirTunnel, PAS, LARGEUR };
})(globalThis.BITUME = globalThis.BITUME || {});
