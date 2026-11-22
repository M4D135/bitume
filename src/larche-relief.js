/* BITUME — versants éloignés de la Valle Stura. Grille métrique de Regione Piemonte
   (DTM ICE 2009–2011, CC BY 4.0), à l'extérieur des tuiles de conduite. */
(function (B) {
  'use strict';
  function lireGrille(d) {
    const octets = Uint8Array.from(atob(d.metresI16LE), c => c.charCodeAt(0));
    const donnees = new DataView(octets.buffer);
    return function altitude(x, z) {
      const fx = (x - d.x0) / d.pas, fz = (z - d.z0) / d.pas;
      const i = Math.floor(fx), j = Math.floor(fz);
      if (i < 0 || j < 0 || i + 1 >= d.nx || j + 1 >= d.nz) return NaN;
      const u = fx - i, v = fz - j;
      let somme = 0, poids = 0;
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
        const h = donnees.getInt16(2 * ((j + b) * d.nx + i + a), true);
        if (h === -32768) continue;
        const w = (a ? u : 1 - u) * (b ? v : 1 - v);
        somme += h * w; poids += w;
      }
      return poids > .5 ? somme / poids : NaN;
    };
  }

  function construire(d, proches, cote, pas, saison) {
    const altitude = lireGrille(d), groupes = new Map(), sommetsBord = new Map();
    const nx = Math.round(cote / pas) + 1;
    // Le même sommet que le terrain proche ferme chaque jonction, à son altitude exacte.
    for (const [cle, v] of proches) {
      const [i, j] = cle.split(',').map(Number);
      for (const [di, dj] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        if (proches.has((i + di) + ',' + (j + dj))) continue;
        for (let k = 0; k < nx; k++) {
          const a = di ? (di < 0 ? 0 : nx - 1) : k;
          const b = dj ? (dj < 0 ? 0 : nx - 1) : k;
          const off = (b * nx + a) * 13;
          sommetsBord.set(v[off] + ',' + v[off+2], v.subarray(off, off + 13));
        }
      }
    }
    // La grille lointaine et les accotements jouables ont des résolutions et
    // des profils différents. Raccorder le MNT en pente douce au bord réel du jeu.
    const raccords = new Map(), portee = 650;
    function hauteur(x, z) {
      const cle = x + ',' + z;
      if (raccords.has(cle)) return raccords.get(cle);
      const brut = altitude(x, z);
      if (!Number.isFinite(brut)) return brut;
      const ci = Math.floor(x/cote), cj = Math.floor(z/cote);
      let distance = portee, somme = 0, poids = 0;
      for (let j = cj-3; j <= cj+3; j++) for (let i = ci-3; i <= ci+3; i++) {
        const v = proches.get(i+','+j);
        if (!v) continue;
        const u = Math.max(0, Math.min(cote, x-i*cote)), w = Math.max(0, Math.min(cote, z-j*cote));
        const dis = Math.hypot(i*cote+u-x, j*cote+w-z);
        if (dis >= portee) continue;
        const a = Math.min(nx-2, Math.floor(u/pas)), b = Math.min(nx-2, Math.floor(w/pas));
        const fx = u/pas-a, fz = w/pas-b, k = (b*nx+a)*13+1, ligne = nx*13;
        const proche = (1-fz)*((1-fx)*v[k]+fx*v[k+13]) + fz*((1-fx)*v[k+ligne]+fx*v[k+ligne+13]);
        const facteur = (1-dis/portee)**2 / Math.max(1,dis*dis);
        somme += facteur*proche; poids += facteur; distance = Math.min(distance,dis);
      }
      const t = distance/portee, melange = t*t*(3-2*t);
      const h = poids ? (1-melange)*somme/poids + melange*brut : brut;
      raccords.set(cle,h);
      return h;
    }
    function sommet(g, x, z) {
      const cle = x + ',' + z;
      if (g.index.has(cle)) return g.index.get(cle);
      const bord = sommetsBord.get(cle), h = bord ? bord[1] : hauteur(x, z);
      if (!Number.isFinite(h)) return -1;
      const id = g.s.length / 13;
      g.index.set(cle, id);
      g.ymin = Math.min(g.ymin,h); g.ymax = Math.max(g.ymax,h);
      const p = cote/4;
      const hg = hauteur(x-p,z), hd = hauteur(x+p,z), hb = hauteur(x,z-p), hh = hauteur(x,z+p);
      const dx = (Number.isFinite(hg) ? hg : h) - (Number.isFinite(hd) ? hd : h);
      const dz = (Number.isFinite(hb) ? hb : h) - (Number.isFinite(hh) ? hh : h);
      const norme = Math.hypot(dx, 2*p, dz);
      const normaleX = bord ? bord[3] : dx/norme;
      const normaleY = bord ? bord[4] : 2*p/norme;
      const normaleZ = bord ? bord[5] : dz/norme;
      // FERRO interpole la normale mais applique une teinte plate par triangle.
      // Une base minérale commune laisse la lumière dessiner les versants en continu.
      const ton = saison?.neige ? .66 : .36;
      g.s.push(x,h,z,normaleX,normaleY,normaleZ,0,0,0,23,ton,ton*1.04,ton*1.05);
      return id;
    }
    const iFin = Math.floor((d.x0 + (d.nx-1)*d.pas)/cote);
    const jFin = Math.floor((d.z0 + (d.nz-1)*d.pas)/cote);
    for (let j = Math.floor(d.z0/cote); j <= jFin; j++) for (let i = Math.floor(d.x0/cote); i <= iFin; i++) {
      if (proches.has(i+','+j)) continue;
      const x = i*cote, z = j*cote;
      if (!Number.isFinite(altitude(x+cote/2,z+cote/2))) continue;
      const gx = Math.floor(i/4), gz = Math.floor(j/4), cle = gx+','+gz;
      let g = groupes.get(cle);
      if (!g) {
        g = { gx, gz, s: [], indices: [], index: new Map(), ymin: Infinity, ymax: -Infinity };
        groupes.set(cle, g);
      }
      const centre = sommet(g, x+cote/2, z+cote/2);
      // Sens antihoraire vu du ciel. Sur le bord intérieur, huit segments suivent
      // chaque tuile de 256 m. Deux suffisent entre tuiles du panorama.
      const contour = [];
      for (const [di,dj,x0,z0,ax,az] of [[-1,0,x,z,0,1],[0,1,x,z+cote,1,0],[1,0,x+cote,z+cote,0,-1],[0,-1,x+cote,z,-1,0]]) {
        const pasBord = proches.has((i+di)+','+(j+dj)) ? pas : cote/2;
        for (let k = 0; k < cote; k += pasBord) contour.push(sommet(g,x0+k*ax,z0+k*az));
      }
      for (let k = 0; k < contour.length; k++) {
        const a = contour[k], b = contour[(k+1)%contour.length];
        if (a >= 0 && b >= 0) g.indices.push(centre,a,b);
      }
    }
    const nappes = [];
    for (const g of groupes.values()) {
      if (!g.indices.length) continue;
      const bloc = 4*cote, centre = [(g.gx+.5)*bloc,(g.ymin+g.ymax)/2,(g.gz+.5)*bloc];
      const n = { sommets: new Float32Array(g.s), indices: new Uint32Array(g.indices), centre,
        rayon: Math.hypot(bloc,g.ymax-g.ymin,bloc)/2 };
      Object.defineProperty(n,'surfaceType',{ value: 'panorama' });
      nappes.push(n);
    }
    return nappes;
  }
  B.larcheRelief = { lireGrille, construire };
})(globalThis.BITUME = globalThis.BITUME || {});
