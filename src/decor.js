/* BITUME — décor calculé depuis le circuit : chaussée, accotements, terrain, eau, arbres, tribunes, glissières.
   Aucune image ni modèle : des nappes de triangles (matière et couleur par sommet) et des primitives du moteur FERRO. */
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
    return somme / (1 - Math.pow(.5, octaves));
  }
  const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const melange = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
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
    }
  };
  const PUBLICITES = [[.86, .12, .08], [.98, .78, .10], [.10, .28, .70], [.06, .52, .30], [.95, .95, .92], [.08, .08, .09], [.92, .40, .06], [.40, .14, .55]];
  // Recettes opt-in de FERRO : seules les surfaces de Val-Brûlé changent. Les marquages de piste restent sur
  // leur matière historique et les glissières gardent leur métal galvanisé ; 24 désigne une vraie tôle peinte.
  const MATIERES_PILOTES = Object.freeze({ asphalte: 21, beton: 22, roche: 23, metalPeint: 24 });

  // ---------------------------------------------------------------- géométrie du circuit
  function cadre(c, i) {
    i = ((i % c.n) + c.n) % c.n;
    const a = c.cap[i];
    return { i, s: i * c.pas, x: c.x[i], y: c.y[i], z: c.z[i], a, t: [Math.cos(a), 0, Math.sin(a)], r: [-Math.sin(a), 0, Math.cos(a)], devers: c.devers[i], k: c.courbure[i] };
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
      G[i] = Math.max(c.largeur / 2 + 3.2, g); D[i] = Math.max(c.largeur / 2 + 3.2, d);
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
    const nz = z1 - z0 + 1, cases = new Array((x1 - x0 + 1) * nz);
    for (let i = 0; i < c.n; i++) {
      const k = (Math.floor(c.x[i] / T) - x0) * nz + Math.floor(c.z[i] / T) - z0;
      let l = cases[k]; if (!l) cases[k] = l = []; l.push(i);
    }
    // Plus proche échantillon et hauteur pondérée (inverse de la distance à la puissance 8 : continue, et exacte sur l'axe).
    function interroger(x, z, rayon) {
      const cx = Math.floor(x / T), cz = Math.floor(z / T), r = Math.ceil(rayon / T);
      let meilleur = -1, d2min = Infinity, somme = 0, poids = 0;
      // Les cases hors des bornes sont vides. Garder exactement l’ordre a/b/i
      // conserve la somme pondérée et les départages, donc la géométrie produite.
      const amin = Math.max(cx - r, x0), amax = Math.min(cx + r, x1);
      const bmin = Math.max(cz - r, z0), bmax = Math.min(cz + r, z1);
      for (let a = amin; a <= amax; a++) for (let b = bmin; b <= bmax; b++) {
        const l = cases[(a - x0) * nz + b - z0]; if (!l) continue;
        for (const i of l) {
          const dx = c.x[i] - x, dz = c.z[i] - z, d2 = dx * dx + dz * dz;
          if (d2 < d2min) { d2min = d2; meilleur = i; }
          const q = d2 + 1, w = 1 / (q * q * q * q);
          somme += w * c.y[i]; poids += w;
        }
      }
      return { i: meilleur, d: Math.sqrt(d2min), y: poids > 0 ? somme / poids : 0 };
    }
    return interroger;
  }

  // ---------------------------------------------------------------- nappes
  function nappe() { return { s: [], i: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; }
  function sommet(n, p, no, mat, col) {
    n.s.push(p[0], p[1], p[2], no[0], no[1], no[2], 0, 0, 0, mat, col[0], col[1], col[2]);
    for (let k = 0; k < 3; k++) { if (p[k] < n.min[k]) n.min[k] = p[k]; if (p[k] > n.max[k]) n.max[k] = p[k]; }
    return n.s.length / 13 - 1;
  }
  function finir(n) {
    const centre = n.min.map((v, k) => (v + n.max[k]) / 2);
    const rayon = Math.hypot(n.max[0] - n.min[0], n.max[1] - n.min[1], n.max[2] - n.min[2]) / 2;
    return { sommets: new Float32Array(n.s), indices: new Uint32Array(n.i), centre, rayon };
  }

  function nappesRoute(c, th, lim) {
    const w = c.largeur / 2, n = c.n, LIGNES = 60, liste = [];
    const asphalte = i => { const v = .165 + .035 * fbm(i * c.pas / 90, 3.7, c.graine + 5, 2); return [v, v, v * 1.04]; };
    const blanc = [.86, .86, .83], rouge = [.74, .09, .07], blancBordure = [.90, .90, .87];
    for (let debut = 0; debut < n; debut += LIGNES) {
      const fin = Math.min(n, debut + LIGNES), nap = nappe();
      // bandes : d0, d1 (fonctions de la ligne), type
      const bandes = [
        ['jupe', -1], ['herbe', -1], ['bord', -1], ['ligne', -1], ['asphalte', 0], ['ligne', 1], ['bord', 1], ['herbe', 1], ['jupe', 1]
      ];
      const premiers = [];
      for (let b = 0; b < bandes.length; b++) premiers.push([]);
      for (let i = debut; i <= fin; i++) {
        const f = cadre(c, i), no = [Math.sin(f.devers) * f.r[0], Math.cos(f.devers), Math.sin(f.devers) * f.r[2]];
        const limG = lim.G[f.i], limD = lim.D[f.i];
        const vib = c.vibreur[f.i], tranche = Math.floor(f.i * c.pas / 4) % 2;
        const tonte = Math.floor(f.i * c.pas / 20) % 2 ? th.herbe : th.herbeClaire;
        for (let b = 0; b < bandes.length; b++) {
          const [type, cote] = bandes[b];
          let d0, d1, y0, y1, mat = 8, col = tonte, n0 = no, n1 = no;
          if (type === 'asphalte') { d0 = -w + .3; d1 = w - .3; y0 = hauteurRoute(f, d0, w); y1 = hauteurRoute(f, d1, w); mat = th.matieres ? th.matieres.asphalte : 14; col = asphalte(f.i); }
          else {
            const bord = cote < 0 ? -1 : 1, limite = cote < 0 ? limG : limD, yBord = hauteurRoute(f, bord * w, w);
            const ext = limite + 4;
            if (type === 'ligne') { d0 = bord * (w - .3); d1 = bord * w; y0 = hauteurRoute(f, d0, w); y1 = yBord; mat = 14; col = blanc; }
            else if (type === 'bord') {
              d0 = bord * w; d1 = bord * (w + 1.2); y0 = yBord;
              const avec = cote < 0 ? (vib & 1) : (vib & 2);
              y1 = yBord + (avec ? .05 : -.015);
              if (avec) { mat = 14; col = tranche ? rouge : blancBordure; } else { mat = 8; col = tonte; }
            } else if (type === 'herbe') { d0 = bord * (w + 1.2); d1 = bord * ext; y0 = yBord - .015; y1 = yBord - .02 * (ext - w - 1.2); col = tonte; n0 = n1 = [0, 1, 0]; }
            else { d0 = bord * ext; d1 = bord * (ext + 4); y0 = yBord - .02 * (ext - w - 1.2); y1 = y0 - 2.6; col = th.herbe.map(v => v * .86); n0 = n1 = [0, 1, 0]; }
            if (cote < 0) { const t = d0; d0 = d1; d1 = t; const u = y0; y0 = y1; y1 = u; }
          }
          const ia = sommet(nap, pointPlan(f, d0, y0), n0, mat, col), ib = sommet(nap, pointPlan(f, d1, y1), n1, mat, col);
          const prec = premiers[b];
          if (prec.length) { const [pa, pb] = prec; nap.i.push(pa, pb, ib, pa, ib, ia); }
          premiers[b] = [ia, ib];
        }
      }
      liste.push(finir(nap));
    }
    return liste;
  }

  // Terrain : grille autour du circuit, raccordée à la chaussée par une pondération continue des hauteurs de l'axe.
  function nappesTerrain(c, th, interroger, g) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < c.n; i++) { x0 = Math.min(x0, c.x[i]); x1 = Math.max(x1, c.x[i]); z0 = Math.min(z0, c.z[i]); z1 = Math.max(z1, c.z[i]); }
    const marge = th.marge, pasT = 24;
    x0 -= marge; z0 -= marge; x1 += marge; z1 += marge;
    const nx = Math.ceil((x1 - x0) / pasT) + 1, nz = Math.ceil((z1 - z0) / pasT) + 1;
    const H = new Float32Array(nx * nz), D = new Float32Array(nx * nz);
    const centreX = (x0 + x1) / 2, centreZ = (z0 + z1) / 2;
    const merAngle = hache(g, 7, 3) * Math.PI * 2, mer = [Math.cos(merAngle), Math.sin(merAngle)];
    let merDebut = -Infinity;
    if (th.eau !== undefined) {
      merDebut = -Infinity;
      for (let i = 0; i < c.n; i++) merDebut = Math.max(merDebut, (c.x[i] - centreX) * mer[0] + (c.z[i] - centreZ) * mer[1]);
      merDebut += 90;
    }
    const hauteur = (x, z) => {
      const q = interroger(x, z, 230), d = q.i < 0 ? 1e4 : q.d, yT = q.i < 0 ? 0 : q.y;
      let h = yT - .9 * (1 - lisse(26, 34, d));
      const nat = (fbm(x / th.echelle, z / th.echelle, g, 5) - .45) * th.relief * 2;
      h += nat * lisse(30, 260, d);
      if (th.montagnes) {
        const crete = 1 - Math.abs(fbm(x / 900, z / 900, g + 9, 4) * 2 - 1);
        h += (120 + 260 * crete) * lisse(380, 1050, d);
      }
      if (th.eau !== undefined) {
        const p = (x - centreX) * mer[0] + (z - centreZ) * mer[1];
        h -= 34 * lisse(merDebut - 40, merDebut + 220, p) * lisse(60, 140, d);
      }
      return { h, d };
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const r = hauteur(x0 + i * pasT, z0 + j * pasT); H[j * nx + i] = r.h; D[j * nx + i] = r.d;
    }
    const liste = [], TUILE = 14;
    const couleur = (h, d, ny, x, z) => {
      const tache = fbm(x / 140, z / 140, g + 3, 3);
      let col = melange(th.herbe, th.terre, lisse(.45, .8, tache) * .7), mat = 8;
      if (th.eau !== undefined && h < th.eau + 2.2) { col = th.sable; }
      if (th.montagnes) {
        if (ny < .8 || h > 120) { col = melange(th.roche, th.roche.map(v => v * .8), tache); mat = 9; }
        if (h > 250 + 40 * tache && ny > .6) { col = th.neige; mat = 3; }
      } else if (ny < .7) { col = th.terre; }
      return [mat, col];
    };
    for (let tj = 0; tj < nz - 1; tj += TUILE) for (let ti = 0; ti < nx - 1; ti += TUILE) {
      const nap = nappe(), id = new Map();
      const prendre = (i, j) => {
        const cle = j * nx + i; if (id.has(cle)) return id.get(cle);
        const x = x0 + i * pasT, z = z0 + j * pasT, h = H[cle];
        const hx = H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)];
        const hz = H[Math.min(nz - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i];
        const no = [-hx / (2 * pasT), 1, -hz / (2 * pasT)], l = Math.hypot(no[0], no[1], no[2]); no[0] /= l; no[1] /= l; no[2] /= l;
        const [mat, col] = couleur(h, D[cle], no[1], x, z);
        const k = sommet(nap, [x, h, z], no, mat, col); id.set(cle, k); return k;
      };
      for (let j = tj; j < Math.min(nz - 1, tj + TUILE); j++) for (let i = ti; i < Math.min(nx - 1, ti + TUILE); i++) {
        // Une case entièrement sous la chaussée ou ses accotements reste invisible : on la saute.
        if (D[j * nx + i] < 18 && D[j * nx + i + 1] < 18 && D[(j + 1) * nx + i] < 18 && D[(j + 1) * nx + i + 1] < 18) continue;
        const a = prendre(i, j), b = prendre(i + 1, j), cc = prendre(i + 1, j + 1), d = prendre(i, j + 1);
        nap.i.push(a, cc, b, a, d, cc);
      }
      if (nap.i.length) liste.push(finir(nap));
    }
    let eau = null;
    if (th.eau !== undefined) {
      const nap = nappe(), y = th.eau, col = [.10, .30, .40];
      const e = 2600, coins = [[centreX - e, centreZ - e], [centreX + e, centreZ - e], [centreX + e, centreZ + e], [centreX - e, centreZ + e]];
      const k = coins.map(([x, z]) => sommet(nap, [x, y, z], [0, 1, 0], 12, col));
      nap.i.push(k[0], k[2], k[1], k[0], k[3], k[2]);
      eau = finir(nap);
    }
    const sol = (x, z) => {
      const fi = (x - x0) / pasT, fj = (z - z0) / pasT, i = Math.max(0, Math.min(nx - 2, Math.floor(fi))), j = Math.max(0, Math.min(nz - 2, Math.floor(fj)));
      const u = Math.max(0, Math.min(1, fi - i)), v = Math.max(0, Math.min(1, fj - j));
      const h00 = H[j * nx + i], h10 = H[j * nx + i + 1], h01 = H[(j + 1) * nx + i], h11 = H[(j + 1) * nx + i + 1];
      return h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;
    };
    return { liste: eau ? liste.concat([eau]) : liste, sol, bornes: [x0, z0, x1, z1], niveauEau: th.eau };
  }

  // ---------------------------------------------------------------- objets
  function arbre(liste, loin, x, y, z, essence, r) {
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
  }

  function tribune(liste, loin, f, w, cote, longueur, r) {
    // Gradins face à la piste, côté gauche (cote −1) ou droit (+1), alignés sur la ligne droite.
    const recul = cote * (w + 9), rot = capRot(f.a), y0 = hauteurRoute(f, cote * w, w) - .2;
    const vers = (d, h, l = 0) => [f.x + f.r[0] * d + f.t[0] * l, y0 + h, f.z + f.r[2] * d + f.t[2] * l];
    const marches = 8, profondeur = 1.15, haut = .5;
    for (let m = 0; m < marches; m++) {
      const d = recul + cote * (m * profondeur + profondeur / 2);
      liste.push({ shape: 'box', collision: 'gradin', p: vers(d, (m + 1) * haut / 2), s: [longueur, (m + 1) * haut, profondeur], r: rot, mat: 3, color: [.62, .62, .6] });
      // spectateurs : une rangée de silhouettes colorées par marche, avec des trous
      const rangee = [];
      for (let k = -longueur / 2 + .6; k < longueur / 2 - .4; k += .62) {
        if (r() < .22) continue;
        rangee.push(k);
        liste.push({ shape: 'box', p: vers(d + cote * .1, (m + 1) * haut + .34, k), s: [.42, .68, .36], r: rot, mat: 18, color: PUBLICITES[Math.floor(r() * PUBLICITES.length)].map(v => v * (.6 + r() * .4)) });
      }
      loin.push({ shape: 'box', p: vers(d, (m + 1) * haut / 2 + .3, 0), s: [longueur, (m + 1) * haut + .6, profondeur], r: rot, mat: 18, color: [.42, .36, .34] });
    }
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

  function construire(c, options = {}) {
    const th = Object.assign({}, THEMES[c.theme] || THEMES.foret), g = (c.graine * 7919 + 13) >>> 0, r = alea(g);
    if (c.theme === 'foret' && options.matieres !== false) th.matieres = MATIERES_PILOTES;
    // l'eau ne noie jamais la piste : le niveau descend sous le point le plus bas de l'axe (le virage de
    // Port-Sable plongeait à −5,8 sous le niveau −4 du thème cote, David 14/11)
    if (th.eau !== undefined) {
      let yMin = Infinity;
      for (let i = 0; i < c.n; i++) yMin = Math.min(yMin, c.y[i]);
      th.eau = Math.min(th.eau, yMin - 2.5);
    }
    const w = c.largeur / 2, lim = limites(c), interroger = indexAxe(c);
    let tunnelLampes = null;   // positions des lampes du tunnel : le jeu en fait des lumières près de la caméra
    const nappes = nappesRoute(c, th, lim);
    const terrain = nappesTerrain(c, th, interroger, g);
    const groupes = new Map();   // lots par portion de 150 m, plus lots lointains
    const TRONCON = 150;
    const lotDe = (x, z, i) => {
      const cle = i >= 0 ? 'p' + Math.floor(i * c.pas / TRONCON) : 'l' + Math.floor(x / 420) + ',' + Math.floor(z / 420);
      let l = groupes.get(cle); if (!l) groupes.set(cle, l = { objets: [], loin: [], lointain: i < 0 }); return l;
    };
    const ajouter = (objets, loin, x, z) => {
      const q = interroger(x, z, 300), proche = q.i >= 0 && q.d < 330, l = lotDe(x, z, proche ? q.i : -1);
      for (const o of objets) l.objets.push(o);
      for (const o of loin) l.loin.push(o);
    };

    // Glissières à double lisse sur poteaux, posées à la limite de chaque côté.
    const PAS_G = 4, sousTunnel = i => B.circuit.dansTunnel && B.circuit.dansTunnel(c, i * c.pas, 6);
    for (let i = 0; i < c.n; i += PAS_G) {
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
        const loin = [objets[0]];
        // panneaux publicitaires sur les lignes droites
        if (Math.abs(f0.k) < 1 / 500 && (i / PAS_G) % 9 === 4 && r() < .7) {
          const coul = PUBLICITES[Math.floor(r() * PUBLICITES.length)], coul2 = PUBLICITES[Math.floor(r() * PUBLICITES.length)];
          const pp = [milieu[0] - az[0] * cote * .18, milieu[1] + 1.25, milieu[2] - az[2] * cote * .18];
          objets.push({ shape: 'box', p: pp, s: [long * .9, .9, .06], r: rot, mat: 16, color: coul });
          objets.push({ shape: 'box', p: [pp[0] - az[0] * cote * .04, pp[1] + .12, pp[2] - az[2] * cote * .04], s: [long * .55, .26, .03], r: rot, mat: 16, color: coul2 });
          loin.push(objets[objets.length - 2]);
        }
        ajouter(objets, loin, milieu[0], milieu[2]);
      }
    }

    // Tunnel de Haut-Col (circuit.js, c.tunnel) : murs de béton aux limites, voûte, lampes, deux portails dans la roche
    // et la montagne autour (flancs posés au sol contre les murs, crête sur la voûte, rien ne dépasse à l'intérieur).
    // L'intérieur est éclairé « dedans » (outdoor: false : ni soleil ni ciel, seulement les lampes) ; la chaussée y est
    // doublée d'un revêtement intérieur, car la nappe de la route reste éclairée par le ciel. Pas de pluie dedans (jeu.js).
    if (c.tunnel) {
      const T = c.tunnel, PAS_T = 3, iD = Math.round(T.debut / c.pas), iF = Math.round(T.fin / c.pas), M = T.mur, H = T.hauteur;
      const BETON = [.50, .50, .48], VOUTE = [.22, .22, .23], SOL = [.20, .20, .205], LIGNE = [.82, .82, .78];
      const ROCHE = [.43, .41, .38], ROCHE2 = [.36, .35, .33], ROCHE3 = [.48, .46, .42];
      tunnelLampes = [];
      for (let i = iD; i < iF; i += PAS_T) {
        const f0 = cadre(c, i), f1 = cadre(c, Math.min(i + PAS_T, iF)), y0 = hauteurRoute(f0, 0, w), y1 = hauteurRoute(f1, 0, w);
        const objets = [], loin = [];
        const a0 = pointPlan(f0, 0, y0), a1 = pointPlan(f1, 0, y1), axe = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], long = Math.hypot(...axe) + .05;
        const no = [Math.sin(f0.devers) * f0.r[0], Math.cos(f0.devers), Math.sin(f0.devers) * f0.r[2]], rotSol = angles(...base(axe, no));
        const milieu = (d, h) => { const p = pointPlan(f0, d, (y0 + y1) / 2 + h), q = pointPlan(f1, d, 0); return [(p[0] + q[0]) / 2, p[1], (p[2] + q[2]) / 2]; };
        // revêtement intérieur (4 cm au-dessus de la nappe) et lignes de rive
        const sol = { shape: 'box', p: milieu(0, -.01), s: [long, .1, 2 * M], r: rotSol, mat: 7, color: SOL, outdoor: false, surface: 'object' };
        objets.push(sol); loin.push(sol);
        for (const cote of [-1, 1]) objets.push({ shape: 'box', p: milieu(cote * (w - .15), .045), s: [long, .02, .26], r: rotSol, mat: 7, color: LIGNE, outdoor: false, surface: 'object' });
        for (const cote of [-1, 1]) {
          const p0 = pointPlan(f0, cote * (M + .3), y0), p1 = pointPlan(f1, cote * (M + .3), y1);
          const dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], rot = angles(...base(dir, [0, 1, 0]));
          const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2];
          const mur = { shape: 'box', p: [m[0], m[1] + H / 2 - .2, m[2]], s: [long, H + .4, .6], r: rot, mat: 3, color: BETON, outdoor: false };
          objets.push(mur); loin.push(mur);
          // bande réfléchissante, et une lampe tous les 12 m de chaque côté, en quinconce
          objets.push({ shape: 'box', p: [m[0] - f0.r[0] * cote * .32, m[1] + .9, m[2] - f0.r[2] * cote * .32], s: [long, .14, .02], r: rot, mat: 16, color: [.85, .72, .2], outdoor: false });
          if (((i - iD) / PAS_T + (cote > 0 ? 0 : 2)) % 4 === 0) {
            const lampe = { shape: 'box', p: [m[0] - f0.r[0] * cote * .34, m[1] + H - .6, m[2] - f0.r[2] * cote * .34], s: [1.1, .16, .08], r: rot, mat: 5, color: [1, .86, .58], emissive: 2.4, outdoor: false };
            objets.push(lampe); loin.push(lampe);
            tunnelLampes.push([m[0] - f0.r[0] * cote * 1.2, m[1] + H - .9, m[2] - f0.r[2] * cote * 1.2]);
          }
        }
        const c0 = pointPlan(f0, 0, y0 + H + .35), c1 = pointPlan(f1, 0, y1 + H + .35), dir = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]];
        const voute = { shape: 'box', p: [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2], s: [long, .7, 2 * M + 1.4], r: angles(...base(dir, [0, 1, 0])), mat: 3, color: VOUTE, outdoor: false };
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
        const f = cadre(c, i), y = hauteurRoute(f, 0, w), objets = [], h = k => hache(i, k, g + 101);
        if (i >= iD + 3 && i <= iF - 3) {
          const haut = Hc - .5 + 3 * h(1) - (H + .7);
          objets.push({ shape: 'bevel', p: pointPlan(f, (h(2) - .5) * 4, y + H + .7 + haut / 2), s: [12 + 4 * h(3), haut, 2 * M + 8], r: angles(...base(f.t, [0, 1, 0])), mat: 9, color: ROCHES[i % 3] });
          // un piton par-dessus, de travers, pour casser la ligne de crête
          if (h(4) > .45) objets.push({ shape: 'octa', p: pointPlan(f, (h(5) - .5) * 16, y + Hc + 1.5 + 2 * h(6)), s: [9 + 6 * h(7), 5 + 6 * h(8), 8 + 6 * h(9)], r: [h(11) * .5, h(12) * 6.3, h(13) * .5], mat: 9, color: ROCHES[(i + 1) % 3] });
        }
        for (const cote of [-1, 1]) {
          let lat = M + .6;
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
            objets.push({ shape: pointu ? 'octa' : 'bevel', p: pointPlan(f, cote * centre, y - 2 + (haut + 2) / 2 + (pointu ? haut * .2 : 0)), s: [11 + 5 * h(50 + k), (haut + 2) * (pointu ? 1.5 : 1), large * (pointu ? 1.3 : 1)], r: angles(...base(av, dessus)), mat: 9, color: ROCHES[(i + k + (cote > 0)) % 3] });
          }
        }
        if (objets.length) ajouter(objets, objets.slice(), f.x, f.z);
      }
      // portails : façade de roche percée à la taille de la voûte, à chaque bout, encadrée de béton (piédroits et linteau)
      for (const [i, sens] of [[iD, -1], [iF, 1]]) {
        const f = cadre(c, i), y = hauteurRoute(f, 0, w), rot = capRot(f.a), objets = [];
        const devant = (d, h) => { const p = pointPlan(f, d, y + h); return [p[0] + f.t[0] * sens * 1.75, p[1], p[2] + f.t[2] * sens * 1.75]; };
        for (const cote of [-1, 1]) {
          objets.push({ shape: 'bevel', p: pointPlan(f, cote * (M + 7.3), y + 7.5), s: [3, 15.5, 14], r: rot, mat: 9, color: ROCHE });
          objets.push({ shape: 'box', p: devant(cote * (M + .4), H / 2 - .05), s: [.5, H + .1, .8], r: rot, mat: 3, color: BETON });
        }
        objets.push({ shape: 'bevel', p: pointPlan(f, 0, y + H + 4.5), s: [3, 7, 2 * M + 28], r: rot, mat: 9, color: ROCHE2 });
        objets.push({ shape: 'box', p: devant(0, H + .8), s: [.5, 1.6, 2 * M + 2.4], r: rot, mat: 3, color: BETON });
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
      for (const [metres, barres] of [[150, 3], [100, 2], [50, 1]]) {
        const f = cadre(c, entree - metres / c.pas), yb = hauteurRoute(f, ext * w, w);
        const p = pointPlan(f, ext * (w + 3.2), yb), rot = capRot(f.a);
        const objets = [{ shape: 'box', p: [p[0], p[1] + 1.3, p[2]], s: [.08, 1.5, 1.2], r: rot, mat: 16, color: [.93, .93, .9] },
          { shape: 'cylinder', p: [p[0], p[1] + .3, p[2]], s: [.08, .6, .08], mat: 0, color: [.5, .5, .5] }];
        for (let b = 0; b < barres; b++) objets.push({ shape: 'box', p: [p[0] - f.t[0] * .05, p[1] + .85 + b * .38, p[2] - f.t[2] * .05], s: [.03, .18, 1.0], r: rot, mat: 16, color: [.07, .07, .08] });
        ajouter(objets, [objets[0]], p[0], p[2]);
      }
      // murs de pneus à l'extérieur, devant la glissière
      for (let j = -8; j <= 14; j += 2) {
        const f = cadre(c, v.i + j), L = (ext < 0 ? lim.G : lim.D)[f.i] - .8, yb = hauteurRoute(f, ext * w, w) - .02 * (L - w);
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
    }

    // Ligne droite principale : grille, ligne d'arrivée, portique des feux, tribunes et bâtiment des stands.
    const f0 = cadre(c, 0), rot0 = capRot(f0.a);
    const objetsDepart = [], loinDepart = [];
    for (let k = 0; k < 12; k++) for (let rg = 0; rg < 2; rg++) {
      const d = -w + .3 + (k + .5) * (2 * w - .6) / 12, s = (rg - .5) * 1.1;
      const p = [f0.x + f0.r[0] * d + f0.t[0] * s, hauteurRoute(f0, d, w) + .012, f0.z + f0.r[2] * d + f0.t[2] * s];
      objetsDepart.push({ shape: 'box', p, s: [1.1, .024, (2 * w - .6) / 12], r: rot0, mat: 14, color: (k + rg) % 2 ? [.07, .07, .075] : [.9, .9, .88] });
    }
    for (let k = 0; k < 12; k++) {
      const f = cadre(c, Math.round((-10 - 8 * k) / c.pas)), d = k % 2 ? 2.4 : -2.4, rot = capRot(f.a);
      const p = [f.x + f.r[0] * d, hauteurRoute(f, d, w) + .012, f.z + f.r[2] * d];
      objetsDepart.push({ shape: 'box', p: [p[0] + f.t[0] * 2.4, p[1], p[2] + f.t[2] * 2.4], s: [.22, .024, 2.2], r: rot, mat: 14, color: [.88, .88, .85] });
      objetsDepart.push({ shape: 'box', p: [p[0] + f.t[0] * 1.6, p[1], p[2] + f.t[2] * 1.6 + 0], s: [1.6, .024, .16], r: rot, mat: 14, color: [.88, .88, .85] });
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
    const droite = c.ligneDroite || { debut: -200, fin: 200 };
    const avant = Math.max(-300, B.circuit.ecart(c, 0, droite.debut) + 40), apres = Math.min(260, B.circuit.ecart(c, 0, droite.fin) - 60);
    for (let s = avant + 30; s < apres - 30; s += 72) {
      const f = cadre(c, Math.round(s / c.pas)), objets = [], loin = [];
      tribune(objets, loin, f, w, -1, 64, r);
      const l = lotDe(f.x, f.z, f.i); l.objets.push(...objets); l.loin.push(...loin);
    }
    for (let s = avant + 40; s < apres - 20; s += 60) {
      const f = cadre(c, Math.round(s / c.pas)), objets = [], loin = [];
      batimentStands(objets, loin, f, w, 1, 60, th.matieres);
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

    // Arbres : forêt continue (lot 1) — d'abord une haie le long du tour qui garantit un arbre à moins de
    // 200 m de chaque échantillon et 20 par tronçon de 300 m, puis la grille irrégulière en taches qui
    // remplit la campagne jusqu'au plafond. Hors de l'enceinte du circuit, mêmes exclusions des deux côtés.
    const positionsArbres = [];
    let nombre = 0;
    const MAX = options.arbres === undefined ? 2600 : options.arbres;
    for (let i = 0; i < c.n && nombre < MAX; i += 7) {   // un plan par 14 m de piste, de chaque côté
      const f = cadre(c, i);
      for (const cote of [-1, 1]) {
        for (let essai = 0; essai < 3; essai++) {        // si la place est prise (eau, roche, tribunes), on tente une autre distance
          const t = hache(i * 3 + essai, cote + 5, g + 57), d = 40 + t * 150;
          const glisse = (hache(i, cote + essai + 7, g + 71) - .5) * 12;
          const p = pointPlan(f, cote * d, 0), jx = p[0] + f.t[0] * glisse, jz = p[2] + f.t[2] * glisse;
          const q = interroger(jx, jz, 120);
          const dist = q.i < 0 ? 999 : q.d;
          if (dist < 30 || (q.i >= 0 && dist < 48 && sousTunnel(q.i))) continue;
          if (q.i >= 0 && Math.abs(B.circuit.ecart(c, 0, q.i * c.pas)) < 320 && dist < 90) continue;
          const y = terrain.sol(jx, jz);
          if (th.eau !== undefined && y < th.eau + 2.5) continue;
          if (th.montagnes && y > 160) continue;
          const objets = [], loin = [];
          arbre(objets, loin, jx, y - .2, jz, th.essence, r);
          ajouter(objets, loin, jx, jz); positionsArbres.push([jx, jz]); nombre++;
          break;
        }
      }
    }
    const [bx0, bz0, bx1, bz1] = terrain.bornes, PAS_A = 11;
    for (let z = bz0 + 40; z < bz1 - 40 && nombre < MAX; z += PAS_A) for (let x = bx0 + 40; x < bx1 - 40 && nombre < MAX; x += PAS_A) {
      const jx = x + (hache(x, z, g) - .5) * PAS_A * .9, jz = z + (hache(z, x, g + 1) - .5) * PAS_A * .9;
      const q = interroger(jx, jz, 120);
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
      arbre(objets, loin, jx, y - .2, jz, th.essence, r);
      ajouter(objets, loin, jx, jz); positionsArbres.push([jx, jz]); nombre++;
    }

    // Repères lointains selon le thème : phare et cabanons sur la côte, chalets en montagne, fermes en forêt.
    const villages = th.eau !== undefined ? 3 : 4;
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
        }
        if (th.eau !== undefined && v === 0) {
          objets.push({ shape: 'cylinder', p: [x, y + 11, z], s: [3, 22, 3], mat: 16, color: [.94, .94, .9] });
          for (let b = 0; b < 3; b++) objets.push({ shape: 'cylinder', p: [x, y + 4 + b * 7, z], s: [3.08, 2.2, 3.08], mat: 16, color: [.8, .1, .08] });
          objets.push({ shape: 'cylinder', p: [x, y + 23, z], s: [2.2, 2, 2.2], mat: 5, color: [1, .8, .4], emissive: .5 });
        }
        const l = lotDe(x, z, -1); l.objets.push(...objets); l.loin.push(...objets);
        break;
      }
    }
    // Rochers en montagne.
    if (th.montagnes) for (let k = 0; k < 160; k++) {
      const x = bx0 + r() * (bx1 - bx0), z = bz0 + r() * (bz1 - bz0), q = interroger(x, z, 200);
      if (q.i >= 0 && q.d < 34) continue;
      const y = terrain.sol(x, z), t = 2 + r() * 7;
      ajouter([{ shape: r() < .5 ? 'octa' : 'sphere', p: [x, y + t * .2, z], s: [t * (1 + r()), t, t * (1 + r())], r: [r(), r() * 6, r()], mat: 9, color: th.roche }], [], x, z);
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
      let mx = 0, my = 0, mz = 0;
      for (const o of l.objets) { mx += o.p[0]; my += o.p[1]; mz += o.p[2]; }
      mx /= l.objets.length; my /= l.objets.length; mz /= l.objets.length;
      let rayon = 0;
      for (const o of l.objets) { const s = o.s || [1, 1, 1]; rayon = Math.max(rayon, Math.hypot(o.p[0] - mx, o.p[1] - my, o.p[2] - mz) + Math.hypot(s[0], s[1], s[2]) / 2); }
      // Aucune portée propre : un lot se dessine jusqu'au plan lointain de la caméra, la brume fait la limite (un massif
      // qui surgit à 1 900 m se voit). La bascule vers la version allégée se fait là où un tronc tient en un pixel.
      lots.push({ objets: l.objets, loin: l.loin, centre: [mx, my, mz], rayon, portee: Infinity, bascule: l.lointain ? 900 : 520 });
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
    const atmosphere = Object.assign({ outdoorZones: [{ x: 0, z: 0, w: 1e7, d: 1e7 }] }, th.atmosphere);
    // enceinte : portion de la ligne droite bordée de tribunes et de stands (abscisses comptées depuis la ligne) ; une
    // caméra de bord de piste s'y place devant eux, pas derrière la glissière où elle serait dans les gradins.
    const decor = { nappes: nappes.concat(terrain.liste), lots, atmosphere, portique, obstacles, sol: terrain.sol, niveauEau: terrain.niveauEau, limites: lim, theme: th,
      arbres: positionsArbres,
      enceinte: { debut: avant - 10, fin: apres + 50 } };
    if (tunnelLampes) decor.tunnelLampes = tunnelLampes;
    // Végétation basse pilote : générateur et lots indépendants. Le décor historique et ses solides restent
    // identiques ; vegetation:false permet une comparaison avant/après avec exactement les mêmes obstacles.
    if (B.vegetation && options.vegetation !== false && c.theme === 'foret') {
      const v = B.vegetation.construire(c, { limites: lim, interroger });
      lots.push(...v.lots);
      decor.vegetation = { herbes: v.herbes, taillis: v.taillis, lots: v.lots.length };
    }
    return decor;
  }

  B.decor = { construire, THEMES, angles, base, limites, hauteurRoute, cadre };
})(globalThis.BITUME = globalThis.BITUME || {});
