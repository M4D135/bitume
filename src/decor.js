/* BITUME — décor calculé depuis le circuit : chaussée, accotements, terrain, eau, arbres, tribunes, glissières.
   Aucune image ni modèle : des nappes de triangles (matière et couleur par sommet) et des primitives du moteur FERRO. */
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.lagon) require('./lagon.js');
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.chaussee) require('./chaussee.js');
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.virages) require('./virages.js');
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.baikal) require('./baikal.js');
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.batiments) require('./batiments.js');
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.cimesDecor) require('./route-des-cimes-decor.js');
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.marseilleDecor) { try { require('./marseille-decor.js'); } catch (_) {} }
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.equipeStands) { try { require('./equipe-stands.js'); } catch (_) {} }
if (typeof module !== 'undefined' && module.exports && !globalThis.BITUME?.lieux) require('./lieux.js');
(function (B) {
  'use strict';

  // ---------------------------------------------------------------- outils
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
  function hache(x, z, g) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(g | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function bruit(x, z, g) {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = hache(xi, zi, g), b = hache(xi + 1, zi, g), c = hache(xi, zi + 1, g), d = hache(xi + 1, zi + 1, g);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z, g, octaves = 4) {
    let somme = 0, amp = .5, freq = 1;
    for (let o = 0; o < octaves; o++) { somme += amp * bruit(x * freq, z * freq, g + o * 31); amp *= .5; freq *= 2.03; }
    // Après la dernière octave, 2 * amp vaut exactement 0.5 ** octaves.
    return somme / (1 - 2 * amp);
  }
  const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const melange = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const varier = (c, r, ampleur) => c.map(v => Math.max(0, v * (1 + (r() - .5) * ampleur)));

  // Orientation d'une primitive : axes locaux x (avant), y (haut), z (droite) donnés dans le monde,
  // convertis en angles pour la rotation Rz·Ry·Rx du moteur.
  function angles(ax, ay, az) {
    const b = -Math.asin(Math.max(-1, Math.min(1, ax[2])));
    return [Math.atan2(ay[2], az[2]), b, Math.atan2(ax[1], ax[0])];
  }
  function base(avant, haut) {
    const la = Math.hypot(avant[0], avant[1], avant[2]) || 1, x = avant.map(v => v / la);
    const p = haut[0] * x[0] + haut[1] * x[1] + haut[2] * x[2];
    let y = [haut[0] - p * x[0], haut[1] - p * x[1], haut[2] - p * x[2]];
    const ly = Math.hypot(y[0], y[1], y[2]) || 1; y = y.map(v => v / ly);
    const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
    return [x, y, z];
  }
  // Primitive alignée sur un cap horizontal a (le x local suit la tangente (cos a, sin a)).
  const capRot = a => [0, -a, 0];

  // La géométrie physique lit les mêmes primitives que l'image. Ces informations de construction ne changent
  // ni les lots, ni les oracles visuels historiques ; aucune limite abstraite n'est transformée en mur.
  function marquerSolide(objet, genre, groupe = 2, surface = null, maillage = null) {
    const solide = { genre, groupe, surface };
    if (maillage) solide.maillage = maillage;
    Object.defineProperty(objet, 'solidePhysX', { value: Object.freeze(solide) });
    return objet;
  }

  // ---------------------------------------------------------------- thèmes
  const THEMES = {
    foret: {
      atmosphere: { skyTop: [.15, .35, .62], skyBottom: [.66, .77, .85], fog: [.62, .70, .75], sunDirection: [.52, .58, .40], sunColor: [1.32, 1.13, .90], ambient: [.30, .35, .38], fogDensity: .0011, wind: .55, biome: 'foret' },
      herbe: [.19, .33, .10], herbeClaire: [.26, .40, .13], terre: [.25, .30, .12], relief: 26, echelle: 430, essence: 'feuillu', densite: .62, marge: 760
    },
    cote: {
      atmosphere: { skyTop: [.11, .39, .72], skyBottom: [.74, .84, .91], fog: [.70, .79, .86], sunDirection: [-.42, .64, .38], sunColor: [1.40, 1.20, .94], ambient: [.34, .38, .41], fogDensity: .0009, wind: .85, biome: 'cote' },
      herbe: [.34, .40, .17], herbeClaire: [.42, .47, .21], terre: [.40, .40, .22], sable: [.80, .72, .52], relief: 14, echelle: 380, essence: 'pin', densite: .38, marge: 820, eau: -4
    },
    montagne: {
      atmosphere: { skyTop: [.09, .29, .62], skyBottom: [.62, .74, .87], fog: [.67, .75, .83], sunDirection: [.30, .70, -.46], sunColor: [1.30, 1.19, 1.02], ambient: [.32, .37, .43], fogDensity: .00075, wind: .7, biome: 'montagne' },
      herbe: [.21, .33, .14], herbeClaire: [.29, .40, .17], terre: [.28, .31, .17], roche: [.47, .46, .43], neige: [.94, .96, .99], relief: 44, echelle: 520, essence: 'conifere', densite: .5, marge: 1050, montagnes: true
    },
    islande: {
      atmosphere: { skyTop: [.12, .25, .43], skyBottom: [.66, .73, .77], fog: [.54, .62, .67], sunDirection: [-.58, .37, .46], sunColor: [1.12, 1.17, 1.22], ambient: [.31, .36, .41], fogDensity: .00062, wind: 1.05, biome: 'islande' },
      herbe: [.19, .26, .105], herbeClaire: [.31, .39, .16], terre: [.095, .105, .115], roche: [.14, .15, .165],
      relief: 42, echelle: 300, essence: null, densite: 0, marge: 1050, volcanique: true
    },
    desert: {
      atmosphere: { skyTop: [.12, .33, .60], skyBottom: [.88, .76, .56], fog: [.74, .58, .39], sunDirection: [.61, .59, -.34], sunColor: [1.43, 1.16, .82], ambient: [.40, .34, .29], fogDensity: .00055, wind: .8, biome: 'desert' },
      herbe: [.63, .39, .18], herbeClaire: [.78, .56, .29], terre: [.56, .29, .13], roche: [.43, .19, .09], sable: [.80, .61, .36],
      relief: 34, echelle: 390, essence: null, densite: 0, marge: 1050, aride: true
    },
    asie: {
      atmosphere: { skyTop: [.10, .31, .43], skyBottom: [.69, .81, .77], fog: [.51, .66, .63], sunDirection: [-.58, .52, -.38], sunColor: [1.20, 1.24, 1.06], ambient: [.30, .39, .36], fogDensity: .00056, wind: .45, biome: 'asie' },
      herbe: [.13, .35, .24], herbeClaire: [.30, .48, .30], terre: [.24, .31, .22], roche: [.52, .57, .53],
      relief: 24, echelle: 370, essence: 'feuillu', densite: .28, marge: 1120, karstique: true
    },
    // Baïkal : rive rocheuse, promontoire, forêt boréale mixte et hameaux. Le relief de la piste 13A est conservé.
    baikal: {
      atmosphere: { skyTop: [.12, .31, .54], skyBottom: [.70, .80, .85], fog: [.60, .70, .76], sunDirection: [.48, .62, -.39], sunColor: [1.22, 1.18, 1.08], ambient: [.31, .37, .41], fogDensity: .0007, wind: .65, biome: 'baikal' },
      herbe: [.20, .32, .17], herbeClaire: [.34, .42, .23], terre: [.30, .32, .25], roche: [.45, .46, .44],
      sable: [.42, .45, .43], relief: 30, echelle: 470, essence: 'conifere', densite: .48, marge: 1050, eau: -8, baikal: true
    },
    pacifique: {
      atmosphere: { skyTop: [.12, .32, .54], skyBottom: [.73, .82, .85], fog: [.59, .70, .73], sunDirection: [-.64, .48, .31], sunColor: [1.36, 1.19, .93], ambient: [.31, .37, .40], fogDensity: .00048, wind: .95, biome: 'pacifique' },
      herbe: [.40, .39, .21], herbeClaire: [.62, .55, .32], terre: [.37, .29, .20], roche: [.40, .36, .31], sable: [.23, .27, .27],
      relief: 31, echelle: 410, essence: 'conifere', densite: .35, marge: 1120, eau: -58, pacifique: true
    }
  };
  const PUBLICITES = [[.86, .12, .08], [.98, .78, .10], [.10, .28, .70], [.06, .52, .30], [.95, .95, .92], [.08, .08, .09], [.92, .40, .06], [.40, .14, .55]];
  // Recettes FERRO du pilote Val-Brûlé, dont la roche est aussi utilisée par M1 en montagne. Les marquages
  // de piste gardent leur matière historique et les glissières leur métal galvanisé ; 24 est une tôle peinte.
  const MATIERES_PILOTES = Object.freeze({ asphalte: 21, beton: 22, roche: 23, metalPeint: 24 });
  // M1 : les ouvrages rocheux de montagne ont des identités explicites. Les fossés, rochers libres et
  // parements en béton ne sont pas sélectionnés par leur seule matière historique.
  const PIERRES_MONTAGNE = new Set(['roche-tunnel', 'portail-tunnel', 'arche-cimes', 'tympan-cimes', 'rive-pont-cimes']);

  // ---------------------------------------------------------------- géométrie du circuit
  function cadre(c, i) {
    i = c.ouvert ? Math.max(0, Math.min(c.n - 1, i)) : ((i % c.n) + c.n) % c.n;
    const a = c.cap[i];
    return { i, s: i * c.pas, x: c.x[i], y: c.y[i], z: c.z[i], a, t: [Math.cos(a), 0, Math.sin(a)], r: [-Math.sin(a), 0, Math.cos(a)], devers: c.devers[i], k: c.courbure[i] };
  }
  // Les portails explicites peuvent tomber entre deux points : préserver leur abscisse exacte.
  function cadreOuvrage(c, i) {
    if (Number.isInteger(i)) return cadre(c, i);
    const e = B.circuit.echantillon(c, i * c.pas), a = e.cap;
    const idx = c.ouvert ? Math.max(0, Math.min(c.n - 1, Math.floor(i))) : ((Math.floor(i) % c.n) + c.n) % c.n;
    return { i: idx, s: i * c.pas, x: e.x, y: e.y, z: e.z, a, t: [Math.cos(a), 0, Math.sin(a)], r: [-Math.sin(a), 0, Math.cos(a)], devers: e.devers, k: e.courbure };
  }
  // Hauteur de la chaussée au décalage d (dévers compris) ; au-delà du bord, la pente du dévers s'arrête.
  function hauteurRoute(f, d, w) {
    const dd = Math.max(-w, Math.min(w, d));
    return f.y - dd * Math.sin(f.devers);
  }
  function pointPlan(f, d, y) { return [f.x + f.r[0] * d, y, f.z + f.r[2] * d]; }

  // Limites latérales : glissières à 20 m, rapprochées à l'intérieur des virages serrés pour que le repère du circuit
  // reste valable (1 − κ·d > 0,3) et que les accotements ne se replient pas sur eux-mêmes.
  function limites(c) {
    if (c.limiteG && c.limiteD) return { G: c.limiteG, D: c.limiteD };
    const n = c.n, G = new Float32Array(n), D = new Float32Array(n), fenetre = Math.round(36 / c.pas);
    for (let i = 0; i < n; i++) {
      let g = c.limite, d = c.limite;
      for (let j = -fenetre; j <= fenetre; j++) {
        const k = c.courbure[((i + j) % n + n) % n];
        if (k > 1e-6) d = Math.min(d, .62 / k - 2);       // virage à droite : l'intérieur est à droite
        else if (k < -1e-6) g = Math.min(g, .62 / -k - 2);
      }
      if (c.ouvert) {
        const k = c.courbure[i] || 0;
        const capMax = Math.abs(k) > 0.005 ? 0.68 / Math.abs(k) : 1e4;
        if (k > 0) d = Math.min(d, capMax); else if (k < 0) g = Math.min(g, capMax);
        G[i] = Math.max(c.largeur / 2 + 1.8, Math.min(g, c.largeur / 2 + 4.5));
        D[i] = Math.max(c.largeur / 2 + 1.8, Math.min(d, c.largeur / 2 + 4.5));
      } else {
        G[i] = Math.max(c.largeur / 2 + 3.2, g); D[i] = Math.max(c.largeur / 2 + 3.2, d);
      }
    }
    return { G, D };
  }

  // Index spatial des échantillons de l'axe (cases de 40 m).
  function indexAxe(c) {
    const T = 40;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < c.n; i++) {
      const x = Math.floor(c.x[i] / T), z = Math.floor(c.z[i] / T);
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const nz = z1 - z0 + 1, nombreCases = (x1 - x0 + 1) * nz;
    // Les échantillons d'une même ligne de cases sont contigus, dans l'ordre case puis indice.
    // Les préfixes permettent de traverser directement une plage de cases, sans visiter les vides.
    const debuts = new Uint32Array(nombreCases + 1), indices = new Uint32Array(c.n);
    for (let i = 0; i < c.n; i++) {
      const k = (Math.floor(c.x[i] / T) - x0) * nz + Math.floor(c.z[i] / T) - z0;
      debuts[k + 1]++;
    }
    for (let k = 1; k <= nombreCases; k++) debuts[k] += debuts[k - 1];
    const curseurs = debuts.slice(0, nombreCases);
    for (let i = 0; i < c.n; i++) {
      const k = (Math.floor(c.x[i] / T) - x0) * nz + Math.floor(c.z[i] / T) - z0;
      indices[curseurs[k]++] = i;
    }
    // Plus proche échantillon et hauteur pondérée (inverse de la distance à la puissance 8 : continue, et exacte sur l'axe).
    // sansHauteur=true évite le calcul 1/(d²+1)^4 dans les 50 000 tests de placement d'arbres/rochers qui n'utilisent que i et d.
    function interroger(x, z, rayon, sansHauteur = false) {
      const cx = Math.floor(x / T), cz = Math.floor(z / T), r = Math.ceil(rayon / T);
      const amin = Math.max(cx - r, x0), amax = Math.min(cx + r, x1);
      const bmin = Math.max(cz - r, z0), bmax = Math.min(cz + r, z1);
      if (amin > amax || bmin > bmax) return { i: -1, d: Infinity, y: 0 };
      let meilleur = -1, d2min = Infinity, somme = 0, poids = 0;
      const cxArr = c.x, czArr = c.z, cyArr = c.y;
      // Les cases hors des bornes sont vides. Garder exactement l’ordre a/b/i
      // conserve la somme pondérée et les départages, donc la géométrie produite.
      if (sansHauteur) {
        for (let a = amin; a <= amax; a++) {
          const ligne = (a - x0) * nz, fin = debuts[ligne + bmax - z0 + 1];
          for (let k = debuts[ligne + bmin - z0]; k < fin; k++) {
            const i = indices[k], dx = cxArr[i] - x, dz = czArr[i] - z, d2 = dx * dx + dz * dz;
            if (d2 < d2min) { d2min = d2; meilleur = i; }
          }
        }
        return { i: meilleur, d: Math.sqrt(d2min), y: 0 };
      }
      for (let a = amin; a <= amax; a++) {
        const ligne = (a - x0) * nz, fin = debuts[ligne + bmax - z0 + 1];
        for (let k = debuts[ligne + bmin - z0]; k < fin; k++) {
          const i = indices[k];
          const dx = cxArr[i] - x, dz = czArr[i] - z, d2 = dx * dx + dz * dz;
          if (d2 < d2min) { d2min = d2; meilleur = i; }
          const q = d2 + 1, q2 = q * q, w = 1 / (q2 * q2);
          somme += w * cyArr[i]; poids += w;
        }
      }
      return { i: meilleur, d: Math.sqrt(d2min), y: poids > 0 ? somme / poids : 0 };
    }
    // Pour un placement qui rejette de toute façon les points hors d'un rayon.
    // Les préfixes bornent chaque ligne du quadrillage au disque, puis au meilleur
    // point déjà trouvé. Les cases et les égalités gardent l'ordre d'interroger.
    interroger.dansRayon = (x, z, rayon, resultat) => {
      const bord = rayon + 1e-7, cx=Math.floor(x/T), cz=Math.floor(z/T), cases=Math.ceil(rayon/T);
      const debutX=Math.max(x0,cx-cases,Math.floor((x-bord)/T)), finX=Math.min(x1,cx+cases,Math.floor((x+bord)/T));
      let meilleur = -1, distance2 = bord*bord;
      for (let a=debutX; a<=finX; a++) {
        const ligne=(a-x0)*nz;
        if (debuts[ligne] === debuts[ligne+nz]) continue;
        const ecartX=Math.max(0, a*T-x, x-(a+1)*T), reste=distance2-ecartX*ecartX;
        if (reste<0) continue;
        const marge=Math.sqrt(reste)+1e-7;
        const debutZ=Math.max(z0,cz-cases,Math.floor((z-marge)/T)), finZ=Math.min(z1,cz+cases,Math.floor((z+marge)/T));
        if (debutZ>finZ) continue;
        const fin=debuts[ligne+finZ-z0+1];
        for (let k=debuts[ligne+debutZ-z0]; k<fin; k++) {
          const i=indices[k], dx=c.x[i]-x, dz=c.z[i]-z, d2=dx*dx+dz*dz;
          if (d2<distance2) { meilleur=i; distance2=d2; }
        }
      }
      const distance=Math.sqrt(distance2);
      resultat.i = distance<=rayon ? meilleur : -1;
      resultat.d = resultat.i<0 ? Infinity : distance;
      return resultat;
    };
    return interroger;
  }

  // ---------------------------------------------------------------- nappes
  function nappe(nombreSommets) {
    return { s: new Float32Array(nombreSommets * 13), ns: 0, i: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  }
  function sommet(n, p, no, mat, col) {
    // Les sommets ne sont relus qu'une fois la nappe finie : leur stockage Float32 est déjà celui
    // de la sortie. Les bornes gardent les Number d'origine, sans arrondi intermédiaire.
    if (n.ns + 13 > n.s.length) { const x = new Float32Array(Math.max(n.s.length * 2, n.ns + 13)); x.set(n.s); n.s = x; }
    const k = n.ns, s = n.s; n.ns += 13;
    s[k] = p[0]; s[k + 1] = p[1]; s[k + 2] = p[2];
    s[k + 3] = no[0]; s[k + 4] = no[1]; s[k + 5] = no[2];
    // Les trois composantes non utilisées, initialisées à zéro, ne sont jamais réécrites.
    s[k + 9] = mat; s[k + 10] = col[0]; s[k + 11] = col[1]; s[k + 12] = col[2];
    for (let k = 0; k < 3; k++) { if (p[k] < n.min[k]) n.min[k] = p[k]; if (p[k] > n.max[k]) n.max[k] = p[k]; }
    return k / 13;
  }
  function finir(n) {
    if (n.ns > n.s.length) throw new RangeError('Capacité de la nappe dépassée');
    const centre = n.min.map((v, k) => (v + n.max[k]) / 2);
    const rayon = Math.hypot(n.max[0] - n.min[0], n.max[1] - n.min[1], n.max[2] - n.min[2]) / 2;
    const sommets = n.ns === n.s.length ? n.s : n.s.slice(0, n.ns);
    return { sommets, indices: new Uint32Array(n.i), centre, rayon };
  }

  const NUANCE_SOL_NU = [1.10, .86, .96];
  const FLEURS_LOINTAINES = { feuillu: [.66, .55, .29], pin: [.73, .64, .35], conifere: [.53, .44, .61] };
  function couleurPrairie(th, couleur, habitat) {
    if (th.aride) return couleur;   // sable et grès : aucune prairie ni fleur lointaine
    if (th.volcanique) return melange(couleur, th.herbeClaire, lisse(.22, .85, habitat.herbe) * .82);
    if (th.karstique) return melange(couleur, th.herbeClaire, lisse(.30, .90, habitat.herbe) * .18);
    // Clairières blondes et sol sombre des bosquets : l'herbe lointaine reste une couleur de la grille.
    if (th.pacifique) return melange(melange(th.terre, th.herbeClaire, .66), [.20, .28, .16], lisse(.05, .70, habitat.boisement) * .88);
    const pousse = lisse(.02, .85, habitat.herbe), fleurs = habitat.fleurs * .14;
    const fleur = FLEURS_LOINTAINES[th.essence] || FLEURS_LOINTAINES.feuillu, resultat = new Array(3);
    // Les nappes portent l'illusion à distance : ces mêmes poches restent lisibles quand les brins
    // deviennent trop petits. Seules les couleurs changent, sans couche ou géométrie supplémentaire.
    for (let k = 0; k < 3; k++) {
      const nu = th.terre[k] * NUANCE_SOL_NU[k], riche = th.herbe[k] * .75 + th.herbeClaire[k] * .25;
      const sol = nu + (riche - nu) * pousse;
      resultat[k] = couleur[k] * .15 + (sol + (fleur[k] - sol) * fleurs) * .85;
    }
    return resultat;
  }

  function nappesRoute(c, th, lim, ecologie = null, saison = null, reperes = null, pont = null) {
    const w = c.largeur / 2, n = c.n, LIGNES = 60, liste = [];
    const matAsphalte = th.asphalte===MATIERES_PILOTES.asphalte ? 21.125 : th.asphalte;
    const habitat = {};
    const meteoRoute = B.chaussee ? B.chaussee.preparer({}, saison) : null, surfaceRoute = {};
    const neigeRoute = [.84, .87, .90];
    const asphalte = i => {
      const v = .165 + .035 * fbm(i * c.pas / 90, 3.7, c.graine + 5, 2), col = [v, v, v * 1.04];
      // Même couverture initiale que la conduite, lue par portion pour garder le tunnel sec.
      // Couleurs des sommets seulement : géométrie, matériaux, marquages et tirages restent identiques.
      if (meteoRoute && meteoRoute.neigeSol > 0) {
        const neige = B.chaussee.lire(c, i * c.pas, meteoRoute, surfaceRoute).neige;
        if (neige > 0) for (let k = 0; k < 3; k++) col[k] += (neigeRoute[k] - col[k]) * neige;
      }
      return col;
    };
    const blanc = [.86, .86, .83], rouge = [.74, .09, .07], blancBordure = [.90, .90, .87];
    const rougeVirage = [.82, .025, .02], blancVirage = [.98, .99, .96];
    const bandes = [
      ['jupe', -1], ['herbe', -1], ['bord', -1], ['ligne', -1], ['asphalte', 0], ['ligne', 1], ['bord', 1], ['herbe', 1], ['jupe', 1]
    ];
    if (pont) bandes.push(['intrados', 0]);
    const betonPont = [.38,.41,.42], basY = [0,-1,0];
    const hautY = [0, 1, 0];
    const secteurs=B.saisons?.secteurs?.(c);
    const secondaire=secteurs?.plages.find(p=>p.theme!==c.theme);
    const paletteB=secondaire && (THEMES[secondaire.theme] || B.destinations?.THEMES[secondaire.theme]);
    const frontieres=paletteB ? secteurs.plages.filter((p,i,l)=>l[(i+l.length-1)%l.length].theme!==p.theme).map(p=>p.debut) : [];
    function partPaysage(f) {
      if (!paletteB) return 0;
      let distance=Infinity;
      for (const borne of frontieres) { const ds=Math.abs(f.s-borne); distance=Math.min(distance,ds,c.longueur-ds); }
      return lisse(-95,95,(secteurs.plages[secteurs.indices[f.i]].theme===secondaire.theme?1:-1)*distance);
    }
    function teinteBord(x,z,part) {
      const t=fbm((.82*x+.57*z)/91,(.82*z-.57*x)/91,c.graine+391,2);
      const e=ecologie?.echantillonner(x,z,habitat);
      function teinter(p) {
        const col=p.aride?melange(p.terre,p.sable,t):p.volcanique?melange(p.terre,p.herbe,lisse(.34,.78,t)):melange(p.herbe,p.herbeClaire,.19+.56*t);
        return e?couleurPrairie(p,col,e):col;
      }
      return part===0?teinter(th):part===1?teinter(paletteB):melange(teinter(th),teinter(paletteB),part);
    }
    const premA = new Int32Array(bandes.length), premB = new Int32Array(bandes.length);
    const limiteBoucle = c.ouvert ? n - 1 : n;
    for (let debut = 0; debut < limiteBoucle; debut += LIGNES) {
      const fin = Math.min(limiteBoucle, debut + LIGNES);
      const nap = nappe((fin - debut + 1) * bandes.length * 2), herbeTriangles = [], surfacesPhysX = [];
      premA.fill(-1);
      for (let i = debut; i <= fin; i++) {
        const f = cadre(c, i), no = [Math.sin(f.devers) * f.r[0], Math.cos(f.devers), Math.sin(f.devers) * f.r[2]];
        const limG = lim.G[f.i], limD = lim.D[f.i];
        const surPont = pont && Math.abs(B.circuit.ecart(c,pont.f.s,f.s)) <= pont.demi;
        const segmentPont = pont && Math.abs(B.circuit.ecart(c,pont.f.s,f.s - c.pas/2)) <= pont.demi;
        const part=partPaysage(f);
        const vib = c.vibreur[f.i], tranche = Math.floor(f.i * c.pas / 4) % 2;
        for (let b = 0; b < bandes.length; b++) {
          const type = bandes[b][0], cote = bandes[b][1];
          let d0, d1, y0, y1, mat = 8, col = null, n0 = no, n1 = no;
          if (type === 'intrados') {
            if (!surPont) { premA[b] = -1; continue; }
            d0 = -(limG + 3.3); d1 = limD + 3.3;
            y0 = hauteurRoute(f,-w,w) - .02*(-d0-w-1.2) - 1.15;
            y1 = hauteurRoute(f,w,w) - .02*(d1-w-1.2) - 1.15;
            mat = MATIERES_PILOTES.beton; col = betonPont; n0 = n1 = basY;
          } else if (type === 'asphalte') { d0 = -w + .3; d1 = w - .3; y0 = hauteurRoute(f, d0, w); y1 = hauteurRoute(f, d1, w); mat = matAsphalte; col = asphalte(f.i); }
          else {
            const bord = cote < 0 ? -1 : 1, limite = cote < 0 ? limG : limD, yBord = hauteurRoute(f, bord * w, w);
            const ext = limite + (surPont ? 3.3 : 4);
            if (type === 'ligne') { d0 = bord * (w - .3); d1 = bord * w; y0 = hauteurRoute(f, d0, w); y1 = yBord; mat = 14.25; col = blanc; }
            else if (type === 'bord') {
              d0 = bord * w; d1 = bord * (w + 1.2); y0 = yBord;
              const avec = cote < 0 ? (vib & 1) : (vib & 2);
              y1 = yBord + (avec ? .05 : -.015);
              if (avec) {
                mat = 14.25; col = reperes && reperes.vibreurs[f.i] ? (tranche ? rougeVirage : blancVirage) : (tranche ? rouge : blancBordure);
              } else if (surPont) { mat = MATIERES_PILOTES.beton; col = betonPont; } else { mat = 8; }
            } else if (type === 'herbe') { d0 = bord * (w + 1.2); d1 = bord * ext; y0 = yBord - .015; y1 = yBord - .02 * (ext - w - 1.2); n0 = n1 = hautY; }
            else { d0 = bord * ext; d1 = bord * (ext + 4); y0 = yBord - .02 * (ext - w - 1.2); y1 = y0 - 2.6; n0 = n1 = hautY; }
            if (surPont && (type === 'herbe' || type === 'jupe')) {
              mat = MATIERES_PILOTES.beton; col = betonPont;
              if (type === 'jupe') { d1 = d0; y1 = y0 - 1.15; n0 = n1 = [bord*f.r[0],0,bord*f.r[2]]; }
            }
            if (cote < 0) { const t = d0; d0 = d1; d1 = t; const u = y0; y0 = y1; y1 = u; }
          }
          const p0 = pointPlan(f, d0, y0), p1 = pointPlan(f, d1, y1);
          const col0=col || teinteBord(p0[0],p0[2],part), col1=col || teinteBord(p1[0],p1[2],part);
          const ia = sommet(nap, p0, n0, mat, col0), ib = sommet(nap, p1, n1, mat, col1);
          let pa = premA[b];
          if (pa >= 0 && !(B.cimesDecor && B.cimesDecor.couperAccotement(c, f.s - c.pas / 2, type))
            && !(B.larcheDecor && B.larcheDecor.couperAccotement(c, f.s - c.pas / 2, type))
            && !(B.marseilleDecor && B.marseilleDecor.couperAccotement(c, f.s - c.pas / 2, type))) {
            let pb = premB[b];
            // La rangée est partagée entre sections, mais une bordure peinte s'arrête au joint.
            // Reprendre les deux mêmes positions avec les attributs de la section suivante évite
            // que le rouge se diffuse dans le blanc ou l'herbe, quel que soit le sommet provoquant.
            if (type==='bord' && (nap.s[pa*13+9]!==mat || col && nap.s[pa*13+10]!==Math.fround(col[0]))) {
              const reprendre=v=>{
                const k=v*13, p=Array.from(nap.s.subarray(k,k+3)), n=Array.from(nap.s.subarray(k+3,k+6));
                return sommet(nap,p,n,mat,col || teinteBord(p[0],p[2],part));
              };
              pa=reprendre(pa); pb=reprendre(pb);
            }
            if (!segmentPont && (type === 'herbe' || type === 'jupe')) herbeTriangles.push(nap.i.length, nap.i.length + 3);
            if (type === 'intrados') nap.i.push(pa,ib,pb,pa,ia,ib);
            else nap.i.push(pa, pb, ib, pa, ib, ia);
            const surface = type === 'asphalte' || type === 'ligne' ? 1 : type === 'bord' && (vib & (cote < 0 ? 1 : 2)) ? 2 : segmentPont ? 1 : 3;
            surfacesPhysX.push(surface, surface);
          }
          premA[b] = ia; premB[b] = ib;
        }
      }
      const fini = finir(nap);
      Object.defineProperties(fini, { herbeTriangles: { value: herbeTriangles }, surfaceType: { value: 'accotement' }, surfacesPhysX: { value: new Uint8Array(surfacesPhysX) } });
      liste.push(fini);
    }
    return liste;
  }

  // Terrain : grille autour du circuit, raccordée à la chaussée par une pondération continue des hauteurs de l'axe.
  function nappesTerrain(c, th, interroger, g, ecologie = null, organique = false, saison = null, cachePanorama = null, pont = null) {
    if (B.larcheDecor) {
      const corridor = B.larcheDecor.terrain(c, th, interroger, { saison, cachePanorama }, ecologie, organique);
      if (corridor) return corridor;
    }
    if (B.marseilleDecor) {
      const coteMarseille = B.marseilleDecor.terrain(c, th, interroger, g, ecologie, organique);
      if (coteMarseille) return coteMarseille;
    }
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < c.n; i++) { x0 = Math.min(x0, c.x[i]); x1 = Math.max(x1, c.x[i]); z0 = Math.min(z0, c.z[i]); z1 = Math.max(z1, c.z[i]); }
    const marge = th.marge, pasT = organique ? 18 : 24;
    x0 -= marge; z0 -= marge; x1 += marge; z1 += marge;
    const nx = Math.ceil((x1 - x0) / pasT) + 1, nz = Math.ceil((z1 - z0) / pasT) + 1;
    const H = new Float32Array(nx * nz), D = new Float32Array(nx * nz);
    const secteurs = B.saisons?.secteurs?.(c);
    const secondaire = secteurs?.plages.find(p => p.theme !== c.theme);
    const paletteB = secondaire && (THEMES[secondaire.theme] || B.destinations?.THEMES[secondaire.theme]);
    const poidsAxe = paletteB ? new Uint8Array(c.n) : null, poidsSol = paletteB ? new Uint8Array(nx*nz) : null;
    const poidsPigments = paletteB ? new Uint8Array(nx*nz) : null;
    const centres = paletteB ? [[0,0,0],[0,0,0]] : null;
    if (paletteB) {
      const bornes = secteurs.plages.filter((p,i,liste) => liste[(i+liste.length-1)%liste.length].theme !== p.theme).map(p => p.debut);
      for (let i=0; i<c.n; i++) {
        const s=i*c.pas, cote=secteurs.plages[secteurs.indices[i]].theme === secondaire.theme ? 1 : 0;
        let distance=Infinity;
        for (const borne of bornes) { const ds=Math.abs(s-borne); distance=Math.min(distance,ds,c.longueur-ds); }
        poidsAxe[i]=Math.round(255*lisse(-95,95,cote ? distance : -distance));
        centres[cote][0]+=c.x[i]; centres[cote][1]+=c.z[i]; centres[cote][2]++;
      }
      for (const centre of centres) { centre[0]/=Math.max(1,centre[2]); centre[1]/=Math.max(1,centre[2]); }
    }
    const centreX = (x0 + x1) / 2, centreZ = (z0 + z1) / 2;
    // Brume-de-Jade : sept sommets inégaux, répartis en deux massifs et un éperon isolé.
    // Ce sont des hauteurs de la grille existante, jamais des objets ajoutés ni un travail par image.
    const pics = th.karstique ? [
      [x0 + 390, z1 - 420, 155, 220, 285], [x0 + 670, z1 - 620, 130, 180, 190],
      [x0 + 920, z1 - 350, 190, 150, 240], [x1 - 370, z0 + 460, 175, 225, 255],
      [x1 - 610, z0 + 710, 125, 160, 175], [x1 - 900, z0 + 400, 155, 130, 215],
      [x1 - 450, z1 - 650, 185, 140, 160]
    ] : null;
    const paysageBaikal = th.baikal ? B.baikal.planifier(c, th.eau) : null;
    const merAngle = hache(g, 7, 3) * Math.PI * 2, mer = [Math.cos(merAngle), Math.sin(merAngle)];
    let merDebut = -Infinity;
    if (th.eau !== undefined) {
      merDebut = -Infinity;
      for (let i = 0; i < c.n; i++) merDebut = Math.max(merDebut, (c.x[i] - centreX) * mer[0] + (c.z[i] - centreZ) * mer[1]);
      merDebut += th.pacifique ? 70 : 90;
    }
    // Champ continu au-delà du rayon local de indexAxe (mode organique ou Route-des-Cimes) :
    // supprime le mur vertical de 300 m à d = 230 m causé par le saut brutal q.i < 0 → d = 1e4 / yT = 0.
    const champContinu = organique || c.id === 'route-des-cimes';
    let loinX = null, loinY = null, loinZ = null, loinN = 0, yFond = 0;
    const pasLoin = Math.max(1, Math.round(18 / c.pas));
    if (champContinu) {
      loinN = Math.ceil(c.n / pasLoin);
      loinX = new Float32Array(loinN); loinY = new Float32Array(loinN); loinZ = new Float32Array(loinN);
      let yMinC = Infinity;
      for (let i = 0, k = 0; i < c.n; i += pasLoin, k++) {
        loinX[k] = c.x[i]; loinY[k] = c.y[i]; loinZ[k] = c.z[i];
        if (c.y[i] < yMinC) yMinC = c.y[i];
      }
      yFond = Number.isFinite(yMinC) ? yMinC : 0;
    }
    const hauteur = (x, z, cellule) => {
      const rayonQ = th.karstique ? 380 : 230;
      const q = interroger(x, z, rayonQ);
      let indiceAxe = q.i, d = q.i < 0 ? 1e4 : q.d, yT = q.i < 0 ? 0 : q.y;
      if (champContinu && (q.i < 0 || d > rayonQ - 65)) {
        let d2min = Infinity, sY = 0, sW = 0;
        for (let k = 0; k < loinN; k++) {
          const dx = loinX[k] - x, dz = loinZ[k] - z, d2 = dx * dx + dz * dz;
          if (d2 < d2min) {
            d2min = d2;
            if (poidsSol && q.i < 0) indiceAxe = k * pasLoin;
          }
          const w = 1 / (d2 + 2500);
          sY += w * loinY[k]; sW += w;
        }
        const dLoin = Math.sqrt(d2min);
        const yLoin = sW > 0 ? sY / sW : yFond;
        const tBlend = q.i < 0 ? 1 : lisse(rayonQ - 65, rayonQ - 5, d);
        d = q.i < 0 ? dLoin : (d + (dLoin - d) * tBlend);
        yT = q.i < 0 ? yLoin : (yT + (yLoin - yT) * tBlend);
        // Relâcher doucement l'altitude de référence loin du tracé vers le fond de vallée
        yT += (yFond - yT) * lisse(260, 1050, d) * .65;
      }
      let h = yT - .9 * (1 - lisse(26, 34, d));
      const nat = (fbm(x / th.echelle, z / th.echelle, g, 5) - .45) * th.relief * 2;
      // Des paliers doux de 7 m forment les terrasses ; le raccord est nul près de toute chaussée.
      const niveau = nat / 7, palier = th.karstique ? 7 * (Math.floor(niveau) + lisse(.72, 1, niveau - Math.floor(niveau))) : nat;
      h += palier * lisse(30, 260, d);
      if (pics) {
        let sommets = 0;
        for (const [px, pz, rx, rz, haut] of pics) {
          const dx = x - px, dz = z - pz, u = (dx + 18 * Math.sin(dz / 95)) / rx, v = (dz + 25 * Math.sin(dx / 140)) / rz;
          sommets += haut * Math.exp(-1.7 * Math.pow(u * u + v * v, 1.25));
        }
        const fond = Math.abs(z - centreZ + 130 - (x - centreX) * .31 - 95 * Math.sin((x - centreX) / 360));
        h += sommets * lisse(120, 360, d) - 18 * (1 - lisse(30, 125, fond)) * lisse(70, 220, d);
      }
      if (th.montagnes) {
        const crete = 1 - Math.abs(fbm(x / 900, z / 900, g + 9, 4) * 2 - 1);
        h += (120 + 260 * crete) * lisse(380, 1050, d);
      }
      if (th.volcanique) {
        // Deux caldeiras asymétriques dans la grille existante : aucune géométrie animée, aucun relief sur la piste.
        const u = Math.hypot((x - x0 - 330) / 440, (z - z1 + 300) / 360);
        const v = Math.hypot((x - x1 + 400) / 570, (z - z0 - 350) / 420);
        const cones = 270 * (Math.exp(-u * u * .8) - .64 * Math.exp(-u * u * 7))
          + 190 * (Math.exp(-v * v * .75) - .56 * Math.exp(-v * v * 6));
        h += cones * lisse(150, 420, d);
      }
      if (th.aride) {
        // Trois tables de grès décentrées et un oued sec, dans la grille déjà rendue.
        // Les formes s'effacent avant les abords de piste : aucun mur sous la chaussée.
        const table = (cx, cz, rx, rz, angle, haut) => {
          const dx = x - cx, dz = z - cz, ca = Math.cos(angle), sa = Math.sin(angle);
          const rayon = Math.hypot((dx * ca + dz * sa) / rx, (-dx * sa + dz * ca) / rz);
          return haut * (1 - lisse(.58, 1.08, rayon));
        };
        const plateaux = table(x0 + 440, z1 - 490, 560, 370, .38, 210)
          + table(x1 - 430, z0 + 520, 450, 610, -.63, 165)
          + table(x1 - 800, z1 - 360, 310, 420, .92, 112);
        const lit = Math.abs(z - centreZ - 170 - (x - centreX) * .24 - 85 * Math.sin((x - centreX) / 420));
        const ravine = 42 * (1 - lisse(28, 130, lit));
        h += plateaux * lisse(135, 350, d) - ravine * lisse(65, 180, d);
      }
      if (paysageBaikal) h = B.baikal.relief(paysageBaikal, x, z, d, h);
      else if (th.eau !== undefined) {
        const p = (x - centreX) * mer[0] + (z - centreZ) * mer[1];
        if (th.pacifique) {
          // Trois caps inégaux et des anses ouvertes : une côte haute, distincte de la plage de Port-Sable.
          // Le raccord au relief est nul à moins de 50 m de tout axe, y compris de l'autre côté d'une épingle.
          const t = -(x - centreX) * mer[1] + (z - centreZ) * mer[0];
          const cap = 190 * Math.exp(-Math.pow((t + 540) / 210, 2)) + 110 * Math.exp(-Math.pow((t - 310) / 135, 2))
            + 245 * Math.exp(-Math.pow((t - 850) / 290, 2));
          const rivage = merDebut - 85 + cap + 48 * Math.sin(t / 137 + .8) + 24 * Math.sin(t / 61);
          const crete = 38 * Math.exp(-Math.pow((p - merDebut + 270) / 230, 2)) * (.35 + .65 * fbm(t / 390, 4.7, g + 233, 3));
          h += crete * lisse(120, 340, d);
          const falaise = lisse(rivage - 42, rivage + 38, p) * lisse(50, 135, d);
          h += (th.eau - 18 - h) * falaise;
        } else h -= 34 * lisse(merDebut - 40, merDebut + 220, p) * lisse(60, 140, d);
      }
      if (B.cimesDecor) h = B.cimesDecor.relief(c, x, z, q, h);
      if (poidsSol) {
        const da=Math.hypot(x-centres[0][0],z-centres[0][1]), db=Math.hypot(x-centres[1][0],z-centres[1][1]);
        const paysage=lisse(-280,280,da-db)*255, rive=indiceAxe>=0?poidsAxe[indiceAxe]:paysage;
        poidsPigments[cellule]=Math.round(rive+(paysage-rive)*lisse(22,195,d));
        // Le contour de l'eau et les habitats dépendent du poids historique, distinct du pigment.
        poidsSol[cellule]=indiceAxe>=0 ? poidsAxe[indiceAxe] : Math.round(255*lisse(-180,180,da-db));
      }
      if (pont) h = B.destinations.reliefPontFjord(c, pont, x, z, q, h);
      return { h, d };
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const r = hauteur(x0 + i * pasT, z0 + j * pasT, j*nx+i); H[j * nx + i] = r.h; D[j * nx + i] = r.d;
    }
    const lagon = secondaire?.theme === 'corail' && poidsSol
      ? B.lagon.construire(c, secteurs, interroger, { x0,z0,nx,nz,pas:pasT,H,D,poidsSol,alterne:organique }, { nappe,sommet,finir }) : null;
    const liste = [], TUILE = 14, habitat = {};
    // Les masques de plantation utilisent les seuils historiques, indépendamment du pigment affiché.
    // Les deux anciens bruits d'altitude ne sont utiles que près des seuils de roche ou de neige.
    function classeHabitat(th,h,d,ny,x,z) {
      let mat=th.volcanique && ny<.78 ? 9 : 8;
      if (th.montagnes) {
        let tache=.5, tacheFine=.5;
        if ((h>=95 && h<=164 && organique) || (h>232 && h<322)) {
          let wx=x, wz=z;
          if (organique) {
            const dx=(fbm(x/190,z/190,g+613,3)-.5)*92;
            const dz=(fbm(x/190+9.3,z/190-4.7,g+617,3)-.5)*92;
            wx=x+dx+(fbm((x+dx)/62,(z+dz)/62,g+641,2)-.5)*26;
            wz=z+dz+(fbm((x+dx)/62-5.1,(z+dz)/62+7.4,g+647,2)-.5)*26;
            if (h<=164) tacheFine=fbm(wx/56,wz/56,g+631,3)*.65+fbm(wx/23+4.1,wz/23-2.7,g+653,2)*.35;
          }
          if (h>232) tache=fbm(wx/(organique?145:140),wz/(organique?145:140),g+3,3);
        }
        if (organique) {
          if (Math.max(1-lisse(.70,.88,ny),lisse(95,148+(tacheFine-.5)*32,h))>.55) mat=9;
          if (lisse(232+44*tache,278+44*tache,h)*lisse(.52,.72,ny)>.65) mat=3;
        } else {
          if (ny<.8 || h>120) mat=9;
          if (h>250+40*tache && ny>.6) mat=3;
        }
      }
      if (th.aride) mat=ny<.82?9:8;
      if (th.karstique && (organique ? 1-lisse(.66,.84,ny)>.55 : ny<.74)) mat=9;
      if (th.pacifique && (organique ? Math.max(1-lisse(.74,.90,ny),1-lisse(th.eau+2,th.eau+8,h))>.55 : ny<.84 || h<th.eau+5)) mat=9;
      if (paysageBaikal) {
        const rive=B.baikal.riveRocheuse(paysageBaikal,x,z);
        if (organique ? Math.max(lisse(.08,.28,rive)*lisse(42,68,d),1-lisse(.72,.88,ny))>.55 : (rive>.15 && d>55) || ny<.80) mat=9;
      }
      return mat;
    }
    const couleur = (h, d, ny, x, z, th) => {
      // Champs métriques indépendants des tuiles. Le palier simple utilise les mêmes transitions
      // avec moins d'octaves. L'identifiant de sol reste disponible pour la découpe des plantes.
      const wx=x+64*(bruit(x/234,z/234,g+613)-.5), wz=z+57*(bruit(x/203+4.3,z/203,g+617)-.5);
      const domaine=fbm(wx/164,wz/164,g+3,organique?3:2);
      const detail=bruit((.83*wx+.55*wz)/77,(-.55*wx+.83*wz)/77,g+631);
      const chaud=.72*domaine+.28*detail, rugosite=.08*(detail-.5);
      let col=melange(th.herbe,th.terre,.63*lisse(.33,.85,domaine)), roche=0, neige=0, sable=0;
      if (th.aride) {
        const strate=.5+.5*Math.sin(h*.16+bruit(wx/245,wz/245,g+63)*3.2);
        col=melange(melange(th.roche,th.terre,.23+.56*strate),th.sable,lisse(.51,.94,ny+rugosite)*(.42+.46*chaud));
        roche=1-lisse(.69,.91,ny+rugosite);
      } else {
        col=melange(col,th.herbeClaire,.10+.17*detail);
        if (th.volcanique) {
          roche=1-lisse(.67,.87,ny+rugosite);
          col=melange(melange(th.terre,th.roche,.32+.43*chaud),th.herbe,.69*lisse(.36,.79,chaud)*(1-roche));
        }
        if (th.montagnes) {
          roche=Math.max(1-lisse(.65,.91,ny+rugosite),lisse(83,165+(detail-.5)*35,h));
          neige=lisse(220+50*domaine,295+50*domaine,h)*lisse(.47,.79,ny);
        }
        if (th.karstique) {
          roche=1-lisse(.60,.88,ny+rugosite);
          col=melange(th.herbe,th.herbeClaire,.18+.56*chaud);
        }
        if (th.pacifique) {
          roche=Math.max(1-lisse(.67,.92,ny+rugosite),1-lisse(th.eau+2,th.eau+10,h));
          col=melange(th.herbe,th.herbeClaire,.25+.54*chaud);
        }
        if (paysageBaikal) {
          const rive=B.baikal.riveRocheuse(paysageBaikal,x,z);
          roche=Math.max(roche,lisse(.07,.32,rive)*lisse(40,74,d),1-lisse(.66,.91,ny+rugosite));
        }
        if (th.eau!==undefined && !th.pacifique) sable=1-lisse(th.eau+.6,th.eau+5+(detail-.5)*2,h);
        if (ecologie) {
          const prairie=couleurPrairie(th,col,ecologie.echantillonner(x,z,habitat));
          col=melange(col,prairie,lisse(.57,.84,ny)*(1-roche)*(1-sable));
        }
        if (roche>0) col=melange(col,th.roche.map(v=>v*(.83+.24*chaud)),roche);
        if (sable>0) col=melange(col,th.sable,sable);
        if (neige>0) col=melange(col,th.neige,neige);
      }
      const saisonSol=saison?.neige ? lisse(.33,.69,ny)*(1-sable) : (1-roche)*(1-neige)*(1-sable)*lisse(.56,.82,ny);
      return [col,saisonSol];
    };
    // Les indices sont locaux à une tuile régulière ; zéro signale un sommet encore absent.
    const coteTuile = TUILE + 1, indicesTuile = new Uint16Array(coteTuile * coteTuile);
    for (let tj = 0; tj < nz - 1; tj += TUILE) for (let ti = 0; ti < nx - 1; ti += TUILE) {
      const finI = Math.min(nx - 1, ti + TUILE), finJ = Math.min(nz - 1, tj + TUILE);
      const nap = nappe((finI - ti + 1) * (finJ - tj + 1)), idMat = organique ? new Map() : null, coefficientsSaison=saison ? [] : null;
      indicesTuile.fill(0);
      const prendre = (i, j) => {
        const local = (j - tj) * coteTuile + i - ti, deja = indicesTuile[local];
        if (deja) return deja - 1;
        const cle = j * nx + i;
        const x = x0 + i * pasT, z = z0 + j * pasT, h = H[cle];
        const hx = H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)];
        const hz = H[Math.min(nz - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i];
        const no = [-hx / (2 * pasT), 1, -hz / (2 * pasT)], l = Math.hypot(no[0], no[1], no[2]); no[0] /= l; no[1] /= l; no[2] /= l;
        const mat=classeHabitat(poidsSol && poidsSol[cle]>=128 ? paletteB : th,h,D[cle],no[1],x,z);
        const part = poidsPigments ? poidsPigments[cle] / 255 : 0;
        let [col, coefficient] = couleur(h, D[cle], no[1], x, z, part === 1 ? paletteB : th);
        if (part > 0 && part < 1) {
          const [autreCol, autreCoefficient] = couleur(h, D[cle], no[1], x, z, paletteB);
          col = melange(col, autreCol, part);
          coefficient += (autreCoefficient-coefficient)*part;
        }
        if (lagon) {
          const sable=lagon.sable(i,j);
          if (sable>0) { col=melange(col,paletteB.sable,sable); coefficient*=1-sable; }
        }
        const k = sommet(nap, [x, h, z], no, mat, col);
        if (coefficientsSaison) coefficientsSaison[k]=Math.round(255*coefficient);
        indicesTuile[local] = k + 1; return k;
      };
      // En mode organique : un même triangle n'interpole jamais deux indices de matière (évite que
      // 23=roche ↔ 25=sol passe par 24=métal peint au milieu des triangles sur les pentes).
      const avecMat = (v, m) => {
        const off = v * 13;
        if (nap.s[off + 9] === m) return v;
        const cle = v * 32 + m;
        let k = idMat.get(cle);
        if (k === undefined) {
          k = sommet(nap, [nap.s[off], nap.s[off + 1], nap.s[off + 2]],
            [nap.s[off + 3], nap.s[off + 4], nap.s[off + 5]], m,
            [nap.s[off + 10], nap.s[off + 11], nap.s[off + 12]]);
          if (coefficientsSaison) coefficientsSaison[k]=coefficientsSaison[v];
          idMat.set(cle, k);
        }
        return k;
      };
      const emettre = (v0, v1, v2) => {
        if (!organique) { nap.i.push(v0, v1, v2); return; }
        const m0 = nap.s[v0 * 13 + 9], m1 = nap.s[v1 * 13 + 9], m2 = nap.s[v2 * 13 + 9];
        if (m0 === m1 && m1 === m2) { nap.i.push(v0, v1, v2); return; }
        const m = m0 === m1 || m0 === m2 ? m0 : m1 === m2 ? m1 : m0;
        nap.i.push(avecMat(v0, m), avecMat(v1, m), avecMat(v2, m));
      };
      for (let j = tj; j < finJ; j++) for (let i = ti; i < finI; i++) {
        // Une case entièrement sous la chaussée ou ses accotements reste invisible : on la saute.
        if (D[j * nx + i] < 18 && D[j * nx + i + 1] < 18 && D[(j + 1) * nx + i] < 18 && D[(j + 1) * nx + i + 1] < 18) {
          if (!pont) continue;
          // Le fond du ravin reste visible sous le tablier, y compris derrière les piles.
          const dx = x0 + (i+.5)*pasT - pont.f.x, dz = z0 + (j+.5)*pasT - pont.f.z;
          if (Math.abs(dx*pont.tx+dz*pont.tz) > pont.demi+pasT || Math.abs(dz*pont.tx-dx*pont.tz) > 85) continue;
        }
        const a = prendre(i, j), b = prendre(i + 1, j), cc = prendre(i + 1, j + 1), d = prendre(i, j + 1);
        if (organique && ((i + j) & 1)) { emettre(a, d, b); emettre(b, d, cc); }
        else { emettre(a, cc, b); emettre(a, d, cc); }
      }
      if (nap.i.length) {
        const fini = finir(nap), herbeTriangles = [];
        for (let k = 0; k < fini.indices.length; k += 3) {
          let herbe = true;
          for (let v = 0; v < 3; v++) {
            const id = fini.indices[k + v] * 13;
            if (fini.sommets[id + 9] !== 8 || fini.sommets[id + 4] < .7
              || (th.eau !== undefined && fini.sommets[id + 1] < th.eau + 2.2)) herbe = false;
          }
          if (herbe && lagon) for (let v=0; v<3; v++) {
            const off=fini.indices[k+v]*13;
            if (Number.isFinite(lagon.niveauEauA(fini.sommets[off],fini.sommets[off+2]))) { herbe=false; break; }
          }
          if (herbe) herbeTriangles.push(k);
        }
        Object.defineProperties(fini, { herbeTriangles: { value: herbeTriangles }, surfaceType: { value: 'terrain' } });
        if (coefficientsSaison) Object.defineProperty(fini,'coefficientsSaison',{value:Uint8Array.from(coefficientsSaison),configurable:true});
        liste.push(fini);
      }
    }
    if (lagon) liste.push(lagon.eau);
    let eau = null;
    if (th.eau !== undefined) {
      const nap = nappe(4), y = th.eau, col = th.baikal ? [.055, .23, .32] : th.pacifique ? [.075, .235, .29] : [.10, .30, .40];
      const e = 2600, coins = paysageBaikal ? B.baikal.coinsEau(paysageBaikal)
        : [[centreX - e, centreZ - e], [centreX + e, centreZ - e], [centreX + e, centreZ + e], [centreX - e, centreZ + e]];
      const k = coins.map(([x, z]) => sommet(nap, [x, y, z], [0, 1, 0], 12, col));
      nap.i.push(k[0], k[2], k[1], k[0], k[3], k[2]);
      eau = finir(nap);
      if (paysageBaikal) Object.defineProperty(eau, 'surfaceType', { value: 'eau' });
    }
    const sol = (x, z) => {
      const fi = (x - x0) / pasT, fj = (z - z0) / pasT, i = Math.max(0, Math.min(nx - 2, Math.floor(fi))), j = Math.max(0, Math.min(nz - 2, Math.floor(fj)));
      const u = Math.max(0, Math.min(1, fi - i)), v = Math.max(0, Math.min(1, fj - j));
      const h00 = H[j * nx + i], h10 = H[j * nx + i + 1], h01 = H[(j + 1) * nx + i], h11 = H[(j + 1) * nx + i + 1];
      const dxPont = pont && x-pont.f.x, dzPont = pont && z-pont.f.z;
      const dansGorge = pont && Math.abs(dxPont*pont.tx+dzPont*pont.tz) <= pont.demi+pasT &&
        Math.abs(dzPont*pont.tx-dxPont*pont.tz) <= 145+pasT;
      if (dansGorge || lagon?.contientCellule(i,j)) {
        if (organique && ((i+j)&1)) return u+v<=1 ? h00+(h10-h00)*u+(h01-h00)*v
          : h11+(h01-h11)*(1-u)+(h10-h11)*(1-v);
        return u>=v ? h00+(h10-h00)*u+(h11-h10)*v : h00+(h11-h01)*u+(h01-h00)*v;
      }
      return h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;
    };
    // Réutiliser la grille de hauteur pour le sol, les arbres et les lots de végétation.
    const partSecondaire = poidsPigments && ((x,z) => {
      const fi=(x-x0)/pasT, fj=(z-z0)/pasT;
      const i=Math.max(0,Math.min(nx-2,Math.floor(fi))), j=Math.max(0,Math.min(nz-2,Math.floor(fj))), k=j*nx+i;
      const u=Math.max(0,Math.min(1,fi-i)), v=Math.max(0,Math.min(1,fj-j));
      return ((poidsPigments[k]*(1-u)+poidsPigments[k+1]*u)*(1-v)+(poidsPigments[k+nx]*(1-u)+poidsPigments[k+nx+1]*u)*v)/255;
    });
    return { liste: eau ? liste.concat([eau]) : liste, sol, lagon, niveauEauA: lagon?.niveauEauA, partSecondaire, saisonSecondaire: secondaire && saison && secondaire.profils[saison.id], maillageSol: { x0, z0, nx, nz, pas: pasT, alterne: organique, H }, bornes: [x0, z0, x1, z1], niveauEau: th.eau, paysageBaikal };
  }

  // Surface réellement disponible pour les plantes et la petite faune. Les polygones sont découpés
  // une fois à la préparation : aucune recherche de sol, collision ou racine par image.
  // Lot 28A : l'herbier resserré de prototypes/calcul/herbier/herbier-serre.js. Même algorithme, mêmes opérations
  // dans le même ordre que l'herbier historique (identique au bit : verifications/herbier-identite.test.mjs), mais
  // polygones dans une arène Float64Array, aucune fermeture ni tableau jeté dans les boucles, grilles à clés
  // numériques au lieu de chaînes. Le noyau de découpe a son jumeau en C (prototypes/calcul/herbier/herbier.c).
  const HERBIER = (() => {
    const EPS = 1e-7, MAILLE = 32;

    // ---------------------------------------------------------------- grille à clés numériques (ordre conservé)
    function cleCase(x, z) { return (x + 1048576) * 2097152 + (z + 1048576); }
    function grille(n, BX) {
      const g = new Map();
      for (let k = 0; k < n; k++) {
        const x0 = Math.floor(BX[4 * k] / MAILLE), x1 = Math.floor(BX[4 * k + 1] / MAILLE), z0 = Math.floor(BX[4 * k + 2] / MAILLE), z1 = Math.floor(BX[4 * k + 3] / MAILLE);
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const cle = cleCase(x, z), ids = g.get(cle); if (ids) ids.push(k); else g.set(cle, [k]); }
      }
      return g;
    }
    // candidats d'une boîte, dans l'ordre de l'original (x puis z, ids dans l'ordre d'insertion, sans doublon)
    function candidats(g, marques, tour, bx0, bx1, bz0, bz1, sortie, n0) {
      let n = n0;
      for (let x = Math.floor(bx0 / MAILLE); x <= Math.floor(bx1 / MAILLE); x++) for (let z = Math.floor(bz0 / MAILLE); z <= Math.floor(bz1 / MAILLE); z++) {
        const ids = g.get(cleCase(x, z)); if (!ids) continue;
        for (let q = 0; q < ids.length; q++) { const id = ids[q]; if (marques[id] !== tour) { marques[id] = tour; sortie[n++] = id; } }
      }
      return n;
    }

    // ---------------------------------------------------------------- préparation (JS, partagée par les deux noyaux)
    // Les calculs qui passent par Math.hypot, Math.sin, Math.cos et B.circuit restent ici, en JavaScript : le noyau
    // n'emploie que + − × ÷ et des comparaisons, exactes partout (IEEE 754), en JS comme en WebAssembly.
    // Lot 28C : la préparation est coupée en deux, lecture des nappes et des masques (lire), puis candidats du noyau
    // (relier) ; mêmes opérations dans le même ordre.
    function lire(c, nappes, lots, lim, enceinte, niveauEau) {
      let total = 0; for (const nap of nappes) total += nap.indices.length / 3;
      const P = new Float64Array(9 * total), PL = new Float64Array(3 * total), LEN = new Float64Array(total), BX = new Float64Array(4 * total), VEG = new Uint8Array(total);
      const sources = []; // objets de sortie (plan, normale, couleur, type) des seules surfaces végétalisables
      let n = 0; const brutes = [];
      for (const nap of nappes) {
        const herbe = new Set(nap.herbeTriangles || []), S = nap.sommets, I = nap.indices;
        for (let offset = 0; offset < I.length; offset += 3) {
          const i0 = I[offset] * 13, i1 = I[offset + 1] * 13, i2 = I[offset + 2] * 13;
          let ax = S[i0], ay = S[i0 + 1], az = S[i0 + 2], bx = S[i1], by = S[i1 + 1], bz = S[i1 + 2], dx_ = S[i2], dy_ = S[i2 + 1], dz_ = S[i2 + 2];
          // orienter : aire2 de l'original, même ordre d'opérations
          let s = 0; s = s + ax * bz - bx * az; s = s + bx * dz_ - dx_ * bz; s = s + dx_ * az - ax * dz_;
          if (s < 0) { let t = ax; ax = dx_; dx_ = t; t = ay; ay = dy_; dy_ = t; t = az; az = dz_; dz_ = t; }
          // plan
          const ux = bx - ax, uz = bz - az, vx = dx_ - ax, vz = dz_ - az, det = ux * vz - uz * vx;
          if (Math.abs(det) < .00001) continue;
          const uy = by - ay, vy = dy_ - ay, pdx = (uy * vz - vy * uz) / det, pdz = (ux * vy - vx * uy) / det;
          const len = Math.hypot(pdx, 1, pdz), h = ay - pdx * ax - pdz * az, ny = 1 / len;
          const vegetalisable = herbe.has(offset) && ny >= .62;
          const k = n++;
          P[9 * k] = ax; P[9 * k + 1] = ay; P[9 * k + 2] = az; P[9 * k + 3] = bx; P[9 * k + 4] = by; P[9 * k + 5] = bz; P[9 * k + 6] = dx_; P[9 * k + 7] = dy_; P[9 * k + 8] = dz_;
          PL[3 * k] = pdx; PL[3 * k + 1] = pdz; PL[3 * k + 2] = h; LEN[k] = len;
          BX[4 * k] = Math.min(ax, bx, dx_); BX[4 * k + 1] = Math.max(ax, bx, dx_); BX[4 * k + 2] = Math.min(az, bz, dz_); BX[4 * k + 3] = Math.max(az, bz, dz_);
          if (vegetalisable) {
            VEG[k] = 1; brutes.push(k);
            const color = [0, 0, 0];
            for (let q = 0; q < 3; q++) { let sc = 0; sc = sc + S[i0 + 10 + q] / 3; sc = sc + S[i1 + 10 + q] / 3; sc = sc + S[i2 + 10 + q] / 3; color[q] = sc; }
            sources[k] = { plan: { dx: pdx, dz: pdz, h, normal: [-pdx / len, 1 / len, -pdz / len], len }, color, type: nap.surfaceType };
          }
        }
      }
      // masques (route et empreintes), comme l'original ; orientés, en (x, z)
      const MX = [], MO = [0], MBXl = [];
      const masquer = pts => {
        let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s = s + a[0] * b[2] - b[0] * a[2]; }
        if (s < 0) pts = pts.slice().reverse();
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const p of pts) { MX.push(p[0], p[2]); if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2]; }
        MO.push(MX.length / 2); MBXl.push(x0, x1, z0, z1);
      };
      const w = c.largeur / 2;
      for (let i = 0; i < c.n; i++) {
        const j = (i + 1) % c.n, s = B.circuit.ecart(c, 0, i * c.pas);
        const tunnel = B.circuit.dansCouvert && B.circuit.dansCouvert(c, i * c.pas, 25);
        const paddock = s > enceinte.debut - 20 && s < enceinte.fin + 20;
        const gauche = tunnel ? Math.max(lim.G[i], lim.G[j]) + 32 : w + 1.24;
        const droite = tunnel ? Math.max(lim.D[i], lim.D[j]) + 32 : paddock ? w + 28 : w + 1.24;
        const p = (k, d) => [c.x[k] - Math.sin(c.cap[k]) * d, 0, c.z[k] + Math.cos(c.cap[k]) * d];
        masquer([p(i, -gauche), p(i, droite), p(j, droite), p(j, -gauche)]);
      }
      for (const lot of lots) for (const o of lot.objets) {
        const m = Math.floor((o.mat || 0) + .01);
        if (o.trianglesMasque) {
          for (const triangle of o.trianglesMasque) masquer(triangle);
          continue;
        }
        if (!o.masqueHerbier && !(o.collision && o.collision !== 'poutre') && m !== 9 && m !== 23 && m !== 13) continue;
        const a = -(o.r ? o.r[1] : 0), co = Math.cos(a), si = Math.sin(a);
        const hx = o.s[0] / 2 + .10, hz = o.s[2] / 2 + .10;
        const points = [];
        if (o.shape === 'cylinder' || o.shape === 'sphere' || o.shape === 'octa') {
          for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; points.push([o.p[0] + Math.cos(t) * hx * 1.08, 0, o.p[2] + Math.sin(t) * hz * 1.08]); }
        } else for (const [x, z] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) points.push([o.p[0] + co * x - si * z, 0, o.p[2] + si * x + co * z]);
        masquer(points);
      }
      const nM = MO.length - 1, M = new Float64Array(MX), MOff = new Int32Array(MO), MBX = new Float64Array(MBXl);
      return { n, P, PL, LEN, BX, VEG, brutes: new Int32Array(brutes), sources, nM, M, MOff, MBX, eau: Number.isFinite(niveauEau) ? niveauEau : NaN };
    }
    // candidats de chaque surface végétalisable (format CSR), filtrés par recouvrement de boîtes ; seul le noyau s'en sert
    function relier(D) {
      const { n, BX, brutes, nM, MBX } = D;
      const gM = grille(nM, MBX), gC = grille(n, BX);
      const marquesM = new Uint32Array(nM), marquesC = new Uint32Array(n);
      const nb = brutes.length, CMO = new Int32Array(nb + 1), CCO = new Int32Array(nb + 1);
      let CM = new Int32Array(1 << 16), CC = new Int32Array(1 << 16), nm = 0, nc = 0;
      const tmp = new Int32Array(Math.max(nM, n));
      for (let q = 0; q < nb; q++) {
        const k = brutes[q], bx0 = BX[4 * k], bx1 = BX[4 * k + 1], bz0 = BX[4 * k + 2], bz1 = BX[4 * k + 3];
        let t = candidats(gM, marquesM, q + 1, bx0, bx1, bz0, bz1, tmp, 0);
        if (nm + t > CM.length) { const x = new Int32Array(Math.max(CM.length * 2, nm + t)); x.set(CM); CM = x; }
        for (let u = 0; u < t; u++) { const id = tmp[u];
          if (bx0 < MBX[4 * id + 1] - EPS && bx1 > MBX[4 * id] + EPS && bz0 < MBX[4 * id + 3] - EPS && bz1 > MBX[4 * id + 2] + EPS) CM[nm++] = id; }
        CMO[q + 1] = nm;
        t = candidats(gC, marquesC, q + 1, bx0, bx1, bz0, bz1, tmp, 0);
        if (nc + t > CC.length) { const x = new Int32Array(Math.max(CC.length * 2, nc + t)); x.set(CC); CC = x; }
        for (let u = 0; u < t; u++) { const id = tmp[u]; if (id === k) continue;
          if (bx0 < BX[4 * id + 1] - EPS && bx1 > BX[4 * id] + EPS && bz0 < BX[4 * id + 3] - EPS && bz1 > BX[4 * id + 2] + EPS) CC[nc++] = id; }
        CCO[q + 1] = nc;
      }
      D.CM = CM.subarray(0, nm); D.CMO = CMO; D.CC = CC.subarray(0, nc); D.CCO = CCO;
      return D;
    }
    // Empreinte de la géométrie lue (lot 28C) : tout ce que lisent le noyau et la finition, sauf les couleurs, que la
    // saison change. Positions (P), surfaces végétalisables (brutes), masques (M, MOff) et eau déterminent PL, LEN, BX,
    // MBX et les candidats ; les types viennent des nappes. Deux voies de 32 bits, plus les deux effectifs.
    function empreinte(D) {
      let a = 0x811c9dc5 | 0, b = 0x2545f491 | 0;
      const types = new Map(), eau = new Float64Array([D.eau]);
      for (const T of [D.P, D.brutes, D.M, D.MOff, eau]) {
        const U = new Int32Array(T.buffer, T.byteOffset, T.byteLength >> 2);
        for (let i = 0; i < U.length; i++) { const v = U[i]; a = Math.imul(a ^ v, 0x01000193); b = Math.imul(b ^ v, 0x5bd1e995); b ^= b >>> 15; }
        a = Math.imul(a ^ U.length, 0x01000193); b = Math.imul(b ^ U.length, 0x5bd1e995); b ^= b >>> 13;
      }
      for (let q = 0; q < D.brutes.length; q++) {
        const type = String(D.sources[D.brutes[q]].type); let v = types.get(type);
        if (v === undefined) { v = 0x9e3779b9 | 0; for (let i = 0; i < type.length; i++) v = Math.imul(v ^ type.charCodeAt(i), 0x01000193); types.set(type, v); }
        a = Math.imul(a ^ v, 0x01000193); b = Math.imul(b ^ v, 0x5bd1e995); b ^= b >>> 15;
      }
      return (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16) + ':' + D.n + ':' + D.nM;
    }

    // ---------------------------------------------------------------- noyau JavaScript (transcription directe en C : herbier.c)
    // Arène : polygones de sommets (x, y, z) consécutifs. Deux listes de morceaux (début, nombre) en alternance.
    function noyauJS(D) {
      let A = new Float64Array(1 << 20); let haut = 0;
      const assurer = m => { if (haut + m > A.length) { const x = new Float64Array(Math.max(A.length * 2, haut + m)); x.set(A); A = x; } };
      let L1 = new Int32Array(4096), L2 = new Int32Array(4096);
      let OUT = new Float64Array(1 << 18), no = 0;
      const DST = new Float64Array(256);
      // découpe du polygone (src, n) par d(v) = sg × (k0 + k1·x + k2·z + k3·(x − ex)·… ) : trois formes, comme l'original
      // mode 0 : eau, d = y − e − 0.08 ; mode 1 : arête, d = (bx − ax)(vz − az) − (bz − az)(vx − ax) ; mode 2 : dessus, d = dh + dx·x + dz·z − off
      function dist(mode, x, y, z, a0, a1, a2, a3) {
        if (mode === 0) return y - a0 - .08;
        if (mode === 1) return (a2 - a0) * (z - a1) - (a3 - a1) * (x - a0);
        return a0 + a1 * x + a2 * z - a3;
      }
      function couper(src, n, positif, mode, a0, a1, a2, a3) { // écrit à haut, rend le nombre de sommets
        if (n < 3) return 0;
        assurer(6 * n + 6);
        const dst = haut; let m = 0;
        const la = src + 3 * (n - 1); let ax = A[la], ay = A[la + 1], az = A[la + 2];
        let da = dist(mode, ax, ay, az, a0, a1, a2, a3) * (positif ? 1 : -1);
        for (let q = 0; q < n; q++) {
          const lb = src + 3 * q, bx = A[lb], by = A[lb + 1], bz = A[lb + 2];
          const db = dist(mode, bx, by, bz, a0, a1, a2, a3) * (positif ? 1 : -1), dA = da >= -EPS, dB = db >= -EPS;
          if (dA !== dB) { const t = da / (da - db); const o = dst + 3 * m++; A[o] = ax + (bx - ax) * t; A[o + 1] = ay + (by - ay) * t; A[o + 2] = az + (bz - az) * t; }
          if (dB) { const o = dst + 3 * m++; A[o] = bx; A[o + 1] = by; A[o + 2] = bz; }
          ax = bx; ay = by; az = bz; da = db;
        }
        haut = dst + 3 * m;
        return m;
      }
      function aire2(src, n) { let s = 0; for (let q = 0; q < n; q++) { const a = src + 3 * q, b = src + 3 * ((q + 1) % n); s = s + A[a] * A[b + 2] - A[b] * A[a + 2]; } return s; }
      function aire2M(M, o, n) { let s = 0; for (let q = 0; q < n; q++) { const a = 2 * (o + q), b = 2 * (o + (q + 1) % n); s = s + M[a] * M[b + 1] - M[b] * M[a + 1]; } return s; }
      // retirer : ajoute à la liste L (paires début, nombre) les morceaux de (src, n) hors du masque (MM, mo, mn) en (x, z)
      let nL2 = 0;
      function pousser(debut, n) { if (2 * nL2 + 2 > L2.length) { const x = new Int32Array(L2.length * 2); x.set(L2); L2 = x; } L2[2 * nL2] = debut; L2[2 * nL2 + 1] = n; nL2++; }
      function retirer(src, n, MM, mo, mn) {
        let inter = src, ni = n;
        for (let i = 0; i < mn && ni >= 3; i++) {
          const a = 2 * (mo + i), b = 2 * (mo + (i + 1) % mn);
          const nouveau = couper(inter, ni, true, 1, MM[a], MM[a + 1], MM[b], MM[b + 1]); inter = haut - 3 * nouveau; ni = nouveau;
        }
        if (ni < 3 || Math.abs(aire2(inter, ni)) < .002) { pousser(src, n); return; }
        if (Math.abs(aire2(inter, ni)) >= Math.abs(aire2(src, n)) - .002) return;
        let dedans = src, nd = n;
        for (let i = 0; i < mn && nd >= 3; i++) {
          const a = 2 * (mo + i), b = 2 * (mo + (i + 1) % mn);
          const nm = couper(dedans, nd, false, 1, MM[a], MM[a + 1], MM[b], MM[b + 1]), debutM = haut - 3 * nm;
          if (nm >= 3 && Math.abs(aire2(debutM, nm)) > .002) pousser(debutM, nm);
          const nn = couper(dedans, nd, true, 1, MM[a], MM[a + 1], MM[b], MM[b + 1]); dedans = haut - 3 * nn; nd = nn;
        }
      }
      const { P, PL, LEN, VEG, brutes, M, MOff, CM, CMO, CC, CCO, eau } = D;
      const MASQUE = new Float64Array(64); // masque issu d'une autre couche, en (x, z)
      for (let q = 0; q < brutes.length; q++) {
        const s = brutes[q]; haut = 0;
        assurer(9); for (let u = 0; u < 9; u++) A[u] = P[9 * s + u]; haut = 9;
        let nL1 = 0;
        if (eau === eau) { const m = couper(0, 3, true, 0, eau, 0, 0, 0); if (m >= 3) { L1[0] = haut - 3 * m; L1[1] = m; nL1 = 1; } }
        else { L1[0] = 0; L1[1] = 3; nL1 = 1; }
        for (let u = CMO[q]; u < CMO[q + 1] && nL1; u++) {
          const k = CM[u], mo = MOff[k], mn = MOff[k + 1] - mo;
          nL2 = 0; for (let v = 0; v < nL1; v++) retirer(L1[2 * v], L1[2 * v + 1], M, mo, mn);
          const t = L1; L1 = L2; L2 = t; nL1 = nL2;
        }
        const sdx = PL[3 * s], sdz = PL[3 * s + 1], sh = PL[3 * s + 2];
        for (let u = CCO[q]; u < CCO[q + 1] && nL1; u++) {
          const k = CC[u];
          const dh = PL[3 * k + 2] - sh, dx = PL[3 * k] - sdx, dz = PL[3 * k + 1] - sdz;
          if (VEG[k] && Math.abs(dx) + Math.abs(dz) < 1e-8 && Math.abs(dh) < .0005 && k > s) continue;
          assurer(9); const src = haut; for (let w = 0; w < 9; w++) A[src + w] = P[9 * k + w]; haut += 9;
          const mm = couper(src, 3, true, 2, dh, dx, dz, VEG[k] ? .0005 : -.0005), debut = haut - 3 * mm;
          if (mm < 3) continue;
          for (let w = 0; w < mm; w++) { MASQUE[2 * w] = A[debut + 3 * w]; MASQUE[2 * w + 1] = A[debut + 3 * w + 2]; }
          if (!(Math.abs(aire2M(MASQUE, 0, mm)) > .002)) continue;
          nL2 = 0; for (let v = 0; v < nL1; v++) retirer(L1[2 * v], L1[2 * v + 1], MASQUE, 0, mm);
          const t = L1; L1 = L2; L2 = t; nL1 = nL2;
        }
        const len = LEN[s];
        for (let v = 0; v < nL1; v++) {
          const p = L1[2 * v], n = L1[2 * v + 1];
          for (let k = 1; k < n - 1; k++) {
            const a = p, b = p + 3 * k, d = p + 3 * (k + 1);
            let s2 = 0; s2 = s2 + A[a] * A[b + 2] - A[b] * A[a + 2]; s2 = s2 + A[b] * A[d + 2] - A[d] * A[b + 2]; s2 = s2 + A[d] * A[a + 2] - A[a] * A[d + 2];
            const aire = Math.abs(s2) / 2 * len;
            if (aire < .02) continue;
            if (no + 11 > OUT.length) { const x = new Float64Array(OUT.length * 2); x.set(OUT); OUT = x; }
            OUT[no++] = s; for (const o of [a, b, d]) { OUT[no++] = A[o]; OUT[no++] = A[o + 1]; OUT[no++] = A[o + 2]; } OUT[no++] = aire;
          }
        }
      }
      return OUT.subarray(0, no);
    }

    // ---------------------------------------------------------------- objets de sortie, comme l'original
    function finir(D, OUT) {
      const triangles = []; let aireAccotements = 0, aireTerrain = 0, aireBrute = 0;
      for (let q = 0; q < D.brutes.length; q++) {
        const s = D.brutes[q], P = D.P;
        let a = 0; a = a + P[9 * s] * P[9 * s + 5] - P[9 * s + 3] * P[9 * s + 2]; a = a + P[9 * s + 3] * P[9 * s + 8] - P[9 * s + 6] * P[9 * s + 5]; a = a + P[9 * s + 6] * P[9 * s + 2] - P[9 * s] * P[9 * s + 8];
        aireBrute += Math.abs(a) / 2 * D.LEN[s];
      }
      for (let o = 0; o < OUT.length; o += 11) {
        const src = D.sources[OUT[o]];
        const points = [[OUT[o + 1], OUT[o + 2], OUT[o + 3]], [OUT[o + 4], OUT[o + 5], OUT[o + 6]], [OUT[o + 7], OUT[o + 8], OUT[o + 9]]], aire = OUT[o + 10];
        const boite = { x0: Math.min(points[0][0], points[1][0], points[2][0]), x1: Math.max(points[0][0], points[1][0], points[2][0]), z0: Math.min(points[0][2], points[1][2], points[2][2]), z1: Math.max(points[0][2], points[1][2], points[2][2]) };
        triangles.push({ points, normal: src.plan.normal, color: src.color, type: src.type, aire, plan: src.plan, boite });
        if (src.type === 'accotement') aireAccotements += aire; else aireTerrain += aire;
      }
      // index et requête de surface à clés numériques (l'original concatène deux chaînes par case et par requête)
      const nT = triangles.length, BXT = new Float64Array(4 * nT);
      for (let k = 0; k < nT; k++) { const b = triangles[k].boite; BXT[4 * k] = b.x0; BXT[4 * k + 1] = b.x1; BXT[4 * k + 2] = b.z0; BXT[4 * k + 3] = b.z1; }
      const g = grille(nT, BXT);
      function surface(x, z, sortie = {}) {
        let meilleur = null, hauteur = -Infinity;
        const ids = g.get(cleCase(Math.floor(x / MAILLE), Math.floor(z / MAILLE)));
        if (ids) for (let q = 0; q < ids.length; q++) {
          const t = triangles[ids[q]], a = t.points[0], b = t.points[1], c = t.points[2];
          const abx = b[0] - a[0], abz = b[2] - a[2], acx = c[0] - a[0], acz = c[2] - a[2], det = abx * acz - abz * acx;
          const u = ((x - a[0]) * acz - (z - a[2]) * acx) / det, v = (abx * (z - a[2]) - abz * (x - a[0])) / det;
          if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
          const y = t.plan.h + t.plan.dx * x + t.plan.dz * z;
          if (y > hauteur) { hauteur = y; meilleur = t; }
        }
        if (!meilleur) return null;
        sortie.y = hauteur; sortie.normal = meilleur.normal; sortie.color = meilleur.color; sortie.type = meilleur.type;
        return sortie;
      }
      return { triangles, surface, aireBrute, aire: aireAccotements + aireTerrain, aireAccotements, aireTerrain, trianglesSources: D.brutes.length, masques: D.nM };
    }
    return { lire, relier, empreinte, noyau: noyauJS, finir };
  })();
  // Comptes de l'herbier (lot 28C, lus par verifications/herbier-saisons.test.mjs) : découpes calculées, découpes reprises.
  const COMPTES_HERBIER = { decoupes: 0, reprises: 0, wasm: 0 };
  // ancien : l'herbier gardé pour la même clé, d'une autre saison. Sa découpe est reprise si la géométrie lue a la même
  // empreinte ; seules les couleurs, relues dans les nappes de cette saison, changent alors.
  function creerHerbier(c, nappes, lots, lim, enceinte, niveauEau, ancien, wasm) {
    const D = HERBIER.lire(c, nappes, lots, lim, enceinte, niveauEau), empreinte = HERBIER.empreinte(D);
    const reprise = !!ancien && ancien.empreinte === empreinte;
    let decoupe;
    if (reprise) {
      // La découpe ne dépend que de la géométrie : elle se relit dans les triangles de l'ancien herbier (les mêmes
      // nombres) et l'indice de leur surface source, seul gardé à part (4 octets par triangle au lieu de 88).
      const T = ancien.triangles, S = ancien.sourcesTriangles; decoupe = new Float64Array(11 * T.length);
      for (let k = 0, o = 0; k < T.length; k++) {
        const p = T[k].points; decoupe[o++] = S[k];
        for (let j = 0; j < 3; j++) { decoupe[o++] = p[j][0]; decoupe[o++] = p[j][1]; decoupe[o++] = p[j][2]; }
        decoupe[o++] = T[k].aire;
      }
    } else {
      HERBIER.relier(D);
      decoupe = wasm && B.herbierWasm?.decouper(D);
      if (decoupe) COMPTES_HERBIER.wasm++;
      else decoupe = HERBIER.noyau(D);
    }
    COMPTES_HERBIER[reprise ? 'reprises' : 'decoupes']++;
    const herbier = HERBIER.finir(D, decoupe), sourcesTriangles = new Int32Array(herbier.triangles.length);
    for (let k = 0; k < sourcesTriangles.length; k++) sourcesTriangles[k] = decoupe[11 * k];
    Object.defineProperties(herbier, { empreinte: { value: empreinte }, sourcesTriangles: { value: sourcesTriangles } });
    return herbier;
  }

  // ---------------------------------------------------------------- objets
  // Palier du décor. Sans palier demandé, on tient le profil historique : les contrôles d'identité du décor,
  // l'outil de comparaison avant/après et les tests Node appellent construire sans le nommer.
  function normaliserQualite(q) {
    return q === 'medium' || q === 'high' ? q : 'low';
  }
  const ESSENCE_BOTANIQUE = essence => (essence === 'pin' || essence === 'conifere') ? essence : 'feuillu';
  const couronneArbre = o => o.shape === 'foliage' || o.collision !== 'tronc' && o.shape.startsWith('arbre-');

  // Habillage d'un arbre déjà construit à l'historique. Moyenne et Fine remplacent les blobs de feuillage par
  // une couronne procédurale de la botanique et donnent au tronc la matière écorce du moteur. Le tronc reste
  // l'objet qui porte la collision, avec ses coordonnées et sa taille d'origine : le solide ne bouge pas d'un
  // centimètre. Aucune valeur de hasard n'est consommée ici, donc aucun arbre ne se déplace ailleurs.
  function habiller(liste, loin, essence, qualite, h, penche, v, nu = false) {
    if (!B.botanique) return;
    const e = ESSENCE_BOTANIQUE(essence);
    for (const o of liste) if (o.mat === 10) o.mat = B.botanique.matiere('ecorce');
    for (let k = liste.length - 1; k >= 0; k--) if (couronneArbre(liste[k])) liste.splice(k, 1);
    for (let k = loin.length - 1; k >= 0; k--) if (couronneArbre(loin[k])) loin.splice(k, 1);
    const pied = liste.find(o => o.collision === 'tronc');
    if (!pied) return;
    const x = pied.p[0], y = pied.p[1] - pied.s[1] * .5, z = pied.p[2];
    const forme = distant => nu ? B.botanique.nomFormeNue(distant, qualite) : B.botanique.nomForme(e, distant, qualite);
    const mat = B.botanique.matiere(nu ? 'ecorce' : 'feuillage'), couleur = nu ? pied.color : v;
    liste.push({ shape: forme(false), p: [x, y + h * .5, z], s: [h, h, h],
      r: [penche, 0, penche * .7], mat, color: couleur });
    loin.push({ shape: forme(true), p: [x, y + h * .5, z], s: [h, h, h],
      r: [penche, 0, penche * .7], mat, color: couleur });
  }

  function arbre(liste, loin, x, y, z, essence, r, qualite) {
    const tronc = [.30, .21, .13], vert = essence === 'conifere' ? [.10, .24, .11] : essence === 'pin' ? [.20, .32, .12] : [.17, .31, .09];
    const v = varier(vert, r, .35), h = (essence === 'pin' ? 9 : essence === 'conifere' ? 11 : 7) * (.75 + r() * .55);
    const penche = (r() - .5) * .12;
    liste.push({ shape: 'cylinder', collision: 'tronc', p: [x, y + h * .42, z], s: [h * .045, h * .84, h * .045], r: [penche, 0, penche * .7], mat: 10, color: tronc, detail: 1 });
    if (essence === 'pin') {
      liste.push({ shape: 'foliage', p: [x + penche * h * .4, y + h * .92, z], s: [h * .78, h * .26, h * .78], r: [0, r() * 6, 0], mat: 11, color: v });
      liste.push({ shape: 'foliage', p: [x + penche * h * .4 + 1, y + h * .82, z - .8], s: [h * .5, h * .2, h * .5], r: [0, r() * 6, 0], mat: 11, color: v.map(q => q * .9) });
      loin.push({ shape: 'foliage', p: [x, y + h * .9, z], s: [h * .8, h * .3, h * .8], mat: 11, color: v });
    } else if (essence === 'conifere') {
      for (let k = 0; k < 3; k++) liste.push({ shape: 'foliage', p: [x, y + h * (.38 + k * .22), z], s: [h * (.42 - k * .1), h * .34, h * (.42 - k * .1)], r: [0, r() * 6, 0], mat: 11, color: v.map(q => q * (1 - k * .06)) });
      loin.push({ shape: 'foliage', p: [x, y + h * .56, z], s: [h * .4, h * .8, h * .4], mat: 11, color: v });
    } else {
      const couronne = h * (.62 + r() * .2);
      liste.push({ shape: 'foliage', p: [x, y + h * .86, z], s: [couronne, couronne * .82, couronne], r: [0, r() * 6, 0], mat: 11, color: v });
      liste.push({ shape: 'foliage', p: [x + (r() - .5) * 2, y + h * .66, z + (r() - .5) * 2], s: [couronne * .7, couronne * .6, couronne * .7], r: [0, r() * 6, 0], mat: 11, color: v.map(q => q * .88) });
      loin.push({ shape: 'foliage', p: [x, y + h * .8, z], s: [couronne * 1.05, couronne * .9, couronne * 1.05], mat: 11, color: v });
    }
    // Le palier bas ignore l'habillage : la liste reste exactement celle d'aujourd'hui.
    if (qualite && qualite !== 'low') habiller(liste, loin, essence, qualite, h, penche, v);
  }

  function tribune(liste, loin, f, w, cote, longueur, r, gradins = null) {
    // Gradins face à la piste, côté gauche (cote −1) ou droit (+1), alignés sur la ligne droite.
    const recul = cote * (w + 9), rot = capRot(f.a), y0 = hauteurRoute(f, cote * w, w) - .2;
    const vers = (d, h, l = 0) => [f.x + f.r[0] * d + f.t[0] * l, y0 + h, f.z + f.r[2] * d + f.t[2] * l];
    const marches = 8, profondeur = 1.15, haut = .5;
    for (let m = 0; m < marches; m++) {
      const d = recul + cote * (m * profondeur + profondeur / 2);
      liste.push({ shape: 'box', collision: 'gradin', p: vers(d, (m + 1) * haut / 2), s: [longueur, (m + 1) * haut, profondeur], r: rot, mat: 3, color: [.62, .62, .6] });
      // spectateurs : une rangée de silhouettes colorées par marche, avec des trous. Avec le public (public.js), ce
      // sont de vrais corps dessinés à part : les mêmes nombres sont tirés, pour que la suite du décor ne change pas,
      // mais les boîtes ne sont pas posées.
      const rangee = [];
      for (let k = -longueur / 2 + .6; k < longueur / 2 - .4; k += .62) {
        if (r() < .22) continue;
        rangee.push(k);
        const silhouette = { shape: 'box', p: vers(d + cote * .1, (m + 1) * haut + .34, k), s: [.42, .68, .36], r: rot, mat: 18, color: PUBLICITES[Math.floor(r() * PUBLICITES.length)].map(v => v * (.6 + r() * .4)) };
        if (!gradins) liste.push(silhouette);
      }
      // au loin, la marche et sa foule en un bloc ; avec le public, la marche seule (les silhouettes restent des corps)
      loin.push(gradins ? { shape: 'box', p: vers(d, (m + 1) * haut / 2), s: [longueur, (m + 1) * haut, profondeur], r: rot, mat: 3, color: [.62, .62, .6] }
        : { shape: 'box', p: vers(d, (m + 1) * haut / 2 + .3, 0), s: [longueur, (m + 1) * haut + .6, profondeur], r: rot, mat: 18, color: [.42, .36, .34] });
    }
    if (gradins) gradins.push({ s: f.s, x: f.x, z: f.z, y: y0, a: f.a, cote, recul, longueur, marches, profondeur, haut });
    const fond = recul + cote * (marches * profondeur + .3);
    liste.push({ shape: 'box', collision: 'gradin', p: vers(fond, 3.6), s: [longueur, 7.2, .4], r: rot, mat: 3, color: [.55, .55, .53] });
    liste.push({ shape: 'box', collision: 'toit', p: vers(recul + cote * marches * profondeur * .5, 7.4), s: [longueur + 2, .3, marches * profondeur + 2.4], r: rot, mat: 0, color: [.80, .82, .84] });
    loin.push({ shape: 'box', p: vers(recul + cote * marches * profondeur * .5, 7.4), s: [longueur + 2, .3, marches * profondeur + 2.4], r: rot, mat: 0, color: [.80, .82, .84] });
    for (let k = -longueur / 2; k <= longueur / 2; k += 12) liste.push({ shape: 'cylinder', collision: 'pilier', p: vers(recul - cote * .3, 3.7, k), s: [.22, 7.4, .22], mat: 0, color: [.7, .72, .74] });
    // bandeau coloré sous le toit
    const teinte = PUBLICITES[Math.floor(r() * 4)];
    liste.push({ shape: 'box', p: vers(recul - cote * .9, 6.9, 0), s: [longueur + 2, .9, .12], r: rot, mat: 16, color: teinte });
  }

  function batimentStands(liste, loin, f, w, cote, longueur, matieres) {
    const rot = capRot(f.a), y0 = hauteurRoute(f, cote * w, w) - .2, recul = cote * (w + 13);
    const vers = (d, h, l = 0) => [f.x + f.r[0] * d + f.t[0] * l, y0 + h, f.z + f.r[2] * d + f.t[2] * l];
    liste.push({ shape: 'box', collision: 'batiment', p: vers(recul + cote * 6, 4), s: [longueur, 8, 12], r: rot, mat: 13.2, color: [.86, .84, .78] });
    loin.push({ shape: 'box', p: vers(recul + cote * 6, 4), s: [longueur, 8, 12], r: rot, mat: 13.2, color: [.86, .84, .78] });
    liste.push({ shape: 'box', collision: 'toit', p: vers(recul + cote * 6, 8.25), s: [longueur + 1, .5, 13], r: rot, mat: matieres ? matieres.metalPeint : 0, color: [.30, .32, .34] });
    for (let k = -longueur / 2 + 3; k < longueur / 2 - 2; k += 6) liste.push({ shape: 'box', p: vers(recul - cote * .02, 1.6, k), s: [4.4, 3.2, .12], r: rot, mat: 7, color: [.08, .09, .1] });
    // muret des stands
    liste.push({ shape: 'box', collision: 'muret', p: vers(cote * (w + 6.2), .55), s: [longueur + 30, 1.1, .5], r: rot, mat: 3, color: [.82, .82, .8] });
    liste.push({ shape: 'box', collision: 'muret', p: vers(cote * (w + 6.2), 1.2), s: [longueur + 30, .2, .54], r: rot, mat: 16, color: [.86, .12, .08] });
  }

  // ---------------------------------------------------------------- lots d'arbres (Moyenne et Fine)
  // Un lot historique tient 150 m de piste et tous les arbres à moins de 330 m : sa sphère atteint 280 m de rayon à
  // Val-Brûlé et 320 m à Haut-Col, et la version détaillée y vaut pour tous ses arbres jusqu'à 520 m au-delà de sa
  // surface, à 800 m de l'œil et plus. Les
  // arbres prennent donc des cases de 60 m (une case plus petite bascule plus juste mais ajoute des appels de
  // dessin), et chaque case bascule sur la taille projetée de ses arbres, mesurée pour un champ vertical de 60° sur
  // 1 080 pixels (le moteur l'adapte au champ et à la hauteur réels, rétroviseurs compris) : à BASCULE_ARBRES mètres
  // de sa sphère, un feuillu moyen (7 m) fait au plus 82 pixels de haut et le plus grand pin (11,7 m) 137. Aucun
  // arbre ne bascule plus grand que PIXELS_BASCULE : une case dont un arbre dépasse 12,8 m (grands conifères,
  // géants de Cap-Séquoia jusqu'à 47 m) recule sa bascule d'autant, jusqu'à près de 300 m. À cette taille la forme
  // lointaine garde pied, couronne et amas de la proche ; seuls les rameaux s'allègent. Aucune portée : rien ne se
  // coupe à distance, la version lointaine reste dessinée jusqu'au plan lointain.
  // Arbres isolés : une case de 60 m sur deux ne porte qu'un ou deux arbres, et un lot coûte un appel de dessin par
  // forme et par passe quel que soit son nombre d'arbres. Une case de moins de ARBRES_EPARS arbres rejoint donc la
  // case éparse de CASE_EPARSE mètres (quatre cases) qui la contient : peu d'arbres, qui basculent plus tôt du côté
  // proche de la sphère et plus tard de l'autre, jamais plus près.
  const CASE_ARBRES = 60, BASCULE_ARBRES = 80, PIXELS_BASCULE = 150, ARBRES_EPARS = 3, CASE_EPARSE = 2 * CASE_ARBRES;
  const reculGeant = hauteur => hauteur * 1080 / (2 * Math.tan(Math.PI / 6) * PIXELS_BASCULE);
  const basculeCase = (hauteur, base = BASCULE_ARBRES) => Math.max(base, reculGeant(hauteur));
  function sansObjetsArbres(objets, arbres) {
    let i=0;
    while (i<objets.length && !arbres.has(objets[i])) i++;
    if (i===objets.length) return objets;
    const gardes=objets.slice(0,i);
    for (i++; i<objets.length; i++) if (!arbres.has(objets[i])) gardes.push(objets[i]);
    return gardes;
  }
  function lotsImage(lots, cases, objetsArbres) {
    // Le mobilier garde ses lots, leurs sphères et leurs bascules : seuls les arbres en sortent.
    const sortie = [];
    for (const l of lots) {
      const objets = sansObjetsArbres(l.objets,objetsArbres), loin = sansObjetsArbres(l.loin,objetsArbres);
      if (objets===l.objets && loin===l.loin) sortie.push(l);
      else if (objets.length) sortie.push(Object.assign({}, l, { objets, loin }));
    }
    // Cases denses telles quelles, cases éparses regroupées, dans l'ordre où leur premier arbre est apparu.
    const groupes = [], eparses = new Map();
    for (const [cle, c] of cases) {
      let troncs=0;
      for (const o of c.objets) if (o.collision==='tronc' && ++troncs>=ARBRES_EPARS) break;
      if (troncs>=ARBRES_EPARS) { groupes.push(c); continue; }
      const [i, j] = cle.split(',').map(Number), grande = Math.floor(i / 2) + ',' + Math.floor(j / 2);
      let e = eparses.get(grande);
      if (!e) { eparses.set(grande, e = { objets: [], loin: [] }); groupes.push(e); }
      e.objets.push(...c.objets); e.loin.push(...c.loin);
    }
    for (const c of groupes) {
      // Centre de la boîte des positions (et non leur moyenne) : la sphère la plus juste décide de la bascule.
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const o of c.objets) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], o.p[k]); max[k] = Math.max(max[k], o.p[k]); }
      const mx = (min[0] + max[0]) / 2, my = (min[1] + max[1]) / 2, mz = (min[2] + max[2]) / 2;
      let rayon = 0, hauteur = 0;
      for (let modele=0; modele<2; modele++) for (const o of (modele ? c.loin : c.objets))
        rayon = Math.max(rayon, Math.hypot(o.p[0] - mx, o.p[1] - my, o.p[2] - mz) + Math.hypot(o.s[0], o.s[1], o.s[2]) / 2);
      // Le tronc porte 84 % de la hauteur de son arbre (arbre(), géants compris).
      for (const o of c.objets) if (o.collision === 'tronc') hauteur = Math.max(hauteur, o.s[1] / .84);
      sortie.push({ objets: c.objets, loin: c.loin, centre: [mx, my, mz], rayon, portee: Infinity, bascule: basculeCase(hauteur),
        lodReferenceFov: 60, lodReferenceHeight: 1080, arbres: true, hauteurArbres: hauteur });
    }
    return sortie;
  }
  // Distance de bascule des lots d'arbres (mètres à 60° et 1 080 pixels, BASCULE_ARBRES par défaut), à poser sur
  // decor.lots ou sur la copie du moteur des rétroviseurs ; le moteur relit lot.bascule à chaque image. La case d'un
  // géant garde son recul (PIXELS_BASCULE). Rend le nombre de lots réglés.
  function basculeArbres(lots, metres) {
    if (!Array.isArray(lots) || !Number.isFinite(metres) || metres <= 0) return 0;
    let n = 0;
    for (const l of lots) if (l && l.arbres === true) {
      l.bascule = basculeCase(l.hauteurArbres || 0, metres); n++;
    }
    return n;
  }
  // Lots pour un second moteur (rétroviseurs) : copies sans tampons, comme celles que jeu.js donne à la glace. Avec
  // { arbresLointains: true }, chaque lot d'arbres ne garde que sa version lointaine, à toute distance.
  function lotsSecondMoteur(decor, options = {}) {
    return (decor && decor.lots || []).map(l => Object.assign({}, l, { tampon: null, tamponLoin: null, paquet: null, paquetLoin: null },
      options.arbresLointains && l.arbres === true ? { objets: l.loin } : null));
  }

  // Repères de conduite : plan visuel indépendant des anciens maxima qui placent les murs de pneus.
  // Ni tirage aléatoire ni écriture dans le circuit ; seules les couleurs des vibreurs/lisses changent.
  const distanceRepere = (c, a, b) => ((b - a) % c.longueur + c.longueur) % c.longueur;
  function zoneSansRepere(c, s, marge = 12) {
    const ld = c.ligneDroite || { debut: -200, fin: 200 }, x = B.circuit.ecart(c, 0, s);
    const avant = Math.max(-300, B.circuit.ecart(c, 0, ld.debut) + 40) - 10;
    const apres = Math.min(260, B.circuit.ecart(c, 0, ld.fin) - 60) + 50;
    if (x >= avant - marge && x <= apres + marge) return true;
    for (const t of (c.couverts || (c.tunnel ? [c.tunnel] : []))) {
      if (distanceRepere(c, t.debut - marge, s) <= distanceRepere(c, t.debut, t.fin) + 2 * marge) return true;
    }
    for (const p of (c.ponts || [])) {
      if (distanceRepere(c, p.debut - 20, s) <= distanceRepere(c, p.debut, p.fin) + 40) return true;
    }
    return false;
  }
  const plansReperes = new WeakMap();
  function preparerReperes(c) {
    const connu = plansReperes.get(c);
    if (connu) return connu;
    const virages = B.virages.planifier(c).filter(v => v.difficulte >= 2);
    const vibreurs = new Uint8Array(c.n), glissieres = new Int8Array(c.n);
    const priorite = new Float64Array(c.n).fill(Infinity);
    const periode = c.ouvert ? c.n - 1 : c.n;
    // Un virage n'affecte que son approche (120 m), sa courbe et sa sortie (24 m).
    // Visiter ces fenêtres évite de comparer chaque point des 32 km de Larche à tous les virages.
    for (const v of virages) {
      const debut = Math.floor((v.debut - 120) / c.pas) - 1;
      const fin = Math.ceil((v.debut + v.longueur + 24) / c.pas) + 1;
      for (let j = debut; j <= fin; j++) {
        const i = ((j % periode) + periode) % periode, s = i * c.pas;
        const courbe = distanceRepere(c, v.debut, s) <= v.longueur;
        const avant = distanceRepere(c, s, v.debut), apres = distanceRepere(c, v.fin, s);
        const d = courbe ? -1 : avant <= 120 ? avant : apres <= 24 ? apres + 120 : Infinity;
        if (d >= priorite[i]) continue;
        priorite[i] = d;
        glissieres[i] = -v.sens;
        vibreurs[i] = courbe ? v.difficulte : 0;
      }
    }
    // Une spéciale conserve deux échantillons distincts aux extrémités, avec leurs
    // propres exclusions de grille, de pont et de tunnel.
    if (c.ouvert) { vibreurs[periode] = vibreurs[0]; glissieres[periode] = glissieres[0]; }
    for (let i = 0; i < c.n; i++) {
      if (glissieres[i] && zoneSansRepere(c, i * c.pas)) { vibreurs[i] = 0; glissieres[i] = 0; }
    }
    const plan = { virages, vibreurs, glissieres };
    plansReperes.set(c, plan);
    return plan;
  }

  const CHIFFRES_REPERES = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
  const SEGMENTS_REPERES = {
    a: [0, .58, .52, .12], b: [.26, .29, .12, .48], c: [.26, -.29, .12, .48], d: [0, -.58, .52, .12],
    e: [-.26, -.29, .12, .48], f: [-.26, .29, .12, .48], g: [0, 0, .52, .12]
  };
  function poserReperes(c, plan, lim, interroger, ajouter) {
    const w = c.largeur / 2;
    function panneau(v, s, metres) {
      const f = cadre(c, Math.round(s / c.pas)), ext = -v.sens, largeur = 3.2, L = (ext < 0 ? lim.G : lim.D)[f.i];
      if (zoneSansRepere(c, f.s)) return;
      // Dans un enchaînement, les chevrons du virage en cours restent le seul ordre de direction.
      if (metres && plan.virages.some(q => q !== v && distanceRepere(c, q.debut, f.s) <= q.longueur)) return;
      const d = ext * (L + largeur / 2 + 1.4), y = hauteurRoute(f, ext * w, w) - .02 * (Math.abs(d) - w - 1.2);
      const p = pointPlan(f, d, y), rot = capRot(f.a);
      // Toute l'emprise reste derrière les limites, y compris quand un autre bras de piste revient à proximité.
      for (const lateral of [-largeur / 2, 0, largeur / 2]) {
        const x = p[0] + f.r[0] * lateral, z = p[2] + f.r[2] * lateral, q = interroger(x, z, 80);
        if (q.i < 0) return;
        const fq = cadre(c, q.i), dq = (x - fq.x) * fq.r[0] + (z - fq.z) * fq.r[2];
        if (Math.abs(dq) < (dq < 0 ? lim.G : lim.D)[q.i] + .6) return;
      }
      const repere = { type: metres ? 'freinage' : 'chevrons', virage: v.id, s: f.s, sens: v.sens, metres: metres || 0 };
      const objets = [], blanc = [.98, .99, .96], face = (lateral, hauteur, avant = .1) =>
        [p[0] + f.r[0] * lateral - f.t[0] * avant, y + hauteur, p[2] + f.r[2] * lateral - f.t[2] * avant];
      const boite = (partie, position, taille, couleur, rotation = rot) => objets.push({
        shape: 'box', p: position, s: taille, r: rotation, mat: 16, color: couleur, repereVirage: repere, symboleVirage: partie
      });
      for (const cote of [-1, 1]) boite('poteau', face(cote * 1.05, 1.3, 0), [.1, 2.6, .1], [.38, .42, .45]);
      boite('panneau', face(0, 2.7, 0), [.14, 1.9, largeur], blanc);
      if (metres) {
        boite('bande', face(0, 3.48), [.03, .12, 2.96], [.82, .025, .02]);
        const chiffres = String(metres);
        for (let i = 0; i < chiffres.length; i++) for (const segment of CHIFFRES_REPERES[Number(chiffres[i])]) {
          const [dx, dy, sx, sy] = SEGMENTS_REPERES[segment];
          boite('chiffre', face((i - (chiffres.length - 1) / 2) * .84 + dx, 2.68 + dy), [.03, sy, sx], [.025, .035, .045]);
        }
      } else {
        boite('fond', face(0, 2.7), [.03, 1.55, 2.96], [.025, .10, .25]);
        for (const centre of [-.7, .7]) for (const cote of [-1, 1]) {
          const a = face(centre - v.sens * .45, 2.7 + cote * .5, .14), b = face(centre + v.sens * .45, 2.7, .14);
          const axe = b.map((x, i) => x - a[i]), rotation = angles(...base(axe, f.t.map(x => -x)));
          boite('chevron', a.map((x, i) => (x + b[i]) / 2), [Math.hypot(...axe), .035, .19], blanc, rotation);
        }
      }
      for (const o of objets) if (o.symboleVirage === 'poteau' || o.symboleVirage === 'panneau') marquerSolide(o, 'repere-virage');
      // La distance et la qualité ne retirent jamais les chiffres ou les flèches.
      ajouter(objets, objets.slice(), p[0], p[2]);
    }
    for (const v of plan.virages) {
      for (const metres of (v.difficulte === 3 ? [200, 150, 100, 50] : [150, 100, 50])) panneau(v, v.debut - metres, metres);
      // Les bandeaux de course prennent en charge la direction sur toute la courbe.
      if (B.signalisationCourse) continue;
      const nombre = Math.max(2, Math.min(5, Math.ceil(v.longueur / 38))), marge = Math.min(14, v.longueur * .15);
      for (let j = 0; j < nombre; j++) panneau(v, v.debut + marge + (v.longueur - 2 * marge) * j / (nombre - 1), 0);
    }
  }

  // Les secteurs ne contiennent que des indices. La géométrie du premier plan,
  // des deux joueurs et des plans éloignés de la démo peut arriver dans tout ordre.
  function creerFluxDecor(lots) {
    const taille = 320, portee = 800, seuil = 64;
    const colonnes = new Map(), grands = [], candidats = [], dernieresVues = [];
    const distances = new Float64Array(lots.length), visites = new Uint32Array(lots.length);
    let passage = 0, curseur = 0;
    for (let i = 0; i < lots.length; i++) {
      const {centre, rayon} = lots[i];
      if (!centre || !Number.isFinite(rayon) || rayon > taille * 2) { grands.push(i); continue; }
      const x0 = Math.floor((centre[0] - rayon) / taille), x1 = Math.floor((centre[0] + rayon) / taille);
      const z0 = Math.floor((centre[2] - rayon) / taille), z1 = Math.floor((centre[2] + rayon) / taille);
      for (let x = x0; x <= x1; x++) {
        let colonne = colonnes.get(x);
        if (!colonne) colonnes.set(x, colonne = new Map());
        for (let z = z0; z <= z1; z++) {
          let indices = colonne.get(z);
          if (!indices) colonne.set(z, indices = []);
          indices.push(i);
        }
      }
    }
    function retenir(i, vue) {
      const lot = lots[i], p = lot.centre;
      if (!p) return;
      const d = Math.max(0, Math.hypot(p[0]-vue[0], p[1]-vue[1], p[2]-vue[2]) - lot.rayon);
      if (d > Math.min(portee, (lot.portee || Infinity) + seuil * 2) ||
          (lot.detailProcheSeul && d > lot.bascule + seuil * 2)) return;
      if (visites[i] !== passage) {
        visites[i] = passage; distances[i] = d; candidats.push(i);
      } else if (d < distances[i]) distances[i] = d;
    }
    function recadrer(vues) {
      passage++; curseur = 0; candidats.length = 0;
      for (let v = 0; v < vues.length; v++) {
        const p = vues[v], ancre = dernieresVues[v] || (dernieresVues[v] = [0,0,0]);
        ancre[0] = p[0]; ancre[1] = p[1]; ancre[2] = p[2];
        const z0 = Math.floor((p[2]-portee)/taille), z1 = Math.floor((p[2]+portee)/taille);
        for (let x = Math.floor((p[0]-portee)/taille); x <= Math.floor((p[0]+portee)/taille); x++) {
          const colonne = colonnes.get(x);
          if (!colonne) continue;
          for (let z = z0; z <= z1; z++) {
            const indices = colonne.get(z);
            if (indices) for (const i of indices) retenir(i,p);
          }
        }
        for (const i of grands) retenir(i,p);
      }
      dernieresVues.length = vues.length;
      candidats.sort((a,b) => distances[a]-distances[b] || a-b);
    }
    return {
      approcher(vues, dt, preparer) {
        let bouge = vues.length !== dernieresVues.length;
        for (let i = 0; !bouge && i < vues.length; i++) {
          const p = vues[i], q = dernieresVues[i];
          bouge = (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2 >= seuil**2;
        }
        if (bouge) recadrer(vues);
        if (curseur >= candidats.length) return;
        // Plafond souple entre deux lots : un lot visible manquant est toujours servi
        // au dessin, y compris après un changement instantané de caméra.
        const fin = performance.now() + (dt > 1/55 ? .32 : 1.15);
        let charges = 0;
        do {
          const i = candidats[curseur++];
          const lot = lots[i], loinSeul = distances[i] > (lot.bascule || 240) + seuil * 2;
          if (preparer ? preparer(i, loinSeul) : lot.preparerDetail?.()) charges++;
        } while (curseur < candidats.length && charges < 3 && performance.now() < fin);
      }
    };
  }

  const HERBIERS = new WeakMap();
  function secteursDesLieux(c) {
    const paysages = B.saisons?.secteurs?.(c)?.plages;
    const portionsLieux = paysages?.map(p => ({ theme: p.theme, debut: p.debut, fin: p.fin }));
    if (portionsLieux?.length > 1 && portionsLieux[0].theme === portionsLieux.at(-1).theme) {
      // La première boucle peut traverser la ligne de départ.
      portionsLieux[0].debut = portionsLieux.pop().debut - c.longueur;
    }
    if (!portionsLieux) return null;
    const secteurs = [];
    for (const p of portionsLieux) {
      const premier = Math.ceil(p.debut / c.pas), n = Math.ceil(p.fin / c.pas) - premier;
      if (n <= 0) continue;
      const modulo = (v, periode) => ((v % periode) + periode) % periode;
      const origine = c.tronconsThemes.find(t => t.theme === p.theme);
      const secteur = { theme: p.theme, graine: origine?.graine ?? c.graine, n,
        indice: (fraction, delta) => modulo(premier + modulo(Math.floor(fraction * n) + delta, n), c.n),
        position: (fraction, delta) => modulo(p.debut + modulo(fraction * (p.fin-p.debut) + delta, p.fin-p.debut), c.longueur) };
      secteurs.push(secteur);
    }
    return secteurs;
  }

  function construire(c, options = {}) {
    const th = Object.assign({}, THEMES[c.theme] || (B.destinations && B.destinations.THEMES && B.destinations.THEMES[c.theme]) || THEMES.foret), g = (c.graine * 7919 + 13) >>> 0, r = alea(g);
    const qualite = normaliserQualite(options.qualite);
    const pierresProcedurales = c.theme === 'montagne' && qualite === 'high'
      && options.matieres !== false && options.pierresProcedurales === true;
    const organique = options.organique === true && !!B.lieux;
    const ecologie = B.ecologie ? B.ecologie.creer(c.graine, c.theme) : null;
    const saison = B.saisons ? B.saisons.profil(options.saison, c.theme) : null;
    if (c.theme === 'foret' && options.matieres !== false) th.matieres = MATIERES_PILOTES;
    // Les deux enrobés conservent le pigment du circuit et le film d'eau ; le palier léger omet le relief fin.
    th.asphalte = qualite!=='low' && options.matieres!==false ? MATIERES_PILOTES.asphalte : 14.125;
    // l'eau ne noie jamais la piste : le niveau descend sous le point le plus bas de l'axe (le virage de
    // Port-Sable plongeait à −5,8 sous le niveau −4 du thème cote, David 14/11)
    if (th.eau !== undefined) {
      let yMin = Infinity;
      for (let i = 0; i < c.n; i++) yMin = Math.min(yMin, c.y[i]);
      th.eau = Math.min(th.eau, yMin - 2.5);
    }
    const w = c.largeur / 2, lim = limites(c), interroger = indexAxe(c);
    const portionsLieux = secteursDesLieux(c), secteurFjord = portionsLieux?.find(p => p.theme === 'fjord');
    const pontFjord = (!portionsLieux || secteurFjord) && B.destinations?.planPontFjord?.(c, secteurFjord);
    // bords de route (lot 22F) : plan tiré avec la graine propre de bords.js, jamais avec le hasard du décor
    const planBords = B.bords ? B.bords.planifier(c) : null;
    // Le repli false sert à relire l'oracle visuel historique, sans changer les empreintes de référence.
    const reperes = options.reperesVirages !== false && B.virages ? preparerReperes(c) : null;
    let tunnelLampes = null;   // positions des lampes du tunnel : le jeu en fait des lumières près de la caméra
    const nappes = nappesRoute(c, th, lim, qualite === 'low' ? null : ecologie, saison, reperes, pontFjord);
    const terrain = nappesTerrain(c, th, interroger, g, qualite === 'low' ? null : ecologie, options.organique === true, saison, options.cachePanorama, pontFjord);
    const maisonsBaikal = terrain.paysageBaikal ? B.baikal.habitations(c, terrain, interroger, terrain.paysageBaikal) : null;
    // Hasard architectural séparé ; le repli sert seulement à relire l'oracle historique du décor.
    const architecture = options.batiments !== false && B.batiments ? { maisons: [], stands: [] } : null;
    if (saison) {
      const habitat = {}, couleur = [0, 0, 0], teinte = [0, 0, 0], autreTeinte = [0, 0, 0];
      for (const n of nappes.concat(terrain.liste)) {
        if (n.surfaceType === 'panorama') continue;
        if (n.surfaceType!=='accotement' && n.surfaceType!=='terrain') continue;
        for (let v=0; v<n.sommets.length/13; v++) {
          const j=v*13;
          const partSaison=n.coefficientsSaison ? n.coefficientsSaison[v]/255
            : n.surfaceType==='accotement' ? Number(n.sommets[j+9]===8)
            : lisse(.47,.82,n.sommets[j+4])*(n.surfaceType==='terrain' && th.eau!==undefined ? lisse(th.eau+.7,th.eau+4,n.sommets[j+1]) : 1);
          if (!partSaison) continue;
          const k = v * 13, x = n.sommets[k], z = n.sommets[k + 2];
          if (ecologie) ecologie.echantillonner(x, z, habitat);
          for (let a = 0; a < 3; a++) couleur[a] = n.sommets[k + 10 + a];
          const part = terrain.partSecondaire ? terrain.partSecondaire(x,z) : 0;
          B.saisons.teinte(part === 1 ? terrain.saisonSecondaire : saison, 'sol', couleur, x, z, ecologie ? habitat : null, teinte);
          if (part > 0 && part < 1) {
            B.saisons.teinte(terrain.saisonSecondaire, 'sol', couleur, x, z, ecologie ? habitat : null, autreTeinte);
            for (let a=0; a<3; a++) teinte[a] += (autreTeinte[a]-teinte[a])*part;
          }
          for (let a = 0; a < 3; a++) n.sommets[k + 10 + a] = couleur[a]+(teinte[a]-couleur[a])*partSaison;
        }
        if (n.coefficientsSaison) delete n.coefficientsSaison;
      }
    }
    terrain.raccorderPigments?.();
    const groupes = new Map();   // lots par portion de 150 m, plus lots lointains
    const TRONCON = 150;
    const lotDe = (x, z, i) => {
      const cle = i >= 0 ? 'p' + Math.floor(i * c.pas / TRONCON) : 'l' + Math.floor(x / 420) + ',' + Math.floor(z / 420);
      let l = groupes.get(cle); if (!l) groupes.set(cle, l = { objets: [], loin: [], lointain: i < 0 }); return l;
    };
    const ajouter = (objets, loin, x, z) => {
      const q = interroger(x, z, 300, true), proche = q.i >= 0 && q.d < 330, l = lotDe(x, z, proche ? q.i : -1);
      for (const o of objets) l.objets.push(o);
      for (const o of loin) l.loin.push(o);
    };

    // Glissières à double lisse sur poteaux, posées à la limite de chaque côté.
    const railsVirages=[], sensVirage=new Int8Array(c.n);
    for (const v of B.virages?.planifier(c) || []) {
      const debut=Math.round(v.debut/c.pas), fin=Math.ceil((v.debut+v.longueur)/c.pas-1e-8);
      for (let j=debut;j<fin;j++) sensVirage[j%c.n]=v.sens;
    }
    const PAS_G = c.ouvert ? 2 : 4, sousTunnel = i => B.circuit.dansTunnel && B.circuit.dansTunnel(c, i * c.pas, 6);
    const finG = c.ouvert ? c.n - PAS_G : c.n;
    for (let i = 0; i < finG; i += PAS_G) {
      if (sousTunnel(i)) continue;
      for (const cote of [-1, 1]) {
        const f0 = cadre(c, i), f1 = cadre(c, i + PAS_G), L0 = (cote < 0 ? lim.G : lim.D)[f0.i], L1 = (cote < 0 ? lim.G : lim.D)[f1.i];
        const y0 = hauteurRoute(f0, cote * w, w) - .02 * (L0 - w - 1.2), y1 = hauteurRoute(f1, cote * w, w) - .02 * (L1 - w - 1.2);
        const p0 = pointPlan(f0, cote * L0, y0), p1 = pointPlan(f1, cote * L1, y1);
        const dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], long = Math.hypot(...dir);
        const [ax, ay, az] = base(dir, [0, 1, 0]), rot = angles(ax, ay, az);
        const milieu = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2];
        const objets = [
          { shape: 'box', p: [milieu[0], milieu[1] + .62, milieu[2]], s: [long + .25, .34, .07], r: rot, mat: 0, color: [.74, .76, .78], detail: 1 },
          { shape: 'box', p: [p0[0], p0[1] + .4, p0[2]], s: [.09, .8, .09], r: rot, mat: 0, color: [.5, .52, .54], detail: 2 }
        ];
        marquerSolide(objets[0], 'glissiere'); marquerSolide(objets[1], 'poteau-glissiere');
        if (reperes && reperes.glissieres[f0.i] === cote) {
          objets[0].color = Math.floor(f0.s / 16) % 2 ? [.82, .025, .02] : [.98, .99, .96];
          objets[0].repereVirage = { type: 'glissiere', s: f0.s, cote };
        }
        const loin = [objets[0]];
        // panneaux publicitaires sur les lignes droites (sauf front de mer marseillais)
        if (c.id !== 'marseille' && Math.abs(f0.k) < 1 / 500 && (i / PAS_G) % 9 === 4 && r() < .7) {
          const coul = PUBLICITES[Math.floor(r() * PUBLICITES.length)], coul2 = PUBLICITES[Math.floor(r() * PUBLICITES.length)];
          const pp = [milieu[0] - az[0] * cote * .18, milieu[1] + 1.25, milieu[2] - az[2] * cote * .18];
          objets.push({ shape: 'box', p: pp, s: [long * .9, .9, .06], r: rot, mat: 16, color: coul });
          marquerSolide(objets[objets.length - 1], 'publicite');
          objets.push({ shape: 'box', p: [pp[0] - az[0] * cote * .04, pp[1] + .12, pp[2] - az[2] * cote * .04], s: [long * .55, .26, .03], r: rot, mat: 16, color: coul2 });
          loin.push(objets[objets.length - 2]);
        }
        // lot 22F : le parapet d'un vide, le muret ou les balises d'un fossé remplacent la glissière ; le hasard du décor
        // est déjà tiré et le lot est créé au même moment, l'ordre des lots ne change pas
        if (planBords && B.bords.sansGlissiere(c, i, cote)) { objets.splice(0, 2); loin.splice(0, 1); }
        else {
          const sens=sensVirage[i] || (Math.abs(f0.k)>1/350 ? Math.sign(f0.k) : 0);
          if (cote===-sens) railsVirages.push({rail:objets[0],haut:ay,s:f0.s,cote,longueur:long});
        }
        ajouter(objets, loin, milieu[0], milieu[2]);
      }
    }

    // Tunnel de Haut-Col (circuit.js, c.tunnel) : murs de béton aux limites, voûte, lampes, deux portails dans la roche
    // et la montagne autour (flancs posés au sol contre les murs, crête sur la voûte, rien ne dépasse à l'intérieur).
    // L'intérieur est éclairé « dedans » (outdoor: false : ni soleil ni ciel, seulement les lampes) ; la chaussée y est
    // doublée d'un revêtement intérieur, car la nappe de la route reste éclairée par le ciel. Pas de pluie dedans (jeu.js).
    for (const T of (B.couverts ? B.couverts.liste(c) : c.tunnel ? [c.tunnel] : [])) {
      if (T.type === 'galerie') {
        const galerie = B.couverts.construireGalerie(c, T);
        for (const lot of galerie.lots) ajouter(lot.objets, lot.loin, lot.x, lot.z);
        if (!tunnelLampes) tunnelLampes = [];
        tunnelLampes.push(...galerie.lampes);
        continue;
      }
      const PAS_T = 3, iD = T.debut / c.pas, iF = (T.debut + (B.couverts ? B.couverts.longueur(c, T) : T.fin - T.debut)) / c.pas, M = T.mur, H = T.hauteur;
      const BETON = [.50, .50, .48], VOUTE = [.22, .22, .23], SOL = [.20, .20, .205], LIGNE = [.82, .82, .78];
      const ROCHE = [.43, .41, .38], ROCHE2 = [.36, .35, .33], ROCHE3 = [.48, .46, .42];
      if (!tunnelLampes) tunnelLampes = [];
      for (let i = iD; i < iF; i += PAS_T) {
        const suivant = Math.min(i + PAS_T, iF), f0 = cadreOuvrage(c, i), f1 = cadreOuvrage(c, suivant), y0 = hauteurRoute(f0, 0, w), y1 = hauteurRoute(f1, 0, w);
        const objets = [], loin = [];
        const a0 = pointPlan(f0, 0, y0), a1 = pointPlan(f1, 0, y1), axe = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], longueurAxe = Math.hypot(...axe);
        // Deux boîtes de longueur centrale laissent une fente du côté extérieur d'une courbe.
        // Prolonger seulement les joints intérieurs, selon l'angle des vraies cordes voisines ;
        // les portails et le tunnel droit historique gardent exactement leurs extrémités.
        const raccord = (dx, dz) => {
          const angle = Math.abs(Math.atan2(dx * axe[2] - dz * axe[0], dx * axe[0] + dz * axe[2]));
          return angle < 1e-7 ? 0 : Math.tan(Math.min(angle / 2, .45));
        };
        const avant = i > iD ? cadreOuvrage(c, Math.max(iD, i - PAS_T)) : null;
        const apres = suivant < iF ? cadreOuvrage(c, Math.min(iF, suivant + PAS_T)) : null;
        const joint0 = avant ? raccord(f0.x - avant.x, f0.z - avant.z) : 0;
        const joint1 = apres ? raccord(apres.x - f1.x, apres.z - f1.z) : 0;
        const ajout0 = (M + .7) * joint0, ajout1 = (M + .7) * joint1;
        const long = longueurAxe + .05 + ajout0 + ajout1, translation = (ajout1 - ajout0) / (2 * longueurAxe);
        const no = [Math.sin(f0.devers) * f0.r[0], Math.cos(f0.devers), Math.sin(f0.devers) * f0.r[2]], rotSol = angles(...base(axe, no));
        const milieu = (d, h) => { const p = pointPlan(f0, d, (y0 + y1) / 2 + h), q = pointPlan(f1, d, 0); return [(p[0] + q[0]) / 2 + axe[0] * translation, p[1] + axe[1] * translation, (p[2] + q[2]) / 2 + axe[2] * translation]; };
        // Affiner les tunnels explicites aux portails et dès que la courbe, le dévers ou la pente varient :
        // évite toute marche rigide entre deux dalles de 6 m (bug collision/envolée dans le Tunnel du Rocher).
        const deversVarie = Math.abs(f1.devers - f0.devers) > .0015 || Math.abs(Math.atan2(Math.sin(f1.a - f0.a), Math.cos(f1.a - f0.a))) > .004 || Math.abs((y1 - y0) / Math.max(1e-6, longueurAxe) - (c.pente?.[f0.i] || 0)) > .002;
        if (T.type === 'tunnel' && ((iF - suivant) * c.pas < 18 || (i - iD) * c.pas < 18 || deversVarie)) {
          const rehausse = j => { const u = Math.max(0, Math.min(1, Math.min(j - iD, iF - j) * c.pas / 6)); return .002 + .038 * u * u * (3 - 2 * u); };
          const presPortail = (iF - suivant) * c.pas < 14 || (i - iD) * c.pas < 14;
          const pasSol = (presPortail ? .5 : 1.0) / c.pas;
          const nombre = Math.max(1, Math.ceil((suivant - i) / pasSol));
          for (let partie = 0; partie < nombre; partie++) {
            const j0 = i + (suivant - i) * partie / nombre, j1 = i + (suivant - i) * (partie + 1) / nombre;
            const q0 = cadreOuvrage(c, j0), q1 = cadreOuvrage(c, j1), h0 = rehausse(j0), h1 = rehausse(j1);
            const qy0 = hauteurRoute(q0, 0, w), qy1 = hauteurRoute(q1, 0, w);
            const direction = [q1.x - q0.x, qy1 + h1 - qy0 - h0, q1.z - q0.z], longueur = Math.hypot(...direction);
            const horizontale = Math.hypot(direction[0], direction[2]), devers = (q0.devers + q1.devers) / 2;
            const normale = [-Math.sin(devers) * direction[2] / horizontale, Math.cos(devers), Math.sin(devers) * direction[0] / horizontale];
            const axes = base(direction, normale), rotation = angles(...axes);
            // La section commune au joint suit le cap de la route. Sur chaque dalle, projeter
            // le bord de cette section sur son axe réel (corde 3D), des deux côtés séparément.
            // Le cap interpolé peut tourner même quand la corde suit un seul segment du tracé.
            const debord = q => M * Math.abs(q.r[0] * axes[0][0] - Math.sin(q.devers) * axes[0][1] + q.r[2] * axes[0][2]);
            const extension0 = j0 > iD ? debord(q0) : 0, extension1 = j1 < iF ? debord(q1) : 0;
            const taille = longueur + .02 + extension0 + extension1;
            const antiZ = (partie & 1) ? .0008 : 0, decalage = (extension1 - extension0) / 2;
            const dessus = [(q0.x + q1.x) / 2, (qy0 + qy1 + h0 + h1) / 2 + antiZ, (q0.z + q1.z) / 2];
            const centreDalle = dessus.map((v, k) => v + decalage * axes[0][k]);
            const position = centreDalle.map((v, k) => v - .05 * axes[1][k]);
            const sol = marquerSolide({ shape: 'box', p: position, s: [taille, .1, 2 * M], r: rotation, mat: organique ? 21 : 7, color: SOL, outdoor: false, surface: 'object' }, 'sol-tunnel', 1, 'piste');
            objets.push(sol); loin.push(sol);
            for (const cote of [-1, 1]) {
              const p = dessus.map((v, k) => v + cote * (w - .15) * axes[2][k] + .006 * axes[1][k]);
              objets.push({ shape: 'box', p, s: [longueur + .04, .02, .26], r: rotation, mat: 7, color: LIGNE, outdoor: false, surface: 'object' });
            }
          }
        } else {
          // Revêtement intérieur et lignes de rive. Les ouvrages explicites raccordent leur
          // surépaisseur de 4 cm sur six mètres : sur une descente, sa tranche verticale arrêtait
          // le châssis avant l'entrée. Le tunnel historique sans type garde sa géométrie qualifiée.
          let positionSol = milieu(0, -.01), rotationSol = rotSol, longSol = long, centreDessus = null, axesSol = null;
          if (T.type === 'tunnel') {
            const rehausse = j => { const u = Math.max(0, Math.min(1, Math.min(j - iD, iF - j) * c.pas / 6)); return .002 + .038 * u * u * (3 - 2 * u); };
            const h0 = rehausse(i), h1 = rehausse(suivant), axeSol = [axe[0], axe[1] + h1 - h0, axe[2]], normeSol = Math.hypot(...axeSol);
            axesSol = base(axeSol, no); rotationSol = angles(...axesSol);
            const decalageSol = (ajout1 - ajout0) / (2 * normeSol);
            centreDessus = [(a0[0] + a1[0]) / 2, (y0 + y1 + h0 + h1) / 2, (a0[2] + a1[2]) / 2].map((v, k) => v + axeSol[k] * decalageSol);
            positionSol = centreDessus.map((v, k) => v - .05 * axesSol[1][k]);
            longSol = normeSol + .05 + ajout0 + ajout1;
          }
          const sol = marquerSolide({ shape: 'box', p: positionSol, s: [longSol, .1, 2 * M], r: rotationSol, mat: organique ? 21 : 7, color: SOL, outdoor: false, surface: 'object' }, 'sol-tunnel', 1, 'piste');
          objets.push(sol); loin.push(sol);
          for (const cote of [-1, 1]) {
            const p = centreDessus ? centreDessus.map((v, k) => v + cote * (w - .15) * axesSol[2][k] + .005 * axesSol[1][k]) : milieu(cote * (w - .15), .045);
            objets.push({ shape: 'box', p, s: [longSol, .02, .26], r: rotationSol, mat: 7, color: LIGNE, outdoor: false, surface: 'object' });
          }
        }
        for (const cote of [-1, 1]) {
          const p0 = pointPlan(f0, cote * (M + .3), y0), p1 = pointPlan(f1, cote * (M + .3), y1);
          const dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], rot = angles(...base(dir, [0, 1, 0]));
          const courbe = joint0 > 0 || joint1 > 0, longueurMur = courbe ? Math.hypot(...dir) : longueurAxe;
          const longMur = courbe ? longueurMur + .05 + .3 * (joint0 + joint1) : long;
          const translationMur = courbe ? .3 * (joint1 - joint0) / (2 * longueurMur) : 0;
          const m = [(p0[0] + p1[0]) / 2 + dir[0] * translationMur, (p0[1] + p1[1]) / 2 + dir[1] * translationMur, (p0[2] + p1[2]) / 2 + dir[2] * translationMur];
          const mur = marquerSolide({ shape: 'box', p: [m[0], m[1] + H / 2 - .2, m[2]], s: [longMur, H + .4, .6], r: rot, mat: 3, color: BETON, outdoor: false }, 'mur-tunnel');
          objets.push(mur); loin.push(mur);
          // bande réfléchissante, et une lampe tous les 12 m de chaque côté, en quinconce
          objets.push({ shape: 'box', p: [m[0] - f0.r[0] * cote * .32, m[1] + .9, m[2] - f0.r[2] * cote * .32], s: [longMur, .14, .02], r: rot, mat: 16, color: [.85, .72, .2], outdoor: false });
          if ((Math.round((i - iD) / PAS_T) + (cote > 0 ? 0 : 2)) % 4 === 0) {
            const lampe = { shape: 'box', p: [m[0] - f0.r[0] * cote * .34, m[1] + H - .6, m[2] - f0.r[2] * cote * .34], s: [1.1, .16, .08], r: rot, mat: 5, color: [1, .86, .58], emissive: 2.4, outdoor: false };
            objets.push(lampe); loin.push(lampe);
            tunnelLampes.push([m[0] - f0.r[0] * cote * 1.2, m[1] + H - .9, m[2] - f0.r[2] * cote * 1.2]);
          }
        }
        const c0 = pointPlan(f0, 0, y0 + H + .35), c1 = pointPlan(f1, 0, y1 + H + .35), dir = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]];
        const voute = marquerSolide({ shape: 'box', p: [(c0[0] + c1[0]) / 2 + axe[0] * translation, (c0[1] + c1[1]) / 2 + axe[1] * translation, (c0[2] + c1[2]) / 2 + axe[2] * translation], s: [long, .7, 2 * M + 1.4], r: angles(...base(dir, [0, 1, 0])), mat: 3, color: VOUTE, outdoor: false }, 'voute-tunnel');
        objets.push(voute); loin.push(voute);
        ajouter(objets, loin, f0.x, f0.z);
      }
      // La colline au-dessus du tunnel, en roche à strates (matière 9) : tous les 10 m, une crête posée sur la voûte et, de
      // chaque côté, quatre colonnes de blocs biseautés posées au sol, plus hautes au milieu du tunnel (15 m aux portails,
      // 29 m au milieu) et qui descendent vers l'extérieur. La colonne contre les murs reste alignée sur la piste : rien
      // ne dépasse à l'intérieur. Au-delà des portails, la pente continue sur 20 m, hors des limites de la piste.
      const ROCHES = [ROCHE, ROCHE2, ROCHE3], nT = iF - iD;
      for (let i = iD - 10; i <= iF + 10; i += 5) {
        const t = (i - iD) / nT, interieur = i >= iD + 4 && i <= iF - 4, horsTunnel = i < iD || i > iF;
        const P = 1 - Math.pow(Math.min(1, Math.abs(2 * t - 1)), 4), Hc = 15 + 14 * P, recul = horsTunnel ? Math.min(i < iD ? iD - i : i - iF, 10) / 10 : 0;
        const f = cadreOuvrage(c, i), y = hauteurRoute(f, 0, w), objets = [], h = k => hache(i, k, g + 101);
        if (i >= iD + 3 && i <= iF - 3) {
          const haut = Hc - .5 + 3 * h(1) - (H + .7);
          const formeCrete = organique ? B.lieux.rocherPour(c.theme, (g ^ Math.imul(i | 0, 73856093)) >>> 0) : 'bevel';
          objets.push({ shape: formeCrete, p: pointPlan(f, (h(2) - .5) * 4, y + H + .7 + haut / 2), s: [12 + 4 * h(3), haut, 2 * M + 8], r: angles(...base(f.t, [0, 1, 0])), mat: organique ? 23 : 9, color: ROCHES[((Math.floor(i) % 3) + 3) % 3] });
          // un piton par-dessus, de travers, pour casser la ligne de crête
          if (h(4) > .45) {
            const formePiton = organique ? B.lieux.rocherPour(c.theme, (g ^ Math.imul(i | 0, 19349663)) >>> 0) : 'octa';
            objets.push({ shape: formePiton, p: pointPlan(f, (h(5) - .5) * 16, y + Hc + 1.5 + 2 * h(6)), s: [9 + 6 * h(7), 5 + 6 * h(8), 8 + 6 * h(9)], r: [h(11) * .5, h(12) * 6.3, h(13) * .5], mat: organique ? 23 : 9, color: ROCHES[((Math.floor(i + 1) % 3) + 3) % 3] });
          }
        }
        for (const cote of [-1, 1]) {
          let lat = M + (organique ? 2.4 : .6);
          const limite = (cote < 0 ? lim.G : lim.D)[f.i];
          for (let k = 0; k < 4; k++) {
            const large = 9 + 6 * h(10 + 2 * k + (cote > 0)), centre = lat + large / 2;
            lat += large * .8;
            // hors du tunnel, seulement loin de la piste (marge de rotation comprise) ; contre les murs, seulement dedans
            if (k === 0 ? !interieur : !interieur && centre - large / 2 - 3 < limite + 2) continue;
            const haut = Math.max(3, (Hc * (1 - Math.pow(centre / 54, 2)) + 4 * (h(20 + k) - .5)) * (1 - .5 * recul));
            const lacet = k ? (h(30 + k) - .5) * .7 : 0, penche = k ? (h(40 + k) - .5) * .3 : 0;
            const av = [Math.cos(f.a + lacet), 0, Math.sin(f.a + lacet)], dessus = [f.r[0] * penche * cote, 1, f.r[2] * penche * cote];
            const pointu = k >= 2 && h(60 + k) > .5;   // dehors, des blocs pointus pour une silhouette de rocher
            const formeFlanc = organique ? B.lieux.rocherPour(c.theme, (g ^ Math.imul((i | 0) * 13 + k * 7 + (cote > 0 ? 1 : 0), 83492791)) >>> 0) : (pointu ? 'octa' : 'bevel');
            objets.push({ shape: formeFlanc, p: pointPlan(f, cote * centre, y - 2 + (haut + 2) / 2 + (pointu ? haut * .2 : 0)), s: [11 + 5 * h(50 + k), (haut + 2) * (pointu ? 1.5 : 1), large * (pointu ? 1.3 : 1)], r: angles(...base(av, dessus)), mat: organique ? 23 : 9, color: ROCHES[((Math.floor(i + k + (cote > 0)) % 3) + 3) % 3] });
          }
        }
        if (objets.length) {
          for (const o of objets) marquerSolide(o, 'roche-tunnel');
          ajouter(objets, objets.slice(), f.x, f.z);
        }
      }
      // portails : façade de roche percée à la taille de la voûte, à chaque bout, encadrée de béton (piédroits et linteau)
      for (const [i, sens] of [[iD, -1], [iF, 1]]) {
        const f = cadreOuvrage(c, i), y = hauteurRoute(f, 0, w), rot = capRot(f.a), objets = [];
        const devant = (d, h) => { const p = pointPlan(f, d, y + h); return [p[0] + f.t[0] * sens * 1.75, p[1], p[2] + f.t[2] * sens * 1.75]; };
        for (const cote of [-1, 1]) {
          objets.push({ shape: organique ? B.lieux.rocherPour(c.theme, (g ^ (sens > 0 ? 17 : 31) ^ (cote > 0 ? 5 : 11)) >>> 0) : 'bevel', p: pointPlan(f, cote * (M + 7.6), y + 7.5), s: [organique ? 7.5 : 3, 15.5, 14], r: rot, mat: organique ? 23 : 9, color: ROCHE });
          objets.push({ shape: 'box', p: devant(cote * (M + .4), H / 2 - .05), s: [.5, H + .1, .8], r: rot, mat: 3, color: BETON });
        }
        objets.push({ shape: organique ? B.lieux.rocherPour(c.theme, (g ^ (sens > 0 ? 53 : 71)) >>> 0) : 'bevel', p: pointPlan(f, 0, y + H + 4.5), s: [organique ? 7.5 : 3, 7, 2 * M + 28], r: rot, mat: organique ? 23 : 9, color: ROCHE2 });
        objets.push({ shape: 'box', p: devant(0, H + .8), s: [.5, 1.6, 2 * M + 2.4], r: rot, mat: 3, color: BETON });
        for (const o of objets) marquerSolide(o, 'portail-tunnel');
        ajouter(objets, objets.slice(), f.x, f.z);
      }
    }

    // Repères de freinage (3, 2, 1 barres) et murs de pneus avant les virages serrés.
    const virages = [];
    for (let i = 0; i < c.n; i++) {
      const k = Math.abs(c.courbure[i]);
      if (k > 1 / 95 && k >= Math.abs(c.courbure[(i + 1) % c.n]) && k >= Math.abs(c.courbure[(i - 1 + c.n) % c.n])) {
        if (!virages.length || i - virages[virages.length - 1].i > 60) virages.push({ i, sens: Math.sign(c.courbure[i]) });
      }
    }
    for (const v of virages) {
      const ext = -v.sens; // l'extérieur du virage
      let entree = v.i; while (Math.abs(c.courbure[((entree - 1) % c.n + c.n) % c.n]) > 1 / 400 && v.i - entree < 60) entree--;
      const nouveauRepere = reperes && reperes.virages.some(q => distanceRepere(c, q.debut, v.i * c.pas) <= q.longueur);
      for (const [metres, barres] of (nouveauRepere ? [] : [[150, 3], [100, 2], [50, 1]])) {
        const f = cadre(c, Math.round((entree * c.pas - metres) / c.pas)), yb = hauteurRoute(f, ext * w, w);
        const p = pointPlan(f, ext * (w + 3.2), yb), rot = capRot(f.a);
        const objets = [{ shape: 'box', p: [p[0], p[1] + 1.3, p[2]], s: [.08, 1.5, 1.2], r: rot, mat: 16, color: [.93, .93, .9] },
          { shape: 'cylinder', p: [p[0], p[1] + .3, p[2]], s: [.08, .6, .08], mat: 0, color: [.5, .5, .5] }];
        marquerSolide(objets[0], 'repere-freinage'); marquerSolide(objets[1], 'repere-freinage');
        for (let b = 0; b < barres; b++) objets.push({ shape: 'box', p: [p[0] - f.t[0] * .05, p[1] + .85 + b * .38, p[2] - f.t[2] * .05], s: [.03, .18, 1.0], r: rot, mat: 16, color: [.07, .07, .08] });
        ajouter(objets, [objets[0]], p[0], p[2]);
      }
      // murs de pneus à l'extérieur, devant la glissière (sur route de col ouverte, jamais dans la zone de roulement)
      for (let j = -8; j <= 14; j += 2) {
        const f = cadre(c, v.i + j), limExt = (ext < 0 ? lim.G : lim.D)[f.i], L = limExt - .8;
        if (c.ouvert && L < w + 2.4) continue;
        const yb = hauteurRoute(f, ext * w, w) - .02 * (L - w);
        const objets = [];
        for (let e = 0; e < 3; e++) {
          const p = pointPlan(f, ext * (L - .1), yb + .14 + e * .27);
          objets.push({ shape: 'cylinder', collision: 'pneus', p, s: [.74, .26, .74], mat: 7, color: [.05, .05, .055], detail: 2 });
          objets.push({ shape: 'cylinder', collision: 'pneus', p: [p[0] + f.t[0] * .8, p[1], p[2] + f.t[2] * .8], s: [.74, .26, .74], mat: 7, color: e === 2 ? [.9, .9, .88] : [.05, .05, .055], detail: 2 });
        }
        ajouter(objets, [], objets[0].p[0], objets[0].p[2]);
      }
    }

    // Postes de commissaires, en alternance de côté.
    for (let s = 220, k = 0; s < c.longueur - 150; s += 380 + r() * 160, k++) {
      const f = cadre(c, Math.round(s / c.pas)), cote = k % 2 ? 1 : -1, L = (cote < 0 ? lim.G : lim.D)[f.i];
      const p = pointPlan(f, cote * (L + 2.8), hauteurRoute(f, cote * w, w) - .02 * (L - w)), rot = capRot(f.a);
      ajouter([{ shape: 'box', collision: 'cabane', p: [p[0], p[1] + 1.1, p[2]], s: [2.2, 2.2, 2], r: rot, mat: 13.6, color: [.92, .9, .84] },
        { shape: 'box', collision: 'toit', p: [p[0], p[1] + 2.3, p[2]], s: [2.6, .2, 2.4], r: rot, mat: 16, color: [.9, .42, .06] },
        { shape: 'cylinder', collision: 'pilier', p: [p[0] + 1.3, p[1] + 2.2, p[2]], s: [.05, 4.4, .05], mat: 0, color: [.6, .6, .6] },
        { shape: 'box', p: [p[0] + 1.3, p[1] + 4.0, p[2] + .45], s: [.02, .55, .8], r: rot, mat: 16, color: [.95, .78, .08] }], [], p[0], p[2]);
      if (architecture) architecture.maisons.push({ x: p[0], sol: p[1], z: p[2], a: f.a + (cote < 0 ? Math.PI : 0), l: 2.2, w: 2, h: 2.2, cabane: true, graine: c.graine });
    }

    // Ligne droite principale : grille, ligne d'arrivée, portique des feux, tribunes et bâtiment des stands.
    const f0 = cadre(c, 0), rot0 = capRot(f0.a);
    const objetsDepart = [], loinDepart = [];
    for (let k = 0; k < 12; k++) for (let rg = 0; rg < 2; rg++) {
      const d = -w + .3 + (k + .5) * (2 * w - .6) / 12, s = (rg - .5) * 1.1;
      const p = [f0.x + f0.r[0] * d + f0.t[0] * s, hauteurRoute(f0, d, w) + .012, f0.z + f0.r[2] * d + f0.t[2] * s];
      objetsDepart.push({ shape: 'box', p, s: [1.1, .024, (2 * w - .6) / 12], r: rot0, mat: MATIERES_PILOTES.asphalte, color: (k + rg) % 2 ? [.07, .07, .075] : [.9, .9, .88] });
    }
    for (let k = 0; k < 12; k++) {
      const f = cadre(c, Math.round((-10 - 8 * k) / c.pas)), d = k % 2 ? 2.4 : -2.4, rot = capRot(f.a);
      const p = [f.x + f.r[0] * d, hauteurRoute(f, d, w) + .012, f.z + f.r[2] * d];
      objetsDepart.push({ shape: 'box', p: [p[0] + f.t[0] * 2.4, p[1], p[2] + f.t[2] * 2.4], s: [.22, .024, 2.2], r: rot, mat: MATIERES_PILOTES.asphalte, color: [.88, .88, .85] });
      objetsDepart.push({ shape: 'box', p: [p[0] + f.t[0] * 1.6, p[1], p[2] + f.t[2] * 1.6 + 0], s: [1.6, .024, .16], r: rot, mat: MATIERES_PILOTES.asphalte, color: [.88, .88, .85] });
    }
    // portique des feux, au-dessus de la ligne
    const yP = hauteurRoute(f0, 0, w), portique = { feux: [], cap: f0.a };
    for (const cote of [-1, 1]) {
      const p = pointPlan(f0, cote * (w + 1.6), yP);
      objetsDepart.push({ shape: 'box', collision: 'pilier', p: [p[0], p[1] + 3.6, p[2]], s: [.5, 7.2, .5], r: rot0, mat: 0, color: [.22, .24, .26] });
      loinDepart.push(objetsDepart[objetsDepart.length - 1]);
    }
    const poutre = { shape: 'box', collision: 'poutre', p: [f0.x, yP + 7.4, f0.z], s: [.7, .9, 2 * w + 3.8], r: rot0, mat: 0, color: [.18, .2, .22] };
    objetsDepart.push(poutre); loinDepart.push(poutre);
    objetsDepart.push({ shape: 'box', p: [f0.x - f0.t[0] * .36, yP + 7.4, f0.z - f0.t[2] * .36], s: [.04, .5, 2 * w + 3.6], r: rot0, mat: 16, color: [.92, .92, .9] });
    for (let k = 0; k < 5; k++) {
      const d = (k - 2) * 1.25, p = [f0.x + f0.r[0] * d - f0.t[0] * .42, yP + 6.95, f0.z + f0.r[2] * d - f0.t[2] * .42];
      objetsDepart.push({ shape: 'box', p: [p[0] + f0.t[0] * .05, p[1], p[2] + f0.t[2] * .05], s: [.12, .78, .78], r: rot0, mat: 7, color: [.03, .03, .035] });
      portique.feux.push([p[0] - f0.t[0] * .03, p[1], p[2] - f0.t[2] * .03]);
    }
    for (const o of objetsDepart) lotDe(0, 0, 0).objets.push(o);
    for (const o of loinDepart) lotDe(0, 0, 0).loin.push(o);
    // tribunes à gauche, stands à droite, le long de la ligne droite
    const estMarseille = c.id === 'marseille';
    const droite = c.ligneDroite || { debut: -200, fin: 200 };
    const avant = Math.max(-300, B.circuit.ecart(c, 0, droite.debut) + 40), apres = Math.min(260, B.circuit.ecart(c, 0, droite.fin) - 60);
    // public.js : la description des gradins, pour y asseoir de vrais spectateurs (options.public)
    const gradins = options.public ? { tribunes: [], stands: [], enceinte: { debut: avant - 10, fin: apres + 50 } } : null;
    if (!estMarseille) {
      for (let s = avant + 30; s < apres - 30; s += 72) {
        const f = cadre(c, Math.round(s / c.pas)), objets = [], loin = [];
        tribune(objets, loin, f, w, -1, 64, r, gradins && gradins.tribunes);
        if (gradins) gradins.tribunes[gradins.tribunes.length - 1].s = s;
        const l = lotDe(f.x, f.z, f.i); l.objets.push(...objets); l.loin.push(...loin);
      }
      for (let s = avant + 40; s < apres - 20; s += 60) {
        const f = cadre(c, Math.round(s / c.pas)), objets = [], loin = [];
        if (architecture) {
          const site = { x: f.x, z: f.z, sol: hauteurRoute(f, w, w) - .2, a: f.a, demiRoute: w, longueur: 60, graine: c.graine, s };
          const batiment = B.batiments.stands(site, { detail: qualite !== 'low' });
          objets.push(...batiment.objets); loin.push(...batiment.loin); architecture.stands.push(site);
        } else batimentStands(objets, loin, f, w, 1, 60, th.matieres);
        if (gradins) gradins.stands.push({ s, cote: 1, longueur: 60 });
        const l = lotDe(f.x, f.z, f.i); l.objets.push(...objets); l.loin.push(...loin);
      }

      // Passerelle au-dessus de la piste, sur une portion presque droite au milieu du tour.
      for (let essai = 0; essai < 200; essai++) {
        const i = Math.floor((.45 + essai * .002) * c.n);
        if (Math.abs(c.courbure[i]) > 1 / 600) continue;
        const f = cadre(c, i), L = Math.min(lim.G[i], lim.D[i]) + 1, y = hauteurRoute(f, 0, w), rot = capRot(f.a), objets = [];
        for (const cote of [-1, 1]) { const p = pointPlan(f, cote * L, y); objets.push({ shape: 'box', collision: 'pilier', p: [p[0], y + 3.4, p[2]], s: [1.4, 6.8, 1.4], r: rot, mat: 3, color: [.7, .7, .68] }); }
        objets.push({ shape: 'box', collision: 'poutre', p: [f.x, y + 7.2, f.z], s: [2.6, 1.0, 2 * L + 1.4], r: rot, mat: 3, color: [.74, .74, .72] });
        const coul = PUBLICITES[Math.floor(r() * PUBLICITES.length)];
        for (const sens of [-1, 1]) objets.push({ shape: 'box', p: [f.x + f.t[0] * sens * 1.32, y + 7.2, f.z + f.t[2] * sens * 1.32], s: [.05, .8, 2 * L], r: rot, mat: 16, color: coul });
        const l = lotDe(f.x, f.z, i); l.objets.push(...objets); l.loin.push(...objets);
        break;
      }
    }

    // Les candidats historiques restent bornés et gardent leur hasard propre. Le champ de boisement
    // laisse des trouées, indépendamment du côté de route ; un arbre absent n'a pas de solide résiduel.
    const positionsArbres = [], sourcesFeuilles = [];
    const habitatArbre = {};
    // Moyenne et Fine : chaque arbre retenu est aussi rangé dans sa case d'arbres, qui deviendra son lot d'image
    // (voir lotsImage). Les lots historiques le gardent : solides et masques d'herbe n'en dépendent pas.
    const casesArbres = qualite === 'low' ? null : new Map(), objetsArbres = new Set();
    function rangerArbre(objets, loin, x, z) {
      const cle = Math.floor(x / CASE_ARBRES) + ',' + Math.floor(z / CASE_ARBRES);
      let l = casesArbres.get(cle); if (!l) casesArbres.set(cle, l = { objets: [], loin: [] });
      for (const o of objets) { l.objets.push(o); objetsArbres.add(o); }
      for (const o of loin) { l.loin.push(o); objetsArbres.add(o); }
      // La version lointaine se montre dès 80 m de la sphère de la case sur une toile de 1 080 pixels (plus près sur
      // une toile plus basse), où le tronc d'écorce fait encore quelques pixels de large : elle le garde, allégé
      // (même pose, même matière, même couleur, aucune collision).
      // Cap-Séquoia met déjà son tronc géant dans la version lointaine ; un arbre en blobs n'a pas d'écorce.
      const tronc = objets.find(o => o.collision === 'tronc');
      if (B.botanique && B.botanique.TRONC_LOINTAIN && tronc && tronc.mat === B.botanique.matiere('ecorce') && !loin.includes(tronc))
        l.loin.push({ shape: B.botanique.TRONC_LOINTAIN, p: tronc.p.slice(), s: tronc.s.slice(), r: tronc.r.slice(), mat: tronc.mat, color: tronc.color.slice() });
    }
    function saisonArbre(objets, loin, x, z, essence = th.essence, solSource = null) {
      const saisonArbreLocale = terrain.saisonSecondaire && terrain.partSecondaire(x,z) >= .5 ? terrain.saisonSecondaire : saison;
      const pied = objets.find(o => o.collision === 'tronc'), h = pied.s[1] / .84, sol = pied.p[1] - h * .42 + .2;
      if (ecologie) ecologie.echantillonner(x, z, habitatArbre);
      // Forêt basse mêlée aux conifères : choix spatial stable, indépendant de la saison et du hasard
      // historique. Le tronc solide conserve exactement sa position et ses dimensions. Au-dessus de
      // la bande basse, seuls les conifères historiques restent ; aucun arbre n'est ajouté au col.
      if (saisonArbreLocale && th.montagnes && B.botanique && sol < 120
        && hache(Math.round(x * 8), Math.round(z * 8), g + 541) < .48 * (1 - lisse(70, 120, sol))) {
        essence = 'feuillu';
        const vert = [.17, .31, .09].map(v => v * (.90 + .20 * hache(Math.round(x), Math.round(z), g + 547)));
        if (qualite !== 'low') habiller(objets, loin, essence, qualite, h, pied.r[0], vert);
        else {
          for (const liste of [objets, loin]) for (let i = liste.length - 1; i >= 0; i--) if (couronneArbre(liste[i])) liste.splice(i, 1);
          const couronne = { shape: 'foliage', p: [x, sol - .2 + h * .80, z], s: [h * .74, h * .68, h * .74], mat: 11, color: vert };
          objets.push(couronne); loin.push({ ...couronne, p: couronne.p.slice(), s: couronne.s.slice() });
        }
      }
      const nu = !!(saisonArbreLocale && saisonArbreLocale.id === 'hiver' && !(terrain.saisonSecondaire && saisonArbreLocale.theme === 'cote') && essence === 'feuillu' && B.botanique);
      // Les platanes de bord avaient une seule couronne simple, même en Fine : leurs rameaux restent
      // au budget de 72 triangles. La forêt détaillée conserve, elle, ses vraies branches détaillées.
      if (nu) {
        const detailNu = objets.some(o => o.collision !== 'tronc' && o.shape.startsWith('arbre-')) ? qualite : 'low';
        habiller(objets, loin, essence, detailNu, h, pied.r[0], pied.color, true);
      }
      const parties = new Set(objets.concat(loin));
      if (saisonArbreLocale) {
        for (const o of parties) if (!nu && couronneArbre(o) && o.color) {
          o.color = B.saisons.teinte(saisonArbreLocale, essence === 'feuillu' ? 'feuillage-caduque' : 'feuillage-persistant', o.color, o.p[0], o.p[2], ecologie ? habitatArbre : null);
        }
        if (saisonArbreLocale.feuilles && essence === 'feuillu') {
          sourcesFeuilles.push({ x, y: sol + h * .78, z, rayon: h * .36, sol: solSource ?? sol });
        }
      }
      for (const o of parties) if (o.collision === 'tronc' || couronneArbre(o)) {
        Object.defineProperty(o, 'essenceArbre', { value: essence });
        Object.defineProperty(o, 'partieArbre', { value: o.collision === 'tronc' ? 'tronc' : nu ? 'branches' : 'feuillage' });
      }
      if (th.baikal) for (const o of parties) if (o.essenceArbre) {
        Object.defineProperty(o, 'essenceBaikal', { value: essence });
        if (o.collision === 'tronc' && essence === 'feuillu') o.color = [.70, .72, .65];
      }
    }
    function retenirArbre(objets, loin, x, z, essence = th.essence) {
      if (pontFjord) {
        const dx = x-pontFjord.f.x, dz = z-pontFjord.f.z;
        if (Math.abs(dx*pontFjord.tx+dz*pontFjord.tz) < pontFjord.demi+10 &&
            Math.abs(dz*pontFjord.tx-dx*pontFjord.tz) < c.limite+14) return;
      }
      if (terrain.lagon && Number.isFinite(terrain.niveauEauA(x,z))) return;
      if (maisonsBaikal && maisonsBaikal.some(m => Math.hypot(m.x - x, m.z - z) < 18)) return;
      const richesse = ecologie ? ecologie.echantillonner(x, z, habitatArbre).boisement : 1;
      if (!th.pacifique && (richesse < .08 || hache(Math.round(x * 8), Math.round(z * 8), g + 337) > richesse)) return;
      saisonArbre(objets, loin, x, z, essence);
      ajouter(objets, loin, x, z); positionsArbres.push([x, z]);
      if (casesArbres) rangerArbre(objets, loin, x, z);
    }
    let nombre = 0;
    const MAX = estMarseille || th.volcanique || th.aride || th.pacifique ? 0 : options.arbres === undefined ? (th.karstique ? 160 : 2600) : options.arbres;
    // Le budget réduit du nouveau biome est distribué sur tout le tour, sans remplir seulement le départ.
    const pasArbres = th.karstique ? Math.max(7, Math.ceil(c.n / 72)) : 7;
    for (let i = 0; i < c.n && nombre < MAX; i += pasArbres) {   // historique : un plan par 14 m de piste
      const f = cadre(c, i);
      for (const cote of [-1, 1]) {
        for (let essai = 0; essai < 3; essai++) {        // si la place est prise (eau, roche, tribunes), on tente une autre distance
          const t = hache(i * 3 + essai, cote + 5, g + 57), d = 40 + t * 150;
          const glisse = (hache(i, cote + essai + 7, g + 71) - .5) * 12;
          const p = pointPlan(f, cote * d, 0), jx = p[0] + f.t[0] * glisse, jz = p[2] + f.t[2] * glisse;
          const q = interroger(jx, jz, 120, true);
          const dist = q.i < 0 ? 999 : q.d;
          if (dist < 30 || (q.i >= 0 && dist < 48 && sousTunnel(q.i))) continue;
          if (q.i >= 0 && Math.abs(B.circuit.ecart(c, 0, q.i * c.pas)) < 320 && dist < 90) continue;
          const y = terrain.sol(jx, jz);
          if (th.eau !== undefined && y < th.eau + 2.5) continue;
          if (th.montagnes && y > 160) continue;
          const objets = [], loin = [];
          const essence = th.baikal ? B.baikal.essence(terrain.paysageBaikal, jx, jz) : th.essence;
          arbre(objets, loin, jx, y - .2, jz, essence, r, qualite);
          retenirArbre(objets, loin, jx, jz, essence); nombre++;
          break;
        }
      }
    }
    const [bx0, bz0, bx1, bz1] = terrain.bornes, PAS_A = 11;
    for (let z = bz0 + 40; z < bz1 - 40 && nombre < MAX; z += PAS_A) for (let x = bx0 + 40; x < bx1 - 40 && nombre < MAX; x += PAS_A) {
      const jx = x + (hache(x, z, g) - .5) * PAS_A * .9, jz = z + (hache(z, x, g + 1) - .5) * PAS_A * .9;
      const q = interroger(jx, jz, 120, true);
      const dist = q.i < 0 ? 999 : q.d;
      if (dist < 30 || dist > 460 || (q.i >= 0 && dist < 48 && sousTunnel(q.i))) continue;
      const tache = fbm(jx / 210, jz / 210, g + 21, 3);
      const seuil = 1 - th.densite + lisse(30, 60, dist) * -.08 + lisse(200, 460, dist) * .12;
      if (tache < seuil) continue;
      const y = terrain.sol(jx, jz);
      if (th.eau !== undefined && y < th.eau + 2.5) continue;
      if (th.montagnes && y > 160) continue;
      if (q.i >= 0 && Math.abs(B.circuit.ecart(c, 0, q.i * c.pas)) < 320 && dist < 90) continue; // abords des tribunes et des stands
      const objets = [], loin = [];
      const essence = th.baikal ? B.baikal.essence(terrain.paysageBaikal, jx, jz) : th.essence;
      arbre(objets, loin, jx, y - .2, jz, essence, r, qualite);
      retenirArbre(objets, loin, jx, jz, essence); nombre++;
    }

    if (th.pacifique) {
      // Bosquets irréguliers de grands conifères, séparés par de vraies clairières. Un hasard dédié
      // garde les barrières et les autres décors indépendants de ce budget ; aucune recherche par image.
      const foretR = alea(g ^ 0x5d83e7a1), plafond = options.arbres === undefined ? 320 : Math.max(0, Math.min(320, Math.floor(options.arbres)));
      for (let bosquet = 0; bosquet < 100 && positionsArbres.length < plafond; bosquet++) {
        const f = cadre(c, Math.floor(foretR() * c.n)), cote = foretR() < .5 ? -1 : 1;
        const centre = pointPlan(f, cote * (80 + foretR() * 320), 0);
        const cx = centre[0] + (foretR() - .5) * 85, cz = centre[2] + (foretR() - .5) * 85;
        if (ecologie && ecologie.echantillonner(cx, cz, habitatArbre).boisement < .19) continue;
        const orientation = foretR() * Math.PI, rx = 23 + foretR() * 38, rz = 18 + foretR() * 28;
        const sujets = 9 + Math.floor(foretR() * 12);
        for (let j = 0; j < sujets && positionsArbres.length < plafond; j++) {
          const a = foretR() * Math.PI * 2, rayon = Math.sqrt(foretR());
          const u = Math.cos(a) * rx * rayon, v = Math.sin(a) * rz * rayon;
          const x = cx + u * Math.cos(orientation) - v * Math.sin(orientation), z = cz + u * Math.sin(orientation) + v * Math.cos(orientation);
          const q = interroger(x, z, 160);
          if (q.i >= 0 && (q.d < 42 || (Math.abs(B.circuit.ecart(c, 0, q.i * c.pas)) < 330 && q.d < 108))) continue;
          const y = terrain.sol(x, z);
          if (y < th.eau + 20 || Math.max(Math.abs(terrain.sol(x + 8, z) - terrain.sol(x - 8, z)),
            Math.abs(terrain.sol(x, z + 8) - terrain.sol(x, z - 8))) > 9) continue;
          if (positionsArbres.some(p => Math.hypot(p[0] - x, p[1] - z) < 7)) continue;
          const objets = [], loin = [], pied = y - .35;
          arbre(objets, loin, x, pied, z, 'conifere', foretR, qualite);
          // Le tronc géant reste visible au loin : la couronne ne doit jamais flotter après la bascule de détail.
          const tronc = objets.find(o => o.collision === 'tronc');
          if (tronc) loin.push(tronc);
          const taille = 2.8 + foretR() * .5;
          // La silhouette et le tronc solide grandissent ensemble ; les LOD gardent la même emprise.
          for (const o of new Set(objets.concat(loin))) {
            o.p = [x + (o.p[0] - x) * taille, pied + (o.p[1] - pied) * taille, z + (o.p[2] - z) * taille];
            o.s = o.s.map(v => v * taille);
            if (o.collision === 'tronc') { o.s[0] *= 1.3; o.s[2] *= 1.3; o.color = [.34, .17, .085]; }
            else if (o.color) o.color = [o.color[0] * .80, o.color[1] * .90, o.color[2] * 1.20];
          }
          retenirArbre(objets, loin, x, z);
        }
      }
      // Écueils et rochers côtiers irréguliers, enfouis sous toute leur emprise. Les falaises principales
      // sont déjà dans les nappes ; ces quelques solides conservent leur silhouette au loin.
      const rocheR = alea(g ^ 0x2fd76c89);
      for (let k = 0; k < 90; k++) {
        const f = cadre(c, Math.floor(rocheR() * c.n)), p = pointPlan(f, (rocheR() < .5 ? -1 : 1) * (95 + rocheR() * 390), 0);
        const x = p[0], z = p[2], y = terrain.sol(x, z);
        if (y < th.eau - 9 || y > th.eau + 40) continue;
        const largeur = 4 + rocheR() * 8, profondeur = 3 + rocheR() * 8, h = 4 + rocheR() * 10, a = rocheR() * Math.PI;
        const q = interroger(x, z, 200), rayon = Math.hypot(largeur, profondeur) / 2;
        if (q.i >= 0 && (q.d < w + 30 + rayon || (Math.abs(B.circuit.ecart(c, 0, q.i * c.pas)) < 330 && q.d < 108))) continue;
        let bas = y - .7;
        for (const dx of [-largeur / 2, largeur / 2]) for (const dz of [-profondeur / 2, profondeur / 2]) {
          bas = Math.min(bas, terrain.sol(x + dx * Math.cos(a) + dz * Math.sin(a), z - dx * Math.sin(a) + dz * Math.cos(a)) - .4);
        }
        if (bas + h < th.eau + .6) continue;
        const formePac = organique ? B.lieux.rocherPour('pacifique', (g ^ Math.imul(k + 1, 997)) >>> 0) : 'bevel';
        const objets = [{ shape: formePac, collision: 'roche', p: [x, bas + h * .5, z], s: [largeur, h, profondeur], r: [0, a, 0], mat: 9, color: varier(th.roche, rocheR, .35) }];
        ajouter(objets, objets, x, z);
      }
    }

    // Repères lointains selon le thème : phare et cabanons sur la côte, chalets en montagne, fermes en forêt.
    const villages = estMarseille || th.volcanique || th.aride || th.karstique || th.pacifique ? 0 : th.eau !== undefined ? 3 : 4;
    for (let v = 0; v < villages; v++) {
      for (let essai = 0; essai < 40; essai++) {
        const x = bx0 + 200 + r() * (bx1 - bx0 - 400), z = bz0 + 200 + r() * (bz1 - bz0 - 400), q = interroger(x, z, 300);
        if (q.i >= 0 && q.d < 140) continue;
        const y = terrain.sol(x, z);
        if (th.eau !== undefined && y < th.eau + 3) continue;
        if (th.montagnes && y > 140) continue;
        const objets = [], a = r() * Math.PI;
        for (let m = 0; m < 6 + Math.floor(r() * 6); m++) {
          const mx = x + (r() - .5) * 70, mz = z + (r() - .5) * 70, my = terrain.sol(mx, mz), lx = 7 + r() * 6, lz = 6 + r() * 4, h = 4 + r() * 3;
          const enduit = th.montagnes ? [.55, .42, .30] : [.88, .84, .76];
          objets.push({ shape: 'box', p: [mx, my + h / 2 - .3, mz], s: [lx, h, lz], r: [0, a, 0], mat: 13.1 + r() * .3, color: enduit });
          // deux pans de toit inclinés de 0,5 rad autour de l'axe long de la maison (rotation Ry(a)·Rx(±0,5))
          const ez = [Math.sin(a), 0, Math.cos(a)];
          for (const sens of [-1, 1]) objets.push({ shape: 'box', p: [mx + ez[0] * sens * lz * .25, my + h - .3 + lz * .14, mz + ez[2] * sens * lz * .25], s: [lx + .6, .22, lz * .6], r: [sens * .5, a, 0], mat: 1, color: th.montagnes ? [.30, .20, .14] : [.62, .26, .14] });
          if (architecture) architecture.maisons.push({ x: mx, z: mz, sol: my - .3, a: -a, l: lx, w: lz, h, enduit, theme: c.theme, graine: c.graine });
        }
        if (th.eau !== undefined && v === 0) {
          objets.push({ shape: 'cylinder', p: [x, y + 11, z], s: [3, 22, 3], mat: 16, color: [.94, .94, .9] });
          for (let b = 0; b < 3; b++) objets.push({ shape: 'cylinder', p: [x, y + 4 + b * 7, z], s: [3.08, 2.2, 3.08], mat: 16, color: [.8, .1, .08] });
          objets.push({ shape: 'cylinder', p: [x, y + 23, z], s: [2.2, 2, 2.2], mat: 5, color: [1, .8, .4], emissive: .5 });
        }
        for (const o of objets) marquerSolide(o, 'batiment-lointain');
        const l = lotDe(x, z, -1); l.objets.push(...objets); l.loin.push(...objets);
        break;
      }
    }
    // Rochers en montagne.
    if (th.montagnes) for (let k = 0; k < 160; k++) {
      const x = bx0 + r() * (bx1 - bx0), z = bz0 + r() * (bz1 - bz0), q = interroger(x, z, 200);
      if (q.i >= 0 && q.d < 34) continue;
      const y = terrain.sol(x, z), t = 2 + r() * 7;
      const fM = r() < .5 ? 'octa' : 'sphere';
      const shapeM = organique ? B.lieux.rocherPour('montagne', (g ^ Math.imul(k + 1, 1319)) >>> 0) : fM;
      ajouter([{ shape: shapeM, p: [x, y + t * .2, z], s: [t * (1 + r()), t, t * (1 + r())], r: [r(), r() * 6, r()], mat: organique ? 23 : 9, color: th.roche }], [], x, z);
    }
    // Basalte en poches irrégulières : silhouettes conservées au loin, une seule construction par circuit.
    if (th.volcanique) {
      const rocheR = alea(g ^ 0x6a41b391);
      for (let k = 0; k < 120; k++) {
        const f = cadre(c, Math.floor(rocheR() * c.n)), cote = rocheR() < .5 ? -1 : 1;
        const p = pointPlan(f, cote * (46 + rocheR() * 210), 0), objets = [], nombre = 2 + Math.floor(rocheR() * 4);
        for (let j = 0; j < nombre; j++) {
          const x = p[0] + (rocheR() - .5) * 22, z = p[2] + (rocheR() - .5) * 22;
          const q = interroger(x, z, 160), largeur = 1.6 + rocheR() * 4.2, hauteur = 2 + rocheR() * 7;
          // Vérifier aussi l'autre côté d'une épingle et les stands, pas seulement le décalage du candidat.
          if (q.i >= 0 && (q.d < 35 + largeur || (Math.abs(B.circuit.ecart(c, 0, q.i * c.pas)) < 330 && q.d < 100))) continue;
          const y = terrain.sol(x, z), a = rocheR() * Math.PI, couleur = varier(th.roche, rocheR, .5), mousse = .38 + rocheR() * .4;
          if (organique) {
            const formeV = B.lieux.rocherPour('islande', (g ^ Math.imul(k * 7 + j + 1, 2654435761)) >>> 0);
            const lOrg = largeur * 1.35, hOrg = hauteur * .82;
            objets.push({ shape: formeV, collision: 'roche', p: [x, y + hOrg * .38, z], s: [lOrg, hOrg, lOrg * .86], r: [0, a, 0], mat: 23, color: couleur });
            objets.push({ shape: 'bitume-lieu-rocher-volcan', p: [x, y + hOrg * .68, z], s: [lOrg * .82, hOrg * .32, lOrg * .72], r: [0, a + .4, 0], mat: saison && saison.neige ? 3 : 25,
              color: saison && saison.neige ? [.90, .93, .96] : melange(couleur, th.herbe, mousse) });
          } else {
            objets.push({ shape: 'box', collision: 'roche', p: [x, y + hauteur * .44, z], s: [largeur, hauteur, largeur * .78], r: [0, a, 0], mat: 9, color: couleur });
            // Un sommet bas, moussu ou enneigé, laisse les flancs de basalte noirs même en hiver.
            objets.push({ shape: 'box', p: [x, y + hauteur * .94 + .035, z], s: [largeur, .07, largeur * .78], r: [0, a, 0], mat: saison && saison.neige ? 3 : 8,
              color: saison && saison.neige ? [.90, .93, .96] : melange(couleur, th.herbe, mousse) });
          }
        }
        if (objets.length) ajouter(objets, objets, p[0], p[2]);
      }
    }
    // Grès érodé en poches : en mode organique, buttes et rochers asymétriques texturés (zéro pyramide symétrique).
    if (th.aride) {
      const rocheR = alea(g ^ 0xa5139d6b);
      for (let k = 0; k < 64; k++) {
        const f = cadre(c, Math.floor(rocheR() * c.n)), cote = rocheR() < .5 ? -1 : 1;
        const p = pointPlan(f, cote * (58 + rocheR() * 240), 0), objets = [], nombre = 1 + Math.floor(rocheR() * 3);
        for (let j = 0; j < nombre; j++) {
          const x = p[0] + (rocheR() - .5) * 36, z = p[2] + (rocheR() - .5) * 36;
          const q = interroger(x, z, 200), largeur = 5 + rocheR() * 10, profondeur = largeur * (.55 + rocheR() * .30);
          const rayon = Math.hypot(largeur, profondeur) / 2;
          if (q.i >= 0 && (q.d < w + 28 + rayon || (Math.abs(B.circuit.ecart(c, 0, q.i * c.pas)) < 330 && q.d < 105))) continue;
          const a = rocheR() * Math.PI, niveaux = 2 + Math.floor(rocheR() * 2), h = 2.2 + rocheR() * 2.8;
          // Enfouir le socle sous le point le plus bas de son emprise évite un bloc suspendu sur les pentes.
          let bas = terrain.sol(x, z) - .5;
          for (const dx of [-largeur / 2, largeur / 2]) for (const dz of [-profondeur / 2, profondeur / 2]) {
            bas = Math.min(bas, terrain.sol(x + dx * Math.cos(a) + dz * Math.sin(a), z - dx * Math.sin(a) + dz * Math.cos(a)) - .25);
          }
          if (organique) {
            const gr = (g ^ Math.imul(k * 11 + j + 1, 1597334677)) >>> 0;
            const estButte = (k % 3 === 0) && j === 0;
            const couleur = melange(th.roche, estButte ? th.sable : th.terre, .42 + rocheR() * .25);
            const hOrg = estButte ? largeur * .72 : h * niveaux * .78;
            const formeD = B.lieux.rocherPour(estButte ? 'montagne' : 'desert', gr);
            const tiltX = (rocheR() - .5) * .16, tiltZ = (rocheR() - .5) * .16;
            objets.push({ shape: formeD, collision: 'roche', p: [x, bas + hOrg * .46, z], s: [largeur * (estButte ? 1.45 : 1.15), hOrg, profondeur * (estButte ? 1.35 : 1.15)], r: [tiltX, a, tiltZ], mat: 23, color: couleur });
          } else {
            for (let etage = 0; etage < niveaux; etage++) {
              const taille = 1 - etage * .16, couleur = melange(th.roche, etage % 2 ? th.sable : th.terre, .38 + rocheR() * .25);
              objets.push({ shape: 'box', collision: 'roche', p: [x, bas + h * (etage + .5), z], s: [largeur * taille, h, profondeur * taille], r: [0, a, 0], mat: 9, color: couleur });
            }
            const sommet = 1 - (niveaux - 1) * .16;
            objets.push({ shape: 'box', p: [x, bas + h * niveaux + .035, z], s: [largeur * sommet, .07, profondeur * sommet], r: [0, a, 0], mat: saison && saison.neige ? 3 : 9,
              color: saison && saison.neige ? [.90, .93, .96] : th.sable });
          }
        }
        if (objets.length) ajouter(objets, objets, p[0], p[2]);
      }
    }

    // Petits éperons calcaires entre les bosquets, distincts des grandes pointes déjà sculptées dans le terrain.
    if (th.karstique) {
      const rocheR = alea(g ^ 0x37a9bd25);
      for (let k = 0; k < 54; k++) {
        const f = cadre(c, Math.floor(rocheR() * c.n)), cote = rocheR() < .5 ? -1 : 1;
        const p = pointPlan(f, cote * (65 + rocheR() * 230), 0), objets = [], nombre = 1 + Math.floor(rocheR() * 3);
        for (let j = 0; j < nombre; j++) {
          const x = p[0] + (rocheR() - .5) * 38, z = p[2] + (rocheR() - .5) * 38;
          const q = interroger(x, z, 200), largeur = 3 + rocheR() * 5, profondeur = largeur * (.7 + rocheR() * .35), h = 7 + rocheR() * 15;
          const rayon = Math.hypot(largeur, profondeur) / 2;
          if (q.i >= 0 && (q.d < w + 29 + rayon || (Math.abs(B.circuit.ecart(c, 0, q.i * c.pas)) < 330 && q.d < 105))) continue;
          const a = rocheR() * Math.PI, couleur = varier(th.roche, rocheR, .28);
          let bas = terrain.sol(x, z) - .6;
          for (const dx of [-largeur / 2, largeur / 2]) for (const dz of [-profondeur / 2, profondeur / 2]) {
            bas = Math.min(bas, terrain.sol(x + dx * Math.cos(a) + dz * Math.sin(a), z - dx * Math.sin(a) + dz * Math.cos(a)) - .6);
          }
          // Pieds enfouis sous toute leur emprise ; la boîte de collision englobe aussi le sommet végétalisé.
          const formeK = organique ? 'bitume-lieu-rocher-calcaire' : 'bevel';
          const formeCap = organique ? 'bitume-lieu-galet-b' : 'bevel';
          objets.push({ shape: formeK, collision: 'roche', p: [x, bas + h * .5, z], s: [largeur * (organique ? 1.25 : 1), h, profondeur * (organique ? 1.25 : 1)], r: [0, a, 0], mat: 9, color: couleur });
          objets.push({ shape: formeCap, p: [x + largeur * .05, bas + h * .87, z], s: [largeur * .72, h * .24, profondeur * .69], r: [0, a, 0], mat: saison && saison.neige ? 3 : 8,
            color: saison && saison.neige ? [.90, .93, .96] : th.herbe });
        }
        if (objets.length) ajouter(objets, objets, p[0], p[2]);
      }
    }

    // Le hameau boréal reste dans les deux niveaux de détail ; fondations calculées sur les quatre coins.
    if (maisonsBaikal) for (const m of maisonsBaikal) {
      const objets = B.baikal.objetsMaison(m, saison && saison.neige);
      ajouter(objets, objets.slice(), m.x, m.z);
      if (architecture) architecture.maisons.push({ ...m, h: 3.2, baikal: true, theme: c.theme, graine: c.graine });
    }

    if (architecture) {
      // Les détails ont leurs petits lots et leur propre bascule ; ils ne retardent pas le LOD d'une forêt.
      for (let i = 0; i < architecture.maisons.length; i++) {
        const batiment = B.batiments.maison(architecture.maisons[i], { detail: qualite !== 'low', neige: !!(saison && saison.neige) });
        groupes.set('architecture' + i, { objets: batiment.objets, loin: batiment.loin, bascule: 180 });
      }
      const voie = B.batiments.voieService(c);
      if (voie.objets.length) groupes.set('architecture-voie', { objets: voie.objets, loin: voie.loin, bascule: 260 });
    }

    // Bords de route (lot 22F) : posés après tout le reste, dans des lots à eux (clé préfixée « b ») ajoutés à la fin :
    // les lots et les solides historiques gardent leur contenu, leur ordre et leurs identifiants.
    if (planBords) B.bords.poser(c, planBords, { limites: lim, qualite, organique,
      saisonArbre: (objets, loin, x, z, essence) => saisonArbre(objets, loin, x, z, essence, terrain.sol(x, z)),
      ajouter: (objets, loin, x, z) => {
      const q = interroger(x, z, 300), proche = q.i >= 0 && q.d < 330;
      const cle = 'b' + (proche ? 'p' + Math.floor(q.i * c.pas / TRONCON) : 'l' + Math.floor(x / 420) + ',' + Math.floor(z / 420));
      let l = groupes.get(cle); if (!l) groupes.set(cle, l = { objets: [], loin: [], lointain: !proche });
      for (const o of objets) l.objets.push(o);
      for (const o of loin) l.loin.push(o);
    } });

    // Les repères ne créent aucun solide. Leurs lots propres sont ajoutés après tous les lots physiques.
    if (reperes) poserReperes(c, reperes, lim, interroger, (objets, loin, x, z) => {
      const q = interroger(x, z, 80), cle = 'v' + Math.floor(q.i * c.pas / TRONCON);
      let l = groupes.get(cle); if (!l) groupes.set(cle, l = { objets: [], loin: [], lointain: false });
      l.objets.push(...objets); l.loin.push(...loin);
    });

    const lieuxCimes = B.cimesDecor && B.cimesDecor.poser(c, { terrain, limites: lim, qualite, saison, ajouter });
    const lieuxLarche = B.larcheDecor && B.larcheDecor.poser(c, { terrain, limites: lim, qualite, saison, ajouter,
      decorProgressif: options.decorProgressif, basculeDetail: qualite === 'low' && organique ? 280 : 520 });
    const lieuxMarseille = B.marseilleDecor && B.marseilleDecor.poser(c, { terrain, limites: lim, qualite, saison, ajouter });
    const outilsLieux = { terrain, limites: lim, interroger, qualite, saison, ajouter, th, pontFjord };
    // Les repères prennent leur abscisse dans leur paysage d'origine. Le contrôle
    // physique consulte toujours le circuit entier, y compris le bras d'en face.
    function poserParPaysage(module) {
      if (!module) return null;
      if (!portionsLieux) return module.poser(c, outilsLieux);
      const marqueurs = [];
      for (const secteur of portionsLieux) {
        const local = saison ? B.saisons.profil(saison.id, secteur.theme) : null;
        const lieux = module.poser(c, { ...outilsLieux, secteur, saison: local });
        if (lieux?.marqueurs) marqueurs.push(...lieux.marqueurs);
      }
      return { marqueurs };
    }
    const lieuxDest = poserParPaysage(B.destinations);
    if (organique && c.stands && B.equipeStands && B.equipeStands.construireDecors) {
      B.equipeStands.construireDecors(c, terrain, ajouter);
    }
    let lieuxEmblematiques = organique && !estMarseille ? poserParPaysage(B.lieux) : null;
    if (lieuxLarche && lieuxLarche.marqueurs && lieuxLarche.marqueurs.length) {
      lieuxEmblematiques = Object.assign({}, lieuxEmblematiques || {}, { marqueurs: lieuxLarche.marqueurs });
    } else if (lieuxMarseille && lieuxMarseille.marqueurs && lieuxMarseille.marqueurs.length) {
      lieuxEmblematiques = Object.assign({}, lieuxEmblematiques || {}, { marqueurs: lieuxMarseille.marqueurs });
    } else if (lieuxDest && lieuxDest.marqueurs && lieuxDest.marqueurs.length) {
      lieuxEmblematiques = Object.assign({}, lieuxEmblematiques || {}, { marqueurs: portionsLieux ? [...(lieuxEmblematiques?.marqueurs || []), ...lieuxDest.marqueurs] : lieuxDest.marqueurs });
    }

    // Finition des lots : sphère englobante et portée.
    const lots = [];
    for (const l of groupes.values()) {
      if (!l.objets.length) continue;
      // Ces objets gardent exactement leur géométrie, leurs solides et leur répartition. La recette de surface
      // change seulement dans le biome pilote, dans les versions proches et lointaines du même lot.
      if (th.matieres) for (const objets of [l.objets, l.loin]) for (const o of objets) {
        if (o.mat === 3) o.mat = th.matieres.beton;
        else if (o.mat === 9) o.mat = th.matieres.roche;
      }
      // Le candidat FERRO 23 est activé sur option explicite en Fine, indépendamment des sols procéduraux. Les versions
      // proches et lointaines gardent leurs pigments, primitives et métadonnées physiques d'origine.
      if (pierresProcedurales) for (const objets of [l.objets, l.loin]) for (const o of objets) {
        const genre = o.solidePhysX?.genre;
        if (o.mat === 9 && (PIERRES_MONTAGNE.has(genre) || genre === 'refuge-cimes' && o.partie === 'socle-refuge')) o.mat = MATIERES_PILOTES.roche;
      }
      let mx = 0, my = 0, mz = 0;
      for (const o of l.objets) { mx += o.p[0]; my += o.p[1]; mz += o.p[2]; }
      mx /= l.objets.length; my /= l.objets.length; mz /= l.objets.length;
      let rayon = 0;
      for (const o of l.objets) { const s = o.s || [1, 1, 1]; rayon = Math.max(rayon, Math.hypot(o.p[0] - mx, o.p[1] - my, o.p[2] - mz) + Math.hypot(s[0], s[1], s[2]) / 2); }
      // Aucune portée propre : un lot se dessine jusqu'au plan lointain de la caméra, la brume fait la limite (un massif
      // qui surgit à 1 900 m se voit). La bascule vers la version allégée se fait là où un tronc tient en un pixel.
      const basculeDefaut = qualite === 'low' && options.organique === true
        ? (l.lointain ? 480 : 280) : (l.lointain ? 900 : 520);
      lots.push({ objets: l.objets, loin: l.loin, centre: [mx, my, mz], rayon, portee: Infinity, bascule: l.bascule || basculeDefaut });
    }
    // Collision et image partagent les mêmes primitives ; aucune consommation du hasard supplémentaire.
    // Les troncs gardent le prisme à 16 côtés et la rotation du cylindre WebGL, indépendants de la qualité.
    const obstacles = [];
    for (const lot of lots) for (const o of lot.objets) if (o.collision) {
      if(o.collision==='tronc'){obstacles.push({type:'prism',p:o.p.slice(),s:o.s.slice(),r:o.r.slice(),sides:16,genre:'tronc'});continue;}
      const commun = { x: o.p[0], z: o.p[2], ymin: o.p[1]-o.s[1]/2, ymax: o.p[1]+o.s[1]/2, genre: o.collision };
      if (o.shape === 'cylinder') obstacles.push(Object.assign(commun, { type: 'circle', r: o.s[0]/2 }));
      else obstacles.push(Object.assign(commun, { type: 'box', angle: -(o.r ? o.r[1] : 0), hx: o.s[0]/2, hz: o.s[2]/2 }));
    }
    const lotsDessin = casesArbres ? lotsImage(lots, casesArbres, objetsArbres) : lots;
    const atmosphereBase = Object.assign({ outdoorZones: [{ x: 0, z: 0, w: 1e7, d: 1e7 }] }, th.atmosphere, estMarseille ? { fogDensity: .00046 } : c.id === 'larche' ? { fogDensity: .00022 } : null);
    const atmosphere = saison ? B.saisons.atmosphere(saison, atmosphereBase) : atmosphereBase;
    // enceinte : portion de la ligne droite bordée de tribunes et de stands (abscisses comptées depuis la ligne) ; une
    // caméra de bord de piste s'y place devant eux, pas derrière la glissière où elle serait dans les gradins.
    const decor = { nappes: nappes.concat(terrain.liste), lots: lotsDessin, railsVirages, atmosphere, portique, obstacles, sol: terrain.sol, niveauEau: terrain.niveauEau, lagon: terrain.lagon, niveauEauA: terrain.niveauEauA, limites: lim, theme: th,
      arbres: positionsArbres,
      enceinte: { debut: avant - 10, fin: apres + 50 } };
    Object.defineProperty(decor, 'maillageSol', { value: terrain.maillageSol });
    if (architecture) Object.defineProperty(decor, 'architecture', { value: architecture });
    if (lieuxCimes) decor.cimes = lieuxCimes;
    if (terrain.paysageBaikal) Object.defineProperty(decor, 'baikal', { value: Object.freeze({
      plan: terrain.paysageBaikal, maisons: maisonsBaikal,
      lieux: Object.freeze([{ nom: 'Cap des Pins', t: terrain.paysageBaikal.cap }, { nom: 'Anse Claire', t: terrain.paysageBaikal.baie }, { nom: 'Éperon du Nord', t: 880 }].map(l => {
        const p = B.baikal.monde(terrain.paysageBaikal, B.baikal.rivage(terrain.paysageBaikal, l.t) - 90, l.t);
        return Object.freeze({ nom: l.nom, x: p[0], y: terrain.sol(p[0], p[1]), z: p[1] });
      }))
    }) });
    let herbier = null;
    const ouvrirHerbier = () => {
      if (herbier) return herbier;
      let cache = HERBIERS.get(c); if (!cache) HERBIERS.set(c, cache = new Map());
      const cle = (qualite === 'low' ? 'low' : 'naturel') + ':' + (options.arbres === undefined ? 2600 : options.arbres) + (ecologie ? ':ecologie' : '');
      const entree = cache.get(cle), couleurSaison = saison ? saison.id : 'historique';
      if (entree && entree.saison === couleurSaison) herbier = entree.herbier;
      if (!herbier) {
        // Lot 28C : une autre saison ne change que les couleurs du sol ; l'herbier gardé prête sa découpe quand la
        // géométrie lue est la même (creerHerbier compare les empreintes), sinon tout se refait.
        herbier = creerHerbier(c, decor.nappes, lots, lim, decor.enceinte, terrain.niveauEau, entree && entree.herbier, options.herbierWasm !== false);
        // Garder une seule palette par clé évite d'accumuler quatre grands caches de sol par circuit.
        cache.set(cle, { saison: couleurSaison, herbier });
      }
      return herbier;
    };
    Object.defineProperties(decor, {
      // lots lus par l'herbier, avant le regroupement des arbres en cases de l'image (lotsImage) : la référence
      // historique de verifications/herbier-identite.test.mjs doit relire exactement les mêmes, dans le même ordre
      lotsHerbier: { value: lots },
      ecologie: { value: ecologie },
      saison: { value: saison },
      sourcesFeuilles: { value: sourcesFeuilles },
      herbier: { get: ouvrirHerbier },
      surfaceHerbe: { value: (x, z, sortie) => terrain.lagon && Number.isFinite(terrain.niveauEauA(x,z)) ? null : ouvrirHerbier().surface(x, z, sortie) },
    });
    if (tunnelLampes) decor.tunnelLampes = tunnelLampes;
    // Végétation basse : générateur et lots indépendants. Le décor historique et ses solides restent identiques ;
    // vegetation:false permet une comparaison avant/après avec exactement les mêmes obstacles. Le module choisit
    // lui-même les biomes qu'il sait habiller et retourne des lots vides pour les autres. La densité nommée
    // vegetationQualite surcharge seulement les plantes : ni les arbres, ni leurs collisions, ni leurs matières.
    const vegetationQualite = ['off', 'low', 'medium', 'high', 'ultra'].includes(options.vegetationQualite)
      ? options.vegetationQualite : qualite;
    // Les bosquets sont réservés au décor enrichi du jeu. Rassembler uniquement
    // les emprises du mobilier, avant que les lots d'herbe ne soient ajoutés.
    const bosquets = organique && options.vegetation === true && B.bosquets && vegetationQualite !== 'off'
      ? B.bosquets.construire(c, terrain, lots, interroger, ecologie, saison, vegetationQualite, { progressif: options.decorProgressif === true }) : [];
    if (B.vegetation && options.vegetation !== false && vegetationQualite !== 'off') {
      const v = B.vegetation.construire(c, { limites: lim, interroger, qualite: vegetationQualite,
        // Les biomes sans implantation sortent avant de demander la découpe des prairies.
        get surfaces() { return vegetationQualite === 'low' || th.volcanique || th.aride || th.karstique || th.pacifique ? null : ouvrirHerbier(); },
        ecologie });
      if (saison) {
        const habitat = {};
        for (const lot of v.lots) {
          const saisonLot = terrain.saisonSecondaire && terrain.partSecondaire(lot.centre[0],lot.centre[2]) >= .5 ? terrain.saisonSecondaire : saison;
          for (let i=0; i<lot.objets.length; i++) {
            const o = lot.objets[i]; if (!o.color || o.shape === 'humus-val') continue;
            if (ecologie) ecologie.echantillonner(o.p[0], o.p[2], habitat);
            const famille = o.shape === 'fleurs-val' ? 'fleurs' : 'herbe';
            const couleur = B.saisons.teinte(saisonLot, famille, o.color, o.p[0], o.p[2], ecologie ? habitat : null);
            o.color = couleur;
            if (lot.loin[i]) lot.loin[i].color = couleur;
          }
        }
      }
      // Les masques d'herbe ouverts plus tard relisent `lots`, qui reçoit donc les massifs ; les lots d'image les
      // reçoivent aussi, à la fin.
      lots.push(...v.lots);
      if (lotsDessin !== lots) lotsDessin.push(...v.lots);
      decor.vegetation = { herbes: v.herbes, fougeres: v.fougeres, fleurs: v.fleurs, taillis: v.taillis,
        lots: v.lots.length, qualite: v.qualite,
        brins: v.brins, tuiles: v.tuiles, brinsTapis: v.brinsTapis, objetsHerbe: v.objetsHerbe,
        brinsAccotements: v.brinsAccotements, brinsTerrain: v.brinsTerrain,
        aireAccotements: v.aireAccotements, aireTerrain: v.aireTerrain,
        aireNue: v.aireNue, aireRiche: v.aireRiche, brinsRiches: v.brinsRiches };
    }
    // Les solides PhysX et l'herbier conservent leurs listes ; aucune instance de
    // bosquet n'entre dans les collisions, ni dans les masques de la prairie.
    if (bosquets.length) decor.lots = decor.lots.concat(bosquets);
    if (lieuxLarche?.lotsDetail?.length) decor.lots = decor.lots.concat(lieuxLarche.lotsDetail);
    if (options.decorProgressif) Object.defineProperty(decor, 'fluxDecor', { value: creerFluxDecor(decor.lots) });
    // Le palier est une métadée de suivi, pas une donnée d'image : il reste non énumérable pour que les
    // empreintes historiques du décor (verifications/decor-identite.test.mjs) ne bougent pas d'un cran.
    Object.defineProperty(decor, 'qualite', { value: qualite, enumerable: false });
    // Les gradins pour public.js : non énumérables eux aussi, hors des empreintes du décor.
    if (gradins) Object.defineProperty(decor, 'gradins', { value: gradins, enumerable: false });
    if (lieuxEmblematiques) Object.defineProperty(decor, 'lieux', { value: lieuxEmblematiques, enumerable: false });
    // L'indice des cellules végétalisables est déjà acquis par l'herbier. Le rendu peut
    // donc employer une seule matière continue pour terre, roche, sable et neige.
    const matSol=options.solsProceduraux===true ? 25.125 : 8.125;
    for (const n of decor.nappes) {
      if (n.surfaceType!=='accotement' && n.surfaceType!=='terrain' && n.surfaceType!=='panorama') continue;
      n.vertexTint='smooth';
      for(let k=9;k<n.sommets.length;k+=13) {
        const m=n.sommets[k];
        if (m===8 || m===8.125 || m===25.125 || n.surfaceType!=='accotement' && (m===3 || m===9 || m===23 || m===25)) n.sommets[k]=matSol;
      }
    }
    return decor;
  }

  B.decor = { construire, THEMES, angles, base, limites, hauteurRoute, cadre, marquerSolide, CASE_ARBRES, BASCULE_ARBRES, PIXELS_BASCULE,
    ARBRES_EPARS, CASE_EPARSE, basculeArbres, lotsSecondMoteur, comptesHerbier: COMPTES_HERBIER };
})(globalThis.BITUME = globalThis.BITUME || {});
