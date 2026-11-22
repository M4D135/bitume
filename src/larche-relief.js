/* BITUME — versants éloignés de la Valle Stura. Grille métrique de Regione Piemonte
   (DTM ICE 2009–2011, CC BY 4.0), à l'extérieur des tuiles de conduite. */
(function (B) {
  'use strict';
  const occupationsDecodees = new WeakMap(), hauteursDecodees = new WeakMap();
  function octetsBase64(texte) {
    return typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(texte)
      : Uint8Array.from(atob(texte), c => c.charCodeAt(0));
  }
  function fractionsCouverture(d) {
    if (!occupationsDecodees.has(d)) occupationsDecodees.set(d, octetsBase64(d.fractionsU8));
    return occupationsDecodees.get(d);
  }
  function hauteursGrille(d) {
    if (!hauteursDecodees.has(d)) {
      const o = octetsBase64(d.metresI16LE);
      hauteursDecodees.set(d, new DataView(o.buffer, o.byteOffset, o.byteLength));
    }
    return hauteursDecodees.get(d);
  }
  function lireGrille(d) {
    const donnees = hauteursGrille(d);
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

  // À la résolution du MNT, les pentes et la position dans le versant
  // distinguent affleurements, dépôts de bas de pente et prairies abritées.
  // Les classes non documentées (dont l'eau) gardent leur pigment antérieur.
  const pigmentsEte = new WeakMap();
  function pigmentsRelief(d) {
    if (!d?.couverture) return null;
    if (pigmentsEte.has(d)) return pigmentsEte.get(d);
    const esa = d.couverture;
    const occupations = fractionsCouverture(esa);
    const nuances = d.nuancesU8 ? octetsBase64(d.nuancesU8) : null;
    const altitudes = hauteursGrille(d);
    const pigments = new Float32Array(d.nx*d.nz*4);
    const borne = t => Math.max(0, Math.min(1, t));
    const lisser = (a,b,t) => { const u=borne((t-a)/(b-a)); return u*u*(3-2*u); };
    const h = (i,j,defaut) => {
      if (i<0 || j<0 || i>=d.nx || j>=d.nz) return defaut;
      const v = altitudes.getInt16(2*(j*d.nx+i),true);
      return v === -32768 ? defaut : v;
    };
    for (let j=0;j<d.nz;j++) for (let i=0;i<d.nx;i++) {
      const centre=h(i,j,NaN);
      if (!Number.isFinite(centre)) continue;
      const x=d.x0+i*d.pas, z=d.z0+j*d.pas;
      const u=Math.max(0, Math.min(esa.nx-1, (x-esa.x0)/esa.pas)), v=Math.max(0, Math.min(esa.nz-1, (z-esa.z0)/esa.pas));
      const ix=Math.min(esa.nx-2,Math.floor(u)), iz=Math.min(esa.nz-2,Math.floor(v)), a=u-ix,b=v-iz;
      const e=3*(iz*esa.nx+ix), ligne=3*esa.nx;
      const fraction = k => ((1-b)*((1-a)*occupations[e+k]+a*occupations[e+3+k])+
        b*((1-a)*occupations[e+ligne+k]+a*occupations[e+ligne+3+k]))/255;
      const foret=fraction(0), herbe=fraction(1), nu=fraction(2), autre=Math.max(0,1-foret-herbe-nu);
      const dx=(h(i+1,j,centre)-h(i-1,j,centre))/(2*d.pas);
      const dz=(h(i,j+1,centre)-h(i,j-1,centre))/(2*d.pas);
      const pente=Math.hypot(dx,dz);
      // Écart à la moyenne des quatre versants à 300 m. La roche ressort
      // sur les buttes convexes ; les dépressions abritent les sols plus frais.
      const relief=centre-(h(i-3,j,centre)+h(i+3,j,centre)+h(i,j-3,centre)+h(i,j+3,centre))*.25;
      const escarpe=lisser(.34,.95,pente), expose=lisser(-28,38,relief);
      const frais=lisser(-7,-44,relief)*(1-.55*escarpe);
      const pierre=nu+(herbe*.50*escarpe*(.25+.75*expose));
      const pelouse=Math.max(0,herbe+nu-pierre);
      const rocheClaire=.36+.23*escarpe+.10*expose;
      const prairie=.91+.24*expose-.22*frais;
      const sousBois=.84+.26*expose-.19*frais;
      const k=4*(j*d.nx+i);
      pigments[k]=foret*.037*sousBois+pelouse*.22*prairie+pierre*rocheClaire*1.04+autre*.201;
      pigments[k+1]=foret*.086*sousBois+pelouse*(.285+.027*frais)*prairie+pierre*rocheClaire+autre*.209;
      pigments[k+2]=foret*.052*sousBois+pelouse*.108*prairie+pierre*rocheClaire*(.90+.035*escarpe)+autre*.174;
      if (nuances) {
        // Contraste local de réflectance et excès de vert mesurés en 2021.
        // La neige saisonnière garde sa propre palette. Les ombres au sol viennent de FERRO.
        const bin = 2*(j*d.nx+i);
        const contraste = 1 + .26*(nuances[bin]-128)/125;
        const vert = .07*(nuances[bin+1]-128)/125;
        pigments[k] *= contraste*(1-vert*.68);
        pigments[k+1] *= contraste*(1+vert);
        pigments[k+2] *= contraste*(1-vert*.32);
      }
      pigments[k+3]=1;
    }
    function lire(x,z,sortie) {
      const u=(x-d.x0)/d.pas,v=(z-d.z0)/d.pas,i=Math.floor(u),j=Math.floor(v);
      if (i<0 || j<0 || i+1>=d.nx || j+1>=d.nz) return false;
      const a=u-i,b=v-j, k=4*(j*d.nx+i), l=d.nx*4;
      const w0=(1-a)*(1-b)*pigments[k+3], w1=a*(1-b)*pigments[k+7];
      const w2=(1-a)*b*pigments[k+l+3], w3=a*b*pigments[k+l+7], poids=w0+w1+w2+w3;
      if (poids<=.5) return false;
      for(let m=0;m<3;m++) sortie[m]=(w0*pigments[k+m]+w1*pigments[k+4+m]+w2*pigments[k+l+m]+w3*pigments[k+l+4+m])/poids;
      return true;
    }
    pigmentsEte.set(d,lire);
    return lire;
  }

  function paletteVersants(d, hiver) {
    if (!d) return () => hiver ? [.66,.6864,.693] : [.36,.3744,.378];
    const donnees = fractionsCouverture(d);
    // Forêt, prairie, sol nu/peu végétalisé et fond des autres classes.
    const palette = hiver ? [[.37,.405,.395],[.62,.65,.66],[.52,.535,.54],[.53,.56,.56]]
      : [[.042,.080,.058],[.207,.235,.133],[.335,.310,.284],[.201,.209,.174]];
    return function couleur(x, z) {
      const fx = Math.max(0, Math.min(d.nx-1, (x-d.x0)/d.pas));
      const fz = Math.max(0, Math.min(d.nz-1, (z-d.z0)/d.pas));
      const ix = Math.min(d.nx-2, Math.floor(fx)), iz = Math.min(d.nz-2, Math.floor(fz));
      const u = fx-ix, v = fz-iz, k = 3*(iz*d.nx+ix), ligne = 3*d.nx;
      const rgb = palette[3].slice();
      for (let c=0; c<3; c++) {
        const p = ((1-v)*((1-u)*donnees[k+c]+u*donnees[k+3+c]) +
          v*((1-u)*donnees[k+ligne+c]+u*donnees[k+ligne+3+c]))/255;
        for (let j=0; j<3; j++) rgb[j] += p*(palette[c][j]-palette[3][j]);
      }
      return rgb;
    };
  }

  function sommetsRaccord(proches, cote, pas) {
    const sommetsBord = new Map(), nx = Math.round(cote / pas) + 1;
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
    return sommetsBord;
  }

  function raccorderPigments(panorama, bord) {
    // Les teintes de saison sont posées après la construction des deux maillages.
    // Les vues du tableau pointent sur les sommets proches déjà recolorés.
    for (const nappe of panorama) {
      const v = nappe.sommets;
      for (let k=0;k<v.length;k+=13) {
        const proche=bord.get(v[k]+','+v[k+2]);
        if (proche) v.set(proche.subarray(10,13),k+10);
      }
    }
  }

  function construire(d, proches, cote, pas, saison, sommetsBord = sommetsRaccord(proches,cote,pas)) {
    const altitude = lireGrille(d), groupes = new Map();
    const nx = Math.round(cote / pas) + 1;
    const couleur = paletteVersants(d.couverture, !!saison?.neige);
    const versant = saison?.neige ? null : pigmentsRelief(d), pigment = [0,0,0];
    // La grille lointaine et les accotements jouables ont des résolutions et
    // des profils différents. Raccorder le MNT en pente douce au bord réel du jeu.
    const raccords = new Map(), voisinages = new Map(), portee = 650;
    // Tous les sommets et normales dans une cellule consultent les mêmes tuiles
    // proches. Garder l'ordre du balayage pour reproduire exactement le raccord.
    function tuilesVoisines(ci, cj) {
      const cle = ci + ',' + cj;
      let liste = voisinages.get(cle);
      if (liste) return liste;
      liste = [];
      const rayon = Math.ceil(portee / cote);
      for (let j = cj-rayon; j <= cj+rayon; j++) for (let i = ci-rayon; i <= ci+rayon; i++) {
        const v = proches.get(i+','+j);
        if (v) liste.push({ x: i*cote, z: j*cote, v });
      }
      voisinages.set(cle, liste);
      return liste;
    }
    function hauteur(x, z) {
      const cle = x + ',' + z;
      if (raccords.has(cle)) return raccords.get(cle);
      const brut = altitude(x, z);
      if (!Number.isFinite(brut)) return brut;
      const ci = Math.floor(x/cote), cj = Math.floor(z/cote);
      let distance = portee, somme = 0, poids = 0;
      for (const tuile of tuilesVoisines(ci, cj)) {
        const v = tuile.v;
        const u = Math.max(0, Math.min(cote, x-tuile.x)), w = Math.max(0, Math.min(cote, z-tuile.z));
        const dis = Math.hypot(tuile.x+u-x, tuile.z+w-z);
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
      // Le joint reprend les trois canaux du sommet proche qui partage son altitude.
      const rgb = versant && bord ? bord.subarray(10,13) : versant && versant(x,z,pigment) ? pigment : couleur(x,z);
      g.s.push(x,h,z,normaleX,normaleY,normaleZ,0,0,0,23,rgb[0],rgb[1],rgb[2]);
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
  B.larcheRelief = { lireGrille, fractionsCouverture, pigmentsRelief, construire, sommetsRaccord, raccorderPigments };
})(globalThis.BITUME = globalThis.BITUME || {});
